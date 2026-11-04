// ════════════════════════════════════════════════════════════════════════════
//  ACHATS : FOURNISSEURS · DÉLAI AVANT MISE EN LIGNE · LOTS RÉPARTIS (4 nov.)
// ════════════════════════════════════════════════════════════════════════════
// Trois outils choisis par Julien pour l'écran Achats. Module PUR (aucune
// lecture, aucune écriture) : l'app lui passe ses lectures, il rend des chiffres
// AVEC leur couverture, et les écritures d'une répartition seulement sur SON clic.
// Exécuté par scripts/audit-achats-sourcing.cjs.
//
// §5 « l'identité d'une paire » — un achat n'est relié à un article (fiche ou
// vente) QUE par :
//   · `buyFromId` = n° de transaction de l'achat Vinted (le lien posé par SON
//     clic : « Relier un achat », prix proposé accepté, répartition d'un lot) ;
//   · le N° qu'il a écrit sur un achat HORS plateforme (`numero`), comparé par
//     `cleNum` — et seulement si ce N° ne désigne qu'UN achat hors plateforme.
// JAMAIS le titre, la marque, la taille, la photo ressemblante.
//
// §5 « les chiffres » — rien n'est présenté comme complet quand il ne l'est pas :
//   · « Dépensé » = le prix de la COMMANDE (un lot compté une fois, jamais la
//     somme des parts de ses N°), hors achats remboursés/annulés ; un prix
//     illisible ou dans une autre devise n'est pas compté et l'est à part ;
//   · « Bénéfice » = la somme des bénéfices CONNUS des ventes reliées (règle
//     propriétaire `beneficeLigneVente`, calculée par l'appelant) ; aucun connu
//     ⇒ null (« — ») ; un bénéfice « au plus » (frais pas confirmés) le reste ;
//   · « Reliés N/M » : combien de ses achats ont au moins un article relié.
//   · Le pseudo d'un vendeur Vinted n'est lu que dans SA transaction ; pas lu ⇒
//     le groupe « Vinted » (jamais deviné). Donnée tierce : rien n'est exporté.
// ─────────────────────────────────────────────────────────────────────────────

// Un achat qui n'a rien coûté (la règle de src/prixAchatPropose.js, recopiée
// ici par import pour ne pas tenir deux définitions).
import { ACHAT_SANS_COUT } from './prixAchatPropose.js';

const J = 86400000;
const txDe = (a) => { const t = String(a && a.transaction_id != null ? a.transaction_id : '').trim(); return /^\d{4,20}$/.test(t) ? t : ''; };
const txLien = (v) => { const t = String(v == null ? '' : v).trim(); return /^\d{4,20}$/.test(t) ? t : ''; };

// Un montant en centimes entiers, ou null (illisible). « 42,5 » · 42.5 · « 42 € ».
export function centimesDe(v) {
  if (v == null) return null;
  const t = String(v).replace(/[\s €]/g, '').replace(',', '.');
  if (!/^-?\d+(\.\d{1,2})?$/.test(t)) return null;
  const c = Math.round(Number(t) * 100);
  return Number.isSafeInteger(c) ? c : null;
}
// Le prix PAYÉ d'un achat Vinted, en centimes — euros seulement.
export function prixAchatCentimes(a) {
  if (!a || !a.price) return null;
  const devise = String((typeof a.price === 'object' && a.price.currency_code) || 'EUR').toUpperCase();
  if (devise !== 'EUR') return null;
  const c = centimesDe(typeof a.price === 'object' ? a.price.amount : a.price);
  return c != null && c >= 0 ? c : null;
}
export const achatSansCout = (a) => ACHAT_SANS_COUT.test(String((a && a.status) || ''));

// ── LES ARTICLES RELIÉS À CHAQUE ACHAT ─────────────────────────────────────
// Map tx → [{ cle: 'f:<clé fiche>' | 'v:<tx vente>', numero, buyPrice }],
// par `buyFromId` SEULEMENT (fiches puis corrections posées sur une vente).
export function articlesParAchat({ fiches, saleOv } = {}) {
  const m = new Map();
  const ajouter = (tx, x) => { if (!m.has(tx)) m.set(tx, []); m.get(tx).push(x); };
  for (const [k, e] of Object.entries(fiches || {})) {
    const tx = txLien(e && e.buyFromId); if (!tx) continue;
    ajouter(tx, { cle: 'f:' + k, numero: String((e && e.numero) || '').trim(), buyPrice: e.buyPrice != null ? String(e.buyPrice) : '' });
  }
  for (const [k, e] of Object.entries(saleOv || {})) {
    const tx = txLien(e && e.buyFromId); if (!tx) continue;
    ajouter(tx, { cle: 'v:' + k, numero: String((e && e.numero) || '').trim(), buyPrice: e.buyPrice != null ? String(e.buyPrice) : '' });
  }
  return m;
}

// ════════════════════════════════════════════════════════════════════════════
// 1. ACHATS PAR FOURNISSEUR
// ════════════════════════════════════════════════════════════════════════════
export const FOURNISSEUR_VINTED_PAS_LU = 'v:?';
// Le fournisseur d'un achat Vinted : le pseudo lu dans SA transaction, sinon « Vinted ».
export function fournisseurVinted(achat, vendeurDe) {
  const tx = txDe(achat);
  const login = tx && typeof vendeurDe === 'function' ? String(vendeurDe(tx) || '').trim() : '';
  if (login) return { cle: 'v:' + login.toLowerCase(), nom: login, type: 'vendeur' };
  return { cle: FOURNISSEUR_VINTED_PAS_LU, nom: 'Vinted', type: 'pas-lu' };
}
// Le fournisseur d'un achat HORS plateforme : la source qu'il a saisie.
export function fournisseurHors(b, sourceDe) {
  const s = String((typeof sourceDe === 'function' ? sourceDe(b) : (b && b.source)) || '').trim();
  const cle = s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
  return s ? { cle: 'h:' + cle, nom: s, type: 'hors' } : { cle: 'h:?', nom: 'Hors plateforme', type: 'hors' };
}

// Le tableau des fournisseurs.
//   achats      : achats Vinted captés (my_orders, `price` objet)
//   hors        : achats hors plateforme saisis ({ id, price, numero, source })
//   fiches, saleOv : les fiches (N°) et les corrections posées sur les ventes
//   ventes      : [{ id, entree, benefice: { valeur: € | null, partiel: bool } }]
//                 `entree` = la fiche fusionnée de LA vente (effEntry) ;
//                 `benefice` = la règle propriétaire (beneficeLigneVente).
//   vendeurDe(tx) → pseudo lu | '' ; sourceDe(b) → libellé ; prixHors(b) → € | null
//   cleNum(n)   → l'identité d'un N°
// Rend { lignes, vendeurLu: { n, sur }, sansPrix }.
export function fournisseurs({ achats = [], hors = [], fiches = {}, saleOv = {}, ventes = [], vendeurDe = null, sourceDe = null, prixHors = null, cleNum = null } = {}) {
  const lignes = new Map();
  const ligne = (f) => {
    if (!lignes.has(f.cle)) lignes.set(f.cle, { cle: f.cle, nom: f.nom, type: f.type, achats: 0, depense: 0, sansPrix: 0, relies: 0, revendus: 0, benefice: 0, beneficesConnus: 0, partiel: false });
    return lignes.get(f.cle);
  };
  const liens = articlesParAchat({ fiches, saleOv });
  const parTx = new Map();          // tx Vinted → ligne
  const horsParNum = new Map();     // cleNum → ligne | 'ambigu'
  const horsAvecFiche = [];         // [ligne, cleNum] : un achat hors plateforme dont le N° porte une fiche
  let vendeurLu = 0, vendeursSur = 0, sansPrix = 0;
  const reliesTx = new Set();
  for (const a of (Array.isArray(achats) ? achats : [])) {
    const tx = txDe(a); if (!tx || achatSansCout(a) || parTx.has(tx)) continue;
    const f = fournisseurVinted(a, vendeurDe);
    vendeursSur++; if (f.type === 'vendeur') vendeurLu++;
    const l = ligne(f); parTx.set(tx, l);
    l.achats++;
    const c = prixAchatCentimes(a);
    if (c == null) { l.sansPrix++; sansPrix++; } else l.depense += c;
    if ((liens.get(tx) || []).length) { l.relies++; reliesTx.add(tx); }
  }
  const cn = typeof cleNum === 'function' ? cleNum : (x) => String(x == null ? '' : x).trim().toUpperCase();
  const fichesParNum = new Map();
  for (const e of Object.values(fiches || {})) { const k = e && e.numero != null ? cn(e.numero) : ''; if (k) fichesParNum.set(k, (fichesParNum.get(k) || 0) + 1); }
  for (const b of (Array.isArray(hors) ? hors : [])) {
    if (!b) continue;
    const l = ligne(fournisseurHors(b, sourceDe));
    l.achats++;
    const p = typeof prixHors === 'function' ? prixHors(b) : (centimesDe(b.price) == null ? null : centimesDe(b.price) / 100);
    const c = p == null || !Number.isFinite(Number(p)) ? null : Math.round(Number(p) * 100);
    if (c == null) { l.sansPrix++; sansPrix++; } else l.depense += c;
    const k = b.numero != null ? cn(b.numero) : '';
    if (k) {
      horsParNum.set(k, horsParNum.has(k) ? 'ambigu' : l);
      if (fichesParNum.get(k)) horsAvecFiche.push([l, k]);
    }
  }
  // Un N° hors plateforme relie seulement s'il ne désigne qu'UN achat hors plateforme.
  for (const [l, k] of horsAvecFiche) if (horsParNum.get(k) === l) l.relies++;
  // Les ventes reliées : `buyFromId` d'abord, sinon le N° d'un achat hors plateforme.
  const vuesVentes = new Set();
  for (const v of (Array.isArray(ventes) ? ventes : [])) {
    if (!v || vuesVentes.has(v.id)) continue; vuesVentes.add(v.id);
    const e = v.entree || null;
    let l = null;
    const tx = txLien(e && e.buyFromId);
    if (tx) l = parTx.get(tx) || null;
    else if (e && e.numero != null && String(e.numero).trim()) { const h = horsParNum.get(cn(e.numero)); l = h && h !== 'ambigu' ? h : null; }
    if (!l) continue;
    l.revendus++;
    const b = v.benefice || {};
    if (b.valeur != null && Number.isFinite(Number(b.valeur))) { l.benefice += Math.round(Number(b.valeur) * 100); l.beneficesConnus++; if (b.partiel) l.partiel = true; }
  }
  const out = [...lignes.values()].map((l) => ({ ...l, benefice: l.beneficesConnus ? l.benefice : null }));
  return { lignes: out, vendeurLu: { n: vendeurLu, sur: vendeursSur }, sansPrix };
}

export const TRIS_FOURNISSEURS = { depense: 'Dépensé', achats: 'Achats', revendus: 'Revendus', benefice: 'Bénéfice', nom: 'Nom' };
// Tri : décroissant (nom : alphabétique) ; un bénéfice pas su va en dernier.
export function trierFournisseurs(lignes, tri = 'depense') {
  const l = [...(lignes || [])];
  const nom = (a, b) => String(a.nom).localeCompare(String(b.nom), 'fr', { sensitivity: 'base' });
  if (tri === 'nom') return l.sort(nom);
  return l.sort((a, b) => {
    const x = a[tri], y = b[tri];
    if (x == null && y == null) return nom(a, b);
    if (x == null) return 1;
    if (y == null) return -1;
    return (y - x) || nom(a, b);
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 2. DÉLAI ACHAT → MISE EN LIGNE
// ════════════════════════════════════════════════════════════════════════════
const msDe = (v) => {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? (v < 1e12 ? v * 1000 : v) : null;
  const t = Date.parse(v); return Number.isFinite(t) ? t : null;
};
// La date de RÉCEPTION d'un achat, LUE — jamais déduite :
//   1. « Commande livrée » dans SA transaction (envoi au statut 400, date de ce statut) ;
//   2. « Récupéré » touché par lui sur CE colis (`vinted_pickup_done`, par transaction).
// Sinon null (exclu des délais, compté à part).
export function dateReception(achat, { infosTx = null, recuClic = null } = {}) {
  const tx = txDe(achat); if (!tx) return null;
  const i = infosTx && infosTx[tx];
  if (i && String(i.livSt) === '400') { const t = msDe(i.livAt); if (t != null) return { ms: t, source: 'livraison' }; }
  const c = recuClic && recuClic[tx]; const t2 = msDe(c);
  if (t2 != null) return { ms: t2, source: 'clic' };
  return null;
}
export function mediane(xs) {
  const s = (xs || []).filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const moisDe = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

// Le délai, et « Reçus, pas encore en ligne ».
//   achats       : achats Vinted captés
//   receptionDe(a) → { ms, source } | null   (`dateReception`)
//   estRecu(a)   → vrai si Vinted le dit reçu (même sans date lue)
//   articlesDe(tx) → [{ cle, numero, misEnLigne: ms | null, enLigne: true | false | null, vendu: bool }]
//                    les articles reliés PAR IDENTITÉ (`articlesParAchat`), avec leurs lectures
//   enLigneLu    : faux tant que les annonces ne sont pas lues ⇒ la liste vaut null (pas su)
// Rend { mois: [{ mois, mediane, n }], mediane, n, exclus: { sansReception, sansMiseEnLigne, avant },
//        pasEnLigne: [{ achat, tx, recu, articles, relie }] | null, pasSu }
export function delaisMiseEnLigne({ achats = [], receptionDe, estRecu = null, articlesDe, enLigneLu = false, maintenant = Date.now() } = {}) {
  const parMois = new Map(); const tous = [];
  const exclus = { sansReception: 0, sansMiseEnLigne: 0, avant: 0 };
  const pasEnLigne = []; let pasSu = 0;
  const vus = new Set();
  for (const a of (Array.isArray(achats) ? achats : [])) {
    const tx = txDe(a); if (!tx || vus.has(tx) || achatSansCout(a)) continue; vus.add(tx);
    const rec = typeof receptionDe === 'function' ? receptionDe(a) : null;
    const arts = typeof articlesDe === 'function' ? (articlesDe(tx) || []) : [];
    // Le délai : achats RELIÉS seulement (un achat sans article n'a pas de mise en ligne).
    if (arts.length) {
      const dates = arts.map((x) => msDe(x && x.misEnLigne)).filter((x) => x != null);
      if (!rec) exclus.sansReception++;
      else if (!dates.length) exclus.sansMiseEnLigne++;
      else {
        const premiere = Math.min(...dates);
        if (premiere < rec.ms) exclus.avant++;
        else {
          const j = Math.floor((premiere - rec.ms) / J);
          const k = moisDe(rec.ms);
          if (!parMois.has(k)) parMois.set(k, []);
          parMois.get(k).push(j); tous.push(j);
        }
      }
    }
    // Reçus, pas encore en ligne : reçu (date lue ou Vinted le dit), aucun article en ligne ni vendu.
    const recu = !!rec || (typeof estRecu === 'function' && estRecu(a));
    if (!recu) continue;
    if (arts.some((x) => x && (x.enLigne === true || x.vendu === true))) continue;
    if (arts.some((x) => x && x.enLigne == null)) { pasSu++; continue; }
    pasEnLigne.push({ achat: a, tx, recu: rec ? rec.ms : null, attente: rec ? Math.max(0, Math.floor((maintenant - rec.ms) / J)) : null, articles: arts, relie: arts.length > 0 });
  }
  pasEnLigne.sort((x, y) => ((y.recu || 0) - (x.recu || 0)) || (msDe(y.achat.date) || 0) - (msDe(x.achat.date) || 0));
  const mois = [...parMois.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([m, js]) => ({ mois: m, mediane: mediane(js), n: js.length }));
  return { mois, mediane: mediane(tous), n: tous.length, exclus, pasEnLigne: enLigneLu ? pasEnLigne : null, pasSu: enLigneLu ? pasSu : null };
}

// ════════════════════════════════════════════════════════════════════════════
// 3. LES ACHATS EN LOT, RÉPARTIS À SA MAIN
// ════════════════════════════════════════════════════════════════════════════
// Un lot : un titre « Lot … » (forme mesurée le 3 nov.), plusieurs articles dans
// SA transaction (`items_count`), ou un achat qu'il a DÉCLARÉ lot (`vrm_lots_declares`).
export function estLot(achat, { nArticlesTx = null, declares = null } = {}) {
  const tx = txDe(achat);
  if (/^lot\b/i.test(String((achat && achat.title) || '').trim())) return true;
  const n = tx && nArticlesTx ? Number(nArticlesTx[tx]) : NaN;
  if (Number.isFinite(n) && n > 1) return true;
  return !!(tx && declares && declares[tx]);
}
// Le nombre d'articles écrit (titre « Lot 3 … », transaction, déclaration) ou null.
export function nombreLot(achat, { nArticlesTx = null, declares = null } = {}) {
  const tx = txDe(achat);
  const d = tx && declares ? Number(declares[tx]) : NaN; if (Number.isInteger(d) && d > 1) return d;
  const n = tx && nArticlesTx ? Number(nArticlesTx[tx]) : NaN; if (Number.isInteger(n) && n > 1) return n;
  const m = /^lot\s+(?:de\s+)?(\d{1,3})\b/i.exec(String((achat && achat.title) || '').trim());
  return m && Number(m[1]) > 1 ? Number(m[1]) : null;
}
// Le total à répartir : l'article seul (le prix de la commande) ou le montant
// PAYÉ (port et frais inclus), seulement si le reçu tombe juste au centime.
export function totalARepartir(achat, inclus = 'article', ventilation = null) {
  if (inclus === 'paye') {
    const v = ventilation;
    return v && v.trouve && v.somme === 'juste' && Number.isSafeInteger(v.paye) && v.paye > 0 ? v.paye : null;
  }
  return prixAchatCentimes(achat);
}
// Une PROPOSITION de parts égales au centime (le reste aux premières) — jamais écrite seule.
export function partsEgales(total, n) {
  if (!Number.isSafeInteger(total) || total < 0 || !Number.isInteger(n) || n < 1) return [];
  const base = Math.floor(total / n), reste = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < reste ? 1 : 0));
}
// L'état de la feuille : chaque saisie lue, la somme, ce qui reste (total − somme).
// `juste` seulement si toutes les cases sont lisibles (≥ 0) et que la somme tombe
// au centime sur le total.
export function etatRepartition(total, saisies) {
  const parts = (saisies || []).map((s) => { const c = centimesDe(s); return c != null && c >= 0 ? c : null; });
  const illisibles = parts.filter((c) => c == null).length;
  const somme = parts.reduce((t, c) => t + (c || 0), 0);
  const reste = Number.isSafeInteger(total) ? total - somme : null;
  const juste = Number.isSafeInteger(total) && parts.length > 0 && illisibles === 0 && reste === 0;
  return { parts, somme, reste, illisibles, juste };
}
const texteEur = (c) => (c / 100).toFixed(2).replace('.', ',');
// LES ÉCRITURES — seulement sur SON clic (`confirme === true`) et si la somme est
// juste. Une écriture par article : son prix d'achat = SA part ; le lien vers
// l'achat est gardé. Le journal garde l'état d'AVANT (pour « Annuler »).
//   articles : [{ cle, numero, entree }] (entree = l'état actuel de la fiche / correction)
export function ecrituresRepartition({ achat, articles = [], saisies = [], inclus = 'article', ventilation = null, confirme = false, at = '', accNom = '', photo = '' } = {}) {
  if (confirme !== true) return null;
  const tx = txDe(achat); if (!tx || !articles.length || articles.length !== saisies.length) return null;
  const total = totalARepartir(achat, inclus, ventilation);
  const e = etatRepartition(total, saisies);
  if (!e.juste) return null;
  const ecritures = [], avant = {}, parts = {};
  articles.forEach((a, i) => {
    const x = a.entree || {};
    avant[a.cle] = { buyPrice: x.buyPrice != null ? x.buyPrice : '', buyFromId: x.buyFromId != null ? x.buyFromId : null, buyFrom: x.buyFrom != null ? x.buyFrom : null };
    parts[a.cle] = e.parts[i];
    ecritures.push({ cle: a.cle, patch: {
      buyPrice: texteEur(e.parts[i]),
      buyFromId: tx,
      buyFrom: { ...(x.buyFrom && typeof x.buyFrom === 'object' ? x.buyFrom : {}), title: achat.title || '', date: achat.date || '', photo: photo || (x.buyFrom && x.buyFrom.photo) || '',
        price: e.parts[i] / 100, devise: 'EUR', status: achat.status || '', account: accNom || (x.buyFrom && x.buyFrom.account) || '',
        lot: true, prixLot: total / 100, inclus, repartiLe: at },
    } });
  });
  return { ecritures, journal: { tx, at, total, inclus, parts, avant } };
}
// « Annuler » : rend l'état d'avant de chaque article du journal.
export function annulationRepartition(journal) {
  if (!journal || !journal.avant || typeof journal.avant !== 'object') return [];
  return Object.entries(journal.avant).map(([cle, x]) => ({ cle, patch: { buyPrice: x && x.buyPrice != null ? x.buyPrice : '', buyFromId: x ? x.buyFromId : null, buyFrom: x ? x.buyFrom : null } }));
}

// ── RELIER depuis un achat (son clic sur un N°) ────────────────────────────
// L'écriture : le lien (n° de transaction + instantané). Le prix n'est posé
// que pour un achat SIMPLE dont la fiche n'a pas déjà un prix saisi par lui
// (`montant` : la proposition de src/prixAchatPropose.js, reçu juste sinon
// l'article seul) ; un LOT ne reçoit jamais le prix du lot (« Répartir »).
export function ecritureLienAchat(entree, achat, { lot = false, montant = null, accNom = '', photo = '' } = {}) {
  const tx = txDe(achat); if (!tx) return null;
  const x = entree || {};
  const prixSaisi = x.buyPrice != null && String(x.buyPrice).trim() !== '';
  const patch = { buyFromId: tx, buyFrom: { title: achat.title || '', date: achat.date || '', photo, price: lot ? null : (montant != null ? montant / 100 : null), devise: 'EUR', status: achat.status || '', account: accNom, ...(lot ? { lot: true } : {}) } };
  if (!lot && !prixSaisi && Number.isSafeInteger(montant) && montant > 0) patch.buyPrice = texteEur(montant);
  return patch;
}
