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
//   · Vinted : VRM PROPOSE (mode 'propose') — la feuille « Baisser le prix » existante
//     s'ouvre sur CETTE annonce au nouveau prix, et c'est SON clic là-bas qui envoie ;
//     une hausse ne se propose pas (« à faire sur le site ») ;
//   · Leboncoin, Vestiaire : toujours « à faire sur le site », avec le prix À METTRE.
import { prixPourSite, reglagePrix } from './publierPartout.js';

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
//   o           { cleNum, numLbc(ad, id), numVc(id), capVinted ('ok'|'retard'|'absente') }
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
    // (11 nov. soir) Vinted : VRM PROPOSE (« Baisser le prix », son clic) — jamais envoyé d'ici.
    const compteOk = a.accountId != null && /^\d+$/.test(String(a.accountId));
    sites.push({ cle: 'vinted:' + a.id, site: 'vinted', id: String(a.id), compte: a.accountId != null ? String(a.accountId) : null,
      titre: a.title || '', prix: montant(a.price), mini, mode: compteOk ? 'propose' : 'site',
      raison: compteOk ? null : 'compte introuvable',
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
    sites.push({ cle: 'leboncoin:' + id, site: 'leboncoin', id: String(id), titre: ad.subject || ad.title || '', prix: montant(ad.price),
      mode: 'site', raison: 'pas de changement de prix depuis VRM', lien: url });
  }
  // Vestiaire : le N° donné au produit (`numVc`).
  if (vcItems == null) manques.push('Vestiaire');
  else for (const [id, it] of Object.entries(vcItems)) {
    if (!it || !/^(published|online|active)$/i.test(str(it.statut))) continue;
    if (!meme(o.numVc ? o.numVc(id, it) : null)) continue;
    sites.push({ cle: 'vestiaire:' + id, site: 'vestiaire', id: String(id), titre: it.titre || '', prix: montant(it.prix && typeof it.prix === 'object' ? it.prix.valeur : it.prix),
      mode: 'site', raison: 'pas de changement de prix depuis VRM', lien: 'https://fr.vestiairecollective.com/' });
  }
  return { sites, manques };
}

// Les prix mini (offres auto Vinted) qui dépassent le nouveau prix : dits, jamais changés.
export const minisAuDessus = (sites, prix) => arr(sites).filter((s) => s.site === 'vinted' && s.mini != null && prix != null && s.mini > prix)
  .map((s) => ({ cle: s.cle, mini: s.mini }));

// L'ENVOI — sur le clic « Appliquer » seulement. `coches` : Set des `cle` cochées.
// `envoyer` : { vinted(site, prix), ebay(site, prix) } → { etat: 'fait'|'refuse'|'incertain', raison }.
// Rend { [cle]: { etat: 'fait'|'refuse'|'incertain'|'a-faire'|'ignore', raison } }.
// Un site en mode 'site' n'est jamais envoyé : « À faire sur le site ».
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
// refuse · incertain · a-faire (le prix à mettre sur le site) · propose (Vinted :
// la feuille « Baisser le prix » s'ouvre, son clic) · ignore.
export async function appliquerPrix({ sites, coches, prix, envoyer = {}, surEtat, reglage = null } = {}) {
  const p = prixTape(prix);
  const res = {};
  if (p == null) return { erreur: 'prix', res };
  const dire = (cle, e) => { res[cle] = e; if (surEtat) surEtat(cle, e); };
  for (const s of arr(sites)) {
    if (!coches || !coches.has(s.cle)) { res[s.cle] = { etat: 'ignore', raison: null }; continue; }
    const cible = prixParSite(s.site, p, reglage);
    if (cible == null) { dire(s.cle, { etat: 'refuse', raison: 'ton réglage de prix pour ce site donne 0 € ou moins', prix: null }); continue; }
    const meme = s.prix != null && Math.round(s.prix * 100) === Math.round(cible * 100);
    if (s.mode === 'propose') {
      if (meme) { dire(s.cle, { etat: 'fait', raison: 'déjà à ce prix', inchange: true, prix: cible }); continue; }
      if (s.prix != null && cible > s.prix) { dire(s.cle, { etat: 'a-faire', raison: 'une hausse se fait sur Vinted', prix: cible }); continue; }
      dire(s.cle, { etat: 'propose', raison: null, prix: cible, avant: s.prix }); continue;
    }
    if (s.mode !== 'app' || typeof envoyer[s.site] !== 'function') { dire(s.cle, { etat: 'a-faire', raison: s.raison || null, prix: cible }); continue; }
    if (meme) { dire(s.cle, { etat: 'fait', raison: 'déjà à ce prix', inchange: true, prix: cible }); continue; }
    if (surEtat) surEtat(s.cle, { etat: 'envoi', prix: cible });
    let r;
    try { r = await envoyer[s.site](s, cible); } catch (_) { r = { etat: 'incertain', raison: 'pas de réponse' }; }
    let etat = r && (r.etat === 'fait' || r.etat === 'refuse' || r.etat === 'incertain') ? r.etat : 'incertain';
    let raison = (r && r.raison) || null;
    // Relu après : le prix que le site MONTRE. Autre que demandé ⇒ « pas sûr », dit.
    const relu = r && r.prixRelu != null && Number.isFinite(Number(r.prixRelu)) ? Math.round(Number(r.prixRelu) * 100) / 100 : null;
    if (etat === 'fait' && relu != null && Math.round(relu * 100) !== Math.round(cible * 100)) { etat = 'incertain'; raison = `le site montre ${String(relu).replace('.', ',')} €`; }
    dire(s.cle, { etat, raison, prix: cible, relu: etat === 'fait' && relu != null });
  }
  return { prix: p, res };
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
// `corpsCompteEbay`, `vmrCmdSuivi` (commande `republierVinted` de l'extension,
// PUT en place, confirmée) et le texte « pas de réponse ».
export function envoisPrix(dep) {
  return {
    ebay: async (s, p) => {
      const brut = await dep.appelEbay({ action: 'revise', itemId: s.id, price: String(p), prixVu: s.prix, confirme: true, ...dep.corpsCompteEbay(s.compte) });
      const r = dep.resultatReviseEbay(brut);
      // La route relit l'annonce après l'écriture (GetItem) : son prix, s'il est lu.
      const lu = brut && brut.j && brut.j.regle && brut.j.regle.lecture ? brut.j.regle.lecture.prix : null;
      return { etat: r.etat === 'ok' ? 'fait' : r.etat === 'ko' ? 'refuse' : 'incertain', raison: r.msg || null, prixRelu: lu == null ? null : lu };
    },
    vinted: async (s, p) => {
      if (!s.compte) return { etat: 'refuse', raison: 'compte introuvable' };
      const r = await dep.vmrCmdSuivi({ cmd: 'republierVinted', uid: s.compte, id: s.id, prix: p, confirme: true }, 60000);
      if (!r || r.sansReponse) return { etat: 'incertain', raison: dep.sansReponse || 'pas de réponse' };
      if (r.accepte && r.etape === 'fait') return { etat: 'fait', raison: null };
      return { etat: 'refuse', raison: r.raison || r.error || "l'extension n'a pas répondu" };
    },
  };
}
