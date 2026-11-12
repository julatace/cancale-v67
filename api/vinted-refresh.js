import './_lib/sans-bruit.js';
import { sbCle } from './_lib/cle.js';
import { vendeurExige } from './_lib/session.js';
import { repondreSansCleService } from './_lib/cle-service.js';
import { fetchAvecDelai } from './_lib/fetch-delai.js';   // (11 nov.) chaque appel sortant a un délai
// api/vinted-refresh.js
//
// ⚠️⚠️ CETTE ROUTE ÉTAIT PUBLIQUE, ET ELLE RAFRAÎCHISSAIT TOUS LES COMPTES DE
//    TOUS LES VENDEURS. Plus rien ne l'appelle (voir plus bas : retirée exprès
//    en juillet, « un refresh en masse depuis l'IP de Vercel ressemble à du
//    multi-comptes piloté par un robot », après un compte bloqué) — mais
//    n'importe qui pouvait encore la déclencher en ouvrant son adresse, et la
//    réponse listait les identifiants Vinted de chacun. Elle exige désormais la
//    session d'un vendeur et ne touche QU'À SES comptes (audit de sécurité,
//    4 octobre — banc routes-ecriture.cjs).
// Rafraichit de facon CENTRALISEE les tokens Vinted de tous les comptes lies,
// puis les persiste dans Supabase. But : que Julien puisse consulter ses comptes
// depuis n'importe quel appareil SANS avoir a se reconnecter ni a repasser par
// l'extension - les autres applis Vinted font pareil (elles gardent la session
// vivante via le refresh_token).
//
// Appele :
//  - a l'ouverture de l'app (App.jsx, une fois au demarrage) ;
//  - par un cron Vercel (voir vercel.json) toutes les quelques heures, pour que
//    la session reste vivante meme quand l'app n'est pas ouverte.
//
// Point cle : on ne rafraichit QUE si l'access_token est expire (ou proche de
// l'expiration). Vinted fait tourner le refresh_token a chaque refresh (l'ancien
// est invalide), donc rafraichir inutilement multiplie les rotations et les
// risques de course entre appareils. On decode l'exp du JWT pour l'eviter.

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';   // (12 nov.) la base d’essai sur « Preview »
// ⚠️ CLÉ DE SERVICE QUAND ELLE EXISTE. Ces routes tournent sur le serveur, sans
// vendeur connecté : à la seconde où la base est cloisonnée (RLS), la clé
// publique ne peut plus rien lire ni écrire et l'endpoint devient muet — c'est
// LE blocage qui empêchait d'activer le multi-vendeurs. On prend donc
// `SUPABASE_SERVICE_KEY` (variable d'environnement Vercel, jamais dans le
// dépôt) si elle est définie, et on retombe sur la clé publique tant qu'elle ne
// l'est pas : le comportement d'aujourd'hui reste identique.
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxnb254enJ6amNxdGhqdGJkcHpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1ODIyMjYsImV4cCI6MjA5NTE1ODIyNn0.QJQSKILJLEpbDvBP4w7xD-olxoUjX1H2rxrYdo63GWQ';

// Marge : on rafraichit si le token expire dans moins de 15 min.
const REFRESH_MARGIN_S = 15 * 60;

// Decode l'exp (timestamp) d'un JWT sans verifier la signature.
function jwtExp(token) {
  try {
    const payload = token.split('.')[1];
    const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(json).exp || 0;
  } catch { return 0; }
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

// (11 nov., revue de sécurité) `domain` est une colonne que le vendeur écrit
// lui-même (RLS) : elle ne choisit qu'un site Vinted CONNU, jamais un hôte
// quelconque (le serveur aurait posté vers n'importe quelle adresse). Même liste
// que `vinted-connect`. Aucune redirection suivie, délai borné, comptes bornés.
export const HOTE_VINTED = /^www\.vinted\.(fr|com|it|de|be|es|nl|pl)$/;
export const hoteRefresh = (domain) => (typeof domain === 'string' && HOTE_VINTED.test(domain)) ? domain : 'www.vinted.fr';
const REFRESH_MAX_COMPTES = 25;
const REFRESH_DELAI_MS = 10000;
const REFRESH_PARALLELE = 4;
const REFRESH_BUDGET_MS = 40000;

async function refreshOne(acc) {
  const host = hoteRefresh(acc.domain);
  const cookie = [
    `access_token_web=${acc.access_token}`,
    acc.refresh_token ? `refresh_token_web=${acc.refresh_token}` : '',
    acc.anon_id ? `anon_id=${acc.anon_id}` : '',
  ].filter(Boolean).join('; ');
  const res = await fetchAvecDelai(`https://${host}/web/api/auth/refresh`, {
    method: 'POST',
    headers: {
      'Cookie': cookie,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'x-anon-id': acc.anon_id || '',
      'x-csrf-token': acc.csrf_token || '',
      'Content-Type': 'application/json',
    },
    body: '{}',
    redirect: 'manual',
    signal: AbortSignal.timeout(REFRESH_DELAI_MS),
  }).catch(() => null);
  if (!res || !res.ok) return null;
  let json = {};
  try { json = await res.json(); } catch { json = {}; }
  const newAccess = json.access_token || readSetCookie(res.headers, 'access_token_web');
  const newRefresh = json.refresh_token || readSetCookie(res.headers, 'refresh_token_web') || acc.refresh_token;
  if (!newAccess) return null;
  return { access_token: newAccess, refresh_token: newRefresh };
}

// Rend VRAI seulement si la base a confirmé. Vinted vient de CONSOMMER
// l'ancien refresh_token : une écriture ratée annoncée « refreshed » laissait le
// compte cassé sans un mot (revue du 17 octobre, `audit-routes-revue.cjs` F).
async function persist(acc, tokens, filtre) {
  try {
  const r = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/vinted_accounts?vinted_user_id=eq.${encodeURIComponent(acc.vinted_user_id)}${filtre}`, {
    method: 'PATCH',
    headers: { ...sbCle(SUPABASE_KEY), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ access_token: tokens.access_token, refresh_token: tokens.refresh_token, updated_at: new Date().toISOString() }),
  });
  return !!(r && r.ok);
  } catch (_) { return false; }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const u = await vendeurExige(req, res);
  if (!u) return;
  // (7 nov.) Sans clé de service, la clé publique ne voit rien sous RLS : 503 dit, jamais « rien à faire ».
  if (repondreSansCleService(res)) return;
  const filtre = `&owner=eq.${encodeURIComponent(u.id)}`;
  try {
    const listRes = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/vinted_accounts?select=*${filtre}`, {
      headers: { ...sbCle(SUPABASE_KEY) },
    });
    if (!listRes.ok) { res.status(502).json({ error: 'Lecture Supabase impossible' }); return; }
    const accounts = await listRes.json();
    if (!Array.isArray(accounts) || accounts.some(a => a.owner !== u.id)) { res.status(503).json({ error: "Propriété des comptes non confirmée. Aucun renouvellement effectué." }); return; }
    const now = Math.floor(Date.now() / 1000);
    const summary = [];
    // (11 nov., M39) Plusieurs comptes : REFRESH_PARALLELE à la fois (jamais tous
    // en série, la route dépassait son temps et la dernière écriture n'avait pas
    // lieu) et un budget : un compte pas commencé à temps est dit, jamais tu.
    const debut = Date.now();
    const un = async (acc, i) => {
      if (i >= REFRESH_MAX_COMPTES) return { id: acc.vinted_user_id, action: 'skip_trop_de_comptes' };
      if (!acc.refresh_token) return { id: acc.vinted_user_id, action: 'skip_no_refresh' };
      const exp = jwtExp(acc.access_token);
      if (exp && exp - now > REFRESH_MARGIN_S) return { id: acc.vinted_user_id, action: 'still_valid' };
      if (Date.now() - debut > REFRESH_BUDGET_MS) return { id: acc.vinted_user_id, action: 'skip_budget' };
      const tokens = await refreshOne(acc);
      if (tokens) return { id: acc.vinted_user_id, action: (await persist(acc, tokens, filtre)) ? 'refreshed' : 'refreshed_not_saved' };
      return { id: acc.vinted_user_id, action: 'refresh_failed' };
    };
    const resultats = new Array(accounts.length);
    let prochain = 0;
    const ouvrier = async () => { while (prochain < accounts.length) { const i = prochain++; resultats[i] = await un(accounts[i], i); } };
    await Promise.all(Array.from({ length: Math.min(REFRESH_PARALLELE, accounts.length) }, ouvrier));
    summary.push(...resultats);
    const nonRange = summary.some((x) => x.action === 'refreshed_not_saved');
    res.status(nonRange ? 502 : 200).json({ ok: !nonRange, count: accounts.length, summary });
  } catch (err) {
    res.status(500).json({ error: 'Echec du refresh global' });   // (12 nov.) jamais le détail interne
  }
}
