#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// AUCUN NOM HORS PORTÉE DANS L'APP NI L'EXTENSION — node scripts/audit-portee-modules.cjs [--prouve]
// ═══════════════════════════════════════════════════════════════════════════
// (20 nov., chasse-bugs) `npm run build` ne voit pas un nom LU qui n'est déclaré nulle part (CLAUDE.md §4.8) : Vite
// compile, l'écran tombe à l'exécution (ReferenceError). Mesuré : `src/accueil-mouvement.js` ré-exportait
// `useMoinsDeMouvement` (`export { x } from '…'`, qui ne crée AUCUN nom local) et `useScene` l'appelait ⇒ chaque
// scène de la page d'accueil plantait depuis le 16 nov.
// Méthode : chaque fichier de src/, api/ et vinted-sync-extension/ est lu par Babel ; chaque identifiant LU doit être
// lié à une portée (déclaration, import, paramètre) ou être un global connu du navigateur / du service worker / de
// Node. `--prouve` : retirer l'import corrigé ⇒ rouge.
'use strict';
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..');
const parser = require(path.join(R, 'node_modules', '@babel', 'parser'));
const traverse = require(path.join(R, 'node_modules', '@babel', 'traverse')).default;

// Les globaux d'un navigateur, d'un service worker MV3 et de Node que le code lit (tout le reste doit être déclaré).
const GLOBAUX = new Set(Object.getOwnPropertyNames(globalThis).concat(`chrome browser self window document navigator location fetch
  Request Response Headers importScripts clients registration caches crypto atob btoa console localStorage sessionStorage indexedDB
  Blob File FileReader FormData AbortController DOMParser MutationObserver IntersectionObserver ResizeObserver PerformanceObserver
  CustomEvent Event KeyboardEvent MouseEvent PointerEvent TouchEvent DragEvent InputEvent FocusEvent WheelEvent ErrorEvent
  PromiseRejectionEvent StorageEvent BeforeUnloadEvent HashChangeEvent PopStateEvent DataTransfer ClipboardItem Image Option Audio
  HTMLElement HTMLInputElement HTMLTextAreaElement HTMLSelectElement HTMLCanvasElement HTMLImageElement HTMLVideoElement
  HTMLAnchorElement HTMLDialogElement HTMLButtonElement HTMLFormElement HTMLScriptElement HTMLLinkElement HTMLIFrameElement
  HTMLMediaElement SVGElement ShadowRoot Element Node NodeFilter Text DocumentFragment Range Selection getSelection CSS CSSStyleSheet
  getComputedStyle requestAnimationFrame cancelAnimationFrame requestIdleCallback cancelIdleCallback performance history screen
  alert confirm prompt matchMedia innerWidth innerHeight outerWidth scrollX scrollY pageYOffset scrollTo devicePixelRatio
  visualViewport top parent opener frames origin open close postMessage addEventListener removeEventListener dispatchEvent name
  status XMLHttpRequest WebSocket EventSource BroadcastChannel MessageChannel Notification ServiceWorkerRegistration PushManager
  NavigationPreloadManager ReadableStream TransformStream CompressionStream DecompressionStream Worker OffscreenCanvas
  createImageBitmap ImageData ImageDecoder VideoFrame Path2D DOMMatrix DOMMatrixReadOnly CanvasRenderingContext2D MediaRecorder
  MediaStream AudioContext webkitAudioContext SpeechRecognition webkitSpeechRecognition BarcodeDetector PublicKeyCredential
  IDBKeyRange EventTarget ScrollTimeline ViewTransition Translator LanguageDetector ontouchstart onerror arguments undefined
  module require process exports __dirname __filename Buffer __BUILD__`.split(/\s+/).filter(Boolean)));

function fichiers() {
  const out = [];
  const voir = (d) => {
    let noms = []; try { noms = fs.readdirSync(path.join(R, d)); } catch (_) { return; }
    for (const n of noms) {
      const rel = path.join(d, n);
      const st = fs.statSync(path.join(R, rel));
      if (st.isDirectory()) { if (!/node_modules|i18n[\\/]langues|vendor/.test(rel)) voir(rel); }
      else if (/\.(jsx?|mjs)$/.test(n)) out.push(rel);
    }
  };
  voir('src'); voir('api'); voir('vinted-sync-extension');
  return out;
}

function horsPortee(rel, texte) {
  const ext = rel.startsWith('vinted-sync-extension') && !/\.mjs$/.test(rel);
  let ast;
  try { ast = parser.parse(texte, { sourceType: ext ? 'script' : 'module', plugins: ['jsx'], errorRecovery: true, allowReturnOutsideFunction: true }); }
  catch (e) { return [`(illisible : ${e.message.slice(0, 80)})`]; }
  const manque = [];
  traverse(ast, {
    ReferencedIdentifier(p) {
      const n = p.node.name;
      if (GLOBAUX.has(n) || p.scope.hasBinding(n, true)) return;
      if (p.parentPath.isMemberExpression({ property: p.node }) && !p.parent.computed) return;
      // `typeof x` : un test d'existence, permis.
      if (p.parentPath.isUnaryExpression({ operator: 'typeof' })) return;
      manque.push(`${n} (l.${p.node.loc ? p.node.loc.start.line : '?'})`);
    },
  });
  return [...new Set(manque)];
}

function verifier(lire) {
  const rouges = [];
  for (const rel of fichiers()) {
    const m = horsPortee(rel, lire(rel));
    if (m.length) rouges.push(`${rel} : ${m.slice(0, 5).join(', ')}`);
  }
  return rouges;
}

const lireVrai = (rel) => fs.readFileSync(path.join(R, rel), 'utf8');
if (process.argv.includes('--prouve')) {
  const mute = (rel) => {
    const t = lireVrai(rel);
    return rel === path.join('src', 'accueil-mouvement.js') ? t.replace(/^import \{ useMoinsDeMouvement, useSansSouris \} from '\.\/accueil-media\.js';\n/m, '') : t;
  };
  const r = verifier(mute);
  const ok = r.some((x) => /accueil-mouvement\.js : useMoinsDeMouvement/.test(x));
  console.log(`${ok ? '✅' : '❌'} mutation « ré-export sans import » ⇒ ${ok ? 'ROUGE' : 'encore vert'}`);
  process.exit(ok ? 0 : 1);
}
const r = verifier(lireVrai);
for (const x of r) console.log('❌ ' + x);
console.log(r.length ? `❌ audit-portee-modules : ${r.length} fichier(s) lisent un nom déclaré nulle part` : '✅ audit-portee-modules : chaque nom lu est déclaré, importé ou global');
process.exit(r.length ? 1 : 0);
