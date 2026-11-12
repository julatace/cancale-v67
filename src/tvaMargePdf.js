// ════════════════════════════════════════════════════════════════════════════
//  LA DÉCLARATION DE TVA SUR MARGE EN PDF (11 nov. 2026, lot tva-marge)
// ════════════════════════════════════════════════════════════════════════════
// Dessine `declarationMarge` (./tvaMarge.js) — LES MÊMES chiffres que la carte et
// que le CSV, jamais recalculés — en un PDF A4 (pdf-lib, police standard).
// Un document pour le comptable : en français, comme le CSV.
import { eurosC, jourParisTs, RAISON_EXCLUE, TAUX_MARGE, DATE_PAR_PLATEFORME, SOURCES_TVA_MARGE, A_VERIFIER } from './tvaMarge.js';

const A4 = [595.28, 841.89];
const M = 40;

export async function pdfDeclarationMarge(d, { vendeur = '', PDFLib } = {}) {
  const PL = PDFLib || await import('pdf-lib');
  const { PDFDocument, StandardFonts, rgb } = PL;
  const doc = await PDFDocument.create();
  doc.setTitle(`TVA sur marge — ${d.libelle}`);
  const f = await doc.embedFont(StandardFonts.Helvetica);
  const fb = await doc.embedFont(StandardFonts.HelveticaBold);
  const encre = rgb(0.11, 0.11, 0.12), gris = rgb(0.42, 0.42, 0.45), filet = rgb(0.86, 0.86, 0.88);
  const propre = (s) => {
    let out = '';
    for (const ch of String(s == null ? '' : s).replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"').replace(/[   ]/g, ' ').replace(/[−–—]/g, '-').replace(/[\r\n\t]+/g, ' ')) {
      let ok = true; try { f.encodeText(ch); } catch (_) { ok = false; }
      out += ok ? ch : '?';
    }
    return out;
  };
  const coupe = (s, font, t, max) => { let x = propre(s); if (font.widthOfTextAtSize(x, t) <= max) return x; while (x.length > 1 && font.widthOfTextAtSize(x + '...', t) > max) x = x.slice(0, -1); return x + '...'; };
  const [W, H] = A4;
  let page = doc.addPage(A4); let y = H - M;
  const texte = (s, x, t = 9, font = f, couleur = encre) => page.drawText(propre(s), { x, y, size: t, font, color: couleur });
  const suite = (h) => { y -= h; if (y < M + 40) { page = doc.addPage(A4); y = H - M; } };
  const lignePara = (s, t = 8, couleur = gris) => {
    const mots = propre(s).split(' '); let l = '';
    for (const m of mots) { const e = l ? `${l} ${m}` : m; if (f.widthOfTextAtSize(e, t) > W - 2 * M) { texte(l, M, t, f, couleur); suite(t + 3); l = m; } else l = e; }
    if (l) { texte(l, M, t, f, couleur); suite(t + 3); }
  };
  texte(`TVA sur marge - biens d'occasion - ${d.libelle}`, M, 15, fb); suite(18);
  if (vendeur) { texte(vendeur, M, 10, f, gris); suite(14); }
  const am = d.complet ? '' : 'au moins ';
  texte(`Base hors taxe des marges : ${am}${eurosC(d.baseC)}`, M, 11, fb); suite(14);
  texte(`TVA due : ${am}${eurosC(d.tvaC)}`, M, 11, fb); suite(14);
  texte(`${d.nComptees} vente(s) comptée(s)${d.aCompleter.length ? ` · ${d.aCompleter.length} exclue(s) à compléter` : ''}${d.nPertes ? ` · ${d.nPertes} à perte (${eurosC(d.perteC)} non imputés)` : ''}`, M, 9, f, gris); suite(18);
  const cols = [[M, 'Date', 52], [M + 54, 'Plateforme', 56], [M + 112, 'N°', 34], [M + 148, 'Article', 142], [M + 292, 'Vente', 52], [M + 346, 'Achat', 52], [M + 400, 'Marge', 52], [M + 454, 'TVA', 61]];
  const droite = new Set([4, 5, 6, 7]);
  const rang = (vals, font) => {
    vals.forEach((v, i) => { const [x, , w] = cols[i]; const s = coupe(v, font, 8, w - 2); const dx = droite.has(i) ? w - 2 - font.widthOfTextAtSize(s, 8) : 0; page.drawText(s, { x: x + dx, y, size: 8, font, color: encre }); });
  };
  rang(cols.map((c) => c[1]), fb); suite(4); page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: filet }); suite(11);
  const toutes = [...d.comptees, ...d.aCompleter].sort((a, b) => (a.ts || 0) - (b.ts || 0));
  for (const v of toutes) {
    rang([jourParisTs(v.ts), v.plateforme, v.num, v.titre, eurosC(v.prixC), eurosC(v.achatC), eurosC(v.margeC), eurosC(v.tvaC)], f);
    suite(10);
    if (v.etat !== 'ok') { page.drawText(propre(v.etat === 'perte' ? 'perte : TVA 0, non imputée' : `exclue : ${RAISON_EXCLUE[v.etat] || v.etat}`), { x: M + 148, y, size: 7, font: f, color: gris }); suite(10); }
  }
  suite(8);
  lignePara(`Taux ${TAUX_MARGE} % · TVA = marge × ${TAUX_MARGE}/${100 + TAUX_MARGE}, arrondie au centime vente par vente ; une vente à perte compte 0 et ne se déduit pas des autres.`);
  lignePara(`Date retenue : ${Object.entries(DATE_PAR_PLATEFORME).map(([p, t]) => `${p} = ${t}`).join(' ; ')}.`);
  lignePara(`Sources : ${SOURCES_TVA_MARGE.map((s) => s.ref).filter((x, i, a) => a.indexOf(x) === i).join(' ; ')}.`);
  lignePara(A_VERIFIER);
  return doc.save();
}
