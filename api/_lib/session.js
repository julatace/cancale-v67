// ── QUI APPELLE ? (le vendeur connecté, prouvé par Supabase) ─────────────────
// Une route qui agit AU NOM d'un vendeur (payer, gérer son abonnement) ne croit
// jamais un identifiant envoyé par le navigateur : elle prend le jeton de
// session et demande à Supabase à qui il appartient. Même vérification que
// api/email-rattacher.js (§11, une règle) — ici partagée.
// Rend `{ id, email }`, ou `null` si le jeton manque, est faux ou expiré, ou si
// Supabase n'a pas répondu (« pas su » n'ouvre aucune porte).
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const ANON = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxnb254enJ6amNxdGhqdGJkcHpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1ODIyMjYsImV4cCI6MjA5NTE1ODIyNn0.QJQSKILJLEpbDvBP4w7xD-olxoUjX1H2rxrYdo63GWQ';

export const jetonDe = (req) => String((req.headers && (req.headers.authorization || req.headers.Authorization)) || '').replace(/^Bearer\s+/i, '').trim();

export async function utilisateurDe(req) {
  const jeton = jetonDe(req);
  // Un JWT a trois morceaux ; tout le reste est refusé sans appel réseau.
  if (!jeton || jeton.split('.').length !== 3 || jeton.length > 4096) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${jeton}` } });
    if (!r.ok) return null;
    const j = await r.json();
    const id = String((j && j.id) || '');
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    return { id, email: String((j && j.email) || '') };
  } catch (_) { return null; }
}
