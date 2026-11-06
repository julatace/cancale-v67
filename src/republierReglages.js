// ═══════════════════════════════════════════════════════════════════════════
// LES RÉGLAGES DE « REPUBLIER » — UNE SEULE SOURCE (6 nov.)
// ═══════════════════════════════════════════════════════════════════════════
// Julien, 6 nov. : « pour les républications à la main c'est bien mais je veux
// que on puisse régler comme quand c'est VRM qui fait ».
//
// Inventaire MESURÉ dans le code avant d'écrire ce fichier (atelier `RepublierVinted`,
// étape « Modifier », actions `recreer` et `versBrouillon`) :
//   · PHOTOS : rotation, luminosité, contraste, saturation, zoom — UN réglage pour
//     toutes les photos de toutes les annonces (« Varier » et le réglage par annonce
//     sont RETIRÉS, CLAUDE.md §3) ; préréglages nommés `vrm_photo_presets` ; l'extension
//     refait le rendu de l'aperçu EN PIXELS (`photoReglee`, bornes `reglagesPhotoSurs`) ;
//   · PRIX : garder · −5/−10/−15/−20 % · autre % · − X € · même prix pour toutes ·
//     arrondi à l'euro ; jamais sous le prix d'achat (`lotAppliquePrix`, plancher) ;
//   · TITRE : ne pas changer · ajouter au début · à la fin · remplacer · supprimer
//     (`lotAppliqueTitre`), jamais coupé (100 caractères : signalé, l'annonce ne part pas) ;
//   · DESCRIPTION : reprise mot pour mot, option « une lettre au hasard tout en bas »
//     (l'extension retire d'abord la lettre d'une recréation précédente, `lettreVRM`) ;
//   · (atelier seul, sans objet à la main) passage par un brouillon, temps entre deux
//     annonces, ordre, confirmation.
//   · Le N° DANS LE TEXTE (`vrm_num_vinted`, src/etiquetteNumero.js) n'est PAS appliqué
//     par l'atelier aujourd'hui : l'extension ne l'écrit pas encore (passation
//     2026-11-05-numerotation-etiquette, « reste : extension »). À la main, le texte
//     copié le porte, par `poserEtiquette` — la règle de Réglages → Numéros.
//
// Avant ce fichier, l'atelier et « à la main » avaient chacun LEURS réglages :
// l'atelier repartait de zéro à chaque ouverture, « à la main » gardait les siens
// sur l'appareil (`vrm_main_reglages`) avec d'AUTRES bornes (zoom 1,5, lumière 1,6 :
// une photo téléchargée à la main pouvait ne pas être celle que l'extension envoie).
// Désormais : UN objet synchronisé (`vrm_republier_reglages`, SYNC_KEYS : photo et lettre
// seulement, voir `reglagesGardes`), lu et écrit par les deux ; UNE règle par notion, ici, exécutée par l'atelier ET par « à la main »
// (scripts/audit-republier-main.cjs exécute ce module et vérifie qu'aucun des deux n'en
// garde une copie).
import { poserEtiquette, lireReglageEtiquette } from './etiquetteNumero.js';

export const CLE_REGLAGES_REPUB = 'vrm_republier_reglages';
// Vinted refuse un titre de plus de 100 caractères : on SIGNALE, on ne coupe JAMAIS.
export const TITRE_VINTED_MAX = 100;

// ── PHOTOS ──────────────────────────────────────────────────────────────────
export const PHOTO_NEUTRE = Object.freeze({ rot: 0, bright: 1, contrast: 1, sat: 1, zoom: 1 });
// Les curseurs de l'atelier (libellés, bornes, pas) : les bornes sont CELLES de
// l'extension (`reglagesPhotoSurs` : ±15°, lumière et contraste 0,5–1,5, saturation
// 0–2, zoom 1–2) — une valeur que l'extension ramènerait ne s'affiche jamais.
export const CURSEURS_PHOTO = Object.freeze([
  { cle: 'rot', l: 'Redresser', min: -15, max: 15, pas: 0.5 },
  { cle: 'bright', l: 'Luminosité', min: 0.5, max: 1.5, pas: 0.01 },
  { cle: 'contrast', l: 'Contraste', min: 0.5, max: 1.5, pas: 0.01 },
  { cle: 'sat', l: 'Saturation', min: 0, max: 2, pas: 0.01 },
  { cle: 'zoom', l: 'Zoom', min: 1, max: 2, pas: 0.01 },
]);
const borne = (v, a, b, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d; };
export function bornerPhoto(r) {
  const x = r && typeof r === 'object' ? r : {};
  const o = {};
  for (const c of CURSEURS_PHOTO) o[c.cle] = borne(x[c.cle], c.min, c.max, PHOTO_NEUTRE[c.cle]);
  return o;
}
export function photoNeutre(r) { const x = bornerPhoto(r); return Object.keys(PHOTO_NEUTRE).every((k) => x[k] === PHOTO_NEUTRE[k]); }
// Le filtre et la géométrie : la même chaîne pour l'aperçu (CSS) et pour la
// toile (« à la main ») — et la même que l'extension écrit (`photoReglee`).
export function filtrePhoto(r) {
  const x = bornerPhoto(r);
  return { filtre: `brightness(${x.bright}) contrast(${x.contrast}) saturate(${x.sat})`, rot: x.rot, zoom: x.zoom };
}
export function cssApercuPhoto(r) {
  const f = filtrePhoto(r);
  return { filter: f.filtre, transform: `rotate(${f.rot}deg) scale(${f.zoom})`, transformOrigin: 'center center' };
}
// Le dessin d'une photo réglée sur une toile 2D : fond blanc, filtre, rotation et
// zoom autour du centre, l'original dessiné à sa taille (l'extension fait de même,
// en pixels, dans `photoReglee`). `ctx` : un contexte 2D (ou un faux, au banc).
// Rend 'filtre' (le navigateur a filtré) ou 'pixels' (Safari : il faut appeler
// `appliquerCouleursPixels` sur l'image ensuite).
export function dessinerPhotoReglee(ctx, img, w, h, r) {
  const x = bornerPhoto(r); const f = filtrePhoto(x);
  const natif = typeof ctx.filter === 'string';
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
  if (natif) ctx.filter = f.filtre;
  ctx.translate(w / 2, h / 2); ctx.rotate(f.rot * Math.PI / 180); ctx.scale(f.zoom, f.zoom);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  return natif ? 'filtre' : 'pixels';
}
// Repli quand la toile ne sait pas filtrer (`ctx.filter` absent : Safari) : la
// même lumière, le même contraste, la même saturation, pixel par pixel (formules
// des filtres CSS). `data` = Uint8ClampedArray RGBA, modifié en place.
export function appliquerCouleursPixels(data, r) {
  const x = bornerPhoto(r);
  const br = x.bright, ct = x.contrast, sa = x.sat;
  if (br === 1 && ct === 1 && sa === 1) return data;
  const ic = 0.5 - 0.5 * ct;
  for (let i = 0; i < data.length; i += 4) {
    let R = data[i] / 255 * br, G = data[i + 1] / 255 * br, B = data[i + 2] / 255 * br;
    R = R * ct + ic; G = G * ct + ic; B = B * ct + ic;
    const l = 0.213 * R + 0.715 * G + 0.072 * B;
    R = l + (R - l) * sa; G = l + (G - l) * sa; B = l + (B - l) * sa;
    data[i] = R * 255; data[i + 1] = G * 255; data[i + 2] = B * 255;
  }
  return data;
}
export function nomPhotoReglee(num, i) {
  const n = String(num || '').replace(/[^0-9A-Za-z]/g, '');
  return `VRM-${n || 'annonce'}-${String(i + 1).padStart(2, '0')}.jpg`;
}

// ── PRIX ────────────────────────────────────────────────────────────────────
// Les boutons de l'atelier (29 oct., « les réductions je ne comprends rien ») :
// garder, ou baisser de 5, 10, 15, 20 % ; le reste est dans « Autre… ».
export const REDUCTIONS_RAPIDES = Object.freeze(['-5', '-10', '-15', '-20']);
export const PRIX_NEUTRE = Object.freeze({ base: 'aucun', delta: '', commun: '', arrondi: 'aucun', sens: 'proche', fin: 'aucune' });
// Le prix d'une annonce republiée. Jamais CUMULATIF : depuis le prix de base, dans
// un ORDRE explicite — (1) ajustement ou prix commun → (2) arrondi → (3) terminaison
// → (4) plancher : jamais sous le prix d'achat (ramené ET signalé).
export function lotAppliquePrix(base, op, floor) {
  const flags = [];
  let p = Number(base);
  if (!isFinite(p)) p = 0;
  if (op.base === 'commun') { const c = Number(String(op.commun).replace(',', '.')); if (isFinite(c)) p = c; }
  else if (op.base === 'pct') { const d = Number(String(op.delta).replace(',', '.')); if (isFinite(d)) p = p * (1 + d / 100); }
  else if (op.base === 'fixe') { const d = Number(String(op.delta).replace(',', '.')); if (isFinite(d)) p = p + d; }
  if (op.arrondi && op.arrondi !== 'aucun') {
    const pas = op.arrondi === 'euro' ? 1 : op.arrondi === '5' ? 5 : 10;
    const f = op.sens === 'sup' ? Math.ceil : op.sens === 'inf' ? Math.floor : Math.round;
    p = f(p / pas) * pas;
  }
  if (op.fin && op.fin !== 'aucune') {
    const dec = op.fin === '00' ? 0 : op.fin === '50' ? 0.5 : op.fin === '90' ? 0.9 : 0.99;
    p = Math.floor(p) + dec;
  }
  let sousPlancher = false;
  if (floor != null && isFinite(floor) && p < floor) { p = floor; sousPlancher = true; flags.push('plancher'); }
  p = Math.round(p * 100) / 100;
  if (p <= 0) flags.push('invalide');
  return { prix: p, sousPlancher, flags };
}

// ── TITRE ───────────────────────────────────────────────────────────────────
export const MODES_TITRE = Object.freeze([
  { v: 'aucun', l: 'Ne pas changer le titre' },
  { v: 'prefixe', l: 'Ajouter au début' },
  { v: 'suffixe', l: 'Ajouter à la fin' },
  { v: 'remplacer', l: 'Remplacer un texte' },
  { v: 'supprimer', l: 'Supprimer un texte' },
]);
export const TITRE_NEUTRE = Object.freeze({ mode: 'aucun', valeur: '', chercher: '', pos: '0' });
export function lotAppliqueTitre(base, op) {
  let t = String(base == null ? '' : base);
  const v = String(op.valeur == null ? '' : op.valeur);
  if (op.mode === 'prefixe') { if (v && !t.startsWith(v)) t = v + t; }
  else if (op.mode === 'suffixe') { if (v && !t.endsWith(v)) t = t + v; }
  else if (op.mode === 'remplacer') { const c = String(op.chercher == null ? '' : op.chercher); if (c) t = t.split(c).join(v); }
  else if (op.mode === 'supprimer') { const c = String(op.chercher == null ? '' : op.chercher); if (c) t = t.split(c).join(''); }
  else if (op.mode === 'inserer') { const pos = Math.max(0, Math.min(t.length, Math.round(Number(op.pos)) || 0)); t = t.slice(0, pos) + v + t.slice(pos); }
  return t.replace(/\s{2,}/g, ' ').trim();     // les espaces doublés nettoyés — jamais on ne coupe
}

// ── L'OBJET SYNCHRONISÉ ─────────────────────────────────────────────────────
export const REGLAGES_DEFAUT = Object.freeze({ photo: PHOTO_NEUTRE, prix: PRIX_NEUTRE, titre: TITRE_NEUTRE, lettre: false });
const BASES_PRIX = ['aucun', 'pct', 'fixe', 'commun'];
const ARRONDIS = ['aucun', 'euro', '5', '10'];
const FINS = ['aucune', '00', '50', '90', '99'];
const txt = (v, n = 80) => String(v == null ? '' : v).slice(0, n);
// Ce qui est enregistré → un réglage sûr. Une valeur inconnue retombe sur le neutre :
// un prix ou un titre ne change JAMAIS sur un doute. `ancienPhoto` : les réglages photo
// que « à la main » gardait sur l'appareil avant (repris une fois, s'il n'y a rien d'autre).
export function lireReglagesRepub(brut, ancienPhoto = null) {
  const o = brut && typeof brut === 'object' ? brut : {};
  const p = o.prix && typeof o.prix === 'object' ? o.prix : {};
  const t = o.titre && typeof o.titre === 'object' ? o.titre : {};
  const prix = {
    base: BASES_PRIX.includes(p.base) ? p.base : 'aucun',
    delta: txt(p.delta, 12), commun: txt(p.commun, 12),
    arrondi: ARRONDIS.includes(p.arrondi) ? p.arrondi : 'aucun',
    sens: ['proche', 'sup', 'inf'].includes(p.sens) ? p.sens : 'proche',
    fin: FINS.includes(p.fin) ? p.fin : 'aucune',
  };
  const titre = { mode: MODES_TITRE.some((m) => m.v === t.mode) ? t.mode : 'aucun', valeur: txt(t.valeur), chercher: txt(t.chercher), pos: '0' };
  const photo = bornerPhoto(o.photo && typeof o.photo === 'object' ? o.photo : (ancienPhoto && typeof ancienPhoto === 'object' ? ancienPhoto : PHOTO_NEUTRE));
  return { photo, prix, titre, lettre: o.lettre === true };
}
// (6 nov., décision qui respecte la sienne du 29 oct. : « le prix ne change plus par défaut »)
// GARDÉS d'une ouverture à l'autre (et synchronisés) : la PHOTO et la LETTRE seulement. La
// baisse de PRIX et le TITRE repartent de « Garder » / « Ne pas changer » à CHAQUE ouverture,
// dans l'atelier comme à la main ; pendant une ouverture (plusieurs paires « à la main »),
// ils valent pour toutes les paires.
// Ce qui s'écrit dans la clé commune : jamais un prix, jamais un titre.
export function reglagesGardes(reg) {
  const r = lireReglagesRepub(reg);
  return { photo: r.photo, lettre: r.lettre };
}
// Les réglages à l'OUVERTURE d'une feuille : photo et lettre relues, prix et titre neutres —
// sauf `encours` (la même ouverture, paire suivante) qui garde ceux qu'il vient de choisir.
export function reglagesAOuverture(brut, ancienPhoto = null, encours = null) {
  const g = lireReglagesRepub(brut, ancienPhoto);
  const e = encours && typeof encours === 'object' ? lireReglagesRepub(encours) : null;
  return { photo: g.photo, lettre: g.lettre, prix: e ? e.prix : { ...PRIX_NEUTRE }, titre: e ? e.titre : { ...TITRE_NEUTRE } };
}
export const prixChange = (reg) => { const p = (reg && reg.prix) || PRIX_NEUTRE; return p.base !== 'aucun' || p.arrondi !== 'aucun' || p.fin !== 'aucune'; };
export const titreChange = (reg) => !!(reg && reg.titre && reg.titre.mode !== 'aucun');

// L'APERÇU d'une annonce, tel que l'atelier l'envoie à l'extension : le titre et le
// prix NOUVEAUX (null = inchangé), plancher, trop long, invalide.
//   a = { titre, prix, floor } (prix : null = pas lu ; floor : prix d'achat ou null)
export function apercuRepub(a, reg) {
  const r = reg || REGLAGES_DEFAUT;
  const changeT = titreChange(r), changeP = prixChange(r);
  const nt = changeT ? lotAppliqueTitre(a.titre, r.titre) : a.titre;
  const np = changeP && a.prix != null ? lotAppliquePrix(a.prix, r.prix, a.floor) : null;
  const prix = np && np.prix > 0 && np.prix !== a.prix ? np.prix : null;
  const titre = nt && nt !== a.titre ? nt : null;
  return { titre, prix, plancher: !!(np && np.sousPlancher), tropLong: !!(titre && titre.length > TITRE_VINTED_MAX), invalide: !!(changeT && !nt) };
}

// ── LA LETTRE EN BAS DE LA DESCRIPTION ──────────────────────────────────────
// La même forme que l'extension (« \n\nk » en dernière ligne). Comme elle
// (`sansLettre` de `recreerVinted`), une lettre seule en dernière ligne — celle
// d'une recréation précédente — est TOUJOURS retirée d'abord : jamais deux.
// (scripts/audit-republier-main.cjs exécute la fonction de l'extension et la compare.)
export function sansLettre(t) {
  const x = String(t || '').trim();
  if (/^[a-z]$/i.test(x)) return '';
  return /\n\n[a-z]$/i.test(x) ? x.slice(0, -3).trimEnd() : x;
}
export function tirerLettre(alea = Math.random) { return 'abcdefghijklmnopqrstuvwxyz'[Math.min(25, Math.floor(alea() * 26))]; }
export function descriptionAvecLettre(desc, lettre) {
  const base = sansLettre(desc);
  const l = /^[a-z]$/i.test(String(lettre || '')) ? String(lettre) : '';
  return l ? (base ? `${base}\n\n${l}` : l) : base;
}

// ── L'ANNONCE TELLE QU'ELLE PARTIRA, À LA MAIN ──────────────────────────────
// Les MÊMES règles que l'atelier (`apercuRepub`, la lettre), puis le N° posé selon
// « Le N° sur tes annonces Vinted » (`poserEtiquette`, src/etiquetteNumero.js).
//   a  = { titre, description, prix, floor, numero }
//   reg = lireReglagesRepub(…) ; lettre : la lettre tirée pour CETTE annonce ;
//   etiquette : le réglage `vrm_num_vinted` (lu par l'app).
// Rend { titre, description, prix, prixAvant, plancher, tropLong, invalide, etiquette }.
// « Pas su » reste « pas su » : un prix pas lu reste null (jamais 0), une
// description absente reste '' (dite par l'écran).
export function annonceRepubliee(a, reg, { lettre = '', etiquette = null } = {}) {
  const r = reg || REGLAGES_DEFAUT;
  const prixAvant = a.prix != null && Number(a.prix) > 0 ? Number(a.prix) : null;
  const ap = apercuRepub({ titre: String(a.titre || ''), prix: prixAvant, floor: a.floor == null ? null : Number(a.floor) }, r);
  const titre0 = ap.titre != null ? ap.titre : String(a.titre || '');
  const desc0 = descriptionAvecLettre(a.description, r.lettre ? lettre : '');
  const e = poserEtiquette({ titre: titre0, description: desc0 }, a.numero, lireReglageEtiquette(etiquette));
  const titre = e.pose ? e.titre : titre0;
  const description = e.pose ? e.description : desc0;
  return {
    titre, description,
    prix: ap.prix != null ? ap.prix : prixAvant, prixAvant,
    plancher: ap.plancher, tropLong: titre.length > TITRE_VINTED_MAX, invalide: ap.invalide,
    etiquette: { pose: !!e.pose, place: e.place, refus: e.refus || '', texte: e.etiquette || '' },
  };
}

// Ce que les réglages GARDÉS font, en mots courts (le bandeau « Mêmes réglages que Republier ») :
// la photo et la lettre — le prix et le titre ne sont jamais « gardés ».
export function resumeGardes(reg) {
  const r = reg || REGLAGES_DEFAUT;
  return [photoNeutre(r.photo) ? 'Photos d’origine' : 'Photos retouchées', ...(r.lettre ? ['Lettre en bas'] : [])];
}
// Tout ce que font les réglages de CETTE ouverture.
export function resumeReglages(reg) {
  const r = reg || REGLAGES_DEFAUT;
  const out = [];
  out.push(photoNeutre(r.photo) ? 'Photos d’origine' : 'Photos retouchées');
  const p = r.prix;
  if (!prixChange(r)) out.push('Prix gardé');
  else if (p.base === 'pct') out.push(`Prix −${String(p.delta).replace(/^-/, '') || '?'} %${p.arrondi === 'euro' ? ', arrondi' : ''}`);
  else if (p.base === 'fixe') out.push(`Prix −${String(p.delta).replace(/^-/, '') || '?'} €${p.arrondi === 'euro' ? ', arrondi' : ''}`);
  else if (p.base === 'commun') out.push(`Prix ${p.commun || '?'} € pour toutes`);
  else out.push('Prix arrondi');
  if (titreChange(r)) out.push('Titre modifié');
  if (r.lettre) out.push('Lettre en bas');
  return out;
}
