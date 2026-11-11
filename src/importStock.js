// ═══════════════════════════════════════════════════════════════════════════
// IMPORTER SON STOCK ET SES VENTES PASSÉES (11 nov., lot « import-autre-outil »)
// docs/passation/2026-11-11-import-autre-outil.md
// ═══════════════════════════════════════════════════════════════════════════
// Un vendeur arrive d'un tableur ou d'un autre logiciel : Paramètres → Importer.
// Le fichier est lu DANS LE NAVIGATEUR (la lecture CSV/XLSX de l'import des
// achats, src/importAchats.js) ; colonnes reconnues, réglables d'un geste ;
// APERÇU ligne par ligne ; RIEN n'est écrit avant « Importer N lignes ».
// Règles (CLAUDE.md §2.3, §2.4, §2.5, §5) :
//   · STOCK : le N° est l'identité (il est écrit sur un carton). Un N° qui existe
//     déjà dans VRM (fiche, pool des N° servis, N° réservé, stock déjà importé)
//     ou deux fois dans le fichier ⇒ CONFLIT montré, jamais écrasé, jamais
//     renuméroté. Un N° « 230 » écrit avant la remise à zéro suit la règle de
//     l'app (`numeroDe`, `numeroExterne` par la date de la ligne) ; pas su ⇒ rien ;
//   · le PRIX D'ACHAT est celui du fichier (sa saisie) : jamais deviné ; un
//     montant illisible ⇒ VIDE et dit sur la ligne (la ligne reste) ; une colonne
//     « Prix » seule n'est pas lue comme prix d'achat (ce peut être son prix de
//     vente) : il la choisit lui-même ;
//   · VENTES PASSÉES : marquées « importées » (`source: 'importe'`), datées comme
//     dans le fichier (date illisible ⇒ la ligne est écartée, jamais
//     « aujourd'hui ») ; le CA DÉCLARÉ reste daté au VERSEMENT : sans date de
//     versement, la vente est « à dater », dans AUCUN mois ;
//   · DOUBLONS des ventes : par RÉFÉRENCE seulement (n° de commande) — déjà lue
//     par VRM, déjà importée, ou deux fois dans le fichier. Une vente d'une
//     plateforme que VRM lit lui-même (Vinted, Leboncoin, eBay, Vestiaire) SANS
//     n° de commande est « à vérifier » : un doublon ne s'y verrait pas, elle
//     n'entre que s'il coche la case ;
//   · un import ne relie JAMAIS une ligne à une annonce par le titre : il peut
//     PROPOSER (`propositionAnnonce`, même marque, un mot de modèle commun),
//     c'est SON clic qui relie ;
//   · ANNULER un import retire tout ce qu'il a créé et rien d'autre (un coût
//     posé n'est retiré que s'il n'a pas changé depuis) ; les N° restent
//     réservés (le pool est append-only : un N° ne se redonne jamais).
// Module PUR : exécuté par scripts/audit-import-autre-outil.cjs.
// ═══════════════════════════════════════════════════════════════════════════
import { dateDuFichier, prixDuFichier, LIGNES_MAX } from './importAchats.js';

export { LIGNES_MAX };
// La référence d'une vente comparée : majuscules, lettres et chiffres seulement, 3 au moins
// (« LBC-77 » = « lbc 77 »). Jamais un titre, un prix ou une date.
export const refVente = (v) => { const s = String(v == null ? '' : v).toUpperCase().normalize('NFKD').replace(/[^0-9A-Z]/g, ''); return s.length >= 3 && s.length <= 40 ? s : ''; };
export const SOURCE_IMPORT = 'importe';
export const CLE_STOCK_IMPORTE = 'vrm_stock_importe';
export const CLE_VENTES_IMPORTEES = 'vrm_ventes_importees';
export const CLE_IMPORTS = 'vrm_imports';
export const TRANCHE = 250;   // lignes par passage (l'écran respire entre deux)

export const CHAMPS_STOCK = ['numero', 'titre', 'prix', 'date', 'emplacement', 'notes'];
export const CHAMPS_VENTES = ['date', 'titre', 'prix', 'plateforme', 'versement', 'ref', 'numero'];
export const OBLIGATOIRES = { stock: ['numero'], ventes: ['date', 'prix'] };
export const NOMS = {
  stock: { numero: 'N°', titre: 'Description', prix: "Prix d'achat", date: "Date d'achat", emplacement: 'Emplacement', notes: 'Notes', '': 'Ignorer' },
  ventes: { date: 'Date de vente', titre: 'Description', prix: 'Prix de vente', plateforme: 'Plateforme', versement: 'Date de versement', ref: 'N° de commande', numero: 'N°', '': 'Ignorer' },
};
export const champsDe = (mode) => (mode === 'ventes' ? CHAMPS_VENTES : CHAMPS_STOCK);

// ── Les colonnes ──────────────────────────────────────────────────────────────
const net = (s) => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[°º]/g, '').replace(/#/g, ' n ').replace(/[^a-z0-9]+/g, ' ').trim();
// L'ORDRE COMPTE : le premier motif qui dit le nom gagne.
const NUMERO = /^(n|no|nr|num|numero|number|n vrm|numero vrm|n rangement|numero de rangement|n de rangement|n carton|carton|n etiquette|numero d etiquette|etiquette|tag|sku|n sku|item number|stock number|n stock|n article|numero article)$/;
const MOTS = {
  stock: [
    ['numero', NUMERO],
    ['prix', /^(prix d achat|prix achat|prix paye|cout|cout d achat|cout achat|achat|achete|paye|purchase price|buy price|cost|cost price|unit cost|prix de revient)$/],
    ['date', /^(date|date d achat|date achat|achete le|date de l achat|date d entree|entree|date d ajout|ajoute le|purchase date|bought|bought on|date added|added)$/],
    ['date', /\bdate\b/],
    ['prix', /\b(prix d achat|cout|purchase|cost)\b/],
    ['emplacement', /^(emplacement|rangement|place|localisation|location|lieu|etagere|bac|rayon|zone|bin|shelf|box|boite|stockage|ou)$/],
    ['emplacement', /\b(emplacement|localisation|etagere|location|shelf)\b/],
    ['notes', /^(notes?|remarques?|commentaires?|comments?|observations?|infos?|details?|memo)$/],
    ['titre', /^(description|article|titre|title|designation|produit|product|modele|model|nom|name|libelle|objet|paire|item)$/],
    ['titre', /\b(description|article|titre|designation|produit|modele|title|product)\b/],
  ],
  ventes: [
    ['ref', /^(ref|reference|n commande|no commande|num commande|numero commande|numero de commande|n de commande|commande|order|order id|order number|n transaction|transaction|numero de transaction|id transaction|transaction id|n facture|facture|invoice)$/],
    ['ref', /\b(commande|order|transaction|facture|invoice)\b/],
    ['numero', NUMERO],
    ['versement', /^(date de versement|versement|verse le|date versement|date de paiement|paiement|paye le|payout|payout date|paid on|date d encaissement|encaissement|virement|date du virement)$/],
    ['versement', /\b(versement|verse|payout|paiement|encaissement|virement)\b/],
    ['date', /^(date|date de vente|date vente|vendu le|vente le|sold|sold on|sold date|sale date|date sold|date de la vente)$/],
    ['date', /\bdate\b/],
    ['prix', /^(prix|prix de vente|prix vente|vendu|montant|total|price|sale price|sold price|amount|ca|recette|chiffre d affaires|net|montant recu|recu)$/],
    ['prix', /\b(prix|montant|price|amount|total)\b/],
    ['plateforme', /^(plateforme|platform|site|canal|channel|marketplace|market|ou|vendu sur|source|marche)$/],
    ['titre', /^(description|article|titre|title|designation|produit|product|modele|model|nom|name|libelle|objet|paire|item)$/],
    ['titre', /\b(description|article|titre|designation|produit|modele|title|product)\b/],
  ],
};
export function champDeColonne(mode, entete) {
  const n = net(entete);
  if (!n) return '';
  for (const [champ, re] of MOTS[mode === 'ventes' ? 'ventes' : 'stock']) if (re.test(n)) return champ;
  return '';
}
export function reconnaitreColonnes(mode, entetes) {
  const pris = new Set();
  return (Array.isArray(entetes) ? entetes : []).map((e) => {
    const c = champDeColonne(mode, e);
    if (!c || pris.has(c)) return '';
    pris.add(c);
    return c;
  });
}
export const colonnesManquantes = (mode, colonnes) => (OBLIGATOIRES[mode === 'ventes' ? 'ventes' : 'stock']).filter((c) => !(colonnes || []).includes(c));
// Un geste : choisir un champ pour une colonne le retire de celle qui l'avait.
export const changerColonne = (colonnes, i, champ) => (colonnes || []).map((c, k) => (k === i ? champ : (champ && c === champ ? '' : c)));

// ── Les valeurs ───────────────────────────────────────────────────────────────
const texte = (v, max) => String(v == null ? '' : v).replace(/[\p{Cc}\p{Cf}]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, max).trim();
export function plateformeDe(v) {
  const n = net(v);
  if (!n) return '';
  if (/\bvinted\b/.test(n)) return 'Vinted';
  if (/\b(leboncoin|le bon coin|lbc|bon coin)\b/.test(n)) return 'Leboncoin';
  if (/\bebay\b/.test(n)) return 'eBay';
  if (/\bvestiaire\b/.test(n)) return 'Vestiaire';
  return 'Autre';
}
// Les plateformes que VRM lit lui-même : sans n° de commande, un doublon ne se verrait pas.
export const PLATEFORMES_LUES = ['Vinted', 'Leboncoin', 'eBay', 'Vestiaire'];
// L'identité d'une vente lue par VRM (celle de `ventesDeclarables`/`ventesFaites`).
export const PREFIXES = { Vinted: 'vinted:', Leboncoin: 'lbc:', eBay: 'ebay:', Vestiaire: 'vestiaire:' };
export const idLu = (plateforme, ref) => {
  const p = PREFIXES[plateforme]; const r = String(ref == null ? '' : ref).trim();
  return p && r ? p + r : '';
};
// « 12,50 » ⇒ 12.5 ; '' ou illisible ⇒ null.
export const eurDe = (p) => { const s = String(p == null ? '' : p).trim(); if (!s) return null; const n = Number(s.replace(/\s/g, '').replace(',', '.')); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null; };

// ── L'aperçu, par tranches ────────────────────────────────────────────────────
// `creerApercu(mode, opts)` ⇒ { tranche(debut, fin) ⇒ lignes }. Les ensembles
// (N° vus, références vues) vivent dans la fermeture : l'aperçu se calcule
// TRANCHE par tranche (l'écran respire entre deux), dans l'ordre du fichier.
// opts (stock) : numeroDe(brut, dateMs) ⇒ N° traduit | '' (pas un N°) | null (pas su) ;
//                numeroPris(n°) ⇒ '' (libre) ou la raison (« déjà dans VRM ») ;
//                archive : la lettre de l'archive ('' sans archive).
// opts (ventes) : refsLues : Set des identités lues (`idLu`) ;
//                 refsImportees : Set des `refVente` déjà importées ;
//                 avecSansRef : il a coché « importer aussi celles sans n° ».
// Chaque ligne : { n, etat: 'ok'|'conflit'|'double'|'averifier'|'ecartee', raison, notes:[], rec }.
export function creerApercu(mode, { rows, colonnes, numeroDe = null, numeroPris = null, archive = '', refsLues = null, refsImportees = null, avecSansRef = false } = {}) {
  const corps = (Array.isArray(rows) ? rows : []).slice(1, LIGNES_MAX + 1);
  const col = (champ) => (colonnes || []).indexOf(champ);
  const I = {}; for (const c of champsDe(mode)) I[c] = col(c);
  const numsFichier = new Set(), refsFichier = new Set();
  const val = (r, c) => (I[c] >= 0 ? r[I[c]] : '');
  const ligneStock = (r, k) => {
    const L = { n: k + 2, etat: 'ok', raison: '', notes: [], rec: null };
    const brut = texte(val(r, 'numero'), 16);
    const titre = texte(val(r, 'titre'), 80);
    const apercu = titre || (brut ? 'N° ' + brut : '');
    if (!brut) return { ...L, etat: 'ecartee', raison: 'N° vide', apercu };
    const dBrut = val(r, 'date');
    const date = I.date >= 0 && String(dBrut == null ? '' : dBrut).trim() !== '' ? dateDuFichier(dBrut) : '';
    if (I.date >= 0 && String(dBrut == null ? '' : dBrut).trim() !== '' && !date) L.notes.push('date illisible : laissée vide');
    const ms = date ? Date.parse(date + 'T12:00:00') : null;
    const numero = numeroDe ? numeroDe(brut, ms) : brut;
    if (numero == null) return { ...L, etat: 'ecartee', raison: 'N° pas su : sans date, VRM ne sait pas s’il est d’avant ou d’après la remise à zéro', apercu };
    if (!numero) return { ...L, etat: 'ecartee', raison: 'Pas un N° (des chiffres, ou une à trois lettres puis des chiffres)', apercu };
    const num = String(numero);
    const k2 = num.toUpperCase();
    const lettreBrute = /^[A-Z]/.test(brut.trim().toUpperCase());
    if (archive && lettreBrute && new RegExp('^' + archive + '\\d').test(k2)) {
      const p0 = numeroPris ? numeroPris(num) : '';
      return { ...L, etat: p0 ? 'conflit' : 'ecartee', raison: p0 ? `N°${num} ${p0} — rien n’est changé` : `« ${archive} » est l’archive de tes anciens N° : VRM n’en crée pas de nouveaux`, apercu, numero: num };
    }
    if (numsFichier.has(k2)) return { ...L, etat: 'conflit', raison: `N°${num} deux fois dans le fichier`, apercu, numero: num };
    numsFichier.add(k2);
    const pris = numeroPris ? numeroPris(num) : '';
    if (pris) return { ...L, etat: 'conflit', raison: `N°${num} ${pris} — rien n’est changé`, apercu, numero: num };
    if (archive && new RegExp('^' + archive + '\\d').test(k2) && !lettreBrute) L.notes.push(`écrit « ${brut} » avant la remise à zéro`);
    const pBrut = val(r, 'prix');
    const p = I.prix >= 0 ? prixDuFichier(pBrut) : { ok: true, prix: '' };
    if (!p.ok) L.notes.push('prix illisible : laissé vide');
    const rec = { numero: num, titre, prix: p.ok ? p.prix : '', date, emplacement: texte(val(r, 'emplacement'), 60), notes: texte(val(r, 'notes'), 200) };
    return { ...L, rec, numero: num };
  };
  const ligneVente = (r, k) => {
    const L = { n: k + 2, etat: 'ok', raison: '', notes: [], rec: null };
    const titre = texte(val(r, 'titre'), 80);
    const date = dateDuFichier(val(r, 'date'));
    const pBrut = val(r, 'prix');
    const p = prixDuFichier(pBrut);
    const site = texte(val(r, 'plateforme'), 30);
    const plateforme = plateformeDe(site);
    const refBrute = texte(val(r, 'ref'), 40);
    const ref = refVente(refBrute);
    const apercu = titre || refBrute || '';
    if (!titre && !refBrute && (p.ok && !p.prix)) return { ...L, etat: 'ecartee', raison: 'Ligne vide', apercu };
    if (!date) return { ...L, etat: 'ecartee', raison: 'Date de vente illisible', apercu };
    if (!p.ok) L.notes.push('montant illisible : laissé vide (hors des totaux)');
    else if (!p.prix) L.notes.push('montant vide : hors des totaux');
    const vBrut = val(r, 'versement');
    const versement = I.versement >= 0 && String(vBrut == null ? '' : vBrut).trim() !== '' ? dateDuFichier(vBrut) : '';
    if (I.versement >= 0 && String(vBrut == null ? '' : vBrut).trim() !== '' && !versement) L.notes.push('date de versement illisible : à dater');
    else if (!versement) L.notes.push('sans date de versement : à dater, dans aucun mois');
    const idl = idLu(plateforme, refBrute);
    if (idl && refsLues && refsLues.has(idl)) return { ...L, etat: 'double', raison: `Déjà lue par VRM sur ${plateforme} (même n° de commande)`, apercu };
    if (ref && refsImportees && refsImportees.has(plateforme + '|' + ref)) return { ...L, etat: 'double', raison: 'Déjà importée (même n° de commande)', apercu };
    if (ref && refsFichier.has(plateforme + '|' + ref)) return { ...L, etat: 'double', raison: 'Deux fois dans le fichier (même n° de commande)', apercu };
    if (ref) refsFichier.add(plateforme + '|' + ref);
    const rec = { date, titre, prix: p.ok ? p.prix : '', plateforme, site, versement, ref: refBrute, numero: texte(val(r, 'numero'), 16) };
    if (!ref && PLATEFORMES_LUES.includes(plateforme) && !avecSansRef) return { ...L, etat: 'averifier', raison: `${plateforme} sans n° de commande : VRM lit déjà tes ventes ${plateforme}, un doublon ne s’y verrait pas`, apercu, rec };
    return { ...L, rec, sansRef: !ref };
  };
  const f = mode === 'ventes' ? ligneVente : ligneStock;
  return {
    total: corps.length,
    tranche: (debut, fin) => { const out = []; for (let k = debut; k < Math.min(fin, corps.length); k++) out.push(f(corps[k] || [], k)); return out; },
  };
}
// Tout d'un coup (l'audit, et les petits fichiers).
export function apercu(mode, opts) { const a = creerApercu(mode, opts); return a.tranche(0, a.total); }
// Par tranches, l'écran rendu entre deux (`attendre` : une promesse qui rend la main).
export async function apercuParTranches(mode, opts, { attendre = () => new Promise((r) => setTimeout(r, 0)), surAvance = null, annule = () => false } = {}) {
  const a = creerApercu(mode, opts); const out = [];
  for (let d = 0; d < a.total; d += TRANCHE) {
    if (annule()) return null;
    out.push(...a.tranche(d, d + TRANCHE));
    if (surAvance) surAvance(Math.min(a.total, d + TRANCHE), a.total);
    if (d + TRANCHE < a.total) await attendre();
  }
  return out;
}
export function resume(lignes) {
  const L = Array.isArray(lignes) ? lignes : [];
  const c = (e) => L.filter((l) => l.etat === e).length;
  const ok = L.filter((l) => l.etat === 'ok');
  return {
    total: L.length, ok: ok.length, conflits: c('conflit'), doubles: c('double'), averifier: c('averifier'), ecartees: c('ecartee'),
    avecNote: ok.filter((l) => l.notes && l.notes.length).length,
    aDater: ok.filter((l) => l.rec && 'versement' in l.rec && !l.rec.versement).length,
    sansPrix: ok.filter((l) => l.rec && !l.rec.prix).length,
  };
}

// ── Ce qui part sur « Importer N lignes » ─────────────────────────────────────
// stock : { items, couts, numeros } — `couts` seulement pour un N° sans aucun
// coût (`coutExiste(n°)` relu au moment d'écrire) ; ventes : { items }.
// `journal` : la ligne de `vrm_imports` (ce que « Annuler » retirera).
export function ecritures(mode, lignes, { nouvelId, importId, nom = '', maintenant = new Date().toISOString(), coutExiste = () => false } = {}) {
  const items = [], couts = {}, numeros = [];
  for (const l of Array.isArray(lignes) ? lignes : []) {
    if (!l || l.etat !== 'ok' || !l.rec) continue;
    const rec = { id: nouvelId(), importId, source: SOURCE_IMPORT, createdAt: maintenant };
    for (const [k, v] of Object.entries(l.rec)) if (v !== '' && v != null) rec[k] = v;
    items.push(rec);
    if (mode !== 'ventes') {
      numeros.push(rec.numero);
      if (rec.prix && !coutExiste(rec.numero) && !(rec.numero in couts)) couts[rec.numero] = rec.prix;
    }
  }
  const journal = { id: importId, at: maintenant, type: mode === 'ventes' ? 'ventes' : 'stock', nom: texte(nom, 80), n: items.length, ids: items.map((x) => x.id), couts, numeros };
  return { items, couts, numeros, journal };
}

// ── Annuler un import : tout ce qu'il a créé, rien d'autre ────────────────────
// Rend les nouvelles valeurs des clés touchées. Un coût posé par l'import n'est
// retiré que s'il vaut ENCORE ce que l'import a posé (une correction de sa main
// reste). Les N° restent dans le pool (append-only, jamais redonnés).
export function annulerImport(imp, { stock = [], ventes = [], couts = {}, imports = [] } = {}) {
  if (!imp || !imp.id) return null;
  const ids = new Set(Array.isArray(imp.ids) ? imp.ids : []);
  const garde = (x) => !(x && (x.importId === imp.id || ids.has(x.id)));
  const nCouts = { ...(couts || {}) };
  let coutsRetires = 0;
  for (const [n, p] of Object.entries(imp.couts || {})) if (nCouts[n] === p) { delete nCouts[n]; coutsRetires++; }
  const s = (Array.isArray(stock) ? stock : []).filter(garde), v = (Array.isArray(ventes) ? ventes : []).filter(garde);
  return {
    stock: s, ventes: v, couts: nCouts, coutsRetires,
    imports: (Array.isArray(imports) ? imports : []).filter((x) => x && x.id !== imp.id),
    retires: (Array.isArray(stock) ? stock.length : 0) - s.length + (Array.isArray(ventes) ? ventes.length : 0) - v.length,
  };
}

// ── Proposer une annonce (jamais relier) ──────────────────────────────────────
// La ressemblance PROPOSE ; c'est son clic qui relie (§5). Une annonce n'est
// proposée que si elle n'a pas de N°, que la marque est la même quand les deux
// la disent, et qu'au moins un mot de MODÈLE est commun (pas une taille, une
// couleur, un mot vide). `marqueDe(titre)` ⇒ marque | ''.
const VIDES = new Set(['les', 'des', 'une', 'pour', 'avec', 'sans', 'sur', 'dans', 'neuf', 'neuve', 'neufs', 'tres', 'bon', 'bonne', 'etat', 'taille', 'pointure', 'paire', 'homme', 'femme', 'enfant', 'mixte', 'noir', 'noire', 'blanc', 'blanche', 'gris', 'grise', 'rouge', 'bleu', 'bleue', 'vert', 'verte', 'rose', 'beige', 'marron', 'jaune', 'orange', 'violet', 'black', 'white', 'grey', 'red', 'blue', 'green', 'pink', 'and', 'the', 'new', 'size', 'eur', 'taille', 'vintage', 'lot']);
export const motsModele = (t) => new Set(net(t).split(' ').filter((m) => m.length >= 3 && !VIDES.has(m) && !/^\d{1,2}([.,]5)?$/.test(m)));
export function propositionAnnonce(item, annonces, { marqueDe = () => '', dejaProposees = null } = {}) {
  if (!item || !item.titre) return null;
  const mi = motsModele(item.titre); if (!mi.size) return null;
  const bi = String(marqueDe(item.titre) || '').toLowerCase();
  let best = null, score = 0;
  for (const a of Array.isArray(annonces) ? annonces : []) {
    if (!a || !a.id || a.numero || (dejaProposees && dejaProposees.has(String(a.id)))) continue;
    const ba = String(marqueDe(a.titre) || '').toLowerCase();
    if (bi && ba && bi !== ba) continue;
    const ma = motsModele(a.titre);
    let commun = 0; for (const m of mi) if (ma.has(m) && m !== bi) commun++;
    if (!commun) continue;
    if (commun > score) { score = commun; best = a; }
  }
  return best ? { annonce: best, mots: score } : null;
}
