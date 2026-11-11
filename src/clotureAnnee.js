// ══════════════════════════════════════════════════════════════════════════════
//  « CLÔTURER L'ANNÉE » (11 nov., lot cloture-annee) — Argent → Déclarer
// ══════════════════════════════════════════════════════════════════════════════
// Une liste guidée, visible de décembre à mai (carte de Ma journée en décembre et
// janvier, une fois) : huit étapes, chacune avec son état CONSTATÉ et la porte
// vers l'écran qui la règle. TOUT EST LECTURE : rien n'est daté, saisi, déclaré
// ni exporté ici. Le seul geste écrit est « J'ai fini » (SON clic) : l'année est
// rangée clôturée dans `vrm_cloture_annee` ({ [AAAA]: { at, etapes } }).
//
// AUCUNE RÈGLE NEUVE (§5 « une règle par notion ») — ce fichier RANGE ce que les
// propriétaires disent déjà, passés en `R` par l'écran (l'audit passe les vrais) :
//   1. ventes à dater    = `ligne.aDater` de `vinted_urssaf_mois` (publiée par
//                          Ventes ; `annees` = par année de VENTE, `raisons` lot DJ7) ;
//   2. prix d'achat      = `beneficeDesJours` sur `vrm_benefice_jours` (n − nCout) ;
//   3. inventaire        = la publication `vrm_inventaire_annuel` (lot W) ;
//   4. CA de l'année     = `caAnnee` (src/microEntreprise.js) + les mois de la
//                          ligne, datés au VERSEMENT, comptes sélectionnés ;
//   5. URSSAF            = `montantPeriodeUrssaf` + `moisDeclare` (registre
//                          `vrm_urssaf_declare`, écrit sur SON clic seulement) ;
//   6. revenus           = `declarationRevenus` (cases selon SA réponse au
//                          versement libératoire ; pas répondu ⇒ jamais devinée) ;
//   7. seuils et DAC7    = `jaugeSeuils` + `dac7ParPlateforme` (src/seuilsAnnee.js) ;
//   8. export            = la carte « Exporter pour mon comptable », période = l'année.
// Trois états partout (§5) : `undefined` en cours · `null` pas su · valeur lue.
// « Pas su » ne vaut jamais « ✓ ». Exécuté par scripts/audit-cloture-annee.cjs.

export const CLE_CLOTURE = 'vrm_cloture_annee';
export const CLE_CLOTURE_VUE = 'vrm_cloture_vue';
// Le geste de Ma journée : ouvrir Déclarer et montrer la carte (lue par l'écran au montage).
export const DEMANDE_CLOTURE = { at: 0 };

// L'année à clôturer : en décembre, l'année en cours ; de janvier à mai, celle
// qui vient de finir ; de juin à novembre, aucune (l'écran se tait).
export function anneeACloturer(maintenant = Date.now()) {
  const d = new Date(maintenant), m = d.getMonth();
  if (m === 11) return d.getFullYear();
  if (m <= 4) return d.getFullYear() - 1;
  return null;
}
// La carte de Ma journée : décembre et janvier seulement, une fois (pas vue, pas clôturée).
export function carteJournee({ maintenant = Date.now(), cloture, vue, regime } = {}) {
  const m = new Date(maintenant).getMonth();
  if (!(m === 11 || m === 0)) return null;
  if (regime === undefined || regime === 'particulier') return null;
  const annee = anneeACloturer(maintenant);
  if (annee == null) return null;
  if (anneeCloturee(cloture, annee)) return null;
  if (vue && typeof vue === 'object' && vue[String(annee)]) return null;
  return { annee };
}
export const anneeCloturee = (cloture, annee) => !!(cloture && typeof cloture === 'object' && cloture[String(annee)] && Number(cloture[String(annee)].at) > 0);

const r2 = (x) => Math.round(x * 100) / 100;
const YM = (a, m) => `${a}-${String(m).padStart(2, '0')}`;
const finAnnee = (annee) => new Date(Number(annee) + 1, 0, 1).getTime();
const tsDe = (v) => (typeof v === 'number' ? v : Date.parse(v || ''));

const encours = (cle, x = {}) => ({ cle, etat: 'encours', n: null, ...x });
const passu = (cle, raison, x = {}) => ({ cle, etat: 'passu', n: null, raison, ...x });
const sansObjet = (cle, raison, x = {}) => ({ cle, etat: 'na', n: null, raison, ...x });

// ── 1. Les ventes sans date de versement qui peuvent tomber dans l'année ──
// Une vente vendue APRÈS l'année ne peut pas y être versée : écartée. Les autres
// (vendues l'année ou avant, ou date de vente illisible) restent « à dater ».
function etapeADater(ligne, annee) {
  if (ligne === undefined) return encours('adater');
  if (!ligne || !Array.isArray(ligne.mois)) return passu('adater', 'publication');
  const ad = ligne.aDater || {};
  const total = Number(ad.n) || 0;
  let n = total;
  if (ad.annees && typeof ad.annees === 'object') {
    let apres = 0;
    for (const [y, q] of Object.entries(ad.annees)) if (Number(y) > Number(annee)) apres += Number(q && q.n) || 0;
    n = Math.max(0, total - apres);
  }
  const raisons = Array.isArray(ad.raisons) ? ad.raisons.filter((r) => r && r.n > 0).map((r) => ({ cle: r.cle, n: r.n, comptes: Array.isArray(r.comptes) ? r.comptes : [] })) : [];
  return { cle: 'adater', etat: n > 0 ? 'manque' : 'ok', n, raisons, toutes: total };
}

// ── 2. Les ventes de l'année sans prix d'achat ──
function etapePrix(joursBenef, annee, maintenant, R) {
  if (joursBenef === undefined) return encours('prix');
  if (!joursBenef || !joursBenef.jours) return passu('prix', 'publication');
  if (typeof R.moisCouvert === 'function' && !R.moisCouvert(YM(annee, 1), maintenant)) return passu('prix', 'ancien');
  const B = R.beneficeDesJours(joursBenef.jours, new Date(Number(annee), 0, 1), new Date(Number(annee) + 1, 0, 1));
  const sur = Number(B && B.n) || 0;
  const n = Math.max(0, sur - (Number(B && B.nCout) || 0));
  return { cle: 'prix', etat: n > 0 ? 'manque' : 'ok', n, sur };
}

// ── 3. L'inventaire au 31/12 ──
// VRM ne reconstitue pas le stock d'un jour passé (lot W) : il dit le jour de la
// liste lue, et ce n'est « ✓ » que si elle a été lue LE 31 décembre.
export const jourIso = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
function etapeInventaire(inv, annee, maintenant) {
  const dernier = `${annee}-12-31`;
  const avant = jourIso(maintenant) < dernier;
  if (inv === undefined) return encours('inventaire');
  const lue = inv && Number(inv.at) > 0 ? jourIso(inv.at) : '';
  const v = inv && inv.v ? { centimes: inv.v.centimes, n: inv.v.n, nSans: inv.v.nSans } : null;
  if (avant) return { cle: 'inventaire', etat: 'attente', n: null, jour: dernier, lue, v, partiel: !!(inv && inv.partiel) };
  if (!inv) return passu('inventaire', 'publication', { jour: dernier });
  if (lue !== dernier) return passu('inventaire', 'pas-ce-jour', { jour: dernier, lue, v, partiel: !!inv.partiel });
  if (v && v.nSans > 0) return { cle: 'inventaire', etat: 'manque', n: v.nSans, jour: dernier, lue, v, partiel: !!inv.partiel };
  if (inv.partiel) return passu('inventaire', 'partiel', { jour: dernier, lue, v, partiel: true });
  return { cle: 'inventaire', etat: 'ok', n: 0, jour: dernier, lue, v, partiel: false };
}

// ── 4. Le chiffre d'affaires de l'année, mois par mois (daté au VERSEMENT) ──
// Un mois absent d'une ligne publiée après sa fin = rien versé ce mois-là (la ligne
// est une lecture complète) ; un mois pas fini à la publication ⇒ « — ».
function etapeCa(ligne, annee, R) {
  if (ligne === undefined) return encours('ca');
  if (!ligne || !Array.isArray(ligne.mois)) return passu('ca', 'publication');
  const C = R.caAnnee(ligne, annee);
  if (!C) return passu('ca', 'publication');
  const at = tsDe(ligne.at);
  const mois = [];
  for (let m = 1; m <= 12; m++) {
    const ym = YM(annee, m);
    const fin = new Date(Number(annee), m, 1).getTime();
    const l = ligne.mois.find((x) => x && x.ym === ym);
    const lu = Number.isFinite(at) && at >= fin;
    mois.push({ ym, ca: l ? r2(Number(l.ca) || 0) : (lu ? 0 : null), n: l ? Number(l.n) || 0 : (lu ? 0 : null) });
  }
  const avantFin = !(Number.isFinite(at) && at >= finAnnee(annee));
  const raisons = [...C.raisons];
  if (avantFin) raisons.push('calculé avant la fin de l’année');
  const partiel = C.partiel || avantFin;
  return { cle: 'ca', etat: partiel ? 'manque' : 'ok', n: null, ca: C.ca, partiel, raisons, mois, aDaterSur: C.aDaterSur || null, avantFin };
}

// ── 5. Les déclarations URSSAF de l'année (micro seulement) ──
function periodesAnnee(annee, freq) {
  const out = [];
  if (freq === 'mensuel') {
    for (let m = 1; m <= 12; m++) out.push({ cle: YM(annee, m), yms: [YM(annee, m)], periodStart: new Date(Number(annee), m - 1, 1), periodEnd: new Date(Number(annee), m, 0), limite: new Date(Number(annee), m + 1, 0) });
  } else {
    for (let q = 0; q < 4; q++) out.push({ cle: `${annee}-T${q + 1}`, yms: [1, 2, 3].map((i) => YM(annee, q * 3 + i)), periodStart: new Date(Number(annee), q * 3, 1), periodEnd: new Date(Number(annee), q * 3 + 3, 0), limite: new Date(Number(annee), q * 3 + 4, 0) });
  }
  return out;
}
function etapeUrssaf({ regime, freq, declare, ligne, taux, annee, maintenant, R }) {
  if (regime === undefined) return encours('urssaf');
  if (regime == null) return passu('urssaf', 'statut');
  if (regime !== 'micro') return sansObjet('urssaf', 'statut-' + regime);
  if (declare === undefined || ligne === undefined) return encours('urssaf');
  const P = periodesAnnee(annee, freq === 'mensuel' ? 'mensuel' : 'trimestriel').map((p) => {
    const faite = p.yms.every((ym) => R.moisDeclare(declare, ym));
    const finie = maintenant >= new Date(p.periodEnd.getFullYear(), p.periodEnd.getMonth(), p.periodEnd.getDate() + 1).getTime();
    let apayer = null, partiel = false;
    if (!faite) { const M = R.montantPeriodeUrssaf(p, ligne, taux); apayer = M.apayer; partiel = !!M.partiel; }
    return { cle: p.cle, faite, finie, limite: p.limite.getTime(), apayer, partiel };
  });
  const restent = P.filter((p) => !p.faite);
  const sues = restent.filter((p) => p.apayer != null);
  const reste = restent.length === 0 ? 0 : sues.length ? r2(sues.reduce((s, p) => s + p.apayer, 0)) : null;
  const restePartiel = restent.some((p) => p.apayer == null || p.partiel);
  return { cle: 'urssaf', etat: restent.length ? 'manque' : 'ok', n: restent.length, periodes: P, faites: P.length - restent.length, sur: P.length, reste, restePartiel, freq: freq === 'mensuel' ? 'mensuel' : 'trimestriel' };
}

// ── 6. La déclaration de revenus : le montant à reporter et la case ──
// Les cases viennent de `declarationRevenus` (notice 2042-C-PRO lue le 29 oct.
// 2026 : revenus 2025). Une année plus récente que la notice lue : la case est
// dite « à revérifier sur la notice de l'année », jamais présentée comme sûre.
export const NOTICE_LUE = { annee: 2025, notice: '2042-C-PRO 2026', lue: '29 octobre 2026', source: 'impots.gouv.fr' };
function etapeRevenus({ regime, ligne, liberatoire, annee, R }) {
  if (regime === undefined) return encours('revenus');
  if (regime == null) return passu('revenus', 'statut');
  if (regime !== 'micro') return sansObjet('revenus', 'statut-' + regime);
  if (ligne === undefined) return encours('revenus');
  const dr = R.declarationRevenus({ ligne, now: new Date(Number(annee), 11, 31, 12), liberatoire });
  if (!dr) return passu('revenus', 'publication');
  const aReverifier = Number(annee) > NOTICE_LUE.annee;
  if (dr.liberatoire == null) return { cle: 'revenus', etat: 'manque', n: null, raison: 'liberatoire', ca: dr.ca, partiel: dr.partiel, cases: dr.cases, aReverifier };
  return { cle: 'revenus', etat: dr.partiel ? 'manque' : 'ok', n: null, raison: dr.partiel ? 'partiel' : '', ca: dr.ca, partiel: dr.partiel, raisons: dr.raisons, cases: dr.cases, liberatoire: dr.liberatoire, aReverifier };
}

// ── 7. Les seuils (micro, TVA) et DAC7 ──
function etapeSeuils({ regime, ligne, activite, annee, R }) {
  if (regime === undefined || ligne === undefined) return encours('seuils');
  if (!ligne || !Array.isArray(ligne.mois)) return passu('seuils', 'publication');
  const D = R.dac7ParPlateforme({ ligne, annee: Number(annee) });
  const dac7 = D ? D.plateformes.map((p) => ({ plateforme: p.plateforme, etat: p.etat, n: p.n, centimes: p.centimes, verdict: p.verdict, partiel: !!p.partiel })) : [];
  let J = null;
  if (regime === 'micro') {
    J = R.jaugeSeuils({ ligne, now: new Date(Number(annee), 11, 31, 12), activite });
    if (!J) return passu('seuils', 'seuils-annee', { dac7 });
  }
  const tva = J ? J.tva.etat : null, plafond = J ? J.plafond.etat : null;
  const alerte = (tva && tva !== 'ok' && tva !== 'proche') || (plafond && plafond !== 'ok' && plafond !== 'proche');
  return { cle: 'seuils', etat: alerte ? 'alerte' : (J && J.partiel) ? 'passu' : 'ok', n: null, raison: J && J.partiel ? 'partiel' : '',
    tva, plafond, pctTva: J ? J.tva.pct : null, pctPlafond: J ? J.plafond.pct : null, ca: J ? J.ca : null, partiel: J ? J.partiel : false,
    seuils: J ? { tvaBase: J.seuils.tvaBase, tvaMajore: J.seuils.tvaMajore, plafondVente: J.seuils.plafondVente, verifie: J.seuils.verifie } : null, dac7 };
}

// ── 8. L'export de l'année pour le comptable : VRM ne sait pas s'il est parti ──
const etapeExport = (annee) => ({ cle: 'export', etat: 'geste', n: null, periode: String(annee) });

// L'ensemble. Entrées = celles de l'écran (rien n'est relu ici).
export function clotureAnnee({ annee, maintenant = Date.now(), ligne, joursBenef, inventaire, declare, regime, freq, taux, liberatoire = null, activite = 'vente', cloture, R } = {}) {
  if (annee == null || !R) return null;
  const etapes = [
    etapeADater(ligne, annee),
    etapePrix(joursBenef, annee, maintenant, R),
    etapeInventaire(inventaire, annee, maintenant),
    etapeCa(ligne, annee, R),
    etapeUrssaf({ regime, freq, declare, ligne, taux, annee, maintenant, R }),
    etapeRevenus({ regime, ligne, liberatoire, annee, R }),
    etapeSeuils({ regime, ligne, activite, annee, R }),
    etapeExport(annee),
  ];
  const comptees = etapes.filter((e) => e.etat !== 'na' && e.etat !== 'geste');
  const faites = comptees.filter((e) => e.etat === 'ok').length;
  const aFaire = comptees.filter((e) => e.etat === 'manque' || e.etat === 'alerte' || e.etat === 'attente').length;
  const passuN = comptees.filter((e) => e.etat === 'passu').length;
  const enCours = etapes.some((e) => e.etat === 'encours');
  const close = cloture === undefined ? undefined : anneeCloturee(cloture, annee);
  const etat = close ? 'cloturee' : enCours ? 'encours' : aFaire ? 'afaire' : passuN ? 'passu' : 'pret';
  return { annee: Number(annee), etat, etapes, faites, sur: comptees.length, aFaire, passu: passuN,
    clotureeLe: close ? Number(cloture[String(annee)].at) : null };
}

// Ce que « J'ai fini » range (SON clic) : la date et l'état CONSTATÉ de chaque étape.
export function enregistrementCloture(K, maintenant = Date.now()) {
  return { at: maintenant, etapes: Object.fromEntries((K && K.etapes ? K.etapes : []).map((e) => [e.cle, e.etat])) };
}
