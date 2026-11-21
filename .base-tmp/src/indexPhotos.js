// ── RECHERCHE PAR PHOTO : L'INDEX GARDÉ SUR L'APPAREIL (6 nov.) ─────────────
//
// Les empreintes (src/empreintePhoto.js) des photos de SES annonces, calculées
// à la demande et gardées dans CE navigateur (IndexedDB). La clé est l'URL
// EXACTE de la photo — jamais un titre (§5) : deux annonces au même titre ont
// deux photos, donc deux empreintes, donc deux lignes.
//
// Rien ne sort de l'appareil pour le calcul. Les OCTETS d'une photo Vinted, eux,
// ne sont pas lisibles par la page : le CDN de Vinted n'envoie aucun en-tête
// CORS (mesuré au `curl` en août, docs/journal-2026.md ; redit par
// src/photosVinted.js) — une image affichée ne peut pas nourrir un canvas
// lisible. On passe donc par le chemin que l'app utilise déjà pour la même
// raison (`chargerPhotoBoite`, App.jsx) : l'EXTENSION d'abord (la photo reste
// sur l'appareil), sinon la route de VRM (`/api/compte?mode=photo`, la session
// d'abord). Ce chemin est INJECTÉ (`lireOctets`) : ce module ne sait rien de
// l'extension ni du serveur, le banc le remplace.
//
// Trois états partout (§5, « pas su » ≠ « rien ») : une photo qu'on n'a pas pu
// lire est COMPTÉE et dite (« 3 photos pas lues »), jamais classée à zéro.

import { empreinteDePixels, V_EMPREINTE } from './empreintePhoto.js';

const BASE = 'vrm_empreintes_photos', MAGASIN = 'empreintes', MAX_GARDEES = 4000;
const memoire = new Map();          // repli quand IndexedDB est refusé (navigation privée, banc)
let _db = null;

const ouvrir = () => {
  if (_db) return _db;
  _db = new Promise((ok) => {
    try {
      if (typeof indexedDB === 'undefined') return ok(null);
      const r = indexedDB.open(BASE, 1);
      r.onupgradeneeded = () => { try { r.result.createObjectStore(MAGASIN); } catch (_) {} };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ok(null);
      r.onblocked = () => ok(null);
    } catch (_) { ok(null); }
  });
  return _db;
};
const tx = async (mode, f) => {
  const db = await ouvrir(); if (!db) return null;
  return new Promise((ok) => {
    try {
      const t = db.transaction(MAGASIN, mode), s = t.objectStore(MAGASIN);
      const r = f(s);
      t.oncomplete = () => ok(r && 'result' in r ? r.result : true);
      t.onerror = () => ok(null); t.onabort = () => ok(null);
    } catch (_) { ok(null); }
  });
};

// Toutes les empreintes gardées : Map url → { e, at }. Une version périmée est ignorée.
export const lireGardees = async () => {
  const m = new Map(memoire);
  const db = await ouvrir();
  if (!db) return m;
  await new Promise((ok) => {
    try {
      const r = db.transaction(MAGASIN, 'readonly').objectStore(MAGASIN).openCursor();
      r.onsuccess = () => { const c = r.result; if (!c) return ok(); const v = c.value; if (v && v.e && v.e.v === V_EMPREINTE) m.set(String(c.key), v); c.continue(); };
      r.onerror = () => ok();
    } catch (_) { ok(); }
  });
  return m;
};
const garder = async (url, e) => {
  const v = { e, at: Date.now() };
  memoire.set(url, v);
  await tx('readwrite', (s) => s.put(v, url));
};
// Borne : au-delà de MAX_GARDEES, les plus anciennes partent (une photo qui
// revient est recalculée, rien d'autre ne se perd).
const borner = async (gardees) => {
  if (gardees.size <= MAX_GARDEES) return;
  const vieilles = [...gardees.entries()].sort((a, b) => (a[1].at || 0) - (b[1].at || 0)).slice(0, gardees.size - MAX_GARDEES);
  for (const [u] of vieilles) { memoire.delete(u); gardees.delete(u); }
  await tx('readwrite', (s) => { for (const [u] of vieilles) s.delete(u); return null; });
};

// Une source d'image (data:, blob:, même origine) → pixels (≤ 256 px de côté).
// `null` si rien n'a pu être lu (jamais une image vide prise pour une photo).
const COTE = 256;
export const pixelsDe = (src) => new Promise((ok) => {
  try {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => {
      try {
        const w0 = im.naturalWidth, h0 = im.naturalHeight; if (!(w0 > 1 && h0 > 1)) return ok(null);
        const k = Math.min(1, COTE / Math.max(w0, h0)), w = Math.max(2, Math.round(w0 * k)), h = Math.max(2, Math.round(h0 * k));
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const cx = cv.getContext('2d', { willReadFrequently: true });
        cx.imageSmoothingEnabled = true; try { cx.imageSmoothingQuality = 'high'; } catch (_) {}
        cx.drawImage(im, 0, 0, w, h);
        ok({ px: cx.getImageData(0, 0, w, h).data, w, h });
      } catch (_) { ok(null); }        // canvas sali (cross-origin) : pas lisible ici
    };
    im.onerror = () => ok(null);
    im.src = src;
  } catch (_) { ok(null); }
});

export const empreinteDeSource = async (src) => {
  const p = await pixelsDe(src);
  return p ? empreinteDePixels(p.px, p.w, p.h) : null;
};
export const empreinteDeFichier = async (file) => {
  if (!file) return null;
  let url = null;
  try { url = URL.createObjectURL(file); return await empreinteDeSource(url); }
  catch (_) { return null; }
  finally { if (url) try { URL.revokeObjectURL(url); } catch (_) {} }
};

// Met l'index à jour pour ces candidats : chaque URL pas encore gardée est lue
// (`lireOctets(url)` → data: URL ou `null`), empreinte calculée, gardée.
// Au plus `parallele` lectures à la fois ; `surProgres({ faits, total })`.
// Rend { empreintes: Map url → empreinte, illisibles: [url], total }.
export const mettreAJourIndex = async (urls, { lireOctets, surProgres, parallele = 3, arrete } = {}) => {
  const uniques = [...new Set((urls || []).filter((u) => typeof u === 'string' && u))];
  const gardees = await lireGardees();
  const aFaire = uniques.filter((u) => !gardees.has(u));
  const illisibles = [];
  let faits = 0;
  const total = aFaire.length;
  if (surProgres) surProgres({ faits, total });
  const file = aFaire.slice();
  const ouvrier = async () => {
    while (file.length) {
      if (arrete && arrete()) return;
      const u = file.shift();
      let e = null;
      try {
        const direct = /^(data:image\/|blob:)/i.test(u);
        const src = direct ? u : (lireOctets ? await lireOctets(u) : null);
        e = src ? await empreinteDeSource(src) : null;
      } catch (_) { e = null; }
      if (e) { gardees.set(u, { e, at: Date.now() }); await garder(u, e); } else illisibles.push(u);
      faits++;
      if (surProgres) surProgres({ faits, total });
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(parallele, file.length || 1)) }, ouvrier));
  await borner(gardees);
  const empreintes = new Map();
  for (const u of uniques) { const g = gardees.get(u); if (g) empreintes.set(u, g.e); }
  return { empreintes, illisibles, total: uniques.length };
};

// Pour le banc et « Effacer l'index » : tout oublier sur cet appareil.
export const oublierIndex = async () => { memoire.clear(); await tx('readwrite', (s) => s.clear()); };
