// ══════════════════════════════════════════════════════════════════════════
// LA PAGE D'ACCUEIL PUBLIQUE — ce que voit quelqu'un qui ne connaît pas VRM
// ══════════════════════════════════════════════════════════════════════════
// (8 nov., refaite pour VENDRE — calme, premium, style Apple de VRM.)
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
import { contactEmail, CONTACT_A_VENIR } from './contact.js';
import { ACCES_OFFERT, EXTENSION_SUR_LE_STORE, VESTIAIRE_BRANCHE, PRIX_MOIS, PRIX_PRO_MOIS, PRO_OUVERT, ESSAI_JOURS } from './accueil-reglages.js';
// (9 nov.) Deux offres : Solo (un compte vendeur par plateforme + comptes d'achat) et Pro (les ventes de tous les comptes).
import { OFFRES } from '../api/_lib/plan-regle.js';
import { useMoinsDeMouvement, useSansSouris } from './accueil-mouvement.js';
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
const MOMENTS = [
  {
    id: 'matin', capture: 'journee',
    alt: 'L’écran Ma journée de VRM : le montant vendu aujourd’hui, la semaine, et la liste « À faire » — 1 colis à envoyer, 2 colis à retirer, 2 messages. Données d’exemple.',
    titre: 'Chaque matin, le prochain geste.',
    texte: 'Ma journée met en haut ce qui presse : le colis à envoyer avant sa date limite, les achats arrivés au relais, les messages qui attendent. Un bouton par geste.',
    points: ['Tous tes comptes Vinted, Leboncoin, eBay et Vestiaire dans une seule liste.', 'La date limite vient de l’e-mail du bordereau ; une estimation est dite comme telle.'],
  },
  {
    id: 'colis', capture: 'retirer',
    alt: 'L’écran Colis de VRM, onglet « À retirer » : le point relais Le Fournil à Rennes, deux colis, et le code de retrait 582913 prêt à copier. Données d’exemple.',
    titre: 'Tes colis, à envoyer comme à retirer.',
    texte: 'Les bordereaux s’impriment d’un geste, tamponnés du titre et du numéro de la paire. Au relais, tes codes de retrait t’attendent, rangés par point, même sans réseau.',
    points: ['Le code, le QR et le point relais de chaque achat.', '« J’ai retiré » le sort de la liste ; un colis douteux reste visible, jamais caché.'],
  },
  {
    id: 'numeros', capture: 'numeros',
    alt: 'L’écran Annonces de VRM : chaque paire en ligne porte son numéro de rangement en pastille noire, N°14, N°15, N°16, N°9. Données d’exemple.',
    titre: 'Un numéro par paire. Jamais deux fois.',
    texte: 'Chaque annonce reçoit un numéro de rangement : il dit où est l’article (carton, étagère, bac…). Une vente est reliée à sa paire par une identité — l’annonce, la photo, la transaction —, jamais par un titre qui se ressemble.',
    points: ['Un numéro n’est jamais redonné à une autre paire.', 'Deux paires sous un même numéro : VRM te le dit, en rouge, tout de suite.'],
  },
  {
    id: 'compta', capture: 'compta',
    alt: 'L’écran Compta de VRM : « Déclarer octobre 2026, avant le 30 novembre », le chiffre d’affaires et les cotisations estimées à 12,4 %, puis « J’ai déclaré ». Données d’exemple.',
    titre: 'Ta compta et l’URSSAF, sans tableur.',
    texte: 'Le chiffre d’affaires mois par mois, daté au jour du versement, et ce qu’il faut recopier sur le site de l’URSSAF. Quand un prix d’achat manque, VRM écrit « au moins » plutôt qu’un faux total.',
    points: ['Vendu et reçu, séparés : une vente compte quand l’argent arrive.', '« J’ai déclaré » : une vente notée ne se recompte jamais ailleurs.'],
  },
];

const LEGAL = [
  ['CGV', '/legal/cgv.html'], ['CGU', '/legal/cgu.html'], ['Confidentialité', '/legal/confidentialite.html'],
  ['Mentions légales', '/legal/mentions-legales.html'], ['Cookies', '/legal/cookies.html'],
];

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

/* La barre : le fond de la page dès qu'on défile, rien de plus. */
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

/* Les boutons : une forme (pilule), deux poids. */
.av .av-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:48px;padding:0 24px;border-radius:999px;border:none;cursor:pointer;font:inherit;font-size:17px;font-weight:600;letter-spacing:-.01em;text-decoration:none;white-space:nowrap;background:var(--accent);color:#FFFFFF;transition:transform 120ms cubic-bezier(.23,1,.32,1),background-color 150ms ease}
.av .av-btn:active{transform:scale(.97)}
@media (hover:hover) and (pointer:fine){.av .av-btn:hover{background:#0077ED}}
.av .av-lien{display:inline-flex;align-items:center;min-height:44px;padding:0 8px;font-size:17px;color:var(--accent-texte);text-decoration:none;font-weight:500}
.av .av-lien span{transition:transform 150ms cubic-bezier(.23,1,.32,1);display:inline-block;margin-left:3px}
@media (hover:hover) and (pointer:fine){.av .av-lien:hover{text-decoration:underline;text-underline-offset:4px;text-decoration-thickness:1px}.av .av-lien:hover span{transform:translateX(2px)}}
.av-nav .av-btn{min-height:36px;padding:0 16px;font-size:14px;opacity:0;pointer-events:none;transform:translateY(4px);transition:opacity 160ms ease,transform 160ms ease}
.av-nav .av-btn.la{opacity:1;pointer-events:auto;transform:none}
.av-nav .av-lien{font-size:14px}

/* Le haut de page : la promesse, centrée — le seul moment centré de la page. */
.av-hero{padding:72px 0 0;text-align:center}
.av-h1{font-size:clamp(36px,5.2vw,76px);line-height:1.04;letter-spacing:-.035em;font-weight:700;max-width:16em;margin:0 auto;text-wrap:balance}
.av-sous{font-size:clamp(19px,1.7vw,24px);line-height:1.4;color:var(--gris);max-width:34em;margin:24px auto 0;text-wrap:balance;letter-spacing:-.015em}
.av-actions{display:flex;align-items:center;justify-content:center;gap:12px 20px;margin-top:32px;flex-wrap:wrap}
.av-prix-ligne{margin-top:20px;font-size:15px;color:var(--gris);line-height:1.5}
.av-prix-ligne b{color:var(--encre);font-weight:600}
.av-prix-ligne .nw{white-space:nowrap}
.av-prereq{margin:6px auto 0;font-size:15px;color:var(--gris);max-width:40em;line-height:1.5}

/* La scène du haut : l'ordinateur et le téléphone, de vraies captures. */
.av-scene{position:relative;margin:56px auto 0;max-width:1100px;padding:0 24px}
.av-ecran-bureau{display:block;border-radius:14px;overflow:hidden;background:var(--fond2);box-shadow:var(--ombre)}
.av-ecran-bureau img,.av-tel img{display:block;width:100%;height:auto}
.av-tel{display:block;background:var(--cadre);padding:7px;border-radius:44px;box-shadow:var(--ombre)}
.av-tel img{border-radius:37px;overflow:hidden}
.av-scene .av-tel{position:absolute;right:-8px;bottom:-56px;width:230px}
.av-legende{font-size:13px;color:var(--gris);margin-top:16px;text-align:left}
.av-scene .av-legende{margin-top:72px;text-align:center}

/* La journée : sur ordinateur, le téléphone reste fixe et change d'écran. */
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
.av-moment[data-actif] h3{color:var(--encre)}

/* Les comptes et l'installation : une bande grise, deux colonnes de texte. */
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

/* Le prix : la carte sombre, signature de VRM. */
.av-prix{padding:160px 0 0}
.av-carte-prix{background:var(--nuit);color:var(--nuit-encre);border-radius:28px;padding:64px;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:64px;align-items:end}
.av-carte-prix .av-h2{color:var(--nuit-encre)}
.av-montant{display:flex;align-items:baseline;gap:12px;margin-top:28px;font-variant-numeric:tabular-nums}
.av-montant b{font-size:clamp(64px,8vw,112px);font-weight:700;letter-spacing:-.045em;line-height:.95}
.av-montant span{white-space:nowrap;font-size:21px;color:var(--nuit-gris)}
.av-carte-prix p{font-size:17px;line-height:1.55;color:var(--nuit-encre);max-width:30em}
.av-carte-prix p + p{margin-top:14px}
.av-carte-prix .petit{font-size:15px;color:var(--nuit-gris)}
.av-carte-prix .petit a{color:var(--nuit-encre);text-underline-offset:3px}
.av-carte-prix .av-btn{margin-top:28px}
.av-offert{display:inline-block;margin-top:20px;font-size:15px;font-weight:600;color:var(--nuit-encre)}

/* Les questions : du texte qu'on lit, sans accordéon. */
.av-faq{padding:160px 0 0}
.av-faq-grille{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,8fr);gap:64px;align-items:start}
.av-faq-texte{columns:2;column-gap:56px}
.av-faq-texte p{break-inside:avoid;margin:0 0 24px;font-size:16px;line-height:1.55;color:var(--gris)}
.av-faq-texte p b{color:var(--encre);font-weight:600}
.av-faq-q{break-inside:avoid;margin:0 0 24px}
.av-faq-q>b{display:block;font-size:16px;line-height:1.55;color:var(--encre);font-weight:600}
.av-faq-texte .av-faq-q p{margin:0}
.av-auto{margin:8px 0 0;padding-left:1.2em;font-size:17px;line-height:1.55;max-width:34em}
.av-faq-texte a{color:var(--accent-texte);text-underline-offset:3px}

/* La fin : une phrase, un geste. */
.av-fin{padding:200px 0 160px;text-align:left}
.av-fin p{font-size:clamp(24px,2.4vw,32px);line-height:1.25;letter-spacing:-.022em;font-weight:600;max-width:24em;text-wrap:balance}
.av-fin .av-actions{justify-content:flex-start;margin-top:28px}

/* Le pied : la marque revient, puis les liens utiles. */
.av-pied{background:var(--fond2);padding:56px 0 calc(40px + env(safe-area-inset-bottom));font-size:13px;color:var(--gris)}
.av-pied .av-in{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:24px 48px;align-items:start}
.av-pied nav{display:flex;flex-wrap:wrap;gap:0 4px;justify-content:flex-end}
.av-pied nav a,.av-pied nav span{display:inline-flex;align-items:center;min-height:44px;padding:0 8px;text-decoration:none;color:var(--gris)}
@media (hover:hover) and (pointer:fine){.av-pied nav a:hover{color:var(--encre);text-decoration:underline;text-underline-offset:3px}}
.av-pied .marque{font-size:28px;font-weight:700;letter-spacing:-.02em;color:var(--encre);display:block;margin-bottom:8px}

/* Apparition au défilement : une fois, en montée courte ; jamais caché sans observateur. */
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

/* Tablette et petit ordinateur. */
@media (max-width:1023px){
  .av-split{grid-template-columns:1fr;gap:0;margin-top:32px}
  .av-plateau{display:none}
  .av-moment{min-height:0;padding:56px 0 0}
  .av-moment .av-tel-seul{display:block;width:min(300px,78vw);margin:32px auto 0}
  .av-deux,.av-carte-prix,.av-faq-grille{grid-template-columns:1fr;gap:40px}
  .av-carte-prix{padding:48px 32px}
  .av-liens{display:none}
}
/* Téléphone. */
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
  .av-prix,.av-faq{padding-top:104px}
  .av-carte-prix{padding:40px 24px;border-radius:24px}
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
  const moins = useMoinsDeMouvement();
  const sansSouris = useSansSouris();
  // Le fond du DOCUMENT suit la page (sinon iOS peint un autre fond au rebond).
  React.useEffect(() => {
    const avant = document.body.style.background, titre = document.title;
    let mq = null;
    const poser = () => { document.body.style.background = mq && mq.matches ? '#000000' : '#FFFFFF'; };
    try { mq = window.matchMedia('(prefers-color-scheme: dark)'); mq.addEventListener && mq.addEventListener('change', poser); } catch (_) {}
    poser();
    document.title = 'VRM — tes ventes, tes colis et ta compta, au même endroit';
    return () => { try { mq && mq.removeEventListener && mq.removeEventListener('change', poser); } catch (_) {} document.body.style.background = avant; document.title = titre; };
  }, []);

  // La barre : le fond dès 8 px ; « Créer mon compte » n'y paraît que quand le
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
    <a href="/?inscription" className="av-btn" data-cta="inscription" onPointerEnter={prepare} onFocus={prepare} onClick={entrer('up')} {...extra}>Créer mon compte</a>
  );
  const connexion = (extra) => (
    <a href="/?connexion" className="av-lien" onPointerEnter={prepare} onFocus={prepare} onClick={entrer('in')} {...extra}>Se connecter<span aria-hidden="true">›</span></a>
  );
  const ligneEssai = `${ESSAI_JOURS} jours d’essai gratuit`;

  return (
    <div className="av" data-accueil="">
      <style>{CSS}</style>
      <div className="av-sentinelle" ref={sentinelle} />
      <header className={`av-nav${defile ? ' defile' : ''}`}>
        <div className="av-in">
          <a className="av-marque" href="/" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: moins ? 'auto' : 'smooth' }); }} aria-label="VRM — haut de la page">
            <img className="vrm-brand-asset" src="/vrm-logo-v5-96.png" srcSet="/vrm-logo-v5-96.png 1x, /vrm-logo-v5-192.png 2x" alt="" width="28" height="28" />
            <b>VRM</b>
          </a>
          <nav className="av-liens" aria-label="Sections">
            <a href="#journee" onClick={vers('journee')}>Fonctions</a>
            <a href="#prix" onClick={vers('prix')}>Prix</a>
            <a href="#faq" onClick={vers('faq')}>Questions</a>
            <a href="/aide">Aide</a>
          </nav>
          <div className="av-droite">
            <a href="/?inscription" className={`av-btn${ctaNav ? ' la' : ''}`} data-cta-nav="inscription" tabIndex={ctaNav ? 0 : -1} aria-hidden={ctaNav ? undefined : 'true'} onPointerEnter={prepare} onFocus={prepare} onClick={entrer('up')}>Créer mon compte</a>
            <a href="/?connexion" className="av-lien" data-cta-nav="connexion" onPointerEnter={prepare} onFocus={prepare} onClick={entrer('in')}>Se connecter</a>
          </div>
        </div>
      </header>

      <main>
        <section className="av-hero" data-section="hero">
          <div className="av-in">
            <h1 className="av-h1" data-definition="">Tes ventes, tes colis et ta compta, au même endroit.</h1>
            <p className="av-sous">Vinted, Leboncoin, eBay, Vestiaire : chaque matin, quoi faire, sans erreur de paire.</p>
            <div className="av-actions">
              {creer({ ref: ctaHaut })}
              {connexion({ 'data-cta': 'connexion' })}
            </div>
            <p className="av-prix-ligne" data-prix-ligne="">
              {ACCES_OFFERT && <><span className="nw" data-acces-offert="">Gratuit pour l’instant</span>, puis </>}
              <span className="nw"><b>{PRIX_MOIS}&nbsp;€</b> par mois</span> après <span className="nw" data-essai={ESSAI_JOURS}>{ligneEssai}</span> · <span className="nw">sans engagement</span>
            </p>
            {/* Ce qui est VRAI (1er et 5 nov.) : VRM lit Vinted par l'extension, dans le
                navigateur de l'ordinateur ; le téléphone consulte et commande. Pas
                « Chrome obligatoire » : la liste des navigateurs SERVIS. */}
            <div className="av-prereq" data-prerequis="" data-variante={sansSouris ? 'tactile' : 'souris'} data-navigateurs={SERVIS.ordinateur.join(',')} data-lecture-telephone={SERVIS.lectureTelephone ? 'oui' : 'non'}>
              {sansSouris
                ? `Crée ton compte ici, puis installe l’extension une fois sur ton ordinateur : ${NAVS_ORDI}.`
                : `L’extension s’installe une fois sur ton ordinateur, dans ${NAVS_ORDI} — il reste nécessaire pour lire Vinted. Ton téléphone suit tout.`}
            </div>
          </div>
          <figure className="av-scene" data-scene-haut="">
            <span className="av-ecran-bureau"><Capture nom="bureau" taille={BUREAU} alt="Ma journée de VRM sur ordinateur : le menu à gauche, le montant vendu aujourd’hui au centre, et à droite « À faire » — 1 colis à envoyer, 2 colis à retirer, 2 messages, 6 prix à baisser. Données d’exemple." /></span>
            <span className="av-tel"><Capture nom="journee" paresseuse={false} prioritaire alt="Ma journée de VRM sur iPhone : le montant vendu aujourd’hui, la semaine, puis « À faire ». Données d’exemple." /></span>
            <figcaption className="av-legende">L’app VRM telle qu’elle est. Données d’exemple.</figcaption>
          </figure>
        </section>

        <section className="av-journee" id="journee" data-section="journee">
          <div className="av-in">
            <div className="av-journee-tete" data-reveil="">
              <h2 className="av-h2">Ta journée de revendeur, en quatre moments.</h2>
              <p className="av-chapo">Le matin, au relais, au stock, en fin de mois : ce qu’il y a à faire, rien de plus.</p>
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
                    <h3>{m.titre}</h3>
                    <p>{m.texte}</p>
                    <ul>{m.points.map((x) => <li key={x}>{x}</li>)}</ul>
                    {/* Le premier moment est déjà la capture du haut de page : pas deux fois. */}
                    {m.id !== MOMENTS[0].id && <span className="av-tel av-tel-seul"><Capture nom={m.capture} alt={m.alt} /></span>}
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="av-bande" id="comment" data-section="comment">
          <div className="av-in av-deux">
            <div className="av-conf" data-confiance="" data-reveil="">
              <h2 className="av-h2">Tes comptes restent les tiens.</h2>
              <p>VRM agit sur le compte ouvert, 50 actions/heure au plus. Jamais ton mot de passe Vinted.</p>
              <p>Rien ne part sans toi. Éteints tant que tu ne les allumes pas :</p>
              <ul className="av-auto">
                <li data-automatisme="">retirer d’eBay une annonce vendue ailleurs ;</li>
                <li data-automatisme="">accepter une offre au-dessus de ton prix mini.</li>
              </ul>
              <p>Messages aux favoris et republication : seulement si tu les lances.</p>
              <p>Aucune suppression sans ta confirmation.</p>
              <p>Tes données servent ta boutique : VRM ne vend rien, aucune publicité.</p>
            </div>
            <div data-reveil="">
              <h2 className="av-h2" data-prerequis-ordinateur="">Prêt en trois étapes.</h2>
              <ol className="av-etapes">
                <li><span className="n">1</span><div><h3>Crée ton compte</h3><p>Un e-mail et un mot de passe.{ACCES_OFFERT && <span data-sans-carte=""> Aucune carte bancaire.</span>}</p></div></li>
                <li><span className="n">2</span><div><h3>Ajoute l’extension à ton navigateur</h3><p>{`Une seule fois, sur ton ordinateur, dans ${NAVS_ORDI}${EXTENSION_SUR_LE_STORE ? ', depuis le Chrome Web Store. Puis connecte-la' : '. VRM te guide pas à pas, puis tu la connectes'} avec le même e-mail.`}</p></div></li>
                <li><span className="n">3</span><div><h3>Passe sur Vinted</h3><p>Avec chacun de tes comptes : ventes, annonces, bordereaux et messages arrivent dans VRM.</p></div></li>
              </ol>
              <p className="av-note" data-ordinateur-necessaire="">Ton ordinateur reste nécessaire : c’est lui qui lit Vinted. </p>
              <p className="av-note">Le téléphone consulte ; les actions passent par l’ordinateur allumé, navigateur ouvert.</p>
              {SERVIS.essai.length > 0 && <p className="av-note" data-navigateurs-essai={SERVIS.essai.join(',')}>{SERVIS.essai.join(', ')} (Mac, iPhone) : en essai, lecture de Vinted pas encore confirmée. {SERVIS.pasEncore.join(', ')} : pas encore.</p>}
            </div>
          </div>
        </section>

        <section className="av-prix" id="prix" data-section="prix">
          <div className="av-in">
            <div className="av-carte-prix" data-reveil="">
              <div>
                <h2 className="av-h2">Deux offres. Tout VRM.</h2>
                {ACCES_OFFERT && <span className="av-offert" data-acces-offert="">Gratuit pour l’instant</span>}
                <div className="av-montant" data-prix="" data-offre="solo"><b>{PRIX_MOIS}&nbsp;€</b><span>par mois · {OFFRES.solo.nom}</span></div>
                <div className="av-montant" data-prix-pro="" data-offre="pro"><b>{PRIX_PRO_MOIS}&nbsp;€</b><span>par mois · {OFFRES.pro.nom}{PRO_OUVERT ? '' : ' · bientôt'}</span></div>
              </div>
              <div>
                <p data-offre-phrase="solo"><b>{OFFRES.solo.nom}</b> : {OFFRES.solo.phrase}</p>
                <p data-offre-phrase="pro"><b>{OFFRES.pro.nom}</b> : {OFFRES.pro.phrase}{PRO_OUVERT ? '' : ' Ouverture prochaine.'}</p>
                <p>Toutes les fonctions, l’extension et l’app sur ton iPhone, dans les deux offres.</p>
                <p><span data-essai={ESSAI_JOURS}>{ligneEssai}</span>, une fois par e-mail et par compte Vinted. Sans engagement : tu résilies depuis l’app.</p>
                <p className="petit">
                  {ACCES_OFFERT && 'Tant que l’abonnement n’est pas exigé, VRM reste gratuit. '}
                  Aucun paiement sans que tu aies vu le prix et accepté les <a href="/legal/cgv.html">conditions générales de vente</a>.
                </p>
                {creer()}
              </div>
            </div>
          </div>
        </section>

        <section className="av-faq" id="faq" data-section="faq" data-faq="">
          <div className="av-in av-faq-grille">
            <h2 className="av-h2">Questions fréquentes</h2>
            <div className="av-faq-texte">
              <div className="av-faq-q"><b>Pourquoi une extension ?</b><p>Elle lit Vinted là où tu es connecté. Aucun mot de passe demandé. <a href="/aide/extension">L’installer</a>.</p></div>
              <div className="av-faq-q"><b>Vinted peut-il bloquer mon compte à cause de VRM ?</b><p>Personne ne peut le garantir. VRM agit comme toi : une requête à la fois.</p><p>50 actions par heure au plus, pause si Vinted ralentit.</p></div>
              <div className="av-faq-q"><b>Mes données sont-elles en sécurité ?</b><p>Aucun autre vendeur ne voit ta boutique. Double vérification possible.</p><p><a href="/legal/confidentialite.html">La politique de confidentialité</a>.</p></div>
              <div className="av-faq-q"><b>Comment j’arrête ?</b><p>Tu résilies depuis l’app : fin à la période payée, rien à payer pendant l’essai.</p><p>« Fermer mon compte » efface tes données.</p></div>
              <div className="av-faq-q"><b>Et sur mon téléphone ?</b><p>Tout se consulte, codes de retrait même sans réseau, une notification par vente.</p><p>Les actions passent par ton ordinateur.</p></div>
              <div className="av-faq-q"><b>J’ai plusieurs comptes Vinted.</b><p>C’est fait pour, chiffres séparés.</p><p>Solo : un compte vend par plateforme, les autres achètent.</p><p>Et avec Pro, tous tes comptes vendent, sans limite.</p></div>
              <p><b>C’est seulement pour les baskets ?</b> Non : tout article (vêtements, sacs, livres…).</p>
              {!VESTIAIRE_BRANCHE && <p><b>Et Vestiaire Collective ?</b> En cours : ses ventes n’entrent encore dans aucun total.</p>}
              <p><b>Une autre question ?</b> <a href="/aide">L’aide</a> ; <a href="/statut">l’état du service</a>.</p>
            </div>
          </div>
        </section>

        <section className="av-fin" data-section="fin">
          <div className="av-in" data-reveil="">
            <p>Demain matin, tu sauras quoi poster, quoi retirer et quoi déclarer.</p>
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
            <span>© {new Date().getFullYear()} VRM · VRM n’est pas affilié à Vinted, Leboncoin, eBay ou Vestiaire Collective.</span>
          </div>
          <nav aria-label="Informations">
            <a href="/aide">Aide</a>
            <a href="/statut" data-statut="">État du service</a>
            {LEGAL.map(([l, h]) => <a key={h} href={h}>{l}</a>)}
            {/* CONTACT — une seule source (src/contact.js) ; vide ⇒ on le DIT (§2.3). */}
            {contactEmail()
              ? <a data-contact="" href={`mailto:${contactEmail()}`}>Contact</a>
              : <span data-contact="" data-contact-absent="">Contact : {CONTACT_A_VENIR}</span>}
          </nav>
        </div>
      </footer>
    </div>
  );
}
