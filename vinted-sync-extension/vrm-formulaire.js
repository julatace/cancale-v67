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
  if (globalThis.__vrmFormulaire && globalThis.__vrmFormulaireV === 1) return;
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
  const captcha = () => { try { return !!document.querySelector(CAPTCHA); } catch (_) { return false; } };
  const visible = (el) => { try { return !!(el && el.isConnected && (el.offsetParent !== null || el.getClientRects().length)); } catch (_) { return !!el; } };
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
  async function saisir(el, texte) {
    const poser = setterDe(el);
    try { el.focus(); } catch (_) {}
    poser(''); el.dispatchEvent(new Event('input', { bubbles: true }));
    let v = '';
    for (const ch of Array.from(String(texte))) {
      v += ch; poser(v);
      el.dispatchEvent(new InputEvent('input', { bubbles: true, data: ch, inputType: ch === '\n' ? 'insertLineBreak' : 'insertText' }));
      await ceder();
    }
    el.dispatchEvent(new Event('change', { bubbles: true }));
    try { el.blur(); } catch (_) {}
    el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    return el.value === String(texte);
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
      const p = f0.apply(this, arguments);
      p.then((r) => { try { r.clone().text().then((t) => { let j = null; try { j = t ? JSON.parse(t) : null; } catch (_) {} noter({ methode, chemin: chemin(url), status: r.status, json: j, corps, texte: j == null ? String(t || '').slice(0, 2000) : '', dd: !!(r.headers && r.headers.get && r.headers.get('x-datadome')) }); }, () => {}); } catch (_) {} }, () => noter({ methode, chemin: chemin(url), status: 0, json: null, corps }));
      return p;
    };
    const X = globalThis.XMLHttpRequest && globalThis.XMLHttpRequest.prototype;
    if (X) {
      const o0 = X.open, s0 = X.send;
      X.open = function (m, u) { this.__vrmM = String(m || 'GET').toUpperCase(); this.__vrmU = u; return o0.apply(this, arguments); };
      X.send = function (b) {
        const x = this; const corps = typeof b === 'string' ? b : null;
        try { x.addEventListener('loadend', () => { let j = null; try { j = x.responseType === 'json' ? x.response : (x.responseText ? JSON.parse(x.responseText) : null); } catch (_) {} let t = ''; try { t = j == null ? String(x.responseText || '').slice(0, 2000) : ''; } catch (_) {} noter({ methode: x.__vrmM, chemin: chemin(x.__vrmU), status: x.status, json: j, corps, texte: t }); }); } catch (_) {}
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
      const f = (e) => { if (e && e.methode === methode && re.test(e.chemin)) fin({ status: e.status, ok: e.status >= 200 && e.status < 300, json: e.json, corps: e.corps, texte: e.texte || '', dd: !!e.dd }); };
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
  const clic = (el) => { try { el.scrollIntoView({ block: 'center' }); } catch (_) {} el.click(); };

  const ETAPES = {
    async etat() { return { ok: true, chemin: location.pathname, captcha: captcha(), formulaire: !!document.querySelector(SEL.titre) }; },
    async ouvrirVente() {
      const a = await attendre(SEL.vendre); if (a.captcha) return vuCaptcha(); if (a.absent) return manque('vendre');
      clic(a.el);
      const f = await attendre(SEL.titre, 30000); if (f.captcha) return vuCaptcha(); if (f.absent) return manque('titre');
      return { ok: true, chemin: location.pathname };
    },
    async formulairePret() {
      const f = await attendre(SEL.titre, 30000); if (f.captcha) return vuCaptcha(); if (f.absent) return manque('titre');
      return { ok: true, chemin: location.pathname };
    },
    async photos(d) {
      const a = await attendre(SEL.photos); if (a.captcha) return vuCaptcha(); if (a.absent) return manque('photos');
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
        if (rep.length >= liste.length) return { ok: true, n: rep.length };
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
        const ok = await saisir(a.el, v);
        return ok ? { ok: true } : { ok: false, code: 'valeur', manque: q };
      }
      if (q === 'categorie') {
        const a = await attendre(SEL.categorie); if (a.captcha) return vuCaptcha(); if (a.absent) return manque('categorie');
        clic(a.el);
        const s = await attendre(SEL.categorieRecherche); if (s.captcha) return vuCaptcha(); if (s.absent) return manque('categorie-recherche');
        await saisir(s.el, String(d.recherche || d.nom || ''));
        const o = await attendre(() => { const l = document.querySelector(SEL.categorieListe) || document; return option(l, d.id, d.nom); }, 15000);
        if (o.captcha) return vuCaptcha(); if (o.absent) return manque('categorie-option');
        clic(o.el);
        return { ok: true };
      }
      if (q === 'marque') {
        const a = await attendre(SEL.marque); if (a.captcha) return vuCaptcha(); if (a.absent) return manque('marque');
        if (norm(a.el.value) && norm(a.el.value) === norm(d.nom)) return { ok: true, deja: true };
        clic(a.el);
        const s = await attendre(SEL.marqueRecherche); if (s.captcha) return vuCaptcha(); if (s.absent) return manque('marque-recherche');
        await saisir(s.el, String(d.nom || ''));
        const o = await attendre(() => option(document, d.id, d.nom), 15000); if (o.captcha) return vuCaptcha(); if (o.absent) return manque('marque-option');
        clic(o.el);
        return { ok: true };
      }
      if (q === 'taille') {
        const a = await attendre(SEL.taille); if (a.captcha) return vuCaptcha(); if (a.absent) return manque('taille');
        clic(a.el);
        const o = await attendre(() => [...document.querySelectorAll(`[data-testid$="-grid-option-${String(d.id)}"]`)].find(visible) || null);
        if (o.captcha) return vuCaptcha(); if (o.absent) return manque('taille-option');
        clic(o.el);
        return { ok: true };
      }
      if (q === 'couleurs') {
        const a = await attendre(SEL.couleur); if (a.captcha) return vuCaptcha(); if (a.absent) return manque('couleur');
        clic(a.el);
        for (const id of (Array.isArray(d.ids) ? d.ids : []).slice(0, 2)) {
          const o = await attendre(`[data-testid="filter-grid-option-${String(id)}"]`); if (o.captcha) return vuCaptcha(); if (o.absent) return manque('couleur-option');
          if (o.el.getAttribute('aria-checked') === 'true' || o.el.getAttribute('aria-selected') === 'true') continue;
          clic(o.el); await nap(400);
        }
        return { ok: true };
      }
      if (q === 'colis') {
        const a = await attendre(`#package_type_selector_${String(d.id)}`); if (a.captcha) return vuCaptcha(); if (a.absent) return manque('colis');
        clic(a.el);
        return { ok: true };
      }
      if (q === 'etat') {
        const a = await attendre(SEL.etat); if (a.captcha) return vuCaptcha(); if (a.absent) return manque('etat');
        clic(a.el);
        const o = await attendre(`#condition-${String(d.id)}, [data-testid="condition-${String(d.id)}"]`); if (o.captcha) return vuCaptcha(); if (o.absent) return manque('etat-option');
        clic(o.el);
        return { ok: true };
      }
      return { ok: false, code: 'etape' };
    },
    // Les trois gestes qui écrivent chez Vinted : la page envoie, VRM lit la réponse.
    async brouillon(d) {
      const b = await attendre(SEL.brouillon); if (b.captcha) return vuCaptcha(); if (b.absent) return manque('brouillon');
      ecouter();
      const att = reponseDe('POST', /\/api\/v2\/item_upload\/drafts\/?$/, 60000, d && d.cle);
      clic(b.el);
      const r = await att;
      return r ? (r.captcha ? vuCaptcha() : { ok: true, rep: r }) : { ok: false, code: 'sans-reponse' };
    },
    async supprimer(d) {
      const b = await attendre(SEL.supprimer, 20000); if (b.captcha) return vuCaptcha(); if (b.absent) return manque('supprimer');
      ecouter();
      const att = reponseDe('POST', new RegExp(`/api/v2/items/${String(d && d.id)}/delete$`), 60000, d && d.cle);
      clic(b.el);
      // La confirmation de Vinted : un bouton de la fenêtre qui s'ouvre (jamais « Annuler »).
      const c = await attendre(() => {
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
      return r ? (r.captcha ? vuCaptcha() : { ok: true, rep: r }) : { ok: false, code: 'sans-reponse' };
    },
    async publier(d) {
      const b = await attendre(SEL.ajouter, 30000); if (b.captcha) return vuCaptcha(); if (b.absent) return manque('ajouter');
      ecouter();
      const att = reponseDe('POST', new RegExp(`/api/v2/item_upload/drafts/${String(d && d.draftId)}/completion$`), 60000, d && d.cle);
      clic(b.el);
      const r = await att;
      return r ? (r.captcha ? vuCaptcha() : { ok: true, rep: r }) : { ok: false, code: 'sans-reponse' };
    },
    // La réponse rangée par une étape dont la page a navigué juste après.
    async reponse(d) {
      let x = null; try { x = JSON.parse(sessionStorage.getItem('vrm_form_' + String(d && d.cle)) || 'null'); } catch (_) { x = null; }
      return x ? { ok: true, rep: x } : { ok: false, code: 'sans-reponse' };
    },
  };
  globalThis.__vrmFormulaireV = 1;
  globalThis.__vrmFormulaireSel = SEL;
  globalThis.__vrmFormulaire = async (etape, d) => {
    if (!/(^|\.)vinted\.(fr|com|it|de|es|be|nl|lu|at|pt|pl|cz|lt|co\.uk)$/i.test(location.hostname)) return { ok: false, code: 'hors-vinted' };
    const f = ETAPES[etape];
    if (!f) return { ok: false, code: 'etape' };
    try { return await f(d || {}); } catch (e) { return { ok: false, code: 'erreur', raison: String((e && e.message) || e).slice(0, 120) }; }
  };
})();
