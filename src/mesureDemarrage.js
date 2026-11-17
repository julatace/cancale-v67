// ═══════════════════════════════════════════════════════════════════════════
// LES 10 PREMIÈRES MINUTES — « SANS ABUS » (16 nov., satisfaction-clients, point 4)
// ═══════════════════════════════════════════════════════════════════════════
// Julien (validé, mot pour mot : « sans abus ») : savoir OÙ les nouveaux vendeurs
// s'arrêtent dans le démarrage (le parcours en huit étapes, src/parcoursNouveau/),
// de façon ANONYME et MINIMALE.
//
// CE QUI EST RANGÉ — et rien d'autre : pour chaque étape ATTEINTE, le temps passé
// dans le parcours pour y arriver, en secondes arrondies à 10 s et plafonnées à
// une heure (`{ v: 1, t: { plateformes: 40, extension: 130, … } }`, dans SA ligne
// `main`, clé `vrm_mesure_demarrage`). Aucune date, aucun contenu, aucun e-mail,
// aucun pseudo, aucun appareil, aucun suivi hors de l'app, aucun service tiers.
// Le temps est celui passé DANS le parcours (repris là où il en était s'il
// revient trois jours plus tard) : jamais une heure d'horloge.
//
// COUPABLE : Paramètres → Sécurité des données → « Mesure du démarrage ».
// Coupée (`vrm_mesure_demarrage_coupee: true`, synchronisée) ⇒ rien n'est plus
// écrit ET ce qui l'était est effacé ; le serveur l'écarte aussi (double garde).
//
// CÔTÉ SERVEUR, REGROUPÉ (api/_lib/parcours-comptes.js, propriétaire seul) :
// `agregerDemarrage` ne rend que des NOMBRES PAR ÉTAPE, et rien du tout tant que
// moins de `SEUIL_ANONYMAT` (5) vendeurs sont mesurés ; un temps médian ne se dit
// que si au moins 5 vendeurs ont atteint l'étape. Le propriétaire et le
// propriétaire NEUTRE ne comptent pas.
// JS pur (l'app ET le serveur l'importent ; scripts/audit-satisfaction-clients.cjs l'exécute).
// ═══════════════════════════════════════════════════════════════════════════
export const CLE_MESURE_DEMARRAGE = 'vrm_mesure_demarrage';
export const CLE_MESURE_COUPEE = 'vrm_mesure_demarrage_coupee';
export const ETAPES_MESUREES = Object.freeze(['bienvenue', 'plateformes', 'extension', 'comptes', 'numeros', 'historique', 'journee', 'abonnement', 'fini']);
export const SEUIL_ANONYMAT = 5;
export const PLAFOND_S = 3600;
const NEUTRE = '00000000-0000-0000-0000-000000000000';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Les secondes telles qu'elles sont rangées : entières, arrondies à 10 s, 0 → PLAFOND_S.
export const secondesRangees = (s) => (Number.isFinite(Number(s)) && Number(s) >= 0 ? Math.min(PLAFOND_S, Math.round(Number(s) / 10) * 10) : null);

// La mesure rangée → { t: { etape: s } } ; tout champ inconnu tombe (une ligne bricolée n'apporte rien).
export function lireMesure(v) {
  const t = {};
  const src = v && typeof v === 'object' && !Array.isArray(v) && v.t && typeof v.t === 'object' ? v.t : {};
  for (const e of ETAPES_MESUREES) { const s = secondesRangees(src[e]); if (s !== null && Object.prototype.hasOwnProperty.call(src, e)) t[e] = s; }
  return { v: 1, t };
}

export const mesureCoupee = (v) => v === true || v === 'true';

// Il ATTEINT une étape : la PREMIÈRE fois seulement (jamais réécrite). Coupée ⇒ `null` (rien n'est écrit).
// Rend la nouvelle valeur à ranger, ou `undefined` quand rien ne change.
export function noterEtape(avant, etape, secondes, { coupee = false } = {}) {
  if (coupee) return null;
  if (!ETAPES_MESUREES.includes(etape)) return undefined;
  const m = lireMesure(avant);
  if (Object.prototype.hasOwnProperty.call(m.t, etape)) return undefined;
  const s = secondesRangees(secondes);
  if (s === null) return undefined;
  return { v: 1, t: { ...m.t, [etape]: s } };
}

// Le temps déjà passé dans le parcours quand il le rouvre à `etape` (le plus grand temps rangé
// jusqu'à cette étape) : on reprend le compte de là, jamais d'une date.
export function tempsDejaPasse(avant, etape) {
  const m = lireMesure(avant);
  const i = ETAPES_MESUREES.indexOf(etape);
  let max = 0;
  for (const [e, s] of Object.entries(m.t)) if (i < 0 || ETAPES_MESUREES.indexOf(e) <= i) max = Math.max(max, s);
  return max;
}

const mediane = (xs) => { const a = [...xs].sort((x, y) => x - y); const n = a.length; return n ? (n % 2 ? a[(n - 1) / 2] : Math.round((a[n / 2 - 1] + a[n / 2]) / 2)) : null; };

// LE REGROUPEMENT (serveur). `rows` : [{ owner, md, off }] (la projection de `main`) ; `null` = illisible.
// Rend { ok, assez, seuil, n?, etapes? } — `n` et `etapes` SEULEMENT si n ≥ seuil.
export function agregerDemarrage(rows, { proprio = null, seuil = SEUIL_ANONYMAT } = {}) {
  if (!Array.isArray(rows)) return { ok: false, raison: 'base' };
  const vus = new Set();
  const mesures = [];
  for (const r of rows) {
    const o = String((r && r.owner) || '').toLowerCase();
    if (!UUID.test(o) || o === NEUTRE || (proprio && o === String(proprio).toLowerCase()) || vus.has(o)) continue;
    if (mesureCoupee(r.off)) continue;                       // il l'a coupée : jamais compté
    const m = lireMesure(r.md);
    if (!Object.keys(m.t).length) continue;                  // jamais mesuré (compte d'avant, ou coupée puis effacée)
    vus.add(o); mesures.push(m.t);
  }
  const n = mesures.length;
  if (n < seuil) return { ok: true, assez: false, seuil };
  const etapes = ETAPES_MESUREES.map((e, i) => {
    // Atteindre une étape plus loin, c'est avoir passé celle-ci (une étape sautée par « Continuer » reste passée).
    const atteinte = mesures.filter((t) => ETAPES_MESUREES.slice(i).some((x) => Object.prototype.hasOwnProperty.call(t, x))).length;
    const temps = mesures.filter((t) => Object.prototype.hasOwnProperty.call(t, e)).map((t) => t[e]);
    return { etape: e, atteinte, mediane: temps.length >= seuil ? mediane(temps) : null };
  });
  // L'étape qui perd le plus : la plus forte chute entre deux étapes qui se suivent.
  let perte = null;
  for (let i = 1; i < etapes.length; i++) {
    const p = etapes[i - 1].atteinte - etapes[i].atteinte;
    if (p > 0 && (!perte || p > perte.perdus)) perte = { apres: etapes[i - 1].etape, perdus: p };
  }
  return { ok: true, assez: true, seuil, n, etapes, perte };
}
