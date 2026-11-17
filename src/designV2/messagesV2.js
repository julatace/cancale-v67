// ════════════════════════════════════════════════════════════════════════════
//  MESSAGES ET E-MAILS, NOUVEAU DESIGN (17 nov.) — règles PURES (ni React, ni réseau, ni stockage).
//
//  1. `groupesParCompte` — CLAUDE.md §3 « Messages, comptes » (12 nov., Julien) : les comptes SÉPARÉS ;
//     le compte de l'onglet d'abord, puis CHAQUE autre compte (celui dont la conversation est la plus récente
//     d'abord) ; DANS chaque groupe, du plus récent au plus ancien (horodatage lu, `msDe`) ; sans date lue ⇒ en
//     bas de SON groupe. Jamais deux comptes mélangés dans un groupe. La même règle que Messages · Tous
//     (src/ecrans/FilsTous.jsx), appliquée à la liste Vinted.
//  2. Les segments de la boîte e-mails : « À traiter · Colis · Ventes · Achats · Tout », posés sur les filtres
//     EXISTANTS de la boîte (la rubrique servie par la route, l'état « à vérifier ») — aucun nouveau classement :
//     « À traiter » = les e-mails que VRM n'a pas su ranger (« à vérifier », §5 : un colis douteux y va, visible).
//  3. `numeroEmail` — le N° d'un e-mail, seulement LU dans l'e-mail (identité, §5) ; un N° retrouvé par le titre
//     (`nt`) n'est jamais écrit.
//  4. `rangerEmails` — « Ranger » (glisser à gauche) : une marque sur l'e-mail, jamais une suppression. Un e-mail
//     rangé reste dans la liste, replié en bas de SA vue (« Rangés · N »), et dans les nombres (rien n'est jeté).
// ════════════════════════════════════════════════════════════════════════════
import { msDe } from '../ordreRecent.js';

export function groupesParCompte(liste, { uidDe, quand, compteOnglet = '', nomDe = () => '' } = {}) {
  const L = Array.isArray(liste) ? liste : [];
  const m = new Map();
  for (const c of L) {
    const u = String(uidDe(c) == null ? '' : uidDe(c));
    if (!m.has(u)) m.set(u, { uid: u, nom: nomDe(c) || '', onglet: !!compteOnglet && u === String(compteOnglet), convs: [] });
    m.get(u).convs.push(c);
  }
  const t = (c) => { const v = msDe(quand(c)); return v == null ? -Infinity : v; };
  const groupes = [...m.values()].map((g) => {
    // Stable à date égale : l'ordre reçu départage.
    const convs = g.convs.map((c, i) => [c, t(c), i]).sort((a, b) => (b[1] - a[1]) || (a[2] - b[2])).map((x) => x[0]);
    return { ...g, convs, dernier: convs.length ? t(convs[0]) : -Infinity };
  });
  groupes.sort((a, b) => (Number(b.onglet) - Number(a.onglet)) || (b.dernier - a.dernier) || a.uid.localeCompare(b.uid));
  return groupes;
}

// Les cinq segments de la boîte, dans l'ordre d'affichage.
export const SEGMENTS_EMAILS = ['atraiter', 'colis', 'ventes', 'achats', 'tout'];
// Le segment ⇒ les filtres d'hier ({ rubrique, aVerif }).
export function filtresDuSegment(seg) {
  switch (seg) {
    case 'atraiter': return { rubrique: '', aVerif: true };
    case 'colis': return { rubrique: 'colis', aVerif: false };
    case 'ventes': return { rubrique: 'ventes', aVerif: false };
    case 'achats': return { rubrique: 'achats', aVerif: false };
    default: return { rubrique: '', aVerif: false };
  }
}
// Les filtres d'hier ⇒ le segment montré (une rubrique hors segment — codes, offres, autres — n'en allume aucun).
export function segmentDesFiltres({ rubrique = '', aVerif = false } = {}) {
  if (aVerif && !rubrique) return 'atraiter';
  if (aVerif) return '';
  if (!rubrique) return 'tout';
  return ['colis', 'ventes', 'achats'].includes(rubrique) ? rubrique : '';
}

// Le N° LU dans l'e-mail (`lecture` = `lectureEmail(e)`, `resume` = le résumé rangé), sinon null.
export function numeroEmail(lecture, resume) {
  if (lecture && lecture.num) return String(lecture.num);
  const r = resume && typeof resume === 'object' ? resume : null;
  if (r && r.n && !r.nt && (r.t === 'bordereau' || r.t === 'vente')) return String(r.n);
  return null;
}

// Les rangés : { id: date }. `ranger(etat, id, oui)` rend un NOUVEL objet (jamais muté).
export function rangerEmails(etat, id, oui, maintenant = new Date().toISOString()) {
  const n = { ...(etat && typeof etat === 'object' ? etat : {}) };
  const k = String(id || '');
  if (!k) return n;
  if (oui) n[k] = maintenant; else delete n[k];
  return n;
}
export const estRange = (etat, id) => !!(etat && typeof etat === 'object' && id != null && etat[String(id)]);
// Coupe une liste d'éléments de la boîte (e-mails ou piles) en { visibles, ranges } ; une pile est rangée quand
// TOUS ses e-mails le sont. L'ordre est gardé dans chaque part.
export function separerRanges(items, etat, idDe = (it) => (it && it.e ? it.e.id : null), emailsDe = (it) => (it && it.emails) || null) {
  const visibles = [], ranges = [];
  for (const it of Array.isArray(items) ? items : []) {
    const em = emailsDe(it);
    const r = em ? em.length > 0 && em.every((x) => estRange(etat, x && x.id)) : estRange(etat, idDe(it));
    (r ? ranges : visibles).push(it);
  }
  return { visibles, ranges };
}
