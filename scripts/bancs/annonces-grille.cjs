// ════════════════════════════════════════════════════════════════════════════
//  BANC « ANNONCES EN GRILLE, PAR COMPTE » (10 nov., lot AM — demande 15).
//  Julien : « la disposition par compte de Vinted me plaît (grille de cartes :
//  photo, N°, titre, état, prix) ⇒ la même pour Toutes, en gardant toutes les
//  fonctions ; les propositions collées entre elles cachent le produit ». Puis,
//  sur une capture iPhone (« Améliore ça stp ») : carte ouverte qui étire sa
//  voisine, titre coupé et blanc avec l'icône note seule, libellés coupés
//  (« Accepter / dès »), « — » isolés, « Ranger au stoc » tronqué, deux gabarits,
//  le « V » répété sur chaque carte.
//  Données INVENTÉES (deux comptes, sept annonces), 390 px tactile et 1512 px,
//  clair et sombre. Il exige :
//   G1 une grille de vignettes, un en-tête par compte (initiale, nom, nombre) ;
//   G2 chaque annonce une fois, l'ordre de l'écran gardé dans chaque compte ;
//   G3 2 colonnes à 390 px, 4 à 6 à 1512 px ;
//   G4 vignette fermée : photo carrée, N° en pastille, titre sur 2 lignes, prix,
//      marques d'état — rien d'autre (ni achat/mini/refuse/boost/marge, ni le « V »,
//      ni le nom du compte, ni l'icône note seule) ;
//   G5 UN seul gabarit : toutes les vignettes fermées ont la même hauteur ;
//   G6 aucun libellé coupé ni tronqué dans une vignette (fermée ou ouverte) ;
//   G7 toucher la vignette l'ouvre EN PLACE sur toute la largeur, sans étirer
//      aucune voisine ; tout y est (achat, mini, refuse, boost, marge, gestes,
//      « … ») en rangées pleine largeur ; l'achat se modifie ; « … » ouvre ses gestes ;
//   G8 toucher la photo ouvre la visionneuse (pas un nouvel onglet) ;
//   G9 « Même paire ? » est SUR la vignette de la nouvelle annonce, rien n'est
//      relié avant SON clic, « Oui » donne N°7 ;
//   G10 « En double » sur les deux annonces de même photo (lot AF) ;
//   G11 aucune page qui défile de côté, aucune erreur.
//  BANC_PORT (aléatoire si absent), BANC_DIST, BANC_CAPTURES.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const { routeMain, attendre } = require('./_base-ecritures.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || (20000 + Math.floor(Math.random() * 20000));
const CAPTURES = process.env.BANC_CAPTURES || path.join(require('os').tmpdir(), 'banc-annonces-grille');
try { fs.mkdirSync(CAPTURES, { recursive: true }); } catch (_) {}
const PNG = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'icon-512.png'));
const auj = new Date();
const ilYa = (h) => new Date(Date.now() - h * 3600e3).toISOString();
const PHOTO_DOUBLE = 'https://images1.vinted.net/t/02_banc/f800/1700000001.jpeg';
const photo = (n) => `https://images1.vinted.net/t/01_banc${n}/f800/170000000${n}.jpeg`;
const ann = (id, title, heures, extra = {}) => ({ id, title, price: { amount: '49.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, photo: null, brand_title: 'Nike', size_title: '42', size: '42', status: 'Très bon état', view_count: 30, favourite_count: 13, created_at_ts: Math.floor((Date.now() - heures * 3600e3) / 1000), ...extra });
const ITEMS_111 = [
  ann(9303, 'Nike Dunk Low Panda taille 42', 2, { photo: photo(3) }),
  ann(9202, 'Salomon XT-6 noir taille 41', 40, { brand_title: 'Salomon', size_title: '41', size: '41', photo: photo(2), favourite_count: 48 }),
  ann(9401, 'Adidas Handball Spezial marron gomme taille 43 très bon état', 90, { brand_title: 'Adidas', photo: PHOTO_DOUBLE, price: { amount: '65.0', currency_code: 'EUR' } }),
  ann(9402, 'Nike P-6000 noir taille 44', 150, { photo: photo(4), price: { amount: '59.0', currency_code: 'EUR' } }),
];
const ITEMS_222 = [
  ann(9501, 'Adidas Handball Spezial marron gomme taille 43 très bon état', 30, { brand_title: 'Adidas', photo: PHOTO_DOUBLE }),
  ann(9502, 'New Balance 550 blanc vert taille 40', 60, { brand_title: 'New Balance', photo: photo(5) }),
  ann(9503, 'Asics Gel-1130 argent taille 42', 5, { brand_title: 'Asics', photo: photo(6) }),
];
const TOUS = [...ITEMS_111, ...ITEMS_222];
const MAIN = () => ({
  vinted_annonce_numeros: {
    '9202': { numero: '5', auto: false, manuelAt: ilYa(30), numberedAt: ilYa(40), buyPrice: '25' },
    '9401': { numero: '12', auto: true, numberedAt: ilYa(90) },
    '9402': { numero: '13', auto: true, numberedAt: ilYa(150) },
    '9502': { numero: '20', auto: true, numberedAt: ilYa(60) },
    // L'ancienne annonce, SUPPRIMÉE par lui il y a 20 h (rangée sous N°7) : 9303 lui ressemble.
    '9100': { numero: '7', title: 'Nike Dunk Low Panda taille 42', size: '42', accountId: '111', buyPrice: 35, auto: true, numberedAt: ilYa(400) },
  },
  vinted_used_numeros: [1, 2, 3, 4, 5, 6, 7, 12, 13, 20],
});
const ACCS = [
  { id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() },
  { id: 2, vinted_user_id: '222', login: 'second_banc', domain: 'www.vinted.fr', updated_at: auj.toISOString() },
];
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`  ${c ? '✅' : '❌'} ${m}${!c && d ? ' — ' + d : ''}`); };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!p.startsWith(DIST) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log(`  ❌ le port ${PORT} est pris (${e.code}) — BANC_PORT=…`); process.exit(1); });
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop().replace(/"/g, '');
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg.replace(/"/g, '')];
    out[alias] = v == null ? null : (src.includes('->>') && typeof v === 'object' ? JSON.stringify(v) : v);
  }
  return out;
};

async function ouvrir(b, { largeur, sombre }) {
  const base = { main: MAIN(), maj: new Date(Date.now() - 86400e3).toISOString(), ecritures: [] };
  const rows = [
    { id: 'harvest_111_listings', data: { capturedAt: auj.toISOString(), payload: { items: ITEMS_111 } } },
    { id: 'harvest_222_listings', data: { capturedAt: auj.toISOString(), payload: { items: ITEMS_222 } } },
    { id: 'vinted_item_details', data: {} },
    { id: 'harvest_111_supprimees', data: { ids: { 9100: ilYa(20) } } },
  ];
  const mobile = largeur < 700;
  const ctx = await b.newContext({ viewport: { width: largeur, height: mobile ? 844 : 950 }, isMobile: mobile, hasTouch: mobile });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const onglets = []; ctx.on('page', (p) => onglets.push(p));
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); } catch (_) {} }, !!sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  // Les photos inventées : une image locale (la visionneuse ne s'ouvre que sur une image chargée).
  await pg.route(/images1\.vinted\.net/, (r) => r.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: PNG }));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d, st = 200) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: typeof d === 'string' ? d : JSON.stringify(d) });
    if (/select=owner&limit=1/.test(u)) return j([{ owner: 'banc' }]);
    const mm = routeMain(req, base); if (mm) return j(mm.body, mm.status);
    if (req.method() !== 'GET') return j([]);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data$|^data,/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: auj.toISOString(), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(5500);
  return { pg, ctx, errs, base, onglets };
}
const local = (pg, k) => pg.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } }, k);
const capture = async (pg, nom) => { try { await pg.screenshot({ path: path.join(CAPTURES, nom + '.png'), fullPage: false }); } catch (_) {} };
const toucher = async (pg, sel, mobile) => { const l = pg.locator(sel).first(); await l.scrollIntoViewIfNeeded({ timeout: 8000 }).catch(() => {}); if (mobile) await l.tap({ timeout: 8000 }); else await l.click({ timeout: 8000 }); };

// Ce que la page montre d'une vignette (les éléments VISIBLES seulement).
const LIRE = () => {
  const vis = (e) => { if (!e) return false; const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  // (sur le code d'avant, la grille sans `data-ann-grille` est lue quand même : chaque contrôle dit SON rouge)
  const grille = document.querySelector('[data-ann-grille="vignettes"]') || document.querySelector('.vrm-ann-grid');
  const cartes = grille ? [...grille.querySelectorAll(':scope > [data-carte-annonce]')] : [];
  const tetes = grille ? [...grille.querySelectorAll(':scope > [data-ann-compte]')] : [];
  // Un texte coupé : une feuille de texte VISIBLE dont le contenu déborde de sa boîte (… ou rogné).
  const coupes = (racine) => [...racine.querySelectorAll('span,b,div,button,a')].filter((e) => vis(e) && e.getBoundingClientRect().width > 2 && !e.closest('[data-titre]') && !e.querySelector('*:not(svg):not(path):not(circle)') && e.textContent.trim().length > 1)
    .filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'visible')
    .map((e) => e.textContent.trim().slice(0, 30));
  // Un libellé passé sur deux lignes (« Accepter / dès ») : plus haut qu'une ligne de sa police.
  // (le nombre de lignes du TEXTE, lu sur ses rectangles — la hauteur d'un bouton de 55 px n'en dit rien)
  const lignes = (e) => { const tops = new Set(); const w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT); let t; while ((t = w.nextNode())) { if (!t.textContent.trim()) continue; const r = document.createRange(); r.selectNodeContents(t); for (const x of r.getClientRects()) if (x.width > 1) tops.add(Math.round(x.top / 4)); } return tops.size; };
  const deuxLignes = (racine, sel) => [...racine.querySelectorAll(sel)].filter(vis).filter((e) => e.textContent.trim() && lignes(e) > 1).map((e) => e.textContent.trim());
  return {
    n: cartes.length, ids: cartes.map((c) => c.getAttribute('data-carte-annonce')),
    tetes: tetes.map((t) => ({ uid: t.getAttribute('data-ann-compte'), n: Number(t.getAttribute('data-ann-compte-n')), txt: t.innerText.replace(/\s+/g, ' ').trim() })),
    ordre: [...grille ? grille.children : []].map((c) => c.getAttribute('data-ann-compte') ? 'T' + c.getAttribute('data-ann-compte') : c.getAttribute('data-carte-annonce')),
    colonnes: grille ? getComputedStyle(grille).gridTemplateColumns.split(' ').filter(Boolean).length : 0,
    largeurGrille: grille ? grille.getBoundingClientRect().width : 0,
    sw: (document.scrollingElement || document.documentElement).scrollWidth, cw: window.innerWidth,
    cartes: cartes.map((c) => {
      const ph = c.querySelector('[data-fiche-photo]'); const pr = ph ? ph.getBoundingClientRect() : { width: 0, height: 0 };
      const t = c.querySelector('[data-titre]'); const ts = t ? getComputedStyle(t) : null;
      const r = c.getBoundingClientRect();
      return {
        id: c.getAttribute('data-carte-annonce'), ouverte: c.getAttribute('data-fiche-ouverte') === '1', h: Math.round(r.height), w: Math.round(r.width), x: Math.round(r.left), y: Math.round(r.top),
        photoCarree: pr.width > 40 && Math.abs(pr.width - pr.height) <= 2,
        num: vis(c.querySelector('[data-fiche-num] .vrm-num, [data-fiche-num] .vrm-fiche-num-vide')),
        prix: vis(c.querySelector('[data-prix]')), titre: vis(t), titreLignes: ts ? ts.webkitLineClamp : '', titreBlanc: ts ? ts.whiteSpace : '',
        caches: ['[data-chiffres]', '[data-fiche-duo]', '[data-fiche-plus]', '[data-marque="vinted"]', '[data-stats-compte]', '.vrm-note-ajout'].filter((s) => vis(c.querySelector(s))),
        visibles: ['[data-edition="achat"]', '[data-edition="min"]', '[data-edition="refuse"]', '[data-edition="boost"]', '[data-marge]', '[data-fiche-gestes]', '[data-fiche-menu-ouvrir]', '[data-annonce-prix-partout], [data-annonce-prix-vinted]'].filter((s) => vis(c.querySelector(s))),
        coupes: coupes(c), libellesDeuxLignes: deuxLignes(c, '.vrm-fiche-cell > span:first-child, .vrm-fiche-etat-haut > span:first-child, .vrm-fiche-geste'),
        double: vis(c.querySelector('[data-vignette-en-double]')), remise: !!c.querySelector('[data-remise-sur-vignette]'), remiseOui: (c.querySelector('[data-remise-oui]') || { getAttribute: () => '' }).getAttribute('data-remise-oui'),
      };
    }),
    remisesHorsGrille: [...document.querySelectorAll('[data-remise-ligne]')].filter((e) => !e.closest('[data-ann-grille]')).map((e) => e.getAttribute('data-remise-ligne')),
    resume: (document.querySelector('[data-remise-resume]') || { getAttribute: () => null }).getAttribute('data-remise-resume'),
  };
};

async function scenario(b, largeur, sombre) {
  const mobile = largeur < 700, tag = `${largeur}${sombre ? ' sombre' : ' clair'}`, nom = `${largeur}-${sombre ? 'sombre' : 'clair'}`;
  console.log(`\n── Annonces en grille (${tag})`);
  const { pg, ctx, errs, onglets } = await ouvrir(b, { largeur, sombre });
  try {
    const vu = await pg.waitForSelector('.vrm-ann-grid [data-carte-annonce]', { timeout: 20000 }).then(() => true).catch(() => false);
    if (!vu) { dit(false, `${tag} : les annonces sont rendues`); await capture(pg, `grille-${nom}-absente`); return; }
    dit(await pg.locator('[data-ann-grille="vignettes"]').count() === 1, `${tag} G1 : la vue « Toutes » est une grille de vignettes`);
    await pg.waitForTimeout(800);
    let L = await pg.evaluate(LIRE);
    // G1 — un en-tête par compte
    dit(L.tetes.length === 2 && L.tetes.some((t) => /^C compte_test 4 annonces$/.test(t.txt)) && L.tetes.some((t) => /^S second_banc 3 annonces$/.test(t.txt)), `${tag} G1 : un en-tête par compte (initiale, nom, nombre)`, JSON.stringify(L.tetes));
    // G2 — chaque annonce une fois ; chaque compte d'un bloc, ses annonces de la plus ancienne à la plus récente (l'ordre de l'écran)
    const attendus = TOUS.map((x) => String(x.id)).sort();
    dit(L.n === TOUS.length && [...L.ids].sort().join() === attendus.join(), `${tag} G2 : chaque annonce une fois (n en entrée = n en sortie)`, L.ids.join(','));
    const blocs = []; for (const k of L.ordre) { if (String(k).startsWith('T')) blocs.push({ uid: k.slice(1), ids: [] }); else if (blocs.length) blocs[blocs.length - 1].ids.push(k); }
    const age = (id) => TOUS.find((x) => String(x.id) === id).created_at_ts;
    const bienRanges = blocs.length === 2 && blocs.every((bl) => bl.ids.every((id) => (bl.uid === '111' ? ITEMS_111 : ITEMS_222).some((x) => String(x.id) === id)) && bl.ids.every((id, i) => i === 0 || age(bl.ids[i - 1]) <= age(id)));
    dit(bienRanges, `${tag} G2 : chaque compte en un bloc, ses annonces dans l'ordre « les plus anciennes »`, JSON.stringify(blocs));
    // G3 — colonnes
    dit(mobile ? L.colonnes === 2 : (L.colonnes >= 4 && L.colonnes <= 6), `${tag} G3 : ${mobile ? '2 colonnes' : '4 à 6 colonnes'}`, String(L.colonnes));
    // G4 — vignette fermée
    const fermees = L.cartes.filter((c) => !c.ouverte);
    dit(fermees.length === L.n && fermees.every((c) => c.photoCarree && c.num && c.prix && c.titre), `${tag} G4 : photo carrée, N° en pastille, titre, prix sur chaque vignette`, JSON.stringify(fermees.filter((c) => !(c.photoCarree && c.num && c.prix && c.titre)).map((c) => c.id)));
    dit(fermees.every((c) => c.caches.length === 0 && c.visibles.length === 0), `${tag} G4 : fermée, rien d'autre (ni achat/mini/refuse/boost/marge/gestes, ni le « V », ni le compte, ni l'icône note seule)`, JSON.stringify(fermees.filter((c) => c.caches.length || c.visibles.length).map((c) => [c.id, c.caches, c.visibles])));
    dit(fermees.every((c) => String(c.titreLignes) === '2' && c.titreBlanc === 'normal'), `${tag} G4 : le titre tient sur deux lignes (jamais une ligne coupée « … »)`, JSON.stringify(fermees.map((c) => [c.titreLignes, c.titreBlanc])));
    // G5 — un seul gabarit (hors la vignette qui porte une proposition « Même paire ? »)
    const hs = fermees.filter((c) => !c.remise).map((c) => c.h);
    dit(hs.length > 3 && Math.max(...hs) - Math.min(...hs) <= 2, `${tag} G5 : un seul gabarit de vignette (même hauteur)`, JSON.stringify(fermees.map((c) => [c.id, c.h])));
    // G6 — rien de coupé dans une vignette fermée
    dit(fermees.every((c) => c.coupes.length === 0), `${tag} G6 : aucun libellé coupé/tronqué dans une vignette fermée`, JSON.stringify(fermees.filter((c) => c.coupes.length).map((c) => [c.id, c.coupes])));
    // G10 — « En double » (même photo exacte, deux comptes)
    const dbl = L.cartes.filter((c) => c.double).map((c) => c.id).sort().join();
    dit(dbl === '9401,9501', `${tag} G10 : « En double » sur les deux annonces de même photo, et elles seules`, dbl);
    // G9 — la proposition SUR sa vignette
    const v9303 = L.cartes.find((c) => c.id === '9303');
    dit(v9303 && v9303.remise && v9303.remiseOui === '7' && !L.remisesHorsGrille.includes('9303') && L.resume === '1', `${tag} G9 : « Même paire que N°7 ? » est sur la vignette de 9303 (une pastille en tête y mène)`, JSON.stringify({ v: v9303 && [v9303.remise, v9303.remiseOui], hors: L.remisesHorsGrille, resume: L.resume }));
    dit(L.sw <= L.cw + 1, `${tag} G11 : aucune page qui défile de côté`, `${L.sw} > ${L.cw}`);
    await pg.locator('.vrm-ann-grid').first().scrollIntoViewIfNeeded().catch(() => {});
    await capture(pg, `grille-${nom}-fermee`);
    // G8 — la photo ouvre la visionneuse
    await toucher(pg, '[data-carte-annonce="9402"] [data-fiche-photo] img', mobile);
    const visio = await pg.waitForSelector('[data-visionneuse="ouverte"]', { timeout: 5000 }).then(() => true).catch(() => false);
    await pg.waitForTimeout(300);
    dit(visio && onglets.length === 0, `${tag} G8 : toucher la photo ouvre la visionneuse (pas un onglet Vinted)`, `visionneuse ${visio} · onglets ${onglets.length}`);
    if (visio) { await capture(pg, `grille-${nom}-visionneuse`); await pg.keyboard.press('Escape'); await pg.waitForTimeout(400); }
    if (await pg.locator('[data-visionneuse="ouverte"]').count()) { await pg.locator('[data-visionneuse-fermer], .vrm-visionneuse button[aria-label="Fermer"]').first().click().catch(() => {}); await pg.waitForTimeout(300); }
    // G7 — toucher la vignette (le titre) l'ouvre en place, sans étirer ses voisines
    const avant = Object.fromEntries((await pg.evaluate(LIRE)).cartes.map((c) => [c.id, c.h]));
    await toucher(pg, '[data-carte-annonce="9402"] [data-titre]', mobile);
    await pg.waitForTimeout(700);
    L = await pg.evaluate(LIRE);
    const o = L.cartes.find((c) => c.id === '9402');
    dit(o && o.ouverte && Math.abs(o.w - L.largeurGrille) <= 2, `${tag} G7 : toucher la vignette l'ouvre sur toute la largeur`, JSON.stringify(o && { ouverte: o.ouverte, w: o.w, grille: L.largeurGrille }));
    const etirees = L.cartes.filter((c) => !c.ouverte && Math.abs(c.h - avant[c.id]) > 2).map((c) => `${c.id}:${avant[c.id]}→${c.h}`);
    dit(etirees.length === 0, `${tag} G7 : carte ouverte ⇒ aucune vignette voisine étirée`, etirees.join(' '));
    dit(o && o.visibles.length === 8, `${tag} G7 : ouverte, tout y est (achat, mini, refuse, boost, marge, gestes, « … », changer le prix)`, JSON.stringify(o && o.visibles));
    dit(o && o.coupes.length === 0 && o.libellesDeuxLignes.length === 0, `${tag} G6 : ouverte, aucun libellé coupé ni passé sur deux lignes (« Accepter dès », « Ranger au stock »)`, JSON.stringify(o && { coupes: o.coupes, deux: o.libellesDeuxLignes }));
    await pg.locator('[data-carte-annonce="9402"]').scrollIntoViewIfNeeded().catch(() => {});
    await capture(pg, `grille-${nom}-ouverte`);
    // L'achat se modifie en place (la même écriture qu'avant).
    await toucher(pg, '[data-carte-annonce="9402"] [data-edition="achat"]', mobile);
    await pg.keyboard.type('30'); await pg.keyboard.press('Enter');
    await attendre(async () => /^30(,00?)?$/.test(String((((await local(pg, 'vinted_annonce_numeros')) || {})['9402'] || {}).buyPrice || '')), 6000);
    await capture(pg, `grille-${nom}-achat-saisi`);
    dit(/^30(,00?)?$/.test(String((((await local(pg, 'vinted_annonce_numeros')) || {})['9402'] || {}).buyPrice || '')) && /30(,00)?\s*€/.test(await pg.evaluate(() => (document.querySelector('[data-carte-annonce="9402"] [data-fiche-achat]') || {}).innerText || '')), `${tag} G7 : le prix d'achat se saisit dans la vignette ouverte`, JSON.stringify((((await local(pg, 'vinted_annonce_numeros')) || {})['9402']) || null) + ' · ' + (await pg.evaluate(() => (document.querySelector('[data-carte-annonce="9402"] [data-fiche-achat]') || {}).innerText || '')));
    // « … » : les autres gestes.
    await toucher(pg, '[data-carte-annonce="9402"] [data-fiche-menu-ouvrir]', mobile);
    const menu = await pg.waitForSelector('[data-fiche-menu="9402"]', { timeout: 5000 }).then(() => true).catch(() => false);
    const gestes = menu ? await pg.evaluate(() => ['[data-fiche-relier-achat]', '[data-fiche-passeport]', '[data-fiche-vendue]', '[data-annonce-histoire]'].filter((s) => document.querySelector(s)).length) : 0;
    dit(menu && gestes === 4, `${tag} G7 : « … » ouvre ses gestes (relier un achat, passeport, histoire, marquer vendue)`, `menu ${menu} · ${gestes}/4`);
    if (menu) { await capture(pg, `grille-${nom}-menu`); await pg.keyboard.press('Escape'); await pg.waitForTimeout(400); }
    // « Moins de détails » la referme.
    await toucher(pg, '[data-carte-annonce="9402"] [data-fiche-plus-bouton]', mobile);
    await pg.waitForTimeout(400);
    dit(await pg.getAttribute('[data-carte-annonce="9402"]', 'data-fiche-ouverte') === '0', `${tag} G7 : « Moins de détails » la referme`);
    // G9 — rien relié avant SON clic ; « Oui » donne N°7.
    // (une annonce sans N° en reçoit un neuf tout seul, §5 — mais jamais le 7 de l'ancienne paire)
    dit(String((((await local(pg, 'vinted_annonce_numeros')) || {})['9303'] || {}).numero || '') !== '7', `${tag} G9 : rien n'est relié avant son clic (9303 ne porte pas le N°7)`);
    await pg.locator('[data-carte-annonce="9303"]').scrollIntoViewIfNeeded().catch(() => {});
    await capture(pg, `grille-${nom}-meme-paire`);
    await toucher(pg, '[data-carte-annonce="9303"] [data-remise-oui="7"]', mobile);
    // `poserNumero` peut demander confirmation (le N° d'une paire passée) : on dit oui comme lui.
    await pg.waitForTimeout(600);
    const conf = pg.locator('[role="dialog"] button:has-text("Oui"), [role="dialog"] button:has-text("Confirmer"), [role="dialog"] button:has-text("C’est la même"), [role="dialog"] button:has-text("Garder")');
    if (await conf.count()) await conf.first().click().catch(() => {});
    await attendre(async () => String((((await local(pg, 'vinted_annonce_numeros')) || {})['9303'] || {}).numero || '') === '7', 8000);
    dit(String((((await local(pg, 'vinted_annonce_numeros')) || {})['9303'] || {}).numero || '') === '7', `${tag} G9 : « Oui » sur la vignette ⇒ 9303 porte N°7`, JSON.stringify((((await local(pg, 'vinted_annonce_numeros')) || {})['9303']) || null));
    dit(errs.length === 0, `${tag} G11 : aucune erreur d'app`, errs.join(' | ').slice(0, 200));
  } catch (e) { dit(false, `${tag} : le scénario a tourné jusqu'au bout`, String(e && e.message).replace(/\x1b\[[0-9;]*m/g, '').slice(0, 300)); await capture(pg, `grille-${nom}-erreur`); }
  finally { await ctx.close(); }
}

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const b = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    for (const [l, s] of [[390, false], [390, true], [1512, false], [1512, true]]) await scenario(b, l, s);
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ok} vert(s), ${ko} rouge(s) — captures : ${CAPTURES}`);
  process.exit(ko ? 1 : 0);
})();
