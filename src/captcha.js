// ── LA VÉRIFICATION ANTI-ROBOT (Cloudflare Turnstile) — 20 octobre ──────────
// Demande de Julien : « des anti-bot, des captcha… pour éviter tout problème »,
// avant d'ouvrir VRM à d'autres vendeurs.
//
// Supabase Auth (GoTrue) sait exiger un jeton captcha sur les routes qu'un robot
// martèle : `/signup`, `/token?grant_type=password`, `/otp`, `/magiclink`,
// `/recover`, `/resend` (lu dans le code de GoTrue, `internal/api/api.go` et
// `middleware.go` : `verifyCaptcha`). Le jeton part DANS LE CORPS JSON, sous
// `gotrue_meta_security.captcha_token`. Un renouvellement de session
// (`refresh_token`), le retour OAuth (`pkce`) et les appels « admin » (clé de
// service) n'y sont PAS soumis.
//
// ⚠️⚠️ L'ORDRE DES GESTES COMPTE — se tromper, c'est enfermer tout le monde dehors :
//   1. créer le site Turnstile chez Cloudflare (domaine vrm.center) ;
//   2. poser sa clé de SITE (publique) ici, ou dans la variable Vercel
//      `VITE_TURNSTILE_SITE_KEY`, puis déployer : l'app envoie le jeton ;
//   3. SEULEMENT ENSUITE activer Turnstile dans Supabase (Authentication →
//      Attack Protection) avec la clé SECRÈTE — jamais dans ce dépôt (public).
//   Dans l'autre ordre, Supabase refuse toute connexion qui n'a pas de jeton.
//
// RÈGLE : clé vide ⇒ AUCUN widget, AUCUN chargement chez Cloudflare, et les
// appels partent EXACTEMENT comme avant. Rien ne change le jour du déploiement.
export const TURNSTILE_SITE_KEY = String(
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_TURNSTILE_SITE_KEY) || ''
).trim();

export const URL_TURNSTILE = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__vrmTurnstilePret';
const DELAI_CHARGEMENT = 12000;

export const captchaActif = () => !!TURNSTILE_SITE_KEY;

// Les routes de GoTrue qui exigent le jeton quand la protection est allumée.
// `path` est celui d'`authCall` (`signup?redirect_to=…`, `token?grant_type=…`).
export function routeProtegee(path) {
  const [base, q = ''] = String(path || '').split('?');
  if (base === 'token') return new URLSearchParams(q).get('grant_type') === 'password';
  return ['signup', 'otp', 'magiclink', 'recover', 'resend'].includes(base);
}

// ── L'état partagé : un widget par écran de connexion, un jeton à usage unique ─
// statut : 'inactif' · 'charge' (script ou défi invisible en cours) ·
//          'interactif' (Cloudflare demande de cocher la case) · 'pret' (jeton) ·
//          'erreur' (le widget n'a pas pu se charger — on le DIT, jamais un bouton muet)
let etat = { statut: captchaActif() ? 'charge' : 'inactif', jeton: null, raison: '' };
const abonnes = new Set();
let widgetId = null;
const poser = (p) => { etat = { ...etat, ...p }; abonnes.forEach((f) => { try { f(etat); } catch (_) {} }); };
export const etatCaptcha = () => etat;
export const abonnerCaptcha = (f) => { abonnes.add(f); return () => abonnes.delete(f); };
export const jetonCaptcha = () => (etat.statut === 'pret' && etat.jeton) ? etat.jeton : null;

// Un jeton Turnstile ne sert qu'UNE fois : après chaque appel protégé, on en
// redemande un neuf (le widget se relance tout seul, le plus souvent sans clic).
export function consommerCaptcha() {
  if (!captchaActif()) return;
  poser({ statut: 'charge', jeton: null });
  try { if (widgetId != null && window.turnstile) window.turnstile.reset(widgetId); } catch (_) { poser({ statut: 'erreur', raison: 'reset' }); }
}

// Le corps envoyé à GoTrue : inchangé si la protection n'est pas posée côté app.
export function corpsAvecCaptcha(path, body) {
  if (!captchaActif() || !routeProtegee(path)) return body;
  const jeton = jetonCaptcha();
  return jeton ? { ...body, gotrue_meta_security: { captcha_token: jeton } } : body;
}

export const MSG_CAPTCHA_ATTENTE = "Termine d'abord la vérification anti-robot (la case juste au-dessus du bouton), puis réessaie.";
export const MSG_CAPTCHA_REFUS = "La vérification anti-robot a expiré ou a été refusée. Elle se relance au-dessus du bouton — attends qu'elle soit validée, puis réessaie.";
export const MSG_CAPTCHA_ERREUR = "La vérification anti-robot n'a pas pu se charger : challenges.cloudflare.com ne répond pas sur ce réseau. Désactive un bloqueur de publicité ou de traqueurs pour vrm.center (ou change de réseau), puis touche « Réessayer ».";

// ── Chargement du script de Cloudflare, une fois, AU MOMENT de l'écran ───────
let promesse = null;
export function chargerTurnstile() {
  if (!captchaActif()) return Promise.resolve(null);
  if (typeof window !== 'undefined' && window.turnstile) return Promise.resolve(window.turnstile);
  if (promesse) return promesse;
  promesse = new Promise((res, rej) => {
    let fini = false;
    const echec = (r) => { if (fini) return; fini = true; promesse = null; rej(new Error(r)); };
    const t = setTimeout(() => echec('delai'), DELAI_CHARGEMENT);
    window.__vrmTurnstilePret = () => { if (fini) return; fini = true; clearTimeout(t); res(window.turnstile); };
    const s = document.createElement('script');
    s.src = URL_TURNSTILE; s.async = true; s.defer = true;
    s.onerror = () => { clearTimeout(t); try { s.remove(); } catch (_) {} echec('reseau'); };
    document.head.appendChild(s);
  });
  return promesse;
}

// Monte le widget dans `el`. Rend une fonction qui le retire.
export function monterWidget(el, { sombre } = {}) {
  if (!captchaActif() || !el) return () => {};
  let vivant = true;
  poser({ statut: 'charge', jeton: null, raison: '' });
  chargerTurnstile().then((ts) => {
    if (!vivant || !ts) return;
    try {
      widgetId = ts.render(el, {
        sitekey: TURNSTILE_SITE_KEY,
        language: 'fr',
        theme: sombre ? 'dark' : 'light',
        size: 'flexible',
        'refresh-expired': 'auto',
        callback: (j) => poser({ statut: 'pret', jeton: String(j || '') || null }),
        'before-interactive-callback': () => poser({ statut: 'interactif', jeton: null }),
        'expired-callback': () => poser({ statut: 'charge', jeton: null }),
        'timeout-callback': () => poser({ statut: 'interactif', jeton: null }),
        'error-callback': (code) => { poser({ statut: 'erreur', jeton: null, raison: String(code || 'widget') }); return true; },
      });
    } catch (e) { poser({ statut: 'erreur', jeton: null, raison: 'render' }); }
  }).catch((e) => { if (vivant) poser({ statut: 'erreur', jeton: null, raison: (e && e.message) || 'chargement' }); });
  return () => {
    vivant = false;
    try { if (widgetId != null && window.turnstile) window.turnstile.remove(widgetId); } catch (_) {}
    widgetId = null;
  };
}
