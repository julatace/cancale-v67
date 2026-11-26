// ── LE PRIX PARTOUT EN UN GESTE (3 novembre 2026, choix de Julien) ──────────
// Depuis la fiche d'un N° : un nouveau prix, la liste des sites où CE N° est en
// ligne, une case par site, et l'état de chacun après envoi.
//
// ⚠️ PAR IDENTITÉ SEULEMENT (§5). Les annonces d'un site ne sont gardées que si
//    leur N° (règle d'identité du site, FOURNIE par l'app — §11) est la clé
//    demandée : l'annonce Vinted par sa fiche (`toutSurLeNumero`), eBay par le
//    SKU `VRM-{n°}` (même chemin), Leboncoin par le lien posé ou la référence
//    VRM (jamais le « nXXX » d'un titre), Vestiaire par le N° donné à son
//    produit. 50 articles au même titre restent 50 articles : seul le N° visé.
// ⚠️ RIEN NE PART SANS SON CLIC (§3). `appliquerPrix` n'est appelée que par le
//    bouton « Appliquer » ; elle n'envoie que les sites COCHÉS, un par un.
//    eBay passe par la route existante (`revise`, `confirme:true`, prix vu) ;
//    Vinted par la commande existante de l'extension (`republierVinted`, PUT en
//    place, capacité `republiermodif`) et SEULEMENT si l'extension de ce Chrome
//    la porte (`extSait` = 'ok'). Leboncoin et Vestiaire : aucune capacité
//    prouvée pour changer un prix ⇒ « À faire sur le site », avec le lien.
// ⚠️ Le prix mini des offres automatiques (fiche Vinted `min`) n'est JAMAIS
//    changé ici : s'il dépasse le nouveau prix, la feuille le dit.
// Module PUR : la feuille (src/PrixPartout.jsx) et `audit-publier-partout.cjs` (section P).
//
// (11 nov. soir, validé par Julien : « un prix modifié dans VRM change partout »)
//   · le prix TAPÉ est celui de l'annonce Vinted ; chaque autre site reçoit SON
//     ajustement réglé dans « Publier partout » (`vrm_partout_prix`, src/publierPartout.js :
//     ± € / ± % ; Vestiaire = le prix tapé) — `prixParSite` ;
//   · eBay : la route `revise`, puis le prix RELU chez eBay (`regle.lecture.prix`) :
//     relu = demandé ⇒ « fait ✓ relu » ; relu autre ⇒ « pas sûr » avec le prix vu ;
//     pas relu ⇒ « fait » sans « relu » (jamais supposé) ;
//   · (jusqu'au 19 nov.) Vinted : VRM PROPOSAIT (second bouton « Baisser sur Vinted ») ;
//     Leboncoin, Vestiaire : « à faire sur le site ».
//
// ⚠️⚠️ (19 nov., décision de Julien sur une capture de son iPhone, N°134, 59 → 58 :
//   « ce genre de fonctionnalité qui pue, tu me les enlèves tout de suite : c'est à
//   l'extension de baisser les prix, c'est pas à moi ») — « APPLIQUER » EST SON CLIC :
//   · Vinted, Leboncoin, Vestiaire (mode 'ext') : la BAISSE part tout de suite par le
//     chemin d'extension existant (`baisserPrixVinted` / `lbcPrix` / `vcPrix`, le prix
//     VU joint, confirmée — aucun garde-fou retiré) ; « fait » seulement RELU ;
//   · l'extension ne peut pas agir MAINTENANT (iPhone, autre compte dans l'onglet, pas
//     d'onglet, plafond, pause, pas de réponse) ⇒ la baisse ATTEND (une ligne
//     `cmd_prix_*`, src/prixAttente.js) et part seule dès qu'un de ses navigateurs
//     ouvre le site sur ce compte ; état « attente », AUCUN second bouton ;
//   · une HAUSSE : les chemins de baisse la refusent exprès (seule la remise d'un solde
//     remonte un prix, §3) — état « hausse », avec « Ouvrir », aucune commande ;
//   · plus d'état intermédiaire où il devrait confirmer ailleurs, plus de « à faire sur
//     le site » pour un geste que l'extension sait faire. Ne PAS les remettre.
import { prixPourSite, reglagePrix } from './publierPartout.js';
import { prixAttIssue, prixAttCents } from './prixAttente.js';

const str = (v) => String(v == null ? '' : v).trim();
const arr = (a) => (Array.isArray(a) ? a : []);

// Le prix tapé : des euros, au plus 2 décimales, au moins un centime, moins de
// 100 000 €. « 72 », « 72,5 », « 72.50 » ⇒ 72 / 72.5 ; « 72 € », « 1.250 »,
// « 0 », « -5 », « 1e3 » ⇒ null (rien ne part). La règle de `prixLu` (eBay).
export function prixTape(v) {
  const s = str(v).replace(',', '.');
  if (!/^\d{1,5}(?:\.\d{1,2})?$/.test(s)) return null;
  const n = Math.round(Number(s) * 100) / 100;
  return n >= 0.01 && n < 100000 ? n : null;
}
const montant = (p) => {
  if (p == null || p === '') return null;
  const n = Number(typeof p === 'object' ? p.amount : String(p).replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
};

export const SITES_PRIX = ['vinted', 'ebay', 'leboncoin', 'vestiaire'];
export const NOM_SITE = { vinted: 'Vinted', ebay: 'eBay', leboncoin: 'Leboncoin', vestiaire: 'Vestiaire' };

// Les sites où le N° `cle` est EN LIGNE.
//   rn          sortie de `toutSurLeNumero` (annonces Vinted, annonces eBay)
//   fiches      `vinted_annonce_numeros` (le prix mini `min` par annonce)
//   lbcItems    `lbc_listings.data.items` (null = pas su)
//   vcItems     `vc_listings.data.items` (null = pas su)
//   o           { cleNum, numLbc(ad, id), numVc(id), recettes: { leboncoin, vestiaire }, formats: { [idVinted]: bool } }
//               (`recettes` : true apprise · false PAS apprise · null/absent pas su)
//               (`formats` : l'extension ne baisse un prix Vinted qu'en rejouant le corps que Vinted a ACCEPTÉ pour
//                CETTE annonce (`vrm_vinted_modele`, appris quand il l'enregistre sur vinted.fr ou que VRM la crée) ;
//                false = jamais appris ⇒ dit AVANT d'appliquer, aucune commande ; absent = pas su ⇒ on essaie.
//                ⚠️ MESURÉ le 19 nov. (lecture seule) : 31 annonces en ligne sur 198 ont ce format. C'est LA limite
//                qui reste — docs/passation/2026-11-19-prix-sans-manuel.md §« Ce qui reste à la main ».)
// Rend { sites: [...], manques: [...] } — une source non lue est NOMMÉE dans
// `manques`, jamais prise pour « pas en ligne ».
export function sitesDuNumero(cle, { rn, fiches, lbcItems, vcItems } = {}, o = {}) {
  const k = o.cleNum ? o.cleNum(cle) : str(cle);
  const sites = [], manques = [];
  if (!k) return { sites, manques: ['le numéro'] };
  const meme = (v) => v != null && str(v) !== '' && (o.cleNum ? o.cleNum(v) : str(v)) === k;
  // Vinted : les annonces EN LIGNE de la fiche de ce N° (masquée ou « à confirmer » : pas d'envoi).
  if (!rn || !Array.isArray(rn.annonces) || (rn.manques || []).includes('tes annonces en ligne')) manques.push('Vinted');
  else for (const a of rn.annonces) {
    if (!a || a.etat !== 'en-ligne') continue;
    const f = fiches && fiches[String(a.id)];
    if (f && f.numero != null && !meme(f.numero)) continue;            // la fiche dit autre chose : on ne touche pas
    const mini = f ? montant(f.min) : null;
    // (19 nov.) Vinted : la baisse part par l'extension sur « Appliquer » (mode 'ext'), ou attend.
    const compteOk = a.accountId != null && /^\d+$/.test(String(a.accountId));
    const prixLu = montant(a.price);
    const sansFormat = !!(o.formats && o.formats[String(a.id)] === false);
    sites.push({ cle: 'vinted:' + a.id, site: 'vinted', id: String(a.id), compte: a.accountId != null ? String(a.accountId) : null,
      titre: a.title || '', prix: prixLu, mini, mode: compteOk && prixLu != null && !sansFormat ? 'ext' : 'site',
      raison: !compteOk ? 'compte introuvable' : prixLu == null ? 'prix actuel pas lu' : sansFormat ? 'format' : null,
      lien: `https://www.vinted.fr/items/${encodeURIComponent(String(a.id))}` });
  }
  // eBay : les annonces dont le SKU désigne ce N° (`numEbayAnnonce`, déjà appliqué par `toutSurLeNumero`).
  if (!rn || (rn.manques || []).includes('tes annonces eBay')) manques.push('eBay');
  else for (const a of arr(rn.annoncesEbay)) {
    if (!a || a.itemId == null) continue;
    const devise = str(a.currency || (a.detail && a.detail.currency) || 'EUR').toUpperCase();
    const euros = devise === 'EUR';
    sites.push({ cle: 'ebay:' + a.itemId, site: 'ebay', id: String(a.itemId), compte: a._compte || null, titre: a.title || '',
      prix: montant(a.price), devise, mode: euros && montant(a.price) != null ? 'app' : 'site',
      raison: !euros ? `annonce en ${devise}` : montant(a.price) == null ? 'prix actuel pas lu' : null,
      lien: `https://www.ebay.fr/itm/${encodeURIComponent(String(a.itemId))}` });
  }
  // Leboncoin : identité = lien posé à la main ou référence VRM (`numLbc`).
  if (lbcItems == null) manques.push('Leboncoin');
  else for (const [id, ad] of Object.entries(lbcItems)) {
    if (!ad || str(ad.status).toLowerCase() !== 'active') continue;
    if (!meme(o.numLbc ? o.numLbc(ad, id) : null)) continue;
    const url = /^https:\/\/(www\.)?leboncoin\.fr\//i.test(str(ad.url)) ? str(ad.url) : `https://www.leboncoin.fr/ad/${encodeURIComponent(id)}`;
    // (19 nov.) Leboncoin : le même geste (`lbcPrix`, recette APPRISE). Recette connue PAS apprise ⇒ dit, une phrase.
    const pl = montant(ad.price), rl = o.recettes ? o.recettes.leboncoin : null;
    // (24 nov., agir-si-connecte) le compte de l'annonce, par SON identité (`account` / `lbcUser`, « lbc-account: » retiré) : la porte le juge.
    const compteL = str(ad.account || ad.lbcUser).replace(/^lbc-account:/i, '') || null;
    sites.push({ cle: 'leboncoin:' + id, site: 'leboncoin', id: String(id), compte: compteL, titre: ad.subject || ad.title || '', prix: pl,
      mode: pl != null && rl !== false && /^\d{6,12}$/.test(String(id)) ? 'ext' : 'site', raison: pl == null ? 'prix actuel pas lu' : rl === false ? 'recette' : null, lien: url });
  }
  // Vestiaire : le N° donné au produit (`numVc`).
  if (vcItems == null) manques.push('Vestiaire');
  else for (const [id, it] of Object.entries(vcItems)) {
    if (!it || !/^(published|online|active)$/i.test(str(it.statut))) continue;
    if (!meme(o.numVc ? o.numVc(id, it) : null)) continue;
    // (19 nov.) Vestiaire : le même geste (`vcPrix`, recette APPRISE).
    const pv = montant(it.prix && typeof it.prix === 'object' ? it.prix.valeur : it.prix), rv = o.recettes ? o.recettes.vestiaire : null;
    sites.push({ cle: 'vestiaire:' + id, site: 'vestiaire', id: String(id), compte: str(it.compte) || null, titre: it.titre || '', prix: pv,
      mode: pv != null && rv !== false && /^\d{3,15}$/.test(String(id)) ? 'ext' : 'site', raison: pv == null ? 'prix actuel pas lu' : rv === false ? 'recette' : null, lien: 'https://fr.vestiairecollective.com/' });
  }
  return { sites, manques };
}

// Les prix mini (offres auto Vinted) qui dépassent le nouveau prix : dits, jamais changés.
export const minisAuDessus = (sites, prix) => arr(sites).filter((s) => s.site === 'vinted' && s.mini != null && prix != null && s.mini > prix)
  .map((s) => ({ cle: s.cle, mini: s.mini }));

// L'ENVOI — sur le clic « Appliquer » seulement. `coches` : Set des `cle` cochées.
// `envoyer` : { vinted, leboncoin, vestiaire, ebay }(site, prix) → { etat: 'fait'|'refuse'|'incertain'|'attente', raison }.
// Rend { [cle]: { etat: 'fait'|'refuse'|'incertain'|'attente'|'hausse'|'a-faire'|'ignore', raison } }.
// Un site en mode 'site' n'est jamais envoyé (compte introuvable, prix pas lu, recette pas apprise).
// Le prix de CHAQUE site pour un prix tapé (celui de Vinted) : l'ajustement réglé
// (`vrm_partout_prix`) ; null ⇒ le réglage donne 0 € ou moins (rien ne part).
export function prixParSite(site, p, reglage) {
  const n = prixTape(p);
  if (n == null) return null;
  if (site === 'vinted') return n;
  const r = reglagePrix(reglage)[site];
  return r ? prixPourSite(n, r) : n;
}
// `reglage` : `vrm_partout_prix` (absent ⇒ le même prix partout).
// États : envoi · fait (relu: true quand le site l'a RELU au prix demandé) ·
// refuse · incertain · attente (la baisse est rangée, elle part seule : `idCmd`, `compte`) ·
// hausse (à faire sur le site, « Ouvrir ») · a-faire (ce que VRM ne peut pas faire) · ignore.
export async function appliquerPrix({ sites, coches, prix, envoyer = {}, surEtat, reglage = null, gardeConfirme = null } = {}) {
  const p = prixTape(prix);
  const res = {};
  if (p == null) return { erreur: 'prix', res };
  const dire = (cle, e) => { res[cle] = e; if (surEtat) surEtat(cle, e); };
  for (const s of arr(sites)) {
    if (!coches || !coches.has(s.cle)) { res[s.cle] = { etat: 'ignore', raison: null }; continue; }
    const cible = prixParSite(s.site, p, reglage);
    if (cible == null) { dire(s.cle, { etat: 'refuse', raison: 'ton réglage de prix pour ce site donne 0 € ou moins', prix: null }); continue; }
    const meme = s.prix != null && Math.round(s.prix * 100) === Math.round(cible * 100);
    if (meme) { dire(s.cle, { etat: 'fait', raison: 'déjà à ce prix', inchange: true, prix: cible }); continue; }
    // Une HAUSSE par l'extension : jamais (les chemins de baisse la refusent, §3). Aucune commande, aucune attente.
    if (s.mode === 'ext' && s.prix != null && cible > s.prix) { dire(s.cle, { etat: 'hausse', raison: null, prix: cible }); continue; }
    if ((s.mode !== 'app' && s.mode !== 'ext') || typeof envoyer[s.site] !== 'function') { dire(s.cle, { etat: 'a-faire', raison: s.raison || null, prix: cible }); continue; }
    if (surEtat) surEtat(s.cle, { etat: 'envoi', prix: cible });
    let r;
    // (21 nov., 5.432) le prix qu'il a confirmé à la garde (centimes) voyage avec l'envoi ; le serveur le revérifie.
    try { r = await envoyer[s.site](s, cible, gardeConfirme ? gardeConfirme[s.cle] : undefined); } catch (_) { r = { etat: 'incertain', raison: 'pas de réponse' }; }
    // (19 nov.) La baisse ATTEND (rangée dans sa base) : dite telle quelle, sans geste demandé.
    if (r && r.etat === 'attente') { dire(s.cle, { etat: 'attente', raison: null, prix: cible, idCmd: r.idCmd || null, compte: r.compte || null, maj: !!r.maj }); continue; }
    let etat = r && (r.etat === 'fait' || r.etat === 'refuse' || r.etat === 'incertain') ? r.etat : 'incertain';
    let raison = (r && r.raison) || null;
    // Relu après : le prix que le site MONTRE. Autre que demandé ⇒ « pas sûr », dit.
    const relu = r && r.prixRelu != null && Number.isFinite(Number(r.prixRelu)) ? Math.round(Number(r.prixRelu) * 100) / 100 : null;
    if (etat === 'fait' && relu != null && Math.round(relu * 100) !== Math.round(cible * 100)) { etat = 'incertain'; raison = `le site montre ${String(relu).replace('.', ',')} €`; }
    dire(s.cle, { etat, raison, prix: cible, relu: etat === 'fait' && relu != null, ...(relu != null ? { prixRelu: relu } : {}), ...(r && r.code ? { code: r.code } : {}) });
  }
  return { prix: p, res };
}
// La feuille se ferme-t-elle toute seule après « Appliquer » ? Oui quand chaque site coché
// est FAIT ou EN ATTENTE (rien à lire) ; elle reste ouverte dès qu'il y a un refus, un
// « pas sûr », une hausse ou un « à faire » à lire.
export function toutEstDit(res) {
  const l = Object.values(res || {}).filter((e) => e && e.etat !== 'ignore');
  return l.length > 0 && l.every((e) => e.etat === 'fait' || e.etat === 'attente');
}

// Le journal des prix (`vrm_prix_journal`, synchronisé) : une ligne par
// application, pour CE N°, avec le site seulement s'il est FAIT (relu par
// l'historique de l'article). `journal` : { [cle]: [{ at, prix, sites }] }.
export function noterJournalPrix(journal, cle, prix, sites, res, maintenant = new Date().toISOString()) {
  const j = journal && typeof journal === 'object' && !Array.isArray(journal) ? { ...journal } : {};
  const faits = arr(sites).filter((s) => res && res[s.cle] && res[s.cle].etat === 'fait' && !res[s.cle].inchange).map((s) => ({ site: s.site, id: s.id, avant: s.prix }));
  if (!faits.length || !str(cle)) return j;
  const l = arr(j[cle]).slice(-49);
  l.push({ at: maintenant, prix, sites: faits });
  j[cle] = l;
  return j;
}

// Les envois, construits avec les règles de l'app (§11) : `appelEbay` (route
// `revise`, confirmée, au prix VU), `resultatReviseEbay` (trois issues),
// `corpsCompteEbay`, `vmrCmdSuivi` (la commande de baisse de l'extension : UNE par
// annonce, le prix vu joint, confirmée) et, quand l'extension ne peut pas agir
// maintenant, `deposer` (la ligne `cmd_prix_*`, src/prixAttente.js).
//   dep.ici(site)        cette app a-t-elle ICI une extension qui sait baisser sur ce site ?
//                        (faux ⇒ rien n'est tenté d'ici : la baisse est rangée tout de suite)
//   dep.deposer(c)       range la commande { site, uid, id, prix, prixAvant } ; rend { id } ou null
//   dep.saitAttendre()   une extension qui sait relever les prix en attente est-elle connue ?
// Trois issues d'une commande, jamais deux : la réponse · `{ envoye: false }` (rien n'est
// parti d'ici) · `{ sansReponse: true }` (partie, pas de réponse : PAS SU). Dans les deux
// derniers cas la baisse est RANGÉE : l'extension relit le prix avant d'agir, donc une
// baisse déjà faite n'est jamais refaite (elle lit le prix voulu et répond « fait »).
export function envoisPrix(dep) {
  const parExtension = (site, cmdDe) => async (s, p) => {
    if (site === 'vinted' && !s.compte) return { etat: 'refuse', raison: 'compte introuvable' };
    let r = null;
    if (!dep.ici || dep.ici(site)) { try { r = await dep.vmrCmdSuivi(cmdDe(s, p), 120000); } catch (_) { r = null; } }
    else r = { accepte: false, envoye: false };
    if (r && r.horsLigne) return { etat: 'refuse', raison: r.error || null, code: 'hors-ligne' };
    // « Deux extensions » ou « code périmé » (dits par le pont de l'app, pas par le chemin de baisse) : rien n'est parti.
    const pasParti = !r || r.envoye === false || r.sansReponse === true || (r.accepte === false && (r.code === 'plusieurs' || (r.code === 'perime' && !('prixVu' in r))));
    const i = pasParti ? { etat: 'attendre', code: r && r.sansReponse ? 'sans-reponse' : 'absente' } : prixAttIssue(site, r, prixAttCents(p));
    if (i.etat !== 'attendre') return { etat: i.etat, raison: i.raison || null, prixRelu: i.prixVu == null ? null : i.prixVu, code: i.code || '' };
    let d = null;
    try { d = dep.deposer ? await dep.deposer({ site, uid: s.compte || '', id: s.id, prix: p, prixAvant: s.prix }) : null; } catch (_) { d = null; }
    if (!d) return r && r.sansReponse ? { etat: 'incertain', raison: dep.sansReponse || 'pas de réponse', code: 'sans-reponse' } : { etat: 'refuse', raison: null, code: 'base' };
    return { etat: 'attente', idCmd: d.id, compte: s.compte || null, maj: dep.saitAttendre ? !dep.saitAttendre() : false, code: i.code || '' };
  };
  return {
    ebay: async (s, p, gc) => {
      const brut = await dep.appelEbay({ action: 'revise', itemId: s.id, price: String(p), prixVu: s.prix, confirme: true, ...(Number.isInteger(gc) ? { gardeConfirmeC: gc } : {}), ...dep.corpsCompteEbay(s.compte) });
      const r = dep.resultatReviseEbay(brut);
      // La route relit l'annonce après l'écriture (GetItem) : son prix, s'il est lu.
      const lu = brut && brut.j && brut.j.regle && brut.j.regle.lecture ? brut.j.regle.lecture.prix : null;
      return { etat: r.etat === 'ok' ? 'fait' : r.etat === 'ko' ? 'refuse' : 'incertain', raison: r.msg || null, prixRelu: lu == null ? null : lu };
    },
    vinted: parExtension('vinted', (s, p) => ({ cmd: 'baisserPrixVinted', uid: s.compte, id: s.id, prix: p, prixAvant: s.prix, confirme: true })),
    leboncoin: parExtension('leboncoin', (s, p) => ({ cmd: 'lbcPrix', id: String(s.id), prix: Number(p), prixAvant: Number(s.prix), confirme: true })),
    vestiaire: parExtension('vestiaire', (s, p) => ({ cmd: 'vcPrix', produit: String(s.id), avantCents: prixAttCents(s.prix), apresCents: prixAttCents(p), confirme: true })),
  };
}
