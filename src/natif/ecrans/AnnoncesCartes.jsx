// ── src/natif/ecrans/AnnoncesCartes.jsx — Annonces en GRILLE de cartes (21 nov.) ─────────────────────────────────────────
// Julien, 21 nov. : « les annonces sont moches » — « toujours dans le style Vintex », inspiré du Dressing de Bleam (grille de
// cartes photo, 2 colonnes au téléphone), et la page « Articles » de Vintex pour la LISTE. Puis : « ça fait trop vibe codé,
// c'est dégueulasse sur téléphone » ⇒ calme : une carte = UNE photo, UN rond « ⋯ » (les gestes de l'article, dans une feuille),
// au plus un bandeau d'état et une étiquette de conseil, puis titre, « marque · taille », prix, vues · favoris · jours.
// Une VUE : aucune lecture, aucune règle. Les articles viennent de src/articles/modele.js ; le conseil « dort » est calculé par
// l'écran avec la règle du segment « Dorment » (`dortDe`) — jamais un conseil inventé : pas de donnée ⇒ pas d'étiquette.
// Aucun geste de plateforme ici : le « ⋯ » ouvre la feuille des gestes EXISTANTS de l'écran (les mêmes que « Actions »).
import React from 'react';
import { tr } from '../../i18n/index.js';
import { Plaque } from '../Plaque.jsx';
import { LogoSite } from '../LogoSite.jsx';
import { Glyphe } from '../icones.jsx';
import { cx } from '../outils.js';
import { TuilePaire, EtiquetteN } from '../Jeu.jsx';   // (24 nov., lot visuel-annonces) la tuile d'inventaire
import { AvatarsComptes, PontPhoto, PhotoPont, TaillePhoto } from '../visuel/Inventaire.jsx';

// La vue choisie au téléphone (`vrm_annonces_vue`, cet appareil seulement : une commodité d'affichage, jamais une donnée).
const CLE_VUE = 'vrm_annonces_vue_tel';
export function lireVueTel() { try { const v = localStorage.getItem(CLE_VUE); return v === 'grille' ? 'grille' : 'liste'; } catch (_) { return 'liste'; } }   // (21 nov., 2e passe) la LISTE par défaut
export function ecrireVueTel(v) { try { localStorage.setItem(CLE_VUE, v === 'grille' ? 'grille' : 'liste'); } catch (_) { /* navigation privée : le choix vit le temps de la page */ } }

// (21 nov., captures de Julien : « T. 40,5 » sous « … taille 40,5 ») La taille déjà écrite dans le titre ne se répète pas.
export function tailleDansTitre(titre, taille) {
  const t = String(taille == null ? '' : taille).trim().replace(/[.,]/g, '[.,]');
  if (!t) return false;
  try { return new RegExp('(^|[^0-9])' + t + '(?![0-9]|[.,][0-9])', 'i').test(String(titre || '')); } catch (_) { return false; }
}
export const marqueDe = (a) => { const x = (a && Array.isArray(a.annonces) ? a.annonces : []).find((y) => y && y.marque); return x ? String(x.marque) : ''; };
// L'état dit SUR la photo : seulement ce qui n'est pas « en ligne » (une même phrase sur chaque carte n'est pas répétée).
export const bandeauDe = (a) => (a && a.etat && a.etat !== 'enligne' ? a.etat : '');
// La trace d'un compte bloqué : la plus récente de ses annonces « bloque » (« Lu le 21 nov. », « N° posé le 3 sept. »).
export function traceDe(a) {
  const l = (a && Array.isArray(a.annonces) ? a.annonces : []).filter((x) => x && x.etat === 'bloque' && x.bloque);
  if (!l.length) return null;
  const t = l.slice().sort((x, y) => (y.bloque.le || 0) - (x.bloque.le || 0))[0].bloque;
  return { le: t.le, par: t.par };
}
const dateJour = (ms) => { try { return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); } catch (_) { return ''; } };
export const texteTrace = (t) => (!t ? '' : t.le == null ? tr('egalite.d.trace.inconnu') : tr('egalite.d.trace.' + (t.par === 'vu' ? 'vu' : t.par === 'numero' ? 'numero' : 'lecture'), { d: dateJour(t.le) }));
export const seulementBloque = (a) => !!(a && Array.isArray(a.annonces) && a.annonces.length && a.annonces.every((x) => x.etat === 'bloque' || x.etat === 'vendue' || x.etat === 'retiree'));

// Vues · favoris · jours en ligne : chacun seulement s'il est LU (jamais « — » répété sur chaque carte).
export function Stats({ a, depuisTexte, Icon = null, className = '' }) {
  const ic = (n) => (Icon ? <Icon name={n} size={14}/> : null);
  const bouts = [];
  if (a.vues != null) bouts.push(<span key="v" className="n-ad-stat" data-ad-stat="vues" aria-label={tr('egalite.vues', { n: a.vues })}>{ic('eye')}<span aria-hidden="true">{a.vues}</span></span>);
  if (a.favoris != null) bouts.push(<span key="f" className="n-ad-stat" data-ad-stat="favoris" aria-label={tr('egalite.favoris', { n: a.favoris })}>{ic('heart')}<span aria-hidden="true">{a.favoris}</span></span>);
  if (a.depuis != null && a.etat !== 'bloque') bouts.push(<span key="j" className="n-ad-stat" data-ad-stat="jours">{ic('clock')}<span>{depuisTexte(a.depuis)}</span></span>);
  if (!bouts.length) return null;
  return <span className={cx('n-ad-stats', className)}>{bouts}</span>;
}

// La photo d'une carte ou d'une rangée : taille RÉSERVÉE par le cadre (rien ne saute), sinon l'icône calme.
function PhotoCadre({ a, Photo, taille = 28 }) {
  const [rate, setRate] = React.useState(false);
  return a.photo && !rate
    ? (Photo ? Photo(a.photo) : <img src={a.photo} alt="" width="300" height="300" loading="lazy" decoding="async" referrerPolicy="no-referrer" draggable="false" onError={() => setRate(true)}/>)
    : <span className="n-ad-sans-photo" aria-hidden="true"><Glyphe nom="image" taille={taille}/></span>;
}
const BoutonPlus = ({ a, onGestes, className }) => (
  <button type="button" className={className} data-ad-gestes={a.cle} aria-label={tr('egalite.d.gestes', { titre: a.titre || '' })}
    onClick={(e) => { e.stopPropagation(); onGestes(a); }}><Glyphe nom="more" taille={18}/></button>
);

// UNE carte de la grille — (24 nov., lot visuel-annonces : « toute l'application visuelle », Julien) une TUILE D'INVENTAIRE :
// la photo carrée en grand (TuilePaire, src/natif/Jeu.jsx : l'étiquette papier du N° en bas à gauche, la photo en fondu sur le
// gris, jamais un flash blanc), les ronds des comptes en haut à droite, vues et favoris en pastilles en bas à droite, l'état en
// pastille calme seulement s'il n'est pas « en ligne » ; dessous le titre (2 lignes) et UNE ligne : logos · prix · point d'état ·
// « ⋯ ». Hauteur FIXE (src/natif/visuel/inventaire.css) : la grille virtualisée connaît chaque case d'avance.
// La photo est CELLE DE L'ARTICLE (`a.photo`, trouvée par identité dans src/articles/modele.js) : rien n'est cherché ici.
// Un doublon de N° garde la Plaque rouge (le seul rouge, §7) à la place de l'étiquette.
// `selection` : { cochee, cochable, onBascule } (mode « Actions ») ; `onGestes` : le « ⋯ » (absent ⇒ pas de « ⋯ »).
const IconeGlyphe = ({ name, size }) => <Glyphe nom={name} taille={size}/>;
export const comptesDe = (a) => {
  const vus = new Map();
  for (const x of (a && Array.isArray(a.annonces) ? a.annonces : [])) {
    if (!x || x.etat === 'vendue' || x.etat === 'retiree') continue;
    const cle = (x.site || '') + ':' + (x.compte || '');
    if (!vus.has(cle) && (x.pseudo || x.compte)) vus.set(cle, { cle, pseudo: x.pseudo || x.compte });
  }
  return [...vus.values()];
};
export function CarteAnnonce({ a, onOuvrir, onGestes = null, selection = null, euros, nomSite, dort = null, plusVue = null, Photo = null, attrs = null, Icon = null, revele = null, taillePhoto = 360, groupe = false }) {   // (22 nov., choix 27) plusVue : jours mesurés (src/plusVue.js) ou null
  const bandeau = bandeauDe(a);
  const trace = a.etat === 'bloque' ? traceDe(a) : null;
  const grise = selection && !selection.cochable;
  const clic = () => { if (selection) { if (selection.cochable) selection.onBascule(); return; } onOuvrir(a); };
  const ic = (n) => (Icon ? <Icon name={n} size={13}/> : null);
  const comptes = comptesDe(a);
  return (
    <div {...(revele || {})} className={cx('n-ad-carte n-inv', revele && revele.className)} style={revele ? revele.style : undefined} role="button" tabIndex={0} aria-pressed={selection ? (selection.cochee ? 'true' : 'false') : undefined}
      aria-disabled={grise ? 'true' : undefined} data-ad-carte="" data-ad-etat={a.etat} data-ad-grise={grise ? '1' : undefined} data-inv-photo={a.photo || ''} data-inv-trace={trace ? '1' : undefined}
      onClick={clic} onKeyDown={(e) => { if (e.target !== e.currentTarget) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clic(); } }} {...(attrs || {})}>
      <span className="n-ad-photo n-inv-photo">
        <PontPhoto.Provider value={Photo}><TaillePhoto.Provider value={taillePhoto}>
          <TuilePaire photo={a.photo || ''} numero='' Photo={PhotoPont} Icon={IconeGlyphe} icone={a.photo ? '' : 'image'} taille="xl"
            attrsN={{ 'data-inv-n': a.numero || '' }}/>
        </TaillePhoto.Provider></PontPhoto.Provider>
        {/* (24 nov., retouches du coordinateur) Une BANDE claire en bas de la photo : l'étiquette du N° à gauche, vues et favoris à
            droite (texte + icône, pas de pastilles posées sur la chaussure). Le doublon garde la Plaque rouge à la place. */}
        {(a.numero || (!trace && (a.favoris != null || a.vues != null))) ? <span className="n-inv-bande">
          {a.numero ? (a.doublon ? <span className="n-inv-plaque"><Plaque numero={a.numero} doublon/></span> : <EtiquetteN numero={a.numero} attrs={{ 'data-inv-n': a.numero }}/>) : null}
          <span className="n-inv-espace"/>
          {!trace && (a.favoris != null || a.vues != null) ? <span className="n-inv-stats">
            {a.favoris != null ? <span className="n-inv-stat" data-ad-stat="favoris" aria-label={tr('egalite.favoris', { n: a.favoris })}>{ic('heart')}<span aria-hidden="true">{a.favoris}</span></span> : null}
            {a.vues != null ? <span className="n-inv-stat" data-ad-stat="vues" aria-label={tr('egalite.vues', { n: a.vues })}>{ic('eye')}<span aria-hidden="true">{a.vues}</span></span> : null}
          </span> : null}
        </span> : null}
        {bandeau ? <span className="n-ad-bandeau" data-ad-bandeau={bandeau}>{tr('tableau.etat.' + bandeau)}</span> : null}
        {plusVue != null && !bandeau ? <span className="n-ad-conseil" data-ad-conseil="plusvue" data-ad-plusvue={String(plusVue)}><span className="n-ad-point" aria-hidden="true"/>{tr('af.pv.etiquette', { n: plusVue })}</span> : null}
        {dort != null && plusVue == null && !bandeau ? <span className="n-ad-conseil" data-ad-conseil="dort"><span className="n-ad-point" aria-hidden="true"/>{tr('egalite.d.conseil.dort', { n: dort })}</span> : null}
        {selection ? <span className="n-ad-coche" data-ad-coche={selection.cochee ? '1' : '0'} aria-hidden="true">{selection.cochee ? <Glyphe nom="check" taille={18}/> : null}</span> : (groupe ? null : <AvatarsComptes comptes={comptes}/>)}
      </span>
      <span className="n-ad-corps">
        <span className="n-ad-titre">{a.titre || tr('egalite.sansTitre')}</span>
        {trace ? <span className="n-ad-trace" data-ad-trace={trace.par}>{texteTrace(trace)}</span> : null}
        <span className="n-ad-ligne">
          {(!groupe || a.sites.length > 1) && a.sites.map((x) => <LogoSite key={x} site={x} taille={16} nom={nomSite(x)}/>)}
          <span className="n-ad-prix" data-ad-prix={a.prix != null ? '1' : '0'}>{a.prix != null ? euros(a.prix) : '—'}</span>
          <span className="n-ad-espace"/>
          {onGestes && !selection ? <BoutonPlus a={a} onGestes={onGestes} className="n-ad-plus"/> : null}
        </span>
      </span>
    </div>
  );
}

// UNE rangée de la LISTE au téléphone (21 nov., 2e passe, « comme la page Articles de Vintex ») : 64–72 px, vignette 52 arrondie,
// titre complet sur 2 lignes (15, graisse normale), une ligne méta grise 13, filets fins, fond plein, « ⋯ » discret (les gestes
// de l'article ; toucher la rangée ouvre sa fiche). Deux formes à comparer : 'a' = le prix à droite, en haut (et « mini »
// dessous) ; 'b' = le prix en gras DANS la méta, le titre a toute la largeur. L'état n'est dit (étiquette douce) que s'il n'est pas
// « en ligne » et pas déjà dit par l'en-tête du compte (« Compte bloqué »).
export function RangeeArticle({ a, forme = 'a', onOuvrir, onGestes = null, selection = null, euros, depuisTexte, nomSite, Icon = null, Photo = null, plusVue = null, attrs = null, groupe = false, rapides = null, revele = null }) {
  // (24 nov., lot visuel-annonces — Julien : « améliore le design et la praticité ») Une rangée plus nette : photo 60 (par identité),
  // l'étiquette papier du N°, le titre sur 2 lignes, le prix à droite ; ♡ et 👁 en petites icônes ; l'état seulement s'il diffère
  // de l'onglet ; le logo du site seulement si la liste n'est PAS rangée par compte (ou paire sur 2 sites). Hauteur FIXE (72).
  // `rapides` : [{ cle, libelle, icone, onClick }] — glisser la rangée vers la gauche les montre (≥ 44 px), sans quitter la liste.
  const b = bandeauDe(a);
  const trace = a.etat === 'bloque' ? traceDe(a) : null;
  const grise = selection && !selection.cochable;
  const ic = (n) => (Icon ? <Icon name={n} size={13}/> : null);
  const prix = <span className="n-ar-prix" data-ad-prix={a.prix != null ? '1' : '0'}>{a.prix != null ? euros(a.prix) : '—'}</span>;
  const bouts = [];
  if (trace) bouts.push(<span className="n-ad-trace" data-ad-trace={trace.par}>{texteTrace(trace)}</span>);
  else {
    if (a.favoris != null) bouts.push(<span className="n-ad-stat" data-ad-stat="favoris" aria-label={tr('egalite.favoris', { n: a.favoris })}>{ic('heart')}<span aria-hidden="true">{a.favoris}</span></span>);
    if (a.vues != null) bouts.push(<span className="n-ad-stat" data-ad-stat="vues" aria-label={tr('egalite.vues', { n: a.vues })}>{ic('eye')}<span aria-hidden="true">{a.vues}</span></span>);
    // (24 nov.) Moins d'un jour en ligne ⇒ « Aujourd'hui », jamais « 0 j » ; âge inconnu ⇒ aucune horloge.
    if (a.depuis != null) bouts.push(<span className="n-ad-stat" data-ad-stat="jours">{ic('clock')}<span>{Date.now() - a.depuis < 864e5 ? tr('inv.age.jour') : depuisTexte(a.depuis)}</span></span>);
  }
  // La taille en dernier : si la ligne manque de place, c'est elle qui s'efface (jamais un mot coupé en deux).
  if (!trace && a.taille && !tailleDansTitre(a.titre, a.taille)) bouts.push(<span>{tr('egalite.taille', { t: a.taille })}</span>);
  // Le glissement : transform seulement, suivi au doigt, puis ouvert (largeur des boutons) ou fermé — jamais à moitié.
  const rap = !selection && Array.isArray(rapides) && rapides.length ? rapides : null;
  const W = rap ? rap.length * 84 : 0;
  const [ouvert, setOuvert] = React.useState(false);
  const corpsRef = React.useRef(null), geste = React.useRef(null), avale = React.useRef(false);
  React.useEffect(() => {
    if (!ouvert) return undefined;
    const fermer = (e) => { if (corpsRef.current && corpsRef.current.parentElement && !corpsRef.current.parentElement.contains(e.target)) setOuvert(false); };
    document.addEventListener('pointerdown', fermer, true); return () => document.removeEventListener('pointerdown', fermer, true);
  }, [ouvert]);
  const pose = (x, anime) => { const el = corpsRef.current; if (!el) return; el.style.transition = anime ? '' : 'none'; el.style.transform = x ? `translateX(${x}px)` : ''; };
  React.useLayoutEffect(() => { pose(ouvert ? -W : 0, true); }, [ouvert, W]);
  const bas = (e) => { if (!rap || e.button > 0) return; geste.current = { x: e.clientX, y: e.clientY, dx: 0, pris: false, id: e.pointerId }; };
  const bouge = (e) => {
    const g = geste.current; if (!g) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (!g.pris) { if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy) * 1.2) { if (Math.abs(dy) > 10) geste.current = null; return; } g.pris = true; try { e.currentTarget.setPointerCapture(g.id); } catch (_) {} }
    g.dx = dx; pose(Math.max(-W - 24, Math.min(0, (ouvert ? -W : 0) + dx)), false);
  };
  const haut = () => { const g = geste.current; geste.current = null; if (!g || !g.pris) return; avale.current = true; const x = (ouvert ? -W : 0) + g.dx; const o = x < -W / 2; setOuvert(o); pose(o ? -W : 0, true); };
  const clic = () => { if (avale.current) { avale.current = false; return; } if (ouvert) { setOuvert(false); return; } if (selection) { if (selection.cochable) selection.onBascule(); return; } onOuvrir(a); };
  return (
    <div {...(revele || {})} className={cx('n-ar', revele && revele.className)} style={revele ? revele.style : undefined} data-ad-forme={forme} data-ad-rangee="" data-ad-etat={a.etat} data-ad-grise={grise ? '1' : undefined}
      data-inv-photo={a.photo || ''} data-ad-ouvert={ouvert ? '1' : undefined} {...(attrs || {})}>
      {rap ? <span className="n-ar-rapides" aria-hidden={ouvert ? undefined : 'true'} style={{ width: W }}>
        {rap.map((x) => <button key={x.cle} type="button" className="n-ar-rapide" data-ad-rapide={x.cle} tabIndex={ouvert ? 0 : -1}
          onClick={(e) => { e.stopPropagation(); setOuvert(false); x.onClick(); }}>{Icon && x.icone ? <Icon name={x.icone} size={20}/> : null}<span>{x.libelle}</span></button>)}
      </span> : null}
      <span className="n-ar-glisse" ref={corpsRef} onPointerDown={bas} onPointerMove={bouge} onPointerUp={haut} onPointerCancel={haut}>
        <button type="button" className="n-ar-corps" onClick={clic} aria-pressed={selection ? (selection.cochee ? 'true' : 'false') : undefined} aria-disabled={grise ? 'true' : undefined}>
          {selection ? <span className="n-ar-coche" data-ad-coche={selection.cochee ? '1' : '0'} aria-hidden="true">{selection.cochee ? <Glyphe nom="check" taille={16}/> : null}</span> : null}
          <span className="n-ar-photo"><PhotoCadre a={a} Photo={Photo} taille={20}/></span>
          <span className="n-ar-texte">
            <span className="n-ar-haut">
              <span className="n-ar-titre">{a.titre || tr('egalite.sansTitre')}</span>
              <span className="n-ar-droite">{prix}</span>
            </span>
            <span className="n-ar-meta">
              {(!groupe || a.sites.length > 1) ? a.sites.map((x) => <LogoSite key={x} site={x} taille={16} nom={nomSite(x)}/>) : null}
              {a.numero ? (a.doublon ? <Plaque numero={a.numero} doublon/> : <EtiquetteN numero={a.numero} className="n-ar-etiq" attrs={{ 'data-inv-n': a.numero }}/>) : null}
              {b && b !== 'bloque' ? <span className="n-ad-etiquette" data-ad-bandeau={b}>{tr('tableau.etat.' + b)}</span> : null}
              {plusVue != null ? <span className="n-ad-etiquette" data-ad-conseil="plusvue" data-ad-plusvue={String(plusVue)}>{tr('af.pv.etiquette', { n: plusVue })}</span> : null}
              <span className="n-ar-stats">{bouts.map((x, i) => <React.Fragment key={i}>{x}</React.Fragment>)}</span>
            </span>
          </span>
        </button>
        {onGestes && !selection ? <BoutonPlus a={a} onGestes={onGestes} className="n-ar-plus"/> : null}
      </span>
    </div>
  );
}

export default CarteAnnonce;
