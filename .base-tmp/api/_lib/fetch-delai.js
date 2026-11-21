// ═══════════════════════════════════════════════════════════════════════════
// CHAQUE APPEL SORTANT A UN DÉLAI (11 nov., lot « familles-serveur », M33-M48)
// ═══════════════════════════════════════════════════════════════════════════
// Un `fetch(` sans délai attend jusqu'à ce que Vercel coupe la fonction : la
// route ne répond RIEN (pas de 503 propre), le collecteur d'e-mails ne sait pas
// s'il doit rejouer, le cron perd le reste du lot. Mesuré dans la revue : Stripe,
// eBay, Anthropic, Vinted, Overpass, Nominatim et Supabase lui-même.
//
// `fetchAvecDelai(url, options, ms)` est LE seul `fetch` du serveur :
//   · un délai par service (table ci-dessous), ou `ms` donné par l'appelant ;
//   · un `signal` déjà posé par l'appelant est GARDÉ et combiné au délai
//     (le premier des deux qui tombe coupe) ;
//   · délai dépassé ⇒ l'appel REJETTE (`TimeoutError`) comme une panne réseau :
//     chaque appelant a déjà sa branche « réseau injoignable » (503, `null`,
//     « pas su ») — un délai dépassé n'est jamais « rien ».
// Tenu par scripts/audit-familles-serveur.cjs (famille 1) : aucun `fetch`
// nu dans api/ hors de ce fichier, et le délai coupe vraiment (exécuté).
// ═══════════════════════════════════════════════════════════════════════════

// Délais par service, en millisecondes. Un service lent ne mange pas le temps
// de la fonction ; un PDF ou une image a un peu plus.
export const DELAIS_SORTANTS = [
  [/(^|\.)supabase\.(co|in)\b/i, 10000],
  [/(^|\.)stripe\.com$/i, 10000],
  [/(^|\.)anthropic\.com$/i, 25000],
  [/(^|\.)ebay\.(com|fr|co\.uk|de|it|es)$/i, 10000],
  [/(^|\.)vinted\./i, 10000],
  [/overpass/i, 8000],
  [/nominatim/i, 8000],
  [/(^|\.)photoroom\.com$/i, 30000],
];
export const DELAI_DEFAUT_MS = 10000;

export function delaiPour(url) {
  let hote = '';
  try { hote = new URL(String(url)).hostname; } catch (_) { hote = ''; }
  for (const [re, ms] of DELAIS_SORTANTS) if (re.test(hote)) return ms;
  return DELAI_DEFAUT_MS;
}

// Plafond pour les bancs seulement (un banc ne peut pas attendre 10 s par appel
// suspendu) : jamais posé en production.
function plafond(ms) {
  const p = Number(process.env.VRM_DELAI_SORTANT_MAX_MS);
  return p > 0 ? Math.min(ms, p) : ms;
}

// Un appelant qui pose DÉJÀ son `signal` (souvent `AbortSignal.timeout(25000)`,
// Trading eBay, PDF) a choisi son délai : on ne le raccourcit pas, on garde
// seulement un filet extérieur.
export const DELAI_FILET_MS = 60000;

export function fetchAvecDelai(url, options = {}, ms) {
  const opts = options && typeof options === 'object' ? options : {};
  const duree = plafond(Number(ms) > 0 ? Number(ms) : opts.signal ? DELAI_FILET_MS : delaiPour(url));
  // AbortController + minuterie `unref` : le délai couvre AUSSI la lecture du
  // corps (une réponse qui s'arrête au milieu ne bloque pas), et la minuterie ne
  // retient pas le processus (bancs).
  const ctrl = new AbortController();
  const minuterie = setTimeout(() => {
    const e = new Error(`délai dépassé (${duree} ms)`); e.name = 'TimeoutError';
    ctrl.abort(e);
  }, duree);
  if (minuterie && typeof minuterie.unref === 'function') minuterie.unref();
  const signaux = [ctrl.signal];
  if (opts.signal) signaux.push(opts.signal);
  const signal = signaux.length > 1 && typeof AbortSignal.any === 'function' ? AbortSignal.any(signaux) : ctrl.signal;
  return globalThis.fetch(url, { ...opts, signal });
}

export default fetchAvecDelai;
