// ════════════════════════════════════════════════════════════════════════════
//  Banc d'ÉCRAN : « Même photo · à relier » (15 nov., lot meme-photo, extension 5.384).
//
//  Julien : « quand je poste une paire sur Vinted et que je la poste après sur Leboncoin sans
//  avoir dit que c'était la même, je veux que VRM propose que c'est exactement la même — vraiment
//  exactement la même photo ». Données ET images INVENTÉES (le dépôt est public) : les chaussures
//  dessinées par le banc du seuil (`photos-comptes-seuil.cjs`, mêmes fonctions), passées par un
//  « autre site » (réduite 50 % + JPEG 60 + WebP 60, ou vignette), servies comme leboncoin.fr,
//  ebayimg.com, vestiairecollective.com et vinted.net ; empreintes du VRAI src/photoEmpreinte.js,
//  rangées à la forme de l'extension : `photo_emprunte_{uid}` (Vinted), `photo_empreinte_{lbc|ebay|vc}`.
//    Vinted (compte 111) : 9001 P1 N°124 · 9002 P2 N°125 · 9003 P3 N°300 · 9004 P3 (même fichier) N°301
//                          · 9005 P6 N°126
//    Leboncoin : 5001 P1 passée par un autre site, SANS lien ⇒ « Même photo que N°124 »
//                5002 P1 vue 3 (la même paire, une AUTRE photo) ⇒ rien
//                5003 P6 avec un lien posé à la main (N°126) ⇒ rien
//    eBay      : 2001 P2 en vignette, sans SKU ⇒ « Même photo que N°125 »
//    Vestiaire : vc-9 P3 ⇒ AMBIGU (N°300 et N°301) : les deux montrées, IL choisit
//  Ce qui est jugé, sur ce qui est RENDU (data-*), 390 tactile et 1512, clair et sombre,
//  captures écrites (CAPTURES=<dossier>) pour être REGARDÉES :
//   M1 Ma journée : UNE carte ambre `[data-journee-meme-photo]`, data-n = 3 ;
//   M2 la feuille : 2 propositions (Leboncoin 5001 ⇒ N°124, eBay 2001 ⇒ N°125), 1 ambiguë (vc-9 :
//      N°300 + N°301) ; 5002 et 5003 absentes ; les deux photos CHARGÉES, côte à côte ; gestes ≥ 44 px ;
//      aucun débordement ; ouvrir la feuille n'écrit rien ;
//   M3 « Relier à N°124 » ⇒ `vrm_lbc_liens` porte 5001 = 124 (la MÊME identité que le lien posé à
//      la main), la proposition disparaît ;
//   M4 « Ce n'est pas la même » (eBay 2001) ⇒ `vrm_meme_photo_non` noté, la proposition disparaît ;
//      rien n'est relié ;
//   M5 Annonces → Leboncoin : la ligne compacte « 1 annonce à relier » ; elle ouvre la feuille du site ;
//   C  lecture des empreintes ratée (500) : aucune carte ; la feuille dit « pas lues ».
//  `BANC_DIST=<dist>` : rendre un autre build (l'arbre d'avant).  `BANC_SEUL=390|1512`, `BANC_THEME=clair|sombre`.
//  Lancer :
//    npm run build && BANC_PORT=$((20000+RANDOM%40000)) node -r ./scripts/bancs/_porte-banc.cjs scripts/bancs/meme-photo.cjs
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path');
const fs = require('fs'), http = require('http');
const { chromium } = require('playwright');
const { metaVersData } = require('./_meta.cjs');
const RACINE = path.join(__dirname, '..', '..');
const DIST = process.env.BANC_DIST || path.join(RACINE, 'dist');
const PORT = Number(process.env.BANC_PORT) || 9683;
const CAPT = process.env.CAPTURES || '';
if (CAPT) fs.mkdirSync(CAPT, { recursive: true });

const maintenant = new Date(2026, 10, 15, 15, 30, 0);
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
// (16 nov.) Le code d'origine (SHA-256 du fichier téléversé, extension 5.401) et le nom d'image rendu par Leboncoin.
const CODE = (t) => require('crypto').createHash('sha256').update('fichier-' + t).digest('hex');
const NOM_5004 = require('crypto').createHash('sha1').update('lbc-5004').digest('hex'), NOM_5005 = require('crypto').createHash('sha1').update('lbc-5005').digest('hex');
const IMG_LBC = (n) => `https://img.leboncoin.fr/api/v1/lbcpb1/images/${n.slice(0, 2)}/${n.slice(2, 4)}/${n.slice(4, 6)}/${n}.jpg?rule=ad-large`;

function scenario(F, o = {}) {
  const h = (n) => F[n].h;
  const vinted = [[9001, 'P1', '124', 'Nike Air Max 1 blanche 42'], [9002, 'P2', '125', 'Adidas Samba noire 41'], [9003, 'P3', '300', 'New Balance 550 verte 43'], [9004, 'P3', '301', 'New Balance 550 verte 43'], [9005, 'P6', '126', 'Asics Gel 1130 grise 44']];
  const numeros = Object.fromEntries(vinted.map(([id, p, n, t]) => [String(id), { numero: n, title: t, photo: uV(p), accountId: '111', numberedAt: iso(500) }]));
  const items = vinted.map(([id, p, n, t]) => ({ id, title: t, photo: { url: uV(p) }, url: `https://www.vinted.fr/items/${id}-inventee`, price: { amount: '80.0', currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, created_at_ts: iso(300) }));
  const lbc = {
    5001: { id: 5001, account: 'lbc-account:987', accountName: 'boutique-lbc', subject: 'Basket blanche 42', status: 'active', price: 80, images: [uL('P1cdn')], seenAt: iso(1), url: 'https://www.leboncoin.fr/ad/chaussures/5001' },
    5002: { id: 5002, account: 'lbc-account:987', accountName: 'boutique-lbc', subject: 'Nike Air Max 1 blanche 42', status: 'active', price: 80, images: [uL('P1v3')], seenAt: iso(1), url: 'https://www.leboncoin.fr/ad/chaussures/5002' },
    5003: { id: 5003, account: 'lbc-account:987', accountName: 'boutique-lbc', subject: 'Asics grise', status: 'active', price: 70, images: [uL('P6')], seenAt: iso(1), url: 'https://www.leboncoin.fr/ad/chaussures/5003' },
    // (16 nov., lot photo-identite-sites) Le CODE D'ORIGINE : 5004 = le même FICHIER envoyé que la Samba N°125 (Vinted 9002)
    // ⇒ identité exacte ; 5005 = le même fichier que 9003 ET 9004 (N°300, N°301) ⇒ ambigu, dit.
    ...(o.origine ? {
      5004: { id: 5004, account: 'lbc-account:987', accountName: 'boutique-lbc', subject: 'Samba noire 41', status: 'active', price: 75, images: [IMG_LBC(NOM_5004)], seenAt: iso(1), url: 'https://www.leboncoin.fr/ad/chaussures/5004' },
      5005: { id: 5005, account: 'lbc-account:987', accountName: 'boutique-lbc', subject: 'NB 550 verte', status: 'active', price: 90, images: [IMG_LBC(NOM_5005)], seenAt: iso(1), url: 'https://www.leboncoin.fr/ad/chaussures/5005' } } : {}),
  };
  const LIGNES = [
    { id: 'harvest_111_listings', data: { capturedAt: iso(1), uid: '111', payload: { items, pagination: { total_entries: items.length } } } },
    { id: 'photo_emprunte_111', data: { capturedAt: iso(1), payload: { annonces: Object.fromEntries(vinted.map(([id, p]) => [String(id), { [cleDe(uV(p))]: h(p) }])) } } },
    { id: 'photo_empreinte_lbc', data: { capturedAt: iso(1), payload: { annonces: { 5001: { [cleDe(uL('P1cdn'))]: h('P1cdn') }, 5002: { [cleDe(uL('P1v3'))]: h('P1v3') }, 5003: { [cleDe(uL('P6'))]: h('P6') }, 5009: { [cleDe(uL('P1cdn'))]: h('P1cdn') } } } } },
    { id: 'photo_empreinte_ebay', data: { capturedAt: iso(1), payload: { annonces: { 2001: { [cleDe(uE('P2vig'))]: h('P2vig') } } } } },
    { id: 'photo_empreinte_vc', data: { capturedAt: iso(1), payload: { annonces: { 'vc-9': { [cleDe(uC('P3cdn'))]: h('P3cdn') } } } } },
    // (15 nov., lot meme-photo-sure) La deuxième mesure, à la forme de l'extension 5.388 : Leboncoin 5001 × N°124
    // mesuré (le VRAI score des deux images) ⇒ « sûr » ; eBay 2001 jamais mesuré (pas d'hôte) ⇒ « à vérifier ».
    ...(o.fine != null ? [{ id: 'photo_meme_verif', data: { capturedAt: iso(1), payload: { version: 1, couples: { [`lbc|5001|${cleDe(uL('P1cdn'))}#111|9001|${cleDe(uV('P1'))}`]: { ...o.fine, v: 1, at: iso(1) } } } } }] : []),
    ...(o.origine ? [
      { id: 'photo_origine_vinted', data: { capturedAt: iso(1), payload: { version: 1, annonces: { 9002: { codes: [CODE('samba')], compte: '111', at: iso(2) }, 9003: { codes: [CODE('nb550')], compte: '111', at: iso(2) }, 9004: { codes: [CODE('nb550')], compte: '111', at: iso(2) } } } } },
      { id: 'photo_origine_lbc', data: { capturedAt: iso(1), payload: { version: 1, images: { [NOM_5004]: { code: CODE('samba'), at: iso(1) }, [NOM_5005]: { code: CODE('nb550'), at: iso(1) } } } } }] : []),
    { id: 'lbc_listings', data: { items: { ...lbc,
      // L'annonce d'un AUTRE vendeur vue en naviguant (mesuré chez lui : 49 sur 60) — même photo que N°124 : jamais proposée.
      5009: { id: 5009, account: 'lbc-account:inconnu', accountName: 'quelqu-un', subject: 'Basket blanche', status: 'active', images: [uL('P1cdn')], seenAt: iso(1) } },
      lectures: { 'lbc-account:987': { at: iso(1), complet: true } } } },
    { id: 'lbc_accounts', data: { accounts: { 987: { id: 'lbc-account:987', name: 'boutique-lbc', sessionAt: iso(1) } } } },
    { id: 'ebay_listings', data: { capturedAt: iso(1), complet: true, items: [{ itemId: '2001', title: 'Samba noire', photo: uE('P2vig'), sku: '', listingStatus: 'Active' }] } },
    { id: 'vc_listings', data: { capturedAt: iso(1), complet: true, items: { 'vc-9': { compte: 'vcmoi', titre: 'NB 550 verte', statut: 'En vente', photo: uC('P3cdn'), vuAt: iso(1) } }, liens: {} } },
  ];
  const main = { vinted_annonce_numeros: numeros, vrm_lbc_liens: { 5003: '126' }, vrm_ebay_liens: {}, vrm_vc_liens: {} };
  return { LIGNES, main, empreintesKO: !!o.empreintesKO };
}

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

async function ouvrir(b, vp, sc, { sombre = false, tab = 'journee', images }) {
  const tel = vp.width < 600;
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: vp, deviceScaleFactor: tel ? 2 : 1, timezoneId: 'Europe/Paris', locale: 'fr-FR', ...(tel ? { isMobile: true, hasTouch: true } : {}), colorScheme: sombre ? 'dark' : 'light' });
  const pg = await ctx.newPage();
  const errs = [], ecritures = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_prenom', JSON.stringify('Julien')); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_apparence', JSON.stringify(s ? 'sombre' : 'clair')); } catch (_) {} }, sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : /api-adresse|openfreemap/.test(r.request().url()) ? r.abort() : r.continue()));
  // Les photos INVENTÉES, servies comme les quatre sites (enregistrée APRÈS : Playwright la prend en premier).
  await pg.route(/^https:\/\/(images1\.vinted\.net|img\.leboncoin\.fr|i\.ebayimg\.com|images\.vestiairecollective\.com)\//, (r) => {
    const m = /05_([a-z0-9]+)_banc/.exec(r.request().url());
    // Les annonces Leboncoin reconnues par le code d'origine portent le nom rendu par Leboncoin (40 hex) : même photo inventée que la paire Vinted.
    const parNom = r.request().url().includes(NOM_5004) ? 'P2' : r.request().url().includes(NOM_5005) ? 'P3' : null;
    const k = parNom || (m && Object.keys(images).find((x) => x.toLowerCase() === m[1]));
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
    if (/photo_emprunte|photo_empreinte/.test(u)) {
      if (/select=data(&|$)/.test(u)) pg.selectData = true;
      if (sc.empreintesKO) return route.fulfill({ status: 500, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"message":"panne inventée"}' });
    }
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
  if (tab === 'journee') {
    await pg.waitForFunction(() => document.querySelector('.vrm-fu-afaire, [data-tout-a-jour]') || /pas pu s'afficher/.test(document.body.innerText), null, { timeout: 30000 }).catch(() => {});
    await pg.waitForFunction(() => document.querySelector('[data-journee-meme-photo]'), null, { timeout: 10000 }).catch(() => {});
  } else {
    await pg.waitForFunction(() => document.querySelector('[data-meme-photo-ligne]'), null, { timeout: 30000 }).catch(() => {});
  }
  await pg.waitForTimeout(1200);
  return { ctx, pg, errs, ecritures };
}
const toucher = async (pg, tel, sel) => { const l = pg.locator(sel).first(); await l.scrollIntoViewIfNeeded().catch(() => {}); if (tel) await l.tap(); else await l.click(); };
const lireFeuille = (pg) => pg.evaluate(() => {
  const s = document.querySelector('[data-feuille-meme-photo] [data-meme-photo], [data-meme-photo]');
  if (!s) return { feuille: false, etat: (document.querySelector('[data-feuille-meme-photo]') || document.body).innerText.slice(0, 200) };
  const props = [...s.querySelectorAll('[data-meme-photo-prop]')].map((p) => {
    const autre = p.querySelector('[data-mph-autre]'), vin = p.querySelector('[data-mph-vinted]');
    const ia = autre && autre.querySelector('img'), iv = vin && vin.querySelector('img');
    const ra = autre && autre.getBoundingClientRect(), rv = vin && vin.getBoundingClientRect();
    const g = p.querySelector('[data-meme-photo-relier]'), n = p.querySelector('[data-meme-photo-non]');
    const et = p.querySelector('[data-mph-verdict]');
    return { etat: p.getAttribute('data-etat'), etatVu: et ? et.getAttribute('data-mph-verdict') : '', raison: et ? et.getAttribute('data-mph-raison') || '' : '', etatTexte: et ? et.textContent : '', etatCouleur: et ? getComputedStyle(et).color : '', etatH: et ? Math.round(et.getBoundingClientRect().height) : 0,
      id: p.getAttribute('data-meme-photo-prop'), numero: p.getAttribute('data-numero'), d: Number(p.getAttribute('data-distance')), phrase: (p.querySelector('.vrm-mph-phrase') || {}).textContent || '',
      srcA: ia ? ia.getAttribute("src").slice(0, 120) : "", chargees: !!(ia && ia.complete && ia.naturalWidth > 0 && iv && iv.complete && iv.naturalWidth > 0), coteACote: !!(ra && rv && Math.abs(ra.top - rv.top) < 2 && rv.left >= ra.right),
      hPhoto: ra ? Math.round(ra.height) : 0, hRelier: g ? Math.round(g.getBoundingClientRect().height) : 0, hNon: n ? Math.round(n.getBoundingClientRect().height) : 0, relier: g ? g.textContent : '' };
  });
  const ambs = [...s.querySelectorAll('[data-meme-photo-ambigu]')].map((a) => ({ id: a.getAttribute('data-meme-photo-ambigu'), raison: a.getAttribute('data-raison'), choix: [...a.querySelectorAll('[data-meme-photo-choisir]')].map((x) => x.getAttribute('data-meme-photo-choisir')),
    hChoix: Math.min(...[...a.querySelectorAll('[data-meme-photo-choisir]')].map((x) => x.getBoundingClientRect().height)) }));
  const coupe = [...s.querySelectorAll('*')].some((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > window.innerWidth + 1 && !e.closest('.is-choix'); });
  return { feuille: true, surs: Number(s.getAttribute('data-mph-surs')), lu: s.getAttribute('data-mph-lu'), props, ambs, verifiees: Number(s.getAttribute('data-mph-verifiees')), etat: (s.querySelector('[data-mph-etat]') || {}).textContent || '', coupe, deborde: document.documentElement.scrollWidth > window.innerWidth + 1 };
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
    const dist = (x, y) => gen.evaluate(([a, c]) => window.__distance(a, c), [F[x].h, F[y].h]);
    const seuil = await gen.evaluate(() => window.__seuil);
    const d = { P1: await dist('P1', 'P1cdn'), P2: await dist('P2', 'P2vig'), P3: await dist('P3', 'P3cdn'), autreVue: await dist('P1', 'P1v3') };
    console.log(`── jeu inventé : P1~P1(autre site) ${d.P1} · P2~vignette ${d.P2} · P3~P3(autre site) ${d.P3} · P1~P1 autre vue ${d.autreVue} (seuil de l’alerte entre comptes ${seuil} ; une proposition exige ≤ 12, src/memePhoto.js)`);
    dit(d.P1 <= seuil && d.P2 <= seuil && d.P3 <= seuil && d.autreVue > seuil, 'le jeu : la même photo passée par un autre site est PROCHE, une autre photo de la même paire LOIN', JSON.stringify(d));
    if (CAPT) for (const n of ['P1', 'P1cdn', 'P1v3']) fs.writeFileSync(path.join(CAPT, `photo-${n}.${F[n].type === 'image/webp' ? 'webp' : 'jpg'}`), Buffer.from(F[n].b64, 'base64'));
    const fineP1 = await gen.evaluate(([a, c]) => window.__fine(a, c), [`data:${F.P1.type};base64,${F.P1.b64}`, `data:${F.P1cdn.type};base64,${F.P1cdn.b64}`]);
    console.log(`── deuxième mesure (src/photoFine.js) : P1 ~ P1 passée par un autre site ${JSON.stringify(fineP1)}`);
    await gen.close();
    const A = scenario(F, { fine: fineP1 }), C = scenario(F, { empreintesKO: true }), O = scenario(F, { fine: fineP1, origine: true });

    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 945 }].filter((v) => !process.env.BANC_SEUL || String(v.width) === process.env.BANC_SEUL)) {
      const tel = vp.width < 600, nomVp = tel ? '390' : '1512';
      for (const sombre of [false, true].filter((x) => !process.env.BANC_THEME || (x ? 'sombre' : 'clair') === process.env.BANC_THEME)) {
        const th = sombre ? 'sombre' : 'clair';
        console.log(`\n── ${nomVp} px · ${th}`);
        await essaie(`M ${nomVp} ${th}`, async () => {
          const { ctx, pg, errs, ecritures } = await ouvrir(b, vp, A, { sombre, images: F });
          await pg.locator("[data-journee-meme-photo]").first().scrollIntoViewIfNeeded().catch(() => {}); await pg.waitForTimeout(300);
          if (CAPT) await pg.screenshot({ path: path.join(CAPT, `mp-${nomVp}-${th}-journee.png`) });
          const c = await pg.evaluate(() => { const e = document.querySelector('[data-journee-meme-photo]'); if (!e) return { carte: false, texte: document.body.innerText.slice(0, 200) };
            const n = e.querySelector('.vrm-day-task-note'), t = e.querySelector('.vrm-day-task-title'); return { carte: true, n: e.getAttribute('data-n'), titre: t && t.textContent, note: n && n.textContent, cNote: n && getComputedStyle(n).color, cTitre: t && getComputedStyle(t).color }; });
          dit(c.carte && c.n === '3', 'M1 Ma journée : la carte « Même photo · à relier », data-n = 3', JSON.stringify(c));
          dit(c.carte && /3 annonces à relier/.test(c.titre || '') && /Leboncoin/.test(c.note || '') && /eBay/.test(c.note || '') && /Vestiaire/.test(c.note || ''), 'M1 le titre et les sites nommés', `${c.titre} · ${c.note}`);
          dit(c.carte && /^1 sûre · 2 à vérifier/.test((c.note || '').trim()), 'S1 Ma journée dit d’abord « 1 sûre · 2 à vérifier » (visible avant la coupe)', c.note);
          dit(c.carte && c.cNote !== c.cTitre && !/255,\s*59,\s*48|255,\s*69,\s*58/.test(c.cNote || ''), 'M1 la ligne en ambre, jamais le rouge du doublon de N°', `${c.cNote} / ${c.cTitre}`);
          const avant = ecritures.length;
          await toucher(pg, tel, '[data-journee-meme-photo]').catch(() => {});
          await pg.waitForSelector('[data-feuille-meme-photo] [data-meme-photo]', { timeout: 8000 }).catch(() => {});
          await pg.evaluate(() => document.querySelectorAll('[data-meme-photo] img').forEach((i) => { i.loading = 'eager'; })).catch(() => {});
          await pg.waitForFunction(() => [...document.querySelectorAll('[data-meme-photo] img')].every((i) => i.complete), null, { timeout: 8000 }).catch(() => {});
          await pg.waitForTimeout(600);
          if (CAPT) await pg.screenshot({ path: path.join(CAPT, `mp-${nomVp}-${th}-feuille.png`) });
          if (CAPT) { await pg.locator("[data-meme-photo-ambigu]").first().scrollIntoViewIfNeeded().catch(() => {}); await pg.waitForTimeout(400); await pg.screenshot({ path: path.join(CAPT, `mp-${nomVp}-${th}-ambigu.png`) }); await pg.locator("[data-meme-photo-prop]").first().scrollIntoViewIfNeeded().catch(() => {}); }
          const f = await lireFeuille(pg);
          dit(f.feuille, 'M2 la carte ouvre la feuille', f.etat);
          if (f.feuille) {
            dit(f.props.map((p) => p.id + '>' + p.numero).sort().join(' ') === 'Leboncoin:5001>124 eBay:2001>125', 'M2 deux propositions : Leboncoin 5001 ⇒ N°124, eBay 2001 ⇒ N°125', f.props.map((p) => p.id + '>' + p.numero).join(' '));
            dit(!f.props.some((p) => /5002|5003|5009/.test(p.id)) && !f.ambs.some((a) => /5002|5003|5009/.test(a.id)), 'M2 une AUTRE photo de la même paire (5002), une annonce déjà reliée (5003), l’annonce d’un autre vendeur (5009) : rien', '');
            dit(f.ambs.length === 1 && f.ambs[0].id === 'Vestiaire:vc-9' && f.ambs[0].choix.sort().join(' ') === 'Vestiaire:vc-9|300 Vestiaire:vc-9|301', 'M2 Vestiaire vc-9 AMBIGU : N°300 et N°301 montrés, il choisit', JSON.stringify(f.ambs));
            dit(f.props.every((p) => p.chargees && p.coteACote && p.hPhoto >= 120), 'M2 les deux photos CHARGÉES, côte à côte, grandes (≥ 120 px)', JSON.stringify(f.props.map((p) => [p.chargees, p.coteACote, p.hPhoto, p.srcA])));
            dit(f.props.every((p) => p.hRelier >= 44 && p.hNon >= 44) && f.ambs.every((a) => a.hChoix >= 44), 'M2 chaque geste ≥ 44 px', JSON.stringify(f.props.map((p) => [p.hRelier, p.hNon])));
            dit(/N°124/.test((f.props.find((p) => p.numero === '124') || {}).phrase || ''), 'M2 « Même photo que N°124 (Vinted) »', (f.props[0] || {}).phrase);
            // (15 nov., lot meme-photo-sure) Les deux états, VISIBLES et DIFFÉRENTS.
            const pl = f.props.find((p) => p.id === 'Leboncoin:5001') || {}, pe = f.props.find((p) => p.id === 'eBay:2001') || {};
            dit(pl.etat === 'sur' && pl.etatVu === 'sur' && /sûr/.test(pl.etatTexte) && pl.etatH > 0, 'S1 Leboncoin 5001 (les deux mesures concordent) ⇒ « Même photo · sûr », visible', JSON.stringify({ e: pl.etat, t: pl.etatTexte, h: pl.etatH }));
            dit(pe.etat === 'verifier' && pe.etatVu === 'verifier' && pe.raison === 'ebay' && /vérifier/.test(pe.etatTexte), 'S1 eBay 2001 (une seule mesure) ⇒ « À vérifier » et la raison, jamais « sûr »', JSON.stringify({ e: pe.etat, r: pe.raison, t: pe.etatTexte }));
            dit(pl.etatCouleur && pe.etatCouleur && pl.etatCouleur !== pe.etatCouleur && !/255,\s*59,\s*48|255,\s*69,\s*58/.test(pe.etatCouleur + pl.etatCouleur), 'S1 « sûr » et « à vérifier » se distinguent à l’œil (couleur), jamais le rouge', `${pl.etatCouleur} / ${pe.etatCouleur}`);
            dit(f.surs === 1, 'S1 la feuille compte 1 « sûr » (data-mph-surs)', String(f.surs));
            dit(!f.deborde && !f.coupe, 'M2 aucun débordement', JSON.stringify({ deborde: f.deborde, coupe: f.coupe }));
          }
          dit(!ecritures.slice(avant).some((e) => /vrm_lbc_liens|vrm_ebay_liens|vrm_vc_liens|vrm_meme_photo_non/.test(e.corps)), 'M2 ouvrir la feuille : rien relié, rien noté', '');
          // M3 Relier
          await toucher(pg, tel, '[data-meme-photo-relier="Leboncoin:5001"]').catch(() => {});
          await pg.waitForTimeout(600);
          await pg.clock.runFor(8000).catch(() => {});
          await pg.waitForTimeout(1500);
          const f3 = await lireFeuille(pg);
          const relie = await pg.evaluate(() => { try { const v = JSON.parse(localStorage.getItem('vrm_lbc_liens') || 'null'); return v && (v.v !== undefined ? v.v : v); } catch (_) { return null; } });
          dit((relie && String(relie[5001] || (relie.value || {})[5001]) === '124') || ecrit(ecritures, /"vrm_lbc_liens":\{[^}]*"5001":"124"/), 'M3 « Relier à N°124 » ⇒ vrm_lbc_liens[5001] = 124 (le lien posé à la main)', JSON.stringify(relie).slice(0, 160));
          dit(f3.feuille && !f3.props.some((p) => p.id === 'Leboncoin:5001'), 'M3 la proposition disparaît une fois reliée', JSON.stringify(f3.props && f3.props.map((p) => p.id)));
          if (CAPT) await pg.screenshot({ path: path.join(CAPT, `mp-${nomVp}-${th}-apres-relier.png`) });
          // M4 Ce n'est pas la même
          await toucher(pg, tel, '[data-meme-photo-non="eBay:2001"]').catch(() => {});
          await pg.waitForTimeout(600);
          await pg.clock.runFor(8000).catch(() => {});
          await pg.waitForTimeout(1500);
          const f4 = await lireFeuille(pg);
          const non = await pg.evaluate(() => { try { return localStorage.getItem('vrm_meme_photo_non') || ''; } catch (_) { return ''; } });
          dit(/eBay:2001\|125/.test(non) || ecrit(ecritures, /vrm_meme_photo_non[^}]*eBay:2001\|125/), 'M4 « Ce n’est pas la même » ⇒ noté (eBay:2001|125)', non.slice(0, 120));
          dit(f4.feuille && !f4.props.some((p) => p.id === 'eBay:2001'), 'M4 la proposition ne revient plus', JSON.stringify(f4.props && f4.props.map((p) => p.id)));
          dit(!ecrit(ecritures, /"vrm_ebay_liens":\{[^}]*"2001"/), 'M4 rien n’est relié côté eBay', '');
          dit(!pg.selectData, 'les empreintes lues par PROJECTION (jamais select=data)', '');
          dit(errs.length === 0, 'aucune erreur JS', errs.slice(0, 2).join(' | '));
          await ctx.close();
        });
        await essaie(`M5 ${nomVp} ${th}`, async () => {
          const { ctx, pg, errs } = await ouvrir(b, vp, A, { sombre, tab: 'leboncoin', images: F });
          if (CAPT) await pg.screenshot({ path: path.join(CAPT, `mp-${nomVp}-${th}-leboncoin.png`) });
          const l = await pg.evaluate(() => { const e = document.querySelector('[data-meme-photo-ligne="Leboncoin"]'); return e ? { n: e.getAttribute('data-n'), t: e.textContent, h: Math.round(e.getBoundingClientRect().height), top: Math.round(e.getBoundingClientRect().top) } : null; });
          dit(l && l.n === '1' && /1 annonce à relier/.test(l.t) && l.h >= 44, 'M5 Annonces → Leboncoin : la ligne compacte « 1 annonce à relier » (≥ 44 px)', JSON.stringify(l));
          await toucher(pg, tel, '[data-meme-photo-ligne="Leboncoin"]').catch(() => {});
          await pg.waitForSelector('[data-feuille-meme-photo="Leboncoin"] [data-meme-photo]', { timeout: 8000 }).catch(() => {});
          await pg.waitForTimeout(500);
          const f = await lireFeuille(pg);
          dit(f.feuille && f.props.length === 1 && f.props[0].id === 'Leboncoin:5001' && !f.ambs.length, 'M5 … elle ouvre la feuille de Leboncoin seulement', JSON.stringify(f.props && f.props.map((p) => p.id)));
          if (CAPT && !tel) await pg.screenshot({ path: path.join(CAPT, `mp-${nomVp}-${th}-leboncoin-feuille.png`) });
          dit(errs.length === 0, 'aucune erreur JS', errs.slice(0, 2).join(' | '));
          await ctx.close();
        });
      }
      // (16 nov., lot photo-identite-sites) LE CODE D'ORIGINE : identité exacte, sans geste ; ambiguïté dite.
      await essaie(`O ${nomVp}`, async () => {
        const { ctx, pg, errs, ecritures } = await ouvrir(b, vp, O, { images: F });
        const avant = ecritures.length;
        await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:meme-photo-ouvrir', { detail: { site: 'Leboncoin' } })));
        await pg.waitForSelector('[data-feuille-meme-photo] [data-meme-photo]', { timeout: 8000 }).catch(() => {});
        await pg.waitForTimeout(800);
        await pg.locator('[data-meme-photo-reconnue]').first().scrollIntoViewIfNeeded().catch(() => {}); await pg.waitForTimeout(300);
        if (CAPT) await pg.screenshot({ path: path.join(CAPT, `mp-${nomVp}-origine-feuille.png`) });
        const r = await pg.evaluate(() => {
          const rec = [...document.querySelectorAll('[data-meme-photo-reconnue]')].map((e) => ({ id: e.getAttribute('data-meme-photo-reconnue'), n: e.getAttribute('data-numero'), par: (e.querySelector('[data-mph-par]') || {}).getAttribute && e.querySelector('[data-mph-par]').getAttribute('data-mph-par'), t: e.textContent }));
          const amb = [...document.querySelectorAll('[data-meme-photo-ambigu]')].map((e) => ({ id: e.getAttribute('data-meme-photo-ambigu'), phrase: (e.querySelector('[data-mph-phrase-ambigu]') || {}).textContent || '' }));
          const props = [...document.querySelectorAll('[data-meme-photo-prop]')].map((e) => e.getAttribute('data-meme-photo-prop'));
          const lim = document.querySelector('[data-mph-limite-origine]');
          return { rec, amb, props, limite: lim ? lim.textContent : '' };
        });
        dit(r.rec.length === 1 && r.rec[0].id === 'Leboncoin:5004' && r.rec[0].n === '125' && r.rec[0].par === 'code' && /Photo d’origine identique · N°125/.test(r.rec[0].t),
          'O1 Leboncoin 5004 (le même fichier que N°125) ⇒ « Photo d’origine identique · N°125 », reconnue SANS geste', JSON.stringify(r.rec));
        dit(r.amb.some((a) => a.id === 'Leboncoin:5005' && /Même photo sur N°300 et N°301 : laquelle \?/.test(a.phrase)), 'O2 Leboncoin 5005 (même fichier sur N°300 et N°301) ⇒ rien déduit, « Même photo sur N°300 et N°301 : laquelle ? »', JSON.stringify(r.amb));
        dit(r.props.includes('Leboncoin:5001') && !r.props.includes('Leboncoin:5004'), 'O3 la ressemblance (5001, « sûr ») reste une PROPOSITION à relier ; 5004 n’est pas « à relier »', JSON.stringify(r.props));
        dit(/applis? mobile/i.test(r.limite), 'O4 la limite est dite : « Publiée depuis une appli mobile, VRM ne la voit pas »', r.limite);
        dit(!ecritures.slice(avant).some((e) => /vrm_lbc_liens|photo_origine/.test(e.corps)), 'O5 rien n’est écrit (l’identité est calculée, jamais recopiée)', '');
        // La fiche de la paire N°125 : « Aussi sur Leboncoin · reconnue par la photo d’origine ».
        await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:fiche-paire', { detail: '125' })));
        await pg.waitForSelector('[data-meme-photo-aussi="125"]', { timeout: 8000 }).catch(() => {});
        await pg.waitForTimeout(500);
        await pg.locator('[data-meme-photo-aussi="125"]').first().scrollIntoViewIfNeeded().catch(() => {}); await pg.waitForTimeout(300);
        if (CAPT) await pg.screenshot({ path: path.join(CAPT, `mp-${nomVp}-origine-fiche.png`) });
        const fi = await pg.evaluate(() => { const e = document.querySelector('[data-meme-photo-aussi="125"]'); return e ? { par: e.getAttribute('data-par'), t: e.textContent, h: Math.round(e.getBoundingClientRect().height), titre: e.getAttribute('title') || '' } : null; });
        dit(fi && fi.par === 'code' && /Aussi sur Leboncoin · reconnue par la photo d’origine/.test(fi.t) && fi.h >= 44 && /appli mobile/.test(fi.titre), 'O6 la fiche N°125 : « Aussi sur Leboncoin · reconnue par la photo d’origine » (≥ 44 px), la limite en titre', JSON.stringify(fi));
        dit(errs.length === 0, 'aucune erreur JS', errs.slice(0, 2).join(' | '));
        await ctx.close();
      });
      await essaie(`C ${nomVp}`, async () => {
        const { ctx, pg, errs } = await ouvrir(b, vp, C, { images: F });
        const r = await pg.evaluate(() => ({ carte: !!document.querySelector('[data-journee-meme-photo]'), rendu: !!document.querySelector('.vrm-fu-afaire, [data-tout-a-jour]') }));
        dit(r.rendu && !r.carte, 'C lecture des empreintes ratée : aucune carte', JSON.stringify(r));
        await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:meme-photo-ouvrir', { detail: { site: null } })));
        await pg.waitForSelector('[data-feuille-meme-photo] [data-mph-lu]', { timeout: 8000 }).catch(() => {});
        await pg.waitForTimeout(500);
        const lu = await pg.evaluate(() => { const e = document.querySelector('[data-feuille-meme-photo] [data-mph-lu]'); return e ? { lu: e.getAttribute('data-mph-lu'), t: e.textContent } : null; });
        dit(lu && lu.lu === '0' && /pas lues/i.test(lu.t), 'C la feuille dit « pas lues », jamais « rien à relier »', JSON.stringify(lu));
        dit(errs.length === 0, 'aucune erreur JS', errs.slice(0, 2).join(' | '));
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
