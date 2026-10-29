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
//   5. l'arrivée au point relais n'est annoncée qu'UNE fois, toutes voies
//      confondues (revue du 24 oct.) : si l'e-mail du transporteur ou la
//      conversation Vinted l'ont déjà annoncée — par une IDENTITÉ : la
//      transaction (`relais-tx{tx}-*`), le n° de suivi de la ligne
//      (`relais-{n°}-*`), le code de retrait lu dans la conversation
//      (`retrait-code-{CODE}`) — on se tait ; sinon on pose `relais-…-sans`
//      pour qu'un e-mail SANS code venu ensuite ne re-sonne pas (un message qui
//      apporte le CODE sonne une fois de plus, la règle du 21 oct.) ;
//   6. la RÉSERVATION de l'étape, ATOMIQUE (revue du 24 oct. : lire puis écrire
//      `push_dedup` laissait deux appels simultanés envoyer chacun la sienne) :
//      une ligne par transaction, `push_suivi_{tx}`, écrite par COMPARER-ET-
//      ÉCHANGER sur `data.rev` (PATCH filtré, insertion `ignore-duplicates`) —
//      seul celui dont l'écriture est revenue envoie. La clé de l'étape est la
//      transaction + le LIBELLÉ normalisé, jamais l'instant : la même étape vue
//      par deux voies (le suivi, la page de la commande) à deux instants voisins
//      ne sonne qu'une fois. Illisible ⇒ 503 (rien n'est envoyé, l'extension
//      renverra) ; une notification en double ne se rattrape pas ; une retardée, si.
// Une étape de plus de 72 h ne sonne pas (pas de rattrapage), ni une étape datée
// dans le FUTUR (une livraison estimée n'est pas un évènement). Abonnement
// coupé : `sendPushToAll` se tait déjà.
// ────────────────────────────────────────────────────────────────────────────
import crypto from 'node:crypto';
import { sendPushToAll, pushCategorieActive } from './push.js';
import { proprietaireCourant } from './owner.js';
import { sbCle } from './cle.js';
import { etatColisDepuisTexte, normaliserSuivi } from './etat-colis-email.js';
import { cleCodeRetrait } from '../email-inbound.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxnb254enJ6amNxdGhqdGJkcHpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1ODIyMjYsImV4cCI6MjA5NTE1ODIyNn0.QJQSKILJLEpbDvBP4w7xD-olxoUjX1H2rxrYdo63GWQ';

export const SUIVI_NOTIF_AGE_MAX_MS = 72 * 3600000;
// Une étape datée plus loin que ça dans l'avenir n'est pas arrivée (horloges
// décalées de quelques minutes tolérées).
export const SUIVI_FUTUR_TOLERE_MS = 10 * 60000;

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
// COMPARER-ET-ÉCHANGER sur `data.rev`, au nom du vendeur (la forme de
// `modifierDonnee` et `modifierSubs`). `modifier(d)` reçoit `null` (ligne
// absente) ou l'objet lu et rend l'objet à écrire (sans `rev` : posé ici) ou
// `undefined` (rien à écrire). Il peut être appelé plusieurs fois.
// Rend true (écrit par NOUS) · false (rien à écrire) · null (pas su : une
// lecture ou une écriture a échoué, ou toujours devancé — rien n'est affirmé).
// (24 oct.) Exportée telle quelle : les lignes `transp_*` et `push_transp_*`
// (api/_lib/transporteurs-lecture.js) s'écrivent par la même règle.
export async function modifierCas(id, modifier, essais = 6) {
  const owner = proprietaireCourant();
  if (!owner || !/^[a-z0-9_]+$/i.test(String(id || ''))) return null;
  const tete = { ...sbCle(SUPABASE_KEY), 'Content-Type': 'application/json' };
  for (let n = 0; n < essais; n++) {
    const rows = await lire(`app_data?id=eq.${id}&select=data`);
    if (rows === null) return null;
    const present = !!rows[0];
    const d = present ? (rows[0].data || {}) : null;
    const nouveau = modifier(d);
    if (nouveau === undefined) return false;
    const rev0 = (d && Number.isSafeInteger(d.rev) && d.rev >= 0) ? d.rev : null;
    const data = { ...nouveau, rev: (rev0 || 0) + 1 };
    try {
      if (!present) {
        const w = await fetch(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=owner,id`, {
          method: 'POST', headers: { ...tete, Prefer: 'resolution=ignore-duplicates,return=representation' },
          body: JSON.stringify([{ owner, id, data }]),
        });
        if (!w.ok) return null;
        const out = await w.json().catch(() => null);
        if (!Array.isArray(out)) return null;
        if (out.length >= 1) return true;
        continue;                                   // créée entre-temps : on relit
      }
      const cond = rev0 == null ? 'data->>rev=is.null' : `data->>rev=eq.${rev0}`;
      const w = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${id}&owner=eq.${encodeURIComponent(owner)}&${cond}&select=id`, {
        method: 'PATCH', headers: { ...tete, Prefer: 'return=representation' }, body: JSON.stringify({ data }),
      });
      if (!w.ok) return null;
      const out = await w.json().catch(() => null);
      if (!Array.isArray(out)) return null;
      if (out.length >= 1) return true;
      // 0 ligne : un autre a écrit entre notre lecture et la nôtre — on relit
      // (une attente fixe et courte : notre base, pas Vinted).
      await new Promise((ok) => setTimeout(ok, 25 * (n + 1)));
    } catch (_) { return null; }
  }
  return null;
}
// Ce qui part sur le téléphone : un texte court, sans balise ni caractère de contrôle.
const propre = (s, n) => String(s == null ? '' : s).replace(/<[^>]*>/g, ' ').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

// Le libellé d'une étape, tel qu'on le compare : sans accents, sans casse, sans
// ponctuation — « Disponible au point relais. » et « disponible au point
// relais » sont la même étape.
export const libelleEtape = (t) => String(t == null ? '' : t).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
// La clé d'une étape : la transaction et son LIBELLÉ, jamais l'instant ni le code
// (la page de la commande et le suivi ne datent ni ne codent la même étape pareil).
export function empreinteEtape(tx, e) {
  return crypto.createHash('sha256').update(`${tx}|${libelleEtape(e && e.t)}`).digest('hex').slice(0, 16);
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
  const lignes = await lire(`app_data?id=eq.harvest_${uid}_suivi_${tx}&select=d:data->dernier,tx:data->>tx,s:data->>suivi`);
  if (lignes === null) return { status: 503, raison: 'pas-su' };
  const l = lignes[0];
  if (!l) return { status: 404, raison: 'inconnu' };
  if (l.tx != null && String(l.tx) !== tx) return { status: 404, raison: 'inconnu' };
  const dernier = (l.d && typeof l.d === 'object') ? l.d : null;
  if (!dernier || !propre(dernier.t, 140)) return { status: 200, envoye: false, raison: 'sans-etape' };
  const at = Date.parse(dernier.at || '');
  if (!Number.isFinite(at)) return { status: 200, envoye: false, raison: 'sans-date' };
  if (!(at > Date.now() - SUIVI_NOTIF_AGE_MAX_MS)) return { status: 200, envoye: false, raison: 'ancien' };
  if (at > Date.now() + SUIVI_FUTUR_TOLERE_MS) return { status: 200, envoye: false, raison: 'futur' };
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
  // 5. L'arrivée au point relais : déjà annoncée par l'e-mail ou la conversation ?
  const relais = etatColisDepuisTexte(dernier.t) === 'available';
  const n0 = normaliserSuivi(l.s || '');
  const numero = /^[A-Z0-9]{6,40}$/.test(n0) ? n0 : '';
  const aliasRelais = relais ? [`relais-tx${tx}-sans`, ...(numero ? [`relais-${numero}-sans`] : [])] : [];
  if (relais) {
    let memo = await lire('app_data?id=eq.push_dedup&select=data');
    if (memo === null) memo = await lire('app_data?id=eq.push_dedup&select=data');   // un hoquet : on relit une fois
    if (memo === null) return { status: 503, raison: 'pas-su' };
    const keys = (memo[0] && memo[0].data && Array.isArray(memo[0].data.keys)) ? memo[0].data.keys : [];
    const prefixes = [`relais-tx${tx}-`, ...(numero ? [`relais-${numero}-`] : [])];
    // Le code lu dans la conversation de CETTE transaction (une identité) : la
    // clé que l'e-mail ou la conversation ont posée en l'annonçant.
    const pc = await lire('app_data?id=eq.panel_colis_relais&select=data');
    if (pc === null) return { status: 503, raison: 'pas-su' };
    const ent = pc[0] && pc[0].data && pc[0].data[tx];
    const cleCode = ent && ent.code ? cleCodeRetrait(ent.code) : '';
    if (keys.some((k) => typeof k === 'string' && (prefixes.some((p) => k.startsWith(p)) || (cleCode && k === cleCode)))) {
      return { status: 200, envoye: false, raison: 'relais-deja' };
    }
  }
  // 6. Une fois par étape : la réservation ATOMIQUE, écrite AVANT l'envoi.
  const cle = `suivi-${tx}-${empreinteEtape(tx, dernier)}`;
  const reserve = await modifierCas(`push_suivi_${tx}`, (d) => {
    const keys = (d && Array.isArray(d.keys)) ? d.keys.filter((k) => typeof k === 'string') : [];
    if (keys.includes(cle)) return undefined;
    return { v: 1, tx, keys: [cle, ...keys].slice(0, 30), at: new Date().toISOString() };
  });
  if (reserve === null) return { status: 503, raison: 'pas-su' };
  if (reserve === false) return { status: 200, envoye: false, raison: 'deja' };
  // L'arrivée est annoncée : un e-mail ou une conversation SANS code venus
  // ensuite se tairont (au mieux : un raté ici ne coûte qu'une notification de plus).
  if (aliasRelais.length) {
    await modifierCas('push_dedup', (d) => {
      const keys = (d && Array.isArray(d.keys)) ? d.keys : [];
      const neuves = aliasRelais.filter((k) => !keys.includes(k));
      if (!neuves.length) return undefined;
      return { ...(d || {}), keys: [...neuves, ...keys].slice(0, 300) };
    });
  }
  const r = await sendPushToAll(n);
  if (r && r.coupe) return { status: 200, envoye: false, raison: 'abonnement' };
  // « Envoyée » seulement si un appareil l'a reçue (clé du serveur absente,
  // appareils illisibles ou aucun appareil : on le dit, sans mentir).
  if (!r || !(Number(r.sent) > 0)) return { status: 200, envoye: false, raison: r && r.erreur ? 'envoi-impossible' : 'aucun-appareil' };
  return { status: 200, envoye: true };
}
