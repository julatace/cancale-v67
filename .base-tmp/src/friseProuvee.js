// ════════════════════════════════════════════════════════════════════════════
//  LA FRISE D'UNE VENTE, ÉTAPE PAR ÉTAPE (10 nov., lot BE — validé par Julien :
//  « peu de texte, du visuel »).
//
//  Sur le récapitulatif d'une vente Vinted : une ligne de temps
//    Vendue → Bordereau → Déposée → En route → Livrée → Finalisée → Versée
//  où CHAQUE étape n'est cochée que si SA PROPRE preuve est lue, avec sa date.
//
//  ⚠️ AUCUNE DÉDUCTION (la différence avec `friseVente`, src/recapVente.js, qui
//  reste la règle des 4 segments de la ligne) : une vente livrée dont aucun
//  e-mail ni « Colis fait » ne dit le dépôt montre « Déposée · pas lu », en gris.
//  Jamais « faite parce qu'une étape plus loin l'est », jamais devinée d'une date,
//  d'un délai ou d'une absence (§5 : « pas su » ne vaut pas « oui »).
//
//  Les preuves (une IDENTITÉ chacune, jamais le titre — §5) :
//    · vendue     — la transaction de la vente, avec un état écrit par Vinted ;
//    · bordereau  — un bordereau relié par le n° de TRANSACTION (e-mail du
//                   bordereau, ou capté par l'extension) ;
//    · deposee    — la règle unique du départ (api/_lib/depart-vente.js,
//                   `ventesPartiesParPreuve` : « Colis fait » / scan, expédié à la
//                   main, panneau, e-mail du transporteur pour le n° EXACT de SON
//                   bordereau, prise en charge lue) — ou l'état Vinted « déposé » ;
//    · enroute    — le transporteur, pour le n° de SON bordereau : prise en charge
//                   lue (`depart_*`, `priseAt`) ou un e-mail « en route » ; ou
//                   l'état Vinted « en cours d'acheminement » ;
//    · livree     — le transporteur (état « livré / retiré » du même n°), un e-mail
//                   « livré » du même n°, ou l'état Vinted « livré » ;
//    · finalisee  — la commande finalisée (450, ou le texte / champ machine) ;
//    · versee     — la date de versement LUE (celle de la compta, `versements`).
//  Un n° de suivi porté par deux ventes, ou aussi par un achat, est AMBIGU : rien
//  n'en est lu (la règle de api/_lib/depart-colis.js).
//  Une vente en litige / retour / annulée : les états écrits par Vinted sur la
//  LISTE ne prouvent rien d'elle (mesuré : « colis déposé » y décrivait le colis
//  de RETOUR) — seules les preuves par identité comptent ; la bifurcation est
//  dite à côté, elle ne décide rien (src/litiges.js, src/retoursStock.js).
//
//  L'étape EN COURS est la première non prouvée après la dernière prouvée. Elle
//  est AMBRE seulement si l'écran dit qu'un geste DE LUI est attendu là (générer
//  le bordereau, déposer le colis) — §7 : l'ambre est la couleur d'un geste.
//  Module PUR (aucune lecture, aucune écriture, aucun React). Exécuté par
//  scripts/audit-frise-source.cjs.
// ════════════════════════════════════════════════════════════════════════════

import { normaliserSuivi } from '../api/_lib/etat-colis-email.js';
import { preuveDeLigne } from '../api/_lib/depart-vente.js';
import { departProuve, TOLERANCE_AVANT_VENTE_MS } from '../api/_lib/depart-colis.js';
import { LIBELLE_GENRE } from './litiges.js';
import { LIBELLE_ETAPE } from './retoursStock.js';
import { ETAPE_CENTRE } from './verificationArticle.js';
import { jourParis } from './dateParis.js';

export const ETAPES_FRISE = [
  ['vendue', 'Vendue'],
  ['bordereau', 'Bordereau'],
  ['deposee', 'Déposée'],
  ['enroute', 'En route'],
  ['livree', 'Livrée'],
  ['finalisee', 'Finalisée'],
  ['versee', 'Versée'],
];

const str = (v) => String(v == null ? '' : v).trim();
const ms = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) && v > 1e11 ? v : null;   // un drapeau « 1 » n'est pas une date
  if (typeof v === 'string' && v) { const t = Date.parse(v); return Number.isFinite(t) ? t : null; }
  return null;
};
const lue = (t, source = '') => ({ lu: true, t: ms(t), source: str(source) });

// Les textes de la LISTE des ventes (`o.status`) — lus seulement hors litige.
const RE_FINALISEE = /finalis/i;
const RE_DEPOSE = /d[ée]pos[ée]/i;
const RE_EN_ROUTE = /achemin|transit|en\s*route|en\s*cours\s*de\s*livraison/i;
const RE_LIVREE = /\blivr[ée]|\bremise?\b|r[ée]ceptionn/i;
// États lus chez le transporteur (api/_lib/transporteurs.js `ETATS`).
const ETATS_LIVRE = new Set(['livre', 'retire']);

// ── LES PREUVES D'UNE VENTE VINTED ─────────────────────────────────────────
// vente      : la commande (liste « Mes ventes ») ;
// bord       : SON bordereau e-mail (par transaction) { suivi?, suiviPdf?, receivedAt? } ou null ;
// label      : le bordereau capté par l'extension { capturedAt? } ou null ;
// suiviPdf   : le n° lu sur SON étiquette (relu au cron) quand l'e-mail n'en porte pas ;
// depart     : la raison de départ de la règle unique (`ventesPartiesParPreuve`) ou null ;
// departs    : Map n° → ligne `depart_` (null / undefined = pas lu) ;
// emails     : lignes `email_track_*` (forme de l'app) ou null (pas lu) ;
// ambigus    : Set des n° ambigus (deux ventes, ou aussi un achat) ;
// etat       : l'état de la transaction ({ s }) ou null ;
// versement  : la date de versement lue (ISO) ou null / undefined ;
// horsParcours : vrai pour une vente en litige, en retour, annulée.
// Rend { vendue, bordereau, deposee, enroute, livree, finalisee, versee } —
// chacune { lu: true, t, source } ou { lu: false }.
export function preuvesFriseVinted({ vente, bord = null, label = null, suiviPdf = '', depart = null, departs = null, emails = null, ambigus = null, etat = null, versement = null, horsParcours = false } = {}) {
  const o = vente || {};
  const p = {};
  const non = { lu: false };
  const st = str(o.status), tus = str(o.transaction_user_status).toLowerCase();
  const s = etat && Number.isFinite(Number(etat.s)) ? Number(etat.s) : null;
  const venteMs = ms(o.date);
  const listeParle = !horsParcours;   // un état de LISTE ne prouve rien d'une vente en litige / retour

  p.vendue = o.transaction_id != null && st ? lue(o.date, 'transaction') : non;
  p.bordereau = bord ? lue(bord.receivedAt, 'email') : label ? lue(label.capturedAt, 'extension') : non;

  // Le n° de SON bordereau (jamais un autre), et seulement s'il n'est pas ambigu.
  const n = normaliserSuivi((bord && (bord.suivi || bord.suiviPdf)) || suiviPdf || '');
  const amb = !!(n && ambigus && (ambigus instanceof Set ? ambigus.has(n) : Array.isArray(ambigus) && ambigus.includes(n)));
  const nSur = n && !amb ? n : '';
  // Les e-mails du transporteur pour CE n° (la première preuve de chaque état),
  // jamais datés plus d'un jour AVANT la vente (ils contrediraient l'identité).
  const parEtat = {};
  if (nSur && Array.isArray(emails)) {
    for (const l of emails) {
      const x = preuveDeLigne(l);
      if (!x || x.suivi !== nSur) continue;
      if (venteMs != null && x.at != null && x.at < venteMs - TOLERANCE_AVANT_VENTE_MS) continue;
      const k = x.status === 'transit' ? (x.depot ? 'depot' : 'transit') : x.status;
      if (!parEtat[k] || (x.at != null && (parEtat[k].at == null || x.at < parEtat[k].at))) parEtat[k] = x;
    }
  }
  const ligneDepart = nSur && departs instanceof Map ? departs.get(nSur) || null : null;
  const prise = nSur && departs ? departProuve(nSur, departs, { venteMs, ambigus }) : null;

  // Déposée : la règle unique du départ (§11), sinon l'état Vinted « déposé ».
  if (depart && depart.type) p.deposee = lue(depart.at, depart.phrase || depart.type);
  else if (listeParle && RE_DEPOSE.test(st)) p.deposee = lue(null, 'vinted');
  else p.deposee = non;

  // En route : le transporteur pour SON n° (prise en charge, e-mail « en route »).
  if (prise) p.enroute = lue(prise.at, prise.phrase);
  else if (parEtat.transit) p.enroute = lue(parEtat.transit.at, 'email');
  else if (listeParle && RE_EN_ROUTE.test(st)) p.enroute = lue(null, 'vinted');
  else p.enroute = non;

  // Livrée : l'état du transporteur pour SON n°, un e-mail « livré », l'état Vinted.
  const priseAt = ligneDepart ? ms(ligneDepart.priseAt) : null;
  if (ligneDepart && ETATS_LIVRE.has(str(ligneDepart.etat)) && priseAt != null && !(venteMs != null && priseAt < venteMs - TOLERANCE_AVANT_VENTE_MS)) p.livree = lue(ligneDepart.etatAt, 'transporteur');
  else if (parEtat.delivered) p.livree = lue(parEtat.delivered.at, 'email');
  else if (listeParle && !RE_FINALISEE.test(st) && RE_LIVREE.test(st)) p.livree = lue(null, 'vinted');
  else p.livree = non;

  // Finalisée : la commande le dit (450, texte, champ machine) — sa date n'est pas lue à part.
  p.finalisee = RE_FINALISEE.test(st) || tus === 'completed' || s === 450 ? lue(null, s === 450 ? 'transaction' : 'vinted') : non;
  // Versée : la date de versement LUE (la compta) — sans date, pas de coche.
  p.versee = ms(versement) != null ? lue(versement, 'versement') : non;
  return p;
}

// ── LA BIFURCATION (litige, retour, annulation) — dite, jamais décidée ici ──
// litige   : la ligne de src/litiges.js (`litigeDeVente`) ou null ;
// retour   : `etapeRetourVinted` (src/retoursStock.js) ou null ;
// etiquette: l'étiquette de la vente (`etapeVente(o).label`) ;
// annulee  : la vente est annulée (`classifyOrderStatus` = 'cancelled').
// Rend { genre, libelle, sous, geste } ou null. `geste` : SA réponse est attendue
// (un litige ouvert par l'acheteur, une annulation demandée) ⇒ ambre.
const HORS = { 'Annulée': 'annulee', 'Remboursée': 'remboursee', 'Retournée': 'retour', 'Retour en cours': 'retour', 'Suspendue': 'suspendue' };
// « Retour · Retour initié » ⇒ « Retour initié » (un mot une fois).
const sansRedite = (x) => (x.sous && x.sous.toLowerCase().startsWith(x.libelle.toLowerCase()) ? { ...x, libelle: x.sous, sous: '' } : x);
export function bifurcationVente({ litige = null, retour = null, etiquette = '', annulee = false } = {}) {
  if (litige && !litige.ancien && LIBELLE_GENRE[litige.genre]) {
    const sous = litige.genre === 'retour' && retour && LIBELLE_ETAPE[retour.etape] ? LIBELLE_ETAPE[retour.etape] : '';
    return sansRedite({ genre: litige.genre, libelle: LIBELLE_GENRE[litige.genre], sous, geste: litige.genre === 'probleme' || litige.genre === 'annulation' });
  }
  if (retour && LIBELLE_ETAPE[retour.etape]) return sansRedite({ genre: 'retour', libelle: 'Retour', sous: LIBELLE_ETAPE[retour.etape], geste: false });
  if (HORS[etiquette]) return { genre: HORS[etiquette], libelle: etiquette, sous: '', geste: false };
  if (annulee) return { genre: 'annulee', libelle: 'Annulée', sous: '', geste: false };
  return null;
}

// ── LA FRISE ────────────────────────────────────────────────────────────────
// preuves      : la sortie de `preuvesFriseVinted` (ou toute { cle: { lu, t } }) ;
// bifurcation  : la sortie de `bifurcationVente` ou null ;
// geste        : { cle: 'bordereau' | 'deposee', libelle } — le geste QUE L'ÉCRAN
//                attend de lui, ou null.
// verification : l'état de LA transaction dit « Envoi au centre de vérification »
//                (src/verificationArticle.js) ⇒ une étape « Au centre de
//                vérification » entre En route et Livrée. Aucune preuve ne la
//                coche (VRM ne lit pas la sortie du centre) : elle est en cours,
//                ou « pas lu » — jamais faite par déduction.
// Rend { etapes: [{ cle, label, etat: 'fait' | 'paslu' | 'geste', t, source,
//        cours, apresBif }], bifurcation: { …, apres } | null, derniere }.
export function friseProuvee({ preuves = {}, bifurcation = null, geste = null, verification = false } = {}) {
  const liste = ETAPES_FRISE.slice();
  if (verification === true) liste.splice(liste.findIndex(([c]) => c === 'livree'), 0, [ETAPE_CENTRE.cle, ETAPE_CENTRE.court]);
  const etapes = liste.map(([cle, label]) => {
    const p = preuves && preuves[cle];
    const fait = !!(p && p.lu === true);
    return { cle, label, etat: fait ? 'fait' : 'paslu', t: fait ? ms(p.t) : null, source: fait ? str(p.source) : '', cours: false, apresBif: false, geste: '' };
  });
  const derniere = etapes.map((e) => e.etat === 'fait').lastIndexOf(true);
  let bif = null;
  if (bifurcation && bifurcation.libelle) {
    bif = { ...bifurcation, apres: derniere };
    etapes.forEach((e, i) => { if (i > derniere) e.apresBif = true; });
  } else {
    const i = derniere + 1;
    if (i < etapes.length) {
      etapes[i].cours = true;
      if (geste && geste.cle === etapes[i].cle) { etapes[i].etat = 'geste'; etapes[i].geste = str(geste.libelle); }
    }
  }
  return { etapes, bifurcation: bif, derniere };
}

// « 3 nov. » — heure de Paris.
const _jour = (() => { try { return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short' }); } catch (_) { return null; } })();
export const jourFrise = (t) => {
  if (!Number.isFinite(t)) return '';
  try { return _jour ? _jour.format(new Date(t)).replace(/ | /g, ' ') : jourParis(t); } catch (_) { return ''; }
};
// Ce qui s'écrit sous une étape : la date lue, « lu » (prouvée sans date lue),
// le geste attendu, ou « pas lu ».
export function sousEtape(e) {
  if (!e) return '';
  if (e.etat === 'fait') return e.t != null ? jourFrise(e.t) : 'lu';
  if (e.etat === 'geste') return e.geste || 'à faire';
  return 'pas lu';
}
