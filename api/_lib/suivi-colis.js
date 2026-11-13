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
import { normaliserSuivi, etatColisDepuisTexte, changementDeRelais, colisPerdu } from './etat-colis-email.js';
import { arriveeColisEmail } from './arrivee-colis.js';
import { etatRetrait, lieuDepuisExtrait, lieuLisibleDepuisExtrait, limiteRetraitDepuisTexte, LIEU_AU_FUTUR, joursAvantLimite, jourParis } from './retrait-colis.js';
import { codeRetraitTournure, codeImpossible } from './code-retrait-email.js';
import { preuveDeLigne, preuveDeTransp, contredit, lectureEnRetard, etatProuve } from './etat-colis.js';
// (24 oct.) LE STATUT LU CHEZ LE TRANSPORTEUR (api/_lib/transporteurs.js) : une
// ligne `transp_{transporteur}_{n°}` par n°, écrite par le SERVEUR seul. Elle se
// joint aux e-mails PAR LE N° — jamais réécrite dans une ligne `email_track_*`.
// ⚠️ (29 oct.) Plus de « fenêtre des lecteurs » : une ligne `transp_` finie
// (retirée, rendue) reste lue, quel que soit son âge — sans elle, un colis
// RETIRÉ revenait « à vérifier » au 46e jour (rien lu ne redonne jamais l'état
// d'avant la lecture).
import { sensDeLigne, SUJET_SORTANT, SUJET_ENTRANT, SELECT_TRANSP_META, ligneTranspDeMeta, codesPostauxDe, CP_SIEGE_MR, heureParis, indexTranspParSuivi } from './transporteurs.js';
export { sensDeLigne, SUJET_SORTANT, SUJET_ENTRANT, SELECT_TRANSP_META, ligneTranspDeMeta, heureParis };

// ── UNE LIGNE DE SUIVI RELUE AVEC LA RÈGLE D'AUJOURD'HUI (revue du 23 oct., n° 2)
// Une ligne `email_track_*` déjà rangée ne sera jamais réécrite : elle est relue
// ICI, de la même façon par l'app (Achats, Ma journée, l'écran d'équipe), le
// rappel du matin (api/ship-reminders.js) et le widget (api/widget.js), §11.
// Avant, seule l'app la relisait : « Information… sera disponible dans les
// prochains jours dans votre Relais Pickup » (rangée « disponible », ce futur
// pour lieu) était « en transit » dans l'app, et le rappel du matin disait
// « Colis à vérifier — sans doute reparti… va le chercher » sur ce même colis.
//   · le code « … suivant au commerçant : 123456 », le lieu « NOM | rue | CP
//     Ville » et la date limite « RETRAIT JUSQU'AU 26/10 » relus dans ce que la
//     route a gardé (`extraitCode`, `extraitLieu`) — sous leur forme EXACTE ;
//   · une ARRIVÉE ANNONCÉE (lieu au futur, ou sujet « arrive aujourd'hui »), sans
//     code ni QR ni vrai lieu ⇒ en route ;
//   · un retour ou un retrait écrits dans le SUJET ⇒ reparti, retiré ;
//   · un sujet « disponible » avec son n° ⇒ à retirer (un ancien bug du parseur).
// Pure. Accepte la ligne entière (`data`) ou ses scalaires (`ligneDeMeta`).
const codeLu = (v) => { const c = String(v == null ? '' : v).trim(); return /^[A-Z]{0,2}\d{3,10}$/.test(c) ? c : ''; };
const aUnQr = (d) => !!(d && (d.qrB64 || d.qrUrl || d.qrType));
export function relireLigneSuivi(d) {
  if (!d || typeof d !== 'object') return d;
  if (!codeLu(d.code) && d.extraitCode) { const c = codeRetraitTournure(d.extraitCode); if (c) d = { ...d, code: c }; }
  if (!d.lieu && d.extraitLieu) { const l = lieuDepuisExtrait(d.extraitLieu); if (l) d = { ...d, lieu: l, lieuLuDansExtrait: true }; }
  // (12 nov.) Repli : l'extrait a un point sans la forme « NOM | rue | CP Ville » ⇒ son texte nettoyé, tel
  // qu'écrit dans l'e-mail (`lieuBrut`), jamais une adresse recomposée ; rien que le siège ⇒ rien (« — »).
  if (!d.lieu && d.extraitLieu) { const l = lieuLisibleDepuisExtrait(d.extraitLieu); if (l) d = { ...d, lieu: l, lieuLuDansExtrait: true, lieuBrut: true }; }
  // (1er nov., audit des codes de retrait) Une ligne rangée avant la règle peut
  // porter le n° de suivi ou le code postal du lieu comme « code » : il n'est
  // plus montré (« code pas lu », jamais un faux devant le comptoir).
  if (codeLu(d.code) && codeImpossible(d.code, d)) d = { ...d, code: null, codeEcarte: codeImpossible(d.code, d) };
  if (codeLu(d.code2) && codeImpossible(d.code2, d)) d = { ...d, code2: null };
  if (!d.limite && (d.extraitCode || d.extraitLieu)) { const lim = limiteRetraitDepuisTexte(`${d.extraitCode || ''}\n${d.extraitLieu || ''}`.replace(/\s*\|\s*/g, '\n'), d.receivedAt); if (lim) d = { ...d, limite: lim, limiteLueDansExtrait: true }; }
  const preuve = !!(codeLu(d.code) || aUnQr(d));
  if (d.status === 'available' && d.lieu && LIEU_AU_FUTUR.test(d.lieu) && !preuve) return { ...d, status: 'transit', statusLabel: 'En transit', lieu: null };
  const etat = etatColisDepuisTexte(d.subject || d.sujet || '', d.statusLabel || '');
  // (10 nov.) « Votre colis a changé de plan » rangé AVANT la règle « arrivé » ou « livré »
  // (le corps parlait du point, « livré dans le Point Relais suivant ») : la ligne garde le
  // sujet de l'e-mail qui a posé son état — c'est donc lui qui l'avait mal classée. Le colis
  // roule vers le nouveau point (api/_lib/etat-colis-email.js, `changementDeRelais`).
  if (etat === 'transit' && changementDeRelais(d.subject || d.sujet || '') && d.status !== 'transit') {
    // (12 nov.) Un « retiré » posé par une AUTRE preuve que cet e-mail (daté à plus de 5 min de son rangement)
    // contredit le changement de plan : la contradiction est DITE et le transporteur la tranchera (`fusionTransporteur`).
    const autrePreuve = d.status === 'delivered' && Number.isFinite(Date.parse(d.retireLe || '')) && Number.isFinite(Date.parse(d.receivedAt || ''))
      && Math.abs(Date.parse(d.retireLe) - Date.parse(d.receivedAt)) > 5 * 60000;
    return { ...d, status: 'transit', statusLabel: 'Point relais changé', relaisChange: true, retireLe: null,
      ...(autrePreuve ? { aVerifierTransporteur: 'Retiré puis « changé de plan » : VRM le vérifie chez le transporteur' } : {}) };
  }
  if (d.status === 'transit' && d.relaisChange && !d.statusLabel) return { ...d, statusLabel: 'Point relais changé' };
  // (10 nov., retraits irréprochables) « Action requise : le colis semble avoir été perdu » rangé
  // « livré / retiré » avant la règle du 3 nov. (mesuré : une ligne du 2 nov. l'est encore) : un colis
  // perdu n'est ni livré ni retiré — la ligne redevient une information, sans date de retrait.
  if (d.status === 'delivered' && colisPerdu(d.subject || d.sujet || '')) return { ...d, status: 'info', statusLabel: 'Colis perdu (d’après Vinted)', perdu: true, retireLe: null };
  if (etat === 'retour' && d.status !== 'delivered') return { ...d, status: 'retour', statusLabel: 'Reparti chez l’expéditeur' };
  if (etat === 'delivered') return { ...d, status: 'delivered', statusLabel: 'Livré / retiré' };
  // « Ton colis arrive aujourd'hui ! #… » : l'arrivée est ANNONCÉE — sans code,
  // sans QR et sans vrai lieu, le colis roule encore.
  if (etat === 'transit' && d.status === 'available' && !preuve && (!d.lieu || LIEU_AU_FUTUR.test(d.lieu))) return { ...d, status: 'transit', statusLabel: 'En transit', lieu: null };
  if (etat === 'available' && d.status !== 'delivered' && normaliserSuivi(d.suivi)) return { ...d, status: 'available', statusLabel: 'Arrivé au point de retrait' };
  return d;
}
// Les scalaires de `meta` lus par le cron et le widget (alias courts) sous les
// noms de la ligne — les alias restent (les règles d'ici lisent les deux).
export const SELECT_SUIVI_META = 'id,s:meta->>status,r:meta->>receivedAt,ea:meta->>emailAt,l:meta->>limite,a:meta->>arriveLe,su:meta->>suivi,sj:meta->>subject,se:meta->>sens,c:meta->>carrier,lab:meta->>statusLabel,lieu:meta->>lieu,co:meta->>code,qt:meta->>qrType,qu:meta->>qrUrl,el:meta->>extraitLieu,ec:meta->>extraitCode,rl:meta->>retireLe,art:meta->>artTitle';
export function ligneDeMeta(x) {
  if (!x || typeof x !== 'object') return x;
  const v = (a, b) => (x[a] != null ? x[a] : (x[b] != null ? x[b] : null));
  return { ...x, status: v('status', 's'), receivedAt: v('receivedAt', 'r'), emailAt: v('emailAt', 'ea'), limite: v('limite', 'l'), arriveLe: v('arriveLe', 'a'),
    suivi: v('suivi', 'su') || '', subject: v('subject', 'sj') || '', sens: v('sens', 'se'), carrier: v('carrier', 'c'), statusLabel: v('statusLabel', 'lab') || '',
    code: v('code', 'co'), qrType: v('qrType', 'qt'), qrUrl: v('qrUrl', 'qu'), extraitLieu: v('extraitLieu', 'el'), extraitCode: v('extraitCode', 'ec'), retireLe: v('retireLe', 'rl'), artTitle: v('artTitle', 'art') };
}
// La ligne relue, depuis ses scalaires : une forme pour le cron et le widget.
// Les alias courts suivent la relecture (statut, lieu, date limite).
export function relireLigneMeta(x) {
  const d = relireLigneSuivi(ligneDeMeta(x));
  return d && typeof d === 'object' ? { ...d, s: d.status, lab: d.statusLabel, l: d.limite, co: d.code } : d;
}

// ── CE QUE LA COMMANDE VINTED DIT DE LA FIN D'UN COLIS (revue du 23 oct., n° 3)
// 'retire' (finalisée, livrée, reçue) · 'reparti' (non réclamée, remboursée,
// annulée) · null (rien de terminal). Une règle pour l'app (`finCommandeAchat`)
// et le rappel du matin, qui ne SAVAIT la fin d'un achat que par la publication
// de l'app (`vrm_colis_retirer.finis`) : absente ou ancienne, « pas su » valait
// « pas fini », et « 📍 Dernier jour pour retirer » partait pour un colis déjà
// retiré. `etat` = l'état de la transaction ({ s: code, ss: état de
// l'expédition }) ; `auRelais` = le statut dit « au point relais » (la règle
// `isAtRelayStatus` de l'app, ou le résumé de l'extension, la même — §11).
export function finDeCommandeAchat({ statut = '', etat = null, auRelais = false } = {}) {
  if (etat && /non\s+r[ée]clam/i.test(etat.ss || '')) return 'reparti';
  if (etat && etat.s >= 500 && etat.s < 600) return 'reparti';
  if (etat && etat.s === 450) return 'retire';
  if (auRelais === true) return null;
  const st = String(statut || '');
  if (/non\s+r[ée]clam|rembours|annul/i.test(st)) return 'reparti';
  if (/finalis|termin|commande\s+livr|a\s+[ée]t[ée]\s+livr|re[çc]u\s+(?:sa|ta|la)\s+commande/i.test(st)) return 'retire';
  return null;
}

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
// (24 oct.) CE QUE DIT LE TRANSPORTEUR DE LA FIN D'UN COLIS — l'adaptateur de
// la ligne `transp_` (jamais `finDeLigne` : sa forme n'est pas celle d'un
// e-mail). 'retire' (retiré ou livré, à n'importe quelle date : « un retiré
// gagne toujours ») · 'retour' (repart chez l'expéditeur, daté) · 'incident' ·
// 'inconnu' (daté : il ne compte qu'APRÈS l'arrivée) · null. On fait confiance à
// `etat` : le serveur est le seul à l'écrire, avec la règle.
export function finDeLigneTransporteur(t) {
  if (!t || !t.etat) return null;
  if (t.etat === 'retire' || t.etat === 'livre') return 'retire';
  if (t.etat === 'retour_expediteur') return 'retour';
  if (t.etat === 'incident') return 'incident';
  if (t.etat === 'inconnu') return 'inconnu';
  return null;
}
// Les fins connues, PAR N° NORMALISÉ : Map(n° → { retire, retours: [ms|null],
// incidents: [{ at, etat, detail, libelle }] }).
// `estSortant(l)` (facultatif) : un « retour » d'un colis qu'il a POSTÉ lui
// revient — il ne dit rien d'un achat (la règle de l'app, `sensColis`).
// `transp` (facultatif) : les lignes `transp_` (tableau ou Map n° → ligne).
export function finsDesLignes(lignes, { estSortant, transp } = {}) {
  const m = new Map();
  const tl = transp instanceof Map ? [...transp.values()] : (Array.isArray(transp) ? transp : []);
  for (const t of tl) {
    const f = finDeLigneTransporteur(t); if (!f) continue;
    const k = normaliserSuivi(t.suivi); if (!k) continue;
    const e = m.get(k) || { retire: false, retours: [], incidents: [] };
    if (f === 'retire') e.retire = true;
    else if (f === 'retour') e.retours.push(msDe(t.etatAt));
    else (e.incidents || (e.incidents = [])).push({ at: msDe(t.etatAt), etat: t.etat, detail: t.detail || null, libelle: t.libelle || '', carrier: t.carrier || '' });
    m.set(k, e);
  }
  for (const l of (Array.isArray(lignes) ? lignes : [])) {
    const f = finDeLigne(l); if (!f) continue;
    const k = suiviDeLigne(l); if (!k) continue;
    if (f === 'retour' && typeof estSortant === 'function' && estSortant(l)) continue;
    const e = m.get(k) || { retire: false, retours: [], incidents: [] };
    if (f === 'delivered') e.retire = true;
    // (revue du 23 oct., n° 4) La date d'un retour est celle de son E-MAIL
    // (`emailAt`, la date Gmail) quand on l'a, sinon l'heure de son traitement :
    // traité AVANT l'e-mail d'arrivée (rejeu du plus récent au plus ancien), un
    // retour écrit après elle passait pour écrit avant — le colis restait « à
    // retirer ». L'arrivée, elle, est datée par son e-mail au rangement.
    else e.retours.push(msDe(l.emailAt != null ? l.emailAt : l.ea) ?? msDe(l.receivedAt != null ? l.receivedAt : l.r));
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
// 'a_verifier' — (24 oct.) le TRANSPORTEUR signale un incident (« a quitté le
//            point relais sans être retiré »…) ou un statut qu'on ne connaît pas
//            APRÈS l'arrivée : le colis sort de « à retirer » et passe « à
//            vérifier » (avant l'arrivée : ignoré) ;
// null — rien ne le dit sorti.
// ⚠️ (29 oct.) `arriveeMs` est une arrivée SÛRE (l'e-mail d'arrivée, le message
// d'arrivée de la conversation, l'arrivée lue chez le transporteur) — JAMAIS une
// borne « au plus tard » (l'heure d'une capture des achats) : prise comme
// arrivée, une borne postérieure au vrai retour le faisait ignorer, et un achat
// Vinted reparti selon le transporteur restait « à retirer ». Une borne se passe
// à part (`{ borne }`) : sans arrivée sûre, un retour ou un incident compte
// toujours (comme une arrivée inconnue) ; un statut inconnu compte s'il est
// postérieur à la borne (donc à l'arrivée, qui la précède).
const incidentApres = (i, connue, arriveeMs, borne) => (i.etat === 'incident' && (!connue || i.at == null || i.at >= arriveeMs))
  || (i.etat === 'inconnu' && i.at != null && ((connue && i.at >= arriveeMs) || (!connue && borne != null && i.at >= borne)));
const borneDe = (b) => (Number.isFinite(b) && b > 0 ? b : null);
export function sortiParSuivis(suivis, fins, arriveeMs = null, { borne = null } = {}) {
  const ks = (Array.isArray(suivis) ? suivis : [suivis]).map(normaliserSuivi).filter(Boolean);
  if (!ks.length || !fins) return null;
  let reparti = false, verifier = false;
  const connue = Number.isFinite(arriveeMs) && arriveeMs > 0;
  const b = borneDe(borne);
  for (const k of ks) {
    const f = fins.get(k); if (!f) continue;
    if (f.retire) return 'retire';
    if (f.retours.some((d) => !connue || d == null || d >= arriveeMs)) reparti = true;
    for (const i of (f.incidents || [])) if (incidentApres(i, connue, arriveeMs, b)) verifier = true;
  }
  return reparti ? 'reparti' : (verifier ? 'a_verifier' : null);
}
// Le motif d'un « à vérifier » venu du transporteur (le libellé brut, pour la carte).
export function incidentDeSuivis(suivis, fins, arriveeMs = null, { borne = null } = {}) {
  const ks = (Array.isArray(suivis) ? suivis : [suivis]).map(normaliserSuivi).filter(Boolean);
  if (!fins) return null;
  const connue = Number.isFinite(arriveeMs) && arriveeMs > 0;
  const b = borneDe(borne);
  for (const k of ks) { const f = fins.get(k); if (!f) continue; for (const i of (f.incidents || [])) if (incidentApres(i, connue, arriveeMs, b)) return i; }
  return null;
}
// ── (29 oct.) LES COLIS REPARTIS, UNE COUPURE POUR TOUTES LES SOURCES (§11) ──
// Un colis reparti reste visible 30 jours (le temps de vérifier le
// remboursement), qu'on le sache par un e-mail de retour (sa date) ou par le
// transporteur (la date de son évènement, `etatAt`) — avant, un rendu de juillet
// vu par le transporteur restait affiché pour toujours. Date inconnue ⇒ montré.
export const REPARTIS_AGE_MAX_J = 30;
export const repartiAffichable = (ms, maintenant = Date.now()) => !Number.isFinite(ms) || maintenant - ms <= REPARTIS_AGE_MAX_J * 86400000;

// ── (24 oct.) LE TRANSPORTEUR FAIT MONTER, JAMAIS DESCENDRE (§1.7) ───────────
// Une ligne d'e-mail ET la ligne `transp_` du même n° :
//   · « disponible » chez le transporteur, PLUS RÉCENT que le dernier e-mail du
//     même n° (en transit, info…) ⇒ la ligne devient « à retirer », avec le lieu
//     et la limite du transporteur, mais SANS code ni QR ;
//   · e-mail déjà « disponible » : le transporteur n'ajoute que la limite quand
//     l'e-mail n'en a pas (sûre : `limite` ; déduite : `limiteVers`, dite « vers
//     le ») — la limite de l'e-mail gagne quand les deux existent ;
//   · une lecture « disponible » de moins de 6 h lève une « à vérifier » qui ne
//     vient QUE de la garde (`transpDispoLu`, voir `leverGarde`) — jamais une
//     date limite lue et dépassée ;
//   · « disponible » chez le transporteur et « reparti » dans l'e-mail, plus
//     récent : contradiction ⇒ « à vérifier » (`transpContradiction`) ;
//   · « en route » ne fait jamais redescendre un « disponible ».
// Pure ; ne touche jamais la ligne rangée (une COPIE).
export const DISPO_LEVE_GARDE_MS = 6 * 3600000;
const dernierEmailMs = (l) => msDe(l.emailAt != null ? l.emailAt : l.ea) ?? msDe(l.receivedAt != null ? l.receivedAt : l.r);
// (1er nov.) + la RUE quand le transporteur la donne (Vinted Go : « 24 Rue Hoche,
// Vannes ») ; Chronopost et Mondial Relay n'en donnent pas : inchangés.
export const lieuTransp = (t) => (t ? [t.lieuNom, t.lieuRue, [t.lieuCp, t.lieuVille].filter(Boolean).join(' ')].filter(Boolean).join(', ') : '');
export function fusionTransporteur(l, t, maintenant = Date.now()) {
  if (!l || !t || !t.etat) return l;
  const st = l.status != null ? l.status : l.s;
  const at = msDe(t.etatAt), luMs = msDe(t.lu);
  // (6 nov.) LA RÈGLE D'ÉTAT DATÉE (api/_lib/etat-colis.js) : une ligne « disponible » que le
  // transporteur dit « en route » — lecture faite AVANT l'arrivée ⇒ en retard (dit tel quel, le
  // colis reste à retirer) ; événement daté APRÈS l'arrivée ⇒ contradiction (« à vérifier »).
  if (st === 'available' && t.etat === 'en_route') {
    const preuve = preuveDeLigne(l), p = preuveDeTransp(t);
    if (contredit(p, preuve)) { const e = etatProuve([preuve, p]); return { ...l, transp: t, transpContradiction: true, transpConflit: (e && e.conflit && e.conflit.raison) || '' }; }
    if (lectureEnRetard(p, preuve)) return { ...l, transp: t, transpEnRetard: true };
    return l;
  }
  // (12 nov., décision de Julien : « tout doit être fait automatiquement, tu regardes sur le site du transporteur »)
  // LE TRANSPORTEUR TRANCHE. Retiré ou reparti chez lui est un état FINAL : il l'emporte sur les e-mails qui se
  // contredisent (ex. « retiré » le 9 nov. puis « changé de plan » le 10) — jamais Julien à qui l'on demande.
  // « En route » ⇒ la ligne reste en route (ci-dessus pour une ligne disponible). Pas de réponse ⇒ rien de
  // changé : la contradiction reste dite (`aVerifierTransporteur`) et la lecture est retentée au passage suivant.
  // (12 nov., intégration) Seulement une ligne en CONTRADICTION (`aVerifierTransporteur`) : sans elle, la sortie
  // lue chez le transporteur garde son chemin d'avant (« Sortis de à retirer », source transporteur — banc retraits-suivi R1).
  if (t.etat === 'retire' && l.aVerifierTransporteur && st !== 'delivered' && luMs != null) {
    return { ...l, status: 'delivered', statusLabel: 'Retiré (lu chez le transporteur)', retireLe: t.etatAt || t.lu, relaisChange: false, viaTransporteur: true, transp: t, aVerifierTransporteur: null };
  }
  if (t.etat === 'retour_expediteur' && l.aVerifierTransporteur && st !== 'delivered' && st !== 'retour' && luMs != null) {
    return { ...l, status: 'retour', statusLabel: 'Reparti chez l’expéditeur (lu chez le transporteur)', relaisChange: false, viaTransporteur: true, transp: t, aVerifierTransporteur: null };
  }
  if (t.etat === 'en_route' && l.aVerifierTransporteur && luMs != null) return { ...l, transp: t, aVerifierTransporteur: null };
  // (13 nov., capture de Julien : 42878264 « retiré » le 9 puis « changé de plan » le 10, que Mondial Relay dit
  // DISPONIBLE) La contradiction est tranchée par le transporteur quelle que soit l'heure de sa lecture : le colis
  // attend au point (celui du transporteur, sinon celui de l'e-mail du changement), avec le code déjà lu.
  if (t.etat === 'disponible' && l.aVerifierTransporteur && st !== 'delivered' && st !== 'available' && luMs != null) {
    return { ...l, status: 'available', statusLabel: 'Disponible (lu chez le transporteur)', lieu: lieuTransp(t) || l.lieu || null, relaisChange: false,
      viaTransporteur: true, transp: t, aVerifierTransporteur: null, arriveLe: l.arriveLe || t.etatAt || null };
  }
  if (t.etat !== 'disponible') return l;
  const em = dernierEmailMs(l);
  const recent = luMs != null && maintenant - luMs < DISPO_LEVE_GARDE_MS ? luMs : null;
  if (st === 'available') {
    const out = { ...l, transp: t };
    // (12 nov.) « Lieu à confirmer » avec un n° de suivi : le point vient du transporteur quand l'e-mail ne le dit pas.
    if (!l.lieu && lieuTransp(t)) { out.lieu = lieuTransp(t); out.lieuDuTransporteur = true; }
    if (!l.limite && t.limite && t.limiteSure) { out.limite = t.limite; out.limiteDuTransporteur = true; }
    // (29 oct.) L'HEURE de la limite (Vinted Go) quand c'est le même jour.
    if (t.limiteSure && t.limiteAt && out.limite && out.limite === t.limite) out.limiteAt = t.limiteAt;
    if (!out.limite && t.limite && !t.limiteSure) out.limiteVers = t.limite;
    if (recent != null) out.transpDispoLu = recent;
    return out;
  }
  if ((st === 'transit' || st === 'info' || !st) && at != null && (em == null || at > em)) {
    // (10 nov., retraits irréprochables) Un colis REDIRIGÉ (« Votre colis a changé de plan ») : le nouveau
    // point est LU dans l'e-mail de CE n° (une identité). Le transporteur qui le dit arrivé sans nommer le
    // point (Mondial Relay : `lieuNom` vide, mesuré) ne l'efface plus — sans lui, la carte disait « point
    // pas encore connu » pour un colis dont l'e-mail donnait l'adresse.
    const lieuF = lieuTransp(t) || (l.relaisChange && l.lieu ? l.lieu : null);
    return { ...l, status: 'available', statusLabel: 'Disponible (lu chez le transporteur)', lieu: lieuF, relaisChange: false, ...(l.relaisChange ? { redirige: true } : {}),
      limite: (t.limiteSure && t.limite) || null, limiteVers: (!t.limiteSure && t.limite) || null, limiteDuTransporteur: !!(t.limiteSure && t.limite),
      limiteAt: (t.limiteSure && t.limite && t.limiteAt) || null,
      arriveLe: t.etatAt, viaTransporteur: true, transp: t, ...(recent != null ? { transpDispoLu: recent } : {}) };
  }
  if (st === 'retour' && at != null && em != null && at > em) return { ...l, transp: t, transpContradiction: true };
  return l;
}
// Une ligne SYNTHÉTIQUE pour un n° sans e-mail (saisi à la main, suivi Vinted)
// que le transporteur dit « disponible » : elle entre dans « à retirer » comme
// une ligne d'e-mail, sans code ni QR.
export function ligneDuTransporteur(t, maintenant = Date.now()) {
  if (!t || t.etat !== 'disponible') return null;
  const luMs = msDe(t.lu);
  return { id: `transp:${t.carrier}:${t.suivi}`, suivi: t.suivi, carrier: t.carrier, status: 'available', statusLabel: 'Disponible (lu chez le transporteur)',
    subject: '', receivedAt: t.etatAt || t.lu || null, arriveLe: t.etatAt || null, lieu: lieuTransp(t) || null, sens: 'entrant',
    limite: (t.limiteSure && t.limite) || null, limiteVers: (!t.limiteSure && t.limite) || null, limiteDuTransporteur: !!(t.limiteSure && t.limite),
    limiteAt: (t.limiteSure && t.limite && t.limiteAt) || null,
    viaTransporteur: true, synthetique: true, transp: t, ...(luMs != null && maintenant - luMs < DISPO_LEVE_GARDE_MS ? { transpDispoLu: luMs } : {}) };
}
// (29 oct.) La ligne d'un n° SANS e-mail « disponible » (n° ajouté à la main,
// e-mail resté « en transit ») que le transporteur dit REPARTI ou en INCIDENT :
// elle ne sert qu'à le MONTRER (« repartis », « à vérifier ») — un colis qui
// sort de « à retirer » atterrit dans un autre bloc, jamais nulle part.
export function ligneDeSuiviTransporteur(t) {
  if (!t || !t.suivi || !t.etat) return null;
  return { id: `transp:${t.carrier}:${t.suivi}`, suivi: t.suivi, carrier: t.carrier, status: 'transit', statusLabel: '', subject: '',
    receivedAt: t.etatAt || t.lu || null, sens: 'entrant', lieu: lieuTransp(t) || null, viaTransporteur: true, synthetique: true, transp: t };
}
// La garde levée par une lecture « disponible » récente (une ligne fusionnée).
// `e` : le résultat de `etatRetrait`. Une date limite lue et dépassée n'est
// JAMAIS levée.
// ⚠️ (29 oct.) Ni une limite DÉDUITE (« vers le », `limiteVers`) déjà passée :
// une lecture « disponible » qui la porte est périmée ou contradictoire (le
// Mondial Relay « 5 jours restants » le 18, « en route » le 21, lu le 24).
export function leverGarde(e, l, maintenant = Date.now(), aujourdhui = null) {
  if (!e || e.etat !== 'trop_long' || !l || !Number.isFinite(l.transpDispoLu)) return e;
  if (maintenant - l.transpDispoLu >= DISPO_LEVE_GARDE_MS) return e;
  if (l.limiteVers) { const j = joursAvantLimite(l.limiteVers, aujourdhui || jourParis(maintenant)); if (j == null || j < 0) return e; }
  return { ...e, etat: 'a_retirer', gardeLevee: true };
}
// (29 oct., tour 2 n° 14) UNE LIGNE D'E-MAIL SE JUGE SUR SON ARRIVÉE, SELON SA
// SÛRETÉ — la règle des achats Vinted (n° 1 du tour 1), pour toutes les lignes :
// une arrivée SÛRE (l'e-mail d'arrivée, `arriveLe`) est l'arrivée ; une date tirée
// d'un « TR : », d'un rappel ou d'un sujet inconnu n'est qu'une BORNE (le colis
// était déjà là) — un retour ou un départ du point relais avant elle compte. Avant,
// l'app et le rappel du matin prenaient la borne pour l'arrivée : un colis
// reparti restait « à retirer » (le widget, lui, le sortait — deux nombres).
// L'arrivée passée en 3e argument est IGNORÉE (la règle la calcule elle-même :
// un propriétaire, §11).
export function arriveesDeLigne(l) {
  if (!l) return { arrivee: null, borne: null };
  const v = (a, b) => (l[a] != null ? l[a] : l[b]);
  const a = arriveeColisEmail({ arriveLe: v('arriveLe', 'a'), status: v('status', 's'), receivedAt: v('receivedAt', 'r'), subject: v('subject', 'sj') });
  return { arrivee: a && a.sur === 'oui' ? a.ms : null, borne: a ? a.ms : null };
}
export const sortiParSuivi = (ligne, fins) => { const a = arriveesDeLigne(ligne); return sortiParSuivis([suiviDeLigne(ligne)], fins, a.arrivee, { borne: a.borne }); };
export const incidentDeLigne = (ligne, fins) => { const a = arriveesDeLigne(ligne); return incidentDeSuivis([suiviDeLigne(ligne)], fins, a.arrivee, { borne: a.borne }); };

// ── LE TRANSPORTEUR D'UN N° TAPÉ À LA MAIN : PAR SA FORME ────────────────────
// Mesuré sur ses 193 n° : 8 chiffres = Mondial Relay (117) ; « VGS… » = Vinted
// Go. Le reste est AMBIGU (14 chiffres : Chronopost 16 fois, Vinted Go 8, DPD 1 ;
// 16 chiffres : Vinted Go) ⇒ null : on DEMANDE, on ne devine pas.
// ⚠️ (6 nov.) « 2 LETTRES + 9 CHIFFRES + 2 LETTRES » N'EST PAS CHRONOPOST : c'est la
//    forme POSTALE INTERNATIONALE (UPU S10), dont les deux dernières lettres disent
//    le PAYS. Mesuré sur sa base : l'achat au n° « CP…IE » (An Post, Irlande, lu par
//    Vinted sans transporteur nommé) s'affichait « Chronopost » au Tabavap — Julien
//    l'a pris pour son colis Mondial Relay du même point. Ses vrais n° Chronopost
//    (50 lignes, toutes venues d'un e-mail ou d'une lecture Chronopost) ont la forme
//    PROPRE à Chronopost « XW/ZW + 9 chiffres + TS/SP » (TS et SP ne sont pas des
//    pays) : seule celle-là nomme Chronopost. Un S10 d'un pays ≠ France ⇒ « Colis
//    international (<pays>) » (`colisInternational`), jamais un transporteur ; un
//    S10 « …FR » ⇒ rien (La Poste ou Chronopost : on ne choisit pas).
export const FORME_CHRONOPOST_PROPRE = /^[XZ]W\d{9}(?:TS|SP)$/;
export const PAYS_S10 = Object.freeze({ FR: 'France', IE: 'Irlande', GB: 'Royaume-Uni', DE: 'Allemagne', ES: 'Espagne', IT: 'Italie', BE: 'Belgique', NL: 'Pays-Bas', PT: 'Portugal', LU: 'Luxembourg', AT: 'Autriche', PL: 'Pologne', CH: 'Suisse', SE: 'Suède', DK: 'Danemark', FI: 'Finlande', CZ: 'Tchéquie', SK: 'Slovaquie', SI: 'Slovénie', HU: 'Hongrie', RO: 'Roumanie', BG: 'Bulgarie', GR: 'Grèce', HR: 'Croatie', LT: 'Lituanie', LV: 'Lettonie', EE: 'Estonie', CY: 'Chypre', MT: 'Malte', MC: 'Monaco', US: 'États-Unis', CA: 'Canada', CN: 'Chine', JP: 'Japon', HK: 'Hong Kong' });
// Le PAYS d'un n° postal international (S10), quand ses deux dernières lettres en
// nomment un ; sinon null (« TS », « SP » de Chronopost ne sont pas des pays).
export function paysColisS10(n) {
  const m = /^[A-Z]{2}\d{9}([A-Z]{2})$/.exec(normaliserSuivi(n));
  return m && PAYS_S10[m[1]] ? m[1] : null;
}
// « Colis international (Irlande) » — LU dans le n° lui-même (son pays), jamais un
// transporteur. '' pour un n° français ou qui n'est pas un S10.
export function colisInternational(n) {
  const p = paysColisS10(n);
  return p && p !== 'FR' ? `Colis international (${PAYS_S10[p]})` : '';
}
export function transporteurDeForme(n) {
  const s = normaliserSuivi(n);
  if (/^\d{8}$/.test(s)) return 'mondialrelay';
  if (FORME_CHRONOPOST_PROPRE.test(s)) return 'chronopost';
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
// de l'e-mail, sinon le lieu gardé par la route, `extraitLieu`) — jamais deviné.
// Le code du siège de Mondial Relay (59650, dans le pied de ses e-mails) n'est
// jamais celui d'un point relais. Sinon ''.
export function codePostalLu(t) {
  const lieu = String((t && t.lieu) || '');
  for (const m of lieu.matchAll(/(?:^|[\s,])(\d{5})\s+[A-Za-zÀ-ÿ]/g)) if (m[1] !== CP_SIEGE_MR) return m[1];
  const ex = codesPostauxDe(t && (t.extraitLieu != null ? t.extraitLieu : t.el));
  return ex[0] || '';
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
  // (24 oct.) Vinted Go : sa page publique de suivi (mesurée en 200), plus une
  // recherche Google.
  if (/vinted/.test(tr)) return { url: `https://vintedgo.com/fr/tracking/${s}`, site: true, codePostal: '' };
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

// ── LA COMMANDE D'UN COLIS D'E-MAIL, PAR IDENTITÉ, CÔTÉ SERVEUR (revue n° 3) ─
// La même chose que l'app (`commandeDuColis` + `finCommandeAchat`), pour le
// rappel du matin, qui ne la connaissait que par la publication de l'app :
//   · le CODE de retrait lu dans la conversation Vinted (`panel_colis_relais`,
//     { tx: { code } }) — deux transactions au même code ⇒ personne ;
//   · le N° DE SUIVI d'un achat : la ligne de suivi Vinted relevée par
//     l'extension (`harvest_{uid}_suivi_{tx}`), ou un n° ajouté à la main et
//     relié à un achat par SON clic (`colis_suivi_*` avec `tx`).
// Jamais le titre, la date, le lieu ou l'adresse (§5).
// `relais`, `liens` : null = pas su. Rend les transactions reliées à CE colis
// (Set), ou null (pas su).
const normCode = (c) => codeLu(String(c == null ? '' : c).toUpperCase().replace(/\s+/g, ''));
export function txDuColis({ suivi = '', code = '' } = {}, relais, liens) {
  if (relais == null || !Array.isArray(liens)) return null;
  const out = new Set();
  const c = normCode(code);
  if (c) {
    const txs = Object.entries(relais || {}).filter(([, r]) => r && normCode(r.code) === c).map(([tx]) => String(tx));
    if (txs.length === 1) out.add(txs[0]);
  }
  const k = normaliserSuivi(suivi);
  if (k) for (const l of liens) if (l && l.tx && normaliserSuivi(l.suivi) === k) out.add(String(l.tx));
  return out;
}
// Les liens « n° de suivi ↔ transaction » lus en scalaires : une ligne de suivi
// Vinted dont la transaction contredit son identifiant ne relie rien (la règle
// de l'app) ; un n° ajouté à la main ne relie que s'il porte une transaction.
export function liensDesLignes(suivisVinted, suivisManuels) {
  if (!Array.isArray(suivisVinted) || !Array.isArray(suivisManuels)) return null;
  const out = [];
  for (const r of suivisVinted) {
    const m = /^harvest_(\w+?)_suivi_(\w+)$/.exec(String((r && r.id) || '')); if (!m) continue;
    if (r.tx && String(r.tx) !== m[2]) continue;
    if (normaliserSuivi(r.suivi)) out.push({ uid: m[1], tx: m[2], suivi: normaliserSuivi(r.suivi) });
  }
  for (const r of suivisManuels) if (r && r.tx && normaliserSuivi(r.suivi)) out.push({ uid: r.uid ? String(r.uid) : '', tx: String(r.tx), suivi: normaliserSuivi(r.suivi) });
  return out;
}
// Ce que les commandes disent de ces transactions : 'retire' · 'reparti' · null
// (rien de terminal) · undefined (pas su). `achats` = les lignes
// `harvest_{uid}_orders_purchased` projetées ({ orders, txns, … }) ; `etats` =
// Map(tx → { s, ss }) des transactions. Une commande introuvable ne dit que ce
// que dit sa transaction.
export function finDesTransactions(txs, achats, etats) {
  if (!txs || !txs.size) return null;
  if (!Array.isArray(achats) || !(etats instanceof Map)) return undefined;
  for (const tx of txs) {
    let o = null, auRelais = false;
    for (const row of achats) {
      const ord = Array.isArray(row && row.orders) ? row.orders.find((x) => x && String(x.transaction_id) === tx) : null;
      if (!ord) continue;
      o = ord; auRelais = Array.isArray(row.txns) ? row.txns.map(String).includes(tx) : false;
      break;
    }
    const f = finDeCommandeAchat({ statut: o ? o.status : '', etat: etats.get(tx) || null, auRelais });
    if (f) return f;
  }
  return null;
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
// (29 oct.) + les n° que le TRANSPORTEUR SEUL dit disponibles (aucune ligne
// d'e-mail de ce n° : ajouté à la main, relevé chez Vinted) — la MÊME ligne
// synthétique que l'app (`ligneDuTransporteur`), la même identité (le n°), la
// même clé anti-doublon. Avant, l'app l'affichait avec sa limite et le matin
// ne disait rien. Un tel colis coché « Je l'ai retiré » sur sa COMMANDE
// (`cocheTx` : `vinted_pickup_done`, relié par `liens` — une identité) est
// sauté, comme dans l'app.
// (10 nov., lot AT) `jourCible` : 0 = le rappel du matin (« dernier jour » aujourd'hui, « à vérifier ») ;
// 1 = le résumé du soir (« demain » : la date limite LUE dans l'e-mail tombe demain — jamais
// une garde estimée, jamais « à vérifier »). La même règle, un autre jour.
export function rappelsRetraitDuJour({ lignes = [], collectes = [], envoyes = [], finis = [], maintenant = Date.now(), aujourdhui = null, finParCommande = null, transp = null, cocheTx = null, liens = null, jourCible = 0 } = {}) {
  const cible = jourCible === 1 ? 1 : 0;
  // (revue du 23 oct., n° 2) Chaque ligne relue avec la règle de l'app : un
  // colis « en transit » pour l'app ne reçoit jamais « à vérifier — va le
  // chercher » le matin.
  // (24 oct.) Et le statut lu chez le TRANSPORTEUR (lignes `transp_`, la règle
  // de l'app) : un colis retiré ou reparti chez lui ne reçoit aucun rappel, une
  // lecture « disponible » de moins de 6 h ne fait pas dire « à vérifier ».
  // (8 nov., retraits) Deux lignes pour un n° : la préférée (`indexTranspParSuivi`), la règle de l'app.
  const tMap = indexTranspParSuivi(transp);
  lignes = (Array.isArray(lignes) ? lignes : []).map((l) => relireLigneMeta(l)).map((l) => { const k = suiviDeLigne(l); const t = k ? tMap.get(k) : null; return t ? fusionTransporteur(l, t, maintenant) : l; });
  const envoyesN = new Set((envoyes || []).map(normaliserSuivi).filter(Boolean));
  const cocheN = new Set();
  if (cocheTx && Array.isArray(liens)) for (const x of liens) if (x && x.tx && cocheTx.has(String(x.tx))) { const k = normaliserSuivi(x.suivi); if (k) cocheN.add(k); }
  { const nLignes = new Set(lignes.map(suiviDeLigne).filter(Boolean));
    for (const [k, t] of tMap) {
      if (nLignes.has(k) || envoyesN.has(k) || cocheN.has(k)) continue;
      const syn = ligneDuTransporteur(t, maintenant); if (syn) lignes.push(syn);
    } }
  const fins = finsDesLignes(lignes, { estSortant: (l) => (l.sens != null ? l.sens : l.se) === 'sortant' || envoyesN.has(suiviDeLigne(l)), transp: Array.isArray(transp) ? transp : [...tMap.values()] });   // les fins : TOUTES les lignes (un « retiré » gagne)
  const coches = new Set((collectes || []).map((c) => String(c || '').trim()));
  const cochesN = new Set((collectes || []).map(normaliserSuivi).filter(Boolean));
  const finisS = new Set((finis || []).map(String));
  const out = [], vus = new Set();
  for (const l of (Array.isArray(lignes) ? lignes : [])) {
    if (!l) continue;
    const st = l.status != null ? l.status : l.s;
    if (st !== 'available' || finDeLigne(l)) continue;
    if ((l.sens != null ? l.sens : l.se) === 'sortant') continue;
    // (6 nov.) Le transporteur le dit « en route » APRÈS son arrivée (`fusionTransporteur`, règle
    // datée) : l'app le range « à vérifier » — aucun « dernier jour » ne part pour lui.
    if (l.transpContradiction) continue;
    const k = suiviDeLigne(l); if (!k || vus.has(k)) continue;
    if (envoyesN.has(k)) continue;
    const brut = String((l.suivi != null ? l.suivi : l.su) || (l.subject != null ? l.subject : l.sj) || '').trim();
    if (coches.has(brut) || cochesN.has(k)) continue;
    if (finisS.has('e:' + k)) continue;
    const arr = arriveeColisEmail({ arriveLe: l.arriveLe != null ? l.arriveLe : l.a, status: 'available', receivedAt: l.receivedAt != null ? l.receivedAt : l.r, subject: l.subject != null ? l.subject : l.sj });
    const arriveeMs = arr ? arr.ms : null;
    // (tour 2 n° 14) Une borne n'est jamais une arrivée : la règle de l'app.
    if (sortiParSuivis([k], fins, arr && arr.sur === 'oui' ? arr.ms : null, { borne: arriveeMs })) continue;
    // (revue du 23 oct., n° 3) La commande reliée par IDENTITÉ (code de retrait,
    // n° de suivi) dit-elle le colis fini ? `finParCommande` rend 'retire',
    // 'reparti', null (rien de terminal) ou undefined (pas su) — « pas su » ne
    // vaut pas « pas fini » : rien ne part pour ce colis.
    if (typeof finParCommande === 'function') {
      const f = finParCommande({ suivi: k, code: l.code != null ? l.code : l.co });
      if (f === undefined || f) continue;
    }
    const limite = (l.limite != null ? l.limite : l.l) || null;
    const limiteAt = l.limiteAt || null;
    const transporteur = (l.carrier != null ? l.carrier : l.c) || '';
    const e = leverGarde(etatRetrait({ limite, arriveeMs, transporteur, limiteAt }, maintenant, aujourdhui), l, maintenant, aujourdhui);
    let etat = null;
    if (e.etat === 'a_retirer' && limite && e.jours === cible) etat = cible ? 'demain' : 'dernier';
    else if (cible) etat = null;
    else if (e.etat === 'delai_depasse' && e.jours >= -(1 + RATTRAPAGE_J)) etat = 'a_verifier';
    else if (e.etat === 'trop_long' && Number.isFinite(e.age) && e.age <= e.garde + 1 + RATTRAPAGE_J) etat = 'a_verifier';
    if (!etat) continue;
    vus.add(k);
    out.push({ cle: `${etat}-${k}`, etat, suivi: k, transporteur, limite, limiteAt: e.limiteAt || null, heurePassee: !!e.heurePassee, lieu: (l.lieu != null ? l.lieu : '') || '', raison: e.etat, garde: e.garde, code: (l.code != null ? l.code : l.co) || '', synthetique: !!l.synthetique, article: String(l.artTitle || '').trim().slice(0, 60) });
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
  // (29 oct.) L'heure de la limite quand le transporteur la donne (Vinted Go) :
  // « à retirer aujourd'hui avant 11 h 34 » — un colis qui expire à 11 h 34 ne
  // se dit pas « aujourd'hui » sans l'heure.
  const heure = x.limiteAt ? heureParis(x.limiteAt) : '';
  // (13 nov., Julien : « tu peux peut-être faire des rappels ») La veille ET le jour même, UN rappel par colis :
  // le titre porte le NOM DE L'ARTICLE quand l'e-mail de CE colis le donne (identité : sa ligne), sinon « Colis
  // {transporteur} » ; le corps : le point, le code, le n°. La date limite est toujours LUE (jamais estimée).
  if (x.etat === 'dernier' || x.etat === 'demain') {
    const quoi = x.article || `Colis ${nom}`;
    const code = String(x.code || '').trim();
    const quand = x.etat === 'demain' ? `À retirer demain${heure ? ` avant ${heure}` : ''}` : `À retirer aujourd'hui${heure ? ` avant ${heure}` : ''}`;
    return {
      title: `📍 ${x.etat === 'demain' ? 'Demain dernier jour' : 'Dernier jour'} · ${quoi}`,
      body: [quand, lieu, code ? `code ${code}` : '', `${nom} n°${x.suivi}`].filter(Boolean).join(' · '),
    };
  }
  // ⚠️ (29 oct.) « Sans doute reparti » ne s'écrit plus : un délai dépassé ne
  // prouve rien (mesuré le 29 : 5 colis dits « sans doute repartis » sur 5
  // avaient été RETIRÉS). Seul le transporteur ou Vinted dit « reparti ».
  const raison = x.raison === 'delai_depasse'
    ? (x.heurePassee && heure ? `délai de retrait passé (aujourd'hui à ${heure})` : `délai de retrait dépassé${jjmm(x.limite) ? ` (le ${jjmm(x.limite)})` : ''}`)
    : `au point relais depuis plus de ${Number.isFinite(x.garde) ? x.garde : 7} jours`;
  return {
    title: `Colis à vérifier : n°${x.suivi}`,
    body: `${nom}${lieu ? ` · ${lieu}` : ''} : ${raison}. S'il est encore là, va le chercher ; s'il n'y est plus, le suivi du transporteur et la conversation Vinted disent s'il a été retiré ou s'il est reparti.`,
  };
}
