// api/_lib/stamp.js
// ────────────────────────────────────────────────────────────────────────────
// Tamponnage AUTOMATIQUE des bordereaux côté serveur : dès qu'un bordereau
// arrive par email, on y imprime le N° + le titre, au même emplacement que
// celui mémorisé dans l'app (vinted_bordereau_formats, synchronisé dans le
// cloud). Géométrie identique à annotateAndDownloadBordereau (App.jsx).
// ────────────────────────────────────────────────────────────────────────────

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const formatKey = (w, h) => `${Math.round(w)}x${Math.round(h)}`;

export async function stampBordereau(pdfB64, numero, title, formats) {
  const pdf = await PDFDocument.load(Buffer.from(pdfB64, 'base64'));
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const first = pdf.getPages()[0];
  const { width, height } = first.getSize();
  const key = formatKey(width, height);
  const posKnown = !!(formats && formats[key]);
  // Format jamais vu : même défaut que l'app (haut gauche) — ajustable ensuite.
  const pos = (formats && formats[key]) || { xr: 0.05, yr: 0.02 };
  const hasNum = numero != null && String(numero).trim() !== '';

  const boxW = Math.min(width * 0.62, 230);
  const boxH = 46;
  let x = pos.xr * width;
  const yTop = pos.yr * height;
  x = Math.max(2, Math.min(width - boxW - 2, x));
  let y = height - yTop - boxH; // origine PDF en bas à gauche
  y = Math.max(2, Math.min(height - boxH - 2, y));

  first.drawRectangle({ x, y, width: boxW, height: boxH, color: rgb(1, 1, 1), borderColor: rgb(0, 0, 0), borderWidth: 1.5 });
  const maxChars = Math.max(16, Math.floor((boxW - 16) / 5));
  const t = (title || '').slice(0, maxChars);
  if (hasNum) {
    first.drawText(`N° ${numero}`, { x: x + 8, y: y + boxH - 26, size: 20, font: bold, color: rgb(0, 0, 0) });
    if (t) first.drawText(t, { x: x + 8, y: y + 6, size: 9, font: reg, color: rgb(0.12, 0.12, 0.12) });
  } else if (t) {
    first.drawText(t.slice(0, Math.max(20, Math.floor((boxW - 16) / 6.5))), { x: x + 8, y: y + boxH / 2 - 6, size: 13, font: bold, color: rgb(0, 0, 0) });
  }

  const bytes = await pdf.save();
  return { b64: Buffer.from(bytes).toString('base64'), posKnown, key };
}
