// Les deux gestes de la fenêtre du REÇU D'ACHAT (openReceipt, src/App.jsx).
// ⚠️ (22 oct., revue) ILS VIVENT DANS LA FENÊTRE, PLUS DANS L'ONGLET DE VRM.
// La fenêtre hérite de la politique de sécurité du contenu de l'app : aucun
// `onclick` en ligne. Branchés depuis l'onglet de VRM, ils mouraient avec lui —
// et l'app recharge cet onglet toute seule (vérification de version chaque
// minute, nouveau service worker après chaque déploiement) : « Imprimer » et
// « Fermer » ne faisaient alors plus RIEN, sans un mot. Un fichier de même
// origine (script-src 'self'), chargé par la fenêtre elle-même, ne dépend de
// personne. `__vrmRecuBoutons` dit à l'onglet de VRM que c'est fait (il ne
// branche les siens qu'en secours, si ce fichier n'a pas pu se charger).
(function () {
  try {
    var fermer = document.getElementById('vrm-recu-fermer');
    var imprimer = document.getElementById('vrm-recu-imprimer');
    if (fermer) fermer.addEventListener('click', function () {
      try { window.close(); } catch (e) {}
      setTimeout(function () {
        try { if (window.closed) return; if (history.length > 1) history.back(); else location.href = '/?tab=cat_achats'; } catch (e) {}
      }, 120);
    });
    if (imprimer) imprimer.addEventListener('click', function () { try { window.focus(); window.print(); } catch (e) {} });
    window.__vrmRecuBoutons = !!(fermer && imprimer);
  } catch (e) {}
})();
