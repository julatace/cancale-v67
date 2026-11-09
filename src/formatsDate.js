// (9 nov., vitesse) UN FORMAT DE DATE PAR (langue, options), créé une fois.
// `d.toLocaleDateString(langue, options)` refait un `Intl.DateTimeFormat` à CHAQUE appel :
// mesuré au démarrage de Ma journée (téléphone émulé, processeur ×4), ~150 formats créés
// avant que l'écran soit prêt (les 14 jours de la semaine, les 6 derniers mois…).
// Même texte : ECMA-402, `toLocaleDateString(l, o)` = `new Intl.DateTimeFormat(l, o).format(d)`
// quand `o` nomme au moins un champ de date, ou aucun champ (les deux ajoutent alors
// année/mois/jour en chiffres) — vérifié par scripts/tests/formats-date.test.mjs.
const formats = new Map();
export function dateLocale(d, langue, options) {
  const cle = langue + '|' + JSON.stringify(options || {});
  let f = formats.get(cle);
  if (f === undefined) {
    try { f = new Intl.DateTimeFormat(langue, options); } catch (_) { f = null; }
    formats.set(cle, f);
  }
  const date = d instanceof Date ? d : new Date(d);
  return f ? f.format(date) : date.toLocaleDateString(langue, options);
}
