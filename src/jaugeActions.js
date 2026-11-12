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
export const SELECT_ACTIONS = 'id,ts:data->ts,max:data->>max,reserve:data->>reserve,prudence:data->>prudence,maxp:data->>maxPrudence,jour:data->jour,maxj:data->>maxJour,pj:data->>parJour,montee:data->>montee,captcha:data->>captcha,arret:data->>arret,ta:data->ta,ev:data->ev';
// (12 nov., ext. 5.370 — la discrétion) LE JOUR : chaque Chrome publie `jour: { d, n }` (jour de
// Paris, ses actions du jour) et le plafond du jour TIRÉ (`maxJour`, 70-100 % du réglage
// `parJour`). La somme des `n` du jour de Paris fait le compte ; le plus petit `maxJour` du jour,
// le plafond (le plus prudent). Ni `jour` ni `maxJour` ⇒ `nJour: null` (« pas su »).
// `montee` : le plafond horaire d'un compte NEUF (10 → 20 → 35) ; `captcha` : l'heure où Vinted a
// demandé une vérification (levée par SA reprise, voir src/discretion.js).
export function jourParisDe(ms) {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms)); }
  catch (_) { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
}
// (11 nov., ext. 5.357) LA PRUDENCE : après un refus de Vinted, le compte passe 24 h à
// `PLAFOND_PRUDENCE` actions/heure (le plafond normal ne bouge pas). Chaque Chrome publie
// l'heure de fin (`prudence`) ; la plus lointaine encore à venir fait foi, échue = levée.
export const PLAFOND_PRUDENCE = 20;
const PRUDENCE_MAX_MS = 24 * 3600000 + 60000;
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
  let max = null, reserve = null, prudence = null, maxp = null;
  const aujourdhui = jourParisDe(maintenant);
  let nJour = null, maxJour = null, parJour = null, montee = null, captcha = null, arret = null;
  for (const r of miennes) {
    if (r.jour && typeof r.jour === 'object' && r.jour.d === aujourdhui) { const k = Math.floor(Number(r.jour.n)); if (Number.isFinite(k) && k >= 0 && k < 100000) nJour = (nJour || 0) + k; }
    else if (r.jour && typeof r.jour === 'object' && typeof r.jour.d === 'string') nJour = nJour || 0;   // un jour d'avant : 0 aujourd'hui pour ce Chrome
    const mj = Number(r.maxj); if (r.maxj != null && Number.isFinite(mj) && mj > 0 && (maxJour == null || mj < maxJour)) maxJour = mj;
    const pj = Number(r.pj); if (r.pj != null && Number.isFinite(pj) && pj > 0 && parJour == null) parJour = pj;
    const mo = Number(r.montee); if (r.montee != null && Number.isFinite(mo) && mo > 0 && (montee == null || mo < montee)) montee = mo;
    const cp = Number(r.captcha); if (r.captcha != null && Number.isFinite(cp) && cp > 0 && cp <= maintenant + 60000 && (captcha == null || cp > captcha)) { captcha = cp; arret = ['captcha', 'moderation', 'deconnecte'].includes(r.arret) ? r.arret : 'captcha'; }
    for (const x of (Array.isArray(r.ts) ? r.ts : [])) {
      const v = Number(x);
      if (Number.isFinite(v) && maintenant - v < HEURE && v <= maintenant + 60000) heures.push(v);
    }
    const m = Number(r.max), z = Number(r.reserve);
    if (r.max != null && Number.isFinite(m) && m > 0 && max == null) max = m;
    if (r.reserve != null && Number.isFinite(z) && z >= 0 && reserve == null) reserve = z;
    const pr = Number(r.prudence), mp = Number(r.maxp);
    if (r.prudence != null && Number.isFinite(pr) && pr > maintenant && pr <= maintenant + PRUDENCE_MAX_MS && (prudence == null || pr > prudence)) { prudence = pr; maxp = Number.isFinite(mp) && mp > 0 ? mp : PLAFOND_PRUDENCE; }
  }
  heures.sort((a, b) => a - b);
  // En prudence, le plafond de la prudence vaut pour tout (l'extension ne garde pas de réserve).
  let plafond = prudence != null ? Math.min(maxp, max == null ? PLAFOND_HEURE : max) : (max == null ? PLAFOND_HEURE : max);
  if (montee != null && montee < plafond) plafond = montee;   // (5.370) compte neuf : son plafond de la semaine
  const res = prudence != null ? 0 : (reserve == null ? RESERVE_GESTES : reserve);
  const n = heures.length;
  return {
    n,
    max: plafond,
    pourApp: Math.max(0, plafond - res),
    plein: n >= plafond - res,
    prudence,
    // La plus ancienne action de l'heure sort du compte à cette heure-là : une place se libère.
    repartA: n ? heures[0] + HEURE : null,
    // (5.370) Le jour (null = pas su), le compte neuf, la vérification demandée.
    nJour: maxJour == null ? null : nJour, maxJour, parJour, montee, captcha, arret,
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
  // (5.370) « 112/200 aujourd'hui » : la même ligne, à part (`jour`). Pas su ⇒ rien d'écrit.
  const jour = j.nJour != null && j.maxJour ? `${j.nJour}/${j.maxJour} aujourd’hui` : '';
  const plein = !!(jour && j.nJour >= j.maxJour - (j.prudence ? 0 : RESERVE_GESTES));
  const r = plein && !j.prudence ? { valeur, suite: 'VRM reprend demain', ton: 'geste' } : texteJaugeHeure(j, valeur);
  return { ...r, jour, jourPlein: plein, montee: j.montee || null };
}
function texteJaugeHeure(j, valeur) {
  // (5.357) Prudence : un geste de Vinted à respecter ⇒ ambre, l'heure de fin dite.
  if (j.prudence) return { valeur, suite: `Prudence jusqu’à ${heureFr(j.prudence)}`, ton: 'geste', prudence: true };
  if (!j.n) return { valeur, suite: '', ton: '' };
  if (j.plein) return { valeur, suite: `VRM attend · repart à ${heureFr(j.repartA)}`, ton: 'geste' };
  return { valeur, suite: `repart à ${heureFr(j.repartA)}`, ton: '' };
}

// (12 nov., ajout validé) « TOUT ARRÊTER » : chaque Chrome publie SON interrupteur (`ta` : { on, at })
// dans ses lignes ; l'app range le sien dans `vinted_discretion.tout`. Le plus RÉCENT gagne
// (la même règle que l'extension, `toutArreteDepuis`). Rend { on, at, source } ou null (rien de posé).
export function toutArreteDe(rows, tout) {
  const c = [];
  for (const r of Array.isArray(rows) ? rows : []) if (r && r.ta && typeof r.ta === 'object' && Number(r.ta.at) > 0) c.push({ on: r.ta.on === true, at: Number(r.ta.at), source: 'extension' });
  if (tout && typeof tout === 'object' && Number(tout.at) > 0) c.push({ on: tout.on === true, at: Number(tout.at), source: 'app' });
  if (!c.length) return null;
  return c.sort((a, b) => b.at - a.at)[0];
}
