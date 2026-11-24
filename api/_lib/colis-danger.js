// ════════════════════════════════════════════════════════════════════════════
//  « COLIS EN DANGER » — LE COLIS VENDU QUI VA REPARTIR DU POINT (23 nov.)
// ════════════════════════════════════════════════════════════════════════════
// Julien (23 nov., oui à la proposition) : « pour tes ventes, VRM relit le colis jusqu'à ce que
// l'acheteur le récupère et te prévient avant qu'il reparte (au point relais Vinted Go seulement
// pour commencer) ». Mesures et plan : docs/passation/2026-11-23-colis-danger.md.
//
// LA RÈGLE (pure ; le cron lit, réserve et envoie — api/ship-reminders.js) :
//   · le colis : une ligne `depart_vinted_{n°}` (le serveur relit le colis VENDU chez Vinted Go
//     jusqu'à la fin, api/_lib/depart-colis.js) en « disponible » au point relais de l'acheteur,
//     avec la date où il REPART LUE (`expiration_time` ⇒ `limiteAt`, `limiteSure`) — jamais une
//     date estimée : « pas su » ⇒ aucune alerte ;
//   · c'est une VENTE : son n° EXACT est celui d'UN bordereau de vente (`email_bord_{tx}`), d'une
//     seule transaction, ni annulé, ni le n° d'un retour (`email_bordretour_*`) ni d'un achat
//     (`transp_*`) — l'identité du colis est son n° de suivi, jamais un titre ;
//   · la lecture est FRAÎCHE (moins de `FRAICHEUR_DANGER_MS`) : un colis retiré entre-temps ne doit
//     pas faire sonner ; une lecture vieille ⇒ rien ;
//   · DEUX seuils, une fois chacun par colis (`push_dedup`) : `veille` (il repart DEMAIN, heure de
//     Paris) et `jour` (il repart AUJOURD'HUI, pas encore passé) ;
//   · le texte dit le geste : « Préviens ton acheteur : son colis repart le … ».
// Jamais « à retirer », jamais un code de retrait : le colis est celui de l'ACHETEUR.
import { departsParSuivi, SELECT_DEPART_META, limiteDepartLue } from './depart-colis.js';
import { normaliserSuivi } from './etat-colis-email.js';

export const FRAICHEUR_DANGER_MS = 8 * 3600000;
export const SEUILS_DANGER = Object.freeze(['veille', 'jour']);
export const cleDanger = (seuil, suivi) => `colis-danger-${seuil}-${normaliserSuivi(suivi)}`;
const str = (v) => String(v == null ? '' : v);
const msDe = (v) => { if (Number.isFinite(v)) return v; const t = Date.parse(str(v)); return Number.isFinite(t) ? t : null; };
export function jourParis(ms) {
  try { const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(ms)).map((x) => [x.type, x.value])); return `${p.year}-${p.month}-${p.day}`; } catch (_) { return ''; }
}

// Les ventes par n° : Map n° → { tx, article } ; un n° porté par deux transactions est écarté.
export function ventesParSuivi(bords) {
  const m = new Map(), doubles = new Set();
  for (const b of Array.isArray(bords) ? bords : []) {
    if (!b || b.annulee === true || b.annulee === 'true') continue;
    const k = normaliserSuivi(b.suivi), tx = str(b.transaction).trim();
    if (!k || !/^\d{3,20}$/.test(tx)) continue;
    if (m.has(k) && m.get(k).tx !== tx) doubles.add(k); else m.set(k, { tx, article: str(b.article).slice(0, 160) });
  }
  for (const k of doubles) m.delete(k);
  return m;
}

// (24 nov., lot suivi-ventes) LE SEUIL D'UNE LIGNE `depart_` seule — la règle de « Colis en danger », exportée pour
// que Ventes (le parcours d'un envoi, api/_lib/suivi-envoi.js) dise le MÊME danger que la notification, sans
// seconde règle : Vinted Go, « disponible », date LUE, lecture fraîche, pas clos, date pas passée ; 'jour' · 'veille' · null.
// L'IDENTITÉ (le n° d'UNE vente, ni retour ni achat) reste à l'appelant.
export function dangerDuDepart(t, maintenant = Date.now(), { auj = jourParis(maintenant), demain = jourParis(maintenant + 86400000) } = {}) {
  if (!limiteDepartLue(t) || t.clos) return null;
  const lu = msDe(t.lu);
  if (lu == null || lu > maintenant + 60000 || maintenant - lu > FRAICHEUR_DANGER_MS) return null;
  const lim = msDe(t.limiteAt);
  if (lim == null || lim <= maintenant) return null;
  const j = jourParis(lim);
  return j === auj ? 'jour' : j === demain ? 'veille' : null;
}

// departs : Map n° → ligne `depart_` ; bords : bordereaux de vente ; autres : Set des n° de retours
// et d'achats. Rend [{ seuil, cle, suivi, tx, article, limiteAt }].
export function colisEnDanger({ departs, bords, autres = new Set(), maintenant = Date.now() } = {}) {
  if (!(departs instanceof Map) || !Array.isArray(bords)) return [];
  const ventes = ventesParSuivi(bords);
  const auj = jourParis(maintenant), demain = jourParis(maintenant + 86400000);
  const out = [];
  for (const [k, t] of departs) {
    if (autres && autres.has(k)) continue;
    const v = ventes.get(k);
    if (!v) continue;
    const seuil = dangerDuDepart(t, maintenant, { auj, demain });
    if (!seuil) continue;
    const lim = msDe(t.limiteAt);
    out.push({ seuil, cle: cleDanger(seuil, k), suivi: k, tx: v.tx, article: v.article, limiteAt: new Date(lim).toISOString() });
  }
  return out;
}

// La passe, toutes ses entrées injectées (le banc l'exécute telle quelle).
//   lire(path) → lignes | null ; reserver(cle) → true · false (déjà dite) · null (pas su) ;
//   envoyer(notif) ; texte(n) → { title, body } ; active() → bool ; lien(n) → url.
export const REQ_DEPARTS_DANGER = `app_data?id=like.depart_vinted_%25&select=${SELECT_DEPART_META}`;
export const REQ_BORDS_VENTE = 'app_data?id=like.email_bord_%25&select=suivi:meta->>suivi,transaction:meta->>transaction,article:meta->>article,annulee:meta->>annulee';
export const REQ_BORDS_RETOUR_SUIVIS = 'app_data?id=like.email_bordretour_%25&select=suivi:meta->>suivi';
export const REQ_ACHATS_SUIVIS = 'app_data?id=like.transp_%25&select=suivi:meta->>suivi';
export async function passeColisDanger({ maintenant = Date.now(), lire, reserver, envoyer, texte, active, lien }) {
  if (!(await active())) return { fait: true, raison: 'désactivé par le vendeur', n: 0 };
  const rows = await lire(REQ_DEPARTS_DANGER);
  if (!Array.isArray(rows)) return { fait: false, raison: 'départs illisibles — rien envoyé' };
  const departs = departsParSuivi(rows) || new Map();
  if (![...departs.values()].some(limiteDepartLue)) return { fait: true, n: 0 };
  const [bords, retours, achats] = await Promise.all([lire(REQ_BORDS_VENTE), lire(REQ_BORDS_RETOUR_SUIVIS), lire(REQ_ACHATS_SUIVIS)]);
  if (![bords, retours, achats].every(Array.isArray)) return { fait: false, raison: 'lecture ratée — rien envoyé' };
  const autres = new Set([...retours, ...achats].map((r) => normaliserSuivi(r && r.suivi)).filter(Boolean));
  const liste = colisEnDanger({ departs, bords, autres, maintenant });
  let envoyees = 0, deja = 0, passu = 0;
  for (const n of liste) {
    const r = await reserver(n.cle);
    if (r === null) { passu++; continue; }
    if (r === false) { deja++; continue; }
    const t = texte(n);
    if (!t || !t.title) continue;
    await envoyer({ cat: 'colisdanger', title: t.title, body: t.body, tag: n.cle, cle: n.cle, url: lien(n), echeance: n.limiteAt, urgent: n.seuil === 'jour',
      redaction: { sorte: 'colisDanger', article: n.article, limite: n.limiteAt } });
    envoyees++;
  }
  return { fait: true, n: liste.length, envoyees, deja, passu };
}
