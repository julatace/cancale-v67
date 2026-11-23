// api/_lib/compte-bloque-notif.js
// ────────────────────────────────────────────────────────────────────────────
// (19 nov., lot compte-bloque, ext. 5.409) « ⛔ VINTED A BLOQUÉ {COMPTE} » et
// « ✅ {COMPTE} EST DÉBLOQUÉ : N ANNONCES REMISES » — LA NOTIFICATION, CÔTÉ
// SERVEUR, quand l'app est fermée. La règle est src/compteBloque.js (la même que
// l'app, §11). Au nom du vendeur du `contexteVendeur` courant, clé de service :
//   1. lire `panel_comptes_etat` (projection `comptes`), SON choix
//      (`main.vrm_comptes_bloques`, projeté), ses comptes (`vinted_accounts`)
//      moins les comptes retirés — une lecture ratée ⇒ 503, rien envoyé ;
//   2. RÉSERVER dans `vrm_compte_bloque_notifie` (comparer-et-échanger sur `rev`)
//      AVANT l'envoi : deux appels en même temps n'envoient qu'une fois ;
//   3. UNE notification (famille « Vinted : annonce cachée ou compte limité »,
//      allumée par défaut ; heures calmes de `sendPushToAll`).
// Appelée par l'extension (`/api/push`, action `comptebloque`, au changement
// d'état lu dans le profil) et par le cron du matin et du soir (le filet, et le
// seul chemin pour une extension d'avant la 5.409). Aucune nouvelle fonction.
// ────────────────────────────────────────────────────────────────────────────
import { proprietaireCourant } from './owner.js';
import { sbCle } from './cle.js';
import { fetchAvecDelai } from './fetch-delai.js';
import { sendPushToAll, pushCategorieActive } from './push.js';
import { DESTINATIONS } from './lien-notif.js';
import { CAT_MODERATION } from '../../src/moderationVinted.js';
import { CLE_COMPTES_BLOQUES, LIGNE_COMPTE_BLOQUE_NOTIFIE, aNotifierComptesBloques, texteNotifComptesBloques } from '../../src/compteBloque.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const cle = () => process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';
const MEMOIRE_JOURS = 120;

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

// Comparer-et-échanger sur `data.rev`. true écrit · false rien à écrire · null pas su.
async function modifierMemoire(modifier, essais = 5) {
  const owner = proprietaireCourant();
  if (!owner || !cle()) return null;
  const tete = { ...sbCle(cle()), 'Content-Type': 'application/json' };
  for (let n = 0; n < essais; n++) {
    const rows = await lire(`app_data?id=eq.${LIGNE_COMPTE_BLOQUE_NOTIFIE}&select=data`);
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
          body: JSON.stringify([{ owner, id: LIGNE_COMPTE_BLOQUE_NOTIFIE, data }]),
        });
        if (!w.ok) return null;
        const out = await w.json().catch(() => null);
        if (!Array.isArray(out)) return null;
        if (out.length >= 1) return true;
        continue;
      }
      const garde = rev0 == null ? 'data->>rev=is.null' : `data->>rev=eq.${rev0}`;
      const w = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${LIGNE_COMPTE_BLOQUE_NOTIFIE}&owner=eq.${encodeURIComponent(owner)}&${garde}&select=id`, {
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
export async function notifierComptesBloques({ maintenant = Date.now() } = {}) {
  if (!proprietaireCourant()) return { status: 401, envoye: false, n: 0, raison: 'vendeur inconnu' };
  const [etatsL, choixL, comptes, retires] = await Promise.all([
    lire('app_data?id=eq.panel_comptes_etat&select=c:data->comptes'),
    lire(`app_data?id=eq.main&select=ch:data->${CLE_COMPTES_BLOQUES}`),
    lire('vinted_accounts?select=vinted_user_id,login'),
    lire('app_data?id=eq.vrm_blocked_accounts&select=u:data->uids'),
  ]);
  if (etatsL === null || choixL === null || comptes === null || retires === null) return { status: 503, envoye: false, n: 0, raison: 'lignes illisibles — rien envoyé' };
  const etats = (etatsL[0] && etatsL[0].c && typeof etatsL[0].c === 'object') ? etatsL[0].c : {};
  const choix = (choixL[0] && choixL[0].ch && typeof choixL[0].ch === 'object') ? choixL[0].ch : {};
  const noirs = new Set(((retires[0] && Array.isArray(retires[0].u)) ? retires[0].u : []).map(String));
  const noms = new Map(comptes.filter((c) => c && c.vinted_user_id != null && !noirs.has(String(c.vinted_user_id))).map((c) => [String(c.vinted_user_id), String(c.login || '')]));
  const actif = await pushCategorieActive(CAT_MODERATION);
  let reserves = [];
  const r = await modifierMemoire((d) => {
    reserves = [];
    const cles = { ...((d && d.cles && typeof d.cles === 'object') ? d.cles : {}) };
    const lim = maintenant - MEMOIRE_JOURS * 864e5;
    let change = false;
    for (const k of Object.keys(cles)) if (!(Number(cles[k]) > lim)) { delete cles[k]; change = true; }
    const { out, oublier } = aNotifierComptesBloques({ etats, choix, uids: new Set(noms.keys()), cles, maintenant });
    for (const k of oublier) { delete cles[k]; change = true; }
    if (actif) { reserves = out; for (const e of out) { cles[e.cle] = maintenant; change = true; } }
    return change ? { cles } : undefined;
  });
  if (r === null) return { status: 503, envoye: false, n: 0, raison: 'mémoire illisible ou pas écrite — rien envoyé' };
  if (!actif) return { status: 200, envoye: false, n: 0, raison: 'désactivé par le vendeur' };
  if (r !== true || !reserves.length) return { status: 200, envoye: false, n: 0, raison: 'rien de neuf à annoncer' };
  const tx = texteNotifComptesBloques(reserves, (uid) => noms.get(String(uid)) || '');
  const envoi = await sendPushToAll({ cat: CAT_MODERATION, ...tx, tag: 'vrm-compte-bloque-' + reserves.map((e) => e.cle).join('|').slice(0, 60), url: DESTINATIONS.journee() });
  return { status: 200, envoye: !!(envoi && envoi.sent), n: reserves.length, raison: (envoi && (envoi.coupe || envoi.erreur || (envoi.calme ? 'heures calmes' : ''))) || '' };
}
