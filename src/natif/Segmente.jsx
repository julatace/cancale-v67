// ── src/natif/Segmente.jsx — le contrôle segmenté (2 à 5 choix, UN choisi) ───────────────
// Props :
//   options   [{ cle, libelle, n, attrs }]   `n` : un compte discret à côté du libellé (« À envoyer 3 ») — pas une pastille ;
//             `attrs` (19 nov., ajout) : des data-* posés sur le choix (les bancs d'un écran le désignent par eux)
//   valeur    la `cle` choisie
//   onChange  (cle) => …
//   libelle   le nom du groupe pour le lecteur d'écran (« Filtrer les ventes »)
// Clavier : ← → changent le choix (Début / Fin vont aux extrémités) ; Tab entre et sort du groupe.
// Le curseur glisse (transform seulement) ; mouvement réduit ⇒ il se pose.
// Exemple :
//   <Segmente libelle="Filtrer les ventes" valeur={filtre} onChange={setFiltre}
//             options={[{ cle: 'envoyer', libelle: 'À envoyer', n: 3 }, { cle: 'route', libelle: 'En route' }, { cle: 'finies', libelle: 'Finies' }]}/>
import React from 'react';
import { cx } from './outils.js';

export function Segmente({ options = [], valeur, onChange, libelle = '', className = '' }) {
  const ref = React.useRef(null);
  const i = Math.max(0, options.findIndex((o) => o.cle === valeur));
  const choisir = (k) => { const o = options[k]; if (o && o.cle !== valeur && onChange) onChange(o.cle); };
  const clavier = (e) => {
    let k = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') k = (i + 1) % options.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') k = (i - 1 + options.length) % options.length;
    else if (e.key === 'Home') k = 0;
    else if (e.key === 'End') k = options.length - 1;
    if (k < 0) return;
    e.preventDefault();
    choisir(k);
    const b = ref.current && ref.current.querySelectorAll('[role="radio"]')[k];
    if (b) b.focus();
  };
  return (
    <div
      ref={ref}
      className={cx('n-segmente', className)}
      role="radiogroup"
      aria-label={libelle || undefined}
      onKeyDown={clavier}
      style={{ '--n-seg-n': options.length || 1, '--n-seg-i': i }}
    >
      <span className="n-segmente-curseur" aria-hidden="true"/>
      {options.map((o, k) => (
        <button
          key={o.cle}
          type="button"
          role="radio"
          className="n-segmente-choix"
          aria-checked={k === i ? 'true' : 'false'}
          tabIndex={k === i ? 0 : -1}
          onClick={() => choisir(k)}
          {...(o.attrs || {})}
        >
          <span className="n-segmente-libelle">{o.libelle}</span>
          {o.n ? <span className="n-segmente-n">{o.n}</span> : null}
        </button>
      ))}
    </div>
  );
}

export default Segmente;
