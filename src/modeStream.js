// ── LE MODE STREAM, UNE RÈGLE (5 nov.) ─────────────────────────────────────────
// Julien (demandes du 5 nov., §11 et « Précisions du vocal ») : « pour qui filme
// VRM, il programme ce qu'il veut flouter — marques, prix, numéros de compte,
// noms de ses comptes Vinted, “les mots qui commencent par…”, “toutes les
// annonces qui ont…” ». Le bouton « masqué » (l'œil qui cachait les montants)
// est REMPLACÉ par un bouton « Stream ».
//
// Avant, DEUX mécanismes vivaient côte à côte :
//   · `src/streamFlou.js` (17 oct.) : un FLOU CSS sur l'élément qui contenait un
//     pseudo de ses comptes, une adresse, un téléphone, un IBAN. Le texte restait
//     dans la page : un flou de 6 px sur un grand titre se relit, et une capture
//     de la page (ou un lecteur d'écran) le donnait en clair ;
//   · `src/montantsCaches.js` (4 nov.) : l'œil qui remplaçait chaque montant par
//     « ••• ».
// ⇒ UNE règle : en mode stream, le TEXTE rendu est réécrit (« ••• ») selon SON
//    programme, avant que l'image soit peinte (rappel de l'observateur, une
//    micro-tâche après le rendu de React). Ce qui n'est pas du texte (photos d'une
//    annonce cachée, bordereaux, QR des codes de retrait, champs de saisie) est
//    flouté par le CSS (index.html).
//
// ⚠️ Rien ne tourne hors mode stream : aucun coût pour l'usage normal.
// ⚠️ Le programme (`vrm_stream_regles`) est SYNCHRONISÉ (le même sur ses
//    appareils) ; l'interrupteur (`vrm_stream`) est PROPRE À L'APPAREIL : on filme
//    depuis un appareil, pas partout.
// ⚠️ « Pas su » : tant que le programme n'est pas lu, c'est le programme par
//    défaut — TOUT caché. Un réglage qui manque ne montre jamais plus.
// ⚠️ Jamais d'identité ici (§5) : la règle ne relie rien, elle ne fait que cacher.

import { masquerTexte, masquerSuite, MASQUE } from './montantsCaches.js';

export { MASQUE };
export const CLE_STREAM = 'vrm_stream';
export const CLE_STREAM_REGLES = 'vrm_stream_regles';

// Les catégories qu'il coche (vrai = caché). Par défaut, tout est caché.
export const CATEGORIES = [
  ['montants', 'Prix et montants'],
  ['comptes', 'Noms de tes comptes (Vinted, Leboncoin, eBay, Vestiaire), ton entreprise'],
  ['acheteurs', "Pseudos des acheteurs et des vendeurs"],
  ['adresses', 'Adresses, e-mails, téléphones'],
  ['numeros', 'Numéros de compte (IBAN, SIRET, carte)'],
  ['codes', 'Codes de retrait et QR'],
  ['bordereaux', 'Bordereaux à l’écran'],
];
// Les listes qu'il écrit.
export const LISTES = [
  ['marques', 'Marques et mots à cacher'],
  ['prefixes', 'Les mots qui commencent par…'],
  ['contient', 'Cacher toute l’annonce qui contient…'],
];
const MAX_MOTS = 60, MIN_MOT = 2, MAX_LONG = 40;

export const REGLES_DEFAUT = Object.freeze({
  v: 1, montants: true, comptes: true, acheteurs: true, adresses: true, numeros: true, codes: true, bordereaux: true,
  marques: [], prefixes: [], contient: [],
});

// Un mot de liste : sans espaces autour, 2 à 40 caractères, sans doublon (casse ignorée).
export function nettoyerMots(liste) {
  const vus = new Set(), out = [];
  for (const x of Array.isArray(liste) ? liste : []) {
    const t = String(x == null ? '' : x).replace(/\s+/g, ' ').trim();
    if (t.length < MIN_MOT || t.length > MAX_LONG) continue;
    const k = t.toLocaleLowerCase('fr-FR');
    if (vus.has(k)) continue;
    vus.add(k); out.push(t);
    if (out.length >= MAX_MOTS) break;
  }
  return out;
}

// La forme sûre d'un programme lu (nuage, appareil, saisie). Une catégorie absente
// ou illisible reste CACHÉE (défaut) : seul un `false` explicite la montre.
export function normaliserRegles(r) {
  const s = r && typeof r === 'object' && !Array.isArray(r) ? r : {};
  const out = { v: 1 };
  for (const [k] of CATEGORIES) out[k] = s[k] !== false;
  for (const [k] of LISTES) out[k] = nettoyerMots(s[k]);
  return out;
}

const echap = (t) => String(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Une espace dans un mot programmé vaut toute espace rendue (insécable, fine…).
const motif = (t) => echap(t).replace(/ /g, '[\\s\\u00a0\\u202f]+');
const L = '\\p{L}\\p{N}';
const EMAIL = '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}';
const TEL = '(?:\\+33[\\s.]?|\\b0)[1-9](?:[\\s.-]?\\d{2}){4}\\b';
const RUE = `\\b\\d{1,4}(?:\\s?(?:bis|ter))?,?\\s+(?:rue|avenue|av\\.|boulevard|bd|place|all[ée]e|chemin|impasse|route|quai|cours|square|r[ée]sidence|lieu-dit|faubourg)\\b[^\\n,·•]{0,48}`;
const CP_VILLE = `\\b(?:\\d{5}|\\d{2}\\s\\d{3})\\s+[A-ZÉÈÊÀÂÎÔÛÇ][${L}'’-]+(?:[\\s-][A-ZÉÈÊÀÂÎÔÛÇa-zé][${L}'’-]+){0,3}`;
const IBAN = '\\b[A-Z]{2}\\d{2}(?:[\\s]?[A-Z0-9]{4}){3,7}(?:[\\s]?[A-Z0-9]{1,3})?\\b';
const SIRET = '\\b\\d{3}[\\s\\u00a0]?\\d{3}[\\s\\u00a0]?\\d{3}(?:[\\s\\u00a0]?\\d{5})?\\b';
const CARTE = '\\b\\d{4}(?:[\\s-]?\\d{4}){3}\\b';

const reSur = (src, fl) => { try { return src ? new RegExp(src, fl) : null; } catch (_) { return null; } };

// LA RÈGLE COMPILÉE : le programme + les jetons connus de l'app (pseudos de ses
// comptes, des acheteurs…). `groupes` : Map ou objet { nom → [jetons] } — un nom
// qui commence par « acheteurs » relève de la catégorie « acheteurs », tous les
// autres de « comptes ».
export function compilerRegle(regles, groupes) {
  const r = normaliserRegles(regles);
  const entrees = groupes instanceof Map ? [...groupes.entries()] : Object.entries(groupes || {});
  const jetons = new Set();
  for (const [nom, liste] of entrees) {
    const cat = /^acheteurs/.test(nom) ? 'acheteurs' : 'comptes';
    if (!r[cat]) continue;
    for (const j of Array.isArray(liste) ? liste : []) { const t = String(j == null ? '' : j).trim(); if (t.length >= 3) jetons.add(t); }
  }
  // Les plus longs d'abord : « vendeuse_ab » avant « vendeuse_a ».
  const tri = (l) => [...l].sort((a, b) => b.length - a.length);
  const motifs = [];
  if (r.adresses) motifs.push(EMAIL, TEL, RUE, CP_VILLE);
  if (r.numeros) motifs.push(IBAN, CARTE, SIRET);
  const mots = tri([...r.marques, ...r.contient]);
  return {
    montants: r.montants, codes: r.codes, bordereaux: r.bordereaux, acheteurs: r.acheteurs, comptes: r.comptes,
    reJetons: reSur(tri(jetons).map(echap).join('|'), 'giu'),
    reMotifs: reSur(motifs.join('|'), 'giu'),
    // Un mot ENTIER (« Nike » ne cache pas « Nikeland ») ; une annonce « qui
    // contient » : le début d'un mot suffit (« Jordan » cache « Jordans »).
    reMots: reSur(mots.length ? `(^|[^${L}])((?:${tri(r.marques).map(motif).join('|') || '(?!)'})(?![${L}])|(?:${tri(r.contient).map(motif).join('|') || '(?!)'})[${L}'’_-]*)` : '', 'giu'),
    rePrefixes: reSur(r.prefixes.length ? `(^|[^${L}])((?:${tri(r.prefixes).map(motif).join('|')})[${L}'’_.-]*)` : '', 'giu'),
    reLigne: reSur(r.contient.length ? `(^|[^${L}])(?:${tri(r.contient).map(motif).join('|')})` : '', 'iu'),
    regles: r,
  };
}

// Tout ce qui n'est pas un montant, dans un texte seul.
function masquerAutres(s, R) {
  let t = s;
  if (R.reJetons) t = t.replace(R.reJetons, MASQUE);
  if (R.reMotifs) t = t.replace(R.reMotifs, MASQUE);
  if (R.rePrefixes) t = t.replace(R.rePrefixes, (m, a) => a + MASQUE);
  if (R.reMots) t = t.replace(R.reMots, (m, a) => a + MASQUE);
  return t;
}

// Un texte seul, selon la règle. (L'aperçu, les notifications, l'audit.)
export function masquerTexteStream(texte, R) {
  const s = String(texte == null ? '' : texte);
  if (!R) return s;
  return masquerAutres(R.montants ? masquerTexte(s) : s, R);
}

// Une SUITE de textes voisins (nœuds d'un même bloc) : un montant coupé en deux
// nœuds (« 45 » puis « € ») est caché comme un seul (src/montantsCaches.js).
export function masquerSuiteStream(textes, voisins, R) {
  const t = (Array.isArray(textes) ? textes : []).map((x) => String(x == null ? '' : x));
  if (!R) return t;
  const m = R.montants ? masquerSuite(t, voisins) : t;
  return m.map((x) => masquerAutres(x, R));
}

// Ce texte fait-il cacher TOUTE sa ligne (« toutes les annonces qui contiennent… ») ?
export function ligneACacher(texte, R) {
  return !!(R && R.reLigne && texte && R.reLigne.test(String(texte)));
}

// Tout le texte d'un élément caché en bloc (ligne, code, pseudo marqué) : les
// espaces autour restent, le reste devient « ••• ».
export function toutMasquer(texte) {
  const s = String(texte == null ? '' : texte);
  return /\S/.test(s) ? s.replace(/\S[\s\S]*\S|\S/, MASQUE) : s;
}

// ── L'ÉTAT DU MODULE (un seul pour l'app) ───────────────────────────────────
const _groupes = new Map();
let _regles = REGLES_DEFAUT;
let _R = null;
let _actif = false;
let _retirer = null;
const recompiler = () => { _R = compilerRegle(_regles, _groupes); };

export function regleCourante() { if (!_R) recompiler(); return _R; }
// L'aperçu : la règle d'un programme pas encore enregistré, avec les jetons connus
// et ceux d'EXEMPLE (jamais un vrai pseudo dans une démonstration).
export function regleApercu(regles, exemples) {
  const g = new Map(_groupes);
  for (const [k, v] of Object.entries(exemples || {})) g.set(k, v);
  return compilerRegle(regles, g);
}
export function streamAllume() { return _actif; }

// Un texte à montrer HORS de la page (notification système, titre d'onglet) :
// caché si le mode stream est allumé.
export function textePourStream(texte) {
  return _actif ? masquerTexteStream(texte, regleCourante()) : String(texte == null ? '' : texte);
}

// Les écrans publient les jetons qu'ils connaissent (pseudos de ses comptes, des
// acheteurs) : un pseudo écrit dans une phrase est caché sans qu'on y pense.
export function jetonsStream(nom, liste) {
  const l = (Array.isArray(liste) ? liste : []).filter((x) => x != null && String(x).trim()).map((x) => String(x).trim());
  const avant = _groupes.get(nom);
  if (avant && avant.length === l.length && avant.every((x, i) => x === l[i])) return;
  _groupes.set(nom, l);
  recompiler();
  if (_actif && _retirer) _retirer.repasser();
}

export function poserReglesStream(regles) {
  const n = normaliserRegles(regles);
  if (JSON.stringify(n) === JSON.stringify(_regles)) return;
  _regles = n;
  recompiler();
  poserAttributs();
  if (_actif && _retirer) _retirer.repasser();
}

function poserAttributs() {
  if (typeof document === 'undefined') return;
  const d = document.documentElement;
  try {
    d.setAttribute('data-stream', _actif ? '1' : '0');
    const R = regleCourante();
    if (_actif && R.bordereaux) d.setAttribute('data-stream-bordereaux', '1'); else d.removeAttribute('data-stream-bordereaux');
    if (_actif && R.codes) d.setAttribute('data-stream-codes', '1'); else d.removeAttribute('data-stream-codes');
  } catch (_) {}
}

export function demarrerStream(on) {
  _actif = !!on;
  poserAttributs();
  if (typeof document === 'undefined' || !document.body) return;
  if (_actif && !_retirer) _retirer = installerStream(document.body, regleCourante);
  else if (_actif && _retirer) _retirer.repasser();
  if (!_actif && _retirer) { const r = _retirer; _retirer = null; r.arreter(); }
}

// ── LA COUCHE DOM ───────────────────────────────────────────────────────────
// (Les `<option>` d'un menu SONT montrées : leur texte suit la règle ; la valeur ne change pas.)
const EXCLUS = new Set(['TEXTAREA', 'SCRIPT', 'STYLE', 'NOSCRIPT', 'INPUT', 'TITLE']);
// Les lignes connues de l'app (cartes d'annonce, ventes, achats, colis, retraits,
// conversations, lignes de Ma journée) ; ailleurs, la règle de forme ci-dessous.
const LIGNE = '[data-stream-ligne-cible], .vrm-ann-card, .vrm-sale-row, .vrm-buy-row, .vrm-colis-carte, .vrm-pickup-card, .vrm-recap-ligne, .vrm-inbox-row, li, tr, article, [role="listitem"], [role="row"]';
const NOTRE_LIGNE = 'data-stream-ligne';
const NOTRE_FLOU = 'data-stream-flou';

function exclu(n) {
  for (let e = n.parentElement; e; e = e.parentElement) {
    if (EXCLUS.has(e.tagName)) return true;
    if (e.isContentEditable) return true;
    if (e.hasAttribute && e.hasAttribute('data-stream-libre')) return true;
  }
  return false;
}
const memeBloc = (a, b) => {
  const pa = a.parentNode, pb = b.parentNode;
  if (!pa || !pb) return false;
  return pa === pb || pa.parentNode === pb || pa === pb.parentNode || (pa.parentNode && pa.parentNode === pb.parentNode);
};
// La LIGNE d'un texte : la carte, la rangée, l'élément de liste qui le porte —
// marquée à la main (`data-stream-ligne-cible`), ou une balise de liste, ou le
// premier ancêtre qui a des FRÈRES de même forme (une liste de cartes).
function ligneDe(el, racine) {
  if (!el) return null;
  const marque = el.closest && el.closest(LIGNE);
  if (marque && racine.contains(marque) && marque !== racine) return marque;
  let e = el;
  for (let i = 0; e && e !== racine && i < 12; i++, e = e.parentElement) {
    const p = e.parentElement;
    if (!p || p === racine) break;
    if (/^(MAIN|BODY|HTML|HEADER|NAV)$/.test(p.tagName)) break;
    if (!e.className || typeof e.className !== 'string' || /^(SPAN|B|SMALL|STRONG|EM|I)$/.test(e.tagName)) continue;
    for (const f of p.children) if (f !== e && f.tagName === e.tagName && f.className === e.className) return e;
  }
  return el;
}
// Un élément caché EN BLOC : une ligne qui contient un mot « annonce entière »,
// ou un élément que l'app a marqué sensible (`.vrm-sensible`, et son type :
// `data-stream-type="acheteur"` suit la case des pseudos, `"code"` celle des codes,
// `"compte"` celle de ses comptes ; sans type, toujours caché).
function enBloc(el, R) {
  for (let e = el; e; e = e.parentElement) {
    if (e.hasAttribute(NOTRE_LIGNE)) return true;
    if (e.classList && e.classList.contains('vrm-sensible')) {
      const t = e.getAttribute('data-stream-type');
      if (t === 'acheteur') { if (R.acheteurs) return true; continue; }
      if (t === 'code') { if (R.codes) return true; continue; }
      if (t === 'compte') { if (R.comptes) return true; continue; }
      return true;
    }
  }
  return false;
}

// Pose la règle sur `racine` (document.body) ; rend { arreter, repasser }.
// `lire()` rend la règle compilée du moment.
export function installerStream(racine, lire) {
  const doc = racine && racine.ownerDocument;
  if (!doc || typeof MutationObserver === 'undefined') return { arreter() {}, repasser() {} };
  const origine = new Map();   // nœud de texte → { o, m }
  const titres = new Map();    // élément → { o, m } (l'infobulle `title`)
  const lignes = new Set();
  const flous = new Set();
  let arrete = false;
  const obs = new MutationObserver(() => passer());
  const brancher = () => obs.observe(racine, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['title', 'value'] });
  const passer = () => {
    if (arrete) return;
    obs.disconnect();
    try {
      const R = lire();
      const w = doc.createTreeWalker(racine, 4 /* NodeFilter.SHOW_TEXT */);
      const noeuds = [], textes = [];
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        if (!n.nodeValue || exclu(n)) continue;
        const d = origine.get(n);
        const o = d && n.nodeValue === d.m ? d.o : n.nodeValue;
        noeuds.push(n); textes.push(o);
      }
      // 1. Les lignes entières (« toutes les annonces qui contiennent… »).
      const nouvelles = new Set();
      if (R.reLigne) for (let i = 0; i < noeuds.length; i++) if (ligneACacher(textes[i], R)) { const l = ligneDe(noeuds[i].parentElement, racine); if (l) nouvelles.add(l); }
      for (const l of lignes) if (!nouvelles.has(l)) l.removeAttribute(NOTRE_LIGNE);
      for (const l of nouvelles) if (!l.hasAttribute(NOTRE_LIGNE)) l.setAttribute(NOTRE_LIGNE, '');
      lignes.clear(); for (const l of nouvelles) lignes.add(l);
      // 2. Le texte.
      const voisins = noeuds.map((n, i) => i + 1 < noeuds.length && memeBloc(n, noeuds[i + 1]));
      const m = masquerSuiteStream(textes, voisins, R);
      for (let i = 0; i < noeuds.length; i++) {
        const n = noeuds[i];
        const v = enBloc(n.parentElement, R) ? toutMasquer(textes[i]) : m[i];
        if (v !== textes[i]) { origine.set(n, { o: textes[i], m: v }); if (n.nodeValue !== v) n.nodeValue = v; }
        else if (origine.has(n)) { if (n.nodeValue !== textes[i]) n.nodeValue = textes[i]; origine.delete(n); }
      }
      for (const n of origine.keys()) if (!n.isConnected) origine.delete(n);
      // 3. Les infobulles (`title`) : elles s'affichent au survol, à l'écran.
      const vus = new Set();
      for (const el of racine.querySelectorAll('[title]')) {
        if (el.closest('[data-stream-libre]')) continue;
        const d = titres.get(el), cur = el.getAttribute('title');
        const o = d && cur === d.m ? d.o : cur;
        const v = enBloc(el, R) ? toutMasquer(o) : masquerTexteStream(o, R);
        vus.add(el);
        if (v !== o) { titres.set(el, { o, m: v }); if (cur !== v) el.setAttribute('title', v); }
        else if (d) { if (cur !== o) el.setAttribute('title', o); titres.delete(el); }
      }
      for (const el of [...titres.keys()]) if (!vus.has(el) || !el.isConnected) titres.delete(el);
      // 4. Les champs : leur valeur n'est pas un nœud de texte — floutés (CSS).
      const champs = new Set();
      for (const c of racine.querySelectorAll('input, textarea')) {
        if (c.closest('[data-stream-libre]') || c.type === 'password' || c.type === 'checkbox' || c.type === 'radio') continue;
        const v = String(c.value || '');
        if (v && (masquerTexteStream(v, R) !== v || enBloc(c, R))) champs.add(c);
      }
      for (const c of flous) if (!champs.has(c)) c.removeAttribute(NOTRE_FLOU);
      for (const c of champs) if (!c.hasAttribute(NOTRE_FLOU)) c.setAttribute(NOTRE_FLOU, '');
      flous.clear(); for (const c of champs) flous.add(c);
    } catch (_) {
      // ⚠️ Une erreur ici ne doit jamais laisser l'écran en clair : rien d'autre à faire
      //    que repasser au prochain changement.
    } finally { if (!arrete) brancher(); }
  };
  const surSaisie = () => { if (!arrete) passer(); };
  doc.addEventListener('input', surSaisie, true);
  passer();
  return {
    repasser: passer,
    arreter() {
      arrete = true; obs.disconnect();
      doc.removeEventListener('input', surSaisie, true);
      for (const [n, d] of origine) if (n.isConnected && n.nodeValue === d.m) n.nodeValue = d.o;
      for (const [el, d] of titres) if (el.isConnected && el.getAttribute('title') === d.m) el.setAttribute('title', d.o);
      for (const l of lignes) l.removeAttribute(NOTRE_LIGNE);
      for (const c of flous) c.removeAttribute(NOTRE_FLOU);
      origine.clear(); titres.clear(); lignes.clear(); flous.clear();
    },
  };
}
