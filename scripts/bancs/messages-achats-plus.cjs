// ════════════════════════════════════════════════════════════════════════════
//  BANC : MESSAGES ET ACHATS, EN PLUS (14 nov., lot messages-achats-plus)
//  docs/passation/2026-11-14-messages-achats-plus.md — données INVENTÉES (dépôt public).
//
//  Il juge l'app RENDUE (jamais un libellé, §6.4), 390 tactile (clair ET sombre) et 1512 :
//   A. Messages (108, 109) : dans le fil d'une vente dont l'acheteur demande « quelle
//      taille réelle ? et la semelle ? », la rangée d'aide propose la taille et la semelle
//      DE LA FICHE ; un toucher INSÈRE dans le champ — aucune commande d'envoi ne part ;
//      les puces font 44 px au doigt ; rien ne déborde du fil ;
//   B. Achats (131, 125, 111) : « Même annonce achetée deux fois » nomme UNE annonce (même
//      identifiant sur deux comptes ; la même au titre identique mais autre identifiant n'y est
//      pas) ; le carnet range les achats chez le vendeur LU sur la transaction (deux vendeurs au
//      même pseudo : deux lignes) avec sa couverture ; la liste de recherche s'ouvre ;
//   C. Annonces → Outils → « Catalogue privé » (110) : la feuille liste ses annonces, le
//      navigateur n'envoie QUE des identifiants (aucun prix d'achat) ; un seul bouton plein.
//  Sur origin/main (`BANC_DIST=<build d'avant>`), ces éléments n'existent pas : rouge.
//  `BANC_PORT` aléatoire par défaut ; `SHOTS=<dossier>` pour les captures.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http'), os = require('os');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const { test: filtrePg } = require('./_minipgrest.cjs');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || (20000 + Math.floor(Math.random() * 20000));
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-messages-achats-plus');
fs.mkdirSync(SHOTS, { recursive: true });

const MAINT = Date.now();
const ilYa = (j, h = 0) => new Date(MAINT - j * 864e5 - h * 36e5).toISOString();
const UID = '111', UID2 = '222';
let nPh = 0;
const ph = () => ({ url: `https://images1.vinted.net/t/b${++nPh}/f800/x.jpeg?s=x` });
const achat = (id, titre, prix, statut, j) => ({ transaction_id: id, conversation_id: 7000 + id % 1000, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: statut, date: ilYa(j), photo: ph() });
const ACHATS1 = [achat(9301, 'Nike Dunk Low panda taille 42', 48, 'Commande finalisée', 40), achat(9302, 'Nike Dunk Low panda taille 42', 52, 'Commande finalisée', 20), achat(9303, 'Adidas Samba OG noir taille 42', 45, 'Commande finalisée', 12)];
const ACHATS2 = [achat(9401, 'Dunk panda (même annonce, autre compte)', 49, 'Commande finalisée', 5), achat(9402, 'Asics Gel-Kayano 14 argent taille 44', 61, 'Commande finalisée', 8)];
// Le détail des transactions d'achat : 9301 et 9401 = la MÊME annonce (7777001) ; 9302 = même titre, AUTRE annonce.
// Vendeurs : 501 « shop_dunk » (9301, 9302), 502 « shop_dunk » aussi (même pseudo, autre identifiant : 9303), 9401 et 9402 : pas de détail.
const txn = (uid, tx, item, sid, login, j) => ({ id: `harvest_${uid}_txn_${tx}`, data: { capturedAt: ilYa(0), payload: { transaction: { id: tx, item_id: item, user_side: 'buyer', seller_id: sid, seller: { id: sid, login }, buyer_id: 1, status: 450, status_title: 'Commande finalisée', status_updated_at: ilYa(j) } } } });
const msg = (uid, body, h) => ({ entity_type: 'message', entity: { user_id: uid, body, created_at_ts: ilYa(0, h) }, created_at_ts: ilYa(0, h) });
const FIL = { id: 301, opposite_user: { id: 5301, login: 'margaux_lp' }, transaction: { id: 9901, item_id: 4301, item_title: 'Nike Air Max 90 blanche taille 43', current_user_side: 'seller' }, description: 'Nike Air Max 90 blanche taille 43', allow_reply: true,
  messages: [msg(5301, 'Bonjour ! Elle est toujours disponible ?', 30), msg(Number(UID), 'Bonjour, oui 🙂', 29), msg(5301, 'Super. Quelle taille réelle ? Et la longueur de la semelle en cm ?', 2)] };
FIL.messages = FIL.messages.map((m, i) => ({ ...m, id: i + 1, entity: { ...m.entity, id: i + 1 } }));
const ANNONCES = [4301, 4302, 4303, 4304].map((id, k) => ({ id, title: ['Nike Air Max 90 blanche taille 43', 'Salomon XT-6 Advanced gris taille 44 2/3', 'New Balance 550 crème taille 41', 'Asics Gel-1130 argent taille 42'][k], brand_title: ['Nike', 'Salomon', 'New Balance', 'Asics'][k], size_title: ['43', '44 2/3', '41', '42'][k], price: { amount: String(80 + k * 15) + '.0', currency_code: 'EUR' }, status: 'Très bon état', is_closed: false, is_hidden: false, is_draft: false, photo: ph(), favourite_count: k, view_count: 10 + k, created_at_ts: Math.floor((MAINT - (10 + k) * 864e5) / 1000) }));
const ACCOUNTS = [{ id: 1, vinted_user_id: UID, login: 'compte_exemple_un', domain: 'www.vinted.fr', updated_at: ilYa(0) }, { id: 2, vinted_user_id: UID2, login: 'compte_exemple_deux_long', domain: 'www.vinted.fr', updated_at: ilYa(0) }];
const cap = ilYa(0);
const conv = (id, login, desc, unread, h) => ({ id, unread, updated_at: ilYa(0, h), description: desc, opposite_user: { id: 5000 + id, login }, item_photos: [ph()] });
const LIGNES = [
  { id: 'main', data: {
    vinted_annonce_numeros: { 4301: { numero: '124', accountId: UID, title: ANNONCES[0].title }, 4302: { numero: '125', accountId: UID, title: ANNONCES[1].title } },
    vrm_infos_paires: { 'n:124': { taille: 'taille petit, prendre ½ au-dessus', defauts: 'petite tache semelle gauche', semelle: 28.5, at: ilYa(1) } },
    vrm_liste_recherche: [{ id: 'r1', marque: 'Nike', modele: 'dunk low', tailles: ['42'], prixMax: 60, actif: true }],
  } },
  { id: `harvest_${UID}_listings`, data: { capturedAt: ilYa(0, 0.02), nItems: ANNONCES.length, payload: { items: ANNONCES, pagination: { total_entries: ANNONCES.length } } } },
  { id: `harvest_${UID2}_listings`, data: { capturedAt: ilYa(0, 0.02), nItems: 0, payload: { items: [], pagination: { total_entries: 0 } } } },
  { id: `harvest_${UID}_orders_purchased`, data: { capturedAt: cap, payload: { my_orders: ACHATS1 } } },
  { id: `harvest_${UID2}_orders_purchased`, data: { capturedAt: cap, payload: { my_orders: ACHATS2 } } },
  { id: `harvest_${UID}_orders_sold`, data: { capturedAt: cap, payload: { my_orders: [] } } },
  { id: `harvest_${UID2}_orders_sold`, data: { capturedAt: cap, payload: { my_orders: [] } } },
  txn(UID, 9301, 7777001, 501, 'shop_dunk', 36), txn(UID, 9302, 7777002, 501, 'shop_dunk', 17), txn(UID, 9303, 7777003, 502, 'shop_dunk', 10), txn(UID2, 9401, 7777001, 503, 'autre_vendeur', 3),
  { id: `harvest_${UID}_inbox`, data: { capturedAt: cap, payload: { conversations: [conv(301, 'margaux_lp', 'Super. Quelle taille réelle ? Et la longueur de la semelle en cm ?', true, 2), conv(303, 'kevin.b', 'Merci, bien reçu !', false, 26)] } } },
  { id: `harvest_${UID2}_inbox`, data: { capturedAt: cap, payload: { conversations: [] } } },
  { id: `harvest_${UID}_conv_301`, data: { capturedAt: cap, payload: { conversation: FIL } } },
];

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 220)); } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!p.startsWith(DIST) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    const texte = /->>[^>]*$/.test(src);
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    if (texte && v != null && typeof v !== 'string') v = typeof v === 'object' ? JSON.stringify(v) : String(v);
    out[alias] = v == null ? null : v;
  }
  return out;
};
const photoSvg = (k) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="hsl(${(k * 47) % 360},22%,86%)"/><path d="M70 250 C90 190 150 180 190 200 C230 220 280 205 320 230 C345 245 340 280 300 282 L90 282 C70 282 62 268 70 250 Z" fill="rgba(30,34,40,.55)"/></svg>`;
// Le pont de l'extension (connecté au compte 111) : il NOTE chaque commande, pour prouver qu'aucune ne part seule.
const PONT = ({ fils }) => {
  const version = '5.376.0';
  window.__commandes = [];
  const post = (m) => window.postMessage({ id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', ...m }, '*');
  try { if (!window.chrome) window.chrome = {}; Object.defineProperty(window.chrome, 'runtime', { configurable: true, value: { sendMessage: (id, m, cb) => { window.__commandes.push({ par: 'runtime', type: m && m.type }); cb && cb(null); } } }); } catch (_) {}
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version });
    if (d.__vmr === 'authEtat') post({ __vmr: 'authEtat:result', reqId: d.reqId, etat: { ok: true, connecte: true, expiree: false, email: 'banc@vrm.test', user_id: '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b', cloisonne: false } });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, code: version, vrm: { ok: true, connecte: true, email: 'banc@vrm.test', user_id: '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b' }, vinted: { uid: '111', login: 'compte_exemple_un' }, cmds: {} } });
    if (d.__vmr === 'exec') {
      if (String(d.method || 'GET').toUpperCase() !== 'GET') window.__commandes.push({ par: 'exec', endpoint: d.endpoint, method: d.method });
      const m = /conversations\/(\d+)$/.exec(d.endpoint || '');
      setTimeout(() => post({ __vmr: 'result', reqId: d.reqId, ok: true, status: 200, data: String(d.method || 'GET').toUpperCase() === 'GET' ? { conversation: (m && fils[m[1]]) || null } : {} }), 40);
    }
  });
  post({ __vmr: 'ready', version });
};

async function ouvrir(b, { W, sombre }, tab) {
  const tel = W < 600;
  const ctx = await b.newContext({ ...(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1512, height: 950 } }), colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message || e).slice(0, 160)));
  await pg.addInitScript((s) => { try { if (!sessionStorage.getItem('banc_init')) { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', s ? 'true' : 'false'); localStorage.setItem('vrm_langue', 'fr'); localStorage.setItem('vrm_bienvenue_vue', JSON.stringify({ at: 'banc' })); localStorage.setItem('vrm_visite_vue', JSON.stringify({ at: 'banc' })); localStorage.setItem('vrm_aide_installation_vue', '1'); sessionStorage.setItem('banc_init', '1'); } } catch (_) {} }, sombre);
  await pg.addInitScript(PONT, { fils: { 301: FIL } });
  const appels = { catalogue: [] };
  await pg.route(/^https?:\/\/[^/]*vinted\.net\//i, (r) => { const m = /\/b(\d+)\//.exec(r.request().url()); return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: photoSvg(m ? Number(m[1]) : 0) }); });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1|[^/]*vinted\.net)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data,updated_at/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: cap, cap: r.data.capturedAt });
    const filtres = (r) => [...new URL(u.replace(/#/g, '%23')).searchParams.entries()].every(([k, v]) => !/^data(->>|->)/.test(k) || filtrePg(r, k, v));
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map(forme));
    const ins = /id=in\.\(([^)]*)\)/.exec(u);
    if (ins) { const ids = ins[1].split(',').map((x) => x.replace(/^"|"$/g, '')); return j(LIGNES.filter((r) => ids.includes(r.id) && filtres(r)).map(forme)); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/_/g, '.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id) && filtres(r)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => {
    const u = r.request().url();
    if (/mode=catalogue/.test(u)) {
      const m = r.request().method();
      const corps = m === 'POST' ? r.request().postDataJSON() : null;
      appels.catalogue.push({ m, corps });
      if (m === 'GET') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, catalogues: [] }) });
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, cid: 'aaaaaaaaaaaaaaa1', url: 'https://vrm.center/catalogue/' + 'x'.repeat(43), expire: ilYa(-7), n: (corps.items || []).length, absentes: 0 }) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' });
  });
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs, tel, appels };
}
const capturer = (pg, nom) => pg.screenshot({ path: path.join(SHOTS, nom + '.png') }).catch(() => {});
// Rien ne sort de sa boîte : chaque élément de la zone reste dans `cadre` (débordement à droite/gauche).
const deborde = (pg, zone, cadre) => pg.evaluate(([z, c]) => {
  const out = [];
  for (const el of document.querySelectorAll(z + ' *')) {
    const s = getComputedStyle(el); if (s.display === 'none' || s.visibility === 'hidden') continue;
    const box = el.closest(c); if (!box) continue;
    const a = el.getBoundingClientRect(), b = box.getBoundingClientRect();
    if (a.width < 1) continue;
    const scroller = el.closest('.vrm-aide-rep-rangee'); if (scroller && el !== scroller) continue;   // une rangée qui défile : ses puces vont au-delà
    if (a.right > b.right + 1 || a.left < b.left - 1) out.push((el.className || el.tagName) + ' ' + Math.round(a.right - b.right));
  }
  return out.slice(0, 5);
}, [zone, cadre]);

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.log('❌ pas de build : npm run build (ou BANC_DIST=…)'); process.exit(1); }
  srv.listen(PORT);
  const b = await chromium.launch({ ...(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {}), args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const VUES = [{ W: 390, sombre: false }, { W: 390, sombre: true }, { W: 1512, sombre: false }];
  for (const v of VUES) {
    const T = `${v.W}${v.sombre ? ' sombre' : ''}`;
    console.log(`\n── A. Messages : aide à la réponse · ${T}`);
    await essaie(`messages ${T}`, async () => {
      const { ctx, pg, errs, tel } = await ouvrir(b, v, 'cat_msg');
      await pg.waitForSelector('[data-conv="301"]', { timeout: 30000 });
      await pg.click('[data-conv="301"]');
      await pg.waitForSelector('.vrm-chat-compose textarea', { timeout: 15000 }).catch(() => {});
      const aide = await pg.waitForSelector('[data-aide-reponse]', { timeout: 8000 }).catch(() => null);
      await pg.waitForTimeout(600);
      await capturer(pg, `messages-${T.replace(' ', '-')}`);
      dit(!!aide, `${T} la rangée d’aide est au-dessus du champ de réponse`);
      const q = aide ? await pg.locator('[data-aide-question]').getAttribute('data-aide-question').catch(() => '') : '';
      dit(/taille/.test(q || '') && /mesures/.test(q || ''), `${T} questions repérées dans le message : taille + semelle`, q);
      const pT = await pg.locator('[data-aide-proposition="taille"]').count(), pS = await pg.locator('[data-aide-proposition="mesures"]').count();
      dit(pT === 1 && pS === 1, `${T} deux réponses proposées, faites de la fiche (taille réelle, semelle)`);
      const avant = await pg.evaluate(() => (window.__commandes || []).length);
      if (pT) await pg.locator('[data-aide-proposition="taille"]').click();
      if (pS) await pg.locator('[data-aide-proposition="mesures"]').click();
      await pg.waitForTimeout(400);
      const val = await pg.locator('.vrm-chat-compose textarea').inputValue().catch(() => '');
      dit(/Taille réelle : taille petit, prendre ½ au-dessus\./.test(val) && /Longueur de semelle : 28,5 cm\./.test(val), `${T} un toucher INSÈRE dans le champ`, val.slice(0, 120));
      const apres = await pg.evaluate(() => (window.__commandes || []).length);
      dit(apres === avant, `${T} rien n’est envoyé sans son clic « Envoyer »`, `${apres - avant} commande(s)`);
      if (tel) {
        const petites = await pg.evaluate(() => [...document.querySelectorAll('[data-aide-reponse] button')].filter((e) => e.getBoundingClientRect().height < 43.5).map((e) => e.textContent.slice(0, 20)));
        dit(!petites.length, `${T} les puces font 44 px au doigt`, petites.join(' | '));
      }
      const d = await deborde(pg, '[data-aide-reponse]', '.vrm-chat-panel, .vrm-chat-foot, [data-aide-reponse]');
      dit(!d.length, `${T} rien ne sort du fil`, d.join(' | '));
      const bleuPlein = await pg.evaluate(() => [...document.querySelectorAll('[data-aide-reponse] button')].filter((e) => { const c = getComputedStyle(e, '::before').backgroundColor; const m = /rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?/.exec(c); return m && Number(m[3]) > 180 && Number(m[1]) < 40 && (m[4] == null || Number(m[4]) > 0.6); }).length);
      dit(bleuPlein === 0, `${T} aucune puce en bleu plein (secondaires en teinte légère)`);
      dit(!errs.length, `${T} sans erreur`, errs.join(' | '));
      await ctx.close();
    });
    console.log(`\n── B. Achats : même annonce, carnet, liste de recherche · ${T}`);
    await essaie(`achats ${T}`, async () => {
      const { ctx, pg, errs } = await ouvrir(b, v, 'achats');
      const bloc = await pg.waitForSelector('[data-achats-plus]', { timeout: 30000 }).catch(() => null);
      dit(!!bloc, `${T} le groupe « Pour mieux acheter » est sous la liste d’Achats`);
      if (bloc) {
        await pg.waitForSelector('[data-achats-doubles]', { timeout: 15000 }).catch(() => {});
        const n = await pg.locator('[data-achats-doubles]').getAttribute('data-achats-doubles').catch(() => null);
        dit(n === '1', `${T} « Même annonce achetée deux fois » : 1 annonce (même identifiant, deux comptes)`, String(n));
        await pg.locator('[data-achats-plus]').scrollIntoViewIfNeeded().catch(() => {});
        await capturer(pg, `achats-${T.replace(' ', '-')}`);
        if (n) {
          await pg.locator('[data-achats-doubles]').click();
          await pg.waitForSelector('[data-feuille-doubles]', { timeout: 5000 });
          const g = await pg.evaluate(() => [...document.querySelectorAll('[data-double-item]')].map((s) => s.getAttribute('data-double-item') + ':' + [...s.querySelectorAll('[data-double-tx]')].map((x) => x.getAttribute('data-double-tx')).sort().join('+')));
          dit(g.join() === '7777001:9301+9401', `${T} le groupe : 9301 + 9401 (le titre identique 9302 n’y est pas)`, g.join());
          await capturer(pg, `achats-doubles-${T.replace(' ', '-')}`);
          await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
        }
        await pg.locator('[data-achats-carnet]').click();
        await pg.waitForSelector('[data-feuille-carnet="lu"]', { timeout: 15000 }).catch(() => {});
        const c = await pg.evaluate(() => ({ couv: (document.querySelector('[data-carnet-couverture]') || {}).getAttribute ? document.querySelector('[data-carnet-couverture]').getAttribute('data-carnet-couverture') : '',
          v: [...document.querySelectorAll('[data-carnet-vendeur]')].map((e) => e.getAttribute('data-carnet-vendeur') + ':' + e.getAttribute('data-carnet-achats')) }));
        dit(c.couv === '4/5', `${T} carnet : vendeur connu pour 4 achats sur 5 (couverture dite)`, c.couv);
        dit(c.v.includes('501:2') && c.v.includes('502:1') && c.v.includes('503:1'), `${T} carnet : deux vendeurs au même pseudo restent deux (identifiant de la transaction)`, c.v.join(' '));
        await capturer(pg, `achats-carnet-${T.replace(' ', '-')}`);
        await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
        await pg.locator('[data-achats-recherche]').click();
        const fr = await pg.waitForSelector('[data-feuille-recherche]', { timeout: 5000 }).catch(() => null);
        dit(!!fr && (await pg.locator('[data-recherche-id="r1"]').count()) === 1, `${T} la liste de recherche s’ouvre avec sa ligne`);
        const pleins = await pg.evaluate(() => [...document.querySelectorAll('[data-feuille-recherche] .vrm-plus-principal')].filter((e) => e.getBoundingClientRect().height > 0).length);
        dit(pleins <= 1, `${T} au plus un bouton plein dans la feuille`, String(pleins));
        await capturer(pg, `achats-recherche-${T.replace(' ', '-')}`);
      }
      dit(!errs.length, `${T} sans erreur`, errs.join(' | '));
      await ctx.close();
    });
    console.log(`\n── C. Annonces → Outils → Catalogue privé · ${T}`);
    await essaie(`catalogue ${T}`, async () => {
      const { ctx, pg, errs, appels } = await ouvrir(b, v, 'annonces');
      await pg.waitForSelector('.vrm-ann-outils-mot, [aria-label="Outils des annonces"]', { timeout: 30000 }).catch(() => {});
      const bouton = pg.locator('button.vrm-annbar-bouton[aria-expanded]').first();
      await bouton.click({ timeout: 10000 }).catch(() => {});
      const outil = await pg.waitForSelector('[data-outil-annonces="catalogue"]', { timeout: 5000 }).catch(() => null);
      dit(!!outil, `${T} « Catalogue privé » est dans Annonces → Outils`);
      if (outil) {
        await outil.click();
        await pg.waitForSelector('[data-catalogue-item]', { timeout: 10000 }).catch(() => {});
        const n = await pg.locator('[data-catalogue-item]').count();
        dit(n >= 4, `${T} la feuille liste ses annonces en ligne`, String(n));
        await pg.locator('[data-catalogue-item]').first().click();
        await pg.locator('[data-catalogue-item]').nth(1).click();
        const pleins = await pg.evaluate(() => [...document.querySelectorAll('[data-catalogue-feuille] .vrm-plus-principal')].filter((e) => e.getBoundingClientRect().height > 0).length);
        dit(pleins === 1, `${T} un seul bouton plein (« Créer le lien »)`, String(pleins));
        await capturer(pg, `catalogue-${T.replace(' ', '-')}`);
        await pg.locator('[data-catalogue-creer]').click();
        await pg.waitForSelector('[data-catalogue-url]', { timeout: 8000 }).catch(() => {});
        const post = appels.catalogue.find((a) => a.m === 'POST');
        dit(post && JSON.stringify(Object.keys(post.corps).sort()) === '["action","items","jours","numero","titre"]' && post.corps.items.every((x) => /^\d+$/.test(x)) && post.corps.jours === 7,
          `${T} le navigateur n’envoie que des identifiants d’annonces (7 jours par défaut), aucun prix`, JSON.stringify(post && post.corps));
        dit((await pg.locator('[data-catalogue-url]').count()) === 1, `${T} le lien créé est montré, prêt à copier`);
        await capturer(pg, `catalogue-cree-${T.replace(' ', '-')}`);
      }
      dit(!errs.length, `${T} sans erreur`, errs.join(' | '));
      await ctx.close();
    });
  }
  await b.close(); srv.close();
  console.log(`\n${ok} vert(s), ${ko} rouge(s) — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
