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
    // Facturation / porte-monnaie : c'est là que Vinted liste tes dépenses de
    // BOOST (remontées d'annonce, mise en avant du dressing). Capté passivement
    // quand tu ouvres ton porte-monnaie / ta facturation → l'app calcule ton
    // bénéfice NET tout seul. Motif large (plusieurs noms selon la version).
    { re: /\/(wallet|invoices?|billing|bumps?|item_bumps|push_ups?|dressing_spotlight|vas_entries|payments?)/i, type: 'billing' },
    // Points relais que Vinted te propose quand tu choisis un relais (achat) :
    // c'est SA liste officielle, complète, autour de l'adresse de livraison. On
    // la capte passivement pour l'afficher sur la carte. Motif large (Vinted a
    // plusieurs noms d'endpoint selon le transporteur / la version).
    { re: /pickup[_-]?points?|pudo|drop[_-]?off[_-]?points?|shipping[_-]?points?|parcel[_-]?shops?|point[_-]?of[_-]?delivery|delivery[_-]?points?/i, type: 'pickup_points' },
  ];
  const matchHarvest = (url) => {
    for (const h of HARVEST) {
      const m = h.re.exec(url);
      if (!m) continue;
      let type = h.type;
      // Pour les commandes, on distingue achats et ventes via le param ?type=
      // (ex: my_orders?type=sold -> "orders_sold"), sinon elles s'ecraseraient.
      if (type === 'orders') {
        const t = /[?&]type=([^&]+)/.exec(url);
        type = 'orders_' + (t ? decodeURIComponent(t[1]) : 'all');
      }
      return { type, id: m[1] || null };
    }
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

  // CAPTURE PASSIVE DES REQUETES D'ECRITURE. Toujours de l'OBSERVATION pure : on
  // note la forme des requetes que TU declenches quand tu agis sur Vinted
  // (baisser un prix, repondre a un message...). Ca sert a l'app pour reproduire
  // ensuite exactement la meme action en 1 clic, sans jamais deviner. On exclut
  // le bruit (tracking/metrics) et on ne garde que les vraies actions API.
  const WRITE_METHODS = /^(POST|PUT|PATCH|DELETE)$/i;
  const WRITE_NOISE = /(track|metric|event|impression|visit|telemetr|analytic|log|pageview|consent)/i;
  const sendWriteReq = (method, url, body) => {
    try {
      if (!WRITE_METHODS.test(method || '')) return;
      if (!/\/api\//.test(url || '')) return;
      if (WRITE_NOISE.test(url)) return;
      let b = body;
      if (b && typeof b !== 'string') {
        if (typeof URLSearchParams !== 'undefined' && b instanceof URLSearchParams) b = b.toString();
        else if (typeof FormData !== 'undefined' && b instanceof FormData) b = '[FormData]';
        else { try { b = JSON.stringify(b); } catch (_) { b = String(b); } }
      }
      if (b && b.length > 100000) b = b.slice(0, 100000);
      post({ kind: 'writereq', method: String(method).toUpperCase(), url, body: b || '' });
    } catch (_) {}
  };

  // Convertit un ArrayBuffer en base64 (par morceaux pour eviter le débordement
  // de pile sur les gros PDF).
  const abToB64 = (buf) => {
    let binary = '';
    const bytes = new Uint8Array(buf);
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  };
  // Capture un BORDEREAU (PDF) que Vinted renvoie quand tu le telecharges. On
  // repere par le content-type application/pdf (l'URL du label n'est pas connue
  // d'avance). Sert a tamponner automatiquement le bordereau cote app.
  const maybeCaptureLabel = (contentType, url, getArrayBuffer) => {
    try {
      if (!/application\/pdf/i.test(contentType || '')) return;
      getArrayBuffer().then((buf) => {
        if (buf && buf.byteLength && buf.byteLength < 4000000) {
          post({ kind: 'label', url, b64: abToB64(buf) });
        }
      }).catch(() => {});
    } catch (_) {}
  };

  // --- Patch de fetch ---
  const origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function (input, init) {
      try {
        const url = (typeof input === 'string') ? input : (input && input.url) || '';
        if (init && init.headers) sendCsrf(init.headers);
        else if (input && input.headers) sendCsrf(input.headers);
        const method = (init && init.method) || (input && input.method) || 'GET';
        sendWriteReq(method, url, init && init.body);
        const p = origFetch.apply(this, arguments);
        p.then((res) => {
          try {
            const ct = (res.headers && res.headers.get) ? (res.headers.get('content-type') || '') : '';
            if (/application\/pdf/i.test(ct)) {
              maybeCaptureLabel(ct, url, () => res.clone().arrayBuffer());
            } else if (url && matchHarvest(url)) {
              res.clone().text().then((t) => sendHarvest(url, t)).catch(() => {});
            }
          } catch (_) {}
        }).catch(() => {});
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
      this.__cancaleMethod = method;
      return origOpen.apply(this, arguments);
    };
    XHR.prototype.setRequestHeader = function (name, value) {
      try { if (String(name).toLowerCase() === 'x-csrf-token' && value) post({ kind: 'csrf', csrf: value }); } catch (_) {}
      return origSetHeader.apply(this, arguments);
    };
    XHR.prototype.send = function (bodyArg) {
      try {
        const url = this.__cancaleUrl || '';
        sendWriteReq(this.__cancaleMethod, url, bodyArg);
        this.addEventListener('load', function () {
          try {
            const ct = this.getResponseHeader ? (this.getResponseHeader('content-type') || '') : '';
            // Bordereau PDF via XHR (si Vinted le charge en binaire).
            if (/application\/pdf/i.test(ct) && this.response && this.response.byteLength) {
              maybeCaptureLabel(ct, url, () => Promise.resolve(this.response));
            } else if (url && matchHarvest(url) && typeof this.responseText === 'string') {
              sendHarvest(url, this.responseText);
            }
          } catch (_) {}
        });
      } catch (_) {}
      return origSend.apply(this, arguments);
    };
  }
})();
