// ═══════════════════════════════════════════════════════════════════════════
// LE PRIX QU'IL VEUT TOUCHER → LE PRIX À AFFICHER (14 nov., lot argent-prix —
// proposition 122 validée par Julien)
// ═══════════════════════════════════════════════════════════════════════════
// « Je veux toucher 80 € : quel prix mettre sur chaque site, frais compris ? »
// Ce n'est PAS un prix conseillé (refusé, §3) : le montant est LE SIEN ; VRM ne
// fait que l'INVERSE de la règle de frais existante, site par site.
// UNE règle de frais (§5, « une seule règle par notion ») : `fraisParPlateforme`
// (src/fraisPlateformes.js — celle de « Frais par site », de « Frais de l'année »
// et de la calculette) sur TOUTES ses ventes connues :
//   · Vinted    : aucune commission au vendeur (l'acheteur paie la protection) ⇒ le
//                 prix affiché = ce qu'il touche ; boosts non comptés (dit) ;
//   · Leboncoin : le prix de vente est ce que le vendeur touche ⇒ idem ;
//   · eBay      : la part des frais LUS sur SES commandes (commission ÷ dû au
//                 vendeur, ventes aux frais lus seulement) ⇒ « environ, d'après tes
//                 N ventes eBay » ; aucune commande aux frais lus ⇒ « — », pas de prix.
//                 Le port est payé par l'ACHETEUR, en plus (§2.8) : jamais compté ici ;
//   · Vestiaire : la commission LUE vente par vente (prix − versé, `fraisVc`) ⇒
//                 « environ, d'après tes N ventes » ; pas lue ⇒ « — ».
// L'INVERSE, au centime : le PLUS PETIT prix P (centimes) tel que
//   P − arrondi(P × taux) ≥ net voulu
// (le même arrondi que la calculette : la commission arrondie au centime). Puis
// l'arrondi à l'euro AU-DESSUS (un prix rond se lit mieux) — DIT : « 95 € affichés,
// tu touches environ 80,73 € ». Rien n'est envoyé ni écrit ; le prix se change
// ensuite par les chemins existants (« Changer le prix »), sur son clic.
// Module PUR. Exécuté par scripts/audit-argent-prix.cjs (section 122 : aller-retour
// prix ⇄ net au centime sur 1 € → 3 000 €, tous les taux lus).
// ═══════════════════════════════════════════════════════════════════════════
import { fraisParPlateforme } from './fraisPlateformes.js';

export const SITES_PRIX_VOULU = ['Vinted', 'Leboncoin', 'eBay', 'Vestiaire'];
const c = (v) => { const s = String(v == null ? '' : v).trim().replace(/\s| /g, '').replace(/€$/, '').replace(',', '.'); if (!/^\d+(\.\d{1,2})?$/.test(s)) return null; return Math.round(Number(s) * 100); };
export const netTape = c;

// Ce que le site prend, en pour-dix-mille (‱) : { etat: 'zero'|'taux'|'pasLu', taux, n }.
export function tauxDesSites({ releve = null, ebay = null, vestiaire = null, R = null } = {}) {
  const F = fraisParPlateforme({ releve: Array.isArray(releve) ? releve : [], ebay: Array.isArray(ebay) ? ebay : [], packs: [], de: -Infinity, a: Infinity, R: R || { commandeEbayEngagee: () => true }, vestiaire });
  const de = (k) => F.sites.find((s) => s.plateforme === k) || null;
  const out = { Vinted: { etat: 'zero', taux: 0, n: null }, Leboncoin: { etat: 'zero', taux: 0, n: null } };
  const e = de('eBay');
  const lusE = e && e.couverture ? e.couverture.lus : 0;
  out.eBay = !Array.isArray(ebay) ? { etat: 'pasLu', taux: null, n: 0, raison: 'pasLu' }
    : e && lusE > 0 && e.base > 0 ? { etat: 'taux', taux: Math.round((Math.round(e.commission * 100) / Math.round(e.base * 100)) * 10000), n: lusE } : { etat: 'pasLu', taux: null, n: 0, raison: 'fraisPasLus' };
  const v = de('Vestiaire');
  out.Vestiaire = !Array.isArray(vestiaire) ? { etat: 'pasLu', taux: null, n: 0, raison: 'pasLu' }
    : v && v.pct != null && v.couverture && v.couverture.lus > 0 ? { etat: 'taux', taux: Math.round(v.pct * 100), n: v.couverture.lus } : { etat: 'pasLu', taux: null, n: 0, raison: 'commissionPasLue' };
  return out;
}

// Ce qu'il touche pour un prix affiché P (centimes), à ce taux (‱).
export const netDe = (P, taux) => P - Math.round((P * taux) / 10000);
// Le plus petit prix affiché qui lui laisse au moins `net` (centimes).
export function prixPourNet(net, taux) {
  if (!Number.isInteger(net) || net < 0 || !Number.isInteger(taux) || taux < 0 || taux >= 10000) return null;
  if (taux === 0) return net;
  let P = Math.ceil(net / (1 - taux / 10000)) - 2;
  if (P < net) P = net;
  while (netDe(P, taux) < net) P += 1;
  while (P > net && netDe(P - 1, taux) >= net) P -= 1;
  return P;
}

// La table de la carte. `net` en centimes (ce qu'il veut toucher).
export function prixAAfficher(net, taux) {
  if (net == null) return { etat: 'vide', sites: [] };
  const sites = SITES_PRIX_VOULU.map((k) => {
    const t = taux && taux[k];
    if (!t || t.etat === 'pasLu') return { site: k, etat: 'pasLu', raison: (t && t.raison) || 'pasLu', prix: null, arrondi: null, netArrondi: null, n: 0 };
    const P = prixPourNet(net, t.taux);
    const arrondi = Math.ceil(P / 100) * 100;
    return { site: k, etat: t.etat === 'zero' ? 'exact' : 'environ', taux: t.taux, n: t.n, prix: P, arrondi, netArrondi: netDe(arrondi, t.taux) };
  });
  return { etat: 'ok', net, sites };
}
