require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));   // heures calmes : midi (Paris)
require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  ANNONCES → « SANS ACHAT RELIÉ » (15 nov.) — jugée sur l'app RENDUE.
//  Récit : docs/passation/2026-11-15-annonces-achats.md.
//
//  Julien (trois captures iPhone, Annonces · Vinted · la file des prix d'achat) : « Regarde ici aussi
//  c'est moche et il y a des bugs, je veux que tout soit parfait ». Vu : la recherche collée en haut
//  était TRANSPARENTE (les cartes passaient dessous et se mélangeaient avec « Rechercher »), les cartes
//  débordaient (N° et photo coupés au bord gauche, titres sous le bord droit), une carte haute et vide
//  (« Aucune suggestion » seul au milieu), trois gestes empilés. Ce banc mesure la RÈGLE :
//
//    colle     au défilement (3 positions), chaque barre COLLÉE de l'écran (position sticky, posée à son
//              `top`) a un fond qui se lit (alpha ≥ .98 — à .96 la liste se devinait dessous —, ou ≥ .72 avec un flou), une ombre,
//              et le point de son centre (et de ses bords) lui appartient (`elementFromPoint`) : aucun
//              élément de la liste n'est dessiné dessus ; elle ne passe ni sous ni sur la barre de titre.
//              Jugé sur « Sans achat relié », sur « Toutes » et sur Stock ;
//    debord    `scrollWidth <= innerWidth` (document et `.vrm-main`), chaque carte DANS l'écran et chaque
//              élément visible d'une carte DANS sa carte ; un titre tient sur 2 lignes au plus ;
//    hauteur   une carte sans suggestion ≤ 200 px, avec suggestion ≤ 310 px (390 et 1512) — la carte côte à côte du 15 nov.
//              (src/liaisonAchat.js) ; avant le 15 nov. : ≤ 136 et ≤ 188 (la carte d'une ligne) ;
//    gestes    chaque carte porte ses gestes (mêmes `data-*`) : avec suggestion « Relier · X € »
//              (`data-ar-relier`), « Autre achat », « Saisir », « Plus tard » ; sans, « Saisir le prix »,
//              « Choisir un achat », « Plus tard » ; un geste replié derrière « ⋯ » (`data-ar-plus`)
//              s'y montre au toucher ; chaque cible visible fait 44 px au doigt ;
//    tete      la phrase de la règle (« même marque, même taille… ») n'est pas une ligne de plus visible :
//              elle vit derrière un « ? » ; « Saisie en série » reste là (`data-ar-serie`), en lien
//              (pas un gros bouton : ≤ 44 px de haut, sans fond) ;
//    identite  (§5) rien n’est relié avant SON clic : aucune écriture n’emporte un achat proposé ; une marque
//              contredite (« Autry … » marquée « adidas ») ou aucun mot de modèle commun (« Basket Nike 44 ») ⇒ aucune suggestion.
//  Base INVENTÉE (titres génériques, identifiants inventés — dépôt PUBLIC) ; images servies localement.
//  `PASSES=390,1512-sombre` pour un sous-ensemble ; `BANC_DIST=` le build jugé ; `SHOTS=` les captures.
//  Un banc ne meurt pas, il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), http = require('http');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const sc = require('./_scenario-colis.cjs');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || (21000 + Math.floor(Math.random() * 18000));
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-annonces-achats');
fs.mkdirSync(SHOTS, { recursive: true });
const J = 86400e3, U = sc.UID[0], U2 = sc.UID[1];
const iso = (ms) => new Date(ms).toISOString();

// ── La base inventée : des annonces numérotées en ligne SANS achat relié, des titres longs ──
const photoUrl = (k) => `https://images1.vinted.net/t/${k}_d/f800/${k}.jpeg`;
const ANNONCES = [
  // [id, titre, marque, taille, prix, N°, jours en ligne, photo ?]
  ['71001', 'Adidas Handball Spezial chunky Brown taille 42 édition limitée très rare', 'Adidas', '42', 85, '132', 30, true],
  ['71002', 'Nike Air Max 1 Monarch blanc homme pointure 44 état neuf avec sa boîte', 'Nike', '44', 84, '136', 29, true],
  ['71003', 'Adidas Samba blanc/argenté taille 39 femme', 'Adidas', '39', 53, '150', 28, true],
  ['71004', 'Chaussures de basketball Puma MB.01 LaMelo Ball Rick and Morty pointure 45', 'Puma', '45', 70, '151', 27, false],
  ['71005', '3 manuels première maths physique chimie', '', '', 50, 'B188', 26, true],
  ['71006', 'New Balance 550 blanc vert 41', 'New Balance', '41', 95, '160', 25, true],
  ['71007', 'Asics Gel-Lyte III bleu marine 43', 'Asics', '43', 60, '161', 24, true],
  ['71008', 'Converse Chuck 70 high noir 40', 'Converse', '40', 45, '162', 23, true],
  ['71009', 'Vans Old Skool damier 38', 'Vans', '38', 35, '163', 22, true],
  ['71010', 'Reebok Club C 85 vintage 42', 'Reebok', '42', 48, '164', 21, true],
  ['71011', 'Salomon XT-6 noir 44', 'Salomon', '44', 120, '165', 20, true],
  ['71012', 'Nike Dunk Low panda 42', 'Nike', '42', 90, '166', 19, true],
  // (15 nov.) La marque choisie sur Vinted contredite par le titre (capture de Julien) : aucune suggestion.
  ['71013', 'Autry reelwind low rose taille 36', 'adidas', '36', 68, '196', 18, true],
];
const listing = ([id, titre, marque, taille, prix, , jours, ph]) => ({ ...sc.annonce({ id, titre, prix, taille, marque }), brand_title: marque, size_title: taille,
  created_at_ts: Math.floor((sc.NOW - jours * J) / 1000), photo: ph ? { url: photoUrl('a' + id) } : { url: '' } });
// Les achats : trois rapprochables (même marque, même taille, achetés AVANT la mise en ligne), dont un sans photo.
const achat = (tx, titre, prix, jours, ph) => ({ ...sc.ordre({ tx, titre, prix, statut: sc.STATUT_FINAL, dateMs: sc.NOW - jours * J }), ...(ph ? { photo: { url: photoUrl('h' + tx) } } : {}) });
const ACHATS = [
  achat('92000001', 'Adidas Handball Spezial marroni usate 42', 43.67, 60, true),   // (15 nov., liaison) « nere » (noir) contredit « Brown » : la règle pondérée l'écarte
  // (16 nov., relier-fiable) « très probable » (la seule montrée) exige la taille ET la couleur des deux côtés.
  achat('92000002', 'Nike Air Max 1 Monarch blanche 44', 19.05, 70, true),
  // (15 nov.) Deux achats que la règle §5 ÉCARTE (captures de Julien) : aucun mot de modèle commun, marque contredite.
  achat('92000005', 'Basket Nike 44', 15, 75, true),
  achat('92000006', '#Adidas Spezial, dunkelblau, Gr. 36', 21, 80, true),
  achat('92000003', 'New Balance 550 vert 41', 52, 65, false),
  achat('92000004', 'Sac à dos en toile', 12, 50, true),
];
const NUMEROS = Object.fromEntries(ANNONCES.map(([id, titre, , , prix, n]) => [id, { numero: n, title: titre, price: prix }]));
const main = (sombre) => sc.ligneMain({ vinted_dark: sombre, vinted_annonce_numeros: NUMEROS, vinted_used_numeros: ANNONCES.map((a) => a[5]) });
const ROWS = [
  { ...sc.ligneListings(U, ANNONCES.map(listing)), data: { ...sc.ligneListings(U, ANNONCES.map(listing)).data, capturedAt: iso(sc.NOW - 60e3) } },
  { ...sc.ligneListings(U2, []), data: { ...sc.ligneListings(U2, []).data, capturedAt: iso(sc.NOW - 60e3) } },
  sc.lignePurch(U, ACHATS), sc.ligneSold(U, []), sc.lignePurch(U2, []), sc.ligneSold(U2, []),
];
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>[^>]*$/.test(src) && typeof v !== 'string' ? (typeof v === 'object' ? JSON.stringify(v) : String(v)) : v);
  }
  return out;
};
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.mjs': 'text/javascript', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => { let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html'; const p = path.join(DIST, f); if (!p.startsWith(DIST) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p)); });
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
let ko = 0, ok = 0; const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d ? ' — ' + d : '')); };
// Une vignette inventée (couleur tirée de l'adresse) : jamais une image réelle.
const vignette = (graine) => { let h = 0; for (const c of String(graine)) h = (h * 31 + c.charCodeAt(0)) >>> 0; const t = h % 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="hsl(${t},30%,86%)"/><path d="M70 250 C90 200 140 190 170 170 L210 150 C230 175 260 185 300 190 C330 195 345 215 340 245 L340 262 L70 262 Z" fill="hsl(${t},35%,40%)"/></svg>`; };

// ── Les mesures, DANS la page ──────────────────────────────────────────────
// Chaque barre COLLÉE de l'écran, une fois la liste défilée : fond lisible, ombre, au-dessus de la liste.
function colle() {
  const main = document.querySelector('.vrm-main'); if (!main) return { fautes: ['pas de .vrm-main'], vues: 0 };
  const tete = document.querySelector('.vrm-app-header');
  const hb = tete ? tete.getBoundingClientRect() : null;
  const mt = main.getBoundingClientRect().top;
  // L'alpha d'une couleur CALCULÉE : rgb()/rgba(), et color(srgb … / a), oklab(… / a)… (color-mix rend `color(srgb …)`).
  const alpha = (c) => {
    c = String(c || '').trim(); if (!c || c === 'transparent') return 0;
    const m = /rgba?\(([^)]+)\)/.exec(c); if (m) { const p = m[1].split(/[ ,/]+/).filter(Boolean); return p.length >= 4 ? parseFloat(p[3]) : 1; }
    const f = /^[a-z-]+\(([^)]*)\)$/i.exec(c); if (!f) return 0;
    const sl = f[1].split('/'); return sl.length > 1 ? parseFloat(sl[1]) : 1;
  };
  const fautes = []; let vues = 0;
  for (const el of main.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.position !== 'sticky' || cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect(); if (r.width < 40 || r.height < 20) continue;
    const top = parseFloat(cs.top); if (!Number.isFinite(top)) continue;
    // Collée = posée à son `top` alors que la liste a défilé (son parent, lui, est remonté plus haut).
    const parent = el.parentElement && el.parentElement.getBoundingClientRect();
    if (Math.abs(r.top - (mt + top)) > 2.5 || !parent || parent.top > r.top - 4) continue;
    if (r.bottom < 0 || r.top > innerHeight) continue;
    vues++;
    const attr = [...el.attributes].map((x) => x.name).find((n) => /^data-/.test(n));
    const nom = (String(el.className || '').trim() ? '.' + String(el.className).split(/\s+/).filter(Boolean).slice(0, 2).join('.') : el.tagName.toLowerCase() + (attr ? `[${attr}]` : '') + ' dans .' + String((el.parentElement && el.parentElement.className) || '').split(/\s+/)[0]);
    // Le fond : sa couleur (ou un dégradé), lisible ; un flou permet un peu moins. Un voile posé par un
    // pseudo-élément qui couvre la barre compte (sa couleur × son opacité CALCULÉE, animation comprise).
    let a = alpha(cs.backgroundColor), img = cs.backgroundImage && cs.backgroundImage !== 'none', ombre = cs.boxShadow && cs.boxShadow !== 'none';
    for (const ps of ['::before', '::after']) {
      const p = getComputedStyle(el, ps);
      if (!p || p.content === 'none' || p.display === 'none' || p.position !== 'absolute') continue;
      const w = parseFloat(p.width), h = parseFloat(p.height);
      if (!(w >= r.width - 2 && h >= r.height - 2)) continue;
      const op = parseFloat(p.opacity); const o = Number.isFinite(op) ? op : 1;
      a = Math.max(a, alpha(p.backgroundColor) * o);
      if (p.backgroundImage && p.backgroundImage !== 'none' && o > 0.9) img = true;
      if (p.boxShadow && p.boxShadow !== 'none' && o > 0.5) ombre = true;
    }
    const flou = /blur\(/.test(cs.backdropFilter || cs.webkitBackdropFilter || '');
    if (!img && a < (flou ? 0.72 : 0.98)) fautes.push(`${nom} : fond transparent (alpha ${a.toFixed(2)}${flou ? ', flou' : ''})`);
    if (!ombre) fautes.push(`${nom} : aucune ombre de séparation`);
    // Ses points (centre et bords) lui appartiennent : rien de la liste n'est dessiné dessus.
    for (const [x, y] of [[r.left + r.width / 2, r.top + r.height / 2], [r.left + 10, r.top + r.height / 2], [r.right - 10, r.top + r.height / 2], [r.left + r.width / 2, r.bottom - 3]]) {
      if (x < 0 || x > innerWidth || y < 0 || y > innerHeight) continue;
      const e = document.elementFromPoint(x, y);
      if (!e || !(el === e || el.contains(e))) fautes.push(`${nom} : le point (${Math.round(x)}, ${Math.round(y)}) appartient à ${e ? (e.closest('[data-ar-ligne], .vrm-vignette, li') ? 'la liste' : e.tagName + '.' + String(e.className || '').split(' ')[0]) : 'rien'}`);
    }
    // Ni sous ni sur la barre de titre.
    if (hb && hb.height > 4 && r.top < hb.bottom - 1.5) fautes.push(`${nom} : passe sous la barre de titre (${Math.round(r.top)} < ${Math.round(hb.bottom)})`);
  }
  if (tete && hb && hb.height > 4) { const e = document.elementFromPoint(hb.left + hb.width / 2, hb.top + hb.height / 2); if (e && !tete.contains(e) && !e.closest('.vrm-app-header')) fautes.push(`la barre de titre est couverte par ${e.tagName}.${String(e.className || '').split(' ')[0]}`); }
  return { fautes, vues };
}
// La file : débordement, hauteur, gestes, tête.
function file({ tactile }) {
  const out = { debord: [], hauteur: [], gestes: [], tete: [], info: {} };
  const main = document.querySelector('.vrm-main');
  if (document.documentElement.scrollWidth > innerWidth + 1) out.debord.push(`la page glisse de côté (${document.documentElement.scrollWidth} > ${innerWidth})`);
  if (main && main.scrollWidth > main.clientWidth + 1) out.debord.push(`.vrm-main glisse de côté (${main.scrollWidth} > ${main.clientWidth})`);
  const vis = (e) => { if (!e) return false; const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; const cs = getComputedStyle(e); return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05; };
  const lignes = [...document.querySelectorAll('[data-ar-ligne]')];
  out.info.lignes = lignes.length; out.info.sugg = 0;
  for (const li of lignes) {
    const id = li.getAttribute('data-ar-ligne'), rl = li.getBoundingClientRect();
    if (rl.left < -0.5 || rl.right > innerWidth + 0.5) out.debord.push(`carte ${id} hors de l'écran (${Math.round(rl.left)} → ${Math.round(rl.right)})`);
    for (const e of li.querySelectorAll('*')) {
      if (!vis(e) || e.closest('[hidden]')) continue;
      const r = e.getBoundingClientRect();
      if (r.left < rl.left - 1 || r.right > rl.right + 1) { out.debord.push(`carte ${id} : ${e.tagName.toLowerCase()}.${String(e.className || '').split(' ')[0]} sort de la carte (${Math.round(r.left)} → ${Math.round(r.right)} pour ${Math.round(rl.left)} → ${Math.round(rl.right)})`); break; }
    }
    // Le titre de l'annonce : deux lignes au plus.
    const t = li.querySelector('[data-ar-titre]') || li.querySelector('.vrm-ar-titre');
    if (t) { const cs = getComputedStyle(t); const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.25; if (t.getBoundingClientRect().height > 2 * lh + 2) out.debord.push(`carte ${id} : titre sur ${Math.round(t.getBoundingClientRect().height / lh)} lignes`); }
    const sugg = !!li.getAttribute('data-ar-sugg-tx'); if (sugg) out.info.sugg++;
    // (15 nov., liaison) La carte montre désormais l'article ET l'achat côte à côte (photos 64, titres, retrait, prix
    // payé, niveau, pourquoi) : plus haute par construction ; sans achat proposé, une rangée et une ligne.
    const max = sugg ? 310 : 200;
    if (rl.height > max) out.hauteur.push(`carte ${id} ${sugg ? 'avec' : 'sans'} suggestion : ${Math.round(rl.height)} px (> ${max})`);
    // Les gestes : présents ; visibles, ou derrière « ⋯ » de la carte.
    const plus = li.querySelector('[data-ar-plus]');
    const attendus = sugg ? ['[data-ar-relier]', '[data-ar-autre]', '[data-ar-saisir]'] : ['[data-ar-saisir]', '[data-ar-choisir]'];
    if (!li.hasAttribute('data-ar-plus-tard')) attendus.push('[data-ar-plus-tard-geste]');
    for (const s of attendus) {
      const g = li.querySelector(s);
      if (!g) { out.gestes.push(`carte ${id} : ${s} absent`); continue; }
      if (!vis(g) || g.closest('[hidden]')) { if (!plus || !vis(plus)) out.gestes.push(`carte ${id} : ${s} caché sans « ⋯ »`); continue; }
      if (tactile && g.getBoundingClientRect().height < 43.5) out.gestes.push(`carte ${id} : ${s} de ${Math.round(g.getBoundingClientRect().height)} px au doigt`);
    }
    // Le geste principal est visible tout de suite (jamais derrière « ⋯ »).
    const principal = li.querySelector(sugg ? '[data-ar-relier]' : '[data-ar-saisir]');
    if (principal && (!vis(principal) || principal.closest('[hidden]'))) out.gestes.push(`carte ${id} : le geste principal est caché`);
    if (plus && vis(plus) && tactile && plus.getBoundingClientRect().height < 43.5) out.gestes.push(`carte ${id} : « ⋯ » de ${Math.round(plus.getBoundingClientRect().height)} px`);
  }
  // La tête : la phrase de la règle derrière un « ? », « Saisie en série » en lien.
  const sec = document.querySelector('[data-ar]');
  if (sec) {
    const txt = [...sec.querySelectorAll('*')].filter((e) => vis(e) && !e.closest('[data-ar-ligne]') && !e.closest('[hidden]') && !e.closest('.vrm-pourquoi-texte') && [...e.childNodes].some((n) => n.nodeType === 3 && /même marque/.test(n.textContent)));
    if (txt.length) out.tete.push('la phrase « même marque, même taille… » est une ligne visible (elle va derrière un « ? »)');
    const serie = sec.querySelector('[data-ar-serie]');
    if (!serie) out.tete.push('« Saisie en série » absente');
    else if (vis(serie)) {
      const r = serie.getBoundingClientRect(), cs = getComputedStyle(serie);
      const fond = /rgba?\(/.test(cs.backgroundColor) && !/rgba\([^)]*,\s*0\)/.test(cs.backgroundColor) && cs.backgroundColor !== 'transparent';
      if (r.height > 46) out.tete.push(`« Saisie en série » : ${Math.round(r.height)} px de haut`);
      if (fond || (cs.backgroundImage && cs.backgroundImage !== 'none')) out.tete.push('« Saisie en série » est un gros bouton (fond)');
    }
  }
  return out;
}

async function passe(b, nom, ctxOpts, sombre) {
  console.log(`── ${nom}`);
  const ctx = await b.newContext(ctxOpts);
  const pg = await ctx.newPage();
  const errs = [], ecrits = [];
  pg.on('pageerror', (e) => errs.push(String(e.message || e).slice(0, 200)));
  await pg.addInitScript((sb) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(!!sb)); localStorage.setItem('vrm_langue', 'fr'); localStorage.setItem('vrm_bienvenue_vue', JSON.stringify({ at: 'banc' })); localStorage.setItem('vrm_visite_vue', JSON.stringify({ at: 'banc' })); } catch (_) {} }, sombre);
  const externe = (r) => {
    const u = r.request().url();
    if (/vinted\.net/i.test(u) || r.request().resourceType() === 'image') return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: vignette(u) });
    return r.abort();
  };
  await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, externe);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, externe);
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request(), u = decodeURIComponent(metaVersData(req.url()));
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') { ecrits.push(String(req.postData() || '')); return j([], 201); }
    if (/select=owner/.test(u)) return j({ m: 1 }, 400);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(sc.comptes());
    if (/id=eq\.main/.test(u)) return j(main(sombre));
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data' && !/^id,data/.test(sel) && !/^data,/.test(sel)) ? projette(r, sel) : r;
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(ROWS.filter((r) => ids.includes(r.id)).map(forme)); }
    const eq = /id=eq\.([^&]*)/.exec(u); if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const m = /id=like\.([^&]*)/.exec(u); if (m) { const re = new RegExp('^' + m[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true,"devices":1}' }));
  const tactile = !!ctxOpts.hasTouch;
  const defiler = (y) => pg.evaluate(async (y) => { const m = document.querySelector('.vrm-main'); if (m) m.scrollTop = y === 'fin' ? m.scrollHeight : y; await new Promise((r) => setTimeout(r, 450)); }, y);
  const jugerColle = async (ou) => {
    let vues = 0; const f = new Set();
    for (const y of [380, 820, 'fin']) { await defiler(y); const c = await pg.evaluate(colle); vues += c.vues; c.fautes.forEach((x) => f.add(x)); }
    return { vues, fautes: [...f] };
  };

  await pg.goto(`http://localhost:${PORT}/?tab=annonces&site=vinted`, { waitUntil: 'domcontentloaded' });
  const vue = pg.locator('[data-vue-sans-achat]').first();
  await vue.waitFor({ timeout: 30000 }).catch(() => {});
  if (!(await vue.count())) { dit(false, `${nom} · la vue « Sans achat relié » existe`); await ctx.close(); return; }
  // « Toutes » d'abord : la barre collée de la grille.
  await pg.waitForTimeout(1500);
  const cToutes = await jugerColle('toutes');
  if (tactile) dit(cToutes.vues > 0, `${nom} · colle · « Toutes » : la barre reste collée au défilement`, `aucune barre collée vue`);
  dit(!cToutes.fautes.length, `${nom} · colle · « Toutes » : barre collée lisible, ombrée, au-dessus de la liste`, cToutes.fautes.slice(0, 4).join(' ; '));
  await capture(pg, nom, 'toutes-defile');
  await defiler(0);
  await vue.evaluate((e) => e.click());
  await pg.locator('[data-ar-ligne]').first().waitFor({ timeout: 15000 }).catch(() => {});
  await pg.locator('[data-ar-relier]').first().waitFor({ timeout: 15000 }).catch(() => {});
  await pg.waitForTimeout(900);
  await defiler(0);
  const f = await pg.evaluate(file, { tactile });
  await capture(pg, nom, 'sans-achat');
  dit(f.info.lignes >= 10 && f.info.sugg >= 3, `${nom} · la file : ${f.info.lignes} annonces, ${f.info.sugg} suggestions`, JSON.stringify(f.info));
  // §5 (captures de Julien, 15 nov.) : une marque contredite ou aucun mot de modèle commun ⇒ AUCUNE suggestion.
  const sug = await pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-ar-ligne]')].map((x) => [x.getAttribute('data-ar-ligne'), x.getAttribute('data-ar-sugg-tx')])));
  dit(sug['71013'] === '' && sug['71002'] === '92000002' && sug['71001'] === '92000001' && !Object.values(sug).includes('92000005') && !Object.values(sug).includes('92000006'),
    `${nom} · identite · « Autry … » marquée « adidas » : aucune suggestion ; « Basket Nike 44 » (aucun mot de modèle commun) jamais proposée`, JSON.stringify(sug));
  dit(!f.debord.length, `${nom} · debord · rien ne déborde (page, cartes, titres ≤ 2 lignes)`, f.debord.slice(0, 4).join(' ; '));
  dit(!f.hauteur.length, `${nom} · hauteur · cartes compactes`, f.hauteur.slice(0, 4).join(' ; '));
  dit(!f.gestes.length, `${nom} · gestes · chaque geste présent et joignable`, f.gestes.slice(0, 4).join(' ; '));
  dit(!f.tete.length, `${nom} · tete · règle derrière « ? », « Saisie en série » en lien`, f.tete.join(' ; '));
  // « ⋯ » montre les gestes repliés (au doigt : 44 px).
  const plus = pg.locator('[data-ar-ligne] [data-ar-plus]').first();
  if (await plus.count()) {
    const id = await plus.evaluate((e) => e.closest('[data-ar-ligne]').getAttribute('data-ar-ligne'));
    await plus.click({ timeout: 5000 }).catch(() => {});
    await pg.waitForTimeout(300);
    const r = await pg.evaluate(({ id, tactile }) => {
      const li = document.querySelector(`[data-ar-ligne="${id}"]`);
      const sugg = !!li.getAttribute('data-ar-sugg-tx');
      return ['[data-ar-plus-tard-geste]', sugg ? '[data-ar-autre]' : '[data-ar-choisir]', '[data-ar-saisir]'].map((s) => { const g = li.querySelector(s); if (!g) return s + ' absent'; const b = g.getBoundingClientRect(); if (g.closest('[hidden]') || b.height < 1) return s + ' toujours caché'; if (tactile && b.height < 43.5) return `${s} ${Math.round(b.height)} px`; return ''; }).filter(Boolean);
    }, { id, tactile });
    dit(!r.length, `${nom} · gestes · « ⋯ » montre les gestes repliés (${id})`, r.join(' ; '));
    await capture(pg, nom, 'sans-achat-plus');
    await plus.click({ timeout: 5000 }).catch(() => {});
  }
  const cFile = await jugerColle('sansachat');
  if (tactile) dit(cFile.vues > 0, `${nom} · colle · « Sans achat relié » : la barre reste collée au défilement`, 'aucune barre collée vue');
  dit(!cFile.fautes.length, `${nom} · colle · « Sans achat relié » : barre collée lisible, ombrée, au-dessus de la liste`, cFile.fautes.slice(0, 4).join(' ; '));
  await defiler(380); await capture(pg, nom, 'sans-achat-defile');
  const f2 = await pg.evaluate(file, { tactile });
  dit(!f2.debord.length, `${nom} · debord · après défilement, rien ne déborde`, f2.debord.slice(0, 3).join(' ; '));
  // §5 : rien n'est relié tant qu'il n'a pas touché « Relier ».
  dit(!ecrits.some((x) => /buyFromId/.test(x) && /9200000[1-3]/.test(x)), `${nom} · identite · aucune écriture n'emporte un achat proposé sans son clic`);
  // Stock : la même règle pour ses barres collées.
  await pg.goto(`http://localhost:${PORT}/?tab=garage`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.vrm-main', { timeout: 25000 }).catch(() => {});
  await pg.waitForTimeout(2500);
  const cStock = await jugerColle('stock');
  dit(!cStock.fautes.length, `${nom} · colle · Stock : barres collées lisibles et au-dessus (${cStock.vues} vue${cStock.vues > 1 ? 's' : ''})`, cStock.fautes.slice(0, 4).join(' ; '));
  await capture(pg, nom, 'stock-defile');
  dit(!errs.length, `${nom} · aucune erreur de page`, errs.slice(0, 2).join(' | '));
  await ctx.close();
}
const capture = async (pg, nom, quoi) => { await pg.screenshot({ path: path.join(SHOTS, `annonces-achats-${nom}-${quoi}.png`) }).catch(() => {}); };

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.log('KO  pas de build (' + DIST + ') — npm run build'); process.exit(1); }
  await new Promise((r) => srv.listen(PORT, r));
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const seul = String(process.env.PASSES || '').split(',').map((x) => x.trim()).filter(Boolean);
  try {
    const passes = [
      ['390', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: 'fr-FR', timezoneId: 'Europe/Paris' }, false],
      ['390-sombre', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, colorScheme: 'dark', locale: 'fr-FR', timezoneId: 'Europe/Paris' }, true],
      ['1512', { viewport: { width: 1512, height: 950 }, locale: 'fr-FR', timezoneId: 'Europe/Paris' }, false],
      ['1512-sombre', { viewport: { width: 1512, height: 950 }, colorScheme: 'dark', locale: 'fr-FR', timezoneId: 'Europe/Paris' }, true],
    ];
    for (const [n, o, s] of passes) if (!seul.length || seul.includes(n)) { try { await passe(b, n, o, s); } catch (e) { dit(false, `${n} · ÉCHEC`, String(e.message || e).slice(0, 200)); } }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ok} vert(s), ${ko} rouge(s) — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
