// ════════════════════════════════════════════════════════════════════════════
//  UN N° PAR ANNONCE VESTIAIRE (2 novembre, soir)
//
//  Julien : « je veux un numéro attribué par annonce ». Une annonce Vestiaire
//  SANS numéro en reçoit un (règle (a) de §5 « Les numéros de rangement »), par
//  le MÊME mécanisme que Vinted : `prochainLibre` d'App.jsx (passé en paramètre,
//  jamais recopié — une seule règle) sur TOUS les numéros déjà servis (pool
//  append-only, fiches, ventes, liens Leboncoin et Vestiaire, numéros réservés,
//  numéros Vestiaire déjà donnés). Le plus haut + 1, jamais un trou.
//
//  ⚠️ L'IDENTITÉ (§5) : l'identifiant Vestiaire du PRODUIT (`productId`, la clé
//     de `vc_listings.items` et le `productId` d'une vente) — JAMAIS le titre.
//     50 annonces au même titre ⇒ 50 numéros.
//  ⚠️ PAS DE NUMÉRO NEUF quand l'annonce en porte déjà un :
//       1. le lien posé par VRM à la publication (`vc_listings.liens[id]`) — la
//          paire a déjà son carton ;
//       2. la référence « VRM-{n°} » lue sur l'article (`ref`) ;
//       3. un numéro Vestiaire déjà donné (`auto[id]`) — il ne change JAMAIS
//          (il est écrit sur un carton), même si l'annonce est relue.
//  ⚠️ UNE VENTE HÉRITE du N° de SON annonce par `productId` : la carte est par
//     produit. Une vente « à expédier » dont l'annonce n'a jamais été lue reçoit
//     le numéro de son produit ici (il faut un N° sur le carton à envoyer) —
//     l'annonce, lue plus tard, garde ce même numéro.
//  ⚠️ Une annonce RETIRÉE n'en reçoit pas (elle n'occupe aucune place) ; une
//     vente annulée non plus.
//
//  Module PUR : `scripts/audit-numeros-vestiaire.cjs` l'exécute avec le VRAI
//  `prochainLibre` extrait d'App.jsx.
// ════════════════════════════════════════════════════════════════════════════

const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
// L'entrée d'un numéro Vestiaire donné : { numero, numberedAt, auto: true }.
export const numeroDeCarte = (auto, id) => {
  const e = objet(auto) && id != null ? auto[String(id)] : null;
  if (e == null) return '';
  if (typeof e === 'string' || typeof e === 'number') return String(e);
  return objet(e) && e.numero != null ? String(e.numero) : '';
};

// Les produits Vestiaire qui doivent porter un numéro, dans l'ordre (identifiant
// croissant : Vestiaire les crée dans l'ordre de dépôt). `items` = `vc_listings.items`,
// `ventes` = `vc_ventes.ventes`, `etatRetiree(it)` = vrai pour une annonce retirée,
// `venteAnnulee(v)` = la règle de vestiaire-regle.js.
export function produitsANumeroter({ items, ventes, liens, auto, cleNum, etatRetiree = () => false, venteAnnulee = () => false }) {
  const L = objet(liens) || {}, A = objet(auto) || {};
  const aDeja = (id, ref) => !!(cleNum(L[id] || '') || cleNum(ref || '') || cleNum(numeroDeCarte(A, id)));
  const vus = new Map();
  for (const [id, it] of Object.entries(objet(items) || {})) {
    if (!objet(it) || !/^[\w-]{1,40}$/.test(String(id))) continue;
    if (etatRetiree(it)) continue;
    if (aDeja(String(id), it.ref)) continue;
    vus.set(String(id), 'annonce');
  }
  for (const v of Object.values(objet(ventes) || {})) {
    if (!objet(v) || v.aExpedier !== true || venteAnnulee(v)) continue;
    const id = String(v.productId == null ? '' : v.productId);
    if (!/^[\w-]{1,40}$/.test(id) || vus.has(id)) continue;
    // La référence lue sur l'annonce compte aussi pour sa vente (même produit).
    const it = objet(items) && objet(items[id]);
    if (aDeja(id, v.ref) || (it && cleNum(it.ref || ''))) continue;
    vus.set(id, 'vente');
  }
  const num = (s) => (/^\d+$/.test(s) ? Number(s) : NaN);
  return [...vus.keys()].sort((a, z) => {
    const na = num(a), nz = num(z);
    if (Number.isFinite(na) && Number.isFinite(nz)) return na - nz;
    return a.localeCompare(z);
  });
}

// Donne un numéro NEUF à chaque produit de `ids`. `pris` (entiers) et `prisCles`
// (clés texte) sont TOUS les numéros déjà servis ; `prochainLibre` les complète
// lui-même (c'est la règle d'App.jsx). Rend la carte complète et les nouveaux.
export function attribuerNumerosVc({ ids, auto, pris, prisCles, pref, prochainLibre, cleNum, maintenant = new Date().toISOString() }) {
  const out = { ...(objet(auto) || {}) };
  const nouveaux = [];
  for (const id of ids || []) {
    if (cleNum(numeroDeCarte(out, id))) continue;   // jamais renuméroté
    const n = String(prochainLibre(pris, prisCles, pref));
    // `prochainLibre` ajoute l'entier (sans préfixe) ; la clé aussi, pour qu'un
    // numéro à lettres et le même en chiffres restent pris tous les deux.
    prisCles.add(cleNum(n));
    out[String(id)] = { numero: n, numberedAt: maintenant, auto: true };
    nouveaux.push({ id: String(id), numero: n });
  }
  return { auto: out, nouveaux };
}

// La carte « produit → N° » pour l'affichage : seulement les numéros lisibles.
export const carteNumerosVc = (auto) => {
  const out = {};
  for (const id of Object.keys(objet(auto) || {})) { const n = numeroDeCarte(auto, id); if (n) out[id] = n; }
  return out;
};
