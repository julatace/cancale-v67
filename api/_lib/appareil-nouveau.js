// ═══════════════════════════════════════════════════════════════════════════
// « NOUVEL APPAREIL » — l'alerte quand son compte VRM s'ouvre sur un appareil
// jamais vu (10 nov., lot H ; migration 024 appliquée : `vrm_sessions_de`,
// `vrm_fermer_session`)
// ═══════════════════════════════════════════════════════════════════════════
// QUAND : à chaque ouverture de VRM (une fois par session du navigateur), l'app
// demande `POST /api/compte?mode=appareils {action:'verifier'}`. Le serveur relit
// SES sessions (identifiant du JETON vérifié, jamais de la requête) — donc
// l'ouverture par un intrus déclenche l'alerte tout de suite, et sinon la
// prochaine ouverture par Julien sur n'importe lequel de ses appareils la voit.
//
// « JAMAIS VU » = la SIGNATURE résumée du navigateur (« Mac · Chrome »,
// `resumerAppareil`) absente du registre `vrm_appareils_vus` (SA ligne, écrite
// par le serveur seul). Les sessions fabriquées par le serveur pour l'extension
// (« Serveur VRM ») ne comptent pas. Le registre ne contient AUCUN user agent
// brut, aucune IP : la signature et sa date.
// PREMIÈRE FOIS (aucun registre) : tout ce qui est connecté maintenant devient
// « connu », SANS alerte (sinon chaque vendeur recevrait une alerte au déploiement).
//
// Écritures concurrentes (deux appareils qui ouvrent VRM en même temps) :
// comparer-et-échanger sur `data.rev` — seul celui qui écrit envoie l'alerte.
// Une lecture ratée n'écrit rien et n'envoie rien (503).
// La notification : « Nouvel appareil : Chrome sur Mac. Ce n'est pas toi ? »,
// son toucher ouvre Paramètres → Appareils connectés avec CETTE session en
// évidence et « Déconnecter » (`vrm_fermer_session`, la route existante).
// Tenu par scripts/audit-agenda-appareil.cjs (EXÉCUTE api/compte.js).
// ═══════════════════════════════════════════════════════════════════════════
import { resumerAppareil } from './securite-compte.js';
import { DESTINATIONS } from './lien-notif.js';
import { fetchAvecDelai } from './fetch-delai.js';   // (11 nov.) chaque appel sortant a un délai

export const LIGNE_APPAREILS_VUS = 'vrm_appareils_vus';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IGNORES = new Set(['Serveur VRM']);

// « Mac · Chrome » ⇒ « Chrome sur Mac » ; « Appareil inconnu » ⇒ « un appareil inconnu ».
export function nomEnClair(signature) {
  const [app, nav] = String(signature || '').split(' · ');
  if (!app || app === 'Appareil inconnu') return nav ? `${nav} sur un appareil inconnu` : 'un appareil inconnu';
  return nav ? `${nav} sur ${app}` : app;
}
export function texteAlerte(signature) {
  return { title: 'Nouvel appareil', body: `${nomEnClair(signature)}. Ce n'est pas toi ?` };
}

// PURE. `sessions` : lignes de `vrm_sessions_de` ; `registre` : data de
// `vrm_appareils_vus` ou null (absent). Rend { init, nouveaux:[{id, signature}], registre }.
export function nouveauxAppareils(sessions, registre, maintenant = Date.now()) {
  const vues = new Map();
  for (const s of Array.isArray(sessions) ? sessions : []) {
    if (!s || !UUID.test(String(s.id || ''))) continue;
    const sig = resumerAppareil(s.user_agent);
    if (IGNORES.has(sig)) continue;
    if (!vues.has(sig)) vues.set(sig, String(s.id));
  }
  const at = new Date(maintenant).toISOString();
  if (!registre || typeof registre !== 'object' || !registre.signatures || typeof registre.signatures !== 'object') {
    const signatures = {};
    for (const sig of vues.keys()) signatures[sig] = at;
    return { init: true, nouveaux: [], registre: { v: 1, rev: 1, signatures } };
  }
  const signatures = { ...registre.signatures };
  const nouveaux = [];
  for (const [sig, id] of vues) {
    if (signatures[sig]) continue;
    signatures[sig] = at;
    nouveaux.push({ id, signature: sig });
  }
  return { init: false, nouveaux, registre: { v: 1, rev: (Number(registre.rev) || 0) + 1, signatures } };
}

// `deps` : { base, cle, user:{id}, fetch, pousser(notif) }.
export async function verifierNouvelAppareil(deps) {
  const { base, cle, user } = deps;
  const f = deps.fetch || fetchAvecDelai;
  if (!user || !UUID.test(String(user.id || ''))) return { status: 401, body: { erreur: 'session' } };
  if (!cle) return { status: 503, body: { erreur: 'non-configure' } };
  const H = { apikey: cle, Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' };
  // 1. SES sessions.
  let sessions;
  try {
    const r = await f(`${base}/rest/v1/rpc/vrm_sessions_de`, { method: 'POST', headers: H, body: JSON.stringify({ p_user: user.id }), signal: AbortSignal.timeout(10000) });
    if (!r || !r.ok) return { status: 503, body: { erreur: 'base' } };
    sessions = await r.json();
    if (!Array.isArray(sessions)) return { status: 503, body: { erreur: 'base' } };
  } catch (_) { return { status: 503, body: { erreur: 'base' } }; }
  // Double barrière : une ligne d'un autre utilisateur (fonction mal réécrite) ne compte pas.
  sessions = sessions.filter((s) => s && (s.user_id == null || String(s.user_id) === String(user.id)));
  // 2. Son registre.
  let registre, rev = null;
  try {
    const r = await f(`${base}/rest/v1/app_data?owner=eq.${user.id}&id=eq.${LIGNE_APPAREILS_VUS}&select=data&limit=1`, { headers: H });
    if (!r || !r.ok) return { status: 503, body: { erreur: 'base' } };
    const j = await r.json();
    if (!Array.isArray(j)) return { status: 503, body: { erreur: 'base' } };
    registre = j[0] && j[0].data ? j[0].data : null;
    if (registre) rev = Number(registre.rev) || 0;
  } catch (_) { return { status: 503, body: { erreur: 'base' } }; }
  const calc = nouveauxAppareils(sessions, registre);
  if (!calc.init && !calc.nouveaux.length) return { status: 200, body: { ok: true, nouveaux: 0 } };
  // 3. Écrire AVANT d'alerter, en comparer-et-échanger : un seul écrivain alerte.
  const now = new Date().toISOString();
  let ecrit = false;
  try {
    if (registre) {
      const r = await f(`${base}/rest/v1/app_data?owner=eq.${user.id}&id=eq.${LIGNE_APPAREILS_VUS}&data->>rev=eq.${rev}`, {
        method: 'PATCH', headers: { ...H, Prefer: 'return=representation' }, body: JSON.stringify({ data: calc.registre, updated_at: now }),
      });
      const j = r && r.ok ? await r.json().catch(() => null) : null;
      ecrit = Array.isArray(j) && j.length === 1;
    } else {
      const r = await f(`${base}/rest/v1/app_data`, {
        method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify([{ owner: user.id, id: LIGNE_APPAREILS_VUS, data: calc.registre, updated_at: now }]),
      });
      ecrit = !!(r && r.ok);   // 409 : un autre appareil vient de l'initialiser
    }
  } catch (_) { ecrit = false; }
  if (!ecrit) return { status: 200, body: { ok: true, nouveaux: 0, conflit: true } };
  if (calc.init) return { status: 200, body: { ok: true, init: true, nouveaux: 0 } };
  let envoyes = 0;
  for (const n of calc.nouveaux) {
    const t = texteAlerte(n.signature);
    try {
      const res = deps.pousser ? await deps.pousser({ ...t, cat: 'securite', tag: `appareil-${n.id}`,
        // Une intrusion se coupe MAINTENANT : elle sonne même pendant les heures calmes
        // (`echeancePressante`), et reste dans la cloche.
        echeance: Date.now() + 60000, url: DESTINATIONS.appareil({ session: n.id }) }) : null;
      if (res && res.sent > 0) envoyes++;
    } catch (_) {}
  }
  return { status: 200, body: { ok: true, nouveaux: calc.nouveaux.length, envoyes } };
}
