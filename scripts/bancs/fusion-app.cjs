// BANC — « FUSION » PARTOUT (3 nov., critique #1–#15 ; Julien : « Fusion carte sombre »,
// « je déteste les textes explicatifs », « ça doit être exceptionnel »).
//
// Données INVENTÉES (le dépôt est public) : celles de `tous-boutons.cjs` (un compte
// Vinted, Leboncoin, eBay, Vestiaire), servies par SON harnais (aucune écriture n'a
// d'effet). Chaque écran est ouvert à 390 px tactile clair, 390 px tactile sombre et
// 1512 px clair. Sur chacun :
//   F1 PALETTE   — chaque couleur CALCULÉE (texte, fond, filet) d'un élément visible
//                  est un jeton Fusion (neutres #F2F2F7/#FFF/#1D1D1F/#6E6E73…, sombre
//                  #000/#1C1C1E/#2C2C2E…, bleu d'Apple, ambre, rouge) — jamais un gris
//                  chaud de Vitrine (#F5F5F3, #ECECE8, #0F0F0E, #56564F…) ; les logos,
//                  photos et pastilles de marque (≤ 24 px) sont hors palette, c'est voulu ;
//   F2 TEXTES    — aucun des textes explicatifs de l'inventaire « à supprimer » (rapport de
//                  critique du 3 nov.) n'est rendu ;
//   F3 UN NOM    — au téléphone la barre du haut ne redit pas le titre ; un seul grand titre ;
//   F4 PREMIER   — au téléphone, Annonces/Messages/Statistiques : le premier élément de la
//                  liste commence au-dessus de y = 300 (le premier tiers de 844) ;
//   F5 CIBLES    — au téléphone, chaque commande fait ≥ 44 px (hors lien dans une phrase) ;
//   F6 CONTRASTE — tout texte ≥ 4,5:1 (3:1 pour un grand texte) sur son fond réel ;
//   F7 DÉBORDE   — rien ne dépasse la largeur de l'écran ;
//   F8 ÉCHELLE   — tailles de police ∈ {11,12,13,15,17,20,22,28,34,38,44}, graisses ∈ {400…800} ;
//   F9 SÉLECTEUR — le choix du site est UN contrôle segmenté sur UNE rangée, rien de rogné,
//                  segment actif en aplat (blanc en clair, #636366 en sombre) ;
//   F10 ERREURS  — aucune erreur JS, aucun écran tombé sur le garde-fou.
// Juge des couleurs, des tailles, des positions et des nombres rendus ; F2 seul juge des
// phrases, puisque c'est son objet.
// Réglages : `BANC_PORT`, `BANC_ECRANS=<regex>`, `BANC_VUES=390-clair,390-sombre,1512-clair`,
// `CAPTURES=<dossier>`, `FUSION_MUTATION=1` (retire jetons.css de la page : le banc DOIT rougir).
'use strict';
const path = require('path');
const fs = require('fs');
const TB = require('./tous-boutons.cjs');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }

const FILTRE = process.env.BANC_ECRANS ? new RegExp(process.env.BANC_ECRANS) : null;
const VUES = (process.env.BANC_VUES || '390-clair,390-sombre,1512-clair').split(',');
const CAPTURES = process.env.CAPTURES || '';
const MUTATION = process.env.FUSION_MUTATION === '1';
let ok = 0, ko = 0; const rouges = [];
const dit = (c, m, d) => { if (c) { ok++; } else { ko++; rouges.push(m + (d ? ` — ${String(d).slice(0, 300)}` : '')); console.log(`  ✗ ${m}${d ? ` — ${String(d).slice(0, 300)}` : ''}`); } };

// ── Les jetons (src/design/jetons.css, src/design/fusion.css, src/themeMineral.js) ──
const JETONS = [
  // neutres clairs
  '#f2f2f7', '#ffffff', '#1d1d1f', '#6e6e73', '#8e8e93', '#aeaeb2', '#c7c7cc', '#d1d1d6', '#e5e5ea', '#000000', '#3a3a3c', '#f5f5f7',
  // neutres sombres
  '#1c1c1e', '#2c2c2e', '#38383a', '#636366', '#98989d', '#48484a',
  // remplissage d'iOS (118,118,128 en transparence)
  '#767680',
  // bleu d'Apple
  '#0071e3', '#0066cc', '#0062c4', '#0a84ff', '#409cff', '#5eb0ff', '#4a9bef', '#64b0ff', '#8db8f2', '#1f3a5f',
  // ambre (geste à faire) et rouge (deux articles sous un N°)
  '#ff9f0a', '#b25000', '#ffb340', '#fff4e5', '#2e2412', '#d70015', '#ff6961', '#ff3b30',
].map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
// Les phrases de l'inventaire « à supprimer » (rapport du 3 nov., actions S, G→, R ;
// hors page publique, Compta et l'accueil de Ma journée, traités ailleurs).
const INTERDITS = [
  "Aucune annonce reçue pour le moment. Ouvre « M", "Tes 6 annonces en ligne n'ont pas encore de nu", 'Montants à jour de ta dernière lecture Lebonco',
  'Je lis tes annonces programmées chez eBay…', "Pas encore d'annonce eBay en ligne. Connecte t", 'Tes paires en vente, avec leur numéro.',
  'Pour mettre tes photos sur fond blanc, avec ton', "C'est ton compte Photoroom qui paie, à la phot", "Leboncoin et eBay gardent tes photos d'origine",
  "Qui les a mis en favori, Vestiaire ne l'a jama", "Aucun article en ligne et numéroté pour l'inst", "L'extension ouvre Vestiaire (clique « Vendre u",
  "C'est l'extension, dans le Chrome de ton ordin", "c'est là que tourne l'extension qui", "Extension VRM pas détectée dans ce navigateur —",
  "Installe l'extension Chrome puis ouvre vinted.", "n'est comptée dans aucun total (vendu, chiffre", 'ouvre la vente sur Vestiaire, il arrive ici',
  "je n'ai pas pu lire tes retours eBay — un reto", "Ventes eBay : l'étiquette se prend dans eBay (", "L'étiquette se prend dans eBay : elle est prép",
  'n’a pas encore été lue.', 'l’extension y lit le point et le code', "Tant qu'aucun compte n'est relié, VRM ne lit r",
  'La fiche de la paire s’affiche ici quand tu ouv', 'Vérifie ta connexion, ou que ton compte Vinted', 'Messages, offres et suivi de colis.',
  'Touche-en une pour la lire', 'au dernier relevé',
  'Réponds aux acheteurs et à leurs offres.', 'Aucune paire numérotée en stock. Donne un numé', "Grisés : ils demandent l'extension VRM",
  'Finalisé par plateforme et par compte, mois pa', 'Marges par marque, temps de vente, jours et he', 'qui dorment : ouvre Annonces une fois',
  'Il se calcule avec le relevé de tes ventes', 'Aucune vente boostée connue sur la période. Vi', 'Vendu : toutes tes plateformes, au jour de la',
  'ouvre Ventes une fois', 'Les reçus Vinted arrivent par email, à l\'adress', 'Ventes et factures, quand l’app est ouverte.',
  'Le N° se pose dans un espace blanc du PDF', 'fais-en une pour protéger tes données', 'Sans les PDF de bordereau ni tes connexions',
  'Floute pseudos, emails et codes pour filmer to', 'Tes comptes, tes emails et l’affichage.', 'Associe l’adresse qui reçoit ses emails Vinted.',
  'Trouve les revendeurs VRM de ta ville et échan', 'Ça ne veut pas dire que personne n’y est.', 'Réponse eBay incomplète. Réessaie la lecture.',
  "je ne propose rien qui soit peut-être déjà vendu", 'Réglages gardés sur cet appareil seulement (pas',
];
// Les écrans (liens profonds du harnais de tous-boutons).
const ECRANS = [
  { nom: 'journee', url: '?tab=journee' },
  ...['vinted', 'leboncoin', 'ebay', 'vestiaire'].map((s) => ({ nom: 'annonces.' + s, url: '?tab=annonces&site=' + s, premier: s === 'vinted' ? '.vrm-ann-card' : null })),
  ...['toutes', 'vinted', 'leboncoin', 'ebay', 'vestiaire'].map((s) => ({ nom: 'ventes.' + s, url: '?tab=ventes&site=' + s })),
  { nom: 'ventes.ebay.agent', url: '?tab=plat_ebay&section=agent' },
  ...['vinted', 'leboncoin', 'ebay', 'vestiaire'].map((s) => ({ nom: 'messages.' + s, url: '?tab=messages&site=' + s, premier: s === 'vinted' ? '.vrm-message-workspace' : null })),
  // (Messages → Favoris : refait par un autre chantier, `claude/favoris-fusion` — hors de ce banc.)
  ...['vinted', 'leboncoin', 'ebay', 'vestiaire'].map((s) => ({ nom: 'achats.' + s, url: '?tab=achats&site=' + s })),
  { nom: 'colis', url: '?tab=cat_bord' },
  { nom: 'stock', url: '?tab=garage' },
  { nom: 'statistiques', url: '?tab=dashboard', premier: '[data-sv-tuile]' },
  { nom: 'comptabilite', url: '?tab=compta' },
  { nom: 'comptabilite.factures', url: '?tab=compta&section=factures' },
  { nom: 'communaute', url: '?tab=communaute' },
  { nom: 'comptes-lies', url: '?tab=vintedaccounts' },
  { nom: 'parametres', url: '?tab=settings' },
];

// ── La mesure, dans la page ─────────────────────────────────────────────────
const MESURE = ([JET, INTER]) => {
  const vw = innerWidth;
  const main = document.querySelector('.vrm-main') || document.body;
  const vis = (e) => { const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && c.display !== 'none' && Number(c.opacity) > 0.05 && r.bottom > 0 && r.top < innerHeight * 6; };
  const rgb = (s) => { const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(s || ''); return m ? [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]] : null; };
  const pres = (c) => JET.some((j) => Math.abs(j[0] - c[0]) + Math.abs(j[1] - c[1]) + Math.abs(j[2] - c[2]) <= 12);
  const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  // Hors palette, c'est voulu : photos, logos, marques (≤ 24 px), cartes, graphiques, la visite.
  const horsPalette = (e) => e.closest('img, svg, canvas, video, picture, .maplibregl-map, [data-transporteur-logo], [class*="logo"], [class*="Logo"], .vrm-photo, [class*="photo"], [data-fiche-photo], .vrm-cm-carte, .vrm-visite');
  const marque = (e) => { const r = e.getBoundingClientRect(); return r.width <= 24 && r.height <= 24; };
  const fondDe = (e) => {
    for (let x = e; x; x = x.parentElement) {
      const c = getComputedStyle(x); const b = rgb(c.backgroundColor);
      if (c.backgroundImage && /gradient/.test(c.backgroundImage)) { const m = /rgba?\([^)]*\)/.exec(c.backgroundImage); if (m) return rgb(m[0]); }
      if (b && b[3] > 0.6) return b;
    }
    return rgb(getComputedStyle(document.body).backgroundColor) || [255, 255, 255, 1];
  };
  const couleurs = [], contrastes = [], tailles = new Set(), graisses = new Set(), tHors = [], gHors = [];
  const vus = new Set();
  const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const t = walker.currentNode; if (!t.textContent.trim()) continue; const e = t.parentElement;
    if (!e || vus.has(e) || !vis(e) || e.closest('svg, script, style, [hidden], .vrm-visite, .vrm-fu-sr')) continue; vus.add(e);
    const c = getComputedStyle(e); const fs = parseFloat(c.fontSize); const fw = Number(c.fontWeight);
    const okT = [11, 12, 13, 15, 17, 20, 22, 28, 34, 38, 44].some((v) => Math.abs(v - fs) < 0.6) || fs < 9 || fs > 48 || e.closest('.vrm-fu-grand');
    if (!okT) tHors.push(`${fs}px « ${t.textContent.trim().slice(0, 24)} »`);
    if (![400, 500, 600, 700, 800].includes(fw)) gHors.push(`${fw} « ${t.textContent.trim().slice(0, 24)} »`);
    const fg = rgb(c.color); const bg = fondDe(e);
    if (fg && !horsPalette(e) && !pres(fg)) couleurs.push(`texte ${c.color} « ${t.textContent.trim().slice(0, 24)} »`);
    if (fg && bg) {
      const a = fg[3]; const mix = [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a)); const r = ratio(mix, bg);
      const grand = fs >= 24 || (fs >= 18.66 && fw >= 700);
      const desactive = e.closest('[disabled], [aria-disabled="true"]');
      if (!desactive && !horsPalette(e) && r < (grand ? 3 : 4.5) - 0.05) contrastes.push(`${r.toFixed(2)}:1 ${fs}px « ${t.textContent.trim().slice(0, 30)} » ${c.color} sur rgb(${bg.slice(0, 3).map(Math.round).join(',')})`);
    }
  }
  for (const e of main.querySelectorAll('*')) {
    if (!vis(e) || horsPalette(e) || e.closest('.vrm-visite')) continue;
    const c = getComputedStyle(e);
    const b = rgb(c.backgroundColor); if (b && b[3] > 0.05 && !pres(b) && !marque(e)) couleurs.push(`fond ${c.backgroundColor} <${e.tagName.toLowerCase()} class="${String(e.className).slice(0, 40)}">`);
    if (parseFloat(c.borderTopWidth) > 0 && c.borderTopStyle !== 'none') { const bd = rgb(c.borderTopColor); if (bd && bd[3] > 0.2 && !pres(bd) && !marque(e)) couleurs.push(`filet ${c.borderTopColor} <${e.tagName.toLowerCase()} class="${String(e.className).slice(0, 40)}">`); }
  }
  // F2 les phrases interdites (texte rendu, sans les infobulles)
  const texte = (main.innerText || '').replace(/\s+/g, ' ');
  const norm = (s) => s.replace(/[’']/g, "'").replace(/\s+/g, ' ');
  const tn = norm(texte);
  const interdits = INTER.filter((p) => tn.includes(norm(p)));
  // F3 un nom
  const h1s = [...document.querySelectorAll('.vrm-main h1, .vrm-main h2.vrm-set-h1')].filter(vis).map((h) => h.innerText.trim()).filter(Boolean);
  const tete = document.querySelector('.vrm-app-header');
  const teteTxt = tete && vis(tete) ? [...tete.querySelectorAll('.vrm-hdr-titre, .vrm-header-logo, .vrm-hdr-entreprise')].filter(vis).map((x) => x.innerText.trim() || 'logo') : [];
  // F5 cibles
  const sel = 'button, a[href], [role="button"], [role="tab"], [role="switch"], summary, select, input[type=checkbox], input[type=radio]';
  const petites = [];
  for (const e of main.querySelectorAll(sel)) {
    if (!vis(e) || e.closest('[hidden], .vrm-visite, svg')) continue;
    const r = e.getBoundingClientRect(); const c = getComputedStyle(e);
    const parent = e.parentElement; const enLigne = c.display === 'inline' && parent && (parent.innerText || '').trim().length > (e.innerText || '').trim().length + 8;
    if (enLigne || e.matches('.vrm-lien-texte, [data-vrm-lien-texte]')) continue;
    if (e.matches('input[type=checkbox], input[type=radio]') && e.closest('label')) { const lr = e.closest('label').getBoundingClientRect(); if (lr.height >= 43.5) continue; }
    if (r.height < 43.5 || r.width < 43.5) petites.push(`${Math.round(r.width)}×${Math.round(r.height)} « ${(e.getAttribute('aria-label') || e.innerText || e.className || '').toString().replace(/\s+/g, ' ').trim().slice(0, 30)} »`);
  }
  // F7 débordement
  const deb = document.documentElement.scrollWidth - vw;
  const scrollers = (e) => { for (let x = e.parentElement; x && x !== document.body; x = x.parentElement) { const ox = getComputedStyle(x).overflowX; if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') return true; } return false; };
  const dehors = [...main.querySelectorAll('*')].filter((e) => vis(e) && getComputedStyle(e).position !== 'fixed' && e.getBoundingClientRect().right > vw + 1 && !scrollers(e)).slice(0, 4).map((e) => `<${e.tagName.toLowerCase()} class="${String(e.className).slice(0, 30)}">`);
  // F9 sélecteur de site
  const sites = [...main.querySelectorAll('.vrm-filtre-site')].filter(vis).map((g) => {
    const bs = [...g.children].filter(vis); const tops = new Set(bs.map((b) => Math.round(b.getBoundingClientRect().top)));
    const coupes = bs.filter((b) => b.scrollWidth > b.clientWidth + 1).map((b) => b.innerText);
    const actif = bs.find((b) => b.getAttribute('aria-pressed') === 'true');
    const gr = g.getBoundingClientRect();
    return { rangees: tops.size, coupes, actifFond: actif ? getComputedStyle(actif).backgroundColor : null, deborde: gr.right > vw + 1 || g.scrollWidth > g.clientWidth + 1, h: Math.round(gr.height) };
  });
  return { couleurs: [...new Set(couleurs)], contrastes, interdits, h1s, teteTxt, petites, deb, dehors, sites, tHors: [...new Set(tHors)], gHors: [...new Set(gHors)],
    tombe: /pas pu s'afficher|Minified React error/.test(document.body.innerText) };
};
const PREMIER = (s) => { const e = [...document.querySelectorAll(s)].find((x) => x.getClientRects().length && x.getBoundingClientRect().height > 0); return e ? Math.round(e.getBoundingClientRect().top) : null; };

(async () => {
  await TB.demarrer();
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    for (const vue of VUES) {
      const tel = vue.startsWith('390'); const sombre = vue.endsWith('sombre');
      console.log(`\n── ${vue}`);
      for (const E of ECRANS) {
        if (FILTRE && !FILTRE.test(E.nom)) continue;
        const T = `${vue} ${E.nom}`;
        const { ctx, pg, etat } = await TB.ouvrirPage(b, tel);
        await pg.addInitScript((s) => { try { localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_visite_vue', JSON.stringify(true)); } catch (_) {} }, sombre);
        if (MUTATION) await pg.addInitScript(() => { const tue = () => { for (const s of document.querySelectorAll('style')) if (/JETONS FUSION|--t-11/.test(s.textContent)) s.textContent = ''; for (const sh of document.styleSheets) { try { for (let i = sh.cssRules.length - 1; i >= 0; i--) if (/:root:root body/.test(sh.cssRules[i].cssText)) sh.deleteRule(i); } catch (_) {} } }; addEventListener('DOMContentLoaded', tue); setInterval(tue, 300); });
        await pg.goto(`http://localhost:${TB.PORT}/${E.url}`, { waitUntil: 'domcontentloaded' });
        await TB.attendreCoque(pg);
        await pg.waitForTimeout(900);
        const m = await pg.evaluate(MESURE, [JETONS_PLATS, INTERDITS]);
        if (CAPTURES) { fs.mkdirSync(CAPTURES, { recursive: true }); await pg.screenshot({ path: path.join(CAPTURES, `fusion-app-${vue}-${E.nom}.png`) }); }
        dit(!m.tombe && !etat.errs.length, `${T} F10 aucune erreur, écran rendu`, etat.errs[0]);
        dit(!m.couleurs.length, `${T} F1 palette : toutes les couleurs sont des jetons Fusion`, m.couleurs.slice(0, 6).join(' ¦ '));
        dit(!m.interdits.length, `${T} F2 aucun texte explicatif de l'inventaire`, m.interdits.join(' ¦ '));
        if (tel) dit(!m.teteTxt.length && m.h1s.length <= 1, `${T} F3 un seul nom : la barre du haut ne redit pas le titre`, `barre : ${m.teteTxt.join(',')} · titres : ${m.h1s.join(',')}`);
        if (tel && E.premier) { const y = await pg.evaluate(PREMIER, E.premier); dit(y != null && y < 300, `${T} F4 le premier élément de la liste commence au-dessus de y = 300`, `y = ${y}`); }
        if (tel) dit(!m.petites.length, `${T} F5 chaque commande fait au moins 44 px`, `${m.petites.length} : ${m.petites.slice(0, 5).join(' ¦ ')}`);
        dit(!m.contrastes.length, `${T} F6 contraste ≥ 4,5:1`, `${m.contrastes.length} : ${m.contrastes.slice(0, 4).join(' ¦ ')}`);
        dit(m.deb <= 1 && !m.dehors.length, `${T} F7 rien ne déborde`, `${m.deb} px · ${m.dehors.join(' ')}`);
        dit(!m.tHors.length && !m.gHors.length, `${T} F8 tailles et graisses sur l'échelle`, [...m.tHors.slice(0, 4), ...m.gHors.slice(0, 3)].join(' ¦ '));
        for (const s of m.sites) {
          const fond = /rgb\((\d+), (\d+), (\d+)/.exec(s.actifFond || '') || [];
          const attendu = sombre ? [99, 99, 102] : [255, 255, 255];
          const fondOk = fond.length && attendu.every((v, i) => Math.abs(v - Number(fond[i + 1])) <= 3);
          dit(s.rangees === 1 && !s.coupes.length && !s.deborde && s.h >= 43.5 && fondOk, `${T} F9 le site se choisit dans un contrôle segmenté (une rangée, rien de rogné, actif en aplat)`, JSON.stringify(s));
        }
        await ctx.close();
      }
    }
  } finally { await b.close(); process.exit(ko ? 1 : 0); }
})().catch((e) => { console.error(e); process.exit(2); });
const JETONS_PLATS = JETONS;
process.on('exit', () => { console.log(`\n${ko ? '❌' : '✅'} fusion-app : ${ok} vert(s), ${ko} rouge(s)${MUTATION ? ' (mutation : jetons.css retiré)' : ''}`); });
