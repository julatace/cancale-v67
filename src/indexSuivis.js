// (24 nov., vitesse) n° de suivi → la PREMIÈRE ligne de `tracking` qui le porte (`suiviDeLigne`, la règle de
// api/_lib/suivi-colis.js), gardé par liste (WeakMap : une liste neuve, un index neuf ; rien ne survit à la liste).
// Lu par `emailDuSuivi` (src/ecrans/Comptabilite.jsx) : avant, chaque appel relisait toute la liste et re-normalisait chaque
// n° (sujet compris) — le coût grandissait comme ventes × e-mails de suivi. Contrôle : scripts/tests/index-suivis.test.mjs.
import { suiviDeLigne } from '../api/_lib/suivi-colis.js';

const INDEX = new WeakMap();
export function indexSuivis(tracking) {
  if (!Array.isArray(tracking)) return new Map();
  let m = INDEX.get(tracking);
  if (m) return m;
  m = new Map();
  for (const t of tracking) { if (!t) continue; const k = suiviDeLigne(t); if (k && !m.has(k)) m.set(k, t); }
  INDEX.set(tracking, m);
  return m;
}
