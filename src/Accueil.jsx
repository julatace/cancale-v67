// ══════════════════════════════════════════════════════════════════════════
// LA PAGE D'ACCUEIL PUBLIQUE — ce que voit quelqu'un qui ne connaît pas VRM
// ══════════════════════════════════════════════════════════════════════════
// (8 nov., refaite pour VENDRE — calme, premium, style Apple de VRM.)
// (11 nov., lot accueil-public) Pour TOUT revendeur (pas que des sneakers) :
// « pour qui » au-dessus de la promesse, cinq moments (Messages et offres en
// plus), les captures en catalogue MÉLANGÉ (mode exemple `varie`), deux cartes
// de prix Solo / Pro (noms et phrases : OFFRES, montants : accueil-reglages,
// comparés aux CGV par les audits), la FAQ en vraies questions/réponses, et
// l'image de partage (public/og-vrm.jpg, scripts/accueil-og.cjs).
// La promesse en une phrase : « Tes ventes, tes colis et ta compta, au même
// endroit. » Puis la journée d'un revendeur, en quatre moments, montrée par de
// VRAIES captures de l'app (mode exemple, scripts/accueil-captures.cjs) : le
// prochain geste chaque matin · les colis à envoyer et à retirer, avec leurs
// codes · les numéros de rangement · la compta et l'URSSAF. Sur ordinateur, un
// téléphone reste fixe à gauche et change d'écran au fil des chapitres ; sur
// téléphone, chaque chapitre porte sa capture.
//
// ⚠️ AUCUNE PREUVE INVENTÉE (§2.3, PRODUCT.md « Evidence on Hand ») : ni
//    témoignage, ni nombre de vendeurs, ni note, ni logo de client. Chaque image
//    est l'app réelle sur des données INVENTÉES et le dit (« Données d'exemple »).
// ⚠️ Le prix et l'essai viennent de src/accueil-reglages.js, comparés par le banc
//    aux CGV et au serveur (scripts/bancs/accueil.cjs) : la page ne peut pas dire
//    un autre prix ni une autre durée d'essai.
// ⚠️ LÉGÈRE : cette page se charge AVANT l'app ; elle ne télécharge ni l'app ni
//    le film (`?film`, src/AccueilFilm.jsx — gardé tel quel). Les captures sont
//    en WebP (~40 Ko), au double de leur taille affichée, chargées paresseusement
//    sauf la première.
// ⚠️ Les contrats `data-*` (prérequis, navigateurs, ordinateur nécessaire, accès
//    offert, contact) sont lus par scripts/audit-accueil-navigateurs.cjs et
//    scripts/audit-lancement.cjs : ne pas les retirer.
import React from 'react';
// (11 nov., lot traduction) Les textes passent par `tr()` (src/i18n/index.js), la langue par `useLangue`.
import { tr, listeDansLaLangue, monnaie } from './i18n/index.js';
import { useLangue } from './i18n/react.js';
import ChoixLangue from './i18n/ChoixLangue.jsx';
import { contactEmail, CONTACT_A_VENIR } from './contact.js';
import { ACCES_OFFERT, EXTENSION_SUR_LE_STORE, VESTIAIRE_BRANCHE, PRIX_MOIS, PRIX_PRO_MOIS, PRO_OUVERT, ESSAI_JOURS } from './accueil-reglages.js';
// (9 nov.) Deux offres : Solo (un compte vendeur par plateforme + comptes d'achat) et Pro (les ventes de tous les comptes).
import { OFFRES } from '../api/_lib/plan-regle.js';
import { useMoinsDeMouvement, useSansSouris } from './accueil-mouvement.js';
// (11 nov., lot temps-gagne) Le calculateur « le temps que VRM te fait gagner » : un morceau à
// part, demandé à l'approche de sa section (le fichier d'entrée a un budget de poids).
const TempsGagne = React.lazy(() => import('./accueil/TempsGagne.jsx'));
// (5 nov.) Les navigateurs où l'extension SERVIE s'installe : une source, la même
// que l'app — jamais « Chrome obligatoire ». Module léger.
import { navigateursServis, NAVS_ORDINATEUR_TEXTE as NAVS_ORDI } from './navigateursServis.js';
const SERVIS = navigateursServis();

// ── Les captures (public/accueil/, scripts/accueil-captures.cjs) ────────────
// Taille réelle des fichiers : téléphone 780 × 1688 (390 px affichés, ×2),
// ordinateur 1600 × 1000 (1440 × 900 réduits).
const TEL = { w: 780, h: 1688 }, BUREAU = { w: 1600, h: 1000 };
function Capture({ nom, alt, taille = TEL, paresseuse = true, prioritaire = false, actif }) {
  return (
    <picture data-capture={nom} {...(actif ? { 'data-actif': '' } : {})}>
      <source srcSet={`/accueil/${nom}-sombre.webp`} media="(prefers-color-scheme: dark)" type="image/webp" />
      <img src={`/accueil/${nom}-clair.webp`} alt={alt} width={taille.w} height={taille.h}
        loading={paresseuse ? 'lazy' : 'eager'} decoding="async" {...(prioritaire ? { fetchpriority: 'high' } : {})} />
    </picture>
  );
}

// ── Les quatre moments de la journée ────────────────────────────────────────
// (11 nov., lot traduction) Les textes des moments vivent dans les dictionnaires (src/i18n/langues/)
// (`accueil.moment.<id>.titre|texte|alt|point1|point2`) : ici, l'ordre et les captures.
const MOMENTS = [
  { id: 'matin', capture: 'journee' },
  { id: 'colis', capture: 'retirer' },
  { id: 'numeros', capture: 'numeros' },
  { id: 'messages', capture: 'messages' },
  { id: 'compta', capture: 'compta' },
];
const texteMoment = (m, champ) => tr(`accueil.moment.${m.id}.${champ}`);
const pointsMoment = (m) => [texteMoment(m, 'point1'), texteMoment(m, 'point2')];;

// ── Les questions : une question (h3), sa réponse. Une réponse ne promet que
//    ce que le code fait ; `si` cache une question quand elle n'a plus lieu d'être.
// (11 nov., lot traduction) Les questions : `accueil.faq.<id>.q` et ses réponses dans les dictionnaires.
const FAQ = [
  { id: 'extension', r: () => [<>{tr('accueil.faq.extension.r')}<a href="/aide/extension">{tr('accueil.faq.extension.lien')}</a>.</>] },
  { id: 'blocage', r: () => [tr('accueil.faq.blocage.r1'), tr('accueil.faq.blocage.r2')] },
  // (13 nov., lot 50) + la page publique « Ce que VRM fait — et ne fait jamais » (public/confiance.html).
  { id: 'securite', r: () => [tr('accueil.faq.securite.r1'), <a key="f" href="/confiance" data-lien-confiance="">{tr('legal.confiance')}</a>, <a key="c" href="/legal/confidentialite.html">{tr('accueil.faq.securite.lien')}</a>] },
  { id: 'arret', r: () => [tr('accueil.faq.arret.r1'), tr('accueil.faq.arret.r2')] },
  { id: 'telephone', r: () => [tr('accueil.faq.telephone.r1'), tr('accueil.faq.telephone.r2')] },
  { id: 'comptes', r: () => [tr('accueil.faq.comptes.r1'), tr('accueil.faq.comptes.r2'), tr('accueil.faq.comptes.r3')] },
  { id: 'baskets', r: () => [tr('accueil.faq.baskets.r')] },
  { id: 'vestiaire', si: () => !VESTIAIRE_BRANCHE, r: () => [tr('accueil.faq.vestiaire.r')] },
  { id: 'autre', r: () => [<><a href="/aide">{tr('accueil.faq.autre.aide')}</a> ; <a href="/statut">{tr('accueil.faq.autre.statut')}</a>.</>] },
];;

const LEGAL = [
  ['legal.cgv', '/legal/cgv.html'], ['legal.cgu', '/legal/cgu.html'], ['legal.confidentialite', '/legal/confidentialite.html'],
  ['legal.mentions', '/legal/mentions-legales.html'], ['legal.cookies', '/legal/cookies.html'],
];

// ⚠️ Les commentaires vivent ICI, pas dans la chaîne (elle est envoyée telle quelle
//    au navigateur, dans le fichier d’entrée au budget compté par le banc). Dans l’ordre :
//   · La barre : le fond de la page dès qu'on défile, rien de plus.
//   · Les boutons : une forme (pilule), deux poids.
//   · Le haut de page : la promesse, centrée — le seul moment centré de la page.
//   · La scène du haut : l'ordinateur et le téléphone, de vraies captures.
//   · La journée : sur ordinateur, le téléphone reste fixe et change d'écran.
//   · Les comptes et l'installation : une bande grise, deux colonnes de texte.
//   · Le prix : deux cartes côte à côte ; Pro porte la carte sombre, signature de VRM.
//   · Les questions : du texte qu'on lit, sans accordéon.
//   · La fin : une phrase, un geste.
//   · Le pied : la marque revient, puis les liens utiles.
//   · Apparition au défilement : une fois, en montée courte ; jamais caché sans observateur.
//   · Tablette et petit ordinateur.
//   · Téléphone.
const CSS = `
.av{--fond:#FFFFFF;--fond2:#F5F5F7;--encre:#1D1D1F;--gris:#6E6E73;--accent:#0071E3;--accent-texte:#0066CC;--nuit:#1D1D1F;--nuit-encre:#F5F5F7;--nuit-gris:#A1A1A6;--cadre:#1D1D1F;--ombre:0 1px 2px rgba(0,0,0,.06),0 24px 48px -12px rgba(0,0,0,.18);
  position:relative;background:var(--fond);color:var(--encre);min-height:100vh;overflow-x:clip;
  font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','SF Pro Display','Inter','Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;
  -webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;font-size:17px;line-height:1.5;letter-spacing:-.01em}
@media (prefers-color-scheme:dark){.av{--fond:#000000;--fond2:#161617;--encre:#F5F5F7;--gris:#A1A1A6;--accent-texte:#2997FF;--nuit:#1C1C1E;--cadre:#2C2C2E;--ombre:0 0 0 .5px rgba(255,255,255,.12),0 24px 48px -12px rgba(0,0,0,.6)}}
@supports not (overflow-x:clip){.av{overflow-x:hidden}}
.av *{box-sizing:border-box}
.av ::selection{background:rgba(0,113,227,.24)}
:where(.av) a{color:inherit}
.av :focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:8px}
.av a,.av button{-webkit-tap-highlight-color:transparent;touch-action:manipulation}
:where(.av) :where(h1,h2,h3,p,ol,ul,figure){margin:0}
.av-in{max-width:1180px;margin:0 auto;padding:0 24px}
.av-sentinelle{position:absolute;top:8px;left:0;width:1px;height:1px;pointer-events:none}
.av-nav{position:sticky;top:0;z-index:30;padding-top:env(safe-area-inset-top);background:transparent;transition:background-color 200ms ease}
.av-nav.defile{background:var(--fond)}
.av-nav .av-in{display:flex;align-items:center;gap:8px;height:56px}
.av-marque{display:flex;align-items:center;gap:8px;text-decoration:none;flex-shrink:0;min-height:44px}
.av-marque img{width:28px;height:28px;border-radius:8px;display:block;background:#1D1D1F;padding:2px;object-fit:contain}
.av-marque b{font-size:19px;font-weight:700;letter-spacing:.02em}
.av-liens{display:flex;gap:4px;margin-left:24px}
.av-liens a{font-size:14px;color:var(--gris);text-decoration:none;padding:12px 10px;border-radius:8px;transition:color 150ms ease}
@media (hover:hover) and (pointer:fine){.av-liens a:hover{color:var(--encre)}}
.av-droite{margin-left:auto;display:flex;align-items:center;gap:4px}
.av .av-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:48px;padding:0 24px;border-radius:999px;border:none;cursor:pointer;font:inherit;font-size:17px;font-weight:600;letter-spacing:-.01em;text-decoration:none;white-space:nowrap;background:var(--accent);color:#FFFFFF;transition:transform 120ms cubic-bezier(.23,1,.32,1),background-color 150ms ease}
.av .av-btn:active{transform:scale(.97)}
@media (hover:hover) and (pointer:fine){.av .av-btn:hover{background:#0077ED}}
.av .av-lien{display:inline-flex;align-items:center;min-height:44px;padding:0 8px;font-size:17px;color:var(--accent-texte);text-decoration:none;font-weight:500}
.av .av-lien span{transition:transform 150ms cubic-bezier(.23,1,.32,1);display:inline-block;margin-left:3px}
@media (hover:hover) and (pointer:fine){.av .av-lien:hover{text-decoration:underline;text-underline-offset:4px;text-decoration-thickness:1px}.av .av-lien:hover span{transform:translateX(2px)}}
.av-nav .av-btn{min-height:36px;padding:0 16px;font-size:14px;opacity:0;pointer-events:none;transform:translateY(4px);transition:opacity 160ms ease,transform 160ms ease}
.av-nav .av-btn.la{opacity:1;pointer-events:auto;transform:none}
.av-nav .av-lien{font-size:14px}
.av-hero{padding:72px 0 0;text-align:center}
.av-pour{font-size:clamp(15px,1.2vw,17px);font-weight:600;color:var(--gris);margin:0 auto 14px;max-width:30em;text-wrap:balance}
.av-h1{font-size:clamp(36px,5.2vw,76px);line-height:1.04;letter-spacing:-.035em;font-weight:700;max-width:16em;margin:0 auto;text-wrap:balance}
.av-sous{font-size:clamp(19px,1.7vw,24px);line-height:1.4;color:var(--gris);max-width:34em;margin:24px auto 0;text-wrap:balance;letter-spacing:-.015em}
.av-actions{display:flex;align-items:center;justify-content:center;gap:12px 20px;margin-top:32px;flex-wrap:wrap}
.av-prix-ligne{margin-top:20px;font-size:15px;color:var(--gris);line-height:1.5}
.av-prix-ligne b{color:var(--encre);font-weight:600}
.av-prix-ligne .nw{white-space:nowrap}
.av-prereq{margin:6px auto 0;font-size:15px;color:var(--gris);max-width:40em;line-height:1.5}
.av-scene{position:relative;margin:56px auto 0;max-width:1100px;padding:0 24px}
.av-ecran-bureau{display:block;border-radius:14px;overflow:hidden;background:var(--fond2);box-shadow:var(--ombre)}
.av-ecran-bureau img,.av-tel img{display:block;width:100%;height:auto}
.av-tel{display:block;background:var(--cadre);padding:7px;border-radius:44px;box-shadow:var(--ombre)}
.av-tel img{border-radius:37px;overflow:hidden}
.av-scene .av-tel{position:absolute;right:-8px;bottom:-56px;width:230px}
.av-legende{font-size:13px;color:var(--gris);margin-top:16px;text-align:left}
.av-scene .av-legende{margin-top:72px;text-align:center}
.av-journee{padding:160px 0 40px}
.av-journee-tete{max-width:780px}
.av-h2{font-size:clamp(30px,3.6vw,48px);line-height:1.08;letter-spacing:-.03em;font-weight:700;text-wrap:balance}
.av-chapo{font-size:clamp(18px,1.5vw,21px);color:var(--gris);margin-top:16px;max-width:36em;line-height:1.45}
.av-split{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,6fr);gap:96px;margin-top:72px;align-items:start}
.av-plateau{position:sticky;top:max(80px,calc(50vh - 330px));height:640px;display:flex;justify-content:center}
.av-plateau .av-tel{position:relative;width:300px;height:fit-content}
.av-pile{display:block;position:relative;border-radius:37px;overflow:hidden;aspect-ratio:780/1688}
.av-pile picture{display:block;position:absolute;inset:0;opacity:0;transition:opacity 260ms ease}
.av-pile picture[data-actif]{opacity:1}
.av-pile img{width:100%;height:100%;object-fit:cover;border-radius:0}
.av-moment{min-height:72vh;display:flex;flex-direction:column;justify-content:center;padding:40px 0}
.av-moment h3{font-size:clamp(26px,2.6vw,36px);line-height:1.12;letter-spacing:-.028em;font-weight:700;text-wrap:balance;max-width:16em}
.av-moment p{margin-top:16px;max-width:34em;font-size:19px;line-height:1.5;color:var(--encre)}
.av-moment ul{list-style:none;padding:0;margin-top:24px;display:flex;flex-direction:column;gap:12px;max-width:34em}
.av-moment li{position:relative;padding-left:20px;font-size:16px;color:var(--gris);line-height:1.45}
.av-moment li:before{content:"";position:absolute;left:2px;top:.6em;width:6px;height:6px;border-radius:50%;background:var(--gris)}
.av-moment .av-tel-seul{display:none}
.av-temps{padding:120px 0 0}
.av-temps-attente{min-height:560px}
.av-bande{background:var(--fond2);padding:128px 0;margin-top:120px}
.av-deux{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:96px;align-items:start}
.av-bande p{font-size:17px;line-height:1.55;margin-top:16px;max-width:34em}
.av-bande .av-h2{font-size:clamp(28px,3vw,40px)}
.av-etapes{list-style:none;padding:0;margin-top:32px;display:flex;flex-direction:column;gap:28px;counter-reset:e}
.av-etapes li{display:grid;grid-template-columns:36px 1fr;gap:16px;align-items:start}
.av-etapes .n{width:32px;height:32px;border-radius:50%;background:var(--encre);color:var(--fond);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;font-variant-numeric:tabular-nums}
.av-etapes h3{font-size:19px;font-weight:600;letter-spacing:-.015em;line-height:1.3}
.av-etapes p{margin-top:4px;font-size:16px;color:var(--gris)}
.av-note{font-size:15px!important;color:var(--gris)}
.av-prix{padding:160px 0 0}
.av-prix-tete{max-width:780px}
.av-offres{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:24px;margin-top:56px}
.av-offre{background:var(--fond2);border-radius:28px;padding:48px;display:flex;flex-direction:column}
.av-offre h3{font-size:24px;font-weight:700;letter-spacing:-.02em;line-height:1.2}
.av-offre p{margin-top:20px;font-size:17px;line-height:1.55;max-width:30em}
.av-offre-pro{background:var(--nuit);color:var(--nuit-encre)}
.av-montant{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 12px;margin-top:16px;font-variant-numeric:tabular-nums}
.av-montant b{font-size:clamp(56px,6vw,88px);font-weight:700;letter-spacing:-.045em;line-height:.95}
.av-montant span{white-space:nowrap;font-size:19px;color:var(--gris)}
.av-offre-pro .av-montant span{color:var(--nuit-gris)}
.av-prix-pied{margin-top:40px;max-width:40em}
.av-prix-pied p{font-size:17px;line-height:1.55}
.av-prix-pied p + p{margin-top:10px}
.av-prix-pied .petit{font-size:15px;color:var(--gris)}
.av-prix-pied .petit a{color:var(--accent-texte);text-underline-offset:3px}
.av-prix-pied .av-btn{margin-top:28px}
.av-offert{font-weight:600}
.av-faq{padding:160px 0 0}
.av-faq-grille{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,8fr);gap:64px;align-items:start}
.av-faq-texte{columns:2;column-gap:56px}
.av-faq-texte p{break-inside:avoid;margin:0 0 24px;font-size:16px;line-height:1.55;color:var(--gris)}
.av-faq-q{break-inside:avoid;margin:0 0 24px}
.av-faq-q>h3{font-size:16px;line-height:1.55;color:var(--encre);font-weight:600}
.av-faq-texte .av-faq-q p{margin:0}
.av-auto{margin:8px 0 0;padding-left:1.2em;font-size:17px;line-height:1.55;max-width:34em}
.av-faq-texte a{color:var(--accent-texte);text-underline-offset:3px}
.av-fin{padding:200px 0 160px;text-align:left}
.av-fin p{font-size:clamp(24px,2.4vw,32px);line-height:1.25;letter-spacing:-.022em;font-weight:600;max-width:24em;text-wrap:balance}
.av-fin .av-actions{justify-content:flex-start;margin-top:28px}
.av-pied{background:var(--fond2);padding:56px 0 calc(40px + env(safe-area-inset-bottom));font-size:13px;color:var(--gris)}
.av-pied .av-in{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:24px 48px;align-items:start}
.av-pied .av-langue{grid-column:1/-1;justify-self:end;color:var(--gris);font-size:13px}
.av-pied nav{display:flex;flex-wrap:wrap;gap:0 4px;justify-content:flex-end}
.av-pied nav a,.av-pied nav span{display:inline-flex;align-items:center;min-height:44px;padding:0 8px;text-decoration:none;color:var(--gris)}
@media (hover:hover) and (pointer:fine){.av-pied nav a:hover{color:var(--encre);text-decoration:underline;text-underline-offset:3px}}
.av-pied .marque{font-size:28px;font-weight:700;letter-spacing:-.02em;color:var(--encre);display:block;margin-bottom:8px}
@media (prefers-reduced-motion:no-preference){
  .av-hero > .av-in > *{animation:avMonte 520ms cubic-bezier(.23,1,.32,1) both}
  .av-hero .av-sous{animation-delay:70ms}.av-hero .av-actions{animation-delay:140ms}.av-hero .av-prix-ligne,.av-hero .av-prereq{animation-delay:200ms}
  .av-scene{animation:avMonte 700ms cubic-bezier(.23,1,.32,1) 160ms both}
  .av-reveil > *{opacity:0;transform:translateY(20px);transition:opacity 500ms cubic-bezier(.23,1,.32,1),transform 500ms cubic-bezier(.23,1,.32,1)}
  .av-reveil.vu > *{opacity:1;transform:none}
  .av-reveil.vu > *:nth-child(2){transition-delay:70ms}.av-reveil.vu > *:nth-child(3){transition-delay:140ms}
}
@keyframes avMonte{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.av *{animation:none!important;transition:none!important}}
@media (max-width:1023px){
  .av-split{grid-template-columns:1fr;gap:0;margin-top:32px}
  .av-plateau{display:none}
  .av-moment{min-height:0;padding:56px 0 0}
  .av-moment .av-tel-seul{display:block;width:min(300px,78vw);margin:32px auto 0}
  .av-deux,.av-faq-grille{grid-template-columns:1fr;gap:40px}
  .av-offre{padding:40px 32px}
  .av-liens{display:none}
}
@media (max-width:759px){
  .av-in{padding:0 20px}
  .av-hero{padding-top:40px}
  .av-sous{margin-top:16px}
  .av-actions{margin-top:24px;flex-direction:column;gap:4px}
  .av-actions .av-btn{width:100%;max-width:360px}
  .av-scene{margin-top:40px;padding:0 20px}
  .av-scene .av-ecran-bureau{display:none}
  .av-scene .av-tel{position:relative;right:auto;bottom:auto;width:min(280px,74vw);margin:0 auto}
  .av-scene .av-legende{margin-top:16px}
  .av-journee{padding-top:104px}
  .av-moment p{font-size:17px}
  .av-bande{padding:88px 0;margin-top:96px}
  .av-prix,.av-faq,.av-temps{padding-top:104px}
  .av-offres{grid-template-columns:1fr;gap:16px;margin-top:40px}
  .av-offre{padding:32px 24px;border-radius:24px}
  .av-faq-texte{columns:1}
  .av-fin{padding:120px 0 104px}
  .av-fin .av-actions{align-items:flex-start}
  .av-pied .av-in{grid-template-columns:1fr}
  .av-pied nav{justify-content:flex-start;margin-left:-8px}
  .av-nav .av-btn{display:none}
}
@media (max-width:359px){.av-marque b{display:none}}
`;

export default function Accueil({ onEntrer }) {
  const langue = useLangue();
  const moins = useMoinsDeMouvement();
  const sansSouris = useSansSouris();
  // Le fond du DOCUMENT suit la page (sinon iOS peint un autre fond au rebond).
  React.useEffect(() => {
    const avant = document.body.style.background, titre = document.title;
    let mq = null;
    const poser = () => { document.body.style.background = mq && mq.matches ? '#000000' : '#FFFFFF'; };
    try { mq = window.matchMedia('(prefers-color-scheme: dark)'); mq.addEventListener && mq.addEventListener('change', poser); } catch (_) {}
    poser();
    document.title = tr('accueil.titrePage');
    return () => { try { mq && mq.removeEventListener && mq.removeEventListener('change', poser); } catch (_) {} document.body.style.background = avant; document.title = titre; };
  }, [langue]);

  // La barre : le fond dès 8 px ; « Essayer gratuitement » n'y paraît que quand le
  // bouton du haut est sorti de l'écran (un seul bouton principal à la fois).
  const sentinelle = React.useRef(null), ctaHaut = React.useRef(null);
  const [defile, setDefile] = React.useState(false);
  const [ctaNav, setCtaNav] = React.useState(false);
  React.useEffect(() => {
    const obs = [];
    try {
      const a = new IntersectionObserver((es) => setDefile(!es[es.length - 1].isIntersecting));
      if (sentinelle.current) { a.observe(sentinelle.current); obs.push(a); }
      const b = new IntersectionObserver((es) => setCtaNav(!es[es.length - 1].isIntersecting), { rootMargin: '-56px 0px 0px 0px' });
      if (ctaHaut.current) { b.observe(ctaHaut.current); obs.push(b); }
    } catch (_) {}
    return () => obs.forEach((o) => { try { o.disconnect(); } catch (_) {} });
  }, []);

  // Le moment de la journée au milieu de l'écran : le téléphone fixe le montre.
  // Ses captures ne se demandent qu'à l'approche de la section (sinon le
  // chargement paresseux du navigateur, qui anticipe de plusieurs écrans, les
  // tirait toutes au premier affichage).
  const [actif, setActif] = React.useState(MOMENTS[0].id);
  const [plateauPret, setPlateauPret] = React.useState(false);
  React.useEffect(() => {
    let io = null, io2 = null;
    try {
      io2 = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setPlateauPret(true); io2.disconnect(); } }, { rootMargin: '0px 0px 25% 0px' });
      const j = document.getElementById('journee'); if (j) io2.observe(j);
    } catch (_) { setPlateauPret(true); }
    try {
      io = new IntersectionObserver((es) => {
        const vus = es.filter((e) => e.isIntersecting);
        if (vus.length) setActif(vus[vus.length - 1].target.getAttribute('data-moment'));
      }, { rootMargin: '-45% 0px -45% 0px' });
      document.querySelectorAll('[data-moment]').forEach((m) => io.observe(m));
    } catch (_) {}
    return () => { try { io && io.disconnect(); } catch (_) {} try { io2 && io2.disconnect(); } catch (_) {} };
  }, []);

  // Le calculateur ne se télécharge qu'à l'approche de sa section (sans observateur : tout de suite).
  const [tempsPret, setTempsPret] = React.useState(false);
  React.useEffect(() => {
    let io = null;
    try {
      io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setTempsPret(true); io.disconnect(); } }, { rootMargin: '0px 0px 60% 0px' });
      const t = document.getElementById('temps'); if (t) io.observe(t);
    } catch (_) { setTempsPret(true); }
    return () => { try { io && io.disconnect(); } catch (_) {} };
  }, []);

  // Apparition au défilement — seulement si le mouvement est permis ET qu'un
  // observateur existe ; sinon tout reste visible.
  React.useEffect(() => {
    if (moins || typeof IntersectionObserver !== 'function') return;
    const blocs = Array.from(document.querySelectorAll('[data-reveil]'));
    let io = null;
    try {
      io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('vu'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -10% 0px' });
      blocs.forEach((b) => { b.classList.add('av-reveil'); io.observe(b); });
    } catch (_) { blocs.forEach((b) => b.classList.remove('av-reveil')); }
    return () => { try { io && io.disconnect(); } catch (_) {} };
  }, [moins]);

  const vers = (id) => (e) => { const el = document.getElementById(id); if (!el) return; e.preventDefault(); el.scrollIntoView({ behavior: moins ? 'auto' : 'smooth', block: 'start' }); };
  // L'app ne se télécharge que quand on montre l'intention d'entrer.
  const prepare = () => { try { import('./App.jsx'); } catch (_) {} };
  // De vrais liens (`/?inscription`, `/?connexion`) : ils marchent sans script ;
  // avec, l'app s'ouvre sans recharger la page.
  const entrer = (mode) => (e) => { if (!onEntrer || e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); onEntrer(mode); };
  // ⚠️ Des fonctions qui RENDENT un bouton, pas des composants déclarés ici
  //    (un composant redéfini à chaque rendu perdrait le focus clavier).
  const creer = (extra) => (
    <a href="/?inscription" className="av-btn" data-cta="inscription" onPointerEnter={prepare} onFocus={prepare} onClick={entrer('up')} {...extra}>{tr('accueil.cta.essayer')}</a>
  );
  const connexion = (extra) => (
    <a href="/?connexion" className="av-lien" onPointerEnter={prepare} onFocus={prepare} onClick={entrer('in')} {...extra}>{tr('auth.titre.in')}<span aria-hidden="true">›</span></a>
  );
  const ligneEssai = tr('accueil.essai', { n: ESSAI_JOURS });
  // La liste des navigateurs : la phrase française de la règle (« … ou Vivaldi ») ; ailleurs, la
  // même liste jointe dans la langue (Intl.ListFormat), les noms jamais traduits.
  const navsOrdi = langue === 'fr' ? NAVS_ORDI : listeDansLaLangue(SERVIS.ordinateur, langue);
  // Le prix : la valeur des CGV (« 16,99 », src/accueil-reglages.js) écrite telle quelle en
  // français, et dans le format de la langue ailleurs (« €16.99 ») — jamais une autre valeur.
  const prixLu = (p) => (langue === 'fr' ? <>{p}&nbsp;€</> : monnaie(Number(String(p).replace(',', '.'))));

  return (
    <div className="av" data-accueil="">
      <style>{CSS}</style>
      <div className="av-sentinelle" ref={sentinelle} />
      <header className={`av-nav${defile ? ' defile' : ''}`}>
        <div className="av-in">
          <a className="av-marque" href="/" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: moins ? 'auto' : 'smooth' }); }} aria-label={tr('accueil.hautDePage')}>
            <img className="vrm-brand-asset" src="/vrm-logo-v5-96.png" srcSet="/vrm-logo-v5-96.png 1x, /vrm-logo-v5-192.png 2x" alt="" width="28" height="28" />
            <b>VRM</b>
          </a>
          <nav className="av-liens" aria-label={tr('accueil.nav.sections')}>
            <a href="#journee" onClick={vers('journee')}>{tr('accueil.nav.fonctions')}</a>
            <a href="#prix" onClick={vers('prix')}>{tr('accueil.nav.prix')}</a>
            <a href="#faq" onClick={vers('faq')}>{tr('accueil.nav.questions')}</a>
            <a href="/aide">{tr('accueil.nav.aide')}</a>
          </nav>
          <div className="av-droite">
            <a href="/?inscription" className={`av-btn${ctaNav ? ' la' : ''}`} data-cta-nav="inscription" tabIndex={ctaNav ? 0 : -1} aria-hidden={ctaNav ? undefined : 'true'} onPointerEnter={prepare} onFocus={prepare} onClick={entrer('up')}>{tr('accueil.cta.essayer')}</a>
            <a href="/?connexion" className="av-lien" data-cta-nav="connexion" onPointerEnter={prepare} onFocus={prepare} onClick={entrer('in')}>{tr('auth.titre.in')}</a>
          </div>
        </div>
      </header>

      <main>
        <section className="av-hero" data-section="hero">
          <div className="av-in">
            <p className="av-pour" data-pour-qui="">{tr('accueil.hero.pour')}</p>
            <h1 className="av-h1" data-definition="">{tr('accueil.hero.titre')}</h1>
            <p className="av-sous">{tr('accueil.hero.sous')}</p>
            <div className="av-actions">
              {creer({ ref: ctaHaut })}
              {connexion({ 'data-cta': 'connexion' })}
            </div>
            <p className="av-prix-ligne" data-prix-ligne="">
              {ACCES_OFFERT && <><span className="nw" data-acces-offert="">{tr('accueil.gratuit')}</span>{tr('accueil.prix.puis')}</>}
              <span className="nw"><b>{prixLu(PRIX_MOIS)}</b> {tr('accueil.prix.parMois')}</span> {tr('accueil.prix.apres')} <span className="nw" data-essai={ESSAI_JOURS}>{ligneEssai}</span> · <span className="nw">{tr('accueil.prix.sansEngagement')}</span>
            </p>
            {/* Ce qui est VRAI (1er et 5 nov.) : VRM lit Vinted par l'extension, dans le
                navigateur de l'ordinateur ; le téléphone consulte et commande. Pas
                « Chrome obligatoire » : la liste des navigateurs SERVIS. */}
            <div className="av-prereq" data-prerequis="" data-variante={sansSouris ? 'tactile' : 'souris'} data-navigateurs={SERVIS.ordinateur.join(',')} data-lecture-telephone={SERVIS.lectureTelephone ? 'oui' : 'non'}>
              {sansSouris
                ? tr('accueil.prereq.tactile', { navigateurs: navsOrdi })
                : tr('accueil.prereq.souris', { navigateurs: navsOrdi })}
            </div>
          </div>
          <figure className="av-scene" data-scene-haut="">
            <span className="av-ecran-bureau"><Capture nom="bureau" taille={BUREAU} alt={tr('accueil.capture.bureau')} /></span>
            <span className="av-tel"><Capture nom="journee" paresseuse={false} prioritaire alt={tr('accueil.capture.iphone')} /></span>
            <figcaption className="av-legende">{tr('accueil.capture.legende')}</figcaption>
          </figure>
        </section>

        <section className="av-journee" id="journee" data-section="journee">
          <div className="av-in">
            <div className="av-journee-tete" data-reveil="">
              <h2 className="av-h2">{tr('accueil.journee.titre')}</h2>
              <p className="av-chapo">{tr('accueil.journee.chapo')}</p>
            </div>
            <div className="av-split">
              <div className="av-plateau" aria-hidden="true">
                <span className="av-tel">
                  <span className="av-pile" data-pile="">
                    {MOMENTS.filter((m, i) => plateauPret || i === 0).map((m) => <Capture key={m.id} nom={m.capture} alt="" actif={actif === m.id} />)}
                  </span>
                </span>
              </div>
              <div>
                {MOMENTS.map((m) => (
                  <article key={m.id} className="av-moment" data-moment={m.id} {...(actif === m.id ? { 'data-actif': '' } : {})}>
                    <h3>{texteMoment(m, 'titre')}</h3>
                    <p>{texteMoment(m, 'texte')}</p>
                    <ul>{pointsMoment(m).map((x) => <li key={x}>{x}</li>)}</ul>
                    {/* Le premier moment est déjà la capture du haut de page : pas deux fois. */}
                    {m.id !== MOMENTS[0].id && <span className="av-tel av-tel-seul"><Capture nom={m.capture} alt={texteMoment(m, 'alt')} /></span>}
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* (11 nov., lot temps-gagne) Une ESTIMATION à partir des chiffres du visiteur, geste
            par geste — jamais un résultat de client (src/accueil/tempsGagne.js). */}
        <section className="av-temps" id="temps" data-section="temps">
          <div className="av-in">
            <div className="av-journee-tete" data-reveil="">
              <h2 className="av-h2">{tr('accueil.temps.titre')}</h2>
              <p className="av-chapo">{tr('accueil.temps.chapo')}</p>
            </div>
            <React.Suspense fallback={<div className="av-temps-attente" />}>
              {tempsPret ? <TempsGagne /> : <div className="av-temps-attente" />}
            </React.Suspense>
          </div>
        </section>

        <section className="av-bande" id="comment" data-section="comment">
          <div className="av-in av-deux">
            <div className="av-conf" data-confiance="" data-reveil="">
              <h2 className="av-h2">{tr('accueil.confiance.titre')}</h2>
              <p>{tr('accueil.confiance.1')}</p>
              <p>{tr('accueil.confiance.2')}</p>
              <ul className="av-auto">
                <li data-automatisme="">{tr('accueil.confiance.auto1')}</li>
                <li data-automatisme="">{tr('accueil.confiance.auto2')}</li>
              </ul>
              <p>{tr('accueil.confiance.3')}</p>
              <p>{tr('accueil.confiance.4')}</p>
              <p>{tr('accueil.confiance.5')}</p>
            </div>
            <div data-reveil="">
              <h2 className="av-h2" data-prerequis-ordinateur="">{tr('accueil.etapes.titre')}</h2>
              <ol className="av-etapes">
                <li><span className="n">1</span><div><h3>{tr('accueil.etape1.titre')}</h3><p>{tr('accueil.etape1.texte')}{ACCES_OFFERT && <span data-sans-carte="">{tr('accueil.etape1.sansCarte')}</span>}</p></div></li>
                <li><span className="n">2</span><div><h3>{tr('accueil.etape2.titre')}</h3><p>{tr(EXTENSION_SUR_LE_STORE ? 'accueil.etape2.store' : 'accueil.etape2.guide', { navigateurs: navsOrdi })}</p></div></li>
                <li><span className="n">3</span><div><h3>{tr('accueil.etape3.titre')}</h3><p>{tr('accueil.etape3.texte')}</p></div></li>
              </ol>
              <p className="av-note" data-ordinateur-necessaire="">{tr('accueil.note.ordinateur')}</p>
              <p className="av-note">{tr('accueil.note.telephone')}</p>
              {SERVIS.essai.length > 0 && <p className="av-note" data-navigateurs-essai={SERVIS.essai.join(',')}>{tr('accueil.note.essai', { essai: SERVIS.essai.join(', '), pasEncore: SERVIS.pasEncore.join(', ') })}</p>}
            </div>
          </div>
        </section>

        <section className="av-prix" id="prix" data-section="prix">
          <div className="av-in">
            <div className="av-prix-tete" data-reveil="">
              <h2 className="av-h2">{tr('accueil.offres.titre')}</h2>
              <p className="av-chapo">{tr('accueil.offres.chapo')}</p>
            </div>
            <div className="av-offres" data-reveil="">
              {/* Les noms et les phrases : OFFRES (api/_lib/plan-regle.js, la phrase
                  des Paramètres et du serveur). Les montants : PRIX_MOIS / PRIX_PRO_MOIS
                  (src/accueil-reglages.js), comparés aux CGV et au serveur par
                  scripts/audit-plans-solo-pro.cjs et le banc accueil. */}
              {[['solo', PRIX_MOIS, true], ['pro', PRIX_PRO_MOIS, PRO_OUVERT]].map(([cle, prix, ouvert]) => (
                <article key={cle} className={`av-offre av-offre-${cle}`} data-offre={cle} data-prix-offre={prix}>
                  <h3>{OFFRES[cle].nom}</h3>
                  <div className="av-montant"><b>{prixLu(prix)}</b><span>{tr('accueil.prix.parMois')}{ouvert ? '' : tr('accueil.offres.bientot')}</span></div>
                  {/* La phrase : en français CELLE du serveur (OFFRES) ; ailleurs sa traduction
                      (audit-traduction D9 : la clé française = la phrase du serveur). */}
                  <p data-offre-phrase={cle}>{langue === 'fr' ? OFFRES[cle].phrase : tr(`accueil.offre.${cle}.phrase`)}{ouvert ? '' : tr('accueil.offres.ouverture')}</p>
                </article>
              ))}
            </div>
            <div className="av-prix-pied" data-reveil="">
              {ACCES_OFFERT && <p className="av-offert" data-acces-offert="">{tr('accueil.offres.gratuitLong')}</p>}
              <p><span data-essai={ESSAI_JOURS}>{ligneEssai}</span>{tr('accueil.offres.essai')}</p>
              <p className="petit">{tr('accueil.offres.paiement')}<a href="/legal/cgv.html">{tr('accueil.offres.cgv')}</a>.</p>
              {creer()}
            </div>
          </div>
        </section>

        <section className="av-faq" id="faq" data-section="faq" data-faq="">
          <div className="av-in av-faq-grille">
            <h2 className="av-h2">{tr('accueil.faq.titre')}</h2>
            <div className="av-faq-texte">
              {FAQ.filter((q) => !q.si || q.si()).map((q) => (
                <div key={q.id} className="av-faq-q" data-question="">
                  <h3>{tr(`accueil.faq.${q.id}.q`)}</h3>
                  {q.r().map((x, i) => <p key={i}>{x}</p>)}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="av-fin" data-section="fin">
          <div className="av-in" data-reveil="">
            <p>{tr('accueil.fin')}</p>
            <div className="av-actions">
              {creer()}
              {connexion()}
            </div>
          </div>
        </section>
      </main>

      <footer className="av-pied">
        <div className="av-in">
          <div>
            <span className="marque">VRM</span>
            <span>© {new Date().getFullYear()} VRM · {tr('accueil.pied.affiliation')}</span>
          </div>
          <nav aria-label={tr('accueil.pied.informations')}>
            <a href="/aide">{tr('accueil.nav.aide')}</a>
            <a href="/statut" data-statut="">{tr('accueil.pied.statut')}</a>
            <a href="/confiance" data-lien-confiance="">{tr('legal.confiance')}</a>
            {LEGAL.map(([l, h]) => <a key={h} href={h}>{tr(l)}</a>)}
            {/* CONTACT — une seule source (src/contact.js) ; vide ⇒ on le DIT (§2.3). */}
            {contactEmail()
              ? <a data-contact="" href={`mailto:${contactEmail()}`}>{tr('accueil.pied.contact')}</a>
              : <span data-contact="" data-contact-absent="">{tr('accueil.pied.contact')}{tr('commun.deuxPoints')}{CONTACT_A_VENIR}</span>}
          </nav>
          {/* (11 nov., lot traduction) La langue de la page : celle du navigateur par défaut, ou choisie ici. */}
          <ChoixLangue className="av-langue" />
        </div>
      </footer>
    </div>
  );
}
