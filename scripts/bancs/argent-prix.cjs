// ═══════════════════════════════════════════════════════════════════════════
// BANC : ARGENT ET PRIX (14 nov., lot argent-prix — 112 à 122)
// Données INVENTÉES (dépôt public), horloge au 14 nov. 2026 10 h (Paris), 390 px
// tactile et 1512 px, clair et sombre. On juge la RÈGLE (data-* et nombres rendus) :
//   A. Argent → Statistiques : « Offres acceptées et payées » (113 : payée = la
//      transaction de la conversation est une vente) ; « Le prix à afficher » (122 :
//      80 € voulus ⇒ Vinted 80 €, eBay au taux LU de ses commandes, arrondi dessus) ;
//      « Prix d'un site à l'autre » s'ouvre (121) ;
//   B. Argent → Déclarer : « Révision du mois » (116 : octobre, chaque manque, sa porte) ;
//      « Lien pour ton comptable » (115 : créer, l'URL, couper) ;
//   C. Ma journée : un solde fini ⇒ VRM PROPOSE « Remettre les prix » (114) ; la feuille
//      s'ouvre, AUCUNE commande ne part sans « Remettre N prix » ;
//   D. la page du comptable (`/?comptable=`) : la compta, aucun nom ; lien mort ⇒ dit ;
//   E. Ventes → Litiges : les DEUX taux par modèle (112) ;
//   partout : aucun débordement, rien ne sort des cartes, aucun montant en bleu, aucune erreur.
// Lancer : npm run build && BANC_PORT=47xx node scripts/bancs/argent-prix.cjs  (SHOTS=<dossier>, VUES=390-clair,…)
require('./_porte-banc.cjs');
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const { pathToFileURL } = require('url');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4793);
const SHOTS = process.env.SHOTS || '';
const VUES = process.env.VUES ? process.env.VUES.split(',') : null;
const MAINTENANT = '2026-11-14T10:00:00+01:00';
const NOW = Date.parse(MAINTENANT);
const J = 86400000;
const A = '111';
const ACCOUNTS = [{ id: 1, vinted_user_id: A, login: 'atelier_inventé_aux_longs_noms_de_boutique', domain: 'www.vinted.fr', updated_at: '2026-11-14T08:00:00Z' }];
const iso = (t) => new Date(t).toISOString();

// ── Les ventes Vinted (novembre) et leurs annonces ; les conversations à offre.
const VENTES = [], LISTINGS = [], CONVS = [], FICHES = {};
for (let i = 1; i <= 12; i++) {
  const tx = 80000 + i, item = 500000 + i, ts = NOW - (i + 1) * J;
  const retour = i <= 2, litige = i === 3;
  VENTES.push({ transaction_id: tx, item_id: item, title: i <= 10 ? 'Nike Dunk Low inventée 42' : 'Adidas Samba inventée 40', brand_title: i <= 10 ? 'Nike' : 'Adidas', price: { amount: '100.0', currency_code: 'EUR' },
    status: retour ? 'Retour initié' : litige ? 'Transaction suspendue' : 'Commande finalisée', transaction_user_status: retour || litige ? 'needs_action' : 'completed', date: iso(ts), conversation_id: 9000 + i });
}
for (let i = 1; i <= 6; i++) {
  const item = 600000 + i;
  LISTINGS.push({ id: item, title: `Paire inventée N°${i} taille 42`, price: { amount: String(i === 1 ? 100 : 80), currency_code: 'EUR' }, is_hidden: false, created_at_ts: Math.round((NOW - 30 * J) / 1000), photos: [] });
  FICHES[String(item)] = { numero: String(i), title: `Paire inventée N°${i} taille 42`, numberedAt: '2026-10-20T10:00:00Z', accountId: A, buyPrice: '40' };
}
// 8 offres acceptées : 5 dans une conversation dont la transaction est vendue (payées), 3 sans vente.
const offre = (id, st, ts) => ({ entity_type: 'offer_request_message', created_at_ts: iso(ts), entity: { user_id: 9, offer_request_id: id, status: st, price: { amount: '90.0' } } });
for (let i = 1; i <= 10; i++) {
  const tx = i <= 5 ? 80000 + i + 3 : 81000 + i;                     // 5 premières : transactions vendues (80004…80008)
  CONVS.push({ id: `harvest_${A}_conv_${7000 + i}`, data: { capturedAt: '2026-11-14T08:00:00Z', payload: { conversation: { id: 7000 + i, opposite_user: { id: 9 },
    transaction: { id: tx, current_user_side: 'seller' }, messages: [offre('o' + i, i <= 8 ? 20 : 30, NOW - (i + 3) * J)] } } } });
}
// ── Le relevé de Ventes (octobre, pour la révision) : [plat, compte, tx, ts, vente, achat, frais, titre, N°, versement]
const oct = (j) => new Date(2026, 9, j, 12).getTime();
const RELEVE = [
  ['Vinted', ACCOUNTS[0].login, '70001', oct(3), 90, 40, 0, 'Nike Dunk inventée', '12', iso(oct(5))],
  ['Vinted', ACCOUNTS[0].login, '70002', oct(4), 70, null, 0, 'Samba inventée', '13', iso(oct(6))],
  ['Vinted', ACCOUNTS[0].login, '70003', oct(6), 60, 30, 0, 'Gazelle inventée', '14', ''],
  ['Leboncoin', '', 'lbc:3001', oct(8), 95, null, 0, 'Air Force 1 inventée', '', iso(oct(8))],
];
// ── eBay : 3 commandes aux frais LUS (12,9 % du dû au vendeur).
const money = (v) => ({ value: v.toFixed(2), currency: 'EUR' });
const EBAY = [100, 200, 150].map((du, i) => ({ orderId: `27-1000${i}-2000${i}`, creationDate: iso(NOW - (i + 5) * J), orderPaymentStatus: 'PAID', orderFulfillmentStatus: 'FULFILLED',
  paymentSummary: { totalDueSeller: money(du) }, totalMarketplaceFee: money(Math.round(du * 12.9) / 100), pricingSummary: { total: money(du + 9.9), deliveryCost: money(9.9) }, lineItems: [{ title: 'Paire inventée', sku: 'VRM-' + (20 + i) }] }));
// ── Un solde FINI (fin 10 nov.) : deux paires à remettre.
const SOLDES = { v: 1, soldes: [{ id: 's1', cree: iso(NOW - 10 * J), fin: '2026-11-10', site: 'vinted', paires: [
  { site: 'vinted', uid: A, id: '600002', num: '2', titre: 'Paire inventée N°2 taille 42', origine: 100, solde: 80, etat: 'baisse' },
  { site: 'vinted', uid: A, id: '600003', num: '3', titre: 'Paire inventée N°3 taille 42', origine: 100, solde: 80, etat: 'baisse' }] }] };
const mainDe = (x = {}) => ({ vinted_regime: 'micro', vinted_urssaf_taux: 12.3, vinted_urssaf_freq: 'mensuel', vinted_annonce_numeros: FICHES, vrm_visite_vue: true, vrm_soldes: SOLDES, ...x });
const ROWS = [
  { id: `harvest_${A}_orders_sold`, data: { capturedAt: '2026-11-14T08:00:00Z', payload: { my_orders: VENTES } } },
  { id: `harvest_${A}_listings`, data: { capturedAt: '2026-11-14T08:00:00Z', payload: { items: LISTINGS, pagination: null } } },
  ...CONVS,
  { id: 'ebay_comptes', data: { rev: 1, comptes: [{ cle: 'aaaaaaaaaaaaaaa1', pseudo: 'ma_boutique_ebay', principal: true, deconnecteLe: null }] } },
  { id: 'ebay_orders', data: { rev: 1, orders: EBAY, total: EBAY.length, complet: true, capturedAt: iso(NOW - 60e3) } },
  { id: 'lbc_ventes', data: { ventes: {} } },
  // Leboncoin : le N°2 en ligne à 95 € (identité = la référence VRM), Vinted à 80 € ⇒ un écart ; le N°3 au même prix ⇒ rien.
  { id: 'lbc_listings', data: { capturedAt: '2026-11-14T08:00:00Z', items: { 3001002: { status: 'active', price: 95, subject: 'Paire inventée N°2 taille 42', customRef: 'VRM-2' }, 3001003: { status: 'active', price: 80, subject: 'Paire inventée N°3 taille 42', customRef: 'VRM-3' } }, lectures: {} } },
];
// La page du comptable : ce que le serveur sert (déjà réduit par `vueComptable`).
const VUE_COMPTABLE = { ok: true, exp: NOW + 30 * J, vues: [{ periode: '2026-10', libelle: 'octobre 2026', etabliLe: '14/11/2026', entreprise: { nom: 'Atelier inventé', siret: '123 456 789 00012' }, regime: 'micro', regimeTexte: 'Micro-entrepreneur', taux: 12.3,
  caParMois: [{ ym: '2026-10', mois: 'octobre 2026', n: 3, ca: 245, urssaf: 30.14, declare: true }], caDeclare: 245, partielCa: false, urssaf: 30.14, ligneLue: true,
  ventes: [{ dateVente: '03/10/2026', dateVersement: '05/10/2026', plateforme: 'Vinted', num: '12', reference: '70001', titre: 'Nike Dunk inventée', montant: 90, frais: null, note: '' }],
  nVentes: 1, totalVentes: 90, ventesCompletes: true, manqueVentes: [], sansMontantVentes: 0, aDater: [], nADater: 0,
  achats: [{ date: '01/10/2026', plateforme: 'Vinted', reference: '999', num: '12', titre: 'Nike Dunk inventée', saisi: 40, lu: 42, sourceLue: 'reçu Vinted' }],
  nAchats: 1, sansCout: 0, coutSaisi: 40, manqueAchats: [], nonComptees: 0, publieLe: iso(NOW) }] };
const JETON = 'abcdefghijklmnopqrstuvwxyzABCDEF.' + (NOW + 30 * J).toString(36) + '.abcdefghijklmnopqrstuv';

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 180)); } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.mjs': 'text/javascript', '.mp4': 'video/mp4', '.onnx': 'application/octet-stream' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = '2026-11-14T08:00:00Z'; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    if (/->>/.test(src) && v != null && typeof v !== 'object') v = String(v);
    out[alias] = v == null ? null : v;
  }
  return out;
};

async function contexte(b, vp, sombre, opts) {
  const ctx = await b.newContext({ viewport: vp, timezoneId: 'Europe/Paris', ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  await ctx.addInitScript(({ s, rel, soldes }) => { try { if (sessionStorage.getItem('banc_deja')) return; sessionStorage.setItem('banc_deja', '1');
    localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s));
    localStorage.setItem('vrm_visite_vue', JSON.stringify(true));
    localStorage.setItem('vrm_stats_ventes', JSON.stringify({ v: 1, l: rel, at: Date.now() }));
    localStorage.setItem('vrm_soldes', JSON.stringify(soldes));
  } catch (_) {} }, { s: !!sombre, rel: RELEVE, soldes: SOLDES });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  // Toute commande à l'extension (postMessage vers le pont) est COMPTÉE : aucune ne doit partir sans son clic.
  await pg.addInitScript(() => { const o = window.postMessage.bind(window); window.__vrmCmds = []; window.postMessage = (m, ...r) => { try { if (m && (m.cmd || (m.payload && m.payload.cmd))) window.__vrmCmds.push(m.cmd || m.payload.cmd); } catch (_) {} return o(m, ...r); }; });
  await pg.clock.install({ time: new Date(MAINTENANT) });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') {
      let rendu = '[]';
      try {
        const corps = JSON.parse(route.request().postData() || 'null');
        if (/id=eq\.main/.test(u) && corps && !Array.isArray(corps) && corps.data) { opts.main = { ...opts.main, ...corps.data }; rendu = JSON.stringify([{ id: 'main', data: opts.main }]); }
      } catch (_) {}
      return route.fulfill({ status: route.request().method() === 'PATCH' ? 200 : 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: rendu });
    }
    if (/select=owner&limit=1/.test(u)) return j([{ owner: 'x' }]);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: '2026-11-14T08:00:00Z', cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq && eq[1] === 'main') return j([forme({ id: 'main', data: opts.main })]);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const dans = /[?&]id=in\.\(([^)]*)\)/.exec(u);
    if (dans) { const ids = dans[1].split(','); return j(ROWS.filter((r) => ids.includes(r.id)).map(forme)); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  // Le lien comptable : la route du serveur, simulée (la règle est exécutée par audit-argent-prix).
  opts.lien = { actif: false };
  await pg.route('**/api/compte?mode=comptable*', async (r) => {
    const q = r.request(), u = new URL(q.url());
    if (u.searchParams.get('j')) return r.fulfill({ status: u.searchParams.get('j') === JETON ? 200 : 404, contentType: 'application/json', body: JSON.stringify(u.searchParams.get('j') === JETON ? VUE_COMPTABLE : { erreur: 'lien', raison: 'coupe' }) });
    if (q.method() === 'POST') {
      const c = JSON.parse(q.postData() || '{}');
      opts.postsComptable = (opts.postsComptable || []).concat(c.action);
      if (c.action === 'creer') opts.lien = { actif: true, url: 'https://vrm.center/c/' + JETON, exp: NOW + c.jours * J, periodes: [{ periode: c.vue.periode, libelle: c.vue.libelle, publieLe: iso(NOW) }], acces: [] };
      if (c.action === 'couper') opts.lien = { actif: false };
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, ...opts.lien }) });
  });
  return { ctx, pg, errs };
}
const aller = async (pg, tab, repere, ms = 1800) => {
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  if (repere) await pg.waitForFunction((r) => document.querySelector(r) || /pas pu s'afficher|n’a pas pu s’afficher/.test(document.body.innerText), repere, { timeout: 30000 }).catch(() => {});
  await pg.waitForTimeout(ms);
};
const touche = async (pg, sel, vp) => { const l = pg.locator(sel).first(); await l.scrollIntoViewIfNeeded(); if (vp.width < 600) await l.tap(); else await l.click(); };
const attrs = (pg, sel, pref) => pg.evaluate(([s, p]) => { const e = document.querySelector(s); if (!e) return null; const o = {}; for (const a of e.getAttributeNames()) if (a.startsWith(p)) o[a.slice(p.length)] = e.getAttribute(a); return o; }, [sel, pref]);
const sain = async (pg, ecran) => {
  const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, t: document.body.innerText }));
  dit(r.sw <= r.cw + 1, `${ecran} : aucun débordement horizontal`, `${r.sw} > ${r.cw}`);
  const m = /n'a pas pu s'afficher|n’a pas pu s’afficher|Cannot access|is not defined/.exec(r.t);
  dit(!m, `${ecran} : l'écran n'est pas tombé sur le garde-fou`, m && m[0]);
};
const regles7 = (pg, sel) => pg.evaluate((s) => {
  const racine = document.querySelector(s); if (!racine) return { absent: true };
  const sortent = [];
  for (const c of racine.querySelectorAll('.vrm-ac-carte')) { const r = c.getBoundingClientRect(); for (const e of c.querySelectorAll('*')) { const q = e.getBoundingClientRect(); if (q.width && (q.right > r.right + 1 || q.left < r.left - 1)) sortent.push((e.className || e.tagName) + ''); } }
  const bleus = [];
  for (const e of racine.querySelectorAll('.vrm-ac-montant, .vrm-ac-chiffre, .vrm-ac-prix')) { const m = /rgb\((\d+), (\d+), (\d+)/.exec(getComputedStyle(e).color); if (m && +m[3] > 180 && +m[1] < 60) bleus.push(e.textContent); }
  return { sortent: sortent.slice(0, 4), bleus: bleus.slice(0, 4) };
}, sel);

(async () => {
  const PV = await import(pathToFileURL(path.join(__dirname, '..', '..', 'src', 'prixVoulu.js')).href);
  const attenduEbay = Math.ceil(PV.prixPourNet(8000, 1290) / 100) * 100;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch(() => chromium.launch());
  try {
    for (const [vp, sombre, nom] of [[{ width: 390, height: 844 }, false, '390-clair'], [{ width: 390, height: 844 }, true, '390-sombre'], [{ width: 1512, height: 982 }, false, '1512-clair'], [{ width: 1512, height: 982 }, true, '1512-sombre']]) {
      if (VUES && !VUES.includes(nom)) continue;
      console.log(`\n══ ${nom}`);
      const opts = { main: mainDe() };
      const { ctx, pg, errs } = await contexte(b, vp, sombre, opts);
      const shot = async (sel, f) => { if (!SHOTS) return; const l = pg.locator(sel).first(); if (await l.count()) { await l.scrollIntoViewIfNeeded().catch(() => {}); await pg.waitForTimeout(250); await l.screenshot({ path: path.join(SHOTS, `${f}-${nom}.png`) }).catch(() => {}); } };

      await essaie('A. Statistiques', async () => {
        console.log('── A. Argent → Statistiques');
        await aller(pg, 'dashboard', '[data-prix-voulu]', 2500);
        await pg.evaluate(() => { const e = document.querySelector('[data-stats-carte="sv-offres"]'); if (e) e.scrollIntoView(); });
        await pg.waitForFunction(() => { const e = document.querySelector('[data-taux-offres]'); return e && e.getAttribute('data-taux-offres') !== 'encours'; }, null, { timeout: 25000 }).catch(() => {});
        const to = await attrs(pg, '[data-taux-offres]', 'data-to-');
        const etatTo = await pg.evaluate(() => { const e = document.querySelector('[data-taux-offres]'); return e && e.getAttribute('data-taux-offres'); });
        dit(etatTo === 'lu' && to && to.recues === '10' && to.acceptees === '8' && to.payees === '5' && to['taux-acc'] === '80' && to['taux-pay'] === '62.5', '113 : 10 reçues, 8 acceptées (80 %), 5 payées — par la transaction de la conversation (62,5 %)', JSON.stringify({ etatTo, to }));
        await shot('[data-taux-offres]', 'offres');
        await pg.fill('[data-pv-net]', '80');
        await pg.waitForTimeout(400);
        const pv = await pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-pv-site]')].map((e) => [e.getAttribute('data-pv-site'), { a: e.getAttribute('data-pv-arrondi'), p: e.getAttribute('data-pv-prix'), n: e.getAttribute('data-pv-net-arrondi'), e: e.getAttribute('data-pv-etat') }])));
        dit(pv.Vinted && pv.Vinted.a === '8000' && pv.Leboncoin && pv.Leboncoin.a === '8000', '122 : 80 € voulus ⇒ Vinted 80 €, Leboncoin 80 € (aucune commission au vendeur)', JSON.stringify(pv));
        dit(pv.eBay && Number(pv.eBay.a) === attenduEbay && pv.eBay.e === 'environ' && Number(pv.eBay.n) >= 8000, `122 : eBay au taux LU de ses commandes (12,9 %) ⇒ ${attenduEbay / 100} €, et il touche au moins 80 €`, JSON.stringify(pv.eBay));
        dit(pv.Vestiaire && pv.Vestiaire.e === 'pasLu' && pv.Vestiaire.a === '', '122 : Vestiaire pas lu ⇒ « — », jamais un taux deviné', JSON.stringify(pv.Vestiaire));
        const r7 = await regles7(pg, '[data-prix-voulu]');
        dit(r7 && !r7.absent && !r7.sortent.length && !r7.bleus.length, '122 : rien ne sort de sa carte ; aucun montant en bleu', JSON.stringify(r7));
        await shot('[data-prix-voulu]', 'prix-voulu');
        await touche(pg, '[data-ecarts-ouvrir]', vp);
        await pg.waitForSelector('[data-ecarts-feuille]', { timeout: 15000 }).catch(() => {});
        await pg.waitForFunction(() => { const e = document.querySelector('[data-ecarts-feuille]'); return e && e.getAttribute('data-ecarts-feuille') !== ''; }, null, { timeout: 20000 }).catch(() => {});
        const ec = await pg.evaluate(() => { const e = document.querySelector('[data-ecarts-feuille]'); return e ? e.getAttribute('data-ecarts-feuille') : null; });
        dit(ec !== null && ec !== '', '121 : « Vérifier mes prix » ouvre la feuille, lue (par identité)', String(ec));
        const ecN = await pg.evaluate(() => [...document.querySelectorAll('[data-ecart-num]')].map((e) => `${e.getAttribute('data-ecart-num')}:${e.getAttribute('data-ecart-cts')}:${e.getAttribute('data-ecart-voulu')}`).join(' '));
        dit(ecN === '2:1500:0', '121 : le N°2 (Vinted 80 €, Leboncoin 95 €) est signalé, 15 € ; le N°3 au même prix ne l’est pas', ecN);
        await shot('[data-ecarts-feuille]', 'ecarts');
        await pg.keyboard.press('Escape').catch(() => {});
        await pg.waitForTimeout(500);
        await sain(pg, 'Statistiques');
      });

      await essaie('B. Déclarer', async () => {
        console.log('── B. Argent → Déclarer');
        await aller(pg, 'argent_declarer', '[data-revision]', 2500);
        const rv = await attrs(pg, '[data-revision]', 'data-rev-');
        const etatR = await pg.evaluate(() => { const e = document.querySelector('[data-revision]'); return e && e.getAttribute('data-revision'); });
        dit(etatR === 'lu' && rv && rv.n === '3' && rv.achat === '2' && rv.versement === '1' && rv.relier === '1', '116 : octobre, 3 ventes à compléter (2 prix d’achat, 1 versement, 1 pas reliée)', JSON.stringify({ etatR, rv }));
        const portes = await pg.evaluate(() => [...document.querySelectorAll('[data-rev-ouvrir]')].map((e) => e.getAttribute('data-rev-ouvrir')).join(','));
        dit(portes === 'achat,versement,achat', '116 : chaque ligne ouvre la porte de son premier manque', portes);
        const r7 = await regles7(pg, '[data-revision]');
        dit(r7 && !r7.absent && !r7.sortent.length && !r7.bleus.length, '116 : rien ne sort de sa carte ; aucun montant en bleu', JSON.stringify(r7));
        await shot('[data-revision]', 'revision');
        const prep = await pg.$('[data-export-preparer]');
        if (prep) await touche(pg, '[data-export-preparer]', vp);
        await pg.waitForSelector('[data-lien-comptable="aucun"]', { timeout: 20000 }).catch(() => {});
        await pg.waitForFunction(() => { const e = document.querySelector('[data-lc-creer]'); return e && !e.disabled; }, null, { timeout: 25000 }).catch(() => {});
        await touche(pg, '[data-lc-creer]', vp);
        await pg.waitForSelector('[data-lc-url]', { timeout: 10000 }).catch(() => {});
        const url = await pg.evaluate(() => { const e = document.querySelector('[data-lc-url]'); return e ? e.textContent : ''; });
        dit(/^https:\/\/vrm\.center\/c\//.test(url) && (opts.postsComptable || []).includes('creer'), '115 : « Créer le lien » (sur son clic) ⇒ l’adresse /c/… affichée', url);
        await shot('[data-lien-comptable]', 'lien-comptable');
        await touche(pg, '[data-lc-couper]', vp);
        await pg.waitForSelector('[data-lien-comptable="aucun"]', { timeout: 10000 }).catch(() => {});
        dit((opts.postsComptable || []).includes('couper') && await pg.$('[data-lien-comptable="aucun"]'), '115 : « Couper le lien » ⇒ plus de lien');
        await sain(pg, 'Déclarer');
      });

      await essaie('C. Ma journée', async () => {
        console.log('── C. Ma journée : un solde fini');
        await aller(pg, 'journee', '[data-soldes-journee]', 2500);
        const n = await pg.evaluate(() => { const e = document.querySelector('[data-soldes-journee]'); return e ? e.getAttribute('data-soldes-journee') : null; });
        dit(n === '2', '114 : le solde a fini le 10 nov. ⇒ Ma journée PROPOSE « Remettre les prix » (2)', String(n));
        await shot('[data-soldes-journee]', 'soldes-journee');
        await touche(pg, '[data-soldes-ouvrir]', vp);
        await pg.waitForSelector('[data-remise-soldes]', { timeout: 15000 }).catch(() => {});
        await pg.waitForTimeout(3000);
        const lignes = await pg.evaluate(() => [...document.querySelectorAll('[data-remise-ligne]')].map((e) => `${e.getAttribute('data-remise-ligne')}:${e.getAttribute('data-remise-action')}:${e.getAttribute('data-remise-etat')}`));
        dit(lignes.length === 2 && lignes.every((l) => /:$/.test(l)), '114 : la feuille liste les 2 paires ; RIEN n’est lancé à l’ouverture', lignes.join(' '));
        const cmds = await pg.evaluate(() => (window.__vrmCmds || []).filter((c) => /Prix|prix/.test(String(c))));
        dit(!cmds.length, '114 : aucune commande de prix envoyée sans « Remettre N prix »', cmds.join(','));
        const ext = await pg.$('[data-remise-ext]'), dis = await pg.evaluate(() => { const e = document.querySelector('[data-remise-lancer]'); return e ? e.disabled : null; });
        dit(dis === true || !!ext, '114 : sans extension prête, le bouton est éteint et la raison dite', JSON.stringify({ dis, ext: !!ext }));
        await shot('[data-remise-soldes]', 'remise');
        await pg.keyboard.press('Escape').catch(() => {});
        await sain(pg, 'Ma journée');
      });

      await essaie('E. Litiges', async () => {
        console.log('── E. Ventes → Litiges : deux taux par modèle');
        await pg.waitForTimeout(1500);
        try { await aller(pg, 'litiges', '[data-retours-modeles]', 3000); } catch (_) { await pg.waitForTimeout(2000); await aller(pg, 'litiges', '[data-retours-modeles]', 3000); }
        await pg.waitForFunction(() => { const e = document.querySelector('[data-retours-modeles]'); return e && e.getAttribute('data-retours-modeles') === 'lu'; }, null, { timeout: 25000 }).catch(() => {});
        const d = await attrs(pg, '[data-retours-modele="nike|dunk"]', 'data-');
        dit(d && d['ventes-n'] === '10' && d['n-retours'] === '2' && d['n-litiges'] === '1' && d['taux-retour'] === '20' && d['taux-litige'] === '10', '112 : Dunk — 2 retours (20 %) et 1 litige (10 %) sur 10 ventes, chacun à part', JSON.stringify(d));
        const s = await attrs(pg, '[data-retours-modele="adidas|samba"]', 'data-');
        dit(s && s['ventes-n'] === '2' && s['taux-retour'] === '', '112 : Samba, 2 ventes ⇒ taux « — » (trop peu pour un taux)', JSON.stringify(s));
        await shot('[data-retours-modeles]', 'retours');
        await sain(pg, 'Litiges');
      });
      dit(!errs.length, 'aucune erreur d’app', errs.join(' | ').slice(0, 300));
      await ctx.close();

      await essaie('D. Page du comptable', async () => {
        console.log('── D. La page du comptable');
        const { ctx: c2, pg: p2, errs: e2 } = await contexte(b, vp, sombre, { main: mainDe() });
        await p2.goto(`http://localhost:${PORT}/?comptable=${JETON}`, { waitUntil: 'domcontentloaded' });
        await p2.waitForSelector('[data-vue-comptable="lu"]', { timeout: 20000 }).catch(() => {});
        const v = { ...(await attrs(p2, '[data-vue-comptable]', 'data-')), ...(await attrs(p2, '[data-vc-ca]', 'data-')) };
        const t = await p2.evaluate(() => document.body.innerText);
        dit(v && v['vue-comptable'] === 'lu' && v['vc-ca'] === '24500' && /Atelier inventé/.test(t), '115 : la page lit la compta (CA 245 €), sans l’app ni session', JSON.stringify(v));
        dit(!/atelier_inventé_aux_longs_noms|ma_boutique_ebay/.test(t), '115 : aucun pseudo de compte sur la page');
        const appli = await p2.evaluate(() => !!document.querySelector('[data-ecran], nav[aria-label], .vrm-coque'));
        dit(!appli, '115 : l’app ne s’ouvre pas sur ce lien (lecture seule)');
        if (SHOTS) await p2.screenshot({ path: path.join(SHOTS, `comptable-${nom}.png`), fullPage: false }).catch(() => {});
        await sain(p2, 'Page du comptable');
        await p2.goto(`http://localhost:${PORT}/?comptable=${JETON.replace(/^a/, 'z')}`, { waitUntil: 'domcontentloaded' });
        await p2.waitForSelector('[data-vue-comptable="lien"]', { timeout: 15000 }).catch(() => {});
        dit(!!(await p2.$('[data-vue-comptable="lien"]')), '115 : lien coupé ou inconnu (404) ⇒ « Ce lien n’est plus valable »');
        dit(!e2.length, 'page du comptable : aucune erreur', e2.join(' | ').slice(0, 200));
        await c2.close();
      });
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} argent-prix : ${ko} rouge(s), ${ok} vert(s)`);
  process.exit(ko ? 1 : 0);
})();
