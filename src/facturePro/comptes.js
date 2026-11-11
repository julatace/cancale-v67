// ════════════════════════════════════════════════════════════════════════════
//  LA FACTURE PRO — SEULEMENT SUR UN COMPTE PROFESSIONNEL (11 nov., lot DJ1)
// ════════════════════════════════════════════════════════════════════════════
// Julien : « Les factures doivent être envoyées et générées que sur compte
// professionnel, ou alors on demande au vendeur sur quel compte il veut que ça
// soit envoyé. »
//
// Module PUR : l'app (src/FactureAutres.jsx, « Ma facture ») et le serveur
// (api/_lib/facture-autres.js, avant d'émettre) appliquent la MÊME règle.
//
// · Vinted : le compte est professionnel quand VINTED le dit (profil `business`,
//   ou un e-mail de vente Vinted Pro de CETTE transaction) — règle inchangée de
//   src/FacturePro.jsx (`FactureVente`). Rien à choisir.
// · Leboncoin, eBay, Vestiaire : aucune de ces plateformes ne nous dit qu'un compte est pro.
//   Le vendeur le DIT, compte par compte (`vrm_pro_facture.comptesFacture`,
//   { 'leboncoin:<compte>' | 'ebay:<compte>' | 'vestiaire:<compte>' : true | false }) :
//     true  ⇒ les ventes de ce compte peuvent être facturées ;
//     false ⇒ jamais de facture (aucun bouton) ;
//     absent (jamais répondu) ⇒ on DEMANDE, sur la vente, avant tout bouton.
//   Un compte sans nom lu ⇒ rien (on ne peut pas demander pour « un compte »).
export const PLATEFORMES_A_CHOISIR = ['leboncoin', 'ebay', 'vestiaire'];
const txt = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();

// Le compte d'une vente BRUTE — le même dans l'app et sur le serveur :
//   Leboncoin : `account` (le compte privé de la vente) ;
//   eBay : le compte VRM de la commande (`_compte`, la ligne `ebay_orders_<id>` ;
//          la ligne `ebay_orders` = « principal ») — jamais le pseudo affiché ;
//   Vestiaire : `compte` de la vente (rangé par l'extension), sinon « principal ».
export function compteDeVente(plateforme, o) {
  if (!o || typeof o !== 'object') return '';
  if (plateforme === 'leboncoin') return txt(o.account);
  if (plateforme === 'ebay') return txt(o._compte) || 'principal';
  if (plateforme === 'vestiaire') return txt(o.compte) || 'principal';
  return '';
}

export function cleCompteFacture(plateforme, compte) {
  const c = txt(compte).toLowerCase();
  return PLATEFORMES_A_CHOISIR.includes(plateforme) && c ? `${plateforme}:${c}` : '';
}
// true · false · 'demander' · null (compte pas lu : rien à faire).
export function compteFacturable(cfg, plateforme, compte) {
  const k = cleCompteFacture(plateforme, compte);
  if (!k) return null;
  const m = cfg && cfg.comptesFacture && typeof cfg.comptesFacture === 'object' && !Array.isArray(cfg.comptesFacture) ? cfg.comptesFacture : {};
  if (m[k] === true) return true;
  if (m[k] === false) return false;
  return 'demander';
}
// Ce que SON geste écrit : la carte entière, ce compte posé (jamais les autres touchés).
export function avecCompte(cfg, plateforme, compte, oui) {
  const k = cleCompteFacture(plateforme, compte);
  const m = cfg && cfg.comptesFacture && typeof cfg.comptesFacture === 'object' && !Array.isArray(cfg.comptesFacture) ? cfg.comptesFacture : {};
  if (!k) return { ...m };
  return { ...m, [k]: oui === true };
}
// Les comptes déjà répondus, pour « Ma facture → Sur quels comptes ? ».
export function comptesConnus(cfg) {
  const m = cfg && cfg.comptesFacture && typeof cfg.comptesFacture === 'object' && !Array.isArray(cfg.comptesFacture) ? cfg.comptesFacture : {};
  return Object.keys(m).filter((k) => /^(leboncoin|ebay|vestiaire):./.test(k)).sort().map((k) => {
    const i = k.indexOf(':');
    return { cle: k, plateforme: k.slice(0, i), compte: k.slice(i + 1), oui: m[k] === true };
  });
}
