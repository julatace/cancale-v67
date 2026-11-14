require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));   // heures calmes : midi (Paris)
require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  LA REFONTE VISIBLE DES SITES ET DES RÉGLAGES (14 nov.) — ce qu'on MESURE.
//  Récit : docs/passation/2026-11-14-refonte-plateformes-reglages.md.
//
//  Julien (14 nov., AJOUT 3, captures annonces-haut/bas) : « Regarde, c'est pas beau
//  du tout : les couleurs, les formes, les boutons. » Les règles, sur l'app RENDUE :
//    L liste      — sur un écran de liste (Annonces · Leboncoin / eBay / Vestiaire,
//                   Paramètres), la 1re ligne de la liste est visible sur le PREMIER
//                   écran d'iPhone (390 × 844), son haut à 50 % au plus (≤ 422 px) ;
//    V carteVide  — aucune carte dont la valeur principale est « — » (un « — » écrit en
//                   20 px ou plus : « Qui dorment — », « En cours — ») ;
//    A plein      — au plus UN bouton plein à l'accent visible sur le premier écran ;
//    G capsules   — aucune rangée de plus de 3 capsules GRISES de 44 px ou plus côte à
//                   côte (sans défilement) : les filtres sont de petites capsules blanches,
//                   la choisie à l'encre ;
//    B bandeau    — aucun bandeau flottant posé au-dessus de la barre du bas après 3 s ;
//    R reglages   — chaque réglage d'AVANT (`INVENTAIRE`, relevé sur origin/main) reste
//                   joignable : sa ligne `[data-sous-ouvrir]` ou son attribut existe dans
//                   l'une des trois vues de Paramètres (Réglages, Mon compte, Abonnement).
//  Plus la mesure des passes design (A–I de `design-passe.cjs`, J de `design-passe-2.cjs`) :
//  la fonction de ces bancs, rien de recopié (cibles 44/36, graisses, tailles, gris, contraste…).
//  Écrans : leboncoin-annonces, ebay-annonces, vestiaire-annonces, leboncoin-ventes,
//  ebay-ventes, vestiaire-ventes, reglages, connexion, accueil, exemple, demarrage, parcours.
//  390 tactile ET 1512, clair ET sombre. Base INVENTÉE (`design-passe-2.cjs` `baseSites`),
//  garde réseau. `ECRANS=` `LARGEURS=` `THEMES=` ; `BANC_DIST=` (avant/après) ; `SHOTS=` ;
//  `DSF=2` : captures en deviceScaleFactor 2 (celles qu'on montre à Julien).
//  Un banc ne meurt pas, il rapporte. Preuve : rouge sur origin/main, vert après ;
//  `MUTATION=1` remet la 1re ligne sous la ligne de flottaison (doit rougir).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const P = require('./design-passe.cjs');
const D2 = require('./design-passe-2.cjs');
const { chromium } = P;
const { lancer, baseSites, baseNeuve, toucher, attendre, APP } = D2;

// deviceScaleFactor 2 pour les captures à montrer (le banc mesure pareil).
if (process.env.DSF) {
  const lancerNav = chromium.launch.bind(chromium);
  chromium.launch = async (...a) => { const nav = await lancerNav(...a); const nc = nav.newContext.bind(nav); nav.newContext = (o = {}) => nc({ ...o, deviceScaleFactor: Number(process.env.DSF) || 1 }); return nav; };
}

// ── L'inventaire des réglages d'AVANT (origin/main, 14 nov.) : chaque ligne `data-sous-ouvrir`
//    et chaque attribut d'un réglage, par vue. Relevé par `INVENTAIRE=1` sur le build d'avant. ──
const INVENTAIRE = require('./_inventaire-reglages.json');

const LISTES = {
  'leboncoin-annonces': '[data-lbc-catalog-id]',
  'ebay-annonces': '[data-ebay-annonce]',
  'vestiaire-annonces': '[data-vc-annonce]',
  reglages: '[data-onglets-reglages] ~ * .vrm-set-ligne, .vrm-set-groupe .vrm-set-ligne',
};
const CLES = ['liste', 'carteVide', 'plein', 'capsules', 'bandeau', 'reglages'];

// ── La mesure, DANS la page. ──
function mesurerAjout3({ selListe, mutation }) {
  const H = window.innerHeight, W = window.innerWidth;
  const out = { liste: [], carteVide: [], plein: [], capsules: [], bandeau: [] };
  const vis = (el) => { if (!el || !el.isConnected) return false; if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false; if (el.closest('[inert], [hidden], .vrm-sr, .vrm-sr-only, .sr-only')) return false; const r = el.getBoundingClientRect(); return r.width >= 2 && r.height >= 2; };
  const rgba = (s) => { const t = String(s || ''); const c = t.match(/color\(srgb ([^)]+)\)/); if (c) { const p = c[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0] * 255, g: p[1] * 255, b: p[2] * 255, a: p.length > 3 ? p[3] : 1 }; } const m = t.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const hsl = (c) => { const r = c.r / 255, g = c.g / 255, b = c.b / 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); const l = (mx + mn) / 2; if (mx === mn) return { h: 0, s: 0, l }; const d = mx - mn; const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return { h: h * 60, s, l }; };
  const nom = (el) => `${el.tagName.toLowerCase()}${typeof el.className === 'string' && el.className ? '.' + el.className.split(/\s+/).slice(0, 2).join('.') : ''} « ${(el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40)} »`;
  const fondDe = (el) => { const cs = getComputedStyle(el); let c = rgba(cs.backgroundColor); if (c && c.a > 0.05) return c; const av = getComputedStyle(el, '::before'); if (av && av.content !== 'none') { c = rgba(av.backgroundColor); if (c && c.a > 0.05) return c; } return null; };
  // L. La 1re ligne de la liste.
  if (selListe) {
    const l = [...document.querySelectorAll(selListe)].find(vis);
    if (!l) out.liste.push({ quoi: 'aucune ligne de liste rendue', sel: selListe });
    else { const t = Math.round(l.getBoundingClientRect().top + (mutation ? H : 0)); if (t > H * 0.5) out.liste.push({ top: t, max: Math.round(H * 0.5), quoi: nom(l) }); }
  }
  const dansEcran = (r) => r.bottom > 0 && r.top < H && r.right > 0 && r.left < W;
  // V. Une carte dont la valeur principale est « — ».
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if ((n.nodeValue || '').trim() !== '—') continue;
    const el = n.parentElement; if (!el || !vis(el)) continue;
    if (el.closest('.vrm-ui-voile, .vrm-fs, [role="dialog"]')) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs >= 20 && dansEcran(el.getBoundingClientRect())) out.carteVide.push({ fs, quoi: nom(el.parentElement || el) });
  }
  // A. Les boutons pleins à l'accent (bleu), sur le premier écran.
  for (const el of document.querySelectorAll('button, a, [role="button"], input[type="submit"]')) {
    if (!vis(el) || el.closest('.vrm-ui-voile, [role="dialog"], .vrm-fs, svg')) continue;
    const r = el.getBoundingClientRect(); if (r.height < 28 || r.width < 28 || !dansEcran(r)) continue;
    const c = fondDe(el); if (!c || c.a < 0.6) continue;
    const h = hsl(c);
    if (h.s > 0.55 && h.h >= 195 && h.h <= 225 && h.l > 0.3 && h.l < 0.7) out.plein.push({ quoi: nom(el), fond: `rgb(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)})` });
  }
  if (out.plein.length <= 1) out.plein = []; else out.plein = out.plein.map((x, i) => ({ ...x, n: i + 1 }));
  // G. Des rangées de capsules grises ≥ 44 px (plus de trois côte à côte, visibles sans défiler).
  const capsules = [];
  for (const el of document.querySelectorAll('button, a, [role="button"], [role="tab"], label, summary')) {
    if (!vis(el) || el.closest('.vrm-ui-voile, [role="dialog"], .vrm-fs, nav, .vrm-bottom-nav, .vrm-tabbar')) continue;
    const r = el.getBoundingClientRect(); if (r.height < 43.5 || !dansEcran(r) || r.right > W + 1 || r.left < -1) continue;
    const cs = getComputedStyle(el); const rad = parseFloat(cs.borderTopLeftRadius) || 0;
    const c = fondDe(el); if (!c || c.a < 0.04) continue;
    const h = hsl(c); const neutre = h.s < 0.12;
    const blanc = h.l > 0.97 && c.a > 0.9, encre = h.l < 0.16 && c.a > 0.9;
    if (!neutre || blanc || encre) continue;
    if (rad < Math.min(r.height, 52) / 2 - 2 && rad < 12) continue;
    capsules.push({ el, top: Math.round(r.top), par: el.parentElement });
  }
  const groupes = new Map();
  for (const c of capsules) { const k = c.top + '|' + Math.round(c.par ? c.par.getBoundingClientRect().left : 0); if (!groupes.has(k)) groupes.set(k, []); groupes.get(k).push(c); }
  for (const [k, g] of groupes) if (g.length > 3) out.capsules.push({ n: g.length, rangee: k, quoi: g.slice(0, 4).map((x) => nom(x.el)).join(' | ') });
  // B. Un bandeau flottant au-dessus de la barre du bas.
  const barre = document.querySelector('.vrm-bottom-nav, nav.vrm-nav, .vrm-tabbar');
  const hautBarre = barre && vis(barre) ? barre.getBoundingClientRect().top : H;
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el); if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
    if (cs.position === 'sticky') continue;
    if (!vis(el) || el === barre || (barre && (barre.contains(el) || el.contains(barre)))) continue;
    if (el.closest('.vrm-ui-voile, [role="dialog"], .vrm-fs, .vrm-app-header, header, [role="banner"]')) continue;
    const r = el.getBoundingClientRect(); if (r.height < 28 || r.width < W * 0.4) continue;
    if (!(el.innerText || '').trim()) continue;
    if (r.top > H * 0.55 && r.bottom <= hautBarre + 2 && r.bottom > H * 0.6) out.bandeau.push({ quoi: nom(el), top: Math.round(r.top) });
  }
  return out;
}

// R. Les réglages d'avant, joignables (les trois vues).
async function reglagesJoignables(o) {
  const vus = new Set();
  for (const vue of ['reglages', 'compte', 'abonnement']) {
    await toucher(o, '[data-sous-retour]'); await o.pg.waitForTimeout(200);
    await toucher(o, `[data-onglets-reglages] [data-vue="${vue}"]`); await o.pg.waitForTimeout(500);
    const l = await o.pg.evaluate(() => {
      const r = new Set();
      for (const el of document.querySelectorAll('[data-sous-ouvrir]')) r.add('sous:' + el.getAttribute('data-sous-ouvrir'));
      for (const el of document.querySelectorAll('.vrm-set-ligne, [data-sous-ecran]')) for (const a of el.attributes) if (/^data-reglage-/.test(a.name)) r.add('attr:' + a.name);
      for (const el of document.querySelectorAll('[data-sous-ecran]')) r.add('ecran:' + el.getAttribute('data-sous-ecran'));
      return [...r];
    });
    l.forEach((x) => vus.add(x));
  }
  await toucher(o, '[data-onglets-reglages] [data-vue="reglages"]');
  return vus;
}

const E = (nom, url, extra = {}) => ({ nom, url, ...extra });
const ECRANS = [
  E('leboncoin-annonces', '/?tab=annonces&site=leboncoin', { base: baseSites }),
  E('ebay-annonces', '/?tab=annonces&site=ebay', { base: baseSites }),
  E('vestiaire-annonces', '/?tab=annonces&site=vestiaire', { base: baseSites }),
  E('leboncoin-ventes', '/?tab=ventes&site=leboncoin', { base: baseSites }),
  E('ebay-ventes', '/?tab=ventes&site=ebay', { base: baseSites }),
  E('vestiaire-ventes', '/?tab=ventes&site=vestiaire', { base: baseSites }),
  E('reglages', '/?tab=settings', { attendre: '[data-onglets-reglages]' }),
  E('connexion', '/?connexion', { sansSession: true, attendre: '[data-auth-valider]', racines: ['body'], ciblesEnPlus: 'a[data-retour-accueil], a[data-cta]' }),
  E('accueil', '/', { sansSession: true, attendre: '[data-accueil]', racines: ['[data-accueil]'], vitrine: true, ciblesEnPlus: 'a[data-cta], a[data-cta-nav]' }),
  E('exemple', '/?exemple', { sansSession: true, attendre: '[data-exemple-bandeau]', racines: APP }),
  E('demarrage', '/?tab=journee', { base: () => baseNeuve(false), attendre: '[data-parcours-carte]', racines: ['[data-parcours-carte]'] }),
  E('parcours', '/?tab=journee', { base: () => baseNeuve(true), attendre: '[data-parcours]', racines: ['[data-parcours]'] }),
];
// Les écrans d'Ajout 3 (une liste) : la règle L.
const enPlus = async (o, Ex, sous, racines, { W }) => {
  await o.pg.waitForTimeout(3200);   // B : après 3 s
  const selListe = W < 600 ? LISTES[Ex.nom] || null : null;
  const m = await o.pg.evaluate(mesurerAjout3, { selListe, mutation: !!process.env.MUTATION });
  m.reglages = [];
  if (Ex.nom === 'reglages') {
    const vus = await reglagesJoignables(o);
    if (process.env.INVENTAIRE) require('fs').writeFileSync(require('path').join(__dirname, '_inventaire-reglages.json'), JSON.stringify([...vus].sort(), null, 1) + '\n');
    for (const x of INVENTAIRE) if (!vus.has(x)) m.reglages.push({ manque: x });
  }
  return m;
};
module.exports = { mesurerAjout3, ECRANS, LISTES };
if (require.main === module) lancer(ECRANS, { cles: [...P.CLES, 'numDouble', ...CLES], nomRapport: 'rapport-refonte-pr.json', enPlus }).catch((e) => { console.error(e); process.exit(2); });
