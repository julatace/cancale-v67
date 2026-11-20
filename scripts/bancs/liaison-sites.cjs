// ════════════════════════════════════════════════════════════════════════════
//  BANC : « RELIER MES ANNONCES » — LE PARCOURS GUIDÉ (19 nov., src/LiaisonSites.jsx)
//  Rend le VRAI build (dist/) sur une base INVENTÉE (aucune donnée réelle), à 390 × 844 tactile et 1512,
//  clair et sombre. Mesure par data-* et géométrie (jamais un libellé) ; compte les TOUCHERS.
//   P1  le parcours s'ouvre sur la « sûre » (« 1 sur 5 »), photo contre photo, UN plein ; rien n'est relié ;
//       téléphone : une annonce à la fois ; ordinateur : trois volets ;
//   P2  UN toucher ⇒ le lien (et sa preuve, sa date) ; l'annonce suivante arrive seule ; « vérifié » ;
//   P3  eBay « à vérifier » en tête, jamais mise en avant ; cartes à grande photo, aucun texte superposé ;
//   P4  Vestiaire : la photo sur deux paires + deux N° en jeu ⇒ UNE question (« quel N° sur le carton ? ») ;
//   P5  la capture de Julien : un titre identique parmi 30 ⇒ PREMIÈRE, un toucher ;
//   P6  tailles lues différentes ⇒ refus expliqué, rien d'écrit ;
//   P7  la fin (« Tout est relié », plus tard, à vérifier) ;  P8  un lien qui se contredit : les deux côtés ;
//   L   l'entrée d'un site, l'ancienne feuille « Relier à Vinted » absente, le lot « Relier les 2 sûres »
//       (relecture photo contre photo, un geste), une annonce reliée et « Délier » (l'état d'avant) ;
//   C   annonces Vinted pas lues ⇒ « pas lues », aucune ligne, rien d'écrit.
//  Partout : contrastes ≥ 4,5:1 sur le fond rendu, cibles ≥ 44 px, un seul plein, aucun débordement.
//  `BANC_DIST=<dist>` : un autre build.  `BANC_SEUL=390|1512`, `BANC_THEME=clair|sombre`, `CAPTURES=<dossier>`.
//  Lancer (sous verrou, /tmp/vrm-verrous.md) :
//    BANC_PORT=$((20000+RANDOM%40000)) node -r ./scripts/bancs/_porte-banc.cjs scripts/bancs/liaison-sites.cjs
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path');
const fs = require('fs'), http = require('http');
const { chromium } = require('playwright');
const { metaVersData } = require('./_meta.cjs');
const RACINE = path.join(__dirname, '..', '..');
const DIST = process.env.BANC_DIST || path.join(RACINE, 'dist');
const PORT = Number(process.env.BANC_PORT) || 9684;
const CAPT = process.env.CAPTURES || '';
if (CAPT) fs.mkdirSync(CAPT, { recursive: true });

const maintenant = new Date(2026, 10, 19, 15, 30, 0);
const MS = maintenant.getTime();
const iso = (h) => new Date(MS - h * 3600e3).toISOString();
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte-alpha', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() }];

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d && !c ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).split('\n')[0].slice(0, 300)); } };

const SEUIL_SRC = fs.readFileSync(path.join(__dirname, 'photos-comptes-seuil.cjs'), 'utf8');
const DESSIN = SEUIL_SRC.slice(SEUIL_SRC.indexOf('function alea('), SEUIL_SRC.indexOf('window.__cinquante') > 0 ? SEUIL_SRC.indexOf('window.__cinquante') : SEUIL_SRC.indexOf('window.__mesure'));
const REGLE = fs.readFileSync(path.join(RACINE, 'src', 'photoEmpreinte.js'), 'utf8').replace(/^export /gm, '');
// (15 nov., lot meme-photo-sure) La deuxième mesure, la VRAIE (src/photoFine.js), calculée sur les mêmes images.
const FINE = fs.existsSync(path.join(RACINE, 'src', 'photoFine.js')) ? fs.readFileSync(path.join(RACINE, 'src', 'photoFine.js'), 'utf8').replace(/^import [^\n]*\n/gm, '').replace(/^export /gm, '') : '';
const PAGE_GEN = `<!doctype html><meta charset="utf-8"><body><script>
${REGLE}
${FINE}
${DESSIN}
if (typeof webp !== 'function') window.webp = async (c, q) => charge(c.toDataURL('image/webp', q));
window.__fabrique = async (liste) => {
  const out = {};
  for (const f of liste) {
    const c = photo(paire(f.k), vueDe(f.k, f.v));
    const base = await jpeg(c, 0.9);
    const W = c.width, H = c.height;
    let img = base, type = 'image/jpeg';
    if (f.t === 'cdn') { img = await webp(versCanvas(await jpeg(versCanvas(base, W / 2, H / 2), 0.6), W / 2, H / 2), 0.6); type = 'image/webp'; }
    if (f.t === 'vignette') img = await jpeg(versCanvas(base, W / 4, H / 4), 0.75);
    const cv = versCanvas(img, img.width, img.height);
    const u = cv.toDataURL(type, type === 'image/webp' ? 0.6 : 0.85);
    out[f.nom] = { b64: u.split(',')[1], type, h: await empreinte(await charge(u)) };
  }
  return out;
};
window.__distance = (a, b) => distanceEmpreintes(a, b);
window.__fine = async (a, b) => {
  if (typeof comparerFine !== 'function') return null;
  const prep = async (u) => { const im = await charge(u); const t = tailleLectureFine(im.width, im.height); const c = document.createElement('canvas'); c.width = t.w; c.height = t.h; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0, t.w, t.h); return preparerFine(x.getImageData(0, 0, t.w, t.h).data, t.w, t.h); };
  return comparerFine(await prep(a), await prep(b));
};
window.__seuil = SEUIL_PHOTO;
</script>`;
const PHOTOS = [
  { nom: 'P1', k: 0, v: 0 }, { nom: 'P1cdn', k: 0, v: 0, t: 'cdn' }, { nom: 'P1v3', k: 0, v: 3 },
  { nom: 'P2', k: 1, v: 0 }, { nom: 'P2vig', k: 1, v: 0, t: 'vignette' },
  { nom: 'P3', k: 2, v: 1 }, { nom: 'P3cdn', k: 2, v: 1, t: 'cdn' },
  { nom: 'P6', k: 5, v: 2 },
];
const uV = (n) => `https://images1.vinted.net/t/05_${n.toLowerCase()}_banc/f800/1.jpeg?s=inventee`;
const uL = (n) => `https://img.leboncoin.fr/api/v1/lbcpb1/images/05_${n.toLowerCase()}_banc.jpg?rule=ad-image`;
const uE = (n) => `https://i.ebayimg.com/images/g/05_${n.toLowerCase()}_banc/s-l500.jpg`;
const uC = (n) => `https://images.vestiairecollective.com/images/resized/w=256/produit/05_${n.toLowerCase()}_banc.jpg`;
const cleDe = (u) => u.split('#')[0].split('?')[0];

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = (row.data && row.data.capturedAt) || maintenant.toISOString(); continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v === 'object' ? JSON.stringify(v) : (/->>/.test(src) ? String(v) : v));
  }
  return out;
};

// ── Le monde inventé ──────────────────────────────────────────────────────────
const FILLER = ['adidas handball spezial noir taille 35', 'salomon XT-6 gris taille 40', 'nike p-6000 gris et vert taille 40', 'adidas handball spezial marron taille 36', 'adidas handball spezial rose taille 36', 'new balance 530 beige taille 38'];
function scenario(F, o = {}) {
  const h = (n) => F[n].h;
  const vinted = [[9001, 'P1', '124', 'Nike Air Max 1 blanche taille 42', '42', 80], [9002, 'P2', '125', 'Adidas Samba noire taille 41', '41', 60], [9003, 'P3', '300', 'New Balance 550 verte 43', '43', 90], [9004, 'P3', '301', 'New Balance 550 verte 43', '43', 90], [9005, 'P6', '126', 'Asics Gel 1130 grise 44', '44', 70]];
  // 29 paires sans rapport + LA paire de la capture de Julien (« adidas spezial vert taille 39,5 », N°234).
  const autresV = [];
  for (let i = 0; i < 29; i++) autresV.push([9200 + i, null, String(200 + i), FILLER[i % FILLER.length] + (i >= FILLER.length ? ' lot ' + i : ''), String(35 + (i % 9)), 40 + i]);
  autresV.push([9234, 'P1v3', '234', 'adidas spezial vert taille 39,5', '39,5', 65]);
  const tous = [...vinted, ...autresV];
  const numeros = Object.fromEntries(tous.map(([id, p, n, t, s, px]) => [String(id), { numero: n, title: t, photo: p ? uV(p) : uV('P6'), accountId: '111', numberedAt: iso(500), size: s, price: String(px) }]));
  const items = tous.map(([id, p, n, t, s, px]) => ({ id, title: t, photo: { url: p ? uV(p) : uV('P6') }, url: `https://www.vinted.fr/items/${id}-inventee`, price: { amount: String(px) + '.0', currency_code: 'EUR' }, size_title: s, brand_title: t.split(' ')[0], is_closed: false, is_hidden: false, is_draft: false, created_at_ts: iso(300), user_id: 111 }));
  const lbcAd = (id, subject, img, price) => ({ id, account: 'lbc-account:987', accountName: 'boutique-lbc', subject, status: 'active', price, images: [uL(img)], seenAt: iso(1), url: 'https://www.leboncoin.fr/ad/chaussures/' + id });
  const lbc = { 5001: lbcAd(5001, 'Basket blanche 42', 'P1cdn', 80), 5002: lbcAd(5002, 'Adidas Spezial vert taille 39,5', 'P2vig', 70), 5003: lbcAd(5003, 'Asics grise', 'P6', 70), 5004: lbcAd(5004, 'Nike Air Max 1 blanche taille 45', 'P3cdn', 85) };
  const LIGNES = [
    ...(o.vintedKO ? [] : [{ id: 'harvest_111_listings', data: { capturedAt: iso(1), uid: '111', payload: { items, pagination: { total_entries: items.length } } } }]),
    { id: 'photo_emprunte_111', data: { capturedAt: iso(1), payload: { annonces: Object.fromEntries(vinted.map(([id, p]) => [String(id), { [cleDe(uV(p))]: h(p) }])) } } },
    { id: 'photo_empreinte_lbc', data: { capturedAt: iso(1), payload: { annonces: { 5001: { [cleDe(uL('P1cdn'))]: h('P1cdn') } } } } },
    { id: 'photo_empreinte_ebay', data: { capturedAt: iso(1), payload: { annonces: { 2001: { [cleDe(uE('P2vig'))]: h('P2vig') } } } } },
    { id: 'photo_empreinte_vc', data: { capturedAt: iso(1), payload: { annonces: { 'vc-9': { [cleDe(uC('P3cdn'))]: h('P3cdn') } } } } },
    { id: 'photo_meme_verif', data: { capturedAt: iso(1), payload: { version: 1, couples: { [`lbc|5001|${cleDe(uL('P1cdn'))}#111|9001|${cleDe(uV('P1'))}`]: { ...o.fine, v: 1, at: iso(1) } } } } },
    { id: 'lbc_listings', data: { items: lbc, lectures: { 'lbc-account:987': { at: iso(1), complet: true } } } },
    { id: 'lbc_accounts', data: { accounts: { 987: { id: 'lbc-account:987', name: 'boutique-lbc', sessionAt: iso(1) } } } },
    { id: 'ebay_listings', data: { capturedAt: MS - 3600e3, complet: true, items: [
      { itemId: '2001', title: 'Samba noire', photo: uE('P2vig'), sku: '', price: '62,00', currency: 'EUR', depuis: iso(200) },
      // Un lien qui se contredit : le lien posé dit N°126, la référence écrite sur eBay dit VRM-125.
      { itemId: '2002', title: 'Asics Gel 1130 grise 44', photo: uE('P6'), sku: 'VRM-125', price: '70,00', currency: 'EUR', depuis: iso(200) }] } },
    { id: 'vc_listings', data: { capturedAt: iso(1), complet: true, items: { 'vc-9': { compte: 'vcmoi', titre: 'NB 550 verte', statut: 'En vente', photo: uC('P3cdn'), vuAt: iso(1), prix: { valeur: 95, devise: 'EUR' } } }, liens: {} } },
  ];
  const main = { vinted_annonce_numeros: numeros, vrm_lbc_liens: { 5003: '126' }, vrm_ebay_liens: { 2002: { pairId: '9005', numero: '126', at: MS - 86400e3, par: 'main' } }, vrm_vc_liens: {}, vrm_vc_numeros: { 'vc-9': { numero: '31', numberedAt: iso(900), auto: true } }, vinted_used_numeros: [31, 124, 125, 126, 234, 300, 301] };
  return { LIGNES, main };
}

async function ouvrir(b, vp, sc, { sombre = false, tab = 'journee', images }) {
  const tel = vp.width < 600;
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: vp, deviceScaleFactor: tel ? 2 : 1, timezoneId: 'Europe/Paris', locale: 'fr-FR', ...(tel ? { isMobile: true, hasTouch: true } : {}), colorScheme: sombre ? 'dark' : 'light' });
  const pg = await ctx.newPage();
  const errs = [], ecritures = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_prenom', JSON.stringify('Julien')); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_apparence', JSON.stringify(s ? 'sombre' : 'clair')); } catch (_) {} }, sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : /api-adresse|openfreemap/.test(r.request().url()) ? r.abort() : r.continue()));
  await pg.route(/^https:\/\/(images1\.vinted\.net|img\.leboncoin\.fr|i\.ebayimg\.com|images\.vestiairecollective\.com)\//, (r) => {
    const m = /05_([a-z0-9]+)_banc/.exec(r.request().url());
    const k = m && Object.keys(images).find((x) => x.toLowerCase() === m[1]);
    const im = k && images[k];
    return im ? r.fulfill({ status: 200, contentType: im.type, headers: { 'access-control-allow-origin': '*' }, body: Buffer.from(im.b64, 'base64') }) : r.abort();
  });
  const main = { ...sc.main, vinted_dark: sombre };
  pg.selectData = false;
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (req.method() !== 'GET' && req.method() !== 'HEAD') { ecritures.push({ m: req.method(), u: u.slice(0, 160), corps: String(req.postData() || '') }); return j([]); }
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    if (/id=(eq|in)\.\(?(lbc_listings|ebay_listings|vc_listings|harvest_111_listings)/.test(u) && /select=data(&|$)/.test(u)) pg.selectData = true;
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || '';
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq && eq[1] === 'main') return j([projette({ id: 'main', data: main }, sel)]);
    if (eq) return j(sc.LIGNES.filter((r) => r.id === eq[1]).map((r) => projette(r, sel)));
    const dans = /id=in\.\(([^)]*)\)/.exec(u);
    if (dans) { const ids = dans[1].split(','); return j(sc.LIGNES.filter((r) => ids.includes(r.id)).map((r) => projette(r, sel))); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*').replace(/_/g, '.') + '$'); return j(sc.LIGNES.filter((r) => re.test(r.id)).map((r) => projette(r, sel))); }
    return j([]);
  });
  await pg.route(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/api\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => document.querySelector('.vrm-app-shell, .vrm-main, [data-tout-a-jour]') || /pas pu s'afficher/.test(document.body.innerText), null, { timeout: 40000 }).catch(() => {});
  await pg.waitForTimeout(2500);
  return { ctx, pg, errs, ecritures };
}
const toucher = async (pg, tel, sel) => { const l = pg.locator(sel).first(); await l.scrollIntoViewIfNeeded().catch(() => {}); if (tel) await l.tap(); else await l.click(); };
const stock = (pg, k) => pg.evaluate((cle) => { try { return JSON.parse(localStorage.getItem(cle) || 'null'); } catch (_) { return null; } }, k);
const attendreAnnonce = (pg, cle) => pg.waitForSelector(`[data-liaison-annonce="${cle}"]`, { timeout: 12000 }).then(() => true).catch(() => false);
const imagesPretes = async (pg) => { await pg.evaluate(() => document.querySelectorAll('[data-liaison] img').forEach((i) => { i.loading = 'eager'; })).catch(() => {}); await pg.waitForFunction(() => [...document.querySelectorAll('[data-liaison] img')].slice(0, 14).every((i) => i.complete), null, { timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(300); };
// Ce que l'écran MONTRE (data-* et géométrie, jamais un libellé).
const lire = (pg) => pg.evaluate(() => {
  const R = document.querySelector('[data-liaison]'); if (!R) return { ouvert: false };
  const lum = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return null; const p = m[1].split(',').map((x) => parseFloat(x)); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const fondDe = (e) => { let x = e; const piles = []; while (x && x.nodeType === 1) { const c = lum(getComputedStyle(x).backgroundColor); if (c && c.a > 0) { piles.push(c); if (c.a >= 1) break; } x = x.parentElement; } let f = { r: 255, g: 255, b: 255 }; for (const c of piles.reverse()) f = { r: c.r * c.a + f.r * (1 - c.a), g: c.g * c.a + f.g * (1 - c.a), b: c.b * c.a + f.b * (1 - c.a) }; return f; };
  const L = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const contraste = (e) => { const t = lum(getComputedStyle(e).color), f = fondDe(e); if (!t) return 21; const tt = { r: t.r * t.a + f.r * (1 - t.a), g: t.g * t.a + f.g * (1 - t.a), b: t.b * t.a + f.b * (1 - t.a) }; const a = L(tt), b = L(f); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
  const visible = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight; };
  const textes = [...R.querySelectorAll('*')].filter((e) => visible(e) && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1) && !e.closest('[aria-disabled="true"]'));
  const faibles = textes.map((e) => ({ c: Math.round(contraste(e) * 100) / 100, t: e.textContent.trim().slice(0, 30), k: e.className })).filter((x) => x.c < 4.5);
  const petits = textes.filter((e) => parseFloat(getComputedStyle(e).fontSize) < 13).map((e) => e.className);
  const cibles = [...R.querySelectorAll('button, a, input, label.n-lia-lot-ligne')].filter(visible).filter((e) => { const l = e.tagName === 'INPUT' && e.closest('label'); if (!l) return true; const r = l.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).map((e) => { const r = e.getBoundingClientRect(); return { h: Math.round(r.height), w: Math.round(r.width), k: e.className || e.tagName }; }).filter((x) => x.h < 44 || x.w < 44);
  const cartes = [...R.querySelectorAll('[data-liaison-candidate]')].map((c) => {
    const ph = c.querySelector('.n-lia-photo'), im = c.querySelector('img'); const rp = ph.getBoundingClientRect();
    const boites = [...c.children].map((x) => x.getBoundingClientRect()).filter((r) => r.height > 0);
    let chevauche = false; for (let i = 0; i < boites.length; i++) for (let k = i + 1; k < boites.length; k++) if (boites[i].bottom > boites[k].top + 1 && boites[k].bottom > boites[i].top + 1 && boites[i].right > boites[k].left + 1 && boites[k].right > boites[i].left + 1) chevauche = true;
    return { id: c.getAttribute('data-liaison-candidate'), numero: c.getAttribute('data-numero'), niveau: c.getAttribute('data-niveau'), photo: Math.round(rp.width), chargee: !!(im && im.complete && im.naturalWidth > 0), chevauche, place: !!c.querySelector('[data-liaison-place]'), deborde: c.scrollWidth > c.clientWidth + 1 };
  });
  const an = R.querySelector('[data-liaison-annonce]'); const pa = an && an.querySelector('.n-lia-photo');
  const av = R.querySelector('[data-liaison-avant]'); const fig = av ? [...av.querySelectorAll('figure .n-lia-photo')].map((x) => x.getBoundingClientRect()) : [];
  const q = R.querySelector('[data-liaison-question]');
  const d = R.querySelector('[data-liaison-dernier]');
  const cols = ['.n-lia-file', '.n-lia-annonce', '.n-lia-candidates'].map((s) => { const e = R.querySelector(s); const r = e && getComputedStyle(e).display !== 'none' ? e.getBoundingClientRect() : null; return r ? [Math.round(r.left), Math.round(r.width)] : null; });
  return { ouvert: true, vue: R.getAttribute('data-liaison-vue'), lu: R.getAttribute('data-liaison-lu'), annonce: an ? an.getAttribute('data-liaison-annonce') : '', photoAnnonce: pa ? Math.round(pa.getBoundingClientRect().width) : 0,
    position: R.getAttribute('data-liaison-position') || '', cartes, nCandidates: Number((R.querySelector('[data-liaison-candidates]') || { getAttribute: () => 0 }).getAttribute('data-liaison-candidates')),
    avant: av ? { id: av.getAttribute('data-liaison-avant'), coteACote: fig.length === 2 && Math.abs(fig[0].top - fig[1].top) < 2 && fig[1].left >= fig[0].right, photo: fig[0] ? Math.round(fig[0].width) : 0, plein: Math.round((R.querySelector('[data-liaison-relier-avant]') || av).getBoundingClientRect().height), numero: (R.querySelector('[data-liaison-relier-avant]') || { getAttribute: () => '' }).getAttribute('data-numero') } : null,
    question: q ? { sorte: q.getAttribute('data-liaison-question'), refus: q.getAttribute('data-liaison-refus'), doutes: q.getAttribute('data-liaison-doutes'), garder: [...q.querySelectorAll('[data-liaison-garder]')].map((x) => x.getAttribute('data-liaison-garder')), photos: q.querySelectorAll('figure').length } : null,
    dernier: d ? { etat: d.getAttribute('data-liaison-dernier'), numero: d.getAttribute('data-numero') } : null,
    lot: (R.querySelector('[data-liaison-lot-ouvrir]') || { getAttribute: () => null }).getAttribute('data-liaison-lot-ouvrir'), pleins: [...R.querySelectorAll('[data-n-variante="plein"]')].filter(visible).length,
    fin: R.querySelector('[data-liaison-fin]') ? { reste: R.querySelector('[data-liaison-fin]').getAttribute('data-reste'), tard: R.querySelector('[data-liaison-fin]').getAttribute('data-plus-tard'), contra: R.querySelector('[data-liaison-fin]').getAttribute('data-contradictions') } : null,
    contras: [...R.querySelectorAll('[data-liaison-contradiction]')].map((c) => ({ type: c.getAttribute('data-type'), cotes: [...c.querySelectorAll('[data-liaison-cote]')].map((x) => x.getAttribute('data-liaison-cote')), garder: c.querySelectorAll('[data-liaison-garder-numero], [data-liaison-cest], [data-liaison-delier]').length })),
    faibles: faibles.slice(0, 6), petits: petits.slice(0, 4), cibles: cibles.slice(0, 6), cols, deborde: document.documentElement.scrollWidth > innerWidth + 1 || [...R.querySelectorAll('*')].some((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1; }) };
});
const ecrit = (ecritures, re) => ecritures.some((e) => re.test(e.corps));

(async () => {
  let b;
  srv.listen(PORT);
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const gen = await b.newPage();
    await gen.route('**/*', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: PAGE_GEN }));
    await gen.goto('http://localhost/fabrique');
    const F = await gen.evaluate((l) => window.__fabrique(l), PHOTOS);
    const fineP1 = await gen.evaluate(([a, c]) => window.__fine(a, c), [`data:${F.P1.type};base64,${F.P1.b64}`, `data:${F.P1cdn.type};base64,${F.P1cdn.b64}`]);
    console.log(`── deuxième mesure (src/photoFine.js) : P1 ~ P1 passée par un autre site ${JSON.stringify(fineP1)}`);
    await gen.close();

    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 945 }].filter((v) => !process.env.BANC_SEUL || String(v.width) === process.env.BANC_SEUL)) {
      const tel = vp.width < 600, nomVp = tel ? '390' : '1512';
      for (const sombre of [false, true].filter((x) => !process.env.BANC_THEME || (x ? 'sombre' : 'clair') === process.env.BANC_THEME)) {
        const th = sombre ? 'sombre' : 'clair', T = `${nomVp} ${th}`;
        const shot = async (pg, nom) => { if (CAPT) await pg.screenshot({ path: path.join(CAPT, `liaison-${nomVp}-${th}-${nom}.png`) }); };
        const commun = (m, ou) => {
          dit(m.faibles.length === 0, `${T} ${ou} · contrastes ≥ 4,5:1 sur le fond rendu`, JSON.stringify(m.faibles));
          dit(m.cibles.length === 0, `${T} ${ou} · cibles ≥ 44 px`, JSON.stringify(m.cibles));
          dit(!m.deborde && m.petits.length === 0 && m.pleins <= 1, `${T} ${ou} · aucun débordement, rien sous 13 px, un seul plein`, JSON.stringify({ d: m.deborde, p: m.petits, pleins: m.pleins }));
        };
        console.log(`\n── ${T}`);
        await essaie(`P ${T}`, async () => {
          const { ctx, pg, errs, ecritures } = await ouvrir(b, vp, scenario(F, { fine: fineP1 }), { sombre, images: F });
          let touchers = 0; const tap = async (sel) => { touchers++; await toucher(pg, tel, sel); };
          await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:liaison-ouvrir', { detail: {} })));
          const ok1 = await attendreAnnonce(pg, 'Leboncoin:5001'); await imagesPretes(pg);
          let m = await lire(pg);
          await shot(pg, '1-sure');
          dit(ok1 && m.ouvert && m.lu === '1' && m.annonce === 'Leboncoin:5001' && m.position === '1 sur 5', `${T} P1 le parcours s’ouvre sur la « sûre », « 1 sur 5 »`, JSON.stringify({ a: m.annonce, p: m.position, lu: m.lu }));
          dit(m.avant && m.avant.numero === '124' && m.avant.coteACote && m.avant.photo >= 140 && m.avant.plein >= 50, `${T} P1 photo contre photo (≥ 140 px), UN plein « Relier à N°124 »`, JSON.stringify(m.avant));
          dit(!ecrit(ecritures, /vrm_lbc_liens|vrm_ebay_liens|vrm_vc_liens|vrm_liaison_sites/), `${T} P1 ouvrir : rien relié, rien noté`, '');
          if (tel) dit(m.cols[0] === null, `${T} P1 téléphone : une annonce à la fois (pas de file)`, JSON.stringify(m.cols)); else dit(m.cols.every(Boolean) && m.cols[0][0] < m.cols[1][0] && m.cols[1][0] < m.cols[2][0], `${T} P1 ordinateur : trois volets (file · annonce · candidates)`, JSON.stringify(m.cols));
          commun(m, 'P1');
          // 1 toucher : la sûre.
          touchers = 0; await tap('[data-liaison-relier-avant]');
          const ok2 = await attendreAnnonce(pg, 'eBay:2001'); await pg.waitForTimeout(700);
          const l1 = await stock(pg, 'vrm_lbc_liens');
          dit(touchers === 1 && l1 && String(l1[5001]) === '124' && ok2, `${T} P2 UN toucher ⇒ vrm_lbc_liens[5001] = 124, annonce suivante (aucun écran intermédiaire)`, JSON.stringify({ touchers, l: l1 && l1[5001], ok2 }));
          await pg.waitForFunction(() => { const d = document.querySelector('[data-liaison-dernier]'); return d && d.getAttribute('data-liaison-dernier') !== 'attente'; }, null, { timeout: 12000 }).catch(() => {});
          await imagesPretes(pg); m = await lire(pg); await shot(pg, '2-a-verifier');
          dit(m.dernier && m.dernier.etat === 'verifie' && m.dernier.numero === '124', `${T} P2 la relecture confirme : « Relié à N°124 · vérifié »`, JSON.stringify(m.dernier));
          const jl = await stock(pg, 'vrm_liaison_sites');
          dit(jl && jl['lien:Leboncoin:5001'] && jl['lien:Leboncoin:5001'].par === 'photo-sure' && !!jl['lien:Leboncoin:5001'].at, `${T} P2 le lien porte sa preuve (« même photo, sûre ») et sa date`, JSON.stringify(jl && jl['lien:Leboncoin:5001']));
          // eBay : « à vérifier » en tête, toucher = relier.
          dit(m.annonce === 'eBay:2001' && m.cartes[0] && m.cartes[0].numero === '125' && m.cartes[0].niveau === 'verifier' && !m.avant, `${T} P3 eBay : N°125 « même photo · à vérifier » en tête, jamais mise en avant`, JSON.stringify(m.cartes.slice(0, 2)));
          dit(m.cartes.length >= 4 && m.cartes.every((c) => c.photo >= 140 && !c.chevauche && !c.deborde) && m.cartes.slice(0, 4).every((c) => c.chargee), `${T} P3 des cartes à grande photo (≥ 140 px), aucun texte superposé`, JSON.stringify(m.cartes.slice(0, 3)));
          commun(m, 'P3');
          touchers = 0; await tap('[data-liaison-candidate="9002"]');
          const ok3 = await attendreAnnonce(pg, 'Vestiaire:vc-9'); await pg.waitForTimeout(700);
          const le = await stock(pg, 'vrm_ebay_liens');
          dit(touchers === 1 && le && le[2001] && le[2001].pairId === '9002' && le[2001].par === 'photo' && ok3, `${T} P3 UN toucher sur la candidate ⇒ vrm_ebay_liens[2001] = { pairId 9002 }`, JSON.stringify(le && le[2001]));
          // Vestiaire : deux paires possibles + deux N° en jeu ⇒ UNE question.
          await imagesPretes(pg); m = await lire(pg);
          dit(m.cartes.slice(0, 2).map((c) => c.numero).sort().join() === '300,301' && m.cartes.slice(0, 2).every((c) => c.niveau === 'verifier') && !m.avant, `${T} P4 Vestiaire : la photo est sur DEUX paires (300, 301), aucune mise en avant`, JSON.stringify(m.cartes.slice(0, 3)));
          touchers = 0; await tap('[data-liaison-candidate="9003"]'); await pg.waitForSelector('[data-liaison-question]', { timeout: 6000 }).catch(() => {}); await imagesPretes(pg);
          m = await lire(pg); await shot(pg, '4-deux-numeros');
          dit(m.question && m.question.sorte === 'demander' && m.question.garder.join() === '300,31' && m.question.photos >= 2 && !(await stock(pg, 'vrm_vc_liens') || {})['vc-9'], `${T} P4 deux N° en jeu (31 et 300) ⇒ il est DEMANDÉ lequel est sur le carton ; rien d’écrit`, JSON.stringify(m.question));
          commun(m, 'P4');
          await tap('[data-liaison-garder="300"]');
          const ok4 = await attendreAnnonce(pg, 'Leboncoin:5002'); await pg.waitForTimeout(700);
          const lv = await stock(pg, 'vrm_vc_liens');
          dit(touchers === 2 && lv && lv['vc-9'] && String(lv['vc-9'].numero) === '300' && String(lv['vc-9'].de) === '31' && ok4, `${T} P4 « N°300 » ⇒ relié, le N°31 « à barrer » (2 touchers)`, JSON.stringify({ touchers, l: lv && lv['vc-9'] }));
          // La capture de Julien : un titre identique parmi 30 ⇒ première.
          await imagesPretes(pg); m = await lire(pg); await shot(pg, '5-titre-identique');
          dit(m.annonce === 'Leboncoin:5002' && m.cartes[0] && m.cartes[0].numero === '234' && !m.avant && !m.cartes[0].niveau, `${T} P5 « Adidas Spezial vert taille 39,5 » : la paire N°234 (même titre, même taille) est PREMIÈRE, sans être mise en avant`, JSON.stringify(m.cartes.slice(0, 3).map((c) => c.numero)));
          commun(m, 'P5');
          touchers = 0; await tap('[data-liaison-candidate="9234"]');
          const ok5 = await attendreAnnonce(pg, 'Leboncoin:5004'); await pg.waitForTimeout(700);
          dit(touchers === 1 && String(((await stock(pg, 'vrm_lbc_liens')) || {})[5002]) === '234' && ok5, `${T} P5 UN toucher ⇒ reliée à N°234`, String(touchers));
          // Tailles lues différentes ⇒ refus, rien d'écrit.
          await pg.fill('[data-liaison-chercher]', '124'); await pg.waitForTimeout(500);
          m = await lire(pg);
          dit(m.cartes[0] && m.cartes[0].numero === '124', `${T} P6 chercher « 124 » ⇒ N°124 en tête`, JSON.stringify(m.cartes.slice(0, 2).map((c) => c.numero)));
          await tap('[data-liaison-candidate="9001"]'); await pg.waitForSelector('[data-liaison-question]', { timeout: 6000 }).catch(() => {}); await imagesPretes(pg);
          m = await lire(pg); await shot(pg, '6-refus-taille');
          dit(m.question && m.question.sorte === 'refus' && m.question.refus === 'taille' && !((await stock(pg, 'vrm_lbc_liens')) || {})[5004], `${T} P6 taille 45 contre 42 ⇒ REFUS expliqué, rien d’écrit, aucun moyen de passer`, JSON.stringify(m.question));
          commun(m, 'P6');
          await tap('[data-liaison-question-non]'); await pg.waitForTimeout(300);
          await tap('[data-liaison-sortie="tard"]');
          await pg.waitForSelector('[data-liaison-fin]', { timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(1200);
          m = await lire(pg); await shot(pg, '7-fin');
          dit(m.fin && m.fin.reste === '0' && m.fin.tard === '1' && m.fin.contra === '1', `${T} P7 la fin : « Tout est relié », 1 « plus tard », 1 lien à vérifier`, JSON.stringify(m.fin));
          commun(m, 'P7');
          // Les liens qui se contredisent : les deux côtés, rien de tranché.
          await tap('[data-liaison-fin-contradictions]'); await pg.waitForSelector('[data-liaison-contradiction]', { timeout: 6000 }).catch(() => {}); await imagesPretes(pg);
          m = await lire(pg); await shot(pg, '8-contradiction');
          dit(m.contras.length === 1 && m.contras[0].type === 'deux-numeros' && m.contras[0].cotes.join() === 'annonce:2002,numero:126,numero:125' && m.contras[0].garder >= 3, `${T} P8 eBay 2002 : le lien dit N°126, la référence écrite dit N°125 — les deux montrés, « Garder celui-ci » / « C’est N°125 » / « Délier »`, JSON.stringify(m.contras));
          dit(String((((await stock(pg, 'vrm_ebay_liens')) || {})[2002] || {}).pairId) === '9005', `${T} P8 … et RIEN n’a été tranché tout seul (le lien est intact)`, '');
          commun(m, 'P8');
          await tap('[data-liaison-garder-numero="126"]'); await pg.waitForTimeout(900);
          const jg = await stock(pg, 'vrm_liaison_sites');
          dit(jg && Object.keys(jg).some((k) => /^garde:2n:eBay:2002/.test(k)), `${T} P8 « Garder celui-ci » ⇒ noté, sur SON geste`, JSON.stringify(Object.keys(jg || {})));
          dit(!pg.selectData, `${T} les annonces lues par PROJECTION (jamais select=data)`, '');
          dit(errs.length === 0, `${T} aucune erreur JS`, errs.slice(0, 2).join(' | '));
          await ctx.close();
        });
        // Le lot, « Délier », l'entrée d'un site.
        await essaie(`L ${T}`, async () => {
          const sc = scenario(F, { fine: fineP1 });
          // Deux « sûres » : l'annonce eBay 2001 mesurée aussi.
          sc.LIGNES.find((r) => r.id === 'photo_meme_verif').data.payload.couples[`ebay|2001|${cleDe(uE('P2vig'))}#111|9002|${cleDe(uV('P2'))}`] = { ...fineP1, v: 1, at: iso(1) };
          const { ctx, pg, errs } = await ouvrir(b, vp, sc, { sombre, tab: 'leboncoin', images: F });
          // (19 nov., intégration) Les rangées d'annonces appartiennent à l'écran « Annonces à égalité » : il ouvre le parcours par
          // `ouvrirLiaison({ site, id })` — rejoué ici tel quel. Le parcours s'ouvre sur CETTE annonce ; l'ancienne feuille n'existe plus.
          await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:liaison-ouvrir', { detail: { site: 'Leboncoin', id: '5002' } })));
          { const ok = await attendreAnnonce(pg, 'Leboncoin:5002'); const anc = await pg.locator('.vrm-lbc-choix').count();
            dit(ok && anc === 0, `${T} L1 ouvrirLiaison({ site, id }) ouvre LE parcours sur cette annonce — l’ancienne feuille « Relier à Vinted » n’existe plus`, JSON.stringify({ ok, anc }));
            await toucher(pg, tel, '[data-liaison] .n-barre-retour'); await pg.waitForTimeout(600); }
          // Le sens inverse : « Relier à Vestiaire » depuis la fiche Vinted de la N°301 (`vrm:lien-vc`, sens 'vinted') ⇒ LE parcours,
          // sur Vestiaire, la N°301 EN TÊTE (son N° tapé) — rien n'est relié sans son toucher, l'ancienne feuille ne s'ouvre pas.
          await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:lien-vc', { detail: { sens: 'vinted', id: '9004', num: '301', titre: 'x' } })));
          { const ok = await attendreAnnonce(pg, 'Vestiaire:vc-9'); await pg.waitForTimeout(500); const m4 = await lire(pg);
            const ancVc = await pg.locator('.vrm-lvc-feuille, [data-lien-vc-feuille]').count();
            dit(ok && m4.cartes[0] && m4.cartes[0].numero === '301' && ancVc === 0 && !((await stock(pg, 'vrm_vc_liens')) || {})['vc-9'], `${T} L4 « Relier à Vestiaire » depuis la fiche Vinted ⇒ le parcours, la N°301 en tête, rien relié`, JSON.stringify({ ok, c: m4.cartes.slice(0, 2).map((c) => c.numero), ancVc }));
            await toucher(pg, tel, '[data-liaison] .n-barre-retour'); await pg.waitForTimeout(600); }
          await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:liaison-ouvrir', { detail: {} })));
          await attendreAnnonce(pg, 'Leboncoin:5001'); await pg.waitForTimeout(500);
          let m = await lire(pg);
          dit(m.lot === '2', `${T} L2 deux « sûres » ⇒ « Relier les 2 sûres »`, String(m.lot));
          await toucher(pg, tel, '[data-liaison-lot-ouvrir]'); await pg.waitForSelector('[data-liaison-lot]', { timeout: 6000 }).catch(() => {}); await imagesPretes(pg); await pg.waitForTimeout(500);
          await shot(pg, '9-lot');
          const lot = await pg.evaluate(() => ({ lignes: [...document.querySelectorAll('[data-liaison-lot-ligne]')].map((l) => ({ k: l.getAttribute('data-liaison-lot-ligne'), photos: [...l.querySelectorAll('.n-lia-photo')].map((p) => Math.round(p.getBoundingClientRect().width)), coche: l.getAttribute('data-coche') })), n: document.querySelector('[data-liaison-lot-valider]').getAttribute('data-liaison-lot-valider'), vu: document.querySelector('[data-liaison-lot-valider]').getAttribute('data-vu') }));
          dit(lot.lignes.length === 2 && lot.lignes.every((l) => l.photos.length === 2 && l.photos.every((w) => w >= 88) && l.coche === '1') && lot.n === '2' && lot.vu === '1', `${T} L2 la relecture : chaque ligne photo contre photo, cochée ; UN geste « Relier ces 2 »`, JSON.stringify(lot));
          dit(!((await stock(pg, 'vrm_lbc_liens')) || {})[5001], `${T} L2 ouvrir la relecture ne relie rien`, '');
          m = await lire(pg); commun(m, 'L2');
          await toucher(pg, tel, '[data-liaison-lot-valider]'); await pg.waitForTimeout(1500);
          const l1 = await stock(pg, 'vrm_lbc_liens'), l2 = await stock(pg, 'vrm_ebay_liens');
          dit(l1 && String(l1[5001]) === '124' && l2 && l2[2001] && l2[2001].pairId === '9002' && l2[2001].par === 'photo-sure', `${T} L2 UN geste ⇒ les 2 reliées (Leboncoin 5001 → 124, eBay 2001 → 125)`, JSON.stringify({ l: l1 && l1[5001], e: l2 && l2[2001] }));
          // Délier depuis l'annonce : l'état d'avant.
          await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:liaison-ouvrir', { detail: { site: 'Leboncoin', id: '5001' } })));
          await pg.waitForSelector('[data-liaison-fiche="Leboncoin:5001"]', { timeout: 12000 }).catch(() => {}); await imagesPretes(pg);
          await shot(pg, '10-reliee');
          const fi = await pg.evaluate(() => { const f = document.querySelector('[data-liaison-fiche]'); return f ? { etat: f.getAttribute('data-etat'), photos: f.querySelectorAll('figure').length, delier: !!f.querySelector('[data-liaison-delier]') } : null; });
          dit(fi && fi.etat === 'relie' && fi.photos === 2 && fi.delier, `${T} L3 une annonce reliée s’ouvre sur son lien : les deux photos, la preuve, « Délier »`, JSON.stringify(fi));
          m = await lire(pg); commun(m, 'L3');
          await toucher(pg, tel, '[data-liaison-delier="5001"]'); await pg.waitForTimeout(1200);
          const l3 = await stock(pg, 'vrm_lbc_liens'), j3 = await stock(pg, 'vrm_liaison_sites');
          dit(l3 && l3[5001] === undefined && String(l3[5003]) === '126' && j3 && !j3['lien:Leboncoin:5001'], `${T} L3 « Délier » rend l’état d’avant (le lien de 5001 retiré, celui de 5003 intact)`, JSON.stringify(l3));
          dit(errs.length === 0, `${T} aucune erreur JS`, errs.slice(0, 2).join(' | '));
          await ctx.close();
        });
        // R · RELIER DEPUIS LA LISTE (20 nov.) : la proposition sur la rangée d'Annonces (tableau à 1512, liste à 390).
        await essaie(`R ${T}`, async () => {
          const { ctx, pg, errs } = await ouvrir(b, vp, scenario(F, { fine: fineP1 }), { sombre, tab: 'leboncoin', images: F });
          await pg.waitForSelector('[data-eg-prop-annonce="Leboncoin:5001"]', { timeout: 20000 }).catch(() => {});
          const lireProp = () => pg.evaluate(() => [...document.querySelectorAll('[data-eg-prop-annonce]')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => {
            const btn = e.querySelector('[data-eg-relier-prop]'), autre = e.querySelector('[data-eg-autre]'), propre = e.querySelector('[data-eg-propre]');
            const h = (x) => { if (!x) return 0; const pb = getComputedStyle(x, '::before'); const ext = pb && pb.content && pb.content !== 'none' && pb.position === 'absolute' ? Math.max(0, -parseFloat(pb.top || '0')) + Math.max(0, -parseFloat(pb.bottom || '0')) : 0; return Math.round(x.getBoundingClientRect().height + ext); };
            const tx = e.querySelector('.n-eg-prop-texte'), cont = e.closest('.n-groupe-carte, .n-tt-table, table, [data-eg-liste]') || document.body, rc = cont.getBoundingClientRect();
            return { a: e.getAttribute('data-eg-prop-annonce'), niveau: e.getAttribute('data-eg-prop'), numero: e.getAttribute('data-eg-prop-numero'), forme: e.getAttribute('data-eg-prop-forme'), hRelier: h(btn), hAutre: h(autre), hPropre: h(propre), hBloc: Math.round(e.getBoundingClientRect().height),
              wTexte: tx ? Math.round(tx.getBoundingClientRect().width) : null, deborde: [...e.querySelectorAll('*')].some((x) => { const r = x.getBoundingClientRect(); return r.width > 0 && (r.right > Math.min(innerWidth, rc.right) + 1); }),
              qui: [...e.querySelectorAll('*')].filter((x) => { const r = x.getBoundingClientRect(); return r.width > 0 && (r.right > Math.min(innerWidth, rc.right) + 1); }).slice(0, 2).map((x) => String(x.className || x.tagName).slice(0, 40) + '@' + Math.round(x.getBoundingClientRect().right) + '>' + Math.round(Math.min(innerWidth, rc.right))) };
          }));
          let props = await lireProp();
          const p1 = props.find((x) => x.a === 'Leboncoin:5001'), p2 = props.find((x) => x.a === 'Leboncoin:5002'), p4 = props.find((x) => x.a === 'Leboncoin:5004');
          await pg.locator('[data-eg-prop-annonce="Leboncoin:5001"]').first().scrollIntoViewIfNeeded().catch(() => {}); await pg.waitForTimeout(400);
          await shot(pg, '11-liste');
          dit(p1 && p1.niveau === 'sur' && p1.numero === '124' && p1.forme === (tel ? 'ligne' : 'cellule') && (!tel || p1.hBloc <= 56), `${T} R1 la rangée de l’annonce 5001 montre « N°124 ? · à relier · sûr » (${tel ? 'liste' : 'tableau'})`, JSON.stringify(props.slice(0, 4)));
          dit(p2 && p2.niveau === 'verifier' && p2.numero === '234', `${T} R1 « Adidas Spezial vert 39,5 » : « N°234 ? · à vérifier » sur sa rangée (la capture de Julien)`, JSON.stringify(p2));
          dit(tel ? !p4 : (p4 && p4.niveau === 'aucune' && p4.hPropre >= 44), `${T} R1 taille 45 contre 42 : aucune proposition — ${tel ? 'rien sous la rangée (le geste est au balayage)' : '« Que sur ce site » en un toucher'}`, JSON.stringify(p4));
          dit(props.every((x) => !x.deborde && (x.wTexte == null || x.wTexte >= 70) && (x.niveau === 'aucune' || (x.hRelier >= 44 && (x.forme === 'ligne' || x.hAutre >= 44)))), `${T} R1 cibles ≥ 44 px, aucun débordement, texte jamais coupé lettre à lettre`, JSON.stringify(props));
          dit(!((await stock(pg, 'vrm_lbc_liens')) || {})[5001], `${T} R1 montrer la proposition ne relie rien`, '');
          let touchers = 0;
          touchers++; await toucher(pg, tel, '[data-eg-relier-prop="Leboncoin:5001"]');
          await pg.waitForFunction(() => { try { return (JSON.parse(localStorage.getItem('vrm_lbc_liens') || '{}') || {})['5001'] === '124'; } catch (_) { return false; } }, null, { timeout: 8000 }).catch(() => {});
          const l = await stock(pg, 'vrm_lbc_liens'), j = await stock(pg, 'vrm_liaison_sites');
          const parcours = await pg.locator('[data-liaison]').count();
          await pg.waitForTimeout(300); await shot(pg, '12-relie-liste');
          dit(touchers === 1 && l && String(l[5001]) === '124' && j && j['lien:Leboncoin:5001'] && j['lien:Leboncoin:5001'].par === 'photo-sure' && parcours === 0,
            `${T} R2 UN toucher sur « Relier » ⇒ vrm_lbc_liens[5001] = 124, preuve « même photo, sûre », sans ouvrir le parcours`, JSON.stringify({ touchers, l: l && l[5001], j: j && j['lien:Leboncoin:5001'], parcours }));
          // « Autre… » ouvre le parcours sur CETTE annonce.
          if (tel) {
            // Au téléphone, « Autre… » est au balayage de la rangée (ouvert ici par l'appui long / clic droit, la même action).
            const rangee = await pg.evaluateHandle(() => { const x = document.querySelector('[data-eg-prop-annonce="Leboncoin:5002"]'); return x ? x.previousElementSibling : null; });
            await pg.evaluate((el) => { if (el) { el.scrollIntoView({ block: 'center' }); (el.querySelector('.n-rangee-corps') || el).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 200, clientY: 200 })); } }, rangee);
            await pg.waitForTimeout(400); await shot(pg, '13-balayage');
            await pg.evaluate((el) => { const b = el && el.querySelector('.n-rangee-action'); if (b) b.click(); }, rangee);
          } else {
            await pg.locator('[data-eg-autre="Leboncoin:5002"]').first().scrollIntoViewIfNeeded().catch(() => {});
            await toucher(pg, tel, '[data-eg-autre="Leboncoin:5002"]');
          }
          const okAutre = await attendreAnnonce(pg, 'Leboncoin:5002');
          dit(okAutre, `${T} R3 « Autre… » ouvre le parcours sur CETTE annonce`, String(okAutre));
          dit(errs.length === 0, `${T} R aucune erreur JS`, errs.slice(0, 2).join(' | '));
          await ctx.close();
        });
      }
      await essaie(`C ${nomVp}`, async () => {
        const { ctx, pg, errs, ecritures } = await ouvrir(b, vp, scenario(F, { fine: fineP1, vintedKO: true }), { tab: 'leboncoin', images: F });
        const e = await pg.evaluate(() => !!document.querySelector('[data-liaison-entree]'));
        dit(!e, `${nomVp} C annonces Vinted PAS LUES : aucune ligne « à relier » (pas su ≠ 0, ≠ N)`, String(e));
        await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:liaison-ouvrir', { detail: {} })));
        await pg.waitForSelector('[data-liaison-pas-su]', { timeout: 12000 }).catch(() => {});
        const m = await lire(pg);
        if (CAPT) await pg.screenshot({ path: path.join(CAPT, `liaison-${nomVp}-pas-su.png`) });
        dit(m.ouvert && m.lu === '0' && !m.annonce && !m.fin, `${nomVp} C le parcours dit « pas lues » — jamais « tout est relié », rien à toucher`, JSON.stringify({ lu: m.lu, a: m.annonce, fin: m.fin }));
        dit(!ecrit(ecritures, /vrm_lbc_liens|vrm_liaison_sites/), `${nomVp} C rien d’écrit`, '');
        dit(errs.length === 0, `${nomVp} aucune erreur JS`, errs.slice(0, 2).join(' | '));
        await ctx.close();
      });
    }
  } finally {
    if (b) await b.close();
    srv.close();
  }
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
