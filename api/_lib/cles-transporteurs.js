// ════════════════════════════════════════════════════════════════════════════
//  LES CLÉS DE SUIVI DU VENDEUR (Colissimo / La Poste, UPS), DANS LE COFFRE (16 nov.)
// ════════════════════════════════════════════════════════════════════════════
// Mission du 16 nov. (lot `transporteurs-suivi`) : les API OFFICIELLES gratuites de La Poste
// (« Suivi v2 », clé Okapi) et d'UPS (« Tracking », Client ID + Client Secret) ne s'allument QUE si
// LE VENDEUR a posé SA clé. Règle §2.9 : « jamais la clé de Julien pour les autres » — avant ce lot,
// les variables Vercel `LAPOSTE_OKAPI_KEY` / `UPS_CLIENT_*` (le compte développeur de l'installation)
// lisaient les colis de TOUS les vendeurs. Elles ne sont plus lues nulle part.
//
// Comme la clé Photoroom (api/_lib/photoroom-cle.js) :
//  · le navigateur l'envoie UNE fois (`poser`) ; le serveur la CHIFFRE (api/_lib/coffre.js, un usage
//    par transporteur, l'identifiant du vendeur en donnée associée) et la range dans SA ligne
//    `suivi_cle_{transporteur}` ;
//  · le navigateur n'en apprend plus que : posée ou non, ses 4 derniers caractères, la date, ce que
//    le transporteur a répondu (`verif`) — jamais la clé, jamais le chiffré ;
//  · sans clé de coffre : RIEN n'est rangé (jamais en clair) ; base pas cloisonnée : rien non plus ;
//  · « pas su » ne vaut jamais « aucune clé » (lecture ratée ⇒ 503, et le passage ne lit rien).
//
// CE QUI EST VÉRIFIÉ, ET D'OÙ ÇA VIENT (documentation officielle, NON MESURÉ en vrai — aucune
// requête réelle depuis ce dépôt) :
//  · UPS : `POST https://onlinetools.ups.com/security/v1/oauth/token`, Basic id:secret,
//    `grant_type=client_credentials` ⇒ `{ access_token, expires_in }` (spécification OAuth publiée
//    par UPS). 400/401/403 ⇒ « refusée » (RIEN rangé) ; jeton rendu ⇒ « acceptée » ; le reste
//    (coupure, 5xx, forme inconnue) ⇒ rangée, « pas encore vérifiée ».
//  · La Poste : AUCUNE requête à la pose (la documentation n'offre pas d'appel « vérifier ma clé »,
//    et on n'invente pas un n° pour sonder). Elle est rangée « pas encore utilisée » ; la PREMIÈRE
//    lecture d'un de SES colis le dit (`noterVerif` : 401/403 ⇒ « refusée », réponse lue ⇒ « acceptée »).
import crypto from 'crypto';
import { sbCle } from './cle.js';
import { coffrePret, chiffrerCoffre, dechiffrerCoffre } from './coffre.js';
import { fetchAvecDelai } from './fetch-delai.js';
import { CARRIERS_CLE, CHAMPS_CLE } from './transporteurs.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const sbKey = () => process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const idCle = (carrier) => `suivi_cle_${carrier}`;
export const usageCle = (carrier) => `suivi-${carrier}-v1`;
export const UPS_JETON_URL = 'https://onlinetools.ups.com/security/v1/oauth/token';
export const UA_HONNETE = 'VRM-suivi/1.0 (+https://vrm.center)';
// Une clé / un identifiant : des caractères imprimables, sans espace, 8 à 300. Rien de plus supposé.
export const CHAMP_RE = /^[\x21-\x7e]{8,300}$/;
export const VERIFS = Object.freeze(['ok', 'refusee', 'pas-su']);
export const finDe = (v) => String(v || '').slice(-4);
const DELAI_MS = 8000;

const enTetes = () => ({ ...sbCle(sbKey()) });
const ligne = (carrier, owner) => `${SUPABASE_URL}/rest/v1/app_data?id=eq.${idCle(carrier)}&owner=eq.${encodeURIComponent(owner)}`;
const nouveauRev = () => crypto.randomBytes(9).toString('base64url');
const condRev = (rev) => (rev == null || rev === '' ? 'data->>rev=is.null' : `data->>rev=eq.${encodeURIComponent(String(rev))}`);

// La ligne d'UN transporteur. TROIS états : `undefined` pas su · `null` aucune · `{chiffre, fin, at, verif, verifAt, rev}`.
async function lireLigne(carrier, owner) {
  if (!CARRIERS_CLE.includes(carrier) || !sbKey() || !UUID.test(String(owner || ''))) return undefined;
  try {
    const r = await fetchAvecDelai(`${ligne(carrier, owner)}&select=chiffre:data->>chiffre,fin:data->>fin,at:data->>at,verif:data->>verif,verifAt:data->>verifAt,rev:data->>rev`, { headers: enTetes() });
    if (!r.ok) return undefined;
    const rows = await r.json();
    if (!Array.isArray(rows)) return undefined;
    if (!rows[0] || !rows[0].chiffre) return null;
    return rows[0];
  } catch (_) { return undefined; }
}
// Le secret déchiffré d'une ligne, s'il a la forme attendue (`CHAMPS_CLE`) ; sinon null.
function secretDe(carrier, owner, l) {
  if (!l || !l.chiffre) return null;
  const d = dechiffrerCoffre(usageCle(carrier), owner, l.chiffre);
  if (!d || typeof d !== 'object') return null;
  for (const k of CHAMPS_CLE[carrier]) if (typeof d[k] !== 'string' || !CHAMP_RE.test(d[k])) return null;
  const o = {}; for (const k of CHAMPS_CLE[carrier]) o[k] = d[k];
  return o;
}

// ── POUR LE PASSAGE (serveur seulement) ─────────────────────────────────────
// Les clés de CE vendeur, déchiffrées. `undefined` : une lecture a raté (le passage ne lit AUCUN
// transporteur à clé : « pas su » ≠ « aucune ») ; sinon `{ colissimo: {cle}|null, ups: {id, secret}|null,
// lignes: { colissimo: {verif, rev}|null, ups: … } }`.
export async function lireClesTransporteurs(owner) {
  const lignes = await Promise.all(CARRIERS_CLE.map((c) => lireLigne(c, owner)));
  if (lignes.some((l) => l === undefined)) return undefined;
  const out = { lignes: {} };
  CARRIERS_CLE.forEach((c, i) => {
    const l = lignes[i];
    out[c] = secretDe(c, owner, l);
    out.lignes[c] = l ? { verif: VERIFS.includes(l.verif) ? l.verif : 'pas-su', rev: l.rev || null } : null;
  });
  return out;
}
// Ce que la PREMIÈRE lecture a appris de la clé (« acceptée », « refusée »). Écrit seulement si ça
// change, et seulement si la ligne est encore celle qu'on a lue (comparer-et-échanger sur `rev` :
// une clé remplacée ou retirée pendant le passage n'est jamais marquée).
export async function noterVerif(owner, carrier, verif, lu) {
  if (!CARRIERS_CLE.includes(carrier) || !VERIFS.includes(verif) || verif === 'pas-su') return false;
  if (!lu || lu.verif === verif) return false;
  const l = await lireLigne(carrier, owner);
  if (!l || (l.rev || null) !== (lu.rev || null)) return false;
  try {
    const r = await fetchAvecDelai(`${ligne(carrier, owner)}&${condRev(l.rev)}&select=id`, {
      method: 'PATCH', headers: { ...enTetes(), 'content-type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ data: { v: 1, chiffre: l.chiffre, fin: l.fin, at: l.at, verif, verifAt: new Date().toISOString(), rev: nouveauRev() } }),
    });
    if (!r.ok) return false;
    const j = await r.json().catch(() => null);
    return Array.isArray(j) && j.length > 0;
  } catch (_) { return false; }
}

// ── UPS : LE JETON OAUTH (la même requête pour la pose et pour le passage) ──
// Rend { jeton, duree } · { refus: true } (identifiants refusés) · null (pas su).
export async function demanderJetonUps(id, secret, { signal = null, delaiMs = DELAI_MS } = {}) {
  if (!id || !secret) return null;
  try {
    const r = await fetchAvecDelai(UPS_JETON_URL, {
      method: 'POST', redirect: 'error', ...(signal ? { signal } : {}),
      headers: { 'User-Agent': UA_HONNETE, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}` },
      body: 'grant_type=client_credentials',
    }, delaiMs);
    if (r.status === 400 || r.status === 401 || r.status === 403) return { refus: true };
    if (!r.ok) return null;
    const j = await r.json().catch(() => null);
    const jeton = j && typeof j.access_token === 'string' ? j.access_token : '';
    if (!jeton) return null;
    const d = Number(j.expires_in);
    return { jeton, duree: Number.isFinite(d) && d > 0 ? Math.min(d, 24 * 3600) : 3600 };
  } catch (_) { return null; }
}

// ── LA ROUTE (/api/compte?mode=cles-suivi) ──────────────────────────────────
const repondre = (res, code, corps) => res.status(code).json(corps);
const MSG_PAS_SU = "Je n'ai pas pu lire tes clés de suivi (la base n'a pas répondu). Rouvre cet écran dans un moment.";
// Jamais la clé, jamais le chiffré, jamais le `rev`.
const publiqueDe = (carrier, owner, l) => {
  if (!l) return { etat: 'aucune', fin: null, at: null, verif: null, verifAt: null };
  const s = secretDe(carrier, owner, l);
  return { etat: s ? 'posee' : 'illisible', fin: l.fin || null, at: l.at || null, verif: VERIFS.includes(l.verif) ? l.verif : 'pas-su', verifAt: l.verifAt || null };
};
export async function statutCles(owner) {
  const lignes = await Promise.all(CARRIERS_CLE.map((c) => lireLigne(c, owner)));
  if (lignes.some((l) => l === undefined)) return null;
  const o = { ok: true, coffre: coffrePret() };
  CARRIERS_CLE.forEach((c, i) => { o[c] = publiqueDe(c, owner, lignes[i]); });
  return o;
}
async function ranger(carrier, owner, secret, info) {
  const chiffre = chiffrerCoffre(usageCle(carrier), owner, secret);
  if (!chiffre) return false;
  const fin = finDe(carrier === 'ups' ? secret.id : secret.cle);
  try {
    const r = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=owner,id`, {
      method: 'POST', headers: { ...enTetes(), 'content-type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ owner, id: idCle(carrier), data: { v: 1, chiffre, fin, ...info, rev: nouveauRev() } }]),
    });
    return r.ok;
  } catch (_) { return false; }
}
async function effacer(carrier, owner) {
  try { const r = await fetchAvecDelai(ligne(carrier, owner), { method: 'DELETE', headers: { ...enTetes(), Prefer: 'return=minimal' } }); return r.ok; } catch (_) { return false; }
}
const champ = (corps, k) => (typeof (corps && corps[k]) === 'string' ? corps[k].trim() : '');

export async function poserCle(owner, corps, res, { jetonUps = demanderJetonUps } = {}) {
  const carrier = String(corps && corps.transporteur || '');
  if (!CARRIERS_CLE.includes(carrier)) return repondre(res, 400, { erreur: 'transporteur', message: 'Transporteur inconnu.' });
  const secret = {};
  for (const k of CHAMPS_CLE[carrier]) {
    const v = champ(corps, k);
    if (!CHAMP_RE.test(v)) return repondre(res, 400, { erreur: 'cle', champ: k, message: "Ce n'est pas une clé (une suite de lettres et de chiffres, sans espace). Rien n'a été rangé." });
    secret[k] = v;
  }
  if (!coffrePret()) return repondre(res, 503, { erreur: 'coffre', message: "Le coffre du serveur n'est pas configuré : rien n'a été rangé." });
  const maintenant = new Date().toISOString();
  let verif = 'pas-su';
  if (carrier === 'ups') {
    const j = await jetonUps(secret.id, secret.secret);
    if (j && j.refus) return repondre(res, 400, { erreur: 'refusee', message: "UPS refuse ces identifiants (Client ID ou Client Secret faux, ou application sans le produit « Tracking »). Rien n'a été rangé." });
    if (j && j.jeton) verif = 'ok';
  }
  const ok = await ranger(carrier, owner, secret, { at: maintenant, verif, verifAt: verif === 'pas-su' ? null : maintenant });
  if (!ok) return repondre(res, 503, { erreur: 'base', message: "La base n'a pas pu ranger ta clé : rien n'a changé. Réessaie." });
  const s = await statutCles(owner);
  return repondre(res, 200, s || { ok: true, coffre: true, [carrier]: { etat: 'posee', fin: finDe(carrier === 'ups' ? secret.id : secret.cle), at: maintenant, verif, verifAt: verif === 'pas-su' ? null : maintenant } });
}
export async function retirerCle(owner, corps, res) {
  const carrier = String(corps && corps.transporteur || '');
  if (!CARRIERS_CLE.includes(carrier)) return repondre(res, 400, { erreur: 'transporteur', message: 'Transporteur inconnu.' });
  if (!corps || corps.confirme !== true) return repondre(res, 400, { erreur: 'confirmation', message: 'Confirme le retrait de ta clé.' });
  if (!(await effacer(carrier, owner))) return repondre(res, 503, { erreur: 'base', message: "La base n'a pas répondu : ta clé est peut-être toujours rangée. Réessaie." });
  const s = await statutCles(owner);
  return repondre(res, 200, s || { ok: true, coffre: coffrePret(), [carrier]: { etat: 'aucune' } });
}
// Le point d'entrée du mode `cles-suivi` de /api/compte. La session est déjà vérifiée (vendeurExige).
export async function routeClesTransporteurs(req, res, { vendeur, corps, acces, cloisonnee, jetonUps } = {}) {
  if (cloisonnee === null || cloisonnee === undefined) return repondre(res, 503, { erreur: 'pas-su', message: MSG_PAS_SU });
  if (cloisonnee !== true) return repondre(res, 503, { erreur: 'base', message: "La base ne sépare pas encore les vendeurs : aucune clé n'est rangée tant que ce n'est pas le cas." });
  const owner = vendeur && vendeur.id;
  if (!UUID.test(String(owner || ''))) return repondre(res, 401, { erreur: 'session' });
  if (req.method === 'GET') { const s = await statutCles(owner); return s ? repondre(res, 200, s) : repondre(res, 503, { erreur: 'pas-su', message: MSG_PAS_SU }); }
  if (req.method !== 'POST') return repondre(res, 405, { erreur: 'GET ou POST' });
  if (!corps || typeof corps !== 'object') return repondre(res, 400, { erreur: 'corps' });
  const action = String(corps.action || '');
  if (action === 'retirer') return retirerCle(owner, corps, res);   // retirer son secret reste toujours possible
  if (acces === false) return repondre(res, 402, { erreur: 'abonnement', message: "Ton abonnement VRM est coupé : la clé n'est pas utilisée." });
  if (action === 'poser') return poserCle(owner, corps, res, jetonUps ? { jetonUps } : {});
  return repondre(res, 400, { erreur: 'action inconnue' });
}
