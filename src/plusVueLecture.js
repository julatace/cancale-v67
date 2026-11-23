// ── LA LECTURE DES RELEVÉS POUR « PLUS VUE » (22 nov., choix n° 27) ─────────────────────────────────────────────────────
// Les relevés quotidiens `vinted_suivi_{uid}` des annonces EN LIGNE seulement, lus PROJETÉS par 60 (`lireSeries`, jamais
// la ligne entière, CLAUDE.md §4.4), un compte après l'autre, après la liste (l'écran est déjà peint). Gardés 10 min dans
// la page. Une lecture ratée d'un compte ⇒ ses annonces restent « pas su » (aucune étiquette), jamais « vue ».
// Rend { [uid]: { [id]: texte } } (une annonce sans relevé : absente) — un compte pas lu n'y est pas.
import { lireSeries } from './boostLecture.js';

const MEMO = new Map();   // uid → { at, ids: Set, series }
const DUREE = 10 * 60000;

export async function lireRelevesEnLigne(base, parCompte, { maintenant = Date.now() } = {}) {
  const out = {};
  for (const [uid, ids0] of Object.entries(parCompte || {})) {
    if (!/^\d{1,20}$/.test(uid)) continue;
    const ids = [...new Set((ids0 || []).map(String).filter((x) => /^\d{1,15}$/.test(x)))].slice(0, 1500);
    if (!ids.length) continue;
    const m = MEMO.get(uid);
    if (m && maintenant - m.at < DUREE && ids.every((id) => m.ids.has(id))) { out[uid] = m.series; continue; }
    const series = {}; let rate = false;
    for (let i = 0; i < ids.length; i += 60) {
      const r = await lireSeries(base, uid, ids.slice(i, i + 60));
      if (r === null) { rate = true; break; }
      Object.assign(series, r);
    }
    if (rate) continue;
    MEMO.set(uid, { at: maintenant, ids: new Set(ids), series });
    out[uid] = series;
  }
  return out;
}
