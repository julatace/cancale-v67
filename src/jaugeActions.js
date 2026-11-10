// ═══════════════════════════════════════════════════════════════════════════
// LA JAUGE DU PLAFOND ET LE JOURNAL « CE QUE VRM A FAIT » (10 nov., lot G, ext. 5.337)
// ═══════════════════════════════════════════════════════════════════════════
// Validé par Julien (docs/passation/2026-11-09-propositions.md, 2 et 3).
// Règles PURES : aucune lecture ici, aucun rendu. src/JaugeActions.jsx lit les lignes
// et passe par ces fonctions.
//
// 1. LA JAUGE — le plafond de 50 actions/heure est celui du COMPTE, tous Chrome
//    confondus (CLAUDE.md §3, 5.312). Chaque Chrome publie SES heures de la dernière
//    heure dans `actions_compte_{uid}_{navigateur}` ; l'extension additionne celles des
//    autres avant de dire oui (`actionsAutresNavigateurs` + sa liste). Ici, la MÊME
//    somme : chaque heure de moins d'une heure (et pas plus d'une minute dans le
//    futur), de chaque ligne EXACTEMENT de ce compte (dans LIKE, « _ » vaut n'importe
//    quel caractère : « …_123_* » ramènerait le compte 1234).
//    Aucune ligne pour ce compte ⇒ `null` : « pas su », jamais « 0 ». Une lecture
//    ratée (rows non tableau) ⇒ `null` aussi.
// 2. LE JOURNAL — les gestes que l'extension note (`journal_vrm_{uid}_{navigateur}`) sont
//    lus par le serveur avec les autres sources de « Ce que VRM a fait »
//    (api/_lib/securite-compte.js, `evenementsExtension`) : une seule règle, un écran.
// ═══════════════════════════════════════════════════════════════════════════

export const PREFIXE_ACTIONS = 'actions_compte_';
export const SELECT_ACTIONS = 'id,ts:data->ts,max:data->>max,reserve:data->>reserve';
export const PLAFOND_HEURE = 50;      // CLAUDE.md §3 (sa décision du 29 oct.)
export const RESERVE_GESTES = 5;      // les 5 dernières restent à SES clics ⇒ 45 pour l'app
const HEURE = 3600000;

const uidOk = (u) => /^\d{1,20}$/.test(String(u == null ? '' : u));
const ligneDe = (prefixe, uid, id) => new RegExp(`^${prefixe}${uid}_[0-9a-f]{16}$`).test(String(id || ''));

// Les heures de la dernière heure, tous Chrome confondus. `null` = pas su.
export function jaugeDuCompte(rows, uid, maintenant = Date.now()) {
  if (!Array.isArray(rows) || !uidOk(uid)) return null;
  const u = String(uid);
  const miennes = rows.filter((r) => r && ligneDe(PREFIXE_ACTIONS, u, r.id));
  if (!miennes.length) return null;
  const heures = [];
  let max = null, reserve = null;
  for (const r of miennes) {
    for (const x of (Array.isArray(r.ts) ? r.ts : [])) {
      const v = Number(x);
      if (Number.isFinite(v) && maintenant - v < HEURE && v <= maintenant + 60000) heures.push(v);
    }
    const m = Number(r.max), z = Number(r.reserve);
    if (r.max != null && Number.isFinite(m) && m > 0 && max == null) max = m;
    if (r.reserve != null && Number.isFinite(z) && z >= 0 && reserve == null) reserve = z;
  }
  heures.sort((a, b) => a - b);
  const plafond = max == null ? PLAFOND_HEURE : max;
  const res = reserve == null ? RESERVE_GESTES : reserve;
  const n = heures.length;
  return {
    n,
    max: plafond,
    pourApp: Math.max(0, plafond - res),
    plein: n >= plafond - res,
    // La plus ancienne action de l'heure sort du compte à cette heure-là : une place se libère.
    repartA: n ? heures[0] + HEURE : null,
  };
}

// L'heure de Paris (« 21 h 40 »), quel que soit le fuseau de l'appareil.
export function heureFr(ms) {
  try {
    const p = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: 'numeric', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms));
    const h = (p.find((x) => x.type === 'hour') || {}).value, m = (p.find((x) => x.type === 'minute') || {}).value;
    if (h != null && m != null) return `${Number(h)} h ${m}`;
  } catch (_) {}
  const d = new Date(ms);
  return `${d.getHours()} h ${String(d.getMinutes()).padStart(2, '0')}`;
}

// Le texte de la jauge (une ligne). `null` ⇒ « — » et la raison courte.
export function texteJauge(j) {
  if (!j) return { valeur: '—', suite: 'pas encore dit par l’extension', ton: 'passu' };
  const valeur = `${j.n}/${j.max} cette heure`;
  if (!j.n) return { valeur, suite: '', ton: '' };
  if (j.plein) return { valeur, suite: `VRM attend · repart à ${heureFr(j.repartA)}`, ton: 'geste' };
  return { valeur, suite: `repart à ${heureFr(j.repartA)}`, ton: '' };
}
