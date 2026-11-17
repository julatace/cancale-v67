// ═══════════════════════════════════════════════════════════════════════════
// « PARTAGER LE STOCK AVEC UN AIDANT » — lien lecture seule qui expire (16 nov.,
// lot partage-aidant — mission 7 de la file, validée par Julien)
// ═══════════════════════════════════════════════════════════════════════════
// Un aidant SANS compte (la personne qui l'aide à préparer les colis) ouvre
// `https://vrm.center/a/<jeton>` (vercel.json → `/?aidant=<jeton>`, src/VueAidant.jsx),
// qui lit `/api/compte?mode=aidant&j=<jeton>` : AUCUNE fonction `api/` neuve (12 au
// plus) ; la mécanique est celle du lien comptable (api/_lib/comptable-lien.js).
// Le mode équipe (migration 016) n'est PAS appliqué : on n'en dépend pas.
//
// LE JETON — aléa long, signé, expirant, révocable, vérifié CÔTÉ SERVEUR :
//   `<aléa 24 octets>.<expiration base 36>.<signature>` ; HMAC-SHA256 (clé serveur
//   `AIDANT_SECRET`, sinon la clé de service) de l'aléa et de l'expiration. Rangé
//   dans la liste des liens de SA ligne `vrm_aidant` (10 au plus) et indexé par son
//   EMPREINTE chez le propriétaire neutre (api/_lib/jeton-index.js, genre `aidant`),
//   RE-COMPARÉ à durée constante. Durée : 24 h (défaut) ou 7 jours.
//   Réponses : forme ou signature fausse ⇒ 404 ; EXPIRÉ ⇒ 410 ; RÉVOQUÉ (plus dans
//   la liste, index retiré) ⇒ 410 ; base injoignable ⇒ 503 (jamais un stock vide).
//   Débit limité sur la route publique (api/_lib/debit-vendeur.js, genre `aidant`,
//   par adresse et par jeton, en mémoire : aucune lecture de base pour un refus).
//
// CE QUE L'AIDANT VOIT — le STOCK SEUL (`vueAidant`, une liste BLANCHE appliquée côté
//   serveur à l'écriture ET à la lecture) : pour chaque paire rangée, son N°, son lieu
//   (pièce · meuble · case), son titre, sa photo (une adresse d'image https seulement).
//   JAMAIS : un prix (achat ou vente), un montant, un pseudo, un nom de compte, une
//   adresse, un acheteur, un e-mail, un code, un lien vers une annonce.
// AUCUNE ÉCRITURE possible par le lien : la route publique ne sait que GET, et ne
//   touche aucune ligne (pas même un journal).
// CLOISONNEMENT : le vendeur ne lit et n'écrit que SA ligne (owner = sa session) ;
//   l'aidant ne lit que la ligne du vendeur que l'index désigne ET dont la liste porte
//   ce jeton. Projection minimale (`l:data->liens,v:data->vue`), jamais `select=data`.
// Tenu par scripts/audit-partage-aidant.cjs (EXÉCUTE la route).
// ═══════════════════════════════════════════════════════════════════════════
import crypto from 'node:crypto';
import { ecrireIndexJeton, retirerIndexJeton, memeJeton, idIndexJeton } from './jeton-index.js';
import { PROPRIETAIRE_NEUTRE } from './proprietaire-email.js';
import { fetchAvecDelai } from './fetch-delai.js';

export const LIGNE_AIDANT = 'vrm_aidant';
export const DUREES_H = [24, 168];
export const LIENS_MAX = 10;
export const ITEMS_MAX = 3000;
export const RE_JETON_AIDANT = /^[A-Za-z0-9_-]{32}\.[0-9a-z]{6,10}\.[A-Za-z0-9_-]{22}$/;
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const secret = (env) => String((env && (env.AIDANT_SECRET || env.SUPABASE_SERVICE_KEY)) || '');
const signer = (cle, alea, exp36) => crypto.createHmac('sha256', cle).update(`aidant:${alea}.${exp36}`).digest('base64url').slice(0, 22);
export function nouveauJetonAidant(cle, expMs) {
  const alea = crypto.randomBytes(24).toString('base64url');
  const exp36 = Math.floor(expMs).toString(36);
  return `${alea}.${exp36}.${signer(cle, alea, exp36)}`;
}
// { ok, exp, raison } — la forme, la signature et l'expiration, sans aucune lecture de base.
export function verifierJetonAidant(jeton, cle, maintenant = Date.now()) {
  const j = String(jeton || '');
  if (!cle || !RE_JETON_AIDANT.test(j)) return { ok: false, raison: 'forme' };
  const [alea, exp36, sig] = j.split('.');
  const attendu = signer(cle, alea, exp36);
  if (sig.length !== attendu.length || !crypto.timingSafeEqual(Buffer.from(attendu), Buffer.from(sig))) return { ok: false, raison: 'signature' };
  const exp = parseInt(exp36, 36);
  if (!Number.isFinite(exp) || exp <= maintenant) return { ok: false, raison: 'expire', exp };
  return { ok: true, exp };
}
export const urlAidant = (jeton, origine = 'https://vrm.center') => (jeton ? `${origine}/a/${jeton}` : '');
// L'identifiant PUBLIC d'un lien dans la liste du vendeur (pour le couper) : jamais le jeton.
export const idLien = (jeton) => crypto.createHash('sha256').update(`lien:${String(jeton || '')}`).digest('hex').slice(0, 16);

// ── LA LISTE BLANCHE ────────────────────────────────────────────────────────
const txt = (v, n = 90) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const RE_PHOTO = /^https:\/\/[a-z0-9.-]+\.(?:vinted\.net|vinted\.[a-z.]+|leboncoin\.fr|vestiairecollective\.com|ebayimg\.com|supabase\.co)\/[^\s"'<>]{1,500}$/i;
// `d` : { items: [{ num, lieu, titre, photo }] } (src/aidantStock.js). Tout autre champ est ignoré.
export function vueAidant(d) {
  if (!d || typeof d !== 'object' || !Array.isArray(d.items)) return null;
  const items = [];
  for (const it of d.items.slice(0, ITEMS_MAX)) {
    if (!it || typeof it !== 'object') continue;
    const num = txt(it.num, 12);
    if (!num) continue;
    const photo = typeof it.photo === 'string' && RE_PHOTO.test(it.photo) ? it.photo : '';
    items.push({ num, lieu: txt(it.lieu, 120), titre: txt(it.titre, 90), photo });
  }
  return { items };
}
// Les liens VALIDES de la liste (expirés ⇒ hors liste), 10 au plus, les plus récents d'abord.
export function liensValides(liens, cle, maintenant = Date.now()) {
  const l = Array.isArray(liens) ? liens : [];
  return l.filter((x) => x && typeof x.jeton === 'string' && verifierJetonAidant(x.jeton, cle, maintenant).ok)
    .sort((a, b) => String(b.cree || '').localeCompare(String(a.cree || ''))).slice(0, LIENS_MAX);
}

// ── LA ROUTE ────────────────────────────────────────────────────────────────
// deps : { base, cle (service), env, fetch, methode, jeton (public) | user (session), corps, origine, maintenant, debit(cle) → bool }
//   GET  + jeton (sans session) ⇒ { ok, exp, vue } — le stock seul ;
//   GET  + session              ⇒ { ok, liens: [{ id, url, exp, cree, heures }], publieLe, n } ;
//   POST + session { action: 'creer' (heures, vue) | 'publier' (vue) | 'couper' (id) }.
export async function traiterAidant(deps) {
  const { base, cle, methode } = deps;
  const f = deps.fetch || fetchAvecDelai;
  const origine = deps.origine || 'https://vrm.center';
  const maintenant = deps.maintenant || Date.now();
  const sig = secret(deps.env || {}) || cle;
  if (!cle) return { status: 503, body: { erreur: 'non-configure' } };
  const headers = { apikey: cle, Authorization: `Bearer ${cle}` };
  const lire = async (owner, select) => {
    try {
      const r = await f(`${base}/rest/v1/app_data?owner=eq.${encodeURIComponent(owner)}&id=eq.${LIGNE_AIDANT}&select=${select}&limit=1`, { headers });
      if (!r || !r.ok) return undefined;
      const j = await r.json();
      return Array.isArray(j) ? (j[0] || null) : undefined;
    } catch (_) { return undefined; }
  };

  // 1. L'AIDANT, par le jeton seul. GET seulement, aucune écriture.
  if (deps.jeton != null) {
    if (methode !== 'GET') return { status: 405, body: { erreur: 'GET seulement' } };
    if (deps.debit && deps.debit(String(deps.jeton).slice(0, 32)) === false) return { status: 429, body: { erreur: 'trop-vite' } };
    const v0 = verifierJetonAidant(deps.jeton, sig, maintenant);
    if (!v0.ok && v0.raison === 'expire') return { status: 410, body: { erreur: 'lien', raison: 'expire' } };
    if (!v0.ok) return { status: 404, body: { erreur: 'lien', raison: 'inconnu' } };
    let owner = '';
    try {
      const r = await f(`${base}/rest/v1/app_data?owner=eq.${PROPRIETAIRE_NEUTRE}&id=eq.${idIndexJeton('aidant', deps.jeton)}&select=o:data->>owner&limit=1`, { headers });
      if (!r || !r.ok) return { status: 503, body: { erreur: 'base' } };
      const j = await r.json();
      if (!Array.isArray(j)) return { status: 503, body: { erreur: 'base' } };
      owner = j[0] ? String(j[0].o || '') : '';
    } catch (_) { return { status: 503, body: { erreur: 'base' } }; }
    if (!RE_UUID.test(owner)) return { status: 410, body: { erreur: 'lien', raison: 'revoque' } };
    const ligne = await lire(owner, 'l:data->liens,v:data->vue');
    if (ligne === undefined) return { status: 503, body: { erreur: 'base' } };
    const present = ligne && Array.isArray(ligne.l) && ligne.l.some((x) => x && memeJeton(x.jeton, deps.jeton));
    if (!present) return { status: 410, body: { erreur: 'lien', raison: 'revoque' } };
    const vue = vueAidant(ligne.v) || { items: [] };
    return { status: 200, body: { ok: true, exp: v0.exp, publieLe: ligne.v && typeof ligne.v.publieLe === 'string' ? txt(ligne.v.publieLe, 30) : '', vue } };
  }

  // 2. LE VENDEUR, sur SA session (sa ligne seulement).
  const user = deps.user;
  if (!user || !RE_UUID.test(String(user.id || ''))) return { status: 401, body: { erreur: 'session' } };
  const ligne = await lire(user.id, 'l:data->liens,v:data->vue');
  if (ligne === undefined) return { status: 503, body: { erreur: 'base', message: 'Réessaie dans un instant.' } };
  const tous = Array.isArray(ligne && ligne.l) ? ligne.l : [];
  const valides = liensValides(tous, sig, maintenant);
  const ecrire = async (liens, vue) => {
    try {
      const now = new Date(maintenant).toISOString();
      const r = await f(`${base}/rest/v1/app_data?on_conflict=owner,id`, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([{ owner: user.id, id: LIGNE_AIDANT, data: { liens, vue, at: now }, updated_at: now }]),
      });
      return !!(r && r.ok);
    } catch (_) { return false; }
  };
  const etat = (liens, vue) => ({ status: 200, body: { ok: true,
    liens: liens.map((x) => ({ id: idLien(x.jeton), url: urlAidant(x.jeton, origine), exp: verifierJetonAidant(x.jeton, sig, maintenant).exp || null, cree: String(x.cree || ''), heures: Number(x.heures) || null })),
    publieLe: vue && vue.publieLe ? String(vue.publieLe) : '', n: vue && Array.isArray(vue.items) ? vue.items.length : 0 } });
  const vueRangee = ligne && ligne.v ? { ...(vueAidant(ligne.v) || { items: [] }), publieLe: String(ligne.v.publieLe || '') } : null;
  if (methode === 'GET') return etat(valides, vueRangee);
  if (methode !== 'POST') return { status: 405, body: { erreur: 'GET ou POST' } };
  const c = deps.corps && typeof deps.corps === 'object' ? deps.corps : {};
  const action = String(c.action || '');
  const erreurBase = { status: 503, body: { erreur: 'base', message: 'Rien n’a changé. Réessaie dans un instant.' } };
  if (action === 'publier' || action === 'creer') {
    const v = vueAidant(c.vue);
    if (!v) return { status: 400, body: { erreur: 'vue' } };
    const vue = { ...v, publieLe: new Date(maintenant).toISOString() };
    let liens = valides;
    let neuf = '';
    if (action === 'creer') {
      const heures = c.heures == null ? 24 : Number(c.heures);
      if (!DUREES_H.includes(heures)) return { status: 400, body: { erreur: 'duree' } };
      if (valides.length >= LIENS_MAX) return { status: 409, body: { erreur: 'trop-de-liens', max: LIENS_MAX } };
      neuf = nouveauJetonAidant(sig, maintenant + heures * 3600000);
      liens = [{ jeton: neuf, cree: new Date(maintenant).toISOString(), heures }, ...valides];
    } else if (!valides.length) return { status: 409, body: { erreur: 'pas-de-lien' } };
    if (!(await ecrire(liens, vue))) return erreurBase;
    if (neuf && !(await ecrireIndexJeton({ url: base, headers, fetcher: f, genre: 'aidant', jeton: neuf, owner: user.id, maintenant }))) return erreurBase;
    // Les expirés sortent de la liste : leurs index aussi.
    for (const x of tous) if (x && x.jeton && !valides.some((y) => y.jeton === x.jeton)) await retirerIndexJeton({ url: base, headers, fetcher: f, genre: 'aidant', jeton: x.jeton });
    return etat(liens, vue);
  }
  if (action === 'couper') {
    const id = String(c.id || '');
    const cible = valides.find((x) => idLien(x.jeton) === id);
    if (!cible) return { status: 404, body: { erreur: 'lien' } };
    const liens = valides.filter((x) => x !== cible);
    // Coupé : la liste d'abord (l'aidant est refusé dès cette écriture), puis l'index.
    if (!(await ecrire(liens, vueRangee))) return erreurBase;
    await retirerIndexJeton({ url: base, headers, fetcher: f, genre: 'aidant', jeton: cible.jeton });
    return etat(liens, vueRangee);
  }
  return { status: 400, body: { erreur: 'action' } };
}
