// ════════════════════════════════════════════════════════════════════════════
//  UNE LECTURE EN VOL PAR CLÉ (17 nov., onglets rapides — chasse aux bugs : `panel_num_reserves` lue 5 fois à
//  l'ouverture d'Achats). Les lecteurs qui demandent la MÊME ligne pendant qu'une lecture est en route reçoivent
//  CETTE lecture (la même réponse du serveur, octet pour octet) ; dès qu'elle est arrivée, la clé est oubliée :
//  la lecture suivante repart au serveur. Rien n'est gardé au-delà du vol (une réservation de N° rangée par
//  l'extension n'est jamais masquée par une copie) ; un signal de l'extension (`vrm:ext`) fait repartir la
//  lecture suivante même si une est encore en vol. Un échec est rendu à chacun, jamais gardé.
// ════════════════════════════════════════════════════════════════════════════
const enVol = new Map();
let generation = 0;
export function lireEnVol(cle, lire) {
  const k = cle + '#' + generation;
  const deja = enVol.get(k);
  if (deja) return deja;
  const p = Promise.resolve().then(lire);
  enVol.set(k, p);
  const fin = () => { if (enVol.get(k) === p) enVol.delete(k); };
  p.then(fin, fin);
  return p;
}
export function oublierEnVol() { generation++; enVol.clear(); }
if (typeof window !== 'undefined') { try { window.addEventListener('vrm:ext', oublierEnVol); } catch (_) {} }
