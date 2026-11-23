require(require('path').join(__dirname, '_horloge-notif.cjs'));   // heures calmes : midi (Paris) pour ce banc
// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : UN COMPTE « PERSONNEL » HORS DES TOTAUX, AUSSI CÔTÉ SERVEUR (21 nov.)
//         node scripts/audit-personnel-serveur.cjs [--mutation=<nom>] [--prouve]
// ═══════════════════════════════════════════════════════════════════════════
// Julien (20 nov., « comme Bleam ») : Paramètres › Comptes liés › Gérer › « Compte personnel (hors URSSAF et
// livre des recettes) ». L'app le sortait des totaux (src/rolesComptes.js, `comptesHorsTotaux`) ; le bilan de la
// semaine, le bilan du mois et le widget le comptaient encore (passation du 20 nov., §4 point 2).
//
// §4.10 : on EXÉCUTE les vraies routes (api/ship-reminders.js — le cron du lundi et ses lectures —, api/widget.js)
// contre une fausse base À LA VRAIE FORME (`select=` projetés, `data->clé`, `owner=eq.`), à deux vendeurs Pro :
//   P  compte 11 « vente » (40 €) + compte 12 marqué PERSONNEL (500 €)  ⇒ 1 vente · 40 €, partout
//   T  témoin : les mêmes deux comptes, aucun rôle                      ⇒ 2 ventes · 540 € (la DONNÉE déclenche)
// La règle attendue n'est pas écrite ici : elle est celle de l'app (`comptesHorsTotaux`, src/rolesComptes.js).
// --mutation=… réaffaiblit une copie temporaire d'`api/` et `src/` : le contrôle DOIT sortir rouge.
// Aucune donnée réelle : tout est inventé ici, rien ne quitte la machine.
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
let RACINE = path.join(__dirname, '..');
const MUTS = {
  // le bilan (semaine et mois) oublie les rôles
  bilan: ['api/_lib/bilan-semaine.js', 'comptesHorsTotaux(e.masquesComptes, e.roles)', 'e.masquesComptes'],
  // le cron ne lit plus les rôles
  lecture: ['api/ship-reminders.js', "    roles: mm ? objet(mm.vrm_roles_comptes) : null,", ''],
  projection: ['api/ship-reminders.js', "'vinted_accounts_hidden', 'vrm_roles_comptes', ", "'vinted_accounts_hidden', "],
  // le widget compte le compte personnel
  widget: ['api/widget.js', '      if (s.uid != null && horsTotaux.has(String(s.uid))) continue;\n', ''],
  widgetLecture: ['api/widget.js', "'vinted_accounts_hidden', 'vrm_roles_comptes'];", "'vinted_accounts_hidden'];"],
  // la règle elle-même (le propriétaire, src/rolesComptes.js)
  regle: ['src/rolesComptes.js', "o[u] === 'perso'", "o[u] === 'jamais'"],
  // l'app ne publie plus un VENDU sans le compte personnel (`widget_stats`, comparé la nuit au bilan)
  app: ['src/App.jsx', "      const hAcc = comptesHorsTotaux(load('vinted_accounts_hidden', []) || [], load(CLE_ROLES_COMPTES, {}));", "      const hAcc = new Set((load('vinted_accounts_hidden', []) || []).map(String));"],
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
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-perso-'));
  for (const d of ['api', 'src', 'public']) if (fs.existsSync(path.join(RACINE, d))) fs.cpSync(path.join(RACINE, d), path.join(dest, d), { recursive: true });
  fs.copyFileSync(path.join(RACINE, 'package.json'), path.join(dest, 'package.json'));
  fs.symlinkSync(fs.realpathSync(path.join(RACINE, 'node_modules')), path.join(dest, 'node_modules'));
  const f = path.join(dest, m[0]);
  const src = fs.readFileSync(f, 'utf8');
  if (!src.includes(m[1])) { console.log('mutation « ' + ARG + ' » : motif introuvable'); process.exit(2); }
  fs.writeFileSync(f, src.split(m[1]).join(m[2]));
  RACINE = dest;
  console.log('⚠️  MUTATION « ' + ARG + ' » — ce contrôle DOIT sortir rouge.');
}

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${d ? ' — ' + d : ''}`); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m, String((e && e.stack) || e).split('\n').slice(0, 2).join(' ')); } };

const P = '5b000000-0000-4000-8000-000000000001', T = '5b000000-0000-4000-8000-000000000002';
process.env.VRM_OWNER_UID = '5b000000-0000-4000-8000-0000000000ff';
process.env.VAPID_PRIVATE_KEY = 'YmFuYy1jbGUtcHJpdmVlLWZhY3RpY2UtMzItb2N0ZXQ';
process.env.SUPABASE_SERVICE_KEY = 'banc-cle-service';
process.env.CRON_SECRET = 'cle-banc-cron';
const webpush = require(path.join(RACINE, 'node_modules', 'web-push'));
const pushes = [];
webpush.setVapidDetails = () => {};
webpush.sendNotification = async (sub, body) => { pushes.push({ endpoint: sub.endpoint, ...JSON.parse(body) }); return { statusCode: 201 }; };

// Lundi 5 octobre 2026, 10 h 10 à Paris ; ventes du mercredi d'avant, versées le jeudi.
const LUNDI = Date.parse('2026-10-05T08:10:00Z');
const DANS = Date.parse('2026-09-30T14:00:00Z');
const VERSE = new Date(DANS + 86400000).toISOString();
const CAPTE = new Date(LUNDI - 3600000).toISOString();
const vraiNow = Date.now;
const VENDEURS = { P, T };
const ROLES = { [P]: { 12: 'perso' }, [T]: undefined };
const lettre = (own) => Object.keys(VENDEURS).find((k) => VENDEURS[k] === own) || '?';
let memos = {}, lus = [];
const vendeur = (own) => {
  const L = lettre(own);
  const ordre = (tx, eur) => ({ transaction_id: tx, title: 'Paire ' + tx, status: 'Commande finalisée', date: new Date(DANS).toISOString(), price: { amount: String(eur), currency_code: 'EUR' } });
  const main = { vinted_accounts_hidden: [], vinted_ship_done: {}, vinted_bords_shipped: {}, vrm_widget_token: 'jeton-' + L };
  if (ROLES[own]) main.vrm_roles_comptes = ROLES[own];
  return [
    { id: 'main', data: main },
    { id: 'harvest_11_orders_sold', data: { capturedAt: CAPTE, payload: { my_orders: [ordre(1101, 40)] }, resume: { txns: [] } } },
    { id: 'harvest_12_orders_sold', data: { capturedAt: CAPTE, payload: { my_orders: [ordre(1201, 500)] }, resume: { txns: [] } } },
    { id: 'harvest_11_txn_1101', meta: { id: '1101', status: '450', status_updated_at: VERSE }, data: {} },
    { id: 'harvest_12_txn_1201', meta: { id: '1201', status: '450', status_updated_at: VERSE }, data: {} },
    { id: 'lbc_ventes', data: { ventes: {} } },
    { id: 'push_subs', data: { subs: [{ endpoint: 'https://fcm.googleapis.com/' + L + '1', keys: {} }] } },
    // Les ventes apprises par e-mail ce mois-ci (le repli du widget) : `uid` = le compte de l'adresse de réception.
    { id: 'email_sale_a' + L, data: { type: 'vente', prix: '40,00', uid: '11', account: 'vendeur', receivedAt: '2026-10-02T09:00:00.000Z' } },
    { id: 'email_sale_b' + L, data: { type: 'vente', prix: '500,00', uid: '12', account: 'perso', receivedAt: '2026-10-03T09:00:00.000Z' } },
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
  if (table === 'abonnements') return rep([projette({ owner: own, statut: 'active', plan: 'pro', compte_vendeur: null, comptes_vendeurs: {} }, select)]);
  if (table === 'app_data' && /select=owner&limit=1/.test(q)) return rep([{ owner: P }]);
  if (table === 'app_data' && /id=eq\.main/.test(q) && !own) return rep(Object.values(VENDEURS).map((o) => projette({ owner: o, id: 'main', data: vendeur(o)[0].data }, select)));
  if (!own) return rep([]);
  if (table === 'vinted_accounts') return rep([{ vinted_user_id: 11, login: 'vendeur' }, { vinted_user_id: 12, login: 'perso' }].map((c) => projette(c, select)));
  if (table !== 'app_data' || !Object.values(VENDEURS).includes(own)) return rep([]);
  return rep(vendeur(own).filter((l) => filtreId(l.id, q)).map((l) => projette({ ...l, owner: own }, select)));
};
const res = () => ({ code: null, corps: null, status(n) { this.code = n; return this; }, json(o) { this.corps = o; return this; }, setHeader() {}, end() { return this; } });
const euros = (x) => `${Number(x).toLocaleString('fr-FR', { minimumFractionDigits: Number.isInteger(Number(x)) ? 0 : 2, maximumFractionDigits: 2 })} €`.replace(/\s+/g, ' ');
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');

(async () => {
  let cron, widget, owner, bilanMois, banc, roles;
  try { const mod = await import('file://' + path.join(RACINE, 'api', 'ship-reminders.js')); cron = mod.default; banc = mod._banc; } catch (e) { dit(false, 'api/ship-reminders.js se charge', e.message); }
  try { widget = (await import('file://' + path.join(RACINE, 'api', 'widget.js'))).default; } catch (e) { dit(false, 'api/widget.js se charge', e.message); }
  try { owner = await import('file://' + path.join(RACINE, 'api', '_lib', 'owner.js')); } catch (e) { dit(false, 'api/_lib/owner.js se charge', e.message); }
  try { bilanMois = await import('file://' + path.join(RACINE, 'api', '_lib', 'bilan-mois.js')); } catch (e) { dit(false, 'api/_lib/bilan-mois.js se charge', e.message); }
  try { roles = await import('file://' + path.join(RACINE, 'src', 'rolesComptes.js')); } catch (e) { dit(false, 'src/rolesComptes.js se charge', e.message); }

  // Ce que dit L'APP (le propriétaire de la règle) pour chaque vendeur.
  const attendu = (o) => {
    const hors = roles ? roles.comptesHorsTotaux([], ROLES[o]) : new Set();
    const v = [{ uid: '11', eur: 40 }, { uid: '12', eur: 500 }].filter((x) => !hors.has(x.uid));
    return { n: v.length, eur: v.reduce((s, x) => s + x.eur, 0) };
  };
  const eP = attendu(P), eT = attendu(T);
  dit(eP.n === 1 && eP.eur === 40 && eT.n === 2 && eT.eur === 540, 'la règle de l’app (comptesHorsTotaux) : P (12 personnel) ⇒ 1 vente · 40 € ; T (aucun rôle) ⇒ 2 ventes · 540 €', JSON.stringify({ P: eP, T: eT }));

  console.log('\n── 1. Le bilan de la semaine (cron du lundi, la vraie route)');
  await essaie('bilan semaine', async () => {
    Date.now = () => LUNDI;
    try { const r = res(); await cron({ method: 'GET', headers: { authorization: 'Bearer cle-banc-cron' }, query: {} }, r); dit(r.code === 200 || r.code === 500, 'le cron a tourné', `HTTP ${r.code}`); }
    finally { Date.now = vraiNow; }
    for (const [L, o] of Object.entries(VENDEURS)) {
      const b = pushes.filter((p) => /^bilan-(?!mois-)/.test(p.tag || '') && p.endpoint.endsWith('/' + L + '1'));
      const e = attendu(o);
      const corps = String((b[0] && b[0].body) || '').replace(/\s+/g, ' ');
      const vendu = `Vendu : ${e.n} vente${e.n > 1 ? 's' : ''} · ${euros(e.eur)}.`;
      dit(b.length === 1 && corps.startsWith(vendu + ' '), `${L} — « ${vendu} », sans réserve`, corps || `${b.length} bilan(s)`);
      dit(corps.includes(` Reçu : ${euros(e.eur)}. `), `${L} — « Reçu : ${euros(e.eur)}. » (CA déclaré, au jour du versement)`, corps);
      dit(!/au moins|perso/.test(corps), `${L} — le compte personnel n’est ni compté ni réclamé (« au moins … sans perso »)`, corps);
    }
    const lMain = lus.filter((u) => /\/rest\/v1\/app_data\?.*id=eq\.main/.test(u) && /owner=eq\./.test(u) && /vrm_roles_comptes/.test(u));
    dit(lMain.length > 0 && lMain.every((u) => /vrm_roles_comptes:data->vrm_roles_comptes/.test(u) && !/select=data(&|$)|select=\*/.test(u)), 'le rôle des comptes est lu PROJETÉ sur `main` (`vrm_roles_comptes:data->vrm_roles_comptes`), jamais select=data', `${lMain.length} lecture(s)`);
  });

  console.log('\n── 2. Le bilan du mois (les lectures du cron, `calculerBilan`)');
  await essaie('bilan mois', async () => {
    memos = {};
    for (const [L, o] of Object.entries(VENDEURS)) {
      const d = await owner.contexteVendeur.run({ owner: o }, () => banc.lireDonneesBilan());
      const mois = { ym: '2026-09', debut: Date.parse('2026-08-31T22:00:00Z'), fin: Date.parse('2026-09-30T22:00:00Z') + 86400000 * 2, libelle: 'septembre 2026' };
      const b = bilanMois.calculerBilanMois({ d, pub: null, mois, maintenant: LUNDI });
      const e = attendu(o);
      const v = (b && (b.vendu || (b.bilan && b.bilan.vendu))) || {};
      const r = (b && (b.recu || (b.bilan && b.bilan.recu))) || {};
      dit(v.n === e.n && Math.round(v.eur) === e.eur, `${L} — bilan du mois, vendu : ${e.n} vente(s) · ${euros(e.eur)}`, JSON.stringify({ n: v.n, eur: v.eur, etat: v.etat }));
      dit(Math.round(r.eur) === e.eur, `${L} — bilan du mois, reçu : ${euros(e.eur)}`, JSON.stringify({ eur: r.eur, etat: r.etat }));
    }
  });

  console.log('\n── 3. Le widget (repli sur les e-mails de vente : aucune photo publiée par l’app)');
  await essaie('widget', async () => {
    memos = {}; lus = [];
    for (const [L, o] of Object.entries(VENDEURS)) {
      const w = res();
      Date.now = () => LUNDI;
      try { await widget({ method: 'GET', headers: {}, query: { k: 'jeton-' + L } }, w); } finally { Date.now = vraiNow; }
      const e = attendu(o);
      const c = w.corps || {};
      dit(w.code === 200 && c.moneySource === 'emails' && c.salesMonth === e.n && c.moneyMonth === e.eur, `${L} — widget : ${e.n} vente(s) ce mois · ${euros(e.eur)} (e-mails)`, `HTTP ${w.code} · ${c.salesMonth} · ${c.moneyMonth} · ${c.moneySource}`);
    }
    const lMain = lus.filter((u) => /\/rest\/v1\/app_data\?.*id=eq\.main/.test(u) && /owner=eq\./.test(u));
    dit(lMain.length > 0 && lMain.every((u) => !/select=data(&|$)|select=\*/.test(u)) && lMain.some((u) => /vrm_roles_comptes:data->vrm_roles_comptes/.test(u)), 'le widget lit `main` projeté, rôles compris — jamais select=data', `${lMain.length} lecture(s)`);
  });

  console.log('\n── 4. L’app publie le même VENDU (`widget_stats`, comparé chaque nuit au bilan par le contrôle de nuit)');
  await essaie('app', async () => {
    const app = sansCommentaires(require('./_source-app.cjs').sourceApp(RACINE));
    // Le calcul du VENDU de la coque (`liveStatsVus`) : ses comptes écartés passent par la règle des rôles.
    const i = app.indexOf('const liveStatsVus = useMemo(');
    const bloc = i >= 0 ? app.slice(i, app.indexOf('ventesFaites(', i)) : '';
    dit(/const hAcc = comptesHorsTotaux\(/.test(bloc), 'le VENDU de la coque (Ma journée, `widget_stats`) écarte les comptes hors des totaux par `comptesHorsTotaux` (src/rolesComptes.js)');
    dit(/const hAccCoqueCle = \[\.\.\.comptesHorsTotaux\(/.test(app), 'les ventes vues par e-mail de la coque suivent la même règle (`hAccCoqueCle`)');
  });

  console.log(`\n${ok} contrôle(s) OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
