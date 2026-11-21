// ════════════════════════════════════════════════════════════════════════════
//  REMETTRE EN VENTE UNE ANNONCE eBAY TERMINÉE SANS VENTE (3 novembre)
//
//  Julien a choisi « relancer les invendus eBay » : la liste des inactives
//  (`ebay_inactives`, lue dans le même GetMyeBaySelling que les annonces en
//  ligne, 23 octobre) gagne « Remettre en vente », sur SON clic, confirmé.
//  Ce module tient la RÈGLE (fonctions pures) ; la route (`api/ebay.js`,
//  actions `relanceverif` et `relancer`) l'applique à ce qu'eBay rend.
//
//  Ce qui part chez eBay : `RelistFixedPriceItem` avec l'identifiant SEUL
//  (`<Item><ItemID>…</ItemID></Item>`) — eBay recopie l'annonce terminée telle
//  quelle : même prix, même livraison (gérée par eBay), même SKU `VRM-{n°}`.
//  VRM n'envoie AUCUN champ : rien ne peut être changé en route (§2.8 : jamais
//  « livraison gratuite », jamais une étiquette achetée).
//
//  Avant d'envoyer, l'annonce est RELUE chez eBay (GetItem) et doit être :
//   · terminée (`ListingStatus` Completed ou Ended), SANS vente
//     (`QuantitySold` = 0, lu — absent ⇒ pas su ⇒ rien ne part) ;
//   · pas déjà remise en vente (`RelistedItemID`) ;
//   · reliée à LA paire demandée par son SKU (`VRM-{n°}`, traduit par la
//     numérotation 013 avec sa date de publication) — sans SKU, aucune
//     identité : VRM ne la remet pas en vente (§5, mieux vaut un blanc) ;
//   · au prix que Julien a VU (au centime), dans la devise du compte ;
//   · sans livraison gratuite (`FreeShipping`, ou un port fixe à 0,00 €) ;
//   · sans variantes (une annonce à variantes porte plusieurs paires).
//  ⚠️ NON MESURÉ : rien n'a été envoyé à eBay pour de vrai. Les noms des
//     éléments viennent de la doc d'eBay (Trading API) ; la relecture APRÈS la
//     remise en vente dit ce qu'eBay a gardé (`verifie`).
// ════════════════════════════════════════════════════════════════════════════
import { motsCourants as MV } from './mots-vendeur.js';   // (11 nov.) « paire » / « article » du vendeur de la requête
import { cleNum, numeroExterne } from './numerotation.js';

const NUM_OK = /^([A-Z]{1,3})?\d{1,6}$/;
export const ID_ANNONCE_EBAY = /^\d{1,19}$/;
const dexml = (s) => String(s == null ? '' : s).replace(/<!\[CDATA\[|\]\]>/g, '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const balise = (src, t) => { const m = new RegExp('<' + t + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + t + '>').exec(String(src || '')); return m ? dexml(m[1]).trim() : null; };
const attrDevise = (src, t) => (new RegExp('<' + t + '[^>]*currencyID=["\']([A-Z]{3})["\']').exec(String(src || '')) || [])[1] || '';
// STRICT : « VRM-125 », « VRM-B125 », rien d'autre (la même que `numDeSku` de la route).
export const numDeSkuRelance = (sku) => {
  const m = /^\s*VRM[-\s]?((?:[A-Z]{1,3})?\d{1,6})\s*$/i.exec(String(sku == null ? '' : sku));
  const c = m ? cleNum(m[1]) : '';
  return c && NUM_OK.test(c) ? c : '';
};
// Un montant en centimes, ou null (illisible).
export const centimes = (v) => {
  const s = String(v == null ? '' : v).trim().replace(',', '.');
  if (!/^\d{1,7}(?:\.\d{1,6})?$/.test(s)) return null;
  const n = Math.round(Number(s) * 100);
  return Number.isFinite(n) && n > 0 ? n : null;
};

// Le corps envoyé à eBay : l'identifiant, et RIEN d'autre (aucun champ changé).
export const xmlRelance = (itemId) => (ID_ANNONCE_EBAY.test(String(itemId || '')) ? `<Item><ItemID>${itemId}</ItemID></Item>` : '');

// Ce que GetItem dit d'une annonce, pour la relance. Trois états partout :
// une valeur lue, `null` (pas dit par eBay).
export function lireItemRelance(xml) {
  const item = (/<Item>([\s\S]*)<\/Item>/.exec(String(xml || '')) || [])[1];
  if (item == null) return null;
  const variantes = /<Variations>[\s\S]*?<\/Variations>/.test(item);
  const sansVar = item.replace(/<Variations>[\s\S]*?<\/Variations>/g, '').replace(/<Description>[\s\S]*?<\/Description>/g, '');
  const vente = (/<SellingStatus>([\s\S]*?)<\/SellingStatus>/.exec(sansVar) || [])[1] || '';
  const details = (/<ListingDetails>([\s\S]*?)<\/ListingDetails>/.exec(sansVar) || [])[1] || '';
  const livr = (/<ShippingDetails>([\s\S]*?)<\/ShippingDetails>/.exec(sansVar) || [])[1];
  const prix = balise(vente, 'CurrentPrice') ?? balise(sansVar, 'StartPrice') ?? balise(sansVar, 'BuyItNowPrice');
  const devise = attrDevise(vente, 'CurrentPrice') || attrDevise(sansVar, 'StartPrice') || balise(sansVar, 'Currency') || '';
  const vendusTxt = balise(vente, 'QuantitySold');
  // La LIVRAISON : `gratuite` true (dit par eBay), false (des frais, ou aucun
  // bloc : livraison gérée par eBay, la forme de nos publications), jamais devinée.
  let gratuite = false, typeLivraison = '';
  if (livr != null) {
    typeLivraison = balise(livr, 'ShippingType') || '';
    if (/<FreeShipping>\s*true\s*<\/FreeShipping>/i.test(livr)) gratuite = true;
    if (/^Flat$/i.test(typeLivraison)) {
      const re = /<ShippingServiceOptions>([\s\S]*?)<\/ShippingServiceOptions>/g; let m;
      while ((m = re.exec(livr))) {
        const c = balise(m[1], 'ShippingServiceCost');
        if (c != null && /^\d+(?:\.\d+)?$/.test(c) && Number(c) === 0) gratuite = true;
      }
    }
  }
  const rel = balise(details, 'RelistedItemID') || '';
  return {
    itemId: balise(sansVar, 'ItemID') || '',
    sku: balise(sansVar, 'SKU') || '',
    titre: (balise(sansVar, 'Title') || '').slice(0, 120),
    statut: balise(vente, 'ListingStatus') || '',
    vendus: vendusTxt != null && /^\d+$/.test(vendusTxt) ? Number(vendusTxt) : null,
    prix: prix || '',
    devise,
    debut: balise(details, 'StartTime') || '',
    relanceeEn: ID_ANNONCE_EBAY.test(rel) ? rel : '',
    gratuite,
    typeLivraison,
    variantes,
  };
}

const refus = (status, reason, error, plus) => ({ ok: false, status, body: { ok: false, reason, error, ...(plus || {}) } });
const eur = (c) => (c / 100).toFixed(2).replace('.', ',');

// LA RÈGLE. `demande` = { itemId, numero, prixVu } (ce que Julien a VU et
// confirmé) ; `mk` = le marqueur 013 (`null` = aucune remise à zéro) ;
// `devise` = celle du marché du compte. Rend `{ ok:true, sku, num, prix }` ou
// un refus `{ ok:false, status, body }` — rien n'est envoyé sur un refus.
export function jugerRelance(lu, demande, { mk = null, devise = 'EUR' } = {}) {
  const itemId = String((demande && demande.itemId) || '');
  if (!lu || !lu.itemId) return refus(503, 'pas-su', "eBay n'a pas rendu cette annonce — rien n'a été remis en vente.");
  if (lu.itemId !== itemId) return refus(409, 'autre-annonce', "eBay a rendu une autre annonce que celle demandée — rien n'a été remis en vente.");
  if (lu.variantes) return refus(409, 'variantes', `Une annonce à variantes porte plusieurs ${MV().noms} : VRM ne la remet pas en vente — fais-le sur eBay.`);
  if (!/^(Completed|Ended)$/i.test(lu.statut || '')) {
    if (/^Active$/i.test(lu.statut || '')) return refus(409, 'en-ligne', "Elle est déjà en vente sur eBay — rien n'a été envoyé.");
    return refus(503, 'pas-su', "eBay ne dit pas que cette annonce est terminée — rien n'a été remis en vente.");
  }
  if (lu.vendus == null) return refus(503, 'pas-su', "eBay ne dit pas si cette annonce a vendu — rien n'a été remis en vente.");
  if (lu.vendus > 0) return refus(409, 'vendue', "Elle s'est vendue sur eBay — ne la remets pas en vente.");
  if (lu.relanceeEn) return refus(409, 'deja-relancee', "eBay dit qu'elle a déjà été remise en vente — rien n'est reparti.", { relanceeEn: lu.relanceeEn });
  // L'IDENTITÉ : le SKU de l'annonce, lu chez eBay, traduit par la numérotation
  // (date de PUBLICATION), doit désigner la paire demandée.
  const voulu = cleNum(demande && demande.numero);
  if (!voulu || !NUM_OK.test(voulu)) return refus(400, 'numero', `Numéro ${MV().deNom} illisible — rien n'a été envoyé à eBay.`);
  const k = numDeSkuRelance(lu.sku);
  if (!k) return refus(409, 'sans-identite', `Cette annonce ne porte pas de référence VRM-n° : VRM ne sait pas ${MV().quelle} elle vend, il ne la remet pas en vente.`);
  const t = Date.parse(lu.debut || '');
  const num = numeroExterne(k, itemId, 'ebayAnnonces', Number.isFinite(t) ? t : null, mk);
  if (num !== voulu) return refus(409, 'identite', `Cette annonce est celle du N°${num || '?'}, pas du N°${voulu} — rien n'a été envoyé.`);
  // LE PRIX VU, au centime, dans la devise du compte.
  const vu = centimes(demande && demande.prixVu), chez = centimes(lu.prix);
  if (vu == null) return refus(400, 'prix', "Prix vu illisible — rien n'a été envoyé à eBay.");
  if (chez == null) return refus(503, 'pas-su', "eBay n'a pas rendu le prix de l'annonce — rien n'a été remis en vente.");
  if (lu.devise && devise && lu.devise !== devise) return refus(409, 'devise', `Annonce en ${lu.devise}, compte en ${devise} : VRM ne la remet pas en vente.`);
  if (vu !== chez) return refus(409, 'prix-change', `Chez eBay elle est à ${eur(chez)} ${lu.devise || devise}, pas à ${eur(vu)} : relis la liste avant de recommencer — rien n'a été envoyé.`, { prix: chez / 100 });
  // §2.8 : jamais de livraison gratuite.
  if (lu.gratuite === true) return refus(409, 'livraison-gratuite', "Cette annonce est en livraison gratuite : VRM ne la remet pas en vente telle quelle (l'acheteur paie le port) — fais-le sur eBay.");
  return { ok: true, sku: 'VRM-' + k, num, prix: chez / 100 };
}
