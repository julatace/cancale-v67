// ═══════════════════════════════════════════════════════════════════════════
// BANC : CHAQUE NOTIFICATION MÈNE À SON ÉLÉMENT (31 octobre)
//        (node scripts/bancs/notifs-destination.cjs — après `npm run build`)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « quand on reçoit une notification, ça doit nous amener précisément
// à l'endroit où ça doit nous amener ». Les adresses viennent de la VRAIE règle
// du serveur (`api/_lib/lien-notif.js`, EXÉCUTÉE ici) ; l'app est ouverte sur
// chacune, à froid (`?tab=…`, notification touchée app fermée) et une fois à
// chaud (message `open-url` du service worker, app déjà ouverte). On exige, à
// 390 px tactile et à 1512 px :
//   · le bon écran et le bon filtre de site ;
//   · l'élément visé, par son IDENTITÉ, mis en évidence (`data-cible-notif`) —
//     et OUVERT quand c'est une conversation (avec sa carte d'offre) ou une vente ;
//   · un élément qui n'existe plus ⇒ l'écran reste, UNE ligne le dit ;
//   · jamais un écran blanc ni le garde-fou ; aucune erreur.
// Données INVENTÉES (le dépôt est public), à la forme des lignes réelles.
// BANC_MUTATION=sanscible : les adresses perdent leur cible ⇒ doit rougir.
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const RACINE = path.join(__dirname, '..', '..');
const DIST = path.join(RACINE, 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 8433;
const MUT = process.env.BANC_MUTATION || '';
const SHOTS = process.env.SHOTS || os.tmpdir();

const M = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const ilYa = (j) => iso(M - j * 86400000);
const dans = (j) => new Date(M + j * 86400000).toISOString().slice(0, 10);
const AEXP = 'Le paiement a été validé';
const RELAIS_ST = "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais";
const v = (tx, titre, statut, tus, j, item) => ({ transaction_id: tx, title: titre, price: { amount: '50', currency_code: 'EUR' }, status: statut, ...(tus ? { transaction_user_status: tus } : {}), date: ilYa(j), ...(item ? { item_id: item } : {}) });
const VENTES = [
  v(7001, 'Adidas Samba OG taille 41', AEXP, 'needs_action', 0.2, 'an1'),
  v(7002, 'Nike Air Max 90 taille 42', AEXP, 'needs_action', 0.4, 'an2'),
  v(7102, 'Adidas Gazelle taille 42', RELAIS_ST, 'waiting', 4, 'an7'),
];
const ACHATS = [
  { transaction_id: 9401, conversation_id: 7801, title: 'Vans Old Skool taille 41', price: { amount: '40', currency_code: 'EUR' }, status: RELAIS_ST, transaction_user_status: 'needs_action', date: ilYa(3) },
];
const conv = (id, login, desc, unread, h) => ({ id, unread, updated_at: iso(M - h * 3600e3), description: desc, opposite_user: { id: 5000 + id, login } });
const fil = (id, login, tx, oid, prix) => ({ id, opposite_user: { id: 5000 + id, login }, transaction: { id: tx, item_id: 400 + id }, description: 'Paire ' + id, allow_reply: true,
  messages: [
    { entity_type: 'message', entity: { user_id: 5000 + id, body: 'Bonjour, vous feriez ' + prix + ' € ?' } },
    { entity_type: 'offer_request_message', entity: { user_id: 5000 + id, current: true, status: 10, status_title: '', price: { amount: prix + '.0' }, transaction_id: tx, offer_request_id: oid } },
  ] });
const CONVS = [conv(301, 'acheteuse_a', 'Vous feriez 45 € ?', true, 3), conv(303, 'curieux_a', 'Merci !', false, 26), ...Array.from({ length: 6 }, (_, i) => conv(310 + i, 'autre_' + i, 'Dispo ?', false, 30 + i))];
const NUMS = { an1: { numero: '117', title: VENTES[0].title, price: 50 }, an2: { numero: '42', title: VENTES[1].title, price: 50 }, an7: { numero: '61', title: VENTES[2].title, price: 50 }, 701: { numero: '5', title: 'Paire 301', price: 60, min: 40 } };
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: iso(M) }];
const ROWS = [
  { id: 'main', data: { vinted_annonce_numeros: NUMS, vinted_regime: 'micro', vinted_urssaf_taux: 12.4, vinted_urssaf_freq: 'mensuel' } },
  { id: 'panel_colis_relais', data: { 9401: { code: '418205', lieu: 'Locker Carrefour, 4 Rue de Paris, 35000 Rennes, France', at: iso(M), url: 'https://www.vinted.fr/inbox/7801' } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(M), payload: { my_orders: VENTES } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: iso(M), payload: { my_orders: ACHATS } } },
  { id: 'harvest_111_inbox', data: { capturedAt: iso(M), payload: { conversations: CONVS } } },
  { id: 'harvest_111_conv_301', data: { capturedAt: iso(M), payload: { conversation: fil(301, 'acheteuse_a', 9001, 77, 45) } } },
  { id: 'harvest_111_conv_303', data: { capturedAt: iso(M), payload: { conversation: { ...fil(303, 'curieux_a', 9003, 78, 30), messages: [{ entity_type: 'message', entity: { user_id: 5303, body: 'Merci !' } }] } } } },
  ...[7001, 7002].map((tx) => ({ id: `email_bord_${tx}`, data: { transaction: String(tx), filename: `bordereau_${tx}.pdf`, suivi: `TRK${tx}`, receivedAt: iso(M - 3 * 3600e3), pdfB64: 'JVBERi0xLjQK' } })),
  { id: 'email_track_vinted_1790000000000002', data: { type: 'suivi', carrier: 'vinted', suivi: '1790000000000002', status: 'available', statusLabel: 'Arrivé au point de retrait', subject: "Ton colis t'attend", receivedAt: ilYa(4), code: '3904112', lieu: 'Relais Pressing Mermoz, 14 Avenue Mermoz, 35000 Rennes', limite: dans(1) } },
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 160)); } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul (BANC_PORT)'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let x = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) x = x == null ? null : x[seg];
    out[alias] = x == null ? null : (/->>/.test(src) && typeof x === 'object' ? JSON.stringify(x) : x);
  }
  return out;
};

async function preparer(b, vp) {
  const ctx = await b.newContext({ viewport: vp, timezoneId: 'Europe/Paris', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    if (/api-adresse\.data\.gouv\.fr/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"features":[]}' });
    if (/tiles\.openfreemap\.org/.test(u)) return r.abort();
    return ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue();
  });
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data|^data,updated_at/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: iso(M), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(ROWS.filter((r) => ids.includes(r.id)).map(forme)); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs };
}

// L'état de l'écran après la notification.
const lire = (pg) => pg.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const cible = q('[data-cible-notif]');
  const tache = q('[data-tache]');
  const conv = q('.vrm-inbox-row.is-current');
  return {
    tache: tache ? tache.getAttribute('data-tache') : null, site: tache ? tache.getAttribute('data-tache-site') : null,
    colis: !!q('[data-colis-onglet]'), achats: !!q('.vrm-buy-row'), compta: !!q('[data-compta-urssaf]'),
    cible: cible ? { type: cible.getAttribute('data-cible-notif'), cle: cible.getAttribute('data-colis-ident') || cible.getAttribute('data-cc-carte') || cible.getAttribute('data-conv') || cible.getAttribute('data-tx') || cible.getAttribute('data-achat-tx') || cible.getAttribute('data-cc-colonne') || (cible.hasAttribute('data-compta-urssaf') ? 'urssaf' : '') || (cible.hasAttribute('data-offres-au-mini') ? 'offres' : ''), ouverte: cible.getAttribute('data-ligne-ouverte') } : null,
    fil: !!q('button[aria-label="Fermer la conversation"]'), convCourante: conv ? conv.getAttribute('data-conv') : null,
    offre: !!q('.vrm-chat-panel [data-offre], [data-offre]'),
    tiroir: !!document.querySelector('.vrm-ledger-drawer-host:not([hidden])'),
    absente: (q('[data-cible-absente]') || { getAttribute: () => null }).getAttribute('data-cible-absente'),
    absenteTxt: (q('[data-cible-absente]') || {}).innerText || '',
    gardeFou: /n'a pas pu s'afficher|n’a pas pu s’afficher|Cannot access|is not defined/.test(document.body.innerText),
    blanc: (document.querySelector('.vrm-main') || { innerText: '' }).innerText.trim().length < 40,
  };
});
const attendre = async (pg, f, ms = 15000) => { const t0 = Date.now(); let e; while (Date.now() - t0 < ms) { e = await lire(pg); if (f(e)) return e; await pg.waitForTimeout(250); } return e || lire(pg); };
const sans = (u) => (MUT === 'sanscible' ? u.replace(/&cible=[^&]*/, '') : u);

(async () => {
  const { DESTINATIONS: D } = await import('file://' + path.join(RACINE, 'api', '_lib', 'lien-notif.js'));
  // Les notifications, la destination que le SERVEUR leur donne, et ce qu'on attend.
  const CAS = [
    { nom: 'message (email, lien /inbox/ lu)', url: D.message({ conv: '303', compte: '111' }), ok: (e) => e.tache === 'messages' && e.site === 'vinted' && e.cible && e.cible.cle === '303' && e.fil },
    { nom: 'offre (sa conversation, la carte d’offre)', url: D.message({ conv: '301', compte: '111' }), ok: (e) => e.cible && e.cible.cle === '301' && e.fil && e.offre },
    { nom: 'vente (Vendu !)', url: D.vente({ tx: '7001' }), ok: (e) => e.tache === 'ventes' && e.site === 'vinted' && e.cible && e.cible.type === 'vente' && e.cible.cle === '7001' && e.tiroir },
    { nom: 'bordereau reçu (colis à poster)', url: D.colis({ tx: '7001' }), ok: (e) => e.colis && e.cible && e.cible.cle === 'v:7001' },
    { nom: 'rappel du matin / du soir (colonne « Prêts »)', url: D.colis({}), ok: (e) => e.colis && e.cible && e.cible.cle === 'prets' },
    { nom: 'code de retrait (conversation, par transaction)', url: D.retrait({ tx: '9401' }), ok: (e) => e.colis && e.cible && e.cible.cle === 'r:v:9401' },
    { nom: 'colis arrivé (email transporteur, par n° de suivi)', url: D.retrait({ suivi: '1790000000000002' }), ok: (e) => e.colis && e.cible && e.cible.cle === 'r:e:1790000000000002' },
    { nom: 'achat (suivi Vinted)', url: D.achat({ tx: '9401' }), ok: (e) => e.achats && e.cible && e.cible.cle === '9401' },
    { nom: 'URSSAF', url: D.urssaf(), ok: (e) => e.compta && e.cible && e.cible.type === 'urssaf' },
    { nom: 'vente qui n’est plus là', url: D.vente({ tx: '99999' }), ok: (e) => e.tache === 'ventes' && e.absente === 'vente' && !e.cible, absent: true },
    { nom: 'double vente eBay déjà réglée', url: D.doublon({ plat: 'ebay', num: '117' }), ok: (e) => e.tache === 'annonces' && e.site === 'ebay' && e.absente === 'doublon', absent: true },
  ];
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      const T = `[${vp.width}]`;
      console.log(`── ${vp.width} px`);
      const { ctx, pg, errs } = await preparer(b, vp);
      for (const c of CAS) {
        await essaie(c.nom, async () => {
          await pg.goto(`http://localhost:${PORT}${sans(c.url)}`, { waitUntil: 'domcontentloaded' });
          const e = await attendre(pg, (x) => c.ok(x), c.absent ? 20000 : 20000);
          dit(c.ok(e), `${T} ${c.nom} → ${c.url}`, JSON.stringify({ t: e.tache, s: e.site, c: e.cible, fil: e.fil, off: e.offre, tir: e.tiroir, abs: e.absente }));
          dit(!e.gardeFou && !e.blanc, `${T} ${c.nom} : ni écran blanc ni garde-fou`);
          if (c.absent) dit(e.absenteTxt.split('\n').length <= 2 && e.absenteTxt.length < 220, `${T} ${c.nom} : UNE ligne le dit`, e.absenteTxt);
          if (/retrait \(conv|vente \(Vendu/.test(c.nom)) await pg.screenshot({ path: path.join(SHOTS, `notifs-${vp.width}-${c.nom.slice(0, 6).replace(/\W/g, '')}.png`) });
        });
      }
      // À CHAUD : l'app est ouverte (Ma journée), le service worker lui transmet l'adresse.
      await essaie('à chaud', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(2500);
        await pg.evaluate((u) => { navigator.serviceWorker.dispatchEvent(new MessageEvent('message', { data: { type: 'open-url', url: u } })); }, sans(D.retrait({ tx: '9401' })));
        const e = await attendre(pg, (x) => x.cible && x.cible.cle === 'r:v:9401', 20000);
        const dbg = await pg.evaluate(() => ({ cartes: [...document.querySelectorAll('[data-cc-carte]')].map((x) => x.getAttribute('data-cc-carte')).slice(0, 20), url: location.href }));
        dit(e.colis && e.cible && e.cible.cle === 'r:v:9401', `${T} à chaud (app ouverte) : le code de retrait mène à SA carte dans Colis`, JSON.stringify(dbg));
      });
      dit(errs.length === 0, `${T} aucune erreur de page`, errs.join(' | ').slice(0, 200));
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ destinations des notifications : ${ko} rouge(s)` : '\n✅ destinations des notifications : tout est vert');
  process.exit(ko ? 1 : 0);
})();
