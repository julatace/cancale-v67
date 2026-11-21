// ── TAUX D'ANNULATION PAR COMPTE (3 nov.) ───────────────────────────────────
// Julien : ventes annulées / ventes, par compte et plateforme, sur la période
// choisie, avec la liste des annulations (chacune ouvre SA vente).
// Règle PURE : Statistiques et `scripts/audit-annulations-compte.cjs` l'appellent.
//
// ⚠️ « ANNULÉE » N'EST PAS REDÉFINIE ICI : `estAnnulee` est passée par l'app —
//    `classifyOrderStatus(status) === 'cancelled'`, qu'audit-flux-divers.cjs
//    juge équivalente à `PAS_UNE_VENTE` (annulée, refusée, remboursée, retour,
//    suspendue, paiement échoué). Une vente n'est annulée que par SON ÉTAT LU,
//    jamais déduite d'une absence (une vente disparue de la liste n'est rien).
// ⚠️ Population : les commandes LUES (ventes Vinted de la coque, tous comptes
//    sélectionnés), datées au jour de la VENTE dans [de, a). Une commande sans
//    date lisible n'entre dans aucune période : comptée à part (`sansDate`).
//    Un compte dont la lecture a raté (`ko`) n'a AUCUN chiffre (« — », jamais
//    0 %) et le total le dit (`manquants`).
// ⚠️ Couverture : Leboncoin, eBay et Vestiaire n'ont pas de règle « annulée »
//    lue ici — dits « pas comptés » (`nonCouvertes`), jamais 0 %.
export const PLATEFORMES_COUVERTES = ['Vinted'];
export const PLATEFORMES_NON_COUVERTES = ['Leboncoin', 'eBay', 'Vestiaire'];

const pct = (a, n) => (n ? Math.round(a / n * 1000) / 10 : null);
const montant = (o) => { const v = o && o.price && typeof o.price === 'object' ? o.price.amount : o && o.price; const n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) ? n : null; };

// Le lien de LA vente sur Vinted : sa conversation, sinon sa transaction —
// la même forme que les autres écrans (`lienVente`).
export const lienVenteVinted = (o) => {
  if (!o) return '';
  if (o.conversation_id) return `https://www.vinted.fr/inbox/${encodeURIComponent(o.conversation_id)}`;
  if (o.transaction_id != null && o.transaction_id !== '') return `https://www.vinted.fr/member/transactions/${encodeURIComponent(o.transaction_id)}`;
  return '';
};

// ventes : `undefined` pas encore lu · `null` aucune lecture · tableau de
// commandes { status, date, transaction_id, conversation_id, title, price, _acc }.
// `ecarte(uid)` : compte exclu des totaux (il n'apparaît nulle part, même pas en manque).
export const annulationsParCompte = ({ ventes, ko = [], de, a, estAnnulee, ecarte = () => false, nomCompte } = {}) => {
  if (ventes === undefined) return { etat: 'encours' };
  if (!Array.isArray(ventes)) return { etat: 'passu' };
  const koSet = new Set((ko || []).map(String));
  const parCle = new Map();
  let sansDate = 0;
  const uidDe = (o) => String((o && o._acc && o._acc.vinted_user_id) ?? '');
  const nomDe = (o) => (nomCompte ? nomCompte(o) : '') || (o && o._acc && o._acc.login) || uidDe(o) || 'Vinted';
  for (const o of ventes) {
    if (!o) continue;
    const uid = uidDe(o);
    if (ecarte(uid)) continue;
    if (koSet.has(uid)) continue;                       // compte pas lu : aucun chiffre pour lui
    const t = Date.parse(o.date || '');
    if (!isFinite(t)) { sansDate += 1; continue; }
    if (t < de || t >= a) continue;
    const cle = `Vinted|${uid}`;
    const g = parCle.get(cle) || { cle, plateforme: 'Vinted', uid, compte: nomDe(o), n: 0, annulees: 0, liste: [] };
    g.n += 1;
    if (estAnnulee(o)) {
      g.annulees += 1;
      g.liste.push({ id: String(o.transaction_id ?? o.id ?? ''), titre: o.title || '', ts: t, statut: String(o.status || ''), eur: montant(o), lien: lienVenteVinted(o) });
    }
    parCle.set(cle, g);
  }
  const comptes = [...parCle.values()].map((g) => ({ ...g, taux: pct(g.annulees, g.n), liste: g.liste.sort((x, y) => y.ts - x.ts) }))
    .sort((x, y) => (y.taux ?? -1) - (x.taux ?? -1) || y.n - x.n || (x.compte < y.compte ? -1 : 1));
  const manquants = [...koSet].filter((u) => !ecarte(u));
  const n = comptes.reduce((s, g) => s + g.n, 0), annulees = comptes.reduce((s, g) => s + g.annulees, 0);
  return {
    etat: 'lu', comptes, n, annulees, taux: pct(annulees, n), partiel: manquants.length > 0, manquants, sansDate,
    nonCouvertes: PLATEFORMES_NON_COUVERTES.slice(),
    liste: comptes.flatMap((g) => g.liste.map((x) => ({ ...x, compte: g.compte, plateforme: g.plateforme }))).sort((x, y) => y.ts - x.ts),
  };
};
