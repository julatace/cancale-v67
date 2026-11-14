// ════════════════════════════════════════════════════════════════════════════
//  LA NOTE DE CHAQUE ANNONCE (14 nov., idée 155 — demandée par Julien)
// ════════════════════════════════════════════════════════════════════════════
// Pour chaque annonce EN LIGNE : ce qui manque, et une note simple
// (« 3 points à corriger »). Un toucher emmène à la correction.
//
// UNE règle, composée — jamais recopiée (§11) : les manques d'Annonces →
// « À compléter » (`manquesAnnonce`, src/annoncesACompleter.js : moins de 5 photos,
// titre / prix / description / marque / taille / état vides, N° absent de la fin
// de la description selon src/numeroEcrit.js, prix d'achat manquant) PLUS deux
// points que Julien a demandés :
//   · « description courte » : LUE, non vide, de moins de DESC_COURTE caractères
//     (80 : moins de deux lignes sur Vinted — taille, état, défauts, envoi ne
//     tiennent pas dedans). Pas lue ⇒ rien n'est dit (§5 « pas su ≠ manque »).
//   · « prix sous le prix d'achat » : SEULEMENT si le prix d'achat est saisi par
//     lui (§2.5, `prixAchatDe`) ET le prix de l'annonce lu. Sans prix d'achat, le
//     point est « prix d'achat manquant » (le manque 'achat' d'avant) — jamais un
//     prix deviné.
// Lecture seule de ce que VRM a DÉJÀ lu (le dressing, `descLen` posé par
// l'extension, la fiche) : aucune requête de plus, rien envoyé à Vinted.
// Module PUR : la vue (src/AnnoncesACompleter.jsx) et scripts/audit-idees-paires.cjs.
// ════════════════════════════════════════════════════════════════════════════
import { manquesAnnonce, lienModifier, MANQUES, OU_MANQUE, texteManque as texteManqueBase } from '../annoncesACompleter.js';

export const DESC_COURTE = 80;
// L'ordre des points : ceux d'« À compléter », la description courte après la
// description vide, le prix sous l'achat après le prix d'achat manquant.
export const POINTS = (() => {
  const l = MANQUES.slice();
  l.splice(l.indexOf('description') + 1, 0, 'courte');
  l.push('sousAchat');
  return l;
})();
export const OU_POINT = { ...OU_MANQUE, courte: 'vinted', sousAchat: 'vinted' };

const prixDe = (p) => { const v = p && typeof p === 'object' ? p.amount : p; const f = parseFloat(String(v == null ? '' : v).replace(',', '.')); return Number.isFinite(f) && f > 0 ? f : null; };
const longueurLue = (a) => (typeof a.desc === 'string' ? a.desc.trim().length : (typeof a.descLen === 'number' && Number.isFinite(a.descLen) && a.descLen >= 0 ? a.descLen : null));

// UNE annonce ⇒ { points: [{ cle, ... }], pasSu: [cle] } (même forme que `manquesAnnonce`).
export function pointsAnnonce(a, opts = {}) {
  const r = manquesAnnonce(a, opts);
  const points = r.manques.slice(), pasSu = r.pasSu.slice();
  if (a && typeof a === 'object') {
    const n = longueurLue(a);
    const min = Number.isFinite(opts.descCourte) ? opts.descCourte : DESC_COURTE;
    if (n == null) { if (!pasSu.includes('description')) pasSu.push('description'); }
    else if (n > 0 && n < min) points.push({ cle: 'courte', n, min });
    const prix = prixDe(a.prix), achat = typeof a.prixAchat === 'number' && Number.isFinite(a.prixAchat) ? a.prixAchat : null;
    if (prix != null && achat != null && prix < achat) points.push({ cle: 'sousAchat', prix, achat });
  }
  points.sort((x, y) => POINTS.indexOf(x.cle) - POINTS.indexOf(y.cle));
  return { points, pasSu };
}

// La note : le nombre de points à corriger (0 = rien).
export const noteDe = (points) => (Array.isArray(points) ? points.length : 0);

// Le premier geste de correction : 'vinted' (la page « modifier » de l'annonce, par son
// identifiant) ou 'achat' (la saisie du prix d'achat dans VRM). Une annonce sans
// identifiant lisible n'a pas de lien : son geste est 'achat' ou rien.
export function premierGeste(item) {
  const p = item && Array.isArray(item.manques) ? item.manques : [];
  const v = p.find((m) => OU_POINT[m.cle] === 'vinted');
  if (v && item.lien) return { ou: 'vinted', cle: v.cle, lien: item.lien };
  if (p.some((m) => m.cle === 'achat')) return { ou: 'achat', cle: 'achat' };
  return null;
}

// TOUTES les annonces en ligne — la MÊME forme que `annoncesACompleter` (la vue la
// rend telle quelle) : { etat, total, n, items: [{ ..., manques, note }], parManque, pasSu }.
export function notesAnnonces(annonces, opts = {}) {
  if (annonces === undefined) return { etat: 'encours' };
  if (!Array.isArray(annonces)) return { etat: 'passu' };
  const items = [], parManque = {}, pasSu = {}, vus = new Set();
  let total = 0;
  for (const a of annonces) {
    if (!a || a.id == null) continue;
    const id = String(a.id);
    if (vus.has(id)) continue;
    vus.add(id); total++;
    const r = pointsAnnonce(a, opts);
    for (const k of r.pasSu) pasSu[k] = (pasSu[k] || 0) + 1;
    if (!r.points.length) continue;
    for (const m of r.points) parManque[m.cle] = (parManque[m.cle] || 0) + 1;
    items.push({
      id, titre: String(a.titre || ''), photo: String(a.photo || ''), num: String(a.num || ''), compte: String(a.compte || ''),
      prix: prixDe(a.prix), ts: Number(a.ts) || 0, manques: r.points, note: noteDe(r.points),
      vinted: r.points.some((m) => OU_POINT[m.cle] === 'vinted'), achat: r.points.some((m) => m.cle === 'achat'),
      brouillon: r.points.some((m) => m.cle === 'titre' || m.cle === 'prix' || m.cle === 'description'),
      lien: lienModifier(id, a.domaine),
    });
  }
  // La plus mal notée d'abord (le plus de points), puis la plus récente, puis l'identifiant.
  items.sort((x, y) => (y.note - x.note) || (y.ts - x.ts) || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  return { etat: 'lu', total, n: items.length, items, parManque, pasSu, note: true };
}

// Le texte d'un point (les deux neufs passent par la clé donnée ; les autres : la règle d'avant).
export function textePoint(m, tr) {
  if (!m) return '';
  if (m.cle === 'courte') return tr('na.courte', { n: m.n, min: m.min });
  if (m.cle === 'sousAchat') return tr('na.sousAchat');
  return texteManqueBase(m);
}
