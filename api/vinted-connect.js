// api/vinted-connect.js
// CONNEXION D'UN COMPTE VINTED PAR TOKEN (façon Vinteer).
//
// Julien colle son token Vinted (récupéré via l'extension, bouton « Copier mon
// token ») dans l'app. Cet endpoint :
//   1. rafraîchit le token contre Vinted pour obtenir un access_token frais
//      (le refresh_token seul suffit ; si un access_token valide est fourni on
//      s'en sert directement, plus fiable) ;
//   2. décode le vinted_user_id depuis le JWT (claim "sub") ;
//   3. lit /api/v2/users/current pour récupérer le pseudo + l'id de profil ;
//   4. upsert la ligne dans Supabase "vinted_accounts".
//
// C'est le SEUL rôle de ce fichier : accéder au PROPRE compte de l'utilisateur
// avec SES PROPRES identifiants, pour lire SES ventes/achats. Aucune couche
// d'anonymisation / fingerprint : on ne cherche pas à masquer quoi que ce soit
// à Vinted, juste à connecter un compte proprement depuis l'app.

import { withOwnerAll, conflictTarget } from './_lib/owner.js';

const SUPABASE_URL = 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
// ⚠️ CLÉ DE SERVICE QUAND ELLE EXISTE. Ces routes tournent sur le serveur, sans
// vendeur connecté : à la seconde où la base est cloisonnée (RLS), la clé
// publique ne peut plus rien lire ni écrire et l'endpoint devient muet — c'est
// LE blocage qui empêchait d'activer le multi-vendeurs. On prend donc
// `SUPABASE_SERVICE_KEY` (variable d'environnement Vercel, jamais dans le
// dépôt) si elle est définie, et on retombe sur la clé publique tant qu'elle ne
// l'est pas : le comportement d'aujourd'hui reste identique.
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxnb254enJ6amNxdGhqdGJkcHpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1ODIyMjYsImV4cCI6MjA5NTE1ODIyNn0.QJQSKILJLEpbDvBP4w7xD-olxoUjX1H2rxrYdo63GWQ';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// Décode le payload d'un JWT (sans vérifier la signature).
function jwtPayload(token) {
  try {
    const p = String(token).split('.')[1];
    const json = Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(json);
  } catch { return {}; }
}

function readSetCookie(headers, name) {
  let list = [];
  try { if (typeof headers.getSetCookie === 'function') list = headers.getSetCookie(); } catch { /* ignore */ }
  if (!list.length) { const raw = headers.get('set-cookie'); if (raw) list = [raw]; }
  for (const c of list) {
    const m = new RegExp(`(?:^|,\\s*)${name}=([^;]+)`).exec(c);
    if (m) return decodeURIComponent(m[1]);
  }
  return null;
}

// Rafraîchit contre Vinted. Fonctionne avec le refresh_token seul ; l'access_token
// et l'anon_id (facultatifs) rendent l'appel plus fiable quand ils sont fournis.
async function refresh({ host, accessToken, refreshToken, anonId, csrfToken }) {
  const cookie = [
    accessToken ? `access_token_web=${accessToken}` : '',
    `refresh_token_web=${refreshToken}`,
    anonId ? `anon_id=${anonId}` : '',
  ].filter(Boolean).join('; ');
  const res = await fetch(`https://${host}/web/api/auth/refresh`, {
    method: 'POST',
    headers: {
      'Cookie': cookie,
      'User-Agent': UA,
      'Accept': 'application/json, text/plain, */*',
      'x-anon-id': anonId || '',
      'x-csrf-token': csrfToken || '',
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  if (!res.ok) return null;
  let json = {};
  try { json = await res.json(); } catch { json = {}; }
  const newAccess = json.access_token || readSetCookie(res.headers, 'access_token_web');
  const newRefresh = json.refresh_token || readSetCookie(res.headers, 'refresh_token_web') || refreshToken;
  if (!newAccess) return null;
  return { access_token: newAccess, refresh_token: newRefresh };
}

// Lit le profil Vinted (pseudo, id de profil, photo) avec un access_token.
async function fetchProfile({ host, accessToken, anonId, csrfToken }) {
  try {
    const res = await fetch(`https://${host}/api/v2/users/current`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': UA,
        'Accept': 'application/json, text/plain, */*',
        'x-anon-id': anonId || '',
        'x-csrf-token': csrfToken || '',
        'Cookie': [`access_token_web=${accessToken}`, anonId ? `anon_id=${anonId}` : ''].filter(Boolean).join('; '),
      },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.user || null;
  } catch { return null; }
}

async function upsertAccount(row) {
  // Multi-vendeurs : la clé d'unicité devient (owner, vinted_user_id) — deux
  // vendeurs peuvent très bien avoir lié le même compte Vinted.
  const res = await fetch(`${SUPABASE_URL}/rest/v1/vinted_accounts?on_conflict=${conflictTarget('vinted_user_id')}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(withOwnerAll(Array.isArray(row) ? row : [row])),
  });
  return res.ok;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST uniquement' }); return; }

  let { refreshToken, accessToken, anonId, csrfToken, domain } = req.body || {};
  refreshToken = (refreshToken || '').trim();
  accessToken = (accessToken || '').trim();
  anonId = (anonId || '').trim();
  csrfToken = (csrfToken || '').trim();

  if (!refreshToken && !accessToken) {
    res.status(400).json({ error: 'Colle ton token Vinted (refresh_token_web).' });
    return;
  }

  const host = (domain && /^www\.vinted\.(fr|com|it|de|be|es|nl|pl)$/.test(domain)) ? domain : 'www.vinted.fr';

  try {
    // 1) On veut un access_token valide. Si un access_token est fourni et pas
    //    encore expiré, on l'utilise ; sinon on rafraîchit via le refresh_token.
    let tokens = null;
    const now = Math.floor(Date.now() / 1000);
    const accExp = accessToken ? (jwtPayload(accessToken).exp || 0) : 0;
    if (accessToken && accExp - now > 120) {
      tokens = { access_token: accessToken, refresh_token: refreshToken || '' };
    }
    if (!tokens) {
      if (!refreshToken) { res.status(401).json({ error: 'Token expiré et pas de refresh_token pour le renouveler. Recopie ton token depuis l\'extension.' }); return; }
      tokens = await refresh({ host, accessToken, refreshToken, anonId, csrfToken });
      if (!tokens) {
        res.status(401).json({ error: 'Vinted a refusé ce token (expiré ou invalide). Reconnecte-toi sur vinted.fr en navigation privée, puis recopie le token via l\'extension.' });
        return;
      }
    }

    // 2) vinted_user_id = claim "account_id" du JWT (c'est CE champ que décode
    //    l'extension, cf. background.js). "sub" en secours. Clé unique de la table.
    const payload = jwtPayload(tokens.access_token);
    const vintedUserId = payload.account_id != null ? String(payload.account_id)
      : (payload.sub != null ? String(payload.sub) : null);
    if (!vintedUserId) {
      res.status(422).json({ error: 'Impossible de lire l\'identifiant du compte depuis le token.' });
      return;
    }

    // 3) Profil (pseudo) — best-effort, ne bloque pas la connexion si indisponible.
    const profile = await fetchProfile({ host, accessToken: tokens.access_token, anonId, csrfToken });
    const login = profile?.login || null;

    // 4) Upsert Supabase.
    const nowIso = new Date().toISOString();
    const row = {
      vinted_user_id: vintedUserId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || refreshToken || null,
      domain: host,
      updated_at: nowIso,
    };
    if (login) row.login = login;
    if (anonId) row.anon_id = anonId;
    if (csrfToken) row.csrf_token = csrfToken;
    const ok = await upsertAccount(row);
    if (!ok) { res.status(502).json({ error: 'Compte vérifié mais enregistrement Supabase impossible.' }); return; }

    res.status(200).json({
      ok: true,
      account: {
        vinted_user_id: vintedUserId,
        login,
        photo: profile?.photo?.url || null,
        domain: host,
      },
      // Le client persiste ces tokens en state (déjà fait côté Supabase ci-dessus).
      tokens: { access_token: tokens.access_token, refresh_token: tokens.refresh_token || refreshToken || '' },
    });
  } catch (err) {
    res.status(500).json({ error: 'Échec de la connexion à Vinted', detail: String(err) });
  }
}
