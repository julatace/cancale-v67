// ════════════════════════════════════════════════════════════════════════════
//  LA PHOTO DU CARTON FERMÉ, AVANT DÉPÔT (10 nov., lot AZ — fusionné avec le lot M,
//  « photos d'emballage » : UN seul mécanisme, celui-ci).
//  Julien : au scan du bordereau, « C'est la bonne paire · Colis fait », puis — s'il
//  veut — « Photo du carton » (l'appareil photo du téléphone). La photo est une PREUVE
//  rangée AVEC la vente, pour un litige : jamais publiée vers Vinted ni ailleurs.
//
//  OÙ ELLE VIT, ET POURQUOI
//   · UNE ligne `app_data` PAR vente : `colis_photo_{site}_{identité}` — site `v` (Vinted,
//     le n° de transaction), `vc` (Vestiaire, l'id de la vente), `lbc` (Leboncoin, le
//     n° de transaction). Jamais un titre, jamais une ressemblance (§5).
//   · C'est déjà ainsi que vivent les photos de l'app : le ticket d'une dépense
//     (`depense_ticket_{id}`), la photo d'un achat hors plateforme
//     (`achat_hors_photo_{id}`), le studio (`studio_photos_{N°}`). Aucun compartiment,
//     aucune migration, aucune fonction `api/` (12 au plus). Écrite avec `withOwner`
//     (owner = la session ; RLS 021 : un vendeur ne lit et n'écrit que SES lignes).
//   · Jamais dans `main` ni dans une ligne lue souvent (§4.4) : la photo n'est lue que
//     par SON id, au toucher (« Voir »), et l'existence se lit en SCALAIRE
//     (`select=at:data->>at`), jamais `select=data`.
//   · Compressée DANS le navigateur (JPEG, 1280 px au plus, ~350 Ko au plus).
//   · « Retirer » VIDE la ligne (`b64: null, supprime: true`) : un DELETE sur app_data
//     ne supprime rien (règle de la base, comme le ticket et la photo hors).
//
//  POUR LES AUTRES ÉCRANS (Litiges…) : `photoCartonDe(tx, site)`
//     → Promise< { src, at } >  la photo (data URL JPEG) et sa date (ISO)
//     → Promise< false >        lu : AUCUNE photo pour cette vente
//     → Promise< null >         PAS SU (base injoignable, session absente) — « pas su »
//                               ne vaut pas « aucune » (§5)
//   `aPhotoCarton(tx, site)` : la même chose sans la photo (`{ at }` · false · null),
//   une lecture scalaire légère. `idPhotoCarton(site, tx)` : l'id de la ligne.
//   L'app branche la base UNE fois (`brancherPhotoCarton`, App.jsx) ; un écran n'a
//   qu'à importer ces fonctions.
// ════════════════════════════════════════════════════════════════════════════

export const PREFIXE_PHOTO_CARTON = 'colis_photo_';
const SITES = { vinted: 'v', v: 'v', vestiaire: 'vc', vc: 'vc', leboncoin: 'lbc', lbc: 'lbc' };
const propre = (x) => String(x == null ? '' : x).replace(/[^\w-]/g, '').slice(0, 64);

// L'id de la ligne d'UNE vente. '' si l'identité manque (rien n'est alors écrit ni lu).
export function idPhotoCarton(site, tx) {
  const s = SITES[String(site || 'vinted').toLowerCase()] || '';
  const i = propre(tx);
  return s && i ? `${PREFIXE_PHOTO_CARTON}${s}_${i}` : '';
}

// L'identité d'un colis de l'écran Colis (scanner, « Préparer mes colis ») : la vente
// qu'il porte. Vinted : `o.transaction_id` (JAMAIS le bordereau seul : un bordereau sans
// vente n'a pas de vente où ranger la photo) ; Vestiaire : `v.id` ; Leboncoin : `txId`.
export function venteDuColis(x) {
  if (!x || typeof x !== 'object') return null;
  if (x.site === 'vinted') { const t = x.o && x.o.transaction_id; return t != null && String(t).trim() ? { site: 'vinted', tx: String(t) } : null; }
  if (x.site === 'vestiaire') { const t = x.v && x.v.id; return t != null && String(t).trim() ? { site: 'vestiaire', tx: String(t) } : null; }
  if (x.site === 'leboncoin') { const t = x.txId; return t != null && String(t).trim() ? { site: 'leboncoin', tx: String(t) } : null; }
  return null;
}

export const MAX_COTE = 1280;
export const MAX_DATAURL = 480 * 1024;     // ce qui part en base, au plus (~350 Ko d'octets)
export const contenuValide = (s) => typeof s === 'string' && s.length <= MAX_DATAURL && /^data:image\/jpeg;base64,[A-Za-z0-9+/]/.test(s);

// La photo prise réduite dans la page (rien n'est envoyé pour ça). Rend un data URL
// JPEG, ou null si l'image est illisible. La qualité baisse jusqu'à tenir sous MAX_DATAURL.
export function compresserPhotoCarton(fichier, { cote = MAX_COTE } = {}) {
  return new Promise((ok) => {
    try {
      if (!fichier) { ok(null); return; }
      const img = new Image();
      const url = URL.createObjectURL(fichier);
      img.onload = () => {
        try {
          let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
          let k = Math.min(1, cote / Math.max(w, h || 1));
          let sortie = null;
          for (let essai = 0; essai < 6 && !sortie; essai++) {
            const cv = document.createElement('canvas');
            cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k));
            const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
            ctx.drawImage(img, 0, 0, cv.width, cv.height);
            for (const q of [0.72, 0.6, 0.5]) { const d = cv.toDataURL('image/jpeg', q); if (contenuValide(d)) { sortie = d; break; } }
            k *= 0.75;
          }
          URL.revokeObjectURL(url); ok(sortie);
        } catch (_) { try { URL.revokeObjectURL(url); } catch (__) {} ok(null); }
      };
      img.onerror = () => { try { URL.revokeObjectURL(url); } catch (_) {} ok(null); };
      img.src = url;
    } catch (_) { ok(null); }
  });
}

// ── La base (branchée par l'app : url, en-têtes de session, propriétaire, clé de conflit).
let BASE = null;
export function brancherPhotoCarton(deps) { BASE = deps && deps.url && deps.auth ? deps : null; }
const prete = () => !!BASE;
// Le cache est celui du PROPRIÉTAIRE de la session (un autre compte ouvert sur l'appareil ne le voit pas).
const cleCache = (id) => (BASE && typeof BASE.owner === 'function' ? String(BASE.owner() || '') : '') + '|' + id;

// Écrit la photo d'UNE vente (ou la vide avec `dataUrl = null`). true seulement si la base l'a acceptée.
export async function ecrirePhotoCarton({ site = 'vinted', tx, dataUrl, num = '' }) {
  const id = idPhotoCarton(site, tx);
  if (!id || !prete()) return false;
  if (dataUrl != null && !contenuValide(dataUrl)) return false;
  const at = new Date().toISOString();
  const data = dataUrl
    ? { b64: dataUrl, at, site: SITES[site] || site, tx: String(tx), num: String(num || '').slice(0, 12) }
    : { b64: null, supprime: true, at, site: SITES[site] || site, tx: String(tx) };
  try {
    const conflit = typeof BASE.conflit === 'function' ? BASE.conflit() : (BASE.conflit || 'id');
    const r = await (BASE.fetch || fetch)(`${BASE.url}/rest/v1/app_data?on_conflict=${conflit}`, {
      method: 'POST',
      headers: BASE.auth({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify([BASE.withOwner ? BASE.withOwner({ id, data }) : { id, data }]),
    });
    const bon = !!(r && r.ok);
    if (bon) { CACHE.set(cleCache(id), dataUrl ? { src: dataUrl, at } : false); signaler(id); }
    return bon;
  } catch (_) { return false; }
}

// Ce que l'appareil a déjà lu ou écrit (la photo ne repart pas en lecture à chaque ouverture).
const CACHE = new Map();
const ECOUTES = new Set();
const signaler = (id) => { for (const f of ECOUTES) { try { f(id); } catch (_) {} } };
export function ecouterPhotoCarton(f) { ECOUTES.add(f); return () => ECOUTES.delete(f); }

const lireLigne = async (id, select) => {
  const r = await (BASE.fetch || fetch)(`${BASE.url}/rest/v1/app_data?id=eq.${encodeURIComponent(id)}&select=${select}`, { headers: BASE.auth() });
  if (!r || !r.ok) return undefined;
  const j = await r.json();
  return Array.isArray(j) ? (j[0] || null) : undefined;
};

// La photo d'UNE vente : { src, at } · false (aucune) · null (pas su). Voir l'en-tête.
export async function photoCartonDe(tx, site = 'vinted') {
  const id = idPhotoCarton(site, tx);
  if (!id) return false;
  if (!prete()) return null;
  const c = CACHE.get(cleCache(id)); if (c && c.src) return c; if (c === false) return false;
  try {
    const l = await lireLigne(id, 'b:data->>b64,at:data->>at');
    if (l === undefined) return null;
    const src = l && typeof l.b === 'string' && /^data:image\//.test(l.b) ? l.b : null;
    const v = src ? { src, at: l.at || null } : false;
    CACHE.set(cleCache(id), v); return v;
  } catch (_) { return null; }
}

// La même question sans la photo (une lecture scalaire) : { at } · false · null.
export async function aPhotoCarton(tx, site = 'vinted') {
  const id = idPhotoCarton(site, tx);
  if (!id) return false;
  if (!prete()) return null;
  const c = CACHE.get(cleCache(id)); if (c && c.src) return { at: c.at }; if (c === false) return false;
  try {
    const l = await lireLigne(id, 'at:data->>at,vide:data->>supprime');
    if (l === undefined) return null;
    if (!l || l.vide === 'true' || !l.at) { CACHE.set(cleCache(id), false); return false; }
    return { at: l.at };
  } catch (_) { return null; }
}

export const _oublierCachePhotoCarton = () => CACHE.clear();
