// ── src/aujourdhui/Branche.jsx — « Aujourd'hui » chargé à la demande AVEC son modèle (19 nov.) ──
// Le modèle (src/aujourdhui/modele.js, pur) et l'écran natif (src/natif/ecrans/Aujourdhui.jsx, ses composants et leur CSS)
// partent dans le MÊME morceau, chargé quand l'écran s'affiche : le budget de démarrage (scripts/budget-vitesse.json)
// reste tenu. L'app (src/App.jsx) passe ses sources et ses outils ; une prop qui est une FONCTION reçoit le modèle `Mo`
// et rend la valeur. Aucune règle ici : on relie les propriétaires, on ne calcule rien de neuf.
import React from 'react';
import Aujourdhui from '../natif/ecrans/Aujourdhui.jsx';
import { poserIcone, iconePosee } from '../natif/index.js';   // les glyphes des composants = les tracés de l'app (posés ici : le morceau natif part à la demande)
import { chiffresAujourdhui, statsPeriodes, dernieresVentes, alerteDuJour, courbe30, parCompteEtSite, vrmDuJour, capteDuJour, releveParPeriode } from './modele.js';
import { useCartes } from './cartes.js';
import { fusionner } from '../capteNotif/arrivee.js';
import { useLectures, lignesReleve } from './lectures.js';   // (21 nov.) partagées avec Statistiques
import { progressionObjectif, joursRestantsMois, lireSaisieObjectif, objectifAEnregistrer } from '../objectifMois.js';
import { raisonCourte, bornesPeriode } from '../design/carteChiffres.js';
import { localeCourante } from '../i18n/index.js';
import { delaisPar, margesPar } from '../statsVentes.js';
import { previsionMois } from '../previsionMois.js';
import { lireValeurStock } from '../coutVente.js';
import { lireStockValeur, EVT_STOCK_VALEUR } from '../stockValeurAffiche.js';
import { lireVuesFavoris, EVT_VUES_FAVORIS } from '../vuesFavoris.js';
import { lirePriorite, rangeeAujourdhui, EVT_REPUB_PRIORITE } from '../republierPriorite.js';   // (21 nov., prio-recherche)

const SEL_TOUT = { site: 'toutes', compte: null, periode: null };
const JOUR = 86400000;

// Les cartes en plus, à partir de la question au propriétaire (`valeurSel`) — aucune règle neuve.
function cartesEnPlus({ valeurSel, objectif: O, live, maintenant, regles, beneficeMois }, { releve, extras, outils, onNav }) {
  // JOUR · SEMAINE · MOIS (19 nov., « plus de stats […] le CA, le bénéfice ») : les mêmes `valeurChiffre` ; la période
  // d'avant coupée au MÊME moment (les règles de période de la carte des chiffres, `regles`).
  const precedente = (p) => {
    const de = p === 'jour' ? new Date(new Date(maintenant).setHours(0, 0, 0, 0)) : regles.debutPeriode(maintenant, p);
    const avant = p === 'jour' ? new Date(de.getFullYear(), de.getMonth(), de.getDate() - 1) : regles.decalerPeriode(de, p, -1);
    return { de: avant.getTime(), a: Math.min(de.getTime(), avant.getTime() + (maintenant - de.getTime())), label: '' };
  };
  const stats = statsPeriodes({ valeur: (id, p) => valeurSel(id, p, SEL_TOUT), precedente, raisonCourte, beneficeMois });
  const moisAvant = new Date(new Date(maintenant).getFullYear(), new Date(maintenant).getMonth() - 1, 1).toLocaleDateString(localeCourante(), { month: 'long' });
  // Toucher un chiffre ouvre Argent sur la période (le graphique du CA retient `vrm_compta_periode` : semaine ou mois).
  const ouvrirPeriode = (p) => { try { localStorage.setItem('vrm_compta_periode', p === 'mois' ? 'mois' : 'semaine'); } catch (_) {} if (onNav) onNav('compta'); };
  const courbe = { jours: courbe30({ valeur: (id, p) => valeurSel(id, p, SEL_TOUT), maintenant }) };
  const lignesV = live && Array.isArray(live.venduLignes) ? live.venduLignes : (live ? null : undefined);
  const comptes = parCompteEtSite({ lignes: lignesV || null, valeur: valeurSel });
  // L'objectif du mois (src/objectifMois.js).
  const type = O.mois ? O.mois.type : 'ca';
  const base = { type, cible: O.mois ? O.mois.valeur : null, jours: joursRestantsMois(maintenant).jours,
    enregistrer: (saisie) => { const v = lireSaisieObjectif(type, saisie); if (v == null) return false; const r = objectifAEnregistrer(O.brut, { type, valeur: v }, maintenant); if (!r) return false; O.poser(r); return true; },
    retirer: () => { const r = objectifAEnregistrer(O.brut, null, maintenant); if (r) O.poser(r); } };
  let objectif;
  if (!O.mois) objectif = { ...base, etat: 'aucun' };
  else {
    const x = O.valeur(O.mois); const prog = progressionObjectif(O.mois, x);
    objectif = !prog || prog.pct == null ? { ...base, etat: x && x.raison === 'encours' ? 'encours' : 'passu', raison: raisonCourte(x || {}) || '', valeur: null, pct: null }
      : { ...base, etat: 'lu', valeur: prog.valeur, pct: prog.pct, partiel: !!prog.partiel, atteint: !!prog.atteint };
  }
  const v = (id, p = null) => valeurSel(id, p, SEL_TOUT) || {};
  // STOCK EN LIGNE : le nombre en ligne (`enligne`), la valeur au prix d'achat publiée par Annonces (`lireValeurStock` :
  // « au moins … · sur N » quand des prix manquent).
  const EL = v('enligne');
  const VS = outils && outils.uid ? lireValeurStock(outils.uid()) : null;
  const stock = { enLigne: EL.valeur == null ? null : EL.valeur, raisonEnLigne: EL.valeur == null ? raisonCourte(EL) : '',
    achat: VS && VS.centimes != null ? VS.centimes / 100 : null, achatPartiel: !!VS && (VS.partiel || Number(VS.nSans) > 0), achatN: VS ? VS.n : null, achatNPrix: VS ? VS.nPrix : null,
    raisonAchat: !VS ? 'annonces' : VS.centimes == null ? 'achats' : '' };
  // (20 nov., « ce qui manque ») AU PRIX AFFICHÉ : la publication de l'écran Annonces (src/stockValeurAffiche.js) — une
  // paire comptée une fois, prix Vinted sinon le plus bas ; null = jamais publiée (« — · ouvre Annonces »).
  const VA = outils && outils.uid ? lireStockValeur(outils.uid()) : null;
  stock.affiche = VA ? { centimes: VA.centimes, n: VA.n, nPrix: VA.nPrix, auMoins: !!VA.partiel || VA.nPrix < VA.n } : null;
  // VUES ET FAVORIS : la publication de l'écran Annonces (src/vuesFavoris.js) ; null = jamais publiée.
  const vues = outils && outils.uid ? lireVuesFavoris(outils.uid()) : null;
  // LES CHIFFRES DU RELEVÉ par période (vitesse, marge, marques) — relevé pas lu ⇒ null.
  const bornes = (p) => { try { return bornesPeriode(p, regles, maintenant); } catch (_) { return null; } };
  const lignesR = releve === undefined ? undefined : lignesReleve(releve, extras, outils && outils.enLigne);
  const parPeriode = lignesR ? releveParPeriode({ lignes: lignesR, bornes, delaisPar, margesPar }) : (lignesR === undefined ? undefined : null);
  // Taux d'écoulement 30 j : les ventes des 30 derniers jours ÷ les annonces en ligne (présentation de deux chiffres lus).
  const V30 = v('ventes', { de: maintenant - 30 * JOUR, a: maintenant + 1, label: '' });
  const ecoulement = V30.valeur != null && !V30.partiel && EL.valeur > 0 ? { pct: Math.round((V30.valeur / EL.valeur) * 100), ventes: V30.valeur, enLigne: EL.valeur } : null;
  // PRÉVISION DU MOIS : la règle d'Argent (src/previsionMois.js), fourchette comprise.
  const prevision = previsionMois({ vendu: lignesV, manque: live && live.venduManque, nonComptees: live && live.venduNonComptees, releve: Array.isArray(releve) ? releve : null, maintenant });
  const dorment = v('dorment');
  const avenir = v('attente');
  return { chiffresPlus: { stats, moisAvant, ouvrirPeriode }, courbe, comptes, objectif, stats2: { stock, vues, parPeriode, ecoulement, prevision,
    dorment: { valeur: dorment.valeur == null ? null : dorment.valeur, partiel: !!dorment.partiel, raison: dorment.valeur == null ? raisonCourte(dorment) : '' },
    avenir: { valeur: avenir.valeur == null ? null : avenir.valeur, partiel: !!avenir.partiel, raison: avenir.valeur == null ? raisonCourte(avenir) : '' } } };
}

const Mo = Object.freeze({ chiffresAujourdhui, statsPeriodes, dernieresVentes, alerteDuJour, courbe30, parCompteEtSite, vrmDuJour, capteDuJour, fusionner });

export default function AujourdhuiBranche({ calculer = null, alerte = null, ventes = null, outils = null, ...reste }) {
  if (reste.Icon && !iconePosee()) poserIcone(reste.Icon);
  const cartes = useCartes(outils);
  // Une publication neuve d'Annonces (valeur au prix affiché, vues et favoris) redessine la carte, sans relire.
  const [, publie] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => { window.addEventListener(EVT_STOCK_VALEUR, publie); window.addEventListener(EVT_VUES_FAVORIS, publie); window.addEventListener(EVT_REPUB_PRIORITE, publie);
    return () => { window.removeEventListener(EVT_STOCK_VALEUR, publie); window.removeEventListener(EVT_VUES_FAVORIS, publie); window.removeEventListener(EVT_REPUB_PRIORITE, publie); }; }, []);
  const L = useLectures(outils);
  let plus = {};
  try { plus = typeof calculer === 'function' ? (calculer(Mo) || {}) : {}; } catch (_) { plus = {}; /* pas su ⇒ l'écran dit « — » */ }
  if (plus.plus) { try { const E = cartesEnPlus(plus.plus, { releve: L.releve, extras: L.extras, outils, onNav: reste.onNav }); plus = { ...plus, ...E, chiffres: { ...(plus.chiffres || {}), ...E.chiffresPlus } }; delete plus.chiffresPlus; } catch (_) { /* pas su ⇒ les cartes disent « — » */ } delete plus.plus; }
  const a = typeof alerte === 'function' ? alerte(Mo) : alerte;
  const v = typeof ventes === 'function' ? ventes(Mo) : ventes;
  const lu = (f) => { try { return typeof f === 'function' ? f(Mo) : (f === undefined ? null : f); } catch (_) { return null; } };
  const maintenant = Date.now();
  const capte = L.capte === undefined || !outils ? undefined : L.capte ? lu(() => Mo.capteDuJour(Mo.fusionner(L.capte), maintenant)) : null;
  const vrm = L.journal === undefined || !outils ? undefined : lu(() => Mo.vrmDuJour(L.journal, maintenant));
  return <Aujourdhui {...reste} {...plus} alerte={a} ventes={v} capte={capte} vrm={vrm} cartes={cartes}
    onDorment={outils && outils.vue ? () => { outils.vue('dorment'); if (reste.onNav) reste.onNav('cat_annonces'); } : null}
    aRepublier={(() => { const r = outils && outils.uid ? rangeeAujourdhui(lirePriorite(outils.uid())) : null;
      return r && outils.vue ? { ...r, ouvrir: () => { outils.vue('arepublier'); try { window.dispatchEvent(new CustomEvent('vrm:vue', { detail: 'arepublier' })); } catch (_) {} if (reste.onNav) reste.onNav('cat_annonces'); } } : null; })()}
    onAVenir={outils && outils.aVenir ? () => outils.aVenir() : null}/>;
}
