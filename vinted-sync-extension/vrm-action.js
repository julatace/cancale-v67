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
  .boite { width: min(620px, 100%); max-height: calc(100vh - 32px); overflow: auto; padding: 24px; display: grid; gap: 18px; border-radius: 28px;
    animation: vu-boite .2s cubic-bezier(.32,.72,0,1); }
  @keyframes vu-boite { from { opacity: 0; transform: scale(.98); } to { opacity: 1; transform: none; } }
  .h { display: flex; align-items: center; gap: 10px; font: 600 14px/1.3 var(--vu-police); color: var(--vu-sur-2); }
  .h .vu-point { color: var(--vu-sur-2); }
  .corps { display: grid; grid-template-columns: 160px minmax(0, 1fr); gap: 20px; align-items: center; }
  .photo { position: relative; width: 160px; height: 160px; }
  .photo img, .photo .ph { width: 160px; height: 160px; border-radius: 20px; object-fit: cover; display: block; background: var(--vu-socle); box-shadow: 0 10px 24px -12px rgb(0 0 0/.6); }
  .photo .etq { position: absolute; left: -6px; bottom: 10px; filter: drop-shadow(0 2px 4px rgb(0 0 0/.35)); }
  .droite { min-width: 0; display: grid; gap: 8px; }
  .titre { font: 700 26px/1.15 var(--vu-police); letter-spacing: -.025em; color: var(--vu-sur); }
  .compteur { font: 800 44px/1 var(--vu-police); letter-spacing: -.03em; color: var(--vu-sur); font-feature-settings: "tnum" 1; font-variant-numeric: tabular-nums; }
  .droite .vu-barre { height: 8px; margin-top: 4px; }
  .ti { font: 500 14px/1.35 var(--vu-police); color: var(--vu-sur-2); display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
  .suite { font: 500 15px/1.4 var(--vu-police); color: var(--vu-sur-2); font-feature-settings: "tnum" 1; font-variant-numeric: tabular-nums; }
  .suite b { color: var(--vu-sur); font-size: 17px; }
  .suiv { display: grid; gap: 8px; padding-top: 14px; border-top: 1px solid rgb(255 255 255/.16); }
  .suiv-t { font: 600 13px/1.3 var(--vu-police); color: var(--vu-sur-2); }
  .suiv-l { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  .mini { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .mini img, .mini .ph { width: 44px; height: 44px; border-radius: 10px; object-fit: cover; flex: none; background: var(--vu-socle); }
  .mini .mt { font: 500 13px/1.3 var(--vu-police); color: var(--vu-sur-2); overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
  .dit { font: 500 13px/1.4 var(--vu-police); color: var(--vu-sur-2); }
  /* 5.408 : la chaîne de la paire en cours (coffre › brouillon › supprimée › en ligne). */
  .chaine { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px 14px; font: 600 14px/1.3 var(--vu-police); color: var(--vu-sur-2); font-feature-settings: "tnum" 1; font-variant-numeric: tabular-nums; }
  .chaine li { display: inline-flex; align-items: center; gap: 6px; }
  .chaine li + li::before { content: '›'; margin-right: 8px; opacity: .5; }
  .chaine .pu { width: 20px; height: 20px; border-radius: 999px; display: inline-grid; place-items: center; font: 800 12px/1 var(--vu-police); box-shadow: inset 0 0 0 2px currentColor; opacity: .55; }
  .chaine [data-etat="faite"] { color: var(--vu-sur); }
  .chaine [data-etat="faite"] .pu { opacity: 1; box-shadow: none; background: var(--vu-sur); color: rgb(8 20 38); }
  .chaine [data-etat="encours"] { color: var(--vu-sur); }
  .chaine [data-etat="encours"] .pu { opacity: 1; animation: vu-pouls 1.4s ease-in-out infinite; }
  @keyframes vu-pouls { 0%, 100% { opacity: 1; } 50% { opacity: .3; } }
  @media (max-width: 560px) { .chaine { justify-content: center; } }
  .gestes { display: grid; grid-template-columns: 1fr auto; gap: 10px; }
  .gestes .vu-btn { min-height: 56px; border-radius: 16px; }
  .gestes .vu-plein { font-size: 18px; }
  .gestes .vu-sec { padding: 0 22px; font-size: 16px; }
  @media (max-width: 560px) {
    .voile { padding: 0; place-items: stretch; }
    .boite { width: 100%; max-height: none; min-height: 100%; border-radius: 0; border: 0; padding: max(20px, env(safe-area-inset-top)) 20px max(20px, env(safe-area-inset-bottom)); align-content: center; }
    .corps { grid-template-columns: 1fr; justify-items: center; text-align: center; }
    .droite { justify-items: center; width: 100%; }
    .droite .vu-barre { width: 100%; }
    .titre { font-size: 24px; }
    .gestes { grid-template-columns: 1fr; }
  }
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
  @media (prefers-reduced-motion: reduce) { .voile, .boite, .pastille, .sort, .chaine .pu { animation: none; } }
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
      // 5.406 (revue) : un VRAI écran plein — panneau large (≈ 600 px ; feuille plein écran au
      // téléphone), grande photo (160 px) et son étiquette N°, grand titre, grand compteur, barre
      // large, la suite et son compte à rebours, les 3 suivants, « Tout arrêter » en grand.
      const it = a.item || {};
      const vinted = (u) => u && /^https:\/\/[\w.-]*vinted\.net\//.test(String(u));
      const photo = vinted(it.photo) ? `<img src="${esc(it.photo)}" alt="" referrerpolicy="no-referrer" decoding="async">` : '<span class="ph" aria-hidden="true"></span>';
      const n = num && numPour === String(it.id || '') ? U.etiquette(num, true) : (it.num ? U.etiquette(it.num, true) : '');
      const pc = a.total > 0 ? 100 * (Number(a.fait) || 0) / Number(a.total) : 0;
      const titre = a.sorte === 'favoris' ? T('f_titre') : nom;
      const suivants = Array.isArray(a.suivants) ? a.suivants.slice(0, 3) : [];
      // 5.408 (`repubetapes`) : l'étape de LA paire en cours, telle que le service worker l'a annoncée.
      const rp = a.sorte === 'republier' && a.repub && String(a.repub.id || '') === String(it.id || '') ? a.repub : null;
      const chaine = rp ? (() => { const fait = Math.max(0, Math.min(4, Number(rp.fait) || 0)); const du = Number(rp.du) > Date.now() ? Number(rp.du) : 0;
        return `<ol class="chaine" aria-label="${esc(T('r_etapes'))}" data-action-chaine="${fait}">${['coffre', 'brouillon', 'supprimee', 'enligne'].map((k, i) => {
          const etat = i < fait ? 'faite' : i === fait ? 'encours' : 'attente';
          const nom = k === 'enligne' && du ? T('r_enligne_dans', { dans: U.duree(du - Date.now()) }) : k === 'coffre' && i === fait && rp.photos && rp.photos.total > 0 ? `${T('r_coffre')} · ${T('r_photos', { fait: Math.min(rp.photos.fait + 1, rp.photos.total), total: rp.photos.total })}` : T('r_' + k);
          return `<li data-etape="${k}" data-etat="${etat}"${k === 'enligne' && du ? ` data-action-enligne="${du}"` : ''}><span class="pu" aria-hidden="true">${etat === 'faite' ? '✓' : ''}</span>${esc(nom)}</li>`; }).join('')}</ol>`; })() : '';
      const liste = suivants.length ? `<div class="suiv" data-action-suivants="${suivants.length}"><div class="suiv-t">${esc(T('a_suivants'))}</div><div class="suiv-l">${suivants.map((x) => `<span class="mini" title="${esc(x.titre || '')}">${vinted(x.photo) ? `<img src="${esc(x.photo)}" alt="" referrerpolicy="no-referrer" decoding="async">` : '<span class="ph"></span>'}<span class="mt">${esc(x.titre || '')}</span></span>`).join('')}</div></div>` : '';
      poser(`<div class="voile" data-action-plein role="dialog" aria-modal="true" aria-label="${esc(titre)}"><div class="boite vu-coque vu-sur-coque">
        <div class="h"><span class="vu-point"></span><span>VRM · ${esc(T('a_en_direct'))}</span></div>
        <div class="corps">
          <div class="photo" data-action-item="${esc(it.id || '')}">${photo}${n ? `<div class="etq">${n}</div>` : ''}</div>
          <div class="droite">
            <div class="titre" data-action-quoi="${esc(a.sorte)}">${esc(titre)}</div>
            <div class="compteur n" data-action-fait="${Number(a.fait) || 0}" data-action-total="${Number(a.total) || 0}">${esc(compte(a))}</div>
            ${a.total > 0 ? U.barre(pc) : ''}
            ${it.titre ? `<div class="ti">${esc(it.titre)}</div>` : ''}
            <div class="suite" role="status">${suite}</div>
            ${chaine}
          </div>
        </div>
        ${liste}
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
