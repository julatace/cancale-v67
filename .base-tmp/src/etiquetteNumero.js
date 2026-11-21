// ── LE N° DANS LE TEXTE DE L'ANNONCE VINTED (5 nov.) ─────────────────────────
// Julien, 5 novembre : « les numéros sur les annonces Vinted doivent être bien
// mieux positionnés » ; « plusieurs façons d'étiqueter, des rythmes variés, pas
// simplement 1, 2, 3, 4, accompagné par l'app ».
//
// Ce qui existait (mesuré avant d'écrire ce fichier) :
//   · le FORMAT des numéros (`vrm_num_prefixe` : chiffres, ou une série à lettre
//     B1, C1…) — il décide QUEL numéro est donné, il n'est pas touché ici ;
//   · une PASTILLE « N°12 » que l'extension pose sur vinted.fr (vinted-capture.js :
//     carte du dressing, à côté du titre de la page d'annonce, à côté du bouton
//     « Ajouter » du dépôt) — visible seulement dans SON navigateur ;
//   · la LETTRE ajoutée en bas de la description par Republier (`lettreFin`) ;
//   · AUCUN réglage qui écrive le N° dans le titre ou la description.
//
// Ce fichier est LA règle (§11, un propriétaire) : où le N° s'écrit (`place`),
// sous quelle forme (`forme`), et comment on le pose / le retire d'un texte. Le
// réglage est synchronisé (`vrm_num_vinted`). Il ne change AUCUN numéro et
// aucune règle de numérotation : c'est de la présentation.
//
// ⚠️ §5 — L'ÉTIQUETTE N'EST JAMAIS UNE IDENTITÉ. Elle est écrite pour SES yeux
// (et ceux d'un acheteur). VRM ne la relit jamais pour savoir quelle paire est
// laquelle : l'identité reste l'identifiant d'annonce, la photo, la transaction.
// `retirerEtiquette` ne sert qu'à ne pas EMPILER deux étiquettes (« N°12 N°40 »)
// quand le N° change : il n'enlève qu'une étiquette entière, posée au bord
// exact où VRM l'écrit, jamais un nombre nu (« Air Max 90 » reste « Air Max 90 »).

export const CLE_REGLAGE_ETIQUETTE = 'vrm_num_vinted';

// Vinted refuse un titre de plus de 100 caractères (refus mesuré de
// `recreerVinted`, même borne que `TITRE_MAX.vinted` de src/verifAnnonce.js).
export const TITRE_MAX_VINTED = 100;

export const PLACES = [
  { v: 'aucune', ou: 'nulle part', l: 'Nulle part', court: 'Nulle part', d: 'Le texte de l’annonce ne change pas. Le N° reste là où l’article est rangé, dans VRM et sur la pastille de l’extension (dans ton navigateur seulement).' },
  { v: 'titre_fin', ou: 'à la fin du titre', l: 'À la fin du titre', court: 'Fin du titre', d: 'Visible partout où le titre s’affiche : ton dressing, tes ventes, tes messages. Les acheteurs le voient aussi. Il prend quelques caractères sur les 100 du titre.' },
  { v: 'titre_debut', ou: 'au début du titre', l: 'Au début du titre', court: 'Début du titre', d: 'Le plus rapide à repérer dans une liste. Mais c’est le premier mot que lit l’acheteur, avant la marque.' },
  { v: 'desc_debut', ou: 'en haut de la description', l: 'En haut de la description', court: 'Haut de la description', d: 'Le titre reste propre. Le N° est la première ligne quand tu ouvres l’annonce.' },
  { v: 'desc_fin', ou: 'en bas de la description', l: 'En bas de la description', court: 'Bas de la description', d: 'Le plus discret pour l’acheteur. Tu le trouves en bas de l’annonce ouverte.' },
];

// Les « rythmes » d'étiquetage : la même valeur, écrite autrement. Aucune ne
// change le numéro lui-même (« B125 » s'écrit « #B125 », « Réf B125 »…).
export const FORMES = [
  { v: 'numero', l: 'N°12', f: (n) => `N°${n}` },
  { v: 'diese', l: '#12', f: (n) => `#${n}` },
  { v: 'ref', l: 'Réf 12', f: (n) => `Réf ${n}` },
  { v: 'parentheses', l: '(12)', f: (n) => `(${n})` },
  { v: 'crochets', l: '[12]', f: (n) => `[${n}]` },
  { v: 'n', l: 'n12', f: (n) => `n${n}` },
];

export const REGLAGE_DEFAUT = Object.freeze({ place: 'aucune', forme: 'numero' });

// Ce qui est enregistré → un réglage sûr. Une valeur inconnue retombe sur le
// défaut (« Nulle part ») : un texte d'annonce ne change jamais sur un doute.
export function lireReglageEtiquette(brut) {
  const o = brut && typeof brut === 'object' ? brut : {};
  const place = PLACES.some((p) => p.v === o.place) ? o.place : REGLAGE_DEFAUT.place;
  const forme = FORMES.some((f) => f.v === o.forme) ? o.forme : REGLAGE_DEFAUT.forme;
  return { place, forme };
}

const numTexte = (num) => String(num == null ? '' : num).trim().replace(/\s+/g, '');

export function etiquetteDe(num, forme) {
  const n = numTexte(num); if (!n) return '';
  const f = FORMES.find((x) => x.v === forme) || FORMES[0];
  return f.f(n);
}

const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Toutes les étiquettes VRM possibles pour CE numéro (toutes formes : il a pu
// changer de forme entre-temps). « 007 » et « 7 » sont la même clé (`cleNum`) :
// on accepte les zéros devant, la casse des lettres, jamais un autre numéro.
// ⚠️ Seulement les formes DEMANDÉES (par défaut toutes) : poser « N°42 » ne doit
// pas avaler un « (42) » qui serait la taille écrite par le vendeur.
const MOTIFS = {
  numero: (c) => `N\\s?°\\s?${c}`, diese: (c) => `#${c}`, ref: (c) => `R[ée]f\\.?\\s?${c}`,
  parentheses: (c) => `\\(${c}\\)`, crochets: (c) => `\\[${c}\\]`, n: (c) => `n${c}`,
};
function motifEtiquettes(num, formes) {
  const n = numTexte(num); if (!n) return null;
  const m = /^([A-Za-z]{0,3})0*(\d+)$/.exec(n);
  const corps = m ? `${esc(m[1])}0*${esc(m[2])}` : esc(n);
  const quelles = (Array.isArray(formes) && formes.length ? formes : Object.keys(MOTIFS)).filter((f) => MOTIFS[f]);
  if (!quelles.length) return null;
  return `(?:${quelles.map((f) => MOTIFS[f](corps)).join('|')})(?![0-9A-Za-z])`;
}
// La lettre que Republier pose tout en bas (« \n\nk ») : elle reste la DERNIÈRE
// ligne (l'extension la reconnaît à cette place pour ne pas les empiler).
const LETTRE_FIN = /\n\n([a-z])$/i;

// Retire l'étiquette du numéro `num` d'un titre et/ou d'une description, aux
// seuls bords où VRM l'écrit. `zones` : les bords regardés — 'titre_debut',
// 'titre_fin', 'desc_debut', 'desc_fin' ('titre' et 'description' = les deux
// bords) ; tous par défaut. VRM ne touche que le bord où il ÉCRIT (poser en
// description ne retouche jamais le titre, qui peut porter « taille (42) »).
// Rend { titre, description, retire }.
export function retirerEtiquette({ titre = '', description = '' } = {}, num, formes = null, zones = ['titre', 'description']) {
  const motif = motifEtiquettes(num, formes);
  let t = String(titre || ''), d = String(description || ''), retire = 0;
  if (!motif) return { titre: t, description: d, retire };
  const z = new Set(zones.flatMap((x) => x === 'titre' ? ['titre_debut', 'titre_fin'] : x === 'description' ? ['desc_debut', 'desc_fin'] : [x]));
  if (z.has('titre_debut') || z.has('titre_fin')) {
    // Une étiquette entière, au tout début ou à la toute fin, séparée du reste
    // par un blanc (« brun12 » n'est pas « n12 »). Répété (borné) : deux
    // étiquettes collées par une ancienne copie partent toutes les deux.
    const debutT = new RegExp(`^\\s*${motif}(?:\\s*[-·|–]\\s*|\\s+|$)`, 'i');
    const finT = new RegExp(`(?:^|\\s+(?:[-·|–]\\s*)?)${motif}\\s*$`, 'i');
    for (let tour = 0; tour < 5; tour++) {
      let bouge = false;
      for (const re of [z.has('titre_debut') ? debutT : null, z.has('titre_fin') ? finT : null].filter(Boolean)) { const x = t.replace(re, ''); if (x !== t) { t = x; retire++; bouge = true; } }
      if (!bouge) break;
    }
    t = t.trim();
  }
  if (z.has('desc_debut') || z.has('desc_fin')) {
    // Une LIGNE entière qui n'est que l'étiquette, en tête ou en pied (avant la
    // lettre de Republier, s'il y en a une).
    const ligne = new RegExp(`^\\s*${motif}\\s*$`, 'i');
    const lettre = LETTRE_FIN.exec(d); let corps = lettre ? d.slice(0, -lettre[0].length) : d;
    const lignes = corps.split('\n');
    for (let tour = 0; z.has('desc_debut') && tour < 5; tour++) {
      const premiere = lignes.findIndex((l) => l.trim() !== '');
      if (premiere >= 0 && ligne.test(lignes[premiere])) { lignes.splice(premiere, 1); retire++; } else break;
    }
    for (let tour = 0; z.has('desc_fin') && tour < 5; tour++) {
      let i = lignes.length - 1; while (i >= 0 && lignes[i].trim() === '') i--;
      if (i >= 0 && ligne.test(lignes[i])) { lignes.splice(i, 1); retire++; } else break;
    }
    corps = lignes.join('\n').replace(/^\s*\n+/, '').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '');
    d = lettre ? (corps ? `${corps}\n\n${lettre[1]}` : lettre[1]) : corps;
  }
  return { titre: t, description: d, retire };
}

// Pose l'étiquette du numéro `num` selon le réglage. `ancien` : le numéro
// d'AVANT (changé à la main) — son étiquette est retirée d'abord, pour ne
// jamais laisser « N°12 » à côté de « N°40 ». Rend :
//   { titre, description, etiquette, place, pose: bool, refus: '' | raison }
// Un refus ne change RIEN (le titre trop long n'est jamais coupé en silence).
export function poserEtiquette({ titre = '', description = '' } = {}, num, reglage, { ancien = null } = {}) {
  const r = lireReglageEtiquette(reglage);
  const etiquette = etiquetteDe(num, r.forme);
  const base = { titre: String(titre || ''), description: String(description || '') };
  if (!etiquette) return { ...base, etiquette: '', place: r.place, pose: false, refus: 'pas de numéro' };
  if (r.place === 'aucune') return { ...base, etiquette, place: r.place, pose: false, refus: '' };
  let x = base;
  // Seulement l'étiquette dans la forme CHOISIE (jamais une taille « (42) »).
  // L'ancien N° : aux deux bords de la zone écrite (il a pu être posé au
  // début puis à la fin). Le N° lui-même : seulement au bord où on l'écrit.
  const zone = r.place.startsWith('titre') ? ['titre'] : ['description'];
  if (ancien != null && numTexte(ancien) && numTexte(ancien).toUpperCase() !== numTexte(num).toUpperCase()) x = retirerEtiquette(x, ancien, [r.forme], zone);
  x = retirerEtiquette(x, num, [r.forme], [r.place]);
  let t = x.titre.trim(), d = x.description;
  if (r.place === 'titre_fin' || r.place === 'titre_debut') {
    const nt = !t ? etiquette : r.place === 'titre_fin' ? `${t} ${etiquette}` : `${etiquette} ${t}`;
    if (nt.length > TITRE_MAX_VINTED) {
      return { ...base, etiquette, place: r.place, pose: false, refus: `le titre dépasserait ${TITRE_MAX_VINTED} caractères (${nt.length}) : Vinted le refuserait` };
    }
    return { titre: nt, description: d, etiquette, place: r.place, pose: true, refus: '' };
  }
  const lettre = LETTRE_FIN.exec(d); const corps = (lettre ? d.slice(0, -lettre[0].length) : d).replace(/\s+$/, '');
  let nd;
  if (r.place === 'desc_debut') nd = corps ? `${etiquette}\n\n${corps}` : etiquette;
  else nd = corps ? `${corps}\n\n${etiquette}` : etiquette;
  if (lettre) nd = `${nd}\n\n${lettre[1]}`;
  return { titre: t, description: nd, etiquette, place: r.place, pose: true, refus: '' };
}

// ── L'ACCOMPAGNEMENT : deux questions, une proposition ───────────────────────
// « Où regardes-tu le N° quand une vente tombe ? » × « Tes acheteurs peuvent-ils
// le voir ? » → une place et une forme proposées. Rien n'est enregistré sans
// SON clic (« Prendre ce choix »).
export const QUESTIONS = [
  { id: 'ou', q: 'Où regardes-tu le N° quand une vente tombe ?', r: [
    { v: 'liste', l: 'Dans la liste (ventes, messages)' },
    { v: 'annonce', l: 'En ouvrant l’annonce' },
    { v: 'vrm', l: 'Seulement dans VRM' },
  ] },
  { id: 'vu', q: 'Tes acheteurs peuvent-ils le voir ?', r: [
    { v: 'egal', l: 'Ça m’est égal' },
    { v: 'discret', l: 'Le plus discret possible' },
  ] },
];
export function proposition(rep = {}) {
  if (!rep.ou || (rep.ou !== 'vrm' && !rep.vu)) return null;
  if (rep.ou === 'vrm') return { place: 'aucune', forme: 'numero', pourquoi: 'Tu le lis dans VRM : le texte de l’annonce reste tel quel.' };
  if (rep.ou === 'liste') return rep.vu === 'discret'
    ? { place: 'titre_fin', forme: 'parentheses', pourquoi: 'Dans le titre pour le voir dans la liste, en fin et entre parenthèses pour qu’il se fasse oublier.' }
    : { place: 'titre_fin', forme: 'numero', pourquoi: 'En fin de titre : tu le vois dans chaque liste, la marque reste en tête.' };
  return rep.vu === 'discret'
    ? { place: 'desc_fin', forme: 'ref', pourquoi: 'En bas de la description : l’acheteur lit d’abord l’annonce, toi tu le trouves en descendant.' }
    : { place: 'desc_debut', forme: 'numero', pourquoi: 'En première ligne de la description : le titre reste propre, le N° saute aux yeux à l’ouverture.' };
}

// L'annonce INVENTÉE de l'aperçu (aucune donnée réelle, §2.3).
export const ANNONCE_EXEMPLE = Object.freeze({
  titre: 'Nike Air Max 90 blanches taille 42',
  description: 'Portées quelques fois, très bon état.\nSemelle propre, boîte d’origine.\nEnvoi rapide et soigné.',
  prix: '45,00\u00a0€',
});
