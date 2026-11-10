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
  const vide = { plan: null, vendeur: null, vendeurLe: null, raison: 'illisible', autres: { leboncoin: null, ebay: null, vestiaire: null }, pro: null, proAncien: false };
  if (!sub || typeof sub !== 'object') return vide;
  const articles = sub.items && Array.isArray(sub.items.data) ? sub.items.data : [];
  if (articles.length !== 1) return { ...vide, raison: 'articles' };
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
  // (10 nov.) Pro = 10 comptes vendeurs au total. Un Pro souscrit sous les CGV d'avant
  // (« les ventes de tous tes comptes ») n'est jamais limité (`proAncien`).
  let pro = null, proAncien = false;
  if (plan === PLAN_PRO) {
    if (String(m.cgv_version || '') >= CGV_PRO_DIX_DEPUIS) {
      const liste = lireMetaPro(m);
      pro = liste ? { liste, le: Number.isFinite(Date.parse(m[META_PRO + '_le'] || '')) ? String(m[META_PRO + '_le']) : null } : null;
    } else proAncien = true;
  }
  return { plan, vendeur, vendeurLe, raison, autres, pro, proAncien, prixId: String(p.id || ''), articleId: String(a.id || '') };
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
  if (!x || typeof x !== 'object') return { plan: null, vendeur: null, bride: false, autres: AUTRES_LIBRES, pro: null };
  if (x.proprietaire === true) return { plan: PLAN_PRO, vendeur: null, bride: false, autres: AUTRES_LIBRES, pro: null };
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
  // (10 nov.) Pro : les 10 comptes vendeurs CHOISIS par lui (`comptesPro.liste` rendu par
  // le serveur, ou `comptesVendeurs.pro` de la ligne `abonnements`). Pas choisi, illisible,
  // plus de 10 ⇒ `null` : tous ses comptes comptent (« pas su » ne bride jamais).
  let pro = null;
  if (plan === PLAN_PRO) {
    const src = x.comptesPro && typeof x.comptesPro === 'object' ? x.comptesPro.liste : cvs.pro;
    const l = listeVendeursPro(src);
    pro = l ? Object.freeze(l) : null;
  }
  return { plan, vendeur, bride: plan === PLAN_SOLO && !!vendeur, autres: Object.freeze(autres), pro };
}

// Une vente (ou une annonce, un colis à envoyer, une offre) de ce compte est-elle
// HORS de l'offre ? Vrai seulement si la règle bride ET que le compte est connu
// ET n'est pas le compte vendeur. Un compte inconnu n'est jamais écarté.
export function venteHorsPlan(regle, uid) {
  if (regle && regle.plan === PLAN_PRO && regle.pro) { const k = cleVendeurPro('vinted', uid); return !!k && !regle.pro.includes(k); }
  if (!regle || regle.bride !== true || !regle.vendeur) return false;
  const u = uidDe(uid);
  return uidValide(u) && u !== regle.vendeur;
}

// (9 nov., Solo par plateforme) La vente (ou l'annonce, l'offre) d'un compte
// Leboncoin / eBay / Vestiaire est-elle HORS de l'offre ? `compte` : l'identité
// que la vente porte (`compteDeVente`, api/_lib/comptes-exclus.js). Vrai
// seulement si : Solo sûr, un compte vendeur CHOISI sur CETTE plateforme, le
// compte de la vente est connu et ce n'est pas lui. Compte inconnu, « non
// identifié », pas su, Pro, propriétaire ⇒ jamais écartée.
export function venteAutreHorsPlan(regle, plateforme, compte) {
  // (10 nov.) Pro : hors offre = un compte CONNU qui n'est pas parmi ses 10 comptes vendeurs.
  if (regle && regle.plan === PLAN_PRO && regle.pro && PLATEFORMES_SOLO.includes(plateforme)) { const k = cleVendeurPro(plateforme, compte); return !!k && !regle.pro.includes(k); }
  if (!regle || regle.plan !== PLAN_SOLO || !regle.autres || !PLATEFORMES_SOLO.includes(plateforme)) return false;
  const choisi = regle.autres[plateforme];
  if (!choisi) return false;
  const c = idCompteVendeur(plateforme, compte);
  return !!c && c !== choisi;
}
// Une plateforme au moins est-elle bridée (Solo sûr, un compte vendeur choisi) ?
// (10 nov.) En Pro avec ses 10 comptes choisis : oui (un compte hors des 10 sort des totaux).
export const brideAutres = (r) => !!r && ((r.plan === PLAN_PRO && !!r.pro) || (r.plan === PLAN_SOLO && !!r.autres && PLATEFORMES_SOLO.some((p) => !!r.autres[p])));
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
  if (r && r.plan === PLAN_PRO && r.pro) return 'pro:' + [...r.pro].sort().join(',');
  if (!r || r.plan !== PLAN_SOLO) return 'libre';
  const parts = [];
  if (r.bride && r.vendeur) parts.push(r.vendeur);   // Vinted seul : « solo:7 », comme avant
  for (const p of PLATEFORMES_SOLO) if (r.autres && r.autres[p]) parts.push(p + '=' + r.autres[p]);
  return parts.length ? 'solo:' + parts.join(',') : 'libre';
}

// Les comptes Vinted dont les VENTES sont hors de l'offre (pour dire leurs noms).
export function comptesHorsPlan(regle, comptes) {
  if (!regle || !(regle.bride || regle.pro)) return [];
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
  solo: Object.freeze({ nom: 'Solo', phrase: 'Un compte vendeur par plateforme (un Vinted, un Leboncoin, un eBay, un Vestiaire) — ventes, annonces, colis à envoyer, offres et compta de ce compte — et autant de comptes d’achat que tu veux (leurs achats et leurs retraits).' }),
  pro: Object.freeze({ nom: 'Pro', phrase: 'Jusqu’à 10 comptes vendeurs, toutes plateformes confondues — leurs ventes entrent dans tes totaux — et autant de comptes d’achat que tu veux.' }),
});

// ══════════════════════════════════════════════════════════════════════════════
// (10 nov.) PRO = 10 COMPTES VENDEURS AU TOTAL — Julien : « Solo = un compte vendeur
// par plateforme : oui, et 19,99 pour 10 comptes vendeurs ».
// ══════════════════════════════════════════════════════════════════════════════
// Lecture retenue : 10 comptes vendeurs AU TOTAL, toutes plateformes confondues
// (Vinted + Leboncoin + eBay + Vestiaire). S'il voulait « 10 par plateforme », la
// règle est ICI seulement (`MAX_VENDEURS_PRO`, `listeVendeursPro`).
//   · Choisis par LUI (feuille « Quels 10 comptes vendent ? ») ; rien n'est deviné.
//   · Pas encore choisis ⇒ TOUS ses comptes comptent (« pas su » ne bride jamais) ;
//     l'app ne demande le choix qu'au-delà de 10 comptes.
//   · Choisis ⇒ un compte hors des 10 est un compte d'ACHAT : ses ventes sortent
//     des listes et des totaux (aperçu, rien supprimé), ses colis restent dans Colis.
//   · Ajouter un compte dans une place libre : toujours permis. En RETIRER un :
//     une fois tous les 30 jours (comme le compte vendeur de Solo).
//   · Un Pro souscrit avant les CGV du 10 nov. garde « tous tes comptes ».
// L'IDENTITÉ d'un compte est `plateforme:id` (`idCompteVendeur`) — jamais un pseudo.
export const MAX_VENDEURS_PRO = 10;
export const CGV_PRO_DIX_DEPUIS = '2026-11-10';
export const PLATEFORMES_PRO = Object.freeze(['vinted', 'leboncoin', 'ebay', 'vestiaire']);
// Les métadonnées de SON abonnement Stripe : `vrm_pro_vendeurs` (+ `_2` si la liste
// dépasse 500 caractères, la limite de Stripe), `vrm_pro_vendeurs_le`.
export const META_PRO = 'vrm_pro_vendeurs';
const ABREGE_PRO = Object.freeze({ vinted: 'v', leboncoin: 'l', ebay: 'e', vestiaire: 'c' });
const PLATEFORME_ABREGEE = Object.freeze({ v: 'vinted', l: 'leboncoin', e: 'ebay', c: 'vestiaire' });
// L'identité d'un compte vendeur Pro, propre (`vinted:1007`, `leboncoin:8442001`…) ou `null`.
export function cleVendeurPro(plateforme, id) {
  if (!PLATEFORMES_PRO.includes(plateforme)) return null;
  const i = idCompteVendeur(plateforme, id);
  return i ? plateforme + ':' + i : null;
}
export const decouperCleVendeurPro = (k) => { const s = String(k || ''), i = s.indexOf(':'); return i > 0 ? { plateforme: s.slice(0, i), id: s.slice(i + 1) } : null; };
// La liste choisie, relue sans confiance : `['vinted:1007', …]` ou `[{ plateforme, id }]`.
// Une entrée illisible, une liste vide ou de plus de 10 ⇒ `null` (pas su : rien bridé).
export function listeVendeursPro(l) {
  if (!Array.isArray(l)) return null;
  const out = [];
  for (const x of l) {
    let k = null;
    if (typeof x === 'string') { const d = decouperCleVendeurPro(x); k = d && cleVendeurPro(d.plateforme, d.id); }
    else if (x && typeof x === 'object') k = cleVendeurPro(x.plateforme, x.id);
    if (!k) return null;
    if (!out.includes(k)) out.push(k);
  }
  return out.length && out.length <= MAX_VENDEURS_PRO ? out : null;
}
// La liste → les métadonnées (morceaux de 500 caractères au plus, une entrée jamais coupée).
export function metaVendeursPro(liste) {
  const l = listeVendeursPro(liste);
  if (!l) return null;
  const morceaux = [''];
  for (const k of l) {
    const d = decouperCleVendeurPro(k), e = ABREGE_PRO[d.plateforme] + ':' + d.id;
    const i = morceaux.length - 1;
    if (morceaux[i] && morceaux[i].length + 1 + e.length > 500) morceaux.push(e); else morceaux[i] = morceaux[i] ? morceaux[i] + ',' + e : e;
  }
  if (morceaux.length > 2) return null;
  return { [META_PRO]: morceaux[0], [META_PRO + '_2']: morceaux[1] || '' };
}
// Les métadonnées → la liste (`null` = pas choisie ou illisible).
export function lireMetaPro(m) {
  if (!m || typeof m !== 'object') return null;
  const brut = [m[META_PRO], m[META_PRO + '_2']].map((x) => String(x == null ? '' : x).trim()).filter(Boolean).join(',');
  if (!brut) return null;
  return listeVendeursPro(brut.split(',').map((e) => { const d = decouperCleVendeurPro(e); return d && PLATEFORME_ABREGEE[d.plateforme] ? PLATEFORME_ABREGEE[d.plateforme] + ':' + d.id : '?'; }));
}
// Pro limité (CGV du 10 nov.) : ses comptes, à choisir ? `tous` : les identités de
// TOUS ses comptes (toutes plateformes) ; `liste` : ses 10 choisis (ou `null`).
// Rend `{ aChoisir, hors, places }` — jamais un choix fait à sa place.
export function etatVendeursPro(tous, liste) {
  const ids = [...new Set((Array.isArray(tous) ? tous : []).filter(Boolean))];
  const l = listeVendeursPro(liste);
  if (!l) return { aChoisir: ids.length > MAX_VENDEURS_PRO, hors: [], places: MAX_VENDEURS_PRO };
  const hors = ids.filter((k) => !l.includes(k));
  const places = MAX_VENDEURS_PRO - l.length;
  return { aChoisir: hors.length > 0 && places > 0, hors, places };
}
