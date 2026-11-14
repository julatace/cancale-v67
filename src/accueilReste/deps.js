// ── LES OUTILS DE L'APP POUR L'ACCUEIL (14 nov.) ─────────────────────────────
// Les composants de src/accueilReste/ n'importent PAS App.jsx (un import circulaire
// à l'ouverture lève un écran blanc, CLAUDE.md §4.6) : App pose ses outils ici une
// fois (`poserOutilsAccueil`), au chargement du module. Rien n'est lu ni écrit avant.
import React from 'react';
import { CLE_AIDES, lireAides } from './aides.js';

export const OUTILS = {
  load: (k, d) => d,
  save: () => {},
  onCloudReady: (f) => { try { f(); } catch (_) {} return () => {}; },
  lireTout: async () => null,
  creeLe: () => '',
  exemple: () => false,
  aller: () => {},
  Bouton: null,
  SheetShell: null,
};
export function poserOutilsAccueil(o) { Object.assign(OUTILS, o || {}); }

// La valeur d'une clé synchronisée, relue à chaque `save` (cet onglet), au retour du
// nuage (`onCloudReady`, un autre appareil) et d'un autre onglet (`storage`).
export function useCle(cle, defaut = null) {
  const lire = React.useCallback(() => { try { return OUTILS.load(cle, defaut); } catch (_) { return defaut; } }, [cle]); // eslint-disable-line react-hooks/exhaustive-deps
  const [v, setV] = React.useState(lire);
  React.useEffect(() => {
    const relire = () => setV(lire());
    const surSave = (e) => { const d = e && e.detail; if (!d || d.k === cle || d.k === undefined) relire(); };
    const surStorage = (e) => { if (e && e.key === cle) relire(); };
    window.addEventListener('vrm:save', surSave);
    window.addEventListener('storage', surStorage);
    window.addEventListener('vrm:aides-accueil', relire);
    const off = OUTILS.onCloudReady(relire);
    return () => { window.removeEventListener('vrm:save', surSave); window.removeEventListener('storage', surStorage); window.removeEventListener('vrm:aides-accueil', relire); if (typeof off === 'function') off(); };
  }, [cle, lire]);
  return v;
}

// Les aides d'accueil (src/accueilReste/aides.js) : la valeur lue, et `ecrire(fn)` qui
// part de la valeur RANGÉE à l'instant (jamais d'un état React en retard), la range et
// prévient les autres composants.
export function useAides() {
  const brut = useCle(CLE_AIDES, null);
  const ecrire = React.useCallback((fn) => {
    let avant = null; try { avant = OUTILS.load(CLE_AIDES, null); } catch (_) { avant = null; }
    const apres = fn(lireAides(avant));
    try { OUTILS.save(CLE_AIDES, apres); } catch (_) {}
    try { window.dispatchEvent(new Event('vrm:aides-accueil')); } catch (_) {}
    return apres;
  }, []);
  return [brut, ecrire];
}
