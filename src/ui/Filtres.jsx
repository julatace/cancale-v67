// ── src/ui/Filtres.jsx — les filtres d'une liste : de PETITES capsules ─────────
// Julien (AJOUT 3) : « tout est capsule grise en 52 px ». Une capsule DESSINÉE de 34 px
// (texte 15/600) dans une zone touchée de 44 ; la choisie à l'encre pleine, les autres
// blanches à filet fin ; la rangée défile (jamais coupée). Le compte d'un filtre s'écrit
// à côté de son nom (`n`), en gris. Un filtre = une vue de l'écran : `valeur`/`onChange`
// sont les siens.
//   <Filtres label="Vues" valeur={vue} onChange={setVue} options={[{ v:'toutes', l:'Toutes' }, { v:'sansnum', l:'Sans N°', n:3 }]}/>
import React from 'react';
import './ui.css';

export function Filtres({ options = [], valeur, onChange, label, className = '', ...attrs }) {
  return (
    <div className={'vrm-ui-filtres' + (className ? ' ' + className : '')} role="group" aria-label={label} {...attrs}>
      {(options || []).filter(Boolean).map((o) => (
        <button key={o.v} type="button" className="vrm-ui-filtre" aria-pressed={o.v === valeur} data-ui-filtre={o.v} onClick={() => onChange && onChange(o.v)} {...(o.attrs || {})}>
          <span>{o.l}</span>{o.n != null && o.n !== '' ? <span className="vrm-ui-filtre-n">{o.n}</span> : null}
        </button>
      ))}
    </div>
  );
}
export default Filtres;
