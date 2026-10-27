// vc-inject.js — tourne dans le MAIN world de vestiairecollective.com.
// ── VESTIAIRE COLLECTIVE : APPRENDRE À LIRE LE SITE, SANS RIEN LIRE DE SES DONNÉES ──
// Julien, 4 octobre : « commence à faire Vestiaire Collective bien ». Mesuré :
// AUCUNE donnée Vestiaire en base, et le site est inaccessible d'ici (403) — on
// ne connaît ni ses adresses d'API ni la forme de ses pages. Écrire un analyseur
// de ventes aujourd'hui serait deviner (§4.10, §6.3).
// ⇒ On fait MESURER le site par son navigateur, comme pour Leboncoin : on
//   enveloppe fetch/XHR pour regarder les réponses que la page charge DÉJÀ
//   (aucune requête de plus, aucun clic, aucun délai « humain » — §3), et on
//   relève uniquement :
//     · les CHEMINS d'API vus (méthode + chemin normalisé + code de réponse) ;
//     · la STRUCTURE des réponses JSON (chemins de clés + type de feuille) ;
//     · les familles de PAGES visitées ;
//     · les HÔTES tiers (le nom seul, jamais le chemin) — pour savoir si l'API
//       vit ailleurs.
//   ⚠️ JAMAIS UNE VALEUR : ni un nom, ni un prix, ni une adresse, ni un message.
//   Les identifiants dans les chemins et les clés deviennent `{id}` / `{uuid}`.
// Rien n'est encore « capté » : le jour où la structure dit où vivent une vente,
// son montant net et sa date, on écrira l'analyseur — pas avant.
(function () {
  'use strict';
  // 20 octobre (Orion iPhone, tout navigateur qui ignorerait `world: "MAIN"`
  // dans le manifeste) : ce fichier tournerait alors dans le monde ISOLÉ — où
  // envelopper fetch/XHR ne voit RIEN de la page, en silence. Le signe est
  // sûr : seul un script de contenu isolé voit `chrome.runtime.id`, et il n'a
  // pas de `document.currentScript`. Dans ce cas on se pose dans la page par
  // une balise <script> (ressource web-accessible), comme inject.js sur Vinted.
  // Sur Chrome et Firefox (monde MAIN honoré) rien ne change.
  try {
    const rt = (typeof chrome !== 'undefined' && chrome && chrome.runtime) || null;
    if (!document.currentScript && rt && rt.id && typeof rt.getURL === 'function') {
      const s = document.createElement('script');
      s.src = rt.getURL('vc-inject.js');
      s.onload = function () { this.remove(); };
      (document.head || document.documentElement).appendChild(s);
      return;
    }
  } catch (_) {}
  if (window.__vrmVcInjected) return; window.__vrmVcInjected = true;
  const TAG = 'CANCALE_VC';
  const post = (payload) => { try { window.postMessage(Object.assign({ __tag: TAG }, payload), '*'); } catch (_) {} };
  const NOISE = /(datadome|captcha|track|metric|telemetr|analytic|consent|pixel|gtm|beacon|sentry|hotjar|optimizely|segment\.io)/i;
  const DE_VC = (url) => { try { return /(^|\.)vestiairecollective\.com$/i.test(new URL(url, location.origin).hostname); } catch (_) { return false; } };
  const hoteDe = (url) => { try { return new URL(url, location.origin).hostname; } catch (_) { return ''; } };

  // Un identifiant ne part jamais : UUID, longues suites hexadécimales, nombres
  // de 3 chiffres ou plus, et tout segment qui n'a pas la forme d'un mot.
  const sansId = (x) => String(x)
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '{uuid}')
    .replace(/[0-9a-f]{16,}/gi, '{id}')
    .replace(/\d{3,}/g, '{id}');
  const normChemin = (p) => String(p || '').split('/').map((s) => {
    if (!s) return s;
    if (/^\{(id|uuid)\}$/.test(s)) return s;
    if (/^[a-z][a-z0-9_-]{0,30}$/i.test(s) && !/\d{3,}/.test(s)) return s;
    if (/\.(s?html?|json)$/i.test(s)) return '{page}.' + s.split('.').pop();
    return '{x}';
  }).join('/').slice(0, 160);
  const cleSure = (k) => (/@|\d{3,}|[0-9a-f]{16,}/i.test(k) || k.length > 40) ? '{k}' : k;

  function cheminsDeCles(v, prefixe, out, prof) {
    if (!out) out = []; if (out.length > 300 || (prof || 0) > 6) return out;
    if (Array.isArray(v)) { if (v.length) cheminsDeCles(v[0], (prefixe || '') + '[]', out, (prof || 0) + 1); return out; }
    if (v && typeof v === 'object') {
      for (const k of Object.keys(v).slice(0, 80)) cheminsDeCles(v[k], (prefixe ? prefixe + '.' : '') + cleSure(k), out, (prof || 0) + 1);
      return out;
    }
    // La FEUILLE : son chemin et son TYPE, jamais sa valeur.
    if (prefixe) out.push(prefixe + ':' + (v === null ? 'null' : typeof v));
    return out;
  }

  const typeCourt = (ctype) => { const c = String(ctype || '').toLowerCase(); return /pdf/.test(c) ? 'pdf' : /json/.test(c) ? 'json' : /html/.test(c) ? 'html' : /image/.test(c) ? 'img' : ''; };
  const chemins = new Set(), hotes = {}, pages = new Set(), schemas = {};
  let sale = false;
  const noteVu = (url, methode, statut, ctype) => {
    try {
      if (NOISE.test(url)) return;
      if (!DE_VC(url)) { const h = hoteDe(url); if (h && Object.keys(hotes).length < 40) { hotes[h] = (hotes[h] || 0) + 1; sale = true; } return; }
      let chemin = ''; try { chemin = new URL(url, location.origin).pathname; } catch (_) { chemin = String(url).split('?')[0]; }
      const rec = ((methode ? String(methode).toUpperCase() + ' ' : '') + hoteDe(url) + normChemin(sansId(chemin)) + (statut ? ' → ' + statut : '') + (typeCourt(ctype) ? ' [' + typeCourt(ctype) + ']' : '')).slice(0, 200);
      if (!chemins.has(rec) && chemins.size < 300) { chemins.add(rec); sale = true; }
    } catch (_) {}
  };
  const noteSchema = (url, texte) => {
    try {
      if (!DE_VC(url) || NOISE.test(url) || !texte || texte.length > 1500000) return;
      let ep = ''; try { const u = new URL(url, location.origin); ep = u.hostname + normChemin(sansId(u.pathname)); } catch (_) { return; }
      if (schemas[ep] || Object.keys(schemas).length >= 60) return;
      let obj; try { obj = JSON.parse(texte); } catch (_) { return; }
      if (!obj || typeof obj !== 'object') return;
      const cles = cheminsDeCles(obj).map(sansId).slice(0, 200);
      if (cles.length) { schemas[ep] = cles; sale = true; }
    } catch (_) {}
  };
  const notePage = () => { try { const f = normChemin(sansId(location.pathname)); if (!pages.has(f) && pages.size < 60) { pages.add(f); sale = true; } } catch (_) {} };
  notePage();
  try {
    const ps = history.pushState, rs = history.replaceState;
    history.pushState = function () { const r = ps.apply(this, arguments); notePage(); return r; };
    history.replaceState = function () { const r = rs.apply(this, arguments); notePage(); return r; };
    window.addEventListener('popstate', notePage);
  } catch (_) {}
  // Envoi groupé, au plus toutes les 5 s, et seulement s'il y a du neuf.
  setInterval(() => {
    if (!sale) return; sale = false;
    post({ kind: 'vcrecon', chemins: [...chemins], hotes: Object.assign({}, hotes), pages: [...pages], schemas: Object.assign({}, schemas),
      nextData: !!document.getElementById('__NEXT_DATA__'), nextFlux: !!(window.self && window.self.__next_f) });
  }, 5000);


  // ══════════════════════════════════════════════════════════════════════════
  // TES ANNONCES ET LEUR BOOST (27 octobre, 5.236)
  // ══════════════════════════════════════════════════════════════════════════
  // Julien : « l'extension doit sur Vestiaire, comme pour Vinted et Leboncoin,
  // capter si des annonces ont été boostées — ce n'est pas au vendeur de le
  // faire ». La seule liste de SES annonces vue chez lui est
  // `users/me/product-listings` (mesuré le 26 oct., vide ce jour-là : la FORME
  // d'une annonce n'a jamais été vue). Donc, sur cette réponse seulement :
  //   · l'identifiant de chaque annonce (le sien, pas une donnée personnelle) ;
  //   · son BOOST, lu sur une clé dont le NOM le dit (boost, promoted, featured,
  //     sponsored, spotlight, highlight, bump…) : `true`/`false`, un nombre > 0,
  //     une date encore à venir, ou un objet `{active|enabled|isActive}`. Aucune
  //     clé de ce nom ⇒ `null` (« pas su »), jamais « non boostée » ;
  //   · la référence `VRM-{n°}` si un texte de l'annonce la porte — SEULEMENT la
  //     référence, jamais le texte (c'est elle qui relie à la paire, §5).
  // Et le NOM des clés lues (jamais leur valeur), pour viser juste ensuite.
  const BOOST_CLE = /boost|promot|featur|sponsor|spotlight|highlight|bump|mise.?en.?avant|visibility.?(?:option|boost)/i;
  const RE_REF = /VRM-([A-Z]{0,3}\d{1,6})\b/i;
  function lireBoost(v) {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v > 0;
    if (typeof v === 'string') {
      if (/^(true|active|on|yes|enabled|boosted)$/i.test(v)) return true;
      if (/^(false|inactive|off|no|disabled|none|)$/i.test(v)) return false;
      const t = Date.parse(v); if (isFinite(t)) return t > Date.now();
      return null;
    }
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const k of ['active', 'isActive', 'enabled', 'isEnabled', 'status']) if (k in v) { const r = lireBoost(v[k]); if (r !== null) return r; }
      for (const k of ['endDate', 'endsAt', 'end_date', 'expiresAt', 'expirationDate', 'until']) if (v[k]) { const t = Date.parse(v[k]); if (isFinite(t)) return t > Date.now(); }
    }
    return null;
  }
  function boostDe(o) {
    let res = null; const cles = [];
    const visite = (x, prof) => {
      if (!x || typeof x !== 'object' || prof > 2) return;
      for (const k of Object.keys(x).slice(0, 80)) {
        if (BOOST_CLE.test(k)) { cles.push(cleSure(k)); const b = lireBoost(x[k]); if (b === true) res = true; else if (b === false && res === null) res = false; }
        else if (x[k] && typeof x[k] === 'object' && !Array.isArray(x[k])) visite(x[k], prof + 1);
      }
    };
    visite(o, 0);
    return { boost: res, cles: [...new Set(cles)].slice(0, 6) };
  }
  function refDe(o) {
    let ref = '';
    const visite = (x, prof) => {
      if (ref || !x || prof > 2) return;
      if (typeof x === 'string') { const m = x.match(RE_REF); if (m) ref = m[1].toUpperCase(); return; }
      if (typeof x !== 'object') return;
      for (const k of Object.keys(x).slice(0, 80)) visite(x[k], prof + 1);
    };
    visite(o, 0);
    return ref;
  }
  function tableauAnnonces(obj) {
    const cands = [];
    const visite = (x, prof) => {
      if (!x || typeof x !== 'object' || prof > 3) return;
      if (Array.isArray(x)) { if (x.length && x.every((e) => e && typeof e === 'object' && (e.id != null || e.productId != null || e.product_id != null))) cands.push(x); return; }
      for (const k of Object.keys(x)) visite(x[k], prof + 1);
    };
    visite(obj, 0);
    return cands.sort((a, b) => b.length - a.length)[0] || null;
  }
  const idDe = (e) => String(e.id != null ? e.id : (e.productId != null ? e.productId : e.product_id)).slice(0, 40);
  function noteAnnonces(url, texte) {
    try {
      let u; try { u = new URL(url, location.origin); } catch (_) { return; }
      if (!DE_VC(url) || !/\/users\/me\/product-listings\/?$/i.test(u.pathname)) return;
      let obj; try { obj = JSON.parse(texte); } catch (_) { return; }
      if (!obj || typeof obj !== 'object') return;
      const arr = tableauAnnonces(obj) || [];
      const offset = Number(u.searchParams.get('offset') || (obj.meta && obj.meta.offset) || 0) || 0;
      const total = obj.meta && typeof obj.meta.count === 'number' ? obj.meta.count : null;
      const items = arr.slice(0, 200).map((e) => { const b = boostDe(e); return { id: idDe(e), boost: b.boost, cles: b.cles, ref: refDe(e) }; }).filter((x) => /^[\w-]{1,40}$/.test(x.id));
      post({ kind: 'vcannonces', items, offset, total, lus: arr.length });
    } catch (_) {}
  }
  // La CRÉATION d'une annonce : son identifiant, rendu par Vestiaire, relie
  // l'annonce à la paire que VRM vient de préparer dans cet onglet (le fond
  // n'accepte que l'onglet du dépôt). Une écriture 2xx sur un chemin d'article.
  function notePublication(url, methode, statut, texte) {
    try {
      if (!DE_VC(url) || !/^(POST|PUT|PATCH)$/i.test(String(methode || '')) || !(statut >= 200 && statut < 300)) return;
      let u; try { u = new URL(url, location.origin); } catch (_) { return; }
      if (!/product|listing|draft|item|article/i.test(u.pathname) || /search|like|recommend|cart|basket|order/i.test(u.pathname)) return;
      let obj; try { obj = JSON.parse(texte); } catch (_) { return; }
      const cand = obj && (obj.data && typeof obj.data === 'object' ? obj.data : obj);
      const id = cand && (cand.id != null ? cand.id : (cand.productId != null ? cand.productId : cand.product_id));
      if (id == null || !/^[\w-]{1,40}$/.test(String(id))) return;
      post({ kind: 'vcpublie', productId: String(id), chemin: normChemin(sansId(u.pathname)), methode: String(methode).toUpperCase() });
    } catch (_) {}
  }

  const origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function (input, init) {
      const url = (typeof input === 'string') ? input : (input && input.url) || '';
      const meth = (init && init.method) || (typeof input === 'object' && input && input.method) || 'GET';
      const p = origFetch.apply(this, arguments);
      try {
        p.then((res) => {
          try {
            const ct = res.headers && res.headers.get && res.headers.get('content-type');
            noteVu(url, meth, res.status, ct);
            if (DE_VC(url) && /json/i.test(String(ct || ''))) res.clone().text().then((t) => { noteSchema(url, t); noteAnnonces(url, t); notePublication(url, meth, res.status, t); }).catch(() => {});
          } catch (_) {}
        }).catch(() => {});
      } catch (_) {}
      return p;
    };
  }
  const OX = window.XMLHttpRequest;
  if (OX) {
    const origOpen = OX.prototype.open, origSend = OX.prototype.send;
    OX.prototype.open = function (method, url) { this.__vcUrl = url; this.__vcMeth = method; return origOpen.apply(this, arguments); };
    OX.prototype.send = function () {
      try {
        this.addEventListener('load', function () {
          try {
            const url = this.__vcUrl || '';
            const ct = this.getResponseHeader && this.getResponseHeader('content-type');
            noteVu(url, this.__vcMeth, this.status, ct);
            const t = (this.responseType === '' || this.responseType === 'text') ? this.responseText : null;
            if (t && /json/i.test(String(ct || ''))) { noteSchema(url, t); noteAnnonces(url, t); notePublication(url, this.__vcMeth, this.status, t); }
          } catch (_) {}
        });
      } catch (_) {}
      return origSend.apply(this, arguments);
    };
  }
})();
