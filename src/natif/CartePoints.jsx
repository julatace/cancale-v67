// ── src/natif/CartePoints.jsx — LA CARTE DES POINTS RELAIS (21 nov., « Colis à aller chercher ») ─────────────────
// Julien : « une carte avec les colis à aller chercher pour chaque point relais, comme ça on peut faire les prévisions ».
// Un repère par point qui a une position SÛRE (`repere` de `pointsARetirer` : la liste de points de Vinted, lue — jamais un
// géocodage deviné, aucune API payante) ; sur le repère, le nombre de colis À RETIRER (plein) ou EN ROUTE (cerclé). Fond
// OpenFreeMap (src/fondCarte.js, sans clé), MapLibre chargé seulement quand la carte est ouverte. Toucher un repère =
// aller à la carte du point dans la liste. Pas de WebGL, fond injoignable ⇒ RIEN n'est dessiné : la liste reste.
import React from 'react';
import { chargerMaplibre, poserFond, webglDispo, ATTRIBUTION_TEXTE } from '../fondCarte.js';

// [{ cle, lat, lon, n, sorte: 'aretirer' | 'enroute', nom }]
export function CartePoints({ reperes = [], onPoint = null, label = '' }) {
  const boite = React.useRef(null);
  const [etat, setEtat] = React.useState('attente');   // attente · dessine · echec
  const cle = reperes.map((r) => `${r.cle}:${r.lat},${r.lon}:${r.n}:${r.sorte}`).join('|');
  React.useEffect(() => {
    if (!reperes.length || !boite.current) return undefined;
    if (!webglDispo()) { setEtat('echec'); return undefined; }
    let carte = null, fini = false;
    const sombre = () => { try { return document.documentElement.getAttribute('data-theme') === 'dark'; } catch (_) { return false; } };
    (async () => {
      try {
        const ml = await chargerMaplibre(); if (fini || !boite.current) return;
        const lons = reperes.map((r) => Number(r.lon)), lats = reperes.map((r) => Number(r.lat));
        carte = new ml.Map({ container: boite.current, style: { version: 8, sources: {}, layers: [] }, center: [lons[0], lats[0]], zoom: 13, attributionControl: false, dragRotate: false, pitchWithRotate: false });
        await poserFond(carte, { sombre: sombre(), annule: () => fini });
        if (fini) return;
        for (const r of reperes) {
          const el = document.createElement('button');
          el.type = 'button';
          el.className = 'n-cp-repere' + (r.sorte === 'enroute' ? ' is-enroute' : '');
          el.textContent = String(r.n);
          el.setAttribute('aria-label', `${r.nom || ''} · ${r.n}`);
          el.setAttribute('data-cp-repere', r.cle);
          el.addEventListener('click', (e) => { e.stopPropagation(); if (onPoint) onPoint(r.cle); });
          new ml.Marker({ element: el }).setLngLat([Number(r.lon), Number(r.lat)]).addTo(carte);
        }
        if (reperes.length > 1) carte.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], { padding: 48, maxZoom: 15, duration: 0 });
        setEtat('dessine');
      } catch (_) { if (!fini) setEtat('echec'); try { if (carte) carte.remove(); } catch (__) {} carte = null; }
    })();
    return () => { fini = true; try { if (carte) carte.remove(); } catch (_) {} carte = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);
  if (!reperes.length || etat === 'echec') return null;
  return (
    <div className="n-cp" data-cp={etat} data-cp-n={String(reperes.length)} role="region" aria-label={label}>
      <div className="n-cp-fond" ref={boite}/>
      {etat === 'dessine' ? <span className="n-cp-attr">{ATTRIBUTION_TEXTE}</span> : null}
    </div>
  );
}

export default CartePoints;
