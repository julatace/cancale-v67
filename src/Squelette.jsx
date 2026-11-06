// ════════════════════════════════════════════════════════════════════════════
//  SQUELETTE — la FORME d'un écran avant ses données (6 nov., « de vrais écrans
//  de chargement, beaucoup plus beaux, moins de bug »).
//
//  Des briques (barre de texte, chiffre, vignette, carte, carte sombre, puces,
//  segmenté, lignes, grille) et, pour chaque écran, sa forme : les mêmes
//  conteneurs, les mêmes marges et à peu près les mêmes hauteurs que l'écran fini
//  (le titre est le VRAI titre, avec les classes du vrai titre). Une pulsation
//  douce, coupée par « réduire les animations ». Aucune couleur nouvelle : l'encre
//  à 7 %, le blanc à 14 % sur la carte sombre.
//  Rien ici ne lit une donnée : un squelette ne dit jamais « 0 », ni « pas su ».
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import './styles-attente.css';

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

const pad = { padding: '12px 16px 0' };
// La forme de chaque écran. `ordi` : la colonne de l'ordinateur (plus large, les
// filtres de site vont dans la barre du haut).
export const FORMES = {
  journee: ({ ordi }) => <>
    <div style={ordi ? { padding: '0 0 0' } : null}>
      <SqCarte sombre className="vrm-sq-heros">
        <SqBarre l={110} h={12}/>
        <SqBarre l={ordi ? 260 : 190} h={30}/>
        <div className="vrm-sq-semaine">{Array.from({ length: 7 }, (_, i) => <span key={i} className="vrm-sq-jour"/>)}</div>
        <SqBarre l={72} h={11}/>
        <SqChiffre l={ordi ? 220 : 170} h={40}/>
        <SqBarre l={44} h={11}/>
        <div className="vrm-sq-cases" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>{[0, 1, 2].map((i) => <div key={i} className="vrm-sq-case"><SqBarre l="50%" h={15}/><SqBarre l="75%" h={10}/></div>)}</div>
      </SqCarte>
    </div>
    <div style={pad}><SqCarte h={160}><SqBarre l={150} h={14}/><div className="vrm-sq-deux">{[0, 1, 2, 3].map((i) => <span key={i}><SqBarre l={56} h={11}/><SqBarre l={64} h={20}/></span>)}</div></SqCarte></div>
    <div style={pad}><SqTitreSection l={84}/><SqLignes n={3} montant={false}/></div>
  </>,
  ventes: ({ ordi }) => <>
    <SqTeteTache titre="Ventes" date/>
    <div style={{ padding: '0 16px' }}>{!ordi && <SqSegmente n={3}/>}</div>
    <div style={pad}><SqCarteMois/></div>
    <div style={pad}><SqLignes n={6} vignette={false}/></div>
  </>,
  annonces: ({ ordi }) => <>
    <SqTeteTache titre="Annonces"/>
    <div style={{ padding: '0 16px' }}>{!ordi && <SqSegmente n={2}/>}<SqPuces n={4}/></div>
    <div style={pad}><SqCarteMois/></div>
    <div style={pad}><div className="vrm-sq-recherche"/></div>
    <div style={pad}><SqGrille n={ordi ? 8 : 4}/></div>
  </>,
  achats: ({ ordi }) => <>
    <SqTeteTache titre="Achats"/>
    <div style={{ padding: '0 16px' }}>{!ordi && <SqSegmente n={2}/>}<SqPuces n={4}/></div>
    <div style={pad}><SqCarteMois/></div>
    <div style={pad}><SqSegmente n={3}/></div>
    <div style={pad}><SqLignes n={5}/></div>
  </>,
  messages: ({ ordi }) => <>
    <SqTeteTache titre="Messages"/>
    <div style={{ padding: '0 16px' }}>{!ordi && <SqSegmente n={2}/>}<SqPuces n={4}/></div>
    <div style={pad}><SqSegmente n={2}/><div className="vrm-sq-recherche"/></div>
    <div style={pad}><SqLignes n={6} vignette="rond" montant={false}/></div>
  </>,
  cat_bord: () => <>
    <SqTeteTache titre="Colis" date/>
    <div style={{ padding: '0 16px' }}><SqPuces n={2}/></div>
    <div style={pad}><SqCarteMois/></div>
    <div style={pad}><SqSegmente n={3}/></div>
    <div style={pad}><SqLignes n={4}/></div>
  </>,
  garage: () => <>
    <SqTeteTache titre="Stock"/>
    <div style={{ padding: '0 16px' }}><SqSegmente n={4}/></div>
    <div style={pad}><SqCarte h={220}><SqBarre l="40%" h={13}/><SqBarre l="65%" h={11}/><SqBarre l="55%" h={11}/></SqCarte></div>
  </>,
  compta: () => <>
    <SqTeteTache titre="Compta" date/>
    <div style={pad}><SqCarte h={52}><SqBarre l="45%" h={12}/></SqCarte></div>
    <div style={pad}><SqCarteMois cases={0}/></div>
    <div style={pad}><SqCarte h={150}><SqChiffre l={60} h={22}/><SqBarre l={70} h={11}/><SqBarre l={150} h={36} r={12}/></SqCarte></div>
  </>,
};

// Un écran sans forme à lui : une tête et des lignes.
const FORME_GENERIQUE = () => <>
  <div style={pad}><SqBarre l={150} h={26}/></div>
  <div style={pad}><SqLignes n={5}/></div>
</>;

export function Squelette({ ecran, ordi = false, ...rest }) {
  const F = FORMES[ecran] || FORME_GENERIQUE;
  return <div className="vrm-squelette" data-squelette={ecran} role="status" aria-busy="true" aria-label="Chargement de l’écran" {...rest}>{F({ ordi })}</div>;
}
export default Squelette;
