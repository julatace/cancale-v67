// ── L'INVENTAIRE TOURNANT : 10 N° PAR JOUR (14 nov., lot 129) ───────────────────
// Julien : « Inventaire tournant : chaque jour, 10 N° à vérifier sur tes cartons. »
// Règle PURE (aucun import) : la carte du Stock (src/InventaireTournant.jsx) et
// scripts/audit-confort-securite.cjs l'EXÉCUTENT.
//   · LE TIRAGE est DÉTERMINISTE : le même jour, le même vendeur, la même liste de
//     paires ⇒ les mêmes 10 N° (sur tous ses appareils). Chaque N° reçoit une note
//     (FNV-1a de « jour · vendeur · N° ») ; les 10 plus petites sont tirées. Jamais
//     le titre, jamais le hasard du navigateur.
//   · PARMI LES PAIRES PRÉSENTES SEULEMENT : les unités de l'attendu du Stock
//     (`indexerAttendu`, src/inventaire.js — en ligne, masquées par Vinted, gardées
//     « encore là ») avec un N°. Une paire vendue, « à confirmer » ou sans N° n'est
//     pas tirée.
//   · On évite de retirer un N° vérifié depuis moins de 30 jours tant qu'il en reste
//     d'autres (le tour passe par tout le stock).
//   · « Vu » ou « Pas trouvé » : c'est TOUT ce qui est noté (`vrm_inventaire_tournant`).
//     ⚠️ AUCUN NUMÉRO N'EST CHANGÉ, AUCUNE FICHE SUPPRIMÉE : « pas trouvé » est un
//     SIGNAL (une ligne « À chercher » qui reste jusqu'à « Retrouvé »), jamais une
//     suppression, jamais un N° libéré (§5 : un N° n'est jamais réattribué).
export const CLE_TOURNANT = 'vrm_inventaire_tournant';
export const TOURNANT_PAR_JOUR = 10;
export const TOURNANT_REPOS_J = 30;

export function fnv1a(texte) {
  let h = 0x811c9dc5;
  const t = String(texte);
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
export const jourLocal = (ms = Date.now()) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// `unites` : [{ cles: [cle], numero, titre, photo, etat }] (l'attendu du Stock).
// `etat`   : la ligne `vrm_inventaire_tournant` (dates des « vu »).
// Rend [{ cle, numero, titre, photo }] — au plus TOURNANT_PAR_JOUR, dans l'ordre du tirage.
export function tirageDuJour(unites, { jour, uid = '', etat = null, n = TOURNANT_PAR_JOUR } = {}) {
  const vus = (etat && etat.vus && typeof etat.vus === 'object') ? etat.vus : {};
  const t0 = Date.parse(jour + 'T12:00:00');
  const presentes = [];
  const deja = new Set();
  for (const u of Array.isArray(unites) ? unites : []) {
    if (!u || !Array.isArray(u.cles) || !u.cles.length || !u.numero) continue;
    if (u.etat === 'aconfirmer' || u.etat === 'vendu') continue;
    const cle = String(u.cles[0]);
    if (deja.has(cle)) continue;
    deja.add(cle);
    presentes.push({ cle, numero: String(u.numero), titre: String(u.titre || ''), photo: String(u.photo || ''), note: fnv1a(`${jour}·${uid}·${cle}`) });
  }
  const recent = (p) => { const v = vus[p.cle]; return Number.isFinite(v) && Number.isFinite(t0) && t0 - v < TOURNANT_REPOS_J * 86400000 && v < t0 - 43200000; };
  const tri = (a, b) => a.note - b.note || (a.cle < b.cle ? -1 : 1);
  const frais = presentes.filter((p) => !recent(p)).sort(tri);
  const repos = presentes.filter(recent).sort(tri);
  return [...frais, ...repos].slice(0, n).map(({ note, ...p }) => p);
}

// Les gestes : `vu`, `absent`, `retrouve`. Aucun ne touche à un N° ni à une fiche.
export function noterTournant(etat, { cle, geste, at = Date.now(), jour } = {}) {
  const e = etat && typeof etat === 'object' ? etat : {};
  const vus = { ...(e.vus || {}) }, absents = { ...(e.absents || {}) };
  const faits = { ...(e.faits && e.faits.jour === jour ? e.faits.cles : {}) };
  const k = String(cle || '');
  if (!k) return { v: 1, vus, absents, faits: { jour, cles: faits } };
  if (geste === 'vu') { vus[k] = at; delete absents[k]; faits[k] = 'vu'; }
  else if (geste === 'absent') { absents[k] = absents[k] || at; faits[k] = 'absent'; }
  else if (geste === 'retrouve') { delete absents[k]; vus[k] = at; faits[k] = 'vu'; }
  return { v: 1, vus, absents, faits: { jour, cles: faits } };
}

// Fusion de deux appareils : le « vu » le plus récent gagne ; un « absent » reste
// tant qu'aucun « vu » plus récent ne le contredit.
export function fusionnerTournant(a, b) {
  const x = a || {}, y = b || {};
  const vus = { ...(x.vus || {}) };
  for (const [k, v] of Object.entries(y.vus || {})) if (!(vus[k] >= v)) vus[k] = v;
  const absents = {};
  for (const src of [x.absents || {}, y.absents || {}]) for (const [k, v] of Object.entries(src)) if (!(vus[k] > v)) absents[k] = Math.min(absents[k] || v, v);
  const fx = x.faits || {}, fy = y.faits || {};
  const jour = String(fx.jour || '') >= String(fy.jour || '') ? fx.jour : fy.jour;
  const cles = { ...(fy.jour === jour ? fy.cles : {}), ...(fx.jour === jour ? fx.cles : {}) };
  return { v: 1, vus, absents, faits: { jour, cles } };
}
