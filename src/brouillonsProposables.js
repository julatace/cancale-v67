// ── QUEL BROUILLON VINTED PEUT ÊTRE PROPOSÉ À LA MISE EN LIGNE (2 novembre) ──
// Julien : « elle propose de mettre des brouillons en ligne sans dire que ces
// brouillons ne viennent pas de ce compte, et même quand ces brouillons
// n'existent plus ». UNE règle (§11) pour « Voir mes brouillons » (chaque bouton
// « Mettre en ligne ») et pour l'atelier « Brouillons → en ligne ».
//
// Un brouillon est désigné par SON identifiant (draftId), jamais par son titre
// (§5). Il est PROPOSABLE seulement si :
//   1. il est sur le compte Vinted OUVERT DANS CHROME (le seul au nom duquel
//      l'extension peut agir) — sinon « autre-compte », montré grisé avec le
//      pseudo de son compte, jamais cochable ; compte de Chrome pas su ⇒
//      « compte-inconnu » ;
//   2. sa présence sur Vinted est PROUVÉE et récente :
//        · vu dans la lecture COMPLÈTE de son dressing (sa session) de moins de 24 h,
//        · ou enregistré sur Vinted (réponse 2xx vue par l'extension) il y a moins
//          de 24 h, sans lecture complète plus récente qui l'aurait vu disparaître ;
//      sinon « a-verifier » (« pas su » ne vaut pas « oui ») ;
//   3. absent d'une lecture COMPLÈTE de son dressing plus récente que la preuve
//      de sa présence ⇒ « plus-sur-vinted » : il n'est plus proposé du tout ;
//   4. VRM a son contenu, complet (`etat === 'pret'`) — sinon « pas-pret ».
// Une lecture partielle (une page du dressing) ne prouve jamais une absence.
export const BROUILLON_LECTURE_MAX_MS = 24 * 3600e3;   // comme « en ligne » (§5 : plus de 24 h ⇒ à confirmer)
export const BROUILLON_MARGE_MS = 5 * 60 * 1000;        // la marge de la règle des suppressions

const fini = (v) => typeof v === 'number' && isFinite(v);

// La lecture du dressing d'un compte, telle que l'app la reçoit : `{ lu, complet }`.
// `complet` : Vinted annonce un total et la lecture l'atteint (même règle que
// `lectureDressingComplete` pour un dressing).
export function lectureBrouillons(payload, lu) {
  if (!payload || !Array.isArray(payload.items) || !fini(lu)) return null;
  const pg = payload.pagination || {}; const t = Number(pg.total_entries);
  const complet = pg.total_entries != null && pg.total_entries !== '' && isFinite(t) && payload.items.length >= t;
  return { lu, complet };
}

// b   : { uid, source: 'dressing'|'extension', vu (ms, la lecture qui l'a montré),
//         enregistre (ms, vu enregistré par l'extension), etat }
// ctx : { uidChrome (string · null = aucun compte · undefined = pas su),
//         lectures: { [uid]: { lu, complet } } (null = pas su), maintenant }
export function jugerBrouillon(b, ctx) {
  const c = ctx || {};
  const maintenant = fini(c.maintenant) ? c.maintenant : Date.now();
  const uid = b && b.uid != null ? String(b.uid) : '';
  const L = uid && c.lectures && typeof c.lectures === 'object' ? c.lectures[uid] : null;
  const complete = !!(L && L.complet === true && fini(L.lu));
  const source = b && b.source === 'extension' ? 'extension' : 'dressing';
  const preuve = source === 'extension' ? (b && fini(b.enregistre) ? b.enregistre : NaN) : (b && fini(b.vu) ? b.vu : NaN);
  // 3. Une lecture complète PLUS RÉCENTE que la preuve, sans lui : il n'est plus là.
  if (complete && fini(preuve) && L.lu >= preuve + BROUILLON_MARGE_MS) return { place: 'plus-sur-vinted', depuis: L.lu };
  // 2. Présence prouvée et récente.
  let present = false;
  if (fini(preuve) && maintenant - preuve <= BROUILLON_LECTURE_MAX_MS) {
    present = source === 'extension' ? true : (complete && Math.abs(L.lu - preuve) < BROUILLON_MARGE_MS);
  }
  // 1. Le compte de Chrome d'abord : c'est le geste qui débloque (ouvrir CE compte relit aussi son dressing).
  if (!uid) return { place: 'a-verifier', raison: 'compte' };
  if (c.uidChrome === undefined || c.uidChrome === null || c.uidChrome === '') return { place: 'compte-inconnu' };
  if (String(c.uidChrome) !== uid) return { place: 'autre-compte' };
  if (!present) return { place: 'a-verifier', raison: !fini(preuve) ? 'jamais-date' : (maintenant - preuve > BROUILLON_LECTURE_MAX_MS ? 'ancienne' : 'partielle') };
  if (b.etat !== 'pret') return { place: 'pas-pret' };
  return { place: 'proposable' };
}
