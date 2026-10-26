// ─────────────────────────────────────────────────────────────────────────────
// LES MARCHÉS eBAY — LA TABLE (26 octobre), pure : lue par l'app ET la route — eBay.fr, eBay.co.uk, eBay.com, et l'Europe.
// Julien : « lance eBay UK et US ». Jusqu'ici tout VRM parlait à eBay.fr :
// SiteID 71, EUR, `Country FR`, liens ebay.fr. Chaque COMPTE eBay a désormais
// SON marché — celui où il est inscrit, lu chez eBay (GetUser → `User.Site` :
// France · UK · US · Germany · Italy · Spain). Un compte relié avant ce jour,
// dont le site n'a jamais été lu, reste sur eBay.fr (c'est là qu'il a été
// relié) jusqu'à la prochaine lecture.
//
// UNE table (§11), lue par la route (appels Trading et REST, XML de l'annonce)
// et par l'app (devise affichée, liens). Le marché d'une REQUÊTE vit dans un
// AsyncLocalStorage : jamais une variable de module (deux vendeurs, deux comptes
// se traitent en parallèle sur la même instance).
// ⚠️ NON MESURÉ : la valeur exacte de `User.Site` sur un vrai compte (doc d'eBay,
// SiteCodeType) ; aucun compte UK ou US n'a encore été relié.
// ─────────────────────────────────────────────────────────────────────────────


export const MARCHES = Object.freeze({
  FR: Object.freeze({ site: 'FR', siteId: '71', marketplace: 'EBAY_FR', devise: 'EUR', pays: 'FR', domaine: 'www.ebay.fr', nom: 'eBay.fr', lieu: 'France', langue: 'fr-FR' }),
  GB: Object.freeze({ site: 'GB', siteId: '3', marketplace: 'EBAY_GB', devise: 'GBP', pays: 'GB', domaine: 'www.ebay.co.uk', nom: 'eBay.co.uk', lieu: 'United Kingdom', langue: 'en-GB' }),
  US: Object.freeze({ site: 'US', siteId: '0', marketplace: 'EBAY_US', devise: 'USD', pays: 'US', domaine: 'www.ebay.com', nom: 'eBay.com', lieu: 'United States', langue: 'en-US' }),
  DE: Object.freeze({ site: 'DE', siteId: '77', marketplace: 'EBAY_DE', devise: 'EUR', pays: 'DE', domaine: 'www.ebay.de', nom: 'eBay.de', lieu: 'Deutschland', langue: 'de-DE' }),
  IT: Object.freeze({ site: 'IT', siteId: '101', marketplace: 'EBAY_IT', devise: 'EUR', pays: 'IT', domaine: 'www.ebay.it', nom: 'eBay.it', lieu: 'Italia', langue: 'it-IT' }),
  ES: Object.freeze({ site: 'ES', siteId: '186', marketplace: 'EBAY_ES', devise: 'EUR', pays: 'ES', domaine: 'www.ebay.es', nom: 'eBay.es', lieu: 'España', langue: 'es-ES' }),
});
export const MARCHE_DEFAUT = MARCHES.FR;

// `User.Site` (SiteCodeType) ⇒ un de nos codes, sinon '' (site que VRM ne gère
// pas encore — jamais deviné en France).
const SITES = { france: 'FR', uk: 'GB', unitedkingdom: 'GB', gb: 'GB', us: 'US', unitedstates: 'US', germany: 'DE', italy: 'IT', spain: 'ES' };
export function siteDeEbay(v) {
  const k = String(v == null ? '' : v).toLowerCase().replace(/[^a-z]/g, '');
  return SITES[k] || '';
}

// Le marché d'un compte du registre. `site` absent (compte relié avant le
// 26 octobre, jamais relu) ⇒ eBay.fr. `site` = '?' (lu, mais pas un site que
// VRM gère) ⇒ `null` : la route refuse de publier plutôt que de publier en
// France à la place.
export function marcheDuCompte(c) {
  const s = c && c.site;
  if (s === undefined || s === null || s === '') return MARCHE_DEFAUT;
  return MARCHES[s] || null;
}



export const SYMBOLE = Object.freeze({ EUR: '€', GBP: '£', USD: '$' });
export const lienAnnonce = (m, itemId) => `https://${(m || MARCHE_DEFAUT).domaine}/itm/${encodeURIComponent(String(itemId || ''))}`;
export const lienCommande = (m, orderId) => `https://${(m || MARCHE_DEFAUT).domaine}/sh/ord/details?orderid=${encodeURIComponent(String(orderId || ''))}`;
