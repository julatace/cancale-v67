// Le navigateur d'ici, lu dans l'agent utilisateur (sorti de src/navigateurExtension.js le 16 nov.,
// lot vitesse-lectures : le fichier d'entrée de la page d'accueil n'emporte plus tout le module).
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
  // (5 nov.) Brave se présente comme Chrome mais pose `navigator.brave` (son
  // repère documenté) : on ne lui dit pas « Chrome ».
  try { if (reel && typeof navigator !== 'undefined' && navigator.brave) return 'brave'; } catch (_) {}
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
