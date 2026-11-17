// ════════════════════════════════════════════════════════════════════════════
//  L'ÉCRAN « ACTION EN COURS » SUR VINTED (5.406, 17 nov.)
//
//  Julien : « je veux que quand on fait une action sur vinted l'extension prenne tout
//  le site et qu'on puisse pas faire, vinted autour est flouté ».
//  Pendant que VRM agit VRAIMENT sur vinted.fr (messages aux favoris, republication,
//  baisse de prix — l'état `vrmActionEnCours` que le service worker pose et rafraîchit),
//  un écran plein recouvre la page : Vinted flouté derrière (repli : un voile opaque),
//  les clics et les touches n'atteignent pas Vinted. Il dit ce qui se passe (« Envoi des
//  messages aux favoris · 3 sur 15 »), l'article en cours (photo, étiquette N°), le pas
//  suivant et son compte à rebours ; « Tout arrêter » (arrête TOUT de suite, et le dit) ;
//  « Réduire » (l'action continue, une pastille reste).
//  ⚠️ Ce que cet écran ne fait JAMAIS :
//   · rien ne se tape ni ne se clique à la place de Julien (aucun événement fabriqué) ;
//   · il ne lit rien de la page, sauf la PRÉSENCE d'une vérification ou d'un message de
//     Vinted (captcha, alerte) — et alors il se met de côté et le dit : jamais caché ;
//   · il ne bloque aucune lecture de l'extension (il ne fait que dessiner un état) ;
//   · shadow root FERMÉE : la page ne le lit pas, il n'abîme pas la page ;
//   · il n'apparaît que pendant une action vraie et fraîche (état rafraîchi < 3 min, compte
//     de l'onglet = compte qui agit, vérifié par le service worker) ; à la fin, un ✓ et il
//     s'efface ; « réduire les animations » ⇒ aucun mouvement.
// ════════════════════════════════════════════════════════════════════════════
(() => {
  if (window.top !== window) return;
  if (document.getElementById('vrm-action')) return;
  const vivant = () => { try { return !!(chrome.runtime && chrome.runtime.id); } catch (_) { return false; } };
  if (!vivant()) return;
  const U = globalThis.VRM_UI;
  if (!U) return;
  const T = U.T, esc = U.esc;

  const hote = document.createElement('div');
  hote.id = 'vrm-action';
  hote.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;display:none;pointer-events:none;';
  const ombre = hote.attachShadow({ mode: 'closed' });
  ombre.innerHTML = `<style>
  .voile { position: fixed; inset: 0; pointer-events: auto; display: grid; place-items: center; padding: 16px;
    background: var(--vu-voile); -webkit-backdrop-filter: blur(14px) saturate(1.1); backdrop-filter: blur(14px) saturate(1.1);
    animation: vu-in .22s cubic-bezier(.32,.72,0,1); }
  @supports not ((-webkit-backdrop-filter: blur(1px)) or (backdrop-filter: blur(1px))) { .voile { background: rgb(8 20 38/.92); } }
  @media (prefers-reduced-transparency: reduce) { .voile { background: rgb(8 20 38/.92); -webkit-backdrop-filter: none; backdrop-filter: none; } }
  .boite { width: min(440px, 100%); padding: 20px; display: grid; gap: 14px; }
  .h { display: flex; align-items: center; gap: 10px; font: 600 13px/1.3 var(--vu-police); color: var(--vu-sur-2); }
  .h .vu-point { color: var(--vu-sur-2); }
  .quoi { font: 700 22px/1.25 var(--vu-police); letter-spacing: -.02em; color: var(--vu-sur); }
  .quoi .n { white-space: nowrap; }
  .item { display: flex; align-items: center; gap: 12px; padding: 12px; }
  .item img, .item .ph { width: 56px; height: 56px; border-radius: 12px; object-fit: cover; flex: none; background: var(--vu-socle); }
  .item .ti { font: 600 14px/1.3 var(--vu-police); display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
  .item .col { min-width: 0; display: grid; gap: 6px; justify-items: start; }
  .suite { font: 500 14px/1.4 var(--vu-police); color: var(--vu-sur-2); font-feature-settings: "tnum" 1; font-variant-numeric: tabular-nums; }
  .suite b { color: var(--vu-sur); }
  .dit { font: 500 13px/1.4 var(--vu-police); color: var(--vu-sur-2); }
  .gestes { display: grid; grid-template-columns: 1fr auto; gap: 8px; }
  .gestes .vu-plein { font-size: 17px; }
  .fini { display: grid; justify-items: center; gap: 10px; text-align: center; }
  .coche { width: 56px; height: 56px; border-radius: 999px; display: grid; place-items: center; background: rgb(255 255 255/.16); color: var(--vu-sur); font: 700 28px/1 var(--vu-police); }
  .pastille { position: fixed; left: 16px; bottom: 20px; pointer-events: auto; width: max-content; display: flex; align-items: center; gap: 10px;
    min-height: 52px; padding: 4px 4px 4px 16px; border-radius: 999px; max-width: calc(100vw - 96px); font: 600 14px/1.2 var(--vu-police); animation: vu-in .2s ease; }
  .pastille .t { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--vu-sur); }
  .pastille .vu-btn { min-height: 44px; width: auto; padding: 0 16px; font-size: 14px; border-radius: 999px; flex: none; }
  .cote { position: fixed; left: 16px; right: 16px; top: 16px; margin: 0 auto; max-width: 520px; pointer-events: auto; padding: 12px 14px; display: flex; gap: 10px; align-items: center; }
  .cote .t { flex: 1; font: 600 14px/1.35 var(--vu-police); color: var(--vu-sur); }
  @keyframes vu-in { from { opacity: 0; } to { opacity: 1; } }
  .sort { animation: vu-out .5s ease forwards; }
  @keyframes vu-out { 0%, 60% { opacity: 1; } 100% { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .voile, .pastille, .sort { animation: none; } }
</style><div class="vu-racine" data-racine></div>`;
  U.monter(ombre);
  const racine = ombre.querySelector('[data-racine]');
  const poser = (html) => { const d = new DOMParser().parseFromString('<body>' + html + '</body>', 'text/html'); racine.replaceChildren(...Array.from(d.body.childNodes)); };
  (document.documentElement || document.body).appendChild(hote);

  let arretA = 0, action = null, reduit = false, num = '', numPour = '', minuteur = null, finA = 0, arretDemande = false, vintedParle = '';
  // ── Vinted parle (vérification, captcha, alerte) : l'écran se met de côté ───────────────
  // On regarde seulement la PRÉSENCE de ces éléments (jamais leur texte).
  const SEL_VERIF = 'iframe[src*="captcha-delivery"], iframe[src*="datadome"], #datadome-captcha, iframe[src*="recaptcha"], iframe[src*="hcaptcha"], iframe[src*="challenges.cloudflare"]';
  const SEL_ALERTE = '[role="alertdialog"], [data-testid*="error" i][role="alert"], [data-testid*="toast" i][role="alert"]';
  function vintedDit() {
    try {
      if (document.querySelector(SEL_VERIF)) return 'verification';
      const a = document.querySelector(SEL_ALERTE);
      if (a && a.getClientRects().length && !hote.contains(a)) return 'alerte';
    } catch (_) {}
    return '';
  }
  // Les touches n'atteignent pas Vinted pendant l'écran plein (Tab reste dans l'écran).
  const bouclier = (ev) => {
    if (!plein()) return;
    try { const p = ev.composedPath(); if (p.includes(hote)) return; } catch (_) {}
    ev.stopImmediatePropagation(); ev.preventDefault();
  };
  for (const t of ['keydown', 'keypress', 'keyup', 'wheel']) window.addEventListener(t, bouclier, { capture: true, passive: false });
  const plein = () => !!(action && action.actif && !reduit && !vintedParle && !(action.verification));

  const NOMS = { favoris: 'a_favoris', republier: 'a_republier', baisse: 'a_baisse', offres: 'a_offres' };
  const QUOI = { ouverture: 'q_ouverture', sorte: 'q_sorte', heure: 'q_heure', jour: 'q_jour', rythme: 'q_rythme', 'autre-compte': 'q_autre', serie: 'q_serie', rodage: 'q_rodage', espace: 'q_espace', calme: 'q_calme' };
  function compte(a) { return a.total > 0 ? T('f_sur', { n: Number(a.fait) || 0, total: Number(a.total) }) : T('a_faites', { n: Number(a.fait) || 0 }); }
  function rendre() {
    clearInterval(minuteur); minuteur = null;
    const a = action;
    if (!a) { hote.style.display = 'none'; poser(''); return; }
    hote.style.display = 'block';
    const nom = T(NOMS[a.sorte] || 'a_favoris');
    // Vinted parle, ou demande une vérification : l'écran se met de côté et le DIT.
    if (vintedParle || a.verification) {
      const phrase = vintedParle === 'alerte' ? T('a_vinted_dit') : T('a_verif');
      poser(`<div class="cote vu-coque" role="status" data-action-cote="${esc(vintedParle || 'verification')}"><span class="vu-point" data-k="geste"></span><span class="t">${esc(phrase)}</span></div>`);
      return;
    }
    if (!a.actif) {
      // La fin : un ✓ (ou « Arrêté »), puis l'écran s'efface.
      const arret = a.fin && a.fin.raison === 'arret';
      poser(`<div class="voile sort" data-action-fin="${esc((a.fin && a.fin.raison) || 'fini')}"><div class="boite vu-coque fini" role="status"><div class="coche" aria-hidden="true">${arret ? '■' : '✓'}</div><div class="quoi">${esc(arret ? T('a_arrete') : T('a_fini'))}</div><div class="suite">${esc(nom)} · ${esc(compte(a))}</div></div></div>`);
      return;
    }
    const prochain = Number(a.prochain) > Date.now() ? Number(a.prochain) : 0;
    const suite = a.enCours ? esc(T('a_en_cours')) : prochain ? `<b data-action-dans="${prochain}">${esc(T('a_ensuite', { dans: U.duree(prochain - Date.now()) }))}</b>${QUOI[a.quoi] ? ' · ' + esc(T(QUOI[a.quoi])) : ''}` : esc(T('a_en_cours'));
    if (reduit) {
      poser(`<div class="pastille vu-coque" role="status" data-action-pastille><span class="vu-point"></span><span class="t">${esc(nom)} · ${esc(compte(a))}</span><button class="vu-btn vu-plein" data-agrandir>${esc(T('a_agrandir'))}</button></div>`);
    } else {
      const it = a.item || {};
      const photo = it.photo && /^https:\/\/[\w.-]*vinted\.net\//.test(String(it.photo)) ? `<img src="${esc(it.photo)}" alt="" referrerpolicy="no-referrer" decoding="async">` : '<span class="ph" aria-hidden="true"></span>';
      const n = num && numPour === String(it.id || '') ? U.etiquette(num) : '';
      const item = it.id || it.photo || it.titre || it.num ? `<div class="item vu-plaque" data-action-item="${esc(it.id || '')}">${photo}<div class="col">${n || (it.num ? U.etiquette(it.num) : '')}${it.titre ? `<div class="ti">${esc(it.titre)}</div>` : ''}</div></div>` : '';
      const pc = a.total > 0 ? 100 * (Number(a.fait) || 0) / Number(a.total) : 0;
      poser(`<div class="voile" data-action-plein role="dialog" aria-modal="true" aria-label="${esc(nom)}"><div class="boite vu-coque vu-sur-coque">
        <div class="h"><span class="vu-point"></span><span>VRM</span></div>
        <div class="quoi" data-action-quoi="${esc(a.sorte)}">${esc(nom)} · <span class="n" data-action-fait="${Number(a.fait) || 0}" data-action-total="${Number(a.total) || 0}">${esc(compte(a))}</span></div>
        ${a.total > 0 ? U.barre(pc) : ''}
        ${item}
        <div class="suite" role="status">${suite}</div>
        <div class="dit">${esc(T('a_bloque'))}</div>
        <div class="gestes"><button class="vu-btn vu-plein" data-arreter>${esc(arretDemande ? T('c_arret_en_cours') : T('c_tout_arreter'))}</button><button class="vu-btn vu-sec" data-reduire>${esc(T('a_reduire'))}</button></div>
      </div></div>`);
      try { const b = racine.querySelector('[data-arreter]'); if (b && !racine.contains(ombre.activeElement)) b.focus({ preventScroll: true }); } catch (_) {}
    }
    const dans = racine.querySelector('[data-action-dans]');
    if (dans) minuteur = setInterval(() => { const t = Number(dans.getAttribute('data-action-dans')); if (!dans.isConnected) { clearInterval(minuteur); return; } if (t <= Date.now()) { clearInterval(minuteur); lire(); return; } dans.textContent = T('a_ensuite', { dans: U.duree(t - Date.now()) }); }, 1000);
    brancher();
  }
  function brancher() {
    racine.querySelectorAll('[data-arreter]').forEach((b) => b.addEventListener('click', () => {
      if (arretDemande) return;
      arretDemande = true; arretA = Date.now(); b.disabled = true; b.textContent = T('c_arret_en_cours');
      try {
        chrome.runtime.sendMessage({ from: 'vrm-action', action: 'arreter' }, () => {
          void chrome.runtime.lastError;
          arretDemande = false;
          action = Object.assign({}, action || {}, { actif: false, fin: { at: Date.now(), raison: 'arret' } });
          finA = Date.now(); rendre(); setTimeout(lire, 1800);
        });
      } catch (_) { arretDemande = false; }
    }));
    const r = racine.querySelector('[data-reduire]'); if (r) r.addEventListener('click', () => { reduit = true; rendre(); });
    const g = racine.querySelector('[data-agrandir]'); if (g) g.addEventListener('click', () => { reduit = false; rendre(); });
  }
  // Le N° de l'article en cours : la règle des numéros de la page (le compte de l'onglet seul).
  function chercherNum(id) {
    if (!id || numPour === id) return;
    numPour = id; num = '';
    try { chrome.runtime.sendMessage({ action: 'numeros', items: [id] }, (r) => { void chrome.runtime.lastError; const v = r && r.ok && r.items && r.items[id]; num = v ? String(v.numero || v.num || v) : ''; if (num && !/^[\w-]{1,12}$/.test(num)) num = ''; if (action) rendre(); }); } catch (_) {}
  }
  function lire() {
    if (!vivant()) { action = null; rendre(); return; }
    try {
      chrome.runtime.sendMessage({ from: 'vrm-action', action: 'etat' }, (r) => {
        void chrome.runtime.lastError;
        const a = r && r.ok && r.action ? r.action : null;
        const avant = action;
        // « Tout arrêter » vient d'être touché : un état lu AVANT l'arrêt ne rallume pas l'écran.
        if (a && a.actif && Date.now() - arretA < 5000) return;
        if (a && a.actif) { action = a; finA = 0; }
        else if (a && !a.actif && avant && avant.actif) { action = a; finA = Date.now(); }   // la fin, une fois
        else if (finA && Date.now() - finA < 1600) { /* le ✓ reste un instant */ }
        else { action = null; reduit = false; }
        if (action && action.item && action.item.id) chercherNum(String(action.item.id));
        rendre();
        if (finA) setTimeout(() => { if (finA && Date.now() - finA >= 1500) { finA = 0; action = null; reduit = false; rendre(); } }, 1700);
      });
    } catch (_) {}
  }
  try { chrome.storage.onChanged.addListener((ch, zone) => { if (zone === 'local' && ch.vrmActionEnCours) lire(); }); } catch (_) {}
  // Vinted qui parle se regarde en continu (la présence seulement) — l'écran s'écarte aussitôt.
  try {
    const mo = new MutationObserver(() => { if (!action) return; const v = vintedDit(); if (v !== vintedParle) { vintedParle = v; rendre(); } });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  } catch (_) {}
  setInterval(() => { if (action && action.actif) lire(); }, 15000);   // un état qui n'est plus rafraîchi s'éteint (fond mort)
  lire();
  globalThis.__vrmActionLire = lire;
})();
