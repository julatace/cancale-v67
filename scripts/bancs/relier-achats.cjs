// ════════════════════════════════════════════════════════════════════════════
// BANC : RELIER ACHATS ET VENTES — TOUTES LES PAIRES (20 nov., lot relier-achats)
//        node scripts/bancs/relier-achats.cjs        (PASSES=390-clair,1512-sombre… ; SHOTS= ; BANC_DIST=)
// ════════════════════════════════════════════════════════════════════════════
// Julien : « trie de la date la plus récente à la plus ancienne, des deux côtés ; des filtres plateforme, marque, taille ;
// ne me propose jamais un achat pas encore livré ; il n'y a même pas toutes les paires, c'est bizarre ».
// Base de VOLUME INVENTÉE (dépôt PUBLIC) : 1 500 achats (1 300 reçus, 80 en route, 60 au point relais, 60 remboursés),
// 1 200 annonces Vinted (1 000 en ligne numérotées, 100 masquées par Vinted, 100 vendues), 300 ventes Vinted sans achat
// (150 de moins d'un an, 150 de plus d'un an), 40 annonces Leboncoin de SES comptes — sur deux comptes Vinted.
// Jugé sur l'app RENDUE (390 tactile et 1512, clair et sombre) :
//   toutes    l'écran liste 1 000 + 100 + 300 + 40 = 1 440 annonces et ventes sans achat (avant : 1 150) ;
//   recus     il liste les 1 300 achats reçus, et AUCUN achat en route / au point relais (avant : 1 440, ceux-là en tête) ;
//   tri       des deux côtés, la date la plus récente d'abord (data-glisser-ts non croissant) ;
//   facettes  Plateforme · Marque · Taille des deux côtés : « Leboncoin » ⇒ 40, « Nike » ⇒ seulement des Nike ; le choix
//             est GARDÉ (fermer, rouvrir : encore là) ;
//   clic      rien n'est écrit sans SON geste : toucher un achat, une annonce Leboncoin, « Oui » ⇒ UNE entrée
//             `vrm_articles_sites` sous l'identifiant de CETTE annonce, rien d'autre ;
//   suivi     (1512) Achats en tableau : colonne « N° de suivi », le n° d'un achat en route et son ↗ chez le transporteur.
// Un banc ne meurt pas, il rapporte.
'use strict';
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const sc = require('./_scenario-colis.cjs');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || (21000 + Math.floor(Math.random() * 18000));
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-relier-achats');
const PASSES = String(process.env.PASSES || '390-clair,390-sombre,1512-clair,1512-sombre').split(',').map((x) => x.trim()).filter(Boolean);
fs.mkdirSync(SHOTS, { recursive: true });
const J = 86400e3, NOW = sc.NOW, [U0, U1] = sc.UID;
const iso = (ms) => new Date(ms).toISOString();
const MARQUES = ['Nike', 'Adidas', 'Asics', 'New Balance', 'Salomon', 'Puma', 'Vans', 'Converse'];
const MODELES = { Nike: 'Air Max 90', Adidas: 'Samba OG', Asics: 'Gel 1130', 'New Balance': '550', Salomon: 'XT-6', Puma: 'Suede', Vans: 'Old Skool', Converse: 'Chuck 70' };
const COULEURS = ['noir', 'blanc', 'gris', 'beige', 'vert', 'bleu'];
const TAILLES = ['38', '39', '40', '41', '42', '43', '44', '45'];
const titreDe = (i) => { const m = MARQUES[i % MARQUES.length]; return { m, t: TAILLES[(i * 3) % TAILLES.length], titre: `${m} ${MODELES[m]} ${COULEURS[i % COULEURS.length]} taille ${TAILLES[(i * 3) % TAILLES.length]}` }; };
const photo = (k) => `https://images1.vinted.net/t/${k}/f800/${k}.jpeg`;

// ── Annonces Vinted : 1 000 en ligne, 100 masquées, 100 vendues (fermées) ──
const annonces = { [U0]: [], [U1]: [] }, fiches = {};
for (let i = 0; i < 1200; i++) {
  const u = i % 5 < 3 ? U0 : U1, { m, t, titre } = titreDe(i), id = String(9100000 + i);
  const a = { ...sc.annonce({ id, titre, prix: 40 + (i % 60), taille: t, marque: m }), created_at_ts: Math.floor((NOW - (1 + (i % 400)) * J) / 1000), photo: { url: photo('an' + i) } };
  if (i >= 1000 && i < 1100) a.is_hidden = true;
  if (i >= 1100) { a.is_closed = true; a.item_closing_action = 'sold'; }
  annonces[u].push(a);
  if (i < 1100) fiches[id] = { numero: String(i + 1), title: titre, price: 40 + (i % 60), accountId: u, numberedAt: iso(NOW - (2 + (i % 400)) * J) };
}
// ── Ventes Vinted sans achat : 150 de moins d'un an, 150 de plus d'un an ──
const ventes = { [U0]: [], [U1]: [] };
for (let i = 0; i < 300; i++) {
  const { titre } = titreDe(i + 7), u = i % 2 ? U1 : U0;
  ventes[u].push(sc.ordre({ tx: String(6200000 + i), titre, prix: 60 + (i % 40), statut: sc.STATUT_FINAL, dateMs: NOW - (i < 150 ? 3 + i * 2 : 400 + i * 2) * J }));
}
// ── Achats : 1 300 reçus, 80 en route, 60 au point relais, 60 remboursés — ceux « pas encore là » sont les PLUS RÉCENTS ──
const STATUT_ROUTE = "Commande expédiée et en cours d'acheminement";
const achats = { [U0]: [], [U1]: [] }, txRoute = [], txRelais = [];
for (let i = 0; i < 1500; i++) {
  const { titre } = titreDe(i + 3), u = i % 3 ? U0 : U1, tx = String(7300000 + i);
  let statut = sc.STATUT_FINAL, jours = 10 + i;
  if (i < 80) { statut = STATUT_ROUTE; jours = 1 + (i % 4); txRoute.push(tx); }
  else if (i < 140) { statut = sc.STATUT_RELAIS; jours = 2 + (i % 5); txRelais.push(tx); }
  else if (i < 200) { statut = 'Remboursement validé'; jours = 5 + i; }
  achats[u].push({ ...sc.ordre({ tx, titre, prix: 20 + (i % 50), statut, dateMs: NOW - jours * J }), photo: { url: photo('ac' + i) } });
}
// Le n° de suivi des achats en route (lu par l'extension : `harvest_{uid}_suivi_{tx}`).
const suivis = txRoute.slice(0, 20).map((tx, k) => { const u = achats[U0].some((o) => o.transaction_id === tx) ? U0 : U1;
  return { id: `harvest_${u}_suivi_${tx}`, data: { tx, suivi: `MR${String(41000000 + k)}`, transporteur: 'mondial_relay', capturedAt: iso(NOW - 3600e3), dernier: { t: 'En cours de livraison', at: iso(NOW - 7200e3) }, etapes: [{ t: 'En cours de livraison', at: iso(NOW - 7200e3) }] } }; });
// ── Leboncoin : 40 annonces de SES comptes (compte vu en session), sans achat ──
const LBC = 'lbc-banc-1';
const lbcItems = {};
for (let i = 0; i < 40; i++) { const { titre } = titreDe(i + 11); lbcItems[String(2950000 + i)] = { id: String(2950000 + i), subject: titre, price: 70 + i, status: 'active', account: LBC, accountName: 'atelier_lbc', publieeLe: iso(NOW - (1 + i) * J), url: `https://www.leboncoin.fr/ad/chaussures/${2950000 + i}`, images: [photo('lbc' + i)] }; }
const rows = [
  ...[U0, U1].map((u) => ({ id: `harvest_${u}_listings`, data: { capturedAt: iso(NOW - 60e3), nItems: annonces[u].length, payload: { items: annonces[u], pagination: { total_entries: annonces[u].length } } } })),
  ...[U0, U1].map((u) => ({ id: `harvest_${u}_orders_purchased`, data: { capturedAt: iso(NOW - 60e3), payload: { my_orders: achats[u] } } })),
  ...[U0, U1].map((u) => ({ id: `harvest_${u}_orders_sold`, data: { capturedAt: iso(NOW - 60e3), payload: { my_orders: ventes[u] } } })),
  ...suivis,
  { id: 'lbc_listings', data: { items: lbcItems, lectures: { [LBC]: { at: iso(NOW - 3600e3), complet: true, n: 40 } } } },
  { id: 'lbc_ventes', data: { ventes: {} } },
  { id: 'lbc_accounts', data: { accounts: { [LBC]: { id: LBC, name: 'atelier_lbc', type: 'particulier', seenAt: iso(NOW - 3600e3), sessionAt: iso(NOW - 3600e3) } } } },
];
const ATTENDU_CIBLES = 1000 + 100 + 300 + 40, ATTENDU_ACHATS = 1300;
const main = (sombre) => sc.ligneMain({ vinted_dark: sombre, vinted_annonce_numeros: fiches, vinted_used_numeros: Object.values(fiches).map((f) => Number(f.numero)) });

const projette = (row, sel) => {
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = iso(NOW); continue; }
    let x = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) x = x == null ? null : x[seg];
    out[alias] = x == null ? null : (/->>/.test(src) && typeof x !== 'object' ? String(x) : x);
  }
  return out;
};
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8+P9/PQAJYwPNzpZQkwAAAABJRU5ErkJggg==', 'base64');
const srv = http.createServer((q, r) => { let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html'; const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p)); });
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ')'); process.exit(1); });
srv.listen(PORT);
let ko = 0, ok = 0; const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (c || d == null ? '' : ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 300))); return c; };

async function servir(pg, sombre) {
  await pg.route('**/images1.vinted.net/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request(), u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(sc.comptes());
    if (/id=eq\.main/.test(u)) return j(main(sombre));
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || '';
    const forme = (r) => (sel && sel !== 'data' ? projette(r, sel) : r);
    const eq = /[?&]id=eq\.([^&]*)/.exec(u); if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const inn = /[?&]id=in\.\(([^)]*)\)/.exec(u); if (inn) { const ids = inn[1].split(','); return j(rows.filter((r) => ids.includes(r.id)).map(forme)); }
    const m = /[?&]id=like\.([^&]*)/.exec(u); if (m) { const re = new RegExp('^' + m[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true,"devices":1}' }));
}
const lireAttr = (pg, sel, a) => pg.locator(sel).first().getAttribute(a).catch(() => null);
const tsDe = (pg, sel) => pg.$$eval(sel, (els) => els.map((e) => Number(e.getAttribute('data-glisser-ts') || 0)).filter((x) => x > 0));
const decroissant = (l) => l.length > 5 && l.every((x, i) => i === 0 || l[i - 1] >= x);

async function ouvrirGlisser(pg) {
  await pg.goto(`http://localhost:${PORT}/?tab=achats&site=vinted`, { waitUntil: 'domcontentloaded' });
  const bouton = pg.locator('[data-glisser-ouvrir="achats"]').first();
  await bouton.waitFor({ timeout: 40000 }).catch(() => {});
  if (!(await bouton.count())) return false;
  await bouton.click();
  await pg.waitForFunction((n) => { const e = document.querySelector('[data-glisser-cibles]'); return e && Number(e.getAttribute('data-glisser-cibles')) >= n; }, ATTENDU_CIBLES - 40, { timeout: 40000 }).catch(() => {});
  // Les annonces des autres sites arrivent par leur propre lecture : on attend qu'elle ait rendu (ou abandonné).
  await pg.waitForFunction((n) => { const e = document.querySelector('[data-glisser-cibles]'); return e && Number(e.getAttribute('data-glisser-cibles')) >= n; }, ATTENDU_CIBLES, { timeout: 15000 }).catch(() => {});
  await pg.waitForFunction(() => { const e = document.querySelector('[data-glisser-achats]'); return e && e.getAttribute('data-glisser-achats') !== ''; }, null, { timeout: 30000 }).catch(() => {});
  await pg.waitForTimeout(600);
  return true;
}

async function passe(b, nom) {
  const [w, theme] = nom.split('-'); const W = Number(w), sombre = theme === 'sombre', tel = W < 900;
  console.log(`\n── ${nom}`);
  const ctx = await b.newContext({ locale: 'fr-FR', viewport: { width: W, height: tel ? 844 : 900 }, ...(tel ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((sb) => { try { localStorage.setItem('vrm_acces_direct', '1'); if (sb) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, sombre);
  await servir(pg, sombre);
  if (!(await ouvrirGlisser(pg))) { dit(false, `${nom} · « Relier » s'ouvre depuis Achats`); await pg.screenshot({ path: path.join(SHOTS, `relier-achats-${nom}-ko.png`) }); await ctx.close(); return; }
  const nC = Number(await lireAttr(pg, '[data-glisser-cibles]', 'data-glisser-cibles'));
  const nA = Number(await lireAttr(pg, '[data-glisser-achats]', 'data-glisser-achats'));
  dit(nC === ATTENDU_CIBLES, `${nom} · toutes les paires : ${ATTENDU_CIBLES} annonces et ventes sans achat (Vinted en ligne, masquées, ventes de plus d'un an, Leboncoin)`, `${nC}`);
  dit(nA === ATTENDU_ACHATS, `${nom} · seulement les ${ATTENDU_ACHATS} achats REÇUS`, `${nA}`);
  if (!tel) await pg.screenshot({ path: path.join(SHOTS, `relier-achats-${nom}.png`) });
  // Côté achats : aucun en route / au point relais parmi les rangées rendues (ils sont les plus récents : ils seraient en tête).
  const txVus = await pg.$$eval('[data-glisser-achat]', (els) => els.map((e) => e.getAttribute('data-glisser-achat')));
  const pasLa = new Set([...txRoute, ...txRelais]);
  dit(txVus.length > 0 && !txVus.some((t) => pasLa.has(t)), `${nom} · aucun achat en route ou au point relais proposé`, txVus.filter((t) => pasLa.has(t)).slice(0, 3));
  if (tel) await pg.screenshot({ path: path.join(SHOTS, `relier-achats-${nom}-achats.png`) });
  dit(decroissant(await tsDe(pg, '[data-glisser-achat]')), `${nom} · achats : du plus récent au plus ancien`);
  // Côté annonces / ventes.
  if (tel) { const o = pg.locator('[data-glisser-onglet="cibles"]').first(); if (await o.count()) { await o.tap(); await pg.waitForTimeout(300); } }
  dit(decroissant(await tsDe(pg, '[data-glisser-cible]')), `${nom} · annonces et ventes : du plus récent au plus ancien`);
  const facC = await pg.$$eval('[data-glisser-facettes="cibles"] [data-glisser-facette]', (els) => els.map((e) => e.getAttribute('data-glisser-facette')));
  const facA = await pg.$$eval('[data-glisser-facettes="achats"] [data-glisser-facette]', (els) => els.map((e) => e.getAttribute('data-glisser-facette'))).catch(() => []);
  dit(['site', 'marque', 'taille'].every((k) => facC.includes(k)), `${nom} · annonces et ventes : pastilles Plateforme, Marque, Taille`, facC);
  if (tel) await pg.screenshot({ path: path.join(SHOTS, `relier-achats-${nom}-cibles.png`) });
  // Forme : chaque pastille ≥ 44 px au doigt (32 à la souris), dans l'écran, sur UNE ligne.
  const formes = await pg.$$eval('[data-glisser-facettes] [data-glisser-facette]', (els) => els.map((e) => { const r = e.getBoundingClientRect(); return { h: Math.round(r.height), visible: r.width > 0 }; }).filter((x) => x.visible));
  dit(formes.length && formes.every((f) => f.h >= (W < 900 ? 44 : 32)), `${nom} · pastilles ${W < 900 ? '44' : '32'} px au moins`, formes);
  // « Leboncoin » ⇒ ses 40 annonces seulement.
  await pg.locator('[data-glisser-facettes="cibles"] [data-glisser-facette="site"] select').selectOption('leboncoin').catch(() => {});
  await pg.waitForTimeout(300);
  const vuesLbc = Number(await lireAttr(pg, '[data-glisser-cibles-vues]', 'data-glisser-cibles-vues'));
  const sitesVus = await pg.$$eval('[data-glisser-cible]', (els) => [...new Set(els.map((e) => e.getAttribute('data-glisser-site')))]);
  dit(vuesLbc === 40 && sitesVus.length === 1 && sitesVus[0] === 'leboncoin', `${nom} · « Leboncoin » ⇒ ses 40 annonces, aucune autre`, { vuesLbc, sitesVus });
  await pg.screenshot({ path: path.join(SHOTS, `relier-achats-${nom}-leboncoin.png`) });
  // Côté achats : « Nike » ⇒ seulement des Nike.
  if (tel) { const c = pg.locator('[data-glisser-changer]'); if (await c.count()) await c.first().tap(); const o = pg.locator('[data-glisser-onglet="achats"]').first(); if (await o.count()) { await o.tap(); await pg.waitForTimeout(300); } }
  await pg.locator('[data-glisser-facettes="achats"] [data-glisser-facette="marque"] select').selectOption('nike').catch(() => {});
  await pg.waitForTimeout(300);
  const titres = await pg.$$eval('[data-glisser-achat] .vrm-rg-titre', (els) => els.map((e) => e.textContent || ''));
  dit(facA.includes('marque') && titres.length > 0 && titres.every((t) => /^Nike /.test(t)), `${nom} · achats : « Nike » ⇒ seulement des Nike`, titres.filter((t) => !/^Nike /.test(t)).slice(0, 3));
  // Le choix est GARDÉ : fermer, rouvrir.
  await pg.locator('[data-glisser-fermer]').first().click().catch(() => {});
  await pg.waitForTimeout(300);
  await pg.locator('[data-glisser-ouvrir="achats"]').first().click().catch(() => {});
  await pg.locator('[data-glisser-facettes="achats"]').first().waitFor({ timeout: 15000 }).catch(() => {});
  await pg.waitForTimeout(800);
  const garde = await lireAttr(pg, '[data-glisser-facettes="achats"] [data-glisser-facette="marque"]', 'data-glisser-facette-valeur');
  dit(garde === 'nike', `${nom} · le choix « Nike » est gardé à la réouverture`, garde);
  // SON clic relie, et rien d'autre : un achat, une annonce Leboncoin, « Oui ».
  const avant = await pg.evaluate(() => localStorage.getItem('vrm_articles_sites') || '{}');
  const tx = await pg.locator('[data-glisser-achat]').first().getAttribute('data-glisser-achat');
  const tap = async (l) => { try { if (tel) await l.tap({ timeout: 8000 }); else await l.click({ timeout: 8000 }); } catch (_) {} };
  await tap(pg.locator(`[data-glisser-achat="${tx}"]`).first());
  await pg.waitForTimeout(300);
  await pg.locator('[data-glisser-facettes="cibles"] [data-glisser-facette="site"] select').selectOption('leboncoin').catch(() => {});
  await pg.waitForTimeout(300);
  const cible = pg.locator('[data-glisser-cible][data-glisser-site="leboncoin"]').first();
  const cle = await cible.getAttribute('data-glisser-cible').catch(() => '');
  const avantOui = await pg.evaluate(() => localStorage.getItem('vrm_articles_sites') || '{}');
  dit(avantOui === avant, `${nom} · rien n'est écrit avant « Oui »`);
  if (!(await cible.count())) { dit(false, `${nom} · une annonce Leboncoin à toucher`); dit(!errs.length, `${nom} · aucune erreur de page`, errs.slice(0, 2)); await ctx.close(); return; }
  await tap(cible);
  await pg.locator('[data-glisser-oui]').first().waitFor({ timeout: 5000 }).catch(() => {});
  await pg.screenshot({ path: path.join(SHOTS, `relier-achats-${nom}-question.png`) });
  await tap(pg.locator('[data-glisser-oui]').first()).catch(() => {});
  await pg.waitForTimeout(1200);
  const apres = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_articles_sites') || '{}'); } catch (_) { return null; } });
  const avecLien = Object.entries(apres || {}).filter(([, v]) => v && v.buyFromId);
  dit(avecLien.length === 1 && 's:' + avecLien[0][0] === cle && String(avecLien[0][1].buyFromId) === String(tx), `${nom} · « Oui » ⇒ UNE annonce Leboncoin reliée, par son identifiant, à CET achat`, { cle, tx, avecLien: avecLien.map(([k, v]) => k + '>' + v.buyFromId) });
  await pg.waitForTimeout(600);
  const encore = await pg.locator(`[data-glisser-cible="${cle}"]`).count();
  dit(encore === 0, `${nom} · l'annonce reliée sort de la liste`);
  dit(Number(await lireAttr(pg, '[data-glisser-achats]', 'data-glisser-achats')) === ATTENDU_ACHATS - 1, `${nom} · l'achat relié n'est plus libre`);
  dit(!errs.length, `${nom} · aucune erreur de page`, errs.slice(0, 2));
  await ctx.close();
}

// (1512) Achats en tableau : la colonne « N° de suivi ».
async function suiviTableau(b, sombre) {
  const nom = `1512-${sombre ? 'sombre' : 'clair'}-tableau`;
  console.log(`\n── ${nom}`);
  const ctx = await b.newContext({ locale: 'fr-FR', viewport: { width: 1512, height: 900 } });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((sb) => { try { localStorage.setItem('vrm_acces_direct', '1'); if (sb) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, sombre);
  await servir(pg, sombre);
  await pg.goto(`http://localhost:${PORT}/?tab=achats&site=vinted`, { waitUntil: 'domcontentloaded' });
  const tx = txRoute[0], su = suivis[0].data.suivi;
  await pg.locator(`[data-achats-tableau] [data-achat-tx="${tx}"]`).first().waitFor({ timeout: 40000 }).catch(() => {});
  await pg.waitForTimeout(800);
  const cell = pg.locator(`[data-achats-tableau] [data-achat-tx="${tx}"] [data-achat-suivi]`).first();
  const n = await cell.getAttribute('data-achat-suivi').catch(() => null);
  dit(n === su, `${nom} · l'achat en route montre SON n° de suivi en colonne`, n);
  const lien = await pg.locator(`[data-achats-tableau] [data-achat-tx="${tx}"] [data-achat-suivi] a[href]`).first().getAttribute('href').catch(() => null);
  dit(!!lien && lien.includes(su), `${nom} · ↗ ouvre le suivi chez le transporteur`, lien);
  const logo = await pg.locator(`[data-achats-tableau] [data-achat-tx="${tx}"] .n-tt-transporteur svg, [data-achats-tableau] [data-achat-tx="${tx}"] .n-tt-transporteur img`).count();
  dit(logo > 0, `${nom} · le logo du transporteur à côté`);
  await pg.screenshot({ path: path.join(SHOTS, `relier-achats-${nom}.png`) });
  dit(!errs.length, `${nom} · aucune erreur de page`, errs.slice(0, 2));
  await ctx.close();
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    for (const p of PASSES) await passe(b, p);
    if (!process.env.SANS_TABLEAU) { await suiviTableau(b, false); await suiviTableau(b, true); }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ok} ✅ · ${ko} ❌   (captures : ${SHOTS})`);
  process.exit(ko ? 1 : 0);
})();
