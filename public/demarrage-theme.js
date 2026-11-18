// Thème AVANT le premier rendu (sinon l'app s'affiche en clair puis bascule).
// Lit les MÊMES réglages que React (`vrm_apparence`, sinon `vinted_dark`) et
// estampille la racine.
// ⚠️ Fichier à part, et non plus script en ligne d'index.html : la politique
// de sécurité du contenu (vercel.json) n'autorise aucun script en ligne.
// ⚠️ (8 nov.) La règle des modes « Automatique » et « Le soir » est une COPIE de
// `src/apparence.js` (`apparenceDe` + `sombreEffectif`) : `scripts/audit-apparence.cjs`
// exécute les deux sur les mêmes entrées et exige le même verdict.
(function () {
  // Le haut du dégradé de l'écran de démarrage (clair, bleu-nuit) : `--sv-haut` de src/design/studio-verre.css
  // (16 nov., intégration : l'écran de chargement reprend les valeurs FINALES du verre, plus la proposition 9).
  var BOOT_CLAIR = '#2563A8', BOOT_NUIT = '#133460';
  function lire(k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function sombreAuDemarrage(mode, ancien, heure, systeme) {
    if (mode !== 'clair' && mode !== 'sombre' && mode !== 'auto' && mode !== 'soir') mode = ancien === true ? 'sombre' : 'clair';
    if (mode === 'sombre') return true;
    if (mode === 'auto') return systeme === true;
    if (mode === 'soir') return heure >= 19 || heure < 7;
    return false;
  }
  window.__vrmSombreAuDemarrage = sombreAuDemarrage;
  try {
    var sys = false;
    try { sys = !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches); } catch (e) {}
    var d = sombreAuDemarrage(lire('vrm_apparence'), lire('vinted_dark'), new Date().getHours(), sys);
    document.documentElement.setAttribute('data-theme', d ? 'dark' : 'light');
    // (15 nov., chantier « ouverture ») PENDANT LE DÉMARRAGE, le haut du dégradé « Verre dépoli » de l'écran de
    // chargement (index.html, `--vrm-verre-fond` / `-nuit`) : la barre d'état est déjà bleue sous l'icône, puis
    // l'app pose la sienne (src/App.jsx, `t.haut`). `data-vrm-boot` : le fond du document est ce bleu tant que
    // l'écran de démarrage est là (retiré par src/demarrage.js) — rien de blanc entre deux chargements.
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', d ? BOOT_NUIT : BOOT_CLAIR);
    document.documentElement.setAttribute('data-vrm-boot', '');
    // (18 nov.) Le style « Apple » (src/designV2/style.js, `vrm_style`) : posé avant le premier rendu, le fond groupé dès l'ouverture.
    try { if (localStorage.getItem('vrm_style') === 'apple') { document.documentElement.setAttribute('data-theme-style', 'apple'); if (m) m.setAttribute('content', d ? '#000000' : '#F2F2F7'); } } catch (e) {}
  } catch (e) { document.documentElement.setAttribute('data-theme', 'light'); }
  // « Recharger » de l'écran de démarrage (au-delà de 8 s) : avant tout JavaScript de l'app (c'est quand
  // elle ne vient pas qu'on le touche). Il OUBLIE la coquille gardée par le service worker (la page `/`,
  // jamais les fichiers ni les réserves du hors ligne) puis relit : une coquille d'une ancienne version
  // ne peut pas le ramener sur elle-même. Même règle que src/chargementSur.js (`oublierCoquille`).
  try {
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('[data-vrm-boot-recharger]') : null;
      if (!a) return;
      e.preventDefault();
      var relire = function () { try { location.reload(); } catch (x) { location.href = '/'; } };
      try {
        if (!window.caches || navigator.onLine === false) return relire();
        var fini = false, fin = function () { if (!fini) { fini = true; relire(); } };
        setTimeout(fin, 1500);
        caches.keys().then(function (ks) {
          return Promise.all(ks.filter(function (k) { return /^vrm-shell/.test(k); }).map(function (k) {
            return caches.open(k).then(function (c) { return Promise.all([c.delete('/'), c.delete('/index.html')]); });
          }));
        }).then(fin, fin);
      } catch (x) { relire(); }
    });
  } catch (e) {}
})();
