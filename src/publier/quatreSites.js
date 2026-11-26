// ════════════════════════════════════════════════════════════════════════════
//  « 1 PAIRE → 4 SITES » — LA FEUILLE « METTRE AUSSI SUR… » (24 nov. 2026, choix de Julien)
// ════════════════════════════════════════════════════════════════════════════
// « Depuis une annonce Vinted, créer en UN geste les annonces Leboncoin, Vestiaire Collective et eBay
// (photos, titre, taille, prix, N°). Quand elle se vend quelque part, VRM propose de la retirer
// ailleurs. Plus de visibilité, zéro double saisie. »
//
// Ce module PUR (aucune lecture, aucune écriture, aucun réseau) ne refait AUCUN moteur. Il dit :
//   1. `formeDepuisVinted`  : LA fiche partagée, remplie par l'annonce Vinted LUE (par son identifiant) ;
//   2. `dispoSite`          : pour chaque site, peut-on y créer l'annonce — sinon POURQUOI et quel geste ;
//   3. `envoiSite`          : EXACTEMENT les champs que la voie de CE site reçoit (rien de plus) ;
//   4. `planQuatre`         : la file, un site à la fois, seulement les cases cochées ET possibles ;
//   5. `executerQuatre`     : le déroulé — le prix Vinted RELU avant chaque envoi, l'arrêt d'un site dit ;
//   6. `questionRetrait`    : « Vendue sur X — retirer de Y et Z ? » sur le plan PROUVÉ de « retirer ailleurs ».
//
// LES VOIES (toutes existantes, avec leurs gardes — rien n'est réinventé ici) :
//   · Leboncoin et Vestiaire : le PANNEAU de l'extension, « Publier aussi sur… » (5.424, `publierAussiLancer`)
//     — décision de Julien du 20 nov. : « toute action de plateforme se fait dans l'extension ». L'app ouvre le
//     panneau sur vinted.fr, l'annonce et les sites PRÉ-CHOISIS (lien `action=aussi`, 5.451) ; l'extension relit
//     tout (source par identifiant, compte de l'onglet, plafond, un dépôt à la fois, relecture du formulaire) et
//     ne publie qu'après SA confirmation là-bas. Le N° part à la fin de la description (« Réf. VRM-{N°} »,
//     `envoiPour` de l'agent) : c'est l'identité qui relie l'annonce Leboncoin (#1354) et Vestiaire.
//   · eBay : un BROUILLON par l'API officielle (`preparerBrouillonPartout`, src/ecrans/Ebay.jsx) — SKU
//     `VRM-{N°}`, aucun champ de port (§2.8 : l'acheteur paie le bordereau, livraison gérée par eBay,
//     jamais « livraison gratuite », jamais une étiquette achetée) ; la mise en ligne reste SA confirmation
//     dans les brouillons eBay (frais annoncés, prix relu chez eBay : `prixLu` / `prixVu`).
//
// ⚠️ IDENTITÉ (§5) : rien ne part sans N° ; « déjà sur ce site » se juge par identité (`enLigneSur`, SKU,
//    référence, N° écrit), JAMAIS par un titre — un titre identique ne dit rien.
// ⚠️ PAS SU NE VAUT PAS NON : un compte pas lu, une liste pas lue ⇒ la case est grisée et le dit.
// ⚠️ RETIRER AILLEURS : seulement une vente PROUVÉE (le plan de src/retirerAilleurs.js), seulement SON toucher
//    confirmé (le geste existant `gesteRA`). Jamais automatique.
// Exécuté par scripts/audit-quatre-sites.cjs et le banc scripts/bancs/quatre-sites.cjs.
import { prixAussi, plancherAussi, PCT_AUSSI } from './aussi.js';
import { lireNumeroTexte, numerosMarques, cleNumero } from '../numeroEcrit.js';

const str = (v) => String(v == null ? '' : v).trim();
const arr = (a) => (Array.isArray(a) ? a : []);
const NUM_OK = /^[A-Z]{0,3}\d{1,6}$/;

export const SITES_QUATRE = Object.freeze(['leboncoin', 'vestiaire', 'ebay']);
export const NOM_QUATRE = Object.freeze({ vinted: 'Vinted', leboncoin: 'Leboncoin', vestiaire: 'Vestiaire Collective', ebay: 'eBay' });
export const TITRE_MAX_QUATRE = Object.freeze({ leboncoin: 50, vestiaire: 80, ebay: 80 });
// Ce que chaque voie attache au plus (Leboncoin et Vestiaire : l'agent, `PHOTOS_MAX` 10 ; eBay : 24 par annonce).
export const PHOTOS_MAX_QUATRE = Object.freeze({ leboncoin: 10, vestiaire: 10, ebay: 24 });
export { PCT_AUSSI };

// ── LES CHAMPS DE CHAQUE SITE — EXACTEMENT CEUX-LÀ ─────────────────────────
// Leboncoin et Vestiaire : le prix est un « +N % » de la voie de l'extension (le même, ou +5/10/15/20 %, à l'euro
// supérieur, jamais sous le plancher) ; le N° est à la fin de la description. eBay : le SKU porte le N°, le prix
// est libre (au centime), et AUCUN champ de livraison, de port ou d'étiquette n'existe (§2.8).
export const CHAMPS_QUATRE = Object.freeze({
  leboncoin: Object.freeze(['site', 'annonceVinted', 'numero', 'titre', 'description', 'pct', 'prix', 'taille', 'etat', 'marque', 'photos']),
  vestiaire: Object.freeze(['site', 'annonceVinted', 'numero', 'reference', 'titre', 'description', 'pct', 'prix', 'taille', 'etat', 'marque', 'photos']),
  ebay: Object.freeze(['site', 'annonceVinted', 'numero', 'sku', 'titre', 'description', 'prix', 'taille', 'etat', 'marque', 'photos']),
});
// Ce qui ne part JAMAIS vers eBay (l'audit le cherche dans l'envoi, clés ET valeurs) : §2.8.
export const INTERDIT_EBAY = /livraison|shipping|port\b|fraisPort|freeShipping|gratuit|etiquette|label|bordereau/i;

export const skuQuatre = (num) => { const k = cleNumero(num); return k && NUM_OK.test(k) ? 'VRM-' + k : ''; };
export const refQuatre = (num) => skuQuatre(num) ? 'Réf. ' + skuQuatre(num) : '';

// ── LE N° À LA FIN DE LA DESCRIPTION (règle #1354, src/numeroEcrit.js) ─────
// La description qui part sur Leboncoin finit par « N°{num} » : relue par `lireNumeroTexte` (la règle qui relie
// l'annonce Leboncoin à sa paire), elle doit rendre CE N° et lui seul. Une description qui porte déjà un AUTRE N°
// ⇒ refus (deux numéros = rien ne se relie), jamais « corrigée » en douce.
// Rend { ok, texte } · { ok:false, code: 'sans-numero' | 'autre-numero', autres }.
export function descriptionAvecNumero(desc, num) {
  const k = cleNumero(num);
  if (!k || !NUM_OK.test(k)) return { ok: false, code: 'sans-numero' };
  const t = String(desc == null ? '' : desc).replace(/\s+$/, '');
  const autres = [...new Set(numerosMarques(t).map((o) => o.cle))].filter((c) => c !== k);
  if (autres.length) return { ok: false, code: 'autre-numero', autres };
  const lu = lireNumeroTexte(t, 'description');
  const texte = lu.etat === 'lu' && lu.cle === k ? t : (t ? t + '\n\n' : '') + 'N°' + k;
  const relu = lireNumeroTexte(texte, 'description');
  if (!(relu.etat === 'lu' && relu.cle === k)) return { ok: false, code: 'autre-numero', autres: relu.cles || [] };
  return { ok: true, texte };
}
// Vestiaire : la référence de la voie existante (« Réf. VRM-{N°} », celle que l'extension relit sur Vestiaire).
export function descriptionAvecReference(desc, num) {
  const ref = refQuatre(num);
  if (!ref) return { ok: false, code: 'sans-numero' };
  const t = String(desc == null ? '' : desc).replace(/\s+$/, '');
  const k = cleNumero(num);
  const autres = [...new Set(numerosMarques(t).map((o) => o.cle))].filter((c) => c !== k);
  if (autres.length) return { ok: false, code: 'autre-numero', autres };
  return { ok: true, texte: t.includes(ref) ? t : (t ? t + '\n\n' : '') + ref };
}

// ── 1. LA FICHE PARTAGÉE ───────────────────────────────────────────────────
// p : la paire telle que la source partagée la donne (`useEbayPaires`) — { id (annonce Vinted), num, title, desc,
// taille, etat, marque, photos, prix, uid }. f : la fiche VRM ({ prixMini }) ; achat : prix d'achat connu ou null.
// Rend { ok, forme } · { ok:false, code } — une annonce sans identifiant ou sans N° ne donne RIEN (§5).
export function formeDepuisVinted(p, { prixMini = null, achat = null } = {}) {
  const x = p && typeof p === 'object' ? p : null;
  if (!x) return { ok: false, code: 'annonce' };
  const id = str(x.id);
  if (!/^\d{4,15}$/.test(id)) return { ok: false, code: 'annonce' };
  const numero = cleNumero(x.num);
  if (!numero || !NUM_OK.test(numero)) return { ok: false, code: 'sans-numero' };
  const prix = Number(x.prix && typeof x.prix === 'object' ? x.prix.amount : x.prix);
  return { ok: true, forme: {
    source: { id, uid: str(x.uid), numero, prix: Number.isFinite(prix) && prix > 0 ? Math.round(prix * 100) / 100 : null },
    titre: str(x.title), description: String(x.desc == null ? '' : x.desc).trim(), taille: str(x.taille), etat: str(x.etat), marque: str(x.marque),
    photos: arr(x.photos).map(str).filter((u) => /^https?:\/\//.test(u)),
    plancher: plancherAussi(prixMini, achat),
    prix: { leboncoin: { pct: 0 }, vestiaire: { pct: 0 }, ebay: { valeur: Number.isFinite(prix) && prix > 0 ? Math.round(prix * 100) / 100 : null } },
  } };
}
// Une saisie de la fiche (SON geste) : un champ connu seulement ; les photos ne s'ajoutent jamais d'ailleurs que de
// la source (retirer / réordonner seulement) ; un pourcentage hors des choix de la voie est refusé.
export function modifierForme(forme, champ, valeur) {
  if (!forme) return forme;
  if (['titre', 'description', 'taille', 'etat', 'marque'].includes(champ)) return { ...forme, [champ]: String(valeur == null ? '' : valeur) };
  if (champ === 'photos') { const source = new Set(forme.photos); const l = arr(valeur).map(str).filter((u) => source.has(u)); return l.length ? { ...forme, photos: l } : forme; }
  if (champ === 'pct') { const { site, pct } = valeur || {}; if (!['leboncoin', 'vestiaire'].includes(site) || !PCT_AUSSI.includes(Number(pct))) return forme; return { ...forme, prix: { ...forme.prix, [site]: { pct: Number(pct) } } }; }
  if (champ === 'prixEbay') { const n = Number(String(valeur == null ? '' : valeur).replace(',', '.').replace(/\s|€/g, '')); return { ...forme, prix: { ...forme.prix, ebay: { valeur: Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null } } }; }
  return forme;
}

// ── LE PRIX DE CHAQUE SITE, AVEC SES FRAIS ─────────────────────────────────
// frais : la sortie de `fraisSite` (src/calculetteAchat.js) — 'zero' · 'taux' (‰) · 'pasLu'. Un frais pas lu est
// DIT (« frais pas lus »), jamais compté 0. Rend { ok, prix, frais: { etat, montant|null, taux }, net|null, code }.
export function prixSite(forme, site, frais = null) {
  if (!forme) return { ok: false, code: 'forme' };
  let r;
  if (site === 'ebay') {
    const v = forme.prix && forme.prix.ebay ? forme.prix.ebay.valeur : null;
    if (!(Number(v) > 0)) r = { ok: false, code: 'prix-pas-lu' };
    else if (forme.plancher && v < forme.plancher.valeur - 1e-9) r = { ok: false, code: 'sous-plancher', prix: v, plancher: forme.plancher };
    else r = { ok: true, prix: Math.round(v * 100) / 100 };
  } else {
    const pct = forme.prix && forme.prix[site] ? forme.prix[site].pct : 0;
    r = prixAussi(forme.source.prix, pct, forme.plancher);
  }
  const f = frais && typeof frais === 'object' ? frais : { etat: 'pasLu' };
  let montant = null;
  if (r.ok && f.etat === 'zero') montant = 0;
  else if (r.ok && f.etat === 'taux' && Number.isFinite(f.taux)) montant = Math.round(r.prix * f.taux / 10) / 100;
  return { ...r, frais: { etat: f.etat === 'zero' || (f.etat === 'taux' && montant != null) ? f.etat : 'pasLu', montant, taux: f.etat === 'taux' ? f.taux : null },
    net: r.ok && montant != null ? Math.round((r.prix - montant) * 100) / 100 : null };
}

// ── 2. PEUT-ON CRÉER SUR CE SITE ? ─────────────────────────────────────────
// ctx :
//   comptes : { leboncoin, vestiaire, ebay } — la sortie de `useComptesAutresSites` (undefined en cours · null pas
//             su · liste des comptes reliés) ;
//   ext     : { aussi: 'ok'|'retard'|'absente', lien: 'ok'|'retard'|'absente' } — `extSait('publieraussi')` et
//             `extSait('aussilien')` dans CE navigateur ;
//   deja    : { leboncoin, vestiaire, ebay } — `enLigneSur` par identité (true · false · null pas su) ;
//             ebayBrouillon : vrai si un brouillon eBay de CETTE annonce existe déjà ;
//   vendue  : la paire est vendue (prouvée) quelque part — alors on ne crée RIEN, on propose de la retirer ;
//   horsVinted : l'annonce n'est plus en ligne sur Vinted (la source n'existe plus).
// Rend { possible, code, raison (clé tr), geste (clé tr) }. `possible` n'est vrai que si TOUT est su et bon.
export function dispoSite(site, ctx = {}) {
  const non = (code, geste = '') => ({ possible: false, code, raison: 'q4.r.' + code, geste: geste ? 'q4.g.' + geste : '' });
  if (!SITES_QUATRE.includes(site)) return non('site');
  if (ctx.vendue === true) return non('vendue');
  if (ctx.horsVinted === true) return non('hors-vinted', 'remettreVinted');
  const deja = ctx.deja && typeof ctx.deja === 'object' ? ctx.deja[site] : null;
  if (deja === true) return non('deja');
  if (site === 'ebay' && ctx.ebayBrouillon === true) return non('brouillon', 'brouillons');
  const comptes = ctx.comptes && typeof ctx.comptes === 'object' ? ctx.comptes[site] : undefined;
  if (comptes === undefined) return non('lecture');
  if (comptes === null) return non('comptes-pas-su', 'relire');
  const vivants = arr(comptes).filter((c) => c && !c.delie && !c.nonIdentifie);
  if (site === 'ebay') {
    if (!vivants.length) return non('ebay-jeton', 'relierEbay');
  } else {
    if (!vivants.length) return non(site === 'leboncoin' ? 'lbc-compte' : 'vc-compte', site === 'leboncoin' ? 'ouvrirLbc' : 'ouvrirVc');
    const e = ctx.ext && typeof ctx.ext === 'object' ? ctx.ext : {};
    if (e.aussi !== 'ok') return non(e.aussi === 'retard' ? 'ext-retard' : 'ext-absente', 'extension');
  }
  if (deja === null || deja === undefined) return non('deja-pas-su', 'relire');
  return { possible: true, code: 'ok', raison: '', geste: '' };
}

// ── 3. CE QUE CHAQUE VOIE REÇOIT — EXACTEMENT ──────────────────────────────
// Rend { ok, envoi } · { ok:false, code } ; `envoi` n'a QUE les clés de `CHAMPS_QUATRE[site]`.
export function envoiSite(site, forme, frais = null) {
  if (!forme || !SITES_QUATRE.includes(site)) return { ok: false, code: 'forme' };
  const numero = forme.source && forme.source.numero;
  if (!numero || !NUM_OK.test(numero)) return { ok: false, code: 'sans-numero' };
  const titre = str(forme.titre).slice(0, TITRE_MAX_QUATRE[site]);
  if (!titre) return { ok: false, code: 'titre' };
  const photos = arr(forme.photos).slice(0, PHOTOS_MAX_QUATRE[site]);
  if (!photos.length) return { ok: false, code: 'photos' };
  const px = prixSite(forme, site, frais);
  if (!px.ok) return { ok: false, code: px.code };
  const commun = { site, annonceVinted: forme.source.id, numero, titre, prix: px.prix, taille: str(forme.taille), etat: str(forme.etat), marque: str(forme.marque), photos };
  if (site === 'leboncoin') {
    const d = descriptionAvecNumero(forme.description, numero);
    if (!d.ok) return { ok: false, code: d.code };
    return { ok: true, envoi: { ...commun, description: d.texte, pct: forme.prix.leboncoin.pct } };
  }
  if (site === 'vestiaire') {
    const d = descriptionAvecReference(forme.description, numero);
    if (!d.ok) return { ok: false, code: d.code };
    return { ok: true, envoi: { ...commun, reference: skuQuatre(numero), description: d.texte, pct: forme.prix.vestiaire.pct } };
  }
  const desc = String(forme.description || '').trim();
  const autres = [...new Set(numerosMarques(desc).map((o) => o.cle))].filter((c) => c !== numero);
  if (autres.length) return { ok: false, code: 'autre-numero' };
  return { ok: true, envoi: { ...commun, sku: skuQuatre(numero), description: desc } };
}
// L'envoi de la fiche reste-t-il celui de l'annonce Vinted pour Leboncoin / Vestiaire ? La voie de l'extension
// RELIT l'annonce Vinted par son identifiant et en reprend titre, description, taille, état, marque et photos
// (« tout recalculé » : 5.424) ; seuls le pourcentage de prix et le site passent du lien. Un champ modifié ici
// partirait donc différent sur eBay seulement : la feuille le DIT (jamais une promesse fausse).
export function champsModifies(forme, source) {
  if (!forme || !source) return [];
  const out = [];
  for (const c of ['titre', 'description', 'taille', 'etat', 'marque']) if (str(forme[c]) !== str(source[c])) out.push(c);
  if (arr(forme.photos).join('|') !== arr(source.photos).join('|')) out.push('photos');
  return out;
}

// ── 4. LA FILE ─────────────────────────────────────────────────────────────
// coches : { leboncoin: bool, … } ; dispo : { site: sortie de dispoSite }. Leboncoin et Vestiaire partent ENSEMBLE
// par UN passage au panneau (le dépôt de l'extension les déroule un par un) ; eBay ensuite. Un site décoché ou
// impossible n'est JAMAIS dans la file.
export function planQuatre(coches, dispo) {
  const ok = (s) => !!(coches && coches[s]) && !!(dispo && dispo[s] && dispo[s].possible === true);
  const panneau = ['leboncoin', 'vestiaire'].filter(ok);
  const plan = [];
  if (panneau.length) plan.push({ voie: 'panneau', sites: panneau });
  if (ok('ebay')) plan.push({ voie: 'ebay', sites: ['ebay'] });
  return plan;
}

// ── 5. LE DÉROULÉ ──────────────────────────────────────────────────────────
// Un pas à la fois. AVANT chaque envoi, le prix Vinted est RELU (`relirePrix()` : nombre · null pas su ·
// 'absente' plus en ligne) et comparé à celui de la fiche : changé, pas su ou retirée ⇒ CE pas s'arrête, dit, rien
// ne part. `envoyer[voie](pas)` rend { accepte, etat, lien, raison, code }. `surEtat(site, etat)`.
// États d'un site : attente · relecture · envoi · panneau (à confirmer dans l'extension) · brouillon (eBay) ·
// cree · arrete.
export async function executerQuatre({ plan = [], forme, relirePrix, envoyer = {}, surEtat = () => {} } = {}) {
  const res = {};
  const dire = (sites, e) => { for (const s of sites) { res[s] = e; try { surEtat(s, e); } catch (_) {} } };
  for (const pas of plan) dire(pas.sites, { etat: 'attente' });
  for (const pas of plan) {
    dire(pas.sites, { etat: 'relecture' });
    let lu;
    try { lu = await relirePrix(); } catch (_) { lu = null; }
    const vu = forme && forme.source ? forme.source.prix : null;
    if (lu === 'absente') { dire(pas.sites, { etat: 'arrete', code: 'plus-en-ligne' }); continue; }
    if (!(Number(lu) > 0)) { dire(pas.sites, { etat: 'arrete', code: 'prix-pas-relu' }); continue; }
    if (vu == null || Math.abs(Number(lu) - Number(vu)) > 0.005) { dire(pas.sites, { etat: 'arrete', code: 'prix-change', avant: vu, apres: Number(lu) }); continue; }
    const f = envoyer[pas.voie];
    if (typeof f !== 'function') { dire(pas.sites, { etat: 'arrete', code: 'voie' }); continue; }
    dire(pas.sites, { etat: 'envoi' });
    let r;
    try { r = await f(pas); } catch (_) { r = { accepte: false, code: 'coupe' }; }
    if (!r || r.accepte !== true) { dire(pas.sites, { etat: 'arrete', code: (r && r.code) || 'refus', raison: (r && r.raison) || '' }); continue; }
    dire(pas.sites, { etat: r.etat || 'cree', lien: r.lien || '', code: r.code || '' });
  }
  return res;
}
// L'état SUIVI après l'envoi : ce que la relecture par identité dit maintenant (`deja`, la même lecture que
// « déjà sur ce site »). « panneau » ou « brouillon » devient « créée ✓ » seulement quand le site la MONTRE.
export function etatSuivi(e, vuEnLigne, lien = '') {
  if (!e) return e;
  if ((e.etat === 'panneau' || e.etat === 'brouillon' || e.etat === 'envoi') && vuEnLigne === true) return { ...e, etat: 'cree', lien: lien || e.lien || '' };
  return e;
}

// ── 6. VENDUE ⇒ RETIRER AILLEURS ? ─────────────────────────────────────────
// art : un article du plan de « retirer ailleurs » (src/retirerAilleurs.js `planRetirerAilleurs` → src/aRetirerAilleurs.js),
// dont la vente est PROUVÉE (`douteuse` faux). Rend { venduSur, ailleurs: [sites où VRM peut retirer sur SON toucher],
// aVerifier: [sites pas sûrs] } — ou null : vente pas prouvée, rien en ligne ailleurs. Jamais de geste ici : la
// question mène au geste existant (sa confirmation, une annonce à la fois).
export function questionRetrait(art) {
  if (!art || art.douteuse !== false) return null;
  const venduSur = [...new Set(arr(art.venduSur))];
  if (!venduSur.length) return null;
  const ouverts = arr(art.sites).filter((s) => s && s.etat !== 'retire' && s.etat !== 'note');
  const ailleurs = [...new Set(ouverts.filter((s) => s.voie !== 'verifier').map((s) => s.plateforme))];
  const aVerifier = [...new Set(ouverts.filter((s) => s.voie === 'verifier').map((s) => s.plateforme))];
  if (!ailleurs.length && !aVerifier.length) return null;
  return { numero: str(art.numero), titre: str(art.titre), photo: art.photo || null, venduSur, ailleurs, aVerifier };
}
