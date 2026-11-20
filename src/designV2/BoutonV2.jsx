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
//    · destructif  — texte AMBRE (§7 : le rouge n'est que pour deux paires sous un N°), SEULEMENT derrière une
//                    confirmation (`confirmer` obligatoire) ;
//  + BoutonIconeV2 : 44 × 44 au doigt, glyphe 24, un seul trait pour toute l'app.
//
//  États : repos · enfoncé (0,97 et un peu plus sombre : 100 ms à l'appui, ressort 200 ms au retour) ·
//  focus visible (anneau) · indisponible (la RAISON est dite, pas seulement grisée) · chargement
//  (la roue remplace l'icône, la largeur ne bouge pas, le second toucher est bloqué).
//  Libellé : un verbe + un objet + le bon nombre (« Imprimer 5 bordereaux ») — jamais « OK » seul.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { Bouton, BoutonIcone } from '../natif/Bouton.jsx';
import './design-v2.css';
import './argent-v2.css';   // (17 nov., phase 2) Argent, Paramètres et la tête de la coque (allumé seulement) — ici et pas dans App.jsx : audit-studio S3

const ROLES = new Set(['principal', 'secondaire', 'texte', 'destructif']);

// (20 nov., chantier « boutons natifs ») BoutonV2 et BoutonIconeV2 DESSINENT LE BOUTON NATIF (src/natif/Bouton.jsx) :
// principal → plein · secondaire → teinte · texte → texte · destructif → texte AMBRE derrière SA confirmation (inchangée).
// Les data-v2b* restent posés (les bancs du design v2 désignent leurs boutons par eux).
const VERS_NATIF = { principal: 'plein', secondaire: 'teinte', texte: 'texte', destructif: 'texte' };
export function BoutonV2({ role = 'secondaire', icone = null, n = null, children, onClick, raison = '', indisponible = false,
  chargement = false, confirmer = null, plein = false, compact = false, className = '', attrs = {}, type = 'button', titre = '' }) {
  const r = ROLES.has(role) ? role : 'secondaire';
  const toucher = async (e) => {
    // Le destructif ne part jamais sans SA confirmation (une fonction qui rend vrai/faux, ou une promesse).
    if (r === 'destructif') { if (typeof confirmer !== 'function') return; const ok = await confirmer(); if (!ok) return; }
    if (typeof onClick !== 'function') return;
    return onClick(e);
  };
  return (
    <Bouton variante={VERS_NATIF[r]} ton={r === 'destructif' ? 'ambre' : ''} ajuste={!plein} large={plein} bloc="contenu" taille={compact ? 'compact' : 'normal'}
      icone={icone} chargement={chargement} indisponible={indisponible} raison={raison} type={type} className={className} onClick={toucher}
      attrs={{ 'data-v2b': r, 'data-v2b-etat': indisponible ? 'indisponible' : chargement ? 'chargement' : 'repos', title: titre || undefined, ...attrs }}>
      {children}{n != null && n !== '' ? <span className="n-bouton-nombre" aria-hidden="true">{n}</span> : null}
    </Bouton>
  );
}

export function BoutonIconeV2({ icone, label, onClick, attrs = {}, actif = false }) {
  return <BoutonIcone libelle={label} icone={icone} onClick={onClick} actif={actif} attrs={{ 'data-v2b': 'icone', ...attrs }}/>;
}

// Une rangée ENTIÈRE qui se touche (liste iOS) : pas un bouton dans la rangée, la rangée elle-même.
// Elle a les mêmes états (appui, focus) que les boutons ; c'est la cinquième forme permise par vrm-design.
export function RangeeTouchable({ onClick, children, className = '', attrs = {}, label }) {
  return (
    <button type="button" className={'v2-rangee ' + className} data-v2-rangee="" aria-label={label} onClick={onClick} {...attrs}>{children}</button>
  );
}

// Le contrôle segmenté du nouveau design : une piste translucide sur la coque, le segment choisi = une pastille de
// porcelaine claire à l'encre (jour comme nuit) — jamais un bloc gris plein. 44 px, nombres tabulaires.
export function SegmentV2({ options = [], value, onChange, label, attrs = {} }) {
  return (
    <div className="v2-seg" role="tablist" aria-label={label} {...attrs}>
      {options.map((o) => {
        const on = o.v === value;
        return (
          <button key={o.v} type="button" role="tab" aria-selected={on} className={'v2-seg-btn' + (on ? ' is-on' : '')} data-v2-seg={o.v}
            onClick={() => onChange && onChange(o.v)} {...(o.data || {})}>
            <span className="v2-seg-l">{o.l}</span>{o.n != null && o.n !== '' ? <span className="v2-seg-n">{o.n}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
