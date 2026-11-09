// ═══════════════════════════════════════════════════════════════════════════
// VENDRE PLUS (9 novembre) — les règles pures des chantiers retenus le 11 oct.
// ═══════════════════════════════════════════════════════════════════════════
// « Plan des paires qui dorment », « favoris sans vente », « ce qui part vite »,
// « compte qui vend le mieux ». Rien n'est lu ni écrit ici, rien n'est décidé
// à sa place : ces règles PROPOSENT, chaque geste reste SON clic (§3). Aucune
// recommandation de prix (refusé le 11 oct.), aucun badge « bonne affaire ».
//
// Les bases viennent de leur propriétaire (§5, une règle un propriétaire) :
//   · « en ligne » = la grille Annonces (`annBase`, `<enligne-regle>`) ;
//   · « qui dort » = `articlesQuiDorment` (src/quiDorment.js) ;
//   · les délais = `delaisPar` (src/statsVentes.js).
// Trois états partout : un nombre LU · `null` pas lu (« pas lu », jamais 0).
// L'identité d'une annonce est SON identifiant Vinted, jamais son titre :
// 50 annonces au même titre restent 50 lignes distinctes (audit-vendre-plus).
// Exécuté par scripts/audit-vendre-plus.cjs.

// Sous ce nombre de ventes datées, un groupe n'est ni classé ni « le meilleur » :
// on le montre, on ne conclut pas (« pas assez de ventes pour conclure »).
export const SEUIL_CONCLUSION = 5;

// Un compteur LU (vues, favoris, offres) : un nombre fini ≥ 0, sinon `null`.
export const compteurLu = (v) => {
  if (v == null || v === '' || typeof v === 'boolean') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};
// Ce qu'on écrit pour un compteur : « 3 favoris », ou « favoris pas lus ».
export const texteCompteur = (v, sing, plur, pasLu) => {
  const n = compteurLu(v);
  if (n == null) return pasLu || `${plur || sing + 's'} pas lus`;
  return `${n} ${n > 1 ? (plur || sing + 's') : sing}`;
};

// ── FAVORIS SANS VENTE ─────────────────────────────────────────────────────
// `annonces` : la base EN LIGNE (une annonce en ligne n'est pas vendue, par la
// règle « en ligne ») : [{ id, favoris, offres? }]. Une annonce dont les favoris
// ne sont pas LUS n'est dans aucune liste (comptée à part, `favorisPasLus`).
// Les offres reçues par annonce : `offres` LU (nombre) ou `null` (pas lu). Une
// annonce qui a reçu au moins une offre lue sort de la liste ; « pas lu » ne
// vaut pas « aucune » : elle reste, et `offresPasLues` le dit.
// Tri : le plus de favoris d'abord ; à égalité, l'identifiant (stable).
export const SEUILS_FAVORIS = [3, 5, 10];
export const seuilFavorisValide = (s) => (SEUILS_FAVORIS.includes(Number(s)) ? Number(s) : 5);
export const favorisSansVente = (annonces, seuil = 5) => {
  if (!Array.isArray(annonces)) return null;
  const s = seuilFavorisValide(seuil);
  let total = 0, favorisLus = 0, offresPasLues = 0;
  const liste = [];
  for (const a of annonces) {
    if (!a || a.id == null || a.id === '') continue;
    total += 1;
    const f = compteurLu(a.favoris);
    if (f == null) continue;
    favorisLus += 1;
    if (f < s) continue;
    const o = compteurLu(a.offres);
    if (o != null && o > 0) continue;
    if (o == null) offresPasLues += 1;
    liste.push(a);
  }
  liste.sort((x, y) => compteurLu(y.favoris) - compteurLu(x.favoris) || (String(x.id) < String(y.id) ? -1 : String(x.id) > String(y.id) ? 1 : 0));
  return { total, favorisLus, favorisPasLus: total - favorisLus, offresPasLues, n: liste.length, seuil: s, liste };
};

// ── LES GESTES D'UNE PAIRE QUI DORT ────────────────────────────────────────
// Ceux qui EXISTENT déjà dans l'app, chacun ouvre l'écran existant sur SON clic :
//   republier  → l'atelier Republier, la paire pré-choisie, RIEN n'est lancé ;
//   prix       → Republier « modifier » : c'est LUI qui tape la baisse ;
//   vinted     → l'annonce sur Vinted, pour changer le prix lui-même ;
//   lbc / ebay / vestiaire → préparer l'annonce sur ce site (la fiche existante) ;
//   favoris    → « Envoyer une offre aux favoris » (la file existante), seulement
//                si des favoris sont LUS sur l'annonce (pas lu ⇒ pas proposé).
// `cap(nom)` → 'ok' | 'retard' | 'absente' (`extSait`) ; `version(nom)` → la
// version minimale. Un geste bloqué dit pourquoi (§2.7), jamais en silence.
// Aucun geste ne porte de prix : aucun montant n'est proposé (refusé le 11 oct.).
export const gestesDormeuse = ({ numero = '', favoris = null, url = '', cap = () => 'ok', version = () => '' } = {}) => {
  const ext = (c) => (cap(c) === 'ok' ? '' : `Demande l’extension VRM ${version(c) || 'à jour'} ou plus récente.`);
  const f = compteurLu(favoris);
  const g = [
    { k: 'republier', t: 'Ajouter à Republier', sous: 'tu choisis ensuite l’ordre et tu lances', bloque: ext('recreer') },
    { k: 'prix', t: 'Baisser le prix', sous: 'dans Republier, tu tapes la baisse', bloque: ext('republiermodif') },
    { k: 'vinted', t: 'Ouvrir sur Vinted', sous: 'pour changer le prix toi-même', bloque: url ? '' : 'Le lien de l’annonce n’est pas lu.' },
    { k: 'lbc', t: 'Préparer sur Leboncoin', sous: '', bloque: numero ? '' : 'Mets un N° à cet article d’abord.' },
    { k: 'ebay', t: 'Préparer sur eBay', sous: '', bloque: '' },
    { k: 'vestiaire', t: 'Préparer sur Vestiaire', sous: '', bloque: numero ? '' : 'Mets un N° à cet article d’abord.' },
  ];
  if (f != null && f > 0) g.push({ k: 'favoris', t: 'Envoyer une offre aux favoris', sous: `${f} favori${f > 1 ? 's' : ''} sur cette annonce`, bloque: ext('favoris') });
  return g;
};

// ── CE QUI PART VITE : CLASSER SANS CONCLURE TROP VITE ─────────────────────
// `D` : le résultat de `delaisPar` (groupes { k, n, nDelai, mediane }). Rend :
//   classes : les groupes à ≥ `min` ventes datées, du plus court au plus long
//             (médiane), à égalité le plus vendu d'abord, puis la clé ;
//   peu     : les groupes à 1..min−1 ventes datées (montrés, jamais classés) ;
//   nPeu    : le nombre de ventes datées dans ces groupes.
export const classerSansConclureTropVite = (D, min = SEUIL_CONCLUSION, max = 5) => {
  if (!D || !Array.isArray(D.groupes)) return null;
  const avec = D.groupes.filter((g) => g && g.nDelai > 0 && g.mediane != null);
  const classes = avec.filter((g) => g.nDelai >= min)
    .sort((a, b) => a.mediane - b.mediane || b.nDelai - a.nDelai || (a.k < b.k ? -1 : a.k > b.k ? 1 : 0)).slice(0, max);
  const peu = avec.filter((g) => g.nDelai < min).sort((a, b) => b.nDelai - a.nDelai || (a.k < b.k ? -1 : a.k > b.k ? 1 : 0));
  return { classes, peu, nPeu: peu.reduce((s, g) => s + g.nDelai, 0), min };
};

// ── LE COMPTE QUI VEND LE MIEUX ────────────────────────────────────────────
// `comptes` : [{ k, n }] (n = ventes de la période). « X vend le plus » ne se dit
// que si X a au moins `min` ventes ET strictement plus que le suivant ; sinon
// `null` (rien n'est conclu). Un seul compte : rien à comparer ⇒ `null`.
export const compteQuiVendLeMieux = (comptes, min = SEUIL_CONCLUSION) => {
  if (!Array.isArray(comptes) || comptes.length < 2) return null;
  const t = comptes.filter((c) => c && Number.isFinite(Number(c.n))).slice().sort((a, b) => b.n - a.n || (a.k < b.k ? -1 : 1));
  if (t.length < 2 || t[0].n < min || !(t[0].n > t[1].n)) return null;
  return t[0].k;
};

// ── LE BÉNÉFICE BRUT PAR COMPTE ────────────────────────────────────────────
// `groupes` : `classementRapporte(lignes, 'compte')` (src/ceQuiRapporte.js, LA
// règle du « Bénéfice brut » de Statistiques). On ne recalcule rien : on range
// par clé `Plateforme|compte` (Vinted) ou `Plateforme`, avec la couverture.
// Un groupe sans aucun prix d'achat connu ⇒ brut `null` (« — »).
export const brutParCompte = (groupes) => {
  if (!Array.isArray(groupes)) return null;
  const out = {};
  for (const g of groupes) {
    if (!g || !g.k) continue;
    out[g.k] = { brut: g.brut == null ? null : g.brut, nCout: g.nCout || 0, n: g.n || 0 };
  }
  return out;
};
// La clé `classementRapporte` d'une ligne « Par compte » de Statistiques.
export const cleBrutCompte = (plat, compte) => (plat === 'Vinted' ? `Vinted|${String(compte || '').trim()}` : String(plat || ''));

// ── LA CARTE DE MA JOURNÉE ─────────────────────────────────────────────────
// `dort` : `stockQuiDort(…)` (src/statsVentes.js, la base de la grille). Rend le
// nombre au seuil choisi, ou `null` (pas lu, aucune date) ; 0 ⇒ pas de carte.
export const cartePairesQuiDorment = (dort, seuil = 30) => {
  if (!dort || !dort.seuils || !(dort.datesConnues > 0)) return null;
  const b = dort.seuils[seuil];
  if (!b || !(b.n > 0)) return null;
  return { n: b.n, seuil, partiel: dort.datesConnues < dort.total, datesConnues: dort.datesConnues, total: dort.total };
};
