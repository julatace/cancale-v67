// ── LE SÉLECTEUR À LOGOS (5 nov., Julien : « séparés par le logo de chaque
// plateforme ») ─────────────────────────────────────────────────────────────
// UNE forme, partout où l'on choisit un site : Annonces, Ventes, Achats,
// Messages, Colis. Chaque segment porte le LOGO du site (il prend la couleur du
// texte — aucune couleur de marque, §7 « une seule couleur d'accent, et elle est
// rare »). (5 nov., chantier A, revue 1.3) Le LOGO SEUL ; le nom n'est écrit que sur
// le site CHOISI, au téléphone comme à l'ordinateur (le logo suffit à reconnaître
// les autres ; le nom reste dans `aria-label` et l'infobulle). Le logo d'eBay EST
// son nom (le mot « ebay ») : il n'en porte jamais un second (« eBay eBay »).
// Les règles (quels sites, dans quel ordre) : `src/plateformes.js`.
// Garde les classes `vrm-filtres vrm-filtre-site` (la forme segmentée iOS de
// l'app) et `data-filtre-site` / `data-site` que lisent les bancs.
//
// (15 nov., Annonces propre — Julien : « fais de meilleurs logos pour les plateformes »)
// La marque est un <svg> EN LIGNE (src/plateformes/marques.js, UNE source : Simple Icons
// CC0 pour Vinted et eBay, dessinées pour VRM pour Leboncoin et Vestiaire), à la couleur
// du texte, à la même hauteur optique pour les quatre, nette à toute taille.
// `nombres` (facultatif) : { site: n } — le nombre d'annonces d'un site tel que SA règle
// le compte (jamais deviné : absent ⇒ rien d'écrit). Il s'écrit sur les sites NON
// choisis : le site choisi dit son nombre dans son propre écran (un nombre une seule
// fois par écran, §7).
import React from 'react';
import './styles-selecteur-sites.css';
import { logoPlateforme } from './plateformes.js';
import MarquePlateforme from './plateformes/Marque.jsx';
import { marque } from './plateformes/marques.js';

// Les sites dont le logo est le mot lui-même : le nom écrit à côté le doublerait.
const LOGO_EST_LE_NOM = new Set(['ebay']);

export default function SelecteurSites({ id, options = [], valeur, onChoix, label = 'Filtrer par site', nombres = null, unite = 'annonce' }) {
  if (!Array.isArray(options) || options.length < 2) return null;
  return (
    <div className="vrm-rangee vrm-filtres vrm-filtre-site vrm-sel-sites" role="group" aria-label={label}
      data-filtre-site={id} data-selecteur-logos="" data-n={options.length}>
      {options.map((o) => {
        const choisi = valeur === o.id;
        const n = nombres && Number.isFinite(nombres[o.id]) ? nombres[o.id] : null;
        const nomAria = o.nom + (n != null ? ` · ${n} ${unite}${n > 1 ? 's' : ''}` : '');
        return (
          <button key={o.id} type="button" aria-pressed={choisi} data-site={o.id} data-site-n={n != null ? String(n) : undefined} data-sans-compte={o.sansCompte ? '' : undefined} aria-label={nomAria} title={o.sansCompte ? `${o.nom} · aucun compte relié` : nomAria}
            onClick={() => onChoix && onChoix(o.id)}>
            <span className="vrm-ss-in">
              {marque(o.id)
                ? <span className="vrm-ss-logo" data-logo-site={o.id} aria-hidden="true"><MarquePlateforme site={o.id} taille={18}/></span>
                : o.logo
                  ? <span className="vrm-ss-logo vrm-ss-masque" data-logo-site={o.id} aria-hidden="true" style={{ '--vrm-ss-logo': `url("${o.logo}")` }}/>
                  : <span className="vrm-ss-logo vrm-ss-tous" data-logo-site="toutes" aria-hidden="true"><i/><i/><i/><i/></span>}
              {choisi && !(o.logo && LOGO_EST_LE_NOM.has(o.id)) ? <span className="vrm-ss-nom">{o.court || o.nom}</span> : null}
              {n != null && !choisi ? <span className="vrm-ss-n" aria-hidden="true">{n > 999 ? '999+' : n}</span> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Le logo seul, en ligne d'un texte (une vente de « Tous les sites », une carte
// de « Publier ailleurs ») : la même marque, la même couleur que le texte, dans une
// boîte carrée (les quatre prennent la même largeur dans une colonne).
export function LogoSite({ site, logo = null }) {
  if (!logo && marque(site)) return <span className="vrm-logo-site" data-logo-site={site} aria-hidden="true"><MarquePlateforme site={site} carre taille={24}/></span>;
  const src = logo || logoPlateforme(site);
  if (!src) return null;
  return <span className="vrm-logo-site vrm-ss-masque" data-logo-site={site} aria-hidden="true" style={{ '--vrm-ss-logo': `url("${src}")` }}/>;
}
