// api/_lib/suivi-vinted.js
// ────────────────────────────────────────────────────────────────────────────
// « 📦 UNE ÉTAPE DE PLUS » — le suivi que VINTED montre d'un ACHAT a changé
// (23 octobre, extension 5.214).
//
// L'extension range, pour chaque achat suivi, `harvest_{uid}_suivi_{tx}` (le
// CONTRAT : `etapes`, `dernier`, `transporteur`, `suivi`, `forme`) puis appelle
// `POST /api/push { action: 'suivi', tx, uid }` avec la session VRM. Elle ne
// donne QUE la transaction et le compte : on ne croit pas ce qu'elle dirait de
// l'étape. On relit, AU NOM du vendeur de la session (chaque lecture porte
// `owner=eq.<lui>` — jamais la clé de service sans filtre) :
//   1. le compte Vinted `uid` doit être à CE vendeur (sinon 403 : on ne sonne
//      jamais pour le colis d'un autre) ;
//   2. sa ligne de suivi (illisible ⇒ 503 « pas su » : l'extension renverra) ;
//   3. la commande ACHETÉE de cette transaction (`harvest_{uid}_orders_purchased`,
//      par l'identité de la transaction — jamais un titre) pour le titre ; pas un
//      achat ⇒ 404, rien ne sonne ;
//   4. la préférence « suivi » (Réglages → Notifications, la préférence existante,
//      coupée par défaut) ;
//   5. le mémo anti-doublon `push_dedup`, en TROIS états : la clé est l'empreinte
//      de l'étape (transaction + instant + libellé + code) — une fois par étape ;
//      mémo illisible ⇒ 503 (rien n'est envoyé, l'extension renverra) ; la clé est
//      ÉCRITE avant l'envoi, et seulement si l'écriture a réussi on envoie (une
//      notification en double ne se rattrape pas ; une retardée, si).
// Une étape de plus de 72 h ne sonne pas (pas de rattrapage). Abonnement coupé :
// `sendPushToAll` se tait déjà.
// ────────────────────────────────────────────────────────────────────────────
import crypto from 'node:crypto';
import { sendPushToAll, pushCategorieActive } from './push.js';
import { proprietaireCourant } from './owner.js';
import { sbCle } from './cle.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxnb254enJ6amNxdGhqdGJkcHpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1ODIyMjYsImV4cCI6MjA5NTE1ODIyNn0.QJQSKILJLEpbDvBP4w7xD-olxoUjX1H2rxrYdo63GWQ';

export const SUIVI_NOTIF_AGE_MAX_MS = 72 * 3600000;

// Une lecture AU NOM du vendeur de la requête : `null` = pas su (la base n'a pas
// répondu, ou pas de vendeur) ; un tableau sinon.
async function lire(chemin) {
  const owner = proprietaireCourant();
  if (!owner) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${chemin}${chemin.includes('?') ? '&' : '?'}owner=eq.${encodeURIComponent(owner)}`, { headers: { ...sbCle(SUPABASE_KEY) } });
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j) ? j : null;
  } catch (_) { return null; }
}
async function ecrire(id, data) {
  const owner = proprietaireCourant();
  if (!owner) return false;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=owner,id`, {
      method: 'POST',
      headers: { ...sbCle(SUPABASE_KEY), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ owner, id, data }]),
    });
    return !!(r && r.ok);
  } catch (_) { return false; }
}
// Ce qui part sur le téléphone : un texte court, sans balise ni caractère de contrôle.
const propre = (s, n) => String(s == null ? '' : s).replace(/<[^>]*>/g, ' ').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

export function empreinteEtape(tx, e) {
  return crypto.createHash('sha256').update(`${tx}|${(e && e.at) || ''}|${(e && e.t) || ''}|${(e && e.code) || ''}`).digest('hex').slice(0, 16);
}
export function notifSuivi(titre, dernier, tx) {
  const t = propre(dernier && dernier.t, 140);
  if (!t) return null;
  const nom = propre(titre, 60);
  return {
    title: nom ? `📦 ${nom}` : '📦 Ton colis',
    body: `Vinted : « ${t} »`,
    tag: `vrm-suivi-${tx}`,
    url: '/?tab=cat_achats',
  };
}

// Rend { status, envoye?, raison? }.
export async function notifierSuiviVinted(tx, uid) {
  tx = String(tx == null ? '' : tx); uid = String(uid == null ? '' : uid);
  if (!/^\d{4,20}$/.test(tx)) return { status: 400, raison: 'transaction' };
  if (!/^\d{1,20}$/.test(uid)) return { status: 400, raison: 'compte' };
  // 1. Le compte Vinted est-il à CE vendeur ?
  const comptes = await lire(`vinted_accounts?vinted_user_id=eq.${encodeURIComponent(uid)}&select=vinted_user_id`);
  if (comptes === null) return { status: 503, raison: 'pas-su' };
  if (!comptes.some((c) => String(c && c.vinted_user_id) === uid)) return { status: 403, raison: 'compte' };
  // 2. Sa ligne de suivi.
  const lignes = await lire(`app_data?id=eq.harvest_${uid}_suivi_${tx}&select=d:data->dernier,tx:data->>tx`);
  if (lignes === null) return { status: 503, raison: 'pas-su' };
  const l = lignes[0];
  if (!l) return { status: 404, raison: 'inconnu' };
  if (l.tx != null && String(l.tx) !== tx) return { status: 404, raison: 'inconnu' };
  const dernier = (l.d && typeof l.d === 'object') ? l.d : null;
  if (!dernier || !propre(dernier.t, 140)) return { status: 200, envoye: false, raison: 'sans-etape' };
  const at = Date.parse(dernier.at || '');
  if (!Number.isFinite(at)) return { status: 200, envoye: false, raison: 'sans-date' };
  if (!(at > Date.now() - SUIVI_NOTIF_AGE_MAX_MS)) return { status: 200, envoye: false, raison: 'ancien' };
  // 3. La commande ACHETÉE de cette transaction (son titre) — par l'identité.
  const achats = await lire(`app_data?id=eq.harvest_${uid}_orders_purchased&select=v:data->payload->my_orders`);
  if (achats === null) return { status: 503, raison: 'pas-su' };
  const liste = (achats[0] && Array.isArray(achats[0].v)) ? achats[0].v : [];
  const commande = liste.find((o) => o && String(o.transaction_id) === tx);
  if (!commande) return { status: 404, raison: 'pas-un-achat' };
  // 4. La préférence « suivi ».
  if (!(await pushCategorieActive('suivi'))) return { status: 200, envoye: false, raison: 'preference' };
  const n = notifSuivi(commande.title, dernier, tx);
  if (!n) return { status: 200, envoye: false, raison: 'sans-etape' };
  // 5. Une fois par étape : le mémo en trois états, la clé écrite AVANT l'envoi.
  const cle = `suivi-${tx}-${empreinteEtape(tx, dernier)}`;
  let memo = await lire('app_data?id=eq.push_dedup&select=data');
  if (memo === null) memo = await lire('app_data?id=eq.push_dedup&select=data');   // un hoquet : on relit une fois
  if (memo === null) return { status: 503, raison: 'pas-su' };
  const keys = (memo[0] && memo[0].data && Array.isArray(memo[0].data.keys)) ? memo[0].data.keys : [];
  if (keys.includes(cle)) return { status: 200, envoye: false, raison: 'deja' };
  const ok = await ecrire('push_dedup', { keys: [cle, ...keys.filter((k) => k !== cle)].slice(0, 300) });
  if (!ok) return { status: 503, raison: 'pas-su' };
  const r = await sendPushToAll(n);
  if (r && r.coupe) return { status: 200, envoye: false, raison: 'abonnement' };
  // « Envoyée » seulement si un appareil l'a reçue (clé du serveur absente,
  // appareils illisibles ou aucun appareil : on le dit, sans mentir).
  if (!r || !(Number(r.sent) > 0)) return { status: 200, envoye: false, raison: r && r.erreur ? 'envoi-impossible' : 'aucun-appareil' };
  return { status: 200, envoye: true };
}
