// ════════════════════════════════════════════════════════════════════════════
//  UN CALCUL DÉRIVÉ, UNE FOIS PAR VERSION DES DONNÉES (16 nov., lot vitesse-moteur)
//
//  Le moteur `Comptabilite` se rend 20 à 40 fois par ouverture (×2 sur Ventes, ×3 sur Achats).
//  Certains calculs sont faits EN PLEIN RENDU (pas dans un `useMemo` : dans la page de Ma journée,
//  sous une condition) et reparcouraient des milliers de lignes à chaque fois pour la même réponse.
//
//  `parVersion(nom, cles, calcul, opts)` rend `calcul()` et le garde tant que CHAQUE clé est la même
//  (par identité, `Object.is`). L'appelant donne dans `cles` TOUT ce que le calcul lit — les données
//  (objets jamais modifiés en place : une lecture neuve est un objet neuf) et les valeurs du moment
//  qui comptent (ex. le jour pour un calcul « depuis minuit »). Une seule clé différente ⇒ recalculé.
//  `opts.jusqua(r)` (facultatif) : l'heure (ms) à partir de laquelle la réponse gardée ne vaut plus
//  (ex. une vente datée dans le futur qui entrera dans le compte quand l'heure la rattrapera).
//
//  La mémoire est du MODULE : les instances du moteur qui lisent les mêmes données (le magasin
//  partagé `_magasinCommandes`) partagent la réponse. Quelques versions par nom (MAX_VERSIONS) :
//  deux écrans aux clés différentes ne s'effacent pas l'un l'autre. Aucune règle n'est ici.
// ════════════════════════════════════════════════════════════════════════════
const MAX_VERSIONS = 4;
const memoire = new Map();
let calculs = 0;

export function parVersion(nom, cles, calcul, opts = null) {
  let liste = memoire.get(nom);
  if (!liste) { liste = []; memoire.set(nom, liste); }
  const maintenant = Date.now();
  for (let i = 0; i < liste.length; i++) {
    const e = liste[i];
    if (e.cles.length !== cles.length) continue;
    let pareil = true;
    for (let k = 0; k < cles.length; k++) if (!Object.is(e.cles[k], cles[k])) { pareil = false; break; }
    if (!pareil) continue;
    if (e.jusqua != null && !(maintenant < e.jusqua)) { liste.splice(i, 1); break; }
    if (i) { liste.splice(i, 1); liste.unshift(e); }
    return e.r;
  }
  calculs += 1;
  const r = calcul();
  const jusqua = opts && typeof opts.jusqua === 'function' ? opts.jusqua(r) : null;
  liste.unshift({ cles: cles.slice(), r, jusqua: Number.isFinite(jusqua) ? jusqua : null });
  if (liste.length > MAX_VERSIONS) liste.length = MAX_VERSIONS;
  return r;
}

// Pour les contrôles : combien de calculs ont VRAIMENT tourné, et tout oublier.
export const calculsFaits = () => calculs;
export const oublierCalculs = () => { memoire.clear(); calculs = 0; };
