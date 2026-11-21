// ── EN-TÊTES SUPABASE CÔTÉ SERVEUR, QUEL QUE SOIT LE FORMAT DE CLÉ ──────────
// Supabase a deux familles de clés : les anciennes (`anon`, `service_role`) sont
// des JWT (« eyJ… ») ; les nouvelles (`sb_publishable_…`, `sb_secret_…`) n'en
// sont PAS. Documentation Supabase : une clé `sb_` ne doit JAMAIS partir dans
// `Authorization: Bearer …` — la base tente de la lire comme un JWT et refuse.
// Mesuré le 30 septembre : le tableau de bord de Julien propose d'abord la
// nouvelle clé secrète ; collée telle quelle dans SUPABASE_SERVICE_KEY, chaque
// route aurait répondu « Invalid JWT » — emails, rappels, widget muets.
// ⇒ `apikey` toujours ; `Authorization` seulement pour une clé JWT (la
// passerelle Supabase complète elle-même le reste).
export const sbCle = (cle) => {
  const k = String(cle || '');
  return k.startsWith('eyJ') ? { apikey: k, Authorization: `Bearer ${k}` } : { apikey: k };
};
