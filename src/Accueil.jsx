// ══════════════════════════════════════════════════════════════════════════
// LA PAGE D'ACCUEIL PUBLIQUE — ce que voit quelqu'un qui ne connaît pas VRM
// ══════════════════════════════════════════════════════════════════════════
// Julien, 11 octobre : « c'est vraiment pas intuitif, on ne comprend pas trop
// ce que c'est ; il faut vraiment qu'il soit super celui-là ».
//
// LA PAGE RACONTE LA JOURNÉE D'UN REVENDEUR. Une pastille dit ce qu'est VRM, le
// titre promet (« Tu ouvres VRM. Tu sais quoi faire. »), et à côté la carte
// « Aujourd'hui » montre — sans qu'on lise — ses comptes qui se replient en un,
// puis une vente qui crée toute seule ce qu'il y a à faire. Trois sections
// répondent ensuite aux trois questions de sa journée : 8 h 02 quels colis je
// poste · 8 h 03 vendu ici, encore en ligne ailleurs ? · fin du mois, combien
// je déclare. Un seul article inventé, la N°128, traverse toute la page.
//
// Grammaire du mouvement : ce que VRM fait arrive SANS curseur ; ce que TU fais
// passe par un curseur dessiné. Rien ne boucle : chaque écran joue une fois,
// quand on le voit, en moins de 5 s. « Réduire les animations » : état final.
//
// ⚠️ AUCUNE DONNÉE INVENTÉE PRÉSENTÉE COMME VRAIE (§2.3) : ni nombre de
//    vendeurs, ni étoile, ni avis. La démo dit « exemple ». Le prix vient des
//    CGV (src/accueil-reglages.js, comparé par le banc), et chaque phrase
//    correspond à une fonction qui existe (registre : spec du 11 octobre).
// ⚠️ LÉGÈRE : cette page se charge AVANT l'app. Les écrans du bas
//    (src/accueil-scenes.jsx) arrivent à part, pendant un temps mort ; le film
//    (src/AccueilFilm.jsx) seulement avec `?film`.
import React from 'react';
import { contactEmail, CONTACT_A_VENIR } from './contact.js';
import { K, COURBE_SORTIE, OMBRE_CARTE, REFLET, HAUTEURS_SCENES, LARGEUR_COMPACTE } from './accueil-jetons.js';
import { ACCES_OFFERT, EXTENSION_SUR_LE_STORE, DETOURAGE_POUR_TOUS, VESTIAIRE_BRANCHE, PRIX_MOIS } from './accueil-reglages.js';
import { useMoinsDeMouvement, useSansSouris, useTaille } from './accueil-mouvement.js';
import CarteJour from './accueil-carte.jsx';

// ── Les écrans dessinés du bas : un morceau à part ──────────────────────────
let promesseScenes = null;
const chargerScenes = () => (promesseScenes || (promesseScenes = import('./accueil-scenes.jsx')));
const paresseux = (nom) => React.lazy(() => chargerScenes().then((m) => ({ default: m[nom] })));
const SCENES = {
  colis: paresseux('SceneColis'),
  ailleurs: paresseux('SceneAilleurs'),
  urssaf: paresseux('SceneMois'),
  premier: paresseux('ScenePremier'),
};
const LIBELLES = {
  colis: 'Exemple d’écran Colis : trois colis à poster, deux bordereaux prêts ; le bordereau de la N°128 sort avec son numéro imprimé, et le carton 128 est mis en avant.',
  ailleurs: 'Exemple : la N°128 est vendue sur Vinted ; VRM la relie par son numéro à ses annonces Leboncoin et eBay, les signale à retirer, et l’annonce eBay est retirée après confirmation.',
  urssaf: 'Exemple : la vente de la N°128, versée en fin de mois, porte le chiffre à déclarer de 1 159,50 € à 1 244,50 €, toutes plateformes ; le mois est ensuite noté comme déclaré.',
  premier: 'Un bordereau dessiné, tamponné du numéro 1.',
};

// L'emplacement d'un écran : sa boîte est réservée à sa hauteur finale tant que
// le morceau n'est pas arrivé, et porte déjà `data-scene` et `data-etat`.
function Emplacement({ nom, pret }) {
  const boite = React.useRef(null);
  const { w } = useTaille(boite);
  // La feuille de la fin vit dans une boîte de 220 px : elle est compacte sur
  // TÉLÉPHONE (< 760 px), pas parce que sa boîte est étroite.
  const compact = w > 0 && (nom === 'premier' ? window.innerWidth < 760 : w < LARGEUR_COMPACTE);
  const h = HAUTEURS_SCENES[nom][compact ? 1 : 0];
  const Scene = SCENES[nom];
  const reserve = <div className="acc-ecran" data-scene={nom} data-etat="debut" role="img" aria-label={LIBELLES[nom]} style={{ height: h }} />;
  return (
    <div ref={boite} className="acc-emplacement" style={{ minHeight: h }}>
      {pret && w > 0 ? <React.Suspense fallback={reserve}><Scene compact={compact} libelle={LIBELLES[nom]} /></React.Suspense> : reserve}
    </div>
  );
}

// ── Les petites pièces ──────────────────────────────────────────────────────
const Chevron = () => <span className="acc-chev" aria-hidden="true">›</span>;
const ICONES = {
  colis: <path d="M3 6.5 9 3.5l6 3v5L9 14.5 3 11.5zM3 6.5l6 3 6-3M9 9.5v5" />,
  bulle: <path d="M3.5 4.5h11v7h-6l-3.5 3v-3H3.5z" />,
  euro: <><path d="M13 5.2A4.5 4.5 0 1 0 13 12.8" /><path d="M3.5 8h6M3.5 10.2h6" /></>,
  envoi: <path d="M3 9h10M10 5.5 13.5 9 10 12.5M15 4v10" />,
  tel: <><rect x="5" y="2.5" width="8" height="13" rx="2" /><path d="M8 13h2" /></>,
  pile: <path d="M9 3 15 6 9 9 3 6zM3 9l6 3 6-3M3 12l6 3 6-3" />,
  photo: <><rect x="3" y="4.5" width="12" height="9" rx="1.5" /><circle cx="9" cy="9" r="2.3" /></>,
};
const Icone = ({ nom }) => (
  <svg className="acc-icone" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
    <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{ICONES[nom]}</g>
  </svg>
);

// `r` : la réponse sur ordinateur, deux lignes (≤ 96 caractères).
// `c` : la même, courte, sur téléphone (coupe n° 2 du §9 du cahier : une ligne
//       et demie) — elle ne dit rien que `r` ne dise.
// `horsTel` : la question qui n'est PAS rendue sur un téléphone (coupe n° 3) —
//       son contenu passe dans la ligne 2 du haut de page.
const QUESTIONS = [
  { i: 'colis', q: 'Mon colis est au relais : c’est quoi le code ?', r: 'Le code de retrait et le point relais de tes achats, avec le compte qui a acheté.', c: 'Le code de retrait et le point relais, avec le compte qui a acheté.' },
  { i: 'bulle', q: 'Ce message, il est sur quel compte ?', r: 'Tes conversations Vinted, chacune avec son compte ; tu réponds depuis VRM, sur ordinateur.', c: 'Tes conversations Vinted, chacune avec le compte qui l’a reçue.' },
  { i: 'euro', q: 'J’ai combien chez Vinted ?', r: 'L’argent en attente et l’argent disponible, compte par compte — jamais mélangés.', c: 'En attente et disponible, compte par compte — jamais mélangés.' },
  { i: 'envoi', q: 'Je la mets aussi sur Leboncoin et eBay ?', r: 'Sans tout retaper : l’extension remplit l’annonce Leboncoin, l’annonce eBay se crée dans VRM.', c: 'L’extension remplit l’annonce Leboncoin ; eBay se crée dans VRM.' },
  { i: 'tel', q: 'Et sur mon téléphone ?', r: 'Sur ton écran d’accueil : une notification à chaque vente si tu l’actives, un widget sur iPhone.', horsTel: true },
  { i: 'pile', q: 'J’ai plusieurs comptes Vinted.', r: 'C’est fait pour — et un seul marche aussi : chacun se met à jour quand tu l’ouvres dans Chrome.', c: 'Chacun se met à jour quand tu l’ouvres dans ton Chrome.' },
  // N'apparaît que le jour où le détourage est ouvert à tous (src/accueil-reglages.js).
  ...(DETOURAGE_POUR_TOUS ? [{ i: 'photo', q: 'Mes photos sur fond blanc ?', r: 'Tes photos sont détourées avant d’être attachées à ton annonce Leboncoin.' }] : []),
];

const LEGAL = [
  ['Mentions légales', '/legal/mentions-legales.html'], ['CGU', '/legal/cgu.html'], ['CGV', '/legal/cgv.html'],
  ['Confidentialité', '/legal/confidentialite.html'], ['Cookies', '/legal/cookies.html'],
];
const ANCRES = [['colis', 'Colis'], ['ailleurs', 'Vendu ailleurs'], ['urssaf', 'URSSAF'], ['prix', 'Prix'], ['faq', 'Questions']];

const CSS = `
.acc{position:relative;background:${K.bg};color:${K.text};min-height:100vh;font-family:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif;overflow-x:clip;-webkit-font-smoothing:antialiased;font-variant-numeric:normal;font-feature-settings:normal}
@supports not (overflow-x:clip){.acc{overflow-x:hidden}}
.acc *{box-sizing:border-box}
.acc a{color:inherit}
.acc :focus-visible{outline:2px solid ${K.accent};outline-offset:2px;border-radius:8px}
.acc button,.acc a{-webkit-tap-highlight-color:transparent;touch-action:manipulation}
:where(.acc) h1,:where(.acc) h2,:where(.acc) h3{font-family:'Space Grotesk','Inter',system-ui,sans-serif;margin:0;color:${K.text}}
:where(.acc) p{margin:0}
.acc-in{max-width:1180px;margin:0 auto;padding:0 20px}
.acc-sentinelle{position:absolute;top:8px;left:0;width:1px;height:1px;pointer-events:none}

/* La barre : transparente en haut, matière dès qu'on défile. */
.acc-nav{position:sticky;top:0;z-index:30;padding-top:env(safe-area-inset-top);background:rgba(7,9,13,0);border-bottom:1px solid transparent;transition:background-color 200ms ease,border-color 200ms ease}
.acc-nav.defile{background:rgba(7,9,13,.78);-webkit-backdrop-filter:saturate(1.4) blur(14px);backdrop-filter:saturate(1.4) blur(14px);border-bottom-color:${K.line}}
@media (prefers-reduced-transparency:reduce){.acc-nav.defile{background:${K.bg};-webkit-backdrop-filter:none;backdrop-filter:none}}
.acc-nav .acc-in{display:flex;align-items:center;gap:12px;height:64px}
.acc-marque{display:flex;align-items:center;gap:10px;flex-shrink:0;text-decoration:none}
.acc-marque img{width:32px;height:32px;border-radius:8px;display:block}
.acc-marque b{font-family:'Space Grotesk','Inter',sans-serif;font-size:19px;font-weight:700;letter-spacing:.04em}
.acc-ancres{display:flex;gap:2px;margin-left:22px}
.acc-ancres a{color:${K.muted};font-size:14px;font-weight:500;padding:8px 10px;border-radius:8px;text-decoration:none;transition:color 160ms ease}
@media (hover:hover) and (pointer:fine){.acc-ancres a:hover{color:${K.text}}}
.acc-nav-droite{margin-left:auto;display:flex;align-items:center;gap:6px}

/* Les boutons : une forme, trois poids. */
.acc .acc-btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:10px;height:48px;min-height:0;padding:0 20px;border-radius:10px;border:none;cursor:pointer;font-family:'Inter',system-ui,sans-serif;font-size:15px;font-weight:600;letter-spacing:-.005em;white-space:nowrap;text-decoration:none;filter:none;transition:transform 120ms ${COURBE_SORTIE},box-shadow 160ms ${COURBE_SORTIE},opacity 180ms ${COURBE_SORTIE}}
.acc .acc-p{background:${K.cta};color:#FFFFFF;box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 1px 2px rgba(0,0,0,.5),0 8px 24px rgba(36,88,230,.28)}
.acc .acc-btn:active:not(:disabled){transform:scale(.97);filter:none}
.acc .acc-btn:hover{filter:none}
.acc-chev{display:inline-block;font-size:19px;line-height:1;margin-right:-4px;transition:transform 160ms ${COURBE_SORTIE}}
@media (hover:hover) and (pointer:fine){
  .acc .acc-p:hover{box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 1px 2px rgba(0,0,0,.5),0 10px 28px rgba(36,88,230,.36)}
  .acc .acc-btn:hover .acc-chev{transform:translateX(2px)}
}
.acc .acc-lien{display:inline-flex;align-items:center;min-height:44px;padding:0 6px;border:none;background:none;cursor:pointer;font-family:'Inter',system-ui,sans-serif;font-size:14px;font-weight:500;color:${K.muted};text-decoration:none;filter:none}
.acc .acc-lien b{font-weight:600;color:${K.text};margin-left:4px}
@media (hover:hover) and (pointer:fine){.acc .acc-lien:hover b,.acc .acc-lien:hover{text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:1px}}
.acc .acc-lien:active:not(:disabled){transform:none}
.acc-nav .acc-btn{height:38px;padding:0 14px;font-size:14px;gap:8px}
.acc-nav .acc-btn .acc-chev{font-size:17px}
.acc-nav .acc-cta-nav{opacity:0;transform:translateY(4px);pointer-events:none;transition:opacity 150ms ${COURBE_SORTIE},transform 150ms ${COURBE_SORTIE}}
.acc-nav .acc-cta-nav.la{opacity:1;transform:none;pointer-events:auto;transition-duration:180ms}

/* Le haut de page. */
.acc-hero{position:relative;padding:56px 0 64px}
.acc-hero:before{content:"";position:absolute;right:max(0px,calc(50% - 640px));top:-40px;width:760px;height:700px;background:radial-gradient(closest-side,rgba(61,123,255,.12),transparent);pointer-events:none}
.acc-hero .acc-in{position:relative;display:grid;grid-template-columns:minmax(0,580px) minmax(0,500px);gap:60px;align-items:start}
.acc-def{display:inline-flex;align-items:center;font-size:14px;font-weight:600;color:${K.text};background:${K.card2};border:1px solid ${K.line2};border-radius:8px;padding:6px 12px;line-height:1.3;text-wrap:balance}
.acc-h1{font-size:56px;line-height:1.04;letter-spacing:-.03em;font-weight:700;margin:22px 0 0}
.acc-h1 span{display:block}
.acc-h1 .attenue{color:${K.muted}}
.acc-sous{font-size:19px;line-height:1.5;color:${K.text};margin-top:16px;max-width:560px}
.acc-sous em{font-style:normal;color:${K.muted}}
.acc-actions{display:flex;align-items:center;gap:20px;margin-top:28px;flex-wrap:wrap}
.acc-hero .acc-actions .acc-btn{font-size:16px}
.acc-lignes{margin-top:22px;display:flex;flex-direction:column;gap:6px;font-size:14px;line-height:1.5;color:${K.faint}}
.acc-lignes b{color:${K.text};font-weight:600}
.acc-lignes .sep{padding-left:6px;color:${K.faint}}
.acc-lignes .nw{white-space:nowrap}
.acc-carte-jour{position:relative}
.acc-carte-jour:before{content:"";position:absolute;inset:-80px -60px;background:radial-gradient(closest-side,rgba(61,123,255,.12),transparent);pointer-events:none;z-index:0}
.acc-carte-jour > *{position:relative;z-index:1}
.acc-carte-jour > .acc-revoir-l{position:absolute;left:0;right:0;top:100%;height:34px;display:flex;justify-content:flex-end;align-items:center;max-width:500px}
.acc .acc-revoir{display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:0 4px;border:none;background:none;cursor:pointer;font-family:'Inter',system-ui,sans-serif;font-size:13px;font-weight:500;color:${K.muted};animation:accApparait 200ms ${COURBE_SORTIE} both}
@media (hover:hover) and (pointer:fine){.acc .acc-revoir:hover{color:${K.text}}}
@keyframes accApparait{from{opacity:0}to{opacity:1}}

/* APPARITION DU HÉROS AU CHARGEMENT (14 oct.) — première impression. Une
   cascade douce : chaque élément monte de 14 px en fondu, décalé, ease-out
   court, et se fige à l'état final (fill both) — aucun décalage de mise en
   page après. La carte démo arrive un cheveu plus tard. Grammaire du mouvement
   de la page : ca joue UNE fois, au premier regard. Reduire les animations
   coupe tout (etat final direct). */
@keyframes accMonte{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.acc-def,.acc-h1,.acc-sous,.acc-actions,.acc-lignes,.acc-carte-jour{animation:accMonte 560ms ${COURBE_SORTIE} both}
.acc-def{animation-delay:40ms}
.acc-h1{animation-delay:110ms}
.acc-sous{animation-delay:190ms}
.acc-actions{animation-delay:270ms}
.acc-lignes{animation-delay:350ms}
.acc-carte-jour{animation-duration:680ms;animation-delay:180ms}
.acc-hero:before{animation:accApparait 1000ms ${COURBE_SORTIE} both}
@media (prefers-reduced-motion:reduce){
  .acc-def,.acc-h1,.acc-sous,.acc-actions,.acc-lignes,.acc-carte-jour,.acc-hero:before{animation:none!important}
}
/* Apparition au defilement des sections du corps. La classe .acc-reveil n'est
   posee QUE par le script (jamais au rendu) : sans JS, ou si l'observateur ne
   se declenche pas, la section reste visible (un filet la revele apres 1,6 s).
   Reduire les animations : jamais posee. */
.acc-reveil{opacity:0;transform:translateY(22px);transition:opacity 640ms ${COURBE_SORTIE},transform 640ms ${COURBE_SORTIE}}
.acc-reveil.vu{opacity:1;transform:none}
@media (prefers-reduced-motion:reduce){.acc-reveil{opacity:1!important;transform:none!important;transition:none!important}}

/* Les sections. */
.acc-sec{position:relative;padding:64px 0;scroll-margin-top:80px}
.acc-quand{font-size:13px;font-weight:500;color:${K.muted};margin-bottom:12px}
.acc-quand b{color:${K.text};font-weight:600}
.acc-h2{font-size:40px;line-height:1.1;letter-spacing:-.02em;font-weight:700}
.acc-rep{font-size:19px;line-height:1.5;color:${K.text};margin-top:14px}
.acc-roles{margin-top:18px;display:flex;flex-direction:column;gap:8px;font-size:14px;line-height:1.5;color:${K.muted}}
.acc-roles b{font-weight:600;margin-right:8px}
.acc-roles .vrm{color:${K.text}}
.acc-roles .toi{color:${K.muted}}
.acc-prec{margin:16px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px;font-size:14px;line-height:1.5;color:${K.muted}}
.acc-prec li{position:relative;padding-left:14px}
.acc-prec li:before{content:"";position:absolute;left:0;top:.62em;width:4px;height:4px;border-radius:2px;background:${K.faint}}
.acc-emplacement{position:relative;width:100%}
.acc-ecran{position:relative;width:100%}
.acc-g1{display:grid;grid-template-columns:minmax(0,460px) minmax(0,600px);gap:80px;align-items:center;justify-content:space-between}
.acc-g2-texte{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:60px;align-items:end;margin-bottom:32px}
.acc-g2-texte .acc-roles{margin-top:0}
.acc-g3{display:grid;grid-template-columns:minmax(0,560px) minmax(0,480px);gap:80px;align-items:center;justify-content:space-between}

/* Le fil de la journée (ordinateur large seulement, CSS seul). ⚠️ Pas sous
   1 440 px : vu au rendu à 1 366 px, son repère « 8 h 02 » sortait par la
   gauche de l'écran (coupé net, sans débordement mesurable : overflow clip). */
.acc-fil{display:none}
@media (min-width:1440px){
  .acc-fil{display:block;position:absolute;left:calc(50% - 620px);top:0;bottom:0;width:1px;background:${K.line2};pointer-events:none}
  .acc-fil i{position:absolute;inset:0;background:rgba(238,241,246,.4);transform-origin:top}
  .acc-fil span{position:absolute;right:12px;top:64px;white-space:nowrap;font-size:13px;font-weight:500;color:${K.muted};line-height:18px}
  .acc-fil span:after{content:"";position:absolute;right:-16px;top:6px;width:7px;height:7px;border-radius:50%;background:${K.bg};border:1px solid rgba(238,241,246,.5)}
}
@supports (animation-timeline:view()){
  .acc-fil i{animation:accRemplit linear both;animation-timeline:view();animation-range:entry 20% cover 55%}
}
@keyframes accRemplit{from{transform:scaleY(0)}to{transform:scaleY(1)}}
@media (prefers-reduced-motion:reduce){.acc-fil i{animation:none!important;transform:none!important}}

/* Les petites questions. */
.acc-qs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:16px}
.acc-q{background:${K.card};border:1px solid ${K.line};border-radius:12px;padding:18px;box-shadow:${REFLET}}
.acc-q .acc-icone{color:${K.muted};flex-shrink:0;margin-top:1px}
.acc-q h3{display:flex;align-items:flex-start;gap:10px;font-family:'Inter',system-ui,sans-serif;font-size:15px;font-weight:600;line-height:1.35;letter-spacing:-.005em}
.acc-q p{font-size:14px;line-height:1.45;color:${K.muted};margin-top:6px}
/* Les cartes répondent sous le curseur (sur SOURIS seulement — sur mobile un
   survol reste collé après un tap, et la carte-question y est de toute façon
   sans cadre). §7 : on réutilise les ombres existantes, aucune couleur neuve. */
@media (hover:hover) and (pointer:fine){
  .acc-q{transition:transform 180ms ${COURBE_SORTIE},box-shadow 180ms ${COURBE_SORTIE}}
  .acc-q:hover{transform:translateY(-2px);box-shadow:${REFLET},${OMBRE_CARTE}}
  .acc-prix{transition:transform 200ms ${COURBE_SORTIE}}
  .acc-prix:hover{transform:translateY(-2px)}
  .acc-marque img{transition:transform 220ms ${COURBE_SORTIE}}
  .acc-marque:hover img{transform:scale(1.05)}
}
@media (prefers-reduced-motion:reduce){.acc-q:hover,.acc-prix:hover,.acc-marque:hover img{transform:none!important}}

/* L'installation, puis la confiance. */
.acc-bande{background:${K.surface};border-top:1px solid ${K.line};border-bottom:1px solid ${K.line}}
.acc-deux{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:72px;align-items:start}
.acc-h2b{font-size:28px;line-height:1.15;letter-spacing:-.02em;font-weight:700}
.acc-etapes{list-style:none;margin:24px 0 0;padding:0;display:flex;flex-direction:column;gap:18px}
.acc-etapes li{display:flex;gap:14px;align-items:flex-start}
.acc-etapes .n{width:28px;height:28px;border-radius:8px;background:${K.card2};border:1px solid ${K.line2};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;color:${K.text};flex-shrink:0}
.acc-etapes h3{font-family:'Inter',system-ui,sans-serif;font-size:16px;font-weight:600;line-height:1.35;letter-spacing:0;margin-top:3px}
.acc-etapes p{font-size:15px;line-height:1.55;color:${K.muted};margin-top:3px}
.acc-conf p{font-size:15px;line-height:1.6;color:${K.muted};margin-top:14px}
.acc-conf p:first-of-type{margin-top:24px;color:${K.text}}
.acc-conf p b{color:${K.text};font-weight:600}

/* Le prix et les questions. */
.acc-g-prix{display:grid;grid-template-columns:minmax(0,480px) minmax(0,1fr);gap:64px;align-items:start}
.acc-prix{background:${K.card};border:1px solid ${K.line2};border-radius:12px;padding:28px;box-shadow:${REFLET},${OMBRE_CARTE}}
.acc-offert{display:inline-flex;font-size:13px;font-weight:600;color:${K.text};background:${K.card2};border:1px solid ${K.line2};border-radius:8px;padding:4px 10px;margin-top:16px}
.acc-gros{display:flex;align-items:baseline;gap:10px;margin-top:12px}
.acc-gros b{font-family:'Space Grotesk','Inter',sans-serif;font-size:52px;font-weight:700;letter-spacing:-.02em;line-height:1;font-variant-numeric:tabular-nums}
.acc-gros span{font-size:16px;color:${K.muted}}
.acc-prix ul{list-style:none;margin:16px 0 0;padding:0;display:flex;flex-direction:column;gap:4px;font-size:15px;line-height:1.5;color:${K.text}}
.acc-prix .petit{font-size:14px;line-height:1.5;color:${K.muted};margin-top:14px}
.acc-prix .petit a{color:${K.text};text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:1px}
.acc-prix .acc-btn{width:100%;margin-top:20px}
.acc-faq h2{font-size:28px;line-height:1.15;letter-spacing:-.02em;font-weight:700;margin-bottom:8px}
.acc-faq details{border-bottom:1px solid ${K.line}}
.acc-faq summary{list-style:none;cursor:pointer;min-height:52px;padding:14px 0;font-size:16px;font-weight:600;line-height:1.4;display:flex;justify-content:space-between;gap:16px;align-items:center}
.acc-faq summary::-webkit-details-marker{display:none}
.acc-faq summary:after{content:"+";font-size:22px;line-height:1;color:${K.muted};font-weight:400;flex-shrink:0;transition:transform 200ms ${COURBE_SORTIE}}
.acc-faq details[open] summary:after{transform:rotate(45deg)}
.acc-faq details p{margin:0 0 16px;font-size:15px;line-height:1.6;color:${K.muted};max-width:640px}
.acc-faq details[open] p{animation:accApparait 150ms ease both}
.acc-faq details p a{color:${K.text};text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:1px}

/* La fin. */
.acc-fin{position:relative;text-align:center;padding:64px 0}
.acc-fin:before{content:"";position:absolute;left:50%;top:0;width:900px;height:420px;transform:translateX(-50%);background:radial-gradient(closest-side,rgba(61,123,255,.08),transparent);pointer-events:none}
.acc-fin .acc-in{position:relative;display:flex;flex-direction:column;align-items:center}
.acc-fin-feuille{display:flex;flex-direction:column;align-items:center}
.acc-fin-texte{display:flex;flex-direction:column;align-items:center}
.acc-fin .acc-emplacement{width:220px}
.acc-fin .note{font-size:14px;color:${K.muted};margin-top:12px}
.acc-fin .acc-h2{margin-top:22px}
.acc-fin .texte{font-size:16px;line-height:1.55;color:${K.muted};margin-top:12px;max-width:520px}
.acc-fin .acc-actions{justify-content:center}
@media (min-width:1100px){
  .acc-fin .acc-in{flex-direction:row;justify-content:center;align-items:center;gap:64px}
  .acc-fin-texte{align-items:flex-start;text-align:left}
  .acc-fin .acc-h2{margin-top:0}
  .acc-fin .texte{max-width:720px}
  .acc-fin .acc-actions{justify-content:flex-start;margin-top:24px}
}

/* Le pied de page. */
.acc-pied{border-top:1px solid ${K.line};padding:28px 0 36px;font-size:13px;color:${K.faint}}
.acc-pied .acc-in{display:flex;gap:14px 28px;flex-wrap:wrap;align-items:center;justify-content:space-between}
.acc-pied nav{display:flex;gap:4px 16px;flex-wrap:wrap}
.acc-pied a{text-decoration:none;color:${K.muted}}
@media (hover:hover) and (pointer:fine){.acc-pied a:hover{color:${K.text}}}

/* Tablette. */
@media (max-width:1099px){
  .acc-hero .acc-in{grid-template-columns:minmax(0,640px);gap:40px}
  .acc-carte-jour{max-width:500px}
  .acc-g1,.acc-g3{grid-template-columns:minmax(0,1fr);gap:32px}
  .acc-g3 .acc-g3-ecran{order:2}
  .acc-g2-texte{grid-template-columns:minmax(0,1fr);gap:0}
  .acc-g2-texte .acc-roles{margin-top:18px}
  .acc-qs{grid-template-columns:repeat(2,minmax(0,1fr))}
  .acc-deux,.acc-g-prix{grid-template-columns:minmax(0,1fr);gap:40px}
  .acc-prix{max-width:520px}
}
@media (max-width:899px){.acc-ancres{display:none}}
@media (min-width:760px){.acc-tel-seul,.acc-court{display:none}}

/* Téléphone. */
@media (max-width:759px){
  .acc-nav .acc-in{height:56px;gap:8px}
  .acc-marque img{width:28px;height:28px}
  .acc-marque b{font-size:17px}
  .acc-nav .acc-btn{height:38px;padding:0 12px;font-size:13.5px}
  .acc-nav .acc-lien{font-size:14px;padding:0 4px}
  .acc-hero{padding:16px 0 0}
  .acc-def{font-size:13px;padding:5px 10px}
  .acc-h1{font-size:32px;margin-top:10px}
  .acc-sous{font-size:17px;line-height:1.45;margin-top:12px}
  .acc-actions{flex-direction:column;align-items:stretch;gap:2px;margin-top:16px}
  .acc-hero .acc-actions .acc-btn{height:52px;width:100%}
  .acc-actions .acc-lien{justify-content:center}
  .acc-lignes{margin-top:6px;font-size:13px;gap:4px;line-height:1.45}
  .acc-hero .acc-in{gap:16px}
  .acc-sec{padding:32px 0}
  .acc-h2{font-size:28px}
  .acc-rep{font-size:17px;line-height:1.45;margin-top:10px}
  .acc-roles{margin-top:14px;gap:6px;line-height:1.45}
  .acc-quand{margin-bottom:8px}
  .acc-prec{display:none}
  .acc-g1,.acc-g3{gap:20px}
  .acc-g2-texte{gap:0;margin-bottom:20px}
  .acc-g2-texte .acc-roles{margin-top:14px}
  .acc-qs{grid-template-columns:minmax(0,1fr);gap:0;margin-top:16px}
  .acc-q{background:none;border:none;border-radius:0;border-bottom:1px solid ${K.line};padding:12px 0;box-shadow:none}
  .acc-q h3{gap:12px}
  .acc-q p{line-height:1.45;margin-top:2px;padding-left:30px}
  .acc-q:last-child{border-bottom:none}
  .acc-hors-tel,.acc-q .acc-long:not(:only-child){display:none}
  .acc-h2b{font-size:24px}
  .acc-etapes{margin-top:16px;gap:12px}
  .acc-etapes h3{font-size:15px}
  .acc-etapes p{font-size:14px;line-height:1.5;margin-top:2px}
  .acc-conf p{font-size:14px;line-height:1.5;margin-top:10px}
  .acc-conf p:first-of-type{margin-top:16px}
  .acc-deux,.acc-g-prix{gap:32px}
  .acc-prix{padding:22px 20px}
  .acc-gros b{font-size:44px}
  .acc-prix .acc-btn{height:52px}
  .acc-faq h2{font-size:24px}
  .acc-faq summary{font-size:15px}
  .acc-fin{padding:36px 0 40px}
  .acc-fin .acc-emplacement{width:180px}
  .acc-fin .acc-h2{margin-top:16px}
  .acc-fin .texte{display:none}
  .acc-fin-texte{align-self:stretch}
  .acc-fin .acc-actions{align-self:stretch}
  .acc-pied{padding:22px 0 28px}
}
@media (max-width:379px){.acc-marque b{display:none}}
/* Sous 340 px, le premier morceau (« Gratuit pour l'instant, puis … par mois · »)
   ne tient plus sur une ligne : on le laisse se couper plutôt que déborder. */
@media (max-width:339px){.acc-lignes .nw{white-space:normal}}
`;

// ── Les gabarits ────────────────────────────────────────────────────────────
function Quand({ heure, contexte }) {
  return <div className="acc-quand">{heure ? <><b>{heure}</b> · {contexte}</> : <b>{contexte}</b>}</div>;
}
function Roles({ vrm, toi }) {
  return (
    <div className="acc-roles">
      <div><b className="vrm">VRM</b><span>{vrm}</span></div>
      <div><b className="toi">Toi</b><span>{toi}</span></div>
    </div>
  );
}
function Precisions({ items }) {
  return <ul className="acc-prec">{items.map((x) => <li key={x}>{x}</li>)}</ul>;
}
const Fil = ({ libelle }) => <div className="acc-fil" aria-hidden="true"><i /><span>{libelle}</span></div>;

export default function Accueil({ onEntrer }) {
  // La page impose son fond sombre au DOCUMENT (sinon iOS peint le fond clair
  // du body au rebond du défilement), et le rend en partant.
  React.useEffect(() => {
    const avant = document.body.style.background;
    document.body.style.background = K.bg;
    const titre = document.title;
    document.title = 'VRM — l’outil de gestion des revendeurs Vinted, Leboncoin et eBay';
    return () => { document.body.style.background = avant; document.title = titre; };
  }, []);
  const moins = useMoinsDeMouvement();
  const sansSouris = useSansSouris();

  // La barre : matière dès 8 px de défilement ; « Créer mon compte » n'y
  // apparaît que si le bouton du haut de page est sorti de l'écran (un seul
  // bouton principal visible à la fois).
  const sentinelle = React.useRef(null), ctaHaut = React.useRef(null);
  const [defile, setDefile] = React.useState(false);
  const [ctaNav, setCtaNav] = React.useState(false);
  React.useEffect(() => {
    const obs = [];
    try {
      const a = new IntersectionObserver((es) => setDefile(!es[es.length - 1].isIntersecting));
      if (sentinelle.current) { a.observe(sentinelle.current); obs.push(a); }
      const b = new IntersectionObserver((es) => setCtaNav(!es[es.length - 1].isIntersecting), { rootMargin: '-64px 0px 0px 0px' });
      if (ctaHaut.current) { b.observe(ctaHaut.current); obs.push(b); }
    } catch (_) {}
    return () => obs.forEach((o) => { try { o.disconnect(); } catch (_) {} });
  }, []);

  // Le morceau des scènes : demandé pendant un temps mort, ou dès qu'une
  // section à scène approche.
  const [scenesPretes, setScenesPretes] = React.useState(false);
  const zoneScenes = React.useRef(null);
  React.useEffect(() => {
    let fini = false, id = 0, io = null;
    const go = () => { if (fini) return; chargerScenes().then(() => { if (!fini) setScenesPretes(true); }, () => {}); };
    try {
      if (typeof window.requestIdleCallback === 'function') id = window.requestIdleCallback(go, { timeout: 2000 });
      else id = setTimeout(go, 1200);
    } catch (_) { id = setTimeout(go, 1200); }
    try {
      io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) go(); }, { rootMargin: '800px 0px' });
      if (zoneScenes.current) io.observe(zoneScenes.current);
    } catch (_) {}
    return () => { fini = true; try { window.cancelIdleCallback && window.cancelIdleCallback(id); } catch (_) {} clearTimeout(id); try { io && io.disconnect(); } catch (_) {} };
  }, []);

  // Apparition au défilement des sections du corps (le héros a sa propre
  // cascade au chargement). On ne cache une section QUE si le mouvement est
  // permis ET qu'un observateur existe. L'observateur livre toujours une
  // notification initiale : les sections déjà à l'écran se révèlent tout de
  // suite, celles plus bas attendent le défilement. S'il ne se construit pas,
  // tout est révélé. « Réduire les animations » : on ne touche à rien.
  React.useEffect(() => {
    if (moins || typeof IntersectionObserver !== 'function') return;
    const secs = Array.from(document.querySelectorAll('.acc-sec, .acc-fin'));
    if (!secs.length) return;
    const reveler = (s) => { try { s.classList.add('vu'); } catch (_) {} };
    let io = null;
    try {
      io = new IntersectionObserver((es) => {
        es.forEach((e) => { if (e.isIntersecting) { reveler(e.target); io.unobserve(e.target); } });
      }, { rootMargin: '0px 0px -12% 0px' });
      secs.forEach((s) => { s.classList.add('acc-reveil'); io.observe(s); });
    } catch (_) { secs.forEach((s) => s.classList.remove('acc-reveil')); }
    return () => { try { io && io.disconnect(); } catch (_) {} };
  }, [moins]);

  const vers = (id) => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: moins ? 'auto' : 'smooth', block: 'start' }); };
  const ancre = (id) => (e) => { e.preventDefault(); vers(id); };
  // L'app ne se télécharge que quand on montre l'intention d'entrer.
  const prepare = () => { try { import('./App.jsx'); } catch (_) {} };
  const entrer = (mode) => () => onEntrer && onEntrer(mode);
  // ⚠️ Des fonctions qui RENDENT un bouton, pas des composants déclarés ici :
  //    un composant redéfini à chaque rendu serait démonté et remonté à chaque
  //    défilement (la barre change d'état), et le focus clavier se perdrait.
  const creer = (extra) => (
    <button type="button" className="acc-btn acc-p" data-cta="inscription" onPointerEnter={prepare} onFocus={prepare} onClick={entrer('up')} {...extra}>
      Créer mon compte<Chevron />
    </button>
  );
  const connexion = (extra) => (
    <button type="button" className="acc-lien" onPointerEnter={prepare} onFocus={prepare} onClick={entrer('in')} {...extra}>
      Déjà un compte ?<b>Se connecter</b>
    </button>
  );

  return (
    <div className="acc" data-accueil="">
      <style>{CSS}</style>
      <div className="acc-sentinelle" ref={sentinelle} />
      <header className={`acc-nav${defile ? ' defile' : ''}`}>
        <div className="acc-in">
          <a className="acc-marque" href="/" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: moins ? 'auto' : 'smooth' }); }} aria-label="VRM — haut de la page">
            <img src="/logo-vrm-96.png" alt="" width="32" height="32" />
            <b>VRM</b>
          </a>
          <nav className="acc-ancres" aria-label="Sections">
            {ANCRES.map(([id, l]) => <a key={id} href={`#${id}`} onClick={ancre(id)}>{l}</a>)}
          </nav>
          <div className="acc-nav-droite">
            {/* « Se connecter » reste au bord droit, toujours ; « Créer mon compte »
                apparaît à sa gauche une fois le bouton du haut de page sorti. */}
            <button type="button" className={`acc-btn acc-p acc-cta-nav${ctaNav ? ' la' : ''}`} data-cta-nav="inscription"
              tabIndex={ctaNav ? 0 : -1} aria-hidden={ctaNav ? undefined : 'true'} onPointerEnter={prepare} onFocus={prepare} onClick={entrer('up')}>
              Créer mon compte<Chevron />
            </button>
            <button type="button" className="acc-lien" data-cta-nav="connexion" onPointerEnter={prepare} onFocus={prepare} onClick={entrer('in')}><b style={{ margin: 0 }}>Se connecter</b></button>
          </div>
        </div>
      </header>

      <main>
        <section className="acc-hero" data-section="hero">
          <div className="acc-in">
            <div>
              <div className="acc-def" data-definition="">L’outil de gestion des revendeurs de seconde main</div>
              <h1 className="acc-h1"><span className="attenue">Tu ouvres VRM.</span><span>Tu sais quoi faire.</span></h1>
              <p className="acc-sous">Tes comptes Vinted, Leboncoin et eBay au même endroit — un compte ou dix : <em>les colis à poster, les articles vendus ailleurs, la compta pour l’URSSAF.</em></p>
              <div className="acc-actions">
                {creer({ ref: ctaHaut })}
                {connexion({ 'data-cta': 'connexion' })}
              </div>
              <div className="acc-lignes">
                {/* Trois morceaux insécables : la ligne ne se coupe qu'APRÈS un
                    « · » (vu au rendu à 390 px : « · Sans / engagement »). */}
                <div>
                  <span className="nw">{ACCES_OFFERT && <><span data-acces-offert="">Gratuit pour l’instant</span>, puis </>}<b>{PRIX_MOIS} €</b> par mois<span className="sep">·</span></span>{' '}
                  <span className="nw">Sans engagement<span className="sep">·</span></span>{' '}
                  <span className="nw">Aucun mot de passe Vinted demandé</span>
                </div>
                <div data-prerequis="" data-variante={sansSouris ? 'tactile' : 'souris'}>
                  {sansSouris
                    ? 'Sur ton téléphone, crée ton compte dès maintenant : l’extension s’installe ensuite une fois, dans Chrome sur un ordinateur. Puis une notification à chaque vente, si tu l’actives.'
                    : 'S’installe une fois dans Chrome, sur ton ordinateur. Ensuite, ton téléphone suffit.'}
                </div>
              </div>
            </div>
            <CarteJour onVers={vers} />
          </div>
        </section>

        <div ref={zoneScenes}>
          <section className="acc-sec" id="colis" data-section="colis">
            <Fil libelle="8 h 02" />
            <div className="acc-in acc-g1">
              <div>
                <Quand heure="8 h 02" contexte="avant d’aller au relais" />
                <h2 className="acc-h2">Quels colis je poste ce matin ?</h2>
                <p className="acc-rep">Ceux-là, dans cet ordre : bordereau prêt d’abord, le plus pressé en haut — chacun avec le numéro de son carton imprimé dessus.</p>
                <Roles vrm="prépare le bordereau de chaque vente et y imprime le titre et le numéro." toi="tu imprimes, tu prends le carton 128, tu déposes." />
                <Precisions items={['Un bordereau par feuille, en A4 ou sur imprimante thermique.', 'Ton numéro de rangement, en chiffres ou en série (B125…), n’est jamais redonné à un autre article.']} />
              </div>
              <Emplacement nom="colis" pret={scenesPretes} />
            </div>
          </section>

          <section className="acc-sec" id="ailleurs" data-section="ailleurs">
            <Fil libelle="8 h 03" />
            <div className="acc-in">
              <div className="acc-g2-texte">
                <div>
                  <Quand heure="8 h 03" contexte="la Nike vient d’être vendue sur Vinted" />
                  <h2 className="acc-h2">Vendu sur Vinted… encore en ligne sur Leboncoin ?</h2>
                  <p className="acc-rep">VRM te le dit. Chaque annonce est reliée à son article par son numéro — jamais par son titre — et une vente prouvée sur un site te dit où le retirer ailleurs, dans les deux sens.</p>
                </div>
                <div>
                  <Roles vrm="relie tes annonces par leur numéro et te signale celles à retirer." toi="tu la retires d’eBay d’un clic ; sur Vinted et Leboncoin, c’est toi qui la retires — VRM te dit laquelle." />
                  <Precisions items={['Publiée depuis VRM, l’annonce porte déjà son numéro ; sinon, tu la relies d’un clic.', 'Ça marche aussi pour une veste, un sac ou un livre : le lien, c’est le numéro.']} />
                </div>
              </div>
              <Emplacement nom="ailleurs" pret={scenesPretes} />
            </div>
          </section>

          <section className="acc-sec" id="urssaf" data-section="urssaf">
            <Fil libelle="Fin du mois" />
            <div className="acc-in acc-g3">
              <div className="acc-g3-ecran"><Emplacement nom="urssaf" pret={scenesPretes} /></div>
              <div>
                <Quand contexte="Fin du mois" />
                <h2 className="acc-h2">Combien je déclare à l’URSSAF ?</h2>
                <p className="acc-rep">Ce chiffre-là. Le chiffre d’affaires de tes ventes finalisées sur Vinted, Leboncoin et eBay, mois par mois : une vente Vinted compte le mois où l’argent t’est versé ; Leboncoin et eBay, au jour de la vente.</p>
                <Roles vrm="compte, date chaque vente et prépare le rapport du mois." toi="tu reportes le montant sur ton espace URSSAF, puis tu le notes comme déclaré." />
                <Precisions items={['« J’ai déclaré ce mois » : une vente notée ne se recompte jamais dans un autre mois.', 'Le rapport du mois en PDF et en tableur, pour toi ou ton comptable.']} />
              </div>
            </div>
          </section>
        </div>

        <section className="acc-sec" id="questions" data-section="questions">
          <div className="acc-in">
            <Quand contexte="Le reste de la journée" />
            <h2 className="acc-h2">Et toutes les petites questions.</h2>
            <div className="acc-qs">
              {QUESTIONS.map((x) => (
                <div key={x.q} className={`acc-q${x.horsTel ? ' acc-hors-tel' : ''}`}>
                  <h3><Icone nom={x.i} />{x.q}</h3>
                  <p><span className="acc-long">{x.r}</span>{x.c && <span className="acc-court">{x.c}</span>}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="acc-sec acc-bande" id="comment" data-section="comment">
          <div className="acc-in acc-deux">
            <div>
              <h2 className="acc-h2b">Une installation, sur ton ordinateur. Ensuite, ton téléphone suffit.</h2>
              <ol className="acc-etapes">
                <li><span className="n">1</span><div><h3>Crée ton compte</h3><p>Un email et un mot de passe.{ACCES_OFFERT && <span data-sans-carte=""> Aucune carte bancaire.</span>}</p></div></li>
                <li><span className="n">2</span><div><h3>Ajoute l’extension à Chrome</h3><p>{EXTENSION_SUR_LE_STORE
                  ? 'Une seule fois, sur ton ordinateur, depuis le Chrome Web Store. Puis connecte-la avec le même email.'
                  : 'Une seule fois, sur ton ordinateur. Elle n’est pas encore sur le Chrome Web Store : VRM te guide pas à pas, puis tu la connectes avec le même email.'}</p></div></li>
                <li><span className="n">3</span><div><h3>Passe sur Vinted</h3><p>Avec chacun de tes comptes. Ventes, annonces, bordereaux et messages arrivent dans VRM.</p></div></li>
              </ol>
            </div>
            <div className="acc-conf" data-confiance="">
              <h2 className="acc-h2b">Tes comptes restent les tiens.</h2>
              <p>VRM travaille comme toi : uniquement sur le compte ouvert dans ton Chrome, une action à la fois, jamais plus de 20 par heure.</p>
              <p>Il lit tes données et prépare le bordereau de ce que tu as déjà vendu ; vendre, publier, écrire à un acheteur, c’est toi qui le décides. Les automatismes — <span data-automatisme="">répondre aux questions des acheteurs</span>, <span data-automatisme="">retirer d’eBay une annonce vendue ailleurs</span> — restent éteints tant que tu ne les allumes pas.</p>
              <p>Et VRM refuse ce qui fait repérer un robot : relancer en série les personnes qui ont mis un article en favori, republier tes annonces en boucle, accepter une offre Vinted à ta place, supprimer une annonce.</p>
            </div>
          </div>
        </section>

        <section className="acc-sec" id="prix" data-section="prix">
          <div className="acc-in acc-g-prix">
            <div className="acc-prix">
              <h2 className="acc-h2b">Un seul prix, et rien de caché.</h2>
              {ACCES_OFFERT && <div className="acc-offert" data-acces-offert="">Gratuit pour l’instant</div>}
              <div className="acc-gros"><b>{PRIX_MOIS} €</b><span>par mois</span></div>
              <ul>
                <li>Sans engagement · résiliable en ligne, depuis l’app</li>
                <li>Tous tes comptes, toutes les fonctions.</li>
                <li className="acc-tel-seul">« Fermer mon compte » efface tes données.</li>
              </ul>
              <p className="petit">
                {ACCES_OFFERT && 'Tant que l’abonnement n’est pas exigé, VRM reste gratuit. '}
                Aucun paiement ne te sera demandé sans que tu aies vu le prix et accepté les conditions générales de vente. <a href="/legal/cgv.html">Lire les CGV</a>
              </p>
              {creer()}
            </div>
            <div className="acc-faq" id="faq" data-faq="">
              <h2>Questions</h2>
              <details>
                <summary>Vinted peut-il bloquer mon compte à cause de VRM ?</summary>
                <p>Personne ne peut garantir une décision de Vinted. VRM est conçu pour travailler comme toi, sans les automatismes qui font repérer un robot (voir « Tes comptes restent les tiens »).</p>
              </details>
              <details>
                <summary>C’est seulement pour les baskets ?</summary>
                <p>Non. Vêtements, sacs, livres… Le numéro de rangement, le bordereau, les ventes en double et la compta marchent pour n’importe quel article.</p>
              </details>
              {!VESTIAIRE_BRANCHE && (
                <details>
                  <summary>Et Vestiaire Collective ?</summary>
                  <p>Pas encore : VRM apprend à lire Vestiaire, mais ne compte rien de ce site aujourd’hui.</p>
                </details>
              )}
              <details className="acc-hors-tel">
                <summary>Comment j’arrête ?</summary>
                <p>Tu résilies en ligne, depuis l’app : l’abonnement s’arrête à la fin de la période payée. « Fermer mon compte » efface ensuite tes données, comme l’explique la <a href="/legal/confidentialite.html">politique de confidentialité</a>.</p>
              </details>
              <details>
                <summary>Que deviennent mes données ?</summary>
                <p>Elles servent à faire marcher ta boutique, rien d’autre : VRM ne vend aucune donnée et ne fait pas de publicité. <a href="/legal/confidentialite.html">Lire la politique de confidentialité</a>.</p>
              </details>
            </div>
          </div>
        </section>

        <section className="acc-fin" data-section="fin">
          <div className="acc-in">
            <div className="acc-fin-feuille">
              <Emplacement nom="premier" pret={scenesPretes} />
              <p className="note">Ton premier article aura le N° 1.</p>
            </div>
            <div className="acc-fin-texte">
              <h2 className="acc-h2">Demain matin, ouvre VRM.</h2>
              <p className="texte">Crée ton compte, ajoute l’extension sur ton ordinateur, passe sur Vinted : tu sauras quoi faire.</p>
              <div className="acc-actions">
                {creer()}
                {connexion()}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="acc-pied">
        <div className="acc-in">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo-vrm-96.png" alt="" width="22" height="22" style={{ borderRadius: 6 }} />
            <span>© {new Date().getFullYear()} VRM · VRM n’est pas affilié à Vinted, Leboncoin ou eBay.</span>
          </div>
          <nav aria-label="Informations légales">
            {LEGAL.map(([l, h]) => <a key={h} href={h}>{l}</a>)}
            {/* CONTACT — une seule source (src/contact.js). Tant qu'elle est
                vide, on le DIT au lieu d'inventer une adresse qui ne recevrait
                rien (§2.3). */}
            {contactEmail()
              ? <a data-contact="" href={`mailto:${contactEmail()}`}>Contact</a>
              : <span data-contact="" data-contact-absent="">Contact : {CONTACT_A_VENIR}</span>}
          </nav>
        </div>
      </footer>
    </div>
  );
}
