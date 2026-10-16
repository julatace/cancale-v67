// ── LES PHOTOS DU CDN DE LEBONCOIN, ET LEUR SECOURS (15 octobre) ─────────────
// Julien, 15 octobre : « Leboncoin : j'ai beau actualiser la page, les photos
// des annonces n'apparaissent pas ».
//
// MESURÉ AVANT D'ÉCRIRE (sa base, lecture seule) :
//   · `lbc_listings` : 183 annonces, `images` = un TABLEAU DE CHAÎNES, et les
//     1 071 adresses sont TOUTES sur `https://img.leboncoin.fr/…/<hash>.jpg?
//     rule=ad-image` — aucune signature, aucune date d'expiration dans l'URL :
//     ce ne sont pas des liens périmés, et ce n'est pas un mauvais champ ;
//   · `lbc_ventes` : 16 transactions, UNE seule porte une `image` (même hôte,
//     `?rule=ad-thumb`). Les 3 ventes prouvées n'en ont AUCUNE — alors que leur
//     annonce (même identifiant) est dans `lbc_listings`, avec 12 à 13 photos ;
//   · ces photos étaient rendues par un `<img>` ORDINAIRE : le référent de VRM
//     partait avec, et si le CDN de Leboncoin refuse l'affichage hors de son
//     site (CORP, anti-hotlink) il n'y avait AUCUN secours — une case vide, que
//     « Actualiser » ne pouvait pas remplir. Ce refus n'a PAS pu être mesuré
//     d'ici (aucun appel à Leboncoin) : la règle tient dans les deux cas.
//
// CE QUE FAIT CE MODULE — une règle pour toute l'app (§11) :
//   1. `estPhotoLbc` : l'hôte EXACT mesuré (`img.leboncoin.fr`), rien d'autre ;
//   2. l'image part SANS référent (`no-referrer`, dans le composant) ;
//   3. si le navigateur la refuse quand même, le secours (`demander`, injecté
//      par App.jsx : la route serveur des photos, puis l'extension) rapporte les
//      octets — au plus MAX_EN_VOL demandes à la fois ; seule une image raster
//      en `data:` est acceptée (un SVG ne s'exécute jamais dans l'origine de
//      l'app) ;
//   4. sans secours : le pictogramme, jamais une case vide ni une image cassée ;
//      et rien n'est figé — une photo perdue se réessaie au remontage après son
//      recul (1, 2, 4 puis 5 min), au retour du réseau, au retour de
//      l'extension (`reprendre`) ;
//   5. `photoTransactionLbc` : la photo d'une transaction Leboncoin est la
//      sienne, sinon celle de SON annonce — par l'IDENTIFIANT d'annonce
//      (`itemId` = la clé de `lbc_listings.items`), jamais par le titre (§5).
// Le module ne sait rien de Supabase ni du pont : il est exécutable seul
// (scripts/audit-photos-leboncoin.cjs le charge dans un `vm`).

export const RE_PHOTO_LBC = /^https:\/\/img\.leboncoin\.fr\//i;
export const estPhotoLbc = (u) => typeof u === 'string' && RE_PHOTO_LBC.test(u);

// Une image RASTER, en `data:` — jamais un SVG (il s'exécuterait dans l'origine
// de l'app s'il était ouvert dans un onglet), jamais une page HTML de refus.
export const RE_DATA_IMAGE = /^data:image\/(?:jpeg|jpg|png|webp|gif|avif);base64,/i;
export const MAX_EN_VOL = 3;
export const MAX_ENTREES = 300;
export const RECUL_MS = 60000;
export const RECUL_MAX_MS = 5 * 60000;
export const recul = (n) => Math.min(RECUL_MAX_MS, RECUL_MS * Math.pow(2, Math.max(0, (n | 0) - 1)));

// ── La photo d'une transaction (vente ou achat) Leboncoin ──────────────────
const premiere = (v) => {
  if (typeof v === 'string') return /^https?:\/\//i.test(v) ? v : null;
  if (Array.isArray(v)) { for (const x of v) { const u = premiere(x); if (u) return u; } return null; }
  if (v && typeof v === 'object') return premiere(v.url) || premiere(v.src) || null;
  return null;
};
// `o` : une transaction de `lbc_ventes.ventes` ; `items` : `lbc_listings.items`
// (objet clé = identifiant d'annonce), ou `null` quand on ne l'a pas lu.
export function photoTransactionLbc(o, items) {
  if (!o || typeof o !== 'object') return null;
  const propre = premiere(o.image) || premiere(o.images) || premiere(o.thumb_url) || premiere(o.thumbnail_url);
  if (propre) return propre;
  const id = o.itemId != null ? String(o.itemId).trim() : '';
  if (!id || !items || typeof items !== 'object') return null;
  const ad = Object.prototype.hasOwnProperty.call(items, id) ? items[id] : null;
  // L'IDENTITÉ : l'annonce rangée sous cette clé doit porter CET identifiant.
  if (!ad || typeof ad !== 'object' || String(ad.id) !== id) return null;
  return premiere(ad.images) || premiere(ad.image) || null;
}

// ── Le secours, injecté par App.jsx ─────────────────────────────────────────
// demander(url) → Promise<string|null> : une adresse `data:image/…` ou rien.
const deps = { demander: null, maintenant: () => Date.now() };
export function configurer(d) { Object.assign(deps, d || {}); }

// url → { etat: 'natif' | 'vol' | 'ok' | 'perdue', data, koAt, n, subs }
const entrees = new Map();
const file = [];
let enVol = 0;
const notifier = (e) => { for (const f of [...e.subs]) { try { f(); } catch (_) {} } };
function elaguer() {
  if (entrees.size <= MAX_ENTREES) return;
  for (const [u, e] of entrees) {
    if (entrees.size <= MAX_ENTREES) break;
    if (!e.subs.size && e.etat !== 'vol') entrees.delete(u);
  }
}
function entree(url) {
  let e = entrees.get(url);
  if (!e) { e = { etat: 'natif', data: null, koAt: 0, n: 0, subs: new Set() }; entrees.set(url, e); elaguer(); }
  return e;
}
export function etat(url) { const e = entrees.get(url); return e ? e.etat : 'natif'; }
export function donnees(url) { const e = entrees.get(url); return e && e.etat === 'ok' ? e.data : null; }
export function enVolMaintenant() { return enVol; }

// Une vignette se monte : elle s'abonne, et une photo perdue depuis plus que
// son recul retente sa chance (le navigateur d'abord, puis le secours).
export function monter(url, f) {
  const e = entree(url);
  e.subs.add(f);
  if (e.etat === 'perdue' && deps.maintenant() - e.koAt >= recul(e.n)) { e.etat = 'natif'; notifier(e); }
  return () => { e.subs.delete(f); };
}

function pomper() {
  while (enVol < MAX_EN_VOL && file.length) {
    const url = file.shift();
    const e = entrees.get(url);
    if (!e || e.etat !== 'vol') continue;
    enVol++;
    Promise.resolve()
      .then(() => (typeof deps.demander === 'function' ? deps.demander(url) : null))
      .catch(() => null)
      .then((d) => {
        enVol--;
        if (typeof d === 'string' && RE_DATA_IMAGE.test(d)) { e.etat = 'ok'; e.data = d; e.n = 0; }
        else { e.etat = 'perdue'; e.data = null; e.koAt = deps.maintenant(); e.n++; }
        notifier(e);
        pomper();
      });
  }
}
// Le navigateur n'a pas pu l'afficher (refus du CDN, réseau) : le secours.
export function echecNatif(url) {
  const e = entree(url);
  if (e.etat !== 'natif') return;
  e.etat = 'vol'; notifier(e);
  file.push(url); pomper();
}
// Les octets du secours ne s'affichent pas non plus : perdue, avec recul.
export function echecDonnees(url) {
  const e = entrees.get(url);
  if (!e || e.etat !== 'ok') return;
  e.etat = 'perdue'; e.data = null; e.koAt = deps.maintenant(); e.n++; notifier(e);
}
// Un signal neuf (réseau revenu, extension revenue) : tout ce qui est perdu
// retente sa chance.
export function reprendre() {
  for (const e of entrees.values()) if (e.etat === 'perdue') { e.etat = 'natif'; notifier(e); }
}
if (typeof window !== 'undefined' && window && typeof window.addEventListener === 'function') {
  try { window.addEventListener('online', reprendre); } catch (_) {}
}
