// ═══════════════════════════════════════════════════════════════════════════
// BANC : LES QUATRE CHOIX D'ARGENT (14 nov., lot argent-choix)
//   75 coller « N° ; prix » · 80 modèle et taille · 81 objectif (reçu, € par jour)
//   82 déclaration de revenus prête, avec sa source.
// Données INVENTÉES (dépôt public), horloge au 14 nov. 2026 10 h (Paris), 390 px
// tactile et 1512 px, clair et sombre. On juge la RÈGLE (data-* et nombres rendus) :
//   A. Argent → Statistiques : « Modèle et taille » sur les ventes RELIÉES seulement
//      (couverture 96 / 126), Dunk · 42 = 600 € (10 × 60), « à racheter » = Dunk · 42 ;
//      l'objectif sur le REÇU : 700 € de 2 000 €, 77 €/jour d'ici le 30, 17 jours ;
//   B. Argent → Déclarer : 12 340 € en case 5KO, source 340 ventes (336 + 4 à dater
//      prouvées), par site, 12 à dater hors total ; sans réponse au versement
//      libératoire : les DEUX cases ;
//   C. Ventes → « Coût d'achat » → « Coller un tableau » : aperçu ligne par ligne,
//      « Enregistrer 4 prix » écrit 4 fiches (rien d'écrasé), parti au nuage ;
//   D. base injoignable (main en panne) : la feuille dit « pas chargées », AUCUNE écriture ;
//   E. trouvable : touchers depuis Ma journée (390) ; aucun débordement ; aucun accent
//      sur un montant ; aucune erreur d'app.
// Lancer : npm run build && BANC_PORT=47xx node scripts/bancs/argent-choix.cjs  (SHOTS=<dossier>, VUES=390-clair,…)
require('./_porte-banc.cjs');
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4791);
const SHOTS = process.env.SHOTS || '';
const VUES = process.env.VUES ? process.env.VUES.split(',') : null;
const MAINTENANT = '2026-11-14T10:00:00+01:00';
const NOW = Date.parse(MAINTENANT);
const J = 86400000;
const A = '111';
const ACCOUNTS = [{ id: 1, vinted_user_id: A, login: 'atelier_inventé_aux_longs_noms_de_boutique', domain: 'www.vinted.fr', updated_at: '2026-11-14T08:00:00Z' }];

// ── Le relevé de la période (novembre) : [plateforme, compte, tx, ts, vente, achat, frais, titre, N°, versement]
const GROUPES = [
  // titre, marque, taille, n reliées, vente, achat, délais (j), n sans achat
  ['Nike Dunk Low Panda inventée taille 42', 'Nike', '42', 10, 120, 60, [2, 3, 3, 4, 4, 5, 5, 6, 6, 7], 4],
  ['Adidas Samba OG inventée taille 40', 'Adidas', '40', 12, 90, 50, [9, 10, 10, 11, 12, 12, 13, 13, 14, 14, 15, 16], 6],
  ['New Balance 550 inventée taille 43', 'New Balance', '43', 8, 100, 80, [1, 2, 2, 3, 3, 3, 4, 4], 2],
  ['Asics Gel-Kayano 14 inventée taille 41', 'Asics', '41', 9, 150, 70, [20, 22, 24, 25, 25, 26, 28, 30, 31], 3],
  ['Salomon XT-6 inventée taille 44', 'Salomon', '44', 7, 130, 85, [5, 6, 7, 7, 8, 9, 9], 5],
  ['Nike Air Force 1 inventée taille 45', 'Nike', '45', 6, 70, 40, [3, 3, 4, 4, 5, 5], 4],
  ['Paire inventée sans modèle taille 42', '', '42', 44, 40, 25, null, 6],
];
const RELEVE = [], LISTINGS = [], TXN = [];
let tx = 70000;
for (const [titre, marque, taille, n, eur, achat, delais, sans] of GROUPES) {
  for (let i = 0; i < n + sans; i++) {
    tx += 1;
    const ts = NOW - ((tx % 12) + 1) * J - 3600e3;                 // du 2 au 13 novembre
    const relie = i < n;
    const d = delais ? delais[i % delais.length] : 5;
    RELEVE.push(['Vinted', ACCOUNTS[0].login, String(tx), ts, eur, relie ? achat : null, null, titre, '', new Date(ts + J).toISOString()]);
    const item = tx + 500000;
    LISTINGS.push({ id: item, title: titre, brand_title: marque || undefined, size_title: taille, created_at_ts: Math.round((ts - d * J) / 1000) });
    TXN.push({ id: `harvest_${A}_txn_${tx}`, data: { capturedAt: '2026-11-14T08:00:00Z', payload: { transaction: { id: tx, item_id: item, status: 450, status_title: 'Commande finalisée', status_updated_at: new Date(ts + J).toISOString() } } } });
  }
}
// Attendu (règle : ventes RELIÉES seulement) : 96 reliées sur 126 ; Dunk · 42 = 10 × 60 = 600 €.
// Classables (≥ 3) : 6 groupes nommés ; médiane des « par paire » (60, 40, 20, 80, 45, 30) = 42,50 ;
// médiane des délais (4,5 · 12,5 · 3 · 25 · 7 · 4) = 5,75 ⇒ « à racheter » = Dunk · 42 seule (80 € mais 25 j ; 45 € mais 7 j).

// ── La ligne publiée par Ventes (`vinted_urssaf_mois`) : 2026 = 12 340 € (12 180 € datés + 4 à dater prouvées 160 €).
const LIGNE = {
  at: NOW - 3600e3, sources: { Vinted: 'lu', Leboncoin: 'lu', eBay: 'lu', Vestiaire: 'lu' },
  mois: [
    { ym: '2026-11', n: 20, ca: 700, par: { Vinted: { n: 20, ca: 700 } } },
    { ym: '2026-10', n: 100, ca: 3800, par: { Vinted: { n: 80, ca: 3000 }, Leboncoin: { n: 20, ca: 800 } } },
    { ym: '2026-09', n: 200, ca: 7340, par: { Vinted: { n: 190, ca: 7000 }, eBay: { n: 10, ca: 340 } } },
    { ym: '2026-03', n: 16, ca: 340, par: { Vinted: { n: 16, ca: 340 } } },
    { ym: '2025-12', n: 50, ca: 2000, par: { Vinted: { n: 50, ca: 2000 } } },
  ],
  aDater: { n: 16, ca: 610, par: { Vinted: { n: 16, ca: 610 } }, annees: { 2026: { n: 4, ca: 160 } } },
  recu: { '2026-11': 700, '2026-10': 3800, '2026-09': 7340, '2026-08': 0 }, recuJours: {}, ecartees: 0, nonComptees: { n: 0, par: {} },
};
// ── Les fiches (N° 1 à 184) : N°7 a déjà 50 € ; aucune autre n'a de prix.
const FICHES = {};
for (let i = 1; i <= 184; i++) FICHES[String(900000 + i)] = { numero: String(i), title: `Paire inventée N°${i} taille 42`, numberedAt: '2026-10-20T10:00:00Z', accountId: A, ...(i === 7 ? { buyPrice: '50' } : {}) };
const OBJECTIF = { v: 1, type: 'recu', valeur: 2000, cache: {}, parMois: { '2026-11': { type: 'recu', valeur: 2000 } } };
const mainDe = (x = {}) => ({ vinted_regime: 'micro', vinted_urssaf_taux: 12.3, vinted_urssaf_freq: 'mensuel', vrm_micro_options: { liberatoire: 'non', acre: false, at: NOW - 30 * J },
  vinted_urssaf_mois: LIGNE, vrm_objectif_mois: OBJECTIF, vinted_annonce_numeros: FICHES, vrm_visite_vue: true, ...x });
const VENTES = RELEVE.slice(0, 60).map((r) => ({ transaction_id: Number(r[2]), title: r[7], price: { amount: String(r[4]), currency_code: 'EUR' }, status: 'Commande finalisée', transaction_user_status: 'completed', date: new Date(r[3]).toISOString() }));
const ROWS = [
  { id: `harvest_${A}_orders_sold`, data: { capturedAt: '2026-11-14T08:00:00Z', payload: { my_orders: VENTES } } },
  { id: `harvest_${A}_listings`, data: { capturedAt: '2026-11-14T08:00:00Z', payload: { items: LISTINGS, pagination: null } } },
  ...TXN,
  { id: 'lbc_ventes', data: { ventes: {} } },
  { id: 'ebay_orders', data: { orders: [] } },
];

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
  await ctx.addInitScript(({ s, rel }) => { try { if (sessionStorage.getItem('banc_deja')) return; sessionStorage.setItem('banc_deja', '1');
    localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s));
    localStorage.setItem('vrm_visite_vue', JSON.stringify(true));
    localStorage.setItem('vrm_stats_ventes', JSON.stringify({ v: 1, l: rel, at: Date.now() }));
  } catch (_) {} }, { s: !!sombre, rel: RELEVE });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: new Date(MAINTENANT) });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') {
      if (process.env.BANC_DEBUG) console.log('   POST', route.request().method(), u.slice(0, 140), String(route.request().postData() || '').slice(0, 160));
      // `main` s'écrit par PATCH (comparer-et-échanger sur `rev`) : la ligne est GARDÉE et rendue (§6.3).
      let rendu = '[]';
      try {
        const corps = JSON.parse(route.request().postData() || 'null');
        const surMain = /id=eq\.main/.test(u) && corps && !Array.isArray(corps) && corps.data && typeof corps.data === 'object';
        if (surMain) { opts.main = { ...opts.main, ...corps.data }; opts.ecrits = (opts.ecrits || 0) + 1; rendu = JSON.stringify([{ id: 'main', data: opts.main }]); }
        for (const x of [].concat(corps || [])) if (x && x.id === 'main' && x.data && typeof x.data === 'object') { opts.main = x.data; opts.ecrits = (opts.ecrits || 0) + 1; }
      } catch (_) {}
      return route.fulfill({ status: route.request().method() === 'PATCH' ? 200 : 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: rendu });
    }
    if (/select=owner&limit=1/.test(u)) return j([{ owner: 'x' }]);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: '2026-11-14T08:00:00Z', cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq && eq[1] === 'main') {
      if (opts.mainKO) return route.fulfill({ status: 522, contentType: 'text/html', headers: { 'access-control-allow-origin': '*' }, body: '<html>522</html>' });
      return j([forme({ id: 'main', data: opts.main })]);
    }
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const dans = /[?&]id=in\.\(([^)]*)\)/.exec(u);
    if (dans) { const ids = dans[1].split(','); return j(ROWS.filter((r) => ids.includes(r.id)).map(forme)); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
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
// Rien ne déborde de sa carte, et aucun montant ne porte l'accent (§7 : l'accent est aux actions).
const regles7 = (pg, sel) => pg.evaluate((s) => {
  const racine = document.querySelector(s); if (!racine) return { absent: true };
  const sortent = [];
  for (const c of racine.querySelectorAll('.vrm-ac-carte')) { const r = c.getBoundingClientRect(); for (const e of c.querySelectorAll('*')) { const q = e.getBoundingClientRect(); if (q.width && (q.right > r.right + 1 || q.left < r.left - 1)) sortent.push((e.className || e.tagName) + ''); } }
  const bleus = [];
  for (const e of racine.querySelectorAll('.vrm-ac-montant, .vrm-ac-chiffre, .vrm-ac-affiche, .vrm-ac-site-eur, .vrm-ac-prix')) { const m = /rgb\((\d+), (\d+), (\d+)/.exec(getComputedStyle(e).color); if (m && +m[3] > 180 && +m[1] < 60) bleus.push(e.textContent); }
  return { sortent: sortent.slice(0, 4), bleus: bleus.slice(0, 4) };
}, sel);
// À combien d'écrans de défilement depuis le haut de la page : la position DANS le conteneur qui défile.
const ecranDe = (pg, sel) => pg.evaluate((s) => {
  const e = document.querySelector(s); if (!e) return null;
  let c = e.parentElement; while (c && !(c.scrollHeight > c.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(c).overflowY))) c = c.parentElement;
  const top = c ? e.getBoundingClientRect().top - c.getBoundingClientRect().top + c.scrollTop : e.getBoundingClientRect().top + window.scrollY;
  return Math.round((top / window.innerHeight) * 10) / 10;
}, sel);
const COLLE = ['N° ; Prix', '1 ; 60', '007 ; 55', '2 ; 45,50', '3 ;', '999 ; 10', '4 ; 30', '4 ; 30', '5 ; 30', '5 ; 31', '6\t70 €', '8 ; Nike Dunk ; 40'].join('\n');
const ouvrirSaisie = async (pg, vp) => {
  await pg.evaluate(() => { const b = [...document.querySelectorAll('button, summary')].find((x) => /Analyse de tes ventes/.test(x.textContent) && /voir/i.test(x.textContent)); if (b) b.click(); });
  await pg.waitForTimeout(500);
  const sel = await pg.evaluate(() => {
    const vis = (e) => e && e.getBoundingClientRect().height > 0;
    for (const s of ['[data-ventes-achats-completer]', '[data-ann-achats-completer]', '[data-ar-serie]']) if (vis(document.querySelector(s))) return s;
    const b = [...document.querySelectorAll('button')].find((x) => /prix d'achat/i.test(x.title || '') && /Coût d'achat|Bénéfice/.test(x.textContent) && vis(x));
    if (b) { b.setAttribute('data-banc-cout', ''); return '[data-banc-cout]'; }
    return null;
  });
  if (!sel) return 0;
  await touche(pg, sel, vp);
  await pg.waitForSelector('[data-fillbuy-feuille]', { timeout: 15000 }).catch(() => {});
  return (await pg.$('[data-fillbuy-feuille]')) ? 1 + (sel === '[data-banc-cout]' ? 1 : 0) : 0;
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch(() => chromium.launch());
  try {
    for (const [vp, sombre, nom] of [[{ width: 390, height: 844 }, false, '390-clair'], [{ width: 390, height: 844 }, true, '390-sombre'], [{ width: 1512, height: 982 }, false, '1512-clair'], [{ width: 1512, height: 982 }, true, '1512-sombre']]) {
      if (VUES && !VUES.includes(nom)) continue;
      console.log(`\n══ ${nom}`);
      const opts = { main: mainDe() };
      const { ctx, pg, errs } = await contexte(b, vp, sombre, opts);
      const shot = async (sel, f) => { if (!SHOTS) return; const l = pg.locator(sel).first(); if (await l.count()) { await l.scrollIntoViewIfNeeded().catch(() => {}); await pg.waitForTimeout(250); await l.screenshot({ path: path.join(SHOTS, `${f}-${nom}.png`) }).catch(() => {}); } };

      await essaie('A. Statistiques', async () => {
        console.log('── A. Argent → Statistiques : modèle et taille, l’objectif sur le reçu');
        await aller(pg, 'dashboard', '[data-stats-carte="sv-racheter"]', 2500);
        await pg.waitForFunction(() => { const e = document.querySelector('[data-stats-carte="sv-racheter"]'); return e && e.getAttribute('data-qr-etat') === 'lu'; }, null, { timeout: 20000 }).catch(() => {});
        const q = await attrs(pg, '[data-stats-carte="sv-racheter"]', 'data-qr-');
        dit(q && q.etat === 'lu' && q.reliees === '96' && q.n === '126' && q.autres === '44', 'sur les ventes RELIÉES seulement : 96 sur 126 (44 sans modèle sûr dites à part)', JSON.stringify(q));
        const dunk = await attrs(pg, '[data-qr-ligne="nike|dunk|42"]', 'data-');
        dit(dunk && dunk.n === '10' && dunk.brut === '60000' && dunk.moyen === '6000' && dunk.marge === '50' && dunk.mediane === '4.5', 'Nike Dunk · 42 : 10 reliées (les 4 sans achat n’y entrent pas), 600 €, 60 €/paire, marge 50 %, 4,5 j', JSON.stringify(dunk));
        const ra = await attrs(pg, '[data-qr-racheter]', 'data-qr-');
        dit(ra && ra.racheter === 'nike|dunk|42', '« À racheter » = rentable ET rapide : Nike Dunk · 42 seule', JSON.stringify(ra));
        const ordre = await pg.evaluate(() => [...document.querySelectorAll('[data-qr-ligne]')].map((e) => e.getAttribute('data-qr-ligne')).join(','));
        dit(ordre.startsWith('asics|gel-kayano|41,nike|dunk|42'), 'trié par bénéfice total (Kayano 720 €, Dunk 600 €…)', ordre);
        await touche(pg, '[data-qr-tri="vite"]', vp);
        await pg.waitForTimeout(400);
        const ordreV = await pg.evaluate(() => [...document.querySelectorAll('[data-qr-ligne]')].map((e) => e.getAttribute('data-qr-ligne'))[0]);
        dit(ordreV === 'new balance|550|43', 'tri « Vite » : la 550 (3 j) en tête', ordreV);
        const r7 = await regles7(pg, '[data-stats-carte="sv-racheter"]');
        dit(r7 && !r7.absent && !r7.sortent.length && !r7.bleus.length, 'rien ne sort de sa carte ; aucun montant en bleu', JSON.stringify(r7));
        await shot('[data-stats-carte="sv-racheter"]', 'racheter');
        // L'objectif sur le reçu.
        const o = await attrs(pg, '[data-objectif-detail-reste]', 'data-objectif-');
        const blocType = await pg.evaluate(() => { const e = document.querySelector('[data-objectif-bloc]'); return e && e.getAttribute('data-objectif-bloc'); });
        const v = await attrs(pg, '[data-objectif-valeur]', 'data-objectif-');
        dit(blocType === 'recu' && v && v.valeur === '70000' && v.pct === '35', 'objectif sur le REÇU : 700 € de 2 000 € (la case « Reçu » du mois)', JSON.stringify({ blocType, v }));
        dit(o && o['par-jour'] === '7700' && o.jours === '17' && o.reste === '130000', '« 77 € par jour d’ici le 30 » : 1 300 € en 17 jours', JSON.stringify(o));
        const mes = await pg.evaluate(() => { const e = document.querySelector('[data-objectif-mesure]'); return e ? e.getAttribute('data-objectif-mesure') + '|' + e.textContent : ''; });
        dit(/^recu\|.*versement/.test(mes), 'la mesure est DITE (sur le reçu : la date du versement)', mes);
        await shot('[data-objectif-bloc]', 'objectif');
        await sain(pg, 'Statistiques');
      });

      await essaie('B. Déclarer', async () => {
        console.log('── B. Argent → Déclarer : la déclaration de revenus, avec sa source');
        await aller(pg, 'argent_declarer', '[data-dr-etat]', 2000);
        const d = await attrs(pg, '[data-dr-etat]', 'data-dr-');
        dit(d && d.etat === 'partiel' && d.ca === '1234000' && d.cases === '5KO' && d.annee === '2026', '12 340 € en case 5KO (« au moins » : des ventes à dater)', JSON.stringify(d));
        dit(d && d.n === '340' && d['adater-sur'] === '4' && d['hors-adater'] === '12', 'source : 340 ventes reçues en 2026 (dont 4 vendues et finalisées dans l’année) ; 12 sans date hors total', JSON.stringify(d));
        const sites = await pg.evaluate(() => [...document.querySelectorAll('[data-dr-site]')].map((e) => `${e.getAttribute('data-dr-site')}:${e.getAttribute('data-n')}:${e.getAttribute('data-eur')}`).join(','));
        dit(sites === 'Vinted:306:1104000,Leboncoin:20:80000,eBay:10:34000,aDaterSur:4:16000', 'par site, des mêmes mois ; la somme recompose le montant', sites);
        const hors = await pg.evaluate(() => { const e = document.querySelector('[data-dr-hors-ligne="adater"]'); return e ? e.textContent : ''; });
        dit(/12/.test(hors) && /hors total/.test(hors), 'les 12 ventes sans date de versement sont DITES', hors);
        const r7 = await regles7(pg, '[data-dr-etat]');
        dit(r7 && !r7.absent && !r7.sortent.length && !r7.bleus.length, 'rien ne sort de sa carte ; aucun montant en bleu', JSON.stringify(r7));
        const vieux = await pg.evaluate(() => { const e = document.querySelector('[data-micro-impots]'); return e ? { t: e.textContent, voir: !!e.querySelector('[data-micro-impots-voir]') } : null; });
        dit(vieux && !/12\s?340/.test(vieux.t) && vieux.voir, 'la carte repliée de la micro-entreprise ne redit pas le montant : elle renvoie à la déclaration (§7)', JSON.stringify(vieux && vieux.t.slice(0, 120)));
        await shot('[data-dr-etat]', 'declaration');
        await sain(pg, 'Déclarer');
      });

      await essaie('C. Coller', async () => {
        console.log('── C. Ventes → Coût d’achat → « Coller un tableau »');
        await aller(pg, 'cat_ventes', '[data-nav-entree]', 3500);
        const t0 = await ouvrirSaisie(pg, vp);
        dit(t0 > 0, 'la saisie en série s’ouvre depuis le chiffre du coût d’achat', String(t0));
        dit(!!(await pg.$('[data-coller-ouvrir]')), '« Coller un tableau » est dans la saisie en série');
        await touche(pg, '[data-coller-ouvrir]', vp);
        await pg.waitForSelector('[data-coller-zone]', { timeout: 8000 });
        // Règle des 1 000 : 1 000 lignes collées ⇒ l'aperçu (200 rangées rendues, le reste compté) vite.
        const mille = Array.from({ length: 1000 }, (_, i) => `${(i % 184) + 1}\t${20 + (i % 40)},50`).join('\n');
        const tm = await pg.evaluate(async (txt) => {
          const z = document.querySelector('[data-coller-zone]'); const t0 = performance.now();
          const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(z, txt); z.dispatchEvent(new Event('input', { bubbles: true }));
          for (let i = 0; i < 200; i++) { if (document.querySelector('[data-coller-lignes="1000"]')) break; await new Promise((r) => setTimeout(r, 10)); }
          return { ms: Math.round(performance.now() - t0), rangees: document.querySelectorAll('[data-coller-ligne]').length };
        }, mille);
        dit(tm.rangees === 200 && tm.ms < 1500, `1 000 lignes collées : aperçu en ${tm.ms} ms, 200 rangées dessinées (le reste compté)`, JSON.stringify(tm));
        await pg.fill('[data-coller-zone]', COLLE);
        await pg.waitForTimeout(400);
        const lignes = await pg.evaluate(() => [...document.querySelectorAll('[data-coller-ligne]')].map((e) => e.getAttribute('data-coller-etat')).join(','));
        dit(lignes === 'entete,ok,different,ok,vide,inconnu,ok,doublon,conflit,conflit,ok,colonnes', 'aperçu ligne par ligne : reconnu, déjà un autre prix, vide, N° inconnu, collé deux fois, colonnes', lignes);
        const r = await attrs(pg, '[data-coller-resume]', 'data-');
        const btn = await attrs(pg, '[data-coller-enregistrer]', 'data-coller-');
        dit(r && r.ok === '4' && r.different === '1' && btn && btn.enregistrer === '4', '« Enregistrer 4 prix » (N°7 garde ses 50 € sans « Remplacer »)', JSON.stringify({ r, btn }));
        const avant = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vinted_annonce_numeros')); } catch (_) { return null; } });
        dit(avant && !avant['900001'].buyPrice, 'rien n’est écrit avant SON clic');
        await shot('[data-coller-prix]', 'coller-apercu');
        await touche(pg, '[data-coller-enregistrer]', vp);
        await pg.waitForSelector('[data-coller-ecrits]', { timeout: 8000 });
        const fait = await attrs(pg, '[data-coller-ecrits]', 'data-coller-');
        await pg.waitForTimeout(2600);
        const F = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vinted_annonce_numeros')); } catch (_) { return null; } });
        const prix = (k) => F && F[k] ? F[k].buyPrice : undefined;
        dit(fait && fait.ecrits === '4' && prix('900001') === '60,00' && prix('900002') === '45,50' && prix('900004') === '30,00' && prix('900006') === '70,00', '4 prix enregistrés sur les bonnes fiches (N°1, 2, 4, 6)', JSON.stringify({ fait, p: ['900001', '900002', '900004', '900006'].map(prix) }));
        dit(prix('900007') === '50' && !prix('900003') && !prix('900005') && !prix('900008'), 'rien d’écrasé : N°7 garde 50 € ; vide, conflit, colonnes : rien', JSON.stringify(['900007', '900003', '900005', '900008'].map(prix)));
        for (let i = 0; i < 40 && !(opts.main && opts.main.vinted_annonce_numeros && opts.main.vinted_annonce_numeros['900001'] && opts.main.vinted_annonce_numeros['900001'].buyPrice); i++) await pg.waitForTimeout(250);
        const nuage = opts.main && opts.main.vinted_annonce_numeros;
        dit(nuage && nuage['900001'] && nuage['900001'].buyPrice === '60,00' && opts.main.vinted_buyprice_by_num && opts.main.vinted_buyprice_by_num['6'] === '70,00', 'parti au nuage (fiches et prix par N°)', JSON.stringify(nuage && nuage['900001']));
        await shot('[data-coller-prix]', 'coller-fait');
      });

      await essaie('E. trouvable', async () => {
        if (vp.width > 600) return;
        console.log('── E. Trouvable depuis Ma journée (touchers)');
        const chemin = async (cible, etapes) => {
          await aller(pg, 'journee', '[data-nav-entree]', 2000);
          let n = 0;
          for (const s of etapes) {
            if (await pg.evaluate((c) => { const e = document.querySelector(c); return !!(e && e.getBoundingClientRect().height > 0); }, cible)) break;
            const vis = await pg.evaluate((x) => { const e = document.querySelector(x); return !!(e && e.getBoundingClientRect().height > 0); }, s);
            if (!vis) continue;
            await touche(pg, s, vp); n++; await pg.waitForTimeout(1600);
          }
          await pg.waitForFunction((c) => { const e = document.querySelector(c); return !!(e && e.getBoundingClientRect().height > 0); }, cible, { timeout: 10000 }).catch(() => {});
          const la = await pg.evaluate((c) => { const e = document.querySelector(c); return !!(e && e.getBoundingClientRect().height > 0); }, cible);
          return { n, la, ecrans: la ? await ecranDe(pg, cible) : null };
        };
        const vers = (seg) => ['.vrm-nav-more', '[data-nav-entree="compta"]', `[data-argent-nav] [data-section="${seg}"]`];
        const c82 = await chemin('[data-dr-etat]', vers('declarer'));
        dit(c82.la && c82.n <= 3, `déclaration annuelle : ${c82.n} touchers depuis Ma journée, à ${c82.ecrans} écran(s) de défilement`, JSON.stringify(c82));
        const c80 = await chemin('[data-stats-carte="sv-racheter"]', vers('stats'));
        dit(c80.la && c80.n <= 3, `modèle et taille : ${c80.n} touchers, à ${c80.ecrans} écran(s)`, JSON.stringify(c80));
        const c81 = await chemin('[data-objectif-bloc="recu"]', vers('stats'));
        dit(c81.la && c81.n <= 3 && c81.ecrans < 1.5, `objectif (€ par jour) : ${c81.n} touchers, à ${c81.ecrans} écran(s)`, JSON.stringify(c81));
        console.log(`  · mesure : 82 = ${c82.n} t / ${c82.ecrans} é · 80 = ${c80.n} t / ${c80.ecrans} é · 81 = ${c81.n} t / ${c81.ecrans} é`);
      });
      dit(!errs.length, 'aucune erreur d’app', errs.join(' | ').slice(0, 300));
      await ctx.close();

      await essaie('D. base injoignable', async () => {
        if (vp.width > 600 || sombre) return;
        console.log('── D. La base ne répond pas : aucune écriture');
        const o2 = { main: mainDe(), mainKO: true };
        const { ctx: c2, pg: p2 } = await contexte(b, vp, false, o2);
        await p2.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
        await p2.waitForTimeout(6000);
        const t = await ouvrirSaisie(p2, vp);
        if (t && await p2.$('[data-coller-ouvrir]')) {
          await touche(p2, '[data-coller-ouvrir]', vp);
          await p2.waitForSelector('[data-coller-zone]', { timeout: 8000 });
          await p2.fill('[data-coller-zone]', COLLE);
          await p2.waitForTimeout(400);
          const lec = await attrs(p2, '[data-coller-lecture]', 'data-coller-');
          const dis = await p2.evaluate(() => { const e = document.querySelector('[data-coller-enregistrer]'); return e ? e.disabled : null; });
          dit(lec && lec.lecture === 'ko' && dis === true, 'fiches pas chargées : c’est dit, « Enregistrer » est éteint', JSON.stringify({ lec, dis }));
        } else dit(true, 'base injoignable : la saisie ne s’ouvre même pas (rien à écrire)');
        await p2.waitForTimeout(1200);
        dit(!o2.ecrits, 'AUCUNE écriture vers la base', String(o2.ecrits || 0));
        await c2.close();
      });
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} argent-choix : ${ko} rouge(s), ${ok} vert(s)`);
  process.exit(ko ? 1 : 0);
})();
