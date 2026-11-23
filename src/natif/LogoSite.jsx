// ── src/natif/LogoSite.jsx — le petit logo du site d'une rangée (20 nov. soir) ───────────────────────────────────────────
// Julien : « tu vas aussi enlever les onglets par plateforme, ça ne marche pas du tout ». Tout est mélangé : chaque rangée
// porte le logo de SON site, en couleur (la forme : public/brands/*.svg en masque, posée par la feuille — jamais un style en
// ligne avec `url(` : la copie instantanée, src/copieEcran.js, le retirerait), lisible en clair et en sombre.
// Props : site ('vinted' | 'leboncoin' | 'ebay' | 'vestiaire'), taille (16 par défaut), nom (lu par le lecteur d'écran).
import React from 'react';
import './logo-site.css';

const SITES = new Set(['vinted', 'leboncoin', 'ebay', 'vestiaire']);
export function LogoSite({ site, taille = 16, nom = '' }) {
  if (!SITES.has(site)) return null;
  return <span className="n-logo-site" data-site={site} data-n-taille={taille} role={nom ? 'img' : undefined} aria-label={nom || undefined} aria-hidden={nom ? undefined : 'true'} title={nom || undefined}/>;
}
export default LogoSite;
