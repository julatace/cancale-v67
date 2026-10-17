// ── STUDIO PHOTO : CADRE GUIDE + DÉTOURAGE LOCAL (fonction n°33, 16 octobre) ──
//
// Retenue par Julien le 11 octobre (« studio photo + détourage »), sous la règle
// §2.9 : aucune fonction payante à l'usage sur SA clé pour les autres. Le
// détourage se fait donc D'ABORD sans IA payante, dans le navigateur :
//
//   · MODÈLE : U²-Netp (« u2netp », 4,6 Mo, ONNX), de Xuebin Qin et al.
//     LICENCE : Apache License 2.0 — vérifiée à la source le 16 octobre 2026 :
//     fichier LICENSE du dépôt github.com/xuebinqin/U-2-Net (« Apache License,
//     Version 2.0, January 2004 »). Usage commercial et redistribution permis,
//     avec la notice. La conversion ONNX utilisée est celle publiée par rembg
//     (github.com/danielgatis/rembg, licence MIT, release v0.0.0, sha256
//     309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8).
//     Les deux notices sont dans public/modeles/LICENCES-u2netp.txt.
//     ⚠️ ÉCARTÉS, et pourquoi : @imgly/background-removal (AGPL), RMBG-1.4 de
//     BRIA (licence non commerciale), le paquet npm @rmbg/model-u2netp (même
//     poids, mais AUCUNE licence déclarée sur le paquet : on ne s'y appuie pas).
//   · MOTEUR : onnxruntime-web 1.22.0 (Microsoft, licence MIT, page npm et
//     dépôt github.com/microsoft/onnxruntime), chargé DEPUIS cdn.jsdelivr.net, à
//     la demande — jamais au chargement de l'app. Le modèle est servi par VRM
//     lui-même (public/modeles/), lui aussi seulement au clic.
//
// Rien ne part chez un service : la photo reste dans le navigateur pendant le
// calcul. Aucune route serveur n'est ajoutée (plafond des 12 fonctions).
//
// ⚠️ QUALITÉ NON MESURÉE SUR DE VRAIES CHAUSSURES : u2netp est un modèle de
// « sujet saillant » léger. Sur un fond uni (ce que le cadre demande) il
// détoure correctement ; ses bords restent doux. L'écran le dit et garde
// TOUJOURS la photo d'origine à côté : jamais un remplacement silencieux.

export const ORT_VERSION = '1.22.0';
export const ORT_BASE = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
export const ORT_SCRIPT = `${ORT_BASE}ort.wasm.min.js`;
export const MODELE_URL = '/modeles/u2netp.onnx';
export const MODELE_TAILLE = 320;           // u2netp attend 1 × 3 × 320 × 320
export const RATIO_CADRE = 3 / 4;           // largeur / hauteur — le format portrait des annonces
export const PHOTOS_MAX_PAR_PAIRE = 12;     // une ligne par paire : bornée (§4.4)
export const ID_STUDIO = (cle) => `studio_photos_${cle}`;

// La plus grande zone au format du cadre, centrée, dans une image w × h.
// Sert au repli « fichier » (la photo est recadrée au même format que le cadre)
// et à la capture caméra (ce que l'écran montre DANS le cadre, `object-fit:cover`).
export const zoneCadre = (w, h, ratio = RATIO_CADRE) => {
  if (!(w > 0 && h > 0)) return null;
  let cw = w, ch = Math.round(w / ratio);
  if (ch > h) { ch = h; cw = Math.round(h * ratio); }
  return { x: Math.round((w - cw) / 2), y: Math.round((h - ch) / 2), w: cw, h: ch };
};

// Recadre une source dessinable (vidéo, image) au format du cadre et rend un
// JPEG. `null` si rien n'a pu être lu (jamais une image vide présentée comme une photo).
export const recadrer = (source, sw, sh, { largeur = 900, qualite = 0.82 } = {}) => {
  const z = zoneCadre(sw, sh); if (!z) return null;
  const w = Math.min(largeur, z.w), h = Math.round(w / RATIO_CADRE);
  try {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    cv.getContext('2d').drawImage(source, z.x, z.y, z.w, z.h, 0, 0, w, h);
    const url = cv.toDataURL('image/jpeg', qualite);
    return /^data:image\/jpeg/.test(url) ? url : null;
  } catch (_) { return null; }
};

const chargerImage = (src) => new Promise((ok, ko) => {
  const im = new Image(); im.onload = () => ok(im); im.onerror = () => ko(new Error('image illisible')); im.src = src;
});

export const recadrerFichier = async (file) => {
  if (!file) return null;
  const url = URL.createObjectURL(file);
  try { const im = await chargerImage(url); return recadrer(im, im.naturalWidth, im.naturalHeight); }
  catch (_) { return null; }
  finally { URL.revokeObjectURL(url); }
};

// ── Lecture / écriture de la ligne de la paire ───────────────────────────────
// `base` = { url, auth(extra), withOwner(row), conflit() } fourni par App.jsx.
// Trois états (« rien lu » ne vaut pas « rien ») : un objet = lu (éventuellement
// vide), `null` = la base n'a pas répondu.
export const lireStudio = async (base, cle) => {
  try {
    const r = await fetch(`${base.url}/rest/v1/app_data?id=eq.${encodeURIComponent(ID_STUDIO(cle))}&select=data`, { headers: base.auth() });
    if (!r.ok) return null;
    const rows = await r.json();
    if (!Array.isArray(rows)) return null;
    const d = rows[0] && rows[0].data;
    return { photos: (d && Array.isArray(d.photos)) ? d.photos : [], numero: (d && d.numero) || cle };
  } catch (_) { return null; }
};

// Lire-fusionner-réécrire, GARDÉ : une lecture ratée n'écrit rien (sinon la
// ligne repartirait avec la seule photo du moment — la famille §5 qui détruit).
export const modifierStudio = async (base, cle, numero, changer) => {
  const lu = await lireStudio(base, cle);
  if (lu === null) return { ok: false, raison: 'lecture' };
  const photos = changer(lu.photos.slice());
  if (photos === false) return { ok: true, photos: lu.photos, rien: true };
  try {
    const r = await fetch(`${base.url}/rest/v1/app_data?on_conflict=${base.conflit()}`, {
      method: 'POST',
      headers: base.auth({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify(base.withOwner({ id: ID_STUDIO(cle), data: { numero, cle, photos, majAt: new Date().toISOString() } })),
    });
    if (!r.ok) return { ok: false, raison: 'ecriture', statut: r.status };
    return { ok: true, photos };
  } catch (_) { return { ok: false, raison: 'ecriture' }; }
};

// ── Détourage local ──────────────────────────────────────────────────────────
let _ort = null, _session = null;
const chargerOrt = () => {
  if (_ort) return _ort;
  _ort = new Promise((ok, ko) => {
    if (typeof window !== 'undefined' && window.ort && window.ort.InferenceSession) return ok(window.ort);
    const s = document.createElement('script');
    s.src = ORT_SCRIPT; s.async = true; s.crossOrigin = 'anonymous';
    s.onload = () => (window.ort && window.ort.InferenceSession) ? ok(window.ort) : ko(new Error('moteur illisible'));
    s.onerror = () => ko(new Error('moteur injoignable'));
    document.head.appendChild(s);
  }).then((ort) => {
    ort.env.wasm.wasmPaths = ORT_BASE;
    ort.env.wasm.numThreads = 1;        // pas de SharedArrayBuffer sans isolation d'origine
    ort.env.wasm.proxy = false;
    return ort;
  });
  _ort.catch(() => { _ort = null; });   // un échec n'est pas définitif : le clic suivant réessaie
  return _ort;
};
const chargerSession = () => {
  if (_session) return _session;
  _session = chargerOrt().then(async (ort) => {
    const r = await fetch(MODELE_URL);
    if (!r.ok) throw new Error('modèle injoignable');
    const buf = await r.arrayBuffer();
    return ort.InferenceSession.create(buf, { executionProviders: ['wasm'] });
  });
  _session.catch(() => { _session = null; });
  return _session;
};

const MOY = [0.485, 0.456, 0.406], ECT = [0.229, 0.224, 0.225];

// Rend { ok:true, img } (PNG ou WebP AVEC transparence) ou { ok:false, raison }.
export const detourerLocal = async (srcDataUrl, { largeur = 720 } = {}) => {
  let im;
  try { im = await chargerImage(srcDataUrl); } catch (_) { return { ok: false, raison: 'photo illisible' }; }
  let session, ort;
  try { session = await chargerSession(); ort = await chargerOrt(); }
  catch (e) { return { ok: false, raison: (e && e.message) || 'chargement impossible' }; }
  try {
    const T = MODELE_TAILLE;
    const cv = document.createElement('canvas'); cv.width = T; cv.height = T;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(im, 0, 0, T, T);
    const px = cx.getImageData(0, 0, T, T).data;
    let max = 0; for (let i = 0; i < px.length; i += 4) { max = Math.max(max, px[i], px[i + 1], px[i + 2]); }
    if (!max) max = 255;
    const n = T * T, entree = new Float32Array(3 * n);
    for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) entree[c * n + i] = (px[i * 4 + c] / max - MOY[c]) / ECT[c];
    const sortie = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', entree, [1, 3, T, T]) });
    const pred = sortie[session.outputNames[0]].data;
    let mi = Infinity, ma = -Infinity; for (let i = 0; i < n; i++) { const v = pred[i]; if (v < mi) mi = v; if (v > ma) ma = v; }
    const et = (ma - mi) || 1;
    const masque = cx.createImageData(T, T);
    for (let i = 0; i < n; i++) { const a = Math.round(((pred[i] - mi) / et) * 255); masque.data[i * 4] = 255; masque.data[i * 4 + 1] = 255; masque.data[i * 4 + 2] = 255; masque.data[i * 4 + 3] = a; }
    cx.putImageData(masque, 0, 0);
    const w = Math.min(largeur, im.naturalWidth), h = Math.round(w * im.naturalHeight / im.naturalWidth);
    const out = document.createElement('canvas'); out.width = w; out.height = h;
    const ox = out.getContext('2d', { willReadFrequently: true });
    ox.drawImage(cv, 0, 0, w, h);                    // le masque, agrandi
    const alpha = ox.getImageData(0, 0, w, h).data;
    ox.clearRect(0, 0, w, h); ox.drawImage(im, 0, 0, w, h);
    const img = ox.getImageData(0, 0, w, h);
    for (let i = 3; i < img.data.length; i += 4) img.data[i] = alpha[i];
    ox.putImageData(img, 0, 0);
    let url = out.toDataURL('image/webp', 0.9);
    if (!/^data:image\/webp/.test(url)) url = out.toDataURL('image/png');   // Safari ancien : PNG
    return { ok: true, img: url };
  } catch (e) { return { ok: false, raison: 'calcul impossible dans ce navigateur' }; }
};
