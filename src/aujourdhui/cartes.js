// ── src/aujourdhui/cartes.js — le choix des cartes d'Aujourd'hui (« Personnaliser ») ─────────────────
// Julien, 19 nov. : « OK pour la personnalisation mais ça doit être bien fait ». Le choix ({ ordre, montrees, rev, at })
// vit dans `vrm_aujourdhui_cartes` (SYNC_KEYS de l'app : le même sur ses appareils). Il est relu au chargement du nuage,
// à chaque écriture de l'app (`vrm:save`) et d'un autre onglet (`storage`) ; un choix reçu PLUS ANCIEN que celui qu'on
// tient n'écrase rien (`choixPlusRecent` : `rev`, puis `at` — src/aujourdhui/modele.js). Écrire repart du plus récent
// connu (ici ou rangé) et pose `rev + 1`.
// `o` : les outils de l'app { load, save, onCloudReady, cle } (le banc passe les siens).
import React from 'react';
import { choixPlusRecent, nouveauChoix } from './modele.js';

export function useCartes(o) {
  const lire = React.useCallback(() => { try { return o ? o.load(o.cle, null) : null; } catch (_) { return null; } }, [o]);
  const [brut, setBrut] = React.useState(lire);
  const ref = React.useRef(brut); ref.current = brut;
  const relire = React.useCallback(() => setBrut((cur) => choixPlusRecent(cur, lire())), [lire]);
  React.useEffect(() => (o && o.onCloudReady ? o.onCloudReady(relire) : undefined), [o, relire]);
  React.useEffect(() => {
    if (!o) return undefined;
    const f = (e) => { if (!e || !e.detail || e.detail.k === o.cle) relire(); };
    const g = (e) => { if (!e || e.key == null || String(e.key).endsWith(o.cle)) relire(); };
    window.addEventListener('vrm:save', f); window.addEventListener('storage', g);
    return () => { window.removeEventListener('vrm:save', f); window.removeEventListener('storage', g); };
  }, [o, relire]);
  const poser = React.useCallback((choix) => {
    if (!o || !choix || !Array.isArray(choix.ordre)) return;
    const r = nouveauChoix(choixPlusRecent(ref.current, lire()), choix);
    ref.current = r; setBrut(r);
    try { o.save(o.cle, r); } catch (_) { /* l'écriture ratée garde le choix à l'écran ; il repartira au prochain geste */ }
  }, [o, lire]);
  return o ? { brut, poser } : null;
}

export default useCartes;
