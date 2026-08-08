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
// ⚠️ ÉGRESS SUPABASE — NE JAMAIS faire `select=data` sur `email_bord_*` : chaque
// ligne embarque le PDF du bordereau en base64 (brut + tamponné = deux fois),
// soit ~6 Mo au total pour ~50 bordereaux. Or ce widget se rafraîchit TOUT SEUL
// 24h/24 → ces 6 Mo repartaient à CHAQUE rafraîchissement et faisaient exploser
// le quota de bande passante Supabase (la même leçon qu'en §23 côté app, jamais
// reportée ici). On ne projette que les 4 champs scalaires réellement lus plus
// bas (date limite + clés d'identification) → l'appel passe de ~6 Mo à ~1 Ko.
const BORD_SELECT = 'dateLimite:data->>dateLimite,transaction:data->>transaction,suivi:data->>suivi,numero:data->>numero';
async function bordRows() {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=like.email_bord_*&select=${BORD_SELECT}`, { headers: HEADERS });
    return r.ok ? await r.json() : [];
  } catch (_) { return []; }
}
// Commandes Vinted moissonnées par l'extension (statut RÉEL, à jour) : c'est la
// source AUTOMATIQUE — Vinted change le statut quand tu expédies / récupères.
async function harvestOrders(kind) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=like.harvest_%25_orders_${kind}&select=data`, { headers: HEADERS });
    if (!r.ok) return [];
    const out = {};
    for (const row of await r.json()) {
      const items = (row.data && row.data.payload && row.data.payload.my_orders) || [];
      for (const o of items) if (o && o.transaction_id != null) out[o.transaction_id] = o; // dédoublonne par transaction
    }
    return Object.values(out);
  } catch (_) { return []; }
}
// À expédier : la vente attend que TU postes le colis.
const awaitingShip = (s) => /bordereau\s+envoy[ée]\s+au\s+vendeur/i.test(s || '') || /paiement.*valid/i.test(s || '');
// À retirer : l'achat est déposé au point relais, en attente que tu le récupères.
const atRelay = (s) => /d[ée]pos[ée]/i.test(s || '') && /point\s+relais|bureau\s+de\s+poste/i.test(s || '');
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
  // ⚠️ CETTE ROUTE ÉTAIT PUBLIQUE. N'importe qui connaissant l'adresse lisait le
  // chiffre d'affaires du mois, le nombre de ventes, l'argent en attente et le
  // nombre d'annonces en ligne. Il n'y avait ni clé, ni compte, ni restriction
  // d'origine — et l'en-tête « Access-Control-Allow-Origin: * » permettait même
  // à n'importe quel site web de la lire depuis le navigateur d'un visiteur.
  //
  // Elle exige désormais une CLÉ personnelle (?k=…), générée par l'app et
  // rangée dans tes données. Le widget iPhone la porte dans son URL.
  //
  // Transition : tant qu'aucune clé n'existe dans la base (donc avant que tu
  // aies rouvert l'app une fois), la route continue de répondre — sinon ton
  // widget tomberait en panne avant même que tu aies pu récupérer la nouvelle
  // adresse. Dès que la clé existe, la route est fermée sans clé valide.
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  try {
    const [bords, sold, purchased, finals, sales, m, snap] = await Promise.all([
      bordRows(), harvestOrders('sold'), harvestOrders('purchased'), rows('email_final_*'), rows('email_sale_*'), main(), snapshot(),
    ]);

    const expected = m && m.vrm_widget_token ? String(m.vrm_widget_token) : '';
    if (expected) {
      const given = String((req.query && (req.query.k || req.query.key)) || req.headers['x-vrm-key'] || '');
      // Comparaison à durée constante : une comparaison classique s'arrête au
      // premier caractère différent, ce qui laisse deviner la clé lettre par
      // lettre en mesurant le temps de réponse.
      const ok = given.length === expected.length
        && given.split('').reduce((acc, ch, i) => acc | (ch.charCodeAt(0) ^ expected.charCodeAt(i)), 0) === 0;
      if (!ok) { res.status(401).json({ error: 'cle invalide' }); return; }
    }
    const today = parisDate(0), tomorrow = parisDate(1), ym = today.slice(0, 7);

    // À expédier + à retirer = STATUT VINTED (automatique, à jour). Fini les
    // emails imprécis : Vinted sait quand c'est expédié / récupéré.
    const pickupDone = m.vinted_pickup_done || {};
    const toShip = sold.filter(o => awaitingShip(o.status));
    const shipTotal = toShip.length;
    const pickup = purchased.filter(o => atRelay(o.status) && !pickupDone[String(o.transaction_id)]).length;
    // Urgence d'expédition : on croise avec les bordereaux (date limite) pour les
    // ventes réellement en attente d'envoi.
    const shipTxns = new Set(toShip.map(o => String(o.transaction_id)));
    const printed = m.vinted_bords_printed || {};
    const bKey = (b) => String(b.transaction || b.suivi || b.numero || '');
    let shipOverdue = 0, shipToday = 0, shipTomorrow = 0;
    for (const b of bords) {
      if (printed[bKey(b)] || (b.transaction && !shipTxns.has(String(b.transaction)))) continue;
      const iso = frToIso(b.dateLimite); if (!iso) continue;
      if (iso < today) shipOverdue += 1; else if (iso === today) shipToday += 1; else if (iso === tomorrow) shipTomorrow += 1;
    }

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
