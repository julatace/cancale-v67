// ── LE SÉLECTEUR À LOGOS (5 nov., Julien : « séparés par le logo de chaque
// plateforme ») ─────────────────────────────────────────────────────────────
// UNE forme, partout où l'on choisit un site : Annonces, Ventes, Achats,
// Messages, Colis. Chaque segment porte le LOGO du site (servi localement,
// dessiné en masque : il prend la couleur du texte — aucune couleur de marque,
// §7 « une seule couleur d'accent, et elle est rare ») et son nom ; au
// téléphone, quand la rangée est pleine, seul le segment choisi garde son nom
// (le logo suffit à reconnaître les autres ; le nom reste dans `aria-label`).
// Les règles (quels sites, dans quel ordre) : `src/plateformes.js`.
// Garde les classes `vrm-filtres vrm-filtre-site` (la forme segmentée iOS de
// l'app) et `data-filtre-site` / `data-site` que lisent les bancs.
import React from 'react';
import './styles-selecteur-sites.css';
import { logoPlateforme } from './plateformes.js';

export default function SelecteurSites({ id, options = [], valeur, onChoix, label = 'Filtrer par site' }) {
  if (!Array.isArray(options) || options.length < 2) return null;
  return (
    <div className="vrm-rangee vrm-filtres vrm-filtre-site vrm-sel-sites" role="group" aria-label={label}
      data-filtre-site={id} data-selecteur-logos="" data-n={options.length}>
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={valeur === o.id} data-site={o.id} aria-label={o.nom} title={o.nom}
          onClick={() => onChoix && onChoix(o.id)}>
          <span className="vrm-ss-in">
            {o.logo
              ? <span className="vrm-ss-logo" data-logo-site={o.id} aria-hidden="true" style={{ '--vrm-ss-logo': `url("${o.logo}")` }}/>
              : <span className="vrm-ss-logo vrm-ss-tous" data-logo-site="toutes" aria-hidden="true"><i/><i/><i/><i/></span>}
            <span className="vrm-ss-nom">{o.court || o.nom}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

// Le logo seul, en ligne d'un texte (une vente de « Tous les sites », une carte
// de « Publier ailleurs ») : la même image, la même couleur que le texte.
export function LogoSite({ site, logo = null }) {
  const src = logo || logoPlateforme(site);
  if (!src) return null;
  return <span className="vrm-logo-site" data-logo-site={site} aria-hidden="true" style={{ '--vrm-ss-logo': `url("${src}")` }}/>;
}
