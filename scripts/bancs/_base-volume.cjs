// ════════════════════════════════════════════════════════════════════════════
//  UNE BASE INVENTÉE, AU VOLUME DE LA SIENNE — pour mesurer la VITESSE.
//
//  `fx/` est une copie de sa vraie base (jamais dans le dépôt) ; ce module en
//  fabrique une À LA FORME et au POIDS mesurés le 16 octobre (lecture seule,
//  `pg_column_size` par famille) : 7 comptes, ~1 200 transactions, ~1 300
//  conversations, ~200 `email_bord_*` et ~140 `harvest_*_label_*` qui portent
//  un PDF, une ligne `main` de ~100 Ko. Aucune donnée réelle : il vit dans le
//  dépôt (public). Un banc de vitesse qui servirait des PDF de 4 octets serait
//  vert sur le défaut (§ « ouvrir Colis retéléchargeait 1,6 Mo de PDF »).
//
//  `servir(route)` émule PostgREST là où l'app s'en sert : `id=eq.` / `like.` /
//  `in.(…)` / `or=(…)`, filtres `data->>x=(not.)is.null|eq.|gte.`, projection
//  `select=` (alias, `->`, `->>`), `meta->>` (via `_meta.cjs`), `limit`, et la
//  pagination par en-tête `Range` (plafond de 1 000 lignes, comme Supabase).
// ════════════════════════════════════════════════════════════════════════════
const { metaVersData } = require('./_meta.cjs');

// Les dates se calculent depuis MIDI AUJOURD'HUI (heure de la machine), jamais
// depuis l'instant du lancement : deux passages le même jour servent les MÊMES
// dates (un avant/après lancé à dix minutes d'écart ne doit pas voir une vente
// changer de jour). Les dates de capture, elles, restent « il y a une minute »
// (`frais`) : la règle « en ligne » exige une lecture de moins de 24 h.
const midi = new Date(); midi.setHours(12, 0, 0, 0);
const NOW = midi.getTime();
const iso = (msAgo) => new Date(NOW - msAgo).toISOString();
const frais = (msAgo) => new Date(Date.now() - msAgo).toISOString();
const J = 86400000;
// Générateur déterministe : deux passages servent EXACTEMENT les mêmes lignes
// (sinon un avant/après comparerait deux bases).
let graine = 42;
const alea = () => { graine = (graine * 1103515245 + 12345) & 0x7fffffff; return graine / 0x7fffffff; };
const pad = (n) => 'x'.repeat(Math.max(0, n));
const MARQUES = ['Nike', 'Adidas', 'Salomon', 'New Balance', 'Asics', 'Vans'];
const MODELES = ['samba', 'spezial', 'air max 1', 'xt-6', 'gazelle', '550', 'gel-1130', 'old skool'];
const STATUTS_V = ['Commande finalisée', 'Commande finalisée', 'Commande finalisée', 'Le paiement a été validé', 'Colis en cours d\'acheminement', 'Remboursement effectué'];
const STATUTS_A = ['Commande finalisée', 'Colis déposé en bureau de Poste ou point relais', 'Colis en cours d\'acheminement', 'Commande finalisée'];

function fabriquer({ comptes = 7 } = {}) {
  graine = 42;
  const accounts = [], rows = [];
  const numeros = {};
  let num = 1, tx = 22000000000, item = 7000000000, conv = 18000000000;
  for (let a = 0; a < comptes; a++) {
    const uid = String(3150000000 + a * 1111);
    const login = 'vendeur_' + (a + 1);
    accounts.push({ id: 1000 + a, vinted_user_id: uid, login, domain: 'www.vinted.fr', updated_at: frais(3600000), created_at: iso(60 * J), anon_id: 'x', owner: null });
    rows.push({ id: `harvest_${uid}_profile`, data: { capturedAt: frais(60000), payload: { user: { id: Number(uid), login, feedback_reputation: 1 } } } });
    // Dressing : ~12 annonces en ligne + 20 fermées.
    const items = [];
    for (let i = 0; i < 32; i++) {
      const id = item++;
      const titre = `${MARQUES[i % 6]} ${MODELES[(i + a) % 8]} taille ${36 + (i % 10)}`;
      items.push({ id, title: titre, brand_title: MARQUES[i % 6], size_title: String(36 + (i % 10)), status: 'Très bon état',
        price: { amount: String(30 + (i * 7) % 90) + '.0', currency_code: 'EUR' }, is_closed: i >= 12, is_hidden: false, is_draft: false,
        favourite_count: i % 5, view_count: 10 + i, created_at_ts: iso((i + 1) * 2 * J),
        photo: { url: `https://images1.vinted.net/t/${id}/f800/p.jpeg?s=abc`, high_resolution: { timestamp: Math.floor((NOW - (i + 1) * 2 * J) / 1000) } },
        _pad: pad(300) });
      if (i < 12) numeros[id] = { num: String(num++), numberedAt: iso((i + 1) * 2 * J) };
    }
    rows.push({ id: `harvest_${uid}_listings`, data: { capturedAt: frais(60000), nItems: items.length, payload: { items, pagination: { total_entries: items.length } } } });
    // Ventes (~60) avec leur transaction ; achats (~80).
    const sold = [];
    for (let i = 0; i < 60; i++) {
      const t = tx++;
      const st = STATUTS_V[i % STATUTS_V.length];
      const d = iso((i * 1.3 + alea()) * J);
      const it = item++;
      sold.push({ transaction_id: t, title: `${MARQUES[i % 6]} ${MODELES[i % 8]} taille ${37 + (i % 9)}`, price: { amount: String(25 + (i * 11) % 80) + '.0', currency_code: 'EUR' },
        status: st, date: d, item_id: it, transaction_user_status: st === 'Le paiement a été validé' ? 'needs_action' : (st === 'Commande finalisée' ? 'completed' : 'waiting'),
        photo: { url: `https://images1.vinted.net/t/${it}/f800/v.jpeg?s=abc` }, _pad: pad(200) });
      rows.push({ id: `harvest_${uid}_txn_${t}`, data: { capturedAt: iso(i * J), payload: { transaction: { id: t, item_id: it, status: st === 'Commande finalisée' ? 450 : 300,
        status_title: st, status_updated_at: d, shipment: { status_title: 'Livré' }, item: { id: it, title: 'x' }, _pad: pad(6800) } } } });
      // Bordereau capté par l'extension, avec PDF (~100 Ko) — les 3 plus récents.
      if (i < 3) rows.push({ id: `harvest_${uid}_label_${t}`, data: { tx: String(t), item: String(it), capturedAt: iso(i * J), pdfB64: 'JVBERi0' + pad(100000) } });
      // Email de bordereau (PDF ~100 Ko + copie tamponnée) — ~28 par compte.
      if (i < 28) rows.push({ id: `email_bord_${t}`, data: { filename: `bordereau-${t}.pdf`, transaction: String(t), receivedAt: d, suivi: 'XW' + t, modele: 'x', numero: String(i), dateLimite: iso(-2 * J),
        pdfB64: 'JVBERi0' + pad(90000), pdfTamponneB64: 'JVBERi0' + pad(90000) } });
    }
    rows.push({ id: `harvest_${uid}_label_latest`, data: { tx: String(tx - 60), item: '1', capturedAt: iso(0), pdfB64: 'JVBERi0' + pad(100000) } });
    rows.push({ id: `harvest_${uid}_orders_sold`, data: { capturedAt: frais(120000), nItems: sold.length, payload: { my_orders: sold } } });
    // Transactions-conversations (status 1, status_title vide) : ~110 de plus.
    for (let i = 0; i < 110; i++) {
      const t = tx++;
      rows.push({ id: `harvest_${uid}_txn_${t}`, data: { capturedAt: iso(i * J), payload: { transaction: { id: t, item_id: items[i % items.length].id, status: 1, status_title: '', _pad: pad(6800) } } } });
    }
    const achats = [];
    for (let i = 0; i < 80; i++) achats.push({ transaction_id: tx++, conversation_id: conv++, title: `${MARQUES[i % 6]} achat ${i}`, price: { amount: '21.0', currency_code: 'EUR' }, status: STATUTS_A[i % 4], date: iso(i * J), _pad: pad(200) });
    rows.push({ id: `harvest_${uid}_orders_purchased`, data: { capturedAt: frais(120000), nItems: achats.length, payload: { my_orders: achats } } });
    // Boîte de réception (~24 Ko) et conversations (~190 × 2,4 Ko).
    const convs = [];
    for (let i = 0; i < 50; i++) convs.push({ id: conv + i, unread: i < 3, updated_at: iso(i * 3600000), opposite_user: { id: 9000 + i, login: 'acheteur' + i }, item_count: 1, description: 'Bonjour, est-elle dispo ?', _pad: pad(300) });
    rows.push({ id: `harvest_${uid}_inbox`, data: { capturedAt: frais(60000), payload: { conversations: convs, pagination: { current_page: 1 } } } });
    for (let i = 0; i < 190; i++) {
      const c = conv++;
      rows.push({ id: `harvest_${uid}_conv_${c}`, data: { capturedAt: iso(i * 3600000), payload: { conversation: { id: c, opposite_user: { id: 9000 + i, login: 'acheteur' + i }, transaction: { id: tx - 100 + (i % 50), item_id: items[i % items.length].id }, allow_reply: true, messages: [{ id: c * 10, entity_type: 'message', entity: { body: 'Bonjour', user_id: 9000 + i } }], _pad: pad(1800) } } } });
    }
    rows.push({ id: `harvest_${uid}_billing`, data: { capturedAt: frais(60000), payload: { user_balance: { escrow_amount: { amount: '120.0' }, available_amount: { amount: '30.0' } } } } });
    rows.push({ id: `harvest_${uid}_enligne`, data: { capturedAt: frais(60000), complet: true, n: 12, ids: items.slice(0, 12).map((x) => x.id), items: items.slice(0, 12).map((x) => ({ id: x.id, title: x.title })) } });
    // Coffre : ~90 fiches par compte.
    for (let i = 0; i < 90; i++) rows.push({ id: `coffre_${uid}_${7000000000 + a * 100 + i}`, data: { titre: 'x', desc: pad(1000), photos: [] } });
  }
  // Suivis de colis par email (~180, petits).
  for (let i = 0; i < 180; i++) rows.push({ id: `email_track_mondialrelay_${100000 + i}`, data: { carrier: 'mondialrelay', tracking: String(100000 + i), status: i % 3 ? 'transit' : 'livre', receivedAt: iso(i * J), _pad: pad(200) } });
  rows.push({ id: 'email_journal', data: { entries: Array.from({ length: 80 }, (_, i) => ({ at: iso(i * 3600000), type: 'message', to: 'x@y.fr' })) } });
  rows.push({ id: 'vinted_item_details', data: Object.fromEntries(Array.from({ length: 120 }, (_, i) => [String(7000000000 + i), { desc: pad(800), photos: ['https://images1.vinted.net/t/a/f800/1.jpeg'] }])) });
  // La ligne main : ~100 Ko, dont les numéros.
  const main = [{ id: 'main', data: { vinted_annonce_numeros: numeros, vinted_used_nums: Object.values(numeros).map((x) => Number(x.num)),
    vinted_sale_overrides: Object.fromEntries(Array.from({ length: 200 }, (_, i) => [String(22000000000 + i), { note: pad(80) }])), vinted_accounts_hidden: [], vinted_prenom: '', _pad: pad(40000) } }];
  return { accounts, rows, main };
}

// ── PostgREST, ce que l'app en utilise ───────────────────────────────────────
const lireChemin = (o, chemin) => {
  const segs = chemin.split(/->>|->/).filter(Boolean);
  let v = o;
  for (const s of segs) v = v == null ? undefined : v[s];
  return v;
};
function projette(row, select) {
  if (!select || select === '*') return row;
  const out = {};
  for (const part of select.split(',')) {
    const p = part.trim(); if (!p) continue;
    const m = /^(?:([^:]+):)?(.+)$/.exec(p);
    const src = m[2];
    const alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id' || src === 'updated_at' || src === 'owner') { out[alias] = src === 'updated_at' ? (row.updated_at || null) : row[src]; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (/^data(->|->>)/.test(src)) {
      const v = lireChemin(row.data, src.replace(/^data/, ''));
      out[alias] = v == null ? null : (/->>[^>]*$/.test(src) && typeof v === 'object' ? JSON.stringify(v) : (/->>[^>]*$/.test(src) ? String(v) : v));
      continue;
    }
    out[alias] = row[src];
  }
  return out;
}
const reLike = (pat) => new RegExp('^' + pat.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[*%]/g, '.*') + '$');
function filtreId(expr) {
  // expr = « eq.x » | « like.x » | « in.(a,b) » | « not.like.x »
  let m;
  if ((m = /^eq\.(.*)$/.exec(expr))) return (id) => id === m[1];
  if ((m = /^like\.(.*)$/.exec(expr))) { const re = reLike(m[1]); return (id) => re.test(id); }
  if ((m = /^not\.like\.(.*)$/.exec(expr))) { const re = reLike(m[1]); return (id) => !re.test(id); }
  if ((m = /^in\.\((.*)\)$/.exec(expr))) { const s = new Set(m[1].split(',').map((x) => x.replace(/^"|"$/g, ''))); return (id) => s.has(id); }
  return () => true;
}
function filtreOr(expr) {
  // or=(id.like.a,id.like.b)
  const corps = expr.replace(/^\(|\)$/g, '');
  const parts = corps.split(/,(?=id\.)/);
  const fs = parts.map((p) => { const m = /^id\.(.*)$/.exec(p); return m ? filtreId(m[1]) : () => false; });
  return (id) => fs.some((f) => f(id));
}
function filtreData(cle, expr) {
  const chemin = cle.replace(/^data/, '');
  return (row) => {
    const v = lireChemin(row.data, chemin);
    if (expr === 'is.null') return v == null;
    if (expr === 'not.is.null') return v != null;
    let m;
    if ((m = /^eq\.(.*)$/.exec(expr))) return String(v) === m[1];
    if ((m = /^neq\.(.*)$/.exec(expr))) return String(v) !== m[1];
    if ((m = /^gte\.(.*)$/.exec(expr))) return v != null && String(v) >= m[1];
    if ((m = /^gt\.(.*)$/.exec(expr))) return v != null && String(v) > m[1];
    if ((m = /^lt\.(.*)$/.exec(expr))) return v != null && String(v) < m[1];
    return true;
  };
}

// Répond à une requête GET `app_data` : rend { status, body, headers }.
function repondre(url, rangeHeader, { rows, main, accounts }) {
  const u = metaVersData(url);
  const q = u.split('?')[1] || '';
  const params = q.split('&').map((kv) => { const i = kv.indexOf('='); return [decodeURIComponent(kv.slice(0, i)), decodeURIComponent(kv.slice(i + 1))]; });
  if (/\/rest\/v1\/vinted_accounts/.test(u)) return { status: 200, body: accounts };
  if (params.some(([k, v]) => k === 'select' && v === 'owner')) return { status: 400, body: { message: 'column app_data.owner does not exist' } };
  if (!/\/rest\/v1\/app_data/.test(u)) return { status: 200, body: [] };
  let L = [...main, ...rows];
  let select = null, limit = null;
  for (const [k, v] of params) {
    if (k === 'select') select = v;
    else if (k === 'id') { const f = filtreId(v); L = L.filter((r) => f(r.id)); }
    else if (k === 'or') { const f = filtreOr(v); L = L.filter((r) => f(r.id)); }
    else if (k === 'and') { const corps = v.replace(/^\(|\)$/g, ''); for (const p of corps.split(/,(?=id\.)/)) { const m = /^id\.(.*)$/.exec(p); if (m) { const f = filtreId(m[1]); L = L.filter((r) => f(r.id)); } } }
    else if (/^data(->|->>)/.test(k)) { const f = filtreData(k, v); L = L.filter(f); }
    else if (k === 'limit') limit = Number(v);
  }
  L.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const total = L.length;
  let from = 0, to = Math.min(total, 1000) - 1;
  const mr = /^(\d+)-(\d+)$/.exec(rangeHeader || '');
  if (mr) { from = Number(mr[1]); to = Math.min(Number(mr[2]), from + 999, total - 1); }
  let page = L.slice(from, to + 1);
  if (limit != null) page = page.slice(0, limit);
  return { status: 200, body: page.map((r) => projette(r, select)), headers: { 'content-range': `${from}-${from + page.length - 1}/${total}` } };
}

module.exports = { fabriquer, repondre, projette };
