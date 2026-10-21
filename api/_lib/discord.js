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

// Où revenir après Discord (20 oct.) : la carte (défaut) ou « Mon compte » (`.c.`).
// 21 oct. — LE TÉLÉPHONE : sur iPhone, l'app ajoutée à l'écran d'accueil n'a PAS
// les cookies de Safari, et l'app Discord renvoie le retour dans le navigateur
// par défaut. Le nonce en cookie manquait donc toujours : « lien invalide », et
// personne ne pouvait relier Discord depuis son téléphone. Le `state` porte
// maintenant le ticket lui-même (signé : il ne se change pas en route) :
//   · même navigateur (cookie = ticket) → comme avant, la preuve dans le fragment ;
//   · autre navigateur → la preuve est rangée côté serveur pour CE compte VRM,
//     sous l'empreinte du ticket ; l'app qui a lancé le geste (elle seule connaît
//     le ticket, et elle a la session du compte) la reprend (`discord-attente`).
// La preuve reste liée au compte VRM : un autre compte ne peut pas s'en servir.
export function signerEtat(owner, nonce, maintenant = Date.now(), ou = 'carte') {
  const o = String(owner).toLowerCase(), ts = maintenant.toString(36), c = ou === 'compte' ? 'c' : 'p';
  return ts + '.' + o + '.' + c + '.' + nonce + '.' + mac('etat2', o, ts, nonce, c);
}
export function lireEtatComplet(state, nonce, maintenant = Date.now()) {
  if (!SECRET()) return null;
  const s = String(state || '');
  const n2 = /^([0-9a-z]{6,12})\.([0-9a-f-]{36})\.([cp])\.([0-9a-f]{32})\.([0-9a-f]{40})$/.exec(s);
  if (n2) {
    if (!UUID_RE.test(n2[2])) return null;
    const age = maintenant - parseInt(n2[1], 36);
    if (!(age >= -60000 && age <= VALIDITE_MS)) return null;
    if (!egal(mac('etat2', n2[2], n2[1], n2[4], n2[3]), n2[5])) return null;
    return { owner: n2[2], ou: n2[3] === 'c' ? 'compte' : 'carte', ticket: n2[4], memeNavigateur: NONCE_RE.test(String(nonce || '')) && egal(nonce, n2[4]) };
  }
  // Forme d'avant (liens partis avant le déploiement) : le cookie reste exigé.
  if (!NONCE_RE.test(String(nonce || ''))) return null;
  const m = /^([0-9a-z]{6,12})\.([0-9a-f-]{36})\.(?:(c)\.)?([0-9a-f]{40})$/.exec(s);
  if (!m || !UUID_RE.test(m[2])) return null;
  const age = maintenant - parseInt(m[1], 36);
  if (!(age >= -60000 && age <= VALIDITE_MS)) return null;
  const attendu = m[3] ? mac('etat', m[2], m[1], nonce, 'compte') : mac('etat', m[2], m[1], nonce);
  return egal(attendu, m[4]) ? { owner: m[2], ou: m[3] ? 'compte' : 'carte', ticket: nonce, memeNavigateur: true } : null;
}
export function lireEtat(state, nonce, maintenant = Date.now()) {
  const e = lireEtatComplet(state, nonce, maintenant);
  return e ? e.owner : null;
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

export async function debutDiscord(req, res, utilisateur, corps) {
  if (!discordConfigure()) return res.status(503).json({ ok: false, erreur: 'non-configure', message: 'La connexion avec Discord n’est pas encore réglée sur VRM.' });
  const nonce = crypto.randomBytes(16).toString('hex');
  const state = signerEtat(utilisateur.id, nonce, Date.now(), corps && corps.ou === 'compte' ? 'compte' : 'carte');
  res.setHeader('Set-Cookie', cookie(nonce, Math.round(VALIDITE_MS / 1000)));
  const url = 'https://discord.com/oauth2/authorize?' + new URLSearchParams({ client_id: ID(), response_type: 'code', scope: 'identify',
    redirect_uri: DISCORD_REDIRECT, state, prompt: 'consent' }).toString();
  return res.status(200).json({ ok: true, url, ticket: nonce });
}

// Retour là où le geste a été lancé : la carte, ou Paramètres → Mon compte.
const versApp = (res, frag, ou = 'carte') => {
  res.statusCode = 302;
  res.setHeader('Location', ou === 'compte' ? '/?tab=settings&vue=compte#' + frag + '&ou=compte' : '/?tab=communaute#' + frag);
  return res.end();
};

export async function retourDiscord(req, res, f = fetch) {
  const nonce = lireCookie(req);
  res.setHeader('Set-Cookie', cookie('', 0));            // une seule fois, quoi qu'il arrive
  const q = req.query || {};
  const ouVu = /\.c\.(?:[0-9a-f]{32}\.)?[0-9a-f]{40}$/.test(String(q.state || '')) ? 'compte' : 'carte';   // seulement pour savoir OÙ dire l'erreur
  if (q.error) return versApp(res, 'discord-erreur=annule', ouVu);
  if (!discordConfigure()) return versApp(res, 'discord-erreur=non-configure', ouVu);
  const etat = lireEtatComplet(q.state, nonce);
  if (!etat) return versApp(res, 'discord-erreur=lien', ouVu);
  const owner = etat.owner, ou = etat.ou;
  const code = String(q.code || '');
  if (!/^[A-Za-z0-9_-]{10,100}$/.test(code)) return versApp(res, 'discord-erreur=lien', ou);
  try {
    const t = await f('https://discord.com/api/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: ID(), client_secret: SECRET(), grant_type: 'authorization_code', code, redirect_uri: DISCORD_REDIRECT }).toString() });
    const jt = await t.json().catch(() => null);
    if (!t.ok || !jt || typeof jt.access_token !== 'string') return versApp(res, 'discord-erreur=discord', ou);
    const u = await f('https://discord.com/api/users/@me', { headers: { Authorization: 'Bearer ' + jt.access_token } });
    const ju = await u.json().catch(() => null);
    if (!u.ok || !ju) return versApp(res, 'discord-erreur=discord', ou);
    const pseudo = pseudoDiscordDe(ju);
    if (!pseudo) return versApp(res, 'discord-erreur=ancien', ou);
    const frag = 'discord=' + encodeURIComponent(pseudo) + '&preuve=' + encodeURIComponent(signerPreuve(owner, pseudo));
    if (etat.memeNavigateur) return versApp(res, frag, ou);
    // Autre navigateur (téléphone : app Discord → Safari) : rangé pour l'app qui a lancé.
    // ⚠️ 21 oct. (revue de sécurité) : sans le cookie, RIEN ne prouve que ce
    // navigateur est celui de la personne qui a lancé le geste — quelqu'un qui
    // envoyait SON lien à une autre personne récupérait le pseudo vérifié de
    // celle-ci (la preuve était reprise d'office par l'app de l'expéditeur).
    // Un CODE à 6 chiffres, montré ICI seulement, doit être retapé dans l'app
    // qui a lancé : celui qui consent chez Discord est celui qui le retape.
    // Et la page ne porte plus la preuve quand elle est rangée (elle aurait
    // dispensé du code).
    const codeMontre = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
    const range = await rangerAttente(owner, etat.ticket, pseudo, ou, f, codeMontre);
    return pageAilleurs(res, range, frag, ou, codeMontre);
  } catch (_) { return versApp(res, 'discord-erreur=discord', ou); }
}

// ── La preuve en attente (retour arrivé dans un AUTRE navigateur) ─────────────
const SB_URL = () => process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const SERVICE = () => String(process.env.SUPABASE_SERVICE_KEY || '');
export const DISCORD_ATTENTE_ID = 'discord_attente';
const empreinte = (t) => crypto.createHash('sha256').update('vrm-discord-ticket|' + String(t)).digest('hex');
const empreinteCode = (t, c) => crypto.createHash('sha256').update('vrm-discord-code|' + String(t) + '|' + String(c)).digest('hex');
export const ESSAIS_CODE = 5;
const CODE_RE = /^\d{6}$/;
const enTetesService = () => { const k = SERVICE(); return k.startsWith('eyJ') ? { apikey: k, Authorization: 'Bearer ' + k } : { apikey: k }; };

export async function rangerAttente(owner, ticket, pseudo, ou, f = fetch, code = '') {
  if (!SERVICE() || !UUID_RE.test(String(owner)) || !NONCE_RE.test(String(ticket)) || !CODE_RE.test(String(code))) return false;
  try {
    const r = await f(SB_URL() + '/rest/v1/app_data?on_conflict=owner,id', {
      method: 'POST',
      headers: { ...enTetesService(), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ owner, id: DISCORD_ATTENTE_ID, data: { v: 2, h: empreinte(ticket), c: empreinteCode(ticket, code), essais: 0, discord: pseudo, preuve: signerPreuve(owner, pseudo), ou, at: new Date().toISOString() } }]),
    });
    return !!(r && r.ok);
  } catch (_) { return false; }
}

// POST /api/compte?mode=discord-attente { ticket } (session) : l'app qui a lancé
// le geste reprend la preuve. Trois états : prête · pas encore · pas su (503).
export async function attenteDiscord(req, res, utilisateur, corps, f = fetch, maintenant = Date.now()) {
  const ticket = String((corps && corps.ticket) || '');
  if (!NONCE_RE.test(ticket)) return res.status(400).json({ ok: false, erreur: 'ticket' });
  if (!SERVICE()) return res.status(503).json({ ok: false, erreur: 'pas-su' });
  const owner = String(utilisateur.id).toLowerCase();
  if (!UUID_RE.test(owner)) return res.status(400).json({ ok: false, erreur: 'session' });
  let rows;
  try {
    const r = await f(SB_URL() + '/rest/v1/app_data?id=eq.' + DISCORD_ATTENTE_ID + '&owner=eq.' + owner + '&select=data', { headers: enTetesService() });
    if (!r || !r.ok) return res.status(503).json({ ok: false, erreur: 'pas-su' });
    rows = await r.json();
  } catch (_) { return res.status(503).json({ ok: false, erreur: 'pas-su' }); }
  const d = Array.isArray(rows) && rows[0] && rows[0].data;
  const age = d ? maintenant - Date.parse(d.at || '') : NaN;
  if (!d || !egal(String(d.h || ''), empreinte(ticket)) || !(age >= -60000 && age <= VALIDITE_MS) || typeof d.c !== 'string') return res.status(200).json({ ok: true, pret: false });
  const ligne = SB_URL() + '/rest/v1/app_data?id=eq.' + DISCORD_ATTENTE_ID + '&owner=eq.' + owner;
  const effacer = async () => { try { await f(ligne, { method: 'DELETE', headers: { ...enTetesService(), Prefer: 'return=minimal' } }); } catch (_) {} };
  // Le code montré dans l'autre navigateur : sans lui, la preuve ne sort pas.
  const code = String((corps && corps.code) || '').replace(/\D/g, '');
  if (!code) return res.status(200).json({ ok: true, pret: false, code: 'requis' });
  const essais = Number(d.essais) || 0;
  if (!CODE_RE.test(code) || !egal(d.c, empreinteCode(ticket, code))) {
    const n = essais + 1;
    if (n >= ESSAIS_CODE) { await effacer(); return res.status(200).json({ ok: true, pret: false, code: 'epuise' }); }
    // L'essai est compté AVANT de répondre (comparer-et-échanger) : sans écriture
    // confirmée, pas de nouvel essai — sinon deviner le code serait illimité.
    try {
      const r = await f(ligne + '&data->>essais=eq.' + essais, { method: 'PATCH',
        headers: { ...enTetesService(), 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({ data: { ...d, essais: n } }) });
      const j = r && r.ok ? await r.json().catch(() => null) : null;
      if (!Array.isArray(j) || j.length !== 1) return res.status(503).json({ ok: false, erreur: 'pas-su' });
    } catch (_) { return res.status(503).json({ ok: false, erreur: 'pas-su' }); }
    return res.status(200).json({ ok: true, pret: false, code: 'faux', restants: ESSAIS_CODE - n });
  }
  await effacer();
  return res.status(200).json({ ok: true, pret: true, discord: String(d.discord || ''), preuve: String(d.preuve || ''), ou: d.ou === 'compte' ? 'compte' : 'carte' });
}

// La page vue dans l'AUTRE navigateur : elle dit de revenir dans VRM. Si ce
// navigateur a, lui aussi, une session VRM du même compte, « Ouvrir ici » finit
// le geste (la preuve est liée au compte). Aucun script, une politique stricte.
function pageAilleurs(res, range, frag, ou, code) {
  // Rangée : le lien n'ouvre que VRM (sans la preuve) — c'est le code qui la libère.
  // Pas rangée : le lien porte la preuve, liée au compte VRM qui a demandé (seule
  // une session de CE compte peut s'en servir).
  const brut = range ? (ou === 'compte' ? '/?tab=settings&vue=compte' : '/?tab=communaute')
    : (ou === 'compte' ? '/?tab=settings&vue=compte#' + frag + '&ou=compte' : '/?tab=communaute#' + frag);
  const lien = brut.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const codeLu = range && /^\d{6}$/.test(String(code)) ? String(code).slice(0, 3) + ' ' + String(code).slice(3) : '';
  const titre = range ? 'Discord vérifié — retourne dans VRM' : 'Presque fini';
  const texte = range
    ? 'Reviens dans l’application VRM (l’écran d’accueil de ton téléphone) et tape ce code. Ne le donne à personne : il relie ce compte Discord au compte VRM qui l’a demandé.'
    : 'VRM n’a pas pu le noter pour ton application. Ouvre le lien ci-dessous ; si ça ne marche pas, relance « Se connecter avec Discord » depuis VRM.';
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'");
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.end('<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>VRM · Discord</title>'
    + '<style>:root{color-scheme:light dark}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F4F6FA;color:#10151B;font:16px/1.5 -apple-system,system-ui,sans-serif;padding:16px}'
    + '@media (prefers-color-scheme:dark){body{background:#07090D;color:#E8ECF2}.c{background:#10141B;border-color:#1E2430}}'
    + '.c{max-width:420px;background:#fff;border:1px solid #E3E7EE;border-radius:12px;padding:28px 24px;box-shadow:0 1px 2px rgba(0,0,0,.06),0 12px 32px rgba(0,0,0,.08)}'
    + 'h1{font-size:20px;margin:0 0 10px}p{margin:0 0 20px;opacity:.85}.code{font:700 34px/1.2 ui-monospace,Menlo,monospace;letter-spacing:4px;margin:0 0 20px}a{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 18px;border-radius:8px;background:#2458E6;color:#fff;text-decoration:none;font-weight:600}</style></head>'
    + '<body><div class="c" data-discord-ailleurs="' + (range ? 'range' : 'pas-range') + '"><h1>' + titre + '</h1><p>' + texte + '</p>' + (codeLu ? '<div class="code" data-discord-code="">' + codeLu + '</div>' : '') + '<a href="' + lien + '">Ouvrir VRM ici</a></div></body></html>');
  return res;
}
