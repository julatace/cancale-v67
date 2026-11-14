// ── LA QUALITÉ D'UNE PHOTO, CÔTÉ ÉCRAN (14 nov., proposition 102) ────────────────
// `analyserPhoto(src)` : une photo à LUI (data: URL, blob:, fichier) → le verdict de
// src/qualitePhoto.js, calculé dans un WORKER (src/qualitePhoto.worker.js) ; sans
// worker (vieux navigateur, banc), le même calcul sur la page, au repos.
//   · l'image est décodée et réduite à 512 px ici (le canvas vit sur la page) ; seuls
//     ses pixels partent au worker ;
//   · rien ne sort de l'appareil ; une image illisible (photo d'un autre site sans
//     autorisation de lecture) rend `null` — « pas su », rien n'est dit ;
//   · un verdict se garde par source (au plus 200) : redessiner l'écran ne recalcule rien.
import { COTE_QUALITE, qualiteDePixels } from './qualitePhoto.js';

const CACHE = new Map();
const MAX_CACHE = 200;
let _worker, _id = 0;
const attentes = new Map();

const worker = () => {
  if (_worker !== undefined) return _worker;
  _worker = null;
  try {
    if (typeof Worker === 'function') {
      _worker = new Worker(new URL('./qualitePhoto.worker.js', import.meta.url), { type: 'module' });
      _worker.onmessage = (e) => { const d = e.data || {}; const f = attentes.get(d.id); if (f) { attentes.delete(d.id); f(d.r || null); } };
      _worker.onerror = () => { for (const f of attentes.values()) f(undefined); attentes.clear(); try { _worker.terminate(); } catch (_) {} _worker = null; };
    }
  } catch (_) { _worker = null; }
  return _worker;
};

const pixels = (src) => new Promise((ok) => {
  try {
    const im = new Image(); im.decoding = 'async';
    im.onload = () => {
      try {
        const w0 = im.naturalWidth, h0 = im.naturalHeight; if (!(w0 > 2 && h0 > 2)) return ok(null);
        const k = Math.min(1, COTE_QUALITE / Math.max(w0, h0)), w = Math.max(3, Math.round(w0 * k)), h = Math.max(3, Math.round(h0 * k));
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const cx = cv.getContext('2d', { willReadFrequently: true });
        cx.imageSmoothingEnabled = true; try { cx.imageSmoothingQuality = 'high'; } catch (_) {}
        cx.drawImage(im, 0, 0, w, h);
        ok({ px: cx.getImageData(0, 0, w, h).data, w, h });
      } catch (_) { ok(null); }
    };
    im.onerror = () => ok(null);
    im.src = src;
  } catch (_) { ok(null); }
});

const surLaPage = (p) => new Promise((ok) => {
  const go = () => { try { ok(qualiteDePixels(p.px, p.w, p.h)); } catch (_) { ok(null); } };
  if (typeof requestIdleCallback === 'function') requestIdleCallback(go, { timeout: 800 }); else setTimeout(go, 0);
});

export async function analyserPhoto(src) {
  if (!src) return null;
  let url = src, aRendre = false;
  if (typeof src !== 'string') { try { url = URL.createObjectURL(src); aRendre = true; } catch (_) { return null; } }
  const cle = aRendre ? null : (url.length > 160 ? url.slice(0, 64) + ':' + url.length + ':' + url.slice(-64) : url);
  if (cle && CACHE.has(cle)) return CACHE.get(cle);
  try {
    const p = await pixels(url); if (!p) return null;
    let r;
    const w = worker();
    if (w) {
      r = await new Promise((ok) => {
        const id = ++_id; attentes.set(id, ok);
        try { const buf = p.px.buffer.slice(0); w.postMessage({ id, buf, w: p.w, h: p.h }, [buf]); } catch (_) { attentes.delete(id); ok(undefined); }
      });
      if (r === undefined) r = await surLaPage(p);
    } else r = await surLaPage(p);
    if (cle) { CACHE.set(cle, r); if (CACHE.size > MAX_CACHE) CACHE.delete(CACHE.keys().next().value); }
    return r;
  } finally { if (aRendre) try { URL.revokeObjectURL(url); } catch (_) {} }
}
