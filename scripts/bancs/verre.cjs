// ════════════════════════════════════════════════════════════════════════════
//  BANC « VERRE DÉPOLI » (15 nov.) — ⚠️ le 19 nov. (« VRM natif », docs/design/NATIF.md) le dégradé bleu et le verre
//  ont DISPARU : V1 et V2 jugent désormais leur absence (aplat, aucun panneau translucide) ; le reste est inchangé.
//  À l'origine : « J'aime la 9 » — src/design/studio-verre.css
//  Récit : docs/passation/2026-11-15-verre-depoli.md
//
//  Sur une base INVENTÉE (1 000 paires, 1 000 conversations, 1 000 e-mails : _base-messages-stock.cjs),
//  à 390 tactile ET 1512, clair ET sombre, chaque écran est ouvert et JUGÉ SUR SA RÈGLE :
//    V1 le FOND : un ::before fixe (inset 0, z-index -1) sur la coque, un dégradé dont toutes les
//       couleurs CALCULÉES sont les jetons --sv-haut/--sv-milieu/--sv-bas/--sv-reflet* (aucune autre) ;
//       le fond est un bleu PROFOND (le bas du dégradé, luminance < 0,05) ;
//    V2 le VERRE : au moins un panneau de l'écran porte la couleur CALCULÉE de --sv-verre (translucide,
//       0 < alpha < 1) ; les feuilles et champs restent OPAQUES (alpha ≥ 0,9) ;
//    V3 le CONTRASTE : chaque texte rendu (nœud texte direct, visible) est jugé sur son fond RÉEL,
//       recomposé couche par couche (couleur de fond, dégradé de fond, alpha) jusqu'au fond de la coque ;
//       là, le PIRE des deux bouts du dégradé (le bas, le plus sombre ; le haut éclairé du reflet, le plus
//       clair) — AA : 4,5:1, 3:1 pour un gros texte (≥ 24 px, ou ≥ 18,66 px en 700) ;
//    V4 le FLOU, borné : au plus FLOU_MAX éléments à `backdrop-filter` par écran, aucun dans une rangée ;
//    V5 un PLEIN au plus (`.sb-btn-plein` visible hors feuille) ;
//    V6 rien ne déborde à l'horizontale (page et .vrm-main) ;
//    V7 le « ? » d'un titre est à 8 px au moins de tout texte de sa ligne (il ne chevauche pas le titre) ;
//    V8 aucun texte coupé au milieu d'un mot (points de suspension) hors d'une rangée de liste ;
//    V9 la pastille « Mis à jour à … » (quand elle est là) ne recouvre aucun texte.
//  Un banc ne meurt pas, il rapporte : chaque ✗ dit l'écran, l'élément et le chiffre.
//  `ECRANS=journee,annonces` `LARGEURS=390` `THEMES=clair` pour un sous-ensemble ; `DETAIL=12` ; `SHOTS=<dossier>`.
//  `BANC_DIST=<dist>` pour juger un autre arbre (l'arbre de départ : il doit être ROUGE).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
require('./_porte-banc.cjs');
const P = require('./design-passe.cjs');
const B = require('./_base-messages-stock.cjs');

const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const ECRANS = {
  journee: '/?tab=journee', ventes: '/?tab=ventes', colis: '/?tab=cat_bord', achats: '/?tab=achats', annonces: '/?tab=annonces',
  stock: '/?tab=garage', leboncoin: '/?tab=plat_leboncoin', ebay: '/?tab=plat_ebay', vestiaire: '/?tab=plat_vestiaire',
  argent: '/?tab=argent', messages: '/?tab=messages', emails: '/?tab=emails', settings: '/?tab=settings', communaute: '/?tab=communaute',
  loupe: '/?tab=journee', fiche: '/?tab=journee', disque: '/?tab=journee',
};
const VOULUS = liste('ECRANS', Object.keys(ECRANS).join(','));
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const DETAIL = Number(process.env.DETAIL || 6);
const FLOU_MAX = 8;
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-verre');
fs.mkdirSync(SHOTS, { recursive: true });

// ── La mesure, DANS la page ──
function mesurer() {
  const out = { fond: null, verre: null, opaques: [], contraste: [], textes: 0, flous: [], pleins: 0, deborde: null };
  const parse = (s) => {
    s = String(s || '').trim();
    let m = s.match(/^#([0-9a-f]{6})$/i);
    if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16), 1];
    m = s.match(/^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i);
    if (m) { let a = m[4] == null ? 1 : (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])); return [+m[1], +m[2], +m[3], a]; }
    if (s === 'transparent') return [0, 0, 0, 0];
    // couleur(srgb …) ou oklab : on la passe par le navigateur
    const d = document.createElement('i'); d.style.color = s; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove();
    if (c && c !== s) return parse(c);
    return null;
  };
  const couleursDe = (img) => (String(img).match(/rgba?\([^)]*\)|#[0-9a-f]{6}\b|color\([^)]*\)/gi) || []).map(parse).filter(Boolean);
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const L = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const ratio = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const sur = (h, a, bas) => [0, 1, 2].map((i) => h[i] * a + bas[i] * (1 - a));
  // Rogné : un ancêtre qui coupe ce qui déborde (overflow) ne laisse rien voir de l'élément (ex. une carte repliée à 0 px).
  const rogne = (el, r) => {
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const c = getComputedStyle(a); if (c.display === 'contents') continue;
      const cx = /hidden|clip/.test(c.overflowX), cy = /hidden|clip/.test(c.overflowY);   // une zone qui DÉFILE n'est pas un rognage
      if (!cx && !cy) continue;
      const q = a.getBoundingClientRect();
      if ((cx && (q.width < 1 || r.right <= q.left || r.left >= q.right)) || (cy && (q.height < 1 || r.bottom <= q.top || r.top >= q.bottom))) return true;
    }
    return false;
  };
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && cs.display !== 'none' && !rogne(el, r); };
  const nom = (el) => { const p = []; let e = el; for (let i = 0; e && i < 6; i++, e = e.parentElement) p.unshift(e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '')); return p.join(' > '); };
  // un texte VU dans l'élément (un libellé masqué pour les lecteurs d'écran ne compte pas)
  const texteVu = (b) => [b, ...b.querySelectorAll('*')].some((x) => { if (x.closest('svg')) return false; let t = ''; for (const n of x.childNodes) if (n.nodeType === 3) t += n.nodeValue; if (!t.trim()) return false; const r = x.getBoundingClientRect(); return r.width > 2 && r.height > 2 && getComputedStyle(x).clip !== 'rect(0px, 0px, 0px, 0px)'; });
  const root = getComputedStyle(document.documentElement);
  const tok = (n) => parse(root.getPropertyValue(n));

  // V1 — le fond
  const coque = document.querySelector('.vrm-app-shell[data-espace]');
  const haut = tok('--sv-haut'), milieu = tok('--sv-milieu'), bas = tok('--sv-bas'), reflet = tok('--sv-reflet'), reflet2 = tok('--sv-reflet-2');
  if (coque) {
    const b = getComputedStyle(coque, '::before');
    const img = b.backgroundImage || '';
    const cs = couleursDe(img);
    const jetons = [haut, milieu, bas, reflet, reflet2].filter(Boolean);
    const egal = (a, c) => a && c && Math.abs(a[0] - c[0]) < 1.5 && Math.abs(a[1] - c[1]) < 1.5 && Math.abs(a[2] - c[2]) < 1.5 && (c[3] === 0 || Math.abs(a[3] - c[3]) < .02);
    const etrangeres = cs.filter((c) => c[3] > 0 && !jetons.some((j) => egal(j, c)));
    // Le ::before à z-index -1 se peint SOUS le fond de tout ancêtre qui n'est pas un contexte d'empilement : aucun
    // ancêtre (body compris) ne doit peindre un fond par-dessus, sinon le dégradé est caché (vu le 15 nov. : body opaque).
    const caches = [];
    for (let a = coque; a && a !== document.documentElement; a = a.parentElement) { const ca = getComputedStyle(a); const c = parse(ca.backgroundColor); if ((c && c[3] > 0) || ca.backgroundImage !== 'none') caches.push(a.tagName.toLowerCase() + (a.className && typeof a.className === 'string' ? '.' + a.className.split(' ')[0] : '')); }
    out.fond = { caches, contenu: b.content !== 'none' && b.content !== 'normal', position: b.position, inset: [b.top, b.left, b.right, b.bottom].join(' '), z: b.zIndex, degrade: /gradient/.test(img), n: cs.length, etrangeres: etrangeres.length,
      jetons: jetons.length === 5, profond: bas ? L(bas) < 0.05 : false, coqueFond: getComputedStyle(coque).backgroundColor };
  }
  // Les deux bouts du fond (le haut éclairé du reflet ; le bas). Sans jetons (arbre d'avant) : le fond calculé de la coque.
  let bouts;
  if (haut && bas && reflet) {
    let clair = haut.slice(0, 3); if (reflet2) clair = sur(reflet2, reflet2[3], clair); clair = sur(reflet, reflet[3], clair);
    bouts = [clair, bas.slice(0, 3)];
  } else {
    const c = coque ? parse(getComputedStyle(coque).backgroundColor) : [255, 255, 255, 1];
    const cs = coque ? couleursDe(getComputedStyle(coque).backgroundImage) : [];
    bouts = [c, ...cs].filter((x) => x && x[3] > 0.5).map((x) => x.slice(0, 3)); if (!bouts.length) bouts = [[255, 255, 255]];
  }

  // V2 — le verre : au moins un panneau à la couleur de --sv-verre ; les feuilles et champs opaques
  const verre = tok('--sv-verre');
  let panneaux = 0;
  if (verre) for (const el of document.querySelectorAll('.vrm-main *')) {
    // le verre peut être la couleur de fond OU le dégradé de fond (une seule couche : la couleur reste transparente)
    const cs0 = getComputedStyle(el);
    const cands = [parse(cs0.backgroundColor), ...(/gradient/.test(cs0.backgroundImage) ? couleursDe(cs0.backgroundImage) : [])];
    const estVerre = cands.some((c) => c && c[3] > 0 && c[3] < 1 && Math.abs(c[3] - verre[3]) < .02 && Math.abs(c[0] - verre[0]) < 2 && Math.abs(c[2] - verre[2]) < 2);
    if (estVerre && vis(el)) { panneaux++; if (panneaux > 50) break; }
  }
  out.verre = { panneaux, alpha: verre ? verre[3] : null };
  for (const el of document.querySelectorAll('.vrm-fs-cadre, .sb-feuille, [role="dialog"], [role="alertdialog"], .vrm-main input[type="text"], .vrm-main input[type="search"], .vrm-main textarea, .sb-champ')) {
    if (!vis(el)) continue;
    // le fond réel du champ : lui, ou son puits
    let e = el, c = null;
    for (let i = 0; e && i < 3; i++, e = e.parentElement) { const x = parse(getComputedStyle(e).backgroundColor); if (x && x[3] > 0) { c = x; break; } }
    // (19 nov., « VRM natif ») un CHAMP peut porter le remplissage gris d'iOS (rgb(118 118 128 / .12–.24), contrat §1) :
    // ce n'est pas du verre (aucun flou, aucun bleu). Une FEUILLE reste opaque.
    const champ = el.matches('input, textarea, .sb-champ');
    const remplirIos = c && Math.abs(c[0] - 118) <= 2 && Math.abs(c[1] - 118) <= 2 && Math.abs(c[2] - 128) <= 2 && c[3] <= 0.3;
    if (c && c[3] < 0.9 && !(champ && remplirIos)) out.opaques.push(`${nom(el)} alpha ${c[3].toFixed(2)}`);
  }

  // V3 — le contraste, sur le fond RÉEL
  const racines = [...document.querySelectorAll('.vrm-app-shell[data-espace] .vrm-main, .vrm-app-shell[data-espace] .vrm-app-header, .vrm-app-shell[data-espace] .vrm-tabbar, .vrm-app-shell[data-espace] .vrm-sidebar, .vrm-fs, [data-recherche-panneau], .sb-eventail')];
  const vus = new Set();
  for (const r of racines) for (const el of r.querySelectorAll('*')) {
    if (vus.has(el)) continue; vus.add(el);
    // Une ICÔNE seule dans un bouton (sans texte) : jugée comme un élément graphique, 3:1 (WCAG 1.4.11).
    const icone = el.tagName.toLowerCase() === 'svg' && el.parentElement && el.parentElement.matches('button, a, [role="button"]') && !texteVu(el.parentElement);
    if (!icone && (/^(svg|path|script|style|img|picture|video|canvas|input|textarea|select|option)$/i.test(el.tagName) || el.closest('svg'))) continue;
    let texte = '';
    for (const n of el.childNodes) if (n.nodeType === 3) texte += n.nodeValue;
    texte = texte.replace(/\s+/g, ' ').trim();
    if (icone) texte = '(icône) ' + (el.parentElement.getAttribute('aria-label') || el.parentElement.title || '');
    else if (!texte || !/[\p{L}\p{N}€]/u.test(texte)) continue;
    if (!vis(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.clip === 'rect(0px, 0px, 0px, 0px)' || cs.clipPath === 'inset(50%)') continue;
    const rr = el.getBoundingClientRect(); if (rr.bottom < -2000 || rr.top > innerHeight + 4000) continue;
    // opacité cumulée ; et le fond, couche par couche
    let op = 1, photo = false, couches = [], e = el, fin = false;
    for (; e; e = e.parentElement) {
      const c = getComputedStyle(e);
      op *= parseFloat(c.opacity || '1');
      if (e === coque || e === document.body || e === document.documentElement) break;
      const img = c.backgroundImage || 'none';
      if (/url\(/.test(img)) { photo = true; break; }
      const lay = [];
      const bg = parse(c.backgroundColor);
      if (bg && bg[3] > 0) lay.push([bg]);
      if (/gradient/.test(img)) { const g = couleursDe(img).filter((x) => x[3] > 0); if (g.length) lay.push(g); }
      if (lay.length) {
        // la couleur de fond est SOUS l'image : le dégradé passe devant
        couches.push(...lay.reverse());
        const opaque = (bg && bg[3] >= 0.999) || (lay.length && lay[0].every((x) => x[3] >= 0.999));
        if (opaque) { fin = true; break; }
      }
    }
    if (photo || op < 0.5) continue;
    // une pastille en train d'apparaître ou de s'effacer (« Mis à jour à … ») : jugée à l'arrêt seulement
    let anime = false; for (let x = el; x && x !== coque; x = x.parentElement) if (x.getAnimations && x.getAnimations().some((a) => a.playState === 'running' && /opacity/.test(JSON.stringify((a.effect && a.effect.getKeyframes && a.effect.getKeyframes()) || [])))) { anime = true; break; }
    if (anime) continue;
    // la pile : du plus profond (fond) au plus proche
    let cands = fin ? [] : bouts.map((x) => x.slice());
    const pile = couches.slice().reverse();
    for (const lay of pile) {
      const n = [];
      for (const col of lay) { if (!cands.length) n.push(col.slice(0, 3)); else for (const b of cands) n.push(sur(col, col[3], b)); }
      cands = n.slice(0, 24);
    }
    const tc = parse(cs.color); if (!tc || tc[3] === 0) continue;   // un texte transparent est masqué EXPRÈS (icône seule : la Calculette d'Achats)
    const a = tc[3] * Math.min(1, op);
    let pire = Infinity, ou = null;
    for (const b of cands) { const t = sur(tc, a, b); const k = ratio(t, b); if (k < pire) { pire = k; ou = b; } }
    out.textes++;
    const px = parseFloat(cs.fontSize), w = parseInt(cs.fontWeight, 10) || 400;
    const gros = icone || px >= 24 || (px >= 18.66 && w >= 700);
    const seuil = gros ? 3 : 4.5;
    if (pire < seuil - 0.005) out.contraste.push({ k: +pire.toFixed(2), seuil, el: nom(el), t: texte.slice(0, 40), c: cs.color, f: ou ? ou.map(Math.round).join(',') : '' });
  }

  // V4 — les flous
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    const f = cs.backdropFilter || cs.webkitBackdropFilter;
    if (!f || f === 'none' || !vis(el)) continue;
    const rangee = !!el.closest('.sb-rangee, li, [role="row"], [class*="rangee"], [class*="-row"]') && !el.matches('.vrm-tabbar, .vrm-app-header, .vrm-sidebar');
    out.flous.push({ el: nom(el), rangee });
  }
  // V5 — un plein au plus (hors feuille)
  out.pleins = [...document.querySelectorAll('.vrm-app-shell[data-espace] .sb-btn-plein')].filter((el) => vis(el) && !el.closest('.vrm-fs, [role="dialog"], .sb-eventail')).filter((el) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }).length;
  // V7 — le « ? » d'un titre ne touche pas le titre : 8 px au moins entre son cercle dessiné et tout texte de la ligne.
  out.colle = [];
  const textesVus = [...document.querySelectorAll('.vrm-app-shell[data-espace] .vrm-main *')].filter((x) => { if (x.closest('svg, .vrm-aide-bouton')) return false; let t = ''; for (const n of x.childNodes) if (n.nodeType === 3) t += n.nodeValue; return t.trim() && vis(x); });
  const rectsTexte = (x) => { const rs = []; for (const n of x.childNodes) if (n.nodeType === 3 && n.nodeValue.trim()) { const g = document.createRange(); g.selectNodeContents(n); rs.push(...g.getClientRects()); } return rs; };
  for (const b of document.querySelectorAll('.vrm-app-shell[data-espace] .vrm-main .vrm-aide-bouton')) {
    const sv = b.querySelector('svg'); if (!sv || !vis(b)) continue;
    const r = sv.getBoundingClientRect();
    // (16 nov.) un « ? » VU seulement, comme le texte : sous une liste flottante (la loupe ouverte sur Ma journée), il
    // n'est pas vu et le texte de la liste n'est pas « sa ligne ».
    { const h = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2); if (!h || !(h === b || b.contains(h))) continue; }
    for (const x of textesVus) for (const t of rectsTexte(x)) {
      const vert = t.bottom > r.top + 2 && t.top < r.bottom - 2;
      const ecart = t.right <= r.left ? r.left - t.right : t.left >= r.right ? t.left - r.right : -1;
      // un texte VU seulement (le point au centre de sa ligne le désigne : pas caché sous autre chose, ni rogné, ni transparent)
      const cx = (t.left + t.right) / 2, cy = (t.top + t.bottom) / 2;
      const vu = cx >= 0 && cy >= 0 && cx < innerWidth && cy < innerHeight && (() => { const h = document.elementFromPoint(cx, cy); return h && (h === x || x.contains(h)); })();
      if (vert && ecart < 8 && vu) { out.colle.push(`${nom(x).split(' > ').pop()} « ${x.textContent.trim().slice(0, 20)} » à ${Math.round(ecart)} px`); break; }
    }
  }
  // V8 — un texte coupé au milieu d'un mot (points de suspension) hors d'une rangée de liste (un titre d'article dans une
  // rangée se coupe, c'est la règle des listes de 1 000 ; une phrase, un libellé, un chiffre, jamais).
  out.coupes = [];
  for (const x of textesVus) {
    const c = getComputedStyle(x);
    if (c.textOverflow !== 'ellipsis' || x.scrollWidth <= x.clientWidth + 1) continue;
    if (x.closest('li, [role="listitem"], [role="row"], .sb-rangee, [class*="rangee"], [class*="-row"], [class*="ligne"], [class*="titre"], .sb-plan, [class*="liste"], [class*="list"], select, option')) continue;
    out.coupes.push(`${nom(x)} « ${x.textContent.trim().slice(0, 30)} »`);
  }
  // V9 — la pastille « Mis à jour à … » ne recouvre aucun texte.
  out.pastille = [];
  const pn = document.querySelector('.vrm-neuf');
  if (pn && vis(pn)) {
    const r = pn.getBoundingClientRect();
    for (const x of document.querySelectorAll('.vrm-app-shell[data-espace] :is(.vrm-main, .vrm-app-header) *')) {
      if (x.closest('.vrm-neuf-hote') || !vis(x)) continue;
      for (const t of rectsTexte(x)) if (t.right > r.left && t.left < r.right && t.bottom > r.top && t.top < r.bottom) { out.pastille.push(`« ${x.textContent.trim().slice(0, 24)} »`); break; }
      if (out.pastille.length > 4) break;
    }
  }
  // V6 — débordement
  const se = document.scrollingElement, main = document.querySelector('.vrm-app-shell[data-espace] .vrm-main');
  // + ce qui sort de l'écran sans qu'on puisse le faire défiler (une coque en `overflow-x: clip` le cache sans élargir la page)
  let hors = 0; const horsNoms = [];
  if (main) for (const el of main.querySelectorAll('*')) {
    const r0 = el.getBoundingClientRect(); if (r0.width < 2 || r0.height < 2 || (r0.right <= innerWidth + 2 && r0.left >= -2)) continue;
    // une rangée de liste qui coupe son texte en points de suspension, c'est la règle des listes (pas un débordement)
    if (el.closest('li, [role="listitem"], [role="row"], .sb-rangee, [class*="rangee"], [class*="-row"], [class*="ligne"]')) continue;
    let suspendu = false; for (let a = el; a && a !== main; a = a.parentElement) if (getComputedStyle(a).textOverflow === 'ellipsis') { suspendu = true; break; }
    if (suspendu) continue;
    const r = r0;
    let defile = false; for (let a = el.parentElement; a && a !== main; a = a.parentElement) { const c = getComputedStyle(a); if (/auto|scroll/.test(c.overflowX)) { defile = true; break; } }
    if (defile || getComputedStyle(el).visibility === 'hidden' || el.closest('[aria-hidden="true"], .vrm-sr-seul')) continue;
    hors++; if (horsNoms.length < 4) horsNoms.push(`${nom(el)} [${Math.round(r.left)}→${Math.round(r.right)}]`); if (hors > 20) break;
  }
  out.deborde = { page: se.scrollWidth - innerWidth, main: main ? main.scrollWidth - main.clientWidth : 0, hors, horsNoms };
  return out;
}

const bilan = { ok: 0, ko: 0 };
const dit = (ok, quoi, detail = '') => { if (ok) bilan.ok++; else bilan.ko++; console.log(`${ok ? '✅' : '❌'} ${quoi}${detail ? ' — ' + detail : ''}`); };

module.exports = { mesurer, ECRANS };
if (require.main === module) (async () => {
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const W of LARGEURS) for (const th of THEMES) for (const e of VOULUS) {
      const suf = `${e}-${W}-${th}`;
      let o;
      try {
        o = await P.ouvrir(nav, { W, sombre: th === 'sombre', b: B.baseVolume(), url: ECRANS[e], api: B.apiVolume });
        await P.pret(o.pg);
        if (e === 'loupe') {
          if (o.tel) await o.pg.locator('button[data-recherche-loupe]').first().tap().catch(() => {});
          else { await o.pg.mouse.click(5, 300); await o.pg.keyboard.press('Control+K'); }
          await o.pg.waitForSelector('[data-recherche-champ]', { timeout: 8000 }).catch(() => {});
          await o.pg.evaluate(() => { const el = document.querySelector('[data-recherche-champ]'); if (!el) return; const poser = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; poser.call(el, '5'); el.dispatchEvent(new Event('input', { bubbles: true })); });
          await o.pg.waitForTimeout(1500);
        }
        if (e === 'fiche') {
          await o.pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:fiche-paire', { detail: '1205' })));
          await o.pg.waitForSelector('[data-fiche-paire]', { timeout: 8000 }).catch(() => {});
          await o.pg.waitForTimeout(2000);
        }
        if (e === 'disque') {
          const d = o.pg.locator('[data-sb-disque]').first();
          if (await d.count()) { if (o.tel) await d.tap().catch(() => {}); else await d.click().catch(() => {}); }
          await o.pg.waitForTimeout(900);
        }
        await o.pg.waitForTimeout(600);
        await o.pg.screenshot({ path: path.join(SHOTS, suf + '.png') });
        const m = await o.pg.evaluate(mesurer);
        const f = m.fond;
        // (19 nov., « VRM natif », docs/design/NATIF.md) Plus de dégradé bleu ni de verre : V1 et V2 jugent leur ABSENCE.
        // Le fond est l'aplat de la page (`--n-fond`), aucun panneau n'est translucide. V3–V9 (contraste, flou borné,
        // débordement…) restent ; le contraste de TOUS les écrans se lit désormais sur les pixels : lisible-partout.cjs.
        dit(!!f && !f.degrade, `V1 ${suf} : le fond est un aplat (aucun dégradé sur la coque)`, f ? `dégradé ${f.degrade} · ${f.n} couleurs · fond de la coque ${f.coqueFond}` : 'pas de coque');
        dit(m.verre.panneaux === 0, `V2 ${suf} : aucun panneau de verre (translucide)`, `${m.verre.panneaux} panneau(x) à --sv-verre (alpha ${m.verre.alpha})`);
        dit(m.opaques.length === 0, `V2 ${suf} : feuilles et champs opaques`, m.opaques.slice(0, DETAIL).join(' | '));
        dit(m.contraste.length === 0, `V3 ${suf} : contraste AA sur le fond réel (${m.textes} textes)`,
          m.contraste.length ? `${m.contraste.length} sous le seuil : ` + m.contraste.slice(0, DETAIL).map((x) => `${x.k}<${x.seuil} « ${x.t} » ${x.el} (${x.c} sur ${x.f})`).join(' | ') : '');
        dit(m.flous.length <= FLOU_MAX && !m.flous.some((x) => x.rangee), `V4 ${suf} : flou borné`, `${m.flous.length} élément(s) flouté(s)${m.flous.some((x) => x.rangee) ? ' dont dans une rangée : ' + m.flous.filter((x) => x.rangee).map((x) => x.el).slice(0, 3).join(' | ') : ''}`);
        dit(m.pleins <= 1, `V5 ${suf} : un plein au plus`, `${m.pleins}`);
        dit(m.deborde.page <= 1 && m.deborde.main <= 1 && m.deborde.hors === 0, `V6 ${suf} : rien ne déborde`, `page +${m.deborde.page} · main +${m.deborde.main} · ${m.deborde.hors} élément(s) hors de l'écran${m.deborde.hors ? ' : ' + m.deborde.horsNoms.join(' | ') : ''}`);
        dit(m.colle.length === 0, `V7 ${suf} : le « ? » ne colle à aucun titre (≥ 8 px)`, m.colle.slice(0, DETAIL).join(' | '));
        dit(m.coupes.length === 0, `V8 ${suf} : aucun texte coupé au milieu d'un mot hors des rangées`, m.coupes.slice(0, DETAIL).join(' | '));
        dit(m.pastille.length === 0, `V9 ${suf} : la pastille « Mis à jour » ne recouvre aucun texte`, m.pastille.join(' | '));
        if (o.erreurs.length) console.log(`   (erreurs de page : ${o.erreurs.slice(0, 2).join(' | ')})`);
      } catch (err) { dit(false, `${suf} : ouverture`, String(err.message || err).slice(0, 200)); }
      finally { if (o) await o.ctx.close().catch(() => {}); }
    }
  } finally { await nav.close(); P.srv.close(); }
  console.log(`\n${bilan.ok} ✅ · ${bilan.ko} ❌ (captures : ${SHOTS})`);
  process.exit(bilan.ko ? 1 : 0);
})();
