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

import './_lib/sans-bruit.js';
import { sbCle } from './_lib/cle.js';
import { vendeurExige } from './_lib/session.js';
import { repondreSansCleService } from './_lib/cle-service.js';
import { corsExtension } from './_lib/cors-extension.js';
import { accesVendeur } from './_lib/abonnement.js';
import { fetchAvecDelai } from './_lib/fetch-delai.js';   // (11 nov.) chaque appel sortant a un délai
// ⚠️⚠️ (9 nov., défaut #5, décision de Julien) C'EST ICI, ET SEULEMENT ICI,
//    QU'UN COMPTE VINTED NEUF SE RELIE. La migration 029 interdit à l'API de la
//    base (rôle `authenticated`) de créer une ligne `vinted_accounts` ou d'en
//    changer l'identité ; l'extension (5.332+) qui reçoit ce refus (42501
//    `vrm_vinted_preuve`) présente ici le jeton lu dans SON onglet Vinted
//    (`source: 'extension'`). Rien n'est rangé sans :
//      1. la session VRM du vendeur (le propriétaire vient du JETON, jamais du corps) ;
//      2. aucun AUTRE compte VRM qui porte déjà ce compte Vinted (sinon litige,
//         « contacte le support », noté chez le demandeur) ;
//      3. Vinted qui ACCEPTE le jeton (`/api/v2/users/current` rend le profil) —
//         un 401 est un refus, le reste (réseau, 403 anti-robot, 5xx) est « pas su »
//         et n'écrit rien non plus.
//    Le serveur ne reçoit que ce que l'extension rangeait déjà elle-même dans
//    `vinted_accounts` (mêmes jetons) ; pour l'extension il ne RENOUVELLE jamais
//    le jeton (cela ferait tourner le refresh_token et déconnecterait l'onglet).
// ⚠️⚠️ CETTE ROUTE ÉTAIT PUBLIQUE ET ÉCRIVAIT CHEZ LE PROPRIÉTAIRE DE
//    L'INSTALLATION (`withOwnerAll` = VRM_OWNER_UID). N'importe qui pouvait
//    coller un jeton Vinted et faire apparaître SON compte dans la boutique de
//    Julien — et un second vendeur qui s'en servait aurait rangé ses comptes
//    chez lui. Elle exige la session et range le compte chez CE vendeur
//    (audit de sécurité, 4 octobre — banc routes-ecriture.cjs).

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
  const res = await fetchAvecDelai(`https://${host}/web/api/auth/refresh`, {
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
// ⚠️ (9 nov., défaut #5) Rend un VERDICT, jamais un « non » supposé :
//    · `{ statut: 'ok', user }` — Vinted a accepté le jeton (il en vérifie la
//      signature) : c'est la PREUVE que l'`account_id` du jeton est le bon ;
//    · `{ statut: 'refuse' }`   — Vinted a répondu 401 (jeton faux, expiré, révoqué) ;
//    · `{ statut: 'pas_su' }`   — réseau, délai, 403 (anti-robot), 429, 5xx, réponse
//      illisible : Vinted n'a RIEN dit du jeton. « Pas su » ne vaut pas « oui ».
async function fetchProfile({ host, accessToken, anonId, csrfToken }) {
  const ctrl = new AbortController();
  const minuteur = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetchAvecDelai(`https://${host}/api/v2/users/current`, {
      signal: ctrl.signal,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': UA,
        'Accept': 'application/json, text/plain, */*',
        'x-anon-id': anonId || '',
        'x-csrf-token': csrfToken || '',
        'Cookie': [`access_token_web=${accessToken}`, anonId ? `anon_id=${anonId}` : ''].filter(Boolean).join('; '),
      },
    });
    if (res.status === 401) return { statut: 'refuse' };
    if (!res.ok) return { statut: 'pas_su', http: res.status };
    const json = await res.json().catch(() => null);
    const user = json && json.user;
    return user && typeof user === 'object' ? { statut: 'ok', user } : { statut: 'pas_su', http: res.status };
  } catch { return { statut: 'pas_su', http: 0 }; }
  finally { clearTimeout(minuteur); }
}

// Les AUTRES comptes VRM qui portent déjà ce compte Vinted (clé de service, un
// seul champ lu). `null` = pas su ⇒ rien n'est écrit.
async function autresProprietaires(vintedUserId, owner) {
  try {
    const r = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/vinted_accounts?vinted_user_id=eq.${encodeURIComponent(vintedUserId)}&select=owner`, { headers: { ...sbCle(SUPABASE_KEY) } });
    if (!r.ok) return null;
    const j = await r.json().catch(() => null);
    if (!Array.isArray(j)) return null;
    return j.filter((x) => x && x.owner && String(x.owner) !== String(owner)).length;
  } catch { return null; }
}

// Un litige se NOTE chez le vendeur qui demande (une ligne par compte Vinted ;
// jamais l'autre propriétaire, aucun jeton) : le support le retrouve.
async function noterLitige(owner, vintedUserId, source) {
  try {
    await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=owner,id`, {
      method: 'POST',
      headers: { ...sbCle(SUPABASE_KEY), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ id: `vrm_vinted_litige_${vintedUserId}`, owner, data: { vinted_user_id: vintedUserId, at: new Date().toISOString(), source: source === 'extension' ? 'extension' : 'app' } }]),
    });
  } catch { /* le refus est rendu de toute façon */ }
}

const MESSAGE_DEJA_RELIE = 'Ce compte Vinted est déjà relié à un autre compte VRM — contacte le support.';

async function upsertAccount(row, owner) {
  // Multi-vendeurs : la clé d'unicité devient (owner, vinted_user_id) — deux
  // vendeurs peuvent très bien avoir lié le même compte Vinted.
  const lignes = Array.isArray(row) ? row : [row];
  const res = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/vinted_accounts?on_conflict=owner,vinted_user_id`, {
    method: 'POST',
    headers: {
      ...sbCle(SUPABASE_KEY),
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(lignes.map((l) => ({ ...l, owner }))),
  });
  if (res.ok) return 'ok';
  // (11 nov., M50) 409 + 23505 : l'unicité globale de la 023 vient de voir un
  // AUTRE propriétaire (deux liaisons au même instant) — rien n'est écrasé.
  const t = res.status === 409 ? await res.text().catch(() => '') : '';
  return /23505/.test(t) ? 'deja_relie' : 'echec';
}

// (11 nov., M50 de la revue serveur, migration 042) « Déjà relié ailleurs ? »
// puis l'écriture SOUS UN MÊME VERROU, dans la base (`vrm_vinted_relier`) :
// deux vendeurs qui relient le même compte Vinted au même instant passaient tous
// les deux (contrôle puis upsert, pas atomiques). Rend 'ok' · 'deja_relie' ·
// 'echec' · `null` = fonction absente (042 pas passée) ⇒ le chemin d'avant.
async function relierAtomique(row, owner) {
  try {
    const r = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/rpc/vrm_vinted_relier`, {
      method: 'POST',
      headers: { ...sbCle(SUPABASE_KEY), 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_owner: owner, p_ligne: row }),
    });
    if (r.status === 404) return null;
    if (!r.ok) return 'echec';
    const v = await r.json().catch(() => null);
    return v === 'ok' || v === 'deja_relie' ? v : 'echec';
  } catch { return 'echec'; }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  // L'extension appelle d'une origine d'extension (Orion fait un préalable OPTIONS).
  if (corsExtension(req, res)) return;
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST uniquement' }); return; }
  const u = await vendeurExige(req, res);
  if (!u) return;
  // (7 nov.) Sans clé de service, la clé publique ne voit rien sous RLS : 503 dit, jamais « rien à faire ».
  if (repondreSansCleService(res)) return;
  // La base refuse toute écriture à qui n'a plus accès (027) : la clé de service
  // ne doit pas la contourner. « Pas su » (null) ne coupe pas (abonnement.js).
  if ((await accesVendeur(u.id)) === false) { res.status(402).json({ ok: false, raison: 'abonnement', error: "Ton abonnement VRM n'est plus actif." }); return; }

  let { refreshToken, accessToken, anonId, csrfToken, domain, source } = req.body || {};
  const str = (v) => (typeof v === 'string' ? v.trim() : '');
  refreshToken = str(refreshToken);
  accessToken = str(accessToken);
  anonId = str(anonId);
  csrfToken = str(csrfToken);
  const depuisExtension = source === 'extension';
  if ([refreshToken, accessToken, anonId, csrfToken].some((v) => v.length > 8000)) { res.status(413).json({ ok: false, raison: 'trop_long', error: 'Jeton trop long.' }); return; }

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
    if (!tokens && depuisExtension) {
      // Jamais de renouvellement pour l'extension : il ferait tourner le
      // refresh_token de l'onglet (déconnecté de Vinted). Elle réessaie quand
      // le navigateur aura le jeton neuf.
      res.status(400).json({ ok: false, raison: 'jeton_expire', error: 'Jeton Vinted expiré : il sera repris à la prochaine visite sur Vinted.' });
      return;
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
    //    l'extension, cf. background.js). "sub" en secours (app seulement).
    const payload = jwtPayload(tokens.access_token);
    const vintedUserId = payload.account_id != null ? String(payload.account_id)
      : (!depuisExtension && payload.sub != null ? String(payload.sub) : null);
    if (!vintedUserId || !/^[0-9]{1,20}$/.test(vintedUserId)) {
      res.status(422).json({ ok: false, raison: 'identifiant', error: 'Impossible de lire l\'identifiant du compte depuis le token.' });
      return;
    }

    // 3) Déjà relié à un AUTRE compte VRM ? Litige : rien n'est rangé, le
    //    support tranche (Vinted n'est même pas appelé). Pas su ⇒ rien non plus.
    const autres = await autresProprietaires(vintedUserId, u.id);
    if (autres === null) { res.status(503).json({ ok: false, raison: 'base', error: 'La base ne répond pas : rien n\'a été relié. Réessaie dans un instant.' }); return; }
    if (autres > 0) {
      await noterLitige(u.id, vintedUserId, depuisExtension ? 'extension' : 'app');
      res.status(409).json({ ok: false, raison: 'deja_relie', error: MESSAGE_DEJA_RELIE });
      return;
    }

    // 4) Profil : la PREUVE que ce jeton est bien un jeton Vinted de CE compte.
    // ⚠️ (9 nov., revue sécurité) Le jeton n'est qu'un JWT DÉCODÉ, jamais vérifié
    //    (sa signature appartient à Vinted). Un jeton fabriqué à la main avec un
    //    `exp` lointain et l'`account_id` d'un autre vendeur (visible sur son
    //    profil public) était rangé tel quel : le compte Vinted de quelqu'un
    //    d'autre « relié » chez soi (et, avec l'unicité de la 023, refusé ensuite
    //    à son vrai propriétaire). Seul Vinted peut dire si le jeton est vrai :
    //    il vérifie la signature ; un jeton accepté par Vinted porte un
    //    `account_id` écrit par Vinted. Sans profil lu, RIEN n'est rangé.
    //    (Le `user.id` du profil n'est PAS l'`account_id` — background.js — il
    //    ne se compare donc pas ; un `account_id` dans le profil, s'il y est, oui.)
    const verdict = await fetchProfile({ host, accessToken: tokens.access_token, anonId, csrfToken });
    const profile = verdict.statut === 'ok' ? verdict.user : null;
    if (verdict.statut === 'pas_su') {
      res.status(503).json({ ok: false, raison: 'vinted_muet', error: 'Vinted n\'a pas répondu : rien n\'a été relié. Réessaie plus tard.' });
      return;
    }
    if (!profile || (profile.account_id != null && String(profile.account_id) !== vintedUserId)) {
      res.status(401).json({ ok: false, raison: 'refuse', error: 'Vinted n\'a pas confirmé ce compte avec ce token. Reconnecte-toi sur vinted.fr, puis recopie le token via l\'extension.' });
      return;
    }
    const login = typeof profile.login === 'string' && profile.login ? profile.login : null;

    // 5) Upsert Supabase (clé de service, propriétaire = la session).
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
    let ecrit = await relierAtomique(row, u.id);
    if (ecrit === null) ecrit = await upsertAccount(row, u.id);
    if (ecrit === 'deja_relie') {
      await noterLitige(u.id, vintedUserId, depuisExtension ? 'extension' : 'app');
      res.status(409).json({ ok: false, raison: 'deja_relie', error: MESSAGE_DEJA_RELIE });
      return;
    }
    if (ecrit !== 'ok') { res.status(502).json({ ok: false, raison: 'ecriture', error: 'Compte vérifié mais enregistrement Supabase impossible.' }); return; }

    const account = { vinted_user_id: vintedUserId, login, photo: profile?.photo?.url || null, domain: host };
    // ⚠️⚠️ (12 nov., sécurité des comptes) AUCUN JETON VINTED NE REPART VERS LE
    //    NAVIGATEUR, extension ou page (revue de robustesse, H2) : ils sont rangés
    //    en base ci-dessus, la page n'a besoin que du compte (pseudo, photo, domaine).
    //    `scripts/audit-jetons-vinted.cjs` exécute la route et cherche les jetons.
    res.status(200).json({ ok: true, account });
  } catch (err) {
    res.status(500).json({ error: 'Échec de la connexion à Vinted' });
  }
}
