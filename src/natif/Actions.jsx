// ── src/natif/Actions.jsx — LES BOUTONS D'ACTION COMMUNS (23 nov., Julien : « trop de texte, pas assez de beaux boutons ») ──
// La règle (CLAUDE.md §7, NATIF.md §3 bis) : une action est un VRAI bouton — une icône + un verbe court (« Imprimer »,
// « Relier », « Suivre ») — jamais un lien texte ni une phrase d'instruction. Plusieurs actions : en rangée (2 ou 3), en grille
// au-delà (2 colonnes au téléphone). Le détail qui explique va sous « Pourquoi ? » (`Pourquoi`), replié, au toucher.
// Tous les écrans réutilisent CES composants (les autres chantiers aussi) ; ils s'appuient sur `Bouton` (le geste unique, la
// roue, la phrase de résultat) : aucune autre forme de bouton.
//   <Actions elements={[{ cle: 'imprimer', icone: <Icon name="printer" size={18}/>, libelle: 'Imprimer', onClick, plein: true },
//                       { cle: 'relier', icone: <Icon name="link" size={18}/>, libelle: 'Relier', onClick }]}/>
//   <Pourquoi>La phrase longue, lue seulement par qui la demande.</Pourquoi>
// Props d'`Actions` : elements (null ignorés ; `plein` = LE geste, un seul ; `indisponible` + `raison`), attrs.
import React from 'react';
import { Bouton } from './Bouton.jsx';
import { tr } from '../i18n/index.js';
import { cx } from './outils.js';
import './actions.css';

export function Actions({ elements = [], className = '', attrs = null }) {
  const L = (elements || []).filter(Boolean);
  if (!L.length) return null;
  return (
    <div className={cx('n-actions', className)} data-n-actions={L.length} {...(attrs || {})}>
      {L.map((e) => (
        <Bouton key={e.cle} variante={e.plein ? 'plein' : 'teinte'} icone={e.icone} onClick={e.onClick} indisponible={!!e.indisponible} raison={e.raison || ''}
          ajuste taille="normal" className="n-action" attrs={{ 'data-n-action': e.cle, ...(e.attrs || {}) }}>{e.libelle}</Bouton>
      ))}
    </div>
  );
}

// « Pourquoi ? » replié : le texte qui explique n'est pas à l'écran tant qu'on ne le demande pas.
export function Pourquoi({ children, libelle = '', attrs = null }) {
  if (!children) return null;
  return (
    <details className="n-pourquoi" data-n-pourquoi="" {...(attrs || {})}>
      <summary>{libelle || tr('natif.pourquoi')}</summary>
      <div className="n-pourquoi-texte">{children}</div>
    </details>
  );
}
export default Actions;
