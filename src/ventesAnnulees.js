// ── LES VENTES ANNULÉES, TOUTES PLATEFORMES (22 nov.) ───────────────────────
// Julien : « les ventes annulées pour chaque plateforme doivent être comptabilisées ».
// UNE règle, UN propriétaire (§5, §11) : Statistiques, Ventes et « À régler » lisent
// CE module ; `scripts/audit-ventes-annulees.cjs` l'exécute.
//
// ⚠️ « ANNULÉE » N'EST PAS REDÉFINIE ICI. Chaque plateforme garde SA règle, passée par
//    l'app (`R`) — celles qui sortent déjà la vente du Vendu, du Reçu et de l'URSSAF :
//      · Vinted    : `classifyOrderStatus(status) === 'cancelled'` (⇔ `PAS_UNE_VENTE`) ;
//      · Leboncoin : `lbcAnnulee` — et seulement s'il est PROUVÉ vendeur (`isSeller === true`) ;
//      · eBay      : `etatCommandeEbay` (« CANCELED », ou remboursée EN ENTIER) ;
//      · Vestiaire : `vcVenteAnnulee`.
//    Ce module ajoute seulement : l'identité (`plateforme:n°`, jamais un titre), le
//    MOTIF quand la plateforme le dit, le montant annulé, et les comptes.
// ⚠️ UNE VENTE ANNULÉE N'EST DANS AUCUN TOTAL D'ARGENT. Son montant n'existe que
//    dans `eurAnnule` (« montant annulé »), jamais additionné à un vendu ni à un reçu.
// ⚠️ « PAS SU » NE VAUT PAS « ZÉRO » : une plateforme pas lue n'a AUCUN chiffre
//    (`etat` ≠ 'lu' ⇒ `annulees: null`, `taux: null`) et le total la NOMME (`manquantes`).
//    Un motif que la plateforme ne dit pas est `passu`, jamais deviné.
// ⚠️ La date est celle de la VENTE (la seule lue partout). La date de l'annulation
//    n'est connue que si la plateforme la donne (`tsAnnulation`, eBay) : sinon `null`.
// Mesuré en production le 22 nov. (lecture seule, nombres seulement) : Vinted 331
// annulées sur 3 548 ventes lues (328 « Remboursement effectué », 2 « non réclamée —
// retournée », 1 « Retour initié » : Vinted ne dit PAS qui a annulé) ; Leboncoin 5
// « cancelled » dont AUCUNE ne dit s'il est vendeur ou acheteur (⇒ « rôle pas su ») ;
// Vestiaire 1 « CANCELLED » sur 3 ; eBay : aucune commande rangée (forme de
// l'annulation = celle de l'API Fulfillment, `cancelStatus`).

export const PLATEFORMES = ['Vinted', 'Leboncoin', 'eBay', 'Vestiaire'];
export const MOTIFS = ['acheteur', 'vendeur', 'non-payee', 'expiree', 'refusee', 'suspendue', 'remboursee', 'retour', 'non-reclamee', 'litige', 'passu'];
// « Retour remboursé = à part » : la paire est PARTIE puis revenue (ou se discute) —
// ce n'est pas une annulation avant l'envoi. Compté à côté, jamais dans le taux.
export const MOTIFS_RETOUR = ['retour', 'non-reclamee', 'litige'];

const pct = (a, n) => (n ? Math.round(a / n * 1000) / 10 : null);
const txt = (x) => String(x == null ? '' : x);
const dateMs = (d) => { const t = typeof d === 'number' ? d : Date.parse(d || ''); return Number.isFinite(t) && t > 0 ? t : null; };
const eurOuNull = (n) => (n == null || !Number.isFinite(Number(n)) || Number(n) < 0 ? null : Math.round(Number(n) * 100) / 100);

// Le motif lu dans le MOT de la plateforme. L'ordre compte : ce qui est le plus précis d'abord.
export const motifDuMot = (mot) => {
  const s = txt(mot);
  if (!s.trim()) return 'passu';
  if (/litige|dispute/i.test(s)) return 'litige';
  if (/non\s+r[ée]clam|unclaimed/i.test(s)) return 'non-reclamee';
  if (/retour|return/i.test(s)) return 'retour';
  if (/paiement.*[ée]chou|[ée]chec\s+du\s+paiement|no.?payment|unpaid|not.?paid|non\s+pay/i.test(s)) return 'non-payee';
  if (/expir/i.test(s)) return 'expiree';
  if (/annul.*(acheteu|buyer)|(acheteu|buyer).*(annul|cancel)|cancel.*buyer/i.test(s)) return 'acheteur';
  if (/annul.*(vendeu|seller)|(vendeu|seller).*(annul|cancel)|cancel.*seller|tu\s+as\s+annul|out.?of.?stock/i.test(s)) return 'vendeur';
  if (/refus/i.test(s)) return 'refusee';
  if (/suspend/i.test(s)) return 'suspendue';
  if (/rembours|refund/i.test(s)) return 'remboursee';
  return 'passu';
};
const sorteDe = (motif) => (MOTIFS_RETOUR.includes(motif) ? 'retour' : 'annulee');

// Le motif d'une commande eBay : la demande d'annulation la plus récente dit QUI et POURQUOI
// (`cancelStatus.cancelRequests[]` de l'API Fulfillment). Rien de lisible ⇒ `passu`.
const motifEbay = (o) => {
  const reqs = o && o.cancelStatus && Array.isArray(o.cancelStatus.cancelRequests) ? o.cancelStatus.cancelRequests.filter(Boolean) : [];
  const r = reqs[reqs.length - 1] || null;
  const raison = txt(r && r.cancelReason), qui = txt(r && (r.cancelInitiator || r.cancelRequestor || r.requestorType));
  let motif = 'passu';
  if (/NO.?PAYMENT|UNPAID|NOT.?PAID/i.test(raison)) motif = 'non-payee';
  else if (/BUYER/i.test(qui)) motif = 'acheteur';
  else if (/SELLER/i.test(qui)) motif = 'vendeur';
  else if (/BUYER/i.test(raison)) motif = 'acheteur';
  else if (/OUT.?OF.?STOCK|SELLER/i.test(raison)) motif = 'vendeur';
  return { motif, tsAnnulation: dateMs(r && (r.cancelCompletedDate || r.cancelRequestedDate)) || dateMs(o && o._annuleeParVrm) };
};

const etatSource = (x) => (x === undefined ? 'encours' : Array.isArray(x) ? 'lu' : 'passu');

// sources : pour chaque plateforme `undefined` lecture en cours · `null` pas su · tableau lu.
//   vinted    : commandes { status, date, transaction_id, title, price, _acc } ; `ko` : uid pas lus
//   lbc       : ventes { txId, isSeller, stepStatus, price (centimes), dateVente, account, title }
//   ebay      : commandes { orderId, cancelStatus, orderPaymentStatus, creationDate, pricingSummary }
//   vestiaire : ventes { id, etat, date, prixVente, compte, titre }
// R : les règles de l'app (voir l'en-tête). `ecarteVinted(uid)`, `excluAutre(site, o)` : comptes écartés par son choix.
// `lbcRoleInconnu` : le nombre d'annulées Leboncoin SANS rôle lu, quand l'appelant ne passe que les ventes prouvées
// (la coque sépare ventes / achats / rôle pas su avant de les donner).
export const ventesAnnulees = ({ vinted, ko = [], lbc, ebay, vestiaire, R = {}, ecarteVinted = () => false, excluAutre = () => false, nomCompteVinted = null, lbcRoleInconnu = 0 } = {}) => {
  const lignes = [], faites = [], vus = new Set();
  const couverture = {};
  const garde = (cle) => { if (vus.has(cle)) return false; vus.add(cle); return true; };
  const pose = (l) => { lignes.push({ ...l, sorte: sorteDe(l.motif) }); };

  // ── Vinted ──
  const koV = (ko || []).map(String).filter((u) => !ecarteVinted(u));
  couverture.Vinted = { etat: etatSource(vinted), manquants: koV, sansDate: 0, roleInconnu: 0, demandees: 0 };
  if (Array.isArray(vinted)) for (const o of vinted) {
    if (!o) continue;
    const uid = txt(o._acc && o._acc.vinted_user_id);
    if (ecarteVinted(uid) || koV.includes(uid)) continue;
    const tx = o.transaction_id != null ? o.transaction_id : o.id;
    if (tx == null || tx === '' || !garde('vinted:' + tx)) continue;
    const ts = dateMs(o.date);
    const compte = (nomCompteVinted && nomCompteVinted(o)) || txt(o._acc && o._acc.login) || uid || 'Vinted';
    if (!R.annuleeVinted || !R.annuleeVinted(o)) { if (ts == null) couverture.Vinted.sansDate += 1; else faites.push({ plateforme: 'Vinted', uid, compte, ts }); continue; }
    if (ts == null) couverture.Vinted.sansDate += 1;
    const motif = motifDuMot(o.status);
    pose({ cle: 'vinted:' + tx, plateforme: 'Vinted', id: txt(tx), uid, compte, ts, tsAnnulation: null, eur: eurOuNull(R.montantVinted ? R.montantVinted(o) : null), motif, mot: txt(o.status), titre: txt(o.title), conv: o.conversation_id != null ? txt(o.conversation_id) : '' });
  }

  // ── Leboncoin ── vendeur PROUVÉ seulement ; « annulée » sans rôle lu : comptée à part, dite.
  couverture.Leboncoin = { etat: etatSource(lbc), manquants: [], sansDate: 0, roleInconnu: Array.isArray(lbc) && Number.isInteger(lbcRoleInconnu) && lbcRoleInconnu > 0 ? lbcRoleInconnu : 0, demandees: 0 };
  if (Array.isArray(lbc)) for (const v of lbc) {
    if (!v || !v.txId || excluAutre('leboncoin', v)) continue;
    const ann = !!(R.lbcAnnulee && R.lbcAnnulee(v));
    if (v.isSeller !== true) { if (ann && v.isSeller !== false && garde('lbc?:' + v.txId)) couverture.Leboncoin.roleInconnu += 1; continue; }
    if (!garde('lbc:' + v.txId)) continue;
    const ts = dateMs(v.dateVente), compte = txt(v.accountName || v.account), uid = txt(v.account);
    if (!ann) { if (ts == null) couverture.Leboncoin.sansDate += 1; else faites.push({ plateforme: 'Leboncoin', uid, compte, ts }); continue; }
    if (ts == null) couverture.Leboncoin.sansDate += 1;
    const mot = [v.stepLabel, v.parcelStatus, v.stepStatus].filter(Boolean).join(' · ');
    // « cancelled » seul ne dit ni qui ni pourquoi.
    const motif = motifDuMot([v.stepLabel, v.parcelStatus].filter(Boolean).join(' '));
    pose({ cle: 'lbc:' + v.txId, plateforme: 'Leboncoin', id: txt(v.txId), uid, compte, ts, tsAnnulation: null, eur: v.price != null ? eurOuNull(Number(v.price) / 100) : null, motif, mot, titre: txt(v.title), annonce: v.itemId != null ? txt(v.itemId) : '' });
  }

  // ── eBay ──
  couverture.eBay = { etat: etatSource(ebay), manquants: [], sansDate: 0, roleInconnu: 0, demandees: 0 };
  if (Array.isArray(ebay)) for (const o of ebay) {
    if (!o || !o.orderId || excluAutre('ebay', o) || !garde('ebay:' + o.orderId)) continue;
    const e = R.etatEbay ? R.etatEbay(o) : null;
    const paiement = txt(o.orderPaymentStatus).toUpperCase();
    const ts = dateMs(o.creationDate), compte = txt(o._pseudo || o._compte), uid = txt(o._compte);
    const annulee = !!e && (e.kind === 'cancelled' || (e.kind === 'refunded' && paiement === 'FULLY_REFUNDED'));
    if (!annulee) {
      // Annulation demandée, pas tranchée : ni annulée ni faite — dite à part.
      const cancel = txt(o.cancelStatus && o.cancelStatus.cancelState).toUpperCase();
      if (cancel && !['NONE_REQUESTED', 'CANCEL_REJECTED', 'CANCELED'].includes(cancel)) { couverture.eBay.demandees += 1; continue; }
      if (paiement !== 'PAID' && paiement !== 'PARTIALLY_REFUNDED') continue;   // pas encore payée : pas une vente
      if (ts == null) couverture.eBay.sansDate += 1; else faites.push({ plateforme: 'eBay', uid, compte, ts });
      continue;
    }
    if (ts == null) couverture.eBay.sansDate += 1;
    const m = e.kind === 'cancelled' ? motifEbay(o) : { motif: 'remboursee', tsAnnulation: null };
    const st = o.pricingSummary && o.pricingSummary.priceSubtotal;
    const li = (o.lineItems || [])[0] || {};
    // Une autre devise n'est pas sue EN EUROS : jamais convertie.
    const eur = st && st.value != null && (!st.currency || txt(st.currency).toUpperCase() === 'EUR') ? eurOuNull(st.value) : null;
    pose({ cle: 'ebay:' + o.orderId, plateforme: 'eBay', id: txt(o.orderId), uid, compte, ts, tsAnnulation: m.tsAnnulation, eur, motif: m.motif, mot: txt(e.label), titre: txt(li.title), annonce: li.legacyItemId != null ? txt(li.legacyItemId) : '' });
  }

  // ── Vestiaire ──
  couverture.Vestiaire = { etat: etatSource(vestiaire), manquants: [], sansDate: 0, roleInconnu: 0, demandees: 0 };
  if (Array.isArray(vestiaire)) for (const v of vestiaire) {
    if (!v || !v.id || excluAutre('vestiaire', v) || !garde('vestiaire:' + v.id)) continue;
    const ts = R.dateVenteVc ? dateMs(R.dateVenteVc(v)) : dateMs(v.date);
    const compte = txt(v.compte), uid = compte;
    if (!R.vcVenteAnnulee || !R.vcVenteAnnulee(v)) { if (ts == null) couverture.Vestiaire.sansDate += 1; else faites.push({ plateforme: 'Vestiaire', uid, compte, ts }); continue; }
    if (ts == null) couverture.Vestiaire.sansDate += 1;
    const pv = v.prixVente && typeof v.prixVente === 'object' && (!v.prixVente.devise || v.prixVente.devise === 'EUR') ? v.prixVente.valeur : null;
    // « CANCELLED » : annulée, Vestiaire ne dit pas par qui ⇒ `passu` ; un mot de retour / litige / remboursement est lu.
    const motif = /cancel|annul/i.test(txt(v.etat)) && !/return|retour|refund|rembours|litige|dispute/i.test(txt(v.etat)) ? motifDuMot(txt(v.statutVc)) : motifDuMot(v.etat);
    pose({ cle: 'vestiaire:' + v.id, plateforme: 'Vestiaire', id: txt(v.id), uid, compte, ts, tsAnnulation: null, eur: eurOuNull(pv), motif, mot: txt(v.etat), titre: txt(v.titre || v.title), annonce: v.productId != null ? txt(v.productId) : '' });
  }

  lignes.sort((x, y) => (y.ts == null ? -1 : y.ts) - (x.ts == null ? -1 : x.ts) || (x.cle < y.cle ? -1 : 1));
  return { lignes, faites, couverture };
};

const ymDe = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

// Le bilan sur [de, a) (date de VENTE) : par plateforme, par compte, par mois.
//   taux d'annulation = annulées / (faites + annulées) — les retours sont à part.
// Une plateforme pas lue : `etat` le dit, tous ses nombres sont `null`.
export const bilanAnnulees = (A, { de = -Infinity, a = Infinity } = {}) => {
  const dans = (t) => t != null && t >= de && t < a;
  const vide = () => ({ faites: 0, annulees: 0, retours: 0, eurAnnule: 0, eurInconnus: 0, motifs: {} });
  const ajoute = (g, l) => {
    if (l.sorte === 'retour') g.retours += 1; else g.annulees += 1;
    g.motifs[l.motif] = (g.motifs[l.motif] || 0) + 1;
    if (l.sorte === 'retour') return;   // le montant annulé ne compte que les annulations (un retour est à part)
    if (l.eur == null) g.eurInconnus += 1; else g.eurAnnule = Math.round((g.eurAnnule + l.eur) * 100) / 100;
  };
  const fini = (g) => ({ ...g, n: g.faites + g.annulees, taux: pct(g.annulees, g.faites + g.annulees) });
  const plateformes = [], moisMap = new Map(), total = vide(), manquantes = [];
  let partiel = false, sansDate = 0, roleInconnu = 0, demandees = 0;
  for (const p of PLATEFORMES) {
    const c = (A && A.couverture && A.couverture[p]) || { etat: 'passu', manquants: [] };
    if (c.etat !== 'lu') { plateformes.push({ plateforme: p, etat: c.etat, faites: null, annulees: null, retours: null, eurAnnule: null, eurInconnus: null, n: null, taux: null, comptes: [], liste: [], manquants: [] }); manquantes.push(p); partiel = true; continue; }
    const g = vide(), parCompte = new Map(), liste = [];
    const gc = (uid, compte) => { const k = `${p}|${uid}`; if (!parCompte.has(k)) parCompte.set(k, { cle: k, plateforme: p, uid, compte: compte || uid || p, ...vide(), liste: [] }); return parCompte.get(k); };
    const gm = (t) => { const k = ymDe(t); if (!moisMap.has(k)) moisMap.set(k, { ym: k, ...vide() }); return moisMap.get(k); };
    for (const f of A.faites) if (f.plateforme === p && dans(f.ts)) { g.faites += 1; total.faites += 1; gc(f.uid, f.compte).faites += 1; gm(f.ts).faites += 1; }
    for (const l of A.lignes) if (l.plateforme === p && dans(l.ts)) { ajoute(g, l); ajoute(total, l); const x = gc(l.uid, l.compte); ajoute(x, l); x.liste.push(l); ajoute(gm(l.ts), l); liste.push(l); }
    if ((c.manquants || []).length) partiel = true;
    sansDate += c.sansDate || 0; roleInconnu += c.roleInconnu || 0; demandees += c.demandees || 0;
    const comptes = [...parCompte.values()].map(fini).sort((x, y) => (y.taux ?? -1) - (x.taux ?? -1) || y.n - x.n || (x.compte < y.compte ? -1 : 1));
    plateformes.push({ plateforme: p, etat: 'lu', ...fini(g), comptes, liste, manquants: (c.manquants || []).slice(), sansDate: c.sansDate || 0, roleInconnu: c.roleInconnu || 0, demandees: c.demandees || 0 });
  }
  const mois = [...moisMap.values()].map(fini).sort((x, y) => (x.ym < y.ym ? 1 : -1));
  const aucuneLue = plateformes.every((x) => x.etat !== 'lu');
  const enCours = plateformes.some((x) => x.etat === 'encours');
  return { etat: aucuneLue ? (enCours ? 'encours' : 'passu') : 'lu', plateformes, mois, total: aucuneLue ? null : fini(total), partiel, manquantes, sansDate, roleInconnu, demandees };
};

// Garde-fou des totaux d'argent : aucune ligne d'un total (Vendu, Reçu) ne porte l'identité
// d'une vente annulée. `lignesArgent` : { plateforme, tx } (la forme de `ventesFaites`).
// Rend les identités fautives ([] = sain) — l'audit et un `console.warn` de l'app le lisent.
export const annuleesDansArgent = (A, lignesArgent) => {
  const pref = { Vinted: 'vinted:', Leboncoin: 'lbc:', eBay: 'ebay:', Vestiaire: 'vestiaire:' };
  const ann = new Set(((A && A.lignes) || []).map((l) => l.cle));
  const out = [];
  // `ventesFaites` : { plateforme, tx } ; `ventesDeclarables` : { id: 'plateforme:n°' }.
  for (const l of (lignesArgent || [])) { const k = l && typeof l.id === 'string' && l.id.includes(':') ? l.id : (l && pref[l.plateforme] && l.tx ? pref[l.plateforme] + l.tx : ''); if (k && ann.has(k)) out.push(k); }
  return out;
};
