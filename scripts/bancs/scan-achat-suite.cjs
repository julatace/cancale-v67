require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « LE COLIS D'ACHAT SCANNÉ : SON N° ET LE GESTE SUIVANT » (23 nov., lot scan-achat)
//  src/ScannerRetrouver.jsx (`FicheAchat`, `BlocNumero`) · règle src/scanAchatSuite.js · source src/ecrans/Comptabilite.jsx.
//  Julien (« fais tout parfaitement ») : scanner le bordereau d'un colis d'ACHAT ⇒ ce qu'il y a dedans, QUEL N° l'attend,
//  et le geste suivant — « Ranger en … », « Numéroter », ou la vente si la paire est déjà vendue.
//
//  L'app BÂTIE, Aujourd'hui → Scanner, caméra REFUSÉE ⇒ le n° est TAPÉ (le chemin d'un code lu). 390 tactile et 1512,
//  clair et sombre. Base INVENTÉE de la forme mesurée le 23 nov. (lecture seule) : `orders_purchased` (titre, prix
//  {amount}, date, photo, statut, conversation_id — aucun vendeur), `harvest_{uid}_suivi_{tx}` (25 % des achats récents
//  l'ont), AUCUNE transaction côté acheteur sauf une (mesuré : 0 sur 114 achats de 30 jours), `main` : fiches reliées
//  par `buyFromId`, meubles, cases, corrections de vente.
//   A  50 achats au MÊME titre : N°13 rangé (case notée) ⇒ « Rangé · Étagère A · rangée 2, colonne 3 », aucun « Ranger » ;
//      N°14 sans case ⇒ « Case prévue » = la 1re case LIBRE (la 1re est prise), plein « Ranger en Étagère A · R1 C2 » ⇒
//      l'écran d'arrivée de CET achat ; N°15 vendu (sa vente lue) ⇒ « déjà vendue », plein « Ouvrir la vente » ⇒ la
//      vente ; un achat au même titre sans fiche ⇒ « Numéroter » (jamais le N° d'un voisin) + « Relier à une vente » ⇒
//      la feuille d'Achats sur CET achat, rien d'écrit ;
//   L  un lot relié à 2 fiches ⇒ N°20 et N°21, deux cases différentes, « Ranger les 2 paires » ;
//   T  le n° de TRANSACTION tapé ⇒ CET achat (parmi 50) ; un n° voisin ⇒ aucune fiche ;
//   I  un n° inconnu ⇒ « Colis inconnu » + que faire, aucun lien posé.
//  Partout : un seul plein, cibles ≥ 44 px, rien ne déborde, aucune clé de traduction brute, aucune erreur.
//  Lancer : BANC_DIST=<dist> BANC_PORT=<port> SHOTS=<dossier> node scripts/bancs/scan-achat-suite.cjs
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), http = require('http');
const RACINE = path.join(__dirname, '..', '..');
const { lancer } = require('./_navigateur.cjs');
const { metaVersData } = require('./_meta.cjs');
let PW; try { PW = require(path.join(RACINE, 'node_modules', 'playwright')); } catch (_) { PW = require('playwright'); }
const DIST = process.env.BANC_DIST ? path.resolve(process.env.BANC_DIST) : path.join(RACINE, 'dist');
const PORT = Number(process.env.BANC_PORT || (20000 + Math.floor(Math.random() * 20000)));
const SHOTS = process.env.SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const MS = Date.now(), J = 864e5;
const iso = (t) => new Date(t).toISOString();
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d !== undefined && !c ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 400) : '')); };

// ── Les données (INVENTÉES, forme réelle) ──
const UID = '111';
const TITRE = 'Nike Dunk Low panda';
const url = (k) => `https://images1.vinted.net/t/b${k}/f800/x${k}.jpeg?s=x`;
const TX = (k) => 18000009400 + k;
const mr = (k) => String(41000000 + k * 7);
const ACHATS = [], SUIVIS = [], TXN = [];
for (let k = 0; k < 50; k++) {
  ACHATS.push({ transaction_id: TX(k), conversation_id: 77000 + k, title: TITRE, price: { amount: String(40 + k), currency_code: 'EUR' }, status: 'Commande finalisée', transaction_user_status: 'completed', date: iso(MS - (2 + k % 5) * J), photo: { url: url(k + 1) } });
  SUIVIS.push({ id: `harvest_${UID}_suivi_${TX(k)}`, data: { tx: String(TX(k)), suivi: mr(k), transporteur: 'MONDIAL', capturedAt: iso(MS - 3600e3) } });
}
// Une seule transaction côté acheteur (mesuré : presque aucune) : celle du N°13.
TXN.push({ id: `harvest_${UID}_txn_${TX(3)}`, data: { payload: { transaction: { id: TX(3), user_side: 'buyer', seller: { login: 'vendeur_3' }, items_count: 1,
  order: { items: [{ title: TITRE, size_title: '42', status: 'Très bon état', price: { amount: '43', currency_code: 'EUR' }, photos: [{ url: url(4) }] }] } } } } });
const LOT = 18000009480, LOT_SUIVI = '43217890';
ACHATS.push({ transaction_id: LOT, conversation_id: 77999, title: 'Lot 2 paires', price: { amount: '90', currency_code: 'EUR' }, status: 'Commande finalisée', transaction_user_status: 'completed', date: iso(MS - 2 * J), photo: { url: url(90) } });
SUIVIS.push({ id: `harvest_${UID}_suivi_${LOT}`, data: { tx: String(LOT), suivi: LOT_SUIVI, transporteur: 'MONDIAL', capturedAt: iso(MS - 3600e3) } });
const VENTE = 22000000555;
const VENTES = [{ transaction_id: VENTE, conversation_id: 88555, title: TITRE, price: { amount: '95', currency_code: 'EUR' }, status: 'Commande finalisée', transaction_user_status: 'completed', date: iso(MS - J), photo: { url: url(6) } }];
const MEUBLES = [{ id: 'm1', name: 'Étagère A', cols: 4, rows: 3 }];
const MAIN = {
  vinted_annonce_numeros: {
    5001: { numero: '13', title: TITRE, buyFromId: String(TX(3)) },
    5002: { numero: '14', title: TITRE, buyFromId: String(TX(4)) },
    5003: { numero: '15', title: TITRE, buyFromId: String(TX(5)) },
    5004: { numero: '40', title: TITRE },
    5020: { numero: '20', title: 'Adidas Samba', buyFromId: String(LOT) },
    5021: { numero: '21', title: 'Asics Gel', buyFromId: String(LOT) },
  },
  vinted_sale_overrides: { [VENTE]: { numero: '15' } },
  vrm_meubles: MEUBLES, vrm_slots: { 13: { m: 'm1', i: 6 }, 40: { m: 'm1', i: 0 } },
  vinted_used_numeros: [13, 14, 15, 20, 21, 40],
};
const ACCOUNTS = [{ id: 1, vinted_user_id: UID, login: 'compte_test', domain: 'www.vinted.fr', updated_at: iso(MS) }];
const base = () => [
  { id: 'main', data: JSON.parse(JSON.stringify(MAIN)) },
  { id: `harvest_${UID}_orders_purchased`, data: { capturedAt: iso(MS), payload: { my_orders: ACHATS } } },
  { id: `harvest_${UID}_orders_sold`, data: { capturedAt: iso(MS), payload: { my_orders: VENTES } } },
  ...SUIVIS, ...TXN,
];

// ── Le serveur de l'app ──
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!p.startsWith(DIST) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
const projette = (row, sel) => {
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = iso(MS); continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[/^\d+$/.test(seg) && Array.isArray(v) ? Number(seg) : seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? (typeof v === 'object' ? JSON.stringify(v) : String(v)) : v);
  }
  return out;
};
const photoSvg = (k) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#dfe3e8"/><text x="200" y="230" font-size="120" text-anchor="middle" fill="rgba(0,0,0,.4)" font-family="sans-serif">${k}</text></svg>`;

async function ouvrir(b, sombre, lignes, ecritures, vue) {
  const ctx = await b.newContext(vue.l === 390 ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: 'fr-FR', timezoneId: 'Europe/Paris' } : { viewport: { width: 1512, height: 982 }, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(({ s }) => {
    try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_visite_vue', JSON.stringify(true)); } catch (_) {}
    // Caméra refusée : la saisie prend la main (le n° « lu » est tapé).
    const md = navigator.mediaDevices;
    if (md) md.getUserMedia = async () => { throw new DOMException('Permission refusée', 'NotAllowedError'); };
  }, { s: !!sombre });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    const m = /images1\.vinted\.net\/t\/b(\d+)\//.exec(u);
    if (m) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: photoSvg(Number(m[1])) });
    return r.abort();
  });
  await pg.route('**/rest/v1/**', async (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const H = { 'access-control-allow-origin': '*' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { ...H, 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (req.method() !== 'GET') {
      if (/\/rest\/v1\/app_data/.test(u) && req.method() === 'POST') {
        try { const b = JSON.parse(req.postData() || '[]'); for (const r of (Array.isArray(b) ? b : [b])) { if (!r || !r.id) continue; ecritures.push({ id: r.id, data: r.data }); if (r.id === 'main' || /^colis_suivi_/.test(r.id)) { const i = lignes.findIndex((x) => x.id === r.id); if (i >= 0) lignes[i] = { id: r.id, data: r.data }; else lignes.push({ id: r.id, data: r.data }); } } } catch (_) {}
      }
      if (req.method() === 'PATCH' && /id=eq\.main/.test(u)) { const m = lignes.find((x) => x.id === 'main'); try { const d = JSON.parse(req.postData() || '{}'); if (m && d && d.data) m.data = { ...m.data, ...d.data }; } catch (_) {} return route.fulfill({ status: 200, contentType: 'application/json', headers: H, body: JSON.stringify(m ? [{ id: 'main', data: m.data }] : []) }); }
      return route.fulfill({ status: 201, contentType: 'application/json', headers: H, body: '[]' });
    }
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { ...H, 'access-control-expose-headers': 'content-range', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    if (!/\/rest\/v1\/app_data/.test(u)) return j([]);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || '';
    const forme = (r) => (sel && sel !== '*' && !/^id,data/.test(sel) && sel !== 'data,updated_at,cap:data->>capturedAt') ? projette(r, sel) : ({ ...r, updated_at: iso(MS), cap: r.data && r.data.capturedAt });
    const inn = /[?&]id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(',').map((x) => x.replace(/^"|"$/g, '')); return j(lignes.filter((r) => ids.includes(r.id)).map(forme)); }
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(lignes.filter((r) => r.id === eq[1]).map(forme));
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(lignes.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs };
}

const etat = (pg) => pg.evaluate(() => {
  const a = (q, k) => { const e = document.querySelector(q); return e ? e.getAttribute(k) : null; };
  const f = document.querySelector('[data-scan-r-fiche]');
  const feuille = document.querySelector('[data-scan-r-resultat]');
  const pleins = [...document.querySelectorAll('[data-scan-r] .vrm-rtv-plein')].filter((e) => e.getBoundingClientRect().height > 0);
  return {
    ouvert: !!document.querySelector('[data-scan-r]'), resultat: a('[data-scan-r-resultat]', 'data-scan-r-resultat'),
    fiche: f ? f.getAttribute('data-scan-r-fiche') : null,
    suite: a('[data-scan-a-suite]', 'data-scan-a-suite'), nums: a('[data-scan-a-suite]', 'data-scan-a-nums'), cas: a('[data-scan-a-suite]', 'data-scan-a-case'),
    vente: a('[data-scan-a-suite]', 'data-scan-a-vente'), plein: pleins.length === 1 ? pleins[0].getAttribute('data-scan-a-plein') : null, pleinTxt: pleins.map((p) => p.textContent.trim()).join(' | '), nPleins: pleins.length,
    relierVente: a('[data-scan-a-relier-vente]', 'data-scan-a-relier-vente'), quoiFaire: !!document.querySelector('[data-scan-a-quoi-faire]'),
    places: [...document.querySelectorAll('[data-scan-a-place]')].map((e) => e.textContent.trim()),
    texte: feuille ? feuille.innerText : '',
    clesBrutes: feuille ? (feuille.innerText.match(/\b(?:scan|arv)\.[a-z]+\.[A-Za-z]+/g) || []) : [],
  };
});
const cibles = (pg) => pg.evaluate(() => [...document.querySelectorAll('[data-scan-r] button, [data-scan-r] a, [data-scan-r] input')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
  .filter((e) => e.getBoundingClientRect().height < 44).map((e) => (e.getAttribute('aria-label') || e.textContent.trim()).slice(0, 30) + ' ' + Math.round(e.getBoundingClientRect().height)));
const deborde = (pg) => pg.evaluate(() => {
  const d = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  const f = document.querySelector('.vrm-rtv-feuille'); if (!f) return d;
  const r = f.getBoundingClientRect(); let pire = d;
  for (const e of f.querySelectorAll('*')) { const q = e.getBoundingClientRect(); if (q.width > 0 && q.right > r.right + 1) pire = Math.max(pire, Math.round(q.right - r.right)); }
  return pire;
});
// Aujourd'hui → Scanner : l'icône du champ de recherche (17 nov. : le « Scanner » du disque d'hier y vit, sur tous les
// écrans) ; au téléphone, la loupe d'Aujourd'hui ouvre d'abord le champ.
const ouvrirScanner = async (pg) => {
  // À l'ordinateur, Aujourd'hui n'a pas de champ : son « Scanner » émet le même événement (`ouvrirRetrouver('journee')`).
  const present = await pg.waitForFunction(() => !!document.querySelector('[data-recherche-scanner], button[data-recherche-loupe], [data-v2-scanner]'), null, { timeout: 20000 }).then(() => true, () => false);
  const vu = (q) => pg.evaluate((x) => { const e = document.querySelector(x); return !!e && e.getClientRects().length > 0; }, q);
  if (!present) await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:retrouver', { detail: { depuis: 'journee', code: '', mode: '' } })));
  else if (await vu('[data-v2-scanner]')) await pg.click('[data-v2-scanner]');
  else {
    if (!(await vu('[data-recherche-scanner]'))) { await pg.click('button[data-recherche-loupe]'); await pg.waitForTimeout(400); }
    await pg.evaluate(() => document.querySelector('[data-recherche-scanner]').click());
  }
  await pg.waitForSelector('[data-scan-r-saisie]', { timeout: 20000 });
};
const taper = async (pg, n) => {
  await pg.fill('[data-scan-r-saisie]', n); await pg.click('[data-scan-r-ok]');
  await pg.waitForFunction(() => { const r = document.querySelector('[data-scan-r-resultat]'); return r && r.getAttribute('data-scan-r-resultat') !== 'attente'; }, null, { timeout: 25000 }).catch(() => {});
  await pg.waitForTimeout(400);
};
const autre = async (pg) => { await pg.click('[data-scan-r-autre]').catch(() => {}); await pg.waitForTimeout(200); };
const shot = async (pg, nom) => { if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `scan-achat-suite-${nom}.png`) }).catch(() => {}); };
const verifierVue = async (pg, T, e, nom) => {
  dit(e.nPleins <= 1, `${T} ${nom} un seul plein`, e.pleinTxt);
  dit(!e.clesBrutes.length, `${T} ${nom} aucune clé de traduction brute`, e.clesBrutes);
  const p = await cibles(pg); dit(!p.length, `${T} ${nom} chaque cible ≥ 44 px`, p);
  dit((await deborde(pg)) <= 0, `${T} ${nom} rien ne déborde de la feuille`);
};

(async () => {
  await new Promise((ok2, ko2) => { srv.once('error', ko2); srv.listen(PORT, ok2); });
  const b = await lancer(PW, { executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    for (const vue of [{ l: 390 }, { l: 1512 }]) for (const sombre of [false, true]) {
      const T = `[${vue.l} ${sombre ? 'sombre' : 'clair'}]`, S = `${vue.l}-${sombre ? 'sombre' : 'clair'}`;
      const lignes = base(), ecritures = [];
      const { ctx, pg, errs } = await ouvrir(b, sombre, lignes, ecritures, vue);
      try {
        await ouvrirScanner(pg);
        // A — rangé.
        await taper(pg, mr(3)); let e = await etat(pg);
        dit(e.fiche === `achat:a:${TX(3)}` && e.suite === 'range' && e.nums === '13' && e.cas === 'm1:6', `${T} A N°13 (50 au même titre) ⇒ « rangé », SA case`, e);
        dit(/Étagère A · rangée 2, colonne 3/.test(e.texte) && !e.plein, `${T} A la case dite en mots, aucun « Ranger »`, e);
        await verifierVue(pg, T, e, 'A'); await shot(pg, `A-range-${S}`); await autre(pg);
        // A — à ranger.
        await taper(pg, mr(4)); e = await etat(pg);
        dit(e.fiche === `achat:a:${TX(4)}` && e.suite === 'aRanger' && e.nums === '14' && e.cas === 'm1:1', `${T} A N°14 sans case ⇒ la 1re case LIBRE proposée (m1:1, la 1re est prise)`, e);
        dit(e.plein === 'aRanger' && /Ranger en Étagère A · R1 C2/.test(e.pleinTxt) && /Case prévue : Étagère A · rangée 1, colonne 2/.test(e.texte), `${T} A plein « Ranger en Étagère A · R1 C2 », « Case prévue » dite`, e);
        await verifierVue(pg, T, e, 'A2'); await shot(pg, `A-a-ranger-${S}`); await autre(pg);
        // A — vendue.
        await taper(pg, mr(5)); e = await etat(pg);
        dit(e.fiche === `achat:a:${TX(5)}` && e.suite === 'vendue' && e.vente === String(VENTE) && e.plein === 'vente', `${T} A N°15 déjà vendue (sa vente lue) ⇒ « Ouvrir la vente »`, e);
        dit(/déjà vendue/.test(e.texte), `${T} A « déjà vendue » est dit`, e.texte.slice(0, 200));
        await verifierVue(pg, T, e, 'A3'); await shot(pg, `A-vendue-${S}`); await autre(pg);
        // A — à numéroter (même titre, aucune fiche) : jamais le N° d'un voisin.
        for (const k of [6, 27, 49]) {
          await taper(pg, mr(k)); e = await etat(pg);
          dit(e.fiche === `achat:a:${TX(k)}` && e.suite === 'aNumeroter' && !e.nums && e.plein === 'aNumeroter', `${T} A achat ${k} au même titre sans fiche ⇒ « Numéroter », aucun N°`, e);
          if (k === 6) { dit(!!e.relierVente, `${T} A « Déjà vendue ? Relier à une vente » proposé`, e); await verifierVue(pg, T, e, 'A4'); await shot(pg, `A-numeroter-${S}`); }
          if (k !== 49) await autre(pg);
        }
        // « Relier à une vente » ⇒ la feuille d'Achats sur CET achat ; rien d'écrit.
        const avant = ecritures.length;
        await pg.click('[data-scan-a-relier-vente]');
        await pg.waitForSelector(`[data-relier-depuis="${TX(49)}"]`, { timeout: 10000 }).catch(() => {});
        const relier = await pg.evaluate((t) => !!document.querySelector(`[data-relier-depuis="${t}"]`) && !document.querySelector('[data-scan-r]'), String(TX(49)));
        dit(relier, `${T} A « Relier à une vente » ⇒ le scanner se ferme, la feuille de CET achat s'ouvre`);
        dit(!ecritures.slice(avant).some((w) => w.id === 'main' && JSON.stringify(w.data || {}).includes(`"buyFromId":"${TX(49)}"`)), `${T} A rien n'est relié sans SON toucher`);
        await shot(pg, `A-relier-vente-${S}`);
        await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
        await pg.evaluate(() => { const f = document.querySelector('[data-relier-fermer]'); if (f) f.click(); });
        await pg.waitForTimeout(300);
        // L — le lot.
        await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:retrouver', { detail: { depuis: 'banc' } })));
        await pg.waitForSelector('[data-scan-r-saisie]', { timeout: 10000 });
        await taper(pg, LOT_SUIVI); e = await etat(pg);
        dit(e.fiche === `achat:a:${LOT}` && e.suite === 'aRanger' && e.nums === '20,21' && e.places.length === 2, `${T} L un lot ⇒ N°20 et N°21, une ligne chacun`, e);
        dit(e.places.length === 2 && e.places[0] !== e.places[1] && /Ranger les 2 paires/.test(e.pleinTxt), `${T} L deux cases différentes, « Ranger les 2 paires »`, e);
        await verifierVue(pg, T, e, 'L'); await shot(pg, `L-lot-${S}`); await autre(pg);
        // T — le n° de transaction tapé.
        await taper(pg, String(TX(17))); e = await etat(pg);
        dit(e.resultat === 'un' && e.fiche === `achat:a:${TX(17)}`, `${T} T le n° de transaction tapé ⇒ CET achat parmi 50`, e);
        await autre(pg);
        await taper(pg, String(TX(17) + 100)); e = await etat(pg);
        dit(!e.fiche, `${T} T un n° de transaction voisin ⇒ aucune fiche`, e);
        await autre(pg);
        // I — inconnu.
        await taper(pg, '48887777'); e = await etat(pg);
        dit(e.resultat === 'aucun' && /Colis inconnu/.test(e.texte) && e.quoiFaire, `${T} I n° inconnu ⇒ « Colis inconnu » + que faire`, e);
        await verifierVue(pg, T, e, 'I'); await shot(pg, `I-inconnu-${S}`); await autre(pg);
        // A — « Ranger en … » ⇒ l'écran d'arrivée de CET achat.
        await taper(pg, mr(4));
        await pg.click('[data-scan-a-ranger]');
        await pg.waitForSelector(`[data-arv-achat="${TX(4)}"]`, { timeout: 15000 }).catch(() => {});
        const arv = await pg.evaluate((t) => !!document.querySelector(`[data-arv-achat="${t}"]`) && !document.querySelector('[data-scan-r]'), String(TX(4)));
        dit(arv, `${T} A « Ranger en … » ⇒ l'écran d'arrivée de CET achat`);
        await shot(pg, `A-arrivee-${S}`);
        dit(errs.length === 0, `${T} aucune erreur d'app`, errs.join(' | '));
      } catch (x) { dit(false, `${T} le banc a tourné jusqu'au bout`, String(x && x.message)); await shot(pg, `ERREUR-${S}`); }
      await ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  console.log(ko ? `\n❌ scan-achat-suite : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ scan-achat-suite : ${ok} vert(s)`);
  process.exit(ko ? 1 : 0);
})();
