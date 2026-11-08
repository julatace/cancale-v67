// ════════════════════════════════════════════════════════════════════════════
//  QUELLES LECTURES MÉMORISÉES UNE ÉCRITURE REND-ELLE PÉRIMÉES ? (8 nov.)
// ════════════════════════════════════════════════════════════════════════════
//  `fetchMemo` (App.jsx) garde 60 s la réponse d'une lecture de montage. Jusqu'au
//  8 nov., TOUTE écriture vidait toute la mémoire. Mesuré au démarrage (banc
//  `_mesure-demarrage.cjs`, Ma journée, 390 px) : l'app publie `widget_stats` puis
//  `lbc_a_retirer` quelques secondes après l'ouverture, et chaque publication
//  renvoyait sur le réseau les transactions (deux pages, ~95 Ko), Vestiaire, les
//  réserves de N°… lues une seconde plus tôt.
//  La règle est CELLE de `lecturesPartagees.js` (même fonctions, pas une copie) :
//   · une écriture de LIGNES NOMMÉES de `app_data` (upsert dont le corps porte
//     les `id`, PATCH/DELETE `id=eq.` / `id=in.`) ne retire que les lectures qui
//     PEUVENT porter l'une de ces lignes (`lecturePeutPorter` : `eq`, `in`,
//     `like` ; un filtre qu'on ne sait pas lire ⇒ retirée) ;
//   · tout le reste vide TOUT, comme avant : une route `/api/` (le serveur écrit
//     en base à sa façon), la ligne `main`, un corps illisible ou pas en texte,
//     un `Request`, une autre table, `rpc/`.
//  Dans le doute, on vide : une lecture relue pour rien coûte un aller-retour ;
//  une lecture gardée à tort montrerait l'état d'AVANT une écriture.
// ════════════════════════════════════════════════════════════════════════════
import { idsEcrits, lecturePeutPorter } from './lecturesPartagees.js';

// La clé de `fetchMemo` est `url|Authorization|Range` (ni l'en-tête ni la page ne
// portent de `|`) : l'adresse est ce qui précède les deux derniers `|`.
export const urlDeCle = (cle) => {
  const k = String(cle);
  const b = k.lastIndexOf('|');
  const a = b > 0 ? k.lastIndexOf('|', b - 1) : -1;
  return a >= 0 ? k.slice(0, a) : k;
};

// Une route de l'app (`/api/…` relatif, ou sur vrm.center) — jamais notre base.
export const estRouteApi = (url) => /^(\/|https?:\/\/[^/]*vrm\.center\/)api\//.test(String(url || ''));

// Les lignes qu'écrit cette requête, ou `null` (« pas sûr » ⇒ tout vider).
export function lignesEcrites(url, methode, init, base) {
  const u = String(url || '');
  const prefixe = String(base || '').replace(/\/+$/, '') + '/rest/v1/';
  if (!base || u.indexOf(prefixe) !== 0) return null;
  const corps = init && init.body;
  return idsEcrits(u.slice(prefixe.length), String(methode || '').toUpperCase(), typeof corps === 'string' ? corps : undefined);
}

// Rend LA fonction à appeler au départ et au retour de l'écriture.
export function fonctionVidage(memo, url, methode, init, base) {
  // Un appel à NOS routes qui DÉCLARE n'écrire que ses propres lignes et vider
  // lui-même quand il rend un changement (`vrmInvalideSiChange`, la règle de
  // `lecturesPartagees` : `/api/compte?mode=photo` lit une photo du CDN,
  // `/api/relais?mode=transp` vide quand il change un suivi). Mesuré au démarrage
  // de Colis : six POST `mode=photo` vidaient la mémoire et les transactions
  // repartaient. Une écriture vers la BASE vide toujours, drapeau ou pas.
  if (init && init.vrmInvalideSiChange === true && estRouteApi(url)) return () => {};
  const ids = lignesEcrites(url, methode, init, base);
  if (!ids) return () => memo.clear();
  return () => viderLignesMemo(memo, ids, base);
}

// Retire de la mémoire les lectures qui PEUVENT porter l'une de ces lignes.
export function viderLignesMemo(memo, ids, base) {
  const prefixe = String(base || '').replace(/\/+$/, '') + '/rest/v1/';
  if (!base || !Array.isArray(ids) || !ids.length) { memo.clear(); return; }
  for (const cle of [...memo.keys()]) {
    const u = urlDeCle(cle);
    // Une lecture qui ne vise pas notre base (ne devrait pas exister ici) : retirée.
    if (u.indexOf(prefixe) !== 0 || lecturePeutPorter(u.slice(prefixe.length), ids)) memo.delete(cle);
  }
}
