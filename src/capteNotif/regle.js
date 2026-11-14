// ═══════════════════════════════════════════════════════════════════════════
// « L'EXTENSION A CAPTÉ » DANS L'APP (14 nov., extension 5.377) — les règles PURES
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « quand on se connecte dans un compte par exemple, l'extension capte des
// nouvelles choses, on a un petit popup qui dit que l'extension a capté ça ».
// Le service worker compte, PAR IDENTITÉ (n° de transaction, id d'annonce, n° de
// bordereau…), ce qu'une écriture RÉUSSIE vient de ranger et l'envoie à l'app ouverte
// (`notifierApp({ type: 'capte', lot })`, relayé par bridge.js en `vrm:ext`). Ici :
//   · ce qu'on dit (`partiesCapte`), jamais un « 0 » ;
//   · une fois par lot : un lot peut grossir tant que la carte du site ne l'a pas montré ;
//     l'app retient ce qu'elle a DÉJÀ dit de chaque lot (`resteADire`) et ne dit que le reste ;
//   · l'écran où mène « Voir » (`ecranCapte`) ;
//   · le réglage « Dire ce que l'extension capte » : celui de l'extension (la carte du logo
//     et Paramètres règlent LE MÊME, `brancherExtensionCapte`), sinon celui de ce navigateur.
// ═══════════════════════════════════════════════════════════════════════════
export const SORTES_CAPTE = Object.freeze(['ventes', 'achats', 'bordereaux', 'codes', 'versements', 'messages', 'offres', 'annonces']);
const LU_A_LA_CONNEXION = new Set(['ventes', 'achats', 'annonces', 'messages', 'offres']);
const SITES = new Set(['vinted', 'leboncoin', 'vestiaire']);

export function lotValide(l) {
  return !!(l && typeof l === 'object' && typeof l.lot === 'string' && /^[\w-]{1,40}$/.test(l.lot) && SITES.has(l.p) && l.n && typeof l.n === 'object');
}
// Les nombres à dire, dans l'ordre fixe ; un nombre nul ou illisible n'est jamais dit.
export function nombresCapte(l) {
  const out = [];
  if (!lotValide(l)) return out;
  for (const s of SORTES_CAPTE) { const n = Number(l.n[s]); if (Number.isInteger(n) && n > 0) out.push({ s, n }); }
  return out;
}
// `tr` : la traduction (src/i18n). À la connexion, « 14 annonces lues » ; sinon « 2 nouvelles ventes ».
export function partiesCapte(l, tr) {
  return nombresCapte(l).map(({ s, n }) => ({ s, n, texte: tr(l.relie && LU_A_LA_CONNEXION.has(s) ? `capte.lu.${s}` : `capte.s.${s}`, { n }) }));
}
// Ce qui reste à dire d'un lot : ses nombres moins ce que l'app a déjà dit de CE lot.
export function resteADire(l, dejaDit) {
  if (!lotValide(l)) return null;
  const d = (dejaDit && dejaDit[l.lot]) || {};
  const n = {};
  for (const { s, n: v } of nombresCapte(l)) { const r = v - (Number(d[s]) || 0); if (r > 0) n[s] = r; }
  return Object.keys(n).length ? Object.assign({}, l, { n }) : null;
}
export function noterDit(dejaDit, l) {
  const out = Object.assign({}, dejaDit || {});
  if (!lotValide(l)) return out;
  const avant = Object.assign({}, out[l.lot] || {});
  for (const { s, n } of nombresCapte(l)) avant[s] = (Number(avant[s]) || 0) + n;
  out[l.lot] = avant;
  const cles = Object.keys(out);
  for (const k of cles.slice(0, Math.max(0, cles.length - 50))) delete out[k];   // les 50 derniers lots suffisent
  return out;
}
// L'écran qui montre ce qui a été capté (la première sorte dite).
export function ecranCapte(l) {
  const p = lotValide(l) ? l.p : 'vinted';
  const premiere = (nombresCapte(l)[0] || {}).s;
  switch (premiere) {
    case 'ventes': case 'versements': return `?tab=ventes&site=${p}`;
    case 'achats': return '?tab=achats';
    case 'bordereaux': return '?tab=colis';
    case 'codes': return '?tab=retraits';
    case 'messages': case 'offres': return `?tab=messages&site=${p}`;
    case 'annonces': return '?tab=annonces';
    default: return '?tab=journee';
  }
}

// ── Le réglage, partagé avec l'extension ────────────────────────────────────
// App.jsx branche ici (une ligne) la lecture de l'état de l'extension et l'envoi du
// réglage (canal adressé `reglageCapte`) : ce module n'importe pas App.jsx.
export const CLE_CAPTE_LOCAL = 'vrm_capte_toast';
let ext = { coupe: () => null, regler: () => Promise.resolve(null) };
const abonnes = new Set();
export function brancherExtensionCapte(o) { if (o && typeof o.coupe === 'function' && typeof o.regler === 'function') ext = o; }
const lireLocal = () => { try { const v = localStorage.getItem(CLE_CAPTE_LOCAL); return v === 'non' ? true : v === 'oui' ? false : null; } catch (_) { return null; } };
// Le DERNIER geste connu gagne pendant une minute (le sien ici, ou celui fait sur la
// carte du logo et annoncé par l'extension) : l'état de l'extension n'est relu que
// toutes les 20 s, le bouton ne doit pas revenir en arrière entre-temps.
let dernier = null;   // { coupe, at }
if (typeof window !== 'undefined') {
  try {
    window.addEventListener('vrm:ext', (e) => {
      const ev = e && e.detail;
      if (ev && ev.type === 'maj' && ev.quoi === 'capteReglage' && typeof ev.coupe === 'boolean') { dernier = { coupe: ev.coupe, at: Date.now() }; abonnes.forEach((f) => { try { f(); } catch (_) {} }); }
    });
  } catch (_) {}
}
// true = coupé · false = allumé (par défaut).
export function capteCoupe() {
  if (dernier && Date.now() - dernier.at < 60000) return dernier.coupe;
  let e = null; try { e = ext.coupe(); } catch (_) { e = null; }
  if (e === true || e === false) return e;
  return lireLocal() === true;
}
export function capteCoupeConnuDeLExtension() { try { const e = ext.coupe(); return e === true || e === false; } catch (_) { return false; } }
export async function reglerCapte(coupe) {
  try { localStorage.setItem(CLE_CAPTE_LOCAL, coupe ? 'non' : 'oui'); } catch (_) {}
  dernier = { coupe: coupe === true, at: Date.now() };
  abonnes.forEach((f) => { try { f(); } catch (_) {} });
  let r = null; try { r = await ext.regler(coupe === true); } catch (_) { r = null; }
  abonnes.forEach((f) => { try { f(); } catch (_) {} });
  return !!(r && r.ok);
}
export function abonnerReglageCapte(f) { abonnes.add(f); return () => abonnes.delete(f); }
