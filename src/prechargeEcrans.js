// ════════════════════════════════════════════════════════════════════════════
//  PRÉCHARGER L'ÉCRAN LE PLUS PROBABLE (11 nov., lot « chargement léger »,
//  docs/passation/2026-11-11-chargement-leger.md)
//
//  Les gros écrans (Réglages, Statistiques, Argent, Stock, eBay, Leboncoin,
//  Vestiaire…) sont des morceaux chargés quand on les ouvre : la PREMIÈRE ouverture
//  d'un de ces écrans attend son téléchargement (la pastille « Ouverture… » ou le
//  squelette). Ici, CET appareil retient lesquels il ouvre (un compteur par famille,
//  `localStorage`, une commodité de l'appareil — aucune donnée du vendeur) ; quand
//  l'écran de l'ouverture est STABLE (plus aucune attente à l'écran) et que la page
//  est calme, les deux familles les plus ouvertes ici (au moins 2 fois) sont
//  téléchargées en fond. Rien n'est affiché, rien n'est écrit en base.
//  Jamais : en « économie de données », en 2G, page cachée, ou avant que l'écran soit
//  stable (le préchargement ne prend jamais la bande passante de l'ouverture).
//  Un échec ne dit rien : l'écran se chargera à son ouverture, comme avant.
//  Banc : scripts/bancs/precharge-ecrans.cjs.
// ════════════════════════════════════════════════════════════════════════════

export const CLE_FREQUENTS = 'vrm_ecrans_frequents';
export const MAX_PRECHARGES = 2;
export const MIN_VISITES = 2;
export const CALME_MS = 3000;        // l'écran doit rester sans attente ce temps-là
export const ATTENTE_MAX_MS = 60000; // au-delà, on renonce (écran resté en attente)

// La famille (le morceau) d'un écran : tab + site courant + sous-section.
// '' = un écran du morceau App (Ma journée, Colis, Ventes et Annonces Vinted…) : rien à précharger.
export function familleEcran(tab, site, sub) {
  const t = String(tab || ''), s = String(site || ''), u = String(sub || '');
  if (t === 'settings' || t === 'vintedaccounts') return 'reglages';
  if (t === 'dashboard') return u === 'prix' ? 'prix' : 'stats';
  if (t === 'compta') return 'compta';
  if (t === 'garage' || t === 'stockvinted' || t === 'inventory') return 'stock';
  if (t === 'communaute') return 'communaute';
  if (t === 'organisation') return 'operations';
  if (t === 'emails') return 'emails';
  if (t === 'plat_leboncoin' || s === 'leboncoin') return 'leboncoin';
  if (t === 'plat_ebay' || /^ebay_/.test(t) || s === 'ebay') return 'ebay';
  if (t === 'plat_vestiaire' || s === 'vestiaire') return 'vestiaire';
  return '';
}

const lire = (stockage) => {
  try { const o = JSON.parse(stockage.getItem(CLE_FREQUENTS) || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch (_) { return {}; }
};

// Une visite de plus pour cette famille (au plus une par famille et par page).
const vuesCettePage = new Set();
export function noterEcranVu(famille, stockage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!famille || !stockage || vuesCettePage.has(famille)) return;
  vuesCettePage.add(famille);
  try {
    const o = lire(stockage);
    o[famille] = Math.min(1000, (Number(o[famille]) || 0) + 1);
    stockage.setItem(CLE_FREQUENTS, JSON.stringify(o));
  } catch (_) { /* stockage refusé : rien */ }
}

// Les familles à précharger, les plus ouvertes d'abord (égalité : ordre alphabétique,
// pour un résultat stable), sauf celle de l'écran courant.
export function famillesProbables(frequents, courante = '', connues = null) {
  return Object.entries(frequents || {})
    .filter(([f, n]) => f && f !== courante && Number(n) >= MIN_VISITES && (!connues || connues.includes(f)))
    .sort((a, b) => (Number(b[1]) - Number(a[1])) || (a[0] < b[0] ? -1 : 1))
    .slice(0, MAX_PRECHARGES)
    .map(([f]) => f);
}

// Le réseau permet-il un téléchargement de fond ?
export function reseauPermet(nav = (typeof navigator !== 'undefined' ? navigator : null)) {
  const c = nav && nav.connection;
  if (!c) return true;
  if (c.saveData) return false;
  return !/(^|-)2g$/.test(String(c.effectiveType || ''));
}

// L'écran est-il stable ? Plus aucune attente (`AttenteEcran` en « attente » ou en
// « instantané »), plus de squelette ni de pastille « Ouverture… », écran de démarrage parti.
export function ecranStable(doc = (typeof document !== 'undefined' ? document : null)) {
  if (!doc || doc.visibilityState === 'hidden') return false;
  if (doc.readyState !== 'complete') return false;
  if (!doc.querySelector('[data-attente]')) return false;   // aucun écran monté encore
  return !doc.querySelector('[data-attente="attente"],[data-attente="instantane"],[data-morceau-attente],[data-demarrage-attente],[data-demarrage-vrm],.vrm-skeleton');
}

// Lance le préchargement une fois l'ouverture stable. `chargeurs` : { famille: () => import(…) }.
// `courante()` rend la famille de l'écran au moment du lancement. Rend une fonction d'arrêt.
let dejaLance = false;
export function prechargerApresOuverture(chargeurs, courante = () => '', options = {}) {
  if (dejaLance || typeof window === 'undefined') return () => {};
  const stockage = options.stockage || (typeof localStorage !== 'undefined' ? localStorage : null);
  const calmeMs = options.calmeMs || CALME_MS;
  let arret = false, minuteur = null, stableDepuis = 0;
  const debut = Date.now();
  const lancer = () => {
    if (arret || dejaLance) return;
    dejaLance = true;
    if (!reseauPermet()) return;
    const choisies = famillesProbables(stockage ? lire(stockage) : {}, courante(), Object.keys(chargeurs));
    // une à la fois : jamais deux gros téléchargements de fond en même temps
    choisies.reduce((p, f) => p.then(() => {
      if (arret) return null;
      try { window.__vrmPrecharges = (window.__vrmPrecharges || []).concat([{ famille: f, at: Date.now() }]); } catch (_) {}
      return Promise.resolve().then(chargeurs[f]).catch(() => null);
    }), Promise.resolve());
  };
  const tic = () => {
    if (arret) return;
    if (Date.now() - debut > ATTENTE_MAX_MS) { arret = true; return; }
    if (ecranStable()) {
      if (!stableDepuis) stableDepuis = Date.now();
      if (Date.now() - stableDepuis >= calmeMs) {
        const ric = window.requestIdleCallback;
        if (typeof ric === 'function') ric(lancer, { timeout: 4000 }); else setTimeout(lancer, 0);
        return;
      }
    } else stableDepuis = 0;
    minuteur = setTimeout(tic, 500);
  };
  minuteur = setTimeout(tic, 500);
  return () => { arret = true; if (minuteur) clearTimeout(minuteur); };
}
