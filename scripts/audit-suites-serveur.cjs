require(require('path').join(__dirname, '_horloge-notif.cjs'));   // heures calmes : midi (Paris) pour ce banc
// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : L'OFFRE SOLO APPLIQUÉE AUSSI PAR CE QUE CALCULE LE SERVEUR (9 nov.)
//         node scripts/audit-suites-serveur.cjs [--mutation=<nom>] [--prouve]
// ═══════════════════════════════════════════════════════════════════════════
// Julien (9 nov.) : Solo = UN compte vendeur Vinted ; les ventes des autres comptes
// (comptes d'achat) en aperçu, HORS des totaux. L'app l'appliquait ; le serveur
// (bilan de la semaine, bilan du mois, widget, rappel des offres au prix mini)
// comptait encore tous les comptes.
//
// §4.10 : on EXÉCUTE les vraies routes (api/ship-reminders.js, api/widget.js) contre
// une fausse base À LA VRAIE FORME — `abonnements` (colonnes `statut`, `plan`,
// `compte_vendeur` de la migration 028, rangées par le webhook), `select=` projetés,
// `owner=eq.`, `vrm_acces_pour` — à cinq vendeurs (UUID) :
//   S  Solo, compte vendeur 11 (achat : 12)      ⇒ seules les ventes du 11 comptent
//   P  Pro                                        ⇒ tout compte
//   X  `abonnements` illisible (028 pas passée)   ⇒ « pas su » : rien n'est bridé
//   C  Solo RÉSILIÉ (statut `canceled`)           ⇒ rien n'est bridé
//   O  propriétaire de l'installation, ligne Solo ⇒ Pro, toujours (comme l'app)
// Chacun a deux comptes Vinted (11 : 40 €, 12 : 500 €, vendues et versées dans la
// semaine passée), deux ventes reçues par e-mail ce mois-ci (repli du widget), et
// une offre au-dessus du prix mini sur une annonce de CHAQUE compte.
// La règle attendue n'est pas écrite ici : elle est celle de l'APP
// (`compteEcarteRegle`, extraite d'App.jsx et exécutée avec api/_lib/plan-regle.js).
//
// --mutation=… réaffaiblit une copie temporaire d'`api/` (et `src/`) : le contrôle
// DOIT sortir rouge. --prouve les joue toutes et exige que chacune soit rouge.
// Aucune donnée réelle : tout est inventé ici, rien ne quitte la machine.
const path = require('path'), fs = require('fs'), os = require('os'), vm = require('vm'), cp = require('child_process');
let RACINE = path.join(__dirname, '..');
const MUTS = {
  bilan: ['api/_lib/bilan-semaine.js', /e\.panneau, e\.regle\)/g, 'e.panneau)'],
  regle: ['api/_lib/ventes-regle.js', ' || venteHorsPlan(regle, uid);', ';'],
  lecture: ['api/ship-reminders.js', '    regle: regle || null,\n', ''],
  proprio: ['api/_lib/plan-vendeur.js', 'if (proprio && proprio === String(owner).toLowerCase()) {', 'if (false) {'],
  statut: ['api/_lib/plan-vendeur.js', 'v = l && VIVANTS.has(String(l.statut || \'\')) ?', 'v = l ?'],
  widget: ['api/widget.js', '      if (venteHorsPlan(regle, s.uid)) continue;\n', ''],
  offres: ['api/ship-reminders.js', '    if (cpt && venteHorsPlan(regle, cpt[1])) continue;\n', ''],
};
const ARG = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
if (process.argv.includes('--prouve')) {
  let tous = true;
  for (const m of Object.keys(MUTS)) {
    const r = cp.spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8' });
    const rouge = r.status !== 0 && /❌/.test(r.stdout || '') && !/motif introuvable|mutation inconnue/.test(r.stdout || '');
    if (!rouge) tous = false;
    console.log(`${rouge ? '✅' : '❌'} mutation « ${m} » ⇒ ${rouge ? 'rouge' : 'VERTE (le contrôle ne la voit pas)'} — ${((r.stdout || '').match(/❌[^\n]*/g) || []).length} échec(s)`);
  }
  process.exit(tous ? 0 : 1);
}
if (ARG) {
  const m = MUTS[ARG];
  if (!m) { console.log('mutation inconnue : ' + ARG); process.exit(2); }
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-suites-'));
  for (const d of ['api', 'src', 'public']) if (fs.existsSync(path.join(RACINE, d))) fs.cpSync(path.join(RACINE, d), path.join(dest, d), { recursive: true });
  fs.copyFileSync(path.join(RACINE, 'package.json'), path.join(dest, 'package.json'));
  fs.symlinkSync(path.join(RACINE, 'node_modules'), path.join(dest, 'node_modules'));
  const f = path.join(dest, m[0]);
  const src = fs.readFileSync(f, 'utf8');
  if (!(typeof m[1] === 'string' ? src.includes(m[1]) : m[1].test(src))) { console.log('mutation « ' + ARG + ' » : motif introuvable'); process.exit(2); }
  fs.writeFileSync(f, typeof m[1] === 'string' ? src.split(m[1]).join(m[2]) : src.replace(m[1], m[2]));
  RACINE = dest;
  console.log('⚠️  MUTATION « ' + ARG + ' » — ce contrôle DOIT sortir rouge.');
}

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${d ? ' — ' + d : ''}`); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m, String((e && e.stack) || e).split('\n').slice(0, 2).join(' ')); } };

// ── Faux Web Push : on capture ce qui partirait, rien ne part ───────────────
const S = '5a000000-0000-4000-8000-000000000001', P = '5a000000-0000-4000-8000-000000000002', X = '5a000000-0000-4000-8000-000000000003';
const C = '5a000000-0000-4000-8000-000000000004', O = '5a000000-0000-4000-8000-000000000005';
process.env.VRM_OWNER_UID = O;
process.env.VAPID_PRIVATE_KEY = 'YmFuYy1jbGUtcHJpdmVlLWZhY3RpY2UtMzItb2N0ZXQ';
process.env.SUPABASE_SERVICE_KEY = 'banc-cle-service';
process.env.CRON_SECRET = 'cle-banc-cron';
const webpush = require(path.join(RACINE, 'node_modules', 'web-push'));
const pushes = [];
webpush.setVapidDetails = () => {};
webpush.sendNotification = async (sub, body) => { pushes.push({ endpoint: sub.endpoint, ...JSON.parse(body) }); return { statusCode: 201 }; };

// ── Le temps : lundi 5 octobre 2026, 10 h 10 à Paris ────────────────────────
const LUNDI = Date.parse('2026-10-05T08:10:00Z');
const DANS = Date.parse('2026-09-30T14:00:00Z');                 // mercredi de la semaine passée
const VERSE = new Date(DANS + 86400000).toISOString();
const CAPTE = new Date(LUNDI - 3600000).toISOString();
const vraiNow = Date.now;

// ── La fausse base (cloisonnée par owner), à la forme de PostgREST ───────────
const VENDEURS = { S: S, P: P, X: X, C: C, O: O };
const ABOS = {
  [S]: { statut: 'active', plan: 'solo', compte_vendeur: '11' },
  [P]: { statut: 'active', plan: 'pro', compte_vendeur: null },
  [C]: { statut: 'canceled', plan: 'solo', compte_vendeur: '11' },
  [O]: { statut: 'active', plan: 'solo', compte_vendeur: '11' },
};   // X : la lecture d'`abonnements` répond 400 (colonne `plan` inconnue : 028 pas passée)
const lettre = (own) => Object.keys(VENDEURS).find((k) => VENDEURS[k] === own) || '?';
let memos, lus;
const vendeur = (own) => {
  const L = lettre(own);
  const ordre = (tx, eur) => ({ transaction_id: tx, title: 'Paire ' + tx, status: 'Commande finalisée', date: new Date(DANS).toISOString(), price: { amount: String(eur), currency_code: 'EUR' } });
  const conv = (uid, item, conv) => ({ id: `harvest_${uid}_conv_${conv}`, data: { payload: { conversation: { opposite_user: { id: 777 }, transaction: { item_id: item },
    messages: [{ entity_type: 'offer_request_message', entity: { user_id: 777, status: 10, current: true, price: { amount: '90' }, offer_request_id: `${L}${conv}` } }] } } } });
  return [
    { id: 'main', data: { vinted_accounts_hidden: [], vinted_ship_done: {}, vinted_bords_shipped: {}, vrm_widget_token: 'jeton-' + L,
      vinted_annonce_numeros: { 9011: { numero: '1', min: '80' }, 9012: { numero: '2', min: '80' } } } },
    { id: 'harvest_11_orders_sold', data: { capturedAt: CAPTE, payload: { my_orders: [ordre(1101, 40)] }, resume: { txns: [] } } },
    { id: 'harvest_12_orders_sold', data: { capturedAt: CAPTE, payload: { my_orders: [ordre(1201, 500)] }, resume: { txns: [] } } },
    { id: 'harvest_11_txn_1101', meta: { id: '1101', status: '450', status_updated_at: VERSE }, data: {} },
    { id: 'harvest_12_txn_1201', meta: { id: '1201', status: '450', status_updated_at: VERSE }, data: {} },
    { id: 'lbc_ventes', data: { ventes: {} } },
    { id: 'push_subs', data: { subs: [{ endpoint: 'https://fcm.googleapis.com/' + L + '1', keys: {} }] } },
    // Les ventes apprises par e-mail ce mois-ci (le repli du widget) : le compte est celui de
    // l'adresse de réception (`uid`, rangé par api/email-inbound.js).
    { id: 'email_sale_a' + L, data: { type: 'vente', prix: '40,00', uid: '11', account: 'vendeur', receivedAt: '2026-10-02T09:00:00.000Z' } },
    { id: 'email_sale_b' + L, data: { type: 'vente', prix: '500,00', uid: '12', account: 'achats', receivedAt: '2026-10-03T09:00:00.000Z' } },
    conv('11', 9011, 1), conv('12', 9012, 2),
    ...Object.entries(memos[own] || {}).map(([id, data]) => ({ id, data })),
  ];
};
const rep = (o, status = 200) => new Response(typeof o === 'string' ? o : JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
const chemin = (obj, p) => p.reduce((o, k) => (o == null ? undefined : o[k]), obj);
function projette(ligne, select) {
  if (!select || select === '*') return ligne;
  const out = {};
  for (const item of select.split(',')) {
    const [alias, expr] = item.includes(':') ? item.split(/:(.+)/) : [item, item];
    const morceaux = expr.split(/->>?/);
    const base = morceaux.shift();
    let v = base === 'meta' ? ligne.meta : base === 'data' ? ligne.data : ligne[base];
    if (morceaux.length) v = chemin(v, morceaux);
    if (/->>/.test(expr) && v != null) v = typeof v === 'object' ? JSON.stringify(v) : String(v);
    out[alias] = v === undefined ? null : v;
  }
  return out;
}
const filtreId = (id, q) => {
  const eq = /(?:^|&)id=eq\.([^&]+)/.exec(q), like = /(?:^|&)id=like\.([^&]+)/.exec(q);
  if (eq) return id === eq[1];
  if (like) { const re = new RegExp('^' + like[1].replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[%*]/g, '\u0000').replace(/_/g, '.').replace(/\u0000/g, '.*') + '$'); return re.test(id); }
  return true;
};
global.fetch = async (url, opts = {}) => {
  const u = decodeURIComponent(String(url)), m = (opts.method || 'GET').toUpperCase();
  if (!u.includes('/rest/v1/')) return rep({}, 404);
  const [table, q = ''] = u.split('/rest/v1/')[1].split('?');
  const own = (/(?:^|&)owner=eq\.([^&]+)/.exec(q) || [])[1] || null;
  if (table === 'rpc/vrm_acces_pour') return rep(true);
  if (m === 'POST' && table === 'app_data') {
    for (const l of JSON.parse(opts.body || '[]')) (memos[l.owner] = memos[l.owner] || {})[l.id] = l.data;
    return rep('', 201);
  }
  if (m !== 'GET') return rep('', 204);
  lus.push(u);
  const select = (/(?:^|&)select=([^&]+)/.exec(q) || [])[1] || '';
  if (table === 'abonnements') {
    // La vraie forme : `select=statut,plan,compte_vendeur` ; 028 absente ⇒ 400 (PGRST204/42703).
    if (own === X) return rep({ code: '42703', message: 'column abonnements.plan does not exist' }, 400);
    const l = ABOS[own];
    return rep(l ? [projette({ owner: own, ...l }, select)] : []);
  }
  if (table === 'app_data' && /select=owner&limit=1/.test(q)) return rep([{ owner: S }]);
  if (table === 'app_data' && /id=eq\.main/.test(q) && !own) return rep(Object.values(VENDEURS).map((o) => projette({ owner: o, id: 'main', data: vendeur(o)[0].data }, select)));
  if (!own) return rep([]);
  if (table === 'vinted_accounts') return rep([{ vinted_user_id: 11, login: 'vendeur' }, { vinted_user_id: 12, login: 'achats' }].map((c) => projette(c, select)));
  if (table !== 'app_data') return rep([]);
  if (!Object.values(VENDEURS).includes(own)) return rep([]);
  return rep(vendeur(own).filter((l) => filtreId(l.id, q)).map((l) => projette({ ...l, owner: own }, select)));
};
const res = () => ({ code: null, corps: null, status(n) { this.code = n; return this; }, json(o) { this.corps = o; return this; }, setHeader() {}, end() { return this; } });
const euros = (x) => `${Number(x).toLocaleString('fr-FR', { minimumFractionDigits: Number.isInteger(Number(x)) ? 0 : 2, maximumFractionDigits: 2 })} €`.replace(/\s+/g, ' ');

// ── LA RÈGLE DE L'APP, extraite d'App.jsx (jamais recopiée) ─────────────────
async function regleApp() {
  require('./_source-app.cjs');
  const parser = require(path.join(RACINE, 'node_modules', '@babel', 'parser'));
  const src = require('./_source-app.cjs').sourceApp();
  const ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx'], errorRecovery: true });
  const ctx = vm.createContext({});
  const plR = await import('file://' + path.join(RACINE, 'api', '_lib', 'plan-regle.js'));
  for (const k of Object.keys(plR)) ctx[k] = plR[k];
  for (const n of ast.program.body) {
    const d0 = n.type === 'ExportNamedDeclaration' ? n.declaration : n;
    if (!d0 || d0.type !== 'VariableDeclaration') continue;
    for (const d of d0.declarations) if (d.id && ['compteEcarteChoix', 'compteEcarteRegle'].includes(d.id.name)) vm.runInContext('const ' + src.slice(d.start, d.end) + `;\nthis.${d.id.name} = ${d.id.name};`, ctx);
  }
  return { ctx, plR };
}

(async () => {
  memos = {}; lus = [];
  let cron, widget, owner, bilanMois, banc;
  try { const mod = await import('file://' + path.join(RACINE, 'api', 'ship-reminders.js')); cron = mod.default; banc = mod._banc; } catch (e) { dit(false, 'api/ship-reminders.js se charge', e.message); }
  try { widget = (await import('file://' + path.join(RACINE, 'api', 'widget.js'))).default; } catch (e) { dit(false, 'api/widget.js se charge', e.message); }
  try { owner = await import('file://' + path.join(RACINE, 'api', '_lib', 'owner.js')); } catch (e) { dit(false, 'api/_lib/owner.js se charge', e.message); }
  try { bilanMois = await import('file://' + path.join(RACINE, 'api', '_lib', 'bilan-mois.js')); } catch (e) { dit(false, 'api/_lib/bilan-mois.js se charge', e.message); }
  let app = null;
  try { app = await regleApp(); } catch (e) { dit(false, 'la règle de l’app (compteEcarteRegle) se lit dans App.jsx', e.message); }

  // Ce que dit L'APP pour chaque vendeur : l'offre telle que le serveur la lui rendrait
  // (mode abonnement : propriétaire ⇒ Pro ; statut résilié ⇒ aucune offre ; pas su ⇒ null).
  const regleAttendue = (o) => {
    if (!app) return null;
    if (o === O) return app.plR.regleVentes({ proprietaire: true });
    if (o === X) return null;
    const l = ABOS[o];
    return l && ['active', 'trialing', 'past_due'].includes(l.statut) ? app.plR.regleVentes({ plan: l.plan, compteVendeur: l.compte_vendeur }) : app.plR.regleVentes(null);
  };
  const attendu = (o) => {
    const r = regleAttendue(o);
    // Une app sans `compteEcarteRegle` (code d'avant) : le contrôle le dit (plus bas) et juge
    // le serveur sur la composition de l'app d'alors (`compteEcarteChoix || venteHorsPlan`).
    const ecarte = app && typeof app.ctx.compteEcarteRegle === 'function' ? app.ctx.compteEcarteRegle
      : (u, m, p, rr) => !!(app && ((typeof app.ctx.compteEcarteChoix === 'function' && app.ctx.compteEcarteChoix(u, m, p)) || app.plR.venteHorsPlan(rr, u)));
    const ventes = [{ uid: '11', eur: 40 }, { uid: '12', eur: 500 }].filter((v) => !ecarte(v.uid, new Set(), {}, r));
    return { n: ventes.length, eur: ventes.reduce((s, v) => s + v.eur, 0) };
  };
  dit(!!app && typeof app.ctx.compteEcarteRegle === 'function', 'App.jsx porte la règle PURE `compteEcarteRegle(uid, masques, panneau, regle)` (celle que le serveur recopie)');
  if (app) {
    const eS = attendu(S), eP = attendu(P);
    dit(eS.n === 1 && eS.eur === 40 && eP.n === 2, 'la règle de l’APP (compteEcarteRegle + plan-regle) : Solo au 11 ⇒ 1 vente · 40 € ; Pro ⇒ 2 ventes · 540 €', JSON.stringify({ S: eS, P: eP }));
  }

  console.log('\n── 1. Le bilan de la semaine (cron du lundi, la vraie route)');
  await essaie('bilan semaine', async () => {
    Date.now = () => LUNDI;
    try { const r = res(); await cron({ method: 'GET', headers: { authorization: 'Bearer cle-banc-cron' }, query: {} }, r); dit(r.code === 200 || r.code === 500, 'le cron a tourné', `HTTP ${r.code}`); }
    finally { Date.now = vraiNow; }
    for (const [L, o] of Object.entries(VENDEURS)) {
      const b = pushes.filter((p) => /^bilan-/.test(p.tag || '') && p.endpoint.endsWith('/' + L + '1'));
      const e = attendu(o);
      // (8 nov., api/_lib/notif-belle.js) les lignes du corps sont jointes par des espaces.
      const corps = String((b[0] && b[0].body) || '').replace(/\s+/g, ' ');
      const nom = { S: 'Solo (compte vendeur 11)', P: 'Pro', X: 'offre illisible (pas su)', C: 'Solo résilié', O: 'propriétaire (ligne Solo)' }[L];
      const vendu = `Vendu : ${e.n} vente${e.n > 1 ? 's' : ''} · ${euros(e.eur)}.`;
      dit(b.length === 1 && corps.startsWith(vendu + ' '), `${L} — ${nom} : « ${vendu} », sans réserve`, corps || `${b.length} bilan(s)`);
      dit(corps.includes(` Reçu : ${euros(e.eur)}. `), `${L} — « Reçu : ${euros(e.eur)}. » (même règle, au jour du versement)`);
    }
    const lAbo = lus.filter((u) => /\/rest\/v1\/abonnements\?.*compte_vendeur/.test(u));
    dit(lAbo.length > 0 && lAbo.every((u) => /owner=eq\.[0-9a-f-]{36}/.test(u) && /select=statut,plan,compte_vendeur/.test(u) && !/select=\*|select=data/.test(u)), 'l’offre est lue par vendeur (owner=eq.), projetée (statut, plan, compte_vendeur) — jamais select=data', `${lAbo.length} lecture(s)`);
  });

  console.log('\n── 2. Un compte d’achat pas relu n’est pas réclamé (Solo)');
  await essaie('pas réclamé', async () => {
    memos = {}; pushes.length = 0;
    const vieux = new Date(Date.parse('2026-10-01T09:00:00Z')).toISOString();
    // Le compte 12 (achat) lu jeudi : en Solo, il n'est dans aucun total ⇒ jamais « au moins … sans achats ».
    Date.now = () => LUNDI + 86400000;   // le mardi (rattrapage) : nouveau passage, mémo vidé
    const orig = global.fetch;
    global.fetch = async (url, opts) => {
      const r = await orig(url, opts);
      if (/harvest_%25_orders_sold|harvest_%_orders_sold/.test(decodeURIComponent(String(url)))) {
        const j = await r.json();
        for (const l of j) if (/^harvest_12_/.test(l.id)) l.cap = vieux;
        return rep(j);
      }
      return r;
    };
    try { const r = res(); await cron({ method: 'GET', headers: { authorization: 'Bearer cle-banc-cron' }, query: {} }, r); }
    finally { Date.now = vraiNow; global.fetch = orig; }
    const corpsDe = (L) => String((pushes.find((p) => /^bilan-/.test(p.tag || '') && p.endpoint.endsWith('/' + L + '1')) || {}).body || '').replace(/\s+/g, ' ');
    const s = corpsDe('S'), pp = corpsDe('P');
    dit(s.startsWith('Vendu : 1 vente · 40 €. ') && !/au moins|achats/.test(s), 'S (Solo) : le compte d’achat lu jeudi n’est pas réclamé — aucun « au moins », aucun nom', s);
    dit(/au moins/.test(pp) && /achats/.test(pp), 'P (Pro) : le même compte lu jeudi ⇒ « au moins … sans achats (lu jeudi) » (témoin : la donnée déclenche)', pp);
  });

  console.log('\n── 3. Le bilan du mois (les lectures du cron, `calculerBilan`)');
  await essaie('bilan mois', async () => {
    memos = {};
    for (const [L, o] of Object.entries(VENDEURS)) {
      const d = await owner.contexteVendeur.run({ owner: o }, () => banc.lireDonneesBilan());
      const mois = { ym: '2026-09', debut: Date.parse('2026-08-31T22:00:00Z'), fin: Date.parse('2026-09-30T22:00:00Z') + 86400000 * 2, libelle: 'septembre 2026' };
      const b = bilanMois.calculerBilanMois({ d, pub: null, mois, maintenant: LUNDI });
      const e = attendu(o);
      const v = (b && (b.vendu || (b.bilan && b.bilan.vendu))) || {};
      dit(v.n === e.n && Math.round(v.eur) === e.eur, `${L} — bilan du mois : ${e.n} vente(s) · ${euros(e.eur)}`, JSON.stringify({ n: v.n, eur: v.eur, etat: v.etat }));
    }
  });

  console.log('\n── 4. Le widget (repli sur les e-mails de vente : aucune photo publiée par l’app)');
  await essaie('widget', async () => {
    memos = {};
    for (const [L, o] of Object.entries(VENDEURS)) {
      const w = res();
      Date.now = () => LUNDI;
      try { await widget({ method: 'GET', headers: {}, query: { k: 'jeton-' + L } }, w); } finally { Date.now = vraiNow; }
      const e = attendu(o);
      const c = w.corps || {};
      dit(w.code === 200 && c.moneySource === 'emails' && c.salesMonth === e.n && c.moneyMonth === e.eur, `${L} — widget : ${e.n} vente(s) ce mois · ${euros(e.eur)} (e-mails)`, `HTTP ${w.code} · ${c.salesMonth} · ${c.moneyMonth} · ${c.moneySource}`);
    }
  });

  console.log('\n── 5. Le rappel des offres au prix mini');
  await essaie('offres mini', async () => {
    memos = {}; pushes.length = 0;
    Date.now = () => LUNDI;
    try { const r = res(); await cron({ method: 'GET', headers: { authorization: 'Bearer cle-banc-cron' }, query: {} }, r); }
    finally { Date.now = vraiNow; }
    for (const [L, o] of Object.entries(VENDEURS)) {
      const n = pushes.filter((p) => p.tag === 'offremini' && p.endpoint.endsWith('/' + L + '1'));
      const r = regleAttendue(o);
      const attenduN = ['11', '12'].filter((u) => !(app && app.plR.venteHorsPlan(r, u))).length;
      const m = memos[o] && memos[o].offres_mini_dedup;
      const oids = (m && m.oids) || [];
      dit(n.length === 1 && oids.length === attenduN && (attenduN === 2 || (oids.includes(`${L}1`) && !oids.includes(`${L}2`))),
        `${L} — ${attenduN === 1 ? 'seule l’offre du compte vendeur (11) sonne ; celle du compte d’achat (12) se tait' : 'les deux offres sonnent'}`, `${n.length} notif · offres ${JSON.stringify(oids)}`);
    }
  });

  console.log(`\n${ok} contrôle(s) OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
