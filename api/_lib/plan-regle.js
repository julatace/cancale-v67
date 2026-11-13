// ══════════════════════════════════════════════════════════════════════════════
// SOLO ET PRO — LA RÈGLE DES VENTES PAR OFFRE (9 novembre 2026)
// ══════════════════════════════════════════════════════════════════════════════
// Julien (9 nov.) : « Ça peut être 1 compte vendeur et plein de comptes achat,
// donc sur ces comptes on prend que les achats ; pour avoir toutes ses ventes de
// tous ses comptes il prend l'abonnement du dessus. »
//
//   · SOLO (le prix `vrm_mensuel`) : UN compte vendeur, choisi par LUI (jamais
//     deviné) — ventes, annonces, colis à envoyer, offres et compta de ce compte —,
//     et des comptes d'ACHAT illimités (leurs achats, retraits, colis à retirer).
//   · PRO (« l'abonnement du dessus ») : les ventes de TOUS ses comptes. Son prix
//     n'est PAS fixé : tant que `STRIPE_PRIX_PRO` et `PRIX_PRO_CGV` sont vides,
//     l'offre est « bientôt », sans bouton de paiement.
//
// UNE règle, UN propriétaire (§11) : l'app (src/abonnement/planVentes.js,
// App.jsx) ET le serveur (notifications de vente, api/email-inbound.js) importent
// CE fichier — jamais une copie. Pur : aucune lecture, aucune écriture.
//
// ⚠️ « PAS SU » NE BRIDE JAMAIS. Le plan vient du PRIX Stripe réel de SON
//    abonnement (jamais d'un champ du navigateur). Plan illisible, prix inconnu,
//    abonnement souscrit avant les CGV qui décrivent Solo (elles promettaient
//    « tous tes comptes »), Solo sans compte vendeur CHOISI ⇒ comportement
//    d'avant : tout compte. Le propriétaire de l'installation : Pro, toujours.
// ⚠️ L'IDENTITÉ D'UN COMPTE est son `vinted_user_id` — jamais un pseudo (§5 :
//    50 comptes au même pseudo ne désignent rien). Une vente sans compte relevé
//    n'est jamais écartée (« pas su » ne vaut pas « oui »).
// ⚠️ RIEN N'EST SUPPRIMÉ : une vente hors offre sort des TOTAUX et se montre en
//    aperçu (extrait net, reste flouté, `inert`) ; passer à Pro rend tout.
// ══════════════════════════════════════════════════════════════════════════════

export const PLAN_SOLO = 'solo';
export const PLAN_PRO = 'pro';
// Les CGV qui décrivent Solo et Pro (public/legal/cgv.html, `CGV_VERSION` de
// api/compte.js). Un abonnement Solo accepté AVANT n'est jamais bridé : ses CGV
// disaient « pour tous tes comptes ».
export const CGV_PLANS_DEPUIS = '2026-11-09';
// Changer de compte vendeur : une fois tous les 30 jours (le premier choix est libre).
export const JOURS_CHANGEMENT_VENDEUR = 30;
const JOUR_MS = 86400000;

export const uidValide = (u) => /^\d{1,20}$/.test(String(u == null ? '' : u).trim());
const uidDe = (u) => String(u == null ? '' : u).trim();

// La clé de recherche Stripe du prix Solo (celle de `PRIX_CLE` dans api/compte.js).
export const CLE_PRIX_SOLO = 'vrm_mensuel';
// La clé de recherche du prix Pro chez Stripe (geste de Julien, passation du 9 nov.).
export const CLE_PRIX_PRO = 'vrm_pro_mensuel';

// ── (13 nov., lot 56) PLUSIEURS COMPTES VINTED DÈS SOLO ─────────────────────
// Solo inclut UN compte vendeur Vinted ; chaque compte Vinted vendeur DE PLUS
// coûte `PRIX_COMPTE_SUP_CENTIMES` par mois (3 € par défaut, À CONFIRMER par
// Julien : docs/passation/2026-11-13-lot5658.md). C'est la SEULE valeur : le
// serveur (route, conformité du prix Stripe), l'écran et l'accueil la lisent ici.
// Chez Stripe : un 2e article de l'abonnement Solo, au prix de clé de recherche
// `vrm_compte_sup`, quantité N = le nombre de comptes de plus PAYÉS. Les comptes
// eux-mêmes (des `vinted_user_id`, choisis par LUI) sont dans les métadonnées
// `vrm_comptes_sup`, posées par la route `compte-vendeur` — jamais par le
// navigateur. ⚠️ LA LIMITE EST CELLE DE LA QUANTITÉ PAYÉE : une liste plus longue
// (quantité baissée chez Stripe) ne garde que ses N premiers comptes, dans
// l'ordre où il les a ajoutés. Pro reste illimité (aucune liste lue en Pro).
export const PRIX_COMPTE_SUP_CENTIMES = 300;
export const CLE_PRIX_COMPTE_SUP = 'vrm_compte_sup';
export const COMPTES_INCLUS_SOLO = 1;
export const META_COMPTES_SUP = 'vrm_comptes_sup';
// Au plus 20 comptes de plus (la métadonnée Stripe tient 500 caractères ; au-delà
// d'un compte de plus, Pro — illimité — coûte de toute façon moins cher).
export const MAX_COMPTES_SUP = 20;
// « 3 € » / « 2,50 € » : le texte du supplément, écrit une fois.
export const prixCompteSupTexte = (c = PRIX_COMPTE_SUP_CENTIMES) => (c % 100 === 0 ? String(c / 100) : (c / 100).toFixed(2).replace('.', ',')) + '\u00a0€';
// La liste des comptes de plus, propre (uids valides, sans doublon, sans le compte inclus).
export function listeComptesSup(brut, vendeur = null) {
  const l = Array.isArray(brut) ? brut : String(brut == null ? '' : brut).split(',');
  const vus = new Set(vendeur ? [String(vendeur)] : []), out = [];
  for (const x of l) { const u = uidDe(x); if (uidValide(u) && !vus.has(u)) { vus.add(u); out.push(u); } }
  return out;
}
// Le prix d'un article est-il celui des comptes de plus ?
export const estPrixCompteSup = (p) => !!p && typeof p === 'object' && String(p.lookup_key || '') === CLE_PRIX_COMPTE_SUP;

// Le PLAN d'un prix Stripe. `pro` : l'identifiant OU la clé de recherche posée
// dans `STRIPE_PRIX_PRO` (vide ⇒ aucun prix n'est Pro). `solo` : la clé de
// recherche du prix Solo. Autre chose ⇒ `null` (pas su — un ancien prix, par exemple).
export function planDuPrix(prix, { prixPro = '', cleSolo = CLE_PRIX_SOLO } = {}) {
  if (!prix || typeof prix !== 'object') return null;
  const id = String(prix.id || ''), cle = String(prix.lookup_key || '');
  const pro = String(prixPro || '').trim();
  if ((pro && (id === pro || cle === pro)) || cle === CLE_PRIX_PRO) return PLAN_PRO;
  if (cleSolo && cle === cleSolo) return PLAN_SOLO;
  return null;
}

// Le plan d'un ABONNEMENT Stripe (l'objet `subscription`) : un seul article,
// quantité 1. `{ plan, vendeur, vendeurLe, cgv }` ; `plan` vaut `null` quand ce
// n'est pas sûr (plusieurs articles, prix inconnu, Solo aux CGV d'avant).
export function planDeLAbonnement(sub, opts = {}) {
  const vide = { plan: null, vendeur: null, vendeurLe: null, raison: 'illisible', autres: { leboncoin: null, ebay: null, vestiaire: null }, comptesSup: { payes: 0, liste: [], articleId: null } };
  if (!sub || typeof sub !== 'object') return vide;
  const tous = sub.items && Array.isArray(sub.items.data) ? sub.items.data : [];
  // (13 nov., lot 56) Un 2e article au prix `vrm_compte_sup` = les comptes Vinted de
  // plus ; tout autre article de plus ⇒ pas su (comme avant).
  const sups = tous.filter((x) => x && estPrixCompteSup(x.price || x.plan));
  const articles = tous.filter((x) => !sups.includes(x));
  if (articles.length !== 1 || sups.length > 1) return { ...vide, raison: 'articles' };
  const s0 = sups[0] || null;
  const payes = s0 ? (Number.isInteger(s0.quantity) && s0.quantity > 0 ? s0.quantity : (s0.quantity == null ? 1 : 0)) : 0;
  const a = articles[0], p = a && (a.price || a.plan);
  if (!p || (a.quantity != null && a.quantity !== 1)) return { ...vide, raison: 'article' };
  const m = sub.metadata && typeof sub.metadata === 'object' ? sub.metadata : {};
  const vendeur = uidValide(m.vrm_compte_vendeur) ? uidDe(m.vrm_compte_vendeur) : null;
  const vendeurLe = Number.isFinite(Date.parse(m.vrm_compte_vendeur_le || '')) ? String(m.vrm_compte_vendeur_le) : null;
  let plan = planDuPrix(p, opts);
  let raison = plan ? null : 'prix-inconnu';
  // Solo souscrit sous des CGV qui promettaient tous les comptes : jamais bridé.
  if (plan === PLAN_SOLO && !(String(m.cgv_version || '') >= CGV_PLANS_DEPUIS)) { plan = null; raison = 'cgv-anterieures'; }
  // (9 nov., Solo par plateforme) Les comptes vendeurs des autres plateformes, lus des
  // métadonnées que NOUS avons posées ; `null` = pas choisi (ou illisible).
  const autres = {};
  for (const pl of PLATEFORMES_SOLO) {
    const k = META_VENDEUR[pl], id = idCompteVendeur(pl, m[k]);
    autres[pl] = id ? { id, le: Number.isFinite(Date.parse(m[k + '_le'] || '')) ? String(m[k + '_le']) : null } : null;
  }
  // Les comptes de plus : seulement en Solo sûr, avec un compte inclus choisi, et
  // jamais plus que la quantité PAYÉE (les N premiers, dans l'ordre de ses ajouts).
  const liste = plan === PLAN_SOLO && vendeur ? listeComptesSup(m[META_COMPTES_SUP], vendeur).slice(0, payes) : [];
  const comptesSup = { payes, liste, articleId: s0 && s0.id ? String(s0.id) : null, le: Number.isFinite(Date.parse(m[META_COMPTES_SUP + '_le'] || '')) ? String(m[META_COMPTES_SUP + '_le']) : null };
  return { plan, vendeur, vendeurLe, raison, autres, comptesSup, prixId: String(p.id || ''), articleId: String(a.id || '') };
}

// ── (9 nov., soir) SOLO PAR PLATEFORME — Julien : « fais absolument tout ».
// Solo = UN compte vendeur PAR PLATEFORME (un Vinted, un Leboncoin, un eBay, un
// Vestiaire) ; ses autres comptes de la même plateforme sont des comptes
// d'ACHAT. Pro = tous. (Interprétation retenue par défaut, à confirmer par
// Julien : docs/passation/2026-11-09-solo-plateformes.md.)
// L'IDENTITÉ d'un compte est celle que porte la vente (api/_lib/comptes-exclus.js,
// `compteDeVente`) — jamais un pseudo :
//   · Leboncoin : l'identifiant du compte (`8442…` = `lbc-account:8442…`) ;
//   · eBay      : 'principal' ou la clé du compte (16 caractères hexadécimaux) ;
//   · Vestiaire : l'identifiant relevé par l'extension ; « non identifié »
//                 (`-`) n'est JAMAIS un compte vendeur ni un compte écarté.
// Chaque plateforme a SON choix, SA date, SA règle des 30 jours ; un choix
// absent ⇒ tous les comptes de cette plateforme comptent (« pas su »).
export const PLATEFORMES_SOLO = Object.freeze(['leboncoin', 'ebay', 'vestiaire']);
export const NOMS_PLATEFORMES_SOLO = Object.freeze({ vinted: 'Vinted', leboncoin: 'Leboncoin', ebay: 'eBay', vestiaire: 'Vestiaire Collective' });
const AUTRES_LIBRES = Object.freeze({ leboncoin: null, ebay: null, vestiaire: null });
const SUP_VIDE = Object.freeze([]);
// L'identifiant d'un compte vendeur, propre, ou `null` (illisible ⇒ pas su).
export function idCompteVendeur(plateforme, x) {
  const s = String(x == null ? '' : x).trim();
  if (plateforme === 'vinted') return uidValide(s) ? s : null;
  if (plateforme === 'leboncoin') { const id = s.replace(/^lbc-account:/i, ''); return /^[\w-]{1,64}$/.test(id) ? id : null; }
  if (plateforme === 'ebay') return s === 'principal' || /^[0-9a-f]{16}$/.test(s) ? s : null;
  if (plateforme === 'vestiaire') return s !== '-' && /^[\w-]{1,40}$/.test(s) ? s : null;
  return null;
}
// Les clés des métadonnées de SON abonnement Stripe (posées par la route
// `compte-vendeur`, jamais par le navigateur). Vinted garde ses clés d'avant.
export const META_VENDEUR = Object.freeze({
  vinted: 'vrm_compte_vendeur', leboncoin: 'vrm_vendeur_leboncoin', ebay: 'vrm_vendeur_ebay', vestiaire: 'vrm_vendeur_vestiaire',
});

// LA RÈGLE DES VENTES. Entrée : ce que le serveur dit (`plan`, `compteVendeur`,
// `proprietaire`). Sortie : `{ plan, vendeur, bride }`. `bride` n'est vrai QUE
// pour un Solo sûr, avec un compte vendeur CHOISI, hors propriétaire.
export function regleVentes(x) {
  if (!x || typeof x !== 'object') return { plan: null, vendeur: null, bride: false, autres: AUTRES_LIBRES, vendeursSup: SUP_VIDE };
  if (x.proprietaire === true) return { plan: PLAN_PRO, vendeur: null, bride: false, autres: AUTRES_LIBRES, vendeursSup: SUP_VIDE };
  const plan = x.plan === PLAN_PRO || x.plan === PLAN_SOLO ? x.plan : null;
  const cv = x.compteVendeur;
  const brut = cv && typeof cv === 'object' ? cv.uid : cv;
  const vendeur = uidValide(brut) ? uidDe(brut) : null;
  // (9 nov., Solo par plateforme) Le compte vendeur de CHAQUE autre plateforme,
  // choisi par LUI (`comptesVendeurs`, rendu par le serveur). Il ne compte qu'en
  // Solo sûr : Pro, pas su, propriétaire ⇒ aucun (rien n'est bridé).
  const autres = {};
  const cvs = x.comptesVendeurs && typeof x.comptesVendeurs === 'object' ? x.comptesVendeurs : {};
  for (const p of PLATEFORMES_SOLO) {
    const v = cvs[p];
    const id = idCompteVendeur(p, v && typeof v === 'object' ? v.id : v);
    autres[p] = plan === PLAN_SOLO && id ? id : null;
  }
  // (13 nov., lot 56) Les comptes Vinted vendeurs DE PLUS (payés), tels que le
  // SERVEUR les rend (`comptesSup.liste`, déjà bornés à la quantité payée) ou que
  // le webhook les a rangés (`comptes_vendeurs.vinted_sup`). Solo sûr seulement.
  const brutSup = x.comptesSup && typeof x.comptesSup === 'object' ? x.comptesSup.liste : (cvs.vinted_sup != null ? cvs.vinted_sup : null);
  const vendeursSup = plan === PLAN_SOLO && vendeur && brutSup != null ? Object.freeze(listeComptesSup(brutSup, vendeur)) : SUP_VIDE;
  return { plan, vendeur, bride: plan === PLAN_SOLO && !!vendeur, autres: Object.freeze(autres), vendeursSup };
}
// Les comptes Vinted qui VENDENT (le compte inclus + ceux de plus), `[]` = pas bridé.
export const vendeursVinted = (r) => (r && r.bride === true && r.vendeur ? [r.vendeur, ...(Array.isArray(r.vendeursSup) ? r.vendeursSup : [])] : []);

// Une vente (ou une annonce, un colis à envoyer, une offre) de ce compte est-elle
// HORS de l'offre ? Vrai seulement si la règle bride ET que le compte est connu
// ET n'est pas le compte vendeur. Un compte inconnu n'est jamais écarté.
export function venteHorsPlan(regle, uid) {
  if (!regle || regle.bride !== true || !regle.vendeur) return false;
  const u = uidDe(uid);
  return uidValide(u) && u !== regle.vendeur && !(Array.isArray(regle.vendeursSup) && regle.vendeursSup.includes(u));
}

// (9 nov., Solo par plateforme) La vente (ou l'annonce, l'offre) d'un compte
// Leboncoin / eBay / Vestiaire est-elle HORS de l'offre ? `compte` : l'identité
// que la vente porte (`compteDeVente`, api/_lib/comptes-exclus.js). Vrai
// seulement si : Solo sûr, un compte vendeur CHOISI sur CETTE plateforme, le
// compte de la vente est connu et ce n'est pas lui. Compte inconnu, « non
// identifié », pas su, Pro, propriétaire ⇒ jamais écartée.
export function venteAutreHorsPlan(regle, plateforme, compte) {
  if (!regle || regle.plan !== PLAN_SOLO || !regle.autres || !PLATEFORMES_SOLO.includes(plateforme)) return false;
  const choisi = regle.autres[plateforme];
  if (!choisi) return false;
  const c = idCompteVendeur(plateforme, compte);
  return !!c && c !== choisi;
}
// Une plateforme au moins est-elle bridée (Solo sûr, un compte vendeur choisi) ?
export const brideAutres = (r) => !!r && r.plan === PLAN_SOLO && !!r.autres && PLATEFORMES_SOLO.some((p) => !!r.autres[p]);
// Le compte d'une plateforme PROPOSÉ (jamais appliqué) : le plus de ventes lues,
// strictement. `ids` : les comptes de la plateforme ; `comptesDesVentes` : le
// compte de chaque vente lue (`null` si pas lues ⇒ rien de proposé).
export function compteDefautAutre(plateforme, ids, comptesDesVentes) {
  if (!Array.isArray(ids) || !ids.length || !Array.isArray(comptesDesVentes)) return null;
  const siens = new Set(ids.map((x) => idCompteVendeur(plateforme, x)).filter(Boolean));
  const n = new Map();
  for (const c0 of comptesDesVentes) { const c = idCompteVendeur(plateforme, c0); if (c && siens.has(c)) n.set(c, (n.get(c) || 0) + 1); }
  let meilleur = null, k = 0, egal = false;
  for (const [c, x] of n) { if (x > k) { k = x; meilleur = c; egal = false; } else if (x === k) egal = true; }
  return meilleur && !egal ? meilleur : null;
}
// La signature de la règle : change QUAND une plateforme change (l'app se remonte).
export function signatureRegle(r) {
  if (!r || r.plan !== PLAN_SOLO) return 'libre';
  const parts = [];
  if (r.bride && r.vendeur) parts.push(r.vendeur);   // Vinted seul : « solo:7 », comme avant
  if (r.bride && Array.isArray(r.vendeursSup) && r.vendeursSup.length) parts.push('+' + r.vendeursSup.join('+'));
  for (const p of PLATEFORMES_SOLO) if (r.autres && r.autres[p]) parts.push(p + '=' + r.autres[p]);
  return parts.length ? 'solo:' + parts.join(',') : 'libre';
}

// Les comptes Vinted dont les VENTES sont hors de l'offre (pour dire leurs noms).
export function comptesHorsPlan(regle, comptes) {
  if (!regle || !regle.bride) return [];
  return (Array.isArray(comptes) ? comptes : []).filter((c) => c && venteHorsPlan(regle, c.uid != null ? c.uid : c.vinted_user_id));
}

// Le compte PROPOSÉ (jamais appliqué sans son clic) : celui qui a le PLUS de
// ventes lues, strictement. Égalité, aucune vente, ventes pas lues ⇒ `null` :
// rien de pré-coché (on ne devine pas).
export function compteDefaut(comptes, ventes) {
  if (!Array.isArray(comptes) || !comptes.length || !Array.isArray(ventes)) return null;
  const ids = new Set(comptes.map((c) => uidDe(c && (c.uid != null ? c.uid : c.vinted_user_id))).filter(uidValide));
  const n = new Map();
  for (const v of ventes) {
    const u = uidDe(v && v._acc && v._acc.vinted_user_id);
    if (ids.has(u)) n.set(u, (n.get(u) || 0) + 1);
  }
  let meilleur = null, k = 0, egal = false;
  for (const [u, c] of n) { if (c > k) { k = c; meilleur = u; egal = false; } else if (c === k) egal = true; }
  return meilleur && !egal ? meilleur : null;
}

// Le prochain changement permis (ISO) ; `null` = permis maintenant. Premier
// choix (aucune date) : permis. Date illisible ⇒ permis (on ne bloque pas sur un « pas su »).
export function prochainChangement(vendeurLe, maintenant = Date.now()) {
  const t = Date.parse(vendeurLe || '');
  if (!Number.isFinite(t)) return null;
  const fin = t + JOURS_CHANGEMENT_VENDEUR * JOUR_MS;
  return fin > maintenant ? new Date(fin).toISOString() : null;
}

// Les offres, en clair : une phrase par offre, la même dans l'app, la page
// d'accueil et (en substance) les CGV.
export const OFFRES = Object.freeze({
  solo: Object.freeze({ nom: 'Solo', phrase: 'Un compte vendeur par plateforme (un Vinted, un Leboncoin, un eBay, un Vestiaire) — ventes, annonces, colis à envoyer, offres et compta de ce compte — et autant de comptes d’achat que tu veux (leurs achats et leurs retraits).',
    // (13 nov., lot 56) Le supplément, en une ligne (Paramètres, accueil) : la même valeur partout.
    supplement: `1 compte Vinted vendeur inclus · +${prixCompteSupTexte()}/mois par compte de plus` }),
  pro: Object.freeze({ nom: 'Pro', phrase: 'Comptes vendeurs illimités : tous tes comptes vendent, tout entre dans tes totaux.' }),
});
