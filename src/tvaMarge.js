// ════════════════════════════════════════════════════════════════════════════
//  LA TVA SUR MARGE — BIENS D'OCCASION (11 nov. 2026, lot tva-marge)
// ════════════════════════════════════════════════════════════════════════════
// Julien (demande validée) : « la TVA sur marge (régime des biens d'occasion,
// art. 297 A du CGI) pour les revendeurs assujettis ».
//
// Module PUR (aucun réseau, aucun DOM). L'app (Comptabilité, src/App.jsx) PUBLIE
// les ventes reliées à leur prix d'achat PAR IDENTITÉ (§5 : la même liaison que le
// bénéfice et le rapport du mois — `effEntry` pour Vinted, `ventesAutresBenefice`
// pour Leboncoin, eBay, Vestiaire) ; ce module en tire la TVA vente par vente et
// la déclaration d'une période. Rien n'est calculé pour qui n'a pas choisi « TVA
// sur la marge » dans Ma facture (`tva_regime`, jamais deviné : '' = pas choisi).
//
// ── LES SOURCES (⚠️ PAS LUES depuis la session) ──────────────────────────────
// legifrance.gouv.fr et bofip.impots.gouv.fr étaient REFUSÉS par le réseau de la
// session le 11 nov. (403 du proxy). Chaque règle porte sa référence et la mention
// « à vérifier sur la page officielle » (`A_VERIFIER`) : rien n'est présenté comme
// certain. Ce sont les références habituelles du régime, à relire par un humain.
export const SOURCES_TVA_MARGE = [
  { cle: 'regime', regle: "Régime de la marge : la revente de biens d'occasion achetés à des particuliers (ou à des vendeurs qui n'ont pas facturé de TVA).", ref: 'CGI art. 297 A ; BOFiP BOI-TVA-SECT-90-20-20' },
  { cle: 'base', regle: "La TVA se calcule sur la marge = prix de vente − prix d'achat de ce qui est vendu ; la marge est « TVA comprise » : TVA = marge × 20/120.", ref: 'CGI art. 297 A, I-1° ; BOI-TVA-SECT-90-20-20' },
  { cle: 'taux', regle: 'Taux normal : 20 %.', ref: 'CGI art. 278' },
  { cle: 'negative', regle: "Vente à perte : aucune TVA sur cette vente, et la perte ne se retire pas des autres ventes (calcul au coup par coup).", ref: 'CGI art. 297 A, I-1° ; BOI-TVA-SECT-90-20-20' },
  { cle: 'globale', regle: "La « globalisation » (marge de la période = ventes − achats, où une perte compense) n'est permise que dans des cas précis prévus par la loi : VRM ne la fait pas. Parles-en à ton comptable.", ref: 'CGI art. 297 A, II ; BOI-TVA-SECT-90-20-20 (§ III)' },
  { cle: 'date', regle: "Pour une vente de biens, la TVA est due à la LIVRAISON (fait générateur et exigibilité).", ref: 'CGI art. 269, 1-a et 2-a' },
  { cle: 'facture', regle: "Sur la facture : aucune TVA apparente, et la mention « Régime particulier – Biens d'occasion ».", ref: 'CGI art. 297 E ; CGI ann. II art. 242 nonies A, I-13°' },
  { cle: 'hors', regle: "Hors du régime : un bien acheté avec une facture de TVA que tu as pu déduire, ou importé.", ref: 'CGI art. 297 A ; BOI-TVA-SECT-90-20-20' },
];
export const A_VERIFIER = "Pages officielles (legifrance.gouv.fr, bofip.impots.gouv.fr) pas ouvertes par VRM : à vérifier sur la page officielle ou avec ton comptable.";
export const TAUX_MARGE = 20;            // CGI art. 278 (à vérifier) — le seul taux des sneakers
export const CLE_TVA_MARGE = 'vrm_tva_marge';
export const EVT_TVA_MARGE = 'vrm:tva-marge';

// ── LA DATE QUI PLACE UNE VENTE (« fait générateur ») ───────────────────────
// La loi dit : la livraison (art. 269, à vérifier). VRM ne lit pas la date de
// réception par l'acheteur ; il prend, par plateforme, la date LUE la plus proche
// — et le DIT sur la carte (`DATE_PAR_PLATEFORME`) :
//   Vinted, Vestiaire : la commande finalisée (l'acheteur a confirmé la réception) ;
//   Leboncoin : la date de vente relevée ; eBay : la date de la commande.
export const DATE_PAR_PLATEFORME = {
  Vinted: 'commande finalisée (réception confirmée)',
  Vestiaire: 'vente versée (réception confirmée)',
  Leboncoin: 'date de vente',
  eBay: 'date de la commande',
};

// Le mois et le trimestre à l'heure de PARIS (une vente à 23 h 30 le 31 reste dans son mois).
export function moisParis(ts) {
  const t = Number(ts);
  if (!Number.isFinite(t) || t <= 0) return null;
  try {
    const p = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit' }).formatToParts(new Date(t));
    const g = (k) => (p.find((x) => x.type === k) || {}).value;
    return `${g('year')}-${g('month')}`;
  } catch (_) { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
}
export const trimestreDe = (ym) => (ym ? `${ym.slice(0, 4)}-T${Math.floor((Number(ym.slice(5, 7)) - 1) / 3) + 1}` : null);
// « 2026-11 » ou « 2026-T4 » : la période contient-elle ce mois ?
export const dansPeriode = (ym, periode) => !!ym && (/^\d{4}-T[1-4]$/.test(periode) ? trimestreDe(ym) === periode : ym === periode);
export function libellePeriode(periode) {
  const M = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  let m = /^(\d{4})-T([1-4])$/.exec(String(periode || ''));
  if (m) return `${m[2] === '1' ? '1er' : `${m[2]}e`} trimestre ${m[1]}`;
  m = /^(\d{4})-(\d{2})$/.exec(String(periode || ''));
  return m ? `${M[Number(m[2]) - 1]} ${m[1]}` : '';
}

// ── UNE VENTE ───────────────────────────────────────────────────────────────
// Entrée (en CENTIMES entiers) : { id, plateforme, titre, num, ts, prixC, achatC }
//   prixC  : le prix de vente payé par l'acheteur pour l'article (null = pas lu) ;
//   achatC : le prix d'achat SAISI par lui pour CETTE paire, reliée par identité
//            (null = pas saisi ou pas relié — jamais 0, jamais deviné, §2.5).
// États : 'ok' · 'perte' (marge ≤ 0 : TVA 0 sur cette vente) · 'achat' (prix
// d'achat manquant : « — », à compléter) · 'prix' (prix de vente pas lu) ·
// 'date' (pas de date : dans aucune période, « à dater »).
const entier = (v) => (Number.isSafeInteger(v) ? v : null);
export const tvaDeMarge = (margeC) => (Number.isSafeInteger(margeC) && margeC > 0 ? Math.round(margeC * TAUX_MARGE / (100 + TAUX_MARGE)) : 0);
export function venteMarge(x) {
  const v = x || {};
  const prixC = entier(v.prixC), achatC = entier(v.achatC);
  const ym = moisParis(v.ts);
  const base = { id: String(v.id || ''), plateforme: v.plateforme || '', titre: String(v.titre || ''), num: String(v.num || ''), ts: ym ? Number(v.ts) : null, ym, prixC, achatC };
  if (prixC == null || prixC <= 0) return { ...base, etat: 'prix', margeC: null, tvaC: null, baseC: null };
  if (achatC == null || achatC < 0) return { ...base, etat: 'achat', margeC: null, tvaC: null, baseC: null };
  const margeC = prixC - achatC;
  const tvaC = tvaDeMarge(margeC);
  const r = { ...base, margeC, tvaC, baseC: margeC > 0 ? margeC - tvaC : 0 };
  if (!ym) return { ...r, etat: 'date' };
  return { ...r, etat: margeC > 0 ? 'ok' : 'perte' };
}
export const RAISON_EXCLUE = {
  achat: "prix d'achat pas saisi (ou achat pas relié)",
  prix: 'prix de vente payé par l’acheteur pas lu',
  date: 'pas de date de livraison lue',
};

// ── LA DÉCLARATION D'UNE PÉRIODE (mois « AAAA-MM » ou trimestre « AAAA-Tn ») ──
// Au coup par coup : chaque vente à perte compte 0 (jamais une marge négative
// retirée des autres). Une vente sans prix d'achat ou sans prix de vente n'est PAS
// un 0 : elle est mise à part, NOMMÉE, et le total devient « au moins » (§5).
export function declarationMarge(lignes, periode) {
  const ventes = (Array.isArray(lignes) ? lignes : []).map(venteMarge);
  const dans = ventes.filter((v) => dansPeriode(v.ym, periode));
  const comptees = dans.filter((v) => v.etat === 'ok' || v.etat === 'perte');
  const aCompleter = dans.filter((v) => v.etat === 'achat' || v.etat === 'prix');
  const sum = (a, k) => a.reduce((s, v) => s + (v[k] || 0), 0);
  const positives = comptees.filter((v) => v.etat === 'ok');
  const pertes = comptees.filter((v) => v.etat === 'perte');
  return {
    periode,
    libelle: libellePeriode(periode),
    n: dans.length,
    nComptees: comptees.length,
    prixC: sum(comptees, 'prixC'),
    achatC: sum(comptees, 'achatC'),
    margeC: sum(positives, 'margeC'),           // marges POSITIVES, TVA comprise
    tvaC: sum(positives, 'tvaC'),               // somme des TVA arrondies vente par vente
    baseC: sum(positives, 'baseC'),             // base hors taxe des marges (à déclarer)
    nPertes: pertes.length,
    perteC: -sum(pertes, 'margeC'),             // ce qui ne se retire de rien (dit, jamais imputé)
    aCompleter,                                  // dites, une par une (la porte pour les corriger)
    complet: aCompleter.length === 0,
    comptees,
  };
}
// Ce qui n'est dans AUCUNE période (pas de date) : dit à part, pour toutes.
export const aDaterMarge = (lignes) => (Array.isArray(lignes) ? lignes : []).map(venteMarge).filter((v) => !v.ym);
// Les périodes où il y a au moins une vente (les plus récentes d'abord).
export function periodesMarge(lignes, mode = 'mois') {
  const s = new Set();
  for (const v of (Array.isArray(lignes) ? lignes : []).map(venteMarge)) if (v.ym) s.add(mode === 'trimestre' ? trimestreDe(v.ym) : v.ym);
  return [...s].sort().reverse();
}

// ── LES MONTANTS ÉCRITS ─────────────────────────────────────────────────────
export const eurosC = (c) => {
  if (!Number.isSafeInteger(c)) return '—';
  const neg = c < 0, a = Math.abs(c);
  return `${neg ? '−' : ''}${String(Math.floor(a / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')},${String(a % 100).padStart(2, '0')} €`;
};
const virg = (c) => (Number.isSafeInteger(c) ? `${c < 0 ? '-' : ''}${Math.floor(Math.abs(c) / 100)},${String(Math.abs(c) % 100).padStart(2, '0')}` : '');
export const jourParisTs = (ts) => {
  if (!Number.isFinite(ts)) return '';
  try { return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(ts)); } catch (_) { return ''; }
};

// ── L'EXPORT POUR LE COMPTABLE (CSV, séparateur « ; », virgule décimale) ────
// Une ligne par vente de la période (comptée ou exclue, avec la raison), puis le
// total — le même chiffre que la carte (`declarationMarge`), jamais recalculé.
export function csvDeclarationMarge(d) {
  const q = (x) => `"${String(x == null ? '' : x).replace(/"/g, '""')}"`;
  const rows = [
    [`TVA sur marge — biens d'occasion — ${d.libelle}`],
    ['Date (livraison retenue)', 'Plateforme', 'N°', 'Article', 'Prix de vente', "Prix d'achat", 'Marge TTC', 'Base HT', 'TVA due', 'État'],
  ];
  const etat = (v) => (v.etat === 'ok' ? 'comptée' : v.etat === 'perte' ? 'perte : TVA 0, non imputée' : `exclue : ${RAISON_EXCLUE[v.etat] || v.etat}`);
  for (const v of [...d.comptees, ...d.aCompleter].sort((a, b) => (a.ts || 0) - (b.ts || 0))) {
    rows.push([jourParisTs(v.ts), v.plateforme, v.num, v.titre, virg(v.prixC), virg(v.achatC), virg(v.margeC), virg(v.baseC), virg(v.tvaC), etat(v)]);
  }
  rows.push([]);
  rows.push([d.complet ? 'Total' : 'Total (au moins : des ventes sont exclues)', '', '', `${d.nComptees} vente(s) comptée(s)`, virg(d.prixC), virg(d.achatC), virg(d.margeC), virg(d.baseC), virg(d.tvaC), '']);
  if (d.nPertes) rows.push([`${d.nPertes} vente(s) à perte : ${virg(d.perteC)} € non imputés (calcul vente par vente)`]);
  if (d.aCompleter.length) rows.push([`${d.aCompleter.length} vente(s) exclue(s) : à compléter dans VRM avant de déclarer`]);
  rows.push([`Taux ${TAUX_MARGE} % — TVA = marge × ${TAUX_MARGE}/${100 + TAUX_MARGE}, arrondie au centime vente par vente`]);
  rows.push([`Date retenue : ${Object.entries(DATE_PAR_PLATEFORME).map(([p, t]) => `${p} = ${t}`).join(' ; ')}`]);
  rows.push([`Sources : ${SOURCES_TVA_MARGE.map((s) => s.ref).filter((x, i, a) => a.indexOf(x) === i).join(' ; ')}`]);
  rows.push([A_VERIFIER]);
  return '﻿' + rows.map((r) => r.map(q).join(';')).join('\n');
}

// ── LA PUBLICATION (Comptabilité publie, la carte consomme — §11) ───────────
// Compacte (localStorage de cet appareil, comme `vrm_sources_ventes`) :
// [id, plateforme, titre, num, ts|0, prixC|null, achatC|null].
// `partiel` : une source pas lue (Leboncoin, eBay, Vestiaire, dates de versement)
// — la carte le dit (« au moins »), jamais un total qui se présente complet.
export function publierTvaMarge(lignes, { owner = '', partiel = [] } = {}) {
  if (!Array.isArray(lignes)) return;
  const l = lignes.map((x) => [String(x.id || ''), String(x.plateforme || ''), String(x.titre || '').slice(0, 120), String(x.num || ''), Number(x.ts) || 0, entier(x.prixC), entier(x.achatC)]);
  const p = { v: 1, owner: String(owner || ''), partiel: (Array.isArray(partiel) ? partiel : []).map(String), l };
  try {
    const neuf = JSON.stringify(p);
    const avant = localStorage.getItem(CLE_TVA_MARGE);
    if (avant && avant.replace(/,"at":\d+}$/, '}') === neuf) return;
    localStorage.setItem(CLE_TVA_MARGE, JSON.stringify({ ...p, at: Date.now() }));
  } catch (_) { /* stockage refusé : la carte dit « — » */ }
  try { window.dispatchEvent(new CustomEvent(EVT_TVA_MARGE)); } catch (_) {}
}
// Pas (ou plus) en TVA sur marge : la publication est retirée de cet appareil.
export function retirerTvaMarge() {
  try { if (localStorage.getItem(CLE_TVA_MARGE) == null) return; localStorage.removeItem(CLE_TVA_MARGE); } catch (_) { return; }
  try { window.dispatchEvent(new CustomEvent(EVT_TVA_MARGE)); } catch (_) {}
}
// Lecture : null = rien de publié (« pas su »), sinon { lignes, partiel, at }.
export function lireTvaMarge(brut, owner = '') {
  let p = brut;
  if (typeof p === 'string') { try { p = JSON.parse(p); } catch (_) { return null; } }
  if (!p || p.v !== 1 || !Array.isArray(p.l)) return null;
  if (owner && p.owner && p.owner !== owner) return null;      // la publication d'un autre compte VRM
  const lignes = p.l.filter(Array.isArray).map(([id, plateforme, titre, num, ts, prixC, achatC]) => ({ id, plateforme, titre, num, ts: ts || null, prixC: entier(prixC), achatC: entier(achatC) }));
  return { lignes, partiel: Array.isArray(p.partiel) ? p.partiel : [], at: Number(p.at) || 0 };
}
