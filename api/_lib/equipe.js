// ── LE MODE ÉQUIPE, CÔTÉ SERVEUR (api/compte.js?mode=equipe) ─────────────────
// Le vendeur invite un aide qui prépare les colis (migration 016). Toutes les
// garanties vivent dans la BASE : les fonctions `vrm_equipe_*` prennent
// l'identité dans le jeton (`auth.uid()`), jamais dans un paramètre, et RLS ne
// laisse lire au membre que la liste blanche des lignes de colis. Cette route
// ne fait que relayer, AVEC LE JETON DE L'APPELANT (jamais la clé de service) :
//   GET                          → { ok, equipe, invitations, membreDe, aBoutique }
//   POST { action: 'inviter', email }
//   POST { action: 'accepter' | 'revoquer' | 'quitter', id }
// TROIS ÉTATS, JAMAIS DEUX :
//   · 200 `ok: true`                 — lu / fait ;
//   · 503 `erreur: 'non-installe'`   — la base n'a pas la 016 (fonction absente,
//     PGRST202) : « le mode équipe n'est pas encore activé sur ta base », jamais
//     une erreur brute ni une « équipe vide » ;
//   · 503 `erreur: 'pas-su'`         — la base n'a pas répondu : rien n'est
//     affirmé (ni « aucune invitation », ni « refusée ») ;
//   · 400 `erreur: <raison>`         — un refus RÉEL de la base, dit en clair.
// `aBoutique` : l'appelant a-t-il AU MOINS un compte Vinted à lui ? (lu avec son
// jeton : RLS ne rend que les siens). Sert à l'aiguillage de l'app — un aide
// sans boutique arrive directement sur les colis de l'équipe. `null` = pas su.
import { jetonDe } from './session.js';
import { sbCle } from './cle.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const ANON = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxnb254enJ6amNxdGhqdGJkcHpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1ODIyMjYsImV4cCI6MjA5NTE1ODIyNn0.QJQSKILJLEpbDvBP4w7xD-olxoUjX1H2rxrYdo63GWQ';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const EQUIPE_NON_INSTALLE = "Le mode équipe n'est pas encore activé sur ta base.";
export const EQUIPE_PAS_SU = "Je n'ai pas pu joindre la base — rien n'a changé. Réessaie dans un instant.";
// Les refus de `vrm_equipe_inviter` (raison → phrase). Une raison inconnue se
// dit telle quelle plutôt que d'être maquillée en succès.
const RAISONS = {
  session: 'Connecte-toi à VRM pour faire ça.',
  abonnement: "Ton abonnement n'est pas actif : tu ne peux pas inviter quelqu'un pour l'instant.",
  email: "Cette adresse email n'est pas valide.",
  soi: "C'est ta propre adresse : invite l'adresse de la personne qui t'aide.",
  plafond: '5 personnes au plus dans ton équipe (invitations comprises). Révoques-en une pour en inviter une autre.',
};

// Un appel de fonction de la base, au nom de l'appelant.
// `{ etat: 'ok', data }` · `{ etat: 'absent' }` (pas de 016) · `{ etat: 'passu' }`.
// `auth` : les en-têtes d'identité — le jeton de l'appelant, ou la clé de
// service pour l'effacement (`sbCle` : une clé `sb_secret_` ne part jamais en
// `Authorization`).
const commeAppelant = (jeton) => ({ apikey: ANON, Authorization: `Bearer ${jeton}` });
export async function rpcEquipe(nom, args, auth) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nom}`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify(args || {}),
    });
    const texte = await r.text().catch(() => '');
    if (r.status === 404 || /PGRST202/.test(texte)) return { etat: 'absent' };
    if (!r.ok) return { etat: 'passu', status: r.status };
    let data;
    try { data = texte === '' ? null : JSON.parse(texte); } catch (_) { return { etat: 'passu' }; }
    return { etat: 'ok', data };
  } catch (_) { return { etat: 'passu' }; }
}

async function aUneBoutique(jeton) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/vinted_accounts?select=vinted_user_id&limit=1`, { headers: { apikey: ANON, Authorization: `Bearer ${jeton}` } });
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j) ? j.length > 0 : null;
  } catch (_) { return null; }
}

const tableau = (v) => (Array.isArray(v) ? v : null);

export async function routeEquipe(req, res, { utilisateur, corps }) {
  const jeton = jetonDe(req);
  const dire = (code, c) => res.status(code).json(c);
  const nonInstalle = () => dire(503, { ok: false, erreur: 'non-installe', message: EQUIPE_NON_INSTALLE });
  const pasSu = () => dire(503, { ok: false, erreur: 'pas-su', message: EQUIPE_PAS_SU });
  if (!utilisateur || !jeton) return dire(401, { ok: false, erreur: 'session', message: RAISONS.session });

  if (req.method === 'GET') {
    const [l, b] = await Promise.all([rpcEquipe('vrm_equipe_lister', {}, commeAppelant(jeton)), aUneBoutique(jeton)]);
    if (l.etat === 'absent') return nonInstalle();
    if (l.etat !== 'ok' || !l.data || typeof l.data !== 'object') return pasSu();
    const equipe = tableau(l.data.equipe), invitations = tableau(l.data.invitations), membreDe = tableau(l.data.membre_de);
    if (!equipe || !invitations || !membreDe) return pasSu();
    return dire(200, { ok: true, equipe, invitations, membreDe, aBoutique: b });
  }

  const action = String((corps && corps.action) || '');
  if (action === 'inviter') {
    const email = String((corps && corps.email) || '').trim().toLowerCase();
    if (!email || email.length > 260) return dire(400, { ok: false, erreur: 'email', message: RAISONS.email });
    const r = await rpcEquipe('vrm_equipe_inviter', { p_email: email }, commeAppelant(jeton));
    if (r.etat === 'absent') return nonInstalle();
    if (r.etat !== 'ok' || !r.data || typeof r.data !== 'object') return pasSu();
    if (r.data.ok === true) return dire(200, { ok: true, id: r.data.id, statut: r.data.statut, deja: r.data.deja === true });
    const raison = String(r.data.raison || 'inconnue');
    return dire(raison === 'session' ? 401 : 400, { ok: false, erreur: raison, message: RAISONS[raison] || `La base a refusé l'invitation (${raison}).` });
  }
  if (action === 'accepter' || action === 'revoquer' || action === 'quitter') {
    const id = String((corps && corps.id) || '');
    if (!UUID_RE.test(id)) return dire(400, { ok: false, erreur: 'id', message: "Cette invitation n'existe pas." });
    const fn = action === 'accepter' ? 'vrm_equipe_accepter' : 'vrm_equipe_revoquer';
    const r = await rpcEquipe(fn, { p_id: id }, commeAppelant(jeton));
    if (r.etat === 'absent') return nonInstalle();
    if (r.etat !== 'ok' || typeof r.data !== 'boolean') return pasSu();
    if (r.data) return dire(200, { ok: true });
    const message = action === 'accepter'
      ? "Je n'ai pas pu accepter : l'invitation a été retirée, ou ton adresse email n'est pas encore confirmée (ouvre le lien de confirmation reçu à l'inscription)."
      : "Rien n'a changé : cette invitation n'existe plus ou a déjà été retirée.";
    return dire(409, { ok: false, erreur: 'refuse', message });
  }
  return dire(400, { ok: false, erreur: 'action', message: 'Action inconnue.' });
}

// « Fermer mon compte » : ses invitations, comme vendeur ET comme membre (clé de
// service). Rend le nombre effacé, 0 si la base n'a pas la 016 (aucune table,
// rien à effacer), ou `null` si la base n'a pas répondu.
export async function effacerEquipe(owner, SERVICE) {
  if (!UUID_RE.test(String(owner || ''))) return null;
  if (!SERVICE) return null;
  const r = await rpcEquipe('vrm_equipe_effacer', { p_owner: owner }, sbCle(SERVICE));
  if (r.etat === 'absent') return 0;
  if (r.etat !== 'ok') return null;
  const n = Number(r.data);
  return Number.isFinite(n) ? n : null;
}
