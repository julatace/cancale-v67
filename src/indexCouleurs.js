// ── CHERCHER PAR COULEUR : LES COULEURS GARDÉES SUR L'APPAREIL (14 nov., 104) ──
// La couleur dominante de chacune de SES photos (src/couleurPhoto.js), calculée à la
// demande et gardée dans CE navigateur (IndexedDB `vrm_couleurs_photos`). La clé est
// l'IDENTITÉ DE LA PHOTO — son adresse exacte (photo d'annonce) ou `studio:<N°>:<id>`
// (photo du studio) —, jamais un titre (§5) : deux annonces au même titre ont deux
// photos, donc deux lignes.
// Les octets d'une photo Vinted ne sont pas lisibles par la page (le CDN de Vinted
// n'envoie aucun en-tête CORS) : on passe par le chemin que la recherche par photo
// utilise déjà (`lireOctets` injecté : l'extension, sinon la route de VRM). Une photo
// qu'on n'a pas pu lire est COMPTÉE et dite, jamais rangée « sans couleur ».
import { couleursDePixels, V_COULEUR } from './couleurPhoto.js';
import { pixelsDe } from './indexPhotos.js';

const BASE = 'vrm_couleurs_photos', MAGASIN = 'couleurs', MAX_GARDEES = 6000;
const memoire = new Map();
let _db = null;
const ouvrir = () => {
  if (_db) return _db;
  _db = new Promise((ok) => {
    try {
      if (typeof indexedDB === 'undefined') return ok(null);
      const r = indexedDB.open(BASE, 1);
      r.onupgradeneeded = () => { try { r.result.createObjectStore(MAGASIN); } catch (_) {} };
      r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); r.onblocked = () => ok(null);
    } catch (_) { ok(null); }
  });
  return _db;
};
export const lireCouleursGardees = async () => {
  const m = new Map(memoire);
  const db = await ouvrir(); if (!db) return m;
  await new Promise((ok) => {
    try {
      const r = db.transaction(MAGASIN, 'readonly').objectStore(MAGASIN).openCursor();
      r.onsuccess = () => { const c = r.result; if (!c) return ok(); const v = c.value; if (v && v.v === V_COULEUR && Array.isArray(v.c)) m.set(String(c.key), v); c.continue(); };
      r.onerror = () => ok();
    } catch (_) { ok(); }
  });
  return m;
};
const garder = async (cle, c) => {
  const v = { c, v: V_COULEUR, at: Date.now() };
  memoire.set(cle, v);
  const db = await ouvrir(); if (!db) return;
  await new Promise((ok) => { try { const t = db.transaction(MAGASIN, 'readwrite'); t.objectStore(MAGASIN).put(v, cle); t.oncomplete = () => ok(); t.onerror = () => ok(); t.onabort = () => ok(); } catch (_) { ok(); } });
};
const borner = async (m) => {
  if (m.size <= MAX_GARDEES) return;
  const vieilles = [...m.entries()].sort((a, b) => (a[1].at || 0) - (b[1].at || 0)).slice(0, m.size - MAX_GARDEES).map(([k]) => k);
  for (const k of vieilles) { memoire.delete(k); m.delete(k); }
  const db = await ouvrir(); if (!db) return;
  await new Promise((ok) => { try { const t = db.transaction(MAGASIN, 'readwrite'); const s = t.objectStore(MAGASIN); for (const k of vieilles) s.delete(k); t.oncomplete = () => ok(); t.onerror = () => ok(); } catch (_) { ok(); } });
};
export const couleursDeSource = async (src) => { const p = await pixelsDe(src); return p ? couleursDePixels(p.px, p.w, p.h) : null; };

// `entrees` = [{ cle, src }] (src : adresse de la photo, ou data: URL d'une photo du studio).
// Lit ce qui n'est pas encore gardé, au plus `parallele` à la fois. Rend
// { couleurs: Map cle → [{c, part}], illisibles: [cle], total }.
export async function mettreAJourCouleurs(entrees, { lireOctets, surProgres, parallele = 3, arrete, seulementGardees = false } = {}) {
  const vues = new Map();
  for (const e of Array.isArray(entrees) ? entrees : []) if (e && e.cle && e.src && !vues.has(String(e.cle))) vues.set(String(e.cle), e.src);
  const gardees = await lireCouleursGardees();
  const aFaire = seulementGardees ? [] : [...vues.keys()].filter((k) => !gardees.has(k));
  const illisibles = [];
  let faits = 0; const total = aFaire.length;
  if (surProgres) surProgres({ faits, total });
  const file = aFaire.slice();
  const ouvrier = async () => {
    while (file.length) {
      if (arrete && arrete()) return;
      const k = file.shift(), u = vues.get(k);
      let c = null;
      try {
        const direct = /^(data:image\/|blob:)/i.test(u);
        const src = direct ? u : (lireOctets ? await lireOctets(u) : null);
        c = src ? await couleursDeSource(src) : null;
      } catch (_) { c = null; }
      if (Array.isArray(c)) { gardees.set(k, { c, v: V_COULEUR, at: Date.now() }); await garder(k, c); } else illisibles.push(k);
      faits++; if (surProgres) surProgres({ faits, total });
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(parallele, file.length || 1)) }, ouvrier));
  await borner(gardees);
  const couleurs = new Map();
  for (const k of vues.keys()) { const g = gardees.get(k); if (g) couleurs.set(k, g.c); }
  return { couleurs, illisibles, total: vues.size, aLire: seulementGardees ? [...vues.keys()].filter((k) => !gardees.has(k)).length : 0 };
}
