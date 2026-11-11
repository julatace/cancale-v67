// ════════════════════════════════════════════════════════════════════════════
//  LES ÉTIQUETTES D'UN VENDEUR, LUES JUSQU'AU BOUT (9 nov. au soir, « transporteurs parfaits »)
//  Julien : « Ce n'est pas possible d'avoir "transporteur inconnu" sachant que tu as
//  les bordereaux en ta possession. »
//  UNE fonction pour les trois appelants (aucune fonction `api/` de plus — 12/12) :
//    · le cron du matin (api/ship-reminders.js, chaque vendeur) ;
//    · le passage « colis » toutes les 15 min (même route, `?moment=colis`) ;
//    · l'app ouverte (POST /api/relais?mode=etiquettes, la session du vendeur).
//  Elle tourne AU NOM du vendeur du contexte (`proprietaireCourant`, owner=eq. sur
//  chaque requête) et appelle `passeTransporteursPdf` (api/_lib/transporteur-anciens.js) :
//  UN PDF par requête (`select=pdf:data->>pdfB64`, rien d'autre), listes projetées,
//  jamais `select=data` sur une ligne lourde (§4.4). La seule ligne lue en entier est
//  `vrm_bord_transporteurs` (légère : des clés et des noms, aucun PDF, aucun texte).
//  Trois états partout : une lecture ratée rend `null`/`undefined` ⇒ rien écrit.
// ════════════════════════════════════════════════════════════════════════════
import { proprietaireCourant } from './owner.js';
import { sbCle } from './cle.js';
import { ordreStable } from './ordre-stable.js';
import { passeTransporteursPdf, reqPdf } from './transporteur-anciens.js';
import { fetchAvecDelai } from './fetch-delai.js';   // (11 nov.) chaque appel sortant a un délai

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const cle = () => process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';
const entetes = () => ({ ...sbCle(cle()) });
const avecOwner = (chemin, owner) => `${chemin}${chemin.includes('?') ? '&' : '?'}owner=eq.${encodeURIComponent(owner)}`;

async function lireTout(chemin) {
  const owner = proprietaireCourant();
  if (!owner) return null;
  const out = []; const page = 1000;
  for (let from = 0; from < 200000; from += page) {
    let r;
    try { r = await fetchAvecDelai(ordreStable(`${SUPABASE_URL}/rest/v1/${avecOwner(chemin, owner)}`), { headers: { ...entetes(), 'Range-Unit': 'items', Range: `${from}-${from + page - 1}` } }); }
    catch (_) { return null; }
    if (!r.ok) return null;
    let j; try { j = await r.json(); } catch (_) { return null; }
    if (!Array.isArray(j)) return null;
    out.push(...j);
    if (j.length < page) break;
  }
  return out;
}
// objet · null (absente) · undefined (pas su)
async function getRow(id) {
  const owner = proprietaireCourant();
  if (!owner) return undefined;
  try {
    const r = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/${avecOwner(`app_data?id=eq.${encodeURIComponent(id)}&select=data`, owner)}`, { headers: entetes() });
    if (!r.ok) return undefined;
    const rows = await r.json();
    if (!Array.isArray(rows)) return undefined;
    return (rows[0] && rows[0].data) || null;
  } catch (_) { return undefined; }
}
async function ecrire(id, data) {
  const owner = proprietaireCourant();
  if (!owner) return false;
  try {
    const r = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=owner,id`, {
      method: 'POST',
      headers: { ...entetes(), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ owner, id, data, updated_at: new Date().toISOString() }]),
    });
    return !!(r && r.ok);
  } catch (_) { return false; }
}
// base64 · '' (la ligne n'a pas/plus de PDF) · null (pas su)
async function lirePdf(id) {
  const r = await lireTout(reqPdf(id));
  if (!Array.isArray(r)) return null;
  return (r[0] && typeof r[0].pdf === 'string' && r[0].pdf && r[0].pdf !== 'None') ? r[0].pdf : '';
}

export function etiquettesDuVendeur({ max, budgetMs, maintenant = Date.now() } = {}) {
  if (!proprietaireCourant()) return Promise.resolve({ fait: false, raison: 'vendeur' });
  return passeTransporteursPdf({ lireTout, getRow, ecrire, lirePdf, max, budgetMs, maintenant });
}
