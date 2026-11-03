// ════════════════════════════════════════════════════════════════════════════
//  UN SEUL N° POUR UN ARTICLE EN LIGNE SUR VINTED ET SUR VESTIAIRE (3 nov.)
//
//  Avant : chaque annonce Vestiaire sans lien ni référence recevait son N°
//  (`main.vrm_vc_numeros`, src/numerosVestiaire.js) — le même article physique,
//  en vente sur Vinted ET sur Vestiaire, portait DEUX N°.
//
//  La liaison est une IDENTITÉ posée par SON clic (§5 : « c'est toujours SON
//  clic qui relie ») : `main.vrm_vc_liens` = { [productId Vestiaire]: {
//    numero : le N° qui RESTE (celui de l'annonce Vinted, déjà sur le carton),
//    item   : l'identifiant de l'annonce Vinted,
//    de     : le N° que VRM avait donné à l'annonce Vestiaire ('' s'il n'y en avait pas),
//    at     : quand il a relié,
//    ecrit  : quand il a dit « C'est écrit » (le N° `de` barré sur le carton) } }.
//
//  ⚠️ Le N° `de` n'est JAMAIS effacé ni redonné : il reste dans `vrm_vc_numeros`
//     et dans le pool (append-only). Il apparaît dans « N° à barrer » jusqu'à
//     « C'est écrit ». Défaire la liaison rend l'état d'avant (l'annonce
//     Vestiaire reprend `de`).
//  ⚠️ Une SUGGESTION peut utiliser la ressemblance (marque + taille, couleur ;
//     sans taille des deux côtés — un sac — marque + couleur commune) ; jamais la
//     photo, jamais le titre seul, jamais la marque seule. Rien n'est relié sans
//     son clic : `poserLienVc` est appelée par le bouton, rien d'autre.
//
//  Module PUR (aucun accès au navigateur) : `scripts/audit-lien-vc.cjs` l'exécute.
// ════════════════════════════════════════════════════════════════════════════
import { tailleNorm, tailleDuTitre } from './suggestionsAchat.js';

const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
const ID_VC = /^[\w-]{1,40}$/;

// La liaison d'un produit Vestiaire, ou null.
export const lienDe = (liens, productId) => {
  const e = objet(liens) && productId != null ? liens[String(productId)] : null;
  return objet(e) && e.numero != null && String(e.numero).trim() ? e : null;
};
// Le produit Vestiaire relié à une annonce Vinted (par son identifiant), ou ''.
export const produitDeVinted = (liens, item) => {
  if (item == null || String(item) === '') return '';
  for (const [pid, e] of Object.entries(objet(liens) || {})) if (objet(e) && String(e.item) === String(item)) return pid;
  return '';
};

// L'annonce Vestiaire PEUT-elle être reliée ? Seulement quand son N° est celui
// que VRM lui a donné (ou qu'elle n'en a pas encore) : un lien posé à la
// publication ou une référence VRM-n° est DÉJÀ une identité vers un N° de carton.
export function vcReliable({ productId, item: it, liensPub, liens, cleNum }) {
  const id = String(productId == null ? '' : productId);
  if (!ID_VC.test(id)) return false;
  if (lienDe(liens, id)) return false;
  if (cleNum((objet(liensPub) || {})[id] || '')) return false;
  if (it && cleNum(it.ref || '')) return false;
  return true;
}

// POSER la liaison (sur SON clic). Rend { liens } (nouvelle carte) ou { refus }.
//  · `numeroVinted` : le N° de l'annonce Vinted — il RESTE (déjà sur son carton) ;
//  · `numeroVc`     : le N° que VRM avait donné à l'annonce Vestiaire (peut être '').
// Refus : identifiants illisibles, annonce Vinted sans N°, produit déjà relié,
// annonce Vinted déjà reliée à un autre produit (une liaison = un article).
export function poserLienVc({ liens, productId, item, numeroVinted, numeroVc = '', cleNum, maintenant = new Date().toISOString() }) {
  const id = String(productId == null ? '' : productId), it = String(item == null ? '' : item);
  if (!ID_VC.test(id) || !/^\d{1,15}$/.test(it)) return { refus: 'identite' };
  const n = cleNum(numeroVinted || '');
  if (!n) return { refus: 'sans-numero' };
  if (lienDe(liens, id)) return { refus: 'deja-relie' };
  const autre = produitDeVinted(liens, it);
  if (autre && autre !== id) return { refus: 'vinted-deja-relie' };
  const de = cleNum(numeroVc || '') && cleNum(numeroVc) !== n ? String(numeroVc) : '';
  return { liens: { ...(objet(liens) || {}), [id]: { numero: String(numeroVinted), item: it, de, at: maintenant, ecrit: null } } };
}
// DÉFAIRE (sur SON clic) : la carte sans ce produit. Rien d'autre ne change.
export function defaireLienVc(liens, productId) {
  const out = { ...(objet(liens) || {}) };
  delete out[String(productId)];
  return out;
}
// Les N° à barrer sur un carton : une liaison qui a remplacé un N° déjà donné,
// tant qu'il n'a pas dit « C'est écrit ».
export function numerosABarrer(liens) {
  return Object.entries(objet(liens) || {}).filter(([, e]) => objet(e) && e.de && !e.ecrit && e.numero)
    .map(([productId, e]) => ({ productId, de: String(e.de), vers: String(e.numero), item: String(e.item || '') }))
    .sort((a, z) => String(a.de).localeCompare(String(z.de), 'fr', { numeric: true }));
}
export function marquerBarre(liens, productId, maintenant = new Date().toISOString()) {
  const e = lienDe(liens, productId);
  if (!e) return objet(liens) || {};
  return { ...liens, [String(productId)]: { ...e, ecrit: maintenant } };
}

// ── Les suggestions (une PROPOSITION, jamais une liaison) ───────────────────
// cible : { titre, marque?, taille?, couleur? } · candidats : [{ id, titre,
// marque?, taille?, couleur? }] (les articles pas encore reliés).
// marqueDe(texte) → nom | null ; couleursDe(texte) → [noms] ; modeleDe(texte) → mot | null.
// Rend [{ id, rang }] : rang 1 = marque + taille + couleur commune (ou, sans
// taille des deux côtés, marque + couleur commune) ; rang 2 = marque + taille,
// couleur inconnue d'un côté. Taille connue d'un seul côté ⇒ écartée.
export function suggestionsLienVc({ cible, candidats, marqueDe, couleursDe, modeleDe = null, max = 3 } = {}) {
  if (!cible || typeof marqueDe !== 'function' || typeof couleursDe !== 'function' || !Array.isArray(candidats)) return [];
  const bas = (s) => String(s || '').trim().toLowerCase();
  const lire = (x) => {
    const titre = String((x && x.titre) || '');
    return {
      marque: bas((x.marque && (marqueDe(String(x.marque)) || x.marque)) || marqueDe(titre)),
      taille: x.taille ? (tailleNorm(x.taille) || '') : tailleDuTitre(titre),
      couleurs: (couleursDe([x.couleur || '', titre].join(' ')) || []).map(bas),
      modele: typeof modeleDe === 'function' ? modeleDe(titre) : null,
    };
  };
  const c = lire(cible);
  if (!c.marque) return [];
  const out = [];
  for (const x of candidats) {
    if (!x || x.id == null) continue;
    const k = lire(x);
    if (k.marque !== c.marque) continue;
    if (!!k.taille !== !!c.taille) continue;
    if (c.taille && k.taille !== c.taille) continue;
    if (c.modele && k.modele && c.modele !== k.modele) continue;
    const communes = c.couleurs.length && k.couleurs.length;
    if (communes && !k.couleurs.some((x2) => c.couleurs.includes(x2))) continue;
    if (!c.taille && !communes) continue;          // sans taille : jamais la marque seule
    out.push({ id: String(x.id), rang: communes ? 1 : 2 });
  }
  out.sort((a, z) => a.rang - z.rang);
  return out.slice(0, max);
}
