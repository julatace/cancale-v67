// ════════════════════════════════════════════════════════════════════════════
//  LA CORBEILLE (4 nov., choix de Julien n° 5) — ce qu'il supprime DANS VRM
//  (une fiche, une dépense, un modèle de description, une réponse rapide, un
//  achat hors plateforme, une facture, un point relais enregistré…) part ici et
//  se RESTAURE pendant 30 jours ; ensuite il est purgé.
//
//  Une suppression faite SUR UN SITE (Vinted, Leboncoin, eBay, Vestiaire) n'est
//  PAS concernée : elle ne passe jamais par ce module.
//
//  UNE règle pour toutes les suppressions de l'app (§11) : l'appelant dit OÙ
//  vit la chose (la clé rangée `cle`, et son `chemin` dans la valeur rangée) ;
//  `retirer` rend le conteneur sans elle ET l'entrée de corbeille qui garde la
//  valeur EXACTE d'avant (copie profonde, aucun champ perdu) ; `restaurer` la
//  remet à sa place. Un N° de rangement restauré est donc le MÊME N° : le pool
//  est append-only (§5), personne ne l'a reçu entre-temps.
//
//  Chemins :
//   · { liste: true, idCle: 'id', id }    — un élément d'une liste, par son identifiant ;
//   · { liste: true, index }               — un élément d'une liste sans identifiant
//                                            (réponses rapides : la valeur elle-même est gardée) ;
//   · { k, sous? }                         — une clé d'objet (`sous` : un objet dans l'objet,
//                                            ex. vrm_compta.depenses → { k: 'depenses', liste… }).
//  Un « retrait doux » (la valeur reste rangée avec une marque, ex. `retireeAt`) :
//  l'appelant passe `apres` (la valeur marquée) ; la restauration remet `avant`.
//
//  Fonctions PURES : aucun stockage ici (l'app lit et écrit, `src/App.jsx`).
// ════════════════════════════════════════════════════════════════════════════

export const CLE_CORBEILLE = 'vrm_corbeille';
export const DUREE_CORBEILLE_J = 30;
const JOUR = 86400e3;
export const MAX_CORBEILLE = 400;   // bornée : une ligne `main` ne grossit pas sans fin (§4.4)

const copie = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const memeId = (a, b) => a != null && b != null && String(a) === String(b);

// Le sous-conteneur visé (`sous` : vrm_compta.depenses…). Rend [parent, valeurSous].
function descendre(conteneur, chemin) {
  if (chemin && chemin.sous != null) {
    const p = conteneur && typeof conteneur === 'object' && !Array.isArray(conteneur) ? conteneur : {};
    return [p, p[chemin.sous]];
  }
  return [null, conteneur];
}
function remonter(parent, chemin, nouveau, conteneur) {
  if (chemin && chemin.sous != null) return { ...(parent || {}), [chemin.sous]: nouveau };
  return nouveau;
}

// Retire l'élément au chemin. Rend { conteneur, avant, index } ; `avant`
// undefined ⇒ rien trouvé (le conteneur est rendu tel quel, rien n'est retiré).
export function retirerDe(conteneur, chemin, apres) {
  const [parent, c] = descendre(conteneur, chemin);
  if (chemin && chemin.liste) {
    const L = Array.isArray(c) ? c : [];
    let i = -1;
    if (chemin.idCle != null) i = L.findIndex((x) => x && memeId(x[chemin.idCle], chemin.id));
    else if (Number.isInteger(chemin.index) && chemin.index >= 0 && chemin.index < L.length) i = chemin.index;
    if (i < 0) return { conteneur, avant: undefined, index: -1 };
    const avant = copie(L[i]);
    const nv = apres !== undefined ? L.map((x, j) => (j === i ? copie(apres) : x)) : L.filter((_, j) => j !== i);
    return { conteneur: remonter(parent, chemin, nv, conteneur), avant, index: i };
  }
  const o = c && typeof c === 'object' && !Array.isArray(c) ? c : {};
  const k = chemin ? chemin.k : undefined;
  if (k == null || !Object.prototype.hasOwnProperty.call(o, String(k))) return { conteneur, avant: undefined, index: -1 };
  const avant = copie(o[String(k)]);
  const nv = { ...o };
  if (apres !== undefined) nv[String(k)] = copie(apres); else delete nv[String(k)];
  return { conteneur: remonter(parent, chemin, nv, conteneur), avant, index: -1 };
}

// Remet `valeur` à sa place. Une liste : à son ancien rang (borné), ou à la
// place d'un élément au même identifiant (jamais deux fois la même chose).
export function remettreDans(conteneur, chemin, valeur, index = -1) {
  const [parent, c] = descendre(conteneur, chemin);
  if (chemin && chemin.liste) {
    const L = Array.isArray(c) ? c.slice() : [];
    const v = copie(valeur);
    if (chemin.idCle != null) {
      const j = L.findIndex((x) => x && memeId(x[chemin.idCle], chemin.id));
      if (j >= 0) { L[j] = v; return remonter(parent, chemin, L, conteneur); }
    }
    const at = Number.isInteger(index) && index >= 0 ? Math.min(index, L.length) : L.length;
    L.splice(at, 0, v);
    return remonter(parent, chemin, L, conteneur);
  }
  const o = c && typeof c === 'object' && !Array.isArray(c) ? c : {};
  return remonter(parent, chemin, { ...o, [String(chemin.k)]: copie(valeur) }, conteneur);
}

// Lit la corbeille rangée (forme abîmée ⇒ vide, jamais une erreur).
export const lireCorbeille = (v) => (Array.isArray(v) ? v.filter((e) => e && e.id && e.cle && e.chemin && e.at) : []);

// Met un élément à la corbeille. Rend { conteneur, corbeille, entree } ;
// `entree` null ⇒ rien n'a été trouvé à retirer (rien ne change).
export function mettreEnCorbeille({ conteneur, corbeille, cle, chemin, type, libelle = '', numero = null, apres, maintenant = Date.now(), id }) {
  const r = retirerDe(conteneur, chemin, apres);
  if (r.avant === undefined) return { conteneur, corbeille: lireCorbeille(corbeille), entree: null };
  const entree = {
    id: String(id || `${type || 'x'}_${maintenant.toString(36)}_${Math.random().toString(36).slice(2, 8)}`),
    type: String(type || 'autre'), cle: String(cle), chemin: copie(chemin), avant: r.avant, index: r.index,
    libelle: String(libelle || '').slice(0, 120), numero: numero == null || numero === '' ? null : String(numero),
    doux: apres !== undefined, at: new Date(maintenant).toISOString(),
  };
  const c = [entree, ...lireCorbeille(corbeille)].slice(0, MAX_CORBEILLE);
  return { conteneur: r.conteneur, corbeille: c, entree };
}

// Restaure une entrée. Rend { conteneur, corbeille, entree } (entree null ⇒ inconnue / expirée).
export function restaurer({ conteneur, corbeille, id, maintenant = Date.now() }) {
  const L = lireCorbeille(corbeille);
  const e = L.find((x) => x.id === String(id));
  if (!e || expiree(e, maintenant)) return { conteneur, corbeille: L, entree: null };
  const nv = remettreDans(conteneur, e.chemin, e.avant, e.index);
  return { conteneur: nv, corbeille: L.filter((x) => x.id !== e.id), entree: e };
}

export const expireLe = (e) => { const t = Date.parse(e && e.at); return Number.isFinite(t) ? t + DUREE_CORBEILLE_J * JOUR : 0; };
export const expiree = (e, maintenant = Date.now()) => expireLe(e) <= maintenant;
export const joursRestants = (e, maintenant = Date.now()) => Math.max(0, Math.ceil((expireLe(e) - maintenant) / JOUR));

// Purge : ce qui a plus de 30 jours sort. Rend { corbeille, purgees }.
export function purger(corbeille, maintenant = Date.now()) {
  const L = lireCorbeille(corbeille);
  const purgees = L.filter((e) => expiree(e, maintenant));
  return { corbeille: L.filter((e) => !expiree(e, maintenant)), purgees };
}

// La phrase de la confirmation — au mot près : rien ne part d'un site.
export const PHRASE_CORBEILLE = 'Elle va dans la corbeille (Paramètres → Corbeille) : tu peux la restaurer pendant 30 jours. Rien n’est supprimé sur Vinted, Leboncoin, eBay ou Vestiaire.';
export const NOMS_TYPES = {
  fiche: 'Fiche', depense: 'Dépense', cout: 'Coût fixe', pack: 'Pack ou option', modele: 'Modèle de description',
  reponse: 'Réponse rapide', achat: 'Achat hors plateforme', facture: 'Facture', relais: 'Point relais',
  'photo-colis': 'Photo du colis', liaison: 'Liaison', vente: 'Vente saisie', article: 'Article', autre: 'Élément',
};
