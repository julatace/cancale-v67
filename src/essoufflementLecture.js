// ── LA LECTURE DES COURBES POUR « S'ESSOUFFLE » (28 nov.) ───────────────────────────────────────────────────────────────
// Les lignes `courbes_annonces_{uid}_{nav}` (ext. 5.428), lues PROJETÉES (jamais la ligne entière, CLAUDE.md §4.4) :
//   1. les repères seuls (`ev:data->ev`, petits) — pour trouver SES republications passées (repère « r ») ;
//   2. les points des annonces EN LIGNE et des annonces republiées (`data->a->"ID"`), par paquets de 60, deux à la fois.
// Un paquet raté ⇒ ses annonces restent « pas lues » (pas su, jamais « essoufflée ») ; les repères pas lus ⇒ `null`.
// Gardé 10 min dans la page. `lire(query, { strict })` = `lireTout` de l'app (pagination `Range`, §4.5).
// Rend { rows, lus } (pour `courbesParCompte`, src/essoufflement.js) ou null (pas su).
import { selectCourbesPlan } from './pairesDorment.js';

export const PAR_PAQUET = 60;
export const EN_MEME_TEMPS = 2;
export const MAX_ANNONCES = 1500;
const DUREE = 10 * 60000;
let MEMO = null;   // { at, sig, res }
const RE_ID = /^\d{4,15}$/;

export async function lireCourbesEssoufflement(lire, parCompte, { maintenant = Date.now() } = {}) {
  const sig = JSON.stringify(parCompte || {});
  if (MEMO && MEMO.sig === sig && maintenant - MEMO.at < DUREE) return MEMO.res;
  let evRows;
  try { evRows = await lire('id=like.courbes_annonces_*&select=id,ev:data->ev', { strict: true }); } catch (_) { evRows = null; }
  if (!Array.isArray(evRows)) return null;
  // Les annonces à lire, par compte : celles en ligne, puis celles qu'un repère « r » désigne (ses republications).
  const parUid = {};
  const ajoute = (uid, id) => { const u = String(uid || ''), k = String(id || ''); if (!/^\d{1,20}$/.test(u) || !RE_ID.test(k)) return; (parUid[u] = parUid[u] || new Set()).add(k); };
  for (const [uid, ids] of Object.entries(parCompte || {})) for (const id of ids || []) ajoute(uid, id);
  for (const r of evRows) {
    const m = /^courbes_annonces_(\d{1,20})_/.exec(String((r && r.id) || ''));
    if (!m || !r.ev || typeof r.ev !== 'object') continue;
    for (const [id, l] of Object.entries(r.ev)) if (Array.isArray(l) && l.some((x) => Array.isArray(x) && x[1] === 'r')) ajoute(m[1], id);
  }
  const tous = [];
  for (const [uid, s] of Object.entries(parUid)) for (const id of s) tous.push([uid, id]);
  const liste = tous.slice(0, MAX_ANNONCES);
  const paquets = [];
  for (let i = 0; i < liste.length; i += PAR_PAQUET) paquets.push(liste.slice(i, i + PAR_PAQUET));
  const rows = evRows.map((r) => ({ id: r && r.id, ev: r && r.ev }));
  const lus = {};
  let i = 0;
  const suivant = async () => {
    while (i < paquets.length) {
      const p = paquets[i++];
      const sel = selectCourbesPlan(p.map((x) => x[1]));
      if (!sel) continue;
      let r;
      try { r = await lire('id=like.courbes_annonces_*&select=' + sel.select, { strict: true }); } catch (_) { r = null; }
      if (!Array.isArray(r)) continue;   // paquet raté : ses annonces restent pas lues
      for (const row of r) {
        const a = {};
        for (const [id, k] of Object.entries(sel.alias)) if (Array.isArray(row && row[k])) a[id] = row[k];
        rows.push({ id: row && row.id, a });
      }
      for (const [uid, id] of p) (lus[uid] = lus[uid] || []).push(id);
    }
  };
  await Promise.all(Array.from({ length: Math.min(EN_MEME_TEMPS, paquets.length) }, suivant));
  const res = { rows, lus };
  MEMO = { at: maintenant, sig, res };
  return res;
}
