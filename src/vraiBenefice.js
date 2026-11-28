// ════════════════════════════════════════════════════════════════════════════
//  LE VRAI BÉNÉFICE (27 nov. 2026 — choisi par Julien ; retenu le 11 oct. comme « bénéfice réel » et
//  « compte qui vend le mieux »). Par paire : prix de vente (ou l'argent reçu, selon la règle du site)
//  − prix d'achat − port payé à l'achat − frais de la plateforme − boosts.
//
//  ⚠️ UNE RÈGLE, UN PROPRIÉTAIRE (§5) : ce module n'invente AUCUN calcul. Le bénéfice d'une vente est celui de
//     l'export comptable (`detailVenteReleve`, src/exportComptable.js) : la règle des marges `margesPar`
//     (src/statsVentes.js) sur la ligne du relevé `vrm_stats_ventes` publié par Ventes — vente − achat − frais
//     notés (boosts, commission notée, port payé par lui, remboursement, autres, emballage). L'export l'appelle
//     ICI (`beneficeReleve`), l'écran Statistiques › Gains aussi : l'écran et l'export ne peuvent pas diverger.
//  Chaque terme, LU ou ABSENT et dit (jamais 0 pour « pas su ») :
//    · vente      : [4] du relevé (Vinted, Leboncoin : le prix ; eBay : l'argent reçu `montantRecuEbay` ;
//                   Vestiaire : le versé). Illisible ⇒ la vente est écartée et comptée, jamais à 0 ;
//    · achat      : [5] (relié par identité, jamais deviné ; un lot jamais divisé). Absent ⇒ bénéfice « — » ;
//    · port payé à l'achat : COMPRIS dans le prix d'achat. Posé depuis le reçu Vinted (`buyPriceSource`
//                   'recu' ou 'division'), il l'est toujours (le reçu = article + port + protection) — drapeau 'r'
//                   en [12] ; saisi à la main, c'est ce que tu as payé (dit sous « Pourquoi ? »), jamais ajouté ;
//    · frais de la plateforme : Vinted, Leboncoin aucun au vendeur (règle du site, src/fraisPlateformes.js) sauf
//                   une commission notée ; eBay et Vestiaire : déjà retirés de l'argent reçu ;
//    · boosts     : notés sur la fiche ([11][0]). Une fiche dont les frais ne sont PAS confirmés (« Tous les
//                   frais sont renseignés », drapeau 'c' en [12]) peut avoir un boost oublié : son bénéfice est
//                   un PLAFOND — « au plus » (la règle de src/coutReel.js), jamais « au moins ».
//  Un total : la somme des bénéfices CONNUS, avec sa couverture (« 5 sur 7 ») et ce qui manque NOMMÉ (sans prix
//  d'achat, frais pas confirmés). Le MOIS d'une vente est celui de l'export comptable : le versement (Vinted,
//  [9]), la vente (les autres sites) — une vente pas versée est « à dater », dans aucun mois.
//  Le COMPTE : le compte Vinted de la vente ([1]), sinon le site. Le relevé ne porte que les comptes
//  sélectionnés : un compte écarté n'apparaît nulle part.
//  Exécuté par scripts/audit-vrai-benefice.cjs ; l'égalité écran = export, par le banc scripts/bancs/vrai-benefice.cjs.
// ════════════════════════════════════════════════════════════════════════════
import { margesPar } from './statsVentes.js';
import { moisParis } from './dateParis.js';

const nombreOuNull = (x) => (x == null || x === '' || !Number.isFinite(Number(x)) ? null : Math.round(Number(x) * 100) / 100);
const cents = (x) => Math.round(Number(x) * 100);

// Les drapeaux d'une fiche rangés en [12] du relevé : 'c' frais confirmés, 'r' prix d'achat posé depuis le reçu.
export function drapeauxFiche(e) {
  const f = e || {};
  return (f.fraisComplets === true ? 'c' : '') + (f.buyPriceSource === 'recu' || f.buyPriceSource === 'division' ? 'r' : '');
}

// LE BÉNÉFICE D'UNE LIGNE DU RELEVÉ, en euros (ou null) — la règle de l'export, la seule.
export function beneficeReleve(r) {
  if (!Array.isArray(r)) return null;
  const eur = nombreOuNull(r[4]);
  if (eur == null) return null;
  const achat = nombreOuNull(r[5]);
  const frais = r[6] === null ? null : nombreOuNull(r[6]);
  const g = margesPar([{ ts: Number(r[3]) || 1, eur, achat, frais }], () => 'v');
  return g && g.groupes[0] && g.groupes[0].net != null ? g.groupes[0].net : null;
}

// LES TERMES d'une ligne du relevé (centimes ; null = pas su). `etat` : 'prix' (vente illisible, écartée) ·
// 'achat' (prix d'achat manquant) · 'auPlus' (frais pas confirmés : un plafond) · 'ok'.
export function termesReleve(r) {
  if (!Array.isArray(r)) return null;
  const plateforme = String(r[0] || '');
  const det = Array.isArray(r[11]) && r[11].length === 4 && r[11].every(Number.isFinite) ? r[11] : null;
  const dr = typeof r[12] === 'string' ? r[12] : '';
  const vente = nombreOuNull(r[4]), achat = nombreOuNull(r[5]);
  const b = beneficeReleve(r);
  const confirme = dr.includes('c');
  const etat = vente == null ? 'prix' : achat == null || b == null ? 'achat' : confirme ? 'ok' : 'auPlus';
  // Le mois de l'export : le versement pour Vinted ([9], '' pas versée) ; la vente pour les autres sites.
  const quand = plateforme === 'Vinted' ? (r[9] ? String(r[9]) : '') : (r[9] ? String(r[9]) : Number(r[3]) || '');
  return {
    plateforme, compte: String(r[1] || ''), id: String(r[2] || ''), num: String(r[8] || ''), ts: Number(r[3]),
    vente: vente == null ? null : cents(vente), achat: achat == null ? null : cents(achat),
    frais: r[6] == null ? null : cents(r[6]), boost: det ? det[0] : null, portVendeur: det ? det[1] : null,
    commission: plateforme === 'eBay' || plateforme === 'Vestiaire' ? 'deduite' : det && det[2] ? det[2] : 'aucune',
    portAchat: dr.includes('r') ? 'recu' : achat == null ? null : 'saisi',
    net: b == null ? null : cents(b), confirme, etat, ym: quand ? moisParis(quand) : '',
  };
}

// Le compte d'une vente : le compte Vinted, sinon le site (la clé de `cleAxe('compte')`, src/ceQuiRapporte.js).
export const cleCompte = (t) => (t.plateforme === 'Vinted' ? 'Vinted|' + (t.compte || '') : t.plateforme || '');
export const nomCompte = (t) => (t.plateforme === 'Vinted' ? t.compte || 'Vinted' : t.plateforme || '');

// UN GROUPE (un mois, un compte) : la somme des bénéfices connus, sa couverture, ce qui manque.
function cumul(T) {
  const g = { n: 0, nNet: 0, net: 0, sansAchat: 0, auPlus: 0, ca: 0 };
  for (const t of T) {
    g.n += 1; g.ca += t.vente;
    if (t.net == null) { g.sansAchat += 1; continue; }
    g.nNet += 1; g.net += t.net;
    if (t.etat === 'auPlus') g.auPlus += 1;
  }
  return { ...g, net: g.nNet ? g.net : null, moyen: g.nNet ? Math.round(g.net / g.nNet) : null, partiel: g.nNet < g.n, plafond: g.auPlus > 0 };
}

// PAR MOIS ET PAR COMPTE. `releve` : les lignes publiées (`vrm_stats_ventes`.l) ; `mois` : les 'AAAA-MM' voulus (les
// plus récents d'abord) ; `de`/`a` (ms) : la période des comptes (date de la vente, comme le reste de Statistiques).
// Rend null (relevé pas lu) ou { mois: [...], comptes: [...], aDater, ecartees }.
export function vraiBenefice(releve, { mois = [], de = -Infinity, a = Infinity } = {}) {
  if (!Array.isArray(releve)) return null;
  const T = [], ecartees = { n: 0 };
  for (const r of releve) {
    const t = termesReleve(r);
    if (!t) continue;
    if (t.vente == null) { ecartees.n += 1; continue; }
    T.push(t);
  }
  const parMois = mois.map((ym) => ({ ym, ...cumul(T.filter((t) => t.ym === ym)) }));
  const aDater = T.filter((t) => !t.ym).length;
  const C = new Map();
  for (const t of T) {
    if (!(Number.isFinite(t.ts) && t.ts >= de && t.ts < a)) continue;
    const k = cleCompte(t);
    if (!C.has(k)) C.set(k, { k, nom: nomCompte(t), plateforme: t.plateforme, L: [] });
    C.get(k).L.push(t);
  }
  // « Le compte qui vend le mieux » : le plus gros bénéfice connu d'abord ; sans bénéfice connu, après (par nombre).
  const comptes = [...C.values()].map((c) => ({ k: c.k, nom: c.nom, plateforme: c.plateforme, ...cumul(c.L) }))
    .sort((x, y) => ((x.net == null) - (y.net == null)) || (x.net != null && y.net !== x.net ? y.net - x.net : 0) || y.n - x.n || (x.nom < y.nom ? -1 : 1));
  return { mois: parMois, comptes, aDater, ecartees: ecartees.n };
}

// La vue que Statistiques › Gains ajoute (« Par mois ») ; « Par compte » y gagne le total par compte.
export const VUES_VRAI_BENEFICE = ['mois'];
