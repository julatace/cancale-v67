// ─────────────────────────────────────────────────────────────────────────────
// SUIVI DES COLIS PAR N° (23 octobre) — une règle pour l'app (Achats, Ma
// journée, la publication `vrm_colis_retirer`, la photo hors ligne, l'écran
// d'équipe), pour le widget (api/widget.js) et pour le rappel du matin
// (api/ship-reminders.js), §11. Pure : aucune lecture, aucune écriture.
//
// Julien : « quand on reçoit un mail comme quoi on a retiré un colis, le numéro
// de suivi est comparé à ceux dans les colis à retirer et ça retire les
// concernés » ; « il ne doit plus y avoir de problème avec les retraits, je me
// suis déplacé pour rien ».
//
// MESURÉ (lecture seule, 23 oct.) :
//   · VRM connaît 193 n° de suivi, TOUS lus dans des e-mails : Mondial Relay 117
//     (8 chiffres), Chronopost/Pickup 61 (2 lettres + 9 chiffres + 2 lettres, ou
//     14 chiffres), Vinted Go 20 (« VGS » + 13 chiffres, 16 chiffres, ou
//     « 1UW1T3… »), DPD 1. Le n° des Vinted Go n'est souvent écrit QUE dans le
//     SUJET, après « # » (« Ton colis arrive aujourd'hui ! #… ») : 29 lignes
//     sur 43 « info » ont un champ suivi vide.
//   · Un même n° existe parfois sous deux clés (`email_track_chronopost_N` et
//     `email_track_vinted_N`) : le n° NORMALISÉ est l'identité (§5), jamais la
//     clé de la ligne, le titre, la date, le point relais ou l'adresse.
//   · « Uw pakket is afgehaald door de ontvanger » (DPD, NL) dit que le
//     DESTINATAIRE l'a retiré ; « Tu envío ha sido recogido » (ES, 8 lignes) est
//     AMBIGU — mesuré : 6 des 8 portent le n° d'une « Confirmation du dépôt de
//     votre colis » (ses propres envois), c'est la RELÈVE par le transporteur.
//     Il ne vaut jamais « retiré » (api/_lib/etat-colis-email.js).
// ─────────────────────────────────────────────────────────────────────────────
import { normaliserSuivi, etatColisDepuisTexte } from './etat-colis-email.js';
import { arriveeColisEmail } from './arrivee-colis.js';
import { etatRetrait } from './retrait-colis.js';

// ── LE N° D'UNE LIGNE ────────────────────────────────────────────────────────
// Le n° écrit dans le SUJET après « # » (« Libère de la place… #1234567890123456 »).
// Un vrai n° de colis porte au moins un chiffre et fait 8 à 24 caractères ; sinon
// rien (un « #1 » ou « #bonjour » n'est pas une identité).
const SUIVI_SUJET = /#\s*([A-Za-z0-9]{8,24})(?![A-Za-z0-9])/;
export function suiviDuSujet(sujet) {
  const m = SUIVI_SUJET.exec(String(sujet || ''));
  if (!m) return '';
  const s = normaliserSuivi(m[1]);
  return /\d/.test(s) ? s : '';
}
// Le n° d'une ligne de suivi (forme de la base `data`, ou les scalaires de
// `meta` : `su`, `sj`) : le champ d'abord, le sujet sinon.
export function suiviDeLigne(l) {
  if (!l) return '';
  return normaliserSuivi(l.suivi != null ? l.suivi : l.su) || suiviDuSujet(l.subject != null ? l.subject : (l.sujet != null ? l.sujet : l.sj));
}
// À la LECTURE d'une ligne déjà rangée (avant le 23 oct., le n° du sujet n'était
// pas gardé) : le n° est posé pour l'IDENTITÉ seulement — le statut n'est pas
// touché (une ligne « info » sans n° reste « info » : sinon 7 vieux rappels de
// septembre ressortiraient « à vérifier », en double).
export function avecSuiviDuSujet(d) {
  if (!d || typeof d !== 'object' || normaliserSuivi(d.suivi)) return d;
  const s = suiviDuSujet(d.subject || d.sujet);
  return s ? { ...d, suivi: s, suiviLuDansSujet: true } : d;
}

// ── CE QUE DIT UNE LIGNE DE LA FIN DU COLIS ──────────────────────────────────
// 'delivered' (retiré / livré au destinataire) · 'retour' (reparti chez
// l'expéditeur) · null. Le statut rangé, relu avec la règle d'aujourd'hui sur
// le SUJET (une ligne rangée « info » avant que la règle sache lire « afgehaald
// door de ontvanger »). Un « retiré » gagne toujours sur un « retour ».
export function finDeLigne(l) {
  if (!l) return null;
  const st = l.status != null ? l.status : l.s;
  const e = etatColisDepuisTexte(l.subject != null ? l.subject : (l.sujet != null ? l.sujet : (l.sj || '')), l.statusLabel != null ? l.statusLabel : (l.lab || ''));
  if (st === 'delivered' || e === 'delivered') return 'delivered';
  if (st === 'retour' || e === 'retour') return 'retour';
  return null;
}
const msDe = (v) => { const ms = Date.parse(String(v || '')); return Number.isFinite(ms) ? ms : null; };
// Les fins connues, PAR N° NORMALISÉ : Map(n° → { retire, retours: [ms|null] }).
// `estSortant(l)` (facultatif) : un « retour » d'un colis qu'il a POSTÉ lui
// revient — il ne dit rien d'un achat (la règle de l'app, `sensColis`).
export function finsDesLignes(lignes, { estSortant } = {}) {
  const m = new Map();
  for (const l of (Array.isArray(lignes) ? lignes : [])) {
    const f = finDeLigne(l); if (!f) continue;
    const k = suiviDeLigne(l); if (!k) continue;
    if (f === 'retour' && typeof estSortant === 'function' && estSortant(l)) continue;
    const e = m.get(k) || { retire: false, retours: [] };
    if (f === 'delivered') e.retire = true;
    else e.retours.push(msDe(l.receivedAt != null ? l.receivedAt : l.r));
    m.set(k, e);
  }
  return m;
}
// UN colis (son n°, son arrivée) devant les fins connues :
// 'retire' — une ligne du même n° dit retiré (quelle que soit sa clé, quel que
//            soit l'ordre des e-mails : un rappel traité APRÈS ne le ressuscite
//            jamais) ;
// 'reparti' — une ligne du même n° dit qu'il repart chez l'expéditeur, écrite
//            depuis son arrivée (ou dates inconnues) ;
// null — rien ne le dit sorti.
export function sortiParSuivis(suivis, fins, arriveeMs = null) {
  const ks = (Array.isArray(suivis) ? suivis : [suivis]).map(normaliserSuivi).filter(Boolean);
  if (!ks.length || !fins) return null;
  let reparti = false;
  for (const k of ks) {
    const f = fins.get(k); if (!f) continue;
    if (f.retire) return 'retire';
    if (f.retours.some((d) => !Number.isFinite(arriveeMs) || !arriveeMs || d == null || d >= arriveeMs)) reparti = true;
  }
  return reparti ? 'reparti' : null;
}
export const sortiParSuivi = (ligne, fins, arriveeMs = null) => sortiParSuivis([suiviDeLigne(ligne)], fins, arriveeMs);

// ── LE TRANSPORTEUR D'UN N° TAPÉ À LA MAIN : PAR SA FORME ────────────────────
// Mesuré sur ses 193 n° : 8 chiffres = Mondial Relay (117) ; 2 lettres + 9
// chiffres + 2 lettres = Chronopost (43) ; « VGS… » = Vinted Go. Le reste est
// AMBIGU (14 chiffres : Chronopost 16 fois, Vinted Go 8, DPD 1 ; 16 chiffres :
// Vinted Go) ⇒ null : on DEMANDE, on ne devine pas.
export function transporteurDeForme(n) {
  const s = normaliserSuivi(n);
  if (/^\d{8}$/.test(s)) return 'mondialrelay';
  if (/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(s)) return 'chronopost';
  if (/^VGS\d{8,}$/.test(s)) return 'vinted';
  return null;
}
// Un n° qu'on accepte de ranger : 8 à 24 lettres ou chiffres, au moins un chiffre.
export const suiviValide = (n) => { const s = normaliserSuivi(n); return /^[A-Z0-9]{8,24}$/.test(s) && /\d/.test(s); };
export const TRANSPORTEURS_SAISIE = ['mondialrelay', 'chronopost', 'vinted', 'autre'];
export const normaliserCodePostal = (cp) => { const s = String(cp || '').replace(/\s+/g, ''); return /^\d{5}$/.test(s) ? s : ''; };
// L'identifiant de la ligne d'un n° saisi (une par n°, au nom du vendeur).
export const idSuiviManuel = (transporteur, n) => `colis_suivi_${TRANSPORTEURS_SAISIE.includes(transporteur) ? transporteur : 'autre'}_${normaliserSuivi(n)}`;

// Le CODE POSTAL d'un colis d'e-mail, quand il est LU (le lieu « …, 56000 Vannes »
// de l'e-mail) — jamais deviné. Sinon ''.
export function codePostalLu(t) {
  const lieu = String((t && t.lieu) || '');
  const m = /(?:^|[\s,])(\d{5})\s+[A-Za-zÀ-ÿ]/.exec(lieu);
  return m ? m[1] : '';
}

// ── LE LIEN DE SUIVI CHEZ LE TRANSPORTEUR ────────────────────────────────────
// `site: true` seulement pour une adresse du transporteur lui-même :
//   · Chronopost : la forme « tracking-no-cms » — celle que Leboncoin range dans
//     SA base (`lbc_ventes.trackingUrl`, mesuré le 23 oct.) ; VRM écrivait
//     « tracking-no-cdn », sans doute morte ;
//   · Mondial Relay : la page publique de suivi, n° pré-rempli, et le code
//     postal quand il est LU (la page le demande). ⚠️ Non mesuré d'ici
//     (mondialrelay.fr refuse ce conteneur) : qu'elle lise `codePostal`.
// Sinon une recherche du n° (`site: false`) — dite comme telle, jamais « le site
// du transporteur ». Le lien ne promet rien : c'est le transporteur qui répond.
export function lienSuivi(transporteur, suivi, codePostal = '') {
  const n = normaliserSuivi(suivi);
  if (!n) return null;
  const s = encodeURIComponent(n);
  const tr = String(transporteur || '').toLowerCase();
  if (/mondial/.test(tr)) {
    const cp = normaliserCodePostal(codePostal);
    return { url: `https://www.mondialrelay.fr/suivi-de-colis/?numeroExpedition=${s}${cp ? `&codePostal=${cp}` : ''}`, site: true, codePostal: cp };
  }
  if (/chrono/.test(tr)) return { url: `https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT=${s}`, site: true, codePostal: '' };
  return { url: `https://www.google.com/search?q=${s}+suivi+colis`, site: false, codePostal: '' };
}

// ── « DERNIÈRE NOUVELLE DE VINTED » ─────────────────────────────────────────
// La ligne rangée par l'extension (`harvest_{uid}_suivi_{tx}`, contrat du
// 23 oct.), lue en scalaires + `dernier`. On n'INTERPRÈTE PAS le texte (sa forme
// n'a jamais été vue) : on le recopie tel quel, borné, avec sa date et l'âge de
// la lecture. Une ligne sans texte ne dit rien (null).
export function nouvelleVinted(l) {
  if (!l || typeof l !== 'object') return null;
  const d = l.dernier && typeof l.dernier === 'object' ? l.dernier : null;
  const t = d && typeof d.t === 'string' ? d.t.replace(/\s+/g, ' ').trim().slice(0, 160) : '';
  if (!t) return null;
  return { t, at: msDe(d.at), cap: msDe(l.cap != null ? l.cap : l.capturedAt) };
}

// ── LES RAPPELS DU MATIN POUR LES COLIS À RETIRER (cron, 10 h à Paris) ──────
// Deux notifications, une fois par colis et par état :
//   · 'dernier'    — la date limite LUE dans l'e-mail est aujourd'hui (Paris) ;
//   · 'a_verifier' — le jour où le colis passe la date limite lue ou la garde de
//                    son transporteur (`etatRetrait`, `gardeDe`) — avec UN jour
//                    de rattrapage si le cron a sauté (jamais un colis d'il y a
//                    un mois au premier passage).
// Jamais un colis retiré ou reparti (une ligne du même n°), coché « J'ai
// retiré », qu'il ENVOIE (sens sortant ou n° de ses bordereaux), ou que l'app a
// classé fini (`finis` de sa publication : la commande reliée dit livrée ou non
// réclamée). Le n° est l'identité (sans n°, rien).
export const RATTRAPAGE_J = 1;
export function rappelsRetraitDuJour({ lignes = [], collectes = [], envoyes = [], finis = [], maintenant = Date.now(), aujourdhui = null } = {}) {
  const envoyesN = new Set((envoyes || []).map(normaliserSuivi).filter(Boolean));
  const fins = finsDesLignes(lignes, { estSortant: (l) => (l.sens != null ? l.sens : l.se) === 'sortant' || envoyesN.has(suiviDeLigne(l)) });
  const coches = new Set((collectes || []).map((c) => String(c || '').trim()));
  const cochesN = new Set((collectes || []).map(normaliserSuivi).filter(Boolean));
  const finisS = new Set((finis || []).map(String));
  const out = [], vus = new Set();
  for (const l of (Array.isArray(lignes) ? lignes : [])) {
    if (!l) continue;
    const st = l.status != null ? l.status : l.s;
    if (st !== 'available' || finDeLigne(l)) continue;
    if ((l.sens != null ? l.sens : l.se) === 'sortant') continue;
    const k = suiviDeLigne(l); if (!k || vus.has(k)) continue;
    if (envoyesN.has(k)) continue;
    const brut = String((l.suivi != null ? l.suivi : l.su) || (l.subject != null ? l.subject : l.sj) || '').trim();
    if (coches.has(brut) || cochesN.has(k)) continue;
    if (finisS.has('e:' + k)) continue;
    const arr = arriveeColisEmail({ arriveLe: l.arriveLe != null ? l.arriveLe : l.a, status: 'available', receivedAt: l.receivedAt != null ? l.receivedAt : l.r, subject: l.subject != null ? l.subject : l.sj });
    const arriveeMs = arr ? arr.ms : null;
    if (sortiParSuivis([k], fins, arriveeMs)) continue;
    const limite = (l.limite != null ? l.limite : l.l) || null;
    const transporteur = (l.carrier != null ? l.carrier : l.c) || '';
    const e = etatRetrait({ limite, arriveeMs, transporteur }, maintenant, aujourdhui);
    let etat = null;
    if (e.etat === 'a_retirer' && limite && e.jours === 0) etat = 'dernier';
    else if (e.etat === 'delai_depasse' && e.jours >= -(1 + RATTRAPAGE_J)) etat = 'a_verifier';
    else if (e.etat === 'trop_long' && Number.isFinite(e.age) && e.age <= e.garde + 1 + RATTRAPAGE_J) etat = 'a_verifier';
    if (!etat) continue;
    vus.add(k);
    out.push({ cle: `${etat}-${k}`, etat, suivi: k, transporteur, limite, lieu: (l.lieu != null ? l.lieu : '') || '', raison: e.etat, garde: e.garde });
  }
  return out;
}

// ── LE TEXTE D'UN RAPPEL DU MATIN (pur : le banc le juge par la route) ──────
const NOM_TRANSPORTEUR = { mondialrelay: 'Mondial Relay', chronopost: 'Chronopost', vinted: 'Vinted Go', colissimo: 'Colissimo', dpd: 'DPD', shop2shop: 'Shop2Shop' };
export const nomTransporteurSuivi = (c) => NOM_TRANSPORTEUR[String(c || '').toLowerCase()] || 'Colis';
const lieuCourt = (lieu) => { const s = String(lieu || '').replace(/®|™|©|[*_]+/g, ' ').replace(/\s+/g, ' ').trim(); const nom = s.split(',')[0].trim(); return nom.length >= 3 ? nom.slice(0, 45) : ''; };
const jjmm = (d) => { const m = /(\d{4})-(\d{2})-(\d{2})/.exec(String(d || '')); return m ? `${m[3]}/${m[2]}` : ''; };
export function texteRappelRetrait(x) {
  const nom = nomTransporteurSuivi(x.transporteur);
  const lieu = lieuCourt(x.lieu);
  if (x.etat === 'dernier') {
    return {
      title: `📍 Dernier jour pour retirer ${lieu || 'n°' + x.suivi}`,
      body: `${nom} — n°${x.suivi}${lieu ? `, chez ${lieu}` : ''} : à retirer aujourd'hui${jjmm(x.limite) ? ` (jusqu'au ${jjmm(x.limite)})` : ''}.`,
    };
  }
  const raison = x.raison === 'delai_depasse'
    ? `délai de retrait dépassé${jjmm(x.limite) ? ` (le ${jjmm(x.limite)})` : ''}`
    : `au point relais depuis plus de ${Number.isFinite(x.garde) ? x.garde : 7} jours`;
  return {
    title: `Colis à vérifier — sans doute reparti : n°${x.suivi}`,
    body: `${nom}${lieu ? ` · ${lieu}` : ''} : ${raison}. S'il est encore là, va le chercher ; sinon la conversation Vinted dit s'il est reparti et si tu es remboursé.`,
  };
}
