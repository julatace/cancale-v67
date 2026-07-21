// api/ship-reminders.js
// ────────────────────────────────────────────────────────────────────────────
// RAPPEL D'EXPÉDITION (cron quotidien).
//
// Vinted pénalise les colis expédiés en retard. Ce job lit les bordereaux reçus
// par email (lignes email_bord_* de Supabase), garde ceux qui NE sont PAS encore
// marqués « imprimés/expédiés » (vinted_bords_printed) et dont la date limite est
// aujourd'hui, demain, ou déjà dépassée, puis envoie UNE notification push
// récapitulative sur tous les appareils abonnés.
//
// ⚠ N'appelle JAMAIS l'API Vinted (aucun risque de blocage) : il ne lit que
//   Supabase et envoie une notification. Déclenché par le cron Vercel (vercel.json).
// ────────────────────────────────────────────────────────────────────────────

import { sendPushToAll } from './_lib/push.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxnb254enJ6amNxdGhqdGJkcHpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1ODIyMjYsImV4cCI6MjA5NTE1ODIyNn0.QJQSKILJLEpbDvBP4w7xD-olxoUjX1H2rxrYdo63GWQ';
const HEADERS = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

// Date du jour (et de demain) dans le fuseau de Paris, en 'YYYY-MM-DD'.
function parisDate(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' }); // 'YYYY-MM-DD'
}
// « JJ/MM/AAAA … » → 'YYYY-MM-DD' (ou null si illisible).
function frToIso(s) {
  const m = String(s || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}
async function getRow(id) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${encodeURIComponent(id)}&select=data`, { headers: HEADERS });
    if (!r.ok) return null;
    const rows = await r.json();
    return (rows[0] && rows[0].data) || null;
  } catch (_) { return null; }
}

export default async function handler(req, res) {
  // Sécurité optionnelle : si CRON_SECRET est défini sur Vercel, on l'exige
  // (Vercel envoie « Authorization: Bearer <CRON_SECRET> » sur les crons).
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.authorization || '';
    const qk = (req.query && req.query.key) || '';
    if (auth !== `Bearer ${secret}` && qk !== secret) { res.status(401).json({ error: 'clé invalide' }); return; }
  }

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=like.email_bord_*&select=data`, { headers: HEADERS });
    const rows = r.ok ? await r.json() : [];
    const printed = (await getRow('main'))?.vinted_bords_printed || {};
    const key = (b) => String(b.transaction || b.suivi || b.numero || '');

    const today = parisDate(0), tomorrow = parisDate(1);
    let overdue = 0, dueToday = 0, dueTomorrow = 0;
    for (const row of rows) {
      const b = row.data; if (!b) continue;
      if (printed[key(b)]) continue;          // déjà imprimé / expédié
      const iso = frToIso(b.dateLimite); if (!iso) continue;
      if (iso < today) overdue += 1;
      else if (iso === today) dueToday += 1;
      else if (iso === tomorrow) dueTomorrow += 1;
    }
    const total = overdue + dueToday + dueTomorrow;

    // Anti-doublon : une seule notification par jour pour un même total.
    const dedup = (await getRow('ship_reminder_dedup')) || {};
    if (dedup.date === today && dedup.total === total) {
      res.status(200).json({ ok: true, skipped: 'déjà notifié', total }); return;
    }

    if (total > 0) {
      const parts = [];
      if (overdue) parts.push(`${overdue} en retard`);
      if (dueToday) parts.push(`${dueToday} aujourd'hui`);
      if (dueTomorrow) parts.push(`${dueTomorrow} demain`);
      await sendPushToAll({
        title: overdue ? '⏰ Colis à expédier — du retard !' : '📮 Colis à expédier',
        body: `${total} bordereau${total > 1 ? 'x' : ''} à envoyer (${parts.join(' · ')}). Ouvre l'app pour les imprimer.`,
        tag: 'ship-reminder',
        url: '/?tab=cat_bord',
      });
    }
    await fetch(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=id`, {
      method: 'POST',
      headers: { ...HEADERS, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ id: 'ship_reminder_dedup', data: { date: today, total } }]),
    });
    res.status(200).json({ ok: true, overdue, dueToday, dueTomorrow, total });
  } catch (e) {
    res.status(200).json({ ok: false, error: String(e) });
  }
}
