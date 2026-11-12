import { jourParis, moisParis } from './dateParis.js';
// ═══════════════════════════════════════════════════════════════════════════
// LE RÉCAP COMPTABLE DU MOIS — PDF et tableur (3 novembre)
// ═══════════════════════════════════════════════════════════════════════════
// Julien (3 nov., 13 h 02) : Compta → Documents → « Récap de [mois] » ⇒ un PDF
// et un fichier tableur : les ventes (date, site, N°, titre, vendu, reçu le,
// frais), le CA déclaré daté au versement, l'URSSAF, les dépenses, le bénéfice,
// la couverture (« prix d'achat connus 32/38 »).
//
// AUCUN CALCUL ICI (§5 « une seule règle par notion ») : ce module MET EN PAGE
// ce que l'écran affiche déjà —
//   · le bénéfice      = `chiffreBenefice(beneficePeriode(mois))` (le même que la
//                        colonne « Bénéfice » du récap mensuel, Ma journée, Stats) ;
//   · le CA déclaré    = la ligne publiée par Ventes (`vinted_urssaf_mois`), datée
//                        au VERSEMENT, et son URSSAF (`aPayerUrssaf`, même taux) ;
//   · les dépenses     = `comptaChargesMois` (et ses lignes, qui somment au même
//                        total) ;
//   · les ventes       = le relevé de Ventes (`vrm_stats_ventes`), les MÊMES ventes
//                        que le bénéfice (finalisées, hors masquées, datées au
//                        jour de la vente) ; s'il ne couvre pas le même nombre de
//                        ventes que le bénéfice, le document le DIT.
// « Pas su » s'écrit « — » (jamais 0) ; jamais « encaissé » (§5).
// ─────────────────────────────────────────────────────────────────────────────

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const libelleMois = (ym) => { const [y, m] = String(ym || '').split('-').map(Number); return y && m ? `${MOIS[m - 1]} ${y}` : String(ym || ''); };
export const nomFichierRecap = (ym, ext) => `Recap-${ym}.${ext}`;

const c2 = (x) => (x == null || !isFinite(Number(x)) ? null : Math.round(Number(x) * 100));
export const eurosTexte = (x) => {
  const c = c2(x); if (c == null) return '—';
  const n = Math.abs(c);
  return (c < 0 ? '−' : '') + String(Math.floor(n / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ',' + String(n % 100).padStart(2, '0') + '\u00a0€';
};
const tableur = (x) => (x == null || !isFinite(Number(x)) ? '' : (Math.round(Number(x) * 100) / 100).toFixed(2).replace('.', ','));
const jour = (t) => { const j = jourParis(t); return j ? `${j.slice(8, 10)}/${j.slice(5, 7)}/${j.slice(0, 4)}` : ''; };
const ymLocal = (t) => moisParis(t);   // (11 nov.) mois de PARIS

// Les données du récap. Entrées (toutes déjà calculées par les règles de l'app) :
//   ym, releve (lignes `vrm_stats_ventes` ou null), benefice ({ valeur, raison }),
//   B (résultat de beneficePeriode : n, nCout, ca), caDeclare ({ ca, n } | null),
//   urssaf (nombre | null), taux (nombre | null : pas micro), charges ({ lignes:[{libelle, montant, date}], total }),
//   entreprise ({ nom, siret, adresse, logo } | null), maintenant.
export function donneesRecapMois({ ym, releve = null, benefice = null, B = null, caDeclare = null, urssaf = null, taux = null, charges = null, entreprise = null, maintenant = Date.now() } = {}) {
  const ventes = Array.isArray(releve) ? releve
    .filter((l) => Array.isArray(l) && ymLocal(l[3]) === ym)
    .map((l) => ({ ts: l[3], date: jour(l[3]), site: String(l[0] || ''), num: String(l[8] || ''), titre: String(l[7] || ''), vendu: Number(l[4]) || 0,
      recuLe: l[9] ? jour(l[9]) : '', frais: l[6] == null ? null : Number(l[6]), achat: l[5] == null ? null : Number(l[5]) }))
    .sort((a, b) => a.ts - b.ts) : null;
  const n = ventes ? ventes.length : null;
  const vendu = ventes ? Math.round(ventes.reduce((t, v) => t + v.vendu * 100, 0)) / 100 : null;
  const nCoutReleve = ventes ? ventes.filter((v) => v.achat != null).length : null;
  // La couverture est celle du BÉNÉFICE (la règle) ; le relevé doit dire la même chose.
  const couverture = B && Number.isFinite(B.n) ? { nCout: B.nCout, n: B.n } : (ventes ? { nCout: nCoutReleve, n } : null);
  const accord = !!(B && ventes && B.n === n && B.nCout === nCoutReleve && Math.abs(Math.round((B.ca || 0) * 100) - Math.round(vendu * 100)) <= 0);
  return {
    ym, mois: libelleMois(ym), etabliLe: jour(maintenant),
    entreprise: entreprise && String(entreprise.nom || '').trim() ? { nom: String(entreprise.nom).trim(), siret: String(entreprise.siret || '').trim(), adresse: [String(entreprise.adresse || '').trim(), `${String(entreprise.codePostal || '').trim()} ${String(entreprise.ville || '').trim()}`.trim()].filter(Boolean), logo: typeof entreprise.logo === 'string' ? entreprise.logo : '' } : null,
    ventes, n, vendu,
    frais: ventes ? Math.round(ventes.reduce((t, v) => t + (v.frais || 0) * 100, 0)) / 100 : null,
    benefice: benefice ? benefice.valeur : null, raisonBenefice: benefice ? benefice.raison || '' : 'publication',
    caDeclare: caDeclare ? Number(caDeclare.ca) : null, nDeclare: caDeclare ? caDeclare.n : null,
    urssaf: urssaf == null ? null : Number(urssaf), taux,
    depenses: charges ? { lignes: charges.lignes || [], total: Number(charges.total) || 0 } : null,
    couverture, releveAccord: accord,
  };
}

// Le résumé, ligne par ligne : la même liste pour le PDF et le tableur.
export function resumeRecap(d) {
  const L = [];
  L.push(['Ventes du mois', d.n == null ? '—' : String(d.n), 'n']);
  L.push(['Vendu', d.vendu == null ? '—' : eurosTexte(d.vendu), 'vendu']);
  if (d.frais) L.push(['Frais de vente', eurosTexte(-d.frais), 'frais']);
  L.push(['Dépenses', d.depenses ? eurosTexte(-d.depenses.total) : '—', 'depenses']);
  L.push(['Bénéfice', d.benefice == null ? '—' : eurosTexte(d.benefice), 'benefice']);
  if (d.couverture) L.push(["Prix d'achat connus", `${d.couverture.nCout}/${d.couverture.n}`, 'couverture']);
  L.push(['CA déclaré (argent reçu ce mois)', d.caDeclare == null ? '—' : eurosTexte(d.caDeclare), 'ca']);
  if (d.taux != null) L.push([`URSSAF à payer (${String(d.taux).replace('.', ',')}\u00a0%)`, d.urssaf == null ? '—' : eurosTexte(d.urssaf), 'urssaf']);
  return L;
}
const RAISONS = { achats: "il manque des prix d'achat", frais: 'des frais ne sont pas connus', rien: 'aucune vente ni dépense', publication: 'ventes pas encore lues', encours: 'ventes pas encore lues', cotisations: 'CA déclaré pas encore lu' };
export const raisonTexte = (r) => RAISONS[r] || '';

export function csvRecapMois(d) {
  const e = (v) => { const s = String(v == null ? '' : v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const L = [];
  L.push([`Récap de ${d.mois}`]);
  if (d.entreprise) { L.push([d.entreprise.nom]); if (d.entreprise.siret) L.push([`SIRET ${d.entreprise.siret}`]); }
  L.push([`Établi le ${d.etabliLe}`]);
  L.push([]);
  for (const [k, v] of resumeRecap(d)) L.push([k, v.replace(/[  ]/g, ' ')]);
  if (d.benefice == null && raisonTexte(d.raisonBenefice)) L.push(['', `Bénéfice : ${raisonTexte(d.raisonBenefice)}`]);
  L.push([]);
  L.push(['VENTES']);
  L.push(['Date', 'Site', 'N°', 'Titre', 'Vendu', 'Reçu le', 'Frais', "Prix d'achat"]);
  for (const v of (d.ventes || [])) L.push([v.date, v.site, v.num, v.titre, tableur(v.vendu), v.recuLe, tableur(v.frais), tableur(v.achat)]);
  if (d.ventes) L.push(['', '', '', 'Total', tableur(d.vendu), '', tableur(d.frais), '']);
  else L.push(['Ventes pas encore lues sur cet appareil']);
  L.push([]);
  L.push(['DÉPENSES']);
  L.push(['Date', 'Libellé', 'Montant']);
  for (const x of ((d.depenses && d.depenses.lignes) || [])) L.push([x.date ? jour(x.date) : '', x.libelle, tableur(x.montant)]);
  L.push(['', 'Total', d.depenses ? tableur(d.depenses.total) : '']);
  return '﻿' + L.map((r) => r.map(e).join(';')).join('\r\n');
}

const A4 = [595.28, 841.89];
export async function pdfRecapMois(d, { PDFLib } = {}) {
  const PL = PDFLib || await import('pdf-lib');
  const { PDFDocument, StandardFonts, rgb } = PL;
  const doc = await PDFDocument.create();
  doc.setTitle(`Récap de ${d.mois}`);
  if (d.entreprise) doc.setAuthor(d.entreprise.nom);
  const f = await doc.embedFont(StandardFonts.Helvetica), fb = await doc.embedFont(StandardFonts.HelveticaBold);
  const ENCRE = rgb(0.11, 0.11, 0.12), GRIS = rgb(0.42, 0.42, 0.45), FILET = rgb(0.86, 0.86, 0.88);
  const M = 44, [W, H] = A4;
  const dessinable = (ch) => { try { f.encodeText(ch); return true; } catch (_) { return false; } };
  const propre = (s) => { let o = ''; for (const ch of String(s == null ? '' : s).replace(/[‘’]/g, "'").replace(/[   ]/g, ' ').replace(/−/g, '-').replace(/[\r\n\t]+/g, ' ')) o += dessinable(ch) ? ch : (dessinable(ch.normalize('NFD')[0]) ? ch.normalize('NFD')[0] : ''); return o; };
  const borne = (s, font, t, max) => { let x = propre(s); if (font.widthOfTextAtSize(x, t) <= max) return x; while (x.length > 1 && font.widthOfTextAtSize(x + '…'.replace('…', '...'), t) > max) x = x.slice(0, -1); return x + '...'; };
  let page = doc.addPage(A4); let y = H - M;
  const txt = (s, x, yy, { font = f, t = 9, c = ENCRE, droite = false, max = null } = {}) => {
    const v = max ? borne(s, font, t, max) : propre(s);
    page.drawText(v, { x: droite ? x - font.widthOfTextAtSize(v, t) : x, y: yy, size: t, font, color: c });
  };
  const place = (h) => { if (y - h < M + 20) { page = doc.addPage(A4); y = H - M; } };
  // En-tête : le logo et l'entreprise de sa fiche de facturation, si remplie.
  let xTitre = M;
  if (d.entreprise && d.entreprise.logo) {
    try {
      const b64 = d.entreprise.logo.split(',')[1] || '';
      const octets = typeof Buffer !== 'undefined' ? Buffer.from(b64, 'base64') : Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
      const img = /^data:image\/png/.test(d.entreprise.logo) ? await doc.embedPng(octets) : await doc.embedJpg(octets);
      const k = Math.min(44 / img.height, 120 / img.width);
      page.drawImage(img, { x: M, y: y - img.height * k + 6, width: img.width * k, height: img.height * k });
      xTitre = M + img.width * k + 12;
    } catch (_) { /* logo illisible : le récap part sans */ }
  }
  if (d.entreprise) {
    txt(d.entreprise.nom, xTitre, y - 4, { font: fb, t: 11 });
    const sous = [d.entreprise.siret ? `SIRET ${d.entreprise.siret}` : '', ...d.entreprise.adresse].filter(Boolean).join(' · ');
    if (sous) txt(sous, xTitre, y - 18, { t: 8.5, c: GRIS, max: W - M - xTitre });
  }
  y -= 64;
  txt(`Récap de ${d.mois}`, M, y, { font: fb, t: 20 }); y -= 16;
  txt(`Établi le ${d.etabliLe}`, M, y, { t: 9, c: GRIS }); y -= 26;
  // Le résumé : libellé à gauche, montant à droite, un filet.
  for (const [k, v, cle] of resumeRecap(d)) {
    const fort = cle === 'benefice';
    txt(k, M, y, { t: fort ? 11 : 10, font: fort ? fb : f });
    txt(v, W - M, y, { t: fort ? 11 : 10, font: fort ? fb : f, droite: true });
    y -= 7; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: FILET }); y -= 13;
  }
  if (d.benefice == null && raisonTexte(d.raisonBenefice)) { txt(`Bénéfice : ${raisonTexte(d.raisonBenefice)}.`, M, y, { t: 8.5, c: GRIS }); y -= 14; }
  y -= 10;
  // Les ventes.
  const cols = [[M, 'Date'], [M + 52, 'Site'], [M + 108, 'N°'], [M + 146, 'Titre'], [W - M - 150, 'Vendu', 1], [W - M - 85, 'Reçu le', 1], [W - M, 'Frais', 1]];
  const entete = (titre) => {
    place(40); txt(titre, M, y, { font: fb, t: 12 }); y -= 16;
    for (const [x, h, dr] of cols) txt(h, x, y, { font: fb, t: 8, c: GRIS, droite: !!dr });
    y -= 5; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: FILET }); y -= 11;
  };
  entete(`Ventes (${d.n == null ? '—' : d.n})`);
  if (!d.ventes) { txt('Ventes pas encore lues sur cet appareil.', M, y, { c: GRIS }); y -= 14; }
  for (const v of (d.ventes || [])) {
    place(14);
    txt(v.date, M, y, { t: 8 }); txt(v.site, M + 52, y, { t: 8, max: 54 }); txt(v.num, M + 108, y, { t: 8, max: 36 });
    txt(v.titre, M + 146, y, { t: 8, max: W - M - 150 - 40 - (M + 146) });
    txt(eurosTexte(v.vendu), W - M - 150, y, { t: 8, droite: true }); txt(v.recuLe || '—', W - M - 85, y, { t: 8, droite: true });
    txt(v.frais ? eurosTexte(v.frais) : '', W - M, y, { t: 8, droite: true }); y -= 12;
  }
  if (d.ventes) { place(14); txt('Total', M + 146, y, { font: fb, t: 8 }); txt(eurosTexte(d.vendu), W - M - 150, y, { font: fb, t: 8, droite: true }); y -= 22; }
  // Les dépenses.
  place(40); txt(`Dépenses (${d.depenses ? d.depenses.lignes.length : '—'})`, M, y, { font: fb, t: 12 }); y -= 16;
  for (const x of ((d.depenses && d.depenses.lignes) || [])) { place(14); txt(x.date ? jour(x.date) : '', M, y, { t: 8 }); txt(x.libelle, M + 60, y, { t: 8, max: W - M - 120 - (M + 60) }); txt(eurosTexte(x.montant), W - M, y, { t: 8, droite: true }); y -= 12; }
  if (d.depenses) { place(14); txt('Total', M + 60, y, { font: fb, t: 8 }); txt(eurosTexte(d.depenses.total), W - M, y, { font: fb, t: 8, droite: true }); y -= 12; }
  return doc.save();
}
