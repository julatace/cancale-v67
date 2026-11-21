// ══════════════════════════════════════════════════════════════════════════════
//  FUSIONNER DEUX FICHES QUI SONT LA MÊME PAIRE (14 nov., proposition 107)
// ══════════════════════════════════════════════════════════════════════════════
// Deux fiches (deux annonces, `vinted_annonce_numeros`) qu'il SAIT être la même paire
// physique : la même chaussure publiée deux fois, remise en ligne à la main sans
// passer par Republier… Il le dit, sur SON clic, après un aperçu de ce qui sera gardé.
//
// CE QU'UNE FUSION FAIT — ET NE FAIT JAMAIS
//   · ⚠️ AUCUN N° N'EST CHANGÉ, RÉATTRIBUÉ NI PERDU (§5 « un numéro n'est JAMAIS
//     réattribué ») : chaque fiche GARDE son N°. Deux N° différents restent tous les
//     deux visibles ; l'un est celui écrit sur le carton (`carton`, SON choix, dit sur
//     la fiche), l'autre devient un ALIAS (« N°125 · même paire que le N°124, le carton
//     porte le N°124 »). Rien n'appelle le pool, `prochainLibre` ni `recordUsed`.
//   · Ce qui manque à une fiche (prix d'achat, frais, fournisseur, taille) est COMPLÉTÉ
//     par l'autre ; une valeur présente n'est JAMAIS écrasée ; deux valeurs différentes
//     sont un désaccord MONTRÉ, rien n'est choisi à sa place.
//   · La fusion devient une IDENTITÉ (comme `recreeDe` ou la photo exacte) : les règles
//     « la même paire en ligne deux fois » (src/enLigneDeuxFois.js) et les doublons de N°
//     (`doublonsAReattribuer`) la lisent ; deux paires fusionnées sous un même N° ne sont
//     plus « deux paires sous un N° » (ni rouge, ni renumérotation).
//   · REFUSÉE, et dit pourquoi, quand les données PROUVENT deux paires : deux ventes
//     prouvées (deux chaussures sont parties), deux cartons rangés dans deux cases du
//     Stock. Et quand c'est déjà la même paire (`recreeDe` / `repriseDe`).
//   · RÉVERSIBLE 30 JOURS (« Défaire ») : le registre est relu, les champs complétés
//     sont retirés S'ILS N'ONT PAS CHANGÉ depuis ; la fusion reste dans l'historique,
//     marquée défaite. Au-delà de 30 jours elle reste dans l'historique, sans « Défaire ».
//   · Jamais proposée ni posée seule : une proposition peut s'appuyer sur la
//     ressemblance (l'écran trie ses fiches), c'est toujours SON clic qui fusionne.
// Rangée dans SES données : la clé synchronisée `vrm_fusions_fiches` de la ligne `main`
// ({ [id]: { ids, nums, carton, copies, at, annuleeAt? } }) ; le geste est annulable 5 s
// (src/gesteAnnulable.js), puis « Défaire » 30 jours.
// Module PUR : exécuté tel quel par scripts/audit-fusion-fiches.cjs.
// ══════════════════════════════════════════════════════════════════════════════

export const CLE_FUSIONS = 'vrm_fusions_fiches';
export const DEFAIRE_MS = 30 * 24 * 3600 * 1000;
// Les champs qu'une fusion peut COMPLÉTER. ⚠️ Jamais `numero` ni rien qui le touche.
export const CHAMPS_FUSION = Object.freeze(['buyPrice', 'fees', 'buyFrom', 'buyFromId', 'size']);
const INTERDITS = new Set(['numero', 'auto', 'numberedAt', 'manuelAt', 'reattribue', 'repriseDe', 'recreeDe']);

const cleDefaut = (v) => { let s = String(v == null ? '' : v).trim().toUpperCase().replace(/[\s\-_.]/g, ''); if (/^\d+$/.test(s)) s = String(parseInt(s, 10)); return s; };
const vide = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
const egal = (a, b) => String(a).trim().replace(',', '.') === String(b).trim().replace(',', '.');
export const idFusion = (a, b) => 'f_' + [String(a), String(b)].sort().join('_');

export function fusionsActives(registre) {
  const r = registre && typeof registre === 'object' ? registre : {};
  return Object.entries(r).filter(([, x]) => x && Array.isArray(x.ids) && x.ids.length === 2 && !x.annuleeAt).map(([id, x]) => ({ id, ...x }));
}
// Les paires d'annonces que SON clic a dit être la même paire (pour les règles d'identité).
export const pairesFusionnees = (registre) => fusionsActives(registre).map((x) => x.ids.map(String));
export const fusionDe = (registre, id) => fusionsActives(registre).find((x) => x.ids.map(String).includes(String(id))) || null;
// Un N° est-il pris dans une fusion ? { carton, autres, estCarton, fusion } ou null.
export function aliasDuNumero(registre, num, cleNum = cleDefaut) {
  const k = cleNum(num); if (!k) return null;
  for (const f of fusionsActives(registre)) {
    const nums = f.ids.map((id) => (f.nums || {})[id]).filter((n) => n != null && n !== '');
    if (!nums.some((n) => cleNum(n) === k)) continue;
    const autres = [...new Set(nums.filter((n) => cleNum(n) !== k).map(String))];
    return { carton: f.carton != null ? String(f.carton) : null, autres, estCarton: f.carton != null && cleNum(f.carton) === k, fusion: f };
  }
  return null;
}
export const historiqueFusions = (registre) => Object.entries(registre && typeof registre === 'object' ? registre : {})
  .filter(([, x]) => x && Array.isArray(x.ids)).map(([id, x]) => ({ id, ...x })).sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));

// L'APERÇU : ce que la fusion de `a` et `b` ferait, ou pourquoi elle est refusée.
//   ctx.vendus : Set des annonces dont la VENTE est prouvée (null = pas su : rien n'est refusé là-dessus)
//   ctx.caseDe(cleN°) : la case du Stock où ce N° est rangé, ou ''
export function apercuFusion({ a, b, fiches, registre = {}, vendus = null, caseDe = null, cleNum = cleDefaut }) {
  const A = String(a == null ? '' : a), B = String(b == null ? '' : b);
  const F = fiches && typeof fiches === 'object' ? fiches : {};
  if (!A || !B || A === B) return { ok: false, raison: 'meme' };
  const fa = F[A], fb = F[B];
  if (!fa || !fb) return { ok: false, raison: 'absente' };
  if (String(fa.recreeDe || '') === B || String(fb.recreeDe || '') === A || String(fa.repriseDe || '') === B || String(fb.repriseDe || '') === A) return { ok: false, raison: 'dejaMeme' };
  if (fusionDe(registre, A) || fusionDe(registre, B)) return { ok: false, raison: 'deja' };
  if (vendus instanceof Set && vendus.has(A) && vendus.has(B)) return { ok: false, raison: 'deuxVentes' };
  const na = fa.numero != null && String(fa.numero).trim() !== '' ? String(fa.numero) : null;
  const nb = fb.numero != null && String(fb.numero).trim() !== '' ? String(fb.numero) : null;
  const memeNum = !!(na && nb && cleNum(na) === cleNum(nb));
  if (na && nb && !memeNum && typeof caseDe === 'function') {
    const ca = caseDe(cleNum(na)) || '', cb = caseDe(cleNum(nb)) || '';
    if (ca && cb && ca !== cb) return { ok: false, raison: 'deuxCases', cases: [ca, cb] };
  }
  const champs = [];
  for (const c of CHAMPS_FUSION) {
    const va = fa[c], vb = fb[c];
    if (vide(va) && vide(vb)) continue;
    if (!vide(va) && !vide(vb)) { champs.push({ champ: c, va, vb, action: egal(va, vb) ? 'egal' : 'conflit' }); continue; }
    champs.push({ champ: c, va, vb, action: 'copier', vers: vide(va) ? A : B, valeur: vide(va) ? vb : va });
  }
  const nums = [na, nb].filter(Boolean);
  const carton = memeNum ? na : nums.length === 1 ? nums[0] : null;
  const de = (id, f, n) => ({ id, num: n, titre: f.title || '', photo: f.photo || null, compte: f.accountId != null ? String(f.accountId) : '' });
  return { ok: true, a: de(A, fa, na), b: de(B, fb, nb), memeNum, nums, carton, choixCarton: nums.length === 2 && !memeNum, champs };
}

// LES OPÉRATIONS d'une fusion (annulables) : le registre + les champs complétés.
// `carton` : le N° écrit sur le carton (obligatoire quand les deux N° diffèrent).
export function opsFusion(apercu, { carton = null, fiches = {}, registre = {}, cleNum = cleDefaut, maintenant = new Date().toISOString() } = {}) {
  if (!apercu || !apercu.ok) return { ok: false, raison: (apercu && apercu.raison) || 'apercu' };
  let c = apercu.carton;
  if (apercu.choixCarton) {
    c = apercu.nums.find((n) => carton != null && cleNum(n) === cleNum(carton)) || null;
    if (!c) return { ok: false, raison: 'carton' };
  }
  const ids = [apercu.a.id, apercu.b.id];
  const id = idFusion(ids[0], ids[1]);
  const copies = apercu.champs.filter((x) => x.action === 'copier' && CHAMPS_FUSION.includes(x.champ) && !INTERDITS.has(x.champ))
    .map((x) => ({ id: String(x.vers), champ: x.champ, valeur: x.valeur }));
  const ops = [];
  const parFiche = new Map();
  for (const x of copies) { if (!parFiche.has(x.id)) parFiche.set(x.id, {}); parFiche.get(x.id)[x.champ] = x.valeur; }
  for (const [fid, apres] of parFiche) {
    const f = (fiches || {})[fid] || {};
    const avant = {}; for (const k of Object.keys(apres)) avant[k] = f[k] === undefined ? undefined : f[k];
    ops.push({ k: 'vinted_annonce_numeros', type: 'champs', id: fid, apres, avant });
  }
  const rec = { v: 1, ids, nums: { [ids[0]]: apercu.a.num, [ids[1]]: apercu.b.num }, carton: c, copies, at: maintenant };
  ops.push({ k: CLE_FUSIONS, type: 'cle', id, apres: rec, avant: (registre || {})[id] });
  return { ok: true, id, ops, fusion: rec };
}

// DÉFAIRE (30 jours) : la fusion marquée défaite ; chaque champ complété retiré s'il n'a
// pas changé depuis (une valeur qu'il a modifiée ensuite reste la sienne).
export function opsDefaire(id, { registre = {}, fiches = {}, maintenant = new Date().toISOString() } = {}) {
  const f = (registre || {})[id];
  if (!f || !Array.isArray(f.ids)) return { ok: false, raison: 'absente' };
  if (f.annuleeAt) return { ok: false, raison: 'dejaDefaite' };
  const age = Date.parse(maintenant) - Date.parse(f.at || '');
  if (!(age >= 0) || age > DEFAIRE_MS) return { ok: false, raison: 'tropVieille' };
  const ops = [];
  const parFiche = new Map();
  for (const x of Array.isArray(f.copies) ? f.copies : []) {
    const cur = ((fiches || {})[x.id] || {})[x.champ];
    if (cur === undefined || !egal(cur, x.valeur)) continue;
    if (!parFiche.has(x.id)) parFiche.set(x.id, { apres: {}, avant: {} });
    parFiche.get(x.id).apres[x.champ] = undefined; parFiche.get(x.id).avant[x.champ] = cur;
  }
  for (const [fid, p] of parFiche) ops.push({ k: 'vinted_annonce_numeros', type: 'champs', id: fid, apres: p.apres, avant: p.avant });
  ops.push({ k: CLE_FUSIONS, type: 'cle', id, apres: { ...f, annuleeAt: maintenant }, avant: f });
  return { ok: true, ops };
}
export const defaisable = (f, maintenant = Date.now()) => !!(f && !f.annuleeAt && Number.isFinite(Date.parse(f.at || '')) && (Number(maintenant) - Date.parse(f.at)) <= DEFAIRE_MS);
export const finDefaire = (f) => (f && Number.isFinite(Date.parse(f.at || '')) ? new Date(Date.parse(f.at) + DEFAIRE_MS).toISOString() : '');
