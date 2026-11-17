// ════════════════════════════════════════════════════════════════════════════
//  LE LECTEUR DE CODES, HORS DU FIL DE L'ÉCRAN (17 nov., lot scan-instantane).
//  Julien (iPhone) : « il est un peu long et il faut être vraiment très très proche ».
//  MESURÉ (banc scan-instantane) : ZXing en JavaScript, sur le fil de l'écran, avec
//  TRY_HARDER et tous les formats, bloquait l'écran à chaque image et ne lisait pas un
//  Code 128 tenu à distance. Ici : zxing-cpp compilé en WebAssembly (paquet `zxing-wasm`,
//  licence MIT ; zxing-cpp : Apache-2.0), dans un worker — l'écran ne se fige plus.
//  Le fichier .wasm est servi par VRM (même origine, CSP `script-src 'wasm-unsafe-eval'`),
//  chargé à l'ouverture du scanner seulement. Aucune image ne sort de l'appareil.
//
//  Messages : { id, w, h, bitmap (ImageBitmap de la zone visée) | buf (pixels RGBA) } ⇒ { id, vals: [texte…], ms }.
//  Aucune règle d'identité ici : le texte lu est rendu tel quel (src/scanColis.js décide).
// ════════════════════════════════════════════════════════════════════════════
import { readBarcodes, prepareZXingModule } from 'zxing-wasm/reader';
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';

// Les formats IMPRIMÉS sur les étiquettes (Code 128 : Mondial Relay, Chronopost, Colissimo, Vinted Go ;
// DataMatrix : Chronopost, DPD ; QR : Vinted Go, Relais Colis), plus EAN-13 (la boîte : « pas un n° de
// suivi », dit) et les 1D bon marché déjà lus avant (Code 39, ITF). Chaque format 2D en plus coûte cher.
const FORMATS = ['Code128', 'DataMatrix', 'QRCode', 'EAN13', 'Code39', 'ITF'];
const OPTIONS = { formats: FORMATS, tryHarder: true, tryRotate: true, tryInvert: false, tryDownscale: true, maxNumberOfSymbols: 1, textMode: 'Plain' };

const pret = (async () => {
  prepareZXingModule({ overrides: { locateFile: (p, prefix) => (p.endsWith('.wasm') ? new URL(wasmUrl, self.location.href).href : prefix + p) }, fireImmediately: true });
  // Une première lecture « à vide » instancie le module (le .wasm est compilé ICI, pas sur la première image utile).
  await readBarcodes({ width: 8, height: 8, data: new Uint8ClampedArray(256) }, OPTIONS);
})();

// La découpe se fait ICI quand le navigateur sait dessiner dans un worker (OffscreenCanvas) : le fil de l'écran
// ne fait que `createImageBitmap` (sans copie de pixels). Sinon, il envoie les pixels déjà découpés.
let toile = null, ctx = null;
const offscreen = (() => { try { const c = new OffscreenCanvas(4, 4); return !!c.getContext('2d', { willReadFrequently: true }); } catch (_) { return false; } })();
const pixelsDe = (bm, w, h) => {
  if (!toile) { toile = new OffscreenCanvas(w, h); ctx = toile.getContext('2d', { willReadFrequently: true }); }
  if (toile.width !== w || toile.height !== h) { toile.width = w; toile.height = h; }
  ctx.imageSmoothingEnabled = true; ctx.drawImage(bm, 0, 0, w, h);
  try { bm.close(); } catch (_) {}
  return ctx.getImageData(0, 0, w, h);
};

self.onmessage = async (ev) => {
  const d = ev.data || {};
  if (d.type === 'prechauffer') { try { await pret; self.postMessage({ type: 'pret', offscreen }); } catch (e) { self.postMessage({ type: 'echec', raison: String((e && e.message) || e) }); } return; }
  const t0 = performance.now();
  let vals = [];
  try {
    await pret;
    const img = d.bitmap ? pixelsDe(d.bitmap, d.w, d.h) : { width: d.w, height: d.h, data: new Uint8ClampedArray(d.buf) };
    const r = await readBarcodes(img, OPTIONS);
    vals = (r || []).filter((x) => x && x.isValid && x.text).map((x) => x.text);
  } catch (_) { vals = []; }
  // Le tampon revient (transféré) : le fil de l'écran le réutilise, aucune allocation par image.
  if (d.buf) self.postMessage({ id: d.id, vals, ms: performance.now() - t0, buf: d.buf }, [d.buf]);
  else self.postMessage({ id: d.id, vals, ms: performance.now() - t0 });
};
