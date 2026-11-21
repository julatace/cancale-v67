// ═══════════════════════════════════════════════════════════════════════════
// LE FREIN DES SESSIONS D'EXTENSION, EN BASE (12 nov., M54 de la revue serveur)
// ═══════════════════════════════════════════════════════════════════════════
// `api/compte.js?mode=session-extension` fabrique au plus FORK_MAX sessions par
// vendeur et par heure glissante. Le frein vivait en mémoire d'instance : avec
// plusieurs instances Vercel, le plafond était multiplié. Il vit maintenant dans
// la ligne `ext_fork_frein` du vendeur (horodatages de l'heure), écrite par
// comparer-et-échanger (`modifierLigneCas`) : deux instances simultanées ne
// peuvent pas prendre la même place.
// « Pas su » (base injoignable, toujours devancé) ⇒ le frein en mémoire d'avant
// (un frein doux contre une boucle de l'extension) : jamais un refus inventé,
// jamais une porte ouverte sans aucun frein.
// Tenu par scripts/audit-revue-fin.cjs (M54).
// ═══════════════════════════════════════════════════════════════════════════
import { modifierLigneCas } from './cas.js';

export const FORK_MAX = 6;                 // sessions fabriquées par vendeur…
export const FORK_FENETRE = 3600 * 1000;   // …par heure glissante
export const ID_FREIN_FORK = 'ext_fork_frein';

// Le calcul pur : rend { attente (s), essais (liste à écrire, ou undefined si plein) }.
export function prendrePlace(essais, maintenant) {
  const recents = (Array.isArray(essais) ? essais : []).map(Number).filter((t) => Number.isFinite(t) && maintenant - t < FORK_FENETRE && t <= maintenant + 60000).sort((a, b) => a - b);
  if (recents.length >= FORK_MAX) return { attente: Math.max(1, Math.ceil((recents[0] + FORK_FENETRE - maintenant) / 1000)), essais: undefined };
  return { attente: 0, essais: [...recents, maintenant] };
}

// Le frein en mémoire (secours quand la base ne répond pas).
const enMemoire = new Map();
export function freinMemoire(uid, maintenant = Date.now()) {
  if (enMemoire.size > 5000) for (const [k, v] of enMemoire) if (!v.some((t) => maintenant - t < FORK_FENETRE)) enMemoire.delete(k);
  const r = prendrePlace(enMemoire.get(uid), maintenant);
  if (r.essais) enMemoire.set(uid, r.essais);
  return r.attente;
}

// Le frein partagé par toutes les instances. Rend le nombre de secondes à
// attendre (0 = passe). `url`/`entetes` : base + clé de service.
export async function freinFork({ uid, url, entetes, maintenant = Date.now(), fetcher }) {
  if (!uid) return 0;
  if (url && entetes) {
    let attente = 0;
    const r = await modifierLigneCas({
      url, entetes, owner: uid, id: ID_FREIN_FORK, ...(fetcher ? { fetcher } : {}),
      modifier: (d) => {
        const p = prendrePlace(d && d.essais, maintenant);
        attente = p.attente;
        return p.essais ? { essais: p.essais } : undefined;
      },
    });
    if (r === true) return 0;
    if (r === false) return attente;                   // lu : plein
  }
  return freinMemoire(uid, maintenant);                // pas su : le frein doux d'avant
}
