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
import { fusionner, SELECT_JOURNAL_CAPTE } from '../capteNotif/arrivee.js';   // le journal capté par l'extension, une entrée par identité
import { progressionObjectif, joursRestantsMois, lireSaisieObjectif, objectifAEnregistrer } from '../objectifMois.js';
import { raisonCourte, bornesPeriode } from '../design/carteChiffres.js';
import { localeCourante } from '../i18n/index.js';
import { delaisPar, margesPar } from '../statsVentes.js';
import { previsionMois } from '../previsionMois.js';
import { lireValeurStock } from '../coutVente.js';
import { eclaterReleveLots, modeleSur } from '../ceQuiRapporte.js';

const SEL_TOUT = { site: 'toutes', compte: null, periode: null };
const JOUR = 86400000;

// Le relevé des ventes finalisées, en lignes de Statistiques (la même construction que src/ecrans/Stats.jsx
// `useReleveStats`) : la marque LUE de l'annonce reliée par SA transaction, la date de mise en ligne lue.
function lignesReleve(rows, x, enLigne) {
  if (!Array.isArray(rows)) return null;
  return eclaterReleveLots(rows).map((r) => {
    const [plateforme, compte, id, ts, eur, achat, frais, titre] = r;
    const itemLot = typeof r[10] === 'string' && r[10] ? r[10] : null;
    const t = plateforme === 'Vinted' && x && x.txn && id ? x.txn[String(id)] : null;
    const it = itemLot ? (x && x.items ? x.items[itemLot] || null : null) : (t && t.item && x && x.items ? x.items[t.item] : null);
    return { plateforme, compte, id, ts, eur, achat, frais, titre, marqueLue: String((it && it.brand) || '').trim(), modele: modeleSur((it && it.brand) || '', titre),
      enLigne: it && enLigne ? enLigne(it, (x && x.dates) || null) : null };
  });
}

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
  return { chiffresPlus: { stats, moisAvant, ouvrirPeriode }, courbe, comptes, objectif, stats2: { stock, parPeriode, ecoulement, prevision,
    dorment: { valeur: dorment.valeur == null ? null : dorment.valeur, partiel: !!dorment.partiel, raison: dorment.valeur == null ? raisonCourte(dorment) : '' },
    avenir: { valeur: avenir.valeur == null ? null : avenir.valeur, partiel: !!avenir.partiel, raison: avenir.valeur == null ? raisonCourte(avenir) : '' } } };
}

// Les lectures des cartes en plus : le journal des gestes (`/api/compte?mode=journal`, la source de « Ce que VRM a fait »),
// le journal capté par l'extension (`capte_journal_*`), le relevé des ventes (`vrm_stats_ventes`) et ses annonces
// (marque et date de mise en ligne lues, `lireExtrasRepartition` de l'app). Une lecture ratée ⇒ null (pas su), jamais [].
function useLectures(o) {
  const [journal, setJournal] = React.useState(undefined), [capte, setCapte] = React.useState(undefined), [extras, setExtras] = React.useState(undefined);
  const lireReleve = () => { try { const x = o ? o.load('vrm_stats_ventes', null) : null; return x && Array.isArray(x.l) ? x.l : null; } catch (_) { return null; } };
  const [releve, setReleve] = React.useState(lireReleve);
  React.useEffect(() => {
    if (!o) return undefined;
    let vivant = true;
    (async () => {
      try { const r = await fetch('/api/compte?mode=journal', { headers: o.entete() }); const j = r.ok ? await r.json().catch(() => null) : null; if (vivant) setJournal(j && Array.isArray(j.evenements) ? j.evenements : null); } catch (_) { if (vivant) setJournal(null); }
      try { const rows = await o.lireTout(SELECT_JOURNAL_CAPTE); if (vivant) setCapte(Array.isArray(rows) ? rows : null); } catch (_) { if (vivant) setCapte(null); }
      try { const x = o.extras ? await o.extras() : null; if (vivant) setExtras(x || null); } catch (_) { if (vivant) setExtras(null); }
    })();
    const f = (e) => { if (e && e.detail && e.detail.k === 'vrm_stats_ventes') setReleve(lireReleve()); };
    window.addEventListener('vrm:save', f);
    return () => { vivant = false; window.removeEventListener('vrm:save', f); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o]);
  return { journal, capte, extras, releve };
}

const Mo = Object.freeze({ chiffresAujourdhui, statsPeriodes, dernieresVentes, alerteDuJour, courbe30, parCompteEtSite, vrmDuJour, capteDuJour, fusionner });

export default function AujourdhuiBranche({ calculer = null, alerte = null, ventes = null, outils = null, ...reste }) {
  if (reste.Icon && !iconePosee()) poserIcone(reste.Icon);
  const cartes = useCartes(outils);
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
    onAVenir={outils && outils.aVenir ? () => outils.aVenir() : null}/>;
}
