// api/ship-reminders.js
// ────────────────────────────────────────────────────────────────────────────
// RAPPEL D'EXPÉDITION (cron quotidien, ~7 h à Paris l'été, ~6 h l'hiver).
//
// Vinted pénalise les colis expédiés en retard. Ce job prend les ventes que
// Vinted dit encore À EXPÉDIER (`txsAExpedier` : la règle du rappel du soir, du
// widget et de l'app — un bordereau IMPRIMÉ n'est pas un colis parti), leur date
// limite AVEC SON HEURE (api/_lib/limite-envoi.js : l'email du bordereau, sinon
// vente + 7 jours, estimée), garde celles en retard, dues aujourd'hui ou demain,
// et envoie UNE notification récapitulative sur les appareils du vendeur.
//
// Il porte aussi, faute d'un second cron : le rappel URSSAF du 1er du mois, et
// le BILAN DE LA SEMAINE — envoyé le DIMANCHE SOIR (via le cron du soir), avec
// le lundi matin en RATTRAPAGE (même clé de dédoublonnage, un seul bilan par
// semaine ; api/_lib/bilan-semaine.js dit le pourquoi).
// Et, appelé par le SECOND cron (`/api/rappel-soir`, réécrit en `?moment=soir`, 18:00 UTC), le RAPPEL DE LA
// VEILLE AU SOIR (« Demain : N colis à poster ») — plus, le dimanche, le bilan de la semaine.
//
// ⚠ N'appelle JAMAIS l'API Vinted (aucun risque de blocage) : il ne lit que
//   Supabase et envoie une notification. Déclenché par le cron Vercel (vercel.json).
// ────────────────────────────────────────────────────────────────────────────

import './_lib/sans-bruit.js';
import { sendPushToAll, pushCategorieActive } from './_lib/push.js';
import { semainePassee, semaineCourante, calculerBilan, bilanAEnvoyer, texteBilan, versementsDeLignes } from './_lib/bilan-semaine.js';
import { notificationUrssaf, rappelAvantEcheance, MAIN_URSSAF } from './_lib/rappel-urssaf.js';
// « À expédier » : la règle du widget (elle-même jugée identique à celle de
// l'app et de l'extension par audit-statuts.cjs). Importée, jamais recopiée.
import { aExpedier } from './widget.js';
// La date limite d'envoi (avec son heure) : UNE règle, celle de l'app (§11).
import { bordsParTransaction, compterEcheances, heureCourte } from './_lib/limite-envoi.js';

import { withOwnerAll, conflictTarget, contexteVendeur, proprietaireCourant } from './_lib/owner.js';
import { sbCle } from './_lib/cle.js';
import { comptesActifs, normaliserRegistre } from './_lib/ebay.js';
import { colisEbay, resumeColisEbay, lireCommandesEbayServeur } from './_lib/ebay-a-expedier.js';
import { relireCommandesVendeur } from './_lib/ebay-relecture.js';
import { rappelsRetraitDuJour, texteRappelRetrait, SELECT_SUIVI_META, txDuColis, liensDesLignes, finDesTransactions, SELECT_TRANSP_META, ligneTranspDeMeta } from './_lib/suivi-colis.js';
// (24 oct.) Le statut des colis lu chez leur transporteur (C1, C5).
import { passageTransporteurs, MAX_CRON, BUDGET_CRON_MS } from './_lib/transporteurs-lecture.js';
import { accesVendeur } from './_lib/abonnement.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
// ⚠️ CLÉ DE SERVICE QUAND ELLE EXISTE. Ces routes tournent sur le serveur, sans
// vendeur connecté : à la seconde où la base est cloisonnée (RLS), la clé
// publique ne peut plus rien lire ni écrire et l'endpoint devient muet — c'est
// LE blocage qui empêchait d'activer le multi-vendeurs. On prend donc
// `SUPABASE_SERVICE_KEY` (variable d'environnement Vercel, jamais dans le
// dépôt) si elle est définie, et on retombe sur la clé publique tant qu'elle ne
// l'est pas : le comportement d'aujourd'hui reste identique.
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxnb254enJ6amNxdGhqdGJkcHpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1ODIyMjYsImV4cCI6MjA5NTE1ODIyNn0.QJQSKILJLEpbDvBP4w7xD-olxoUjX1H2rxrYdo63GWQ';
const HEADERS = { ...sbCle(SUPABASE_KEY) };
const VENDEURS_EN_PARALLELE = 8;

// Date du jour (et de demain) dans le fuseau de Paris, en 'YYYY-MM-DD'.
function parisDate(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' }); // 'YYYY-MM-DD'
}
// Trois états, jamais deux : la ligne (objet) · `null` = elle n'existe pas ·
// `undefined` = la base n'a pas répondu (« rien lu » ne vaut pas « rien »).
async function getRow(id) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${scoped(`app_data?id=eq.${encodeURIComponent(id)}&select=data`)}`, { headers: HEADERS });
    if (!r.ok) return undefined;
    const rows = await r.json();
    if (!Array.isArray(rows)) return undefined;
    return (rows[0] && rows[0].data) || null;
  } catch (_) { return undefined; }
}
// ── MULTI-VENDEURS ────────────────────────────────────────────────────────────
// Ce cron tourne SANS vendeur connecté. Tant que la base n'était pas cloisonnée,
// il calculait UN total global et le poussait à tout le monde (`sendPushToAll`) :
// juste tant qu'il n'y a qu'un vendeur, faux dès qu'il y en a deux (le résumé de
// l'un part sur le téléphone de l'autre). On tourne donc une fois PAR vendeur,
// dans son contexte (`contexteVendeur`), et toutes les lectures/écritures se
// filtrent sur `owner` — exactement l'infra que le pipeline email utilise déjà.
//
// `scoped(path)` ajoute `owner=eq.<vendeur du tour>` ; vide hors boucle (base non
// cloisonnée) → URL inchangée, comportement d'aujourd'hui À L'IDENTIQUE.
function scoped(path) {
  const o = proprietaireCourant();
  return o ? path + (path.includes('?') ? '&' : '?') + `owner=eq.${encodeURIComponent(o)}` : path;
}
// La base sait-elle séparer les vendeurs ? 200 = oui · 400 (colonne absente) =
// non · tout le reste = PAS SU (`null`). ⚠️ Une panne prise pour « non » faisait
// basculer le cron en passe GLOBALE sur une base cloisonnée : les bordereaux de
// tous les vendeurs comptés ensemble, et le résumé poussé sans vendeur — le
// mélange que la boucle par vendeur existe pour empêcher. (push.js avait le même
// défaut, corrigé le 4 octobre.)
async function cloisonnee() {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?select=owner&limit=1`, { headers: HEADERS });
    if (r.ok) return true;
    if (r.status === 400) return false;
    return null;
  } catch (_) { return null; }
}
// Les vendeurs actifs = un `main` par vendeur (clé (owner,id)). La clé de service
// contourne RLS → on les voit tous. `null` si on ne peut pas énumérer (lecture en
// panne) → on ne devine pas, on ne pousse rien plutôt qu'un résumé mélangé.
async function ownersActifs() {
  const rows = await fetchPaginated('app_data?id=eq.main&select=owner');
  if (!rows) return null;
  const s = new Set();
  for (const r of rows) if (r && r.owner) s.add(String(r.owner));
  return [...s];
}
// Écrit un mémo de dédoublonnage POUR LE VENDEUR DU TOUR (clé (owner,id) quand on
// est cloisonné, `id` seul sinon). Sans ça, deux vendeurs partageraient le même
// `ship_reminder_dedup` et l'un ferait taire l'autre.
async function ecrireDedup(id, data) {
  const o = proprietaireCourant();
  const row = o ? { owner: o, id, data } : withOwnerAll([{ id, data }])[0];
  const conflict = o ? 'owner,id' : conflictTarget('id');
  // Rend VRAI seulement si la base a confirmé : le bilan de la semaine ne part
  // QUE si son mémo est rangé (sinon il repartirait le lendemain — deux bilans).
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=${conflict}`, {
      method: 'POST',
      headers: { ...HEADERS, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([row]),
    });
    return !!(r && r.ok);
  } catch (_) { return false; /* un mémo raté n'empêche pas le rappel suivant */ }
}
// ⚠️ §4.5 — Supabase tronque à 1000 lignes SANS LE DIRE. Ce cron balaie
// `email_bord_*` et `harvest_%25_orders_sold` de TOUS les utilisateurs : à
// l'échelle, au-delà de 1000 lignes il en perdrait en silence → des vendeurs
// sans rappel d'expédition. On pagine, et `null` si une page échoue (jamais une
// demi-liste prise pour complète — même règle que `sbGetTout` côté app).
async function fetchPaginated(path) {
  const out = []; const page = 1000;
  for (let from = 0; from < 500000; from += page) {
    let r;
    try { r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { ...HEADERS, 'Range-Unit': 'items', Range: `${from}-${from + page - 1}` } }); }
    catch (_) { return null; }
    if (!r.ok) return null;
    let j; try { j = await r.json(); } catch (_) { return null; }
    if (!Array.isArray(j)) return null;
    out.push(...j);
    if (j.length < page) break;
  }
  return out;
}

// ── LE BILAN DE LA SEMAINE (api/_lib/bilan-semaine.js) ───────────────────────
// Une ligne de la base, projetée sur les seules clés voulues (§4.4 : `main`
// pèse ~200 Ko). Trois états : objet · `null` (absente) · `undefined` (pas su).
async function getRowProjete(id, cles) {
  try {
    const sel = cles.map((k) => `${k}:data->${k}`).join(',');
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${scoped(`app_data?id=eq.${encodeURIComponent(id)}&select=${sel}`)}`, { headers: HEADERS });
    if (!r.ok) return undefined;
    const rows = await r.json();
    if (!Array.isArray(rows)) return undefined;
    return rows[0] || null;
  } catch (_) { return undefined; }
}
// Les commandes eBay de TOUS ses comptes eBay actifs (9 octobre, plusieurs
// comptes par vendeur) : le registre `ebay_comptes` dit lesquels, chaque compte
// a SA ligne (`ebay_orders`, `ebay_orders_{clé}`). La MÊME règle que l'app et
// la route (`comptesActifs`, §11) : un compte déconnecté n'y entre plus.
// `null` = pas su (registre ou commandes illisibles) — jamais `[]` à sa place.
async function lireCommandesEbay() {
  return lireCommandesEbayServeur({
    lireLigne: getRowProjete, lireToutes: (p) => fetchPaginated(scoped(p)), comptesActifs, normaliserRegistre,
  });
}
const MAIN_BILAN = ['vinted_sales_hidden', 'vinted_accounts_hidden', 'vinted_ship_done', 'vinted_bords_shipped', 'vrm_paires_dorment'];
const ensemble = (v) => new Set(Array.isArray(v) ? v.map(String) : []);
const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

// Lit tout ce que le bilan d'UN vendeur demande. Chaque source vaut `null`
// quand sa lecture a échoué — jamais `[]` à sa place (« rien lu » ≠ « rien »).
async function lireDonneesBilan() {
  const [comptesL, m, panneau, lignes, lbcL, ebayL, txn] = await Promise.all([
    fetchPaginated(scoped('vinted_accounts?select=vinted_user_id,login')),
    getRowProjete('main', MAIN_BILAN),
    getRow('panel_accounts_off'),
    // Les ventes de chaque compte : la liste, le résumé « à expédier » posé par
    // l'extension, et QUAND elle a été lue (data.capturedAt — `updated_at` ment).
    fetchPaginated(scoped('app_data?id=like.harvest_%25_orders_sold&select=id,orders:data->payload->my_orders,txns:data->resume->txns,cap:data->>capturedAt')),
    getRowProjete('lbc_ventes', ['ventes']),
    lireCommandesEbay(),
    // Les dates de versement : trois scalaires par transaction (§4.4), paginé (§4.5).
    fetchPaginated(scoped('app_data?id=like.harvest_%25_txn_%25&select=tx:meta->>id,s:meta->>status,su:meta->>status_updated_at')),
  ]);
  const comptes = Array.isArray(comptesL)
    ? comptesL.map((c) => ({ uid: String((c && c.vinted_user_id) || ''), login: String((c && c.login) || '') })).filter((c) => c.uid)
    : null;
  let commandes = null;
  if (Array.isArray(lignes)) {
    commandes = {};
    for (const l of lignes) {
      const um = String((l && l.id) || '').match(/^harvest_(.+?)_orders_sold$/);
      if (um) commandes[um[1]] = { orders: Array.isArray(l.orders) ? l.orders : [], txns: Array.isArray(l.txns) ? l.txns : null, cap: l.cap || null };
    }
  }
  const mm = m === undefined ? null : objet(m);
  return {
    comptes, commandes,
    masquesTx: mm ? new Set() : null,   // (29 oct.) une vente ne se masque plus
    masquesComptes: mm ? ensemble(mm.vinted_accounts_hidden) : null,
    panneau: panneau === undefined ? null : objet(panneau),
    lbc: lbcL === undefined ? null : Object.values(objet(lbcL && lbcL.ventes)),
    ebay: ebayL,
    versements: versementsDeLignes(txn),
    main: mm,
  };
}

// « À expédier maintenant » : EXACTEMENT la composition du widget
// (api/widget.js) — le résumé posé par l'extension, sinon `aExpedier` sur les
// ventes, moins ce qu'il a coché « posté » ou masqué. Le banc
// `bancs/bilan-semaine.cjs` exécute les DEUX routes et exige le même nombre.
function colisAExpedier(d) {
  const t = txsAExpedier(d);
  if (!t) return null;
  return t.vinted.size + (t.ebay ? t.ebay.total : 0);
}
// Les transactions Vinted à expédier (un Set) et le résumé eBay (`null` =
// illisible) — la composition du widget, partagée par le bilan du lundi et le
// rappel du soir (§11 : une règle, deux lecteurs). `null` = pas su.
function txsAExpedier(d) {
  if (!d.commandes || !d.main || !Array.isArray(d.comptes)) return null;
  const vivants = new Set(d.comptes.map((c) => c.uid));
  const shipDone = objet(d.main.vinted_ship_done), bordsShipped = objet(d.main.vinted_bords_shipped);
  const masquees = new Set();   // (29 oct.) une vente ne se masque plus
  const pasPartie = (t) => !shipDone[t] && !bordsShipped[t] && !masquees.has(t);
  const resume = new Set(); let resumeTrouve = false;
  const parTx = {};
  for (const [uid, l] of Object.entries(d.commandes)) {
    if (vivants.size && !vivants.has(uid)) continue;            // compte retiré : sa moisson reste en base
    if (Array.isArray(l.txns)) { resumeTrouve = true; for (const t of l.txns) resume.add(String(t)); }
    for (const o of l.orders) if (o && o.transaction_id != null) parTx[o.transaction_id] = o;
  }
  const txs = resumeTrouve ? [...resume] : Object.values(parTx).filter((o) => aExpedier(o)).map((o) => String(o.transaction_id));
  // (19 octobre) Les ventes eBay à poster comptent aussi — la MÊME règle que le
  // widget et l'app (`colisEbay`, §11). eBay illisible ⇒ le nombre Vinted seul,
  // dit « au moins » par l'appelant (jamais un total partiel présenté complet).
  const eb = resumeColisEbay(colisEbay(d.ebay));
  return { vinted: new Set(txs.map(String).filter(pasPartie)), ebay: eb };
}

// `soir` : le bilan du DIMANCHE SOIR (26 oct.). Il porte la semaine EN COURS
// mais sa clé de dédoublonnage est le lundi de cette semaine — exactement celle
// que le bilan du lundi matin utilisera le lendemain : un seul bilan part, le
// dimanche soir, et le lundi devient un rattrapage (si le dimanche a échoué).
async function bilanDeLaSemaine(maintenant = Date.now(), soir = false) {
  const sem = soir ? semaineCourante(maintenant) : semainePassee(maintenant);
  if (soir ? sem.jour !== 7 : sem.jour > 3) return null;          // soir → dimanche seul · matin → lundi (rattrapage mar/mer)
  const deja = await getRow('bilan_semaine_dedup');
  if (deja === undefined) return 'mémo illisible — rien envoyé';   // pas su ⇒ on ne risque pas un doublon
  if (deja && deja.semaine === sem.lundi) return 'déjà envoyé';
  if (!(await pushCategorieActive('bilan'))) return 'désactivé par le vendeur';
  const d = await lireDonneesBilan();
  if (Array.isArray(d.comptes) && !d.comptes.length) return 'aucun compte Vinted lié';
  const b = calculerBilan({
    ...d, colis: colisAExpedier(d), colisAuMoins: !Array.isArray(d.ebay),
    dorment: d.main ? d.main.vrm_paires_dorment : null,
    debut: sem.debut, fin: sem.fin, seuilCapture: sem.seuilCapture, maintenant,
  });
  if (!bilanAEnvoyer(b)) return 'données illisibles — réessai demain';
  // Le mémo AVANT l'envoi, et CONFIRMÉ : un bilan par semaine, jamais deux.
  if (!(await ecrireDedup('bilan_semaine_dedup', { semaine: sem.lundi, at: new Date(maintenant).toISOString() }))) return 'mémo non écrit — rien envoyé';
  const t = texteBilan(b, sem);
  const envoi = await sendPushToAll({ title: t.titre, body: t.corps, tag: 'bilan-' + sem.lundi, url: '/?tab=journee' });
  // Le bilan rendu ne porte AUCUN montant (la réponse d'un cron se lit dans un
  // tableau de bord) : seulement les états, et le nombre de colis.
  return { semaine: sem.lundi, vendu: b.vendu.etat, recu: b.recu.etat, colis: b.colis.n, envoi: envoi && (envoi.coupe || envoi.erreur || envoi.sent) };
}

// ── LES COLIS À RETIRER : « DERNIER JOUR » ET « À VÉRIFIER » (23 octobre) ────
// Julien : « que ça me prévienne dès qu'il y a une mise à jour d'un colis » ;
// « il ne doit plus y avoir de problème avec les retraits, je me suis déplacé
// pour rien ». Au cron du matin (10 h à Paris), pour CE vendeur :
//   · « 📍 Dernier jour pour retirer … » quand la date limite LUE dans l'e-mail
//     est aujourd'hui (heure de Paris) ;
//   · « Colis à vérifier : n°… » le jour où un colis passe sa date limite ou la
//     garde de son transporteur (29 oct. : plus « sans doute reparti » — seul le
//     transporteur ou Vinted le disent).
// LA règle de l'app (api/_lib/suivi-colis.js → `etatRetrait`, `gardeDe`, §11).
// Une fois par colis et par état : mémo `colis_retrait_dedup` lu en TROIS états
// (illisible ⇒ rien), écrit AVANT l'envoi et confirmé. Préférence « colis »
// coupée ⇒ rien ; abonnement coupé ⇒ rien (`sendPushToAll`) ; une lecture ratée
// (lignes de suivi, réglages, bordereaux) ⇒ rien. Jamais un colis retiré,
// reparti, coché « J'ai retiré », qu'il envoie, ou que l'app a dit fini.
// (29 oct.) + `vinted_pickup_done` : un colis que SEUL le transporteur dit
// disponible (aucun e-mail) n'est jamais rappelé si sa commande Vinted, reliée
// par son n° de suivi, est cochée « Je l'ai retiré » (la règle de l'app).
const MAIN_RETRAIT = ['vrm_colis_collected', 'vrm_colis_retirer', 'vinted_pickup_done'];
const MEMO_RETRAIT_J = 60;
async function rappelsColisRetrait(maintenant = Date.now()) {
  const deja = await getRow('colis_retrait_dedup');
  if (deja === undefined) return 'mémo illisible — rien envoyé';
  if (!(await pushCategorieActive('colis'))) return 'désactivé par le vendeur';
  // (revue du 23 oct., n° 2) Les scalaires dont la règle partagée a besoin pour
  // RELIRE une ligne comme l'app (code, QR, extraits gardés, date de l'e-mail).
  // (24 oct.) + le statut lu chez le TRANSPORTEUR (lignes `transp_*`, scalaires) :
  // un colis retiré ou reparti chez lui ne reçoit aucun rappel ; illisible ⇒
  // « pas su » ⇒ rien n'est envoyé (un « dernier jour » pour un colis retiré
  // ferait courir pour rien).
  const [lignes, m, bords, transp0] = await Promise.all([
    fetchPaginated(scoped(`app_data?id=like.email_track_*&meta->>status=in.(available,delivered,retour,info)&select=${SELECT_SUIVI_META}`)),
    getRowProjete('main', MAIN_RETRAIT),
    fetchPaginated(scoped('app_data?id=like.email_bord_*&select=suivi:meta->>suivi')),
    fetchPaginated(scoped(`app_data?id=like.transp_*&select=${SELECT_TRANSP_META}`)),
  ]);
  if (!Array.isArray(lignes) || m === undefined || !Array.isArray(bords) || !Array.isArray(transp0)) return 'lecture ratée — rien envoyé';
  // (29 oct.) Toutes les lignes, quel que soit leur âge : une ligne finie qu'on
  // ne lirait plus ferait revenir un colis RETIRÉ (rien lu ≠ pas fini).
  const transp = transp0.map(ligneTranspDeMeta).filter(Boolean);
  const mm = objet(m);
  const pub = objet(mm.vrm_colis_retirer);
  const today = parisDate(0);
  const entree = {
    lignes, collectes: Array.isArray(mm.vrm_colis_collected) ? mm.vrm_colis_collected : [],
    envoyes: bords.map((b) => b && b.suivi).filter(Boolean), finis: Array.isArray(pub.finis) ? pub.finis : [],
    maintenant, aujourdhui: today, transp,
    cocheTx: new Set(Object.keys(objet(mm.vinted_pickup_done)).map(String)),
  };
  // (revue du 23 oct., n° 3) LA FIN D'UN ACHAT, LUE ICI — pas seulement dans la
  // publication de l'app (`finis`) : absente (app pas ouverte depuis) ou plus
  // ancienne qu'une capture des achats, « pas su » valait « pas fini », et
  // « 📍 Dernier jour pour retirer » partait pour un colis déjà retiré. La
  // commande d'un colis se trouve par IDENTITÉ (code de retrait, n° de suivi),
  // sa fin par la règle de l'app (`finDeCommandeAchat`). Ces lectures ne partent
  // que s'il y a un rappel à envoyer ; ratées ⇒ rien n'est envoyé.
  const candidats = rappelsRetraitDuJour(entree);
  if (!candidats.length) return { retrait: 'rien à dire', n: 0 };
  const [relaisRow, suivisV, suivisM] = await Promise.all([
    getRow('panel_colis_relais'),
    fetchPaginated(scoped('app_data?id=like.harvest_%25_suivi_%25&select=id,tx:meta->>tx,suivi:meta->>suivi')),
    fetchPaginated(scoped('app_data?id=like.colis_suivi_%25&select=id,suivi:meta->>suivi,tx:meta->>tx,uid:meta->>uid')),
  ]);
  const liens = liensDesLignes(suivisV, suivisM);
  const relais = relaisRow === undefined ? null : objet(relaisRow);
  if (liens === null || relais === null) return 'lecture ratée — rien envoyé';
  const txsPar = new Map();
  for (const x of candidats) { const t = txDuColis({ suivi: x.suivi, code: x.code }, relais, liens); txsPar.set(x.suivi, t); }
  const tousTx = [...new Set([...txsPar.values()].flatMap((t) => (t ? [...t] : [])))].filter((t) => /^\d{3,20}$/.test(t));
  let achats = [], etats = new Map();
  if (tousTx.length) {
    const [a, e] = await Promise.all([
      fetchPaginated(scoped('app_data?id=like.harvest_%25_orders_purchased&select=id,orders:data->payload->my_orders,txns:data->resume->txns')),
      fetchPaginated(scoped(`app_data?id=like.harvest_%25_txn_%25&meta->>id=in.(${tousTx.join(',')})&select=tx:meta->>id,s:meta->>status,ss:meta->>ship_status_title`)),
    ]);
    if (!Array.isArray(a) || !Array.isArray(e)) return 'lecture ratée — rien envoyé';
    achats = a;
    for (const r of e) if (r && r.tx && r.s != null && Number.isFinite(Number(r.s))) etats.set(String(r.tx), { s: Number(r.s), ss: String(r.ss || '') });
  }
  const liste = rappelsRetraitDuJour({ ...entree, liens,
    finParCommande: ({ suivi, code }) => finDesTransactions(txDuColis({ suivi, code }, relais, liens), achats, etats) });
  const envoyes = objet(deja && deja.envoyes);
  const nouveaux = liste.filter((x) => !envoyes[x.cle]);
  if (!nouveaux.length) return { retrait: 'rien à dire', n: 0 };
  // Le mémo AVANT l'envoi, et CONFIRMÉ (purgé au-delà de 60 jours).
  const limiteMemo = parisDate(-MEMO_RETRAIT_J);
  const memo = {};
  for (const [k, v] of Object.entries(envoyes)) if (String(v) >= limiteMemo) memo[k] = v;
  for (const x of nouveaux) memo[x.cle] = today;
  if (!(await ecrireDedup('colis_retrait_dedup', { envoyes: memo, at: new Date(maintenant).toISOString() }))) return 'mémo non écrit — rien envoyé';
  let envoi = null;
  for (const x of nouveaux) {
    const t = texteRappelRetrait(x);
    envoi = await sendPushToAll({ title: t.title, body: t.body, tag: 'retrait-' + x.cle, url: '/?tab=cat_achats' });
  }
  // Aucun n° de suivi ni lieu dans la réponse d'un cron : des nombres.
  return { retrait: 'envoyé', dernier: nouveaux.filter((x) => x.etat === 'dernier').length, aVerifier: nouveaux.filter((x) => x.etat === 'a_verifier').length,
    envoi: envoi && (envoi.coupe || envoi.erreur || envoi.sent) };
}

// ── OFFRE AU-DESSUS DE TON PRIX MINI (27 oct., demande de Julien) ───────────
// Il pose un « prix mini » à côté du N° (vinted_annonce_numeros[id].min) ; dès
// qu'une offre le dépasse, on le prévient sur le téléphone pour qu'il l'accepte
// en 1 tap dans VRM. RIEN n'est accepté tout seul — c'est son tap qui vend (§3).
// DÉTECTION SERVEUR, app fermée : les offres vivent dans les conversations
// captées par l'extension, les planchers dans `main`. Vinted ne donne aucun
// signal instantané : c'est le cron QUOTIDIEN (le bandeau in-app reste
// l'instantané). Dédoublé par identité de l'offre (`offer_request_id`).
const OFFRES_MINI_FILTRE = 'data->payload->conversation->messages=cs.' + encodeURIComponent(JSON.stringify([{ entity_type: 'offer_request_message', entity: { status: 10 } }]));
// Copie FIDÈLE de `offreEnAttenteDe` (src/App.jsx, §11) : le serveur ne peut pas
// importer App.jsx. `scripts/bancs/offres-mini-push.cjs` EXÉCUTE la règle, et
// l'audit compare au besoin. Toute dérive = deux chiffres pour une notion.
function offreCouranteServeur(opp, msgs) {
  let d = null;
  for (const m of (Array.isArray(msgs) ? msgs : [])) {
    if (!m || m.entity_type !== 'offer_request_message') continue;
    const e = m.entity || {};
    if (opp != null && (e.user_id == null || String(e.user_id) !== String(opp))) continue;
    if (e.current === false || e.status !== 10) continue;
    if (/accept|refus|reject|expir|annul|cancel|retir/i.test(String(e.status_title || ''))) continue;
    const px = e.price && (e.price.amount != null ? e.price.amount : e.price);
    const prix = Number(String(px == null ? '' : px).replace(',', '.'));
    if (!isFinite(prix) || prix <= 0 || e.offer_request_id == null) continue;
    d = { prix, oid: String(e.offer_request_id) };
  }
  return d;
}
async function rappelsOffresMini(maintenant = Date.now()) {
  if (!(await pushCategorieActive('offremini'))) return 'désactivé par le vendeur';
  const main = await getRowProjete('main', ['vinted_annonce_numeros']);
  if (main === undefined) return 'main illisible — rien envoyé';           // « pas su » ⇒ on ne pousse pas
  const nums = (main && main.vinted_annonce_numeros) || {};
  const planchers = new Map();                                              // item_id → prix mini
  for (const [id, e] of Object.entries(nums)) {
    const v = e && e.min != null ? Number(String(e.min).replace(',', '.')) : NaN;
    if (isFinite(v) && v > 0) planchers.set(String(id), v);
  }
  if (!planchers.size) return 'aucun prix mini posé';
  const rows = await fetchPaginated(scoped(`app_data?id=like.harvest_%25_conv_%25&${OFFRES_MINI_FILTRE}&select=opp:data->payload->conversation->opposite_user->>id,item:data->payload->conversation->transaction->>item_id,msgs:data->payload->conversation->messages`));
  if (rows === null) return 'conversations illisibles — rien envoyé';       // « pas su » ⇒ rien
  const auMini = [];
  for (const r of rows) {
    const item = r && r.item != null && r.item !== '' ? String(r.item) : null;
    if (!item || !planchers.has(item)) continue;
    const off = offreCouranteServeur(r && r.opp != null ? r.opp : null, r && r.msgs);
    if (off && off.prix >= planchers.get(item)) auMini.push(off.oid);
  }
  const deja = await getRow('offres_mini_dedup');
  if (deja === undefined) return 'mémo illisible — rien envoyé';            // « pas su » ⇒ rien
  const vus = new Set(Array.isArray(deja && deja.oids) ? deja.oids : []);
  const nouveaux = [...new Set(auMini)].filter((o) => !vus.has(o));
  if (!nouveaux.length) return auMini.length ? 'déjà notifiées' : 'aucune offre au-dessus du mini';
  const garde = [...vus, ...nouveaux].slice(-400);                          // mémo borné
  if (!(await ecrireDedup('offres_mini_dedup', { oids: garde, at: new Date(maintenant).toISOString() }))) return 'mémo non écrit — rien envoyé';
  const n = nouveaux.length;
  const envoi = await sendPushToAll({
    title: n > 1 ? `${n} offres au-dessus de ton prix mini` : 'Une offre au-dessus de ton prix mini',
    body: n > 1 ? `${n} offres à accepter en 1 tap dans VRM.` : 'À accepter en 1 tap dans VRM.',
    tag: 'offremini', url: '/?tab=cat_msg' });
  return { offremini: 'envoyé', n, envoi: envoi && (envoi.coupe || envoi.erreur || envoi.sent) };
}

// Le traitement d'UN vendeur (celui du `contexteVendeur` courant, ou l'unique
// vendeur d'une base non cloisonnée). Rend un bilan, n'écrit jamais dans `res`.
// ── (20 octobre) RELIRE eBAY AVANT DE COMPTER, APP FERMÉE ──────────────────
// Julien : « pour eBay ça doit se relire tout seul […] je dois rien avoir à
// faire ». Les commandes eBay ne se relisaient que VRM ouvert : une vente de la
// nuit n'entrait pas dans le rappel du matin. On les relit donc ICI, pour CE
// vendeur, compte par compte avec SON jeton (`relireCommandesVendeur`, la
// même lecture que l'app), puis on compte. Pas de nouveau cron (plan Hobby),
// pas de 13e fonction. Une relecture ratée ne bloque RIEN : le rappel part sur
// la dernière capture (eBay illisible ⇒ « au moins », comme avant), et elle
// est bornée dans le temps (les 300 s d'une fonction Vercel se partagent entre
// tous les vendeurs).
const RELECTURE_EBAY_MAX_MS = 20000;
async function relireEbayDuVendeur() {
  const owner = proprietaireCourant() || '';
  let minuteur;
  try {
    return await Promise.race([
      relireCommandesVendeur(owner),
      new Promise((ok) => { minuteur = setTimeout(() => ok({ fait: false, reason: 'delai' }), RELECTURE_EBAY_MAX_MS); }),
    ]);
  } catch (e) { return { fait: false, reason: 'erreur' }; }
  finally { clearTimeout(minuteur); }
}
// Le bilan ne porte aucun jeton ni montant : l'état de chaque compte.
const resumeRelecture = (r) => !r ? null : (!r.fait ? { fait: false, reason: r.reason } : { fait: true, ok: r.comptes.filter((c) => c.ok === true).length, ko: r.comptes.filter((c) => c.ok === false).length });
// ── (24 oct.) LIRE LE STATUT CHEZ LES TRANSPORTEURS AVANT DE COMPTER ────────
// Le matin ET le soir, pour CE vendeur, en même temps que la relecture d'eBay
// (des hôtes différents) : au plus 12 lectures et 20 s, puis les rappels
// comptent avec ce qui a été lu. Un abonnement coupé ⇒ aucune lecture ; « pas
// su » ne coupe pas. Un échec ne bloque RIEN (les rappels partent sur ce qu'on
// savait). Le bilan ne porte que des nombres — aucun n° de suivi.
async function lireTransporteursDuVendeur() {
  const owner = proprietaireCourant() || '';
  if (!owner) return { fait: false, reason: 'vendeur' };
  if ((await accesVendeur(owner)) === false) return { fait: false, reason: 'abonnement' };
  // (29 oct., revue n° 20) La borne TIENT : le passage ne lance un élément que
  // s'il peut le finir dans son budget, et à l'expiration du filet l'ARRÊT lui
  // est signalé (`AbortController`) — plus aucune lecture, écriture ni
  // notification après la réponse du cron. Le bilan dit ce qui a été FAIT.
  const arret = new AbortController();
  let minuteur;
  try {
    const r = await Promise.race([
      passageTransporteurs({ max: MAX_CRON, budgetMs: BUDGET_CRON_MS - 2000, signal: arret.signal }),
      new Promise((ok) => { minuteur = setTimeout(() => ok({ ok: false, raison: 'delai' }), BUDGET_CRON_MS); }),
    ]);
    if (!r || !r.ok) return { fait: false, reason: (r && r.raison) || 'pas-su' };
    return { fait: true, lus: r.lus.filter((x) => x.res === 'ok').length, echecs: r.lus.filter((x) => x.res !== 'ok').length, changes: r.lus.filter((x) => x.change).length, navigateur: r.besoinNavigateur.length, ...(r.arrete ? { arrete: true } : {}) };
  } catch (_) { return { fait: false, reason: 'erreur' }; }
  finally { clearTimeout(minuteur); arret.abort(); }   // l'arrêt, dès la réponse (le filet ou le passage)
}
async function traiterVendeur() {
  const [relu, transp] = await Promise.all([relireEbayDuVendeur(), lireTransporteursDuVendeur()]);
  const out = await traiterVendeurApresRelecture();
  return { ...out, ebayRelu: resumeRelecture(relu), transporteurs: transp };
}
async function traiterVendeurApresRelecture() {
    const today = parisDate(0);

    // RAPPEL URSSAF — le 1er de chaque mois (Julien, 30 sept. : « envoie
    // simplement une notification le premier de chaque mois pour la faire »).
    // Posé AVANT le calcul des colis : ce dernier se tait quand le résumé
    // manque, le rappel mensuel ne doit pas se taire avec lui. Une seule fois
    // par mois (ligne `urssaf_reminder_dedup`), et une écriture ratée du mémo
    // n'empêche pas le reste du rappel.
    // (22 oct.) LA RÈGLE DE L'APP ET LE MONTANT PUBLIÉ (api/_lib/rappel-urssaf.js) :
    // le rythme, les mois déjà notés « déclarés » (plus de rappel), et « à
    // payer » lu dans la ligne publiée par l'écran Ventes. `main` illisible ⇒ le
    // rappel d'avant, sans montant. La réponse du cron ne porte aucun montant.
    let urssaf = null;
    try {
      const mois = today.slice(0, 7);
      if (today.endsWith('-01')) {
        const deja = (await getRow('urssaf_reminder_dedup')) || {};
        if (deja.mois !== mois && await pushCategorieActive('urssaf')) {
          const n = notificationUrssaf({ today, main: await getRowProjete('main', MAIN_URSSAF) });
          if (n.envoyer) {
            await sendPushToAll({ title: n.titre, body: n.corps, tag: 'urssaf-' + mois, url: n.url });
            await ecrireDedup('urssaf_reminder_dedup', { mois });
          }
          urssaf = n.envoyer ? 'envoyé · ' + n.raison : n.raison;
        }
      } else {
        // (29 oct.) Le rappel avant l'échéance : une fois par échéance (`veille`
        // dans le même mémo), écrit APRÈS l'envoi comme celui du 1er.
        const n = rappelAvantEcheance({ today, main: await getRowProjete('main', MAIN_URSSAF) });
        if (n.envoyer) {
          const deja = await getRow('urssaf_reminder_dedup');
          if (deja && deja.veille === n.cle) urssaf = 'déjà rappelé avant l\'échéance';
          else if (deja === undefined) urssaf = 'mémo illisible — rien';
          else if (await pushCategorieActive('urssaf')) {
            await sendPushToAll({ title: n.titre, body: n.corps, tag: 'urssaf-veille-' + n.cle, url: n.url });
            await ecrireDedup('urssaf_reminder_dedup', { ...(deja || {}), veille: n.cle });
            urssaf = 'envoyé · ' + n.raison;
          }
        }
      }
    } catch (_) { urssaf = 'échec'; }

    // BILAN DE LA SEMAINE — le lundi (rattrapage mardi et mercredi). Posé ici,
    // AVANT le calcul des colis du jour : celui-ci se tait quand le résumé
    // manque, le bilan ne doit pas se taire avec lui. Un échec du bilan
    // n'empêche jamais le rappel d'expédition.
    let bilan = null;
    try { bilan = await bilanDeLaSemaine(); } catch (e) { bilan = 'échec : ' + String((e && e.message) || e).slice(0, 120); }

    // LES COLIS À RETIRER (23 oct.) — posé AVANT le calcul des colis à poster,
    // qui se tait quand le résumé manque : un échec ici n'empêche rien d'autre.
    let retrait = null;
    try { retrait = await rappelsColisRetrait(); } catch (e) { retrait = 'échec : ' + String((e && e.message) || e).slice(0, 120); }

    // OFFRE AU-DESSUS DE TON PRIX MINI — à accepter en 1 tap (27 oct.). Posé
    // comme les autres : un échec ici n'empêche rien, et le calcul des colis
    // continue. Rien n'est accepté tout seul (§3).
    let offremini = null;
    try { offremini = await rappelsOffresMini(); } catch (e) { offremini = 'échec : ' + String((e && e.message) || e).slice(0, 120); }

    // ── LES COLIS DU MATIN : LA RÈGLE DU SOIR, DU WIDGET ET DE L'APP (22 oct.) ──
    // ⚠️⚠️ CE RAPPEL ANNONÇAIT « RIEN À ENVOYER » À TORT. Mesuré le 22 octobre
    // sur sa base : `ship_reminder_dedup` = {total 0} le matin, alors que le
    // rappel de la veille au soir en comptait 3 et qu'UN colis (tomj683, limite
    // le 23 à 10 h) était dû le lendemain. Deux défauts, deux règles à lui :
    //   · il sautait un bordereau IMPRIMÉ (`vinted_bords_printed`) comme si le
    //     colis était parti — l'app a décidé l'inverse (« imprimer ne suffit
    //     pas ») : le colis de tomj683 faisait partie d'un lot imprimé le 20 ;
    //   · il ne partait QUE des bordereaux reçus par EMAIL : une vente sans
    //     email n'existait pas pour lui. Mesuré sur 30 jours : angeled92 0/18,
    //     tomj606 0/8, arthuror2 1/10 — 36 ventes jamais comptées.
    // ⇒ La LISTE est celle du soir et du widget (`txsAExpedier`), la DATE
    //   LIMITE celle de l'app (`limiteExpedition`, avec son heure — l'email du
    //   bordereau, sinon vente + 7 jours, dite estimée). Une règle, §11.
    const d = await lireDonneesColis();
    const t = txsAExpedier(d);
    // (19 octobre) Les ventes eBay à poster : la MÊME règle que l'app et le
    // widget (`colisEbay`, §11), lue indépendamment de Vinted — un vendeur qui
    // ne vend que sur eBay a aussi son rappel. Illisible ⇒ `null`, on n'invente
    // rien pour eBay (ni « 0 », ni un rappel).
    let eb = null;
    try { eb = resumeColisEbay(colisEbay(d.ebay)); } catch (_) { eb = null; }
    // ⚠️ « Pas su » se tait pour Vinted, jamais « 0 » : ventes, comptes ou
    //    réglages (colis cochés « posté », masqués) illisibles ; ou les
    //    bordereaux illisibles (leur heure limite manquerait : une date estimée,
    //    jour seul, prendrait la place de l'heure lue dans l'email).
    let vintedSkip = null;
    if (!t) vintedSkip = 'ventes ou réglages illisibles';
    else if (!Object.keys(d.commandes).length) vintedSkip = 'aucune vente Vinted captée';
    else if (!Array.isArray(d.bords)) vintedSkip = 'bordereaux illisibles';
    // Vinted illisible et rien à dire pour eBay : on se tait, sans mémo (le
    // passage suivant, tout lu, ne doit pas se croire « déjà notifié »).
    if (vintedSkip && (!eb || (!(eb.overdue + eb.today + eb.tomorrow) && !eb.nePasPoster))) return { urssaf, bilan, retrait, offremini, skipped: vintedSkip + ' — aucune notification envoyée' };

    const c = vintedSkip ? null : compterEcheances({ txs: [...t.vinted], ventes: ventesParTx(d), bords: bordsDuVendeur(d), maintenant: Date.now() });
    // ⚠️ (revue du 22 oct.) `overdue` = une limite LUE (email du bordereau, ou
    // la date d'eBay) et dépassée. Une limite ESTIMÉE dépassée (vente + 7 j,
    // pas d'email) n'est PAS un retard — la vraie tombe jusqu'à 3 jours plus
    // tard (62 ventes sur 202, mesuré) : elle est comptée à part
    // (`aVerifier`), dans le total, et dite « à vérifier sur Vinted ».
    let overdue = c ? c.retard : 0, dueToday = c ? c.aujourdhui : 0, dueTomorrow = c ? c.demain : 0;
    const aVerifier = c ? c.estimeeDepassee : 0;
    const ebayDus = eb ? eb.overdue + eb.today + eb.tomorrow : 0;
    if (eb) { overdue += eb.overdue; dueToday += eb.today; dueTomorrow += eb.tomorrow; }
    const total = overdue + aVerifier + dueToday + dueTomorrow;
    const nePasPoster = eb ? eb.nePasPoster : 0;

    // Anti-doublon : une seule notification par jour pour un même total.
    const dedup = (await getRow('ship_reminder_dedup')) || {};
    if (dedup.date === today && dedup.total === total && (dedup.nePasPoster || 0) === nePasPoster) return { urssaf, bilan, retrait, offremini, skipped: 'déjà notifié', total };

    if ((total > 0 || nePasPoster > 0) && await pushCategorieActive('expedier')) {
      const txt = texteMatin({ overdue, aVerifier, dueToday, dueTomorrow, ebayDus, nePasPoster, vinted: c });
      await sendPushToAll({ ...txt, tag: 'ship-reminder', url: '/?tab=cat_bord' });
    }
    await ecrireDedup('ship_reminder_dedup', { date: today, total, nePasPoster });
    return { urssaf, bilan, retrait, offremini, overdue, aVerifier, dueToday, dueTomorrow, total,
      ...(c ? { heures: { aujourdhui: c.premier.aujourdhui ? c.premier.aujourdhui.heure : null, demain: c.premier.demain ? c.premier.demain.heure : null }, estimees: c.estimees, sansLimite: c.sansLimite } : {}),
      ebay: eb ? { aPoster: eb.total, dus: ebayDus, nePasPoster } : null, ...(vintedSkip ? { vintedSkip } : {}) };
}

// Le texte du matin : une fonction pure (le banc la juge par la sortie de la
// route). L'HEURE limite est écrite quand l'email la donne (« 1 demain avant
// 10 h ») ; une date ESTIMÉE (pas de bordereau reçu) est dite estimée. Rien
// sur ce que fait Vinted après l'heure : on ne l'a pas mesuré.
// « du retard ! » ne part QUE sur une limite LUE et dépassée (`overdue`) ; une
// date ESTIMÉE dépassée est « à vérifier sur Vinted » (`aVerifier`), jamais un
// retard (revue du 22 octobre).
export function texteMatin({ overdue, aVerifier = 0, dueToday, dueTomorrow, ebayDus = 0, nePasPoster = 0, vinted = null }) {
  const total = overdue + aVerifier + dueToday + dueTomorrow;
  const premier = (vinted && vinted.premier) || {};
  const avec = (n, mot, p) => {
    const H = p && p.heure ? heureCourte(p.heure) : '';
    if (!H) return `${n} ${mot}`;
    return n === 1 ? `1 ${mot} avant ${H}` : `${n} ${mot}, dont un avant ${H}`;
  };
  const parts = [];
  if (overdue) parts.push(`${overdue} en retard`);
  if (aVerifier) parts.push(`${aVerifier} à vérifier sur Vinted — date estimée dépassée`);
  if (dueToday) parts.push(avec(dueToday, "aujourd'hui", premier.aujourdhui));
  if (dueTomorrow) parts.push(avec(dueTomorrow, 'demain', premier.demain));
  // Le mot suit la donnée : une étiquette eBay se prend DANS eBay (l'acheteur
  // l'a payée, §2.8). Côté Vinted, ce sont des COLIS : une vente sans
  // bordereau reçu compte aussi (22 octobre).
  const quoi = !ebayDus ? `${total} colis à envoyer`
    : ebayDus === total ? `${total} colis eBay à envoyer`
    : `${total} colis à envoyer, dont ${ebayDus} eBay`;
  const corps = total > 0 ? `${quoi} (${parts.join(' · ')}).` : '';
  // La date estimée : dite pour celles d'aujourd'hui et de demain, et pour
  // celles « à vérifier » (une phrase, §7 : leur part le dit déjà « estimée »).
  const est = vinted && vinted.estimees ? vinted.estimees.estimeeDepassee + vinted.estimees.aujourdhui + vinted.estimees.demain : 0;
  const estime = est ? ` Date estimée pour ${est} (vente + 7 j : bordereau pas reçu par email ; la vraie limite peut tomber jusqu'à 3 j plus tard).` : '';
  const stop = nePasPoster ? ` ${nePasPoster > 1 ? `${nePasPoster} acheteurs eBay ont` : 'Un acheteur eBay a'} demandé l'annulation : ne poste pas ${nePasPoster > 1 ? 'ces colis' : 'ce colis'}.` : '';
  return {
    title: nePasPoster && !total ? '✋ Commande eBay : ne poste pas' : overdue ? '⏰ Colis à expédier — du retard !' : '📮 Colis à expédier',
    body: (corps + estime + stop).trim() + (ebayDus || nePasPoster ? " Ouvre l'app pour les voir." : " Ouvre l'app pour les préparer."),
  };
}

// ── LES DONNÉES DES COLIS — LE MATIN ET LE SOIR LISENT LA MÊME CHOSE ────────
// La liste « à expédier » (`txsAExpedier`) et la date limite de chaque vente
// (`limiteExpedition`, api/_lib/limite-envoi.js) : comptes, réglages (`main`
// projeté, §4.4), ventes moissonnées (liste + résumé), commandes eBay, et les
// bordereaux reçus par email (leur date limite, AVEC l'heure). Chaque source
// vaut `null` quand sa lecture a échoué (« rien lu » ne vaut pas « rien »).
const MAIN_COLIS = ['vinted_sales_hidden', 'vinted_ship_done', 'vinted_bords_shipped', 'vinted_bords_hidden'];
async function lireDonneesColis() {
  const BORD = 'dateLimite:data->>dateLimite,transaction:data->>transaction,suivi:data->>suivi,numero:data->>numero,receivedAt:data->>receivedAt,filename:data->>filename';
  const [comptesL, m, lignes, ebay, bords] = await Promise.all([
    fetchPaginated(scoped('vinted_accounts?select=vinted_user_id,login')),
    getRowProjete('main', MAIN_COLIS),
    fetchPaginated(scoped('app_data?id=like.harvest_%25_orders_sold&select=id,orders:data->payload->my_orders,txns:data->resume->txns')),
    lireCommandesEbay(),
    fetchPaginated(scoped(`app_data?id=like.email_bord_*&select=${BORD}`)),
  ]);
  const comptes = Array.isArray(comptesL) ? comptesL.map((c) => ({ uid: String((c && c.vinted_user_id) || '') })).filter((c) => c.uid) : null;
  let commandes = null;
  if (Array.isArray(lignes)) {
    commandes = {};
    for (const l of lignes) {
      const um = String((l && l.id) || '').match(/^harvest_(.+?)_orders_sold$/);
      if (um) commandes[um[1]] = { orders: Array.isArray(l.orders) ? l.orders : [], txns: Array.isArray(l.txns) ? l.txns : null };
    }
  }
  return { comptes, commandes, main: m === undefined ? null : objet(m), ebay, bords };
}
// Les ventes par transaction (leur DATE sert à la limite estimée), des seuls
// comptes encore liés — la même portée que `txsAExpedier`.
function ventesParTx(d) {
  const out = {};
  if (!d || !d.commandes) return out;
  const vivants = new Set((Array.isArray(d.comptes) ? d.comptes : []).map((c) => c.uid));
  for (const [uid, l] of Object.entries(d.commandes)) {
    if (vivants.size && !vivants.has(uid)) continue;
    for (const o of l.orders) if (o && o.transaction_id != null) out[String(o.transaction_id)] = o;
  }
  return out;
}
// Le bordereau email de chaque transaction — la table de l'écran Colis
// (`bordsParTransaction`) : un bordereau qu'il a MASQUÉ ne donne pas la date.
const cleBord = (b) => String((b && (b.transaction || b.suivi || b.numero)) || '');
function bordsDuVendeur(d) {
  const cachees = objet(d && d.main && d.main.vinted_bords_hidden);
  return bordsParTransaction(d && Array.isArray(d.bords) ? d.bords : [], (b) => !!cachees[cleBord(b)]);
}

// ── LE RAPPEL DE LA VEILLE AU SOIR (retenu par Julien le 11 octobre) ────────
// « Demain : N colis à poster ». Second cron (vercel.json, 18:00 UTC = 20 h à
// Paris l'été, 19 h l'hiver — le plan Hobby décale d'au plus une heure), MÊME
// route (`?moment=soir`, plafond de 12 fonctions), même garde CRON_SECRET.
// Le nombre est CELUI du widget et du bilan (`txsAExpedier` : `aExpedier` ou le
// résumé de l'extension, colis cochés « posté » et masqués exclus, eBay par
// `colisEbay`, §11). Le « dont » vient de la date limite de CES ventes — la
// règle de l'app (`limiteExpedition`, 22 octobre : l'heure lue dans l'email,
// sinon vente + 7 jours) — et de celles d'eBay ; jamais un chiffre de plus que N.
// Rien ne part : s'il n'y a rien à poster, si une lecture Vinted a échoué (pas
// su), si la préférence « soir » est coupée, ou s'il est déjà parti ce jour-là
// (mémo `soir_reminder_dedup` écrit AVANT l'envoi et confirmé). eBay illisible
// ⇒ « au moins N », eBay nommé (jamais un total partiel présenté complet).
// Le texte : une fonction pure (le banc la juge par la sortie de la route).
// `aVerifier` : les dates ESTIMÉES (pas d'email de bordereau) qui seront
// passées demain — jamais « déjà en retard » (revue du 22 octobre).
export function texteSoir({ n, auMoins, retard, aVerifier = 0, demain, heureDemain = null }) {
  const N = `${auMoins ? 'au moins ' : ''}${n} colis à poster`;
  const H = heureDemain ? heureCourte(heureDemain) : '';
  const parts = [];
  if (retard) parts.push(`${retard} déjà en retard`);
  if (aVerifier) parts.push(`${aVerifier} à vérifier sur Vinted (date estimée passée)`);
  if (demain) parts.push(`${demain} avec la date limite demain${H ? (demain === 1 ? ` à ${H}` : `, la première à ${H}`) : ''}`);
  return {
    title: retard ? `⏰ Demain : ${N}` : `📮 Demain : ${N}`,
    body: `${parts.length ? `Dont ${parts.join(', ')}. ` : ''}${auMoins ? "Les ventes eBay n'ont pas pu être relues : il peut y en avoir plus. " : ''}Prépare-les ce soir.`,
  };
}
async function rappelDuSoir() {
  const today = parisDate(0);
  const deja = await getRow('soir_reminder_dedup');
  if (deja === undefined) return { soir: 'mémo illisible — rien envoyé' };
  if (deja && deja.date === today) return { soir: 'déjà envoyé' };
  if (!(await pushCategorieActive('soir'))) return { soir: 'désactivé par le vendeur' };
  const d = await lireDonneesColis();
  const t = txsAExpedier(d);
  if (!t) return { soir: 'lecture ratée — rien envoyé' };
  const auMoins = !t.ebay;
  const n = t.vinted.size + (t.ebay ? t.ebay.total : 0);
  if (!n) return { soir: 'rien à poster', n: 0 };
  // Le « dont » : seulement CES ventes (sous-ensemble de N). Demain, une limite
  // d'aujourd'hui (ou d'avant) est déjà passée : elle compte « en retard ».
  // Bordereaux illisibles ⇒ pas de « dont » Vinted (une date estimée prendrait
  // la place de l'heure lue dans l'email).
  // ⚠️ (revue du 22 oct.) Une limite ESTIMÉE (vente + 7 j) passée demain n'est
  // pas « déjà en retard » : `aVerifier`, dite à part.
  let retard = 0, aVerifier = 0, demain = 0, heureDemain = null;
  if (Array.isArray(d.bords)) {
    const c = compterEcheances({ txs: [...t.vinted], ventes: ventesParTx(d), bords: bordsDuVendeur(d), maintenant: Date.now() });
    retard = c.retard + (c.aujourdhui - c.estimees.aujourdhui);
    aVerifier = c.estimeeDepassee + c.estimees.aujourdhui;
    demain = c.demain;
    heureDemain = c.premier.demain ? c.premier.demain.heure : null;
  }
  if (t.ebay) { retard += t.ebay.overdue + t.ebay.today; demain += t.ebay.tomorrow; }
  if (!(await ecrireDedup('soir_reminder_dedup', { date: today, n }))) return { soir: 'mémo non écrit — rien envoyé' };
  const txt = texteSoir({ n, auMoins, retard, aVerifier, demain, heureDemain: t.ebay && t.ebay.tomorrow ? null : heureDemain });
  const envoi = await sendPushToAll({ ...txt, tag: 'soir-' + today, url: '/?tab=cat_bord' });
  return { soir: 'envoyé', n, retard, aVerifier, demain, auMoins, envoi: envoi && (envoi.coupe || envoi.erreur || envoi.sent) };
}
async function traiterVendeurSoir() {
  // Le soir : lire et notifier les changements, puis le rappel du soir.
  const [relu, transp] = await Promise.all([relireEbayDuVendeur(), lireTransporteursDuVendeur()]);
  const out = await rappelDuSoir();
  // Le bilan de la semaine part le DIMANCHE SOIR (26 oct.) — même dédoublonnage
  // que le lundi matin (un seul bilan par semaine). Un échec du bilan n'empêche
  // jamais le rappel d'expédition du soir.
  let bilan = null;
  try { bilan = await bilanDeLaSemaine(Date.now(), true); } catch (e) { bilan = 'échec : ' + String((e && e.message) || e).slice(0, 120); }
  return { ...out, bilan, ebayRelu: resumeRelecture(relu), transporteurs: transp };
}

export default async function handler(req, res) {
  // CRON_SECRET est obligatoire : un endpoint public ne doit pas déclencher des envois.
  // (Vercel envoie « Authorization: Bearer <CRON_SECRET> » sur les crons).
  const secret = process.env.CRON_SECRET;
  res.setHeader?.('Cache-Control','no-store');
  if (!secret) { res.status(503).json({ok:false,error:'cron-non-configure'});return; }
  const auth = req.headers?.authorization || '';
  if (auth !== `Bearer ${secret}`) { res.status(401).json({error:'clé invalide'});return; }


  // `?moment=soir` : le rappel de la veille au soir (second cron), rien d'autre
  // (ni URSSAF, ni bilan, ni rappel du matin).
  const soir = String((req.query && req.query.moment) || '') === 'soir';
  const traiter = soir ? traiterVendeurSoir : traiterVendeur;
  try {
    const cl = await cloisonnee();
    // Pas su : on ne devine pas (ni passe globale, ni passe par vendeur). 503 =
    // visible dans le tableau de bord des crons ; demain le cron repassera.
    if (cl === null) { res.status(503).json({ ok: false, skipped: 'base injoignable — aucun rappel envoyé' }); return; }
    // Sans colonne owner, aucun rappel ne peut être attribué avec certitude.
    if (!cl) {res.status(503).json({ok:false,error:'cloisonnement-requis'});return;}
    // ── Base cloisonnée : UNE passe PAR vendeur, chacun dans son contexte ─────
    //    (ses bordereaux, son dédoublonnage, ses appareils). On ne pousse JAMAIS
    //    hors contexte : si on ne peut pas énumérer, on ne devine pas.
    const owners = await ownersActifs();
    if (!owners) { res.status(503).json({ ok: false, skipped: 'vendeurs non énumérables (lecture en panne)' }); return; }
    // ⚠️ À L'ÉCHELLE : un vendeur coûte ~6 lectures. À la queue leu leu, mille
    //    vendeurs dépassent les 300 s d'une fonction Vercel et les derniers n'ont
    //    jamais leur rappel. On en traite VENDEURS_EN_PARALLELE à la fois — chacun
    //    dans SON contexte (AsyncLocalStorage : deux vendeurs simultanés ne
    //    partagent ni filtre, ni mémo, ni appareils). Ce sont NOS lectures, pas
    //    des requêtes à Vinted (le garde-fou « une à la fois » du §3 n'est pas ici).
    // ⚠️ Et un vendeur qui plante n'arrête plus les autres : son bilan porte
    //    l'erreur, les suivants reçoivent leur rappel, et la réponse est 500 pour
    //    que l'échec reste visible.
    const bilans = new Array(owners.length);
    let suivant = 0, echecs = 0;
    const ouvrier = async () => {
      while (suivant < owners.length) {
        const i = suivant++; const o = owners[i];
        try {
          const out = await contexteVendeur.run({ owner: o }, () => traiter());
          bilans[i] = { owner: o, ...out };
        } catch (e) { echecs++; bilans[i] = { owner: o, erreur: String((e && e.message) || e).slice(0, 200) }; }
      }
    };
    await Promise.all(Array.from({ length: Math.min(VENDEURS_EN_PARALLELE, owners.length) }, ouvrier));
    res.status(echecs ? 500 : 200).json({ ok: !echecs, ...(soir ? { moment: 'soir' } : {}), vendeurs: owners.length, echecs, bilans });
  } catch (e) {
    // Une tâche planifiée qui répond 200 sur une panne n'apparaît nulle part :
    // le tableau de bord la compte réussie, et les rappels d'expédition
    // cessent en silence. 500 = visible.
    res.status(500).json({ ok: false, erreur: 'panne', message: String(e) });
  }
}
