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
    overscroll-behavior: contain; }
  /* 5.407 : l'entrée calme se joue UNE fois par action (classe .anim posée au premier dessin du lot) ;
     chaque pas suivant change le texte et la barre SUR PLACE — jamais un fondu rejoué. */
  .anim .voile { animation: vu-in .22s cubic-bezier(.32,.72,0,1); }
  .anim .boite { animation: vu-boite .2s cubic-bezier(.32,.72,0,1); }
  @supports not ((-webkit-backdrop-filter: blur(1px)) or (backdrop-filter: blur(1px))) { .voile { background: rgb(8 20 38/.92); } }
  @media (prefers-reduced-transparency: reduce) { .voile { background: rgb(8 20 38/.92); -webkit-backdrop-filter: none; backdrop-filter: none; } }
  .boite { width: min(620px, 100%); max-height: calc(100vh - 32px); overflow: auto; overscroll-behavior: contain; padding: 24px; display: grid; gap: 18px; border-radius: 28px; }
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
  .gestes { display: grid; grid-template-columns: 1fr auto; gap: 10px; }
  .gestes.seul { grid-template-columns: 1fr; }
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
    min-height: 52px; padding: 4px 4px 4px 16px; border-radius: 999px; max-width: calc(100vw - 96px); font: 600 14px/1.2 var(--vu-police); }
  .anim .pastille { animation: vu-in .2s ease; }
  .pastille .t { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--vu-sur); }
  .pastille .vu-btn { min-height: 44px; width: auto; padding: 0 16px; font-size: 14px; border-radius: 999px; flex: none; }
  .cote { position: fixed; left: 16px; right: 16px; top: 16px; margin: 0 auto; max-width: 520px; pointer-events: auto; padding: 12px 14px; display: flex; gap: 10px; align-items: center; }
  .cote .t { flex: 1; font: 600 14px/1.35 var(--vu-police); color: var(--vu-sur); }
  .carte-verif { display: grid; gap: 8px; max-width: 440px; padding: 16px; }
  .carte-verif .cv-t { display: flex; gap: 10px; align-items: center; }
  .carte-verif .cv-n { font: 500 14px/1.4 var(--vu-police); color: var(--vu-sur-2); font-variant-numeric: tabular-nums; }
  .carte-verif .vu-btn { margin-top: 4px; }
  @keyframes vu-in { from { opacity: 0; } to { opacity: 1; } }
  .sort { animation: vu-out .5s ease forwards; }
  @keyframes vu-out { 0%, 60% { opacity: 1; } 100% { opacity: 0; } }
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
  /* 5.423 : la frise d'une modification (preuve par preuve), le temps, et le bilan Avant | Après. */
  .modif { display: grid; gap: 10px; width: 100%; margin-top: 6px; }
  .modif .vu-frise { color: var(--vu-sur-2); }
  [data-action-bilan] .boite { width: min(680px, 100%); }
  [data-action-bilan] .titre { font-size: 22px; }
  [data-action-bilan] .vu-bl { max-height: min(56vh, 520px); overflow: auto; overscroll-behavior: contain; }
  @media (max-width: 560px) { [data-action-bilan] .boite { align-content: start; } [data-action-bilan] .vu-bl { max-height: none; } }
  @media (prefers-reduced-motion: reduce) { .anim .voile, .anim .boite, .anim .pastille, .sort, .chaine .pu { animation: none; } }
</style><div class="vu-racine" data-racine></div>`;
  U.monter(ombre);
  const racine = ombre.querySelector('[data-racine]');
  const poser = (html) => { const d = new DOMParser().parseFromString('<body>' + html + '</body>', 'text/html'); racine.replaceChildren(...Array.from(d.body.childNodes)); };
  const accrocher = () => { try { if (!hote.isConnected) (document.documentElement || document.body).appendChild(hote); } catch (_) {} };
  accrocher();

  let arretA = 0, action = null, reduit = false, num = '', numPour = '', minuteur = null, finA = 0, arretDemande = false, vintedParle = '';
  // 5.407 (Julien : « l'affichage qui bloque de l'extension disparaît 1 s ») : UNE action = UN lot
  // (`lot` : sorte, compte, début) ; l'écran reste posé du « Confirmer l'envoi » à la fin, l'arrêt ou
  // « Réduire ». Ce qui le faisait tomber, et ce qui le tient maintenant :
  //  · un état « pas su » (service worker endormi ou qui se réveille : pas de réponse) éteignait
  //    l'écran ⇒ « pas su » ne vaut pas « fini » : l'état se relit dans chrome.storage.local ;
  //  · un état qui dit « rien » sans fin (compte relu un instant) ⇒ il faut deux lectures à 1,5 s
  //    d'écart pour l'éteindre ;
  //  · chaque pas redessinait tout et rejouait le fondu ⇒ mise à jour SUR PLACE, fondu une fois ;
  //  · la page de Vinted change de route (SPA) ou réécrit le document ⇒ le MÊME hôte se raccroche ;
  //  · rechargement complet ⇒ content.js pose un voile bloquant au tout début (document_start,
  //    sessionStorage `vrm_action_gel`), retiré quand cet écran a pris la place.
  // Seule mise de côté permise : une vérification (captcha) ou une alerte de Vinted, DITE en clair
  // (bandeau), tenue au moins 3 s — jamais un éclair.
  let vue = '', lotVu = '', nulA = 0, asideA = 0, alerteDepuis = 0;
  let iframeVue = false;   // 5.410.5 : une vérification VUE sur la page pendant l'arrêt en cours
  const lotDe = (a) => (a ? `${a.sorte || ''}:${a.uid || ''}:${a.debut || ''}` : '');
  // Rechargée PENDANT ce lot : l'entrée calme ne se rejoue pas (le lot est déjà « vu »).
  let lotAvant = ''; try { lotAvant = String(sessionStorage.getItem('vrm_action_gel') || '').split('|').slice(1).join('|'); } catch (_) {}
  const GEL = 'vrm_action_gel';
  const gel = (on) => {
    try { if (on) sessionStorage.setItem(GEL, Date.now() + '|' + lotVu); else sessionStorage.removeItem(GEL); } catch (_) {}
    // Le voile posé par content.js au rechargement s'en va dès que CET écran a décidé (posé, ou rien à montrer).
    try { const g = document.getElementById('vrm-action-gel'); if (g) g.remove(); } catch (_) {}
  };
  // ── Vinted parle (vérification, captcha, alerte) : l'écran se met de côté ───────────────
  // On regarde seulement la PRÉSENCE de ces éléments (jamais leur texte).
  // (21 nov., 5.410.6) Une vérification n'est VRAIE que si elle est AFFICHÉE : visible, assez grande pour être faite
  // (vinted.fr porte en permanence un cadre reCAPTCHA invisible, qui faisait dire « fais la vérification » à tort).
  function vrmVerifVisible(sel) {
    try {
      for (const el of document.querySelectorAll(sel)) {
        const r = el.getBoundingClientRect();
        if (r.width < 120 || r.height < 60) continue;
        if (r.bottom <= 0 || r.right <= 0 || r.top >= innerHeight || r.left >= innerWidth) continue;
        const s = getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) < 0.1) continue;
        if (el.closest && el.closest('[data-vrm-hote], #vrm-action-gel')) continue;
        return el;
      }
    } catch (_) {}
    return null;
  }
  const SEL_VERIF = 'iframe[src*="captcha-delivery"], iframe[src*="datadome"], #datadome-captcha, iframe[src*="recaptcha"], iframe[src*="hcaptcha"], iframe[src*="challenges.cloudflare"]';
  const SEL_ALERTE = '[role="alertdialog"], [data-testid*="error" i][role="alert"], [data-testid*="toast" i][role="alert"]';
  function vintedDit() {
    try {
      if (vrmVerifVisible(SEL_VERIF)) { alerteDepuis = 0; return 'verification'; }
      const a = document.querySelector(SEL_ALERTE);
      // Une alerte doit TENIR 800 ms (un message bref de Vinted ne fait pas sauter l'écran).
      if (a && a.getClientRects().length && !hote.contains(a)) { if (!alerteDepuis) alerteDepuis = Date.now(); return Date.now() - alerteDepuis >= 800 ? 'alerte' : (vintedParle === 'alerte' ? 'alerte' : ''); }
    } catch (_) {}
    alerteDepuis = 0;
    return '';
  }
  // ── Le défilement verrouillé (Julien : « le pavé tactile permet de descendre dans Vinted ») ──
  // html et body en `overflow: hidden` (valeurs d'avant gardées, position gardée) pendant l'écran
  // plein ; rendus EXACTEMENT à la fin, sur « Réduire », « Tout arrêter » et pendant une vérification.
  let verrou = null;
  function verrouiller() {
    const h = document.documentElement, b = document.body;
    if (!verrou) {
      verrou = { x: window.scrollX, y: window.scrollY, h: h.style.getPropertyValue('overflow'), hp: h.style.getPropertyPriority('overflow'), b: null, bp: '' };
    }
    try { if (h.style.getPropertyValue('overflow') !== 'hidden') h.style.setProperty('overflow', 'hidden', 'important'); } catch (_) {}
    if (b && verrou.b === null) { verrou.b = b.style.getPropertyValue('overflow'); verrou.bp = b.style.getPropertyPriority('overflow'); }
    try { if (b && b.style.getPropertyValue('overflow') !== 'hidden') b.style.setProperty('overflow', 'hidden', 'important'); } catch (_) {}
  }
  function deverrouiller() {
    if (!verrou) return;
    const v = verrou; verrou = null;
    const remettre = (el, val, pr) => { try { if (!el) return; if (val) el.style.setProperty('overflow', val, pr || ''); else el.style.removeProperty('overflow'); } catch (_) {} };
    remettre(document.documentElement, v.h, v.hp);
    if (v.b !== null) remettre(document.body, v.b, v.bp);
    try { window.scrollTo(v.x, v.y); } catch (_) {}
  }
  // 5.410.3 : pendant le FORMULAIRE (republication « comme Bleam »), pas de « Réduire » : Vinted reste verrouillé jusqu'à la fin ou « Tout arrêter ».
  // 5.423 : le bilan (après) et l'écran fermé par « Fermer » ne retiennent plus ni le clavier ni le défilement de Vinted.
  const plein = () => !!(action && action.actif && (!reduit || action.formulaire) && !vintedParle && !(action.verification) && vue !== 'bilan' && vue !== 'ferme');
  // Ce qui défile DANS l'écran (sa boîte, quand elle déborde) défile ; rien n'atteint la page.
  const dansBoite = (ev) => { try { const p = ev.composedPath(); if (!p.includes(hote)) return null; return p.find((el) => el && el.classList && el.classList.contains('boite')) || null; } catch (_) { return null; } };
  const TOUCHES_DEFIL = [' ', 'Spacebar', 'PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
  const bouclier = (ev) => {
    if (!plein()) return;
    if (ev.type === 'wheel' || ev.type === 'touchmove') {
      const b = dansBoite(ev);
      if (b && b.scrollHeight > b.clientHeight + 1) return;   // la boîte défile seule (overscroll contenu)
      if (ev.cancelable) ev.preventDefault();
      return;
    }
    let dedans = false; try { dedans = ev.composedPath().includes(hote); } catch (_) {}
    if (dedans) {
      // Dans l'écran : les touches servent ses boutons, jamais à faire défiler la page.
      const cible = (() => { try { return ev.composedPath()[0]; } catch (_) { return null; } })();
      if (TOUCHES_DEFIL.includes(ev.key) && !(cible && cible.tagName === 'BUTTON' && (ev.key === ' ' || ev.key === 'Spacebar'))) ev.preventDefault();
      return;
    }
    ev.stopImmediatePropagation(); ev.preventDefault();
  };
  for (const t of ['keydown', 'keypress', 'keyup', 'wheel', 'touchmove']) window.addEventListener(t, bouclier, { capture: true, passive: false });
  // Un script de la page qui fait défiler pendant l'écran : remis où il était.
  window.addEventListener('scroll', () => { if (plein() && verrou && (window.scrollY !== verrou.y || window.scrollX !== verrou.x)) { try { window.scrollTo(verrou.x, verrou.y); } catch (_) {} } }, { capture: true, passive: true });

  const NOMS = { favoris: 'a_favoris', republier: 'a_republier', baisse: 'a_baisse', offres: 'a_offres', apresvente: 'a_apresvente', supprimer: 'a_supprimer', masquer: 'm3_a_masquer' };   // 5.410.4 · 5.423
  const QUOI = { ouverture: 'q_ouverture', sorte: 'q_sorte', heure: 'q_heure', jour: 'q_jour', rythme: 'q_rythme', 'autre-compte': 'q_autre', serie: 'q_serie', rodage: 'q_rodage', espace: 'q_espace', calme: 'q_calme' };
  function compte(a) { return a.total > 0 ? T('f_sur', { n: Number(a.fait) || 0, total: Number(a.total) }) : T('a_faites', { n: Number(a.fait) || 0 }); }
  const vinted = (u) => u && /^https:\/\/[\w.-]*vinted\.net\//.test(String(u));
  const photoHtml = (it, n) => `${vinted(it.photo) ? `<img src="${esc(it.photo)}" alt="" referrerpolicy="no-referrer" decoding="async">` : '<span class="ph" aria-hidden="true"></span>'}${n ? `<div class="etq">${n}</div>` : ''}`;
  const suiteHtml = (a) => {
    const prochain = Number(a.prochain) > Date.now() ? Number(a.prochain) : 0;
    return a.enCours ? esc(T('a_en_cours')) : prochain ? `<b data-action-dans="${prochain}">${esc(T('a_ensuite', { dans: U.duree(prochain - Date.now()) }))}</b>${QUOI[a.quoi] ? ' · ' + esc(T(QUOI[a.quoi])) : ''}` : esc(T('a_en_cours'));
  };
  const suivantsHtml = (a) => {
    const suivants = Array.isArray(a.suivants) ? a.suivants.slice(0, 3) : [];
    return suivants.length ? `<div class="suiv-t">${esc(T('a_suivants'))}</div><div class="suiv-l">${suivants.map((x) => `<span class="mini" title="${esc(x.titre || '')}">${vinted(x.photo) ? `<img src="${esc(x.photo)}" alt="" referrerpolicy="no-referrer" decoding="async">` : '<span class="ph"></span>'}<span class="mt">${esc(x.titre || '')}</span></span>`).join('')}</div>` : '';
  };
  // 5.408 (`repubetapes`) : l'étape de LA paire en cours, telle que le service worker l'a annoncée
  // (coffre › brouillon › supprimée › en ligne). Rendue au premier dessin ET tenue à jour sur place (majPlein).
  // 5.423 (`modifavantapres`) : une modification d'annonce (republier, prix, masquer) a SA frise — chaque étape cochée sur SA
  //    preuve (vrm-ui.js `<frise-modif-regle>`), l'étape en cours animée sobrement, le temps écoulé et l'estimation.
  const M = U.MODIF || null;
  const modifDe = (a) => (M && a && a.modif && M.ETAPES[a.modif.sorte] && a.item && String(a.modif.id || '') === String(a.item.id || '') ? a.modif : null);
  const tempsTxt = (a, m) => {
    const ecoule = Math.max(0, Date.now() - Number(m.debut || Date.now()));
    const est = Number(m.estimeMs) > 0 ? Number(m.estimeMs) : 0;
    const apres = Math.max(0, (Number(a.total) || 0) - (Number(a.fait) || 0) - 1);
    return est ? T('m3_ecoule', { e: U.duree(ecoule), r: U.duree(Math.max(0, est - ecoule) + apres * est) }) : T('m3_ecoule_seul', { e: U.duree(ecoule) });
  };
  // ══ 5.433 (`pauseapres`, `reessai`) : « Pause après celle-ci » à côté de « Tout arrêter » — l'action en cours finit jusqu'à
  //    sa dernière preuve, puis la file de VRM passe en pause (« Reprendre » dans le panneau). L'état se lit dans
  //    chrome.storage.local (`vrmFile.pause`), jamais deviné. Et la phrase d'un nouvel essai (page pas prête).
  let filePause = '', pauseEnVol = false;
  const lireFilePause = () => { try { chrome.storage.local.get('vrmFile', (g) => { void chrome.runtime.lastError; const p = g && g.vrmFile && g.vrmFile.v === 1 ? String(g.vrmFile.pause || '') : ''; if (p !== filePause) { filePause = p; pauseEnVol = false; racine.removeAttribute('data-hb'); if (vue === 'plein') lotVu = ''; if (action) rendre(); } }); } catch (_) {} };
  try { chrome.storage.onChanged.addListener((ch, zone) => { if (zone === 'local' && ch.vrmFile) lireFilePause(); }); } catch (_) {}
  const pauseBoutonHtml = () => (filePause ? '' : `<button class="vu-btn vu-sec" data-pause-apres${pauseEnVol ? ' disabled' : ''}>${esc(T('q7_pause_apres'))}</button>`);
  const pauseDitHtml = () => (filePause === 'apres' ? `<div class="dit" role="status" data-pause-dit="apres">${esc(T('q7_pause_attente'))}</div>` : filePause === 'oui' ? `<div class="dit" role="status" data-pause-dit="oui">${esc(T('q7_pause_oui'))}</div>` : '');
  // (une modification d'annonce dit la phrase dans SA frise : jamais deux fois)
  const essaiHtml = (a) => { if (modifDe(a)) return ''; const e = a && a.essai; return e && M && M.essaiTxt && Date.now() - Number(e.at || 0) < 10 * 60000 ? `<div class="dit" role="status" data-action-essai="${esc(String(e.quoi || ''))}">${esc(M.essaiTxt(e))}</div>` : ''; };
  const modifHtml = (a) => { const m = modifDe(a); return m ? `<div class="modif" data-modif="${esc(m.sorte)}">${M.friseHtml(m)}<div class="vu-sous" data-modif-temps>${esc(tempsTxt(a, m))}</div></div>` : ''; };
  // L'après : le bilan de la série (avant | après, « Voir sur Vinted » ; ce qui s'est arrêté, en ambre, avec « Reprendre »).
  // Une modification AUTOMATIQUE (baisse par règle, cycle de vie) ne pose pas de bilan à fermer sur Vinted (le panneau et le journal le disent).
  const bilanVu = (a) => !!(M && a && a.modif && a.modif.fin && !a.modif.auto && Array.isArray(a.bilan) && a.bilan.length && !(a.actif && a.enCours));
  let fermeDebut = 0, repriseModif = '';
  try { fermeDebut = Number(sessionStorage.getItem('vrm_modif_ferme')) || 0; } catch (_) {}
  const chaineHtml = (a) => {
    if (modifDe(a)) return modifHtml(a);
    const it = a.item || {};
    const rp = a.sorte === 'republier' && a.repub && String(a.repub.id || '') === String(it.id || '') ? a.repub : null;
    if (!rp) return '';
    const fait = Math.max(0, Math.min(4, Number(rp.fait) || 0)); const du = Number(rp.du) > Date.now() ? Number(rp.du) : 0;
    return `<ol class="chaine" aria-label="${esc(T('r_etapes'))}" data-action-chaine="${fait}">${['coffre', 'brouillon', 'supprimee', 'enligne'].map((k, i) => {
      const etat = i < fait ? 'faite' : i === fait ? 'encours' : 'attente';
      const nom = k === 'enligne' && du ? T('r_enligne_dans', { dans: U.duree(du - Date.now()) }) : k === 'coffre' && i === fait && rp.photos && rp.photos.total > 0 ? `${T('r_coffre')} · ${T('r_photos', { fait: Math.min(rp.photos.fait + 1, rp.photos.total), total: rp.photos.total })}` : T('r_' + k);
      return `<li data-etape="${k}" data-etat="${etat}"${k === 'enligne' && du ? ` data-action-enligne="${du}"` : ''}><span class="pu" aria-hidden="true">${etat === 'faite' ? '✓' : ''}</span>${esc(nom)}</li>`; }).join('')}</ol>`;
  };
  const numDe = (it) => (num && numPour === String(it.id || '') ? U.etiquette(num, true) : (it.num ? U.etiquette(it.num, true) : ''));
  // 5.423 : le temps écoulé de la modification en cours, chaque seconde (rien d'autre n'est redessiné).
  setInterval(() => { if (vue !== 'plein' || !action) return; const m = modifDe(action), tp = racine.querySelector('[data-modif-temps]'); if (m && tp) { const t = tempsTxt(action, m); if (tp.textContent !== t) tp.textContent = t; } }, 1000);
  function minuter() {
    clearInterval(minuteur); minuteur = null;
    const dans = racine.querySelector('[data-action-dans]');
    if (dans) minuteur = setInterval(() => { const t = Number(dans.getAttribute('data-action-dans')); if (!dans.isConnected) { clearInterval(minuteur); return; } if (t <= Date.now()) { clearInterval(minuteur); lire(); return; } dans.textContent = T('a_ensuite', { dans: U.duree(t - Date.now()) }); }, 1000);
  }
  // Un pas de plus (le compteur, la barre, l'article, la suite) : SUR PLACE, rien n'est démonté.
  function majPlein(a) {
    const it = a.item || {};
    const c = racine.querySelector('[data-action-fait]');
    if (c) { const t = compte(a); if (c.textContent !== t) c.textContent = t; c.setAttribute('data-action-fait', String(Number(a.fait) || 0)); c.setAttribute('data-action-total', String(Number(a.total) || 0)); }
    const br = racine.querySelector('.droite .vu-barre');
    if (br) { const pc = a.total > 0 ? Math.max(0, Math.min(100, 100 * (Number(a.fait) || 0) / Number(a.total))) : 0; br.setAttribute('aria-valuenow', String(Math.round(pc))); const i = br.querySelector('i'); if (i) i.style.width = pc + '%'; }
    const ph = racine.querySelector('[data-action-item]');
    const cleItem = String(it.id || '') + '|' + (numDe(it) ? 'n' : '');
    if (ph && ph.getAttribute('data-cle') !== cleItem) { const d = new DOMParser().parseFromString('<body>' + photoHtml(it, numDe(it)) + '</body>', 'text/html'); ph.replaceChildren(...Array.from(d.body.childNodes)); ph.setAttribute('data-action-item', String(it.id || '')); ph.setAttribute('data-cle', cleItem); }
    const ti = racine.querySelector('[data-action-ti]');
    if (ti) { const t = it.titre || ''; if (ti.textContent !== t) ti.textContent = t; ti.hidden = !t; }
    const su = racine.querySelector('[data-action-suite]');
    if (su) { const h = suiteHtml(a); if (su.getAttribute('data-h') !== h) { const d = new DOMParser().parseFromString('<body>' + h + '</body>', 'text/html'); su.replaceChildren(...Array.from(d.body.childNodes)); su.setAttribute('data-h', h); } }
    // 5.423 : la frise de la modification, sur place (remplacée seulement si une étape change ; le temps, chaque seconde).
    if (modifDe(a)) {
      const m = modifDe(a), h = M.friseHtml(m), fr = racine.querySelector('.modif .vu-frise');
      if (!fr || fr.outerHTML !== h) { const d = new DOMParser().parseFromString('<body>' + modifHtml(a) + '</body>', 'text/html'); const el = d.body.firstElementChild; const cur = racine.querySelector('.modif'); if (cur) cur.replaceWith(el); else if (su) su.after(el); }
      const tp = racine.querySelector('[data-modif-temps]'); if (tp) tp.textContent = tempsTxt(a, m);
    } else
    // 5.408 : la chaîne des étapes suit la paire en cours, sur place (remplacée seulement si elle change).
    { const h = chaineHtml(a), ch = racine.querySelector('.chaine'), cur = ch ? ch.outerHTML : '';
      if (h !== cur) { if (!h) { if (ch) ch.remove(); } else { const d = new DOMParser().parseFromString('<body>' + h + '</body>', 'text/html'); const el = d.body.firstElementChild;
        if (ch) ch.replaceWith(el); else if (su) su.after(el); } } }
    const sv = racine.querySelector('[data-action-suiv]');
    if (sv) { const h = suivantsHtml(a); if (sv.getAttribute('data-h') !== h) { const d = new DOMParser().parseFromString('<body>' + h + '</body>', 'text/html'); sv.replaceChildren(...Array.from(d.body.childNodes)); sv.setAttribute('data-h', h); sv.setAttribute('data-action-suivants', String((a.suivants || []).slice(0, 3).length)); sv.hidden = !h; } }
    { const ez = racine.querySelector('[data-essai-zone]'); if (ez) { const h = essaiHtml(a); if (ez.getAttribute('data-h') !== h) { const d = new DOMParser().parseFromString('<body>' + h + '</body>', 'text/html'); ez.replaceChildren(...Array.from(d.body.childNodes)); ez.setAttribute('data-h', h); } } }   // 5.433 : la phrase d'un nouvel essai, sur place
    const ar = racine.querySelector('[data-arreter]');
    if (ar) { const t = arretDemande ? T('c_arret_en_cours') : T('c_tout_arreter'); if (ar.textContent !== t) ar.textContent = t; }
    minuter();
  }
  function rendre() {
    accrocher();
    const a = action;
    // 5.410.5 : une vérification VUE sur la page pendant cet arrêt (sinon c'est un refus d'une requête, rien à faire ici).
    if (vintedParle === 'verification') iframeVue = true; else if (!a || !a.robot) iframeVue = false;
    if (!a) { hote.removeAttribute('data-cote-bas'); clearInterval(minuteur); minuteur = null; vue = ''; hote.style.display = 'none'; poser(''); deverrouiller(); gel(false); return; }
    hote.style.display = 'block';
    const lot = lotDe(a), neuf = lot !== lotVu;
    const nom = T(NOMS[a.sorte] || 'a_favoris');
    // Vinted parle, ou demande une vérification : l'écran se met de côté et le DIT (bandeau tenu ≥ 3 s).
    // 5.407 : après un arrêt « vérification » (la file en PAUSE, `a.robot`), une carte calme : ce qui est
    // parti, ce qui attend ; puis, vérification FAITE (plus de captcha dans la page ET Vinted a répondu
    // normalement depuis), « Vérification faite · Reprendre » — la MÊME file reprend sur SON toucher.
    if (vintedParle || a.verification || (vue === 'cote' && a.actif && Date.now() - asideA < 3000)) {
      deverrouiller(); gel(false);
      const quoi = vintedParle || (a.verification ? 'verification' : (racine.querySelector('[data-action-cote]') || { getAttribute: () => 'verification' }).getAttribute('data-action-cote'));
      let html;
      if (a.robot && quoi !== 'alerte') {
        const fait = Number(a.fait) || 0, total = Number(a.total) || 0, reste = Math.max(0, total - fait - (Number(a.pas) || 0));
        const faite = !vintedParle && verifFaite;
        // 5.410.5 : « fais-la sur la page » SEULEMENT quand une vérification est VRAIMENT affichée (iframe vue). Un refus
        // anti-robot d'une REQUÊTE (403 captcha, rien sur la page) ne demande aucun geste impossible : « le message n'est
        // pas parti, on attend » ; « Reprendre » reste SON toucher, quand Vinted a répondu normalement depuis.
        const sorteV = vintedParle === 'verification' ? 'page' : iframeVue ? 'faite' : 'refus';
        const phraseV = sorteV === 'page' ? T('a_verif_page') : sorteV === 'faite' ? (faite ? T('a_verif_faite_q') : T('a_verif_faite')) : T('a_refus_robot');
        html = `<div class="cote carte-verif vu-coque" role="status" data-action-cote="verification" data-action-robot="${faite ? 'faite' : 'attente'}" data-action-verif="${sorteV}"><div class="cv-t"><span class="vu-point" data-k="geste"></span><span class="t">${esc(phraseV)}</span></div>`
          + `<div class="cv-n">${esc(T('a_verif_compte', { n: fait, total, reste }))}</div>`
          + (faite ? `<div class="cv-n">${esc(T('a_doucement'))}</div><button class="vu-btn vu-plein" data-action-reprendre>${esc(T('a_reprendre'))}</button>${repriseErreur ? `<div class="cv-n">${esc(repriseErreur)}</div>` : ''}` : '') + '</div>';
      } else {
        const phrase = quoi === 'alerte' ? T('a_vinted_dit') : vintedParle === 'verification' ? T('a_verif_page') : T('a_verif');
        html = `<div class="cote vu-coque" role="status" data-action-cote="${esc(quoi)}"><span class="vu-point" data-k="geste"></span><span class="t">${esc(phrase)}</span></div>`;
      }
      if (vue !== 'cote') asideA = Date.now();
      if (vue !== 'cote' || racine.getAttribute('data-h') !== html) { vue = 'cote'; poser(html); racine.setAttribute('data-h', html); brancherReprise(); }
      // 5.410.5 : le bas de cette carte, pour que la pastille du panneau VRM (vrm-badge.js) se pose dessous, jamais dessus.
      try { const cc = racine.querySelector('.cote'); if (cc) hote.setAttribute('data-cote-bas', String(Math.round(cc.getBoundingClientRect().bottom))); } catch (_) {}
      if (vintedParle || a.verification) asideA = Date.now();
      else setTimeout(() => { if (vue === 'cote' && !vintedParle) rendre(); }, 3100 - (Date.now() - asideA));
      if (a.robot) suivreVerif();
      return;
    }
    racine.removeAttribute('data-h');
    hote.removeAttribute('data-cote-bas');   // 5.410.5 : plus de bandeau en haut
    // 5.423 (`modifavantapres`) : l'APRÈS — le bilan de la série reste jusqu'à SON « Fermer » (ou la prochaine annonce).
    if (bilanVu(a)) {
      if (fermeDebut && Number(a.modif.debut) === fermeDebut) { clearInterval(minuteur); minuteur = null; vue = 'ferme'; hote.style.display = 'none'; poser(''); deverrouiller(); gel(false); return; }
      rendreBilan(a);
      return;
    }
    if (!a.actif) {
      // La fin : un ✓ (ou « Arrêté »), puis l'écran s'efface ; tout est rendu à la page.
      clearInterval(minuteur); minuteur = null;
      deverrouiller(); gel(false);
      const arret = a.fin && a.fin.raison === 'arret';
      vue = 'fin';
      poser(`<div class="voile sort" data-action-fin="${esc((a.fin && a.fin.raison) || 'fini')}"><div class="boite vu-coque fini" role="status"><div class="coche" aria-hidden="true">${arret ? '■' : '✓'}</div><div class="quoi">${esc(arret ? T('a_arrete') : T('a_fini'))}</div><div class="suite">${esc(nom)} · ${esc(compte(a))}</div></div></div>`);
      return;
    }
    if (reduit) {
      deverrouiller(); gel(false);
      const t = `${nom} · ${compte(a)}`;
      if (vue === 'pastille' && !neuf) { const el = racine.querySelector('.pastille .t'); if (el && el.textContent !== t) el.textContent = t; return; }
      vue = 'pastille'; lotVu = lot;
      poser(`<div class="pastille vu-coque" role="status" data-action-pastille><span class="vu-point"></span><span class="t">${esc(t)}</span><button class="vu-btn vu-plein" data-agrandir>${esc(T('a_agrandir'))}</button></div>`);
      brancher();
      return;
    }
    verrouiller();
    if (vue === 'plein' && !neuf) { gel(true); majPlein(a); return; }
    // Le premier dessin de l'écran plein pour ce lot (ou au retour d'un bandeau / d'une pastille).
    const it = a.item || {};
    const titre = a.sorte === 'favoris' ? T('f_titre') : nom;
    const pc = a.total > 0 ? 100 * (Number(a.fait) || 0) / Number(a.total) : 0;
    const sv = suivantsHtml(a), sh = suiteHtml(a);
    const entree = neuf && lot !== lotAvant;
    racine.classList.toggle('anim', entree);
    if (entree) setTimeout(() => racine.classList.remove('anim'), 450);
    lotVu = lot; vue = 'plein'; if (modifDe(a)) lotModif = lot;
    poser(`<div class="voile" data-action-plein data-lot="${esc(lot)}" role="dialog" aria-modal="true" aria-label="${esc(titre)}"><div class="boite vu-coque vu-sur-coque">
        <div class="h"><span class="vu-point"></span><span>VRM · ${esc(T('a_en_direct'))}</span></div>
        <div class="corps">
          <div class="photo" data-action-item="${esc(it.id || '')}" data-cle="${esc(String(it.id || '') + '|' + (numDe(it) ? 'n' : ''))}">${photoHtml(it, numDe(it))}</div>
          <div class="droite">
            <div class="titre" data-action-quoi="${esc(a.sorte)}">${esc(titre)}</div>
            <div class="compteur n" data-action-fait="${Number(a.fait) || 0}" data-action-total="${Number(a.total) || 0}">${esc(compte(a))}</div>
            ${a.total > 0 ? U.barre(pc) : ''}
            <div class="ti" data-action-ti${it.titre ? '' : ' hidden'}>${esc(it.titre || '')}</div>
            <div class="suite" role="status" data-action-suite data-h="${esc(sh)}">${sh}</div>
            ${chaineHtml(a)}
          </div>
        </div>
        <div class="suiv" data-action-suiv data-action-suivants="${(a.suivants || []).slice(0, 3).length}" data-h="${esc(sv)}"${sv ? '' : ' hidden'}>${sv}</div>
        <div data-essai-zone>${essaiHtml(a)}</div>
        <div class="dit">${esc(T(a.formulaire ? 'a_bloque_form' : 'a_bloque'))}</div>
        ${pauseDitHtml()}
        <div class="gestes${a.formulaire ? ' seul' : ''}" data-action-formulaire="${a.formulaire ? '1' : ''}"><button class="vu-btn vu-plein" data-arreter>${esc(arretDemande ? T('c_arret_en_cours') : T('c_tout_arreter'))}</button>${pauseBoutonHtml()}${a.formulaire ? '' : `<button class="vu-btn vu-sec" data-reduire>${esc(T('a_reduire'))}</button>`}</div>
      </div></div>`);
    gel(true);
    try { const b = racine.querySelector('[data-arreter]'); if (b && !racine.contains(ombre.activeElement)) b.focus({ preventScroll: true }); } catch (_) {}
    minuter();
    brancher();
  }
  // 5.423 : le bilan (après une annonce, ou à la fin / à l'arrêt de la série) — Avant | Après, « Voir sur Vinted », et ce qui
  //    s'est arrêté (l'étape en ambre, la phrase, « Reprendre » sur SON toucher). Vinted n'est plus verrouillé : c'est fini ici.
  function rendreBilan(a) {
    clearInterval(minuteur); minuteur = null;
    deverrouiller(); gel(false);
    const arret = !a.actif && a.fin && a.fin.raison === 'arret';
    const encore = a.actif === true && (Number(a.total) || 0) > (Number(a.fait) || 0);
    const nom = T(NOMS[a.sorte] || 'a_republier');
    const b = a.bilan.filter((x) => x && x.sorte === a.sorte);
    const h = `<div class="voile" data-action-bilan="${esc(lotDe(a))}" data-fin="${arret ? 'arret' : encore ? 'suite' : 'fini'}" role="dialog" aria-modal="true" aria-label="${esc(nom)}"><div class="boite vu-coque vu-sur-coque">
        <div class="h"><span class="vu-point"${arret ? ' data-k="arrete"' : ''}></span><span>VRM · ${esc(nom)} · ${esc(compte(a))}</span></div>
        <div class="titre">${esc(arret ? T('a_arrete') : encore ? T('m3_suivi', { i: Number(a.fait) || 0, n: Number(a.total) || 0 }) : T('m3_suivi_fin'))}</div>
        ${M.bilanHtml(b, { domaine: location.hostname })}
        ${repriseModif ? `<div class="dit" role="status" data-modif-reprise-ko>${esc(repriseModif)}</div>` : ''}
        ${encore ? pauseDitHtml() : ''}
        <div class="gestes${encore ? '' : ' seul'}">${encore ? `<button class="vu-btn vu-plein" data-arreter>${esc(arretDemande ? T('c_arret_en_cours') : T('c_tout_arreter'))}</button>${pauseBoutonHtml()}<button class="vu-btn vu-sec" data-modif-fermer>${esc(T('m3_fermer'))}</button>` : `<button class="vu-btn vu-plein" data-modif-fermer>${esc(T('m3_fermer'))}</button>`}</div>
      </div></div>`;
    if (vue === 'bilan' && racine.getAttribute('data-hb') === h) return;
    vue = 'bilan'; poser(h); racine.setAttribute('data-hb', h);
    brancher();
    const f = racine.querySelector('[data-modif-fermer]');
    if (f) f.addEventListener('click', () => { fermeDebut = Number(a.modif.debut) || 0; try { sessionStorage.setItem('vrm_modif_ferme', String(fermeDebut)); } catch (_) {} repriseModif = ''; rendre(); });
    racine.querySelectorAll('[data-modif-reprendre]').forEach((x) => x.addEventListener('click', () => {
      x.disabled = true; repriseModif = '';
      try {
        chrome.runtime.sendMessage({ from: 'vrm-action', action: 'reprendreModif', id: x.getAttribute('data-modif-reprendre'), confirme: true }, (r) => {
          void chrome.runtime.lastError;
          if (!(r && r.ok)) { repriseModif = (r && r.raison) || T('m3_a_reprendre'); x.disabled = false; racine.removeAttribute('data-hb'); rendre(); }
          lire();
        });
      } catch (_) { x.disabled = false; }
    }));
    try { const btn = racine.querySelector('[data-modif-fermer]'); if (btn && !racine.contains(ombre.activeElement)) btn.focus({ preventScroll: true }); } catch (_) {}
  }
  // La vérification est-elle FAITE ? Plus de captcha dans la page, et une réponse normale de Vinted
  // rangée par l'extension APRÈS l'arrêt (`vrmFlux.vinted.okAt`). Lu toutes les 1,5 s ; rien ne repart seul.
  let verifFaite = false, suiviVerif = null, repriseErreur = '';
  function suivreVerif() {
    if (suiviVerif) return;
    suiviVerif = setInterval(() => {
      if (!action || !action.robot) { clearInterval(suiviVerif); suiviVerif = null; verifFaite = false; iframeVue = false; return; }
      let capte = false; try { capte = !!vrmVerifVisible(SEL_VERIF); } catch (_) {}
      try {
        chrome.storage.local.get('vrmFlux', (g) => {
          void chrome.runtime.lastError;
          const ok = Number(g && g.vrmFlux && g.vrmFlux.vinted && g.vrmFlux.vinted.okAt) || 0;
          const f = !capte && ok > Number(action && action.robotAt || 0);
          if (f !== verifFaite) { verifFaite = f; rendre(); }
        });
      } catch (_) {}
    }, 1500);
  }
  function brancherReprise() {
    const b = racine.querySelector('[data-action-reprendre]');
    if (!b) return;
    b.addEventListener('click', () => {
      b.disabled = true; repriseErreur = '';
      let capte = false; try { capte = !!vrmVerifVisible(SEL_VERIF); } catch (_) {}
      try {
        chrome.runtime.sendMessage({ from: 'vrm-action', action: 'reprendre', captcha: capte }, (r) => {
          void chrome.runtime.lastError;
          if (r && r.ok) { verifFaite = false; lire(); return; }
          repriseErreur = (r && r.raison) || ''; b.disabled = false; rendre();
        });
      } catch (_) { b.disabled = false; }
    });
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
    racine.querySelectorAll('[data-pause-apres]').forEach((b) => b.addEventListener('click', () => {
      if (pauseEnVol) return;
      pauseEnVol = true; b.disabled = true;
      try { chrome.runtime.sendMessage({ from: 'vrm-action', action: 'fileGeste', quoi: 'pause' }, (r) => { void chrome.runtime.lastError; if (!(r && r.ok)) pauseEnVol = false; lireFilePause(); racine.removeAttribute('data-hb'); rendre(); }); } catch (_) { pauseEnVol = false; }
    }));
    const r = racine.querySelector('[data-reduire]'); if (r) r.addEventListener('click', () => { reduit = true; rendre(); });
    const g = racine.querySelector('[data-agrandir]'); if (g) g.addEventListener('click', () => { reduit = false; vue = ''; rendre(); });
  }
  // Le N° de l'article en cours : la règle des numéros de la page (le compte de l'onglet seul).
  function chercherNum(id) {
    if (!id || numPour === id) return;
    numPour = id; num = '';
    try { chrome.runtime.sendMessage({ action: 'numeros', items: [id] }, (r) => { void chrome.runtime.lastError; const v = r && r.ok && r.items && r.items[id]; num = v ? String(v.numero || v.num || v) : ''; if (num && !/^[\w-]{1,12}$/.test(num)) num = ''; if (action) rendre(); }); } catch (_) {}
  }
  const FRAIS_MS = 3 * 60000;
  // Ce que dit un état (réponse du fond, ou relu dans chrome.storage.local quand le fond ne répond pas).
  let lotModif = '';
  function appliquer(a, sur) {
    const avant = action;
    // 5.423 : le bilan d'une modification de CE lot (vu dans cet onglet) prend la place, même après « Tout arrêter » ;
    //    il reste affiché jusqu'à « Fermer » ou jusqu'à la prochaine annonce qui démarre.
    if (a && a.modif && a.modif.fin && Array.isArray(a.bilan) && a.bilan.length && !(a.actif && a.enCours) && lotModif && lotDe(a) === lotModif) { action = a; finA = 0; nulA = 0; rendre(); return; }
    if (vue === 'bilan' && action && !(a && a.actif && a.enCours)) return;
    if (a && a.actif && a.enCours && a.modif && fermeDebut && Number(a.modif.debut) !== fermeDebut) fermeDebut = 0;
    // « Tout arrêter » vient d'être touché : un état lu AVANT l'arrêt ne rallume pas l'écran.
    if (a && a.actif && Date.now() - arretA < 5000) return;
    if (a && a.actif) { action = a; finA = 0; nulA = 0; }
    else if (a && !a.actif && avant && avant.actif && a.fin) { action = a; finA = Date.now(); nulA = 0; }   // la fin, une fois
    else if (finA && Date.now() - finA < 1600) { /* le ✓ reste un instant */ }
    else if (avant && avant.actif && !(a && a.fin)) {
      // « Rien » sans fin pendant une action : il faut le relire à 1,5 s pour éteindre (jamais sur une seule lecture).
      if (!nulA) { nulA = Date.now(); setTimeout(lire, 1600); return; }
      if (Date.now() - nulA < 1400) return;
      action = null; reduit = false; nulA = 0;
    } else { action = null; reduit = false; }
    if (action && action.item && action.item.id) chercherNum(String(action.item.id));
    rendre();
    if (finA) setTimeout(() => { if (finA && Date.now() - finA >= 1500) { finA = 0; action = null; reduit = false; lotVu = ''; rendre(); } }, 1700);
  }
  // Le fond ne répond pas (endormi, en réveil) : « pas su » ≠ « fini » — l'état de CE lot se relit
  // dans chrome.storage.local (même compte que celui que le fond a vérifié), sinon rien ne change.
  function relireLocal() {
    if (!action) return;
    try {
      chrome.storage.local.get('vrmActionEnCours', (g) => {
        void chrome.runtime.lastError;
        const a = g && g.vrmActionEnCours;
        if (!a || a.v !== 1 || String(a.uid) !== String(action.uid)) return;
        const frais = Date.now() - Number(a.maj || 0) < FRAIS_MS;
        appliquer(Object.assign({}, a, { actif: a.actif === true && frais }), true);
      });
    } catch (_) {}
  }
  function lire() {
    if (!vivant()) { action = null; rendre(); return; }
    try {
      chrome.runtime.sendMessage({ from: 'vrm-action', action: 'etat' }, (r) => {
        const err = (() => { try { return chrome.runtime.lastError; } catch (_) { return null; } })();
        if (err || !r || r.ok !== true) { relireLocal(); return; }
        appliquer(r.action || null, false);
      });
    } catch (_) { relireLocal(); }
  }
  try { chrome.storage.onChanged.addListener((ch, zone) => { if (zone === 'local' && ch.vrmActionEnCours) lire(); }); } catch (_) {}
  // Vinted qui parle se regarde en continu (la présence seulement) ; le document réécrit par Vinted
  // (route SPA, hydratation) ⇒ le MÊME hôte se raccroche, le verrou se repose.
  try {
    const mo = new MutationObserver(() => {
      if (!hote.isConnected) accrocher();
      if (!action) return;
      if (plein() && document.body && verrou && document.body.style.getPropertyValue('overflow') !== 'hidden') verrouiller();
      const v = vintedDit(); if (v !== vintedParle) { vintedParle = v; rendre(); }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
  } catch (_) {}
  // Une nouvelle route de Vinted (pushState, retour) : rien n'est redessiné, l'hôte reste.
  let url = location.href;
  setInterval(() => { if (location.href !== url) { url = location.href; accrocher(); if (plein()) verrouiller(); } }, 250);
  window.addEventListener('popstate', () => { accrocher(); if (plein()) verrouiller(); });
  setInterval(() => { if (action && action.actif) lire(); if (plein()) gel(true); }, 15000);   // un état qui n'est plus rafraîchi s'éteint (fond mort)
  // Le voile de content.js (rechargement pendant une action) ne survit jamais seul : 4 s au plus sans confirmation.
  setTimeout(() => { if (vue !== 'plein') gel(false); }, 4000);
  lire(); lireFilePause();
  globalThis.__vrmActionLire = lire;
})();
