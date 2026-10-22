// ════════════════════════════════════════════════════════════════════════════
//  UNE ADRESSE DE RÉCEPTION PROUVÉE — les vraies routes, exécutées (§4.10).
//        node scripts/audit-preuve-adresse.cjs [--src dossier] [--mutation nom]
//
//  CLAUDE.md (6 octobre) : « une adresse déclarée n'est pas PROUVÉE — bloquant
//  avant d'ouvrir VRM à des inconnus ». Un vendeur qui déclarait l'adresse d'un
//  autre recevait ses ventes, ses bordereaux, le nom et l'adresse de ses
//  acheteurs. Ce contrôle lance `api/email-inbound.js` (l'arrivée d'un email et
//  les modes de la boîte VRM) et `api/email-rattacher.js` (demander, confirmer,
//  lister, réclamer) contre une fausse base À ÉTAT (les écritures restent, les
//  filtres `eq`/`like`/`in`/`is.null`, `data->>`, les projections `select=`,
//  `Range` et les PATCH conditionnels sont honorés — §6.3), et exige :
//    1. l'adresse d'un autre, déclarée sans preuve, ne détourne RIEN ;
//    2. le propriétaire de l'installation garde ses adresses (« à confirmer ») ;
//    3. le parcours complet : demande → la boîte VRM envoie le lien À CETTE
//       adresse → le clic DEPUIS LA SESSION du demandeur prouve → les emails
//       suivants arrivent, et l'arriéré mis de côté se réclame ;
//    4. un autre compte, un jeton forgé, un lien périmé ne prouvent rien ;
//    5. « pas su » (preuves illisibles) ⇒ 503, jamais une attribution ;
//    6. freins, relais Apple, adresse de connexion déjà confirmée ;
//    7. le lien n'est jamais rangé lisible, ni écrit par le navigateur ;
//    8. le script Gmail envoie tel quel puis le dit, et seulement s'il a envoyé.
//  `--mutation` réaffaiblit une règle dans une COPIE de `api/` : chacune doit
//  rendre ce contrôle ROUGE (sansgarde · autrecompte · jetonignore · pasSu).
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), os = require('os'), vm = require('vm');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : ''; };
let RACINE = arg('--src') ? path.resolve(arg('--src')) : path.join(__dirname, '..');
const MUTATION = arg('--mutation');

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'le contrôle a levé : ' + String((e && e.stack) || e).slice(0, 240)); } };

// ── Les mutations : une COPIE de api/, une règle réaffaiblie ────────────────
if (MUTATION) {
  const dst = fs.mkdtempSync(path.join(os.tmpdir(), 'preuve-mut-'));
  const copie = (src, d) => { fs.mkdirSync(d, { recursive: true }); for (const f of fs.readdirSync(src)) { const s = path.join(src, f), t = path.join(d, f); if (fs.statSync(s).isDirectory()) copie(s, t); else fs.copyFileSync(s, t); } };
  copie(path.join(RACINE, 'api'), path.join(dst, 'api'));
  try { fs.symlinkSync(path.join(RACINE, 'node_modules'), path.join(dst, 'node_modules')); } catch (_) {}
  fs.writeFileSync(path.join(dst, 'package.json'), fs.readFileSync(path.join(RACINE, 'package.json')));
  const remplace = (rel, de, vers) => { const p = path.join(dst, rel); const s = fs.readFileSync(p, 'utf8'); if (!s.includes(de)) { console.log('❌ mutation introuvable : ' + de.slice(0, 80)); process.exit(1); } fs.writeFileSync(p, s.replace(de, vers)); };
  if (MUTATION === 'sansgarde') remplace('api/_lib/proprietaire-email.js', "(garde && typeof garde.retenue === 'function') ? garde.retenue : () => false", '() => true');
  else if (MUTATION === 'autrecompte') remplace('api/email-rattacher.js', "if (!d || String(d.owner || '') !== u.id || idPreuve(u.id, d.adresse) !== id) { inconnu(); return; }", 'if (!d) { inconnu(); return; } u.id = String(d.owner);');
  else if (MUTATION === 'jetonignore') remplace('api/_lib/preuve-adresse.js', "if (attendu.length !== recu.length || !crypto.timingSafeEqual(attendu, recu)) return 'faux';", '');
  else if (MUTATION === 'pasSu') remplace('api/email-inbound.js', 'if(preuves===null)return null;', 'if(preuves===null)return fusionnerRegistresLib([],true,{retenue:()=>false});');
  else { console.log('❌ mutation inconnue : ' + MUTATION); process.exit(1); }
  RACINE = dst;
  console.log('── mutation « ' + MUTATION + ' » (copie : ' + dst + ')');
}

const J = '11111111-1111-1111-1111-111111111111';   // propriétaire de l'installation
const B = '22222222-2222-2222-2222-222222222222';   // un vendeur
const C = '33333333-3333-3333-3333-333333333333';   // un autre vendeur
const NEUTRE = '00000000-0000-0000-0000-000000000000';
process.env.VRM_OWNER_UID = J;
process.env.EMAIL_INBOUND_SECRET = 'cle-banc-preuve';
process.env.SUPABASE_SERVICE_KEY = 'service-banc-preuve';

// ── Les utilisateurs (GoTrue) ───────────────────────────────────────────────
const UTIL = {
  'jeton-de-J': { id: J, email: 'julien@vrm.test', email_confirmed_at: '2026-07-01T10:00:00Z' },
  'jeton-de-B': { id: B, email: 'compte-b@vrm.test', confirmation_sent_at: '2026-10-01T10:00:00Z', email_confirmed_at: '2026-10-01T10:05:00Z' },
  'jeton-de-C': { id: C, email: 'compte-c@vrm.test', email_confirmed_at: '2026-10-01T10:00:00Z' },   // confirmé SANS lien (automatique)
};

// ── La fausse base, à état ──────────────────────────────────────────────────
let base = [];                // { owner, id, data }
let pannes = {};              // { preuves, registre, ecriture }
const journal = [];           // { m, owner, id, data, url }
const rep = (corps, status = 200) => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': status >= 500 ? 'text/html' : 'application/json' } });
const champ = (r, chemin) => {
  if (chemin === 'id' || chemin === 'owner') return r[chemin];
  if (chemin === 'data') return r.data;
  const m = /^(data|meta)(->>|->)(.+)$/.exec(chemin); if (!m) return undefined;
  let v = r.data; for (const seg of m[3].split(/->>|->/)) v = v == null ? undefined : v[seg];
  if (m[1] === 'meta' && v != null && typeof v === 'object') return undefined;
  return m[2] === '->>' && v != null && typeof v === 'object' ? JSON.stringify(v) : v;
};
// `or=(col.ilike."motif",…)` de PostgREST (la liste des emails à réclamer).
const parseOu = (v) => {
  if (!/^\(.*\)$/.test(v)) return null;
  const s = v.slice(1, -1), termes = []; let i = 0;
  while (i < s.length) {
    const m = /^([a-z_]+(?:->>?[a-zA-Z_]+)?)\.(ilike)\./.exec(s.slice(i)); if (!m) return null;
    i += m[0].length; let val = '';
    if (s[i] === '"') { i++; while (i < s.length && s[i] !== '"') { if (s[i] === '\\') i++; val += s[i]; i++; } i++; } else { while (i < s.length && s[i] !== ',') val += s[i++]; }
    termes.push({ col: m[1], val }); if (s[i] === ',') i++; else if (i < s.length) return null;
  }
  return termes;
};
const motifRe = (m) => new RegExp('^' + m.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[*%]/g, '.*').replace(/_/g, '.') + '$', 'is');
const filtrer = (params) => {
  let rows = base.slice();
  for (const [k, v] of params) {
    if (['select', 'order', 'limit', 'on_conflict'].includes(k)) continue;
    if (k === 'id' && v.startsWith('eq.')) rows = rows.filter((r) => r.id === v.slice(3));
    else if (k === 'id' && v.startsWith('like.')) { const re = new RegExp('^' + v.slice(5).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[*%]/g, '.*') + '$'); rows = rows.filter((r) => re.test(r.id)); }
    else if (k === 'id' && v.startsWith('in.(')) { const l = v.slice(4, -1).split(','); rows = rows.filter((r) => l.includes(r.id)); }
    else if (k === 'owner' && v.startsWith('eq.')) rows = rows.filter((r) => r.owner === v.slice(3));
    else if (/^(data|meta)->>/.test(k) && v === 'is.null') rows = rows.filter((r) => champ(r, k) == null);
    else if (/^(data|meta)->>/.test(k) && v.startsWith('eq.')) rows = rows.filter((r) => champ(r, k) != null && String(champ(r, k)) === v.slice(3));
    else if (k === 'or') { const t = parseOu(v); if (!t) return null; rows = rows.filter((r) => t.some((x) => { const w = champ(r, x.col); return w != null && motifRe(x.val).test(String(w)); })); }
    else return null;   // un filtre que le banc ne comprend pas ne passe JAMAIS pour vrai
  }
  return rows;
};
const fetchBanc = async (url, opts = {}) => {
  const u = decodeURIComponent(String(url));
  const m = (opts.method || 'GET').toUpperCase();
  const auth = String((opts.headers && (opts.headers.Authorization || opts.headers.authorization)) || '').replace(/^Bearer\s+/i, '');
  if (u.includes('/auth/v1/user')) return UTIL[auth] ? rep(UTIL[auth]) : rep({ msg: 'invalid' }, 401);
  if (!u.includes('/rest/v1/app_data')) return m === 'GET' ? rep([]) : rep('', 201);
  const q = u.split('?')[1] || '';
  const params = q.split('&').filter(Boolean).map((x) => { const i = x.indexOf('='); return [x.slice(0, i), x.slice(i + 1)]; });
  const get = (k) => (params.find((p) => p[0] === k) || [])[1];
  if (m === 'POST') {
    if (pannes.ecriture) return rep('<html>503</html>', 503);
    let arr = []; try { arr = JSON.parse(opts.body || '[]'); } catch (_) {}
    for (const x of (Array.isArray(arr) ? arr : [arr])) {
      journal.push({ m, owner: x.owner || '', id: x.id, data: x.data, url: u });
      const i = base.findIndex((r) => r.id === x.id && r.owner === (x.owner || ''));
      const ligne = { owner: x.owner || '', id: x.id, data: x.data };
      if (i >= 0) base[i] = ligne; else base.push(ligne);
    }
    return rep('', 201);
  }
  if (/^select=owner&limit=1$/.test(q)) return rep([{ owner: J }]);
  if (pannes.preuves && m === 'GET' && u.includes('vrm_email_preuve_')) return rep('<html>522</html>', 522);
  if (pannes.registre && m === 'GET' && get('id') === 'eq.vrm_email_owners') return rep('<html>522</html>', 522);
  const rows = filtrer(params);
  if (rows === null) return rep({ message: 'filtre inconnu du banc : ' + q }, 400);
  if (m === 'PATCH') {
    let corps = {}; try { corps = JSON.parse(opts.body || '{}'); } catch (_) {}
    for (const r of rows) { Object.assign(r, corps); journal.push({ m, owner: r.owner, id: r.id, data: r.data, url: u }); }
    return rep(rows.map((r) => ({ id: r.id, owner: r.owner, data: r.data })));
  }
  if (m === 'DELETE') { const s = new Set(rows); base = base.filter((r) => !s.has(r)); return rep('', 204); }
  let out = rows;
  if (get('order')) out = out.slice().sort((a, b) => (String(a.id) < String(b.id) ? -1 : 1));
  const mr = /^(\d+)-(\d+)$/.exec(String((opts.headers && (opts.headers.Range || opts.headers.range)) || ''));
  if (mr) out = out.slice(+mr[1], +mr[2] + 1);
  if (get('limit')) out = out.slice(0, +get('limit'));
  const sel = get('select');
  const proj = (r) => {
    if (!sel) return { id: r.id, owner: r.owner, data: r.data };
    const o = {};
    for (const item of sel.split(',')) { const i = item.indexOf(':'); const [alias, ch] = i > 0 ? [item.slice(0, i), item.slice(i + 1)] : [item.replace(/^.*(->>|->)/, ''), item]; const v = champ(r, ch); o[alias] = v === undefined ? null : v; }
    return o;
  };
  return rep(out.map(proj));
};
global.fetch = fetchBanc;

const registre = (owner, adresses) => ({ owner, id: 'vrm_email_owners', data: { adresses: Object.fromEntries(adresses.map((a) => [a, { owner, label: '', at: '2026-10-20T10:00:00Z' }])), updatedAt: '2026-10-20T10:00:00Z' } });
const faireRes = () => { const x = { code: null, corps: null }; x.status = (n) => { x.code = n; return x; }; x.json = (o) => { x.corps = o; return x; }; x.setHeader = () => {}; x.end = () => x; return x; };
let n = 0;
const vente = (to) => { n++; return { method: 'POST', query: {}, headers: { 'x-vrm-email-key': 'cle-banc-preuve' }, body: {
  messageId: `<banc-preuve-${n}>`, from: 'no-reply@vinted.fr', to, subject: 'Ton article est vendu !',
  text: `acheteur-de-banc a acheté [Paire de banc ${n}] n°${9000 + n} 42,00 €\nPrépare ton colis.`, html: '<p>vendu</p>', attachments: [] } }; };

(async () => {
  let inbound, ratt, lib;
  await essaie('chargement', async () => {
    inbound = await import('file://' + path.join(RACINE, 'api', 'email-inbound.js'));
    ratt = await import('file://' + path.join(RACINE, 'api', 'email-rattacher.js'));
    lib = await import('file://' + path.join(RACINE, 'api', '_lib', 'preuve-adresse.js')).catch(() => null);
  });
  if (!inbound || !ratt) { console.log('\n❌ audit-preuve-adresse : les routes ne se chargent pas'); process.exit(1); }
  const recevoir = async (to) => { journal.length = 0; const r = faireRes(); await inbound.default(vente(to), r); return { code: r.code, corps: r.corps, ecrites: journal.filter((x) => x.m === 'POST') }; };
  const chez = (o, owner) => o.ecrites.filter((x) => x.owner === owner && !/^email_quarantaine_/.test(x.id));
  const misDeCote = (o) => o.ecrites.filter((x) => x.owner === NEUTRE && /^email_quarantaine_/.test(x.id));
  const appeler = async (jeton, mode, methode, corps) => { const r = faireRes(); await ratt.default({ method: methode, query: { mode }, headers: jeton ? { authorization: 'Bearer ' + jeton } : {}, body: corps }, r); return { code: r.code, corps: r.corps || {} }; };
  const script = async (mode, methode, corps) => { const r = faireRes(); await inbound.default({ method: methode, query: { mode }, headers: { 'x-vrm-email-key': 'cle-banc-preuve' }, body: corps }, r); return { code: r.code, corps: r.corps || {} }; };
  const preuveDe = (owner, a) => base.find((r) => r.owner === NEUTRE && r.data && r.data.owner === owner && r.data.adresse === a && /^vrm_email_preuve_/.test(r.id));

  // ── 1. L'adresse d'un autre, déclarée SANS preuve ─────────────────────────
  await essaie('1', async () => {
    base = [registre(J, ['julien@boutique.test']), registre(B, ['victime@ailleurs.test'])]; pannes = {};
    const o = await recevoir('victime@ailleurs.test');
    dit(chez(o, B).length === 0, "l'adresse d'un autre, déclarée sans preuve, ne lui donne RIEN (ni vente, ni suivi)", chez(o, B).map((x) => x.id).join(', '));
    dit(o.code === 200 && misDeCote(o).length === 1, "l'email est mis de côté, entier, sous le propriétaire neutre — jamais perdu", `HTTP ${o.code} · ${misDeCote(o).length}`);
    const l = await appeler('jeton-de-B', 'liste', 'GET');
    dit(l.code === 200 && !(l.corps.emails || []).length, 'et il ne peut pas le réclamer non plus', JSON.stringify((l.corps.emails || []).map((x) => x.id)));
    // L'adresse du propriétaire, déclarée AUSSI (sans preuve) par B : à Julien, sans conflit.
    base = [registre(J, ['julien@boutique.test']), registre(B, ['julien@boutique.test'])];
    const p = await recevoir('julien@boutique.test');
    dit(chez(p, B).length === 0 && chez(p, J).length > 0, "l'adresse de Julien, déclarée aussi par B sans preuve, reste à Julien (une déclaration non prouvée ne bloque pas son propriétaire)", `B:${chez(p, B).length} J:${chez(p, J).length} mis de côté:${misDeCote(p).length}`);
  });

  // ── 2. La transition : Julien garde ses adresses ──────────────────────────
  await essaie('2', async () => {
    base = [registre(J, ['julien@boutique.test', 'relais@privaterelay.appleid.com'])]; pannes = {};
    const o = await recevoir('julien@boutique.test');
    const r2 = await recevoir('relais@privaterelay.appleid.com');
    dit(chez(o, J).length > 0 && chez(r2, J).length > 0 && !misDeCote(o).length && !misDeCote(r2).length, "le propriétaire de l'installation garde ses adresses déclarées — même un relais Apple qu'aucun lien ne peut prouver", `J:${chez(o, J).length}/${chez(r2, J).length}`);
    const e = await appeler('jeton-de-J', 'preuves', 'GET');
    const a = (e.corps.adresses || {});
    dit(e.code === 200 && a['julien@boutique.test'] && a['julien@boutique.test'].etat === 'transition' && a['relais@privaterelay.appleid.com'].etat === 'transition', 'et l’écran les dit « à confirmer » (transition), sans les couper', JSON.stringify(a));
  });

  // ── 3. Le parcours complet ────────────────────────────────────────────────
  let lienB = '';
  await essaie('3', async () => {
    base = [registre(J, ['julien@boutique.test']), registre(B, ['b@vendeur-b.test'])]; pannes = {};
    // Arrivé AVANT la preuve : mis de côté.
    const avant = await recevoir('b@vendeur-b.test');
    dit(chez(avant, B).length === 0 && misDeCote(avant).length === 1, 'avant la preuve : mis de côté, pas attribué', `B:${chez(avant, B).length}`);
    const sansSession = await appeler('', 'preuve-demander', 'POST', { adresse: 'b@vendeur-b.test' });
    dit(sansSession.code === 401 && !base.some((r) => /^vrm_email_preuve_/.test(r.id)), 'sans session, aucune demande', `HTTP ${sansSession.code}`);
    const pasDeclaree = await appeler('jeton-de-B', 'preuve-demander', 'POST', { adresse: 'autre@vendeur-b.test' });
    dit(pasDeclaree.code === 409, 'une adresse pas déclarée ne se fait pas confirmer', `HTTP ${pasDeclaree.code}`);
    const d = await appeler('jeton-de-B', 'preuve-demander', 'POST', { adresse: 'b@vendeur-b.test' });
    const ligne = preuveDe(B, 'b@vendeur-b.test');
    dit(d.code === 200 && d.corps.etat === 'envoi' && ligne && ligne.data.etat === 'attente', 'la demande est rangée (en attente d’envoi)', `HTTP ${d.code} ${JSON.stringify(d.corps)}`);
    dit(!!ligne && ligne.owner === NEUTRE && !JSON.stringify(ligne.data).includes('confirmer-adresse'), 'sous le propriétaire NEUTRE (aucune session ne l’écrit), sans le lien en clair', ligne ? ligne.owner : 'absente');
    const e1 = await appeler('jeton-de-B', 'preuves', 'GET');
    dit(e1.code === 200 && (e1.corps.adresses || {})['b@vendeur-b.test'] && e1.corps.adresses['b@vendeur-b.test'].etat === 'envoi', 'l’écran dit « lien en préparation »', JSON.stringify(e1.corps.adresses));
    const trop = await appeler('jeton-de-B', 'preuve-demander', 'POST', { adresse: 'b@vendeur-b.test' });
    dit(trop.code === 429, 'un renvoi tout de suite est freiné (10 minutes)', `HTTP ${trop.code}`);
    // La boîte VRM prend le lien et l'envoie À CETTE ADRESSE.
    const s1 = await script('preuves-a-envoyer', 'GET');
    const env = (s1.corps.envois || [])[0];
    dit(s1.code === 200 && env && env.adresse === 'b@vendeur-b.test' && /confirmer-adresse=[0-9a-f]{40}\.[A-Za-z0-9_-]{43}/.test(env.texte + env.html), 'la boîte VRM reçoit le message à envoyer À CETTE adresse, avec le lien', JSON.stringify(s1.corps).slice(0, 160));
    lienB = env ? (/confirmer-adresse=([0-9a-f]{40}\.[A-Za-z0-9_-]{43})/.exec(env.texte) || [])[1] || '' : '';
    const pasDeCle = await (async () => { const r = faireRes(); await inbound.default({ method: 'GET', query: { mode: 'preuves-a-envoyer' }, headers: { 'x-vrm-email-key': 'mauvaise' } }, r); return r.code; })();
    dit(pasDeCle === 401, 'sans la clé du script, rien n’est rendu', `HTTP ${pasDeCle}`);
    const s2 = await script('preuve-envoyee', 'POST', { id: env && env.id });
    dit(s2.code === 200 && preuveDe(B, 'b@vendeur-b.test').data.envoyeLe, 'le script dit qu’il l’a envoyé', JSON.stringify(s2.corps));
    const s3 = await script('preuves-a-envoyer', 'GET');
    dit(s3.code === 200 && !(s3.corps.envois || []).length, 'et il ne repart pas une seconde fois', JSON.stringify(s3.corps.envois));
    const e2 = await appeler('jeton-de-B', 'preuves', 'GET');
    dit((e2.corps.adresses || {})['b@vendeur-b.test'].etat === 'envoyee', 'l’écran dit « lien envoyé »', JSON.stringify(e2.corps.adresses));
    // Un AUTRE compte qui ouvre le lien : rien.
    const parC = await appeler('jeton-de-C', 'preuve-confirmer', 'POST', { lien: lienB });
    dit(parC.code === 404 && preuveDe(B, 'b@vendeur-b.test').data.etat === 'attente', 'le lien ouvert depuis un AUTRE compte VRM ne prouve rien (et ne dit pas pour qui il est)', `HTTP ${parC.code}`);
    // Un jeton forgé : rien.
    const forge = lienB.slice(0, -1) + (lienB.slice(-1) === 'A' ? 'B' : 'A');
    const f = await appeler('jeton-de-B', 'preuve-confirmer', 'POST', { lien: forge });
    dit(f.code === 404 && preuveDe(B, 'b@vendeur-b.test').data.etat === 'attente', 'un jeton forgé ne prouve rien', `HTTP ${f.code}`);
    // Le vrai clic, depuis SA session.
    const c = await appeler('jeton-de-B', 'preuve-confirmer', 'POST', { lien: lienB });
    dit(c.code === 200 && c.corps.etat === 'prouvee' && preuveDe(B, 'b@vendeur-b.test').data.etat === 'prouvee', 'le clic depuis SA session prouve l’adresse', `HTTP ${c.code} ${JSON.stringify(c.corps)}`);
    const c2 = await appeler('jeton-de-B', 'preuve-confirmer', 'POST', { lien: lienB });
    dit(c2.code === 200 && c2.corps.deja, 'un second clic le redit (déjà confirmée), sans rien casser', `HTTP ${c2.code}`);
    const apres = await recevoir('b@vendeur-b.test');
    dit(chez(apres, B).length > 0 && !misDeCote(apres).length, 'APRÈS la preuve : ses emails lui arrivent', `B:${chez(apres, B).length}`);
    const l = await appeler('jeton-de-B', 'liste', 'GET');
    const id = (misDeCote(avant)[0] || {}).id;
    dit(l.code === 200 && (l.corps.emails || []).some((x) => x.id === id), 'et l’email arrivé AVANT la preuve lui est proposé (l’arriéré se réclame)', JSON.stringify((l.corps.emails || []).map((x) => x.id)));
    const e3 = await appeler('jeton-de-B', 'preuves', 'GET');
    dit((e3.corps.adresses || {})['b@vendeur-b.test'].etat === 'prouvee', 'l’écran dit « confirmée »', JSON.stringify(e3.corps.adresses));
    // Le lien ne s'écrit jamais lisible : une confirmation transférée vers la boîte collective.
    journal.length = 0;
    const fw = vente('b@vendeur-b.test'); fw.body.subject = 'Fwd: VRM — confirme ton adresse'; fw.body.text = `Lien : https://vrm.center/?confirmer-adresse=${lienB}`;
    const rr = faireRes(); await inbound.default(fw, rr);
    dit(!JSON.stringify(journal).includes(lienB.split('.')[1]), 'un lien de confirmation transféré vers VRM n’est jamais rangé lisible', '');
  });

  // ── 4. Périmé, et deux vendeurs qui prouvent la même adresse ─────────────
  await essaie('4', async () => {
    base = [registre(J, ['julien@boutique.test']), registre(C, ['c@vendeur-c.test'])]; pannes = {};
    const d = await appeler('jeton-de-C', 'preuve-demander', 'POST', { adresse: 'c@vendeur-c.test' });
    dit(d.code === 200 && d.corps.etat === 'envoi', 'C (adresse de connexion confirmée AUTOMATIQUEMENT, sans lien) doit passer par le lien', `HTTP ${d.code} ${JSON.stringify(d.corps)}`);
    const env = ((await script('preuves-a-envoyer', 'GET')).corps.envois || []).find((x) => x.adresse === 'c@vendeur-c.test');
    const lien = env ? (/confirmer-adresse=([0-9a-f]{40}\.[A-Za-z0-9_-]{43})/.exec(env.texte) || [])[1] : '';
    // 73 heures plus tard (le lien vaut 72 h) : l'horloge avance, la ligne ne bouge pas.
    const vrai = Date.now; Date.now = () => vrai() + 73 * 3600e3;
    let p; try { p = await appeler('jeton-de-C', 'preuve-confirmer', 'POST', { lien }); } finally { Date.now = vrai; }
    dit(p.code === 410 && preuveDe(C, 'c@vendeur-c.test').data.etat === 'attente', 'un lien périmé ne prouve rien, et le dit', `HTTP ${p.code}`);
    // Deux vendeurs ont prouvé la même adresse (une boîte partagée) : personne.
    base = [registre(B, ['partagee@boite.test']), registre(C, ['partagee@boite.test'])];
    for (const o of [B, C]) base.push({ owner: NEUTRE, id: lib.idPreuve(o, 'partagee@boite.test'), data: { owner: o, adresse: 'partagee@boite.test', etat: 'prouvee', via: 'lien' } });
    const r = await recevoir('partagee@boite.test');
    dit(!chez(r, B).length && !chez(r, C).length && misDeCote(r).length === 1, 'une adresse prouvée par DEUX vendeurs ne désigne personne : mise de côté', `B:${chez(r, B).length} C:${chez(r, C).length}`);
  });

  // ── 5. « Pas su » ─────────────────────────────────────────────────────────
  await essaie('5', async () => {
    base = [registre(J, ['julien@boutique.test']), registre(B, ['b@vendeur-b.test'])]; pannes = { preuves: true };
    base.push({ owner: NEUTRE, id: lib.idPreuve(B, 'b@vendeur-b.test'), data: { owner: B, adresse: 'b@vendeur-b.test', etat: 'prouvee', via: 'lien' } });
    const o = await recevoir('b@vendeur-b.test');
    dit(o.code === 503 && !chez(o, B).length && !misDeCote(o).length, 'preuves illisibles : 503 (le collecteur le renverra) — ni attribué, ni mis de côté sur une lecture ratée', `HTTP ${o.code} · B:${chez(o, B).length} · mis de côté:${misDeCote(o).length}`);
    const j = await recevoir('julien@boutique.test');
    dit(j.code === 503, 'même pour Julien : on ne décide rien sur une lecture partielle', `HTTP ${j.code}`);
    const e = await appeler('jeton-de-B', 'preuves', 'GET');
    dit(e.code === 503, 'l’écran ne reçoit aucun état deviné', `HTTP ${e.code}`);
  });

  // ── 6. Relais Apple, adresse de connexion confirmée par un lien ──────────
  await essaie('6', async () => {
    base = [registre(B, ['x@privaterelay.appleid.com', 'compte-b@vrm.test'])]; pannes = {};
    const a = await appeler('jeton-de-B', 'preuve-demander', 'POST', { adresse: 'x@privaterelay.appleid.com' });
    dit(a.code === 422 && a.corps.etat === 'impossible' && !preuveDe(B, 'x@privaterelay.appleid.com'), 'relais Apple : impossible, et c’est dit — aucune demande rangée', `HTTP ${a.code}`);
    const c = await appeler('jeton-de-B', 'preuve-demander', 'POST', { adresse: 'compte-b@vrm.test' });
    const p = preuveDe(B, 'compte-b@vrm.test');
    dit(c.code === 200 && c.corps.etat === 'prouvee' && p && p.data.via === 'compte', 'son adresse de connexion VRM, confirmée par un lien : prouvée sans email', `HTTP ${c.code} ${JSON.stringify(c.corps)}`);
    const s = await script('preuves-a-envoyer', 'GET');
    dit(!(s.corps.envois || []).some((x) => x.adresse === 'compte-b@vrm.test'), 'et aucun email ne part pour elle', '');
    const e = await appeler('jeton-de-B', 'preuves', 'GET');
    dit((e.corps.adresses || {})['x@privaterelay.appleid.com'].etat === 'impossible', 'l’écran dit « impossible » pour le relais Apple', JSON.stringify(e.corps.adresses));
  });

  // ── 7. Rien n'écrit une preuve hors du propriétaire neutre ───────────────
  await essaie('7', async () => {
    const hors = base.filter((r) => /^vrm_email_preuve_/.test(r.id) && r.owner !== NEUTRE);
    dit(hors.length === 0, 'toutes les preuves vivent sous le propriétaire neutre (RLS : aucune session ne peut les écrire)', hors.map((r) => r.owner).join(','));
  });

  // ── 8. Le script Gmail : il envoie tel quel, puis le dit ─────────────────
  await essaie('8', async () => {
    const source = fs.readFileSync(path.join(RACINE, 'scripts', 'gmail-forwarder.gs'), 'utf8');
    const lance = (envoiOk) => {
      const appels = [], envoyes = [];
      const s = { Logger: { log() {} }, JSON, PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k === 'EMAIL_INBOUND_SECRET' ? 'cle' : null) }) },
        UrlFetchApp: { fetch: (url, opt = {}) => { const mode = new URL(url).searchParams.get('mode'); appels.push({ mode, corps: opt.payload ? JSON.parse(opt.payload) : null }); const corps = mode === 'preuves-a-envoyer' ? { ok: true, envois: [{ id: 'vrm_email_preuve_' + 'a'.repeat(40), adresse: 'b@vendeur-b.test', sujet: 'S', texte: 'T', html: '<p>H</p>' }] } : { ok: true }; return { getResponseCode: () => 200, getContentText: () => JSON.stringify(corps) }; } },
        GmailApp: { sendEmail: (a, sujet, texte, o) => { if (!envoiOk) throw new Error('quota'); envoyes.push({ a, sujet, texte, html: o && o.htmlBody }); } } };
      vm.createContext(s); vm.runInContext(source, s); vm.runInContext('envoyerPreuvesAdresse();', s);
      return { appels, envoyes };
    };
    const ok1 = lance(true);
    dit(ok1.envoyes.length === 1 && ok1.envoyes[0].a === 'b@vendeur-b.test' && ok1.envoyes[0].sujet === 'S' && ok1.envoyes[0].html === '<p>H</p>', 'le script envoie le message du serveur TEL QUEL, à l’adresse demandée', JSON.stringify(ok1.envoyes));
    dit(ok1.appels.some((x) => x.mode === 'preuve-envoyee' && x.corps && /^vrm_email_preuve_/.test(x.corps.id)), 'puis le dit à VRM', JSON.stringify(ok1.appels));
    const ko1 = lance(false);
    dit(!ko1.appels.some((x) => x.mode === 'preuve-envoyee'), 'un envoi raté n’est PAS marqué envoyé (il repartira)', JSON.stringify(ko1.appels));
  });

  console.log(ko ? `\n❌ audit-preuve-adresse : ${ko} rouge(s) sur ${ok + ko}` : `\n✅ audit-preuve-adresse : ${ok} contrôles verts`);
  process.exit(ko ? 1 : 0);
})();
