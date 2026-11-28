// VRM Observateur Vestiaire — règles partagées (fond + page de l'extension) : masquage, reconnaissance des actions,
// fusion des sources, résumés, exports. Aucune requête réseau ici : une entrée, une sortie.
// (Le script du monde MAIN, capteur-page.js, porte SA copie du masquage : il ne peut pas charger ce fichier
//  sans le rendre visible à la page. Le banc vérifie que les deux masquent les mêmes clés.)
(function (racine) {
  'use strict';

  // <masquage> — ce bloc est recopié TEL QUEL dans capteur-page.js (le banc vérifie qu'ils sont identiques).
  // Une clé sensible : sa valeur n'est jamais gardée.
  const CLE_SECRETE = /token|csrf|xsrf|auth(?!or)|session|signature|password|passwd|mot_de_passe|secret|cookie|bearer|jwt|api_?key|apikey|access_key|anon_id|e_?mail|courriel|phone|telephone|mobile_?(number|phone)|iban|\bbic\b|swift|card_?(number|num|holder)|cardnumber|credit_?card|\bpan\b|cvc|cvv|security_code|address|adresse|street|postcode|postal_?code|zip_?code/i;
  const MASQUE = '[masqué]';
  const CORPS_MAX = 4096;

  function cleSecrete(cle) { return CLE_SECRETE.test(String(cle || '')); }

  // Un numéro de carte : 16 chiffres (espaces ou tirets permis) qui passent la clé de Luhn.
  function luhn(ch) { let s = 0; let dbl = false; for (let i = ch.length - 1; i >= 0; i--) { let d = ch.charCodeAt(i) - 48; if (dbl) { d *= 2; if (d > 9) d -= 9; } s += d; dbl = !dbl; } return s % 10 === 0; }
  const RE_CARTE = /(?<!\d)[2-6]\d{3}(?:[ -]?\d{4}){3}(?!\d)/g;
  const RE_IBAN = /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){3,7}(?: ?[A-Z0-9]{1,3})?\b/g;
  const RE_TEL = /(?:(?:\+|00)\d{2,3}[\s.-]?[1-9](?:[\s.-]?\d{2}){4}(?!\d))|(?<![\d+])0[1-9](?:[\s.-]?\d{2}){4}(?!\d)/g;
  const RE_MAIL = /[^@\s"'<>()[\]{},;:]+@[^@\s"'<>()[\]{},;:]+\.[a-z]{2,}/gi;
  // Dans un texte libre (un message, une description) : e-mail, téléphone, IBAN, carte remplacés.
  function masquerLibre(t) {
    return String(t)
      .replace(RE_MAIL, MASQUE)
      .replace(RE_CARTE, (m) => (luhn(m.replace(/\D/g, '')) ? MASQUE : m))
      .replace(RE_IBAN, MASQUE)
      .replace(RE_TEL, MASQUE);
  }

  // Une valeur qui ressemble à un jeton même sous une clé anodine (JWT, « Bearer … », longue chaîne opaque).
  function valeurSecrete(v) {
    const s = String(v == null ? '' : v);
    if (/^eyJ[\w-]+\.[\w-]+\.[\w-]*$/.test(s)) return true;
    if (/^(Bearer|Basic)\s+\S+/i.test(s)) return true;
    if (s.length >= 40 && !/\s/.test(s) && /^[A-Za-z0-9+/_=.-]+$/.test(s) && /\d/.test(s) && /[A-Za-z]/.test(s) && !/^https?:/.test(s)) return true;
    if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(s)) return true;   // une adresse e-mail
    return false;
  }

  function masquerObjet(o, prof) {
    prof = prof || 0;
    if (prof > 40) return MASQUE;
    if (Array.isArray(o)) return o.map((x) => masquerObjet(x, prof + 1));
    if (o && typeof o === 'object') {
      const r = {};
      for (const k of Object.keys(o)) r[k] = cleSecrete(k) ? MASQUE : masquerObjet(o[k], prof + 1);
      return r;
    }
    if (typeof o === 'string') return valeurSecrete(o) ? MASQUE : masquerLibre(o);
    return o;
  }

  function masquerRecherche(search) {
    const s = String(search || '').replace(/^\?/, '');
    if (!s) return { texte: '', params: [] };
    const params = [];
    const morceaux = s.split('&').filter(Boolean).map((p) => {
      const i = p.indexOf('=');
      const brut = i < 0 ? p : p.slice(0, i);
      let cle = brut; try { cle = decodeURIComponent(brut.replace(/\+/g, ' ')); } catch (_) {}
      const val = i < 0 ? '' : p.slice(i + 1);
      let valDec = val; try { valDec = decodeURIComponent(val.replace(/\+/g, ' ')); } catch (_) {}
      params.push(cle);
      const secret = cleSecrete(cle) || valeurSecrete(valDec);
      if (i < 0) return brut;
      if (secret) return brut + '=' + MASQUE;
      const vd = valDec.trim();
      if (vd[0] === '{' || vd[0] === '[') { const m = masquerTexte(vd); return brut + '=' + (m === vd ? val : encodeURIComponent(m)); }
      const l = masquerLibre(valDec);
      return brut + '=' + (l === valDec ? val : encodeURIComponent(l));
    });
    return { texte: morceaux.join('&'), params };
  }

  function masquerUrl(url) {
    try {
      const u = new URL(url);
      const r = masquerRecherche(u.search);
      return { hote: u.host, chemin: u.pathname, recherche: r.texte, params: r.params };
    } catch (_) {
      return { hote: '', chemin: String(url || '').split(/[?#]/)[0].slice(0, 500), recherche: '', params: [] };
    }
  }

  function masquerTexte(txt) {
    const t = String(txt || '');
    const essai = t.trim();
    if (essai && (essai[0] === '{' || essai[0] === '[')) {
      try { return JSON.stringify(masquerObjet(JSON.parse(essai))); } catch (_) {}
    }
    if (/^[^\s=&{}"]+=[^\s]*(&[^\s=&]+=[^\s]*)*$/.test(essai)) return masquerRecherche(essai).texte;
    return masquerLibre(t
      .replace(/("([^"]*)"\s*:\s*)("(?:[^"\\]|\\.)*"|[^,}\]\s]+)/g, (m, avant, cle) => (cleSecrete(cle) ? avant + '"' + MASQUE + '"' : m))
      .replace(/(name="([^"]+)"\r?\n\r?\n)([^\r\n]*)/g, (m, avant, cle) => (cleSecrete(cle) ? avant + MASQUE : m))
      .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, MASQUE)
      .replace(/(Bearer|Basic)\s+[A-Za-z0-9+/_=.-]{8,}/g, MASQUE));
  }
  // </masquage>

  function tronquer(t, max) {
    const s = String(t || '');
    max = max || CORPS_MAX;
    return s.length > max ? { texte: s.slice(0, max), tronque: true, taille: s.length } : { texte: s, tronque: false, taille: s.length };
  }

  // requestBody de chrome.webRequest : { formData } ou { raw: [{bytes}|{file}] } ou { error }.
  function corpsDepuis(requestBody) {
    if (!requestBody) return null;
    if (requestBody.error) return { texte: '', note: 'illisible (' + String(requestBody.error).slice(0, 80) + ')', tronque: false, taille: 0 };
    if (requestBody.formData) {
      const o = {};
      for (const k of Object.keys(requestBody.formData)) {
        const vals = requestBody.formData[k] || [];
        o[k] = cleSecrete(k) ? MASQUE : vals.map((v) => (valeurSecrete(v) ? MASQUE : v));
      }
      const r = tronquer(JSON.stringify(o));
      return { texte: r.texte, tronque: r.tronque, taille: r.taille, note: 'formulaire' };
    }
    if (Array.isArray(requestBody.raw)) {
      let txt = '';
      let fichiers = 0;
      let octets = 0;
      for (const p of requestBody.raw) {
        if (p && p.bytes) {
          octets += p.bytes.byteLength || 0;
          if (txt.length < CORPS_MAX * 16) {
            try { txt += new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(p.bytes).slice(0, CORPS_MAX * 16)); } catch (_) {}
          }
        } else if (p && p.file) fichiers++;
      }
      if (/[\u0000-\u0008\u000E-\u001F]/.test(txt.slice(0, 2000))) return { texte: '', note: 'contenu binaire (' + octets + ' octets, sans doute une photo)', tronque: false, taille: octets };
      const r = tronquer(masquerTexte(txt));
      return { texte: r.texte, tronque: r.tronque || octets > txt.length, taille: octets, note: fichiers ? fichiers + ' fichier(s) joint(s)' : '' };
    }
    return null;
  }

  // ─── Reconnaissance des actions (Vestiaire Collective + sa messagerie Stream Chat) ─────────
  // Les chemins viennent de ce que l'extension VRM a déjà vu chez Julien (apiv2…/chat/channel, apiv2…/chat/user/token,
  // notification-feed, negotiations, Stream `POST /channels/{type}/{id}/message`) et de motifs larges pour le reste :
  // une route inconnue reste notée (« Autre écriture ») avec son chemin, rien n'est perdu.
  const ACTIONS = [
    { id: 'message',              nom: 'Message envoyé',                         m: /^(POST|PUT)$/, c: /\/channels\/[^/]+\/[^/]+\/message\/?$|\/(conversations?|chat|threads?|inbox)\/.*\/messages?\/?$|\/messages?\/?$/i },
    { id: 'message_lu',           nom: 'Conversation marquée lue',               m: /^(POST|PUT|PATCH)$/, c: /\/channels\/[^/]+\/[^/]+\/read\/?$|\/(conversations?|chat|messages?)\/.*\b(read|seen)\b/i },
    { id: 'frappe',               nom: 'Événement de conversation (frappe…)',    m: /^POST$/,   c: /\/channels\/[^/]+\/[^/]+\/event\/?$/i },
    { id: 'conversation_ouverte', nom: 'Conversation ouverte / créée',           m: /^(POST|PUT)$/, c: /\/chat\/channels?\/?$|\/channels\/[^/]+\/[^/]+\/query\/?$|\/conversations?\/?$/i },
    { id: 'conversations_liste',  nom: 'Liste des conversations (Stream)',       m: /^POST$/,   c: /^\/channels\/?$/i, cat: 'lecture' },
    { id: 'jeton_chat',           nom: 'Jeton de messagerie demandé',            m: /^(POST|GET)$/, c: /\/chat\/user\/token/i, cat: 'lecture' },
    { id: 'offre_acceptee',       nom: 'Offre acceptée',                         m: /^(POST|PUT|PATCH)$/, c: /(offers?|negotiations?|counter-?offers?)\/.*\/?accept/i },
    { id: 'offre_refusee',        nom: 'Offre refusée',                          m: /^(POST|PUT|PATCH)$/, c: /(offers?|negotiations?|counter-?offers?)\/.*\/?(reject|decline|refuse)/i },
    { id: 'contre_offre',         nom: 'Contre-offre',                           m: /^(POST|PUT|PATCH)$/, c: /counter-?offers?|negotiations?\/[^/]+\/(counter|events?)/i },
    { id: 'offre_faite',          nom: 'Offre faite',                            m: /^(POST|PUT)$/, c: /\/offers?\/?$|\/negotiations?\/?$|\/offers?\/[^/]+\/?$|price-?(offer|proposal)|bargain/i },
    { id: 'aime',                 nom: 'J\'aime / favori (ajout ou retrait)',    m: /^(POST|PUT|DELETE)$/, c: /likes?|liked|favou?rites?|wish-?list|wishes|hearts?/i },
    { id: 'notif_lue',            nom: 'Notifications lues / vues',              m: /^(POST|PUT|PATCH)$/, c: /notification/i },
    { id: 'graphql_mutation',     nom: 'Mutation GraphQL',                       m: /^POST$/,   c: /graphql/i, corps: /"query"\s*:\s*"\s*mutation|^\s*mutation\b/ },
    { id: 'graphql_lecture',      nom: 'Lecture GraphQL',                        m: /^POST$/,   c: /graphql/i, cat: 'lecture' },
    { id: 'recherche',            nom: 'Recherche (POST)',                       m: /^POST$/,   c: /search|catalog|\/products?\/(list|query)/i, cat: 'lecture' },
    { id: 'annonce',              nom: 'Annonce créée / modifiée',               m: /^(POST|PUT|PATCH|DELETE)$/, c: /deposit|product-?listings?|\/products?\/[^/]+\/?$|smart-?listing/i },
    { id: 'photo',                nom: 'Photo envoyée',                          m: /^POST$/,   c: /\/photos?(\/|$)|\/media|\/upload/i },
  ];

  const NOMS_GESTE = { clic: 'Clic', saisie: 'Saisie dans un champ', soumission: 'Formulaire envoyé', touche: 'Touche Entrée' };
  const NOMS_FIXES = {
    lecture: 'Lecture (GET)', page: 'Page ouverte (navigation)', mesure: 'Mesure envoyée (statistiques, suivi)', autre_ecriture: 'Autre écriture',
    websocket: 'WebSocket (temps réel)', sse: 'Flux serveur (EventSource)', navigation: 'Navigation dans la page (sans rechargement)',
    dom: 'Élément ajouté à la page par une extension', extension: 'Extension installée / activée / désactivée', extensions_liste: 'Liste des extensions',
    debut: 'Enregistrement allumé / éteint', console: 'Message de la console de la page', debogueur: 'Capture complète (débogueur) attachée / détachée',
    onglet: 'Onglet Vestiaire ouvert / fermé / actualisé', exploration: 'Exploration (page vue, arrêt, reprise)', compte: 'Compte Vestiaire vu dans la page', trop: 'Trop d\'événements (une partie non notée)',
  };

  function estReseau(e) { return e.src === 'reseau' || (e.src === 'cdp' && e.api === 'net') || (e.src === 'page' && (e.api === 'fetch' || e.api === 'xhr' || e.api === 'beacon')); }

  function reconnaitre(e) {
    if (e.src === 'geste' && e.origine === 'exploration') return { id: 'exploration_' + e.geste, nom: (NOMS_GESTE[e.geste] || e.geste) + ' de l\'exploration', cat: 'geste', humain: false, exploration: true };
    if (e.src === 'exploration') return { id: 'exploration', nom: NOMS_FIXES.exploration, cat: 'contexte' };
    if (e.src === 'geste') {
      const humain = e.isTrusted === true;
      const base = NOMS_GESTE[e.geste] || ('Geste ' + e.geste);
      return { id: 'geste_' + e.geste + (humain ? '_humain' : '_auto'), nom: base + (humain ? ' (humain)' : ' simulé par un programme'), cat: 'geste', humain };
    }
    if (e.src === 'console') return { id: 'console', nom: NOMS_FIXES.console, cat: 'contexte' };
    if (e.src === 'debogueur') return { id: 'debogueur', nom: NOMS_FIXES.debogueur, cat: 'contexte' };
    if ((e.src === 'page' || e.src === 'cdp') && e.api === 'ws') return { id: 'websocket', nom: NOMS_FIXES.websocket, cat: 'temps_reel' };
    if (e.src === 'page' && e.api === 'sse') return { id: 'sse', nom: NOMS_FIXES.sse, cat: 'temps_reel' };
    if (e.src === 'page' && e.api === 'beacon') return { id: 'mesure', nom: NOMS_FIXES.mesure, cat: 'lecture' };
    if (e.src === 'nav') return { id: 'navigation', nom: NOMS_FIXES.navigation, cat: 'contexte' };
    if (['debut', 'dom', 'extension', 'extensions_liste', 'onglet', 'compte', 'trop'].includes(e.src)) return { id: e.src, nom: NOMS_FIXES[e.src], cat: 'contexte' };
    const meth = String(e.methode || '').toUpperCase();
    const chemin = String(e.chemin || '');
    if (meth === 'GET' || meth === 'HEAD' || meth === 'OPTIONS') return e.type === 'main_frame' ? { id: 'page', nom: NOMS_FIXES.page, cat: 'lecture' } : { id: 'lecture', nom: NOMS_FIXES.lecture, cat: 'lecture' };
    const corps = (e.corps && e.corps.texte) || '';
    for (const a of ACTIONS) {
      if (!a.m.test(meth) || !a.c.test(chemin)) continue;
      if (a.seulement && !a.seulement(meth, chemin)) continue;
      if (a.corps && !a.corps.test(corps)) continue;
      if (/^graphql_/.test(a.id)) { const op = operationGraphql(e); return { id: a.id + (op ? '_' + op : ''), nom: a.nom + (op ? ' : ' + op : ''), cat: a.cat || 'ecriture' }; }
      return { id: a.id, nom: a.nom, cat: a.cat || 'ecriture' };
    }
    if (/\/(events|track|analytics|metrics|stats|log|logs|collect|beacon|rum|telemetry|pixel)(\/|$)/i.test(chemin) || HOTE_MESURE.test(String(e.hote || '')) || e.type === 'ping' || e.type === 'beacon') return { id: 'mesure', nom: NOMS_FIXES.mesure, cat: 'lecture' };
    return { id: 'autre_ecriture', nom: NOMS_FIXES.autre_ecriture, cat: 'ecriture' };
  }

  // ─── Fusion : une requête vue par le fond (webRequest) ET par la page (fetch/XHR enveloppés) ne compte qu'une fois ──
  // La ligne du fond garde la vérité réseau (statut, durée, taille) et reçoit de la page la réponse, la pile d'appel
  // et les extensions vues dans cette pile.
  function fusionner(evs) {
    const tri = evs.slice().sort((a, b) => a.t - b.t);
    const memeRequete = (a, b) => a.methode === b.methode && a.hote === b.hote && a.chemin === b.chemin
      && !(a.tabId != null && b.tabId != null && a.tabId !== b.tabId) && Math.abs(a.t - b.t) < 3000;
    const prendre = (cible, e) => {
      if (e.reponse && !cible.reponse) cible.reponse = e.reponse;
      if (e.corps && !cible.corps) cible.corps = e.corps;
      if (e.pile && !cible.pile) cible.pile = e.pile;
      cible.extPile = Array.from(new Set([].concat(cible.extPile || [], e.extPile || [])));
      if (e.src === 'page') { cible.api = e.api; cible.vuParPage = true; }
      if (e.src === 'cdp') { cible.vuParDebogueur = true; if (e.initiatorType) cible.initiatorType = e.initiatorType; if (e.frameUrl) cible.frameUrl = e.frameUrl; }
      if (cible.statut == null && e.statut != null) cible.statut = e.statut;
    };
    const plusProche = (liste, e, prises) => {
      let m = null; let ecart = Infinity;
      for (const r of liste) {
        if (prises.has(r) || !memeRequete(r, e)) continue;
        const d = Math.abs(r.t - e.t);
        if (d < ecart) { ecart = d; m = r; }
      }
      return m;
    };
    const reseau = tri.filter((e) => e.src === 'reseau');
    const cdpNet = tri.filter((e) => e.src === 'cdp' && e.api === 'net');
    const prisesR = new Set(); const prisesP = new Set();
    const absorbe = new Set();
    // 1) le débogueur dans le fond (webRequest) ; 2) la page dans l'un ou l'autre.
    for (const c of cdpNet) {
      const r = plusProche(reseau, c, prisesR);
      if (r) { prisesR.add(r); prendre(r, c); absorbe.add(c); }
    }
    const primaires = reseau.concat(cdpNet.filter((c) => !absorbe.has(c)));
    for (const e of tri) {
      if (e.src === 'page' && (e.api === 'fetch' || e.api === 'xhr')) {
        const r = plusProche(primaires, e, prisesP);
        if (r) { prisesP.add(r); prendre(r, e); absorbe.add(e); }
      }
    }
    return tri.filter((e) => !absorbe.has(e));
  }

  // Une écriture sans geste humain (clic, Entrée, envoi de formulaire « isTrusted ») dans le même onglet
  // dans les 3 secondes avant : sans doute partie d'un programme.
  const FENETRE_GESTE = 3000;
  function attribuer(evs) {
    const gestes = evs.filter((e) => e.src === 'geste' && e.origine !== 'exploration' && e.isTrusted === true && (e.geste === 'clic' || e.geste === 'touche' || e.geste === 'soumission'));
    for (const e of evs) {
      const a = reconnaitre(e);
      e._action = a;
      if (a.cat !== 'ecriture') continue;
      e.apresGesteHumain = gestes.some((g) => g.t <= e.t && e.t - g.t <= FENETRE_GESTE && (g.tabId == null || e.tabId == null || g.tabId === e.tabId));
    }
    return evs;
  }

  function resumer(entrees) {
    const parType = new Map();
    for (const e of entrees) {
      const a = e._action || reconnaitre(e);
      if (!parType.has(a.id)) parType.set(a.id, { id: a.id, nom: a.nom, cat: a.cat, n: 0, heures: [], s4xx: 0, s429: 0, s403: 0, s5xx: 0, err: 0, sansGeste: 0 });
      const r = parType.get(a.id);
      r.n++;
      r.heures.push(e.t);
      const s = e.statut || 0;
      if (s === 429) r.s429++; else if (s === 403) r.s403++;
      if (s >= 400 && s < 500) r.s4xx++;
      if (s >= 500) r.s5xx++;
      if (e.erreur) r.err++;
      if (e.apresGesteHumain === false) r.sansGeste++;
    }
    const out = [];
    for (const r of parType.values()) {
      const h = r.heures.sort((a, b) => a - b);
      const ecarts = [];
      for (let i = 1; i < h.length; i++) ecarts.push(h[i] - h[i - 1]);
      const dureeH = h.length > 1 ? (h[h.length - 1] - h[0]) / 3600000 : 0;
      out.push({
        id: r.id, nom: r.nom, cat: r.cat, n: r.n,
        parHeure: h.length > 1 ? r.n / Math.max(dureeH, 1 / 60) : null,
        ecartMin: ecarts.length ? Math.min(...ecarts) : null,
        ecartMoy: ecarts.length ? ecarts.reduce((a, b) => a + b, 0) / ecarts.length : null,
        ecartMax: ecarts.length ? Math.max(...ecarts) : null,
        s4xx: r.s4xx, s429: r.s429, s403: r.s403, s5xx: r.s5xx, err: r.err, sansGeste: r.sansGeste,
        premier: h[0], dernier: h[h.length - 1],
      });
    }
    const ordre = { ecriture: 0, geste: 1, temps_reel: 2, contexte: 3, lecture: 4 };
    return out.sort((a, b) => (ordre[a.cat] - ordre[b.cat]) || (b.n - a.n));
  }

  function p2(n) { return String(n).padStart(2, '0'); }
  function clePeriode(t, gran) {
    const d = new Date(t);
    const jour = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
    return gran === 'jour' ? jour : jour + ' ' + p2(d.getHours()) + 'h';
  }
  // Par période : écritures, gestes humains, gestes simulés, lectures.
  function parPeriode(entrees, gran) {
    const m = new Map();
    for (const e of entrees) {
      const a = e._action || reconnaitre(e);
      const k = clePeriode(e.t, gran);
      if (!m.has(k)) m.set(k, { periode: k, ecritures: 0, gestesHumains: 0, gestesAuto: 0, lectures: 0, refus: 0 });
      const r = m.get(k);
      if (a.cat === 'ecriture') r.ecritures++;
      else if (a.cat === 'geste') { if (a.humain) r.gestesHumains++; else if (!a.exploration) r.gestesAuto++; }
      else if (a.cat === 'lecture') r.lectures++;
      if ((e.statut || 0) >= 400) r.refus++;
    }
    return Array.from(m.values()).sort((a, b) => (a.periode < b.periode ? -1 : 1));
  }

  // « Ce que l'outil a fait » : gestes humains / simulés, écritures avec / sans geste humain juste avant,
  // requêtes dont la pile d'appel passe par le script d'une extension.
  function outil(entrees, extensions) {
    const noms = new Map((extensions || []).map((x) => [x.id, x.name]));
    const r = { gestesHumains: 0, gestesAuto: 0, ecrituresAvecGeste: 0, ecrituresSansGeste: 0, parExtension: {}, autoParType: {}, sansGesteParType: {}, exploration: 0 };
    for (const e of entrees) {
      const a = e._action || reconnaitre(e);
      if (e.origine === 'exploration') { r.exploration++; continue; }   // ce que l'exploration provoque est compté à part
      if (a.cat === 'geste') {
        if (a.humain) r.gestesHumains++; else { r.gestesAuto++; r.autoParType[a.nom] = (r.autoParType[a.nom] || 0) + 1; }
      }
      if (a.cat === 'ecriture') {
        if (e.apresGesteHumain) r.ecrituresAvecGeste++; else { r.ecrituresSansGeste++; r.sansGesteParType[a.nom] = (r.sansGesteParType[a.nom] || 0) + 1; }
      }
      const ids = new Set([].concat(e.extPile || [], e.extId ? [e.extId] : []));
      if (e.initiator && /^chrome-extension:\/\//.test(e.initiator)) ids.add(e.initiator.replace(/^chrome-extension:\/\//, '').replace(/\/.*$/, ''));
      for (const id of ids) {
        if (!r.parExtension[id]) r.parExtension[id] = { id, nom: noms.get(id) || '', n: 0, ecritures: 0 };
        r.parExtension[id].n++;
        if (a.cat === 'ecriture') r.parExtension[id].ecritures++;
      }
    }
    return r;
  }

  // ─── Routes, thèmes, séquences : le RÉSUMÉ placé en tête de l'export ─────────────────────
  const HOTE_MESURE = /(^|\.)(google-analytics|googletagmanager|doubleclick|datadoghq|datadog|segment|amplitude|braze|appboy|hotjar|clarity|sentry|newrelic|nr-data|facebook|criteo|tiktok|snapchat|pinterest|bing|branch|adjust|onetrust|cookielaw|optimizely|contentsquare|quantum|forter|riskified|sift|px-cloud|perimeterx|datadome)\./i;
  const HOTE_STREAM = /(^|\.)(stream-io-api\.com|stream-chat\.com|getstream\.io)$/i;

  function operationGraphql(e) {
    try {
      const t = String((e.corps && e.corps.texte) || '');
      let m = /"operationName"\s*:\s*"([\w-]{1,80})"/.exec(t);
      if (m) return m[1];
      m = /\b(query|mutation|subscription)\s+([A-Za-z_]\w{0,79})/.exec(t);
      if (m) return m[2];
      const r = /[?&]operationName=([\w-]{1,80})/.exec(String(e.recherche || ''));
      return r ? r[1] : '';
    } catch (_) { return ''; }
  }

  // Un chemin sans ses identifiants : /channels/messaging/12345-67890/message ⇒ /channels/messaging/{n}-{n}/message.
  function normChemin(chemin) {
    return String(chemin || '').split('/').map((seg) => {
      if (!seg) return seg;
      if (/^\d{2,}$/.test(seg)) return '{n}';
      if (/^\d{2,}-\d{2,}$/.test(seg)) return '{n}-{n}';
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg)) return '{uuid}';
      if (/^[0-9a-f]{16,}$/i.test(seg)) return '{hex}';
      if (/-\d{4,}\.shtml$/i.test(seg)) return '{article}.shtml';
      if (seg.length >= 20 && /\d/.test(seg) && /[a-z]/i.test(seg) && !/-[a-z]+-[a-z]+-/i.test(seg)) return '{id}';
      if (/^!members-/.test(seg)) return '{canal}';
      return seg;
    }).join('/');
  }

  // Le type d'un message temps réel (Stream : {"type":"message.new"}, {"type":"typing.start"}…).
  function typeTempsReel(e) {
    const t = String((e.corps && e.corps.texte) || (e.reponse && e.reponse.texte) || '');
    const m = /"type"\s*:\s*"([\w.:-]{1,60})"/.exec(t);
    return m ? m[1] : '';
  }

  function themesDe(e) {
    const h = String(e.hote || ''); const c = String(e.chemin || '') + ' ' + String(e.recherche || '') + ' ' + (operationGraphql(e) || '') + ' ' + typeTempsReel(e);
    const t = [];
    if (HOTE_STREAM.test(h) || /chat|conversation|message|channel|inbox|thread/i.test(c)) t.push('messages');
    if (/\blike|like[sdr]?\b|favou?rite|wish-?list|wishes|hearts?|custom_community/i.test(c)) t.push('aimes');
    if (/notification|notif|feed-counter|alerts?\b/i.test(c)) t.push('notifications');
    if (/offers?\b|negotiat|counter-?offer|bargain|price-?(offer|proposal)|\bbids?\b/i.test(c)) t.push('offres');
    if (/\/users\/me\b|\/me\/?$|account|profile|\/session/i.test(c)) t.push('compte');
    if (HOTE_MESURE.test(h)) t.push('mesure');
    return t;
  }

  function cleRoute(e) {
    const a = e._action || reconnaitre(e);
    if (e.src === 'geste' || !e.methode) return null;
    const op = operationGraphql(e);
    const meth = e.api === 'ws' ? 'WS ' + (e.sens || '') : e.api === 'sse' ? 'SSE ' + (e.sens || '') : String(e.methode || '').toUpperCase();
    const rt = (e.api === 'ws' || e.api === 'sse') ? typeTempsReel(e) : '';
    return { cle: meth + ' ' + (e.hote || '') + normChemin(e.chemin) + (op ? ' #' + op : '') + (rt ? ' «' + rt + '»' : ''), methode: meth, hote: e.hote || '', chemin: normChemin(e.chemin), operation: op, typeTempsReel: rt, action: a.nom, cat: a.cat };
  }

  function routes(entrees) {
    const m = new Map();
    for (const e of entrees) {
      const r = cleRoute(e); if (!r) continue;
      if (!m.has(r.cle)) m.set(r.cle, Object.assign(r, { themes: [], n: 0, statuts: {}, params: [], premier: e.t, dernier: e.t, enTetesRequete: [], enTetesReponse: [], exempleEnvoye: '', exempleRecu: '', apresGesteHumain: 0, sansGesteHumain: 0, extensions: [] }));
      const x = m.get(r.cle);
      x.n++; x.dernier = Math.max(x.dernier, e.t); x.premier = Math.min(x.premier, e.t);
      for (const th of themesDe(e)) if (!x.themes.includes(th)) x.themes.push(th);
      const st = e.statut == null ? '—' : String(e.statut); x.statuts[st] = (x.statuts[st] || 0) + 1;
      for (const p of e.params || []) if (!x.params.includes(p) && x.params.length < 40) x.params.push(p);
      for (const h of e.entetesRequete || []) if (!x.enTetesRequete.includes(h) && x.enTetesRequete.length < 60) x.enTetesRequete.push(h);
      for (const h of e.entetesReponse || []) if (!x.enTetesReponse.includes(h) && x.enTetesReponse.length < 60) x.enTetesReponse.push(h);
      if (!x.exempleEnvoye && e.corps && e.corps.texte) x.exempleEnvoye = String(e.corps.texte).slice(0, 800);
      if (!x.exempleRecu && e.reponse && e.reponse.texte) x.exempleRecu = String(e.reponse.texte).slice(0, 800);
      if (e.apresGesteHumain === true) x.apresGesteHumain++; else if (e.apresGesteHumain === false) x.sansGesteHumain++;
      for (const id of [].concat(e.extPile || [], e.initiator && /^chrome-extension:\/\//.test(e.initiator) ? [e.initiator.slice(19, 51)] : [])) if (!x.extensions.includes(id)) x.extensions.push(id);
    }
    const ordre = { ecriture: 0, temps_reel: 1, lecture: 2, contexte: 3 };
    return Array.from(m.values()).sort((a, b) => (b.themes.length ? 1 : 0) - (a.themes.length ? 1 : 0) || (ordre[a.cat] - ordre[b.cat]) || b.n - a.n);
  }

  function decrireEtape(e) {
    const a = e._action || reconnaitre(e);
    if (e.src === 'geste') return a.nom + ' ' + descCible(e.cible) + (e.champ ? ' champ « ' + e.champ + ' » (' + e.longueur + ' car.)' : '');
    const r = cleRoute(e);
    if (r) return a.nom + ' · ' + r.cle + (e.statut != null ? ' → ' + e.statut : '');
    return a.nom + (e.detail ? ' · ' + e.detail : '') + (e.chemin ? ' ' + e.chemin : '');
  }

  // La séquence d'un message envoyé : ce qui s'est passé dans le même onglet de 60 s avant à 10 s après.
  function sequencesMessage(entrees, max) {
    const tri = entrees.slice().sort((a, b) => a.t - b.t);
    const envois = tri.filter((e) => (e._action || reconnaitre(e)).id === 'message' || (e.api === 'ws' && e.sens === 'envoyé' && /message\.new|"text"\s*:/i.test(String((e.corps && e.corps.texte) || ''))));
    const out = [];
    for (const m of envois.slice(-(max || 10))) {
      const etapes = tri.filter((e) => e.t >= m.t - 60000 && e.t <= m.t + 10000 && (e.tabId == null || m.tabId == null || e.tabId === m.tabId) && (e._action || reconnaitre(e)).cat !== 'contexte' && (e._action || reconnaitre(e)).id !== 'mesure')
        .slice(-80).map((e) => ({ dt_ms: e.t - m.t, quoi: decrireEtape(e), envoye: e.corps && e.corps.texte ? String(e.corps.texte).slice(0, 300) : undefined, cetEnvoi: e === m || undefined }));
      out.push({ t: new Date(m.t).toISOString(), route: (cleRoute(m) || {}).cle || '', apresGesteHumain: m.apresGesteHumain, etapes });
    }
    return out;
  }

  // Ce que l'exploration a vu et provoqué : pages, routes découvertes par thème, requêtes non-GET (et si un de SES clics
  // les précède de moins de 2,5 s), clics refusés, arrêts.
  function exploration(entrees) {
    const ex = entrees.filter((e) => e.origine === 'exploration');
    const pages = entrees.filter((e) => e.src === 'exploration' && e.etape === 'page').map((e) => ({ t: new Date(e.t).toISOString(), url: e.chemin, profondeur: e.profondeur, statut: e.statutPage, clics: e.clics, liens: e.liens }));
    const refus = [].concat(...entrees.filter((e) => e.src === 'exploration' && e.etape === 'page').map((e) => (e.refuses || []).map((r) => Object.assign({ page: e.chemin }, r))));
    const arrets = entrees.filter((e) => e.src === 'exploration' && e.etape === 'arret').map((e) => e.detail);
    // Un clic de l'exploration « provoque » une requête non-GET qui part moins de 2,5 s après lui, SUR LA MÊME PAGE
    // (aucun chargement de page entre les deux) ; ce qu'une page fait à son chargement est seulement noté.
    const clics = ex.filter((e) => e.src === 'geste').map((e) => e.t);
    const chargements = ex.filter((e) => e.src === 'reseau' && e.type === 'main_frame').map((e) => e.t);
    const nonGet = ex.filter((e) => e.methode && !/^(GET|HEAD|OPTIONS|WS|SSE)$/i.test(e.methode) && (e.src === 'reseau' || e.src === 'page' || e.src === 'cdp'))
      .map((e) => ({ t: new Date(e.t).toISOString(), route: (cleRoute(e) || {}).cle, apresClic: clics.some((t) => t <= e.t && e.t - t < 2500 && !chargements.some((c) => c > t && c <= e.t)) }));
    const rs = routes(ex);
    const parTheme = {};
    for (const k of Object.keys(THEMES)) parTheme[k] = rs.filter((r) => r.themes.includes(k)).map((r) => ({ route: r.cle, n: r.n, statuts: r.statuts }));
    return { pages, parTheme, nonGet, refus, arrets, routes: rs.map((r) => r.cle) };
  }

  const THEMES = { aimes: 'Likes / favoris (« a aimé votre pièce »)', notifications: 'Notifications', messages: 'Conversations / messages', offres: 'Offres / contre-offres / négociations', compte: 'Compte connecté' };
  function resumeExport(entrees) {
    const rs = routes(entrees);
    const parTheme = {};
    for (const k of Object.keys(THEMES)) parTheme[k] = rs.filter((r) => r.themes.includes(k)).map((r) => ({ route: r.cle, n: r.n, statuts: r.statuts, action: r.action }));
    const seq = sequencesMessage(entrees, 10);
    const hotes = {};
    for (const e of entrees) if (e.hote) hotes[e.hote] = (hotes[e.hote] || 0) + 1;
    const o = outil(entrees, []);
    const debut = entrees.length ? new Date(entrees[0].t).toISOString() : '';
    const fin = entrees.length ? new Date(entrees[entrees.length - 1].t).toISOString() : '';
    const texte = [
      'VRM Observateur Vestiaire — résumé (les détails complets suivent dans « routes » puis « evenements »).',
      'Période : ' + (debut || '—') + ' → ' + (fin || '—') + ' · ' + entrees.length + ' événements · ' + rs.length + ' routes différentes · ' + Object.keys(hotes).length + ' hôtes.',
      'Hôtes vus : ' + Object.entries(hotes).sort((a, b) => b[1] - a[1]).map(([h, n]) => h + ' (' + n + ')').join(', '),
      'Gestes humains : ' + o.gestesHumains + ' · gestes simulés : ' + o.gestesAuto + ' · écritures après un geste humain : ' + o.ecrituresAvecGeste + ' · sans : ' + o.ecrituresSansGeste,
    ];
    for (const [k, nom] of Object.entries(THEMES)) {
      texte.push('— ' + nom + ' : ' + (parTheme[k].length ? '' : 'rien vu'));
      for (const r of parTheme[k].slice(0, 40)) texte.push('   ' + r.route + ' × ' + r.n + ' [' + Object.entries(r.statuts).map(([s, n]) => s + (n > 1 ? '×' + n : '')).join(' ') + ']');
    }
    texte.push('— Séquence d\'un message envoyé : ' + (seq.length ? seq.length + ' message(s) envoyé(s) vu(s)' : 'aucun message envoyé vu'));
    for (const s of seq.slice(-3)) {
      texte.push('   Envoi du ' + s.t + ' (' + s.route + ')' + (s.apresGesteHumain === false ? ' — sans geste humain juste avant' : ''));
      for (const et of s.etapes) texte.push('     ' + (et.dt_ms >= 0 ? '+' : '') + (et.dt_ms / 1000).toFixed(1) + ' s  ' + et.quoi + (et.cetEnvoi ? '   ⇐ CET ENVOI' : ''));
    }
    const ex = exploration(entrees);
    texte.push('— Exploration du site par l\'Observateur : ' + (ex.pages.length ? ex.pages.length + ' page(s) vue(s)' + (ex.arrets.length ? ' · arrêt : ' + ex.arrets[ex.arrets.length - 1] : '') : 'pas lancée'));
    if (ex.pages.length) {
      for (const [k, nom] of Object.entries(THEMES)) texte.push('   ' + nom + ' découvert(es) : ' + (ex.parTheme[k].length ? ex.parTheme[k].map((r) => r.route + ' × ' + r.n).slice(0, 30).join(' ; ') : 'rien'));
      texte.push('   Requêtes non-GET dans l\'onglet exploré : ' + ex.nonGet.length + ' (provoquées par un clic de l\'exploration : ' + ex.nonGet.filter((x) => x.apresClic).length + ')');
      texte.push('   Clics refusés par la liste noire : ' + ex.refus.length);
    }
    return { texte, hotes, parTheme, sequencesMessage: seq, exploration: ex, routes: rs };
  }

  // ─── Exploration : ce qu'elle a le droit de toucher ────────────────────────────────────────
  // L'exploration LIT. Un clic n'est fait que sur un élément qui ouvre (onglet, accordéon, menu, fenêtre d'information,
  // « voir plus ») et JAMAIS sur ce qui écrit ou engage : la liste noire ci-dessous est jugée sur le libellé
  // (texte, aria-label, title, data-testid, id, name, value), accents retirés. Le banc la teste et la retire (mutation).
  const CLIC_INTERDIT = /\benvoyer\b|\bsend\b|\bpublier\b|\bpublish\b|\bpost\b|\bacheter\b|\bbuy\b|checkout|\bpanier\b|\bcart\b|\bpayer\b|\bpay\b|paiement|payment|commander\b|passer (la |a la )?commande|place order|order now|faire une offre|make (an )?offer|\bproposer\b|\bpropose\b|contre-?offre|counter-?offer|negocier|\baccepter\b|\baccept\b|\brefuser\b|\bdecline\b|\breject\b|j.aime|\baimer\b|\blike\b|unlike|\blove\b|\bheart\b|\bcoeur\b|\bcœur\b|ajouter aux favoris|retirer des favoris|add to (favou?rites|wishlist)|remove from|\bsuivre\b|\bfollow\b|unfollow|s.abonner|subscribe|supprim|\bdelete\b|\bremove\b|\bretirer\b|effacer|\bmodifier\b|\bedit\b|enregistrer|\bsave\b|sauvegard|signaler|\breport\b|bloquer|\bblock\b|deconnect|deconnexion|logout|log ?out|sign ?out|se connecter|connexion|log ?in|sign ?in|s.inscrire|sign ?up|register|\bvendre\b|\bsell\b|deposer|deposit|repondre|\breply\b|ecrire|\bwrite\b|contacter|\bcontact\b|discuter|annuler|\bcancel\b|rembours|refund|\bretour\b|\breturn\b|baisser|lower|boost|promouvoir|promote|archiver|archive|partager|\bshare\b|copier|\bcopy\b|imprimer|\bprint\b|telecharger|download|upload|importer|ajouter|\badd\b|valider|confirmer|confirm|submit|soumettre|marquer|mark as|desactiver|\bactiver\b|enable|disable|vacances|vacation|\bnoter\b|evaluer|laisser un avis|\brate\b|review|\bvider\b|\bclear\b|masquer|\bhide\b|\bmute\b|reserver|reserve|\bchanger\b|\bchange\b|installer|install|quitter|\bleave\b/;
  // Exception unique : OUVRIR la liste de ceux qui ont aimé (« Voir qui a aimé »), jamais le bouton qui aime.
  const VOIR_AIMES = /qui (a|ont) aime|who liked|voir les (j.aime|likes)|liste des (j.aime|likes)|\blikers?\b/;
  const BASCULE_AIME = /like-?(button|btn|toggle)|btn-?like|(add|remove)-?(to-?)?(favou?rite|wishlist)|\bheart\b|ne plus|unlike|retirer/;
  const VOIR_PLUS = /voir plus|afficher plus|plus de resultats|charger plus|load more|show more|see more|en savoir plus|lire la suite|tout voir|voir tout|see all|view all|\bdetails?\b|\binfos?\b|information|\bsuivant\b|\bnext\b|page suivante|^\s*\d{1,3}\s*$|^\s*plus\s*$/;
  const sansAccents = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘`]/g, "'").toLowerCase();
  function libelleDe(d) { return sansAccents([d.texte, d.aria, d.titre, d.testid, d.id, d.nom, d.valeur].filter(Boolean).join(' | ')); }
  function clicPermis(d) {
    const lib = libelleDe(d || {});
    if (VOIR_AIMES.test(lib) && !BASCULE_AIME.test(lib)) return { ok: true, raison: 'liste des j\'aime' };
    const m = CLIC_INTERDIT.exec(lib);
    if (m) return { ok: false, raison: 'interdit : « ' + m[0] + ' »' };
    return { ok: true, raison: '' };
  }
  function voirPlus(d) { return VOIR_PLUS.test(libelleDe(d || {})); }

  // Un lien que l'exploration peut OUVRIR (GET d'une page) : même hôte, rien qui déconnecte, paie, vend ou écrit.
  const LIEN_INTERDIT = /logout|log-out|signout|sign-out|deconnexion|disconnect|\/login|signin|sign-in|connexion|register|inscription|checkout|\/cart\b|panier|payment|paiement|\/pay\b|\/buy\b|acheter|\/sell\b|vendre|deposit|\/depot|\/delete|supprim|\/edit\b|modifier|\/report|signaler|unsubscribe|desabonn|\/remove|\/cancel|annul|\/new\b|\/create|\/upload|\/(like|unlike|follow|unfollow)(\/|$)|[?&](action|do)=/i;
  const LIE_COMPTE = /\/(profile|members?|users?|me|account|mon-compte|my-account|dressing|closet|chat|messages?|messagerie|inbox|notifications?|orders?|commandes?|sales|ventes|purchases|achats|offers?|offres|negotiations?|favorites?|favoris|wishlist|likes?|liked|settings|parametres|reglages|alerts?|wallet|porte-monnaie)(\/|-|\b)/i;
  function urlPropre(href, base) {
    try {
      const u = new URL(href, base);
      u.hash = '';
      for (const k of Array.from(u.searchParams.keys())) if (/^(utm_|fbclid|gclid|ref$|from$|tracking|_ga)/i.test(k)) u.searchParams.delete(k);
      return u.href;
    } catch (_) { return ''; }
  }
  // { ok, raison, compte } — `compte` : la page touche au compte (profil, messagerie, offres…), donc on la suit.
  function lienPermis(href, base, libelle, moiId) {
    const p = urlPropre(href, base);
    if (!p) return { ok: false, raison: 'adresse illisible' };
    const u = new URL(p); const b = new URL(base);
    if (!/^https:$/.test(u.protocol)) return { ok: false, raison: 'pas https' };
    if (u.host !== b.host) return { ok: false, raison: 'autre hôte' };
    if (LIEN_INTERDIT.test(u.pathname + u.search)) return { ok: false, raison: 'adresse interdite' };
    if (libelle && CLIC_INTERDIT.test(sansAccents(libelle)) && !VOIR_AIMES.test(sansAccents(libelle))) return { ok: false, raison: 'libellé interdit' };
    const prof = /profile-(\d+)/i.exec(u.pathname);
    if (prof && moiId && prof[1] !== String(moiId)) return { ok: false, raison: 'profil d\'une autre personne' };
    return { ok: true, url: p, compte: LIE_COMPTE.test(u.pathname), article: /\.shtml$/i.test(u.pathname) && !prof };
  }

  const COLONNES_CSV = ['t_iso', 't_ms', 'source', 'origine', 'action', 'categorie', 'themes', 'route', 'operation', 'methode', 'hote', 'chemin', 'recherche', 'type', 'api', 'initiator', 'tabId', 'statut', 'duree_ms', 'taille', 'erreur', 'isTrusted', 'geste', 'cible', 'champ', 'longueur', 'valeur', 'apres_geste_humain', 'extensions_vues', 'frame', 'entetes_requete', 'entetes_reponse', 'detail', 'corps', 'reponse'];
  function celluleCsv(v) {
    const s = v == null ? '' : String(v);
    return /[";\n\r,]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function descCible(c) {
    if (!c) return '';
    return [c.tag, c.testid ? '[data-testid=' + c.testid + ']' : '', c.id ? '#' + c.id : '', c.texte ? '« ' + c.texte + ' »' : ''].filter(Boolean).join(' ');
  }
  function enCsv(entrees) {
    const lignes = [COLONNES_CSV.join(',')];
    for (const e of entrees) {
      const a = e._action || reconnaitre(e);
      lignes.push([
        new Date(e.t).toISOString(), e.t, e.src, e.origine || 'utilisateur', a.nom, a.cat, themesDe(e).join(' '), (cleRoute(e) || {}).cle || '', operationGraphql(e), e.methode, e.hote, e.chemin, e.recherche, e.type, e.api, e.initiator, e.tabId, e.statut, e.duree, e.taille, e.erreur,
        e.isTrusted == null ? '' : (e.isTrusted ? 'oui' : 'non'), e.geste, descCible(e.cible), e.champ, e.longueur, e.valeur,
        e.apresGesteHumain == null ? '' : (e.apresGesteHumain ? 'oui' : 'non'), [].concat(e.extPile || [], e.extId ? [e.extId] : []).join(' '), e.frame == null ? e.frameId : e.frame, (e.entetesRequete || []).join(' '), (e.entetesReponse || []).join(' '), e.detail,
        e.corps ? e.corps.texte : '', e.reponse ? e.reponse.texte : '',
      ].map(celluleCsv).join(','));
    }
    return '﻿' + lignes.join('\r\n');
  }

  function duree(ms) {
    if (ms == null) return '—';
    if (ms < 1000) return Math.round(ms) + ' ms';
    if (ms < 60000) return (ms / 1000).toFixed(1).replace('.', ',') + ' s';
    if (ms < 3600000) return Math.floor(ms / 60000) + ' min ' + Math.round((ms % 60000) / 1000) + ' s';
    return Math.floor(ms / 3600000) + ' h ' + Math.round((ms % 3600000) / 60000) + ' min';
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  // Un résumé HTML autonome (aucun script, aucune ressource extérieure), lisible dans n'importe quel navigateur.
  function resumeHtml(entrees, extensions) {
    const res = resumer(entrees);
    const o = outil(entrees, extensions);
    const jours = parPeriode(entrees, 'jour');
    const heures = parPeriode(entrees, 'heure');
    const refus = entrees.filter((e) => (e.statut || 0) >= 400);
    const debut = entrees.length ? new Date(entrees[0].t).toLocaleString('fr-FR') : '—';
    const fin = entrees.length ? new Date(entrees[entrees.length - 1].t).toLocaleString('fr-FR') : '—';
    const tab = (titres, lignes) => '<table><tr>' + titres.map((t) => '<th>' + esc(t) + '</th>').join('') + '</tr>' + lignes.map((l) => '<tr>' + l.map((c) => '<td>' + esc(c) + '</td>').join('') + '</tr>').join('') + '</table>';
    return '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>VRM Observateur Vestiaire — résumé</title>'
      + '<style>body{font:15px/1.45 -apple-system,Segoe UI,Roboto,sans-serif;max-width:1000px;margin:24px auto;padding:0 16px;color:#1d1d1f}table{border-collapse:collapse;width:100%;margin:8px 0 20px;font-size:14px}th,td{border-bottom:1px solid #ddd;padding:5px 8px;text-align:left}th{color:#666;font-size:12px}h2{margin-top:28px}.n{font-size:26px;font-weight:700}</style></head><body>'
      + '<h1>VRM Observateur Vestiaire — résumé</h1><p>Du ' + esc(debut) + ' au ' + esc(fin) + ' · <b>' + entrees.length + '</b> événements notés.</p>'
      + '<h2>En bref</h2><pre style="white-space:pre-wrap;font:12px/1.4 ui-monospace,Menlo,monospace">' + esc(resumeExport(entrees).texte.join('\n')) + '</pre>'
      + '<h2>Routes vues</h2>' + tab(['Route (méthode, hôte, chemin sans identifiants)', 'Thèmes', 'Nombre', 'Statuts', 'En-têtes envoyés (noms)'], routes(entrees).slice(0, 400).map((r) => [r.cle, r.themes.join(', '), r.n, Object.entries(r.statuts).map(([k, v]) => k + '×' + v).join(' '), r.enTetesRequete.join(', ')]))
      + '<h2>Ce que l\'outil a fait</h2>'
      + tab(['', 'Nombre'], [
        ['Gestes humains (isTrusted = vrai)', o.gestesHumains], ['Gestes simulés par un programme (isTrusted = faux)', o.gestesAuto],
        ['Écritures juste après un geste humain', o.ecrituresAvecGeste], ['Écritures sans geste humain juste avant', o.ecrituresSansGeste]])
      + (Object.keys(o.parExtension).length ? '<h3>Extensions vues dans les appels</h3>' + tab(['Extension', 'Identifiant', 'Événements', 'Écritures'], Object.values(o.parExtension).map((x) => [x.nom || '(nom inconnu)', x.id, x.n, x.ecritures])) : '')
      + '<h2>Par type d\'action</h2>' + tab(['Action', 'Nombre', 'Par heure', 'Écart min.', 'Écart moyen', 'Écart max.', 'Refusées', 'Sans geste humain'], res.map((r) => [r.nom, r.n, r.parHeure == null ? '—' : r.parHeure.toFixed(1).replace('.', ','), duree(r.ecartMin), duree(r.ecartMoy), duree(r.ecartMax), r.s4xx + r.s5xx, r.cat === 'ecriture' ? r.sansGeste : '']))
      + '<h2>Par jour</h2>' + tab(['Jour', 'Écritures', 'Gestes humains', 'Gestes simulés', 'Lectures', 'Refus'], jours.map((j) => [j.periode, j.ecritures, j.gestesHumains, j.gestesAuto, j.lectures, j.refus]))
      + '<h2>Par heure</h2>' + tab(['Heure', 'Écritures', 'Gestes humains', 'Gestes simulés', 'Lectures', 'Refus'], heures.map((j) => [j.periode, j.ecritures, j.gestesHumains, j.gestesAuto, j.lectures, j.refus]))
      + '<h2>Réponses refusées par le site</h2>' + (refus.length ? tab(['Heure', 'Statut', 'Requête'], refus.slice(0, 500).map((e) => [new Date(e.t).toLocaleString('fr-FR'), e.statut, e.methode + ' ' + e.chemin])) : '<p>Aucune.</p>')
      + '<h2>Extensions installées</h2>' + ((extensions || []).length ? tab(['Nom', 'Identifiant', 'Activée', 'Permissions', 'Hôtes'], extensions.map((x) => [x.name, x.id, x.enabled ? 'oui' : 'non', (x.permissions || []).join(', '), (x.hostPermissions || []).join(', ')])) : '<p>Non lue.</p>')
      + '</body></html>';
  }

  const api = { exploration, CLIC_INTERDIT, VOIR_AIMES, LIEN_INTERDIT, LIE_COMPTE, sansAccents, clicPermis, voirPlus, lienPermis, urlPropre, MASQUE, CORPS_MAX, CLE_SECRETE, cleSecrete, valeurSecrete, masquerLibre, luhn, operationGraphql, normChemin, themesDe, cleRoute, routes, sequencesMessage, resumeExport, typeTempsReel, THEMES, masquerUrl, masquerRecherche, masquerTexte, masquerObjet, corpsDepuis, tronquer, reconnaitre, estReseau, fusionner, attribuer, resumer, parPeriode, outil, enCsv, resumeHtml, duree, esc, descCible };
  racine.VRMObs = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
