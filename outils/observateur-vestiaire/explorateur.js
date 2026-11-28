// VRM Observateur Vestiaire — l'explorateur, dans l'onglet DÉDIÉ que le fond a ouvert (script isolé, cadre principal).
// Il ne fait rien de lui-même : il attend l'ordre « expl_page » du fond, puis, sur la page affichée, en LECTURE :
//  1. regarde s'il y a une vérification (captcha) ou si le compte est déconnecté ⇒ il s'arrête aussitôt et le dit ;
//  2. fait défiler jusqu'en bas (chargement infini) ;
//  3. ouvre ce qui OUVRE sans écrire : onglets, accordéons, menus, fenêtres d'information, « voir plus », pagination,
//     la liste de ceux qui ont aimé — chaque élément passé à la liste noire de regles.js (clicPermis) ;
//     jamais un lien (les liens sont des pages, ouvertes par le fond), jamais un champ, une case, une bascule
//     (aria-pressed), jamais un bouton de formulaire qui soumettrait ;
//  4. rend au fond les liens de la page que l'exploration a le droit d'ouvrir (lienPermis).
// Aucune touche n'est frappée, aucun formulaire n'est soumis, aucune requête n'est faite par ce script.
(() => {
  'use strict';
  if (window !== window.top || window.__vrmObsVcExplorateur) return;
  window.__vrmObsVcExplorateur = true;
  const R = self.VRMObs;
  let arret = false;
  const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const auHasard = (a, b) => a + Math.random() * (b - a);
  const court = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n || 120);

  // ── Vérification affichée, compte déconnecté ─────────────────────────────
  const SEL_CAPTCHA = 'iframe[src*="challenges.cloudflare.com"], iframe[src*="hcaptcha"], iframe[src*="recaptcha"], iframe[src*="captcha" i], iframe[src*="datadome"], iframe[src*="turnstile"], .cf-turnstile, #challenge-form, #cf-challenge-running, [id*="captcha" i], [class*="captcha" i], [data-testid*="captcha" i]';
  const TEXTE_CAPTCHA = /v[ée]rifi\w*\s+(que\s+)?(vous|you)\s.{0,40}(humain|human|robot)|are you (a )?(human|robot)|appuyez (et|puis) maintenez|press (&|and) hold|security check|contr[oô]le de s[ée]curit[ée]|verify you are human|unusual traffic|trafic inhabituel/i;
  function etat() {
    let captcha = '';
    try {
      if (document.querySelector(SEL_CAPTCHA)) captcha = 'élément de vérification dans la page';
      else if (/just a moment|un instant|attention required|access denied|acc[eè]s refus/i.test(document.title)) captcha = 'titre : ' + court(document.title, 60);
      else if (document.body && TEXTE_CAPTCHA.test(String(document.body.innerText || '').slice(0, 5000))) captcha = 'texte de vérification affiché';
    } catch (_) {}
    let deconnecte = '';
    try {
      if (/\/(login|signin|sign-in|connexion|authentication|auth)(\/|$|\?)/i.test(location.pathname)) deconnecte = 'page de connexion';
      else {
        const mdp = Array.from(document.querySelectorAll('input[type="password"]')).some((x) => x.getClientRects().length);
        const btn = Array.from(document.querySelectorAll('button,[role=button],a')).some((x) => /se connecter|log ?in|sign ?in/i.test(court(x.innerText, 60)));
        if (mdp && btn) deconnecte = 'formulaire de connexion affiché';
      }
    } catch (_) {}
    return { captcha, deconnecte };
  }

  // ── Défiler jusqu'en bas ─────────────────────────────────────────────────
  async function defiler(v) {
    let avant = -1; let stable = 0;
    for (let i = 0; i < 30 && !arret; i++) {
      const h = document.documentElement.scrollHeight;
      window.scrollTo(0, h);
      try { window.dispatchEvent(new Event('scroll')); } catch (_) {}
      await pause(Math.max(300, auHasard(700, 1300) * v));   // le plancher laisse au chargement infini le temps d'arriver
      const e = etat(); if (e.captcha || e.deconnecte) return e;
      const h2 = document.documentElement.scrollHeight;
      if (h2 === avant || h2 === h) { if (++stable >= 2) break; } else stable = 0;
      avant = h2;
    }
    return null;
  }

  // ── Ouvrir ce qui s'ouvre ────────────────────────────────────────────────
  const SEL_CANDIDATS = 'details > summary, [role="tab"], [aria-expanded="false"], [aria-haspopup]:not([aria-haspopup="false"]), button, [role="button"]';
  const JAMAIS = 'input, select, textarea, option, [role="switch"], [role="checkbox"], [role="radio"], [role="menuitemcheckbox"], [role="menuitemradio"], [contenteditable=""], [contenteditable="true"]';
  const faits = new WeakSet();
  const signatures = new Set();
  function decrire(el) {
    const t = el.closest('[data-testid]');
    return { texte: court(el.innerText || el.textContent, 120), aria: el.getAttribute('aria-label') || '', titre: el.getAttribute('title') || '', testid: (el.getAttribute('data-testid') || (t && el.contains(t) ? t.getAttribute('data-testid') : '') || ''), id: el.id || '', nom: el.getAttribute('name') || '', valeur: el.getAttribute('value') || '', tag: el.tagName.toLowerCase(), role: el.getAttribute('role') || '' };
  }
  // null = pas un candidat ; sinon { el, d, ok, raison }
  function juger(el) {
    if (faits.has(el)) return null;
    if (el.matches(JAMAIS) || el.closest('[aria-pressed]')) return null;
    if (el.closest('a[href]') && !/^(#|javascript:)/i.test(el.closest('a[href]').getAttribute('href') || '')) return null;   // un lien : le fond l'ouvrira comme une page
    const tag = el.tagName;
    if (tag === 'BUTTON') {
      const type = String(el.getAttribute('type') || '').toLowerCase();
      if (type === 'submit' || type === 'reset' || (el.form && type !== 'button')) return null;                           // il soumettrait un formulaire
    }
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') return null;
    if (!el.getClientRects().length) return null;
    if (el.getAttribute('role') === 'tab' && el.getAttribute('aria-selected') === 'true') return null;
    const d = decrire(el);
    const ouvre = tag === 'SUMMARY' || el.getAttribute('role') === 'tab' || el.getAttribute('aria-expanded') === 'false' || (el.hasAttribute('aria-haspopup') && el.getAttribute('aria-haspopup') !== 'false');
    const p = R.clicPermis(d);
    if (!ouvre && !R.voirPlus(d) && p.raison !== 'liste des j\'aime') return null;
    return { el, d, ok: p.ok, raison: p.raison };
  }
  async function ouvrir(v, maxClics, clics, refuses) {
    for (let passe = 0; passe < 4 && !arret && clics.length < maxClics; passe++) {
      const cand = Array.from(document.querySelectorAll(SEL_CANDIDATS)).map(juger).filter(Boolean);
      let nouveaux = 0;
      for (const c of cand) {
        if (arret || clics.length >= maxClics) break;
        faits.add(c.el);
        const sig = c.d.tag + '|' + c.d.texte + '|' + c.d.aria + '|' + c.d.testid;
        if (!c.ok) { if (!signatures.has('x' + sig) && refuses.length < 60) { signatures.add('x' + sig); refuses.push({ libelle: court(c.d.texte || c.d.aria || c.d.testid, 60), testid: c.d.testid, raison: c.raison }); } continue; }
        if (signatures.has(sig)) continue;
        signatures.add(sig);
        try { c.el.scrollIntoView({ block: 'center' }); } catch (_) {}
        await pause(auHasard(250, 600) * v);
        try { c.el.click(); } catch (_) {}
        clics.push({ libelle: court(c.d.texte || c.d.aria || c.d.testid, 60), testid: c.d.testid, role: c.d.role || c.d.tag, raison: c.raison });
        nouveaux++;
        await pause(Math.max(200, auHasard(600, 1200) * v));
        const e = etat(); if (e.captcha || e.deconnecte) return e;
      }
      if (!nouveaux) break;
    }
    return null;
  }

  function liens(moiId) {
    const out = new Map();
    for (const a of document.querySelectorAll('a[href]')) {
      const l = R.lienPermis(a.getAttribute('href'), location.href, court(a.innerText || a.getAttribute('aria-label'), 80), moiId);
      if (l.ok && !out.has(l.url)) out.set(l.url, { url: l.url, compte: l.compte, article: l.article });
    }
    return Array.from(out.values()).slice(0, 400);
  }

  async function explorerPage(o) {
    arret = false;
    const v = Number(o.vitesse) > 0 ? Number(o.vitesse) : 1;
    const clics = []; const refuses = [];
    const fin = (extra) => Object.assign({ ok: true, titre: court(document.title, 100), chemin: location.pathname, clics, refuses, liens: liens(o.moiId) }, extra || {});
    await pause(auHasard(800, 1500) * v);
    let e = etat(); if (e.captcha || e.deconnecte) return fin(e);
    e = await defiler(v); if (e) return fin(e);
    e = await ouvrir(v, o.maxClics || 25, clics, refuses); if (e) return fin(e);
    e = await defiler(v); if (e) return fin(e);
    return fin(etat());
  }

  chrome.runtime.onMessage.addListener((msg, sender, repondre) => {
    if (sender.id !== chrome.runtime.id || !msg) return;
    if (msg.quoi === 'expl_stop') { arret = true; return; }
    if (msg.quoi === 'expl_page') { explorerPage(msg).then(repondre, (err) => repondre({ ok: false, erreur: String(err && err.message || err) })); return true; }
  });
})();
