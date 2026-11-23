// ════════════════════════════════════════════════════════════════════════════
//  « RETOUR ARRIVÉ · REMETTRE EN LIGNE ? » — UNE FOIS, SUR L'ARRIVÉE PROUVÉE (21 nov., lot 77)
// ════════════════════════════════════════════════════════════════════════════
// L'extension (5.431.0, `capterSuivisRetours`) a rangé une étape de plus du colis RETOUR d'une vente
// (`harvest_{uid}_retour_{tx}`) et ne donne que la transaction et le compte (`/api/push { action: 'retour' }`).
// Ici, au nom de CE vendeur : le compte est-il à lui ; la transaction est-elle une VENTE en retour (440, côté
// vendeur) ; la ligne, l'aller (le bordereau de CETTE vente, `email_bord_{tx}`) et les e-mails du transporteur du
// MÊME n° relus ; la RÈGLE de l'app (api/_lib/retour-vente-suivi.js, le même fichier) dit si l'arrivée est PROUVÉE
// (transporteur ou e-mail — jamais une absence, jamais « Vinted dit livrée ») ; puis une réservation atomique
// (`push_retour_{tx}`) écrite AVANT l'envoi : une notification par retour, jamais deux. Illisible ⇒ 503 (rien
// n'est envoyé, l'extension réessaie).
import { sendPushToAll, pushCategorieActive } from './push.js';
import { proprietaireCourant } from './owner.js';
import { sbCle } from './cle.js';
import { fetchAvecDelai } from './fetch-delai.js';
import { modifierCas } from './suivi-vinted.js';
import { DESTINATIONS } from './lien-notif.js';
import { suiviRetourVente, numerosDeLigne } from './retour-vente-suivi.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';

async function lire(chemin) {
  const owner = proprietaireCourant();
  if (!owner) return null;
  try {
    const r = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/${chemin}${chemin.includes('?') ? '&' : '?'}owner=eq.${encodeURIComponent(owner)}`, { headers: { ...sbCle(SUPABASE_KEY) } });
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j) ? j : null;
  } catch (_) { return null; }
}
const propre = (s, n) => String(s == null ? '' : s).replace(/<[^>]*>/g, ' ').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

// Le texte (une phrase, le titre de la vente lu par identité). Exporté pour l'audit.
export function texteRetourArrive(titre) {
  const nom = propre(titre, 60);
  return { title: 'Retour arrivé · Remettre en ligne ?', body: nom ? `${nom} est revenue chez toi. Elle repart en stock sous son N°.` : 'Ta paire est revenue chez toi. Elle repart en stock sous son N°.' };
}

// Rend { status, envoye?, raison? }.
export async function notifierRetourVente(tx, uid) {
  tx = String(tx == null ? '' : tx); uid = String(uid == null ? '' : uid);
  if (!/^\d{4,20}$/.test(tx)) return { status: 400, raison: 'transaction' };
  if (!/^\d{1,20}$/.test(uid)) return { status: 400, raison: 'compte' };
  const comptes = await lire(`vinted_accounts?vinted_user_id=eq.${encodeURIComponent(uid)}&select=vinted_user_id`);
  if (comptes === null) return { status: 503, raison: 'pas-su' };
  if (!comptes.some((c) => String(c && c.vinted_user_id) === uid)) return { status: 403, raison: 'compte' };
  // La transaction : une VENTE en retour (identité), et la date du début du retour.
  const t = await lire(`app_data?id=eq.harvest_${uid}_txn_${tx}&select=s:meta->>status,su:meta->>status_updated_at,side:data->payload->transaction->>user_side`);
  if (t === null) return { status: 503, raison: 'pas-su' };
  if (!t[0] || String(t[0].s) !== '440' || String(t[0].side || '') !== 'seller') return { status: 404, raison: 'pas-un-retour' };
  const l = await lire(`app_data?id=eq.harvest_${uid}_retour_${tx}&select=tx:data->>tx,suivi:data->>suivi,sc:data->>suiviCourant,sv:data->>suivisVinted,transporteur:data->>transporteur,etapes:data->etapes`);
  if (l === null) return { status: 503, raison: 'pas-su' };
  if (!l[0] || (l[0].tx != null && String(l[0].tx) !== tx)) return { status: 404, raison: 'inconnu' };
  const lu = l[0];
  const bord = await lire(`app_data?id=eq.email_bord_${tx}&select=suivi:meta->>suivi`);
  if (bord === null) return { status: 503, raison: 'pas-su' };
  const aller = bord.map((b) => b && b.suivi).filter(Boolean);
  const N = numerosDeLigne(lu).filter((n) => /^[A-Z0-9]{6,40}$/.test(n));
  let track = [];
  if (N.length) {
    const tr = await lire(`app_data?id=like.email_track_*&meta->>suivi=in.(${N.join(',')})&select=suivi:meta->>suivi,status:meta->>status,receivedAt:meta->>receivedAt,emailAt:meta->>emailAt,retireLe:meta->>retireLe,carrier:meta->>carrier`);
    if (tr === null) return { status: 503, raison: 'pas-su' };
    track = tr;
  }
  const s = suiviRetourVente({ ligne: { etape: 'en-route', retourLe: t[0].su || null, recu: false }, lu, aller, track });
  if (!s.arrive) return { status: 200, envoye: false, raison: s.raison === 'lu' ? 'pas-arrive' : s.raison };
  if (!(await pushCategorieActive('colis'))) return { status: 200, envoye: false, raison: 'preference' };
  // Le titre de la vente (par SA transaction).
  const v = await lire(`app_data?id=eq.harvest_${uid}_orders_sold&select=v:data->payload->my_orders`);
  if (v === null) return { status: 503, raison: 'pas-su' };
  const vente = ((v[0] && Array.isArray(v[0].v)) ? v[0].v : []).find((o) => o && String(o.transaction_id) === tx) || null;
  const reserve = await modifierCas(`push_retour_${tx}`, (d) => (d && d.envoye ? undefined : { v: 1, tx, envoye: true, at: new Date().toISOString() }));
  if (reserve === null) return { status: 503, raison: 'pas-su' };
  if (reserve === false) return { status: 200, envoye: false, raison: 'deja' };
  const n = texteRetourArrive(vente ? vente.title : '');
  const r = await sendPushToAll({ ...n, tag: `vrm-retour-${tx}`, url: DESTINATIONS.vente({ tx }), cat: 'colis' });
  if (r && r.coupe) return { status: 200, envoye: false, raison: r.coupe === 'preference' ? 'preference' : 'abonnement' };
  if (r && (r.attente || r.doublon)) return { status: 200, envoye: false, raison: r.attente ? 'dans-le-resume' : 'deja-dite' };
  if (!r || !(Number(r.sent) > 0)) return { status: 200, envoye: false, raison: r && r.erreur ? 'envoi-impossible' : 'aucun-appareil' };
  return { status: 200, envoye: true };
}
