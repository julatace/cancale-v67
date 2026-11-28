// ════════════════════════════════════════════════════════════════════════════
//  LE DOSSIER « À PUBLIER » (28 nov. 2026, demandes de Julien)
// ════════════════════════════════════════════════════════════════════════════
// Julien (28 nov.) : « Je veux qu'on puisse faire un dossier avec les articles à publier. On sélectionne un ensemble de
// fichiers (photos) et, dès que c'est publié, le site comprend que ce sont les photos qu'on avait reliées à un achat. Ça
// fait gagner du temps. » — puis : « ça permet aussi de pouvoir étiqueter avant ».
//
// UN BROUILLON = une fiche « À publier » (`vrm_fiches_neuves[id]`, la liste d'avant) qui porte `dossier` :
//   { v: 1, creeAt, cle (la ligne de ses photos : `studio_photos_{cle}`), photos: [{ id, h, e, ec, nom, t }] }
//     h  : l'empreinte EXACTE du fichier choisi (SHA-256 de ses octets, 64 hex) — « fichier exact » (§5.2) ;
//     e  : l'empreinte PERCEPTUELLE du fichier (src/photoEmpreinte.js, 96 hex) ; ec : celle de la photo rangée (recadrée) ;
//     nom, t : le nom et l'heure du fichier (pour PROPOSER un regroupement, jamais une identité).
//   Ses photos (images) vont dans la ligne du studio (`studio_photos_{cle}`, la forme de « Préparer ») — jamais dans `main`.
//   Le N° n'est donné que sur SON toucher (« Donner un N° », `numerosEnSerie` : le prochain libre, du plus haut, jamais
//   un trou ; le pool append-only ; un brouillon retiré garde son N° servi pour toujours).
//
// LA CORRESPONDANCE ANNONCE ⇄ BROUILLON — PAR IDENTITÉ SEULEMENT (§5), JAMAIS par titre, marque, taille ou prix :
//   1. le N° : l'annonce porte le N° du brouillon (déposée par VRM — `lierNumeroFiche` relie le brouillon Vinted au N° de
//      la fiche — ou reprise par la photo, plus bas) ;
//   2. la PHOTO : Vinted RÉ-ENCODE chaque photo (nom, octets, taille changent : mesuré dans la capture, une photo d'annonce
//      n'est qu'une adresse vinted.net — ni nom de fichier, ni octets d'origine ; l'extension n'en lit que l'empreinte
//      PERCEPTUELLE, `photo_emprunte_{uid}`, la couverture d'abord). L'empreinte exacte ne survit donc JAMAIS à Vinted :
//      elle sert à reconnaître le MÊME fichier dans deux brouillons (alors aucun des deux n'est relié seul). Après Vinted,
//      la règle est celle de la « photo que VRM a fabriquée » (src/republieTelephone.js) : distance ≤ `SEUIL_PHOTO_VRM`
//      (8 ; mesuré : la même photo passée par Vinted ≤ 7, une autre photo de la même paire ≥ 23, une autre paire ≥ 19),
//      ET aucun AUTRE brouillon à ≤ `SEUIL_PHOTO` (16, le seuil « même photo ») — sinon ambigu ;
//   3. dans les deux sens : un brouillon réclamé par deux annonces, ou une annonce par deux brouillons ⇒ RIEN n'est relié,
//      il choisit (« Publiée ? Relie-la » : un toucher parmi les nouvelles annonces). Une annonce dont la date de mise en
//      ligne est inconnue, ou antérieure au brouillon, n'est jamais reliée seule (proposée seulement).
// Une fois reliée : l'annonce prend le lien d'achat, le prix mini et le N° du brouillon (sans jamais un second N°) ; le
// brouillon sort du dossier et passe dans « Publiées » (`publiee: { id, at, de }`).
// Module PUR : l'app (src/ecrans/Comptabilite.jsx, Annonces) et scripts/audit-dossier-a-publier.cjs l'EXÉCUTENT.
import { distanceEmpreintes, empreinteValide, SEUIL_PHOTO } from '../photoEmpreinte.js';
import { SEUIL_PHOTO_VRM, ATTENTE_REPUB_MS } from '../republieTelephone.js';

export const DOSSIER_V = 1;
export const PHOTOS_MAX_BROUILLON = 12;          // la borne du studio (PHOTOS_MAX_PAR_PAIRE)
export const ECART_PROPOSE_MS = 10 * 60e3;       // une PROPOSITION : un écart de plus de 10 min entre deux prises ⇒ un autre article
export const MARGE_CREE_MS = 10 * 60e3;          // une annonce créée au plus 10 min avant le brouillon reste « après » (horloges)
export const ATTENTE_BROUILLON_MS = ATTENTE_REPUB_MS;   // 24 h : une annonce sans empreinte attend avant un N° neuf
export const SEUIL_LIE = SEUIL_PHOTO_VRM;
export const SEUIL_AMBIGU = SEUIL_PHOTO;
export const cleStudioBrouillon = (id) => 'd' + String(id || '').replace(/[^a-z0-9]/gi, '').slice(0, 30);

const str = (v) => String(v == null ? '' : v).trim();
const cleDefaut = (v) => { let s = str(v).toUpperCase().replace(/[\s\-_.]/g, ''); if (/^\d+$/.test(s)) s = String(parseInt(s, 10)); return s; };
const hexOk = (h) => typeof h === 'string' && /^[0-9a-f]{64}$/.test(h);
const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);

// ── LES GROUPES (SON geste) ────────────────────────────────────────────────────
// `photos` : [{ id, t, nom, ... }] dans l'ordre de SA sélection. Les coupures sont SES touchers : un indice i coupe AVANT
// la photo i. Rend [[photo]] (jamais un groupe vide).
export function decouper(photos, coupures) {
  const L = Array.isArray(photos) ? photos.filter(Boolean) : [];
  const C = new Set([...(coupures || [])].map(Number).filter((i) => Number.isInteger(i) && i > 0 && i < L.length));
  const out = []; let g = [];
  L.forEach((p, i) => { if (C.has(i) && g.length) { out.push(g); g = []; } g.push(p); });
  if (g.length) out.push(g);
  return out;
}
// La PROPOSITION par heure de prise (ou de fichier) : coupe là où deux photos qui se suivent sont à plus de `ecartMs`.
// Rend un Set d'indices de coupure — jamais appliqué sans SA confirmation (l'écran les montre, il valide).
// Heure inconnue d'un côté ⇒ aucune coupure proposée là.
export function proposerCoupures(photos, ecartMs = ECART_PROPOSE_MS) {
  const L = Array.isArray(photos) ? photos : [];
  const out = new Set();
  for (let i = 1; i < L.length; i++) {
    const a = Number(L[i - 1] && L[i - 1].t), b = Number(L[i] && L[i].t);
    if (Number.isFinite(a) && a > 0 && Number.isFinite(b) && b > 0 && Math.abs(b - a) > ecartMs) out.add(i);
  }
  return out;
}
// La proposition par DOSSIER (le chemin relatif d'un fichier choisi « dossier » à l'ordinateur) : une coupure à chaque
// changement de dossier. Chemin inconnu ⇒ aucune coupure.
export function proposerCoupuresDossier(photos) {
  const L = Array.isArray(photos) ? photos : [];
  const dos = (p) => { const c = str(p && p.chemin); const i = c.lastIndexOf('/'); return i > 0 ? c.slice(0, i) : ''; };
  const out = new Set();
  for (let i = 1; i < L.length; i++) { const a = dos(L[i - 1]), b = dos(L[i]); if (a && b && a !== b) out.add(i); }
  return out;
}

// Un brouillon par groupe. `idDe(i)` : un identifiant neuf ; `champs` : titre, taille, prix posés par lui (facultatifs).
// Rend [{ id, fiche }] — AUCUN N° (il le donne sur SON toucher), aucun achat, aucun prix mini.
export function brouillonsDeGroupes(groupes, { idDe, maintenant = new Date().toISOString(), champs = null } = {}) {
  if (typeof idDe !== 'function') throw new Error('idDe absent');
  const out = [];
  (Array.isArray(groupes) ? groupes : []).forEach((g, i) => {
    const ph = (Array.isArray(g) ? g : []).filter((p) => p && str(p.id)).slice(0, PHOTOS_MAX_BROUILLON);
    if (!ph.length) return;
    const id = String(idDe(i));
    const c = champs && champs[i] ? champs[i] : {};
    out.push({ id, fiche: { id, creeAt: maintenant, origine: 'dossier', titre: str(c.titre).slice(0, 100), taille: str(c.taille).slice(0, 20), prix: prixDe(c.prix), photos: [],
      dossier: { v: DOSSIER_V, creeAt: maintenant, cle: cleStudioBrouillon(id), photos: ph.map((p) => ({ id: str(p.id), h: hexOk(p.h) ? p.h : '', e: empreinteValide(p.e) ? p.e : '', ec: empreinteValide(p.ec) ? p.ec : '', nom: str(p.nom).slice(0, 120), t: Number.isFinite(Number(p.t)) ? Number(p.t) : null })) } } });
  });
  return out;
}
const prixDe = (p) => { if (p == null || p === '') return null; const n = Number(String(p).replace(',', '.')); return Number.isFinite(n) && n > 0 && n < 100000 ? Math.round(n * 100) / 100 : null; };

// Les brouillons du dossier (ouverts : ni retirés, ni publiés), et les publiés.
export const estBrouillon = (f) => !!(f && objet(f.dossier) && Array.isArray(f.dossier.photos));
export const brouillonsOuverts = (neuves) => Object.values(objet(neuves) || {}).filter((f) => estBrouillon(f) && !f.retireeAt && !objet(f.publiee))
  .sort((a, b) => String(b.creeAt || '').localeCompare(String(a.creeAt || '')));
export const brouillonsPublies = (neuves) => Object.values(objet(neuves) || {}).filter((f) => estBrouillon(f) && objet(f.publiee))
  .sort((a, b) => String((b.publiee || {}).at || '').localeCompare(String((a.publiee || {}).at || '')));

// LE MÊME FICHIER dans deux brouillons (empreinte exacte) : Map h ⇒ [id de brouillon] (2 ou plus seulement).
export function fichiersEnDouble(brouillons) {
  const m = new Map();
  for (const f of brouillons || []) for (const p of (f && f.dossier && f.dossier.photos) || []) if (hexOk(p.h)) { const l = m.get(p.h) || new Set(); l.add(String(f.id)); m.set(p.h, l); }
  const out = new Map(); for (const [h, s] of m) if (s.size > 1) out.set(h, [...s]); return out;
}

// La distance d'une annonce (ses empreintes lues) à un brouillon (ses photos : `e` et `ec`). null = rien à comparer.
const empreintesBrouillon = (f) => ((f && f.dossier && f.dossier.photos) || []).flatMap((p) => [p.e, p.ec]).filter(empreinteValide);
export function distanceBrouillon(hexes, f) {
  let m = null;
  for (const a of (hexes || []).filter(empreinteValide)) for (const b of empreintesBrouillon(f)) { const d = distanceEmpreintes(a, b); if (d != null && (m == null || d < m)) m = d; }
  return m;
}
// Les brouillons qu'une annonce désigne par la PHOTO : { proches (≤ SEUIL_LIE), voisins (≤ SEUIL_AMBIGU) }, triés.
export function brouillonsParPhoto(hexes, brouillons) {
  const l = [];
  for (const f of brouillons || []) { const d = distanceBrouillon(hexes, f); if (d != null && d <= SEUIL_AMBIGU) l.push({ f, d }); }
  l.sort((a, b) => a.d - b.d);
  return { proches: l.filter((x) => x.d <= SEUIL_LIE), voisins: l };
}

// ── LA DÉCISION DE LA NUMÉROTATION pour une NOUVELLE annonce sans N° (le bloc <numerotation-passage>, avant un N° neuf) ──
// x : { hexes (de l'annonce) · brouillons (ouverts) · concurrents ([hexes] des AUTRES nouvelles annonces sans N° de ce
//       passage) · creee (ms, la date de l'annonce) · depuis (iso : la 1re fois vue sans N°) · numeroPresentAilleurs(cléN°)
//       · numeroVendu(cléN°) · maintenant · cle }
// Rend null (la règle normale continue) · { action: 'reprendre', numero, brouillon } · { action: 'attendre', jusqua, raison }.
//   ⚠️ « attendre » : une annonce qui pourrait être un brouillon NUMÉROTÉ ne reçoit pas un N° neuf avant 24 h (le N° du
//   brouillon est peut-être déjà sur le carton) ; ensuite la règle normale. Jamais deux N° pour une paire.
export function decisionNumeroBrouillon(x = {}) {
  const cle = typeof x.cle === 'function' ? x.cle : cleDefaut;
  const now = Number.isFinite(x.maintenant) ? x.maintenant : Date.now();
  const creee = Number(x.creee);
  const B = (Array.isArray(x.brouillons) ? x.brouillons : []).filter((f) => estBrouillon(f) && !f.retireeAt && !objet(f.publiee) && empreintesBrouillon(f).length
    && !(Number.isFinite(creee) && creee > 0 && creee + MARGE_CREE_MS < (Date.parse(f.dossier.creeAt || f.creeAt || '') || 0)));
  const numerotes = B.filter((f) => str(f.numero));
  if (!numerotes.length) return null;
  const t0 = Date.parse(str(x.depuis)); const jusqua = (Number.isFinite(t0) ? t0 : now) + ATTENTE_BROUILLON_MS;
  const attendre = (raison) => (now < jusqua ? { action: 'attendre', jusqua, raison } : null);
  const H = (x.hexes || []).filter(empreinteValide);
  if (!H.length) return attendre('empreintes');
  const r = brouillonsParPhoto(H, B);
  if (!r.proches.length) return r.voisins.some((v) => str(v.f.numero)) ? attendre('ambigu') : null;
  if (r.proches.length !== 1 || r.voisins.length !== 1) return attendre('ambigu');
  const f = r.proches[0].f;
  if (!str(f.numero)) return null;                     // un brouillon sans N° : la règle normale (le report suit)
  const concurrent = (x.concurrents || []).some((h) => { const d = distanceBrouillon(h, f); return d != null && d <= SEUIL_AMBIGU; });
  if (concurrent) return attendre('deux-annonces');
  const k = cle(f.numero);
  if ((typeof x.numeroPresentAilleurs === 'function' && x.numeroPresentAilleurs(k)) || (typeof x.numeroVendu === 'function' && x.numeroVendu(k))) return attendre('numero-pris');
  if (!(Number.isFinite(creee) && creee > 0)) return attendre('date');
  return { action: 'reprendre', numero: str(f.numero), brouillon: String(f.id), d: r.proches[0].d };
}

// ── LA CORRESPONDANCE (après la numérotation) ─────────────────────────────────
// annonces : [{ id, numero, hexes, creee (ms | null), brouillonDe }] — les annonces PRÉSENTES (lecture du dressing).
// Rend { liens: [{ brouillon, annonce, de: 'numero' | 'photo' }], ambigus: { [brouillonId]: [annonceId] } }.
//   'numero' : l'annonce porte le N° du brouillon (une seule annonce présente le porte) ;
//   'photo'  : brouillon SANS N° ; une seule annonce le désigne (proche ≤ 8, aucun autre brouillon voisin ≤ 16), et il
//              n'est désigné par aucune autre ; l'annonce est créée après lui ; elle n'est le report d'aucun autre.
export function correspondance({ brouillons, annonces, cle = cleDefaut } = {}) {
  const B = (Array.isArray(brouillons) ? brouillons : []).filter((f) => estBrouillon(f) && !f.retireeAt && !objet(f.publiee));
  const A = (Array.isArray(annonces) ? annonces : []).filter((a) => a && str(a.id));
  const liens = [], ambigus = {};
  const prises = new Set(A.filter((a) => str(a.brouillonDe)).map((a) => String(a.id)));
  // 1. par N°.
  for (const f of B) {
    if (!str(f.numero)) continue;
    const k = cle(f.numero);
    const l = A.filter((a) => str(a.numero) && cle(a.numero) === k && !prises.has(String(a.id)));
    if (l.length === 1) { liens.push({ brouillon: String(f.id), annonce: String(l[0].id), de: 'numero' }); prises.add(String(l[0].id)); }
    else if (l.length > 1) ambigus[String(f.id)] = l.map((a) => String(a.id));
  }
  const lies = new Set(liens.map((x) => x.brouillon));
  // 2. par photo (brouillons sans N°).
  const parBrouillon = new Map();
  for (const a of A) {
    if (prises.has(String(a.id))) continue;
    const r = brouillonsParPhoto(a.hexes, B);
    if (!r.proches.length) continue;
    for (const v of r.voisins) { const l = parBrouillon.get(String(v.f.id)) || []; l.push({ a, sur: r.proches.length === 1 && r.voisins.length === 1 }); parBrouillon.set(String(v.f.id), l); }
  }
  for (const f of B) {
    if (lies.has(String(f.id)) || str(f.numero)) continue;
    const l = parBrouillon.get(String(f.id)) || [];
    if (!l.length) continue;
    const t0 = Date.parse(f.dossier.creeAt || f.creeAt || '') || 0;
    const apres = (a) => Number.isFinite(Number(a.creee)) && Number(a.creee) > 0 && Number(a.creee) + MARGE_CREE_MS >= t0;
    if (l.length === 1 && l[0].sur && apres(l[0].a)) { liens.push({ brouillon: String(f.id), annonce: String(l[0].a.id), de: 'photo' }); prises.add(String(l[0].a.id)); }
    else ambigus[String(f.id)] = l.map((x) => String(x.a.id));
  }
  return { liens, ambigus };
}

// Ce que l'annonce HÉRITE du brouillon (un champ déjà posé sur l'annonce n'est jamais écrasé ; le prix mini le plus RÉCENT
// gagne, la règle `pmMiniDe`). Rend le patch de la fiche d'annonce (peut être vide).
export function heritage(brouillon, ficheAnnonce, { de = 'photo', maintenant = new Date().toISOString() } = {}) {
  const b = brouillon || {}, f = ficheAnnonce || {};
  const out = { brouillonDe: String(b.id), brouillonAt: maintenant, brouillonPar: de };
  if (!str(f.buyFromId) && str(b.buyFromId)) { out.buyFromId = str(b.buyFromId); if (b.buyFrom) out.buyFrom = b.buyFrom; }
  if ((f.buyPrice == null || str(f.buyPrice) === '') && b.buyPrice != null && str(b.buyPrice) !== '') { out.buyPrice = b.buyPrice; if (b.buyPriceSource) out.buyPriceSource = b.buyPriceSource; }
  const tf = Date.parse(f.minAt || '') || 0, tb = Date.parse(b.minAt || '') || 0;
  if (b.min != null && str(b.min) !== '' && (f.min == null || str(f.min) === '' || tb > tf)) { out.min = b.min; out.minAt = b.minAt || maintenant; }
  return out;
}

// SON choix (« Publiée ? Relie-la ») : l'annonce choisie hérite, et, si elle a reçu un N° AUTOMATIQUE différent de celui
// du brouillon (pas écrit à la main, pas porté par une vente), elle prend le N° du brouillon — l'autre reste servi (§5).
export function patchChoix(brouillon, ficheAnnonce, { cle = cleDefaut, numeroVendu = () => false, maintenant = new Date().toISOString() } = {}) {
  const b = brouillon || {}, f = ficheAnnonce || {};
  const p = heritage(b, f, { de: 'choix', maintenant });
  const nb = str(b.numero), nf = str(f.numero);
  if (nb && cle(nb) !== cle(nf)) {
    if (nf && (!f.auto || f.manuelAt || numeroVendu(cle(nf)))) return { patch: p, numero: 'garde', raison: 'manuel' };
    p.numero = nb; if (nf) p.numeroRendu = { de: nf, at: maintenant };
  }
  return { patch: p, numero: nb ? 'brouillon' : 'annonce' };
}

// LES N° DU DOSSIER (SON toucher « Donner un N° ») : les brouillons choisis SANS N° reçoivent la série `numerosEnSerie`
// (src/rangementArrivee.js — le prochain libre, du plus haut, jamais un trou ; la MÊME règle que « Rangé » et
// « Dupliquer »). Rend { ok, numeros: { [id]: N° } } ; un brouillon qui a déjà son N° le garde.
export function numerosPourBrouillons(ids, neuves, serie) {
  const T = objet(neuves) || {};
  const sans = (ids || []).map(String).filter((id) => T[id] && estBrouillon(T[id]) && !str(T[id].numero) && !T[id].retireeAt);
  if (!sans.length) return { ok: true, numeros: {} };
  if (typeof serie !== 'function') return { ok: false, raison: 'numeros' };
  const l = serie(sans.length);
  if (!Array.isArray(l) || l.length !== sans.length || l.some((n) => !str(n))) return { ok: false, raison: 'numeros' };
  const out = {}; sans.forEach((id, i) => { out[id] = String(l[i]); });
  return { ok: true, numeros: out };
}
