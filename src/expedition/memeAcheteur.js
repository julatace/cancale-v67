// ════════════════════════════════════════════════════════════════════════════
//  IDÉE 152 — MÊME ACHETEUR, DEUX COLIS (14 nov.)
// ════════════════════════════════════════════════════════════════════════════
//  Demande : « deux ventes ou plus à expédier pour le MÊME acheteur ⇒ Même acheteur :
//  envoyer ensemble ? ». Une règle PURE (aucune lecture, aucune écriture).
//
//  L'IDENTITÉ D'UN ACHETEUR — jamais par ressemblance (§5) :
//   · Vinted : l'identifiant NUMÉRIQUE de l'acheteur que Vinted met sur le détail de CETTE
//     transaction (`harvest_{compte}_txn_{n°}` → `transaction.buyer_id`, mesuré le 14 nov. :
//     présent sur les 1 421 détails rangés), sur le MÊME compte vendeur (le compte est dans le
//     nom de la ligne). Le pseudo n'est qu'affiché (il peut changer, deux pseudos proches sont
//     deux personnes) ;
//   · eBay : le nom d'utilisateur EXACT de l'acheteur de la commande (`buyer.username`), sur le
//     même compte eBay — égalité de chaîne, sans majuscules retouchées ni espaces retirés ;
//   · Leboncoin, Vestiaire : VRM ne lit aucune identité d'acheteur ⇒ jamais regroupés (dit).
//  « En même temps » : les deux sont À EXPÉDIER maintenant (ils partent le même jour d'envoi).
//
//  CE QUE VRM PROPOSE — et ce qu'il ne fait pas : Vinted fait UN bordereau PAR VENTE (deux
//  bordereaux = deux colis ; un lot acheté en une fois a déjà UN seul bordereau). VRM ne fusionne
//  rien, n'écrit rien en base : il propose de les PRÉPARER ensemble (rapprochés dans la liste, un
//  rappel à l'emballage : un bordereau par colis, chaque N° vérifié).
// ════════════════════════════════════════════════════════════════════════════

export const SITES_AVEC_ACHETEUR = Object.freeze(['vinted', 'ebay']);
const nonVide = (s) => typeof s === 'string' && s.length > 0 && s.length <= 120;

// La clé d'identité d'UN colis, ou '' (pas d'identité ⇒ jamais regroupé).
// `c` : { site, compte, acheteurId } — `acheteurId` tel que la plateforme le donne.
export function cleAcheteur(c) {
  if (!c || !SITES_AVEC_ACHETEUR.includes(c.site)) return '';
  const compte = c.compte == null ? '' : String(c.compte);
  if (!nonVide(compte)) return '';
  const id = c.acheteurId;
  if (c.site === 'vinted') {
    const s = typeof id === 'number' && Number.isSafeInteger(id) && id > 0 ? String(id) : (typeof id === 'string' && /^[1-9]\d{0,15}$/.test(id) ? id : '');
    return s ? `vinted|${compte}|${s}` : '';
  }
  return nonVide(id) && id.trim() === id ? `ebay|${compte}|${id}` : '';
}

// Les groupes : au moins DEUX colis distincts à la même clé. Chaque colis garde sa clé de colis.
// `colis` : [{ cle, site, compte, acheteurId, pseudo }] (l'ordre de la liste est gardé dans chaque groupe).
export function groupesMemeAcheteur(colis) {
  const par = new Map();
  const vus = new Set();
  for (const c of colis || []) {
    if (!c || !c.cle || vus.has(String(c.cle))) continue;
    vus.add(String(c.cle));
    const k = cleAcheteur(c);
    if (!k) continue;
    if (!par.has(k)) par.set(k, { cle: k, site: c.site, compte: String(c.compte), pseudo: '', colis: [] });
    const g = par.get(k);
    g.colis.push(String(c.cle));
    if (!g.pseudo && nonVide(c.pseudo)) g.pseudo = c.pseudo;
  }
  return [...par.values()].filter((g) => g.colis.length >= 2);
}
// Colis → son groupe (clé de colis ⇒ groupe).
export const groupeParColis = (groupes) => { const m = new Map(); for (const g of groupes || []) for (const k of g.colis) m.set(k, g); return m; };

// RAPPROCHER dans la liste, seulement les groupes qu'IL a choisis (`choisis` : Set de clés de groupe) :
// chaque membre vient juste après le premier de son groupe ; tout le reste garde son ordre.
export function rapprocher(liste, cleDe, groupes, choisis) {
  const L = Array.isArray(liste) ? liste : [];
  const actifs = (groupes || []).filter((g) => choisis && choisis.has(g.cle));
  if (!actifs.length) return L;
  const groupeDe = groupeParColis(actifs);
  const places = new Set();
  const out = [];
  const parCle = new Map(L.map((x) => [String(cleDe(x)), x]));
  for (const x of L) {
    const k = String(cleDe(x));
    if (places.has(k)) continue;
    const g = groupeDe.get(k);
    if (!g) { out.push(x); places.add(k); continue; }
    for (const m of g.colis) { const y = parCle.get(m); if (y && !places.has(m)) { out.push(y); places.add(m); } }
  }
  return out;
}

// Les AUTRES colis du même acheteur que `cle` (pour le rappel à l'emballage).
export function autresDuGroupe(groupes, cle) {
  const g = groupeParColis(groupes).get(String(cle));
  return g ? g.colis.filter((k) => k !== String(cle)) : [];
}
