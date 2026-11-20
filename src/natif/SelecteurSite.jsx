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
// (20 nov., fusion avec argent-natif) UN seul sélecteur, UNE seule clé : l'état vit dans src/siteCourant.js (`vrm_site_courant`,
// synchronisé, valeurs 'toutes' | un site) ; `useSiteCourant` et `CLE_SITE_COURANT` sont ré-exportés ici pour les écrans qui
// les importaient d'ici (Argent). « tous » (l'écriture d'argent-natif) est lu comme « toutes ».
import React from 'react';
import { Segmente } from './Segmente.jsx';
import { useSiteCourant } from '../siteCourant.js';
import './selecteur-site.css';
export { useSiteCourant, CLE_SITE_COURANT } from '../siteCourant.js';

export function SelecteurSite({ sites = [], valeur = 'toutes', onChange, nom = (s) => s, Logo = null, tous = 'Tous', libelle = '', attrs = null }) {
  if (!Array.isArray(sites) || sites.length < 2) return null;
  const options = [
    { cle: 'toutes', libelle: tous, attrs: { 'data-site-choix': 'toutes' } },
    ...sites.map((s) => ({ cle: s, attrs: { 'data-site-choix': s, 'aria-label': nom(s) },
      libelle: <span className="n-site-option">{Logo ? <span className="n-site-logo" aria-hidden="true">{Logo(s)}</span> : null}<span className="n-site-nom">{nom(s)}</span></span> })),
  ];
  const v = sites.includes(valeur) ? valeur : 'toutes';
  return (
    <div className="n-selecteur-site" data-site-courant={v} data-n-choix={options.length} {...(attrs || {})}>
      <Segmente options={options} valeur={v} onChange={onChange} libelle={libelle}/>
    </div>
  );
}
// Le sélecteur qui garde lui-même le choix : ce qu'un écran pose quand il n'a rien à en faire de plus.
export function SelecteurSiteGarde(props) {
  const [site, poser] = useSiteCourant();
  return <SelecteurSite {...props} valeur={site} onChange={poser}/>;
}
export default SelecteurSite;
