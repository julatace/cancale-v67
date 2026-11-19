// « Relier mes annonces » (19 nov.) — ce que l'app publie, ce que le parcours, les rangées des
// sites, Annonces → Outils et les écrans voisins LISENT. UN propriétaire (§11) : `chargerLiaison`
// (App.jsx) calcule avec src/liaisonSites.js et publie ici. Rien ici n'écrit, rien ne relie.
//
// ── POUR LES AUTRES ÉCRANS (la fiche d'un article, « Aujourd'hui », la barre) ──────────────
//   import { ouvrirRelierAnnonces, ouvrirLiaison, compteurLiaisonLu, etatLienLu, abonnerLiaison, demanderLiaison } from './liaisonEtat.js';
//   ouvrirRelierAnnonces({ site, id })          // = ouvrirLiaison({ site, id })
//   ouvrirLiaison({ site: 'Leboncoin', article: { id, numero } })   // depuis la fiche d'un article : « Relier à Leboncoin »
//   ouvrirLiaison()                              // le parcours, là où il s'est arrêté
//   ouvrirLiaison({ site: 'Leboncoin' })         // la file d'un site
//   ouvrirLiaison({ site: 'eBay', id: '12345' }) // UNE annonce (reliée : son lien, sa preuve, « Délier »)
//   ouvrirLiaison({ vue: 'contradictions' })     // les liens qui se contredisent
//   compteurLiaisonLu()   // null = pas su · { n, surs, contradictions, plusTard } — « N annonces à relier »
//   etatLienLu(site, id)  // { etat: 'relie'|'aRelier'|'aVerifier'|'propre'|'passu', numero, preuve, lieLe }
//   abonnerLiaison(f)     // prévenu à chaque nouveau calcul ; demanderLiaison() le lance s'il n'est pas fait
// (ou, en React : `useLiaison()`, `<LigneLiaison/>` et `<EtatLien/>` de src/LiaisonEntree.jsx).
// ⚠️ Ce module part au DÉMARRAGE (les rangées des sites le lisent) : il n'importe pas les règles
// (src/liaisonSites.js, chargées à la demande avec le parcours). Le compteur et l'état de chaque
// annonce sont calculés là-bas (`compteurLiaison`, `construireLiaison`) et seulement LUS ici.
export const CLE_LIAISON = 'vrm_liaison_sites';

let etat = null;                                       // null = pas encore calculé (« pas su »)
const abonnes = new Set();
export function publierLiaison(x) { etat = x || null; for (const f of [...abonnes]) { try { f(); } catch (_) { /* un abonné cassé n'arrête pas les autres */ } } }
export const lireLiaison = () => etat;
export function abonnerLiaison(f) { abonnes.add(f); return () => abonnes.delete(f); }
const PAS_SU = Object.freeze({ etat: 'passu', numero: '', preuve: '', lieLe: '' });
export const compteurLiaisonLu = () => (etat && etat.lu && etat.compteurEntree ? etat.compteurEntree : null);
export const etatLienLu = (site, id) => { const e = etat && etat.lu && etat.parCle ? etat.parCle.get(`${site}:${id}`) : null; return e ? { etat: e.etat, numero: e.numero, preuve: e.preuve, lieLe: e.lieLe } : PAS_SU; };

export const EVT_OUVRIR_LIAISON = 'vrm:liaison-ouvrir';
export const EVT_CHARGER_LIAISON = 'vrm:liaison-charger';
const emettre = (nom, detail) => { try { window.dispatchEvent(new CustomEvent(nom, { detail })); } catch (_) { /* hors navigateur */ } };
// `article` : { id, numero } — le sens inverse (depuis la fiche d'un article : « Relier à {site} ») : cet article proposé en tête.
export function ouvrirLiaison({ site = null, id = null, vue = null, article = null } = {}) { emettre(EVT_OUVRIR_LIAISON, { site, id: id == null ? null : String(id), vue, article: article && article.id != null ? { id: String(article.id), numero: String(article.numero || '') } : null }); }
// Le même, sous le nom que les écrans d'annonces attendent : `ouvrirRelierAnnonces({ site, id })`.
export const ouvrirRelierAnnonces = ouvrirLiaison;
// Demander le calcul (au plus un toutes les 2 min côté app, sauf `force`).
export function demanderLiaison(force = false) { emettre(EVT_CHARGER_LIAISON, { force: force === true }); }

// Là où il s'est arrêté (CET appareil seulement : une position, pas une donnée).
const CLE_REPRISE = 'vrm_liaison_reprise';
export function lireReprise() { try { return String(localStorage.getItem(CLE_REPRISE) || ''); } catch (_) { return ''; } }
export function noterReprise(cle) { try { if (cle) localStorage.setItem(CLE_REPRISE, String(cle)); else localStorage.removeItem(CLE_REPRISE); } catch (_) { /* stockage bloqué : la file repart du début */ } }
