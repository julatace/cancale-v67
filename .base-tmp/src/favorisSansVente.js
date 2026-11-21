// ═══════════════════════════════════════════════════════════════════════════
// LES ANNONCES TRÈS MISES EN FAVORI MAIS PAS VENDUES (13 nov., lot 31, point 31
// de Julien) — avec la proposition d'offre à leurs favoris.
// Règle PURE (aucun DOM, aucune lecture, `maintenant` passé) :
//   · par compte (celui de l'onglet a les gestes, les autres sont à lire) ;
//   · une annonce EN LIGNE de ce compte (la lecture complète et fraîche du
//     dressing, `listings.items` — la règle « En ligne » de l'app), pas vendue
//     (la preuve partagée `vendus`, par identité), pas réservée ;
//   · au moins N favoris (N réglable, 3 par défaut) — le NOMBRE lu par la
//     lecture du dressing (`favourites`, `favourite_count` de Vinted), jamais
//     deviné : pas lu ⇒ l'annonce n'est PAS listée et la raison est comptée ;
//   · en ligne depuis au moins 14 jours (jours LUS : date Vinted ou « Ajouté il
//     y a… ») ; date pas lue ⇒ pas listée, raison comptée ;
//   · triées par favoris décroissants (puis la plus ancienne, puis l'identifiant).
// Le geste « Proposer une offre aux N favoris » ne fait QUE pré-remplir le flux
// existant des messages aux favoris (file serveur à autorisation unique, offre
// Vinted réelle, plafond 50 actions/h) : SON clic sur « Envoyer » fait partir.
//   · N = les favoris CONNUS de VRM pour cette annonce (la cloche de Vinted),
//     un par personne (identité `article:personne`), jamais un déjà contacté
//     (l'état d'envoi de la file, par la même identité que le serveur) ;
//   · prix proposé = prix − x %, x choisi par lui ; jamais sous le prix d'achat
//     + 10 % (`plancherConseil`, la règle du conseil de baisse) quand l'achat est
//     connu ; achat inconnu ⇒ rien de proposé tant qu'il n'a pas tapé x.
// ═══════════════════════════════════════════════════════════════════════════
import { plancherConseil, centimes } from './conseilPrix.js';
import { prixOffreFavori } from './favorisMessage.js';

export const FAVORIS_MIN_DEFAUT = 3;
export const JOURS_MIN = 14;
export const REMISE_DEFAUT = 10;
export const CLE_FAVORIS_MIN = 'vrm_sans_vente_favoris_min';

const chaine = (v) => String(v == null ? '' : v).trim();
const entierOuNull = (v) => { const n = Number(v); return v != null && v !== '' && Number.isFinite(n) && n >= 0 ? Math.floor(n) : null; };

// N réglable : un entier de 1 à 999, sinon le défaut.
export function lireSeuilFavoris(v) {
  const n = Number(chaine(v));
  return Number.isInteger(n) && n >= 1 && n <= 999 ? n : FAVORIS_MIN_DEFAUT;
}

// Le nombre de favoris LU sur l'annonce (forme de l'app ou forme brute de Vinted), sinon null.
export function favorisLus(it) {
  if (!it || typeof it !== 'object') return null;
  for (const k of ['favourites', 'favourite_count', 'favourites_count']) {
    const v = it[k];
    if (typeof v === 'number' && Number.isInteger(v) && v >= 0) return v;
  }
  return null;
}

// LES ANNONCES D'UN COMPTE.
//   listings  : { items, aConfirmer, error } (l'état partagé de l'app)
//   vendus    : Set d'identifiants d'annonce vendus (preuve partagée)
//   infosDe   : id → { titre, numero, photo, prix, jours, achat } (ou null)
//   seuil     : N (favoris au moins)
// → { lecture: 'ok' | 'passu', annonces: [...], ecartees: { favoris, date, prix, lecture, reservee } }
export function annoncesSansVente({ uid, listings, vendus, infosDe, seuil = FAVORIS_MIN_DEFAUT } = {}) {
  const u = chaine(uid);
  const ecartees = { favoris: 0, date: 0, prix: 0, lecture: 0, reservee: 0 };
  const L = listings && typeof listings === 'object' ? listings : null;
  if (!u || !L || L.error || !Array.isArray(L.items)) return { lecture: 'passu', annonces: [], ecartees };
  const N = lireSeuilFavoris(seuil);
  const duCompte = (it) => it && it.id != null && it._acc && chaine(it._acc.vinted_user_id) === u;
  const vendu = (id) => !!(vendus && typeof vendus.has === 'function' && vendus.has(id));
  const out = [];
  const vus = new Set();
  for (const it of L.items) {
    if (!duCompte(it)) continue;
    const id = chaine(it.id);
    if (!id || vus.has(id)) continue;
    vus.add(id);
    if (vendu(id)) continue;                       // vendue : elle n'est pas « pas vendue »
    const favoris = favorisLus(it);
    if (it.reserved === true || it.is_reserved === true) { if (favoris == null || favoris >= N) ecartees.reservee++; continue; }
    if (favoris == null) { ecartees.favoris++; continue; }
    if (favoris < N) continue;
    const info = (typeof infosDe === 'function' ? infosDe(id) : null) || {};
    const jours = entierOuNull(info.jours);
    if (jours == null) { ecartees.date++; continue; }
    if (jours < JOURS_MIN) continue;
    const pC = centimes(info.prix != null ? info.prix : it.price);
    if (pC == null) { ecartees.prix++; continue; }
    const achat = Number(info.achat);
    out.push({ itemId: id, titre: chaine(info.titre || it.title), numero: chaine(info.numero), photo: info.photo || null,
      prix: pC / 100, favoris, jours, achat: Number.isFinite(achat) && achat > 0 ? achat : null });
  }
  // Une annonce « à confirmer » (lecture du dressing de plus de 24 h) de ce compte : pas su.
  for (const it of Array.isArray(L.aConfirmer) ? L.aConfirmer : []) {
    if (!duCompte(it) || vus.has(chaine(it.id)) || vendu(chaine(it.id))) continue;
    vus.add(chaine(it.id));
    const f = favorisLus(it);
    if (f == null || f >= N) ecartees.lecture++;
  }
  out.sort((a, b) => b.favoris - a.favoris || b.jours - a.jours || a.itemId.localeCompare(b.itemId));
  return { lecture: 'ok', annonces: out, ecartees };
}

// LES FAVORIS À QUI ÉCRIRE pour une annonce : les lignes de la liste des favoris
// (`listeFavorisCompte`) de CETTE annonce, cochables (pas déjà contactées), une par
// personne (`identiteDe(id)` = « article:personne » ; sans identité, la ligne compte seule).
//   rows : [{ id, itemId, cochable, envoi, date }]
// → { ids: [...], deja: n }
export function favorisAContacter(rows, itemId, identiteDe = () => null) {
  const id = chaine(itemId);
  const ids = [], personnes = new Set(), contactees = new Set();
  let deja = 0;
  const lignes = (Array.isArray(rows) ? rows : []).filter((r) => r && chaine(r.itemId) === id)
    .slice().sort((a, b) => (b.date || 0) - (a.date || 0));
  // « déjà contacté » : envoyé, en cours ou à vérifier (par n'importe laquelle de ses lignes) ;
  // une ligne « pas envoyée » (conversation déjà commencée, annulée…) n'est pas cochable non plus.
  const contacte = (r) => r.envoi === 'envoye' || r.envoi === 'en_cours' || r.envoi === 'a_verifier';
  for (const r of lignes) if (contacte(r)) { const p = identiteDe(r.id); if (p) contactees.add(p); }
  for (const r of lignes) {
    const p = identiteDe(r.id);
    if (contacte(r)) { if (!p || !personnes.has(p)) { deja++; if (p) personnes.add(p); } continue; }
    if (r.envoi !== 'a_envoyer' || !r.cochable) continue;
    if (p && (contactees.has(p) || personnes.has(p))) continue;
    if (p) personnes.add(p);
    ids.push(String(r.id));
  }
  return { ids, deja };
}

// L'OFFRE PROPOSÉE pour une annonce.
//   prix    : prix de l'annonce (euros)
//   achat   : prix d'achat saisi (euros) ou null
//   remise  : ce qu'il a tapé (« 15 ») ou '' / null (rien tapé)
// → { etat:'ok', pct, apres, plancher, limitee, demande }
//   { etat:'saisir' }       achat inconnu et rien tapé : rien n'est proposé
//   { etat:'invalide' }     x n'est pas un entier de 1 à 99
//   { etat:'plancher', plancher }  aucune remise ne reste au-dessus de l'achat + 10 %
//   { etat:'prix' }         prix illisible
export function offreSansVente({ prix, achat = null, remise = '' } = {}) {
  const pC = centimes(prix);
  if (pC == null) return { etat: 'prix' };
  const plancher = achat != null ? plancherConseil(achat) : null;
  const brut = chaine(remise);
  let demande;
  if (!brut) {
    if (plancher == null) return { etat: 'saisir' };
    demande = REMISE_DEFAUT;
  } else {
    if (!/^\d{1,2}$/.test(brut) || Number(brut) < 1 || Number(brut) > 99) return { etat: 'invalide' };
    demande = Number(brut);
  }
  const apresDe = (pct) => { const a = prixOffreFavori(pC / 100, { mode: 'pct', valeur: pct }); return a == null ? null : Number(a); };
  let pct = demande;
  if (plancher != null) {
    while (pct >= 1) { const a = apresDe(pct); if (a != null && a >= plancher) break; pct--; }
    if (pct < 1) return { etat: 'plancher', plancher };
  }
  const apres = apresDe(pct);
  if (apres == null) return { etat: 'invalide' };
  return { etat: 'ok', pct, apres, plancher, limitee: pct < demande, demande };
}

// Le garde-fou au moment d'envoyer : une annonce venue de cette liste dont l'offre
// actuelle (après une retouche dans l'étape 2) tombe sous l'achat + 10 % ⇒ refusée.
//   annonces : [{ itemId, offre:{ apres } }] (le récapitulatif) ; origines : Map itemId → achat
export function sousPlancherAchat(annonces, origines) {
  const out = [];
  for (const a of Array.isArray(annonces) ? annonces : []) {
    if (!a || !(origines instanceof Map) || !origines.has(String(a.itemId))) continue;
    const pl = plancherConseil(origines.get(String(a.itemId)));
    const apres = a.offre && a.offre.apres != null ? Number(a.offre.apres) : null;
    if (pl != null && apres != null && apres < pl) out.push({ itemId: String(a.itemId), plancher: pl });
  }
  return out;
}
