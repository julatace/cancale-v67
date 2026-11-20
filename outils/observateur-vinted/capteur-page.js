// VRM Observateur — capteur du monde MAIN de vinted.fr (document_start).
// Il ENVELOPPE fetch, XMLHttpRequest, WebSocket, EventSource, navigator.sendBeacon, history.pushState/replaceState
// et Element.attachShadow pour NOTER ce qui passe — sans rien changer à ce que la page envoie ni reçoit :
//  · l'appel d'origine est toujours fait, avec les mêmes arguments, et sa valeur est rendue telle quelle ;
//  · la réponse est lue sur un CLONE (la page garde la sienne, intacte) ;
//  · tout le travail de l'observateur est dans des try/catch : aucune exception n'en sort jamais.
// Tant que l'interrupteur « Enregistrer » n'est pas allumé, rien n'est noté (les enveloppes appellent l'original, c'est tout).
// Les événements passent au script isolé de l'observateur (relais.js) par un événement DOM de nom fixe, en texte.
(() => {
  'use strict';
  if (window.__vrmObsMain) return;
  try { Object.defineProperty(window, '__vrmObsMain', { value: true, enumerable: false }); } catch (_) { return; }

  const CANAL = '__vrm_obs_7f3a';
  const MASQUE = '[masqué]';
  const REPONSE_MAX = 16384;
  const CORPS_MAX = 4096;
  const LECTURE_MAX = 262144;           // au-delà, la réponse est coupée avant d'être masquée
  const PAR_MINUTE = 900;               // plafond d'événements par minute et par page

  // Même liste que regles.js (le banc vérifie qu'elles masquent pareil).
  const CLE_SECRETE = /token|csrf|xsrf|auth(?!or)|session|signature|password|passwd|mot_de_passe|secret|cookie|bearer|jwt|api_?key|access_key|anon_id|e_?mail|courriel|phone|telephone|mobile_number|iban|\bbic\b|swift|card_number|cvc|address|adresse/i;
  const cleSecrete = (k) => CLE_SECRETE.test(String(k || ''));
  const valeurSecrete = (v) => {
    const s = String(v == null ? '' : v);
    if (/^eyJ[\w-]+\.[\w-]+\.[\w-]*$/.test(s)) return true;
    if (/^(Bearer|Basic)\s+\S+/i.test(s)) return true;
    if (s.length >= 40 && !/\s/.test(s) && /^[A-Za-z0-9+/_=.-]+$/.test(s) && /\d/.test(s) && /[A-Za-z]/.test(s) && !/^https?:/.test(s)) return true;
    if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(s)) return true;
    return false;
  };
  const masquerObjet = (o, p) => {
    p = p || 0;
    if (p > 40) return MASQUE;
    if (Array.isArray(o)) return o.map((x) => masquerObjet(x, p + 1));
    if (o && typeof o === 'object') { const r = {}; for (const k of Object.keys(o)) r[k] = cleSecrete(k) ? MASQUE : masquerObjet(o[k], p + 1); return r; }
    if (typeof o === 'string' && valeurSecrete(o)) return MASQUE;
    return o;
  };
  const masquerRecherche = (s) => String(s || '').replace(/^\?/, '').split('&').filter(Boolean).map((x) => {
    const i = x.indexOf('='); if (i < 0) return x;
    let k = x.slice(0, i); try { k = decodeURIComponent(k); } catch (_) {}
    let v = x.slice(i + 1); try { v = decodeURIComponent(v.replace(/\+/g, ' ')); } catch (_) {}
    return x.slice(0, i) + '=' + (cleSecrete(k) || valeurSecrete(v) ? MASQUE : x.slice(i + 1));
  }).join('&');
  const masquerTexte = (t) => {
    t = String(t == null ? '' : t);
    const e = t.trim();
    if (e && (e[0] === '{' || e[0] === '[')) { try { return JSON.stringify(masquerObjet(JSON.parse(e))); } catch (_) {} }
    if (/^[^\s=&{}"]+=[^\s]*(&[^\s=&]+=[^\s]*)*$/.test(e)) return masquerRecherche(e);
    return t.replace(/("([^"]*)"\s*:\s*)("(?:[^"\\]|\\.)*"|[^,}\]\s]+)/g, (m, a, k) => (cleSecrete(k) ? a + '"' + MASQUE + '"' : m))
      .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, MASQUE)
      .replace(/[^@\s"']+@[^@\s"']+\.[a-z]{2,}/gi, MASQUE);
  };
  const couper = (t, max) => { t = String(t || ''); return t.length > max ? { texte: t.slice(0, max), tronque: true, taille: t.length } : { texte: t, tronque: false, taille: t.length }; };
  const url = (u) => {
    try { const x = new URL(String(u), location.href); return { hote: x.host, chemin: x.pathname, recherche: masquerRecherche(x.search) }; }
    catch (_) { return { hote: '', chemin: String(u || '').split(/[?#]/)[0].slice(0, 300), recherche: '' }; }
  };

  // Qui a appelé ? La pile d'appel dit si le script d'une extension est passé par là (son id est dans l'URL).
  let monId = '';
  try { const m = /chrome-extension:\/\/([a-p]{32})/.exec(new Error().stack || ''); if (m) monId = m[1]; } catch (_) {}
  const pile = () => {
    try {
      const s = String(new Error().stack || '').split('\n').slice(2);
      const lignes = s.filter((l) => !(monId && l.includes(monId)));
      const ids = [];
      for (const l of lignes) { const m = /(?:chrome|moz)-extension:\/\/([a-z0-9-]{8,})/i.exec(l); if (m && !ids.includes(m[1])) ids.push(m[1]); }
      const courte = lignes.slice(0, 4).map((l) => l.trim().replace(/\?[^:)\s]*/g, '')).join(' | ').slice(0, 400);
      return { pile: courte, extPile: ids };
    } catch (_) { return { pile: '', extPile: [] }; }
  };

  // ── Envoi au relais ────────────────────────────────────────────────────────
  let etat = '?';                     // '?' tant que le relais n'a pas dit, puis 'on' / 'off'
  let attente = [];
  let minute = 0; let nMinute = 0; let perdus = 0;
  const pousser = (ev) => {
    try {
      document.dispatchEvent(new CustomEvent(CANAL, { detail: JSON.stringify(ev) }));
    } catch (_) {}
  };
  const noter = (ev) => {
    try {
      if (etat === 'off') return;
      const m = Math.floor(Date.now() / 60000);
      if (m !== minute) {
        if (perdus) { const p = perdus; perdus = 0; pousser({ src: 'trop', t: Date.now(), detail: p + ' événement(s) de la page non notés (plus de ' + PAR_MINUTE + ' en une minute)' }); }
        minute = m; nMinute = 0;
      }
      if (++nMinute > PAR_MINUTE) { perdus++; return; }
      ev.src = ev.src || 'page';
      ev.page = location.pathname;
      if (etat === '?') { if (attente.length < 400) attente.push(ev); return; }
      pousser(ev);
    } catch (_) {}
  };
  try {
    document.addEventListener(CANAL + '_etat', (e) => {
      try {
        const v = String(e.detail || '');
        if (v !== 'on' && v !== 'off') return;
        etat = v;
        const a = attente; attente = [];
        if (v === 'on') for (const ev of a) pousser(ev);
      } catch (_) {}
    });
    document.dispatchEvent(new CustomEvent(CANAL + '_pret'));
  } catch (_) {}

  // ── Corps envoyés ─────────────────────────────────────────────────────────
  const corpsDe = (b) => {
    try {
      if (b == null) return null;
      if (typeof b === 'string') return couper(masquerTexte(b), CORPS_MAX);
      if (typeof URLSearchParams !== 'undefined' && b instanceof URLSearchParams) return couper(masquerRecherche(b.toString()), CORPS_MAX);
      if (typeof FormData !== 'undefined' && b instanceof FormData) {
        const o = {};
        b.forEach((v, k) => { o[k] = cleSecrete(k) ? MASQUE : (typeof v === 'string' ? (valeurSecrete(v) ? MASQUE : v) : '[fichier ' + (v && v.size) + ' octets]'); });
        return Object.assign(couper(JSON.stringify(o), CORPS_MAX), { note: 'formulaire' });
      }
      if (typeof Blob !== 'undefined' && b instanceof Blob) return { texte: '', note: 'blob ' + b.size + ' octets', tronque: false, taille: b.size };
      if (b instanceof ArrayBuffer || ArrayBuffer.isView(b)) {
        const o = b instanceof ArrayBuffer ? new Uint8Array(b) : new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
        const t = new TextDecoder().decode(o.slice(0, CORPS_MAX * 4));
        if (/[\u0000-\u0008\u000E-\u001F]/.test(t.slice(0, 1000))) return { texte: '', note: 'binaire ' + o.length + ' octets', tronque: false, taille: o.length };
        return couper(masquerTexte(t), CORPS_MAX);
      }
      return { texte: '', note: 'corps de type ' + (b && b.constructor && b.constructor.name), tronque: false, taille: 0 };
    } catch (_) { return null; }
  };
  const reponseDe = (txt, complet) => {
    try {
      if (!complet) return Object.assign(couper(masquerTexte(txt).replace(/("([^"]*)"\s*:\s*)"[^"]*$/, (m, a, k) => (cleSecrete(k) ? a + '"' + MASQUE + '"' : m)), REPONSE_MAX), { tronque: true });
      return couper(masquerTexte(txt), REPONSE_MAX);
    } catch (_) { return null; }
  };
  const lisible = (type) => !type || /json|text|javascript|xml|x-www-form-urlencoded|graphql/i.test(type);

  // Le compte : une réponse qui porte l'utilisateur courant (pseudo et id ; tout le reste est masqué ou ignoré).
  const chercherCompte = (chemin, txt) => {
    try {
      if (!/users\/current|current_user|\/users\/me\b|\/me\/?$|\/session/i.test(chemin)) return;
      const j = JSON.parse(txt);
      const u = (j && (j.user || j.current_user || j.data)) || j;
      if (u && (u.login || u.username)) noter({ src: 'compte', t: Date.now(), login: String(u.login || u.username).slice(0, 80), userId: u.id != null ? String(u.id) : '', detail: 'lu dans ' + chemin });
    } catch (_) {}
  };

  const lireClone = async (r) => {
    const c = r.clone();
    if (!c.body || !c.body.getReader) return { txt: await c.text(), complet: true };
    const lecteur = c.body.getReader();
    const morceaux = []; let n = 0; let complet = true;
    for (;;) {
      const { done, value } = await lecteur.read();
      if (done) break;
      morceaux.push(value); n += value.length;
      if (n > LECTURE_MAX) { complet = false; try { lecteur.cancel(); } catch (_) {} break; }
    }
    const tout = new Uint8Array(Math.min(n, LECTURE_MAX + 65536)); let o = 0;
    for (const m of morceaux) { if (o + m.length > tout.length) { tout.set(m.subarray(0, tout.length - o), o); o = tout.length; break; } tout.set(m, o); o += m.length; }
    return { txt: new TextDecoder().decode(tout.subarray(0, o)), complet };
  };

  // ── fetch ────────────────────────────────────────────────────────────────
  try {
    const fOrig = window.fetch;
    if (typeof fOrig === 'function') {
      const env = function fetch(input, init) {
        let info = null;
        try {
          if (etat !== 'off') {
            const estReq = typeof Request !== 'undefined' && input instanceof Request;
            const methode = String((init && init.method) || (estReq && input.method) || 'GET').toUpperCase();
            const u = url(estReq ? input.url : input);
            const p = pile();
            info = { api: 'fetch', methode, hote: u.hote, chemin: u.chemin, recherche: u.recherche, t: Date.now(), pile: p.pile, extPile: p.extPile, corps: init && 'body' in init ? corpsDe(init.body) : null };
            if (!info.corps && estReq && methode !== 'GET' && methode !== 'HEAD') {
              try { const cl = input.clone(); info._corpsP = cl.text().then((t) => couper(masquerTexte(t), CORPS_MAX)).catch(() => null); } catch (_) {}
            }
          }
        } catch (_) { info = null; }
        const promesse = fOrig.apply(this, arguments);
        if (info) {
          try {
            promesse.then((r) => {
              (async () => {
                try {
                  info.statut = r.status; info.duree = Date.now() - info.t; info.type = 'fetch';
                  if (info._corpsP) { info.corps = await info._corpsP; }
                  delete info._corpsP;
                  const ct = (r.headers && r.headers.get && r.headers.get('content-type')) || '';
                  if (lisible(ct) && !/event-stream/i.test(ct) && r.type !== 'opaque') {
                    const { txt, complet } = await lireClone(r);
                    info.reponse = reponseDe(txt, complet);
                    chercherCompte(info.chemin, txt);
                  } else info.reponse = { texte: '', note: 'non lue (' + (ct || r.type) + ')', tronque: false, taille: 0 };
                } catch (_) {}
                noter(info);
              })();
            }, (err) => { try { delete info._corpsP; info.erreur = String((err && err.name) || 'erreur'); info.duree = Date.now() - info.t; noter(info); } catch (_) {} });
          } catch (_) {}
        }
        return promesse;
      };
      try { Object.defineProperty(env, 'length', { value: fOrig.length }); } catch (_) {}
      window.fetch = env;
    }
  } catch (_) {}

  // ── XMLHttpRequest ───────────────────────────────────────────────────────
  try {
    const X = window.XMLHttpRequest && window.XMLHttpRequest.prototype;
    if (X) {
      const infos = new WeakMap();
      const open0 = X.open; const send0 = X.send;
      X.open = function open(methode, u) {
        try { if (etat !== 'off') { const x = url(u); infos.set(this, { api: 'xhr', methode: String(methode || 'GET').toUpperCase(), hote: x.hote, chemin: x.chemin, recherche: x.recherche }); } } catch (_) {}
        return open0.apply(this, arguments);
      };
      X.send = function send(body) {
        try {
          const info = infos.get(this);
          if (info) {
            const p = pile();
            info.t = Date.now(); info.pile = p.pile; info.extPile = p.extPile; info.type = 'xhr';
            info.corps = info.methode !== 'GET' ? corpsDe(body) : null;
            const xhr = this;
            xhr.addEventListener('loadend', () => {
              try {
                info.statut = xhr.status; info.duree = Date.now() - info.t;
                const rt = xhr.responseType;
                let txt = null;
                if (rt === '' || rt === 'text') txt = xhr.responseText;
                else if (rt === 'json') txt = JSON.stringify(xhr.response);
                if (txt != null) { info.reponse = reponseDe(txt.slice(0, LECTURE_MAX), txt.length <= LECTURE_MAX); chercherCompte(info.chemin, txt); }
                else info.reponse = { texte: '', note: 'non lue (' + rt + ')', tronque: false, taille: 0 };
                if (!xhr.status) info.erreur = 'échec ou annulée';
              } catch (_) {}
              noter(info);
            });
          }
        } catch (_) {}
        return send0.apply(this, arguments);
      };
    }
  } catch (_) {}

  // ── WebSocket / EventSource / sendBeacon ─────────────────────────────────
  const COURT = 2048;
  try {
    const WS = window.WebSocket;
    if (WS) {
      const suivis = new WeakMap();
      const send0 = WS.prototype.send;
      WS.prototype.send = function send(d) {
        try { const s = suivis.get(this); if (s) noter({ api: 'ws', t: Date.now(), hote: s.hote, chemin: s.chemin, sens: 'envoyé', methode: 'WS', corps: typeof d === 'string' ? couper(masquerTexte(d), COURT) : { texte: '', note: 'binaire', taille: (d && (d.byteLength || d.size)) || 0 }, extPile: pile().extPile }); } catch (_) {}
        return send0.apply(this, arguments);
      };
      window.WebSocket = new Proxy(WS, {
        construct(cible, args, nt) {
          const ws = Reflect.construct(cible, args, nt);
          try {
            if (etat !== 'off') {
              const u = url(args[0]); const p = pile();
              suivis.set(ws, u);
              noter({ api: 'ws', t: Date.now(), hote: u.hote, chemin: u.chemin, sens: 'ouvert', methode: 'WS', pile: p.pile, extPile: p.extPile });
              ws.addEventListener('message', (e) => { try { noter({ api: 'ws', t: Date.now(), hote: u.hote, chemin: u.chemin, sens: 'reçu', methode: 'WS', reponse: typeof e.data === 'string' ? couper(masquerTexte(e.data), COURT) : { texte: '', note: 'binaire' } }); } catch (_) {} });
              ws.addEventListener('close', (e) => { try { noter({ api: 'ws', t: Date.now(), hote: u.hote, chemin: u.chemin, sens: 'fermé', methode: 'WS', statut: e.code }); } catch (_) {} });
            }
          } catch (_) {}
          return ws;
        },
      });
    }
  } catch (_) {}
  try {
    const ES = window.EventSource;
    if (ES) {
      window.EventSource = new Proxy(ES, {
        construct(cible, args, nt) {
          const es = Reflect.construct(cible, args, nt);
          try {
            if (etat !== 'off') {
              const u = url(args[0]);
              noter({ api: 'sse', t: Date.now(), hote: u.hote, chemin: u.chemin, sens: 'ouvert', methode: 'SSE', extPile: pile().extPile });
              es.addEventListener('message', (e) => { try { noter({ api: 'sse', t: Date.now(), hote: u.hote, chemin: u.chemin, sens: 'reçu', methode: 'SSE', reponse: couper(masquerTexte(e.data), COURT) }); } catch (_) {} });
            }
          } catch (_) {}
          return es;
        },
      });
    }
  } catch (_) {}
  try {
    const N = window.Navigator && Navigator.prototype;
    if (N && typeof N.sendBeacon === 'function') {
      const b0 = N.sendBeacon;
      N.sendBeacon = function sendBeacon(u, data) {
        const r = b0.apply(this, arguments);   // une exception éventuelle est celle de Chrome, rendue telle quelle
        try { if (etat !== 'off') { const x = url(u); noter({ api: 'beacon', t: Date.now(), methode: 'POST', hote: x.hote, chemin: x.chemin, recherche: x.recherche, corps: corpsDe(data), statut: r ? 0 : -1, extPile: pile().extPile }); } } catch (_) {}
        return r;
      };
    }
  } catch (_) {}

  // ── Navigation sans rechargement ────────────────────────────────────────
  try {
    const H = History.prototype;
    for (const nom of ['pushState', 'replaceState']) {
      const o = H[nom];
      const env = function (etatH, titre) {
        const r = o.apply(this, arguments);
        try { const u = arguments[2]; if (etat !== 'off' && u != null) { const x = url(u); noter({ src: 'nav', t: Date.now(), detail: nom, chemin: x.chemin, recherche: x.recherche, extPile: pile().extPile }); } } catch (_) {}
        return r;
      };
      try { Object.defineProperty(env, 'name', { value: nom }); } catch (_) {}
      H[nom] = env;
    }
  } catch (_) {}

  // ── Shadow DOM fermé créé depuis la page (les extensions isolées ont leurs propres prototypes : vues par le relais) ──
  try {
    const E = Element.prototype; const a0 = E.attachShadow;
    let n = 0;
    if (a0) E.attachShadow = function attachShadow(o) {
      const r = a0.apply(this, arguments);
      try { if (etat !== 'off' && n++ < 100) { const p = pile(); noter({ src: 'dom', t: Date.now(), detail: 'shadow root ' + ((o && o.mode) || '?') + ' créé depuis la page', cible: { tag: String(this.tagName || '').toLowerCase(), id: this.id || '' }, extPile: p.extPile, extId: p.extPile[0] || '' }); } } catch (_) {}
      return r;
    };
  } catch (_) {}
})();
