// Commandes eBay : seule cette projection se range et revient au navigateur.
// Une page manquante ne permet jamais de remplacer la dernière capture.
const texte = v => typeof v === 'string' ? v : undefined;
const montant = v => v && texte(v.value) && texte(v.currency) ? { value: v.value, currency: v.currency } : undefined;
const objet = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
export function commandeMinimale(o) {
  if (!o || !texte(o.orderId)) return null;
  return objet({
    orderId: o.orderId, legacyOrderId: texte(o.legacyOrderId), creationDate: texte(o.creationDate), lastModifiedDate: texte(o.lastModifiedDate),
    orderPaymentStatus: texte(o.orderPaymentStatus), orderFulfillmentStatus: texte(o.orderFulfillmentStatus), salesRecordReference: texte(o.salesRecordReference),
    buyer: o.buyer && texte(o.buyer.username) ? { username: o.buyer.username } : undefined,
    cancelStatus: o.cancelStatus ? objet({ cancelState: texte(o.cancelStatus.cancelState) }) : undefined,
    pricingSummary: o.pricingSummary ? objet({ total: montant(o.pricingSummary.total), priceSubtotal: montant(o.pricingSummary.priceSubtotal), deliveryCost: montant(o.pricingSummary.deliveryCost) }) : undefined,
    totalDueSeller: montant(o.totalDueSeller), totalMarketplaceFee: montant(o.totalMarketplaceFee),
    lineItems: (Array.isArray(o.lineItems) ? o.lineItems : []).map(l => objet({
      lineItemId: texte(l.lineItemId), legacyItemId: texte(l.legacyItemId), legacyVariationId: texte(l.legacyVariationId), sku: texte(l.sku), title: texte(l.title),
      quantity: Number.isInteger(l.quantity) && l.quantity >= 0 ? l.quantity : undefined,
      lineItemCost: montant(l.lineItemCost), total: montant(l.total), lineItemFulfillmentStatus: texte(l.lineItemFulfillmentStatus),
      fulfillmentInstructions: l.fulfillmentInstructions ? objet({ shipByDate: texte(l.fulfillmentInstructions.shipByDate), minEstimatedDeliveryDate: texte(l.fulfillmentInstructions.minEstimatedDeliveryDate), maxEstimatedDeliveryDate: texte(l.fulfillmentInstructions.maxEstimatedDeliveryDate) }) : undefined,
    })),
  });
}
export function fusionnerCommandes(anciennes, nouvelles) {
  const index = new Map();
  for (const o of [...(Array.isArray(anciennes) ? anciennes : []), ...(Array.isArray(nouvelles) ? nouvelles : [])]) {
    const m = commandeMinimale(o); if (!m) continue;
    const avant = index.get(m.orderId);
    const a = Date.parse(avant && avant.lastModifiedDate || ''), n = Date.parse(m.lastModifiedDate || '');
    if (!avant || !Number.isFinite(a) || !Number.isFinite(n) || n >= a) index.set(m.orderId, m);
  }
  return [...index.values()].sort((a,b) => (Date.parse(b.creationDate) || 0) - (Date.parse(a.creationDate) || 0));
}
export async function lireCommandesEbay(lire, token, depuis, maintenant = Date.now()) {
  const capture = Number(depuis);
  const debut = Number.isFinite(capture) && capture > 0 ? Math.max(capture - 120000, maintenant - 90 * 86400000) : maintenant - 90 * 86400000;
  if (debut > maintenant) return { ok: false, status: 503, error: 'Date de capture des commandes incohérente.' };
  const filter = encodeURIComponent(`lastmodifieddate:[${new Date(debut).toISOString()}..${new Date(maintenant).toISOString()}]`);
  let url = `https://api.ebay.com/sell/fulfillment/v1/order?limit=50&filter=${filter}`;
  const vus = new Set(), orders = [];
  for (let page = 0; page < 20; page++) {
    if (vus.has(url)) return { ok: false, status: 502, error: 'Pagination eBay répétée.' };
    vus.add(url);
    const r = await lire(url, token);
    if (!r.ok || !r.data || !Array.isArray(r.data.orders)) return { ok: false, status: r.status || 502, error: 'Une page de commandes eBay n’a pas pu être lue.' };
    orders.push(...r.data.orders);
    if (!r.data.next) {
      if (Number.isFinite(r.data.total) && r.data.total > orders.length) return { ok: false, status: 502, error: 'Une page de commandes eBay manque.' };
      return { ok: true, status: r.status, data: { orders: fusionnerCommandes([], orders), total: r.data.total }, capturedAt: maintenant };
    }
    let next; try { next = new URL(r.data.next); } catch (_) { return { ok: false, status: 502, error: 'Pagination eBay illisible.' }; }
    if (next.origin !== 'https://api.ebay.com' || next.pathname !== '/sell/fulfillment/v1/order' || next.username || next.password) return { ok: false, status: 502, error: 'Pagination eBay inattendue.' };
    url = next.href;
  }
  return { ok: false, status: 503, error: 'Trop de pages de commandes : la dernière capture est conservée.' };
}
