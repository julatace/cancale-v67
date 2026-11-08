// (8 nov., démarrage léger) LE MORCEAU DE L'APP DEMANDÉ TOUT DE SUITE.
// Sans ce fichier, le téléphone attend que src/main.jsx soit téléchargé, compilé
// et exécuté avant de DEMANDER le morceau App (≈ 300 ms à 4G sur un iPhone moyen,
// mesuré au banc : la requête partait à 470 ms au lieu de 150 ms). Ici, dès la
// lecture d'index.html, si l'app va s'ouvrir (même règle que `versApp` de
// src/main.jsx), on pose `modulepreload` (le JS) et `preload` (sa feuille).
// Rien n'est exécuté : le navigateur télécharge seulement plus tôt ce que
// main.jsx demandera de toute façon. Un visiteur de la page d'accueil ne
// télécharge rien de plus.
// Les noms des fichiers (empreintes du build) sont posés par vite.config.js
// (`prechargerApp`) dans `data-js` / `data-css` de la balise qui charge ce fichier.
// ⚠️ Fichier à part, pas un script en ligne : la politique de sécurité du contenu
// (vercel.json) refuse tout script en ligne.
// ⚠️ La règle « l'app va s'ouvrir » est celle de src/main.jsx (`aUneSession`,
// `veutLApp`, `?film`) : les garder identiques.
try {
  var s = document.currentScript;
  var q = location.search || '', h = location.hash || '';
  var session = !!localStorage.getItem('vrm_session') || localStorage.getItem('vrm_acces_direct') === '1';
  var lien = /[?&](connexion|inscription|tab|code|error|error_description|type|lier-extension|confirmer-adresse)(=|&|$)/.test(q) || /(access_token|error|type)=/.test(h);
  var film = /[?&]film(=|&|$)/.test(q);
  if (s && !film && (session || lien)) {
    var poser = function (rel, href, as) {
      if (!href) return;
      var l = document.createElement('link');
      l.rel = rel; l.href = href;
      if (as) l.as = as;
      // même mode que le chargeur de Vite (crossOrigin = '') : sinon le navigateur retélécharge
      l.crossOrigin = '';
      document.head.appendChild(l);
    };
    (s.getAttribute('data-js') || '').split(',').forEach(function (u) { poser('modulepreload', u); });
    (s.getAttribute('data-css') || '').split(',').forEach(function (u) { poser('preload', u, 'style'); });
  }
} catch (e) { /* rien : main.jsx demandera le morceau comme avant */ }
