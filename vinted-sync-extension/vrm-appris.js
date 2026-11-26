// ════════════════════════════════════════════════════════════════════════════
//  LES BOUTONS APPRIS UNE FOIS POUR TOUTES (ext. 5.433, 21 nov. — `apprisclic`, choix n° 102 de Julien)
//
//  « Quand un élément attendu est absent, au lieu d'échouer seul : l'onglet de travail passe devant, un voile
//  montre « Touche le bouton « Envoyer » de la page » ; son VRAI clic désigne l'élément ; l'extension retient un
//  sélecteur robuste […] ; elle vérifie que l'élément appris est unique et visible avant de l'utiliser. »
//
//  Injecté par le service worker dans l'onglet de travail, dans les DEUX mondes :
//   · monde de la PAGE (avec vrm-formulaire.js) : seulement `trouver(sig)` — l'élément de la signature, UNIQUE et
//     VISIBLE (deux ⇒ `ambigu`, aucun ⇒ rien) ;
//   · monde ISOLÉ (script de l'extension) : `apprendre(o)` — le bandeau, SON clic (`isTrusted: true` exigé, un clic
//     fabriqué n'apprend rien), retenu AVANT la page (la page ne fait rien de ce clic : rien ne part), la signature,
//     sa vérification (le clic doit désigner UN élément que la signature retrouve seul), et pour un geste
//     irréversible « C'est bien ce bouton ? Oui » d'abord.
//  La SIGNATURE ne garde que l'élément : balise, `data-testid` (sans suite de chiffres), rôle, type, `name`, un `id`
//  sans chiffre, le nom accessible court (le MOT du bouton : jamais de chiffre, de prix, de « € », plus de 32 lettres),
//  dans une fenêtre ou non, l'ancêtre stable le plus proche (`data-testid`) et, seulement s'il le faut, le rang
//  parmi les pareils de cet ancêtre. Jamais un titre d'annonce, un texte saisi, un prix, un identifiant.
//  Rien n'est envoyé : la signature est rendue au fond (chrome.storage.local de CE navigateur).
// ════════════════════════════════════════════════════════════════════════════
(() => {
  if (globalThis.__vrmAppris && globalThis.__vrmApprisV === 1) return;
  const TAGS = ['button', 'a', 'input', 'textarea', 'select', 'label', 'div', 'span', 'li'];
  const norm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim();
  const deVrm = (el) => { try { return !!(el && el.closest && el.closest('#vrm-travail, [data-vrm-hote], #vrm-action-gel, #vrm-appris')); } catch (_) { return false; } };
  const visible = (el) => { try { if (!el || !el.isConnected || deVrm(el)) return false; const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; const st = getComputedStyle(el); return st.display !== 'none' && st.visibility !== 'hidden' && Number(st.opacity) >= 0.1; } catch (_) { return false; } };
  const stable = (v) => typeof v === 'string' && v.length >= 2 && v.length <= 60 && !/\d{3,}/.test(v) && !/[0-9a-f]{8,}/i.test(v);
  const idStable = (v) => typeof v === 'string' && /^[a-z][a-z_-]{1,40}$/i.test(v);
  function nomCourt(el) {
    let t = '';
    try { t = el.getAttribute('aria-label') || ''; if (!t) t = String(el.innerText || el.textContent || '').trim(); if (!t) t = el.getAttribute('title') || el.getAttribute('placeholder') || ''; } catch (_) { t = ''; }
    t = norm(t);
    return t && t.length <= 32 && !/[0-9€$£]/.test(t) ? t : '';
  }
  const role = (el) => { const r = el.getAttribute && el.getAttribute('role'); return r && /^[a-z]{2,20}$/.test(r) ? r : ''; };
  const dansDialogue = (el) => { try { return !!el.closest('[role="dialog"],[aria-modal="true"]'); } catch (_) { return false; } };
  function ancreDe(el) {
    let p = el.parentElement, k = 0;
    while (p && k++ < 12) { const t = p.getAttribute && p.getAttribute('data-testid'); if (stable(t)) return t; p = p.parentElement; }
    return '';
  }
  // L'élément qu'un clic désigne : le contrôle le plus proche (bouton, lien, champ), sinon la cible.
  const controle = (t) => { try { return (t && t.closest && t.closest('button, [role="button"], a[href], input, textarea, select, [contenteditable="true"], label')) || t; } catch (_) { return t; } };
  // Les candidats d'une signature (sans le rang), dans l'ordre du document.
  function candidats(sig) {
    if (!sig || typeof sig !== 'object' || !TAGS.includes(sig.tag)) return [];
    let l = [];
    try { l = [...document.querySelectorAll(sig.tag)]; } catch (_) { return []; }
    return l.filter((el) => {
      if (!visible(el)) return false;
      if (sig.testid && el.getAttribute('data-testid') !== sig.testid) return false;
      if (sig.id && el.id !== sig.id) return false;
      if (sig.role && role(el) !== sig.role) return false;
      if (sig.type && String(el.getAttribute('type') || '') !== sig.type) return false;
      if (sig.name && String(el.getAttribute('name') || '') !== sig.name) return false;
      if (sig.texte && nomCourt(el) !== sig.texte) return false;
      if (typeof sig.dialogue === 'boolean' && dansDialogue(el) !== sig.dialogue) return false;
      if (sig.ancre && ancreDe(el) !== sig.ancre) return false;
      return true;
    });
  }
  // L'élément d'une signature : UN seul (visible), sinon rien ; deux ⇒ `ambigu`.
  function trouver(sig) {
    const l = candidats(sig);
    if (Number.isInteger(sig && sig.rang)) { const el = l[sig.rang]; return el && l.length === Number(sig.nb) ? { el } : { el: null, ambigu: l.length > 0 && l.length !== Number(sig.nb) }; }
    return l.length === 1 ? { el: l[0] } : { el: null, ambigu: l.length > 1 };
  }
  // La signature la plus courte qui retrouve CET élément seul.
  function signature(el) {
    if (!el || !el.tagName) return null;
    const tag = String(el.tagName).toLowerCase();
    if (!TAGS.includes(tag)) return null;
    const base = { tag, dialogue: dansDialogue(el) };
    const tid = el.getAttribute('data-testid'); if (stable(tid)) base.testid = tid;
    if (idStable(el.id)) base.id = el.id;
    const r = role(el); if (r) base.role = r;
    const ty = el.getAttribute('type'); if (ty && /^[a-z]{2,12}$/.test(ty)) base.type = ty;
    const nm = el.getAttribute('name'); if (stable(nm) && /^[\w-]+$/.test(nm)) base.name = nm;
    const tx = nomCourt(el); if (tx) base.texte = tx;
    if (!base.testid && !base.id && !base.texte && !base.name) return null;   // rien de stable : on ne retient rien
    const essais = [base, Object.assign({}, base, { ancre: ancreDe(el) })];
    for (const s of essais) { if (s.ancre === '') continue; const t = trouver(s); if (t.el === el) return s; }
    // Le rang parmi les pareils de l'ancêtre stable (la position relative), seulement s'il le faut.
    const s2 = Object.assign({}, base, ancreDe(el) ? { ancre: ancreDe(el) } : {});
    const l = candidats(s2);
    const i = l.indexOf(el);
    if (i < 0 || l.length > 6) return null;
    return Object.assign(s2, { rang: i, nb: l.length });
  }
  // ── Le bandeau et SON clic (monde isolé seulement : `chrome.runtime` y existe) ──────────────────────────────────
  const T = (k, d, v) => { let s = d; try { const x = globalThis.VRM_UI && typeof globalThis.VRM_UI.T === 'function' ? globalThis.VRM_UI.T(k, v) : ''; if (x && x !== k) s = x; } catch (_) {} return v ? String(s).replace(/\{(\w+)\}/g, (m, c) => (c in v ? String(v[c]) : m)) : s; };
  const SEL_VERIF = 'iframe[src*="captcha-delivery.com"], iframe[src*="datadome"], #ddChallenge, [data-dd-captcha], iframe[src*="challenges.cloudflare.com"], iframe[src*="recaptcha"], iframe[src*="hcaptcha"]';
  const verifVisible = () => { try { for (const el of document.querySelectorAll(SEL_VERIF)) { const r = el.getBoundingClientRect(); if (r.width >= 120 && r.height >= 60 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth) return true; } } catch (_) {} return false; };
  function apprendre(o) {
    const opt = o && typeof o === 'object' ? o : {};
    const ms = Math.max(5000, Math.min(180000, Number(opt.ms) || 120000));
    return new Promise((fini) => {
      if (verifVisible()) { fini({ ok: false, code: 'captcha' }); return; }
      const vieux = document.getElementById('vrm-appris'); if (vieux) vieux.remove();
      const hote = document.createElement('div'); hote.id = 'vrm-appris'; hote.setAttribute('data-vrm-hote', 'appris');
      hote.style.cssText = 'all:initial;position:fixed;left:0;right:0;top:0;z-index:2147483647;display:block;pointer-events:none;';
      const om = hote.attachShadow({ mode: 'open' });
      om.innerHTML = '<style>:host{all:initial}.b{position:relative;z-index:2;pointer-events:auto;margin:12px auto 0;max-width:560px;width:calc(100% - 24px);box-sizing:border-box;background:#16181d;color:#f4f4f5;border-radius:16px;padding:14px 16px;border:1px solid rgb(255 255 255/.14);box-shadow:0 14px 40px rgb(0 0 0/.35);font:14px/1.4 -apple-system,system-ui,sans-serif}'
        + '.b b{display:block;font-weight:650;font-size:15px;margin-bottom:4px}.b small{display:block;color:#b8bcc4;font-size:12.5px}.g{display:flex;gap:8px;justify-content:flex-end;margin-top:10px;flex-wrap:wrap}'
        + 'button{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;min-height:44px;min-width:44px;padding:0 16px;border-radius:12px;background:#2a2d34;color:#fff;font:600 14px/1 -apple-system,system-ui,sans-serif;cursor:pointer}button.p{background:#fff;color:#111}button:focus-visible{outline:2px solid #fff;outline-offset:2px}'
        + '.cadre{position:fixed;pointer-events:none;border:3px solid #3D4B5B;border-radius:10px;box-shadow:0 0 0 9999px rgb(12 16 22/.35)}</style>'
        + '<div class="b" role="dialog" aria-live="polite" data-appris-bandeau><b data-t></b><small data-n></small><div class="g" data-g></div></div><div class="cadre" data-cadre hidden></div>';
      (document.documentElement || document.body).appendChild(hote);
      const $ = (s) => om.querySelector(s);
      const libelle = String(opt.libelle || '').slice(0, 60);
      const poserBoutons = (l) => { const g = $('[data-g]'); g.textContent = ''; for (const [k, txt, plein] of l) { const b = document.createElement('button'); b.type = 'button'; b.textContent = txt; b.setAttribute('data-appris-b', k); if (plein) b.className = 'p'; g.appendChild(b); } };
      let etat = 'choisir', choisi = null, sig = null;
      const ecrire = () => {
        if (etat === 'choisir') { $('[data-t]').textContent = T('ap7_touche', 'Touche le bouton « {b} » de la page', { b: libelle }); $('[data-n]').textContent = T('ap7_touche_note', 'Vinted a changé ce bouton : montre-le une fois, VRM s’en souviendra. Ce toucher ne fait rien partir.'); poserBoutons([['annuler', T('ra_annuler', 'Annuler'), false]]); $('[data-cadre]').hidden = true; }
        else if (etat === 'confirmer') { $('[data-t]').textContent = T('ap7_cest_lui', 'C’est bien ce bouton ?'); $('[data-n]').textContent = T('ap7_cest_lui_note', 'Ce geste ne se défait pas : VRM ne s’en servira qu’après ton « Oui ».'); poserBoutons([['autre', T('ap7_autre', 'Non, un autre'), false], ['oui', T('ap7_oui', 'Oui'), true]]); }
        hote.setAttribute('data-appris-etat', etat);
      };
      const cadre = (el) => { try { const r = el.getBoundingClientRect(); const c = $('[data-cadre]'); c.hidden = false; c.style.left = (r.left - 4) + 'px'; c.style.top = (r.top - 4) + 'px'; c.style.width = (r.width + 8) + 'px'; c.style.height = (r.height + 8) + 'px'; } catch (_) {} };
      let fin = false;
      const sortir = (x) => { if (fin) return; fin = true; clearTimeout(tm); clearInterval(iv); for (const t of TYPES) window.removeEventListener(t, retenir, true); try { hote.remove(); } catch (_) {} fini(x); };
      const tm = setTimeout(() => sortir({ ok: false, code: 'delai' }), ms);
      const iv = setInterval(() => { if (verifVisible()) sortir({ ok: false, code: 'captcha' }); }, 700);
      const dansBandeau = (ev) => { try { return ev.composedPath().includes(hote); } catch (_) { return false; } };
      const TYPES = ['click', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'auxclick', 'dblclick', 'touchstart', 'touchend', 'keydown'];
      // SON geste sur la page est retenu AVANT la page (rien ne part) ; seul le clic désigne.
      function retenir(ev) {
        if (dansBandeau(ev)) return;
        if (ev.type === 'keydown') { if (ev.key === 'Escape' && ev.isTrusted) sortir({ ok: false, code: 'annule' }); return; }
        if (!ev.type.startsWith('touch')) ev.preventDefault();
        ev.stopImmediatePropagation(); ev.stopPropagation();
        if (ev.type !== 'click' || etat !== 'choisir') return;
        if (!ev.isTrusted) return;   // un clic fabriqué n'apprend rien
        const el = controle(ev.target);
        if (!el || deVrm(el)) return;
        const s = signature(el);
        if (!s) { $('[data-n]').textContent = T('ap7_pas_stable', 'Ce bouton n’a rien de stable que VRM puisse retenir : touche le bouton lui-même.'); return; }
        const t = trouver(s);
        if (t.el !== el) { $('[data-n]').textContent = T('ap7_pas_unique', 'Il y a plusieurs boutons pareils ici : VRM ne saurait pas lequel. Touche le bon bouton.'); return; }
        choisi = el; sig = s; cadre(el);
        if (opt.irreversible === true) { etat = 'confirmer'; ecrire(); return; }
        sortir({ ok: true, sig, confirme: false });
      }
      for (const t of TYPES) window.addEventListener(t, retenir, true);
      om.addEventListener('click', (ev) => {
        const b = ev.target && ev.target.closest ? ev.target.closest('[data-appris-b]') : null;
        if (!b || !ev.isTrusted) return;
        const k = b.getAttribute('data-appris-b');
        if (k === 'annuler') sortir({ ok: false, code: 'annule' });
        else if (k === 'autre') { choisi = null; sig = null; etat = 'choisir'; ecrire(); }
        else if (k === 'oui' && choisi && sig) { const t = trouver(sig); if (t.el === choisi) sortir({ ok: true, sig, confirme: true }); else { etat = 'choisir'; ecrire(); } }
      });
      ecrire();
    });
  }
  globalThis.__vrmApprisV = 1;
  globalThis.__vrmAppris = Object.freeze({ trouver, signature, apprendre, candidats });
})();
