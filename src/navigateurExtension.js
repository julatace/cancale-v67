// Où s'installe l'extension VRM, selon le navigateur qui ouvre l'app (5.188).
//
// UN paquet sert tous les navigateurs Chromium (Chrome, Edge, Opera, Brave) ;
// un paquet adapté sert Firefox, sur ordinateur ET sur Android. Safari n'est
// pas couvert (il exige une app macOS / iOS signée par Apple).
//
// ⚠️ LIENS_BOUTIQUES : l'adresse de la fiche, une fois PUBLIÉE et VALIDÉE par la
//    boutique — vide tant qu'elle ne l'est pas. Vide ⇒ l'app ne promet aucune
//    boutique : elle propose le zip (Chromium) ou dit que la version de ce
//    navigateur n'est pas encore en ligne. Jamais un lien deviné : une fiche
//    qui n'existe pas encore mène à une erreur 404 — le défaut du pipeline
//    Factures. À remplir quand chaque boutique a validé la fiche.
export const LIENS_BOUTIQUES = {
  chrome: '',    // https://chromewebstore.google.com/detail/<identifiant>
  edge: '',      // https://microsoftedge.microsoft.com/addons/detail/<identifiant>
  opera: '',     // https://addons.opera.com/extensions/details/<nom>
  firefox: '',   // https://addons.mozilla.org/firefox/addon/<nom>/
};

// Le navigateur, lu dans l'agent utilisateur — un repère pour CHOISIR une phrase
// et un lien, jamais une capacité (la présence de l'extension se mesure par le
// pont, `vmrExtPresent`). Brave se présente comme Chrome : c'est voulu, il
// installe depuis le Chrome Web Store.
export function navigateurIci(ua) {
  const u = String(ua != null ? ua : (typeof navigator !== 'undefined' ? navigator.userAgent : '') || '');
  if (/Firefox\/|FxiOS\//.test(u)) return 'firefox';
  // Samsung Internet se présente AUSSI comme Chrome : on le lit avant (19 oct.).
  if (/SamsungBrowser\//.test(u)) return 'samsung';
  if (/\bEdg(?:e|A|iOS)?\//.test(u)) return 'edge';
  if (/\bOPR\/|\bOpera\b/.test(u)) return 'opera';
  if (/Chrome\/|CriOS\//.test(u)) return 'chrome';
  if (/Safari\//.test(u)) return 'safari';
  return 'autre';
}
export const estIOS = (ua) => /iPhone|iPad|iPod/i.test(String(ua != null ? ua : (typeof navigator !== 'undefined' ? navigator.userAgent : '') || ''));
export const estAndroid = (ua) => /Android/i.test(String(ua != null ? ua : (typeof navigator !== 'undefined' ? navigator.userAgent : '') || ''));

// La boutique du navigateur d'ici : `{ nav, lien }` (lien vide si pas publiée).
// Brave et Chrome installent depuis le Chrome Web Store.
export function boutiqueIci(ua) {
  const nav = navigateurIci(ua);
  const lien = LIENS_BOUTIQUES[nav] || '';
  return { nav, lien };
}

// ORION (Kagi, Mac ET iPhone) installe les extensions de la boutique de Chrome
// et de celle de Firefox — c'est le seul navigateur d'iPhone qui en accepte.
// Il se présente exactement comme Safari (même agent utilisateur) : on ne peut
// pas le reconnaître, donc on le PROPOSE là où l'on dirait « Safari ne peut
// pas » (Safari sur Mac, iPhone). Le lien est celui d'une fiche PUBLIÉE
// (Chrome d'abord, Firefox sinon) — vide ⇒ on ne le propose pas. Une fois
// installée dans Orion, l'extension se mesure comme ailleurs (le pont répond).
// ⚠️ Non essayé dans Orion : sa prise en charge des API d'extension est
// partielle, la phrase le dit.
export function boutiqueOrion() {
  return LIENS_BOUTIQUES.chrome || LIENS_BOUTIQUES.firefox || '';
}

// La page des extensions de CE navigateur — celle qu'on nomme dans une consigne.
export function pageExtensionsIci(ua) {
  const nav = navigateurIci(ua);
  if (nav === 'firefox') return 'about:addons';
  if (nav === 'edge') return 'edge://extensions';
  if (nav === 'opera') return 'opera://extensions';
  return 'chrome://extensions';
}

// Le nom du navigateur, pour une phrase (« dans ce Firefox »).
export function nomNavigateurIci(ua) {
  return { firefox: 'Firefox', samsung: 'Samsung Internet', edge: 'Edge', opera: 'Opera', chrome: 'Chrome', safari: 'Safari' }[navigateurIci(ua)] || 'ce navigateur';
}

// ══ LE TÉLÉPHONE (19 octobre, « l'extension pour iPhone et Samsung ») ═══════
// Mesuré (docs/boutiques-extension.md, section « Téléphone ») :
// - Firefox pour Android ACCEPTE l'extension (paquet Firefox, 5.188) — depuis
//   addons.mozilla.org seulement ;
// - Samsung Internet : ses modules passent par le Galaxy Store, programme
//   FERMÉ (seuls des développeurs choisis par Samsung) ⇒ impossible pour VRM ;
// - Chrome pour Android, Chrome et Safari sur iPhone : aucune extension ;
// - Edge pour Android : catalogue choisi par Microsoft, pas ouvert ;
// - iPhone : Orion (même agent que Safari, indétectable) — proposé seulement
//   avec une fiche publiée (`boutiqueOrion`) ; sinon le RELAIS de l'ordinateur.
// Rend UN code, et l'écran choisit sa phrase ; jamais une capacité (la présence
// de l'extension se mesure par le pont).
export function mobileIci(ua) {
  const nav = navigateurIci(ua);
  if (estIOS(ua)) return 'ios';
  if (!estAndroid(ua)) return 'autre';
  if (nav === 'firefox') return 'firefox-android';
  if (nav === 'samsung') return 'samsung';
  return 'android';
}
// La fiche Google Play de Firefox pour Android (adresse stable de Mozilla) :
// proposée seulement quand l'extension Firefox est PUBLIÉE — sinon installer
// Firefox ne servirait à rien.
export const LIEN_FIREFOX_ANDROID = 'https://play.google.com/store/apps/details?id=org.mozilla.firefox';
