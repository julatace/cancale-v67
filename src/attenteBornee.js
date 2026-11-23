// ── src/attenteBornee.js — une attente FINIT (22 nov., chasse aux bugs P2-5) ──
// « Je lis tes colis… », « Je demande à l'extension… », « Je lis les boosts relevés… » restaient à l'écran sans fin
// quand la lecture ne revenait jamais (extension absente, réponse perdue). Règle : une attente dure au plus
// `ATTENTE_MAX_MS` ; au-delà (8 s), l'écran dit « pas su » avec SA raison (jamais 0, jamais « rien » : §5 « pas su ≠ rien »).
// Une valeur qui arrive ensuite remplace « pas su » comme d'habitude (le crochet ne ment pas sur ce qui est lu).
import React from 'react';

export const ATTENTE_MAX_MS = 8000;   // ≤ 10 s, monté en retard au téléphone (processeur ×4) compris

// enAttente : vrai tant que la lecture n'a rien rendu. Rend vrai quand l'attente a dépassé `ms` (sans interruption).
export function useAttenteDepassee(enAttente, ms = ATTENTE_MAX_MS) {
  const [depassee, setDepassee] = React.useState(false);
  React.useEffect(() => {
    if (!enAttente) { setDepassee(false); return undefined; }
    const t = setTimeout(() => setDepassee(true), ms);
    return () => clearTimeout(t);
  }, [enAttente, ms]);
  return !!enAttente && depassee;
}

// La valeur d'une lecture à trois états (`undefined` en cours · `null` pas su · valeur) bornée dans le temps.
export function useLectureBornee(valeur, ms = ATTENTE_MAX_MS) {
  const depassee = useAttenteDepassee(valeur === undefined, ms);
  return valeur === undefined && depassee ? null : valeur;
}
