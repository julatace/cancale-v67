// ═══════════════════════════════════════════════════════════════════════════
// LES FAVORIS PAR COMPTE, DU PLUS RÉCENT AU PLUS ANCIEN (12 nov., ext. 5.372)
// Julien : « les messages aux favoris ne me conviennent pas, je veux que ça soit
// par compte et pas par articles, mais simplement la liste du plus récent (en
// haut) au plus vieux en bas ; tu enlèves ceux qui sont liés à des articles
// vendus […] avec la possibilité à côté de chaque favori de cliquer dessus pour
// le sélectionner pour envoyer un message ».
// Règle PURE (aucun DOM, `maintenant` passé) :
//   · les comptes : celui ouvert dans l'onglet vinted.fr d'abord, puis les autres
//     (la règle de Messages, décision du 12 nov.) ;
//   · DANS un compte : une ligne par favori, triée par la DATE DU FAVORI lue de
//     Vinted, la plus récente en haut ; sans date ⇒ en bas (et compté) ;
//   · l'article : vendu (la preuve partagée, `articlesVendus`, par identité) ou
//     plus en ligne (la lecture COMPLÈTE et fraîche — < 24 h — du dressing ne
//     l'a pas) ⇒ le favori n'apparaît pas ; lecture ancienne ou absente ⇒ « pas
//     su » : la ligne reste, marquée « à vérifier », pas cochée par défaut ;
//   · on n'écrit QU'AU NOM DU COMPTE DE L'ONGLET : une sélection ne vaut que pour
//     lui (l'extension le revérifie : `garde`).
// ═══════════════════════════════════════════════════════════════════════════

export const FRAIS_MS = 24 * 60 * 60 * 1000;
const chaine = (v) => String(v == null ? '' : v).trim();

// L'état de l'article d'un favori, pour le compte `uid`.
//   listings : { items, aConfirmer, masquees, lues:{uid:ms}, complets:{uid:true}, ko:[uid], error }
// → 'vendu' · 'en-ligne' · 'hors-ligne' · 'passu'
export function etatArticleFavori(itemId, uid, { vendus, listings, maintenant = Date.now() } = {}) {
  const id = chaine(itemId), u = chaine(uid);
  if (!id) return 'passu';
  if (vendus && typeof vendus.has === 'function' && vendus.has(id)) return 'vendu';
  const L = listings && typeof listings === 'object' ? listings : null;
  if (!L || !Array.isArray(L.items) || L.error) return 'passu';
  const duCompte = (it) => it && chaine(it.id) === id && (!it._acc || chaine(it._acc.vinted_user_id) === u);
  if (L.items.some(duCompte)) return 'en-ligne';
  if ((Array.isArray(L.aConfirmer) ? L.aConfirmer : []).some(duCompte)) return 'passu';
  if (Array.isArray(L.ko) && L.ko.map(chaine).includes(u)) return 'passu';
  const lu = Number(L.lues && L.lues[u]);
  const complet = !!(L.complets && L.complets[u]);
  if (complet && Number.isFinite(lu) && maintenant - lu < FRAIS_MS && maintenant - lu > -FRAIS_MS) return 'hors-ligne';
  return 'passu';
}

// La liste d'un compte : les favoris montrables, du plus récent au plus ancien.
//   lignes   : les favoris lus (`lireFavorisVinted`) — { id, date, lien, nom, body, photo }
//   itemIdDe : ligne → identifiant d'annonce (ou null)
//   etatDe   : ligne → code de l'envoi ('a_envoyer', 'en_cours', 'envoye', 'a_verifier', …)
//   articleDe: itemId → 'vendu' | 'en-ligne' | 'hors-ligne' | 'passu'
// → { lignes:[{ id, itemId, date, article, envoi, cochable, parDefaut }], retires, sansDate }
export function listeFavorisCompte(lignes, { itemIdDe, etatDe, articleDe } = {}) {
  const out = [];
  let retires = 0, sansDate = 0;
  for (const l of Array.isArray(lignes) ? lignes : []) {
    if (!l || l.id == null) continue;
    const itemId = typeof itemIdDe === 'function' ? itemIdDe(l) : null;
    const article = itemId ? (typeof articleDe === 'function' ? articleDe(itemId) : 'passu') : 'passu';
    if (article === 'vendu' || article === 'hors-ligne') { retires++; continue; }
    const t = Date.parse(l.date || '');
    const date = Number.isFinite(t) ? t : null;
    if (date == null) sansDate++;
    const envoi = typeof etatDe === 'function' ? (etatDe(l) || 'a_envoyer') : 'a_envoyer';
    const libre = envoi === 'a_envoyer' && !!itemId;
    out.push({ id: String(l.id), itemId: itemId ? String(itemId) : null, date, article, envoi,
      cochable: libre, parDefaut: libre && article === 'en-ligne' });
  }
  out.sort((a, b) => (a.date == null) - (b.date == null) || (b.date || 0) - (a.date || 0) || a.id.localeCompare(b.id));
  return { lignes: out, retires, sansDate };
}

// Les comptes dans l'ordre : l'onglet d'abord, puis les autres (ordre reçu).
//   comptes : [{ uid, nom }] ; uidOnglet : '' si pas su.
export function ordreComptes(comptes, uidOnglet) {
  const L = (Array.isArray(comptes) ? comptes : []).filter((c) => c && /^\d{1,20}$/.test(chaine(c.uid)));
  const vus = new Set(), out = [];
  const o = chaine(uidOnglet);
  const tete = o ? L.find((c) => chaine(c.uid) === o) : null;
  if (tete) { out.push({ ...tete, onglet: true }); vus.add(o); }
  for (const c of L) if (!vus.has(chaine(c.uid))) { vus.add(chaine(c.uid)); out.push({ ...c, onglet: false }); }
  return out;
}

// La sélection ENVOYABLE : seulement des favoris cochables du compte de l'onglet.
export function selectionEnvoyable(choisis, liste, { uid, uidOnglet } = {}) {
  if (!chaine(uidOnglet) || chaine(uid) !== chaine(uidOnglet)) return [];
  const ok = new Set((liste || []).filter((l) => l.cochable).map((l) => l.id));
  return (Array.isArray(choisis) ? choisis : []).map(String).filter((id) => ok.has(id));
}
