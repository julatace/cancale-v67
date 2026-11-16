require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « SCANNER UN COLIS D'ACHAT » (16 nov., lot scan-achat) — src/ScannerRetrouver.jsx
//  Julien : « quand on scanne un bordereau d'ACHAT (le colis qu'il reçoit), l'app doit pouvoir dire, avec les
//  infos du bordereau, ce qu'il y a dans le colis ».
//
//  L'app BÂTIE, 390 px tactile (clair et sombre), caméra REFUSÉE ⇒ la saisie a le curseur : le n° est TAPÉ (c'est
//  le chemin du code-barres après la lecture, `lireCodeColis`, le même). Base INVENTÉE, de la forme réelle mesurée
//  (lecture seule, 16 nov.) : commandes `orders_purchased` (titre, prix {amount}, date, photo, statut,
//  conversation_id), ligne de suivi Vinted `harvest_{uid}_suivi_{tx}` (lue en `meta->>`), transaction
//  `harvest_{uid}_txn_{tx}` (`user_side` buyer, `seller.login`, `order.items[]` : titre, taille, état, prix, photos).
//   A  50 achats au MÊME titre, chacun son n° : trois n° tapés ⇒ chaque fois SA fiche (jamais une autre) ;
//      la fiche dit ce qu'il y a dedans : photo, titre, taille, état, prix payé, vendeur, « Ranger », « Signaler un
//      problème » (la conversation de CET achat sur Vinted) ;
//   B  un lot (3 articles dans la transaction) ⇒ la liste des 3 ;
//   C  un n° inconnu ⇒ « Colis inconnu : n° …, aucun achat avec ce n° » + « Relier à un achat » ⇒ la feuille de
//      choix ; SON toucher sur un achat ⇒ le n° est écrit comme identité (`colis_suivi_*`, tx de CET achat) ;
//      le même n° rescanné ⇒ la fiche de cet achat ;
//   D  la douchette : un code déjà lu ouvre le scanner sur sa fiche ;
//   E  « Ranger » ⇒ l'atelier d'arrivée s'ouvre ; « Ce n'est pas ça » ⇒ retour à la caméra, aucune fiche.
//  Partout : cibles ≥ 44 px, rien ne déborde, aucune erreur. Lancer : BANC_DIST=<dist> BANC_PORT=<port> SHOTS=<dossier>
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
const N = 50;
const mr = (k) => String(41000000 + k * 7);                     // n° Mondial Relay, 8 chiffres
const ACHATS = [];
const TXN = [];
const SUIVIS = [];
for (let k = 0; k < N; k++) {
  const tx = 9400 + k;
  ACHATS.push({ transaction_id: tx, conversation_id: 77000 + k, title: TITRE, price: { amount: String(40 + k), currency_code: 'EUR' }, status: 'Colis déposé en point relais', transaction_user_status: 'needs_action', date: iso(MS - (2 + k % 5) * J), photo: { url: url(k + 1) } });
  SUIVIS.push({ id: `harvest_${UID}_suivi_${tx}`, data: { tx: String(tx), suivi: mr(k), transporteur: 'MONDIAL', capturedAt: iso(MS - 3600e3) } });
  TXN.push({ id: `harvest_${UID}_txn_${tx}`, data: { payload: { transaction: { id: tx, user_side: 'buyer', seller: { login: `vendeur_${k}` }, items_count: 1,
    order: { items: [{ title: TITRE, size_title: String(36 + k % 10), status: k % 2 ? 'Très bon état' : 'Bon état', price: { amount: String(40 + k), currency_code: 'EUR' }, photos: [{ url: url(k + 1) }] }] } } } } });
}
// Le lot : 3 articles dans UNE transaction.
const LOT_TX = 9480, LOT_SUIVI = '43217890';
ACHATS.push({ transaction_id: LOT_TX, conversation_id: 77999, title: 'Lot 3 paires', price: { amount: '120', currency_code: 'EUR' }, status: 'Colis déposé en point relais', transaction_user_status: 'needs_action', date: iso(MS - 2 * J), photo: { url: url(90) } });
SUIVIS.push({ id: `harvest_${UID}_suivi_${LOT_TX}`, data: { tx: String(LOT_TX), suivi: LOT_SUIVI, transporteur: 'MONDIAL', capturedAt: iso(MS - 3600e3) } });
TXN.push({ id: `harvest_${UID}_txn_${LOT_TX}`, data: { payload: { transaction: { id: LOT_TX, user_side: 'buyer', seller: { login: 'vendeur_lot' }, items_count: 3,
  order: { items: ['Adidas Samba noire', 'New Balance 530 grise', 'Asics Gel 1130'].map((t, i) => ({ title: t, size_title: String(40 + i), status: 'Très bon état', price: { amount: String(40), currency_code: 'EUR' }, photos: [{ url: url(91 + i) }] })) } } } } });
// Un achat SANS suivi (à relier par le n° inconnu).
const A_RELIER = 9490, INCONNU = '48887777';
ACHATS.push({ transaction_id: A_RELIER, conversation_id: 77990, title: 'Converse Chuck 70 crème', price: { amount: '55', currency_code: 'EUR' }, status: 'Colis déposé en point relais', transaction_user_status: 'needs_action', date: iso(MS - J), photo: { url: url(95) } });
TXN.push({ id: `harvest_${UID}_txn_${A_RELIER}`, data: { payload: { transaction: { id: A_RELIER, user_side: 'buyer', seller: { login: 'vendeur_relie' }, items_count: 1, order: { items: [{ title: 'Converse Chuck 70 crème', size_title: '41', status: 'Neuf sans étiquette', price: { amount: '55', currency_code: 'EUR' }, photos: [{ url: url(95) }] }] } } } } });
const ACCOUNTS = [{ id: 1, vinted_user_id: UID, login: 'compte_test', domain: 'www.vinted.fr', updated_at: iso(MS) }];
const base = () => [
  { id: `harvest_${UID}_orders_purchased`, data: { capturedAt: iso(MS), payload: { my_orders: ACHATS } } },
  { id: `harvest_${UID}_orders_sold`, data: { capturedAt: iso(MS), payload: { my_orders: [] } } },
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

async function ouvrir(b, sombre, lignes, ecritures) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
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
        try { const b = JSON.parse(req.postData() || '[]'); for (const r of (Array.isArray(b) ? b : [b])) { if (!r || !r.id) continue; ecritures.push({ id: r.id, data: r.data }); if (/^colis_suivi_/.test(r.id)) { const i = lignes.findIndex((x) => x.id === r.id); if (i >= 0) lignes[i] = { id: r.id, data: r.data }; else lignes.push({ id: r.id, data: r.data }); } } } catch (_) {}
      }
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
  await pg.goto(`http://localhost:${PORT}/?tab=achats`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs };
}

const etat = (pg) => pg.evaluate(() => {
  const a = (q, k) => { const e = document.querySelector(q); return e ? e.getAttribute(k) : null; };
  const f = document.querySelector('[data-scan-r-fiche]');
  return {
    ouvert: !!document.querySelector('[data-scan-r]'), resultat: a('[data-scan-r-resultat]', 'data-scan-r-resultat'),
    fiche: f ? f.getAttribute('data-scan-r-fiche') : null, details: a('[data-scan-a-details]', 'data-scan-a-details'),
    lot: a('[data-scan-a-lot]', 'data-scan-a-lot'), articles: document.querySelectorAll('[data-scan-a-article]').length,
    prix: a('[data-scan-a-prix]', 'data-scan-a-prix'), vendeur: a('[data-scan-a-vendeur]', 'data-scan-a-vendeur'), taille: a('[data-scan-a-taille]', 'data-scan-a-taille'),
    ranger: a('[data-scan-a-ranger]', 'data-scan-a-ranger'), signaler: (document.querySelector('[data-scan-a-signaler]') || {}).href || null,
    inconnu: a('[data-scan-a-inconnu]', 'data-scan-a-inconnu'), relier: a('[data-scan-a-relier]', 'data-scan-a-relier'),
    texte: (document.querySelector('[data-scan-r-resultat]') || {}).innerText || '',
  };
});
const cibles = (pg) => pg.evaluate(() => [...document.querySelectorAll('[data-scan-r] button, [data-scan-r] a, [data-scan-r] input')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
  .filter((e) => e.getBoundingClientRect().height < 44).map((e) => (e.getAttribute('aria-label') || e.textContent.trim()).slice(0, 30) + ' ' + Math.round(e.getBoundingClientRect().height)));
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const ouvrirScanner = async (pg) => {
  await pg.waitForSelector('[data-scan-retrouver-bouton="achats"]', { timeout: 30000 });
  await pg.click('[data-scan-retrouver-bouton="achats"]');
  await pg.waitForSelector('[data-scan-r-saisie]', { timeout: 10000 });
};
const taper = async (pg, n) => {
  await pg.fill('[data-scan-r-saisie]', n); await pg.click('[data-scan-r-ok]');
  await pg.waitForFunction(() => { const r = document.querySelector('[data-scan-r-resultat]'); return r && r.getAttribute('data-scan-r-resultat') !== 'attente'; }, null, { timeout: 20000 }).catch(() => {});
  await pg.waitForFunction(() => { const d = document.querySelector('[data-scan-a-details]'); return !d || d.getAttribute('data-scan-a-details') !== 'lecture'; }, null, { timeout: 8000 }).catch(() => {});
  await pg.waitForTimeout(300);
};
const autre = (pg) => pg.click('[data-scan-r-autre]').catch(() => {});
const shot = async (pg, nom) => { if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `scan-achat-${nom}.png`) }).catch(() => {}); };

(async () => {
  await new Promise((ok2, ko2) => { srv.once('error', ko2); srv.listen(PORT, ok2); });
  const b = await lancer(PW, { executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    for (const sombre of [false, true]) {
      const T = sombre ? '[390 sombre]' : '[390 clair]';
      const lignes = base(), ecritures = [];
      const { ctx, pg, errs } = await ouvrir(b, sombre, lignes, ecritures);
      try {
        await ouvrirScanner(pg);
        // A — 50 achats au même titre : trois n° ⇒ chaque fois SA fiche.
        for (const k of [0, 23, 49]) {
          await taper(pg, mr(k));
          const e = await etat(pg);
          dit(e.resultat === 'un' && e.fiche === `achat:a:${9400 + k}`, `${T} A le n° de l'achat ${9400 + k} (50 au même titre) ⇒ SA fiche, aucune autre`, e);
          if (k === 23) {
            dit(e.details === '1' && e.vendeur === `vendeur_${k}` && e.prix === String(40 + k) && e.taille === String(36 + k % 10), `${T} A ce qu'il y a dedans : l'article lu dans SA transaction (taille, vendeur), le prix payé`, e);
            dit(!!e.ranger && /\/inbox\/77023$/.test(e.signaler || ''), `${T} A « Ranger » et « Signaler un problème » (la conversation de CET achat)`, e);
            dit(/Très bon état|Bon état/.test(e.texte), `${T} A l'état de l'article est dit`, e.texte.slice(0, 200));
            await shot(pg, `A-fiche-${sombre ? 'sombre' : 'clair'}`);
            const p = await cibles(pg); dit(!p.length, `${T} A chaque cible ≥ 44 px`, p);
            dit((await deborde(pg)) <= 0, `${T} A rien ne déborde`);
          }
          await autre(pg);
        }
        // B — un lot.
        await taper(pg, LOT_SUIVI);
        let e = await etat(pg);
        dit(e.fiche === `achat:a:${LOT_TX}` && e.lot === '3' && e.articles === 3, `${T} B un lot ⇒ la liste de ses 3 articles`, e);
        await shot(pg, `B-lot-${sombre ? 'sombre' : 'clair'}`);
        await autre(pg);
        // E — « Ce n'est pas ça » : retour à la caméra, aucune fiche.
        await taper(pg, mr(5));
        await pg.click('[data-scan-a-pas-ca]');
        await pg.waitForTimeout(300);
        e = await etat(pg);
        dit(e.ouvert && !e.fiche && !e.resultat, `${T} E « Ce n'est pas ça » ⇒ retour au scanner, aucune fiche`, e);
        // C — n° inconnu ⇒ la phrase + Relier.
        await taper(pg, INCONNU);
        e = await etat(pg);
        dit(e.resultat === 'aucun' && e.inconnu === INCONNU && e.relier === INCONNU && /Colis inconnu/.test(e.texte), `${T} C n° inconnu ⇒ « Colis inconnu : n° …, aucun achat avec ce n° » + « Relier à un achat »`, e);
        await shot(pg, `C-inconnu-${sombre ? 'sombre' : 'clair'}`);
        await pg.click('[data-scan-a-relier]');
        await pg.waitForSelector(`[data-relier-colis="${INCONNU}"]`, { timeout: 10000 }).catch(() => {});
        const feuille = await pg.evaluate(() => [...document.querySelectorAll('[data-relier-colis-achat]')].map((x) => x.getAttribute('data-relier-colis-achat')));
        dit(feuille.includes(String(A_RELIER)) && !feuille.includes('9400'), `${T} C la feuille de choix s'ouvre sur CE n° : l'achat sans suivi proposé, aucun achat qui a déjà son n°`, feuille);
        dit(!ecritures.some((w) => /^colis_suivi_/.test(w.id)), `${T} C rien n'est écrit avant SON toucher`);
        await shot(pg, `C-relier-${sombre ? 'sombre' : 'clair'}`);
        await pg.click(`[data-relier-colis-achat="${A_RELIER}"]`);
        await pg.waitForTimeout(1500);
        const w = ecritures.find((x) => /^colis_suivi_/.test(x.id));
        dit(!!w && w.data && w.data.tx === String(A_RELIER) && w.data.suivi === INCONNU && w.data.relieDepuis === 'scan', `${T} C SON toucher écrit le n° comme identité de CET achat`, w);
        // Le même n° rescanné ⇒ la fiche de cet achat (D : par la douchette).
        await pg.evaluate((c) => window.dispatchEvent(new CustomEvent('vrm:retrouver', { detail: { depuis: 'douchette', code: c } })), INCONNU);
        await pg.waitForFunction(() => { const r = document.querySelector('[data-scan-r-resultat]'); return r && r.getAttribute('data-scan-r-resultat') !== 'attente'; }, null, { timeout: 20000 }).catch(() => {});
        await pg.waitForTimeout(800);
        e = await etat(pg);
        dit(e.fiche === `achat:a:${A_RELIER}`, `${T} D le même n° (douchette) ⇒ la fiche de l'achat relié`, e);
        await shot(pg, `D-relie-${sombre ? 'sombre' : 'clair'}`);
        // E — « Ranger » ⇒ l'atelier d'arrivée.
        await pg.click('[data-scan-a-ranger]');
        await pg.waitForSelector('[data-atelier-arrivee]', { timeout: 10000 }).catch(() => {});
        const atelier = await pg.evaluate(() => !!document.querySelector('[data-atelier-arrivee]') && !document.querySelector('[data-scan-r]'));
        dit(atelier, `${T} E « Ranger » ⇒ le scanner se ferme, l'atelier d'arrivée s'ouvre`);
        await shot(pg, `E-ranger-${sombre ? 'sombre' : 'clair'}`);
        dit(errs.length === 0, `${T} aucune erreur d'app`, errs.join(' | '));
      } catch (x) { dit(false, `${T} le banc a tourné jusqu'au bout`, String(x && x.message)); }
      await ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  console.log(ko ? `\n❌ scan-achat : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ scan-achat : ${ok} vert(s)`);
  process.exit(ko ? 1 : 0);
})();
