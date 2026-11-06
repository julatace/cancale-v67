// ═══════════════════════════════════════════════════════════════════════════
//  BANC : FINITION — textes, accessibilité, grand texte, mode sombre (6 nov., v36-finition)
//  npm run build && BANC_PORT=12500 CAPTURES=/tmp/fin node scripts/bancs/finition.cjs
//    ECRANS=journee,ventes  VUES=390-clair,390-grand150  RAPPORT=/tmp/fin/rapport.json
// ═══════════════════════════════════════════════════════════════════════════
// L'app RENDUE sur le monde INVENTÉ des films (`scripts/films/_monde.cjs` : 3 comptes Vinted,
// Leboncoin, eBay, Vestiaire, colis, codes, e-mails — aucune donnée réelle, dépôt public),
// écran par écran, à 390 tactile et 1512, clair et sombre, et au téléphone en GRAND TEXTE
// (taille de police racine du navigateur à 120 % et 150 % : le réglage « texte plus grand »
// d'un navigateur ; l'app le traduit en échelle, `src/grandTexte.js`). Pour chaque vue :
//
//  TEXTES (tous les nœuds de texte visibles, aria-label et title compris)
//   T1 aucun « 1 ventes » : 0 ou 1 suivi d'un nom au pluriel, ni ≥ 2 suivi d'un nom au
//      singulier (liste fermée des noms de l'app) ;
//   T2 aucun espace manquant ou sécable avant « € » (« 12€ », « 12 € » à l'espace ordinaire :
//      le « € » peut passer seul à la ligne) ;
//   T3 aucun « n/d », aucun « undefined », « NaN », « null », « [object Object] » ;
//   T4 aucun « ... » (trois points) : « … ».
//  ACCESSIBILITÉ
//   A1 chaque bouton, lien, champ, case, interrupteur visible a un nom accessible ;
//   A2 au téléphone, chaque cible (bouton, lien hors d'une phrase, case) mesure 44 px affichés
//      sur son plus petit côté — ou sa zone de toucher élargie (`::before`/`::after` posé en
//      `inset` négatif) les atteint ;
//   A3 chaque feuille (`role=dialog`) visible porte un nom (aria-labelledby / aria-label) ;
//   A4 aucun élément focalisable sans contour visible au clavier (`:focus-visible` mesuré en
//      appuyant sur Tab, 12 premiers arrêts).
//  GRAND TEXTE (390, 120 % et 150 %)
//   G1 le texte grandit vraiment (taille affichée du texte courant ≥ 1,15× / 1,4× de la vue
//      normale) — un réglage ignoré n'est pas « pas de débordement » ;
//   G2 la page ne défile pas de côté ; aucun bloc visible ne sort de l'écran (hors rangées
//      défilantes, qui sont faites pour) ;
//   G3 aucun texte coupé net (overflow caché sans « … ») ni deux textes l'un sur l'autre.
//  SOMBRE (390 et 1512)
//   S1 tout texte rendu atteint le contraste AA (4,5:1 ; 3:1 au-delà de 24 px ou 18,66 px
//      gras) sur le fond réellement peint derrière lui (fonds composés, opacités comprises ;
//      texte sur photo ou dégradé : non jugé, compté à part) ; boutons désactivés exemptés
//      (WCAG 1.4.3) ;
//   S2 aucune grande surface claire (luminance > 0,6 sur plus de 12 % de l'écran).
//  Le clair passe S1 aussi (un texte gris illisible n'est pas réservé au sombre).
//
//  Un banc ne meurt pas, il rapporte : chaque manque est nommé (écran, vue, texte, sélecteur).
//  Les captures sont à REGARDER (§6.2) : CAPTURES=dossier.
// ═══════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http');
const RACINE = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(RACINE, 'node_modules', 'playwright'));
const { servirBase } = require(path.join(RACINE, 'scripts', 'films', '_commun.cjs'));
const { monde } = require(path.join(RACINE, 'scripts', 'films', '_monde.cjs'));
const DIST = process.env.DIST || path.join(RACINE, 'dist');
const PORT = Number(process.env.BANC_PORT) || 12500;
const CAPT = process.env.CAPTURES || '';
const RAPPORT = process.env.RAPPORT || '';
const ECRANS = (process.env.ECRANS || 'journee,ventes,annonces,messages,achats,retraits,cat_bord,compta,dashboard,emails,settings,vintedaccounts,communaute,plat_leboncoin,plat_ebay,plat_vestiaire,garage').split(',');
const VUES = (process.env.VUES || '390-clair,390-sombre,1512-clair,1512-sombre,390-grand120,390-grand150').split(',');
const FEUILLES = process.env.FEUILLES !== '0';
// axe-core (audit automatique WCAG 2.1 AA) : pris dans node_modules s'il y est, sinon par
// AXE=chemin/vers/axe.min.js (`npm pack axe-core` hors du dépôt). Absent ⇒ les contrôles
// maison seuls, et le banc le DIT (jamais un vert silencieux).
const AXE = (() => { try { return fs.readFileSync(process.env.AXE || require.resolve('axe-core/axe.min.js', { paths: [RACINE] }), 'utf8'); } catch (_) { return null; } })();

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const srv = http.createServer((q, r) => {
  let f = decodeURIComponent(q.url.split('?')[0]); if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!p.startsWith(DIST) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ port ' + PORT + ' pris (' + e.code + ') — BANC_PORT=…'); process.exit(1); });

const TAB = { achats: 'cat_achats&vue=achats' };
const VP = { '390': { width: 390, height: 844 }, '1512': { width: 1512, height: 982 } };

// ── Les règles de texte (Node : appliquées au texte collecté) ────────────────
// Noms de l'app : [singulier, pluriel]. Invariables (colis, mois, prix, avis, fois) exclus.
const NOMS = [['vente', 'ventes'], ['annonce', 'annonces'], ['paire', 'paires'], ['achat', 'achats'], ['compte', 'comptes'], ['message', 'messages'],
  ['offre', 'offres'], ['jour', 'jours'], ['e-mail', 'e-mails'], ['conversation', 'conversations'], ['article', 'articles'], ['heure', 'heures'],
  ['minute', 'minutes'], ['semaine', 'semaines'], ['geste', 'gestes'], ['bordereau', 'bordereaux'], ['code', 'codes'], ['commande', 'commandes'],
  ['photo', 'photos'], ['brouillon', 'brouillons'], ['numéro', 'numéros'], ['favori', 'favoris'], ['carton', 'cartons'], ['point', 'points'],
  ['action', 'actions'], ['site', 'sites'], ['vendeur', 'vendeurs'], ['acheteur', 'acheteurs'], ['membre', 'membres'], ['retour', 'retours'],
  ['facture', 'factures'], ['fournisseur', 'fournisseurs'], ['rappel', 'rappels'], ['notification', 'notifications'], ['adresse', 'adresses'],
  ['étape', 'étapes'], ['case', 'cases'], ['meuble', 'meubles'], ['annulation', 'annulations'], ['visite', 'visites'], ['vue', 'vues'], ['lecture', 'lectures']];
const re = (s) => s;
// « 1 ventes » / « 0 ventes » ; « 2 vente » (un nombre ≥ 2, pas une heure « 12 h », pas une partie d'un nombre « 1 234 »).
const PLURIEL_FAUX = new RegExp(`(?<![\\d,.\\u00a0\\u202f ])(?:0|1)[\\u00a0\\u202f ](?:${NOMS.map((n) => re(n[1])).join('|')})(?![\\p{L}-])`, 'u');
const SINGULIER_FAUX = new RegExp(`(?<![\\d,.:/\\u00a0\\u202f-])(?:[2-9]|[1-9]\\d+)[\\u00a0\\u202f ](?:${NOMS.map((n) => re(n[0])).join('|')})(?![\\p{L}-])`, 'u');
// Le vocabulaire décidé (src/libelles.js) : ses mots ÉCARTÉS ne s'écrivent plus à l'écran.
const LIB = (() => { const vm = require('vm'); const src = fs.readFileSync(path.join(RACINE, 'src', 'libelles.js'), 'utf8').replace(/^export /gm, ''); const ctx = {}; vm.runInNewContext(src + '\n;this.motsEcartesDans = motsEcartesDans;', ctx); return ctx; })();
const regleTexte = [
  ['T1', 'accord : « 1 ventes » / « 2 vente »', (t) => { const m = PLURIEL_FAUX.exec(t) || SINGULIER_FAUX.exec(t); return m && m[0]; }],
  ['T2', 'espace manquant ou sécable avant « € »', (t) => { const m = /\d€|\d[ \t\r\n]+€/.exec(t); return m && m[0]; }],
  ['T3', '« n/d », « undefined », « NaN », « null », « [object Object] »', (t) => { const m = /\bn\/d\b|\bundefined\b|\bNaN\b|\bnull\b|\[object Object\]/i.exec(t); return m && m[0]; }],
  ['T4', '« ... » au lieu de « … »', (t) => { const m = /\.\.\./.exec(t); return m && m[0]; }],
  // « reçus » n'est écarté que pour un COLIS (« Arrivés ») : « Favoris reçus », « reçus d'achat », « bordereaux
  // reçus » parlent d'autre chose. « Bénéfice brut » est le nom DÉCIDÉ de la tuile de la semaine
  // (src/beneficeNoms.js, NOM_BENEFICE_BRUT) : une autre notion que le Bénéfice.
  ['T5', 'mot écarté par src/libelles.js (« à poster », « en transit », « emails »…)', (t) => { const m = LIB.motsEcartesDans(t).filter((w) => !(w === 'reçus' && !/colis/i.test(t)) && w !== 'bénéfice brut'); return m.length ? m.join(', ') : null; }],
  ['T6', '« email » au lieu de « e-mail » (libelles.js : E-mails)', (t) => { const m = /(^|[^\p{L}-])(e?mails?)(?![\p{L}@.-])/iu.exec(t); return m && !/^mail/i.test(m[2]) ? m[2] : null; }],
];

// ── Ce qui se mesure DANS la page ────────────────────────────────────────────
function mesurer(opts) {
  const out = { textes: [], noms: [], cibles: [], dialogues: [], contraste: [], contrasteNonJuge: 0, contrasteJuge: 0, debord: [], coupes: [], chevauche: [], surfaceClaire: 0, taillePolice: 0, largeurDoc: 0 };
  const W = innerWidth, H = innerHeight;
  const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
  const rgba = (s) => { if (!s || s === 'transparent') return [0, 0, 0, 0]; cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = s; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data;
    // Une couleur avec alpha est peinte prémultipliée sur du transparent : getImageData la rend dé-prémultipliée.
    return [d[0], d[1], d[2], d[3] / 255]; };
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const sur = (fg, bg) => [fg[0] * fg[3] + bg[0] * (1 - fg[3]), fg[1] * fg[3] + bg[1] * (1 - fg[3]), fg[2] * fg[3] + bg[2] * (1 - fg[3]), 1];
  const vis = (e) => { if (!e || !e.getClientRects().length) return false; const s = getComputedStyle(e); if (s.visibility === 'hidden' || s.display === 'none') return false; return true; };
  const opacite = (e) => { let o = 1; for (let x = e; x && x.nodeType === 1; x = x.parentElement) { const s = getComputedStyle(x); o *= parseFloat(s.opacity); if (s.visibility === 'hidden') return 0; } return o; };
  const cache = (e) => { for (let x = e; x && x.nodeType === 1; x = x.parentElement) { if (x.getAttribute('aria-hidden') === 'true' || x.hasAttribute('inert')) return true; } return false; };
  const sel = (e) => { const p = []; for (let x = e; x && x.nodeType === 1 && p.length < 4; x = x.parentElement) { let s = x.tagName.toLowerCase(); const c = [...x.classList].filter((k) => /^vrm-/.test(k)).slice(0, 2); if (c.length) s += '.' + c.join('.'); const d = [...x.attributes].find((a) => /^data-/.test(a.name)); if (d) s += `[${d.name}${d.value && d.value.length < 30 ? '="' + d.value + '"' : ''}]`; p.unshift(s); } return p.join(' > '); };
  // Le fond réellement peint derrière un élément : les fonds des ancêtres, composés ;
  // un ancêtre à image de fond (photo, dégradé) ⇒ pas jugeable.
  const fondDe = (e) => {
    const pile = [];
    for (let x = e; x && x.nodeType === 1; x = x.parentElement) {
      const s = getComputedStyle(x);
      if (s.backgroundImage && s.backgroundImage !== 'none') return null;
      if (s.backdropFilter && s.backdropFilter !== 'none' && rgba(s.backgroundColor)[3] < 0.9) return null;
      const c = rgba(s.backgroundColor);
      if (c[3] > 0) { pile.push(c); if (c[3] >= 0.999) break; }
    }
    let b = [255, 255, 255, 1];
    if (!pile.length || pile[pile.length - 1][3] < 0.999) { const r = rgba(getComputedStyle(document.body).backgroundColor); b = r[3] > 0.99 ? r : [255, 255, 255, 1]; }
    for (let i = pile.length - 1; i >= 0; i--) b = sur(pile[i], b);
    return b;
  };
  // Un élément est-il dans une rangée faite pour défiler ? (Un bloc coupé par un parent « overflow: hidden » SORT de l'écran : il compte.)
  const dansDefilant = (e) => { for (let x = e.parentElement; x && x !== document.body; x = x.parentElement) { const s = getComputedStyle(x); if (/(auto|scroll)/.test(s.overflowX)) return true; } return false; };
  const fixeHorsEcran = (e) => { for (let x = e; x && x.nodeType === 1; x = x.parentElement) { const s = getComputedStyle(x); if (s.transform && s.transform !== 'none' && (s.position === 'fixed' || s.position === 'absolute')) { const r = x.getBoundingClientRect(); if (r.right <= 0 || r.left >= W || r.bottom <= 0 || r.top >= H) return true; } } return false; };

  // Une feuille ouverte : on ne juge QU'ELLE (la page derrière est sous le voile).
  const RAC = (opts.feuille && [...document.querySelectorAll('[role=dialog][aria-modal=true], [role=menu].vrm-sheet')].filter(vis).pop()) || document.body;
  // 1. Les textes visibles
  const tw = document.createTreeWalker(RAC, NodeFilter.SHOW_TEXT);
  const boites = [];
  let somme = 0, nPol = 0;
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const t = n.nodeValue; if (!t || !t.trim()) continue;
    const e = n.parentElement; if (!e || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|TITLE)$/.test(e.tagName)) continue;
    if (!vis(e) || cache(e)) continue;
    const rg = document.createRange(); rg.selectNodeContents(n); const rr = [...rg.getClientRects()].filter((r) => r.width > 0.5 && r.height > 0.5);
    if (!rr.length) continue;
    const r0 = rr[0];
    const s = getComputedStyle(e);
    // Texte réservé au lecteur d'écran (clip / 1 px) : lu, pas vu.
    const srOnly = (r0.width <= 2 && r0.height <= 2) || /rect\(0(px)?,? 0(px)?,? 0(px)?,? 0(px)?\)/.test(s.clip) || s.clipPath === 'inset(50%)';
    const enVue = rr.some((r) => r.bottom > 0 && r.top < H && r.right > 0 && r.left < W);
    // Le texte d'un TIERS (message d'un acheteur, titre d'annonce) n'est pas un texte de l'app.
    const tiers = !!e.closest('[data-conv-extrait], .vrm-bulle, .vrm-msg-bulle, .vrm-chat-msg, [data-texte-tiers]');
    if (!tiers) out.textes.push({ t: t.replace(/\s+/g, (m) => (/[  ]/.test(m) && m.length === 1 ? m : m.replace(/[^  ]/g, ' ').replace(/ +/g, ' '))), sel: sel(e) });
    if (srOnly) continue;
    const op = opacite(e);
    if (op < 0.05) continue;
    // Taille de police affichée (zoom compris) : texte courant (11–20 px CSS) seulement.
    const fs = parseFloat(s.fontSize);
    const zoom = (() => { let z = 1; for (let x = e; x && x.nodeType === 1; x = x.parentElement) { const v = parseFloat(getComputedStyle(x).zoom); if (v && v !== 1) z *= v; } return z; })();
    if (enVue && fs >= 11 && fs <= 20 && e.closest('.vrm-main')) { somme += fs * zoom; nPol++; }
    if (enVue) boites.push({ e, rr, t: t.trim().slice(0, 40) });
    // Contraste
    if (!enVue) continue;
    const desactive = !!e.closest('button:disabled, [aria-disabled="true"], fieldset:disabled, input:disabled, select:disabled');
    if (desactive) continue;
    const fond = fondDe(e);
    if (!fond) { out.contrasteNonJuge++; continue; }
    const c = rgba(s.color); const fg = [c[0], c[1], c[2], c[3] * op];
    const vue = sur(fg, fond);
    const k = ratio(vue, fond);
    const grand = fs * zoom >= 24 || (fs * zoom >= 18.66 && parseInt(s.fontWeight, 10) >= 700);
    const seuil = grand ? 3 : 4.5;
    out.contrasteJuge++;
    if (k + 0.005 < seuil) out.contraste.push({ t: t.trim().slice(0, 60), k: Math.round(k * 100) / 100, seuil, fg: s.color, op: Math.round(op * 100) / 100, fond: `rgb(${fond.slice(0, 3).map(Math.round).join(',')})`, sel: sel(e) });
  }
  out.taillePolice = nPol ? somme / nPol : 0;
  // Les PHRASES (lignes rendues des blocs) : « 4 » + « geste » + « s » sont trois nœuds
  // mais une phrase lue « 4 gestes » — c'est elle que les règles de texte jugent.
  const vues = new Set();
  for (const e of document.querySelectorAll('body *')) {
    if (/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|svg|SVG)$/.test(e.tagName)) continue;
    const d = getComputedStyle(e).display; if (d === 'inline' || d === 'contents' || d === 'none') continue;
    if (!vis(e) || cache(e)) continue;
    if (e.querySelector('[data-conv-extrait], .vrm-bulle, .vrm-msg-bulle, .vrm-chat-msg, [data-texte-tiers]') || e.closest('[data-conv-extrait], .vrm-bulle, .vrm-msg-bulle, .vrm-chat-msg, [data-texte-tiers]')) continue;
    const it = e.innerText; if (!it || it.length > 400) continue;
    for (const ligne of it.split('\n')) { const l = ligne.trim(); if (l && !vues.has(l)) { vues.add(l); out.textes.push({ t: l, sel: sel(e) + ' (ligne)' }); } }
  }
  // Noms (aria-label, title, placeholder, alt) : relus aussi par le lecteur d'écran.
  for (const e of document.querySelectorAll('[aria-label],[title],[placeholder],img[alt]')) {
    if (!vis(e) || cache(e)) continue;
    for (const a of ['aria-label', 'title', 'placeholder', 'alt']) { const v = e.getAttribute(a); if (v && v.trim()) out.textes.push({ t: v, sel: sel(e) + ' @' + a }); }
  }

  // 2. Noms accessibles et cibles
  const texteLu = (e) => { const f = (n, racine) => { if (n.nodeType === 3) return n.nodeValue; if (n.nodeType !== 1) return ''; if (!racine && n.getAttribute('aria-hidden') === 'true') return '';
    if (!racine && n.getAttribute('aria-label')) return ' ' + n.getAttribute('aria-label') + ' '; if (n.tagName === 'IMG') return ' ' + (n.alt || '') + ' ';
    if (n.tagName === 'svg' || n.tagName === 'SVG') { const ti = n.querySelector('title'); return ti ? ' ' + ti.textContent + ' ' : ''; }
    if (/^(STYLE|SCRIPT)$/.test(n.tagName)) return ''; let s = ''; for (const c of n.childNodes) s += f(c, false); return s; }; return f(e, true).replace(/\s+/g, ' ').trim(); };
  const nomDe = (e) => {
    const lb = e.getAttribute('aria-labelledby'); if (lb) { const v = lb.split(/\s+/).map((id) => { const x = document.getElementById(id); return x ? x.textContent : ''; }).join(' ').trim(); if (v) return v; }
    const al = e.getAttribute('aria-label'); if (al && al.trim()) return al.trim();
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName)) {
      if (e.id) { const l = document.querySelector(`label[for="${CSS.escape(e.id)}"]`); if (l && l.textContent.trim()) return l.textContent.trim(); }
      const l = e.closest('label'); if (l && l.textContent.trim()) return l.textContent.trim();
      if (e.type === 'button' || e.type === 'submit') return (e.value || '').trim();
      const ph = e.getAttribute('placeholder'); if (ph && ph.trim()) return ph.trim();
    }
    const t = texteLu(e); if (t) return t;
    const ti = e.getAttribute('title'); if (ti && ti.trim()) return ti.trim();
    return '';
  };
  const INTER = 'button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=switch], [role=tab], [role=checkbox], [role=radio], [role=menuitem], [role=link], summary';
  const dejaCible = new Set();
  for (const e of RAC.querySelectorAll(INTER)) {
    if (!vis(e) || cache(e)) continue;
    const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
    const enVue = r.bottom > 0 && r.top < H && r.right > 0 && r.left < W; if (!enVue) continue;
    if (fixeHorsEcran(e)) continue;
    const s = getComputedStyle(e);
    if (parseFloat(s.opacity) === 0 && !(e.tagName === 'INPUT' && /checkbox|radio|file/.test(e.type))) continue;
    // Une case/radio/fichier masquée dans son <label> : la cible est le label.
    let cible = e;
    if (e.tagName === 'INPUT' && /checkbox|radio|file/.test(e.type)) { const l = e.closest('label') || (e.id && document.querySelector(`label[for="${CSS.escape(e.id)}"]`)); if (l) cible = l; }
    const nom = nomDe(e);
    if (!nom) out.noms.push({ sel: sel(e), html: e.outerHTML.slice(0, 160) });
    if (!opts.tactile || dejaCible.has(cible)) continue;
    dejaCible.add(cible);
    // Lien dans une phrase : exempté (WCAG 2.5.5, « inline »).
    if (e.tagName === 'A' && getComputedStyle(e).display === 'inline' && e.parentElement && (e.parentElement.textContent || '').trim().length > (e.textContent || '').trim().length + 8) continue;
    if (e.disabled || e.getAttribute('aria-disabled') === 'true') continue;
    const z = (() => { let k = 1; for (let x = cible; x && x.nodeType === 1; x = x.parentElement) { const v = parseFloat(getComputedStyle(x).zoom); if (v && v !== 1) k *= v; } return k; })();
    const rc = cible.getBoundingClientRect();
    let w = rc.width, h = rc.height;
    // Zone de toucher élargie par un pseudo-élément (inset négatif).
    for (const p of ['::before', '::after']) {
      const ps = getComputedStyle(cible, p);
      if (!ps || ps.content === 'none' || ps.position !== 'absolute') continue;
      const px = (v) => (/px$/.test(v) ? parseFloat(v) : 0);
      const t = px(ps.top), b = px(ps.bottom), l = px(ps.left), rr = px(ps.right);
      if (t < 0 || b < 0 || l < 0 || rr < 0) { w = Math.max(w, rc.width - Math.min(0, l) - Math.min(0, rr)); h = Math.max(h, rc.height - Math.min(0, t) - Math.min(0, b)); }
    }
    // getBoundingClientRect rend déjà la taille affichée (zoom compris) dans Chromium.
    void z;
    if (Math.min(w, h) + 0.5 < 44) out.cibles.push({ nom: nom.slice(0, 40), w: Math.round(w), h: Math.round(h), sel: sel(cible) });
  }
  // 3. Feuilles
  for (const d of document.querySelectorAll('[role=dialog],[role=alertdialog],[role=menu].vrm-sheet')) {
    if (!vis(d) || cache(d)) continue;
    const r = d.getBoundingClientRect(); if (r.width < 20 || r.height < 20) continue;
    out.dialogues.push({ sel: sel(d), nom: nomDe({ getAttribute: (a) => d.getAttribute(a), tagName: 'DIV', closest: () => null }) || (d.getAttribute('aria-labelledby') ? '' : ''), labelled: d.getAttribute('aria-labelledby') || '', label: d.getAttribute('aria-label') || '' });
  }
  for (const d of out.dialogues) { if (!d.nom && d.labelled) { d.nom = d.labelled.split(/\s+/).map((id) => { const x = document.getElementById(id); return x ? x.textContent.trim() : ''; }).join(' ').trim(); } if (!d.nom) d.nom = d.label; }
  // 4. Débordements (grand texte surtout)
  out.largeurDoc = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth;
  for (const e of document.querySelectorAll('body *')) {
    if (!vis(e) || cache(e)) continue;
    const r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4) continue;
    if (r.bottom < 0 || r.top > H) continue;
    if (r.right > W + 1.5 || r.left < -1.5) {
      if (dansDefilant(e) || fixeHorsEcran(e)) continue;
      // Seul le plus haut élément qui sort compte (pas ses enfants).
      if (e.parentElement && out.debord.some((d) => d.el && d.el.contains(e))) continue;
      out.debord.push({ el: e, sel: sel(e), gauche: Math.round(r.left), droite: Math.round(r.right), t: (e.innerText || '').trim().slice(0, 40) });
    }
  }
  out.debord = out.debord.slice(0, 40).map(({ el, ...x }) => x);
  if (opts.coupes) {
    for (const { e } of boites) {
      const s = getComputedStyle(e);
      if (!/(hidden|clip)/.test(s.overflowX) && !/(hidden|clip)/.test(s.overflow)) continue;
      if (s.textOverflow === 'ellipsis' || parseInt(s.webkitLineClamp || '0', 10) > 0 || s.webkitLineClamp !== 'none' && s.webkitLineClamp) continue;
      if (e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 0) out.coupes.push({ t: (e.innerText || '').trim().slice(0, 50), sel: sel(e), sw: e.scrollWidth, cw: e.clientWidth });
    }
    // Un mot coupé en deux par un retour à la ligne (« demai / n ») : illisible.
    out.motsCoupes = [];
    for (const { e, rr } of boites) {
      if (rr.length < 2 || out.motsCoupes.length >= 10) continue;
      for (const n of e.childNodes) {
        if (n.nodeType !== 3 || !n.nodeValue || n.nodeValue.length > 160) continue;
        const v = n.nodeValue, rg = document.createRange(); let haut = null;
        for (let i = 0; i < v.length; i++) {
          rg.setStart(n, i); rg.setEnd(n, i + 1); const r = rg.getBoundingClientRect(); if (!r.height) continue;
          if (haut != null && r.top > haut + 2 && /\p{L}/u.test(v[i]) && i > 0 && /\p{L}/u.test(v[i - 1])) { out.motsCoupes.push({ t: v.slice(Math.max(0, i - 12), i) + '|' + v.slice(i, i + 8), sel: sel(e) }); break; }
          haut = r.top;
        }
      }
    }
    // Deux textes l'un sur l'autre : boîtes de texte d'éléments différents qui se croisent nettement.
    // Un texte dans une barre fixe ou collante (barre du bas, en-tête) : le contenu passe dessous, c'est voulu.
    const flottant = (e) => { for (let x = e; x && x.nodeType === 1; x = x.parentElement) { const p = getComputedStyle(x).position; if (p === 'fixed' || p === 'sticky') return true; } return false; };
    // Un texte caché par le défilement d'un parent (« overflow » auto/hidden) n'est pas vu : sa boîte ne compte pas.
    const clipVisible = (e, r) => { for (let x = e.parentElement; x && x !== document.documentElement; x = x.parentElement) { const st = getComputedStyle(x); if (st.overflow === 'visible' && st.overflowX === 'visible' && st.overflowY === 'visible') continue; const c = x.getBoundingClientRect(); if (r.bottom <= c.top + 1 || r.top >= c.bottom - 1 || r.right <= c.left + 1 || r.left >= c.right - 1) return false; } return true; };
    const bx = boites.filter(({ e }) => !flottant(e)).flatMap(({ e, rr, t }) => rr.map((r) => ({ e, r, t }))).filter((b) => b.r.width > 3 && b.r.height > 6 && b.r.top >= 0 && b.r.bottom <= H && clipVisible(b.e, b.r));
    for (let i = 0; i < bx.length && out.chevauche.length < 20; i++) for (let j = i + 1; j < bx.length; j++) {
      const a = bx[i], b = bx[j]; if (a.e === b.e || a.e.contains(b.e) || b.e.contains(a.e)) continue;
      const ix = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), iy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (ix > 4 && iy > Math.min(a.r.height, b.r.height) * 0.45) { out.chevauche.push({ a: a.t, b: b.t, sa: sel(a.e), sb: sel(b.e) }); break; }
    }
  }
  // 5. Surfaces claires (sombre) : échantillonnage d'une grille de points.
  if (opts.sombre) {
    let clair = 0, total = 0;
    for (let y = 8; y < H; y += 24) for (let x = 8; x < W; x += 24) {
      const e = document.elementFromPoint(x, y); if (!e) continue; total++;
      const f = fondDe(e); if (f && lum(f) > 0.6) clair++;
    }
    out.surfaceClaire = total ? clair / total : 0;
  }
  return out;
}

async function focusVisible(pg) {
  // 12 arrêts de Tab : chaque élément focalisé doit montrer un contour (outline ou box-shadow).
  const sans = [];
  await pg.mouse.click(2, 2).catch(() => {});
  for (let i = 0; i < 12; i++) {
    await pg.keyboard.press('Tab');
    const r = await pg.evaluate(() => {
      const e = document.activeElement; if (!e || e === document.body) return null;
      const s = getComputedStyle(e);
      const contour = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 1) || (s.boxShadow && s.boxShadow !== 'none');
      const r = e.getBoundingClientRect();
      return { contour, nom: (e.getAttribute('aria-label') || e.innerText || e.tagName).trim().slice(0, 40), vis: r.width > 0 && r.height > 0 };
    });
    if (r && r.vis && !r.contour) sans.push(r.nom);
  }
  return sans;
}

let ko = 0, ok = 0;
const manques = [];
const dit = (c, m, d) => { if (c) ok++; else { ko++; manques.push(m); } console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const court = (a, n = 6) => JSON.stringify(a.slice(0, n)).slice(0, 900);

(async () => {
  await new Promise((r) => srv.listen(PORT, '127.0.0.1', r));
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const rapport = {};
  const policeNormale = {};
  for (const vue of VUES) for (const ecran of ECRANS) {
    const [l, mode] = vue.split('-');
    const sombre = mode === 'sombre';
    const grand = /^grand(\d+)$/.exec(mode || '');
    const tel = l === '390';
    const m = monde();
    const ctx = await b.newContext({ viewport: VP[l], colorScheme: sombre ? 'dark' : 'light', reducedMotion: 'reduce', locale: 'fr-FR', timezoneId: 'Europe/Paris', serviceWorkers: 'block', ...(tel ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
    await ctx.clock.install({ time: new Date(m.maintenant) });
    await servirBase(ctx, m);
    const session = { access_token: m.jeton, refresh_token: 'r', expires_at: Date.parse(m.maintenant) + 864e5, user: { id: m.uid, email: m.email } };
    await ctx.addInitScript(([s, sb, gr]) => {
      try {
        localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_local_owner', s.user.id);
        localStorage.setItem('vinted_dark', sb ? 'true' : 'false');
        localStorage.setItem('vrm_bienvenue_vue', JSON.stringify({ at: 'banc' })); localStorage.setItem('vrm_visite_vue', JSON.stringify({ at: 'banc' }));
        localStorage.setItem('vrm_acces_direct', '1');
      } catch (_) {}
      // Le réglage « texte plus grand » du navigateur : la taille de police racine.
      if (gr) {
        const poser = () => { const st = document.createElement('style'); st.textContent = `html{font-size:${gr}% !important}`; document.documentElement.appendChild(st); };
        if (document.documentElement) poser(); else { const ob = new MutationObserver(() => { if (document.documentElement) { ob.disconnect(); poser(); } }); ob.observe(document, { childList: true }); }
      }
    }, [session, sombre, grand ? Number(grand[1]) : 0]);
    const pg = await ctx.newPage();
    const errs = [];
    pg.on('pageerror', (e) => errs.push('page: ' + e.message.slice(0, 160)));
    await pg.goto(`http://127.0.0.1:${PORT}/?tab=${TAB[ecran] || ecran}`, { waitUntil: 'domcontentloaded' });
    await pg.waitForSelector('.vrm-main', { timeout: 45000 }).catch(() => {});
    await pg.waitForTimeout(3500);
    await pg.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
    if (process.env.MONTRER) console.log('   ⓘ', JSON.stringify(await pg.evaluate((q) => [...document.querySelectorAll(q)].slice(0, 3).map((e) => { const c = getComputedStyle(e); const r = e.getBoundingClientRect(); return ({ html: e.outerHTML.slice(0, 300), w: c.width, ml: c.marginLeft, mr: c.marginRight, pos: c.position, l: c.left, inset: c.inset, r: [r.left, r.right], zoom: c.zoom, parentW: e.parentElement && getComputedStyle(e.parentElement).width }); }), process.env.MONTRER)));
    const garde = await pg.evaluate(() => /pas pu s.afficher|Quelque chose s.est mal passé|Recharger l.app/i.test(document.body.innerText));
    const nom = `${ecran} · ${vue}`;
    const mes = await pg.evaluate(mesurer, { tactile: tel, sombre: true, coupes: !!grand || tel });
    if (CAPT) { fs.mkdirSync(CAPT, { recursive: true }); await pg.screenshot({ path: path.join(CAPT, `finition-${ecran}-${vue}.png`), fullPage: false }); }
    const r = rapport[nom] = { garde, errs, ...mes };
    // Textes
    const fautes = {};
    for (const { t, sel } of mes.textes) for (const [id, , f] of regleTexte) { const x = f(t); if (x) (fautes[id] = fautes[id] || []).push({ x, t: t.slice(0, 80), sel }); }
    r.fautes = fautes;
    dit(!garde && !errs.length, `${nom} : rendu sans garde-fou ni erreur de page`, errs.slice(0, 2).join(' | '));
    if (!grand) for (const [id, lib] of regleTexte) dit(!(fautes[id] || []).length, `${nom} ${id} ${lib} : aucun`, court(fautes[id] || [], 4));
    // Accessibilité
    if (!grand) {
      dit(!mes.noms.length, `${nom} A1 chaque commande visible a un nom accessible`, court(mes.noms, 4));
      if (tel) dit(!mes.cibles.length, `${nom} A2 cibles ≥ 44 px affichés`, court(mes.cibles, 6));
      dit(mes.dialogues.every((d) => d.nom), `${nom} A3 chaque feuille ouverte a un nom`, court(mes.dialogues.filter((d) => !d.nom)));
    }
    // A5 axe-core : aucune violation « serious » ou « critical » (WCAG 2.1 A et AA). Le contraste
    // est déjà jugé par S1 (fonds composés, opacités) ; axe le rejuge aussi.
    if (!grand && AXE) {
      const ax = await pg.evaluate(async (code) => { if (!window.axe) { const s = document.createElement('script'); s.textContent = code; document.head.appendChild(s); }
        const res = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] });
        return res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, cible: v.nodes.slice(0, 2).map((x) => String(x.target).slice(0, 90)), resume: (v.nodes[0] && v.nodes[0].failureSummary || '').slice(0, 160) })); }, AXE).catch((e) => [{ id: 'axe-erreur', resume: String(e.message || e).slice(0, 120) }]);
      r.axe = ax;
      dit(!ax.length, `${nom} A5 axe-core : aucune violation sérieuse`, court(ax, 4));
    } else if (!grand && !AXE && vue === VUES[0] && ecran === ECRANS[0]) console.log('  ⓘ axe-core absent (AXE=…/axe.min.js) : contrôles maison seuls');
    if (vue === '1512-clair') { const sans = await focusVisible(pg); r.focus = sans; dit(!sans.length, `${nom} A4 focus visible au clavier (12 arrêts)`, court(sans)); }
    // Grand texte
    if (tel && !grand && !sombre) policeNormale[ecran] = mes.taillePolice;
    if (grand) {
      const f = Number(grand[1]) / 100, base = policeNormale[ecran] || 0;
      const att = 1 + (f - 1) * 0.75;
      dit(base > 0 && mes.taillePolice >= base * att, `${nom} G1 le texte grandit (≥ ${att.toFixed(2)}×)`, `${mes.taillePolice.toFixed(1)} px contre ${base.toFixed(1)} px`);
      dit(mes.largeurDoc <= 1 && !mes.debord.length, `${nom} G2 rien ne sort de l'écran`, `page +${mes.largeurDoc}px ; ` + court(mes.debord, 5));
      dit(!mes.coupes.length && !mes.chevauche.length && !(mes.motsCoupes || []).length, `${nom} G3 aucun texte coupé net, recouvert, ni mot coupé en deux`, court(mes.coupes, 3) + ' ' + court(mes.chevauche, 3) + ' ' + court(mes.motsCoupes || [], 4));
    }
    // Contraste (toutes les vues normales) ; surfaces claires (sombre)
    if (!grand) dit(!mes.contraste.length, `${nom} S1 contraste AA sur ${mes.contrasteJuge} textes (${mes.contrasteNonJuge} sur photo/dégradé non jugés)`, court(mes.contraste, 5));
    if (sombre) dit(mes.surfaceClaire <= 0.12, `${nom} S2 aucune grande surface claire`, `${Math.round(mes.surfaceClaire * 100)} %`);
    delete r.textes; r.nTextes = mes.textes.length; r.textesListe = mes.textes.map((x) => x.t);
    await ctx.close();
  }
  // Les feuilles : quelques-unes ouvertes, au téléphone, en clair et en sombre.
  if (FEUILLES) {
    const OUVRIR = [
      ['notifications', 'journee', '[data-cloche], button[aria-label*="otification"]'],
      ['plus', 'journee', '[data-tabbar-plus], .vrm-tabbar [aria-label="Plus"], .vrm-tabbar button:last-child'],
      ['chiffres', 'journee', '[data-carte-modifier="journee"]'],
      ['aide-ventes', 'ventes', '[data-carte-stats] [data-carte-aide]'],
      ['conversation', 'messages', '[data-conv="502"]'],
    ];
    for (const sombre of [false, true]) for (const [id, tab, q] of OUVRIR) {
      const m = monde();
      const ctx = await b.newContext({ viewport: VP['390'], colorScheme: sombre ? 'dark' : 'light', reducedMotion: 'reduce', locale: 'fr-FR', timezoneId: 'Europe/Paris', serviceWorkers: 'block', isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
      await ctx.clock.install({ time: new Date(m.maintenant) });
      await servirBase(ctx, m);
      const session = { access_token: m.jeton, refresh_token: 'r', expires_at: Date.parse(m.maintenant) + 864e5, user: { id: m.uid, email: m.email } };
      await ctx.addInitScript(([s, sb]) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_local_owner', s.user.id); localStorage.setItem('vinted_dark', sb ? 'true' : 'false'); localStorage.setItem('vrm_bienvenue_vue', '{"at":"banc"}'); localStorage.setItem('vrm_visite_vue', '{"at":"banc"}'); } catch (_) {} }, [session, sombre]);
      const pg = await ctx.newPage();
      await pg.goto(`http://127.0.0.1:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
      await pg.waitForSelector('.vrm-main', { timeout: 45000 }).catch(() => {});
      await pg.waitForTimeout(3000);
      const el = await pg.$(q);
      const nom = `feuille ${id} · 390-${sombre ? 'sombre' : 'clair'}`;
      if (!el) { dit(false, `${nom} : le bouton qui l'ouvre est trouvé`, q); await ctx.close(); continue; }
      await el.click().catch(() => {});
      await pg.waitForTimeout(1200);
      const mes = await pg.evaluate(mesurer, { tactile: true, sombre: true, coupes: false, feuille: true });
      if (CAPT) await pg.screenshot({ path: path.join(CAPT, `finition-feuille-${id}-390-${sombre ? 'sombre' : 'clair'}.png`) });
      rapport[nom] = mes;
      dit(mes.dialogues.length > 0 && mes.dialogues.every((d) => d.nom), `${nom} A3 la feuille est un dialogue nommé`, court(mes.dialogues));
      dit(!mes.noms.length, `${nom} A1 noms accessibles`, court(mes.noms, 4));
      dit(!mes.contraste.length, `${nom} S1 contraste AA (${mes.contrasteJuge} textes)`, court(mes.contraste, 5));
      if (sombre) dit(mes.surfaceClaire <= 0.12, `${nom} S2 aucune grande surface claire`, `${Math.round(mes.surfaceClaire * 100)} %`);
      await ctx.close();
    }
  }
  if (RAPPORT) { fs.mkdirSync(path.dirname(RAPPORT), { recursive: true }); fs.writeFileSync(RAPPORT, JSON.stringify(rapport, null, 1)); }
  await b.close(); srv.close();
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ banc', e.stack || e.message); srv.close(); process.exit(1); });
