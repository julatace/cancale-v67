// api/_lib/push.js
// ────────────────────────────────────────────────────────────────────────────
// Envoi de notifications push (Web Push). Partagé par :
//   - api/push.js          (abonnement depuis l'app + notification de test)
//   - api/email-inbound.js (vente / bordereau / argent reçu → push en temps réel)
//
// Les abonnements (un par appareil) sont rangés dans Supabase, table app_data,
// ligne id='push_subs' : { subs: [ {endpoint, keys:{p256dh, auth}} ] }.
//
// ⚠ TODO version multi-utilisateur : déplacer VAPID_PRIVATE en variable d'env
// Vercel et associer les abonnements à un utilisateur.
// ────────────────────────────────────────────────────────────────────────────

import webpush from 'web-push';

import { withOwnerAll, conflictTarget, duVendeur } from './owner.js';

// La base sait-elle séparer les vendeurs ? (sondé une fois par instance)
let _cl = null;
const cloisonnee = async () => {
  if (_cl !== null) return _cl;
  try { _cl = (await fetch(`${SUPABASE_URL}/rest/v1/app_data?select=owner&limit=1`, { headers: HEADERS })).ok; }
  catch (_) { _cl = false; }
  return _cl;
};

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
// ⚠️ CLÉ DE SERVICE QUAND ELLE EXISTE. Ces routes tournent sur le serveur, sans
// vendeur connecté : à la seconde où la base est cloisonnée (RLS), la clé
// publique ne peut plus rien lire ni écrire et l'endpoint devient muet — c'est
// LE blocage qui empêchait d'activer le multi-vendeurs. On prend donc
// `SUPABASE_SERVICE_KEY` (variable d'environnement Vercel, jamais dans le
// dépôt) si elle est définie, et on retombe sur la clé publique tant qu'elle ne
// l'est pas : le comportement d'aujourd'hui reste identique.
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxnb254enJ6amNxdGhqdGJkcHpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1ODIyMjYsImV4cCI6MjA5NTE1ODIyNn0.QJQSKILJLEpbDvBP4w7xD-olxoUjX1H2rxrYdo63GWQ';

export const VAPID_PUBLIC = 'BBQbRWE86gwZClx3buB8J2JJrd-Kg7aYR-HJqev811KmNnTxLxOAwxFhwF8MfvzHp1-K4tnmjFfQZxVaoB7psi8';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || 'ayc_z_oGCoQUS_zf3cAGDBxGNh0gBX6g3KchpNLgHM4';

webpush.setVapidDetails('mailto:vinted35260@icloud.com', VAPID_PUBLIC, VAPID_PRIVATE);

const HEADERS = {
  apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};

// ── CE QU'ON NOTIFIE, ET CE QU'ON NE NOTIFIE PAS ────────────────────────────
// Julien : « des fois je reçois des choses complètement débiles ». Mesuré : un
// push partait à CHAQUE étape de colis — sur ses 94 emails de suivi, **54 sont
// "en transit" et 7 "info"**, soit 61 notifications qui n'appellent aucune
// action. Idem « achat confirmé » (il vient de l'acheter), favoris, messages.
//
// RÈGLE : on ne sonne que pour de l'ARGENT ou une ACTION à faire. Le reste se
// consulte dans l'app, où le badge suffit.
// ⚠️ Une seule définition, partagée par le pipeline email ET le rappel quotidien
//    (§11) — sinon les deux finiraient par ne pas notifier la même chose.
export const PUSH_DEFAUT = {
  vente:    true,   // une paire est vendue
  argent:   true,   // virement reçu
  colis:    true,   // colis à retirer (porte le code de retrait)
  offre:    true,   // une offre attend une réponse
  expedier: true,   // colis à poster (rappel quotidien)
  suivi:    false,  // « en transit », « livré » : rien à faire
  achat:    false,  // tu viens de l'acheter, tu le sais
  message:  false,  // le badge de l'app suffit
  favori:   false,  // Vinted en envoie beaucoup
  facture:  false,
};
// Réglage du vendeur (Réglages → Notifications), lu depuis la base.
// Absent ⟹ on prend le défaut ci-dessus.
export async function pushCategorieActive(cat) {
  if (!cat) return true;
  try {
    const res = await fetch(await duVendeur(`${SUPABASE_URL}/rest/v1/app_data?id=eq.push_prefs&select=data`, await cloisonnee()), { headers: HEADERS });
    if (!res.ok) return PUSH_DEFAUT[cat] !== false;
    const rows = await res.json();
    const prefs = (rows && rows[0] && rows[0].data) || {};
    const v = prefs[cat];
    return typeof v === 'boolean' ? v : (PUSH_DEFAUT[cat] !== false);
  } catch (_) { return PUSH_DEFAUT[cat] !== false; }
}

export async function loadSubs() {
  try {
    // ⚠️ Les abonnements sont PAR VENDEUR : sans ce filtre, une vente de Julien
    // ferait sonner le téléphone de Marie.
    const res = await fetch(await duVendeur(`${SUPABASE_URL}/rest/v1/app_data?id=eq.push_subs&select=data`, cloisonnee), { headers: HEADERS });
    if (!res.ok) return [];
    const rows = await res.json();
    return (rows[0] && rows[0].data && Array.isArray(rows[0].data.subs)) ? rows[0].data.subs : [];
  } catch (_) { return []; }
}

export async function saveSubs(subs) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=${conflictTarget('id')}`, {
      method: 'POST',
      headers: { ...HEADERS, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(withOwnerAll([{ id: 'push_subs', data: { subs, updatedAt: new Date().toISOString() } }])),
    });
  } catch (_) {}
}

// Envoie la notification à tous les appareils abonnés.
// Les abonnements morts (appli désinstallée, permission retirée) sont purgés.
export async function sendPushToAll(payload) {
  const subs = await loadSubs();
  if (!subs.length) return { sent: 0, total: 0 };
  const body = JSON.stringify(payload);
  const alive = [];
  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(s, body);
      alive.push(s); sent += 1;
    } catch (e) {
      const code = e && e.statusCode;
      if (code !== 404 && code !== 410) alive.push(s); // erreur passagère : on garde
    }
  }
  if (alive.length !== subs.length) await saveSubs(alive);
  return { sent, total: subs.length };
}
