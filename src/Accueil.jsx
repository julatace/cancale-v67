// ══════════════════════════════════════════════════════════════════════════
// LA PAGE D'ACCUEIL PUBLIQUE — ce que voit quelqu'un qui ne connaît pas VRM
// ══════════════════════════════════════════════════════════════════════════
// (8 nov., refaite pour VENDRE ; 11 nov., pour TOUT revendeur.)
// (15 nov., lot site-public — Julien : « améliore tout le site, là il est pas ouf ».)
// Refaite au studio (bleu clair éclairé du haut, porcelaine, encre, Inter) :
//   1. le PREMIER ÉCRAN dit en 3 secondes ce qu'est VRM et pour qui : la phrase
//      (« Tes ventes Vinted, Leboncoin, eBay et Vestiaire au même endroit »), ce
//      qu'elle couvre (numéros, colis, retraits, compta), UN bouton plein
//      (« Essayer gratuitement »), « Découvrir avec des exemples », le prix, le
//      prérequis — et une VRAIE capture de l'app (mode exemple) déjà à l'écran,
//      au téléphone comme à l'ordinateur ;
//   2. LES FONCTIONS MONTRÉES : six tuiles (numéros, bordereaux, retraits, comptes
//      et plateformes, compta, extension), chacune sa capture réelle ;
//   3. le calculateur du temps gagné, la confiance et les trois étapes, les deux
//      offres (montants des CGV), les questions, la fin, le pied (non-affiliation).
//
// ⚠️ AUCUNE PREUVE INVENTÉE (§2.3) : ni témoignage, ni nombre de vendeurs, ni note,
//    ni logo de presse ou de client. Chaque image est l'app réelle sur des données
//    INVENTÉES et le dit (« Données d'exemple »). Les marques des plateformes sont
//    citées en texte ; leurs pictogrammes monochromes (public/brands/, fabriqués
//    depuis src/plateformes/marques.js) ne servent qu'à les reconnaître.
// ⚠️ Le prix et l'essai viennent de src/accueil-reglages.js, comparés par le banc
//    aux CGV et au serveur (scripts/bancs/accueil.cjs).
// ⚠️ LÉGÈRE : cette page se charge AVANT l'app ; elle ne télécharge ni l'app ni le
//    film. Les captures sont en WebP (~40 Ko), au double de leur taille affichée,
//    chargées paresseusement sauf celles du premier écran. Le style vit dans
//    src/accueil/accueil.css (une feuille, pas une chaîne dans le fichier d'entrée).
// ⚠️ Les contrats `data-*` (prérequis, navigateurs, ordinateur nécessaire, accès
//    offert, contact, confiance) sont lus par les audits et les bancs : ne pas les retirer.
import React from 'react';
import { lazySur } from './chargementSur.js';   // (15 nov.) un morceau qui rate : relancé, puis rechargement propre ou « Mettre à jour VRM »
import { tr, listeDansLaLangue, monnaie } from './i18n/index.js';
import { useLangue } from './i18n/react.js';
import ChoixLangue from './i18n/ChoixLangue.jsx';
import { contactEmail, CONTACT_A_VENIR } from './contact.js';
import { ACCES_OFFERT, EXTENSION_SUR_LE_STORE, VESTIAIRE_BRANCHE, PRIX_MOIS, PRIX_PRO_MOIS, PRO_OUVERT, ESSAI_JOURS } from './accueil-reglages.js';
// (9 nov.) Deux offres : Solo (un compte vendeur par plateforme + comptes d'achat) et Pro (les ventes de tous les comptes).
import { OFFRES, prixCompteSupTexte } from '../api/_lib/plan-offres.js';   // (16 nov.) le petit module des offres (plan-regle.js les ré-exporte)
import { useMoinsDeMouvement, useSansSouris } from './accueil-media.js';
// (15 nov.) Les liens d'entrée portent la suite de l'adresse (code d'un partenaire, utm…) jusqu'au formulaire.
import { lienEntree } from './accueil/lienEntree.js';
// (11 nov., lot temps-gagne) Le calculateur « le temps que VRM te fait gagner » : un morceau à
// part, demandé à l'approche de sa section (le fichier d'entrée a un budget de poids).
const TempsGagne = lazySur(() => import('./accueil/TempsGagne.jsx'));
// (5 nov.) Les navigateurs où l'extension SERVIE s'installe : une source, la même
// que l'app — jamais « Chrome obligatoire ». Module léger.
import { navigateursServis, NAVS_ORDINATEUR_TEXTE as NAVS_ORDI } from './navigateursServis.js';
// (14 nov., idée d'accueil 146) « Voir VRM en 45 s » : rien n'est téléchargé avant le toucher.
import AccueilVideo from './accueil/AccueilVideo.jsx';
import './design/studio-polices.css';        // Inter, la police de l'app (swap : jamais bloquante)
import './accueil/accueil.css';               // (15 nov.) le style de la page, au studio (src/design/studio-reste-public.css reste aux tarifs)
const SERVIS = navigateursServis();

// ── Les captures (public/accueil/, scripts/accueil-captures.cjs) ────────────
// Taille réelle des fichiers : téléphone 780 × 1688 (390 px affichés, ×2),
// ordinateur 1600 × 1000 (1440 × 900 réduits).
const TEL = { w: 780, h: 1688 }, BUREAU = { w: 1600, h: 1000 };
function Capture({ nom, alt, taille = TEL, paresseuse = true, prioritaire = false }) {
  return (
    <picture data-capture={nom}>
      <source srcSet={`/accueil/${nom}-sombre.webp`} media="(prefers-color-scheme: dark)" type="image/webp" />
      <img src={`/accueil/${nom}-clair.webp`} alt={alt} width={taille.w} height={taille.h}
        loading={paresseuse ? 'lazy' : 'eager'} decoding="async" {...(prioritaire ? { fetchpriority: 'high' } : {})} />
    </picture>
  );
}

// Les pictogrammes des plateformes : un masque CSS (les fichiers SVG de public/brands, la couleur du texte).
// Décor : le NOM est toujours écrit à côté (lecteurs d'écran, usage nominatif).
const PLATEFORMES = ['vinted', 'leboncoin', 'ebay', 'vestiaire'];
const Picto = ({ site }) => <i className={`av-picto av-picto-${site}`} aria-hidden="true" />;

// ── Les fonctions, montrées ─────────────────────────────────────────────────
// (11 nov., lot traduction) Les textes vivent dans les dictionnaires (src/i18n/langues/)
// (`accueil.moment.<id>.titre|texte|alt|point1|point2`) : ici, l'ordre et les captures.
// (15 nov.) Six tuiles au lieu de cinq moments : la sixième (l'extension) n'a pas de capture.
const MOMENTS = [
  { id: 'numeros', capture: 'numeros' },
  { id: 'expedier', capture: 'expedier' },
  { id: 'colis', capture: 'retirer' },
  { id: 'comptes', capture: 'messages' },
  { id: 'compta', capture: 'compta' },
];
const texteMoment = (id, champ) => tr(`accueil.moment.${id}.${champ}`);

// ── Les questions : une question (h3), sa réponse. Une réponse ne promet que
//    ce que le code fait ; `si` cache une question quand elle n'a plus lieu d'être.
// (11 nov., lot traduction) Les questions : `accueil.faq.<id>.q` et ses réponses dans les dictionnaires.
const FAQ = [
  { id: 'blocage', r: () => [tr('accueil.faq.blocage.r1'), tr('accueil.faq.blocage.r2')] },
  // (13 nov., lot 50) + la page publique « Ce que VRM fait — et ne fait jamais » (public/confiance.html).
  { id: 'securite', r: () => [tr('accueil.faq.securite.r1'), <a key="f" href="/confiance" data-lien-confiance="">{tr('legal.confiance')}</a>, <a key="c" href="/legal/confidentialite.html">{tr('accueil.faq.securite.lien')}</a>] },
  { id: 'arret', r: () => [tr('accueil.faq.arret.r1'), tr('accueil.faq.arret.r2')] },
  { id: 'extension', r: () => [<>{tr('accueil.faq.extension.r')}<a href="/aide/extension">{tr('accueil.faq.extension.lien')}</a>.</>] },
  { id: 'telephone', r: () => [tr('accueil.faq.telephone.r1'), tr('accueil.faq.telephone.r2')] },
  { id: 'comptes', r: () => [tr('accueil.faq.comptes.r1'), tr('accueil.faq.comptes.r2'), tr('accueil.faq.comptes.r3')] },
  { id: 'baskets', r: () => [tr('accueil.faq.baskets.r')] },
  { id: 'vestiaire', si: () => !VESTIAIRE_BRANCHE, r: () => [tr('accueil.faq.vestiaire.r')] },
  { id: 'autre', r: () => [<><a href="/aide">{tr('accueil.faq.autre.aide')}</a> ; <a href="/statut">{tr('accueil.faq.autre.statut')}</a>.</>] },
];

const LEGAL = [
  ['legal.cgv', '/legal/cgv.html'], ['legal.cgu', '/legal/cgu.html'], ['legal.confidentialite', '/legal/confidentialite.html'],
  ['legal.mentions', '/legal/mentions-legales.html'], ['legal.cookies', '/legal/cookies.html'],
];

export default function Accueil({ onEntrer }) {
  const langue = useLangue();
  const moins = useMoinsDeMouvement();
  const sansSouris = useSansSouris();
  // Le fond du DOCUMENT suit la page (sinon iOS peint un autre fond au rebond) : le haut du bleu clair.
  React.useEffect(() => {
    const avant = document.body.style.background, titre = document.title;
    let mq = null;
    const poser = () => { document.body.style.background = mq && mq.matches ? '#27272B' : '#F4F5F7'; };
    try { mq = window.matchMedia('(prefers-color-scheme: dark)'); mq.addEventListener && mq.addEventListener('change', poser); } catch (_) {}
    poser();
    document.title = tr('accueil.titrePage');
    return () => { try { mq && mq.removeEventListener && mq.removeEventListener('change', poser); } catch (_) {} document.body.style.background = avant; document.title = titre; };
  }, [langue]);

  // La barre : le verre dès 8 px ; « Essayer gratuitement » n'y paraît que quand le
  // bouton du haut est sorti de l'écran (un seul bouton plein à la fois).
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

  // Les captures des fonctions ne se demandent qu'à l'approche de leur section (sinon le chargement
  // paresseux du navigateur, qui anticipe de plusieurs écrans, les tirerait au premier affichage).
  const [fonctionsPretes, setFonctionsPretes] = React.useState(false);
  React.useEffect(() => {
    let io = null;
    try {
      io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setFonctionsPretes(true); io.disconnect(); } }, { rootMargin: '0px 0px 5% 0px' });
      const f = document.querySelector('#fonctions .av-bento'); if (f) io.observe(f);
    } catch (_) { setFonctionsPretes(true); }
    return () => { try { io && io.disconnect(); } catch (_) {} };
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
  // De vrais liens (`/?inscription`, `/?connexion`, avec la suite de l'adresse) : ils marchent
  // sans script ; avec, l'app s'ouvre sans recharger la page.
  const entrer = (mode) => (e) => { if (!onEntrer || e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); onEntrer(mode); };
  const hrefInscription = lienEntree('inscription'), hrefConnexion = lienEntree('connexion');
  // ⚠️ Des fonctions qui RENDENT un bouton, pas des composants déclarés ici
  //    (un composant redéfini à chaque rendu perdrait le focus clavier).
  const creer = (extra) => (
    <a href={hrefInscription} className="av-btn" data-cta="inscription" onPointerEnter={prepare} onFocus={prepare} onClick={entrer('up')} {...extra}>{tr('accueil.cta.essayer')}</a>
  );
  // (13 nov., lot 48) VRM rempli de données INVENTÉES, sans compte : un vrai lien
  // (`/?exemple`, src/modeExemple.js) — rien n'est enregistré, rien n'est envoyé.
  // (15 nov.) Une TOUCHE en porcelaine, jamais un second bouton plein.
  const exemple = (extra) => (
    <a href="/?exemple" className="av-btn av-btn-exemple" data-cta="exemple" onPointerEnter={prepare} onFocus={prepare} {...extra}>{tr('accueil.cta.exemple')}</a>
  );
  const connexion = (extra) => (
    <a href={hrefConnexion} className="av-lien" onPointerEnter={prepare} onFocus={prepare} onClick={entrer('in')} {...extra}>{tr('auth.titre.in')}<span aria-hidden="true">›</span></a>
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
      <div className="av-sentinelle" ref={sentinelle} />
      <header className={`av-nav${defile ? ' defile' : ''}`}>
        <div className="av-in">
          <a className="av-marque" href="/" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: moins ? 'auto' : 'smooth' }); }} aria-label={tr('accueil.hautDePage')}>
            <img className="vrm-brand-asset" src="/vrm-logo-v5-96.png" srcSet="/vrm-logo-v5-96.png 1x, /vrm-logo-v5-192.png 2x" alt="" width="28" height="28" />
            <b>VRM</b>
          </a>
          <nav className="av-liens" aria-label={tr('accueil.nav.sections')}>
            <a href="#fonctions" onClick={vers('fonctions')}>{tr('accueil.nav.fonctions')}</a>
            <a href="#prix" onClick={vers('prix')}>{tr('accueil.nav.prix')}</a>
            <a href="#faq" onClick={vers('faq')}>{tr('accueil.nav.questions')}</a>
            <a href="/aide">{tr('accueil.nav.aide')}</a>
          </nav>
          <div className="av-droite">
            <a href={hrefConnexion} className="av-lien" data-cta-nav="connexion" onPointerEnter={prepare} onFocus={prepare} onClick={entrer('in')}>{tr('auth.titre.in')}</a>
            <a href={hrefInscription} className={`av-btn${ctaNav ? ' la' : ''}`} data-cta-nav="inscription" tabIndex={ctaNav ? 0 : -1} aria-hidden={ctaNav ? undefined : 'true'} onPointerEnter={prepare} onFocus={prepare} onClick={entrer('up')}>{tr('accueil.cta.essayer')}</a>
          </div>
        </div>
      </header>

      <main>
        <section className="av-hero" data-section="hero">
          <div className="av-in av-hero-grille">
            <div className="av-hero-texte">
              <p className="av-pour" data-pour-qui="">
                <span className="av-pictos" aria-hidden="true">{PLATEFORMES.map((p) => <Picto key={p} site={p} />)}</span>
                <span>{tr('accueil.hero.pour')}</span>
              </p>
              <h1 className="av-h1" data-definition="">{tr('accueil.hero.titre')}</h1>
              <p className="av-sous">{tr('accueil.hero.sous')}</p>
              <div className="av-actions">
                {creer({ ref: ctaHaut })}
                {exemple()}
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
              <span className="av-ecran-bureau"><Capture nom="bureau" taille={BUREAU} paresseuse={sansSouris} alt={tr('accueil.capture.bureau')} /></span>
              <span className="av-tel av-tel-haut"><Capture nom="journee" paresseuse={false} prioritaire alt={tr('accueil.capture.iphone')} /></span>
              <figcaption className="av-legende">{tr('accueil.capture.legende')}</figcaption>
            </figure>
          </div>
          <div className="av-in av-video-ligne"><AccueilVideo /></div>
        </section>

        <section className="av-fonctions" id="fonctions" data-section="fonctions">
          <div className="av-in">
            <div className="av-tete" data-reveil="">
              <h2 className="av-h2">{tr('accueil.journee.titre')}</h2>
              <p className="av-chapo">{tr('accueil.journee.chapo')}</p>
            </div>
            <div className="av-bento">
              {/* L'ordre de la grille (3 colonnes) : numéros (large) · bordereaux / retraits · comptes · extension /
                  compta (toute la largeur). */}
              {MOMENTS.filter((m) => m.id !== 'compta').map((m) => (
                <article key={m.id} className={`av-tuile av-tuile-${m.id}`} data-moment={m.id} data-reveil="">
                  <div className="av-tuile-texte">
                    {m.id === 'comptes' && <span className="av-pictos av-pictos-grands" aria-hidden="true">{PLATEFORMES.map((p) => <Picto key={p} site={p} />)}</span>}
                    <h3>{texteMoment(m.id, 'titre')}</h3>
                    <p>{texteMoment(m.id, 'texte')}</p>
                    <ul>{[texteMoment(m.id, 'point1'), texteMoment(m.id, 'point2')].map((x) => <li key={x}>{x}</li>)}</ul>
                  </div>
                  <span className="av-fenetre">{fonctionsPretes ? <Capture nom={m.capture} alt={texteMoment(m.id, 'alt')} /> : <span className="av-fenetre-vide" />}</span>
                </article>
              ))}
              <article className="av-tuile av-tuile-extension" data-moment="extension" data-reveil="">
                <div className="av-tuile-texte">
                  <h3>{tr('accueil.moment.extension.titre')}</h3>
                  <p>{tr('accueil.moment.extension.texte', { navigateurs: navsOrdi })}</p>
                  <ul>
                    <li>{tr('accueil.moment.extension.point1')}</li>
                    <li>{tr('accueil.moment.extension.point2')}</li>
                  </ul>
                  <a className="av-lien av-lien-tuile" href="/aide/extension">{tr('accueil.faq.extension.lien')}<span aria-hidden="true">›</span></a>
                </div>
              </article>
              {MOMENTS.filter((m) => m.id === 'compta').map((m) => (
                <article key={m.id} className={`av-tuile av-tuile-${m.id}`} data-moment={m.id} data-reveil="">
                  <div className="av-tuile-texte">
                    <h3>{texteMoment(m.id, 'titre')}</h3>
                    <p>{texteMoment(m.id, 'texte')}</p>
                    <ul>{[texteMoment(m.id, 'point1'), texteMoment(m.id, 'point2')].map((x) => <li key={x}>{x}</li>)}</ul>
                  </div>
                  <span className="av-fenetre">{fonctionsPretes ? <Capture nom={m.capture} alt={texteMoment(m.id, 'alt')} /> : <span className="av-fenetre-vide" />}</span>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* (11 nov., lot temps-gagne) Une ESTIMATION à partir des chiffres du visiteur, geste
            par geste — jamais un résultat de client (src/accueil/tempsGagne.js). */}
        <section className="av-temps" id="temps" data-section="temps">
          <div className="av-in">
            <div className="av-tete" data-reveil="">
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
            <div className="av-panneau av-conf" data-confiance="" data-reveil="">
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
              <p className="av-note"><a href="/confiance" data-lien-confiance="">{tr('legal.confiance')}<span aria-hidden="true"> ›</span></a></p>
            </div>
            <div className="av-panneau" data-reveil="">
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
            <div className="av-tete" data-reveil="">
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
                  {/* (13 nov., lot 56) Plusieurs comptes Vinted dès Solo : le supplément (une valeur, plan-regle.js). */}
                  {cle === 'solo' && <p className="av-supplement" data-solo-supplement="">{langue === 'fr' ? OFFRES.solo.supplement : tr('accueil.offre.solo.supplement').replace('{prix}', prixCompteSupTexte())}</p>}
                </article>
              ))}
            </div>
            <div className="av-prix-pied" data-reveil="">
              {ACCES_OFFERT && <p className="av-offert" data-acces-offert="">{tr('accueil.offres.gratuitLong')}</p>}
              <p><span data-essai={ESSAI_JOURS}>{ligneEssai}</span>{tr('accueil.offres.essai')}</p>
              <p className="petit">{tr('accueil.offres.sansAbonnement')}</p>
              <p className="petit">{tr('accueil.offres.paiement')}<a href="/legal/cgv.html">{tr('accueil.offres.cgv')}</a>.</p>
              {/* (14 nov., n° 144) Tout le détail : la page publique des tarifs. */}
              <p className="petit"><a href="/tarifs" data-lien-tarifs="">{tr('accueil.offres.tarifs')}</a></p>
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
            <div className="av-fin-plaque">
              <p>{tr('accueil.fin')}</p>
              <div className="av-actions">
                {creer()}
                {exemple({ 'data-cta': 'exemple-fin' })}
              </div>
              <p className="av-fin-connexion">{connexion({ 'data-cta': 'connexion' })}</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="av-pied">
        <div className="av-in">
          <div>
            <span className="marque">VRM</span>
            <span className="av-affiliation" data-affiliation="">© {new Date().getFullYear()} VRM · {tr('accueil.pied.affiliation')}</span>
          </div>
          <nav aria-label={tr('accueil.pied.informations')}>
            <a href="/aide">{tr('accueil.nav.aide')}</a>
            <a href="/tarifs">{tr('accueil.nav.prix')}</a>
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
