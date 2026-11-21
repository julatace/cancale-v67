// Un bordereau d'envoi INVENTÉ (PDF, A4 avec l'étiquette en haut à gauche comme
// ceux que reçoit un vendeur) : aucune vraie adresse, aucun logo — du texte, un
// code-barres dessiné au hasard fixe. Fabriqué une fois, de façon synchrone
// (pdf-lib est asynchrone : on fige le résultat dans un fichier du scratchpad).
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const { execFileSync } = require('child_process');
const RACINE = path.join(__dirname, '..', '..');
const CACHE = path.join(process.env.FILMS_SORTIE || os.tmpdir(), '.bordereau-film.b64');

const SCRIPT = `
const { PDFDocument, StandardFonts, rgb } = require(${JSON.stringify(path.join(RACINE, 'node_modules', 'pdf-lib'))});
(async () => {
  const doc = await PDFDocument.create();
  const p = doc.addPage([595, 842]);
  const f = await doc.embedFont(StandardFonts.Helvetica), fb = await doc.embedFont(StandardFonts.HelveticaBold);
  const x0 = 28, y0 = 842 - 28, W = 270, Hh = 400;
  p.drawRectangle({ x: x0, y: y0 - Hh, width: W, height: Hh, borderColor: rgb(0, 0, 0), borderWidth: 1.2 });
  p.drawText('BORDEREAU D\\'ENVOI', { x: x0 + 14, y: y0 - 30, size: 15, font: fb });
  p.drawText('Livraison en point relais', { x: x0 + 14, y: y0 - 48, size: 9, font: f });
  p.drawLine({ start: { x: x0, y: y0 - 60 }, end: { x: x0 + W, y: y0 - 60 }, thickness: 1 });
  p.drawText('DESTINATAIRE', { x: x0 + 14, y: y0 - 78, size: 8, font: fb });
  p.drawText('L. R.', { x: x0 + 14, y: y0 - 94, size: 12, font: fb });
  p.drawText('Point relais 042817', { x: x0 + 14, y: y0 - 110, size: 10, font: f });
  p.drawText('69000 LYON', { x: x0 + 14, y: y0 - 124, size: 10, font: f });
  p.drawText('POIDS 1,2 kg  -  COLIS 1/1', { x: x0 + 14, y: y0 - 146, size: 9, font: f });
  let x = x0 + 22, s = 7;
  for (let i = 0; i < 64; i++) { s = (s * 9301 + 49297) % 233280; const w = 1 + (s % 3); if (i % 2 === 0) p.drawRectangle({ x, y: y0 - 270, width: w, height: 96, color: rgb(0, 0, 0) }); x += w + 0.8; }
  p.drawText('61 84 0567', { x: x0 + 80, y: y0 - 288, size: 13, font: fb });
  p.drawLine({ start: { x: x0, y: y0 - 304 }, end: { x: x0 + W, y: y0 - 304 }, thickness: 1 });
  p.drawText('EXPEDITEUR', { x: x0 + 14, y: y0 - 322, size: 8, font: fb });
  p.drawText('Vendeur (adresse masquee)', { x: x0 + 14, y: y0 - 338, size: 10, font: f });
  p.drawText('A deposer avant le 8 nov.', { x: x0 + 14, y: y0 - 376, size: 10, font: fb });
  process.stdout.write(Buffer.from(await doc.save()).toString('base64'));
})();`;

function bordereauB64() {
  try { if (fs.existsSync(CACHE)) return fs.readFileSync(CACHE, 'utf8'); } catch (_) {}
  const b64 = execFileSync(process.execPath, ['-e', SCRIPT], { encoding: 'utf8', maxBuffer: 8e6 });
  try { fs.mkdirSync(path.dirname(CACHE), { recursive: true }); fs.writeFileSync(CACHE, b64); } catch (_) {}
  return b64;
}
module.exports = { bordereauB64 };
