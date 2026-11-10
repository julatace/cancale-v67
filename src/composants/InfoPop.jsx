// ═══════════════════════════════════════════════════════════════════════════
// UNE LIGNE COURTE + SA POP-UP (9 nov., soir — lot AI, branche claude/popups-propre)
// ═══════════════════════════════════════════════════════════════════════════
// Julien, mot pour mot : « Je veux que tous les textes comme ça soient remplacés
// par des pop-ups car actuellement ça fait très moche » ; « tu peux proposer des
// pop-ups pour faire des propositions ».
//
// LA FORME UNIQUE :
//   · à l'écran, UNE ligne courte qui garde le SIGNAL (le chiffre, l'état, l'âge :
//     « 3 retirées de Vinted · lu à 14 h 50 ») — ambre si un geste est à faire,
//     jamais rouge (§7) ; la ligne entière se touche, une pastille ⓘ le montre ;
//   · l'explication (la règle, le manque nommé, « au moins », « pas su », le geste)
//     passe dans une POP-UP : la feuille unique (`SheetShell` : portail,
//     `FermeAuRetour`, Échap, croix 44 px, focus gardé dans la feuille).
//   · `PuceProposition` : une PROPOSITION (« même paire que N°11 ? ») devient une
//     puce compacte (« 1 proposition ») ; la pop-up porte les mêmes boutons et la
//     même règle (SON clic relie, rien d'autre).
//
// RIEN N'EST PERDU : le texte d'avant est rendu tel quel DANS la pop-up (mêmes
// `data-*` dedans) ; la ligne courte porte les `data-*` de l'ancien bloc (bancs).
// Banc : scripts/bancs/popups-propre.cjs.
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { SheetShell as SheetShellBase } from './SheetShell.jsx';
import './info-pop.css';

function IconeInfo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <circle cx="9" cy="9" r="7.6" fill="none" stroke="currentColor" strokeWidth="1.4"/>
      <circle cx="9" cy="5.6" r="1" fill="currentColor"/>
      <path d="M9 8.2v4.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  );
}

// `resume` : la ligne courte (texte ou nœuds) ; `titre` : le titre de la pop-up ;
// `ton` : 'neutre' (gris) · 'ambre' (un geste à faire) ; `children` : le texte
// d'avant, déplacé ; `attrs` : les data-* de l'ancien bloc, posés sur la ligne ;
// `Feuille` : la feuille de l'app (relais qui fournit `FermeAuRetour`).
// `ouvert`/`setOuvert` : facultatifs (pop-up pilotée par l'écran).
export function InfoPop({ resume, puces, phrase, titre, sousTitre, ton = 'neutre', children, attrs, Feuille = SheetShellBase, className = '', style, nom = 'info', ouvert: ouvertProp, setOuvert: setOuvertProp, maxWidth = 520 }) {
  const [ouvertIci, setOuvertIci] = React.useState(false);
  const ouvert = ouvertProp != null ? ouvertProp : ouvertIci;
  const setOuvert = setOuvertProp || setOuvertIci;
  const fermer = React.useCallback(() => setOuvert(false), [setOuvert]);
  const ouvrir = (e) => { e.stopPropagation(); setOuvert(true); };
  // (10 nov., Julien : « je n'aime pas du tout les pop-up, ça n'a rien changé ») À l'écran : des PASTILLES
  // d'une ligne, sans phrase (`puces` : [{ texte, ton }]) — ou la ligne courte (`resume`). La feuille ne montre
  // d'abord que `phrase` (le fait + le geste, 12 mots au plus) ; le détail d'avant est replié sous « Pourquoi ? »
  // (rien n'est perdu, rien n'est imposé).
  const liste = Array.isArray(puces) ? puces.filter((x) => x && x.texte) : null;
  return (
    <div className={`vrm-pop-ligne${ton === 'ambre' ? ' is-ambre' : ''}${liste ? ' a-puces' : ''}${className ? ' ' + className : ''}`} data-popup-ligne={nom} style={style} {...(attrs || {})}>
      {liste ? (
        <div className="vrm-pop-chips" role="group" aria-label={titre || ''}>
          {liste.map((x, i) => (
            <button key={i} type="button" className={`vrm-pop-chip${x.ton === 'ambre' ? ' is-ambre' : ''}`} data-popup-ouvrir={i === 0 ? nom : undefined} data-popup-chip={nom}
              aria-haspopup="dialog" aria-expanded={ouvert} title={phrase || undefined} onClick={ouvrir}>{x.texte}</button>
          ))}
        </div>
      ) : (
        <button type="button" className="vrm-pop-declencheur" data-popup-ouvrir={nom} aria-haspopup="dialog" aria-expanded={ouvert} onClick={ouvrir}>
          <span className="vrm-pop-resume">{resume}</span>
          <span className="vrm-pop-i" aria-hidden="true"><IconeInfo/></span>
          <span className="vrm-pop-sr">{' '}— en savoir plus</span>
        </button>
      )}
      {ouvert && (
        <Feuille onClose={fermer} titre={titre} sousTitre={sousTitre} z={10400} maxWidth={maxWidth} data-popup-corps={nom}>
          <div className="vrm-pop-corps">
            {phrase ? <p className="vrm-pop-phrase" data-popup-phrase="">{phrase}</p> : null}
            {phrase ? <details className="vrm-pop-pourquoi" data-popup-pourquoi=""><summary>Pourquoi ?</summary><div className="vrm-pop-detail">{children}</div></details> : children}
          </div>
        </Feuille>
      )}
    </div>
  );
}

// Une proposition à trancher : la puce, puis la pop-up avec les mêmes boutons.
export function PuceProposition({ n, libelle, titre, sousTitre, children, attrs, Feuille = SheetShellBase, nom = 'proposition', ouvert: ouvertProp, setOuvert: setOuvertProp }) {
  const [ouvertIci, setOuvertIci] = React.useState(false);
  const ouvert = ouvertProp != null ? ouvertProp : ouvertIci;
  const setOuvert = setOuvertProp || setOuvertIci;
  const fermer = React.useCallback(() => setOuvert(false), [setOuvert]);
  return (
    <div className="vrm-pop-puce-hote" data-popup-ligne={nom} {...(attrs || {})}>
      <button type="button" className="vrm-pop-puce" data-popup-ouvrir={nom} aria-haspopup="dialog" aria-expanded={ouvert}
        onClick={(e) => { e.stopPropagation(); setOuvert(true); }}>
        <span className="vrm-pop-puce-n">{n}</span>
        <span className="vrm-pop-puce-txt">{libelle || (n > 1 ? 'propositions' : 'proposition')}</span>
        <svg className="vrm-pop-puce-chev" width="7" height="12" viewBox="0 0 8 14" aria-hidden="true" focusable="false"><path d="M1.2 1.2 6.8 7l-5.6 5.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
      {ouvert && (
        <Feuille onClose={fermer} titre={titre} sousTitre={sousTitre} z={10400} maxWidth={520} data-popup-corps={nom}>
          <div className="vrm-pop-corps">{children}</div>
        </Feuille>
      )}
    </div>
  );
}

export default InfoPop;
