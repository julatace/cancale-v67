// ═══════════════════════════════════════════════════════════════════════════
// « POUR L'URSSAF » — la déclaration d'une période, à recopier (27 novembre)
// ═══════════════════════════════════════════════════════════════════════════
// Julien (27 nov.) : « Fais aussi l'export comptable pour l'URSSAF ». Pour UNE période de déclaration (le
// mois ou le trimestre, selon SON rythme enregistré — jamais deviné) : le montant à déclarer, la ligne où
// le recopier, le taux et la cotisation estimée, les ventes derrière le chiffre, les ventes « à dater »
// à part (jamais comptées), les mois déjà notés « déclarés », les seuils de l'année et une note DAC7.
// Un PDF « à recopier sur autoentrepreneur.urssaf.fr » et un CSV.
//
// AUCUNE RÈGLE ICI (§5 « une seule règle par notion ») — ce module MET EN PAGE :
//   · le MONTANT        = `caDeclare` de `donneesExportComptable` (la ligne publiée par Ventes,
//                          `vinted_urssaf_mois`, par `montantPeriodeUrssaf` : le chiffre de la carte
//                          « Prochaine déclaration ») — daté au VERSEMENT, comptes sélectionnés seulement ;
//   · la COTISATION     = `aPayerUrssaf` au taux réglé (12,4 % par défaut), SEULEMENT pour un
//                          micro-entrepreneur ; statut pas choisi (`null`) ⇒ « régime à choisir », rien estimé ;
//   · les VENTES        = le livre des recettes de la période (`livreDesRecettes` sur `ventesDeclarables`
//                          AVEC le registre `vrm_urssaf_declare` : une vente déclarée compte dans le mois de
//                          SA déclaration, plus ailleurs) ;
//   · les SEUILS        = `caAnnee` + `seuilsDe` (src/microEntreprise.js), DAC7 = `dac7ParPlateforme`
//                          (src/seuilsAnnee.js) — les règles des jauges de Comptabilité.
// « Pas su » s'écrit « — » (jamais 0) ; un total incomplet dit « au moins » et nomme ce qui manque ;
// jamais « encaissé » (§5).
// ─────────────────────────────────────────────────────────────────────────────
import { libellePeriode, moisDePeriode, jourFr, eurosTexte } from './registres.js';
import { periodesExport, couvertureExport } from './exportComptable.js';
import { calendrierUrssaf } from './microEntreprise.js';
import { DAC7 } from './seuilsAnnee.js';

export const RYTHMES = ['mensuel', 'trimestriel'];
// Le rythme ENREGISTRÉ (`vinted_urssaf_freq`), sinon null : « à choisir », jamais un défaut deviné.
export const rythmeChoisi = (v) => (RYTHMES.includes(v) ? v : null);
// Les périodes de déclaration proposées, selon SON rythme (13 mois, 5 trimestres) ; null ⇒ [].
export const periodesUrssaf = (rythme, maintenant = Date.now()) => (rythme === 'mensuel' ? periodesExport('mois', maintenant) : rythme === 'trimestriel' ? periodesExport('trimestre', maintenant) : []);
// Défaut : la dernière période FINIE (celle qui se déclare maintenant).
export const periodeUrssafParDefaut = (rythme, maintenant = Date.now()) => periodesUrssaf(rythme, maintenant)[1] || null;
export const nomFichierUrssaf = (periode, ext) => `URSSAF-${periode}.${ext}`;
export const LIGNE_URSSAF = 'Ventes de marchandises (BIC) — achat-revente';
export const SITE_URSSAF = 'autoentrepreneur.urssaf.fr';

// La date limite de la déclaration de cette période : le calendrier de Comptabilité (`calendrierUrssaf`),
// regardé le 1er jour où elle s'ouvre. Rend une Date ou null.
export function limiteDeclaration(rythme, periode) {
  const yms = moisDePeriode(periode);
  if (!rythmeChoisi(rythme) || !yms.length) return null;
  const [y, m] = yms[yms.length - 1].split('-').map(Number);
  const cal = calendrierUrssaf(rythme, new Date(y, m, 1, 12), 6);
  const p = cal.find((c) => c.ym[0] === yms[0]);
  return p ? p.limite : null;
}

// Les données. Entrées :
//   D        `donneesExportComptable` de CETTE période (ventes AVEC le registre des déclarations)
//   rythme   `vinted_urssaf_freq` lu (null = pas choisi)
//   caAn     `caAnnee(ligne, annee)` ({ ca, partiel, raisons } | null) ; seuils `seuilsDe(annee)` (| null)
//   dac7     `dac7ParPlateforme({ ligne, annee })` (| null)
export function donneesExportUrssaf(D, { rythme = null, caAn = null, seuils = null, dac7 = null, maintenant = Date.now() } = {}) {
  if (!D) return null;
  const r = rythmeChoisi(rythme);
  const annee = String(D.periode).slice(0, 4);
  const micro = D.regime === 'micro';
  const limite = limiteDeclaration(r, D.periode);
  const etat = D.regime == null ? 'regime' : !micro ? 'pas-micro' : !r ? 'rythme' : 'pret';
  return {
    periode: D.periode, libelle: D.libelle, etabliLe: D.etabliLe || jourFr(maintenant), entreprise: D.entreprise || null,
    rythme: r, etat, limite: limite ? jourFr(limite.getTime()) : '',
    regime: D.regime, regimeTexte: D.regimeTexte, raisonUrssaf: D.raisonUrssaf,
    ligneUrssaf: LIGNE_URSSAF,
    montant: D.caDeclare, partiel: D.partielCa,
    taux: micro ? D.taux : null, cotisation: micro ? D.urssaf : null,
    mois: D.caParMois, ventes: D.ventes, totalVentes: D.totalVentes, ventesCompletes: D.ventesCompletes, nVentes: D.nVentes,
    aDater: D.aDater, nADater: D.nADater, horsEuro: D.horsEuro, nHorsEuro: D.nHorsEuro,
    declares: (D.caParMois || []).filter((m) => m.declare).map((m) => m.mois),
    couverture: couvertureExport(D).filter((c) => !/achat|dépense|coût fixe|bénéfice|à dater/i.test(c)),
    annee, caAn: caAn && caAn.ca != null ? { ca: caAn.ca, partiel: !!caAn.partiel } : null,
    seuils: seuils ? { plafond: seuils.plafondVente, tvaBase: seuils.tvaBase, tvaMajore: seuils.tvaMajore } : null,
    dac7: dac7 && Array.isArray(dac7.plateformes) ? dac7.plateformes.map((p) => ({ plateforme: p.plateforme, n: p.n, centimes: p.centimes, verdict: p.verdict, partiel: !!p.partiel })) : null,
  };
}

// Les lignes « à recopier » : [libellé, valeur, clé] — les mêmes pour l'écran, le PDF et le CSV.
const auMoins = (u, x) => (x == null ? '—' : `${u ? 'au moins ' : ''}${eurosTexte(x)}`);
export function lignesARecopier(U) {
  const L = [];
  L.push(['Période', U.libelle + (U.rythme ? ` (${U.rythme === 'mensuel' ? 'déclaration mensuelle' : 'déclaration trimestrielle'})` : ''), 'periode']);
  L.push(['À déclarer avant le', U.limite || '—', 'limite']);
  L.push(['Ligne à remplir', U.ligneUrssaf, 'ligne']);
  L.push(['Chiffre d’affaires à déclarer', auMoins(U.partiel, U.montant), 'montant']);
  L.push(['Taux', U.taux == null ? (U.regime == null ? 'régime à choisir' : 'non calculé') : `${String(U.taux).replace('.', ',')} %`, 'taux']);
  L.push(['Cotisation estimée', U.cotisation == null ? '—' : auMoins(U.partiel, U.cotisation), 'cotisation']);
  return L;
}
// Ce que le document doit dire à côté (registre, à dater, seuils, DAC7).
export function notesUrssaf(U) {
  const L = [];
  if (U.etat === 'regime') L.push('Régime à choisir (en haut de Comptabilité) : aucune cotisation estimée.');
  else if (U.etat === 'pas-micro') L.push(U.raisonUrssaf);
  if (!U.rythme) L.push('Rythme de déclaration à choisir (par mois ou par trimestre).');
  if (U.declares.length) L.push(`Déjà noté « déclaré » dans VRM : ${U.declares.join(', ')}.`);
  if (U.nADater) L.push(`${U.nADater} vente${U.nADater > 1 ? 's' : ''} à dater (sans date de versement) : dans aucun mois, jamais comptée${U.nADater > 1 ? 's' : ''} ici.`);
  for (const c of U.couverture) L.push(c.charAt(0).toUpperCase() + c.slice(1) + '.');
  if (U.seuils) {
    const ca = U.caAn ? `${U.caAn.partiel ? 'au moins ' : ''}${eurosTexte(U.caAn.ca)}` : '—';
    L.push(`Seuils ${U.annee} : CA de l’année ${ca} — plafond micro ${eurosTexte(U.seuils.plafond)} ; TVA ${eurosTexte(U.seuils.tvaBase)} / ${eurosTexte(U.seuils.tvaMajore)}.`);
  }
  L.push(`DAC7 : chaque plateforme transmet aux impôts un vendeur à ${DAC7.ventes} ventes ou plus de ${eurosTexte(DAC7.centimes / 100)} dans l’année.`);
  for (const p of (U.dac7 || [])) if (p.n != null) L.push(`· ${p.plateforme} ${U.annee} : ${p.partiel ? 'au moins ' : ''}${p.n} vente${p.n > 1 ? 's' : ''}, ${p.partiel ? 'au moins ' : ''}${eurosTexte(p.centimes / 100)}${p.verdict === 'atteint' ? ' — seuil atteint' : ''}.`);
  return L;
}

const nbT = (x) => (x == null || !Number.isFinite(Number(x)) ? '' : (Math.round(Number(x) * 100) / 100).toFixed(2).replace('.', ','));
const cel = (v) => { const s = String(v == null ? '' : v).replace(/[  ]/g, ' '); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const noteDecl = (v) => [v.note, v.declaree && v.ymVers && v.ymVers !== v.ym ? `déclarée en ${libellePeriode(v.ym)} (versée en ${libellePeriode(v.ymVers)})` : (v.declaree ? 'notée déclarée' : ''), v.apres ? 'à régulariser' : ''].filter(Boolean).join(' · ');
export function csvExportUrssaf(U) {
  const L = [];
  L.push([`Déclaration URSSAF — ${U.libelle}`]);
  if (U.entreprise) { L.push([U.entreprise.nom]); if (U.entreprise.siret) L.push([`SIRET ${U.entreprise.siret}`]); }
  L.push([`Établi le ${U.etabliLe} par VRM · à recopier sur ${SITE_URSSAF}`]);
  L.push([]);
  L.push(['À RECOPIER']);
  for (const [k, v] of lignesARecopier(U)) L.push([k, v]);
  L.push([]);
  L.push(['PAR MOIS (daté au versement)']);
  L.push(['Mois', 'Ventes', 'CA (€)', 'Cotisation estimée (€)', 'Noté déclaré']);
  if (U.mois) for (const m of U.mois) L.push([m.mois, String(m.n), nbT(m.ca), U.taux == null ? '' : nbT(m.urssaf), m.declare ? 'oui' : '']);
  else L.push(['—', 'CA déclaré pas encore calculé : ouvre Ventes une fois']);
  L.push([]);
  L.push(['LES VENTES DERRIÈRE LE CHIFFRE']);
  L.push(['Date de versement', 'Plateforme', 'Compte', 'N°', 'Référence', 'Titre', 'Montant reçu (€)', 'Note']);
  if (U.ventes) { for (const v of U.ventes) L.push([v.dateVersement, v.plateforme, v.compte, v.num, v.reference, v.titre, nbT(v.montant), noteDecl(v)]); L.push(['', '', '', '', '', 'Total', nbT(U.totalVentes), U.ventesCompletes ? '' : 'au moins']); }
  else L.push(['—', 'ventes pas lues']);
  L.push([]);
  L.push(['À DATER (sans date de versement : jamais comptées)']);
  L.push(['Date de vente', 'Plateforme', 'Compte', 'N°', 'Référence', 'Titre', 'Montant reçu (€)']);
  if (U.aDater && U.aDater.length) for (const v of U.aDater) L.push([v.dateVente, v.plateforme, v.compte, v.num, v.reference, v.titre, nbT(v.montant)]);
  else L.push([U.aDater ? 'aucune' : '—']);
  if (U.horsEuro && U.horsEuro.length) {
    L.push([]);
    L.push(['AUTRE DEVISE (écartées, jamais converties)']);
    for (const v of U.horsEuro) L.push([v.dateVente, v.plateforme, v.compte, v.num, v.reference, v.titre, v.devise]);
  }
  L.push([]);
  L.push(['NOTES']);
  for (const n of notesUrssaf(U)) L.push([n]);
  return '﻿' + L.map((r) => r.map(cel).join(';')).join('\r\n') + '\r\n';
}

// Le PDF « à recopier » : la 1re page = les cases, les mois, les notes ; puis les ventes, une ligne chacune.
export async function pdfExportUrssaf(U, { PDFLib = null } = {}) {
  const PL = PDFLib || await import('pdf-lib');
  const { PDFDocument, StandardFonts, rgb } = PL;
  const doc = await PDFDocument.create();
  doc.setTitle(`Déclaration URSSAF — ${U.libelle}`);
  if (U.entreprise) doc.setAuthor(U.entreprise.nom);
  const f = await doc.embedFont(StandardFonts.Helvetica), fb = await doc.embedFont(StandardFonts.HelveticaBold);
  const ENCRE = rgb(0.11, 0.11, 0.12), GRIS = rgb(0.42, 0.42, 0.45), FILET = rgb(0.86, 0.86, 0.88), FOND = rgb(0.95, 0.95, 0.96);
  const W = 595.28, H = 841.89, M = 44;
  let page = doc.addPage([W, H]);
  const dessinable = (ch) => { try { f.encodeText(ch); return true; } catch (_) { return false; } };
  const propre = (s) => { let o = ''; for (const ch of String(s == null ? '' : s).replace(/[‘’]/g, "'").replace(/[   ]/g, ' ').replace(/−/g, '-').replace(/—/g, '-').replace(/[\r\n\t]+/g, ' ')) o += dessinable(ch) ? ch : (dessinable(ch.normalize('NFD')[0]) ? ch.normalize('NFD')[0] : ''); return o; };
  const borne = (s, font, t, max) => { let x = propre(s); if (font.widthOfTextAtSize(x, t) <= max) return x; while (x.length > 1 && font.widthOfTextAtSize(x + '...', t) > max) x = x.slice(0, -1); return x + '...'; };
  const txt = (s, x, yy, { font = f, t = 9, c = ENCRE, droite = false, max = W - 2 * M } = {}) => { const v = borne(s, font, t, max); page.drawText(v, { x: droite ? x - font.widthOfTextAtSize(v, t) : x, y: yy, size: t, font, color: c }); };
  const filet = (yy) => page.drawLine({ start: { x: M, y: yy }, end: { x: W - M, y: yy }, thickness: 0.5, color: FILET });
  // Une phrase longue : coupée en lignes qui tiennent.
  const paragraphe = (s, yy, { t = 8.5, c = GRIS } = {}) => {
    const mots = propre(s).split(' '); let l = '';
    for (const m of mots) { const e = l ? l + ' ' + m : m; if (f.widthOfTextAtSize(e, t) > W - 2 * M && l) { txt(l, M, yy, { t, c }); yy -= t + 3; l = m; } else l = e; }
    if (l) { txt(l, M, yy, { t, c }); yy -= t + 3; }
    return yy;
  };
  let y = H - M;
  if (U.entreprise) { txt(U.entreprise.nom, M, y, { font: fb, t: 11 }); if (U.entreprise.siret) txt(`SIRET ${U.entreprise.siret}`, M, y - 13, { t: 8.5, c: GRIS }); y -= 32; }
  txt(`Déclaration URSSAF — ${U.libelle}`, M, y - 6, { font: fb, t: 18 }); y -= 24;
  txt(`À recopier sur ${SITE_URSSAF} · établi le ${U.etabliLe} par VRM`, M, y, { t: 8.5, c: GRIS }); y -= 22;
  const cases = lignesARecopier(U);
  page.drawRectangle({ x: M - 8, y: y - cases.length * 22 + 8, width: W - 2 * M + 16, height: cases.length * 22 + 6, color: FOND });
  for (const [k, v, cle] of cases) {
    const fort = cle === 'montant' || cle === 'cotisation';
    txt(k, M, y - 6, { t: 10.5, font: fort ? fb : f, max: 230 }); txt(v, W - M, y - 6, { t: fort ? 13 : 10.5, font: fort ? fb : f, droite: true, max: 280 });
    y -= 22;
  }
  y -= 14;
  txt('Par mois (daté au versement)', M, y, { font: fb, t: 11 }); y -= 15;
  const xs = { mois: M, n: M + 230, ca: M + 340, urs: W - M };
  txt('Mois', xs.mois, y, { font: fb, t: 8, c: GRIS }); txt('Ventes', xs.n, y, { font: fb, t: 8, c: GRIS, droite: true }); txt('CA', xs.ca, y, { font: fb, t: 8, c: GRIS, droite: true }); txt('Cotisation estimée', xs.urs, y, { font: fb, t: 8, c: GRIS, droite: true });
  y -= 5; filet(y); y -= 11;
  if (!U.mois) { txt('CA déclaré pas encore calculé : ouvre Ventes une fois.', M, y, { c: GRIS }); y -= 13; }
  for (const m of (U.mois || [])) {
    txt(m.mois + (m.declare ? ' · noté déclaré' : ''), xs.mois, y, { t: 9, max: 210 }); txt(String(m.n), xs.n, y, { t: 9, droite: true });
    txt(eurosTexte(m.ca), xs.ca, y, { t: 9, droite: true }); txt(U.taux == null ? '—' : eurosTexte(m.urssaf), xs.urs, y, { t: 9, droite: true }); y -= 13;
  }
  y -= 10;
  txt('À savoir', M, y, { font: fb, t: 11 }); y -= 14;
  for (const n of notesUrssaf(U)) { if (y < M + 30) break; y = paragraphe(n, y, { t: 8.5, c: ENCRE }); y -= 2; }
  y -= 6;
  paragraphe('Chiffre daté au jour où la plateforme a versé l’argent (Vinted, Vestiaire, eBay quand il le dit), de la vente (Leboncoin). Comptes écartés : hors de tous les totaux. Vérifie ton taux sur le site de l’URSSAF — VRM ne remplace pas un comptable.', y, { t: 7.5 });
  // Les ventes derrière le chiffre, puis les « à dater ».
  const listes = [
    ['Les ventes derrière le chiffre', (U.ventes || []).map((v) => [v.dateVersement || '—', v.plateforme, [v.num ? `N°${v.num}` : '', v.compte, v.titre, noteDecl(v)].filter(Boolean).join(' · '), v.montant == null ? '—' : eurosTexte(v.montant)])],
    ['À dater — jamais comptées', (U.aDater || []).map((v) => [v.dateVente || '—', v.plateforme, [v.num ? `N°${v.num}` : '', v.compte, v.titre].filter(Boolean).join(' · '), v.montant == null ? '—' : eurosTexte(v.montant)])],
    ['Autre devise — jamais converties', (U.horsEuro || []).map((v) => [v.dateVente || '—', v.plateforme, [v.num ? `N°${v.num}` : '', v.compte, v.titre].filter(Boolean).join(' · '), v.devise])],
  ];
  for (const [titre, lignes] of listes) {
    if (!lignes.length) continue;
    page = doc.addPage([W, H]); y = H - M;
    txt(`${titre} (${lignes.length})`, M, y - 6, { font: fb, t: 14 }); y -= 22;
    txt(U.libelle, M, y, { t: 8.5, c: GRIS }); y -= 20;
    for (const [dt, pf, qui, mt] of lignes) {
      if (y < M + 14) { page = doc.addPage([W, H]); y = H - M; txt(`${titre} (suite)`, M, y - 6, { font: fb, t: 12 }); y -= 24; }
      txt(dt, M, y, { t: 8.5, max: 64 }); txt(pf, M + 68, y, { t: 8.5, max: 62, c: GRIS }); txt(qui, M + 134, y, { t: 8.5, max: W - 2 * M - 134 - 90 }); txt(mt, W - M, y, { t: 8.5, droite: true, max: 86 });
      y -= 5; filet(y); y -= 9;
    }
    if (titre.startsWith('Les ventes') && U.totalVentes != null) { txt('Total', M + 134, y - 2, { font: fb, t: 9 }); txt(auMoins(!U.ventesCompletes, U.totalVentes), W - M, y - 2, { font: fb, t: 9, droite: true }); }
  }
  return doc.save();
}
