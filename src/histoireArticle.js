// ── L'HISTOIRE COMPLÈTE D'UN ARTICLE (3 novembre 2026, choix de Julien) ─────
// La fiche « Toute l'histoire du N° » (1er nov., `parcoursPaire`) devient une
// CHRONOLOGIE : achat → numérotage → rangement → mises en ligne par site (et
// republications) → changements de prix → offres → favoris → vente → colis →
// versement → retour éventuel.
//
// ⚠️ CHAQUE LIGNE VIENT D'UNE DONNÉE LUE, DATÉE PAR ELLE (jamais déduite) :
//    achat = `buyFrom` posé par SON lien d'achat (n° de transaction) ; reçu =
//    la ligne `email_invoice_tx{n°}` de CET achat ; numérotage = `numberedAt` de
//    la fiche ; mise en ligne vue = première sauvegarde coffre de CETTE annonce
//    (`firstSavedAt`) ; republication = `recreeAt`/`recreeDe` de la fiche ;
//    eBay = `depuis` de l'annonce au SKU du N° ; prix = le journal des prix
//    changés depuis VRM (`vrm_prix_journal`, site FAIT seulement) ; offres =
//    messages d'offre des conversations dont la transaction porte l'`item_id`
//    de CETTE annonce ; favoris = le nombre lu sur l'annonce ; vente, colis,
//    versement = la transaction (état, `status_updated_at` 450) ; retour = une
//    vente que son état fait revenir (`PAS_UNE_VENTE`).
// ⚠️ « PAS SU » N'EST PAS « RIEN » : une source non lue (`null`) donne une étape
//    'passu' (« — » et la raison) ; une source lue et vide donne 'absent'.
// ⚠️ L'ORDRE : les étapes suivent l'ordre du cycle (`ORDRE_HISTOIRE`), les
//    événements d'une étape l'ordre de leurs dates ; un événement sans date
//    lisible vient après les datés, sans date inventée.
// Module PUR : l'écran (FichePaire.jsx) et `audit-histoire-article.cjs`.
import { parcoursPaire } from './fichePaire.js';

export const ORDRE_HISTOIRE = ['achat', 'numero', 'stock', 'annonces', 'prix', 'offres', 'favoris', 'vente', 'colis', 'argent', 'retour'];
const str = (v) => String(v == null ? '' : v).trim();
const t = (iso) => { const x = Date.parse(iso || ''); return Number.isFinite(x) ? x : null; };
const iso = (v) => (t(v) != null ? new Date(t(v)).toISOString() : null);
const eur = (n) => (n == null || !Number.isFinite(Number(n)) ? null : `${(Math.round(Number(n) * 100) / 100).toFixed(Number.isInteger(Number(n)) ? 0 : 2).replace('.', ',')} €`);
const NOM = { vinted: 'Vinted', ebay: 'eBay', leboncoin: 'Leboncoin', vestiaire: 'Vestiaire' };
const parDate = (a, b) => { const ta = t(a.at), tb = t(b.at); if (ta == null && tb == null) return 0; if (ta == null) return 1; if (tb == null) return -1; return ta - tb; };

// rn : `toutSurLeNumero` · d : les données de `parcoursPaire` + { coffres, offres,
//   journalPrix, recus, autresEnLigne } · o : les règles de `parcoursPaire`.
// coffres   { [itemId]: { firstSavedAt } } | null      (null = pas lu)
// offres    [{ item, at, prix, sens: 'recue'|'faite', etat }] | null
// journalPrix [{ at, prix, sites: [{ site, id, avant }] }] | null
// prixVinted  `vinted_prix_historique` (Republier) [{ item, avant, apres, at }]
// recus     Set des n° de transaction d'achat qui ont un reçu | null
// autresEnLigne [{ site, id, lien, prix }] (Leboncoin, Vestiaire, par identité) | null
export function histoireArticle(rn, d = {}, o = {}) {
  const p = parcoursPaire(rn, d, o);
  if (!p) return null;
  const fiches = d.fiches || null;
  const ids = (rn.annonces || []).map((a) => a.id);
  const idsSet = new Set(ids);
  const ancien = new Map((p.etapes || []).map((e) => [e.cle, e]));
  const etapes = [];
  const pose = (cle, etat, titre, ev, detail) => etapes.push({ cle, etat, titre, evenements: (ev || []).slice().sort(parDate), detail: detail || null });

  // 1. ACHAT — l'étape de `parcoursPaire` + le reçu de CET achat.
  {
    const e = ancien.get('achat');
    const fiche = fiches ? ids.map((id) => fiches[id]).find((f) => f && f.buyFrom && (f.buyFromId || f.buyFrom.title)) : null;
    const ev = [];
    if (e && e.etat === 'fait') {
      // (5 nov., revue) L'achat de `parcoursPaire` d'abord : il a pu être relié
      // depuis la VENTE (`vinted_sale_overrides`) — la fiche n'en sait rien. Un
      // achat relié sans n° de transaction (lien d'avant) reste un achat relié.
      const bid = e.buyFromId ? String(e.buyFromId) : (fiche && fiche.buyFromId ? String(fiche.buyFromId) : null);
      const relieSansTx = !bid && e.titre === 'Achetée sur Vinted';
      const recu = !bid ? null : d.recus == null ? 'reçu pas lu' : d.recus.has(bid) ? 'reçu rangé' : 'pas de reçu';
      ev.push({ at: iso(e.date || (fiche && fiche.buyFrom && fiche.buyFrom.date)), texte: [e.montant != null ? eur(e.montant / 100) : null, e.detail || null, recu].filter(Boolean).join(' · '),
        preuve: bid ? `achat n° ${bid}` : relieSansTx ? 'achat relié' : e.gros ? 'achat en gros' : 'prix saisi', cle: 'achat' });
    }
    pose('achat', e ? e.etat : 'passu', e ? e.titre : 'Achat', ev, e && e.etat !== 'fait' ? e.detail : null);
  }

  // 2. NUMÉROTAGE — `numberedAt` de chaque fiche qui porte ce N°.
  if (fiches == null) pose('numero', 'passu', 'Numéroté', [], 'tes fiches numérotées pas encore lues');
  else {
    const ev = [];
    for (const id of ids) {
      const f = fiches[id]; if (!f) continue;
      if (f.numberedAt) ev.push({ at: iso(f.numberedAt), texte: `N°${p.num}${f.auto ? '' : ' · posé à la main'}`, preuve: `fiche ${id}`, cle: 'numero' });
      if (f.reattribue && str(f.reattribue.de)) ev.push({ at: iso(f.reattribue.at), texte: `remplace le N°${str(f.reattribue.de)}`, preuve: `fiche ${id}`, cle: 'numero' });
    }
    pose('numero', ev.length ? 'fait' : 'absent', 'Numéroté', ev, ev.length ? null : 'date de numérotage pas écrite');
  }

  // 3. RANGEMENT — l'étape de `parcoursPaire` (sans date : le Stock n'en écrit pas).
  { const e = ancien.get('stock'); pose('stock', e ? e.etat : 'passu', e ? e.titre : 'Stock', [], e ? e.detail : null); }

  // 4. MISES EN LIGNE ET REPUBLICATIONS.
  {
    const ev = [];
    let passu = false;
    for (const a of (rn.annonces || [])) {
      const lien = `https://www.vinted.fr/items/${encodeURIComponent(a.id)}`;
      const c = d.coffres == null ? undefined : d.coffres[a.id];
      if (d.coffres == null) passu = true;
      const f = fiches ? fiches[a.id] : null;
      if (f && f.recreeAt) ev.push({ at: iso(f.recreeAt), texte: `Republiée sur Vinted${f.recreeDe ? ` (remplace l'annonce ${str(f.recreeDe)})` : ''}`, preuve: `annonce ${a.id}`, lien, cle: 'republie' });
      else if (c && c.firstSavedAt) ev.push({ at: iso(c.firstSavedAt), texte: 'Vue en ligne sur Vinted', preuve: `annonce ${a.id}`, lien, cle: 'en-ligne' });
      else ev.push({ at: null, texte: 'Sur Vinted', preuve: `annonce ${a.id}`, lien, cle: 'en-ligne' });
      const etat = { 'en-ligne': 'en ligne', 'a-confirmer': 'à confirmer', masquee: 'masquée par Vinted', 'plus-en-ligne': 'plus en ligne', passu: 'état pas lu' }[a.etat];
      if (etat) ev[ev.length - 1].texte += ` · ${etat}`;
    }
    for (const a of (rn.annoncesEbay || [])) ev.push({ at: iso(a.depuis), texte: `Mise en vente sur eBay${a.price != null ? ' · ' + eur(Number(a.price)) : ''}`, preuve: `SKU ${str(a.sku) || 'VRM-' + p.num}`, lien: `https://www.ebay.fr/itm/${encodeURIComponent(a.itemId)}`, cle: 'ebay' });
    for (const a of (d.autresEnLigne || [])) ev.push({ at: null, texte: `En ligne sur ${NOM[a.site] || a.site}${a.prix != null ? ' · ' + eur(a.prix) : ''}`, preuve: a.site === 'leboncoin' ? 'référence VRM' : 'N° du produit', lien: a.lien || null, cle: a.site });
    const absentes = (rn.manques || []).filter((m) => m === 'tes annonces en ligne' || m === 'tes annonces eBay');
    if (!ev.length && (absentes.length || d.autresEnLigne == null)) pose('annonces', 'passu', 'Mises en ligne', [], absentes.length ? absentes.join(', ') + ' pas lues' : 'Leboncoin et Vestiaire pas lus');
    else pose('annonces', ev.length ? 'fait' : 'absent', 'Mises en ligne', ev, ev.length ? (passu ? 'dates de mise en ligne Vinted pas lues' : null) : 'aucune annonce ne porte ce N°');
  }

  // 5. CHANGEMENTS DE PRIX — le journal de VRM (sites FAITS seulement).
  if (d.journalPrix == null) pose('prix', 'passu', 'Prix', [], 'journal des prix pas lu');
  else {
    // Republier (« modifier sur place ») range déjà ses prix changés par annonce
    // (`vinted_prix_historique`, { item, avant, apres, at }) : lus par l'identifiant.
    const evR = (d.prixVinted || []).filter((x) => x && idsSet.has(str(x.item)) && Number.isFinite(Number(x.apres)))
      .map((x) => ({ at: iso(x.at), texte: `Vinted · ${Number.isFinite(Number(x.avant)) ? eur(Number(x.avant)) + ' → ' : ''}${eur(Number(x.apres))}`, preuve: `annonce ${str(x.item)} · Republier`, cle: 'prix' }));
    const ev = evR.concat(d.journalPrix.filter((j) => j && Array.isArray(j.sites) && j.sites.length && Number.isFinite(Number(j.prix)))
      .map((j) => ({ at: iso(j.at), texte: `${j.sites.map((s) => NOM[s.site] || s.site).join(', ')} · ${j.sites[0].avant != null ? eur(j.sites[0].avant) + ' → ' : ''}${eur(Number(j.prix))}`, preuve: 'changé depuis VRM', cle: 'prix' })));
    pose('prix', ev.length ? 'fait' : 'absent', 'Prix', ev, ev.length ? null : 'aucun changement fait depuis VRM');
  }

  // 6. OFFRES — par l'item_id de CETTE annonce (jamais le titre).
  if (d.offres == null) pose('offres', 'passu', 'Offres', [], 'conversations pas lues');
  else {
    const ev = d.offres.filter((x) => x && idsSet.has(str(x.item)) && Number.isFinite(Number(x.prix)))
      .map((x) => ({ at: iso(x.at), texte: `${x.sens === 'faite' ? 'Faite' : x.sens === 'recue' ? 'Reçue' : 'Offre'} · ${eur(Number(x.prix))}${x.etat ? ' · ' + str(x.etat) : ''}`, preuve: `annonce ${str(x.item)}`, cle: 'offre' }));
    pose('offres', ev.length ? 'fait' : 'absent', 'Offres', ev, ev.length ? null : 'aucune offre lue');
  }

  // 7. FAVORIS — le NOMBRE lu sur chaque annonce (jamais qui).
  if (d.stats == null) pose('favoris', 'passu', 'Favoris', [], 'favoris pas lus');
  else {
    let n = null, vues = null;
    for (const id of ids) { const s = d.stats[id]; if (s && Number.isFinite(s.favoris)) n = (n || 0) + s.favoris; if (s && Number.isFinite(s.vues)) vues = (vues || 0) + s.vues; }
    pose('favoris', n != null && n > 0 ? 'fait' : 'absent', n != null ? `${n} favori${n > 1 ? 's' : ''}` : 'Favoris', [], n == null ? (ids.length ? 'nombre pas écrit sur l’annonce' : 'aucune annonce Vinted') : (vues != null ? `${vues} vues` : null));
  }

  // 8. VENTE — l'étape de `parcoursPaire`, une ligne par vente avec SA preuve.
  {
    const e = ancien.get('vente');
    const ev = [];
    const annulee = (v) => !!(o.venteAnnulee && o.venteAnnulee(v));
    for (const v of ((rn.ventes && rn.ventes.vinted) || [])) {
      if (annulee(v)) continue;
      const m = v.price && v.price.amount != null ? Number(v.price.amount) : null;
      ev.push({ at: iso(v.date), texte: ['Vinted', eur(m), d.nomCompte ? d.nomCompte(v._uid) : null].filter(Boolean).join(' · '), preuve: `transaction ${v._tx}${str(v.status) ? ' · ' + str(v.status) : ''}`, cle: 'vinted', tx: v._tx });
    }
    for (const v of ((rn.ventes && rn.ventes.lbc) || [])) if (!(o.lbcAnnulee && o.lbcAnnulee(v))) ev.push({ at: iso(v.dateVente || v.date), texte: ['Leboncoin', v.price != null ? eur(Number(v.price) / 100) : null].filter(Boolean).join(' · '), preuve: `annonce ${str(v.itemId)}`, cle: 'leboncoin' });
    for (const c of ((rn.ventes && rn.ventes.ebay) || [])) if (!o.commandeEbayEngagee || o.commandeEbayEngagee(c)) {
      const r = o.montantRecuEbay ? o.montantRecuEbay(c) : { eur: null };
      ev.push({ at: iso(c.creationDate), texte: ['eBay', r && r.eur != null ? eur(r.eur) + ' reçus' : null].filter(Boolean).join(' · '), preuve: `commande ${str(c.orderId)}`, cle: 'ebay' });
    }
    pose('vente', ev.length ? 'fait' : (e ? (e.etat === 'passu' ? 'passu' : 'absent') : 'passu'), ev.length ? (e && e.etat === 'fait' ? e.titre : 'Vendu') : 'Vente', ev, ev.length ? null : (e ? e.detail : null));
  }

  // 9. COLIS — la frise de la vente Vinted (prouvée), sinon l'étape d'avant.
  {
    const e = ancien.get('colis');
    const ev = [];
    if (e && e.tx) {
      const b = (rn.bordereaux || []).find((x) => x.tx === e.tx);
      if (b) ev.push({ at: null, texte: { pret: 'Bordereau prêt', imprime: 'Bordereau imprimé', poste: 'Bordereau posté', attente: 'Bordereau attendu' }[b.etat] || 'Bordereau', preuve: `transaction ${e.tx}`, cle: 'bordereau' });
    }
    pose('colis', e ? e.etat : 'passu', e ? e.titre : 'Colis', ev, e ? e.detail : null);
    if (e && e.tx) etapes[etapes.length - 1].tx = e.tx;
    if (e && e.aPoster) etapes[etapes.length - 1].aPoster = true;
  }

  // 10. VERSEMENT — l'étape « argent » de `parcoursPaire` (date 450 lue).
  { const e = ancien.get('argent'); pose('argent', e ? e.etat : 'passu', e ? e.titre : 'Argent', e && e.date ? [{ at: iso(e.date), texte: e.detail || '', preuve: 'commande finalisée', cle: 'versement' }] : [], e && !e.date ? e.detail : null); }

  // 11. RETOUR — une vente que son état fait revenir (annulée, retour…).
  {
    const ev = [];
    for (const v of ((rn.ventes && rn.ventes.vinted) || [])) if (o.venteAnnulee && o.venteAnnulee(v)) ev.push({ at: iso(v.date), texte: `Vinted · ${str(v.status) || 'annulée'}`, preuve: `transaction ${v._tx}`, cle: 'retour' });
    const ventesPasLues = (rn.manques || []).includes('tes ventes Vinted');
    if (ev.length) pose('retour', 'fait', 'Retour ou annulation', ev);
    else if (ventesPasLues) pose('retour', 'passu', 'Retour', [], 'tes ventes Vinted pas lues');
    else pose('retour', 'absent', 'Retour', [], 'aucun');
  }

  etapes.sort((a, b) => ORDRE_HISTOIRE.indexOf(a.cle) - ORDRE_HISTOIRE.indexOf(b.cle));
  return { ...p, etapes, histoire: true };
}

// Les offres d'une conversation Vinted (forme lue : `payload.conversation`),
// pour les annonces demandées. `moi` : l'uid du compte (sens de l'offre).
export function offresDeConversation(conv, moi) {
  const c = conv && conv.conversation ? conv.conversation : conv;
  const tx = c && c.transaction;
  const item = tx && tx.item_id != null ? String(tx.item_id) : null;
  if (!item) return [];
  const out = [];
  for (const m of (Array.isArray(c.messages) ? c.messages : [])) {
    if (!m || !/offer/.test(String(m.entity_type || ''))) continue;
    const e = m.entity || {};
    const prix = e.price && e.price.amount != null ? Number(e.price.amount) : NaN;
    if (!Number.isFinite(prix)) continue;
    const at = Number.isFinite(Number(m.created_at_ts)) ? new Date(Number(m.created_at_ts) * (Number(m.created_at_ts) < 1e12 ? 1000 : 1)).toISOString() : null;
    const sens = moi != null && e.user_id != null ? (String(e.user_id) === String(moi) ? 'faite' : 'recue') : null;
    out.push({ item, at, prix, sens, etat: str(e.status_title) || null });
  }
  return out;
}
