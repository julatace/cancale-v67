// (14 nov., Studio bleu clair) Le champ est CREUSÉ (`sb-champ`), chaque icône un ROND posé (`sb-rond`, 44).
// ── src/ui/BarreOutils.jsx — UNE barre d'outils : un vrai champ de recherche + 1–2 icônes ──
// Julien (AJOUT 3) : plus de rangée de quatre ronds gris. Le champ (36 px dessinés, 17 px :
// l'iPhone ne zoome pas) prend la place ; les icônes sont des boutons TEXTE (bleu des
// actions, sans fond), 44 px au doigt, 36 à la souris. Le N° tapé doit trouver la paire :
// c'est l'écran qui filtre (`onChange`), la barre ne cherche rien.
//   <BarreOutils valeur={q} onChange={setQ} placeholder={tr('…')} label={tr('…')}>
//     <BoutonIcone label="Trier" onClick={…}><Icon name="filter"/></BoutonIcone>
//   </BarreOutils>
import React from 'react';
import { tr } from '../i18n/index.js';
import { BoutonIcone as BoutonIconeNatif } from '../natif/Bouton.jsx';
import './ui.css';

const Loupe = () => <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.6"/><path d="m11 11 3.2 3.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>;

// (20 nov., chantier « boutons natifs ») L'icône de la barre est le BoutonIcone natif (44 au doigt, 32 compact à la souris,
// nommé, appui et focus natifs) ; `presse` ⇒ aria-pressed (enfoncé, teinté).
export function BoutonIcone({ label, children, presse, className = '', onClick, disabled, ...attrs }) {
  return <BoutonIconeNatif libelle={label} icone={children} onClick={onClick} actif={!!presse} indisponible={!!disabled} raison={attrs.title && attrs.title !== label ? attrs.title : ''}
    className={'vrm-ui-icone' + (className ? ' ' + className : '')} attrs={{ ...attrs, 'aria-pressed': presse == null ? undefined : (presse ? 'true' : 'false') }}/>;
}

export function BarreOutils({ valeur = '', onChange, placeholder, label, children, className = '', champAttrs = null, ...attrs }) {
  return (
    <div className={'vrm-ui-outils' + (className ? ' ' + className : '')} role="search" {...attrs}>
      <label className="vrm-ui-outils-champ sb-champ">
        <Loupe/>
        <input type="search" name="recherche" autoComplete="off" spellCheck={false} inputMode="search" enterKeyHint="search" value={valeur} placeholder={placeholder || tr('listes.rechercher') + '…'} aria-label={label || placeholder || tr('listes.rechercher')}
          onChange={(e) => onChange && onChange(e.target.value)} {...(champAttrs || {})}/>
      </label>
      {children}
    </div>
  );
}
export default BarreOutils;
