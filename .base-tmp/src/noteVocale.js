// ══════════════════════════════════════════════════════════════════════════════
//  LA NOTE VOCALE D'UNE PAIRE (14 nov., proposition 105 — validée par Julien)
// ══════════════════════════════════════════════════════════════════════════════
// Il parle (« petite tache semelle gauche ») : le TÉLÉPHONE écrit, et le texte rejoint la
// note privée de la paire (src/notePaire.js — par identité : N°, sinon annonce).
//   · LA RECONNAISSANCE DU NAVIGATEUR SEULEMENT (Web Speech API, le moteur de la loupe,
//     src/dicteeNavigateur.js) : aucun son enregistré ni envoyé par VRM, aucune clé,
//     aucun serveur à nous (§2.9). Sans reconnaissance (Firefox, certains Safari), ou
//     micro refusé : le bouton le DIT (`raisonSansDictee`), il ne fait pas semblant ;
//   · dans la langue de VRM (Paramètres → Langue) ;
//   · le texte dicté s'AJOUTE à la note (jamais il ne l'écrase), dans la limite de la
//     note (200 caractères) : ce qui dépasse est dit, pas coupé en silence.
// Module PUR : exécuté tel quel par scripts/audit-note-vocale.cjs.
// ══════════════════════════════════════════════════════════════════════════════
import { NOTE_MAX, nettoyerNote } from './notePaire.js';

// La note après la dictée : { texte, coupe } (`coupe` : la dictée ne tenait pas en entier).
export function ajouterDictee(ancienne, dictee, max = NOTE_MAX) {
  const a = nettoyerNote(ancienne || ''), d = String(dictee == null ? '' : dictee).replace(/\s+/g, ' ').trim();
  if (!d) return { texte: a, coupe: false, vide: true };
  const sep = a ? (/[.!?…]$/.test(a) ? ' ' : ' · ') : '';
  const voulu = a + sep + d.charAt(0).toUpperCase() + d.slice(1);
  const lettres = Array.from(voulu);
  if (lettres.length <= max) return { texte: nettoyerNote(voulu), coupe: false };
  return { texte: nettoyerNote(lettres.slice(0, max).join('')), coupe: true };
}

// Pourquoi il n'y a pas de dictée ici, ou null (elle est là).
//   `api` : la reconnaissance existe dans ce navigateur ; `refus` : le micro a été refusé.
export function raisonSansDictee({ api, refus }) {
  if (!api) return 'navigateur';
  if (refus) return 'refus';
  return null;
}
