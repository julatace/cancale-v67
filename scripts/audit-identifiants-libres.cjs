#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// AUCUN COMPOSANT NI HELPER LIBRE DANS UN MODULE (23 nov., audit démo)
// ═══════════════════════════════════════════════════════════════════════════
// En production, Achats tombait sur « Cet écran a un souci » (achats:colis,
// achats:vinted ; « Icon is not defined », relevé dans les plantages de la base
// le 22 et le 23 nov.) : `Contenu` (src/natif/RetraitsPoints.jsx) dessinait
// `<Icon …/>` sans le recevoir — `Icon` était un paramètre d'une AUTRE fonction
// du même fichier. `npm run build` ne le voit pas (CLAUDE.md §4.8), et l'écran
// ne plantait que pour un colis sans photo.
//
// Ici : chaque fichier de src/ est transformé (JSX → JS, esbuild), puis une
// analyse de PORTÉE (paramètres, var/let/const, fonctions et classes hissées,
// import, catch) cherche tout identifiant qui commence par une MAJUSCULE (un
// composant, une constante) et n'est déclaré dans AUCUNE portée englobante,
// ni global connu du navigateur. Un seul suffit : rouge, avec fichier et ligne.
//
// `--prouve` : rejoue la panne du 22 nov. sur une copie en mémoire (le
// paramètre `Icon` de `Contenu` retiré) ⇒ doit être rouge.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const esbuild = require(path.join(RACINE, 'node_modules/esbuild'));
const acorn = require(path.join(RACINE, 'node_modules/acorn'));

// Globaux du navigateur / du langage qui commencent par une majuscule.
const GLOBAUX = new Set(('Array ArrayBuffer Atomics BigInt BigInt64Array BigUint64Array Blob Boolean BroadcastChannel ' +
  'CSS CSSStyleSheet Cache CanvasRenderingContext2D ClipboardItem CompressionStream CustomEvent DOMException DOMParser ' +
  'DOMRect DataView Date DecompressionStream Document DocumentFragment Element Error EvalError Event EventSource ' +
  'EventTarget File FileReader FinalizationRegistry Float32Array Float64Array FontFace FormData Function Headers ' +
  'HTMLAnchorElement HTMLCanvasElement HTMLElement HTMLImageElement HTMLInputElement HTMLVideoElement IDBKeyRange Image ' +
  'ImageBitmap ImageData Infinity IntersectionObserver Int16Array Int32Array Int8Array Intl JSON KeyboardEvent Map Math ' +
  'MediaRecorder MediaStream MessageChannel MouseEvent MutationObserver NaN Node NodeFilter Notification Number Object ' +
  'OffscreenCanvas Option Path2D PerformanceObserver PointerEvent Promise Proxy RangeError ReadableStream ReferenceError ' +
  'Reflect RegExp Request ResizeObserver Response SVGElement Set SharedArrayBuffer SpeechSynthesisUtterance String ' +
  'Symbol SyntaxError TextDecoder TextEncoder TouchEvent TransformStream TypeError URIError URL URLSearchParams ' +
  'Uint16Array Uint32Array Uint8Array Uint8ClampedArray WeakMap WeakRef WeakSet WebAssembly WebSocket Worker ' +
  'WritableStream XMLHttpRequest XMLSerializer AbortController AbortSignal AudioContext BarcodeDetector ' +
  'GeolocationPositionError HTMLFormElement HTMLSelectElement HTMLTextAreaElement HTMLButtonElement Selection Range ' +
  'StorageEvent PopStateEvent HashChangeEvent ErrorEvent PromiseRejectionEvent ShadowRoot Text Comment Window ' +
  'IDBDatabase IDBFactory IDBRequest IDBTransaction Iterator AggregateError SubmitEvent InputEvent FocusEvent WheelEvent ' +
  'DragEvent ClipboardEvent AnimationEvent TransitionEvent VisualViewport NavigationPreloadManager Crypto CryptoKey ' +
  'SubtleCrypto PerformanceEntry Location History Navigator Screen MediaQueryList DeviceOrientationEvent ' +
  // Buffer : Node (bancs, serveur), toujours derrière « typeof Buffer » dans src/.
  'DOMMatrix DOMMatrixReadOnly Buffer').split(/\s+/));
// Remplacés au build par vite (define) : `__BUILD__` etc. commencent par « _ », hors du champ.

function fichiers(d, o = []) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) { if (f.name !== 'node_modules') fichiers(p, o); }
    else if (/\.(jsx|js|mjs)$/.test(f.name) && !/\.test\.|\.spec\./.test(f.name)) o.push(p);
  }
  return o;
}

// ── Portées ──
function libresDe(code) {
  const ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module', locations: true, allowHashBang: true });
  const portees = new Map(); // nœud → Set
  const decl = (porteeNode, nom) => { if (!portees.has(porteeNode)) portees.set(porteeNode, new Set()); portees.get(porteeNode).add(nom); };
  const noms = (p, out = []) => {
    if (!p) return out;
    switch (p.type) {
      case 'Identifier': out.push(p.name); break;
      case 'ObjectPattern': p.properties.forEach((q) => noms(q.type === 'RestElement' ? q.argument : q.value, out)); break;
      case 'ArrayPattern': p.elements.forEach((e) => noms(e, out)); break;
      case 'AssignmentPattern': noms(p.left, out); break;
      case 'RestElement': noms(p.argument, out); break;
    }
    return out;
  };
  const estFonction = (n) => n && /^(FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/.test(n.type);
  const estBloc = (n) => n && /^(BlockStatement|ForStatement|ForInStatement|ForOfStatement|SwitchStatement|StaticBlock)$/.test(n.type);
  // 1er passage : déclarations, avec la pile des portées.
  const refs = [];
  const visite = (n, pile, parent, cle) => {
    if (!n || typeof n.type !== 'string') return;
    const porteeFonction = () => { for (let i = pile.length - 1; i >= 0; i--) if (estFonction(pile[i]) || pile[i].type === 'Program') return pile[i]; return pile[0]; };
    const porteeBloc = () => pile[pile.length - 1];
    switch (n.type) {
      case 'ImportSpecifier': case 'ImportDefaultSpecifier': case 'ImportNamespaceSpecifier': decl(pile[0], n.local.name); return;
      case 'VariableDeclaration': {
        const cible = n.kind === 'var' ? porteeFonction() : porteeBloc();
        n.declarations.forEach((d) => { noms(d.id).forEach((x) => decl(cible, x)); visiteMotif(d.id, pile); if (d.init) visite(d.init, pile, d, 'init'); });
        return;
      }
      case 'FunctionDeclaration': if (n.id) decl(pile.length > 1 && estBloc(porteeBloc()) ? porteeBloc() : porteeFonction(), n.id.name); break;
      case 'ClassDeclaration': if (n.id) decl(porteeBloc(), n.id.name); break;
      case 'ClassExpression': if (n.id) decl(n, n.id.name); break;
      case 'CatchClause': if (n.param) noms(n.param).forEach((x) => decl(n, x)); break;
      case 'Identifier': {
        if (parent) {
          if (parent.type === 'MemberExpression' && cle === 'property' && !parent.computed) return;
          if ((parent.type === 'Property' || parent.type === 'MethodDefinition' || parent.type === 'PropertyDefinition') && cle === 'key' && !parent.computed) return;
          if (parent.type === 'LabeledStatement' || parent.type === 'BreakStatement' || parent.type === 'ContinueStatement') return;
          if (parent.type === 'ExportSpecifier' && cle === 'exported') return;
          if (parent.type === 'MetaProperty') return;
        }
        refs.push({ nom: n.name, pile: pile.slice(), ligne: n.loc.start.line });
        return;
      }
    }
    const nouvelle = estFonction(n) || estBloc(n) || n.type === 'CatchClause' || n.type === 'ClassExpression';
    const p2 = nouvelle ? pile.concat([n]) : pile;
    if (estFonction(n)) {
      if (n.type === 'FunctionExpression' && n.id) decl(n, n.id.name);
      n.params.forEach((pa) => { noms(pa).forEach((x) => decl(n, x)); visiteMotif(pa, p2); });
      visite(n.body, p2, n, 'body');
      return;
    }
    if (n.type === 'CatchClause') { visite(n.body, p2, n, 'body'); return; }
    for (const k of Object.keys(n)) {
      if (k === 'type' || k === 'loc' || k === 'start' || k === 'end' || (k === 'id' && /Function|Class/.test(n.type))) continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach((c) => visite(c, p2, n, k));
      else if (v && typeof v.type === 'string') visite(v, p2, n, k);
    }
  };
  // Dans un motif, seules les valeurs par défaut et les clés calculées sont des références.
  const visiteMotif = (p, pile) => {
    if (!p) return;
    if (p.type === 'AssignmentPattern') { visiteMotif(p.left, pile); visite(p.right, pile, p, 'right'); }
    else if (p.type === 'ObjectPattern') p.properties.forEach((q) => { if (q.type === 'RestElement') visiteMotif(q.argument, pile); else { if (q.computed) visite(q.key, pile, q, 'key'); visiteMotif(q.value, pile); } });
    else if (p.type === 'ArrayPattern') p.elements.forEach((e) => visiteMotif(e, pile));
    else if (p.type === 'RestElement') visiteMotif(p.argument, pile);
  };
  visite(ast, [ast], null, null);
  const libres = [];
  for (const r of refs) {
    if (!/^[A-Z]/.test(r.nom) || GLOBAUX.has(r.nom)) continue;
    let ok = false;
    for (let i = r.pile.length - 1; i >= 0 && !ok; i--) { const s = portees.get(r.pile[i]); if (s && s.has(r.nom)) ok = true; }
    if (!ok) libres.push(r);
  }
  return libres;
}

function analyser(src, nomFichier) {
  // jsx 'automatic' (comme vite) : <Icon/> devient _jsx(Icon) — une référence ordinaire. Pas de minification,
  // pas de renommage utile : esbuild garde les noms ; une collision est renommée (Icon → Icon2) et reste juste.
  const { code } = esbuild.transformSync(src, { loader: /\.jsx$/.test(nomFichier) ? 'jsx' : 'js', jsx: 'automatic', format: 'esm', sourcefile: nomFichier, sourcemap: false, target: 'es2022' });
  return libresDe(code);
}

const rouges = [];
let n = 0;
if (process.argv.includes('--prouve')) {
  const f = path.join(RACINE, 'src/natif/RetraitsPoints.jsx');
  const src = fs.readFileSync(f, 'utf8').replace(/function Contenu\(\{([^}]*), Icon = null \}\)/, 'function Contenu({$1})');
  const l = analyser(src, f);
  const ok = l.some((r) => r.nom === 'Icon');
  console.log(ok ? '✅ mutation « Contenu sans son paramètre Icon » : rouge, comme attendu' : '❌ mutation non vue : l’audit ne peut pas échouer');
  process.exit(ok ? 0 : 1);
}
for (const f of fichiers(path.join(RACINE, 'src'))) {
  const src = fs.readFileSync(f, 'utf8');
  n++;
  let l;
  try { l = analyser(src, f); } catch (e) { rouges.push(`${path.relative(RACINE, f)} : illisible (${String(e.message).slice(0, 120)})`); continue; }
  const vus = new Set();
  for (const r of l) { if (vus.has(r.nom)) continue; vus.add(r.nom); rouges.push(`${path.relative(RACINE, f)} : « ${r.nom} » n'est déclaré nulle part (ligne ${r.ligne} du code transformé)`); }
}
if (rouges.length) { console.log(`❌ identifiants libres : ${rouges.length} sur ${n} fichiers`); rouges.forEach((r) => console.log('  ✗ ' + r)); process.exit(1); }
console.log(`✅ identifiants libres : aucun sur ${n} fichiers de src/`);
