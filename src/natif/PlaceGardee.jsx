// ── src/natif/PlaceGardee.jsx — LA PLACE D'UN BLOC QUI ARRIVE TARD (25 nov., chargement propre) ─────────────────────
// Julien : « quand les données s'affichent c'est moche, long et déstructuré ». Un bloc qui n'existe que s'il y a quelque
// chose à dire (les alertes de tête d'Aujourd'hui, l'argent à venir…) arrivait APRÈS l'écran et poussait tout ce qui
// était dessous (banc chargement-structure : jusqu'à 88 px, CLS 0,07).
//
// La règle : tant que ses données ne sont pas lues (`pret` faux), le bloc tient la HAUTEUR qu'il avait la dernière fois
// sur CET appareil (mesurée quand tout était lu, rangée sous `vrm_place_{cle}` — préfixe `vrm_` : effacée avec les données
// locales à la déconnexion) par un squelette (`.n-os`, reflet doux, coupé sous prefers-reduced-motion). Rien la dernière
// fois ⇒ rien de réservé. Jamais un contenu inventé : seulement la place, muette (`aria-hidden`).
// Props :
//   cle       la clé de la place, AVEC le compte VRM (« journee-alertes:{uid} ») ;
//   pret      vrai quand les données dont dépend le bloc sont lues (sa présence ou son absence est sûre) ;
//   children  le bloc (rien ⇒ aucun bloc à montrer) ;
//   rayon     l'arrondi du squelette (px, 16 par défaut : celui des cartes) ;
//   defaut    la hauteur tenue sur un appareil qui n'a encore rien mesuré (0 par défaut : rien) — pour un bloc presque
//             toujours là (« À venir » d'Argent : une rangée de cartes).
import React from 'react';

const CLE = (c) => 'vrm_place_' + String(c || '');
const lire = (c) => { try { const v = Number(localStorage.getItem(CLE(c))); return Number.isFinite(v) && v > 0 && v < 1600 ? Math.round(v) : 0; } catch (_) { return 0; } };

export function PlaceGardee({ cle, pret = false, children = null, rayon = 16, defaut = 0 }) {
  const [h0] = React.useState(() => { try { if (localStorage.getItem(CLE(cle)) != null) return lire(cle); } catch (_) { /* rien */ } return defaut > 0 ? defaut : 0; });
  const ref = React.useRef(null);
  const ecrit = React.useRef(null);
  const present = children != null && children !== false;
  React.useLayoutEffect(() => {
    if (!pret || !cle) return;
    const h = present && ref.current ? Math.round(ref.current.offsetHeight) : 0;
    if (ecrit.current === h) return;
    ecrit.current = h;
    try { localStorage.setItem(CLE(cle), String(h)); } catch (_) { /* navigation privée : rien gardé */ }
  });
  if (present) return <div ref={ref} className="n-place-gardee" data-place-gardee={cle}>{children}</div>;
  if (!pret && h0) {
    return (
      <div className="n-place-gardee" data-place-attente={cle} aria-hidden="true">
        <span className="n-os" style={{ display: 'block', height: h0, borderRadius: rayon }}/>
      </div>
    );
  }
  return null;
}

export default PlaceGardee;
