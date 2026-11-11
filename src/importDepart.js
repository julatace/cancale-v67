// ═══════════════════════════════════════════════════════════════════════════
// L'IMPORT DE DÉPART (11 nov., lot import-depart, extension 5.344)
// ═══════════════════════════════════════════════════════════════════════════
// Un nouveau vendeur récupère tout son historique Vinted (ventes, achats) dès
// le premier jour. L'extension lit la suite des pages, sous ses garde-fous, et
// publie sa progression dans SA ligne `import_vinted_{uid}` (jamais `main`).
// Ce fichier est la seule lecture de cette ligne côté app : la barre de « Ma
// journée », celle de Paramètres → Mes comptes, et le lot « accompagnement
// nouveau vendeur » (étape « premier compte lu ») passent par ici.
//
// L'ÉTAT SIMPLE (`etatSimpleImport`) — à lire par les autres écrans :
//   { etat, n, N }
//   · etat ∈ 'attente' (rien lu encore) · 'encours' (n sur N) · 'pause'
//     (Vinted freine, ou budget de l'heure) · 'fini' (dernière page atteinte)
//     · 'arrete' (pas de nouvelles depuis 20 min, onglet vinted.fr fermé ?)
//     · null (pas su : aucune ligne, ou lecture ratée)
//   · n : commandes lues (ventes + achats) ; N : le total quand Vinted l'a
//     donné pour les deux, sinon null (« encore… »).
// « Pas su » ne vaut jamais « fini » : une ligne absente rend null.
// ═══════════════════════════════════════════════════════════════════════════

export const PREFIXE_LIGNE_IMPORT = 'import_vinted_';
export const SELECT_IMPORT = 'id,e:data->>etat,ve:data->ventes,ac:data->achats,r:data->>repriseA,c:data->>cause,m:data->>resteMin,f:data->>fin,at:data->>at,cap:data->>capturedAt';
// Sans nouvelles depuis 20 min alors que ce n'est pas fini : l'onglet est fermé.
export const IMPORT_SILENCE_MS = 20 * 60000;
// « Tout est récupéré ✓ » reste sur Ma journée un jour, puis s'efface.
export const IMPORT_FINI_VISIBLE_MS = 24 * 3600000;

// `null` / '' (champ absent) n'est PAS 0 : un total pas donné reste « pas su ».
const nombre = (v) => { if (v === null || v === undefined || String(v).trim() === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
function typeLu(t) {
  if (!t || typeof t !== 'object') return null;
  const lus = Math.max(0, nombre(t.lus) || 0);
  const total = nombre(t.total);
  return { lus, total: total !== null && total >= 0 ? total : null, pages: Math.max(0, nombre(t.pages) || 0), fini: t.fini === true };
}

// Une ligne projetée (`SELECT_IMPORT`) → l'état lisible, ou null (forme inconnue).
export function lireLigneImport(row, maintenant = Date.now()) {
  if (!row || typeof row !== 'object') return null;
  const m = /^import_vinted_(\d{1,20})$/.exec(String(row.id || ''));
  if (!m) return null;
  const etatBrut = String(row.e || '');
  if (!['attente', 'encours', 'pause', 'fini'].includes(etatBrut)) return null;
  const ventes = typeLu(row.ve), achats = typeLu(row.ac);
  if (!ventes || !achats) return null;
  const at = nombre(row.at) || (Date.parse(row.cap || '') || null);
  const repriseA = nombre(row.r);
  let etat = etatBrut;
  // Une pause passée sans nouvelle depuis : elle a repris, ou l'onglet est fermé.
  if (etat === 'pause' && repriseA && repriseA < maintenant) etat = 'encours';
  if (etat !== 'fini' && etat !== 'pause' && at && maintenant - at > IMPORT_SILENCE_MS) etat = 'arrete';
  return { uid: m[1], etat, ventes, achats, repriseA: etat === 'pause' ? repriseA : null, cause: row.c || null,
    resteMin: nombre(row.m), fin: nombre(row.f), at };
}

export function etatSimpleImport(l) {
  if (!l) return { etat: null, n: 0, N: null };
  const n = (l.ventes.lus || 0) + (l.achats.lus || 0);
  const N = l.ventes.total !== null && l.achats.total !== null ? l.ventes.total + l.achats.total : null;
  return { etat: l.etat, n: N !== null ? Math.min(n, N) : n, N };
}

// Lit les lignes des comptes donnés. Rend { [uid]: état | null } ou null (pas su).
export async function lireImportDepart(uids, lireTout) {
  const liste = (uids || []).map(String).filter((u) => /^\d{1,20}$/.test(u));
  if (!liste.length) return {};
  let rows;
  try { rows = await lireTout(`id=in.(${liste.map((u) => PREFIXE_LIGNE_IMPORT + u).join(',')})&select=${SELECT_IMPORT}`); } catch (_) { rows = null; }
  if (!Array.isArray(rows)) return null;
  const out = {};
  for (const u of liste) out[u] = null;
  for (const r of rows) { const l = lireLigneImport(r); if (l) out[l.uid] = l; }
  return out;
}

const fr = (n) => Number(n || 0).toLocaleString('fr-FR');
export const heureCourte = (ms) => { try { return new Date(Number(ms)).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } };
export function dureeImport(min) {
  const m = Number(min);
  if (!Number.isFinite(m) || m <= 0) return '';
  return m >= 60 ? `environ ${Math.ceil(m / 60)} h` : `environ ${Math.max(5, Math.round(m))} min`;
}
// Le pourcentage d'un type, ou null (total inconnu).
export function pctType(t) {
  if (!t || t.total === null || !(t.total > 0)) return t && t.fini ? 100 : null;
  return Math.max(0, Math.min(100, Math.round(t.lus / t.total * 100)));
}
// La partie droite d'un type : « 1 240 sur 2 160 », « 3 pages lues · encore… », « 2 160 ✓ ».
export function texteType(t, { suivant = false } = {}) {
  if (!t) return '—';
  if (t.fini) return `${fr(t.lus)} ✓`;
  if (t.total !== null && t.total > 0) return `${fr(Math.min(t.lus, t.total))} sur ${fr(t.total)}`;
  if (t.pages > 0) return `${fr(t.pages)} page${t.pages > 1 ? 's' : ''} lue${t.pages > 1 ? 's' : ''} · encore…`;
  return suivant ? 'Ensuite' : 'Bientôt';
}
// La phrase de tête (≤ 12 mots par phrase).
export function phraseImport(l) {
  if (!l) return '';
  if (l.etat === 'fini') return 'Tout est récupéré ✓';
  if (l.etat === 'pause') return `${l.cause === 'vinted' ? 'En pause : Vinted freine.' : 'En pause pour ménager ton compte.'} Reprise à ${heureCourte(l.repriseA)}.`;
  if (l.etat === 'arrete') return 'En attente : ouvre vinted.fr sur ce compte.';
  const d = dureeImport(l.resteMin);
  return `${l.etat === 'encours' ? 'Lecture de ton historique' : 'Ton historique arrive'}${d ? ' · ' + d : ''}, Vinted ouvert.`;
}
// Ma journée : les comptes dont l'import se VOIT (en cours, en pause, arrêté,
// ou fini depuis moins d'un jour). Le reste ne prend aucune place.
export function importsAMontrer(etats, maintenant = Date.now()) {
  if (!etats || typeof etats !== 'object') return [];
  return Object.values(etats).filter((l) => l && (l.etat !== 'fini' || (l.fin && maintenant - l.fin < IMPORT_FINI_VISIBLE_MS)));
}
