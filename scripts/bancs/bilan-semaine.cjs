// ═══════════════════════════════════════════════════════════════════════════
// BANC : LE BILAN DE LA SEMAINE, EXÉCUTÉ (node scripts/bancs/bilan-semaine.cjs)
// ═══════════════════════════════════════════════════════════════════════════
// §4.10 — une route serveur n'est vérifiée que si un banc l'EXÉCUTE. On lance
// le VRAI `api/ship-reminders.js` (le seul cron) sur une fausse base CLOISONNÉE
// à DEUX vendeurs, un faux Web Push (aucune notification réelle ne part), et un
// lundi matin figé. On exige :
//   • chacun reçoit SON bilan, sur SES appareils, avec SES chiffres — jamais
//     ceux de l'autre ; toutes les lectures du bilan portent `owner=eq.<lui>` ;
//   • les chiffres sont ceux de la règle de l'APP (`ventesFaites`, extraite
//     d'App.jsx et exécutée ici sur les mêmes ventes) ;
//   • « à expédier » est le nombre du WIDGET (l'autre route, exécutée aussi) ;
//   • UNE fois par semaine : relancé, rien ne repart ; mémo non écrit ⇒ rien ;
//   • la préférence « bilan » coupée ⇒ rien pour lui ;
//   • une source illisible ⇒ « au moins », et la source NOMMÉE ;
//   • un jeudi ⇒ aucun bilan.
// Aucune fixture : tout est inventé ici, rien ne quitte la machine.
const path = require('path'), fs = require('fs'), vm = require('vm');
const RACINE = path.join(__dirname, '..', '..');

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m, String((e && e.stack) || e).split('\n').slice(0, 2).join(' ')); } };

// ── Faux Web Push : on capture ce qui partirait, rien ne part ───────────────
process.env.VAPID_PRIVATE_KEY = 'banc-cle-privee-factice';
delete process.env.SUPABASE_SERVICE_KEY;      // accesVendeur → « pas su » ne coupe pas
delete process.env.CRON_SECRET;
const webpush = require(path.join(RACINE, 'node_modules', 'web-push'));
const pushes = [];
webpush.setVapidDetails = () => {};
webpush.sendNotification = async (sub, body) => { pushes.push({ endpoint: sub.endpoint, ...JSON.parse(body) }); return { statusCode: 201 }; };

// ── Un lundi matin figé : 5 octobre 2026, 10 h 10 à Paris ───────────────────
const LUNDI = Date.parse('2026-10-05T08:10:00Z'), JEUDI = Date.parse('2026-10-08T08:10:00Z');
const vraiNow = Date.now;
const J = 86400000;
const DANS = Date.parse('2026-09-30T14:00:00Z');          // mercredi de la semaine passée
const AVANT = Date.parse('2026-09-20T14:00:00Z');
const CAPTE = new Date(LUNDI - 3600000).toISOString();   // lu ce matin : semaine complète

// ── Deux vendeurs, chacun SES données (montants distincts pour les reconnaître) ─
const vendeurs = () => ({
  A: {
    jeton: 'tokA', subs: [{ endpoint: 'https://push.test/A1', keys: {} }], prefs: null,
    comptes: [{ vinted_user_id: '11', login: 'vendeuse_a' }],
    main: { vinted_sales_hidden: ['105'], vinted_accounts_hidden: [], vinted_ship_done: { 102: true }, vinted_bords_shipped: {}, vrm_paires_dorment: { n: 3, total: 20, datesKnown: 20, at: LUNDI - 2 * J }, vrm_widget_token: 'tokA' },
    ventes: { 11: { cap: CAPTE, txns: ['102', '106'], orders: [
      { transaction_id: 101, status: 'Commande finalisée', date: new Date(DANS).toISOString(), price: { amount: '41.0', currency_code: 'EUR' } },
      { transaction_id: 102, status: 'Le paiement a été validé', date: new Date(DANS).toISOString(), price: { amount: '23.5' }, transaction_user_status: 'needs_action' },
      { transaction_id: 106, status: 'Le paiement a été validé', date: new Date(DANS + J).toISOString(), price: { amount: '30' }, transaction_user_status: 'needs_action' },
      { transaction_id: 103, status: 'Commande finalisée', date: new Date(AVANT).toISOString(), price: { amount: '70' } },
      { transaction_id: 105, status: 'Commande finalisée', date: new Date(DANS).toISOString(), price: { amount: '999' } },
    ] } },
    txn: [{ tx: '101', s: '450', su: new Date(DANS + J).toISOString() }, { tx: '103', s: '450', su: new Date(DANS).toISOString() }, { tx: '105', s: '450', su: new Date(DANS).toISOString() }],
    lbc: { L1: { txId: 'L1', isSeller: true, price: 2000, dateVente: new Date(DANS).toISOString(), stepStatus: 'done', at: new Date(DANS).toISOString() } },
    ebay: [],
  },
  B: {
    jeton: 'tokB', subs: [{ endpoint: 'https://push.test/B1', keys: {} }], prefs: null,
    comptes: [{ vinted_user_id: '22', login: 'vendeur_b' }],
    main: { vinted_sales_hidden: [], vinted_accounts_hidden: [], vinted_ship_done: {}, vinted_bords_shipped: {}, vrm_widget_token: 'tokB' },
    ventes: { 22: { cap: CAPTE, txns: [], orders: [
      { transaction_id: 201, status: 'Commande finalisée', date: new Date(DANS).toISOString(), price: { amount: '777' } },
    ] } },
    txn: [{ tx: '201', s: '450', su: new Date(DANS).toISOString() }],
    lbc: {}, ebay: [{ orderId: 'E9', orderPaymentStatus: 'PAID', creationDate: new Date(DANS).toISOString(), pricingSummary: { total: { value: '88', currency: 'EUR' } } }],
  },
});

// ── La fausse base ───────────────────────────────────────────────────────────
let V, memos, lus, ecrits, pannes;
const reset = () => { V = vendeurs(); memos = {}; lus = []; ecrits = []; pannes = new Set(); pushes.length = 0; };
const rep = (o, status = 200, h = {}) => new Response(typeof o === 'string' ? o : JSON.stringify(o), { status, headers: { 'content-type': 'application/json', ...h } });
const chemin = (obj, p) => p.reduce((o, k) => (o == null ? undefined : o[k]), obj);
// Applique `select=` comme PostgREST : `alias:data->a->>b`, `alias:meta->>k`, `owner`, `id`, `data`.
function projette(ligne, select) {
  if (!select || select === '*') return ligne;
  const out = {};
  for (const item of select.split(',')) {
    const [alias, expr] = item.includes(':') ? item.split(/:(.+)/) : [item, item];
    const morceaux = expr.split(/->>?/);
    const base = morceaux.shift();
    let v = base === 'meta' ? ligne.meta : base === 'data' ? ligne.data : ligne[base];
    if (morceaux.length) v = chemin(v, morceaux);
    if (/->>/.test(expr) && v != null && typeof v === 'object') v = JSON.stringify(v);
    if (/->>/.test(expr) && v != null && typeof v !== 'object') v = String(v);
    out[alias] = v === undefined ? null : v;
  }
  return out;
}
const lignesDe = (o) => {
  const v = V[o]; if (!v) return [];
  const L = [{ id: 'main', data: v.main }];
  for (const [uid, x] of Object.entries(v.ventes)) L.push({ id: `harvest_${uid}_orders_sold`, data: { capturedAt: x.cap, payload: { my_orders: x.orders }, resume: { txns: x.txns } } });
  for (const t of v.txn) L.push({ id: `harvest_${v.comptes[0].vinted_user_id}_txn_${t.tx}`, meta: { id: t.tx, status: t.s, status_updated_at: t.su }, data: {} });
  L.push({ id: 'lbc_ventes', data: { ventes: v.lbc } });
  L.push({ id: 'ebay_orders', data: { orders: v.ebay } });
  L.push({ id: 'push_subs', data: { subs: v.subs } });
  if (v.prefs) L.push({ id: 'push_prefs', data: v.prefs });
  for (const [id, data] of Object.entries(memos[o] || {})) L.push({ id, data });
  return L;
};
const filtreId = (id, q) => {
  const eq = /(?:^|&)id=eq\.([^&]+)/.exec(q), like = /(?:^|&)id=like\.([^&]+)/.exec(q);
  // (l'adresse est DÉJÀ décodée : `%` y est le joker de LIKE, ne pas redécoder)
  if (eq) return id === eq[1];
  if (like) { const re = new RegExp('^' + like[1].replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/\*/g, '.*').replace(/_/g, '.') + '$'); return re.test(id); }
  return true;
};
global.fetch = async (url, opts = {}) => {
  const u = decodeURIComponent(String(url)), m = opts.method || 'GET';
  if (!u.includes('/rest/v1/')) return rep({}, 404);
  const [table, q = ''] = u.split('/rest/v1/')[1].split('?');
  const own = (/(?:^|&)owner=eq\.([^&]+)/.exec(q) || [])[1] || null;
  if (m === 'POST' && table === 'app_data') {
    const lignes = JSON.parse(opts.body || '[]');
    for (const l of lignes) {
      ecrits.push({ id: l.id, owner: l.owner || null, data: l.data });
      if (pannes.has(`ecrire:${l.owner}:${l.id}`)) return rep('<html>522</html>', 522);
      (memos[l.owner] = memos[l.owner] || {})[l.id] = l.data;
    }
    return rep('', 201);
  }
  lus.push(u);
  const select = (/(?:^|&)select=([^&]+)/.exec(q) || [])[1] || '';
  if (table === 'app_data' && /select=owner&limit=1/.test(q)) return rep([{ owner: 'A' }]);
  // Énumération des vendeurs (et clés du widget) : sans filtre owner, la seule lecture globale permise.
  if (table === 'app_data' && /id=eq\.main/.test(q) && !own) return rep(Object.keys(V).map((o) => projette({ owner: o, id: 'main', data: V[o].main }, select)));
  if (!own) return rep({ message: 'lecture sans vendeur' }, 400);
  // Une source en panne POUR CE VENDEUR (522 Cloudflare, du HTML) — les autres répondent.
  for (const p of pannes) { const [o, motif] = p.split(':'); if (o === own && (table + '?' + q).includes(motif)) return rep('<html>522</html>', 522); }
  if (table === 'vinted_accounts') return rep((V[own] ? V[own].comptes : []).map((c) => projette(c, select)));
  if (table !== 'app_data') return rep([]);
  return rep(lignesDe(own).filter((l) => filtreId(l.id, q)).map((l) => projette({ ...l, owner: own }, select)));
};

// ── La règle de l'APP, extraite d'App.jsx (jamais recopiée) ─────────────────
function regleApp() {
  const parser = require(path.join(RACINE, 'node_modules', '@babel', 'parser'));
  const src = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
  const ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx'], errorRecovery: true });
  const noms = ['classifyOrderStatus', 'tsCommande', 'montantCommande', 'lbcAnnulee', 'lbcFinalisee', 'venteFinalisee', 'ymDeTs', 'ventesFaites', 'ventesDeclarables'];
  const ctx = vm.createContext({});
  for (const n of ast.program.body) if (n.type === 'VariableDeclaration') for (const d of n.declarations) if (d.id && noms.includes(d.id.name)) vm.runInContext('const ' + src.slice(d.start, d.end) + `;\nthis.${d.id.name} = ${d.id.name};`, ctx);
  return ctx;
}
const euros = (x) => `${Number(x).toLocaleString('fr-FR', { minimumFractionDigits: Number.isInteger(Number(x)) ? 0 : 2, maximumFractionDigits: 2 })} €`;
const res = () => ({ code: null, corps: null, status(n) { this.code = n; return this; }, json(o) { this.corps = o; return this; }, setHeader() {}, end() { return this; } });

(async () => {
  reset();
  let cron, widget;
  try { cron = (await import('file://' + path.join(RACINE, 'api', 'ship-reminders.js'))).default; } catch (e) { dit(false, 'api/ship-reminders.js se charge', e.message); }
  try { widget = (await import('file://' + path.join(RACINE, 'api', 'widget.js'))).default; } catch (e) { dit(false, 'api/widget.js se charge', e.message); }
  const lancer = async (t) => { Date.now = () => t; try { const r = res(); await cron({ method: 'GET', headers: {}, query: {} }, r); return r; } finally { Date.now = vraiNow; } };
  const bilansDe = (o) => pushes.filter((p) => /^bilan-/.test(p.tag || '') && p.endpoint.includes('/' + o));
  const ctx = regleApp();
  const attendu = (o) => {
    const v = V[o], vinted = [];
    for (const [uid, x] of Object.entries(v.ventes)) for (const ord of x.orders) vinted.push({ ...ord, _acc: { vinted_user_id: uid } });
    const masq = new Set(v.main.vinted_sales_hidden || []);
    const r = ctx.ventesFaites({ vinted, lbc: Object.values(v.lbc), ebay: v.ebay, cachee: (x) => masq.has(String(x.transaction_id)) });
    let n = 0, eur = 0; const deb = Date.parse('2026-09-27T22:00:00Z'), fin = Date.parse('2026-10-04T22:00:00Z');
    for (const l of r.lignes) if (l.ts >= deb && l.ts < fin) { n++; eur += l.eur; }
    // REÇU : `ventesDeclarables`, daté au versement ; une vente masquée d'un ✕
    // reste de l'argent reçu (règle de l'app : masquer range un écran).
    const versements = {}; for (const t of v.txn) if (t.s === '450') versements[t.tx] = t.su;
    const d = ctx.ventesDeclarables({ vinted, lbc: Object.values(v.lbc), ebay: v.ebay, versements });
    let recu = 0; for (const l of d.lignes) if (l.ts >= deb && l.ts < fin) recu += l.eur;
    return { n, eur, recu: Math.round(recu * 100) / 100 };
  };

  console.log('── Lundi matin : chacun SON bilan, SES chiffres, SES appareils');
  await essaie('lundi', async () => {
    reset();
    const r = await lancer(LUNDI);
    const a = bilansDe('A'), b = bilansDe('B');
    dit(a.length === 1 && b.length === 1, 'un bilan pour A sur l’appareil de A, un pour B sur celui de B', `A=${a.length} B=${b.length} · code ${r.code}`);
    const ea = attendu('A'), eb = attendu('B');
    const ca = (a[0] && a[0].body) || '', cb = (b[0] && b[0].body) || '';
    dit(ca.includes(`${ea.n} vente`) && ca.includes(euros(ea.eur)), `A : ${ea.n} ventes · ${euros(ea.eur)} — les nombres de la règle de l’APP (ventesFaites), masquée et hors semaine écartées`, ca.split('\n')[0]);
    dit(cb.includes(`${eb.n} vente`) && cb.includes(euros(eb.eur)), `B : ${eb.n} ventes · ${euros(eb.eur)} (Vinted + eBay)`, cb.split('\n')[0]);
    dit(!ca.includes('777') && !ca.includes('88') && !cb.includes('41'), 'jamais les montants de l’autre vendeur');
    dit(ca.includes(`Reçu : ${euros(ea.recu)}`) && cb.includes(`Reçu : ${euros(eb.recu)}`), `reçu : ${euros(ea.recu)} pour A, ${euros(eb.recu)} pour B — la règle de l’APP (ventesDeclarables, date de VERSEMENT)`, (ca.split('\n')[1] || '') + ' / ' + (cb.split('\n')[1] || ''));
    const lecturesBilan = lus.filter((u) => /orders_sold|_txn_|lbc_ventes|ebay_orders|vinted_accounts|panel_accounts_off|bilan_semaine_dedup/.test(u));
    dit(lecturesBilan.length > 0 && lecturesBilan.every((u) => /owner=eq\./.test(u)), 'toutes les lectures du bilan portent owner=eq.<vendeur> (aucune lecture globale)', `${lecturesBilan.length} lectures`);
    const memA = (memos.A || {}).bilan_semaine_dedup, memB = (memos.B || {}).bilan_semaine_dedup;
    dit(memA && memA.semaine === '2026-09-28' && memB && memB.semaine === '2026-09-28', 'le mémo de la semaine est écrit POUR CHAQUE vendeur (lundi 28 septembre)');
    dit(a[0] && a[0].url === '/?tab=journee' && /28 sept/.test(a[0].title || '') && /4 oct/.test(a[0].title || ''), 'titre : la semaine nommée (28 sept. → 4 oct.), et le clic ouvre Ma journée', a[0] && a[0].title);
  });

  console.log('\n── « À expédier » : le nombre du widget');
  await essaie('widget', async () => {
    reset();
    Date.now = () => LUNDI;
    let w = res();
    try { await widget({ method: 'GET', headers: {}, query: { k: 'tokA' } }, w); } finally { Date.now = vraiNow; }
    reset();
    const r = await lancer(LUNDI);
    const bil = r.corps && Array.isArray(r.corps.bilans) ? r.corps.bilans.find((x) => x.owner === 'A') : null;
    const colis = bil && bil.bilan && bil.bilan.colis;
    dit(w.corps && w.corps.ship && Number.isFinite(colis) && colis === w.corps.ship.total, 'le bilan annonce exactement les colis « à expédier » du widget (coché « posté » exclu)', `bilan=${colis} widget=${w.corps && w.corps.ship && w.corps.ship.total}`);
    dit(/À expédier maintenant : 1 colis/.test((bilansDe('A')[0] || {}).body || ''), '… et le texte le dit');
  });

  console.log('\n── Une fois par semaine');
  await essaie('doublon', async () => {
    reset();
    await lancer(LUNDI);
    const avant = pushes.filter((p) => /^bilan-/.test(p.tag || '')).length;
    await lancer(LUNDI + 3600000);
    await lancer(LUNDI + J);              // le mardi (rattrapage) : déjà envoyé
    const apres = pushes.filter((p) => /^bilan-/.test(p.tag || '')).length;
    dit(avant === 2 && apres === 2, 'relancé le jour même puis le mardi : aucun second bilan', `${avant} puis ${apres}`);
  });
  await essaie('mémo non écrit', async () => {
    reset(); pannes.add('ecrire:A:bilan_semaine_dedup');
    await lancer(LUNDI);
    dit(bilansDe('A').length === 0 && bilansDe('B').length === 1, 'le mémo de A ne s’écrit pas ⇒ A ne reçoit RIEN (sinon il repartirait demain) ; B reçoit le sien');
  });
  await essaie('mémo illisible', async () => {
    reset(); pannes.add('A:bilan_semaine_dedup');
    await lancer(LUNDI);
    dit(bilansDe('A').length === 0, 'le mémo de A est illisible ⇒ rien (pas su s’il est déjà parti)');
  });
  await essaie('jeudi', async () => {
    reset();
    await lancer(JEUDI);
    dit(pushes.filter((p) => /^bilan-/.test(p.tag || '')).length === 0 && !ecrits.some((e) => e.id === 'bilan_semaine_dedup'), 'un jeudi : aucun bilan, aucun mémo');
  });
  await essaie('mardi rattrapage', async () => {
    reset();
    await lancer(LUNDI + J);
    dit(bilansDe('A').length === 1, 'pas parti lundi (base en panne) ⇒ le mardi rattrape, une fois');
  });

  console.log('\n── Ses préférences');
  await essaie('préférence', async () => {
    reset(); V.B.prefs = { bilan: false };
    await lancer(LUNDI);
    dit(bilansDe('B').length === 0 && bilansDe('A').length === 1, '« Bilan de la semaine » coupé chez B ⇒ rien pour B, A reçoit le sien');
  });

  console.log('\n── Un total partiel se dit partiel, et nomme ce qui manque');
  await essaie('leboncoin illisible', async () => {
    reset(); pannes.add('A:lbc_ventes');
    await lancer(LUNDI);
    const c = (bilansDe('A')[0] || {}).body || '';
    dit(/au moins/i.test(c) && /Leboncoin/.test(c), 'Leboncoin illisible chez A ⇒ « au moins », et « Leboncoin » est nommé', c.split('\n')[0]);
    const cb = (bilansDe('B')[0] || {}).body || '';
    dit(!/au moins/i.test(cb.split('\n')[0]), '… chez B (lu en entier), aucune réserve');
  });
  await essaie('compte pas relu', async () => {
    reset(); V.A.ventes[11].cap = new Date(Date.parse('2026-10-01T09:00:00Z')).toISOString();
    await lancer(LUNDI);
    const c = (bilansDe('A')[0] || {}).body || '';
    dit(/au moins/i.test(c) && c.includes('vendeuse_a'), 'un compte dont les ventes datent de jeudi ⇒ « au moins », compte nommé', c.split('\n')[0]);
  });
  await essaie('tout illisible', async () => {
    reset(); for (const m of ['orders_sold', 'lbc_ventes', 'ebay_orders', 'vinted_accounts']) pannes.add('A:' + m);
    await lancer(LUNDI);
    dit(bilansDe('A').length === 0 && !((memos.A || {}).bilan_semaine_dedup), 'tout illisible chez A ⇒ rien envoyé, rien mémorisé (réessai demain — jamais « 0 vente »)');
  });

  console.log(`\n${ok} contrôle(s) OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
