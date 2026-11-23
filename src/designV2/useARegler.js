// ── src/designV2/useARegler.js — la publication « À régler », lue par la coque (pastilles) ──
// À part du bloc (src/designV2/ARegler.jsx) : la coque lit les pastilles AU DÉMARRAGE, le bloc et ses composants natifs
// (et leur CSS) partent dans un morceau chargé à la demande (budget de démarrage, scripts/budget-vitesse.json).
import React from 'react';
import { lireARegler, abonnerARegler } from './aRegler.js';

// La publication, relue quand elle change (un écran gardé qui revient la relit aussi).
export function useARegler() {
  return React.useSyncExternalStore(abonnerARegler, lireARegler, () => null);
}

export default useARegler;
