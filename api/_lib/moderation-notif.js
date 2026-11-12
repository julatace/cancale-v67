// api/_lib/moderation-notif.js
// ────────────────────────────────────────────────────────────────────────────
// (11 nov., ext. 5.350) « VINTED A MASQUÉ / A FAIT DISPARAÎTRE / LIMITE » —
// LA NOTIFICATION, CÔTÉ SERVEUR. La règle (ce qui est une alerte, jamais deux
// fois, le texte) est src/moderationVinted.js, la même que l'app (§11). Ici, au
// nom du vendeur du `contexteVendeur` courant, avec la clé de service :
//   1. lire SES lignes `moderation_vinted_{uid}` (projection `e` seulement) et
//      les comptes qu'on lui connaît (`vinted_accounts`, moins les comptes
//      retirés) — une lecture ratée ⇒ 503, rien envoyé ;
//   2. dans SA ligne `vrm_moderation_notifie` (comparer-et-échanger sur `rev`) :
//      RÉSERVER les événements à notifier — l'écriture confirmée AVANT l'envoi :
//      deux appels en même temps (deux Chrome, le cron) n'envoient qu'une fois ;
//   3. UNE notification pour tout le lot (famille « Vinted : annonce cachée ou
//      compte limité », allumée par défaut ; heures calmes et regroupement de
//      `sendPushToAll` : la nuit, elle attend dans la cloche, jamais perdue).
// Appelée par l'extension (`/api/push`, action `moderation`, quand elle range un
// événement neuf) et par le cron du matin et du soir (api/ship-reminders.js), le
// filet quand l'envoi de l'extension a échoué. Aucune nouvelle fonction.
// ────────────────────────────────────────────────────────────────────────────
import { proprietaireCourant } from './owner.js';
import { sbCle } from './cle.js';
import { fetchAvecDelai } from './fetch-delai.js';   // (11 nov.) chaque appel sortant a un délai
import { sendPushToAll, pushCategorieActive } from './push.js';
import { DESTINATIONS } from './lien-notif.js';
import { CAT_MODERATION, LIGNE_MODERATION_NOTIFIE, SELECT_MODERATION, evenementsDesLignes, aNotifierModeration, texteNotifModeration } from '../../src/moderationVinted.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const cle = () => process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';
const MEMOIRE_JOURS = 30;

async function lire(chemin) {
  const owner = proprietaireCourant();
  if (!owner || !cle()) return null;
  try {
    const r = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/${chemin}${chemin.includes('?') ? '&' : '?'}owner=eq.${encodeURIComponent(owner)}`, { headers: { ...sbCle(cle()) } });
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j) ? j : null;
  } catch (_) { return null; }
}

// Comparer-et-échanger sur `data.rev` de SA mémoire. true écrit · false rien · null pas su.
async function modifierMemoire(modifier, essais = 5) {
  const owner = proprietaireCourant();
  if (!owner || !cle()) return null;
  const tete = { ...sbCle(cle()), 'Content-Type': 'application/json' };
  for (let n = 0; n < essais; n++) {
    const rows = await lire(`app_data?id=eq.${LIGNE_MODERATION_NOTIFIE}&select=data`);
    if (rows === null) return null;
    const present = !!rows[0];
    const d = present ? (rows[0].data || {}) : null;
    const nouveau = modifier(d);
    if (nouveau === undefined) return false;
    const rev0 = (d && Number.isSafeInteger(d.rev) && d.rev >= 0) ? d.rev : null;
    const data = { ...nouveau, rev: (rev0 || 0) + 1 };
    try {
      if (!present) {
        const w = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=owner,id`, {
          method: 'POST', headers: { ...tete, Prefer: 'resolution=ignore-duplicates,return=representation' },
          body: JSON.stringify([{ owner, id: LIGNE_MODERATION_NOTIFIE, data }]),
        });
        if (!w.ok) return null;
        const out = await w.json().catch(() => null);
        if (!Array.isArray(out)) return null;
        if (out.length >= 1) return true;
        continue;                                          // quelqu'un l'a créée entre-temps : on relit
      }
      const garde = rev0 == null ? 'data->>rev=is.null' : `data->>rev=eq.${rev0}`;
      const w = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${LIGNE_MODERATION_NOTIFIE}&owner=eq.${encodeURIComponent(owner)}&${garde}&select=id`, {
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
export async function notifierModeration({ maintenant = Date.now() } = {}) {
  if (!proprietaireCourant()) return { status: 401, envoye: false, n: 0, raison: 'vendeur inconnu' };
  const [rows, comptes, retires] = await Promise.all([
    lire(`app_data?id=like.moderation_vinted_*&select=${SELECT_MODERATION}`),
    lire('vinted_accounts?select=vinted_user_id,login'),
    lire('app_data?id=eq.vrm_blocked_accounts&select=u:data->uids'),
  ]);
  if (rows === null || comptes === null || retires === null) return { status: 503, envoye: false, n: 0, raison: 'lignes illisibles — rien envoyé' };
  // Seulement SES comptes, et jamais un compte qu'il a retiré (« ne plus lui en parler »).
  const noirs = new Set(((retires[0] && Array.isArray(retires[0].u)) ? retires[0].u : []).map(String));
  const noms = new Map(comptes.filter((c) => c && c.vinted_user_id != null && !noirs.has(String(c.vinted_user_id))).map((c) => [String(c.vinted_user_id), String(c.login || '')]));
  const evts = (evenementsDesLignes(rows) || []).filter((e) => noms.has(e.compte));
  const actif = await pushCategorieActive(CAT_MODERATION);
  let reserves = [];
  const r = await modifierMemoire((d) => {
    reserves = [];
    const cles = { ...((d && d.cles && typeof d.cles === 'object') ? d.cles : {}) };
    const lim = maintenant - MEMOIRE_JOURS * 864e5;
    let change = false;
    for (const k of Object.keys(cles)) if (!(Number(cles[k]) > lim)) { delete cles[k]; change = true; }
    if (actif) {
      reserves = aNotifierModeration(evts, cles, maintenant);
      for (const e of reserves) { cles[e.cle] = maintenant; change = true; }
    }
    return change ? { cles } : undefined;
  });
  if (r === null) return { status: 503, envoye: false, n: 0, raison: 'mémoire illisible ou pas écrite — rien envoyé' };
  if (!actif) return { status: 200, envoye: false, n: 0, raison: 'désactivé par le vendeur' };
  if (r !== true || !reserves.length) return { status: 200, envoye: false, n: 0, raison: 'rien de neuf à annoncer' };
  const tx = texteNotifModeration(reserves, { nomCompte: (uid) => noms.get(String(uid)) || '' });
  const envoi = await sendPushToAll({ cat: CAT_MODERATION, ...tx, tag: 'vrm-moderation-' + reserves.map((e) => e.cle).join('|').slice(0, 60), url: DESTINATIONS.journee() });
  return { status: 200, envoye: !!(envoi && envoi.sent), n: reserves.length, raison: (envoi && (envoi.coupe || envoi.erreur || (envoi.calme ? 'heures calmes' : ''))) || '' };
}
