// ════════════════════════════════════════════════════════════════════════════
//  MARGE PAR PLATEFORME (10 nov., lot I — proposition 7 validée par Julien :
//  « savoir où publier ; seulement sur les ventes prouvées, couverture dite »).
//  Dans Argent → Statistiques, une barre par site : Vinted, Leboncoin, eBay,
//  Vestiaire. Module PUR : il ne relit aucun prix d'achat, aucun frais, aucune
//  vente — il RANGE par site ce que leurs propriétaires ont déjà publié (§11) :
//
//    · VENTES et VENDU = `liveStats.venduLignes` (`ventesFaites` : date de la
//      vente, toutes plateformes, comptes sélectionnés, Solo/Pro par
//      `excluAutreDe`) ; ce qui manque = `venduManque` (une plateforme pas lue,
//      un compte Vinted pas lu) et `venduNonComptees` (vendue, argent pas lu :
//      frais eBay pas lus, montant Vestiaire pas sûr, prix Vinted illisible).
//      Un vendu incomplet dit « au moins » et NOMME le manque.
//    · BÉNÉFICE = le relevé `vrm_stats_ventes` de l'écran Ventes (ventes
//      FINALISÉES, comptes écartés exclus) : par vente, vente − prix d'achat −
//      frais de vente, la règle de `beneficePaire` / `cascadeVente`
//      (src/coutVente.js : `achatDe` + `chargesVente`, emballage compris) ;
//      Leboncoin au prix final (frais 0), eBay à l'argent reçu
//      (`montantRecuEbay` : dû − frais eBay, frais 0), Vestiaire au montant
//      versé. Médiane et total sur les seules ventes au prix d'achat CONNU,
//      couverture dite (« sur 9 · prix d'achat manquant pour 3 ») ; JAMAIS
//      « au moins » sur un bénéfice (une paire au prix inconnu peut être à
//      perte : src/beneficeNoms.js).
//    · Une plateforme pas lue ⇒ « — » partout et la raison ; un relevé pas
//      encore publié ⇒ bénéfice « — », « ouvre Ventes ».
//  Exécuté par scripts/audit-marge-plateforme.cjs et le banc marge-plateforme.
// ════════════════════════════════════════════════════════════════════════════
import { dansBornes } from './statsVentes.js';
import { SEUIL_CONCLUSION } from './vendrePlus.js';

export const PLATEFORMES_MARGE = ['Vinted', 'Leboncoin', 'eBay', 'Vestiaire'];
const AUTRES = new Set(['Leboncoin', 'eBay', 'Vestiaire']);
const cts = (x) => (x == null || String(x).trim() === '' || !isFinite(Number(x)) ? null : Math.round(Number(x) * 100));

// Médiane d'entiers (centimes) ; paire ⇒ la moyenne des deux du milieu, arrondie.
export const mediane = (xs) => {
  const s = (Array.isArray(xs) ? xs : []).filter(Number.isFinite).slice().sort((a, b) => a - b);
  if (!s.length) return null;
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

// Le bénéfice d'UNE ligne du relevé, en centimes ; `null` = pas su (et pourquoi).
export function beneficeLigneReleve(l) {
  const v = cts(l && l.eur);
  if (v == null) return { c: null, pourquoi: 'prix' };
  const a = cts(l.achat);
  if (a == null) return { c: null, pourquoi: 'achat' };
  if (l.frais === null) return { c: null, pourquoi: 'frais' };   // frais pas sus ≠ 0
  const f = cts(l.frais) ?? 0;
  return { c: v - a - f, pourquoi: '' };
}

// vendu : `venduLignes` (tableau | null = pas lu | undefined = lecture) ;
// manque : `venduManque` ; nonComptees : `venduNonComptees` ;
// releve : les lignes du relevé ({ plateforme, ts, eur, achat, frais }) | null (pas publié) ;
// [de, a) en ms.
export function margeParPlateforme({ vendu, manque = [], nonComptees = [], releve = null, de, a } = {}) {
  const man = Array.isArray(manque) ? manque.map(String) : [];
  const vinManque = man.filter((m) => !AUTRES.has(m) && m !== 'lecture en cours');
  const dans = (t) => dansBornes(Number(t), de, a);
  const plateformes = PLATEFORMES_MARGE.map((plat) => {
    const P = { plat, etat: 'lu', raison: '', n: null, vendu: null, venduPartiel: false, nNonComptees: 0,
      benef: releve == null ? 'releve' : 'lu', nFin: 0, nConnu: 0, nSansAchat: 0, nSansPrix: 0, nSansFrais: 0, mediane: null, total: null };
    if (vendu === undefined) { P.etat = 'encours'; return P; }
    if (vendu === null) { P.etat = 'passu'; P.raison = 'ventes pas lues'; return P; }
    if (AUTRES.has(plat) && man.includes(plat)) { P.etat = 'passu'; P.raison = `ventes ${plat} pas lues`; return P; }
    // VENDU (la règle de « Vendu ») : les lignes du site sur la période.
    let n = 0, c = 0;
    for (const l of vendu) {
      if (!l || l.plateforme !== plat || !dans(l.ts)) continue;
      const e = cts(l.eur); if (e == null) continue;
      n += 1; c += e;
    }
    // Vendues dont l'argent ne se lit pas : comptées en ventes, hors du montant, NOMMÉES
    // (sans date : dans toute période, la règle de `nonCompteesDe`).
    const nc = (Array.isArray(nonComptees) ? nonComptees : []).filter((x) => x && x.plateforme === plat && (x.ts == null || dans(x.ts))).length;
    P.n = n + nc; P.nNonComptees = nc;
    P.vendu = n ? c : (nc ? null : 0);
    P.venduPartiel = nc > 0 || (plat === 'Vinted' && vinManque.length > 0);
    if (plat === 'Vinted' && vinManque.length) P.raison = `${vinManque.join(', ')} pas lu${vinManque.length > 1 ? 's' : ''}`;
    // BÉNÉFICE (le relevé de Ventes, ventes finalisées).
    if (releve == null) return P;
    const connus = [];
    for (const l of releve) {
      if (!l || l.plateforme !== plat || !dans(l.ts)) continue;
      P.nFin += 1;
      const b = beneficeLigneReleve(l);
      if (b.c == null) { if (b.pourquoi === 'achat') P.nSansAchat += 1; else if (b.pourquoi === 'prix') P.nSansPrix += 1; else P.nSansFrais += 1; continue; }
      connus.push(b.c);
    }
    P.nConnu = connus.length;
    P.mediane = mediane(connus);
    P.total = connus.length ? connus.reduce((s, x) => s + x, 0) : null;
    return P;
  });
  // L'accent (§7, rare) : la meilleure médiane, seulement si deux sites au moins
  // ont assez de ventes au bénéfice connu pour conclure (`SEUIL_CONCLUSION`).
  const assez = plateformes.filter((p) => p.etat === 'lu' && p.mediane != null && p.nConnu >= SEUIL_CONCLUSION);
  let meilleur = null;
  if (assez.length >= 2) {
    const s = assez.slice().sort((x, y) => y.mediane - x.mediane);
    if (s[0].mediane > s[1].mediane) meilleur = s[0].plat;
  }
  return { plateformes, meilleur, releveLu: releve != null, etat: vendu === undefined ? 'encours' : vendu === null ? 'passu' : 'lu' };
}

const pl = (k, s, p) => `${k} ${k > 1 ? (p || s + 's') : s}`;
// « 1 240 € », « −12 € » — à l'euro (une barre de comparaison, pas une facture).
export const eurosMarge = (c) => {
  if (c == null || !Number.isFinite(c)) return '—';
  const e = Math.round(c / 100);
  return (e < 0 ? '−' : '') + String(Math.abs(e)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' €';
};

// Ce que la ligne écrit. Jamais « au moins » sur un bénéfice ; « au moins » sur
// le vendu seulement quand une vente du site n'a pas d'argent lu.
export function texteMarge(p) {
  if (!p) return { ventes: '—', vendu: '—', mediane: '—', total: '—', sur: '' };
  if (p.etat !== 'lu') return { ventes: '—', vendu: '—', mediane: '—', total: '—', sur: p.etat === 'encours' ? 'lecture…' : p.raison };
  const ventes = pl(p.n, 'vente');
  const vendu = p.vendu == null ? '—' : `${p.venduPartiel ? 'au moins ' : ''}${eurosMarge(p.vendu)}`;
  const manques = [];
  if (p.nNonComptees) manques.push(`${p.nNonComptees} au montant pas lu`);
  if (p.raison) manques.push(p.raison);
  if (p.benef === 'releve') return { ventes, vendu, mediane: '—', total: '—', sur: 'bénéfice : ouvre Ventes pour le calculer', manques };
  let sur = p.nFin ? `sur ${pl(p.nConnu, 'vente finalisée', 'ventes finalisées')}` : 'aucune vente finalisée';
  if (p.nSansAchat) sur += ` · prix d’achat manquant pour ${p.nSansAchat}`;
  if (p.nSansPrix) sur += ` · prix pas lu pour ${p.nSansPrix}`;
  if (p.nSansFrais) sur += ` · frais pas lus pour ${p.nSansFrais}`;
  return { ventes, vendu, mediane: eurosMarge(p.mediane), total: eurosMarge(p.total), sur, manques };
}

// ── (11 nov., décision C11 — Julien : « tranche ») UN SITE QU'IL N'UTILISE PAS EST CACHÉ ──
// Caché seulement quand c'est SU : aucune vente de ce site (toutes dates, la règle de « Vendu »),
// aucune vente au montant pas lu, et aucune annonce ni vente rangée par l'extension pour lui
// (`lus` : { Leboncoin: true|false, … } — une ligne lue NON VIDE). Pas su ⇒ montré (« pas su »
// ne vaut pas « absent ») : ventes en lecture ou pas lues, site manquant, lignes pas lues.
// Vinted, le site principal, est toujours montré (la règle de la rangée des sites).
// → Set des plateformes montrées.
export const LIGNES_SITE = Object.freeze({ Leboncoin: ['lbc_listings', 'lbc_ventes'], eBay: ['ebay_orders', 'ebay_listings'], Vestiaire: ['vc_listings', 'vc_ventes'] });
export function sitesMontres({ vendu, manque = [], nonComptees = [], lus } = {}) {
  const out = new Set(PLATEFORMES_MARGE);
  if (!Array.isArray(vendu) || !lus || typeof lus !== 'object') return out;
  const man = Array.isArray(manque) ? manque.map(String) : [];
  for (const plat of PLATEFORMES_MARGE) {
    if (plat === 'Vinted' || man.includes(plat) || lus[plat] !== false) continue;
    const vente = vendu.some((l) => l && l.plateforme === plat) || (Array.isArray(nonComptees) ? nonComptees : []).some((x) => x && x.plateforme === plat);
    if (!vente) out.delete(plat);
  }
  return out;
}
// Les lignes lues (réponse de `select=id,a:data->items->0,v:data->ventes->0,o:data->orders->0`) → { plat: bool }.
// Une ligne présente au premier élément non nul = des annonces ou des ventes lues.
export function sitesLusDeLignes(rows) {
  if (!Array.isArray(rows)) return null;
  const plein = (r) => r && (r.a != null || r.v != null || r.o != null);
  const res = {};
  for (const [plat, prefixes] of Object.entries(LIGNES_SITE)) {
    res[plat] = rows.some((r) => r && prefixes.some((p) => String(r.id || '') === p || String(r.id || '').startsWith(p + '_')) && plein(r));
  }
  return res;
}
