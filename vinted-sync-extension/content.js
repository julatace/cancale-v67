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
  // ⚠️⚠️ IL RELAYAIT UNE LISTE DE CHAMPS FIXE, ET JETAIT LE RESTE EN SILENCE.
  // Mesuré le 19 septembre : `inject.js` envoyait bien `reponses` (les codes de
  // réponse HTTP, la mesure qui devait dire si la requête d'export part et se
  // fait refuser) — et ce relais ne recopiait que `paths`. La donnée mourait
  // ici, entre deux fichiers qui avaient tous les deux raison.
  // C'est le défaut de `storeLbcRecon` (qui rangeait clé par clé et perdait
  // `etapes`), exactement, une couche plus tôt. *Un raccord qui énumère ne
  // transporte que ce qu'on a pensé à écrire.*
  // ⇒ On recopie TOUT ce que la page envoie, sauf son étiquette. `from` et
  //   `domain` restent posés par NOUS : la page ne doit pas pouvoir les dicter.
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const d = event.data;
    if (!d || d.__tag !== TAG) return;
    try {
      const m = {};
      for (const k of Object.keys(d)) {
        if (k === '__tag' || k === 'from' || k === 'domain') continue;
        m[k] = d[k];
      }
      m.from = 'cancale-content';
      m.domain = location.host;
      chrome.runtime.sendMessage(m);
    } catch (_) { /* le service worker peut etre endormi, on ignore */ }
  }, false);
})();
