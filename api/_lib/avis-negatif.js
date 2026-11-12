// api/_lib/avis-negatif.js
// ────────────────────────────────────────────────────────────────────────────
// (11 nov., lot avis-negatif) « AVIS 2★ REÇU SUR shop_x » — CÔTÉ SERVEUR.
// La règle (forme mesurée, ligne de base, « jamais deux fois », liens) est
// src/avisNegatif.js, la même que l'app (§11). Ici, au nom du vendeur du
// `contexteVendeur` courant, avec la clé de service :
//   1. lire ses comptes Vinted PRÉSENTS (`vinted_accounts` moins
//      `vrm_blocked_accounts`) et, par PROJECTION, les avis déjà lus par
//      l'extension (`harvest_{uid}_feedbacks` → `payload.user_feedbacks`, jamais
//      `select=data`) et l'id de profil (`harvest_{uid}_profile`) ;
//      une lecture ratée ⇒ RIEN (ni écrit, ni envoyé) ;
//   2. dans SA ligne `vrm_avis_bas` (comparer-et-échanger sur `rev`) : poser la
//      ligne de base d'un compte jamais vu, retenir les identifiants vus, ajouter
//      les alertes ≤ seuil (`push_prefs.avisSeuil`, défaut 3) et les RÉSERVER
//      (`notifie`) — écrit AVANT l'envoi : deux appels en même temps n'envoient
//      qu'une fois ;
//   3. une notification par compte (famille « Avis reçu », allumée par défaut,
//      heures calmes et regroupement de `sendPushToAll`), rangée dans la cloche.
//      Le toucher : la vente (n° de transaction porté par l'avis) sinon le profil
//      des avis sur Vinted. Jamais le texte de l'avis, jamais un acheteur.
// Appelée par l'extension (`/api/push`, action `avis`, juste après sa lecture
// des avis) et par le cron du matin et du soir (api/ship-reminders.js), le filet.
// Aucune requête Vinted, aucune nouvelle fonction (12 au plus).
// ────────────────────────────────────────────────────────────────────────────
import { proprietaireCourant } from './owner.js';
import { sbCle } from './cle.js';
import { sendPushToAll, pushCategorieActive, prefsDuVendeur } from './push.js';
import { DESTINATIONS } from './lien-notif.js';
import {
  LIGNE_AVIS_BAS, CAT_AVIS, reglageSeuilAvis, uidDeLigne, avisDeLaLigne, normaliserMemoireAvis,
  detecterAvisBas, ajouterAlertes, lienAvisVinted, texteAvisBas, cleAlerte,
} from '../../src/avisNegatif.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const cle = () => process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';
const RE_UID = /^\d{1,20}$/;

// Un tableau lu, ou `null` (pas su, ou pas de vendeur).
async function lire(chemin) {
  const owner = proprietaireCourant();
  if (!owner || !cle()) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${chemin}${chemin.includes('?') ? '&' : '?'}owner=eq.${encodeURIComponent(owner)}`, { headers: { ...sbCle(cle()) } });
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j) ? j : null;
  } catch (_) { return null; }
}

// Les requêtes (exportées pour les bancs : la vraie forme servie).
export const REQ_AVIS = 'app_data?id=like.harvest_*_feedbacks&data->>type=eq.feedbacks&select=id,avis:data->payload->user_feedbacks';
export const REQ_PROFILS = 'app_data?id=like.harvest_*_profile&select=id,pid:data->payload->user->>id';
export const REQ_COMPTES = 'vinted_accounts?select=vinted_user_id,login,domain';
export const REQ_BLOQUES = 'app_data?id=eq.vrm_blocked_accounts&select=u:data->uids';

// Comparer-et-échanger sur `data.rev` de `vrm_avis_bas`. `modifier(d)` reçoit
// l'objet lu (`null` = absente) et rend l'objet à écrire, ou `undefined` (rien).
// Rend true (écrit) · false (rien à écrire) · null (pas su).
async function modifierLigne(modifier, essais = 5) {
  const owner = proprietaireCourant();
  if (!owner || !cle()) return null;
  const tete = { ...sbCle(cle()), 'Content-Type': 'application/json' };
  for (let n = 0; n < essais; n++) {
    const rows = await lire(`app_data?id=eq.${LIGNE_AVIS_BAS}&select=data`);
    if (rows === null) return null;
    const present = !!rows[0];
    const d = present ? (rows[0].data || {}) : null;
    const nouveau = modifier(d);
    if (nouveau === undefined) return false;
    const rev0 = (d && Number.isSafeInteger(d.rev) && d.rev >= 0) ? d.rev : null;
    const { rev: _r, ...propre } = nouveau;
    const data = { ...propre, rev: (rev0 || 0) + 1 };
    try {
      if (!present) {
        const w = await fetch(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=owner,id`, {
          method: 'POST', headers: { ...tete, Prefer: 'resolution=ignore-duplicates,return=representation' },
          body: JSON.stringify([{ owner, id: LIGNE_AVIS_BAS, data, updated_at: new Date().toISOString() }]),
        });
        if (!w.ok) return null;
        const out = await w.json().catch(() => null);
        if (!Array.isArray(out)) return null;
        if (out.length >= 1) return true;
        continue;
      }
      const garde = rev0 == null ? 'data->>rev=is.null' : `data->>rev=eq.${rev0}`;
      const w = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${LIGNE_AVIS_BAS}&owner=eq.${encodeURIComponent(owner)}&${garde}&select=id`, {
        method: 'PATCH', headers: { ...tete, Prefer: 'return=representation' }, body: JSON.stringify({ data, updated_at: new Date().toISOString() }),
      });
      if (!w.ok) return null;
      const out = await w.json().catch(() => null);
      if (!Array.isArray(out)) return null;
      if (out.length >= 1) return true;
      await new Promise((ok) => setTimeout(ok, 25 * (n + 1)));
    } catch (_) { return null; }
  }
  return null;
}

// Rend { status, envoye, n, raison } — jamais d'exception.
// `uid` (facultatif) : l'extension dit QUEL compte elle vient de lire ; la route
// ne relit que lui (et refuse un compte qui n'est pas à ce vendeur).
export async function notifierAvisBas({ uid = null, maintenant = Date.now() } = {}) {
  if (!proprietaireCourant()) return { status: 401, envoye: false, n: 0, raison: 'vendeur inconnu' };
  if (uid != null && !RE_UID.test(String(uid))) return { status: 400, envoye: false, n: 0, raison: 'compte illisible' };
  const [comptes, bloques, lignes, profils, prefs] = await Promise.all([
    lire(REQ_COMPTES), lire(REQ_BLOQUES),
    lire(uid ? `app_data?id=eq.harvest_${uid}_feedbacks&data->>type=eq.feedbacks&select=id,avis:data->payload->user_feedbacks` : REQ_AVIS),
    lire(uid ? `app_data?id=eq.harvest_${uid}_profile&select=id,pid:data->payload->user->>id` : REQ_PROFILS),
    prefsDuVendeur().catch(() => null),
  ]);
  if (comptes === null || bloques === null || lignes === null) return { status: 503, envoye: false, n: 0, raison: 'lecture ratée — rien écrit ni envoyé' };
  const noirs = new Set(((bloques[0] && Array.isArray(bloques[0].u)) ? bloques[0].u : []).map(String));
  const presents = new Map();
  for (const a of comptes) { const id = String((a && a.vinted_user_id) || ''); if (RE_UID.test(id) && !noirs.has(id)) presents.set(id, { nom: String((a && a.login) || ''), domaine: (a && a.domain) || '' }); }
  if (uid && !presents.has(String(uid))) return { status: 403, envoye: false, n: 0, raison: 'compte pas à ce vendeur' };
  const pids = new Map((profils || []).map((p) => [String(p && p.id || '').replace(/^harvest_(\d+)_profile$/, '$1'), p && p.pid]));
  // Les avis LUS, compte par compte (forme mesurée ; « pas su » ⇒ le compte est sauté).
  const lus = [];
  for (const l of lignes) {
    const u = uidDeLigne(l && l.id);
    if (!u || !presents.has(u)) continue;
    const avis = avisDeLaLigne(l.avis);
    if (avis) lus.push({ uid: u, avis });
  }
  if (!lus.length) return { status: 200, envoye: false, n: 0, raison: 'aucun avis lu' };
  const seuil = reglageSeuilAvis(prefs || {});
  const actif = await pushCategorieActive(CAT_AVIS);
  let neuves = [];
  const r = await modifierLigne((d) => {
    neuves = [];
    const m = normaliserMemoireAvis(d);
    let change = d === null;
    let alertes = m.alertes;
    for (const { uid: u, avis } of lus) {
      const res = detecterAvisBas(m.comptes[u] || null, avis, seuil, maintenant);
      if (res.etat === 'passu') continue;
      if (JSON.stringify(res.compte) !== JSON.stringify(m.comptes[u] || null)) { m.comptes[u] = res.compte; change = true; }
      if (res.etat === 'lu' && res.bas.length) {
        const a = ajouterAlertes(alertes, u, res.bas, maintenant);
        alertes = a.alertes;
        if (a.neuves.length) { change = true; neuves.push(...a.neuves); }
      }
    }
    // Réservées AVANT l'envoi (une seule fois, même pendant les heures calmes : la cloche les garde).
    if (actif && neuves.length) {
      const k = new Set(neuves.map(cleAlerte));
      const at = new Date(maintenant).toISOString();
      alertes = alertes.map((a) => (k.has(cleAlerte(a)) ? { ...a, notifie: at } : a));
    }
    return change ? { comptes: m.comptes, alertes } : undefined;
  });
  if (r === null) return { status: 503, envoye: false, n: 0, raison: 'mémoire illisible ou pas écrite — rien envoyé' };
  if (r !== true || !neuves.length) return { status: 200, envoye: false, n: 0, raison: 'aucun avis neuf sous le seuil' };
  if (!actif) return { status: 200, envoye: false, n: neuves.length, raison: 'désactivé par le vendeur' };
  // UNE notification par compte.
  const parCompte = new Map();
  for (const a of neuves) { if (!parCompte.has(a.uid)) parCompte.set(a.uid, []); parCompte.get(a.uid).push(a); }
  let envoye = false; const raisons = [];
  for (const [u, l] of parCompte) {
    const c = presents.get(u) || {};
    const tx = texteAvisBas({ nom: c.nom, avis: l, seuil });
    if (!tx) continue;
    const url = (l.length === 1 && l[0].tx) ? DESTINATIONS.vente({ tx: l[0].tx }) : (lienAvisVinted({ domaine: c.domaine, pid: pids.get(u), uid: u }) || DESTINATIONS.journee());
    const e = await sendPushToAll({ cat: CAT_AVIS, ...tx, tag: 'vrm-avis-' + u + '-' + l.map((a) => a.id).join('-').slice(0, 60), url });
    if (e && e.sent) envoye = true;
    const why = e && (e.coupe || e.erreur || (e.calme ? 'heures calmes' : ''));
    if (why) raisons.push(why);
  }
  return { status: 200, envoye, n: neuves.length, raison: raisons.join(', ') };
}
