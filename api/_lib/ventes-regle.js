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
// (1er nov.) Les règles Vestiaire ont UN propriétaire (api/_lib/vestiaire-regle.js),
// importé tel quel par l'app et ici — ce n'est pas une recopie.
import { vcVenteAnnulee, montantRecuVc, dateVersementVc, dateVenteVc, etapeMotVc } from './vestiaire-regle.js';

export const classifyOrderStatus = (status) => {
  const s = status || '';
  // Retour / remboursement / suspension = PAS une vente aboutie (l'article revient
  // ou la transaction n'est pas validée). Si Vinted finalise ensuite, le statut
  // capté redevient « finalisée » et la vente se reclasse automatiquement.
  if (/annul|cancel|refus|rembours|retour|suspend/i.test(s)) return 'cancelled';
  // « Le paiement a échoué » (statut 220, vu en base) : aucune vente n'a eu lieu.
  // Sans ce test il comptait dans les « ventes en cours » et comme colis à poster.
  if (/paiement\s+a\s+[ée]chou|[ée]chec\s+du\s+paiement/i.test(s)) return 'cancelled';
  // ⚠️ (1er nov., audit A12) UNE RÈGLE « PAS UNE VENTE » : tout état qui « a
  // échoué » fait REVENIR la paire pour l'anti double vente (`PAS_UNE_VENTE`,
  // app ET extension) ; il ne compte donc pas non plus comme vendu ici. Avant,
  // seul « le paiement a échoué » sortait : une autre « …a échoué » était
  // revenue d'un côté, vendue de l'autre. `audit-flux-divers.cjs` exige que
  // `classifyOrderStatus(s) === 'cancelled'` ⇔ `PAS_UNE_VENTE.test(s)`.
  if (/[ée]chou/i.test(s)) return 'cancelled';
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

export const montantCommandeLu = (o) => {
  const p = o && o.price;
  if (p == null) return null;
  const v = (typeof p === 'object') ? (p.amount ?? p.value) : p;
  if (v == null || String(v).trim() === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return isFinite(n) ? n : null;
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

export const lbcExpediee = o => {
  const t=[o.parcelStatus,o.stepStatus,o.stepLabel].filter(Boolean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(/(?:a|avant) (?:envoyer|expedier)|attente (?:de |du )?(?:depot|expedition|prise en charge)/.test(t))return false;
  return /in[_ -]?transit|out[_ -]?for[_ -]?delivery|shipped|dispatched|collected|en cours de livraison|colis (?:envoye|depose|remis)|expedie(?:e|s)?\b|pris en charge|collecte par/.test(t);
};

export const venteFinalisee = (o) => classifyOrderStatus(o && o.status) === 'completed';

export const commandeEbayEngagee = (o) => !!o
  && !(/CANCEL/i.test(String((o.cancelStatus && o.cancelStatus.cancelState) || '')) && !/REJECT/i.test(String((o.cancelStatus && o.cancelStatus.cancelState) || '')))
  && !/FAILED|FULLY_REFUNDED/i.test(String(o.orderPaymentStatus || ''));

export const montantRecuEbay = (o) => {
  const lu = (m) => (m && typeof m === 'object' && m.value != null && String(m.value).trim() !== '' && isFinite(Number(m.value))) ? m : null;
  const d = lu(o && o.paymentSummary && o.paymentSummary.totalDueSeller);
  const f = lu(o && o.totalMarketplaceFee);
  if (!d) return { eur: null, raison: 'montant reçu inconnu' };
  if (d.currency !== 'EUR') return { eur: null, raison: 'devise ' + (d.currency || 'inconnue') };
  if (!f) return { eur: null, raison: 'frais eBay inconnus' };
  if (f.currency !== 'EUR') return { eur: null, raison: 'devise ' + (f.currency || 'inconnue') };
  return { eur: (Math.round(Number(d.value) * 100) - Math.round(Number(f.value) * 100)) / 100, raison: '' };
};

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

export const ventesDeclarables = ({ vinted, lbc, ebay, vestiaire, masquee, exclu, excluAutre, versements, declare } = {}) => {
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
    // (1er nov., audit A10) Un prix illisible n'est jamais 0 € : la vente est
    // mise à part et DITE (`manque`), le total devient « au moins ».
    const eur = montantCommandeLu(o), masq = !!(masquee && masquee(o));
    const v = (versements && tx != null) ? versements[String(tx)] : null;
    const t = v ? Date.parse(v) : 0;
    if (eur == null) { if (!vus.has(id)) { vus.add(id); ecartees.push({ id, plateforme: 'Vinted', raison: 'prix pas lu', titre: o.title || '', manque: true, ts: t || null, tsVente: tsCommande(o) || null }); } continue; }
    if (!t) { if (!vus.has(id)) { vus.add(id); aDaterOuDeclaree({ id, plateforme: 'Vinted', eur, titre: o.title || '', masquee: masq, o, dateVente: o.date }); } continue; }
    const l = { id, plateforme: 'Vinted', ts: t, ym: ymDeTs(t), eur, titre: o.title || '', masquee: masq, o, dateVente: o.date };
    if (garde(l)) lignes.push(place(l));
  }
  for (const v of (lbc || [])) {
    if (!v || v.isSeller !== true || !v.txId) continue;
    if (lbcAnnulee(v) || !lbcFinalisee(v)) continue;
    // (3 nov.) Un compte Leboncoin, Vestiaire ou eBay écarté par SON choix
    // (Paramètres → Comptes liés, `excluAutre`, api/_lib/comptes-exclus.js) :
    // comme un compte Vinted exclu, sa vente n'entre dans AUCUN total.
    if (excluAutre && excluAutre('leboncoin', v)) { exclues += 1; continue; }
    const eur = v.price != null ? Number(v.price) / 100 : NaN;
    const id = 'lbc:' + v.txId;
    if (!isFinite(eur)) { if (!vus.has(id)) { vus.add(id); ecartees.push({ id, plateforme: 'Leboncoin', raison: 'prix inconnu', titre: v.title || '', manque: true }); } continue; }
    const t = Date.parse(v.dateVente || '');
    if (!t) { if (!vus.has(id)) { vus.add(id); aDaterOuDeclaree({ id, plateforme: 'Leboncoin', eur, titre: v.title || '', masquee: false }); } continue; }
    const l = { id, plateforme: 'Leboncoin', ts: t, ym: ymDeTs(t), eur, titre: v.title || '', masquee: false };
    if (garde(l)) lignes.push(place(l));
  }
  for (const e of (ebay || [])) {
    // (2 nov., audit P1) Une commande REMBOURSÉE EN PARTIE (`PARTIALLY_REFUNDED`)
    // sortait de partout sans rien dire : elle est mise à part et NOMMÉE (« au
    // moins »), son montant réel n'étant pas lu (§5 : un total partiel se dit).
    if (e && e.orderId && String(e.orderPaymentStatus || '').toUpperCase() === 'PARTIALLY_REFUNDED') {
      if (excluAutre && excluAutre('ebay', e)) { exclues += 1; continue; }
      const idp = 'ebay:' + e.orderId;
      if (!vus.has(idp)) { vus.add(idp); ecartees.push({ id: idp, plateforme: 'eBay', raison: 'remboursement partiel — montant à vérifier sur eBay', titre: (Array.isArray(e.lineItems) && e.lineItems[0] && e.lineItems[0].title) || '', manque: true }); }
      continue;
    }
    if (!e || String(e.orderPaymentStatus || '').toUpperCase() !== 'PAID' || !e.orderId) continue;
    if (excluAutre && excluAutre('ebay', e)) { exclues += 1; continue; }
    // (revue argent, 19 oct.) Une commande ANNULÉE garde `PAID` (eBay le temps
    // du remboursement, et VRM quand il accepte une annulation :
    // `annulerCommandeRangee`). Ce n'est pas de l'argent reçu : hors du CA.
    if (!commandeEbayEngagee(e)) continue;
    const id = 'ebay:' + e.orderId;
    const recu = montantRecuEbay(e);
    // (2 nov., audit des données G1) `manque` : elle n'est dans AUCUN mois, le
    // « reçu », le CA déclaré et la carte URSSAF disent « au moins » et la nomment.
    if (recu.eur == null) { if (!vus.has(id)) { vus.add(id); ecartees.push({ id, plateforme: 'eBay', raison: recu.raison, titre: '', manque: true, ts: Date.parse(e.creationDate || '') || null }); } continue; }
    const eur = recu.eur;
    const t = Date.parse(e.creationDate || '');
    if (!t) { if (!vus.has(id)) { vus.add(id); aDaterOuDeclaree({ id, plateforme: 'eBay', eur, titre: '', masquee: false }); } continue; }
    const titre = (Array.isArray(e.lineItems) && e.lineItems[0] && e.lineItems[0].title) || '';
    const l = { id, plateforme: 'eBay', ts: t, ym: ymDeTs(t), eur, titre, masquee: false };
    if (garde(l)) lignes.push(place(l));
  }
  // (1er nov., audit A2) VESTIAIRE : une vente compte si son montant REÇU est
  // sûr (`montantRecuVc` : la clé dit que c'est ce que Vestiaire te verse, en
  // euros) et datée de son VERSEMENT (`dateVersementVc`). Montant pas sûr ⇒
  // mise à part et NOMMÉE (`manque`) : le total dit « au moins », jamais un
  // total partiel présenté complet (§5). Finalisée sans date de versement ⇒
  // « à dater » ; pas encore versée ⇒ pas encore reçue (comme Vinted).
  for (const v of (vestiaire || [])) {
    if (!v || !v.id || vcVenteAnnulee(v)) continue;
    if (excluAutre && excluAutre('vestiaire', v)) { exclues += 1; continue; }
    const id = 'vestiaire:' + v.id;
    if (vus.has(id)) continue;
    const recu = montantRecuVc(v);
    if (recu.eur == null) { vus.add(id); ecartees.push({ id, plateforme: 'Vestiaire', raison: recu.raison, titre: '', manque: true, tsVente: dateVenteVc(v) || null }); continue; }
    const t = dateVersementVc(v);
    if (!t) { const et = etapeMotVc(v); if (et === 'versee' || et === 'terminee') { vus.add(id); aDaterOuDeclaree({ id, plateforme: 'Vestiaire', eur: recu.eur, titre: '', masquee: false }); } continue; }
    const l = { id, plateforme: 'Vestiaire', ts: t, ym: ymDeTs(t), eur: recu.eur, titre: '', masquee: false };
    if (garde(l)) lignes.push(place(l));
  }
  return { lignes, aDater, ecartees, exclues, declare: idx ? 'lu' : 'pasSu' };
};

export const ventesFaites = ({ vinted, lbc, ebay, vestiaire, cachee, excluAutre } = {}) => {
  const lignes = [], vus = new Set();
  let sansDate = 0, ecartees = 0;   // ecartees : commandes eBay au montant reçu illisible (montantRecuEbay)
  // (1er nov., audits A2 et A10) Les ventes FAITES dont l'argent ne se lit pas
  // (Vinted au prix illisible, Leboncoin au prix inconnu, Vestiaire au montant
  // pas sûr) : jamais 0 €, jamais tues — rangées ici, avec leur date de vente
  // quand on l'a (`ts`), pour que chaque total dise « au moins » et les NOMME.
  const nonComptees = [];
  const garde = (id) => { if (vus.has(id)) return false; vus.add(id); return true; };
  for (const o of (vinted || [])) {
    if (!o || (cachee && cachee(o))) continue;
    if (classifyOrderStatus(o.status) === 'cancelled') continue;
    const t = tsCommande(o); if (!t) continue;
    const tx = o.transaction_id != null ? o.transaction_id : o.id;
    if (tx != null && !garde('vinted:' + tx)) continue;
    const eurV = montantCommandeLu(o);
    if (eurV == null) { nonComptees.push({ plateforme: 'Vinted', raison: 'prix pas lu', ts: t }); continue; }
    // (31 oct.) `compte` : le compte qui a vendu (Statistiques → « Par compte »), le même nom que le relevé des ventes.
    // (4 nov.) `tx` et `uid` : l'identité de la vente et de son compte, pour les statistiques des offres (src/statsOffres.js).
    lignes.push({ plateforme: 'Vinted', ts: t, eur: eurV, compte: String((o._acc && (o._acc.login || o._acc.vinted_user_id)) || ''), uid: String((o._acc && o._acc.vinted_user_id) || ''), tx: tx != null ? String(tx) : '' });
  }
  for (const v of (lbc || [])) {
    if (!v || v.isSeller !== true || !v.txId || lbcAnnulee(v)) continue;
    if (excluAutre && excluAutre('leboncoin', v)) continue;   // (3 nov.) compte écarté par son choix
    const eur = v.price != null ? Number(v.price) / 100 : NaN;
    if (!isFinite(eur)) { if (garde('lbc:' + v.txId)) nonComptees.push({ plateforme: 'Leboncoin', raison: 'prix inconnu', ts: Date.parse(v.dateVente || '') || null }); continue; }
    const t = Date.parse(v.dateVente || '');
    if (!t) { if (garde('lbc:' + v.txId)) sansDate += 1; continue; }
    // (1er nov., audit A11) Une date posée à la main (`dateSaisie`, rangée à midi
    // par `avecDatesLbc`) ou lue sans heure n'a pas d'HEURE : elle ne compte dans
    // aucune case « Quand tu vends » (`heureLue: false` ⇒ « sans heure »).
    if (garde('lbc:' + v.txId)) lignes.push({ plateforme: 'Leboncoin', ts: t, eur, compte: String(v.account || ''), heureLue: !(v.dateSaisie === true || /^\d{4}-\d{2}-\d{2}$/.test(String(v.dateVente).trim())) });
  }
  for (const e of (ebay || [])) {
    if (e && excluAutre && excluAutre('ebay', e)) continue;   // (3 nov.) compte écarté par son choix
    // (2 nov., P1) Remboursée en partie : vendue, mais son montant n'est pas sûr ⇒ nommée.
    if (e && e.orderId && String(e.orderPaymentStatus || '').toUpperCase() === 'PARTIALLY_REFUNDED') { if (garde('ebay:' + e.orderId)) nonComptees.push({ plateforme: 'eBay', raison: 'remboursement partiel — montant à vérifier', ts: Date.parse(e.creationDate || '') || null }); continue; }
    if (!e || String(e.orderPaymentStatus || '').toUpperCase() !== 'PAID' || !e.orderId) continue;
    if (!commandeEbayEngagee(e)) continue;   // annulée : rien de vendu (même règle que le CA déclaré)
    const eur = montantRecuEbay(e).eur, t = Date.parse(e.creationDate || '');
    // (2 nov., audit des données G1) Frais eBay pas encore lus, autre devise :
    // la commande est VENDUE mais son argent ne se lit pas — NOMMÉE comme les
    // autres (`nonComptees`, avec sa date), sinon Ma journée, Statistiques, le
    // widget et le bilan disaient un « vendu » complet sans elle (§5).
    if (eur == null && !vus.has('ebay:' + e.orderId)) nonComptees.push({ plateforme: 'eBay', raison: montantRecuEbay(e).raison, ts: t || null });
    if (eur == null) { if (garde('ebay:' + e.orderId)) ecartees += 1; continue; }
    if (!t) continue;
    if (garde('ebay:' + e.orderId)) lignes.push({ plateforme: 'eBay', ts: t, eur, compte: String(e._pseudo || e._compte || '') });
  }
  // VESTIAIRE, au jour de la VENTE : compté si le montant reçu est sûr et la
  // vente datée ; sinon NOMMÉ (`nonComptees`), jamais deviné.
  for (const v of (vestiaire || [])) {
    if (!v || !v.id || vcVenteAnnulee(v) || (excluAutre && excluAutre('vestiaire', v)) || !garde('vestiaire:' + v.id)) continue;
    const t = dateVenteVc(v), recu = montantRecuVc(v);
    if (recu.eur == null) { nonComptees.push({ plateforme: 'Vestiaire', raison: recu.raison, ts: t || null }); continue; }
    if (!t) { nonComptees.push({ plateforme: 'Vestiaire', raison: 'vente pas datée', ts: null }); continue; }
    lignes.push({ plateforme: 'Vestiaire', ts: t, eur: recu.eur, compte: String(v.compte || '') });
  }
  return { lignes, sansDate, ecartees, nonComptees };
};

export const compteEcarteChoix = (uid, masques, panneau) => {
  const k = String(uid ?? '');
  const pa = panneau || {};
  if (pa[k] === false) return false;
  return (masques && masques.has(k)) || pa[k] === true;
};

export const compteEcarte = compteEcarteChoix;
