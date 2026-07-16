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

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxnb254enJ6amNxdGhqdGJkcHpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1ODIyMjYsImV4cCI6MjA5NTE1ODIyNn0.QJQSKILJLEpbDvBP4w7xD-olxoUjX1H2rxrYdo63GWQ';

export const VAPID_PUBLIC = 'BBQbRWE86gwZClx3buB8J2JJrd-Kg7aYR-HJqev811KmNnTxLxOAwxFhwF8MfvzHp1-K4tnmjFfQZxVaoB7psi8';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || 'ayc_z_oGCoQUS_zf3cAGDBxGNh0gBX6g3KchpNLgHM4';

webpush.setVapidDetails('mailto:vinted35260@icloud.com', VAPID_PUBLIC, VAPID_PRIVATE);

const HEADERS = {
  apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};

export async function loadSubs() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.push_subs&select=data`, { headers: HEADERS });
    if (!res.ok) return [];
    const rows = await res.json();
    return (rows[0] && rows[0].data && Array.isArray(rows[0].data.subs)) ? rows[0].data.subs : [];
  } catch (_) { return []; }
}

export async function saveSubs(subs) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=id`, {
      method: 'POST',
      headers: { ...HEADERS, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ id: 'push_subs', data: { subs, updatedAt: new Date().toISOString() } }]),
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
