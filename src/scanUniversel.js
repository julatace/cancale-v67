// ════════════════════════════════════════════════════════════════════════════
//  LE SCANNER UNIVERSEL — LA RÈGLE DE RECONNAISSANCE (24 nov., lot scanner-universel)
//  Julien : « UN bouton scanner. Je vise n'importe quoi (un bordereau, un n° de suivi, le QR d'un retrait,
//  l'étiquette N° d'un carton) et VRM ouvre directement la bonne chose : la vente, le colis, l'achat, la paire. »
//
//  Module PUR (aucun React, aucune lecture) : l'écran (src/ScannerRetrouver.jsx) et l'audit
//  (scripts/audit-scanner-universel.cjs) appellent la MÊME fonction.
//
//  ⚠️ §5 « L'identité d'une paire » : rien que des IDENTITÉS EXACTES, jamais une ressemblance, jamais un titre,
//  jamais un début de n°. « Mieux vaut un blanc qu'un faux. » Les identités, dans l'ordre :
//    1. un N° DE SUIVI (toutes les formes déjà connues : `lireCodeColis`, src/scanColis.js) ⇒ le colis, la vente,
//       l'achat ou le retour qui porte CE n° (`retrouverParSuivi`, égalité exacte) ;
//    2. un N° DE TRANSACTION (9 à 13 chiffres) ⇒ la vente `v:{tx}` ou l'achat `a:{tx}` de CE n° (égalité de clé) ;
//    3. un CODE DE RETRAIT (4 caractères au moins) ⇒ le colis à retirer qui porte CE code (égalité exacte) ;
//    4. un N° VRM (« 124 », « B125 », « N°124 », SKU « VRM-124 ») ⇒ LA PAIRE de ce N° (`cleNum` : « 007 » = « 7 »,
//       « b125 » = « B125 », jamais « 12 » pour « 128 »). ⚠️ Remise à zéro du 11 oct. (migration 013) : une étiquette
//       ne dit pas QUAND elle a été écrite — un « 230 » de carton peut être l'ancienne paire (B230) ou la nouvelle
//       (230). Les DEUX sont proposées si les deux existent (son toucher choisit), jamais l'une devinée. « B230 »
//       ne désigne que B230. Un N° qu'aucune paire ne porte ne se crée pas : « inconnu ».
//    5. un EAN / UPC (la boîte de la chaussure) n'est PAS une identité : 50 paires du même modèle portent le même.
//       Il n'ouvre JAMAIS rien — « Chercher » seulement.
//  Toutes les identités trouvées sont RÉUNIES (une même fiche une fois, dans l'ordre ci-dessus) : une ⇒ elle
//  s'ouvre ; deux ou plus ⇒ la liste, il choisit ; aucune ⇒ « inconnu » avec le texte lu et « Chercher ».
// ════════════════════════════════════════════════════════════════════════════
import { lireCodeColis, retrouverParSuivi, normaliserN } from './scanColis.js';

const str = (v) => (v == null ? '' : String(v)).trim();
const arr = (a) => (Array.isArray(a) ? a : []);

// La clé d'un N° quand l'appelant n'en donne pas (la même que `cleNum` de l'app : majuscules, sans espace ni tiret,
// « 007 » = « 7 »). L'app passe TOUJOURS la sienne (`regles.cleNum`) : celle-ci ne sert qu'au repli.
export const cleNumDefaut = (v) => {
  let s = String(v == null ? '' : v).trim().toUpperCase().replace(/[\s\-_.]/g, '');
  if (/^\d+$/.test(s)) s = String(parseInt(s, 10));
  return s;
};
const NUM_OK = /^([A-Z]{1,3})?\d{1,6}$/;

// ── 5. EAN-13 / UPC-A / EAN-8 : la clé GS1 (somme pondérée 3-1 depuis la droite) ─────────────────────────────
export function cleGs1Valide(s) {
  const t = String(s || '');
  if (!/^\d+$/.test(t) || (t.length !== 8 && t.length !== 12 && t.length !== 13)) return false;
  let somme = 0;
  for (let i = t.length - 2, p = 3; i >= 0; i--, p = p === 3 ? 1 : 3) somme += Number(t[i]) * p;
  return (10 - (somme % 10)) % 10 === Number(t[t.length - 1]);
}
// Un code de BOÎTE : 13 chiffres (EAN-13) ou 12 (UPC-A), clé GS1 juste. (EAN-8 : 8 chiffres = aussi la forme d'un n°
// Mondial Relay ; il n'est pas lu par le lecteur — `FORMATS`, src/ScannerColis.jsx — et un n° de suivi passe d'abord.)
export const estEanBoite = (brut) => { const n = normaliserN(brut); return (n.length === 13 || n.length === 12) && /^\d+$/.test(n) && cleGs1Valide(n); };

// ── 4. Le N° VRM lu sur une étiquette ─────────────────────────────────────────────────────────────────────────
// Rend { cles: [clé…], forme: 'sku' | 'numero' } ou null. Formes acceptées (le texte ENTIER, rien d'autre autour) :
// « VRM-124 », « VRM 124 », « VRM124 » (le SKU eBay / la référence Leboncoin) ; « N°124 », « n° 124 », « #124 » ; « 124 »,
// « B125 ». Un texte qui CONTIENT un N° (« 124 Nike ») n'est pas un N°. `archive` : la lettre de la remise à zéro
// (migration 013, « B ») — un N° en chiffres seuls peut alors être l'ancien : les deux clés sont rendues.
export function lireNumeroScan(brut, { cleNum = cleNumDefaut, archive = '' } = {}) {
  const t = str(brut);
  if (!t || t.length > 24) return null;
  let m = /^VRM[\s-]?((?:[A-Za-z]{1,3})?\d{1,6})$/i.exec(t);
  let forme = 'sku';
  if (!m) { m = /^(?:n\s*[°º]|no\.?\s+|#)?\s*((?:[A-Za-z]{1,3}[\s-]?)?\d{1,6})$/i.exec(t); forme = 'numero'; }
  if (!m) return null;
  const k = cleNum(m[1]);
  if (!k || !NUM_OK.test(k) || /^0+$/.test(k)) return null;
  const a = /^[A-Z]{1,3}$/.test(str(archive).toUpperCase()) ? str(archive).toUpperCase() : '';
  const cles = [k];
  if (a && /^\d+$/.test(k)) cles.push(cleNum(a + k));
  return { cles, forme };
}

// ── LA RECONNAISSANCE ──────────────────────────────────────────────────────────────────────────────────────────
// `enregistrements` : ceux des sources du scanner (src/retrouverColis.js) — { sorte: 'vente'|'achat'|'retour'|
// 'colis'|'paire', cle, suivis, code, num, titre… }. Les paires : `sorte: 'paire'`, `cle: 'n:{cléNum}'`.
// `regles` : { cleNum, archive } (de l'app). `camera` : la lecture vient de la caméra (pas tapée).
// Rend { etat: 'un' | 'plusieurs' | 'aucun' | 'ean' | 'vide', lu, trouve?, trouves?, par: [identité…], parCle: { 'sorte:cle': identité } }.
// `lu` : { suivi, nom, transporteur, forme } — ce qui a été lu (le n° de suivi reconnu, sinon le texte normalisé).
export function reconnaitre(brut, { enregistrements = [], regles = null, camera = false } = {}) {
  const texte = str(brut);
  const n = normaliserN(texte);
  if (!n) return { etat: 'vide', lu: null, par: [], parCle: {} };
  const cleNum = regles && typeof regles.cleNum === 'function' ? regles.cleNum : cleNumDefaut;
  const archive = regles ? regles.archive : '';
  const L = arr(enregistrements).filter((e) => e && e.cle != null);
  const lu0 = lireCodeColis(texte);
  const brutLu = { suivi: n, nom: null, transporteur: null, forme: 'texte' };
  // 5. La boîte, lue par la caméra : jamais une identité, rien n'est cherché (une boîte ne désigne aucune paire).
  if (camera && !lu0 && estEanBoite(texte)) return { etat: 'ean', lu: { ...brutLu, forme: 'ean' }, par: [], parCle: {} };
  const trouves = new Map(), par = [], parCle = {};
  const ajoute = (sorte, liste) => {
    let un = false;
    for (const e of liste) { const k = `${e.sorte || ''}:${e.cle}`; if (!trouves.has(k)) { trouves.set(k, e); parCle[k] = sorte; un = true; } }
    if (un && !par.includes(sorte)) par.push(sorte);
  };
  // 1. Le n° de suivi (égalité exacte, src/scanColis.js).
  if (lu0) { const r = retrouverParSuivi(lu0, L.filter((e) => e.sorte !== 'paire')); if (r.etat === 'un') ajoute('suivi', [r.trouve]); else if (r.etat === 'plusieurs') ajoute('suivi', r.trouves); }
  // 2. Le n° de transaction : la clé de SA vente ou de SON achat, à l'égalité.
  if (/^\d{9,13}$/.test(n)) ajoute('transaction', L.filter((e) => (e.sorte === 'vente' && String(e.cle) === 'v:' + n) || (e.sorte === 'achat' && String(e.cle) === 'a:' + n)));
  // 3. Le code de retrait : le code ENTIER d'un colis (un achat ou un colis à retirer), à l'égalité.
  if (n.length >= 4) ajoute('code', L.filter((e) => (e.sorte === 'achat' || e.sorte === 'colis') && e.code && normaliserN(e.code) === n));
  // 4. Le N° VRM : la paire de CETTE clé (ou les deux, ancienne et nouvelle, après la remise à zéro).
  const num = estEanBoite(texte) ? null : lireNumeroScan(texte, { cleNum, archive });
  if (num) ajoute('numero', L.filter((e) => e.sorte === 'paire' && num.cles.includes(String(e.cle).replace(/^n:/, ''))));
  const T = [...trouves.values()];
  const lu = lu0 || (par[0] && par[0] !== 'suivi' ? { ...brutLu, forme: par[0] } : num ? { ...brutLu, forme: 'numero' } : brutLu);
  if (T.length === 1) return { etat: 'un', lu, trouve: T[0], trouves: T, par, parCle };
  if (T.length > 1) return { etat: 'plusieurs', lu, trouves: T, par, parCle };
  // Rien : une boîte tapée reste « une boîte » (jamais une paire) ; sinon « inconnu ».
  if ((camera || !lu0) && estEanBoite(texte)) return { etat: 'ean', lu: { ...brutLu, forme: 'ean' }, par: [], parCle: {} };
  return { etat: 'aucun', lu, par: [], parCle: {}, numero: num ? num.cles : null };
}

// LA SOURCE DES PAIRES (montée par la coque, src/App.jsx) : un enregistrement par N° SERVI, par sa clé. `fiches` =
// `vinted_annonce_numeros` (annonces numérotées), `neuves` = `vrm_fiches_neuves` (rangées à l'arrivée, dupliquées),
// `pool` = `vinted_used_numeros` (chaque N° servi). Le titre et la photo viennent d'UNE fiche de CE N° (la plus
// récente lue) — affichés seulement, jamais comparés. Rend un tableau (vide si rien n'est lu).
export function pairesDuScan({ fiches = null, neuves = null, pool = null, cleNum = cleNumDefaut } = {}) {
  const m = new Map();
  const poser = (numero, titre, photo) => {
    const s = str(numero); const k = s ? cleNum(s) : '';
    if (!k || !NUM_OK.test(k)) return;
    const e = m.get(k) || { sorte: 'paire', cle: 'n:' + k, num: k, suivis: [], titre: '', photo: null };
    if (!e.titre && titre) e.titre = str(titre);
    if (!e.photo && photo) e.photo = typeof photo === 'string' ? photo : (photo && (photo.url || photo.full_size_url)) || null;
    m.set(k, e);
  };
  if (fiches && typeof fiches === 'object') for (const f of Object.values(fiches)) if (f && f.numero != null) poser(f.numero, f.title, f.photo);
  if (neuves && typeof neuves === 'object') for (const f of Object.values(neuves)) if (f && f.numero != null && !f.retireeAt) poser(f.numero, f.titre, f.photo);
  for (const p of arr(pool)) poser(p, '', null);
  return [...m.values()];
}
