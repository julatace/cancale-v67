#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
//  AUDIT « DEUX PRIX PRO, CÔTÉ SERVEUR » (16 nov. au soir, lot deux-prix-compter)
// ═══════════════════════════════════════════════════════════════════════════
// §5 « une seule règle par notion » : la décision de Julien (une vente Pro dont la liste dépasse
// l'article de 2 € au plus est comptée au prix de l'ARTICLE) doit valoir aussi sur le SERVEUR.
// Exécute le VRAI code contre une fausse base Supabase (forme réelle : app_data owner/id/data/meta,
// projections `alias:data->…->>x`, filtres `eq` `like` `cs`, PATCH `return=representation`) :
//   B  le bilan de la semaine / du mois : `api/ship-reminders.js` (`_banc.lireDonneesBilan`, dans le
//      contexte du vendeur) puis `calculerBilan` (api/_lib/bilan-semaine.js) — le « vendu » compte la
//      vente Pro à deux prix ≤ 2 € au prix de l'article ; écart > 2 € / liste sous l'article : comme
//      avant ; un compte particulier ne bouge pas ; profil illisible ⇒ rien ne change ;
//   F  la facture Pro : la VRAIE route `routeFacturePro` (action « emettre », le clic de l'app ; la
//      preuve est la même que l'envoi automatique, `lirePreuveEtCommandes`) — la vente se prouve
//      avec l'e-mail (prix de l'article) et la facture est à ce prix ; écart > 2 € ⇒ refusée comme avant ;
//   R  la règle n'est pas recopiée à la main : `typeCompteVinted` du serveur = celle d'App.jsx
//      (au jeton près, audit-bilan-semaine), la mise en forme vient de src/vintedPro.js.
// Données INVENTÉES. `AUDIT_RACINE=<arbre>` : juge un autre arbre ; `--prouve` : mutations.
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const RACINE_DEPOT = path.resolve(__dirname, '..');
const racine = process.env.AUDIT_RACINE || RACINE_DEPOT;
const MUET = !!process.env.AUDIT_RACINE;
let ok = 0, ko = 0;
const dit = (c, l, d = '') => { if (c) { ok++; if (!MUET) console.log('✅ ' + l); } else { ko++; console.log('❌ ' + l + (d ? ' — ' + d : '')); } };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' (planté)', String((e && e.stack) || e).slice(0, 300)); } };

const luhn = (s) => { let t = 0; for (let i = 0; i < s.length; i++) { let n = +s[s.length - 1 - i]; if (i % 2) { n *= 2; if (n > 9) n -= 9; } t += n; } return t % 10 === 0; };
const SIREN = (() => { for (let k = 0; k < 10; k++) if (luhn('90012345' + k)) return '90012345' + k; })();
const SIRET = (() => { for (let k = 0; k < 100000; k++) { const s = SIREN + String(k).padStart(5, '0'); if (luhn(s)) return s; } })();

// ── La fausse base ─────────────────────────────────────────────────────────
const A = '33333333-3333-4333-8333-333333333333';
const PRO = '5550001', PART = '5550002';
let base = new Map();          // `${owner}|${id}` → { data, meta }
const pannes = new Set();
const cle = (o, i) => `${o}|${i}`;
const val = (racineObj, chemin) => { let v = racineObj; for (const seg of chemin.split(/->>?/)) v = v == null ? undefined : v[seg]; return v; };
const contient = (a, b) => (Array.isArray(b) ? Array.isArray(a) && b.every((x) => a.some((y) => contient(y, x))) : b && typeof b === 'object' ? a && typeof a === 'object' && Object.entries(b).every(([k, v]) => contient(a[k], v)) : a === b);
const projeter = (r, selBrut) => Object.fromEntries((selBrut || 'data').split(',').map((x) => {
  const [al, src] = x.includes(':') ? x.split(':') : [x.split(/->>?/).pop(), x];
  if (src === 'id') return [al, r.id]; if (src === 'owner') return [al, r.owner]; if (src === 'data') return [al, r.data];
  const v = val({ data: r.data, meta: r.meta || {} }, src);
  return [al, v == null ? null : /->>[A-Za-z_0-9]+$/.test(src) && typeof v !== 'string' ? String(v) : v];
}));
global.fetch = async (u, o = {}) => {
  const url = new URL(u);
  const methode = (o.method || 'GET').toUpperCase();
  const rep = (code, corps) => ({ ok: code >= 200 && code < 300, status: code, json: async () => corps, text: async () => JSON.stringify(corps), headers: { get: () => null } });
  if (url.pathname.endsWith('/rest/v1/vinted_accounts') && methode === 'GET') return rep(200, [{ vinted_user_id: PRO, login: 'pro_banc' }, { vinted_user_id: PART, login: 'perso_banc' }]);
  if (!url.pathname.endsWith('/rest/v1/app_data')) return rep(404, {});
  const q = url.searchParams;
  const idq = q.get('id') || '';
  const owner = (q.get('owner') || '').replace(/^eq\./, '');
  const autres = [...q.entries()].filter(([k]) => !['id', 'owner', 'select', 'on_conflict', 'order', 'limit', 'offset'].includes(k)).map(([k, v]) => `${k}=${v}`);
  if (methode === 'GET') {
    if (q.get('select') === 'owner' && q.get('limit') === '1') return rep(200, [{ owner: A }]);
    if ([...pannes].some((p) => decodeURIComponent(url.search).includes(p))) return rep(522, '<html>');
    let lignes = [...base.entries()].map(([k, d]) => { const i = k.indexOf('|'); return { owner: k.slice(0, i), id: k.slice(i + 1), data: d.data, meta: d.meta }; });
    if (owner) lignes = lignes.filter((r) => r.owner === owner);
    if (idq.startsWith('eq.')) lignes = lignes.filter((r) => r.id === idq.slice(3));
    else if (idq.startsWith('like.')) { const re = new RegExp('^' + idq.slice(5).replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); lignes = lignes.filter((r) => re.test(r.id)); }
    else if (idq.startsWith('in.(')) { const ids = idq.slice(4, -1).split(','); lignes = lignes.filter((r) => ids.includes(r.id)); }
    else if (idq) return rep(400, {});
    for (const f of autres) {
      const m = /^((?:data|meta)(?:->>?[A-Za-z_]+)+)=(eq|cs|gte|is)\.(.*)$/.exec(f);
      if (!m) return rep(400, { message: 'filtre inconnu du banc : ' + f });   // une lecture du cron que ce banc ne sert pas : « pas su » pour elle
      const [, ch, op, v] = m;
      lignes = lignes.filter((r) => { const x = val({ data: r.data, meta: r.meta || {} }, ch); return op === 'eq' ? String(x) === v : op === 'gte' ? x != null && String(x) >= v : op === 'is' ? (v === 'null' ? x == null : x != null) : contient(x, JSON.parse(v)); });
    }
    return rep(200, lignes.map((r) => projeter(r, q.get('select'))));
  }
  if (methode === 'POST') {
    const lignes = JSON.parse(o.body);
    const fusion = /merge-duplicates/.test((o.headers || {}).Prefer || (o.headers || {}).prefer || '');
    for (const l of lignes) { if (!l.owner) return rep(400, {}); if (base.has(cle(l.owner, l.id)) && !fusion) return rep(409, { message: 'doublon' }); }
    for (const l of lignes) base.set(cle(l.owner, l.id), { data: JSON.parse(JSON.stringify(l.data)) });
    return rep(201, null);
  }
  if (methode === 'PATCH') {
    const id = idq.replace(/^eq\./, ''); const k = cle(owner, id);
    if (!owner || !base.has(k)) return rep(200, []);
    const d = base.get(k).data;
    const passe = autres.every((f) => { let m; if ((m = /^data->>rev=eq\.(.*)$/.exec(f))) return d && String(d.rev) === m[1]; if (f === 'data->>rev=is.null') return d && d.rev == null; if ((m = /^data->>n=eq\.(\d+)$/.exec(f))) return String(d.n) === m[1]; if ((m = /^data=eq\.(\d+)$/.exec(f))) return JSON.stringify(d) === m[1]; return false; });
    if (!passe) return rep(200, []);
    base.set(k, { data: JSON.parse(o.body).data });
    return rep(200, [{ id }]);
  }
  return rep(405, {});
};
const faireRes = () => { const r = { code: 0, corps: null }; r.setHeader = () => {}; r.status = (c) => { r.code = c; return { json: (j) => { r.corps = j; return r; } }; }; return r; };

// ── La base inventée ────────────────────────────────────────────────────────
const maintenant = Date.now();
const iso = (t) => new Date(t).toISOString();
const tVente = maintenant - 2 * 3600e3;
// tx, compte, liste, article
const VENTES = [
  ['8100000001', PRO, '50.48', '50.0'],    // écart 0,48 ⇒ 50,00
  ['8100000002', PRO, '21.45', '20.0'],    // écart 1,45 ⇒ 20,00
  ['8100000003', PRO, '40.00', '40.0'],    // un prix
  ['8100000004', PRO, '33.00', '30.5'],    // écart 2,50 ⇒ à part (prix de la liste, comme avant)
  ['8100000005', PRO, '25.00', '25.6'],    // liste sous l'article ⇒ à part
  ['8200000001', PART, '35.00', '33.0'],   // compte PARTICULIER : jamais touché
];
function semer({ profilPro = true } = {}) {
  base = new Map();
  const mettre = (id, data, meta) => base.set(cle(A, id), { data, meta });
  mettre('main', { vinted_accounts_hidden: [] });
  mettre('vrm_pro_facture', { nom: 'Boutique Banc', forme: 'EI', siret: SIRET, adresse: '1 rue du Banc', codePostal: '35000', ville: 'Rennes', tva_regime: 'franchise', prefixe: 'FA', email: 'boutique@banc.test' });
  for (const uid of [PRO, PART]) {
    const ventes = VENTES.filter((v) => v[1] === uid).map(([tx, , liste]) => ({ transaction_id: Number(tx), title: 'Paire inventée', price: { amount: liste, currency_code: 'EUR' }, status: 'Commande finalisée', date: iso(tVente), transaction_user_status: 'completed' }));
    mettre(`harvest_${uid}_orders_sold`, { capturedAt: iso(maintenant), payload: { my_orders: ventes } });
  }
  mettre(`harvest_${PRO}_profile`, { capturedAt: iso(maintenant), payload: { user: { id: Number(PRO), business: profilPro, business_account_id: profilPro ? 9001 : null, business_account: null } } });
  mettre(`harvest_${PART}_profile`, { capturedAt: iso(maintenant), payload: { user: { id: Number(PART), business: false, business_account_id: null, business_account: null } } });
  for (const [tx, uid, , art] of VENTES) {
    mettre(`harvest_${uid}_txn_${tx}`, { capturedAt: iso(maintenant), payload: { transaction: { id: Number(tx), user_side: 'seller', status: 450, status_updated_at: iso(tVente + 600e3), items_count: 1,
      offer: { price: { amount: art, currency_code: 'EUR' } }, service_fee: { amount: '1.20', currency_code: 'EUR' }, total_amount_without_tax: { amount: (Number(art) + 1.2).toFixed(2), currency_code: 'EUR' } } } },
    { id: tx, status: '450', status_updated_at: iso(tVente + 600e3) });
    // L'e-mail de vente Pro : le prix de l'ARTICLE (mesuré chez lui : 21/21).
    if (uid === PRO) mettre('email_sale_m' + tx, { type: 'vente', pro: true, transaction: tx, receivedAt: iso(tVente + 60e3), prix: (Number(art)).toFixed(2), nomComplet: `Client ${tx}`, adresse: 'rue Inventée, 12, Paris, 75011, FR, France', email: `client${tx}@exemple.test`, designation: 'Paire inventée', uid: PRO });
  }
}

(async () => {
  process.env.SUPABASE_SERVICE_KEY = 'sb_secret_banc';
  process.env.VRM_COFFRE_CLE = 'cle-de-coffre-du-banc';
  const imp = (p) => import(pathToFileURL(path.join(racine, p)).href);
  const { contexteVendeur } = await imp('api/_lib/owner.js');
  const SR = await imp('api/ship-reminders.js');
  const BIL = await imp('api/_lib/bilan-semaine.js');
  const FP = await imp('api/_lib/facture-pro.js');

  // ══ B : le bilan de la semaine / du mois ════════════════════════════════════
  const bilan = async () => {
    const d = await contexteVendeur.run({ owner: A }, () => SR._banc.lireDonneesBilan());
    const b = BIL.calculerBilan({ ...d, colis: 0, debut: maintenant - 7 * 86400e3, fin: maintenant + 3600e3, seuilCapture: maintenant - 86400e3, maintenant });
    const ordres = (uid) => new Map(((d.commandes && d.commandes[uid] && d.commandes[uid].orders) || []).map((o) => [String(o.transaction_id), o]));
    return { d, b, ordres };
  };
  await essaie('B', async () => {
    semer();
    const { b, ordres } = await bilan();
    const p = ordres(PRO), q = ordres(PART);
    const prix = (o) => (o && o.price ? o.price.amount : null);
    dit(prix(p.get('8100000001')) === '50.00' && prix(p.get('8100000002')) === '20.00', 'B1 bilan : vente Pro à deux prix ≤ 2 € ⇒ prix de l’ARTICLE (50,00 · 20,00)', `${prix(p.get('8100000001'))} · ${prix(p.get('8100000002'))}`);
    dit(prix(p.get('8100000003')) === '40.00' && prix(q.get('8200000001')) === '35.00', 'B2 vente à un prix et compte PARTICULIER : inchangés au centime', `${prix(p.get('8100000003'))} · ${prix(q.get('8200000001'))}`);
    dit(prix(p.get('8100000004')) === '33.00' && p.get('8100000004')._prixPro && p.get('8100000004')._prixPro.compter === false && p.get('8100000005')._prixPro && p.get('8100000005')._prixPro.compter === false, 'B3 écart > 2 € et liste sous l’article : à part, comme dans l’app (`_prixPro`)');
    // Vendu de la semaine = 50 + 20 + 40 + 33 + 25 (à part : comptées au prix de la liste dans le VENDU, comme l'app) + 35.
    const attendu = 50 + 20 + 40 + 33 + 25 + 35;
    dit(b.vendu && Math.round(b.vendu.eur * 100) === attendu * 100, `B4 bilan : vendu = ${attendu} € (l’écart n’y est pas)`, JSON.stringify(b.vendu && { eur: b.vendu.eur, n: b.vendu.n }));
    semer({ profilPro: false });
    const r2 = await bilan();
    dit(r2.ordres(PRO).get('8100000001').price.amount === '50.48' && !r2.ordres(PRO).get('8100000001')._prixPro, 'B5 compte pas Pro (profil lu) ⇒ rien ne change');
    semer(); pannes.add(`harvest_${PRO}_profile`);
    const r3 = await bilan();
    dit(r3.ordres(PRO).get('8100000001').price.amount === '50.48', 'B6 profil illisible ⇒ « pas su » n’est pas « Pro » : rien ne change');
    pannes.clear();
  });

  // ══ F : la facture Pro (la vraie route) ════════════════════════════════════
  const emettre = async (tx) => { const r = faireRes(); await FP.routeFacturePro({ method: 'POST' }, r, { vendeur: { id: A }, corps: { action: 'emettre', confirme: true, tx }, acces: true, cloisonnee: true }); return r; };
  await essaie('F', async () => {
    semer();
    const r = await emettre('8100000001');
    const f = base.get(cle(A, 'email_invoice_tx8100000001'));
    const ttc = f && f.data && f.data.contenu && f.data.contenu.totaux && f.data.contenu.totaux.ttc;
    dit(r.code === 200 && ttc === 5000, 'F1 facture Pro d’une vente à deux prix ≤ 2 € : émise, au prix de l’ARTICLE (50,00 €)', `${r.code} ${JSON.stringify(r.corps).slice(0, 160)} ttc=${ttc}`);
    const r2 = await emettre('8100000004');
    dit(r2.code === 409 && r2.corps && r2.corps.code === 'montant', 'F2 écart > 2 € : refusée comme avant (le prix diffère), aucun numéro', `${r2.code} ${r2.corps && r2.corps.code}`);
    const r3 = await emettre('8100000003');
    const f3 = base.get(cle(A, 'email_invoice_tx8100000003'));
    dit(r3.code === 200 && f3 && f3.data.contenu.totaux.ttc === 4000, 'F3 vente à un prix : facture inchangée (40,00 €)');
  });

  // ══ R : la règle n'est pas recopiée à la main ══════════════════════════════
  await essaie('R', async () => {
    const pp = fs.readFileSync(path.join(racine, 'api/_lib/prix-pro.js'), 'utf8').replace(/^\s*\/\/.*$/gm, '');
    dit(/from '\.\.\/\.\.\/src\/vintedPro\.js'/.test(pp) && /from '\.\/ventes-regle\.js'/.test(pp) && !/function typeCompteVinted/.test(pp), 'R1 api/_lib/prix-pro.js importe la règle (src/vintedPro.js) et typeCompteVinted du miroir refabriqué — aucune copie');
    const fa = fs.readFileSync(path.join(racine, 'api/_lib/factures-auto.js'), 'utf8');
    dit(/lirePreuveEtCommandes\(owner, tx, facture\)/.test(fa), 'R2 l’envoi AUTOMATIQUE lit la même preuve que le clic (`lirePreuveEtCommandes`)');
  });

  console.log(`\n${ko ? '❌' : '✅'} audit-deux-prix-serveur : ${ok} vert(s), ${ko} rouge(s)`);
  if (!process.argv.includes('--prouve') || ko) process.exit(ko ? 1 : 0);

  const MUTATIONS = [
    ['api/ship-reminders.js', 'bilan sans la règle Pro', "await Promise.all(Object.entries(commandes).map(async ([u, c]) => { c.orders = await ventesAvecPrixPro(u, c.orders, lireP); }));", ''],
    ['api/_lib/facture-pro.js', 'preuve de facture sans la règle Pro', 'const posees = await ventesAvecPrixPro(uid, siennes, (q) => lireListe(q, owner), { tx });', 'const posees = siennes;'],
    ['src/vintedPro.js', 'profil illisible ou particulier pris pour Pro', "const pro = Array.isArray(profil) && profil[0] && typeof typeCompte === 'function' ? typeCompte({ user: profil[0] }) : null;", 'const pro = true;'],
    ['src/vintedPro.js', 'prix HAUT gardé', "n.price = { amount: (r.prixArticle / 100).toFixed(2), currency_code: 'EUR' };", ''],
  ];
  let rates = 0;
  for (const [fichier, nom, avant, apres] of MUTATIONS) {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-dps-'));
    for (const x of ['src', 'api']) fs.cpSync(path.join(RACINE_DEPOT, x), path.join(d, x), { recursive: true });
    fs.writeFileSync(path.join(d, 'package.json'), fs.readFileSync(path.join(RACINE_DEPOT, 'package.json')));
    fs.symlinkSync(path.dirname(path.dirname(require.resolve('web-push/package.json', { paths: [RACINE_DEPOT] }))), path.join(d, 'node_modules'));
    const p = path.join(d, fichier); const brut = fs.readFileSync(p, 'utf8');
    if (!brut.includes(avant)) { console.log(`KO  mutation introuvable : ${nom}`); rates++; fs.rmSync(d, { recursive: true, force: true }); continue; }
    fs.writeFileSync(p, brut.replace(avant, apres));
    const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, AUDIT_RACINE: d }, encoding: 'utf8', timeout: 180000 });
    const rouge = r.status !== 0;
    const premier = ((r.stdout || '').split('\n').find((l) => l.startsWith('❌ ') && !/audit-deux-prix-serveur/.test(l)) || '').slice(0, 110);
    console.log(`${rouge ? 'OK  rouge' : 'KO  VERT'} sous mutation : ${nom}${rouge ? ` (${premier})` : ''}`);
    if (!rouge) rates++;
    fs.rmSync(d, { recursive: true, force: true });
  }
  console.log(rates ? `❌ ${rates} mutation(s) pas attrapée(s)` : `✅ ${MUTATIONS.length}/${MUTATIONS.length} mutations attrapées`);
  process.exit(rates ? 1 : 0);
})().catch((e) => { console.log('❌ audit planté : ' + ((e && e.stack) || e)); process.exit(1); });
