// Banc : « SNEAKERS » (28 nov. 2026, lot sneakers-cote). Récit : docs/passation/2026-11-28-sneakers-cote.md.
// Données INVENTÉES (dépôt public), aucune clé, aucun appel réel (tout ce qui sort de localhost est coupé).
//   K  la calculette (À L'ACHAT) : référence DD1391-100 + pointure 42,5 ⇒ la cote VRM de SES ventes (médiane 100 €,
//      2 ventes à la pointure, dernière datée) ; achat 60 € ⇒ marge possible +40 € ; « Prendre comme revente » remplit
//      la revente ; une référence sans vente ⇒ « pas encore de vente », rien estimé.
//   V  la feuille Sneakers · Valeur : « N sur M cotées », valeur estimée ; aucune mention de clé StockX à poser.
//   M  la feuille · En masse : cocher 3 annonces, −10 % ⇒ récapitulatif (prête · sans plancher · sous le plancher) ; rien
//      n'est écrit ni envoyé avant « Appliquer » (aucune commande déposée).
//   F  la fiche d'un N° : « Modèle » propose la référence lue dans le titre (une puce) ; SON toucher la pose
//      (`vrm_sneakers`) ; aucune cote sur la fiche.
//   Q  pas de défilement de côté, au plus UN plein dans la feuille, aucune erreur de page.
// Rendus : 390 tactile clair, 390 tactile sombre, 1512 clair, 1512 sombre. `SHOT=prefixe` : les captures (jamais commitées).
//   BANC_PORT=4901 SHOT=/tmp/snk node scripts/bancs/sneakers.cjs
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const AUJ = Date.now(), J = 86400000;
const iso = (ms) => new Date(ms).toISOString();

function base() {
  const NUMEROS = {}, items = [];
  const titres = ['Nike Dunk Low Panda DD1391-100 taille 42,5', 'Nike Dunk Low Panda DD1391-100 taille 44', 'Jordan 1 Mid 554724-092 taille 43', 'Adidas Samba sans référence 42'];
  titres.forEach((t, k) => { const id = 8000 + k; NUMEROS[String(id)] = { numero: String(k + 1), title: t, photo: null, accountId: '111', ...(k === 0 ? { min: '80' } : {}), ...(k === 2 ? { buyPrice: '100' } : {}) };
    items.push({ id, title: t, is_closed: false, is_hidden: false, is_draft: false, price: { amount: k === 2 ? '105.0' : '100.0', currency_code: 'EUR' }, photo: null, view_count: 40 + k, favourite_count: 3 + k, created_at_ts: Math.floor((AUJ - 30 * J) / 1000) }); });
  // Ses ventes PASSÉES (inventées) : deux DD1391-100 en 42,5, une en 44, une Jordan.
  const ventes = [
    { transaction_id: 1, item_id: 7001, title: 'Nike Dunk Low Panda DD1391-100 taille 42,5', price: { amount: '95.0', currency_code: 'EUR' }, date: iso(AUJ - 10 * J), status: 'Commande finalisée' },
    { transaction_id: 2, item_id: 7002, title: 'Dunk Panda DD1391-100 T 42,5', price: { amount: '105.0', currency_code: 'EUR' }, date: iso(AUJ - 40 * J), status: 'Commande finalisée' },
    { transaction_id: 3, item_id: 7003, title: 'DD1391-100 taille 44', price: { amount: '90.0', currency_code: 'EUR' }, date: iso(AUJ - 60 * J), status: 'Commande finalisée' },
    { transaction_id: 4, item_id: 7004, title: 'Jordan 1 Mid 554724-092 taille 43', price: { amount: '110.0', currency_code: 'EUR' }, date: iso(AUJ - 20 * J), status: 'Commande finalisée' },
  ];
  return { main: { vinted_annonce_numeros: NUMEROS, vinted_nums_physiques: { nums: ['1', '2', '3', '4'], at: AUJ }, vrm_je_vends: { choix: 'sneakers' } },
    listings: [{ id: 'harvest_111_listings', data: { capturedAt: iso(AUJ - 3600000), nItems: items.length, payload: { items } } }], ventes };
}

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const serveur = (dist) => http.createServer((q, r) => {
  let f = decodeURIComponent(q.url.split('?')[0]); if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(dist, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
const PORT = Number(process.env.BANC_PORT) || 0;
const ecouter = (srv) => new Promise((ok) => srv.listen(PORT, () => ok(srv.address().port)));

async function rendre(b, port, { tel, sombre, tab = 'achats' }) {
  const B = base();
  const ctx = await b.newContext({ viewport: tel ? { width: 390, height: 844 } : { width: 1512, height: 950 }, ...(tel ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}), colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR', serviceWorkers: 'block' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const ecrits = [];
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') { ecrits.push(u + ' ' + (route.request().postData() || '').slice(0, 200)); return j([]); }
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j([{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', created_at: iso(AUJ), updated_at: iso(AUJ) }]);
    if (/id=eq\.main/.test(u)) return j([{ id: 'main', data: B.main }]);
    if (/orders_sold/.test(u) && /select=mo:/.test(u)) return j([{ mo: B.ventes }]);
    if (/id=like\.harvest_\*_listings/.test(u) || /harvest_111_listings/.test(u)) return j(B.listings.map((l) => ({ id: l.id, updated_at: iso(AUJ), cap: l.data.capturedAt, payload: l.data.payload })));
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.addInitScript(({ m, sombre }) => { try { localStorage.setItem('vrm_acces_direct', '1'); for (const k in m) localStorage.setItem(k, JSON.stringify(m[k])); localStorage.setItem('vinted_dark', JSON.stringify(!!sombre)); localStorage.setItem('vrm_design_v2', '1'); } catch (_) {} }, { m: B.main, sombre });
  await pg.goto(`http://localhost:${port}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(2500);
  return { ctx, pg, errs, ecrits };
}
const shot = async (pg, nom) => { if (process.env.SHOT) await pg.screenshot({ path: `${process.env.SHOT}-${nom}.png`, fullPage: false }).catch(() => {}); };
const toucher = async (pg, tel, sel) => { const el = pg.locator(sel).locator('visible=true').first(); await el.waitFor({ state: 'visible', timeout: 10000 }); await el.scrollIntoViewIfNeeded(); if (tel) await el.tap(); else await el.click(); await pg.waitForTimeout(250); };
const regles = (pg) => pg.evaluate(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); return e.getClientRects().length && r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight; };
  const f = document.querySelector('[data-snk-feuille]') || document;
  const pleins = [...f.querySelectorAll('[data-n-variante="plein"]')].filter(vis).length;
  return { pleins, sw: document.documentElement.scrollWidth, iw: innerWidth };
});
const verifQ = async (pg, t, quoi) => { const g = await regles(pg); dit(g.sw <= g.iw && g.pleins <= 1, `${t} : Q — ${quoi} : pas de défilement de côté, un plein au plus`, JSON.stringify(g)); };

async function scenarioK(b, port, o) {
  const t = o.nom + ' K';
  const r = await rendre(b, port, o); const { pg } = r;
  await pg.evaluate(() => window.dispatchEvent(new Event('vrm:calculette')));
  await pg.waitForSelector('[data-calculette]', { timeout: 15000 }).catch(() => {});
  await pg.fill('#calc-ref', 'dd1391 100'); await pg.fill('#calc-pointure', '42,5'); await pg.fill('#calc-achat', '60');
  await pg.waitForSelector('[data-snk-cote-achat="pointure"]', { timeout: 10000 }).catch(() => {});
  const c = await pg.evaluate(() => { const e = document.querySelector('[data-snk-cote-achat]'); return e ? { niv: e.getAttribute('data-snk-cote-achat'), med: e.getAttribute('data-snk-cote-mediane'), n: e.getAttribute('data-snk-cote-n'), marge: e.getAttribute('data-snk-marge'), txt: e.textContent } : null; });
  dit(c && c.niv === 'pointure' && c.med === '10000' && c.n === '2' && c.marge === '4000', `${t} : la cote VRM de SES ventes (100 €, 2 ventes à la pointure), marge possible +40 €`, JSON.stringify(c && { ...c, txt: undefined }));
  dit(c && /dernière/.test(c.txt) && /StockX : pas sans clé/.test(c.txt) && !/ta clé|ajoute.*clé/i.test(c.txt), `${t} : dernière vente datée ; StockX écarté, aucune clé demandée`, c && c.txt.slice(0, 160));
  await shot(pg, o.nom + '-K-calculette');
  await verifQ(pg, t, 'la calculette');
  await toucher(pg, o.tel, '[data-snk-prendre]');
  const rev = await pg.inputValue('#calc-revente').catch(() => '');
  dit(rev === '100', `${t} : « Prendre comme revente » remplit la revente (la calculette ajoute les frais)`, rev);
  await pg.fill('#calc-ref', 'CW1590-100');
  await pg.waitForSelector('[data-snk-aucune]', { timeout: 6000 }).catch(() => {});
  dit(await pg.locator('[data-snk-aucune]').count() === 1, `${t} : une référence sans vente ⇒ « pas encore de vente », rien n'est estimé`, '');
  dit(!r.errs.length, `${t} : aucune erreur de page`, r.errs.slice(0, 2).join(' | '));
  await r.ctx.close();
}

async function scenarioVM(b, port, o) {
  const t = o.nom + ' VM';
  const r = await rendre(b, port, { ...o, tab: 'annonces' }); const { pg } = r;
  await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:sneakers', { detail: 'valeur' })));
  await pg.waitForSelector('[data-snk-valeur]', { timeout: 20000 }).catch(() => {});
  const v = await pg.evaluate(() => { const e = document.querySelector('[data-snk-valeur]'); const f = document.querySelector('[data-snk-feuille]'); return e ? { val: e.getAttribute('data-snk-valeur'), c: e.getAttribute('data-snk-cotees'), m: e.getAttribute('data-snk-total'), txt: f ? f.textContent : '' } : null; });
  dit(v && v.c === '3' && v.m === '4' && v.val === String(10000 + 9000 + 11000), `${t} : valeur du stock au prix VRM, « 3 sur 4 cotées » (42,5 : 100 €, 44 : 90 € à la pointure ? toutes pointures, Jordan 110 €)`, JSON.stringify(v && { ...v, txt: undefined }));
  dit(v && /estimation/i.test(v.txt) && !/ta clé|colle.*clé/i.test(v.txt), `${t} : dite comme une estimation, aucune clé à poser`, '');
  await shot(pg, o.nom + '-V-valeur');
  await verifQ(pg, t, 'la valeur');
  await toucher(pg, o.tel, '[data-snk-feuille] [role="radio"]:nth-of-type(4)');
  await pg.waitForSelector('[data-snk-masse-liste]', { timeout: 8000 }).catch(() => {});
  const n = await pg.locator('[data-snk-annonce]').count();
  dit(n === 4, `${t} : En masse — les 4 annonces en ligne, une case chacune`, String(n));
  for (const id of ['vinted:8000', 'vinted:8002', 'vinted:8003']) await toucher(pg, o.tel, `[data-snk-annonce="${id}"] .n-case`);
  await pg.fill('[data-snk-masse-valeur]', '10');
  await toucher(pg, o.tel, '[data-snk-revoir]');
  const rec = await pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-snk-recap-ligne]')].map((e) => [e.getAttribute('data-snk-recap-ligne'), [e.getAttribute('data-snk-recap-etat'), e.getAttribute('data-snk-recap-apres')]])));
  dit(rec['vinted:8000'] && rec['vinted:8000'][0] === 'ok' && rec['vinted:8000'][1] === '9000' && rec['vinted:8002'] && rec['vinted:8002'][0] === 'sous-plancher' && rec['vinted:8003'] && rec['vinted:8003'][0] === 'sans-plancher',
    `${t} : récapitulatif — 90 € (mini 80 €) prête · Jordan sous le plancher (achat 100 € + 10 %) · sans plancher`, JSON.stringify(rec));
  await shot(pg, o.nom + '-M-recap');
  await verifQ(pg, t, 'le récapitulatif');
  const cmd = r.ecrits.filter((x) => /cmd_|commande/i.test(x));
  dit(!cmd.length, `${t} : rien n'est déposé avant « Appliquer »`, cmd.slice(0, 2).join(' | '));
  dit(!r.errs.length, `${t} : aucune erreur de page`, r.errs.slice(0, 2).join(' | '));
  await r.ctx.close();
}

async function scenarioF(b, port, o) {
  const t = o.nom + ' F';
  const r = await rendre(b, port, { ...o, tab: 'annonces' }); const { pg } = r;
  await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:fiche-paire', { detail: '1' })));
  await pg.waitForSelector('[data-snk-fiche]', { timeout: 20000 }).catch(() => {});
  await pg.evaluate(() => { const e = document.querySelector('[data-snk-fiche]'); if (e) e.scrollIntoView({ block: 'center' }); }); await pg.waitForTimeout(300);
  const p = await pg.evaluate(() => { const e = document.querySelector('[data-snk-propositions]'); return e ? e.getAttribute('data-snk-propositions') : null; });
  dit(p === 'DD1391-100', `${t} : la fiche PROPOSE la référence lue dans le titre (une puce), rien n'est posé seul`, String(p));
  const avant = await pg.evaluate(() => localStorage.getItem('vrm_sneakers'));
  dit(!avant || !/DD1391/.test(avant), `${t} : rien n'est écrit avant son toucher`, String(avant).slice(0, 80));
  await shot(pg, o.nom + '-F-fiche');
  await toucher(pg, o.tel, '[data-snk-proposee="DD1391-100"]');
  const apres = await pg.evaluate(() => { const e = document.querySelector('[data-snk-fiche]'); return { ref: e && e.getAttribute('data-snk-ref'), ls: localStorage.getItem('vrm_sneakers') }; });
  dit(apres.ref === 'DD1391-100' && /"1":\{"ref":"DD1391-100"/.test(apres.ls || ''), `${t} : SON toucher pose la référence sous le N° 1 (vrm_sneakers.fiches)`, JSON.stringify(apres).slice(0, 160));
  dit(await pg.locator('[data-fiche-paire] [data-snk-cote-achat], [data-fiche-paire] [data-snk-valeur]').count() === 0, `${t} : aucune cote sur la fiche (§3)`, '');
  await shot(pg, o.nom + '-F-pose');
  dit(!r.errs.length, `${t} : aucune erreur de page`, r.errs.slice(0, 2).join(' | '));
  await r.ctx.close();
}

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.log('KO  dist absent : npm run build'); process.exit(1); }
  const srv = serveur(DIST); const port = await ecouter(srv);
  const b = await chromium.launch({ executablePath: CHROMIUM, args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const RENDUS = [{ nom: '390-clair', tel: true, sombre: false }, { nom: '390-sombre', tel: true, sombre: true }, { nom: '1512-clair', tel: false, sombre: false }, { nom: '1512-sombre', tel: false, sombre: true }];
  const seul = process.env.RENDU;
  for (const o of RENDUS.filter((x) => !seul || x.nom === seul)) {
    for (const s of [scenarioK, scenarioVM, scenarioF]) { try { await s(b, port, o); } catch (e) { dit(false, `${o.nom} ${s.name} : planté`, e.message.split('\n')[0]); } }
  }
  await b.close(); srv.close();
  console.log(ko ? `ROUGE : ${ko}` : 'VERT'); process.exit(ko ? 1 : 0);
})();
