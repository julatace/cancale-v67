// ── LA FICHE COMPLÈTE D'UNE PAIRE : SON PARCOURS (1er nov., maquette validée) ─
// Achat → Stock → Annonce(s) → Vente → Colis → Argent, raconté À PARTIR DE CE
// QUE « Tout sur le N° » A TROUVÉ PAR IDENTITÉ (`toutSurLeNumero`,
// src/rechercheNumero.js) : le N° par sa clé (`cleNum`), la vente Vinted par sa
// transaction (→ `item_id` → la fiche de CETTE annonce), eBay par le SKU,
// Leboncoin par le lien ou la référence. Jamais un titre, jamais une
// ressemblance : 50 paires au même titre restent 50 paires (§5).
// Chaque étape a TROIS états : 'fait' (lu, et c'est arrivé) · 'passu' (la
// lecture a manqué : « — » et la raison) · 'absent' (lu, ça n'est pas — ou pas
// encore — arrivé : grisé, jamais inventé).
// Les règles de l'app (étiquette d'une vente, argent eBay…) sont FOURNIES par
// l'appelant (§11) ; le bénéfice est `beneficePaire` (src/beneficePaire.js),
// le même que l'écran Ventes. Module PUR : l'écran et le banc `fiche-paire.cjs`.
import { beneficePaire, centimes, champsCharges } from './beneficePaire.js';
import { origineDuPrix } from './fournisseurs.js';

const str = (v) => String(v == null ? '' : v).trim();

// L'entrée comptable d'une vente : la fiche de l'annonce, corrigée par ce qui a
// été posé SUR LA VENTE (`vinted_sale_overrides`), puis le prix d'achat retrouvé
// par N° (`vinted_buyprice_by_num`). C'est la fusion d'`effEntry` (écran Ventes) :
// l'écran l'appelle aussi — une seule règle.
export function fusionEntreeVente(base, ov, buyByNum) {
  const avecPrixParNum = (e) => {
    if (!e || e.numero == null) return e;
    if (e.buyPrice != null && String(e.buyPrice).trim() !== '') return e;
    const bn = buyByNum ? buyByNum[String(e.numero).trim()] : null;
    return (bn != null && String(bn).trim() !== '') ? { ...e, buyPrice: bn } : e;
  };
  if (!ov) return avecPrixParNum(base);
  const m = { ...(base || {}) };
  if (ov.numero != null && ov.numero !== '') m.numero = ov.numero;
  if (ov.buyPrice != null && ov.buyPrice !== '') m.buyPrice = ov.buyPrice;
  if (ov.fees != null && ov.fees !== '') m.fees = ov.fees;
  for (const [k] of champsCharges) if (ov[k] != null && ov[k] !== '') m[k] = ov[k];
  if (ov.fraisComplets != null) m.fraisComplets = ov.fraisComplets;
  if (ov.buyFromId) { m.buyFromId = ov.buyFromId; m.buyFrom = ov.buyFrom || m.buyFrom; }
  return avecPrixParNum(m);
}

const ETAT_ANN = { 'en-ligne': 'en ligne', 'a-confirmer': 'à confirmer (lecture ancienne)', masquee: 'masquée par Vinted', 'plus-en-ligne': 'plus en ligne', passu: 'pas encore lue' };

// rn : le résultat de `toutSurLeNumero` · d : { fiches, saleOv, buyByNum,
//   stats ({ [idAnnonce]: { vues, favoris } } ou null = pas lu), versements
//   ({ [tx]: iso } ou null = pas lu), nomCompte(uid) }
// o : { etapeVente(vente) → { label, step }, venteAnnulee(vente), montantRecuEbay(c)
//   → { eur, raison }, commandeEbayEngagee(c), lbcAnnulee(v), lbcFinalisee(v) }
export function parcoursPaire(rn, d = {}, o = {}) {
  if (!rn || rn.etat === 'invalide') return null;
  const fiches = d.fiches || null;
  const saleOv = d.saleOv || {};
  const manque = (s) => (rn.manques || []).includes(s);
  const { vinted = [], lbc = [], ebay = [] } = rn.ventes || {};
  const annulee = (v) => !!(o.venteAnnulee && o.venteAnnulee(v));
  // La vente qui raconte la paire : la plus récente qui n'est pas annulée,
  // sinon la plus récente (une vente annulée puis revendue : la revente).
  const parDate = (a, b) => (Date.parse(b.date || '') || 0) - (Date.parse(a.date || '') || 0);
  const vVinted = vinted.slice().sort(parDate);
  const venteV = vVinted.find((v) => !annulee(v)) || vVinted[0] || null;
  const venteE = ebay.find((c) => !o.commandeEbayEngagee || o.commandeEbayEngagee(c)) || null;
  const venteL = lbc.find((v) => !(o.lbcAnnulee && o.lbcAnnulee(v))) || null;

  // La fiche de LA paire : celle de l'annonce vendue (par la transaction), sinon
  // une fiche qui porte ce N° — celle qui a un prix d'achat d'abord.
  const idsN = rn.annonces.map((a) => a.id);
  let idFiche = venteV && venteV._item && fiches && fiches[venteV._item] ? venteV._item : null;
  if (!idFiche && fiches) idFiche = idsN.find((id) => fiches[id] && str(fiches[id].buyPrice)) || idsN.find((id) => fiches[id]) || null;
  const fiche = idFiche && fiches ? fiches[idFiche] : null;
  const entree = fusionEntreeVente(fiche ? { ...fiche } : (venteV ? { numero: rn.cle } : null), venteV ? saleOv[String(venteV._tx)] : null, d.buyByNum);
  const annonce = rn.annonces.find((a) => a.id === idFiche) || rn.annonces[0] || null;
  const titre = (venteV && venteV.title) || (annonce && annonce.title) || (fiche && fiche.title) || (venteE && ((venteE.lineItems || [])[0] || {}).title) || (venteL && venteL.title) || '';
  const etapes = [];

  // 1. ACHAT
  const achatC = entree ? centimes(entree.buyPrice) : null;
  if (fiches == null) etapes.push({ cle: 'achat', etat: 'passu', titre: 'Achat', detail: 'tes fiches numérotées pas encore lues' });
  else if (entree && entree.buyFrom && (entree.buyFromId || entree.buyFrom.title)) {
    const b = entree.buyFrom;
    // (5 nov., revue) `buyFromId` porté par l'étape : le lien peut venir de la
    // VENTE (`vinted_sale_overrides`), pas seulement de la fiche — « Voir l'état »
    // et l'histoire lisent CET achat-là (jamais « saisi à la main » à tort).
    etapes.push({ cle: 'achat', etat: 'fait', titre: 'Achetée sur Vinted', date: b.date || null, montant: achatC, buyFromId: entree.buyFromId ? String(entree.buyFromId) : null,
      detail: [b.seller ? `vendeur « ${b.seller} »` : null, b.account || null, entree.buyFromId ? 'achat relié par son n° de transaction' : null].filter(Boolean).join(' · ') });
  } else if (achatC != null && entree.buyGros && origineDuPrix(entree, entree.buyGros.id).etat === 'lot') {
    // (5 nov., intégration) La part d'un ACHAT EN GROS reliée par SON clic
    // (Achats → Fournisseurs, `buyGros`) : la règle de Fournisseurs
    // (`origineDuPrix`) dit si le prix est encore celui du lot — jamais « saisi à
    // la main » à tort. Un prix retapé ensuite redevient « saisi à la main ».
    etapes.push({ cle: 'achat', etat: 'fait', titre: 'Achat en gros', montant: achatC, gros: true, detail: 'part d’un achat en gros relié par ton clic (Fournisseurs)' });
  } else if (achatC != null) etapes.push({ cle: 'achat', etat: 'fait', titre: 'Achat', montant: achatC, detail: 'prix saisi à la main · achat pas relié' });
  else etapes.push({ cle: 'achat', etat: 'absent', titre: 'Achat', detail: 'prix d’achat pas saisi' });

  // 2. STOCK
  // (9 nov., zéro banc rouge) `d.sortieStock` : l'entrée du journal `vrm_stock_sortis` de CE N°
  // (sa case libérée quand Vinted a dit le colis parti — décision de Julien, le N° reste) :
  // l'histoire dit où elle ÉTAIT rangée et qu'elle en est sortie, jamais « pas rangée ».
  const so = !rn.stock && d.sortieStock && typeof d.sortieStock === 'object' ? d.sortieStock : null;
  if (rn.stock) etapes.push({ cle: 'stock', etat: 'fait', titre: 'Rangée', detail: [rn.stock.roomName, rn.stock.itemName, rn.stock.nom].filter(Boolean).join(' · ') });
  else if (so && (so.itemName || so.nom)) etapes.push({ cle: 'stock', etat: 'fait', titre: 'Rangée', sortie: true, date: Number.isFinite(so.at) ? new Date(so.at).toISOString() : null,
    detail: [so.roomName, so.itemName, so.nom].filter(Boolean).join(' · ') + ' · sa place est libérée (colis parti)' });
  else if (manque('ton Stock')) etapes.push({ cle: 'stock', etat: 'passu', titre: 'Stock', detail: 'ton Stock pas encore lu' });
  else etapes.push({ cle: 'stock', etat: 'absent', titre: 'Stock', detail: 'pas rangée dans le Stock' });

  // 3. ANNONCE(S)
  const lignesAnn = [];
  for (const a of rn.annonces) {
    const st = d.stats ? d.stats[a.id] : null;
    const prix = a.price != null && a.price !== '' ? (typeof a.price === 'object' ? a.price.amount : a.price) : null;
    lignesAnn.push({ site: 'Vinted', id: a.id, etat: a.etat, texte: ['Vinted', ETAT_ANN[a.etat] || a.etat, prix != null ? `${String(prix).replace('.', ',')}\u00a0€` : null,
      st && Number.isFinite(st.favoris) ? `${st.favoris} fav.` : null, st && Number.isFinite(st.vues) ? `${st.vues} vues` : null].filter(Boolean).join(' · ') });
  }
  for (const a of (rn.annoncesEbay || [])) lignesAnn.push({ site: 'eBay', id: String(a.itemId), etat: 'en-ligne', texte: 'eBay · en vente' });
  if (lignesAnn.length) etapes.push({ cle: 'annonces', etat: 'fait', titre: lignesAnn.some((l) => l.etat === 'en-ligne') ? 'En ligne' : 'Annonce', lignes: lignesAnn,
    detail: d.stats === null && rn.annonces.length ? 'vues et favoris pas lus' : null });
  else if (manque('tes annonces en ligne') || manque('tes annonces eBay')) etapes.push({ cle: 'annonces', etat: 'passu', titre: 'Annonce', detail: 'tes annonces pas encore lues' });
  else etapes.push({ cle: 'annonces', etat: 'absent', titre: 'Annonce', detail: 'aucune annonce ne porte ce N°' });

  // 4. VENTE
  const lignesV = [];
  const jour = (x) => x || null;
  for (const v of vVinted) {
    const ev = o.etapeVente ? o.etapeVente(v) : { label: '' };
    const p = v.price && v.price.amount != null ? v.price.amount : null;
    lignesV.push({ site: 'vinted', tx: v._tx, texte: ['Vinted', p != null ? `${String(p).replace('.', ',')}\u00a0€` : null, d.nomCompte ? d.nomCompte(v._uid) : null, ev.label || null].filter(Boolean).join(' · '), date: jour(v.date), annulee: annulee(v) });
  }
  for (const v of lbc) lignesV.push({ site: 'leboncoin', texte: ['Leboncoin', v.price != null ? `${(Number(v.price) / 100).toFixed(2).replace('.', ',')}\u00a0€` : null, o.lbcAnnulee && o.lbcAnnulee(v) ? 'annulée' : o.lbcFinalisee && o.lbcFinalisee(v) ? 'finalisée' : 'en cours'].filter(Boolean).join(' · '), date: jour(v.dateVente || v.date) });
  for (const c of ebay) lignesV.push({ site: 'ebay', texte: ['eBay', o.commandeEbayEngagee && !o.commandeEbayEngagee(c) ? 'annulée ou remboursée' : 'payée'].join(' · '), date: jour(c.creationDate) });
  // Aucune vente trouvée ET une lecture de ventes a manqué : on ne sait pas si
  // elle est vendue — la vente, le colis et l'argent disent « pas su ».
  const ventesInconnues = !lignesV.length && ['tes ventes Vinted', 'le lien vente → annonce de Vinted', 'tes ventes Leboncoin', 'tes commandes eBay'].some(manque);
  const siteVendu = venteV ? 'Vinted' : venteL ? 'Leboncoin' : venteE ? 'eBay' : null;
  if (lignesV.length) etapes.push({ cle: 'vente', etat: siteVendu ? 'fait' : 'absent', titre: siteVendu ? `Vendue sur ${siteVendu}` : 'Vente annulée', lignes: lignesV, date: venteV ? venteV.date : null });
  else if (ventesInconnues) etapes.push({ cle: 'vente', etat: 'passu', titre: 'Vente', detail: 'tes ventes pas toutes lues' });
  else etapes.push({ cle: 'vente', etat: 'absent', titre: 'Vente', detail: 'pas encore vendue' });

  // 5. COLIS (Vinted : par la transaction ; eBay et Leboncoin : sur leur site)
  let aPoster = false;
  if (venteV && !annulee(venteV)) {
    const ev = o.etapeVente ? o.etapeVente(venteV) : { label: '', step: 0 };
    const b = (rn.bordereaux || []).find((x) => x.tx === venteV._tx) || null;
    const ETB = { pret: 'bordereau prêt à imprimer', imprime: 'bordereau imprimé', poste: 'bordereau posté', attente: 'bordereau pas encore reçu' };
    aPoster = ev.step === 1;
    // L'étape de la vente (`etapeVente`, §11) : 4 = finalisée (l'acheteur a
    // validé, donc reçu), 3 = au relais ou livrée, 2 = partie, 1 = à expédier.
    const titreC = ev.step === 4 ? 'Colis livré' : ev.step === 3 ? (/livr/i.test(ev.label) ? 'Colis livré' : 'Colis au relais') : ev.step === 2 ? 'Colis parti' : 'Colis à déposer';
    etapes.push({ cle: 'colis', etat: ev.step >= 2 ? 'fait' : 'absent', titre: titreC, tx: venteV._tx, aPoster,
      detail: [ev.step === 4 ? 'commande finalisée par l’acheteur' : (ev.label || null), b ? ETB[b.etat] : (manque('tes bordereaux') ? 'bordereaux pas lus' : null)].filter(Boolean).join(' · ') });
  } else if (venteE || venteL) etapes.push({ cle: 'colis', etat: 'absent', titre: 'Colis', detail: venteE ? 'l’étiquette et le suivi sont dans eBay' : 'le bordereau et le suivi sont sur Leboncoin' });
  else if (ventesInconnues) etapes.push({ cle: 'colis', etat: 'passu', titre: 'Colis', detail: 'tes ventes pas toutes lues' });
  else etapes.push({ cle: 'colis', etat: 'absent', titre: 'Colis', detail: 'rien à expédier tant qu’elle n’est pas vendue' });

  // 6. ARGENT — Vinted : le versement (transaction finalisée), les frais
  // renseignés, le bénéfice de l'écran Ventes. eBay : l'argent reçu (frais déduits).
  let venteC = null, benefice = null, benefPartiel = false, raisonBenef = '';
  if (venteV && !annulee(venteV)) {
    const devise = venteV.price && venteV.price.currency_code;
    const bil = beneficePaire(venteV.price && venteV.price.amount, entree || {});
    venteC = bil.vente;
    if (devise && devise !== 'EUR') raisonBenef = `vente en ${devise} : écartée, jamais convertie`;
    else if (bil.benefice != null) { benefice = Math.round(bil.benefice * 100); benefPartiel = !bil.complet; }
    else raisonBenef = bil.achat == null ? 'prix d’achat pas saisi' : bil.vente == null ? 'prix de vente illisible' : 'frais illisibles';
    const ver = d.versements == null ? undefined : d.versements[String(venteV._tx)] || null;
    const frais = bil.cents ? `frais renseignés ${(bil.cents / 100).toFixed(2).replace('.', ',')}\u00a0€${bil.complet ? '' : ' (pas tous confirmés)'}` : (bil.complet ? 'aucun frais' : 'frais pas renseignés');
    if (ver === undefined) etapes.push({ cle: 'argent', etat: 'passu', titre: 'Argent', detail: `dates de versement pas lues · ${frais}` });
    else if (ver) etapes.push({ cle: 'argent', etat: 'fait', titre: 'Argent versé', date: ver, detail: frais });
    else etapes.push({ cle: 'argent', etat: 'absent', titre: 'Argent', detail: `versement pas encore lu · à dater · ${frais}` });
  } else if (venteE) {
    const r = o.montantRecuEbay ? o.montantRecuEbay(venteE) : { eur: null, raison: 'montant reçu inconnu' };
    if (r.eur != null) {
      venteC = Math.round(r.eur * 100);
      if (achatC != null) benefice = venteC - achatC; else raisonBenef = 'prix d’achat pas saisi';
      etapes.push({ cle: 'argent', etat: 'fait', titre: 'Argent reçu sur eBay', detail: 'frais eBay déduits' });
    } else { raisonBenef = r.raison; etapes.push({ cle: 'argent', etat: 'passu', titre: 'Argent', detail: r.raison }); }
  } else if (venteL) {
    venteC = venteL.price != null && Number.isFinite(Number(venteL.price)) ? Number(venteL.price) : null;
    if (venteC != null && achatC != null) { benefice = venteC - achatC; benefPartiel = true; } else raisonBenef = achatC == null ? 'prix d’achat pas saisi' : 'prix de vente illisible';
    etapes.push({ cle: 'argent', etat: o.lbcFinalisee && o.lbcFinalisee(venteL) ? 'fait' : 'absent', titre: 'Argent', detail: 'Leboncoin : daté à la vente · frais pas renseignés' });
  } else if (ventesInconnues) { raisonBenef = 'ventes pas lues'; etapes.push({ cle: 'argent', etat: 'passu', titre: 'Argent', detail: 'tes ventes pas toutes lues' }); }
  else etapes.push({ cle: 'argent', etat: 'absent', titre: 'Argent', detail: 'rien de vendu' });

  return {
    num: rn.cle, titre, taille: (fiche && fiche.taille) || null, photo: (annonce && annonce.photo) || (fiche && fiche.photo) || null,
    double: !!rn.double, ancienNumero: !!rn.ancienNumero, etat: rn.etat, manques: rn.manques || [],
    resume: { achat: achatC, vente: venteC, benefice, benefPartiel, raisonBenef },
    aPoster, txAPoster: aPoster && venteV ? venteV._tx : null, etapes,
  };
}
