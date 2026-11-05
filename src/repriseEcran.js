// ── LA REPRISE AU MÊME ENDROIT (5 novembre, demande de Julien : « quand on
// quitte l'app et qu'on la rouvre, revenir au même endroit, dans le même
// état ») ───────────────────────────────────────────────────────────────────
// Ce module ne porte que la RÈGLE, sans React. Ce qui est rangé : l'écran
// (`tab`), sa section ou son filtre de site (`sub`), l'onglet de Colis choisi
// À LA MAIN (`colis`) — de la NAVIGATION, rien d'autre : aucun nombre, aucune
// donnée de vente, aucune identité. Les filtres d'un écran et sa position de
// défilement passent par `useVueSession` et `MemoireDefilement`, rangés au
// même endroit (`stockageParcours`). Le compte choisi a déjà sa mémoire, par
// site (src/compteChoix.js).
//
// ⚠️ SUR L'APPAREIL, PAR VENDEUR. Le `sessionStorage` (qu'utilisaient les
// filtres et le défilement depuis le 18 oct.) survit à un rechargement, PAS à
// une app installée qu'iOS ferme puis rouvre : il repart vide. La reprise vit
// donc dans le `localStorage`, sous une clé qui porte l'identifiant du vendeur
// (`vrm_parcours:<owner>:…`, src/parcoursQuotidien.js) et 7 jours au plus ;
// elle est effacée quand le vendeur change (writeSession, `viderParcours`).
// Un autre vendeur sur le même appareil ne retrouve jamais l'écran d'un autre.
//
// ⚠️ UN LIEN REÇU GAGNE. Une notification, un e-mail, un lien `?tab=…` disent
// où aller : la reprise ne s'applique PAS du tout (ni écran, ni section, ni
// onglet de Colis) quand l'adresse porte `tab=`. C'est `goto` (App.jsx) qui
// mène alors au bon endroit, comme avant.
//
// ⚠️ « PAS SU » NE DEVIENT RIEN. Une valeur illisible, d'un autre vendeur,
// trop vieille, ou un écran qui n'est pas dans la liste blanche ⇒ `null`, et
// l'app part de Ma journée comme avant. Jamais un écran deviné.
import { lireParcours, garderParcours } from './parcoursQuotidien.js';

export const NOM_REPRISE = 'reprise';
const FORME_SUB = /^[a-z_]{2,20}(\.[a-z_]{2,20})?$/;
const COLIS_OK = ['envoyer', 'envoyes', 'retirer'];

// Le stockage de la reprise : celui de l'appareil. Absent ou bloqué (navigation
// privée, données du site effacées) ⇒ null, et rien n'est rangé ni relu.
export function stockageParcours() {
  try { const s = window.localStorage; const k = '__vrm_essai__'; s.setItem(k, '1'); s.removeItem(k); return s; } catch (_) { return null; }
}

// Ce qu'on range, nettoyé (jamais plus que ces trois champs).
export function formeReprise(etat, ongletsOk) {
  if (!etat || typeof etat !== 'object') return null;
  const tab = typeof etat.tab === 'string' ? etat.tab : '';
  if (!tab || !Array.isArray(ongletsOk) || !ongletsOk.includes(tab)) return null;
  const r = { tab };
  if (typeof etat.sub === 'string' && FORME_SUB.test(etat.sub)) r.sub = etat.sub;
  if (COLIS_OK.includes(etat.colis)) r.colis = etat.colis;
  return r;
}

export function garderReprise(storage, owner, etat, ongletsOk, now = Date.now()) {
  if (!storage || !owner) return false;
  const r = formeReprise(etat, ongletsOk);
  if (!r) return false;
  return garderParcours(storage, owner, NOM_REPRISE, r, now);
}

// L'adresse porte-t-elle un lien d'écran ? (`?tab=` — notification, e-mail, lien
// partagé, `?tab=` d'un banc.) Alors la reprise se tait.
export function lienRecu(search) {
  try { return !!new URLSearchParams(search || '').get('tab'); } catch (_) { return false; }
}

// Où reprendre. `null` ⇒ l'app part de son écran de départ (Ma journée).
export function lireReprise(storage, owner, ongletsOk, search = '', now = Date.now()) {
  if (!storage || !owner || lienRecu(search)) return null;
  return formeReprise(lireParcours(storage, owner, NOM_REPRISE, null, now), ongletsOk);
}
