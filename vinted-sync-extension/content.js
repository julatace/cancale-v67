// content.js — tourne dans le monde "isole" de l'extension sur la page vinted.fr.
// Role : (1) injecter inject.js dans le MAIN world pour observer les requetes ;
//        (2) relayer les messages d'inject.js vers le service worker (background)
//            qui, lui, ecrit dans Supabase.
// content.js ne fait AUCUN appel a Vinted.
(function () {
  'use strict';
  const TAG = 'CANCALE_VINTED';

  // Injecte inject.js dans le MAIN world (via un <script> pointant sur la
  // ressource web-accessible de l'extension), en secours du script MAIN posé
  // directement par le manifeste à document_start. Sa garde évite le doublon.
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
    if(d.kind==='injectReady'){injecte=true;direPause();return;}
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

  // ── NAVIGATEUR SANS API `cookies` / SANS MONDE MAIN (20 octobre, Orion) ──
  // (1) Les cookies de session : le fond demande s'il en a besoin (`veux`) —
  //     sur Chrome il répond non et RIEN d'autre ne part. Sinon on lui donne
  //     les trois cookies que la page voit, à l'ouverture puis à chaque
  //     changement (toutes les 10 s tant que la page est visible, et au retour
  //     au premier plan : iOS suspend tout en arrière-plan).
  // (2) Le relais de la page : une requête GET demandée par le fond part
  //     d'inject.js (monde MAIN) et sa réponse revient ici.
  const NOMS = ['access_token_web', 'refresh_token_web', 'anon_id'];
  const lireCookies = () => {
    const c = {};
    try {
      for (const part of String(document.cookie || '').split(';')) {
        const i = part.indexOf('='); if (i < 0) continue;
        const k = part.slice(0, i).trim();
        if (NOMS.includes(k)) { try { c[k] = decodeURIComponent(part.slice(i + 1).trim()); } catch (_) { c[k] = part.slice(i + 1).trim(); } }
      }
    } catch (_) {}
    return c;
  };
  let dernierEnvoi = null;
  const envoyerCookies = () => {
    try {
      const c = lireCookies(); const sig = JSON.stringify(c);
      if (sig === dernierEnvoi) return;
      chrome.runtime.sendMessage({ from: 'vrm-cookies', domain: location.hostname, c }, (r) => {
        void (chrome.runtime && chrome.runtime.lastError);
        if (r && r.ok) dernierEnvoi = sig;
      });
    } catch (_) {}
  };
  try {
    chrome.runtime.sendMessage({ from: 'vrm-cookies', action: 'veux' }, (r) => {
      void (chrome.runtime && chrome.runtime.lastError);
      if (!r || !r.veux) return;
      envoyerCookies();
      setInterval(() => { if (document.visibilityState !== 'hidden') envoyerCookies(); }, 10000);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { dernierEnvoi = null; envoyerCookies(); } });
    });
  } catch (_) {}

  const enAttente = new Map();
  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || event.data.__tag !== 'CANCALE_VINTED_REP') return;
    const f = enAttente.get(String(event.data.id || ''));
    if (f) { enAttente.delete(String(event.data.id)); f(event.data); }
  }, false);
  const demanderPage = (req) => new Promise((res) => {
    const id = String((req && req.id) || '');
    if (!id || !/(^|\.)vinted\.[a-z.]+$/i.test(location.hostname)) { res(null); return; }
    const t = setTimeout(() => { enAttente.delete(id); res(null); }, 20000);
    enAttente.set(id, (d) => { clearTimeout(t); res({ id, status: d.status, ok: d.ok, json: d.json, origine: d.origine }); });
    try { window.postMessage({ __tag: 'CANCALE_VINTED_REQ', id, p: req.p, h: req.h }, location.origin); } catch (_) { enAttente.delete(id); clearTimeout(t); res(null); }
  });
  try {
    chrome.runtime.onMessage.addListener((m, sender, sendResponse) => {
      if (!m || m.vrm !== 'fetchPage') return false;
      demanderPage(m).then(sendResponse, () => sendResponse(null));
      return true;
    });
  } catch (_) {}
  // La boîte aux lettres (navigateur sans `tabs.sendMessage`) : une demande
  // posée par le fond dans `chrome.storage.local`, prise par UN onglet Vinted.
  try {
    chrome.storage.onChanged.addListener((ch, zone) => {
      try {
        if (zone !== 'local' || !ch || !ch.vrmPageReq) return;
        const req = ch.vrmPageReq.newValue;
        if (!req || req.vrm !== 'fetchPage' || Date.now() - Number(req.at || 0) > 20000) return;
        if (document.visibilityState === 'hidden') return;   // l'onglet visible répond
        demanderPage(req).then((o) => { if (o) chrome.storage.local.set({ vrmPageRep: o }); });
      } catch (_) {}
    });
  } catch (_) {}
})();
