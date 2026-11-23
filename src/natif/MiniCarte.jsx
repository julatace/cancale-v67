// ── src/natif/MiniCarte.jsx — la petite carte d'UN point relais (20 nov.) ─────────────────
// Montrée SEULEMENT quand l'écran a un repère SÛR du point (`repere`, src/relaisColis.js : liste Vinted ou
// Base Adresse jugée). Fond OpenFreeMap (src/fondCarte.js : sans clé, le domaine que la CSP prépare), MapLibre
// chargé à la demande, carte figée (aucun geste), créée quand la carte entre à l'écran et détruite quand elle
// en sort (un seul contexte WebGL vivant par carte visible). Pas de WebGL, fond injoignable, tuiles absentes ⇒
// RIEN n'est dessiné (jamais un cadre gris) : l'adresse et « Itinéraire » restent au-dessus.
import React from 'react';
import { chargerMaplibre, poserFond, webglDispo, ATTRIBUTION_TEXTE } from '../fondCarte.js';

export function MiniCarte({ lat, lon }) {
  const boite = React.useRef(null);
  const [etat, setEtat] = React.useState('attente');   // attente · dessine · echec
  const ok = Number.isFinite(Number(lat)) && Number.isFinite(Number(lon));
  React.useEffect(() => {
    if (!ok || !boite.current) return undefined;
    if (typeof IntersectionObserver === 'undefined' || !webglDispo()) { setEtat('echec'); return undefined; }
    let carte = null, fini = false;
    const sombre = () => { try { return document.documentElement.getAttribute('data-theme') === 'dark'; } catch (_) { return false; } };
    const creer = async () => {
      if (carte || fini) return;
      try {
        const ml = await chargerMaplibre(); if (fini || !boite.current) return;
        carte = new ml.Map({ container: boite.current, style: { version: 8, sources: {}, layers: [] }, center: [Number(lon), Number(lat)], zoom: 15, interactive: false, attributionControl: false });
        await poserFond(carte, { sombre: sombre(), annule: () => fini });
        if (fini) return;
        const el = document.createElement('span'); el.className = 'n-rp-mini-epingle';
        new ml.Marker({ element: el }).setLngLat([Number(lon), Number(lat)]).addTo(carte);
        setEtat('dessine');
      } catch (_) { if (!fini) setEtat('echec'); try { if (carte) carte.remove(); } catch (__) {} carte = null; }
    };
    const detruire = () => { try { if (carte) carte.remove(); } catch (_) {} carte = null; };
    const obs = new IntersectionObserver((es) => { for (const e of es) { if (e.isIntersecting) creer(); else if (carte) { detruire(); setEtat('attente'); } } }, { rootMargin: '120px' });
    obs.observe(boite.current);
    return () => { fini = true; obs.disconnect(); detruire(); };
  }, [lat, lon, ok]);
  if (!ok || etat === 'echec') return null;
  return (
    <div className="n-rp-mini" data-rp-mini={etat}>
      <div className="n-rp-mini-fond" ref={boite} aria-hidden="true"/>
      {etat === 'dessine' ? <span className="n-rp-mini-attr">{ATTRIBUTION_TEXTE}</span> : null}
    </div>
  );
}

export default MiniCarte;
