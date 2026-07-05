// content.js — tourne dans le monde "isole" de l'extension sur la page vinted.fr.
// Role : (1) injecter inject.js dans le MAIN world pour observer les requetes ;
//        (2) relayer les messages d'inject.js vers le service worker (background)
//            qui, lui, ecrit dans Supabase.
// content.js ne fait AUCUN appel a Vinted.
(function () {
  'use strict';
  const TAG = 'CANCALE_VINTED';

  // Injecte inject.js dans le MAIN world (via un <script> pointant sur la
  // ressource web-accessible de l'extension). C'est la seule facon d'observer
  // les vraies requetes fetch/XHR du site.
  try {
    const s = document.createElement('script');
    s.src = chrome.runtime.getURL('inject.js');
    s.onload = function () { this.remove(); };
    (document.head || document.documentElement).appendChild(s);
  } catch (_) {}

  // Relaie les messages d'inject.js (csrf + donnees moissonnees) au background.
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const d = event.data;
    if (!d || d.__tag !== TAG) return;
    try {
      chrome.runtime.sendMessage({
        from: 'cancale-content',
        kind: d.kind,
        type: d.type,
        id: d.id,
        url: d.url,
        body: d.body,
        csrf: d.csrf,
        domain: location.host,
      });
    } catch (_) { /* le service worker peut etre endormi, on ignore */ }
  }, false);
})();
