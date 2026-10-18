// compat-firefox.js — ajouté par `scripts/zip-extension.cjs --firefox` en TÊTE
// de chaque script de l'extension (fond, scripts de contenu, fenêtre de
// l'icône), dans le paquet Firefox SEULEMENT. Le paquet Chrome / Edge / Opera
// n'en a pas besoin et ne le contient pas.
//
// Le code de l'extension appelle `chrome.*` de DEUX façons : avec un rappel
// (`chrome.cookies.get(d, (c) => …)`) et en attendant une promesse
// (`await chrome.storage.local.get(k)`). Firefox accepte les deux sur
// `browser.*`… sauf le rappel ; et sur `chrome.*`, le rappel toujours, la
// promesse selon la version. On ne devine pas : on MESURE une fois, ici.
//   · `chrome.*` rend déjà une promesse sans rappel ⇒ on ne touche à RIEN ;
//   · sinon, chaque appel SANS rappel part sur `browser.*` (promesse), et
//     chaque appel AVEC rappel reste sur `chrome.*` (rappel) — le même objet,
//     les mêmes arguments, rien d'autre n'est réécrit.
// Sans `browser` (Chrome, Edge, Opera, Brave) ce fichier ne fait rien.
(function () {
  'use strict';
  const g = typeof globalThis !== 'undefined' ? globalThis : self;
  let b = null, c = null;
  try { b = (typeof browser !== 'undefined' && browser && browser.runtime) ? browser : null; } catch (_) { b = null; }
  try { c = (typeof chrome !== 'undefined' && chrome && chrome.runtime) ? chrome : null; } catch (_) { c = null; }
  if (!b) return;                       // pas Firefox : rien à faire
  if (g.__vrmCompat) return;            // déjà posé dans ce monde
  g.__vrmCompat = true;
  if (!c) { try { g.chrome = b; } catch (_) {} return; }
  // La mesure : `storage` existe dans le fond, les scripts de contenu et la
  // fenêtre (permission « storage »). Une promesse ⇒ rien à adapter.
  let promesses = false;
  try {
    const r = c.storage && c.storage.local && c.storage.local.get('__vrm_sonde_compat');
    promesses = !!(r && typeof r.then === 'function');
    if (promesses) r.catch(() => {});
  } catch (_) { promesses = false; }
  if (promesses) return;
  const ECOUTE = /^(addListener|removeListener|hasListener|hasListeners)$/;
  const cache = new WeakMap();
  const enveloppe = (natif, promesse) => {
    if (!natif || (typeof natif !== 'object' && typeof natif !== 'function')) return natif;
    if (cache.has(natif)) return cache.get(natif);
    const p = new Proxy(natif, {
      get(cible, cle) {
        const v = cible[cle];
        const vp = promesse ? promesse[cle] : undefined;
        if (typeof v === 'function') {
          return function (...args) {
            const rappel = args.length && typeof args[args.length - 1] === 'function';
            if (ECOUTE.test(String(cle)) || rappel || typeof vp !== 'function') return v.apply(cible, args);
            return vp.apply(promesse, args);
          };
        }
        if (v && typeof v === 'object') return enveloppe(v, vp && typeof vp === 'object' ? vp : null);
        return v;
      },
    });
    cache.set(natif, p);
    return p;
  };
  const adapte = enveloppe(c, b);
  try { g.chrome = adapte; } catch (_) {}
  if (g.chrome !== adapte) { try { Object.defineProperty(g, 'chrome', { value: adapte, configurable: true, writable: true }); } catch (_) {} }
})();
