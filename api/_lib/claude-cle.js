// ════════════════════════════════════════════════════════════════════════════
//  LA CLÉ CLAUDE DU VENDEUR, DANS LE COFFRE DU SERVEUR (23 nov., « Demande à VRM »)
// ════════════════════════════════════════════════════════════════════════════
// CLAUDE.md §2.9 : aucune fonction payante à l'usage ne tourne sur la clé de Julien pour les autres. « Demande à VRM »
// (src/conseiller/DemandeVRM.jsx, api/ai.js mode `conseiller`) ne tourne QUE sur la clé Anthropic DU VENDEUR — même pour
// le propriétaire de l'installation (il colle la sienne comme tout le monde) ; jamais un repli sur `AI_API_KEY`.
// Le modèle de la clé Photoroom (api/_lib/photoroom-cle.js), sans l'ancienne ligne en clair :
// · le navigateur l'envoie UNE fois (`poser`) ; le serveur la vérifie chez Anthropic (liste des modèles : gratuite),
//   la CHIFFRE (api/_lib/coffre.js, usage « claude-v1 », l'identifiant du vendeur en donnée associée) et la range dans
//   `app_data.claude_cle` ;
// · le navigateur n'en apprend que : posée ou non, ses 4 derniers caractères, la date, la réponse de la vérification ;
// · sans clé de coffre : RIEN n'est rangé (jamais en clair) ; « pas su » ne vaut jamais « aucune clé » (503).
import crypto from 'crypto';
import { sbCle } from './cle.js';
import { coffrePret, chiffrerCoffre, dechiffrerCoffre } from './coffre.js';
import { fetchAvecDelai } from './fetch-delai.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
export const ID_CLE = 'claude_cle';
export const USAGE = 'claude-v1';
export const ANTHROPIC_MODELES = 'https://api.anthropic.com/v1/models?limit=1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const CLE_RE = /^[\x21-\x7e]{20,300}$/;
const sbKey = () => process.env.SUPABASE_SERVICE_KEY || '';
export const finDe = (cle) => String(cle || '').slice(-4);
const VERIFS = new Set(['ok', 'refusee', 'pas-su']);
const enTetes = () => ({ ...sbCle(sbKey()) });
const ligne = (owner) => `${SUPABASE_URL}/rest/v1/app_data?id=eq.${ID_CLE}&owner=eq.${encodeURIComponent(owner)}`;
const repondre = (res, code, corps) => res.status(code).json(corps);
const MSG_PAS_SU = "Je n'ai pas pu lire ta clé Claude (la base n'a pas répondu). Rouvre cet écran dans un moment.";

// La ligne du coffre : `undefined` pas su · `null` aucune · `{chiffre, fin, at, verif}`.
async function lireLigne(owner) {
  if (!sbKey() || !UUID.test(String(owner || ''))) return undefined;
  try {
    const r = await fetchAvecDelai(`${ligne(owner)}&select=chiffre:data->>chiffre,fin:data->>fin,at:data->>at,verif:data->>verif`, { headers: enTetes() });
    if (!r.ok) return undefined;
    const rows = await r.json();
    if (!Array.isArray(rows)) return undefined;
    return rows[0] && rows[0].chiffre ? rows[0] : null;
  } catch (_) { return undefined; }
}

// POUR LE SERVEUR SEUL (api/ai.js) : la clé (chaîne) · '' (aucune, ou chiffré illisible) · undefined (pas su).
export async function lireCleClaude(owner) {
  const c = await lireLigne(owner);
  if (c === undefined) return undefined;
  if (!c) return '';
  const d = dechiffrerCoffre(USAGE, owner, c.chiffre);
  return d && typeof d.cle === 'string' ? d.cle : '';
}

// La vérification chez Anthropic : lire la liste des modèles (aucun jeton consommé). 401/403 ⇒ refusée ; un JSON qui
// porte `data` en tableau ⇒ acceptée ; tout le reste (coupure, 5xx, 429, forme inconnue) ⇒ « pas encore vérifiée ».
export async function verifierChezAnthropic(cle) {
  try {
    const r = await fetchAvecDelai(ANTHROPIC_MODELES, { method: 'GET', headers: { 'x-api-key': cle, 'anthropic-version': '2023-06-01', accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
    if (r.status === 401 || r.status === 403) return 'refusee';
    if (!r.ok) return 'pas-su';
    const j = await r.json().catch(() => null);
    return j && Array.isArray(j.data) ? 'ok' : 'pas-su';
  } catch (_) { return 'pas-su'; }
}

const publique = (c) => ({ ok: true, coffre: coffrePret(), etat: c.etat, fin: c.fin || null, at: c.at || null, verif: VERIFS.has(c.verif) ? c.verif : 'pas-su' });

export async function statut(owner, res) {
  const c = await lireLigne(owner);
  if (c === undefined) return repondre(res, 503, { erreur: 'pas-su', message: MSG_PAS_SU });
  if (!c) return repondre(res, 200, publique({ etat: 'aucune' }));
  const d = dechiffrerCoffre(USAGE, owner, c.chiffre);
  return repondre(res, 200, publique({ ...c, etat: d && typeof d.cle === 'string' ? 'posee' : 'illisible' }));
}

export async function poser(owner, corps, res) {
  const cle = typeof (corps && corps.cle) === 'string' ? corps.cle.trim() : '';
  if (!CLE_RE.test(cle)) return repondre(res, 400, { erreur: 'cle', message: "Ce n'est pas une clé Claude (elle commence d'habitude par sk-ant-, sans espace). Rien n'a été rangé." });
  if (!coffrePret()) return repondre(res, 503, { erreur: 'coffre', message: "Le coffre du serveur n'est pas configuré : rien n'a été rangé." });
  const verif = await verifierChezAnthropic(cle);
  if (verif === 'refusee') return repondre(res, 400, { erreur: 'refusee', message: "Anthropic refuse cette clé (elle n'existe pas ou a été désactivée). Rien n'a été rangé." });
  const chiffre = chiffrerCoffre(USAGE, owner, { cle });
  if (!chiffre) return repondre(res, 503, { erreur: 'coffre', message: "Le coffre du serveur n'est pas configuré : rien n'a été rangé." });
  const at = new Date().toISOString();
  try {
    const r = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=owner,id`, {
      method: 'POST', headers: { ...enTetes(), 'content-type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ owner, id: ID_CLE, data: { v: 1, chiffre, fin: finDe(cle), at, verif, rev: crypto.randomBytes(9).toString('base64url') } }]),
    });
    if (!r.ok) return repondre(res, 503, { erreur: 'base', message: "La base n'a pas pu ranger ta clé : rien n'a changé. Réessaie." });
  } catch (_) { return repondre(res, 503, { erreur: 'base', message: "La base n'a pas pu ranger ta clé : rien n'a changé. Réessaie." }); }
  return repondre(res, 200, publique({ etat: 'posee', fin: finDe(cle), at, verif }));
}

export async function retirer(owner, corps, res) {
  if (!corps || corps.confirme !== true) return repondre(res, 400, { erreur: 'confirmation', message: 'Confirme le retrait de ta clé.' });
  try {
    const r = await fetchAvecDelai(ligne(owner), { method: 'DELETE', headers: { ...enTetes(), Prefer: 'return=minimal' } });
    if (!r.ok) return repondre(res, 503, { erreur: 'base', message: "La base n'a pas répondu : ta clé est peut-être toujours rangée. Réessaie." });
  } catch (_) { return repondre(res, 503, { erreur: 'base', message: "La base n'a pas répondu : ta clé est peut-être toujours rangée. Réessaie." }); }
  return repondre(res, 200, publique({ etat: 'aucune' }));
}

// Le mode `claude` de /api/compte (la session est vérifiée par l'appelant, `vendeurExige`).
export async function routeClaude(req, res, { vendeur, corps, acces, cloisonnee }) {
  if (cloisonnee === null || cloisonnee === undefined) return repondre(res, 503, { erreur: 'pas-su', message: MSG_PAS_SU });
  if (cloisonnee !== true) return repondre(res, 503, { erreur: 'base', message: "La base ne sépare pas encore les vendeurs : aucune clé n'est rangée tant que ce n'est pas le cas." });
  const owner = vendeur.id;
  if (req.method === 'GET') return statut(owner, res);
  if (req.method !== 'POST') return repondre(res, 405, { erreur: 'GET ou POST' });
  if (!corps || typeof corps !== 'object') return repondre(res, 400, { erreur: 'corps' });
  const action = String(corps.action || '');
  if (action === 'retirer') return retirer(owner, corps, res);   // toujours possible, même abonnement coupé
  if (acces === false) return repondre(res, 402, { erreur: 'abonnement', message: "Ton abonnement VRM est coupé : la clé n'est pas utilisée." });
  if (action === 'poser') return poser(owner, corps, res);
  return repondre(res, 400, { erreur: 'action inconnue' });
}
