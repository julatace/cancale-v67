// ── OÙ RANGER À L'ARRIVÉE (5 nov. 2026, chantier H) ───────────────────────────
// Quand un ACHAT passe à « Arrivés », la cloche propose UNE case : la première
// case libre du Stock (« Mes meubles », la 2D), et mène à « Ranger ». Une
// notification DANS la cloche seulement — jamais une notification de plus sur
// le téléphone (rien n'est envoyé au serveur).
//
// Module PUR (aucun accès au navigateur ni à la base) : la cloche
// (`CentreNotifsCoque`, App.jsx) et `scripts/audit-ou-ranger.cjs` exécutent les
// MÊMES fonctions (§11).
//
// ⚠️ LES RÈGLES DU STOCK, PAS UNE COPIE : les cases d'un meuble sont
//    `cols × rows`, la place d'une case se dit par `placeCase` (src/stockSortie.js),
//    les planches par `planchesCases` (src/stockRegles.js). Un meuble « empilé »
//    (`gravite`) : un article pose sur celui du dessous — une case n'y est
//    proposée que si elle est la plus basse libre de son segment (sinon l'article
//    tomberait ailleurs que là où on l'a dit).
// ⚠️ « PAS SU » N'EST PAS « LIBRE » : meubles ou cases pas lus (`null`,
//    `undefined`, autre chose qu'une liste/un objet) ⇒ `null`, RIEN n'est proposé.
//    Une case notée pour un N° — même un N° qui n'est plus une annonce actuelle —
//    est PRISE (un carton peut y être). Aucun meuble ⇒ `null` aussi : on ne
//    propose jamais une case qui n'existe pas.
// ⚠️ L'ACHAT ARRIVÉ se juge par la règle des achats (`estArrive`, passée par
//    l'app : `phaseAchat(status) === 'completed'`), et seulement sur une
//    TRANSITION vue : un achat vu « en route » puis « arrivé ». La première
//    lecture (rien vu avant) ne propose rien — sinon 300 achats reçus depuis des
//    mois arriveraient d'un coup. L'identité d'un achat : son n° de transaction
//    (§5), jamais son titre.

import { placeCase } from './stockSortie.js';
import { planchesCases } from './stockRegles.js';

const estListe = Array.isArray;
const estObjet = (o) => !!o && typeof o === 'object' && !Array.isArray(o);

// La première case libre, dans l'ordre des meubles puis de lecture (rangée du
// haut d'abord, de gauche à droite). Rend { meubleId, meuble, i, rangee, colonne }
// ou null (pas su, aucun meuble, tout est plein).
export function premiereCaseLibre({ meubles, slots } = {}) {
  if (!estListe(meubles) || !estObjet(slots)) return null;
  const prises = new Set();
  for (const k of Object.keys(slots)) {
    const s = slots[k];
    if (s && s.m != null && Number.isInteger(Number(s.i))) prises.add(String(s.m) + ':' + Number(s.i));
  }
  for (const m of meubles) {
    if (!m || m.id == null) continue;
    const cols = Math.max(1, Number(m.cols) || 1), rows = Math.max(1, Number(m.rows) || 1);
    const prise = (i) => prises.has(String(m.id) + ':' + i);
    const planches = m.gravite ? planchesCases(m.planches, cols, rows) : null;
    for (let i = 0; i < cols * rows; i++) {
      if (prise(i)) continue;
      if (planches) {
        // Empilé : la case doit être le fond de son segment, ou poser sur une case prise.
        const r = Math.floor(i / cols), c = i % cols;
        const fond = r === rows - 1 || planches.has((r + 1) + ':' + (c + 1));
        if (!fond && !prise((r + 1) * cols + c)) continue;
      }
      const p = placeCase(i, m);
      return { meubleId: String(m.id), meuble: String(m.name || 'Meuble'), i, rangee: p.rangee, colonne: p.colonne };
    }
  }
  return null;
}

// La case dite en mots : « Étagère A · rangée 1, colonne 3 ».
export const caseEnMots = (c) => (c ? `${c.meuble} · rangée ${c.rangee}, colonne ${c.colonne}` : '');

// Les achats qui VIENNENT d'arriver, par rapport à ce que l'appareil avait vu.
//   achats   : [{ transaction_id, title, status, … }] | null (pas su)
//   vus      : { [tx]: 'arrive' | 'autre' } | null (rien vu sur cet appareil)
//   estArrive: (achat) => boolean — la règle des achats de l'app
// Rend { arrives: [achat], vus } — `vus` est le nouvel état à garder. Pas su
// (`achats` null) ⇒ rien d'arrivé, `vus` inchangé. Première fois (`vus` null)
// ⇒ on retient l'état, rien d'arrivé.
export function achatsArrives({ achats, vus, estArrive } = {}) {
  if (!estListe(achats) || typeof estArrive !== 'function') return { arrives: [], vus: estObjet(vus) ? vus : null };
  const avant = estObjet(vus) ? vus : null;
  const apres = {}, arrives = [];
  for (const a of achats) {
    const tx = a && a.transaction_id != null ? String(a.transaction_id) : '';
    if (!tx) continue;
    const etat = estArrive(a) ? 'arrive' : 'autre';
    apres[tx] = etat;
    if (avant && etat === 'arrive' && avant[tx] === 'autre') arrives.push(a);
  }
  // Ce qui était déjà arrivé ET pas encore rangé (proposé, pas encore « fait »)
  // reste retenu tel quel par l'appelant (`proposes`).
  return { arrives, vus: apres };
}

// Les notifications de la cloche : une par achat arrivé, avec LA case proposée
// (la même pour toutes : on ne propose qu'une case à la fois — la suivante après
// qu'il a rangé). Pas de case sue ⇒ aucune notification (rien à proposer).
//   proposes : { [tx]: { tx, titre, at, fait? } } — ce que la cloche garde
export function notifsOuRanger({ proposes, caseLibre } = {}) {
  if (!caseLibre || !estObjet(proposes)) return [];
  return Object.values(proposes)
    .filter((p) => p && p.tx && !p.fait)
    .sort((a, b) => (Number(b.at) || 0) - (Number(a.at) || 0))
    .map((p) => ({ tx: String(p.tx), titre: String(p.titre || ''), at: Number(p.at) || 0, case: caseLibre, ou: caseEnMots(caseLibre) }));
}
