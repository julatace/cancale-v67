// ── UNE PUBLICATION DATÉE N'EST RÉÉCRITE QUE SI ELLE CHANGE (22 nov., « je veux que tout soit beaucoup plus fluide ») ──────
// Les listes `vinted_masquer_ailleurs` et `vrm_retirer_partout` (lues par l'extension, jugées fraîches 48 h) étaient republiées
// à chaque passage avec une heure neuve (`at`) : chaque écriture rendait les écrans gardés périmés (src/ecransGardes.jsx), et
// Ventes, Achats, Ma journée étaient remontés — tout recalculé — à CHAQUE changement d'onglet (banc fluidite-generale).
// Règle : même contenu (hors `at`) et publiée il y a moins de `ageMs` ⇒ rien n'est écrit ; sinon, écrite.
// Module PUR (lire/écrire injectés) : scripts/audit-apres-finale-app.cjs l'exécute.
const sansHeure = (x) => { try { if (!x || typeof x !== 'object' || Array.isArray(x)) return JSON.stringify(x); const { at, ...r } = x; return JSON.stringify(r); } catch (_) { return ''; } };
export function publierSiNeuf(k, v, { lire, ecrire, maintenant = Date.now(), ageMs = 3600e3 } = {}) {
  let a = null; try { a = lire(k, null); } catch (_) { a = null; }
  const age = a && Number.isFinite(Number(a.at)) ? maintenant - Number(a.at) : null;
  if (a && v && sansHeure(a) === sansHeure(v) && age != null && age >= 0 && age < ageMs) return false;
  ecrire(k, v); return true;
}
