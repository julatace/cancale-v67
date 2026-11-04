// ════════════════════════════════════════════════════════════════════════════
//  LA PHOTO DU COLIS AVANT ENVOI (4 nov., choix de Julien n° 3)
//  Depuis la vente (et « Emballer »), « Photo du colis » ouvre l'appareil photo ;
//  l'image est compressée DANS la page (≤ 1600 px, JPEG ~0,8) et rangée attachée
//  à la vente PAR SON IDENTITÉ (n° de transaction Vinted, id de vente Vestiaire,
//  commande eBay, transaction Leboncoin) — jamais par le titre (§5).
//  · Une ligne DÉDIÉE `colis_photo_{site}_{id}` : JAMAIS dans `main` (une photo
//    y ferait grossir chaque sauvegarde) ; ligne lourde ⇒ jamais `select=data`
//    dessus : la liste ne lit que des scalaires (`id`, `at`), la photo n'est lue
//    qu'à l'ouverture, champ projeté (`photo:data->>photo`) (§4.4).
//  · Lire-fusionner-réécrire n'a pas lieu d'être (une photo par vente, la ligne
//    entière est la sienne) ; une écriture ratée le DIT, rien n'est présenté
//    comme rangé.
//  · Supprimer passe par la corbeille (src/corbeille.js) : la ligne garde la
//    photo, marquée `corbeilleAt` ; restaurer retire la marque ; la purge
//    (30 jours) vide la photo.
// ════════════════════════════════════════════════════════════════════════════

export const PREFIXE = 'colis_photo_';
export const MAX_COTE = 1600;
export const QUALITE = 0.8;
const SITES = { vinted: 'v', vestiaire: 'vc', ebay: 'e', leboncoin: 'l' };

// L'identité d'une vente, ou `null` (sans identité : pas de photo — jamais un titre).
export function identiteVente({ site, id } = {}) {
  const s = SITES[site];
  const v = id == null ? '' : String(id).trim();
  if (!s || !v) return null;
  const propre = v.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 80);
  if (!/[A-Za-z0-9]/.test(propre)) return null;
  return `${s}_${propre}`;
}
export const idLigne = (ident) => (ident ? PREFIXE + ident : null);
// Une ligne de photo ne s'appelle JAMAIS `main` ni autre chose (garde de l'écriture).
export const ligneValide = (id) => typeof id === 'string' && id.startsWith(PREFIXE) && id.length > PREFIXE.length && id !== 'main';

// Les dimensions d'arrivée : le plus grand côté borné à 1600 px, proportions gardées.
export function dimensions(w, h, max = MAX_COTE) {
  const W = Number(w), H = Number(h);
  if (!(W > 0 && H > 0)) return null;
  const k = Math.min(1, max / Math.max(W, H));
  return { w: Math.max(1, Math.round(W * k)), h: Math.max(1, Math.round(H * k)) };
}

// Compresse un fichier image dans la page (navigateur seulement). `null` si
// rien n'a pu être lu — jamais une image vide présentée comme une photo.
export async function compresser(file, { max = MAX_COTE, qualite = QUALITE } = {}) {
  if (!file || typeof document === 'undefined') return null;
  const url = URL.createObjectURL(file);
  try {
    const im = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error('illisible')); i.src = url; });
    const d = dimensions(im.naturalWidth, im.naturalHeight, max); if (!d) return null;
    const cv = document.createElement('canvas'); cv.width = d.w; cv.height = d.h;
    cv.getContext('2d').drawImage(im, 0, 0, d.w, d.h);
    const out = cv.toDataURL('image/jpeg', qualite);
    return /^data:image\/jpeg/.test(out) ? { url: out, w: d.w, h: d.h } : null;
  } catch (_) { return null; } finally { URL.revokeObjectURL(url); }
}

// Ce qui part en base : la ligne dédiée, jamais `main`. Rend null si l'identité manque.
export function ligneAEcrire(ident, photo, maintenant = Date.now()) {
  const id = idLigne(ident);
  if (!ligneValide(id) || !photo || !/^data:image\/jpeg/.test(String(photo.url || ''))) return null;
  return { id, data: { ident, photo: photo.url, w: photo.w || null, h: photo.h || null, at: new Date(maintenant).toISOString(), corbeilleAt: null } };
}

// Les requêtes (formes servies par PostgREST) — projetées, jamais `select=data`.
export const requeteListe = () => `app_data?id=like.${PREFIXE}*&select=id,at:data->>at,corbeille:data->>corbeilleAt`;
export const requetePhoto = (ident) => `app_data?id=eq.${encodeURIComponent(idLigne(ident))}&select=photo:data->>photo,at:data->>at,corbeille:data->>corbeilleAt`;

// L'index lu : { [ident]: { at } } des photos VIVANTES (pas à la corbeille).
// `null` = pas su (lecture ratée) — jamais `{}`.
export function indexDepuisLignes(rows) {
  if (!Array.isArray(rows)) return null;
  const out = {};
  for (const r of rows) {
    if (!r || !ligneValide(r.id) || (r.corbeille && r.corbeille !== 'null')) continue;
    out[String(r.id).slice(PREFIXE.length)] = { at: r.at || '' };
  }
  return out;
}

// Accès réseau (l'app fournit `base` = STUDIO_BASE : url, auth, withOwner, conflit).
export async function listerPhotos(base) {
  try { const r = await fetch(`${base.url}/rest/v1/${requeteListe()}`, { headers: base.auth() }); if (!r.ok) return null; return indexDepuisLignes(await r.json()); }
  catch (_) { return null; }
}
export async function lirePhoto(base, ident) {
  if (!ident) return null;
  try { const r = await fetch(`${base.url}/rest/v1/${requetePhoto(ident)}`, { headers: base.auth() }); if (!r.ok) return null; const j = await r.json(); if (!Array.isArray(j)) return null; const x = j[0]; return x && x.photo && !(x.corbeille && x.corbeille !== 'null') ? { url: x.photo, at: x.at || '' } : { url: null }; }
  catch (_) { return null; }
}
async function poser(base, ligne) {
  if (!ligne || !ligneValide(ligne.id)) return { ok: false, raison: 'identite' };
  try {
    const r = await fetch(`${base.url}/rest/v1/app_data?on_conflict=${base.conflit()}`, {
      method: 'POST', headers: base.auth({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify(base.withOwner(ligne)),
    });
    return r.ok ? { ok: true } : { ok: false, raison: 'ecriture', statut: r.status };
  } catch (_) { return { ok: false, raison: 'ecriture' }; }
}
export const ecrirePhoto = (base, ident, photo) => poser(base, ligneAEcrire(ident, photo));
// Corbeille : on marque (la photo reste), on démarque, on vide à la purge.
// `marquer` relit d'abord la photo : une lecture ratée n'écrit RIEN (§5).
export async function marquerCorbeille(base, ident, at) {
  const lu = await lirePhotoBrute(base, ident); if (!lu) return { ok: false, raison: 'lecture' };
  if (!lu.photo) return { ok: false, raison: 'absente' };
  return poser(base, { id: idLigne(ident), data: { ...lu, ident, corbeilleAt: at || new Date().toISOString() } });
}
export async function restaurerPhoto(base, ident) {
  const lu = await lirePhotoBrute(base, ident); if (!lu) return { ok: false, raison: 'lecture' };
  if (!lu.photo) return { ok: false, raison: 'absente' };
  return poser(base, { id: idLigne(ident), data: { ...lu, ident, corbeilleAt: null } });
}
export const viderPhoto = (base, ident) => poser(base, { id: idLigne(ident), data: { ident, photo: null, purgeeAt: new Date().toISOString(), corbeilleAt: null } });
async function lirePhotoBrute(base, ident) {
  try {
    const r = await fetch(`${base.url}/rest/v1/app_data?id=eq.${encodeURIComponent(idLigne(ident))}&select=photo:data->>photo,at:data->>at,w:data->w,h:data->h`, { headers: base.auth() });
    if (!r.ok) return null; const j = await r.json(); if (!Array.isArray(j)) return null;
    const x = j[0] || {}; return { photo: x.photo || null, at: x.at || null, w: x.w ?? null, h: x.h ?? null };
  } catch (_) { return null; }
}
