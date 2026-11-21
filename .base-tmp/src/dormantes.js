// ═══════════════════════════════════════════════════════════════════════════
// LE BÉNÉFICE « SI VENDUE » ET LES PAIRES QUI DORMENT (13 nov., points 14 et 15)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « 14. le bénéfice réel par paire, sur sa fiche » ; « 15. les paires qui
// dorment depuis plus de 30 jours, chacune avec UN geste proposé ».
// Module PUR, AUCUNE règle neuve (§5 « une seule règle par notion ») :
//   · le bénéfice = `beneficeLigneVente` (src/beneficeLigne.js, sur `beneficePaire`)
//     — la même règle que la ligne d'une vente, la compta et `vrm_benefice_jours` :
//     prix − prix d'achat SAISI − frais SAISIS (boost, port payé par lui, emballage…),
//     en centimes. Vinted ne prend aucune commission au vendeur (src/fraisPlateformes.js) :
//     le prix affiché est ce qu'il toucherait. Les frais pas tous confirmés ⇒ « au plus »
//     (ce qui reste à déduire ne peut que BAISSER le bénéfice). Achat pas saisi ⇒ `null`,
//     « — », la raison nommée — jamais 0 (§2.5 : il le saisit, jamais deviné) ;
//   · « qui dort » = `articlesQuiDorment` (src/quiDorment.js), appelé par l'écran ;
//   · la baisse proposée = `conseilBaisse` (src/conseilPrix.js : ≥ 30 j, ≤ −10 %,
//     ≥ 14 j entre deux, jamais sous achat + 10 %, rien si achat inconnu), fourni ;
//   · les gestes = `gestesDormeuse` (src/vendrePlus.js) : ceux qui EXISTENT, chacun
//     ouvre l'écran existant sur SON clic. Ici on n'en CHOISIT qu'un à montrer.
// Rien n'est lu ni écrit ici, rien ne part tout seul. Exécuté par
// scripts/audit-dormantes.cjs.
import { beneficeLigneVente } from './beneficeLigne.js';
import { gestesDormeuse, compteurLu } from './vendrePlus.js';

// ── 14. LE BÉNÉFICE SI ELLE SE VEND À CE PRIX ──────────────────────────────
// `prix` : le prix affiché (euros, texte ou nombre, ou l'objet Vinted { amount }) ;
// `entree` : la fiche de la paire (prix d'achat résolu, `fusionEntreeVente`).
// → { etat: 'ok' | 'partiel' | 'achat' | 'prix' | 'illisible', prix, benefice } en centimes.
const montantDe = (p) => (p && typeof p === 'object' ? p.amount : p);
export function beneficeSiVendue(prix, entree) {
  const v = montantDe(prix);
  const n = Number(String(v == null ? '' : v).replace(',', '.'));
  if (!(Number.isFinite(n) && n > 0)) return { etat: 'prix', prix: null, benefice: null };
  const r = beneficeLigneVente(String(v).replace(',', '.'), entree || {});
  const pc = Math.round(n * 100);
  if (r.benefice == null) return { etat: r.etat, prix: pc, benefice: null };
  return { etat: r.etat, prix: pc, benefice: Math.round(r.benefice * 100) };
}
// La raison d'un « — », en mots (≤ 4 mots).
export const RAISON_SI_VENDUE = { achat: 'prix d’achat pas saisi', prix: 'prix pas lu', illisible: 'montant illisible' };

// ── 15. UN GESTE PAR PAIRE QUI DORT ────────────────────────────────────────
// Dans l'ordre (le premier qui s'applique et n'est pas bloqué) :
//   1. une baisse PROPOSÉE par `conseilBaisse` ⇒ « Baisser à X € » (la feuille
//      « Baisser le prix » s'ouvre pré-remplie ; c'est LUI qui confirme) ;
//   2. des favoris LUS ⇒ « Offre aux favoris » (la file existante, SON clic) ;
//   3. peu vue (vues LUES ≤ 25, le plafond par défaut de « Quoi republier ») ⇒ « Republier »
//      (l'atelier, la paire pré-choisie ; c'est LUI qui lance, §3) ;
//   4. pas encore sur Leboncoin (et Leboncoin affiché) ⇒ « Sur Leboncoin » ;
//   5. sinon « Republier ».
// Un geste bloqué (extension trop ancienne, lien pas lu) laisse la place au suivant ;
// tous bloqués ⇒ le premier, avec sa raison (dite au toucher, §2.7). Pas su (vues ou
// favoris pas lus) ne vaut jamais « peu » ni « aucun ».
export const VUES_PEU = 25;
const COURT = { favoris: 'Offre aux favoris', republier: 'Republier', lbc: 'Sur Leboncoin', vestiaire: 'Sur Vestiaire', ebay: 'Sur eBay', prix: 'Baisser le prix', vinted: 'Ouvrir sur Vinted' };
const euros = (e) => { const a = Math.round(Number(e) * 100) / 100; return (Number.isInteger(a) ? String(a) : a.toFixed(2).replace('.', ',')) + ' €'; };
export function gesteDormante({ conseil = null, favoris = null, vues = null, surLbc = false, numero = '', url = '', cap, version, sites = null } = {}) {
  const tous = gestesDormeuse({ numero, favoris, url, cap, version, sites });
  const de = (k) => tous.find((g) => g.k === k) || null;
  const cand = [];
  if (conseil && Number.isFinite(Number(conseil.sugg)) && Number(conseil.sugg) > 0) cand.push({ k: 'baisser', t: `Baisser à ${euros(conseil.sugg)}`, sugg: Number(conseil.sugg), bloque: '' });
  if (de('favoris')) cand.push(de('favoris'));
  const v = compteurLu(vues);
  if (v != null && v <= VUES_PEU && de('republier')) cand.push(de('republier'));
  if (!surLbc && de('lbc')) cand.push(de('lbc'));
  if (de('republier')) cand.push(de('republier'));
  const vus = new Set();
  const uniques = cand.filter((g) => (vus.has(g.k) ? false : (vus.add(g.k), true)));
  const g = uniques.find((x) => !x.bloque) || uniques[0] || null;
  if (!g) return null;
  return { k: g.k, t: g.k === 'baisser' ? g.t : (COURT[g.k] || g.t), sugg: g.sugg ?? null, bloque: g.bloque || '' };
}

// ── LE TRI : CE QUI RAPPORTE LE PLUS À DÉBLOQUER ───────────────────────────
// `lignes` : [{ id, age, prix (euros|null), valeur: beneficeSiVendue(…) }]. La valeur se
// calcule au prix du geste (la baisse proposée si elle existe, sinon le prix affiché).
// Ordre : bénéfice CONNU du plus grand au plus petit ; puis bénéfice pas su (achat pas
// saisi), du prix le plus haut au plus bas ; à égalité le plus ancien, puis l'identifiant.
// Une ligne au bénéfice pas su n'est jamais classée comme un 0 (§5).
export function classerDormantes(lignes) {
  if (!Array.isArray(lignes)) return null;
  const b = (l) => (l && l.valeur && Number.isFinite(l.valeur.benefice) ? l.valeur.benefice : null);
  const p = (l) => (l && Number.isFinite(Number(l.prix)) && Number(l.prix) > 0 ? Number(l.prix) : null);
  const a = (l) => (l && Number.isFinite(Number(l.age)) ? Number(l.age) : -1);
  return lignes.slice().sort((x, y) => {
    const bx = b(x), by = b(y);
    if (bx != null && by == null) return -1;
    if (bx == null && by != null) return 1;
    if (bx != null && by != null && bx !== by) return by - bx;
    const px = p(x), py = p(y);
    if (bx == null && by == null && px !== py) { if (px == null) return 1; if (py == null) return -1; return py - px; }
    return a(y) - a(x) || (String(x.id) < String(y.id) ? -1 : String(x.id) > String(y.id) ? 1 : 0);
  });
}
// « Bénéfice +18 € », « au plus +18 € », « Prix d'achat ? » — ≤ 4 mots.
export function texteBeneficeSiVendue(v) {
  if (!v || v.benefice == null) return '';
  const s = (v.benefice >= 0 ? '+' : '−') + euros(Math.abs(v.benefice) / 100);
  return v.etat === 'partiel' ? `au plus ${s}` : s;
}
