// ═══════════════════════════════════════════════════════════════════════════
// « ÉCRIRE AU SUPPORT » — LE SERVEUR (13 nov., lot 55)
// ═══════════════════════════════════════════════════════════════════════════
// La règle (les champs, le masquage, l'aperçu) : src/demandeAide.js, la MÊME
// que l'app. Ici : où c'est rangé, l'anti-abus, la notification, la liste du
// propriétaire, « Traitée ».
//
// OÙ ÇA VIT : une ligne PAR DEMANDE dans `app_data` DU VENDEUR (owner = lui,
// écrite par le serveur avec la clé de service) — `demande_aide_<AAAAMMJJHH>_<k>`.
// Ses demandes sont donc à lui : « Supprimer mon compte » les efface, l'export
// RGPD les rend. Le PROPRIÉTAIRE de l'installation les lit (clé de service,
// PROJETÉES champ par champ, §4.4) dans Réglages → Aide → « Demandes d'aide » ;
// tout autre compte : 403. (Le même chemin que les rapports de l'extension,
// api/_lib/rapport-extension.js.)
// ⚠️ LE SCEAU : le vendeur peut écrire ses propres lignes `app_data` (RLS). Pour
//    qu'une ligne posée à la main ne passe pas pour une demande (ni ne contourne
//    les 5 par heure), chaque demande porte un `sceau` (HMAC dérivé de la clé de
//    service, sur owner · id · heure · champs). Sans sceau valable, la ligne
//    n'est pas montrée au propriétaire (et le nombre écarté est dit).
// ⚠️ « TRAITÉE » s'écrit chez le PROPRIÉTAIRE (`demandes_aide_suivi`, comparer-
//    et-échanger sur `rev`) — jamais dans la ligne du vendeur.
// ⚠️ L'ADRESSE OÙ RÉPONDRE n'est jamais rangée : elle est lue chez Supabase
//    Auth (le compte du vendeur) au moment où le propriétaire ouvre la liste.
// ANTI-ABUS : 5 demandes par heure et par compte, tenues PAR LA BASE (cinq
// identifiants possibles par heure, chacun réservé « si absent »).
// ═══════════════════════════════════════════════════════════════════════════
import crypto from 'node:crypto';
import { sbCle } from './cle.js';
import { fetchAvecDelai } from './fetch-delai.js';
import { proprietaireInstallation } from './signalement.js';
import { modifierLigneCas } from './cas.js';
import { normaliserDemandeAide, PREFIXE_AIDE, DEMANDES_PAR_HEURE, ID_AIDE, CHAMPS_AIDE } from '../../src/demandeAide.js';

export const ID_SUIVI = 'demandes_aide_suivi';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FORME_EMAIL = /^[^@\s<>"']+@[^@\s<>"']+\.[^@\s<>"']+$/;
const cfg = (env) => ({ url: env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co', service: env.SUPABASE_SERVICE_KEY || '' });
const heureDe = (t) => new Date(t).toISOString().slice(0, 13).replace(/\D/g, '');   // AAAAMMJJHH (UTC)
export const idDemande = (t, k) => `${PREFIXE_AIDE}${heureDe(t)}_${k}`;
const dateIso = (v) => { const t = Date.parse(String(v || '')); return Number.isFinite(t) ? new Date(t).toISOString() : null; };

// ── LE SCEAU ─────────────────────────────────────────────────────────────────
const b64url = (x) => x.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export function sceauDemande(owner, id, d, service) {
  if (!service || !d) return null;
  const cle = crypto.createHmac('sha256', String(service)).update('vrm-demande-aide-v1').digest();
  const corps = [String(owner).toLowerCase(), id, d.at || '', ...CHAMPS_AIDE.map((c) => (d[c] == null ? '' : String(d[c])))].join('\u0001');
  return b64url(crypto.createHmac('sha256', cle).update(corps).digest()).slice(0, 32);
}
function sceauValable(owner, id, d, service) {
  const attendu = sceauDemande(owner, id, d, service);
  const lu = String((d && d.sceau) || '');
  if (!attendu || lu.length !== attendu.length) return false;
  return crypto.timingSafeEqual(Buffer.from(attendu), Buffer.from(lu));
}

// ── POST (session) : envoyer ────────────────────────────────────────────────
// `utilisateur` = SA session (api/_lib/session.js) ; `pousser(notif, proprio)`
// ouvre le contexte du propriétaire (la route le fournit).
export async function envoyerDemandeAide({ utilisateur, corps, env = process.env, fetcher = fetchAvecDelai, pousser = null, maintenant = Date.now() }) {
  const { url, service } = cfg(env);
  if (!service) return { code: 503, corps: { ok: false, raison: 'non-configure' } };
  const owner = String((utilisateur && utilisateur.id) || '').toLowerCase();
  if (!UUID.test(owner)) return { code: 401, corps: { ok: false, raison: 'session' } };
  const d = normaliserDemandeAide(corps);
  if (!d) return { code: 400, corps: { ok: false, raison: 'texte' } };
  const at = new Date(maintenant).toISOString();
  let id = null;
  for (let k = 1; k <= DEMANDES_PAR_HEURE && !id; k++) {
    const essai = idDemande(maintenant, k);
    const data = { ...d, at };
    data.sceau = sceauDemande(owner, essai, data, service);
    let r;
    try {
      r = await fetcher(`${url}/rest/v1/app_data?on_conflict=owner,id`, {
        method: 'POST',
        headers: { ...sbCle(service), 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=representation' },
        body: JSON.stringify([{ owner, id: essai, data, updated_at: at }]),
      });
    } catch (_) { return { code: 503, corps: { ok: false, raison: 'base' } }; }
    if (!r.ok) return { code: 503, corps: { ok: false, raison: 'base' } };
    const j = await r.json().catch(() => null);
    if (!Array.isArray(j)) return { code: 503, corps: { ok: false, raison: 'base' } };
    if (j.length === 1) id = essai;            // la place était libre : écrite (sinon : prise, la suivante)
  }
  if (!id) return { code: 429, corps: { ok: false, raison: 'trop', max: DEMANDES_PAR_HEURE, reessayerDans: 60 - new Date(maintenant).getUTCMinutes() } };
  // La notification au propriétaire : tentée, jamais une raison de dire « pas envoyé ».
  let notifie = null;
  if (pousser) {
    try {
      const proprio = await proprietaireInstallation({ env, fetcher });
      if (proprio) {
        const extrait = d.texte.length > 90 ? d.texte.slice(0, 89) + '…' : d.texte;
        const r = await pousser({ cat: 'signalement', title: '🛟 Demande d’aide', body: `${d.ecran ? d.ecran + ' · ' : ''}« ${extrait} »`, tag: `aide-${owner.slice(0, 8)}-${id.slice(-12)}`, url: '/?tab=settings&section=demandesaide' }, proprio);
        notifie = !!(r && r.sent > 0);
      }
    } catch (_) { notifie = false; }
  }
  return { code: 200, corps: { ok: true, id, at, notifie } };
}

// L'adresse du compte d'un vendeur (Supabase Auth admin), pour « Répondre ».
// `null` = pas su ou pas d'adresse : le propriétaire le voit écrit.
export async function adresseCompte(owner, { env = process.env, fetcher = fetchAvecDelai } = {}) {
  const { url, service } = cfg(env);
  if (!service || !UUID.test(String(owner))) return null;
  try {
    const r = await fetcher(`${url}/auth/v1/admin/users/${encodeURIComponent(owner)}`, { headers: sbCle(service) });
    if (!r.ok) return null;
    const u = await r.json().catch(() => null);
    const e = String((u && u.email) || '').trim().toLowerCase();
    return FORME_EMAIL.test(e) ? e : null;
  } catch (_) { return null; }
}

async function lireJson(fetcher, adresse, entetes) {
  try { const r = await fetcher(adresse, { headers: entetes }); if (!r.ok) return null; const j = await r.json().catch(() => null); return Array.isArray(j) ? j : null; }
  catch (_) { return null; }
}
async function exigerProprio({ utilisateur, env, fetcher }) {
  if (!cfg(env).service) return { code: 503, corps: { ok: false, raison: 'non-configure' } };
  const proprio = await proprietaireInstallation({ env, fetcher });
  if (!proprio) return { code: 503, corps: { ok: false, raison: 'destinataire-inconnu' } };
  if (String((utilisateur && utilisateur.id) || '').toLowerCase() !== proprio) return { code: 403, corps: { ok: false, raison: 'proprietaire' } };
  return { proprio };
}

// ── GET (session, PROPRIÉTAIRE seulement) : la liste ─────────────────────────
const SELECT_LISTE = ['owner', 'id', ...CHAMPS_AIDE.map((c) => `${c}:data->>${c}`), 'at:data->>at', 'sceau:data->>sceau'].join(',');
export async function listerDemandesAide({ utilisateur, env = process.env, fetcher = fetchAvecDelai, adresseDe = null }) {
  const p = await exigerProprio({ utilisateur, env, fetcher });
  if (!p.proprio) return p;
  const { url, service } = cfg(env);
  const h = sbCle(service);
  const [rows, suivi] = await Promise.all([
    lireJson(fetcher, `${url}/rest/v1/app_data?id=like.${PREFIXE_AIDE}*&select=${SELECT_LISTE}&order=data->>at.desc&limit=200`, h),
    lireJson(fetcher, `${url}/rest/v1/app_data?owner=eq.${p.proprio}&id=eq.${ID_SUIVI}&select=data&limit=1`, h),
  ]);
  if (!rows || !suivi) return { code: 503, corps: { ok: false, raison: 'base' } };
  const traitees = (suivi[0] && suivi[0].data && suivi[0].data.traitees && typeof suivi[0].data.traitees === 'object') ? suivi[0].data.traitees : {};
  let ecartees = 0;
  const demandes = [];
  for (const x of rows) {
    const owner = String((x && x.owner) || '').toLowerCase();
    if (!UUID.test(owner) || !ID_AIDE.test(String(x.id || ''))) { ecartees++; continue; }
    const brut = Object.fromEntries([...CHAMPS_AIDE, 'at', 'sceau'].map((c) => [c, x[c] == null ? null : x[c]]));
    if (!sceauValable(owner, x.id, brut, service)) { ecartees++; continue; }
    const d = normaliserDemandeAide(brut);
    if (!d) { ecartees++; continue; }
    const cle = `${owner}:${x.id}`;
    demandes.push({ de: owner, id: x.id, ...d, at: dateIso(x.at), traitee: !!traitees[cle], traiteeLe: dateIso(traitees[cle]) });
  }
  // L'adresse où répondre : une lecture par compte (au plus 50 comptes par liste).
  const lecteur = adresseDe || ((o) => adresseCompte(o, { env, fetcher }));
  const comptes = [...new Set(demandes.map((x) => x.de))].slice(0, 50);
  const adresses = new Map(await Promise.all(comptes.map(async (o) => [o, await lecteur(o).catch(() => null)])));
  for (const x of demandes) x.repondre = adresses.get(x.de) || null;
  return { code: 200, corps: { ok: true, demandes, nonTraitees: demandes.filter((x) => !x.traitee).length, ecartees } };
}

// ── POST {action:'traitee', de, id, traitee} (PROPRIÉTAIRE seulement) ────────
export async function marquerDemandeTraitee({ utilisateur, corps, env = process.env, fetcher = fetchAvecDelai, maintenant = Date.now() }) {
  const p = await exigerProprio({ utilisateur, env, fetcher });
  if (!p.proprio) return p;
  const de = String((corps && corps.de) || '').toLowerCase(), id = String((corps && corps.id) || '');
  if (!UUID.test(de) || !ID_AIDE.test(id)) return { code: 400, corps: { ok: false, raison: 'id' } };
  const traitee = corps.traitee !== false;
  const { url, service } = cfg(env);
  const r = await modifierLigneCas({ url, entetes: sbCle(service), owner: p.proprio, id: ID_SUIVI, fetcher, modifier: (d) => {
    const t = { ...((d && d.traitees && typeof d.traitees === 'object') ? d.traitees : {}) };
    if (traitee) t[`${de}:${id}`] = new Date(maintenant).toISOString(); else delete t[`${de}:${id}`];
    return { traitees: t };
  } });
  if (r !== true) return { code: 503, corps: { ok: false, raison: 'base' } };
  return { code: 200, corps: { ok: true, de, id, traitee } };
}
