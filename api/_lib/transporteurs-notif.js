// api/_lib/transporteurs-notif.js
// ────────────────────────────────────────────────────────────────────────────
// (24 oct.) LA NOTIFICATION D'UN CHANGEMENT D'ÉTAT LU CHEZ LE TRANSPORTEUR (§1.8).
// Seul un CHANGEMENT d'ÉTAT sonne (un libellé de transit de plus ne sonne pas :
// Mondial Relay a 6 libellés de transit, Chronopost 10 codes — ce serait du bruit
// permanent). La règle du changement et ses textes vivent dans
// api/_lib/transporteurs.js (pure) ; ici, ce qui écrit et envoie :
//   1. la préférence (« colis » pour un geste à faire, « suivi » pour le reste) ;
//   2. le silence si une autre voie l'a DÉJÀ annoncé — par une IDENTITÉ : le n°
//      (`relais-{n°}-*`, `retour-{n°}`, `retire-{n°}`…), la transaction reliée
//      (`relais-tx{tx}-*`), le code de retrait de l'e-mail (`retrait-code-{CODE}`) ;
//   3. la RÉSERVATION, atomique : `push_transp_{n°}` par comparer-et-échanger sur
//      `data.rev` (la règle `modifierCas`) — on réserve, PUIS on envoie : deux
//      passages simultanés n'envoient qu'une fois ;
//   4. la clé partagée posée dans `push_dedup` (comparer-et-échanger aussi) pour
//      que l'e-mail et le suivi Vinted se taisent ensuite.
// Jamais sur une lecture ratée, un évènement de plus de 72 h (la fermeture des
// anciens n° comprise : `silence`), une préférence coupée, un abonnement coupé.
// ────────────────────────────────────────────────────────────────────────────
import { sendPushToAll, pushCategorieActive } from './push.js';
import { modifierCas } from './suivi-vinted.js';
import { proprietaireCourant } from './owner.js';
import { sbCle } from './cle.js';
import { changementANotifier, texteNotifTransp } from './transporteurs.js';
import { normaliserSuivi } from './etat-colis-email.js';
import { cleCodeRetrait } from '../email-inbound.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';

async function lireDedup() {
  const owner = proprietaireCourant();
  if (!owner) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.push_dedup&select=data&owner=eq.${encodeURIComponent(owner)}`, { headers: { ...sbCle(SUPABASE_KEY) } });
    if (!r.ok) return null;
    const j = await r.json();
    if (!Array.isArray(j)) return null;
    return (j[0] && j[0].data && Array.isArray(j[0].data.keys)) ? j[0].data.keys.filter((k) => typeof k === 'string') : [];
  } catch (_) { return null; }
}

// `avant`/`apres` : la ligne `transp_` avant et après l'essai. `txs` : les
// transactions reliées à CE n° par identité ; `codes` : les codes de retrait des
// e-mails de CE n°. Rend { envoye, raison }.
export async function notifierChangementTransp(avant, apres, { arriveeMs = null, silence = false, maintenant = Date.now(), txs = [], codes = [] } = {}) {
  const ch = changementANotifier(avant, apres, { maintenant, arriveeMs, silence });
  if (!ch) return { envoye: false, raison: 'rien' };
  if (!(await pushCategorieActive(ch.categorie))) return { envoye: false, raison: 'preference' };
  const k = normaliserSuivi(apres.suivi);
  let keys = await lireDedup();
  if (keys === null) keys = await lireDedup();              // un hoquet : on relit une fois
  if (keys === null) return { envoye: false, raison: 'pas-su' };
  const prefixes = [...ch.prefixesSilence, ...(ch.etat === 'disponible' ? (txs || []).filter(Boolean).map((t) => `relais-tx${t}-`) : [])];
  const exactes = [ch.cle, ...(ch.etat === 'disponible' ? (codes || []).map((c) => cleCodeRetrait(c)).filter(Boolean) : [])];
  if (keys.some((x) => exactes.includes(x) || prefixes.some((p) => x.startsWith(p)))) return { envoye: false, raison: 'deja-annonce' };
  const iso = new Date(maintenant).toISOString();
  const reserve = await modifierCas(`push_transp_${k}`, (d) => {
    const faits = (d && d.faits && typeof d.faits === 'object') ? d.faits : {};
    if (faits[ch.fait]) return undefined;
    const entrees = Object.entries(faits).sort((a, b) => String(b[1]).localeCompare(String(a[1]))).slice(0, 19);
    return { v: 1, suivi: k, faits: Object.fromEntries([[ch.fait, iso], ...entrees]) };
  });
  if (reserve === null) return { envoye: false, raison: 'pas-su' };
  if (reserve === false) return { envoye: false, raison: 'deja' };
  // La clé partagée : l'e-mail et le suivi Vinted se tairont (au mieux — un raté
  // ici ne coûte qu'une notification de plus, jamais une de moins).
  await modifierCas('push_dedup', (d) => {
    const ks = (d && Array.isArray(d.keys)) ? d.keys : [];
    if (ks.includes(ch.cle)) return undefined;
    return { ...(d || {}), keys: [ch.cle, ...ks].slice(0, 300) };
  });
  const txt = texteNotifTransp(apres, ch);
  const r = await sendPushToAll({ title: txt.title, body: txt.body, tag: ch.cle, url: '/?tab=cat_achats' });
  if (r && r.coupe) return { envoye: false, raison: 'abonnement' };
  if (!r || !(Number(r.sent) > 0)) return { envoye: false, raison: r && r.erreur ? 'envoi-impossible' : 'aucun-appareil' };
  return { envoye: true, raison: ch.etat };
}
