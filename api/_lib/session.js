// ── QUI APPELLE ? (le vendeur connecté, prouvé par Supabase) ─────────────────
// Une route qui agit AU NOM d'un vendeur (payer, gérer son abonnement) ne croit
// jamais un identifiant envoyé par le navigateur : elle prend le jeton de
// session et demande à Supabase à qui il appartient. Même vérification que
// api/email-rattacher.js (§11, une règle) — ici partagée.
// Rend `{ id, email, emailConfirme }`, ou `null` si le jeton manque, est faux ou
// expiré, ou si Supabase n'a pas répondu (« pas su » n'ouvre aucune porte).
// `emailConfirme` : Supabase dit que l'adresse a été PROUVÉE (lien cliqué, ou
// confirmation automatique à l'inscription). Seule la session de l'extension
// s'en sert (api/compte.js) : elle ne fabrique jamais de session sur une
// adresse que la personne n'a pas prouvée.
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
    return { id, email: String((j && j.email) || ''), emailConfirme: !!(j && j.email_confirmed_at) };
  } catch (_) { return null; }
}

// La base sait-elle séparer les vendeurs ? 200 → oui · 400 (colonne absente) →
// non · le reste (522, délai) → on le suppose (filtrer sur le vendeur au pire
// fait échouer la lecture ; ne PAS filtrer mélangerait les boutiques).
let _cloisonnee = null;
export async function baseCloisonnee() {
  if (_cloisonnee !== null) return _cloisonnee;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?select=owner&limit=1`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } });
    if (r.ok) _cloisonnee = true;
    else if (r.status === 400) _cloisonnee = false;
    else return true;
  } catch (_) { return true; }
  return _cloisonnee;
}

// Une route qui touche aux comptes Vinted d'un vendeur exige SA session.
// Rend `{ id, email }`, ou `null` APRÈS avoir répondu 401.
export async function vendeurExige(req, res) {
  const u = await utilisateurDe(req);
  if (!u) { res.status(401).json({ erreur: 'session', message: 'Connecte-toi à VRM pour faire ça.' }); return null; }
  return u;
}

// Lit une table AU NOM du vendeur (son jeton, pas la clé de service) : RLS ne
// lui rend que SES lignes. Rend le tableau, ou `null` si la base n'a pas
// répondu ou a refusé (« pas su » n'ouvre aucune porte).
// Écrit AU NOM du vendeur (son jeton : RLS ne le laisse toucher qu'à SES
// lignes). Rend le nombre de lignes modifiées, ou `null` si la base n'a pas
// répondu ou a refusé — jamais un succès supposé.
export async function modifierCommeVendeur(req, chemin, corps) {
  const jeton = jetonDe(req);
  if (!jeton) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${chemin}`, {
      method: 'PATCH',
      headers: { apikey: ANON, Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(corps),
    });
    if (!r.ok) return null;
    const j = await r.json().catch(() => null);
    return Array.isArray(j) ? j.length : null;
  } catch (_) { return null; }
}

export async function lireCommeVendeur(req, chemin) {
  const jeton = jetonDe(req);
  if (!jeton) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${chemin}`, { headers: { apikey: ANON, Authorization: `Bearer ${jeton}` } });
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j) ? j : null;
  } catch (_) { return null; }
}
