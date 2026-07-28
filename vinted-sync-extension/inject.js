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
  // ⚠️ Motifs volontairement TOLÉRANTS à la version d'API (v2, v3, …). Vinted a
  // migré une partie de son site vers /api/v3/ : les motifs figés sur /api/v2/
  // ne captaient plus rien pour les annonces / commandes / boîte de réception
  // (moisson bloquée pendant 18 jours sans que personne ne s'en aperçoive).
  const HARVEST = [
    { re: /\/api\/v\d+\/wardrobe\/(\d+)\/items/, type: 'listings' },
    // Variante « dressing » : certaines versions listent les articles d'un
    // utilisateur via /items?user_id=… au lieu de /wardrobe/{id}/items.
    { re: /\/api\/v\d+\/items\?[^]*user_id=(\d+)/, type: 'listings' },
    // Détail COMPLET d'un article : /api/v2/items/{id} → titre, DESCRIPTION,
    // marque, taille, état, couleur, matière, CATÉGORIE (catalog_id), dimensions
    // du colis, photos HD. Capté passivement quand tu ouvres une de tes annonces
    // (et complété activement, voir plus bas) → l'app a TOUT pour la republier.
    { re: /\/api\/v\d+\/items\/(\d+)(?:\?|$)/,   type: 'item'     },
    { re: /\/api\/v\d+\/my_orders/,             type: 'orders'   },
    { re: /\/api\/v\d+\/(?:inbox|conversations)(?:\?|$)/, type: 'inbox' },
    { re: /\/api\/v\d+\/conversations\/(\d+)/,  type: 'conversation' },
    // Détail d'une transaction (vente/achat) : c'est là que se trouve le VRAI
    // n° de suivi du colis (shipment / tracking_code), capté passivement quand tu
    // ouvres une commande ou télécharges un bordereau. Permet à l'app de fiabiliser
    // le suivi des bordereaux à 100 % (au lieu de le parser depuis l'email). On ne
    // matche QUE le détail (…/transactions/{id}), pas les sous-chemins (…/shipment/order).
    { re: /\/api\/v\d+\/transactions\/(\d+)(?:\?|$)/, type: 'transaction' },
    { re: /\/api\/v\d+\/users\/current/,        type: 'profile'  },
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

  let lastCsrf = null; // dernier x-csrf-token vu (réutilisé pour la moisson active)
  let lastAnon = null; // dernier x-anon-id vu
  const sendCsrf = (headers) => {
    try {
      let csrf = null;
      if (headers instanceof Headers) { csrf = headers.get('x-csrf-token'); const a = headers.get('x-anon-id'); if (a) lastAnon = a; }
      else if (headers && typeof headers === 'object') {
        for (const k in headers) { const kl = k.toLowerCase(); if (kl === 'x-csrf-token') csrf = headers[k]; else if (kl === 'x-anon-id') lastAnon = headers[k]; }
      }
      if (csrf) { lastCsrf = csrf; post({ kind: 'csrf', csrf }); }
    } catch (_) {}
  };

  // MOUCHARD D'ENDPOINTS (diagnostic). On note UNIQUEMENT le chemin des appels
  // API que la page fait (jamais le contenu, jamais les paramètres). Ça permet
  // de voir tout de suite quand Vinted renomme/déplace un endpoint, au lieu de
  // découvrir des semaines plus tard que la moisson est muette. Envoyé au plus
  // une fois par minute, liste dédupliquée.
  const seenPaths = new Set();
  let seenDirty = false;
  const noteSeen = (url) => {
    try {
      if (!/\/api\//.test(url)) return;
      let p = url;
      try { p = new URL(url, location.origin).pathname; } catch (_) { p = String(url).split('?')[0]; }
      // Les identifiants numériques deviennent {id} → la liste reste courte.
      p = p.replace(/\/\d{3,}/g, '/{id}');
      if (!seenPaths.has(p)) { seenPaths.add(p); seenDirty = true; }
    } catch (_) {}
  };
  const flushSeen = () => {
    if (!seenDirty || !seenPaths.size) return;
    seenDirty = false;
    post({ kind: 'seen_urls', paths: Array.from(seenPaths).slice(0, 300) });
  };
  // Envoi RAPIDE puis régulier : une page Vinted est souvent quittée avant 60 s,
  // et le diagnostic ne partait alors jamais. On envoie à 5 s, puis toutes les
  // 20 s, et aussi quand tu quittes/masques la page (dernière chance).
  setTimeout(flushSeen, 5000);
  setInterval(flushSeen, 20000);
  try {
    window.addEventListener('pagehide', flushSeen);
    document.addEventListener('visibilitychange', () => { if (document.hidden) flushSeen(); });
  } catch (_) {}

  const sendHarvest = (url, text) => {
    noteSeen(url);
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
  // Un PDF de FACTURE / REÇU (compta pro) se distingue du bordereau par son URL.
  const RECEIPT_URL = /invoice|receipt|facture|re[çc]u|billing|document/i;
  const maybeCaptureLabel = (contentType, url, getArrayBuffer) => {
    try {
      if (!/application\/pdf/i.test(contentType || '')) return;
      const isReceipt = RECEIPT_URL.test(url || '');
      getArrayBuffer().then((buf) => {
        if (buf && buf.byteLength && buf.byteLength < 4000000) {
          post({ kind: isReceipt ? 'receipt' : 'label', url, b64: abToB64(buf) });
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
        noteSeen(url); // diagnostic : TOUT appel API, pas seulement ceux qui matchent
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
        // Capte aussi le csrf/anon posé via setRequestHeader (déjà relayé plus
        // haut) pour la moisson active.
        sendWriteReq(this.__cancaleMethod, url, bodyArg);
        noteSeen(url); // diagnostic : TOUT appel API (XHR aussi)
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

  // ── MOISSON ACTIVE (v3.8) ──────────────────────────────────────────────────
  // Vinted construit désormais le dressing et les commandes CÔTÉ SERVEUR : la
  // page ne fait plus l'appel /wardrobe/items ni /my_orders, donc il n'y a plus
  // rien à intercepter passivement. On rétablit la moisson en faisant l'appel
  // NOUS-MÊMES — mais depuis TON navigateur, TON IP, TA session (cookies inclus
  // automatiquement). C'est exactement la requête que le site faisait avant :
  // indistinguable de toi. C'était la piste prévue de longue date (porter les
  // appels par l'extension plutôt que par l'IP serveur de Vercel).
  // Garde-fous « profil humain » : au plus une fois toutes les 30 min, seulement
  // quand l'onglet est visible, un léger délai aléatoire, un seul compte (celui
  // connecté dans cet onglet). Se rabat en silence si un endpoint a disparu.
  const ACTIVE_TTL = 30 * 60 * 1000;
  const jitter = (min, max) => min + Math.random() * (max - min);
  const apiGet = async (path) => {
    try {
      const h = { accept: 'application/json' };
      if (lastCsrf) h['x-csrf-token'] = lastCsrf;
      if (lastAnon) h['x-anon-id'] = lastAnon;
      const r = await fetch(path, { credentials: 'include', headers: h });
      if (!r || !r.ok) return null;
      return await r.text();
    } catch (_) { return null; }
  };
  const activeHarvest = async () => {
    try {
      if (!/(^|\.)vinted\./i.test(location.host)) return; // uniquement sur Vinted
      if (document.hidden) return;                        // onglet au premier plan seulement
      const KEY = '__cancale_active_ts';
      let last = 0; try { last = +(localStorage.getItem(KEY) || 0); } catch (_) {}
      if (Date.now() - last < ACTIVE_TTL) return;
      try { localStorage.setItem(KEY, String(Date.now())); } catch (_) {}
      // 1) profil (donne l'ID de dressing, ≠ id de compte).
      const who = await apiGet('/api/v2/users/current');
      let pid = null;
      if (who) { sendHarvest('/api/v2/users/current', who); try { pid = JSON.parse(who).user.id; } catch (_) {} }
      // 2) annonces en ligne (dressing).
      let wardrobeIds = [];
      if (pid) {
        await new Promise(r => setTimeout(r, jitter(600, 1500)));
        const w = await apiGet(`/api/v2/wardrobe/${pid}/items?page=1&per_page=200&order=relevance`);
        if (w) {
          sendHarvest(`/api/v2/wardrobe/${pid}/items`, w);
          try { wardrobeIds = (JSON.parse(w).items || []).filter(it => !it.is_closed && !it.is_hidden).map(it => String(it.id)); } catch (_) {}
        }
      }
      // 2b) DÉTAIL COMPLET de chaque annonce (description, catégorie, attributs…),
      //     par PETITS LOTS tournants, à un rythme HUMAIN (jitter), pour tout
      //     récupérer sur plusieurs passages sans marteler Vinted. Un curseur
      //     mémorise où on en était → au fil des visites, tout finit capté.
      if (wardrobeIds.length) {
        const CK = '__cancale_item_cursor';
        let cur = 0; try { cur = +(localStorage.getItem(CK) || 0) || 0; } catch (_) {}
        if (cur >= wardrobeIds.length) cur = 0;
        const BATCH = 6; // combien de détails par passage (doux)
        for (let i = 0; i < BATCH && i < wardrobeIds.length; i++) {
          const id = wardrobeIds[(cur + i) % wardrobeIds.length];
          await new Promise(r => setTimeout(r, jitter(900, 2200)));
          const d = await apiGet(`/api/v2/items/${id}`);
          if (d) sendHarvest(`/api/v2/items/${id}`, d);
        }
        try { localStorage.setItem(CK, String((cur + BATCH) % wardrobeIds.length)); } catch (_) {}
      }
      // 3) ventes + achats.
      for (const t of ['sold', 'bought']) {
        await new Promise(r => setTimeout(r, jitter(600, 1500)));
        const o = await apiGet(`/api/v2/my_orders?type=${t}&page=1&per_page=100`);
        if (o) sendHarvest(`/api/v2/my_orders?type=${t}`, o);
      }
      // 4) boîte de réception (au cas où la page ne l'a pas déjà chargée).
      await new Promise(r => setTimeout(r, jitter(600, 1500)));
      const inb = await apiGet('/api/v2/inbox?page=1&per_page=50');
      if (inb) sendHarvest('/api/v2/inbox', inb);
    } catch (_) {}
  };
  // Lancement différé (laisse la page s'installer et le csrf se capter), puis à
  // chaque retour au premier plan (throttlé par ACTIVE_TTL).
  setTimeout(activeHarvest, 6000);
  try { document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(activeHarvest, 3000); }); } catch (_) {}
})();
