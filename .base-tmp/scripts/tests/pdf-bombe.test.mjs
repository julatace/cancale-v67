// (11 nov., revue de sécurité) Une pièce jointe PDF de quelques centaines de Ko
// peut se décompresser en centaines de Mo : `texteDuPdf` (e-mails entrants, cron
// des anciens bordereaux) ne doit jamais décompresser au-delà de sa borne.
//   node --expose-gc --test scripts/tests/pdf-bombe.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { PDFDocument, PDFName } from 'pdf-lib';

test('texteDuPdf : un flux de 400 Mo décompressés ne remplit pas la mémoire', async () => {
  const { texteDuPdf, PDF_MAX_OCTETS } = await import('../../api/_lib/texte-pdf.js');
  const doc = await PDFDocument.create();
  const page = doc.addPage([200, 200]);
  const brut = zlib.deflateSync(Buffer.alloc(400 * 1024 * 1024, 0x20), { level: 9 });
  const s = doc.context.stream(brut, { Filter: 'FlateDecode', Length: brut.length });
  page.node.set(PDFName.of('Contents'), doc.context.register(s));
  const octets = await doc.save({ useObjectStreams: false });
  assert.ok(octets.length < PDF_MAX_OCTETS, `PDF de test trop gros (${octets.length})`);
  if (global.gc) global.gc();
  const avant = process.memoryUsage().arrayBuffers;
  const t0 = Date.now();
  const r = await texteDuPdf(new Uint8Array(octets));
  const pris = process.memoryUsage().arrayBuffers - avant;
  assert.ok(pris < 64 * 1024 * 1024, `mémoire prise : ${Math.round(pris / 1048576)} Mo`);
  assert.ok(Date.now() - t0 < 3000, `trop long : ${Date.now() - t0} ms`);
  assert.ok(r === '' || r === null || typeof r === 'string');
});
