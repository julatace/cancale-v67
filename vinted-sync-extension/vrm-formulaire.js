// ════════════════════════════════════════════════════════════════════════════
//  LE FORMULAIRE DE VINTED, REMPLI PAR VRM (ext. 5.410.3, 20 nov. — `repubformulaire`)
//
//  Julien, 20 nov. au soir, après avoir observé l'outil concurrent sur son compte :
//  « on fait absolument tout comme Bleam ». Il a été prévenu UNE fois : les clics de
//  ce script sont des événements fabriqués (`isTrusted: false`), visibles par Vinted.
//  ⚠️ RIEN ici ne cherche à paraître humain : pas de `isTrusted` maquillé, pas de
//  débogueur, pas de mouvement de souris inventé. Le script fait ce que fait la page
//  quand on remplit son formulaire : il pose la valeur (setter natif + `input` /
//  `change`), il clique l'élément (`click()`), et c'est la page de Vinted qui envoie
//  ses propres requêtes (photos, brouillon, suppression, mise en ligne).
//
//  Injecté par le service worker dans le monde de la PAGE (`world: 'MAIN'`) d'un onglet
//  vinted.fr du compte de l'onglet ; une ÉTAPE à la fois (`__vrmFormulaire(etape, d)`),
//  le fond décide de l'ordre, des pauses et des gardes. Chaque étape :
//   · regarde d'abord s'il y a une vérification (captcha / DataDome) ⇒ `captcha`, rien ;
//   · attend chaque élément (sélecteurs par data-testid / id, relevés le 20 nov.) ;
//     un élément introuvable ⇒ `selecteur` avec son nom : Vinted a changé sa page, on
//     s'arrête proprement — AVANT le brouillon, rien n'est touché ;
//   · pour un geste qui écrit chez Vinted (brouillon, suppression, mise en ligne), écoute
//     la RÉPONSE de la requête que la page envoie et la rend (statut, identifiant, corps
//     envoyé par la page) ; elle est aussi rangée dans `sessionStorage` (la page navigue
//     juste après : le fond la relit par l'étape `reponse`).
//  Aucune donnée n'est rangée ailleurs que dans la page ; rien n'est lu d'autre que le
//  formulaire et la réponse attendue.
// ════════════════════════════════════════════════════════════════════════════
(() => {
  if (globalThis.__vrmFormulaire && globalThis.__vrmFormulaireV === 7.5) return;
  const SEL = Object.freeze({
    vendre: 'a[data-testid="header-upload-item-button"]',
    photos: 'input[data-testid="add-photos-input"]',
    titre: '#title',
    description: '#description',
    categorie: '#category',
    categorieRecherche: '#catalog-search-input',
    categorieListe: '[data-testid="catalog-select-dropdown-content"]',
    marque: '#brand',
    marqueRecherche: '#brand-search-input',
    taille: '#size',
    couleur: '#color',
    etat: '#condition',
    prix: '#price',
    brouillon: 'button[data-testid="upload-form-save-draft-button"]',
    ajouter: 'button[data-testid="upload-form-save-button"]',
    supprimer: 'button[data-testid="item-delete-button"]',
  });
  const CAPTCHA = 'iframe[src*="captcha-delivery.com"], iframe[src*="datadome"], #ddChallenge, [data-dd-captcha], iframe[src*="challenges.cloudflare.com"]';
  const nap = (ms) => new Promise((r) => setTimeout(r, ms));
  // Céder la main à la page entre deux caractères sans minuterie (une page en arrière-plan
  // ralentit les minuteries à 1 s : un titre de 30 lettres prendrait 30 s).
  const ceder = () => new Promise((r) => { try { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); } catch (_) { r(); } });
  const norm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim();
  // 5.414 : une vérification ne compte que VISIBLE (la règle de `vrmVerifVisible`, 5.410.6 : ≥ 120 × 60, à l'écran) —
  //    un cadre invisible de Vinted n'arrête rien ; une vraie vérification arrête tout, avant le geste.
  const captcha = () => { try { for (const el of document.querySelectorAll(CAPTCHA)) { const r = el.getBoundingClientRect(); if (r.width < 120 || r.height < 60) continue; if (r.bottom <= 0 || r.right <= 0 || r.top >= innerHeight || r.left >= innerWidth) continue; const st = getComputedStyle(el); if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) < 0.1) continue; return true; } } catch (_) {} return false; };
  // Ce que VRM pose lui-même dans la page (voile de l'onglet de travail, écran plein) n'est jamais un élément de Vinted.
  const deVrm = (el) => { try { return !!(el && el.closest && el.closest('#vrm-travail, [data-vrm-hote], #vrm-action-gel')); } catch (_) { return false; } };
  const visible = (el) => { try { return !!(el && el.isConnected && !deVrm(el) && (el.offsetParent !== null || el.getClientRects().length)); } catch (_) { return !!el; } };
  async function attendre(sel, ms = 15000, racine = document) {
    const fin = Date.now() + ms;
    for (;;) {
      if (captcha()) return { captcha: true };
      let el = null; try { el = typeof sel === 'function' ? sel() : racine.querySelector(sel); } catch (_) { el = null; }
      if (el) return { el };
      if (Date.now() > fin) return { absent: true };
      await nap(150);
    }
  }
  const manque = (nom) => ({ ok: false, code: 'selecteur', manque: nom, chemin: location.pathname });
  const vuCaptcha = () => ({ ok: false, code: 'captcha', chemin: location.pathname });
  // La valeur posée comme la page la lit : setter natif (React écoute `input`), un caractère à la fois.
  function setterDe(el) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const d = Object.getOwnPropertyDescriptor(proto, 'value');
    return (v) => { if (d && d.set) d.set.call(el, v); else el.value = v; };
  }
  // ══ 5.437 (Julien, 22 nov.) — LE RYTHME DE LA SAISIE ═══════════════════════════════════════════════════════════
  //  Les VALEURS ne changent jamais (exactement la fiche) ; seul le TEMPS entre deux lettres varie, borné : 45 à 140 ms,
  //  un peu plus après une espace ou une ponctuation, parfois une courte hésitation (250 à 700 ms, 1 fois sur 20). Les
  //  attentes passent par `ceder` (aucune minuterie : l'onglet de travail est en arrière-plan, ses minuteries sont
  //  ralenties à 1 s). Rien ici ne maquille quoi que ce soit : mêmes événements qu'avant (`input` / `change`), non fiables.
  const maintenant = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
  async function attenteFrappe(ms) { const fin = maintenant() + Math.max(0, ms); while (maintenant() < fin) await ceder(); }
  const entre = (a, b) => a + Math.random() * (b - a);
  function delaiLettre(ch) {
    let d = entre(45, 140);
    if (ch === ' ') d *= 1.6;
    else if (/[,.;:!?'’-]/.test(ch)) d *= 1.9;
    if (Math.random() < 0.05) d += entre(250, 700);
    return Math.round(d);
  }
  globalThis.__vrmDelaisVus = globalThis.__vrmDelaisVus || null;   // les bancs y lisent les délais tirés (jamais une valeur tapée)
  const noterDelai = (k, ms) => { try { if (Array.isArray(globalThis.__vrmDelaisVus)) globalThis.__vrmDelaisVus.push([k, ms]); } catch (_) {} };
  // La DESCRIPTION « collée » (le défaut, son réglage) : comme une personne qui colle son texte préparé — `paste` (avec le
  //  texte dans ses données), puis, si la page ne l'a pas pris elle-même, la valeur posée d'un coup et `input`
  //  `insertFromPaste`. Une seule fois : jamais deux fois le texte.
  async function coller(el, texte) {
    const t = String(texte);
    try { el.focus(); } catch (_) {}
    const poser = setterDe(el);
    poser(''); el.dispatchEvent(new Event('input', { bubbles: true }));
    await attenteFrappe(entre(300, 900)); noterDelai('avant-coller', 0);
    let pris = false;
    try {
      const dt = new DataTransfer(); dt.setData('text/plain', t);
      const ev = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt });
      el.dispatchEvent(ev);
      if (ev.defaultPrevented) { await ceder(); pris = el.value === t; }
    } catch (_) { pris = false; }
    if (!pris) {
      try { el.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertFromPaste', data: t })); } catch (_) {}
      poser(t);
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste', data: t }));
    }
    el.dispatchEvent(new Event('change', { bubbles: true }));
    await attenteFrappe(entre(400, 1200));
    try { el.blur(); } catch (_) {} el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    return el.value === t;
  }
  // La DESCRIPTION « tapée » (son autre choix) : par RAFALES — 4 à 18 lettres vite (30 à 90 ms), puis une pause de
  //  0,3 à 1,5 s (on relit, on cherche le mot) ; les mêmes événements que `saisir`.
  function rafales(texte) {
    const l = Array.from(String(texte)); const out = []; let i = 0;
    while (i < l.length) { const n = 4 + Math.floor(Math.random() * 15); out.push(l.slice(i, i + n)); i += n; }
    return out;
  }
  async function saisir(el, texte, opts) {
    // 5.414 : un champ « contenteditable » (messagerie) reçoit le texte de la même façon, lettre à lettre.
    if (el && el.isContentEditable) {
      try { el.focus(); } catch (_) {}
      el.textContent = ''; el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
      let v = '';
      for (const ch of Array.from(String(texte))) { v += ch; el.textContent = v; el.dispatchEvent(new InputEvent('input', { bubbles: true, data: ch, inputType: ch === '\n' ? 'insertLineBreak' : 'insertText' })); await ceder(); }
      return String(el.textContent) === String(texte);
    }
    const poser = setterDe(el);
    try { el.focus(); } catch (_) {}
    poser(''); el.dispatchEvent(new Event('input', { bubbles: true }));
    let v = '';
    const R = opts && opts.rythme ? opts.rythme : null;
    const blocs = R === 'rafales' ? rafales(texte) : [Array.from(String(texte))];
    for (let b = 0; b < blocs.length; b++) {
      if (b > 0) { const p = Math.round(entre(300, 1500)); noterDelai('rafale', p); await attenteFrappe(p); }
      for (const ch of blocs[b]) {
        v += ch; poser(v);
        el.dispatchEvent(new InputEvent('input', { bubbles: true, data: ch, inputType: ch === '\n' ? 'insertLineBreak' : 'insertText' }));
        if (R === 'lettres') { const d = delaiLettre(ch); noterDelai('lettre', d); await attenteFrappe(d); }
        else if (R === 'rafales') { const d = Math.round(entre(30, 90)); noterDelai('lettre-rafale', d); await attenteFrappe(d); }
        else await ceder();
      }
    }
    el.dispatchEvent(new Event('change', { bubbles: true }));
    if (!(opts && opts.garderFocus)) { try { el.blur(); } catch (_) {} el.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); }
    return el.value === String(texte);
  }
  // 5.429 (`ordrephotos`) : les NOMS des fichiers qu'une requête de la page emporte (un envoi de photo) — l'identité qui
  //    relie « photo-1.jpg » (la couverture) à l'identifiant que Vinted rend pour CE fichier. Rien d'autre n'est lu.
  function nomsFichiers(b) {
    try { if (!b || typeof FormData === 'undefined' || !(b instanceof FormData)) return null; const l = []; for (const [, v] of b.entries()) if (v && typeof v === 'object' && typeof v.name === 'string') l.push(String(v.name).slice(0, 60)); return l.length ? l : null; } catch (_) { return null; }
  }
  // ── L'écoute des réponses : les requêtes que la PAGE envoie (fetch et XHR), une seule fois posée.
  function ecouter() {
    if (globalThis.__vrmFormEcoute) return;
    globalThis.__vrmFormEcoute = true;
    const vues = globalThis.__vrmFormVues = [];
    const noter = (e) => { vues.push(e); if (vues.length > 80) vues.shift(); try { for (const f of (globalThis.__vrmFormAttentes || []).slice()) f(e); } catch (_) {} };
    const chemin = (u) => { try { return new URL(String(u), location.href).pathname; } catch (_) { return String(u || ''); } };
    const f0 = globalThis.fetch;
    if (typeof f0 === 'function') globalThis.fetch = function (input, init) {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      const methode = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
      const corps = init && typeof init.body === 'string' ? init.body : null;
      const fichiers = nomsFichiers(init && init.body);
      const p = f0.apply(this, arguments);
      p.then((r) => { try { r.clone().text().then((t) => { let j = null; try { j = t ? JSON.parse(t) : null; } catch (_) {} noter({ methode, chemin: chemin(url), status: r.status, json: j, corps, fichiers, texte: j == null ? String(t || '').slice(0, 2000) : '', dd: !!(r.headers && r.headers.get && r.headers.get('x-datadome')), ra: (r.headers && r.headers.get && r.headers.get('retry-after')) || '' }); }, () => {}); } catch (_) {} }, () => noter({ methode, chemin: chemin(url), status: 0, json: null, corps, fichiers }));
      return p;
    };
    const X = globalThis.XMLHttpRequest && globalThis.XMLHttpRequest.prototype;
    if (X) {
      const o0 = X.open, s0 = X.send;
      X.open = function (m, u) { this.__vrmM = String(m || 'GET').toUpperCase(); this.__vrmU = u; return o0.apply(this, arguments); };
      X.send = function (b) {
        const x = this; const corps = typeof b === 'string' ? b : null; const fichiers = nomsFichiers(b);
        try { x.addEventListener('loadend', () => { let j = null; try { j = x.responseType === 'json' ? x.response : (x.responseText ? JSON.parse(x.responseText) : null); } catch (_) {} let t = ''; try { t = j == null ? String(x.responseText || '').slice(0, 2000) : ''; } catch (_) {} let ra = ''; try { ra = x.getResponseHeader('retry-after') || ''; } catch (_) {} let dd = false; try { dd = !!x.getResponseHeader('x-datadome'); } catch (_) {} noter({ methode: x.__vrmM, chemin: chemin(x.__vrmU), status: x.status, json: j, corps, fichiers, texte: t, dd, ra }); }); } catch (_) {}
        return s0.apply(this, arguments);
      };
    }
  }
  // La réponse attendue (méthode + chemin), au plus `ms` ; rangée dans sessionStorage sous `cle`.
  function reponseDe(methode, re, ms, cle) {
    return new Promise((ok) => {
      const liste = globalThis.__vrmFormAttentes = globalThis.__vrmFormAttentes || [];
      let fini = false;
      const fin = (x) => { if (fini) return; fini = true; const i = liste.indexOf(f); if (i >= 0) liste.splice(i, 1); clearInterval(iv); clearTimeout(t);
        try { if (cle && x) sessionStorage.setItem('vrm_form_' + cle, JSON.stringify(x)); } catch (_) {}
        ok(x); };
      const f = (e) => { if (e && e.methode === methode && re.test(e.chemin)) fin({ status: e.status, ok: e.status >= 200 && e.status < 300, json: e.json, corps: e.corps, texte: e.texte || '', dd: !!e.dd, ra: String(e.ra || '').slice(0, 40), chemin: e.chemin }); };
      liste.push(f);
      const iv = setInterval(() => { if (captcha()) fin({ status: 0, ok: false, captcha: true }); }, 500);
      const t = setTimeout(() => fin(null), ms);
    });
  }
  // Une option d'une liste : d'abord son identifiant dans `data-testid` / `id`, sinon son libellé EXACT.
  function option(racine, id, libelle) {
    const r = racine || document;
    if (id != null && String(id) !== '') {
      const s = String(id);
      const parId = [...r.querySelectorAll('[data-testid],[id]')].find((el) => {
        const t = el.getAttribute('data-testid') || '', i = el.id || '';
        return (new RegExp(`(^|[-_])${s}$`).test(t) || new RegExp(`(^|[-_])${s}$`).test(i)) && visible(el);
      });
      if (parId) return parId;
    }
    if (libelle) {
      const n = norm(libelle);
      const feuilles = [...r.querySelectorAll('li, div, span, button, label')].filter((el) => visible(el) && norm(el.textContent) === n);
      const plusFin = feuilles.filter((el) => !feuilles.some((x) => x !== el && el.contains(x)));
      if (plusFin.length === 1) return plusFin[0].closest('[role="button"],button,li,[data-testid]') || plusFin[0];
    }
    return null;
  }
  // ══ 5.433 (`apprisclic`, Julien, 21 nov., choix n° 102) — LES BOUTONS APPRIS DE SON VRAI CLIC ══════════════════════════
  //  Un élément attendu absent (Vinted a changé sa page) : le fond lui a fait TOUCHER le bon bouton une fois (vrm-appris.js,
  //  son clic `isTrusted`), et passe ici la SIGNATURE retenue (`d.appris[nom]`, jamais un texte saisi ni un prix). La règle :
  //   · le sélecteur deviné d'abord ; l'élément appris seulement s'il manque, et seulement UNIQUE et VISIBLE (deux ⇒ ambigu,
  //     rien n'est cliqué) ;
  //   · un geste IRRÉVERSIBLE (supprimer, envoyer, publier, accepter, refuser, bordereau, évaluation) n'est JAMAIS cliqué sur un
  //     élément appris tant qu'il n'a pas confirmé « C'est bien ce bouton ? Oui » (`confirme`) : l'étape s'arrête AVANT le clic
  //     (`appris-a-confirmer`) ;
  //   · jamais pour une vérification (captcha) : `attendre` s'arrête dessus avant de chercher quoi que ce soit.
  let APPRIS = {};
  const VIA_APPRIS = new WeakMap();
  const IRREVERSIBLE_APPRIS = /^(supprimer|supprimer-confirmation|ajouter|brouillon|message-envoyer|offre-valider|offre-accepter|offre-refuser|bordereau-bouton|bordereau-confirmer|evaluation-envoyer|enregistrer)$/;
  function apprisEl(nom) {
    const sp = APPRIS[nom];
    if (!sp || !sp.sig || !globalThis.__vrmAppris) return null;
    const t = globalThis.__vrmAppris.trouver(sp.sig);
    if (t.ambigu) return 'AMBIGU';
    if (t.el && !deVrm(t.el) && visible(t.el)) { VIA_APPRIS.set(t.el, nom); return t.el; }
    return null;
  }
  // Une recherche immédiate ({ el, ambigu }) : l'appris seulement quand le deviné ne trouve RIEN (pas quand il en trouve deux).
  function ouAppris(nom, r) {
    if (r && (r.el || r.ambigu)) return r;
    const a = APPRIS[nom] ? apprisEl(nom) : null;
    return a === 'AMBIGU' ? { el: null, ambigu: true } : { el: a || null, ambigu: false };
  }
  // `attendre` avec, à défaut du deviné, l'élément appris (unique et visible).
  function attendreN(nom, sel, ms, racine) {
    if (!APPRIS[nom]) return attendre(sel, ms, racine);
    return attendre(() => {
      let el = null; try { el = typeof sel === 'function' ? sel() : (racine || document).querySelector(sel); } catch (_) { el = null; }
      if (el) return el;
      return apprisEl(nom);
    }, ms);
  }
  const clic = (el) => {
    // 5.433 : un élément APPRIS d'un geste irréversible, pas encore confirmé par lui ⇒ RIEN n'est cliqué.
    const nomA = el ? VIA_APPRIS.get(el) : null;
    if (nomA && IRREVERSIBLE_APPRIS.test(nomA) && !(APPRIS[nomA] && APPRIS[nomA].confirme === true)) { const e = new Error('appris-a-confirmer'); e.vrmAConfirmer = nomA; throw e; }
    try { el.scrollIntoView({ block: 'center' }); } catch (_) {} el.click();
  };
  // ══ 5.453 (`favorishumains`, Julien, 25 nov. : « tu dois faire tous les gestes que je fais pour faire les favoris »,
  //    « ça doit être humain ») — LES GESTES D'UN FAVORI COMME UNE PERSONNE ATTENTIVE ═══════════════════════════════════
  //  Dans les règles déjà VALIDÉES (CLAUDE.md §3 « Discrétion », 12 nov. ; 5.437 `formulairerythme`), pour les étapes d'un
  //  favori seulement (`d.favori` / `d.humain`) :
  //   · `regarder(k)` : un temps de lecture quand l'écran vient de changer (0,4 à 1,4 s) ;
  //   · `toucher(el)` : l'élément amené au milieu de l'écran (`scrollIntoView` : la position est posée, c'est le navigateur
  //     qui défile), une courte hésitation (0,25 à 0,9 s), puis le clic de `clic` (ses gardes : appris non confirmé ⇒ rien) ;
  //   · `taperHumain(el, texte, cible)` : lettre à lettre, plus long après une espace ou une ponctuation, parfois une pause de
  //     réflexion entre deux mots ; le tout ramené au TEMPS D'ÉCRITURE que le fond a tiré (`cible`, la règle du 12 nov.),
  //     chaque lettre bornée (55 ms à 0,9 s) ; la valeur EXACTE, les mêmes événements qu'avant (`saisir`).
  //  Tout au hasard, jamais deux fois de suite le même temps (`tirerUnique`). Les attentes passent par `attenteFrappe`
  //  (aucune minuterie : l'onglet de travail peut être en arrière-plan). Rien de maquillé : ni isTrusted, ni souris inventée,
  //  ni débogueur — refusés (§3).
  const _derniers = {};
  function tirerUnique(k, a, b) { let ms = Math.round(entre(a, b)); for (let i = 0; i < 6 && _derniers[k] != null && Math.round(ms / 10) === Math.round(_derniers[k] / 10); i++) ms = Math.round(entre(a, b)); _derniers[k] = ms; return ms; }
  async function regarder(k) { const ms = tirerUnique('regarder', 400, 1400); noterDelai('regarder:' + String(k || ''), ms); await attenteFrappe(ms); }
  async function toucher(el, k) {
    try { el.scrollIntoView({ block: 'center' }); } catch (_) {}
    const ms = tirerUnique('hesite', 250, 900); noterDelai('hesite:' + String(k || ''), ms); await attenteFrappe(ms);
    if (captcha()) { const e = new Error('captcha'); e.vrmCaptcha = true; throw e; }
    clic(el);
  }
  const H = (d) => !!(d && (d.humain === true || d.favori === true));
  const valeurDe = (el) => { try { return el && el.isContentEditable ? String(el.textContent || '') : String((el && el.value) || ''); } catch (_) { return ''; } };
  function delaisHumains(texte, cible) {
    const l = Array.from(String(texte));
    const brut = l.map((ch, i) => {
      let x = entre(60, 190);
      if (ch === ' ') x *= 1.5; else if (/[,.;:!?'’-]/.test(ch)) x *= 1.8;
      if (ch === ' ' && i > 0 && Math.random() < 0.12) x += entre(400, 1200);   // on cherche le mot suivant
      else if (Math.random() < 0.03) x += entre(250, 700);
      return x;
    });
    const somme = brut.reduce((a, b) => a + b, 0) || 1;
    const k = Number(cible) > 0 ? Math.min(2.5, Math.max(0.5, Number(cible) / somme)) : 1;
    return brut.map((x) => Math.round(Math.min(900, Math.max(55, x * k))));
  }
  // 5.453.2 (Julien, 26 nov. : « dans la conversation, RIEN n'est parti, ni message ni texte dans le champ ») : la valeur posée
  //    par le setter (ou `textContent` d'un champ riche) n'arrive pas toujours dans l'ÉTAT de l'éditeur de Vinted (React / éditeur
  //    riche) : le champ se vide au rendu suivant, « Envoyer » ne part pas. Chaque lettre passe désormais par la commande
  //    d'édition du navigateur (`document.execCommand('insertText')`, champ ayant le focus) — le même chemin qu'une frappe pour
  //    l'éditeur (beforeinput / input) ; elle n'a rien pris ⇒ l'ancienne pose (setter natif + `input`). Rien de maquillé.
  const valeurNette = (el) => valeurDe(el).replace(/ /g, ' ').replace(/\r\n?/g, '\n').replace(/\n$/, '');
  function viderChamp(el) {
    if (!valeurDe(el)) return;
    try { el.focus(); } catch (_) {}
    try {
      if (el.isContentEditable) { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
      else el.select();
      document.execCommand('delete', false);
    } catch (_) {}
    if (valeurDe(el)) {
      if (el.isContentEditable) { el.textContent = ''; el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' })); }
      else { setterDe(el)(''); el.dispatchEvent(new Event('input', { bubbles: true })); }
    }
  }
  function insererLettre(el, ch, v) {
    try { if (document.activeElement !== el) el.focus(); } catch (_) {}
    const avant = valeurDe(el);
    let pris = false;
    try { pris = document.execCommand('insertText', false, ch) && valeurDe(el) !== avant; } catch (_) { pris = false; }
    if (pris) return 'commande';
    if (el.isContentEditable) el.textContent = v; else setterDe(el)(v);
    el.dispatchEvent(new InputEvent('input', { bubbles: true, data: ch, inputType: ch === '\n' ? 'insertLineBreak' : 'insertText' }));
    return 'pose';
  }
  async function taperHumain(el, texte, cible) {
    const t = String(texte), l = Array.from(t), dl = delaisHumains(t, cible);
    try { el.scrollIntoView({ block: 'center' }); } catch (_) {}
    try { el.focus(); } catch (_) {}
    viderChamp(el);
    let v = '', voie = '';
    for (let i = 0; i < l.length; i++) {
      const ch = l[i];
      v += ch; voie = insererLettre(el, ch, v) || voie;
      noterDelai(ch === ' ' ? 'mot' : 'lettre-favori', dl[i]);
      await attenteFrappe(dl[i]);
      if (ch === ' ' && captcha()) return { captcha: true };
    }
    if (!el.isContentEditable) el.dispatchEvent(new Event('change', { bubbles: true }));
    // La valeur RELUE après un temps de rendu (un éditeur qui ne l'a pas prise la remet à vide) : sinon rien ne part.
    await attenteFrappe(400);
    return { ok: valeurNette(el) === t.replace(/\r\n?/g, '\n').replace(/\n$/, ''), voie };
  }
  // 5.453.2 (Julien : « quand on appuie sur le favori, ça propose DIRECTEMENT l'offre ») : la fenêtre « Faire une offre » de
  //    Vinted ouverte par-dessus la conversation — une seule fenêtre visible qui porte un champ de prix.
  function dialogueOffre() { const dl = dialogue(); return dl && champPrix(dl).el ? dl : null; }
  // La fermer (rien n'est envoyé) : son bouton « Fermer » / « Annuler », sinon Échap.
  async function fermerDialogueOffre(dl) {
    const b = [...dl.querySelectorAll('button, [role="button"]')].filter((x) => visible(x) && /fermer|close|annuler|cancel|chiudi|annulla|cerrar|cancelar|schlie|abbrechen/i.test(norm(nomAcc(x)) + ' ' + (x.getAttribute('data-testid') || '')));
    if (b.length) clic(b[0]);
    else { try { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true })); } catch (_) {} }
    const fin = Date.now() + 3000; while (Date.now() < fin) { if (!dialogueOffre()) return true; await nap(150); }
    return !dialogueOffre();
  }

  // ── 5.414 : les aides des gestes par l'interface (messagerie, offre, annonce) ─────────────────────────────
  // Un nom accessible (la règle de la cloche des favoris, 5.356) : aria-labelledby, aria-label, texte, title.
  const nomAcc = (b) => {
    try {
      const ids = (b.getAttribute('aria-labelledby') || '').trim().split(/\s+/).filter(Boolean);
      if (ids.length) { const refs = ids.map((i) => document.getElementById(i)); if (refs.some((x) => !x)) return ''; return refs.map((x) => x.textContent || '').join(' '); }
      if (b.hasAttribute('aria-label')) return b.getAttribute('aria-label') || '';
      const t = String(b.innerText || b.textContent || '').trim(); if (t) return t;
      return b.getAttribute('title') || '';
    } catch (_) { return ''; }
  };
  const actif = (b) => !(b.disabled || b.getAttribute('aria-disabled') === 'true');
  // LE bouton d'un geste : nom accessible EXACT (5 langues) ou data-testid reconnu ; jamais un mot interdit ;
  // un seul candidat visible (deux ⇒ `ambigu` : VRM ne choisit pas à ta place).
  function parNom(re, racine, reTestid, reInterdit, dansDialogue) {
    const r = racine || document;
    const tous = [...r.querySelectorAll('button, [role="button"], a[href]')].filter((b) => visible(b) && actif(b) && (dansDialogue || !b.closest('[role="dialog"],[aria-modal="true"]')));
    const c = tous.filter((b) => {
      const tid = b.getAttribute('data-testid') || '';
      if (reInterdit && reInterdit.test(tid)) return false;
      const n = norm(nomAcc(b));
      return (re && re.test(n)) || (reTestid && reTestid.test(tid));
    });
    const plusFin = c.filter((el) => !c.some((x) => x !== el && el.contains(x)));
    return plusFin.length === 1 ? { el: plusFin[0] } : { el: null, ambigu: plusFin.length > 1 };
  }
  const RE_FAIRE_OFFRE = /^(faire une offre|proposer un prix|proposer une offre|make an offer|offer a price|fai un'offerta|fare un'offerta|proponi un prezzo|hacer una oferta|haz una oferta|proponer un precio|preis vorschlagen|angebot machen|ein angebot machen)$/;
  const RE_VALIDER_OFFRE = /^(proposer|envoyer|envoyer l'offre|faire l'offre|faire une offre|proposer l'offre|offer|send|send offer|make offer|make an offer|submit|invia|invia offerta|proponi|enviar|enviar oferta|ofrecer|senden|angebot senden|anbieten)$/;
  const RE_ACCEPTER = /^(accepter|accepter l'offre|accept|accept offer|accetta|accetta l'offerta|aceptar|aceptar oferta|annehmen|akzeptieren|angebot annehmen)$/;
  const RE_REFUSER = /^(refuser|refuser l'offre|decliner|decline|decline offer|reject|rifiuta|rifiuta l'offerta|rechazar|rechazar oferta|ablehnen|angebot ablehnen)$/;
  const RE_MASQUER = /^(masquer|masquer l'article|masquer l'annonce|hide|hide item|nascondi|nascondi l'articolo|ocultar|ocultar articulo|ausblenden|artikel ausblenden)$/;
  const RE_AFFICHER = /^(afficher|afficher l'article|afficher l'annonce|rendre visible|show|show item|unhide|mostra|mostra l'articolo|mostrar|mostrar articulo|einblenden|anzeigen|artikel einblenden)$/;
  const RE_ENVOYER = /^(envoyer|envoyer le message|send|send message|invia|enviar|senden)$/;
  // 5.420 (`vacancesinterface`) : l'interrupteur du mode vacances (nom accessible EXACT, 5 langues) et sa confirmation.
  const RE_VACANCES = /^(mode vacances|activer le mode vacances|holiday mode|vacation mode|turn on holiday mode|modalita vacanza|modalita vacanze|modo vacaciones|modo vacaciones activado|urlaubsmodus|urlaubsmodus aktivieren)$/;
  const RE_CONFIRMER_VACANCES = /^(confirmer|activer|desactiver|valider|oui|ok|confirm|turn on|turn off|activate|deactivate|yes|conferma|attiva|disattiva|si|confirmar|activar|desactivar|bestatigen|aktivieren|deaktivieren|ja)$/;

  const RE_BORDEREAU = /^(obtenir le bordereau|generer le bordereau|imprimer le bordereau|obtenir l'etiquette|generer l'etiquette|obtenir le bordereau d'envoi|get shipping label|get label|generate label|print shipping label|ottieni l'etichetta|genera l'etichetta|obtener la etiqueta|generar etiqueta|versandetikett erhalten|versandetikett erstellen)$/;
  const RE_CONFIRMER_BORDEREAU = /^(confirmer|continuer|valider|obtenir le bordereau|generer le bordereau|confirm|continue|get label|conferma|continua|confirmar|continuar|bestatigen|weiter)$/;
  const RE_EVALUER = /^(laisser une evaluation|evaluer|laisser un avis|leave feedback|leave a review|rate|lascia un feedback|valuta|dejar una valoracion|valorar|bewertung abgeben|bewerten)$/;
  const RE_ENVOYER_EVAL = /^(envoyer|publier|valider|send|submit|post|invia|pubblica|enviar|publicar|senden|absenden|veroffentlichen)$/;
  // La fenêtre (dialogue) de Vinted ouverte : une seule visible, sinon rien.
  const dialogue = () => { const l = [...document.querySelectorAll('[role="dialog"], [aria-modal="true"], [data-testid*="modal" i]')].filter((x) => visible(x) && !deVrm(x)); const fin = l.filter((el) => !l.some((x) => x !== el && el.contains(x))); return fin.length === 1 ? fin[0] : null; };
  // Le champ du message (hors fenêtre) : un seul candidat.
  function composeur() {
    const x0 = composeurAncien();
    if (x0.el || x0.ambigu) return x0;
    // 5.440 : la couche de repérage (plusieurs stratégies, un seul gagnant) quand la règle d'avant ne voit rien.
    const t = T(); if (!t) return x0;
    const r = t.trouver('champMessage', {}); noterTrouve('champMessage', r);
    return { el: r.el || null, ambigu: !!r.ambigu };
  }
  function composeurAncien() {
    const ok = (x) => visible(x) && !x.closest('[role="dialog"],[aria-modal="true"]') && !x.readOnly && !x.disabled;
    for (const s of ['textarea[data-testid*="message" i]', 'textarea[data-testid*="conversation" i]', 'textarea[name="message"]', 'textarea[name="body"]', '[contenteditable="true"][role="textbox"]']) {
      const l = [...document.querySelectorAll(s)].filter(ok);
      if (l.length === 1) return { el: l[0] }; if (l.length > 1) return { el: null, ambigu: true };
    }
    const t = [...document.querySelectorAll('textarea')].filter(ok);
    return t.length === 1 ? { el: t[0] } : { el: null, ambigu: t.length > 1 };
  }
  // « Envoyer » de CE champ : le bouton d'envoi de son formulaire, sinon un seul bouton « Envoyer » de la page.
  function boutonEnvoyer(champ) {
    const x0 = boutonEnvoyerAncien(champ);
    if (x0.el || x0.ambigu) return x0;
    const t = T(); if (!t) return x0;
    const r = t.trouver('envoyer', { champ }); noterTrouve('envoyer', r);
    return { el: r.el || null, ambigu: !!r.ambigu };
  }
  function boutonEnvoyerAncien(champ) {
    const f = champ && champ.closest && champ.closest('form');
    if (f) {
      const s = [...f.querySelectorAll('button[type="submit"], button:not([type])')].filter((b) => visible(b) && actif(b) && (RE_ENVOYER.test(norm(nomAcc(b))) || /send|submit/i.test(b.getAttribute('data-testid') || '') || b.type === 'submit'));
      const parNomS = s.filter((b) => RE_ENVOYER.test(norm(nomAcc(b))) || /send/i.test(b.getAttribute('data-testid') || ''));
      const l = parNomS.length ? parNomS : s;
      if (l.length === 1) return { el: l[0] }; if (l.length > 1) return { el: null, ambigu: true };
    }
    return parNom(RE_ENVOYER, document, /(^|[-_])send([-_]|$)|send[-_]?button/i, /cancel|close/i);
  }
  // Le champ du prix d'une fenêtre d'offre : un seul candidat.
  function champPrix(dl) {
    const ok = (x) => visible(x) && !x.disabled && !x.readOnly;
    for (const s of ['input[name="price"]', 'input[name="offer"]', 'input[name*="price" i]', 'input[data-testid*="price" i]', 'input[data-testid*="offer" i]', 'input[inputmode="decimal"]', 'input[type="number"]']) {
      const l = [...dl.querySelectorAll(s)].filter(ok);
      if (l.length === 1) return { el: l[0] }; if (l.length > 1) return { el: null, ambigu: true };
    }
    const t = [...dl.querySelectorAll('input:not([type]), input[type="text"], input[type="tel"]')].filter(ok);
    return t.length === 1 ? { el: t[0] } : { el: null, ambigu: t.length > 1 };
  }
  const texteMontant = (prix) => (Math.round(prix * 100) % 100 === 0 ? String(Math.round(prix)) : (Math.round(prix * 100) / 100).toFixed(2)).replace('.', ',');
  // Le texte de la page (hors champs de saisie, hors VRM) : la preuve qu'un message ou une offre est AFFICHÉ.
  const textePage = () => { try { return norm(String((document.body && document.body.innerText) || '')); } catch (_) { return ''; } };
  function occurrences(texte) {
    const t = norm(texte).slice(0, 80); if (!t) return 0;
    const p = textePage(); let n = 0, i = 0; for (;;) { i = p.indexOf(t, i); if (i < 0) break; n++; i += t.length; } return n;
  }
  function occurrencesPrix(prix) {
    const e = Math.floor(prix), c = Math.round(prix * 100) % 100, cc = String(c).padStart(2, '0');
    const re = c === 0 ? new RegExp(`(^|[^0-9,.])${e}(?:[,.]00)?\\s?€|€\\s?${e}(?:[.,]00)?(?![0-9])`, 'g') : new RegExp(`(^|[^0-9,.])${e}[,.]${cc}\\s?€|€\\s?${e}[.,]${cc}(?![0-9])`, 'g');
    return (textePage().replace(/ | /g, ' ').match(re) || []).length;
  }
  // La cloche : le bouton « Notifications ». Plusieurs ancres (22 nov. : en production, cloche OUVERTE, le bouton n'était
  // plus reconnu et VRM demandait de « toucher le bouton Notifications ») :
  //   1. le nom accessible (5 langues ; « Fermer les notifications » quand la liste est ouverte compte aussi) ;
  //   2. à défaut, un bouton de l'en-tête dont le data-testid dit « notification » ;
  //   3. plusieurs candidats ⇒ celui de l'en-tête s'il est seul, sinon `ambigu` (VRM ne choisit pas).
  // Une ligne de la liste ouverte (un lien, « Voir tout ») n'est jamais la cloche.
  const RE_CLOCHE = /^(?:(?:mes|my|le mie|meine|mis) |(?:(?:ouvrir|afficher|voir|fermer|masquer|open|show|view|close|hide|apri|chiudi|abrir|cerrar|offnen|schliessen) (?:les |the |le |las |die )?))?(?:notifications?|notifiche|notificaciones|benachrichtigungen)(?:\s*[:·,–-]?\s*\(?[0-9]{1,5}\+?\)?(?: (?:non lues?|unread|non lette|sin leer|ungelesen|nouvelles?|new))?)?$/;
  const RE_VOIR_TOUT = /^(?:voir tout|tout voir|voir toutes(?: les notifications)?|see all|view all|show all|ver todo|ver todas|vedi tutto|vedi tutte|mostra tutto|alle anzeigen|alle ansehen)(?: [›>→])?$/;
  const cheminNotif = (a) => { try { const u = new URL(a.href, location.href); return u.origin === location.origin && /notif/i.test(u.pathname) && /^\/[\w\-/]{1,80}$/.test(u.pathname) ? u.pathname.replace(/\/+$/, '') : ''; } catch (_) { return ''; } };
  // La liste de la cloche OUVERTE : reconnue par son lien « Voir tout » (nom reconnu, ou adresse des notifications) dans
  // un bloc qui porte d'autres liens. Rend { voirTout: chemin | '' } ou null (liste fermée / pas reconnue).
  function panneauCloche() {
    try {
      // « Voir tout » ne compte que s'il mène aux notifications, ou s'il vit dans un bloc de menu / de notifications, ou si
      // la cloche se dit ouverte — jamais un « Voir tout » du pied de page ou d'un bloc d'articles.
      const ouverte = [...document.querySelectorAll('button[aria-expanded="true"], [role="button"][aria-expanded="true"]')].some((b) => visible(b) && RE_CLOCHE.test(norm(nomAcc(b))));
      const liens = [...document.querySelectorAll('a[href]')].filter((a) => visible(a) && !a.closest('footer'));
      const vt = liens.filter((a) => RE_VOIR_TOUT.test(norm(nomAcc(a))) && (cheminNotif(a) || ouverte || a.closest('[role="dialog"], [role="menu"], [role="listbox"], [data-testid*="notification" i], [class*="notification" i]')));
      const parAdresse = ouverte ? liens.filter((a) => cheminNotif(a) && !a.closest('header nav')) : [];
      const l = vt.length ? vt : parAdresse;
      if (!l.length) {
        // Sans « Voir tout » : un bloc désigné par la cloche elle-même (aria-controls) et montré.
        const c = [...document.querySelectorAll('button[aria-expanded="true"][aria-controls], [role="button"][aria-expanded="true"][aria-controls]')].filter((b) => visible(b) && RE_CLOCHE.test(norm(nomAcc(b))));
        if (c.length === 1) { const bloc = document.getElementById(c[0].getAttribute('aria-controls')); if (bloc && visible(bloc)) return { voirTout: '' }; }
        return null;
      }
      return { voirTout: cheminNotif(l[0]) || '' };
    } catch (_) { return null; }
  }
  function clocheVisible() {
    const tous = [...document.querySelectorAll('button, [role="button"]')].filter((b) => visible(b) && actif(b));
    const uniq = (l) => l.filter((b, i) => l.indexOf(b) === i && !l.some((x) => x !== b && x.contains(b)));
    let l = uniq(tous.filter((b) => RE_CLOCHE.test(norm(nomAcc(b)))));
    if (!l.length) {
      const enTete = (b) => !!b.closest('header, [role="banner"]');
      l = uniq([...document.querySelectorAll('[data-testid*="notification" i]')].map((e) => (e.matches('button, [role="button"]') ? e : e.querySelector('button, [role="button"]') || e.closest('button, [role="button"]'))).filter((b) => b && visible(b) && actif(b) && enTete(b)));
    }
    if (l.length > 1) { const h = l.filter((b) => !!b.closest('header, [role="banner"]')); if (h.length === 1) l = h; }
    return l.length === 1 ? { el: l[0] } : { el: null, ambigu: l.length > 1 };
  }
  // La ligne d'UN favori dans la cloche : son lien capté exact, ou la route native `?item_id=&receiver_id=` dont
  // les DEUX identités sont celles du favori (jamais un titre, jamais un pseudo). Un seul lien visible.
  function lienFavoriVisible(lien, itemId, receiverId) {
    const norme = (v) => { try { const u = new URL(v, location.href); if (u.origin !== location.origin) return null; u.hash = ''; u.searchParams.sort(); return u.href; } catch (_) { return null; } };
    const attendu = lien ? norme(lien) : null;
    // 5.440.1 : la notification porte désormais `item_id` + `user_id` (lien d'application mesuré le 23 nov.) ; la ligne de la page
    //    peut donc dire la personne par `receiver_id` OU `user_id` (une seule des deux, avec éventuellement `portal`) — toujours
    //    les DEUX identités exactes du favori, sur vinted.fr même.
    const natif = (v) => { try { const u = new URL(v, location.href); const q = u.searchParams; const ks = [...q.keys()].filter((k) => k !== 'portal').sort().join(','); const qui = ks === 'item_id,receiver_id' ? 'receiver_id' : ks === 'item_id,user_id' ? 'user_id' : ''; if (!qui || q.getAll('item_id').length !== 1 || q.getAll(qui).length !== 1 || q.getAll('portal').length > 1) return false; return u.origin === location.origin && q.get('item_id') === itemId && q.get(qui) === receiverId; } catch (_) { return false; } };
    const l = [...document.querySelectorAll('a[href]')].filter((a) => visible(a) && ((attendu && norme(a.href) === attendu) || natif(a.href) || identiteLigneFavori(a.href, itemId, receiverId)));
    return l.length === 1 ? { el: l[0] } : { el: null, ambigu: l.length > 1 };
  }
  // 5.440.2 (Julien, 24 nov. 17:45 : « Sauté · Favori trop ancien » pour des favoris de 0 à 2 jours, rangs 1, 2 et 4 de la
  //    liste de Vinted) : la ligne d'un favori se reconnaît par ses DEUX identités, quelle que soit la forme exacte de son
  //    adresse sur la page — l'article (`/items/N/…` ou `item_id=N`) ET la personne (`offering_id`, `receiver_id` ou
  //    `user_id`, une seule clé, une seule valeur), sur vinted.fr même, dans une adresse de favori (`want_it`) ou la
  //    forme native `?item_id=&receiver_id=`. Un autre paramètre d'identité (`…_id`) qui n'est pas l'un des deux ⇒ refusée
  //    (une autre personne, un autre article) ; un paramètre de suivi (`ref`, `source`…) ne change pas qui elle désigne.
  //    Jamais un titre, jamais un pseudo.
  function identiteLigneFavori(href, itemId, receiverId) {
    try {
      const u = new URL(href, location.href); if (u.origin !== location.origin) return false;
      const q = u.searchParams, ks = [...new Set([...q.keys()])];
      if (ks.some((k) => q.getAll(k).length !== 1)) return false;
      const m = /^\/items\/([1-9]\d{0,19})(?:-[^/]*)?\/want_it(?:\/new)?\/?$/.exec(u.pathname);
      const favori = !!m || /^\/(?:inbox\/)?want_it(?:\/new)?\/?$/.test(u.pathname);
      if (!favori) return false;
      const article = m ? m[1] : q.get('item_id');
      if (m && q.has('item_id') && q.get('item_id') !== m[1]) return false;
      const qui = ['offering_id', 'receiver_id', 'user_id'].filter((k) => q.has(k));
      if (qui.length !== 1) return false;
      if (ks.some((k) => /_id$/i.test(k) && k !== 'item_id' && k !== qui[0])) return false;
      return article === itemId && q.get(qui[0]) === receiverId && itemId !== receiverId;
    } catch (_) { return false; }
  }
  // Les lignes de notification montrées (pour savoir si la page en a chargé assez) : un lien de favori, d'article ou une ligne native.
  const lignesNotif = () => [...document.querySelectorAll('a[href*="/want_it"], a[href*="receiver_id="], a[href*="offering_id="], a[href*="/items/"], [data-testid*="notification" i]')].filter((x) => !x.closest('header, footer, [role="banner"]')).length;
  // Le bouton qui charge la suite de la liste (« Afficher plus »…), seul ; jamais une ligne, jamais un lien.
  const RE_PLUS = /^(?:afficher plus|voir plus|charger plus|plus de notifications|show more|load more|see more|view more|mostrar m[aá]s|ver m[aá]s|cargar m[aá]s|mostra altro|carica altro|vedi altro|mehr anzeigen|mehr laden|weitere laden)$/;
  const boutonPlus = () => { const l = [...document.querySelectorAll('button, [role="button"]')].filter((b) => visible(b) && actif(b) && !deVrm(b) && RE_PLUS.test(norm(nomAcc(b)))); return l.length === 1 ? l[0] : null; };
  // Le bloc qui défile (la liste peut vivre dans un conteneur, pas dans la fenêtre) : l'ancêtre défilant de la dernière ligne.
  const blocDefilant = () => {
    const l = [...document.querySelectorAll('a[href*="/want_it"], a[href*="/items/"], [data-testid*="notification" i]')].filter(visible);
    let e = l.length ? l[l.length - 1].parentElement : null;
    while (e && e !== document.body && e !== document.documentElement) { try { const st = getComputedStyle(e); if (/(auto|scroll)/.test(st.overflowY) && e.scrollHeight > e.clientHeight + 4) return e; } catch (_) {} e = e.parentElement; }
    return null;
  };
  async function attendreChemin(re, ms) {
    let r = null; try { r = re instanceof RegExp ? re : new RegExp(String(re || '^/')); } catch (_) { return { ok: false }; }
    const fin = Date.now() + ms;
    for (;;) { if (captcha()) return { captcha: true }; if (r.test(location.pathname)) return { ok: true }; if (Date.now() > fin) return { ok: false }; await nap(150); }
  }
  // ══ 5.440 (23 nov., mesuré en production) — LA NOUVELLE MESSAGERIE DE VINTED ══════════════════════════════════════
  //  Relevé passif du 23 nov. 06:33 (compte de Julien, `harvest_*_seen_urls`, formes seulement) : la conversation ouverte
  //  depuis la cloche n'est plus `POST /api/v2/conversations` mais `POST api.vinted.fr/messaging/main/inquiries` (201 :
  //  `conversation_id` texte, `transaction_id`) ; la page vit sur `/inbox/{uuid}` et relit
  //  `GET api.vinted.fr/messaging/main/conversations/{uuid}` (porte `core_id_deprecated`, l'ANCIEN n° de la conversation) ;
  //  le message part en `POST …/messaging/main/conversations/{uuid}/replies` (réponse : `conversation_id`, `data.content`).
  //  inject.js retient, dans la page seulement, uuid → ancien n° (`__vrmConvCore`, lu sur la réponse de Vinted elle-même).
  //  Une conversation n'est « la bonne » que par IDENTITÉ : l'adresse porte son ancien n°, ou son uuid dont la page a dit
  //  qu'il est CE n°. Jamais par un titre ni un pseudo.
  const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  const uuidIci = () => { const m = /^\/inbox\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/.exec(location.pathname); return m ? m[1] : ''; };
  const coeurDe = (uuid) => { try { const x = globalThis.__vrmConvCore && globalThis.__vrmConvCore[uuid]; return x && /^[1-9]\d{0,19}$/.test(String(x.core)) ? String(x.core) : ''; } catch (_) { return ''; } };
  function surConv(conv, d) {
    if (!/^[1-9]\d{0,19}$/.test(String(conv || ''))) return false;
    if (new RegExp(`^/inbox/${conv}/?$`).test(location.pathname)) return true;
    const u = uuidIci(); if (!u) return false;
    const route = String((d && d.route) || '');
    // L'uuid passé par le fond (appris de CETTE page) ou celui dont la page a dit l'ancien n° : les deux doivent concorder.
    const c = coeurDe(u);
    if (c) return c === String(conv);
    return RE_UUID.test(route) && route === u;
  }
  // La page vient d'être ouverte : la relecture de la conversation par Vinted (qui dit l'ancien n°) peut arriver juste après.
  async function attendreConv(conv, d, ms) { const fin = Date.now() + ms; for (;;) { if (surConv(conv, d)) return true; if (!uuidIci() || Date.now() > fin) return surConv(conv, d); await nap(200); } }
  // La réponse d'un message, ancienne ou nouvelle messagerie : 2xx ET la conversation dite par Vinted = celle-ci.
  function repMessageNormale(r, conv) {
    if (!r || !r.json || typeof r.json !== 'object') return r;
    const j = r.json, u = uuidIci();
    if (j.code == null && typeof j.conversation_id === 'string' && u && j.conversation_id === u && r.ok) return Object.assign({}, r, { json: Object.assign({}, j, { code: 0, nouvelle: true, conversation: { id: Number(conv) } }) });
    return r;
  }
  const T = () => globalThis.__vrmTrouver || null;
  // Ce que la couche de repérage a vu pendant l'étape : rendu au fond (mémoire de la stratégie gagnante, journal sinon).
  const TROUVES = [];
  let MEMOIRE = {};
  function noterTrouve(nom, r) { try { if (!r) return; TROUVES.push({ nom, s: r.el ? String(r.strategie || '') : '', ambigu: !!r.ambigu, essais: (r.essais || []).map((e) => ({ s: e.s, n: e.n })).slice(0, 8) }); if (TROUVES.length > 12) TROUVES.shift(); } catch (_) {} }
  const ETAPES = {
    async etat() { return { ok: true, chemin: location.pathname, captcha: captcha(), formulaire: !!document.querySelector(SEL.titre) }; },
    async ouvrirVente() {
      const a = await attendreN('vendre', SEL.vendre); if (a.captcha) return vuCaptcha(); if (a.absent) return manque('vendre');
      clic(a.el);
      const f = await attendreN('titre', SEL.titre, 30000); if (f.captcha) return vuCaptcha(); if (f.absent) return manque('titre');
      return { ok: true, chemin: location.pathname };
    },
    async formulairePret() {
      const f = await attendreN('titre', SEL.titre, 30000); if (f.captcha) return vuCaptcha(); if (f.absent) return manque('titre');
      return { ok: true, chemin: location.pathname };
    },
    async photos(d) {
      const a = await attendreN('photos', SEL.photos); if (a.captcha) return vuCaptcha(); if (a.absent) return manque('photos');
      const liste = Array.isArray(d && d.photos) ? d.photos : [];
      if (!liste.length) return { ok: false, code: 'photos-absentes' };
      ecouter();
      const dt = new DataTransfer();
      for (const p of liste) {
        const bin = atob(String(p.b64 || '')); const u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        dt.items.add(new File([u8], String(p.nom || 'photo.jpg'), { type: p.type || 'image/jpeg' }));
      }
      const vus0 = (globalThis.__vrmFormVues || []).length;
      a.el.files = dt.files;
      a.el.dispatchEvent(new Event('input', { bubbles: true }));
      a.el.dispatchEvent(new Event('change', { bubbles: true }));
      const fin = Date.now() + Math.max(30000, liste.length * 15000);
      for (;;) {
        if (captcha()) return vuCaptcha();
        const rep = (globalThis.__vrmFormVues || []).slice(vus0).filter((e) => e.methode === 'POST' && /\/api\/v2\/photos$/.test(e.chemin));
        const ko = rep.find((e) => !(e.status >= 200 && e.status < 300));
        if (ko) return { ok: false, code: 'refus', status: ko.status, json: ko.json, texte: ko.texte || '' };
        // 5.429 : chaque fichier téléversé ↔ l'identifiant que Vinted a rendu (le nom vient de la requête de la PAGE).
        if (rep.length >= liste.length) return { ok: true, n: rep.length, envoyes: rep.map((e) => ({ nom: e.fichiers && e.fichiers.length === 1 ? e.fichiers[0] : '', id: e.json && (e.json.id != null ? String(e.json.id) : (e.json.photo && e.json.photo.id != null ? String(e.json.photo.id) : '')) })) };
        if (Date.now() > fin) return { ok: false, code: 'photos-delai', n: rep.length };
        await nap(300);
      }
    },
    async champ(d) {
      const q = d && d.quoi;
      if (captcha()) return vuCaptcha();
      if (q === 'titre' || q === 'description' || q === 'prix') {
        const a = await attendre(SEL[q]); if (a.captcha) return vuCaptcha(); if (a.absent) return manque(q);
        const v = q === 'prix' ? String(d.valeur).replace('.', ',') : String(d.valeur);
        // 5.437 : titre et prix lettre par lettre (rythme variable) ; la description collée (défaut) ou tapée par rafales.
        const ok = q === 'description' && d.mode !== 'taper' ? await coller(a.el, v) : await saisir(a.el, v, { rythme: q === 'description' ? 'rafales' : 'lettres' });
        return ok ? { ok: true } : { ok: false, code: 'valeur', manque: q };
      }
      if (q === 'categorie') {
        const a = await attendreN('categorie', SEL.categorie); if (a.captcha) return vuCaptcha(); if (a.absent) return manque('categorie');
        clic(a.el);
        const s = await attendreN('categorie-recherche', SEL.categorieRecherche); if (s.captcha) return vuCaptcha(); if (s.absent) return manque('categorie-recherche');
        await saisir(s.el, String(d.recherche || d.nom || ''), { rythme: 'lettres' });
        const o = await attendreN('categorie-option', () => { const l = document.querySelector(SEL.categorieListe) || document; return option(l, d.id, d.nom); }, 15000);
        if (o.captcha) return vuCaptcha(); if (o.absent) return manque('categorie-option');
        clic(o.el);
        return { ok: true };
      }
      if (q === 'marque') {
        const a = await attendreN('marque', SEL.marque); if (a.captcha) return vuCaptcha(); if (a.absent) return manque('marque');
        if (norm(a.el.value) && norm(a.el.value) === norm(d.nom)) return { ok: true, deja: true };
        clic(a.el);
        const s = await attendreN('marque-recherche', SEL.marqueRecherche); if (s.captcha) return vuCaptcha(); if (s.absent) return manque('marque-recherche');
        await saisir(s.el, String(d.nom || ''), { rythme: 'lettres' });
        const o = await attendreN('marque-option', () => option(document, d.id, d.nom), 15000); if (o.captcha) return vuCaptcha(); if (o.absent) return manque('marque-option');
        clic(o.el);
        return { ok: true };
      }
      if (q === 'taille') {
        const a = await attendreN('taille', SEL.taille); if (a.captcha) return vuCaptcha(); if (a.absent) return manque('taille');
        clic(a.el);
        const o = await attendreN('taille-option', () => [...document.querySelectorAll(`[data-testid$="-grid-option-${String(d.id)}"]`)].find(visible) || null);
        if (o.captcha) return vuCaptcha(); if (o.absent) return manque('taille-option');
        clic(o.el);
        return { ok: true };
      }
      if (q === 'couleurs') {
        const a = await attendreN('couleur', SEL.couleur); if (a.captcha) return vuCaptcha(); if (a.absent) return manque('couleur');
        clic(a.el);
        for (const id of (Array.isArray(d.ids) ? d.ids : []).slice(0, 2)) {
          const o = await attendreN('couleur-option', `[data-testid="filter-grid-option-${String(id)}"]`); if (o.captcha) return vuCaptcha(); if (o.absent) return manque('couleur-option');
          if (o.el.getAttribute('aria-checked') === 'true' || o.el.getAttribute('aria-selected') === 'true') continue;
          clic(o.el); await nap(400);
        }
        return { ok: true };
      }
      if (q === 'colis') {
        const a = await attendreN('colis', `#package_type_selector_${String(d.id)}`); if (a.captcha) return vuCaptcha(); if (a.absent) return manque('colis');
        clic(a.el);
        return { ok: true };
      }
      // 5.414 : « Unisexe » — la case du formulaire (une seule), cochée seulement si elle ne l'est pas déjà.
      if (q === 'unisexe') {
        const a = await attendreN('unisexe', () => { const l = [...document.querySelectorAll('input[type="checkbox"]#is_unisex, input[type="checkbox"][name="is_unisex"], [data-testid*="unisex" i] input[type="checkbox"], input[type="checkbox"][data-testid*="unisex" i]')].filter((x) => !deVrm(x)); const u = [...new Set(l)]; return u.length === 1 ? u[0] : (u.length > 1 ? 'AMBIGU' : null); }, 10000);
        if (a.captcha) return vuCaptcha(); if (a.absent) return manque('unisexe'); if (a.el === 'AMBIGU') return manque('unisexe-ambigu');
        if (a.el.checked !== (d.valeur === true)) { clic(a.el.closest('label') || a.el); await nap(300); }
        return a.el.checked === (d.valeur === true) ? { ok: true } : { ok: false, code: 'valeur', manque: 'unisexe' };
      }
      if (q === 'etat') {
        const a = await attendreN('etat', SEL.etat); if (a.captcha) return vuCaptcha(); if (a.absent) return manque('etat');
        clic(a.el);
        const o = await attendreN('etat-option', `#condition-${String(d.id)}, [data-testid="condition-${String(d.id)}"]`); if (o.captcha) return vuCaptcha(); if (o.absent) return manque('etat-option');
        clic(o.el);
        return { ok: true };
      }
      return { ok: false, code: 'etape' };
    },
    // Les trois gestes qui écrivent chez Vinted : la page envoie, VRM lit la réponse.
    async brouillon(d) {
      const b = await attendreN('brouillon', SEL.brouillon); if (b.captcha) return vuCaptcha(); if (b.absent) return manque('brouillon');
      ecouter();
      const att = reponseDe('POST', /\/api\/v2\/item_upload\/drafts\/?$/, 60000, d && d.cle);
      clic(b.el);
      const r = await att;
      return r ? (r.captcha ? Object.assign(vuCaptcha(), { parti: true }) : { ok: true, rep: r }) : { ok: false, code: 'sans-reponse', parti: true };
    },
    async supprimer(d) {
      // 5.414 : la page montrée est celle de CETTE annonce (son identifiant dans l'adresse), sinon rien n'est touché.
      if (!new RegExp(`^/items/${String(d && d.id)}(?:-[^/]*)?/?$`).test(location.pathname)) return { ok: false, code: 'identite', chemin: location.pathname };
      const b = await attendreN('supprimer', SEL.supprimer, 20000); if (b.captcha) return vuCaptcha(); if (b.absent) return manque('supprimer');
      ecouter();
      const att = reponseDe('POST', new RegExp(`/api/v2/items/${String(d && d.id)}/delete$`), 60000, d && d.cle);
      clic(b.el);
      // La confirmation de Vinted : un bouton de la fenêtre qui s'ouvre (jamais « Annuler »).
      const c = await attendreN('supprimer-confirmation', () => {
        const dlg = [...document.querySelectorAll('[role="dialog"],[data-testid*="modal"]')].filter(visible);
        for (const m of dlg) {
          const bs = [...m.querySelectorAll('button')].filter(visible);
          const parId = bs.find((x) => /delete|confirm|supprim/i.test(x.getAttribute('data-testid') || '') && !/cancel|annul|close/i.test(x.getAttribute('data-testid') || ''));
          if (parId) return parId;
          const parTexte = bs.find((x) => /supprimer|confirmer|delete|confirm|eliminar|elimina|löschen/i.test(x.textContent || '') && !/annuler|cancel|annulla|cancelar|abbrechen/i.test(x.textContent || ''));
          if (parTexte) return parTexte;
        }
        return null;
      }, 15000);
      if (c.captcha) return vuCaptcha(); if (c.absent) return manque('supprimer-confirmation');
      clic(c.el);
      const r = await att;
      return r ? (r.captcha ? Object.assign(vuCaptcha(), { parti: true }) : { ok: true, rep: r }) : { ok: false, code: 'sans-reponse', parti: true };
    },
    async publier(d) {
      const b = await attendreN('ajouter', SEL.ajouter, 30000); if (b.captcha) return vuCaptcha(); if (b.absent) return manque('ajouter');
      ecouter();
      const att = reponseDe('POST', new RegExp(`/api/v2/item_upload/drafts/${String(d && d.draftId)}/completion$`), 60000, d && d.cle);
      clic(b.el);
      const r = await att;
      return r ? (r.captcha ? Object.assign(vuCaptcha(), { parti: true }) : { ok: true, rep: r }) : { ok: false, code: 'sans-reponse', parti: true };
    },
    // ══ 5.414 (`toutinterface`, Julien, 21 nov. : « on ne fait plus les requêtes ») ══════════════════════════
    // Les gestes de la messagerie, de l'annonce et du formulaire de prix, PAR L'INTERFACE : VRM clique et tape, la
    // PAGE de Vinted envoie SA requête, VRM lit sa réponse puis VÉRIFIE à l'écran (message apparu, offre affichée).
    // Avant chaque geste : la page montrée est la BONNE (identifiants dans l'adresse, jamais un titre) ; un élément
    // introuvable ou ambigu (deux candidats) ⇒ arrêt AVANT le geste, son nom dit (`selecteur`).
    async ouvrir(d) {
      // 5.440 : une conversation (ancien n° ou uuid de la nouvelle messagerie) se reconnaît par `surConv`, pas par l'adresse seule.
      if (d && /^[1-9]\d{0,19}$/.test(String(d.conv || ''))) { const fin = Date.now() + 20000; for (;;) { if (captcha()) return vuCaptcha(); if (surConv(String(d.conv), d)) return { ok: true, chemin: location.pathname }; if (Date.now() > fin) return { ok: false, code: 'identite', chemin: location.pathname }; await nap(150); } }
      const a = await attendreChemin(d && d.chemin, 20000); if (a.captcha) return vuCaptcha(); if (!a.ok) return { ok: false, code: 'identite', chemin: location.pathname };
      return { ok: true, chemin: location.pathname };
    },
    async favoriOuvrir(d) {
      if (captcha()) return vuCaptcha();
      ecouter();
      const itemId = String((d && d.itemId) || ''), receiverId = String((d && d.receiverId) || ''), lien = String((d && d.lien) || '');
      if (!/^[1-9]\d{0,19}$/.test(itemId) || !/^[1-9]\d{0,19}$/.test(receiverId)) return { ok: false, code: 'etape' };
      // 1. La cloche : ouverte par SON bouton, sauf si la ligne est déjà là ou si la liste est déjà ouverte.
      // 22 nov. (production) : la liste de la cloche ne montre que les DERNIÈRES notifications, tous types mêlés (« Le prix
      // de l'article … a été réduit », etc.). Le favori cherché peut ne pas y être : ce n'est PAS « Vinted a changé le
      // bouton ». Trois issues nettes, jamais confondues :
      //   · la cloche introuvable (ni bouton, ni liste ouverte)            ⇒ `cloche` (le geste est dit) ;
      //   · la liste ouverte, la ligne de CE favori n'y est pas             ⇒ `favori-notification`, `absent`, et le
      //     chemin de « Voir tout » : le fond ouvre la page complète et rappelle l'étape (`liste`) ;
      //   · sur la page complète, pas trouvée après l'avoir fait défiler     ⇒ `absent` : ce favori est SAUTÉ, la file continue.
      // Seule la ligne dont le lien porte CET article ET CETTE personne est cliquée — jamais une autre notification.
      // 5.440.2 (`direct`) : le fond a OUVERT l'adresse native de CE favori dans l'onglet de travail (le lien de sa notification,
      //    lu dans la liste de Vinted, article ET personne vérifiés) ; c'est la page de Vinted qui ouvre la conversation —
      //    aucune ligne à chercher, aucun clic, aucun défilement (rien ne dépend du rendu d'un onglet en arrière-plan).
      const direct = !!(d && d.direct === true);
      let l = direct ? { el: null } : lienFavoriVisible(lien, itemId, receiverId);
      if (l.ambigu) return manque('favori-notification-ambigue');
      const trouver = async (ms, pendant) => {
        const fin = Date.now() + ms;
        for (;;) {
          if (captcha()) return { captcha: true };
          const x = lienFavoriVisible(lien, itemId, receiverId);
          if (x.ambigu) return { ambigu: true };
          if (x.el) return { el: x.el };
          if (pendant && (await pendant()) === 'fini') return { absent: true };
          if (Date.now() > fin) return { absent: true };
          await nap(200);
        }
      };
      const absent = (extra) => Object.assign(manque('favori-notification'), { absent: true }, extra || {});
      if (direct) { /* l'adresse est déjà ouverte : la suite attend la conversation */ } else if (!l.el && d && d.liste === true) {
        // La page complète des notifications : lue (lecture seule) jusqu'à la ligne, en chargeant la SUITE autant qu'il faut.
        // ⚠️ 5.440.2 (Julien, 24 nov. : « Sauté · Favori trop ancien » pour des favoris de la veille) : avant, la lecture
        //    s'arrêtait dès que la page ne bougeait plus pendant ~1,4 s, en ne faisant défiler que la FENÊTRE — une liste qui
        //    vit dans un conteneur, ou dont la suite met plus de temps à venir, était déclarée « lue » sans l'être. Désormais :
        //    la fenêtre ET le bloc qui défile, le bouton « Afficher plus » s'il est seul, une attente de 4 s pour chaque
        //    suite ; la lecture ne s'arrête que (a) ligne trouvée, (b) trois tentatives de suite sans rien de nouveau (le
        //    BOUT), ou (c) 90 s. Le fond ne conclut JAMAIS « trop ancien » de cette lecture (voir `executerMessageFavori`) :
        //    seule la liste de Vinted lue jusqu'à sa dernière page le prouve.
        let compte = lignesNotif(), hauteur = 0, sansRien = 0, fin = 'temps';
        const tFin = Date.now() + 90000;
        const t = await (async () => {
          for (;;) {
            if (captcha()) return { captcha: true };
            const x = lienFavoriVisible(lien, itemId, receiverId);
            if (x.ambigu) return { ambigu: true };
            if (x.el) return { el: x.el };
            if (sansRien >= 3) { fin = 'bout'; return { absent: true }; }
            if (Date.now() > tFin) { fin = 'temps'; return { absent: true }; }
            // Charger la suite : bas de la fenêtre et du bloc qui défile (un cran plus haut d'abord, pour que la page le voie), puis « Afficher plus ».
            const b = blocDefilant();
            // ⚠️ Aucun événement fabriqué (`dispatchEvent` ⇒ isTrusted:false, une preuve d'automatisation, CLAUDE.md §3) : seules
            //    les positions sont posées (fenêtre, bloc qui défile) ; c'est le NAVIGATEUR qui envoie son propre « scroll ».
            //    Onglet de travail en arrière-plan : le navigateur peut ne rien envoyer (aucun rendu) ⇒ la suite ne vient pas,
            //    le favori n'est PAS trouvé sur cette page : le fond ouvre alors son adresse native (`favoriLien`), sans défilement.
            try { const h = document.documentElement.scrollHeight; window.scrollTo(0, Math.max(0, h - window.innerHeight - 240)); window.scrollTo(0, h); } catch (_) {}
            if (b) { try { b.scrollTop = Math.max(0, b.scrollHeight - b.clientHeight - 240); b.scrollTop = b.scrollHeight; } catch (_) {} }
            await nap(250);
            const p = boutonPlus(); if (p) { try { p.click(); } catch (_) {} }
            // La suite attendue 4 s au plus (relue toutes les 200 ms) : nouvelles lignes ou page plus haute.
            const t0 = Date.now(); let neuf = false;
            while (Date.now() - t0 < 4000) {
              if (captcha()) return { captcha: true };
              const y = lienFavoriVisible(lien, itemId, receiverId); if (y.el || y.ambigu) break;
              const n = lignesNotif(), h2 = document.documentElement.scrollHeight + (b ? b.scrollHeight : 0);
              if (n > compte || (hauteur && h2 > hauteur)) { neuf = true; compte = Math.max(compte, n); hauteur = h2; break; }
              hauteur = hauteur || h2;
              await nap(200);
            }
            sansRien = neuf ? 0 : sansRien + 1;
          }
        })();
        if (t.captcha) return vuCaptcha(); if (t.ambigu) return manque('favori-notification-ambigue');
        // 5.440 : « absent » ne se dit que sur une VRAIE liste de notifications (au moins une ligne de favori ou de notification
        //    native) ; une page qui n'en montre aucune n'est pas la liste (adresse changée, page d'erreur) ⇒ nommé, rien sauté.
        if (t.absent && !document.querySelector('a[href*="/want_it/"], a[href*="receiver_id="], a[href*="offering_id="], [data-testid*="notification" i]')) return manque('notifications-introuvables');
        if (t.absent) return absent({ liste: true, fin, lignes: compte });
        try { t.el.scrollIntoView({ block: 'center' }); } catch (_) {}
        l = { el: t.el };
      } else if (!l.el) {
        let p = panneauCloche();
        if (!p) {
          // 5.440 (`clocheauto`) : la cloche par la couche de repérage — plusieurs stratégies (nom en 5 langues, data-testid,
          //    lien des notifications, icône, en-tête, compteur), la page attendue 12 s pendant qu'elle se construit, la
          //    stratégie qui a marché la dernière fois d'abord. Plus JAMAIS « touche le bouton » : introuvable ⇒ le fond
          //    passe par la page complète des notifications, puis s'arrête avec le journal des stratégies essayées.
          const t = T();
          let c;
          if (t) { const r = await t.attendre('cloche', { prefere: MEMOIRE.cloche || '' }, 12000, captcha); if (r.captcha) return vuCaptcha(); noterTrouve('cloche', r); c = { el: r.el || null, ambigu: !!r.ambigu }; }
          else c = clocheVisible();
          if (c.ambigu) return manque('cloche-ambigue'); if (!c.el) return manque('cloche');
          // Un LIEN vers la page des notifications : la même liste, complète — le fond l'ouvre (`favoriListe`).
          if (c.el.tagName === 'A') { const ch = cheminNotif(c.el); if (ch) return absent({ cloche: true, voirTout: ch, lienCloche: true }); }
          if (c.el.getAttribute('aria-expanded') !== 'true') { if (H(d)) await toucher(c.el, 'cloche'); else clic(c.el); }
        }
        // La ligne attendue 8 s au plus ; dès que la liste est ouverte (« Voir tout » montré) depuis 2,5 s sans elle, c'est su.
        let ouverteDepuis = p ? Date.now() : 0;
        const t = await trouver(8000, async () => { p = panneauCloche(); if (p && !ouverteDepuis) ouverteDepuis = Date.now(); return p && Date.now() - ouverteDepuis > 2500 ? 'fini' : ''; });
        if (t.captcha) return vuCaptcha(); if (t.ambigu) return manque('favori-notification-ambigue');
        // 5.440.2 : combien de lignes la cloche montre (lignes de favori ou de notification visibles) — le fond s'en sert pour
        //    aller DIRECTEMENT à la page complète quand la ligne d'un favori est plus bas dans la liste de Vinted.
        if (t.absent) { const vues = [...document.querySelectorAll('a[href*="/want_it"], a[href*="receiver_id="], a[href*="offering_id="], a[href*="/items/"]')].filter((x) => visible(x) && !x.closest('header, footer, [role="banner"]')).length; return absent({ cloche: !!p, voirTout: (p && p.voirTout) || '', lignes: vues }); }
        l = { el: t.el };
      }
      // 2. La ligne du favori (le lien porte l'article ET la personne) : un clic ; la page ouvre la conversation.
      // 5.440 : l'ancienne création (`POST /api/v2/conversations`) OU la nouvelle (`POST …/messaging/main/inquiries`, mesurée
      //    le 23 nov.) ; la conversation montrée sur `/inbox/{n°}` ou `/inbox/{uuid}` — l'uuid n'est reconnu que par l'ancien
      //    n° que la page a lu de Vinted (`__vrmConvCore`), jamais deviné.
      let rep = null, repVue = false;
      reponseDe('POST', /(?:\/api\/v2\/conversations|\/messaging\/main\/inquiries)\/?$/, 25000, d && d.cle).then((x) => { rep = x; repVue = true; });
      const _cheminAvantClic = direct ? '' : location.pathname;
      if (!direct) { if (H(d)) await toucher(l.el, 'ligne'); else clic(l.el); }
      // ⚠️ 24 nov. (simulation de bout en bout, vraie extension) : `conv` et `route` sont relus de l'adresse ACTUELLE à chaque
      //    tour, jamais gardés d'un tour d'avant. Avant : à partir du 2ᵉ favori, l'onglet de travail montrait la conversation
      //    PRÉCÉDENTE ; une fois l'adresse passée au nouvel uuid mais sa relecture pas encore reçue (`coeurDe` inconnu), `conv`
      //    restait l'ancien n° de la conversation précédente, apparié au NOUVEL uuid — la vérification relisait une autre
      //    conversation (autre acheteur) et le favori finissait « pas envoyé ». La conversation montrée AVANT le clic ne compte
      //    que si la réponse de création dit qu'elle est la même (conversation déjà ouverte).
      const avantClic = String(_cheminAvantClic || '');
      const fin = Date.now() + 25000; let conv = '', route = '';
      for (;;) {
        if (captcha()) return Object.assign(vuCaptcha(), { parti: true });
        let ici = '', rIci = '';
        const m = /^\/inbox\/([1-9]\d{0,19})\/?$/.exec(location.pathname); if (m) ici = m[1];
        const u = uuidIci(); if (u) { rIci = u; ici = coeurDe(u) || ''; }
        const rj = rep && rep.json;
        const memeQuAvant = location.pathname === avantClic && !(rj && ((typeof rj.conversation_id === 'string' && rIci && rj.conversation_id === rIci) || (rj.conversation && ici && String(rj.conversation.id) === ici)));
        conv = memeQuAvant ? '' : ici; route = memeQuAvant ? '' : rIci;
        if (!conv && rep && rep.json && rep.json.conversation && /^[1-9]\d{0,19}$/.test(String(rep.json.conversation.id))) conv = String(rep.json.conversation.id);
        // La conversation montrée ; la réponse de création attendue encore 3 s (une conversation déjà là n'en a pas).
        if (conv && (repVue || Date.now() > fin - 22000)) break;
        if (Date.now() > fin) break;
        await nap(200);
      }
      if (rep && rep.captcha) return Object.assign(vuCaptcha(), { parti: true });
      // La nouvelle création dit l'uuid : il doit être CELUI de la page (sinon ce n'est pas notre conversation).
      if (rep && rep.json && typeof rep.json.conversation_id === 'string' && route && rep.json.conversation_id !== route) return { ok: false, code: 'identite', parti: true, chemin: location.pathname };
      const txN = rep && rep.json && /^[1-9]\d{0,19}$/.test(String(rep.json.transaction_id || '')) ? String(rep.json.transaction_id) : '';
      // Rien vu partir (aucune requête de création, aucune conversation montrée) : la page n'a rien écrit — arrêt, rien ne part.
      // Une conversation montrée (uuid) dont l'ancien n° n'a pas été lu : ouverte, mais pas prouvée ⇒ « partie », jamais rejouée.
      // 5.453.2 : la fenêtre « Faire une offre » que Vinted ouvre d'elle-même en touchant le favori (attendue 2,5 s) — dite au fond,
      //    qui fait alors l'offre D'ABORD (dans cette fenêtre), puis le message.
      let offreOuverte = false;
      if (conv || rep || route) { const f2 = Date.now() + 2500; while (Date.now() < f2) { if (dialogueOffre()) { offreOuverte = true; break; } await nap(200); } }
      const plusO = offreOuverte ? { offreOuverte: true } : {};
      if (!conv) return rep || route ? { ok: true, rep, conv: '', route, envoye: !!rep, nonProuvee: true, ...plusO } : manque('conversation-pas-ouverte');
      return { ok: true, rep, conv, route, tx: txN, envoye: !!rep, chemin: location.pathname, ...plusO };
    },
    // La même étape sur la PAGE complète des notifications (« Voir tout ») : la cloche n'y est pas touchée.
    async favoriListe(d) { return ETAPES.favoriOuvrir(Object.assign({}, d || {}, { liste: true })); },
    // 5.440 : la même étape depuis l'accueil de Vinted (l'en-tête complet), quand la messagerie ne montre pas la cloche.
    async favoriAccueil(d) { return ETAPES.favoriOuvrir(Object.assign({}, d || {}, { liste: false })); },
    // 5.440.2 : l'adresse native du favori ouverte par le fond ⇒ la conversation que la page ouvre elle-même.
    async favoriLien(d) { return ETAPES.favoriOuvrir(Object.assign({}, d || {}, { direct: true })); },
    async message(d) {
      const conv = String((d && d.conv) || ''), texte = String((d && d.texte) || '');
      if (!/^[1-9]\d{0,19}$/.test(conv) || !texte.trim()) return { ok: false, code: 'etape' };
      const h = H(d);
      if (!(await attendreConv(conv, d, h ? 15000 : 8000))) return { ok: false, code: 'identite', chemin: location.pathname };
      // 5.453.2 : la fenêtre d'offre encore ouverte par-dessus le champ (le favori l'ouvre d'elle-même) : fermée d'abord (rien
      //    n'est envoyé) ; elle ne se ferme pas ⇒ rien ne part, c'est dit.
      if (h) { const dlo = dialogueOffre(); if (dlo && !(await fermerDialogueOffre(dlo))) return manque('offre-fenetre-ouverte'); }
      const z = await attendreN('message-champ', () => { const x = composeur(); return x.el || (x.ambigu ? 'AMBIGU' : null); }, 20000);
      if (z.captcha) return vuCaptcha(); if (z.absent) return manque('message-champ'); if (z.el === 'AMBIGU') return manque('message-champ-ambigu');
      const champ = z.el;
      // 5.453 (`favorishumains`) : comme une personne — le champ d'abord, le texte tapé, PUIS « Envoyer » (souvent éteint tant
      //    que le champ est vide : il n'est plus exigé AVANT la frappe). `taper` : l'étape tape et s'ARRÊTE (rien n'est envoyé) ;
      //    le fond revoit ses gardes (Tout arrêter, pause, compte de l'onglet) puis rappelle l'étape, qui trouve le texte
      //    déjà là et ne fait plus que toucher « Envoyer ».
      if (!h) { const env = ouAppris('message-envoyer', boutonEnvoyer(champ)); if (env.ambigu) return manque('message-envoyer-ambigu'); if (!env.el) return manque('message-envoyer'); }
      const memeTexte = () => valeurNette(champ) === texte.replace(/\r\n?/g, "\n").replace(/\n$/, "");
      const deja = h && memeTexte();
      // 5.453.2 : le texte compté HORS du champ (un champ riche est dans `innerText` : tapé, il comptait déjà « une fois »).
      const horsChamp = () => Math.max(0, occurrences(texte) - (champ.isContentEditable && norm(champ.innerText || '').includes(norm(texte).slice(0, 80)) ? 1 : 0));
      const avant = horsChamp();
      if (!deja) {
        if (h) {
          await regarder('message');
          const t = await taperHumain(champ, texte, Number(d && d.frappeMs) || 0);
          if (t.captcha) return vuCaptcha();
          if (!t.ok) return { ok: false, code: 'valeur', manque: 'message-champ' };
        } else {
          const okT = await saisir(champ, texte, { garderFocus: true });
          if (!okT) return { ok: false, code: 'valeur', manque: 'message-champ' };
        }
      }
      if (captcha()) return vuCaptcha();
      if (!surConv(conv, d)) return { ok: false, code: 'identite', chemin: location.pathname };
      if (h && d.taper === true) return memeTexte() ? { ok: true, tape: true, vu: true, chemin: location.pathname } : { ok: false, code: 'valeur', manque: 'message-champ' };
      let b2;
      if (h) {
        const w = await attendreN('message-envoyer', () => { const x = ouAppris('message-envoyer', boutonEnvoyer(champ)); return x.el || (x.ambigu ? 'AMBIGU' : null); }, 6000);
        if (w.captcha) return vuCaptcha(); if (w.el === 'AMBIGU') return manque('message-envoyer-ambigu'); if (!w.el) return manque('message-envoyer');
        b2 = { el: w.el };
        if (!memeTexte()) return { ok: false, code: 'valeur', manque: 'message-champ' };
        try { b2.el.scrollIntoView({ block: 'center' }); } catch (_) {}
        const ms = tirerUnique('hesite', 250, 900); noterDelai('hesite:envoyer', ms); await attenteFrappe(ms);
        if (captcha()) return vuCaptcha();
        if (!surConv(conv, d)) return { ok: false, code: 'identite', chemin: location.pathname };
      } else { b2 = ouAppris('message-envoyer', boutonEnvoyer(champ)); if (!b2.el || b2.ambigu) return manque('message-envoyer'); }
      ecouter();
      // 5.440 : l'ancienne messagerie (`/api/v2/conversations/{n°}/replies`) ou la nouvelle (`…/messaging/main/
      //    conversations/{uuid}/replies`, l'uuid de CETTE page, vérifié par `surConv`).
      const uIci = uuidIci();
      const att = reponseDe('POST', uIci ? new RegExp(`(?:/api/v2/conversations/${conv}|/messaging/main/conversations/${uIci})/replies$`) : new RegExp(`/api/v2/conversations/${conv}/replies$`), 30000, d && d.cle);
      clic(b2.el);
      const r = repMessageNormale(await att, conv);
      // 5.453.2 : AUCUNE requête d'envoi vue, le texte TOUJOURS dans le champ et rien de plus dans le fil ⇒ la page n'a rien
      //    envoyé : « pas parti », certain (avant : « incertain », et la file se bloquait sur « Vérifie les envois incertains »).
      if (!r) { if (h && memeTexte() && champ.isConnected && horsChamp() <= avant) return { ok: false, code: 'valeur', manque: 'message-non-parti', chemin: location.pathname }; return { ok: false, code: 'sans-reponse', parti: true }; }
      if (r.captcha) return Object.assign(vuCaptcha(), { parti: true });
      if (!r.ok) return { ok: true, rep: r, vu: false };
      // La preuve à l'écran : le message est apparu dans le fil (une occurrence de plus qu'avant l'envoi), relue jusqu'à 12 s.
      const v = await attendre(() => (horsChamp() > avant ? true : null), 12000);
      if (v.el === true) return { ok: true, rep: r, vu: true };
      // 5.453.2 : sinon, la RÉPONSE de Vinted à CET envoi porte CE texte (le message enregistré chez Vinted) — une preuve aussi.
      const j = r.json && typeof r.json === 'object' ? r.json : {};
      const dit = [j.content, j.body, j.data && j.data.content, j.data && j.data.body, j.message && j.message.body, j.message && j.message.content, j.reply && j.reply.body].find((x) => typeof x === 'string');
      return { ok: true, rep: r, vu: !!(dit && norm(dit) === norm(texte)), ...(dit && norm(dit) === norm(texte) ? { vuPar: 'reponse' } : {}) };
    },
    async offre(d) {
      const conv = String((d && d.conv) || ''), tx = String((d && d.tx) || ''), prix = Number(d && d.prix);
      if (!/^[1-9]\d{0,19}$/.test(conv) || !/^[1-9]\d{0,19}$/.test(tx) || !(prix > 0)) return { ok: false, code: 'etape' };
      if (!(await attendreConv(conv, d, H(d) ? 15000 : 8000))) return { ok: false, code: 'identite', chemin: location.pathname };
      // 5.453.2 : la fenêtre d'offre DÉJÀ ouverte (le favori l'ouvre d'elle-même) : on y travaille, sans toucher « Faire une offre ».
      const dejaOuverte = H(d) ? dialogueOffre() : null;
      const b = dejaOuverte ? { el: null } : await attendreN('offre-bouton', () => { let x = parNom(RE_FAIRE_OFFRE, document, /make[-_]?offer|offer[-_]?(button|cta)/i, /accept|decline|reject|cancel/i); if (!x.el && !x.ambigu && T()) { const r = T().trouver('boutonOffre', {}); noterTrouve('boutonOffre', r); x = { el: r.el || null, ambigu: !!r.ambigu }; } return x.el || (x.ambigu ? 'AMBIGU' : null); }, 20000);
      if (b.captcha) return vuCaptcha(); if (b.absent) return manque('offre-bouton'); if (b.el === 'AMBIGU') return manque('offre-bouton-ambigu');
      const avant = occurrencesPrix(prix);
      const h = H(d);   // 5.453 : « Faire une offre » touché après une hésitation, la fenêtre regardée, le prix tapé, « Proposer » touché
      if (!dejaOuverte) { if (h) await toucher(b.el, 'offre'); else clic(b.el); }
      const dl = dejaOuverte ? { el: dejaOuverte } : await attendreN('offre-fenetre', () => dialogue(), 15000); if (dl.captcha) return vuCaptcha(); if (dl.absent) return manque('offre-fenetre');
      if (h) await regarder('offre');
      const inp = await attendreN('offre-prix', () => { const x = champPrix(dl.el); return x.el || (x.ambigu ? 'AMBIGU' : null); }, 10000);
      if (inp.captcha) return vuCaptcha(); if (inp.absent) return manque('offre-prix'); if (inp.el === 'AMBIGU') return manque('offre-prix-ambigu');
      const okT = h ? await taperHumain(inp.el, texteMontant(prix), 0).then((t) => (t.captcha ? 'captcha' : t.ok)) : await saisir(inp.el, texteMontant(prix), { garderFocus: true });
      if (okT === 'captcha') return vuCaptcha();
      if (!okT) return { ok: false, code: 'valeur', manque: 'offre-prix' };
      // 5.453.2 : un champ de MESSAGE dans la fenêtre d'offre (un seul, hors prix) : le message y est tapé, il part avec l'offre.
      const tMsg = String((d && d.texteMessage) || '');
      let champMsg = null, avantMsg = 0;
      if (h && tMsg.trim()) { const l = [...dl.el.querySelectorAll('textarea, [contenteditable="true"]')].filter((x) => visible(x) && !x.disabled && !x.readOnly && x !== inp.el); if (l.length === 1) champMsg = l[0]; }
      if (champMsg) { avantMsg = occurrences(tMsg); const tm = await taperHumain(champMsg, tMsg, Number(d && d.frappeMs) || 0); if (tm.captcha) return vuCaptcha(); if (!tm.ok) champMsg = null; }
      let s = ouAppris('offre-valider', parNom(RE_VALIDER_OFFRE, dl.el, /submit|confirm|send|offer/i, /cancel|close|annul/i, true));
      if (!s.el && !s.ambigu && T()) { const r = T().trouver('offreValider', {}); noterTrouve('offreValider', r); s = { el: r.el || null, ambigu: !!r.ambigu }; }
      if (s.ambigu) return manque('offre-valider-ambigu'); if (!s.el) return manque('offre-valider');
      if (captcha()) return vuCaptcha();
      ecouter();
      if (h) { try { s.el.scrollIntoView({ block: 'center' }); } catch (_) {} const ms = tirerUnique('hesite', 250, 900); noterDelai('hesite:proposer', ms); await attenteFrappe(ms); if (captcha()) return vuCaptcha(); }
      const att = reponseDe('POST', dejaOuverte ? new RegExp(`(?:/api/v2/transactions/${tx}/offers|/offers)$`) : new RegExp(`/api/v2/transactions/${tx}/offers$`), 30000, d && d.cle);
      clic(s.el);
      const r = await att;
      if (!r) return { ok: false, code: 'sans-reponse', parti: true };
      if (r.captcha) return Object.assign(vuCaptcha(), { parti: true });
      if (!r.ok) return { ok: true, rep: r, vu: false };
      const v = await attendre(() => (occurrencesPrix(prix) > avant ? true : null), 12000);
      // Le message tapé dans la fenêtre n'est « parti » que VU dans le fil ; sinon le fond le tape dans la conversation.
      const msgVu = champMsg ? (await attendre(() => (occurrences(tMsg) > avantMsg ? true : null), 6000)).el === true : false;
      return { ok: true, rep: r, vu: v.el === true, ...(dejaOuverte ? { fenetreFavori: true } : {}), ...(msgVu ? { messageDansOffre: true } : {}), ...(champMsg && !msgVu ? { messageIncertain: true } : {}) };
    },
    async repondreOffre(d) {
      const conv = String((d && d.conv) || ''), tx = String((d && d.tx) || ''), oid = String((d && d.oid) || ''), accepter = !!(d && d.accepter);
      if (!/^[1-9]\d{0,19}$/.test(conv) || !/^[1-9]\d{0,19}$/.test(tx) || !/^[1-9]\d{0,19}$/.test(oid)) return { ok: false, code: 'etape' };
      if (!(await attendreConv(conv, d, 8000))) return { ok: false, code: 'identite', chemin: location.pathname };
      const re = accepter ? RE_ACCEPTER : RE_REFUSER, nom = accepter ? 'offre-accepter' : 'offre-refuser';
      const b = await attendreN(nom, () => { const x = parNom(re, document, accepter ? /accept/i : /decline|reject/i, accepter ? /decline|reject|cancel/i : /accept|cancel/i); return x.el || (x.ambigu ? 'AMBIGU' : null); }, 20000);
      if (b.captcha) return vuCaptcha(); if (b.absent) return manque(nom); if (b.el === 'AMBIGU') return manque(nom + '-ambigu');
      ecouter();
      const att = reponseDe('PUT', new RegExp(`/api/v2/transactions/${tx}/offer_requests/\\d+/${accepter ? 'accept' : 'reject'}$`), 30000, d && d.cle);
      clic(b.el);
      // Une confirmation de Vinted, s'il en montre une : le même verbe (jamais « Annuler »).
      const c = await attendre(() => { const dl = dialogue(); if (!dl) return null; const x = parNom(re, dl, accepter ? /accept|confirm/i : /decline|reject|confirm/i, /cancel|close|annul/i, true); return x.el || null; }, 3000);
      if (c.el) clic(c.el);
      const r = await att;
      if (!r) return { ok: false, code: 'sans-reponse', parti: true };
      if (r.captcha) return Object.assign(vuCaptcha(), { parti: true });
      const autre = !new RegExp(`/offer_requests/${oid}/`).test(String(r.chemin || ''));
      if (!r.ok) return { ok: true, rep: r, vu: false, autre };
      const v = await attendre(() => (parNom(re, document, null, null).el ? null : true), 10000);
      return { ok: true, rep: r, vu: v.el === true, autre };
    },
    async masquer(d) {
      const id = String((d && d.id) || ''), voulu = !!(d && d.voulu);
      if (!/^\d{4,15}$/.test(id)) return { ok: false, code: 'etape' };
      if (!new RegExp(`^/items/${id}(?:-[^/]*)?/?$`).test(location.pathname)) return { ok: false, code: 'identite', chemin: location.pathname };
      const re = voulu ? RE_MASQUER : RE_AFFICHER, nom = voulu ? 'masquer' : 'afficher';
      const b = await attendreN(nom, () => { const x = parNom(re, document, voulu ? /(^|[-_])hide([-_]|$)/i : /(^|[-_])(show|unhide)([-_]|$)/i, voulu ? /unhide|show/i : /(^|[-_])hide([-_]|$)/i); return x.el || (x.ambigu ? 'AMBIGU' : null); }, 20000);
      if (b.captcha) return vuCaptcha(); if (b.absent) return manque(nom); if (b.el === 'AMBIGU') return manque(nom + '-ambigu');
      ecouter();
      const att = reponseDe('PUT', new RegExp(`/api/v2/items/${id}/is_hidden$`), 30000, d && d.cle);
      clic(b.el);
      const c = await attendre(() => { const dl = dialogue(); if (!dl) return null; const x = parNom(re, dl, /hide|show|confirm/i, /cancel|close|annul/i, true); return x.el || null; }, 3000);
      if (c.el) clic(c.el);
      const r = await att;
      if (!r) return { ok: false, code: 'sans-reponse', parti: true };
      if (r.captcha) return Object.assign(vuCaptcha(), { parti: true });
      if (!r.ok) return { ok: true, rep: r, vu: false };
      const v = await attendre(() => (parNom(voulu ? RE_AFFICHER : RE_MASQUER, document, null, null).el ? true : null), 10000);
      return { ok: true, rep: r, vu: v.el === true };
    },
    // 5.420 (`vacancesinterface`) : LE MODE VACANCES du compte de l'onglet, par la page des réglages de Vinted. Un SEUL
    // interrupteur au nom « Mode vacances » (5 langues ; case, `role="switch"` ou bouton à `aria-pressed`) — absent ou en
    // double ⇒ arrêt nommé, rien n'est touché. Déjà dans l'état voulu ⇒ rien n'est cliqué (`deja`). Sinon : clic, la
    // confirmation de Vinted si elle s'ouvre (jamais « Annuler »), la RÉPONSE que la page reçoit (écriture du profil),
    // puis l'état RELU à l'écran (l'interrupteur montre l'état voulu) — sinon `vu: false` (jamais rejoué).
    async vacances(d) {
      const voulu = !!(d && d.voulu), page = String((d && d.page) || '');
      if (!/^\/settings(?:\/[a-z_-]{1,40}){0,2}\/?$/.test(page)) return { ok: false, code: 'etape' };
      if (location.pathname.replace(/\/$/, '') !== page.replace(/\/$/, '')) return { ok: false, code: 'identite', chemin: location.pathname };
      const etatDe = (el) => { if (!el) return null; if (el instanceof HTMLInputElement && el.type === 'checkbox') return !!el.checked; const a = el.getAttribute('aria-checked') || el.getAttribute('aria-pressed'); return a === 'true' ? true : a === 'false' ? false : null; };
      const nomInterrupteur = (el) => { let n = nomAcc(el); if (!n && el.id) { const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`); if (l) n = l.textContent || ''; } if (!n) { const l = el.closest('label'); if (l) n = l.textContent || ''; } return norm(n); };
      const trouver = () => {
        const c = [...document.querySelectorAll('input[type="checkbox"], [role="switch"], button[aria-pressed], [role="checkbox"]')]
          .filter((el) => (visible(el) || (el instanceof HTMLInputElement && el.closest('label') && visible(el.closest('label')))) && !el.closest('[role="dialog"],[aria-modal="true"]') && !(el.disabled || el.getAttribute('aria-disabled') === 'true'))
          .filter((el) => RE_VACANCES.test(nomInterrupteur(el)) || /(^|[-_])(holiday|vacation)([-_]|$)/i.test(el.getAttribute('data-testid') || '') || /(^|[-_])(holiday|vacation)([-_]|$)/i.test(el.getAttribute('name') || el.id || ''));
        const fin = c.filter((el) => !c.some((x) => x !== el && el.contains(x)));
        return fin.length === 1 ? { el: fin[0] } : { el: null, ambigu: fin.length > 1 };
      };
      const t = await attendreN('vacances-interrupteur', () => { const x = trouver(); return x.el || (x.ambigu ? 'AMBIGU' : null); }, 20000);
      if (t.captcha) return vuCaptcha(); if (t.absent) return manque('vacances-interrupteur'); if (t.el === 'AMBIGU') return manque('vacances-interrupteur-ambigu');
      const avant = etatDe(t.el);
      if (avant === null) return manque('vacances-etat');
      if (avant === voulu) return { ok: true, deja: true, vu: true, etat: avant };
      if (captcha()) return vuCaptcha();
      ecouter();
      const att = new Promise((ok) => {
        const liste = globalThis.__vrmFormAttentes = globalThis.__vrmFormAttentes || [];
        let fini = false;
        const fin = (x) => { if (fini) return; fini = true; const i = liste.indexOf(f); if (i >= 0) liste.splice(i, 1); clearTimeout(tm); try { if (d && d.cle && x) sessionStorage.setItem('vrm_form_' + d.cle, JSON.stringify(x)); } catch (_) {} ok(x); };
        const f = (e) => { if (e && ['PUT', 'POST', 'PATCH'].includes(e.methode) && /^\/api\/v2\/users\/(current|\d{1,15})(\/[a-z_]{1,40}){0,3}\/?$/.test(e.chemin)) fin({ status: e.status, ok: e.status >= 200 && e.status < 300, json: e.json, corps: e.corps, texte: e.texte || '', dd: !!e.dd, ra: String(e.ra || '').slice(0, 40), chemin: e.chemin }); };
        liste.push(f);
        const tm = setTimeout(() => fin(null), 30000);
      });
      clic(t.el);
      const c = await attendre(() => { const dl = dialogue(); if (!dl) return null; const x = parNom(RE_CONFIRMER_VACANCES, dl, /confirm|submit|primary/i, /cancel|close|annul|dismiss/i, true); return x.el || null; }, 3000);
      if (c.el) clic(c.el);
      const r = await att;
      if (!r) return { ok: false, code: 'sans-reponse', parti: true };
      if (!r.ok) return { ok: true, rep: r, vu: false };
      const v = await attendre(() => { const x = trouver(); return x.el && etatDe(x.el) === voulu ? true : null; }, 10000);
      return { ok: true, rep: r, vu: v.el === true, etat: v.el === true ? voulu : etatDe(trouver().el) };
    },
    async prix(d) {
      const id = String((d && d.id) || ''), prix = Number(d && d.prix);
      if (!/^\d{4,15}$/.test(id) || !(prix > 0)) return { ok: false, code: 'etape' };
      if (!new RegExp(`^/items/${id}/edit/?$`).test(location.pathname)) return { ok: false, code: 'identite', chemin: location.pathname };
      const a = await attendreN('prix', SEL.prix, 30000); if (a.captcha) return vuCaptcha(); if (a.absent) return manque('prix');
      const b0 = await attendreN('enregistrer', SEL.ajouter, 15000); if (b0.captcha) return vuCaptcha(); if (b0.absent) return manque('enregistrer');
      if (d && typeof d.titre === 'string' && d.titre.trim()) {
        const t = await attendreN('titre', SEL.titre); if (t.captcha) return vuCaptcha(); if (t.absent) return manque('titre');
        if (!(await saisir(t.el, d.titre))) return { ok: false, code: 'valeur', manque: 'titre' };
      }
      if (!(await saisir(a.el, texteMontant(prix)))) return { ok: false, code: 'valeur', manque: 'prix' };
      if (captcha()) return vuCaptcha();
      const b = await attendreN('enregistrer', SEL.ajouter, 15000); if (b.captcha) return vuCaptcha(); if (b.absent) return manque('enregistrer');
      ecouter();
      // 5.423 (`modifavantapres`) : la preuve « nouveau prix tapé » — le champ montre EXACTEMENT le nouveau prix avant « Enregistrer ».
      const tape = Math.round(Number(String(a.el.value || '').replace(/[\s€]/g, '').replace(',', '.')) * 100) === Math.round(prix * 100);
      const att = reponseDe('PUT', new RegExp(`/api/v2/item_upload/items/${id}$`), 60000, d && d.cle);
      clic(b.el);
      const r = await att;
      if (!r) return { ok: false, code: 'sans-reponse', parti: true, tape };
      if (r.captcha) return Object.assign(vuCaptcha(), { parti: true, tape });
      return { ok: true, rep: r, tape };
    },
    // 5.414 : LA GRILLE DES TAILLES d'une catégorie, LUE par la page « Vendre » (aucune écriture) : la catégorie choisie
    // dans le formulaire (son identifiant, sinon son libellé exact), et la réponse que la PAGE reçoit pour elle.
    async grille(d) {
      const id = String((d && d.id) || '');
      if (!/^[1-9]\d{0,9}$/.test(id)) return { ok: false, code: 'etape' };
      ecouter();
      const vus = (globalThis.__vrmFormVues || []).slice().reverse().find((e) => e.methode === 'POST' && /\/api\/v2\/item_upload\/attributes\/?$/.test(e.chemin) && e.status >= 200 && e.status < 300 && /"category"/.test(e.corps || '') && new RegExp(`\\[\\s*${id}\\s*\\]`).test(e.corps || ''));
      if (vus) return { ok: true, rep: { status: vus.status, ok: true, json: vus.json, corps: vus.corps, chemin: vus.chemin } };
      const att = reponseDe('POST', /\/api\/v2\/item_upload\/attributes\/?$/, 20000, d && d.cle);
      const c = await ETAPES.champ({ quoi: 'categorie', id, nom: d.nom, recherche: d.recherche || d.nom });
      if (!c.ok) return c;
      const r = await att;
      if (!r) return { ok: false, code: 'sans-reponse' };
      if (r.captcha) return vuCaptcha();
      return { ok: true, rep: r };
    },
    // 5.414 : LE BORDEREAU d'une vente, par la conversation de CETTE vente : son bouton (nom exact, un seul), puis, si
    // Vinted ouvre une fenêtre, SA confirmation — jamais un choix fait à sa place : une fenêtre qui demande de choisir
    // (plusieurs options, aucune cochée, ou un dépôt appris qui n'y est pas) ⇒ arrêt AVANT de confirmer, nommé.
    async bordereau(d) {
      const conv = String((d && d.conv) || ''), tx = String((d && d.tx) || ''), depot = d && d.depot ? String(d.depot) : '';
      if (!/^[1-9]\d{0,19}$/.test(conv) || !/^[1-9]\d{0,19}$/.test(tx)) return { ok: false, code: 'etape' };
      if (!(await attendreConv(conv, d, 8000))) return { ok: false, code: 'identite', chemin: location.pathname };
      const b = await attendreN('bordereau-bouton', () => { const x = parNom(RE_BORDEREAU, document, /(shipping[-_]?label|label[-_]?(button|cta)|get[-_]?label)/i, /cancel|close|download|track/i); return x.el || (x.ambigu ? 'AMBIGU' : null); }, 20000);
      if (b.captcha) return vuCaptcha(); if (b.absent) return manque('bordereau-bouton'); if (b.el === 'AMBIGU') return manque('bordereau-bouton-ambigu');
      ecouter();
      const att = reponseDe('PUT', new RegExp(`/api/v2/transactions/${tx}/shipment/order$`), 30000, d && d.cle);
      let parti = false; att.then(() => { parti = true; });
      clic(b.el);
      const dl = await attendre(() => (parti ? 'PARTI' : dialogue()), 6000);
      if (dl.el && dl.el !== 'PARTI') {
        const choix = [...dl.el.querySelectorAll('input[type="radio"], [role="radio"]')].filter(visible);
        const coche = (x) => x.checked === true || x.getAttribute('aria-checked') === 'true';
        if (depot) {
          const o = choix.filter((x) => new RegExp(`(^|[-_])${depot.replace(/[^\w-]/g, '')}($|[-_])`, 'i').test(`${x.value || ''} ${x.id || ''} ${x.getAttribute('data-testid') || ''}`));
          if (o.length !== 1) return manque('bordereau-depot');
          if (!coche(o[0])) { clic(o[0]); await nap(300); }
        } else if (choix.length > 1 && choix.filter(coche).length !== 1) return manque('bordereau-choix');
        const c = ouAppris('bordereau-confirmer', parNom(RE_CONFIRMER_BORDEREAU, dl.el, /confirm|submit|continue/i, /cancel|close|annul/i, true));
        if (c.ambigu) return manque('bordereau-confirmer-ambigu'); if (!c.el) return manque('bordereau-confirmer');
        if (captcha()) return vuCaptcha();
        clic(c.el);
      }
      const r = await att;
      if (!r) return { ok: false, code: 'sans-reponse', parti: true };
      if (r.captcha) return Object.assign(vuCaptcha(), { parti: true });
      return { ok: true, rep: r };
    },
    // 5.414 : L'ÉVALUATION 5 étoiles d'une vente, dans SA conversation : « Laisser une évaluation », la 5ᵉ étoile, le
    // texte tapé, « Envoyer » ; la requête attendue est celle qu'il a faite lui-même une fois (méthode + chemin appris).
    async evaluation(d) {
      const conv = String((d && d.conv) || ''), texte = String((d && d.texte) || ''), meth = String((d && d.methode) || 'POST').toUpperCase(), ch = String((d && d.chemin) || '');
      if (!/^[1-9]\d{0,19}$/.test(conv) || !texte.trim() || !/^\/api\/v2\/[\w/-]+$/.test(ch) || !['POST', 'PUT'].includes(meth)) return { ok: false, code: 'etape' };
      if (!(await attendreConv(conv, d, 8000))) return { ok: false, code: 'identite', chemin: location.pathname };
      const b = await attendreN('evaluation-bouton', () => { const x = parNom(RE_EVALUER, document, /(leave[-_]?)?feedback[-_]?(button|cta)|review[-_]?button/i, /cancel|close/i); return x.el || (x.ambigu ? 'AMBIGU' : null); }, 20000);
      if (b.captcha) return vuCaptcha(); if (b.absent) return manque('evaluation-bouton'); if (b.el === 'AMBIGU') return manque('evaluation-bouton-ambigu');
      clic(b.el);
      const zone = await attendreN('evaluation-fenetre', () => dialogue() || document.querySelector('[data-testid*="feedback" i] textarea, form textarea') && document, 15000);
      if (zone.captcha) return vuCaptcha(); if (zone.absent) return manque('evaluation-fenetre');
      const ici = zone.el === document ? document : zone.el;
      const e5 = [...ici.querySelectorAll('button, [role="radio"], input[type="radio"], label')].filter((x) => visible(x) && (/(^|[-_])(star|rating)[-_]?5$/i.test(x.getAttribute('data-testid') || '') || /^(5 etoiles|5 sur 5|5 stars|5 out of 5|5 stelle|5 estrellas|5 sterne)$/.test(norm(nomAcc(x))) || (x.value === '5' && x.type === 'radio')));
      if (e5.length !== 1) return manque(e5.length ? 'evaluation-etoile-ambigue' : 'evaluation-etoile');
      clic(e5[0]); await nap(300);
      const tas = [...ici.querySelectorAll('textarea')].filter((x) => visible(x) && !x.disabled && !x.readOnly);
      if (tas.length !== 1) return manque(tas.length ? 'evaluation-texte-ambigu' : 'evaluation-texte');
      if (!(await saisir(tas[0], texte, { garderFocus: true }))) return { ok: false, code: 'valeur', manque: 'evaluation-texte' };
      const s = ouAppris('evaluation-envoyer', parNom(RE_ENVOYER_EVAL, ici, /submit|send|confirm/i, /cancel|close|annul/i, true));
      if (s.ambigu) return manque('evaluation-envoyer-ambigu'); if (!s.el) return manque('evaluation-envoyer');
      if (captcha()) return vuCaptcha();
      ecouter();
      const att = reponseDe(meth, new RegExp(`^${ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), 30000, d && d.cle);
      clic(s.el);
      const r = await att;
      if (!r) return { ok: false, code: 'sans-reponse', parti: true };
      if (r.captcha) return Object.assign(vuCaptcha(), { parti: true });
      return { ok: true, rep: r };
    },
    // La réponse rangée par une étape dont la page a navigué juste après.
    async reponse(d) {
      let x = null; try { x = JSON.parse(sessionStorage.getItem('vrm_form_' + String(d && d.cle)) || 'null'); } catch (_) { x = null; }
      return x ? { ok: true, rep: x } : { ok: false, code: 'sans-reponse' };
    },
  };
  globalThis.__vrmFormulaireV = 7.5;   // 5.453.2 : 7.5 (frappe par la commande d'édition, fenêtre d'offre du favori, « pas parti » certain)   // 5.453 : 7.4 (gestes d'un favori comme une personne : regarder, hésiter, taper, puis « Envoyer »)   // 5.440.2 : 7.3 (ligne du favori par ses deux identités, page complète lue jusqu'au bout)   // 5.440.1 : 7.2 (conversation ouverte relue de l'adresse à chaque tour) ; 7.1 (ligne du favori par `user_id`)   // 5.440 : 7 (couche de repérage, nouvelle messagerie)   // 5.438 : 6 (cloche robuste, `favoriListe`)   // 5.437 : 5 (rythme de frappe, description collée ou tapée par rafales)   // 5.433 : 4 (éléments appris)   // 5.414 : la version des étapes (une page qui porte l’ancienne la remplace) ; 5.420 : 3 (`vacances`)
  globalThis.__vrmFormulaireSel = SEL;
  globalThis.__vrmFormulaire = async (etape, d) => {
    if (!/(^|\.)vinted\.(fr|com|it|de|es|be|nl|lu|at|pt|pl|cz|lt|co\.uk)$/i.test(location.hostname)) return { ok: false, code: 'hors-vinted' };
    const f = ETAPES[etape];
    if (!f) return { ok: false, code: 'etape' };
    // 5.433 : les éléments appris pour CETTE étape (signatures seulement), posés par le fond à chaque appel.
    APPRIS = {}; try { const ap = d && d.appris && typeof d.appris === 'object' ? d.appris : {}; for (const k of Object.keys(ap).slice(0, 40)) if (/^[a-z-]{2,40}$/.test(k) && ap[k] && ap[k].sig) APPRIS[k] = { sig: ap[k].sig, confirme: ap[k].confirme === true }; } catch (_) { APPRIS = {}; }
    // 5.440 : la mémoire de la couche de repérage (stratégie qui a marché, par élément et version de la page) passée par le fond.
    MEMOIRE = {}; try { const m = d && d.memoire && typeof d.memoire === 'object' ? d.memoire : {}; for (const k of Object.keys(m).slice(0, 20)) if (/^[a-zA-Z]{2,30}$/.test(k) && /^[a-z]{2,20}$/.test(String(m[k] || ''))) MEMOIRE[k] = String(m[k]); } catch (_) {}
    TROUVES.length = 0;
    const avecTrouves = (o) => { try { if (o && typeof o === 'object' && TROUVES.length) { o.trouves = TROUVES.slice(); o.verPage = T() ? T().versionPage() : ''; } } catch (_) {} return o; };
    try { return avecTrouves(await f(d || {})); } catch (e) { if (e && e.vrmCaptcha) return vuCaptcha(); if (e && e.vrmAConfirmer) return { ok: false, code: 'appris-a-confirmer', manque: String(e.vrmAConfirmer), chemin: location.pathname }; return { ok: false, code: 'erreur', raison: String((e && e.message) || e).slice(0, 120) }; }
  };
})();
