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
  // (14 nov., idée 150) « Automatique (le soir) » : du coucher au lever du soleil — COPIE de `soleil` et
  // `estLeSoir` de src/apparence.js (même table de villes, même formule) ; fuseau inconnu ⇒ 20 h → 7 h.
  var VILLES = { 'Europe/Paris': [48.86, 2.35], 'Europe/Brussels': [50.85, 4.35], 'Europe/Luxembourg': [49.61, 6.13], 'Europe/Monaco': [43.74, 7.42],
    'Europe/Zurich': [47.37, 8.54], 'Europe/Madrid': [40.42, -3.70], 'Europe/Lisbon': [38.72, -9.14], 'Europe/Rome': [41.90, 12.50],
    'Europe/Berlin': [52.52, 13.40], 'Europe/Vienna': [48.21, 16.37], 'Europe/Amsterdam': [52.37, 4.90], 'Europe/London': [51.51, -0.13],
    'Europe/Dublin': [53.35, -6.26], 'Atlantic/Canary': [28.12, -15.43], 'Indian/Reunion': [-20.88, 55.45], 'America/Martinique': [14.61, -61.07],
    'America/Guadeloupe': [16.24, -61.53], 'America/Montreal': [45.50, -73.57], 'America/Toronto': [43.65, -79.38] };
  function soleil(d, fuseau) {
    var v = VILLES[fuseau]; if (!v) return null;
    var debut = new Date(d.getFullYear(), 0, 1);
    var n = Math.floor((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - debut) / 86400000) + 1;
    var g = 2 * Math.PI / 365 * (n - 1 + 0.5);
    var eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    var decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    var lat = v[0] * Math.PI / 180;
    var x = Math.cos(90.833 * Math.PI / 180) / (Math.cos(lat) * Math.cos(decl)) - Math.tan(lat) * Math.tan(decl);
    if (!(x >= -1 && x <= 1)) return null;
    var ha = Math.acos(x) * 180 / Math.PI;
    var decalage = -d.getTimezoneOffset();
    return { lever: 720 - 4 * (v[1] + ha) - eq + decalage, coucher: 720 - 4 * (v[1] - ha) - eq + decalage };
  }
  function leSoir(d, fuseau) {
    var s = soleil(d, fuseau);
    if (s) { var m = d.getHours() * 60 + d.getMinutes(); return m >= s.coucher || m < s.lever; }
    var heure = d.getHours();
    return heure >= 20 || heure < 7;
  }
  function sombreAuDemarrage(mode, ancien, date, systeme, fuseau) {
    if (mode !== 'clair' && mode !== 'sombre' && mode !== 'auto' && mode !== 'soir') mode = ancien === true ? 'sombre' : 'clair';
    if (mode === 'sombre') return true;
    if (mode === 'auto') return systeme === true;
    if (mode === 'soir') return leSoir(date, fuseau);
    return false;
  }
  window.__vrmSombreAuDemarrage = sombreAuDemarrage;
  try {
    var sys = false;
    try { sys = !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches); } catch (e) {}
    var fz = ''; try { fz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
    var d = sombreAuDemarrage(lire('vrm_apparence'), lire('vinted_dark'), new Date(), sys, fz);
    document.documentElement.setAttribute('data-theme', d ? 'dark' : 'light');
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', d ? '#15263D' : '#EEF6FD');   // (14 nov., Studio) le haut de la lumière
    // (14 nov., idée 149) La DENSITÉ des listes de CET appareil, posée avant le premier rendu (aucun saut).
    try { var dz = localStorage.getItem('vrm_densite'); dz = dz ? JSON.parse(dz) : null; if (dz === 'serree' || dz === 'aeree') document.documentElement.setAttribute('data-densite', dz); } catch (e) {}
  } catch (e) { document.documentElement.setAttribute('data-theme', 'light'); }
})();
