// ═══════════════════════════════════════════════════════════════════════════
// « EXPORTER POUR MON COMPTABLE » — un tableur et un PDF d'une page (9 novembre)
// ═══════════════════════════════════════════════════════════════════════════
// Julien (« fais tout ») : Comptabilité → « Exporter pour mon comptable » ⇒ une
// période (mois, trimestre, année), un fichier CSV (UTF-8 avec BOM, « ; »,
// virgule décimale : Excel en français l'ouvre tel quel) et un PDF récapitulatif
// d'UNE page, fabriqué dans le navigateur (pdf-lib, déjà dans le dépôt).
//
// AUCUNE RÈGLE ICI (§5 « une seule règle par notion ») — ce module MET EN PAGE :
//   · les VENTES       = le livre des recettes (`livreDesRecettes`, src/registres.js),
//                        c.-à-d. les lignes de `ventesDeclarables` (App.jsx) : datées
//                        au VERSEMENT, montant reçu, comptes exclus déjà dehors ;
//                        les « à dater » (sans date de versement) sont listées À PART,
//                        dans aucun mois ;
//   · les ACHATS       = le registre des achats (`registreDesAchats`) : « coût saisi »
//                        = les prix d'achat QU'IL a tapés sur les fiches reliées à CET
//                        achat par SON n° de transaction (`buyFromId`), sinon vide ;
//   · le CA DÉCLARÉ    = la ligne publiée par Ventes (`vinted_urssaf_mois`), mois par
//                        mois, et le total de la période par `montantPeriodeUrssaf`
//                        (la règle de la carte « Prochaine déclaration ») ;
//   · l'URSSAF         = `aPayerUrssaf` au taux réglé, SEULEMENT pour un
//                        micro-entrepreneur (`regimeFiscal`) ; un autre statut, ou
//                        aucun statut choisi (`null`) ⇒ non calculée, et c'est dit.
// « Pas su » s'écrit « — » (jamais 0) ; un total incomplet dit « au moins » et
// nomme ce qui manque ; jamais « encaissé » (§5).
// ─────────────────────────────────────────────────────────────────────────────
import { mentionFacture, cleFactureLigne } from './factureAchat.js';
import { PERIODE_OK, libellePeriode, moisDePeriode, jourFr, eurosTexte } from './registres.js';
import { moisParis, moisRecents } from './dateParis.js';
import { valeurSue } from './sommeConnue.js';
import { beneficeReleve } from './vraiBenefice.js';

export { libellePeriode };
export const TYPES_PERIODE = [['mois', 'Mois'], ['trimestre', 'Trimestre'], ['annee', 'Année']];

// Les périodes proposées, les plus récentes d'abord (13 mois, 5 trimestres, 2 ans).
export function periodesExport(type, maintenant = Date.now()) {
  const ym0 = moisParis(maintenant), y = Number(ym0.slice(0, 4)), m = Number(ym0.slice(5, 7)) - 1;   // (11 nov.) mois de PARIS
  if (type === 'annee') return [String(y), String(y - 1)];
  if (type === 'trimestre') {
    const out = []; let a = y, t = Math.floor(m / 3) + 1;
    for (let i = 0; i < 5; i++) { out.push(`${a}-T${t}`); t -= 1; if (t < 1) { t = 4; a -= 1; } }
    return out;
  }
  return moisRecents(13, maintenant);
}

// Les bornes d'une période, sous la forme que lit `montantPeriodeUrssaf`
// ({ periodStart, periodEnd } : premier et dernier jour, heure locale).
export function bornesPeriode(periode) {
  const yms = moisDePeriode(periode);
  if (!yms.length) return null;
  const [y0, m0] = yms[0].split('-').map(Number), [y1, m1] = yms[yms.length - 1].split('-').map(Number);
  return { periodStart: new Date(y0, m0 - 1, 1), periodEnd: new Date(y1, m1, 0), yms };
}
export const nomFichierExport = (periode, ext) => `Export-comptable-${periode}.${ext}`;

const DATE_PAS_LUE = { Leboncoin: 'pas captée (datée à la vente)', eBay: 'non transmise (datée à la commande)' };
const RAISON_URSSAF = {
  particulier: 'URSSAF non calculée : un particulier n’a rien à déclarer à l’URSSAF',
  societe: 'URSSAF non calculée : en société, cotisations et impôts ne se calculent pas sur le chiffre d’affaires',
  marge: 'URSSAF non calculée : au régime de la marge, VRM ne calcule pas de cotisation',
  null: 'URSSAF non calculée : choisis ton statut (la question est en haut de Comptabilité)',
};
export const raisonUrssaf = (regime) => (regime === 'micro' ? '' : (RAISON_URSSAF[regime] || RAISON_URSSAF.null));


// ── (27 nov., lot compta-export — Julien : « Fait la compta ») LE DÉTAIL DE CHAQUE VENTE ─────────────
// Le comptable veut, vente par vente : prix de vente, montant reçu, frais, prix d'achat, port, bénéfice.
// AUCUNE RÈGLE NEUVE : tout vient du relevé de Ventes (`vrm_stats_ventes`, une ligne par vente finalisée :
// [plateforme, compte, id, ts, vente €, achat €, frais notés €, titre, N°, versement, lot, détail des frais]),
// retrouvé PAR L'IDENTITÉ de la vente (la clé de `recettesDe`), jamais par le titre. Le bénéfice d'une vente
// = la règle des marges (`margesPar`, src/statsVentes.js : vente − achat − frais notés ; null si l'achat ou
// un frais n'est pas su) — la même que Statistiques et le bénéfice du mois (avant URSSAF et dépenses).
// Une identité portée par DEUX lignes du relevé : rien (jamais l'une des deux au hasard).
export const cleReleve = (l) => (Array.isArray(l) && l[2] != null && String(l[2]) !== '' ? (l[0] === 'Vinted' ? 'vinted:' + l[2] : String(l[2])) : '');
export function indexReleve(lignes) {
  if (!Array.isArray(lignes)) return null;
  const m = new Map();
  for (const l of lignes) { const k = cleReleve(l); if (!k) continue; m.set(k, m.has(k) ? null : l); }
  return m;
}
const nombreOuNull = (x) => (x == null || x === '' || !Number.isFinite(Number(x)) ? null : Math.round(Number(x) * 100) / 100);
// Le détail d'une vente par SA ligne du relevé (pas de ligne : tout « — »).
export function detailVenteReleve(r, plateforme) {
  if (!Array.isArray(r)) return { prixVente: null, achat: null, fraisNotes: null, port: null, benefice: null };
  const det = Array.isArray(r[11]) && r[11].length === 4 ? r[11] : null;
  const fraisNotes = r[6] === null ? null : nombreOuNull(r[6]);
  const achat = nombreOuNull(r[5]);
  // eBay : le relevé porte ce que tu REÇOIS (`montantRecuEbay`), pas le prix payé par l'acheteur ⇒ « — ».
  const prixVente = plateforme === 'eBay' ? null : nombreOuNull(r[4]);
  // (27 nov., lot vrai-benefice) Le bénéfice : LA règle de src/vraiBenefice.js (`margesPar` sur cette ligne) — la même que
  // Statistiques › Gains (« Par mois », « Par compte ») : l'écran et l'export ne peuvent pas diverger.
  const benefice = beneficeReleve(r);
  // Le port payé par lui : seulement quand la fiche le DÉTAILLE (src/coutPlateformes.js `detailFraisFiche`).
  const port = det && Number.isSafeInteger(det[1]) ? det[1] / 100 : null;
  return { prixVente, achat, fraisNotes, port, benefice };
}
// La référence de L'ACHAT d'une vente : la ligne du registre des achats dont les fiches reliées (`buyFromId`,
// SON clic) portent le N° de CETTE vente — UNE seule ligne, sinon rien ; Vinted seulement (le n° de
// transaction est l'identité du reçu). « reçu » : le montant de cet achat vient de SON reçu (par son n°).
const cleN = (n) => { const s = String(n == null ? '' : n).trim().toUpperCase().replace(/[\s\-_.]/g, ''); return /^\d+$/.test(s) ? String(parseInt(s, 10)) : s; };
export function indexAchatsParNum(lignes) {
  if (!Array.isArray(lignes)) return null;
  const m = new Map();
  for (const a of lignes) {
    if (!a || !a.num) continue;
    for (const n of String(a.num).split('+').map(cleN).filter(Boolean)) m.set(n, m.has(n) && m.get(n) !== a ? null : a);
  }
  return m;
}
export function achatDeVente(num, idx) {
  const k = cleN(num);
  if (!k || !idx) return null;
  const a = idx.get(k);
  if (!a || a.plateforme !== 'Vinted' || !a.reference) return null;
  return { reference: String(a.reference), recu: a.source === 'recu' };
}
// Une vente dans une autre devise que l'euro (raison posée par `ventesDeclarables` / `montantRecuEbay`).
export const HORS_EURO = /^(devise|autre devise)\b/i;

// Les données de l'export. Entrées (déjà calculées par les règles de l'app) :
//   periode      'AAAA' | 'AAAA-Tn' | 'AAAA-MM'
//   recettes     `livreDesRecettes(...)` pour CETTE période (null = pas su)
//   achats       `registreDesAchats(...)` pour CETTE période (null = pas su)
//   ligne        `vinted_urssaf_mois` (null = jamais publiée)
//   regime       `regimeFiscal()` : 'micro' | 'particulier' | 'societe' | 'marge' | null
//   taux         `tauxUrssaf()` (en %)
//   montantPeriode(due, ligne, taux) = `montantPeriodeUrssaf` ; aPayer(ca, taux) = `aPayerUrssaf`
//   libelleRegime(regime), entreprise ({ nom, siret } | null), maintenant
// (10 nov., lot AN) `factures` : { clé → meta } des factures d'achat JOINTES (src/factureAchat.js), sans contenu ;
// la ligne d'achat le MENTIONNE (« facture jointe (nom) ») — null = pas lu, aucune mention inventée.
// (27 nov.) `releve` : les lignes de `vrm_stats_ventes` (null = pas lu : prix de vente, achat, bénéfice « — » ;
// non passé : pas de colonnes de détail) ; `achatsRef` : des lignes du registre des achats (les périodes utiles)
// pour la référence d'achat d'une vente.
export function donneesExportComptable({ periode, recettes = null, achats = null, ligne = null, regime = null, taux = null, montantPeriode, aPayer, libelleRegime = (r) => String(r || ''), entreprise = null, maintenant = Date.now(), factures = null, compta, releve, achatsRef = null } = {}) {
  if (!PERIODE_OK.test(String(periode || ''))) return null;
  const bornes = bornesPeriode(periode);
  const ymNow = moisParis(maintenant);   // (11 nov.) mois de PARIS
  const micro = regime === 'micro';
  // Le CA déclaré, mois par mois : la ligne publiée (les mois à venir ne sont pas listés).
  const lu = ligne && Array.isArray(ligne.mois);
  const caParMois = lu ? bornes.yms.filter((ym) => ym <= ymNow).map((ym) => {
    const m = ligne.mois.find((x) => x && x.ym === ym);
    // (11 nov., famille « pas su ≠ 0 ») un mois PUBLIÉ au CA illisible s'écrit « — », jamais 0,00 €.
    const ca = m ? valeurSue(m.ca) : 0;
    return { ym, mois: libellePeriode(ym), n: m ? Number(m.n != null ? m.n : m.count) || 0 : 0, ca, urssaf: ca != null && micro && typeof aPayer === 'function' ? aPayer(ca, taux) : null, declare: !!(m && m.declare) };
  }) : null;
  const tot = lu && typeof montantPeriode === 'function' ? montantPeriode(bornes, ligne, taux) : { ca: null, apayer: null, partiel: false };
  const caDeclare = tot && tot.ca != null ? tot.ca : null;
  const partielCa = !!(tot && tot.partiel);
  const urssaf = micro && caDeclare != null ? (tot.apayer != null ? tot.apayer : (typeof aPayer === 'function' ? aPayer(caDeclare, taux) : null)) : null;
  // Les ventes de la période (versées), et les « à dater ».
  // (27 nov.) Le détail de chaque vente : par SON identité dans le relevé ; `releve` non passé ⇒ pas de colonnes.
  const idxR = releve === undefined ? undefined : indexReleve(releve);
  const idxA = indexAchatsParNum(achatsRef);
  const detail = (l) => {
    if (idxR === undefined) return {};
    const d = detailVenteReleve(idxR ? idxR.get(String(l.id)) : null, l.plateforme);
    const a = achatDeVente(l.num, idxA);
    // Sans N° (aucune fiche reliée), « frais notés » n'a rien noté : « — », jamais 0,00 € (le bénéfice reste « — » : pas d'achat).
    if (!l.num && d.achat == null) { d.fraisNotes = null; d.port = null; }
    return { ...d, refAchat: a ? a.reference : '', recuAchat: !!(a && a.recu) };
  };
  // (27 nov.) Une vente dans une AUTRE devise (eBay) : jamais convertie, hors des lignes et des totaux, listée à part.
  const estHorsEuro = (l) => HORS_EURO.test(String(l.raison || ''));
  const horsEuroL = recettes ? [...recettes.lignes, ...recettes.horsPeriode].filter(estHorsEuro) : null;
  const ventes = recettes ? recettes.lignes.filter((l) => !estHorsEuro(l)).map((l) => ({
    id: l.id, dateVente: l.tsVente != null ? jourFr(l.tsVente) : '', dateVersement: l.tsVersement != null ? jourFr(l.tsVersement) : (DATE_PAS_LUE[l.plateforme] || ''),
    plateforme: l.plateforme, compte: l.compte, num: l.num, reference: l.reference, titre: l.titre, montant: l.montant, note: l.raison || '',
    // (11 nov.) Les frais LUS de la plateforme (eBay) ; null = pas su (jamais 0).
    frais: Number.isFinite(l.frais) ? l.frais : null,
    // (27 nov.) Le mois où elle COMPTE (sa déclaration s'il y en a une) et ce que le registre dit d'elle.
    ym: l.ym || '', declaree: !!l.declaree, ymVers: l.ymVers || '', apres: !!l.apres, dateCompte: l.date || '',
    ...detail(l),
  })) : null;
  const aDater = recettes ? recettes.horsPeriode.filter((l) => !estHorsEuro(l)).map((l) => ({
    id: l.id, dateVente: l.tsVente != null ? jourFr(l.tsVente) : '', plateforme: l.plateforme, compte: l.compte, num: l.num, reference: l.reference, titre: l.titre, montant: l.montant, note: l.raison || 'à dater',
  })) : null;
  const horsEuro = horsEuroL ? horsEuroL.map((l) => ({ id: l.id, dateVente: l.tsVente != null ? jourFr(l.tsVente) : '', plateforme: l.plateforme, compte: l.compte, num: l.num, reference: l.reference, titre: l.titre, devise: String(l.raison || '').replace(/^(autre )?devise\s*/i, '') || 'autre devise' })) : null;
  // Le bénéfice des ventes listées : la somme des bénéfices CONNUS, avec sa couverture (« 3 sur 5 ») — jamais « au moins »
  // (une vente au prix d'achat inconnu peut être à perte). Aucun connu ⇒ « — ».
  const avecBenef = ventes && idxR !== undefined ? ventes.filter((v) => v.benefice != null) : null;
  const beneficeVentes = avecBenef && avecBenef.length ? Math.round(avecBenef.reduce((t, v) => t + Math.round(v.benefice * 100), 0)) / 100 : null;
  const achatsL = achats ? achats.lignes.map((l) => ({
    id: l.id, date: l.date, plateforme: l.plateforme, fournisseur: l.compte || l.fournisseur || '', reference: l.reference, num: l.num, titre: l.titre,
    saisi: l.saisi == null ? null : l.saisi, lu: l.source === 'saisi' ? null : l.montant, sourceLue: l.source === 'recu' ? 'reçu Vinted' : l.source === 'article' ? 'article seul (sans port ni frais)' : '', note: l.raison || '',
    facture: mentionFacture(l, factures),
    // (11 nov.) La clé de SA facture jointe (le zip la range) ; '' = aucune.
    factureCle: factures && cleFactureLigne(l) && factures[cleFactureLigne(l)] ? cleFactureLigne(l) : '',
  })) : null;
  const sansCout = achatsL ? achatsL.filter((l) => l.saisi == null).length : null;
  // Aucun coût saisi sur des achats de la période : « pas su » (« — »), jamais « au moins 0,00 € » (§5).
  const coutSaisi = !achatsL || (achatsL.length && sansCout === achatsL.length) ? null : Math.round(achatsL.reduce((t, l) => t + (l.saisi == null ? 0 : Math.round(l.saisi * 100)), 0)) / 100;
  const nonComptees = lu && ligne.nonComptees && Number(ligne.nonComptees.n) > 0 ? Number(ligne.nonComptees.n) : 0;
  // (23 nov., lot export-comptable) Les dépenses NOTÉES de la période et le reçu par plateforme (voir plus bas).
  const dep = depensesPeriode(compta, bornes);
  const parPlateforme = recuParPlateforme(ventes);
  return {
    periode: String(periode), libelle: libellePeriode(periode), etabliLe: jourFr(maintenant),
    entreprise: entreprise && String(entreprise.nom || '').trim() ? { nom: String(entreprise.nom).trim(), siret: String(entreprise.siret || '').trim() } : null,
    regime: regime == null ? null : regime, regimeTexte: libelleRegime(regime), taux: micro ? taux : null, raisonUrssaf: raisonUrssaf(regime),
    caParMois, caDeclare, partielCa, urssaf, ligneLue: !!lu,
    ventes, nVentes: ventes ? ventes.length : null, totalVentes: recettes ? recettes.total : null, ventesCompletes: recettes ? recettes.complet : false, manqueVentes: recettes ? recettes.manque : [],
    sansMontantVentes: recettes ? recettes.sansMontant - recettes.lignes.filter(estHorsEuro).length : 0,
    horsEuro, nHorsEuro: horsEuro ? horsEuro.length : null,
    detaille: idxR !== undefined, releveLu: !!idxR, beneficeVentes, nBenefice: avecBenef ? avecBenef.length : null,
    aDater, nADater: aDater ? aDater.length : null,
    achats: achatsL, nAchats: achatsL ? achatsL.length : null, sansCout, coutSaisi, manqueAchats: achats ? achats.manque : [],
    nonComptees,
    depenses: dep ? dep.lignes : null, nDepenses: dep ? dep.lignes.length : null, totalDepenses: dep ? dep.total : null, fixesNonDetailles: dep ? dep.fixes : 0,
    parPlateforme,
  };
}

// ── (23 nov., lot export-comptable) LES DÉPENSES NOTÉES DE LA PÉRIODE ────────
// Julien (validé le 23 nov.) : l'export pour l'expert-comptable dit aussi « les frais ». La source est la
// ligne de Comptabilité (`vrm_compta`, la MÊME que « + Dépense » et que `comptaChargesMois`) : les dépenses
// ponctuelles (`depenses`) et les packs (`packs`) DATÉS dans la période, tels qu'IL les a notés. Les coûts
// fixes (sans date de début) et les abonnements ne sont pas recopiés ligne à ligne : leur historique n'est
// pas connu (la règle de Comptabilité les compte « au tarif actuel ») — l'export le DIT (couverture), il ne
// les invente pas. `compta` : undefined (pas passée) · null (pas lue) ⇒ null ; un objet ⇒ { lignes, total, fixes }.
// Une ligne au montant illisible est écartée ET comptée (`illisibles`) — jamais lue « 0 ».
// Une dépense est dans la période si son MOIS (AAAA-MM, la date qu'il a notée) en est un — la règle de `comptaChargesMois`.
const DANS = (iso, b) => /^\d{4}-\d{2}-\d{2}/.test(String(iso || '')) && Array.isArray(b.yms) && b.yms.includes(String(iso).slice(0, 7));
export function depensesPeriode(compta, bornes) {
  if (!compta || typeof compta !== 'object' || Array.isArray(compta) || !bornes) return null;
  const lignes = [];
  let illisibles = 0;
  const prendre = (x, sorte) => {
    if (!x || typeof x !== 'object' || !DANS(x.date, bornes)) return;
    const m = Number(x.montant);
    if (!Number.isFinite(m) || m <= 0) { illisibles++; return; }
    lignes.push({ date: jourFr(Date.parse(String(x.date).slice(0, 10) + 'T12:00:00')), iso: String(x.date).slice(0, 10), sorte, categorie: String(x.cat || ''), libelle: String(x.libelle || x.nom || '').trim(), montant: Math.round(m * 100) / 100, ticket: !!x.ticket });
  };
  for (const x of (Array.isArray(compta.depenses) ? compta.depenses : [])) prendre(x, 'depense');
  for (const x of (Array.isArray(compta.packs) ? compta.packs : [])) prendre(x, 'pack');
  lignes.sort((a, b) => a.iso.localeCompare(b.iso));
  const total = Math.round(lignes.reduce((t, l) => t + Math.round(l.montant * 100), 0)) / 100;
  const fixes = (Array.isArray(compta.fixes) ? compta.fixes.length : 0) + (Array.isArray(compta.abonnements) ? compta.abonnements.length : 0);
  return { lignes, total, fixes, illisibles };
}

// ── LE REÇU PAR PLATEFORME (les versements de la période) ────────────────────
// Rien de recalculé : les lignes de VENTES de l'export (le livre des recettes, datées au VERSEMENT, montant
// reçu), regroupées par plateforme — nombre, montant reçu, frais LUS (eBay). Une vente au montant pas lu est
// comptée à part (`sansMontant`) et le total du site dit « au moins ». Ventes pas lues ⇒ null.
export function recuParPlateforme(ventes) {
  if (!Array.isArray(ventes)) return null;
  const G = new Map();
  for (const v of ventes) {
    const k = String(v.plateforme || '') || '—';
    const g = G.get(k) || { plateforme: k, n: 0, montant: 0, sansMontant: 0, frais: 0, fraisLus: 0 };
    g.n++;
    if (v.montant == null || !Number.isFinite(Number(v.montant))) g.sansMontant++;
    else g.montant = Math.round((g.montant + Number(v.montant)) * 100) / 100;
    if (Number.isFinite(v.frais)) { g.frais = Math.round((g.frais + v.frais) * 100) / 100; g.fraisLus++; }
    G.set(k, g);
  }
  // Aucun montant lu sur ce site : « — » (null), jamais 0,00 €.
  for (const g of G.values()) if (g.sansMontant === g.n) g.montant = null;
  return [...G.values()].sort((a, b) => (b.montant || 0) - (a.montant || 0) || a.plateforme.localeCompare(b.plateforme));
}

// Le résumé : [libellé, valeur, clé] — le même pour le PDF et le tableur.
export function resumeExport(d) {
  const L = [];
  L.push(['Statut', d.regimeTexte || '—', 'statut']);
  L.push(['Ventes versées sur la période', d.nVentes == null ? '—' : String(d.nVentes), 'n-ventes']);
  L.push(['Montant reçu de ces ventes', d.totalVentes == null ? '—' : `${d.ventesCompletes ? '' : 'au moins '}${eurosTexte(d.totalVentes)}`, 'total-ventes']);
  L.push(['CA déclaré (daté au versement)', d.caDeclare == null ? '—' : `${d.partielCa ? 'au moins ' : ''}${eurosTexte(d.caDeclare)}`, 'ca']);
  if (d.regime === 'micro') L.push([`URSSAF à payer (${String(d.taux).replace('.', ',')} %)`, d.urssaf == null ? '—' : `${d.partielCa ? 'au moins ' : ''}${eurosTexte(d.urssaf)}`, 'urssaf']);
  else L.push(['URSSAF', 'non calculée', 'urssaf']);
  // (27 nov.) Le bénéfice des ventes listées (avant URSSAF et dépenses), sa couverture À CÔTÉ.
  if (d.detaille) L.push(['Bénéfice de ces ventes (avant URSSAF et dépenses)', d.beneficeVentes == null ? '—' : `${eurosTexte(d.beneficeVentes)}${d.nBenefice < d.nVentes ? ` · ${d.nBenefice} sur ${d.nVentes}` : ''}`, 'benefice']);
  L.push(['Achats de la période', d.nAchats == null ? '—' : String(d.nAchats), 'n-achats']);
  // (11 nov.) La couverture À CÔTÉ du chiffre : « au moins 42,00 € · 1 sur 50 ».
  // (23 nov.) Les dépenses notées : pas lues ⇒ « — » (jamais 0) ; aucune notée ⇒ 0,00 € (lu : il n'en a noté aucune).
  if (d.nDepenses !== undefined) L.push(['Dépenses notées', d.totalDepenses == null ? '—' : `${eurosTexte(d.totalDepenses)} · ${d.nDepenses} ligne${d.nDepenses > 1 ? 's' : ''}`, 'depenses']);
  L.push(['Coût d’achat saisi', d.coutSaisi == null ? '—' : `${d.sansCout ? 'au moins ' : ''}${eurosTexte(d.coutSaisi)}${d.sansCout ? ` · ${d.nAchats - d.sansCout} sur ${d.nAchats}` : ''}`, 'cout']);
  return L;
}
// La couverture : ce qui manque, nommé (jamais tu).
export function couvertureExport(d) {
  const L = [];
  if (d.sansCout) L.push(`${d.sansCout} achat${d.sansCout > 1 ? 's' : ''} sans coût saisi`);
  if (d.nADater) L.push(`${d.nADater} vente${d.nADater > 1 ? 's' : ''} à dater (sans date de versement : dans aucun mois)`);
  if (d.nHorsEuro) L.push(`${d.nHorsEuro} vente${d.nHorsEuro > 1 ? 's' : ''} dans une autre devise : écartée${d.nHorsEuro > 1 ? 's' : ''}, jamais convertie${d.nHorsEuro > 1 ? 's' : ''} (listée${d.nHorsEuro > 1 ? 's' : ''} à part)`);
  if (d.detaille && d.nVentes && d.nBenefice < d.nVentes) L.push(`${d.nVentes - d.nBenefice} vente${d.nVentes - d.nBenefice > 1 ? 's' : ''} sans bénéfice calculé (prix d’achat ou frais pas sus)`);
  if (d.detaille && !d.releveLu) L.push('détail des ventes pas lu (prix d’achat, frais) : ouvre Ventes une fois');
  if (d.sansMontantVentes) L.push(`${d.sansMontantVentes} vente${d.sansMontantVentes > 1 ? 's' : ''} au montant pas lu`);
  if (d.nonComptees) L.push(`${d.nonComptees} vente${d.nonComptees > 1 ? 's' : ''} comptée${d.nonComptees > 1 ? 's' : ''} nulle part (montant pas lu)`);
  if (!d.ligneLue) L.push('CA déclaré pas encore calculé : ouvre Ventes une fois');
  for (const m of [...(d.manqueVentes || []), ...(d.manqueAchats || [])]) L.push(`pas lu : ${m}`);
  if (d.nDepenses === null) L.push('dépenses notées pas lues (Comptabilité)');
  if (d.fixesNonDetailles) L.push(`${d.fixesNonDetailles} coût${d.fixesNonDetailles > 1 ? 's' : ''} fixe${d.fixesNonDetailles > 1 ? 's' : ''} ou abonnement${d.fixesNonDetailles > 1 ? 's' : ''} : pas détaillé${d.fixesNonDetailles > 1 ? 's' : ''} ici (historique pas connu, voir Comptabilité)`);
  for (const g of (d.parPlateforme || [])) if (g.sansMontant) L.push(`${g.plateforme} : ${g.sansMontant} vente${g.sansMontant > 1 ? 's' : ''} versée${g.sansMontant > 1 ? 's' : ''} au montant pas lu`);
  if (d.raisonUrssaf) L.push(d.raisonUrssaf);
  if (d.totalVentes != null && d.caDeclare != null && Math.round(d.totalVentes * 100) !== Math.round(d.caDeclare * 100)) L.push('Ventes listées et CA déclaré diffèrent (vente déclarée dans un autre mois, ou Ventes relu depuis)');
  return L;
}

export const refAchatTexte = (v) => (v.refAchat ? `${v.refAchat}${v.recuAchat ? ' (reçu Vinted)' : ''}` : '');
export const noteVente = (v) => [v.note, v.declaree && v.ymVers && v.ymVers !== v.ym ? `déclarée en ${libellePeriode(v.ym)}` : '', v.apres ? 'à régulariser (mois déjà déclaré)' : ''].filter(Boolean).join(' · ');
const nbT = (x) => (x == null || !Number.isFinite(Number(x)) ? '' : (Math.round(Number(x) * 100) / 100).toFixed(2).replace('.', ','));
const cel = (v) => { const s = String(v == null ? '' : v).replace(/[  ]/g, ' '); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function csvExportComptable(d) {
  const L = [];
  L.push([`Export comptable — ${d.libelle}`]);
  if (d.entreprise) { L.push([d.entreprise.nom]); if (d.entreprise.siret) L.push([`SIRET ${d.entreprise.siret}`]); }
  L.push([`Établi le ${d.etabliLe} par VRM`]);
  L.push([]);
  L.push(['RÉSUMÉ']);
  for (const [k, v] of resumeExport(d)) L.push([k, v]);
  const cv = couvertureExport(d);
  if (cv.length) { L.push([]); L.push(['CE QUI MANQUE']); for (const c of cv) L.push([c]); }
  L.push([]);
  L.push(['CA DÉCLARÉ PAR MOIS (daté au versement)']);
  L.push(['Mois', 'Ventes', 'CA déclaré (€)', d.regime === 'micro' ? 'URSSAF à payer (€)' : 'URSSAF', 'Noté déclaré']);
  if (d.caParMois) for (const m of d.caParMois) L.push([m.mois, String(m.n), nbT(m.ca), d.regime === 'micro' ? nbT(m.urssaf) : 'non calculée', m.declare ? 'oui' : '']);
  else L.push(['—', 'CA déclaré pas encore calculé : ouvre Ventes une fois']);
  L.push(['Total', '', nbT(d.caDeclare), d.regime === 'micro' ? nbT(d.urssaf) : '', '']);
  L.push([]);
  L.push(['VENTES VERSÉES SUR LA PÉRIODE']);
  L.push(['Date de vente', 'Date de versement', 'Plateforme', 'Compte', 'N°', 'Référence', 'Titre', 'Prix de vente (€)', 'Montant reçu (€)', 'Frais lus (€)', 'Frais notés (€)', 'Prix d’achat (€)', 'dont port (€)', 'Bénéfice (€)', 'Réf. achat', 'Note']);
  if (d.ventes) { for (const v of d.ventes) L.push([v.dateVente, v.dateVersement, v.plateforme, v.compte, v.num, v.reference, v.titre, nbT(v.prixVente), nbT(v.montant), nbT(v.frais), nbT(v.fraisNotes), nbT(v.achat), nbT(v.port), nbT(v.benefice), refAchatTexte(v), noteVente(v)]); L.push(['', '', '', '', '', '', 'Total', '', nbT(d.totalVentes), '', '', '', '', nbT(d.beneficeVentes), '', [d.ventesCompletes ? '' : 'au moins', d.detaille && d.nBenefice != null && d.nBenefice < d.nVentes ? `bénéfice sur ${d.nBenefice} vente${d.nBenefice > 1 ? 's' : ''} sur ${d.nVentes}` : ''].filter(Boolean).join(' · ')]); }
  else L.push(['—', 'ventes pas lues']);
  L.push([]);
  L.push(['REÇU PAR PLATEFORME (ventes versées sur la période)']);
  L.push(['Plateforme', 'Ventes versées', 'Montant reçu (€)', 'Frais lus (€)', 'Note']);
  if (d.parPlateforme) for (const g of d.parPlateforme) L.push([g.plateforme, String(g.n), nbT(g.montant), g.fraisLus ? nbT(g.frais) : '', [g.sansMontant ? `au moins (${g.sansMontant} montant${g.sansMontant > 1 ? 's' : ''} pas lu${g.sansMontant > 1 ? 's' : ''})` : '', g.fraisLus && g.fraisLus < g.n ? `frais lus sur ${g.fraisLus} vente${g.fraisLus > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ')]);
  else L.push(['—', 'ventes pas lues']);
  L.push([]);
  L.push(['VENTES À DATER (sans date de versement : dans aucun mois)']);
  L.push(['Date de vente', 'Plateforme', 'Compte', 'N°', 'Référence', 'Titre', 'Montant reçu (€)', 'Note']);
  if (d.aDater) for (const v of d.aDater) L.push([v.dateVente, v.plateforme, v.compte, v.num, v.reference, v.titre, nbT(v.montant), v.note]);
  else L.push(['—']);
  L.push([]);
  L.push(['VENTES DANS UNE AUTRE DEVISE (écartées, jamais converties)']);
  L.push(['Date de vente', 'Plateforme', 'Compte', 'N°', 'Référence', 'Titre', 'Devise']);
  if (d.horsEuro && d.horsEuro.length) for (const v of d.horsEuro) L.push([v.dateVente, v.plateforme, v.compte, v.num, v.reference, v.titre, v.devise]);
  else L.push([d.horsEuro ? 'aucune' : '—']);
  L.push([]);
  L.push(['ACHATS DE LA PÉRIODE']);
  L.push(['Date', 'Plateforme', 'Compte ou fournisseur', 'Référence', 'N°', 'Article', 'Coût saisi (€)', 'Montant lu (€)', 'Montant lu sur', 'Note']);
  if (d.achats) { for (const a of d.achats) L.push([a.date, a.plateforme, a.fournisseur, a.reference, a.num, a.titre, nbT(a.saisi), nbT(a.lu), a.sourceLue, [a.saisi == null ? (a.note || 'coût pas saisi') : a.note, a.facture].filter(Boolean).join(' · ')]); L.push(['', '', '', '', '', 'Total saisi', nbT(d.coutSaisi), '', '', d.sansCout ? `${d.sansCout} sans coût` : '']); }
  else L.push(['—', 'achats pas lus']);
  if (d.nDepenses !== undefined) {
    L.push([]);
    L.push(['DÉPENSES NOTÉES DE LA PÉRIODE (Comptabilité)']);
    L.push(['Date', 'Sorte', 'Catégorie', 'Libellé', 'Montant (€)', 'Ticket joint']);
    if (d.depenses) { for (const x of d.depenses) L.push([x.date, x.sorte === 'pack' ? 'pack' : 'dépense', x.categorie, x.libelle, nbT(x.montant), x.ticket ? 'oui' : '']); L.push(['', '', '', 'Total', nbT(d.totalDepenses), '']); }
    else L.push(['—', 'dépenses pas lues']);
  }
  return '﻿' + L.map((r) => r.map(cel).join(';')).join('\r\n') + '\r\n';
}

// ── (27 nov.) LE FICHIER « POUR UN LOGICIEL » (Pennylane, Tiime, Indy) ────────────────────────────────
// Ces logiciels importent un tableau PLAT : UNE ligne d'en-tête, UNE ligne par opération, une date, un libellé,
// un montant (on choisit les colonnes à l'import). Ici : les ventes de la période, datées au jour où elles
// COMPTENT (le versement ; Leboncoin la vente ; eBay le versement sinon la commande — la règle de
// `ventesDeclarables`), au montant REÇU, en euros. Pas de sections, pas de total (il fausserait l'import).
// Ce qui n'a pas sa place (à dater, montant pas lu, autre devise) n'est PAS dans ce fichier : le récap le nomme.
export const nomFichierImport = (periode) => `Ventes-${periode}-import.csv`;
export const ENTETE_IMPORT = ['Date', 'Date de vente', 'Pièce', 'Libellé', 'Plateforme', 'Compte', 'N°', 'Prix de vente', 'Montant reçu', 'Frais plateforme', 'Frais notés', 'Prix d’achat', 'Port', 'Bénéfice', 'Réf. achat', 'Devise'];
export function lignesImport(d) {
  return (d && d.ventes ? d.ventes : []).filter((v) => v.montant != null && /^\d{2}\/\d{2}\/\d{4}$/.test(v.dateCompte || ''));
}
export function csvImportComptable(d) {
  const L = [ENTETE_IMPORT];
  for (const v of lignesImport(d)) {
    const lib = [`Vente ${v.plateforme}`, v.num ? `N°${v.num}` : '', v.titre].filter(Boolean).join(' · ');
    L.push([v.dateCompte, v.dateVente, v.reference, lib, v.plateforme, v.compte, v.num, nbT(v.prixVente), nbT(v.montant), nbT(v.frais), nbT(v.fraisNotes), nbT(v.achat), nbT(v.port), nbT(v.benefice), v.refAchat || '', 'EUR']);
  }
  return '﻿' + L.map((r) => r.map(cel).join(';')).join('\r\n') + '\r\n';
}

// Le PDF : la 1re page A4 — en-tête, résumé, CA par mois, ce qui manque, les
// justificatifs du zip. (11 nov.) Puis, s'il y en a, les manques NOMMÉS ligne par
// ligne : les ventes à dater (dans aucun mois) et les achats sans coût saisi.
// Le reste du détail est dans le tableur (le PDF le dit).
export async function pdfExportComptable(d, { PDFLib = null } = {}) {
  const PL = PDFLib || await import('pdf-lib');
  const { PDFDocument, StandardFonts, rgb } = PL;
  const doc = await PDFDocument.create();
  doc.setTitle(`Export comptable — ${d.libelle}`);
  if (d.entreprise) doc.setAuthor(d.entreprise.nom);
  const f = await doc.embedFont(StandardFonts.Helvetica), fb = await doc.embedFont(StandardFonts.HelveticaBold);
  const ENCRE = rgb(0.11, 0.11, 0.12), GRIS = rgb(0.42, 0.42, 0.45), FILET = rgb(0.86, 0.86, 0.88);
  const W = 595.28, H = 841.89, M = 44;
  let page = doc.addPage([W, H]);
  const dessinable = (ch) => { try { f.encodeText(ch); return true; } catch (_) { return false; } };
  const propre = (s) => { let o = ''; for (const ch of String(s == null ? '' : s).replace(/[‘’]/g, "'").replace(/[   ]/g, ' ').replace(/−/g, '-').replace(/—/g, '-').replace(/[\r\n\t]+/g, ' ')) o += dessinable(ch) ? ch : (dessinable(ch.normalize('NFD')[0]) ? ch.normalize('NFD')[0] : ''); return o; };
  const borne = (s, font, t, max) => { let x = propre(s); if (font.widthOfTextAtSize(x, t) <= max) return x; while (x.length > 1 && font.widthOfTextAtSize(x + '...', t) > max) x = x.slice(0, -1); return x + '...'; };
  const txt = (s, x, yy, { font = f, t = 9, c = ENCRE, droite = false, max = W - 2 * M } = {}) => { const v = borne(s, font, t, max); page.drawText(v, { x: droite ? x - font.widthOfTextAtSize(v, t) : x, y: yy, size: t, font, color: c }); };
  const filet = (yy) => page.drawLine({ start: { x: M, y: yy }, end: { x: W - M, y: yy }, thickness: 0.5, color: FILET });
  let y = H - M;
  if (d.entreprise) { txt(d.entreprise.nom, M, y, { font: fb, t: 11 }); if (d.entreprise.siret) txt(`SIRET ${d.entreprise.siret}`, M, y - 13, { t: 8.5, c: GRIS }); y -= 32; }
  txt(`Export comptable — ${d.libelle}`, M, y - 6, { font: fb, t: 18 }); y -= 24;
  txt(`Établi le ${d.etabliLe} par VRM · détail ligne par ligne dans le fichier tableur`, M, y, { t: 8.5, c: GRIS }); y -= 24;
  for (const [k, v, cle] of resumeExport(d)) {
    const fort = cle === 'ca' || cle === 'urssaf';
    txt(k, M, y, { t: 10, font: fort ? fb : f, max: 300 }); txt(v, W - M, y, { t: 10, font: fort ? fb : f, droite: true, max: 200 });
    y -= 6; filet(y); y -= 13;
  }
  y -= 8;
  txt('CA déclaré par mois (daté au versement)', M, y, { font: fb, t: 11 }); y -= 15;
  const xs = { mois: M, n: M + 230, ca: M + 340, urs: W - M };
  txt('Mois', xs.mois, y, { font: fb, t: 8, c: GRIS }); txt('Ventes', xs.n, y, { font: fb, t: 8, c: GRIS, droite: true }); txt('CA déclaré', xs.ca, y, { font: fb, t: 8, c: GRIS, droite: true });
  txt(d.regime === 'micro' ? 'URSSAF à payer' : 'URSSAF', xs.urs, y, { font: fb, t: 8, c: GRIS, droite: true }); y -= 5; filet(y); y -= 11;
  if (!d.caParMois) { txt('CA déclaré pas encore calculé : ouvre Ventes une fois.', M, y, { c: GRIS }); y -= 13; }
  for (const m of (d.caParMois || [])) {
    txt(m.mois + (m.declare ? ' · noté déclaré' : ''), xs.mois, y, { t: 9, max: 210 }); txt(String(m.n), xs.n, y, { t: 9, droite: true });
    txt(eurosTexte(m.ca), xs.ca, y, { t: 9, droite: true }); txt(d.regime === 'micro' ? eurosTexte(m.urssaf) : 'non calculée', xs.urs, y, { t: 9, droite: true, c: d.regime === 'micro' ? ENCRE : GRIS }); y -= 13;
  }
  if (d.caParMois) { filet(y + 9); txt('Total', xs.mois, y - 2, { font: fb, t: 9 }); txt(d.caDeclare == null ? '—' : `${d.partielCa ? 'au moins ' : ''}${eurosTexte(d.caDeclare)}`, xs.ca, y - 2, { font: fb, t: 9, droite: true }); if (d.regime === 'micro') txt(d.urssaf == null ? '—' : `${d.partielCa ? 'au moins ' : ''}${eurosTexte(d.urssaf)}`, xs.urs, y - 2, { font: fb, t: 9, droite: true }); y -= 20; }
  const cv = couvertureExport(d);
  if (cv.length) {
    y -= 6; txt('Ce qui manque', M, y, { font: fb, t: 11 }); y -= 15;
    for (const c of cv.slice(0, 10)) { txt(`· ${c}`, M, y, { t: 9 }); y -= 13; }
  }
  y -= 8;
  txt('Ventes datées au jour où la plateforme a versé l’argent (Vinted, Vestiaire), de la vente (Leboncoin), de la commande payée (eBay).', M, y, { t: 7.5, c: GRIS }); y -= 10;
  txt('Comptes écartés par le vendeur : hors de tous les totaux.', M, y, { t: 7.5, c: GRIS }); y -= 10;
  txt('Vérifie ton taux et ton chiffre sur autoentrepreneur.urssaf.fr — VRM ne remplace pas un comptable.', M, y, { t: 7.5, c: GRIS });
  // (11 nov.) Les pièces rangées dans le zip, et celles qui n'ont pas pu l'être (nommées).
  const J = d.justificatifs;
  if (J) {
    y -= 22; txt('Justificatifs dans le zip', M, y, { font: fb, t: 11 }); y -= 15;
    txt(`· ${J.ventes} facture${J.ventes > 1 ? 's' : ''} de vente émise${J.ventes > 1 ? 's' : ''} par VRM`, M, y, { t: 9 }); y -= 13;
    txt(`· ${J.achats} facture${J.achats > 1 ? 's' : ''} d’achat jointe${J.achats > 1 ? 's' : ''}`, M, y, { t: 9 }); y -= 13;
    for (const m of (J.manque || []).slice(0, 4)) { if (y < M + 10) break; txt(`· pas dans le zip : ${m}`, M, y, { t: 9 }); y -= 13; }
  }
  // Les manques nommés, une ligne chacun (pages suivantes).
  const listes = [
    ['Ventes à dater — dans aucun mois', 'Sans date de versement : à dater avant de les déclarer.', (d.aDater || []).map((v) => [v.dateVente || '—', v.plateforme, [v.num ? `N°${v.num}` : '', v.reference, v.titre].filter(Boolean).join(' · '), v.montant == null ? '—' : eurosTexte(v.montant)])],
    ['Ventes dans une autre devise — jamais converties', 'Hors de tous les totaux : à voir avec ton comptable.', (d.horsEuro || []).map((v) => [v.dateVente || '—', v.plateforme, [v.num ? `N°${v.num}` : '', v.reference, v.titre].filter(Boolean).join(' · '), v.devise])],
    ['Achats sans coût saisi', 'Saisis leur prix dans VRM (Achats), ou joins la facture.', (d.achats || []).filter((a) => a.saisi == null).map((a) => [a.date || '—', a.plateforme, [a.num ? `N°${a.num}` : '', a.reference, a.titre].filter(Boolean).join(' · '), a.lu == null ? '—' : `lu : ${eurosTexte(a.lu)}`])],
  ];
  for (const [titre, sous, lignes] of listes) {
    if (!lignes.length) continue;
    page = doc.addPage([W, H]); y = H - M;
    txt(`${titre} (${lignes.length})`, M, y - 6, { font: fb, t: 14 }); y -= 22;
    txt(`${d.libelle} · ${sous}`, M, y, { t: 8.5, c: GRIS }); y -= 20;
    for (const [dt, pf, qui, mt] of lignes) {
      if (y < M + 14) { page = doc.addPage([W, H]); y = H - M; txt(`${titre} (suite)`, M, y - 6, { font: fb, t: 12 }); y -= 24; }
      txt(dt, M, y, { t: 8.5, max: 64 }); txt(pf, M + 68, y, { t: 8.5, max: 62, c: GRIS }); txt(qui, M + 134, y, { t: 8.5, max: W - 2 * M - 134 - 90 }); txt(mt, W - M, y, { t: 8.5, droite: true, max: 86 });
      y -= 5; filet(y); y -= 9;
    }
  }
  return doc.save();
}
