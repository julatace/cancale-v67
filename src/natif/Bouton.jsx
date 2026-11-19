// ── src/natif/Bouton.jsx — LE bouton du design natif (contrat NATIF.md §3) ───────────────
// Quatre variantes, aucune autre :
//   plein      LE geste de l'écran (UN par écran) : 50 de haut, toute la largeur, rayon 14.
//   teinte     un geste secondaire : fond --n-teinte, texte --n-sur-teinte.
//   texte      un geste discret : texte --n-accent, sans fond.
//   destructif un geste qu'on ne rattrape pas : il DEMANDE avant (un 2e toucher, 4 s pour le faire).
//              Jamais rouge : le rouge est réservé à deux paires sous un N° (CLAUDE.md §7).
// Props :
//   variante      'plein' | 'teinte' | 'texte' | 'destructif'   (défaut 'teinte')
//   icone         nœud (une icône de l'app), à gauche du libellé
//   chargement    vrai ⇒ roue à la place de l'icône, le bouton n'agit pas, la largeur ne bouge pas
//   indisponible  vrai ⇒ grisé LISIBLE, n'agit pas — passe toujours `raison`
//   raison        la phrase qui dit pourquoi (affichée sous le bouton, lue par le lecteur d'écran)
//   confirmation  (destructif) le libellé du 2e toucher, ex. « Supprimer pour de bon »
//   large         vrai ⇒ toute la largeur (un plein l'est d'office)
//   onClick, type, className, attrs (data-*, aria-* en plus)
// Exemple :
//   <Bouton variante="plein" icone={<Icon name="printer" size={20}/>} onClick={imprimer}>
//     Imprimer 3 bordereaux
//   </Bouton>
//   <Bouton variante="plein" indisponible raison="Aucun bordereau prêt : ils arrivent par e-mail.">Imprimer</Bouton>
//
// `BoutonIcone` : une icône seule, 44 × 44, toujours NOMMÉE (`libelle` = aria-label).
//   <BoutonIcone libelle="Scanner un colis" icone={<Icon name="scan" size={22}/>} onClick={scanner}/>
import React from 'react';
import { tr } from '../i18n/index.js';
import { cx } from './outils.js';

const DELAI_CONFIRMATION = 4000;

export function Bouton({ variante = 'teinte', icone = null, chargement = false, indisponible = false, raison = '', confirmation = '',
  large = false, onClick, type = 'button', className = '', attrs = null, children }) {
  const id = React.useId();
  const [arme, setArme] = React.useState(false);
  const minuteur = React.useRef(0);
  React.useEffect(() => () => clearTimeout(minuteur.current), []);
  const destructif = variante === 'destructif';
  const bloque = indisponible || chargement;

  const toucher = (e) => {
    if (bloque) { e.preventDefault(); return; }
    if (destructif && !arme) {
      e.preventDefault();
      setArme(true);
      clearTimeout(minuteur.current);
      minuteur.current = setTimeout(() => setArme(false), DELAI_CONFIRMATION);
      return;
    }
    if (destructif) { clearTimeout(minuteur.current); setArme(false); }
    if (onClick) onClick(e);
  };

  const libelle = destructif && arme ? (confirmation || tr('natif.bouton.confirmer')) : children;
  return (
    <span className={cx('n-bouton-bloc', (large || variante === 'plein') && 'n-bouton-bloc-large')}>
      <button
        type={type}
        className={cx('n-bouton', className)}
        data-n-variante={variante}
        data-n-arme={arme ? '1' : undefined}
        aria-disabled={bloque ? 'true' : undefined}
        aria-busy={chargement ? 'true' : undefined}
        aria-describedby={indisponible && raison ? id : undefined}
        onClick={toucher}
        onBlur={destructif ? () => { clearTimeout(minuteur.current); setArme(false); } : undefined}
        {...(attrs || {})}
      >
        {chargement ? <span className="n-roue" aria-hidden="true"/> : (icone ? <span className="n-bouton-icone" aria-hidden="true">{icone}</span> : null)}
        <span className="n-bouton-libelle" aria-live={destructif ? 'polite' : undefined}>{libelle}</span>
      </button>
      {indisponible && raison ? <span className="n-bouton-raison" id={id} data-n-raison="">{raison}</span> : null}
    </span>
  );
}

export function BoutonIcone({ libelle, icone, onClick, pastille = null, actif = false, indisponible = false, className = '', attrs = null }) {
  return (
    <button
      type="button"
      className={cx('n-bouton-icone-seule', className)}
      aria-label={libelle}
      title={libelle}
      aria-pressed={actif ? 'true' : undefined}
      aria-disabled={indisponible ? 'true' : undefined}
      onClick={(e) => { if (indisponible) { e.preventDefault(); return; } if (onClick) onClick(e); }}
      {...(attrs || {})}
    >
      <span className="n-bouton-icone" aria-hidden="true">{icone}</span>
      {pastille}
    </button>
  );
}

export default Bouton;
