// ═══════════════════════════════════════════════════════════════════════════
// « EXPORTER POUR MON COMPTABLE » — un tableur et un PDF d'une page (9 novembre)
// ═══════════════════════════════════════════════════════════════════════════
// Julien (« fais tout ») : Comptabilité → « Exporter pour mon comptable » ⇒ une
// période (mois, trimestre, année), un fichier CSV (UTF-8 avec BOM, « ; »,
// virgule décimale : Excel en français l'ouvre tel quel) et un PDF récapitulatif
// d'UNE page, fabriqué dans le navigateur (pdf-lib, déjà dans le dépôt).
//
// AUCUNE RÈGLE ICI (§5 « une seule règle par notion ») — ce module MET EN PAGE :
//   · les VENTES       = le livre des recettes (`livreDesRecettes`, src/registres.js),
//                        c.-à-d. les lignes de `ventesDeclarables` (App.jsx) : datées
//                        au VERSEMENT, montant reçu, comptes exclus déjà dehors ;
//                        les « à dater » (sans date de versement) sont listées À PART,
//                        dans aucun mois ;
//   · les ACHATS       = le registre des achats (`registreDesAchats`) : « coût saisi »
//                        = les prix d'achat QU'IL a tapés sur les fiches reliées à CET
//                        achat par SON n° de transaction (`buyFromId`), sinon vide ;
//   · le CA DÉCLARÉ    = la ligne publiée par Ventes (`vinted_urssaf_mois`), mois par
//                        mois, et le total de la période par `montantPeriodeUrssaf`
//                        (la règle de la carte « Prochaine déclaration ») ;
//   · l'URSSAF         = `aPayerUrssaf` au taux réglé, SEULEMENT pour un
//                        micro-entrepreneur (`regimeFiscal`) ; un autre statut, ou
//                        aucun statut choisi (`null`) ⇒ non calculée, et c'est dit.
// « Pas su » s'écrit « — » (jamais 0) ; un total incomplet dit « au moins » et
// nomme ce qui manque ; jamais « encaissé » (§5).
// ─────────────────────────────────────────────────────────────────────────────
import { PERIODE_OK, libellePeriode, moisDePeriode, jourFr, eurosTexte } from './registres.js';

export { libellePeriode };
export const TYPES_PERIODE = [['mois', 'Mois'], ['trimestre', 'Trimestre'], ['annee', 'Année']];

// Les périodes proposées, les plus récentes d'abord (13 mois, 5 trimestres, 2 ans).
export function periodesExport(type, maintenant = Date.now()) {
  const d = new Date(maintenant), y = d.getFullYear(), m = d.getMonth();
  if (type === 'annee') return [String(y), String(y - 1)];
  if (type === 'trimestre') {
    const out = []; let a = y, t = Math.floor(m / 3) + 1;
    for (let i = 0; i < 5; i++) { out.push(`${a}-T${t}`); t -= 1; if (t < 1) { t = 4; a -= 1; } }
    return out;
  }
  const out = []; const x = new Date(y, m, 1);
  for (let i = 0; i < 13; i++) { out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`); x.setMonth(x.getMonth() - 1); }
  return out;
}

// Les bornes d'une période, sous la forme que lit `montantPeriodeUrssaf`
// ({ periodStart, periodEnd } : premier et dernier jour, heure locale).
export function bornesPeriode(periode) {
  const yms = moisDePeriode(periode);
  if (!yms.length) return null;
  const [y0, m0] = yms[0].split('-').map(Number), [y1, m1] = yms[yms.length - 1].split('-').map(Number);
  return { periodStart: new Date(y0, m0 - 1, 1), periodEnd: new Date(y1, m1, 0), yms };
}
export const nomFichierExport = (periode, ext) => `Export-comptable-${periode}.${ext}`;

const DATE_PAS_LUE = { Leboncoin: 'pas captée (datée à la vente)', eBay: 'non transmise (datée à la commande)' };
const RAISON_URSSAF = {
  particulier: 'URSSAF non calculée : un particulier n’a rien à déclarer à l’URSSAF',
  societe: 'URSSAF non calculée : en société, cotisations et impôts ne se calculent pas sur le chiffre d’affaires',
  marge: 'URSSAF non calculée : au régime de la marge, VRM ne calcule pas de cotisation',
  null: 'URSSAF non calculée : choisis ton statut (la question est en haut de Comptabilité)',
};
export const raisonUrssaf = (regime) => (regime === 'micro' ? '' : (RAISON_URSSAF[regime] || RAISON_URSSAF.null));

// Les données de l'export. Entrées (déjà calculées par les règles de l'app) :
//   periode      'AAAA' | 'AAAA-Tn' | 'AAAA-MM'
//   recettes     `livreDesRecettes(...)` pour CETTE période (null = pas su)
//   achats       `registreDesAchats(...)` pour CETTE période (null = pas su)
//   ligne        `vinted_urssaf_mois` (null = jamais publiée)
//   regime       `regimeFiscal()` : 'micro' | 'particulier' | 'societe' | 'marge' | null
//   taux         `tauxUrssaf()` (en %)
//   montantPeriode(due, ligne, taux) = `montantPeriodeUrssaf` ; aPayer(ca, taux) = `aPayerUrssaf`
//   libelleRegime(regime), entreprise ({ nom, siret } | null), maintenant
export function donneesExportComptable({ periode, recettes = null, achats = null, ligne = null, regime = null, taux = null, montantPeriode, aPayer, libelleRegime = (r) => String(r || ''), entreprise = null, maintenant = Date.now() } = {}) {
  if (!PERIODE_OK.test(String(periode || ''))) return null;
  const bornes = bornesPeriode(periode);
  const ymNow = (() => { const d = new Date(maintenant); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; })();
  const micro = regime === 'micro';
  // Le CA déclaré, mois par mois : la ligne publiée (les mois à venir ne sont pas listés).
  const lu = ligne && Array.isArray(ligne.mois);
  const caParMois = lu ? bornes.yms.filter((ym) => ym <= ymNow).map((ym) => {
    const m = ligne.mois.find((x) => x && x.ym === ym);
    const ca = m ? Number(m.ca) || 0 : 0;
    return { ym, mois: libellePeriode(ym), n: m ? Number(m.n != null ? m.n : m.count) || 0 : 0, ca, urssaf: micro && typeof aPayer === 'function' ? aPayer(ca, taux) : null, declare: !!(m && m.declare) };
  }) : null;
  const tot = lu && typeof montantPeriode === 'function' ? montantPeriode(bornes, ligne, taux) : { ca: null, apayer: null, partiel: false };
  const caDeclare = tot && tot.ca != null ? tot.ca : null;
  const partielCa = !!(tot && tot.partiel);
  const urssaf = micro && caDeclare != null ? (tot.apayer != null ? tot.apayer : (typeof aPayer === 'function' ? aPayer(caDeclare, taux) : null)) : null;
  // Les ventes de la période (versées), et les « à dater ».
  const ventes = recettes ? recettes.lignes.map((l) => ({
    id: l.id, dateVente: l.tsVente != null ? jourFr(l.tsVente) : '', dateVersement: l.tsVersement != null ? jourFr(l.tsVersement) : (DATE_PAS_LUE[l.plateforme] || ''),
    plateforme: l.plateforme, compte: l.compte, num: l.num, reference: l.reference, titre: l.titre, montant: l.montant, note: l.raison || '',
  })) : null;
  const aDater = recettes ? recettes.horsPeriode.map((l) => ({
    id: l.id, dateVente: l.tsVente != null ? jourFr(l.tsVente) : '', plateforme: l.plateforme, compte: l.compte, num: l.num, reference: l.reference, titre: l.titre, montant: l.montant, note: l.raison || 'à dater',
  })) : null;
  const achatsL = achats ? achats.lignes.map((l) => ({
    id: l.id, date: l.date, plateforme: l.plateforme, fournisseur: l.compte || l.fournisseur || '', reference: l.reference, num: l.num, titre: l.titre,
    saisi: l.saisi == null ? null : l.saisi, lu: l.source === 'saisi' ? null : l.montant, sourceLue: l.source === 'recu' ? 'reçu Vinted' : l.source === 'article' ? 'article seul (sans port ni frais)' : '', note: l.raison || '',
  })) : null;
  const sansCout = achatsL ? achatsL.filter((l) => l.saisi == null).length : null;
  // Aucun coût saisi sur des achats de la période : « pas su » (« — »), jamais « au moins 0,00 € » (§5).
  const coutSaisi = !achatsL || (achatsL.length && sansCout === achatsL.length) ? null : Math.round(achatsL.reduce((t, l) => t + (l.saisi == null ? 0 : Math.round(l.saisi * 100)), 0)) / 100;
  const nonComptees = lu && ligne.nonComptees && Number(ligne.nonComptees.n) > 0 ? Number(ligne.nonComptees.n) : 0;
  return {
    periode: String(periode), libelle: libellePeriode(periode), etabliLe: jourFr(maintenant),
    entreprise: entreprise && String(entreprise.nom || '').trim() ? { nom: String(entreprise.nom).trim(), siret: String(entreprise.siret || '').trim() } : null,
    regime: regime == null ? null : regime, regimeTexte: libelleRegime(regime), taux: micro ? taux : null, raisonUrssaf: raisonUrssaf(regime),
    caParMois, caDeclare, partielCa, urssaf, ligneLue: !!lu,
    ventes, nVentes: ventes ? ventes.length : null, totalVentes: recettes ? recettes.total : null, ventesCompletes: recettes ? recettes.complet : false, manqueVentes: recettes ? recettes.manque : [],
    sansMontantVentes: recettes ? recettes.sansMontant : 0,
    aDater, nADater: aDater ? aDater.length : null,
    achats: achatsL, nAchats: achatsL ? achatsL.length : null, sansCout, coutSaisi, manqueAchats: achats ? achats.manque : [],
    nonComptees,
  };
}

// Le résumé : [libellé, valeur, clé] — le même pour le PDF et le tableur.
export function resumeExport(d) {
  const L = [];
  L.push(['Statut', d.regimeTexte || '—', 'statut']);
  L.push(['Ventes versées sur la période', d.nVentes == null ? '—' : String(d.nVentes), 'n-ventes']);
  L.push(['Montant reçu de ces ventes', d.totalVentes == null ? '—' : `${d.ventesCompletes ? '' : 'au moins '}${eurosTexte(d.totalVentes)}`, 'total-ventes']);
  L.push(['CA déclaré (daté au versement)', d.caDeclare == null ? '—' : `${d.partielCa ? 'au moins ' : ''}${eurosTexte(d.caDeclare)}`, 'ca']);
  if (d.regime === 'micro') L.push([`URSSAF à payer (${String(d.taux).replace('.', ',')} %)`, d.urssaf == null ? '—' : `${d.partielCa ? 'au moins ' : ''}${eurosTexte(d.urssaf)}`, 'urssaf']);
  else L.push(['URSSAF', 'non calculée', 'urssaf']);
  L.push(['Achats de la période', d.nAchats == null ? '—' : String(d.nAchats), 'n-achats']);
  L.push(['Coût d’achat saisi', d.coutSaisi == null ? '—' : `${d.sansCout ? 'au moins ' : ''}${eurosTexte(d.coutSaisi)}`, 'cout']);
  return L;
}
// La couverture : ce qui manque, nommé (jamais tu).
export function couvertureExport(d) {
  const L = [];
  if (d.sansCout) L.push(`${d.sansCout} achat${d.sansCout > 1 ? 's' : ''} sans coût saisi`);
  if (d.nADater) L.push(`${d.nADater} vente${d.nADater > 1 ? 's' : ''} à dater (sans date de versement : dans aucun mois)`);
  if (d.sansMontantVentes) L.push(`${d.sansMontantVentes} vente${d.sansMontantVentes > 1 ? 's' : ''} au montant pas lu`);
  if (d.nonComptees) L.push(`${d.nonComptees} vente${d.nonComptees > 1 ? 's' : ''} comptée${d.nonComptees > 1 ? 's' : ''} nulle part (montant pas lu)`);
  if (!d.ligneLue) L.push('CA déclaré pas encore calculé : ouvre Ventes une fois');
  for (const m of [...(d.manqueVentes || []), ...(d.manqueAchats || [])]) L.push(`pas lu : ${m}`);
  if (d.raisonUrssaf) L.push(d.raisonUrssaf);
  if (d.totalVentes != null && d.caDeclare != null && Math.round(d.totalVentes * 100) !== Math.round(d.caDeclare * 100)) L.push('Le total des ventes listées et le CA déclaré diffèrent : une vente notée « déclarée » dans un autre mois, ou une lecture plus récente de Ventes');
  return L;
}

const nbT = (x) => (x == null || !Number.isFinite(Number(x)) ? '' : (Math.round(Number(x) * 100) / 100).toFixed(2).replace('.', ','));
const cel = (v) => { const s = String(v == null ? '' : v).replace(/[  ]/g, ' '); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function csvExportComptable(d) {
  const L = [];
  L.push([`Export comptable — ${d.libelle}`]);
  if (d.entreprise) { L.push([d.entreprise.nom]); if (d.entreprise.siret) L.push([`SIRET ${d.entreprise.siret}`]); }
  L.push([`Établi le ${d.etabliLe} par VRM`]);
  L.push([]);
  L.push(['RÉSUMÉ']);
  for (const [k, v] of resumeExport(d)) L.push([k, v]);
  const cv = couvertureExport(d);
  if (cv.length) { L.push([]); L.push(['CE QUI MANQUE']); for (const c of cv) L.push([c]); }
  L.push([]);
  L.push(['CA DÉCLARÉ PAR MOIS (daté au versement)']);
  L.push(['Mois', 'Ventes', 'CA déclaré (€)', d.regime === 'micro' ? 'URSSAF à payer (€)' : 'URSSAF', 'Noté déclaré']);
  if (d.caParMois) for (const m of d.caParMois) L.push([m.mois, String(m.n), nbT(m.ca), d.regime === 'micro' ? nbT(m.urssaf) : 'non calculée', m.declare ? 'oui' : '']);
  else L.push(['—', 'CA déclaré pas encore calculé : ouvre Ventes une fois']);
  L.push(['Total', '', nbT(d.caDeclare), d.regime === 'micro' ? nbT(d.urssaf) : '', '']);
  L.push([]);
  L.push(['VENTES VERSÉES SUR LA PÉRIODE']);
  L.push(['Date de vente', 'Date de versement', 'Plateforme', 'Compte', 'N°', 'Référence', 'Titre', 'Montant reçu (€)', 'Note']);
  if (d.ventes) { for (const v of d.ventes) L.push([v.dateVente, v.dateVersement, v.plateforme, v.compte, v.num, v.reference, v.titre, nbT(v.montant), v.note]); L.push(['', '', '', '', '', '', 'Total', nbT(d.totalVentes), d.ventesCompletes ? '' : 'au moins']); }
  else L.push(['—', 'ventes pas lues']);
  L.push([]);
  L.push(['VENTES À DATER (sans date de versement : dans aucun mois)']);
  L.push(['Date de vente', 'Plateforme', 'Compte', 'N°', 'Référence', 'Titre', 'Montant reçu (€)', 'Note']);
  if (d.aDater) for (const v of d.aDater) L.push([v.dateVente, v.plateforme, v.compte, v.num, v.reference, v.titre, nbT(v.montant), v.note]);
  else L.push(['—']);
  L.push([]);
  L.push(['ACHATS DE LA PÉRIODE']);
  L.push(['Date', 'Plateforme', 'Compte ou fournisseur', 'Référence', 'N°', 'Article', 'Coût saisi (€)', 'Montant lu (€)', 'Montant lu sur', 'Note']);
  if (d.achats) { for (const a of d.achats) L.push([a.date, a.plateforme, a.fournisseur, a.reference, a.num, a.titre, nbT(a.saisi), nbT(a.lu), a.sourceLue, a.saisi == null ? (a.note || 'coût pas saisi') : a.note]); L.push(['', '', '', '', '', 'Total saisi', nbT(d.coutSaisi), '', '', d.sansCout ? `${d.sansCout} sans coût` : '']); }
  else L.push(['—', 'achats pas lus']);
  return '﻿' + L.map((r) => r.map(cel).join(';')).join('\r\n') + '\r\n';
}

// Le PDF : UNE page A4 — en-tête, résumé, CA par mois, ce qui manque.
// Le détail ligne par ligne est dans le tableur (le PDF le dit).
export async function pdfExportComptable(d, { PDFLib = null } = {}) {
  const PL = PDFLib || await import('pdf-lib');
  const { PDFDocument, StandardFonts, rgb } = PL;
  const doc = await PDFDocument.create();
  doc.setTitle(`Export comptable — ${d.libelle}`);
  if (d.entreprise) doc.setAuthor(d.entreprise.nom);
  const f = await doc.embedFont(StandardFonts.Helvetica), fb = await doc.embedFont(StandardFonts.HelveticaBold);
  const ENCRE = rgb(0.11, 0.11, 0.12), GRIS = rgb(0.42, 0.42, 0.45), FILET = rgb(0.86, 0.86, 0.88);
  const W = 595.28, H = 841.89, M = 44;
  const page = doc.addPage([W, H]);
  const dessinable = (ch) => { try { f.encodeText(ch); return true; } catch (_) { return false; } };
  const propre = (s) => { let o = ''; for (const ch of String(s == null ? '' : s).replace(/[‘’]/g, "'").replace(/[   ]/g, ' ').replace(/−/g, '-').replace(/—/g, '-').replace(/[\r\n\t]+/g, ' ')) o += dessinable(ch) ? ch : (dessinable(ch.normalize('NFD')[0]) ? ch.normalize('NFD')[0] : ''); return o; };
  const borne = (s, font, t, max) => { let x = propre(s); if (font.widthOfTextAtSize(x, t) <= max) return x; while (x.length > 1 && font.widthOfTextAtSize(x + '...', t) > max) x = x.slice(0, -1); return x + '...'; };
  const txt = (s, x, yy, { font = f, t = 9, c = ENCRE, droite = false, max = W - 2 * M } = {}) => { const v = borne(s, font, t, max); page.drawText(v, { x: droite ? x - font.widthOfTextAtSize(v, t) : x, y: yy, size: t, font, color: c }); };
  const filet = (yy) => page.drawLine({ start: { x: M, y: yy }, end: { x: W - M, y: yy }, thickness: 0.5, color: FILET });
  let y = H - M;
  if (d.entreprise) { txt(d.entreprise.nom, M, y, { font: fb, t: 11 }); if (d.entreprise.siret) txt(`SIRET ${d.entreprise.siret}`, M, y - 13, { t: 8.5, c: GRIS }); y -= 32; }
  txt(`Export comptable — ${d.libelle}`, M, y - 6, { font: fb, t: 18 }); y -= 24;
  txt(`Établi le ${d.etabliLe} par VRM · détail ligne par ligne dans le fichier tableur`, M, y, { t: 8.5, c: GRIS }); y -= 24;
  for (const [k, v, cle] of resumeExport(d)) {
    const fort = cle === 'ca' || cle === 'urssaf';
    txt(k, M, y, { t: 10, font: fort ? fb : f, max: 300 }); txt(v, W - M, y, { t: 10, font: fort ? fb : f, droite: true, max: 200 });
    y -= 6; filet(y); y -= 13;
  }
  y -= 8;
  txt('CA déclaré par mois (daté au versement)', M, y, { font: fb, t: 11 }); y -= 15;
  const xs = { mois: M, n: M + 230, ca: M + 340, urs: W - M };
  txt('Mois', xs.mois, y, { font: fb, t: 8, c: GRIS }); txt('Ventes', xs.n, y, { font: fb, t: 8, c: GRIS, droite: true }); txt('CA déclaré', xs.ca, y, { font: fb, t: 8, c: GRIS, droite: true });
  txt(d.regime === 'micro' ? 'URSSAF à payer' : 'URSSAF', xs.urs, y, { font: fb, t: 8, c: GRIS, droite: true }); y -= 5; filet(y); y -= 11;
  if (!d.caParMois) { txt('CA déclaré pas encore calculé : ouvre Ventes une fois.', M, y, { c: GRIS }); y -= 13; }
  for (const m of (d.caParMois || [])) {
    txt(m.mois + (m.declare ? ' · noté déclaré' : ''), xs.mois, y, { t: 9, max: 210 }); txt(String(m.n), xs.n, y, { t: 9, droite: true });
    txt(eurosTexte(m.ca), xs.ca, y, { t: 9, droite: true }); txt(d.regime === 'micro' ? eurosTexte(m.urssaf) : 'non calculée', xs.urs, y, { t: 9, droite: true, c: d.regime === 'micro' ? ENCRE : GRIS }); y -= 13;
  }
  if (d.caParMois) { filet(y + 9); txt('Total', xs.mois, y - 2, { font: fb, t: 9 }); txt(d.caDeclare == null ? '—' : `${d.partielCa ? 'au moins ' : ''}${eurosTexte(d.caDeclare)}`, xs.ca, y - 2, { font: fb, t: 9, droite: true }); if (d.regime === 'micro') txt(d.urssaf == null ? '—' : eurosTexte(d.urssaf), xs.urs, y - 2, { font: fb, t: 9, droite: true }); y -= 20; }
  const cv = couvertureExport(d);
  if (cv.length) {
    y -= 6; txt('Ce qui manque', M, y, { font: fb, t: 11 }); y -= 15;
    for (const c of cv.slice(0, 10)) { txt(`· ${c}`, M, y, { t: 9 }); y -= 13; }
  }
  y -= 8;
  txt('Ventes datées au jour où la plateforme a versé l’argent (Vinted, Vestiaire), de la vente (Leboncoin), de la commande payée (eBay).', M, y, { t: 7.5, c: GRIS }); y -= 10;
  txt('Comptes écartés par le vendeur : hors de tous les totaux. Vérifie ton taux et ton chiffre sur autoentrepreneur.urssaf.fr — VRM ne remplace pas un comptable.', M, y, { t: 7.5, c: GRIS });
  return doc.save();
}
