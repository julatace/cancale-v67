// ═════════════════════════════════════════════════════════════════════════════
//  LES ÉTIQUETTES LIBRES D'UN ARTICLE (28 nov. 2026, lot sneakers-cote) — copié de Vendoo (étiquettes de couleur)
// ═════════════════════════════════════════════════════════════════════════════
// Des étiquettes d'ÉCRAN seulement (« à nettoyer », « collection », « à photographier »…) : il les crée, les pose sur
// un N°, filtre et compte. Aucune étiquette imprimée (étiquettes de carton avec QR : refusées le 11 oct., §3).
// Une étiquette n'est PAS une identité (§5) : elle ne relie rien, elle ne change aucun N°.
// Couleurs (§7) : une pastille discrète ; ni rouge (réservé à deux paires sous un N°), ni violet (refusé), ni ambre
// (= un geste à faire). Rangé dans `vrm_sneakers` (synchronisé, src/sneakers/stockage.js), écrit sur SON geste.
// Module PUR. Exécuté par scripts/audit-sneakers.cjs.
// ═════════════════════════════════════════════════════════════════════════════

export const COULEURS_TAG = ['gris', 'bleu', 'vert', 'sable', 'ardoise', 'turquoise'];
export const MAX_TAGS = 50;
const nomPropre = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, 24);
const arr = (a) => (Array.isArray(a) ? a : []);

// L'état rangé : { tags: [{ id, nom, couleur }], poses: { [N° (cleNum)]: [id] } } — toujours une copie neuve.
export function etatTags(x) {
  const t = x && typeof x === 'object' ? x : {};
  const tags = arr(t.tags).filter((g) => g && /^t[a-z0-9]{1,12}$/.test(String(g.id)) && nomPropre(g.nom)).slice(0, MAX_TAGS)
    .map((g) => ({ id: String(g.id), nom: nomPropre(g.nom), couleur: COULEURS_TAG.includes(g.couleur) ? g.couleur : 'gris' }));
  const ids = new Set(tags.map((g) => g.id));
  const poses = {};
  for (const [k, l] of Object.entries(t.poses && typeof t.poses === 'object' ? t.poses : {})) {
    const v = [...new Set(arr(l).map(String).filter((i) => ids.has(i)))];
    if (k && v.length) poses[k] = v;
  }
  return { tags, poses };
}
export function creerTag(x, nom, couleur = 'gris', id = '') {
  const e = etatTags(x), n = nomPropre(nom);
  if (!n || e.tags.length >= MAX_TAGS) return e;
  if (e.tags.some((g) => g.nom.toLowerCase() === n.toLowerCase())) return e;   // le même nom deux fois : rien
  const ident = /^t[a-z0-9]{1,12}$/.test(id) ? id : 't' + Date.now().toString(36);
  if (e.tags.some((g) => g.id === ident)) return e;
  return { ...e, tags: [...e.tags, { id: ident, nom: n, couleur: COULEURS_TAG.includes(couleur) ? couleur : 'gris' }] };
}
export function supprimerTag(x, id) {
  const e = etatTags(x);
  return etatTags({ tags: e.tags.filter((g) => g.id !== id), poses: e.poses });
}
// Pose ou retire UNE étiquette sur des N° (une sélection) : `oui` true pose, false retire.
export function basculerTag(x, id, cles, oui) {
  const e = etatTags(x);
  if (!e.tags.some((g) => g.id === id)) return e;
  const poses = { ...e.poses };
  for (const k of arr(cles).map(String).filter(Boolean)) {
    const l = new Set(poses[k] || []);
    if (oui) l.add(id); else l.delete(id);
    if (l.size) poses[k] = [...l]; else delete poses[k];
  }
  return { tags: e.tags, poses };
}
export const tagsDe = (x, cle) => { const e = etatTags(x); return (e.poses[String(cle)] || []).map((i) => e.tags.find((g) => g.id === i)).filter(Boolean); };
// Filtrer une liste de clés : celles qui portent l'étiquette (ou aucune étiquette quand `id` vaut '-').
export function filtrerParTag(x, cles, id) {
  const e = etatTags(x);
  if (!id) return arr(cles);
  return arr(cles).filter((k) => (id === '-' ? !(e.poses[String(k)] || []).length : (e.poses[String(k)] || []).includes(id)));
}
// Compter, parmi les clés données (ex. les paires présentes) : { [id]: n, '-': sans étiquette }.
export function compterTags(x, cles) {
  const e = etatTags(x), n = { '-': 0 };
  for (const g of e.tags) n[g.id] = 0;
  for (const k of arr(cles)) { const l = e.poses[String(k)] || []; if (!l.length) n['-']++; for (const i of l) n[i] = (n[i] || 0) + 1; }
  return n;
}
