// ── LE MODE STREAM (15 octobre) ───────────────────────────────────────────────
// Julien : « mets un mode stream pour les influenceurs, il faut cacher leurs
// données sensibles comme leur CA ou leur nom de compte ».
//
// ⚠️⚠️ UN SEUL MÉCANISME, AU NIVEAU DU DOCUMENT — PAS ÉCRAN PAR ÉCRAN.
//    L'app compte ~40 000 lignes et des dizaines de façons d'écrire un montant
//    (`eur()` locaux, `toFixed(2)`, `{n} €` coupé en deux nœuds de texte…).
//    Masquer écran par écran, c'est garantir qu'un écran oublié laissera passer
//    le CA en direct. Ici, un observateur du document réécrit le TEXTE AFFICHÉ
//    (nœuds de texte, infobulles, libellés lus par le lecteur d'écran,
//    textes indicatifs) au moment où il apparaît, quel que soit l'écran qui l'a
//    produit — y compris un écran pas encore écrit.
//
// Ce qui est masqué, et comment :
//   • les MONTANTS (« 1 234,56 € », « € 12 », « 45 » suivi d'un nœud « € »)
//     → « ••• € » — la grandeur ne fuit pas non plus ;
//   • les adresses email, les téléphones, les IBAN, les SIREN/SIRET et les
//     identifiants longs (≥ 9 chiffres : compte, transaction), les n° de suivi,
//     les codes postaux suivis d'une ville, les adresses de rue ;
//   • les NOMS DE SES COMPTES (login, nom donné, email, téléphone) → un ALIAS
//     STABLE (« Compte 1 », « Compte eBay 2 ») : sur neuf comptes il doit
//     toujours savoir SUR LEQUEL agir (CLAUDE.md §5, Achats) — masquer sans alias
//     ferait perdre le geste ;
//   • son prénom, sa ville, son entreprise, les codes de retrait connus ;
//   • ce que l'app MARQUE comme privé (`data-stream="prive"` : texte d'un
//     message, nom ou adresse d'un acheteur, code de retrait, QR) → « ••• », et
//     les chiffres d'un graphique (`data-stream="chiffres"`).
// Les numéros de rangement, les dates, les comptes de ventes et les titres des
// annonces restent lisibles : c'est ce qu'un streamer MONTRE.
//
// ⚠️ ON NE TOUCHE JAMAIS À LA VALEUR D'UN CHAMP DE SAISIE. La changer, c'est la
//    renvoyer à React au prochain `onChange` — un email deviendrait « •••@••• »
//    EN BASE. Un champ sensible est flouté par une classe (`data-stream-flou`),
//    sa valeur reste intacte.
// ⚠️ On ne retire ni n'insère jamais de nœud : React garde ses références et
//    réécrit `nodeValue` à la mise à jour suivante ; l'observateur remasque avant
//    l'affichage (les rappels d'un MutationObserver passent avant le rendu).
//
// Le réglage est SYNCHRONISÉ (`vrm_mode_stream`, ligne `main`) : allumé sur
// l'ordinateur du live, il l'est aussi sur le téléphone posé à côté.

export const CLE_STREAM = 'vrm_mode_stream';
export const MASQUE = '•••';

const ESP = '[ \\u00a0\\u202f]';
const NOMBRE = `(?:\\d{1,3}(?:${ESP}\\d{3})+(?:[.,]\\d{1,2})?|\\d{1,3}(?:\\.\\d{3})+(?:,\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)`;
const DEVISE_APRES = `(?:€|EUR\\b|euros?\\b|\\$|£|k€)`;
// Un montant : signe facultatif, nombre, espace facultative, devise — ou la
// devise devant.
const RE_MONTANT_APRES = new RegExp(`(?:[+\\-−]${ESP}?)?${NOMBRE}(?:${ESP}?[kK](?=${ESP}?€))?${ESP}?${DEVISE_APRES}`, 'g');
const RE_MONTANT_AVANT = new RegExp(`(?:€|\\$|£)${ESP}?[+\\-−]?${NOMBRE}`, 'g');
const RE_EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const RE_TEL = /(?<![\d])(?:\+33[\s.]?\(?0?\)?[\s.]?[1-9]|0[1-9])(?:[\s.-]?\d{2}){4}(?![\d])/g;
const RE_IBAN = /\b[A-Z]{2}\d{2}(?:[ ]?[0-9A-Z]{4}){3,7}(?:[ ]?[0-9A-Z]{1,4})?\b/g;
const RE_SIRET = /(?<![\d])\d{3}[ \u00a0]\d{3}[ \u00a0]\d{3}(?:[ \u00a0]\d{5})?(?![\d])/g;
const RE_LONG = /(?<![\w])\d{9,}(?![\w])/g;
// Un n° de suivi : 10 caractères ou plus, majuscules et chiffres, au moins 6
// chiffres (« XW476115185SP », « VGS… », « 6A12345678901 »).
const RE_SUIVI = /(?<![\w])(?=[A-Z0-9]{10,}(?![\w]))(?=(?:[A-Z]*\d){6})[A-Z0-9]+(?![\w])/g;
// Code postal suivi d'une ville (« 35260 Cancale »).
const RE_CP = /(?<![\d])\d{5}(?=[ \u00a0]+[A-ZÀ-Ý][\p{L}'’ -]{2,})/gu;
// Une adresse de rue (« 12 rue des Lilas », « 4 bis avenue Foch »).
const RE_RUE = /(?<![\w])\d{1,4}(?:[ \u00a0]?(?:bis|ter))?,?[ \u00a0]+(?:rue|avenue|av\.|boulevard|bd|chemin|allée|allee|impasse|place|route|quai|cours|square|lieu-dit|résidence|residence|chaussée|chaussee|voie)\b[^\n,;·]{2,40}/giu;

const echap = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ── LE DICTIONNAIRE : ses noms → leur alias ───────────────────────────────────
// `sources[nom] = [{ alias, valeurs: [...] }]`. Plusieurs sources (comptes
// Vinted, comptes eBay, identité, codes de retrait) : chacune remplacée en
// entier par son propriétaire, jamais fusionnée à l'aveugle.
const sources = Object.create(null);
let dico = new Map();        // valeur en minuscules → alias
let reDico = null;

function reconstruire() {
  const m = new Map();
  for (const nom of Object.keys(sources)) {
    for (const e of sources[nom]) {
      for (const v of e.valeurs || []) {
        const s = String(v == null ? '' : v).trim();
        // Trop court, c'est un mot courant (« Pro », « Jo ») : on masquerait le
        // texte de l'app autour de lui. Un code de retrait passe par sa propre
        // source et tient déjà ≥ 5 caractères.
        if (s.length < 3) continue;
        const k = s.normalize('NFC').toLowerCase();
        if (!m.has(k)) m.set(k, e.alias || MASQUE);
      }
    }
  }
  dico = m;
  const cles = [...m.keys()].sort((a, b) => b.length - a.length);
  reDico = cles.length ? new RegExp(`(?<![\\p{L}\\p{N}_])(?:${cles.map(echap).join('|')})(?![\\p{L}\\p{N}_])`, 'giu') : null;
}

// Pour un audit : le texte masqué, sans DOM. `noms` (facultatif) remplace le
// dictionnaire courant le temps de l'appel.
export function masquerTexte(texte, noms) {
  let t = String(texte == null ? '' : texte);
  if (!t || !/[\p{L}\p{N}@€$£]/u.test(t)) return t;
  let re = reDico, d = dico;
  if (noms) {
    d = new Map(); for (const n of noms) { const s = String(n.valeur || '').trim(); if (s.length >= 3) d.set(s.normalize('NFC').toLowerCase(), n.alias || MASQUE); }
    const cles = [...d.keys()].sort((a, b) => b.length - a.length);
    re = cles.length ? new RegExp(`(?<![\\p{L}\\p{N}_])(?:${cles.map(echap).join('|')})(?![\\p{L}\\p{N}_])`, 'giu') : null;
  }
  // Les emails d'abord : un login peut être le début d'une adresse.
  t = t.replace(RE_EMAIL, `${MASQUE}@${MASQUE}`);
  if (re) t = t.normalize('NFC').replace(re, (m) => d.get(m.toLowerCase()) || MASQUE);
  t = t.replace(RE_IBAN, (m) => (/\d{2}/.test(m.slice(2, 4)) && m.replace(/\s/g, '').length >= 15 ? MASQUE : m));
  t = t.replace(RE_RUE, MASQUE);
  t = t.replace(RE_CP, '•••••');
  t = t.replace(RE_MONTANT_AVANT, (m) => `${m[0]} ${MASQUE}`);
  t = t.replace(RE_MONTANT_APRES, (m) => { const dev = /€|k€/.test(m) ? '€' : (/\$/.test(m) ? '$' : (/£/.test(m) ? '£' : '€')); return `${MASQUE} ${dev}`; });
  t = t.replace(RE_TEL, '•• •• •• •• ••');
  t = t.replace(RE_SIRET, MASQUE);
  t = t.replace(RE_SUIVI, MASQUE);
  t = t.replace(RE_LONG, MASQUE);
  return t;
}
// Tous les chiffres d'un texte (graphiques : `data-stream="chiffres"`).
export const masquerChiffres = (t) => String(t).replace(/[+\-−]?\d(?:[\d \u00a0\u202f.,]*\d)?/g, '••');
// Tout le texte (`data-stream="prive"`), en gardant les blancs autour.
export const masquerTout = (t) => String(t).replace(/\S(?:[\s\S]*\S)?/, MASQUE);

// ── L'ÉTAT ────────────────────────────────────────────────────────────────────
let actif = false;
const abonnes = new Set();
export const streamActif = () => actif;
export const abonnerStream = (fn) => { abonnes.add(fn); return () => abonnes.delete(fn); };
// Un texte destiné à sortir de la page (notification du navigateur, boîte du
// système) : masqué seulement si le mode est allumé.
export const textePublic = (t) => (actif ? masquerTexte(t) : t);

export function definirNoms(source, entrees) {
  const avant = JSON.stringify(sources[source] || []);
  sources[source] = (entrees || []).filter((e) => e && Array.isArray(e.valeurs));
  if (JSON.stringify(sources[source]) === avant) return;
  reconstruire();
  if (actif && typeof document !== 'undefined') passeComplete();
}
// Un code de retrait vu par l'app (`codeRetrait`) : noté pour être masqué
// partout où il s'écrit. ≥ 5 caractères : en dessous il croiserait un N°.
const codesVus = new Set();
let codesTimer = null;
export function noterValeurSensible(v) {
  const s = String(v || '').trim();
  if (s.length < 5 || codesVus.has(s)) return;
  codesVus.add(s);
  if (codesTimer) return;
  // Regroupé : un écran qui affiche 20 codes ne reconstruit qu'une fois.
  codesTimer = setTimeout(() => { codesTimer = null; definirNoms('codes', [{ alias: MASQUE, valeurs: [...codesVus] }]); }, 0);
  // Mais le premier rendu ne doit pas laisser passer le code : on l'ajoute
  // tout de suite au dictionnaire courant.
  dico.set(s.toLowerCase(), MASQUE);
  const cles = [...dico.keys()].sort((a, b) => b.length - a.length);
  reDico = new RegExp(`(?<![\\p{L}\\p{N}_])(?:${cles.map(echap).join('|')})(?![\\p{L}\\p{N}_])`, 'giu');
}

// ── LE DOCUMENT ───────────────────────────────────────────────────────────────
const ATTRS = ['title', 'aria-label', 'placeholder', 'alt'];
const SAUTER = /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|TEMPLATE)$/;
let etats = new WeakMap();      // nœud de texte → { orig, masque }
let etatsAttr = new WeakMap();  // élément → Map(attr → { orig, masque })
let obs = null;

function contexte(el) {
  const z = el && el.closest ? el.closest('[data-stream]') : null;
  return z ? z.getAttribute('data-stream') : '';
}
// Le début du texte suivant, dans l'ordre du document : « 45 » puis « € »
// sont souvent deux nœuds (`{n} €` en JSX, ou `<b>45</b> €`).
function texteVoisin(n, sens) {
  try {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    w.currentNode = n;
    for (let i = 0; i < 4; i++) {
      const x = sens > 0 ? w.nextNode() : w.previousNode();
      if (!x) return '';
      const v = x.nodeValue || '';
      if (v.trim()) return sens > 0 ? v.replace(/^[\s\u00a0\u202f]+/, '').slice(0, 4) : v.replace(/[\s\u00a0\u202f]+$/, '').slice(-4);
    }
  } catch (_) {}
  return '';
}
// Les deux textes non vides qui précèdent (rognés), dans l'ordre du document.
function textesAvant(n) {
  const out = [];
  try {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    w.currentNode = n;
    for (let i = 0; i < 6 && out.length < 2; i++) { const x = w.previousNode(); if (!x) break; const v = (x.nodeValue || '').trim(); if (v) out.push(v); }
  } catch (_) {}
  while (out.length < 2) out.push('');
  return out;
}
const FIN_NOMBRE = new RegExp(`(?:[+\\-−]${ESP}?)?${NOMBRE}${ESP}*$`);
const DEBUT_NOMBRE = new RegExp(`^${ESP}*[+\\-−]?${NOMBRE}`);
function masquerNoeud(orig, n) {
  const el = n.parentElement;
  const z = contexte(el);
  if (z === 'prive') return masquerTout(orig);
  if (z === 'chiffres') return masquerChiffres(masquerTexte(orig));
  let t = masquerTexte(orig);
  // Un nombre seul dont le nœud suivant commence par une devise.
  if (/\d[\s\u00a0\u202f]*$/.test(t) && /^(?:€|EUR|euro|\$|£|k€)/.test(texteVoisin(n, 1))) t = t.replace(FIN_NOMBRE, (m) => MASQUE + (/\s$/.test(m) ? ' ' : ''));
  // La devise DEVANT, dans un nœud à elle seule (`€{n}`). ⚠️ Pas « un nœud qui
  // finit par € » : « marge +12 € » suivi de « 👁 40 » masquait les vues.
  //    Et pas non plus un « € » qui TERMINE le montant d'avant (« 456 » « € »
  //    « 40 vues ») : seulement un « € » qui ne suit pas lui-même un nombre.
  if (/^[\s\u00a0\u202f]*[+\-−]?\d/.test(t)) {
    const [p1, p2] = textesAvant(n);
    if (/^(?:€|\$|£)$/.test(p1) && !/[\d•]$/.test(p2)) t = t.replace(DEBUT_NOMBRE, (m) => (/^\s/.test(m) ? ' ' : '') + MASQUE);
  }
  return t;
}

function traiterTexte(n) {
  if (!n || n.nodeType !== 3) return;
  const el = n.parentElement;
  if (!el || SAUTER.test(el.tagName) || el.isContentEditable) return;
  const st = etats.get(n);
  const courant = n.nodeValue;
  const orig = st && courant === st.masque ? st.orig : courant;
  const m = masquerNoeud(orig, n);
  if (m !== orig) {
    if (courant !== m) n.nodeValue = m;
    etats.set(n, { orig, masque: m });
  } else if (st) {
    if (courant !== orig) n.nodeValue = orig;
    etats.delete(n);
  }
}
function traiterAttr(el, a) {
  if (!el || !el.getAttribute) return;
  const v = el.getAttribute(a);
  let carte = etatsAttr.get(el);
  const st = carte && carte.get(a);
  if (v == null) { if (carte) carte.delete(a); return; }
  const orig = st && v === st.masque ? st.orig : v;
  const z = contexte(el);
  const m = z === 'prive' ? (orig.trim() ? MASQUE : orig) : z === 'chiffres' ? masquerChiffres(masquerTexte(orig)) : masquerTexte(orig);
  if (m !== orig) {
    if (v !== m) el.setAttribute(a, m);
    if (!carte) { carte = new Map(); etatsAttr.set(el, carte); }
    carte.set(a, { orig, masque: m });
  } else if (st) {
    if (v !== orig) el.setAttribute(a, orig);
    carte.delete(a);
  }
}
// Un champ de saisie : flouté s'il montre une donnée sensible. Sa VALEUR n'est
// jamais touchée (voir l'en-tête).
function traiterChamp(el) {
  if (!el || !/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
  const type = (el.getAttribute('type') || '').toLowerCase();
  if (/^(checkbox|radio|button|submit|range|color|file|hidden|date|time|month|week|datetime-local)$/.test(type)) return;
  let flou = false;
  if (el.tagName === 'SELECT') {
    flou = contexte(el) === 'prive';
  } else {
    const v = String(el.value || '');
    if (v) {
      const mode = (el.getAttribute('inputmode') || '').toLowerCase();
      flou = contexte(el) === 'prive' || type === 'email' || type === 'tel' || mode === 'decimal' || mode === 'email' || mode === 'tel'
        || el.getAttribute('data-stream') === 'champ' || masquerTexte(v) !== v;
    }
  }
  if (flou) { if (!el.hasAttribute('data-stream-flou')) el.setAttribute('data-stream-flou', ''); }
  else if (el.hasAttribute('data-stream-flou')) el.removeAttribute('data-stream-flou');
}
function traiterSousArbre(racine) {
  if (!racine) return;
  if (racine.nodeType === 3) { traiterTexte(racine); return; }
  if (racine.nodeType !== 1 && racine.nodeType !== 9 && racine.nodeType !== 11) return;
  const base = racine.nodeType === 9 ? racine.body : racine;
  if (!base) return;
  if (base.nodeType === 1 && SAUTER.test(base.tagName) && base.tagName !== 'TEXTAREA') return;
  const w = document.createTreeWalker(base, NodeFilter.SHOW_TEXT);
  let x; while ((x = w.nextNode())) traiterTexte(x);
  const els = base.nodeType === 1 ? [base, ...base.querySelectorAll('[title],[aria-label],[placeholder],[alt],input,textarea,select')] : [...base.querySelectorAll('[title],[aria-label],[placeholder],[alt],input,textarea,select')];
  for (const el of els) {
    for (const a of ATTRS) if (el.hasAttribute && el.hasAttribute(a)) traiterAttr(el, a);
    traiterChamp(el);
  }
}
function passeComplete() { if (document.body) traiterSousArbre(document.body); }

function restaurer() {
  if (!document.body) return;
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let x;
  while ((x = w.nextNode())) { const st = etats.get(x); if (st && x.nodeValue === st.masque) x.nodeValue = st.orig; }
  for (const el of document.querySelectorAll('[title],[aria-label],[placeholder],[alt]')) {
    const carte = etatsAttr.get(el); if (!carte) continue;
    for (const [a, st] of carte) if (el.getAttribute(a) === st.masque) el.setAttribute(a, st.orig);
  }
  for (const el of document.querySelectorAll('[data-stream-flou]')) el.removeAttribute('data-stream-flou');
  etats = new WeakMap(); etatsAttr = new WeakMap();
}

const STYLE = `
html[data-mode-stream] [data-stream-flou]{filter:blur(6px)!important}
html[data-mode-stream] [data-stream="prive"] img,html[data-mode-stream] [data-stream="prive"] canvas,html[data-mode-stream] img[data-stream="prive"],html[data-mode-stream] img[data-qr]{filter:blur(14px)!important}
`;
function poserStyle() {
  if (document.getElementById('vrm-stream-style')) return;
  const s = document.createElement('style'); s.id = 'vrm-stream-style'; s.textContent = STYLE;
  (document.head || document.documentElement).appendChild(s);
}
const surSaisie = (e) => traiterChamp(e && e.target);

// Les sorties hors de la page : boîtes du système et documents ouverts.
let natifs = null;
function brancherSorties() {
  if (natifs || typeof window === 'undefined') return;
  natifs = { alert: window.alert, confirm: window.confirm, prompt: window.prompt, open: window.open };
  window.alert = function (m) { return natifs.alert.call(window, textePublic(m)); };
  window.confirm = function (m) { return natifs.confirm.call(window, textePublic(m)); };
  window.prompt = function (m, d) { return natifs.prompt.call(window, textePublic(m), d); };
  // ⚠️ Un document ouvert dans un nouvel onglet (bordereau, facture, reçu,
  //    rapport imprimable) n'est PAS dans cette page : l'observateur n'y entre
  //    pas. Il montre les vraies données (adresse de l'acheteur, montants) —
  //    on le dit AVANT de l'ouvrir. Un site extérieur (vinted.fr…) n'est pas
  //    concerné : VRM ne le dessine pas.
  window.open = function (url, ...reste) {
    const u = String(url == null ? '' : url);
    if (actif && (u === '' || u === 'about:blank' || /^blob:|^data:/i.test(u))) {
      const ok = natifs.confirm.call(window, "Mode stream : ce document montre tes vraies données (montants, adresses, noms). L'ouvrir quand même ?");
      if (!ok) return null;
    }
    return natifs.open.call(window, url, ...reste);
  };
}

export function activerStream(on) {
  const v = !!on;
  if (typeof document === 'undefined') { actif = v; return; }
  if (v === actif && (!v || obs)) return;
  actif = v;
  brancherSorties();
  if (v) {
    poserStyle();
    document.documentElement.setAttribute('data-mode-stream', '');
    passeComplete();
    obs = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'characterData') traiterTexte(m.target);
        else if (m.type === 'childList') { m.addedNodes.forEach(traiterSousArbre); if (m.target && m.target.nodeType === 1 && /^(INPUT|TEXTAREA)$/.test(m.target.tagName)) traiterChamp(m.target); }
        else if (m.type === 'attributes') {
          if (ATTRS.includes(m.attributeName)) traiterAttr(m.target, m.attributeName);
          else if (m.attributeName === 'value') traiterChamp(m.target);
          else if (m.attributeName === 'data-stream') traiterSousArbre(m.target);
        }
      }
    });
    obs.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS, 'value', 'data-stream'] });
    document.addEventListener('input', surSaisie, true);
    document.addEventListener('change', surSaisie, true);
    document.addEventListener('focusin', surSaisie, true);
  } else {
    if (obs) { obs.disconnect(); obs = null; }
    document.removeEventListener('input', surSaisie, true);
    document.removeEventListener('change', surSaisie, true);
    document.removeEventListener('focusin', surSaisie, true);
    document.documentElement.removeAttribute('data-mode-stream');
    restaurer();
  }
  abonnes.forEach((fn) => { try { fn(actif); } catch (_) {} });
}

// Au chargement du module : la valeur de CET appareil, avant le premier rendu
// des données (le nuage, lui, arrive ~500 ms plus tard et passe par
// `onCloudReady`).
export function demarrerStream() {
  try { activerStream(JSON.parse(localStorage.getItem(CLE_STREAM) || 'false') === true); } catch (_) {}
}
