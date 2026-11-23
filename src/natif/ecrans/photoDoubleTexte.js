// (22 nov., choix n° 35) « N°142 et N°157 » : les N° d'un groupe de même photo (sans N° : « sans N° ») — Aujourd'hui et
// Annonces disent la même phrase (src/photoEnDouble.js donne les groupes).
import { tr } from '../../i18n/index.js';
export function numsPhotoDouble(g) {
  const ann = g && Array.isArray(g.annonces) ? g.annonces : [];
  const noms = ann.map((a) => (a.numero ? tr('photoDouble.num', { n: a.numero }) : tr('photoDouble.sansNum')));
  if (noms.length <= 2) return noms.length === 2 ? tr('photoDouble.et', { a: noms[0], b: noms[1] }) : noms.join('');
  return tr('photoDouble.et', { a: noms.slice(0, -1).join(', '), b: noms[noms.length - 1] });
}
