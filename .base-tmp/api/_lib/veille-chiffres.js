// ═══════════════════════════════════════════════════════════════════════════
// LA VEILLE DES CHIFFRES, CÔTÉ SERVEUR (11 nov., lot agent2-veille)
// ═══════════════════════════════════════════════════════════════════════════
// La règle et les mots : src/veilleChiffres.js (pur, importé tel quel). Ici, la
// NOTIFICATION : appelée par l'app quand un relevé fait naître une alerte
// (`/api/push`, action `veille` — le corps ne dit rien : tout est RELU ici, au nom
// du vendeur de la session) et par le cron du matin (le filet : un appareil qui a
// écrit l'alerte puis s'est fermé avant d'appeler).
// UNE fois par alerte : le mémo `veille_chiffres_dit` (écrit par le serveur seul)
// est écrit AVANT d'envoyer — un mémo pas écrit ⇒ rien n'est envoyé (sinon la même
// alerte sonnerait à chaque passage). Une lecture ratée ⇒ rien (« pas su »).
// Famille « Rappels » (`veille`), heures calmes et plafond de `sendPushToAll`.
// ═══════════════════════════════════════════════════════════════════════════
import { CLE_VEILLE, MEMO_VEILLE, CAT_VEILLE, aNotifier, memoApres, notificationAlertes } from '../../src/veilleChiffres.js';
import { proprietaireCourant } from './owner.js';
import { sbCle } from './cle.js';
import { fetchAvecDelai } from './fetch-delai.js';   // (11 nov.) chaque appel sortant a un délai
import { sendPushToAll, pushCategorieActive } from './push.js';

// `getRow(id)` : objet · `null` (absente) · `undefined` (pas su) — au nom du vendeur du tour.
// `ecrire(id, data)` : vrai si la base a confirmé. `pousser(notif)` : `sendPushToAll`.
// `active()` : la famille est-elle allumée ? (`pushCategorieActive`).
export async function notifierAlertesChiffres({ getRow, ecrire, pousser, active = async () => true, maintenant = Date.now() }) {
  if (!(await active())) return { envoye: false, raison: 'désactivé par le vendeur' };
  const d = await getRow(CLE_VEILLE);
  if (d === undefined) return { envoye: false, raison: 'veille illisible — rien envoyé' };
  if (!d) return { envoye: false, raison: 'aucun relevé' };
  const memo = await getRow(MEMO_VEILLE);
  if (memo === undefined) return { envoye: false, raison: 'mémo illisible — rien envoyé' };
  const nouvelles = aNotifier(d, memo, maintenant);
  if (!nouvelles.length) return { envoye: false, raison: 'rien de neuf' };
  if (!(await ecrire(MEMO_VEILLE, memoApres(memo, nouvelles, maintenant)))) return { envoye: false, raison: 'mémo non écrit — rien envoyé' };
  const n = notificationAlertes(nouvelles);
  if (!n) return { envoye: false, raison: 'texte vide' };
  const envoi = await pousser({ cat: CAT_VEILLE, ...n });
  // Aucun chiffre dans la réponse : un nombre d'alertes.
  return { envoye: true, n: nouvelles.length, envoi: envoi && (envoi.coupe || envoi.erreur || envoi.sent) };
}

// ── La version « route » (`/api/push`, action `veille`) : au nom du vendeur de la
// session (`contexteVendeur`), clé de service, lignes filtrées par `owner`.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const cleService = () => process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';
async function getRowVendeur(id) {
  const owner = proprietaireCourant();
  if (!owner || !cleService()) return undefined;
  try {
    const r = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${encodeURIComponent(id)}&owner=eq.${encodeURIComponent(owner)}&select=data`, { headers: sbCle(cleService()) });
    if (!r.ok) return undefined;
    const j = await r.json();
    if (!Array.isArray(j)) return undefined;
    return (j[0] && j[0].data) || null;
  } catch (_) { return undefined; }
}
async function ecrireVendeur(id, data) {
  const owner = proprietaireCourant();
  if (!owner || !cleService()) return false;
  try {
    const r = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=owner,id`, {
      method: 'POST', headers: { ...sbCle(cleService()), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ owner, id, data, updated_at: new Date().toISOString() }]),
    });
    return !!(r && r.ok);
  } catch (_) { return false; }
}
export async function notifierAlertesDuVendeur({ maintenant = Date.now() } = {}) {
  if (!proprietaireCourant()) return { status: 401, envoye: false, raison: 'vendeur inconnu' };
  const r = await notifierAlertesChiffres({ getRow: getRowVendeur, ecrire: ecrireVendeur, pousser: sendPushToAll, active: () => pushCategorieActive(CAT_VEILLE), maintenant });
  return { status: /illisible|non écrit/.test(String(r.raison || '')) ? 503 : 200, ...r };
}
