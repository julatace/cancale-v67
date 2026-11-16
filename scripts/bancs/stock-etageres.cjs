// Banc : LE STOCK EN ÉTAGÈRES (15 nov. 2026 ; récit : docs/passation/2026-11-15-stock-etageres.md)
//
// Julien : « le nombre de cases que l'on veut, des couleurs aux cases pour faire des
// étagères ; une pile de boîtes : si on enlève celle tout en bas, celles du dessus
// descendent toutes seules ; que les numéros soient bien attribués ».
// Données INVENTÉES (le dépôt est public) à la FORME mesurée en base (15 nov., lecture
// seule) : deux meubles d'hier (4×8 sans gravité ; 7×10 `gravite: false`, `planches: []`),
// une case prise ; + une pile d'hier (`gravite: true`) dont la case du bas porte un N° PAS
// MONTRÉ (aucune fiche : compte écarté), + 1 000 paires en ligne, + un N° en doublon.
// Il exige, au téléphone (390, tactile) et à l'ordinateur (1512), clair et sombre :
//   A l'ancien rangement repris tel quel (mêmes cases, même ordre), AUCUNE écriture au montage ;
//   B la case d'un N° pas montré est PRISE (jamais « + ») ; le doublon de N° est le seul rouge ;
//   C créer une étagère 4×3 couleur « sauge », sa rangée 1 peinte « ciel » (12 cases, 4 peintes) ;
//   D créer une pile de 5 ; y poser 3 paires (touchées en haut, elles tombent en bas) ;
//   E sortir celle du bas ⇒ les deux du dessus descendent d'un cran, c'est DIT, les N° restent ;
//   F dans la pile d'hier, retirer le haut ⇒ le N° pas montré garde sa case, personne ne passe au travers ;
//   G chercher un N° ⇒ sa case s'allume ; monter / descendre un meuble ;
//   H 44 px au doigt, aucune page plus large que l'écran, aucune erreur ; la dernière écriture
//     de `vrm_meubles` garde les champs d'origine des meubles d'hier.
//   W (15 nov., étagère v4 — maquettes validées) « Personnaliser » : l'aperçu EN DIRECT suit les réglages ; Rayonnage +
//     « de loin » + prix ⇒ plus aucune photo, le N° en grand, le prix LU ; « À sortir » (ambre) et « En double » (rouge)
//     se disent TOUJOURS ; Enregistrer écrit `reglages` dans CE meuble (et rien d'autre) ; « La pièce » (de face /
//     isométrique, « 1 » à sortir) ; à l'ordinateur (1512 et 1280) trois volets : la pièce, LE meuble, la fiche de la case.
//   BANC_PORT (6493), BANC_DIST (dist/), CAPTURES=dossier (captures à regarder), VARIANTES=390c,390s,1512c,1512s,1280c,1280s
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 6493;
const CAPT = process.env.CAPTURES || '';
const VARIANTES = (process.env.VARIANTES || '390c,1512s,390s,1512c,1280c,1280s').split(',');

const N = 1000;
const fiches = {}, enLigne = [];
for (let k = 1; k <= N; k++) {
  const id = String(900000 + k);
  // Une PHOTO par paire (inventée, servie par le banc : une basket dessinée, couleur selon le N°) — la case montre la photo.
  const photo = `http://localhost:${PORT}/banc-photo/${k}.svg`;
  fiches[id] = { numero: String(k), title: `Basket inventée ${k} taille ${36 + (k % 10)}`, accountId: '111', photo };
  enLigne.push({ id, title: fiches[id].title, is_closed: false, is_hidden: false, is_draft: false, price: { amount: String(30 + (k % 50)) + '.0' }, photo: { url: photo }, photos: [{ url: photo }] });
}
// N°9999 : la fiche d'un compte MASQUÉ (222) — sa paire n'est pas montrée dans le Stock, son carton est dans la pile d'hier.
fiches['8009999'] = { numero: '9999', title: 'Basket d’un compte masqué', accountId: '222' };
const MAIN = {
  vinted_annonce_numeros: fiches,
  vinted_accounts_hidden: ['222'],
  vinted_used_numeros: Array.from({ length: N }, (_, k) => String(k + 1)),
  // La forme MESURÉE : deux meubles d'hier, une case prise (rangée 4, colonne 2 du 7×10).
  vrm_meubles: [{ id: 'mA', name: 'Garage', cols: 4, rows: 8 }, { id: 'mB', name: 'Bureau', cols: 7, rows: 10, gravite: false, planches: [] },
    { id: 'mQ', name: 'Pile hier', cols: 1, rows: 4, gravite: true }],
  vrm_slots: Object.assign({ '12': { m: 'mB', i: 22 }, '9999': { m: 'mQ', i: 3 }, '61': { m: 'mQ', i: 2 }, '62': { m: 'mQ', i: 1 } },
    Object.fromEntries(Array.from({ length: 30 }, (_, k) => [String(k + 20), { m: 'mA', i: k }]))),
  vrm_num_doublons: { nums: ['21'], at: Date.now() },
  // (v4) N°22 est VENDUE : son carton est « À sortir » (ambre), quel que soit l'affichage.
  vrm_stock_vendus: { nums: ['22'], at: Date.now() },
};
// (15 nov., sites sur la case) Par IDENTITÉ : N°23 vit sur un 2e compte Vinted SANS login connu (aucun pseudo ne doit
// s'écrire, jamais l'identifiant « 333 ») ; N°20 est aussi sur Leboncoin par SA référence « VRM-20 » (compte « nord_lbc ») ;
// une annonce Leboncoin au MÊME titre que N°21 porte la référence d'une autre paire (« VRM-999 ») : N°21 n'en reçoit rien.
const i23 = enLigne.findIndex((x) => x.id === '900023');
const enLigne333 = enLigne.splice(i23, 1);
fiches['900023'].accountId = '333';
const LIGNES = {
  harvest_111_listings: { id: 'harvest_111_listings', data: { capturedAt: new Date().toISOString(), complet: true, payload: { items: enLigne } } },
  harvest_333_listings: { id: 'harvest_333_listings', data: { capturedAt: new Date().toISOString(), complet: true, payload: { items: enLigne333 } } },
  lbc_listings: { id: 'lbc_listings', data: { items: {
    L20: { id: 'L20', account: 'lbc1', customRef: 'VRM-20', subject: 'Basket Leboncoin vingt', status: 'active', price: [95] },
    L99: { id: 'L99', account: 'lbc1', customRef: 'VRM-999', subject: fiches['900021'].title, status: 'active', price: [70] },
  }, lectures: { lbc1: { at: new Date(Date.now() - 3600000).toISOString(), total: 2, n: 2 } } } },
  lbc_ventes: { id: 'lbc_ventes', data: { ventes: {} } },
  lbc_accounts: { id: 'lbc_accounts', data: { accounts: { lbc1: { id: 'lbc1', name: 'nord_lbc' } } } },
};
// La VRAIE forme : projection `select=` (alias:data->x->>y), comme scripts/bancs/stock-annonces.cjs.
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (src.includes('->>') && typeof v === 'object' ? JSON.stringify(v) : v);
  }
  return out;
};
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d !== undefined && !c ? ' — ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 400) : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
// La basket dessinée (aucune vraie photo : le dépôt est public).
const TEINTES = ['#E8EEF5', '#F3E7DA', '#E3EFE6', '#ECECEA', '#F6EED8', '#E6ECEF'];
const COULS = ['#2E5E9E', '#B4532A', '#3E7D55', '#5B5F66', '#C08A1E', '#1F2A36'];
const basket = (k) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="${TEINTES[k % 6]}"/><path d="M14 78c0-6 4-10 10-11l22-4 14-16c3-3 8-4 12-1l10 8c4 3 9 5 14 5h4c6 0 10 5 10 11v8H14z" fill="${COULS[k % 6]}"/><rect x="12" y="86" width="98" height="9" rx="4" fill="#FFFFFF" stroke="#C9D2DC"/><path d="M52 62l6-7M60 64l6-7M68 66l6-7" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/></svg>`;
const srv = http.createServer((q, r) => {
  const bp = /^\/banc-photo\/(\d+)\.svg/.exec(q.url);
  if (bp) { r.writeHead(200, { 'content-type': 'image/svg+xml', 'cache-control': 'max-age=3600' }); return r.end(basket(Number(bp[1]))); }
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ')'); process.exit(1); });
srv.listen(PORT);

async function rendre(b, tel, sombre, larg = 1512) {
  const ctx = await b.newContext({ viewport: tel ? { width: 390, height: 844 } : { width: larg, height: 950 }, ...(tel ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}), colorScheme: sombre ? 'dark' : 'light' });
  const pg = await ctx.newPage();
  const errs = [], ecrits = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') {
      if (/app_data/.test(u) && (/id=eq\.main/.test(u) || /"id":"main"/.test(req.postData() || ''))) ecrits.push({ at: Date.now(), corps: req.postData() || '' });
      return j([]);
    }
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j([{ id: 2, vinted_user_id: '333', login: null, domain: 'www.vinted.fr', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { id: 1, vinted_user_id: '111', login: 'compte_invente', domain: 'www.vinted.fr', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]);
    if (/id=eq\.main/.test(u)) return j([{ id: 'main', data: MAIN }]);
    const eq = /id=eq\.([^&]*)/.exec(u);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    if (eq && LIGNES[eq[1]]) return j([sel && !/^id,data$|^data$/.test(sel) ? projette(LIGNES[eq[1]], sel) : LIGNES[eq[1]]]);
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.addInitScript(([m, sombre]) => { try { localStorage.setItem('vrm_acces_direct', '1'); for (const k in m) localStorage.setItem(k, JSON.stringify(m[k])); localStorage.setItem('vinted_dark', JSON.stringify(!!sombre)); localStorage.setItem('vrm_meubles_zoom', 'loin'); } catch (_) {} }, [MAIN, sombre]);
  const t0 = Date.now();
  await pg.goto(`http://localhost:${PORT}/?tab=garage`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('[data-meuble] [data-case-ici]', { timeout: 60000 }).catch(() => {});
  const tGrille = Date.now() - t0;
  await pg.waitForTimeout(1500);
  return { ctx, pg, errs, ecrits, tGrille };
}
const ouIci = (pg, n) => pg.evaluate((n) => { const el = document.querySelector(`[data-case-num="${n}"]`); return el ? el.getAttribute('data-case-ici') : null; }, n);
const BUREAU = (pg) => pg.evaluate(() => !!document.querySelector('[data-stock-volets]'));
// Montrer un meuble : à l'ordinateur, sa rangée dans « La pièce » (le volet de gauche) le met au centre ; au téléphone, tous sont là.
async function voir(pg, id) {
  if (!(await BUREAU(pg))) return true;
  const ici = await pg.evaluate((id) => !!document.querySelector(`.vrm-st4-centre [data-meuble="${id}"]`), id);
  if (ici) return true;
  try { await pg.click(`[data-piece-rangee="${id}"]`, { timeout: 15000 }); } catch (_) { return false; }
  await pg.waitForSelector(`.vrm-st4-centre [data-meuble="${id}"]`, { timeout: 30000 }).catch(() => {}); await pg.waitForTimeout(300);
  return true;
}
const meublesListe = (pg) => pg.evaluate(() => [...document.querySelectorAll('[data-piece-rangee]')].map((x) => x.getAttribute('data-piece-rangee')));
async function ou(pg, n) {
  const a = await ouIci(pg, n); if (a || !(await BUREAU(pg))) return a;
  for (const id of await meublesListe(pg)) { await voir(pg, id); const b2 = await ouIci(pg, n); if (b2) return b2; }
  return null;
}
const bloque = (pg, sel) => pg.evaluate((sel) => { const b = document.querySelector(sel); if (!b) return 'absent'; b.scrollIntoView({ block: 'center' }); const q = b.getBoundingClientRect(); const e = document.elementFromPoint(q.x + q.width / 2, q.y + q.height / 2); return e ? (e.closest(sel) ? '' : (e.className || e.tagName) + '') : 'rien'; }, sel);
let nBloque = 0;
async function toucher(pg, sel) {
  try { await pg.click(sel, { timeout: 25000 }); return true; } catch (e) { console.log('    (toucher ' + sel + ' : ' + (await bloque(pg, sel)) + ' — ' + String(e && e.message).split('\n').slice(0, 9).join(' ').slice(0, 700) + ')'); if (CAPT) await pg.screenshot({ path: path.join(CAPT, 'etag-bloque-' + (++nBloque) + '.png') }).catch(() => {}); return false; }
}
// La fiche de la paire (ouverte par une case) : refermée pour revenir au Stock.
async function fermerFiche(pg) {
  for (let k = 0; k < 3; k++) {
    const f = await pg.$('[data-fiche-fermer]'); if (!f) return;
    try { await f.click({ timeout: 3000 }); } catch (_) { await pg.keyboard.press('Escape').catch(() => {}); }
    await pg.waitForTimeout(400);
  }
}
// (16 nov., fiche D) Les gestes et les places de la case (`DansFiche` : Déplacer, Retirer, les sites de la case) vivent
// derrière « ⋯ » de la fiche (feuille de tuiles, « Tout voir ») : un toucher les montre, comme lui.
async function ouvrirPlus(pg) {
  await pg.evaluate(() => { const b = document.querySelector('.vrm-fp [data-fd-plus-ouvrir]'); if (b) b.click(); });
  await pg.waitForTimeout(300);
  await pg.evaluate(() => { const d = document.querySelector('.vrm-fp [data-fiche-plus]'); if (d) d.open = true; });
  await pg.waitForTimeout(300);
}
async function retirerCase(pg, n) {
  const ici = await ou(pg, n); if (ici) await voir(pg, ici.split(':')[0]);
  if (!(await toucher(pg, `[data-case-num="${n}"]`))) return false;
  // (16 nov., intégration) v4 : à l'ordinateur la case touchée se montre d'abord dans le volet de droite ; « La fiche »
  // ouvre la fiche D, dont les gestes de la case (Retirer…) vivent derrière « ⋯ ».
  if (await BUREAU(pg)) { await pg.waitForSelector(`[data-cote-fiche="${n}"]`, { timeout: 6000 }).catch(() => {}); await toucher(pg, `[data-cote-fiche="${n}"]`); }
  await pg.waitForSelector('[data-fiche-retirer]', { state: 'attached', timeout: 8000 }).catch(() => {});
  await ouvrirPlus(pg);
  await toucher(pg, '[data-fiche-retirer]');
  await pg.waitForTimeout(500); await fermerFiche(pg); await pg.waitForTimeout(300);
  return (await ou(pg, n)) === null;   // jugé sur la case (un clic qui se détache en partant n'est pas un échec)
}

// ── W : « La pièce » — de face / isométrique, les meubles dans leur ordre, « 1 » à sortir (N°22) sur le Garage ──
async function piece(pg, t, v, bureau) {
  const p = await pg.evaluate(() => { const s = document.querySelector('.vrm-p4-piece'); if (!s) return null; const b = s.querySelector('[data-piece-a-sortir]'); return { minis: [...s.querySelectorAll('[data-piece-meuble]')].map((x) => x.getAttribute('data-piece-meuble')).join(','), rangees: [...s.querySelectorAll('[data-piece-rangee]')].map((x) => x.getAttribute('data-piece-rangee')).join(','), sortir: b ? b.getAttribute('data-piece-a-sortir') + '@' + b.closest('[data-piece-rangee]').getAttribute('data-piece-rangee') : null, faces: s.querySelectorAll('.vrm-p4-face').length }; });
  dit(!!p && p.minis === p.rangees && p.rangees.split(',').length >= 3 && p.sortir === '1@mA' && p.faces >= 3, `${t} · W6 : « La pièce » montre chaque meuble (de face), leur ordre, et « 1 » à sortir sur le Garage (N°22 vendue)`, p);
  await pg.click('[data-piece-choix="iso"]').catch(() => {});
  await pg.waitForTimeout(400);
  const iso = await pg.evaluate(() => { const s = document.querySelector('.vrm-p4-piece'); return s ? { vue: s.getAttribute('data-piece-vue'), svg: s.querySelectorAll('svg.vrm-p4-iso').length, poly: s.querySelectorAll('svg.vrm-p4-iso polygon').length } : null; });
  dit(!!iso && iso.vue === 'iso' && iso.svg >= 3 && iso.poly > 50, `${t} · W6 : « Isométrique » dessine les meubles en volume (cartons compris)`, iso);
  if (CAPT) { await pg.evaluate(() => { const s = document.querySelector('.vrm-p4-piece'); if (s) s.scrollIntoView({ block: 'start' }); }); await pg.waitForTimeout(300); await pg.screenshot({ path: path.join(CAPT, `etag-${v}-7-piece-iso.png`) }); }
  await pg.click('[data-piece-choix="face"]').catch(() => {});
  await pg.waitForTimeout(300);
  if (CAPT) await pg.screenshot({ path: path.join(CAPT, `etag-${v}-7b-piece-face.png`) });
}
// ── W : « Personnaliser » le Garage — l'aperçu suit, Enregistrer écrit `reglages` dans CE meuble ──
async function personnaliser(pg, t, v, tel, r) {
  await voir(pg, 'mA');
  await pg.evaluate(() => { const m = document.querySelector('[data-meuble="mA"]'); if (m) m.scrollIntoView({ block: 'start' }); });
  const avant = await pg.evaluate(() => { const s = document.querySelector('[data-meuble="mA"]'); return s ? s.getAttribute('data-affichage') + '|' + s.getAttribute('data-densite') + '|' + s.querySelectorAll('.vrm-b4').length : null; });
  dit(/^cartons\|confortable\|\d+$/.test(avant || '') && +avant.split('|')[2] >= 30, `${t} · W1 : un meuble d'hier se lit en Cartons, confortable (le défaut d'un meuble neuf), sans rien réécrire`, avant);
  const sortir = await pg.evaluate(() => { const c = document.querySelector('[data-case-num="22"]'); if (!c) return null; const l = c.querySelector('[data-case-ligne]'); const e = c.querySelector('.vrm-eti4'); return { ligne: l ? l.getAttribute('data-case-ligne') + ':' + l.textContent : null, fond: e ? getComputedStyle(e).backgroundColor : null }; });
  dit(!!sortir && /^sortir:/.test(sortir.ligne || '') && /rgb\(255, 231, 196\)/.test(sortir.fond || ''), `${t} · W3 : N°22 vendue — « À sortir », l'étiquette ambre`, sortir);
  if (CAPT) await pg.screenshot({ path: path.join(CAPT, `etag-${v}-8-cartons.png`) });
  const n0 = r.ecrits.length;
  if (!(await toucher(pg, '[data-meuble-perso="mA"]'))) return;
  await pg.waitForSelector('[data-perso-meuble="mA"] [data-perso-apercu]', { timeout: 8000 }).catch(() => {});
  const ap0 = await pg.evaluate(() => { const a = document.querySelector('[data-perso-apercu]'); return a ? { cle: a.getAttribute('data-perso-apercu'), rendu: !!a.querySelector('[data-meuble-apercu="mA"]'), photos: a.querySelectorAll('.vrm-ph4 img').length } : null; });
  dit(!!ap0 && ap0.cle === 'cartons|melees|confortable' && ap0.rendu && ap0.photos > 0, `${t} · W1 : « Personnaliser » montre l'aperçu EN DIRECT du vrai meuble (cartons, teintes mêlées, confortable, photos)`, ap0);
  if (CAPT) await pg.screenshot({ path: path.join(CAPT, `etag-${v}-9-perso.png`) });
  const mini = tel ? 43.5 : 39.5;
  const petits = await pg.evaluate((mini) => [...document.querySelectorAll('[data-perso-meuble] button, [data-perso-meuble] input')].filter((x) => x.offsetParent && !x.closest('[data-perso-apercu]')).map((x) => [x.getAttribute('aria-label') || x.textContent.trim().slice(0, 14), Math.round(x.getBoundingClientRect().width), Math.round(x.getBoundingClientRect().height)]).filter((q) => q[1] < mini || q[2] < mini), mini);
  dit(petits.length === 0, `${t} · H : chaque touche de « Personnaliser » fait ${tel ? 44 : 40} px au moins`, petits);
  const pleins = await pg.evaluate(() => document.querySelectorAll('[data-perso-meuble] .sb-btn-plein').length);
  dit(pleins === 1, `${t} · H : UN plein dans « Personnaliser » (Enregistrer)`, pleins);
  // Rayonnage · de loin · N° en grand + prix (photo cochée : « de loin » la retire)
  await toucher(pg, '[data-perso-affichage="rayonnage"]');
  await toucher(pg, '[data-perso-densite="loin"]');
  await toucher(pg, '[data-perso-etiquette="grand"]');
  await toucher(pg, '[data-perso-etiquette="prix"]');
  await toucher(pg, '[data-perso-teinte="sauge"]');
  await pg.waitForTimeout(300);
  const ap1 = await pg.evaluate(() => { const a = document.querySelector('[data-perso-apercu]'); return a ? { cle: a.getAttribute('data-perso-apercu'), photos: a.querySelectorAll('.vrm-ph4').length, labs: a.querySelectorAll('.vrm-lab4').length, sortir: !!a.querySelector('[data-case-ligne="sortir"]'), double: !!a.querySelector('[data-case-ligne="double"]') } : null; });
  dit(!!ap1 && ap1.cle === 'rayonnage|sauge|loin' && ap1.photos === 0 && ap1.labs >= 30 && ap1.sortir && ap1.double, `${t} · W2 : l'aperçu suit : rayonnage, de loin ⇒ AUCUNE photo ; « À sortir » et « En double » toujours dits`, ap1);
  dit(r.ecrits.length === n0, `${t} · W2 : rien n'est écrit avant « Enregistrer »`, r.ecrits.length - n0);
  if (CAPT) { await pg.evaluate(() => { const a = document.querySelector('[data-perso-apercu]'); if (a) a.scrollIntoView({ block: 'start' }); }); await pg.screenshot({ path: path.join(CAPT, `etag-${v}-9b-perso-rayonnage.png`) }); }
  await toucher(pg, '[data-perso-enregistrer]');
  await pg.waitForTimeout(1200);
  const apres = await pg.evaluate(() => { const s = document.querySelector('[data-meuble="mA"]'); if (!s) return null; const c20 = s.querySelector('[data-case-num="20"]'); const c21 = s.querySelector('[data-case-num="21"]'); const c22 = s.querySelector('[data-case-num="22"]'); return { aff: s.getAttribute('data-affichage') + '|' + s.getAttribute('data-densite') + '|' + s.getAttribute('data-teinte'), photos: s.querySelectorAll('.vrm-ph4').length, n20: c20 ? c20.textContent.replace(/\s+/g, ' ').trim() : null, grand: c20 && c20.querySelector('.vrm-n4') ? parseFloat(getComputedStyle(c20.querySelector('.vrm-n4')).fontSize) : 0, sortir: c22 ? [c22.querySelector('[data-case-ligne]') && c22.querySelector('[data-case-ligne]').getAttribute('data-case-ligne'), getComputedStyle(c22.querySelector('.vrm-lab4')).backgroundColor] : null, double: c21 ? c21.querySelector('[data-case-ligne]') && c21.querySelector('[data-case-ligne]').getAttribute('data-case-ligne') : null }; });
  // N°20 : 30 + 20 % 50 = 50 € lus chez Vinted (le prix de l'annonce en ligne) ; jamais deviné.
  dit(!!apres && apres.aff === 'rayonnage|loin|sauge' && apres.photos === 0 && /N°\s?20/.test(apres.n20 || '') && /(50|95)\s?€/.test(apres.n20 || '') && apres.grand >= 24, `${t} · W2 : enregistré — le Garage en rayonnage, de loin : N° en grand (≥ 24 px), le prix LU (50 € chez Vinted, 95 € chez Leboncoin), aucune photo`, apres);
  dit(!!apres && apres.sortir && apres.sortir[0] === 'sortir' && /rgb\(255, 213, 150\)/.test(apres.sortir[1]) && apres.double === 'double', `${t} · W3 : en rayonnage aussi, « À sortir » (étiquette ambre) et « En double »`, apres && { sortir: apres.sortir, double: apres.double });
  const lu = await pg.evaluate(() => { try { const l = JSON.parse(localStorage.getItem('vrm_meubles')); const a = l.find((m) => m.id === 'mA'), b = l.find((m) => m.id === 'mB'); return { a: a && a.reglages, aCols: a && a.cols, aNom: a && a.name, bReg: b ? ('reglages' in b) : null }; } catch (_) { return null; } });
  dit(!!lu && lu.a && lu.a.affichage === 'rayonnage' && lu.a.densite === 'loin' && lu.a.teinte === 'sauge' && lu.a.etiquette && lu.a.etiquette.grand === true && lu.a.etiquette.prix === true && lu.a.etiquette.photo === true && lu.aCols === 4 && lu.aNom === 'Garage' && lu.bReg === false,
    `${t} · W2 : « Enregistrer » écrit les réglages DANS le Garage (\`vrm_meubles\`, synchronisé : la fusion champ par champ est jugée par audit-stock-etageres R4), rien dans les autres meubles`, lu);
  if (CAPT) { await pg.evaluate(() => { const m = document.querySelector('[data-meuble="mA"]'); if (m) m.scrollIntoView({ block: 'start' }); }); await pg.waitForTimeout(300); await pg.screenshot({ path: path.join(CAPT, `etag-${v}-10-rayonnage.png`) }); }
  // Plan, puis retour en Cartons confortable (la suite du banc lit les cartons du Garage)
  await toucher(pg, '[data-meuble-perso="mA"]');
  await pg.waitForSelector('[data-perso-meuble="mA"]', { timeout: 8000 }).catch(() => {});
  await toucher(pg, '[data-perso-affichage="plan"]');
  await toucher(pg, '[data-perso-enregistrer]');
  await pg.waitForTimeout(900);
  const plan = await pg.evaluate(() => { const s = document.querySelector('[data-meuble="mA"]'); if (!s) return null; const c = s.querySelector('[data-case-num="20"]').getBoundingClientRect(); return { aff: s.getAttribute('data-affichage'), carre: Math.abs(c.width - c.height) < 2, w: Math.round(c.width), regle: s.querySelectorAll('[data-regle-col]').length }; });
  dit(!!plan && plan.aff === 'plan' && plan.carre && plan.w >= 44 && plan.regle === 4, `${t} · W5 : « Plan » : vu de dessus, une case = un carré (≥ 44 px), les colonnes numérotées`, plan);
  if (CAPT) await pg.screenshot({ path: path.join(CAPT, `etag-${v}-11-plan.png`) });
  await toucher(pg, '[data-meuble-perso="mA"]');
  await pg.waitForSelector('[data-perso-meuble="mA"]', { timeout: 8000 }).catch(() => {});
  await toucher(pg, '[data-perso-affichage="cartons"]');
  await toucher(pg, '[data-perso-densite="confortable"]');
  await toucher(pg, '[data-perso-teinte="melees"]');
  await toucher(pg, '[data-perso-etiquette="grand"]');
  await toucher(pg, '[data-perso-etiquette="prix"]');
  await toucher(pg, '[data-perso-enregistrer]');
  await pg.waitForTimeout(900);
}

(async () => {
  let b;
  const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' : le scénario a tourné jusqu’au bout', String(e && e.message).slice(0, 300)); } };
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const v of VARIANTES) {
      const tel = v.startsWith('390'), sombre = v.endsWith('s'); const complet = v === '390c' || v === '1512s';
      const larg = Number(v.slice(0, -1)) || 1512;
      const t = `${tel ? '390' : larg} ${sombre ? 'sombre' : 'clair'}`;
      await essaie(t, async () => {
        const r = await rendre(b, tel, sombre, larg); const pg = r.pg;
        const bureau = await BUREAU(pg);
        dit(tel ? !bureau : bureau, `${t} · W0 : ${tel ? 'au téléphone, « La pièce » puis chaque meuble' : 'à l’ordinateur, les trois volets (pièce · meuble · fiche)'}`, bureau);
        await voir(pg, 'mB');
        // ── A ──
        dit(await ou(pg, '12') === 'mB:22', `${t} · A : N°12 est dans SA case d'hier (Bureau, rangée 4, colonne 2)`, await ou(pg, '12'));
        const ordre = (await meublesListe(pg)).join(',');
        dit(ordre === 'mA,mB,mQ', `${t} · A : les meubles d'hier dans leur ordre`, ordre);
        let nCases = 0;
        if (bureau) { for (const id of await meublesListe(pg)) { await voir(pg, id); nCases += await pg.evaluate((id) => document.querySelectorAll(`[data-meuble="${id}"] .vrm-s2d-case`).length, id); } await voir(pg, 'mA'); }
        else nCases = await pg.evaluate(() => document.querySelectorAll('[data-meuble] .vrm-s2d-case').length);
        dit(nCases === 32 + 70 + 4, `${t} · A : toutes leurs cases dessinées (106)`, nCases);
        dit(r.ecrits.length === 0, `${t} · A : AUCUNE écriture de la ligne main au montage (reprise sans migration)`, r.ecrits.length);
        console.log(`    (1 000 paires : la grille est là en ${r.tGrille} ms)`);
        // ── B ──
        await voir(pg, 'mQ');
        const notee = await pg.evaluate(() => { const c = document.querySelector('[data-case-notee="9999"]'); return c ? c.getAttribute('data-case-ici') + '|' + c.getAttribute('data-case-etat') + '|' + (c.textContent || '').trim() : null; });
        dit(notee === 'mQ:3|notee|N°9999', `${t} · B : la case d'un N° pas montré est PRISE (« N°9999 », jamais « + »)`, notee);
        await voir(pg, 'mA');
        const rouge = await pg.evaluate(() => { const c = document.querySelector('[data-case-num="21"]'); if (!c) return null; const l = [c, ...c.querySelectorAll('*')]; const sh = l.map((e) => getComputedStyle(e).boxShadow).filter((x) => /rgb\((\d+), (\d+), (\d+)\)/.test(x) && x !== 'none').find((x) => { const m = /rgb\((\d+), (\d+), (\d+)\)/.exec(x); return +m[1] > 150 && +m[2] < 120 && +m[3] < 110; }) || 'none'; return { dbl: c.classList.contains('is-double'), sh, mot: (c.querySelector('[data-case-ligne="double"]') || {}).textContent || '' }; });
        const estRouge = rouge && /rgb\((\d+), (\d+), (\d+)\)/.exec(rouge.sh); const rr = estRouge ? estRouge.slice(1).map(Number) : null;
        dit(!!(rouge && rouge.dbl && rr && rr[0] > 150 && rr[1] < 120 && rr[2] < 110), `${t} · B : la case du N° en doublon est rouge (le seul rouge)`, rouge);
        const autresRouges = await pg.evaluate(() => [...document.querySelectorAll('.vrm-s2d-case')].filter((c) => !c.classList.contains('is-double')).filter((c) => [c, ...c.querySelectorAll('*')].some((e) => { const k = getComputedStyle(e); const re = /rgb\((\d+), (\d+), (\d+)\)/g; let m; const s = k.boxShadow + ' ' + k.backgroundColor + ' ' + k.color + ' ' + k.borderTopColor; while ((m = re.exec(s))) { const [x, y, z] = m.slice(1).map(Number); if (x > 170 && y < 90 && z < 90) return true; } return false; })).length);
        dit(autresRouges === 0, `${t} · B : aucune autre case rouge`, autresRouges);
        if (CAPT) { await pg.evaluate(() => { const m = document.querySelector('[data-meuble="mA"]'); if (m) m.scrollIntoView({ block: 'start' }); }); await pg.waitForTimeout(300); await pg.screenshot({ path: path.join(CAPT, `etag-${v}-1-repris.png`), fullPage: false }); }
        // ── K : les sites et le compte sur la case (par identité) ──
        const K = await pg.evaluate(() => { const c = (n) => { const e = document.querySelector(`[data-case-num="${n}"]`); if (!e) return null; const b = e.querySelector('.vrm-etag-sites'); const t = e.querySelector('.vrm-etag-compte'); const sv = b ? [...b.querySelectorAll('svg[data-marque]')] : []; return { sites: b ? b.getAttribute('data-case-sites') : null, compte: b ? b.getAttribute('data-case-compte') : null, texte: t ? t.textContent : '', logos: sv.map((x) => Math.round(x.getBoundingClientRect().height)), police: t ? parseFloat(getComputedStyle(t).fontSize) : 0, coupe: t ? t.scrollWidth > t.clientWidth + 1 : false, dedans: b ? b.getBoundingClientRect().right <= e.getBoundingClientRect().right + 0.5 : true }; }; return { n20: c('20'), n21: c('21'), n23: c('23') }; });
        dit(!!K.n20 && /vinted:enligne/.test(K.n20.sites || '') && /leboncoin:enligne/.test(K.n20.sites || '') && K.n20.compte === 'compte_invente', `${t} · K1 : N°20 montre Vinted ET Leboncoin (sa référence VRM-20) et son compte « compte_invente »`, K.n20);
        dit(!!K.n21 && K.n21.sites === 'vinted:enligne', `${t} · K2 : N°21 — une annonce Leboncoin au MÊME titre (autre paire, VRM-999) ne lui donne aucun logo`, K.n21);
        dit(!!K.n23 && K.n23.sites === 'vinted:enligne' && !K.n23.compte && K.n23.texte === '', `${t} · K3 : N°23, compte sans pseudo connu ⇒ aucun nom (jamais l'identifiant « 333 »)`, K.n23);
        dit(!!K.n20 && K.n20.logos.length === 2 && K.n20.logos.every((h) => h >= 10 && h <= 13) && K.n20.police >= 10 && K.n20.dedans && K.n20.texte === 'compte_invente', `${t} · K4 : logos 10,5 px (la maquette v4), le compte ≥ 10 px sur l'étiquette, tenus dans la case`, K.n20);
        if (CAPT) { await pg.evaluate(() => document.querySelector('[data-case-num="20"]').scrollIntoView({ block: 'center' })); await pg.waitForTimeout(300); await pg.screenshot({ path: path.join(CAPT, `etag-${v}-0-sites.png`) }); }
        if (complet) {
          await toucher(pg, '[data-case-num="20"]');
          if (bureau) {
            await pg.waitForSelector('[data-stock-cote="20"]', { timeout: 6000 }).catch(() => {});
            const cote = await pg.evaluate(() => { const a = document.querySelector('[data-stock-cote="20"]'); if (!a) return null; return { sites: [...a.querySelectorAll('[data-fiche-site]')].map((x) => x.getAttribute('data-fiche-site')).join(','), num: (a.querySelector('[data-cote-num]') || {}).textContent, place: (a.querySelector('[data-cote-place]') || { getAttribute: () => null }).getAttribute('data-cote-place'), gestes: [...a.querySelectorAll('.vrm-st4-gestes > button')].map((x) => Math.round(x.getBoundingClientRect().height)) }; });
            dit(!!cote && cote.sites === 'vinted,leboncoin' && cote.num === 'N°20' && cote.place === '1:1' && cote.gestes.length === 3 && cote.gestes.every((h) => h >= 44), `${t} · W7 : la case touchée se montre dans le volet de droite (N°, une ligne par site, sa place, trois gestes de 44 px)`, cote);
            if (CAPT) await pg.screenshot({ path: path.join(CAPT, `etag-${v}-0c-volets.png`) });
            await toucher(pg, '[data-cote-fiche="20"]');
          }
          await pg.waitForSelector('[data-stock-fiche] .vrm-etag-fiche-sites[data-fiche-sites]', { state: 'attached', timeout: 8000 }).catch(() => {});
          // ── K6 (16 nov., finitions) : la vue « Sites » de la FICHE D dit les MÊMES sites et comptes que la case du Stock
          //    (une source par identité, src/stockAnnonces.js) ; ce qui n'a pas été lu est dit « pas su », jamais « pas en ligne ».
          await toucher(pg, '[data-fd-seg="sites"]');
          await pg.waitForFunction(() => { const s = document.querySelector('.vrm-fp .fd-sites'); return s && !s.hasAttribute('data-fd-sites-lecture'); }, null, { timeout: 15000 }).catch(() => {});
          const K6 = await pg.evaluate(() => { const l = [...document.querySelectorAll('.vrm-fp .fd-sites .fd-site')]; return l.map((x) => [x.getAttribute('data-fiche-site'), x.getAttribute('data-fiche-site-etat'), x.getAttribute('data-fiche-site-compte') || ''].join(':')); });
          const enL6 = K6.filter((x) => /:en-ligne:/.test(x));
          dit(enL6.length === 2 && enL6.includes('vinted:en-ligne:compte_invente') && enL6.includes('leboncoin:en-ligne:nord_lbc'), `${t} · K6 : la fiche D (vue Sites) de N°20 = la case du Stock — Vinted · compte_invente ET Leboncoin · nord_lbc`, K6);
          // Vestiaire n'est pas servi par ce banc (jamais lu) : la fiche le DIT « pas su », comme le Stock le nomme — sans le taire.
          dit(K6.some((x) => /^vestiaire:pas-su/.test(x)) && !K6.some((x) => /^vestiaire:en-ligne/.test(x)), `${t} · K7 : Vestiaire, jamais lu, est dit « pas su » sur la fiche (jamais tu, jamais « en ligne »)`, K6);
          if (CAPT) await pg.screenshot({ path: path.join(CAPT, `etag-${v}-0a-fiche-d-sites.png`) });
          await ouvrirPlus(pg);
          // ── K8 (16 nov., intégration, capture de Julien) : à 1512 la feuille « ⋯ » de la fiche ouverte depuis une case
          //    débordait de 12 px à gauche du panneau (coupée) : plus de marge. Elle tient DANS la fiche, ses tuiles à ≥ 12 px du bord.
          const K8 = await pg.evaluate(() => { const fp = document.querySelector('.vrm-fp.fd'), f = document.querySelector('.vrm-fp .fd-plus:not([hidden]) .fd-plus-f'), t = document.querySelector('.vrm-fp .fd-plus:not([hidden]) .fd-tuile'); if (!fp || !f || !t) return null; const a = fp.getBoundingClientRect(), b = f.getBoundingClientRect(), c = t.getBoundingClientRect(); return { fiche: [Math.round(a.left), Math.round(a.right)], feuille: [Math.round(b.left), Math.round(b.right)], marge: Math.round(c.left - Math.max(a.left, b.left)) }; });
          dit(!!K8 && K8.feuille[0] >= K8.fiche[0] - 1 && K8.feuille[1] <= K8.fiche[1] + 1 && K8.marge >= 12, `${t} · K8 : la feuille « ⋯ » tient dans la fiche, ses tuiles à ≥ 12 px du bord gauche`, K8);
          // les rangées du STOCK (src/stockAnnonces.js, par identité) ; la vue « Sites » de la fiche D a sa propre règle (Prix partout)
          const fs2 = await pg.evaluate(() => { const l = [...document.querySelectorAll('[data-stock-fiche] .vrm-etag-fiche-site[data-fiche-site]')]; return l.map((x) => x.getAttribute('data-fiche-site') + ':' + (x.getAttribute('data-compte') || '') + ':' + x.textContent.replace(/\s+/g, ' ').trim()); });
          dit(fs2.length === 2 && /^vinted:compte_invente:/.test(fs2[0]) && /^leboncoin:nord_lbc:.*95/.test(fs2[1]), `${t} · K5 : la fiche de N°20 dit une ligne par site (logo · compte · prix · depuis)`, fs2);
          if (CAPT) await pg.screenshot({ path: path.join(CAPT, `etag-${v}-0b-fiche-sites.png`) });
          await fermerFiche(pg); await pg.keyboard.press('Escape').catch(() => {}); await pg.waitForTimeout(400);
        }
        if (!complet) {
          await piece(pg, t, v, bureau);
          if (bureau) {
            const vol = await pg.evaluate(() => { const q = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right), Math.round(r.width)]; }; return { g: q('.vrm-st4-gauche'), c: q('.vrm-st4-centre'), d: q('.vrm-st4-droite'), rail: !!document.querySelector('nav[data-rail-verre]'), cw: document.documentElement.clientWidth }; });
            const okV = vol.g && vol.c && vol.d && vol.g[1] <= vol.c[0] && vol.c[1] <= vol.d[0] && vol.d[1] <= vol.cw && vol.c[2] >= 420;
            dit(!!okV, `${t} · W7 : trois volets côte à côte, sans chevauchement, dans l'écran (centre ≥ 420 px)`, vol);
            await toucher(pg, '[data-case-num="20"]'); await pg.waitForTimeout(400);
            if (CAPT) await pg.screenshot({ path: path.join(CAPT, `etag-${v}-0c-volets.png`) });
          }
          const x = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
          dit(x.sw <= x.cw + 1, `${t} · H : aucune page plus large que l'écran`, x);
          await pg.evaluate(() => { const s = document.querySelector('[data-meuble="mQ"]'); if (s) s.scrollIntoView({ block: 'center' }); });
          if (CAPT) await pg.screenshot({ path: path.join(CAPT, `etag-${v}-2-meubles.png`) });
          dit(r.errs.length === 0, `${t} · H : aucune erreur d'app`, r.errs.join(' | '));
          await r.ctx.close(); return;
        }
        // ── F : la pile d'hier, le haut retiré : le N° pas montré garde sa case ──
        await voir(pg, 'mQ');
        await retirerCase(pg, '62');
        const hier = [await ou(pg, '61'), await pg.evaluate(() => { const c = document.querySelector('[data-case-notee="9999"]'); return c ? c.getAttribute('data-case-ici') : null; })];
        dit(hier[0] === 'mQ:2' && hier[1] === 'mQ:3', `${t} · F : N°61 reste posé sur le carton N°9999 (pas montré) : personne ne passe au travers`, hier);
        // ── V : le visuel (revue du 15 nov.) ──
        await voir(pg, 'mA');
        await pg.evaluate(() => { const m = document.querySelector('[data-meuble="mA"]'); if (m) m.scrollIntoView({ block: 'center' }); });
        await pg.waitForTimeout(1500);
        const barre = await pg.evaluate(() => { const b = document.querySelector('[data-stock-recherche]'); if (!b) return null; const cs = getComputedStyle(b); const c = cs.backgroundColor; const m = /rgba?\(([^)]+)\)/.exec(c) || /color\(srgb ([^)]+)\)/.exec(c); let a = 1; if (m) { const p = m[1].split(/[\s,\/]+/).filter(Boolean); if (p.length >= 4) a = Number(p[3]); } if (/transparent/.test(c)) a = 0; const q = b.getBoundingClientRect(); const vue = q.bottom > 0 && q.top < innerHeight; const e = vue ? document.elementFromPoint(q.left + q.width - 70, q.top + q.height / 2) : null; const img = (() => { const c = document.querySelector('[data-meuble="mA"] .vrm-s2d-case[data-case-num] img'); if (!c) return null; const r = c.getBoundingClientRect(), k = getComputedStyle(c); return { vu: c.hasAttribute('data-vu'), pv: c.getAttribute('data-photo-vinted'), anim: k.animationName + ' ' + k.animationPlayState + ' ' + k.animationDelay, tr: k.transition.slice(0, 60), w: Math.round(r.width), h: Math.round(r.height), op: k.opacity, vis: k.visibility, src: (c.currentSrc || c.src || '').slice(-22), nat: c.naturalWidth, z: k.zIndex, pos: k.position, sous: (() => { const el = document.elementFromPoint(r.left + r.width / 2, r.top + 8); return el ? (el.tagName + '.' + String(el.className).slice(0, 40)) : null; })() }; })(); return { a, z: cs.zIndex, vue, top: Math.round(q.top), dessus: vue ? !!(e && b.contains(e)) : null, par: e ? (e.tagName + '.' + String(e.className).slice(0, 40)) : null, pos: cs.position, img }; });
        if (process.env.BANC_DEBUG) console.log('    (barre ' + JSON.stringify(barre) + ')');
        dit(!!barre && barre.a >= 0.9 && barre.dessus !== false, `${t} · V1 : la recherche collée est opaque et passe AU-DESSUS des cases`, barre);
        const vig = await pg.evaluate(() => { const cs = [...document.querySelectorAll('[data-meuble="mA"] .vrm-s2d-case[data-case-num]')].filter((c) => { const q = c.getBoundingClientRect(); return q.top >= 0 && q.bottom <= innerHeight; }); const im = cs.filter((c) => { const i = c.querySelector('img'); return i && i.complete && i.naturalWidth > 0; }).length; const lettres = cs.filter((c) => !!c.querySelector('.vrm-s2d-sansphoto, [data-sans-photo]') || !c.querySelector('img')).length; const pl = cs[0] && cs[0].querySelector('.vrm-s2d-num'); return { n: cs.length, im, lettres, plaque: pl ? parseFloat(getComputedStyle(pl).fontSize) : 0 }; });
        dit(vig.n > 0 && vig.im === vig.n && vig.lettres === 0 && vig.plaque >= 11, `${t} · V2 : chaque case montre la PHOTO de sa paire, aucune lettre, le N° en plaque (≥ 11 px)`, vig);
        const pied = bureau ? await pg.evaluate(() => { const a = document.querySelector('.vrm-st4-gauche [data-creer-meuble]'); if (!a) return null; const p = a.getBoundingClientRect(); return { recouvre: false, ligne: true, h: [Math.round(p.height), 0] }; }) : await pg.evaluate(() => { const a = document.querySelector('[data-creer-meuble]'), b = document.querySelector('[data-stock-explication-ouvrir]'); if (!a || !b) return null; const p = a.getBoundingClientRect(), q = b.getBoundingClientRect(); const recouvre = !(p.right <= q.left || q.right <= p.left || p.bottom <= q.top || q.bottom <= p.top); return { recouvre, ligne: Math.abs((p.top + p.bottom) / 2 - (q.top + q.bottom) / 2) < 4, h: [Math.round(p.height), Math.round(q.height)] }; });
        dit(!!pied && !pied.recouvre && pied.ligne && pied.h[0] >= (tel ? 44 : 40), `${t} · V3 : ${bureau ? '« Ajouter un meuble » au pied du volet de la pièce' : '« Ajouter un meuble » et « Comment ça marche ? » sur une ligne, sans se chevaucher'}`, pied);
        await voir(pg, 'mQ');
        const pq = await pg.evaluate(() => { const s = document.querySelector('[data-meuble="mQ"]'); if (!s) return null; const c = s.querySelector('.vrm-s2d-case').getBoundingClientRect(); const coupees = [...s.querySelectorAll('.vrm-s2d-num')].filter((x) => x.scrollWidth > x.clientWidth + 1).length; return { w: Math.round(s.querySelector('.vrm-s2d-etagere').getBoundingClientRect().width), ch: Math.round(c.height), cw: Math.round(c.width), coupees }; });
        dit(!!pq && pq.w <= 200 && pq.ch <= 110 && pq.cw <= 100 && pq.coupees === 0, `${t} · V4 : une pile reste étroite (≤ 200 px), ses cartons ceux de la maquette v4 (≤ 100 × 110), ses N° entiers (« N°9999 » pas coupé)`, pq);
        if (CAPT) await pg.screenshot({ path: path.join(CAPT, `etag-${v}-1b-piece.png`) });
        await piece(pg, t, v, bureau);
        await personnaliser(pg, t, v, tel, r);
        // ── C : une étagère 4×3, « sauge », rangée 1 « ciel » ──
        await toucher(pg, '[data-creer-meuble]');
        await pg.waitForSelector('[data-editeur-meuble]', { timeout: 8000 });
        const presse = await pg.getAttribute('[data-type-choix="etagere"]', 'aria-pressed');
        const dims = await pg.evaluate(() => [...document.querySelectorAll('[data-editeur-dim]')].map((x) => x.value).join('×'));
        dit(presse === 'true' && dims === '4×3', `${t} · C : un meuble neuf part d'une étagère 4×3`, `${presse} ${dims}`);
        await pg.fill('[data-editeur-nom]', 'Étagère test');
        await toucher(pg, '[data-couleur-choix="sauge"]');
        await pg.click('[data-editeur-peindre] > summary');
        await toucher(pg, '[data-pinceau="ciel"]');
        await toucher(pg, '[data-peindre-rang="1"]');
        if (CAPT) { await pg.evaluate(() => document.querySelector('[data-editeur-peindre]').scrollIntoView({ block: 'center' })); await pg.screenshot({ path: path.join(CAPT, `etag-${v}-3-editeur.png`) }); }
        // 44 px au doigt (390 tactile) ; à la souris, la touche du studio fait 40 (son contrat, studio.css) — planches comprises.
        const mini = tel ? 43.5 : 39.5;
        const petits = await pg.evaluate((mini) => [...document.querySelectorAll('[data-editeur-meuble] button')].filter((x) => x.offsetParent).map((x) => [x.getAttribute('aria-label') || x.textContent.trim().slice(0, 12), Math.round(x.getBoundingClientRect().width), Math.round(x.getBoundingClientRect().height)]).filter((q) => q[1] < mini || q[2] < mini), mini);
        dit(petits.length === 0, `${t} · H : chaque bouton de l'éditeur fait ${tel ? '44 px au doigt' : '40 px (touche du studio, souris)'} au moins`, petits);
        await toucher(pg, '[data-meuble-enregistrer]');
        await pg.waitForTimeout(900);
        const nouv = await pg.evaluate(() => { const s = [...document.querySelectorAll('[data-meuble]')].find((x) => x.querySelector('.vrm-s2d-nom') && x.querySelector('.vrm-s2d-nom').textContent === 'Étagère test'); if (!s) return null; const cs = [...s.querySelectorAll('.vrm-s2d-case')]; return { id: s.getAttribute('data-meuble'), coul: s.getAttribute('data-couleur'), type: s.getAttribute('data-meuble-type'), n: cs.length, ciel: cs.filter((c) => c.getAttribute('data-couleur') === 'ciel' && c.hasAttribute('data-couleur-propre')).map((c) => c.getAttribute('data-case-ici').split(':')[1]).join(','), sauge: cs.filter((c) => c.getAttribute('data-couleur') === 'sauge').length }; });
        if (CAPT && nouv) { await pg.evaluate((id) => document.querySelector(`[data-meuble="${id}"]`).scrollIntoView({ block: 'center' }), nouv.id); await pg.screenshot({ path: path.join(CAPT, `etag-${v}-3b-etagere.png`) }); }
        dit(!!nouv && nouv.coul === 'sauge' && nouv.type === 'etagere' && nouv.n === 12 && nouv.ciel === '0,1,2,3' && nouv.sauge === 8, `${t} · C : l'étagère 4×3 « sauge » est dessinée, sa rangée 1 en « ciel »`, nouv);
        // ── D : une pile de 5 ──
        await toucher(pg, '[data-creer-meuble]');
        await pg.waitForSelector('[data-editeur-meuble]', { timeout: 8000 });
        await toucher(pg, '[data-type-choix="pile"]');
        const dimsP = await pg.evaluate(() => [...document.querySelectorAll('[data-editeur-dim]')].map((x) => x.value).join('×'));
        dit(dimsP === '1×5', `${t} · D : « Pile » propose 1 × 5`, dimsP);
        await pg.fill('[data-editeur-nom]', 'Pile test');
        await toucher(pg, '[data-meuble-enregistrer]');
        await pg.waitForTimeout(900);
        const pid = await pg.evaluate(() => { const s = [...document.querySelectorAll('[data-meuble]')].find((x) => x.querySelector('.vrm-s2d-nom') && x.querySelector('.vrm-s2d-nom').textContent === 'Pile test'); return s ? s.getAttribute('data-meuble') + '|' + s.getAttribute('data-meuble-type') + '|' + s.querySelectorAll('.vrm-s2d-case').length : null; });
        dit(pid && /\|pile\|5$/.test(pid), `${t} · D : la pile de 5 est dessinée`, pid);
        const P = pid ? pid.split('|')[0] : 'x';
        const aRanger = await pg.evaluate(() => [...document.querySelectorAll('[data-a-ranger]')].slice(0, 3).map((x) => x.getAttribute('data-a-ranger')));
        for (const n of aRanger) {
          await toucher(pg, `[data-a-ranger="${n}"]`);
          await toucher(pg, `[data-case-ici="${P}:0"]`);   // touchée EN HAUT
          await pg.waitForTimeout(500);
        }
        const places = []; for (const n of aRanger) places.push(await ou(pg, n));
        dit(aRanger.length === 3 && places.join(',') === `${P}:4,${P}:3,${P}:2`, `${t} · D : trois paires touchées en haut de la pile tombent l'une sur l'autre (bas, puis dessus)`, { aRanger, places });
        if (CAPT) { await pg.evaluate((P) => document.querySelector(`[data-meuble="${P}"]`).scrollIntoView({ block: 'center' }), P); await pg.screenshot({ path: path.join(CAPT, `etag-${v}-4-pile.png`) }); }
        // ── E : sortir celle du bas ──
        const ok = await retirerCase(pg, aRanger[0]);
        await pg.waitForTimeout(600);
        const apres = [await ou(pg, aRanger[0]), await ou(pg, aRanger[1]), await ou(pg, aRanger[2])];
        dit(ok && apres[0] === null && apres[1] === `${P}:4` && apres[2] === `${P}:3`, `${t} · E : celle du bas sort ⇒ les deux du dessus descendent d'un cran`, apres);
        const desc = await pg.evaluate((P) => { const d = document.querySelector(`[data-meuble="${P}"] [data-descente]`); return d ? { cles: d.getAttribute('data-descente'), texte: d.textContent } : null; }, P);
        dit(!!desc && desc.cles === `${aRanger[1]},${aRanger[2]}` && desc.texte.includes('N°' + aRanger[1]) && desc.texte.includes('N°' + aRanger[2]), `${t} · E : c'est DIT sur la pile (« N°… et N°… sont descendus d'un cran »)`, desc);
        await pg.waitForTimeout(2500);
        const fois = await pg.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => e.children.length === 0 && /descendus? d/.test(e.textContent || '') && !e.closest('[data-descente]')).length);
        const reste = await pg.evaluate(() => !!document.querySelector('[data-descente]'));
        dit(fois === 0 && reste, `${t} · V5 : la descente est dite UNE fois (le bandeau du meuble, qui reste jusqu'à « Compris »), aucun message par-dessus`, { fois, reste });
        const cote = await pg.evaluate(() => { const ss = [...document.querySelectorAll('[data-meuble]')]; const e = ss.find((x) => x.querySelector('.vrm-s2d-nom') && x.querySelector('.vrm-s2d-nom').textContent === 'Étagère test'); const p = ss.find((x) => x.querySelector('.vrm-s2d-nom') && x.querySelector('.vrm-s2d-nom').textContent === 'Pile test'); if (!e || !p) return null; const a = e.getBoundingClientRect(), b = p.getBoundingClientRect(); const g = p.querySelector('.vrm-s2d-etagere').getBoundingClientRect(), tt = p.querySelector('.vrm-s2d-tete').getBoundingClientRect(); return { memeLigne: Math.abs(a.bottom - b.bottom) < 3 && b.left > a.right - 1, ew: Math.round(a.width), pw: Math.round(g.width), teteADroite: tt.left >= g.right - 1 }; });
        if (tel) dit(!!cote && cote.pw <= 200 && cote.teteADroite, `${t} · V4 : la pile garde la largeur de ses cartons, son nom et ses gestes à côté (pas de grand vide)`, cote);
        const fichesApres = await pg.evaluate(() => { try { const f = JSON.parse(localStorage.getItem('vinted_annonce_numeros')); return Object.values(f).filter((x) => x && x.numero).length; } catch (_) { return -1; } });
        dit(fichesApres === N + 1, `${t} · E : aucun N° touché (1 001 fiches, mêmes numéros)`, fichesApres);
        if (CAPT) { await pg.evaluate((P) => document.querySelector(`[data-meuble="${P}"]`).scrollIntoView({ block: 'center' }), P); await pg.screenshot({ path: path.join(CAPT, `etag-${v}-5-descente.png`) }); }
        const fondu = await pg.evaluate(() => { const l = [...document.querySelectorAll('.vrm-s2d-case img')].filter((x) => x.complete && x.naturalWidth > 0); return { n: l.length, invisibles: l.filter((x) => Number(getComputedStyle(x).opacity) < 0.9).length }; });
        dit(fondu.n > 0 && fondu.invisibles === 0, `${t} · V2 : après les gestes, les photos des cases restent VISIBLES (aucune recréée à chaque rendu)`, fondu);
        // ── G : chercher un N°, réordonner ──
        await pg.fill('[data-stock-recherche] input', '12');
        await pg.waitForSelector('[data-stock-res="12"]', { timeout: 8000 }).catch(() => {});
        await toucher(pg, '[data-stock-res="12"]');
        await pg.waitForTimeout(500);
        const allume = await pg.evaluate(() => { const c = document.querySelector('[data-case-num="12"]'); return c ? (c.classList.contains('vrm-case-flash') || c.hasAttribute('data-case-vise')) : null; });
        dit(allume === true, `${t} · G : chercher « 12 » allume la case du N°12`, allume);
        if (CAPT) await pg.screenshot({ path: path.join(CAPT, `etag-${v}-6-recherche.png`) });
        await pg.waitForTimeout(4200);
        await voir(pg, 'mA');
        await toucher(pg, '[data-meuble-perso="mA"]');
        await pg.waitForSelector('[data-perso-meuble="mA"]', { timeout: 6000 }).catch(() => {});
        await toucher(pg, '[data-meuble-descendre="mA"]');
        await pg.waitForTimeout(500);
        const ordre2 = (await meublesListe(pg)).slice(0, 2).join(',');
        dit(ordre2 === 'mB,mA', `${t} · G : « Descendre » le Garage le met après le Bureau`, ordre2);
        const rondPetit = await pg.evaluate((mini) => [...document.querySelectorAll('[data-meuble-monter],[data-meuble-descendre],[data-meuble-modifier]')].map((x) => x.getBoundingClientRect()).filter((q) => q.width < mini || q.height < mini).length, tel ? 43.5 : 39.5);
        dit(rondPetit === 0, `${t} · H : monter / descendre / modifier font ${tel ? 44 : 40} px au moins`, rondPetit);
        await pg.keyboard.press('Escape').catch(() => {}); await pg.waitForTimeout(500);
        // ── H ──
        await pg.waitForTimeout(1500);
        const garde = await pg.evaluate(() => { try { const l = JSON.parse(localStorage.getItem('vrm_meubles')); const b = l.find((m) => m.id === 'mB'); return b && b.gravite === false && Array.isArray(b.planches) && b.cols === 7 && b.rows === 10 && b.name === 'Bureau' && l.length === 5; } catch (_) { return false; } });
        dit(garde, `${t} · H : les meubles d'hier gardent leurs champs d'origine (Bureau 7×10, gravite:false, planches)`);
        const x = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
        dit(x.sw <= x.cw + 1, `${t} · H : aucune page plus large que l'écran`, x);
        dit(r.errs.length === 0, `${t} · H : aucune erreur d'app`, r.errs.join(' | '));
        await r.ctx.close();
      });
    }
  } finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n${ko} échec(s)` : '\nTout est vert');
  process.exit(ko ? 1 : 0);
})();
