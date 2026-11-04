// ═══════════════════════════════════════════════════════════════════════════
// L'ARGENT À VENIR — CE QUE TES SITES TE DOIVENT ENCORE (4 novembre)
// ═══════════════════════════════════════════════════════════════════════════
// Julien (4 nov.) : « ce que Vinted, eBay, Vestiaire (et Leboncoin) me doivent
// encore » = les ventes CONCLUES dont l'argent n'est pas encore versé, par
// plateforme et par compte, avec la date prévue SEULEMENT quand le site l'écrit.
//
// ⚠️ UNE SEULE RÈGLE (§11). Elle remplace « l'argent en attente » d'avant, qui
//    était Vinted seul et se calculait à deux endroits (la somme des statuts
//    « en cours » de la LISTE des ventes, ou le solde bloqué du porte-monnaie).
//    Mesuré le 4 nov. (lecture seule) : 3 ventes d'un compte disaient « colis
//    déposé » dans la liste alors que leur TRANSACTION était finalisée (450,
//    argent versé) — 220 € de trop dans « en attente ». Avec la transaction et
//    la date de versement, la somme par compte tombe sur le solde bloqué lu chez
//    Vinted, à l'euro près, sur chaque compte dont le porte-monnaie est récent.
//    Le porte-monnaie ne sert donc plus de total : il est plus ancien que les
//    ventes (une vente d'hier n'y est pas encore), et il ne dit pas QUELLE vente.
//
// La règle, par site (les fonctions propriétaires sont PASSÉES par l'app, `R`,
// jamais recopiées ici) :
//   · Vinted    : vente pas annulée ni finalisée (`R.classer`), dont la
//                 transaction n'est ni finalisée (450 = versée) ni bloquée
//                 (220 paiement échoué, ≥ 430 suspendue, retour, annulée), et
//                 sans date de versement lue. Aucune date prévue (Vinted n'en
//                 écrit pas) ⇒ rien.
//   · Leboncoin : vente PROUVÉE (`isSeller`), ni annulée ni finalisée.
//                 Aucune date prévue.
//   · eBay      : commande PAYÉE et engagée dont un paiement est RETENU par eBay
//                 (`paymentHolds`, état pas « libéré ») — sans retenue, l'argent
//                 est parti avec la commande (le CA d'eBay la date à sa création).
//                 Date prévue = `expectedReleaseDate` quand eBay l'écrit.
//   · Vestiaire : vente ni annulée, ni versée, ni terminée, au montant reçu SÛR.
//                 Date prévue = « paiement estimé » écrit par Vestiaire.
// Trois états (§5) : une source pas encore lue ⇒ `enCours` ; une source dont la
// lecture a échoué ⇒ NOMMÉE dans `manque` (le total devient « au moins ») ; une
// vente au montant illisible ⇒ `nonComptees`, nommée, jamais 0 €.
// Exécuté par scripts/audit-argent-a-venir.cjs.

const MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const sansAccent = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Une date écrite par un site : ISO, ou « 24 novembre 2026 » (Vestiaire). Rendue
// à MIDI (heure de l'appareil) pour une date sans heure — un jour, pas un instant.
// Illisible ⇒ null (jamais une date devinée).
export const dateEcriteLue = (s) => {
  if (s == null) return null;
  const brut = String(s).trim();
  if (!brut) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(brut)) { const t = Date.parse(brut + 'T12:00:00'); return Number.isFinite(t) ? t : null; }
  if (/^\d{4}-\d{2}-\d{2}T/.test(brut)) { const t = Date.parse(brut); return Number.isFinite(t) ? t : null; }
  const m = /^(\d{1,2})(?:er)?\s+([a-zéûôîèàç]+)\.?\s+(\d{4})$/i.exec(brut.replace(/\s+/g, ' '));
  if (!m) return null;
  const mot = sansAccent(m[2]);
  // Le mois en toutes lettres, ou abrégé (« nov. », au moins 3 lettres).
  const exact = MOIS_FR.findIndex((x) => sansAccent(x) === mot);
  const prefixes = mot.length < 3 ? [] : MOIS_FR.map((x, i) => (sansAccent(x).startsWith(mot) ? i : -1)).filter((i) => i >= 0);
  const k = exact >= 0 ? exact : (prefixes.length === 1 ? prefixes[0] : -1);   // « jui » : juin ou juillet ⇒ pas su
  if (k < 0) return null;
  const j = Number(m[1]), a = Number(m[3]);
  const d = new Date(a, k, j, 12, 0, 0, 0);
  return d.getMonth() === k && d.getDate() === j ? d.getTime() : null;
};

const LIBERE = /^(RELEASED|RELEASE_CONFIRMED|NOT_HELD)$/i;
const eurEbay = (m) => (m && typeof m === 'object' && m.value != null && String(m.value).trim() !== '' && isFinite(Number(m.value)) && m.currency === 'EUR') ? Number(m.value) : null;

// `sources` : chaque liste vaut `undefined` (pas encore lue), `null` (lecture
// ratée) ou un tableau. `versements` : { tx: date } | null | undefined.
// `etatTx(tx)` → { s } | null (l'état de la transaction Vinted, plus frais que la
// liste). `cachee(o)` : vente Vinted d'un compte écarté. `excluAutre(site, v)` :
// compte Leboncoin / eBay / Vestiaire écarté. `manqueVinted` : les comptes
// Vinted dont les ventes n'ont pas pu être lues (noms).
export function argentAVenir({ vinted, lbc, ebay, vestiaire, versements, etatTx, cachee, excluAutre, manqueVinted = [], R } = {}) {
  const lignes = [], nonComptees = [], manque = [];
  let enCours = false;
  const vus = new Set();
  const garde = (id) => { if (vus.has(id)) return false; vus.add(id); return true; };

  // ── VINTED ──
  if (vinted === undefined || versements === undefined) enCours = true;
  else if (!Array.isArray(vinted) || versements === null) manque.push('Vinted');
  else {
    for (const m of (manqueVinted || [])) if (m && !manque.includes(m)) manque.push(String(m));
    for (const o of vinted) {
      if (!o || (cachee && cachee(o))) continue;
      if (R.classer(o.status) !== 'pending') continue;
      const tx = o.transaction_id != null ? o.transaction_id : o.id;
      if (tx == null) continue;
      const e = etatTx ? etatTx(tx) : null;
      if (e && (e.s === 450 || e.s === 220 || e.s >= 430)) continue;
      if (versements && versements[String(tx)]) continue;
      const id = 'vinted:' + tx;
      if (!garde(id)) continue;
      const compte = String((o._acc && (o._acc.login || o._acc.vinted_user_id)) || '');
      const eur = R.montantVinted(o);
      if (eur == null) { nonComptees.push({ id, plateforme: 'Vinted', compte, raison: 'prix pas lu' }); continue; }
      lignes.push({ id, plateforme: 'Vinted', compte, eur, prevu: null, ts: Date.parse(o.date || '') || null });
    }
  }

  // ── LEBONCOIN ──
  if (lbc === undefined) enCours = true;
  else if (!Array.isArray(lbc)) manque.push('Leboncoin');
  else for (const v of lbc) {
    if (!v || v.isSeller !== true || !v.txId || R.lbcAnnulee(v) || R.lbcFinalisee(v)) continue;
    if (excluAutre && excluAutre('leboncoin', v)) continue;
    const id = 'lbc:' + v.txId;
    if (!garde(id)) continue;
    const compte = String(v.accountName || v.account || '');
    const eur = v.price != null && String(v.price).trim() !== '' && isFinite(Number(v.price)) ? Number(v.price) / 100 : null;
    if (eur == null) { nonComptees.push({ id, plateforme: 'Leboncoin', compte, raison: 'prix inconnu' }); continue; }
    lignes.push({ id, plateforme: 'Leboncoin', compte, eur, prevu: null, ts: Date.parse(v.dateVente || '') || null });
  }

  // ── eBAY ──
  if (ebay === undefined) enCours = true;
  else if (!Array.isArray(ebay)) manque.push('eBay');
  else for (const o of ebay) {
    if (!o || !o.orderId || String(o.orderPaymentStatus || '').toUpperCase() !== 'PAID' || !R.commandeEbayEngagee(o)) continue;
    if (excluAutre && excluAutre('ebay', o)) continue;
    const pay = (o.paymentSummary && Array.isArray(o.paymentSummary.payments)) ? o.paymentSummary.payments : [];
    const retenues = pay.flatMap((p) => (p && Array.isArray(p.paymentHolds) ? p.paymentHolds : [])).filter((h) => h && !LIBERE.test(String(h.holdState || '')));
    if (!retenues.length) continue;
    const id = 'ebay:' + o.orderId;
    if (!garde(id)) continue;
    const compte = String(o._pseudo || o._compte || '');
    const parRetenue = retenues.map((h) => eurEbay(h.holdAmount));
    const eur = parRetenue.every((x) => x != null) ? Math.round(parRetenue.reduce((t, x) => t + x * 100, 0)) / 100 : R.montantRecuEbay(o).eur;
    if (eur == null) { nonComptees.push({ id, plateforme: 'eBay', compte, raison: R.montantRecuEbay(o).raison || 'montant retenu illisible' }); continue; }
    const dates = retenues.map((h) => dateEcriteLue(h.expectedReleaseDate));
    const prevu = dates.every((t) => t != null) ? Math.max(...dates) : null;
    lignes.push({ id, plateforme: 'eBay', compte, eur, prevu, ts: Date.parse(o.creationDate || '') || null });
  }

  // ── VESTIAIRE ──
  if (vestiaire === undefined) enCours = true;
  else if (!Array.isArray(vestiaire)) manque.push('Vestiaire');
  else for (const v of vestiaire) {
    if (!v || !v.id || R.vcAnnulee(v)) continue;
    if (excluAutre && excluAutre('vestiaire', v)) continue;
    const et = R.etapeVc(v);
    if (et === 'versee' || et === 'terminee' || R.dateVersementVc(v)) continue;
    if (v.etapesVc && typeof v.etapesVc === 'object' && String(v.etapesVc.sellerPayment || '') === 'done') continue;
    const id = 'vestiaire:' + v.id;
    if (!garde(id)) continue;
    const compte = String(v.compte || '');
    const r = R.montantRecuVc(v);
    if (r.eur == null) { nonComptees.push({ id, plateforme: 'Vestiaire', compte, raison: r.raison || 'montant pas sûr' }); continue; }
    lignes.push({ id, plateforme: 'Vestiaire', compte, eur: r.eur, prevu: dateEcriteLue(v.paiementEstime), ts: Date.parse(v.date || '') || null });
  }

  return resumer(lignes, { manque, nonComptees, enCours });
}

const ORDRE = ['Vinted', 'eBay', 'Vestiaire', 'Leboncoin'];
const resumer = (lignes, { manque, nonComptees, enCours }) => {
  const groupes = new Map();
  for (const l of lignes) {
    const k = l.plateforme + '|' + l.compte;
    const g = groupes.get(k) || { plateforme: l.plateforme, compte: l.compte, n: 0, c: 0, prevus: [], sansDate: 0 };
    g.n += 1; g.c += Math.round(l.eur * 100);
    if (l.prevu != null) g.prevus.push(l.prevu); else g.sansDate += 1;
    groupes.set(k, g);
  }
  const parCompte = [...groupes.values()].map((g) => ({
    plateforme: g.plateforme, compte: g.compte, n: g.n, eur: g.c / 100,
    // La date du groupe n'est dite que si CHAQUE vente du groupe a la sienne :
    // la plus tardive (tout sera là ce jour-là) ; sinon rien.
    prevu: g.sansDate === 0 && g.prevus.length ? Math.max(...g.prevus) : null,
  })).sort((a, b) => (ORDRE.indexOf(a.plateforme) - ORDRE.indexOf(b.plateforme)) || (b.eur - a.eur) || (a.compte < b.compte ? -1 : 1));
  const total = Math.round(lignes.reduce((t, l) => t + Math.round(l.eur * 100), 0)) / 100;
  return { lignes, parCompte, total, n: lignes.length, manque, nonComptees, enCours, partiel: manque.length > 0 || nonComptees.length > 0 };
};

// La valeur pour un périmètre (la carte des chiffres : un site, un compte Vinted).
// → { valeur | null, partiel, manque, n, raison }. « Au moins 0 » ne se dit
// jamais (§5) : un partiel sans rien de lu ⇒ « — ».
export function aVenirPour(A, { plateforme = null, login = '' } = {}) {
  if (!A) return { valeur: null, partiel: false, manque: [], n: 0, raison: 'pasSu' };
  if (A.enCours) return { valeur: null, partiel: false, manque: [], n: 0, raison: 'encours' };
  const AUTRES = ['Leboncoin', 'eBay', 'Vestiaire'];
  const dans = (x) => (!plateforme || x.plateforme === plateforme) && (!login || (x.plateforme === 'Vinted' && String(x.compte || '') === login));
  const lignes = A.lignes.filter(dans);
  const manque = A.manque.filter((m) => {
    if (login) return m === login || m === 'Vinted';
    if (!plateforme) return true;
    if (plateforme === 'Vinted') return !AUTRES.includes(m);
    return m === plateforme;
  });
  const nc = A.nonComptees.filter(dans);
  const tous = [...new Set([...manque, ...nc.map((x) => x.plateforme)])];
  const valeur = Math.round(lignes.reduce((t, l) => t + Math.round(l.eur * 100), 0)) / 100;
  const partiel = tous.length > 0;
  if (partiel && !(valeur > 0)) return { valeur: null, partiel: true, manque: tous, n: lignes.length, raison: 'partiel' };
  return { valeur, partiel, manque: tous, n: lignes.length, raison: '' };
}

// « vers le 24 nov. » — le jour seulement, jamais une heure (un site écrit un jour).
export const texteDatePrevue = (t, maintenant = Date.now()) => {
  if (t == null || !Number.isFinite(t)) return '';
  const d = new Date(t);
  const memeAn = d.getFullYear() === new Date(maintenant).getFullYear();
  return 'vers le ' + d.toLocaleDateString('fr-FR', memeAn ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
};
