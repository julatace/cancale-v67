// api/widget.js
// ────────────────────────────────────────────────────────────────────────────
// DONNÉES DU WIDGET écran d'accueil (app Scriptable sur iPhone).
// Renvoie un petit JSON avec les chiffres « coup d'œil » du jour, calculés
// UNIQUEMENT depuis Supabase (données arrivées par email) → marche même app
// fermée / iPhone pas connecté à Vinted. Aucun appel Vinted.
//
// Chiffres : colis à expédier (aujourd'hui/en retard/total), colis à retirer,
// encaissé ce mois, ventes ce mois.
// ────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxnb254enJ6amNxdGhqdGJkcHpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1ODIyMjYsImV4cCI6MjA5NTE1ODIyNn0.QJQSKILJLEpbDvBP4w7xD-olxoUjX1H2rxrYdo63GWQ';
const HEADERS = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

const parisDate = (off = 0) => new Date(Date.now() + off * 86400000).toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
const frToIso = (s) => { const m = String(s || '').match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };

async function rows(like) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=like.${like}&select=data`, { headers: HEADERS });
    return r.ok ? (await r.json()).map(x => x.data).filter(Boolean) : [];
  } catch (_) { return []; }
}
async function main() {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.main&select=data`, { headers: HEADERS });
    if (!r.ok) return {};
    const j = await r.json(); return (j[0] && j[0].data) || {};
  } catch (_) { return {}; }
}
// Photo des chiffres publiée par l'app elle-même (ligne widget_stats) → source
// PRIORITAIRE pour l'encaissé/ventes du mois, pour coller EXACTEMENT à l'app.
async function snapshot() {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.widget_stats&select=data`, { headers: HEADERS });
    if (!r.ok) return null;
    const j = await r.json(); return (j[0] && j[0].data) || null;
  } catch (_) { return null; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  try {
    const [bords, tracks, finals, sales, m, snap] = await Promise.all([
      rows('email_bord_*'), rows('email_track_*'), rows('email_final_*'), rows('email_sale_*'), main(), snapshot(),
    ]);
    const printed = m.vinted_bords_printed || {};
    const collected = new Set(Array.isArray(m.vrm_colis_collected) ? m.vrm_colis_collected : []);
    const bKey = (b) => String(b.transaction || b.suivi || b.numero || '');
    const cKey = (t) => String(t.suivi || t.subject || '').trim();

    const today = parisDate(0), tomorrow = parisDate(1), ym = today.slice(0, 7);
    let shipOverdue = 0, shipToday = 0, shipTomorrow = 0, shipTotal = 0;
    for (const b of bords) {
      if (printed[bKey(b)]) continue; shipTotal += 1;
      const iso = frToIso(b.dateLimite); if (!iso) continue;
      if (iso < today) shipOverdue += 1; else if (iso === today) shipToday += 1; else if (iso === tomorrow) shipTomorrow += 1;
    }
    // Colis à retirer ENCORE actifs : disponible, non retiré, et arrivé depuis
    // ≤ 14 j (au-delà, un point relais l'a forcément déjà rendu/récupéré).
    const pickup = tracks.filter(t => {
      if (t.status !== 'available' || collected.has(cKey(t))) return false;
      const d = new Date(t.receivedAt); if (isNaN(d)) return true;
      return (Date.now() - d.getTime()) / 86400000 <= 14;
    }).length;

    // CA + ventes du mois : SOURCE = les emails de VENTE (« X a acheté ton
    // article »), un par vente AVEC le prix. Source complète, fiable, 24/7, tous
    // comptes, sans dépendre de l'extension Vinted. (Les emails « argent viré »
    // sont trop rares/incomplets pour servir de base.)
    let moneyMonth = 0, salesMonth = 0;
    for (const s of sales) {
      if (String(s.receivedAt || '').slice(0, 7) !== ym) continue;
      salesMonth += 1;
      const p = parseFloat(String(s.prix || '').replace(',', '.'));
      if (!isNaN(p) && p > 0) moneyMonth += p;
    }
    // Argent réellement viré ce mois (emails de finalisation) — info secondaire.
    let receivedMonth = 0;
    for (const f of finals) { if (String(f.receivedAt || '').slice(0, 7) === ym) { const n = parseFloat(String(f.montant || '').replace(',', '.')); if (!isNaN(n)) receivedMonth += n; } }

    res.status(200).json({
      ship: { total: shipTotal, overdue: shipOverdue, today: shipToday, tomorrow: shipTomorrow },
      pickup,
      moneyMonth: Math.round(moneyMonth),
      salesMonth,
      received: Math.round(receivedMonth),
      pending: snap && snap.enAttente != null ? snap.enAttente : null,
      online: snap && snap.online != null ? snap.online : null,
      unread: snap && snap.unread != null ? snap.unread : null,
      appSyncedAt: snap ? snap.updatedAt : null,
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    res.status(200).json({ error: String(e) });
  }
}
