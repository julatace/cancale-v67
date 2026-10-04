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
            if (DE_VC(url) && /json/i.test(String(ct || ''))) res.clone().text().then((t) => noteSchema(url, t)).catch(() => {});
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
            if (t && /json/i.test(String(ct || ''))) noteSchema(url, t);
          } catch (_) {}
        });
      } catch (_) {}
      return origSend.apply(this, arguments);
    };
  }
})();
