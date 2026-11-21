// ═══ UNE COPIE DE LA BASE EST UNE PHOTO DATÉE ═════════════════════════════
// Les fixtures de `fx/` sont une copie de sa base, prise UN jour. Depuis le
// 11 octobre, une annonce ne compte « en ligne » que si la lecture du dressing
// de son compte date de moins de 24 h (`<enligne-regle>` dans l'app et
// l'extension) : servie telle quelle une semaine plus tard, toute la copie
// passe « à confirmer », les écrans Annonces se vident… et le banc mesure
// l'HORLOGE, pas l'app (la leçon de `comptes.cjs`, qui vieillit un compte en
// mémoire pour la même raison).
//
// On recale donc, EN MÉMOIRE, la date de capture des dressings
// (`harvest_{uid}_listings` / `_enligne`) : la plus récente devient « il y a
// une minute », et les ÉCARTS sont gardés — un compte déjà figé dans la copie
// le reste, donc « à confirmer » reste mesurable sur des données réelles.
// Rien d'autre ne bouge : ventes, versements, bordereaux gardent leurs dates.
// Rien n'est écrit sur le disque.
const FAMILLE = /^harvest_[^_]+_(listings|enligne)$/;
const dateDe = (r) => Date.parse(((r && r.data) || {}).capturedAt || '');

function dressingsDuJour(rows, maintenant = Date.now()) {
  const liste = Array.isArray(rows) ? rows : [];
  const dates = liste.filter((r) => FAMILLE.test(String((r && r.id) || ''))).map(dateDe).filter(Number.isFinite);
  if (!dates.length) return liste;
  const decalage = maintenant - 60000 - Math.max(...dates);
  if (!(decalage > 0)) return liste;
  return liste.map((r) => {
    if (!FAMILLE.test(String((r && r.id) || ''))) return r;
    const t = dateDe(r);
    if (!Number.isFinite(t)) return r;
    return { ...r, data: { ...r.data, capturedAt: new Date(t + decalage).toISOString() } };
  });
}

module.exports = { dressingsDuJour };
