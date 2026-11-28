// VRM Observateur Vestiaire — script isolé de vestiairecollective.com (document_start, toutes les frames).
// (regles.js est chargé juste avant, dans ce même monde isolé, invisible pour la page : il sert à masquer.)
// 1. Relaie au fond ce que note le capteur du monde MAIN (capteur-page.js).
// 2. Note les GESTES dans la page (clic, saisie, envoi de formulaire, Entrée) avec `isTrusted`
//    (faux = geste fabriqué par un programme), la cible (balise, data-testid, texte court d'un bouton).
//    Une saisie garde le NOM du champ et sa LONGUEUR ; la valeur seulement pour une zone de message,
//    de description, de titre ou de prix. Jamais un mot de passe, jamais un champ sensible.
// 3. Note les éléments ajoutés à la page qui portent la marque d'une extension (iframe, script, style, image en
//    chrome-extension://, hôte de shadow root, élément personnalisé posé à la racine).
// Ne modifie rien dans la page, n'envoie rien ailleurs qu'au fond de l'observateur.
(() => {
  'use strict';
  if (window.__vrmObsVcRelais) return;
  window.__vrmObsVcRelais = true;
  const CANAL = '__vrm_obsvc_4c2e';
  const LIBRE = (t) => { try { return self.VRMObs.masquerLibre(t); } catch (_) { return '[masqué]'; } };
  let actif = false;

  // ── File vers le fond, vidée toutes les 400 ms ────────────────────────────
  let file = [];
  let minuterie = null;
  const envoyer = () => {
    minuterie = null;
    const lot = file; file = [];
    if (!lot.length) return;
    try { chrome.runtime.sendMessage({ quoi: 'evs', evs: lot }).catch(() => {}); } catch (_) { /* extension rechargée : ce lot est perdu, dit nulle part ailleurs */ }
  };
  const noter = (ev) => {
    if (!actif) return;
    try {
      ev.t = ev.t || Date.now();
      ev.frame = window === window.top ? 'principale' : 'iframe ' + location.host;
      file.push(ev);
      if (file.length >= 200) envoyer();
      else if (!minuterie) minuterie = setTimeout(envoyer, 400);
    } catch (_) {}
  };

  // ── L'interrupteur, et le monde MAIN prévenu ──────────────────────────────
  const direEtat = () => { try { document.dispatchEvent(new CustomEvent(CANAL + '_etat', { detail: actif ? 'on' : 'off' })); } catch (_) {} };
  try {
    chrome.storage.local.get('obs_on').then((o) => { actif = o.obs_on === true; direEtat(); if (actif) premierRegard(); }).catch(() => { actif = false; direEtat(); });
    chrome.storage.onChanged.addListener((ch, zone) => {
      if (zone !== 'local' || !ch.obs_on) return;
      const avant = actif;
      actif = ch.obs_on.newValue === true;
      direEtat();
      if (actif && !avant) premierRegard();
    });
  } catch (_) {}
  document.addEventListener(CANAL + '_pret', direEtat);
  document.addEventListener(CANAL, (e) => {
    try {
      if (!actif) return;
      const ev = JSON.parse(String(e.detail || ''));
      if (ev && typeof ev === 'object') { ev.src = ev.src || 'page'; ev.duMonde = 'MAIN'; noter(ev); }
    } catch (_) {}
  });

  // ── Décrire une cible sans rien en recopier de privé ──────────────────────
  const court = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n || 60);
  const ZONE_TEXTE = /message|reply|r[ée]ponse|comment|description|desc|titre|title|prix|price|amount|montant|offer|offre/i;
  const SENSIBLE = /pass|mot.?de.?passe|token|csrf|auth(?!or)|session|e.?mail|courriel|phone|t[ée]l[ée]phone|iban|bic|card|carte|cvc|cvv|address|adresse|code.?postal|postal|zip|birth|naissance|login|username|identifiant|search|recherche/i;
  const decrire = (el) => {
    try {
      if (!el || !el.tagName) return null;
      const tag = el.tagName.toLowerCase();
      const testEl = el.closest && el.closest('[data-testid]');
      const c = { tag, id: court(el.id, 60), testid: testEl ? court(testEl.getAttribute('data-testid'), 80) : '' };
      const role = el.getAttribute && el.getAttribute('role');
      if (role) c.role = role;
      const aria = el.getAttribute && el.getAttribute('aria-label');
      if (aria) c.aria = court(aria);
      const bouton = el.closest && el.closest('button,a,[role=button],[role=menuitem],[role=tab],label,summary');
      if (bouton) {
        c.bouton = bouton.tagName.toLowerCase();
        c.texte = LIBRE(court(bouton.innerText || bouton.textContent));
        if (bouton.tagName === 'A' && bouton.getAttribute('href')) { try { c.lien = new URL(bouton.href, location.href).pathname; } catch (_) {} }
      }
      return c;
    } catch (_) { return null; }
  };
  const nomChamp = (el) => court(el.getAttribute('name') || el.id || el.getAttribute('data-testid') || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '', 80);

  // ── Gestes (phase de capture, passifs : rien n'est empêché) ───────────────
  document.addEventListener('click', (e) => { noter({ src: 'geste', geste: 'clic', isTrusted: e.isTrusted, cible: decrire(e.target), x: e.isTrusted ? undefined : e.clientX }); }, { capture: true, passive: true });
  document.addEventListener('submit', (e) => {
    let action = ''; try { action = new URL(e.target.action || location.href).pathname; } catch (_) {}
    noter({ src: 'geste', geste: 'soumission', isTrusted: e.isTrusted, cible: decrire(e.target), detail: action });
  }, { capture: true, passive: true });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;                       // aucune autre touche n'est notée
    noter({ src: 'geste', geste: 'touche', isTrusted: e.isTrusted, cible: decrire(e.target), detail: 'Entrée' });
  }, { capture: true, passive: true });
  const saisies = new Map();
  const finirSaisie = (el) => {
    const s = saisies.get(el); if (!s) return;
    saisies.delete(el);
    try {
      const nom = nomChamp(el);
      const type = String(el.type || el.tagName || '').toLowerCase();
      const valeur = el.isContentEditable ? el.innerText : el.value;
      const ev = { src: 'geste', geste: 'saisie', isTrusted: s.trusted, toutesHumaines: s.toutesHumaines, nbEvenements: s.n, champ: nom, typeChamp: type, longueur: String(valeur || '').length, cible: decrire(el) };
      const garder = type !== 'password' && !SENSIBLE.test(nom + ' ' + type) && (el.tagName === 'TEXTAREA' || el.isContentEditable || ZONE_TEXTE.test(nom));
      if (garder) ev.valeur = LIBRE(String(valeur || '').slice(0, 2000));   // e-mail, téléphone, IBAN, carte masqués
      noter(ev);
    } catch (_) {}
  };
  const surSaisie = (e) => {
    try {
      const el = e.target;
      if (!el || !(el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      const s = saisies.get(el) || { n: 0, trusted: e.isTrusted, toutesHumaines: true };
      s.n++; s.trusted = e.isTrusted; if (!e.isTrusted) s.toutesHumaines = false;
      clearTimeout(s.minut); s.minut = setTimeout(() => finirSaisie(el), 900);
      saisies.set(el, s);
    } catch (_) {}
  };
  document.addEventListener('input', surSaisie, { capture: true, passive: true });
  document.addEventListener('change', surSaisie, { capture: true, passive: true });

  // ── Navigation ────────────────────────────────────────────────────────────
  window.addEventListener('popstate', () => noter({ src: 'nav', detail: 'popstate (retour / avance)', chemin: location.pathname }));
  window.addEventListener('hashchange', () => noter({ src: 'nav', detail: 'hashchange', chemin: location.pathname }));
  const premierRegard = () => {
    noter({ src: 'nav', detail: 'page chargée', chemin: location.pathname });
    try { if (document.documentElement) balayer(document.documentElement, true); } catch (_) {}
  };

  // ── Ce que d'autres extensions ajoutent à la page ─────────────────────────
  const EXT = /(chrome|moz|safari-web)-extension:\/\/([a-z0-9-]{8,})/i;
  let nDom = 0; let minuteDom = 0;
  const vus = new WeakSet();
  const signaler = (el, raison, id) => {
    if (vus.has(el)) return; vus.add(el);
    const m = Math.floor(Date.now() / 60000);
    if (m !== minuteDom) { minuteDom = m; nDom = 0; }
    if (++nDom > 120) return;
    noter({ src: 'dom', detail: raison, extId: id || '', cible: decrire(el) || { tag: String(el.tagName || '').toLowerCase() } });
  };
  const examiner = (el, racine) => {
    if (!el || el.nodeType !== 1) return;
    for (const att of ['src', 'href', 'data', 'style']) {
      const v = el.getAttribute && el.getAttribute(att);
      const m = v && EXT.exec(v);
      if (m) { signaler(el, '<' + el.tagName.toLowerCase() + '> chargé depuis une extension (' + att + ')', m[2]); return; }
    }
    if (el.tagName === 'IFRAME') { signaler(el, 'iframe ajoutée (' + court(el.getAttribute('src') || 'sans src', 80).replace(/\?.*/, '') + ')', ''); return; }
    if (el.shadowRoot) { signaler(el, 'élément avec shadow root ouvert', ''); return; }
    if (racine && el.tagName.includes('-')) { signaler(el, 'élément personnalisé <' + el.tagName.toLowerCase() + '> posé à la racine (shadow root fermé possible)', ''); return; }
    if (racine && (el.tagName === 'STYLE' || el.tagName === 'LINK') && document.readyState === 'complete') signaler(el, '<' + el.tagName.toLowerCase() + '> ajouté après le chargement', '');
  };
  const balayer = (noeud, racine) => {
    try {
      examiner(noeud, racine);
      if (noeud.querySelectorAll) {
        const l = noeud.querySelectorAll('iframe,[src*="-extension://"],[href*="-extension://"],[style*="-extension://"]');
        for (let i = 0; i < l.length && i < 50; i++) examiner(l[i], false);
      }
    } catch (_) {}
  };
  try {
    new MutationObserver((muts) => {
      if (!actif) return;
      for (const m of muts) {
        const racine = m.target === document.documentElement || m.target === document.body || m.target === document.head;
        for (const n of m.addedNodes) if (n.nodeType === 1) balayer(n, racine);
      }
    }).observe(document, { childList: true, subtree: true });
  } catch (_) {}
})();
