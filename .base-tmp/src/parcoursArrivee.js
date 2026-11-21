// ── LE PARCOURS D'ARRIVÉE (11 nov. ; trois étapes le 13 nov., lot 46) ───────
// Julien, 11 nov. : un NOUVEAU vendeur démarre en 10 minutes, « un vrai
// accompagnement ». (13 nov., lot 46) Le démarrage guidé tient en TROIS étapes,
// une à la fois, dans l'ordre où elles servent :
//   1. compte    — la session de CE compte VRM (écrans existants) ;
//   2. extension — installée ET connectée à CE compte VRM (le pont dit
//                  `connectee`), ou un compte Vinted déjà rangé dans SA base
//                  (seule son extension en écrit) ;
//   3. vinted    — Vinted ouvert une fois : un compte relié ET une première
//                  lecture rangée de CE compte — ses ventes (`harvest_{uid}_orders_*`),
//                  sinon son dressing (`harvest_{uid}_listings`) ; compteurs
//                  `nItems`, des scalaires. ⚠️ Le dressing compte aussi : un compte
//                  sans AUCUNE vente n'a jamais de ligne de ventes (l'extension ne
//                  range pas une liste vide, background.js `plein`) — sans lui, le
//                  guide ne finirait jamais pour un vendeur qui débute.
// « Ma configuration » s'ouvre seule avant (src/configurationDepart.js, sa carte
// « Reprendre » si elle est mise de côté) et les e-mails se relient depuis l'écran
// E-mails : ce ne sont plus des étapes comptées.
// Chaque étape se coche SEULE sur une preuve lue (jamais « j'ai fini » à cocher).
// Trois états partout : `undefined` en cours · `null` pas su · valeur lue.
// « Pas su » n'est jamais « fait ». Une étape bloquée dit le geste exact
// (`ligneEtape`). Les trois faites, la carte disparaît ; un vendeur déjà installé
// (un compte Vinted rangé sans avoir jamais ouvert le guide) ne la voit jamais.
// La position (étape montrée, écran ouvert, fin vue) est rangée dans la ligne
// `main` (`vrm_parcours`, synchronisée) : on reprend là où on s'est arrêté, sur
// n'importe quel appareil. « Plus tard » : `vrm_parcours_plus_tard` (7 jours).
// JS pur, sans React : `scripts/audit-parcours-arrivee.cjs` l'exécute.

import { tr } from './i18n/index.js';

export const CLE_PARCOURS = 'vrm_parcours';
export const CLE_PARCOURS_PLUS_TARD = 'vrm_parcours_plus_tard';
export const JOURS_REPORT = 7;

export const ETAPES_PARCOURS = [
  { cle: 'compte', titre: 'Ton compte VRM', court: 'Compte', pourquoi: 'Tout ce que VRM range est à toi seul.' },
  { cle: 'extension', titre: 'Installe l’extension', court: 'Extension', pourquoi: 'Elle lit tes ventes et tes colis, depuis ton navigateur.' },
  { cle: 'vinted', titre: 'Ouvre Vinted une fois', court: 'Vinted', geste: 'Ouvrir vinted.fr', pourquoi: 'Connecté à ton compte, l’extension lit tes ventes.' },
];
// ── (14 nov., accueil des nouveaux, n° 135) UN PARCOURS PAR PLATEFORME ─────────
// Un vendeur qui ne vend PAS sur Vinted (« Où vends-tu ? » de Ma configuration,
// `vrm_plateformes_affichees`) a ses propres étapes — seulement ce que l'extension
// d'aujourd'hui sait faire (EXT_CAPACITES) :
//   · Leboncoin : compte · extension · « Ouvre Mes annonces sur leboncoin.fr » —
//     preuve : une ligne rangée par l'extension (`lbc_listings` ou `lbc_ventes`) ;
//     `lbc_accounts` seul = compte vu, lecture en cours (`lbcclair`, 5.335) ;
//   · Vestiaire : compte · extension · « Ouvre tes annonces sur vestiairecollective.com »
//     — preuve : `vc_listings` ou `vc_ventes` ; `vc_session` seul = compte vu
//     (`vcsession` 5.295, `vcfiche` 5.296) ;
//   · eBay : compte · « Relie ton compte eBay » — eBay passe par sa connexion
//     officielle (Paramètres → Comptes eBay), JAMAIS par l'extension : aucune étape
//     d'extension ne lui est demandée. Preuve : un compte RELIÉ au registre
//     (`lireComptesEbay`, le compte « implicite » ne prouve rien).
// Vinted choisi (ou rien choisi) ⇒ les trois étapes d'avant, inchangées. Plusieurs
// sites de l'extension : la 3e étape est faite dès que l'UN d'eux est lu.
// Les lectures : `select=id` (aucune donnée lue), comme la sonde des sites de la coque.
export const SITES_EXTENSION = Object.freeze(['leboncoin', 'vestiaire']);
export const LIGNES_SITE_LUES = Object.freeze({ leboncoin: ['lbc_listings', 'lbc_ventes'], vestiaire: ['vc_listings', 'vc_ventes'] });
export const LIGNES_SITE_VUES = Object.freeze({ leboncoin: ['lbc_accounts'], vestiaire: ['vc_session'] });
export const REQUETE_SITES_PARCOURS = `id=in.(${[...LIGNES_SITE_LUES.leboncoin, ...LIGNES_SITE_VUES.leboncoin, ...LIGNES_SITE_LUES.vestiaire, ...LIGNES_SITE_VUES.vestiaire].join(',')})&select=id`;
export const LIENS_SITE = Object.freeze({ leboncoin: 'https://www.leboncoin.fr/compte/part/mes-annonces', vestiaire: 'https://www.vestiairecollective.com/' });
// La route : `reglage` = `lirePlateformes(vrm_plateformes_affichees)` (ou null : rien choisi).
export function routeParcours(reglage) {
  const sites = reglage && Array.isArray(reglage.sites) ? reglage.sites : null;
  if (!sites || !sites.length || sites.includes('vinted')) return { cle: 'vinted', sites: ['vinted'] };
  const ext = sites.filter((s) => SITES_EXTENSION.includes(s));
  if (ext.length) return { cle: ext[0], sites: ext };
  if (sites.includes('ebay')) return { cle: 'ebay', sites: ['ebay'] };
  return { cle: 'vinted', sites: ['vinted'] };
}
const NOM_SITE = { leboncoin: 'Leboncoin', vestiaire: 'Vestiaire', ebay: 'eBay' };
// Les étapes d'une route (textes dans la langue, à l'appel).
export function etapesRoute(route) {
  const r = route && route.cle ? route : { cle: 'vinted' };
  if (r.cle === 'vinted') return ETAPES_PARCOURS;
  const compte = ETAPES_PARCOURS[0];
  if (r.cle === 'ebay') return [compte, { cle: 'ebay', titre: tr('nouveaux.parcours.ebay.titre'), court: 'eBay', geste: tr('nouveaux.parcours.ebay.geste'), pourquoi: tr('nouveaux.parcours.ebay.pourquoi') }];
  const extension = { ...ETAPES_PARCOURS[1], pourquoi: tr('nouveaux.parcours.extension.pourquoi', { site: NOM_SITE[r.cle] }) };
  const k = r.cle === 'leboncoin' ? 'lbc' : 'vc';
  return [compte, extension, { cle: r.cle, titre: tr(`nouveaux.parcours.${k}.titre`), court: NOM_SITE[r.cle], geste: tr(`nouveaux.parcours.${k}.geste`), pourquoi: tr(`nouveaux.parcours.${k}.pourquoi`) }];
}
// Toutes les clés d'étape possibles (une position rangée vaut sur n'importe quelle route).
const CLES_TOUTES = ['compte', 'extension', 'vinted', 'leboncoin', 'vestiaire', 'ebay'];
// Les lignes des sites (`select=id`) : `undefined` en cours · `null` pas su · tableau lu.
export function preuveSite(lignes, sites) {
  if (lignes === undefined) return { etat: 'encours' };
  if (!Array.isArray(lignes)) return { etat: 'passu' };
  const ids = new Set(lignes.map((l) => String((l && l.id) || '')));
  const lus = (sites || []).filter((s) => (LIGNES_SITE_LUES[s] || []).some((k) => ids.has(k)));
  if (lus.length) return { etat: 'fait', sitesLus: lus };
  if ((sites || []).some((s) => (LIGNES_SITE_VUES[s] || []).some((k) => ids.has(k)))) return { etat: 'attente', detail: 'lecture' };
  return { etat: 'afaire' };
}
// Les lignes d'un site rangées par l'extension prouvent qu'elle est installée et reliée
// à CE compte (seule elle les écrit) — comme un compte Vinted rangé.
export function lignesDuSite(lignes, sites) {
  if (!Array.isArray(lignes)) return lignes;
  const ok = new Set((sites || []).flatMap((s) => [...(LIGNES_SITE_LUES[s] || []), ...(LIGNES_SITE_VUES[s] || [])]));
  return lignes.filter((l) => ok.has(String((l && l.id) || '')));
}
// Le registre eBay (`lireComptesEbay`) : `undefined` en cours · `null` pas su · tableau.
export function preuveEbay(comptes) {
  if (comptes === undefined) return { etat: 'encours' };
  if (!Array.isArray(comptes)) return { etat: 'passu' };
  return comptes.some((c) => c && !c.implicite) ? { etat: 'fait' } : { etat: 'afaire' };
}
const CLES = CLES_TOUTES;
const ETATS = new Set(['fait', 'afaire', 'attente', 'encours', 'passu']);

// ── LES PREUVES ─────────────────────────────────────────────────────────────
// Chacune rend { etat, detail? , n? } — etat ∈ fait · afaire · attente · encours · passu.
export function preuveCompte(uid) {
  if (uid === undefined) return { etat: 'encours' };
  return uid && String(uid).trim() ? { etat: 'fait' } : { etat: 'passu' };
}
// `pont` : 'absente' · 'demande' · 'muette' · 'pasconnectee' · 'autrecompte' · 'connectee'
// (`useEtapePont`). Une extension qui répond mais range ailleurs n'est PAS faite.
export function preuveExtension(pont, comptes) {
  if (Array.isArray(comptes) && comptes.length > 0) return { etat: 'fait' };
  if (pont === 'connectee') return { etat: 'fait' };
  if (pont === 'demande' || pont === undefined) return { etat: 'encours' };
  if (pont === 'muette') return { etat: 'passu', detail: 'muette' };
  if (pont === 'pasconnectee') return { etat: 'afaire', detail: 'pasconnectee' };
  if (pont === 'autrecompte') return { etat: 'afaire', detail: 'autrecompte' };
  return { etat: 'afaire', detail: 'absente' };
}
// Le nombre lu dans une ligne `{ id, n }` (`n` = `data->>nItems`) ; illisible ⇒ NaN.
const nombreLu = (l) => (l && l.n != null && l.n !== '' && Number.isFinite(Number(l.n)) && Number(l.n) >= 0 ? Number(l.n) : NaN);
const uidDe = (id, suffixe) => { const m = new RegExp(`^harvest_(\\d+)_${suffixe}$`).exec(String(id || '')); return m ? m[1] : null; };
// La somme des compteurs lus des lignes `suffixe` de SES comptes : `undefined` aucune
// ligne · `null` des lignes au compteur illisible · un nombre. Un autre compte ne compte pas.
function somme(lignes, suffixe, uids) {
  let n = 0, vu = false, illisible = false;
  for (const l of lignes) {
    if (!uids.has(uidDe(l && l.id, suffixe))) continue;
    const v = nombreLu(l);
    if (Number.isFinite(v)) { n += v; vu = true; } else illisible = true;
  }
  return vu ? n : illisible ? null : undefined;
}
// `comptes` : la liste Vinted lue ; `annonces` : `harvest_*_listings` projetées `{ id, n }` ;
// `commandes` : `harvest_*_orders_*` projetées `{ id, n }`. Une lecture rangée d'un compte
// relié suffit : ses ventes, ses achats ou son dressing.
export function preuveVinted(comptes, annonces, commandes) {
  if (comptes === undefined) return { etat: 'encours' };
  if (!Array.isArray(comptes)) return { etat: 'passu' };
  if (!comptes.length) return { etat: 'afaire' };
  const uids = new Set(comptes.map((c) => String((c && c.vinted_user_id) || '')).filter(Boolean));
  const n = Array.isArray(annonces) ? somme(annonces, 'listings', uids) : annonces;
  const ventes = Array.isArray(commandes) ? somme(commandes, 'orders_sold', uids) : commandes;
  const achats = Array.isArray(commandes) ? somme(commandes, 'orders_purchased', uids) : commandes;
  const lu = (v) => typeof v === 'number';
  if (lu(n) || lu(ventes) || lu(achats)) return { etat: 'fait', ...(lu(n) ? { n } : {}), ...(lu(ventes) ? { ventes } : {}), ...(lu(achats) ? { achats } : {}) };
  if (n === null || ventes === null || achats === null) return { etat: 'passu' };
  if (annonces === undefined || commandes === undefined) return { etat: 'encours' };
  return { etat: 'attente', detail: 'lecture' };
}

// ── « PLUS TARD » ───────────────────────────────────────────────────────────
export function reportee(plusTard, cle, maintenant = Date.now()) {
  const t = Date.parse((plusTard && typeof plusTard === 'object' && plusTard[cle]) || '');
  return Number.isFinite(t) && t <= maintenant + 60000 && maintenant - t < JOURS_REPORT * 86400000;
}
// Relier Vinted suppose l'extension : l'extension de côté met Vinted de côté.
const reporteeParcours = (plusTard, cle, m) => reportee(plusTard, cle, m) || (SUIT_EXTENSION.includes(cle) && reportee(plusTard, 'extension', m));
// Lire un site suppose l'extension (Vinted, Leboncoin, Vestiaire — pas eBay).
const SUIT_EXTENSION = ['vinted', 'leboncoin', 'vestiaire'];

// ── LA POSITION RANGÉE (`vrm_parcours`) ─────────────────────────────────────
// { v: 1, etape, ouvert, fini, at } — tout champ inconnu est ignoré (une étape
// d'avant le 13 nov. — configuration, e-mails, première vente — ne vaut aucune).
export function lireParcours(brut) {
  const o = brut && typeof brut === 'object' && !Array.isArray(brut) ? brut : null;
  if (!o) return null;
  return {
    etape: CLES.includes(o.etape) ? o.etape : null,
    ouvert: o.ouvert === true,
    fini: typeof o.fini === 'string' && o.fini ? o.fini : null,
    at: typeof o.at === 'string' ? o.at : null,
  };
}
// Ce qu'il faut écrire pour un changement — `null` si rien ne change (on n'écrit pas pour rien).
export function ecritureParcours(brut, changement = {}, at = new Date().toISOString()) {
  const avant = lireParcours(brut) || { etape: null, ouvert: false, fini: null };
  const apres = { ...avant, ...changement };
  if (avant.etape === apres.etape && avant.ouvert === apres.ouvert && avant.fini === apres.fini && lireParcours(brut)) return null;
  return { v: 1, etape: apres.etape || null, ouvert: apres.ouvert === true, fini: apres.fini || null, at };
}

// ── L'ÉTAT DU PARCOURS ──────────────────────────────────────────────────────
// `preuves` : { [cle]: { etat, … } }. Rend les étapes avec leur état, `faites`,
// `courante` (la première pas faite ni mise de côté ; `null` si tout ce qui reste
// est de côté), et `fini` (toutes faites — sur des preuves LUES).
export function etatParcours(preuves = {}, { plusTard = null, maintenant = Date.now(), route = null } = {}) {
  const etapes = etapesRoute(route).map((e) => {
    const p = preuves[e.cle] && typeof preuves[e.cle] === 'object' ? preuves[e.cle] : {};
    const etat = ETATS.has(p.etat) ? p.etat : 'passu';
    return { ...e, ...p, etat, reportee: etat !== 'fait' && reporteeParcours(plusTard, e.cle, maintenant) };
  });
  const faites = etapes.filter((e) => e.etat === 'fait').length;
  const courante = (etapes.find((e) => e.etat !== 'fait' && !e.reportee) || {}).cle || null;
  return { etapes, faites, total: etapes.length, courante, fini: faites === etapes.length, route: (route && route.cle) || 'vinted' };
}
// L'étape que l'écran plein montre : celle où il s'est arrêté (`voulue`) si elle
// n'est pas faite, sinon la courante, sinon la première pas faite (même de côté) ;
// 'pret' quand tout est fait.
export function etapeAMontrer(etat, voulue) {
  if (!etat) return null;
  if (etat.fini) return 'pret';
  const e = etat.etapes.find((x) => x.cle === voulue);
  if (e && e.etat !== 'fait') return e.cle;
  if (etat.courante) return etat.courante;
  return (etat.etapes.find((x) => x.etat !== 'fait') || {}).cle || 'pret';
}
// Après « Plus tard » sur `cle` : la suivante à faire, ni faite ni de côté ; `null` ⇒ on ferme.
export function suivanteApres(etat, cle, plusTard = null, maintenant = Date.now()) {
  if (!etat) return null;
  const i = etat.etapes.findIndex((x) => x.cle === cle);
  const reste = etat.etapes.slice(i + 1).concat(etat.etapes.slice(0, Math.max(0, i)));
  const n = reste.find((x) => x.etat !== 'fait' && x.cle !== cle && !reporteeParcours(plusTard, x.cle, maintenant) && !(cle === 'extension' && SUIT_EXTENSION.includes(x.cle)));
  return n ? n.cle : null;
}
// La carte de Ma journée : 'cachee' · 'etape' (une étape à faire) · 'reprendre'
// (tout ce qui reste est de côté). (13 nov., lot 46) Les trois faites ⇒ elle
// disparaît (« C'est prêt » ne se dit que dans l'écran plein, devant lui).
// `comptes` : la liste Vinted de la coque. Un parcours JAMAIS ouvert (aucune
// position rangée) ne s'affiche qu'à un compte SANS compte Vinted — un vendeur
// installé n'est jamais interrompu ; liste pas lue (pas su) ⇒ rien non plus.
export function carteParcours(etat, parcours, { masque = false, exemple = false, comptes } = {}) {
  if (!etat || exemple) return 'cachee';
  const p = lireParcours(parcours);
  if (p && p.fini) return 'cachee';
  if (etat.fini) return 'cachee';
  if (!p && !(Array.isArray(comptes) && comptes.length === 0)) return 'cachee';
  if (masque) return 'cachee';
  return etat.courante ? 'etape' : 'reprendre';
}
// La phrase de réussite d'une étape (le chiffre vient de la preuve, jamais inventé).
export function reussite(e) {
  if (!e || e.etat !== 'fait') return '';
  if (e.cle === 'vinted') {
    const v = e.ventes, n = e.n;
    if (typeof v === 'number' && v > 0) return v === 1 ? '1 vente lue' : `${v} ventes lues`;
    if (typeof n === 'number') return n === 1 ? '1 annonce lue' : n === 0 ? 'Dressing lu · aucune annonce en ligne' : `${n} annonces lues`;
    if (typeof v === 'number') return 'Ventes lues · aucune pour l’instant';
    return typeof e.achats === 'number' ? (e.achats === 1 ? '1 achat lu' : `${e.achats} achats lus`) : 'Compte relié';
  }
  if (e.cle === 'extension') return 'Connectée à ton compte';
  if (e.cle === 'leboncoin' || e.cle === 'vestiaire') {
    const lus = Array.isArray(e.sitesLus) && e.sitesLus.length ? e.sitesLus : [e.cle];
    return lus.map((s) => tr(s === 'leboncoin' ? 'nouveaux.parcours.lbc.ok' : 'nouveaux.parcours.vc.ok')).join(' · ');
  }
  if (e.cle === 'ebay') return tr('nouveaux.parcours.ebay.ok');
  return 'Créé';
}
// Ce qu'une étape PAS faite dit, en une ligne (≤ 12 mots) : le geste exact quand elle
// est bloquée. `ou` : « dans Chrome » (le navigateur d'ici, `NAV.dansNu`), ou « sur ton
// ordinateur » sur un téléphone sans extension. '' ⇒ rien à ajouter.
export function ligneEtape(e, { ou = 'dans ton navigateur' } = {}) {
  if (!e || e.etat === 'fait') return '';
  if (e.etat === 'encours') return 'Je vérifie…';
  if (e.etat === 'passu') return e.detail === 'muette' ? 'L’extension ne répond pas. Recharge la page.' : 'Pas pu vérifier.';
  if (e.cle === 'extension') {
    if (e.detail === 'pasconnectee') return 'Installée. Connecte-la à ce compte VRM.';
    if (e.detail === 'autrecompte') return 'Reliée à un autre compte VRM. Reconnecte-la ici.';
    return `Télécharge-la, puis installe-la ${ou}.`;
  }
  if (e.cle === 'vinted') return e.etat === 'attente' ? 'Lecture de tes ventes…' : `Ouvre vinted.fr ${ou}, connecté à ton compte.`;
  if (e.cle === 'leboncoin') return e.etat === 'attente' ? tr('nouveaux.parcours.attente') : tr('nouveaux.parcours.lbc.ligne', { ou });
  if (e.cle === 'vestiaire') return e.etat === 'attente' ? tr('nouveaux.parcours.attente') : tr('nouveaux.parcours.vc.ligne', { ou });
  if (e.cle === 'ebay') return tr('nouveaux.parcours.ebay.ligne');
  return '';
}
