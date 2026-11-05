// ── LE FREIN DU RELAIS SERVEUR VERS VINTED (5 novembre) ─────────────────────
// `/api/vinted-proxy` interroge Vinted DEPUIS L'ADRESSE DU SERVEUR de VRM, avec
// les jetons du compte rangés en base (et les renouvelle là-bas sur un 401).
// Mesuré dans le code le 5 nov. : « Relire les données des comptes » (Messages),
// « Réessayer » sous Ventes / Achats / Annonces et la flèche ↻ de Messages
// lançaient ce relais pour TOUS les comptes en même temps, jusqu'à 22 pages par
// compte, à chaque appui — le motif « plusieurs comptes pilotés depuis un même
// serveur » que le journal accuse d'avoir fait bloquer un compte (§3).
//
// Deux règles :
//   1. une relecture demandée (bouton) relit la COPIE captée par l'extension
//      (aucune requête à Vinted) ; seule l'extension, dans son navigateur et au
//      nom du compte connecté, va chercher du neuf ;
//   2. ce relais, quand il sert encore (compte jamais capté), est FREINÉ par
//      compte : au plus `MAX_PAR_FENETRE` requêtes par `FENETRE_MS`, comptées sur
//      cet appareil (rangé, donc tenu d'un onglet à l'autre et après un
//      rechargement). Au-delà, rien ne part et l'écran garde ce qu'il montre.
export const FENETRE_MS = 30 * 60 * 1000;
export const MAX_PAR_FENETRE = 24;
export const CLE_FREIN = 'vrm_frein_relais_vinted';

const lire = (stock) => {
  try { const v = JSON.parse(stock.getItem(CLE_FREIN) || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
  catch (_) { return {}; }
};

// Rend `{ ok: true }` (et compte la requête) ou `{ ok: false, resteMs }` sans
// rien compter. Un stockage illisible ou inscriptible : on REFUSE (« pas su »
// ne vaut pas « oui » — sans compteur, rien ne freinerait).
export function prendrePlaceRelais(uid, maintenant, stock) {
  const k = String(uid || '');
  if (!k || !stock) return { ok: false, resteMs: FENETRE_MS };
  let tout;
  try { tout = lire(stock); } catch (_) { return { ok: false, resteMs: FENETRE_MS }; }
  const garde = (Array.isArray(tout[k]) ? tout[k] : []).filter((t) => Number.isFinite(t) && t <= maintenant && maintenant - t < FENETRE_MS);
  if (garde.length >= MAX_PAR_FENETRE) return { ok: false, resteMs: FENETRE_MS - (maintenant - Math.min(...garde)) };
  garde.push(maintenant);
  const suite = {};
  for (const [u, l] of Object.entries(tout)) {
    const f = (Array.isArray(l) ? l : []).filter((t) => Number.isFinite(t) && maintenant - t < FENETRE_MS);
    if (f.length) suite[u] = f;
  }
  suite[k] = garde;
  try { stock.setItem(CLE_FREIN, JSON.stringify(suite)); } catch (_) { return { ok: false, resteMs: FENETRE_MS }; }
  return { ok: true };
}
