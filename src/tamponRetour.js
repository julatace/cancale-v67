// Le tampon « RETOUR · N°… » posé sur le bordereau de retour d'un achat (11 nov., lot
// retours-litiges) : un cartouche blanc cerné de noir en haut à gauche de la première
// page, le N° de la paire s'il en a un (par l'achat, jamais deviné), le titre dessous.
// pdf-lib chargé à la demande. Rend { octets, lignes } ; un PDF illisible LÈVE (l'appelant
// dit « pas imprimé », jamais un bordereau vide).
import { lignesTamponRetour } from './retoursAchat.js';

// Helvetica (WinAnsi) : les caractères hors de la table deviennent « ? » plutôt que de lever.
const winAnsi = (s) => String(s || '').normalize('NFC').replace(/[’‘]/g, "'").replace(/[“”«»]/g, '"').replace(/[–—]/g, '-').replace(/[^\x20-\x7E -ÿ]/g, '?');

export async function tamponnerRetour(octets, { num, titre } = {}) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdf = await PDFDocument.load(octets);
  const page = pdf.getPages()[0];
  if (!page) throw new Error('pdf-vide');
  const gras = await pdf.embedFont(StandardFonts.HelveticaBold);
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const { width, height } = page.getSize();
  const lignes = lignesTamponRetour({ num, titre });
  const w = Math.min(width * 0.62, 240), h = lignes.bas ? 46 : 32;
  const x = Math.max(4, width * 0.05), y = Math.max(4, height - height * 0.02 - h);
  page.drawRectangle({ x, y, width: w, height: h, color: rgb(1, 1, 1), borderColor: rgb(0, 0, 0), borderWidth: 1.5 });
  let haut = winAnsi(lignes.haut), taille = 18;
  while (taille > 10 && gras.widthOfTextAtSize(haut, taille) > w - 14) taille -= 1;
  page.drawText(haut, { x: x + 7, y: y + h - taille - 6, size: taille, font: gras, color: rgb(0, 0, 0) });
  if (lignes.bas) {
    let bas = winAnsi(lignes.bas), coupe = false;
    while (bas.length > 8 && normal.widthOfTextAtSize(bas + (coupe ? '...' : ''), 9) > w - 14) { bas = bas.slice(0, -1); coupe = true; }
    if (coupe) bas = bas.trimEnd() + '...';
    page.drawText(bas, { x: x + 7, y: y + 6, size: 9, font: normal, color: rgb(0.12, 0.12, 0.12) });
  }
  return { octets: await pdf.save(), lignes };
}
