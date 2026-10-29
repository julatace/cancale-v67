// ── CHERCHER DES PAIRES À ACHETER SUR eBAY (29 octobre) ──────────────────────
// Julien : « Pour le côté achat je comprends pas à quoi ça sert ; je pense que
// tu peux faire la recherche comme pour Vinted, avec un feed ; après, à voir,
// tout dépend si ça utilisera beaucoup de données. »
//
// L'API Browse d'eBay (`/buy/browse/v1/item_summary/search`, marché EBAY_FR),
// avec le jeton D'APPLICATION de VRM (client_credentials) — jamais le jeton
// d'un vendeur. ⚠️ NON MESURÉ : aucun appel réel n'a été fait d'ici (eBay est
// bloqué) ; les noms de paramètres, de filtres et de champs viennent de la
// documentation d'eBay (Browse API, « search »), servis par un faux eBay aux
// bancs.
//
// LES DONNÉES (sa question) :
//   · une recherche = UN appel à eBay, au plus 30 annonces, champs par défaut
//     (`MATCHING_ITEMS`, le plus petit groupe), réduits ici avant de partir au
//     navigateur ; le poids réel est MESURÉ à chaque appel (octets reçus d'eBay,
//     octets envoyés à l'app) et rendu ;
//   · un plafond VRM par vendeur et par jour de Paris (`PLAFOND_VRM_JOUR`),
//     compté en base (compare-et-échange) AVANT l'appel : au-delà, rien ne part ;
//     compteur illisible ⇒ rien ne part (« pas su » ne vaut pas « reste du
//     budget ») ;
//   · le plafond d'eBay pour Browse est celui de TOUTE l'application VRM
//     (5 000 appels par jour selon la page « API Call Limits » d'eBay — non
//     mesuré) ; quand eBay le dit (Developer Analytics, `rate_limit`), le
//     restant RÉEL est rendu, sinon `null`.
//
// Rien n'est acheté : la route ne fait que LIRE. Le geste est « Voir sur eBay ».

export const PLAFOND_VRM_JOUR = 200;
export const PLAFOND_EBAY_DOC = 5000;
export const LIMITE_RESULTATS = 30;
export const ID_COMPTEUR = 'ebay_recherches_jour';
const PAYS = ['FR', 'BE', 'DE', 'ES', 'IT', 'tous'];

// Le jour de Paris (le compteur repart à minuit, heure de Paris).
export function jourParis(t = Date.now()) {
  try {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(t));
    const v = (k) => (p.find((x) => x.type === k) || {}).value;
    return `${v('year')}-${v('month')}-${v('day')}`;
  } catch (_) { return new Date(t).toISOString().slice(0, 10); }
}

const centimesOk = (v) => Number.isSafeInteger(v) && v >= 1 && v <= 100000000;
// Une seule forme de critères, que la recherche soit tapée à la main ou vienne
// d'une recherche enregistrée (`veilles` de l'espace Organisation, §11).
export function criteresRecherche(b) {
  const x = b || {};
  const mots = typeof x.mots === 'string' ? x.mots.trim().replace(/\s+/g, ' ') : '';
  if (mots.length < 2 || mots.length > 200) return { ok: false, error: 'Tape au moins deux lettres (200 au plus) : rien n’a été envoyé à eBay.' };
  const exclus = typeof x.exclus === 'string' ? x.exclus.slice(0, 200) : '';
  const pointure = x.pointure == null ? '' : String(x.pointure).trim();
  if (pointure && !/^\d{2}([.,]5)?$/.test(pointure)) return { ok: false, error: 'Pointure attendue : deux chiffres, et « ,5 » au besoin (42 ou 42,5).' };
  const maximum = x.maximum == null || x.maximum === '' ? null : x.maximum;
  const minimum = x.minimum == null || x.minimum === '' ? null : x.minimum;
  if (maximum !== null && !centimesOk(maximum)) return { ok: false, error: 'Prix maximum illisible : rien n’a été envoyé à eBay.' };
  if (minimum !== null && !centimesOk(minimum)) return { ok: false, error: 'Prix minimum illisible : rien n’a été envoyé à eBay.' };
  if (minimum !== null && maximum !== null && minimum > maximum) return { ok: false, error: 'Le minimum dépasse le maximum.' };
  const etat = ['tous', 'neuf', 'occasion'].includes(x.etat) ? x.etat : 'tous';
  const pays = PAYS.includes(x.pays) ? x.pays : 'tous';
  const categorie = x.categorie == null ? '' : String(x.categorie).trim();
  if (categorie && !/^\d{1,10}$/.test(categorie)) return { ok: false, error: 'Identifiant de catégorie eBay : des chiffres seulement.' };
  return { ok: true, c: { mots, exclus, pointure, maximum, minimum, etat, achatImmediat: x.achatImmediat !== false, livraisonFR: x.livraisonFR !== false, pays, categorie } };
}

const euros = (c) => (c / 100).toFixed(2);
// L'adresse de la recherche — les filtres de la documentation d'eBay (non mesuré) :
// `buyingOptions:{FIXED_PRICE}` · `deliveryCountry:FR` · `itemLocationCountry`
// · `conditions:{NEW|USED}` · `price:[..]` avec `priceCurrency:EUR`.
// Tri `newlyListed` : les plus récentes d'abord (c'est un fil).
export function urlRecherche(origine, c) {
  const q = c.mots + (c.pointure ? ' ' + c.pointure.replace(',', '.') : '');
  const f = [];
  if (c.achatImmediat) f.push('buyingOptions:{FIXED_PRICE}');
  if (c.livraisonFR) f.push('deliveryCountry:FR');
  if (c.pays && c.pays !== 'tous') f.push(`itemLocationCountry:${c.pays}`);
  if (c.etat === 'neuf') f.push('conditions:{NEW}');
  if (c.etat === 'occasion') f.push('conditions:{USED}');
  if (c.maximum !== null || c.minimum !== null) {
    f.push(`price:[${c.minimum !== null ? euros(c.minimum) : ''}..${c.maximum !== null ? euros(c.maximum) : ''}]`);
    f.push('priceCurrency:EUR');
  }
  const p = new URLSearchParams({ q, limit: String(LIMITE_RESULTATS), sort: 'newlyListed' });
  if (f.length) p.set('filter', f.join(','));
  if (c.categorie) p.set('category_ids', c.categorie);
  return `${origine}/buy/browse/v1/item_summary/search?${p.toString()}`;
}

const normal = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const nombre = (v) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : null; };
// Seules des adresses d'eBay partent au navigateur : la photo vient de
// i.ebayimg.com, le lien d'un site www.ebay.* — rien d'autre n'est affiché.
const photoSure = (u) => (typeof u === 'string' && /^https:\/\/i\.ebayimg\.com\//.test(u) ? u : null);
const lienSur = (u, itemId) => (typeof u === 'string' && /^https:\/\/www\.ebay\.(fr|com|co\.uk|de|it|es|be|ch|at|ie|nl)\//.test(u) ? u : `https://www.ebay.fr/itm/${encodeURIComponent(itemId)}`);

// La réponse d'eBay, réduite à ce que l'écran montre. `null` = illisible (une
// réponse qu'on ne sait pas lire n'est JAMAIS « aucun résultat »).
export function reduireResultats(j, c) {
  if (!j || typeof j !== 'object' || Array.isArray(j)) return null;
  const liste = j.itemSummaries;
  const total = nombre(j.total);
  if (!Array.isArray(liste)) return total === 0 ? { items: [], total: 0, horsBudget: 0, exclus: 0, autreDevise: 0 } : null;
  const motsExclus = String(c.exclus || '').split(',').map((w) => normal(w).trim()).filter((w) => w.length >= 2);
  const out = [];
  let horsBudget = 0, exclus = 0, autreDevise = 0;
  for (const it of liste) {
    if (!it || typeof it !== 'object') continue;
    const itemId = typeof it.itemId === 'string' ? it.itemId : (typeof it.legacyItemId === 'string' ? it.legacyItemId : '');
    if (!itemId) continue;
    const titre = typeof it.title === 'string' ? it.title.slice(0, 200) : '';
    if (motsExclus.length && motsExclus.some((w) => normal(titre).includes(w))) { exclus++; continue; }
    const prix = it.price && nombre(it.price.value);
    const devise = it.price && typeof it.price.currency === 'string' ? it.price.currency : '';
    if (prix === null || devise !== 'EUR') { autreDevise++; continue; }
    // Le port : seul un coût FIXE dit par eBay est un port connu ; « calculé »,
    // absent, une autre devise ⇒ inconnu (jamais traité comme gratuit).
    const so = Array.isArray(it.shippingOptions) ? it.shippingOptions[0] : null;
    const portV = so && so.shippingCost && so.shippingCost.currency === 'EUR' && String(so.shippingCostType || '').toUpperCase() === 'FIXED' ? nombre(so.shippingCost.value) : null;
    const totalC = portV === null ? null : Math.round(prix * 100) + Math.round(portV * 100);
    if (c.maximum !== null) {
      if (totalC !== null ? totalC > c.maximum : Math.round(prix * 100) > c.maximum) { horsBudget++; continue; }
    }
    if (c.minimum !== null && totalC !== null && totalC < c.minimum) { horsBudget++; continue; }
    const seller = it.seller && typeof it.seller === 'object' ? it.seller : {};
    out.push({
      itemId,
      titre,
      prix: Math.round(prix * 100),
      port: portV === null ? null : Math.round(portV * 100),
      total: totalC,
      etat: typeof it.condition === 'string' ? it.condition.slice(0, 60) : '',
      vendeur: typeof seller.username === 'string' ? seller.username.slice(0, 60) : '',
      avis: nombre(seller.feedbackPercentage),
      photo: photoSure(it.image && it.image.imageUrl) || photoSure(Array.isArray(it.thumbnailImages) && it.thumbnailImages[0] && it.thumbnailImages[0].imageUrl),
      url: lienSur(it.itemWebUrl, itemId),
      achatImmediat: Array.isArray(it.buyingOptions) ? it.buyingOptions.includes('FIXED_PRICE') : null,
      enchere: Array.isArray(it.buyingOptions) ? it.buyingOptions.includes('AUCTION') : null,
      date: typeof it.itemCreationDate === 'string' && Number.isFinite(Date.parse(it.itemCreationDate)) ? it.itemCreationDate : null,
      pays: it.itemLocation && typeof it.itemLocation.country === 'string' ? it.itemLocation.country.slice(0, 2) : '',
    });
  }
  return { items: out, total, horsBudget, exclus, autreDevise };
}

// Le compteur du jour (compare-et-échange par `modifierDonnee`) : `undefined` =
// le plafond est atteint, rien n'est écrit.
export function compterAppel(d, jour, plafond = PLAFOND_VRM_JOUR) {
  const n = d && d.jour === jour && Number.isSafeInteger(d.n) && d.n >= 0 ? d.n : 0;
  if (n >= plafond) return undefined;
  return { jour, n: n + 1, plafond };
}

// Le restant RÉEL du plafond d'eBay pour l'application, quand eBay le dit
// (Developer Analytics `rate_limit`, forme de la documentation — non mesuré).
// Gardé 10 min par l'instance : c'est une donnée de l'application, pas d'un
// vendeur. `null` = pas su.
let _quota = null;
export function lireQuotaReponse(j) {
  const groupes = j && Array.isArray(j.rateLimits) ? j.rateLimits : [];
  for (const g of groupes) {
    if (!g || !/browse/i.test(String(g.apiName || ''))) continue;
    for (const r of (Array.isArray(g.resources) ? g.resources : [])) {
      for (const t of (Array.isArray(r && r.rates) ? r.rates : [])) {
        const limite = nombre(t && t.limit), restant = nombre(t && t.remaining);
        if (limite !== null && restant !== null) return { limite, restant, raz: typeof t.reset === 'string' ? t.reset : null };
      }
    }
  }
  return null;
}

export function creerRechercheEbay({ jetonApplication, oublierJetonApplication = () => {}, modifierDonnee, origine = 'https://api.ebay.com', fetcher = (...a) => globalThis.fetch(...a), maintenant = () => Date.now() }) {
  async function quotaEbay(jeton) {
    const t = maintenant();
    if (_quota && t - _quota.at < 10 * 60 * 1000) return _quota.v;
    let v = null;
    try {
      const r = await fetcher(`${origine}/developer/analytics/v1_beta/rate_limit/?api_context=buy&api_name=browse`, { headers: { Authorization: `Bearer ${jeton}`, Accept: 'application/json' } });
      if (r.ok) v = lireQuotaReponse(await r.json().catch(() => null));
    } catch (_) { v = null; }
    _quota = { at: t, v };
    return v;
  }
  async function chercher(b, owner) {
    const cr = criteresRecherche(b);
    if (!cr.ok) return { status: 400, body: { ok: false, reason: 'criteres', error: cr.error } };
    const jour = jourParis(maintenant());
    let compte = null, plafond = false;
    const ecrit = await modifierDonnee(ID_COMPTEUR, owner, (d) => {
      const n = compterAppel(d, jour);
      if (n === undefined) { plafond = true; compte = d && d.jour === jour ? d.n : PLAFOND_VRM_JOUR; return undefined; }
      compte = n.n; plafond = false; return n;
    });
    if (ecrit !== true) return { status: 503, body: { ok: false, reason: 'pas-su', error: 'Je n’ai pas pu compter tes recherches du jour : rien n’a été envoyé à eBay. Réessaie dans un moment.' } };
    const appels = { aujourdhui: compte, plafond: PLAFOND_VRM_JOUR, jour };
    if (plafond) return { status: 429, body: { ok: false, reason: 'plafond', appels, error: `Tu as fait tes ${PLAFOND_VRM_JOUR} recherches eBay du jour : le fil s’arrête jusqu’à minuit (heure de Paris).` } };
    const jeton = await jetonApplication();
    if (!jeton) return { status: 502, body: { ok: false, reason: 'ebay', appels, error: 'Je n’ai pas pu chercher sur eBay (eBay n’a pas donné d’accès) — ce n’est pas « aucun résultat ». Réessaie dans un moment.' } };
    const c = cr.c;
    let r, txt = '';
    try {
      r = await fetcher(urlRecherche(origine, c), { headers: { Authorization: `Bearer ${jeton}`, Accept: 'application/json', 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_FR', 'X-EBAY-C-ENDUSERCTX': 'contextualLocation=country=FR' } });
      txt = await r.text();
    } catch (_) {
      return { status: 502, body: { ok: false, reason: 'ebay', appels, error: 'Je n’ai pas pu chercher sur eBay (pas de réponse) — ce n’est pas « aucun résultat ». Réessaie dans un moment.' } };
    }
    if (r.status === 401) oublierJetonApplication();
    let j = null; try { j = JSON.parse(txt); } catch (_) { j = null; }
    const res = r.ok ? reduireResultats(j, c) : null;
    if (!res) return { status: 502, body: { ok: false, reason: 'ebay', appels, error: `Je n’ai pas pu chercher sur eBay (${r.ok ? 'réponse illisible' : 'eBay a répondu ' + r.status}) — ce n’est pas « aucun résultat ». Réessaie dans un moment.` } };
    const quota = await quotaEbay(jeton);
    const corps = { ok: true, ...res, criteres: c, appels, quotaEbay: quota, plafondEbayDoc: PLAFOND_EBAY_DOC, lueA: new Date(maintenant()).toISOString() };
    corps.octets = { ebay: Buffer.byteLength(txt, 'utf8'), vrm: 0 };
    corps.octets.vrm = Buffer.byteLength(JSON.stringify(corps), 'utf8');
    return { status: 200, body: corps };
  }
  return { chercher };
}
