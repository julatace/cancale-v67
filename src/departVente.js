// (8 nov.) « CETTE VENTE ATTEND-ELLE ENCORE MON ENVOI ? » — côté app.
// La RÈGLE vit dans api/_lib/depart-vente.js (importée telle quelle par l'app ET
// le serveur, §11). Ici : le registre de ce que l'écran propriétaire (Colis,
// `partisVinted` dans `Comptabilite`) a calculé, pour les lecteurs qui n'ont ni
// les bordereaux ni les e-mails sous la main (Ventes toutes plateformes, la
// loupe, la fiche d'une paire) — ils disent la MÊME chose que Colis.
// Pas encore calculé ⇒ `null` (pas su) : rien n'est déduit, l'écran garde ce
// qu'il savait (« Colis fait » seul).
export { phraseRaison, raisonDepartVente, ventesPartiesParPreuve, attendEnvoi } from '../api/_lib/depart-vente.js';
import { toucherMemoire } from './versionDonnees.js';

let _partis = null;
// (18 nov.) Publiée : les calculs mémorisés qui la lisent (`raisonDepartPubliee`) sont refaits (src/versionDonnees.js).
// (22 nov., latence-totale) La version ne monte que si le CONTENU change. Chaque instance de `Comptabilite` (écrans gardés :
// Aujourd'hui, Ventes, Achats…) publie SA Map, égale à celle de la voisine mais pas le même objet : à chaque calcul, la
// version montait, tous les calculs qui la lisent (`buysBase`, puis les retraits, les colis, l'affectation des achats…) se
// refaisaient dans TOUTES les instances, qui republiaient… — 655 hausses en une minute au banc latence-repos, des rendus
// complets en boucle AU REPOS (tâches de 1 à 1,9 s au téléphone ×4). La Map publiée reste la plus récente (même contenu).
const memeContenu = (a, b) => {
  if (a === b) return true;
  if (!a || !b || a.size !== b.size) return false;
  for (const [k, x] of a) { if (!b.has(k)) return false; const y = b.get(k); if (x !== y && JSON.stringify(x) !== JSON.stringify(y)) return false; }
  return true;
};
export function publierDepartsVinted(m) { const v = m instanceof Map ? m : null; if (v === _partis) return; const change = !memeContenu(v, _partis); _partis = v; if (change) toucherMemoire(); }
export function raisonDepartPubliee(tx) {
  if (!_partis || tx == null) return null;
  return _partis.get(String(tx)) || null;
}
