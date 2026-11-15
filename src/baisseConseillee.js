// ════════════════════════════════════════════════════════════════════════════
//  LA BAISSE DE PRIX INTELLIGENTE (15 nov. 2026, chantier « vendre plus », validé par Julien)
// ════════════════════════════════════════════════════════════════════════════
// Pour une annonce EN LIGNE qui dort, VRM dit « Baisser à 92 € ? » ou « Garder ce
// prix », avec la RAISON en mots et le PLANCHER. Rien n'est automatique : « Appliquer »
// ouvre la baisse en série existante (src/BaissePrixSerie.jsx : aperçu, son clic,
// confirmation, prix RELU sur Vinted).
//
// UNE règle par notion (§5) : ce module ne remplace pas les bornes du conseil mesuré
// (src/conseilPrix.js, 12 nov. : ≥ 30 j en ligne, −10 % au plus, une proposition par
// paire tous les 14 j, jamais sous l'achat + 10 %, achat inconnu ⇒ rien). Il les
// PREND (`conseil` = le résultat de `conseilBaisse`) et ajoute ce qui manquait :
//   · ses propres VENTES comparables (même modèle sûr, sinon même marque LUE, sinon
//     même tranche de prix — SES ventes, jamais l'annonce d'un autre) : une paire
//     qui n'a pas dépassé une fois et demie son délai habituel n'est pas en retard ;
//   · les OFFRES reçues lues : une offre en cours ⇒ on négocie, on ne baisse pas ;
//   · les FAVORIS lus : des gens l'aiment ⇒ une offre aux favoris d'abord (le geste
//     existant, jamais d'envoi sans son clic) ;
//   · les VUES lues : presque personne ne l'a vue ⇒ le prix n'est pas en cause,
//     republier d'abord ; beaucoup de vues et aucun favori ⇒ le prix freine ;
//   · le PLANCHER complet (`plancherVente`, src/plancherOffre.js : achat + frais
//     CONNUS de la fiche) : jamais en dessous ; frais pas tous confirmés ⇒ « au moins ».
// La baisse : DOUCE (−5 %) par défaut, PLEINE (−10 %, la borne) seulement quand elle a
// dormi trois fois son délai habituel, ou quand elle est vue sans être aimée.
// Pas su ne vaut jamais « peu » ni « aucun » (§5) : un compteur pas lu ne compte pas.
// Aucun prix à la MISE EN LIGNE (refusé le 11 oct.) : moins de 30 jours ⇒ rien du tout.
//
// Module PUR (aucune lecture, aucune écriture, `maintenant` passé). Exécuté par
// scripts/audit-baisse-conseillee.cjs (mutations comprises).
import { centimes, prixMiniPalier, AGE_MIN_J, ECART_J } from './conseilPrix.js';
import { delaisPar, tranchePrix } from './statsVentes.js';
import { modeleSur, eclaterReleveLots } from './ceQuiRapporte.js';

export const SEUIL_COMPARABLES = 5;     // au moins 5 ventes datées pour parler d'un « délai habituel »
export const RETARD_MIN = 1.5;          // pas en retard avant 1,5 × son délai habituel
export const RETARD_FORT = 3;           // ≥ 3 × ⇒ la baisse pleine
export const BAISSE_DOUCE_PCT = 5;
export const FAVORIS_D_ABORD = 3;       // ≥ 3 favoris LUS ⇒ une offre aux favoris d'abord
export const VUES_PEU = 25;             // ≤ 25 vues LUES ⇒ republier d'abord (le plafond de « Quoi republier »)
export const VUES_JOUR_FREIN = 2;       // ≥ 2 vues/jour sans aucun favori ⇒ le prix freine

const compteur = (v) => {
  if (v == null || v === '' || typeof v === 'boolean') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
};
const cleMarque = (b) => String(b == null ? '' : b).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// ── LES VENTES COMPARABLES ─────────────────────────────────────────────────
// `ventes` : SES ventes datées [{ ts (vendue, ms), enLigne (mise en ligne, ms | null),
// marque (LUE sur SON annonce), titre (de SA vente), eur }]. Trois index, chacun par
// `delaisPar` (src/statsVentes.js, la règle du délai de Statistiques) : par modèle sûr
// (`modeleSur`, src/ceQuiRapporte.js), par marque lue, par tranche de prix.
export function indexComparables(ventes) {
  if (!Array.isArray(ventes)) return null;
  const L = ventes.filter((v) => v && Number.isFinite(Number(v.ts))).map((v) => {
    const m = modeleSur(v.marque || '', v.titre || '');
    return { ts: Number(v.ts), enLigne: v.enLigne == null ? null : Number(v.enLigne), modele: m ? m.cle : '', modeleNom: m ? m.nom : '', marque: cleMarque(v.marque), marqueNom: String(v.marque || '').trim(), tranche: tranchePrix(v.eur) };
  });
  const noms = { modele: new Map(), marque: new Map() };
  for (const l of L) { if (l.modele) noms.modele.set(l.modele, l.modeleNom); if (l.marque && !noms.marque.has(l.marque)) noms.marque.set(l.marque, l.marqueNom); }
  const carte = (D) => new Map(((D && D.groupes) || []).map((g) => [g.k, g]));
  return {
    n: L.length,
    modele: carte(delaisPar(L, (l) => l.modele)),
    marque: carte(delaisPar(L, (l) => l.marque)),
    tranche: carte(delaisPar(L, (l) => l.tranche)),
    noms,
  };
}

// SES ventes datées, depuis le relevé de l'écran Ventes (`vrm_stats_ventes`, une ligne par vente,
// une par article d'un lot — `eclaterReleveLots`) et la lecture partagée de Statistiques
// (`lireExtrasRepartition` : transaction → annonce, annonces lues, dates « Ajouté il y a… »).
// L'annonce d'une vente se trouve par SA transaction (une identité, §5) ; la marque est celle LUE
// sur cette annonce. Vinted seulement (la date de mise en ligne n'est lue que là).
// `dateMiseEnLigne(it, dates)` : la règle de l'app (`dateMiseEnLigneMs`).
export function ventesComparablesDuReleve(releve, extras, dateMiseEnLigne) {
  if (!releve || !Array.isArray(releve.l) || !extras || !extras.txn || !extras.items) return null;
  const out = [];
  for (const r of eclaterReleveLots(releve.l)) {
    if (!Array.isArray(r) || r[0] !== 'Vinted') continue;
    const ts = Number(r[3]); if (!Number.isFinite(ts)) continue;
    const itemLot = typeof r[10] === 'string' && r[10] ? r[10] : null;
    const t = r[2] ? extras.txn[String(r[2])] : null;
    const it = itemLot ? extras.items[itemLot] || null : (t && t.item ? extras.items[t.item] || null : null);
    if (!it) continue;
    const en = typeof dateMiseEnLigne === 'function' ? dateMiseEnLigne(it, extras.dates || null) : null;
    out.push({ ts, enLigne: en, marque: it.brand || '', titre: String(r[7] || it.title || ''), eur: Number(r[4]) });
  }
  return out;
}

// Le groupe le plus PROCHE qui a assez de ventes datées : modèle, puis marque, puis
// tranche de prix. `annonce` : { marque (lue), titre (de SON annonce), prix }.
// → { niveau: 'modele'|'marque'|'tranche', nom, n (ventes datées), mediane (j) } | null.
export function comparablesDe(annonce, index, min = SEUIL_COMPARABLES) {
  if (!index || !annonce) return null;
  const m = modeleSur(annonce.marque || '', annonce.titre || '');
  const essais = [
    ['modele', m ? m.cle : '', (k) => index.noms.modele.get(k) || (m && m.nom) || ''],
    ['marque', cleMarque(annonce.marque), (k) => index.noms.marque.get(k) || String(annonce.marque || '')],
    ['tranche', tranchePrix(centimes(annonce.prix) == null ? NaN : centimes(annonce.prix) / 100), (k) => k],
  ];
  for (const [niveau, k, nom] of essais) {
    if (!k) continue;
    const g = index[niveau] && index[niveau].get(k);
    if (g && g.nDelai >= min && g.mediane != null && Number.isFinite(g.mediane)) return { niveau, nom: nom(k), n: g.nDelai, mediane: g.mediane };
  }
  return null;
}

// ── LA DÉCISION ────────────────────────────────────────────────────────────
// Entrées (chacune LUE, sinon null — jamais devinée) :
//   conseil      le résultat de `conseilBaisse` (src/conseilPrix.js) pour cette annonce
//   prix         le prix affiché (euros, « 49,90 », { amount })
//   ageJours     jours en ligne LUS
//   vues, favoris, offres   compteurs LUS (offres : reçues et pas closes) — null = pas lu
//   plancher     `plancherVente(fiche)` (src/plancherOffre.js) : { etat, plancher (centimes) }
//   comparables  `comparablesDe(…)` ou null
// Rend { decision, sugg, prix, pct, plancher, plancherPartiel, auPlancher, raisons, geste,
//        comparables, nouveau, phrase } — `decision` :
//   'baisser'  une baisse PROPOSÉE (sugg en euros entiers, < prix, ≥ plancher) ;
//   'garder'   ne pas baisser maintenant, la raison dit pourquoi (et `geste` le geste d'abord) ;
//   'achat'    prix d'achat pas saisi : rien n'est proposé (§2.5, il le saisit) ;
//   null       rien à dire (prix pas lu, en ligne depuis moins de 30 j, vendue).
// `raisons` : [{ cle, v }] — des clés de traduction (src/i18n, préfixe `bc.r.`) et leurs valeurs.
export function baisseConseillee({ conseil = null, prix, ageJours, vues = null, favoris = null, offres = null, plancher = null, comparables = null } = {}) {
  const pC = centimes(prix);
  const vide = (pourquoi) => ({ decision: null, pourquoi, sugg: null, raisons: [] });
  if (pC == null) return vide('prix');
  const age = ageJours == null || ageJours === '' ? NaN : Number(ageJours);
  if (!Number.isFinite(age) || age < AGE_MIN_J) return vide('age');
  const c = conseil || {};
  if (c.pourquoi === 'vendue') return vide('vendue');
  const j = Math.floor(age);
  const prixE = pC / 100;
  const R = [{ cle: 'bc.r.age', v: { n: j } }];
  const cmp = comparables && Number.isFinite(Number(comparables.mediane)) && Number(comparables.n) >= SEUIL_COMPARABLES ? comparables : null;
  if (cmp) R.push({ cle: 'bc.r.comparables.' + cmp.niveau, v: { nom: cmp.nom, j: Math.max(1, Math.round(cmp.mediane)), n: cmp.n } });
  // Le plancher complet : achat + frais connus (centimes → euros entiers, au-dessus).
  const plOk = plancher && (plancher.etat === 'ok' || plancher.etat === 'partiel') && Number.isFinite(Number(plancher.plancher)) ? plancher : null;
  const plE = plOk ? Math.ceil(Number(plOk.plancher) / 100) : null;
  const plPartiel = !!(plOk && plOk.etat === 'partiel');
  const base = { prix: prixE, comparables: cmp, plancher: plE, plancherPartiel: plPartiel };
  const garder = (cle, v, geste = null) => ({ ...base, decision: 'garder', sugg: null, pct: null, auPlancher: false, raisons: [...R, { cle, v }], geste, nouveau: false, phrase: '' });

  if (c.pourquoi === 'achat' || (plancher && plancher.etat === 'achat')) return { ...base, decision: 'achat', sugg: null, pct: null, raisons: [...R, { cle: 'bc.r.achat', v: {} }], geste: 'achat', nouveau: false, phrase: '' };
  if (c.pourquoi === 'baisse-recente') return garder('bc.r.recente', { n: ECART_J });
  if (c.pourquoi === 'proposee-recemment') return garder('bc.r.proposee', { n: ECART_J });
  const auPlancherDit = () => { const p = Math.max(Number(c.plancher) || 0, plE || 0); return p > 0 ? garder('bc.r.plancher', { p }) : garder('bc.r.plancherSans', {}); };
  if (c.pourquoi === 'plancher') return auPlancherDit();
  if (c.sugg == null || !Number.isFinite(Number(c.sugg))) return vide(c.pourquoi || 'conseil');

  // Ce qui passe AVANT une baisse : une offre reçue, un délai pas dépassé, des favoris, peu de vues.
  const o = compteur(offres), f = compteur(favoris), v = compteur(vues);
  if (o != null && o > 0) return garder('bc.r.offres', { n: o }, 'offres');
  if (cmp && age < Math.max(AGE_MIN_J, Math.ceil(RETARD_MIN * Number(cmp.mediane)))) return garder('bc.r.pasEnRetard', { j: Math.ceil(RETARD_MIN * Number(cmp.mediane)) });
  if (f != null && f >= FAVORIS_D_ABORD) return garder('bc.r.favoris', { n: f }, 'favoris');
  if (v != null && v <= VUES_PEU) return garder('bc.r.peuVue', { n: v }, 'republier');

  // La baisse : douce par défaut, pleine si très en retard ou vue sans être aimée.
  const retard = cmp ? age / Number(cmp.mediane) : age / AGE_MIN_J;
  const freine = v != null && f === 0 && v / Math.max(1, age) >= VUES_JOUR_FREIN;
  const forte = retard >= RETARD_FORT || freine;
  if (freine) R.push({ cle: 'bc.r.freine', v: { n: v } });
  else if (forte) R.push({ cle: 'bc.r.tresEnRetard', v: { x: Math.floor(retard) } });
  let sugg;
  if (c.nouveau === false) sugg = Math.round(Number(c.sugg));          // la MÊME proposition pendant 14 j
  else if (forte) sugg = Math.round(Number(c.sugg));                    // la borne : −10 % (src/conseilPrix.js)
  else {
    const douce = Math.ceil(pC * (100 - BAISSE_DOUCE_PCT) / 10000);
    sugg = douce * 100 < pC ? Math.max(douce, Math.round(Number(c.sugg))) : Math.round(Number(c.sugg));
  }
  // Jamais plus de −10 % (la borne), jamais sous le plancher du conseil (achat + 10 %).
  const mini = prixMiniPalier(prixE);
  if (mini != null && sugg < mini) sugg = mini;
  if (Number.isFinite(Number(c.plancher)) && sugg < Number(c.plancher)) sugg = Number(c.plancher);
  let auPlancher = !!c.auPlancher && sugg === Number(c.plancher);
  // Jamais sous le plancher complet (achat + frais connus) : remonté, et DIT.
  if (plE != null && sugg < plE) { sugg = plE; auPlancher = true; }
  if (sugg * 100 >= pC) return auPlancherDit();
  const pct = Math.round((pC - sugg * 100) / pC * 100);
  const plAff = Math.max(plE || 0, Number(c.plancher) || 0) || null;
  // Le plancher DIT est le plus haut des deux, nommé par ce qu'il est : achat + frais connus (la perte),
  // ou achat + 10 % (la marge que le conseil garde toujours) quand celui-là est plus haut.
  const parMarge = Number(c.plancher) > (plE || 0);
  R.push({ cle: parMarge ? 'bc.r.plancherMarge' : plPartiel ? 'bc.r.plancherAuMoins' : 'bc.r.plancherOk', v: { p: plAff } });
  return { ...base, decision: 'baisser', sugg, pct, plancher: plAff, auPlancher, raisons: R, geste: 'baisser', nouveau: c.nouveau !== false, phrase: `Baisser à ${sugg} € ?` };
}

// Les raisons en mots (une phrase, « · » entre chaque), par le traducteur de l'app.
export const texteRaisons = (raisons, t) => (Array.isArray(raisons) ? raisons : []).map((r) => (typeof t === 'function' ? t(r.cle, r.v || {}) : r.cle)).filter(Boolean).join(' · ');

// Ce que la carte `conseilsPrix` de l'app attend (la fiche, le repricing, la liste « qui
// dorment ») : la forme de `conseilBaisse`, pour UNE seule proposition affichée partout.
export function commeConseil(d, t) {
  if (!d || d.decision !== 'baisser') return null;
  return { sugg: d.sugg, prix: d.prix, plancher: d.plancher, auPlancher: d.auPlancher, raison: texteRaisons(d.raisons, t), phrase: typeof t === 'function' ? t('bc.phrase', { p: d.sugg }) : d.phrase, nouveau: d.nouveau, pct: d.pct, decision: d };
}

// Le RANG dans la liste : les baisses d'abord (la plus grosse somme débloquée), puis les
// « garder » qui ont un geste, puis le reste ; à égalité le plus ancien, puis l'identifiant.
const RANG_DECISION = { baisser: 0, garder: 1, achat: 2 };
export function classerConseils(lignes) {
  if (!Array.isArray(lignes)) return null;
  return lignes.filter((l) => l && l.d && l.d.decision).slice().sort((a, b) => {
    const ra = RANG_DECISION[a.d.decision] ?? 9, rb = RANG_DECISION[b.d.decision] ?? 9;
    if (ra !== rb) return ra - rb;
    if (a.d.decision === 'baisser') { const ga = a.d.prix - a.d.sugg, gb = b.d.prix - b.d.sugg; if (ga !== gb) return gb - ga; }
    if (a.d.decision === 'garder' && !!a.d.geste !== !!b.d.geste) return a.d.geste ? -1 : 1;
    return (Number(b.age) || 0) - (Number(a.age) || 0) || (String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0);
  });
}
// Le résumé de tête : { baisser, garder, achat }.
export function resumeConseils(lignes) {
  const r = { baisser: 0, garder: 0, achat: 0 };
  for (const l of lignes || []) if (l && l.d && r[l.d.decision] != null) r[l.d.decision] += 1;
  return r;
}
