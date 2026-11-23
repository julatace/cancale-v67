// ── OÙ RANGER UN ARTICLE (5 nov. 2026, chantier H ; 15 nov. : l'ARTICLE, plus l'achat) ──────
// (15 nov., Julien, sur la capture de la cloche : « Enlève ça, on range une ANNONCE, pas un achat ».)
// La cloche proposait « Arrivé · Première case libre · Ranger » pour CHAQUE achat arrivé — la même case à
// tous. C'est retiré (`achatsArrives`, `notifsOuRanger` n'existent plus) : un achat ne se range pas. Ce qui
// se range, c'est l'ARTICLE numéroté (sa fiche, au Stock), et chaque article sans case reçoit SA case
// proposée, jamais celle proposée à un autre au même moment (`casesProposees`).
//
// Module PUR (aucun accès au navigateur ni à la base) : le Stock (src/ecrans/Stock.jsx),
// `scripts/audit-coque-parametres.cjs` et `scripts/audit-pas-ranger-achat.cjs` exécutent les MÊMES
// fonctions (§11).
//
// ⚠️ LES RÈGLES DU STOCK, PAS UNE COPIE : les cases d'un meuble sont
//    `cols × rows`, la place d'une case se dit par `placeCase` (src/stockSortie.js),
//    les planches par `planchesCases` (src/stockRegles.js). Un meuble « empilé »
//    (`gravite`, ou une colonne en pile) : un article pose sur celui du dessous — une case n'y est
//    proposée que si elle est la plus basse libre de son segment (sinon l'article
//    tomberait ailleurs que là où on l'a dit).
// ⚠️ « PAS SU » N'EST PAS « LIBRE » : meubles ou cases pas lus (`null`,
//    `undefined`, autre chose qu'une liste/un objet) ⇒ `null`, RIEN n'est proposé.
//    Une case notée pour un N° — même un N° qui n'est plus une annonce actuelle —
//    est PRISE (un carton peut y être). Aucun meuble ⇒ `null` aussi : on ne
//    propose jamais une case qui n'existe pas.
// ⚠️ L'IDENTITÉ d'un article est sa clé de N° (`cleNum`, passée par l'appelant), jamais son titre.

import { placeCase } from './stockSortie.js';
import { planchesCases } from './stockRegles.js';
import { aDesPiles, colonneEnPile } from './stockEtageres.js';   // (15 nov.) une colonne peut être en pile sans tout le meuble

const estListe = Array.isArray;
const estObjet = (o) => !!o && typeof o === 'object' && !Array.isArray(o);

const casesPrises = (slots) => {
  const prises = new Set();
  for (const k of Object.keys(slots)) {
    const s = slots[k];
    if (s && s.m != null && Number.isInteger(Number(s.i))) prises.add(String(s.m) + ':' + Number(s.i));
  }
  return prises;
};
// La première case libre d'UN meuble, en ordre de lecture (rangée du haut d'abord, de gauche à droite).
function libreDans(m, prises) {
  const cols = Math.max(1, Number(m.cols) || 1), rows = Math.max(1, Number(m.rows) || 1);
  const prise = (i) => prises.has(String(m.id) + ':' + i);
  const planches = (m.gravite || aDesPiles(m)) ? planchesCases(m.planches, cols, rows) : null;
  for (let i = 0; i < cols * rows; i++) {
    if (prise(i)) continue;
    if (planches && colonneEnPile(m, (i % cols) + 1)) {
      // Empilé : la case doit être le fond de son segment, ou poser sur une case prise.
      const r = Math.floor(i / cols), c = i % cols;
      const fond = r === rows - 1 || planches.has((r + 1) + ':' + (c + 1));
      if (!fond && !prise((r + 1) * cols + c)) continue;
    }
    const p = placeCase(i, m);
    return { meubleId: String(m.id), meuble: String(m.name || 'Meuble'), i, rangee: p.rangee, colonne: p.colonne };
  }
  return null;
}

// La première case libre, dans l'ordre des meubles puis de lecture. Rend { meubleId, meuble, i, rangee, colonne }
// ou null (pas su, aucun meuble, tout est plein).
export function premiereCaseLibre({ meubles, slots } = {}) {
  if (!estListe(meubles) || !estObjet(slots)) return null;
  const prises = casesPrises(slots);
  for (const m of meubles) {
    if (!m || m.id == null) continue;
    const c = libreDans(m, prises);
    if (c) return c;
  }
  return null;
}

// (15 nov.) UNE CASE PAR ARTICLE, JAMAIS LA MÊME À DEUX. `cles` : les articles à ranger (leur clé de N°), dans
// l'ordre où l'écran les montre. Chacun reçoit la première case libre qui n'est pas déjà proposée à un article
// d'avant (une case proposée compte comme prise — dans un meuble empilé, la suivante est alors celle du dessus).
// Rend { [cle]: case | null } (null = plus aucune case libre pour lui), ou null (pas su : meubles ou cases pas
// lus). Une clé vide ou en double n'a qu'une proposition (la première) : un article, une case.
export function casesProposees({ meubles, slots, cles } = {}) {
  if (!estListe(meubles) || !estObjet(slots) || !estListe(cles)) return null;
  const prises = casesPrises(slots);
  const ms = meubles.filter((m) => m && m.id != null);
  const out = {};
  let plein = !ms.length, k0 = 0;   // k0 : le premier meuble qui peut encore avoir une case libre
  for (const c of cles) {
    const cle = String(c == null ? '' : c);
    if (!cle || Object.prototype.hasOwnProperty.call(out, cle)) continue;
    let pose = null;
    while (!plein && k0 < ms.length) {
      pose = libreDans(ms[k0], prises);
      if (pose) break;
      k0++;   // ce meuble est plein (une case proposée n'en libère jamais une autre)
    }
    if (!pose) { plein = true; out[cle] = null; continue; }
    prises.add(pose.meubleId + ':' + pose.i);
    out[cle] = pose;
  }
  return out;
}

// (17 nov., lot stock-rangement) LA DERNIÈRE PLACE UTILISÉE : pendant une séance « Ranger », la case proposée à
// l'article suivant est la première libre du MEUBLE où il vient de poser (il range carton après carton au même
// endroit) — une proposition, jamais une obligation (« Autre place » reste à côté). Même règle de case libre que
// `premiereCaseLibre` (`libreDans` : piles et planches comprises). Rend la case, ou null (pas su, meuble inconnu, plein).
export function caseLibreDans({ meubles, slots, meubleId } = {}) {
  if (!estListe(meubles) || !estObjet(slots) || meubleId == null) return null;
  const m = meubles.find((x) => x && x.id != null && String(x.id) === String(meubleId));
  return m ? libreDans(m, casesPrises(slots)) : null;
}

// La case dite en mots : « Étagère A · rangée 1, colonne 3 ».
export const caseEnMots = (c) => (c ? `${c.meuble} · rangée ${c.rangee}, colonne ${c.colonne}` : '');
