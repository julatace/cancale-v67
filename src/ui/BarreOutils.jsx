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
import './ui.css';

const Loupe = () => <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.6"/><path d="m11 11 3.2 3.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>;

export function BoutonIcone({ label, children, presse, className = '', ...attrs }) {
  return <button type="button" className={'vrm-ui-icone' + (className ? ' ' + className : '')} aria-label={label} title={label} aria-pressed={presse == null ? undefined : !!presse} {...attrs}>{children}</button>;
}

export function BarreOutils({ valeur = '', onChange, placeholder, label, children, className = '', champAttrs = null, ...attrs }) {
  return (
    <div className={'vrm-ui-outils' + (className ? ' ' + className : '')} role="search" {...attrs}>
      <label className="vrm-ui-outils-champ">
        <Loupe/>
        <input type="search" name="recherche" autoComplete="off" spellCheck={false} inputMode="search" enterKeyHint="search" value={valeur} placeholder={placeholder || tr('listes.rechercher') + '…'} aria-label={label || placeholder || tr('listes.rechercher')}
          onChange={(e) => onChange && onChange(e.target.value)} {...(champAttrs || {})}/>
      </label>
      {children}
    </div>
  );
}
export default BarreOutils;
