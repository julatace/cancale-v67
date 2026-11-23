// ── src/natif/Affiche.jsx — LE grand chiffre d'un écran (48/52) ──────────────────────────
// Props :
//   valeur    le chiffre, DÉJÀ formaté par l'écran (« 1 284 », « 86,50 ») ; null / undefined ⇒ « — »
//   unite     « € », « ventes »… (22/28, à côté du chiffre)
//   libelle   ce que le chiffre compte, en une ligne (« vendus aujourd'hui · 4 ventes »)
//   ecart     l'écart NOMMÉ, en une ligne (« 42 € de plus qu'hier ») — jamais un « +12 % » nu
//   tonEcart  'neutre' (défaut) | 'ambre' (quelque chose à rattraper)
//   children  ce qui suit dans la même carte (7 barres, une ligne de couverture « sur 12 ventes »)
// Un chiffre partiel dit sa couverture dans `libelle` (« au moins », « sur N ») : CLAUDE.md §5.
// Exemple :
//   <Affiche valeur="186" unite="€" libelle="vendus aujourd'hui · 4 ventes" ecart="42 € de plus qu'hier"/>
import React from 'react';
import { cx, TIRET } from './outils.js';

export function Affiche({ valeur, unite = '', libelle = '', ecart = '', tonEcart = 'neutre', className = '', children }) {
  const su = !(valeur == null || valeur === '');
  return (
    <div className={cx('n-affiche', className)}>
      <p className="n-affiche-ligne">
        <span className="n-affiche-valeur" data-n-affiche-valeur="">{su ? valeur : TIRET}</span>
        {su && unite ? <span className="n-affiche-unite">{unite}</span> : null}
      </p>
      {libelle ? <p className="n-affiche-libelle">{libelle}</p> : null}
      {ecart ? <p className="n-affiche-ecart" data-n-ton={tonEcart}>{ecart}</p> : null}
      {children}
    </div>
  );
}

export default Affiche;
