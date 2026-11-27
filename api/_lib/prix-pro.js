// ════════════════════════════════════════════════════════════════════════════
//  LE PRIX D'UNE VENTE VINTED PRO, CÔTÉ SERVEUR (16 nov. au soir, lot deux-prix-compter)
// ════════════════════════════════════════════════════════════════════════════
// §5 « une seule règle par notion » : le serveur pose sur les ventes d'un compte Pro EXACTEMENT la
// règle de l'app (`fetchVintedOrders` → `appliquerPrixPro`), avant le bilan de la semaine / du mois
// et avant la preuve d'une facture Pro (émise à son clic ou envoyée seule) :
//   · la règle : src/vintedPro.js (`appliquerPrixPro`, `lectureProDeLignes`), importée telle quelle ;
//   · « ce compte est-il Pro ? » : `typeCompteVinted` d'App.jsx, recopiée au jeton près dans
//     api/_lib/ventes-regle.js par `node scripts/audit-bilan-semaine.cjs --recopie` (jamais à la main) ;
//   · les lectures : les mêmes projections que l'app (scalaires, §4.4).
// Décision de Julien du 16 nov. : une vente Pro dont la liste dépasse l'article de 2 € au plus est
// comptée au prix de l'ARTICLE ; écart > 2 €, liste sous l'article, transaction pas lue ⇒ à part.
// Profil pas lu ⇒ rien ne change (« pas su » n'est pas « Pro ») ; transactions pas lues ⇒ chaque vente
// le dit (`_prixPro`), jamais un prix choisi.
import { appliquerPrixPro, lectureProDeLignes, SELECT_TXN_PRO, SELECT_PROFIL_PRO } from '../../src/vintedPro.js';
import { typeCompteVinted } from './ventes-regle.js';

const UID = /^\d{1,20}$/;
const TX = /^\d{1,20}$/;
// `lire(requête)` : une lecture `app_data?…` du vendeur → lignes, ou null/undefined (ratée).
const sur = (p) => Promise.resolve(p).then((x) => (Array.isArray(x) ? x : null), () => null);

// Les lectures d'UN compte, mises en forme par la règle partagée. `tx` : une seule transaction (la
// preuve d'une facture) au lieu de toutes.
export async function lectureProServeur(uid, lire, { tx = null } = {}) {
  const u = String(uid == null ? '' : uid);
  if (!UID.test(u)) return { pro: null };
  const profil = await sur(lire(`id=eq.harvest_${u}_profile&select=${SELECT_PROFIL_PRO}`));
  const l0 = lectureProDeLignes({ profil, typeCompte: typeCompteVinted });
  if (l0.pro !== true) return l0;
  const txq = tx != null && TX.test(String(tx)) ? `id=eq.harvest_${u}_txn_${tx}` : `id=like.harvest_${u}_txn_*`;
  const [txns, releves] = await Promise.all([
    sur(lire(`${txq}&select=${SELECT_TXN_PRO}`)),
    sur(lire(`id=like.harvest_${u}_releve_*&select=id,l:data->lignes`)),
  ]);
  return lectureProDeLignes({ profil, txns, releves, typeCompte: typeCompteVinted });
}

// Les ventes d'UN compte, la règle Pro posée (comme l'app au chargement).
export async function ventesAvecPrixPro(uid, ventes, lire, opts) {
  if (!Array.isArray(ventes) || !ventes.length) return ventes;
  return appliquerPrixPro(ventes, await lectureProServeur(uid, lire, opts));
}
