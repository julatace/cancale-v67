// Thème AVANT le premier rendu (sinon l'app s'affiche en clair puis bascule).
// Lit les MÊMES réglages que React (`vrm_apparence`, sinon `vinted_dark`) et
// estampille la racine.
// ⚠️ Fichier à part, et non plus script en ligne d'index.html : la politique
// de sécurité du contenu (vercel.json) n'autorise aucun script en ligne.
// ⚠️ (8 nov.) La règle des modes « Automatique » et « Le soir » est une COPIE de
// `src/apparence.js` (`apparenceDe` + `sombreEffectif`) : `scripts/audit-apparence.cjs`
// exécute les deux sur les mêmes entrées et exige le même verdict.
(function () {
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
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', d ? '#000000' : '#F2F2F7');
  } catch (e) { document.documentElement.setAttribute('data-theme', 'light'); }
})();
