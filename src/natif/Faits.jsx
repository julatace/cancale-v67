// ── src/natif/Faits.jsx — la grille des faits d'une fiche (libellé 13 gris, valeur 17/600) ─
// <Faits colonnes={2|3|4}> contient des <Fait>. Chaque fait :
//   libelle     « Prix », « Acheté », « Place »…
//   valeur      DÉJÀ formatée par l'écran (« 45 € », « 42 », « A3 ») ; null / undefined / '' ⇒ « — »
//   onModifier  la valeur se TOUCHE et ouvre sa saisie (une feuille). Un « — » avec `onModifier`
//               est en accent : le chiffre absent est la porte pour le remplir (CLAUDE.md §5).
//   ton         'neutre' (défaut) | 'ambre' (un geste à faire sur CE fait)
//   detail      (rare) une légende sous la valeur (« sur 12 ventes »)
// Colonnes : 2 au téléphone ; 3 ou 4 seulement là où ça tient (la grille retombe à 2 sous 430 px).
// Exemple :
//   <Faits colonnes={2}>
//     <Fait libelle="Prix" valeur="45 €" onModifier={ouvrirPrix}/>
//     <Fait libelle="Acheté" valeur={null} onModifier={ouvrirAchat}/>
//   </Faits>
import React from 'react';
import { tr } from '../i18n/index.js';
import { cx, estVide, TIRET } from './outils.js';

export function Faits({ colonnes = 2, className = '', children }) {
  return <div className={cx('n-faits', className)} data-n-colonnes={Math.min(4, Math.max(2, colonnes | 0))} role="list">{children}</div>;
}

export function Fait({ libelle, valeur, onModifier = null, ton = 'neutre', detail = '', className = '', attrs = null }) {
  const vide = estVide(valeur);
  const contenu = (
    <>
      <span className="n-fait-libelle">{libelle}</span>
      <span className="n-fait-valeur" data-n-vide={vide ? '1' : undefined}>{vide ? TIRET : valeur}</span>
      {detail ? <span className="n-fait-detail">{detail}</span> : null}
    </>
  );
  if (onModifier) {
    return (
      <div role="listitem" className="n-fait-case">
        <button
          type="button"
          className={cx('n-fait', 'n-fait-touche', className)}
          data-n-ton={ton}
          onClick={onModifier}
          aria-label={vide ? tr('natif.fait.remplir', { libelle }) : tr('natif.fait.modifier', { libelle, valeur: String(valeur) })}
          {...(attrs || {})}
        >{contenu}</button>
      </div>
    );
  }
  return <div role="listitem" className={cx('n-fait-case', 'n-fait', className)} data-n-ton={ton} {...(attrs || {})}>{contenu}</div>;
}

export default Faits;
