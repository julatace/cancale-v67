// (6 nov.) LE MODE EXEMPLE s'installe EN PREMIER, avant tout module de l'app : s'il
// est demandé par cet onglet, le stockage et la base deviennent des copies en
// mémoire (src/modeExemple.js) — rien de l'exemple n'est écrit nulle part.
import './modeExemple.js';
// (8 nov.) Les 30 dernières requêtes de la page (famille, code, durée — jamais une
// adresse ni un contenu), pour « Signaler un problème » (src/lecturesRecentes.js).
import { installerJournalLectures } from './lecturesRecentes.js';
installerJournalLectures();
import { cleVapid, abonnementAJour } from './vapid.js';
import React from 'react';
import ReactDOM from 'react-dom/client';
import Accueil from './Accueil.jsx';
import { DemarrageVRM } from './Chargement.jsx';
import { suivreDemarrage } from './demarrage.js';
import { ecouterPlantages, ecouterViolationsCsp, noterPlantage, compterMorceauPerime } from './plantages.js';
// Le journal des plantages écoute dès le démarrage : une erreur AVANT que l'app
// soit montée est justement celle qu'aucun écran ne montre (src/plantages.js).
// ⚠️ (22 oct., revue) L'ÉCRAN SE LIT DANS L'HISTORIQUE : l'app retire `?tab=` de
// l'adresse dès qu'elle l'a lu, et chaque écran pose `vrmTab` dans
// `history.state` (le bouton « retour », 18 oct.). Lu dans l'adresse, le champ
// `ecran` du journal restait vide — on ne savait pas quel écran avait parlé.
const ecranCourant = () => {
  try { const st = window.history.state; if (st && st.vrmTab) return String(st.vrmTab) + (st.vrmSub ? ':' + st.vrmSub : ''); } catch (_) {}
  try { return new URLSearchParams(location.search).get('tab') || ''; } catch (_) { return ''; }
};
ecouterPlantages(() => ({ ecran: ecranCourant(),
  version: typeof __BUILD__ !== 'undefined' ? String(__BUILD__) : '' }));
// Et les violations de la politique de sécurité du contenu (Report-Only) : le
// même journal, pour savoir sur SES appareils si elle peut passer en vigueur.
ecouterViolationsCsp(() => ({ ecran: ecranCourant(),
  version: typeof __BUILD__ !== 'undefined' ? String(__BUILD__) : '' }));
// ⚠️ APRÈS UN DÉPLOIEMENT, UN ONGLET RESTÉ OUVERT DEMANDE DES MORCEAUX QUI
// N'EXISTENT PLUS (mesuré le 15 octobre dans le journal des plantages : « Unable
// to preload CSS for /assets/App-….css »). Les fichiers sont nommés par leur
// contenu : l'ancienne page vise l'ancien nom, le serveur ne l'a plus, et l'écran
// tombe. Le seul remède est de relire la page (elle vise alors les bons noms).
// UNE fois par minute au plus : si le rechargement ne règle rien (vraie panne de
// réseau), l'erreur repart telle quelle et le dernier filet l'affiche — jamais
// une boucle de rechargements.
// Retour de « Se connecter avec Discord » (#discord=…&preuve=… ou #discord-erreur=…) :
// mis de côté TOUT DE SUITE — l'ouverture de l'écran (`?tab=`) réécrit l'adresse et
// effacerait le fragment avant que l'écran Communauté ne le lise. L'adresse est
// nettoyée aussitôt (la preuve ne reste ni dans la barre ni dans l'historique).
if (typeof window !== 'undefined' && /(^|[#&])discord(-erreur)?=/.test(String(window.location.hash || ''))) {
  try { sessionStorage.setItem('vrm_discord_retour', String(window.location.hash).replace(/^#/, '')); } catch (_) {}
  try { localStorage.removeItem('vrm_discord_ticket'); } catch (_) {}   // le retour est arrivé ICI : plus rien à reprendre
  try { window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search); } catch (_) {}
}
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (ev) => {
    let dernier = 0;
    try { dernier = Number(sessionStorage.getItem('vrm_recharge_morceau')) || 0; } catch (_) {}
    if (Date.now() - dernier < 60000) return;
    try { sessionStorage.setItem('vrm_recharge_morceau', String(Date.now())); } catch (_) { return; }
    // (6 nov., filet 3) Compté À PART (src/plantages.js), jamais noté comme plantage :
    // c'est rattrapé par le rechargement. Dans la minute, l'erreur repart telle quelle
    // (vraie panne de réseau) et `noterPlantage` la compte à part elle aussi.
    compterMorceauPerime(ev && ev.payload);
    ev.preventDefault();
    window.location.reload();
  });
}
// L'app n'est téléchargée que par ceux qui y entrent : un visiteur qui lit la
// page d'accueil ne charge pas 340 Ko compressés pour rien (§ montée en charge).
// (11 nov., lot app-installable) « Mettre à jour » discret et l'aide d'installation.
import { PiluleMiseAJour, AideInstallation } from './AppInstallable.jsx';
import { decisionMaj, estSaisie, CLE_MAJ_REFUSEE } from './miseAJour.js';
// Android (Chrome, Edge, Samsung) offre l'installation : gardée pour l'aide,
// qui la propose UNE fois (src/aideInstallation.js). Plus de mini-bandeau surprise.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    try { e.preventDefault(); } catch (_) {}
    window.__vrmInviteInstallation = e;
    try { window.dispatchEvent(new Event('vrm:invite-installation')); } catch (_) {}
  });
  window.addEventListener('appinstalled', () => { window.__vrmInviteInstallation = null; });
}
const App = React.lazy(() => import('./App.jsx'));
// Le film de la page d'accueil (`?film`, export MP4) est un morceau à part : un
// visiteur de la page ne le télécharge jamais, et `?film` ne charge pas l'app.
const Film = React.lazy(() => import('./AccueilFilm.jsx'));
// Les polices : celle du SYSTÈME (SF Pro sur iPhone et Mac, styles-vitrine.css), aucune
// police téléchargée. (5 nov., chantier A) Inter et Space Grotesk, hébergées ici depuis
// le 30 sept. pour ne plus appeler Google Fonts, n'étaient plus dessinées nulle part
// depuis le style Apple du 2 nov. : retirées (des centaines de Ko à chaque chargement).
// (8 nov., démarrage léger) Les feuilles de style de l'app vivent dans src/stylesApp.js,
// importé en tout premier par src/App.jsx : la page d'accueil et l'écran de démarrage
// ne les attendent plus (101 Ko compressés qui bloquaient l'affichage d'index.html).
import { suivreRangeesDefilantes } from './rangeesDefilantes.js';
if (typeof document !== 'undefined') { if (document.body) suivreRangeesDefilantes(); else document.addEventListener('DOMContentLoaded', suivreRangeesDefilantes); }

// ⚠️ DERNIER FILET : même si l'application entière tombe (erreur AVANT que le
// garde-fou d'écran soit monté), on ne laisse jamais une page blanche. Une page
// blanche ne dit rien, ne propose rien, et donne l'impression que tout est
// perdu — alors que les données sont intactes dans le nuage.
class DernierFilet extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) { try { console.error('[VRM] application en erreur', err, info && info.componentStack); } catch (_) {} noterPlantage(err, { origine: 'demarrage', version: typeof __BUILD__ !== 'undefined' ? String(__BUILD__) : '' }); }
  render() {
    if (!this.state.err) return this.props.children;
    const msg = String((this.state.err && this.state.err.message) || this.state.err);
    const btn = { border: '1px solid #E5E5EA', background: 'transparent', borderRadius: 12, padding: '10px 15px',
      fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 22,
        fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif', background: '#F2F2F7', color: '#1C1C1E' }}>
        <div style={{ maxWidth: 420, width: '100%', background: '#fff', border: '1px solid #E5E5EA', borderRadius: 20, padding: '20px 18px' }}>
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>L'application n'a pas pu démarrer</div>
          <div style={{ fontSize: 13, color: '#636366', lineHeight: 1.5, marginBottom: 12 }}>
            Tes données sont intactes (elles sont dans le nuage, pas dans cette page). Recharge — si l'erreur revient,
            « Repartir propre » efface seulement les réglages de CE navigateur, puis retélécharge tout depuis ton compte.
          </div>
          <div style={{ fontSize: 12, fontFamily: 'ui-monospace, monospace', background: '#F2F2F7', border: '1px solid #E5E5EA',
            borderRadius: 12, padding: '9px 11px', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <button type="button" style={{ ...btn, border: 'none', background: '#1C1C1E', color: '#fff' }} onClick={() => location.reload()}>Recharger</button>
            <button type="button" style={btn} onClick={() => { try { navigator.clipboard.writeText(msg); } catch (_) {} }}>📋 Copier l'erreur</button>
            <button type="button" style={btn} onClick={() => {
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

// ── QUI VOIT QUOI À L'OUVERTURE (3 octobre) ──────────────────────────────────
// Un visiteur sans session voit la page d'accueil publique ; tout le reste va
// droit dans l'app — celui qui a une session, le retour d'un lien email ou
// d'une connexion Google (`?code=`, `#access_token=`, `error=`), un lien vers
// un onglet (`?tab=`), et `?connexion` / `?inscription` (les boutons de la page
// d'accueil). Les bancs qui posent `vrm_acces_direct` entrent aussi tout droit.
const aUneSession = () => { try { return !!localStorage.getItem('vrm_session') || localStorage.getItem('vrm_acces_direct') === '1'; } catch (_) { return false; } };
const veutLApp = () => {
  const q = window.location.search || '', h = window.location.hash || '';
  // `?lier-extension=` : « Se connecter avec VRM » cliqué dans l'extension
  // (11 octobre) — droit dans l'app, qui connecte l'extension (ou demande
  // d'abord la connexion), jamais la page d'accueil.
  // `?confirmer-adresse=` (22 oct.) : le lien de confirmation d'une adresse de
  // réception — droit dans l'app (connexion d'abord s'il le faut), jamais l'accueil.
  return /[?&](connexion|inscription|tab|code|error|error_description|type|lier-extension|confirmer-adresse)(=|&|$)/.test(q) || /(access_token|error|type)=/.test(h);
};
const versApp = () => aUneSession() || veutLApp();
const filmDemande = /[?&]film(=|&|$)/.test(window.location.search || '');
// Une session existe : on lance le téléchargement de l'app TOUT DE SUITE, avant
// même le premier rendu, pour ne pas ajouter un aller-retour à son ouverture.
if (!filmDemande && versApp()) { try { import('./App.jsx'); } catch (_) {} }

const FondApp = DemarrageVRM;
function Racine() {
  const [vue, setVue] = React.useState(() => (versApp() ? 'app' : 'accueil'));
  React.useEffect(() => {
    const f = () => setVue(versApp() ? 'app' : 'accueil');
    window.addEventListener('popstate', f);
    return () => window.removeEventListener('popstate', f);
  }, []);
  if (filmDemande) return <React.Suspense fallback={<FondApp />}><Film /></React.Suspense>;
  if (vue === 'accueil') {
    return <Accueil onEntrer={(mode) => {
      try { window.history.pushState({}, '', mode === 'up' ? '/?inscription' : '/?connexion'); } catch (_) {}
      window.scrollTo(0, 0);
      setVue('app');
    }} />;
  }
  return <>
    <React.Suspense fallback={<FondApp />}><App /></React.Suspense>
    <PiluleMiseAJour />
    <AideInstallation actif={aUneSession()} />
  </>;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><DernierFilet><Racine /></DernierFilet></React.StrictMode>
);
// (6 nov.) L'écran de démarrage d'index.html part quand la page montre autre chose
// qu'une attente (src/demarrage.js) — l'écran d'ouverture prêt, l'accueil, la connexion.
suivreDemarrage();

// PWA : enregistre le service worker (app installable + consultable hors-ligne).
// Best-effort — si le navigateur ne le supporte pas, l'app fonctionne pareil.
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  // (11 nov., lot app-installable) Un nouveau service worker ne recharge PLUS la
  // page au milieu d'un geste : la page relit seulement sa version (`autoUpdate`),
  // qui décide (src/miseAJour.js). Rien à faire au tout premier enregistrement.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !hadController) return;
    try { window.dispatchEvent(new Event('vrm:verifier-version')); } catch (_) {}
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
          // ⚠️ La MÊME clé que le serveur (src/vapid.js). Elle valait une autre
          // clé ici : chaque ouverture recréait un abonnement que le service de
          // push refuse, et en renvoyait un périmé tel quel.
          // ⚠️ Le serveur range l'appareil chez le vendeur de la SESSION (sinon le
          //    téléphone d'un vendeur recevait les ventes d'un autre). Le jeton
          //    vit dans `vrm_session` ; s'il a expiré, l'app le renouvelle dans
          //    la minute qui suit l'ouverture — on l'attend, sans rien envoyer
          //    d'anonyme entre-temps. Pas de session (page d'accueil) : rien.
          const jetonFrais = async () => {
            for (let i = 0; i < 13; i++) {
              try {
                const s = JSON.parse(localStorage.getItem('vrm_session') || 'null');
                if (!s || !s.access_token) return '';
                // Double vérification (16 octobre) : tant que le code n'est pas
                // passé (ou qu'on ne sait pas encore s'il en faut un), aucun
                // abonnement — sinon le mot de passe seul abonnerait ce
                // téléphone aux ventes du compte. On attend, comme un jeton expiré.
                const aal = (() => { try { const p = s.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'); return JSON.parse(atob(p + '='.repeat((4 - p.length % 4) % 4))).aal; } catch (_) { return null; } })();
                const mfaOk = aal === 'aal2' || (Array.isArray(s.totp) && !s.totp.length);
                if (mfaOk && (!s.expires_at || Number(s.expires_at) > Date.now() + 30000)) return s.access_token;
              } catch (_) { return ''; }
              await new Promise((r) => setTimeout(r, 5000));
            }
            return '';
          };
          reg.pushManager.getSubscription().then(async (sub) => {
            const jeton = await jetonFrais();
            if (!jeton) return;
            const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton}` };
            const send = (s) => fetch('/api/push', { method: 'POST', headers: h, body: JSON.stringify({ action: 'subscribe', sub: s.toJSON() }) }).catch(() => {});
            if (sub && abonnementAJour(sub)) return send(sub);
            if (sub) {
              await fetch('/api/push', { method: 'POST', headers: h, body: JSON.stringify({ action: 'unsubscribe', endpoint: sub.endpoint }) }).catch(() => {});
              await sub.unsubscribe().catch(() => {});
            }
            return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: cleVapid() }).then(send).catch(() => {});
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
  // (11 nov., lot app-installable) Une nouvelle version ne recharge plus d'office :
  // src/miseAJour.js décide (recharger si rien n'est en cours, sinon « Mettre à
  // jour » discret, une fois par version).
  let cacheeA = null;
  const check = async () => {
    if (reloading) return;
    const fp = await fingerprint();
    if (!fp) return;
    if (current == null) { current = fp; return; } // page sans empreinte connue : on s'aligne
    let refusee = null;
    try { refusee = localStorage.getItem(CLE_MAJ_REFUSEE); } catch (_) {}
    const demarrage = document.getElementById('vrm-demarrage');
    const d = decisionMaj({
      actuelle: current, serveur: fp, refusee,
      demarrageVisible: !!(demarrage && !demarrage.hasAttribute('data-sortie')),
      saisieEnCours: estSaisie(document.activeElement),
      cacheeDepuisMs: cacheeA == null ? null : Date.now() - cacheeA,
    });
    cacheeA = null;
    if (d === 'recharger') { reloading = true; window.location.reload(); return; }
    if (d === 'proposer' && window.__vrmMajDispo !== fp) {
      window.__vrmMajDispo = fp;
      try { window.dispatchEvent(new Event('vrm:maj-dispo')); } catch (_) {}
    }
  };
  window.addEventListener('vrm:verifier-version', () => check());
  window.addEventListener('load', () => {
    check();
    document.addEventListener('visibilitychange', () => { if (document.hidden) { cacheeA = Date.now(); return; } check(); });
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
