// ═══════════════════════════════════════════════════════════════════════════
// LE SUIVI D'UN GESTE DÉPOSÉ (25 nov., ext. 5.452 `envoisurs` — Julien : « ça envoie pas bien les messages et les offres »)
// ═══════════════════════════════════════════════════════════════════════════
// Avant : après « Envoyer », l'app disait « Parti vers l'extension » et vidait le champ — alors que la commande n'était
// que DÉPOSÉE dans la file (`cmd_dist_*`). Un refus de Vinted, un plafond, un onglet absent ne se voyaient jamais : un
// « envoyé » faux. Désormais l'app RELIT la commande (src/aDistance.js `lireUneCommande`, projection scalaire) et dit
// son ÉTAT RÉEL, écrit par l'extension après la réponse LUE de Vinted :
//   attente (en file, ou « pas encore parti : <raison> » quand l'extension l'a remise en attente) · pris (en cours) ·
//   fait (Vinted l'a confirmé) · refusé (raison) · pas sûr (regarde avant de refaire, rien ne sera renvoyé) · périmé.
// Module PUR (aucune entrée/sortie) : la phrase vient d'ici, la lecture de src/agir/porte.js (`suivreCommande`).
export const SUIVI_TERMINES = ['fait', 'refuse', 'incertain', 'perimee', 'annulee'];

// `v` : undefined (pas encore relue) · null (lecture ratée : pas su) · { absente } · une vue `vueCommandeDistance`.
export function phraseSuivi(v) {
  if (v === undefined) return { etat: 'attente', cle: 'agir.suivi.attente', vars: {} };
  if (v === null || typeof v !== 'object' || v.absente) return { etat: 'passu', cle: 'agir.suivi.passu', vars: {} };
  const raison = typeof v.raison === 'string' ? v.raison.trim() : '';
  switch (v.etat) {
    case 'attente': return v.attend && raison ? { etat: 'attente', cle: 'agir.suivi.attend', vars: { raison } } : { etat: 'attente', cle: 'agir.suivi.attente', vars: {} };
    case 'pris': return { etat: 'pris', cle: 'agir.suivi.pris', vars: {} };
    case 'fait': return { etat: 'fait', cle: 'agir.suivi.fait', vars: {} };
    case 'incertain': return { etat: 'incertain', cle: 'agir.suivi.incertain', vars: {} };
    case 'perimee': return { etat: 'perimee', cle: 'agir.suivi.perimee', vars: {} };
    case 'annulee': return { etat: 'annulee', cle: 'agir.suivi.annulee', vars: {} };
    default: return raison ? { etat: 'refuse', cle: 'agir.suivi.refuse', vars: { raison } } : { etat: 'refuse', cle: 'agir.suivi.refuseSans', vars: {} };
  }
}
export const suiviTermine = (v) => !!(v && typeof v === 'object' && SUIVI_TERMINES.includes(v.etat));

// Le rythme de relecture : vite pendant les 2 premières minutes (l'extension prend la commande dans la seconde par le
// temps réel), puis toutes les 15 s, arrêté après 30 min (la file « À distance » garde la suite).
export function delaiSuivi(depuisMs) { return depuisMs < 120000 ? 3000 : depuisMs < 30 * 60000 ? 15000 : null; }
