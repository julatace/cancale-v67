// ── /api/sante ────────────────────────────────────────────────────────────────
// Dit à l'application si le CÔTÉ SERVEUR est prêt pour le multi-vendeurs.
//
// Pourquoi cette route existe : les réglages qui décident si les emails, les
// rappels d'expédition et les notifications continueront de fonctionner une
// fois la base cloisonnée vivent dans Vercel, pas dans la base. Sans ce point
// de contrôle, on ne peut PAS savoir depuis l'app si la migration est sûre —
// et on le découvrirait au premier email perdu.
//
// ⚠️ Ne renvoie que des OUI/NON. Jamais une clé, jamais un identifiant, jamais
// une valeur d'environnement — cette route est publique.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.status(200).json({
    ok: true,
    // Clé de service : sans elle, plus aucune écriture serveur ne passe une fois RLS actif.
    serviceKey: !!process.env.SUPABASE_SERVICE_KEY,
    // Propriétaire des lignes écrites par le serveur (emails, rappels, notifications).
    owner: !!process.env.VRM_OWNER_UID,
    // L'assistant de rédaction (sans rapport avec le cloisonnement, mais c'est
    // le même écran de réglages qui le montre).
    ia: !!process.env.AI_API_KEY,
  });
}
