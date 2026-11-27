// ── src/achats/FiltreAchats.jsx — le filtre par plateforme de l'onglet Achats (25 nov.) ────────────────────────────────
// Les nombres : ceux que chaque morceau d'Achats publie de SA liste (src/achats/nombresAchatsSites.js) ; les entrées et le choix :
// la règle commune (src/filtrePlateforme.js) ; la forme : la rangée de puces commune (src/natif/FiltrePlateformes.jsx).
// `children(eff)` : l'écran rend ses morceaux avec le site choisi (« toutes » ou un site) ; un morceau d'un autre site reste MONTÉ
// mais caché (il continue de lire et de publier son nombre : son entrée ne disparaît pas parce qu'on regarde ailleurs).
import React from 'react';
import { FiltrePlateformes, useFiltrePlateforme } from '../natif/FiltrePlateformes.jsx';
import { optionsPlateformes, choixEffectif } from '../filtrePlateforme.js';
import { useNombresAchats } from './nombresAchatsSites.js';

export function FiltreAchats({ rangee = false, children }) {
  const [choix, choisir] = useFiltrePlateforme('achats');
  const nombres = useNombresAchats();
  const options = optionsPlateformes(nombres);
  const eff = choixEffectif(choix, options);
  return <>
    {rangee ? <FiltrePlateformes ecran="achats" options={options} valeur={eff} onChange={choisir}/> : null}
    {typeof children === 'function' ? children(eff) : children}
  </>;
}

// ⚠️ (26 nov., banc iphone-reprise R1) LE SITE CHOISI, LU PAR LA COQUE. Un enfant-FONCTION (`children(eff)`) rendu dans un écran
// GARDÉ (src/ecransGardes.jsx) se compare à son TEXTE : un changement de la coque qu'il capture (le compte choisi, une lecture
// arrivée) passait pour « le même rendu », et Achats ne se redessinait qu'au rechargement (toucher « atelier_test » : rien ne
// bougeait). La coque lit donc ce choix elle-même (`useEffAchats`) et rend ses morceaux en ÉLÉMENTS ordinaires.
export function useEffAchats() {
  const [choix] = useFiltrePlateforme('achats');
  const nombres = useNombresAchats();
  return choixEffectif(choix, optionsPlateformes(nombres));
}

// Un morceau d'Achats : montré sous « Toutes » et sous SON site, caché (monté) sinon.
export function MorceauSite({ site, eff, children }) {
  const vu = eff === 'toutes' || eff === site;
  return <div hidden={!vu} data-achats-morceau={site} data-achats-morceau-vu={vu ? '1' : '0'}>{children}</div>;
}

export default FiltreAchats;
