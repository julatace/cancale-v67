// (6 nov.) LE MODE EXEMPLE s'installe EN PREMIER, avant tout module de l'app : s'il
// est demandé par cet onglet, le stockage et la base deviennent des copies en
// mémoire (src/modeExemple.js) — rien de l'exemple n'est écrit nulle part.
import { exempleActif } from './modeExemple.js';
// (20 nov., iphone-rapide) Les dates et nombres mis en forme par un formateur gardé (src/formatsRapides.js) : le même
// texte, sans reconstruire un formateur Intl à chaque date d'une liste.
import { poserFormatsRapides } from './formatsRapides.js';
poserFormatsRapides();
// (20 nov., bugs-terrain) Les comparaisons de textes avec langue/options par un comparateur gardé (src/comparaisonsRapides.js).
import { poserComparaisonsRapides } from './comparaisonsRapides.js';
poserComparaisonsRapides();
// (19 nov.) Les drapeaux de racine (à la place des `:has()` portés par html, body, la coque) : posés avant le premier rendu.
import './drapeauxRacine.js';
import { garderCodePartenaire } from './partenaires/lien.js';
// (8 nov.) Les 30 dernières requêtes de la page (famille, code, durée — jamais une
// adresse ni un contenu), pour « Signaler un problème » (src/lecturesRecentes.js).
import { installerJournalLectures } from './lecturesRecentes.js';
installerJournalLectures();
import { cleVapid, abonnementAJour } from './vapid.js';
import React from 'react';
import ReactDOM from 'react-dom/client';
import Accueil from './Accueil.jsx';
import { lienEntree } from './accueil/lienEntree.js';
// (11 nov., lot traduction) La langue est prête AVANT le premier rendu (src/i18n/index.js) ;
// la racine se redessine quand elle change (Paramètres → Langue, ou relue du nuage).
import { tr, preparerLangue, langueInitiale } from './i18n/index.js';
import { useLangue } from './i18n/react.js';
import { DemarrageVRM } from './Chargement.jsx';
import { suivreDemarrage, etapeDemarrage } from './demarrage.js';
// (15 nov., chantier « ouverture ») Un morceau de l'app qui ne se charge pas : relancé une fois, puis
// rechargement PROPRE vers la nouvelle version, sinon « Mettre à jour VRM » — jamais un écran tombé ni
// `undefined … default` (src/chargementSur.js).
import { lazySur, verifierMorceauPerime, rechargerVersNouvelle, estErreurMorceau, relancerFeuilles } from './chargementSur.js';
import MettreAJourVRM from './composants/MettreAJourVRM.jsx';
// (16 nov., lot vitesse-lectures) Le journal lui-même (src/plantages.js) arrive après l'accueil ; un tampon
// minuscule écoute dès maintenant et lui rend tout (src/plantagesTampon.js).
import { poserTamponPlantages } from './plantagesTampon.js';
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
// Les erreurs de la page ET les violations de la politique de sécurité du contenu (Report-Only) : le
// même journal, pour savoir sur SES appareils si elle peut passer en vigueur.
const plantages = poserTamponPlantages({ contexte: () => ({ ecran: ecranCourant(),
  version: typeof __BUILD__ !== 'undefined' ? String(__BUILD__) : '' }) });
const compterMorceauPerime = (p) => plantages.compterMorceauPerime(p);
// Le vrai journal : à la première inactivité après le chargement (au plus 4 s), ou au premier plantage.
if (typeof window !== 'undefined') {
  const plusTard = () => { try { (window.requestIdleCallback || ((f) => setTimeout(f, 1500)))(() => plantages.charger(), { timeout: 4000 }); } catch (_) { plantages.charger(); } };
  if (document.readyState === 'complete') plusTard(); else window.addEventListener('load', plusTard, { once: true });
}
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
    // (6 nov., filet 3) Compté À PART (src/plantages.js), jamais noté comme plantage.
    compterMorceauPerime(ev && ev.payload);
    // ⚠️ (14 nov., fiabilité prod) JAMAIS `ev.preventDefault()` ici. Vite (son `preload`) rendrait alors
    // `undefined` À LA PLACE DU MODULE : `React.lazy` lisait `undefined.default` (64 écrans tombés du 10 au
    // 12 nov., iOS Safari). Sans lui, l'import est REJETÉ avec sa vraie raison.
    // (15 nov., chantier « ouverture ») Plus un `location.reload()` aveugle (une fois par minute) : il
    // retombait sur la coquille GARDÉE par le service worker — la même ancienne version, la même erreur.
    // Le serveur est relu : une autre version en ligne ⇒ rechargement propre (coquille oubliée, une fois par
    // version et par onglet) ; même version ou pas de réseau ⇒ rien (l'écran relance son morceau, puis
    // « Mettre à jour VRM »). src/chargementSur.js.
    verifierMorceauPerime('preload');
    // (16 nov., parcours-vert) Une feuille refusée reste « déjà vue » pour Vite : la reposer une fois, sinon l'app
    // s'affiche sans aucune mise en forme (banc session-reveil D). Même version : aucun rechargement.
    setTimeout(() => { relancerFeuilles(); }, 450);
  });
}
// L'app n'est téléchargée que par ceux qui y entrent : un visiteur qui lit la
// page d'accueil ne charge pas 340 Ko compressés pour rien (§ montée en charge).
// (11 nov., lot app-installable) « Mettre à jour » discret et l'aide d'installation.
// (16 nov., lot vitesse-lectures) « Mettre à jour » et l'aide d'installation ne se montrent que DANS l'app
// (jamais sur la page d'accueil) : un morceau à part, chargé avec l'app — le fichier d'entrée de la page
// d'accueil (budget du banc `accueil`) n'emporte plus ces deux composants, leurs règles et leur style.
const PiluleMiseAJour = lazySur(() => import('./AppInstallable.jsx').then((m) => ({ default: m.PiluleMiseAJour })));
const AideInstallation = lazySur(() => import('./AppInstallable.jsx').then((m) => ({ default: m.AideInstallation })));
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
const App = lazySur(() => import('./App.jsx'));
// Le film de la page d'accueil (`?film`, export MP4) est un morceau à part : un
// visiteur de la page ne le télécharge jamais, et `?film` ne charge pas l'app.
const Film = lazySur(() => import('./AccueilFilm.jsx'));
// (14 nov., n° 144) vrm.center/tarifs : la page publique des tarifs, un morceau à part
// (ni l'app ni l'accueil ne le téléchargent), ses textes avec lui (src/tarifs/Tarifs.jsx).
const Tarifs = lazySur(() => import('./tarifs/Tarifs.jsx'));
const pageTarifs = () => /^\/tarifs\/?$/.test(window.location.pathname || '');
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
  componentDidCatch(err, info) { try { console.error('[VRM] application en erreur', err, info && info.componentStack); } catch (_) {} plantages.noter(err, { origine: 'demarrage', version: typeof __BUILD__ !== 'undefined' ? String(__BUILD__) : '' }); }
  render() {
    if (!this.state.err) return this.props.children;
    // (15 nov.) Un morceau introuvable : « Mettre à jour VRM », un bouton — pas « l'application n'a pas pu démarrer ».
    if (estErreurMorceau(this.state.err)) return <MettreAJourVRM pleinEcran/>;
    const msg = String((this.state.err && this.state.err.message) || this.state.err);
    const btn = { border: '1px solid #E5E5EA', background: 'transparent', borderRadius: 12, padding: '10px 15px',
      fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 22,
        fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif', background: '#F2F2F7', color: '#1C1C1E' }}>
        <div style={{ maxWidth: 420, width: '100%', background: '#fff', border: '1px solid #E5E5EA', borderRadius: 20, padding: '20px 18px' }}>
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>{tr('erreur.demarrage.titre')}</div>
          <div style={{ fontSize: 13, color: '#636366', lineHeight: 1.5, marginBottom: 12 }}>
            {tr('erreur.demarrage.texte')}
          </div>
          <div style={{ fontSize: 12, fontFamily: 'ui-monospace, monospace', background: '#F2F2F7', border: '1px solid #E5E5EA',
            borderRadius: 12, padding: '9px 11px', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <button type="button" style={{ ...btn, border: 'none', background: '#1C1C1E', color: '#fff' }} onClick={() => location.reload()}>{tr('erreur.recharger')}</button>
            <button type="button" style={btn} onClick={() => { try { navigator.clipboard.writeText(msg); } catch (_) {} }}>📋 {tr('erreur.copier')}</button>
            <button type="button" style={btn} onClick={() => {
              // On ne touche QU'AUX clés de l'app, et on garde la session : le
              // nuage est la source de vérité, tout revient au rechargement.
              try { Object.keys(localStorage).forEach(k => { if (/^(vinted_|vrm_)/.test(k) && k !== 'vrm_session') localStorage.removeItem(k); }); } catch (_) {}
              location.reload();
            }}>{tr('erreur.repartirPropre')}</button>
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
  // (13 nov., lot 54) Un lien de parrainage (`?parrain=CODE`, `/r/CODE`) ouvre l'INSCRIPTION (avec
  // « Offert par … ») : la page d'accueil, puis « Créer mon compte », perdait le code (l'adresse changée
  // en `/?inscription` avant que l'app ne le range).
  return /[?&](connexion|inscription|tab|code|error|error_description|type|lier-extension|confirmer-adresse|parrain)(=|&|$)/.test(q) || /(access_token|error|type)=/.test(h)
    || /^\/r\/[A-Za-z0-9]{8}\/?$/.test(window.location.pathname || '');
  // (15 nov., décision : la vitrine d'abord) Le lien d'un PARTENAIRE (`/p/CODE` → `?partenaire=CODE`) montre la page
  // d'accueil : l'abonné de l'influenceur voit ce qu'est VRM ; « Essayer gratuitement » garde la suite de l'adresse
  // jusqu'à l'inscription (`src/accueil/lienEntree.js`), le code est rattaché à l'inscription.
};
// (15 nov.) Le code d'un partenaire est GARDÉ sur l'appareil dès l'arrivée (même règle que l'app : src/partenaires/lien.js),
// pour survivre à un détour par la vitrine ou par « Découvrir avec des exemples » avant l'inscription.
try { garderCodePartenaire(localStorage, window.location.search, window.location.pathname); } catch (_) {}
const versApp = () => aUneSession() || veutLApp();
const filmDemande = /[?&]film(=|&|$)/.test(window.location.search || '');
// (14 nov., lot argent-prix — 115) Le lien de son COMPTABLE (`/c/<jeton>` → `?comptable=`) : une page en lecture
// seule, SANS l'app ni session (src/VueComptable.jsx) — même quand une session existe sur ce navigateur.
const comptableDemande = /[?&]comptable=/.test(window.location.search || '');
const VueComptable = lazySur(() => import('./VueComptable.jsx'));
// (15 nov.) LA PAGE D'UN PARTENAIRE (`/pa/<jeton>` → `?espace-partenaire=`) : lecture seule, sans l'app ni session (src/VuePartenaire.jsx).
const partenaireDemande = /[?&]espace-partenaire=/.test(window.location.search || '');
const VuePartenaire = lazySur(() => import('./VuePartenaire.jsx'));
// (14 nov., ouverture instantanée) LES DERNIERS CHIFFRES DE MA JOURNÉE, PEINTS AVANT L'APP.
// src/ouvertureInstantanee.js décide (rien que ce que la porte hors ligne laisserait voir, pour CE
// compte, sur CET appareil) ; src/OuvertureInstantanee.jsx peint l'instantané dans l'écran de
// démarrage. L'app (5 Mo à analyser et exécuter : une longue tâche) ne part qu'APRÈS cette image.
// Aucun instantané ⇒ rien ne change (l'app part tout de suite, comme avant).
// Ici, seulement le PREMIER tri (une session, et un instantané rangé pour son uid) : la décision et
// ses règles vivent dans le morceau à part (rien de plus à télécharger pour la page d'accueil).
const apercuPossible = (() => {
  try {
    if (filmDemande || comptableDemande || partenaireDemande || pageTarifs() || exempleActif()) return false;
    const s = JSON.parse(window.localStorage.getItem('vrm_session') || 'null');
    const uid = s && s.user && typeof s.user.id === 'string' ? s.user.id : '';
    // Les traces que la décision exigera (src/ouvertureInstantanee.js) : sans l'une d'elles, aucun morceau
    // n'est demandé et l'app part tout de suite, exactement comme avant (aucun délai pour un « non »).
    const q = window.location.search || '';
    const tab = /[?&]tab=([^&]*)/.exec(q);
    if (tab && tab[1] !== 'journee') return false;
    const ls = window.localStorage;
    return !!uid && ['vrm_journee_instantane:', 'vrm_porte_ok_', 'vrm_abo_dernier_', 'vrm_equipe_cache_'].every((p) => !!ls.getItem(p + uid));
  } catch (_) { return false; }
})();
const apercuPeint = apercuPossible
  ? import('./OuvertureInstantanee.jsx').then((m) => m.ouvrirAvecInstantane({ stock: window.localStorage, search: window.location.search || '' })).catch(() => false)
  : Promise.resolve(false);
// Une session existe : on lance le téléchargement de l'app TOUT DE SUITE, avant
// même le premier rendu, pour ne pas ajouter un aller-retour à son ouverture
// (après l'instantané quand il y en a un : le fichier est déjà préchargé par
// public/demarrage-app.js, seule son exécution attend la peinture).
// (15 nov.) Le morceau arrivé est un JALON de la progression de l'écran de démarrage (src/demarrage.js).
const telechargerApp = () => { try { import('./App.jsx').then(() => etapeDemarrage('telechargee'), () => {}); } catch (_) {} };
if (!filmDemande && !comptableDemande && !partenaireDemande && versApp()) { if (apercuPossible) apercuPeint.then(telechargerApp); else telechargerApp(); }

const FondApp = DemarrageVRM;
function Racine() {
  useLangue();
  const [vue, setVue] = React.useState(() => (versApp() ? 'app' : 'accueil'));
  React.useEffect(() => {
    const f = () => setVue(versApp() ? 'app' : 'accueil');
    window.addEventListener('popstate', f);
    return () => window.removeEventListener('popstate', f);
  }, []);
  if (comptableDemande) return <React.Suspense fallback={null}><VueComptable /></React.Suspense>;
  if (partenaireDemande) return <React.Suspense fallback={null}><VuePartenaire /></React.Suspense>;
  if (filmDemande) return <React.Suspense fallback={<FondApp />}><Film /></React.Suspense>;
  if (pageTarifs()) return <React.Suspense fallback={<FondApp />}><Tarifs /></React.Suspense>;
  if (vue === 'accueil') {
    return <Accueil onEntrer={(mode) => {
      // (15 nov., lot site-public) La suite de l'adresse (code d'un partenaire, utm…) passe intacte
      // jusqu'au formulaire (src/accueil/lienEntree.js) : on ne la lit pas ici.
      try { window.history.pushState({}, '', lienEntree(mode === 'up' ? 'inscription' : 'connexion')); } catch (_) {}
      window.scrollTo(0, 0);
      setVue('app');
    }} />;
  }
  return <>
    <React.Suspense fallback={<FondApp />}><App /></React.Suspense>
    <React.Suspense fallback={null}><PiluleMiseAJour /><AideInstallation actif={aUneSession()} /></React.Suspense>
  </>;
}

const monter = () => ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><DernierFilet><Racine /></DernierFilet></React.StrictMode>
);
// Français (la source) : aucune attente. Une autre langue : son morceau d'abord, 2 s au plus.
// (14 nov.) Et l'instantané d'abord peint, s'il y en a un (1,5 s au plus, src/OuvertureInstantanee.jsx).
// (15 nov.) Les phrases de l'écran de démarrage (écrites en français dans index.html, avant tout script)
// dans la langue choisie, dès qu'elle est prête.
const traduireDemarrage = () => {
  try {
    const cles = { ouverture: 'demarrage.ouverture', lent: 'demarrage.lent', recharger: 'demarrage.recharger' };
    for (const el of document.querySelectorAll('#vrm-demarrage [data-vrm-boot-texte]')) {
      const c = cles[el.getAttribute('data-vrm-boot-texte')];
      if (c) el.textContent = tr(c);
    }
  } catch (_) {}
};
Promise.all([preparerLangue().catch(() => {}), apercuPeint]).then(() => { traduireDemarrage(); monter(); }, monter);
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
      // (14 nov., ouverture instantanée) L'APP (pas la page d'accueil) fait ranger sa coquille dès la
      // 1re ouverture : la 2e ne repasse plus par le réseau (public/sw.js, `VRM_RANGER_COQUILLE`).
      if (versApp()) navigator.serviceWorker.ready.then((r) => { try { if (r && r.active) r.active.postMessage({ type: 'VRM_RANGER_COQUILLE', langue: langueInitiale() }); } catch (_) {} }).catch(() => {});
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
    // (15 nov., chantier « ouverture ») Le rechargement OUBLIE la coquille gardée par le service worker : sans
    // ça, un rechargement que le navigateur ne marque pas « sans cache » retombait sur l'ancienne version, qui
    // revoyait la nouvelle, et rechargeait encore (mesuré au banc ouverture : A ▸ A ▸ B). Une fois par version
    // et par onglet ; refusé (déjà fait) ⇒ la pilule « Mettre à jour » à la place, jamais une boucle.
    if (d === 'recharger') {
      reloading = true;
      if (await rechargerVersNouvelle({ cible: fp, raison: 'version' })) return;
      reloading = false;
    }
    if (d === 'recharger' || d === 'proposer') {
      if (window.__vrmMajDispo !== fp) {
        window.__vrmMajDispo = fp;
        try { window.dispatchEvent(new Event('vrm:maj-dispo')); } catch (_) {}
      }
    }
  };

  window.addEventListener('vrm:verifier-version', () => check());
  // (15 nov., chantier « ouverture ») La version est relue TOUT DE SUITE, plus à l'événement `load` : une
  // app rouverte sur une version gardée par le service worker se recharge pendant que l'écran de démarrage
  // la couvre encore (une seule attente à l'écran), plus après avoir montré Ma journée de l'ancienne.
  setTimeout(check, 0);
  window.addEventListener('load', () => {
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
