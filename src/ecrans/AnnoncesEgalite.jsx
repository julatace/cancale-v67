// ══════════════════════════════════════════════════════════════════════════
//  ANNONCES — LE BRANCHEMENT DE L'ÉCRAN NATIF (19 nov. 2026)
//
//  Julien : « je veux que tout soit comme Vinted, avec toutes les informations à côté : les prix minimum
//  acceptés, relier un achat, relié à Vinted. Ce n'est pas parce que Vinted est ma plateforme principale
//  que c'est la plateforme principale des autres. »
//
//  Ici seulement les LECTURES et les ÉCRITURES ; la vue est src/natif/ecrans/Annonces.jsx, les règles
//  src/articles/ (modele, sources). Chaque site est lu par SES règles, celles que l'app applique déjà :
//    · Vinted : `fetchVintedListings` (<enligne-regle>), compte par compte, comme le Stock ;
//    · Leboncoin : `lbc_listings` (projeté) + `lbc_ventes`, `annonceLbcEnVente` / `etatEnLigneLbc`,
//      N° par `numeroLbcIdentite` — TOUTES ses annonces, plus seulement celles « reliées » (le défaut du 19 nov.) ;
//    · eBay : `lireEbayTous` (`ebay_listings`), N° par `numEbayLu` (SKU, lien, N° propre) ;
//    · Vestiaire : `vc_listings` projeté, `etatAnnonceVcBrut`, `numVcAnnonce`.
//  Une lecture ratée ⇒ ce site est « pas su », NOMMÉ en pied (jamais « aucune annonce »).
//  Les faits (acheté, prix mini) s'écrivent par `gesteVrm` (`opsFait` : la fiche Vinted si l'article en a une,
//  sinon `vrm_articles_sites` sous l'identifiant de l'annonce de SON site), relus juste avant : carte pas lue ⇒ rien.
//  Les actions passent par l'écran Annonces Vinted d'hier (monté, caché) : `demanderActionAnnonces`.
// ══════════════════════════════════════════════════════════════════════════
import { useComptesBloques } from '../compteBloqueEtat.js';
import { etatLienLu, propositionLu, relierDepuisListe, queSurCeSite, ouvrirLiaison, abonnerLiaison, demanderLiaison } from '../liaisonEtat.js';   // (20 nov.) relier depuis la liste
import React from 'react';
import { lazySur } from '../chargementSur.js';
import { tr } from '../i18n/index.js';
import VueAnnonces from '../natif/ecrans/Annonces.jsx';
import { Bouton as BoutonNatifAE } from '../natif/Bouton.jsx';   // (21 nov., ux-reglages) le geste de l'état vide
import { LogoSite } from '../SelecteurSites.jsx';   // (20 nov.) le logo du site dans l'en-tête de chaque compte
import { construireArticles, filtrerArticles, compterArticles, trierArticles, opsFait, limitesDe, NOM_SITE, CLE_ARTICLES, statutTableau, comptesDesArticles, SITES } from '../articles/modele.js';
import { annoncesVinted, annoncesLeboncoin, annoncesEbay, annoncesVestiaire, annoncesVintedVendues } from '../articles/sources.js';
import { photoArticle } from '../photosArticles.js';
import { groupesParCompte } from '../natif/ecrans/annoncesComptes.js';   // (22 nov.) le nombre de rangées d'un site (filtre Site)   // (22 nov.) la photo d'une vente Vinted (« Vendue »)
import { CLE_VUES_LUES, noterVuesLues, vuesFavorisEnLigne, publierVuesFavoris, lectureUtile } from '../vuesFavoris.js';
import { valeurStockAffiche, publierStockValeur } from '../stockValeurAffiche.js';
import { etatEnLigneLbc } from '../enLigneLbc.js';
import { annuaireLbc } from '../plateformes.js';
import { etatAnnonceVcBrut, numVcAnnonce } from '../../api/_lib/vestiaire-regle.js';
import { annonceLbcALui, comptesLbcProuves, comptesLbcSession, fetchVintedListings, lbcListingsSession, lireBaseRelue, SUPABASE_URL, lireEbayTous, SEL_EBAY_ANNONCES, numEbayLu, numeroLbcIdentite,
  annonceLbcEnVente, annoncesLbcVendues, lienEbay, cleNum, fmt, gesteVrm, load, save, AUTH, Icon, PhotoVinted, numerosVcEffectifs, comptesStockEcartes, toast, demanderActionAnnonces, askConfirm, ANNONCES_RETIREES, lirePreuvesVenteVinted, prendreVue, fetchTxnItemIds, ventesCoqueLues, photoKey } from '../App.jsx';
import { ouvrirPanneau } from '../ouvrirPanneau.js';
// (22 nov., choix n° 35) « Photo en double » : la règle d'identité par le FICHIER photo exact (src/photoEnDouble.js).
import { photosEnDouble, numerosEnExemplaires, refuserGroupe, CLE_PHOTO_DOUBLE_NON } from '../photoEnDouble.js';
import PhotoEnDouble from '../natif/ecrans/PhotoEnDouble.jsx';
// (21 nov., prio-recherche) « À republier en priorité » : LA règle (src/republierPriorite.js), la vue, et ses exclusions.
import { republierEnPriorite, lireReglagePrio, publierPriorite, CLE_SEUIL_DORMENT, CLE_PAR_JOUR } from '../republierPriorite.js';
import RepublierPriorite, { usePrioSelection, PleinRepublier } from '../natif/ecrans/RepublierPriorite.jsx';
import { comptesPersonnels, CLE_ROLES_COMPTES } from '../rolesComptes.js';
import { enLitigeConnus, abonnerLitiges } from '../litigesEnCours.js';
import { ACTIONS_EXTENSION } from '../actionsExtension.js';
import { lireSupprimes } from '../comptesSupprimes.js';   // (21 nov.) un compte supprimé pour de bon n'est jamais relu   // (20 nov.) la pause Leboncoin : dans l'extension

const JOUR = 24 * 3600 * 1000;
const ACTIONS = [
  { cle: 'recreer', libelle: 'egalite.action.republier', icone: 'sync', etats: ['enligne'], robot: true },
  { cle: 'main', libelle: 'egalite.action.main', icone: 'pencil', etats: ['enligne', 'masquee', 'brouillon'] },
  { cle: 'versBrouillon', libelle: 'egalite.action.versBrouillon', icone: 'archive', etats: ['enligne'], robot: true },
  { cle: 'enLigne', libelle: 'egalite.action.enLigne', icone: 'play', etats: ['brouillon'], robot: true },
  { cle: 'baisser', libelle: 'egalite.action.baisser', icone: 'tag', etats: ['enligne'] },
  { cle: 'partout', libelle: 'egalite.action.partout', icone: 'link', etats: ['enligne'], tousSites: true },
  // (19 nov., publier-agent) « Publier sur… » : l'agent sans IA remplit chaque site depuis la fiche article neutre (src/publier/).
  { cle: 'agent', libelle: 'agent.action', icone: 'link', etats: ['enligne'], tousSites: true },
];
const cleActionTr = { recreer: 'republier', main: 'main', versBrouillon: 'versBrouillon', enLigne: 'enLigne', baisser: 'baisser', partout: 'partout' };
// (20 nov., chasse-bugs) `lazySur` comme partout (audit-ouverture) : un morceau qui rate après une mise en ligne est relancé,
// puis rechargement propre ou « Mettre à jour VRM » — plus « Cet écran a un souci » sur « Publier sur… ».
const PublierAgent = lazySur(() => import('./PublierAgent.jsx'));
const vintedDe = (a) => a.annonces.find((x) => x.site === 'vinted') || null;
const propreJournal = (journal, site, id) => { const e = journal && journal['propre:' + site + ':' + id]; return !!(e && typeof e === 'object' && e.actif !== false); };

// Toutes les annonces de tous ses sites, dans la forme commune. Rend { annonces, manque: [site] } ou null (rien lu).
// (21 nov., fluidité — capture iPhone de Julien : Annonces en squelette, qui ne finissait pas) Une lecture qui ne répond
// JAMAIS (réseau du téléphone qui se perd, requête pendue) retenait toute la liste : `Promise.all` attendait pour toujours.
// Chaque lecture a maintenant sa borne : passé ce temps, elle vaut « pas su » (le site est dit dans « ce qui manque »),
// jamais un squelette éternel. Une lecture lente qui finit APRÈS sa borne n'est pas perdue : elle demande une relecture de
// l'écran (`vrm:annonces-relire`), qui la trouve alors en cache ou la refait.
export const BORNE_LECTURE_MS = 8000;
export const EVT_RELIRE_ANNONCES = 'vrm:annonces-relire';
let _relireTardAt = 0;
export const borneLecture = (p, ms = BORNE_LECTURE_MS, repli = null) => new Promise((ok) => {
  let passe = false;
  const t = setTimeout(() => { passe = true; ok(repli); }, ms);
  Promise.resolve(p).then((v) => {
    clearTimeout(t);
    if (!passe) { ok(v); return; }
    // Une fois par minute au plus : une lecture toujours plus lente que sa borne ne relance pas l'écran en boucle.
    if (v != null && Date.now() - _relireTardAt > 60000) { _relireTardAt = Date.now(); try { window.dispatchEvent(new CustomEvent(EVT_RELIRE_ANNONCES)); } catch (_) {} }
  }, () => { clearTimeout(t); if (!passe) ok(repli); });
});
// (21 nov., Julien : « quand un compte est ban je veux quand même pouvoir voir les annonces qu'il y avait dessus »)
// Mesuré sur la base (lecture seule, 21 nov.) : deux comptes en pause ; le dressing de l'un, recapté APRÈS le blocage, ne porte
// plus que ses 3 ventes (ses 2 annonces en vente ont disparu de la capture), l'autre n'a plus de dressing ; aucune lecture publique.
// Elles disparaissaient pour TROIS raisons : (1) le compte en pause était retiré de la liste des comptes lus ; (2) un compte
// « retiré pour de bon » (`vrm_annonces_retirees`) ou masqué était écarté par `comptesStockEcartes` ; (3) la règle « en ligne »
// rend absentes celles que Vinted ne montre plus — et la capture d'après le blocage ne les porte plus du tout.
// Désormais un compte BLOQUÉ (« banni » lu, ou SON choix « pause », ou retiré pour de bon), lié et pas supprimé, est lu :
//   · en pause / retiré ⇒ toutes ses annonces passent « bloque » (hors de « en ligne » et des totaux, comme la pause le dit) ;
//   · « banni » lu sans pause ⇒ la règle « en ligne » décide de ce que Vinted montre encore ; le reste devient « bloque » ;
//   · la DERNIÈRE TRACE : ce que sa lecture ne montre plus sans vente (`autres`), puis SES FICHES (`vinted_annonce_numeros`,
//     même `accountId`) qu'aucune lecture ne porte, qu'aucune preuve ne dit vendues (dressing, transactions, bordereaux,
//     `vinted_annonces_vendues`) et qu'il n'a pas déclarées perdues. Preuves de vente pas lues ⇒ aucune fiche (on ne montre pas
//     une paire peut-être vendue). Datées : « lu le » (sa lecture), « vue en ligne le » (`vrm_vus_en_ligne`), « N° posé le ».
// Aucune règle « en ligne » n’est touchée : « bloque » a son segment à part (« Bloqués »), n’entre dans aucun total ni aucune action.
// (22 nov.) Les ventes de la coque : déjà lues, sinon attendues (au plus 20 s) — `null` (pas lues) ⇒ aucune « Vendue » ajoutée.
const ventesLuesBientot = () => new Promise((ok) => {
  const v = ventesCoqueLues(); if (v !== undefined) { ok(v); return; }
  let fin = false; const f = () => { const x = ventesCoqueLues(); if (x === undefined || fin) return; fin = true; window.removeEventListener('vrm:ventes-coque', f); clearTimeout(t); ok(x); };
  const t = setTimeout(() => { if (fin) return; fin = true; window.removeEventListener('vrm:ventes-coque', f); ok(null); }, 20000);
  window.addEventListener('vrm:ventes-coque', f);
});
export async function lireAnnoncesEgalite(accounts, { pause = new Set(), bannis = new Set() } = {}) {
  const horsCompte = comptesStockEcartes();
  const retirees = (() => { try { const m = load(ANNONCES_RETIREES, {}); return new Set(m && typeof m === 'object' && !Array.isArray(m) ? Object.keys(m).map(String) : []); } catch (_) { return new Set(); } })();
  const supprimes = (() => { try { return new Set([...(lireSupprimes() || [])].map(String)); } catch (_) { return new Set(); } })();
  const bloqueDe = (uid) => (pause.has(uid) || retirees.has(uid) ? 'horsLigne' : bannis.has(uid) ? 'banni' : '');
  const accs = (accounts || []).filter((a) => { if (!a || a.vinted_user_id == null) return false; const u = String(a.vinted_user_id);
    return !horsCompte({ accountId: u }) || (!!bloqueDe(u) && !supprimes.has(u)); });
  const manque = [];
  const [vinted, ls, vr, eb, vc, annu] = await Promise.all([
    Promise.all(accs.map(async (acc) => {
      const uid = String(acc.vinted_user_id);
      let r; try { r = await borneLecture(fetchVintedListings(acc, 1, {})); } catch (_) { r = null; }
      const bl = bloqueDe(uid);
      if (!r || !r.ok) return { uid, pseudo: String(acc.login || acc.username || ''), ok: false, bloque: bl };
      return { uid, pseudo: String(acc.login || acc.username || ''), ok: true, lu: Number.isFinite(r.lu) ? r.lu : null, enLigne: r.items || [], aConfirmer: r.aConfirmer || [], masquees: r.masquees || [], brouillons: r.brouillons || [],
        bloque: bl, autres: r.autres || [], capte: Number.isFinite(r.capte) ? r.capte : null, soldIds: r.soldIds || [], vendusDressing: r.vendusDressing || [],
        // (22 nov.) « Retirée » : ce que Vinted ne montre plus et qui n'est PAS une vente (fermée sans « sold », absente d'une
        // lecture plus récente) — un compte bloqué les garde en traces, les autres les montrent « retirée ».
        retirees: bl ? [] : (r.autres || []) };
    })),
    borneLecture(lbcListingsSession()),
    borneLecture(lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=eq.lbc_ventes&select=ventes:data->ventes`)),
    borneLecture(lireEbayTous('ebay_listings', SEL_EBAY_ANNONCES, 'items')),
    borneLecture(lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=eq.vc_listings&select=items:data->items,liens:data->liens,capturedAt:data->>capturedAt`)),
    borneLecture(lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=eq.lbc_accounts&select=a:data->accounts`)),
  ]);
  const journal = load('vrm_liaison_sites', {}) || {};
  const out = [];
  if (vinted.some((c) => !c.ok && !c.bloque)) manque.push('vinted');
  out.push(...annoncesVinted(vinted.map((c) => {
    if (!c.bloque) return c;
    const t = (ms) => (Number.isFinite(ms) ? ms : null);
    // (1) ce que sa lecture porte encore mais ne montre plus (absente, fermée sans vente) — tout de suite.
    return { ...c, horsLigne: c.bloque === 'horsLigne', traces: (c.autres || []).map((it) => ({ it, le: t(c.lu) != null ? c.lu : t(c.capte), par: 'lecture' })) };
  })));
  // (2) SES fiches : en SECOND temps (`tracesFiches`, après les preuves de vente) — la liste ne les attend pas.
  const bloques = vinted.filter((c) => c.bloque).map((c) => ({ uid: c.uid, pseudo: c.pseudo, horsLigne: c.bloque === 'horsLigne', soldIds: c.soldIds || [],
    deja: [...(c.enLigne || []), ...(c.aConfirmer || []), ...(c.masquees || []), ...(c.brouillons || []), ...(c.autres || [])].map((x) => String(x && x.id)) }));
  // Leboncoin
  if (ls && ls.items && Array.isArray(vr)) {
    const vendues = annoncesLbcVendues((vr[0] && vr[0].ventes) || {});
    const liens = { ...(load('vrm_lbc_liens', {}) || {}) };
    const noms = Array.isArray(annu) ? annuaireLbc((annu[0] && annu[0].a) || {}) : null;
    // (20 nov.) Seules SES annonces : compte prouvé par une vente ou une session vue, ou référence VRM (`annonceLbcALui`).
    const prouves = new Set([...comptesLbcProuves((vr[0] && vr[0].ventes) || {}, ls.items), ...(Array.isArray(annu) ? comptesLbcSession((annu[0] && annu[0].a) || {}) : [])]);
    out.push(...annoncesLeboncoin(ls.items, {
      aLui: (ad) => annonceLbcALui(ad, prouves),
      etatDe: (ad) => { if (!annonceLbcEnVente(ad, vendues)) return vendues.has(String(ad.id)) ? 'vendue' : 'retiree';
        const e = etatEnLigneLbc(ad, { enVente: (x) => annonceLbcEnVente(x, vendues), lectures: ls.lectures || {}, maintenant: Date.now() });
        return e.etat === 'enligne' ? 'active' : e.etat === 'aconfirmer' ? 'aconfirmer' : 'retiree'; },
      numeroDe: (ad) => numeroLbcIdentite({ itemId: ad.id }, ls.items, liens),
      pseudoDe: (ad) => { const c = String(ad.account || ad.lbcUser || '').replace(/^lbc-account:/i, ''); return (noms && noms[c]) || ad.accountName || ''; },
      propreDe: (ad) => propreJournal(journal, 'Leboncoin', ad.id) }));
  } else manque.push('leboncoin');
  // eBay
  if (eb && Array.isArray(eb.items)) {
    const luDe = new Map((eb.lignes || []).map(({ compte, ligne }) => [compte && compte.ref, ligne && ligne.capturedAt ? Date.parse(ligne.capturedAt) : NaN]));
    out.push(...annoncesEbay(eb.items.map((x) => { const t = luDe.get(x && x._compte); return { ...x, frais: Number.isFinite(t) && Date.now() - t >= 0 && Date.now() - t < JOUR }; }), {
      numeroDe: (x) => numEbayLu(x && x.sku, x && x.itemId, null, x && x.depuis) || '',
      vintedDe: (x) => { const l = lienEbay(x && x.itemId); return l ? String(l.pairId) : ''; },
      propreDe: (x) => propreJournal(journal, 'eBay', x && x.itemId) }));
    if ((eb.illisibles || []).length) manque.push('ebay');
  } else manque.push('ebay');
  // Vestiaire
  if (Array.isArray(vc)) {
    const L = vc[0] || {};
    const auto = numerosVcEffectifs();
    const liensVc = load('vrm_vc_liens', {}) || {};
    const t = Date.parse(L.capturedAt || '');
    out.push(...annoncesVestiaire(L.items || {}, {
      etatDe: (id, it) => etatAnnonceVcBrut(it, false, L.capturedAt),
      numeroDe: (id, it) => numVcAnnonce(id, it, { ...(L.liens || {}) }, auto),
      vintedDe: (id) => { const x = liensVc[String(id)]; return x && typeof x === 'object' && x.item ? String(x.item) : ''; },
      vieille: !(Number.isFinite(t) && Date.now() - t < JOUR) }));
  } else manque.push('vestiaire');
  // (22 nov.) Les ventes Vinted (second temps, après les preuves) : les comptes lus et leurs annonces fermées « vendue ».
  const vendusCtx = { comptes: Object.fromEntries(vinted.filter((c) => c.ok || c.bloque).map((c) => [c.uid, c.pseudo])), dressing: Object.fromEntries(vinted.map((c) => [c.uid, c.vendusDressing || []])) };
  return { annonces: out, manque, bloques, vendusCtx };
}

// (21 nov.) La DERNIÈRE TRACE d'un compte bloqué, second temps : SES fiches (`vinted_annonce_numeros`, même `accountId`) qu'aucune
// lecture ne porte, qu'aucune preuve ne dit vendues, pas déclarées perdues. `preuves` = `lirePreuvesVenteVinted()` ; `null` (pas lues)
// ⇒ AUCUNE fiche (on ne montre pas une paire peut-être vendue). Rend des annonces « bloque », datées.
export function tracesFiches(bloques, preuves) {
  const vendusSur = preuves && preuves.vendus instanceof Set ? preuves.vendus : null;
  if (!vendusSur || !Array.isArray(bloques) || !bloques.length) return [];
  const fiches = load('vinted_annonce_numeros', {}) || {};
  const vendusMain = new Set((load('vinted_annonces_vendues', []) || []).map(String));
  const perdues = load('vinted_pairs_lost', {}) || {};
  const vusEnLigne = load('vrm_vus_en_ligne', {}) || {};
  return annoncesVinted(bloques.map((c) => {
    const deja = new Set(c.deja || []), vendus = new Set((c.soldIds || []).map(String));
    const traces = [];
    for (const [id, f] of Object.entries(fiches)) {
      if (!f || typeof f !== 'object' || String(f.accountId || '') !== String(c.uid)) continue;
      if (deja.has(id) || vendus.has(id) || vendusSur.has(id) || vendusMain.has(id) || perdues[id]) continue;
      const vu = Date.parse(String(vusEnLigne[id] || '')), pose = Date.parse(String(f.numberedAt || ''));
      const prix = f.price != null && f.price !== '' ? Number(String(f.price).replace(',', '.')) : null;
      traces.push({ it: { id, title: f.title || '', photo: f.photo || null, price: Number.isFinite(prix) ? prix : null, size: f.size || '', brand: '', createdTs: null },
        le: Number.isFinite(vu) ? vu : Number.isFinite(pose) ? pose : null, par: Number.isFinite(vu) ? 'vu' : 'numero' });
    }
    return { uid: c.uid, pseudo: c.pseudo, ok: false, horsLigne: c.horsLigne, traces };
  }));
}

// (20 nov. soir) Plus de sélecteur de plateforme : la liste du téléphone montre TOUS les sites (le logo de chaque annonce, ses
// groupes par compte) ; le tableau de l'ordinateur garde un filtre « Site » discret dans son menu de filtres.
// (21 nov., fluidité — banc couches-chargement, Annonces au 2e toucher : le grand titre seul, puis ~1 s de squelette, puis
// la liste) La dernière lecture RÉUSSIE de cette page, par vendeur et par comptes : l'écran remonté repart d'elle (la même
// liste, à la même place) pendant que la lecture se refait, et elle la remplace à son arrivée. Mémoire de la page seulement
// (rien n'est écrit) ; une lecture ratée ne l'efface pas, elle ne s'y substitue pas non plus (« pas su » reste dit).
const _derniereLecture = { cle: '', lu: undefined };
const cleLecture = (cleComptes) => ((AUTH.user && AUTH.user.id) || '') + '|' + cleComptes;
export default function AnnoncesEgalite({ accounts: accountsTous = [], siteInitial = 'tous', onEcranSite = null }) {
  // (19 nov., intégration — lot compte-bloque) Un compte que Vinted a bloqué et que le vendeur a mis EN PAUSE (son choix) :
  // ses annonces sortent de la liste, comme dans l'écran d'avant (`annBase`) ; la ligne « N annonces en pause » les dit.
  // (21 nov.) Plus retirées : elles restent lisibles sous « Comptes bloqués » (dernière lecture connue, datée), hors de « en ligne »
  // et des totaux (`lireAnnoncesEgalite` : en pause ⇒ « bloque »), aucune action proposée.
  const { pause: pauseCB, bloques: bannisCB } = useComptesBloques();
  const accounts = accountsTous || [];
  const cleBloques = [...(pauseCB || [])].sort().join(',') + '|' + [...(bannisCB || [])].sort().join(',');
  const cleComptes = (accounts || []).map((a) => String((a && a.vinted_user_id) || '')).sort().join(',');
  // (intégration 21 nov.) La mémoire de la dernière lecture tient aussi compte des comptes bloqués (une pause change la liste).
  const memo = _derniereLecture.cle && _derniereLecture.cle === cleLecture(cleComptes + '|' + cleBloques) ? _derniereLecture : null;
  const [lu, setLu] = React.useState(() => (memo ? memo.lu : undefined));            // undefined lecture · null pas su · { annonces, manque }
  const [tic, setTic] = React.useState(0);
  // (19 nov. soir, tableau de travail) « Mis à jour il y a … » : l'heure de la dernière lecture RÉUSSIE ; ⟳ relance la MÊME lecture.
  const [majLe, setMajLe] = React.useState(() => (memo ? memo.le : undefined));
  const [relit, setRelit] = React.useState(false);
  const [filtreT, setFiltreT] = React.useState({ site: siteInitial || 'tous', compte: '', dort: 'toutes' });
  const [filtre, setFiltre] = React.useState({ site: siteInitial || 'tous', etat: 'enligne' });
  const [q, setQ] = React.useState('');
  React.useEffect(() => {
    const prendre = () => { try { if (prendreVue('arepublier')) setFiltre((f) => ({ ...f, etat: 'arepublier' })); else if (prendreVue('photodouble')) setFiltre((f) => ({ ...f, etat: 'photodouble' })); else if (prendreVue('dorment')) setFiltre((f) => ({ ...f, etat: 'dorment' })); } catch (_) {} };
    prendre(); window.addEventListener('vrm:vue', prendre);
    return () => window.removeEventListener('vrm:vue', prendre);
  }, []);
  const [agent, setAgent] = React.useState(null);           // les articles choisis pour « Publier sur… »
  React.useEffect(() => {
    let vivant = true;
    const cleMemo = cleLecture(cleComptes + '|' + cleBloques);
    lireAnnoncesEgalite(accounts, { pause: pauseCB || new Set(), bannis: bannisCB || new Set() }).then((r) => {
      if (r) { _derniereLecture.cle = cleMemo; _derniereLecture.lu = r; _derniereLecture.le = Date.now(); }
      if (!vivant) return;
      setLu(r); setMajLe(r ? Date.now() : null); setRelit(false);
      // (21 nov.) Un compte bloqué : ses fiches arrivent en second temps, après les preuves de vente (la liste ne les attend pas).
      // (22 nov., Julien : « j'ai fait 3 ventes mais pas que sur Leboncoin ») … et les annonces Vinted VENDUES : prouvées
      // (<preuve-vente-regle>), reliées à leur vente par le n° de transaction (jamais le titre) — `annoncesVintedVendues`.
      if (r) Promise.all([lirePreuvesVenteVinted().catch(() => null), fetchTxnItemIds().catch(() => ({})), ventesLuesBientot()]).then(([p, txnItem, ventes]) => {
        const plus = r.bloques && r.bloques.length ? tracesFiches(r.bloques, p) : [];
        const vendues = annoncesVintedVendues({ ventes, txnItem, vendus: p && p.vendus instanceof Set ? p.vendus : null, comptes: (r.vendusCtx || {}).comptes, dressing: (r.vendusCtx || {}).dressing, photoDe: (o) => photoArticle(o) || null });
        if (!plus.length && !vendues.length) return;
        const parId = new Map(vendues.map((v) => [v.id, v]));
        // Une annonce déjà là (« retirée », trace) et PROUVÉE vendue devient « vendue » ; les autres s'ajoutent.
        const annonces = r.annonces.map((x) => (x && x.site === 'vinted' && parId.has(String(x.id)) ? { ...x, etat: 'vendue', bloque: null, venduLe: parId.get(String(x.id)).venduLe } : x));
        const deja = new Set(annonces.filter((x) => x && x.site === 'vinted').map((x) => String(x.id)));
        const complet = { ...r, annonces: [...annonces, ...plus.filter((x) => !parId.has(String(x.id))), ...vendues.filter((v) => !deja.has(v.id))] };
        if (_derniereLecture.lu === r) _derniereLecture.lu = complet;
        if (vivant) setLu((x) => (x === r ? complet : x));
      });
    }).catch(() => { if (vivant) { setLu(null); setMajLe(null); setRelit(false); } });
    return () => { vivant = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleComptes, cleBloques, tic]);
  React.useEffect(() => {
    const f = (e) => { const k = e && e.detail && e.detail.k; if ([CLE_ARTICLES, 'vinted_annonce_numeros', 'vinted_buyprice_by_num', 'vrm_lbc_liens', 'vrm_ebay_liens', 'vrm_vc_liens', 'vrm_slots', CLE_PHOTO_DOUBLE_NON, 'vinted_bleam'].includes(k)) setTic((t) => t + 1); };
    const g = (e) => { const d = e && e.detail; if (d && d.type === 'maj') setTic((t) => t + 1); };
    // Une lecture arrivée après sa borne (`borneLecture`) : une relecture, une seule à la fois (le minuteur les regroupe).
    let tr2 = 0; const h = () => { clearTimeout(tr2); tr2 = setTimeout(() => setTic((t) => t + 1), 300); };
    window.addEventListener('vrm:save', f); window.addEventListener('vrm:ext', g); window.addEventListener(EVT_RELIRE_ANNONCES, h);
    return () => { clearTimeout(tr2); window.removeEventListener('vrm:save', f); window.removeEventListener('vrm:ext', g); window.removeEventListener(EVT_RELIRE_ANNONCES, h); };
  }, []);
  // (21 nov., prio-recherche) Le seuil de « Dorment » EST l'âge mini d'« À republier » (une règle, un réglage) : un état, relu
  // de cet appareil, réécrit sur SON choix (dans la feuille des réglages d'« À republier »).
  const lireRegPrio = () => { try { return lireReglagePrio({ jours: localStorage.getItem(CLE_SEUIL_DORMENT), parJour: localStorage.getItem(CLE_PAR_JOUR) }); } catch (_) { return lireReglagePrio({}); } };
  const [regPrio, setRegPrio] = React.useState(lireRegPrio);
  const poserRegPrio = (r) => setRegPrio((avant) => { const n = lireReglagePrio({ ...avant, ...r });
    try { localStorage.setItem(CLE_SEUIL_DORMENT, String(n.jours)); localStorage.setItem(CLE_PAR_JOUR, String(n.parJour)); } catch (_) {} return n; });
  const seuil = regPrio.jours;
  const modele = React.useMemo(() => {
    if (!lu) return lu;
    const aVinted = (accounts || []).length > 0;
    return construireArticles({ annonces: lu.annonces, fiches: load('vinted_annonce_numeros', {}) || {}, faits: load(CLE_ARTICLES, {}) || {},
      achatsParNum: load('vinted_buyprice_by_num', {}) || {}, slots: load('vrm_slots', {}) || {}, cle: cleNum, aVinted,
      meubleDe: (s) => { const m = (load('vrm_meubles', []) || []).find((x) => x && String(x.id) === String(s.m)); return m ? `${m.name || ''} · ${Number(s.i) + 1}` : ''; } });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lu, tic]);
  const sites = React.useMemo(() => (modele ? [...new Set(modele.articles.flatMap((a) => a.sites))] : []), [modele]);
  // (20 nov., « ce qui manque ») CET écran est le propriétaire (§11) de deux chiffres qu'Aujourd'hui lit :
  //   · les VUES ET FAVORIS de ses annonces en ligne (src/vuesFavoris.js) : un point daté par lecture qui change quelque
  //     chose (`vrm_vues_lues`, synchronisé), puis les totaux et le gagné du jour, publiés (`vrm_vues_favoris`) ;
  //   · la VALEUR DU STOCK AU PRIX AFFICHÉ (src/stockValeurAffiche.js) : une paire comptée une fois, prix Vinted sinon le
  //     plus bas (`vrm_stock_valeur`).
  // Lecture ratée (`lu` null) ⇒ rien n'est écrit ni publié : les derniers chiffres restent. Un site pas lu ⇒ « au moins ».
  React.useEffect(() => {
    if (!modele || !lectureUtile(lu) || !AUTH.user?.id) return;
    const owner = AUTH.user.id, manque = !!(lu.manque && lu.manque.length);
    let journal = load(CLE_VUES_LUES, null);
    try {
      const r = noterVuesLues(journal, modele.articles.flatMap((a) => a.annonces.filter((x) => x.etat === 'enligne')));
      if (r.ajoutes) { save(CLE_VUES_LUES, r.journal); journal = r.journal; }
    } catch (_) { /* journal illisible : la publication part sans le gagné du jour */ }
    publierVuesFavoris(vuesFavorisEnLigne(modele.articles, journal, { manque }), { owner });
    publierStockValeur(valeurStockAffiche(modele.articles, { partiel: manque }), { owner });
  }, [modele, lu]);
  const opts = { seuil, maintenant: Date.now(), cle: cleNum };
  // (21 nov.) Le conseil « Dort · N j » d'une carte : la RÈGLE du segment « Dorment » (`filtrerArticles` etat 'dorment', la date
  // de mise en ligne LUE, ≥ le seuil choisi) — rien d'autre ; date inconnue ⇒ aucun conseil.
  const dortDe = (a) => {
    if (!a || !filtrerArticles([a], { ...opts, etat: 'dorment' }).length) return null;
    const d = a.annonces.filter((x) => x.etat === 'enligne' && x.depuis != null).map((x) => x.depuis);
    return d.length ? Math.floor((opts.maintenant - Math.min(...d)) / JOUR) : null;
  };
  const comptes = modele ? compterArticles(modele.articles, opts) : null;
  // ── (21 nov., prio-recherche) « À REPUBLIER EN PRIORITÉ » ── LA règle « Dorment » au site Vinted, ses exclusions (vendue,
  // masquée, litige ou retour en cours, compte bloqué ou en pause, compte personnel ou d'achats), son classement. Lecture en
  // cours ⇒ undefined ; ratée ⇒ null (jamais « rien à republier »). Publié pour Aujourd'hui (cet appareil), jamais sur un doute.
  const [nLitiges, majLitiges] = React.useReducer((n) => n + 1, 0);
  React.useEffect(() => abonnerLitiges(majLitiges), []);
  const prio = React.useMemo(() => {
    if (!modele) return modele;
    const roles = load(CLE_ROLES_COMPTES, {}) || {};
    const horsVente = new Set(Object.keys(roles).filter((u) => roles[u] === 'achats'));
    const jv = load(CLE_VUES_LUES, null);
    return republierEnPriorite(modele.articles, { jours: regPrio.jours, parJour: regPrio.parJour, maintenant: Date.now(), cle: cleNum,
      comptesBloques: new Set([...(pauseCB || []), ...(bannisCB || [])].map(String)), comptesPersonnels: comptesPersonnels(roles), comptesHorsVente: horsVente,
      enLitige: enLitigeConnus(), journalVues: jv && jv.a && typeof jv.a === 'object' ? jv.a : null });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modele, regPrio.jours, regPrio.parJour, cleBloques, nLitiges]);
  React.useEffect(() => { if (prio && lectureUtile(lu) && AUTH.user?.id) publierPriorite(prio, { owner: AUTH.user.id }); }, [prio, lu]);
  const qPrio = String(q || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const lignesPrio = prio ? (qPrio ? prio.liste.filter((l) => [l.article.titre, l.numero ? 'n' + l.numero + ' ' + l.numero : '', l.annonce.pseudo].join(' ').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(qPrio)) : prio.liste) : [];
  const selPrio = usePrioSelection(lignesPrio);
  // SON toucher sur « Republier N » : l'atelier Republier du PANNEAU de l'extension, sur vinted.fr, ces annonces cochées. Rien ne part d'ici.
  const republierPrio = ({ ids }) => { const a = ACTIONS_EXTENSION.republier; ouvrirPanneau({ site: 'vinted', page: a.page, ids, action: a.action }); };
  const priorite = {
    n: prio ? prio.liste.length : undefined,
    plein: prio && lignesPrio.length ? <PleinRepublier lignes={lignesPrio} coches={selPrio.coches} onRepublier={republierPrio}/> : null,
    contenu: <RepublierPriorite res={prio} lignes={lignesPrio} coches={selPrio.coches} onBasculer={selPrio.onBasculer} onTout={selPrio.onTout} onReglage={poserRegPrio}
      Photo={(src) => <PhotoVinted src={src} alt="" loading="lazy" decoding="async"/>} Logo={(s) => <LogoSite site={s}/>} euros={(n) => fmt(n)} Icon={Icon}/>,
  };
  // ── (22 nov., Julien — choix n° 35) « PHOTO EN DOUBLE » ── deux annonces Vinted EN LIGNE (l'état que <enligne-regle> a
  // donné, jamais « à confirmer » ni masquées) au MÊME fichier photo (`photoKey`, ou la clé `photoK` de leur fiche). Un
  // signal seulement : rien n'est modifié ni relié. Stock auto (quantité ≥ 2) écarté ; « Ce n'est pas un doublon » mémorisé.
  const photoRes = React.useMemo(() => {
    if (!modele) return modele;
    const annonces = modele.articles.flatMap((a) => a.annonces.filter((x) => x.site === 'vinted' && x.etat === 'enligne'));
    return photosEnDouble({ annonces, fiches: load('vinted_annonce_numeros', {}) || {}, clePhoto: photoKey, cle: cleNum,
      exemplaires: numerosEnExemplaires(load('vinted_bleam', null), cleNum), refus: load(CLE_PHOTO_DOUBLE_NON, {}) || {} });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modele, tic]);
  const pasDoublon = (g) => { if (!g) return; save(CLE_PHOTO_DOUBLE_NON, refuserGroupe(load(CLE_PHOTO_DOUBLE_NON, {}) || {}, g.cle)); setTic((t) => t + 1); };
  const photoDouble = {
    n: photoRes ? photoRes.groupes.length : undefined,
    contenu: <PhotoEnDouble res={photoRes} euros={(n) => fmt(n)} Icon={Icon} onPasDoublon={pasDoublon}
      onAnnonce={(a) => { if (a.numero) { try { window.dispatchEvent(new CustomEvent('vrm:fiche-paire', { detail: String(a.numero) })); } catch (_) {} } else if (a.url) { try { window.open(a.url, '_blank', 'noopener'); } catch (_) {} } }}/>,
  };
  const liste = modele ? trierArticles(filtrerArticles(modele.articles, { ...opts, site: filtre.site, etat: filtre.etat, recherche: q })) : modele;
  const nomSite = (s) => NOM_SITE[s] || s;
  const limites = limitesDe(sites).map((l) => tr('egalite.limite.' + l.quoi, { site: nomSite(l.site) }));
  const manque = lu && lu.manque && lu.manque.length && lu.manque.some((s) => sites.includes(s) || s === 'vinted') ? tr('egalite.pasSu') : '';

  // Écrire un fait : les cartes RELUES maintenant ; `null` (pas lue) ⇒ rien n'est écrit.
  const onFait = async (article, champs) => {
    const lire = (k) => { try { const v = load(k, null); return v && typeof v === 'object' ? v : null; } catch (_) { return null; } };
    const r = opsFait({ article, champs, cartes: { fiches: lire('vinted_annonce_numeros'), faits: lire(CLE_ARTICLES) || {}, parNum: lire('vinted_buyprice_by_num') || {} } });
    if (!r || r.refus) return { refus: (r && r.refus) || 'pas-su' };
    gesteVrm(tr('egalite.enregistre', { quoi: tr('egalite.col.' + (champs.min !== undefined ? 'prixMini' : 'achat')) }), r.ops, {}, () => setTic((t) => t + 1));
    return { ok: true };
  };
  const actions = ACTIONS.map((A) => ({
    cle: A.cle, libelle: tr(A.libelle), icone: A.icone, phrase: A.cle === 'agent' ? tr('agent.action.phrase') : tr('egalite.action.' + cleActionTr[A.cle] + '.phrase'),
    pour: (a) => (A.tousSites ? !!a.numero && a.annonces.some((x) => x.etat === 'enligne') : (() => { const v = vintedDe(a); return !!v && A.etats.includes(v.etat); })()),
    juger: (sel) => {
      if (!sel.length) return { ok: false, raison: tr('egalite.selection.aucune') };
      if (A.robot) { const c = new Set(sel.map((a) => (vintedDe(a) || {}).compte)); if (c.size > 1) return { ok: false, raison: tr('egalite.action.vintedSeul') }; }
      return { ok: true };
    },
  }));
  // (19 nov. soir, « tout doit marcher aussi pour Leboncoin et Vestiaire ») Les gestes que CHAQUE site permet, par les chemins
  // EXISTANTS : le prix sur tous ses sites d'un N° (la feuille « Changer le prix », `vrm:prix-partout` : Vinted, Leboncoin
  // `baisserPrixLbc`, Vestiaire `baisserPrixVestiaire`, chacun avec ses garde-fous) — un article à la fois ; la PAUSE Leboncoin
  // sur son geste CONFIRMÉ (`lbcPause`, une à la fois, la réponse de Leboncoin dite), jamais une suppression.
  const lbcEnLigne = (a) => a.annonces.filter((x) => x.site === 'leboncoin' && x.etat === 'enligne');
  actions.push(
    { cle: 'prixSites', libelle: tr('egalite.action.prixSites'), icone: 'tag', phrase: tr('egalite.action.prixSites.phrase'),
      pour: (a) => !!a.numero && a.annonces.some((x) => x.etat === 'enligne'),
      juger: (sel) => (sel.length === 1 ? { ok: true } : { ok: false, raison: sel.length ? tr('egalite.action.unALaFois') : tr('egalite.selection.aucune') }) },
    // (20 nov., décision de Julien) La pause Leboncoin se fait dans le panneau de l'extension, sur leboncoin.fr.
    { cle: 'pauseLbc', libelle: tr('actionsExt.pause'), icone: 'archive', phrase: tr('actionsExt.phrase', { site: 'Leboncoin' }),
      pour: (a) => lbcEnLigne(a).length > 0,
      juger: (sel) => (!sel.length ? { ok: false, raison: tr('egalite.selection.aucune') } : { ok: true }) });
  const pauserLbc = (choisis) => {
    const ids = choisis.flatMap((a) => lbcEnLigne(a).map((x) => String(x.id)));
    if (!ids.length) return;
    ouvrirPanneau({ site: 'leboncoin', page: 'annonces', ids, action: 'pause' });
  };
  const onAction = (k, choisis) => {
    if (k === 'prixSites') { const a = choisis[0]; if (a && a.numero) { try { window.dispatchEvent(new CustomEvent('vrm:prix-partout', { detail: String(a.numero) })); } catch (_) {} } return; }
    if (k === 'pauseLbc') { pauserLbc(choisis); return; }
    if (k === 'agent') { setAgent(choisis); return; }
    if (k === 'partout') { const nums = choisis.map((a) => a.numero).filter(Boolean); if (nums.length) { try { window.dispatchEvent(new CustomEvent('vrm:publier-partout', { detail: { nums } })); } catch (_) {} } return; }
    const sel = choisis.map(vintedDe).filter(Boolean).map((v) => ({ uid: v.compte, id: v.id }));
    if (!sel.length) { toast(tr('egalite.action.vintedSeul')); return; }
    demanderActionAnnonces(k, sel);
  };
  // (19 nov. soir) Le TABLEAU de l'ordinateur : les articles au site et au compte choisis, chacun avec SON état (`statutTableau`) ;
  // « Dorment » = la règle du segment (`filtrerArticles` etat 'dorment'), au même site et au même compte.
  const cpts = modele ? comptesDesArticles(modele.articles, filtreT.site) : [];
  const cptChoisi = filtreT.compte ? cpts.find((c) => c.cle === filtreT.compte) || null : null;
  const siteT = cptChoisi ? cptChoisi.site : filtreT.site, compteT = cptChoisi ? cptChoisi.compte : '';
  const lignesT = React.useMemo(() => {
    if (!modele) return modele;
    const dort = filtreT.dort === 'dorment' ? new Set(filtrerArticles(modele.articles, { ...opts, site: siteT, compte: compteT, etat: 'dorment' }).map((a) => a.cle)) : null;
    const out = [];
    for (const a of trierArticles(modele.articles)) { if (dort && !dort.has(a.cle)) continue; const st = statutTableau(a, { site: siteT, compte: compteT }); if (st) out.push({ a, statut: st }); }
    return out;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modele, siteT, compteT, filtreT.dort, seuil]);
  // (22 nov.) Le nombre de RANGÉES d'un site (une rangée par article et par compte, `groupesParCompte`, comme le tableau).
  const nRangeesSite = (s) => {
    if (!modele) return null;
    const dort = filtreT.dort === 'dorment' ? new Set(filtrerArticles(modele.articles, { ...opts, site: s, etat: 'dorment' }).map((a) => a.cle)) : null;
    const arts = modele.articles.filter((a) => statutTableau(a, { site: s }) && (!dort || dort.has(a.cle)));
    return groupesParCompte(arts, s).reduce((n, g) => n + g.articles.length, 0);
  };
  const nomCompte = (c) => (c.pseudo || ('#' + c.compte)) + (filtreT.site === 'tous' && sites.length > 1 ? ' · ' + nomSite(c.site) : '');
  const tableau = {
    site: siteT,   // (20 nov.) le site du tableau : les intertitres par compte s'y rangent
    articles: lignesT, majLe, rafraichit: relit, onRafraichir: () => { setRelit(true); setTic((t) => t + 1); },
    compte: cptChoisi ? nomCompte(cptChoisi) : '',
    // (20 nov., précision de Julien) Plus d'entrée « Automatisations » dans Annonces : elles vivent dans l'extension.
    filtres: [
      // (22 nov., Julien : « applique un filtre par plateforme, les filtres ne sont pas précis ») « Site », nommé, à côté de
      // Statut, chaque site avec SON nombre de rangées (tous statuts, Ancienneté appliquée) — la même règle que le tableau.
      ...(sites.length > 1 ? [{ cle: 'site', libelle: tr('tableau.col.site'), valeur: filtreT.site, onChange: (v) => setFiltreT((f) => ({ ...f, site: v, compte: '' })),
        options: [{ cle: 'tous', libelle: tr('egalite.site.tous'), n: nRangeesSite('tous') }, ...SITES.filter((s) => sites.includes(s)).map((s) => ({ cle: s, libelle: nomSite(s), n: nRangeesSite(s) }))] }] : []),
      ...(cpts.length > 1 ? [{ cle: 'compte', libelle: tr('tableau.filtre.compte'), valeur: filtreT.compte || 'tous', onChange: (v) => setFiltreT((f) => ({ ...f, compte: v === 'tous' ? '' : v })),
        options: [{ cle: 'tous', libelle: tr('tableau.tousComptes') }, ...cpts.map((c) => ({ cle: c.cle, libelle: nomCompte(c) }))] }] : []),
      { cle: 'dort', libelle: tr('tableau.filtre.anciennete'), valeur: filtreT.dort, onChange: (v) => { if (v === 'arepublier') { setFiltre((f) => ({ ...f, etat: 'arepublier' })); return; } setFiltreT((f) => ({ ...f, dort: v })); },
        options: [{ cle: 'toutes', libelle: tr('tableau.filtre.toutes') }, { cle: 'dorment', libelle: tr('tableau.filtre.dorment', { n: seuil }) }, { cle: 'arepublier', libelle: tr('egalite.etat.arepublier') }] },
      // (22 nov., choix n° 35) « Photo » : Toutes · Photo en double (le nombre de groupes que la règle signale).
      ...(photoRes && photoRes.groupes.length ? [{ cle: 'photo', libelle: tr('photoDouble.filtre'), valeur: 'toutes', onChange: (v) => { if (v === 'photodouble') setFiltre((f) => ({ ...f, etat: 'photodouble' })); },
        options: [{ cle: 'toutes', libelle: tr('photoDouble.toutes') }, { cle: 'photodouble', libelle: tr('egalite.etat.photodouble'), n: photoRes.groupes.length }] }] : []),
    ],
  };
  // (20 nov.) RELIER DEPUIS LA LISTE — Julien : « on ne peut pas relier des annonces comme ça, on est obligé d'appuyer dessus,
  // regarder la fiche ». L'état du lien et LA proposition de chaque annonce d'un autre site sont LUS (src/liaisonEtat.js, calculés
  // par les règles du parcours) ; SON toucher passe par `relierDepuisListe` (la proposition relue, le geste du parcours).
  const [, majLiaison] = React.useReducer((n) => n + 1, 0);
  React.useEffect(() => { const fin = abonnerLiaison(majLiaison); demanderLiaison(false); return fin; }, []);
  const liaison = {
    de: (a) => {
      const x = a && Array.isArray(a.annonces) ? a.annonces.find((y) => y.site !== 'vinted') : null;
      if (!x) return null;
      const site = NOM_SITE[x.site] || x.site, st = etatLienLu(site, x.id);
      if (st.etat === 'passu') return null;
      return { site, id: String(x.id), etat: st.etat, numero: st.numero, prop: st.etat === 'aRelier' ? propositionLu(site, x.id) : null };
    },
    relier: (l) => { if (l && l.prop) relierDepuisListe({ site: l.site, id: l.id, paireId: l.prop.paireId }); },
    autre: (l) => { if (l) ouvrirLiaison({ site: l.site, id: l.id }); },
    propre: (l) => { if (l) queSurCeSite({ site: l.site, id: l.id }); },
    lot: (ls) => { const cles = ls.filter((l) => l && l.prop && l.prop.niveau === 'sur').map((l) => `${l.site}:${l.id}`); if (cles.length) ouvrirLiaison({ vue: 'lot', cles }); },
    Photo: (src) => <PhotoVinted src={src} alt="" loading="lazy" decoding="async"/>,
  };
  return (
    <>
    <VueAnnonces priorite={priorite} photoDouble={photoDouble} videAction={!accounts.length ? <BoutonNatifAE variante="teinte" onClick={() => { try { window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=vintedaccounts' })); } catch (_) {} }} attrs={{ 'data-ux-vide-geste': 'relier' }}>{tr('uxr.vide.relier')}</BoutonNatifAE> : null} filtreSite={false} Logo={(s) => <LogoSite site={s}/>} dortDe={dortDe} Photo={(src) => <PhotoVinted src={src} alt="" loading="lazy" decoding="async"/>}
      onCompleter={(sujet) => { try { window.dispatchEvent(new CustomEvent('vrm:completer', { detail: { sujet, num: '', lot: false, at: Date.now() } })); } catch (_) {} }} liaison={liaison} travail={tableau} articles={liste} comptes={comptes} filtre={filtre} onFiltre={setFiltre} sites={sites} recherche={q} onRecherche={setQ}
      actions={actions} onAction={onAction} onFait={onFait}
      onPrix={(a) => { if (a.numero) { try { window.dispatchEvent(new CustomEvent('vrm:prix-partout', { detail: String(a.numero) })); } catch (_) {} } }}
      onRelier={(a) => { const x = a.annonces.find((y) => y.site !== 'vinted'); if (x) { try { window.dispatchEvent(new CustomEvent('vrm:liaison-ouvrir', { detail: { site: NOM_SITE[x.site], id: String(x.id), vue: null } })); } catch (_) {} } }}
      onPublier={() => { try { window.dispatchEvent(new CustomEvent('vrm:publier-ailleurs', { detail: {} })); } catch (_) {} }}
      // (19 nov., fiche directe) Un toucher sur un article numéroté ouvre SA fiche complète (par son N°, l'identité de l'article).
      onFiche={(a) => { if (a.numero) { try { window.dispatchEvent(new CustomEvent('vrm:fiche-paire', { detail: String(a.numero) })); } catch (_) {} } }}
      onEcranSite={onEcranSite} limites={limites} manque={manque}
      euros={(n) => fmt(n)} depuisTexte={(ms) => tr('egalite.jours', { n: Math.max(0, Math.floor((Date.now() - ms) / JOUR)) })} nomSite={nomSite} Icon={Icon}/>
    {agent ? <React.Suspense fallback={null}><PublierAgent ouverte articles={agent} onRetour={() => setAgent(null)}/></React.Suspense> : null}
    </>
  );
}
