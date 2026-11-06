// ── LE SÉLECTEUR À LOGOS (5 nov., Julien : « séparés par le logo de chaque
// plateforme ») ─────────────────────────────────────────────────────────────
// UNE forme, partout où l'on choisit un site : Annonces, Ventes, Achats,
// Messages, Colis. Chaque segment porte le LOGO du site (servi localement,
// dessiné en masque : il prend la couleur du texte — aucune couleur de marque,
// §7 « une seule couleur d'accent, et elle est rare »). (5 nov., chantier A, revue
// 1.3) Le LOGO SEUL ; le nom n'est écrit que sur le site CHOISI, au téléphone comme
// à l'ordinateur (le logo suffit à reconnaître les autres ; le nom reste dans
// `aria-label` et l'infobulle). Le logo d'eBay EST son nom (le mot « ebay ») : il
// n'en porte jamais un second (« eBay eBay »).
// Les règles (quels sites, dans quel ordre) : `src/plateformes.js`.
// Garde les classes `vrm-filtres vrm-filtre-site` (la forme segmentée iOS de
// l'app) et `data-filtre-site` / `data-site` que lisent les bancs.
import React from 'react';
import './styles-selecteur-sites.css';
import { logoPlateforme } from './plateformes.js';

// Les sites dont le logo est le mot lui-même : le nom écrit à côté le doublerait.
const LOGO_EST_LE_NOM = new Set(['ebay']);

export default function SelecteurSites({ id, options = [], valeur, onChoix, label = 'Filtrer par site' }) {
  if (!Array.isArray(options) || options.length < 2) return null;
  return (
    <div className="vrm-rangee vrm-filtres vrm-filtre-site vrm-sel-sites" role="group" aria-label={label}
      data-filtre-site={id} data-selecteur-logos="" data-n={options.length}>
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={valeur === o.id} data-site={o.id} data-sans-compte={o.sansCompte ? '' : undefined} aria-label={o.nom} title={o.sansCompte ? `${o.nom} · aucun compte relié` : o.nom}
          onClick={() => onChoix && onChoix(o.id)}>
          <span className="vrm-ss-in">
            {o.logo
              ? <span className="vrm-ss-logo" data-logo-site={o.id} aria-hidden="true" style={{ '--vrm-ss-logo': `url("${o.logo}")` }}/>
              : <span className="vrm-ss-logo vrm-ss-tous" data-logo-site="toutes" aria-hidden="true"><i/><i/><i/><i/></span>}
            {valeur === o.id && !(o.logo && LOGO_EST_LE_NOM.has(o.id)) ? <span className="vrm-ss-nom">{o.court || o.nom}</span> : null}
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
