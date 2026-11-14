// ── L'APPEL DE BIENVENUE DE 15 MIN (14 nov., idée d'accueil 147) ─────────────
// Un compte PRO peut réserver un appel de 15 min avec Julien, depuis l'app. Aucun
// service payant intégré : un LIEN de réservation que Julien configure lui-même
// (Paramètres → Aide, visible du propriétaire de l'installation seul), rangé dans SA
// ligne `main` (`vrm_appel_bienvenue` = { lien, at }). Le serveur le relit avec la clé
// de service et ne le rend qu'à un compte dont le plan LU chez Stripe est « pro »
// (api/compte.js `mode=abonnement` → `appelBienvenue`). Champ vide ⇒ rien n'apparaît,
// nulle part. Le même contrôle du lien des deux côtés : `lienReservation` (recopié
// tel quel dans api/_lib/appel-bienvenue.js, vérifié par scripts/audit-accueil-reste.cjs).
// JS pur.

export const CLE_APPEL = 'vrm_appel_bienvenue';
export const LIEN_MAX = 300;

// <appel-lien-regle> — recopié TEL QUEL dans api/_lib/appel-bienvenue.js.
// Un lien https:// vers un hôte public (pas d'adresse IP, pas de localhost, pas
// d'identifiants dans l'adresse), 300 caractères au plus ; sinon '' (rien n'apparaît).
export function lienReservation(v) {
  const s = String(v == null ? '' : v).trim();
  if (!s || s.length > LIEN_MAX || /[\s"'<>\\]/.test(s)) return '';
  let u;
  try { u = new URL(s); } catch (_) { return ''; }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return '';
  const h = u.hostname.toLowerCase();
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(h) || /^\d+(\.\d+)+$/.test(h) || h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return '';
  return u.href;
}
// </appel-lien-regle>

export const lireAppel = (brut) => (brut && typeof brut === 'object' ? lienReservation(brut.lien) : '');
export const ecritureAppel = (lien, at = new Date().toISOString()) => ({ lien: lienReservation(lien), at });

// Ce que l'app montre : le lien seulement si le SERVEUR l'a rendu (il n'est rendu
// qu'à un compte Pro) et s'il passe la règle. Le propriétaire ne se réserve pas un
// appel à lui-même : son champ suffit.
export function appelVisible(abo) {
  if (!abo || typeof abo !== 'object' || abo.proprietaire === true || abo.plan !== 'pro') return '';
  return lienReservation(abo.appelBienvenue);
}
