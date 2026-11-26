// ════════════════════════════════════════════════════════════════════════════
//  CE QUE TU GAGNES VRAIMENT (24 nov. 2026, lot gains-reels — choisi par Julien le 24 nov.)
//  Statistiques › « Gains » : par PAIRE, par MODÈLE, par SOURCE d'achat et par COMPTE — le bénéfice réel (prix, frais,
//  prix d'achat, port payé par lui), le délai moyen de vente, le meilleur et le moins bon, et « À racheter ».
//
//  Module PUR (aucune lecture, aucune écriture) et AUCUNE règle de chiffre neuve (§5, une règle par notion) :
//    · LE NET D'UNE VENTE = `netDeVenteRangee` (src/coutReel.js : vente − frais − prix d'achat, en centimes — la règle de
//      `ajouterVenteBenefice`, de `vrm_benefice_jours` et de la colonne « Net »), sur le relevé publié par Ventes
//      (`vrm_stats_ventes` : ventes FINALISÉES, comptes sélectionnés seulement — un compte écarté n'y entre pas —, prix
//      d'achat relié par IDENTITÉ, jamais deviné ; eBay : l'argent reçu `montantRecuEbay`, port jamais compté §2.8).
//      Prix d'achat absent ⇒ net `null` (« — »), jamais 0 ;
//    · LE GROUPE (modèle, compte), son nombre, sa couverture et le délai médian = `classementRapporte`
//      (src/ceQuiRapporte.js), dont le « coût » d'une ligne est ici TOUT ce que la vente a coûté (= vente − net de la
//      règle) : son « brut » vaut donc, au centime, la somme des nets. Une vente dans une autre devise ou au montant
//      illisible est ÉCARTÉE et comptée (`ecartees`), jamais convertie ;
//    · « À RACHETER » = `scoreRachat` (src/quoiRacheter.js : bénéfice moyen ÷ délai, au moins `MIN_RACHAT` ventes
//      reliées ET datées, bénéfice moyen positif) — un constat sur ses ventes, jamais une promesse ;
//    · LA SOURCE = `rentabiliteParSource` (src/rentabiliteSource.js, sur `bilanSources`), rangée telle quelle.
//  Seul calcul propre (pas une règle de bénéfice) : la MOYENNE du délai de vente d'un groupe, sur les MÊMES dates que
//  `classementRapporte` (mise en ligne lue → vente prouvée, une vente datée avant sa mise en ligne n'entre pas).
//  Aucun classement (meilleur, moins bon) sous `MIN_CLASSEMENT` ventes au net connu ; une paire seule n'est pas classée
//  tant qu'il n'y a pas `MIN_CLASSEMENT` ventes au net connu. Le modèle n'est qu'un REGROUPEMENT d'affichage (`modeleSur`,
//  catalogue fermé, marque lue) : jamais une identité, il ne relie rien.
//  Exécuté par scripts/audit-gains-reels.cjs (données inventées, mutations).
// ════════════════════════════════════════════════════════════════════════════
import { classementRapporte } from './ceQuiRapporte.js';
import { netDeVenteRangee } from './coutReel.js';
import { scoreRachat, MIN_RACHAT } from './quoiRacheter.js';
import { rentabiliteParSource } from './rentabiliteSource.js';

export const VUES_GAINS = ['paire', 'modele', 'source', 'compte'];
export const MIN_CLASSEMENT = MIN_RACHAT;          // 3 : jamais un classement sur une ou deux ventes
export const PODIUM = 3;                            // les 3 meilleurs, les 3 moins bons
const J = 86400000;
const fini = (x) => x != null && String(x).trim() !== '' && Number.isFinite(Number(x));

// LE NET D'UNE LIGNE DU RELEVÉ (centimes | null) — la règle, jamais une autre. Montant illisible ou autre devise ⇒ null.
export function netLigne(l) {
  if (!l || !fini(l.eur) || (l.devise && String(l.devise).toUpperCase() !== 'EUR')) return null;
  return netDeVenteRangee({ eur: l.eur, achat: l.achat, frais: l.frais });
}
// Le délai de vente d'une ligne (jours, décimal) : les dates de `classementRapporte`, sinon null.
export function delaiLigne(l) {
  const e = Number(l && l.enLigne), t = Number(l && l.ts);
  return l && l.enLigne != null && Number.isFinite(e) && e > 0 && Number.isFinite(t) && t >= e ? (t - e) / J : null;
}

// Une ligne pour `classementRapporte` dont le « prix d'achat » est TOUT ce que la vente a coûté (vente − net) : le brut
// du classement est alors la somme des nets. Net pas su ⇒ coût pas su (la ligne compte dans `n`, pas dans `nCout`).
// La forme de `classementRapporte` (celle de `versClassement`, src/vendsMieux.js — non importé : ce module-là reste aux
// seuls écrans de statistiques, audit-rentabilite C3) : le modèle SÛR déjà posé par la lecture du relevé, jamais recalculé.
function pourClassement(l) {
  const m = l && l.modele && typeof l.modele === 'object' && l.modele.cle ? { cle: String(l.modele.cle), nom: String(l.modele.nom || l.modele.cle) } : null;
  const c = { plateforme: l.plateforme, compte: l.compte, id: l.id, ts: l.ts, eur: l.eur, devise: l.devise, titre: l.titre || '', marque: l.marqueLue || l.marque || '', taille: l.taille || '', modeleSur: m, enLigne: l.enLigne };
  const net = netLigne(l);
  return { ...c, achat: net == null ? null : (Math.round(Number(l.eur) * 100) - net) / 100 };
}

// UN AXE (modèle ou compte) : les groupes avec net total, net moyen par paire, couverture, délai moyen, rang.
export function gainsAxe(lignes, axe) {
  const L = lignes.map(pourClassement);
  const C = classementRapporte(L, axe);
  const groupes = C.groupes.map((g) => {
    const js = g.lignes.map((i) => delaiLigne(lignes[i])).filter((x) => x != null);
    const net = g.brut == null ? null : Math.round(g.brut * 100);
    const delaiMoyen = js.length ? Math.round((js.reduce((s, x) => s + x, 0) / js.length) * 10) / 10 : null;
    return {
      k: g.k, nom: g.nom, n: g.n, nNet: g.nCout, autres: g.k === '',
      net, netMoyen: g.moyen == null ? null : Math.round(g.moyen * 100),
      ca: Math.round(g.ca * 100),
      delaiMoyen, nDelai: js.length, mediane: g.mediane,
      classable: g.k !== '' && g.nCout >= MIN_CLASSEMENT && g.moyen != null,
      // « À racheter » : le score du propriétaire (net moyen ÷ délai, au moins 3 ventes au net connu ET datées), sur le
      // délai MOYEN — le même nombre que celui affiché à côté (jamais deux délais pour un groupe).
      score: scoreRachat({ k: g.k, n: g.nCout, nDelai: js.length, moyen: g.moyen, mediane: delaiMoyen }),
    };
  });
  return finirClassement({ groupes, n: C.n, nNet: C.nCout, ecartees: C.ecartees });
}

// Le meilleur et le moins bon (net moyen par paire), seulement parmi les groupes classables ; aucun groupe n'est à la
// fois dans les deux listes. « À racheter » : les meilleurs scores (score non nul), 3 au plus.
function finirClassement(A) {
  const classes = A.groupes.filter((g) => g.classable).sort((a, b) => b.netMoyen - a.netMoyen || b.nNet - a.nNet || (a.nom < b.nom ? -1 : 1));
  // Meilleurs et moins bons se partagent les classables (jamais le même deux fois ; un seul classable ⇒ rien à comparer).
  const meilleurs = classes.slice(0, Math.min(PODIUM, Math.floor(classes.length / 2)));
  const pris = new Set(meilleurs.map((g) => g.k));
  const moinsBons = classes.slice().reverse().filter((g) => !pris.has(g.k)).slice(0, meilleurs.length);
  const aRacheter = A.groupes.filter((g) => g.score != null).sort((a, b) => b.score - a.score || b.nNet - a.nNet || (a.nom < b.nom ? -1 : 1)).slice(0, PODIUM);
  // La liste : net moyen connu d'abord (le plus haut), puis le reste par nombre ; « Autres » toujours en dernier.
  const liste = A.groupes.slice().sort((a, b) => (a.autres - b.autres) || ((a.netMoyen == null) - (b.netMoyen == null))
    || (a.netMoyen != null && b.netMoyen !== a.netMoyen ? b.netMoyen - a.netMoyen : 0) || b.n - a.n || (a.nom < b.nom ? -1 : 1));
  return { ...A, liste, meilleurs: meilleurs.map((g) => g.k), moinsBons: moinsBons.map((g) => g.k), aRacheter: aRacheter.map((g) => g.k), classables: classes.length };
}

// PAR PAIRE : une ligne par vente (un lot est déjà éclaté en articles par le relevé), le net et le délai.
export function gainsPaires(lignes) {
  let n = 0, ecartees = 0;
  const paires = [];
  lignes.forEach((l, i) => {
    if (!l) return;
    if (!fini(l.eur) || !Number.isFinite(Number(l.ts)) || (l.devise && String(l.devise).toUpperCase() !== 'EUR')) { ecartees += 1; return; }
    n += 1;
    const net = netLigne(l), d = delaiLigne(l);
    paires.push({ k: String(l.id || '') + '#' + i, id: String(l.id || ''), titre: String(l.titre || ''), num: String(l.num || ''), plateforme: String(l.plateforme || ''),
      compte: String(l.compte || ''), ts: Number(l.ts), eur: Math.round(Number(l.eur) * 100), net, achatConnu: fini(l.achat), delai: d == null ? null : Math.round(d * 10) / 10 });
  });
  const connues = paires.filter((p) => p.net != null);
  const assez = connues.length >= MIN_CLASSEMENT;
  const tri = connues.slice().sort((a, b) => b.net - a.net || b.ts - a.ts);
  const meilleurs = assez ? tri.slice(0, Math.min(PODIUM, Math.floor(tri.length / 2))) : [];
  const pris = new Set(meilleurs.map((p) => p.k));
  const moinsBons = assez ? tri.slice().reverse().filter((p) => !pris.has(p.k)).slice(0, meilleurs.length) : [];
  const sansAchat = paires.filter((p) => p.net == null).sort((a, b) => b.ts - a.ts);
  return { n, nNet: connues.length, ecartees, paires, meilleurs: meilleurs.map((p) => p.k), moinsBons: moinsBons.map((p) => p.k), sansAchat: sansAchat.map((p) => p.k), classables: connues.length };
}

// PAR SOURCE : la rentabilité par source telle quelle (centimes, délai achat → vente moyen), plus le rang et « à racheter »
// sur les MÊMES seuils (au moins `MIN_CLASSEMENT` reventes au bénéfice connu ; « au plus » — des frais pas confirmés —
// n'est jamais classé ni proposé : un plafond n'est pas un constat).
export function gainsSources(bilan) {
  const S = rentabiliteParSource(bilan);
  if (!S) return S;
  const groupes = S.groupes.map((g) => ({
    k: g.k, nom: g.nom, pasSaisie: g.pasSaisie, n: g.revendus, articles: g.articles, taux: g.taux, nNet: g.nBenef, partiel: g.partiel,
    netMoyen: g.beneficeMoyen, net: g.beneficeMoyen == null ? null : g.beneficeMoyen * g.nBenef, delaiMoyen: g.delai, nDelai: g.nDelai, autres: g.pasSaisie,
    classable: !g.pasSaisie && !g.partiel && g.nBenef >= MIN_CLASSEMENT && g.beneficeMoyen != null,
    score: g.pasSaisie || g.partiel ? null : scoreRachat({ k: g.k, n: g.nBenef, nDelai: g.nDelai, moyen: g.beneficeMoyen == null ? null : g.beneficeMoyen / 100, mediane: g.delai }),
  }));
  return { ...finirClassement({ groupes, n: S.n, nNet: S.nCout, ecartees: 0 }), sansAchat: S.sansAchat, achatPasLu: S.achatPasLu, vintedLus: S.vintedLus, toutesPeriodes: true };
}

// LE TOUT : `lignes` = le relevé de la période (src/aujourdhui/lectures.js `lignesReleve`), `undefined` en lecture,
// `null` pas su ; `bilan` = la publication « Tes meilleures sources » ; `horsEuro` = les commandes eBay dans une autre
// devise (publiées avec le relevé, jamais converties) ou null (pas su).
// Rend undefined | null | { total, paire, modele, compte, source }.
export function gainsReels({ lignes, bilan = undefined, horsEuro = null } = {}) {
  if (lignes === undefined) return undefined;
  if (!Array.isArray(lignes)) return null;
  const P = gainsPaires(lignes);
  const connues = P.paires.filter((p) => p.net != null);
  const js = P.paires.map((p) => p.delai).filter((x) => x != null);
  const total = {
    n: P.n, nNet: P.nNet, sansAchat: P.n - P.nNet, ecartees: P.ecartees, horsEuro: Number.isSafeInteger(horsEuro) ? horsEuro : null,
    net: connues.length ? connues.reduce((s, p) => s + p.net, 0) : null,
    netMoyen: connues.length ? Math.round(connues.reduce((s, p) => s + p.net, 0) / connues.length) : null,
    // Le CA de ces mêmes ventes (celles au net connu) : la marge réelle s'en déduit, sur la même couverture.
    caNet: connues.reduce((s, p) => s + p.eur, 0),
    delaiMoyen: js.length ? Math.round((js.reduce((s, x) => s + x, 0) / js.length) * 10) / 10 : null, nDelai: js.length,
    partiel: P.nNet < P.n,
  };
  return { total, paire: P, modele: gainsAxe(lignes, 'modele'), compte: gainsAxe(lignes, 'compte'), source: gainsSources(bilan) };
}
