// ── L'ÉTAGÈRE PERSONNALISABLE (v4, 15 nov. 2026 — maquettes validées par Julien : « comme ça c'est pas mal ») ──
// Module PUR : ce que chaque meuble DIT de son dessin, rangé DANS le meuble (`vrm_meubles`, synchronisé, fusionné
// champ par champ entre appareils comme le reste du meuble) :
//   affichage  'cartons' (des boîtes sur des planches) · 'rayonnage' (étiquettes d'entrepôt, N° en grand) · 'plan'
//              (vu de dessus, une case = un carré) ; l'isométrique est une vue de « La pièce », pas d'un meuble ;
//   teinte     la couleur des contenants : kraft · blanc · ardoise · sable · sauge · ciel · lagon · 'melees' (une
//              teinte par carton, selon son N°) — jamais rouge (le doublon), jamais violet ;
//   etiquette  ce que dit l'étiquette : photo · grand (N° en grand) · sites · compte · prix · taille ;
//   densite    'confortable' · 'compacte' · 'loin' (« de loin » retire la photo).
// « À sortir » (ambre) et « En double » (rouge) se disent TOUJOURS, quoi que l'étiquette montre.
// Un meuble d'hier (sans ces champs) se lit avec les défauts d'un meuble neuf : Cartons, teintes mêlées,
// confortable, photo + sites + compte. Rien n'est réécrit à la lecture (§5) ; « Enregistrer » réécrit le meuble
// d'origine augmenté de ses réglages.

export const AFFICHAGES = ['cartons', 'rayonnage', 'plan'];
export const TEINTES = ['kraft', 'blanc', 'ardoise', 'sable', 'sauge', 'ciel', 'lagon'];
export const TEINTE_MELEES = 'melees';
export const DENSITES = ['confortable', 'compacte', 'loin'];
export const ETIQUETTE = ['photo', 'grand', 'sites', 'compte', 'prix', 'taille'];
// Les couleurs du MEUBLE proposées par le panneau (les autres noms d'hier se lisent : lagon ⇒ ciel, terre ⇒ sable).
export const COULEURS_MEUBLE = ['ciel', 'ardoise', 'sable', 'sauge'];
const COULEUR_PROCHE = { lagon: 'ciel', terre: 'sable' };
// Les teintes mêlées : l'ordre des maquettes (kraft, blanc, kraft, ardoise), choisi par le N° — le même carton garde
// sa teinte d'un appareil à l'autre, d'un rendu à l'autre.
const MIX = ['kraft', 'blanc', 'kraft', 'ardoise'];

export const DEFAUTS = Object.freeze({ affichage: 'cartons', teinte: TEINTE_MELEES, densite: 'confortable',
  etiquette: Object.freeze({ photo: true, grand: false, sites: true, compte: true, prix: false, taille: false }) });

const estObjet = (o) => !!o && typeof o === 'object' && !Array.isArray(o);

// Les réglages d'un meuble, lus TOLÉRANTS : une valeur inconnue se lit comme absente (le défaut).
export function reglagesDe(m) {
  const r = m && estObjet(m.reglages) ? m.reglages : {};
  const e = estObjet(r.etiquette) ? r.etiquette : {};
  const etiquette = {};
  for (const k of ETIQUETTE) etiquette[k] = typeof e[k] === 'boolean' ? e[k] : DEFAUTS.etiquette[k];
  return {
    affichage: AFFICHAGES.includes(r.affichage) ? r.affichage : DEFAUTS.affichage,
    teinte: r.teinte === TEINTE_MELEES || TEINTES.includes(r.teinte) ? r.teinte : DEFAUTS.teinte,
    densite: DENSITES.includes(r.densite) ? r.densite : DEFAUTS.densite,
    etiquette,
  };
}
// La couleur du meuble pour le dessin (une des quatre).
export function couleurMeuble(m) {
  const c = m && typeof m.couleur === 'string' ? (COULEUR_PROCHE[m.couleur] || m.couleur) : '';
  return COULEURS_MEUBLE.includes(c) ? c : 'ciel';
}
// La teinte d'UN carton : celle du meuble, ou — teintes mêlées — celle de son N° (chiffres seuls, « B12 » ⇒ 12).
export function teinteCarton(reg, numero) {
  if (reg && reg.teinte !== TEINTE_MELEES && TEINTES.includes(reg.teinte)) return reg.teinte;
  const n = parseInt(String(numero == null ? '' : numero).replace(/\D+/g, ''), 10);
  return MIX[Number.isFinite(n) ? n % 4 : 0];
}
// « De loin » retire la photo ; les sites ne tiennent qu'en « confortable » (sur un carton) ou sur une étiquette
// de rayonnage. Rend ce que l'étiquette MONTRE réellement.
export function etiquetteVue(reg) {
  const r = reg || reglagesDe(null), e = r.etiquette;
  return { ...e, photo: e.photo && r.densite !== 'loin', sites: e.sites && (r.affichage === 'rayonnage' || r.densite === 'confortable') };
}
// La ligne d'état/texte d'une étiquette : l'état D'ABORD (« À sortir », « En double », « Plus en ligne » — toujours),
// sinon ce que l'étiquette demande (compte ou « hors ligne », taille, prix).
// Rend { sorte: 'sortir'|'double'|'plusenligne'|'texte', bits }. « Plus en ligne » : rangée, mais plus une annonce
// actuelle (retirée, supprimée) — un geste à faire, dit à l'ambre comme avant.
export function ligneEtiquette({ etat, double, compte, horsLigne, taille, prix } = {}, etiquette = {}) {
  if (etat === 'vendue') return { sorte: 'sortir', bits: [] };
  if (double) return { sorte: 'double', bits: [] };
  if (etat === 'plusenligne') return { sorte: 'plusenligne', bits: [] };
  const bits = [];
  if (etiquette.compte) { if (compte) bits.push(compte); else if (horsLigne) bits.push({ horsLigne: true }); }
  if (etiquette.taille && taille) bits.push(taille);
  if (etiquette.prix && prix != null) bits.push({ prix });
  return { sorte: 'texte', bits };
}
// Écrire des réglages : le meuble d'ORIGINE augmenté (aucun autre champ touché), seulement les valeurs valides.
export function avecReglages(m, reg) {
  const r = reglagesDe({ reglages: reg });
  return { ...(m || {}), reglages: { affichage: r.affichage, teinte: r.teinte, densite: r.densite, etiquette: { ...r.etiquette } } };
}
// La taille lue d'une fiche (« 42 », « 42.5 », « M », « TU ») — jamais devinée d'un titre.
export function tailleDe(f) {
  const t = f && (f.size != null ? f.size : (f.taille != null ? f.taille : (f.size_title != null ? f.size_title : null)));
  const s = t == null ? '' : String(t).trim();
  if (!s) return '';
  if (/^\d+([.,]\d)?$/.test(s)) return 'T' + s.replace('.', ',');
  if (/^(taille unique|tu|one size)$/i.test(s)) return 'TU';
  return s.length <= 6 ? s.toUpperCase() : '';
}
