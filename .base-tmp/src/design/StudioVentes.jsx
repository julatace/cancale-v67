// ════════════════════════════════════════════════════════════════════════════
//  « STUDIO BLEU CLAIR » — VENTES (À expédier) · ACHATS (À retirer)  (14 nov.)
//  Décision de Julien : la direction t25 (bleu clair partout, quatre formes de
//  bouton, « tout doit être parfait, tu peux changer les dispositions »).
//  Contrat des noms : scratchpad directions/CONTRAT-STUDIO.md (classes `sb-*`).
//
//  Ici, SEULEMENT l'habit et la place : aucun nombre n'est calculé dans ce
//  fichier. Chaque chiffre arrive de l'écran qui le possède (`vrm_colis_aposter`,
//  `vrm_colis_retirer`, `resumeLot`…), chaque geste est la fonction d'avant
//  passée telle quelle (« Tout imprimer » = `ouvrirLot`, le parcours de
//  l'impression n'est pas touché).
//
//   · `TeteStudio`    le grand chiffre de la section (« 10 colis à envoyer ·
//                     3 avant demain ») et, à droite, le seul bouton plein ;
//   · `BoutonPlein`   (a) le rond d'encre — le geste du jour ;
//   · `Rond`          (c) une icône seule, 44 px, avec son `aria-label` ;
//   · `TuilesFiltres` les tuiles-filtres qui portent leur chiffre : l'active est
//                     ENFONCÉE avec sa diode (`aria-pressed`), jamais une autre
//                     couleur de fond.
//  Styles : src/design/studio-ventes.css.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';

// Un seul jeu d'icônes au trait, 1,5 px à l'écran quelle que soit la taille.
const TRAITS = {
  plus: <><path d="M12 5v14M5 12h14"/></>,   // (20 nov.) « Ajouter » d'Achats, « Publier » d'Annonces : le rond dessinait un cercle vide
  printer: <><path d="M7 9V4.5h10V9"/><rect x="3.5" y="9" width="17" height="8" rx="2"/><path d="M7 14.5h10V20H7z"/></>,
  scan: <><path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><path d="M8 9v6M11 9v6M14 9v6M16.5 9v6"/></>,
  // (15 nov., scanner pour retrouver) Un code-barres sous une loupe : retrouver un colis par son code.
  retrouver: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.3 15.3L20 20"/><path d="M8 8.25v4.5M10.5 8.25v4.5M13 8.25v4.5"/></>,
  // (20 nov., intégration) « Arrivée » d'un colis (lot arrivee-scan) : le carton, le même dessin que `box` d'ICON_PATHS (sans lui, le rond était vide).
  box: <><path d="M3.5 8 12 3.5 20.5 8v8L12 20.5 3.5 16V8Z"/><path d="M3.5 8 12 12.5 20.5 8M12 12.5V20.5"/></>,
  more: <><circle cx="6" cy="12" r="1.1"/><circle cx="12" cy="12" r="1.1"/><circle cx="18" cy="12" r="1.1"/></>,
  qr: <><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h3v3h-3zM20 14v3M17 20h3"/></>,
};
export function IconeTrait({ nom, taille = 21 }) {
  const t = TRAITS[nom];
  if (!t) return null;
  return (
    <svg className="sb-icone" width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {React.Children.map(t.props.children, (c) => React.cloneElement(c, { vectorEffect: 'non-scaling-stroke' }))}
    </svg>
  );
}

// (a) LE bouton plein de l'écran. `enCours` : il reste enfoncé, diode allumée.
// `attrs` porte les data-* d'avant (les bancs et la coque les lisent).
export function BoutonPlein({ icone = 'printer', libelle, onClick, disabled = false, enCours = false, attrs = {}, titre }) {
  return (
    <button type="button" className={'sb-btn-plein' + (enCours ? ' is-en-cours' : '')} onClick={onClick} disabled={disabled}
      aria-pressed={enCours ? 'true' : undefined} title={titre} {...attrs}>
      <span className="sb-btn-plein-icone"><IconeTrait nom={icone} taille={24}/></span>
      <span className="sb-btn-plein-mot">{libelle}</span>
    </button>
  );
}

// (c) Un rond d'action : une icône seule qui se comprend sans mot (son nom est dit au lecteur d'écran).
export function Rond({ icone, label, onClick, attrs = {}, titre, actif = false }) {
  return (
    <button type="button" className={'sb-rond' + (actif ? ' is-actif' : '')} aria-label={label} title={titre || label} onClick={onClick}
      aria-pressed={actif ? 'true' : undefined} {...attrs}>
      <IconeTrait nom={icone} taille={21}/>
    </button>
  );
}

// LE GRAND CHIFFRE de la section. `n` : le nombre publié (null = pas su ⇒ « — », jamais 0).
// `auMoins` : un site pas lu ⇒ le nombre est un plancher, dit à côté (§5).
export function TeteStudio({ section, id, titre, n, auMoins = false, libelle, presses = 0, libellePresses = '', droite = null, ronds = null, enLecture = '' }) {
  return (
    <header className="sb-tete" data-colis-section={section} id={id} data-sb-tete={section}>
      <div className="sb-tete-haut">
        <h2 className="sb-tete-titre">{titre}</h2>
        {ronds ? <div className="sb-tete-ronds">{ronds}</div> : null}
      </div>
      <div className="sb-tete-corps">
        <p className="sb-tete-chiffre" data-sb-chiffre={n == null ? '' : String(n)} data-sb-au-moins={auMoins ? '1' : undefined}>
          {auMoins && n != null ? <span className="sb-tete-borne">{auMoins}</span> : null}
          <bdi className={'sb-chiffre-affiche' + (n == null ? ' is-passu' : '')}>{n == null ? '—' : n}</bdi>
          <span className="sb-tete-mots">
            <span className="sb-tete-lib">{n == null ? enLecture : libelle}</span>
            {presses > 0 ? <span className="sb-tete-ambre" data-sb-presses={presses}>{libellePresses}</span> : null}
          </span>
        </p>
        {droite}
      </div>
    </header>
  );
}

// LES TUILES-FILTRES. tuiles : [{ v, l, n, unite, ambre, attrs }] ; `valeur` : la tuile posée.
// Une tuile qui ne filtre plus rien n'existe pas (la règle de la liste revient à « tous »).
export function TuilesFiltres({ tuiles, valeur, onChoix, label, attrs = {} }) {
  if (!Array.isArray(tuiles) || tuiles.length < 2) return null;
  return (
    <div className="sb-tuiles-filtres" role="group" aria-label={label} {...attrs}>
      {tuiles.map((t) => {
        const actif = valeur === t.v;
        return (
          <button key={t.v} type="button" className={'sb-tuile sb-tuile-filtre' + (actif ? ' is-actif' : '') + (t.ambre ? ' is-ambre' : '')}
            aria-pressed={actif ? 'true' : 'false'} onClick={() => onChoix(actif && t.v !== 'tous' ? 'tous' : t.v)} {...(t.attrs || {})}>
            <span className="sb-tuile-lib">{t.l}</span>
            <span className="sb-diode" aria-hidden="true"/>
            <span className="sb-tuile-bas"><bdi className="sb-tuile-chiffre">{t.n}</bdi>{t.unite ? <span className="sb-tuile-unite">{t.unite}</span> : null}</span>
          </button>
        );
      })}
    </div>
  );
}
