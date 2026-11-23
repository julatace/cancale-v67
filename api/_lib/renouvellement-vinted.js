// ═══════════════════════════════════════════════════════════════════════════
// LE RENOUVELLEMENT DES JETONS VINTED, UN SEUL À LA FOIS PAR COMPTE
// (16 nov., H21/H22 de la revue serveur)
// ═══════════════════════════════════════════════════════════════════════════
// Le refresh de Vinted est ROTATIF : chaque renouvellement consomme l'ancien
// refresh_token. Avant, deux relais simultanés (deux onglets, le relais + le
// renouvellement planifié) renouvelaient en parallèle avec le MÊME ancien
// jeton, et le second pouvait invalider le premier ; l'écriture, sans
// condition, pouvait aussi écraser une paire neuve posée entre-temps (par
// l'extension, qui reconnecte le compte depuis le navigateur).
// Règle :
//   1. un BAIL par compte (`vinted_renouv_{uid}`, ligne du vendeur, comparer-
//      et-échanger) : un seul renouvelle ; l'autre attend que la paire change
//      en base (≤ 3 s) et la reprend, sans rappeler Vinted ;
//   2. la base est RELUE juste avant de renouveler : une paire déjà changée
//      est prise telle quelle ;
//   3. l'écriture est CONDITIONNELLE (`refresh_token=eq.<celui qu'on a
//      consommé>`) : jamais par-dessus une paire posée entre-temps ; 3 essais ;
//   4. bail illisible (« pas su ») ⇒ le chemin d'avant (relecture + écriture
//      conditionnelle tiennent encore) — jamais un refus inventé.
// Les jetons ne sortent JAMAIS du serveur (revue de sécurité du 12 nov.).
// Tenu par scripts/audit-serveur-robuste.cjs (H21/H22).
// ═══════════════════════════════════════════════════════════════════════════
import crypto from 'crypto';
import { modifierLigneCas } from './cas.js';

export const BAIL_RENOUV_MS = 20000;
export const idBailRenouv = (uid) => `vinted_renouv_${String(uid || '').replace(/[^0-9]/g, '')}`;

// Le bail par comparer-et-échanger. `true` pris · `false` tenu par un autre · `null` pas su.
export function bailRenouv({ url, entetes, owner, uid, fetcher, maintenant = () => Date.now() }) {
  const id = idBailRenouv(uid);
  const opts = { url, entetes, owner, id, ...(fetcher ? { fetcher } : {}) };
  return {
    prendre: (jeton) => modifierLigneCas({ ...opts, modifier: (d) => {
      const t = maintenant();
      if (d && d.jeton && d.jeton !== jeton && Number(d.jusqua) > t) return undefined;
      return { jeton, jusqua: t + BAIL_RENOUV_MS };
    } }),
    rendre: (jeton) => modifierLigneCas({ ...opts, modifier: (d) => (d && d.jeton === jeton ? { jeton: '', jusqua: 0 } : undefined) }).catch(() => null),
  };
}

const change = (j, ancien) => !!(j && j.refresh_token && j.access_token && j.refresh_token !== ancien.refresh_token);

// `ancien` : { access_token, refresh_token } lus juste avant.
// `lireJetons()` ⇒ { access_token, refresh_token } · null (pas su).
// `rafraichir(paire)` ⇒ paire neuve · null (Vinted a refusé).
// `ecrire(neuve, consomme)` ⇒ nombre de lignes écrites (0 : devancé) · null (panne).
// Rend { jetons, source: 'neuf' | 'autre', persiste } · { jetons: null, raison: 'echec' | 'occupe' }.
export async function renouvelerSousBail({ ancien, lireJetons, rafraichir, ecrire, bail, attente = (ms) => new Promise((ok) => setTimeout(ok, ms)), essaisAttente = 4, pasAttenteMs = 750 }) {
  const jeton = crypto.randomUUID();
  const pris = bail ? await bail.prendre(jeton).catch(() => null) : null;
  if (pris === false) {
    // Un autre renouvelle : on attend SA paire en base, sans rappeler Vinted.
    for (let i = 0; i < essaisAttente; i++) {
      await attente(pasAttenteMs);
      const j = await lireJetons().catch(() => null);
      if (change(j, ancien)) return { jetons: j, source: 'autre', persiste: true };
    }
    return { jetons: null, raison: 'occupe' };
  }
  try {
    const relu = await lireJetons().catch(() => null);
    if (change(relu, ancien)) return { jetons: relu, source: 'autre', persiste: true };
    const courant = relu && relu.refresh_token ? relu : ancien;
    const neuve = await rafraichir(courant);
    if (!neuve || !neuve.access_token) {
      const apres = await lireJetons().catch(() => null);
      if (change(apres, courant)) return { jetons: apres, source: 'autre', persiste: true };
      return { jetons: null, raison: 'echec' };
    }
    let n = null;
    for (let e = 0; e < 3 && n == null; e++) n = await ecrire(neuve, courant.refresh_token).catch(() => null);
    return { jetons: neuve, source: 'neuf', persiste: n != null && n > 0, ...(n === 0 ? { devance: true } : {}) };
  } finally {
    if (pris === true) await bail.rendre(jeton);
  }
}
