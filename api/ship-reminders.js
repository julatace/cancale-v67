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
import crypto from 'node:crypto';
import { sendPushToAll, pushCategorieActive, prefsDuVendeur, vidangerResume, instantNotif, instantCalme } from './_lib/push.js';
import { CLE_RAPPELS, MEMO_RAPPELS, lireRappels, rappelsDus, memoApres, texteRappel, texteRappels, lienRappel, TAG_RAPPEL } from './_lib/rappels-perso.js';
import { CLE_REMISES, MEMO_REMISES, lireRemises, remisesDues, memoRemisesApres, texteRappelRemise, texteRappelsRemise, TAG_REMISE, instantRemise } from './_lib/remises-main-propre.js';
import { resumeReveil, ID_REVEIL } from './_lib/reveil-calme.js';
import { reglageCalme, reglageSoir, soirALHeure, reglageJours, dansHeuresCalmes } from './_lib/notif-textes.js';
import { lireJournal, lireLu } from './_lib/journal-notifs.js';
import { DESTINATIONS, lienNotif } from './_lib/lien-notif.js';
import { passageFacturesAuto } from './_lib/factures-auto.js';
// (revue du 5 nov.) Les textes des rappels soir et « offres au mini » : un propriétaire, celui de l'aperçu.
import { texteSoir, texteOffresMini } from './_lib/notif-apercus.js';
import { semainePassee, semaineCourante, calculerBilan, bilanAEnvoyer, texteBilan, versementsDeLignes } from './_lib/bilan-semaine.js';
import { notificationUrssaf, rappelAvantEcheance, MAIN_URSSAF } from './_lib/rappel-urssaf.js';
// « À expédier » : la règle du widget (elle-même jugée identique à celle de
// l'app et de l'extension par audit-statuts.cjs). Importée, jamais recopiée.
import { aExpedier } from './widget.js';
// La date limite d'envoi (avec son heure) : UNE règle, celle de l'app (§11).
import { bordsParTransaction, compterEcheances, heureCourte } from './_lib/limite-envoi.js';

import { withOwnerAll, conflictTarget, contexteVendeur, proprietaireCourant } from './_lib/owner.js';
import { MAIN_MOTS, motsServeur } from './_lib/mots-vendeur.js';
import { sbCle } from './_lib/cle.js';
import { ordreStable, finALaFrontiere } from './_lib/ordre-stable.js';
import { repondreSansCleService } from './_lib/cle-service.js';
import { comptesActifs, normaliserRegistre, lireDonnee as lireDonneeEbay, modifierDonnee as modifierDonneeEbay, jetonApplication, oublierJetonApplication } from './_lib/ebay.js';
import { passageAlertesEbay, notifAlertes } from './_lib/ebay-alertes.js';
import { colisEbay, resumeColisEbay, lireCommandesEbayServeur } from './_lib/ebay-a-expedier.js';
// (1er nov., audit A4) Les colis Leboncoin et Vestiaire à poster, et les ventes
// Vestiaire du bilan : les règles de l'app (un propriétaire, importé).
import { resumeColisSites } from './_lib/colis-sites.js';
import { ventesVcDe, numerosVcAvecLiens } from './_lib/vestiaire-regle.js';
import { SELECT_DEPART_META, departsParSuivi, txVintedParties } from './_lib/depart-colis.js';
import { ventesPartiesParPreuve, lirePreuvesDepart } from './_lib/depart-vente.js';
import { colisVentesEmailServeur, reqVentesEmail, txsDeCommandes } from './_lib/colis-ventes-email.js';
import { relireCommandesVendeur } from './_lib/ebay-relecture.js';
import { avecSuiviDuSujet, relireLigneMeta } from './_lib/suivi-colis.js';
import { rappelsRetraitDuJour, texteRappelRetrait, SELECT_SUIVI_META, txDuColis, liensDesLignes, finDesTransactions, SELECT_TRANSP_META, ligneTranspDeMeta } from './_lib/suivi-colis.js';
// (24 oct.) Le statut des colis lu chez leur transporteur (C1, C5).
import { passageTransporteurs, MAX_CRON, BUDGET_CRON_MS, MAX_DEPARTS_CRON } from './_lib/transporteurs-lecture.js';
import { accesVendeur } from './_lib/abonnement.js';
import { passageRelances, configurationRelances, adresseDuCompte } from './_lib/relances-essai.js';
import { passageClientsPartis } from './_lib/clients-partis.js';
// (8 nov.) Le bilan du mois par e-mail, pour qui l'a ACTIVÉ (api/_lib/bilan-mois.js).
import { bilanMoisVendeur, partBilan, ID_CHOIX as ID_CHOIX_BILAN_MOIS, ID_ENVOIS as ID_ENVOIS_BILAN_MOIS } from './_lib/bilan-mois.js';
import { envoyerSmtp } from './_lib/smtp.js';
import { lireMentions } from './_lib/mentions-legales.js';
// (5 nov.) « Compte Vinted pas relu » : la règle (api/_lib/comptes-a-relire.js).
// (8 nov.) Un compte qui n'arrive plus ALORS QUE l'extension travaille : la règle (api/_lib/garde-capture.js).
import { notifierComptesRelies } from './_lib/compte-relie.js';
import { notifierModeration } from './_lib/moderation-notif.js';
import { notifierAvisBas } from './_lib/avis-negatif.js';   // (11 nov.) le filet des avis négatifs
// (9 nov.) Le transporteur des anciens bordereaux, relu dans le texte de leur e-mail.
import { passeTransporteursAnciens, passeTransporteursPdf, reqPdf, avecRelus, REQ_RELUS, MAX_PDF_MATIN, BUDGET_PDF_MATIN_MS } from './_lib/transporteur-anciens.js';
import { pannesCapture, lireAppareils, decisionPannes, textePannes, CAT_CAPTURE, ID_MEMO_CAPTURE, SELECT_APPAREILS, PREFIXE_APPAREIL } from './_lib/garde-capture.js';
import { comptesLbcLies, comptesVcLies } from '../src/comptesLies.js';
import { compteEcarte } from './_lib/ventes-regle.js';
// (9 nov., suites serveur) L'offre Solo / Pro du vendeur (la ligne `abonnements` rangée par le
// webhook, la règle d'api/_lib/plan-regle.js) : bilans et rappel des offres au prix mini.
import { regleDuVendeur } from './_lib/plan-vendeur.js';
import { venteHorsPlan, venteAutreHorsPlan } from './_lib/plan-regle.js';
import { resumeDuSoir, offresVcDemain } from './_lib/resume-soir.js';
import { comptesARelire, dernieresCaptures, texteComptesARelire, decisionRelecture, CAT_RELECTURE, ID_MEMO_RELECTURE, SELECT_CAPTURES } from './_lib/comptes-a-relire.js';
// (6 nov., filet 4) La veille des plantages : le propriétaire prévenu d'un type JAMAIS VU (api/_lib/veille-plantages.js).
import { passageVeillePlantages, ID_MEMO_VEILLE, passageVeilleLenteurs, ID_MEMO_LENTEURS } from './_lib/veille-plantages.js';
// (8 nov.) Les alertes de plantage restées en attente pendant l'heure de repos : dites ici.
import { vidangerAlertesPlantages } from './_lib/alertes-plantages.js';
import { noterPilotageDuJour } from './_lib/pilotage.js';
// (6 nov.) La purge à 30 jours du HTML d'origine des e-mails (api/_lib/email-html.js).
import { purgerHtml } from './_lib/email-html.js';
// (6 nov., v36) Les temps réels des vendeurs (agrégats journaliers, api/_lib/mesures-terrain.js).
import { histosDesJours, purgerMesuresAnciennes } from './_lib/mesures-terrain.js';
import { proprietaireInstallation } from './_lib/signalement.js';
import { PROPRIETAIRE_NEUTRE } from './_lib/proprietaire-email.js';
import { reserverMemo } from './_lib/cas.js';   // (11 nov.) mémos par comparer-et-échanger
import { passerVendeurs, BUDGET_VENDEURS_MS, TEMPS_VENDEUR_MS, prendreBail, rendreBail } from './_lib/cron-lots.js';
import { modifierNeutre } from './_lib/neutre-cas.js';   // (11 nov., H14) le bail du passage
import { passageColisFrequent, MAX_LECTURES_VENDEUR, MAX_DEPARTS_VENDEUR, BUDGET_VENDEUR_MS, passageEtiquettes, MAX_PDF_VENDEUR_FREQUENT, BUDGET_ETIQUETTES_MS } from './_lib/colis-frequent.js';
// (9 nov.) Les sondes de vrm.center/statut et leurs incidents automatiques (api/_lib/statut-sondes.js).
import { passageSondes } from './_lib/statut-sondes.js';
import { groupeProduction, SIGNAUX as SIGNAUX_PROD, ECHECS_COLIS, refusEnSerie, purgerErreursAnciennes } from './_lib/alertes-production.js';
import { pushConfigure } from './_lib/push.js';
import { fetchAvecDelai } from './_lib/fetch-delai.js';   // (11 nov.) chaque appel sortant a un délai
// (11 nov., lot agent2-veille) Le contrôle de nuit (lecture seule) et la veille des chiffres.
import { controleVendeur, controleInstallation } from './_lib/controle-nuit.js';
import { notifierAlertesChiffres } from './_lib/veille-chiffres.js';
import { CAT_VEILLE } from '../src/veilleChiffres.js';
import { stripeApi, stripePret } from './_lib/stripe.js';
// (7 nov.) Les e-mails de l'essai passent AVANT les vendeurs : après 60 s, aucun
// ne COMMENCE (le reste part le lendemain ; les vendeurs gardent leur temps).
const RELANCES_JUSQUA_MS = 60000;

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
    const r = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/${scoped(`app_data?id=eq.${encodeURIComponent(id)}&select=data`)}`, { headers: HEADERS });
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
    const r = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/app_data?select=owner&limit=1`, { headers: HEADERS });
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
// (11 nov.) Les mémos qui décident d'un ENVOI se RÉSERVENT par comparer-et-échanger
// (`reserverDedup` ci-dessous) ; celui-ci reste l'écriture simple (lignes de travail).
async function ecrireDedup(id, data) {
  const o = proprietaireCourant();
  const row = o ? { owner: o, id, data } : withOwnerAll([{ id, data }])[0];
  const conflict = o ? 'owner,id' : conflictTarget('id');
  // Rend VRAI seulement si la base a confirmé : le bilan de la semaine ne part
  // QUE si son mémo est rangé (sinon il repartirait le lendemain — deux bilans).
  try {
    const r = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=${conflict}`, {
      method: 'POST',
      headers: { ...HEADERS, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([row]),
    });
    return !!(r && r.ok);
  } catch (_) { return false; /* un mémo raté n'empêche pas le rappel suivant */ }
}
// (11 nov., M80/M81/B130) RÉSERVER le mémo AVANT d'envoyer (comparer-et-échanger) :
// deux passages simultanés ⇒ un seul envoie ; un mémo illisible ⇒ RIEN n'est
// envoyé (« pas su » ne vaut jamais « jamais envoyé »). Base pas cloisonnée
// (installation d'avant) : la lecture puis l'écriture d'avant, « pas su » compris.
async function reserverDedup(id, deja, nouveau) {
  const o = proprietaireCourant();
  if (o) return reserverMemo({ url: SUPABASE_URL, entetes: HEADERS, owner: o, id, deja, nouveau });
  const d = await getRow(id);
  if (d === undefined) return { reserve: false, raison: 'pas-su' };
  if (deja(d)) return { reserve: false, raison: 'deja' };
  return (await ecrireDedup(id, nouveau(d))) ? { reserve: true } : { reserve: false, raison: 'pas-su' };
}
// ⚠️ §4.5 — Supabase tronque à 1000 lignes SANS LE DIRE. Ce cron balaie
// `email_bord_*` et `harvest_%25_orders_sold` de TOUS les utilisateurs : à
// l'échelle, au-delà de 1000 lignes il en perdrait en silence → des vendeurs
// sans rappel d'expédition. On pagine, et `null` si une page échoue (jamais une
// demi-liste prise pour complète — même règle que `sbGetTout` côté app).
async function fetchPaginated(path) {
  const out = []; const page = 1000;
  for (let from = 0; ; from += page) {
    if (from >= 500000) return null;   // (11 nov., familles-serveur) au plafond : « pas su », jamais une demi-liste — cron
    let r;
    // (7 nov.) Un ordre TOTAL : sans `order=`, une ligne peut sauter ou revenir d'une page à l'autre.
    try { r = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/${ordreStable(path)}`, { headers: { ...HEADERS, 'Range-Unit': 'items', Range: `${from}-${from + page - 1}` } }); }
    catch (_) { return null; }
    if (finALaFrontiere(r, from)) break;   // (11 nov.) 416 à une frontière exacte = fin de liste
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
    const r = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/${scoped(`app_data?id=eq.${encodeURIComponent(id)}&select=${sel}`)}`, { headers: HEADERS });
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
// (2 nov., soir) + Vestiaire : « Colis fait » et les N° donnés aux annonces (src/numerosVestiaire.js).
const MAIN_BILAN = [MAIN_MOTS, 'vinted_accounts_hidden', 'vinted_ship_done', 'vinted_bords_shipped', 'vrm_paires_dorment', 'vrm_lbc_colis_done', 'vrm_vc_colis_done', 'vrm_vc_numeros', 'vrm_vc_liens', 'vrm_comptes_exclus'];
const ensemble = (v) => new Set(Array.isArray(v) ? v.map(String) : []);
const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

// Lit tout ce que le bilan d'UN vendeur demande. Chaque source vaut `null`
// quand sa lecture a échoué — jamais `[]` à sa place (« rien lu » ≠ « rien »).
async function lireDonneesBilan() {
  const [comptesL, m, panneau, lignes, lbcL, ebayL, txn, vcV, vcL, dep, regle] = await Promise.all([
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
    // (1er nov.) Les ventes Vestiaire et les liens de ses annonces (identité).
    getRowProjete('vc_ventes', ['ventes']),
    getRowProjete('vc_listings', ['liens']),
    // (8 nov.) Les départs prouvés chez le transporteur (api/_lib/depart-colis.js).
    fetchPaginated(scoped(`app_data?id=like.depart_*&select=${SELECT_DEPART_META}`)),
    // (9 nov., suites serveur) L'offre du vendeur : en Solo, les ventes des comptes d'achat
    // n'entrent dans aucun total (`compteEcarte`, 4e argument). `null` = pas su ⇒ rien bridé.
    regleDuVendeur(proprietaireCourant()).catch(() => null),
  ]);
  const departs = Array.isArray(dep) ? departsParSuivi(dep) : null;
  // (8 nov., « à envoyer » prouvé) Les bordereaux (leur n° de suivi) et les preuves de départ :
  // le bilan compte les colis à envoyer avec la règle du widget et de Colis (§11).
  const [bordsB, preuves, mailsVentes] = await Promise.all([
    lireBordsAvecRelus(BORD_COLIS),
    lirePreuvesDepart((p) => fetchPaginated(scoped(p)), (x) => avecSuiviDuSujet(relireLigneMeta(x))),
    // (8 nov.) Les e-mails de vente récents (scalaires `meta->>`, la requête de l'app).
    fetchPaginated(scoped(reqVentesEmail(Date.now()))),
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
    exclusAutres: mm ? objet(mm.vrm_comptes_exclus) : null,
    panneau: panneau === undefined ? null : objet(panneau),
    regle: regle || null,
    lbc: lbcL === undefined ? null : Object.values(objet(lbcL && lbcL.ventes)),
    // Les colis Leboncoin et Vestiaire à poster (`txsAExpedier`) : les mêmes lignes.
    lbcVentes: lbcL === undefined ? null : (objet(lbcL && lbcL.ventes) || {}),
    vc: (vcV === undefined || vcL === undefined) ? null : { ventes: (vcV && vcV.ventes) || null, liens: (vcL && vcL.liens) || {}, auto: numerosVcAvecLiens((mm && mm.vrm_vc_numeros) || {}, mm && mm.vrm_vc_liens), fait: (mm && mm.vrm_vc_colis_done) || {}, departs },
    departs, bords: bordsB, preuves,
    mailsVentes: Array.isArray(mailsVentes) ? mailsVentes : null,
    ebay: ebayL,
    versements: versementsDeLignes(txn),
    // `null` = illisible (le bilan le NOMME) ; ligne absente = aucune vente.
    vestiaire: (vcV === undefined || vcL === undefined) ? null : ventesVcDe({ ventes: (vcV && vcV.ventes) || null, liens: (vcL && vcL.liens) || {}, auto: numerosVcAvecLiens((mm && mm.vrm_vc_numeros) || {}, mm && mm.vrm_vc_liens) }),
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
  return t.vinted.size + (t.ebay ? t.ebay.total : 0) + (t.leboncoin ? t.leboncoin.total : 0) + (t.vestiaire ? t.vestiaire.total : 0);
}
// Un site illisible parmi ceux qui portent des colis : le nombre est « au moins ».
const colisManque = (t) => (t ? [!t.ebay && 'eBay', !t.leboncoin && 'Leboncoin', !t.vestiaire && 'Vestiaire'].filter(Boolean) : []);
// Les transactions Vinted à expédier (un Set) et le résumé eBay (`null` =
// illisible) — la composition du widget, partagée par le bilan du lundi et le
// rappel du soir (§11 : une règle, deux lecteurs). `null` = pas su.
function txsAExpedier(d) {
  if (!d.commandes || !d.main || !Array.isArray(d.comptes)) return null;
  const vivants = new Set(d.comptes.map((c) => c.uid));
  const shipDone = objet(d.main.vinted_ship_done), bordsShipped = objet(d.main.vinted_bords_shipped);
  const masquees = new Set();   // (29 oct.) une vente ne se masque plus
  // (8 nov.) + parti d'après le transporteur (le n° du bordereau de CETTE
  // transaction pris en charge, api/_lib/depart-colis.js — la règle de Colis).
  // (8 nov., « à envoyer » prouvé) LA RÈGLE DE COLIS (api/_lib/depart-vente.js) : + l'e-mail
  // du transporteur pour le n° EXACT du bordereau de CETTE transaction et le panneau de
  // l'extension. Une preuve illisible (`null`) manque, rien d'autre : le colis reste compté.
  const pr = d.preuves || {};
  const partisVinted = ventesPartiesParPreuve({ bordsParTx: Array.isArray(d.bords) ? bordsDuVendeur(d) : {}, shipDone, bordsShipped,
    panelBordsDone: pr.panelBordsDone || {}, lignesEmail: pr.lignesEmail || null, departs: d.departs, entrants: pr.entrants || null, etiquettes: pr.etiquettes || null });
  const pasPartie = (t) => !masquees.has(t) && !partisVinted.has(String(t));
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
  // (1er nov., audit A4) Leboncoin et Vestiaire : la règle de Colis
  // (`resumeColisSites`). Illisible ⇒ `null`, nommé par l'appelant.
  const autres = resumeColisSites({ lbc: d.lbcVentes, vc: d.vc, fait: d.main.vrm_lbc_colis_done });
  const vinted = new Set(txs.map(String).filter(pasPartie));
  // (8 nov.) + les ventes vues par e-mail dont le bordereau est là — le nombre de Ma journée et du widget.
  for (const t of ventesEmailColis(d).txs) vinted.add(String(t));
  return { vinted, ebay: eb, leboncoin: autres.leboncoin, vestiaire: autres.vestiaire };
}
// (8 nov.) LES VENTES VUES PAR E-MAIL DONT LE BORDEREAU EST LÀ (api/_lib/colis-ventes-email.js — les
// règles de l'app, importées telles quelles). Les listes lues ici sont ENTIÈRES (`orders`) : « n°
// absent de la liste » se juge sur elles ; leur lecture (`capturedAt`) date chaque compte. Une source
// illisible (e-mails, comptes, réglages, panneau) ⇒ aucune (pas su), jamais un colis inventé.
function ventesEmailColis(d) {
  if (!d || !d.commandes || !d.main || !Array.isArray(d.comptes) || !Array.isArray(d.mailsVentes) || !d.panneau) return { txs: [], ventes: {} };
  const vivants = new Set(d.comptes.map((c) => c.uid));
  const connues = [], lectures = {};
  for (const [uid, l] of Object.entries(d.commandes)) {
    if (vivants.size && !vivants.has(uid)) continue;
    connues.push(...txsDeCommandes(l.orders));
    const c = Date.parse(l.cap || '');
    if (Number.isFinite(c)) lectures[uid] = Math.max(lectures[uid] || 0, c);
  }
  const pr = d.preuves || {};
  return colisVentesEmailServeur({ mails: d.mailsVentes, comptes: [...vivants], masques: d.main.vinted_accounts_hidden, panneau: d.panneau, connues, lectures,
    bordsParTx: Array.isArray(d.bords) ? bordsDuVendeur(d) : {}, shipDone: objet(d.main.vinted_ship_done), bordsShipped: objet(d.main.vinted_bords_shipped),
    panelBordsDone: pr.panelBordsDone || {}, lignesEmail: pr.lignesEmail || null, departs: d.departs, entrants: pr.entrants || null, etiquettes: pr.etiquettes || null });
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
    ...d, colis: colisAExpedier(d), colisAuMoins: colisManque(txsAExpedier(d)).length > 0, colisManque: colisManque(txsAExpedier(d)),
    dorment: d.main ? d.main.vrm_paires_dorment : null,
    debut: sem.debut, fin: sem.fin, seuilCapture: sem.seuilCapture, maintenant,
  });
  if (!bilanAEnvoyer(b)) return 'données illisibles — réessai demain';
  // Le mémo AVANT l'envoi, et CONFIRMÉ : un bilan par semaine, jamais deux.
  if (!(await ecrireDedup('bilan_semaine_dedup', { semaine: sem.lundi, at: new Date(maintenant).toISOString() }))) return 'mémo non écrit — rien envoyé';
  const t = texteBilan(b, sem, motsServeur(d.main && d.main[MAIN_MOTS], proprietaireCourant()));   // (11 nov.) « paire » / « article »
  const envoi = await sendPushToAll({ cat: 'bilan', title: t.titre, body: t.corps, tag: 'bilan-' + sem.lundi, url: DESTINATIONS.semaine({ lundi: sem.lundi }) });   // (10 nov., lot BC) l'écran « Ma semaine », sur CETTE semaine
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
  const r = await retraitsDuJour(maintenant, 0);
  if (typeof r === 'string') return r;
  const { liste, txsPar } = r;
  const today = parisDate(0);
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
  // (3 nov.) « Colis à vérifier » ne sonne plus : un délai dépassé ne dit pas où
  // est le colis (mesuré le 29 oct. : 5 sur 5 avaient été retirés) — ce n'est
  // pas un fait. Il reste dans Colis → « à vérifier ». Seul « dernier jour » sonne.
  for (const x of nouveaux.filter((y) => y.etat === 'dernier')) {
    const t = texteRappelRetrait(x);
    envoi = await sendPushToAll({ cat: 'colis', title: t.title, body: t.body, echeance: x.limiteAt || null, tag: 'retrait-' + x.cle, url: DESTINATIONS.retrait({ suivi: x.suivi, tx: txUniqueDe(txsPar, x.suivi) }) });
  }
  // Aucun n° de suivi ni lieu dans la réponse d'un cron : des nombres.
  return { retrait: 'envoyé', dernier: nouveaux.filter((x) => x.etat === 'dernier').length, aVerifier: nouveaux.filter((x) => x.etat === 'a_verifier').length,
    envoi: envoi && (envoi.coupe || envoi.erreur || envoi.sent) };
}
// La transaction d'un colis quand elle est UNIQUE (sinon '' : l'écran s'ouvre sur la colonne).
const txUniqueDe = (txsPar, suivi) => { const t = txsPar.get(suivi); return t && t.size === 1 ? [...t][0] : ''; };
// (10 nov., lot AT) LES COLIS À RETIRER D'UN JOUR, la règle du matin (`rappelsRetraitDuJour`)
// partagée avec le résumé du soir : `jourCible` 0 = aujourd'hui (« dernier jour », « à vérifier »),
// 1 = demain (« demain » : la date limite LUE tombe demain). Rend { liste, txsPar } ou la
// raison (texte) d'une lecture ratée — « pas su » n'annonce rien.
async function retraitsDuJour(maintenant = Date.now(), jourCible = 0) {
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
  const candidats = rappelsRetraitDuJour({ ...entree, jourCible });
  if (!candidats.length) return { liste: [], txsPar: new Map() };
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
  const liste = rappelsRetraitDuJour({ ...entree, liens, jourCible,
    finParCommande: ({ suivi, code }) => finDesTransactions(txDuColis({ suivi, code }, relais, liens), achats, etats) });
  return { liste, txsPar };
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
// (7 nov., audit « 1 000 vendeurs ») LA LECTURE RÉDUITE. Le filtre `cs` ouvre
// le JSON de CHAQUE conversation du vendeur (des milliers à l'échelle). Sans
// migration, on borne ce que la base examine et renvoie par deux filtres :
//   · la DATE de capture, scalaire déjà copié dans `meta` (déclencheur de la
//     migration 004) : seules les conversations captées depuis
//     `OFFRES_MINI_JOURS` jours. Rien n'est perdu : le cron passe chaque jour et
//     chaque offre est dédoublée par son identité — une offre captée il y a plus
//     d'une semaine a déjà eu ses passages (et une offre Vinted de cet âge a expiré) ;
//   · l'ARTICLE : seulement les conversations des annonces qui ont un prix mini
//     (`item_id=in.(…)`, identifiants numériques seuls), quand il y en a au plus
//     `OFFRES_MINI_ARTICLES_MAX` (au-delà l'URL serait trop longue : filtre de date seul).
// Ce qu'une migration apporterait (pas faite ici) : copier dans `meta` l'item et
// un témoin « offre en attente » des lignes `harvest_*_conv_*` (comme pour les
// transactions), pour que la base ne décompresse plus aucun `data`.
const OFFRES_MINI_JOURS = 7;
const OFFRES_MINI_ARTICLES_MAX = 200;
export function filtresOffresMini(planchers, maintenant = Date.now()) {
  const depuis = new Date(maintenant - OFFRES_MINI_JOURS * 86400000).toISOString();
  const ids = [...planchers.keys()].map(String).filter((x) => /^\d{1,20}$/.test(x));
  const parArticle = ids.length && ids.length <= OFFRES_MINI_ARTICLES_MAX ? `&data->payload->conversation->transaction->>item_id=in.(${ids.join(',')})` : '';
  return `meta->>capturedAt=gte.${encodeURIComponent(depuis)}${parArticle}`;
}
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
  const rows = await fetchPaginated(scoped(`app_data?id=like.harvest_%25_conv_%25&${filtresOffresMini(planchers, maintenant)}&${OFFRES_MINI_FILTRE}&select=id,opp:data->payload->conversation->opposite_user->>id,item:data->payload->conversation->transaction->>item_id,msgs:data->payload->conversation->messages`));
  if (rows === null) return 'conversations illisibles — rien envoyé';       // « pas su » ⇒ rien
  // (9 nov., suites serveur) SOLO : les offres d'un compte d'achat sont hors de son offre
  // (api/_lib/plan-regle.js : « ventes, annonces, colis à envoyer, offres et compta » du
  // compte vendeur). Le compte = celui de la LIGNE (`harvest_{uid}_conv_{id}`, une identité).
  // Offre illisible (`null`) ⇒ rien n'est bridé.
  const regle = await regleDuVendeur(proprietaireCourant()).catch(() => null);
  const auMini = [];
  const convDe = new Map();   // offre → sa conversation (l'identité de la LIGNE, harvest_{uid}_conv_{id})
  for (const r of rows) {
    const item = r && r.item != null && r.item !== '' ? String(r.item) : null;
    if (!item || !planchers.has(item)) continue;
    const cpt = /^harvest_(\d+)_conv_/.exec(String((r && r.id) || ''));
    if (cpt && venteHorsPlan(regle, cpt[1])) continue;
    const off = offreCouranteServeur(r && r.opp != null ? r.opp : null, r && r.msgs);
    if (off && off.prix >= planchers.get(item)) { auMini.push(off.oid); const m = /^harvest_(\d+)_conv_(\d+)$/.exec(String((r && r.id) || '')); if (m) convDe.set(off.oid, { compte: m[1], conv: m[2] }); }
  }
  const deja = await getRow('offres_mini_dedup');
  if (deja === undefined) return 'mémo illisible — rien envoyé';            // « pas su » ⇒ rien
  const vus = new Set(Array.isArray(deja && deja.oids) ? deja.oids : []);
  const nouveaux = [...new Set(auMini)].filter((o) => !vus.has(o));
  if (!nouveaux.length) return auMini.length ? 'déjà notifiées' : 'aucune offre au-dessus du mini';
  const garde = [...vus, ...nouveaux].slice(-400);                          // mémo borné
  if (!(await ecrireDedup('offres_mini_dedup', { oids: garde, at: new Date(maintenant).toISOString() }))) return 'mémo non écrit — rien envoyé';
  const n = nouveaux.length;
  // Une seule offre ⇒ sa conversation, ouverte, avec la carte d'offre ; plusieurs ⇒ le filtre « Offres ».
  const uneSeule = n === 1 ? (convDe.get(nouveaux[0]) || null) : null;
  // (revue du 5 nov.) Une seule offre ⇒ cible=offre : SA conversation ouverte ET la carte de l'offre en évidence.
  const envoi = await sendPushToAll({
    ...texteOffresMini(n),
    tag: 'offremini', url: n === 1 && uneSeule ? DESTINATIONS.offre(uneSeule) : DESTINATIONS.offres() });
  return { offremini: 'envoyé', n, envoi: envoi && (envoi.coupe || envoi.erreur || envoi.sent) };
}

// ── COMPTE VINTED PAS RELU DEPUIS PLUS DE 24 H (5 nov.) ─────────────────────
// Au passage du MATIN seulement, pour CE vendeur : les comptes Vinted gardés
// dans les totaux dont la dernière lecture a plus de 24 h, nommés, avec le geste
// (api/_lib/comptes-a-relire.js, les règles de l'app). UNE notification par
// jour au plus : mémo `relecture_rappel_dedup` lu en trois états (illisible ⇒
// rien), écrit AVANT l'envoi et confirmé. Famille « Rappels » coupée ⇒ rien ;
// heures calmes ⇒ rangée dans le centre, pas sonnée (`sendPushToAll`). Une
// lecture ratée (comptes, réglages, lignes captées) ⇒ rien : « pas su » ne
// nomme personne. Seulement des scalaires (§4.4), paginés (§4.5).
async function rappelComptesARelire(maintenant = Date.now(), dejaEnPanne = new Set()) {
  if (!(await pushCategorieActive(CAT_RELECTURE))) return 'désactivé par le vendeur';
  const [comptesL, m, panneau, etats, noirs, lignes] = await Promise.all([
    fetchPaginated(scoped('vinted_accounts?select=vinted_user_id,login')),
    getRowProjete('main', ['vinted_accounts_hidden']),
    getRow('panel_accounts_off'),
    getRowProjete('panel_comptes_etat', ['comptes']),
    getRowProjete('vrm_blocked_accounts', ['uids']),
    fetchPaginated(scoped(`app_data?id=like.harvest_%25&meta->>supprime=is.null&select=${SELECT_CAPTURES}`)),
  ]);
  if (!Array.isArray(comptesL) || m === undefined || panneau === undefined || etats === undefined || noirs === undefined || !Array.isArray(lignes)) return 'lecture ratée — rien envoyé';
  const liste = comptesARelire({
    comptes: comptesL,
    captures: dernieresCaptures(lignes),
    masques: ensemble(m && m.vinted_accounts_hidden),
    panneau: objet(panneau),
    etats: objet(etats && etats.comptes),
    supprimes: ensemble(noirs && noirs.uids),
    maintenant,
  });
  // (8 nov.) Un compte déjà nommé par l'alerte de panne (même passage) ne sonne pas deux fois.
  if (Array.isArray(liste) && dejaEnPanne.size) for (let i = liste.length - 1; i >= 0; i--) if (dejaEnPanne.has(liste[i].uid)) liste.splice(i, 1);
  const today = parisDate(0);
  const memo = liste && liste.length ? await getRow(ID_MEMO_RELECTURE) : null;
  const d = decisionRelecture({ liste, memo, jour: today });
  if (!d.envoyer) return { relecture: d.raison, n: Array.isArray(liste) ? liste.length : null };
  if (!(await ecrireDedup(ID_MEMO_RELECTURE, { jour: today, n: liste.length, at: new Date(maintenant).toISOString() }))) return 'mémo non écrit — rien envoyé';
  const t = texteComptesARelire(liste);
  const envoi = await sendPushToAll({ cat: CAT_RELECTURE, ...t, tag: 'relecture-' + today, url: DESTINATIONS.comptes() });
  // Aucun pseudo dans la réponse d'un cron : un nombre.
  return { relecture: 'envoyé', n: liste.length, envoi: envoi && (envoi.coupe || envoi.erreur || envoi.sent) };
}

// ── UN COMPTE QUI N'ARRIVE PLUS, ALORS QUE L'EXTENSION TRAVAILLE (8 nov.) ───
// Matin ET soir, pour CE vendeur. Les extensions 5.327+ publient leur appareil
// (`ext_appareil_*` : version, envois réussis/refusés, comptes lus) ; un compte
// Vinted, Leboncoin ou Vestiaire pas relu depuis plus de 12 h ALORS QU'un
// appareil a travaillé sur ce site depuis moins de 12 h — et l'a VU ouvert, ou
// a vu son dernier envoi REFUSÉ — est une panne (api/_lib/garde-capture.js,
// la règle de l'app). UNE notification par panne (mémo `capture_panne_dedup`,
// clé site:compte:dernière relecture), famille « Rappels », heures calmes et
// plafond de `sendPushToAll`. Toute lecture ratée ⇒ rien (« pas su »). Aucun
// appareil actif ⇒ rien (le rappel « pas relu depuis 24 h » reste le filet).
// Rend { bilan, uids } : les comptes Vinted en panne (le rappel de 24 h se tait pour eux).
async function rappelPannesCapture(maintenant = Date.now()) {
  const vide = (b) => ({ bilan: b, uids: new Set() });
  if (!(await pushCategorieActive(CAT_CAPTURE))) return vide('désactivé par le vendeur');
  const rowsApp = await fetchPaginated(scoped(`app_data?id=like.${PREFIXE_APPAREIL}%25&select=${SELECT_APPAREILS}`));
  const appareils = lireAppareils(rowsApp, maintenant);
  if (!appareils) return vide('appareils illisibles — rien envoyé');
  if (!appareils.some((a) => maintenant - a.at <= 12 * 3600e3)) return vide('aucun appareil actif');
  const [comptesL, m, panneau, etats, noirs, lignes, lbcA, lbcL, vcS, vcL, vcV] = await Promise.all([
    fetchPaginated(scoped('vinted_accounts?select=vinted_user_id,login')),
    getRowProjete('main', ['vinted_accounts_hidden']),
    getRow('panel_accounts_off'),
    getRowProjete('panel_comptes_etat', ['comptes']),
    getRowProjete('vrm_blocked_accounts', ['uids']),
    fetchPaginated(scoped(`app_data?id=like.harvest_%25&meta->>supprime=is.null&select=${SELECT_CAPTURES}`)),
    getRowProjete('lbc_accounts', ['accounts']),
    getRowProjete('lbc_listings', ['lectures']),
    getRowProjete('vc_session', ['id', 'at', 'comptes']),
    getRowProjete('vc_listings', ['capturedAt']),
    getRowProjete('vc_ventes', ['capturedAt']),
  ]);
  if (!Array.isArray(comptesL) || m === undefined || panneau === undefined || etats === undefined || noirs === undefined || !Array.isArray(lignes)
    || lbcA === undefined || lbcL === undefined || vcS === undefined || vcL === undefined || vcV === undefined) return vide('lecture ratée — rien envoyé');
  const caps = dernieresCaptures(lignes) || {};
  const masques = ensemble(m && m.vinted_accounts_hidden), supprimes = ensemble(noirs && noirs.uids), et = objet(etats && etats.comptes), pan = objet(panneau);
  const comptes = [];
  for (const c of comptesL) {
    const uid = String((c && c.vinted_user_id) || ''); if (!/^\d+$/.test(uid)) continue;
    const ecarte = supprimes.has(uid) || compteEcarte(uid, masques, pan) || !!(et[uid] && et[uid].etat === 'banni');
    comptes.push({ plateforme: 'vinted', id: uid, nom: String((c && c.login) || '').trim(), lu: Number.isFinite(caps[uid]) ? caps[uid] : null, ecarte });
  }
  for (const c of comptesLbcLies(objet(lbcA && lbcA.accounts), objet(lbcL && lbcL.lectures))) comptes.push({ ...c, ecarte: false });
  for (const c of comptesVcLies(vcS, { captures: [vcL && vcL.capturedAt, vcV && vcV.capturedAt] })) comptes.push({ ...c, ecarte: !!c.nonIdentifie });
  const liste = pannesCapture({ comptes, appareils, maintenant });
  const uids = new Set((liste || []).filter((p) => p.plateforme === 'vinted').map((p) => p.id));
  const memo = liste && liste.length ? await getRow(ID_MEMO_CAPTURE) : null;
  const d = decisionPannes({ liste, memo, maintenant });
  if (!d.envoyer) return { bilan: { capture: d.raison, n: Array.isArray(liste) ? liste.length : null }, uids };
  // Le mémo d'abord (confirmé) : un mémo pas écrit ⇒ rien envoyé (on ne resonnerait pas sans fin).
  if (!(await ecrireDedup(ID_MEMO_CAPTURE, d.memo))) return { bilan: 'mémo non écrit — rien envoyé', uids };
  const tx = textePannes(d.nouvelles);
  const envoi = await sendPushToAll({ cat: CAT_CAPTURE, ...tx, tag: 'capture-' + d.nouvelles.map((p) => p.cle).join('|').slice(0, 60), url: DESTINATIONS.toutVaBien() });
  return { bilan: { capture: 'envoyé', n: d.nouvelles.length, envoi: envoi && (envoi.coupe || envoi.erreur || envoi.sent) }, uids };
}

// (5 nov.) L'AGENT eBAY EST ARRÊTÉ (Julien : « le bot eBay, arrête-le, c'est nul »).
// Sa notification du matin (« 🛒 N paires prêtes pour eBay ») ne part plus : le
// cron ne lit plus `vrm_agent_ebay_resume` ni `agent_ebay_dedup` (données gardées
// en base, plus lues). Ne pas la remettre sans qu'il le demande.

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
async function lireTransporteursDuVendeur({ max = MAX_CRON, maxDeparts = MAX_DEPARTS_CRON, budgetMs = BUDGET_CRON_MS } = {}) {
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
      passageTransporteurs({ max, maxDeparts, budgetMs: budgetMs - 2000, signal: arret.signal }),
      new Promise((ok) => { minuteur = setTimeout(() => ok({ ok: false, raison: 'delai' }), budgetMs); }),
    ]);
    if (!r || !r.ok) return { fait: false, reason: (r && r.raison) || 'pas-su' };
    return { fait: true, lus: r.lus.filter((x) => x.res === 'ok').length, echecs: r.lus.filter((x) => x.res !== 'ok').length, changes: r.lus.filter((x) => x.change).length, navigateur: r.besoinNavigateur.length, ...(r.arrete ? { arrete: true } : {}) };
  } catch (_) { return { fait: false, reason: 'erreur' }; }
  finally { clearTimeout(minuteur); arret.abort(); }   // l'arrêt, dès la réponse (le filet ou le passage)
}
// ── LE BILAN DU MOIS PAR E-MAIL (8 nov., api/_lib/bilan-mois.js) ─────────────
// Du 1er au 7 du mois, pour le mois écoulé, seulement si le vendeur l'a ACTIVÉ
// (`bilan_mois_choix`, écrit par le serveur seul). Les lectures sont celles du
// bilan de la semaine (projetées, paginées) + la publication du bénéfice. Le
// canal : le serveur SMTP des e-mails de l'essai (RELANCES_SMTP_*). La part du
// jour est posée par le handler, partagée par les lots DE CE PASSAGE.
// (12 nov., M79) Elle voyage dans le contexte du vendeur (`contexteVendeur`,
// `compteurBilan`), plus dans une variable de module : deux passages simultanés
// sur la même instance ne se volent plus le plafond. Sans compteur : rien.
async function bilanDuMoisVendeur(maintenant = Date.now()) {
  const owner = proprietaireCourant();
  if (!owner) return null;
  const store = contexteVendeur.getStore && contexteVendeur.getStore();
  const compteur = store && store.compteurBilan;
  if (!compteur) return null;
  const cfg = configurationRelances();
  return bilanMoisVendeur({
    owner, maintenant, compteur, config: cfg, service: process.env.SUPABASE_SERVICE_KEY || '',
    lireChoix: () => getRow(ID_CHOIX_BILAN_MOIS), lireEnvois: () => getRow(ID_ENVOIS_BILAN_MOIS),
    ecrireEnvois: (data) => ecrireDedup(ID_ENVOIS_BILAN_MOIS, data),
    lireDonnees: lireDonneesBilan,
    lirePub: async () => { const m = await getRowProjete('main', ['vrm_benefice_jours']); return m === undefined ? undefined : (m && m.vrm_benefice_jours) || null; },
    adresse: () => adresseDuCompte(owner),
    envoyer: (m) => envoyerSmtp({ hote: process.env.RELANCES_SMTP_HOTE, port: cfg.port, utilisateur: process.env.RELANCES_SMTP_UTILISATEUR, motDePasse: process.env.RELANCES_SMTP_MOT_DE_PASSE,
      de: process.env.RELANCES_EXPEDITEUR, nomDe: 'VRM', ...m }),
  });
}
// (9 nov. au soir) La passe des étiquettes au nom du vendeur du contexte — le matin ET au passage de 15 min.
function etiquettesCron({ max, budgetMs }) {
  return passeTransporteursPdf({
    lireTout: (p) => fetchPaginated(scoped(p)), getRow, ecrire: ecrireDedup, max, budgetMs,
    lirePdf: async (id) => { const r = await fetchPaginated(scoped(reqPdf(id))); if (!Array.isArray(r)) return null; return (r[0] && typeof r[0].pdf === 'string' && r[0].pdf !== 'None') ? r[0].pdf : ''; },
  });
}
async function traiterVendeur() {
  const [relu, transp] = await Promise.all([relireEbayDuVendeur(), lireTransporteursDuVendeur()]);
  // Un échec du bilan du mois n'empêche aucun rappel (et inversement).
  let bilanMois = null;
  try { bilanMois = await bilanDuMoisVendeur(); } catch (e) { bilanMois = 'échec : ' + String((e && e.message) || e).slice(0, 120); }
  // (9 nov.) Le transporteur des ANCIENS bordereaux, relu dans le texte gardé de
  // LEUR e-mail (api/_lib/transporteur-anciens.js) : N par passage, idempotent ;
  // une lecture ratée n'écrit rien, et un échec n'empêche aucun rappel.
  let transporteursAnciens = null;
  try {
    transporteursAnciens = await passeTransporteursAnciens({
      lireTout: (p) => fetchPaginated(scoped(p)), getRow, ecrire: ecrireDedup,
    });
  } catch (e) { transporteursAnciens = { fait: false, raison: 'échec : ' + String((e && e.message) || e).slice(0, 120) }; }
  // (9 nov., transporteurs inconnus) Le transporteur écrit sur l'ÉTIQUETTE des anciens bordereaux
  // (le PDF de CETTE transaction, api/_lib/transporteur-pdf.js), un par requête. (9 nov. au soir,
  // « transporteurs parfaits ») Plus 6 par jour : jusqu'à MAX_PDF_MATIN dans BUDGET_PDF_MATIN_MS, puis
  // le passage de 15 min (`?moment=colis`) continue tant que la ligne dit qu'il en reste (`pdfReste`).
  let transporteursPdf = null;
  try { transporteursPdf = await etiquettesCron({ max: MAX_PDF_MATIN, budgetMs: BUDGET_PDF_MATIN_MS }); }
  catch (e) { transporteursPdf = { fait: false, raison: 'échec : ' + String((e && e.message) || e).slice(0, 120) }; }
  // (11 nov., lot agent2-veille) Le contrôle de nuit, en LECTURE SEULE (api/_lib/controle-nuit.js) :
  // une seule écriture, SA ligne `vrm_controle_nuit` ; un échec n'empêche aucun rappel.
  let controle = null;
  try { controle = await controleVendeur({ lireTout: (p) => fetchPaginated(scoped(p)), ecrire: ecrireDedup }); }
  catch (e) { controle = { ecrit: false, raison: 'échec : ' + String((e && e.message) || e).slice(0, 120) }; }
  // Un chiffre qui a chuté sans raison et n'a pas encore sonné (le filet de `/api/push` action `veille`).
  let veilleChiffres = null;
  try { veilleChiffres = await notifierAlertesChiffres({ getRow, ecrire: ecrireDedup, pousser: sendPushToAll, active: () => pushCategorieActive(CAT_VEILLE) }); }
  catch (e) { veilleChiffres = { envoye: false, raison: 'échec : ' + String((e && e.message) || e).slice(0, 120) }; }
  const out = await traiterVendeurApresRelecture();
  const rappels = await rappelsPersoSur();
  return { ...out, rappels, ...(bilanMois ? { bilanMois } : {}), ebayRelu: resumeRelecture(relu), transporteurs: transp, transporteursAnciens, transporteursPdf, controle, veilleChiffres: { envoye: veilleChiffres.envoye, n: veilleChiffres.n || 0, raison: veilleChiffres.raison || null } };
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
        const deja = await getRow('urssaf_reminder_dedup');
        if (deja === undefined) urssaf = 'mémo illisible — rien';
        else if ((deja || {}).mois !== mois && await pushCategorieActive('urssaf')) {
          const n = notificationUrssaf({ today, main: await getRowProjete('main', MAIN_URSSAF) });
          let res = { reserve: false, raison: '' };
          if (n.envoyer) {
            res = await reserverDedup('urssaf_reminder_dedup', (d) => !!d && d.mois === mois, (d) => ({ ...(d || {}), mois }));
            if (res.reserve) await sendPushToAll({ cat: 'urssaf', title: n.titre, body: n.corps, tag: 'urssaf-' + mois, url: n.url });
          }
          urssaf = !n.envoyer ? n.raison : res.reserve ? 'envoyé · ' + n.raison : res.raison === 'deja' ? 'déjà rappelé ce mois' : 'mémo illisible — rien';
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
            const res = await reserverDedup('urssaf_reminder_dedup', (d) => !!d && d.veille === n.cle, (d) => ({ ...(d || {}), veille: n.cle }));
            if (res.reserve) await sendPushToAll({ cat: 'urssaf', title: n.titre, body: n.corps, tag: 'urssaf-veille-' + n.cle, url: n.url });
            urssaf = res.reserve ? 'envoyé · ' + n.raison : res.raison === 'deja' ? 'déjà rappelé avant l\'échéance' : 'mémo illisible — rien';
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

    // COMPTE VINTED PAS RELU (5 nov.) — posé comme les autres : un échec ici
    // n'empêche rien, et le calcul des colis continue.
    // (8 nov.) UN COMPTE QUI N'ARRIVE PLUS alors que l'extension travaille — avant
    // le rappel de 24 h, qui se tait pour les comptes qu'elle vient de nommer.
    let capture = null, enPanne = new Set();
    try { const r = await rappelPannesCapture(); capture = r.bilan; enPanne = r.uids; } catch (e) { capture = 'échec : ' + String((e && e.message) || e).slice(0, 120); }
    // (8 nov.) UN COMPTE RELIÉ POUR LA PREMIÈRE FOIS, app fermée partout : le filet
    // (l'app ouverte prévient tout de suite, api/push.js action `comptes`). Une fois par compte.
    let comptesRelies = null;
    try { const r = await notifierComptesRelies(); comptesRelies = { envoye: r.envoye, n: r.n, raison: r.raison }; } catch (e) { comptesRelies = 'échec : ' + String((e && e.message) || e).slice(0, 120); }
    // (11 nov., ext. 5.350) VINTED A MASQUÉ / FAIT DISPARAÎTRE / LIMITE, envoi de l'extension raté :
    // le filet (une fois par événement, la mémoire du serveur décide).
    let moderation = null;
    try { const r = await notifierModeration(); moderation = { envoye: r.envoye, n: r.n, raison: r.raison }; } catch (e) { moderation = 'échec : ' + String((e && e.message) || e).slice(0, 120); }
    // (11 nov., lot avis-negatif) UN AVIS ≤ SEUIL, extension sans réseau au moment de sa lecture : le filet.
    let avisBas = null;
    try { const r = await notifierAvisBas(); avisBas = { envoye: r.envoye, n: r.n, raison: r.raison }; } catch (e) { avisBas = 'échec : ' + String((e && e.message) || e).slice(0, 120); }
    let relecture = null;
    try { relecture = await rappelComptesARelire(Date.now(), enPanne); } catch (e) { relecture = 'échec : ' + String((e && e.message) || e).slice(0, 120); }


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
    // (1er nov., audit A4) Les ventes Vestiaire : leur date limite, la règle de Colis.
    const vcR = t ? t.vestiaire : resumeColisSites({ vc: d.vc }).vestiaire;
    const vcDus = vcR ? vcR.overdue + vcR.today + vcR.tomorrow : 0;
    if (vintedSkip && !vcDus && (!eb || (!(eb.overdue + eb.today + eb.tomorrow) && !eb.nePasPoster))) return { urssaf, bilan, retrait, offremini, relecture, capture, comptesRelies, moderation, avisBas, skipped: vintedSkip + ' — aucune notification envoyée' };

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
    if (vcR) { overdue += vcR.overdue; dueToday += vcR.today; dueTomorrow += vcR.tomorrow; }
    const total = overdue + aVerifier + dueToday + dueTomorrow;
    const nePasPoster = eb ? eb.nePasPoster : 0;

    // Anti-doublon : une seule notification par jour pour un même total.
    const dedupLu = await getRow('ship_reminder_dedup');
    // (11 nov., M81) un mémo illisible n'est pas « jamais notifié » : rien ne part.
    if (dedupLu === undefined) return { urssaf, bilan, retrait, offremini, relecture, capture, comptesRelies, moderation, avisBas, skipped: 'mémo illisible — rien', total };
    const memeJour = (d) => !!d && d.date === today && d.total === total && (d.nePasPoster || 0) === nePasPoster;
    if (memeJour(dedupLu)) return { urssaf, bilan, retrait, offremini, relecture, capture, comptesRelies, moderation, avisBas, skipped: 'déjà notifié', total };

    if ((total > 0 || nePasPoster > 0) && await pushCategorieActive('expedier')) {
      // (11 nov., B130) réservé AVANT l'envoi : deux passages ⇒ une seule notification.
      const res = await reserverDedup('ship_reminder_dedup', memeJour, () => ({ date: today, total, nePasPoster }));
      if (!res.reserve) return { urssaf, bilan, retrait, offremini, relecture, capture, comptesRelies, moderation, avisBas, skipped: res.raison === 'deja' ? 'déjà notifié' : 'mémo illisible — rien', total };
      const txt = texteMatin({ overdue, aVerifier, dueToday, dueTomorrow, ebayDus, vestiaireDus: vcDus, nePasPoster, vinted: c });
      // (11 nov.) Des colis dus aujourd'hui (ou en retard) : urgent — il passe un jour calme.
      await sendPushToAll({ cat: 'expedier', ...txt, tag: 'ship-reminder', url: DESTINATIONS.colis({}), ...(overdue + dueToday > 0 ? { urgent: true } : {}) });
    } else await ecrireDedup('ship_reminder_dedup', { date: today, total, nePasPoster });
    return { urssaf, bilan, retrait, offremini, relecture, capture, comptesRelies, moderation, avisBas, overdue, aVerifier, dueToday, dueTomorrow, total,
      ...(c ? { heures: { aujourdhui: c.premier.aujourdhui ? c.premier.aujourdhui.heure : null, demain: c.premier.demain ? c.premier.demain.heure : null }, estimees: c.estimees, sansLimite: c.sansLimite } : {}),
      ebay: eb ? { aPoster: eb.total, dus: ebayDus, nePasPoster } : null, vestiaire: vcR ? { aPoster: vcR.total, dus: vcDus } : null, ...(vintedSkip ? { vintedSkip } : {}) };
}

// Le texte du matin : une fonction pure (le banc la juge par la sortie de la
// route). L'HEURE limite est écrite quand l'email la donne (« 1 demain avant
// 10 h ») ; une date ESTIMÉE (pas de bordereau reçu) est dite estimée. Rien
// sur ce que fait Vinted après l'heure : on ne l'a pas mesuré.
// « du retard ! » ne part QUE sur une limite LUE et dépassée (`overdue`) ; une
// date ESTIMÉE dépassée est « à vérifier sur Vinted » (`aVerifier`), jamais un
// retard (revue du 22 octobre).
export function texteMatin({ overdue, aVerifier = 0, dueToday, dueTomorrow, ebayDus = 0, vestiaireDus = 0, nePasPoster = 0, vinted = null }) {
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
  // (1er nov.) Vestiaire : son bordereau se prend sur Vestiaire — dit dans le « dont ».
  const dont = [ebayDus ? `${ebayDus} eBay` : '', vestiaireDus ? `${vestiaireDus} Vestiaire` : ''].filter(Boolean);
  const quoi = !dont.length ? `${total} colis à envoyer`
    : ebayDus === total ? `${total} colis eBay à envoyer`
    : vestiaireDus === total ? `${total} colis Vestiaire à envoyer`
    : `${total} colis à envoyer, dont ${dont.join(' et ')}`;
  const corps = total > 0 ? `${quoi} (${parts.join(' · ')}).` : '';
  // La date estimée : dite pour celles d'aujourd'hui et de demain, et pour
  // celles « à vérifier » (une phrase, §7 : leur part le dit déjà « estimée »).
  const est = vinted && vinted.estimees ? vinted.estimees.estimeeDepassee + vinted.estimees.aujourdhui + vinted.estimees.demain : 0;
  const estime = est ? ` Date estimée pour ${est} (vente + 7 j : bordereau pas reçu par email ; la vraie limite peut tomber jusqu'à 3 j plus tard).` : '';
  const stop = nePasPoster ? ` ${nePasPoster > 1 ? `${nePasPoster} acheteurs eBay ont` : 'Un acheteur eBay a'} demandé l'annulation : ne poste pas ${nePasPoster > 1 ? 'ces colis' : 'ce colis'}.` : '';
  return {
    title: nePasPoster && !total ? 'Commande eBay : ne poste pas' : overdue ? 'Colis en retard à expédier' : 'Colis à expédier',   // (8 nov.) le retard DANS le titre, sans emoji
    body: (corps + estime + stop).trim() + (ebayDus || vestiaireDus || nePasPoster ? " Ouvre l'app pour les voir." : " Ouvre l'app pour les préparer."),
  };
}

// ── LES DONNÉES DES COLIS — LE MATIN ET LE SOIR LISENT LA MÊME CHOSE ────────
// La liste « à expédier » (`txsAExpedier`) et la date limite de chaque vente
// (`limiteExpedition`, api/_lib/limite-envoi.js) : comptes, réglages (`main`
// projeté, §4.4), ventes moissonnées (liste + résumé), commandes eBay, et les
// bordereaux reçus par email (leur date limite, AVEC l'heure). Chaque source
// vaut `null` quand sa lecture a échoué (« rien lu » ne vaut pas « rien »).
const MAIN_COLIS = ['vinted_ship_done', 'vinted_bords_shipped', 'vinted_bords_hidden', 'vrm_lbc_colis_done', 'vrm_vc_colis_done', 'vrm_vc_numeros', 'vrm_vc_liens', 'vinted_accounts_hidden'];
// (9 nov.) Les bordereaux + ce qui a été RELU dans le texte de l'e-mail des anciens
// (transporteur, n° Mondial Relay — api/_lib/transporteur-anciens.js), seulement là où
// le bordereau n'a rien : la même fusion que le widget et l'app. Ligne illisible ⇒ rien fusionné.
async function lireBordsAvecRelus(select) {
  const [b, relus] = await Promise.all([
    fetchPaginated(scoped(`app_data?id=like.email_bord_*&select=${select}`)),
    fetchPaginated(scoped(REQ_RELUS)).catch(() => null),
  ]);
  return avecRelus(b, relus);
}
const BORD_COLIS = 'dateLimite:data->>dateLimite,transaction:data->>transaction,suivi:data->>suivi,numero:data->>numero,receivedAt:data->>receivedAt,filename:data->>filename';
// (9 nov., charge — scripts/charge/) LES LISTES DE VENTES SEULEMENT QUAND ELLES SERVENT.
// Le matin et le soir lisaient la liste ENTIÈRE de chaque compte (≈ 100 Ko par
// compte, ~2 Mo par vendeur et par jour au banc) pour trois usages : le résumé
// « à expédier » (posé par l'extension DANS la ligne), la date des ventes à
// expédier (limite estimée) et les n° connus (ventes vues par e-mail). On lit
// d'abord le résumé seul (`txns`, `dates`, `capturedAt`) ; la liste entière n'est
// relue QUE si un compte lié n'a pas de résumé (extension d'avant), si une vente
// vue par e-mail est à juger (tous les comptes, exactement comme avant), ou pour
// les comptes d'une vente à expédier sans date. Le résultat est le même qu'avec
// les listes entières (scripts/audit-charge-rappels.cjs le compare).
const SEL_RESUME_VENTES = 'id,txns:data->resume->txns,dates:data->resume->dates,cap:data->>capturedAt';
const SEL_LISTE_VENTES = 'id,orders:data->payload->my_orders,txns:data->resume->txns,cap:data->>capturedAt';
const uidLigneVentes = (id) => (String(id || '').match(/^harvest_(.+?)_orders_sold$/) || [])[1] || '';
async function lireVentesColis(comptesL, lireListes) {
  const resumes = await fetchPaginated(scoped(`app_data?id=like.harvest_%25_orders_sold&select=${SEL_RESUME_VENTES}`));
  if (!Array.isArray(resumes)) return null;
  const vivants = Array.isArray(comptesL) ? new Set(comptesL.map((c) => String((c && c.vinted_user_id) || '')).filter(Boolean)) : null;
  // Comptes liés pas sus, ou un compte lié sans résumé : la lecture d'avant.
  const sansResume = resumes.some((l) => { const u = uidLigneVentes(l && l.id); return u && (!vivants || !vivants.size || vivants.has(u)) && !Array.isArray(l.txns); });
  if (!vivants || !vivants.size || sansResume) return { lignes: await lireListes(), entieres: true };
  return { lignes: resumes.map((l) => ({ id: l.id, orders: null, txns: l.txns, cap: l.cap, dates: l.dates })), entieres: false };
}
// Complète `d` (lu par résumé) avec les listes entières là où elles servent.
// Rend `d` (inchangé quand rien ne manque) ; une relecture ratée rend `null`
// pour les commandes (« pas su », comme une lecture ratée d'avant).
async function completerVentesColis(d, lireListes) {
  if (!d || !d.commandes || d.listesEntieres) return d;
  const mettre = (lignes) => {
    if (!Array.isArray(lignes)) { d.commandes = null; return; }
    for (const l of lignes) { const u = uidLigneVentes(l && l.id); if (u && d.commandes[u]) d.commandes[u].orders = Array.isArray(l.orders) ? l.orders : []; }
  };
  // 1. Une vente vue par e-mail se juge sur les n° de TOUTES les listes : si le
  //    résumé seul en laisse une à juger, toutes les listes sont relues (comme avant).
  const avecResume = ventesEmailColis(d);
  if (avecResume.txs.length) { mettre(await lireListes()); d.listesEntieres = true; return d; }
  // 2. La date des ventes à expédier sans date dans le résumé : leurs seuls comptes.
  const t = txsAExpedier(d);
  if (!t) return d;
  const manque = new Set();
  for (const tx of t.vinted) {
    let date = null, uid = null;
    for (const [u, l] of Object.entries(d.commandes)) {
      if (!Array.isArray(l.txns) || !l.txns.map(String).includes(String(tx))) continue;
      uid = uid || u;
      const dl = l.dates && typeof l.dates === 'object' && !Array.isArray(l.dates) ? l.dates[String(tx)] : null;
      if (typeof dl === 'string' && Number.isFinite(Date.parse(dl))) { date = dl; break; }
    }
    if (!date && uid) manque.add(uid);
  }
  if (!manque.size) return d;
  const ids = [...manque].map((u) => encodeURIComponent(`harvest_${u}_orders_sold`)).join(',');
  mettre(await fetchPaginated(scoped(`app_data?id=in.(${ids})&select=${SEL_LISTE_VENTES}`)));
  return d;
}
async function lireDonneesColis() {
  const BORD = BORD_COLIS;
  const lireListes = () => fetchPaginated(scoped(`app_data?id=like.harvest_%25_orders_sold&select=${SEL_LISTE_VENTES}`));
  const comptesP = fetchPaginated(scoped('vinted_accounts?select=vinted_user_id,login'));
  const [comptesL, m, ventes, ebay, bords, lbcL, vcV, vcL, dep, mailsVentes, panneau] = await Promise.all([
    comptesP,
    getRowProjete('main', MAIN_COLIS),
    comptesP.then((c) => lireVentesColis(c, lireListes)),
    lireCommandesEbay(),
    lireBordsAvecRelus(BORD),
    // (1er nov., audit A4) Les colis Leboncoin et Vestiaire : leurs seules ventes (§4.4).
    getRowProjete('lbc_ventes', ['ventes']),
    getRowProjete('vc_ventes', ['ventes']),
    getRowProjete('vc_listings', ['liens']),
    // (8 nov.) Les départs prouvés chez le transporteur (api/_lib/depart-colis.js).
    fetchPaginated(scoped(`app_data?id=like.depart_*&select=${SELECT_DEPART_META}`)),
    // (8 nov.) Les ventes vues par e-mail (scalaires `meta->>`) et le choix « hors des totaux » du panneau.
    fetchPaginated(scoped(reqVentesEmail(Date.now()))),
    getRow('panel_accounts_off'),
  ]);
  const departs = Array.isArray(dep) ? departsParSuivi(dep) : null;
  // (8 nov., « à envoyer » prouvé) Les preuves de départ de la règle de Colis (api/_lib/depart-vente.js).
  const preuves = await lirePreuvesDepart((p) => fetchPaginated(scoped(p)), (x) => avecSuiviDuSujet(relireLigneMeta(x)));
  const comptes = Array.isArray(comptesL) ? comptesL.map((c) => ({ uid: String((c && c.vinted_user_id) || '') })).filter((c) => c.uid) : null;
  const lignes = ventes ? ventes.lignes : null;
  let commandes = null;
  if (Array.isArray(lignes)) {
    commandes = {};
    for (const l of lignes) {
      const um = String((l && l.id) || '').match(/^harvest_(.+?)_orders_sold$/);
      if (um) commandes[um[1]] = { orders: Array.isArray(l.orders) ? l.orders : [], txns: Array.isArray(l.txns) ? l.txns : null, cap: l.cap || null, ...(l.dates !== undefined ? { dates: l.dates } : {}) };
    }
  }
  return completerVentesColis({ comptes, commandes, listesEntieres: !ventes || ventes.entieres, main: m === undefined ? null : objet(m), ebay, bords, departs, preuves,
    mailsVentes: Array.isArray(mailsVentes) ? mailsVentes : null, panneau: panneau === undefined ? null : objet(panneau),
    lbcVentes: lbcL === undefined ? null : (objet(lbcL && lbcL.ventes) || {}),
    vc: (vcV === undefined || vcL === undefined) ? null : { ventes: (vcV && vcV.ventes) || null, liens: (vcL && vcL.liens) || {}, auto: numerosVcAvecLiens((objet(m) && objet(m).vrm_vc_numeros) || {}, objet(m) && objet(m).vrm_vc_liens), fait: (objet(m) && objet(m).vrm_vc_colis_done) || {}, departs } }, lireListes);
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
  // (9 nov., charge) Liste pas relue : la date posée dans le résumé, par n° (même commande).
  for (const [uid, l] of Object.entries(d.commandes)) {
    if (vivants.size && !vivants.has(uid)) continue;
    const dl = l.dates && typeof l.dates === 'object' && !Array.isArray(l.dates) ? l.dates : null;
    if (!dl || !Array.isArray(l.txns)) continue;
    for (const t of l.txns) { const k = String(t); if (!out[k] && typeof dl[k] === 'string' && Number.isFinite(Date.parse(dl[k]))) out[k] = { transaction_id: k, date: dl[k] }; }
  }
  // (8 nov.) La vente vue par e-mail : sa date (l'arrivée de l'e-mail), comme dans l'app.
  for (const [t, o] of Object.entries(ventesEmailColis(d).ventes)) if (!out[t]) out[t] = o;
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
// ── devenu LE RÉSUMÉ DU SOIR (10 nov., lot AT : api/_lib/resume-soir.js) ─────
// Second cron (vercel.json, 18:00 UTC = 20 h à Paris l'été, 19 h l'hiver — le
// plan Hobby décale d'au plus une heure), MÊME route (`?moment=soir`, plafond de
// 12 fonctions), même garde CRON_SECRET, même catégorie `soir`, même mémo : UNE
// notification par soir. Elle ne dit plus « N colis à poster » mais ce qu'il y a
// à faire DEMAIN : colis dont la date limite LUE tombe demain (et ceux déjà en
// retard, les dates estimées passées), colis à retirer dont le dernier jour lu
// est demain, offres Vestiaire reçues qui expirent avant demain soir. Rien de
// tout ça ⇒ rien ne sonne. Les colis viennent de la règle du widget et du bilan
// (`txsAExpedier`, §11) et des dates limites de `compterEcheances` (l'heure lue
// dans l'e-mail, 22 octobre) ; `n` (le total à poster) reste dans la réponse du
// cron. Rien ne part : ventes Vinted illisibles (pas su), préférence « soir »
// coupée, déjà parti ce jour-là (mémo `soir_reminder_dedup` écrit AVANT l'envoi
// et confirmé). eBay (etc.) illisible ⇒ « au moins », nommé. Un retrait ou une
// offre pas lus ne sont pas dits (et le cron le rapporte).
// Le texte : `texteSoir`, fabriqué dans api/_lib/notif-apercus.js (l'aperçu de
// Paramètres → Notifications l'appelle aussi) — réexporté ici.
export { texteSoir };
// (11 nov., décision C8) `horaire` : le passage HORAIRE (GitHub, `passage=heure`) ne sert que
// les vendeurs qui ont CHOISI une heure ; le cron de Vercel sert les autres, comme avant. Les
// deux attendent que l'heure de Paris ait atteint la sienne (`soirALHeure`) ; le mémo du jour
// fait qu'un seul part. Préférences pas lues : le passage horaire ne fait rien, le cron d'avant
// garde son défaut (on ne devine pas une heure choisie).
async function rappelDuSoir(maintenant = Date.now(), { horaire = false } = {}) {
  const today = parisDate(0);
  const deja = await getRow('soir_reminder_dedup');
  if (deja === undefined) return { soir: 'mémo illisible — rien envoyé' };
  if (deja && deja.date === today) return { soir: 'déjà envoyé' };
  const prefsSoir = await prefsDuVendeur();
  if (horaire && !prefsSoir) return { soir: 'préférences pas lues — rien envoyé' };
  if (horaire && reglageSoir(prefsSoir).heure == null) return { soir: 'heure par défaut — le cron du soir' };
  if (!soirALHeure(prefsSoir || {}, maintenant)) return { soir: `pas encore son heure (${reglageSoir(prefsSoir).heure} h)` };
  if (!(await pushCategorieActive('soir'))) return { soir: 'désactivé par le vendeur' };
  const d = await lireDonneesColis();
  const t = txsAExpedier(d);
  if (!t) return { soir: 'lecture ratée — rien envoyé' };
  // (1er nov., audit A4) + Leboncoin et Vestiaire : le nombre de Colis (§11).
  const manque = colisManque(t);
  const n = t.vinted.size + (t.ebay ? t.ebay.total : 0) + (t.leboncoin ? t.leboncoin.total : 0) + (t.vestiaire ? t.vestiaire.total : 0);
  // Les échéances : seulement CES ventes. Demain, une limite d'aujourd'hui (ou
  // d'avant) est déjà passée : « en retard ». ⚠️ (revue du 22 oct.) Une limite
  // ESTIMÉE (vente + 7 j) passée demain n'est pas « en retard » : `aVerifier`.
  // (10 nov.) « Demain » = les limites LUES seulement (une estimée n'est qu'un
  // plancher) ; l'heure = la plus proche des lues. Bordereaux illisibles ⇒ les
  // dates Vinted ne sont pas sues : Vinted nommé (« au moins »).
  let retard = 0, aVerifier = 0, demain = 0, heureDemain = null;
  const manqueDates = [...manque];
  if (Array.isArray(d.bords)) {
    const c = compterEcheances({ txs: [...t.vinted], ventes: ventesParTx(d), bords: bordsDuVendeur(d), maintenant });
    retard = c.retard + (c.aujourdhui - c.estimees.aujourdhui);
    aVerifier = c.estimeeDepassee + c.estimees.aujourdhui;
    demain = c.demain - c.estimees.demain;
    heureDemain = c.premierLu.demain ? c.premierLu.demain.heure : null;
  } else if (t.vinted.size) manqueDates.unshift('Vinted');
  if (t.ebay) { retard += t.ebay.overdue + t.ebay.today; demain += t.ebay.tomorrow; }
  if (t.vestiaire) { retard += t.vestiaire.overdue + t.vestiaire.today; demain += t.vestiaire.tomorrow; }
  const colis = { demain, retard, aVerifier, manque: manqueDates,
    heure: (t.ebay && t.ebay.tomorrow) || (t.vestiaire && t.vestiaire.tomorrow) ? null : heureDemain };
  // Les colis à retirer dont le dernier jour (lu) est DEMAIN : la règle du matin, un jour plus loin.
  let retraits = null;
  try {
    const rr = await retraitsDuJour(maintenant, 1);
    if (typeof rr !== 'string') retraits = rr.liste.filter((x) => x.etat === 'demain').map((x) => ({ suivi: x.suivi, lieu: x.lieu, tx: txUniqueDe(rr.txsPar, x.suivi) }));
  } catch (_) { retraits = null; }
  // Les offres Vestiaire reçues qui expirent avant demain soir (projetées, jamais `select=data`).
  let offres = null;
  try {
    const [ligne, regle] = await Promise.all([getRowProjete('vc_offres', ['offres', 'capturedAt']), regleDuVendeur(proprietaireCourant()).catch(() => null)]);
    offres = offresVcDemain(ligne, { maintenant, demain: parisDate(1), horsPlan: (cpt) => venteAutreHorsPlan(regle, 'vestiaire', cpt) });
  } catch (_) { offres = null; }
  const r = resumeDuSoir({ colis, retraits, offres });
  const bilan = { n, retard, aVerifier, demain, auMoins: manqueDates.length > 0, manque: manqueDates,
    retraits: retraits === null ? 'pas su' : retraits.length, offres: offres === null ? 'pas su' : offres.length };
  if (!r.envoyer) return { soir: r.raison, ...bilan };
  if (!(await ecrireDedup('soir_reminder_dedup', { date: today, n, compte: r.compte }))) return { soir: 'mémo non écrit — rien envoyé' };
  const envoi = await sendPushToAll({ cat: 'soir', title: r.title, body: r.body, tag: 'soir-' + today, url: r.url });
  return { soir: 'envoyé', ...bilan, envoi: envoi && (envoi.coupe || envoi.erreur || envoi.sent) };
}
// (5 nov.) `?moment=reveil` : à la fin de ses heures calmes, UNE notification
// dit ce qui est arrivé pendant (api/_lib/reveil-calme.js). Rien d'autre.
// Le mémo du jour est écrit AVANT l'envoi (un envoi raté ne part pas deux fois) ;
// mémo pas écrit ⇒ rien ne part.
// (11 nov.) Le passage du réveil sert AUSSI les rappels posés par le vendeur (« Me le rappeler ») :
// ils sonnent à 9 h (Paris), après les heures calmes. Un échec de l'un n'empêche pas l'autre.
async function traiterVendeurReveil(maintenant = instantNotif()) {   // (11 nov.) l’horloge des notifications (bancs : simulée ; production : maintenant)
  let r;
  try { r = await recapReveil(maintenant); } catch (e) { r = { reveil: 'échec : ' + String((e && e.message) || e).slice(0, 120) }; }
  return { ...r, rappels: await rappelsPersoSur() };
}
// ── « ME LE RAPPELER » (11 nov., api/_lib/rappels-perso.js) ──────────────────
// Les rappels que le VENDEUR a posés lui-même (jamais proposés par VRM, §3) :
// `main` lu PROJETÉ sur `vrm_rappels` seulement (§4.4), le mémo `rappels_perso_dedup`
// lu en trois états (illisible ⇒ rien) et écrit AVANT l'envoi, confirmé (sinon
// rien ne part, et rien ne part deux fois). Famille « Rappels » coupée ⇒ rien.
// Heures calmes ⇒ on N'ENVOIE PAS et on n'écrit pas le mémo : le passage suivant
// (réveil toutes les 30 min le matin, puis le soir) le fera sonner à son heure.
// La réponse ne porte que des nombres : jamais une note, un N° ou un titre.
async function rappelsPersoSur() {
  try {
    const maintenant = instantNotif();
    const main = await getRowProjete('main', [CLE_RAPPELS]);
    if (main === undefined) return { etat: 'pas-su' };
    const rappels = lireRappels(main && main[CLE_RAPPELS]);
    if (!rappels.some((r) => r.etat === 'actif')) return { etat: 'aucun' };
    const memo = await getRow(MEMO_RAPPELS);
    if (memo === undefined) return { etat: 'memo-illisible' };
    const envoyes = memo && memo.envoyes;
    const dus = rappelsDus(rappels, envoyes, maintenant);
    if (!dus.length) return { etat: 'rien-de-du' };
    if (!(await pushCategorieActive('rappel'))) return { etat: 'coupe', n: dus.length };
    const prefs = await prefsDuVendeur();
    if (dansHeuresCalmes(prefs || {}, 'rappel', instantCalme())) return { etat: 'heures-calmes', n: dus.length };
    if (!(await ecrireDedup(MEMO_RAPPELS, { envoyes: memoApres(envoyes, dus, maintenant), at: new Date(maintenant).toISOString() }))) return { etat: 'memo-non-ecrit', n: dus.length };
    let envoi;
    if (dus.length === 1) {
      const r = dus[0], t = texteRappel(r);
      envoi = await sendPushToAll({ cat: 'rappel', title: t.title, body: t.body, tag: TAG_RAPPEL(r.id), url: lienRappel(r, lienNotif) });
    } else {
      const t = texteRappels(dus);
      envoi = await sendPushToAll({ cat: 'rappel', title: t.title, body: t.body, tag: TAG_RAPPEL('jour-' + dus[0].jour), url: lienNotif('journee', { section: 'rappels' }) });
    }
    return { etat: 'envoye', n: dus.length, envoi: envoi && (envoi.coupe || envoi.erreur || envoi.sent) };
  } catch (e) { return { etat: 'echec' }; }
}
async function recapReveil(maintenant = instantNotif()) {
  const prefs = await prefsDuVendeur();
  // (8 nov.) Heures calmes allumées par défaut : seul un `actif: false` posé les éteint.
  // Préférences pas sues ⇒ rien (« pas su » n'envoie pas un récapitulatif inventé).
  if (!prefs) return { reveil: 'pas-su' };
  // (11 nov.) Des jours calmes posés suffisent (heures calmes éteintes ou non).
  const rj = reglageJours(prefs);
  if (!reglageCalme(prefs).actif && !rj.jours.length && !rj.conges) return { reveil: 'calme-eteint' };
  const memo = await getRow(ID_REVEIL);
  if (memo === undefined) return { reveil: 'pas-su' };
  const [journal, lu] = await Promise.all([lireJournal(), lireLu()]);
  const r = resumeReveil({ prefs, journal, lu, dejaJour: memo && memo.jour, dejaSeq: memo && Number.isSafeInteger(memo.seq) ? memo.seq : null, dejaAt: memo && memo.at, maintenant });
  if (!r.envoyer) return { reveil: r.raison };
  if (!(await ecrireDedup(ID_REVEIL, { jour: r.jour, n: r.n, at: new Date(maintenant).toISOString(), ...(Number.isSafeInteger(r.seq) ? { seq: r.seq } : {}) }))) return { reveil: 'memo-non-ecrit' };
  const envoi = await sendPushToAll({ title: r.title, body: r.body, url: r.url, tag: 'vrm-reveil' });
  return { reveil: 'envoye', n: r.n, sent: envoi && envoi.sent };
}
// (11 nov., lot `notifs-groupees`) LE PASSAGE DE 15 MIN. Seuls les vendeurs qui
// ont une fenêtre échue (`push_journal.data->>attenteJusqua` ≤ maintenant, une
// projection : aucun `select=data`). (L'heure du résumé du soir a son passage
// horaire, décision C8 : `traiterVendeurSoirHeure`.) Une
// lecture ratée ⇒ rien (503, on repassera). Un vendeur qui plante n'arrête pas
// les autres. Budget : 240 s.
async function passageGroupe(maintenant = Date.now()) {
  const debut = Date.now();
  const iso = new Date(maintenant).toISOString();
  const dus = await fetchPaginated(`app_data?id=eq.push_journal&data->>attenteJusqua=lte.${encodeURIComponent(iso)}&select=owner`);
  if (!dus) return { fait: false, raison: 'pas su' };
  const uniq = (l) => [...new Set(l.map((x) => x && x.owner && String(x.owner)).filter(Boolean))];
  const aVider = uniq(dus);
  let echecs = 0, envoyes = 0, budgetAtteint = false;
  const bilans = [];
  const tache = async (o, f) => { try { return await contexteVendeur.run({ owner: o }, f); } catch (e) { echecs += 1; return { erreur: String((e && e.message) || e).slice(0, 120) }; } };
  const files = aVider;
  for (let i = 0; i < files.length; i += VENDEURS_EN_PARALLELE) {
    if (Date.now() - debut > 240000) { budgetAtteint = true; break; }
    const lot = files.slice(i, i + VENDEURS_EN_PARALLELE);
    const out = await Promise.all(lot.map((o) => tache(o, () => vidangerResume())));
    out.forEach((r) => { if (r && r.vidange === 'envoye') envoyes += 1; bilans.push(r && typeof r === 'object' ? r : {}); });
  }
  return { fait: true, fenetres: aVider.length, resumes: envoyes, echecs, budgetAtteint, bilans: bilans.slice(0, 50) };
}
// (11 nov., lot lbc-plus) LES REMISES EN MAIN PROPRE (api/_lib/remises-main-propre.js) :
// UNE notification une heure avant le rendez-vous qu'IL a posé (jamais proposé par VRM).
// Seuls les vendeurs dont `main.data->>vrm_remise_fin` est à venir sont visités (une
// projection filtrée par la base, §4.4) ; `main` lu PROJETÉ sur `vrm_remises` seule ; le
// mémo `remises_rappel_dedup` lu en trois états (illisible ⇒ rien) et écrit AVANT l'envoi,
// confirmé (sinon rien ne part, et rien ne part deux fois). Famille « Rappels » coupée ⇒
// rien. L'échéance (l'heure du rendez-vous) accompagne la notification : la porte commune
// la laisse passer tout de suite (< 24 h), heures calmes selon sa règle. La réponse ne
// porte que des nombres : jamais un lieu, un N° ou un titre.
async function rappelsRemisesSur(maintenant = instantNotif()) {
  try {
    const main = await getRowProjete('main', [CLE_REMISES]);
    if (main === undefined) return { etat: 'pas-su' };
    const remises = lireRemises(main && main[CLE_REMISES]);
    if (!remises.some((r) => r.etat === 'prevue')) return { etat: 'aucune' };
    const memo = await getRow(MEMO_REMISES);
    if (memo === undefined) return { etat: 'memo-illisible' };
    const envoyes = memo && memo.envoyes;
    const dus = remisesDues(remises, envoyes, maintenant);
    if (!dus.length) return { etat: 'rien-de-du' };
    if (!(await pushCategorieActive('rappel'))) return { etat: 'coupe', n: dus.length };
    if (!(await ecrireDedup(MEMO_REMISES, { envoyes: memoRemisesApres(envoyes, dus, maintenant), at: new Date(maintenant).toISOString() }))) return { etat: 'memo-non-ecrit', n: dus.length };
    const t = dus.length === 1 ? texteRappelRemise(dus[0]) : texteRappelsRemise(dus);
    const premier = dus.slice().sort((a, b) => instantRemise(a.jour, a.heure) - instantRemise(b.jour, b.heure))[0];
    const envoi = await sendPushToAll({ cat: 'rappel', title: t.title, body: t.body, tag: TAG_REMISE(dus.length === 1 ? dus[0].id : 'lot-' + premier.id), cle: 'remise-' + dus.map((r) => r.id).sort().join('-'),
      echeance: instantRemise(premier.jour, premier.heure), url: lienNotif('ventes', { site: 'leboncoin', cible: 'vente', tx: premier.tx }) });
    return { etat: 'envoye', n: dus.length, envoi: envoi && (envoi.coupe || envoi.erreur || envoi.sent) };
  } catch (e) { return { etat: 'echec' }; }
}
async function passageRemises(maintenant = instantNotif()) {
  const debut = Date.now();
  const iso = new Date(maintenant).toISOString();
  const lignes = await fetchPaginated(`app_data?id=eq.main&data->>vrm_remise_fin=gte.${encodeURIComponent(iso)}&select=owner`);
  if (!lignes) return { fait: false, raison: 'pas su' };
  const owners = [...new Set(lignes.map((x) => x && x.owner && String(x.owner)).filter(Boolean))];
  let envoyees = 0, echecs = 0, budgetAtteint = false;
  for (let i = 0; i < owners.length; i += VENDEURS_EN_PARALLELE) {
    if (Date.now() - debut > 120000) { budgetAtteint = true; break; }
    const out = await Promise.all(owners.slice(i, i + VENDEURS_EN_PARALLELE).map((o) => contexteVendeur.run({ owner: o }, () => rappelsRemisesSur(maintenant)).catch(() => ({ etat: 'echec' }))));
    out.forEach((r) => { if (r && r.etat === 'envoye') envoyees += 1; if (r && r.etat === 'echec') echecs += 1; });
  }
  return { fait: true, vendeurs: owners.length, envoyees, echecs, budgetAtteint };
}
// (11 nov., décision C8) Le passage horaire : le résumé seul (ni eBay relu, ni bilan de la semaine).
async function traiterVendeurSoirHeure() {
  const out = await rappelDuSoir(Date.now(), { horaire: true });
  return { ...out, rappels: await rappelsPersoSur() };
}
async function traiterVendeurSoir() {
  // Le soir : lire et notifier les changements, puis le rappel du soir.
  const [relu, transp] = await Promise.all([relireEbayDuVendeur(), lireTransporteursDuVendeur()]);
  const out = await rappelDuSoir();
  const rappels = await rappelsPersoSur();
  // Le bilan de la semaine part le DIMANCHE SOIR (26 oct.) — même dédoublonnage
  // que le lundi matin (un seul bilan par semaine). Un échec du bilan n'empêche
  // jamais le rappel d'expédition du soir.
  let bilan = null;
  try { bilan = await bilanDeLaSemaine(Date.now(), true); } catch (e) { bilan = 'échec : ' + String((e && e.message) || e).slice(0, 120); }
  return { ...out, rappels, bilan, ebayRelu: resumeRelecture(relu), transporteurs: transp };
}

// ── LA VEILLE DES PLANTAGES (6 nov., filet 4) ─────────────────────────────────
// Une lecture PROJETÉE (jamais `select=data`, §4.4), filtrée par la base sur la
// date copiée dans `meta` (migration 004), paginée ; TOUS les vendeurs (un écran
// mort chez un autre vendeur doit se voir). Le mémo et la notification : au nom
// du PROPRIÉTAIRE de l'installation (VRM_OWNER_UID), jamais d'un vendeur.
const SELECT_VEILLE = 'owner,id,message:data->>message,ecran:data->>ecran,navigateur:data->>navigateur,version:data->>version,origine:data->>origine,at:data->>at';
async function veilleDesPlantages(maintenant = Date.now()) {
  const proprietaire = process.env.VRM_OWNER_UID || '';
  return contexteVendeur.run({ owner: proprietaire }, () => passageVeillePlantages({
    proprietaire, maintenant,
    lireMemo: () => getRow(ID_MEMO_VEILLE),
    lireLignes: (depuisIso) => fetchPaginated(`app_data?id=like.plantage_*&meta->>at=gte.${encodeURIComponent(depuisIso)}&select=${SELECT_VEILLE}`),
    ecrireMemo: (memo) => ecrireDedup(ID_MEMO_VEILLE, memo),
    // (8 nov.) Au propriétaire seul ; une catégorie (`signalement`) : rangée dans sa
    // cloche et soumise à ses heures calmes (la veille tourne vers 6 h — elle attend 8 h).
    envoyer: (notif) => sendPushToAll({ ...notif, cat: 'signalement' }),
  }));
}

// (6 nov., v36) LA VEILLE DES LENTEURS : les deux derniers jours d'agrégats du
// PROPRIÉTAIRE (deux jours, éclats compris, `h` seul projeté), un p75 qui se dégrade de
// plus de 30 % ⇒ une notification à lui (api/_lib/veille-plantages.js).
async function veilleDesLenteurs(maintenant = Date.now()) {
  const proprietaire = process.env.VRM_OWNER_UID || '';
  return contexteVendeur.run({ owner: proprietaire }, () => passageVeilleLenteurs({
    proprietaire, maintenant,
    lireMemo: () => getRow(ID_MEMO_LENTEURS),
    // (7 nov.) Les éclats du jour additionnés (et l'ancienne ligne d'avant les éclats).
    lireJours: (jours) => histosDesJours({ lire: fetchPaginated, proprio: proprietaire, jours }),
    ecrireMemo: (memo) => ecrireDedup(ID_MEMO_LENTEURS, memo),
    // (8 nov.) Au propriétaire seul ; une catégorie (`signalement`) : rangée dans sa
    // cloche et soumise à ses heures calmes (la veille tourne vers 6 h — elle attend 8 h).
    envoyer: (notif) => sendPushToAll({ ...notif, cat: 'signalement' }),
  }));
}

// ── (9 nov.) LES SONDES DE vrm.center/statut (api/_lib/statut-sondes.js) ─────
// `?moment=sondes` (GitHub, toutes les 10 min : .github/workflows/sondes-statut.yml),
// et aussi au cron du matin et du soir. Une vraie connexion SMTP (aucun message)
// une fois par heure au plus. L'incident ouvert part au PROPRIÉTAIRE seul
// (VRM_OWNER_UID ou le propriétaire rangé en base), dans SON contexte.
// `_bancSondes.envoyer` : le banc compte les notifications sans service de push.
export const _bancSondes = { envoyer: null };
async function sondesStatut(maintenant = Date.now()) {
  const proprietaire = (await proprietaireInstallation()) || '';
  const cfg = configurationRelances();
  return passageSondes({
    maintenant, proprietaire, pushPret: pushConfigure(), configSmtp: cfg,
    smtp: () => envoyerSmtp({ seulementConnexion: true, hote: process.env.RELANCES_SMTP_HOTE, port: cfg.port, utilisateur: process.env.RELANCES_SMTP_UTILISATEUR, motDePasse: process.env.RELANCES_SMTP_MOT_DE_PASSE, de: process.env.RELANCES_EXPEDITEUR, a: process.env.RELANCES_EXPEDITEUR }),
    envoyer: (notif) => (_bancSondes.envoyer ? _bancSondes.envoyer(notif, proprietaire) : contexteVendeur.run({ owner: proprietaire }, () => sendPushToAll({ ...notif, cat: 'signalement' }))),
    // (11 nov.) Les incidents et les sondes muettes passent par le journal des alertes
    // de production ; à chaque passage, ce qui attendait la fin de l'heure part aussi.
    alerter: (signaux) => alerterProduction(proprietaire, { signaux }),
  });
}
// (11 nov.) Le journal des alertes de production (api/_lib/alertes-production.js),
// au PROPRIÉTAIRE seul. `_bancSondes.envoyer` : le banc compte sans service de push.
function alerterProduction(proprietaire, groupe) {
  if (!proprietaire) return Promise.resolve({ fait: false, raison: 'VRM_OWNER_UID absent : personne à prévenir' });
  return groupeProduction({ proprio: proprietaire, groupe,
    pousser: (notif) => (_bancSondes.envoyer ? _bancSondes.envoyer(notif, proprietaire) : contexteVendeur.run({ owner: proprietaire }, () => sendPushToAll(notif))) });
}
// Un passage `?moment=colis` : en panne (pas fait, ou un vendeur qui plante) ·
// transporteur refusé en série. 2 passages de suite ⇒ une alerte. Le journal ne
// gagne une écriture que si une série bouge.
async function alerterColis(r) {
  try {
    const proprietaire = (await proprietaireInstallation()) || '';
    const panne = !(r && r.fait) || Number(r.echecs) > 0;
    const refus = r && r.fait ? refusEnSerie(r.bilans) : null;
    return await alerterProduction(proprietaire, { vidange: false, suites: [
      { cle: 'colis:passage', echec: panne, seuil: ECHECS_COLIS, signal: SIGNAUX_PROD.colisPassage },
      { cle: 'colis:transporteur', echec: refus, seuil: ECHECS_COLIS, signal: SIGNAUX_PROD.colisTransporteur },
    ] });
  } catch (e) { return { fait: false, erreur: String((e && e.message) || e).slice(0, 120) }; }
}

// ── LES LIGNES DU PROPRIÉTAIRE NEUTRE (le curseur du cron) ─────────────────
// Trois états : objet · `null` (absente) · `undefined` (pas su).
async function lireNeutre(id) {
  try {
    const r = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/app_data?owner=eq.${PROPRIETAIRE_NEUTRE}&id=eq.${encodeURIComponent(id)}&select=data&limit=1`, { headers: HEADERS });
    if (!r.ok) return undefined;
    const j = await r.json();
    if (!Array.isArray(j)) return undefined;
    return (j[0] && j[0].data) || null;
  } catch (_) { return undefined; }
}
async function ecrireNeutre(id, data) {
  try {
    const r = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=owner,id`, {
      method: 'POST',
      headers: { ...HEADERS, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ owner: PROPRIETAIRE_NEUTRE, id, data, updated_at: new Date().toISOString() }]),
    });
    return !!(r && r.ok);
  } catch (_) { return false; }
}
async function retirerNeutre(id) {
  try {
    const r = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/app_data?owner=eq.${PROPRIETAIRE_NEUTRE}&id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: { ...HEADERS, Prefer: 'return=minimal' } });
    return !!(r && r.ok);
  } catch (_) { return false; }
}

export default async function handler(req, res) {
  // CRON_SECRET est obligatoire : un endpoint public ne doit pas déclencher des envois.
  // (Vercel envoie « Authorization: Bearer <CRON_SECRET> » sur les crons).
  const secret = process.env.CRON_SECRET;
  res.setHeader?.('Cache-Control','no-store');
  if (!secret) { res.status(503).json({ok:false,error:'cron-non-configure'});return; }
  const auth = String(req.headers?.authorization || '');
  // (9 nov., revue sécurité) Comparée en temps constant, comme la clé du script
  // Gmail (email-inbound) : une comparaison qui s'arrête au premier écart.
  const empreinte = (t) => crypto.createHash('sha256').update(String(t)).digest();
  if (!crypto.timingSafeEqual(empreinte(auth), empreinte(`Bearer ${secret}`))) { res.status(401).json({error:'clé invalide'});return; }
  // (7 nov.) Sans clé de service, la clé publique ne voit rien sous RLS : 503 dit, jamais « rien à faire ».
  if (repondreSansCleService(res)) return;


  // `?moment=soir` : le rappel de la veille au soir (second cron), rien d'autre
  // (ni URSSAF, ni bilan, ni rappel du matin).
  const moment = String((req.query && req.query.moment) || '');
  // (9 nov.) `?moment=sondes` : les sondes de /statut, RIEN d'autre (aucun vendeur).
  // État pas lu ou pas écrit ⇒ 503 (le workflow GitHub échoue : GitHub prévient).
  if (moment === 'sondes') {
    let s = null;
    try { s = await sondesStatut(); } catch (e) { s = { fait: false, erreur: String((e && e.message) || e).slice(0, 200) }; }
    res.status(s && s.fait ? 200 : 503).json({ ok: !!(s && s.fait), moment: 'sondes', sondes: s });
    return;
  }
  // (11 nov., H14) UN SEUL PASSAGE À LA FOIS par moment (api/_lib/cron-lots.js `prendreBail`) :
  // un second appel simultané (cron Vercel + GitHub, rejeu) ne fait rien et le dit (200).
  // Bail pas su (base muette) ⇒ le passage se fait comme avant, la réponse le dit.
  const momentBail = moment === 'soir' && String((req.query && req.query.passage) || '') === 'heure' ? 'soir_heure' : (moment || 'matin');
  const jetonBail = crypto.randomUUID();
  const bail = await prendreBail({ moment: momentBail, jeton: jetonBail, modifier: modifierNeutre, maintenant: Date.now() });
  if (bail.pris === false) { res.status(200).json({ ok: true, moment: momentBail, saute: 'passage-en-cours', jusqua: new Date(bail.jusqua).toISOString() }); return; }
  try { await passageDuCron(req, res, moment, bail.pris === true ? 'pris' : 'pas-su'); }
  finally { if (bail.pris === true) await rendreBail({ moment: momentBail, jeton: jetonBail, modifier: modifierNeutre, maintenant: Date.now() }); }
}

async function passageDuCron(req, res, moment, bailEtat) {
  // (9 nov., retraits frais) `?moment=colis` : le statut des colis ACTIFS chez le transporteur, et RIEN
  // d'autre (ni rappel, ni bilan, ni sonde) — GitHub toutes les 15 min (.github/workflows/colis-frais.yml).
  // Seuls les vendeurs qui ont une ligne due sont visités (api/_lib/colis-frequent.js) ; sélection pas
  // lue ⇒ 503, personne n'est visité.
  if (moment === 'colis') {
    let r = null;
    const debutColis = Date.now();
    let clOk = false;
    try {
      const cl = await cloisonnee();
      if (!cl) { const alerte = await alerterColis(null); res.status(503).json({ ok: false, moment: 'colis', raison: cl === null ? 'base injoignable' : 'cloisonnement-requis', alerte: alerte && { fait: !!alerte.fait, notifiees: alerte.notifiees || 0 } }); return; }
      clOk = true;
      r = await passageColisFrequent({
        lire: fetchPaginated, exclus: [PROPRIETAIRE_NEUTRE], maintenant: Date.now(),
        traiter: (o) => contexteVendeur.run({ owner: o }, () => lireTransporteursDuVendeur({ max: MAX_LECTURES_VENDEUR, maxDeparts: MAX_DEPARTS_VENDEUR, budgetMs: BUDGET_VENDEUR_MS })),
      });
    } catch (e) { r = { fait: false, erreur: String((e && e.message) || e).slice(0, 200) }; }
    // (9 nov. au soir, « transporteurs parfaits ») PUIS les étiquettes pas encore lues (api/_lib/colis-frequent.js
    // `passageEtiquettes`) : les vendeurs dont la ligne dit qu'il en reste, dans le temps qui reste au passage
    // (le job GitHub attend 150 s ; le passage des statuts en prend 100 au plus). Une panne ici ne change pas
    // le code de réponse des statuts : elle est dite dans `etiquettes`.
    let et = null;
    try {
      const temps = Math.min(BUDGET_ETIQUETTES_MS, 128000 - (Date.now() - debutColis));
      et = !clOk ? { fait: false, raison: 'pas-su' } : temps < 4000 ? { fait: true, dus: null, raison: 'plus-de-temps' } : await passageEtiquettes({
        lire: fetchPaginated, exclus: [PROPRIETAIRE_NEUTRE], maintenant: Date.now(), budgetMs: temps,
        traiter: (o, { budgetMs }) => contexteVendeur.run({ owner: o }, () => etiquettesCron({ max: MAX_PDF_VENDEUR_FREQUENT, budgetMs })),
      });
    } catch (e) { et = { fait: false, erreur: String((e && e.message) || e).slice(0, 200) }; }
    // Le bilan ne porte que des NOMBRES (aucun vendeur nommé, aucun n° de suivi) : il part dans le journal GitHub.
    const bilans = (r && r.bilans) || [];
    const alerte = await alerterColis(r);
    res.status(r && r.fait ? (r.echecs ? 500 : 200) : 503).json({ ok: !!(r && r.fait) && !r.echecs, moment: 'colis', alerte: alerte && { fait: !!alerte.fait, notifiees: alerte.notifiees || 0 }, dus: r && r.dus, traites: r && r.traites, restants: r && r.restants, echecs: r && r.echecs, budgetAtteint: r && r.budgetAtteint,
      lus: bilans.reduce((t, b) => t + (Number(b.lus) || 0), 0), changes: bilans.reduce((t, b) => t + (Number(b.changes) || 0), 0), ...(r && !r.fait ? { raison: r.raison || r.erreur || 'pas-su' } : {}),
      etiquettes: et && { fait: !!et.fait, dus: et.dus, traites: et.traites, lus: et.lus, ranges: et.ranges, vus: et.vus, restants: et.restants, echecs: et.echecs, budgetAtteint: et.budgetAtteint, ...(et.fait ? {} : { raison: et.raison || et.erreur || 'pas-su' }) } });
    return;
  }
  // (10 nov., lot Q) `?moment=factures` : l'envoi AUTOMATIQUE des factures Pro, et RIEN d'autre —
  // GitHub toutes les 30 min (.github/workflows/factures-auto.yml). Seuls les vendeurs qui l'ont
  // ALLUMÉ sont visités (api/_lib/factures-auto.js) ; sélection pas lue ⇒ 503, personne n'est visité.
  // La réponse ne porte que des NOMBRES.
  if (moment === 'factures') {
    let r = null;
    try {
      const cl = await cloisonnee();
      if (!cl) { res.status(503).json({ ok: false, moment: 'factures', raison: cl === null ? 'base injoignable' : 'cloisonnement-requis' }); return; }
      r = await passageFacturesAuto({ lire: fetchPaginated, exclus: [PROPRIETAIRE_NEUTRE], maintenant: Date.now(), budgetMs: 100000 });
    } catch (e) { r = { fait: false, raison: String((e && e.message) || e).slice(0, 200) }; }
    res.status(r && r.fait ? (r.echecs ? 500 : 200) : 503).json({ ok: !!(r && r.fait) && !r.echecs, moment: 'factures', vendeurs: r && r.vendeurs, traites: r && r.traites, envoyees: r && r.envoyees, refusees: r && r.refusees, pauses: r && r.pauses, echecs: r && r.echecs, budgetAtteint: r && r.budgetAtteint, ...(r && !r.fait ? { raison: r.raison || 'pas-su' } : {}) });
    return;
  }
  // (11 nov., lot `notifs-groupees`) `?moment=groupe` : toutes les 15 min
  // (.github/workflows/notifs-groupees.yml). Le résumé des fenêtres échues, et
  // le résumé du soir de ceux qui ont choisi leur heure. RIEN d'autre.
  if (moment === 'groupe') {
    let r = null;
    try {
      const cl = await cloisonnee();
      if (!cl) { res.status(503).json({ ok: false, moment: 'groupe', raison: cl === null ? 'base injoignable' : 'cloisonnement-requis' }); return; }
      r = await passageGroupe(instantNotif());
    } catch (e) { r = { fait: false, raison: String((e && e.message) || e).slice(0, 200) }; }
    // (11 nov., lot lbc-plus) Le même passage de 15 min sert le rappel « une heure avant »
    // des remises en main propre. Un échec de l'un n'empêche pas l'autre.
    let remises = null;
    try { remises = await passageRemises(instantNotif()); } catch (e) { remises = { fait: false, raison: String((e && e.message) || e).slice(0, 120) }; }
    res.status(r && r.fait ? (r.echecs ? 500 : 200) : 503).json({ ok: !!(r && r.fait) && !r.echecs, moment: 'groupe', ...r, remises });
    return;
  }
  // (11 nov., lot alertes-ebay) `?moment=alertes` : les ALERTES D'ACHAT eBAY, et RIEN d'autre —
  // GitHub chaque heure (.github/workflows/alertes-ebay.yml). Seuls les vendeurs qui ont allumé
  // l'alerte d'une recherche sont visités (api/_lib/ebay-alertes.js) ; sélection pas lue ⇒ 503.
  // La réponse ne porte que des NOMBRES (aucun vendeur, aucune annonce).
  if (moment === 'alertes') {
    let r = null;
    try {
      const cl = await cloisonnee();
      if (!cl) { res.status(503).json({ ok: false, moment: 'alertes', raison: cl === null ? 'base injoignable' : 'cloisonnement-requis' }); return; }
      r = await passageAlertesEbay({
        lire: fetchPaginated, lireDonnee: lireDonneeEbay, modifierDonnee: modifierDonneeEbay, jetonApplication, oublierJetonApplication,
        notifier: (o, nv) => contexteVendeur.run({ owner: o }, () => sendPushToAll(notifAlertes(nv))),
        exclus: [PROPRIETAIRE_NEUTRE], maintenant: Date.now(), budgetMs: 100000,
      });
    } catch (e) { r = { fait: false, raison: String((e && e.message) || e).slice(0, 200) }; }
    const { fait, ...nombres } = r || {};
    res.status(fait ? (r.echecs || r.panne ? 500 : 200) : 503).json({ ok: !!fait && !r.echecs && !r.panne, moment: 'alertes', ...nombres });
    return;
  }
  const soir = moment === 'soir';
  const reveil = moment === 'reveil';
  // (11 nov., décision C8) `?moment=soir&passage=heure` : le passage horaire du résumé du soir.
  const horaire = soir && String((req.query && req.query.passage) || '') === 'heure';
  const debutCron = Date.now();
  const traiter = reveil ? traiterVendeurReveil : horaire ? traiterVendeurSoirHeure : soir ? traiterVendeurSoir : traiterVendeur;
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

    // ── (7 nov., audit « 1 000 vendeurs ») LES TÂCHES GLOBALES D'ABORD ─────────
    //    Elles étaient APRÈS la boucle des vendeurs : un jour de grosse charge,
    //    la fonction était coupée avant elles et elles ne tournaient jamais. Le
    //    MATIN seulement ; chacune est bornée (les e-mails de l'essai ne
    //    COMMENCENT plus après `RELANCES_JUSQUA_MS`), et une panne de l'une ne
    //    fait échouer ni les autres ni les rappels (elle est dite dans la réponse).
    // (5 nov.) Les e-mails de l'essai gratuit (api/_lib/relances-essai.js). Sans
    // envoi configuré elle ne fait rien (et le dit dans la réponse).
    // (9 nov.) Les sondes de /statut, aussi au matin et au soir (si GitHub ne passe pas).
    let sondes = null;
    if (!reveil && !horaire) { try { sondes = await sondesStatut(debutCron); } catch (e) { sondes = { fait: false, erreur: String((e && e.message) || e).slice(0, 200) }; } }
    let relances = null;
    if (!soir && !reveil) { try { relances = await passageRelances({ jusqua: debutCron + RELANCES_JUSQUA_MS }); } catch (e) { relances = { erreur: String((e && e.message) || e).slice(0, 200) }; } }
    // (8 nov.) La part du plafond d'e-mails laissée au bilan du mois : 300 par jour
    // pour tout VRM (Brevo gratuit, `VRM_EMAILS_PAR_JOUR`), moins les e-mails de
    // l'essai déjà partis, 150 au plus (api/_lib/bilan-mois.js `partBilan`).
    const compteurBilan = { reste: !soir && !reveil ? partBilan({ dejaEnvoyes: relances && relances.envoyes }) : 0 };
    // (8 nov.) L'identité de l'éditeur au pied du bilan (public/legal/editeur.js), lue une fois.
    if (compteurBilan.reste > 0) { try { await lireMentions(); } catch (_) {} }
    // (6 nov., filet 4) La veille des plantages.
    let veille = null;
    if (!soir && !reveil) { try { veille = await veilleDesPlantages(debutCron); } catch (e) { veille = { fait: false, erreur: String((e && e.message) || e).slice(0, 200) }; } }
    // (8 nov.) Les alertes de plantage groupées encore en attente (api/_lib/alertes-plantages.js).
    let alertesPlantages = null;
    if (!soir && !reveil && process.env.VRM_OWNER_UID) {
      const proprio = String(process.env.VRM_OWNER_UID).trim().toLowerCase();
      try { alertesPlantages = await vidangerAlertesPlantages({ proprio, maintenant: debutCron, pousser: (n) => contexteVendeur.run({ owner: proprio }, () => sendPushToAll(n)) }); } catch (e) { alertesPlantages = { fait: false, erreur: String((e && e.message) || e).slice(0, 200) }; }
    }
    // (11 nov.) Les erreurs (plantages) gardées 30 jours au plus.
    let purgeErreurs = null;
    if (!soir && !reveil) { try { purgeErreurs = await purgerErreursAnciennes({ url: SUPABASE_URL, headers: HEADERS, proprio: await proprietaireInstallation(), maintenant: debutCron }); } catch (e) { purgeErreurs = { fait: false, erreur: String((e && e.message) || e).slice(0, 200) }; } }
    // (9 nov.) Un point par jour pour les courbes du tableau du propriétaire (api/_lib/pilotage.js).
    let pilotage = null;
    if (!soir && !reveil) { try { pilotage = await noterPilotageDuJour({ maintenant: debutCron }); } catch (e) { pilotage = { fait: false, erreur: String((e && e.message) || e).slice(0, 200) }; } }
    // (6 nov.) Le HTML d'origine des e-mails (30 jours) : une purge ratée ne fait
    // échouer rien (elle est dite dans la réponse).
    let purgeHtml = null;
    if (!soir && !reveil) purgeHtml = await purgerHtml({ url: SUPABASE_URL, headers: HEADERS, maintenant: debutCron });
    // (6 nov., v36) Les lenteurs.
    let lenteurs = null;
    if (!soir && !reveil) { try { lenteurs = await veilleDesLenteurs(debutCron); } catch (e) { lenteurs = { fait: false, erreur: String((e && e.message) || e).slice(0, 200) }; } }
    // (7 nov.) Les temps réels de plus de 90 jours (`mesures_jour_*` du propriétaire,
    // éclats compris) : lecture projetée, une lecture ratée ne supprime rien.
    let purgeMesures = null;
    if (!soir && !reveil) { try { purgeMesures = await purgerMesuresAnciennes({ url: SUPABASE_URL, headers: HEADERS, proprietaire: await proprietaireInstallation(), maintenant: debutCron }); } catch (e) { purgeMesures = { fait: false, erreur: String((e && e.message) || e).slice(0, 200) }; } }
    // (9 nov.) Les clients partis (api/_lib/clients-partis.js) : avis à 11 mois après
    // la fin de l'abonnement, suppression à 12 (la fonction de « Supprimer mon compte »),
    // bornés par passage ; une lecture ratée ne fait rien (dit dans la réponse).
    let clientsPartis = null;
    if (!soir && !reveil) { try { clientsPartis = await passageClientsPartis({ maintenant: debutCron }); } catch (e) { clientsPartis = { fait: false, erreur: String((e && e.message) || e).slice(0, 200) }; } }
    // (11 nov., lot agent2-veille) Le contrôle de nuit de l'INSTALLATION (lecture seule) : e-mails en
    // quarantaine sans vendeur, abonnements Stripe incohérents — rangé chez le propriétaire seul.
    let controleInst = null;
    if (!soir && !reveil) {
      try {
        controleInst = await controleInstallation({
          lire: fetchPaginated, proprio: await proprietaireInstallation(), maintenant: debutCron,
          stripe: { pret: stripePret, api: stripeApi },
          ecrire: (owner, id, data) => contexteVendeur.run({ owner }, () => ecrireDedup(id, data)),
        });
      } catch (e) { controleInst = { fait: false, erreur: String((e && e.message) || e).slice(0, 200) }; }
    }

    // ── LES VENDEURS, PAR LOTS (api/_lib/cron-lots.js) ─────────────────────────
    //    UNE passe PAR vendeur, chacun dans SON contexte (AsyncLocalStorage : deux
    //    vendeurs simultanés ne partagent ni filtre, ni mémo, ni appareils),
    //    VENDEURS_EN_PARALLELE à la fois — ce sont NOS lectures, pas des requêtes
    //    à Vinted (le garde-fou « une à la fois » du §3 n'est pas ici). Un vendeur
    //    qui plante n'arrête pas les autres (500 à la fin, visible).
    //    Un BUDGET de temps : passé, plus aucun vendeur ne commence et un CURSEUR
    //    `cron_curseur_{moment}_{jour}` (propriétaire neutre) dit qui est fait —
    //    relancé, le cron ne refait personne ; le lendemain, les oubliés d'abord.
    //    L'ordre tourne chaque jour : jamais les mêmes en dernier.
    // (11 nov., C8) Le passage horaire a SON curseur par heure : un vendeur passé à 17 h (pas encore
    // son heure) doit être revu à 18 h — jamais marqué « fait » pour la journée.
    // (11 nov., rappels perso) Le réveil aussi : GitHub le lance toutes les 30 min le matin, et la
    // route décide seule (fin des heures calmes, 9 h des rappels). Un curseur PAR JOUR marquait chaque
    // vendeur « fait » dès le premier passage (4 h) : le récapitulatif de 8 h ne partait plus. Un
    // curseur par demi-heure (le mémo de chaque envoi évite les doublons).
    const dt = new Date(debutCron);
    const momentCurseur = reveil ? `reveil-h${dt.getUTCHours()}${dt.getUTCMinutes() < 30 ? 'a' : 'b'}` : horaire ? `soir-h${new Date(debutCron).getUTCHours()}` : soir ? 'soir' : 'matin';
    const budget = Number(process.env.VRM_CRON_BUDGET_MS) > 0 ? Number(process.env.VRM_CRON_BUDGET_MS) : BUDGET_VENDEURS_MS;
    const lot = await passerVendeurs({
      owners, moment: momentCurseur, jour: parisDate(0), debut: debutCron, budgetMs: budget, parallele: VENDEURS_EN_PARALLELE,
      tempsVendeurMs: Number(process.env.VRM_CRON_VENDEUR_MS) > 0 ? Number(process.env.VRM_CRON_VENDEUR_MS) : TEMPS_VENDEUR_MS,   // (11 nov.) un vendeur énorme ne garde pas sa place
      traiter: (o) => contexteVendeur.run({ owner: o, compteurBilan }, () => traiter()),
      lireCurseur: lireNeutre, ecrireCurseur: ecrireNeutre, retirerCurseur: retirerNeutre,
    });
    const { bilans, echecs } = lot;
    res.status(echecs ? 500 : 200).json({ ok: !echecs, ...(bailEtat === 'pas-su' ? { bail: 'pas-su' } : {}), ...(soir ? { moment: 'soir', ...(horaire ? { passage: 'heure' } : {}) } : reveil ? { moment: 'reveil' } : {}), vendeurs: owners.length, echecs,
      lot: { traites: lot.traites, dejaFaits: lot.dejaFaits, restants: lot.restants, prioritaires: lot.prioritaires, budgetAtteint: lot.budgetAtteint, reportes: lot.reportes, curseur: lot.curseur },
      bilans, ...(sondes ? { sondes } : {}), ...(relances ? { relances } : {}), ...(veille ? { veille } : {}), ...(alertesPlantages ? { alertesPlantages } : {}), ...(purgeErreurs ? { purgeErreurs } : {}), ...(pilotage ? { pilotage } : {}), ...(purgeHtml ? { purgeHtml } : {}), ...(lenteurs ? { lenteurs } : {}), ...(purgeMesures ? { purgeMesures } : {}), ...(clientsPartis ? { clientsPartis } : {}), ...(controleInst ? { controleInstallation: controleInst } : {}) });
  } catch (e) {
    // Une tâche planifiée qui répond 200 sur une panne n'apparaît nulle part :
    // le tableau de bord la compte réussie, et les rappels d'expédition
    // cessent en silence. 500 = visible.
    res.status(500).json({ ok: false, erreur: 'panne', message: String((e && e.name) || 'erreur') + ' : ' + String((e && e.message) || '').slice(0, 160) });   // (11 nov., B127) borné, sans pile
  }
}

// (8 nov., « à envoyer » prouvé) Pour le banc seulement (scripts/audit-a-envoyer-preuves.cjs) : la
// composition « à expédier » du soir, du bilan et du matin, exécutée sur une fausse base.
export const _banc = { txsAExpedier, lireDonneesColis, lireDonneesBilan, bilanDuMoisVendeur };   // (12 nov.) + le bilan du mois (M79, audit-revue-fin)
