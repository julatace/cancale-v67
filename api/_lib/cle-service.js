// ═══════════════════════════════════════════════════════════════════════════
// SANS CLÉ DE SERVICE, UNE ROUTE DU SERVEUR SE TAIT ET LE DIT (7 nov.)
// ═══════════════════════════════════════════════════════════════════════════
// Les routes qui tournent sans session de vendeur (cron, widget, e-mails
// entrants, SMS) ou qui écrivent pour lui lisent la base avec la clé de
// SERVICE. Elles retombaient, faute de mieux, sur la clé PUBLIQUE : sous RLS,
// cette clé ne voit AUCUNE ligne — le cron répondait « 0 vendeur, rien à
// faire » (200), le widget « clé invalide », comme si tout allait bien.
// « Rien lu » ne vaut pas « rien » : tant que `SUPABASE_SERVICE_KEY` manque,
// la route répond 503 avec la raison, et ne lit ni n'écrit rien.
// Tenu par scripts/audit-cle-service.cjs (EXÉCUTE chaque route sans la clé).
// ═══════════════════════════════════════════════════════════════════════════
export const cleServicePresente = (env = process.env) => !!String((env && env.SUPABASE_SERVICE_KEY) || '').trim();

// Rend VRAI quand la route doit s'arrêter (elle a déjà répondu 503).
export function repondreSansCleService(res, env = process.env) {
  if (cleServicePresente(env)) return false;
  res.setHeader?.('Cache-Control', 'no-store');
  res.status(503).json({
    ok: false,
    erreur: 'cle-service-absente',
    message: "Le serveur n'a pas sa clé de service (SUPABASE_SERVICE_KEY) : rien n'a été lu ni écrit. Ce n'est pas « rien à faire » — la configuration du serveur est incomplète.",
  });
  return true;
}
