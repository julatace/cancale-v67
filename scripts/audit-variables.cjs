// ⚠️ CONTRÔLE PERMANENT — AUCUNE VARIABLE UTILISÉE SANS ÊTRE DÉCLARÉE.
// C'est la troisième fois que cette famille casse un écran en production, et
// AUCUN des filets existants ne la voit :
//   §26    « reel is not defined »   → écran Ventes en erreur
//   §5.42  `useRef` pas importé      → écran Annonces en erreur
//   §5.72  « overdue is not defined »→ écran Colis en erreur, depuis §5.64
// `npm run build` compile (la syntaxe est valable), et un smoke ne la voit que
// si les DONNÉES font entrer dans le bloc conditionnel fautif. Ici on lit le
// code : chaque identifiant lu doit être déclaré quelque part dans sa portée,
// importé, ou être un global du navigateur.
const fs = require('fs'), path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const GLOBAUX = new Set([
  'window','document','navigator','location','history','screen','console','fetch','Headers','Request','Response',
  'localStorage','sessionStorage','indexedDB','caches','crypto','performance','URL','URLSearchParams','Blob','File',
  'FileReader','FormData','AbortController','Image','Audio','Notification','ServiceWorker','WebSocket','Worker',
  'setTimeout','clearTimeout','setInterval','clearInterval','requestAnimationFrame','cancelAnimationFrame','queueMicrotask',
  'alert','confirm','prompt','atob','btoa','structuredClone','matchMedia','getComputedStyle','scrollTo','open','close','print',
  'Object','Array','String','Number','Boolean','Symbol','BigInt','Math','JSON','Date','RegExp','Error','TypeError',
  'RangeError','SyntaxError','Promise','Set','Map','WeakSet','WeakMap','Proxy','Reflect','Intl','globalThis',
  'ArrayBuffer','Uint8Array','Uint8ClampedArray','Int8Array','Uint16Array','Int16Array','Uint32Array','Int32Array',
  'Float32Array','Float64Array','DataView','TextEncoder','TextDecoder','isNaN','isFinite','parseInt','parseFloat',
  'encodeURIComponent','decodeURIComponent','encodeURI','decodeURI','NaN','Infinity','undefined','arguments',
  'process','module','require','exports','__dirname','__filename','import','self','top','parent','frames',
  'CustomEvent','Event','MouseEvent','KeyboardEvent','PointerEvent','DOMParser','XMLHttpRequest','MutationObserver',
  'IntersectionObserver','ResizeObserver','Element','HTMLElement','HTMLCanvasElement','HTMLInputElement','Node','NodeList',
  'CSS','SVGElement','canvas','OffscreenCanvas','ImageData','Path2D','WebGLRenderingContext','AbortSignal','ReadableStream',
]);

const fichiers = process.argv.slice(2).length ? process.argv.slice(2)
  : ['src/App.jsx', 'src/main.jsx'].map(f => path.join(__dirname, '..', f)).filter(fs.existsSync);

let ko = 0;
for (const f of fichiers) {
  const code = fs.readFileSync(f, 'utf8');
  let ast;
  try {
    ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx', 'classProperties', 'optionalChaining', 'nullishCoalescingOperator', 'topLevelAwait'] });
  } catch (e) { console.log(`❌ ${path.basename(f)} — illisible : ${e.message}`); ko++; continue; }
  const trouves = [];
  traverse(ast, {
    Program(p) {
      for (const nom of Object.keys(p.scope.globals)) {
        if (GLOBAUX.has(nom)) continue;
        const noeud = p.scope.globals[nom];
        trouves.push({ nom, ligne: noeud && noeud.loc ? noeud.loc.start.line : 0 });
      }
    },
  });
  // Une même variable peut être lue à plusieurs endroits : on ne la nomme qu'une fois.
  const vus = new Map();
  for (const t of trouves) if (!vus.has(t.nom)) vus.set(t.nom, t.ligne);
  if (vus.size) {
    ko += vus.size;
    console.log(`❌ ${path.basename(f)} — ${vus.size} identifiant(s) jamais déclaré(s) :`);
    for (const [nom, ligne] of vus) console.log(`     ${nom}  (ligne ${ligne})`);
  } else {
    console.log(`✅ ${path.basename(f)} — aucune variable utilisée sans déclaration`);
  }
}
console.log(ko ? `\n${ko} identifiant(s) à corriger — l'écran concerné tombera dès que les données feront entrer dans ce bloc.`
               : "\nAucune variable fantôme : un écran ne peut plus tomber sur un « X is not defined ».");
process.exit(ko ? 1 : 0);
