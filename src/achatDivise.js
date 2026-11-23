// ════════════════════════════════════════════════════════════════════════════
//  DIVISER UN ACHAT EN PARTS — un lot, ou un achat simple (22 nov. 2026, lot achats-lot)
// ════════════════════════════════════════════════════════════════════════════
// Julien (22 nov.) : « quand je fais un achat en lot, l'app comprend que c'est un lot, divise l'achat et propose de
// répartir le prix ; pareil pour un achat simple qui n'est pas appelé lot, je veux qu'on puisse le diviser ; fais ça bien ».
//
// LES RÈGLES (CLAUDE.md §2.4, §2.5, §2.10, §3 « Prix d'achat », §5 identité et chiffres) :
//   · un lot n'est JAMAIS divisé tout seul, son prix jamais deviné : l'app DÉTECTE et PROPOSE, c'est SON toucher qui
//     divise et qui valide la répartition (`planDivision` n'écrit rien sans `confirme === true`) ;
//   · « lot PROUVÉ » = la transaction de CET achat (son n°) porte plusieurs articles (`order.items[]`, `items_count`) —
//     une identité Vinted. Le titre « Lot … » n'ajoute qu'une SUGGESTION (« peut-être un lot ») : il n'affirme rien
//     (mesuré le 22 nov. : 115 achats titrés « Lot » sur 3 580 lignes, 2 transactions d'achat lues à plusieurs articles) ;
//   · une part = une IDENTITÉ à elle (`achat:{tx}#k`) qui partage celles de l'achat (n° de transaction, suivi, code de
//     retrait, reçu) ; chaque part a son N° de rangement à part (nouveau : `prochainLibre` de l'app, jamais un trou,
//     jamais réattribué ; ou une paire déjà numérotée, choisie par LUI) ;
//   · le total = ce qu'il a RÉELLEMENT payé : le REÇU de CET achat (articles + port + protection) quand il tombe juste
//     au centime, sinon le prix de la commande (dit : « reçu pas lu ») ; un remboursement partiel lu est déduit (la
//     règle de src/coutAchatNet.js) ; réparti au centime près, la somme des parts = le total EXACTEMENT, le centime
//     d'arrondi est DIT (sur quelle part) ;
//   · une saisie n'est jamais écrasée : une paire choisie qui a déjà SON prix d'achat le garde (part « fixée »), le
//     reste se répartit sur les autres ; l'écriture le revérifie (morceaux « champs » : un champ retouché est gardé) ;
//   · « Regrouper » rend l'achat d'origine tant qu'aucune part n'est reliée à une vente (« pas su » ⇒ refusé, dit) ;
//     les N° restent au pool (écrits sur des cartons) ;
//   · UNE seule règle du coût : « Dépensé » lit la COMMANDE (une ligne, `coutAchatNet`) — diviser ne la change pas ;
//     le coût d'une vente lit SA part (fiche ou `vinted_buyprice_by_num`) — la somme des parts = l'achat, jamais deux
//     fois. L'achat divisé est déclaré lot (`vrm_lots_declares[tx] = n`) : le reçu entier n'est plus jamais posé seul
//     sur une de ses paires (src/prixAchatRecu.js).
// Module PUR (aucun navigateur, aucune base) : la feuille (src/natif/ecrans/DiviserAchat.jsx), la coque
// (src/ecrans/Comptabilite.jsx `diviserAchat`) et scripts/audit-achats-lot.cjs exécutent CES fonctions.
// ─────────────────────────────────────────────────────────────────────────────
import { repartirPrixLot, articlesDeTransaction } from './venteLot.js';
import { centimesTapes, texteCentimes } from './grosLot.js';
import { ACHAT_SANS_COUT } from './prixAchatPropose.js';

export const PARTS_MIN = 2;
export const PARTS_MAX = 20;
export const CLE_DIVISIONS = 'vrm_achats_divises';
export const ORIGINE_DIVISION = 'achat-divise';
export const MODES_DIVISION = ['egal', 'articles', 'ventes', 'main'];
export { articlesDeTransaction, texteCentimes };

const str = (v) => String(v == null ? '' : v).trim();
const txDe = (v) => { const t = str(v); return /^\d{4,20}$/.test(t) ? t : ''; };
const estObjet = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const entier = (v) => Number.isSafeInteger(v);

// L'identité d'une part : celle de l'achat + son rang (1..n). Jamais un titre.
export const idPart = (tx, k) => (txDe(tx) && Number.isInteger(k) && k >= 1 ? `achat:${txDe(tx)}#${k}` : '');
export const nombreParts = (v) => { const n = Number(str(v)); return Number.isInteger(n) && n >= PARTS_MIN && n <= PARTS_MAX ? n : null; };
// Une division EN COURS (pas regroupée) de cet achat, ou null.
export const divisionActive = (divisions, tx) => {
  const d = estObjet(divisions) && txDe(tx) ? divisions[txDe(tx)] : null;
  return estObjet(d) && !d.regroupe && Array.isArray(d.parts) && d.parts.length >= PARTS_MIN ? d : null;
};

// ── 1. LE LOT : PROUVÉ (transaction), PEUT-ÊTRE (titre), DIVISÉ (son toucher), SIMPLE ─────────────────────────────
// achat : la commande lue ; articles : `articlesDeTransaction(tr)` (undefined = transaction pas lue) ;
// nbTx : `items_count` lu (null/undefined = pas lu) ; division : `divisionActive(...)`.
// → { etat: 'divise' | 'prouve' | 'peutEtre' | 'simple', n (nombre ou null), par: 'division'|'articles'|'transaction'|'titre'|null }
export function lotDeLAchat({ achat = null, articles = undefined, nbTx = null, division = null } = {}) {
  if (division) return { etat: 'divise', n: division.parts.length, par: 'division' };
  const nA = Array.isArray(articles) ? articles.length : 0;
  if (nA > 1) return { etat: 'prouve', n: nA, par: 'articles' };
  const nb = Number(nbTx);
  if (Number.isInteger(nb) && nb > 1) return { etat: 'prouve', n: nb, par: 'transaction' };
  const t = str(achat && achat.title);
  if (/^lot\b/i.test(t)) {
    const m = /^lot\s+(?:de\s+)?(\d{1,3})\b/i.exec(t);
    const n = m && Number(m[1]) >= PARTS_MIN && Number(m[1]) <= PARTS_MAX ? Number(m[1]) : null;
    return { etat: 'peutEtre', n, par: 'titre' };
  }
  return { etat: 'simple', n: null, par: null };
}

// ── 2. LE TOTAL : CE QU'IL A PAYÉ ───────────────────────────────────────────────────────────────────────────────
// Le reçu juste ⇒ son « Montant payé », ventilé (articles · port · protection et frais). Sinon le prix de la commande.
const RE_PORT = /\b(?:port|livraison|exp[ée]dition|envoi|shipping|transport)\b/i;
const RE_FRAIS = /\b(?:protection|frais|service|s[ée]curis|commission)/i;
export function ventilerRecu(v) {
  if (!v || !v.trouve || v.somme !== 'juste' || !entier(v.paye) || v.paye <= 0 || !Array.isArray(v.lignes)) return null;
  let articles = 0, port = 0, frais = 0;
  for (const l of v.lignes) {
    if (!l || !entier(l.centimes)) return null;
    const lib = str(l.libelle);
    if (RE_PORT.test(lib)) port += l.centimes; else if (RE_FRAIS.test(lib)) frais += l.centimes; else articles += l.centimes;
  }
  return articles + port + frais === v.paye ? { articles, port, frais } : null;
}
const prixCommande = (a) => {
  if (!a || a.price == null) return null;
  const devise = str((typeof a.price === 'object' && a.price.currency_code) || 'EUR').toUpperCase();
  if (devise !== 'EUR') return { devise };
  const c = centimesTapes(typeof a.price === 'object' ? a.price.amount : a.price);
  return entier(c) && c > 0 ? { c } : null;
};
// → { total (centimes) | null, source: 'recu' | 'commande' | null, detail: { articles, port, frais } | null,
//     rembourse (centimes déduits), raison: '' | 'rembourse' | 'devise' | 'prix' }
export function totalADiviser({ achat = null, ventilation = null } = {}) {
  const vide = (raison) => ({ total: null, source: null, detail: null, rembourse: 0, raison });
  if (!achat || !txDe(achat.transaction_id)) return vide('prix');
  if (ACHAT_SANS_COUT.test(str(achat.status))) return vide('rembourse');
  const pc = prixCommande(achat);
  if (pc && pc.devise) return vide('devise');
  const detail = ventilerRecu(ventilation);
  let total = detail ? ventilation.paye : pc ? pc.c : null;
  if (!entier(total)) return vide('prix');
  // Un remboursement PARTIEL lu (src/coutAchatNet.js : `_rembPartiel`) : seul le reste a été payé.
  let rembourse = 0;
  const rp = achat._rembPartiel;
  if (rp && Number.isFinite(Number(rp.montant)) && Number(rp.montant) > 0) {
    rembourse = Math.round(Number(rp.montant) * 100);
    if (rembourse >= total) return vide('rembourse');
    total -= rembourse;
  }
  return { total, source: detail ? 'recu' : 'commande', detail: rembourse ? null : detail, rembourse, raison: '' };
}

// ── 3. LA RÉPARTITION, AU CENTIME ───────────────────────────────────────────────────────────────────────────────
// total (centimes) · n · mode · poids { articles: [c|null], ventes: [c|null] } (un par part) · manuels: [texte tapé] ·
// fixes: { [indice]: centimes } (une paire qui a déjà SON prix : gardé) · detail (ventilation) · fraisMode 'prorata'|'egal'.
// → { ok, mode, parts: [c] | null, somme, reste, arrondi: [indices qui ont reçu un centime d'arrondi], raison, rangs }
// raison : 'total' · 'n' · 'mode' · 'poids' (un prix manque : les rangs dits) · 'fixes' (les prix gardés dépassent
//          le total) · 'illisible' (un montant tapé) · 'ecart' (la somme ≠ total : `reste` le dit).
const plusGrandReste = (total, poids) => (poids.length ? repartirPrixLot(total, poids.map((p) => ({ prix: p, devise: 'EUR' }))).parts : []);
const arrondiDe = (total, poids, parts) => {
  const s = poids.reduce((a, b) => a + b, 0);
  return parts.map((p, i) => (s > 0 && p > Math.floor((total * poids[i]) / s) ? i : -1)).filter((i) => i >= 0);
};
export function repartirParts({ total, n, mode = 'egal', poids = {}, manuels = [], fixes = {}, detail = null, fraisMode = 'prorata' } = {}) {
  const echec = (raison, plus = {}) => ({ ok: false, mode, parts: null, somme: null, reste: null, arrondi: [], raison, rangs: [], ...plus });
  if (!(entier(total) && total > 0)) return echec('total');
  if (!(Number.isInteger(n) && n >= PARTS_MIN && n <= PARTS_MAX)) return echec('n');
  if (!MODES_DIVISION.includes(mode)) return echec('mode');
  const fx = {};
  for (const [i, c] of Object.entries(estObjet(fixes) ? fixes : {})) { const k = Number(i); if (Number.isInteger(k) && k >= 0 && k < n && entier(c) && c >= 0) fx[k] = c; }
  const libres = [...Array(n).keys()].filter((i) => fx[i] == null);
  const sommeFixes = Object.values(fx).reduce((a, b) => a + b, 0);
  const cible = total - sommeFixes;
  if (cible < 0) return echec('fixes', { reste: cible });
  const parts = Array.from({ length: n }, (_, i) => (fx[i] != null ? fx[i] : 0));
  if (mode === 'main') {
    const lus = libres.map((i) => centimesTapes(manuels[i]));
    const illisibles = libres.filter((_, j) => !entier(lus[j]));
    libres.forEach((i, j) => { parts[i] = entier(lus[j]) ? lus[j] : 0; });
    const somme = parts.reduce((a, b) => a + b, 0);
    const reste = total - somme;
    if (illisibles.length) return { ok: false, mode, parts, somme, reste, arrondi: [], raison: 'illisible', rangs: illisibles };
    if (reste !== 0) return { ok: false, mode, parts, somme, reste, arrondi: [], raison: 'ecart', rangs: [] };
    return { ok: true, mode, parts, somme, reste: 0, arrondi: [], raison: '', rangs: [] };
  }
  if (!libres.length) {
    return cible === 0 ? { ok: true, mode, parts, somme: total, reste: 0, arrondi: [], raison: '', rangs: [] } : echec('ecart', { parts, somme: sommeFixes, reste: cible });
  }
  let w;
  if (mode === 'egal') w = libres.map(() => 1);
  else {
    const src = Array.isArray(poids[mode]) ? poids[mode] : [];
    const manque = libres.filter((i) => !(entier(src[i]) && src[i] > 0));
    if (manque.length) return echec('poids', { rangs: manque });
    w = libres.map((i) => src[i]);
  }
  const arrondi = [];
  // Port et frais à parts égales (son réglage) : seulement quand le reçu les ventile et qu'aucune part n'est fixée.
  const fp = detail && entier(detail.port) && entier(detail.frais) ? detail.port + detail.frais : 0;
  if (fraisMode === 'egal' && fp > 0 && sommeFixes === 0 && detail.articles + fp === total) {
    const pa = plusGrandReste(detail.articles, w), pf = plusGrandReste(fp, libres.map(() => 1));
    libres.forEach((i, j) => { parts[i] = pa[j] + pf[j]; });
    for (const j of new Set([...arrondiDe(detail.articles, w, pa), ...arrondiDe(fp, libres.map(() => 1), pf)])) arrondi.push(libres[j]);
  } else {
    const p = plusGrandReste(cible, w);
    libres.forEach((i, j) => { parts[i] = p[j]; });
    for (const j of arrondiDe(cible, w, p)) arrondi.push(libres[j]);
  }
  const somme = parts.reduce((a, b) => a + b, 0);
  if (somme !== total) return echec('ecart', { parts, somme, reste: total - somme });
  return { ok: true, mode, parts, somme, reste: 0, arrondi: arrondi.sort((a, b) => a - b), raison: '', rangs: [] };
}
// Les modes qu'on peut PROPOSER (un mode dont un poids manque n'est pas proposé ; « à la main » toujours).
export function modesPossibles({ n, poids = {} } = {}) {
  const tous = (src) => Array.isArray(src) && src.length >= n && src.slice(0, n).every((c) => entier(c) && c > 0);
  return MODES_DIVISION.filter((m) => m === 'egal' || m === 'main' || tous(poids[m]));
}

// ── 4. LE PLAN : CE QUI S'ÉCRIT SUR SON TOUCHER ─────────────────────────────────────────────────────────────────
// Les morceaux du geste annulable (src/corbeille.js) : 'champs' sur une fiche (un champ retouché depuis est GARDÉ),
// 'cle' pour une fiche neuve, un coût par N°, la déclaration de lot, la division elle-même.
//   parts : [{ titre, photo, taille, item, cible: { type: 'neuf', numero, ficheId } | { type: 'fiche', cle, numero, entree } }]
//   repartition : le résultat `repartirParts` (rejoué par la coque juste avant d'écrire)
//   lus : { fiches (vinted_annonce_numeros), couts (vinted_buyprice_by_num), neuves (vrm_fiches_neuves), declares, divisions }
// Rend { record, morceaux } ou { erreur } (rien n'est écrit sur une erreur).
const CHAMPS_LIEN = ['buyPrice', 'buyFromId', 'buyFrom', 'buyPart', 'buyPriceSource', 'buyPriceRecuTx'];
const prixSaisi = (e) => estObjet(e) && e.buyPrice != null && str(e.buyPrice) !== '';
export function planDivision({ confirme = false, achat = null, total = null, source = null, rembourse = 0, repartition = null, fraisMode = 'prorata', parts = [], lus = null, at = '', accNom = '', photoAchat = '' } = {}) {
  if (confirme !== true) return { erreur: 'confirme' };
  const tx = txDe(achat && achat.transaction_id);
  if (!tx) return { erreur: 'achat' };
  if (!lus || !estObjet(lus.fiches) || !estObjet(lus.couts) || !estObjet(lus.neuves) || !estObjet(lus.declares) || !estObjet(lus.divisions)) return { erreur: 'lecture' };
  if (divisionActive(lus.divisions, tx)) return { erreur: 'deja' };
  const n = Array.isArray(parts) ? parts.length : 0;
  if (!nombreParts(n)) return { erreur: 'n' };
  if (!repartition || !repartition.ok || !Array.isArray(repartition.parts) || repartition.parts.length !== n) return { erreur: 'repartition' };
  if (!entier(total) || repartition.parts.reduce((a, b) => a + b, 0) !== total) return { erreur: 'somme' };
  // Deux parts sur le même N° (ou la même fiche) : impossible (deux paires sous un N° = le seul risque irréversible).
  const vus = new Set();
  for (const p of parts) {
    const c = p && p.cible; const k = c && c.type === 'fiche' ? 'f:' + str(c.cle) : c && c.type === 'neuf' ? 'n:' + str(c.numero).toUpperCase() : '';
    if (!k || k === 'f:' || k === 'n:') return { erreur: 'cible' };
    if (vus.has(k)) return { erreur: 'doublon' };
    vus.add(k);
    if (c.type === 'neuf' && (!str(c.ficheId) || lus.neuves[str(c.ficheId)] !== undefined || lus.couts[str(c.numero)] != null)) return { erreur: 'numero' };
    if (c.type === 'fiche') {
      const e = lus.fiches[str(c.cle)]; if (!estObjet(e)) return { erreur: 'fiche' };
      if (txDe(e.buyFromId) && txDe(e.buyFromId) !== tx) return { erreur: 'reliee' };
      // SA saisie est la part de cette paire : une répartition qui l'ignore ne s'écrit pas (la somme serait fausse).
      if (prixSaisi(e) && centimesTapes(e.buyPrice) !== repartition.parts[parts.indexOf(p)]) return { erreur: 'saisie' };
    }
  }
  const morceaux = [];
  const liste = parts.map((p, i) => {
    const k = i + 1, prix = repartition.parts[i], id = idPart(tx, k), c = p.cible;
    const base = { k, id, titre: str(p.titre).slice(0, 200), photo: str(p.photo).slice(0, 500), taille: str(p.taille).slice(0, 40), item: p.item != null ? str(p.item) : null, prix };
    if (c.type === 'fiche') {
      const e = lus.fiches[str(c.cle)];
      const saisie = prixSaisi(e);
      const avant = {}; for (const f of CHAMPS_LIEN) avant[f] = e[f];
      const apres = { ...avant, buyFromId: tx, buyPart: k,
        buyFrom: { ...(estObjet(e.buyFrom) ? e.buyFrom : {}), title: str(achat.title), date: str(achat.date), photo: photoAchat || '', price: prix / 100, devise: 'EUR', status: str(achat.status), account: accNom, lot: true, part: k, partId: id, prixLot: total / 100, divise: at } };
      if (!saisie) { apres.buyPrice = texteCentimes(prix); apres.buyPriceSource = ORIGINE_DIVISION; apres.buyPriceRecuTx = tx; }
      morceaux.push({ k: 'vinted_annonce_numeros', type: 'champs', id: str(c.cle), avant, apres });
      return { ...base, numero: str(e.numero || c.numero), fiche: str(c.cle), neuve: null, saisie };
    }
    const fiche = { id: str(c.ficheId), numero: str(c.numero), creeAt: at, photos: [], titre: base.titre || `${str(achat.title) || 'Achat'} · ${k}/${n}`, marque: '', taille: base.taille, etat: '', description: '',
      prix: null, origine: ORIGINE_DIVISION, achat: tx, part: k, partId: id, cout: prix, ...(base.photo ? { photoAchat: base.photo } : {}) };
    morceaux.push({ k: 'vrm_fiches_neuves', type: 'cle', id: fiche.id, avant: undefined, apres: fiche });
    morceaux.push({ k: 'vinted_buyprice_by_num', type: 'cle', id: fiche.numero, avant: undefined, apres: texteCentimes(prix) });
    return { ...base, numero: fiche.numero, fiche: null, neuve: fiche.id, saisie: false };
  });
  const declareAvant = lus.declares[tx];
  morceaux.push({ k: 'vrm_lots_declares', type: 'cle', id: tx, avant: declareAvant, apres: n });
  const prec = estObjet(lus.divisions[tx]) ? lus.divisions[tx] : null;
  const historique = [...(prec && Array.isArray(prec.historique) ? prec.historique : []),
    { at, geste: 'diviser', n, mode: repartition.mode, total, parts: repartition.parts.slice() }].slice(-30);
  const record = { tx, n, at, total, source, rembourse: entier(rembourse) ? rembourse : 0, mode: repartition.mode, fraisMode, declareAvant: declareAvant === undefined ? null : declareAvant,
    parts: liste, morceaux: morceaux.map((m) => ({ ...m })), historique };
  morceaux.push({ k: CLE_DIVISIONS, type: 'cle', id: tx, avant: prec === null ? undefined : prec, apres: record });
  return { record, morceaux };
}

// ── 5. CHANGER LA RÉPARTITION (SON toucher) ─────────────────────────────────────────────────────────────────────
// Les nouveaux montants sur les parts déjà posées. Un prix qu'il a retouché depuis la division est gardé (fixé).
export function planNouvelleRepartition({ confirme = false, division = null, repartition = null, at = '' } = {}) {
  if (confirme !== true) return { erreur: 'confirme' };
  if (!estObjet(division) || division.regroupe || !Array.isArray(division.parts)) return { erreur: 'division' };
  const n = division.parts.length;
  if (!repartition || !repartition.ok || !Array.isArray(repartition.parts) || repartition.parts.length !== n) return { erreur: 'repartition' };
  if (repartition.parts.reduce((a, b) => a + b, 0) !== division.total) return { erreur: 'somme' };
  const morceaux = [];
  const stock = (division.morceaux || []).map((m) => ({ ...m }));
  division.parts.forEach((p, i) => {
    const nv = repartition.parts[i]; if (nv === p.prix || p.saisie) return;
    // Chaque champ changé l'est par un morceau (avant = ce que la division avait posé) ; le morceau gardé dans la division
    // suit, pour que « Regrouper » défasse exactement ce qui est posé MAINTENANT.
    if (p.fiche) {
      const ancien = stock.find((m) => m.k === 'vinted_annonce_numeros' && m.id === p.fiche);
      const bfAvant = ancien && ancien.apres ? ancien.apres.buyFrom : undefined;
      const bfApres = bfAvant && typeof bfAvant === 'object' ? { ...bfAvant, price: nv / 100 } : bfAvant;
      morceaux.push({ k: 'vinted_annonce_numeros', type: 'champs', id: p.fiche, avant: { buyPrice: texteCentimes(p.prix), buyFrom: bfAvant }, apres: { buyPrice: texteCentimes(nv), buyFrom: bfApres } });
      if (ancien) ancien.apres = { ...ancien.apres, buyPrice: texteCentimes(nv), buyFrom: bfApres };
    } else if (p.numero) {
      morceaux.push({ k: 'vinted_buyprice_by_num', type: 'cle', id: p.numero, avant: texteCentimes(p.prix), apres: texteCentimes(nv) });
      const ancien = stock.find((m) => m.k === 'vinted_buyprice_by_num' && m.id === p.numero); if (ancien) ancien.apres = texteCentimes(nv);
      const fn = stock.find((m) => m.k === 'vrm_fiches_neuves' && m.id === p.neuve);
      if (fn && fn.apres) { const nf = { ...fn.apres, cout: nv }; morceaux.push({ k: 'vrm_fiches_neuves', type: 'cle', id: p.neuve, avant: fn.apres, apres: nf }); fn.apres = nf; }
    }
  });
  const record = { ...division, at, mode: repartition.mode, parts: division.parts.map((p, i) => (p.saisie ? p : { ...p, prix: repartition.parts[i] })), morceaux: stock,
    historique: [...(division.historique || []), { at, geste: 'repartir', n, mode: repartition.mode, total: division.total, parts: repartition.parts.slice() }].slice(-30) };
  morceaux.push({ k: CLE_DIVISIONS, type: 'cle', id: division.tx, avant: division, apres: record });
  return { record, morceaux };
}

// ── 6. REGROUPER ────────────────────────────────────────────────────────────────────────────────────────────────
// venduDe(numero) → true (vendue) · false (pas vendue) · null (pas su). Une part sans N° (impossible ici) ⇒ pas su.
// → { ok, raison: '' | 'vendue' | 'passu' | 'division', nums: [N° en cause] }
export function peutRegrouper(division, { venduDe = null } = {}) {
  if (!estObjet(division) || division.regroupe || !Array.isArray(division.parts)) return { ok: false, raison: 'division', nums: [] };
  if (typeof venduDe !== 'function') return { ok: false, raison: 'passu', nums: [] };
  const vendues = [], passu = [];
  for (const p of division.parts) {
    const v = p && p.numero ? venduDe(p.numero) : null;
    if (v === true) vendues.push(p.numero); else if (v !== false) passu.push(p && p.numero ? p.numero : '?');
  }
  if (vendues.length) return { ok: false, raison: 'vendue', nums: vendues };
  if (passu.length) return { ok: false, raison: 'passu', nums: passu };
  return { ok: true, raison: '', nums: [] };
}
// Les morceaux de « Regrouper » : l'inverse de ce que la division a posé (une fiche neuve ou un prix retouché depuis
// est GARDÉ — la règle des morceaux), la déclaration de lot rendue, la division close et gardée dans l'historique.
export function planRegroupement({ confirme = false, division = null, peut = null, at = '' } = {}) {
  if (confirme !== true) return { erreur: 'confirme' };
  if (!peut || !peut.ok) return { erreur: (peut && peut.raison) || 'passu' };
  if (!estObjet(division) || !Array.isArray(division.morceaux)) return { erreur: 'division' };
  const morceaux = division.morceaux.filter((m) => m && m.k !== CLE_DIVISIONS).map((m) => ({ ...m, avant: m.apres, apres: m.avant }));
  const record = { tx: division.tx, regroupe: true, at, n: division.n, total: division.total,
    historique: [...(division.historique || []), { at, geste: 'regrouper', n: division.n, mode: division.mode, total: division.total, parts: division.parts.map((p) => p.prix) }].slice(-30),
    numeros: division.parts.map((p) => p.numero).filter(Boolean) };
  morceaux.push({ k: CLE_DIVISIONS, type: 'cle', id: division.tx, avant: division, apres: record });
  return { record, morceaux };
}

// ── 7. LES CHIFFRES : UNE SEULE RÈGLE ───────────────────────────────────────────────────────────────────────────
// La somme des parts d'une division (centimes) — elle vaut le total, toujours ; null si une part est illisible.
export const sommeParts = (division) => {
  if (!estObjet(division) || !Array.isArray(division.parts)) return null;
  let s = 0; for (const p of division.parts) { if (!p || !entier(p.prix)) return null; s += p.prix; } return s;
};
export const divisionJuste = (division) => sommeParts(division) === (division && division.total);
// Les N° des parts (« 45 · 46 · 47 »), pour la rangée d'Achats.
export const numerosDesParts = (division) => (division && Array.isArray(division.parts) ? division.parts.map((p) => str(p && p.numero)).filter(Boolean) : []);
// Après la division, la liste des liens d'un achat compte ses n parts (Relier ne le propose plus : il est complet).
export const liensAvecDivisions = (liens, divisions) => {
  const m = new Map(liens instanceof Map ? liens : []);
  for (const [tx, d] of Object.entries(estObjet(divisions) ? divisions : {})) if (divisionActive(divisions, tx)) m.set(tx, Math.max(m.get(tx) || 0, d.parts.length));
  return m;
};
