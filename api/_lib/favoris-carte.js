// ══ 5.376 (Julien, 14 nov., midi) : LES MESSAGES AUX FAVORIS DEPUIS LA CARTE DU LOGO ══
// « On peut lancer les messages aux favoris directement quand on est sur le compte,
// on n'a pas besoin d'aller sur VRM. »
//
// Ce fichier ne décide AUCUN envoi : il dit, pour le compte Vinted de l'onglet,
// QUI peut recevoir un message (« N favoris à qui écrire »), avec l'aperçu de ce
// qui partira (le message rendu, l'offre calculée), sans rien écrire. L'envoi reste
// la file existante (api/_lib/favoris-file.js : `lancer` sur SON clic, autorisation
// unique `consommer`, l'extension qui compte 15/h favoris et 50/h, pause 429/403,
// captcha ⇒ arrêt).
//
// Une seule règle par notion : chaque morceau vient du module de l'app qui la porte
// (aucune copie) —
//   · les favoris lus      : favorisDepuisNotifications (src/favorisVinted.js) ;
//   · l'état d'un favori   : etatFavori (src/favorisEcran.js) — « à envoyer » seulement ;
//   · l'annonce            : etatDressingAuto / etatAnnonceAuto (src/favorisAuto.js) —
//     dressing COMPLET lu il y a moins de 24 h, sinon « pas su » ⇒ RIEN n'est proposé ;
//     vendue (ici ou ailleurs, `gardeRefuse`), réservée, en pause, fermée ⇒ écartée ;
//   · le destinataire      : prouvé par la résolution des cibles du serveur (la même
//     que `lancer`) — un favori sans destinataire prouvé n'est jamais proposé ;
//   · le message et l'offre: personnaliserMessageFavori / prixOffreFavori
//     (src/favorisMessage.js, la règle que l'extension recopie).
import {favorisDepuisNotifications,indexerContactsFavoris} from '../../src/favorisVinted.js';
import {etatFavori,pseudoFavori,titreNotification,itemIdFavori} from '../../src/favorisEcran.js';
import {etatDressingAuto,etatAnnonceAuto} from '../../src/favorisAuto.js';
import {personnaliserMessageFavori,prixOffreFavori} from '../../src/favorisMessage.js';
import {progressionFavoris} from '../../src/favorisProgression.js';

// Une fois lancée depuis la carte, la file part au rythme des gardes de l'extension :
// 15 favoris par heure au plus (sécurité des comptes). La carte propose donc les 15
// plus récents d'abord — une heure de travail, jamais une file de 300 sans fin.
export const FAVORIS_CARTE_MAX = 15;

const prixItem = (it) => {
  const p = it && it.price, v = p && typeof p === 'object' ? p.amount : p;
  const n = Number(String(v == null ? '' : v).replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
};
const titreItem = (it) => (it && typeof it.title === 'string' ? it.title.replace(/\s+/g, ' ').trim().slice(0, 120) : '');

// Le suivi de la file, en nombres (rien d'autre) : ce que la carte montre pendant l'envoi.
export function resumeFileCarte(vue, maintenant = Date.now()) {
  if (!vue || !Array.isArray(vue.jobs)) return null;
  const p = progressionFavoris(vue, maintenant);
  const raisons = {};
  for (const j of p.jobs) if (['refuse', 'incertain'].includes(j.etat)) raisons[j.raison || j.etat] = (raisons[j.raison || j.etat] || 0) + 1;
  return { active: vue.active === true, total: p.total, envoyes: p.envoyes, ignores: p.ignores, attente: p.attente, encours: p.encours,
    incertains: p.incertains, refuses: p.refuses, annules: p.annules, prochain: vue.active && Number(vue.prochain) > 0 ? Number(vue.prochain) : null,
    raison: vue.raison || '', raisons };
}

// prefs     : les réglages ENREGISTRÉS du compte, validés (validerReglagesFavoris), ou null ;
// capture   : notifications complètes (capture + archive) du compte ;
// vue       : vueFile du propriétaire (jobs, auto.journal) ;
// dressing  : { cap, pg, items } (harvest_{uid}_listings projeté) ;
// garde     : itemId → raison de la garde des ventes ailleurs (gardeRefuse) ;
// prouve    : notificationId → true si le destinataire est prouvé (résolution des cibles).
export function apercuCarte({ prefs, capture, vue, dressing, garde = () => null, prouve = () => false, maintenant = Date.now() } = {}) {
  const file = resumeFileCarte(vue, maintenant);
  if (vue && vue.active) return { etat: 'encours', file };
  if (!prefs) return { etat: 'bloque', raison: 'reglages', file };
  if (!capture || !capture.payload || !Array.isArray(capture.payload.notifications)) return { etat: 'bloque', raison: 'favoris_absents', file };
  const ed = etatDressingAuto(dressing, maintenant);
  if (ed) return { etat: 'bloque', raison: ed, file };
  const lignes = favorisDepuisNotifications(capture.payload, capture.domain).lignes;
  const statut = indexerContactsFavoris(vue && vue.jobs || []);
  const parNotif = new Map();
  for (const x of (vue && vue.auto && Array.isArray(vue.auto.journal) ? vue.auto.journal : [])) {
    if (!x || x.notificationId == null) continue;
    const k = String(x.notificationId); if (!parNotif.has(k)) parNotif.set(k, []); parNotif.get(k).push(x);
  }
  for (const l of parNotif.values()) l.sort((a, b) => (Number(b.at) || 0) - (Number(a.at) || 0));
  const items = new Map((dressing.items || []).filter((x) => x && x.id != null).map((x) => [String(x.id), x]));
  const offre = prefs.offreMode ? { mode: prefs.offreMode, valeur: prefs.offreMode === 'pct' ? prefs.pourcentage : prefs.offreValeur, arrondi: prefs.arrondi === true } : null;
  let ecartes = 0, nonProuves = 0;
  const prets = [];
  for (const l of lignes) {
    const itemId = itemIdFavori(l);
    if (!itemId) { ecartes++; continue; }
    const annonce = etatAnnonceAuto(itemId, dressing, garde(itemId));
    const e = etatFavori({ job: statut(l), journal: parNotif.get(String(l.id)) || [], vendue: annonce === 'vendue' });
    if (e.code !== 'a_envoyer') continue;           // envoyé, en cours, à vérifier, pas envoyé : jamais reproposé
    if (annonce) { ecartes++; continue; }            // vendue, réservée, en pause, fermée, absente du dressing
    // Une offre demandée dont le prix ne se calcule pas : le favori ne partirait pas
    // (l'extension le refuse, `offre_prix_inconnu`) — il n'est pas proposé.
    const it = items.get(String(itemId)), prix = prixItem(it);
    const prixOffre = offre && prix != null ? prixOffreFavori(prix, offre) : null;
    if (offre && prixOffre == null) { ecartes++; continue; }
    if (!prouve(String(l.id))) { nonProuves++; continue; }
    prets.push({ l, itemId, it, prix, prixOffre });
  }
  const versions = 1 + (Array.isArray(prefs.variantes) ? prefs.variantes.length : 0);
  const liste = prets.slice(0, FAVORIS_CARTE_MAX).map(({ l, itemId, it, prix, prixOffre }) => {
    const pseudo = pseudoFavori(l), titre = titreItem(it) || titreNotification(l.body);
    return { id: String(l.id), itemId: String(itemId), pseudo, titre, prix,
      ...(offre ? { offre: Number(prixOffre) } : {}),
      texte: personnaliserMessageFavori(prefs.message, pseudo, () => 0, { article: titre, prix: prixOffre != null ? Number(prixOffre) : prix }).slice(0, 2000) };
  });
  if (!liste.length) return { etat: 'rien', total: 0, nonProuves, ecartes, file };
  return { etat: 'pret', total: prets.length, liste, selection: liste.map((x) => x.id), nonProuves, ecartes,
    message: { versions, offre: offre ? { mode: offre.mode, valeur: offre.valeur, arrondi: offre.arrondi } : null,
      intervalleMinutes: prefs.intervalleMinutes, intervalleMaxMinutes: prefs.intervalleMaxMinutes || null },
    reglages: prefs, file };
}
