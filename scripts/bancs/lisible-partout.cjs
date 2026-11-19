// ════════════════════════════════════════════════════════════════════════════
//  BANC « LISIBLE PARTOUT » (19 nov., Julien : « sur l'app en mobile c'est pas fou du tout, même sur ordi là
//  c'est une catastrophe, l'ergonomie est atroce »). Récit : docs/passation/2026-11-19-lisible-partout.md
//
//  Cause mesurée : le 18 nov. au soir, l'habillage par défaut « VRM » (src/designV2/interface/vrm-*.css) a posé un
//  fond CLAIR sous des écrans dont les textes étaient écrits en BLANC pour le bleu nuit du « Verre dépoli ».
//  Aucun banc n'ouvrait TOUS les écrans dans TOUS les habillages : celui-ci le fait.
//
//  Il ouvre CHAQUE écran et sous-écran joignable (Aujourd'hui / Ma journée, Annonces, Ventes, Achats, Stock,
//  Messages, E-mails, Argent, Paramètres — chaque catégorie, chaque sous-page —, Communauté, la cloche, la loupe,
//  les feuilles « ⋯ », la connexion) à 390 × 844 tactile, 1512 et 1280, en clair et en sombre, dans les trois
//  habillages d'AVANT : `vrm` (le défaut du 18 nov.), `apple` (`data-theme-style="apple"`), `ancien` (`vrm_design_v2` = '0').
//
//  Ce qu'il MESURE, sur l'app RENDUE (jamais dans le code) :
//    C  CONTRASTE — chaque texte visible ≥ 4,5:1 (3:1 en grand : ≥ 24 px, ou ≥ 18,66 px en 700) contre le fond
//       TEL QU'IL S'AFFICHE : le texte est rendu transparent, une capture, et on lit les PIXELS sous le cadre de
//       chaque ligne (translucides, dégradés, ::before, photos compris — plus fidèle qu'une pile d'ancêtres).
//       Le pire des deux bouts du fond sous le texte (20e et 80e centile de luminance) fait foi.
//    I  ICÔNE — toute icône porteuse de sens (seule dans un bouton, un lien, un onglet) ≥ 3:1, mesurée sur ses
//       pixels (capture avec, capture sans) ; une icône qui ne dessine rien est dite « invisible ».
//    V  VIDE — aucun élément interactif visible sans rien dedans (ni texte, ni icône, ni image).
//    D  DÉBORDEMENT — rien ne dépasse à l'horizontale (page, contenu, élément hors de l'écran).
//    T  TEXTE COUPÉ — aucun texte rogné par son cadre (hors « … » d'une rangée de liste et hors `line-clamp`).
//    B  BARRE DU BAS (téléphone) — en bas de page, aucun contenu ne reste sous la barre d'onglets.
//    G  DÉGRADÉ BLEU — plus aucun (19 nov., « VRM natif ») : ni le fond, ni le ::before de la coque, ni une surface
//       de plus de 40 × 40 (repris du banc theme-apple, retiré avec le réglage « Style »).
//    F  FLOU — `backdrop-filter` sur la barre d'onglets et la barre de titre seulement (contrat §1) : aucun dans le contenu.
//    Z  CIBLES (téléphone) — tout élément interactif fait 44 × 44 (zone étendue ::before/::after comptée ; un
//       lien dans une phrase est exempté, WCAG 2.5.5).
//  Il RAPPORTE (il ne meurt pas) : une ligne par défaut — écran, habillage, largeur, thème, règle, sélecteur,
//  texte, couleurs, ratio — dans `rapport.txt` / `rapport.json`, et une capture par écran (`SHOTS`).
//
//  Base INVENTÉE (dépôt public) : `baseFiches` d'ecrans-verre-2 (1 000 paires, 1 000 conversations, 1 000 e-mails,
//  3 comptes, les trois fiches) + les colis au point relais de `_base-volume` (codes, QR). Session de banc,
//  écran « Tu vends quoi ? » marqué fait (design-passe). Garde réseau : rien ne sort.
//
//  « VRM NATIF » (décision du 19 nov., docs/design/NATIF.md) : UN seul design. Le banc juge donc `natif` (aucun réglage
//  posé), clair et sombre, sur la base de volume ET sur une base VIDE (`BASES=volume,vide`). Les habillages d'avant
//  (`HABILLAGES=vrm,apple,ancien`) ne servent plus qu'à juger un arbre d'avant (`BANC_DIST`).
//  Ce que d'autres agents réécrivent en natif n'est pas à ce lot : leurs défauts sont LISTÉS à part, jamais comptés dans
//  le verdict — `HORS=aucun` les compte tous (à faire quand ces lots sont fusionnés) :
//    · la coque : barre d'onglets, barre de titre, rail (la fondation, src/natif/Coque.jsx) ;
//    · Aujourd'hui, Ventes, la fiche d'un article et la rangée d'annonce, les colis à retirer.
//  Restent à ce lot : Annonces, Achats, Stock, Messages, E-mails, Argent, Paramètres, les feuilles, les ateliers.
//
//  Sous-ensembles : `ECRANS=annonces,param*` (id ou groupe, `*` en fin) · `LARGEURS=390,1512,1280` ·
//  `THEMES=clair,sombre` · `BASES=volume,vide` (ou `leger` : ~40 annonces, pour une machine chargée) · `HABILLAGES=natif` · `PAGES=2` (écrans de défilement lus par état) ·
//  `DETAIL=4` (exemples par état sur la console) · `SHOTS=<dossier>` · `CAPTURES=jpg|png|non` · `CAPTURES_TOUTES=1` ·
//  `BANC_DIST=<dist>` (juger un autre arbre : celui d'avant doit être ROUGE) · `SOUSPAGES=non` (sans les
//  sous-pages de Paramètres).
//  Preuve par mutation : `MUTATION=blanc` remet un blanc en dur sur les titres de la page ⇒ C rouge.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
require('./_porte-banc.cjs');
const P = require('./design-passe.cjs');
const B = require('./_base-messages-stock.cjs');
const { baseFiches } = require('./ecrans-verre-2.cjs');
const { fabriquer } = require('./_base-volume.cjs');

const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512,1280').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const HABILLAGES = liste('HABILLAGES', 'natif');
const BASES = liste('BASES', 'volume');
const VOULUS = liste('ECRANS', '');
const PAGES = Math.max(1, Number(process.env.PAGES || 2));
const DETAIL = Number(process.env.DETAIL || 3);
const MUT = process.env.MUTATION || '';
const CAPTURES = process.env.CAPTURES || 'jpg';
const SOUSPAGES = process.env.SOUSPAGES !== 'non';
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-lisible-partout');
fs.mkdirSync(SHOTS, { recursive: true });

// ── Les chantiers en cours (19 nov., « VRM natif ») : à qui est un défaut. `null` = à ce lot (les écrans restés anciens). ──
const RE_COQUE = /\bn-barre-|\bn-onglets?\b|\bn-onglet-|\bn-laterale|\bn-coque-(?!ecran)|vrm-app-header|vrm-header-actions|vrm-hbtn|vrm-hdr-|vrm-sidebar|vrm-rail|vrm-nav-|vrm-tabbar|vrm-tab\b|v2-barre|vrm-barre-haut|vrm-barre-recherche|vrm-recherche-|vrm-etat-pastille|vrm-neuf|vrm-bandeau-abo|vrm-aller-contenu|vrm-fraicheur/;
const HORS = process.env.HORS === 'aucun' ? [] : [
  { nom: 'coque', quoi: 'la coque (barre d’onglets, barre de titre, rail) — l’agent de la fondation', de: (d, c) => RE_COQUE.test(d.sel) || (c.tel && d.regle === 'sous-barre') },
  { nom: 'aujourdhui', quoi: 'Aujourd’hui (réécrit en natif)', de: (d) => d.groupe === 'Aujourd’hui' },
  { nom: 'ventes', quoi: 'Ventes (réécrit en natif)', de: (d) => d.groupe === 'Ventes' },
  { nom: 'fiche-article', quoi: 'la fiche d’un article et la rangée d’annonce', de: (d) => d.groupe === 'Fiche' || /\bfd-|data-fiche-paire|\bv2l-|\bv2l\b/.test(d.sel) },
  { nom: 'colis-a-retirer', quoi: 'les colis à retirer (passes)', de: (d) => /v2-passe|v2-rp-|data-v2-passe|v2-piste|v2-code/.test(d.sel) },
];
const chantierDe = (d, c) => { for (const h of HORS) { try { if (h.de(d, c)) return h.nom; } catch (_) {} } return null; };

// ════════════════════════════════════════════════════════════════════════════
//  LES ÉCRANS. Une étape : { aller: '?tab=…' } (le chemin des liens, `vrm:aller`) · { clic: sél } ·
//  { evt: [nom, détail] } · { taper: [sél, texte] } · { touche: 'Escape' } · { pause: ms } · { attendre: sél }.
//  `preuve` : le sélecteur qui prouve que l'écran est bien là (sinon « pas joignable », dit, jamais compté vert).
//  `si(c)` : l'état n'existe que pour cette configuration (c.tel, c.hab, c.v2).
// ════════════════════════════════════════════════════════════════════════════
const ECRANS = [
  // ── Aujourd'hui / Ma journée ──
  { id: 'journee', groupe: 'Aujourd’hui', etapes: [{ aller: '?tab=journee' }], preuve: '.vrm-main' },
  { id: 'journee-semaine', groupe: 'Aujourd’hui', etapes: [{ aller: '?tab=semaine' }], preuve: '.vrm-main' },
  { id: 'journee-a-trancher', groupe: 'Aujourd’hui', etapes: [{ aller: '?tab=trancher' }], preuve: '.vrm-main' },
  // ── Annonces ──
  { id: 'annonces', groupe: 'Annonces', etapes: [{ aller: '?tab=annonces&site=vinted' }], preuve: '[data-v2l], .vrm-fiche-photo, [data-fiche-photo]' },
  { id: 'annonces-detaille', groupe: 'Annonces', si: (c) => c.v2, etapes: [{ ls: ['vrm_annonces_affichage', '"C"'] }, { aller: '?tab=journee' }, { aller: '?tab=annonces&site=vinted' }], preuve: '[data-v2l]', apres: [{ ls: ['vrm_annonces_affichage', '"A"'] }] },
  { id: 'annonces-dorment', groupe: 'Annonces', si: (c) => c.v2, etapes: [{ aller: '?tab=annonces&site=vinted' }, { clic: '[data-v2-seg="sleeping"]' }], preuve: '[data-v2-seg="sleeping"][aria-selected="true"]' },
  { id: 'annonces-a-publier', groupe: 'Annonces', si: (c) => c.v2, etapes: [{ aller: '?tab=annonces&site=vinted' }, { clic: '[data-v2-seg="brouillons"]' }], preuve: '[data-v2-seg="brouillons"][aria-selected="true"]' },
  { id: 'annonces-menu', groupe: 'Annonces', etapes: [{ aller: '?tab=annonces&site=vinted' }, { clic: '.vrm-annbar-bouton[aria-expanded]' }], preuve: '.vrm-annbar-bouton[aria-expanded="true"], [role="dialog"], .vrm-fs' },
  { id: 'annonces-selection', groupe: 'Annonces', etapes: [{ aller: '?tab=annonces&site=vinted' }, { clic: '[data-vue-selection]', ou: [{ clic: '.vrm-annbar-bouton[aria-expanded]' }, { clic: '[role="dialog"] button:has-text("Sélectionner"), .v2-feuille button:has-text("Sélectionner")' }] }], preuve: '.vrm-sel, [data-sel-consigne], [data-vue-selection][aria-pressed="true"]' },
  { id: 'annonces-plateformes', groupe: 'Annonces', si: (c) => c.v2, etapes: [{ aller: '?tab=annonces&site=vinted' }, { clic: '[data-v2-menu="annonces"]' }], preuve: '[data-v2-menu="annonces"][aria-expanded="true"], [role="dialog"]' },
  { id: 'annonces-republier', groupe: 'Annonces', etapes: [{ aller: '?tab=annonces&vue=republier' }], preuve: '.vrm-main' },
  { id: 'annonces-leboncoin', groupe: 'Annonces', etapes: [{ aller: '?tab=annonces&site=leboncoin' }], preuve: '.vrm-main' },
  { id: 'annonces-ebay', groupe: 'Annonces', etapes: [{ aller: '?tab=annonces&site=ebay' }], preuve: '.vrm-main' },
  { id: 'annonces-vestiaire', groupe: 'Annonces', etapes: [{ aller: '?tab=annonces&site=vestiaire' }], preuve: '.vrm-main' },
  // ── Ventes (un autre chantier : ouvert, listé à part) ──
  { id: 'ventes', groupe: 'Ventes', etapes: [{ aller: '?tab=ventes' }], preuve: '[data-v2v-seg], [data-ventes-seg-choix]' },
  { id: 'ventes-en-route', groupe: 'Ventes', etapes: [{ aller: '?tab=ventes' }, { clic: '[data-v2v-seg="envoyes"], [data-ventes-seg-choix="envoyes"]' }], preuve: '[data-v2v-seg="envoyes"][aria-selected="true"], [data-ventes-seg-choix="envoyes"][aria-pressed="true"]' },
  { id: 'ventes-toutes', groupe: 'Ventes', etapes: [{ aller: '?tab=ventes' }, { clic: '[data-v2v-seg="toutes"], [data-ventes-seg-choix="toutes"]' }], preuve: '[data-v2v-seg="toutes"][aria-selected="true"], [data-ventes-seg-choix="toutes"][aria-pressed="true"]' },
  { id: 'ventes-litiges', groupe: 'Ventes', etapes: [{ aller: '?tab=litiges' }], preuve: '.vrm-main' },
  // ── Achats ──
  { id: 'achats', groupe: 'Achats', etapes: [{ aller: '?tab=achats' }], preuve: '.vrm-main' },
  { id: 'achats-retirer-detail', groupe: 'Achats', etapes: [{ aller: '?tab=achats&vue=retraits' }, { clic: '.vrm-achats-retirer-ligne[aria-expanded="false"]', facultatif: true }], preuve: '.vrm-main' },
  { id: 'achats-en-route', groupe: 'Achats', etapes: [{ aller: '?tab=achats' }, { clic: '[data-achats-onglet="route"]', facultatif: true }], preuve: '.vrm-main' },
  { id: 'achats-tous', groupe: 'Achats', etapes: [{ aller: '?tab=achats&vue=achats' }, { clic: '[data-achats-onglet="all"], [data-v2-achats-tous]', facultatif: true }], preuve: '.vrm-main' },
  { id: 'achats-menu', groupe: 'Achats', etapes: [{ aller: '?tab=achats&vue=achats' }, { clic: '[data-achats-plus]' }], preuve: '[data-achats-plus="ouvert"], [data-achats-plus][aria-expanded="true"], [role="dialog"]' },
  { id: 'achats-plateformes', groupe: 'Achats', si: (c) => c.v2, etapes: [{ aller: '?tab=achats' }, { clic: '[data-v2-menu="achats"]' }], preuve: '[data-v2-menu="achats"][aria-expanded="true"], [role="dialog"]' },
  { id: 'achats-factures', groupe: 'Achats', etapes: [{ aller: '?tab=invoices' }], preuve: '.vrm-main' },
  // ── Stock ──
  { id: 'stock', groupe: 'Stock', etapes: [{ aller: '?tab=garage' }], preuve: '.vrm-main' },
  { id: 'stock-organisation', groupe: 'Stock', etapes: [{ aller: '?tab=organisation' }], preuve: '.vrm-main' },
  // ── Messages ──
  { id: 'messages', groupe: 'Messages', etapes: [{ aller: '?tab=messages' }], preuve: '[data-fil], .vrm-msg-list' },
  { id: 'messages-conversation', groupe: 'Messages', etapes: [{ aller: '?tab=messages' }, { clic: '[data-fil]' }], preuve: '.vrm-chat-panel, .vrm-chat-history' },
  { id: 'messages-offre', groupe: 'Messages', etapes: [{ aller: '?tab=messages' }, { clic: '[data-fil-offre]' }], preuve: '.vrm-chat-panel, .vrm-chat-history' },
  { id: 'messages-non-lues', groupe: 'Messages', etapes: [{ aller: '?tab=messages' }, { clic: '[data-msg-vue="nonlues"]' }], preuve: '[data-msg-vue="nonlues"][aria-pressed="true"]' },
  { id: 'messages-favoris', groupe: 'Messages', etapes: [{ aller: '?tab=messages&vue=favoris' }], preuve: '.vrm-main' },
  // ── E-mails ──
  { id: 'emails', groupe: 'E-mails', etapes: [{ aller: '?tab=emails' }], preuve: '[data-boite-email]' },
  { id: 'emails-ouvert', groupe: 'E-mails', etapes: [{ aller: '?tab=emails' }, { clic: '[data-boite-email]' }], preuve: '[data-boite-lecture], [data-boite-ouvert], .vrm-boite-lecture, [role="dialog"]' },
  { id: 'emails-colis', groupe: 'E-mails', etapes: [{ aller: '?tab=emails' }, { clic: '[data-boite-rubrique-v2="colis"], [data-boite-rubrique="colis"]' }], preuve: '[data-boite-email]' },
  // ── Argent ──
  { id: 'argent', groupe: 'Argent', etapes: [{ aller: '?tab=argent' }], preuve: '[data-argent-ecran], .vrm-main' },
  { id: 'argent-statistiques', groupe: 'Argent', etapes: [{ aller: '?tab=stats' }], preuve: '.vrm-main' },
  { id: 'argent-declarer', groupe: 'Argent', etapes: [{ aller: '?tab=argent_declarer' }], preuve: '.vrm-main' },
  { id: 'argent-factures', groupe: 'Argent', etapes: [{ aller: '?tab=argent' }, { clic: '[data-section="factures"]' }], preuve: '.vrm-main' },
  { id: 'argent-a-venir', groupe: 'Argent', etapes: [{ aller: '?tab=argent' }, { evt: ['vrm:argent-a-venir'] }], preuve: '[data-argent-a-venir-ecran]' },
  { id: 'argent-prix-marche', groupe: 'Argent', etapes: [{ aller: '?tab=prixmarche' }], preuve: '.vrm-main' },
  { id: 'argent-masques', groupe: 'Argent', etapes: [{ aller: '?tab=masques' }], preuve: '.vrm-main' },
  // ── Paramètres (les catégories et les sous-pages sont lues dans la page : `genererParametres`) ──
  { id: 'parametres', groupe: 'Paramètres', etapes: [{ aller: '?tab=settings' }, { reglage: '@racine' }], preuve: '.vrm-set[data-parametres]' },
  { id: 'param-tout-va-bien', groupe: 'Paramètres', etapes: [{ aller: '?tab=settings&section=toutvabien' }, { pause: 900 }], preuve: '[data-tout-va-bien]' },
  { id: 'param-securite-donnees', groupe: 'Paramètres', etapes: [{ aller: '?tab=settings' }, { reglage: 'securite' }, { clic: '[data-sous-ouvrir="securite"]' }], preuve: '.vrm-set[data-parametres]' },
  // ── Communauté ──
  { id: 'communaute', groupe: 'Communauté', etapes: [{ aller: '?tab=communaute' }], preuve: '.vrm-main' },
  { id: 'communaute-parrainage', groupe: 'Communauté', etapes: [{ aller: '?tab=parrainage' }], preuve: '.vrm-main' },
  // ── La coque : cloche, loupe, menus, aide ──
  { id: 'coque-cloche', groupe: 'Coque', etapes: [{ aller: '?tab=journee' }, { clic: '[data-centre-notifs-cloche]' }], preuve: '[data-centre-notifs], [data-centre-notifs-panneau], .vrm-cn-panneau, [role="dialog"]' },
  { id: 'coque-loupe', groupe: 'Coque', etapes: [{ aller: '?tab=achats' }, { loupe: '5' }], preuve: '[data-recherche-champ], [data-recherche-panneau]' },
  { id: 'coque-loupe-numero', groupe: 'Coque', etapes: [{ aller: '?tab=achats' }, { loupe: '3102' }], preuve: '[data-recherche-champ], [data-recherche-panneau]' },
  { id: 'coque-profil', groupe: 'Coque', etapes: [{ aller: '?tab=achats' }, { clic: '[data-profil-tete], [data-nav-compte]' }], preuve: '[role="dialog"], [role="menu"], .vrm-profil-menu, [data-profil-menu]' },
  { id: 'coque-etat-extension', groupe: 'Coque', si: (c) => !c.tel, etapes: [{ aller: '?tab=achats' }, { clic: '[data-etat-actions]' }], preuve: '[data-etat-actions][aria-expanded="true"]' },
  { id: 'coque-aide', groupe: 'Coque', etapes: [{ aller: '?tab=achats' }, { clic: '[data-aide-ouvrir]' }], preuve: '[role="dialog"], .vrm-aide-feuille, [data-aide-feuille]' },
  // ── La fiche d'un article (un autre chantier : ouverte, listée à part) ──
  { id: 'fiche-article', groupe: 'Fiche', etapes: [{ aller: '?tab=journee' }, { evt: ['vrm:fiche-paire', '3119'] }], preuve: '[data-fiche-paire]' },
];
// La connexion : un contexte SANS session.
const ECRANS_SANS_SESSION = [
  { id: 'connexion', groupe: 'Connexion', url: '/?connexion', etapes: [], preuve: 'input[type="email"], input[type="password"]' },
  { id: 'inscription', groupe: 'Connexion', url: '/?inscription', etapes: [], preuve: 'input[type="email"], input[type="password"]' },
];

const veut = (e) => !VOULUS.length || VOULUS.some((v) => v.endsWith('*') ? (e.id.startsWith(v.slice(0, -1)) || e.groupe.toLowerCase().startsWith(v.slice(0, -1).toLowerCase())) : (e.id === v || e.groupe.toLowerCase() === v.toLowerCase()));

// ════════════════════════════════════════════════════════════════════════════
//  DANS LA PAGE — 1. ce qu'on relève (géométrie, couleurs calculées) ; 2. ce qu'on juge sur les pixels.
// ════════════════════════════════════════════════════════════════════════════
function collecter(o) {
  const W = innerWidth, H = innerHeight;
  const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
  const memoC = new Map();
  const parse = (s) => {
    if (!s || s === 'none') return null; if (memoC.has(s)) return memoC.get(s);
    let r = null; const m = /^rgba?\(([^)]+)\)$/.exec(s);
    if (m) { const p = m[1].split(/[ ,/]+/).filter(Boolean).map(parseFloat); r = [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
    else { const k = /^color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)(?: \/ ([\d.e-]+))?\)$/.exec(s);
      if (k) r = [k[1] * 255, k[2] * 255, k[3] * 255, k[4] == null ? 1 : +k[4]];
      else { try { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = s; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; r = [d[0], d[1], d[2], d[3] / 255]; } catch (_) { r = null; } } }
    memoC.set(s, r); return r;
  };
  const memoS = new Map();
  const cs = (e) => { let s = memoS.get(e); if (!s) { s = getComputedStyle(e); memoS.set(e, s); } return s; };
  const nom1 = (e) => { let s = e.tagName.toLowerCase(); if (typeof e.className === 'string' && e.className.trim()) s += '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.'); return s; };
  const nom = (e) => { const p = []; let x = e; for (let i = 0; x && x !== document.body && i < 3; i++, x = x.parentElement) p.unshift(nom1(x)); const d = [...e.attributes].find((a) => /^data-/.test(a.name) && !/^data-(v-|reactid)/.test(a.name)); return p.join(' > ') + (d ? `[${d.name}]` : ''); };
  // Le cadre VU d'un rectangle : rogné par la fenêtre et par chaque ancêtre qui coupe (overflow ≠ visible).
  const rogner = (e, r) => {
    let x0 = Math.max(0, r.left), y0 = Math.max(0, r.top), x1 = Math.min(W, r.right), y1 = Math.min(H, r.bottom);
    for (let a = e.parentElement; a && a !== document.documentElement; a = a.parentElement) {
      const c = cs(a); if (c.display === 'contents') continue;
      const ox = c.overflowX !== 'visible', oy = c.overflowY !== 'visible'; if (!ox && !oy) { if (c.position === 'fixed') break; continue; }
      const q = a.getBoundingClientRect();
      if (ox) { x0 = Math.max(x0, q.left); x1 = Math.min(x1, q.right); } if (oy) { y0 = Math.max(y0, q.top); y1 = Math.min(y1, q.bottom); }
      if (c.position === 'fixed') break;
    }
    return x1 - x0 > 1 && y1 - y0 > 1 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
  };
  const fixe = (e) => { for (let a = e; a && a !== document.body; a = a.parentElement) { const p = cs(a).position; if (p === 'fixed' || p === 'sticky') return a; } return null; };
  // VU : au centre du cadre, c'est bien lui (ou son contenant) qui est devant.
  const devant = (e, x, y) => {
    x = Math.min(W - 1, Math.max(0, x)); y = Math.min(H - 1, Math.max(0, y));
    const h = document.elementFromPoint(x, y); if (!h) return false;
    if (h === e || e.contains(h) || h.contains(e)) return true;
    // Un texte sans toucher (`pointer-events: none`) laisse passer le point : vu, sauf si ce qui répond est une couche posée au-dessus.
    let pe = false; for (let a = e; a && a !== document.body; a = a.parentElement) if (cs(a).pointerEvents === 'none') { pe = true; break; }
    if (!pe) return false;
    const fh = fixe(h), fe = fixe(e); return !fh || fh === fe || (fe && fh.contains(fe));
  };
  const opacite = (e) => { let op = 1; for (let a = e; a; a = a.parentElement) op *= +cs(a).opacity; return op; };
  const filtre = (e) => { for (let a = e; a && a !== document.documentElement; a = a.parentElement) { const c = cs(a); if ((c.filter && c.filter !== 'none') || (c.mixBlendMode && c.mixBlendMode !== 'normal')) return true; } return false; };
  const cache = (e) => !!e.closest('script, style, noscript, template, option, #vrm-demarrage, [data-banc-ignore], [hidden]') || (() => { const d = e.closest('details:not([open])'); return !!d && !e.closest('summary'); })();
  const SEL_INTER = 'button, a[href], [role="button"], [role="tab"], [role="link"], [role="switch"], [role="checkbox"], [role="radio"], [role="menuitem"], input:not([type="hidden"]), select, textarea, summary';
  const texteVu = (b) => { const tw = document.createTreeWalker(b, NodeFilter.SHOW_TEXT); while (tw.nextNode()) { const n = tw.currentNode; if (!/\S/.test(n.nodeValue)) continue; const p = n.parentElement; if (!p || p.closest('svg')) continue; const r = p.getBoundingClientRect(); const c = cs(p); if (r.width > 2 && r.height > 2 && c.visibility !== 'hidden' && c.clip !== 'rect(0px, 0px, 0px, 0px)' && c.clipPath !== 'inset(50%)' && (parse(c.webkitTextFillColor || c.color) || [0, 0, 0, 1])[3] > 0.05) return true; } return false; };

  const out = { textes: [], icones: [], geo: [], n: { textes: 0, inter: 0 }, haut: document.documentElement.scrollHeight };
  const barre = o.tel ? [...document.querySelectorAll('.vrm-tabbar, [data-v2-barre], nav.v2-barre')].find((b) => b.getClientRects().length && cs(b).visibility !== 'hidden') : null;
  const rb = barre ? barre.getBoundingClientRect() : null;

  // ── Les textes ──
  const parEl = new Map();
  { const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (tw.nextNode()) { const n = tw.currentNode; if (!/\S/.test(n.nodeValue)) continue; const e = n.parentElement; if (!e) continue; let l = parEl.get(e); if (!l) parEl.set(e, l = []); l.push(n); } }
  for (const [e, noeuds] of parEl) {
    if (e.closest('svg') || cache(e)) continue;
    const re = e.getBoundingClientRect(); if (re.bottom < 0 || re.top > H || re.right < 0 || re.left > W || re.width < 1 || re.height < 1) continue;
    const c = cs(e); if (c.visibility === 'hidden' || c.display === 'none') continue;
    if (c.clip === 'rect(0px, 0px, 0px, 0px)' || c.clipPath === 'inset(50%)' || (re.width <= 2 && re.height <= 2)) continue;   // réservé au lecteur d'écran
    const texte = noeuds.map((n) => n.nodeValue).join(' ').replace(/\s+/g, ' ').trim(); if (!texte) continue;
    const lignes = []; let brut = null;
    for (const n of noeuds) { const g = document.createRange(); g.selectNodeContents(n); for (const r of g.getClientRects()) { if (r.width < 2 || r.height < 2) continue; brut = brut ? { left: Math.min(brut.left, r.left), top: Math.min(brut.top, r.top), right: Math.max(brut.right, r.right), bottom: Math.max(brut.bottom, r.bottom) } : { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; const v = rogner(e, r); if (v && lignes.length < 3) lignes.push(v); } }
    if (!brut) continue;
    // T — le texte rogné par son cadre : la part vue est plus petite que le texte, et il n'est pas entièrement dehors.
    if (lignes.length) {
      let coupeur = null, axe = '';
      for (let a = e; a && a !== document.body; a = a.parentElement) { const ca = cs(a); if (ca.display === 'contents' || ca.display === 'inline') continue; const q = a === e ? re : a.getBoundingClientRect();
        const hx = /hidden|clip/.test(ca.overflowX), hy = /hidden|clip/.test(ca.overflowY);
        // la boîte de CONTENU utile : le texte peut toucher la marge intérieure, pas la dépasser
        if (hx && (brut.right > q.right + 1.5 || brut.left < q.left - 1.5)) { coupeur = a; axe = 'largeur'; break; }
        if (hy && (brut.bottom > q.bottom + 2.5 || brut.top < q.top - 2.5) && q.height > 4) { coupeur = a; axe = 'hauteur'; break; }
        if (/auto|scroll/.test(ca.overflowX + ca.overflowY) || ca.position === 'fixed') break; }
      if (coupeur) {
        const cc = cs(coupeur), ce = c;
        const points = cc.textOverflow === 'ellipsis' || ce.textOverflow === 'ellipsis';
        const pince = (cc.webkitLineClamp && cc.webkitLineClamp !== 'none') || (ce.webkitLineClamp && ce.webkitLineClamp !== 'none');
        const rangee = !!e.closest('li, [role="listitem"], [role="row"], [role="option"], tr, .sb-rangee, [class*="rangee"], [class*="ligne"], [class*="-row"], [class*="fil"], [data-fil], [data-boite-email], [class*="carte"], [class*="tuile"], select');
        const exempt = pince || (points && (rangee || e.closest('[title]')));
        // un bloc replié exprès (hauteur animée d'un repli, carrousel) n'est pas un texte coupé : seulement quand une PART du texte se voit
        const vuH = lignes.reduce((s, l) => s + l.h * l.w, 0), toutH = (brut.right - brut.left) * (brut.bottom - brut.top);
        if (!exempt && toutH > 0 && vuH / toutH < 0.97 && vuH / toutH > 0.15 && texte.length > 1 && devant(e, lignes[0].x + lignes[0].w / 2, lignes[0].y + lignes[0].h / 2))
          out.geo.push({ regle: 'coupe', sel: nom(e), texte: texte.slice(0, 50), note: (points ? '« … » hors d’une rangée' : 'rogné en ' + axe) + ' par ' + nom1(coupeur) });
      }
    }
    if (!lignes.length) continue;
    const l0 = lignes[0]; if (!devant(e, l0.x + l0.w / 2, l0.y + l0.h / 2)) continue;
    // au milieu d'une page qui défile, ce qui passe sous la barre du bas (et son fondu) remontera : jugé plus haut
    if (rb && !o.bas && l0.y + l0.h > rb.top - 4 && !barre.contains(e)) continue;
    out.n.textes++;
    if ((c.backgroundClip || c.webkitBackgroundClip || '').includes('text')) continue;
    const col = parse(c.webkitTextFillColor) || parse(c.color); if (!col) continue;
    const op = opacite(e); if (col[3] === 0 || op === 0) continue;   // masqué EXPRÈS (libellé d'une icône seule)
    if (e.closest('[disabled], [aria-disabled="true"]')) continue;   // WCAG 1.4.3 exempte un contrôle indisponible
    const px = parseFloat(c.fontSize), gr = parseInt(c.fontWeight, 10) || 400;
    const lettres = /[\p{L}\p{N}]/u.test(texte);
    // un glyphe seul (« × », « ⋯ », « › ») dans un contrôle : c'est une icône, 3:1
    const glyphe = !lettres; if (glyphe) { const ct = e.closest(SEL_INTER); if (!ct || /[\p{L}\p{N}]/u.test(ct.textContent || '')) continue; }
    out.textes.push({ sel: nom(e), texte: texte.slice(0, 50), rgb: col.slice(0, 3), a: col[3] * Math.min(1, op), c: c.color, seuil: glyphe || px >= 24 || (px >= 18.66 && gr >= 700) ? 3 : 4.5, px, filtre: filtre(e), lignes });
  }
  // Les champs : la valeur saisie, sinon l'invite (placeholder).
  for (const e of document.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]):not([type="color"]), textarea')) {
    if (cache(e) || e.disabled) continue; const re = e.getBoundingClientRect(); if (re.width < 24 || re.height < 12 || re.bottom < 0 || re.top > H) continue;
    const c = cs(e); if (c.visibility === 'hidden' || c.display === 'none' || +c.opacity === 0) continue;
    const val = e.value || ''; const inv = e.getAttribute('placeholder') || ''; if (!val && !inv) continue;
    const pc = val ? c : getComputedStyle(e, '::placeholder'); const col = parse(val ? (c.webkitTextFillColor || c.color) : pc.color); if (!col || col[3] === 0) continue;
    const pl = parseFloat(c.paddingLeft) || 0, pt = parseFloat(c.paddingTop) || 0, pb = parseFloat(c.paddingBottom) || 0;
    const r = { left: re.left + pl + 1, right: Math.min(re.right - 2, re.left + pl + Math.max(24, Math.min(160, (val || inv).length * parseFloat(c.fontSize) * 0.5))), top: re.top + Math.max(pt, (re.height - parseFloat(c.fontSize) * 1.2) / 2), bottom: re.bottom - Math.max(pb, (re.height - parseFloat(c.fontSize) * 1.2) / 2) };
    r.width = r.right - r.left; r.height = r.bottom - r.top; const v = rogner(e, r); if (!v || !devant(e, v.x + v.w / 2, v.y + v.h / 2)) continue;
    if (rb && !o.bas && v.y + v.h > rb.top - 4) continue;
    out.n.textes++;
    const op = opacite(e) * (val ? 1 : +pc.opacity || 1);
    out.textes.push({ sel: nom(e) + (val ? '' : '::placeholder'), texte: (val || inv).slice(0, 50), rgb: col.slice(0, 3), a: col[3] * Math.min(1, op), c: val ? c.color : pc.color, seuil: 4.5, px: parseFloat(c.fontSize), filtre: filtre(e), lignes: [v] });
  }

  // ── Les éléments interactifs : icône seule, vide, cible ──
  const petits = [];
  for (const e of document.querySelectorAll(SEL_INTER)) {
    if (cache(e) || e.closest('[aria-hidden="true"], [inert]')) continue;
    const re = e.getBoundingClientRect(); if (re.width < 1 || re.height < 1 || re.bottom < 0 || re.top > H || re.right < 0 || re.left > W) continue;
    const c = cs(e); if (c.visibility === 'hidden' || c.display === 'none' || opacite(e) < 0.05) continue;
    if (c.clip === 'rect(0px, 0px, 0px, 0px)' || c.clipPath === 'inset(50%)') continue;
    const v = rogner(e, re); if (!v) continue;
    if (!devant(e, v.x + v.w / 2, v.y + v.h / 2)) continue;
    if (rb && !o.bas && v.y > rb.top - 4 && !barre.contains(e)) continue;
    out.n.inter++;
    const tag = e.tagName.toLowerCase(); const role = e.getAttribute('role') || '';
    const champ = /^(input|select|textarea)$/.test(tag) || /switch|checkbox|radio/.test(role);
    const aTexte = texteVu(e);
    const svgs = [...e.querySelectorAll('svg')].filter((s) => { const r = s.getBoundingClientRect(); return r.width >= 6 && r.height >= 6 && cs(s).visibility !== 'hidden' && cs(s).display !== 'none'; });
    const image = !!e.querySelector('img, canvas, video, picture') || [...e.querySelectorAll('*')].slice(0, 40).some((x) => { const q = x.getBoundingClientRect(); const g = parse(cs(x).backgroundColor); return q.width >= 6 && q.height >= 6 && g && g[3] > 0.3; }) || [e, ...e.querySelectorAll('*')].slice(0, 40).some((x) => { const s = cs(x); return /url\(|gradient\(/.test(s.backgroundImage) || (s.maskImage && s.maskImage !== 'none') || (s.webkitMaskImage && s.webkitMaskImage !== 'none'); });
    const pseudo = ['::before', '::after'].some((p) => { const s = getComputedStyle(e, p); if (!s.content || s.content === 'none' || s.content === 'normal') return false; const bg = parse(s.backgroundColor); return (s.content !== '""' && s.content !== "''") || (bg && bg[3] > 0.05) || /url\(|gradient\(/.test(s.backgroundImage) || parseFloat(s.borderTopWidth) + parseFloat(s.borderLeftWidth) + parseFloat(s.borderBottomWidth) + parseFloat(s.borderRightWidth) > 0; })
      || [...e.querySelectorAll('*')].slice(0, 30).some((x) => ['::before', '::after'].some((p) => { const s = getComputedStyle(x, p); return s.content && s.content !== 'none' && s.content !== 'normal'; }));
    // I — l'icône seule porte le sens
    if (!aTexte && svgs.length && !e.closest('[disabled], [aria-disabled="true"]')) {
      for (const s of svgs.slice(0, 2)) { const r = rogner(s, s.getBoundingClientRect()); if (!r) continue; out.icones.push({ sel: nom(e), texte: '(icône) ' + (e.getAttribute('aria-label') || e.getAttribute('title') || '').slice(0, 44), r }); }
    }
    // V — vide : une boîte dessinée (fond, bord, ombre) et rien dedans
    if (!aTexte && !svgs.length && !image && !pseudo && !champ && re.width >= 12 && re.height >= 12 && re.width * re.height < W * H * 0.4) {
      const bg = parse(c.backgroundColor); const bord = ['Top', 'Right', 'Bottom', 'Left'].some((k) => parseFloat(c['border' + k + 'Width']) > 0 && (parse(c['border' + k + 'Color']) || [0, 0, 0, 0])[3] > 0.05 && c['border' + k + 'Style'] !== 'none');
      const dessine = (bg && bg[3] > 0.05) || bord || (c.boxShadow && c.boxShadow !== 'none');
      // un voile de fermeture ou un lien étiré sur sa carte (absolu, de la taille de son parent) n'est pas un bouton vide
      const pr = e.parentElement ? e.parentElement.getBoundingClientRect() : null;
      const etire = /absolute|fixed/.test(c.position) && pr && re.width >= pr.width * 0.9 && re.height >= pr.height * 0.9;
      if (dessine && !etire) out.geo.push({ regle: 'vide', sel: nom(e), texte: (e.getAttribute('aria-label') || e.getAttribute('title') || '').slice(0, 44), note: `${Math.round(re.width)}×${Math.round(re.height)} dessiné, rien dedans` });
    }
    // Z — la cible au doigt
    if (o.tel) {
      if (tag === 'a' && e.parentElement && /^(P|LI|SPAN|SMALL|DIV|LABEL|EM|STRONG|B)$/.test(e.parentElement.tagName) && (e.parentElement.textContent || '').trim().length > (e.textContent || '').trim().length + 12 && cs(e).display.startsWith('inline')) continue;
      let w = re.width, h = re.height;
      for (const p of ['::before', '::after']) { const s = getComputedStyle(e, p); if (s.content && s.content !== 'none' && s.position === 'absolute') { const ins = (k) => parseFloat(s[k]) || 0; w = Math.max(w, re.width - ins('left') - ins('right')); h = Math.max(h, re.height - ins('top') - ins('bottom')); } }
      const l = e.closest('label'); if (l) { const lr = l.getBoundingClientRect(); w = Math.max(w, lr.width); h = Math.max(h, lr.height); }
      if (champ && /checkbox|radio/.test(e.type || role) && e.parentElement) { const lr = e.parentElement.getBoundingClientRect(); if (e.parentElement.matches('label, [role], button')) { w = Math.max(w, lr.width); h = Math.max(h, lr.height); } }
      if (w + 0.5 < 44 || h + 0.5 < 44) petits.push({ regle: 'cible', sel: nom(e), texte: ((e.textContent || '').trim() || e.getAttribute('aria-label') || '').replace(/\s+/g, ' ').slice(0, 40), note: `${Math.round(w)}×${Math.round(h)}` });
    }
    // B — en bas de page, ce contrôle est-il resté sous la barre ?
    if (rb && o.bas && !barre.contains(e) && re.bottom > rb.top + 3 && re.top < rb.bottom && !fixe(e)) out.geo.push({ regle: 'sous-barre', sel: nom(e), texte: ((e.textContent || '').trim() || e.getAttribute('aria-label') || '').replace(/\s+/g, ' ').slice(0, 40), note: `bas à ${Math.round(re.bottom)} px, barre à ${Math.round(rb.top)} px` });
  }
  out.geo.push(...petits);
  // B — le dernier texte de la page, tout en bas, reste-t-il sous la barre ?
  if (rb && o.bas) {
    let pire = null;
    for (const [e] of parEl) { if (barre.contains(e) || cache(e) || e.closest('svg')) continue; const r = e.getBoundingClientRect(); if (r.height < 4 || r.width < 4 || r.top >= rb.bottom || r.bottom <= rb.top + 3 || r.top < H * 0.5) continue; const c = cs(e); if (c.visibility === 'hidden') continue; if (fixe(e)) continue;
      // « sous » la barre : au milieu de leur recouvrement, c'est la barre qui répond
      const y = Math.min(H - 1, (Math.max(r.top, rb.top) + Math.min(r.bottom, rb.bottom)) / 2), x = Math.min(W - 1, Math.max(0, r.left + Math.min(r.width, W) / 2)); const h = document.elementFromPoint(x, y);
      if (h && barre.contains(h) && (!pire || r.bottom > pire.b)) pire = { b: r.bottom, e }; }
    if (pire) out.geo.push({ regle: 'sous-barre', sel: nom(pire.e), texte: (pire.e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40), note: `en bas de page, texte jusqu’à ${Math.round(pire.b)} px sous la barre (${Math.round(rb.top)} px)` });
  }

  // ── G — plus aucun dégradé bleu (au premier relevé) ──
  if (o.premier) {
    const bleu = (img) => (String(img).match(/rgba?\([^)]*\)|#[0-9a-f]{6}\b/gi) || []).some((x) => { const p = parse(x.startsWith('#') ? 'rgb(' + [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16)).join(', ') + ')' : x); return p && p[3] > 0.2 && p[2] > p[0] + 40 && p[2] > p[1] + 10; });
    const coque = document.querySelector('.vrm-app-shell');
    const lieux = [['html', cs(document.documentElement).backgroundImage], ['body', cs(document.body).backgroundImage]];
    if (coque) lieux.push(['.vrm-app-shell::before', getComputedStyle(coque, '::before').backgroundImage], ['.vrm-app-shell', cs(coque).backgroundImage]);
    for (const [ou, img] of lieux) if (/gradient/.test(img) && bleu(img)) out.geo.push({ regle: 'degrade', sel: ou, texte: '', note: 'dégradé bleu : ' + img.slice(0, 90) });
    let n = 0;
    for (const e of document.querySelectorAll('.vrm-main *')) { const r = e.getBoundingClientRect(); if (r.width < 40 || r.height < 40 || r.bottom < 0 || r.top > H) continue; const img = cs(e).backgroundImage; if (!/gradient/.test(img) || !bleu(img) || cs(e).visibility === 'hidden') continue; out.geo.push({ regle: 'degrade', sel: nom(e), texte: '', note: 'dégradé bleu : ' + img.slice(0, 90) }); if (++n >= 4) break; }
  }
  // ── F — aucun flou dans le contenu (au premier relevé, ce qui est à l'écran) ──
  if (o.premier) {
    let n = 0;
    for (const e of document.querySelectorAll('.vrm-main *, .vrm-fs *, [role="dialog"] *')) { const r = e.getBoundingClientRect(); if (r.width < 8 || r.height < 8 || r.bottom < 0 || r.top > H) continue; const c = cs(e); const f = c.backdropFilter || c.webkitBackdropFilter; if (!f || f === 'none' || c.visibility === 'hidden' || c.display === 'none') continue; out.geo.push({ regle: 'flou', sel: nom(e), texte: '', note: f.slice(0, 50) }); if (++n >= 4) break; }
  }
  // ── D — le débordement horizontal (au premier relevé seulement) ──
  if (o.premier) {
    const se = document.scrollingElement; const main = document.querySelector('.vrm-main');
    if (se.scrollWidth - W > 1) out.geo.push({ regle: 'deborde', sel: 'html', texte: '', note: `la page défile de ${se.scrollWidth - W} px à l’horizontale` });
    if (main && main.scrollWidth - main.clientWidth > 1 && !/auto|scroll/.test(cs(main).overflowX)) out.geo.push({ regle: 'deborde', sel: '.vrm-main', texte: '', note: `le contenu dépasse de ${main.scrollWidth - main.clientWidth} px` });
    let n = 0;
    for (const e of document.querySelectorAll('.vrm-app-shell *, .vrm-fs *, [role="dialog"] *')) {
      const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || (r.right <= W + 2 && r.left >= -2) || r.bottom < 0 || r.top > H * 3) continue;
      const c = cs(e); if (c.visibility === 'hidden' || c.display === 'none' || +c.opacity === 0 || e.closest('svg, [aria-hidden="true"], .vrm-sr-seul') || cache(e)) continue;
      if (c.clip === 'rect(0px, 0px, 0px, 0px)') continue;
      // dans une zone qui défile à l'horizontale (ou rognée exprès : carrousel, rangée de puces), ce n'est pas un débordement
      let ok = false; for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { const ca = cs(a); if (/auto|scroll|hidden|clip/.test(ca.overflowX)) { const q = a.getBoundingClientRect(); if (q.right <= W + 2 && q.left >= -2) { ok = true; break; } } }
      if (ok) continue;
      if (c.position === 'fixed' && (r.right <= 0 || r.left >= W)) continue;   // un tiroir rangé hors de l'écran
      if (e.parentElement && [...e.parentElement.children].some((f) => f !== e) && e.parentElement.getBoundingClientRect().right > W + 2 && n) continue;   // un seul par bloc
      out.geo.push({ regle: 'deborde', sel: nom(e), texte: (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30), note: `de ${Math.round(r.left)} à ${Math.round(r.right)} px (écran : ${W})` });
      if (++n >= 6) break;
    }
  }
  return out;
}

// La capture « sans » : le texte transparent, les icônes cachées — le fond tel qu'il s'affiche.
const STYLE_SANS = '*,*::before,*::after{-webkit-text-fill-color:transparent!important;text-shadow:none!important;caret-color:transparent!important;text-decoration-color:transparent!important}'
  + '::placeholder{-webkit-text-fill-color:transparent!important;color:transparent!important}svg{visibility:hidden!important}';

async function juger({ a64, b64, textes, icones }) {
  const dpr = devicePixelRatio;
  const charger = async (b64) => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0); return { x, w: img.width, h: img.height }; };
  const A = await charger(a64), Bz = await charger(b64);
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = (p) => 0.2126 * lin(p[0]) + 0.7152 * lin(p[1]) + 0.0722 * lin(p[2]);
  const ratio = (a, b) => { const p = lum(a), q = lum(b); return (Math.max(p, q) + 0.05) / (Math.min(p, q) + 0.05); };
  const zone = (img, r) => { const x = Math.max(0, Math.floor(r.x * dpr)), y = Math.max(0, Math.floor(r.y * dpr)); const w = Math.max(1, Math.min(img.w - x, Math.ceil(r.w * dpr))), h = Math.max(1, Math.min(img.h - y, Math.ceil(r.h * dpr))); if (x >= img.w || y >= img.h) return null; return { d: img.x.getImageData(x, y, w, h).data, w, h }; };
  const rgb = (p) => 'rgb(' + p.map(Math.round).join(',') + ')';
  const out = [];
  for (const t of textes) {
    let pire = Infinity, fond = null, enc = null;
    for (const l of t.lignes) {
      const zb = zone(Bz, l); if (!zb) continue;
      const pas = Math.max(1, Math.floor(zb.d.length / 4 / 600)); const px = [];
      for (let i = 0; i < zb.d.length; i += 4 * pas) px.push([zb.d[i], zb.d[i + 1], zb.d[i + 2]]);
      px.sort((a, b) => lum(a) - lum(b));
      let fg = null;
      if (t.filtre) {   // un filtre change la couleur peinte : l'encre se lit sur ses pixels (les plus différents du fond)
        const za = zone(A, l); if (za) { const dif = []; for (let i = 0; i < za.d.length; i += 4) { const d = Math.abs(za.d[i] - zb.d[i]) + Math.abs(za.d[i + 1] - zb.d[i + 1]) + Math.abs(za.d[i + 2] - zb.d[i + 2]); if (d > 24) dif.push([d, za.d[i], za.d[i + 1], za.d[i + 2]]); }
          if (dif.length >= 4) { dif.sort((p, q) => q[0] - p[0]); const haut = dif.slice(0, Math.max(1, Math.floor(dif.length * 0.15))); fg = [1, 2, 3].map((k) => haut.reduce((s, p) => s + p[k], 0) / haut.length); } else fg = px[Math.floor(px.length / 2)]; }
      }
      for (const q of [0.2, 0.8]) { const bg = px[Math.min(px.length - 1, Math.floor(px.length * q))]; const f = fg || t.rgb.map((v, i) => v * t.a + bg[i] * (1 - t.a)); const k = ratio(f, bg); if (k < pire) { pire = k; fond = bg; enc = f; } }
    }
    if (fond && pire < t.seuil - 0.005) out.push({ regle: 'contraste', sel: t.sel, texte: t.texte, c: rgb(enc), f: rgb(fond), k: Math.round(pire * 100) / 100, seuil: t.seuil, px: t.px, y: Math.round(t.lignes[0].y) });
  }
  for (const ic of icones) {
    const za = zone(A, ic.r), zb = zone(Bz, ic.r); if (!za || !zb || za.d.length !== zb.d.length) continue;
    const dif = [];
    for (let i = 0; i < za.d.length; i += 4) { const d = Math.abs(za.d[i] - zb.d[i]) + Math.abs(za.d[i + 1] - zb.d[i + 1]) + Math.abs(za.d[i + 2] - zb.d[i + 2]); if (d > 12) dif.push([d, i]); }
    const aire = za.w * za.h;
    if (dif.length < Math.max(4, aire * 0.006)) { const m = Math.floor(zb.d.length / 8) * 4; out.push({ regle: 'icone', sel: ic.sel, texte: ic.texte, c: 'rien de dessiné', f: rgb([zb.d[m], zb.d[m + 1], zb.d[m + 2]]), k: 1, seuil: 3, y: Math.round(ic.r.y) }); continue; }
    dif.sort((p, q) => q[0] - p[0]); const haut = dif.slice(0, Math.max(3, Math.floor(dif.length * 0.3)));
    const ks = haut.map(([, i]) => ratio([za.d[i], za.d[i + 1], za.d[i + 2]], [zb.d[i], zb.d[i + 1], zb.d[i + 2]])).sort((a, b) => a - b);
    const k = ks[Math.floor(ks.length * 0.7)]; const i0 = haut[0][1];
    if (k < 3 - 0.005) out.push({ regle: 'icone', sel: ic.sel, texte: ic.texte, c: rgb([za.d[i0], za.d[i0 + 1], za.d[i0 + 2]]), f: rgb([zb.d[i0], zb.d[i0 + 1], zb.d[i0 + 2]]), k: Math.round(k * 100) / 100, seuil: 3, y: Math.round(ic.r.y) });
  }
  return out;
}

// La page ne bouge plus : aucune mutation pendant `calme` ms (au plus `max`).
function stable({ calme, max }) {
  return new Promise((res) => { let t = null; const t0 = Date.now(); const fin = () => { mo.disconnect(); res(Date.now() - t0); };
    const mo = new MutationObserver(() => { clearTimeout(t); if (Date.now() - t0 > max) return fin(); t = setTimeout(fin, calme); });
    mo.observe(document.body, { childList: true, subtree: true }); t = setTimeout(fin, calme); setTimeout(fin, max); });
}

// ════════════════════════════════════════════════════════════════════════════
//  LE BANC
// ════════════════════════════════════════════════════════════════════════════
function baseLisible() {
  const b = baseFiches();
  const q = fabriquer({ comptes: 3, qr: true });
  const ch = q.rows.filter((r) => /^email_track_chronopost_/.test(r.id));
  if (ch[1] && ch[0]) ch[1].data.lieu = ch[0].data.lieu;
  b.rows.push(...ch.slice(0, 12));
  return b;
}

// La base LÉGÈRE (`BASES=leger`) : celle de la passe de design (3 comptes, ~40 annonces, ventes, achats, messages) + les
// colis au point relais. Les mêmes écrans, dix fois moins de rangées : pour une machine chargée (un onglet de 1 000
// annonces y est tué faute de mémoire). Le verdict de référence reste `volume`.
function baseLegere() {
  const b = P.base();
  const ch = fabriquer({ comptes: 3, qr: true }).rows.filter((r) => /^email_track_chronopost_/.test(r.id));
  if (ch[1] && ch[0]) ch[1].data.lieu = ch[0].data.lieu;
  b.rows.push(...ch.slice(0, 12));
  return b;
}
// La base VIDE : un vendeur qui vient d'arriver (accueil déjà vu), aucun compte, aucune ligne, aucun e-mail.
function baseVide() {
  const b = P.base(); const m = b.main[0].data;
  b.main[0].data = Object.fromEntries(['vrm_bienvenue_vue', 'vrm_visite_vue', 'vrm_je_vends', 'vrm_configuration', 'vrm_plateformes_affichees', 'vrm_parcours', 'vrm_bilan_minute'].filter((k) => k in m).map((k) => [k, m[k]]));
  b.rows = []; b.accounts = []; return b;
}
const apiVide = (u) => { const x = B.apiVolume(u); if (!x || !x.emails) return x; return { ...x, emails: [], suite: false, adresses: [], compteurs: { sur: 0, plus: false, integre: 0, aVerifier: 0, erreur: 0, incompris: 0, parRubrique: { ventes: 0, achats: 0, codes: 0, colis: 0, offres: 0, autres: 0 } } }; };
const { pasVersReglage } = require('./_reglages-compat.cjs');
const defauts = [];          // { groupe, ecran, hab, W, th, regle, sel, texte, c, f, k, seuil, note, chantier }
const etats = [];            // { groupe, ecran, hab, W, th, textes, inter, n, joignable }
const injoignables = [];

async function toucher(o, sel, t = 7000) {
  const l = o.pg.locator(sel).locator('visible=true').first();
  try { await l.waitFor({ state: 'visible', timeout: t }); } catch (_) { return false; }
  try { await l.scrollIntoViewIfNeeded({ timeout: 1500 }); } catch (_) {}
  try { if (o.tel) await l.tap({ timeout: 2500 }); else await l.click({ timeout: 2500 }); return true; } catch (_) {}
  try { await l.evaluate((e) => e.click()); return true; } catch (_) { return false; }
}
// Un état qui ne répond plus (une page figée par un geste) ne fige pas le banc : passé le délai, il est dit « pas joignable »
// et la page est rouverte pour la suite.
const avecDelai = (p, ms, quoi) => { let t; return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(new Error('délai de ' + Math.round(ms / 1000) + ' s dépassé (' + quoi + ')')), ms); })]).finally(() => clearTimeout(t)); };
const DELAI_ETAT = Number(process.env.DELAI_ETAT || 75000);
const calme = (pg, c = 250, max = 2500) => pg.evaluate(stable, { calme: c, max }).catch(() => {});

async function jouer(o, etapes) {
  const pg = o.pg;
  for (const e of etapes || []) {
    if (e.si && !e.si(o.c)) continue;
    if (e.aller) { await pg.evaluate((q) => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: q })), e.aller); await pg.waitForTimeout(350); await calme(pg, 300, 3000); }
    else if (e.clic) { let ok = await toucher(o, e.clic, e.facultatif ? 1500 : 7000); if (!ok && e.ou) { ok = true; for (const x of e.ou) { if (!(await jouer(o, [x]))) { ok = false; break; } } } if (!ok && !e.facultatif) return false; await pg.waitForTimeout(350); await calme(pg, 300, 3500); }
    else if (e.evt) { await pg.evaluate(([n, d]) => window.dispatchEvent(d === undefined ? new Event(n) : new CustomEvent(n, { detail: d })), e.evt); await pg.waitForTimeout(450); await calme(pg, 300, 4000); }
    else if (e.ls) { await pg.evaluate(([k, v]) => { try { localStorage.setItem(k, v); window.dispatchEvent(new CustomEvent('vrm:save', { detail: { k } })); } catch (_) {} }, e.ls); }
    else if (e.reglage) { for (let i = 0; i < 6; i++) { const r = await pg.evaluate(pasVersReglage, e.reglage).catch(() => 'rien'); if (r !== 'retour' && r !== 'categorie') break; await pg.waitForTimeout(280); } await calme(pg, 250, 2500); }
    else if (e.loupe) {
      if (o.tel) { if (!(await toucher(o, 'button[data-recherche-loupe]'))) return false; } else { await pg.mouse.click(700, 500).catch(() => {}); await pg.keyboard.press('Control+K'); }
      await pg.waitForSelector('[data-recherche-champ]', { timeout: 5000 }).catch(() => {});
      await pg.evaluate((v) => { const el = document.querySelector('[data-recherche-champ]'); if (!el) return; const poser = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; poser.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); }, e.loupe);
      await pg.waitForTimeout(900); await calme(pg, 300, 3000);
    }
    else if (e.touche) { await pg.keyboard.press(e.touche); await pg.waitForTimeout(250); }
    else if (e.pause) await pg.waitForTimeout(e.pause);
    else if (e.attendre) await pg.waitForSelector(e.attendre, { timeout: 6000 }).catch(() => {});
  }
  return true;
}

// Le défilement de l'écran : la fenêtre, ou le conteneur qui défile (une feuille, un panneau).
function defiler(vers) {
  const H = innerHeight;
  // la couche du dessus qui défile : la dernière feuille ouverte, sinon la page
  const feuilles = [...document.querySelectorAll('[role="dialog"], .vrm-fs, .vrm-fs-cadre, .sb-feuille')].filter((e) => e.getClientRects().length);
  let cible = null;
  for (const f of feuilles.reverse()) { const cands = [f, ...f.querySelectorAll('*')].filter((e) => { const c = getComputedStyle(e); return /auto|scroll/.test(c.overflowY) && e.scrollHeight > e.clientHeight + 40 && e.clientHeight > H * 0.3; }); if (cands.length) { cible = cands[0]; break; } if (feuilles.length) { cible = 'aucun'; break; } }
  if (cible === 'aucun') return { fait: false, reste: 0 };
  if (!cible) { const se = document.scrollingElement; if (se.scrollHeight > H + 40) cible = se; else { const m = [...document.querySelectorAll('.vrm-main, .vrm-main *')].find((e) => { const c = getComputedStyle(e); return /auto|scroll/.test(c.overflowY) && e.scrollHeight > e.clientHeight + 40 && e.clientHeight > H * 0.4; }); cible = m || se; } }
  const max = cible.scrollHeight - cible.clientHeight; const avant = cible.scrollTop;
  const y = vers === 'haut' ? 0 : vers === 'bas' ? max : Math.min(max, avant + Math.round(cible.clientHeight * 0.85));
  cible.scrollTo({ top: y, behavior: 'instant' });
  return { fait: Math.abs(cible.scrollTop - avant) > 4, reste: max - cible.scrollTop, max };
}

async function relever(o, opts) {
  const pg = o.pg;
  const col = await pg.evaluate(collecter, { tel: o.tel, ...opts });
  const a = await pg.screenshot({ animations: 'disabled', caret: 'hide' });
  let jug = [];
  if (col.textes.length || col.icones.length) {
    await pg.evaluate((css) => { const st = document.createElement('style'); st.id = 'banc-lisible-sans'; st.textContent = css; document.head.appendChild(st); }, STYLE_SANS);
    const b = await pg.screenshot({ animations: 'disabled', caret: 'hide' });
    await pg.evaluate(() => { const st = document.getElementById('banc-lisible-sans'); if (st) st.remove(); });
    jug = await pg.evaluate(juger, { a64: a.toString('base64'), b64: b.toString('base64'), textes: col.textes, icones: col.icones }).catch((e) => { console.log('   (jugement raté : ' + String(e.message || e).slice(0, 120) + ')'); return []; });
  }
  return { col, jug, a };
}

async function mesurerEtat(o, ecran, jeton) {
  const pg = o.pg, c = o.c;
  await pg.evaluate(() => { for (const t of document.querySelectorAll('.vrm-toast, .vrm-toasts button[aria-label]')) { try { t.click(); } catch (_) {} } }).catch(() => {});
  await pg.evaluate(defiler, 'haut').catch(() => {});
  await pg.waitForTimeout(120);
  const vus = new Map(); let nT = 0, nI = 0;
  const ranger = (l) => { for (const d of l) { const cle = d.regle + '|' + d.sel + '|' + d.texte; if (!vus.has(cle)) vus.set(cle, d); } };
  const garder = (x, suf) => { if (process.env.CAPTURES_TOUTES && CAPTURES !== 'non') { const dossier = path.join(SHOTS, c.hab, `${c.W}-${c.th}`); fs.mkdirSync(dossier, { recursive: true }); fs.writeFileSync(path.join(dossier, `${ecran.id}-${suf}.png`), x.a); } };
  let r = await relever(o, { premier: true, bas: false });
  nT += r.col.n.textes; nI += r.col.n.inter; ranger(r.col.geo); ranger(r.jug);
  if (CAPTURES !== 'non') {
    const dossier = path.join(SHOTS, c.hab, `${c.W}-${c.th}`); fs.mkdirSync(dossier, { recursive: true });
    if (CAPTURES === 'png') fs.writeFileSync(path.join(dossier, ecran.id + '.png'), r.a);
    else await pg.screenshot({ path: path.join(dossier, ecran.id + '.jpg'), type: 'jpeg', quality: 72, animations: 'disabled' }).catch(() => {});
  }
  // les écrans suivants du défilement, puis le bas de page (la barre du bas se juge là)
  let d = { fait: false, reste: 0 };
  for (let p = 1; p < PAGES; p++) { d = await pg.evaluate(defiler, 'suite').catch(() => ({ fait: false, reste: 0 })); if (!d.fait) break; await pg.waitForTimeout(160); r = await relever(o, { premier: false, bas: d.reste <= 4 }); garder(r, 'p' + (p + 1)); nT += r.col.n.textes; nI += r.col.n.inter; ranger(r.col.geo); ranger(r.jug); if (d.reste <= 4) break; }
  if (d.reste > 4 || (!d.fait && PAGES === 1)) { const b = await pg.evaluate(defiler, 'bas').catch(() => ({ fait: false })); if (b.fait) { await pg.waitForTimeout(260); await calme(pg, 200, 1500); r = await relever(o, { premier: false, bas: true }); garder(r, 'bas'); nT += r.col.n.textes; nI += r.col.n.inter; ranger(r.col.geo); ranger(r.jug); } }
  else if (!d.fait) { // une page qui tient dans l'écran : le bas, c'est ici
    const col = await pg.evaluate(collecter, { tel: o.tel, premier: false, bas: true }).catch(() => null); if (col) ranger(col.geo.filter((x) => x.regle === 'sous-barre')); }
  await pg.evaluate(defiler, 'haut').catch(() => {});
  if (jeton && jeton.abandonne) return;   // l'essai a dépassé son délai : c'est l'essai rejoué qui compte
  const liste = [...vus.values()].map((x) => { const y = { groupe: ecran.groupe, ecran: ecran.id, hab: c.hab, W: c.W, th: c.th, ...x }; y.chantier = chantierDe(y, c); return y; });
  defauts.push(...liste);
  etats.push({ groupe: ecran.groupe, ecran: ecran.id, hab: c.hab, W: c.W, th: c.th, textes: nT, inter: nI, n: liste.filter((x) => !x.chantier).length, autres: liste.filter((x) => x.chantier).length });
  const miens = liste.filter((x) => !x.chantier), autres = liste.filter((x) => x.chantier);
  const parRegle = (l) => { const m = {}; for (const x of l) m[x.regle] = (m[x.regle] || 0) + 1; return Object.entries(m).map(([k, v]) => `${k} ${v}`).join(' · '); };
  console.log(`${miens.length ? '❌' : '✅'} ${ecran.id} · ${c.hab} · ${c.W} · ${c.th} — ${nT} textes, ${nI} contrôles${miens.length ? ' — ' + miens.length + ' défaut(s) : ' + parRegle(miens) : ''}${autres.length ? ` — (${autres.length} à d’autres chantiers : ${parRegle(autres)})` : ''}`);
  for (const x of miens.slice(0, DETAIL)) console.log('     ' + ligne(x));
}
const ligne = (x) => `${x.regle}${x.k !== undefined ? ' ' + x.k + '<' + x.seuil : ''} « ${x.texte} » ${x.sel}${x.c ? ` (${x.c} sur ${x.f})` : ''}${x.note ? ' — ' + x.note : ''}`;

async function remettre(o) {
  const pg = o.pg;
  for (let i = 0; i < 3; i++) {
    const ouvert = await pg.evaluate(() => [...document.querySelectorAll('[role="dialog"], [role="alertdialog"], .vrm-fs, [data-recherche-panneau]')].some((e) => e.getClientRects().length)).catch(() => false);
    if (!ouvert) return; await pg.keyboard.press('Escape').catch(() => {}); await pg.waitForTimeout(260);
  }
  // rien n'y fait : on relit la page (l'état d'une feuille ne doit pas déteindre sur l'écran suivant)
  await pg.goto(`http://localhost:${P.PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' }).catch(() => {}); await P.pret(pg);
}

async function ouvrirConfig(nav, c, b, sansSession, url) {
  const o = await P.ouvrir(nav, { W: c.W < 600 ? 390 : 1512, sombre: c.th === 'sombre', b, url: '/manifest.webmanifest', api: c.base === 'vide' ? apiVide : B.apiVolume, sansSession });
  if (c.W >= 600 && c.W !== 1512) await o.pg.setViewportSize({ width: c.W, height: c.W <= 1280 ? 800 : 950 });
  o.pg.on('dialog', (d) => d.dismiss().catch(() => {}));
  // `natif` (le seul design depuis le 19 nov.) : aucun réglage posé. Les trois habillages d'avant ne servent qu'à juger un arbre d'avant (BANC_DIST).
  await o.pg.evaluate(([hab]) => { try { sessionStorage.setItem('banc_defaut_v2', '1'); if (hab === 'natif') { localStorage.removeItem('vrm_design_v2'); localStorage.removeItem('vrm_style'); return; } localStorage.setItem('vrm_design_v2', hab === 'ancien' ? '0' : '1'); if (hab === 'apple') localStorage.setItem('vrm_style', 'apple'); else localStorage.removeItem('vrm_style'); } catch (_) {} }, [c.hab0]);
  await o.pg.goto(`http://localhost:${P.PORT}${sansSession ? (url || '/') : '/?tab=journee'}`, { waitUntil: 'domcontentloaded' });
  if (sansSession) await o.pg.waitForTimeout(3500); else { await P.pret(o.pg); await o.pg.waitForTimeout(1800); }
  // (dans la couche `n-anciens`, la première nommée : hors couche, la mutation perdrait contre ses `!important` et ne prouverait rien)
  if (MUT === 'blanc') await o.pg.addStyleTag({ content: '@layer n-anciens { html body #root :is(.vrm-main, .vrm-app-header) :is(h1, h2, .v2-titre, .vrm-set-h1, .vrm-screen-titre) { color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF !important } }' });
  o.c = c; o.tel = c.W < 600;
  return o;
}

// Paramètres : les catégories puis chaque sous-page, LUES dans la page (une rangée ajoutée demain est ouverte demain).
async function genererParametres(o) {
  const pg = o.pg; const out = [];
  await jouer(o, [{ aller: '?tab=settings' }, { reglage: '@racine' }]);
  const cats = await pg.evaluate(() => [...new Set([...document.querySelectorAll('[data-categorie-ouvrir]')].filter((e) => e.getClientRects().length).map((e) => e.getAttribute('data-categorie-ouvrir')))]).catch(() => []);
  for (const cat of cats) {
    out.push({ id: 'param-cat-' + cat, groupe: 'Paramètres', etapes: [{ aller: '?tab=settings' }, { reglage: '@racine' }, { clic: `[data-categorie-ouvrir="${cat}"]` }], preuve: '.vrm-set[data-parametres]' });
    if (!SOUSPAGES) continue;
    await jouer(o, [{ aller: '?tab=settings' }, { reglage: '@racine' }, { clic: `[data-categorie-ouvrir="${cat}"]` }]);
    const sous = await pg.evaluate(() => [...new Set([...document.querySelectorAll('[data-sous-ouvrir]')].filter((e) => e.getClientRects().length && !e.disabled).map((e) => e.getAttribute('data-sous-ouvrir')))]).catch(() => []);
    for (const s of sous) out.push({ id: 'param-' + s, groupe: 'Paramètres', etapes: [{ aller: '?tab=settings' }, { reglage: s }, { clic: `[data-sous-ouvrir="${s}"]` }], preuve: '.vrm-set[data-parametres]' });
  }
  await jouer(o, [{ aller: '?tab=settings' }, { reglage: '@racine' }]);
  const vus = new Set(); return out.filter((e) => !vus.has(e.id) && vus.add(e.id));
}

(async () => {
  const t0 = Date.now();
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  const bases = { volume: BASES.includes('volume') ? baseLisible() : null, leger: BASES.includes('leger') ? baseLegere() : null, vide: BASES.includes('vide') ? baseVide() : null };
  try {
    for (const base of BASES) for (const hab0 of HABILLAGES) for (const W of LARGEURS) for (const th of THEMES) {
      const hab = hab0 + (base === 'volume' ? '' : '-' + base); const b = bases[base]; if (!b) continue;
      const c = { hab, hab0, base, W, th, tel: W < 600, v2: hab0 !== 'ancien' };
      console.log(`\n══ ${hab} · ${W} · ${th} ══`);
      let o = null;
      try {
        o = await ouvrirConfig(nav, c, b, false);
        const attr = await o.pg.evaluate(() => ({ d: document.documentElement.getAttribute('data-design'), s: document.documentElement.getAttribute('data-theme-style'), t: document.documentElement.getAttribute('data-theme'), main: !!document.querySelector('.vrm-main') }));
        const bon = attr.main && (th === 'sombre') === (attr.t === 'dark') && (hab0 === 'natif' || ((hab0 === 'ancien' ? attr.d === null : attr.d === 'v2') && (hab0 === 'apple' ? attr.s === 'apple' : attr.s !== 'apple')));
        if (!bon) { injoignables.push({ ecran: '(habillage)', hab, W, th, note: JSON.stringify(attr) }); console.log(`⚠️  l’habillage n’est pas posé : ${JSON.stringify(attr)}`); }
        let liste = ECRANS.filter((e) => !e.si || e.si(c));
        if (base !== 'vide' && (!VOULUS.length || VOULUS.some((v) => /^param/i.test(v)))) { try { const gen = await genererParametres(o); const i = liste.findIndex((e) => e.id === 'param-securite-donnees'); liste = [...liste.slice(0, i + 1), ...gen, ...liste.slice(i + 1)]; } catch (e) { console.log('⚠️  Paramètres : sous-pages pas lues — ' + String(e.message || e).slice(0, 160)); } }
        // Un état qui plante (onglet tué par manque de mémoire, capture trop lente sur une machine chargée) est REJOUÉ une fois
        // sur une page neuve ; s'il plante encore, il est dit « pas joignable » — jamais compté vert.
        for (const ecran of liste.filter(veut)) {
          for (let essai = 1; essai <= 2; essai++) {
            const jeton = { abandonne: false };
            try {
              await avecDelai((async () => {
                const tj = Date.now(); const ok = await jouer(o, ecran.etapes);
                const la = ok && (!ecran.preuve || await o.pg.locator(ecran.preuve).locator('visible=true').first().waitFor({ state: 'visible', timeout: 7000 }).then(() => true, () => false));
                if (jeton.abandonne) return;
                if (!la) { injoignables.push({ ecran: ecran.id, hab, W, th, note: ok ? 'preuve absente : ' + ecran.preuve : 'une étape n’a pas pu se jouer' }); console.log(`⚠️  ${ecran.id} · ${hab} · ${W} · ${th} : pas joignable (${ok ? 'preuve absente' : 'étape'})`); }
                else { const tm = Date.now(); await mesurerEtat(o, ecran, jeton); if (process.env.TEMPS) console.log(`     (jeu ${tm - tj} ms · mesure ${Date.now() - tm} ms)`); }
                if (ecran.apres) await jouer(o, ecran.apres);
                await remettre(o).catch(() => {});
              })(), DELAI_ETAT, ecran.id);
              break;
            } catch (err) {
              jeton.abandonne = true;
              const mot = String(err.message || err).slice(0, 160);
              if (essai === 2) { injoignables.push({ ecran: ecran.id, hab, W, th, note: mot }); console.log(`⚠️  ${ecran.id} · ${hab} · ${W} · ${th} : ${mot}`); }
              else console.log(`   (${ecran.id} : ${mot} — rejoué sur une page neuve)`);
              // la page ne répond peut-être plus : on la ferme et on en rouvre une
              const vieux = o; o = null; if (vieux) await avecDelai(vieux.ctx.close(), 8000, 'fermeture').catch(() => {});
              o = await avecDelai(ouvrirConfig(nav, c, b, false), 120000, 'réouverture');
            }
          }
        }
        if (o && o.erreurs.length) console.log(`   (erreurs de page : ${[...new Set(o.erreurs)].slice(0, 3).join(' | ')})`);
      } catch (err) { injoignables.push({ ecran: '(ouverture)', hab, W, th, note: String(err.message || err).slice(0, 200) }); console.log(`⚠️  ${hab} · ${W} · ${th} : ouverture — ${String(err.message || err).slice(0, 200)}`); }
      finally { if (o) await o.ctx.close().catch(() => {}); }
      // la connexion, sans session
      for (const ecran of ECRANS_SANS_SESSION.filter(veut)) {
        let s = null;
        try { s = await ouvrirConfig(nav, c, b, true, ecran.url); const la = await s.pg.locator(ecran.preuve).locator('visible=true').first().waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false);
          if (!la) { injoignables.push({ ecran: ecran.id, hab, W, th, note: 'preuve absente' }); console.log(`⚠️  ${ecran.id} · ${hab} · ${W} · ${th} : pas joignable`); } else await mesurerEtat(s, ecran);
        } catch (err) { injoignables.push({ ecran: ecran.id, hab, W, th, note: String(err.message || err).slice(0, 160) }); }
        finally { if (s) await s.ctx.close().catch(() => {}); }
      }
    }
  } catch (e) { console.log('❌ le banc s’est arrêté : ' + String(e && e.stack || e).slice(0, 1200)); injoignables.push({ ecran: '(banc)', note: String(e && e.message || e) }); }
  await nav.close().catch(() => {}); P.srv.close();

  // ── Le rapport ──
  const miens = defauts.filter((d) => !d.chantier), autres = defauts.filter((d) => d.chantier);
  const txt = [];
  for (const d of defauts) txt.push(`${d.chantier ? '[' + d.chantier + '] ' : ''}${d.groupe} · ${d.ecran} · ${d.hab} · ${d.W} · ${d.th} · ${ligne(d)}`);
  fs.writeFileSync(path.join(SHOTS, 'rapport.txt'), txt.join('\n') + '\n');
  fs.writeFileSync(path.join(SHOTS, 'rapport.json'), JSON.stringify({ quand: new Date().toISOString(), dist: process.env.BANC_DIST || 'dist', largeurs: LARGEURS, themes: THEMES, habillages: HABILLAGES, bases: BASES, resume: (() => { const r = {}; for (const e of etats) { const x = r[e.groupe] || (r[e.groupe] = { etats: 0, lot: 0, autres: 0 }); x.etats++; x.lot += e.n; x.autres += e.autres; } return r; })(), etats, defauts, injoignables }));
  const groupes = [...new Set(etats.map((e) => e.groupe))];
  const REGLES = ['contraste', 'icone', 'vide', 'degrade', 'flou', 'deborde', 'coupe', 'sous-barre', 'cible'];
  console.log('\n══ PAR ÉCRAN (défauts de ce lot · à d’autres chantiers) ══');
  console.log('écran'.padEnd(14) + 'états'.padStart(6) + REGLES.map((r) => r.padStart(11)).join('') + '      total   (autres)');
  const resume = {};
  for (const g of groupes) {
    const m = miens.filter((d) => d.groupe === g), a = autres.filter((d) => d.groupe === g);
    resume[g] = { etats: etats.filter((e) => e.groupe === g).length, lot: m.length, autres: a.length };
    console.log(g.padEnd(14) + String(etats.filter((e) => e.groupe === g).length).padStart(6) + REGLES.map((r) => String(m.filter((d) => d.regle === r).length).padStart(11)).join('') + String(m.length).padStart(11) + String(a.length).padStart(11));
  }
  console.log('TOTAL'.padEnd(14) + String(etats.length).padStart(6) + REGLES.map((r) => String(miens.filter((d) => d.regle === r).length).padStart(11)).join('') + String(miens.length).padStart(11) + String(autres.length).padStart(11));
  console.log('\n══ PAR HABILLAGE ══');
  for (const h of [...new Set(etats.map((e) => e.hab))]) for (const th of THEMES) console.log(`${h} · ${th}`.padEnd(18) + LARGEURS.map((W) => `${W} : ${miens.filter((d) => d.hab === h && d.th === th && d.W === W).length}`.padEnd(14)).join(''));
  // les signatures les plus fréquentes : une règle d'écran corrigée en éteint beaucoup d'un coup
  const sig = new Map(); for (const d of miens) { const k = d.regle + ' ' + d.sel.split(' > ').slice(-2).join(' > ') + (d.c ? ` (${d.c} sur ${d.f})` : ''); const s = sig.get(k) || { n: 0, ex: d }; s.n++; sig.set(k, s); }
  const tri = [...sig.entries()].sort((x, y) => y[1].n - x[1].n).slice(0, Number(process.env.SIGNATURES || 25));
  if (tri.length) { console.log('\n══ LES PLUS FRÉQUENTS ══'); for (const [k, s] of tri) console.log(String(s.n).padStart(5) + ' × ' + k + ' — ex. « ' + s.ex.texte + ' » (' + s.ex.ecran + ' · ' + s.ex.hab + ' · ' + s.ex.W + ' · ' + s.ex.th + ')'); }
  if (autres.length) { console.log('\n══ AUX AUTRES CHANTIERS (listés, pas comptés) ══'); for (const h of HORS) { const l = autres.filter((d) => d.chantier === h.nom); if (l.length) console.log(String(l.length).padStart(5) + ' × ' + h.quoi + ' — ex. ' + ligne(l[0]) + ' (' + l[0].ecran + ' · ' + l[0].hab + ' · ' + l[0].W + ')'); } }
  if (injoignables.length) { console.log('\n══ PAS JOIGNABLES (à réparer dans le banc, jamais comptés verts) ══'); const m = new Map(); for (const i of injoignables) { const k = i.ecran + ' — ' + i.note; m.set(k, (m.get(k) || []).concat(`${i.hab || ''} ${i.W || ''} ${i.th || ''}`.trim())); } for (const [k, v] of m) console.log(`  ⚠️  ${k} (${v.length} : ${v.slice(0, 4).join(', ')}${v.length > 4 ? '…' : ''})`); }
  const min = Math.round((Date.now() - t0) / 60000);
  console.log(`\n${miens.length ? '❌' : '✅'} lisible-partout : ${etats.length} états ouverts, ${miens.length} défaut(s) à ce lot, ${autres.length} à d’autres chantiers, ${injoignables.length} pas joignable(s) — ${min} min — rapport : ${path.join(SHOTS, 'rapport.txt')}`);
  process.exit(miens.length ? 1 : injoignables.length ? 2 : 0);
})();
