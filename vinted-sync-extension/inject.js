// inject.js — tourne dans le "MAIN world" de la page vinted.fr (le meme monde
// que le JavaScript du site), ce qui permet d'observer les vraies requetes que
// la page fait deja. On NE declenche AUCUNE requete : on se contente de
// regarder passer ce que Vinted envoie deja au navigateur quand tu navigues.
//
// Deux choses capturees :
//   1) le header 'x-csrf-token' des requetes (introuvable autrement) ;
//   2) le CORPS des reponses des endpoints utiles (annonces, ventes, messages,
//      profil) — c'est la "capture passive" : la donnee est deja la, on la lit.
//
// Tout est renvoye a content.js via window.postMessage (le seul canal entre le
// MAIN world et l'extension).
(function () {
  'use strict';
  if (window.__cancaleVintedInjected) return;
  window.__cancaleVintedInjected = true;

  const TAG = 'CANCALE_VINTED';

  // Endpoints dont on veut garder la reponse, avec le "type" de donnee associe.
  const HARVEST = [
    { re: /\/api\/v2\/wardrobe\/(\d+)\/items/, type: 'listings' },
    { re: /\/api\/v2\/my_orders/,               type: 'orders'   },
    { re: /\/api\/v2\/inbox/,                   type: 'inbox'    },
    { re: /\/api\/v2\/conversations\/(\d+)/,    type: 'conversation' },
    { re: /\/api\/v2\/users\/current/,          type: 'profile'  },
  ];
  const matchHarvest = (url) => {
    for (const h of HARVEST) { const m = h.re.exec(url); if (m) return { type: h.type, id: m[1] || null }; }
    return null;
  };

  const post = (payload) => {
    try { window.postMessage(Object.assign({ __tag: TAG }, payload), '*'); } catch (_) {}
  };

  const sendCsrf = (headers) => {
    try {
      let csrf = null;
      if (headers instanceof Headers) csrf = headers.get('x-csrf-token');
      else if (headers && typeof headers === 'object') {
        for (const k in headers) { if (k.toLowerCase() === 'x-csrf-token') { csrf = headers[k]; break; } }
      }
      if (csrf) post({ kind: 'csrf', csrf });
    } catch (_) {}
  };

  const sendHarvest = (url, text) => {
    const h = matchHarvest(url);
    if (!h) return;
    // On limite la taille pour ne pas saturer (les reponses Vinted sont petites).
    if (text && text.length < 800000) post({ kind: 'harvest', type: h.type, id: h.id, url, body: text });
  };

  // --- Patch de fetch ---
  const origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function (input, init) {
      try {
        const url = (typeof input === 'string') ? input : (input && input.url) || '';
        if (init && init.headers) sendCsrf(init.headers);
        else if (input && input.headers) sendCsrf(input.headers);
        const p = origFetch.apply(this, arguments);
        if (url && matchHarvest(url)) {
          p.then((res) => {
            try { res.clone().text().then((t) => sendHarvest(url, t)).catch(() => {}); } catch (_) {}
          }).catch(() => {});
        }
        return p;
      } catch (_) {
        return origFetch.apply(this, arguments);
      }
    };
  }

  // --- Patch de XMLHttpRequest ---
  const XHR = window.XMLHttpRequest;
  if (XHR) {
    const origOpen = XHR.prototype.open;
    const origSend = XHR.prototype.send;
    const origSetHeader = XHR.prototype.setRequestHeader;
    XHR.prototype.open = function (method, url) {
      this.__cancaleUrl = url;
      return origOpen.apply(this, arguments);
    };
    XHR.prototype.setRequestHeader = function (name, value) {
      try { if (String(name).toLowerCase() === 'x-csrf-token' && value) post({ kind: 'csrf', csrf: value }); } catch (_) {}
      return origSetHeader.apply(this, arguments);
    };
    XHR.prototype.send = function () {
      try {
        const url = this.__cancaleUrl || '';
        if (url && matchHarvest(url)) {
          this.addEventListener('load', function () {
            try { if (typeof this.responseText === 'string') sendHarvest(url, this.responseText); } catch (_) {}
          });
        }
      } catch (_) {}
      return origSend.apply(this, arguments);
    };
  }
})();
