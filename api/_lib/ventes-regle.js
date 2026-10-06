// ── LES RÈGLES « VENDU » ET « REÇU », CÔTÉ SERVEUR — UN MIROIR, PAS UNE COPIE ──
// Le bilan de la semaine (api/ship-reminders.js) tourne SANS l'app : il ne peut
// pas importer src/App.jsx (JSX, 30 000 lignes, React). Or la règle de ce qui
// compte comme une vente FAITE (`ventesFaites`) et comme de l'argent REÇU
// (`ventesDeclarables`, daté au versement) a UN propriétaire : l'app (§11).
//
// ⚠️ CE FICHIER N'EST PAS UNE SECONDE RÈGLE. Chaque déclaration ci-dessous est
//    le texte EXACT de sa jumelle dans src/App.jsx, fabriqué à partir d'elle.
//    `scripts/audit-bilan-semaine.cjs` relit les deux avec l'analyseur Babel et
//    exige qu'elles soient IDENTIQUES au caractère près (blancs mis à part) —
//    puis les exécute sur les mêmes ventes et exige les mêmes résultats.
//    Modifier une règle dans l'app sans la recopier ici passe donc au ROUGE.
//    (Précédent : `aExpedier`, la même dans l'app, l'extension et le widget,
//    jugée par audit-statuts.cjs.)
// ⚠️ NE RIEN MODIFIER ICI À LA MAIN : modifier App.jsx, puis refabriquer ce
//    fichier avec `node scripts/audit-bilan-semaine.cjs --recopie`.
/* eslint-disable */

export const classifyOrderStatus = (status) => {
  const s = status || '';
  // Retour / remboursement / suspension = PAS une vente aboutie (l'article revient
  // ou la transaction n'est pas validée). Si Vinted finalise ensuite, le statut
  // capté redevient « finalisée » et la vente se reclasse automatiquement.
  if (/annul|cancel|refus|rembours|retour|suspend/i.test(s)) return 'cancelled';
  // « Le paiement a échoué » (statut 220, vu en base) : aucune vente n'a eu lieu.
  // Sans ce test il comptait dans les « ventes en cours » et comme colis à poster.
  if (/paiement\s+a\s+[ée]chou|[ée]chec\s+du\s+paiement/i.test(s)) return 'cancelled';
  if (/finalis/i.test(s)) return 'completed';
  return 'pending';
};

export const tsCommande = (o) => Date.parse((o && o.date) || '') || 0;

export const montantCommande = (o) => {
  const p = o && o.price;
  if (p == null) return 0;
  const v = (typeof p === 'object') ? (p.amount ?? p.value) : p;
  const n = Number(String(v ?? '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
};

export const lbcAnnulee = (o) => o.stepStatus === 'cancelled' || /annul|cancel|refund|rembours/i.test((o.parcelStatus || '') + ' ' + (o.stepStatus || '') + ' ' + (o.stepLabel || ''));

export const lbcFinalisee = (o) => {
  if (o.parcelColor) return o.parcelColor === 'finished';           // ce que dit le colis
  // ⚠️ `delivered`/`livr[ée]` STRICT, pas `deliver`/`livr` : « out_for_delivery »
  //    et « en cours de livraison » sont EN TRANSIT, pas livrés — les compter
  //    gonflerait le CA d'une vente non finalisée (risque de litige). Même soin
  //    que le repli libellé plus bas.
  if (o.parcelStatus) return /delivered|livr[ée]/i.test(o.parcelStatus);
  if (o.stepStatus === 'done') return true;                         // liste v3
  if (o.stepStatus === 'cancelled') return false;
  // repli (lignes déjà captées, sans colis) : UNIQUEMENT les libellés TERMINAUX
  // mesurés — « Paiement effectué » (vendeur payé), « Terminé » (acheteur a reçu),
  // « livré/livrée », « colis reçu », « finalisé/clôturé/clos ». ⚠️ `livr[ée]`
  // et pas `livr` : « en cours de livraison » = EN TRANSIT, pas livré. Et pas de
  // « reçu » seul (ambigu : « paiement reçu » peut être un palier amont).
  return /paiement effectu|termin[ée]|finalis|cl[oô]tur|livr[ée]|colis re[çc]u|\bclos/i.test((o.stepLabel || '') + ' ' + (o.stepStatus || ''));
};

export const venteFinalisee = (o) => classifyOrderStatus(o && o.status) === 'completed';

export const ymDeTs = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

export const indexDeclarations = (reg) => {
  if (!reg || typeof reg !== 'object' || Array.isArray(reg)) return null;
  const idx = new Map();
  for (const ym of Object.keys(reg).sort()) {
    const d = reg[ym]; if (!d || !Array.isArray(d.ids)) continue;
    for (const id of d.ids) {
      const k = String(id); const a = idx.get(k);
      if (a) { if (!a.includes(ym)) a.push(ym); } else idx.set(k, [ym]);
    }
  }
  return idx;
};

export const moisDeclare = (reg, ym) => !!(reg && typeof reg === 'object' && reg[ym] && Array.isArray(reg[ym].ids));

export const ventesDeclarables = ({ vinted, lbc, ebay, masquee, exclu, versements, declare } = {}) => {
  const lignes = [], aDater = [], ecartees = [], vus = new Set();
  let exclues = 0;
  const garde = (l) => { if (vus.has(l.id)) return false; vus.add(l.id); return true; };
  const idx = indexDeclarations(declare);
  // Le mois où la vente COMPTE : celui de sa déclaration s'il y en a une, sinon
  // celui du versement (ou de la vente pour Leboncoin, de la commande pour eBay).
  const place = (l) => {
    if (!idx) return l;
    const d = idx.get(l.id);
    if (d) { l.ymVers = l.ym || null; l.ym = d[0]; l.declaree = true; if (d.length > 1) l.double = d.slice(); }
    else if (l.ym && moisDeclare(declare, l.ym)) {
      // L'absence de la liste ne prouve un oubli que selon la RÈGLE de la
      // déclaration : à la date de vente, une vente Vinted vendue le mois d'avant
      // appartient à la déclaration de ce mois-là.
      const tv = l.plateforme === 'Vinted' ? Date.parse(l.dateVente || '') : 0;
      const ymV = tv ? ymDeTs(tv) : null;
      if (declare[l.ym].regle === 'vente' && ymV && ymV < l.ym && !moisDeclare(declare, ymV)) l.moisVenteAvant = ymV;
      else l.apres = true;
    }
    return l;
  };
  // Une vente sans date mais DÉCLARÉE n'est plus « à dater » : son mois est
  // celui où il l'a déclarée. `ts` reste vide (aucune date de versement connue).
  const aDaterOuDeclaree = (l) => {
    const d = idx && idx.get(l.id);
    if (!d) { aDater.push(l); return; }
    lignes.push(Object.assign(l, { ts: null, ym: d[0], ymVers: null, declaree: true }, d.length > 1 ? { double: d.slice() } : {}));
  };
  for (const o of (vinted || [])) {
    if (!o || !venteFinalisee(o)) continue;
    if (exclu && exclu(o)) { exclues += 1; continue; }
    const tx = o.transaction_id != null ? o.transaction_id : o.id;
    const id = 'vinted:' + (tx != null ? tx : ('?' + lignes.length));
    const eur = montantCommande(o), masq = !!(masquee && masquee(o));
    const v = (versements && tx != null) ? versements[String(tx)] : null;
    const t = v ? Date.parse(v) : 0;
    if (!t) { if (!vus.has(id)) { vus.add(id); aDaterOuDeclaree({ id, plateforme: 'Vinted', eur, titre: o.title || '', masquee: masq, o, dateVente: o.date }); } continue; }
    const l = { id, plateforme: 'Vinted', ts: t, ym: ymDeTs(t), eur, titre: o.title || '', masquee: masq, o, dateVente: o.date };
    if (garde(l)) lignes.push(place(l));
  }
  for (const v of (lbc || [])) {
    if (!v || v.isSeller !== true || !v.txId) continue;
    if (lbcAnnulee(v) || !lbcFinalisee(v)) continue;
    const eur = v.price != null ? Number(v.price) / 100 : NaN;
    const id = 'lbc:' + v.txId;
    if (!isFinite(eur)) { if (!vus.has(id)) { vus.add(id); ecartees.push({ id, plateforme: 'Leboncoin', raison: 'prix inconnu', titre: v.title || '' }); } continue; }
    const t = Date.parse(v.dateVente || '');
    if (!t) { if (!vus.has(id)) { vus.add(id); aDaterOuDeclaree({ id, plateforme: 'Leboncoin', eur, titre: v.title || '', masquee: false }); } continue; }
    const l = { id, plateforme: 'Leboncoin', ts: t, ym: ymDeTs(t), eur, titre: v.title || '', masquee: false };
    if (garde(l)) lignes.push(place(l));
  }
  for (const e of (ebay || [])) {
    if (!e || String(e.orderPaymentStatus || '').toUpperCase() !== 'PAID' || !e.orderId) continue;
    const tot = (e.pricingSummary && e.pricingSummary.total) || {};
    const id = 'ebay:' + e.orderId;
    if (tot.currency && tot.currency !== 'EUR') { if (!vus.has(id)) { vus.add(id); ecartees.push({ id, plateforme: 'eBay', raison: 'devise ' + tot.currency, titre: '' }); } continue; }
    const eur = Number(tot.value);
    const t = Date.parse(e.creationDate || '');
    if (!isFinite(eur)) continue;
    if (!t) { if (!vus.has(id)) { vus.add(id); aDaterOuDeclaree({ id, plateforme: 'eBay', eur, titre: '', masquee: false }); } continue; }
    const titre = (Array.isArray(e.lineItems) && e.lineItems[0] && e.lineItems[0].title) || '';
    const l = { id, plateforme: 'eBay', ts: t, ym: ymDeTs(t), eur, titre, masquee: false };
    if (garde(l)) lignes.push(place(l));
  }
  return { lignes, aDater, ecartees, exclues, declare: idx ? 'lu' : 'pasSu' };
};

export const ventesFaites = ({ vinted, lbc, ebay, cachee } = {}) => {
  const lignes = [], vus = new Set();
  let sansDate = 0;
  const garde = (id) => { if (vus.has(id)) return false; vus.add(id); return true; };
  for (const o of (vinted || [])) {
    if (!o || (cachee && cachee(o))) continue;
    if (classifyOrderStatus(o.status) === 'cancelled') continue;
    const t = tsCommande(o); if (!t) continue;
    const tx = o.transaction_id != null ? o.transaction_id : o.id;
    if (tx != null && !garde('vinted:' + tx)) continue;
    lignes.push({ plateforme: 'Vinted', ts: t, eur: montantCommande(o) });
  }
  for (const v of (lbc || [])) {
    if (!v || v.isSeller !== true || !v.txId || lbcAnnulee(v)) continue;
    const eur = v.price != null ? Number(v.price) / 100 : NaN;
    if (!isFinite(eur)) continue;
    const t = Date.parse(v.dateVente || '');
    if (!t) { if (garde('lbc:' + v.txId)) sansDate += 1; continue; }
    if (garde('lbc:' + v.txId)) lignes.push({ plateforme: 'Leboncoin', ts: t, eur });
  }
  for (const e of (ebay || [])) {
    if (!e || String(e.orderPaymentStatus || '').toUpperCase() !== 'PAID' || !e.orderId) continue;
    const tot = (e.pricingSummary && e.pricingSummary.total) || {};
    if (tot.currency && tot.currency !== 'EUR') continue;
    const eur = Number(tot.value), t = Date.parse(e.creationDate || '');
    if (!isFinite(eur) || !t) continue;
    if (garde('ebay:' + e.orderId)) lignes.push({ plateforme: 'eBay', ts: t, eur });
  }
  return { lignes, sansDate };
};

export const compteEcarte = (uid, masques, panneau) => {
  const k = String(uid ?? '');
  const pa = panneau || {};
  if (pa[k] === false) return false;
  return (masques && masques.has(k)) || pa[k] === true;
};
