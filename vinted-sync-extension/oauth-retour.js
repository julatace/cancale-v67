// oauth-retour.js — 5.328 (8 nov.) : le RETOUR de « Continuer avec Google /
// Discord » lancé DANS l'extension (voir `oauthDepart`, background.js).
// Tourne sur vrm.center au tout début du chargement (avant l'app, qui retire
// `?code=` de l'adresse). Il ne fait que REMETTRE le code au service worker,
// qui ne l'échange que s'il a lui-même lancé une connexion il y a moins de
// 10 minutes (son vérificateur PKCE : un code sans lui ne vaut rien).
//   · page de retour de l'extension (`/extension-retour.html`) : toujours ;
//   · page d'accueil (repli de Supabase si l'adresse de retour n'est pas
//     encore autorisée) : seulement si la page n'a PAS son propre départ de
//     connexion en cours (`vrm_pkce`, `vrm_oauth_liaison`) — une connexion de
//     l'app n'est jamais touchée.
// Aucun jeton ne passe par ici ; rien n'est gardé ; rien n'est lu d'autre.
(function () {
  'use strict';
  let rt = null;
  try { rt = (typeof chrome !== 'undefined' && chrome && chrome.runtime) || null; } catch (_) { rt = null; }
  if (!rt || !rt.id) return;
  const q = new URLSearchParams(location.search || '');
  const code = q.get('code'), error = q.get('error');
  const fixe = /^\/extension-retour\.html$/.test(location.pathname);
  if (!fixe && !code) return;
  if (!fixe) {
    if (location.pathname !== '/' || !code) return;
    let propre = false;
    try { propre = !!(sessionStorage.getItem('vrm_pkce') || localStorage.getItem('vrm_pkce') || sessionStorage.getItem('vrm_oauth_liaison') || localStorage.getItem('vrm_oauth_liaison')); } catch (_) { propre = true; }
    if (propre) return;
  }
  const dire = (t) => {
    if (!fixe) return;
    const ecrire = () => { const el = document.getElementById('etat'); if (el) el.textContent = t; };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ecrire, { once: true }); else ecrire();
  };
  if (fixe && !code && !error) { dire('Rien à faire ici : cette page sert seulement au retour de la connexion de l’extension VRM.'); return; }
  try {
    rt.sendMessage({ from: 'vrm-oauth-retour', action: 'oauthRetour', fixe, code: code || '', error: error || '', error_code: q.get('error_code') || '', error_description: q.get('error_description') || '' }, (r) => {
      try { void rt.lastError; } catch (_) {}
      // 5.330 : parti du MÊME onglet (Orion, pas de petite fenêtre) ⇒ on y revient,
      // sur la page Vinted d'où l'on est parti ; la carte y dit le résultat.
      // Seulement une page https d'un site de la carte (le service worker l'a déjà
      // vérifiée ; on revérifie ici), `replace` : « Retour » ne ramène pas ici.
      const retour = r && typeof r.retour === 'string' ? r.retour : '';
      if (retour && /^https:\/\/(?:[a-z0-9-]+\.)*(?:vinted\.(?:fr|com|it|de)|leboncoin\.fr|ebay\.fr|vestiairecollective\.com)\//i.test(retour)) {
        dire(r.ok ? `C’est fait${r.email ? ' : connecté à VRM avec ' + r.email : ''}. Retour sur ta page…` : (r.message || 'Retour sur ta page…'));
        try { location.replace(retour); } catch (_) {}
        return;
      }
      if (r && r.ok) dire(`C’est fait : l’extension VRM est connectée${r.email ? ' à ' + r.email : ''}. Tu peux fermer cet onglet.`);
      else if (r && r.message) dire(r.message);
      else if (fixe) dire('L’extension n’a pas répondu. Reviens sur Vinted, touche le logo VRM et recommence.');
    });
  } catch (_) { dire('L’extension n’a pas répondu. Reviens sur Vinted, touche le logo VRM et recommence.'); }
})();
