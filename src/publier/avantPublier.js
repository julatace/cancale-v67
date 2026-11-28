// ════════════════════════════════════════════════════════════════════════════
//  AVANT DE PUBLIER : « RELIER À UN ACHAT » ET « PRIX MINIMUM ACCEPTÉ » (28 nov. 2026)
// ════════════════════════════════════════════════════════════════════════════
// Julien (28 nov.) : « Quand on publie, à côté, AVANT de publier, je veux pouvoir relier à un achat, et un bouton pour
// dire quel est le prix le plus bas à accepter. Tout doit être parfait, comme ça l'extension peut faire des
// contre-offres, etc. »
//
// Ce module est LA règle (pure, sans React ni réseau) des deux rangées posées devant chaque « Publier » de l'app
// (Préparer / Déposer, Publier aussi sur…, le dossier « À publier », la fiche de la paire, Annonces).
//
// ⚠️ L'ACHAT (§2.4, §5) : une suggestion peut se ranger par ressemblance (marque, modèle, taille, couleur :
//   `suggestionsAchat`, la règle d'avant — une autre marque ou aucun mot de modèle commun ÉCARTE) ; c'est TOUJOURS son
//   toucher qui relie (`ecritureLien` n'est appelée que par son « Relier »). Rien ici ne relie seul.
// ⚠️ LE PRIX D'ACHAT (§2.5) : le montant du REÇU de CET achat (par SON n° de transaction, `propositionPrixAchat` /
//   `prixDuRecu`) ; un LOT n'est jamais divisé (« prix d'achat à saisir ») ; une saisie n'est jamais écrasée (l'appelant
//   écrit `buyPrice` seulement si la fiche n'en a pas : `champsLien`). Sans reçu juste ⇒ « prix d'achat à saisir ».
// ⚠️ LE PRIX MINI : UN champ, celui que tous les gestes automatiques lisent déjà — `vinted_annonce_numeros[id].min`
//   (+ `minAt`), et la clé `vrm_prix_mini` de la ligne `vrm_reglages_auto` (par N° ou par annonce) pour ce qui n'a pas
//   encore d'identifiant Vinted ; la règle de lecture est `pmMiniDe` (src/prixMiniPose.js, recopiée dans l'extension).
//   Consommateurs (tous par ce champ, vérifié par scripts/audit-publier-achat-mini.cjs) : `autoAccepterOffres`
//   (`offreAutoReglages` → `reg.mins`), la contre-offre (`palierContreOffre` / négo intelligente, `reg.mins`), l'Agent VRM
//   (`agDecisionOffre`, `reg.mins`), les offres aux favoris (`plancherFavori`), la baisse par règle (`plancherBaisse`) et
//   la garde du prix (`gardePlancher`). Jamais pré-rempli, jamais deviné : l'indication « achat + 10 % = X € » n'est
//   qu'une phrase sous « Pourquoi ? ».
import { gardePrixRegle } from '../gardePrix.js';
import { pmMontant, pmProposition } from '../prixMiniPose.js';
import { plancherDe, reglagesPaliers } from '../negociationPaliers.js';
import { suggestionsAchat, tousAchatsLibres, lotDe } from '../suggestionsAchat.js';

export const CHAMP_MINI = 'min';
export const CHAMP_MINI_DATE = 'minAt';
const str = (v) => String(v == null ? '' : v).trim();
const vide = (v) => v == null || str(v) === '';
const cents = (v) => { const n = pmMontant(v); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null; };
const txDe = (v) => { const t = str(v); return /^\d{4,20}$/.test(t) ? t : ''; };

// L'ÉTAT DE L'ACHAT d'un article (fiche d'annonce, fiche « À publier ») — ce que la rangée dit.
//   aucun     : rien de relié, aucun prix ;          saisi : un prix tapé par lui (relié ou non) ;
//   recu      : relié, prix posé depuis SON reçu ;    lot   : relié à un lot, prix à saisir (jamais divisé) ;
//   a-saisir  : relié, aucun reçu juste lu : prix d'achat à saisir.
export function etatAchat(fiche) {
  const f = fiche && typeof fiche === 'object' ? fiche : {};
  const relie = !!txDe(f.buyFromId);
  const bf = f.buyFrom && typeof f.buyFrom === 'object' ? f.buyFrom : {};
  const c = cents(f.buyPrice);
  if (!relie) return c != null ? { etat: 'saisi', centimes: c, relie: false } : { etat: 'aucun', centimes: null, relie: false };
  if (c != null) return { etat: f.buyPriceSource === 'recu' || bf.recu === true ? 'recu' : 'saisi', centimes: c, relie: true, tx: txDe(f.buyFromId), titre: str(bf.title) };
  if (bf.aSaisir || bf.lot) return { etat: 'lot', centimes: null, relie: true, tx: txDe(f.buyFromId), titre: str(bf.title) };
  return { etat: 'a-saisir', centimes: null, relie: true, tx: txDe(f.buyFromId), titre: str(bf.title) };
}

// LES ACHATS À PROPOSER dans la feuille « Relier à un achat » : ses achats PAS ENCORE RELIÉS (un lot jusqu'à son nombre),
// du plus récent au plus ancien (`tousAchatsLibres`, la règle de la feuille d'avant), et en tête les SUGGESTIONS
// (`suggestionsAchat` : même marque, un mot de modèle commun, même taille, achat antérieur ; jamais la marque seule).
// Rend { suggestions: [achat], libres: [achat] } — les deux listes sans doublon ; rien n'est relié.
export function achatsARelier({ cible = null, achats, liens, marqueDe, couleursDe, modeleDe = null, max = 3 } = {}) {
  const libres = tousAchatsLibres({ achats, liens });
  let sugg = [];
  if (cible && typeof marqueDe === 'function' && typeof couleursDe === 'function') {
    try { sugg = suggestionsAchat({ cible, achats: libres, liens, marqueDe, couleursDe, modeleDe, max }).map((s) => s.achat); } catch (_) { sugg = []; }
  }
  const pris = new Set(sugg.map((a) => txDe(a && a.transaction_id)));
  return { suggestions: sugg, libres: libres.filter((a) => !pris.has(txDe(a && a.transaction_id))) };
}

// L'ÉCRITURE DU LIEN (SON toucher sur « Relier ») : l'identité de l'achat + son instantané ; le prix seulement s'il vient
// du REÇU de CET achat (`proposition.source === 'recu'`, la règle `propositionPrixAchat`), jamais pour un lot.
// `proposition` : le résultat de `propositionPrixAchat` (ou null). Rend { buyFromId, buyFrom, buyPrice?, buyPriceSource? }.
export function ecritureLien(achat, { proposition = null, accNom = '', photo = '', estLot = null } = {}) {
  const a = achat && typeof achat === 'object' ? achat : null;
  const tx = txDe(a && a.transaction_id);
  if (!tx) return null;
  const lot = typeof estLot === 'boolean' ? estLot : lotDe(a).lot;
  const recu = !lot && proposition && proposition.source === 'recu' && proposition.tx === tx && Number.isSafeInteger(proposition.centimes) && proposition.centimes > 0;
  const prix = a.price && typeof a.price === 'object' ? Number(a.price.amount) : Number(a.price);
  const out = {
    buyFromId: tx,
    buyFrom: { title: str(a.title).slice(0, 200), date: str(a.date), photo: str(photo), price: Number.isFinite(prix) && prix > 0 ? prix : null,
      devise: str(a.price && a.price.currency_code) || 'EUR', seller: str(a.seller || a.user_login), status: str(a.status), account: str(accNom), recu: !!recu, ...(lot ? { lot: true, aSaisir: true } : {}) },
  };
  if (recu) { out.buyPrice = (proposition.centimes / 100).toFixed(2).replace('.', ','); out.buyPriceSource = 'recu'; out.buyPriceRecuTx = tx; }
  return out;
}
// Les champs à écrire sur une fiche existante : un prix déjà saisi (même « 0 ») n'est JAMAIS écrasé.
export function champsLien(fiche, lien) {
  if (!lien) return null;
  const f = fiche && typeof fiche === 'object' ? fiche : {};
  const out = { buyFromId: lien.buyFromId, buyFrom: lien.buyFrom };
  if (lien.buyPrice != null && vide(f.buyPrice)) { out.buyPrice = lien.buyPrice; out.buyPriceSource = lien.buyPriceSource; out.buyPriceRecuTx = lien.buyPriceRecuTx; }
  return out;
}

// L'INDICATION sous « Pourquoi ? » : achat + 10 % (arrondi à l'euro du dessus, la règle `pmProposition`). Jamais pré-rempli.
export function indiceMini(achatC) {
  if (!(Number.isSafeInteger(achatC) && achatC > 0)) return null;
  const p = pmProposition({ achat: achatC / 100 });
  return p.de === 'achat' && p.valeur > 0 ? Math.round(p.valeur * 100) : null;
}

// LA VÉRIFICATION DU PRIX MINI tapé, par LA garde du prix (src/gardePrix.js, mode « main ») :
//   vide       — rien n'est rangé (il n'a rien dit : rien d'automatique) ;
//   illisible  — pas un montant ;
//   refuse     — 0 € ou moins (jamais permis), ou au-dessus du prix de l'annonce (règle `pmNormalise`) ;
//   confirmer  — sous le prix d'achat, ou ×10 / ÷10 du prix (faute de frappe probable) : SA confirmation du chiffre ;
//   ok.
// Le plancher de la garde est ici le PRIX D'ACHAT (un prix mini entre l'achat et l'achat + 10 % est un choix permis) ;
// la « chute » de la garde (un prix mini 40 % sous le prix, ce qui est normal) n'est pas une raison de demander.
export function verifierMini(texte, { prixC = null, achatC = null, confirmeC = null } = {}) {
  if (texte == null || str(texte) === '') return { etat: 'vide', c: null, raisons: [] };
  const t = str(texte).replace(/\s|€/g, '').replace(',', '.');
  const n = /^-?\d{1,6}(\.\d{1,2})?$/.test(t) ? Number(t) : NaN;
  if (!Number.isFinite(n)) return { etat: 'illisible', c: null, raisons: [] };
  const c = Math.round(n * 100);
  if (!(c > 0)) return { etat: 'refuse', c, raisons: ['zero'] };
  const p = Number.isSafeInteger(prixC) && prixC > 0 ? prixC : null;
  if (p != null && c > p) return { etat: 'refuse', c, raisons: ['au-dessus'] };
  const g = gardePrixRegle({ prixC: c, actuelC: p, plancher: Number.isSafeInteger(achatC) && achatC > 0 ? { c: achatC, de: 'achat' } : null, mode: 'main', confirmeC });
  const raisons = g.raisons.filter((r) => r === 'zero' || r === 'plancher' || r === 'frappe');
  if (raisons.includes('zero')) return { etat: 'refuse', c, raisons };
  if (!raisons.length) return { etat: 'ok', c, raisons };
  const confirme = Number.isSafeInteger(confirmeC) && confirmeC === c;
  return { etat: confirme ? 'ok' : 'confirmer', c, raisons, confirme };
}

// LA LIGNE « OFFRES » sous le prix mini — dite par les MÊMES règles que les moteurs (ce que l'extension fera) :
//   sans-mini    : aucun prix mini ⇒ rien d'automatique ne vend ni ne contre-offre sous son contrôle ;
//   contre       : négociation par paliers (ou intelligente) ou Agent VRM allumés ⇒ « contre-offre auto jusqu'à X € »
//                  (X = le plancher de la négociation, `plancherDe` : jamais sous le prix mini) ;
//   accepte      : seul le moteur des offres est allumé ⇒ « acceptée dès X € » ;
//   eteint       : prix mini rangé, automatismes éteints ⇒ « prix mini X € · automatismes éteints ».
// `prixC` : le prix de l'annonce (pour le plancher de la négociation) ; inconnu ⇒ le prix mini lui-même.
export function ligneOffres({ miniC = null, prixC = null, autoAccepte = false, paliers = null, agentActif = false } = {}) {
  if (!(Number.isSafeInteger(miniC) && miniC > 0)) return { cle: 'ap.offres.sansMini', vars: {} };
  const R = reglagesPaliers(paliers);
  const contre = R.actif || agentActif === true;
  let jusqua = miniC;
  if (contre && Number.isSafeInteger(prixC) && prixC > miniC) {
    const f = plancherDe(prixC / 100, miniC / 100, R.remiseMax, { tranches: R.tranches });
    if (Number.isFinite(f) && f > 0) jusqua = Math.max(miniC, Math.round(f * 100));
  }
  if (contre) return { cle: autoAccepte === true ? (jusqua === miniC ? 'ap.offres.contreEtAccepteMin' : 'ap.offres.contreEtAccepte') : 'ap.offres.contre', vars: { c: jusqua, min: miniC } };
  if (autoAccepte === true) return { cle: 'ap.offres.accepte', vars: { c: miniC } };
  return { cle: 'ap.offres.eteint', vars: { c: miniC } };
}

// L'ÉCRITURE DU PRIX MINI (SON « OK ») : la fiche d'annonce (`min` + `minAt`, le champ des moteurs) — et, pour ce qui n'a
// pas encore d'identifiant Vinted, la demande de la ligne `vrm_prix_mini` par N° (`pmNormalise`). `null` = l'effacer.
export function ecritureMini(c, maintenant = Date.now()) {
  const at = new Date(Number(maintenant) || Date.now()).toISOString();
  if (c == null) return { min: '', minAt: at };
  // « 45.5 » (point) : la forme de `montantSeuil` (src/offresSures.js), lisible par toutes les versions de l'extension.
  return { min: String(Math.round(c) / 100), minAt: at };
}
