import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>
);

// PWA : enregistre le service worker (app installable + consultable hors-ligne).
// Best-effort — si le navigateur ne le supporte pas, l'app fonctionne pareil.
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !hadController) return; // pas de reload au tout premier install
    reloading = true; window.location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      try { reg.update(); } catch (_) {}
      // ⚠️ RAFRAÎCHIR L'ABONNEMENT PUSH À CHAQUE OUVERTURE. Le jeton d'abonnement
      // tourne (surtout iOS) et l'ancien devient muet → « je ne reçois plus de
      // notif ». Si la permission est accordée : on récupère l'abonnement
      // courant (ou on le recrée s'il a disparu) et on renvoie le jeton FRAIS au
      // serveur. Silencieux, ne redemande jamais la permission.
      try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          const VAPID = 'BBQbRWE86gwZClx3buB8J2JJrd-Kg7aYR-HJqev811KmNnTxLxOAwxFhwF8MfvzHp1-K4tnmjFfQZxVaoB7psi8';
          const key = (b64) => { const pad = '='.repeat((4 - (b64.length % 4)) % 4); const s = (b64 + pad).replace(/-/g, '+').replace(/_/g, '/'); const raw = atob(s); const a = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) a[i] = raw.charCodeAt(i); return a; };
          reg.pushManager.getSubscription().then((sub) => {
            const send = (s) => fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'subscribe', sub: s.toJSON() }) }).catch(() => {});
            if (sub) return send(sub);
            return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key(VAPID) }).then(send).catch(() => {});
          }).catch(() => {});
        }
      } catch (_) {}
    }).catch(() => {});
  });
}

// AUTO-MISE À JOUR : une app installée sur l'écran d'accueil « gèle » souvent sa
// page au lieu de la recharger quand on la rouvre → on continue de voir une
// vieille version (« ça n'a rien changé »). On compare donc l'empreinte du build
// (le nom du fichier JS haché, qui change à chaque déploiement) : dès qu'un
// nouveau déploiement est détecté, on recharge tout seul. La requête porte un
// paramètre anti-cache pour contourner le service worker.
(function autoUpdate() {
  // Empreinte du build RÉELLEMENT chargé dans cette page (le <script> du bundle).
  // C'est la référence : si le serveur en a une autre, la page tourne en vieux.
  const loadedFingerprint = () => {
    try {
      const s = document.querySelector('script[src*="assets/index-"]');
      const src = s && (s.getAttribute('src') || '');
      const m = src && src.match(/assets\/index-[A-Za-z0-9_-]+\.js/);
      return m ? m[0] : null;
    } catch (_) { return null; }
  };
  let current = loadedFingerprint();
  let reloading = false;
  const fingerprint = async () => {
    try {
      const r = await fetch('/?_v=' + Date.now(), { cache: 'no-store' });
      const t = await r.text();
      const m = t.match(/assets\/index-[A-Za-z0-9_-]+\.js/);
      return m ? m[0] : null;
    } catch (_) { return null; }
  };
  const check = async () => {
    if (reloading) return;
    const fp = await fingerprint();
    if (!fp) return;
    if (current == null) { current = fp; return; } // page sans empreinte connue : on s'aligne
    if (fp !== current) { reloading = true; window.location.reload(); }
  };
  window.addEventListener('load', () => {
    check();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
    // pageshow (persisted) = page « gelée » restaurée (iOS installé) → on revérifie.
    window.addEventListener('pageshow', (e) => { if (e.persisted) check(); });
    window.addEventListener('focus', () => check());
    setInterval(check, 60 * 1000);
  });
})();

// Mise à jour MANUELLE forcée : vide tous les caches, désenregistre le service
// worker, puis recharge. Bouton « Forcer la mise à jour » dans le garage.
window.__vrmForceUpdate = async () => {
  try { const ks = await caches.keys(); await Promise.all(ks.map((k) => caches.delete(k))); } catch (_) {}
  try { const rs = await navigator.serviceWorker.getRegistrations(); await Promise.all(rs.map((r) => r.unregister())); } catch (_) {}
  location.reload();
};
