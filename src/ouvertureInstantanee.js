// ════════════════════════════════════════════════════════════════════════════
//  L'OUVERTURE INSTANTANÉE (14 nov., proposition 84 choisie par Julien :
//  « l'app s'ouvre en moins d'une seconde sur tes dernières données, même sans
//  réseau, puis se met à jour »).
//
//  Mesuré avant (390 px, processeur ×4, « Fast 3G », 2 000 ventes, 2 500 achats,
//  1 000 annonces, 10 comptes — scripts/bancs/ouverture-instantanee.cjs) : les
//  derniers chiffres de Ma journée (l'instantané du 9 nov., src/journeeInstantanee.js)
//  n'arrivaient qu'à ≈ 6,6 s, parce qu'ils attendaient tout le reste : 5,4 Mo de JS
//  analysés et exécutés (≈ 1,1 à 1,8 s de tâche longue), la vérification de la
//  boutique, l'équipe, puis le premier rendu du cœur de l'app.
//
//  Ici : LA DÉCISION, prise par src/main.jsx AVANT de charger l'app — peut-on peindre
//  tout de suite l'instantané de Ma journée de CE compte, sur CET appareil ? Le
//  rendu est src/OuvertureInstantanee.jsx (dans l'écran de démarrage d'index.html,
//  inerte, daté) ; l'app se charge ensuite et prend la place comme avant.
//
//  Rien de neuf n'est ouvert : on ne montre que ce que la porte « hors ligne à
//  froid » (src/porteHorsLigne.js) laisserait déjà voir SANS réseau, à cet instant :
//    · une session rangée, cohérente (le jeton dit le même uid), double
//      vérification passée (règle `etatMfa` de src/App.jsx) ;
//    · CE compte vérifié par le serveur sur CET appareil, avec CETTE session, il y
//      a moins de 7 jours (`laissezPasserHorsLigne`) ;
//    · un abonnement connu qui ouvre l'app (sans abonnement = l'aperçu flouté :
//      jamais d'instantané lisible, comme AppCoeur) ;
//    · le mode équipe tranché sur l'appareil pour SA boutique (un aide va sur les
//      colis du vendeur : rien à peindre — la projection de l'aide ne change pas) ;
//    · l'écran qui va s'ouvrir est Ma journée (lien `?tab=journee`, ou aucune
//      reprise d'un autre écran — règle `ecranAOuvrir` de src/repriseSynchro.js) ;
//    · un instantané de CE uid, montrable aujourd'hui (≤ 3 jours, src/journeeInstantanee.js).
//  Le reste (connexion, double vérification, refus du serveur) se décide comme
//  avant : l'écran de démarrage part, l'instantané avec lui.
//
//  ⚠️ L'instantané reste dans `localStorage` (≈ 1,5 Ko, clé `vrm_…` par uid, effacé à la
//  déconnexion et au changement de vendeur par `wipeLocalData`) et pas dans IndexedDB :
//  il se lit d'un trait, AVANT tout, sans attendre l'ouverture d'une base (IndexedDB
//  ajoute un aller-retour asynchrone, parfois long sur iPhone au lancement). Les copies
//  LOURDES des lignes (lot K, src/copieLignes.js) restent dans IndexedDB.
//  Aucune écriture : cette décision ne fait que LIRE.
// Exécuté par scripts/tests/ouverture-instantanee.test.mjs et le banc ouverture-instantanee.
// ════════════════════════════════════════════════════════════════════════════
import { laissezPasserHorsLigne } from './porteHorsLigne.js';
import { lireInstantane, instantaneMontrable } from './journeeInstantanee.js';
import { ecranAOuvrir, lireCarte, repriseLocale, CLE_REPRISE_ECRANS } from './repriseSynchro.js';
import { etatAbonnement } from './abonnement/etatAbonnement.js';

// Les liens qui décident d'un autre écran (connexion, inscription, retour d'e-mail, Discord…).
const LIENS_AUTRES = /[?&](connexion|inscription|code|error|error_description|type|lier-extension|confirmer-adresse|parrain|film|exemple|print|achat)(=|&|$)/;

const lireJson = (stock, k) => { try { const t = stock.getItem(k); return t ? JSON.parse(t) : null; } catch (_) { return null; } };
// La règle `etatMfa` de src/App.jsx : passée seulement si le jeton dit aal2, ou si la
// session SAIT qu'aucun code n'est demandé (`totp` vide). « Pas su » ⇒ pas d'instantané.
const aalDuJeton = (jeton) => {
  try {
    const p = String(jeton || '').split('.')[1] || '';
    const b = p.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(b + '==='.slice((b.length + 3) % 4))).aal || null;
  } catch (_) { return null; }
};
export const mfaPassee = (s) => !!s && !!s.access_token && (aalDuJeton(s.access_token) === 'aal2' || (Array.isArray(s.totp) && !s.totp.length));

// Le mode équipe tranché pour SA boutique (même aiguillage que `PorteEquipe`, depuis
// le cache de l'appareil). Rien en cache ⇒ « pas su » ⇒ pas d'instantané.
export function boutiquePropre(stock, uid) {
  const cache = lireJson(stock, `vrm_equipe_cache_${uid}`);
  if (!cache || !Array.isArray(cache.membreDe)) return false;
  let vue = null; try { vue = stock.getItem(`vrm_equipe_vue_${uid}`); } catch (_) { vue = null; }
  const membres = cache.membreDe;
  if (vue && membres.some((m) => m && m.vendeur === vue)) return false;            // l'écran d'un vendeur choisi
  if (vue === null && cache.aBoutique === false && membres.length) return false;   // aide sans boutique à lui
  if (vue === null && cache.aBoutique === false) return false;                     // invitations à trancher
  return true;
}

// L'écran qui va s'ouvrir est-il Ma journée ? (lien `?tab=`, sinon la reprise de moins de 30 min)
const TOUS_ONGLETS = Object.assign([], { includes: () => true });
export function ouvreMaJournee(stock, search, uid, maintenant = Date.now()) {
  const q = String(search || '');
  if (LIENS_AUTRES.test(q)) return false;
  const m = /[?&]tab=([^&]*)/.exec(q);
  if (m) return decodeURIComponent(m[1]) === 'journee';
  try {
    const carte = lireCarte(lireJson(stock, CLE_REPRISE_ECRANS), uid);
    const r = ecranAOuvrir({ carte, locale: repriseLocale(stock, uid), ongletsOk: TOUS_ONGLETS, search: q, now: maintenant });
    return !r || r.tab === 'journee';
  } catch (_) { return false; }
}

// LA décision. Rend { uid, snap, montrable } ou { raison } (jamais une exception).
export function apercuOuverture({ stock, search = '', maintenant = Date.now() } = {}) {
  try {
    if (!stock) return { raison: 'stockage' };
    const session = lireJson(stock, 'vrm_session');
    const uid = session && session.user && typeof session.user.id === 'string' ? session.user.id : '';
    if (!uid) return { raison: 'session' };
    if (!mfaPassee(session)) return { raison: 'mfa' };
    const lp = laissezPasserHorsLigne({ stock, session, maintenant });
    if (!lp.ok) return { raison: 'porte:' + lp.raison };
    const abo = lp.abo || null;
    if (!abo || abo.acces === false) return { raison: 'abonnement' };
    try { if (etatAbonnement(abo, maintenant).lectureSeule) return { raison: 'abonnement' }; } catch (_) { return { raison: 'abonnement' }; }
    if (!boutiquePropre(stock, uid)) return { raison: 'equipe' };
    if (!ouvreMaJournee(stock, search, uid, maintenant)) return { raison: 'ecran' };
    const snap = lireInstantane(uid, { maintenant, ls: stock });
    const montrable = instantaneMontrable(snap, maintenant);
    if (!snap || !montrable) return { raison: 'instantane' };
    return { uid, snap, montrable };
  } catch (_) { return { raison: 'erreur' }; }
}

// Le cadre relevé à la capture, s'il vaut pour CETTE fenêtre et CE thème.
export function cadreUtilisable(cadre, { largeur, theme }) {
  if (!cadre || typeof cadre !== 'object') return null;
  if (!(Math.abs((Number(cadre.vw) || 0) - largeur) < 2)) return null;
  if ((cadre.theme || '') !== (theme || '')) return null;
  const n = (x) => (Number.isFinite(Number(x)) ? Math.round(Number(x)) : null);
  const haut = n(cadre.haut), gauche = n(cadre.gauche), large = n(cadre.large);
  if (haut == null || gauche == null || !large || haut < 0 || haut > 200 || gauche < 0 || large > largeur + 2) return null;
  const barre = typeof cadre.barre === 'string' && /^(rgba?\([\d.,\s%]+\)|#[0-9a-f]{3,8})$/i.test(cadre.barre) ? cadre.barre : '';
  const propre = (c) => String(c || '').split(/\s+/).filter((x) => /^[a-z][\w-]{0,60}$/i.test(x)).slice(0, 12).join(' ');
  const vars = {};
  for (const [k, v] of Object.entries(cadre.vars || {})) if (/^--[\w-]{1,60}$/.test(k) && typeof v === 'string' && v.length <= 160 && !/url\s*\(|expression|[<>{};]/i.test(v)) vars[k] = v;
  return { haut, gauche, large, barre, shell: propre(cadre.shell) || 'vrm-app-shell', main: propre(cadre.main) || 'vrm-main', vars };
}
