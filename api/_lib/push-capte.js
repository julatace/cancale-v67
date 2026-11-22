// ════════════════════════════════════════════════════════════════════════════
//  « SUR MON TÉLÉPHONE » : CE QUE L'EXTENSION VIENT DE CAPTER (21 nov., ext. 5.422, `pushcapte`)
// ════════════════════════════════════════════════════════════════════════════
// Julien (21 nov.) : « quand l'extension capte une nouvelle vente, une offre reçue, un message
// reçu (Vinted, Leboncoin, Vestiaire), envoie une notification à mes appareils, une phrase qui
// dit quoi faire (« Vente : adidas samba taille 40 · Imprimer le bordereau », « Offre de 45 € ·
// Répondre »), un toucher ouvre l'écran sur l'élément ; jamais deux fois le même événement ;
// regroupement si plusieurs en 2 min ; réglage par type (vente et offre allumés par défaut) ;
// aucune donnée de l'acheteur au-delà du pseudo ; heures calmes réglables. »
//
// Le chemin : l'extension (background.js, `pousserCapte`) range chaque identité NOUVELLE
// (`annoncerCapteUn` : jamais l'historique, jamais une lecture ratée), attend 2 min après une
// sonnerie, puis appelle `POST /api/push { action:'capte', evenements:[{ s, p, c, id }] }`.
// ⚠️ LE CORPS NE PORTE QUE DES IDENTITÉS (sorte, site, compte, identifiant) — jamais un titre,
//    un prix, un pseudo ni un texte. Tout est RELU ICI, au nom du vendeur de la session, dans
//    SES lignes (projections scalaires, §4.4) : une vente qui n'est pas dans SA liste de
//    ventes, une offre qui n'attend pas dans SA conversation, un compte Vinted qui n'est pas
//    à lui ⇒ rien ne sonne (« vendue » se prouve, §5).
// ⚠️ JAMAIS DEUX FOIS : la clé de l'objet est réservée dans `push_dedup` (comparer-et-échanger,
//    AVANT l'envoi). Une vente porte la MÊME clé que les autres voies (e-mail « Vendu » de Vinted
//    `sale-tx{tx}`, passage des ventes Leboncoin `vendu-leboncoin-{id}`, Vestiaire
//    `vc-vente-{id}`) : la seconde voie se tait. Offre : son n° (Vinted `offer_request_id`) ;
//    message : sa conversation et l'instant de son dernier message.
// ⚠️ UNE LECTURE RATÉE N'ENVOIE RIEN ET NE RÉSERVE RIEN (503) : l'extension garde ses
//    événements et rappelle (au plus 24 h).
// Type coupé (`push_prefs.capte`, la famille d'abord) ⇒ rien ; heures calmes, regroupement du
// téléphone, centre de l'app : `sendPushToAll` (la règle de toutes les notifications).
// Plusieurs événements dans le même appel (les 2 min de l'extension) ⇒ UNE notification
// (« 3 nouveautés · 1 vente · 2 offres »).

import { sendPushToAll, prefsDuVendeur, langueDuVendeur } from './push.js';
import { modifierCas } from './suivi-vinted.js';
import { proprietaireCourant } from './owner.js';
import { sbCle } from './cle.js';
import { fetchAvecDelai } from './fetch-delai.js';
import { DESTINATIONS, lienNotif } from './lien-notif.js';
import { decisionNotif, capteActif, CAPTE_TYPES } from './notif-textes.js';
import { venteHorsPlanServeur } from './plan-vendeur.js';
import { lbcAnnulee } from './ventes-regle.js';
import { vcVenteAnnulee } from './vestiaire-regle.js';
import { montantClair } from './notif-redaction.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const SUPABASE_KEY = () => process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';

export const CAPTE_SORTES = ['vente', 'offre', 'message'];
export const CAPTE_SITES = ['vinted', 'leboncoin', 'vestiaire'];
export const CAPTE_MAX = 20;                 // événements par appel
export const VENTES_RELUES = 40;             // les 40 premières ventes de la liste (la plus récente en tête)
export const INBOX_RELUE = 40;
const TYPE_DE = { vente: 'ventes', offre: 'offres', message: 'messages' };
const CAT_DE = { vente: 'vente', offre: 'offre', message: 'message' };

const str = (v) => String(v == null ? '' : v).trim();
// Ce qui part sur le téléphone : un texte court, sans balise, sans caractère de contrôle.
const propre = (s, n) => str(s).replace(/<[^>]*>/g, ' ').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/https?:\/\/\S+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
// Un pseudo : lettres, chiffres, point, tiret, souligné — rien d'autre (ni nom, ni e-mail).
const pseudoSur = (s) => { const x = str(s); return /^[\w.-]{2,30}$/.test(x) && !/@/.test(x) ? x : ''; };
const RE_ISO = /^\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:?\d{2})?$/;

// ── 1. LA FORME DU CORPS (identités seulement) ─────────────────────────────
export function evenementCapte(x) {
  if (!x || typeof x !== 'object') return null;
  const s = str(x.s), p = str(x.p), c = str(x.c), id = str(x.id);
  if (!CAPTE_SORTES.includes(s) || !CAPTE_SITES.includes(p)) return null;
  if (p === 'vinted') {
    if (!/^\d{1,20}$/.test(c)) return null;
    if (s === 'vente') return /^\d{1,20}$/.test(id) ? { s, p, c, id, tx: id } : null;
    const m = /^(\d{1,20})@(.{1,40})$/.exec(id);
    if (!m) return null;
    if (s === 'offre') return /^\d{1,20}$/.test(m[2]) ? { s, p, c, id, conv: m[1], oid: m[2] } : null;
    return RE_ISO.test(m[2]) ? { s, p, c, id, conv: m[1], at: m[2] } : null;
  }
  if (p === 'leboncoin') {
    if (!/^[\w.-]{1,80}$/.test(c)) return null;
    if (s === 'vente') return /^[\w-]{1,64}$/.test(id) ? { s, p, c, id } : null;
    if (s === 'message') return /^[\w-]{1,80}:[\w-]{1,80}$/.test(id) ? { s, p, c, id } : null;
    return null;                                     // Leboncoin : aucune offre captée
  }
  if (!/^[\w-]{1,40}$/.test(c)) return null;           // Vestiaire
  if (s === 'vente') return /^[\w-]{1,40}$/.test(id) ? { s, p, c, id } : null;
  if (s === 'offre') { const m = /^([\w-]{1,40})@(.{1,40})$/.exec(id); return m && RE_ISO.test(m[2]) ? { s, p, c, id, oid: m[1], at: m[2] } : null; }
  return /^[\w-]{1,80}:[\w-]{1,80}$/.test(id) ? { s, p, c, id } : null;
}
export function evenementsCapte(liste) {
  const out = [], vus = new Set();
  for (const x of Array.isArray(liste) ? liste.slice(0, CAPTE_MAX * 3) : []) {
    const e = evenementCapte(x);
    if (!e) continue;
    const k = cleCapte(e);
    if (vus.has(k)) continue;
    vus.add(k); out.push(e);
    if (out.length >= CAPTE_MAX) break;
  }
  return out;
}

// ── 2. LA CLÉ DE L'OBJET (push_dedup) ──────────────────────────────────────
const net = (s) => str(s).replace(/[^\w-]+/g, '_').slice(0, 90);
export function cleCapte(e) {
  if (e.s === 'vente') return e.p === 'vinted' ? `sale-tx${e.id}` : e.p === 'leboncoin' ? `vendu-leboncoin-${e.id}` : `vc-vente-${e.id}`;
  if (e.s === 'offre') return e.p === 'vinted' ? `offer-capte-vinted-${e.oid}` : `offer-capte-${e.p}-${net(e.id)}`;
  return `msg-capte-${e.p}-${net(e.id)}`;
}

// ── 3. CE QUI EST RELU (au nom du vendeur, projections scalaires) ───────────
async function lire(chemin) {
  const owner = proprietaireCourant();
  if (!owner) return null;
  try {
    const r = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/${chemin}${chemin.includes('?') ? '&' : '?'}owner=eq.${encodeURIComponent(owner)}`, { headers: { ...sbCle(SUPABASE_KEY()) } });
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j) ? j : null;
  } catch (_) { return null; }
}
const idx = (alias, chemin, n) => Array.from({ length: n }, (_, i) => `${alias}${i}:${chemin}->${i}`).join(',');
const PAS_UNE_VENTE = /annul|rembours|cancel|refund|[ée]chou|suspend|retour/i;
const prixDe = (v) => { const a = v && typeof v === 'object' ? (v.amount != null ? v.amount : v.valeur) : v; const n = Number(String(a == null ? '' : a).replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : null; };
const tailleDe = (o) => propre(o && (o.size_title || o.size || o.taille), 12);
const cleLbc = (c) => str(c).replace(/^lbc-account:/i, '');

// Rend { d } (détails sûrs) · { rien: 'raison' } (pas prouvé : ne sonne pas) · null (pas su).
export async function relireCapte(e, memo = new Map()) {
  const une = async (k, chemin) => { if (!memo.has(k)) memo.set(k, await lire(chemin)); return memo.get(k); };
  if (e.p === 'vinted') {
    const comptes = await une('acc:' + e.c, `vinted_accounts?vinted_user_id=eq.${encodeURIComponent(e.c)}&select=vinted_user_id`);
    if (comptes === null) return null;
    if (!comptes.some((x) => str(x && x.vinted_user_id) === e.c)) return { rien: 'compte' };
    if (e.s === 'vente') {
      const rows = await une('ventes:' + e.c, `app_data?id=eq.harvest_${e.c}_orders_sold&select=${idx('o', 'data->payload->my_orders', VENTES_RELUES)}`);
      if (rows === null) return null;
      const r0 = rows[0] || {};
      const o = Object.keys(r0).map((k) => r0[k]).find((x) => x && typeof x === 'object' && str(x.transaction_id) === e.tx);
      if (!o) return { rien: 'pas-dans-ses-ventes' };
      if (PAS_UNE_VENTE.test(str(o.status))) return { rien: 'pas-une-vente' };
      return { d: { titre: propre(o.title, 70), taille: tailleDe(o), prix: prixDe(o.price) } };
    }
    if (e.s === 'offre') {
      const rows = await une('conv:' + e.c + ':' + e.conv, `app_data?id=eq.harvest_${e.c}_conv_${e.conv}&select=cid:data->payload->conversation->>id,opp:data->payload->conversation->opposite_user->>id,login:data->payload->conversation->opposite_user->>login,ti:data->payload->conversation->transaction->>item_title,msgs:data->payload->conversation->messages`);
      if (rows === null) return null;
      const r = rows[0];
      if (!r || str(r.cid) !== e.conv) return { rien: 'conversation' };
      const opp = r.opp != null && r.opp !== '' ? Number(r.opp) : null;
      // L'offre de CETTE conversation, par SON n°, faite par l'autre personne, encore en attente
      // (la règle de l'extension `derniereOffreEnAttente` : statut 10, pas « acceptée / refusée / expirée »).
      const m = (Array.isArray(r.msgs) ? r.msgs : []).find((x) => x && x.entity_type === 'offer_request_message' && x.entity && str(x.entity.offer_request_id) === e.oid);
      const en = m && m.entity;
      if (!en || (opp != null && en.user_id !== opp) || en.current === false || en.status !== 10 || /accept|refus|reject|expir|annul|cancel|retir/i.test(str(en.status_title))) return { rien: 'offre-pas-en-attente' };
      const prix = prixDe(en.price);
      if (prix == null) return { rien: 'prix' };
      return { d: { prix, pseudo: pseudoSur(r.login), titre: propre(r.ti, 70) } };
    }
    const rows = await une('inbox:' + e.c, `app_data?id=eq.harvest_${e.c}_inbox&select=${idx('c', 'data->payload->conversations', INBOX_RELUE)}`);
    if (rows === null) return null;
    const r0 = rows[0] || {};
    const cv = Object.keys(r0).map((k) => r0[k]).find((x) => x && typeof x === 'object' && str(x.id) === e.conv);
    if (!cv || cv.unread !== true) return { rien: 'pas-non-lu' };
    return { d: { pseudo: pseudoSur(cv.opposite_user && cv.opposite_user.login) } };
  }
  if (e.p === 'leboncoin') {
    if (e.s !== 'vente') return { d: {} };            // un message : Leboncoin ne dit pas qui (jamais de nom)
    const rows = await une('lbc:' + e.id, `app_data?id=eq.lbc_ventes&select=v:data->ventes->%22${encodeURIComponent(e.id)}%22`);
    if (rows === null) return null;
    const v = rows[0] && rows[0].v;
    if (!v || typeof v !== 'object' || v.isSeller !== true || cleLbc(v.account) !== cleLbc(e.c)) return { rien: 'pas-dans-ses-ventes' };
    if (lbcAnnulee(v)) return { rien: 'pas-une-vente' };
    const c = Number(v.price);
    return { d: { titre: propre(v.title, 70), prix: Number.isFinite(c) && c > 0 ? c / 100 : null } };
  }
  // Vestiaire
  if (e.s === 'vente') {
    const rows = await une('vc:' + e.id, `app_data?id=eq.vc_ventes&select=v:data->ventes->%22${encodeURIComponent(e.id)}%22`);
    if (rows === null) return null;
    const v = rows[0] && rows[0].v;
    if (!v || typeof v !== 'object' || (v.compte && str(v.compte) !== e.c)) return { rien: 'pas-dans-ses-ventes' };
    if (vcVenteAnnulee(v)) return { rien: 'pas-une-vente' };
    return { d: { titre: propre(v.titre, 70), prix: v.prixVente && v.prixVente.devise === 'EUR' ? prixDe(v.prixVente) : null } };
  }
  if (e.s === 'offre') {
    const rows = await une('vco:' + e.oid, `app_data?id=eq.vc_offres&select=o:data->offres->n${encodeURIComponent(e.oid)}`);
    if (rows === null) return null;
    const o = rows[0] && rows[0].o;
    if (!o || typeof o !== 'object' || o.aToi !== true || !o.dernier || str(o.dernier.at) !== e.at || (o.compte && str(o.compte) !== e.c)) return { rien: 'offre-pas-en-attente' };
    const cents = Number(o.dernier.cents != null ? o.dernier.cents : o.offre);
    return { d: { titre: propre(o.titre, 70), prix: Number.isFinite(cents) && cents > 0 ? cents / 100 : null } };
  }
  return { d: {} };
}

// ── 4. LES TEXTES (cinq langues) ───────────────────────────────────────────
const SITE = { leboncoin: 'Leboncoin', vestiaire: 'Vestiaire' };
const L = {
  fr: { vente: 'Vente', taille: 'taille', bord: 'Imprimer le bordereau', envoi: 'Prépare l’envoi', offre: 'Offre de', repondre: 'Répondre', message: 'Message de', nouveauMsg: 'Nouveau message', sur: 'sur',
    n: (k) => `${k} nouveautés`, ventes: (k) => `${k} vente${k > 1 ? 's' : ''}`, offres: (k) => `${k} offre${k > 1 ? 's' : ''}`, messages: (k) => `${k} message${k > 1 ? 's' : ''}` },
  en: { vente: 'Sale', taille: 'size', bord: 'Print the label', envoi: 'Get the parcel ready', offre: 'Offer of', repondre: 'Reply', message: 'Message from', nouveauMsg: 'New message', sur: 'on',
    n: (k) => `${k} new items`, ventes: (k) => `${k} sale${k > 1 ? 's' : ''}`, offres: (k) => `${k} offer${k > 1 ? 's' : ''}`, messages: (k) => `${k} message${k > 1 ? 's' : ''}` },
  es: { vente: 'Venta', taille: 'talla', bord: 'Imprimir la etiqueta', envoi: 'Prepara el envío', offre: 'Oferta de', repondre: 'Responder', message: 'Mensaje de', nouveauMsg: 'Nuevo mensaje', sur: 'en',
    n: (k) => `${k} novedades`, ventes: (k) => `${k} venta${k > 1 ? 's' : ''}`, offres: (k) => `${k} oferta${k > 1 ? 's' : ''}`, messages: (k) => `${k} mensaje${k > 1 ? 's' : ''}` },
  it: { vente: 'Vendita', taille: 'taglia', bord: 'Stampa l’etichetta', envoi: 'Prepara la spedizione', offre: 'Offerta di', repondre: 'Rispondi', message: 'Messaggio da', nouveauMsg: 'Nuovo messaggio', sur: 'su',
    n: (k) => `${k} novità`, ventes: (k) => `${k} vendit${k > 1 ? 'e' : 'a'}`, offres: (k) => `${k} offert${k > 1 ? 'e' : 'a'}`, messages: (k) => `${k} messagg${k > 1 ? 'i' : 'io'}` },
  de: { vente: 'Verkauf', taille: 'Größe', bord: 'Versandetikett drucken', envoi: 'Versand vorbereiten', offre: 'Angebot über', repondre: 'Antworten', message: 'Nachricht von', nouveauMsg: 'Neue Nachricht', sur: 'auf',
    n: (k) => `${k} Neuigkeiten`, ventes: (k) => `${k} Verk${k > 1 ? 'äufe' : 'auf'}`, offres: (k) => `${k} Angebot${k > 1 ? 'e' : ''}`, messages: (k) => `${k} Nachricht${k > 1 ? 'en' : ''}` },
};
const lng = (l) => (L[l] ? l : 'fr');
export function texteCapte(e, d = {}, langue = 'fr') {
  const t = L[lng(langue)];
  const site = SITE[e.p] ? `${t.sur} ${SITE[e.p]}` : '';
  const prix = d.prix != null ? montantClair(d.prix, lng(langue)) : '';
  const pseudo = d.pseudo ? '@' + d.pseudo : '';
  if (e.s === 'vente') {
    const quoi = [d.titre || '', d.taille && !new RegExp(`\\b${d.taille.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(d.titre || '') ? `${t.taille} ${d.taille}` : ''].filter(Boolean).join(' ');
    return { title: quoi ? `${t.vente} : ${quoi}` : t.vente, body: [prix, site, e.p === 'leboncoin' ? t.envoi : t.bord].filter(Boolean).join(' · ') };
  }
  if (e.s === 'offre') return { title: prix ? `${t.offre} ${prix}` : t.offre.replace(/\s+\S+$/, ''), body: [pseudo, d.titre || '', site, t.repondre].filter(Boolean).join(' · ') };
  return { title: pseudo ? `${t.message} ${pseudo}` : t.nouveauMsg, body: [d.titre || '', site, t.repondre].filter(Boolean).join(' · ') };
}
export function texteGroupeCapte(evs, langue = 'fr') {
  const t = L[lng(langue)];
  const n = (s) => evs.filter((e) => e.s === s).length;
  const parts = [n('vente') ? t.ventes(n('vente')) : '', n('offre') ? t.offres(n('offre')) : '', n('message') ? t.messages(n('message')) : ''].filter(Boolean);
  return { title: t.n(evs.length), body: parts.join(' · ') };
}

// ── 5. OÙ MÈNE LE TOUCHER ──────────────────────────────────────────────────
export function urlCapte(e) {
  if (e.p === 'vinted') {
    if (e.s === 'vente') return DESTINATIONS.vente({ tx: e.tx });
    if (e.s === 'offre') return DESTINATIONS.offre({ conv: e.conv, compte: e.c });
    return DESTINATIONS.message({ conv: e.conv, compte: e.c });
  }
  if (e.p === 'leboncoin') return e.s === 'vente' ? lienNotif('ventes', { site: 'leboncoin', cible: 'lbcvente', tx: e.id }) : lienNotif('messages', { site: 'leboncoin' });
  if (e.s === 'vente') return DESTINATIONS.vcVente({ id: e.id });
  return e.s === 'offre' ? DESTINATIONS.vcOffres() : lienNotif('messages', { site: 'vestiaire' });
}
export function urlGroupeCapte(evs) {
  if (evs.every((e) => e.s === 'vente')) return lienNotif('ventes');
  if (evs.every((e) => e.s !== 'vente')) { const sites = [...new Set(evs.map((e) => e.p))]; return lienNotif('messages', sites.length === 1 ? { site: sites[0] } : {}); }
  return lienNotif('journee');
}

// ── 6. LA ROUTE ────────────────────────────────────────────────────────────
// Rend { status, envoye?, n?, deja?, coupe?, rien?, raison? }.
export async function notifierCapte(body) {
  const evs = evenementsCapte(body && body.evenements);
  if (!evs.length) return { status: 400, raison: 'evenements' };
  const owner = proprietaireCourant();
  if (!owner) return { status: 401, raison: 'session' };
  const prefs = (await prefsDuVendeur()) || {};
  // Le type (et sa famille) : coupé ⇒ rien, ni relu ni réservé.
  const permis = evs.filter((e) => capteActif(prefs, TYPE_DE[e.s]) && decisionNotif(prefs, CAT_DE[e.s]));
  const coupe = evs.length - permis.length;
  if (!permis.length) return { status: 200, envoye: false, coupe, n: 0 };
  // Relire chaque objet ; une lecture ratée ⇒ rien n'est envoyé ni réservé.
  const memo = new Map();
  const prouves = [];
  let rien = 0;
  for (const e of permis) {
    if (e.s === 'vente' && e.p === 'vinted') {
      let hors = null; try { hors = await venteHorsPlanServeur(owner, e.c); } catch (_) { hors = null; }
      if (hors === true) { rien++; continue; }      // (9 nov.) Solo : un compte d'achat ne sonne pas ; pas su ⇒ il sonne
    }
    const r = await relireCapte(e, memo);
    if (r === null) return { status: 503, raison: 'pas-su' };
    if (r.rien) { rien++; continue; }
    prouves.push({ e, d: r.d || {} });
  }
  if (!prouves.length) return { status: 200, envoye: false, coupe, rien, n: 0 };
  // Jamais deux fois : réservé AVANT l'envoi, en UN comparer-et-échanger.
  let neufs = [];
  const res = await modifierCas('push_dedup', (d) => {
    const ks = d && Array.isArray(d.keys) ? d.keys.filter((x) => typeof x === 'string') : [];
    neufs = prouves.filter((x) => !ks.includes(cleCapte(x.e)));
    if (!neufs.length) return undefined;
    return { ...(d || {}), keys: [...neufs.map((x) => cleCapte(x.e)), ...ks].slice(0, 300) };
  });
  if (res === null) return { status: 503, raison: 'pas-su' };
  const deja = prouves.length - neufs.length;
  if (res === false || !neufs.length) return { status: 200, envoye: false, coupe, rien, deja, n: 0 };
  const langue = await langueDuVendeur().catch(() => 'fr');
  let envoi;
  if (neufs.length === 1) {
    const { e, d } = neufs[0];
    const t = texteCapte(e, d, langue);
    envoi = await sendPushToAll({ cat: CAT_DE[e.s], title: t.title, body: t.body, tag: cleCapte(e), cle: cleCapte(e), url: urlCapte(e) });
  } else {
    const l = neufs.map((x) => x.e);
    const t = texteGroupeCapte(l, langue);
    const principal = l.find((e) => e.s === 'vente') || l.find((e) => e.s === 'offre') || l[0];
    const cle = 'capte-groupe-' + l.map(cleCapte).sort().join('|').slice(0, 200);
    envoi = await sendPushToAll({ cat: CAT_DE[principal.s], title: t.title, body: t.body, tag: 'capte-groupe', cle, url: urlGroupeCapte(l) });
  }
  return { status: 200, envoye: !!(envoi && (envoi.sent > 0 || envoi.calme || envoi.attente)), n: neufs.length, coupe, rien, deja, ...(envoi && envoi.calme ? { calme: true } : {}) };
}
export { CAPTE_TYPES };
