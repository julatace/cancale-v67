// ══════════════════════════════════════════════════════════════════════════
// VESTIAIRE · « ONT AIMÉ TES ARTICLES » ET L'OFFRE QU'ON LEUR FAIT (15 nov., lot favoris-sites)
//
// Julien : « est-ce que tu as lancé les messages aux favoris sur Vestiaire Collective ? »
// MESURÉ (lecture seule, 15 nov.) : Vestiaire NOMME chaque personne qui aime un article (une
// carte du fil des notifications par « j'aime », qui invite à lui écrire), et le vendeur peut
// lui faire la PREMIÈRE offre. L'extension 5.392 garde ces personnes dans CE navigateur et
// n'envoie à la base que des NOMBRES (`vc_aimes`) ; ce module dit, par article, combien,
// combien déjà prévenues, et borne l'offre. Rien ici n'envoie quoi que ce soit.
// Module PUR : l'écran Vestiaire et `scripts/audit-favoris-sites.cjs` l'exécutent (§11).
// ══════════════════════════════════════════════════════════════════════════

const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
const entier = (v) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null);
// Le prix d'une annonce Vestiaire tel que l'extension le range (`{ valeur, cle, devise }`, en euros) ⇒ centimes.
export const centsPrixVc = (p) => (p && typeof p.valeur === 'number' && Number.isFinite(p.valeur) && /price/i.test(String(p.cle || '')) && (!p.devise || p.devise === 'EUR') ? Math.round(p.valeur * 100) : null);
export const REMISES = [5, 10, 15];
export const PAR_TOUCHER = 10;   // l'extension prévient 10 personnes au plus par toucher

// L'état de la recette « favori » (`vc_offres_recette.favori`) : 'appris' · 'pas-rejouable' · 'pas-appris'.
export function etatRecetteFavori(r) {
  if (!r || typeof r !== 'object') return { etat: 'pas-appris', raison: '' };
  if (r.appris === true) return { etat: 'appris', raison: '' };
  return { etat: 'pas-rejouable', raison: String(r.raison || '') };
}

// `aimes` : la ligne `vc_aimes` (data) ; null = pas lue ; {} = jamais reçue.
// `items` : `vc_listings.items` ; `numDe(produit)` : son N° (par identité, jamais le titre).
// Rend { pret, lignes, envoi, total } ; une ligne = un article A LUI, lu, au prix lu, avec au
// moins une personne vue : { produit, n, prevenues, aPrevenir, dernier, titre, photo, prixCents,
// compte, numero }. Un article que VRM n'a pas lu n'est pas proposé (pas de prix ⇒ pas d'offre).
export function lignesAimes({ aimes, items, numDe = () => '' } = {}) {
  if (aimes === undefined) return { pret: false, lignes: [], envoi: null, total: 0 };
  if (aimes === null) return { pret: true, lu: false, lignes: [], envoi: null, total: 0 };
  const P = objet(aimes && aimes.produits) || {};
  const I = objet(items) || {};
  const lignes = [];
  let total = 0;
  for (const x of Object.values(P)) {
    if (!x || !/^\d{3,15}$/.test(String(x.produit || ''))) continue;
    const n = entier(x.n);
    if (!n) continue;
    total += n;
    const it = objet(I[String(x.produit)]);
    if (!it) continue;                                   // pas lu dans « Mes articles » : rien proposé
    const prixCents = centsPrixVc(it.prix);
    const prevenues = Math.min(n, entier(x.prevenues) || 0);
    lignes.push({ produit: String(x.produit), n, prevenues, aPrevenir: n - prevenues, dernier: String(x.dernier || ''), titre: String(it.titre || ''),
      photo: String(it.photo || ''), prixCents, compte: String(it.compte || ''), numero: String(numDe(String(x.produit)) || '') });
  }
  lignes.sort((a, b) => b.aPrevenir - a.aPrevenir || String(b.dernier).localeCompare(String(a.dernier)) || a.produit.localeCompare(b.produit));
  const e = objet(aimes && aimes.envoi);
  const envoi = e && /^\d{3,15}$/.test(String(e.produit || '')) ? { produit: String(e.produit), at: String(e.at || ''), cents: entier(e.cents), n: entier(e.n) || 0, faites: entier(e.faites) || 0,
    incertaines: entier(e.incertaines) || 0, fin: e.fin === 'fini' || e.fin === 'arret' ? e.fin : '', raison: String(e.raison || '') } : null;
  return { pret: true, lu: true, lignes, envoi, total };
}

// L'offre : en centimes, sous le prix, 1 € au moins. null ⇒ pas valable (le bouton se tait).
export function montantOffre(texte, prixCents) {
  const s = String(texte == null ? '' : texte).replace(/\s|€/g, '').replace(',', '.');
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(s)) return null;
  const c = Math.round(Number(s) * 100);
  if (!(c >= 100) || !(Number.isInteger(prixCents) && c < prixCents)) return null;
  return c;
}
// Les remises proposées (son choix ; arrondies à l'euro, toujours sous le prix).
export function remises(prixCents) {
  if (!Number.isInteger(prixCents) || prixCents < 200) return [];
  return REMISES.map((p) => ({ p, cents: Math.floor((prixCents * (100 - p)) / 10000) * 100 })).filter((x) => x.cents >= 100 && x.cents < prixCents);
}
