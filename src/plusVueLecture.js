// ── LA LECTURE DES RELEVÉS POUR « PLUS VUE » (22 nov., choix n° 27) ─────────────────────────────────────────────────────
// Les relevés quotidiens `vinted_suivi_{uid}` des annonces EN LIGNE seulement, lus PROJETÉS par 60 (jamais la ligne
// entière, CLAUDE.md §4.4), après la liste (l'écran est déjà peint). Gardés 10 min dans la page. Une lecture ratée d'un
// compte ⇒ ses annonces restent « pas su » (aucune étiquette), jamais « vue ».
// (24 nov., vitesse-lectures-toucher) PLUSIEURS COMPTES PAR LECTURE (`lireSeriesComptes`) : mesuré à la 1re visite
// d'Annonces (banc vitesse-iphone, LECTURES=1, 15 comptes) — 15 lectures l'une après l'autre (une par compte, +5,7 à
// +11 s). Les annonces de tous les comptes sont rangées en paquets de 60 au plus (un compte peut être sur deux paquets),
// UNE lecture par paquet, deux paquets à la fois. Un paquet raté ⇒ ses comptes ne sont pas lus (absents du résultat).
// Rend { [uid]: { [id]: texte } } (une annonce sans relevé : absente) — un compte pas lu n'y est pas.
import { lireSeriesComptes } from './boostLecture.js';

const MEMO = new Map();   // uid → { at, ids: Set, series }
const DUREE = 10 * 60000;
export const PAR_LECTURE = 60;
export const EN_MEME_TEMPS = 2;

export async function lireRelevesEnLigne(base, parCompte, { maintenant = Date.now() } = {}) {
  const out = {};
  const aLire = [];
  for (const [uid, ids0] of Object.entries(parCompte || {})) {
    if (!/^\d{1,20}$/.test(uid)) continue;
    const ids = [...new Set((ids0 || []).map(String).filter((x) => /^\d{1,15}$/.test(x)))].slice(0, 1500);
    if (!ids.length) continue;
    const m = MEMO.get(uid);
    if (m && maintenant - m.at < DUREE && ids.every((id) => m.ids.has(id))) { out[uid] = m.series; continue; }
    aLire.push([uid, ids]);
  }
  // Les paquets : au plus PAR_LECTURE annonces chacun, dans l'ordre des comptes.
  const paquets = []; let cur = null;
  for (const [uid, ids] of aLire) for (const id of ids) {
    if (!cur || cur.n >= PAR_LECTURE) { cur = { parUid: {}, n: 0 }; paquets.push(cur); }
    (cur.parUid[uid] = cur.parUid[uid] || []).push(id); cur.n++;
  }
  const series = {}, rates = new Set();
  let i = 0;
  const suivant = async () => {
    while (i < paquets.length) {
      const p = paquets[i++];
      const r = await lireSeriesComptes(base, p.parUid);
      if (r === null) { for (const u of Object.keys(p.parUid)) rates.add(u); continue; }
      for (const [u, s] of Object.entries(r)) Object.assign(series[u] = series[u] || {}, s);
    }
  };
  await Promise.all(Array.from({ length: Math.min(EN_MEME_TEMPS, paquets.length) }, suivant));
  for (const [uid, ids] of aLire) {
    if (rates.has(uid)) continue;
    const s = series[uid] || {};
    MEMO.set(uid, { at: maintenant, ids: new Set(ids), series: s });
    out[uid] = s;
  }
  return out;
}
