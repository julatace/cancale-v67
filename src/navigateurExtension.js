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
  safari: '',    // https://apps.apple.com/app/<nom>/id<n> — l'app conteneur (Xcode, compte Apple)
};

// ORION (Kagi) se présente exactement comme Safari. Kagi documente UN repère
// pour le reconnaître : l'objet `window.KAGI` (aide d'Orion, page « technical »).
// C'est un repère pour CHOISIR une phrase, jamais une capacité.
export function estOrionIci(win) {
  try { const w = win !== undefined ? win : (typeof window !== 'undefined' ? window : null); return !!(w && w.KAGI); } catch (_) { return false; }
}

// Le navigateur, lu dans l'agent utilisateur — un repère pour CHOISIR une phrase
// et un lien, jamais une capacité (la présence de l'extension se mesure par le
// pont, `vmrExtPresent`). Brave se présente comme Chrome : c'est voulu, il
// installe depuis le Chrome Web Store.
// 20 octobre (« tous les navigateurs ») : chaque marque lit SON marqueur
// dans l'agent utilisateur (DuckDuckGo, Yandex, Vivaldi) ; Orion par
// `window.KAGI` (seulement sans `ua` passé : c'est l'environnement réel) ;
// Brave et Arc se présentent comme Chrome et installent depuis sa boutique.
export function navigateurIci(ua) {
  const reel = ua == null;
  const u = String(ua != null ? ua : (typeof navigator !== 'undefined' ? navigator.userAgent : '') || '');
  if (reel && estOrionIci()) return 'orion';
  if (/\bDuckDuckGo\/|\bDdg\//.test(u)) return 'duckduckgo';
  if (/Firefox\/|FxiOS\//.test(u)) return 'firefox';
  // Samsung Internet se présente AUSSI comme Chrome : on le lit avant (19 oct.).
  if (/SamsungBrowser\//.test(u)) return 'samsung';
  if (/\bEdg(?:e|A|iOS)?\//.test(u)) return 'edge';
  if (/\bOPR\/|\bOpera\b/.test(u)) return 'opera';
  if (/\bYaBrowser\//.test(u)) return 'yandex';
  if (/\bVivaldi\//.test(u)) return 'vivaldi';
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
  const parNav = { yandex: 'chrome', vivaldi: 'chrome' };
  const lien = nav === 'orion' ? boutiqueOrion() : (LIENS_BOUTIQUES[parNav[nav] || nav] || '');
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
// 20 octobre : la boutique de FIREFOX d'abord. Mesuré (forum d'Orion, fil
// 13760) : quand une extension déclare les deux fonds, Orion prend
// `background.scripts` — la forme du paquet Firefox ; et en 2023 un
// développeur voyait les extensions à service worker « Not compatible » sur
// Orion iOS (fil 3914). Le paquet Chrome (service worker seul) vient ensuite.
// Toujours une fiche PUBLIÉE, jamais un lien deviné.
export function boutiqueOrion() {
  return LIENS_BOUTIQUES.firefox || LIENS_BOUTIQUES.chrome || '';
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
  return { firefox: 'Firefox', samsung: 'Samsung Internet', edge: 'Edge', opera: 'Opera', chrome: 'Chrome', safari: 'Safari', orion: 'Orion', duckduckgo: 'DuckDuckGo', yandex: 'Yandex Browser', vivaldi: 'Vivaldi' }[navigateurIci(ua)] || 'ce navigateur';
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
  if (estIOS(ua)) return nav === 'orion' ? 'ios-orion' : 'ios';
  if (!estAndroid(ua)) return 'autre';
  if (nav === 'firefox') return 'firefox-android';
  if (nav === 'samsung') return 'samsung';
  if (nav === 'duckduckgo') return 'duckduckgo';
  return 'android';
}

// ══ CE NAVIGATEUR ACCEPTE-T-IL L'EXTENSION ? (20 octobre) ═══════════════════
// `paquet` : celui qui s'installe ici · `accepte` : 'oui' · 'non' · 'essai'
// (possible mais jamais essayé par VRM). Sources : docs/boutiques-extension.md.
// Un navigateur Android inconnu qui se dit « Chrome » (Lemur, Quetta, Edge…)
// est rangé avec Chrome pour Android : rien ne le distingue sûrement — si son
// extension répond, le pont le dit, et c'est lui qui fait foi.
export function extensionIci(ua) {
  const nav = navigateurIci(ua);
  const mob = mobileIci(ua);
  if (mob === 'ios-orion') return { accepte: 'essai', paquet: 'firefox' };
  if (mob === 'ios') return { accepte: 'non', paquet: null };
  if (mob === 'firefox-android') return { accepte: 'oui', paquet: 'firefox' };
  if (mob === 'samsung' || mob === 'duckduckgo' || mob === 'android') return { accepte: 'non', paquet: null };
  if (nav === 'firefox') return { accepte: 'oui', paquet: 'firefox' };
  if (nav === 'orion') return { accepte: 'essai', paquet: 'firefox' };
  if (nav === 'safari') return { accepte: 'non', paquet: 'safari' };
  if (nav === 'duckduckgo') return { accepte: 'non', paquet: null };
  return { accepte: 'oui', paquet: 'chromium' };
}

// ══ CE QUE L'EXTENSION DIT DE CE NAVIGATEUR (`nav` de l'état du pont) ═══════
// L'extension mesure elle-même les API qui lui manquent (Orion iPhone…) et dit
// ce qu'elle a REMPLACÉ et ce qui reste IMPOSSIBLE ici. Une phrase, une fois :
// vide quand tout est là (Chrome) — rien à dire.
const NOMS_API = { alarms: 'le réveil périodique', scripting: "l'exécution dans la page", downloads: 'les téléchargements', externe: 'le canal direct avec VRM', cookies: 'la lecture des cookies' };
export function phraseNavigateur(nav, ua) {
  if (!nav || typeof nav !== 'object') return '';
  const indispo = Array.isArray(nav.indispo) ? nav.indispo : [];
  const remplace = (Array.isArray(nav.remplace) ? nav.remplace : []).filter((k) => NOMS_API[k]);
  const ios = estIOS(ua);
  const qui = navigateurIci(ua) === 'orion' ? 'Orion' : 'Ce navigateur';
  const parts = [];
  if (indispo.includes('cookies')) parts.push(`${qui} ne laisse pas encore l'extension voir ta session Vinted : ouvre vinted.fr connecté, ici. Si ça reste ainsi, VRM ne peut rien capter dans ce navigateur — passe par un ordinateur.`);
  else if (indispo.includes('cookies-passu')) parts.push("Je n'ai pas pu vérifier si l'extension voit ta session Vinted ici.");
  if (remplace.length) parts.push(`${parts.length ? 'Pour le reste, il' : 'Il'} manque ici ${remplace.map((k) => NOMS_API[k]).join(', ')} : l'extension passe par un autre chemin et fait la même chose${ios ? ' — garde la page Vinted ouverte au premier plan pendant une capture : iOS met en pause ce qui passe en arrière-plan' : ''}.`);
  return parts.join(' ');
}
// La fiche Google Play de Firefox pour Android (adresse stable de Mozilla) :
// proposée seulement quand l'extension Firefox est PUBLIÉE — sinon installer
// Firefox ne servirait à rien.
export const LIEN_FIREFOX_ANDROID = 'https://play.google.com/store/apps/details?id=org.mozilla.firefox';
