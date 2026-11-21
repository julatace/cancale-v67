// Le calcul de la qualité d'une photo (src/qualitePhoto.js), hors du fil de l'écran :
// le doigt ne sent rien pendant qu'une photo de 12 Mpx est mesurée (14 nov., 102).
import { qualiteDePixels } from './qualitePhoto.js';

self.onmessage = (e) => {
  const d = e && e.data ? e.data : {};
  let r = null;
  try { r = qualiteDePixels(new Uint8ClampedArray(d.buf), d.w, d.h); } catch (_) { r = null; }
  self.postMessage({ id: d.id, r });
};
