import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

// ⚠️ DERNIER FILET : même si l'application entière tombe (erreur AVANT que le
// garde-fou d'écran soit monté), on ne laisse jamais une page blanche. Une page
// blanche ne dit rien, ne propose rien, et donne l'impression que tout est
// perdu — alors que les données sont intactes dans le nuage.
class DernierFilet extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) { try { console.error('[VRM] application en erreur', err, info && info.componentStack); } catch (_) {} }
  render() {
    if (!this.state.err) return this.props.children;
    const msg = String((this.state.err && this.state.err.message) || this.state.err);
    const btn = { border: '1px solid #d7dde3', background: 'transparent', borderRadius: 10, padding: '10px 15px',
      fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 22,
        fontFamily: 'Inter, system-ui, sans-serif', background: '#f6f7f9', color: '#14181d' }}>
        <div style={{ maxWidth: 420, width: '100%', background: '#fff', border: '1px solid #e6e9ee', borderRadius: 18, padding: '20px 18px' }}>
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>L'application n'a pas pu démarrer</div>
          <div style={{ fontSize: 13, color: '#5b6675', lineHeight: 1.5, marginBottom: 12 }}>
            Tes données sont intactes (elles sont dans le nuage, pas dans cette page). Recharge — si l'erreur revient,
            « Repartir propre » efface seulement les réglages de CE navigateur, puis retélécharge tout depuis ton compte.
          </div>
          <div style={{ fontSize: 11.5, fontFamily: 'ui-monospace, monospace', background: '#f6f7f9', border: '1px solid #e6e9ee',
            borderRadius: 10, padding: '9px 11px', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <button style={{ ...btn, border: 'none', background: '#14181d', color: '#fff' }} onClick={() => location.reload()}>Recharger</button>
            <button style={btn} onClick={() => { try { navigator.clipboard.writeText(msg); } catch (_) {} }}>📋 Copier l'erreur</button>
            <button style={btn} onClick={() => {
              // On ne touche QU'AUX clés de l'app, et on garde la session : le
              // nuage est la source de vérité, tout revient au rechargement.
              try { Object.keys(localStorage).forEach(k => { if (/^(vinted_|vrm_)/.test(k) && k !== 'vrm_session') localStorage.removeItem(k); }); } catch (_) {}
              location.reload();
            }}>Repartir propre</button>
          </div>
        </div>
      </div>
    );
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><DernierFilet><App /></DernierFilet></React.StrictMode>
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
