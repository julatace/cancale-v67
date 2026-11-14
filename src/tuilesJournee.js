// ── « TES TUILES À TOI » (14 nov. 2026, idée 148 de Julien) ────────────────────────────────
// Un appui long sur une tuile de Ma journée ⇒ mode rangement : réordonner au doigt (et à la souris,
// et au clavier), cacher celles qui ne servent pas, en agrandir une (une taille du Bento) ;
// « Terminé » range. UN réglage synchronisé par compte (`vrm_tuiles_journee`, SYNC_KEYS) :
//   { v: 1, ordre: [id…], cachees: { id: true }, tailles: { id: '2x1' }, at }
// Une tuile cachée ne cache JAMAIS un geste urgent : si elle porte quelque chose d'urgent (colis à
// envoyer avant demain ou en retard, retrait qui expire — `urgencesJournee`, src/journeePerso.js),
// elle revient d'elle-même, avec « remise car urgente ».
// Règles PURES : aucune lecture, aucune écriture ici (l'écran lit, pose, et synchronise).

export const CLE_TUILES_JOURNEE = 'vrm_tuiles_journee';
// Les tailles du Bento (colonnes × rangées au téléphone, trois colonnes).
export const TAILLES = Object.freeze(['1x1', '2x1', '3x1', '2x2']);
// Ce que chaque tuile accepte : « À envoyer » porte le rond d'encre (jamais 1 × 1), « À retirer » ses codes,
// le mois ses trois chiffres (sa taille ne change pas). Une tuile inconnue : toutes.
export const TAILLES_DE = Object.freeze({
  envoyer: ['2x1', '3x1', '2x2'],
  retirer: ['2x1', '3x1', '2x2'],
  mois: ['3x1'],
});
// Sur ordinateur (douze colonnes) : la même taille, proportionnée.
export const PLACE_ORDI = Object.freeze({ '1x1': { c: 2, r: 1 }, '2x1': { c: 4, r: 1 }, '3x1': { c: 8, r: 1 }, '2x2': { c: 4, r: 2 }, '3x2': { c: 6, r: 2 } });

const estId = (x) => typeof x === 'string' && /^[a-z][a-z0-9-]{0,31}$/.test(x);

// Lit n'importe quoi (nuage, vieille version, rien) et rend un réglage propre.
export function lireTuilesJournee(brut) {
  const r = brut && typeof brut === 'object' && !Array.isArray(brut) ? brut : {};
  const ordre = Array.isArray(r.ordre) ? [...new Set(r.ordre.filter(estId))] : [];
  const cachees = {};
  if (r.cachees && typeof r.cachees === 'object') for (const [k, v] of Object.entries(r.cachees)) if (estId(k) && v === true) cachees[k] = true;
  const tailles = {};
  if (r.tailles && typeof r.tailles === 'object') for (const [k, v] of Object.entries(r.tailles)) if (estId(k) && TAILLES.includes(v)) tailles[k] = v;
  return { v: 1, ordre, cachees, tailles, at: typeof r.at === 'string' ? r.at : null };
}
export const estOrigineTuiles = (r) => { const x = lireTuilesJournee(r); return !x.ordre.length && !Object.keys(x.cachees).length && !Object.keys(x.tailles).length; };
const estampille = (r) => ({ ...r, at: new Date().toISOString() });

// Les tuiles à montrer, dans SON ordre, à SA taille. `tuiles` : [{ id, taille, place }] dans l'ordre par
// défaut ; `urgent` : { id: true } (les tuiles qui portent un geste urgent). Rend chaque tuile avec
// `cachee` (pas montrée) et `remise` (cachée par lui, revenue parce qu'urgente). Rien n'est retiré :
// une tuile cachée reste dans la liste (ses compteurs restent publiés), marquée `cachee`.
export function appliquerTuiles(tuiles, reglage, urgent = {}) {
  const r = lireTuilesJournee(reglage);
  const rang = new Map(r.ordre.map((id, i) => [id, i]));
  const base = (Array.isArray(tuiles) ? tuiles : []).map((t, i) => ({ t, i }));
  // Un id absent de SON ordre garde sa place relative d'origine, après ceux qu'il a rangés qui le précèdent.
  base.sort((a, b) => {
    const ra = rang.has(a.t.id) ? rang.get(a.t.id) : null, rb = rang.has(b.t.id) ? rang.get(b.t.id) : null;
    if (ra != null && rb != null) return ra - rb;
    return a.i - b.i;
  });
  return base.map(({ t }) => {
    const permises = TAILLES_DE[t.id] || TAILLES;
    const taille = r.tailles[t.id] && permises.includes(r.tailles[t.id]) ? r.tailles[t.id] : t.taille;
    const perso = taille !== t.taille;
    const cacheeParLui = !!r.cachees[t.id];
    const remise = cacheeParLui && !!urgent[t.id];
    return { ...t, taille, place: perso ? { ...(PLACE_ORDI[taille] || t.place) } : t.place, cachee: cacheeParLui && !remise, remise, cacheeParLui };
  });
}

// ── LES GESTES (rendent un NOUVEAU réglage, à enregistrer sur « Terminé ») ─────────────────
// Déplace `id` à l'index `vers` dans l'ordre complet `ids` (l'ordre affiché).
export function deplacerTuile(reglage, ids, id, vers) {
  const r = lireTuilesJournee(reglage);
  const l = (Array.isArray(ids) ? ids : []).filter(estId);
  const de = l.indexOf(id); if (de < 0) return r;
  const a = Math.max(0, Math.min(l.length - 1, Math.round(Number(vers) || 0)));
  if (a === de) return r;
  l.splice(de, 1); l.splice(a, 0, id);
  return estampille({ ...r, ordre: l });
}
export function basculerTuile(reglage, id, cachee) {
  const r = lireTuilesJournee(reglage);
  if (!estId(id)) return r;
  const c = { ...r.cachees }; if (cachee) c[id] = true; else delete c[id];
  return estampille({ ...r, cachees: c });
}
// La taille suivante parmi celles que la tuile accepte (on revient à la première après la dernière).
export function tailleSuivante(id, actuelle) {
  const permises = TAILLES_DE[id] || TAILLES;
  const i = permises.indexOf(actuelle);
  return permises[(i + 1) % permises.length];
}
export function agrandirTuile(reglage, id, actuelle) {
  const r = lireTuilesJournee(reglage);
  if (!estId(id)) return r;
  return estampille({ ...r, tailles: { ...r.tailles, [id]: tailleSuivante(id, actuelle) } });
}
export const tuilesOrigine = () => estampille({ v: 1, ordre: [], cachees: {}, tailles: {} });
