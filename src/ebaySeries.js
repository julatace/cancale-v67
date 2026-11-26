// ── src/ebaySeries.js — eBay « en série », sur SON clic (23 nov.) ────────────────────────────────
// Julien : « fais pareil pour eBay pour la republication et les messages aux favoris ». Sur Vinted, il choisit
// plusieurs paires et lance ; sur eBay, les deux gestes natifs existaient une annonce à la fois :
//   · l'OFFRE AUX OBSERVATEURS (Negotiation API, c'est eBay qui choisit à qui — VRM ne nomme personne, §3) ;
//   · la REMISE EN VENTE d'une inactive (`RelistFixedPriceItem`, l'identifiant seul, §2.8).
// Ce module PUR dit quelles lignes sont proposables, calcule le prix de chaque offre (même formule que la route,
// `api/_lib/ebay-offre.js` — `scripts/audit-ebay-series.cjs` compare les deux) et enchaîne les envois UN À UN
// par la même route (chaque garde du serveur rejouée pour chaque annonce). Rien ici n'appelle eBay.

export const REMISE_MIN = 5, REMISE_MAX = 50;
export const remiseValide = (r) => Number.isInteger(r) && r >= REMISE_MIN && r <= REMISE_MAX;
export const lireRemise = (t) => (/^\s*\d{1,2}\s*$/.test(String(t == null ? '' : t)) ? parseInt(String(t), 10) : NaN);

// Un montant lu (« 74 », « 74,50 », 74.5) ⇒ centimes ; illisible ⇒ null.
export const centimes = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? Math.round(v * 100) : null;
  const s = String(v == null ? '' : v).trim().replace(',', '.');
  if (!/^\d{1,7}(?:\.\d{1,6})?$/.test(s)) return null;
  const n = Math.round(Number(s) * 100);
  return Number.isFinite(n) && n > 0 ? n : null;
};
// LA formule (copie de `prixOffreCents` de la route) : le prix × (100 − remise) / 100, au centime.
export const prixOffreCents = (prixCents, remise) => (Number.isInteger(prixCents) && prixCents > 0 && Number.isInteger(remise) && remise > 0 && remise < 100
  ? Math.round(prixCents * (100 - remise) / 100) : null);

// Les lignes de la feuille « Offres aux observateurs ».
//   items     : les annonces affichées (chacune `{ itemId, _compte, title, photo, price }`) ;
//   eligibles : `{ ids:Set, enCours: {id:{jusqua,…}} | null }` (lu d'eBay et du journal) ; null ⇒ pas su ;
//   prixDe(it) : le prix AFFICHÉ (celui qu'il voit) ; numeroDe(it) : le N° lu dans le SKU ; achatDe(n) : son prix d'achat (€) ou null.
// État d'une ligne : 'prete' · 'en-cours' (une offre court encore, 48 h) · 'prix-pas-lu'. Pas éligible ⇒ absente.
export function lignesOffres({ items = [], eligibles = null, prixDe = (it) => it && it.price, numeroDe = () => '', achatDe = () => null } = {}) {
  if (!eligibles || !eligibles.ids || typeof eligibles.ids.has !== 'function') return null;
  const enCours = eligibles.enCours && typeof eligibles.enCours === 'object' ? eligibles.enCours : null;
  const out = [];
  for (const it of Array.isArray(items) ? items : []) {
    if (!it || !/^\d{1,19}$/.test(String(it.itemId || ''))) continue;
    const id = String(it.itemId);
    if (!eligibles.ids.has(id)) continue;
    const prixCents = centimes(prixDe(it));
    const numero = String(numeroDe(it) || '');
    const a = numero ? achatDe(numero) : null;
    const achatCents = typeof a === 'number' && Number.isFinite(a) && a > 0 ? Math.round(a * 100) : null;
    const e = enCours && enCours[id];
    out.push({ cle: (it._compte || '') + ':' + id, itemId: id, compte: it._compte || '', titre: String(it.title || id), photo: typeof it.photo === 'string' ? it.photo : '',
      numero, prixCents, achatCents, etat: e ? 'en-cours' : prixCents == null ? 'prix-pas-lu' : 'prete', jusqua: e ? String(e.jusqua || '') : '' });
  }
  return out;
}

// Le prix de l'offre d'une ligne, et s'il passe sous son prix d'achat (un fait à dire, pas un refus).
export function offreDe(ligne, remise) {
  const offreCents = ligne && remiseValide(remise) ? prixOffreCents(ligne.prixCents, remise) : null;
  return { offreCents, sousAchat: offreCents != null && ligne.achatCents != null && offreCents < ligne.achatCents };
}

// Les refus qui valent pour TOUTES les lignes suivantes (compte déconnecté, accès, abonnement) : on s'arrête là.
const ARRET = new Set(['scope', 'not-connected', 'abonnement', 'session', 'journal-pas-su']);
export const arreteLaSerie = (r) => !!r && (r.code === 401 || r.code === 402 || ARRET.has(String((r.j && r.j.reason) || '')));
// Un résultat de la route ⇒ l'état d'une ligne : 'fait' · 'incertain' · 'refuse' (avec la phrase du serveur).
export function issueDe(r) {
  if (r && r.j && r.j.ok === true) return { etat: 'fait', j: r.j };
  if (!r || r.code === 0 || r.code === 504 || (r.j && r.j.reason === 'incertain')) return { etat: 'incertain', texte: (r && r.j && r.j.error) || '' };
  return { etat: 'refuse', texte: (r.j && r.j.error) || '', raison: String((r.j && r.j.reason) || '') };
}

// Enchaîne `faire(ligne)` (une promesse qui rend `{ code, j }`) UNE ligne après l'autre, jamais deux à la fois.
// `surLigne(cle, issue)` est appelé après chacune ; `arret()` vrai ⇒ on s'arrête avant la suivante (« Tout arrêter »).
// Un refus d'arrêt (compte, abonnement) ⇒ les lignes restantes sont « pas envoyées », sans rien appeler.
export async function enSerie(lignes, faire, { surLigne = () => {}, arret = () => false } = {}) {
  const issues = {};
  let stop = '';
  for (const l of Array.isArray(lignes) ? lignes : []) {
    if (stop || arret()) { issues[l.cle] = { etat: 'pas-envoye', texte: stop }; surLigne(l.cle, issues[l.cle]); continue; }
    let r;
    try { r = await faire(l); } catch (_) { r = { code: 0, j: null }; }
    issues[l.cle] = issueDe(r);
    surLigne(l.cle, issues[l.cle]);
    if (arreteLaSerie(r)) stop = (r.j && r.j.error) || 'arrêté';
  }
  return issues;
}
