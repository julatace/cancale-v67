// ════════════════════════════════════════════════════════════════════════════
//  BANC « STABILITÉ IPHONE » (16 nov., Julien : « l'app bug un peu » sur son iPhone)
//  Récit : docs/passation/2026-11-16-stabilite-iphone.md
//
//  Le parcours de TOUS les écrans principaux, de leurs sous-onglets et de leurs feuilles,
//  sur une base INVENTÉE (1 000 paires, 1 000 conversations, 1 000 e-mails :
//  _base-messages-stock.cjs), au téléphone : appareil « iPhone 15 » (Playwright : viewport,
//  agent iOS, tactile), clair ET sombre. Moteur : Chromium par défaut, WebKit (le moteur de
//  Safari) par `NAVIGATEUR=webkit` (_navigateur.cjs ; la CI l'installe).
//  Sur chaque écran (et chaque sous-onglet touché), JUGÉ SUR LA RÈGLE :
//    S1 aucune erreur JS (pageerror) ni console.error de l'app ;
//    S2 l'écran n'est pas tombé sur le garde-fou (data-garde-ecran / data-garde-morceau) ;
//    S3 CONTRASTE WCAG de chaque texte visible sur son fond RÉEL (recomposé couche par couche
//       jusqu'au dégradé bleu du verre ; le pire des deux bouts) : ≥ 4,5:1 (3:1 gros texte)
//       — la mesure de verre.cjs (V3), sur des écrans qu'il n'ouvrait pas (Ventes · eBay → À
//       traiter, Commandes, Offres, Santé ; Leboncoin ; Vestiaire…) ;
//    S4 rien ne déborde à l'horizontale (page, .vrm-main, élément hors de l'écran) ;
//    S5 aucune barre FIXE ne chevauche une autre barre fixe (rectangles, > 4 px) ;
//    S6 défilé jusqu'en bas, le dernier contenu touchable reste AU-DESSUS de la barre du bas
//       (le point au centre de la dernière cible la désigne, pas la barre) ;
//    S7 une cible amenée au centre de l'écran se touche (elementFromPoint la désigne : rien
//       de posé dessus) ;
//    S8 le défilement n'est pas bloqué (aucune feuille ouverte ⇒ ni `overflow:hidden` ni
//       `position:fixed` laissés sur html/body ; la page défile si elle est plus haute) ;
//    S9 aucune « longue tâche » > SEUIL_TACHE ms (trou entre deux images, mesuré par rAF
//       dans la page — WebKit n'a pas `longtask`) après l'écran prêt et pendant le
//       défilement ; le défilement mesuré AVEC et SANS le verre (backdrop-filter) est
//       rapporté (images/s, pire image).
//  `ECRANS=ventes_ebay_agent,…` `THEMES=clair` `SHOTS=dossier` `DETAIL=8` `BANC_DIST=<dist>`
//  (un autre arbre : l'arbre de départ doit être ROUGE). Un banc ne meurt pas, il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
require('./_porte-banc.cjs');
const P = require('./design-passe.cjs');
const B = require('./_base-messages-stock.cjs');
const V = require('./verre.cjs');
const { lancer, NAVIGATEUR } = require('./_navigateur.cjs');
const PW = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));

const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
// Les écrans : [url, geste éventuel]. Les sous-onglets sont TOUCHÉS dans l'écran (S-onglets).
const ECRANS = {
  journee: ['/?tab=journee'],
  annonces: ['/?tab=annonces'],
  annonces_lbc: ['/?tab=annonces&site=leboncoin'],
  annonces_ebay: ['/?tab=annonces&site=ebay'],
  annonces_vestiaire: ['/?tab=annonces&site=vestiaire'],
  ventes: ['/?tab=ventes'],
  ventes_vinted: ['/?tab=ventes&site=vinted'],
  ventes_lbc: ['/?tab=ventes&site=leboncoin'],
  // Ventes · eBay : le Tableau, puis CHAQUE sous-onglet touché (Commandes, À traiter, Offres, Argent, Santé) ;
  // « À traiter » ouvert directement aussi (la capture de Julien).
  ventes_ebay: ['/?tab=plat_ebay&section=tableau'],
  ventes_ebay_agent: ['/?tab=plat_ebay&section=agent', 'seul'],
  ventes_vestiaire: ['/?tab=ventes&site=vestiaire'],
  achats: ['/?tab=achats'],
  stock: ['/?tab=garage'],
  argent: ['/?tab=compta'],
  messages: ['/?tab=messages'],
  settings: ['/?tab=settings'],
  loupe: ['/?tab=journee', 'loupe'],
  cloche: ['/?tab=journee', 'cloche'],
  fiche: ['/?tab=journee', 'fiche'],
  plus: ['/?tab=journee', 'plus'],
  menu: ['/?tab=journee', 'menu'],
};
const VOULUS = liste('ECRANS', Object.keys(ECRANS).join(','));
const THEMES = liste('THEMES', 'clair,sombre');
const DETAIL = Number(process.env.DETAIL || 6);
const SEUIL_TACHE = Number(process.env.SEUIL_TACHE || 200);
const ONGLETS_MAX = Number(process.env.ONGLETS_MAX || 8);
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-stabilite-iphone');
fs.mkdirSync(SHOTS, { recursive: true });
const IPHONE = PW.devices['iPhone 15'];
// La base : celle du volume, + un compte eBay présent (ses lignes de commandes et d'annonces existent, vides) — sans
// elles, Ventes · eBay ne montre que « Aucun compte eBay relié » et ses sections (À traiter, Offres…) ne sont jamais
// rendues. Les routes eBay du banc répondent `{}` : chaque section dit son « pas pu lire » (la capture de Julien).
const base = () => {
  const b = B.baseVolume();
  const at = new Date().toISOString();
  b.rows.push({ id: 'ebay_orders', data: { orders: [], capturedAt: at } }, { id: 'ebay_listings', data: { items: [], capturedAt: at } });
  return b;
};

// ── Dans la page : le témoin d'images (trous entre deux rAF) ──
const TEMOIN = () => {
  if (window.__vrmImages) return;
  const t = { gaps: [], dernier: performance.now(), n: 0, taches: [] };
  window.__vrmImages = t;
  // les longues tâches du fil principal (Chromium) ; WebKit n'a pas l'API : les trous entre images seuls.
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) t.taches.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: true }); t.api = true; } catch (_) { t.api = false; }
  const f = (now) => { const g = now - t.dernier; t.dernier = now; t.n++; t.gaps.push(g); if (t.gaps.length > 4000) t.gaps.shift(); requestAnimationFrame(f); };
  requestAnimationFrame(f);
};

// ── Dans la page : S2, S5, S6, S7, S8 ──
function stabilite() {
  const out = { garde: null, fixes: [], chevauche: [], sousBarre: [], couvertes: [], bloque: null };
  const g = document.querySelector('[data-garde-ecran], [data-garde-morceau]');
  if (g) out.garde = (g.getAttribute('data-garde-ecran') || g.getAttribute('data-garde-morceau') || '?') + ' · ' + ((document.querySelector('[data-garde-erreur]') || {}).textContent || '').slice(0, 140);
  else if (!document.querySelector('.vrm-app-shell')) out.garde = 'aucune coque (' + (document.body.innerText || '').slice(0, 120).replace(/\s+/g, ' ') + ')';
  const vis = (el) => { const c = getComputedStyle(el); if (c.display === 'none' || c.visibility === 'hidden' || parseFloat(c.opacity) < 0.05) return false; const r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; };
  const nom = (el) => { const c = String(el.className && el.className.baseVal != null ? el.className.baseVal : el.className || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.'); return el.tagName.toLowerCase() + (c ? '.' + c : '') + (el.id ? '#' + el.id : ''); };
  // S5 — les barres fixes (et collées en place) : aucune ne chevauche une autre.
  const fixes = [];
  for (const el of document.querySelectorAll('body *')) {
    const c = getComputedStyle(el);
    if (c.position !== 'fixed') continue;
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    // un voile plein écran (feuille, menu) n'est pas une barre : il recouvre exprès
    if (r.width >= innerWidth - 2 && r.height >= innerHeight - 2) continue;
    if (fixes.some((f) => f.el.contains(el))) continue;
    if (c.pointerEvents === 'none') continue;
    fixes.push({ el, r, nom: nom(el), z: c.zIndex });
  }
  out.fixes = fixes.map((f) => `${f.nom} [${Math.round(f.r.top)}→${Math.round(f.r.bottom)}] z${f.z}`);
  for (let i = 0; i < fixes.length; i++) for (let j = i + 1; j < fixes.length; j++) {
    const a = fixes[i], b = fixes[j];
    if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
    const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (w > 4 && h > 4) out.chevauche.push(`${a.nom} × ${b.nom} (${Math.round(w)}×${Math.round(h)} px)`);
  }
  // S8 — le défilement : le conteneur qui défile l'écran (la page, ou la coque qui défile à sa place) doit
  // pouvoir bouger quand son contenu est plus haut que lui.
  const feuille = document.querySelector('.vrm-fs, [role="dialog"][aria-modal="true"], .vrm-garde-feuille');
  const sc = window.__vrmDefileur();
  if (!feuille && sc && sc.scrollHeight > sc.clientHeight + 40) {
    // vers le bas, et vers le haut (déjà tout en bas après une mesure, il ne peut que remonter)
    const avant = sc.scrollTop; sc.scrollTop = avant + 120; let bouge = sc.scrollTop !== avant; if (!bouge) { sc.scrollTop = avant - 120; bouge = sc.scrollTop !== avant; } sc.scrollTop = avant;
    if (!bouge) out.bloque = `${nom(sc)} ne défile pas (haut ${sc.scrollHeight}, vu ${sc.clientHeight}, overflow-y ${getComputedStyle(sc).overflowY})`;
  }
  return out;
}

// Le conteneur qui défile l'écran : la page, sinon le plus grand élément à `overflow-y: auto|scroll` plus haut que lui.
const DEFILEUR = () => {
  window.__vrmDefileur = () => {
    const se = document.scrollingElement;
    if (se.scrollHeight > se.clientHeight + 4 && !/hidden|clip/.test(getComputedStyle(document.documentElement).overflowY + getComputedStyle(document.body).overflowY)) return se;
    let best = null, aire = 0;
    for (const el of document.querySelectorAll('.vrm-app-shell, .vrm-app-shell *')) {
      if (el.closest('.vrm-fs, [role="dialog"]')) continue;
      const c = getComputedStyle(el); if (!/auto|scroll/.test(c.overflowY)) continue;
      const r = el.getBoundingClientRect(); const a = r.width * Math.min(r.height, innerHeight);
      if (r.width >= innerWidth * 0.8 && r.height >= innerHeight * 0.5 && a > aire) { best = el; aire = a; }
    }
    return best || se;
  };
};

// S6 : défilé tout en bas, la dernière cible de .vrm-main n'est pas sous la barre du bas.
function sousLaBarre() {
  const se = window.__vrmDefileur();
  se.scrollTop = se.scrollHeight;
  for (const m of document.querySelectorAll('.vrm-main, .vrm-main *')) { const c = getComputedStyle(m); if (/auto|scroll/.test(c.overflowY) && m.scrollHeight > m.clientHeight + 4) m.scrollTop = m.scrollHeight; }
  return new Promise((ok) => setTimeout(() => {
    const barre = document.querySelector('.vrm-tabbar, nav[class*="tabbar"], .vrm-bottom-nav');
    const out = { barre: !!barre, cibles: 0, sous: [] };
    if (!barre) return ok(out);
    const rb = barre.getBoundingClientRect();
    const cibles = [...document.querySelectorAll('.vrm-main :is(button, a[href], [role="button"], input, select, summary)')].filter((el) => {
      if (el.closest('.vrm-fs, [role="dialog"], [aria-hidden="true"]')) return false;
      const c = getComputedStyle(el); if (c.visibility === 'hidden' || c.display === 'none') return false;
      const r = el.getBoundingClientRect(); return r.width > 4 && r.height > 4 && r.top < innerHeight && r.bottom > 0;
    });
    out.cibles = cibles.length;
    const rogne = (el) => { const r = el.getBoundingClientRect(); for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const c = getComputedStyle(a); if (/hidden|clip|auto|scroll/.test(c.overflowX + c.overflowY) && a !== se) { const ra = a.getBoundingClientRect(); if (r.top >= ra.bottom - 1 || r.bottom <= ra.top + 1) return true; } } return false; };
    // les plus basses du document
    const basses = cibles.filter((x) => !rogne(x)).sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom).slice(0, 3);
    for (const el of basses) {
      const r = el.getBoundingClientRect();
      const cx = Math.min(innerWidth - 2, Math.max(2, (r.left + r.right) / 2)), cy = Math.min(innerHeight - 1, (r.top + r.bottom) / 2);
      const h = document.elementFromPoint(cx, cy);
      if (h && (h === el || el.contains(h) || h.contains(el))) continue;
      if (r.top >= rb.top - 1 || (h && barre.contains(h))) out.sous.push(`« ${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 26)} » [${Math.round(r.top)}→${Math.round(r.bottom)}] sous la barre [${Math.round(rb.top)}]`);
    }
    ok(out);
  }, 500));
}

// S7 : chaque cible amenée au centre se touche.
async function ciblesCouvertes(pg) {
  const n = await pg.evaluate(() => { const l = [...document.querySelectorAll('.vrm-main :is(button, a[href], [role="button"], [role="tab"], summary)')].filter((el) => !el.closest('[aria-hidden="true"], .vrm-fs, [role="dialog"]') && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden'); window.__vrmCibles = l.filter((_, i) => i % Math.max(1, Math.ceil(l.length / 40)) === 0).slice(0, 40); return window.__vrmCibles.length; });
  const couvertes = [];
  for (let i = 0; i < n; i++) {
    const r = await pg.evaluate((i) => {
      const el = window.__vrmCibles[i]; if (!el || !el.isConnected) return null;
      const r0 = el.getBoundingClientRect(); if (r0.width < 4 || r0.height < 4) return null;
      // une cible dans une rangée défilante à l'horizontale (cachée exprès hors du cadre) : jugée sur sa partie visible
      el.scrollIntoView({ block: 'center', inline: 'nearest' });
      const r = el.getBoundingClientRect();
      const cx = Math.min(innerWidth - 2, Math.max(2, r.left + Math.min(r.width / 2, 20))), cy = (r.top + r.bottom) / 2;
      if (cy < 0 || cy > innerHeight) return null;
      // rognée par un parent (overflow) : pas « couverte »
      for (let a = el.parentElement; a; a = a.parentElement) { const c = getComputedStyle(a); if (/hidden|clip|auto|scroll/.test(c.overflow + c.overflowX + c.overflowY)) { const ra = a.getBoundingClientRect(); if (cx < ra.left || cx > ra.right || cy < ra.top || cy > ra.bottom) return null; } }
      const h = document.elementFromPoint(cx, cy);
      if (!h || h === el || el.contains(h) || h.contains(el)) return null;
      const nom = (x) => { const c = String(x.className && x.className.baseVal != null ? x.className.baseVal : x.className || '').trim().split(/\s+/).slice(0, 2).join('.'); return x.tagName.toLowerCase() + (c ? '.' + c : ''); };
      let fixe = null; for (let a = h; a; a = a.parentElement) { const p = getComputedStyle(a).position; if (p === 'fixed' || p === 'sticky') { fixe = nom(a); break; } }
      return `« ${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24)} » sous ${nom(h)}${fixe ? ' (dans ' + fixe + ')' : ''}`;
    }, i);
    if (r) couvertes.push(r);
  }
  await pg.evaluate(() => { window.__vrmDefileur().scrollTop = 0; });
  return couvertes;
}

// S9 : défilement mesuré (images par seconde, pire image), avec ou sans le verre.
async function defiler(pg, sansVerre) {
  return pg.evaluate(async (sansVerre) => {
    let st = null;
    if (sansVerre) { st = document.createElement('style'); st.textContent = '*,*::before,*::after{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}'; document.head.appendChild(st); }
    const se = window.__vrmDefileur(); se.scrollTop = 0;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const max = se.scrollHeight - se.clientHeight;
    const gaps = []; let t0 = performance.now(), last = t0, y = 0, dir = 1;
    await new Promise((ok) => {
      const pas = (now) => { gaps.push(now - last); last = now; y += 24 * dir; if (y >= max) { y = max; dir = -1; } if (y <= 0) { y = 0; dir = 1; } se.scrollTop = y; if (now - t0 < 2000) requestAnimationFrame(pas); else ok(); };
      requestAnimationFrame(pas);
    });
    if (st) st.remove();
    se.scrollTop = 0;
    const dur = last - t0;
    const T = window.__vrmImages || { taches: [], api: false };
    const taches = T.taches.filter(([s]) => s >= t0 && s <= last).map(([, d]) => d);
    return { api: T.api, tache: Math.max(0, ...taches), fps: Math.round(gaps.length / (dur / 1000)), pire: Math.round(Math.max(0, ...gaps.slice(1))), haut: max, flous: [...document.querySelectorAll('body *')].filter((e) => { const c = getComputedStyle(e); const f = c.backdropFilter || c.webkitBackdropFilter; return f && f !== 'none'; }).length };
  }, sansVerre);
}

// S10 : le contraste mesuré sur les PIXELS de la capture (ce que l'œil voit — un pseudo-élément, un flou, une
// superposition que la recomposition des styles ne voit pas). Les textes jugés : les libellés de la barre du bas, le
// titre de l'écran, les titres et les phrases de premier niveau de l'écran (h1–h4, légendes) visibles. Par texte : la
// boîte de son nœud texte (Range) ; le fond = la couleur la plus fréquente de la boîte, le texte = le pixel le plus
// éloigné du fond (en luminance) ; ratio WCAG. Seuil 4,5:1 (3:1 gros texte ≥ 24 px ou ≥ 18,66 px en 700).
const TEXTES_PIXELS = () => {
  const out = [];
  // la barre et la tête d'abord ; puis tout texte direct de l'écran (un sur deux au-delà de 60)
  const tete = [...document.querySelectorAll('.vrm-tabbar .vrm-nav-label, .vrm-app-header .vrm-hdr-titre')];
  const corps = [...document.querySelectorAll('.vrm-main *')].filter((el) => { for (const n of el.childNodes) if (n.nodeType === 3 && /[\p{L}\p{N}]/u.test(n.nodeValue)) return true; return false; });
  const pas = Math.max(1, Math.ceil(corps.length / 120));
  for (const el of tete.concat(corps.filter((_, i) => i % pas === 0))) {
    if (el.closest('.vrm-fs, [role="dialog"], [aria-hidden="true"], svg, input, select, textarea, :disabled')) continue;
    const c = getComputedStyle(el); if (c.visibility === 'hidden' || parseFloat(c.opacity) < 0.3) continue;
    let tn = null; for (const n of el.childNodes) if (n.nodeType === 3 && /[\p{L}\p{N}]/u.test(n.nodeValue)) { tn = n; break; }
    if (!tn) continue;
    const g = document.createRange(); g.selectNodeContents(tn); const r = g.getClientRects()[0];
    if (!r || r.width < 8 || r.height < 6 || r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth) continue;
    // le texte doit être VU (rien de posé dessus)
    const h = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2); if (!h || !(h === el || el.contains(h))) continue;
    const px = parseFloat(c.fontSize), w = parseInt(c.fontWeight, 10) || 400;
    out.push({ x: r.left, y: r.top, w: r.width, h: r.height, t: tn.nodeValue.trim().slice(0, 30), gros: px >= 24 || (px >= 18.66 && w >= 700), barre: !!el.closest('.vrm-tabbar') });
    if (out.length >= 60) break;
  }
  return out;
};
async function contrastePixels(o) {
  const textes = await o.pg.evaluate(TEXTES_PIXELS);
  if (!textes.length) return [];
  const png = (await o.pg.screenshot()).toString('base64');
  const dsf = await o.pg.evaluate(() => devicePixelRatio);
  // une page vierge (sans la politique de contenu de l'app) décode la capture ; fermée aussitôt, l'app revient devant
  // (une page passée derrière voit ses images ralenties à 1 par seconde : la mesure du défilement serait fausse).
  const p = await o.ctx.newPage();
  try { return await decoder(p, { png, textes, dsf }); } finally { await p.close().catch(() => {}); await o.pg.bringToFront().catch(() => {}); }
}
function decoder(p, arg) {
  return p.evaluate(async ({ png, textes, dsf }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + png; await img.decode();
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0);
    const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const L = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const out = [];
    for (const t of textes) {
      const x = Math.round(t.x * dsf), y = Math.round(t.y * dsf), w = Math.max(1, Math.round(t.w * dsf)), h = Math.max(1, Math.round(t.h * dsf));
      const d = cx.getImageData(x, y, w, h).data;
      const freq = new Map(); let best = null, bn = 0;
      for (let i = 0; i < d.length; i += 4) { const k = (d[i] >> 3) + ',' + (d[i + 1] >> 3) + ',' + (d[i + 2] >> 3); const n = (freq.get(k) || 0) + 1; freq.set(k, n); if (n > bn) { bn = n; best = [d[i], d[i + 1], d[i + 2]]; } }
      const lb = L(...best); let lt = lb, tc = best;
      for (let i = 0; i < d.length; i += 4) { const l = L(d[i], d[i + 1], d[i + 2]); if (Math.abs(l - lb) > Math.abs(lt - lb)) { lt = l; tc = [d[i], d[i + 1], d[i + 2]]; } }
      const k = (Math.max(lb, lt) + 0.05) / (Math.min(lb, lt) + 0.05);
      out.push({ t: t.t, k: +k.toFixed(2), seuil: t.gros ? 3 : 4.5, fond: best.join(','), texte: tc.join(','), barre: t.barre });
    }
    return out;
  }, arg);
}

const bilan = { ok: 0, ko: 0 };
const ko = [];
const dit = (ok, quoi, detail = '') => { if (ok) bilan.ok++; else { bilan.ko++; ko.push(quoi); } console.log(`${ok ? '✅' : '❌'} ${quoi}${detail ? ' — ' + detail : ''}`); };
const mesures = [];

async function geste(o, g) {
  const pg = o.pg;
  if (g === 'loupe') {
    await pg.locator('button[data-recherche-loupe]').first().tap().catch(() => {});
    await pg.waitForSelector('[data-recherche-champ]', { timeout: 8000 }).catch(() => {});
    await pg.evaluate(() => { const el = document.querySelector('[data-recherche-champ]'); if (!el) return; const poser = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; poser.call(el, '5'); el.dispatchEvent(new Event('input', { bubbles: true })); });
    await pg.waitForTimeout(1500);
  } else if (g === 'fiche') {
    await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:fiche-paire', { detail: '1205' })));
    await pg.waitForSelector('[data-fiche-paire]', { timeout: 8000 }).catch(() => {});
    await pg.waitForTimeout(1500);
  } else if (g === 'cloche') {
    await pg.evaluate(() => window.dispatchEvent(new Event('vrm:centre-notifs')));
    await pg.waitForTimeout(1500);
  } else if (g === 'plus') {
    const b = pg.locator('[data-sb-disque]').first();
    if (await b.count()) await b.tap().catch(() => {});
    await pg.waitForTimeout(1200);
  } else if (g === 'menu') {
    const b = pg.locator('[data-menu-ecrans], button[aria-label*="Tous les écrans"], button[aria-label*="Menu"]').first();
    if (await b.count()) await b.tap().catch(() => {});
    await pg.waitForTimeout(1200);
  }
}

// Les sous-onglets visibles d'un écran (rangées segmentées, onglets) : leurs libellés, dans l'ordre.
const ongletsVus = (pg) => pg.evaluate((max) => {
  const l = [...document.querySelectorAll('.vrm-main :is([role="tab"], .sb-segment button, .vrm-seg button, [data-sous-section] button, .vrm-sous-onglets button)')]
    .filter((el) => el.getClientRects().length && !el.closest('.vrm-fs, [role="dialog"]') && getComputedStyle(el).visibility !== 'hidden' && el.getAttribute('aria-selected') !== 'true' && !el.classList.contains('on') && el.getAttribute('aria-pressed') !== 'true');
  const vus = new Set(); const out = [];
  for (const el of l) { const t = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30); if (!t || vus.has(t)) continue; vus.add(t); out.push(t); }
  return out.slice(0, max);
}, ONGLETS_MAX);

async function juger(o, suf, { perf }) {
  const pg = o.pg;
  // S9 (1) — une fenêtre CALME de 2,5 s avant toute mesure du banc (les mesures elles-mêmes bloquent la page) : l'app
  // seule, écran prêt. Longues tâches du fil principal (Chromium) ; sous WebKit, le pire trou entre deux images.
  let calme = null;
  if (perf) {
    calme = await pg.evaluate(async () => {
      const t = window.__vrmImages; if (!t) return null;
      const t0 = performance.now(); t.gaps.length = 0;
      await new Promise((r) => setTimeout(r, 2500));
      const taches = t.taches.filter(([s]) => s >= t0).map(([, d]) => d);
      return { api: t.api, tache: Math.max(0, ...taches), nTaches: taches.length, trou: Math.round(Math.max(0, ...t.gaps)) };
    });
  }
  await pg.screenshot({ path: path.join(SHOTS, suf.replace(/[^\w.-]+/g, '_') + '.png') }).catch(() => {});
  const err = o.erreurs.concat(o.consoles);
  dit(err.length === 0, `S1 ${suf} : aucune erreur JS ni console.error`, err.slice(0, 3).join(' ¦ '));
  const s = await pg.evaluate(stabilite);
  dit(!s.garde, `S2 ${suf} : l'écran n'est pas tombé sur le garde-fou`, s.garde || '');
  const m = await pg.evaluate(V.mesurer);
  dit(m.contraste.length === 0, `S3 ${suf} : contraste ≥ 4,5:1 sur le fond réel (${m.textes} textes)`,
    m.contraste.length ? `${m.contraste.length} sous le seuil : ` + m.contraste.slice(0, DETAIL).map((x) => `${x.k}<${x.seuil} « ${x.t} » ${x.el} (${x.c} sur ${x.f})`).join(' | ') : '');
  const px = await contrastePixels(o).catch((e) => [{ t: 'mesure impossible : ' + String(e.message || e).slice(0, 80), k: 0, seuil: 4.5 }]);
  const pxKo = px.filter((x) => x.k < x.seuil - 0.005);
  dit(pxKo.length === 0, `S10 ${suf} : contraste lu sur les pixels de la capture (${px.length} textes, barre du bas comprise)`, pxKo.slice(0, DETAIL).map((x) => `${x.k}<${x.seuil} « ${x.t} » (${x.texte} sur ${x.fond})`).join(' | '));
  dit(m.deborde.page <= 1 && m.deborde.main <= 1 && m.deborde.hors === 0, `S4 ${suf} : rien ne déborde à l'horizontale`, `page +${m.deborde.page} · main +${m.deborde.main} · ${m.deborde.hors} hors écran${m.deborde.hors ? ' : ' + m.deborde.horsNoms.join(' | ') : ''}`);
  dit(s.chevauche.length === 0, `S5 ${suf} : aucune barre fixe sur une autre`, s.chevauche.slice(0, DETAIL).join(' | ') + (s.chevauche.length ? ` (fixes : ${s.fixes.join(' ; ')})` : ''));
  dit(!s.bloque, `S8 ${suf} : le défilement n'est pas bloqué`, s.bloque || '');
  const couv = await ciblesCouvertes(pg);
  dit(couv.length === 0, `S7 ${suf} : chaque cible amenée au centre se touche`, couv.slice(0, DETAIL).join(' | '));
  const sb = await pg.evaluate(sousLaBarre);
  dit(sb.sous.length === 0, `S6 ${suf} : tout en bas, rien sous la barre du bas`, sb.sous.join(' | '));
  if (perf) {
    const avec = await defiler(pg, false), sans = await defiler(pg, true);
    mesures.push({ suf, avec, sans, calme });
    console.log(`   défilement ${suf} : avec le verre ${avec.fps} im/s (pire image ${avec.pire} ms, ${avec.flous} flous, tâche ${avec.tache} ms) · sans ${sans.fps} im/s (pire ${sans.pire} ms, tâche ${sans.tache} ms) · haut ${avec.haut} px`);
    // Jugé sur le fil principal quand le moteur le dit (longtask) ; sous WebKit, sur le trou entre images de la fenêtre calme.
    const pireCalme = calme ? (calme.api ? calme.tache : calme.trou) : 0, pireDef = avec.api ? avec.tache : avec.pire;
    dit(pireCalme <= SEUIL_TACHE && pireDef <= SEUIL_TACHE, `S9 ${suf} : aucune longue tâche > ${SEUIL_TACHE} ms (écran prêt au calme, défilement)`,
      `${calme && calme.api ? 'fil principal' : 'trou entre images'} : au calme ${pireCalme} ms${calme ? ` (${calme.nTaches} tâche(s) > 50 ms)` : ''} · au défilement ${pireDef} ms`);
  }
}

if (require.main === module) (async () => {
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await lancer(PW, { executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  // L'appareil « iPhone 15 » : viewport, agent iOS, tactile (le reste de `ouvrir` est celui des bancs de design).
  const nc = nav.newContext.bind(nav);
  nav.newContext = (o = {}) => nc(Object.assign({}, o, o.isMobile ? { viewport: IPHONE.viewport, screen: IPHONE.screen, userAgent: IPHONE.userAgent, deviceScaleFactor: 2, isMobile: NAVIGATEUR !== 'firefox', hasTouch: true } : {}));
  console.log(`Moteur : ${NAVIGATEUR} · iPhone 15 ${IPHONE.viewport.width}×${IPHONE.viewport.height} · ${VOULUS.length} écrans × ${THEMES.join('/')}`);
  try {
    for (const th of THEMES) for (const e of VOULUS) {
      const [url, g] = ECRANS[e] || [];
      if (!url) { dit(false, `${e} : écran inconnu`); continue; }
      const suf = `${e}-${th}`;
      let o;
      try {
        const t0 = Date.now();
        o = await P.ouvrir(nav, { W: 390, sombre: th === 'sombre', b: base(), url, api: B.apiVolume });
        o.consoles = [];
        o.pg.on('console', (msg) => { if (msg.type() !== 'error') return; const t = msg.text(); if (/Failed to load resource|net::ERR|due to access control checks|Fetch API cannot load|ERR_ABORTED|status of 4\d\d|status of 5\d\d/i.test(t)) return; o.consoles.push(t.slice(0, 200)); });
        await o.pg.addInitScript(TEMOIN); await o.pg.evaluate(TEMOIN).catch(() => {});
        await o.pg.addInitScript(DEFILEUR); await o.pg.evaluate(DEFILEUR).catch(() => {});
        await P.pret(o.pg);
        if (g) await geste(o, g);
        await o.pg.waitForTimeout(500);
        console.log(`   ${suf} prêt en ${Date.now() - t0} ms`);
        await juger(o, suf, { perf: !g && th === THEMES[0] });
        if (!g) {
          const onglets = await ongletsVus(o.pg);
          for (const lib of onglets) {
            const b = o.pg.locator('.vrm-main :is([role="tab"], .sb-segment button, .vrm-seg button, [data-sous-section] button, .vrm-sous-onglets button)', { hasText: lib }).first();
            if (!(await b.count())) continue;
            o.erreurs.length = 0; o.consoles.length = 0;
            await b.tap({ timeout: 4000 }).catch(() => b.click({ force: true }).catch(() => {}));
            await o.pg.waitForTimeout(1300);
            await juger(o, `${suf} › ${lib}`, { perf: false });
          }
        }
      } catch (err) { dit(false, `${suf} : ouverture`, String(err.message || err).slice(0, 200)); }
      finally { if (o) await o.ctx.close().catch(() => {}); }
    }
  } finally { await nav.close(); P.srv.close(); }
  fs.writeFileSync(path.join(SHOTS, 'mesures.json'), JSON.stringify({ moteur: NAVIGATEUR, mesures, ko }, null, 1));
  console.log(`\n${bilan.ok} ✅ · ${bilan.ko} ❌ (moteur ${NAVIGATEUR} ; captures et mesures : ${SHOTS})`);
  process.exit(bilan.ko ? 1 : 0);
})();
