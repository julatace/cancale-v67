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

// UNE carte de la grille (21 nov., 2e passe — Julien : « je n'aime pas du tout l'affichage sur iPhone ») : sobre. Photo CARRÉE,
// au plus un bandeau d'état et l'étiquette « Dort », puis le titre (2 lignes) et UNE ligne : logo · prix · N° · « ⋯ » discret.
// `selection` : { cochee, cochable, onBascule } (mode « Actions ») ; `onGestes` : le « ⋯ » (absent ⇒ pas de « ⋯ »).
export function CarteAnnonce({ a, onOuvrir, onGestes = null, selection = null, euros, nomSite, dort = null, Photo = null, attrs = null }) {
  const bandeau = bandeauDe(a);
  const trace = a.etat === 'bloque' ? traceDe(a) : null;
  const grise = selection && !selection.cochable;
  const clic = () => { if (selection) { if (selection.cochable) selection.onBascule(); return; } onOuvrir(a); };
  return (
    <div className="n-ad-carte" role="button" tabIndex={0} aria-pressed={selection ? (selection.cochee ? 'true' : 'false') : undefined}
      aria-disabled={grise ? 'true' : undefined} data-ad-carte="" data-ad-etat={a.etat} data-ad-grise={grise ? '1' : undefined}
      onClick={clic} onKeyDown={(e) => { if (e.target !== e.currentTarget) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clic(); } }} {...(attrs || {})}>
      <span className="n-ad-photo">
        <PhotoCadre a={a} Photo={Photo}/>
        {bandeau ? <span className="n-ad-bandeau" data-ad-bandeau={bandeau}>{tr('tableau.etat.' + bandeau)}</span> : null}
        {dort != null && !bandeau ? <span className="n-ad-conseil" data-ad-conseil="dort"><span className="n-ad-point" aria-hidden="true"/>{tr('egalite.d.conseil.dort', { n: dort })}</span> : null}
        {selection ? <span className="n-ad-coche" data-ad-coche={selection.cochee ? '1' : '0'} aria-hidden="true">{selection.cochee ? <Glyphe nom="check" taille={18}/> : null}</span> : null}
      </span>
      <span className="n-ad-corps">
        <span className="n-ad-titre">{a.titre || tr('egalite.sansTitre')}</span>
        <span className="n-ad-ligne">
          {a.sites.map((x) => <LogoSite key={x} site={x} taille={16} nom={nomSite(x)}/>)}
          <span className="n-ad-prix" data-ad-prix={a.prix != null ? '1' : '0'}>{a.prix != null ? euros(a.prix) : '—'}</span>
          {a.numero ? <Plaque numero={a.numero} doublon={a.doublon}/> : null}
          <span className="n-ad-espace"/>
          {onGestes && !selection ? <BoutonPlus a={a} onGestes={onGestes} className="n-ad-plus"/> : null}
        </span>
        {trace ? <span className="n-ad-trace" data-ad-trace={trace.par}>{texteTrace(trace)}</span> : null}
      </span>
    </div>
  );
}

// UNE rangée de la LISTE au téléphone (21 nov., 2e passe, « comme la page Articles de Vintex ») : 64–72 px, vignette 52 arrondie,
// titre complet sur 2 lignes (15, graisse normale), une ligne méta grise 13, filets fins, fond plein, « ⋯ » discret (les gestes
// de l'article ; toucher la rangée ouvre sa fiche). Deux formes à comparer : 'a' = le prix à droite, en haut (et « mini »
// dessous) ; 'b' = le prix en gras DANS la méta, le titre a toute la largeur. L'état n'est dit (étiquette douce) que s'il n'est pas
// « en ligne » et pas déjà dit par l'en-tête du compte (« Compte bloqué »).
export function RangeeArticle({ a, forme = 'a', onOuvrir, onGestes = null, selection = null, euros, depuisTexte, nomSite, Icon = null, Photo = null, attrs = null }) {
  const b = bandeauDe(a);
  const trace = a.etat === 'bloque' ? traceDe(a) : null;
  const grise = selection && !selection.cochable;
  const clic = () => { if (selection) { if (selection.cochable) selection.onBascule(); return; } onOuvrir(a); };
  const ic = (n) => (Icon ? <Icon name={n} size={13}/> : null);
  const prix = <span className="n-ar-prix" data-ad-prix={a.prix != null ? '1' : '0'}>{a.prix != null ? euros(a.prix) : '—'}</span>;
  const bouts = [];
  if (forme === 'b') bouts.push(prix);
  if (a.taille && !tailleDansTitre(a.titre, a.taille)) bouts.push(<span>{tr('egalite.taille', { t: a.taille })}</span>);
  if (trace) bouts.push(<span className="n-ad-trace" data-ad-trace={trace.par}>{texteTrace(trace)}</span>);
  else {
    if (a.depuis != null) bouts.push(<span className="n-ad-stat" data-ad-stat="jours">{depuisTexte(a.depuis)}</span>);
    if (a.favoris != null) bouts.push(<span className="n-ad-stat" data-ad-stat="favoris" aria-label={tr('egalite.favoris', { n: a.favoris })}>{ic('heart')}<span aria-hidden="true">{a.favoris}</span></span>);
    if (a.vues != null) bouts.push(<span className="n-ad-stat" data-ad-stat="vues" aria-label={tr('egalite.vues', { n: a.vues })}>{ic('eye')}<span aria-hidden="true">{a.vues}</span></span>);
  }
  if (forme === 'b' && a.prixMini != null) bouts.push(<span>{tr('egalite.mini', { p: euros(a.prixMini) })}</span>);
  return (
    <div className="n-ar" data-ad-forme={forme} data-ad-rangee="" data-ad-etat={a.etat} data-ad-grise={grise ? '1' : undefined} {...(attrs || {})}>
      <button type="button" className="n-ar-corps" onClick={clic} aria-pressed={selection ? (selection.cochee ? 'true' : 'false') : undefined} aria-disabled={grise ? 'true' : undefined}>
        {selection ? <span className="n-ar-coche" data-ad-coche={selection.cochee ? '1' : '0'} aria-hidden="true">{selection.cochee ? <Glyphe nom="check" taille={16}/> : null}</span> : null}
        <span className="n-ar-photo"><PhotoCadre a={a} Photo={Photo} taille={20}/></span>
        <span className="n-ar-texte">
          <span className="n-ar-haut">
            <span className="n-ar-titre">{a.titre || tr('egalite.sansTitre')}</span>
            {forme === 'a' ? <span className="n-ar-droite">{prix}{a.prixMini != null ? <span className="n-ar-mini">{tr('egalite.mini', { p: euros(a.prixMini) })}</span> : null}</span>
              // B : la méta est pleine (prix, jours, favoris, vues) ; l'état va en haut à droite, jamais coupé.
              : (b && b !== 'bloque' ? <span className="n-ar-droite"><span className="n-ad-etiquette" data-ad-bandeau={b}>{tr('tableau.etat.' + b)}</span></span> : null)}
          </span>
          <span className="n-ar-meta">
            {a.sites.map((x) => <LogoSite key={x} site={x} taille={16} nom={nomSite(x)}/>)}
            {a.numero ? <Plaque numero={a.numero} doublon={a.doublon}/> : null}
            {bouts.map((x, i) => <React.Fragment key={i}>{i || a.numero ? <span className="n-ar-sep" aria-hidden="true">·</span> : null}{x}</React.Fragment>)}
            {forme === 'a' && b && b !== 'bloque' ? <span className="n-ad-etiquette" data-ad-bandeau={b}>{tr('tableau.etat.' + b)}</span> : null}
          </span>
        </span>
      </button>
      {onGestes && !selection ? <BoutonPlus a={a} onGestes={onGestes} className="n-ar-plus"/> : null}
    </div>
  );
}

export default CarteAnnonce;
