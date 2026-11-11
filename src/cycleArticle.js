// ════════════════════════════════════════════════════════════════════════════
//  LE CYCLE D'UN ARTICLE : EN LIGNE → SUPPRIMÉ DE VINTED → ? (3 novembre 2026)
// ════════════════════════════════════════════════════════════════════════════
// Julien, 3 nov. 9 h 40 : il craint « plein de cas où il peut y avoir une
// ambiguïté et des erreurs avec les articles ». Décisions (rapportées par la
// session qui pilote) :
//   1. une annonce SUPPRIMÉE de Vinted sans preuve de vente : si le même article
//      réapparaît en ligne (republication, par IDENTITÉ : table de recréation,
//      même N°, même fichier photo), RIEN à demander, le N° suit. Sinon, après une
//      lecture COMPLÈTE de son dressing qui confirme qu'elle n'est plus en ligne
//      ni vendue : UNE carte dans Ma journée (« N°x supprimé de Vinted » +
//      « Toujours chez moi » · « Vendu en main propre » · « Je m'en sépare »).
//      Sans réponse l'article reste CHEZ LUI : jamais compté vendu, jamais sorti
//      du stock tout seul. Une suppression faite depuis VRM (Republier) ne
//      déclenche jamais la question.
//
// Ce module est PUR (aucun accès au navigateur ni à la base) : Ma journée, la
// liste des propositions eBay/Leboncoin (`src/propositionsSites.js`) et
// `scripts/audit-cycle-article.cjs` exécutent les MÊMES fonctions (§11).
//
// ⚠️ « Pas su » ne vaut pas « oui » (§5) : toute lecture ratée rend l'état
//    `pas-su` — aucune question, rien de déplacé.
// ⚠️ Jamais le titre, jamais la ressemblance (§5) : deux articles identiques
//    portent deux identifiants et deux N° ; rien ici ne les rapproche.
// ⚠️ « Vendue » se PROUVE et ne se déduit JAMAIS d'une absence : une annonce
//    absente n'est que « à demander » ; seule SA réponse la fait sortir.
//
// ── POURQUOI « VUE EN LIGNE » ──────────────────────────────────────────────
// Mesuré le 3 nov. (lecture seule, sa base) : 505 fiches numérotées, 263 absentes
// de tout dressing lu, dont 211 portent un N° d'archive (B…) — des articles
// vendus avant les captures, sans transaction rangée. Une règle « absente et pas
// vendue ⇒ question » lui aurait posé 230 questions fausses le premier matin.
// ⇒ Une absence ne compte que si VRM a VU l'annonce en ligne avant : le registre
//    `vrm_vus_en_ligne` (id → dernière lecture complète qui la montrait en
//    ligne), tenu par `majVusEnLigne`, ou une suppression vue en 2xx par
//    l'extension (`harvest_{uid}_supprimees`, 5.165). Ce qui n'a jamais été vu
//    en ligne depuis l'arrivée de cette règle n'est jamais demandé (« jamais-vue »).

export const MARGE_DISPARITION_MS = 5 * 60 * 1000;      // la lecture qui constate l'absence doit être POSTÉRIEURE à la dernière vue
export const LECTURE_FRAICHE_MS = 24 * 60 * 60 * 1000;  // la même borne que « en ligne » (ENLIGNE_FRAIS_MS)
export const VU_RAFRAICHIR_MS = 6 * 60 * 60 * 1000;     // le registre ne se réécrit pas à chaque ouverture
export const CARTES_MAX = 5;                             // Ma journée : au plus 5 cartes, le reste compté

// (9 nov., Julien : « l'app détecte quand je supprime un article, mets aussi que je le
// remets en ligne ») « REMISE EN LIGNE » : SA réponse dit que l'article est chez lui et
// qu'il le republie lui-même. Pour le stock c'est « toujours chez moi » (rien ne sort) ;
// la NOUVELLE annonce n'est jamais devinée ici : elle reprend le N° par identité
// (`republiee` : même N°, même fichier photo, table de recréation — étape 4), et la
// suggestion « c'est la même paire que N°x » appartient à son propre chantier
// (`claude/numero-etiquette`), qui lit `vrm_cycle_decisions[id].choix === 'remise'`.
export const CHOIX = Object.freeze({ CHEZ_MOI: 'chez-moi', REMISE: 'remise', VENDU_MAIN: 'vendu-main', SEPARE: 'separe' });
export const LIBELLE_CHOIX = Object.freeze({
  'chez-moi': 'Toujours chez moi',
  'remise': 'Remise en ligne',
  'vendu-main': 'Vendu en main propre',
  'separe': "Je m'en sépare",
});
// L'ordre des réponses à l'écran (Ma journée) : les deux qui GARDENT l'article d'abord.
export const ORDRE_CHOIX = Object.freeze(['chez-moi', 'remise', 'vendu-main', 'separe']);

const cleDefaut = (n) => {
  const s = String(n == null ? '' : n).toUpperCase().replace(/\s+/g, '').replace(/^N[°O]?(?=\d)/, '');
  const m = /^([A-Z]*)0*(\d+)$/.exec(s);
  return m ? m[1] + m[2] : s;
};
const estSet = (s) => !!(s && typeof s.has === 'function');
const estMap = (m) => !!(m && typeof m.get === 'function');

// L'état d'UNE fiche numérotée. Entrées (trois états partout : objet lu ·
// `null` pas su · absent = pas demandé) :
//  id, fiche            : la fiche N° (`vinted_annonce_numeros[id]`)
//  lectures             : Map uid → { lu, complet, enLigne:Set, masquees:Set, aConfirmer:Set, venduesDressing:Set }
//  presentes            : { parNum: Map cleN° → Set ids, parPhoto: Map photoK → Set ids } — fiches PRÉSENTES (en ligne,
//                         masquées, à confirmer) de TOUS ses comptes
//  recrees              : { nouvelId: ancienId } (`tableRecrees`) · null pas su
//  viaVrm               : Set des annonces que VRM a retirées (coffre `versBrouillon`) · null pas su
//  supprimees           : Map uid → { id: atISO } (2xx vus par l'extension) · null pas su
//  vus                  : { id: atISO } (`vrm_vus_en_ligne`)
//  ventes               : { ids: Set (vente PROUVÉE de cette annonce), nums: Set cleN° (vendue sur un site),
//                           revenues: Set ids (vente revenue : retour, annulée) } · null pas su
//  vendusMain           : Set ids (« vendue à la main », `vinted_annonces_vendues`)
//  remis                : Set cleN° (retour REMIS en stock, `vinted_retours_remis`)
//  declaree(id)         : la fiche est déclarée partie (`vinted_pairs_lost`, par identité)
//  decisions            : { id: { choix, at, numero, montant? } } (`vrm_cycle_decisions`)
//  exclus               : Set uid (comptes retirés / bloqués / masqués)
// Rend { etat, preuve? } — `etat` ∈ ETATS.
export const ETATS = Object.freeze(['sans-numero', 'hors-compte', 'vendue', 'sortie', 'en-ligne', 'masquee', 'a-confirmer',
  'republiee', 'remis', 'revenue', 'chez-moi', 'via-vrm', 'pas-su', 'jamais-vue', 'a-demander']);
export function etatCycle(id0, x) {
  const id = String(id0);
  const o = x || {};
  const cle = typeof o.cle === 'function' ? o.cle : cleDefaut;
  const fiche = o.fiche || (o.fiches && o.fiches[id]) || null;
  const num = fiche && fiche.numero != null ? String(fiche.numero).trim() : '';
  if (!num) return { etat: 'sans-numero' };
  const k = cle(num);
  const uid = String((fiche && fiche.accountId) || '');
  if (estSet(o.exclus) && uid && o.exclus.has(uid)) return { etat: 'hors-compte' };
  // 1. SA réponse, quand elle fait sortir l'article (vendu à la main, séparé).
  const dec = o.decisions && o.decisions[id];
  if (dec && dec.choix === CHOIX.VENDU_MAIN) return { etat: 'vendue', preuve: 'main-propre' };
  if (dec && dec.choix === CHOIX.SEPARE) return { etat: 'sortie', preuve: 'separe' };
  if (typeof o.declaree === 'function' && o.declaree(id)) return { etat: 'sortie', preuve: 'declaree' };
  const lec = estMap(o.lectures) ? o.lectures.get(uid) : null;
  // 2. Une vente PROUVÉE (n'importe quel site, par identité) ou marquée à la main —
  //    AVANT « en ligne » : Vinted ne ferme pas toujours une annonce vendue.
  if (o.ventes === null) return { etat: 'pas-su', preuve: 'ventes' };
  const v = o.ventes || {};
  if (estSet(v.ids) && v.ids.has(id)) return { etat: 'vendue', preuve: 'transaction' };
  if (lec && estSet(lec.venduesDressing) && lec.venduesDressing.has(id)) return { etat: 'vendue', preuve: 'dressing' };
  if (estSet(o.vendusMain) && o.vendusMain.has(id)) return { etat: 'vendue', preuve: 'a-la-main' };
  if (estSet(v.nums) && v.nums.has(k)) return { etat: 'vendue', preuve: 'numero' };
  // 3. Ce que la lecture de SON compte dit de CETTE annonce.
  if (lec) {
    if (estSet(lec.enLigne) && lec.enLigne.has(id)) return { etat: 'en-ligne' };
    if (estSet(lec.masquees) && lec.masquees.has(id)) return { etat: 'masquee' };
    if (estSet(lec.aConfirmer) && lec.aConfirmer.has(id)) return { etat: 'a-confirmer' };
  }
  // 4. Le même article, présent sous une AUTRE annonce (republié) : le N° suit.
  const p = o.presentes || {};
  const autre = (s) => estSet(s) && [...s].some((x) => String(x) !== id);
  if (estMap(p.parNum) && autre(p.parNum.get(k))) return { etat: 'republiee', preuve: 'numero' };
  const pk = fiche && fiche.photoK ? String(fiche.photoK) : '';
  if (pk && estMap(p.parPhoto) && autre(p.parPhoto.get(pk))) return { etat: 'republiee', preuve: 'photo' };
  if (o.recrees === null) return { etat: 'pas-su', preuve: 'recreations' };
  if (o.recrees && typeof o.recrees === 'object') {
    for (const nid of Object.keys(o.recrees)) {
      if (String(o.recrees[nid]) !== id || nid === id) continue;
      if (estMap(p.tous) ? p.tous.has(String(nid)) : false) return { etat: 'republiee', preuve: 'recreation' };
    }
  }
  // 5. Revenu chez lui après une vente (retour remis en stock), ou retour en cours.
  if (estSet(o.remis) && o.remis.has(k)) return { etat: 'remis' };
  if (estSet(v.revenues) && v.revenues.has(id)) return { etat: 'revenue' };
  // 6. SA réponse « toujours chez moi ».
  if (dec && dec.choix === CHOIX.CHEZ_MOI) return { etat: 'chez-moi' };
  if (dec && dec.choix === CHOIX.REMISE) return { etat: 'chez-moi', preuve: 'remise' };
  // 7. Retirée PAR VRM (Republier : coffre → supprimer → brouillon → en ligne) :
  //    jamais de question, l'article est chez lui, sa nouvelle annonce arrive.
  if (o.viaVrm === null || o.viaVrm === undefined) return { etat: 'pas-su', preuve: 'republier' };
  if (o.viaVrm.has(id)) return { etat: 'via-vrm' };
  // 8. Rien ne se conclut sans une lecture COMPLÈTE et FRAÎCHE de son dressing.
  const maintenant = Number.isFinite(o.maintenant) ? o.maintenant : Date.now();
  if (!lec || !Number.isFinite(Number(lec.lu)) || lec.complet !== true || maintenant - Number(lec.lu) > LECTURE_FRAICHE_MS) return { etat: 'pas-su', preuve: 'lecture' };
  // 9. Une disparition CONSTATÉE : vue supprimée (2xx) ou vue en ligne avant cette lecture.
  const supp = estMap(o.supprimees) ? o.supprimees.get(uid) : null;
  const tSupp = supp && typeof supp === 'object' ? Date.parse(supp[id] || '') : NaN;
  const tVu = Date.parse((o.vus && o.vus[id]) || '');
  const vueSupprimee = Number.isFinite(tSupp);
  const vuePuisAbsente = Number.isFinite(tVu) && Number(lec.lu) >= tVu + MARGE_DISPARITION_MS;
  if (!vueSupprimee && !vuePuisAbsente) return { etat: 'jamais-vue' };
  return { etat: 'a-demander', preuve: vueSupprimee ? 'suppression' : 'absente' };
}

// L'article est-il CHEZ LUI (sur l'étagère) ? « à demander » l'est : sans
// réponse, il reste chez toi. Une annonce remplacée (`republiee`) ne compte
// pas : l'article est compté par sa nouvelle annonce. « pas su » ne décide rien.
export const CHEZ_LUI = Object.freeze(['en-ligne', 'masquee', 'a-confirmer', 'chez-moi', 'a-demander', 'remis', 'via-vrm']);
export const chezLui = (etat) => CHEZ_LUI.includes(etat);

// Les fiches À DEMANDER, triées par N° (le plus petit d'abord), au plus `max`.
// Rend { cartes: [{ id, numero, title, photo, accountId, preuve }], total, pasSu }.
export function cartesSupprimees(fiches, x, max = CARTES_MAX) {
  const o = x || {};
  const cartes = []; let pasSu = 0, plusTard = 0;
  for (const id of Object.keys(fiches || {})) {
    const f = fiches[id] || {};
    const r = etatCycle(id, { ...o, fiche: f });
    if (r.etat === 'pas-su') { pasSu++; continue; }
    if (r.etat !== 'a-demander') continue;
    if (repousseeJusqua(o.plusTard, id, o.maintenant) > 0) { plusTard++; continue; }
    cartes.push({ id: String(id), numero: String(f.numero).trim(), title: String(f.title || ''), photo: f.photo || null, accountId: String(f.accountId || ''), preuve: r.preuve });
  }
  const n = (s) => { const m = /(\d+)/.exec(s); return m ? Number(m[1]) : 1e9; };
  cartes.sort((a, b) => n(a.numero) - n(b.numero) || a.numero.localeCompare(b.numero) || a.id.localeCompare(b.id));
  return { cartes: cartes.slice(0, Math.max(0, max)), total: cartes.length, pasSu, plusTard };
}

// Le registre « vue en ligne » : pour chaque fiche NUMÉROTÉE en ligne dans une
// lecture COMPLÈTE et fraîche de son compte, l'heure de cette lecture. Rend la
// table à écrire, ou `null` quand rien ne change assez pour l'écrire (au plus
// une réécriture par `VU_RAFRAICHIR_MS` et par annonce). Jamais une entrée
// retirée : une annonce vue en ligne une fois le reste (la question s'appuie
// dessus). Une lecture partielle ou vieille n'écrit rien.
export function majVusEnLigne(prec, fiches, lectures, maintenant = Date.now()) {
  const base = prec && typeof prec === 'object' && !Array.isArray(prec) ? prec : {};
  const out = { ...base }; let change = false;
  if (!estMap(lectures)) return null;
  for (const id of Object.keys(fiches || {})) {
    const f = fiches[id] || {};
    if (!String(f.numero == null ? '' : f.numero).trim()) continue;
    const lec = lectures.get(String(f.accountId || ''));
    if (!lec || lec.complet !== true || !Number.isFinite(Number(lec.lu)) || maintenant - Number(lec.lu) > LECTURE_FRAICHE_MS) continue;
    if (!(estSet(lec.enLigne) && lec.enLigne.has(String(id)))) continue;
    const avant = Date.parse(base[id] || '');
    const lu = Number(lec.lu);
    if (Number.isFinite(avant) && (lu <= avant || lu - avant < VU_RAFRAICHIR_MS)) continue;
    out[id] = new Date(lu).toISOString(); change = true;
  }
  return change ? out : null;
}

// Les présentes de tous ses comptes, indexées pour `etatCycle`.
export function indexPresentes(fiches, lectures, cle = cleDefaut) {
  const parNum = new Map(), parPhoto = new Map(), tous = new Map();
  if (!estMap(lectures)) return { parNum, parPhoto, tous };
  for (const lec of lectures.values()) {
    for (const s of [lec && lec.enLigne, lec && lec.masquees, lec && lec.aConfirmer]) {
      if (!estSet(s)) continue;
      for (const id0 of s) {
        const id = String(id0); tous.set(id, true);
        const f = (fiches || {})[id] || {};
        const k = f.numero != null && String(f.numero).trim() ? cle(f.numero) : '';
        if (k) { if (!parNum.has(k)) parNum.set(k, new Set()); parNum.get(k).add(id); }
        if (f.photoK) { const pk = String(f.photoK); if (!parPhoto.has(pk)) parPhoto.set(pk, new Set()); parPhoto.get(pk).add(id); }
      }
    }
  }
  return { parNum, parPhoto, tous };
}

// Le montant d'une vente en main propre, tel qu'il le tape : « 45 », « 45,50 €».
// Rien de deviné : illisible ou ≤ 0 ⇒ `null` (la carte redemande).
export function montantSaisi(t) {
  const s = String(t == null ? '' : t).replace(/[\s€]/g, '').replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  return n > 0 && n < 100000 ? Math.round(n * 100) / 100 : null;
}

// ════════════════════════════════════════════════════════════════════════════
//  « TU L'AS ENCORE ? » — LA RÉPONSE EN UN GESTE (11 nov., lot DJ4)
// ════════════════════════════════════════════════════════════════════════════
// Julien : « Quand l'app me demande si mon article est toujours chez moi après que je
// l'ai supprimé, je veux qu'elle me demande si je veux l'enlever du stock ». UNE question,
// trois réponses, chacune un geste ANNULABLE 5 s (la pilule du lot B, src/gesteAnnulable.js),
// sans fenêtre de confirmation :
//   · « Oui, je la garde »     ⇒ `vrm_cycle_decisions[id] = chez-moi` : reste au stock, N°
//                                 gardé, proposée à republier (propositionsSites : 'chez-moi') ;
//   · « Non, enlève-la »       ⇒ une RAISON au choix rapide (donnée, vendue ailleurs, perdue,
//                                 rendue) : `vrm_cycle_decisions[id] = separe + raison`, la
//                                 déclaration `vinted_pairs_lost` (par IDENTITÉ : l'id
//                                 d'annonce), et sa case du Stock libérée (`vrm_slots`). Le N°
//                                 n'est JAMAIS redonné (§5 : il reste pris, rien ne le libère) ;
//                                 « vendue ailleurs » n'invente ni vente ni montant (§2.3).
//   · « Plus tard »            ⇒ la question se tait `PLUS_TARD_MS` (sur cet appareil).
// Une vendue PROUVÉE ou une republication (même N°, même photo, table de recréation —
// `repriseNumero`) n'arrive jamais ici : `etatCycle` ne la rend pas « à demander ».
// Module PUR : rend les opérations (`{ k, type: 'cle', id, apres, avant }`) que la coque
// passe à `gesteVrm` ; « Annuler » remet chaque sous-valeur d'avant, exacte.
export const PLUS_TARD = 'vrm_cycle_plus_tard';
export const PLUS_TARD_MS = 20 * 60 * 60 * 1000;
export const RAISONS_SORTIE = Object.freeze([
  ['donnee', 'Donnée'], ['vendue-ailleurs', 'Vendue ailleurs'], ['perdue', 'Perdue'], ['rendue', 'Rendue'],
]);
export const REPONSES_CHEZ_TOI = Object.freeze({ garde: 'Oui, je la garde', enleve: 'Non, enlève-la du stock', plusTard: 'Plus tard' });
// Le temps restant (ms) pendant lequel la question est repoussée ; 0 = pas repoussée.
export function repousseeJusqua(plusTard, id, maintenant) {
  const t = Date.parse((plusTard && typeof plusTard === 'object' && plusTard[String(id)]) || '');
  if (!Number.isFinite(t)) return 0;
  const reste = t + PLUS_TARD_MS - (Number.isFinite(maintenant) ? maintenant : Date.now());
  return reste > 0 ? reste : 0;
}
//   carte     { id, numero, title }
//   reponse   'garde' | 'enleve' | 'plus-tard'
//   raison    une clé de RAISONS_SORTIE (seulement pour 'enleve' ; sans elle, rien)
//   decisions, perdues, slots, plusTard : les valeurs COURANTES (pour « avant »)
//   cleDeclaration(numero, id) : la clé de `vinted_pairs_lost` (App : `cleDeclarationPartie`)
// Rend { ops, texte } ou null (réponse incomplète : rien n'est écrit).
export function opsChezToi({ carte, reponse, raison = null, decisions = {}, perdues = {}, slots = {}, plusTard = {}, cleDeclaration = null, cle = cleDefaut, maintenant = Date.now() } = {}) {
  if (!carte || carte.id == null || String(carte.id) === '') return null;
  const id = String(carte.id), numero = String(carte.numero == null ? '' : carte.numero).trim();
  const at = new Date(maintenant).toISOString();
  const D = decisions || {}, P = perdues || {}, S = slots || {}, T = plusTard || {};
  if (reponse === 'garde') {
    return { texte: `N°${numero || '?'} : gardée au stock`,
      ops: [{ k: 'vrm_cycle_decisions', type: 'cle', id, apres: { choix: CHOIX.CHEZ_MOI, numero, at }, avant: D[id] }] };
  }
  if (reponse === 'plus-tard') {
    return { texte: `N°${numero || '?'} : je te redemande demain`,
      ops: [{ k: PLUS_TARD, type: 'cle', id, apres: at, avant: T[id] }] };
  }
  if (reponse !== 'enleve') return null;
  const R = RAISONS_SORTIE.find((x) => x[0] === raison);
  if (!R) return null;
  const ops = [{ k: 'vrm_cycle_decisions', type: 'cle', id, apres: { choix: CHOIX.SEPARE, raison: R[0], numero, at }, avant: D[id] }];
  // La déclaration « partie », par IDENTITÉ : jamais une clé portée par une AUTRE annonce.
  let k0 = typeof cleDeclaration === 'function' ? String(cleDeclaration(numero, id) || '') : '';
  if (!k0) k0 = numero ? `${numero}@${id}` : '';
  if (k0 && P[k0] && P[k0].id != null && String(P[k0].id) !== id) k0 = `${numero}@${id}`;
  if (k0) ops.push({ k: 'vinted_pairs_lost', type: 'cle', id: k0, apres: { ...(P[k0] || {}), id, at, title: String(carte.title || ''), from: 'cycle', raison: R[0] }, avant: P[k0] });
  // Sa case du Stock (par son N°) : libérée. Le N° lui-même ne bouge pas.
  const kn = numero ? cle(numero) : '';
  if (kn && S[kn]) ops.push({ k: 'vrm_slots', type: 'cle', id: kn, apres: undefined, avant: S[kn] });
  return { texte: `N°${numero || '?'} sortie du stock · ${R[1].toLowerCase()}`, ops };
}
