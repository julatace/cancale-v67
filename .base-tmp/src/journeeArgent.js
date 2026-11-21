// ═══════════════════════════════════════════════════════════════════════════
// LA CARTE « À VENIR / À VIRER » DE MA JOURNÉE (5 nov., chantier E1)
// ═══════════════════════════════════════════════════════════════════════════
// Avant : la carte n'existait que s'il y avait de l'argent À VENIR. Un vendeur
// qui n'avait que de l'argent À VIRER (le porte-monnaie Vinted, déjà versé) ne
// la voyait jamais — son argent disponible n'était dit nulle part sur l'écran.
// Règle : la carte s'affiche dès qu'UN des deux est connu et non nul. Chaque
// moitié a trois états (§5) :
//   'val'   un montant lu (ou un minimum, « au moins », le manque nommé) ;
//   'zero'  lu, et nul : la moitié ne s'affiche pas (pas de « 0 € » inutile) ;
//   'pasSu' pas lu : « — » et la raison, JAMAIS 0.
// AUCUNE règle d'argent ici : `aVenir` vient de `aVenirPour` (src/argentAVenir.js,
// la règle de la coque), `aVirer` du porte-monnaie Vinted lu (`walletEscrow.dispo`).
// Exécuté par scripts/audit-journee-argent.cjs.

// aVenir : { valeur | null, partiel, manque, raison } (`aVenirPour`) ;
// aVirer : { dispo, accounts } | null (`walletEscrow`, null = jamais lu).
export function carteArgentJournee({ aVenir, aVirer, enCours = false } = {}) {
  if (enCours) return null;
  const v = aVenir || {};
  const venir = v.valeur == null
    ? { etat: 'pasSu', valeur: null, partiel: false, raison: v.raison === 'encours' ? 'lecture…' : v.raison === 'partiel' ? 'pas tout lu' : 'pas lu' }
    : (v.valeur > 0 || v.partiel)
      ? { etat: 'val', valeur: v.valeur, partiel: !!v.partiel, manque: v.manque || [] }
      : { etat: 'zero', valeur: 0, partiel: false };
  const d = aVirer && Number.isFinite(Number(aVirer.dispo)) && Number(aVirer.accounts) > 0 ? Number(aVirer.dispo) : null;
  const virer = d == null ? { etat: 'pasSu', valeur: null, raison: 'porte-monnaie pas lu' } : d > 0 ? { etat: 'val', valeur: d } : { etat: 'zero', valeur: 0 };
  if (venir.etat !== 'val' && virer.etat !== 'val') return null;
  return { venir, virer, montrerVenir: venir.etat !== 'zero', montrerVirer: virer.etat !== 'zero' };
}
