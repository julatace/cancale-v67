// ── LES LECTURES RÉCENTES, POUR « SIGNALER UN PROBLÈME » (8 nov.) ─────────────
// « L'écran Colis reste vide » : était-ce la base qui refusait (401, 503), le
// réseau coupé, ou l'écran ? Sans ce journal, un signalement ne le disait pas.
// Ici, les 30 dernières requêtes de la PAGE, en mémoire seulement (rien sur
// l'appareil, rien envoyé tout seul) : la MÉTHODE, la FAMILLE (« base:app_data »,
// « api:compte:signalement », « auth »…), le code HTTP (0 = pas de réponse),
// la durée et l'heure. JAMAIS l'adresse, ses paramètres, un en-tête, un corps
// ni une réponse : une famille se lit dans le chemin, sous des formes fermées
// (le filtre du serveur, `normaliserSignalement`, les revérifie).
export const LECTURES_GARDEES = 30;
const journal = [];

const NOM = /^[a-z][a-z0-9_-]{0,39}$/;
// La famille d'une requête, ou `null` (rien d'autre ne se note).
export function familleRequete(u, origine = '') {
  let url;
  try { url = new URL(String(u || ''), origine || 'https://vrm.center'); } catch (_) { return null; }
  const p = url.pathname;
  let m;
  if ((m = /^\/rest\/v1\/rpc\/([^/]+)/.exec(p))) return NOM.test(m[1]) ? 'base:rpc:' + m[1] : 'base:rpc';
  if ((m = /^\/rest\/v1\/([^/]+)/.exec(p))) return NOM.test(m[1]) ? 'base:' + m[1] : 'base';
  if (/^\/auth\/v1\//.test(p)) return 'auth';
  if (/^\/storage\/v1\//.test(p)) return 'stockage';
  if ((m = /^\/api\/([^/?#]+)/.exec(p))) {
    const fn = m[1].replace(/\.js$/, '').toLowerCase();
    if (!NOM.test(fn)) return 'api';
    const mode = String(url.searchParams.get('mode') || '').toLowerCase();
    return 'api:' + fn + (mode && NOM.test(mode) ? ':' + mode : '');
  }
  if (url.origin === origine) return null;   // un fichier de l'app (morceau, image) : pas une lecture
  return 'autre';
}

export function noterLecture(x) {
  journal.push(x);
  if (journal.length > LECTURES_GARDEES) journal.splice(0, journal.length - LECTURES_GARDEES);
}
export const lecturesRecentes = () => journal.slice(-LECTURES_GARDEES).map((x) => ({ ...x }));

// Enveloppe `window.fetch` une fois. Le résultat et l'erreur sont rendus TELS QUELS.
export function installerJournalLectures() {
  try {
    if (typeof window === 'undefined' || typeof window.fetch !== 'function' || window.__vrmJournalLectures) return;
    window.__vrmJournalLectures = true;
    const avant = window.fetch;
    const origine = window.location.origin;
    window.fetch = function (input, init) {
      let quoi = null, m = 'GET';
      try {
        quoi = familleRequete(typeof input === 'string' ? input : (input && input.url) || String(input || ''), origine);
        m = String((init && init.method) || (input && typeof input === 'object' && input.method) || 'GET').toUpperCase();
      } catch (_) { quoi = null; }
      const p = avant.apply(this, arguments);
      if (!quoi) return p;
      const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      const fin = (s) => { try { noterLecture({ m, quoi, s, ms: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0), at: new Date().toISOString() }); } catch (_) {} };
      p.then((r) => fin(Number(r && r.status) || 0), () => fin(0));
      return p;
    };
  } catch (_) {}
}
