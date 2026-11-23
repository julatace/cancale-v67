// ════════════════════════════════════════════════════════════════════════════
//  « VENDU ! » POUR LEBONCOIN, eBAY ET VESTIAIRE (16 nov. 2026, lot plateformes-restes)
// ════════════════════════════════════════════════════════════════════════════
// Décision de Julien (relayée le 16 nov.) : chaque vente Leboncoin, eBay et Vestiaire
// Collective est notifiée comme celles de Vinted, UNE fois par vente, dans la famille
// « Ventes » existante. Aucun e-mail de vente de ces sites n'existe en base (mesuré le
// 16 nov.) : la source est CE QUE VRM LIT DÉJÀ —
//   · Leboncoin : `lbc_ventes.ventes` (rangé par l'extension, ventes `isSeller === true`) ;
//   · Vestiaire : `vc_ventes` (rangé par l'extension, `ventesVcDe`) ;
//   · eBay      : `ebay_orders*` (rangées par l'app ou par le cron du matin, comptes actifs).
// ⇒ Leboncoin et Vestiaire dépendent de la LECTURE par l'extension (une vente pas encore
//   relue n'est pas notifiée) ; eBay de la dernière lecture des commandes.
//
// L'IDENTITÉ d'une vente : son n° sur la plateforme (n° de transaction Leboncoin, n° de
// commande eBay, productId Vestiaire) — jamais un titre. Le mémo `MEMO_VENTES_SITES` porte :
//   · `comptes` : les comptes déjà LUS une fois (« site:compte » ⇒ date) ;
//   · `vus`     : les ventes déjà connues (« site:n° » ⇒ date).
// Règles (module PUR, exécuté par scripts/audit-plateformes-restes.cjs) :
//   1. un compte vu pour la PREMIÈRE fois ⇒ toutes ses ventes sont rangées « vues », AUCUNE
//      notification (l'historique importé ne sonne jamais) ;
//   2. une plateforme pas lue (`null`/`undefined`) ⇒ rien ne change pour elle ;
//   3. une vente annulée / remboursée / non payée ⇒ pas de notification (elle reste « pas vue » :
//      si elle redevient une vente, elle sonnera) ;
//   4. une vente datée de plus de `FRAICHEUR_MS` (72 h), ou SANS date lisible ⇒ rangée vue,
//      sans notification (une vieille vente relue tard n'est pas « vendu ! ») ;
//   5. jamais deux fois : `vus` ici, et le tag réservé dans `push_dedup` par l'appelant (le tag
//      Vestiaire est celui de l'e-mail de vente Vestiaire : `vc-vente-{productId}`).
// Le N° n'est dit que s'il vient de l'identité (Vestiaire : `num` de `ventesVcDe`) ; eBay et
// Leboncoin : pas de N° (un SKU d'avant la remise à zéro désigne l'ancienne paire) — un blanc.

export const MEMO_VENTES_SITES = 'vrm_ventes_sites_vues';
export const FRAICHEUR_MS = 72 * 3600 * 1000;
const MAX_VUS = 5000;
const txt = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const NOM = { leboncoin: 'Leboncoin', ebay: 'eBay', vestiaire: 'Vestiaire' };
const datee = (v) => { const s = txt(v); if (!s) return null; const t = /^\d{4}-\d{2}-\d{2}$/.test(s) ? Date.parse(s + 'T12:00:00Z') : Date.parse(s); return Number.isFinite(t) ? t : null; };

// Les ventes de chaque plateforme, sous une forme commune. `R` : les règles serveur
// (`lbcAnnulee`, `etatCommandeEbay`, `vcVenteAnnulee`, `dateVenteVc`) — jamais recopiées ici.
export function ventesDesSites({ lbc, ebay, vestiaire }, R) {
  const out = {};
  if (lbc === null || lbc === undefined) out.leboncoin = null;
  else {
    const l = [];
    const liste = Array.isArray(lbc) ? lbc : Object.values(lbc && typeof lbc === 'object' ? lbc : {});
    for (const o of liste) {
      if (!o || o.isSeller !== true || !ID.test(txt(o.txId))) continue;
      const eur = Number(o.price) / 100;
      l.push({ site: 'leboncoin', id: txt(o.txId), compte: txt(o.account) || 'principal', titre: txt(o.title), eur: Number.isFinite(eur) && eur > 0 ? eur : null,
        t: datee(o.dateVente), engagee: !R.lbcAnnulee(o), tag: `vendu-leboncoin-${txt(o.txId)}`, num: '' });
    }
    out.leboncoin = l;
  }
  if (!Array.isArray(ebay)) out.ebay = null;
  else {
    out.ebay = ebay.filter((o) => o && ID.test(txt(o.orderId))).map((o) => {
      const e = R.etatCommandeEbay(o);
      const li = (Array.isArray(o.lineItems) ? o.lineItems : [])[0] || {};
      const c = o.lineItems && o.lineItems.length === 1 ? (li.lineItemCost || {}) : {};
      const eur = String(c.currency || '').toUpperCase() === 'EUR' ? Number(c.value) : NaN;
      return { site: 'ebay', id: txt(o.orderId), compte: txt(o._compte) || 'principal', titre: txt(li.title), eur: Number.isFinite(eur) && eur > 0 ? eur : null,
        t: datee(o.creationDate), engagee: !['cancelled', 'refunded', 'payment'].includes(e.kind), tag: `vendu-ebay-${txt(o.orderId)}`, num: '' };
    });
  }
  if (!Array.isArray(vestiaire)) out.vestiaire = null;
  else {
    out.vestiaire = vestiaire.filter((v) => v && ID.test(txt(v.productId || v.id))).map((v) => {
      const pid = txt(v.productId || v.id);
      const pv = v.prixVente && v.prixVente.devise === 'EUR' ? Number(v.prixVente.valeur) : NaN;
      return { site: 'vestiaire', id: pid, compte: txt(v.compte) || 'principal', titre: txt(v.titre), eur: Number.isFinite(pv) && pv > 0 ? pv : null,
        t: R.dateVenteVc(v), engagee: !R.vcVenteAnnulee(v), tag: `vc-vente-${pid}`, num: txt(v.num) };
    });
  }
  return out;
}

// Ce qui sonne, et le mémo après ce passage. `memo` : lu (objet ou null) — jamais `undefined`
// (l'appelant n'appelle pas sur une lecture ratée).
export function ventesANotifier(memo, parSite, maintenant = Date.now()) {
  const m = memo && typeof memo === 'object' ? memo : {};
  const comptes = { ...(m.comptes && typeof m.comptes === 'object' ? m.comptes : {}) };
  const vus = { ...(m.vus && typeof m.vus === 'object' ? m.vus : {}) };
  const nouvelles = [];
  let premieres = 0;
  for (const site of ['leboncoin', 'ebay', 'vestiaire']) {
    const l = parSite && parSite[site];
    if (!Array.isArray(l)) continue;                                   // pas lue : rien ne change
    const neufs = new Set();
    for (const v of l) { const ck = `${site}:${v.compte}`; if (!comptes[ck]) neufs.add(ck); }
    for (const v of l) {
      const ck = `${site}:${v.compte}`, k = `${site}:${v.id}`;
      if (vus[k]) continue;
      if (neufs.has(ck)) { vus[k] = maintenant; premieres++; continue; }   // 1re lecture du compte : l'historique
      if (!v.engagee) continue;                                        // annulée : pas « vendu », pas « vue »
      vus[k] = maintenant;
      if (v.t == null || maintenant - v.t > FRAICHEUR_MS || v.t - maintenant > FRAICHEUR_MS) continue;   // vieille ou sans date : silencieuse
      nouvelles.push(v);
    }
    for (const ck of neufs) comptes[ck] = maintenant;
  }
  const cles = Object.keys(vus);
  if (cles.length > MAX_VUS) { cles.sort((a, b) => vus[a] - vus[b]); for (const k of cles.slice(0, cles.length - MAX_VUS)) delete vus[k]; }
  return { nouvelles, premieres, memoApres: { v: 1, comptes, vus, at: new Date(maintenant).toISOString() } };
}

// Les données du texte « Vendu » (famille existante, `texteVendu`) : « Vendu 45 € · N°124 · titre »,
// « sur Leboncoin ».
export const donneesVendu = (v) => ({ article: [v.num ? `N°${v.num}` : '', v.titre].filter(Boolean).join(' · '), prix: v.eur != null ? v.eur : '', compte: `sur ${NOM[v.site] || v.site}`, ailleurs: true });
