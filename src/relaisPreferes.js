// ════════════════════════════════════════════════════════════════════════════
//  MES RELAIS PRÉFÉRÉS (4 nov., choix de Julien n° 1)
//  Sur Colis → À retirer, une étoile sur un point relais le marque « préféré ».
//  Ses préférés passent EN HAUT (une rangée « Mes relais », puis en tête de
//  chaque section), avec leurs horaires SEULEMENT s'ils ont été LUS (la liste
//  des points de Vinted captée par l'extension, `nearby_drop_off_points` →
//  `opening_status.text`). Jamais d'horaires inventés : rien de lu ⇒ rien.
//
//  L'identité d'un point est celle de `regrouperRelais` (src/relaisColis.js) :
//  le nom propre normalisé + le code postal (ou, sans code postal, la rue).
//  Un point sans nom ni adresse ne peut pas être préféré (on ne retiendrait rien).
//  Rangé dans `vrm_relais_preferes` (synchronisé, rattrapé par `onCloudReady`) :
//  { [cle]: { nom, adresse, cp, transporteurs, at } } — ce qui a été LU au moment
//  de l'étoile, jamais complété à la main.
//
//  Fonctions PURES (scripts/audit-relais-depot.cjs les exécute).
// ════════════════════════════════════════════════════════════════════════════
import { normNomRelais, nomRelaisPropre, cpDe, decouperAdresse } from './relaisColis.js';

export const CLE_PREFERES = 'vrm_relais_preferes';

export function clePoint(p) {
  if (!p || p.inconnu) return null;
  const nom = normNomRelais(nomRelaisPropre(p.nom || ''));
  const cp = p.cp || cpDe(p.adresse || '');
  const rue = normNomRelais(p.rue || (decouperAdresse(p.adresse || '') || {}).rue || '');
  if (!nom && !rue) return null;
  if (!cp && !rue) return nom ? `${nom}|` : null;
  return `${nom}|${cp || rue}`;
}

export const lirePreferes = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
export const estPrefere = (map, p) => { const k = clePoint(p); return !!(k && lirePreferes(map)[k]); };

// L'étoile : pose ou retire. Rend la NOUVELLE carte (rien ne change sans clé).
export function basculerPrefere(map, p, maintenant = Date.now()) {
  const m = { ...lirePreferes(map) };
  const k = clePoint(p);
  if (!k) return m;
  if (m[k]) { delete m[k]; return m; }
  m[k] = {
    nom: String(p.nom || ''), adresse: String(p.adresse || p.adresseCourte || ''), cp: String(p.cp || cpDe(p.adresse || '') || ''),
    transporteurs: Array.isArray(p.transporteurs) ? p.transporteurs.filter(Boolean).map(String) : [],
    at: new Date(maintenant).toISOString(),
  };
  return m;
}

// Les horaires LUS d'un point : le point de la liste de Vinted au MÊME nom et
// au MÊME code postal, et UN SEUL (deux points ⇒ on ne choisit pas ⇒ rien).
export function horairesLus(p, pointsVinted) {
  if (!p || !Array.isArray(pointsVinted) || !pointsVinted.length) return '';
  const n = normNomRelais(nomRelaisPropre(p.nom || ''));
  const cp = p.cp || cpDe(p.adresse || '');
  if (!n || !cp) return '';
  const bons = pointsVinted.filter((q) => q && normNomRelais(nomRelaisPropre(q.nom || '')) === n && (decouperAdresse(q.adresse || '') || {}).cp === cp);
  const textes = [...new Set(bons.map((q) => String(q.ouverture || q.horaires || '').trim()).filter(Boolean))];
  return textes.length === 1 ? textes[0] : '';
}

// Les points, préférés d'abord — l'ordre d'avant gardé dans chaque moitié.
// AUCUN point en plus, aucun en moins (un colis caché est un colis perdu, §5).
export function preferesEnTete(points, map) {
  const L = Array.isArray(points) ? points : [];
  return L.map((p, i) => [p, i]).sort((a, b) => (estPrefere(map, b[0]) - estPrefere(map, a[0])) || a[1] - b[1]).map(([p]) => p);
}

// La rangée « Mes relais » : chaque préféré, avec le point LU du moment s'il a
// des colis (son nom et son adresse lus gagnent sur ceux de l'étoile), le nombre
// de ses colis à retirer, et ses horaires LUS (sinon '').
export function mesRelais(map, points, pointsVinted) {
  const m = lirePreferes(map);
  const parCle = new Map();
  for (const p of (Array.isArray(points) ? points : [])) { const k = clePoint(p); if (k && !parCle.has(k)) parCle.set(k, p); }
  return Object.keys(m).map((k) => {
    const e = m[k] || {}, p = parCle.get(k) || null;
    const base = p ? { nom: p.nom || e.nom, adresse: p.adresse || p.adresseCourte || e.adresse, cp: p.cp || e.cp } : { nom: e.nom, adresse: e.adresse, cp: e.cp };
    const n = p ? (p.arrives || []).filter((c) => !c.horsCompte).length : 0;
    return { cle: k, ...base, n, horaires: horairesLus(base, pointsVinted), at: e.at || '' };
  }).sort((a, b) => (b.n - a.n) || String(a.nom).localeCompare(String(b.nom), 'fr'));
}
