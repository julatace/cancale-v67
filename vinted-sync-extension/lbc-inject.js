// lbc-inject.js — tourne dans le MAIN world de leboncoin.fr.
// OBSERVATION PURE : on enveloppe fetch/XHR pour LIRE les réponses que la page
// charge déjà (tes annonces), sans faire la moindre requête en plus. On envoie
// les réponses « annonces » au content script (lbc.js) qui les relaie au
// background. Un mouchard note aussi les chemins d'API vus (pour brancher juste).
(function () {
  'use strict';
  const TAG = 'CANCALE_LBC';
  const post = (payload) => { try { window.postMessage(Object.assign({ __tag: TAG }, payload), '*'); } catch (_) {} };

  // Une réponse « intéressante » = du JSON qui parle d'annonces. On reste large
  // (Leboncoin a plusieurs endpoints) mais on évite le bruit (pub, tracking).
  const AD_HINT = /(list_id|\"ads\"|\"subject\"|annonce|myads|\/ads|classified|listing|dashboard|selection|owner)/i;
  const NOISE = /(datadome|captcha|track|metric|event|telemetr|analytic|consent|pixel|gtm|batch\.bmcdn|xiti|adservice)/i;
  const seenPaths = new Set(); let seenDirty = false;
  const noteSeen = (url) => {
    try {
      let p = url; try { p = new URL(url, location.origin).host + new URL(url, location.origin).pathname; } catch (_) { p = String(url).split('?')[0]; }
      p = p.replace(/\/\d{3,}/g, '/{id}');
      if (!seenPaths.has(p)) { seenPaths.add(p); seenDirty = true; }
    } catch (_) {}
  };
  setInterval(() => { if (seenDirty) { seenDirty = false; post({ kind: 'lbcpaths', paths: [...seenPaths].slice(0, 200) }); } }, 4000);

  const handle = (url, text, ctype) => {
    try {
      noteSeen(url);
      if (NOISE.test(url)) return;
      if (!text || text.length > 1500000) return;
      if (ctype && !/json/i.test(ctype)) return;
      if (!AD_HINT.test(text) && !AD_HINT.test(url)) return;
      post({ kind: 'lbcraw', url, body: text });
    } catch (_) {}
  };

  const origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function (input, init) {
      const url = (typeof input === 'string') ? input : (input && input.url) || '';
      const p = origFetch.apply(this, arguments);
      try {
        p.then((res) => {
          try {
            const ct = res.headers && res.headers.get && res.headers.get('content-type');
            if (/vinted|supabase/i.test(url)) return; // ne touche pas aux autres domaines
            res.clone().text().then((t) => handle(url, t, ct)).catch(() => {});
          } catch (_) {}
        }).catch(() => {});
      } catch (_) {}
      return p;
    };
  }

  const OX = window.XMLHttpRequest;
  if (OX) {
    const origOpen = OX.prototype.open, origSend = OX.prototype.send;
    OX.prototype.open = function (method, url) { this.__lbcUrl = url; return origOpen.apply(this, arguments); };
    OX.prototype.send = function () {
      try {
        this.addEventListener('load', function () {
          try {
            const url = this.__lbcUrl || '';
            if (/vinted|supabase/i.test(url)) return;
            const ct = this.getResponseHeader && this.getResponseHeader('content-type');
            const t = (this.responseType === '' || this.responseType === 'text') ? this.responseText : null;
            if (t) handle(url, t, ct);
          } catch (_) {}
        });
      } catch (_) {}
      return origSend.apply(this, arguments);
    };
  }
})();
