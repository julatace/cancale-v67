// api/_lib/ebay-relecture.js
// ────────────────────────────────────────────────────────────────────────────
// RELIRE LES COMMANDES eBAY SANS AUCUN GESTE (20 octobre).
// Julien : « pour eBay ça doit se relire tout seul ou se rafraîchir à
// l'ouverture de l'app, mais je dois rien avoir à faire ».
//
// UNE lecture (la page 0 de l'API Fulfillment, exactement celle de la synchro
// complète `handleSync`), rangée de la MÊME façon (`fusionCommandesEbay` en
// comparer-et-échanger : une lecture ratée de la ligne n'écrit rien, une
// commande déjà rangée garde ce qu'on en savait). Deux appelants :
//   · `api/ebay.js` action `relire` (l'app, à l'ouverture et toutes les ~10 min
//     tant qu'elle est ouverte et visible) ;
//   · `api/ship-reminders.js` (le cron du matin, app fermée), AVANT de compter
//     les colis à poster : le rappel compte les ventes eBay de la nuit.
// Aucune règle d'argent ni de colis ici (`colisEbay`, `montantRecuEbay` ne
// bougent pas) : on ne fait que déclencher la lecture.
// « Pas su » (eBay ou la base qui ne répond pas) ⇒ rien n'est écrit, la
// dernière capture reste — jamais une liste vide à sa place.
// ────────────────────────────────────────────────────────────────────────────
import crypto from 'crypto';
import { accessToken, modifierDonnee, lireComptes, comptesActifs, keysReady } from './ebay.js';
import { fusionCommandesEbay } from './ebay-synchronisation.js';

const EBAY_API = 'https://api.ebay.com';
export const URL_COMMANDES = `${EBAY_API}/sell/fulfillment/v1/order?limit=50`;

async function ebayJson(url, token) {
  try {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
    const txt = await r.text();
    let j = null; try { j = JSON.parse(txt); } catch (_) {}
    return { status: r.status, ok: r.ok, data: j };
  } catch (e) { return { status: 0, ok: false, data: null }; }
}

// Les commandes d'UN compte eBay de CE vendeur. `token` facultatif (la route
// a déjà le sien). Rend `{ ok, range, reason?, status? }` : `range === true`
// seulement si la base a CONFIRMÉ l'écriture.
export async function relireCommandesCompte({ owner, compte, token }) {
  const suffixe = (compte && compte.suffixe) || '';
  let jeton = token;
  if (!jeton) {
    let at;
    try { at = await accessToken(owner, suffixe); } catch (_) { at = { ok: false, status: 502, reason: 'refresh-failed' }; }
    if (!at.ok) return { ok: false, range: false, reason: at.reason || 'jeton', status: at.status || 502 };
    jeton = at.token;
  }
  const orders = await ebayJson(URL_COMMANDES, jeton);
  if (!orders.ok || !orders.data || !Array.isArray(orders.data.orders)) {
    return { ok: false, range: false, reason: orders.status === 0 ? 'ebay-injoignable' : 'ebay', status: orders.status >= 400 ? orders.status : 502 };
  }
  const at2 = Date.now();
  const gen = crypto.randomUUID();
  // La forme est vérifiée AVANT d'écrire (une réponse que la fusion refuse ne
  // remplace rien) — la même garde que `handleSync`.
  if (!fusionCommandesEbay(null, orders.data, at2, gen)) return { ok: false, range: false, reason: 'forme', status: 502 };
  const r = await modifierDonnee('ebay_orders' + suffixe, owner, (d) => {
    const f = fusionCommandesEbay(d, orders.data, at2, gen);
    return f ? { ...f, status: orders.status } : undefined;
  });
  return { ok: r === true, range: r === true, reason: r === true ? undefined : (r === null ? 'base' : 'ecriture'), status: r === true ? 200 : 503, lues: orders.data.orders.length, capturedAt: at2 };
}

// Toutes les commandes eBay d'UN vendeur (ses comptes ACTIFS, chacun avec SON
// jeton), l'un après l'autre (quelques comptes au plus par vendeur). Un compte
// qui échoue n'empêche pas les autres. Rend `{ fait, comptes: [{suffixe, ok,
// reason}] }` — `fait:false` si le registre est illisible ou eBay pas
// configuré (rien n'a été tenté).
export async function relireCommandesVendeur(owner) {
  if (!keysReady()) return { fait: false, reason: 'no-key', comptes: [] };
  let reg;
  try { reg = await lireComptes(owner); } catch (_) { reg = undefined; }
  if (reg === undefined) return { fait: false, reason: 'registre', comptes: [] };
  const comptes = comptesActifs(reg);
  const out = [];
  for (const c of comptes) {
    let r;
    try { r = await relireCommandesCompte({ owner, compte: c }); } catch (_) { r = { ok: false, reason: 'erreur' }; }
    // Un principal sous-entendu sans jeton : aucun compte eBay relié — pas un échec.
    if (!r.ok && r.reason === 'not-connected') { out.push({ suffixe: c.suffixe || '', ok: null, reason: 'not-connected' }); continue; }
    out.push({ suffixe: c.suffixe || '', ok: r.ok === true, reason: r.reason });
  }
  return { fait: true, comptes: out };
}
