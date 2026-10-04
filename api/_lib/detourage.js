// ── DÉTOURAGE PHOTOROOM : LE SERVEUR (mode `detourage` de api/ai.js) ─────────
// Julien, 4 octobre : « intègre l'API de Photoroom pour le détourage des photos
// avant chaque poste ». L'ancienne route (api/detourage.js, 25 septembre) a été
// retirée le 26 pour redescendre à 12 fonctions Vercel — et elle n'avait ni
// session, ni cache, ni plafond : la clé de Julien se serait dépensée sans
// limite, et la même photo aurait été payée à chaque publication.
//
// Ce qui la borde maintenant, et chaque point a une raison :
//   • SESSION + ABONNEMENT exigés : la clé du serveur est payée par Julien, à
//     l'image (~0,02 $). Personne d'anonyme ne la dépense (leçon de /api/ai).
//   • RÉSERVÉ AU PROPRIÉTAIRE par défaut (`VRM_OWNER_UID`) : envoyer les photos
//     d'un autre vendeur à un tiers suppose que Photoroom soit listé comme
//     sous-traitant et que Julien accepte d'en payer le coût. `PHOTOROOM_POUR=tous`
//     l'ouvre, sur SA décision.
//   • UN CACHE PAR EMPREINTE DES OCTETS (SHA-256) : on ne paie jamais deux fois la
//     même photo. L'empreinte est une IDENTITÉ exacte (§5), jamais un titre ; le
//     serveur la RECALCULE (sinon un cache empoisonné mettrait la photo d'une
//     paire sur l'annonce d'une autre). Le cache vit dans un compartiment privé,
//     rangé par vendeur.
//   • UN PLAFOND MENSUEL PAR VENDEUR, décompté par la base en UNE instruction
//     (`vrm_detourage_reserver`) : jamais un lire-ajouter-réécrire, dont une
//     lecture ratée remettrait le compteur à zéro (§4, audit-fusion). Compteur
//     illisible ⇒ on ne paie PAS à l'aveugle (« pas su » ne vaut pas zéro).
//   • JAMAIS un 200 sur un échec (leçon des routes api/) : l'extension garde
//     alors la photo d'origine, et le bandeau le dit.
import crypto from 'node:crypto';
import { sbCle } from './cle.js';
import { utilisateurDe } from './session.js';
import { accesVendeur } from './abonnement.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const PHOTOROOM_URL = 'https://sdk.photoroom.com/v1/segment';
const BUCKET = 'detourage';
// Changer un paramètre du rendu (fond, format) DOIT changer la clé du cache :
// sinon une photo détourée avec l'ancien réglage reviendrait.
const VPARAMS = 'blanc-jpg-v1';
export const MAX_B64 = 3000000;               // ~2,2 Mo d'octets : sous les 4,5 Mo d'une fonction Vercel
export const PLAFOND_DEFAUT = 150;            // photos par vendeur et par mois (~3 $)
const DELAI_MS = 20000;
const SHA = /^[0-9a-f]{64}$/;

const plafondMois = () => {
  const n = parseInt(String(process.env.PHOTOROOM_PLAFOND_MOIS || ''), 10);
  return Number.isFinite(n) && n >= 0 ? n : PLAFOND_DEFAUT;
};
const moisCourant = () => new Date().toISOString().slice(0, 7);
const service = () => process.env.SUPABASE_SERVICE_KEY || '';
const cheminCache = (owner, sha) => `${owner}/${sha}-${VPARAMS}.jpg`;

// Une image, pas n'importe quels octets : JPEG, PNG, WebP, HEIC.
export function estUneImage(buf) {
  if (!buf || buf.length < 12) return false;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;                              // JPEG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;           // PNG
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return true;   // WebP
  if (buf.toString('ascii', 4, 8) === 'ftyp') return true;                                              // HEIC / AVIF
  return false;
}

// Le résultat déjà détouré de CETTE photo, pour CE vendeur.
// Rend { b64, bytes } · null (absent) · undefined (pas su).
async function lireCache(owner, sha) {
  if (!service()) return undefined;
  try {
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${cheminCache(owner, sha)}`, { headers: sbCle(service()) });
    if (r.status === 404 || r.status === 400) return null;      // Storage répond 400 « not found » sur un objet absent
    if (!r.ok) return undefined;
    const buf = Buffer.from(await r.arrayBuffer());
    if (!buf.length) return undefined;
    return { b64: buf.toString('base64'), bytes: buf.length };
  } catch (_) { return undefined; }
}
async function ecrireCache(owner, sha, buf) {
  if (!service()) return false;
  try {
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${cheminCache(owner, sha)}`, {
      method: 'POST',
      headers: { ...sbCle(service()), 'Content-Type': 'image/jpeg', 'x-upsert': 'true' },
      body: buf,
    });
    return r.ok;
  } catch (_) { return false; }
}
// Réserve une unité du plafond. Rend le nouveau total · null (plafond atteint) ·
// undefined (pas su : on ne paie pas).
async function reserver(owner, mois, plafond) {
  if (!service()) return undefined;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/vrm_detourage_reserver`, {
      method: 'POST', headers: { ...sbCle(service()), 'Content-Type': 'application/json' },
      body: JSON.stringify({ u: owner, m: mois, plafond }),
    });
    if (!r.ok) return undefined;
    const v = await r.json();
    if (v === null) return null;
    return Number.isFinite(v) ? v : undefined;
  } catch (_) { return undefined; }
}
async function rendre(owner, mois) {
  if (!service()) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/vrm_detourage_rendre`, {
      method: 'POST', headers: { ...sbCle(service()), 'Content-Type': 'application/json' },
      body: JSON.stringify({ u: owner, m: mois }),
    });
  } catch (_) { /* au pire le compteur garde une unité de trop : on sous-dépense */ }
}
// Combien ce vendeur a détouré ce mois-ci. undefined = pas su (jamais « 0 »).
async function lireUsage(owner, mois) {
  if (!service()) return undefined;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/detourage_usage?owner=eq.${encodeURIComponent(owner)}&mois=eq.${encodeURIComponent(mois)}&select=n`, { headers: sbCle(service()) });
    if (!r.ok) return undefined;
    const j = await r.json();
    if (!Array.isArray(j)) return undefined;
    return j[0] ? Number(j[0].n) || 0 : 0;
  } catch (_) { return undefined; }
}
async function appelerPhotoroom(cle, b64) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), DELAI_MS);
  try {
    const r = await fetch(PHOTOROOM_URL, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'x-api-key': cle, 'Content-Type': 'application/json', Accept: 'image/jpeg' },
      // Fond BLANC et JPEG (jamais transparent par défaut : un PNG transparent est
      // lourd, et Leboncoin/eBay l'affichent sur fond noir ou gris).
      body: JSON.stringify({ image_file_b64: b64, bg_color: 'white', format: 'jpg' }),
    });
    if (!r.ok) return { ok: false, status: r.status };
    const buf = Buffer.from(await r.arrayBuffer());
    if (!buf.length) return { ok: false, status: 502 };
    return { ok: true, buf };
  } catch (_) { return { ok: false, status: 504 }; }
  finally { clearTimeout(t); }
}

// Deux demandes simultanées de la même photo dans la même instance : un seul appel.
const enVol = new Map();

export async function handleDetourage(req, res) {
  const cle = process.env.PHOTOROOM_API_KEY || '';
  const q = req.query || {};
  if (req.method === 'GET') {
    if (!q.usage) { res.status(200).json({ ok: true, ready: !!cle }); return; }
    const u = await utilisateurDe(req);
    if (!u) { res.status(401).json({ ok: false, reason: 'session' }); return; }
    const mois = moisCourant();
    const n = await lireUsage(u.id, mois);
    if (n === undefined) { res.status(503).json({ ok: false, reason: 'compteur', ready: !!cle }); return; }
    res.status(200).json({ ok: true, ready: !!cle, mois, n, plafond: plafondMois(), autorise: autorise(u.id) });
    return;
  }
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'POST' }); return; }
  const u = await utilisateurDe(req);
  if (!u) { res.status(401).json({ ok: false, reason: 'session' }); return; }
  if ((await accesVendeur(u.id)) === false) { res.status(402).json({ ok: false, reason: 'abonnement' }); return; }
  if (!autorise(u.id)) { res.status(403).json({ ok: false, reason: 'reserve' }); return; }
  if (!cle) { res.status(503).json({ ok: false, reason: 'no-key' }); return; }
  const b = req.body || {};
  const sha = String(b.sha || '').toLowerCase();
  if (!SHA.test(sha)) { res.status(400).json({ ok: false, reason: 'sha' }); return; }

  // 1. Déjà détourée ? On ne paie pas, on ne compte pas.
  const cache = await lireCache(u.id, sha);
  if (cache) { res.status(200).json({ ok: true, hit: true, b64: cache.b64, type: 'image/jpeg', bytes: cache.bytes }); return; }
  // 2. Sonde sans octets : l'extension n'envoie la photo que si on ne l'a pas.
  if (b.b64 == null) { res.status(200).json({ ok: true, hit: false }); return; }

  let b64 = String(b.b64 || '').replace(/^data:[^,]*,/, '');
  if (b64.length > MAX_B64) { res.status(413).json({ ok: false, reason: 'trop-lourde' }); return; }
  let buf;
  try { buf = Buffer.from(b64, 'base64'); } catch (_) { buf = null; }
  if (!buf || !buf.length) { res.status(400).json({ ok: false, reason: 'image' }); return; }
  // L'empreinte annoncée doit être celle des octets reçus : sinon on rangerait un
  // détourage sous la clé d'une AUTRE photo.
  if (crypto.createHash('sha256').update(buf).digest('hex') !== sha) { res.status(400).json({ ok: false, reason: 'sha' }); return; }
  if (!estUneImage(buf)) { res.status(415).json({ ok: false, reason: 'image' }); return; }
  b64 = buf.toString('base64');

  const cleVol = `${u.id}:${sha}`;
  let p = enVol.get(cleVol);
  if (!p) {
    p = (async () => {
      const mois = moisCourant();
      const n = await reserver(u.id, mois, plafondMois());
      if (n === undefined) return { status: 503, corps: { ok: false, reason: 'compteur' } };
      if (n === null) return { status: 429, corps: { ok: false, reason: 'plafond', plafond: plafondMois() } };
      const r = await appelerPhotoroom(cle, b64);
      if (!r.ok) {
        await rendre(u.id, mois);                       // un échec ne se paie pas sur le plafond
        const s = r.status;
        const status = (s === 402 || s === 403 || s === 429) ? s : (s >= 500 ? 502 : 502);
        return { status, corps: { ok: false, reason: 'photoroom', status: s } };
      }
      await ecrireCache(u.id, sha, r.buf);              // au mieux : un cache raté se paiera une fois de plus
      return { status: 200, corps: { ok: true, hit: false, b64: r.buf.toString('base64'), type: 'image/jpeg', bytes: r.buf.length, n } };
    })().finally(() => enVol.delete(cleVol));
    enVol.set(cleVol, p);
  }
  const out = await p;
  res.status(out.status).json(out.corps);
}

// Qui a droit au détourage : le propriétaire de l'installation, ou tout le monde
// si Julien l'a décidé (`PHOTOROOM_POUR=tous`).
export function autorise(uid) {
  if (String(process.env.PHOTOROOM_POUR || '').toLowerCase() === 'tous') return true;
  const proprio = String(process.env.VRM_OWNER_UID || '');
  return !!proprio && String(uid) === proprio;
}

// Pour les bancs.
export const _interne = { VPARAMS, cheminCache, viderEnVol: () => enVol.clear() };
