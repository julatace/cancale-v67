// ══════════════════════════════════════════════════════════════════════════════
//  SÉANCE PHOTO (14 nov., proposition 103 — validée par Julien)
// ══════════════════════════════════════════════════════════════════════════════
// La liste des paires à prendre ou reprendre en photo, dans l'ordre des N°, cochées
// au fur et à mesure.
//   · QUI est dans la liste : les paires PRÉSENTES chez lui (la même liste que le
//     studio et l'inventaire : `porteursNum`) qui n'ont AUCUNE photo dans VRM (le
//     studio, `studio_photos_{N°}`), qui en ont MOINS DE N, ou dont une photo a été
//     signalée floue ou sombre (proposition 102, `qualite` rangée avec la photo) ;
//   · L'ORDRE : celui des N° (`triNum`), les numéros à lettres après, jamais le titre ;
//   · LA COCHE se pose PAR IDENTITÉ : la clé du N° (`cleNum`), sur SON toucher ou quand
//     une photo de CETTE paire est rangée par le studio pendant la séance. Une séance est
//     une LISTE FIGÉE au moment où il la commence (sinon une paire photographiée
//     sortirait de la liste au lieu d'être cochée) ; « Nouvelle séance » la recalcule.
//   · « pas su » ≠ « aucune photo » : si les photos du studio n'ont pas pu être lues,
//     la liste n'est PAS calculée (on ne mettrait pas 300 paires « sans photo » à tort).
// Rangée dans SES données : la clé synchronisée `vrm_seance_photo` de la ligne `main`
// ({ seance: { at, n, cles }, 'c:<clé N°>': ISO }) — la même séance sur son iPhone et
// son ordinateur ; chaque coche est un geste annulable (src/gesteAnnulable.js).
// Module PUR : exécuté tel quel par scripts/audit-seance-photo.cjs.
// ══════════════════════════════════════════════════════════════════════════════

export const CLE_SEANCE = 'vrm_seance_photo';
export const N_DEFAUT = 3;
export const N_CHOIX = [1, 2, 3, 4, 5];
export const MAX_SEANCE = 400;

const cleDefaut = (v) => { let s = String(v == null ? '' : v).trim().toUpperCase().replace(/[\s\-_.]/g, ''); if (/^\d+$/.test(s)) s = String(parseInt(s, 10)); return s; };
// L'ordre des N° : les nombres d'abord (croissants), puis les numéros à lettres.
export const triNumSeance = (a, b) => {
  const x = /^\d+$/.test(a) ? parseInt(a, 10) : NaN, y = /^\d+$/.test(b) ? parseInt(b, 10) : NaN;
  if (Number.isFinite(x) && Number.isFinite(y)) return x - y;
  if (Number.isFinite(x)) return -1;
  if (Number.isFinite(y)) return 1;
  return String(a).localeCompare(String(b), 'fr', { numeric: true });
};

// Ce que la base a rendu pour les lignes du studio (projection scalaire, jamais les
// images) → Map cleN° → { n, douteuses }. `rows` = [{ id: 'studio_photos_X', a0..a5, q0..q5 }].
export const COLONNES_STUDIO = 6;
export const selectStudio = () => ['id', 'num:data->>numero', ...Array.from({ length: COLONNES_STUDIO }, (_, i) => `a${i}:data->photos->${i}->>at`), ...Array.from({ length: COLONNES_STUDIO }, (_, i) => `q${i}:data->photos->${i}->qualite->>juge`)].join(',');
export function etatStudio(rows, cleNum = cleDefaut) {
  if (!Array.isArray(rows)) return null;
  const m = new Map();
  for (const r of rows) {
    if (!r || typeof r.id !== 'string' || !r.id.startsWith('studio_photos_')) continue;
    const k = cleNum(r.num != null && r.num !== '' ? r.num : r.id.slice('studio_photos_'.length));
    if (!k) continue;
    let n = 0, d = 0;
    for (let i = 0; i < COLONNES_STUDIO; i++) {
      if (r['a' + i] != null && r['a' + i] !== '') n++;
      const q = r['q' + i];
      if (q === 'flou' || q === 'sombre' || q === 'flou-sombre') d++;
    }
    const avant = m.get(k);
    m.set(k, avant ? { n: avant.n + n, douteuses: avant.douteuses + d } : { n, douteuses: d });
  }
  return m;
}

// La raison d'une paire d'être dans la séance, ou null.
export function raisonSeance(etat, n = N_DEFAUT) {
  const e = etat || { n: 0, douteuses: 0 };
  if (!e.n) return { raison: 'aucune', n: 0 };
  if (e.douteuses > 0) return { raison: 'douteuse', n: e.n, douteuses: e.douteuses };
  if (e.n < n) return { raison: 'peu', n: e.n };
  return null;
}

// LA LISTE d'une séance qui commence : `paires` = [{ num, titre? }] (présentes),
// `studio` = Map (etatStudio) ou null (pas su). Rend { ok, cles, raisons } ou
// { ok: false, raison: 'passu' }.
export function nouvelleSeance({ paires, studio, n = N_DEFAUT, cleNum = cleDefaut, maintenant = new Date().toISOString() }) {
  if (!(studio instanceof Map)) return { ok: false, raison: 'passu' };
  const vues = new Set(), cles = [];
  for (const p of Array.isArray(paires) ? paires : []) {
    const k = cleNum(p && p.num); if (!k || vues.has(k)) continue;
    vues.add(k);
    if (raisonSeance(studio.get(k), n)) cles.push(k);
  }
  cles.sort(triNumSeance);
  return { ok: true, seance: { at: maintenant, n: N_CHOIX.includes(n) ? n : N_DEFAUT, cles: cles.slice(0, MAX_SEANCE) }, tronquee: cles.length > MAX_SEANCE };
}

// Les rangées affichées d'une séance en cours : la liste FIGÉE, chaque rangée avec sa
// raison (relue maintenant) et sa coche (par identité).
export function lignesSeance(valeur, { studio = null, paires = [], cleNum = cleDefaut } = {}) {
  const v = valeur && typeof valeur === 'object' ? valeur : {};
  const s = v.seance && Array.isArray(v.seance.cles) ? v.seance : null;
  if (!s) return null;
  const infos = new Map();
  for (const p of Array.isArray(paires) ? paires : []) { const k = cleNum(p && p.num); if (k && !infos.has(k)) infos.set(k, p); }
  const lignes = s.cles.map((k) => {
    const p = infos.get(k) || null;
    const e = studio instanceof Map ? studio.get(k) : undefined;
    const r = studio instanceof Map ? raisonSeance(e, s.n) : undefined;
    return { cle: k, num: p && p.num != null ? String(p.num) : k, titre: (p && p.titre) || '', photo: (p && p.photo) || '', present: !!p,
      raison: r === undefined ? 'passu' : r ? r.raison : 'faite', nPhotos: e ? e.n : (studio instanceof Map ? 0 : null),
      coche: typeof v['c:' + k] === 'string' && v['c:' + k] !== '' };
  });
  const faites = lignes.filter((l) => l.coche).length;
  return { at: s.at, n: s.n, lignes, faites, total: lignes.length };
}

// Le geste de cocher / décocher une paire (par identité) : une opération annulable.
export function opCoche(valeur, cle, coche, maintenant = new Date().toISOString()) {
  const v = valeur && typeof valeur === 'object' ? valeur : {};
  if (!cle) return null;
  const id = 'c:' + cle;
  const avant = v[id];
  const apres = coche ? maintenant : undefined;
  if ((avant === undefined && apres === undefined) || (coche && typeof avant === 'string' && avant)) return null;
  return { k: CLE_SEANCE, type: 'cle', id, apres, avant };
}
// Commencer une séance : la liste figée, et les coches d'avant retirées (une opération par clé).
export function opsNouvelleSeance(valeur, seance) {
  const v = valeur && typeof valeur === 'object' ? valeur : {};
  const ops = [{ k: CLE_SEANCE, type: 'cle', id: 'seance', apres: seance, avant: v.seance }];
  for (const k of Object.keys(v)) if (k.startsWith('c:')) ops.push({ k: CLE_SEANCE, type: 'cle', id: k, apres: undefined, avant: v[k] });
  return ops;
}
