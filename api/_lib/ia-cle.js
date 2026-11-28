// ════════════════════════════════════════════════════════════════════════════
//  LA CLÉ IA DU VENDEUR, DANS LE COFFRE DU SERVEUR (28 nov. 2026, lot agent-rangement)
// ════════════════════════════════════════════════════════════════════════════
// CLAUDE.md §2.9 : « aucune fonction payante à l'usage ne tourne sur SA clé pour les autres » — l'assistant de
// rangement avec IA tourne sur la clé Anthropic DU VENDEUR, collée par lui, rangée côté serveur, jamais relue par le
// navigateur. Le même chemin que la clé Photoroom (api/_lib/photoroom-cle.js, le coffre api/_lib/coffre.js) :
// · le navigateur l'envoie UNE fois (`poser`) ; le serveur la vérifie chez Anthropic (la liste des modèles : une
//   LECTURE, gratuite, aucun jeton consommé), la CHIFFRE (usage « ia-anthropic-v1 ») et la range dans
//   `app_data.ia_cle` (sa ligne, son `owner`) ;
// · le navigateur n'en apprend que : posée ou non, ses 4 derniers caractères, la date, la vérification ;
// · sans clé de coffre, ou base pas cloisonnée : RIEN n'est rangé (jamais en clair) ;
// · « pas su » ne vaut jamais « aucune clé » : une lecture ratée ⇒ `undefined` ⇒ 503, jamais un repli sur la clé du
//   serveur.
// Anthropic : `GET https://api.anthropic.com/v1/models`, en-têtes `x-api-key` et `anthropic-version` ; 401/403 = clé
// refusée (rien n'est rangé) ; 200 avec `data` en tableau = acceptée ; tout le reste = « pas encore vérifiée » (rangée,
// et c'est DIT).
import crypto from 'crypto';
import { sbCle } from './cle.js';
import { coffrePret, chiffrerCoffre, dechiffrerCoffre } from './coffre.js';
import { fetchAvecDelai } from './fetch-delai.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
export const ID_CLE = 'ia_cle';
export const USAGE = 'ia-anthropic-v1';
export const ANTHROPIC_MODELES = 'https://api.anthropic.com/v1/models';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Une clé Anthropic : « sk-ant- » puis des caractères imprimables sans espace (20 à 300 au total).
export const CLE_RE = /^sk-ant-[\x21-\x7e]{13,293}$/;
const VERIFS = new Set(['ok', 'refusee', 'pas-su']);
const sbKey = () => process.env.SUPABASE_SERVICE_KEY || '';
export const finDe = (cle) => String(cle || '').slice(-4);
const enTetes = () => ({ ...sbCle(sbKey()) });
const ligne = (owner) => `${SUPABASE_URL}/rest/v1/app_data?id=eq.${ID_CLE}&owner=eq.${encodeURIComponent(owner)}`;
const repondre = (res, code, corps) => res.status(code).json(corps);

// La ligne du coffre. `undefined` pas su · `null` aucune · { chiffre, fin, at, verif, verifAt }.
async function lireLigne(owner) {
  if (!sbKey() || !UUID.test(String(owner || ''))) return undefined;
  try {
    const r = await fetchAvecDelai(`${ligne(owner)}&select=chiffre:data->>chiffre,fin:data->>fin,at:data->>at,verif:data->>verif,verifAt:data->>verifAt`, { headers: enTetes() });
    if (!r.ok) return undefined;
    const rows = await r.json();
    if (!Array.isArray(rows)) return undefined;
    if (!rows[0] || !rows[0].chiffre) return null;
    return rows[0];
  } catch (_) { return undefined; }
}

// ── POUR LE SERVEUR SEUL (api/ai.js) ─────────────────────────────────────────
// La clé (chaîne) · '' (aucune, ou chiffré illisible) · undefined (pas su).
export async function lireCleIa(owner) {
  const c = await lireLigne(owner);
  if (c === undefined) return undefined;
  if (!c) return '';
  const d = dechiffrerCoffre(USAGE, owner, c.chiffre);
  return d && typeof d.cle === 'string' ? d.cle : '';
}

export async function verifierChezAnthropic(cle) {
  try {
    const r = await fetchAvecDelai(ANTHROPIC_MODELES, { method: 'GET', headers: { 'x-api-key': cle, 'anthropic-version': '2023-06-01', accept: 'application/json' } });
    if (r.status === 401 || r.status === 403) return 'refusee';
    if (!r.ok) return 'pas-su';
    const j = await r.json().catch(() => null);
    return j && Array.isArray(j.data) ? 'ok' : 'pas-su';
  } catch (_) { return 'pas-su'; }
}

const publique = (c) => ({ ok: true, coffre: coffrePret(), etat: c.etat, fin: c.fin || null, at: c.at || null, verif: VERIFS.has(c.verif) ? c.verif : 'pas-su', verifAt: c.verifAt || null });
const MSG_PAS_SU = "Je n'ai pas pu lire ta clé IA (la base n'a pas répondu). Rouvre cet écran dans un moment.";

async function poser(owner, corps, res) {
  const cle = typeof (corps && corps.cle) === 'string' ? corps.cle.trim() : '';
  if (!CLE_RE.test(cle)) return repondre(res, 400, { erreur: 'cle', message: "Ce n'est pas une clé Anthropic (elle commence par « sk-ant- », sans espace). Rien n'a été rangé." });
  if (!coffrePret()) return repondre(res, 503, { erreur: 'coffre', message: "Le coffre du serveur n'est pas configuré : rien n'a été rangé." });
  const verif = await verifierChezAnthropic(cle);
  if (verif === 'refusee') return repondre(res, 400, { erreur: 'refusee', message: "Anthropic refuse cette clé (elle n'existe pas ou a été désactivée). Rien n'a été rangé." });
  const chiffre = chiffrerCoffre(USAGE, owner, { cle });
  if (!chiffre) return repondre(res, 503, { erreur: 'coffre', message: "Le coffre du serveur n'est pas configuré : rien n'a été rangé." });
  const at = new Date().toISOString();
  const data = { v: 1, chiffre, fin: finDe(cle), at, verif, verifAt: verif === 'pas-su' ? null : at, rev: crypto.randomBytes(9).toString('base64url') };
  try {
    const r = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=owner,id`, {
      method: 'POST', headers: { ...enTetes(), 'content-type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ owner, id: ID_CLE, data }]),
    });
    if (!r.ok) return repondre(res, 503, { erreur: 'base', message: "La base n'a pas pu ranger ta clé : rien n'a changé. Réessaie." });
  } catch (_) { return repondre(res, 503, { erreur: 'base', message: "La base n'a pas pu ranger ta clé : rien n'a changé. Réessaie." }); }
  return repondre(res, 200, publique({ ...data, etat: 'posee' }));
}

async function retirer(owner, corps, res) {
  if (!corps || corps.confirme !== true) return repondre(res, 400, { erreur: 'confirmation', message: 'Confirme le retrait de ta clé.' });
  try {
    const r = await fetchAvecDelai(ligne(owner), { method: 'DELETE', headers: { ...enTetes(), Prefer: 'return=minimal' } });
    if (!r.ok) return repondre(res, 503, { erreur: 'base', message: "La base n'a pas répondu : ta clé est peut-être toujours rangée. Réessaie." });
  } catch (_) { return repondre(res, 503, { erreur: 'base', message: "La base n'a pas répondu : ta clé est peut-être toujours rangée. Réessaie." }); }
  return repondre(res, 200, publique({ etat: 'aucune' }));
}

// Le point d'entrée du mode `ia-cle` de /api/compte (la session est vérifiée par l'appelant, `vendeurExige`).
export async function routeIaCle(req, res, { vendeur, corps, acces, cloisonnee }) {
  if (cloisonnee === null || cloisonnee === undefined) return repondre(res, 503, { erreur: 'pas-su', message: MSG_PAS_SU });
  if (cloisonnee !== true) return repondre(res, 503, { erreur: 'base', message: "La base ne sépare pas encore les vendeurs : aucune clé n'est rangée tant que ce n'est pas le cas." });
  const owner = vendeur.id;
  if (req.method === 'GET') {
    const c = await lireLigne(owner);
    if (c === undefined) return repondre(res, 503, { erreur: 'pas-su', message: MSG_PAS_SU });
    if (!c) return repondre(res, 200, publique({ etat: 'aucune' }));
    const d = dechiffrerCoffre(USAGE, owner, c.chiffre);
    return repondre(res, 200, publique({ ...c, etat: d && typeof d.cle === 'string' ? 'posee' : 'illisible' }));
  }
  if (req.method !== 'POST') return repondre(res, 405, { erreur: 'GET ou POST' });
  if (!corps || typeof corps !== 'object') return repondre(res, 400, { erreur: 'corps' });
  const action = String(corps.action || '');
  if (action === 'retirer') return retirer(owner, corps, res);   // retirer son secret reste TOUJOURS possible
  if (acces === false) return repondre(res, 402, { erreur: 'abonnement', message: "Ton abonnement VRM est coupé : la clé n'est pas utilisée." });
  if (action === 'poser') return poser(owner, corps, res);
  return repondre(res, 400, { erreur: 'action inconnue' });
}
