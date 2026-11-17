// ════════════════════════════════════════════════════════════════════════════
//  LES BOUTONS DU NOUVEAU DESIGN (17 nov.) — UN composant, quatre rôles, une icône.
//  Julien : « les boutons doivent être bien travaillés ». Tous les boutons de src/designV2/ passent
//  par ici (banc design-v2 : aucun bouton fait à la main, aucun `display:inline-flex`, cibles ≥ 44).
//
//  Rôles (jamais un cinquième) :
//    · principal   — plein, UN par écran, 50 px, rayon 14, pleine largeur au pouce (téléphone),
//                    libellé 17/600, icône à gauche, nombre à droite (chiffres tabulaires) ;
//    · secondaire  — teinté ;
//    · texte       — un lien ;
//    · destructif  — texte rouge, SEULEMENT derrière une confirmation (`confirmer` obligatoire) ;
//  + BoutonIconeV2 : 44 × 44 au doigt, glyphe 24, un seul trait pour toute l'app.
//
//  États : repos · enfoncé (0,97 et un peu plus sombre : 100 ms à l'appui, ressort 200 ms au retour) ·
//  focus visible (anneau) · indisponible (la RAISON est dite, pas seulement grisée) · chargement
//  (la roue remplace l'icône, la largeur ne bouge pas, le second toucher est bloqué).
//  Libellé : un verbe + un objet + le bon nombre (« Imprimer 5 bordereaux ») — jamais « OK » seul.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import './design-v2.css';

const ROLES = new Set(['principal', 'secondaire', 'texte', 'destructif']);

function Roue() {
  return <span className="v2b-roue" aria-hidden="true"><span/></span>;
}

// `onClick` peut rendre une promesse : tant qu'elle court, le bouton est « en cours » (et refuse un second toucher).
export function BoutonV2({ role = 'secondaire', icone = null, n = null, children, onClick, raison = '', indisponible = false,
  chargement = false, confirmer = null, plein = false, className = '', attrs = {}, type = 'button', titre = '' }) {
  const r = ROLES.has(role) ? role : 'secondaire';
  const [enCours, setEnCours] = React.useState(false);
  const occupe = chargement || enCours;
  const idRaison = React.useId();
  const toucher = async (e) => {
    if (indisponible || occupe) { e.preventDefault(); return; }
    // Le destructif ne part jamais sans SA confirmation (une fonction qui rend vrai/faux, ou une promesse).
    if (r === 'destructif') { if (typeof confirmer !== 'function') return; const ok = await confirmer(); if (!ok) return; }
    if (typeof onClick !== 'function') return;
    const res = onClick(e);
    if (res && typeof res.then === 'function') { setEnCours(true); try { await res; } finally { setEnCours(false); } }
  };
  const cls = ['v2b', 'v2b-' + r, plein ? 'v2b-plein-largeur' : '', className].filter(Boolean).join(' ');
  return (
    <span className={'v2b-hote' + (plein ? ' v2b-hote-plein' : '')} data-v2b-hote="">
      <button type={type} className={cls} data-v2b={r} data-v2b-etat={indisponible ? 'indisponible' : occupe ? 'chargement' : 'repos'}
        aria-disabled={indisponible || occupe ? 'true' : undefined} aria-busy={occupe ? 'true' : undefined}
        aria-describedby={indisponible && raison ? idRaison : undefined} title={titre || undefined} onClick={toucher} {...attrs}>
        {occupe ? <Roue/> : icone ? <span className="v2b-ic" aria-hidden="true">{icone}</span> : null}
        <span className="v2b-lib">{children}</span>
        {n != null && n !== '' ? <span className="v2b-n" aria-hidden="true">{n}</span> : null}
      </button>
      {indisponible && raison ? <span className="v2b-raison" id={idRaison} data-v2b-raison="">{raison}</span> : null}
    </span>
  );
}

export function BoutonIconeV2({ icone, label, onClick, attrs = {}, actif = false }) {
  return (
    <button type="button" className={'v2b v2b-icone' + (actif ? ' is-actif' : '')} data-v2b="icone" aria-label={label} title={label}
      aria-pressed={actif ? 'true' : undefined} onClick={onClick} {...attrs}>
      <span className="v2b-ic" aria-hidden="true">{icone}</span>
    </button>
  );
}

// Une rangée ENTIÈRE qui se touche (liste iOS) : pas un bouton dans la rangée, la rangée elle-même.
// Elle a les mêmes états (appui, focus) que les boutons ; c'est la cinquième forme permise par vrm-design.
export function RangeeTouchable({ onClick, children, className = '', attrs = {}, label }) {
  return (
    <button type="button" className={'v2-rangee ' + className} data-v2-rangee="" aria-label={label} onClick={onClick} {...attrs}>{children}</button>
  );
}
