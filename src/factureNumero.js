// ════════════════════════════════════════════════════════════════════════════
// LE NUMÉRO DES FACTURES SAISIES À LA MAIN — CONTINU, JAMAIS RÉUTILISÉ (11 nov.)
// ════════════════════════════════════════════════════════════════════════════
// Revue de robustesse (métier, haute n° 3) : le numéro suivant était « le plus
// grand de l'année + 1 », calculé sur la LISTE ; supprimer la dernière facture
// redonnait son numéro à la suivante (deux factures différentes sous le même n°).
// La numérotation d'une facture est continue et un numéro émis reste pris : on le
// corrige par un avoir, jamais en le réutilisant.
//
// Le compteur (`vrm_factures_pris`, synchronisé) garde, par entreprise et par
// année, le plus grand numéro jamais émis. Il ne fait que MONTER (append-only) :
// une suppression le laisse où il est. Le suivant = max(compteur, liste) + 1.
// Règle PURE, exécutée par scripts/audit-robustesse-metier.cjs.
// ─────────────────────────────────────────────────────────────────────────────

const cle = (ent, annee) => `${ent || 'ent_1'}|${annee}`;
const rang = (numero, annee) => {
  const m = String(numero || '').match(/^(\d{4})-(\d+)$/);
  return m && Number(m[1]) === Number(annee) ? Number(m[2]) : null;
};

// `factures` : la liste ; `pris` : { 'ent|année': plus grand rang émis } ;
// `appartient(f)` : la facture est-elle de l'entreprise `ent` ?
export function prochainNumeroFacture({ factures, pris, ent, annee, appartient = () => true } = {}) {
  let max = Number((pris && pris[cle(ent, annee)]) || 0);
  if (!Number.isFinite(max) || max < 0) max = 0;
  for (const f of (Array.isArray(factures) ? factures : [])) {
    if (!f || !appartient(f)) continue;
    const n = rang(f.number, annee);
    if (n != null && n > max) max = n;
  }
  return `${annee}-${String(max + 1).padStart(6, '0')}`;
}

// Le compteur après l'émission (ou la suppression) de `numero` : jamais plus bas.
export function noterNumeroPris(pris, numero, ent) {
  const m = String(numero || '').match(/^(\d{4})-(\d+)$/);
  const base = (pris && typeof pris === 'object') ? pris : {};
  if (!m) return base;
  const k = cle(ent, Number(m[1])), n = Number(m[2]);
  return n > Number(base[k] || 0) ? { ...base, [k]: n } : base;
}
