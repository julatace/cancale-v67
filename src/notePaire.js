// ══════════════════════════════════════════════════════════════════════════════
//  LA NOTE PRIVÉE D'UNE PAIRE (10 nov., lot BD — validé par Julien)
//  docs/passation/2026-11-10-note-achat-double.md
// ══════════════════════════════════════════════════════════════════════════════
// Un petit mot que LUI SEUL voit (« petite tache semelle gauche », « taille
// petit »), rattaché à la PAIRE par son IDENTITÉ (§5), jamais par son titre :
//   · `n:<cleNum>` — le N° de rangement (il est écrit sur le carton, il ne se
//     redonne jamais) : la note suit la paire partout où son N° est connu
//     (Annonces, fiche paire, Ventes, Colis, Stock), et une paire REPUBLIÉE garde
//     son N° (src/repriseNumero.js) — donc sa note, sans rien recopier ;
//   · `a:<id d'annonce Vinted>` — une paire pas encore numérotée ; la note de
//     l'annonce qu'une republication remplace (`recreeDe`) suit la nouvelle.
// Aucune identité ⇒ aucune note (mieux vaut un blanc qu'un faux). Un N° porté
// par DEUX paires présentes (`ambigu`) ⇒ la note n'est montrée sur aucune des
// deux : elle pourrait décrire l'autre (« note cachée : N° sur deux paires »).
//
// Rangée dans SES données : la clé synchronisée `vrm_notes_paires` de la ligne
// `main` (lire-fusionner-réécrire sous-clé par sous-clé, comparer-et-échanger sur
// `data.rev`, une lecture ratée n'écrit rien — `cloudPush`, src/fusionNuage.js).
// ⚠️ JAMAIS envoyée à une plateforme : aucune description, aucun titre, aucune
// commande de l'extension ne la lit (`audit-note-achat-double.cjs` le vérifie).
//
// Module PUR : exécuté tel quel par scripts/audit-note-achat-double.cjs.
// ══════════════════════════════════════════════════════════════════════════════

import { motsVendeur } from './profilVendeur.js';
export const CLE_NOTES_PAIRES = 'vrm_notes_paires';
export const NOTE_MAX = 200;

// La clé d'un N° : la MÊME règle que `cleNum` d'App.jsx (majuscules, sans espace
// ni tiret, « 007 » = « 7 »). L'app passe la sienne ; celle-ci sert à l'audit.
export const cleNumNote = (v) => {
  let s = String(v == null ? '' : v).trim().toUpperCase().replace(/[\s\-_.]/g, '');
  if (/^\d+$/.test(s)) s = String(parseInt(s, 10));
  return s;
};

// Le texte gardé : une ligne, espaces resserrés, 200 caractères au plus.
export function nettoyerNote(t) {
  const s = String(t == null ? '' : t).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return Array.from(s).slice(0, NOTE_MAX).join('').trim();
}

const idAnnonce = (v) => { const s = String(v == null ? '' : v).trim(); return /^\d{3,}$/.test(s) ? s : ''; };

// Les clés d'une paire, dans l'ordre où on les cherche. `paire` = { numero, itemId, recreeDe }.
export function clesPaire(paire, cleNum = cleNumNote) {
  const p = paire || {};
  const out = [];
  const n = p.numero == null ? '' : cleNum(p.numero);
  if (n) out.push('n:' + n);
  const a = idAnnonce(p.itemId);
  if (a) out.push('a:' + a);
  const r = idAnnonce(p.recreeDe);
  if (r && r !== a) out.push('a:' + r);
  return out;
}

// La clé où une note s'ÉCRIT : le N° s'il y en a un, sinon l'annonce. Rien sinon.
export function cleEcriture(paire, cleNum = cleNumNote) {
  const p = paire || {};
  const n = p.numero == null ? '' : cleNum(p.numero);
  if (n) return 'n:' + n;
  const a = idAnnonce(p.itemId);
  return a ? 'a:' + a : '';
}

const estNote = (v) => !!v && typeof v === 'object' && typeof v.t === 'string' && v.t.trim() !== '';

// La note d'une paire : { texte, cle, at } · { cachee: true, raison } (N° ambigu) · null.
// `ambigu(cleNum)` : vrai si deux paires PRÉSENTES portent ce N° (la règle de l'app).
export function noteDe(notes, paire, { cleNum = cleNumNote, ambigu = null } = {}) {
  if (!notes || typeof notes !== 'object') return null;
  const cles = clesPaire(paire, cleNum);
  if (!cles.length) return null;
  const n = cles[0].startsWith('n:') ? cles[0].slice(2) : '';
  if (n && typeof ambigu === 'function' && ambigu(n)) {
    return estNote(notes['n:' + n]) ? { cachee: true, raison: `N°${n} porté par deux ${motsVendeur().noms}` } : null;
  }
  for (const k of cles) {
    const v = notes[k];
    if (estNote(v)) return { texte: nettoyerNote(v.t), cle: k, at: v.at || '' };
  }
  return null;
}

// Les sous-valeurs à poser pour ÉCRIRE `texte` sur la paire (vide = effacer).
// Rend des opérations `{ k, type: 'cle', id, apres, avant }` (src/gesteAnnulable.js),
// annulables à l'identique. Écrire sous le N° retire la note d'avant posée sur
// l'annonce (la même paire, numérotée depuis) — elle serait sinon cachée derrière.
export function opsNote(notes, paire, texte, { cleNum = cleNumNote, maintenant = new Date().toISOString() } = {}) {
  const cur = notes && typeof notes === 'object' ? notes : {};
  const cle = cleEcriture(paire, cleNum);
  if (!cle) return [];
  const t = nettoyerNote(texte);
  const ops = [];
  const avant = cur[cle];
  if (t) {
    if (!(estNote(avant) && nettoyerNote(avant.t) === t)) ops.push({ k: CLE_NOTES_PAIRES, type: 'cle', id: cle, apres: { t, at: maintenant }, avant });
  } else if (avant !== undefined) {
    ops.push({ k: CLE_NOTES_PAIRES, type: 'cle', id: cle, apres: undefined, avant });
  }
  if (cle.startsWith('n:')) {
    for (const k of clesPaire(paire, cleNum).filter((x) => x.startsWith('a:'))) {
      if (cur[k] !== undefined) ops.push({ k: CLE_NOTES_PAIRES, type: 'cle', id: k, apres: undefined, avant: cur[k] });
    }
  }
  return ops;
}

// La carte telle qu'elle se garde : seules les clés n:/a: et les notes valides.
export function notesPropres(v) {
  const out = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const [k, x] of Object.entries(v)) {
    if (!/^(n:[0-9A-Z]{1,12}|a:\d{3,})$/.test(k) || !estNote(x)) continue;
    out[k] = { t: nettoyerNote(x.t), at: typeof x.at === 'string' ? x.at : '' };
  }
  return out;
}

// Un N° est-il porté par deux paires PRÉSENTES ? `fiches` = vinted_annonce_numeros
// ({ itemId: { numero, recreeDe?, repriseDe? } }), `presents` = Set des id d'annonces
// présentes (ou null : pas su ⇒ toutes comptent, prudence). Une chaîne de
// republication (recreeDe / repriseDe) est UNE paire.
// (14 nov., proposition 107) `memes` : les paires d'annonces qu'IL a fusionnées (src/fusionFiches.js) — une paire.
export function numerosAmbigus(fiches, { presents = null, cleNum = cleNumNote, memes = null } = {}) {
  const parNum = new Map();
  for (const [id, f] of Object.entries(fiches || {})) {
    if (!f || f.numero == null) continue;
    const k = cleNum(f.numero); if (!k) continue;
    if (presents && !presents.has(String(id))) continue;
    if (!parNum.has(k)) parNum.set(k, []);
    parNum.get(k).push({ id: String(id), de: [f.recreeDe, f.repriseDe].filter(Boolean).map(String) });
  }
  const out = new Set();
  for (const [k, l] of parNum) {
    if (l.length < 2) continue;
    // Union des chaînes : deux fiches reliées par recreeDe/repriseDe = la même paire.
    const ids = new Set(l.map((x) => x.id));
    const racine = new Map(l.map((x) => [x.id, x.id]));
    const trouve = (x) => { while (racine.get(x) !== x) x = racine.get(x); return x; };
    for (const x of l) for (const d of x.de) if (ids.has(d)) racine.set(trouve(x.id), trouve(d));
    for (const m of Array.isArray(memes) ? memes : []) { if (Array.isArray(m) && m.length === 2 && ids.has(String(m[0])) && ids.has(String(m[1]))) racine.set(trouve(String(m[0])), trouve(String(m[1]))); }
    if (new Set(l.map((x) => trouve(x.id))).size > 1) out.add(k);
  }
  return out;
}
