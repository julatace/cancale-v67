// ── DUPLIQUER UNE ANNONCE (3 novembre 2026, choix de Julien) ────────────────
// « Dupliquer » sur une fiche ⇒ une NOUVELLE fiche, un NOUVEAU N°, les mêmes
// champs de texte, AUCUNE photo et AUCUNE identité de l'annonce d'origine.
//
// ⚠️ LE N° (§5) : `prochainLibre` (App.jsx) sur TOUS les numéros déjà servis —
//    après le plus haut, jamais un trou, jamais un ancien (ni « B230 » ni
//    « 230 » d'une archive). Le numéro neuf entre aussitôt dans le pool
//    append-only (`vinted_used_numeros`) : il ne sera plus jamais redonné.
// ⚠️ L'IDENTITÉ (§5) : la copie ne porte ni l'identifiant d'annonce Vinted, ni
//    un fichier photo (`photo`, `photoK`, `photos`), ni une transaction, ni un
//    SKU eBay, ni un lien Leboncoin, ni un produit Vestiaire, ni un prix
//    d'achat (§2.5 : il le saisit), ni un prix mini d'offre, ni le N° de
//    l'origine. Rien ne peut donc relier la copie à la vente de l'original :
//    aucune double vente possible. Liste BLANCHE : seuls les champs ci-dessous.
// Module PUR : l'écran (App.jsx) et `audit-dupliquer.cjs`.

export const CHAMPS_DUPLIQUES = ['titre', 'marque', 'taille', 'etat', 'description', 'prix'];

const str = (v) => String(v == null ? '' : v).trim();
const prixDe = (p) => {
  if (p == null || p === '') return null;
  const n = Number(typeof p === 'object' ? p.amount : String(p).replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
};

// Les champs de texte d'un article, lus de sa fiche (`vinted_annonce_numeros`)
// et de sa sauvegarde coffre (marque, état, description) — par l'identifiant
// de CETTE annonce, jamais par le titre.
export function champsSource(fiche, coffre) {
  const f = fiche || {}, c = coffre || {};
  return {
    titre: str(c.title || f.title).slice(0, 200),
    marque: str(c.brand || f.brand),
    taille: str(c.size || f.size || f.taille),
    etat: str(c.etat || f.etat),
    description: String(c.desc != null ? c.desc : (f.description || '')).slice(0, 5000),
    prix: prixDe(c.price != null ? c.price : f.price),
  };
}

// La copie. `pris` : { int: Set<number>, cles: Set<string> } — tous les
// numéros servis (pool, fiches, ventes corrigées, Vestiaire, Leboncoin, réservés).
// `prochainLibre(prisInt, prisCles, pref)` : LA règle de l'app.
// Rend { id, fiche } ; `fiche.numero` est neuf.
export function dupliquerFiche(champs, { pris, pref = '', prochainLibre, cleNum, id, maintenant = new Date().toISOString() } = {}) {
  if (typeof prochainLibre !== 'function' || typeof cleNum !== 'function') throw new Error('règles absentes');
  const int = new Set(pris && pris.int ? pris.int : []), cles = new Set(pris && pris.cles ? pris.cles : []);
  const avant = new Set([...cles].map(cleNum));
  for (const n of int) avant.add(cleNum(n));
  const numero = String(prochainLibre(int, cles, pref));
  if (!numero || avant.has(cleNum(numero))) throw new Error('numéro déjà servi');
  const src = champs || {};
  const fiche = { id: String(id), numero, creeAt: maintenant, photos: [] };
  for (const k of CHAMPS_DUPLIQUES) fiche[k] = k === 'prix' ? prixDe(src[k]) : str(src[k]);
  return { id: String(id), fiche };
}

// Une fiche dupliquée est PUBLIÉE dès qu'une annonce porte son N° (identité par
// le numéro : fiche Vinted, SKU eBay, référence Leboncoin, produit Vestiaire).
// `numerosEnLigne` : Set des `cleNum` portés par des annonces lues.
export const fichesAPublier = (neuves, numerosEnLigne, cleNum) => Object.values(neuves || {})
  .filter((f) => f && f.numero && !f.retireeAt && !(numerosEnLigne && numerosEnLigne.has(cleNum(f.numero))))
  .sort((a, b) => String(b.creeAt || '').localeCompare(String(a.creeAt || '')));

// Le texte à coller sur le site (titre, puis la description).
export const texteAColler = (f) => [str(f && f.titre), str(f && f.description)].filter(Boolean).join('\n\n');
