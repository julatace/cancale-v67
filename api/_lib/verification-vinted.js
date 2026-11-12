// api/_lib/verification-vinted.js
// ────────────────────────────────────────────────────────────────────────────
// (12 nov., ext. 5.370 — discrétion, point 13) « VINTED DEMANDE UNE VÉRIFICATION ».
// L'extension a reçu de Vinted une réponse qui parle de captcha / DataDome / robot :
// elle arrête TOUS les gestes automatiques du compte et appelle `/api/push`
// (`action: 'verification'`, le n° du compte seulement). Ici, au nom du vendeur de la
// session, avec la clé de service :
//   · la ligne `actions_compte_{uid}_*` DE CE VENDEUR est relue : sans vérification
//     posée dans les 2 dernières heures, rien ne part (le corps ne prouve rien) ;
//   · le nom du compte vient de SA ligne `vinted_accounts` (jamais du corps) ;
//   · une notification (famille `capture` : une panne qui passe même un jour calme),
//     étiquetée par compte et par vérification (un même téléphone ne la reçoit qu'une
//     fois), qui ouvre Ma journée — l'alerte ambre et « Reprendre » y sont.
// Aucune nouvelle fonction serverless (12 au plus).
// ────────────────────────────────────────────────────────────────────────────
import { proprietaireCourant } from './owner.js';
import { sbCle } from './cle.js';
import { sendPushToAll } from './push.js';
import { DESTINATIONS } from './lien-notif.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const cle = () => process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';
export const VERIF_FENETRE_MS = 2 * 3600000;

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

// La vérification la plus récente posée sur CE compte (lignes de CE vendeur), ou 0.
export function verificationRecente(rows, uid, maintenant = Date.now()) {
  let v = 0;
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || !new RegExp(`^actions_compte_${uid}_[0-9a-f]{16}$`).test(String(r.id || ''))) continue;
    const c = Number(r.cap);
    if (Number.isFinite(c) && c > 0 && c <= maintenant + 60000 && maintenant - c <= VERIF_FENETRE_MS && c > v) v = c;
  }
  return v;
}
export function texteVerification(nom) {
  return { title: '🛑 Vinted demande une vérification', body: `${nom ? nom + ' : ' : ''}fais-la sur vinted.fr, puis touche Reprendre dans VRM. Rien ne part en attendant.` };
}

// Rend { status, envoye, raison } — jamais d'exception.
export async function notifierVerificationVinted(uidBrut, { maintenant = Date.now() } = {}) {
  const uid = String(uidBrut == null ? '' : uidBrut);
  if (!/^\d{1,20}$/.test(uid)) return { status: 400, envoye: false, raison: 'compte invalide' };
  if (!proprietaireCourant()) return { status: 401, envoye: false, raison: 'vendeur inconnu' };
  const rows = await lire(`app_data?id=like.actions_compte_${uid}_*&select=id,cap:data->>captcha`);
  if (rows === null) return { status: 503, envoye: false, raison: 'ligne illisible — rien envoyé' };
  const cap = verificationRecente(rows, uid, maintenant);
  if (!cap) return { status: 200, envoye: false, raison: 'aucune vérification récente sur ce compte' };
  const comptes = await lire(`vinted_accounts?vinted_user_id=eq.${uid}&select=login`);
  const nom = Array.isArray(comptes) && comptes[0] && typeof comptes[0].login === 'string' ? comptes[0].login.slice(0, 40) : '';
  const envoi = await sendPushToAll({ cat: 'capture', urgent: true, ...texteVerification(nom), tag: `vrm-verif-${uid}-${cap}`, url: DESTINATIONS.journee() });
  return { status: 200, envoye: !!(envoi && envoi.sent), raison: (envoi && (envoi.coupe || envoi.erreur || (envoi.calme ? 'heures calmes' : ''))) || '' };
}
