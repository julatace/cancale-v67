// ════════════════════════════════════════════════════════════════════════════
// LES REMISES eBAY (11 nov., lot `ebay-complet`, ajout validé par Julien) :
// « Promotions eBay sur son clic (remise sur le stock pour une période, remise
// par quantité) posées et retirées depuis VRM, date de fin dite ».
//   · remise sur le stock pour une période = `item_price_markdown` (Marketing v1) ;
//   · remise par quantité (« 2 achetées : −x % ») = `item_promotion`, type
//     `VOLUME_DISCOUNT`.
// Règles :
//   · tout geste exige `confirme:true` AVANT le jeton ; une coupure ou un 5xx
//     après l'envoi ⇒ « incertain » (504), jamais « fait » ni « refusé » ;
//   · §2.8 : `applyFreeShipping` est TOUJOURS false — VRM ne pose jamais la
//     livraison gratuite, même dans une promotion ;
//   · les annonces sont des identifiants eBay (1 à 500) relus contre SES annonces
//     rangées (`lireAnnonces`) : une annonce qui n'est pas à lui ne part pas ;
//   · la date de fin est OBLIGATOIRE et dite ; durée 1 à 30 jours (choix VRM,
//     la limite exacte d'eBay n'est pas mesurée), début ≥ maintenant − 1 min ;
//   · retirer relit la promotion chez eBay : programmée/brouillon ⇒ supprimée,
//     en cours ⇒ mise en pause (eBay ne supprime pas une promotion en cours),
//     finie ⇒ rien.
// ⚠️ NON MESURÉ : chemins et champs de la documentation Marketing v1 ; droit
// `sell.marketing` (déjà demandé pour la promotion des annonces).
// ════════════════════════════════════════════════════════════════════════════

const ID = /^\d{6,19}$/;
const ID_PROMO = /^[0-9A-Za-z_-]{1,40}$/;
export const DUREE_MAX_JOURS = 30;
export const REMISE_MIN = 5, REMISE_MAX = 80;
const echec = (error, status = 400, reason) => ({ status, body: { ok: false, error, ...(reason ? { reason } : {}) } });
const succes = (body) => ({ status: 200, body: { ok: true, ...body } });
const pct = (v) => { const n = Number(String(v == null ? '' : v).replace(',', '.')); return Number.isInteger(n) && n >= REMISE_MIN && n <= REMISE_MAX ? n : null; };

// La demande relue (pure). `annonces` : ses identifiants d'annonce rangés (Set) ou
// `undefined` (pas su ⇒ refus : on ne pose pas une remise sur une annonce qui
// n'est peut-être pas la sienne).
export function demandeRemise(b, annonces, maintenant = Date.now()) {
  const type = b && b.type;
  if (type !== 'periode' && type !== 'quantite') return { err: 'Type de remise inconnu.', reason: 'type' };
  const ids = Array.isArray(b.listingIds) ? [...new Set(b.listingIds.map(String))] : [];
  if (!ids.length || ids.length > 500 || !ids.every((x) => ID.test(x))) return { err: 'Choisis de 1 à 500 annonces eBay.', reason: 'annonces' };
  if (!(annonces instanceof Set)) return { err: 'Je n\'ai pas pu relire tes annonces eBay — rien n\'a été envoyé.', reason: 'pas-su', status: 503 };
  const etrangeres = ids.filter((x) => !annonces.has(x));
  if (etrangeres.length) return { err: `${etrangeres.length} annonce(s) ne sont pas parmi les tiennes (relis tes annonces) — rien n'a été envoyé.`, reason: 'annonces' };
  const debut = Date.parse(b.debut), fin = Date.parse(b.fin);
  if (!Number.isFinite(debut) || !Number.isFinite(fin)) return { err: 'Dates de début et de fin illisibles.', reason: 'dates' };
  if (debut < maintenant - 60000) return { err: 'Le début est déjà passé.', reason: 'dates' };
  if (fin <= debut) return { err: 'La fin doit venir après le début.', reason: 'dates' };
  if (fin - debut > DUREE_MAX_JOURS * 86400000) return { err: `${DUREE_MAX_JOURS} jours au plus.`, reason: 'dates' };
  const nom = String(b.nom == null ? '' : b.nom).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 90) || 'VRM';
  if (type === 'periode') {
    const p = pct(b.remise);
    if (p == null) return { err: `Remise : un nombre entier entre ${REMISE_MIN} et ${REMISE_MAX} %.`, reason: 'remise' };
    return { type, ids, debut, fin, nom, remise: p };
  }
  const paliers = Array.isArray(b.paliers) ? b.paliers : [];
  if (paliers.length < 1 || paliers.length > 3) return { err: 'De 1 à 3 paliers (2, 3, 4 articles et plus).', reason: 'paliers' };
  const ps = paliers.map(pct);
  if (ps.some((x) => x == null)) return { err: `Chaque palier : un nombre entier entre ${REMISE_MIN} et ${REMISE_MAX} %.`, reason: 'paliers' };
  for (let i = 1; i < ps.length; i++) if (ps[i] <= ps[i - 1]) return { err: 'Chaque palier doit faire plus de remise que le précédent.', reason: 'paliers' };
  return { type, ids, debut, fin, nom, paliers: ps };
}
// Le corps envoyé à eBay (pur). ⚠️ `applyFreeShipping: false`, toujours (§2.8).
export function corpsRemise(d, marketplaceId) {
  const base = { name: d.nom, marketplaceId, startDate: new Date(d.debut).toISOString(), endDate: new Date(d.fin).toISOString(), promotionStatus: 'SCHEDULED' };
  const inv = { inventoryCriterionType: 'INVENTORY_BY_VALUE', listingIds: d.ids };
  if (d.type === 'periode') return { ...base, applyFreeShipping: false, autoSelectFutureInventory: false, blockPriceIncreaseInItemRevision: true, selectedInventoryDiscounts: [{ discountBenefit: { percentageOffItem: String(d.remise) }, inventoryCriterion: inv, ruleOrder: 1 }] };
  return { ...base, promotionType: 'VOLUME_DISCOUNT', applyFreeShipping: false, inventoryCriterion: inv,
    discountRules: [{ discountSpecification: { minQuantity: 1 }, discountBenefit: { percentageOffOrder: '0' }, ruleOrder: 1 },
      ...d.paliers.map((p, i) => ({ discountSpecification: { minQuantity: i + 2 }, discountBenefit: { percentageOffOrder: String(p) }, ruleOrder: i + 2 }))] };
}
// Une promotion lue (pure) ; `null` = forme illisible.
export function lirePromotions(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.promotions)) return null;
  return data.promotions.map((p) => ({
    id: String(p.promotionId || ''), nom: String(p.name || ''), etat: String(p.promotionStatus || ''),
    type: p.promotionType === 'MARKDOWN_SALE' ? 'periode' : p.promotionType === 'VOLUME_DISCOUNT' ? 'quantite' : String(p.promotionType || ''),
    debut: Number.isFinite(Date.parse(p.startDate)) ? p.startDate : null, fin: Number.isFinite(Date.parse(p.endDate)) ? p.endDate : null,
  })).filter((p) => ID_PROMO.test(p.id));
}

export function creerRemisesEbay({ accessToken, apiOrigin, marketplace, lireAnnonces, fetcher = (...a) => fetch(...a), maintenant = () => Date.now() }) {
  const MK = `${apiOrigin}/sell/marketing/v1`;
  const mk = () => (typeof marketplace === 'function' ? marketplace() : marketplace);
  const jeton = async (ctx) => { const r = await accessToken(ctx); return r.ok && r.token ? r : echec(r.error || 'Compte eBay indisponible.', r.status || 502, r.reason); };
  async function json(url, token, { method = 'GET', body } = {}) {
    try {
      const r = await fetcher(url, { method, headers: { Authorization: 'Bearer ' + token, Accept: 'application/json', 'Content-Type': 'application/json', 'X-EBAY-C-MARKETPLACE-ID': mk() }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
      const txt = await r.text().catch(() => ''); let data = null; try { data = txt ? JSON.parse(txt) : null; } catch (_) {}
      return { status: r.status, ok: r.status >= 200 && r.status < 300, data, headers: r.headers };
    } catch (_) { return { status: 0, ok: false, data: null, coupure: true }; }
  }
  const msg = (r, repli) => { const e = r.data && Array.isArray(r.data.errors) && r.data.errors[0]; return (e && (e.longMessage || e.message)) ? String(e.longMessage || e.message).slice(0, 300) : repli; };
  async function lister(ctx, token) {
    const r = await json(`${MK}/promotion?marketplace_id=${encodeURIComponent(mk())}&limit=100`, token);
    if (r.status === 401 || r.status === 403) return { ko: echec('eBay n\'a pas autorisé VRM à lire tes promotions : reconnecte ton compte eBay.', 200, 'scope') };
    if (r.status === 204) return { liste: [] };
    if (!r.ok) return { ko: echec('eBay n\'a pas rendu tes promotions.', r.status >= 400 ? r.status : 502, 'pas-su') };
    const l = lirePromotions(r.data);
    return l ? { liste: l } : { ko: echec('Réponse eBay illisible pour les promotions.', 502, 'illisible') };
  }
  async function remises(b, ctx) {
    const a = await jeton(ctx); if (!a.token) return a;
    const l = await lister(ctx, a.token); if (l.ko) return l.ko;
    return succes({ remises: l.liste.filter((p) => p.type === 'periode' || p.type === 'quantite') });
  }
  async function poser(b, ctx) {
    if (b.confirme !== true) return echec('Confirme la remise : rien n\'a été envoyé.', 400, 'confirmation');
    let annonces;
    try { const l = await lireAnnonces(ctx); annonces = Array.isArray(l) ? new Set(l.map((x) => String(x.itemId))) : undefined; } catch (_) { annonces = undefined; }
    const d = demandeRemise(b, annonces, maintenant());
    if (d.err) return echec(d.err, d.status || 400, d.reason);
    const a = await jeton(ctx); if (!a.token) return a;
    const chemin = d.type === 'periode' ? 'item_price_markdown' : 'item_promotion';
    const r = await json(`${MK}/${chemin}`, a.token, { method: 'POST', body: corpsRemise(d, mk()) });
    if (r.coupure || r.status >= 500) return echec('eBay n\'a pas répondu — je ne sais pas si la remise est posée. Relis tes remises avant de recommencer.', 504, 'incertain');
    if (!r.ok) return echec(msg(r, 'eBay a refusé la remise.'), r.status >= 400 ? r.status : 502, 'refus');
    const id = String((r.headers && r.headers.get && r.headers.get('location') || '').split('/').pop() || '');
    return succes({ id: ID_PROMO.test(id) ? id : null, type: d.type, fin: new Date(d.fin).toISOString(), n: d.ids.length });
  }
  async function retirer(b, ctx) {
    if (b.confirme !== true) return echec('Confirme le retrait : rien n\'a été envoyé.', 400, 'confirmation');
    const id = String(b.id || '');
    if (!ID_PROMO.test(id)) return echec('Remise invalide.');
    const a = await jeton(ctx); if (!a.token) return a;
    const l = await lister(ctx, a.token); if (l.ko) return l.ko;
    const p = l.liste.find((x) => x.id === id);
    if (!p) return succes({ deja: true });
    if (p.type !== 'periode' && p.type !== 'quantite') return echec('Cette promotion n\'est pas une remise posée par VRM.', 409, 'type');
    if (/^(ENDED)$/i.test(p.etat)) return succes({ deja: true });
    const enCours = /^(RUNNING)$/i.test(p.etat);
    const chemin = p.type === 'periode' ? 'item_price_markdown' : 'item_promotion';
    const r = enCours ? await json(`${MK}/promotion/${encodeURIComponent(id)}/pause`, a.token, { method: 'POST' }) : await json(`${MK}/${chemin}/${encodeURIComponent(id)}`, a.token, { method: 'DELETE' });
    if (r.coupure || r.status >= 500) return echec('eBay n\'a pas répondu — je ne sais pas si la remise est retirée. Relis tes remises.', 504, 'incertain');
    if (!r.ok) return echec(msg(r, 'eBay a refusé de retirer la remise.'), r.status >= 400 ? r.status : 502, 'refus');
    return succes({ geste: enCours ? 'pause' : 'supprimee' });
  }
  return { remises, poser, retirer };
}
