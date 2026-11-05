// ══════════════════════════════════════════════════════════════════════════════
// LE GUIDE « INSTALLER VRM SUR L'IPHONE » — LA RÈGLE (5 novembre)
// ══════════════════════════════════════════════════════════════════════════════
// Sur iPhone, les notifications d'une web app ne marchent QUE dans l'app posée
// sur l'écran d'accueil (iOS 16.4 et plus) : dans Safari, `PushManager` n'existe
// pas. Paramètres → Notifications le disait en une ligne ; le guide le montre en
// trois gestes illustrés (src/GuideIphone.jsx) : Partager → « Sur l'écran
// d'accueil », puis activer les notifications depuis l'icône.
//
// Il ne s'affiche QUE sur un iPhone, dans SAFARI, qui n'a pas encore installé
// l'app (hors `standalone`) — et plus jamais une fois fermé (sur cet appareil :
// l'installation est propre à l'appareil, un réglage synchronisé n'aurait pas
// de sens ici). Pas sur iPad (« iPhone » seulement), ni dans Chrome, Firefox,
// Edge ou Orion sur iPhone (`navigateurIci` : CriOS, FxiOS, EdgiOS, `window.KAGI`)
// — leurs menus ne sont pas ceux qu'on dessine. Pur, sauf `lireFerme` /
// `noterFerme`, qui touchent le stockage passé (enveloppés : un stockage
// interdit — navigation privée — ne casse rien, le guide reste simplement
// fermable pour cette visite).
import { navigateurIci } from './navigateurExtension.js';

export const CLE_GUIDE_IPHONE = 'vrm_guide_iphone_ferme';

const uaDe = (ua) => String(ua != null ? ua : (typeof navigator !== 'undefined' ? navigator.userAgent : '') || '');

// Un iPhone (ou iPod), dans Safari. `ua` absent ⇒ le vrai navigateur (Orion
// reconnu par `window.KAGI`) ; `ua` passé ⇒ l'agent seul (bancs, audits).
export function estIphoneSafari(ua) {
  const u = uaDe(ua);
  if (!/\b(?:iPhone|iPod)\b/.test(u)) return false;
  return navigateurIci(ua == null ? undefined : u) === 'safari';
}

// L'app est-elle ouverte depuis l'écran d'accueil ? Safari pose
// `navigator.standalone` ; la requête `display-mode` dit la même chose ailleurs.
// « Pas su » (aucune des deux) ⇒ `false` : le guide peut s'afficher, il se ferme.
export function estInstallee(win) {
  try {
    const w = win || (typeof window !== 'undefined' ? window : null);
    if (!w) return false;
    if (w.navigator && w.navigator.standalone === true) return true;
    if (typeof w.matchMedia === 'function') {
      for (const m of ['standalone', 'fullscreen', 'minimal-ui']) if (w.matchMedia(`(display-mode: ${m})`).matches) return true;
    }
  } catch (_) {}
  return false;
}

// La version d'iOS lue dans l'agent (« OS 16_4 ») : [majeure, mineure] ou `null`.
export function versionIos(ua) {
  const m = /\bOS (\d+)[_.](\d+)/.exec(uaDe(ua));
  return m ? [Number(m[1]), Number(m[2])] : null;
}
// Les notifications d'une web app : iOS 16.4 et plus. `null` = pas su.
export function iosAvecNotifications(ua) {
  const v = versionIos(ua);
  if (!v) return null;
  return v[0] > 16 || (v[0] === 16 && v[1] >= 4);
}

export function lireFerme(stockage) {
  try {
    const s = stockage || (typeof localStorage !== 'undefined' ? localStorage : null);
    return !!(s && s.getItem(CLE_GUIDE_IPHONE));
  } catch (_) { return false; }
}
export function noterFerme(stockage, maintenant = Date.now()) {
  try {
    const s = stockage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (s) s.setItem(CLE_GUIDE_IPHONE, new Date(maintenant).toISOString());
  } catch (_) {}
}

// LA décision : iPhone + Safari + pas installée + pas fermé.
export function guideIphoneVisible({ ua, installee = false, ferme = false } = {}) {
  return estIphoneSafari(ua) && !installee && !ferme;
}

// Les trois étapes (texte de l'écran, une source). `ua` : pour la version d'iOS.
export function etapesGuideIphone(ua) {
  const notifs = iosAvecNotifications(ua);
  return [
    { cle: 'partager', titre: 'Touche Partager', texte: 'En bas de Safari, le carré d’où sort une flèche. Sur les iOS récents, il est d’abord sous « ••• ».' },
    { cle: 'accueil', titre: 'Sur l’écran d’accueil', texte: 'Fais défiler la liste, touche « Sur l’écran d’accueil », puis « Ajouter ». L’icône VRM apparaît avec tes apps.' },
    notifs === false
      ? { cle: 'notifications', titre: 'Mets l’iPhone à jour', texte: 'Les notifications demandent iOS 16.4 ou plus récent : Réglages → Général → Mise à jour logicielle. Puis ouvre VRM depuis son icône.' }
      : { cle: 'notifications', titre: 'Active les notifications', texte: 'Ouvre VRM depuis son icône, puis Paramètres → Notifications : « Activer sur cet appareil », et « Autoriser ».' },
  ];
}
