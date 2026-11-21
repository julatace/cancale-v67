// ════════════════════════════════════════════════════════════════════════════
//  L'ORDRE DES CONVERSATIONS — la règle `ordreRecent` (src/ordreRecent.js, lot AJ)
//  appliquée à Messages, sur toutes ses vues (11 nov., demande de Julien :
//  « tu ne fais pas du plus récent au plus vieux, c'est assez bizarre »).
//
//  Avant : la liste Vinted mettait devant les conversations « à répondre » puis
//  celles avec une offre, et seulement ensuite la date — « geme3 · 14 oct. ·
//  Vente annulée » passait devant les messages du jour, sans un mot.
//  Maintenant :
//   · le plus récent EN HAUT, par l'HORODATAGE lu (`msDe`, jamais le texte
//     affiché), stable à date égale ; sans date lue ⇒ EN BAS, et l'écran le dit ;
//   · un seul regroupement permis, et il est dit dans un en-tête : le compte
//     ouvert dans l'onglet d'abord (là où VRM peut répondre), les autres en
//     lecture seule ensuite (`groupe`). Rien d'autre ne passe devant ;
//   · la même conversation captée deux fois dans la même boîte (mesuré sur la
//     base le 11 nov. : 30 sur 3 200, dont 5 à deux dates) n'est listée
//     qu'UNE fois, la copie la plus fraîche (`sansDoublons`).
//  Règle pure : ni React, ni réseau, ni stockage (scripts/audit-ordre-messages.cjs).
// ════════════════════════════════════════════════════════════════════════════
import { msDe, ordreRecent, nbSansDate } from './ordreRecent.js';

export const instantLu = msDe;

// Le plus récent en haut. `groupe(c)` (facultatif) rend un rang : 0 d'abord.
export function trierRecents(liste, quand, groupe) {
  const L = Array.isArray(liste) ? liste : [];
  if (!groupe) return ordreRecent(L, quand);
  const rangs = [...new Set(L.map((c) => Number(groupe(c)) || 0))].sort((a, b) => a - b);
  return rangs.flatMap((r) => ordreRecent(L.filter((c) => (Number(groupe(c)) || 0) === r), quand));
}

export const sansDate = (liste, quand) => nbSansDate(liste, quand);

// La même conversation (même clé) deux fois : une ligne, la copie la plus fraîche,
// à la place de la première rencontrée.
export function sansDoublons(liste, cle, quand) {
  const src = Array.isArray(liste) ? liste : [];
  const meilleure = new Map();
  for (const c of src) {
    const k = cle(c);
    if (k == null || k === '') continue;
    const t = msDe(quand(c)), avant = meilleure.get(k);
    if (!avant || (t != null && (avant.t == null || t > avant.t))) meilleure.set(k, { t, c });
  }
  const vus = new Set(), out = [];
  for (const c of src) {
    const k = cle(c);
    if (k == null || k === '') { out.push(c); continue; }
    if (vus.has(k)) continue;
    vus.add(k); out.push(meilleure.get(k).c);
  }
  return out;
}

// L'heure d'une ligne de liste, comme une messagerie : « 19:52 » aujourd'hui,
// « hier », sinon « 14 oct. » (l'année si ce n'est pas celle-ci). Pas su ⇒ ''.
export function heureListe(t, maintenant = Date.now()) {
  const x = msDe(t);
  if (x == null) return '';
  const d = new Date(x), auj = new Date(maintenant);
  const jour = (y) => `${y.getFullYear()}-${y.getMonth()}-${y.getDate()}`;
  if (jour(d) === jour(auj)) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const hier = new Date(auj); hier.setDate(auj.getDate() - 1);
  if (jour(d) === jour(hier)) return 'hier';
  const o = { day: 'numeric', month: 'short' };
  if (d.getFullYear() !== auj.getFullYear()) o.year = 'numeric';
  return d.toLocaleDateString('fr-FR', o);
}
