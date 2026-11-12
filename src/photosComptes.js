// ══════════════════════════════════════════════════════════════════════════
// PHOTOS EN DOUBLE ENTRE COMPTES — ce que l'écran publie, ce que les feuilles lisent
// (11 nov., lot photos-comptes). Règle : src/photoEmpreinte.js.
//
// UN propriétaire (§11) : `Comptabilite` (App.jsx) lit les empreintes rangées par
// l'extension (`photo_emprunte_{uid}`), assemble les annonces EN LIGNE de ses comptes
// Vinted (la règle <enligne-regle>, déjà appliquée) et PUBLIE ici ; Annonces → Outils,
// Ma journée et les encarts « avant de publier » (Republier, Publier ailleurs) LISENT.
// Rien ici n'écrit en base, rien ne relie ni ne renumérote (§5).
// ══════════════════════════════════════════════════════════════════════════
import { photosEnDouble, dejaSurAutreCompte, indexEmpreintes, clePhotoEmpreinte, empreinteDepuisPixels, COTE_EMPREINTE, empreinteValide } from './photoEmpreinte.js';

let etat = null;                                       // null = pas encore publié (« pas su »)
const abonnes = new Set();
export function publierPhotosComptes(x) { etat = x || null; for (const f of [...abonnes]) { try { f(); } catch (_) { /* un abonné cassé n'arrête pas les autres */ } } }
export const lirePhotosComptes = () => etat;
export function abonnerPhotosComptes(f) { abonnes.add(f); return () => abonnes.delete(f); }

// Les annonces EN LIGNE de ses comptes Vinted, à la forme de la règle.
// `vinted` : [{ uid, nom, ok, lu, enLigne: [item] }] (la même entrée que `enLigneDeuxFois`) ;
// `verdict(c)` : 'ok' si la lecture du compte conclut (sinon « pas su ») ;
// `numeroDe(id)`, `photosDe(id)` (les photos de la fiche, si connues).
export function annoncesPourPhotos(vinted, { verdict = () => 'ok', numeroDe = () => '', photosDe = () => [] } = {}) {
  const annonces = [], comptesLus = {}, noms = {};
  for (const c of Array.isArray(vinted) ? vinted : []) {
    if (!c || !c.uid) continue;
    const cc = `vinted:${c.uid}`;
    noms[cc] = c.nom || '';
    comptesLus[cc] = verdict(c) === 'ok';
    for (const it of Array.isArray(c.enLigne) ? c.enLigne : []) {
      if (!it || !it.id) continue;
      const photo = typeof it.photo === 'string' ? it.photo : (it.photo && it.photo.url) || '';
      const autres = (photosDe(String(it.id)) || []).map((p) => (typeof p === 'string' ? p : p && p.url)).filter(Boolean);
      annonces.push({ plateforme: 'vinted', compte: String(c.uid), nom: c.nom || '', id: String(it.id), titre: it.title || '', numero: numeroDe(String(it.id)) || '',
        photo, url: it.url || '', photos: [photo, ...autres].filter(Boolean) });
    }
  }
  return { annonces, comptesLus, noms };
}

// Tout ce que les écrans lisent, calculé une fois. `empreintes` null ⇒ lecture ratée :
// toutes les photos sont « pas vérifiées », aucun groupe n'est inventé.
export function calculerPhotosComptes({ annonces, comptesLus, noms, empreintes }) {
  const lu = empreintes !== null && empreintes !== undefined;
  const res = photosEnDouble({ annonces, empreintes: lu ? empreintes : {}, comptesLus });
  return { ...res, lu, annonces, empreintes: lu ? empreintes : {}, noms, index: indexEmpreintes(lu ? empreintes : {}) };
}

// La carte de Ma journée et le titre de la feuille (une source, §7).
export function cibleRepublier(groupe) {
  // On garde la plus ANCIENNE annonce (plus petit identifiant Vinted) ; la plus récente se refait.
  const l = [...(groupe && groupe.annonces || [])].filter((a) => (a.plateforme || 'vinted') === 'vinted');
  l.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
  return l[0] || null;
}

// Avant de publier : les photos choisies (adresses ou empreintes) contre les annonces
// EN LIGNE des AUTRES comptes Vinted. `sources` : des annonces Vinted dont on prend
// toutes les empreintes rangées ([{ compte, id }]) ; `photos` : des adresses (vinted.net
// déjà calculées) ou des empreintes calculées dans la page ({ h }).
export function verifierAvantPublier(x, { sources = [], photos = [], compteCible = null, compteSource = null, exclure = [] } = {}) {
  if (!x) return { annonces: [], nPasVerifiees: (sources.length || 0) + (photos.length || 0), pasSu: true };
  // Une source sans compte connu : son compte est celui de l'annonce EN LIGNE à cet identifiant.
  sources = (sources || []).map((s) => (s && !s.compte ? { ...s, compte: ((x.annonces.find((a) => String(a.id) === String(s.id)) || {}).compte) || '' } : s)).filter((s) => s && s.id);
  if (!compteSource && sources.length === 1 && sources[0].compte) compteSource = `vinted:${sources[0].compte}`;
  const choisies = [];
  for (const s of sources) {
    const emp = (x.empreintes[`vinted:${s.compte}`] || {})[String(s.id)] || {};
    const hs = Object.values(emp).filter(empreinteValide);
    // Les photos données à côté parlent pour elles-mêmes : la source n'ajoute alors que ses empreintes.
    if (hs.length) for (const h of hs) choisies.push({ h }); else if (!(photos || []).length) choisies.push({ h: null });
  }
  const dejaLues = new Set(choisies.map((c) => c.h).filter(Boolean));
  for (const p of photos || []) {
    if (p && typeof p === 'object' && 'h' in p) { choisies.push({ h: empreinteValide(p.h) ? p.h : null }); continue; }
    const k = clePhotoEmpreinte(p);
    const h = (k && x.index.get(k)) || null;
    if (h && dejaLues.has(h)) continue;
    choisies.push({ h });
  }
  const ex = [...(exclure || []), ...(sources || []).map((s) => `vinted:${s.compte}|${s.id}`)];
  const r = dejaSurAutreCompte({ photos: choisies, annonces: x.annonces, empreintes: x.empreintes, compteCible, compteSource, exclure: ex });
  return { ...r, annonces: r.annonces.map((a) => ({ ...a, nom: a.nom || x.noms[a.cc] || '' })), pasSu: !x.lu };
}

// L'empreinte d'une photo de VRM (fiche, Studio photo, nouvel achat) : calculée DANS la
// page (une image locale ou d'une adresse qui autorise la lecture). Une image que le
// navigateur interdit de lire (CORS) ⇒ null (« pas vérifiée »), jamais une erreur.
export async function empreinteImageLocale(src) {
  try {
    if (!src || typeof document === 'undefined') return null;
    const img = new Image();
    if (!/^(data|blob):/i.test(String(src))) img.crossOrigin = 'anonymous';
    img.src = String(src);
    await img.decode();
    const n = COTE_EMPREINTE;
    const c = document.createElement('canvas'); c.width = n; c.height = n;
    const x = c.getContext('2d');
    x.imageSmoothingQuality = 'high';
    x.drawImage(img, 0, 0, n, n);
    return empreinteDepuisPixels(x.getImageData(0, 0, n, n).data, n, n);
  } catch (_) { return null; }
}
