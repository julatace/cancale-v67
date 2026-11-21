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
  if (globalThis.__vrmFormulaire && globalThis.__vrmFormulaireV === 3) return;
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
    for (const ch of Array.from(String(texte))) {
      v += ch; poser(v);
      el.dispatchEvent(new InputEvent('input', { bubbles: true, data: ch, inputType: ch === '\n' ? 'insertLineBreak' : 'insertText' }));
      await ceder();
    }
    el.dispatchEvent(new Event('change', { bubbles: true }));
    if (!(opts && opts.garderFocus)) { try { el.blur(); } catch (_) {} el.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); }
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
      p.then((r) => { try { r.clone().text().then((t) => { let j = null; try { j = t ? JSON.parse(t) : null; } catch (_) {} noter({ methode, chemin: chemin(url), status: r.status, json: j, corps, texte: j == null ? String(t || '').slice(0, 2000) : '', dd: !!(r.headers && r.headers.get && r.headers.get('x-datadome')), ra: (r.headers && r.headers.get && r.headers.get('retry-after')) || '' }); }, () => {}); } catch (_) {} }, () => noter({ methode, chemin: chemin(url), status: 0, json: null, corps }));
      return p;
    };
    const X = globalThis.XMLHttpRequest && globalThis.XMLHttpRequest.prototype;
    if (X) {
      const o0 = X.open, s0 = X.send;
      X.open = function (m, u) { this.__vrmM = String(m || 'GET').toUpperCase(); this.__vrmU = u; return o0.apply(this, arguments); };
      X.send = function (b) {
        const x = this; const corps = typeof b === 'string' ? b : null;
        try { x.addEventListener('loadend', () => { let j = null; try { j = x.responseType === 'json' ? x.response : (x.responseText ? JSON.parse(x.responseText) : null); } catch (_) {} let t = ''; try { t = j == null ? String(x.responseText || '').slice(0, 2000) : ''; } catch (_) {} let ra = ''; try { ra = x.getResponseHeader('retry-after') || ''; } catch (_) {} let dd = false; try { dd = !!x.getResponseHeader('x-datadome'); } catch (_) {} noter({ methode: x.__vrmM, chemin: chemin(x.__vrmU), status: x.status, json: j, corps, texte: t, dd, ra }); }); } catch (_) {}
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
  const clic = (el) => { try { el.scrollIntoView({ block: 'center' }); } catch (_) {} el.click(); };

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
  // La cloche : le bouton « Notifications » (nom accessible reconnu), un seul.
  function clocheVisible() {
    const re = /^(?:(?:mes|my|le mie|meine) |(?:(?:ouvrir|afficher|voir|open|show|view) (?:les |the )?))?(?:notifications?|notifiche|notificaciones|benachrichtigungen)(?:\s*[:·,–-]?\s*\(?[0-9]{1,5}\+?\)?(?: (?:non lues?|unread|non lette|sin leer|ungelesen))?)?$/;
    const l = [...document.querySelectorAll('button, [role="button"]')].filter((b) => visible(b) && actif(b) && re.test(norm(nomAcc(b))));
    return l.length === 1 ? { el: l[0] } : { el: null, ambigu: l.length > 1 };
  }
  // La ligne d'UN favori dans la cloche : son lien capté exact, ou la route native `?item_id=&receiver_id=` dont
  // les DEUX identités sont celles du favori (jamais un titre, jamais un pseudo). Un seul lien visible.
  function lienFavoriVisible(lien, itemId, receiverId) {
    const norme = (v) => { try { const u = new URL(v, location.href); if (u.origin !== location.origin) return null; u.hash = ''; u.searchParams.sort(); return u.href; } catch (_) { return null; } };
    const attendu = lien ? norme(lien) : null;
    const natif = (v) => { try { const u = new URL(v, location.href); const ks = [...u.searchParams.keys()].sort().join(','); if (ks !== 'item_id,receiver_id' || u.searchParams.getAll('item_id').length !== 1 || u.searchParams.getAll('receiver_id').length !== 1) return false; return u.origin === location.origin && u.searchParams.get('item_id') === itemId && u.searchParams.get('receiver_id') === receiverId; } catch (_) { return false; } };
    const l = [...document.querySelectorAll('a[href]')].filter((a) => visible(a) && ((attendu && norme(a.href) === attendu) || natif(a.href)));
    return l.length === 1 ? { el: l[0] } : { el: null, ambigu: l.length > 1 };
  }
  async function attendreChemin(re, ms) {
    let r = null; try { r = re instanceof RegExp ? re : new RegExp(String(re || '^/')); } catch (_) { return { ok: false }; }
    const fin = Date.now() + ms;
    for (;;) { if (captcha()) return { captcha: true }; if (r.test(location.pathname)) return { ok: true }; if (Date.now() > fin) return { ok: false }; await nap(150); }
  }
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
      // 5.414 : « Unisexe » — la case du formulaire (une seule), cochée seulement si elle ne l'est pas déjà.
      if (q === 'unisexe') {
        const a = await attendre(() => { const l = [...document.querySelectorAll('input[type="checkbox"]#is_unisex, input[type="checkbox"][name="is_unisex"], [data-testid*="unisex" i] input[type="checkbox"], input[type="checkbox"][data-testid*="unisex" i]')].filter((x) => !deVrm(x)); const u = [...new Set(l)]; return u.length === 1 ? u[0] : (u.length > 1 ? 'AMBIGU' : null); }, 10000);
        if (a.captcha) return vuCaptcha(); if (a.absent) return manque('unisexe'); if (a.el === 'AMBIGU') return manque('unisexe-ambigu');
        if (a.el.checked !== (d.valeur === true)) { clic(a.el.closest('label') || a.el); await nap(300); }
        return a.el.checked === (d.valeur === true) ? { ok: true } : { ok: false, code: 'valeur', manque: 'unisexe' };
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
      return r ? (r.captcha ? Object.assign(vuCaptcha(), { parti: true }) : { ok: true, rep: r }) : { ok: false, code: 'sans-reponse', parti: true };
    },
    async supprimer(d) {
      // 5.414 : la page montrée est celle de CETTE annonce (son identifiant dans l'adresse), sinon rien n'est touché.
      if (!new RegExp(`^/items/${String(d && d.id)}(?:-[^/]*)?/?$`).test(location.pathname)) return { ok: false, code: 'identite', chemin: location.pathname };
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
      return r ? (r.captcha ? Object.assign(vuCaptcha(), { parti: true }) : { ok: true, rep: r }) : { ok: false, code: 'sans-reponse', parti: true };
    },
    async publier(d) {
      const b = await attendre(SEL.ajouter, 30000); if (b.captcha) return vuCaptcha(); if (b.absent) return manque('ajouter');
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
      const a = await attendreChemin(d && d.chemin, 20000); if (a.captcha) return vuCaptcha(); if (!a.ok) return { ok: false, code: 'identite', chemin: location.pathname };
      return { ok: true, chemin: location.pathname };
    },
    async favoriOuvrir(d) {
      if (captcha()) return vuCaptcha();
      ecouter();
      const itemId = String((d && d.itemId) || ''), receiverId = String((d && d.receiverId) || ''), lien = String((d && d.lien) || '');
      if (!/^[1-9]\d{0,19}$/.test(itemId) || !/^[1-9]\d{0,19}$/.test(receiverId)) return { ok: false, code: 'etape' };
      // 1. La cloche : ouverte par SON bouton (un seul candidat, nom accessible reconnu), sauf si la ligne est déjà là.
      let l = lienFavoriVisible(lien, itemId, receiverId);
      if (l.ambigu) return manque('favori-notification-ambigue');
      if (!l.el) {
        const c = clocheVisible(); if (c.ambigu) return manque('cloche-ambigue'); if (!c.el) return manque('cloche');
        if (c.el.getAttribute('aria-expanded') !== 'true') clic(c.el);
        const t = await attendre(() => { const x = lienFavoriVisible(lien, itemId, receiverId); return x.el || (x.ambigu ? 'AMBIGU' : null); }, 15000);
        if (t.captcha) return vuCaptcha(); if (t.absent) return manque('favori-notification'); if (t.el === 'AMBIGU') return manque('favori-notification-ambigue');
        l = { el: t.el };
      }
      // 2. La ligne du favori (le lien porte l'article ET la personne) : un clic ; la page ouvre la conversation.
      let rep = null, repVue = false;
      reponseDe('POST', /\/api\/v2\/conversations\/?$/, 25000, d && d.cle).then((x) => { rep = x; repVue = true; });
      clic(l.el);
      const fin = Date.now() + 25000; let conv = '';
      for (;;) {
        if (captcha()) return Object.assign(vuCaptcha(), { parti: true });
        const m = /^\/inbox\/([1-9]\d{0,19})\/?$/.exec(location.pathname); if (m) conv = m[1];
        if (!conv && rep && rep.json && rep.json.conversation && /^[1-9]\d{0,19}$/.test(String(rep.json.conversation.id))) conv = String(rep.json.conversation.id);
        // La conversation montrée ; la réponse de création attendue encore 3 s (une conversation déjà là n'en a pas).
        if (conv && (repVue || Date.now() > fin - 22000)) break;
        if (Date.now() > fin) break;
        await nap(200);
      }
      if (rep && rep.captcha) return Object.assign(vuCaptcha(), { parti: true });
      // Rien vu partir (aucune requête de création, aucune conversation montrée) : la page n'a rien écrit — arrêt, rien ne part.
      if (!conv) return rep ? { ok: true, rep, conv: '', envoye: true } : manque('conversation-pas-ouverte');
      return { ok: true, rep, conv, envoye: !!rep, chemin: location.pathname };
    },
    async message(d) {
      const conv = String((d && d.conv) || ''), texte = String((d && d.texte) || '');
      if (!/^[1-9]\d{0,19}$/.test(conv) || !texte.trim()) return { ok: false, code: 'etape' };
      if (!new RegExp(`^/inbox/${conv}/?$`).test(location.pathname)) return { ok: false, code: 'identite', chemin: location.pathname };
      const z = await attendre(() => { const x = composeur(); return x.el || (x.ambigu ? 'AMBIGU' : null); }, 20000);
      if (z.captcha) return vuCaptcha(); if (z.absent) return manque('message-champ'); if (z.el === 'AMBIGU') return manque('message-champ-ambigu');
      const champ = z.el;
      { const env = boutonEnvoyer(champ); if (env.ambigu) return manque('message-envoyer-ambigu'); if (!env.el) return manque('message-envoyer'); }
      const avant = occurrences(texte);
      const okT = await saisir(champ, texte, { garderFocus: true });
      if (!okT) return { ok: false, code: 'valeur', manque: 'message-champ' };
      if (captcha()) return vuCaptcha();
      if (!new RegExp(`^/inbox/${conv}/?$`).test(location.pathname)) return { ok: false, code: 'identite', chemin: location.pathname };
      const b2 = boutonEnvoyer(champ); if (!b2.el || b2.ambigu) return manque('message-envoyer');
      ecouter();
      const att = reponseDe('POST', new RegExp(`/api/v2/conversations/${conv}/replies$`), 30000, d && d.cle);
      clic(b2.el);
      const r = await att;
      if (!r) return { ok: false, code: 'sans-reponse', parti: true };
      if (r.captcha) return Object.assign(vuCaptcha(), { parti: true });
      if (!r.ok) return { ok: true, rep: r, vu: false };
      // La preuve à l'écran : le message est apparu dans le fil (une occurrence de plus qu'avant l'envoi).
      const v = await attendre(() => (occurrences(texte) > avant ? true : null), 12000);
      return { ok: true, rep: r, vu: v.el === true };
    },
    async offre(d) {
      const conv = String((d && d.conv) || ''), tx = String((d && d.tx) || ''), prix = Number(d && d.prix);
      if (!/^[1-9]\d{0,19}$/.test(conv) || !/^[1-9]\d{0,19}$/.test(tx) || !(prix > 0)) return { ok: false, code: 'etape' };
      if (!new RegExp(`^/inbox/${conv}/?$`).test(location.pathname)) return { ok: false, code: 'identite', chemin: location.pathname };
      const b = await attendre(() => { const x = parNom(RE_FAIRE_OFFRE, document, /make[-_]?offer|offer[-_]?(button|cta)/i, /accept|decline|reject|cancel/i); return x.el || (x.ambigu ? 'AMBIGU' : null); }, 20000);
      if (b.captcha) return vuCaptcha(); if (b.absent) return manque('offre-bouton'); if (b.el === 'AMBIGU') return manque('offre-bouton-ambigu');
      const avant = occurrencesPrix(prix);
      clic(b.el);
      const dl = await attendre(() => dialogue(), 15000); if (dl.captcha) return vuCaptcha(); if (dl.absent) return manque('offre-fenetre');
      const inp = await attendre(() => { const x = champPrix(dl.el); return x.el || (x.ambigu ? 'AMBIGU' : null); }, 10000);
      if (inp.captcha) return vuCaptcha(); if (inp.absent) return manque('offre-prix'); if (inp.el === 'AMBIGU') return manque('offre-prix-ambigu');
      const okT = await saisir(inp.el, texteMontant(prix), { garderFocus: true });
      if (!okT) return { ok: false, code: 'valeur', manque: 'offre-prix' };
      const s = parNom(RE_VALIDER_OFFRE, dl.el, /submit|confirm|send|offer/i, /cancel|close|annul/i, true);
      if (s.ambigu) return manque('offre-valider-ambigu'); if (!s.el) return manque('offre-valider');
      if (captcha()) return vuCaptcha();
      ecouter();
      const att = reponseDe('POST', new RegExp(`/api/v2/transactions/${tx}/offers$`), 30000, d && d.cle);
      clic(s.el);
      const r = await att;
      if (!r) return { ok: false, code: 'sans-reponse', parti: true };
      if (r.captcha) return Object.assign(vuCaptcha(), { parti: true });
      if (!r.ok) return { ok: true, rep: r, vu: false };
      const v = await attendre(() => (occurrencesPrix(prix) > avant ? true : null), 12000);
      return { ok: true, rep: r, vu: v.el === true };
    },
    async repondreOffre(d) {
      const conv = String((d && d.conv) || ''), tx = String((d && d.tx) || ''), oid = String((d && d.oid) || ''), accepter = !!(d && d.accepter);
      if (!/^[1-9]\d{0,19}$/.test(conv) || !/^[1-9]\d{0,19}$/.test(tx) || !/^[1-9]\d{0,19}$/.test(oid)) return { ok: false, code: 'etape' };
      if (!new RegExp(`^/inbox/${conv}/?$`).test(location.pathname)) return { ok: false, code: 'identite', chemin: location.pathname };
      const re = accepter ? RE_ACCEPTER : RE_REFUSER, nom = accepter ? 'offre-accepter' : 'offre-refuser';
      const b = await attendre(() => { const x = parNom(re, document, accepter ? /accept/i : /decline|reject/i, accepter ? /decline|reject|cancel/i : /accept|cancel/i); return x.el || (x.ambigu ? 'AMBIGU' : null); }, 20000);
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
      const b = await attendre(() => { const x = parNom(re, document, voulu ? /(^|[-_])hide([-_]|$)/i : /(^|[-_])(show|unhide)([-_]|$)/i, voulu ? /unhide|show/i : /(^|[-_])hide([-_]|$)/i); return x.el || (x.ambigu ? 'AMBIGU' : null); }, 20000);
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
      const t = await attendre(() => { const x = trouver(); return x.el || (x.ambigu ? 'AMBIGU' : null); }, 20000);
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
      const a = await attendre(SEL.prix, 30000); if (a.captcha) return vuCaptcha(); if (a.absent) return manque('prix');
      const b0 = await attendre(SEL.ajouter, 15000); if (b0.captcha) return vuCaptcha(); if (b0.absent) return manque('enregistrer');
      if (d && typeof d.titre === 'string' && d.titre.trim()) {
        const t = await attendre(SEL.titre); if (t.captcha) return vuCaptcha(); if (t.absent) return manque('titre');
        if (!(await saisir(t.el, d.titre))) return { ok: false, code: 'valeur', manque: 'titre' };
      }
      if (!(await saisir(a.el, texteMontant(prix)))) return { ok: false, code: 'valeur', manque: 'prix' };
      if (captcha()) return vuCaptcha();
      const b = await attendre(SEL.ajouter, 15000); if (b.captcha) return vuCaptcha(); if (b.absent) return manque('enregistrer');
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
      if (!new RegExp(`^/inbox/${conv}/?$`).test(location.pathname)) return { ok: false, code: 'identite', chemin: location.pathname };
      const b = await attendre(() => { const x = parNom(RE_BORDEREAU, document, /(shipping[-_]?label|label[-_]?(button|cta)|get[-_]?label)/i, /cancel|close|download|track/i); return x.el || (x.ambigu ? 'AMBIGU' : null); }, 20000);
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
        const c = parNom(RE_CONFIRMER_BORDEREAU, dl.el, /confirm|submit|continue/i, /cancel|close|annul/i, true);
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
      if (!new RegExp(`^/inbox/${conv}/?$`).test(location.pathname)) return { ok: false, code: 'identite', chemin: location.pathname };
      const b = await attendre(() => { const x = parNom(RE_EVALUER, document, /(leave[-_]?)?feedback[-_]?(button|cta)|review[-_]?button/i, /cancel|close/i); return x.el || (x.ambigu ? 'AMBIGU' : null); }, 20000);
      if (b.captcha) return vuCaptcha(); if (b.absent) return manque('evaluation-bouton'); if (b.el === 'AMBIGU') return manque('evaluation-bouton-ambigu');
      clic(b.el);
      const zone = await attendre(() => dialogue() || document.querySelector('[data-testid*="feedback" i] textarea, form textarea') && document, 15000);
      if (zone.captcha) return vuCaptcha(); if (zone.absent) return manque('evaluation-fenetre');
      const ici = zone.el === document ? document : zone.el;
      const e5 = [...ici.querySelectorAll('button, [role="radio"], input[type="radio"], label')].filter((x) => visible(x) && (/(^|[-_])(star|rating)[-_]?5$/i.test(x.getAttribute('data-testid') || '') || /^(5 etoiles|5 sur 5|5 stars|5 out of 5|5 stelle|5 estrellas|5 sterne)$/.test(norm(nomAcc(x))) || (x.value === '5' && x.type === 'radio')));
      if (e5.length !== 1) return manque(e5.length ? 'evaluation-etoile-ambigue' : 'evaluation-etoile');
      clic(e5[0]); await nap(300);
      const tas = [...ici.querySelectorAll('textarea')].filter((x) => visible(x) && !x.disabled && !x.readOnly);
      if (tas.length !== 1) return manque(tas.length ? 'evaluation-texte-ambigu' : 'evaluation-texte');
      if (!(await saisir(tas[0], texte, { garderFocus: true }))) return { ok: false, code: 'valeur', manque: 'evaluation-texte' };
      const s = parNom(RE_ENVOYER_EVAL, ici, /submit|send|confirm/i, /cancel|close|annul/i, true);
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
  globalThis.__vrmFormulaireV = 3;   // 5.414 : la version des étapes (une page qui porte l’ancienne la remplace) ; 5.420 : 3 (`vacances`)
  globalThis.__vrmFormulaireSel = SEL;
  globalThis.__vrmFormulaire = async (etape, d) => {
    if (!/(^|\.)vinted\.(fr|com|it|de|es|be|nl|lu|at|pt|pl|cz|lt|co\.uk)$/i.test(location.hostname)) return { ok: false, code: 'hors-vinted' };
    const f = ETAPES[etape];
    if (!f) return { ok: false, code: 'etape' };
    try { return await f(d || {}); } catch (e) { return { ok: false, code: 'erreur', raison: String((e && e.message) || e).slice(0, 120) }; }
  };
})();
