// ════════════════════════════════════════════════════════════════════════════
// LES VENTES SAISIES À LA MAIN (ancien écran Ventes) — UN ACHAT INCONNU N'EST
// PAS UN ACHAT À 0 € (11 nov.)
// ════════════════════════════════════════════════════════════════════════════
// Revue de robustesse (métier, haute n° 2, moyennes n° 9-10) : un N° du lot
// absent du catalogue, ou le champ achat vide, donnait `buy = 0` ⇒ bénéfice =
// prix de vente (un achat à 0 € inventé, §5), sommé dans « Bénéf. » présenté
// complet. Maintenant :
//   • le prix d'achat d'une vente est CONNU seulement si chaque N° du lot est au
//     catalogue avec un prix lisible, ou (aucun N° au catalogue) tapé lisible ;
//     sinon `null` — « pas su », jamais 0 ;
//   • le bénéfice se somme sur les ventes au coût connu, et dit la couverture
//     (« sur N ventes sur M »).
// Règle PURE, exécutée par scripts/audit-robustesse-metier.cjs.
// ─────────────────────────────────────────────────────────────────────────────
import { centimes } from './beneficePaire.js';

const cts = (v) => {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) : null;
  return centimes(String(v).replace(/[\s €]/g, ''));
};

// Le prix d'achat d'une vente saisie (euros) ou `null` (pas su).
export function achatVenteManuelle(pids, catalog, tape) {
  const ids = (Array.isArray(pids) ? pids : []).map((x) => String(x).trim()).filter(Boolean);
  const cat = Array.isArray(catalog) ? catalog : [];
  const trouves = ids.map((id) => cat.find((x) => x && String(x.id) === id) || null);
  if (trouves.some(Boolean)) {
    if (trouves.some((x) => !x)) return null;                       // un N° du lot introuvable
    let s = 0;
    for (const x of trouves) { const c = cts(x.buyPrice); if (c == null) return null; s += c; }
    return s / 100;
  }
  const c = cts(tape);
  return c == null ? null : c / 100;
}

// Le bénéfice d'UNE vente (euros) ou `null` si l'achat ou la vente n'est pas su.
export function beneficeVenteManuelle(v) {
  const a = cts(v && v.buyPrice), p = cts(v && v.sellPrice);
  if (a == null || p == null || (v && (v.buyPrice === '' || v.buyPrice == null))) return null;
  return (p - a) / 100;
}

// Les totaux d'une liste : CA (ventes au prix lu), bénéfice des ventes au coût
// connu, et la couverture.
export function totauxVentesManuelles(ventes) {
  let ca = 0, ben = 0, n = 0, nConnus = 0;
  for (const v of (Array.isArray(ventes) ? ventes : [])) {
    if (!v) continue;
    n++;
    const p = cts(v.sellPrice); if (p != null) ca += p;
    const b = beneficeVenteManuelle(v);
    if (b != null) { ben += Math.round(b * 100); nConnus++; }
  }
  return { ca: ca / 100, benefice: nConnus ? ben / 100 : null, n, nConnus };
}
