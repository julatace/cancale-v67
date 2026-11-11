// ════════════════════════════════════════════════════════════════════════════
//  LES COMPTES VINTED PRO — RECONNUS ET COMPTÉS JUSTE (11 nov., lot vinted-pro)
// ════════════════════════════════════════════════════════════════════════════
// Julien (demande validée) : reconnaître les comptes Vinted Pro et calculer juste
// pour eux. Module PUR (aucun accès réseau) : l'écran Comptes liés, la facture Pro
// et les audits lisent la MÊME règle (§11).
//
// 1. PRO SEULEMENT SI LU, JAMAIS DEVINÉ.
//    · le profil Vinted (`harvest_{uid}_profile`, `users/current` rangé par
//      l'extension) lu par `typeCompteVinted` (App.jsx = background.js, texte pour
//      texte) : true · false · null ;
//    · la MENTION de Vinted dans un e-mail de vente de CE compte (`email_sale_*`,
//      `pro:true` posé par api/email-inbound.js sur « membre Vinted Pro » — jamais
//      déduit d'une adresse dans le texte).
//    Le profil lu fait foi (il dit l'état d'AUJOURD'HUI) ; l'e-mail ne décide que
//    quand le profil n'est pas lu. Rien des deux ⇒ « pas su », dit (jamais
//    « particulier » par défaut).
//
// 2. LES FRAIS PRO : SEULEMENT CE QUE VINTED ÉCRIT.
//    MESURÉ le 11 nov. (lecture seule, formes et sommes, aucune donnée recopiée) :
//    77 transactions de vente lues sur ses 2 comptes Pro (`harvest_{uid}_txn_*`) ont
//    EXACTEMENT la forme des 1 287 de ses comptes particuliers. Aucune ne porte un
//    frais du vendeur : `service_fee` est la Protection acheteurs, AJOUTÉE au prix
//    (`total_amount_without_tax` = `offer.price` + `service_fee` sur 77/77) — c'est
//    l'acheteur qui la paie, elle n'est ni une recette ni une charge du vendeur.
//    ⇒ la commission du vendeur Pro ne se lit QUE sur le relevé du porte-monnaie :
//      la ligne de la vente (par son n° de transaction, `tx`, jamais par un montant
//      qui ressemble) dit ce qui a été crédité ; commission = prix − crédit. Sans
//      cette ligne : « — » et la raison. Jamais un taux inventé.
//    Le barème public de Vinted est CITÉ (source, « à vérifier ») et n'entre dans
//    AUCUN calcul : la page n'a pas pu être relue depuis la session (réseau).
//
// 3. L'ARGENT D'UNE VENTE PRO.
//    · Chiffre d'affaires (ce qui se déclare à l'URSSAF en micro) = le PRIX DE
//      L'ARTICLE (`offer.price`) : une recette se déclare brute, la commission
//      d'une plateforme est une dépense (non déductible en micro) — et la
//      protection acheteurs n'est jamais dedans. C'est déjà la règle de
//      `ventesDeclarables` (prix de la commande) : ce module le VÉRIFIE et le dit.
//    · Argent reçu = le crédit LU au relevé ; pas de ligne ⇒ « — ».
//    · Une autre devise que l'euro ⇒ écartée et dite (VRM reste en euros).
// ════════════════════════════════════════════════════════════════════════════

// Le barème public — CITÉ, jamais calculé avec.
export const BAREME_VINTED_PRO = Object.freeze({
  sources: ['https://www.vinted.fr/pricelist', 'https://www.vinted.fr/pro-guide'],
  aVerifier: true,
  // Ce que tes propres transactions montrent (mesuré, pas le barème) : la
  // protection acheteurs vaut 5 % du prix + 0,70 € sur 77/77 ventes Pro lues.
  constate: 'protection acheteurs = 5 % + 0,70 €, payée par l’acheteur',
});

const txt = (v) => String(v == null ? '' : v).trim();

// Un montant Vinted (« 100.0 », 3, { amount: '2.15' }) en CENTIMES ; illisible ⇒ null.
export function centimesVinted(v) {
  const x = v && typeof v === 'object' ? (v.amount != null ? v.amount : v.value) : v;
  if (x == null || txt(x) === '') return null;
  const s = txt(x).replace(',', '.');
  if (!/^-?\d+(?:\.\d+)?$/.test(s)) return null;
  const c = Math.round(Number(s) * 100);
  return Number.isSafeInteger(c) ? c : null;
}

// ── 1. LE STATUT D'UN COMPTE ────────────────────────────────────────────────
// profil : true · false · null (règle `typeCompteVinted`) ; emailsPro : nombre
// d'e-mails de vente Vinted Pro de CE compte (par son uid) — null = pas lus.
// → { etat: 'pro' | 'particulier' | 'passu', source: 'profil' | 'email' | '', raison }
export function statutProVinted({ profil = null, emailsPro = null } = {}) {
  if (profil === true) return { etat: 'pro', source: 'profil', raison: '' };
  if (profil === false) return { etat: 'particulier', source: 'profil', raison: '' };
  if (Number.isFinite(emailsPro) && emailsPro > 0) return { etat: 'pro', source: 'email', raison: '' };
  return { etat: 'passu', source: '', raison: emailsPro == null ? 'rien-lu' : 'profil-pas-lu' };
}

// Les comptes Pro pour la facture (src/FacturePro.jsx) : la carte { uid: true|false }
// du profil, complétée par les e-mails Pro là où le profil n'est pas lu. Jamais un
// compte écrit « false » par un e-mail absent.
export function comptesProFacture(parProfil, uidsEmailsPro) {
  const out = new Map(parProfil instanceof Map ? parProfil : []);
  for (const u of (uidsEmailsPro || [])) {
    const k = txt(u);
    if (/^\d{1,20}$/.test(k) && typeof out.get(k) !== 'boolean') out.set(k, true);
  }
  return out;
}

// ── 2 et 3. L'ARGENT D'UNE VENTE ─────────────────────────────────────────────
// txn : les SCALAIRES d'une transaction (`side`, `prix`, `devise`, `frais`,
//       `total`, `statut`) ; ligneReleve : la ligne du relevé de CETTE transaction
//       (`{ tx, montant, devise }`) ou null.
// → null (pas une vente) ou { cle, caC, protectionC, recuC, commissionC, raison }
//   raison : '' · 'devise' · 'prix-pas-lu' · 'commission-pas-lue' · 'ecart-releve'
export function argentVentePro(txn, ligneReleve = null) {
  if (!txn || txt(txn.side) !== 'seller') return null;
  const dev = txt(txn.devise).toUpperCase();
  if (dev && dev !== 'EUR') return { caC: null, protectionC: null, recuC: null, commissionC: null, raison: 'devise' };
  const caC = centimesVinted(txn.prix);
  if (caC == null) return { caC: null, protectionC: null, recuC: null, commissionC: null, raison: 'prix-pas-lu' };
  // La protection n'est « payée par l'acheteur » que si Vinted l'AJOUTE au prix.
  const f = centimesVinted(txn.frais), tot = centimesVinted(txn.total);
  const protectionC = f != null && tot != null && tot === caC + f ? f : null;
  const lr = ligneReleve && typeof ligneReleve === 'object' ? ligneReleve : null;
  const devR = lr ? txt(lr.devise).toUpperCase() : '';
  const recu = lr && (!devR || devR === 'EUR') ? centimesVinted(lr.montant) : null;
  if (recu == null || recu <= 0) return { caC, protectionC, recuC: null, commissionC: null, raison: 'commission-pas-lue' };
  // Le crédit dépasse le prix (port remboursé, geste commercial…) : on ne sait pas
  // ce qu'il contient — le reçu est dit, la commission ne l'est pas.
  if (recu > caC) return { caC, protectionC, recuC: recu, commissionC: null, raison: 'ecart-releve' };
  return { caC, protectionC, recuC: recu, commissionC: caC - recu, raison: '' };
}

// Les lignes de relevé PAR n° de transaction (identité, §5). Deux lignes au même n°
// (crédit puis correction) ⇒ on ne choisit pas : la vente reste « — ».
export function relevesParTx(lignes) {
  const m = new Map(), doubles = new Set();
  for (const l of (lignes || [])) {
    const tx = l && txt(l.tx);
    if (!/^\d{3,20}$/.test(tx) || !(Number(l.montant) > 0)) continue;
    if (m.has(tx)) doubles.add(tx); else m.set(tx, l);
  }
  for (const d of doubles) m.delete(d);
  return m;
}

// Le résumé d'un compte Pro (la carte de Comptes liés). Sommes en centimes ; chaque
// total dit sa couverture (« sur N »), jamais un total partiel présenté complet.
export function resumeArgentPro(txns, lignesReleve) {
  const parTx = relevesParTx(lignesReleve);
  const r = { n: 0, nCa: 0, caC: 0, nProtection: 0, protectionC: 0, nRecu: 0, recuC: 0, nCommission: 0, commissionC: 0, ecartees: 0, raisons: {} };
  for (const t of (txns || [])) {
    const tx = t && txt(t.tx);
    const a = argentVentePro(t, tx ? parTx.get(tx) || null : null);
    if (!a) continue;
    r.n += 1;
    if (a.raison) r.raisons[a.raison] = (r.raisons[a.raison] || 0) + 1;
    if (a.caC == null) { r.ecartees += 1; continue; }
    r.nCa += 1; r.caC += a.caC;
    if (a.protectionC != null) { r.nProtection += 1; r.protectionC += a.protectionC; }
    if (a.recuC != null) { r.nRecu += 1; r.recuC += a.recuC; }
    if (a.commissionC != null) { r.nCommission += 1; r.commissionC += a.commissionC; }
  }
  return r;
}

// La projection des transactions d'UN compte (scalaires seulement, §4.4).
export const SELECT_TXN_PRO = 'id,tx:data->payload->transaction->>id,side:data->payload->transaction->>user_side,'
  + 'prix:data->payload->transaction->offer->price->>amount,devise:data->payload->transaction->offer->price->>currency_code,'
  + 'frais:data->payload->transaction->service_fee->>amount,total:data->payload->transaction->total_amount_without_tax->>amount,'
  + 'statut:data->payload->transaction->>status';
