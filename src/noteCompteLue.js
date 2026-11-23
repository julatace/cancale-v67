// ══════════════════════════════════════════════════════════════════════════════
//  LA NOTE DE SANTÉ D'UN COMPTE, LUE PAR L'APP (22 nov. 2026, ext. 5.438.0) — « Mes comptes »
// ══════════════════════════════════════════════════════════════════════════════
// L'extension calcule la note (la règle <sante-note-regle> de src/santeNote.js) et la publie dans la ligne de la jauge de
// CHAQUE navigateur (`actions_compte_{uid}_{nav}` · `data.note`, avec `data.at`). L'app n'en refait aucun calcul : elle
// lit la note la PLUS FRAÎCHE de ce compte (tous ses navigateurs), et la dit avec sa raison. Pas de ligne, ligne sans
// note (extension d'avant), note `n: null` ⇒ `null` (« pas su », l'écran dit « — »), jamais un 100 inventé. Une note
// lue il y a plus de 24 h est dite « ancienne » (date montrée).
// Module PUR (aucun réseau) : exécuté par scripts/audit-ext-5438.cjs.
export const NOTE_SELECT = 'id,at:data->>at,note:data->note';
export const NOTE_VIEILLE_MS = 24 * 3600000;
const RE_LIGNE = /^actions_compte_(\d{1,20})_/;

// { [uid]: { n, pct, cap, fav, prec, ph, raison, pts, manque, at, vieille } } — seulement les comptes dont une note est LUE.
export function notesDesLignes(rows, maintenant = Date.now()) {
  if (!Array.isArray(rows)) return null;
  const out = {};
  for (const r of rows) {
    const m = RE_LIGNE.exec(String((r && r.id) || ''));
    if (!m) continue;
    const n = r.note && typeof r.note === 'object' ? r.note : null;
    if (!n || n.n == null || !Number.isFinite(Number(n.n))) continue;
    const at = Date.parse(r.at || '') || Number(n.at) || 0;
    const cur = out[m[1]];
    if (cur && cur.at >= at) continue;
    out[m[1]] = {
      n: Math.max(0, Math.min(100, Math.round(Number(n.n)))),
      pct: Number(n.pct) > 0 ? Number(n.pct) : 100,
      cap: Number(n.cap) > 0 ? Number(n.cap) : null,
      fav: Number(n.fav) > 0 ? Number(n.fav) : null,
      prec: n.prec === true,
      reduite: n.reduite === true,
      ph: typeof n.ph === 'string' ? n.ph : 'normale',
      raison: n.raison && typeof n.raison === 'object' ? { k: String(n.raison.k || ''), n: Number(n.raison.n) || 0, h: Number(n.raison.h) || 24, pct: n.raison.pct != null ? Number(n.raison.pct) : null } : null,
      pts: (Array.isArray(n.pts) ? n.pts : []).filter((p) => p && typeof p.k === 'string').slice(0, 10).map((p) => ({ k: p.k, n24: Number(p.n24) || 0, n72: Number(p.n72) || 0, r: Number(p.r) || 0 })),
      manque: (Array.isArray(n.manque) ? n.manque : []).filter((k) => typeof k === 'string').slice(0, 5),
      at,
      vieille: at > 0 && maintenant - at > NOTE_VIEILLE_MS,
    };
  }
  return out;
}
// La phrase (clé de traduction + valeurs) : « Cadence réduite à 30/h : 2 vérifications demandées en 24 h ».
export function phraseNote(x) {
  if (!x) return { cle: 'adist.note.passu', v: {} };
  const r = x.raison;
  const raison = r && r.k ? (r.k === 'vues' ? { cle: 'adist.note.raisonVues', v: { pct: r.pct != null ? r.pct : '—' } } : { cle: 'adist.note.raison', v: { n: r.n, k: 'adist.note.k.' + r.k, h: r.h } }) : null;
  if (x.ph === 'reduite' || x.ph === 'reduite_precieux' || x.ph === 'precieux') return { cle: 'adist.note.ph.' + x.ph, v: { cap: x.cap }, raison };
  return { cle: 'adist.note.ph.normale', v: { cap: x.cap }, raison: null };
}
