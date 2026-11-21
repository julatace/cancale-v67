// (15 nov., étagères) LA PHRASE d'une descente dans une pile — la même partout où une case
// se vide (Stock, sortie automatique, « Enlever du stock », « Vendu ailleurs ») :
// « N°34 et N°35 sont descendus d'un cran ». Les N° viennent des descentes rendues par la
// règle (`clesDescendues`, src/stockEtageres.js), jamais d'un titre.
import { tr, localeCourante } from './i18n/index.js';

export const listeNumeros = (cles) => {
  const l = (Array.isArray(cles) ? cles : []).map((k) => 'N°' + k);
  try { return new Intl.ListFormat(localeCourante(), { style: 'long', type: 'conjunction' }).format(l); } catch (_) { return l.join(', '); }
};
// `crans` : le plus grand nombre de rangées descendues (1 dans le cas courant).
export function phraseDescentes(descentes) {
  const d = Array.isArray(descentes) ? descentes.filter((x) => x && x.cle != null) : [];
  const cles = [...new Set(d.map((x) => String(x.cle)))];
  if (!cles.length) return '';
  const crans = Math.max(...d.map((x) => Number(x.crans) || 1));
  return tr(crans > 1 ? 'etag.descendusCrans' : 'etag.descendus', { n: cles.length, liste: listeNumeros(cles), crans });
}
// Les descentes que portent des opérations de geste (`opsSortieCases`) : chaque op de
// `vrm_slots` qui POSE une case (apres défini) et en avait une avant est une descente.
export function descentesDesOps(ops) {
  return (Array.isArray(ops) ? ops : []).filter((o) => o && o.k === 'vrm_slots' && o.apres && o.avant && Number(o.apres.i) !== Number(o.avant.i))
    .map((o) => ({ cle: String(o.id), crans: Number(o.crans) || 1 }));
}
