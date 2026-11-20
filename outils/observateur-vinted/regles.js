// VRM Observateur — règles partagées (fond + page de l'extension) : masquage, reconnaissance des actions,
// fusion des sources, résumés, exports. Aucune requête réseau ici : une entrée, une sortie.
// (Le script du monde MAIN, capteur-page.js, porte SA copie du masquage : il ne peut pas charger ce fichier
//  sans le rendre visible à la page. Le banc vérifie que les deux masquent les mêmes clés.)
(function (racine) {
  'use strict';

  // Une clé sensible : sa valeur n'est jamais gardée.
  const CLE_SECRETE = /token|csrf|xsrf|auth(?!or)|session|signature|password|passwd|mot_de_passe|secret|cookie|bearer|jwt|api_?key|access_key|anon_id|e_?mail|courriel|phone|telephone|mobile_number|iban|\bbic\b|swift|card_number|cvc|address|adresse/i;
  const MASQUE = '[masqué]';
  const CORPS_MAX = 4096;

  function cleSecrete(cle) { return CLE_SECRETE.test(String(cle || '')); }

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
    if (typeof o === 'string' && valeurSecrete(o)) return MASQUE;
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
      return i < 0 ? brut : brut + '=' + (secret ? MASQUE : val);
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
    return t
      .replace(/("([^"]*)"\s*:\s*)("(?:[^"\\]|\\.)*"|[^,}\]\s]+)/g, (m, avant, cle) => (cleSecrete(cle) ? avant + '"' + MASQUE + '"' : m))
      .replace(/(name="([^"]+)"\r?\n\r?\n)([^\r\n]*)/g, (m, avant, cle) => (cleSecrete(cle) ? avant + MASQUE : m))
      .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, MASQUE)
      .replace(/[^@\s"']+@[^@\s"']+\.[a-z]{2,}/gi, MASQUE);
  }

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

  // ─── Reconnaissance des actions ───────────────────────────────────────────
  const ACTIONS = [
    { id: 'message',        nom: 'Message envoyé',            m: /^POST$/,   c: /\/conversations\/[^/]+\/replies|\/conversations\/?$|\/messages\/?$/i },
    { id: 'offre_acceptee', nom: 'Offre acceptée',            m: /^(POST|PUT|PATCH)$/, c: /\/offers?\/[^/]+\/accept|\/offer_requests?\/[^/]+\/accept|accept_offer/i },
    { id: 'offre_refusee',  nom: 'Offre refusée',             m: /^(POST|PUT|PATCH)$/, c: /\/offers?\/[^/]+\/(reject|decline)|\/offer_requests?\/[^/]+\/(reject|decline)/i },
    { id: 'offre_faite',    nom: 'Offre faite',               m: /^POST$/,   c: /\/offers?\/?$|\/offer_requests?\/?$|\/transactions\/[^/]+\/offers/i },
    { id: 'favori',         nom: 'Favori (ajout/retrait)',    m: /^(POST|PUT|DELETE)$/, c: /favou?rit|\/likes?\b/i },
    { id: 'masque',         nom: 'Article masqué / affiché',  m: /^(POST|PUT|PATCH)$/, c: /\/items\/[^/]+\/(is_hidden|hide|unhide|visibility)/i },
    { id: 'remontee',       nom: 'Remontée / boost',          m: /^(POST|PUT)$/, c: /push_?ups?|bumps?|\/promot/i },
    { id: 'publie',         nom: 'Article publié (brouillon → en ligne)', m: /^(POST|PUT|PATCH)$/, c: /\/drafts?\/[^/]+\/(completion|publish)/i },
    { id: 'brouillon',      nom: 'Brouillon créé / modifié',  m: /^(POST|PUT|PATCH)$/, c: /\/drafts?(\/|$)/i },
    { id: 'supprime',       nom: 'Article supprimé',          m: /^(DELETE|POST)$/, c: /\/items\/[^/]+(\/delete)?\/?$/i, seulement: (meth, chemin) => meth === 'DELETE' || /\/delete\/?$/i.test(chemin) },
    { id: 'prix',           nom: 'Prix modifié',              m: /^(PUT|PATCH|POST)$/, c: /\/items\/[^/]+|\/item_upload\/items\/[^/]+/i, corps: /"price"|price[=\]]/i },
    { id: 'cree',           nom: 'Article créé',              m: /^POST$/,   c: /\/item_upload\/items\/?$|\/items\/?$/i },
    { id: 'modifie',        nom: 'Article modifié',           m: /^(PUT|PATCH|POST)$/, c: /\/item_upload\/items\/[^/]+|\/items\/[^/]+\/?$/i },
    { id: 'photo',          nom: 'Photo envoyée',             m: /^POST$/,   c: /\/photos?(\/|$)|\/media/i },
  ];

  const NOMS_GESTE = { clic: 'Clic', saisie: 'Saisie dans un champ', soumission: 'Formulaire envoyé', touche: 'Touche Entrée' };
  const NOMS_FIXES = {
    lecture: 'Lecture (GET)', page: 'Page ouverte (navigation)', mesure: 'Mesure envoyée à Vinted (statistiques)', autre_ecriture: 'Autre écriture',
    websocket: 'WebSocket (temps réel)', sse: 'Flux serveur (EventSource)', navigation: 'Navigation dans la page (sans rechargement)',
    dom: 'Élément ajouté à la page par une extension', extension: 'Extension installée / activée / désactivée', extensions_liste: 'Liste des extensions',
    debut: 'Enregistrement allumé / éteint', console: 'Message de la console de la page', debogueur: 'Capture complète (débogueur) attachée / détachée',
    onglet: 'Onglet Vinted ouvert / fermé / actualisé', compte: 'Compte Vinted vu dans la page', trop: 'Trop d\'événements (une partie non notée)',
  };

  function estReseau(e) { return e.src === 'reseau' || (e.src === 'cdp' && e.api === 'net') || (e.src === 'page' && (e.api === 'fetch' || e.api === 'xhr' || e.api === 'beacon')); }

  function reconnaitre(e) {
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
      return { id: a.id, nom: a.nom, cat: 'ecriture' };
    }
    if (/\/(events|track|analytics|metrics|stats|log|collect|beacon)/i.test(chemin) || e.type === 'ping' || e.type === 'beacon') return { id: 'mesure', nom: NOMS_FIXES.mesure, cat: 'lecture' };
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
    const gestes = evs.filter((e) => e.src === 'geste' && e.isTrusted === true && (e.geste === 'clic' || e.geste === 'touche' || e.geste === 'soumission'));
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
      else if (a.cat === 'geste') { if (a.humain) r.gestesHumains++; else r.gestesAuto++; }
      else if (a.cat === 'lecture') r.lectures++;
      if ((e.statut || 0) >= 400) r.refus++;
    }
    return Array.from(m.values()).sort((a, b) => (a.periode < b.periode ? -1 : 1));
  }

  // « Ce que l'outil a fait » : gestes humains / simulés, écritures avec / sans geste humain juste avant,
  // requêtes dont la pile d'appel passe par le script d'une extension.
  function outil(entrees, extensions) {
    const noms = new Map((extensions || []).map((x) => [x.id, x.name]));
    const r = { gestesHumains: 0, gestesAuto: 0, ecrituresAvecGeste: 0, ecrituresSansGeste: 0, parExtension: {}, autoParType: {}, sansGesteParType: {} };
    for (const e of entrees) {
      const a = e._action || reconnaitre(e);
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

  const COLONNES_CSV = ['t_iso', 't_ms', 'source', 'action', 'categorie', 'methode', 'hote', 'chemin', 'recherche', 'type', 'api', 'initiator', 'tabId', 'statut', 'duree_ms', 'taille', 'erreur', 'isTrusted', 'geste', 'cible', 'champ', 'longueur', 'valeur', 'apres_geste_humain', 'extensions_vues', 'detail', 'corps', 'reponse'];
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
        new Date(e.t).toISOString(), e.t, e.src, a.nom, a.cat, e.methode, e.hote, e.chemin, e.recherche, e.type, e.api, e.initiator, e.tabId, e.statut, e.duree, e.taille, e.erreur,
        e.isTrusted == null ? '' : (e.isTrusted ? 'oui' : 'non'), e.geste, descCible(e.cible), e.champ, e.longueur, e.valeur,
        e.apresGesteHumain == null ? '' : (e.apresGesteHumain ? 'oui' : 'non'), [].concat(e.extPile || [], e.extId ? [e.extId] : []).join(' '), e.detail,
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
    return '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>VRM Observateur — résumé</title>'
      + '<style>body{font:15px/1.45 -apple-system,Segoe UI,Roboto,sans-serif;max-width:1000px;margin:24px auto;padding:0 16px;color:#1d1d1f}table{border-collapse:collapse;width:100%;margin:8px 0 20px;font-size:14px}th,td{border-bottom:1px solid #ddd;padding:5px 8px;text-align:left}th{color:#666;font-size:12px}h2{margin-top:28px}.n{font-size:26px;font-weight:700}</style></head><body>'
      + '<h1>VRM Observateur — résumé</h1><p>Du ' + esc(debut) + ' au ' + esc(fin) + ' · <b>' + entrees.length + '</b> événements notés.</p>'
      + '<h2>Ce que l\'outil a fait</h2>'
      + tab(['', 'Nombre'], [
        ['Gestes humains (isTrusted = vrai)', o.gestesHumains], ['Gestes simulés par un programme (isTrusted = faux)', o.gestesAuto],
        ['Écritures juste après un geste humain', o.ecrituresAvecGeste], ['Écritures sans geste humain juste avant', o.ecrituresSansGeste]])
      + (Object.keys(o.parExtension).length ? '<h3>Extensions vues dans les appels</h3>' + tab(['Extension', 'Identifiant', 'Événements', 'Écritures'], Object.values(o.parExtension).map((x) => [x.nom || '(nom inconnu)', x.id, x.n, x.ecritures])) : '')
      + '<h2>Par type d\'action</h2>' + tab(['Action', 'Nombre', 'Par heure', 'Écart min.', 'Écart moyen', 'Écart max.', 'Refusées', 'Sans geste humain'], res.map((r) => [r.nom, r.n, r.parHeure == null ? '—' : r.parHeure.toFixed(1).replace('.', ','), duree(r.ecartMin), duree(r.ecartMoy), duree(r.ecartMax), r.s4xx + r.s5xx, r.cat === 'ecriture' ? r.sansGeste : '']))
      + '<h2>Par jour</h2>' + tab(['Jour', 'Écritures', 'Gestes humains', 'Gestes simulés', 'Lectures', 'Refus'], jours.map((j) => [j.periode, j.ecritures, j.gestesHumains, j.gestesAuto, j.lectures, j.refus]))
      + '<h2>Par heure</h2>' + tab(['Heure', 'Écritures', 'Gestes humains', 'Gestes simulés', 'Lectures', 'Refus'], heures.map((j) => [j.periode, j.ecritures, j.gestesHumains, j.gestesAuto, j.lectures, j.refus]))
      + '<h2>Réponses refusées par Vinted</h2>' + (refus.length ? tab(['Heure', 'Statut', 'Requête'], refus.slice(0, 500).map((e) => [new Date(e.t).toLocaleString('fr-FR'), e.statut, e.methode + ' ' + e.chemin])) : '<p>Aucune.</p>')
      + '<h2>Extensions installées</h2>' + ((extensions || []).length ? tab(['Nom', 'Identifiant', 'Activée', 'Permissions', 'Hôtes'], extensions.map((x) => [x.name, x.id, x.enabled ? 'oui' : 'non', (x.permissions || []).join(', '), (x.hostPermissions || []).join(', ')])) : '<p>Non lue.</p>')
      + '</body></html>';
  }

  const api = { MASQUE, CORPS_MAX, CLE_SECRETE, cleSecrete, valeurSecrete, masquerUrl, masquerRecherche, masquerTexte, masquerObjet, corpsDepuis, tronquer, reconnaitre, estReseau, fusionner, attribuer, resumer, parPeriode, outil, enCsv, resumeHtml, duree, esc, descCible };
  racine.VRMObs = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
