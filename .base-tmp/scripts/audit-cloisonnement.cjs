// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : « AUCUN VENDEUR NE VOIT JAMAIS RIEN D'UN AUTRE » (11 nov., Julien)
//         node scripts/audit-cloisonnement.cjs            (toutes les routes)
//         node scripts/audit-cloisonnement.cjs --prouve   (+ trous injectés)
//         CLOISON_DETAIL=1 …                              (chaque appel)
// ═══════════════════════════════════════════════════════════════════════════
// §4.10 : une route n'est vérifiée que si on l'EXÉCUTE. Chaque fichier `api/*.js`
// tourne pour de vrai, dans un processus neuf, contre une FAUSSE BASE qui
// applique la RLS de Supabase :
//   · jeton d'un vendeur (`sub`, signature valide) ⇒ il ne lit, ne modifie et
//     n'efface que SES lignes (`owner = auth.uid()`) ; une ligne écrite au nom
//     d'un autre est refusée (403) ;
//   · clé de SERVICE ⇒ tout est visible : c'est le code de la route qui doit
//     filtrer — exactement là où un trou peut se cacher ;
//   · clé publique sans session ⇒ rien.
// Trois personnes INVENTÉES : O (le propriétaire de l'installation, Julien),
// A (un vendeur), B (l'attaquant, un autre vendeur). Chaque ligne de O et de A
// porte un CANARI (« CANARI-A », « CANARI-O ») dans tous ses champs, et la base
// en FABRIQUE une pour chaque `id` qu'une route demande (eq., in.(…), like.) :
// quoi que la route lise, A et O en ont une.
//
// Pour CHAQUE mode de chaque route (extraits du code : un mode ajouté demain
// est couvert sans toucher ce fichier), en GET et en POST, B joue :
//   base     — son jeton, rien d'autre ;
//   usurpe   — son jeton + `owner`/`uid`/`user_id`/`vendeur`/`proprio` = A,
//              l'id d'un compte Vinted de A, l'adresse de A, des en-têtes
//              `x-vrm-equipe`/`x-vrm-owner` = A (en requête ET dans le corps) ;
//   in       — `owner=in.(A,B)`, `id=in.(main,…)`, `ids=…` (PostgREST injecté) ;
//   forge    — un jeton dont le `sub` est A mais la signature fausse (une
//              route qui décoderait le jeton sans demander à Supabase) ;
//   anonyme  — aucune session.
// Échec si : la réponse (corps, en-têtes, redirection) contient un canari ;
// une écriture (POST/PATCH/DELETE, RPC, admin) touche une ligne de A ; une
// fonction de la base est appelée AU NOM de A (`p_user`, `p_owner`…) ; le
// compte de A est lu ou effacé par l'admin de Supabase pendant la requête de B.
// Les écritures chez O (signalement, mesures anonymes…) sont LISTÉES et
// jugées une par une (liste blanche plus bas, chacune avec sa raison).
//
// Partagé PAR CONCEPTION (jugé à part, jamais un canari de donnée privée) : la
// Communauté (messages des groupes), la page publique d'un formateur, l'avatar
// public. Ces modes tournent quand même : la base leur sert des lignes privées
// de A — elles ne doivent pas sortir.
// ═══════════════════════════════════════════════════════════════════════════
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { Readable } = require('stream');
const RACINE = process.env.CLOISON_RACINE || path.join(__dirname, '..');

const O = '00000000-0000-4000-8000-0000000000aa';   // propriétaire de l'installation (inventé)
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const SUPA = 'https://banc-cloison.supabase.co';
const SERVICE = 'cle-service-banc-cloison';
const ANON = (() => { const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url'); return `${b({ alg: 'HS256' })}.${b({ role: 'anon', iss: 'supabase' })}.anon`; })();
const jwt = (sub, sig = 'sig-ok') => { const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url'); return `${b({ alg: 'HS256', typ: 'JWT' })}.${b({ sub, role: 'authenticated', session_id: sub.replace(/.$/, 'f'), aud: 'authenticated' })}.${sig}`; };

// Ce que chaque route reçoit : le paramètre qui choisit le mode, et où.
const ROUTES = {
  'compte.js': { param: 'mode', defaut: 'sante' },
  'email-rattacher.js': { param: 'mode' },
  'email-inbound.js': { param: 'mode' },
  'push.js': { param: 'action', corps: true },
  'ebay.js': { param: 'action', corps: true, aussi: ['mode'] },
  'ai.js': { param: 'mode' },
  'relais.js': { param: 'mode' },
  'widget.js': { param: 'mode' },
  'ship-reminders.js': { param: 'mode' },
  'vinted-connect.js': { param: 'mode' },
  'vinted-proxy.js': { param: 'mode' },
  'vinted-refresh.js': { param: 'mode' },
};
// Modes partagés par conception (voir l'en-tête).
const PARTAGE = new Set(['compte.js:communaute', 'compte.js:formateur', 'compte.js:avatar-public', 'compte.js:configuration-auth']);
// Écritures chez O permises pendant une requête de B : CRÉER une ligne neuve
// à SON préfixe (jamais réécrire une ligne de O qui existait). Raison à côté.
const ECRIT_CHEZ_O = [
  [/^signalement_/, 'un signalement arrive dans la boîte du propriétaire (Signaler un problème)'],
  [/^mesures_/, 'les temps réels anonymes, agrégés par jour (aucune donnée du vendeur)'],
  [/^vrm_plantages|^plantage_/, 'le relevé des plantages, sans donnée personnelle'],
  // Seule réécriture permise : prévenir le propriétaire (signalement) range
  // l'état de SES abonnements de notification (un appareil mort est retiré),
  // sous SON filtre, en comparer-et-échanger. Rien de B n'y entre.
  [/^push_subs$/, 'la notification « nouveau signalement » range les abonnements du propriétaire', true],
];

const modesDe = (fichier) => {
  const src = fs.readFileSync(path.join(RACINE, 'api', fichier), 'utf8');
  const cfg = ROUTES[fichier];
  const noms = [cfg.param, ...(cfg.aussi || [])];
  const out = new Set(['']);
  for (const n of noms) {
    const re = new RegExp(`\\b${n}\\s*===?\\s*'([a-z0-9_-]+)'`, 'g');
    let m; while ((m = re.exec(src))) out.add(m[1]);
  }
  if (cfg.defaut) out.delete('');
  return [...out];
};

// ═══ PARENT : un processus par route ═══════════════════════════════════════
if (!process.argv[2] || process.argv[2] === '--prouve') {
  const prouve = process.argv[2] === '--prouve';
  let ok = 0, ko = 0;
  const lancer = (fichier, env = {}) => {
    const r = spawnSync(process.execPath, [__filename, 'route', fichier], { encoding: 'utf8', timeout: 240000, env: { ...process.env, ...env }, maxBuffer: 64 << 20 });
    const out = (r.stdout || '');
    if (r.status !== 0 && !/❌/.test(out)) return { out: out + `❌ ${fichier} — le processus est mort (code ${r.status}) ${String(r.stderr || '').split('\n').slice(-5).join(' | ')}\n`, rouge: true };
    return { out, rouge: /❌/.test(out) };
  };
  if (!prouve) {
    const tot = { appels: 0, profonds: 0 };
    for (const f of Object.keys(ROUTES)) {
      const { out } = lancer(f);
      process.stdout.write(out);
      const m = /= (\d+) appels \((\d+) ont touché la base\) · (\d+) contrôles verts · (\d+) rouges/.exec(out);
      if (m) { tot.appels += +m[1]; tot.profonds += +m[2]; ok += +m[3]; ko += +m[4]; } else ko++;
    }
    console.log(`\n${tot.appels} appels de B (${tot.profonds} ont touché la base) · ${ok} ✅ · ${ko} ❌`);
    process.exit(ko ? 1 : 0);
  }
  // --prouve : chaque trou injecté (dans une COPIE de l'arbre) doit rougir.
  const os = require('os');
  const MUTATIONS = require('./_cloisonnement-mutations.cjs');
  let rouges = 0;
  for (const mu of MUTATIONS) {
    const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'cloison-mut-'));
    for (const d of ['api', 'src', 'package.json']) fs.cpSync(path.join(RACINE, d), path.join(dossier, d), { recursive: true });
    try { fs.symlinkSync(path.join(RACINE, 'node_modules'), path.join(dossier, 'node_modules')); } catch (_) {}
    const cible = path.join(dossier, mu.fichier);
    const avant = fs.readFileSync(cible, 'utf8');
    let apres = avant.replace(mu.de, mu.vers);
    for (const [de, vers] of (mu.puis || [])) apres = apres.replace(de, vers);
    if (apres === avant) { console.log(`❌ mutation « ${mu.nom} » : motif introuvable (${mu.fichier})`); ko++; continue; }
    fs.writeFileSync(cible, apres);
    const { out, rouge } = lancer(mu.route, { CLOISON_RACINE: dossier });
    fs.rmSync(dossier, { recursive: true, force: true });
    const premiers = out.split('\n').filter((l) => l.startsWith('❌')).slice(0, 2).join('\n   ');
    console.log(`${rouge ? '✅' : '❌'} mutation « ${mu.nom} » ⇒ ${rouge ? 'ROUGE' : 'reste vert (le contrôle ne la voit pas)'}${rouge ? '\n   ' + premiers : ''}`);
    if (rouge) rouges++; else ko++;
  }
  console.log(`\n${rouges}/${MUTATIONS.length} mutations rouges · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
}

// ═══ ENFANT : une route ════════════════════════════════════════════════════
const FICHIER = process.argv[3];
const DETAIL = process.env.CLOISON_DETAIL === '1';
process.env.SUPABASE_URL = SUPA;
process.env.SUPABASE_SERVICE_KEY = SERVICE;
process.env.SUPABASE_KEY = ANON;
process.env.VRM_OWNER_UID = O;
process.env.CRON_SECRET = 'cron-banc-cloison';
process.env.EMAIL_INBOUND_SECRET = 'email-banc-cloison';
process.env.STRIPE_SECRET_KEY = 'sk_test_banc_cloison';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_banc_cloison';
process.env.EBAY_APP_ID = 'banc'; process.env.EBAY_CERT_ID = 'banc'; process.env.EBAY_RUNAME = 'banc'; process.env.EBAY_DEV_ID = 'banc';
process.env.VAPID_PUBLIC_KEY = ''; delete process.env.VAPID_PRIVATE_KEY;
delete process.env.AI_API_KEY; delete process.env.ANTHROPIC_API_KEY;
process.env.VRM_CLE_CHIFFREMENT = process.env.VRM_CLE_CHIFFREMENT || 'b'.repeat(64);
process.env.RELANCES_SECRET = 'relances-banc-cloison';

// N : le propriétaire NEUTRE (quarantaine des e-mails, files partagées) — à personne.
const N = '00000000-0000-0000-0000-000000000000';
const CANARI = { [O]: 'CANARI-O', [A]: 'CANARI-A', [B]: 'MOI-B', [N]: 'CANARI-N' };
const VINTED = { [O]: '7000001', [A]: '7000002', [B]: '7000003' };
const CLE_EBAY = { [O]: 'c3c3c3c3c3c3c3c3', [A]: 'a1a1a1a1a1a1a1a1', [B]: 'b2b2b2b2b2b2b2b2' };
const ADRESSE = { [O]: 'canari-o@exemple.test', [A]: 'canari-a@exemple.test', [B]: 'moi-b@exemple.test' };
const FUITE = /canari-[aon]|jeton-canari|tok-canari|\b7000002\b|\b7000001\b|a1a1a1a1a1a1a1a1|c3c3c3c3c3c3c3c3/i;

// La donnée d'une ligne : toutes les formes que les routes savent lire, et un
// canari dans chaque champ texte.
const donnee = (owner, id) => {
  const t = CANARI[owner];
  const item = { id: 90000000 + (owner === A ? 2 : owner === O ? 1 : 3), title: `${t} titre`, titre: `${t} titre`, price: { amount: '42.0', currency_code: 'EUR' }, user: { id: VINTED[owner], login: t }, photos: [{ url: `https://exemple.test/${t}.jpg` }], brand_title: t, size_title: '42', status: 'active' };
  const tx = { id: 80000000 + (owner === A ? 2 : 1), item_id: item.id, title: `${t} vente`, status_title: 'Commande finalisée', transaction_user_status: 'needs_action', status: 450, opposite_user: { login: `${t}-acheteur` }, shipment: { tracking_code: `${t}-SUIVI`, status_title: 'Au point relais' } };
  return {
    canari: t, id, nom: t, titre: t, texte: t, message: t, body: t, sujet: t, subject: t, email: ADRESSE[owner],
    adresses: { [ADRESSE[owner]]: { owner, prouvee: true } }, vrm_widget_token: `jeton-${t}`, vrm_sms_token: `jeton-${t}-sms`,
    items: [item], transactions: [tx], orders: [tx], liste: [t], entrees: [{ titre: t, at: Date.now() }], journal: [{ type: 'favori', compte: t, at: Date.now() }],
    payload: { items: [item], transaction: tx, transactions: [tx], orders: [tx], canari: t, username: t, login: t },
    capturedAt: new Date().toISOString(), nItems: 1, n: 1, owner_note: t, pdfB64: Buffer.from(`%PDF ${t}`).toString('base64'),
    vinted_inventory: [{ title: t, num: '7', itemId: item.id }], vinted_accounts: [{ id: VINTED[owner], username: t }],
    comptes: [{ cle: CLE_EBAY[owner], pseudo: `${t}-ebay`, principal: false, ajouteLe: 1, site: 'FR' }], refresh_token_ebay: `tok-${t}-ebay`,
    proprietaires: owner === N ? [A, O] : [owner], groupes: owner === N ? { [A]: { canari: 'CANARI-A' }, [O]: { canari: 'CANARI-O' } } : { [owner]: { canari: t } },
    rev: 1, cle: `cle-${t}`, token: `tok-${t}`, access_token: `tok-${t}`, refresh_token: `tok-${t}-r`, siret: t, iban: t,
  };
};

// ── La fausse base ─────────────────────────────────────────────────────────
const { servir: servirApp, getPath } = require(path.join(__dirname, 'bancs', '_minipgrest.cjs'));
// `_minipgrest` projette la forme d'`app_data` ; les autres tables ont leurs colonnes.
const servir = (rows, url, headers, table) => {
  if (table === 'app_data') return servirApp(rows, url, headers);
  const u = new URL(url); const sel = u.searchParams.get('select'); u.searchParams.delete('select');
  const r = servirApp(rows.map((x) => ({ ...x, data: x })), u.toString(), headers);
  const cols = !sel || sel === '*' ? null : sel.split(',').map((c) => { const m = /^(?:([^:]+):)?(.+)$/.exec(c.trim()); return [m[1] || m[2].split(/->>|->/).pop(), m[2]]; });
  r.body = r.body.map((b) => { const ligne = b.data; if (!cols) return ligne; const o = {}; for (const [al, ch] of cols) o[al] = /^data/.test(ch) ? getPath(ligne, ch) : ligne[ch]; return o; });
  return r;
};
let tables, seq, appelEnCours, journal;
const graine = () => {
  tables = { app_data: [] };
  seq = 100;
  for (const ow of [O, A, B]) for (const id of ['main', 'vrm_email_owners', 'vrm_widget_index', 'vrm_pro_facture']) tables.app_data.push({ owner: ow, id, data: donnee(ow, id), updated_at: new Date().toISOString(), meta: {} });
  const autre = (ow, extra = {}) => ({ id: ++seq, owner: ow, user_id: ow, canari: CANARI[ow], email: ADRESSE[ow], ...extra });
  tables.vinted_accounts = [O, A, B].map((ow) => autre(ow, { vinted_user_id: VINTED[ow], username: CANARI[ow], access_token: `tok-${CANARI[ow]}`, refresh_token: `tok-${CANARI[ow]}-r`, expires_at: 1, active: true, site: 'vinted.fr' }));
  tables.abonnements = [O, A, B].map((ow) => autre(ow, { stripe_customer_id: `cus_${CANARI[ow]}`, stripe_subscription_id: `sub_${CANARI[ow]}`, statut: 'active', status: 'active', plan: 'pro' }));
  tables.parrainages = [O, A, B].map((ow) => autre(ow, { parrain: ow, filleul: ow === A ? O : A, code: `code-${CANARI[ow]}` }));
  tables.parrainage_codes = [O, A, B].map((ow) => autre(ow, { code: `code-${CANARI[ow]}` }));
  tables.essais_gratuits = [O, A, B].map((ow) => autre(ow, { empreinte: `emp-${CANARI[ow]}` }));
  tables.detourage_usage = [O, A, B].map((ow) => autre(ow, { mois: '2026-11', n: 1 }));
  tables.vrm_reglages = [{ id: 'global', owner: O, data: { canari: 'CANARI-O' } }];
};
// La base fabrique une ligne pour chaque id demandé : A et O en ont une.
const idsDemandes = (u) => {
  const out = new Set();
  const lire = (v) => {
    if (!v) return;
    let m;
    if ((m = /^(?:not\.)?eq\.(.+)$/.exec(v))) out.add(m[1]);
    else if ((m = /^(?:not\.)?in\.\((.*)\)$/.exec(v))) m[1].split(',').forEach((x) => out.add(x.replace(/^"|"$/g, '')));
    else if ((m = /^(?:not\.)?like\.(.+)$/.exec(v))) out.add(m[1].replace(/[*%]/g, 'canari'));
  };
  lire(u.searchParams.get('id'));
  for (const k of ['or', 'and']) { const v = u.searchParams.get(k); if (v) { const re = /id\.(eq|like|in)\.(\([^)]*\)|[^,)]+)/g; let m; while ((m = re.exec(v))) lire(`${m[1]}.${m[2]}`); } }
  return [...out].filter((x) => x && x.length < 200);
};
// (le neutre n'a jamais de `main` : il n'est le vendeur de personne)
const fabriquer = (ids) => { for (const id of ids) for (const ow of (id === 'main' ? [O, A, B] : [O, A, B, N])) if (!tables.app_data.some((r) => r.owner === ow && r.id === id)) tables.app_data.push({ owner: ow, id, data: donnee(ow, id), updated_at: new Date().toISOString(), meta: {} }); };

const qui = (headers = {}) => {
  const h = {}; for (const [k, v] of Object.entries(headers || {})) h[k.toLowerCase()] = v;
  const t = String(h.authorization || '').replace(/^Bearer\s+/i, '').trim() || String(h.apikey || '');
  if (t === SERVICE) return { role: 'service' };
  const p = t.split('.');
  if (p.length === 3 && p[2] === 'sig-ok') { try { const j = JSON.parse(Buffer.from(p[1], 'base64url').toString()); if (j.sub) return { role: 'vendeur', uid: j.sub }; } catch (_) {} }
  return { role: 'anon' };
};
const rep = (c, s = 200, h = {}) => new Response(typeof c === 'string' ? c : JSON.stringify(c), { status: s, headers: { 'content-type': 'application/json', ...h } });
const note = (genre, detail) => { if (appelEnCours) appelEnCours.evenements.push({ genre, ...detail }); };

const fauxFetch = async (url, opts = {}) => {
  const u = new URL(String(url));
  const m = String(opts.method || 'GET').toUpperCase();
  const corps = typeof opts.body === 'string' ? opts.body : (opts.body ? String(opts.body) : '');
  if (!/\.supabase\.co$/.test(u.hostname)) { note('externe', { url: u.origin + u.pathname, m }); return rep({ error: 'banc : service extérieur absent' }, 503); }
  const ident = qui(opts.headers);
  const p = u.pathname;
  if (p === '/auth/v1/user') {
    if (ident.role !== 'vendeur') return rep({ msg: 'invalid JWT' }, 401);
    return rep({ id: ident.uid, email: ADRESSE[ident.uid] || 'x@exemple.test', email_confirmed_at: '2026-01-01T00:00:00Z', created_at: '2026-01-01T00:00:00Z', app_metadata: { provider: 'email' }, identities: [] });
  }
  if (p.startsWith('/auth/v1/admin/users')) {
    const cible = decodeURIComponent(p.split('/')[5] || '');
    if (ident.role !== 'service') return rep({ msg: 'forbidden' }, 403);
    if (cible === A || cible === O) note(m === 'GET' ? 'admin-lit' : 'admin-ecrit', { cible, m });
    if (!cible) return rep({ users: [O, A, B].map((id) => ({ id, email: ADRESSE[id], created_at: '2026-01-01T00:00:00Z' })) });
    if (m === 'DELETE') return rep({}, 200);
    return rep({ id: cible, email: ADRESSE[cible] || 'x@exemple.test', created_at: '2026-01-01T00:00:00Z', email_confirmed_at: '2026-01-01T00:00:00Z' });
  }
  if (p.startsWith('/auth/v1/')) return rep({}, 200);
  if (p.startsWith('/storage/v1/')) {
    if (ident.role === 'anon') return rep({}, 401);
    const chemin = decodeURIComponent(p);
    if (m !== 'GET' && (chemin.includes(A) || chemin.includes(O))) note('ecriture', { table: 'storage', owner: chemin.includes(A) ? A : O, id: chemin, m });
    if (m === 'GET' && (chemin.includes(A) || chemin.includes(O))) return new Response(`image ${chemin.includes(A) ? 'CANARI-A' : 'CANARI-O'}`, { status: 200, headers: { 'content-type': 'image/png' } });
    return rep({ Key: chemin }, 200);
  }
  if (p.startsWith('/rest/v1/rpc/')) {
    const nom = p.slice('/rest/v1/rpc/'.length);
    let args = {}; try { args = JSON.parse(corps || '{}') || {}; } catch (_) {}
    const cibles = Object.entries(args).filter(([k, v]) => /^(p_)?(user|owner|uid|vendeur|proprio|membre)(_id)?$/.test(k) && (v === A || v === O));
    if (cibles.length) note(ident.role === "service" ? "rpc-autrui" : "rpc-sql", { nom, args: cibles.map(([k, v]) => `${k}=${v === A ? 'A' : 'O'}`).join(',') });
    if (nom === 'vrm_acces') return ident.role === 'vendeur' ? rep({ acces: true, obligatoire: true, proprietaire: ident.uid === O, lecture: true }) : rep({ message: 'jwt' }, 401);
    if (nom === 'vrm_acces_pour') return rep(true);
    if (nom === 'vrm_sessions_de') { const pu = args.p_user || (ident.uid || ''); return rep([{ id: pu.replace(/.$/, 'f'), user_id: pu, user_agent: `Chrome ${CANARI[pu] || ''}`, cree_le: '2026-11-01T00:00:00Z', actif_le: '2026-11-11T00:00:00Z' }]); }
    if (nom === 'vrm_equipe_lister') return rep({ membre_de: [], membres: [], invitations: [] });
    return rep([]);
  }
  const tm = /^\/rest\/v1\/([a-z_]+)$/.exec(p);
  if (!tm) return rep({ message: 'inconnu' }, 404);
  const table = tm[1];
  if (!tables[table]) tables[table] = [];
  if (table === 'app_data') fabriquer(idsDemandes(u));
  // RLS : ce que ce jeton a le droit de voir.
  const visibles = (rows) => ident.role === 'service' ? rows : ident.role === 'vendeur' ? rows.filter((r) => r.owner === ident.uid || r.owner == null) : [];
  const enTetes = {}; for (const [k, v] of Object.entries(opts.headers || {})) enTetes[k.toLowerCase()] = v;
  if (m === 'GET' || m === 'HEAD') {
    note('lecture', { table, role: ident.role });
    if (ident.role === 'service') {
      const ow = String(u.searchParams.get('owner') || '');
      for (const [qui2, nom2] of [[A, 'A'], [O, 'O']]) if (ow.includes(qui2)) note('lecture-autrui', { table, cible: nom2, id: u.searchParams.get('id') || '' });
    }
    if (ident.role === 'anon' && table !== 'vrm_reglages') return rep([]);
    const { body, range } = servir(visibles(tables[table]), u.toString(), enTetes, table);
    if (/application\/vnd\.pgrst\.object/.test(String(enTetes.accept || ''))) return body.length === 1 ? rep(body[0]) : rep({ message: 'pas une ligne' }, 406);
    return rep(body, 200, { 'content-range': range });
  }
  if (m === 'POST') {
    if (ident.role === 'anon') return rep({ message: 'RLS' }, 401);
    let lignes; try { lignes = JSON.parse(corps || '[]'); } catch (_) { return rep({ message: 'json' }, 400); }
    if (!Array.isArray(lignes)) lignes = [lignes];
    const sortie = [];
    for (const l0 of lignes) {
      const l = { ...l0 };
      if (ident.role === 'vendeur') { if (l.owner == null) l.owner = ident.uid; if (l.owner !== ident.uid) return rep({ code: '42501', message: 'new row violates row-level security policy' }, 403); }
      if (table === 'vinted_accounts' && String(l.vinted_user_id) === VINTED[A] && l.owner !== A) note('appropriation', { table, id: `vinted_user_id=${l.vinted_user_id}`, m });
      if (l.owner === A || l.owner === O) note('ecriture', { table, owner: l.owner, id: l.id, m, existait: tables[table].some((r) => r.owner === l.owner && r.id === l.id && l.id != null) });
      const i = tables[table].findIndex((r) => r.owner === l.owner && r.id === l.id && l.id != null);
      if (i >= 0) tables[table][i] = { ...tables[table][i], ...l }; else tables[table].push({ id: l.id ?? ++seq, ...l });
      sortie.push(l);
    }
    return rep(/return=representation/.test(String(enTetes.prefer || '')) ? sortie : '', 201);
  }
  if (m === 'PATCH' || m === 'DELETE') {
    if (ident.role === 'anon') return rep([]);
    const { body } = servir(visibles(tables[table]), u.toString(), {}, table);
    const touchees = tables[table].filter((r) => body.some((b) => b.id === r.id && b.owner === r.owner) && visibles([r]).length);
    let patch = {}; try { patch = JSON.parse(corps || '{}') || {}; } catch (_) {}
    for (const r of touchees) {
      if (r.owner === A || r.owner === O) note('ecriture', { table, owner: r.owner, id: r.id, m, existait: true });
      if (m === 'PATCH') Object.assign(r, patch); else tables[table].splice(tables[table].indexOf(r), 1);
    }
    return rep(/return=representation/.test(String(enTetes.prefer || '')) ? touchees : '', m === 'DELETE' ? 200 : 200);
  }
  return rep([]);
};
global.fetch = fauxFetch;

// ── Requête / réponse façon Vercel ───────────────────────────────────────────
const fabriqueReq = ({ method, query, headers, body }) => {
  const brut = Buffer.from(body ? JSON.stringify(body) : '');
  const r = Readable.from(brut.length ? [brut] : []);
  return Object.assign(r, { method, query, headers: { host: 'vrm.center', 'user-agent': 'banc-cloison', 'content-type': 'application/json', ...headers }, body: method === 'GET' ? undefined : body, url: '/api/x?' + new URLSearchParams(query).toString(), socket: { remoteAddress: '203.0.113.9' }, connection: { remoteAddress: '203.0.113.9' } });
};
const fabriqueRes = () => {
  const r = { code: 200, morceaux: [], entetes: {}, fini: false };
  r.status = (n) => { r.code = n; return r; };
  r.setHeader = (k, v) => { r.entetes[String(k).toLowerCase()] = v; return r; };
  r.getHeader = (k) => r.entetes[String(k).toLowerCase()];
  r.writeHead = (n, h) => { r.code = n; if (h) for (const [k, v] of Object.entries(h)) r.setHeader(k, v); return r; };
  r.json = (o) => { r.morceaux.push(JSON.stringify(o)); r.fini = true; return r; };
  r.send = (o) => { r.morceaux.push(typeof o === 'string' ? o : Buffer.isBuffer(o) ? o.toString('latin1') : JSON.stringify(o)); r.fini = true; return r; };
  r.write = (o) => { r.morceaux.push(String(o)); return true; };
  r.end = (o) => { if (o != null) r.morceaux.push(Buffer.isBuffer(o) ? o.toString('latin1') : String(o)); r.fini = true; return r; };
  r.redirect = (a, b) => { const [c, l] = typeof a === 'number' ? [a, b] : [302, a]; r.code = c; r.entetes.location = l; r.fini = true; return r; };
  return r;
};

// ── Les variantes de B ──────────────────────────────────────────────────────
// Le corps « ordinaire » d'un appel (ses valeurs à lui) : assez pour passer
// les contrôles de forme et ATTEINDRE la base.
const corpsDe = (qui) => ({
  code: `CODE-${qui === A ? 'A' : 'B'}`, compte: VINTED[qui], compteId: VINTED[qui], vinted_user_id: VINTED[qui], account_id: VINTED[qui],
  id: 'main', session: qui.replace(/.$/, 'f'), abonne: false, actif: false, type: 'stock', texte: 'bonjour', message: 'bonjour',
  cle: 'pr_banc_cloison_123456', ville: 'Rennes', groupe: 'groupe-banc', plan: 'pro', siret: '12345678900011', tx: '80000003',
  transaction: '80000003', numero: 'FA-2026-0001', items: [{ id: 90000003 }], lot: [], adresse: ADRESSE[qui], email: ADRESSE[qui],
  ticket: 'ticket-banc', confirmation: 'SUPPRIMER', motDePasse: 'x', annee: 2026, mois: '2026-11', d: Buffer.from(qui).toString('base64url'),
  // vinted-proxy / vinted-connect : SON compte Vinted (un jeton Vinted FABRIQUÉ : Vinted le refusera).
  uid: VINTED[qui], endpoint: '/api/v2/users/current', refreshToken: `tok-vinted-${qui === A ? 'a' : 'b'}`,
  accessToken: jwtVinted(VINTED[qui]), source: 'app',
});
// Un jeton Vinted d'apparence valide (non expiré) portant l'`account_id` voulu.
function jwtVinted(id) { const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url'); return `${b({ alg: 'RS256' })}.${b({ account_id: Number(id), sub: id, exp: Math.floor(Date.now() / 1000) + 3600 })}.faux`; }
const usurpation = { owner: A, uid: A, user_id: A, userId: A, vendeur: A, proprio: A, membre: A, compte: VINTED[A], account: VINTED[A], vinted_user_id: VINTED[A], accountId: VINTED[A], adresse: ADRESSE[A], email: ADRESSE[A], id: 'main', ids: 'main,vrm_email_owners', texte: 'email_reception_' + 'a'.repeat(16), lire: 'email_reception_' + 'a'.repeat(16), tx: '80000002', item: '90000002', session: A.replace(/.$/, 'f'), d: Buffer.from(A).toString('base64url'), k: '', key: '' };
const VARIANTES = [
  { nom: 'base', h: () => ({ authorization: `Bearer ${jwt(B)}` }), q: {}, c: corpsDe(B) },
  { nom: 'usurpe', h: () => ({ authorization: `Bearer ${jwt(B)}`, 'x-vrm-equipe': A, 'x-vrm-owner': A, 'x-vrm-key': '' }), q: usurpation, c: { ...corpsDe(A), ...usurpation } },
  { nom: 'in', h: () => ({ authorization: `Bearer ${jwt(B)}` }), q: { owner: `in.(${A},${B})`, id: 'in.(main,vrm_email_owners)', ids: `in.(${A})`, uid: `eq.${A}`, select: 'owner,data' }, c: { ...corpsDe(B), owner: `in.(${A},${B})`, id: 'in.(main,vrm_email_owners)', ids: [`in.(${A})`] } },
  // eBay : la clé d'un compte eBay de A (16 hexa), et la clé du widget de B (sa clé à lui).
  { nom: 'cles', h: () => ({ authorization: `Bearer ${jwt(B)}` }), q: { k: `jeton-${CANARI[B]}` }, c: { ...corpsDe(B), compte: CLE_EBAY[A], cle: CLE_EBAY[A], uid: VINTED[A] } },
  { nom: 'forge', h: () => ({ authorization: `Bearer ${jwt(A, 'forge')}` }), q: {}, c: corpsDe(A) },
  { nom: 'anonyme', h: () => ({}), q: {}, c: corpsDe(A) },
];
// Les modes qui choisissent une ACTION dans leur corps : chaque action est
// jouée (lues dans le code des bibliothèques : une action ajoutée est couverte).
const ACTIONS = {
  'compte.js': {
    communaute: ['communaute.js', 'accompagnement.js', 'formateur.js'], equipe: ['equipe.js'], 'facture-pro': ['facture-pro.js'],
    'facture-autre': ['facture-autres.js'], superpdp: ['superpdp.js'], photoroom: ['photoroom-cle.js'], favoris: ['favoris.js'],
    agenda: ['agenda-ics.js'], parrainage: [['rattacher']], operations: ['operations.js'], signalement: [['traite']],
  },
};
const actionsDe = (fichier, mode) => {
  const l = (ACTIONS[fichier] || {})[mode];
  if (!l) return [null];
  const out = new Set();
  for (const lib of l) {
    if (Array.isArray(lib)) { lib.forEach((x) => out.add(x)); continue; }
    const f = path.join(RACINE, 'api', '_lib', lib);
    if (!fs.existsSync(f)) continue;
    const re = /\b(?:action|a)\s*===?\s*'([a-z0-9_-]+)'/g; const src = fs.readFileSync(f, 'utf8'); let m;
    while ((m = re.exec(src))) out.add(m[1]);
  }
  return out.size ? [null, ...out] : [null];
};

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; if (!c || DETAIL) console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };

(async () => {
  const cfg = ROUTES[FICHIER];
  let route;
  try { route = (await import('file://' + path.join(RACINE, 'api', FICHIER))).default; }
  catch (e) { console.log(`❌ ${FICHIER} — import impossible : ${e.message}`); process.exit(1); }
  const modes = modesDe(FICHIER);
  const resume = { appels: 0, fuites: 0, ecritures: 0 };
  const chezO = new Map();
  const sql = new Set();
  for (const mode of modes) {
   for (const action of actionsDe(FICHIER, mode)) {
    for (const method of (action ? ['POST'] : ['GET', 'POST'])) {
      for (const v of VARIANTES) {
        graine();
        const q = { ...v.q };
        if (mode) { q[cfg.param] = mode; for (const a of (cfg.aussi || [])) q[a] = mode; }
        if (action && method === 'GET') q.action = action;
        const corps = method === 'POST' ? { ...v.c, ...q, ...(cfg.corps && mode ? { [cfg.param]: mode } : {}), ...(action ? { action } : {}) } : undefined;
        const req = fabriqueReq({ method, query: q, headers: v.h(), body: corps });
        const res = fabriqueRes();
        appelEnCours = { evenements: [] };
        const nomAppel = `${FICHIER} ${method} ${cfg.param}=${mode || '(aucun)'}${action ? ' action=' + action : ''} [${v.nom}]`;
        let erreur = null;
        try { await Promise.race([route(req, res), new Promise((_, rej) => setTimeout(() => rej(new Error('délai 20 s')), 20000))]); }
        catch (e) { erreur = e; }
        resume.appels++;
        const sortie = res.morceaux.join('') + ' ' + JSON.stringify(res.entetes);
        const fuite = FUITE.exec(sortie);
        const ev = appelEnCours.evenements;
        const surA = ev.filter((e) => (e.genre === 'ecriture' && e.owner === A) || e.genre === 'appropriation' || e.genre === 'rpc-autrui' || e.genre === 'admin-ecrit' || (e.genre === 'admin-lit' && e.cible === A));
        const surO = ev.filter((e) => e.genre === 'ecriture' && e.owner === O);
        // Une lecture à la clé de service PORTÉE sur A (filtre owner=A) pendant
        // la requête de B : la route travaille DANS le compte de A — même si
        // rien ne sort, c'est la porte d'un trou. Chez O : seulement ce qui
        // sert à le PRÉVENIR (ses abonnements de notification).
        const portee = ev.filter((e) => e.genre === 'lecture-autrui' && (e.cible === 'A' || !/^eq\.push_(subs|prefs|journal)$|^like\.signalement_\*$/.test(e.id)));
        dit(!portee.length, `${nomAppel} : la route ne lit rien DANS le compte d'un autre`, portee.map((e) => `${e.table} owner=${e.cible} ${e.id}`).join(' ; '));
        const partage = PARTAGE.has(`${FICHIER}:${mode}`);
        if (DETAIL) console.log(`· ${nomAppel} → HTTP ${res.code}${erreur ? ' (levée : ' + erreur.message + ')' : ''} · ${ev.length} évts · ${res.morceaux.join('').slice(0, 160)}`);
        if (fuite) resume.fuites++;
        if (ev.some((e) => e.genre === 'lecture' || e.genre === 'ecriture')) resume.profonds = (resume.profonds || 0) + 1;
        dit(!fuite, `${nomAppel} : B ne reçoit rien de ${/-o\b|canari-o/i.test(fuite && fuite[0]) ? 'O' : 'A'}${partage ? ' (mode partagé par conception : seulement ce qui est public)' : ''}`, fuite ? `HTTP ${res.code} · « …${sortie.slice(Math.max(0, fuite.index - 80), fuite.index + 40).replace(/\s+/g, ' ')}… »` : '');
        if (surA.length) resume.ecritures++;
        dit(!surA.length, `${nomAppel} : rien n'est écrit ni demandé au nom de A`, surA.map((e) => `${e.genre} ${e.table || e.nom || ''} ${e.id || e.args || e.cible || ''} (${e.m || ''})`).join(' ; '));
        for (const e of ev.filter((x) => x.genre === 'rpc-sql')) sql.add(`${e.nom}(${e.args})`);
        for (const e of surO) {
          const raison = ECRIT_CHEZ_O.find(([re]) => re.test(String(e.id || '')));
          const permis = raison && (!e.existait || raison[2] === true);
          if (!permis) dit(false, `${nomAppel} : écriture chez le propriétaire O non permise`, `${e.table} ${e.id} (${e.m})${e.existait ? ' — ligne EXISTANTE réécrite' : ''}`);
          else chezO.set(String(e.id).replace(/_[^_]*$/, '_…'), raison[1]);
        }
      }
    }
   }
  }
  if (sql.size) console.log(`ℹ️  ${FICHIER} : fonctions de la base appelées avec le JETON de B et un identifiant d'autrui — le cloisonnement est dans le SQL (hors de portée de ce contrôle) : ${[...sql].join(', ')}`);
  for (const [id, raison] of chezO) console.log(`ℹ️  ${FICHIER} : écriture chez O « ${id} » permise — ${raison}`);
  console.log(`${ko ? '❌' : '✅'} ${FICHIER} : ${modes.length} mode(s) × GET/POST × ${VARIANTES.length} variantes = ${resume.appels} appels (${resume.profonds || 0} ont touché la base) · ${ok} contrôles verts · ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})();
