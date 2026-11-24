require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));
process.env.BANC_DESIGN_V2 = process.env.BANC_DESIGN_V2 || 'defaut';
require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  LES DIX STYLES À ESSAYER (24 nov. 2026 — docs/passation/2026-11-24-style-graphite.md). Julien : « propose un design un
//  peu plus foncé en gris pour l'iPhone et améliore tous les boutons […] essaye un peu de changer de style » ; puis dix
//  styles à essayer DANS l'app. Sur l'app RENDUE (base inventée de design-passe), pour chaque style × clair/sombre, à
//  390 tactile (et 1512 pour `LARGEURS=390,1512`), sur Ventes, Annonces et la fiche d'une paire :
//    A  le style est APPLIQUÉ : `data-style` sur la racine, `--n-fond` = le fond de la table (scripts/styles-generer.cjs) ;
//    B  chaque texte visible tient 4,5:1 (3:1 en grand) sur son fond recomposé ; ET mesuré SUR LES PIXELS de la capture
//       (DSF 2) pour le plein, les étiquettes, le N°, le grand titre, les rangées, l'onglet actif : le pixel le plus
//       contrasté de la boîte contre la couleur dominante ;
//    C  chaque cible (bouton, onglet, choix, champ) fait ≥ 44 × 44 au doigt ;
//    D  aucune couleur orange/ambre calculée (texte, fond, bord, ombre, trait) hors logos de sites et photos ; rouge
//       seulement sur un doublon de N° ;
//    E  chaque bouton de l'écran est de LA famille (`n-bouton`, `n-bouton-icone-seule`, choix segmenté, onglet, rangée,
//       recherche) : aucune ancienne classe de bouton ;
//    F  l'état enfoncé EXISTE : `data-n-force="appui"` sur un bouton ⇒ réduit (échelle < 1) et plus foncé ;
//    G  rien ne déborde, aucun bouton/étiquette n'en chevauche un autre, aucune erreur d'app.
//  `STYLES=graphite,nuit` `THEMES=clair` `LARGEURS=390,1512` `ECRANS=ventes,annonces,fiche` `SHOTS=<dossier>`.
//  Rouge : `BANC_DIST=<dist d'avant>` (aucun style) ; `MUTATION=sansstyle|orange|pale|petit|appui|vieux|deborde`.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const G = require('../styles-generer.cjs');
const { base, srv, PORT, chromium } = P;
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-styles-choix');
fs.mkdirSync(SHOTS, { recursive: true });
const STYLES = (process.env.STYLES || G.ORDRE.join(',')).split(',');
const THEMES = (process.env.THEMES || 'clair,sombre').split(',');
const LARGEURS = (process.env.LARGEURS || '390').split(',').map(Number);
const ECRANS = (process.env.ECRANS || 'ventes,annonces,fiche').split(',');
const MUT = process.env.MUTATION || '';
const PRINCIPAUX = new Set(['ventes', 'annonces', 'fiche']);
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; if (!process.env.CALME) console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 700) : '')); } return c; };

const MUTATIONS = {
  orange: ':root[data-style] { --n-accent: #E8891C !important; --n-plein: #E8891C !important; }',
  pale: ':root[data-style] { --n-encre-2: #A8ABB0 !important; --n-texte: #A8ABB0 !important; }',
  appui: '[data-style] .n-bouton[data-n-force="appui"] { transform: none !important; background-color: var(--n-plein) !important; filter: none !important; }',
};

// ── la mesure, DANS la page ──
const MESURE = (args) => {
  const { tactile } = args;
  const parse = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c || ''); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const sur = (h, f) => ({ r: h.r * h.a + f.r * (1 - h.a), g: h.g * h.a + f.g * (1 - h.a), b: h.b * h.a + f.b * (1 - h.a), a: 1 });
  const lum = (c) => { const t = [c.r, c.g, c.b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * t[0] + 0.7152 * t[1] + 0.0722 * t[2]; };
  const rapport = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const hsl = (c) => { const r = c.r / 255, g = c.g / 255, b = c.b / 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn; if (!d) return { h: 0, s: 0, l }; const s = d / (1 - Math.abs(2 * l - 1)); let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; return { h, s, l }; };
  const ambre = (c) => { if (!c || c.a < 0.15) return false; const x = hsl(c); return x.h >= 18 && x.h <= 55 && x.s > 0.40 && x.l > 0.12 && x.l < 0.92; };
  const rouge = (c) => { if (!c || c.a < 0.15) return false; const x = hsl(c); return (x.h < 12 || x.h > 345) && x.s > 0.45 && x.l > 0.2 && x.l < 0.85; };
  const arrets = (img) => (img.match(/rgba?\([^)]+\)/g) || []).map(parse).filter(Boolean);
  const racine = parse(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
  const fondDe = (el, clair) => {
    const r = el.getBoundingClientRect(); const pile = document.elementsFromPoint(Math.min(innerWidth - 1, Math.max(0, r.left + Math.min(r.width / 2, 12))), Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2)));
    let i0 = pile.indexOf(el); const chaine = []; if (i0 < 0) { for (let y = el; y && y.nodeType === 1; y = y.parentElement) chaine.push(y); }
    const suite = i0 < 0 ? chaine : pile.slice(i0);
    const couches = []; let x = null;
    for (let i = 0; i < suite.length; i++) { x = suite[i]; const cs = getComputedStyle(x); const img = cs.backgroundImage;
      if (img && img !== 'none' && /gradient/.test(img)) { const a = arrets(img).filter((c) => c.a > 0.5); if (a.length) { const pire = a.sort((p, q) => (clair ? lum(q) - lum(p) : lum(p) - lum(q)))[0]; couches.push({ ...pire, a: 1 }); break; } }
      const c = parse(cs.backgroundColor); if (c && c.a > 0) { couches.push(c); if (c.a >= 0.999) break; }
      x = null; }
    let f = x ? null : { ...racine, a: 1 };
    if (!f) f = { r: 223, g: 225, b: 229, a: 1 };
    for (let i = couches.length - 1; i >= 0; i--) f = couches[i].a >= 0.999 ? couches[i] : sur(couches[i], f);
    return f;
  };
  const opacite = (el) => { let o = 1, x = el; while (x && x.nodeType === 1) { o *= Number(getComputedStyle(x).opacity); x = x.parentElement; } return o; };
  const cache = (el) => !!el.closest('[aria-hidden="true"], [hidden], [inert], .vrm-sensible-cache, .n-lu-seul, .vrm-sr-seul, .n-tt-sr, .sr-only, .visually-hidden, .vrm-sr-only');
  const vu = (el) => { const r = el.getBoundingClientRect(); if (r.width < 3 || r.height < 3) return false; if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return false;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || /inset\(50%\)|rect\(0/.test(cs.clipPath + ' ' + cs.clip)) return false; if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true })) return false; return !cache(el); };
  const nom = (el) => { const q = el.getBoundingClientRect(); return `[${Math.round(q.left)},${Math.round(q.top)} ${Math.round(q.width)}×${Math.round(q.height)}] ${el.tagName.toLowerCase()}.${String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className).trim().split(/\s+/).slice(0, 2).join('.')} « ${(el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 28)} »`; };
  const racines = [...document.querySelectorAll('.vrm-main, .n-onglets, [data-fiche-paire]')];
  const dans = (el) => racines.some((r) => r.contains(el));
  // B : chaque texte
  const contraste = [], vus = new Set(); let nTextes = 0;
  for (const el of document.querySelectorAll('body *')) {
    if (!dans(el) || !vu(el)) continue;
    const t = [...el.childNodes].filter((c) => c.nodeType === 3).map((c) => c.textContent).join('').trim();
    if (!t || t.length < 2 || !/[\p{L}\p{N}]/u.test(t)) continue;
    if (el.closest('input, textarea, select, svg, [disabled], [aria-disabled="true"]')) continue;
    const cs = getComputedStyle(el); const fc = parse(cs.color); if (!fc) continue;
    const o = opacite(el); if (o < 0.05) continue;
    const f = fondDe(el, lum(fc) > 0.4); const c = sur({ ...fc, a: fc.a * o }, f);
    const taille = parseFloat(cs.fontSize), gras = Number(cs.fontWeight) >= 700;
    const seuil = taille >= 24 || (taille >= 18.66 && gras) ? 3 : 4.5;
    const k = rapport(c, f); nTextes++;
    if (k < seuil - 0.005) { const cle = t.slice(0, 26); if (!vus.has(cle)) { vus.add(cle); contraste.push(`${cle} ${k.toFixed(2)}<${seuil}`); } }
  }
  // C : les cibles ; E : la famille
  const CIBLES = 'button, [role="button"], [role="tab"], [role="radio"], [role="switch"], a[href], input:not([type="hidden"]), select, summary';
  const FAMILLE = /(^|\s)(n-bouton|n-bouton-icone-seule|n-segmente-choix|n-onglet|n-rangee-corps|n-rangee-action|n-recherche-bouton|n-recherche-champ|n-recherche-efface|n-barre-retour|n-tb-rond|n-groupe-repli|n-groupe-action|n-fait-touche|n-feuille-croix|n-feuille-poignee|n-interrupteur|n-vide-action|n-toast-action|g-tuile)(\s|$)/;
  const petites = [], etrangers = [], boites = []; let nCibles = 0;
  for (const el of document.querySelectorAll(CIBLES)) {
    if (!dans(el) || !vu(el) || el.closest('svg')) continue;
    if (el.matches('input[type="checkbox"], input[type="radio"]') && el.closest('label')) continue;   // la case vit dans son libellé (la cible est le libellé)
    nCibles++;
    const r = (el.matches('input[type="checkbox"], input[type="radio"]') ? (el.closest('label, .n-rangee-case, [class*="case"]') || el) : el).getBoundingClientRect();
    if (tactile && (r.height + 0.5 < 44 || r.width + 0.5 < 44)) petites.push(`${nom(el)} ${Math.round(r.width)}×${Math.round(r.height)}`);
    const cls = String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className || '');
    const enFamille = FAMILLE.test(cls) || el.hasAttribute('data-n-famille');
    if (el.matches('button, [role="button"]') && !enFamille) etrangers.push(nom(el));
  }
  // G : chevauchements entre boutons / étiquettes / plaques visibles
  for (const el of document.querySelectorAll('.n-bouton, .n-bouton-icone-seule, .n-pastille, .n-plaque')) { if (dans(el) && vu(el)) boites.push([el, el.getBoundingClientRect()]); }
  const colle = (el) => { for (let x = el; x && x !== document.body; x = x.parentElement) { const p = getComputedStyle(x).position; if (p === 'fixed' || p === 'sticky') return x; } return null; };
  const chevauche = [];
  for (let i = 0; i < boites.length; i++) for (let j = i + 1; j < boites.length; j++) {
    const [a, p] = boites[i], [b, q] = boites[j]; if (a.contains(b) || b.contains(a)) continue;
    if (colle(a) !== colle(b)) continue;   // le contenu défile SOUS une barre fixe ou collée : ce n'est pas un chevauchement
    const w = Math.min(p.right, q.right) - Math.max(p.left, q.left), h = Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top);
    if (w > 2 && h > 2) chevauche.push(`${nom(a)} × ${nom(b)}`);
  }
  // G (bis) : un bouton DESSINÉ (sa boîte moins ses bordures transparentes) ne recouvre aucun texte d'à côté
  const recouvre = [];
  const textes = [...document.querySelectorAll('.vrm-main *, [data-fiche-paire] *')].filter((el) => [...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim()) && vu(el));
  for (const [el] of boites.concat([...document.querySelectorAll('[data-n-famille="second"], [data-n-famille="champ"]')].filter((x) => dans(x) && vu(x)).map((x) => [x]))) {
    if (!el.matches('.n-bouton, [data-n-famille]')) continue;
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    { const t0 = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); if (!t0 || !(el.contains(t0) || t0.contains(el))) continue; }   // caché sous autre chose (une barre) : rien à recouvrir
    const d = { l: r.left + parseFloat(cs.borderLeftWidth), r: r.right - parseFloat(cs.borderRightWidth), t: r.top + parseFloat(cs.borderTopWidth), b: r.bottom - parseFloat(cs.borderBottomWidth) };
    for (const t of textes) { if (el.contains(t) || t.contains(el) || colle(t) !== colle(el)) continue; const q = t.getBoundingClientRect();
      const w = Math.min(d.r, q.right) - Math.max(d.l, q.left), h = Math.min(d.b, q.bottom) - Math.max(d.t, q.top);
      if (w > 3 && h > 3) { recouvre.push(`${nom(el)} sur ${nom(t)}`); break; } }
  }
  // G (ter) : un bouton, une étiquette, un N° coupé par le bord de l'écran (le défilement de l'écran le cache : scrollWidth ne le voit pas)
  const horsCadre = [];
  for (const el of document.querySelectorAll('.n-bouton, [data-n-famille="second"], [data-n-famille="champ"], .n-pastille, .n-plaque, .n-segmente')) { if (!dans(el) || !vu(el)) continue; const q = el.getBoundingClientRect(); if (q.right > innerWidth + 1 || q.left < -1) horsCadre.push(nom(el)); }
  // D : orange / ambre ; rouge hors doublon
  const oranges = [], rouges = [];
  const LOGO = '.n-logo-site, [class*="logo"], [data-site-logo], img, picture, video, canvas, [data-n-doublon], [data-n-ton="doublon"], .vrm-logo';
  for (const el of document.querySelectorAll('body *')) {
    // une icône décorative (`aria-hidden`) a une couleur aussi : on la juge (seule la géométrie et la visibilité comptent ici)
    if (!dans(el) || el.closest(LOGO)) continue;
    { const q = el.getBoundingClientRect(); if (q.width < 3 || q.height < 3 || q.bottom < 0 || q.top > innerHeight || q.right < 0 || q.left > innerWidth) continue; if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue; if (el.closest('[hidden], [inert]')) continue; }
    const cs = getComputedStyle(el);
    const cs2 = [cs.color, cs.backgroundColor, cs.borderTopColor, cs.borderBottomColor, cs.outlineColor, cs.fill, cs.stroke, ...(cs.boxShadow.match(/rgba?\([^)]+\)/g) || []), ...arrets(cs.backgroundImage).map((c) => `rgba(${c.r},${c.g},${c.b},${c.a})`)];
    for (const s of cs2) { const c = parse(s); if (ambre(c)) { oranges.push(`${nom(el)} ${s}`); break; } if (rouge(c) && !el.closest('svg')) { rouges.push(`${nom(el)} ${s}`); break; } }
  }
  const rootCs = getComputedStyle(document.documentElement);
  return { style: document.documentElement.getAttribute('data-style') || '', theme: document.documentElement.getAttribute('data-theme'), fond: rootCs.getPropertyValue('--n-fond').trim(),
    nTextes, contraste: contraste.slice(0, 20), nContraste: contraste.length, nCibles, petites: petites.slice(0, 12), nPetites: petites.length, etrangers: [...new Set(etrangers)].slice(0, 12), nEtrangers: etrangers.length,
    chevauche: chevauche.slice(0, 8).concat(recouvre.slice(0, 8), horsCadre.slice(0, 8).map((x) => 'hors cadre : ' + x)), oranges: [...new Set(oranges)].slice(0, 8), rouges: [...new Set(rouges)].slice(0, 8), deborde: document.documentElement.scrollWidth - innerWidth };
};

// F : l'état enfoncé (forcé par le crochet du contrat natif `data-n-force="appui"`)
const APPUI = () => {
  const vu = (el) => { const r = el.getBoundingClientRect(); return r.width > 10 && r.height > 10 && r.top < innerHeight && r.bottom > 0; };
  const b = [...document.querySelectorAll('.vrm-main .n-bouton[data-n-variante="plein"]:not([aria-disabled="true"]), [data-fiche-paire] .n-bouton[data-n-variante="plein"]:not([aria-disabled="true"])')].find(vu)
    || [...document.querySelectorAll('.vrm-main .n-bouton:not([aria-disabled="true"]), [data-fiche-paire] .n-bouton:not([aria-disabled="true"])')].find(vu)
    || [...document.querySelectorAll('.vrm-main [data-n-famille="second"], .vrm-main [data-n-famille="rangee"]')].find(vu);
  if (!b) return { trouve: false };
  b.style.transition = 'none';
  const sous = (() => { for (let x = b.parentElement; x; x = x.parentElement) { const c = getComputedStyle(x).backgroundColor; if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c; } return getComputedStyle(document.body).backgroundColor; })();
  const compose = (c) => { const p = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); const v = m ? m[1].split(/[ ,/]+/).filter(Boolean).map(Number) : [0, 0, 0, 0]; return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
    const h = p(c), f = p(sous); return `rgb(${h.r * h.a + f.r * (1 - h.a)}, ${h.g * h.a + f.g * (1 - h.a)}, ${h.b * h.a + f.b * (1 - h.a)})`; };
  const lire = () => { const cs = getComputedStyle(b); const m = /matrix\(([^,]+),/.exec(cs.transform); return { echelle: m ? Number(m[1]) : 1, fond: compose(cs.backgroundColor) }; };
  const avant = lire(); b.setAttribute('data-n-force', 'appui'); const pendant = lire(); b.removeAttribute('data-n-force');
  const parse = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c || ''); const p = m ? m[1].split(/[ ,/]+/).filter(Boolean).map(Number) : [0, 0, 0]; return 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]; };
  const relLum = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c || ''); const p = m ? m[1].split(/[ ,/]+/).filter(Boolean).map(Number) : [0, 0, 0]; const t = p.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * t[0] + 0.7152 * t[1] + 0.0722 * t[2]; };
  return { trouve: true, variante: b.getAttribute('data-n-variante') || '', avant, pendant, plusFonce: parse(pendant.fond) < parse(avant.fond) - 1 || ((document.documentElement.getAttribute('data-theme') === 'dark' || relLum(avant.fond) < 0.02) && Math.abs(parse(pendant.fond) - parse(avant.fond)) > 1) };   // un plein déjà noir s'éclaircit   // la nuit, un plein CLAIR s'enfonce en s'assombrissant, un bouton texte en s'éclairant : un écart suffit
};

// B (pixels) : les boîtes à juger sur la capture
const BOITES = () => {
  // à l'écran ET au-dessus de tout (une fiche posée par-dessus la liste cache la liste)
  const vu = (el) => { const r = el.getBoundingClientRect(); if (!(r.width > 6 && r.height > 6 && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth && !el.closest('[aria-hidden="true"]'))) return false;
    const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!t && (el.contains(t) || t.contains(el)); };
  const sel = ['.n-bouton[data-n-variante="plein"] .n-bouton-libelle', '.n-pastille', '.n-plaque', '.n-grand-titre', '.n-rangee-titre', '.n-onglet[aria-current="page"] .n-onglet-libelle', '.n-segmente-choix[aria-checked="true"] .n-segmente-libelle', '.n-bouton[data-n-variante="teinte"] .n-bouton-libelle'];
  const out = [];
  for (const s of sel) { let n = 0; for (const el of document.querySelectorAll(s)) { if (!vu(el) || n >= 3) continue; const t = (el.innerText || '').trim(); if (t.length < 1) continue;
    // la boîte du TEXTE (une plage), pas celle de l'élément (une pilule a son propre fond)
    const rg = document.createRange(); rg.selectNodeContents(el); const r = rg.getBoundingClientRect(); if (r.width < 4 || r.height < 4) continue;
    const pad = s.includes('pastille') || s.includes('plaque') ? 1 : 0;
    out.push({ s, t: t.slice(0, 20), x: r.left - pad, y: r.top, w: r.width + 2 * pad, h: r.height }); n++; } }
  return out;
};
const PIXELS = async (args) => {
  const { png, boites, dsf } = args;
  const img = new Image(); img.src = 'data:image/png;base64,' + png; await img.decode();
  const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0);
  const lum = (r, g, b) => { const t = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * t[0] + 0.7152 * t[1] + 0.0722 * t[2]; };
  const res = [];
  for (const b of boites) {
    const x = Math.max(0, Math.floor(b.x * dsf)), y = Math.max(0, Math.floor(b.y * dsf)), w = Math.min(cv.width - x, Math.ceil(b.w * dsf)), h = Math.min(cv.height - y, Math.ceil(b.h * dsf));
    if (w < 3 || h < 3) continue;
    const d = cx.getImageData(x, y, w, h).data; const freq = new Map();
    for (let i = 0; i < d.length; i += 4) { const k = (d[i] >> 2) << 16 | (d[i + 1] >> 2) << 8 | (d[i + 2] >> 2); freq.set(k, (freq.get(k) || 0) + 1); }
    let bk = 0, bn = -1; for (const [k, n] of freq) if (n > bn) { bn = n; bk = k; }
    let fr = 0, fg = 0, fb = 0, nf = 0; for (let i = 0; i < d.length; i += 4) { const k = (d[i] >> 2) << 16 | (d[i + 1] >> 2) << 8 | (d[i + 2] >> 2); if (k === bk) { fr += d[i]; fg += d[i + 1]; fb += d[i + 2]; nf++; } }
    const lf = lum(fr / nf, fg / nf, fb / nf);
    // le texte : la luminance la plus éloignée du fond, sur les 2 % de pixels les plus extrêmes (pas un seul pixel de bruit)
    const ls = []; for (let i = 0; i < d.length; i += 4) ls.push(lum(d[i], d[i + 1], d[i + 2]));
    const clairFond = lf > 0.18; ls.sort((a, b) => a - b);
    const q = Math.max(0, Math.min(ls.length - 1, Math.floor(ls.length * 0.02)));
    const lt = clairFond ? ls[q] : ls[ls.length - 1 - q];
    const k = (Math.max(lt, lf) + 0.05) / (Math.min(lt, lf) + 0.05);
    res.push({ s: b.s, t: b.t, k: Math.round(k * 100) / 100 });
  }
  return res;
};

async function ouvrir(nav, { W, sombre, style, url, b }) {
  // l'apparence rangée dans la base aussi (sinon la synchronisation la ramène au clair sur un écran lent à charger)
  try { const d = b.main[0].data; d.vrm_apparence = sombre ? 'sombre' : 'clair'; d.vinted_dark = !!sombre; } catch (_) {}
  const o = await P.ouvrir(nav, { W, sombre, b, url, dsf: 2 });
  await o.pg.addInitScript(([st, sombre]) => { try { if (st) localStorage.setItem('vrm_style', JSON.stringify(st)); else localStorage.removeItem('vrm_style'); localStorage.setItem('vrm_apparence', JSON.stringify(sombre ? 'sombre' : 'clair')); } catch (_) {} }, [style, sombre]);
  await o.pg.reload({ waitUntil: 'domcontentloaded' });
  o.erreurs.length = 0;
  return o;
}
async function poserMutation(pg) {
  if (MUT === 'sansstyle') await pg.evaluate(() => document.documentElement.removeAttribute('data-style'));
  if (MUTATIONS[MUT]) await pg.addStyleTag({ content: MUTATIONS[MUT] });
  // « petit » : posé EN LIGNE (une feuille ajoutée perd devant les `!important` en couche de l'accessibilité)
  if (MUT === 'petit') await pg.evaluate(() => { for (const b of document.querySelectorAll('.n-bouton, .n-bouton-icone-seule, [data-n-famille="second"], [data-n-famille="champ"]')) { for (const [p, v] of [['min-height', '30px'], ['height', '30px'], ['min-width', '30px'], ['border-top-width', '0'], ['border-bottom-width', '0']]) b.style.setProperty(p, v, 'important'); } });
  if (MUT === 'deborde') await pg.evaluate(() => { const b = document.querySelector('.vrm-main .n-bouton, .vrm-main [data-n-famille="second"]'); if (b) b.style.setProperty('min-width', '640px', 'important'); });
  if (MUT === 'vieux') await pg.evaluate(() => { const m = document.querySelector('.vrm-main'); if (m) { const b = document.createElement('button'); b.className = 'vrm-btn vrm-btn-sec'; b.textContent = 'Ancien bouton'; b.style.cssText = 'display:block;min-height:44px;min-width:120px;margin:8px'; m.prepend(b); } });
}

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const b = base();
  try {
    for (const W of LARGEURS) for (const style of STYLES) for (const th of THEMES) {
      const sombre = th === 'sombre', tactile = W < 600;
      const attendu = style && G.PRESETS[style] ? G.PRESETS[style][sombre ? 'sombre' : 'clair'].fond : null;
      for (const e of ECRANS) {
        const cle = `${style || 'actuel'}-${th}-${e}-${W}`;
        console.log(`\n── ${cle}`);
        const o = await ouvrir(nav, { W, sombre, style, url: '/?tab=' + (e === 'fiche' ? 'annonces' : e), b });
        try {
          await o.pg.waitForSelector('.vrm-main', { timeout: 45000 }).catch(() => {});
          // la liste CHARGÉE (des N° à l'écran), pas son squelette : la machine des bancs est lente
          await o.pg.waitForFunction(() => document.querySelectorAll('.vrm-main .n-plaque').length >= 3, null, { timeout: 60000 }).catch(() => {});
          await o.pg.waitForTimeout(2500);
          if (e === 'fiche') {
            const c = await o.pg.evaluate(() => { for (const e of document.querySelectorAll('[data-fiche-ligne][data-fl-num], [data-eg-article]:not([data-eg-numero=""])')) { const r = e.getBoundingClientRect(); if (r.width < 40 || r.height < 30 || r.top < 110 || r.bottom > innerHeight - 110) continue;
              const x = Math.min(innerWidth - 8, r.left + Math.min(r.width * 0.5, 190)), y = r.top + r.height / 2; const t = document.elementFromPoint(x, y); if (t && e.contains(t)) return { x, y }; } return null; });
            if (c) { if (tactile) await o.pg.touchscreen.tap(c.x, c.y); else await o.pg.mouse.click(c.x, c.y); await o.pg.waitForSelector('[data-fiche-paire]', { timeout: 8000 }).catch(() => {}); await o.pg.waitForTimeout(1200); }
            dit(!!(await o.pg.$('[data-fiche-paire]')), `${cle} : la fiche de la paire est ouverte`);
          }
          await o.pg.evaluate(() => { for (const t of document.querySelectorAll('.vrm-toast, .n-toast')) t.remove(); });
          await poserMutation(o.pg); await o.pg.waitForTimeout(250);
          const m = await o.pg.evaluate(MESURE, { tactile });
          if (style) dit(m.style === style && attendu && m.fond.toUpperCase() === attendu.toUpperCase() && (m.theme === 'dark') === sombre, `A ${cle} : le style est appliqué (data-style, --n-fond ${attendu})`, { style: m.style, fond: m.fond, theme: m.theme });
          else dit(!m.style, `A ${cle} : sans choix, aucun style posé (le défaut inchangé)`, m.style);
          dit(m.nTextes > 5 && m.nContraste === 0, `B ${cle} : chaque texte tient 4,5:1 (3:1 en grand) — ${m.nTextes} textes`, m.contraste);
          const shot = await o.pg.screenshot();
          const boites = await o.pg.evaluate(BOITES);
          const px = await o.pg.evaluate(PIXELS, { png: shot.toString('base64'), boites, dsf: 2 });
          const pxKo = px.filter((p) => p.k < 4.5 - 0.05 && !(p.s === '.n-grand-titre' && p.k >= 3));
          dit(px.length >= 1 && !pxKo.length, `B ${cle} : sur les PIXELS, plein, étiquettes, N°, titres, onglet actif ≥ 4,5:1 — ${px.length} boîtes (min ${px.length ? Math.min(...px.map((p) => p.k)).toFixed(2) : '—'})`, pxKo.slice(0, 8));
          if (tactile && style) dit(m.nCibles > 5 && m.nPetites === 0, `C ${cle} : chaque cible ≥ 44 × 44 — ${m.nCibles} cibles`, m.petites);
          dit(!m.oranges.length && !m.rouges.length, `D ${cle} : aucune couleur orange/ambre, aucun rouge hors doublon`, { oranges: m.oranges, rouges: m.rouges });
          // E est une RÈGLE sur les trois écrans des captures de Julien ; ailleurs (Achats, Argent, Messages, Paramètres) le banc RAPPORTE
          // ce qui reste à rattacher (`data-n-famille`), sans rougir.
          if (style && PRINCIPAUX.has(e)) dit(m.nEtrangers === 0, `E ${cle} : chaque bouton est de la famille commune`, m.etrangers);
          else if (style && m.nEtrangers) console.log(`  ℹ️  E ${cle} : ${m.nEtrangers} bouton(s) d'avant à rattacher — ${m.etrangers.slice(0, 4).join(' · ')}`);
          if (style) { const a = await o.pg.evaluate(APPUI); dit(a.trouve && a.pendant.echelle < 0.999 && a.plusFonce, `F ${cle} : l'état enfoncé existe (échelle ${a.trouve ? a.pendant.echelle : '—'}, plus foncé)`, a); }
          dit(m.deborde <= 1 && !m.chevauche.length && !o.erreurs.length, `G ${cle} : rien ne déborde, rien ne se chevauche, aucune erreur`, { deborde: m.deborde, chevauche: m.chevauche, erreurs: o.erreurs });
          fs.writeFileSync(path.join(SHOTS, cle + '.png'), shot);
        } finally { await o.ctx.close(); }
      }
    }
    // Les tuiles d'aperçu de Paramètres → Apparence → Style : un toucher applique, « Actuel » revient.
    if (!process.env.SANS_TUILES) {
      console.log('\n── tuiles de Paramètres');
      const o = await ouvrir(nav, { W: 390, sombre: false, style: '', url: '/?tab=settings', b });
      try {
        await o.pg.waitForSelector('.vrm-main', { timeout: 45000 }).catch(() => {}); await o.pg.waitForTimeout(4000);
        // Paramètres → « Apparence et langue » → « Apparence » : on touche ce qui est à l'écran jusqu'à voir les tuiles
        const tuileVue = () => o.pg.evaluate(() => { const t = document.querySelector('[data-style-tuile="nuit"]'); if (!t) return false; t.scrollIntoView({ block: 'center' }); const r = t.getBoundingClientRect(); return r.width > 20 && r.height > 20; });
        for (let i = 0; i < 4 && !(await tuileVue()); i++) {
          await o.pg.evaluate(() => { const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 10 && r.height > 10; };
            const c = [...document.querySelectorAll('[data-reglage-apparence]')].find(vis) || [...document.querySelectorAll('button, [role="button"], a')].find((e) => vis(e) && /^Apparence( et langue)?$/i.test((e.innerText || '').trim().split('\n')[0]));
            if (c) { c.scrollIntoView({ block: 'center' }); c.click(); } });
          await o.pg.waitForTimeout(1200);
        }
        dit(await tuileVue(), `T les tuiles sont À L'ÉCRAN dans Paramètres → Apparence`);
        const n = await o.pg.$$eval('[data-style-tuile]', (x) => x.length);
        dit(n === 11, `T Paramètres → Apparence : 11 tuiles d'aperçu (Actuel + 10 styles)`, n);
        const t = await o.pg.$('[data-style-tuile="nuit"]');
        if (t) { const c = await t.evaluate((e) => { e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }); await o.pg.touchscreen.tap(c.x, c.y); await o.pg.waitForTimeout(300); }
        const apres = await o.pg.evaluate(() => ({ st: document.documentElement.getAttribute('data-style'), lu: localStorage.getItem('vrm_style'), fond: getComputedStyle(document.documentElement).getPropertyValue('--n-fond').trim() }));
        dit(apres.st === 'nuit' && apres.lu === '"nuit"' && apres.fond.toUpperCase() === G.PRESETS.nuit.clair.fond, `T un toucher sur « Nuit » l'applique tout de suite (sans recharger) et le range`, apres);
        await o.pg.screenshot({ path: path.join(SHOTS, 'tuiles-nuit.png') });
        const a = await o.pg.$('[data-style-tuile="actuel"]'); if (a) { const c = await a.evaluate((e) => { e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }); await o.pg.touchscreen.tap(c.x, c.y); await o.pg.waitForTimeout(300); }
        const retour = await o.pg.evaluate(() => ({ st: document.documentElement.getAttribute('data-style'), lu: localStorage.getItem('vrm_style'), fond: getComputedStyle(document.documentElement).getPropertyValue('--n-fond').trim() }));
        dit(retour.st === null && retour.lu === null && /^#DFE1E5$/i.test(retour.fond), `T « Actuel » revient au défaut en un toucher`, retour);
        const tailles = await o.pg.$$eval('[data-style-tuile]', (x) => x.map((e) => { const r = e.getBoundingClientRect(); return Math.min(r.width, r.height); }));
        dit(tailles.length && Math.min(...tailles) >= 44, `T chaque tuile est une cible ≥ 44`, tailles);
        await o.pg.screenshot({ path: path.join(SHOTS, 'tuiles-actuel.png') });
      } finally { await o.ctx.close(); }
    }
  } finally { await nav.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} styles-choix : ${ok} verts, ${ko} rouges — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
