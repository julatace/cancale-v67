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
//
// 5.373 (13 nov., lot 47) — L'IMPORT DE TON PASSÉ (12 MOIS, ANNONCES COMPRISES) :
// la ligne v 2 porte `horizonMois` (12, ou null = « Tout récupérer »), par type
// `estime` / `pagesEstimees` (« 340 / ~1 200 », « 4 pages sur ~12 »), `annonces`
// (lus, total, fini, partiel), `enCours`, et `souci` (deconnecte · echec · base ·
// prudence). Une ligne d'avant (v 1, sans horizon) garde ses textes d'avant.
// Fini sur 12 mois ⇒ « Ton passé est importé (12 mois) » UNE fois sur Ma journée
// (`vrm_import_passe_vu`, synchronisé : vu sur un appareil, vu partout).
// ═══════════════════════════════════════════════════════════════════════════

export const PREFIXE_LIGNE_IMPORT = 'import_vinted_';
export const SELECT_IMPORT = 'id,e:data->>etat,ve:data->ventes,ac:data->achats,an:data->annonces,h:data->>horizonMois,so:data->>souci,sa:data->>souciA,ec:data->>enCours,r:data->>repriseA,c:data->>cause,m:data->>resteMin,f:data->>fin,at:data->>at,cap:data->>capturedAt';
// 5.373 : « Ton passé est importé (12 mois) » vu : { [uid]: fin } (SYNC_KEYS de l'app).
export const CLE_IMPORT_VU = 'vrm_import_passe_vu';
// Le message de fin reste proposé au plus 7 jours après la fin (jamais un vieux « fini »).
export const IMPORT_FINI_PROPOSE_MS = 7 * 24 * 3600000;
export const SOUCIS_IMPORT = ['deconnecte', 'echec', 'base', 'prudence'];
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
  const estime = nombre(t.estime), pe = nombre(t.pagesEstimees);
  return { lus, total: total !== null && total >= 0 ? total : null, pages: Math.max(0, nombre(t.pages) || 0), fini: t.fini === true,
    estime: estime !== null && estime > 0 ? Math.max(estime, lus) : null, pagesEstimees: pe !== null && pe > 0 ? pe : null, horizon: t.horizon === true };
}
// 5.373 : les annonces (lecture complète du dressing), ou null (ligne d'avant).
function annoncesLues(a) {
  if (!a || typeof a !== 'object') return null;
  const total = nombre(a.total);
  return { lus: Math.max(0, nombre(a.lus) || 0), total: total !== null && total >= 0 ? total : null, fini: a.fini === true, partiel: a.partiel === true };
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
  const h = nombre(row.h);
  const souci = etat !== 'fini' && SOUCIS_IMPORT.includes(String(row.so || '')) ? String(row.so) : null;
  return { uid: m[1], etat, ventes, achats, annonces: annoncesLues(row.an), horizonMois: h !== null && h > 0 ? h : null,
    souci, souciA: souci ? nombre(row.sa) : null, enCours: ['ventes', 'achats', 'annonces'].includes(row.ec) ? row.ec : null,
    repriseA: etat === 'pause' ? repriseA : null, cause: row.c || null, resteMin: nombre(row.m), fin: nombre(row.f), at };
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
// Le pourcentage d'un type, ou null (total inconnu). 5.373 : sur l'estimation quand elle est là.
export const butType = (t) => (t && t.estime !== null && t.estime !== undefined && t.estime > 0 ? t.estime : (t && t.total !== null && t.total > 0 ? t.total : null));
export function pctType(t) {
  const but = butType(t);
  if (!t || but === null) return t && t.fini ? 100 : null;
  return Math.max(0, Math.min(100, Math.round(t.lus / but * 100)));
}
// 5.373 : « 340 / ~1 200 » (estimation) — `null` sans estimation.
export function chiffreEstime(t) {
  if (!t || t.fini || t.estime === null || t.estime === undefined) return null;
  return `${fr(Math.min(t.lus, t.estime))} / ~${fr(arrondiEstime(t.estime))}`;
}
// Une estimation se dit ronde (« ~1 200 », « ~480 », « ~45 ») — jamais sous ce qui est lu.
export function arrondiEstime(n) {
  const v = Math.max(0, Number(n) || 0);
  const pas = v >= 1000 ? 100 : v >= 100 ? 10 : 1;
  return Math.round(v / pas) * pas;
}
// « 4 pages sur ~12 » — `null` sans estimation.
export function pagesType(t) {
  if (!t || t.fini || !t.pagesEstimees || !(t.pages > 0)) return null;
  return `${fr(t.pages)} page${t.pages > 1 ? 's' : ''} sur ~${fr(Math.max(t.pages, t.pagesEstimees))}`;
}
// « suite dans 40 min » / « suite dans 2 h » — `''` sans heure de reprise.
export function suiteDans(ms, maintenant = Date.now()) {
  const m = Math.ceil((Number(ms) - maintenant) / 60000);
  if (!Number.isFinite(m)) return '';
  if (m <= 1) return 'suite dans 1 min';
  return m >= 60 ? `suite dans ${Math.round(m / 60)} h` : `suite dans ${m} min`;
}
const NOMS_TYPES = { ventes: 'ventes', achats: 'achats', annonces: 'annonces' };
// 5.373 : la ligne de tête d'un compte — « Import de ton passé · 340 / ~1 200 ventes · compte X ».
export function titreImport(l, nomCompte) {
  if (!l) return '';
  const bouts = ['Import de ton passé'];
  if (l.etat === 'fini') bouts.push(l.horizonMois ? `importé (${l.horizonMois} mois)` : 'tout est là');
  else {
    const k = l.enCours || (!l.ventes.fini ? 'ventes' : !l.achats.fini ? 'achats' : 'annonces');
    const t = k === 'annonces' ? null : l[k];
    const c = t ? (chiffreEstime(t) || (t.total !== null && t.total > 0 ? `${fr(Math.min(t.lus, t.total))} / ${fr(t.total)}` : null)) : null;
    if (c) bouts.push(`${c} ${NOMS_TYPES[k]}`);
    else if (k === 'annonces') bouts.push('annonces');
  }
  if (nomCompte) bouts.push(`compte ${nomCompte}`);
  return bouts.join(' · ');
}
// La partie droite d'un type : « 1 240 sur 2 160 », « 3 pages lues · encore… », « 2 160 ✓ ».
export function texteType(t, { suivant = false } = {}) {
  if (!t) return '—';
  if (t.fini) return `${fr(t.lus)} ✓`;
  { const c = chiffreEstime(t); if (c) return c; }
  if (t.total !== null && t.total > 0) return `${fr(Math.min(t.lus, t.total))} sur ${fr(t.total)}`;
  if (t.pages > 0) return `${fr(t.pages)} page${t.pages > 1 ? 's' : ''} lue${t.pages > 1 ? 's' : ''} · encore…`;
  return suivant ? 'Ensuite' : 'Bientôt';
}
// La phrase de tête (≤ 12 mots par phrase).
export function phraseImport(l, maintenant = Date.now()) {
  if (!l) return '';
  if (l.horizonMois || l.annonces) return phrasePasse(l, maintenant);
  if (l.etat === 'fini') return 'Tout est récupéré ✓';
  if (l.etat === 'pause') return `${l.cause === 'vinted' ? 'En pause : Vinted freine.' : 'En pause pour ménager ton compte.'} Reprise à ${heureCourte(l.repriseA)}.`;
  if (l.etat === 'arrete') return 'En attente : ouvre vinted.fr sur ce compte.';
  const d = dureeImport(l.resteMin);
  return `${l.etat === 'encours' ? 'Lecture de ton historique' : 'Ton historique arrive'}${d ? ' · ' + d : ''}, Vinted ouvert.`;
}
// 5.373 : la phrase d'une ligne v 2 (≤ 12 mots par phrase). Le souci d'abord : il dit quoi faire.
export function phrasePasse(l, maintenant = Date.now()) {
  if (l.etat === 'fini') return l.horizonMois ? `Ton passé est importé (${l.horizonMois} mois) ✓` : 'Tout ton historique est importé ✓';
  if (l.souci === 'deconnecte') return 'Compte pas ouvert sur vinted.fr. L’import reprend seul dès qu’il l’est.';
  if (l.souci === 'prudence') return 'Vinted a freiné ce compte. L’import reprend seul dans 24 h.';
  if (l.souci === 'echec') return `Lecture ratée${l.souciA ? ' à ' + heureCourte(l.souciA) : ''}. Nouvel essai tout seul dans 5 min.`;
  if (l.souci === 'base') return 'La dernière page n’a pas été enregistrée. Nouvel essai tout seul.';
  if (l.etat === 'pause') {
    const s = suiteDans(l.repriseA, maintenant);
    return `${l.cause === 'vinted' ? 'Vinted freine' : 'Lecture étalée pour ménager ton compte'}${s ? ' : ' + s : ''}.`;
  }
  if (l.etat === 'arrete') return 'En attente : ouvre vinted.fr sur ce compte. L’import reprend seul.';
  const d = dureeImport(l.resteMin);
  return `${l.etat === 'encours' ? 'Lecture en cours' : 'Ça commence'}${d ? ' · ' + d : ''}, Vinted ouvert.`;
}
// 5.373 : la partie droite des annonces.
export function texteAnnonces(a) {
  if (!a) return '—';
  if (a.fini && a.partiel) return a.total !== null ? `${fr(Math.min(a.lus, a.total))} sur ${fr(a.total)}` : `${fr(a.lus)}`;
  if (a.fini) return `${fr(a.lus)} ✓`;
  return 'Ensuite, d’un trait';
}
// Ma journée : les comptes dont l'import se VOIT (en cours, en pause, arrêté,
// ou fini depuis moins d'un jour). Le reste ne prend aucune place.
// 5.373 : une ligne v 2 finie ne se voit qu'UNE fois (`vus` : { [uid]: fin }), au plus 7 jours après la fin.
export function importsAMontrer(etats, maintenant = Date.now(), vus = {}) {
  if (!etats || typeof etats !== 'object') return [];
  return Object.values(etats).filter((l) => {
    if (!l) return false;
    if (l.etat !== 'fini') return true;
    if (!l.fin) return false;
    if (l.horizonMois || l.annonces) return maintenant - l.fin < IMPORT_FINI_PROPOSE_MS && !(vus && Number(vus[l.uid]) === Number(l.fin));
    return maintenant - l.fin < IMPORT_FINI_VISIBLE_MS;
  });
}
// 5.373 : la marque « vu » des lignes finies montrées (rien à écrire ⇒ null).
export function marquerImportsVus(vus, montres) {
  const out = Object.assign({}, vus && typeof vus === 'object' ? vus : {});
  let change = false;
  for (const l of montres || []) if (l && l.etat === 'fini' && l.fin && (l.horizonMois || l.annonces) && Number(out[l.uid]) !== Number(l.fin)) { out[l.uid] = l.fin; change = true; }
  return change ? out : null;
}
