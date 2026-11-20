// ── src/natif/SelecteurSite.jsx — LE sélecteur de plateforme, un pour toute l'app (20 nov.) ─────────────────────
// Décision du 20 nov. (« une application par plateforme ? » — non) : les onglets restent par fonction ; ce segmenté natif,
// en haut de chaque écran principal, choisit le site regardé PARTOUT (src/siteCourant.js, clé `vrm_site_courant`).
// Props :
//   sites    les sites RELIÉS, dans l'ordre de l'app (['vinted', 'leboncoin', …]) — moins de deux ⇒ rien n'est rendu
//   valeur   'toutes' | un site
//   onChange (site) => …
//   nom      (site) => son nom (« Leboncoin »)
//   Logo     (site) => le logo du site (nœud), facultatif ; au téléphone, à quatre ou cinq choix, le logo seul (le nom reste lu)
//   tous     le libellé de « Tous »
//   libelle  le nom du groupe pour le lecteur d'écran
// Exemple : <SelecteurSite sites={['vinted','ebay']} valeur={site} onChange={poser} nom={nomPlateforme} tous="Tous"/>
import React from 'react';
import { Segmente } from './Segmente.jsx';
import './selecteur-site.css';

export function SelecteurSite({ sites = [], valeur = 'toutes', onChange, nom = (s) => s, Logo = null, tous = 'Tous', libelle = '', attrs = null }) {
  if (!Array.isArray(sites) || sites.length < 2) return null;
  const options = [
    { cle: 'toutes', libelle: tous, attrs: { 'data-site-choix': 'toutes' } },
    ...sites.map((s) => ({ cle: s, attrs: { 'data-site-choix': s, 'aria-label': nom(s) },
      libelle: <span className="n-site-option">{Logo ? <span className="n-site-logo" aria-hidden="true">{Logo(s)}</span> : null}<span className="n-site-nom">{nom(s)}</span></span> })),
  ];
  const v = valeur === 'toutes' || sites.includes(valeur) ? valeur : 'toutes';
  return (
    <div className="n-selecteur-site" data-site-courant={v} data-n-choix={options.length} {...(attrs || {})}>
      <Segmente options={options} valeur={v} onChange={onChange} libelle={libelle}/>
    </div>
  );
}
export default SelecteurSite;
