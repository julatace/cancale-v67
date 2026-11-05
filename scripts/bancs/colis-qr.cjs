// Banc : COLIS → « À RETIRER » — LE CODE ET LE QR RELIÉS, LES COMPTES MONDIAL RELAY (5 nov.).
// Julien (5 nov.) : « relier le code de retrait et le QR code » ; « l'extension capte tous les colis
// arrivés avec leurs QR quand il se connecte à son compte Mondial Relay » ; « plusieurs comptes Mondial
// Relay, et des colis arrivés par e-mail qui ne sont dans aucun compte ». Données INVENTÉES (dépôt public) :
//  · 81000001 : e-mail Mondial Relay (code, pas de QR) ET lu dans le compte « compte-mr-1 » (même code, QR) ;
//  · 81000002 : e-mail Mondial Relay seul, reçu sur une autre adresse ⇒ « QR pas reçu », « dans aucun compte » ;
//  · 81000003 : lu dans « compte-mr-1 » seulement (aucun e-mail) ; 81000004 : lu dans « compte-mr-2 » seulement ;
//  · 81000005 : e-mail Mondial Relay d'un ACHAT LEBONCOIN (relié par le n° d'expédition de son lien de suivi) ;
//  · Chronopost avec code sans QR ⇒ « QR pas reçu » (Chronopost) ; Vinted Go code + QR hébergé.
//  · une vente Leboncoin à envoyer avec son QR de dépôt.
// Exige (data-* et nombres, §6.4) : 7 colis, chacun une fois (= vrm_colis_retirer) ; le QR du compte sur
// 81000001 et 81000003, l'accord « confirmé », le compte nommé ; « QR pas reçu » + où le trouver sur
// 81000002 et le Chronopost ; « dans aucun de tes comptes » ; deux comptes Mondial Relay avec leur
// fraîcheur (« relu il y a 3 min », « il y a 2 h ») ; l'explication animée ; « En grand » : code ET QR,
// luminosité dite ; sans QR, « QR pas reçu » dans la vue ; le QR de dépôt Leboncoin dans « À envoyer ».
// 390 tactile et 1512, clair et sombre. `SHOTS=dossier` garde les captures.
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 7961);
const SHOTS = process.env.SHOTS || '';
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const maintenant = new Date(2026, 10, 5, 11, 0, 0);
const MS = maintenant.getTime(), J = 864e5;
const iso = (t) => new Date(t).toISOString();
const ilYa = (j) => iso(MS - j * J);
const jourDans = (j) => { const d = new Date(MS + j * J); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(MS) }];
const cap = iso(MS);
// Un QR INVENTÉ (un carré noir et blanc en SVG : il ne contient rien).
const QR = { type: 'image/svg+xml', b64: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><rect width="4" height="4" fill="#fff"/><rect width="2" height="2" fill="#000"/><rect x="2" y="2" width="2" height="2" fill="#000"/></svg>').toString('base64') };
const track = (carrier, suivi, lieu, code, extra = {}) => ({ id: `email_track_${carrier}_${suivi}`, data: Object.assign({ type: 'suivi', carrier, suivi, status: 'available', statusLabel: 'Arrivé au point de retrait', subject: `Votre colis ${suivi} est disponible`, receivedAt: ilYa(0.3), emailAt: ilYa(0.3), arriveLe: ilYa(0.3), code, lieu, limite: jourDans(5), consigne: false, account: '' }, extra) });
const LIEU = 'MAISON DU QUAI, 40 RUE DU QUAI, 35260 CANCALE';
const TRACKS = [
  track('mondialrelay', '81000001', LIEU, '100001', { recuSur: ['boite-a@exemple.fr'] }),
  track('mondialrelay', '81000002', LIEU, '100002', { recuSur: ['boite-b@exemple.fr'] }),
  track('mondialrelay', '81000005', LIEU, '100005', { recuSur: ['boite-a@exemple.fr'] }),
  track('chronopost', 'XW100000001JB', 'RELAIS PICKUP DU PORT, 2 QUAI GAMBETTA, 35260 CANCALE', '700001'),
  track('vinted', 'VGS0000000000201', 'Consigne Vinted Go, Thé Bleu, 13 Rue Saint-Vincent, 56000 Vannes', 'A10201', { consigne: true, qrUrl: 'https://p.vintedgo.com/public/v1/qr_codes/exemple201' }),
];
const MR = [
  { id: 'mr_colis_a1', data: { v: 1, compte: { libelle: 'compte-mr-1' }, luAt: iso(MS - 3 * 60e3), complet: true, colis: [
    { suivi: '81000001', etat: 'disponible', code: '100001', qr: QR, lieu: LIEU, limite: jourDans(5), sens: 'entrant' },
    { suivi: '81000003', etat: 'disponible', code: '100003', qr: QR, lieu: LIEU, limite: jourDans(6), sens: 'entrant' },
    { suivi: '81000099', etat: 'disponible', code: '100099', qr: QR, lieu: LIEU, sens: 'sortant' },
  ] } },
  { id: 'mr_colis_b2', data: { v: 1, compte: { libelle: 'compte-mr-2' }, luAt: iso(MS - 2 * 3600e3), complet: true, colis: [
    { suivi: '81000004', etat: 'disponible', code: '100004', qr: QR, lieu: 'TABAC DE LA HOULE, 3 RUE HAUTE, 35260 CANCALE', limite: jourDans(3), sens: 'entrant' },
  ] } },
];
const LBC = { id: 'lbc_ventes', data: { ventes: {
  9001: { txId: 9001, isSeller: true, title: 'Exemple vendu sur Leboncoin', stepStatus: 'paid', stepLabel: 'Vente confirmée', at: ilYa(1), label: { voucherUrl: 'https://exemple.invalid/bordereau.pdf', qrUrl: 'https://api.leboncoin.fr/api/shippingproxy/exemple/qr' } },
  9002: { txId: 9002, isSeller: false, title: 'Exemple acheté sur Leboncoin', stepStatus: 'validation', at: ilYa(3), label: { trackingUrl: 'https://www.mondialrelay.com/public/permanent/tracking.aspx?ens=MRLBCOIN&exp=81000005&language=FR&CodePostal=35260' } },
} } };
const TOTAL = 7;
const lignes = (sombre) => [
  { id: 'main', data: { vinted_dark: sombre, vrm_ville: '' } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: cap, payload: { my_orders: [] } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: cap, payload: { my_orders: [] } } },
  { id: 'panel_colis_relais', data: {} },
  LBC, ...TRACKS, ...MR,
];
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.mjs': 'text/javascript' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = cap; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? String(v) : v);
  }
  return out;
};
const ouvrir = async (b, vp, sombre) => {
  const ctx = await b.newContext({ viewport: vp, colorScheme: sombre ? 'dark' : 'light', ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const LIGNES = lignes(sombre);
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', JSON.stringify(true)); localStorage.setItem('vinted_dark', JSON.stringify(s)); } catch (_) {} }, sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    if (/api-adresse\.data\.gouv\.fr/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"type":"FeatureCollection","features":[]}' });
    return ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue();
  });
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    if (route.request().method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: cap, cap: r.data.capturedAt });
    const inn = /[?&]id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(',').map((x) => x.replace(/^"|"$/g, '')); return j(LIGNES.filter((r) => ids.includes(r.id)).map(forme)); }
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map(forme));
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs };
};
const carte = (pg, suivi) => pg.evaluate((k) => {
  const c = document.querySelector(`[data-cc-carte="r:e:${k}"]`); if (!c) return null;
  const a = (sel, at) => { const e = c.querySelector(sel); return e ? (at ? e.getAttribute(at) : e.textContent.trim()) : null; };
  return { site: c.getAttribute('data-site'), qrSource: a('[data-colis-qr]', 'data-colis-qr-source'), qrAbsent: a('[data-colis-qr-absent]', 'data-colis-qr-absent'), qrAbsentTxt: a('[data-colis-qr-absent]'),
    accord: a('[data-colis-code-accord]', 'data-colis-code-accord'), compteMr: a('[data-colis-compte-mr]', 'data-colis-compte-mr'), horsComptes: a('[data-colis-hors-comptes-mr]', 'data-colis-hors-comptes-mr'),
    achatSite: a('[data-colis-achat-site]', 'data-colis-achat-site'), plein: !!c.querySelector('[data-colis-plein-ecran]'), code: a('[data-code-retrait]', 'data-code-retrait') };
}, suivi);

(async () => {
  const b = await chromium.launch({ executablePath: CHROMIUM, args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch(() => chromium.launch());
  try {
    for (const [vp, nom] of [[{ width: 390, height: 844 }, '390'], [{ width: 1512, height: 982 }, '1512']]) for (const sombre of [false, true]) {
      const tag = `${nom}-${sombre ? 'sombre' : 'clair'}`;
      console.log(`\n— Colis → À retirer · code et QR · ${tag}`);
      const { ctx, pg, errs } = await ouvrir(b, vp, sombre);
      try {
        await pg.locator('[data-colis-onglet-choix="retirer"]').first().waitFor({ timeout: 30000 });
        await pg.waitForFunction(() => { try { return !!JSON.parse(localStorage.getItem('vrm_colis_retirer') || 'null'); } catch (_) { return false; } }, null, { timeout: 20000 }).catch(() => {});
        // « À envoyer » d'abord : le QR de dépôt Leboncoin.
        await pg.locator('[data-colis-onglet-choix="envoyer"]').first().click();
        await pg.waitForTimeout(500);
        const lbc = await pg.evaluate(() => { const c = document.querySelector('[data-lbc-colis="9001"]'); return c ? { qr: !!c.querySelector('[data-lbc-qr-depot]') } : null; });
        dit(lbc && lbc.qr, '« À envoyer » : la vente Leboncoin porte son QR de dépôt', JSON.stringify(lbc));
        if (SHOTS && lbc) { fs.mkdirSync(SHOTS, { recursive: true }); await pg.locator('[data-lbc-colis="9001"]').first().scrollIntoViewIfNeeded().catch(() => {}); await pg.screenshot({ path: path.join(SHOTS, `qr-lbc-${tag}.png`) }); }
        await pg.locator('[data-colis-onglet-choix="retirer"]').first().click();
        await pg.waitForFunction((n) => document.querySelectorAll('.vrm-colis-retirer [data-cc-carte]').length >= n, TOTAL, { timeout: 10000 }).catch(() => {});
        await pg.waitForTimeout(400);
        const base = await pg.evaluate(() => ({
          cles: [...document.querySelectorAll('.vrm-colis-retirer [data-cc-carte]:not([data-hors-compte])')].map((c) => c.getAttribute('data-cc-carte')),
          pub: (() => { try { return JSON.parse(localStorage.getItem('vrm_colis_retirer') || 'null'); } catch (_) { return null; } })(),
          comptes: [...document.querySelectorAll('[data-mr-comptes] [data-mr-compte]')].map((l) => ({ cle: l.getAttribute('data-mr-compte'), n: l.getAttribute('data-mr-compte-n'), txt: l.textContent })),
          explique: !!document.querySelector('[data-mr-explique] [data-explique-mr]'),
          pasEncore: !!document.querySelector('[data-mr-pas-encore]'),
        }));
        const pub = base.pub && Number.isFinite(base.pub.total) ? base.pub.total : null;
        dit(base.cles.length === TOTAL && new Set(base.cles).size === TOTAL && pub === TOTAL, `les ${TOTAL} colis, chacun une fois (e-mails + comptes Mondial Relay, = vrm_colis_retirer)`, `${base.cles.join(',')} · pub ${pub}`);
        dit(base.cles.includes('r:e:81000003') && base.cles.includes('r:e:81000004') && !base.cles.includes('r:e:81000099'), 'les colis lus dans les comptes sans e-mail sont là ; un colis ENVOYÉ (sortant) n’entre pas');
        dit(base.comptes.length === 2 && /relu il y a 3 min/.test((base.comptes.find((c) => c.cle === 'a1') || {}).txt || '') && /relu il y a 2 h/.test((base.comptes.find((c) => c.cle === 'b2') || {}).txt || ''), 'deux comptes Mondial Relay, chacun sa fraîcheur (« relu il y a 3 min », « il y a 2 h »)', JSON.stringify(base.comptes));
        dit(base.explique && !base.pasEncore, 'l’explication animée est là ; « pas encore » ne se dit pas quand des comptes sont relus');
        // Ouvre chaque ligne (le détail porte le code, le QR et les gestes).
        for (const k of base.cles) { const o = pg.locator(`[data-cc-carte="${k}"] .vrm-rpf-ouvrir`).first(); if (await o.count()) { const e = await o.getAttribute('aria-expanded'); if (e !== 'true') await o.click(); } }
        await pg.waitForTimeout(300);
        const c1 = await carte(pg, '81000001'), c2 = await carte(pg, '81000002'), c3 = await carte(pg, '81000003'), c4 = await carte(pg, '81000004'), c5 = await carte(pg, '81000005'), ch = await carte(pg, 'XW100000001JB');
        dit(c1 && c1.qrSource === 'mondialrelay' && c1.accord === 'confirme' && c1.compteMr === 'compte-mr-1' && c1.code === '100001', '81000001 : code de l’e-mail ET QR du compte, « confirmé », compte nommé', JSON.stringify(c1));
        dit(c2 && c2.qrAbsent === 'mondialrelay' && /QR pas reçu/.test(c2.qrAbsentTxt || '') && /compte Mondial Relay/.test(c2.qrAbsentTxt || '') && c2.horsComptes === '1' && c2.plein, '81000002 : « QR pas reçu » + où le trouver, « dans aucun de tes comptes », le code en grand', JSON.stringify(c2));
        dit(c3 && c3.qrSource === 'mondialrelay' && c3.compteMr === 'compte-mr-1' && c3.code === '100003', '81000003 (compte seul) : son code et son QR', JSON.stringify(c3));
        dit(c4 && c4.compteMr === 'compte-mr-2', '81000004 : le second compte Mondial Relay nommé', JSON.stringify(c4));
        dit(c5 && c5.site === 'leboncoin' && c5.achatSite === 'leboncoin', '81000005 : l’achat Leboncoin, relié par le n° de suivi', JSON.stringify(c5));
        dit(ch && ch.qrAbsent === 'chronopost' && /Chronopost/.test(ch.qrAbsentTxt || ''), 'Chronopost sans QR : « QR pas reçu » + l’e-mail Pickup Pass', JSON.stringify(ch));
        if (SHOTS) { await pg.locator('[data-cc-carte="r:e:81000001"]').first().scrollIntoViewIfNeeded().catch(() => {}); await pg.screenshot({ path: path.join(SHOTS, `qr-cartes-${tag}.png`) }); }
        // L'explication, ouverte.
        await pg.locator('[data-mr-explique] > summary').first().click().catch(() => {});
        await pg.waitForTimeout(400);
        if (SHOTS) { await pg.locator('[data-mr-bloc]').first().scrollIntoViewIfNeeded().catch(() => {}); await pg.screenshot({ path: path.join(SHOTS, `qr-explique-${tag}.png`) }); }
        const debExp = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        // « En grand » : code ET QR.
        await pg.locator('[data-cc-carte="r:e:81000001"] [data-colis-plein-ecran]').first().click();
        await pg.waitForSelector('[data-qr-plein]', { timeout: 5000 }).catch(() => {});
        const v1 = await pg.evaluate(() => { const v = document.querySelector('[data-qr-plein]'); return v ? { code: v.getAttribute('data-qr-plein-code'), img: v.getAttribute('data-qr-plein-img'), src: v.getAttribute('data-qr-plein-source'), lum: !!v.querySelector('[data-qr-plein-luminosite]'), accord: (v.querySelector('[data-qr-plein-accord]') || { getAttribute: () => null }).getAttribute('data-qr-plein-accord'), imgOk: !!v.querySelector('img[alt="QR de retrait"]') } : null; });
        dit(v1 && v1.code === '100001' && v1.img === '1' && v1.imgOk && v1.src === 'mondialrelay' && v1.lum && v1.accord === 'confirme', '« En grand » (Mondial Relay) : le code ET le QR, la luminosité dite', JSON.stringify(v1));
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `qr-plein-${tag}.png`) });
        await pg.locator('[data-qr-plein] button', { hasText: 'Fermer' }).first().click();
        await pg.waitForTimeout(200);
        await pg.locator('[data-cc-carte="r:e:81000002"] [data-colis-plein-ecran]').first().click();
        await pg.waitForSelector('[data-qr-plein]', { timeout: 5000 }).catch(() => {});
        const v2 = await pg.evaluate(() => { const v = document.querySelector('[data-qr-plein]'); return v ? { code: v.getAttribute('data-qr-plein-code'), img: v.getAttribute('data-qr-plein-img'), absent: !!v.querySelector('[data-qr-plein-absent]') } : null; });
        dit(v2 && v2.code === '100002' && v2.img === '0' && v2.absent, '« En grand » sans QR : le code en grand, « QR pas reçu » et où le trouver', JSON.stringify(v2));
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `qr-plein-sans-${tag}.png`) });
        await pg.locator('[data-qr-plein] button', { hasText: 'Fermer' }).first().click();
        const deb = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        dit(deb <= 1 && debExp <= 1, 'rien ne déborde', `${deb} / ${debExp}`);
        dit(!errs.length, 'aucune erreur de page', errs.join(' | ').slice(0, 300));
      } catch (e) { dit(false, 'le banc a pu s’exécuter', String(e.message || e).slice(0, 200)); }
      await ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
