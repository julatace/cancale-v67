// ════════════════════════════════════════════════════════════════════════════
//  LA COPIE D'UN ÉCRAN — L'AFFICHAGE INSTANTANÉ (20 nov., Julien : « trop long à
//  charger », « les écrans de chargement sont atroces, ça fait vraiment appli de
//  merde »).
//
//  Chaque onglet (Aujourd'hui, Annonces, Ventes, Achats, Argent, Messages) et chaque
//  fiche s'affiche TOUT DE SUITE avec sa dernière copie connue, puis la lecture
//  réelle prend sa place, au même endroit.
//
//  CE QUI EST GARDÉ : la PROJECTION RENDUE de l'écran — ce que l'écran vrai a déjà
//  calculé et dessiné (titres, photos, N°, prix, statuts, en-têtes de groupe, la
//  bande de chiffres), relue dans son DOM une fois TOUTES ses données là, coupée
//  à deux hauteurs d'écran, NETTOYÉE (liste blanche de balises et d'attributs :
//  aucun script, aucun lien, aucun gestionnaire, aucun identifiant de document) et
//  rangée avec l'index de ses rangées (`rangees` : id, titre, photo, N°, prix,
//  statut). Jamais une ligne brute de la base, jamais un PDF (une image `data:`
//  de plus de `MAX_DATA_IMAGE` est retirée), au plus `MAX_HTML` caractères.
//
//  OÙ : IndexedDB (`vrm-copies-ecrans`), clé `vrm_copie_{owner}_{ecran}`, version
//  de schéma `SCHEMA_COPIE`, l'owner AUSSI dans la valeur (vérifié à la lecture).
//  Écrire pour un owner efface les copies de tout autre owner ; la déconnexion et
//  le changement de compte effacent tout (`effacerCopiesEcrans`, appelé par
//  `wipeLocalData` et par la fin de session). Un petit index synchrone
//  (`vrm_copie_index:{owner}` dans localStorage, préfixe `vrm_` : effacé avec les
//  données locales) dit seulement QUELS écrans ont une copie et le cadre où peindre
//  — il permet de décider avant l'app sans ouvrir la base.
//
//  ⚠️ CE QUI NE DOIT JAMAIS ARRIVER (§5) :
//   · une copie présentée comme fraîche : elle est toujours datée (« Mis à jour il
//     y a 3 min ») et se montre seulement le JOUR de sa capture (les écrans disent
//     « aujourd'hui », « ce mois », des heures sans date) ;
//   · une copie qui écrit ou décide : elle est INERTE (`inert`, aucun geste), rien
//     ne la relit pour un N°, un prix, un envoi — ce module n'exporte rien qui
//     rende une donnée à l'app, seulement du HTML à montrer ;
//   · la copie d'un autre compte : clé ET valeur portent l'owner ; une copie d'un
//     autre owner n'est jamais rendue (et part à la première écriture) ;
//   · une copie qui fige « lecture… » ou un écran à moitié lu : la capture n'a lieu
//     que l'écran PRÊT (toutes ses données essentielles), jamais au plafond, jamais
//     hors ligne ni base injoignable, et refuse un texte encore « lecture… ».
// Exécuté par scripts/tests/copie-ecran.test.mjs et scripts/bancs/copie-ecran.cjs.
// ════════════════════════════════════════════════════════════════════════════

export const SCHEMA_COPIE = 1;
export const MAX_HTML = 600000;
export const MAX_DATA_IMAGE = 40000;
export const MAX_RANGEES = 80;
const NOM_BASE = 'vrm-copies-ecrans';
const MAGASIN = 'copies';
export const PREFIXE_INDEX = 'vrm_copie_index:';
// Les écrans qui ont une copie. `fiche:<id>` pour une fiche (même règle).
export const ECRANS_COPIE = Object.freeze(['journee', 'annonces', 'ventes', 'achats', 'compta', 'messages']);
export const ecranCopiable = (e) => ECRANS_COPIE.includes(e) || /^fiche:[\w.:-]{1,80}$/.test(String(e || ''));

const propreOwner = (o) => String(o || '').replace(/[^\w-]/g, '').slice(0, 64);
export const cleCopie = (owner, ecran) => `vrm_copie_${propreOwner(owner)}_${ecran}`;

// ── Le jour local (une copie ne se montre que le jour de sa capture) ─────────
const jourIso = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// ── NETTOYAGE (liste blanche) ───────────────────────────────────────────────
// Les balises gardées. Tout le reste part avec son contenu (script, iframe, object, embed, template, canvas…).
const BALISES = new Set(['div', 'span', 'section', 'header', 'footer', 'main', 'nav', 'article', 'aside', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'li',
  'dl', 'dt', 'dd', 'b', 'strong', 'i', 'em', 'small', 'sup', 'sub', 'br', 'hr', 'img', 'picture', 'figure', 'figcaption', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th',
  'caption', 'colgroup', 'col', 'button', 'a', 'label', 'input', 'form', 'time', 'abbr', 'mark', 'output', 'progress', 'meter', 'details', 'summary', 'svg', 'g', 'path', 'circle',
  'rect', 'line', 'polyline', 'polygon', 'ellipse', 'defs', 'lineargradient', 'radialgradient', 'stop', 'use', 'symbol', 'title', 'text', 'tspan', 'clippath', 'mask', 'style', 'select', 'option', 'optgroup', 'textarea']);
// Attributs gardés (en plus de `data-*` et `aria-*` sûrs). Jamais un `on*`, un `href`, un `id`, un `for`, un `name`…
const ATTRS = new Set(['class', 'style', 'role', 'width', 'height', 'alt', 'title', 'src', 'srcset', 'sizes', 'loading', 'decoding', 'type', 'placeholder', 'value', 'checked', 'disabled', 'readonly',
  'colspan', 'rowspan', 'dir', 'lang', 'datetime', 'open', 'max', 'min', 'low', 'high', 'optimum',
  // SVG
  'viewbox', 'd', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset', 'fill-rule', 'clip-rule', 'cx', 'cy', 'r', 'rx', 'ry',
  'x', 'y', 'x1', 'x2', 'y1', 'y2', 'points', 'transform', 'opacity', 'fill-opacity', 'stroke-opacity', 'offset', 'stop-color', 'stop-opacity', 'preserveaspectratio', 'xmlns',
  'gradientunits', 'gradienttransform', 'vector-effect', 'font-size', 'font-weight', 'text-anchor', 'dominant-baseline', 'clip-path', 'mask']);
// `aria-*` qui ne désignent pas un autre élément par son identifiant.
const ARIA_OK = /^aria-(hidden|label|current|pressed|selected|checked|expanded|busy|level|valuenow|valuemin|valuemax|valuetext|roledescription|disabled|live|atomic)$/;
// Les `data-*` qui pilotent l'app (attente, démarrage, fiche…) : retirés, la copie ne doit jamais être prise pour l'écran vrai.
const DATA_INTERDITS = /^data-(attente|demarrage|fiche-ligne|fiche-paire|n-onglet|ecran$|reactroot|copie)/;
const URL_IMAGE = /^https:\/\/[^\s"'<>]+$/i;

function srcSur(v) {
  const s = String(v || '').trim();
  if (URL_IMAGE.test(s)) return s;
  if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/i.test(s) && s.length <= MAX_DATA_IMAGE) return s;
  return null;
}
// Le style en ligne : aucune `url(` (sauf rien), aucune `expression`, aucun `behavior`.
const styleSur = (v) => (/url\s*\(|expression\s*\(|behavio(u)?r\s*:|javascript:|@import/i.test(String(v || '')) ? null : String(v || ''));

// Nettoie un élément (déjà COPIÉ, hors du document) en place. Rend le nombre d'éléments retirés.
export function nettoyer(el) {
  let retires = 0;
  const pile = [el];
  while (pile.length) {
    const n = pile.pop();
    for (const c of [...n.childNodes]) {
      if (c.nodeType === 8) { c.remove(); continue; }          // commentaire
      if (c.nodeType !== 1) continue;
      const tag = String(c.localName || c.nodeName || '').toLowerCase();
      if (!BALISES.has(tag)) { c.remove(); retires++; continue; }
      if (tag === 'style' && /url\s*\(|@import|expression\s*\(/i.test(c.textContent || '')) { c.remove(); retires++; continue; }
      for (const a of [...c.attributes]) {
        const nom = a.name.toLowerCase();
        let garde = ATTRS.has(nom) || ARIA_OK.test(nom) || (nom.startsWith('data-') && !DATA_INTERDITS.test(nom));
        if (garde && (nom === 'src')) { const s = srcSur(a.value); if (s == null) garde = false; }
        if (garde && nom === 'srcset' && !String(a.value).split(',').every((p) => srcSur(p.trim().split(/\s+/)[0]) != null)) garde = false;
        if (garde && nom === 'style' && styleSur(a.value) == null) garde = false;
        if (garde && /^(javascript|vbscript|data):/i.test(String(a.value).trim()) && nom !== 'src') garde = false;
        if (!garde) c.removeAttribute(a.name);
      }
      if (tag === 'img') { c.setAttribute('loading', 'lazy'); c.setAttribute('decoding', 'async'); }
      if (tag === 'button' || tag === 'input' || tag === 'select' || tag === 'textarea') c.setAttribute('tabindex', '-1');
      pile.push(c);
    }
  }
  return retires;
}

// ── CAPTURE : l'écran PRÊT, relu dans le document ────────────────────────────
// Une valeur encore en lecture n'est jamais rangée (elle se figerait en « lecture… »).
const enLecture = (s) => /\blecture\b…?|chargement…/i.test(String(s || ''));
const txt = (el, max = 90) => (el ? String(el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, max) : '');

// L'index des rangées (la projection « données ») : ce qui a été DESSINÉ, rien de recalculé.
export function indexRangees(racine) {
  const out = [];
  if (!racine || !racine.querySelectorAll) return out;
  for (const r of racine.querySelectorAll('.n-rangee, [data-fiche-ligne], [data-eg-article], [data-tt-ligne]')) {
    if (out.length >= MAX_RANGEES) break;
    if (r.parentElement && r.parentElement.closest('.n-rangee, [data-fiche-ligne], [data-eg-article], [data-tt-ligne]')) continue;
    const img = r.querySelector('img');
    const plaque = r.querySelector('.n-plaque, [data-fiche-num], .vrm-num');
    out.push({
      id: String(r.getAttribute('data-fiche-ligne') || r.getAttribute('data-eg-article') || r.getAttribute('data-tt-ligne') || r.getAttribute('data-copie-id') || '').slice(0, 80),
      titre: txt(r.querySelector('.n-rangee-titre, [data-titre]') || r, 90),
      photo: img ? (srcSur(img.getAttribute('src')) || '') : '',
      num: txt(plaque, 12).replace(/^N°\s*/, ''),
      prix: txt(r.querySelector('.n-rangee-valeur, [data-prix]'), 20),
      statut: txt(r.querySelector('.n-pastille, .n-rangee-sous'), 60),
    });
  }
  return out;
}

// Copie à deux pistes d'un sous-arbre : on ne descend pas dans ce que `coupe(el)` écarte (sous la coupe, caché, hors
// de la fenêtre) ; les briques de squelette et ce qui est marqué `data-copie-exclure` ne sont jamais copiés.
function copierElague(src, coupe, marquer = null) {
  const dst = src.cloneNode(false);
  if (marquer) marquer(src, dst);
  for (const c of src.childNodes) {
    if (c.nodeType === 3) { dst.appendChild(c.cloneNode(false)); continue; }
    if (c.nodeType !== 1) continue;
    if (c.hasAttribute('data-copie-exclure') || c.hasAttribute('data-copie-ecran') || c.classList.contains('vrm-sq-barre') || c.classList.contains('n-os')) continue;
    if (coupe(c)) continue;
    dst.appendChild(copierElague(c, coupe, marquer));
  }
  return dst;
}
const cacheParStyle = (el, r) => r.width === 0 && r.height === 0 && getComputedStyle(el).display === 'none';
// La page est-elle tout en haut ? (la copie de la COQUE n'est prise qu'ainsi : peinte avant l'app, elle l'est en haut)
export function pageEnHaut(racine) {
  try {
    if ((window.scrollY || 0) > 1) return false;
    for (let e = racine; e && e !== document.body; e = e.parentElement) if (e.scrollTop > 1) return false;
    return true;
  } catch (_) { return false; }
}

// `racine` : l'écran VRAI prêt (le conteneur visible de l'attente). Rend la copie, ou null (rien à ranger).
//   · coupée à `hauteur` px sous son haut (deux écrans par défaut) : une rangée plus bas n'est pas copiée ;
//   · `coque` (facultatif) : la racine de l'app (`.vrm-app-shell`) — sa copie VISIBLE (la fenêtre seulement : barre
//     du haut, grand titre, l'écran, barre d'onglets) sert à peindre l'écran AVANT que l'app soit chargée
//     (src/OuvertureInstantanee.jsx). Prise seulement page en haut ; sinon `coque` est null.
export function capturerCopie(racine, { owner, ecran, maintenant = Date.now(), hauteur = 0, largeur = 0, theme = '', cadre = null, coque = null } = {}) {
  if (!racine || !owner || !ecranCopiable(ecran) || typeof document === 'undefined') return null;
  if (racine.closest && racine.closest('[data-apercu], .vrm-attente-cache, [data-copie-ecran]')) return null;
  // Un squelette encore là (une partie de l'écran attend) : rien n'est rangé.
  if (racine.querySelector('.n-os, .vrm-squelette, .vrm-sq-barre')) return null;
  const vh = (typeof window !== 'undefined' ? window.innerHeight : 800) || 800;
  const vw = (typeof window !== 'undefined' ? window.innerWidth : 390) || 390;
  const H = hauteur || Math.max(600, vh * 2);
  const haut0 = racine.getBoundingClientRect().top;
  let clone;
  try { clone = copierElague(racine, (el) => { const r = el.getBoundingClientRect(); return r.top - haut0 > H || cacheParStyle(el, r); }); } catch (_) { return null; }
  if (enLecture(clone.textContent || '')) return null;
  nettoyer(clone);
  // Le CONTENU du conteneur de l'écran (la copie se peint dans un conteneur de la même classe).
  const html = clone.innerHTML;
  if (!html || html.length > MAX_HTML) return null;
  let copieCoque = null;
  if (coque && coque.contains(racine) && pageEnHaut(racine)) {
    try {
      const cc = copierElague(coque, (el) => { const r = el.getBoundingClientRect(); if (cacheParStyle(el, r)) return true; if (r.width === 0 && r.height === 0) return false; return r.top >= vh || r.bottom <= 0 || r.left >= vw || r.right <= 0; },
        (src, dst) => { if (src === racine) dst.classList.add('vrm-copie-zone'); });
      nettoyer(cc);
      const h = cc.outerHTML;
      if (h && h.length <= MAX_HTML && h.includes('vrm-copie-zone')) copieCoque = { html: h, vw: Math.round(vw), vh: Math.round(vh) };
    } catch (_) { copieCoque = null; }
  }
  return {
    v: SCHEMA_COPIE, owner: String(owner), ecran, t: maintenant, jour: jourIso(maintenant),
    largeur: Math.round(largeur || 0), theme: String(theme || ''), hauteur: Math.round(Math.min(H, racine.getBoundingClientRect().height || 0)),
    html, rangees: indexRangees(racine), cadre: cadre || null, coque: copieCoque,
  };
}

// ── CE QUI SE MONTRE ────────────────────────────────────────────────────────
// La copie brute de CET écran pour CET owner, montrable MAINTENANT (même jour, même largeur à 2 px près), ou null.
export function copieMontrable(c, { owner, ecran, maintenant = Date.now(), largeur = 0 } = {}) {
  if (!c || typeof c !== 'object' || c.v !== SCHEMA_COPIE) return null;
  if (!owner || String(c.owner || '') !== String(owner)) return null;
  if (c.ecran !== ecran) return null;
  const t = Number(c.t);
  if (!Number.isFinite(t) || t > maintenant + 60000) return null;
  if (c.jour !== jourIso(maintenant)) return null;
  if (largeur && c.largeur && Math.abs(c.largeur - largeur) > 2) return null;
  if (typeof c.html !== 'string' || !c.html || c.html.length > MAX_HTML) return null;
  return c;
}
export const ageCopieMin = (c, maintenant = Date.now()) => Math.max(0, Math.floor((maintenant - Number(c && c.t)) / 60000));

// ── LE STOCKAGE (IndexedDB ; une mémoire pour les tests) ────────────────────
export function stockageMemoireCopies() {
  const m = new Map();
  return {
    m,
    async lire(owner, ecran) { const e = m.get(cleCopie(owner, ecran)); return e && e.owner === String(owner) ? JSON.parse(JSON.stringify(e)) : null; },
    async ecrire(c) { for (const [k, e] of [...m]) if (e.owner !== c.owner) m.delete(k); m.set(cleCopie(c.owner, c.ecran), JSON.parse(JSON.stringify(c))); return true; },
    async effacer() { m.clear(); },
  };
}
export function stockageIdbCopies(idb = (typeof indexedDB !== 'undefined' ? indexedDB : null)) {
  let ouverte = null;
  const ouvrir = () => {
    if (!idb) return Promise.resolve(null);
    if (ouverte) return ouverte;
    ouverte = new Promise((ok) => {
      try {
        const rq = idb.open(NOM_BASE, 1);
        rq.onupgradeneeded = () => { try { rq.result.createObjectStore(MAGASIN, { keyPath: 'k' }); } catch (_) {} };
        rq.onsuccess = () => { const db = rq.result; try { db.onversionchange = () => { try { db.close(); } catch (_) {} ouverte = null; }; } catch (_) {} ok(db); };
        rq.onerror = () => ok(null);
        rq.onblocked = () => ok(null);
      } catch (_) { ok(null); }
    }).then((db) => { if (!db) ouverte = null; return db; });
    return ouverte;
  };
  const tx = async (mode, f) => {
    const db = await ouvrir();
    if (!db) return null;
    return new Promise((ok) => {
      try {
        const t = db.transaction(MAGASIN, mode);
        const res = f(t.objectStore(MAGASIN));
        t.oncomplete = () => ok(res);
        t.onerror = () => ok(null);
        t.onabort = () => ok(null);
      } catch (_) { ok(null); }
    });
  };
  return {
    async lire(owner, ecran) {
      const box = { v: null };
      await tx('readonly', (s) => { const rq = s.get(cleCopie(owner, ecran)); rq.onsuccess = () => { const e = rq.result; box.v = e && e.owner === String(owner) ? e : null; }; return box; });
      return box.v;
    },
    async ecrire(c) {
      const r = await tx('readwrite', (s) => {
        // Un seul compte VRM sur l'appareil : les copies d'un autre owner partent.
        const cur = s.openCursor();
        cur.onsuccess = () => { const x = cur.result; if (!x) return; if (!x.value || x.value.owner !== c.owner) x.delete(); x.continue(); };
        s.put({ ...c, k: cleCopie(c.owner, c.ecran) });
        return true;
      });
      return !!r;
    },
    async effacer() {
      try { const db = await ouverte; if (db) db.close(); } catch (_) {}
      ouverte = null;
      if (!idb) return;
      await new Promise((ok) => { try { const rq = idb.deleteDatabase(NOM_BASE); rq.onsuccess = rq.onerror = rq.onblocked = () => ok(); } catch (_) { ok(); } });
    },
  };
}
let _stock = null;
export function stockageCopies() {
  if (_stock) return _stock;
  try { _stock = (typeof indexedDB !== 'undefined' && indexedDB) ? stockageIdbCopies() : stockageMemoireCopies(); } catch (_) { _stock = stockageMemoireCopies(); }
  return _stock;
}
export function poserStockageCopies(s) { _stock = s; }

// ── L'INDEX SYNCHRONE (localStorage) : quels écrans ont une copie, et leur cadre ──
const lsDe = () => { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (_) { return null; } };
export function lireIndexCopies(owner, ls = lsDe()) {
  if (!ls || !owner) return {};
  try { const j = JSON.parse(ls.getItem(PREFIXE_INDEX + propreOwner(owner)) || 'null'); return j && typeof j === 'object' && j.owner === String(owner) ? (j.ecrans || {}) : {}; } catch (_) { return {}; }
}
function noterIndex(c, ls = lsDe()) {
  if (!ls) return;
  try {
    for (let i = ls.length - 1; i >= 0; i--) { const k = ls.key(i); if (k && k.startsWith(PREFIXE_INDEX) && k !== PREFIXE_INDEX + propreOwner(c.owner)) ls.removeItem(k); }
    const ecrans = { ...lireIndexCopies(c.owner, ls) };
    if (!String(c.ecran).startsWith('fiche:')) ecrans[c.ecran] = { t: c.t, jour: c.jour, largeur: c.largeur, theme: c.theme, coque: !!(c.coque && c.coque.html) };
    ls.setItem(PREFIXE_INDEX + propreOwner(c.owner), JSON.stringify({ owner: c.owner, ecrans }));
  } catch (_) {}
}

// Écrire une copie (après capture). Les écritures se suivent ; une copie identique n'est pas réécrite.
const _derniere = new Map();
export async function ecrireCopie(c, stock = stockageCopies()) {
  if (!c || !c.owner || !ecranCopiable(c.ecran) || c.v !== SCHEMA_COPIE) return false;
  const cle = cleCopie(c.owner, c.ecran);
  const empreinte = c.html.length + ':' + (c.coque ? c.coque.html.length : 0) + ':' + c.html.slice(0, 200) + c.html.slice(-400);
  if (_derniere.get(cle) === empreinte + c.jour) return true;
  // Prise plus bas dans la page, la copie n'a pas de COQUE : celle du jour, déjà rangée, reste (rien ne la perd).
  if (!c.coque) { try { const old = await stock.lire(c.owner, c.ecran); if (old && old.coque && old.jour === c.jour && old.owner === c.owner) c = { ...c, coque: old.coque }; } catch (_) {} }
  const ok = await stock.ecrire(c).catch(() => false);
  if (ok) { _derniere.set(cle, empreinte + c.jour); noterIndex(c); }
  return !!ok;
}
// Lire la copie montrable (null si aucune, d'un autre owner, d'un autre jour, d'une autre largeur).
export async function lireCopie(owner, ecran, { maintenant = Date.now(), largeur = 0, stock = stockageCopies() } = {}) {
  if (!owner || !ecranCopiable(ecran)) return null;
  const c = await stock.lire(owner, ecran).catch(() => null);
  return copieMontrable(c, { owner, ecran, maintenant, largeur });
}
// Tout effacer (déconnexion, changement de compte, aperçu sans abonnement).
export function effacerCopiesEcrans({ ls = lsDe(), stock = null } = {}) {
  _derniere.clear();
  _memoire.clear();
  try { if (ls) for (let i = ls.length - 1; i >= 0; i--) { const k = ls.key(i); if (k && k.startsWith(PREFIXE_INDEX)) ls.removeItem(k); } } catch (_) {}
  try { return (stock || stockageCopies()).effacer().catch(() => {}); } catch (_) { return Promise.resolve(); }
}

// ── La mémoire de la page : la copie lue une fois, rendue tout de suite au rendu suivant ──
const _memoire = new Map();
export function copieEnMemoire(owner, ecran) { return _memoire.get(cleCopie(owner, ecran)) || null; }
export async function prechargerCopie(owner, ecran, opts = {}) {
  const c = await lireCopie(owner, ecran, opts);
  if (c) _memoire.set(cleCopie(owner, ecran), c); else _memoire.delete(cleCopie(owner, ecran));
  return c;
}
// Toutes les copies de l'index (au démarrage de la coque : chaque onglet a la sienne prête avant le toucher).
export async function prechargerCopies(owner, opts = {}) {
  const idx = lireIndexCopies(owner);
  await Promise.all(Object.keys(idx).filter((e) => ECRANS_COPIE.includes(e)).map((e) => prechargerCopie(owner, e, opts)));
}
