// ─────────────────────────────────────────────────────────────────────────────
// LE DÉPART D'UN COLIS VENDU, PROUVÉ CHEZ SON TRANSPORTEUR (8 nov.) — la RÈGLE,
// pure. Aucune lecture réseau, aucune écriture : importée par le serveur
// (api/_lib/transporteurs-lecture.js lit, api/widget.js et api/ship-reminders.js
// comptent) et par l'app (Colis, Ma journée, la cloche `vrm_colis_aposter`), §11.
//
// Julien (8 nov.) : « J'ai une commande qui est marquée comme non envoyée car je
// n'ai pas réactualisé Vestiaire Collective, mais tu as le numéro de suivi donc
// tu peux très bien regarder le statut du colis et voir qu'il a été expédié. Je
// te laisse faire ça pour tous les colis, comme ça il n'y a plus d'erreur. »
//
// LA RÈGLE
//  · Une vente « à envoyer » dont le n° de suivi EXACT (son identité — jamais le
//    titre, la marque, la taille) a une lecture chez le transporteur qui PROUVE la
//    prise en charge passe en « parti » : un état DÉDUIT, recalculé à chaque
//    affichage — rien n'est écrit dans les données du site (aucun faux « Colis
//    fait »).
//  · Prouve la prise en charge : « en route » (sauf « étiquette créée / en
//    préparation » : `detail: 'prepare'`), « disponible au point », « retiré »,
//    « livré », « repart chez l'expéditeur », « a quitté le point relais ». NE
//    prouve RIEN : « inconnu », « incident » (perdu, annulé…), « introuvable »,
//    une lecture ratée. « Pas su » ne vaut pas « oui » : pas de lecture ⇒ rien ne
//    change.
//  · Une fois prouvée (`priseAt`), la prise en charge reste : une lecture plus
//    pauvre ensuite ne la fait pas reculer, et le n° n'est plus relu.
//  · Une prise en charge datée AVANT la vente (au-delà d'un jour de tolérance)
//    contredit l'identité ⇒ rien (mieux vaut un blanc qu'un faux).
//  · Un n° porté par DEUX ventes, ou aussi par un ACHAT, est ambigu ⇒ ni lu
//    comme départ, ni preuve.
//
// ⚠️ LE CLOISONNEMENT (la protection de « à retirer ») : ces lectures vivent dans
//    des lignes À PART, `depart_{transporteur}_{n°}` — jamais `transp_…`. Aucun
//    lecteur de « à retirer », du widget, du rappel du matin ni des notifications
//    ne les lit (`ligneTranspDeMeta` n'accepte que `transp_`). Un colis VENDU
//    arrivé au point relais est celui de l'ACHETEUR : il ne devient JAMAIS « à
//    retirer » chez Julien, et rien ne sonne.
//    (23 nov.) Seule exception, voulue par Julien : la famille « Colis en danger »
//    (api/_lib/colis-danger.js) prévient le VENDEUR quand le colis de son acheteur
//    va repartir du point — jamais « à retirer », jamais un code de retrait.
//
// QUI EST LU (mesuré dans le code, 8 nov. — voir docs/passation/2026-11-08-colis-sortants.md) :
//  · Chronopost (Vestiaire écrit « Chronopost » et dépose un bordereau Chronopost
//    TCPDF ; les bordereaux Vinted par e-mail portent tous un n° Chronopost
//    strict) : lu par le serveur, n° seul ;
//  · Vinted Go : lu par le serveur, n° seul ;
//  · Mondial Relay : sa seule route lisible exige un code postal. (16 nov., lot
//    transporteurs-suivi) VRM ne le devine JAMAIS : il le LIT sur SON étiquette
//    (le PDF du bordereau de CETTE transaction — une identité, §5 — `cpsDeLEtiquette`),
//    l'essaie, et ne le garde que si la route de Mondial Relay renvoie l'ÉCHO de
//    CE n° à CE code postal (`lireReponseMondialRelayMvc`). Un code postal refusé
//    est noté et jamais réessayé ; aucun code postal sur l'étiquette ⇒ aucune
//    requête, et Ventes le dit. Le texte du PDF n'est jamais gardé : seuls les
//    codes postaux essayés (`cpsPdf`) et celui que l'écho a prouvé (`cp`) ;
//  · Colissimo, UPS, DHL, DPD, GLS, Relais Colis… : pas lus chez le transporteur (16 nov., décision de
//    Julien : aucun suivi par clé ; Vinted et les e-mails font foi).
// ─────────────────────────────────────────────────────────────────────────────
import { normaliserSuivi } from './etat-colis-email.js';
import { carrierLisible, nomTransporteur, RECUL_MS, INTROUVABLE_MS, INTROUVABLE_MAX, RESULTATS, ETATS, CP_SIEGE_MR, classeMr } from './transporteurs.js';
import { etapeMotVc } from './vestiaire-regle.js';

// (16 nov.) + Mondial Relay (code postal lu sur l'étiquette, prouvé par l'écho).
export const DEPART_CARRIERS = ['chronopost', 'vinted', 'mondialrelay'];
const RE_ID_DEPART = /^depart_(chronopost|vinted|mondialrelay)_([A-Z0-9]+)$/;
export const cleDepart = (carrier, suivi) => `depart_${carrier}_${normaliserSuivi(suivi)}`;
// (11 nov., suivi des commandes) + le DERNIER évènement lu (libellé, lieu, date)
// et le lieu du point : ce que Ventes affiche (« Pris en charge · Vannes · hier 18:02 »).
export const SELECT_DEPART_META = 'id,suivi:meta->>suivi,carrier:meta->>carrier,etat:meta->>etat,detail:meta->>detail,etatAt:meta->>etatAt,priseAt:meta->>priseAt,arriveeAt:meta->>arriveeAt,lu:meta->>lu,essai:meta->>essai,essaiRes:meta->>essaiRes,essais:meta->>essais,fini:meta->>fini,clos:meta->>clos,derLib:meta->>derLib,derLieu:meta->>derLieu,derAt:meta->>derAt,lieuNom:meta->>lieuNom,lieuVille:meta->>lieuVille,cp:meta->>cp,cpsPdf:meta->>cpsPdf,cpsRefuses:meta->>cpsRefuses,cpsLu:meta->>cpsLu,limite:meta->>limite,limiteAt:meta->>limiteAt,limiteSure:meta->>limiteSure';
// (23 nov., « Colis en danger ») Un colis VENDU au point relais de l'acheteur : la date où il REPART, LUE chez
// le transporteur (Vinted Go `expiration_time`, `limiteSure`) — jamais estimée. Tant qu'elle est connue, le colis
// est relu plus souvent (le vendeur doit savoir s'il est retiré avant d'être prévenu) : api/_lib/colis-danger.js.
export const RYTHME_DANGER_MS = 2 * 3600000;
export const limiteDepartLue = (t) => !!t && t.carrier === 'vinted' && t.etat === 'disponible' && (t.limiteSure === true || t.limiteSure === 'true') && msDe(t.limiteAt) != null;
// Le rythme : une lecture toutes les 2 h tant que le colis n'est pas pris en
// charge ; un échec recule (30 min → 6 h) ; « introuvable » 3 fois ⇒ on arrête.
export const RYTHME_DEPART_MS = 2 * 3600000;
// (11 nov., suivi des commandes) Julien : « intègre les numéros de suivi sur les
// commandes en cours […] pour voir la cohérence ». Une fois PRIS EN CHARGE, le
// colis vendu reste lu jusqu'à la fin (livré, retiré par l'acheteur, rendu) —
// plus lentement : toutes les 6 h, APRÈS les colis pas encore pris en charge
// (ceux qui ont une date limite d'envoi). La preuve de départ ne change pas.
export const RYTHME_SUIVI_MS = 6 * 3600000;
// La fin du suivi d'un colis vendu : il est arrivé (livré, retiré) ou rendu.
export const etatFinalDepart = (t) => !!t && (t.etat === 'livre' || t.etat === 'retire' || (t.etat === 'retour_expediteur' && t.detail === 'rendu'));
// Une vente n'est lue comme départ que dans les 21 jours après sa vente (ou son
// bordereau) : au-delà, c'est un colis à regarder à la main, pas à relire.
export const FENETRE_DEPART_J = 21;
export const TOLERANCE_AVANT_VENTE_MS = 24 * 3600000;

const msDe = (v) => { if (Number.isFinite(v)) return v; const x = Date.parse(String(v || '')); return Number.isFinite(x) ? x : null; };
const isoDe = (ms) => (Number.isFinite(ms) ? new Date(ms).toISOString() : null);

// Le transporteur LISIBLE comme départ d'un n° : celui qu'écrit la plateforme,
// sinon la forme PROPRE du n° (Chronopost XW/ZW…TS/SP, Vinted Go VGS…). Mondial
// Relay, Colissimo… ⇒ null (voir l'en-tête).
// (24 nov., lot suivi-xu) + Chrono Relais Europe « XU/ZU + 9 chiffres + JF ». MESURÉ (lecture seule) sur
// les bordereaux de vente des 60 derniers jours : 14 n° de cette forme (13 XU, 1 ZU), aucun lu chez le
// transporteur — `nomDuBordereau` ne garde pas le nom « chronopost » et la forme XU n'était pas reconnue.
// Toutes les étiquettes de cette forme dont le PDF a été lu (5 sur 5, et le bordereau de retour du 15 nov.)
// nomment Chronopost (« Chrono Relais Europe », pied « Chronopost … 75014 Paris ») ; leur PDF est le MÊME
// gabarit que les XW…TS (iText). « JF » n'est pas un pays : ce n'est pas un n° postal S10 (CP…IE).
// La lecture reste celle des XW : `trackSkybillV2`, écho du `skybillNumber` exigé, un n° inconnu ⇒
// « introuvable » (3 fois au plus, puis plus jamais relu) — rien n'est jamais déduit de la forme seule.
export const FORME_CHRONO_RELAIS_EUROPE = /^[XZ]U\d{9}JF$/;
// (25 nov.) Cette forme vaut pour un colis VENDU seulement : un bordereau de RETOUR (`rt:`, le colis qu'il
// renvoie) n'est lu chez Chronopost qu'avec le transporteur LU sur son étiquette (`transporteurPdf`, lot
// retour-parfait, audit-retour-parfait T3) — la forme seule ne lui suffit pas.
function formeDepart(n, { vente = false } = {}) {
  if (/^[XZ]W\d{9}(?:TS|SP)$/.test(n)) return 'chronopost';
  if (vente && FORME_CHRONO_RELAIS_EUROPE.test(n)) return 'chronopost';
  if (/^VGS\d{13}$/.test(n)) return 'vinted';
  return '';
}
export function carrierDepart(transporteur, suivi, { vente = false } = {}) {
  const n = normaliserSuivi(suivi);
  if (!n) return null;
  const c = carrierLisible(transporteur || '', n) || carrierLisible(formeDepart(n, { vente }), n);
  return c && DEPART_CARRIERS.includes(c) ? c : null;
}

// ── CE QU'UNE LECTURE PROUVE ────────────────────────────────────────────────
// `lu` : le rendu d'un analyseur (api/_lib/transporteurs.js, `lireReponse`).
// Rend la date de prise en charge (ms) — le PREMIER évènement après l'étiquette
// quand on le reconnaît, sinon la date de l'état — ou null (rien de prouvé).
const CP_PAS_DEPART = new Set(['DC', 'SM']);
const VG_PAS_DEPART = new Set(['created']);
export function priseEnCharge(lu, carrier) {
  if (!lu || lu.res !== 'ok' || !ETATS.includes(lu.etat)) return null;
  const e = lu.etat;
  const prouve = (e === 'en_route' && lu.detail !== 'prepare') || e === 'disponible' || e === 'retire' || e === 'livre' || e === 'retour_expediteur' || (e === 'incident' && lu.detail === 'quitte_relais');
  if (!prouve) return null;
  const evs = Array.isArray(lu.evenements) ? lu.evenements : [];
  // (16 nov.) Mondial Relay n'a pas de code : son LIBELLÉ mesuré (`classeMr`, hors « en préparation chez
  // l'expéditeur »).
  const premier = evs.find((x) => x && msDe(x.at) != null && (carrier === 'mondialrelay' ? ['route', 'disponible', 'livre'].includes((classeMr(x.libelle) || {}).c)
    : x.code && (carrier === 'chronopost' ? !CP_PAS_DEPART.has(String(x.code).toUpperCase()) : carrier === 'vinted' ? !VG_PAS_DEPART.has(String(x.code)) : false)));
  const at = premier ? msDe(premier.at) : msDe(lu.etatAt);
  return at != null ? at : null;
}

// ── LA LIGNE `depart_{carrier}_{n°}` APRÈS UN ESSAI ─────────────────────────
// Une lecture qui échoue ne change rien que l'essai. Une prise en charge prouvée
// (`priseAt`) ne s'efface jamais ; elle ferme le n° (`fini`).
export function ligneDepartApresEssai(avant, lu, { carrier, suivi, maintenant = Date.now(), source = 'serveur', cp = '' } = {}) {
  const a = avant && typeof avant === 'object' ? avant : {};
  const iso = new Date(maintenant).toISOString();
  const res = RESULTATS.includes(lu && lu.res) ? lu.res : 'passu';
  const out = { ...a, v: 1, sens: 'sortant', suivi: normaliserSuivi(suivi), carrier, essai: iso, essaiRes: res, essaiSource: source };
  delete out.rev; delete out.enVol;
  if (res === 'ok') {
    out.essais = 0;
    out.etat = ETATS.includes(lu.etat) ? lu.etat : 'inconnu';
    out.detail = lu.detail || null;
    out.etatAt = msDe(lu.etatAt) != null ? isoDe(msDe(lu.etatAt)) : null;
    out.libelle = String(lu.libelle || '').slice(0, 160);
    out.lu = iso;
    const p = priseEnCharge(lu, carrier);
    if (p != null && msDe(a.priseAt) == null) out.priseAt = isoDe(p);
    // (21 nov., lot transp-depenses — « dépôt → livraison ») L'ARRIVÉE chez l'acheteur (au point, ou livré) est GARDÉE une
    // fois lue : quand l'acheteur retire le colis, `etatAt` devient la date du retrait et l'arrivée était perdue. Posée par
    // la première lecture qui la prouve, jamais remplacée ni effacée (comme `priseAt`).
    if ((out.etat === 'disponible' || out.etat === 'livre') && msDe(out.etatAt) != null && msDe(a.arriveeAt) == null) out.arriveeAt = out.etatAt;
    // (23 nov., « Colis en danger ») La date où le colis REPART du point : seulement LUE (Vinted Go
    // `expiration_time`, `limiteSure`) et seulement tant qu'il y attend. Un autre état, ou une date estimée
    // (`limiteSure: false`), l'efface : « pas su » ⇒ aucune alerte.
    if (carrier === 'vinted' && out.etat === 'disponible' && lu.limiteSure === true && msDe(lu.limiteAt) != null) {
      out.limiteAt = isoDe(msDe(lu.limiteAt)); out.limite = /^\d{4}-\d{2}-\d{2}$/.test(String(lu.limite || '')) ? String(lu.limite) : null; out.limiteSure = true;
    } else { delete out.limite; delete out.limiteAt; delete out.limiteSure; }
    // (11 nov.) Le DERNIER évènement lu (le plus récent) : libellé, lieu, date —
    // recopiés tels quels, bornés. Le lieu du point quand l'analyseur le porte.
    const evs = Array.isArray(lu.evenements) ? lu.evenements.filter((x) => x && msDe(x.at) != null) : [];
    const der = evs.length ? evs.reduce((m, x) => (msDe(x.at) >= msDe(m.at) ? x : m), evs[0]) : null;
    out.derLib = der ? String(der.libelle || '').slice(0, 120) : out.libelle;
    out.derLieu = der ? String(der.lieu || '').slice(0, 80) : '';
    out.derAt = der ? isoDe(msDe(der.at)) : out.etatAt;
    out.lieuNom = String(lu.lieuNom || '').slice(0, 60);
    out.lieuVille = String(lu.lieuVille || '').slice(0, 40);
    // (16 nov.) Mondial Relay : le code postal que l'ÉCHO vient de prouver pour CE n° (le seul gardé comme tel).
    if (carrier === 'mondialrelay' && /^\d{5}$/.test(String(cp || ''))) out.cp = String(cp);
  } else {
    out.essais = (Number(a.essais) || 0) + 1;
    // (16 nov.) Un code postal de l'étiquette que Mondial Relay refuse pour ce n° : noté, jamais réessayé.
    if (res === 'cp-inconnu' && /^\d{5}$/.test(String(lu && lu.cpRefuse || ''))) out.cpsRefuses = listeCp([...listeCp(a.cpsRefuses), lu.cpRefuse]).join(',');
  }
  // `fini` (8 nov.) : la PREUVE de départ est acquise ou le n° est mort — gardé
  // tel quel pour les lecteurs d'avant. `clos` (11 nov.) : le SUIVI est fini
  // (arrivé, rendu, n° mort) — plus aucune lecture.
  const mort = res === 'expire' || (res === 'introuvable' && (Number(out.essais) || 0) >= INTROUVABLE_MAX);
  out.fini = msDe(out.priseAt) != null || mort;
  out.clos = mort || (a.clos === true && msDe(out.priseAt) != null) || etatFinalDepart(out);
  return out;
}

// Les scalaires d'une ligne lue (§4.4 : jamais `select=data`). Une ligne qui
// contredit son identifiant ne compte pas.
export function departDeMeta(x) {
  if (!x || typeof x !== 'object') return null;
  const m = RE_ID_DEPART.exec(String(x.id || ''));
  if (!m) return null;
  const suivi = normaliserSuivi(x.suivi) || m[2];
  if (suivi !== m[2] || (x.carrier && x.carrier !== m[1])) return null;
  return {
    id: x.id, suivi, carrier: m[1], etat: ETATS.includes(x.etat) ? x.etat : null, detail: x.detail || null,
    etatAt: msDe(x.etatAt) != null ? isoDe(msDe(x.etatAt)) : null, priseAt: msDe(x.priseAt) != null ? isoDe(msDe(x.priseAt)) : null,
    arriveeAt: msDe(x.arriveeAt) != null ? isoDe(msDe(x.arriveeAt)) : null,
    lu: x.lu || null, essai: x.essai || null, essaiRes: RESULTATS.includes(x.essaiRes) ? x.essaiRes : null, essais: Number(x.essais) || 0,
    fini: x.fini === true || x.fini === 'true',
    clos: x.clos === true || x.clos === 'true',
    derLib: x.derLib ? String(x.derLib).slice(0, 120) : '', derLieu: x.derLieu ? String(x.derLieu).slice(0, 80) : '',
    derAt: msDe(x.derAt) != null ? isoDe(msDe(x.derAt)) : null,
    lieuNom: x.lieuNom ? String(x.lieuNom).slice(0, 60) : '', lieuVille: x.lieuVille ? String(x.lieuVille).slice(0, 40) : '',
    cp: /^\d{5}$/.test(String(x.cp || '')) ? String(x.cp) : '', cpsPdf: listeCp(x.cpsPdf).join(','), cpsRefuses: listeCp(x.cpsRefuses).join(','), cpsLu: x.cpsLu || null,
    // (23 nov.) La date où il repart, LUE (Vinted Go seulement) ; sinon rien.
    limite: /^\d{4}-\d{2}-\d{2}$/.test(String(x.limite || '')) ? String(x.limite) : null,
    limiteAt: msDe(x.limiteAt) != null ? isoDe(msDe(x.limiteAt)) : null,
    limiteSure: x.limiteSure === true || x.limiteSure === 'true',
  };
}

// ── (16 nov.) MONDIAL RELAY : LE CODE POSTAL LU SUR SON ÉTIQUETTE ───────────
// Une liste de codes postaux (« 35260,75011 » ou un tableau) ⇒ tableau propre, sans doublon, borné.
export const CPS_ETIQUETTE_MAX = 4;
export function listeCp(v) {
  const l = Array.isArray(v) ? v : String(v == null ? '' : v).split(',');
  const out = [];
  for (const x of l) { const c = String(x == null ? '' : x).trim(); if (/^\d{5}$/.test(c) && !out.includes(c)) out.push(c); }
  return out.slice(0, 8);
}
// Les codes postaux écrits sur l'étiquette : 5 chiffres SUIVIS d'un nom de ville (« 35260 CANCALE »),
// jamais un morceau de code-barres (un nombre plus long), jamais le siège de Mondial Relay (59650), dans
// l'ordre de l'étiquette, `CPS_ETIQUETTE_MAX` au plus. Aucun n'est deviné : chacun ne vaudra que si
// Mondial Relay renvoie l'ÉCHO de ce n° à ce code postal.
export function cpsDeLEtiquette(texte) {
  const out = [];
  for (const m of String(texte == null ? '' : texte).matchAll(/(?:^|[^\d])(\d{5})(?!\d)[ \t\u00a0]*(?:\r?\n[ \t]*)?(?=[A-Za-zÀ-ÿ'’-]{2,})/g)) {
    if (m[1] === CP_SIEGE_MR || out.includes(m[1])) continue;
    out.push(m[1]);
    if (out.length >= CPS_ETIQUETTE_MAX) break;
  }
  return out;
}
// Le code postal à essayer pour un colis VENDU Mondial Relay : celui que l'écho a PROUVÉ, sinon le
// premier code de SON étiquette pas encore refusé. Rend { cp, source: 'lu' | 'etiquette' } ou null.
export function cpDepartMr(t) {
  if (!t) return null;
  if (/^\d{5}$/.test(String(t.cp || ''))) return { cp: String(t.cp), source: 'lu' };
  const refuses = listeCp(t.cpsRefuses);
  const c = listeCp(t.cpsPdf).find((x) => !refuses.includes(x));
  return c ? { cp: c, source: 'etiquette' } : null;
}
// Plus rien à essayer : l'étiquette a été lue (`cpsLu`) et chacun de ses codes refusé (ou aucun écrit).
export const mrSansCodePostal = (t) => !!t && !!t.cpsLu && !cpDepartMr(t);
// Le PDF de l'étiquette d'une vente (sa clé de sortant ⇒ la ligne qui porte le PDF, par SON n° de transaction).
export function idPdfDuSortant(cle) {
  const m = /^(vt|rt):(\d{3,20})$/.exec(String(cle || ''));
  if (!m) return null;
  return m[1] === 'vt' ? `email_bord_${m[2]}` : `email_bordretour_${m[2]}`;
}
// Map n° → ligne (une ligne par n° : deux transporteurs pour le même n° ⇒
// ambigu, aucun des deux ne compte).
export function departsParSuivi(rows) {
  if (!Array.isArray(rows)) return null;
  const m = new Map(), doubles = new Set();
  for (const r of rows) { const t = departDeMeta(r); if (!t) continue; if (m.has(t.suivi) && m.get(t.suivi).carrier !== t.carrier) doubles.add(t.suivi); else m.set(t.suivi, t); }
  for (const k of doubles) m.delete(k);
  return m;
}
const versMap = (departs) => (departs instanceof Map ? departs : (departs && typeof departs === 'object' ? new Map(Object.entries(departs)) : null));

// ── LA PREUVE DE DÉPART D'UNE VENTE ─────────────────────────────────────────
// `departs` : Map/objet n° → ligne (null/undefined ⇒ pas su ⇒ null).
// `venteMs` : la date de la vente (ou du bordereau) ; `ambigus` : les n° portés
// par plusieurs ventes ou par un achat.
// Rend { suivi, carrier, nom, at, phrase } ou null.
export function departProuve(suivi, departs, { venteMs = null, ambigus = null } = {}) {
  const k = normaliserSuivi(suivi);
  const m = versMap(departs);
  if (!k || !m) return null;
  if (ambigus && (ambigus instanceof Set ? ambigus.has(k) : Array.isArray(ambigus) && ambigus.includes(k))) return null;
  const t = m.get(k);
  if (!t || normaliserSuivi(t.suivi) !== k) return null;
  const at = msDe(t.priseAt);
  if (at == null) return null;
  const v = msDe(venteMs);
  if (v != null && at < v - TOLERANCE_AVANT_VENTE_MS) return null;
  return { suivi: k, carrier: t.carrier, nom: nomTransporteur(t.carrier), at, phrase: phraseDepart(t.carrier, at) };
}
const _fmtJour = (() => { try { return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short' }); } catch (_) { return null; } })();
export function jourCourtParis(ms) {
  if (!Number.isFinite(ms)) return '';
  try { return _fmtJour ? _fmtJour.format(new Date(ms)).replace(/ | /g, ' ') : new Date(ms).toISOString().slice(0, 10); } catch (_) { return new Date(ms).toISOString().slice(0, 10); }
}
// « Chronopost l’a pris en charge le 7 nov. » — la phrase vient de la même
// ligne que la preuve (§5).
export const phraseDepart = (carrier, at) => `${nomTransporteur(carrier)} l’a pris en charge le ${jourCourtParis(at)}`;

// Les n° AMBIGUS d'une liste de ventes : portés par deux ventes différentes, ou
// présents dans `entrants` (un achat). `ventes` : [{ cle, suivi }].
export function suivisAmbigus(ventes, entrants = null) {
  const par = new Map(), out = new Set();
  for (const v of ventes || []) { const k = normaliserSuivi(v && v.suivi); if (!k) continue; const c = String(v.cle == null ? '' : v.cle); if (par.has(k) && par.get(k) !== c) out.add(k); else par.set(k, c); }
  if (entrants) for (const k of par.keys()) if (entrants instanceof Set ? entrants.has(k) : false) out.add(k);
  return out;
}

// ── QUELS N° SORTANTS LIRE (le serveur) ─────────────────────────────────────
// `sortants` : [{ cle, suivi, transporteur, venteMs }] — les ventes ENCORE « à
// envoyer » portant un n° (Vestiaire), et les bordereaux Vinted récents ;
// `departs` : Map n° → ligne `depart_` ; `entrants` : Set des n° d'ACHATS (jamais
// lus ici : ils ont leur propre lecture, et un n° des deux côtés est ambigu).
// Rend [{ carrier, suivi }], `max` au plus, `parTransporteur` par transporteur.
export function prochainEssaiDepart(t) {
  if (!t) return 0;
  const pris = msDe(t.priseAt) != null;
  // (11 nov.) Pris en charge : relu toutes les 6 h jusqu'à la fin (`clos`, ou un
  // état final lu). Pas pris et `fini` (8 nov.) : le n° est mort (expiré,
  // introuvable) — plus lu.
  if (t.clos || etatFinalDepart(t) || (t.fini && !pris)) return Infinity;
  // (16 nov.) Mondial Relay sans code postal à essayer : aucune requête possible (rien n'est deviné).
  if (t.carrier === 'mondialrelay' && mrSansCodePostal(t)) return Infinity;
  const e = msDe(t.essai);
  if (e == null) return 0;
  const r = t.essaiRes;
  if (r === 'expire') return Infinity;
  if (r === 'introuvable') return (Number(t.essais) || 0) >= INTROUVABLE_MAX ? Infinity : e + INTROUVABLE_MS;
  if (r === 'passu' || r === 'bloque' || r === 'forme' || r === 'cp-inconnu') return e + RECUL_MS[Math.min(Math.max((Number(t.essais) || 1) - 1, 0), RECUL_MS.length - 1)];
  // (23 nov.) Au point relais de l'acheteur avec une date de départ LUE : relu toutes les 2 h.
  return e + (limiteDepartLue(t) ? RYTHME_DANGER_MS : pris ? RYTHME_SUIVI_MS : RYTHME_DEPART_MS);
}
export function departsAInterroger({ sortants = [], departs = new Map(), entrants = new Set(), maintenant = Date.now(), max = 3, parTransporteur = 3 } = {}) {
  const ambigus = suivisAmbigus(sortants, entrants);
  const vus = new Set(), items = [];
  for (const s of sortants || []) {
    const k = normaliserSuivi(s && s.suivi);
    if (!k || vus.has(k) || ambigus.has(k)) continue;
    vus.add(k);
    const carrier = carrierDepart(s.transporteur, k, { vente: !s.retour });
    if (!carrier) continue;
    const v = msDe(s.venteMs);
    if (v != null && maintenant - v > FENETRE_DEPART_J * 86400000) continue;
    const t = departs instanceof Map ? departs.get(k) : null;
    if (t && t.carrier && t.carrier !== carrier) continue;
    // (16 nov.) Mondial Relay sans code postal prouvé ni étiquette à lire (une vente Vestiaire, un bordereau sans
    // n° de transaction) : rien à essayer, jamais deviné ⇒ pas choisi (aucune place prise, aucune ligne écrite).
    if (carrier === 'mondialrelay' && !(t && t.cp) && !idPdfDuSortant(s.cle)) continue;
    const quand = prochainEssaiDepart(t);
    if (!(quand <= maintenant)) continue;
    items.push({ carrier, suivi: k, cle: String(s.cle == null ? '' : s.cle), quand, v: v == null ? Infinity : v, pris: !!(t && msDe(t.priseAt) != null) ? 1 : 0 });
  }
  // (11 nov.) D'abord les colis PAS ENCORE pris en charge (ils ont une date
  // limite d'envoi), les plus anciens d'abord (la limite la plus proche) ; puis
  // le suivi des colis partis, le moins récemment relu d'abord.
  items.sort((a, b) => (a.pris - b.pris) || (a.pris ? (a.quand - b.quand) || (a.v - b.v) : (a.v - b.v) || (a.quand - b.quand)) || a.suivi.localeCompare(b.suivi));
  const out = [], parC = {};
  for (const it of items) {
    if (out.length >= max) break;
    parC[it.carrier] = (parC[it.carrier] || 0);
    if (parC[it.carrier] >= parTransporteur) continue;
    parC[it.carrier]++;
    out.push({ carrier: it.carrier, suivi: it.suivi, cle: it.cle });
  }
  return out;
}

// ── LES SORTANTS QUE LE SERVEUR CONNAÎT ─────────────────────────────────────
// Vestiaire : `vc_ventes.ventes` (les ventes encore « à expédier » qui portent
// un n°). Vinted : les bordereaux `email_bord_*` ({ suivi, transaction,
// receivedAt }) — la date du bordereau borne la fenêtre. Rend [{ cle, suivi,
// transporteur, venteMs }].
// (15 nov., lot retours-suivi) + `retours` : les bordereaux de RETOUR de ses achats (`email_bordretour_*` :
// { suivi, transaction, receivedAt, transporteurPdf }) — un colis qu'IL poste : lu comme un départ, jusqu'à la
// fin (déposé, au point relais du vendeur, livré), jamais en `transp_` (jamais « à retirer »).
// Le transporteur NOMMÉ d'un champ de bordereau : 'mondialrelay' · '' (un autre nom : Chronopost, Vinted Go…)
// · null (champ vide).
export function nomDuBordereau(v) {
  const t = String(v == null ? '' : v).trim();
  if (!t) return null;
  return /mondial|inpost/i.test(t) ? 'mondialrelay' : '';
}
export function sortantsDuVendeur({ vcVentes = null, bords = [], retours = [] } = {}) {
  const out = [];
  const vv = vcVentes && typeof vcVentes === 'object' ? vcVentes : {};
  for (const [id, v] of Object.entries(vv)) {
    // (11 nov.) + une vente ENVOYÉE (le mot de Vestiaire : envoyée, en contrôle)
    // pas encore livrée : son suivi se lit jusqu'à la fin.
    if (!v || typeof v !== 'object' || !v.suivi) continue;
    if (v.aExpedier !== true && !['en-route', 'controle'].includes(etapeMotVc(v))) continue;
    out.push({ cle: 'vc:' + id, suivi: v.suivi, transporteur: v.transporteur || '', venteMs: msDe(v.date) });
  }
  for (const b of Array.isArray(bords) ? bords : []) {
    if (!b || !b.suivi) continue;
    // (16 nov.) Le transporteur NOMMÉ par le bordereau (l'e-mail, sinon l'étiquette) : Mondial Relay n'est
    // jamais reconnu à la forme de son n° (8 chiffres, une forme banale).
    // Seuls ces noms-là sont repris (Chronopost et Vinted Go restent reconnus à la forme PROPRE de leur n°,
    // comme avant : « vinted » est le DÉFAUT d'un e-mail shipping@, pas une preuve).
    // Deux noms différents (l'e-mail dit l'un, l'étiquette l'autre) ⇒ aucun (jamais deviné).
    const noms = new Set([b.transporteur, b.transporteurPdf].map(nomDuBordereau).filter((x) => x !== null));
    const nomme = noms.size === 1 ? [...noms][0] : '';
    out.push({ cle: 'vt:' + String(b.transaction || b.suivi), suivi: b.suivi, transporteur: nomme, venteMs: msDe(b.receivedAt) });
  }
  for (const r of Array.isArray(retours) ? retours : []) {
    if (!r || !r.suivi) continue;
    out.push({ cle: 'rt:' + String(r.transaction || r.suivi), suivi: r.suivi, transporteur: r.transporteurPdf || '', venteMs: msDe(r.receivedAt), retour: true });
  }
  return out;
}

// ── VINTED : LES TRANSACTIONS PARTIES D'APRÈS LE TRANSPORTEUR ───────────────
// `bordsParTx` : { [tx]: bordereau { suivi, receivedAt } } ; `ventesMs` :
// { [tx]: date de vente ms } (facultatif). Rend Map tx → preuve.
export function txVintedParties(bordsParTx, departs, { ventesMs = null } = {}) {
  const out = new Map();
  const m = versMap(departs);
  if (!m || !bordsParTx || typeof bordsParTx !== 'object') return out;
  const liste = Object.entries(bordsParTx).map(([tx, b]) => ({ cle: tx, suivi: b && b.suivi }));
  const ambigus = suivisAmbigus(liste);
  for (const [tx, b] of Object.entries(bordsParTx)) {
    if (!b || !b.suivi) continue;
    const venteMs = (ventesMs && ventesMs[tx] != null ? ventesMs[tx] : null) ?? msDe(b.receivedAt);
    const p = departProuve(b.suivi, m, { venteMs, ambigus });
    if (p) out.set(String(tx), p);
  }
  return out;
}
