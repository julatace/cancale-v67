// ── « SE CONNECTER AVEC DISCORD » (carte de la communauté, 20 octobre) ────────
// Julien : « utiliser mon compte Discord pour mettre son nom sur la carte ».
// OAuth2 de Discord, portée `identify` SEULE (le pseudo — jamais l'email, les
// serveurs ni les messages). Aucun jeton Discord n'est gardé : on lit le pseudo
// une fois, puis on l'oublie.
//   POST /api/compte?mode=discord-debut   (session VRM) → { url } + cookie nonce
//   GET  /api/compte?mode=discord          (retour de Discord) → 302 vers l'app,
//        avec dans le FRAGMENT (#) le pseudo et une PREUVE signée qui le lie au
//        compte VRM qui a demandé ; l'app la rend avec SA session
//        (action « discord-verifie »), et c'est la base qui range le pseudo.
// Le `state` se lie AU NAVIGATEUR (RFC 6749 §10.12, la leçon d'eBay du
// 6 octobre) : un nonce dans un cookie HttpOnly entre dans la signature, et le
// retour l'exige puis l'efface quoi qu'il arrive. La clé de signature dérive du
// secret Discord (serveur seulement, jamais envoyé au navigateur).
// Sans `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` : « pas configuré », dit.
import crypto from 'node:crypto';

export const DISCORD_REDIRECT = 'https://vrm.center/api/compte?mode=discord';
const ID = () => String(process.env.DISCORD_CLIENT_ID || '').trim();
const SECRET = () => String(process.env.DISCORD_CLIENT_SECRET || '').trim();
export const discordConfigure = () => /^\d{15,25}$/.test(ID()) && SECRET().length >= 16;

const VALIDITE_MS = 15 * 60 * 1000;
const COOKIE = 'vrm_discord_etat';
const NONCE_RE = /^[0-9a-f]{32}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const cookie = (v, age) => `${COOKIE}=${v}; Path=/api/; Max-Age=${age}; HttpOnly; Secure; SameSite=Lax`;
const lireCookie = (req) => {
  const m = new RegExp('(?:^|;\\s*)' + COOKIE + '=([^;]*)').exec(String(((req && req.headers) || {}).cookie || ''));
  const v = m ? m[1].trim() : '';
  return NONCE_RE.test(v) ? v : '';
};
const mac = (quoi, ...parts) => crypto.createHmac('sha256', 'vrm-discord|' + quoi + '|' + SECRET()).update(parts.map(String).join('|')).digest('hex').slice(0, 40);
const egal = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

export function signerEtat(owner, nonce, maintenant = Date.now()) {
  const o = String(owner).toLowerCase(), ts = maintenant.toString(36);
  return ts + '.' + o + '.' + mac('etat', o, ts, nonce);
}
export function lireEtat(state, nonce, maintenant = Date.now()) {
  if (!NONCE_RE.test(String(nonce || ''))) return null;
  const m = /^([0-9a-z]{6,12})\.([0-9a-f-]{36})\.([0-9a-f]{40})$/.exec(String(state || ''));
  if (!m || !UUID_RE.test(m[2]) || !SECRET()) return null;
  const age = maintenant - parseInt(m[1], 36);
  if (!(age >= -60000 && age <= VALIDITE_MS)) return null;
  return egal(mac('etat', m[2], m[1], nonce), m[3]) ? m[2] : null;
}
// La preuve rendue à l'app : le pseudo LU CHEZ DISCORD, lié au compte VRM.
export function signerPreuve(owner, pseudo, maintenant = Date.now()) {
  const ts = maintenant.toString(36);
  return ts + '.' + mac('preuve', String(owner).toLowerCase(), pseudo, ts);
}
export function lirePreuve(preuve, owner, pseudo, maintenant = Date.now()) {
  const m = /^([0-9a-z]{6,12})\.([0-9a-f]{40})$/.exec(String(preuve || ''));
  if (!m || !SECRET()) return false;
  const age = maintenant - parseInt(m[1], 36);
  if (!(age >= -60000 && age <= VALIDITE_MS)) return false;
  return egal(mac('preuve', String(owner).toLowerCase(), pseudo, m[1]), m[2]);
}
// Un pseudo Discord actuel : 2-32 caractères a-z 0-9 . _ (jamais « .. »). Un
// ancien compte « nom#1234 » n'a pas cette forme : on ne l'invente pas.
export const pseudoDiscordDe = (u) => {
  const n = String((u && u.username) || '').toLowerCase();
  const discr = String((u && u.discriminator) || '0');
  return (discr === '0' || discr === '') && /^[a-z0-9._]{2,32}$/.test(n) && !n.includes('..') ? n : null;
};

export async function debutDiscord(req, res, utilisateur) {
  if (!discordConfigure()) return res.status(503).json({ ok: false, erreur: 'non-configure', message: 'La connexion avec Discord n’est pas encore réglée sur VRM.' });
  const nonce = crypto.randomBytes(16).toString('hex');
  const state = signerEtat(utilisateur.id, nonce);
  res.setHeader('Set-Cookie', cookie(nonce, Math.round(VALIDITE_MS / 1000)));
  const url = 'https://discord.com/oauth2/authorize?' + new URLSearchParams({ client_id: ID(), response_type: 'code', scope: 'identify',
    redirect_uri: DISCORD_REDIRECT, state, prompt: 'consent' }).toString();
  return res.status(200).json({ ok: true, url });
}

const versApp = (res, frag) => { res.statusCode = 302; res.setHeader('Location', '/?tab=communaute#' + frag); return res.end(); };

export async function retourDiscord(req, res, f = fetch) {
  const nonce = lireCookie(req);
  res.setHeader('Set-Cookie', cookie('', 0));            // une seule fois, quoi qu'il arrive
  const q = req.query || {};
  if (q.error) return versApp(res, 'discord-erreur=annule');
  if (!discordConfigure()) return versApp(res, 'discord-erreur=non-configure');
  const owner = lireEtat(q.state, nonce);
  if (!owner) return versApp(res, 'discord-erreur=lien');
  const code = String(q.code || '');
  if (!/^[A-Za-z0-9_-]{10,100}$/.test(code)) return versApp(res, 'discord-erreur=lien');
  try {
    const t = await f('https://discord.com/api/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: ID(), client_secret: SECRET(), grant_type: 'authorization_code', code, redirect_uri: DISCORD_REDIRECT }).toString() });
    const jt = await t.json().catch(() => null);
    if (!t.ok || !jt || typeof jt.access_token !== 'string') return versApp(res, 'discord-erreur=discord');
    const u = await f('https://discord.com/api/users/@me', { headers: { Authorization: 'Bearer ' + jt.access_token } });
    const ju = await u.json().catch(() => null);
    if (!u.ok || !ju) return versApp(res, 'discord-erreur=discord');
    const pseudo = pseudoDiscordDe(ju);
    if (!pseudo) return versApp(res, 'discord-erreur=ancien');
    return versApp(res, 'discord=' + encodeURIComponent(pseudo) + '&preuve=' + encodeURIComponent(signerPreuve(owner, pseudo)));
  } catch (_) { return versApp(res, 'discord-erreur=discord'); }
}
