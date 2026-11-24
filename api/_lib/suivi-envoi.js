// ════════════════════════════════════════════════════════════════════════════
//  LE SUIVI D'UN ENVOI — DU DÉPÔT AU VERSEMENT (24 nov., lot suivi-ventes)
// ════════════════════════════════════════════════════════════════════════════
// Julien (24 nov.) : « retrait des articles vendus, fais un vrai suivi ».
// Mesures (lecture seule) et récit : docs/passation/2026-11-24-suivi-ventes.md.
//
// UN PARCOURS PAR COLIS VENDU, cinq étapes, chacune SEULEMENT si SA preuve est lue :
//   Déposé → En route → Au point « nom » (depuis …, à retirer avant …) → Retiré par l'acheteur
//   → Commande finalisée = argent versé.
//   · Déposé, En route : les preuves de la frise de la vente (src/friseProuvee.js `preuvesFriseVinted`,
//     leur propriétaire : la règle du départ, la prise en charge lue, l'e-mail du MÊME n°, l'état Vinted) ;
//   · Au point : la ligne lue chez le transporteur pour le n° de SON bordereau (`depart_{c}_{n°}`,
//     api/_lib/depart-colis.js) dit « disponible » — ou elle l'a dit avant d'être retirée (`arriveeAt`
//     gardée, antérieure au retrait). JAMAIS le texte de la liste Vinted « colis déposé en bureau de Poste
//     ou point relais » : mesuré AMBIGU (le dépôt du vendeur OU l'attente de l'acheteur, 23 nov.).
//     Le nom du point (`lieuNom`) et la date limite seulement LUS : Vinted Go `expiration_time`
//     (`limiteSure`) ; Chronopost et Mondial Relay ne donnent aucune date sûre ⇒ rien n'est dit ;
//   · Retiré : la même ligne dit « retiré » ou « livré », sinon la preuve « livrée » de la frise (e-mail
//     « livré » du même n°, l'état Vinted « Commande livrée ») ;
//   · Argent : SEULEMENT la commande finalisée (450, « Commande finalisée », `completed`) — sa date est
//     celle du versement LUE (la compta), sinon aucune date.
//   Une étape non sue reste « pas encore su » : jamais déduite d'une étape plus loin, d'un délai ou d'une
//   absence (§5). Le n° porté par deux ventes ou aussi par un achat est ambigu : l'appelant ne passe
//   AUCUNE ligne (`depart: null`).
//   « Colis en danger » : le MÊME seuil que la notification (api/_lib/colis-danger.js `dangerDuDepart`).
//   Un retour : la ligne dit « repart chez l'expéditeur » (ou rendu), ou la vente bifurque (litige, retour,
//   annulée — src/friseProuvee.js `bifurcationVente`) ⇒ le chemin du retour est dit, les étapes d'après
//   sont grisées.
//
// LES NOTIFICATIONS (famille « Suivi de tes envois », `envois`) : « ton colis est au point » et
// « l'acheteur l'a retiré » — une fois par colis et par étape (`push_dedup`, `envoi-{étape}-{n°}`),
// seulement d'une lecture FRAÎCHE du transporteur (moins de 8 h) d'un événement RÉCENT (moins de 3 jours :
// la première passe ne réveille pas l'historique), pour le n° d'UNE vente (son bordereau, une transaction,
// pas annulée), jamais un retour ni un achat. « Pas su » ⇒ rien.
// Module PUR (aucune lecture, aucune écriture) : l'app l'importe, le cron lui passe ses lectures.
import { departProuve, departsParSuivi, SELECT_DEPART_META, limiteDepartLue, TOLERANCE_AVANT_VENTE_MS } from './depart-colis.js';
import { dangerDuDepart, ventesParSuivi } from './colis-danger.js';
import { normaliserSuivi } from './etat-colis-email.js';

export const ETAPES_ENVOI = Object.freeze(['depose', 'enroute', 'aupoint', 'retire', 'argent']);
export const GROUPES_ENVOI = Object.freeze(['enroute', 'aupoint', 'retire', 'argent']);
const ETATS_REMIS = new Set(['retire', 'livre']);
const str = (v) => String(v == null ? '' : v).trim();
const msDe = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) && v > 1e11 ? v : null;
  if (typeof v === 'string' && v) { const t = Date.parse(v); return Number.isFinite(t) ? t : null; }
  return null;
};
const fait = (t, source, x = {}) => ({ etat: 'fait', t: msDe(t), source: str(source), ...x });
const pasSu = () => ({ etat: 'passu', t: null, source: '' });

// La ligne du transporteur ne vaut pour CETTE vente que si sa prise en charge est prouvée et pas datée avant
// la vente (au-delà d'un jour) — la règle de api/_lib/depart-colis.js (`departProuve`), jamais une autre.
function ligneDeLaVente(depart, venteMs) {
  if (!depart || typeof depart !== 'object') return null;
  const k = normaliserSuivi(depart.suivi);
  if (!k) return null;
  return departProuve(k, new Map([[k, depart]]), { venteMs }) ? depart : null;
}

// ── LE PARCOURS D'UN ENVOI ──────────────────────────────────────────────────
// preuves     : la sortie de `preuvesFriseVinted` (src/friseProuvee.js) — { deposee, enroute, livree, finalisee, versee } ;
// depart      : la ligne `depart_` du n° de SON bordereau (forme `departDeMeta`), ou null (pas lue, ou n° ambigu) ;
// venteMs     : la date de la vente ;
// bifurcation : `bifurcationVente` (litige, retour, annulée) ou null ;
// suivi, carrier : le n° et le transporteur (affichage) ;
// maintenant  : pour le seuil « Colis en danger ».
// Rend { etapes: [{ cle, etat: 'fait'|'passu', t, source, … }], ici, groupe, retour, danger, point, suivi,
//        carrier, luChezTransporteur }.
export function parcoursEnvoi({ preuves = {}, depart = null, venteMs = null, bifurcation = null, suivi = '', carrier = '', maintenant = Date.now() } = {}) {
  const p = preuves || {};
  const lue = (x) => !!(x && x.lu === true);
  const t = ligneDeLaVente(depart, msDe(venteMs));
  const etatT = t ? str(t.etat) : '';
  const etapes = {};
  etapes.depose = lue(p.deposee) ? fait(p.deposee.t, p.deposee.source) : pasSu();
  etapes.enroute = lue(p.enroute) ? fait(p.enroute.t, p.enroute.source) : pasSu();
  // Au point : la ligne LUE chez le transporteur, rien d'autre.
  let point = null;
  if (t && etatT === 'disponible') {
    const depuis = msDe(t.arriveeAt) ?? msDe(t.etatAt);
    const limite = limiteDepartLue(t) ? msDe(t.limiteAt) : null;
    point = { nom: str(t.lieuNom), ville: str(t.lieuVille), depuis, limite };
    etapes.aupoint = fait(depuis, 'transporteur', { nom: point.nom, ville: point.ville, limite });
  } else if (t && ETATS_REMIS.has(etatT) && msDe(t.arriveeAt) != null && msDe(t.etatAt) != null && msDe(t.arriveeAt) < msDe(t.etatAt) - 60000) {
    // Arrivé au point, puis retiré : `arriveeAt` (posée par la lecture « disponible ») précède le retrait.
    etapes.aupoint = fait(t.arriveeAt, 'transporteur', { nom: str(t.lieuNom), ville: str(t.lieuVille), limite: null });
  } else etapes.aupoint = pasSu();
  // Retiré : le transporteur (retiré / livré), sinon la preuve « livrée » de la frise.
  if (t && ETATS_REMIS.has(etatT)) etapes.retire = fait(t.etatAt, 'transporteur');
  else if (lue(p.livree)) etapes.retire = fait(p.livree.t, p.livree.source);
  else etapes.retire = pasSu();
  // L'argent : SEULEMENT la commande finalisée ; la date = le versement LU, sinon aucune.
  etapes.argent = lue(p.finalisee) ? fait(lue(p.versee) ? p.versee.t : null, lue(p.versee) ? 'versement' : p.finalisee.source) : pasSu();
  const liste = ETAPES_ENVOI.map((cle) => ({ cle, ...etapes[cle] }));
  const ici = liste.map((e) => e.etat === 'fait').lastIndexOf(true);
  // Le retour : la ligne du transporteur, puis la bifurcation de la vente.
  let retour = null;
  if (t && etatT === 'retour_expediteur') retour = { genre: 'retour', libelle: t.detail === 'rendu' ? 'revenu' : 'repart', t: msDe(t.etatAt), source: 'transporteur' };
  else if (bifurcation && bifurcation.libelle) retour = { genre: str(bifurcation.genre), libelle: str(bifurcation.libelle), sous: str(bifurcation.sous), t: null, source: 'vinted' };
  if (retour) liste.forEach((e, i) => { if (i > ici) e.apresRetour = true; });
  const enCours = !retour && ici + 1 < liste.length ? liste[ici + 1].cle : null;
  liste.forEach((e) => { e.cours = e.cle === enCours; });
  // Le danger : le colis attend au point, pas retiré ; la règle de « Colis en danger ».
  const danger = t && etatT === 'disponible' && etapes.retire.etat !== 'fait' && !retour ? dangerDuDepart(t, maintenant) : null;
  // Un retour ne range le colis dans « Retour » que s'il était PARTI (une vente annulée avant l'envoi n'est pas un envoi).
  const groupe = retour ? (ici >= 0 ? 'retour' : null)
    : etapes.argent.etat === 'fait' ? 'argent'
    : etapes.retire.etat === 'fait' ? 'retire'
    : etapes.aupoint.etat === 'fait' ? 'aupoint'
    : (etapes.depose.etat === 'fait' || etapes.enroute.etat === 'fait') ? 'enroute' : null;
  return { etapes: liste, ici, groupe, retour, danger, point, suivi: normaliserSuivi(suivi), carrier: str(carrier), luChezTransporteur: !!(t && msDe(t.lu) != null) };
}

// ── « MES ENVOIS » : LES GROUPES ────────────────────────────────────────────
// parcours : [{ cle, parcours }] ⇒ { enroute: [], aupoint: [] (date limite la plus proche d'abord, sans date
// à la fin), retire: [], argent: [], retour: [], couverture: { n, lus } } — `lus` : ceux qu'un transporteur a
// lus (le reste vient de Vinted et des e-mails, dit à côté du nombre).
export function groupesEnvois(items) {
  const g = { enroute: [], aupoint: [], retire: [], argent: [], retour: [] };
  let n = 0, lus = 0;
  for (const it of Array.isArray(items) ? items : []) {
    const pc = it && it.parcours;
    if (!pc || !pc.groupe || !g[pc.groupe]) continue;
    g[pc.groupe].push(it);
    n++; if (pc.luChezTransporteur) lus++;
  }
  const lim = (it) => { const x = it.parcours.point && it.parcours.point.limite; return Number.isFinite(x) ? x : Infinity; };
  const dep = (it) => { const x = it.parcours.point && it.parcours.point.depuis; return Number.isFinite(x) ? x : Infinity; };
  g.aupoint.sort((a, b) => (lim(a) - lim(b)) || (dep(a) - dep(b)) || String(a.cle).localeCompare(String(b.cle)));
  return { ...g, couverture: { n, lus } };
}

// ── LES NOTIFICATIONS « AU POINT » ET « RETIRÉ » (le cron) ──────────────────
export const FRAICHEUR_ENVOI_MS = 8 * 3600000;
export const RECENT_ENVOI_MS = 3 * 86400000;
export const ETAPES_NOTIF_ENVOI = Object.freeze(['aupoint', 'retire']);
export const cleEnvoi = (etape, suivi) => `envoi-${etape}-${normaliserSuivi(suivi)}`;
// departs : Map n° → ligne `depart_` ; bords : bordereaux de vente { suivi, transaction, article, annulee,
// receivedAt } ; autres : Set des n° de retours et d'achats. Rend [{ etape, cle, suivi, tx, article, lieu, carrier }].
export function etapesANotifier({ departs, bords, autres = new Set(), maintenant = Date.now() } = {}) {
  if (!(departs instanceof Map) || !Array.isArray(bords)) return [];
  const ventes = ventesParSuivi(bords);
  const recu = new Map();
  for (const b of bords) { const k = normaliserSuivi(b && b.suivi); if (k && !recu.has(k)) recu.set(k, msDe(b.receivedAt)); }
  const out = [];
  for (const [k, t] of departs) {
    if (!t || (autres && autres.has(k))) continue;
    const v = ventes.get(k);
    if (!v) continue;
    // Le transporteur a pris en charge CE colis, pas avant la vente (son bordereau).
    if (!departProuve(k, departs, { venteMs: recu.get(k) ?? null })) continue;
    const lu = msDe(t.lu);
    if (lu == null || lu > maintenant + 60000 || maintenant - lu > FRAICHEUR_ENVOI_MS) continue;
    const etat = str(t.etat);
    const etape = etat === 'disponible' ? 'aupoint' : ETATS_REMIS.has(etat) ? 'retire' : null;
    if (!etape) continue;
    const quand = etape === 'aupoint' ? (msDe(t.arriveeAt) ?? msDe(t.etatAt)) : msDe(t.etatAt);
    if (quand == null || quand > maintenant + 3600000 || maintenant - quand > RECENT_ENVOI_MS) continue;
    out.push({ etape, cle: cleEnvoi(etape, k), suivi: k, tx: v.tx, article: v.article, lieu: etape === 'aupoint' ? str(t.lieuNom).slice(0, 60) : '', carrier: str(t.carrier) });
  }
  return out;
}

// La passe, toutes ses entrées injectées (le banc l'exécute telle quelle ; api/ship-reminders.js l'appelle).
//   lire(path) → lignes | null ; reserver(cle) → true · false (déjà dite) · null (pas su) ;
//   envoyer(notif) ; texte(n) → { title, body } ; active() → bool ; lien(n) → url.
export const REQ_DEPARTS_ENVOI = `app_data?id=like.depart_%25&select=${SELECT_DEPART_META}`;
export const REQ_BORDS_ENVOI = 'app_data?id=like.email_bord_%25&select=suivi:meta->>suivi,transaction:meta->>transaction,article:meta->>article,annulee:meta->>annulee,receivedAt:meta->>receivedAt';
export const REQ_RETOURS_ENVOI = 'app_data?id=like.email_bordretour_%25&select=suivi:meta->>suivi';
export const REQ_ACHATS_ENVOI = 'app_data?id=like.transp_%25&select=suivi:meta->>suivi';
export async function passeSuiviEnvoi({ maintenant = Date.now(), lire, reserver, envoyer, texte, active, lien }) {
  if (!(await active())) return { fait: true, raison: 'désactivé par le vendeur', n: 0 };
  const rows = await lire(REQ_DEPARTS_ENVOI);
  if (!Array.isArray(rows)) return { fait: false, raison: 'départs illisibles — rien envoyé' };
  const departs = departsParSuivi(rows) || new Map();
  if (![...departs.values()].some((t) => t && (t.etat === 'disponible' || ETATS_REMIS.has(t.etat)))) return { fait: true, n: 0 };
  const [bords, retours, achats] = await Promise.all([lire(REQ_BORDS_ENVOI), lire(REQ_RETOURS_ENVOI), lire(REQ_ACHATS_ENVOI)]);
  if (![bords, retours, achats].every(Array.isArray)) return { fait: false, raison: 'lecture ratée — rien envoyé' };
  const autres = new Set([...retours, ...achats].map((r) => normaliserSuivi(r && r.suivi)).filter(Boolean));
  const liste = etapesANotifier({ departs, bords, autres, maintenant });
  let envoyees = 0, deja = 0, passu = 0;
  for (const n of liste) {
    const r = await reserver(n.cle);
    if (r === null) { passu++; continue; }
    if (r === false) { deja++; continue; }
    const t = texte(n);
    if (!t || !t.title) continue;
    await envoyer({ cat: 'envoi', title: t.title, body: t.body, tag: n.cle, cle: n.cle, url: lien(n),
      redaction: { sorte: n.etape === 'aupoint' ? 'envoiPoint' : 'envoiRetire', article: n.article, lieu: n.lieu } });
    envoyees++;
  }
  return { fait: true, n: liste.length, envoyees, deja, passu };
}
export { TOLERANCE_AVANT_VENTE_MS };
