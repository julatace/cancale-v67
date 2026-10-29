// ════════════════════════════════════════════════════════════════════════════
//  LA CLÉ PHOTOROOM DU VENDEUR, DANS LE COFFRE DU SERVEUR (29 octobre)
// ════════════════════════════════════════════════════════════════════════════
// Julien : « fais un meilleur visuel pour la clé API Photoroom des personnes qui
// utilisent VRM ». Règle §2.9 : un détourage se paie à la photo — c'est le
// compte Photoroom DU VENDEUR qui paie, jamais celui de Julien pour les autres.
//
// Avant (26 octobre) la clé vivait EN CLAIR dans `app_data.vrm_photoroom_cle`,
// écrite ET relue par le navigateur. Maintenant, comme Super PDP :
// · le navigateur l'envoie UNE fois (`poser`) ; le serveur la vérifie chez
//   Photoroom (lecture du compte, gratuite), la CHIFFRE (api/_lib/coffre.js,
//   usage « photoroom-v1 ») et la range dans `app_data.photoroom_cle` ;
// · le navigateur n'en apprend plus que : posée ou non, ses 4 derniers
//   caractères, la date, ce que Photoroom a répondu à la vérification ;
// · sans clé de coffre : RIEN n'est rangé (jamais en clair) ;
// · « pas su » ne vaut jamais « aucune clé » (lecture ratée ⇒ 503) ;
// · la ligne en clair d'avant est DÉPLACÉE dans le coffre à la première
//   lecture (puis effacée) ; tant qu'elle existe, le détourage la lit encore.
//
// ── CE QUI EST DOCUMENTÉ, ET D'OÙ ÇA VIENT ──────────────────────────────────
// ⚠️ docs.photoroom.com n'est PAS joignable d'ici. D'après les pages indexées
//    (« How can I check my API usage? ») : `GET https://image-api.photoroom.com
//    /v2/account`, en-tête `x-api-key`, réponse `{ images: { available,
//    subscription } }` (l'ancienne `/v1/account` rendait `credits`) ; un appel
//    en erreur ne consomme aucune image ; 402 = aucune formule API active.
//    Ce qui n'est PAS supposé : un 401/403 est lu « clé refusée » (rien n'est
//    rangé) ; tout le reste (404, 5xx, coupure, forme inconnue) est « pas
//    encore vérifiée » — la clé est rangée et c'est DIT.
import { sbCle } from './cle.js';
import { coffrePret, chiffrerCoffre, dechiffrerCoffre } from './coffre.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
export const ID_CLE = 'photoroom_cle';
export const ID_ANCIENNE = 'vrm_photoroom_cle';
export const USAGE = 'photoroom-v1';
export const PHOTOROOM_COMPTE = 'https://image-api.photoroom.com/v2/account';
const DELAI_MS = Number(process.env.PHOTOROOM_VERIF_DELAI_MS) || 8000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Une clé : des caractères imprimables, sans espace, 16 à 200. Rien de plus
// supposé sur sa forme (Photoroom ne la documente pas d'ici).
export const CLE_RE = /^[\x21-\x7e]{16,200}$/;
const sbKey = () => process.env.SUPABASE_SERVICE_KEY || '';
export const finDe = (cle) => String(cle || '').slice(-4);
const VERIFS = new Set(['ok', 'sans-forfait', 'refusee', 'pas-su']);

const enTetes = () => ({ ...sbCle(sbKey()) });
const ligne = (id, owner) => `${SUPABASE_URL}/rest/v1/app_data?id=eq.${id}&owner=eq.${encodeURIComponent(owner)}`;

// La ligne du coffre. TROIS états : `undefined` pas su · `null` aucune ·
// `{chiffre, fin, at, verif, verifAt, restant, migreeLe}`.
async function lireLigneCoffre(owner) {
  if (!sbKey() || !UUID.test(String(owner || ''))) return undefined;
  try {
    const r = await fetch(`${ligne(ID_CLE, owner)}&select=chiffre:data->>chiffre,fin:data->>fin,at:data->>at,verif:data->>verif,verifAt:data->>verifAt,restant:data->restant,migreeLe:data->>migreeLe`, { headers: enTetes() });
    if (!r.ok) return undefined;
    const rows = await r.json();
    if (!Array.isArray(rows)) return undefined;
    if (!rows[0] || !rows[0].chiffre) return null;
    return rows[0];
  } catch (_) { return undefined; }
}
// L'ancienne ligne EN CLAIR (26 octobre). `undefined` pas su · `null` aucune ·
// `{cle, at}`.
async function lireAncienne(owner) {
  if (!sbKey() || !UUID.test(String(owner || ''))) return undefined;
  try {
    const r = await fetch(`${ligne(ID_ANCIENNE, owner)}&select=cle:data->>cle,at:data->>at`, { headers: enTetes() });
    if (!r.ok) return undefined;
    const rows = await r.json();
    if (!Array.isArray(rows)) return undefined;
    const c = rows[0] && typeof rows[0].cle === 'string' ? rows[0].cle.trim() : '';
    return c ? { cle: c, at: rows[0].at || null } : null;
  } catch (_) { return undefined; }
}
async function rangerCoffre(owner, cle, info) {
  const chiffre = chiffrerCoffre(USAGE, owner, { cle });
  if (!chiffre) return false;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=owner,id`, {
      method: 'POST',
      headers: { ...enTetes(), 'content-type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ owner, id: ID_CLE, data: { v: 1, chiffre, fin: finDe(cle), ...info } }]),
    });
    return r.ok;
  } catch (_) { return false; }
}
async function effacer(id, owner) {
  try {
    const r = await fetch(ligne(id, owner), { method: 'DELETE', headers: { ...enTetes(), Prefer: 'return=minimal' } });
    return r.ok;
  } catch (_) { return false; }
}

// ── LA CLÉ, POUR LE SERVEUR SEUL (détourage) ────────────────────────────────
// Rend la clé (chaîne) · '' (aucune, ou chiffré illisible) · undefined (pas su).
// Le coffre d'abord ; l'ancienne ligne en clair tant qu'elle existe.
export async function lireClePhotoroom(owner) {
  const c = await lireLigneCoffre(owner);
  if (c === undefined) return undefined;
  if (c) {
    const d = dechiffrerCoffre(USAGE, owner, c.chiffre);
    return d && typeof d.cle === 'string' ? d.cle : '';
  }
  const a = await lireAncienne(owner);
  if (a === undefined) return undefined;
  return a ? a.cle : '';
}

// ── LA VÉRIFICATION CHEZ PHOTOROOM (gratuite : lecture du compte) ───────────
// `{verif: 'ok'|'sans-forfait'|'refusee'|'pas-su', restant: nombre|null}`.
export async function verifierChezPhotoroom(cle) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), DELAI_MS);
  try {
    const r = await fetch(PHOTOROOM_COMPTE, { method: 'GET', signal: ctrl.signal, headers: { 'x-api-key': cle, accept: 'application/json' } });
    if (r.status === 401 || r.status === 403) return { verif: 'refusee', restant: null };
    if (r.status === 402) return { verif: 'sans-forfait', restant: null };
    if (!r.ok) return { verif: 'pas-su', restant: null };
    const j = await r.json().catch(() => null);
    const bloc = j && typeof j === 'object' ? (j.images || j.credits || null) : null;
    const n = bloc && Number.isFinite(Number(bloc.available)) && bloc.available !== null && bloc.available !== '' ? Number(bloc.available) : null;
    // 200 sans la forme attendue : la clé est ACCEPTÉE (sinon 401), le nombre
    // d'images restantes, lui, n'est pas lu — jamais un « 0 » inventé.
    return { verif: 'ok', restant: n };
  } catch (_) { return { verif: 'pas-su', restant: null }; }
  finally { clearTimeout(t); }
}

// ── CE QUE LE NAVIGATEUR APPREND ────────────────────────────────────────────
// Jamais la clé, jamais le chiffré.
const publique = (c, extra = {}) => ({
  ok: true, coffre: coffrePret(),
  etat: c.etat, fin: c.fin || null, at: c.at || null,
  verif: VERIFS.has(c.verif) ? c.verif : 'pas-su', verifAt: c.verifAt || null,
  restant: Number.isFinite(Number(c.restant)) && c.restant !== null ? Number(c.restant) : null,
  migreeLe: c.migreeLe || null,
  ...extra,
});
const repondre = (res, code, corps) => res.status(code).json(corps);
const MSG_PAS_SU = "Je n'ai pas pu lire ta clé Photoroom (la base n'a pas répondu). Rouvre cet écran dans un moment.";

export async function statut(owner, res) {
  const c = await lireLigneCoffre(owner);
  if (c === undefined) return repondre(res, 503, { erreur: 'pas-su', message: MSG_PAS_SU });
  if (c) {
    const d = dechiffrerCoffre(USAGE, owner, c.chiffre);
    return repondre(res, 200, publique({ ...c, etat: d && typeof d.cle === 'string' ? 'posee' : 'illisible' }));
  }
  // Pas de coffre : l'ancienne ligne en clair ?
  const a = await lireAncienne(owner);
  if (a === undefined) return repondre(res, 503, { erreur: 'pas-su', message: MSG_PAS_SU });
  if (!a) return repondre(res, 200, publique({ etat: 'aucune' }));
  // Elle existe : on la DÉPLACE dans le coffre (puis on efface la claire).
  // Sans coffre, elle reste en clair — et l'écran le dit.
  if (!coffrePret()) return repondre(res, 200, publique({ etat: 'en-clair', fin: finDe(a.cle), at: a.at }));
  const maintenant = new Date().toISOString();
  const info = { at: a.at || maintenant, verif: 'pas-su', verifAt: null, restant: null, migreeLe: maintenant };
  if (!(await rangerCoffre(owner, a.cle, info))) return repondre(res, 200, publique({ etat: 'en-clair', fin: finDe(a.cle), at: a.at }));
  const effacee = await effacer(ID_ANCIENNE, owner);
  return repondre(res, 200, publique({ ...info, fin: finDe(a.cle), etat: 'posee' }, { migree: true, ancienneEffacee: effacee }));
}

export async function poser(owner, corps, res) {
  const cle = typeof (corps && corps.cle) === 'string' ? corps.cle.trim() : '';
  if (!CLE_RE.test(cle)) return repondre(res, 400, { erreur: 'cle', message: "Ce n'est pas une clé Photoroom (une suite de lettres et de chiffres, sans espace). Rien n'a été rangé." });
  if (!coffrePret()) return repondre(res, 503, { erreur: 'coffre', message: "Le coffre du serveur n'est pas configuré : rien n'a été rangé." });
  const v = await verifierChezPhotoroom(cle);
  if (v.verif === 'refusee') return repondre(res, 400, { erreur: 'refusee', message: "Photoroom refuse cette clé (elle n'existe pas ou a été désactivée). Rien n'a été rangé." });
  const maintenant = new Date().toISOString();
  const info = { at: maintenant, verif: v.verif, verifAt: v.verif === 'pas-su' ? null : maintenant, restant: v.restant };
  if (!(await rangerCoffre(owner, cle, info))) return repondre(res, 503, { erreur: 'base', message: "La base n'a pas pu ranger ta clé : rien n'a changé. Réessaie." });
  // L'ancienne ligne en clair (s'il y en avait une) ne doit plus servir.
  const effacee = await effacer(ID_ANCIENNE, owner);
  return repondre(res, 200, publique({ ...info, fin: finDe(cle), etat: 'posee' }, { ancienneEffacee: effacee }));
}

export async function verifier(owner, res) {
  const c = await lireLigneCoffre(owner);
  if (c === undefined) return repondre(res, 503, { erreur: 'pas-su', message: MSG_PAS_SU });
  if (!c) return repondre(res, 409, { erreur: 'aucune', message: "Aucune clé Photoroom n'est rangée." });
  const d = dechiffrerCoffre(USAGE, owner, c.chiffre);
  if (!d || typeof d.cle !== 'string') return repondre(res, 409, { erreur: 'illisible', message: 'Ta clé ne se lit plus côté serveur : colle-la de nouveau.' });
  const v = await verifierChezPhotoroom(d.cle);
  const maintenant = new Date().toISOString();
  const info = { at: c.at || maintenant, verif: v.verif, verifAt: v.verif === 'pas-su' ? (c.verifAt || null) : maintenant, restant: v.verif === 'ok' ? v.restant : null, ...(c.migreeLe ? { migreeLe: c.migreeLe } : {}) };
  if (!(await rangerCoffre(owner, d.cle, info))) return repondre(res, 503, { erreur: 'base', message: "Photoroom a répondu, mais la base n'a pas pu le noter. Réessaie." });
  return repondre(res, 200, publique({ ...info, fin: finDe(d.cle), etat: 'posee' }));
}

// Retirer : les DEUX lignes (coffre + ancienne en clair). « Retirée » n'est dit
// que si les deux effacements ont abouti — sinon le détourage la lirait encore.
export async function retirer(owner, corps, res) {
  if (!corps || corps.confirme !== true) return repondre(res, 400, { erreur: 'confirmation', message: 'Confirme le retrait de ta clé.' });
  const a = await effacer(ID_CLE, owner);
  const b = await effacer(ID_ANCIENNE, owner);
  if (!a || !b) return repondre(res, 503, { erreur: 'base', message: "La base n'a pas répondu : ta clé est peut-être toujours rangée. Réessaie." });
  return repondre(res, 200, publique({ etat: 'aucune' }));
}

// Le point d'entrée du mode `photoroom` de /api/compte. La session est déjà
// vérifiée par l'appelant (vendeurExige).
export async function routePhotoroom(req, res, { vendeur, corps, acces, cloisonnee }) {
  // Base pas cloisonnée (ou pas su) : une ligne rangée ne serait pas à LUI seul.
  if (cloisonnee === null || cloisonnee === undefined) return repondre(res, 503, { erreur: 'pas-su', message: MSG_PAS_SU });
  if (cloisonnee !== true) return repondre(res, 503, { erreur: 'base', message: "La base ne sépare pas encore les vendeurs : aucune clé n'est rangée tant que ce n'est pas le cas." });
  const owner = vendeur.id;
  if (req.method === 'GET') return statut(owner, res);
  if (req.method !== 'POST') return repondre(res, 405, { erreur: 'GET ou POST' });
  if (!corps || typeof corps !== 'object') return repondre(res, 400, { erreur: 'corps' });
  const action = String(corps.action || '');
  // Retirer son secret reste TOUJOURS possible, même abonnement coupé.
  if (action === 'retirer') return retirer(owner, corps, res);
  if (acces === false) return repondre(res, 402, { erreur: 'abonnement', message: "Ton abonnement VRM est coupé : la clé n'est pas utilisée." });
  if (action === 'poser') return poser(owner, corps, res);
  if (action === 'verifier') return verifier(owner, res);
  return repondre(res, 400, { erreur: 'action inconnue' });
}
