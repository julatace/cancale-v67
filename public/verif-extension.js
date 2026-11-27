// ════════════════════════════════════════════════════════════════════════════
//  verif-extension.js — LE JETON ANTI-ROBOT DE LA CONNEXION DE L'EXTENSION (5.456, 27 nov.)
//
//  Mesuré le 27 nov. sur le vrai Supabase : `POST /auth/v1/token?grant_type=password` et `POST /auth/v1/otp` répondent
//  400 `captcha_failed` sans jeton Turnstile. L'extension n'en envoyait aucun : ni le mot de passe ni le code ne
//  pouvaient marcher. Cette page (vrm.center, la clé de site de VRM) est posée en cadre dans le formulaire de
//  l'extension ; elle rend le jeton, à usage unique, à la page qui l'a posée, et rien d'autre.
//
//  Contrat (postMessage, toujours avec l'origine exacte du parent, jamais '*') :
//    · adresse : /verif-extension.html?parent=<origine>&n=<nonce>&theme=clair|sombre
//      `parent` : l'origine d'une page d'extension (chrome-extension://…, moz-extension://…, safari-web-extension://…,
//      webkit-extension://…) ou d'un site où vit le panneau (Vinted, Leboncoin, Vestiaire). Autre chose ⇒ rien n'est fait.
//    · vers le parent : { __vrmVerif: 'jeton', n, jeton } · { __vrmVerif: 'etat', n, etat: charge|interactif|expire|erreur }
//      · { __vrmVerif: 'hauteur', n, h }
//    · du parent : { __vrmVerif: 'reset', n } (après chaque usage : un jeton ne sert qu'une fois).
//  ⚠️ La clé de SITE est publique (elle est dans l'app servie, `VITE_TURNSTILE_SITE_KEY`). Si elle change dans Vercel,
//     elle change ICI aussi (lue dans l'app servie le 27 nov. : `VITE_TURNSTILE_SITE_KEY:"0x4AAAAAAGNgOaYgd8NsqNB9"`).
// ════════════════════════════════════════════════════════════════════════════
(function () {
  var CLE_SITE = '0x4AAAAAAGNgOaYgd8NsqNB9';
  var PARENT_PERMIS = /^(?:(?:chrome|moz|safari-web|webkit)-extension:\/\/[A-Za-z0-9._-]{1,128}|https:\/\/(?:[a-z0-9-]+\.)*(?:vinted\.(?:fr|com|it|de|es|be|nl|lu|at|pt|pl|cz|lt|co\.uk)|leboncoin\.fr|vestiairecollective\.com))$/;
  var q = new URLSearchParams(location.search);
  var parent = String(q.get('parent') || '');
  var n = String(q.get('n') || '').slice(0, 64);
  var theme = q.get('theme') === 'sombre' ? 'dark' : q.get('theme') === 'clair' ? 'light' : 'auto';
  var msg = document.getElementById('msg');
  if (!PARENT_PERMIS.test(parent) || !/^[A-Za-z0-9_-]{8,64}$/.test(n) || window.parent === window) return;
  function dire(d) { try { d.n = n; window.parent.postMessage(d, parent); } catch (_) {} }
  function hauteur() { dire({ __vrmVerif: 'hauteur', h: Math.ceil(document.body.getBoundingClientRect().height) }); }
  try { new ResizeObserver(hauteur).observe(document.body); } catch (_) { setInterval(hauteur, 1000); }
  var id = null;
  window.__vrmVerifPret = function () {
    try {
      id = window.turnstile.render('#w', {
        sitekey: CLE_SITE, theme: theme, size: 'flexible', language: (navigator.language || 'fr').slice(0, 2), 'refresh-expired': 'auto',
        callback: function (j) { msg.textContent = ''; dire({ __vrmVerif: 'jeton', jeton: String(j || '') }); },
        'before-interactive-callback': function () { dire({ __vrmVerif: 'etat', etat: 'interactif' }); },
        'expired-callback': function () { dire({ __vrmVerif: 'etat', etat: 'expire' }); },
        'timeout-callback': function () { dire({ __vrmVerif: 'etat', etat: 'interactif' }); },
        'error-callback': function (c) { msg.textContent = 'La vérification ne se charge pas sur ce réseau.'; dire({ __vrmVerif: 'etat', etat: 'erreur', code: String(c || '') }); return true; },
      });
      dire({ __vrmVerif: 'etat', etat: 'charge' });
    } catch (_) { dire({ __vrmVerif: 'etat', etat: 'erreur', code: 'render' }); }
  };
  window.addEventListener('message', function (ev) {
    if (ev.origin !== parent || ev.source !== window.parent) return;
    var d = ev.data;
    if (!d || d.__vrmVerif !== 'reset' || d.n !== n) return;
    try { if (id != null && window.turnstile) { window.turnstile.reset(id); dire({ __vrmVerif: 'etat', etat: 'charge' }); } } catch (_) {}
  });
  var s = document.createElement('script');
  s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__vrmVerifPret';
  s.async = true;
  s.onerror = function () { msg.textContent = 'La vérification ne se charge pas sur ce réseau.'; dire({ __vrmVerif: 'etat', etat: 'erreur', code: 'reseau' }); };
  document.head.appendChild(s);
  setTimeout(function () { if (id == null) dire({ __vrmVerif: 'etat', etat: 'erreur', code: 'delai' }); }, 15000);
})();
