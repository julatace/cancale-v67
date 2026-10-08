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
  // ⚠️ 5.162 — LA PAUSE DEMANDÉE PAR VINTED (429/403) VAUT AUSSI POUR LA
  // MOISSON FAITE DANS LA PAGE. Elle est rangée par le fond dans
  // `chrome.storage.local` (`vrmPauseVinted`) ; `inject.js` (monde MAIN) n'y a
  // pas accès : on lui transmet la fin de la pause — un nombre, rien d'autre —
  // une fois qu'il est chargé, puis à chaque changement.
  let injecte = false, pauseFin = null;
  const direPause = () => {
    if (!injecte || pauseFin == null) return;
    try { window.postMessage({ __tag: 'CANCALE_VINTED_PAUSE', jusqua: pauseFin }, '*'); } catch (_) {}
  };
  try {
    chrome.storage.local.get('vrmPauseVinted', (o) => {
      try { pauseFin = Number(((o && o.vrmPauseVinted) || {}).jusqua) || 0; direPause(); } catch (_) {}
    });
    chrome.storage.onChanged.addListener((ch, zone) => {
      try {
        if (zone !== 'local' || !ch || !ch.vrmPauseVinted) return;
        pauseFin = Number((ch.vrmPauseVinted.newValue || {}).jusqua) || 0; direPause();
      } catch (_) {}
    });
  } catch (_) {}

  try {
    const s = document.createElement('script');
    s.src = chrome.runtime.getURL('inject.js');
    s.onload = function () { this.remove(); injecte = true; direPause(); };
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
