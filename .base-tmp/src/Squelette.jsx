// ════════════════════════════════════════════════════════════════════════════
//  SQUELETTE — la FORME d'un écran avant ses données (6 nov., « de vrais écrans
//  de chargement, beaucoup plus beaux, moins de bug »).
//
//  Des briques (barre de texte, chiffre, vignette, carte, carte sombre, puces,
//  segmenté, lignes, grille) et, pour chaque écran, sa forme : les mêmes
//  conteneurs, les mêmes marges et à peu près les mêmes hauteurs que l'écran fini
//  (le titre est le VRAI titre, avec les classes du vrai titre). Une pulsation
//  douce, coupée par « réduire les animations ». Aucune couleur nouvelle : l'encre
//  à 8 %, le blanc à 14 % sur la carte sombre.
//  Rien ici ne lit une donnée : un squelette ne dit jamais « 0 », ni « pas su ».
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import './styles-attente.css';
import { Attente } from './natif/Attente.jsx';
import { tr } from './i18n/index.js';

const px = (v) => (typeof v === 'number' ? v + 'px' : v);
export function SqBarre({ l = '60%', h = 12, r = 6, style }) {
  return <span className="vrm-sq-barre" aria-hidden="true" style={{ width: px(l), height: h, borderRadius: r, ...(style || {}) }}/>;
}
export function SqChiffre({ l = 132, h = 34 }) { return <SqBarre l={l} h={h} r={9}/>; }
export function SqVignette({ t = 52, r = 12, style }) { return <span className="vrm-sq-barre vrm-sq-vignette" aria-hidden="true" style={{ width: t, height: t, borderRadius: r, ...(style || {}) }}/>; }

// Une carte blanche (surface de la coque) ou SOMBRE (la carte du mois, Fusion).
export function SqCarte({ sombre = false, h, className = '', style, children }) {
  return <div className={'vrm-sq-carte' + (sombre ? ' is-sombre' : '') + (className ? ' ' + className : '')} style={{ minHeight: h, ...(style || {}) }}>{children}</div>;
}
// La carte sombre du mois : une étiquette, un grand chiffre, sa légende, trois cases.
export function SqCarteMois({ cases = 3, titre = true, h }) {
  return <SqCarte sombre h={h}>
    {titre && <SqBarre l={84} h={11}/>}
    <SqChiffre l="46%" h={38}/>
    <SqBarre l={56} h={11}/>
    {cases > 0 && <div className="vrm-sq-cases" style={{ gridTemplateColumns: `repeat(${cases}, 1fr)` }}>
      {Array.from({ length: cases }, (_, i) => <div key={i} className="vrm-sq-case"><SqBarre l="55%" h={15}/><SqBarre l="70%" h={10}/></div>)}
    </div>}
  </SqCarte>;
}
export function SqSegmente({ n = 2 }) {
  return <div className="vrm-sq-segmente" aria-hidden="true">{Array.from({ length: n }, (_, i) => <span key={i} className={i === 0 ? 'is-choisi' : ''}><SqBarre l={i === 0 ? 54 : 64} h={11}/></span>)}</div>;
}
export function SqPuces({ n = 4 }) {
  return <div className="vrm-sq-puces" aria-hidden="true">{Array.from({ length: n }, (_, i) => <span key={i} className="vrm-sq-puce" style={{ width: i === 0 ? 52 : 92 }}/>)}</div>;
}
// Des lignes dans une carte : vignette (ou pastille ronde), titre, détail, montant.
export function SqLignes({ n = 5, vignette = 'carre', montant = true }) {
  return <SqCarte className="vrm-sq-lignes">
    {Array.from({ length: n }, (_, i) => <div key={i} className="vrm-sq-ligne">
      {vignette && <SqVignette t={vignette === 'rond' ? 40 : 48} r={vignette === 'rond' ? 20 : 10}/>}
      <span className="vrm-sq-ligne-texte"><SqBarre l={['62%', '48%', '70%', '55%', '66%', '44%'][i % 6]} h={13}/><SqBarre l={['38%', '52%', '30%', '45%', '34%', '50%'][i % 6]} h={10}/></span>
      {montant && <SqBarre l={58} h={13}/>}
    </div>)}
  </SqCarte>;
}
// Une grille de fiches (photo, titre, prix) — Annonces.
export function SqGrille({ n = 6 }) {
  return <div className="vrm-sq-grille" aria-hidden="true">{Array.from({ length: n }, (_, i) => <div key={i} className="vrm-sq-fiche">
    <span className="vrm-sq-barre vrm-sq-photo"/>
    <span className="vrm-sq-fiche-texte"><SqBarre l="40%" h={11}/><SqBarre l="80%" h={13}/><SqBarre l="30%" h={13}/></span>
  </div>)}</div>;
}
export function SqTitreSection({ l = 96 }) { return <div className="vrm-sq-titre-section"><SqBarre l={l} h={17}/></div>; }

// La tête d'une TÂCHE (Ventes, Annonces, Achats, Messages, Colis) : le VRAI titre,
// avec les classes du vrai (src/App.jsx `rendreTache`) — il ne bouge pas quand l'écran arrive.
export function SqTeteTache({ titre, date = false }) {
  return <header className="vrm-market-heading vrm-tache-tete vrm-sq-tete">
    {date && <SqBarre l={128} h={11} style={{ display: 'block', marginBottom: 8 }}/>}
    <h1>{titre}</h1>
  </header>;
}

// (20 nov., affichage instantané) LA FORME NATIVE de chaque écran au tout premier lancement (aucune copie sur l'appareil) :
// les VRAIES rangées de VRM natif (src/natif/Attente.jsx : mêmes classes `n-rangee`, mêmes hauteurs 72 / 56 / 44), très
// pâles (≤ 6 %, `--n-squelette`), un reflet doux, coupé par « réduire les animations ». Le grand titre est celui de la coque
// (jamais redessiné ici), et aucun bouton d'action n'est posé au-dessus d'un squelette.
const recherche = <div style={{ padding: '4px 16px 8px' }}><span className="n-os" style={{ height: 36, borderRadius: 10 }}/></div>;
const segmente = <div style={{ padding: '4px 16px 8px' }}><span className="n-os" style={{ height: 32, borderRadius: 9 }}/></div>;
export const FORMES = {
  journee: () => <>
    <Attente forme="affiche"/>
    <Attente forme="faits" n={3} colonnes={3}/>
    <Attente forme="rangees" n={4} vignette={44} titre/>
  </>,
  ventes: () => <>{recherche}{segmente}<Attente forme="rangees" n={8} vignette={56} titre/></>,
  annonces: () => <>{recherche}{segmente}<Attente forme="rangees" n={8} vignette={56} titre/></>,
  achats: () => <>{recherche}<Attente forme="rangees" n={8} vignette={56} titre/></>,
  messages: () => <>{recherche}{segmente}<Attente forme="rangees" n={9} vignette={44} titre/></>,
  cat_bord: () => <><Attente forme="rangees" n={6} vignette={56} titre/></>,
  garage: () => <>{segmente}<Attente forme="rangees" n={6} vignette={56} titre/></>,
  compta: () => <>
    <Attente forme="affiche"/>
    <Attente forme="faits" n={3} colonnes={3}/>
    <Attente forme="rangees" n={5} titre/>
  </>,
};

// Un écran sans forme à lui : des rangées.
const FORME_GENERIQUE = () => <Attente forme="rangees" n={7} titre/>;

export function Squelette({ ecran, ordi = false, ...rest }) {
  const F = FORMES[ecran] || FORME_GENERIQUE;
  return <div className="vrm-squelette n-page-contenu" data-squelette={ecran} role="status" aria-busy="true" aria-label={tr('natif.attente')} {...rest}>{F({ ordi })}</div>;
}
export default Squelette;
