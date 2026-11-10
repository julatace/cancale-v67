// ═══════════════════════════════════════════════════════════════════════════
// BANC : LA RECHERCHE UNIVERSELLE — lot AX (10 novembre)
//        (node scripts/bancs/recherche-exacte.cjs — après le build)
//        BANC_PORT=… pour un autre port · BANC_DIST=… pour un autre build
// ═══════════════════════════════════════════════════════════════════════════
// Données INVENTÉES (le dépôt est public). Il exige, à 390 px tactile et 1512 px,
// en clair et en sombre, dans LA loupe (⌘K / Ctrl+K sur ordinateur, la loupe au
// téléphone — le même panneau) :
//   · un n° de suivi tapé avec espaces et minuscules ⇒ SA vente EN TÊTE,
//     « Correspondance exacte · Trouvé par son n° de suivi », une seule fois ;
//     la paire dont le TITRE porte ce suivi reste dans « Paires », « par le titre » ;
//   · un code de retrait ⇒ CE colis en tête, et c'est un retrait (Entrée l'ouvre) ;
//   · un n° de transaction ⇒ SA vente en tête ;
//   · « 007 » ⇒ « Tout sur le N°7 » et « Correspondance exacte · par son N° » ;
//   · 50 paires au même titre ⇒ AUCUNE tête, 50 lignes « par le titre » ;
//   · un pseudo ⇒ aucune tête (un acheteur achète plusieurs fois) ;
//   · groupes « Colis » (envoyés) et « Retraits » (qui viennent chez lui) ;
//   · aucune lecture de la base pendant la frappe (tout en mémoire) ;
//   · une lecture TENUE ⇒ « Colis et retraits pas encore lus », puis rien ;
//   · une lecture des achats ratée ⇒ « Achats pas lus (la lecture n’a pas répondu) » ;
//   · lignes ≥ 44 px, aucun débordement, aucune erreur de page.
// Captures : $TMPDIR/vrm-bancs/recherche-exacte/*.png (À REGARDER).
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 12290;
const SHOTS = path.join(os.tmpdir(), 'vrm-bancs', 'recherche-exacte');
fs.mkdirSync(SHOTS, { recursive: true });

const MAINTENANT = Date.now(), H = 3600000;
const ilYaH = (h) => new Date(MAINTENANT - h * H).toISOString();
const T = 'Nike Dunk Low Panda taille 42';
const VENTES = Array.from({ length: 50 }, (_, i) => ({ transaction_id: 22999990100 + i, title: T, status: 'Commande finalisée', transaction_user_status: 'completed', date: ilYaH(10 + i), price: { amount: '80.0', currency_code: 'EUR' } }));
VENTES.push({ transaction_id: 22314280001, title: 'Adidas Samba OG', status: 'Commande finalisée', transaction_user_status: 'completed', date: ilYaH(100), price: { amount: '95.0', currency_code: 'EUR' } });
const ACHATS = [{ transaction_id: 23705320001, title: 'Salomon XT-6 gris', status: 'Commande finalisée', transaction_user_status: 'completed', date: ilYaH(120), price: { amount: '60.0', currency_code: 'EUR' } }];
const NUMEROS = {};
for (let i = 0; i < 50; i++) NUMEROS['p' + (201 + i)] = { numero: String(201 + i), title: T, price: '80', accountId: '111' };
NUMEROS.n7 = { numero: '7', title: 'Asics Gel-Kayano 14', price: '90', accountId: '111' };
NUMEROS.n17 = { numero: '17', title: 'Asics Gel 1130', price: '70', accountId: '111' };
NUMEROS.n70 = { numero: '70', title: 'Puma Speedcat', price: '75', accountId: '111' };
NUMEROS.piege = { numero: '160', title: 'Lot XW300000007FR à vérifier', price: '40', accountId: '111' };
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: ilYaH(0) }];
const EMAILS = [
  ...VENTES.slice(0, 50).map((o, i) => ({ id: 'email_sale_' + i, data: { type: 'sale', pseudo: i < 2 ? 'acheteuse_fidele' : 'acheteuse_' + i, transaction: String(o.transaction_id), receivedAt: ilYaH(10 + i) } })),
  ...VENTES.slice(0, 50).map((o, i) => ({ id: 'email_bord_' + i, data: { type: 'bordereau', suivi: 'XW' + String(300000000 + i) + 'FR', transaction: String(o.transaction_id), receivedAt: ilYaH(10 + i) } })),
  { id: 'email_track_a', data: { type: 'suivi', suivi: 'MR7000123', code: '482913', status: 'available', sens: 'entrant', artTitle: 'Salomon XT-6', carrier: 'mondialrelay', lieu: 'Tabac du port, 1 rue du Port, 35260 Cancale', receivedAt: ilYaH(3) } },
  { id: 'email_track_b', data: { type: 'suivi', suivi: 'MR7000124', code: '482914', status: 'delivered', sens: 'entrant', artTitle: 'Veja Campo', carrier: 'mondialrelay', lieu: 'Tabac du port, 1 rue du Port, 35260 Cancale', receivedAt: ilYaH(40) } },
  { id: 'email_track_c', data: { type: 'suivi', suivi: 'MR55512345', status: 'delivered', sens: 'sortant', artTitle: 'Adidas Samba OG', carrier: 'mondialrelay', receivedAt: ilYaH(90) } },
];
const ROWS = [
  { id: 'main', data: { vinted_annonce_numeros: NUMEROS, vinted_used_numeros: Object.values(NUMEROS).map((x) => x.numero).filter((x) => /^\d+$/.test(x)).map(Number), vinted_dark: false } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: ilYaH(0.2), nItems: VENTES.length, payload: { my_orders: VENTES } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: ilYaH(0.2), nItems: ACHATS.length, payload: { my_orders: ACHATS } } },
  ...EMAILS,
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (!c && d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).replace(/\s+/g, ' ').slice(0, 300)); } };
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
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'object' ? String(v) : v);
  }
  return out;
};
const motif = (p) => new RegExp('^' + p.replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$');

// mode : 'normal' · 'tenu' (la lecture des colis de la loupe attend `relacher`) · 'achats-ko' (les achats rendent 500)
async function preparer(b, vp, { sombre = false, mode = 'normal' } = {}) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = [], lectures = [];
  let relacher = () => {}; const tenue = new Promise((r) => { relacher = r; });
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(({ s }) => { try { localStorage.setItem('vrm_acces_direct', '1'); if (s) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, { s: sombre });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', async (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    lectures.push(u);
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') return j([]);
    // Toute lecture qui POURRAIT rendre la ligne des achats (in.(…), like.harvest_*_orders_*…) tombe en panne.
    const peutAchats = (() => { const inn = /id=in\.\(([^)]*)\)/.exec(u); if (inn) return inn[1].split(',').includes('harvest_111_orders_purchased'); const lk = /id=like\.([^&]*)/.exec(u); return !!(lk && motif(lk[1]).test('harvest_111_orders_purchased')) || /id=eq\.harvest_111_orders_purchased/.test(u); })();
    if (mode === 'achats-ko' && peutAchats) return route.fulfill({ status: 500, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"message":"panne"}' });
    // La lecture des colis PROPRE à la loupe (projection code2 + artTitle) : tenue jusqu'à `relacher`.
    if (mode === 'tenu' && /code2:data->>code2/.test(u) && /artTitle/.test(u)) await tenue;
    if (/select=owner/.test(u)) return j([]);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt || ilYaH(0), cap: r.data.capturedAt });
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(ROWS.filter((r) => ids.includes(r.id)).map(forme)); }
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = motif(lk[1]); let l = ROWS.filter((r) => re.test(r.id)); const rg = req.headers()['range']; if (rg) { const m = /(\d+)-(\d+)/.exec(rg); if (m) l = l.slice(+m[1], +m[2] + 1); } return j(l.map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => {
    const u = r.request().url();
    if (/email-rattacher\?mode=journal/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, page: 0, parPage: 20, suite: false, emails: [], compteurs: { sur: 0, plus: false, integre: 0, aVerifier: 0, erreur: 0, incompris: 0, parRubrique: {} }, adresses: [], cherche: new URL(u).searchParams.get('cherche') || '' }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' });
  });
  return { ctx, pg, errs, lectures, relacher };
}
// Taper comme React le lit (événement `input`), puis attendre le sélecteur.
const taper = (pg, q, sel) => pg.evaluate(async ({ q, sel }) => {
  const el = document.querySelector('[data-recherche-champ]');
  const poser = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  poser.call(el, q); el.dispatchEvent(new Event('input', { bubbles: true }));
  return await new Promise((res) => {
    const ok = () => document.querySelector(sel);
    if (ok()) return res(true);
    const mo = new MutationObserver(() => { if (ok()) { mo.disconnect(); res(true); } });
    mo.observe(document.body, { subtree: true, childList: true, attributes: true });
    setTimeout(() => { mo.disconnect(); res(false); }, 6000);
  });
}, { q, sel: `[data-recherche-q="${q.trim().toLowerCase()}"] ${sel}` });
const etat = (pg) => pg.evaluate(() => {
  const lignes = [...document.querySelectorAll('[data-recherche-panneau] [data-recherche-resultat]')];
  const tete = document.querySelector('[data-recherche-exacte]');
  return {
    r: lignes.map((x) => ({ type: x.getAttribute('data-recherche-resultat'), par: x.getAttribute('data-recherche-par'), cle: x.getAttribute('data-recherche-cle'), groupe: (x.closest('[data-recherche-groupe]') || { getAttribute: () => '' }).getAttribute('data-recherche-groupe'), h: Math.round(x.getBoundingClientRect().height) })),
    tete: tete ? { txt: tete.innerText, par: (tete.querySelector('[data-recherche-exacte-par]') || { getAttribute: () => '' }).getAttribute('data-recherche-exacte-par') } : null,
    teteNum: !!document.querySelector('[data-recherche-exacte-numero]'),
    tout: !!document.querySelector('[data-recherche-panneau] [data-tout-num]'),
    groupes: [...document.querySelectorAll('[data-recherche-panneau] [data-recherche-groupe]')].map((g) => g.getAttribute('data-recherche-groupe')),
    entetes: [...document.querySelectorAll('[data-recherche-panneau] [data-recherche-entete]')].map((g) => g.textContent),
    nonLu: (document.querySelector('[data-recherche-non-lu]') || null) && { cles: document.querySelector('[data-recherche-non-lu]').getAttribute('data-recherche-non-lu'), encours: document.querySelector('[data-recherche-non-lu]').getAttribute('data-recherche-non-lu-encours'), txt: document.querySelector('[data-recherche-non-lu]').innerText },
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
  };
});
const ouvrirLoupe = async (pg, tel, { attendre = true } = {}) => {
  if (tel) await pg.locator('button[aria-label="Rechercher une paire"]').first().tap();
  else { await pg.locator('body').click({ position: { x: 5, y: 400 } }).catch(() => {}); await pg.keyboard.press('ControlOrMeta+k'); }
  for (let i = 0; i < 60; i++) { const v = await pg.evaluate(() => { const p = document.querySelector('[data-recherche-panneau]'); return p ? p.getAttribute('data-recherche-pret') : null; }); if (v === '1' || (!attendre && v != null)) break; await pg.waitForTimeout(250); }
};

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const tours = [[{ width: 390, height: 844 }, false], [{ width: 390, height: 844 }, true], [{ width: 1512, height: 950 }, false], [{ width: 1512, height: 950 }, true]];
    for (const [vp, sombre] of (process.env.BANC_SEUL === 'ko' ? [] : tours)) {
      const tel = vp.width < 600; const TT = `[${vp.width}${sombre ? ' sombre' : ''}]`; const suf = `${vp.width}${sombre ? '-sombre' : ''}`;
      console.log(`── ${vp.width} px${sombre ? ' · sombre' : ''}`);
      const { ctx, pg, errs, lectures } = await preparer(b, vp, { sombre });
      await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
      await pg.waitForTimeout(2500);
      await essaie('ouvrir', async () => {
        await ouvrirLoupe(pg, tel);
        const p = await pg.evaluate(() => { const p = document.querySelector('[data-recherche-panneau]'); return p && p.getAttribute('data-recherche-pret'); });
        dit(p === '1', `${TT} ${tel ? 'la loupe' : '⌘K / Ctrl+K'} ouvre LA recherche, ses listes lues`, String(p));
      });
      const nLu = lectures.length;
      await essaie('suivi', async () => {
        const vu = await taper(pg, 'xw 300 000 007 fr', '[data-recherche-exacte]');
        await pg.waitForTimeout(250);
        const x = await etat(pg);
        dit(vu && x.tete && x.r[0] && x.r[0].cle === 'vente:22999990107' && x.r[0].groupe === 'exacte' && x.r[0].par === 'suivi', `${TT} suivi tapé « xw 300 000 007 fr » ⇒ SA vente EN TÊTE`, JSON.stringify(x.r.slice(0, 3)));
        dit(x.tete && /Correspondance exacte/i.test(x.tete.txt) && /son n° de suivi/.test(x.tete.txt) && x.tete.par === 'suivi', `${TT} la tête DIT « Correspondance exacte · Trouvé par son n° de suivi »`, JSON.stringify(x.tete));
        dit(x.r.filter((r) => r.cle === 'vente:22999990107').length === 1, `${TT} la vente n’est pas écrite deux fois`, JSON.stringify(x.r));
        const piege = x.r.find((r) => r.cle === 'paire:piege');
        dit(piege && piege.groupe === 'paire' && piege.par === 'titre', `${TT} la paire dont le TITRE porte ce suivi : dans « Paires », « par le titre », pas en tête`, JSON.stringify(piege));
        dit(x.r.every((r) => r.h >= 43.5) && x.sw <= x.cw + 1, `${TT} lignes ≥ 44 px, aucun débordement`, JSON.stringify({ h: x.r.map((r) => r.h), sw: x.sw, cw: x.cw }));
        await pg.screenshot({ path: path.join(SHOTS, `suivi-${suf}.png`) });
      });
      await essaie('code', async () => {
        await taper(pg, '482913', '[data-recherche-exacte]');
        await pg.waitForTimeout(250);
        const x = await etat(pg);
        dit(x.r[0] && x.r[0].cle === 'colis:MR7000123' && x.r[0].par === 'code' && x.r[0].groupe === 'exacte' && /code de retrait/.test(x.tete.txt), `${TT} code de retrait ⇒ CE colis en tête, « par son code de retrait »`, JSON.stringify({ r: x.r.slice(0, 2), t: x.tete }));
        dit(!x.groupes.includes('retrait') && x.r.filter((r) => r.cle === 'colis:MR7000123').length === 1, `${TT} pas répété dans « Retraits »`, JSON.stringify(x.groupes));
        dit(!x.r.some((r) => r.type === 'action' && /482913/.test(r.cle || '')) && !x.groupes.includes('action'), `${TT} un code de retrait ne propose pas « Baisser le prix de N°482913 »`, JSON.stringify(x.groupes));
        await pg.screenshot({ path: path.join(SHOTS, `code-${suf}.png`) });
      });
      await essaie('transaction', async () => {
        await taper(pg, '22999990120', '[data-recherche-exacte]');
        await pg.waitForTimeout(250);
        const x = await etat(pg);
        dit(x.r[0] && x.r[0].cle === 'vente:22999990120' && x.r[0].par === 'transaction' && x.r[0].groupe === 'exacte', `${TT} n° de transaction ⇒ SA vente en tête`, JSON.stringify(x.r.slice(0, 2)));
      });
      await essaie('N°', async () => {
        await taper(pg, '007', '[data-tout-num]');
        await pg.waitForTimeout(300);
        const x = await etat(pg);
        dit(x.tout && x.teteNum && !x.r.some((r) => r.cle === 'paire:n7'), `${TT} « 007 » ⇒ « Tout sur le N°7 », « Correspondance exacte · par son N° », la paire pas deux fois`, JSON.stringify({ tout: x.tout, teteNum: x.teteNum, r: x.r.slice(0, 3) }));
        await pg.screenshot({ path: path.join(SHOTS, `numero-${suf}.png`) });
      });
      await essaie('titre', async () => {
        await taper(pg, 'nike dunk low panda', '[data-recherche-groupe="paire"]');
        await pg.waitForTimeout(300);
        let x = await etat(pg);
        dit(!x.tete && !x.groupes.includes('exacte'), `${TT} 50 paires au même titre : AUCUNE « correspondance exacte »`, JSON.stringify(x.tete));
        const plus = pg.locator('[data-recherche-plus="paire"]');
        if (await plus.count()) { await plus.first().click(); await pg.waitForTimeout(400); }
        x = await etat(pg);
        const p = x.r.filter((r) => r.groupe === 'paire');
        dit(p.length === 50 && new Set(p.map((r) => r.cle)).size === 50 && p.every((r) => r.par === 'titre'), `${TT} 50 lignes « par le titre », aucune désignée`, String(p.length));
        await pg.screenshot({ path: path.join(SHOTS, `titre-${suf}.png`) });
      });
      await essaie('pseudo', async () => {
        await taper(pg, 'acheteuse_fidele', '[data-recherche-groupe="vente"]');
        await pg.waitForTimeout(250);
        const x = await etat(pg);
        dit(!x.tete && x.r.filter((r) => r.groupe === 'vente' && r.par === 'pseudo').length === 2, `${TT} un pseudo (deux ventes) : trouvé, jamais « exact »`, JSON.stringify(x.r));
      });
      await essaie('Colis et Retraits', async () => {
        await taper(pg, 'MR7000', '[data-recherche-groupe="retrait"]');
        await pg.waitForTimeout(250);
        let x = await etat(pg);
        dit(x.r.filter((r) => r.groupe === 'retrait').map((r) => r.cle).sort().join() === 'colis:MR7000123,colis:MR7000124' && x.entetes.some((t) => /^Retraits/i.test(t)), `${TT} colis qui viennent chez lui ⇒ « Retraits »`, JSON.stringify({ r: x.r, e: x.entetes }));
        await pg.screenshot({ path: path.join(SHOTS, `retraits-${suf}.png`) });
        await taper(pg, 'samba', '[data-recherche-groupe="colis"]');
        await pg.waitForTimeout(250);
        x = await etat(pg);
        dit(x.r.some((r) => r.groupe === 'colis' && r.cle === 'colis:MR55512345') && x.groupes.indexOf('vente') < x.groupes.indexOf('colis'), `${TT} colis envoyé ⇒ « Colis », après « Ventes »`, JSON.stringify({ r: x.r, g: x.groupes }));
      });
      // Les lectures PROPRES à la loupe (ses projections) : aucune ne repart à la frappe. (Les autres
      // lectures de l'app — l'écran derrière, ses rafraîchissements — ne sont pas la loupe.)
      const LOUPE = /mo:data->payload->my_orders|pseudo:data->>pseudo|tx:data->>transaction,suivi|code2:data->>code2|_conv_|ids:data->ids|email_invoice_/;
      const pendant = lectures.slice(nLu).filter((u) => /\/rest\/v1\//.test(u) && LOUPE.test(u));
      dit(lectures.slice(0, nLu).filter((u) => LOUPE.test(u)).length >= 4, `${TT} (témoin) les lectures de la loupe sont bien reconnues à son ouverture`, String(lectures.slice(0, nLu).filter((u) => LOUPE.test(u)).length));
      dit(!pendant.length, `${TT} aucune lecture de la base pendant la frappe (tout en mémoire)`, pendant.slice(0, 2).join(' | ').slice(0, 200));
      if (!tel) await essaie('Entrée', async () => {
        await taper(pg, '482913', '[data-recherche-exacte]');
        await pg.waitForTimeout(250);
        await pg.locator('[data-recherche-champ]').first().press('Enter');
        let g = null;
        for (let i = 0; i < 40; i++) { g = await pg.evaluate(() => { const e = document.querySelector('[data-qr-plein]'); return e ? e.getAttribute('data-qr-plein-code') : null; }); if (g) break; await pg.waitForTimeout(250); }
        dit(g === '482913', `${TT} Entrée ouvre la correspondance exacte : CE colis, le code en grand`, String(g));
      });
      dit(errs.length === 0, `${TT} aucune erreur de page`, errs.join(' | ').slice(0, 200));
      await ctx.close();
    }
    // « pas encore lus » : la lecture des colis de la loupe TENUE.
    for (const vp of (process.env.BANC_SEUL === 'ko' ? [] : [{ width: 390, height: 844 }, { width: 1512, height: 950 }])) {
      const tel = vp.width < 600; const TT = `[${vp.width} tenu]`;
      const { ctx, pg, errs, relacher } = await preparer(b, vp, { mode: 'tenu' });
      await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(2500);
      await essaie('tenu', async () => {
        await ouvrirLoupe(pg, tel, { attendre: false });
        await taper(pg, '482913', '[data-recherche-non-lu]');
        await pg.waitForTimeout(250);
        let x = await etat(pg);
        dit(x.nonLu && x.nonLu.encours === '1' && /colis/.test(x.nonLu.cles) && /Pas encore lus : .*colis et retraits/.test(x.nonLu.txt), `${TT} lecture des colis tenue ⇒ « Colis et retraits pas encore lus »`, JSON.stringify(x.nonLu));
        dit(!x.r.some((r) => r.cle === 'colis:MR7000123'), `${TT} … et aucun colis inventé pendant ce temps`, JSON.stringify(x.r));
        await pg.screenshot({ path: path.join(SHOTS, `pas-encore-lus-${vp.width}.png`) });
        relacher();
        for (let i = 0; i < 40; i++) { x = await etat(pg); if (x.r.some((r) => r.cle === 'colis:MR7000123')) break; await pg.waitForTimeout(250); }
        dit(!x.nonLu && x.r[0] && x.r[0].cle === 'colis:MR7000123' && x.r[0].groupe === 'exacte', `${TT} lecture rendue ⇒ la phrase part, le colis arrive en tête`, JSON.stringify({ n: x.nonLu, r: x.r.slice(0, 1) }));
      });
      dit(errs.length === 0, `${TT} aucune erreur de page`, errs.join(' | ').slice(0, 200));
      await ctx.close();
    }
    // Lecture des achats ratée : « Achats pas lus », jamais « aucun achat ».
    for (const [vp, sombre] of [[{ width: 390, height: 844 }, false], [{ width: 1512, height: 950 }, true]]) {
      const tel = vp.width < 600; const TT = `[${vp.width} achats KO]`;
      const { ctx, pg, errs } = await preparer(b, vp, { mode: 'achats-ko', sombre });
      await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(2500);
      await essaie('achats KO', async () => {
        await ouvrirLoupe(pg, tel);
        await taper(pg, 'salomon', '[data-recherche-non-lu]');
        await pg.waitForTimeout(250);
        const x = await etat(pg);
        dit(x.nonLu && x.nonLu.encours === '0' && x.nonLu.cles.split(' ').includes('achats') && /Achats pas lus/.test(x.nonLu.txt) && /pas répondu/.test(x.nonLu.txt), `${TT} lecture des achats ratée ⇒ « Achats pas lus — la lecture n’a pas répondu »`, JSON.stringify(x.nonLu));
        dit(!x.groupes.includes('achat'), `${TT} … et aucun achat inventé`, JSON.stringify(x.groupes));
        await pg.screenshot({ path: path.join(SHOTS, `achats-pas-lus-${vp.width}${sombre ? '-sombre' : ''}.png`) });
        const vu = await pg.evaluate(() => { const p = document.querySelector('[data-recherche-panneau]'); const r = p && p.getBoundingClientRect(); return !!(r && r.width > 100 && r.height > 40); });
        dit(vu, `${TT} la loupe est VISIBLE sur la capture (pas l’écran de chargement)`, String(vu));
      });
      dit(errs.length === 0, `${TT} aucune erreur de page`, errs.join(' | ').slice(0, 200));
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ recherche exacte : ${ko} rouge(s)` : '\n✅ recherche exacte : tout est vert');
  console.log('Captures : ' + SHOTS);
  process.exit(ko ? 1 : 0);
})();
