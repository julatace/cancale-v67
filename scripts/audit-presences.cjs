// CONTRÔLE PERMANENT — OÙ EST CHAQUE PAIRE EN LIGNE (logos de plateforme, 15 octobre).
//
// Julien : « on ne sait pas sur quelle plateforme est postée chaque annonce :
// mets un petit logo à côté ». La règle `presencesPaires` (src/App.jsx) décide
// où un logo se pose. Ce contrôle l'EXÉCUTE dans un `vm`, avec ses vraies
// dépendances extraites du fichier, et juge ce qu'elle REND (§6.5) :
//   · Vinted : chaque annonce en ligne, avec son compte ;
//   · Leboncoin : seulement une annonce À LUI, active, pas vendue là-bas, dont
//     une clé (réf VRM, lien posé à la main, « nXXX ») est le N° de la paire —
//     jamais une annonce d'autrui, jamais un titre identique ;
//   · « demandée » (`vinted_lbc_posted`) n'est JAMAIS « en ligne » ;
//   · eBay : seulement par le SKU `VRM-{n°}`, remise à zéro comprise (un vieux
//     « VRM-230 » est la B230, pas la nouvelle 230) ; ni sans SKU, ni épuisée,
//     ni terminée ;
//   · un N° porté par deux fiches ne désigne personne ;
//   · « pas su » (Leboncoin ou eBay illisible) n'invente rien.
//
// `--mutation <nom>` réaffaiblit la règle : le contrôle doit passer au ROUGE.
//   demande  : une publication demandée compte comme en ligne
//   titre    : une annonce Leboncoin d'autrui au même titre est rapprochée
//   ambigu   : un N° porté par deux fiches désigne quand même la paire en ligne
//   statut   : une annonce Leboncoin désactivée compte comme en ligne
//   archive  : le SKU eBay est lu sans la traduction de la remise à zéro
// « La fonction n'existait pas avant » n'est pas une preuve (§6.1).
const fs = require('fs'), vm = require('vm'), path = require('path');
const racine = path.join(__dirname, '..');
let APP = fs.readFileSync(path.join(racine, 'src', 'App.jsx'), 'utf8');
const iM = process.argv.indexOf('--mutation');
const MUT = iM > 0 ? process.argv[iM + 1] : '';

let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${det ? ' — ' + det : ''}`); };
const essaie = (quoi, fn) => { try { return fn(); } catch (e) { dit(false, quoi, String((e && e.message) || e)); return null; } };

if (MUT) {
  const avant = APP;
  const R = {
    demande: ["ajoute(it.id, { p: 'lbc', etat: 'demandee', compte: '', id: '', url: '' });", "ajoute(it.id, { p: 'lbc', etat: 'en_ligne', compte: '', id: '', url: '' });"],
    titre: ["if (!ad || ad.id == null || !annonceLbcALui(ad, prouves)) continue;", "if (!ad || ad.id == null) continue; if (!annonceLbcALui(ad, prouves)) { const t = String(ad.subject || '').toLowerCase().trim(); for (const it of (annonces || [])) if (it && String(it.title || '').toLowerCase().trim() === t) ajoute(it.id, { p: 'lbc', etat: 'en_ligne', compte: '', id: String(ad.id), url: '' }); continue; }"],
    ambigu: ["if (ids.length > 1) { if (ids.some((i) => enLigne.has(i))) ambigus.add(k); return null; }", "if (ids.length > 1) { const e = ids.find((i) => enLigne.has(i)); return e || null; }"],
    statut: ["if (String(ad.status || '').toLowerCase() !== 'active' || vendusLbc.has(String(ad.id))) continue;", "if (vendusLbc.has(String(ad.id))) continue;"],
    archive: ["const n = numEbayLu(a.sku, a.itemId);\n    if (!n) continue;                                  // sans SKU", "const n = numDeSkuEbay(a.sku);\n    if (!n) continue;                                  // sans SKU"],
  }[MUT];
  if (!R) { console.log('mutation inconnue : ' + MUT); process.exit(2); }
  APP = APP.replace(R[0], R[1]);
  dit(APP !== avant, `(--mutation ${MUT}) la règle a bien été réaffaiblie`);
}

function extraire(src, nom) {
  const re = new RegExp(`^(?:async )?function ${nom}\\(|^const ${nom} = `, 'm');
  const m = re.exec(src);
  if (!m) { dit(false, `\`${nom}\` introuvable dans App.jsx`); return ''; }
  let i = m.index, prof = 0, vuCorps = false;
  const estFn = /function/.test(m[0]);
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '(' || c === '[' || c === '{') { prof++; if (c === '{') vuCorps = true; }
    else if (c === ')' || c === ']' || c === '}') {
      prof--;
      if (estFn && vuCorps && prof === 0 && c === '}') return src.slice(m.index, i + 1);
    } else if (!estFn && c === ';' && prof === 0) return src.slice(m.index, i + 1);
  }
  dit(false, `fin de \`${nom}\` introuvable`); return '';
}

const NOMS = ['cleNum', 'NUM_OK', 'refVRMDe', 'marqueurNumerotation', 'archiveNumeros', 'coupureNumerotation', 'traductionAnnonce', 'numeroExterne',
  'numDeSkuEbay', 'numEbayLu', 'lbcAnnulee', 'numDeTitreLbc', 'clesAnnonceLbc', 'comptesLbcProuves', 'annonceLbcALui',
  'PLATEFORMES_PRESENCE', 'presencesPaires', 'presencesAilleurs'];
const src = NOMS.map((n) => extraire(APP, n)).join('\n');
const ctx = { STORE: {} };
vm.createContext(ctx);
essaie('la règle se charge', () => vm.runInContext('const load = (k, d) => (k in STORE ? STORE[k] : d);\n' + src + '\n;this.R = { presencesPaires, presencesAilleurs };', ctx));
const R = ctx.R || {};

// ── Données INVENTÉES, à la forme de sa base (mesurée le 15 octobre) ──────────
const MAINTENANT = Date.parse('2026-10-15T12:00:00Z');
const acc = (u, login) => ({ vinted_user_id: u, login });
const A1 = acc('111', 'compte_a'), A2 = acc('222', 'compte_b');
const ann = (id, a, o) => Object.assign({ id, title: 'Nike Air Max 1 taille 42', url: `https://www.vinted.fr/items/${id}`, _acc: a }, o);
const annonces = [
  ann(1001, A1, { title: 'Salomon XT-6 blanc taille 40' }),      // N°12 : sur Leboncoin par sa RÉFÉRENCE
  ann(1002, A1, { title: 'Adidas Spezial noir taille 38' }),     // N°13 : sur eBay par son SKU
  ann(1003, A2, { title: 'Nike Dunk low panda taille 41' }),     // N°15 : publication Leboncoin seulement DEMANDÉE
  ann(1004, A2, { title: 'Asics Gel-Kayano 14 taille 43' }),     // N°14 : porté AUSSI par une fiche vendue (ambigu)
  ann(1005, A1, { title: 'Puma Suede gris taille 41' }),         // N°16 : annonce Leboncoin DÉSACTIVÉE, eBay épuisée
  ann(1006, A1, { title: 'New Balance 550 blanc taille 42' }),   // N°17 : annonce Leboncoin VENDUE là-bas, eBay terminée
  ann(1007, A2, { title: 'Nike Air Force 1 blanc taille 44' }),  // N°230 (NOUVELLE série) : un vieux SKU eBay « VRM-230 » désigne la B230
  ann(1008, A1, { title: 'Vans Old Skool noir taille 40' }),     // N°18 : un lien posé À LA MAIN sur une annonce Leboncoin
  ann(1009, A1, { title: 'Converse Chuck 70 noir taille 39' }),  // N°19 : rien ailleurs (une annonce d'AUTRUI au même titre)
];
const numeros = {
  1001: { numero: '12' }, 1002: { numero: '13' }, 1003: { numero: '15' }, 1004: { numero: '14' },
  9004: { numero: '14' },                                         // une fiche VENDUE au même N° (héritage)
  1005: { numero: '16' }, 1006: { numero: '17' }, 1007: { numero: '230' }, 9230: { numero: 'B230' }, 1008: { numero: '18' }, 1009: { numero: '19' },
};
const lbcItems = {
  // À lui (lbcUser) : sa référence (la forme captée : « 12 ») ⇒ N°12.
  '5001': { id: 5001, status: 'active', ref: '12', lbcUser: 'u-moi', accountName: 'Moi_LBC', subject: 'Salomon XT-6', url: 'https://www.leboncoin.fr/ad/chaussures/5001', seenAt: '2026-10-14T10:00:00Z' },
  // À lui, DÉSACTIVÉE ⇒ pas en ligne.
  '5002': { id: 5002, status: 'inactive', ref: '16', lbcUser: 'u-moi', accountName: 'Moi_LBC', subject: 'Puma Suede' },
  // À lui, VENDUE sur Leboncoin (vente où il est le vendeur) ⇒ pas en ligne.
  '5003': { id: 5003, status: 'active', ref: '17', lbcUser: 'u-moi', accountName: 'Moi_LBC', subject: 'New Balance 550' },
  // À lui par le COMPTE prouvé (une vente), relié À LA MAIN au N°18.
  '5004': { id: 5004, status: 'active', account: 'acc-lbc-1', accountName: 'Moi_LBC', subject: 'Vans Old Skool', url: 'https://www.leboncoin.fr/ad/chaussures/5004' },
  // D'AUTRUI (aucun signe d'appartenance), MÊME titre que la N°19 et un « n19 » ⇒ rien.
  '5005': { id: 5005, status: 'active', account: 'inconnu-9', accountName: 'Quelqu_un', subject: 'Converse Chuck 70 noir taille 39' },
  '5007': { id: 5007, status: 'active', account: 'inconnu-8', accountName: 'Autre', subject: 'Chuck 70 n19' },
  // L'annonce vendue qui PROUVE le compte acc-lbc-1.
  '5006': { id: 5006, status: 'active', account: 'acc-lbc-1', accountName: 'Moi_LBC', subject: 'déjà vendue' },
};
const lbcVentes = {
  t1: { txId: 't1', itemId: 5006, isSeller: true, stepStatus: 'done' },
  t2: { txId: 't2', itemId: 5003, isSeller: true, stepStatus: 'done' },
};
const ebayItems = [
  { itemId: '7001', sku: 'VRM-13', qty: '1', title: 'Adidas Spezial noir 38', _compte: 'principal', _pseudo: 'moi_ebay' },
  { itemId: '7002', sku: '', qty: '1', title: 'Converse Chuck 70 noir taille 39', _compte: 'principal', _pseudo: 'moi_ebay' },      // sans SKU, même titre que N°19
  { itemId: '7003', sku: 'VRM-16', qty: '0', title: 'Puma Suede', _compte: 'principal', _pseudo: 'moi_ebay' },                     // épuisée
  { itemId: '7004', sku: 'VRM-17', qty: '1', fin: '2026-10-01T00:00:00Z', title: 'NB 550', _compte: 'principal', _pseudo: 'moi_ebay' }, // terminée
  { itemId: '7005', sku: 'VRM-230', qty: '1', title: 'AF1 ancienne', _compte: 'principal', _pseudo: 'moi_ebay' },                  // SKU d'AVANT la coupure
  { itemId: '7006', sku: 'VRM-14', qty: '1', title: 'Asics', _compte: 'cle2', _pseudo: 'second_ebay' },                             // N°14 ambigu
];
ctx.STORE.vrm_numerotation = { version: 2, archive: 'B', coupure: '2026-10-09T00:00:00Z', ebayAnnonces: { 7005: { 230: 'B230' } }, lbcAnnonces: {} };
const nomCompte = (it) => it._acc.login;
const base = { annonces, numeros, nomCompte, maintenant: MAINTENANT,
  lbc: { items: lbcItems, ventes: lbcVentes, liens: { 5004: '18' } },
  ebay: { items: ebayItems, illisibles: [], caps: { principal: '1792011691423' } },
  demandesLbc: new Set(['1003']) };

const res = essaie('la règle rend un résultat', () => R.presencesPaires(base)) || { par: new Map(), idsAmbigus: new Set(), comptes: {} };
const de = (id) => (res.par.get(String(id)) || []);
const enL = (id, p) => de(id).filter((x) => x.p === p && x.etat === 'en_ligne');

dit(annonces.every((a) => enL(a.id, 'vinted').length === 1), 'Vinted : chaque annonce en ligne porte sa présence Vinted');
dit(enL(1003, 'vinted')[0] && enL(1003, 'vinted')[0].compte === 'compte_b', 'Vinted : le compte de l’annonce est nommé', JSON.stringify(enL(1003, 'vinted')));
dit(enL(1001, 'lbc').length === 1 && enL(1001, 'lbc')[0].compte === 'Moi_LBC' && enL(1001, 'lbc')[0].id === '5001', 'Leboncoin : une annonce À LUI dont la référence est 12 ⇒ la N°12 est en ligne là-bas, compte nommé', JSON.stringify(enL(1001, 'lbc')));
dit(enL(1008, 'lbc').length === 1, 'Leboncoin : un lien posé à la main (compte prouvé par une vente) ⇒ en ligne', JSON.stringify(de(1008)));
dit(enL(1009, 'lbc').length === 0, 'Leboncoin : l’annonce d’AUTRUI au même titre (et un « n19 ») ne désigne rien', JSON.stringify(de(1009)));
dit(enL(1005, 'lbc').length === 0, 'Leboncoin : une annonce désactivée n’est pas « en ligne »', JSON.stringify(de(1005)));
dit(enL(1006, 'lbc').length === 0, 'Leboncoin : une annonce vendue là-bas n’est pas « en ligne »', JSON.stringify(de(1006)));
dit(enL(1003, 'lbc').length === 0 && de(1003).some((x) => x.p === 'lbc' && x.etat === 'demandee'), '« demandée » n’est JAMAIS « en ligne » : la N°15 est demandée, sans logo', JSON.stringify(de(1003)));
dit(enL(1002, 'ebay').length === 1 && enL(1002, 'ebay')[0].compte === 'moi_ebay' && /ebay\.fr\/itm\/7001/.test(enL(1002, 'ebay')[0].url), 'eBay : le SKU VRM-13 ⇒ la N°13 est en ligne là-bas, compte et lien', JSON.stringify(enL(1002, 'ebay')));
dit(enL(1009, 'ebay').length === 0, 'eBay : une annonce SANS SKU au même titre ne désigne rien');
dit(enL(1005, 'ebay').length === 0 && enL(1006, 'ebay').length === 0, 'eBay : épuisée (quantité 0) ou terminée ⇒ pas « en ligne »', JSON.stringify([de(1005), de(1006)]));
dit(enL(1007, 'ebay').length === 0, 'eBay : un SKU « VRM-230 » posé AVANT la remise à zéro désigne la B230, pas la nouvelle 230', JSON.stringify(de(1007)));
dit(enL(1004, 'ebay').length === 0 && res.idsAmbigus && res.idsAmbigus.has('1004'), 'un N° porté par deux fiches ne désigne personne, et c’est dit', JSON.stringify(de(1004)));
dit(res.lbc === 'lu' && res.ebay === 'lu', 'les deux sources sont « lues »', `${res.lbc} / ${res.ebay}`);
dit(R.presencesAilleurs && R.presencesAilleurs(res, 1001).map((x) => x.p).join() === 'lbc' && R.presencesAilleurs(res, 1009).length === 0, '« aussi ailleurs » = les présences en ligne hors Vinted');
// Ordre : Vinted, Leboncoin, eBay.
dit(de(1001).map((x) => x.p).join(',') === 'vinted,lbc', 'les plateformes sont rangées Vinted, Leboncoin, eBay', de(1001).map((x) => x.p).join(','));

// ── « Pas su » ─────────────────────────────────────────────────────────────────
const passu = essaie('pas su : la règle rend un résultat', () => R.presencesPaires({ ...base, lbc: null, ebay: null })) || { par: new Map() };
const deP = (id) => (passu.par.get(String(id)) || []);
dit(passu.lbc === 'passu' && passu.ebay === 'passu', 'Leboncoin et eBay illisibles ⇒ « pas su », pas « lu »', `${passu.lbc} / ${passu.ebay}`);
dit(annonces.every((a) => !deP(a.id).some((x) => x.etat === 'en_ligne' && x.p !== 'vinted')), 'pas su : aucun logo Leboncoin ou eBay inventé');
dit(deP(1003).some((x) => x.etat === 'demandee'), 'pas su : la publication demandée reste dite « demandée »');
const encours = essaie('en cours : la règle rend un résultat', () => R.presencesPaires({ ...base, lbc: undefined, ebay: undefined })) || {};
dit(encours.lbc === 'encours' && encours.ebay === 'encours', 'pas encore lu ⇒ « en cours », ni lu ni pas su', `${encours.lbc} / ${encours.ebay}`);

// ── Plusieurs comptes eBay : le compte se nomme ─────────────────────────────────
const deux = essaie('deux comptes eBay', () => R.presencesPaires({ ...base, numeros: { ...numeros, 9004: { numero: 'B14' } } })) || { comptes: {} };
dit(deux.comptes && deux.comptes.ebay === 2, 'deux comptes eBay portent ses annonces ⇒ le rendu peut les nommer', JSON.stringify(deux.comptes));

console.log(ko ? `\n❌ Présences : ${ko} rouge(s)` : '\n✅ Présences : tout est vert');
process.exit(ko ? 1 : 0);
