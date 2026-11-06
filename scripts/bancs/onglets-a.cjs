// ═══════════════════════════════════════════════════════════════════════════
//  BANC : MA JOURNÉE, VENTES, ACHATS — 390 tactile et 1512, clair et sombre (6 nov., onglets A)
//  npm run build && BANC_PORT=10503 CAPTURES=/tmp/oa node scripts/bancs/onglets-a.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Une base INVENTÉE au volume et à la forme de la sienne (`_base-volume.cjs` : 3 comptes,
// ventes avec transactions, achats, bordereaux, conversations), plus un achat « Transaction
// suspendue » et une vente Vestiaire au montant sûr. Pour chaque écran et chaque vue :
//   · aucune erreur de page ni de console, aucun écran garde-fou ;
//   · aucun « undefined », « NaN », « null », « [object Object] » affiché ;
// et, une fois par écran (1512 clair) :
//   · Ventes : le « ? » de la carte ouvre « D'où viennent ces chiffres », une ligne par
//     chiffre de la carte, chacune avec sa phrase ; la vente Vestiaire porte son montant ;
//   · Achats : les onglets d'étape ne redisent pas les nombres de la carte ; l'achat
//     suspendu n'est pas compté « en route » ;
//   · Ma journée : « Colis envoyés » de la semaine passée n'est pas « 0 » quand des ventes
//     n'ont aucun geste « Colis fait » (ici : aucun geste du tout).
// Les captures sont à REGARDER (§6.2).
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { fabriquer, repondre } = require('./_base-volume.cjs');
const DIST = process.env.DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 10503;
const CAPT = process.env.CAPTURES || '';
const VUES = (process.env.VUES || '1512-clair,1512-sombre,390-clair,390-sombre').split(',');
const ECRANS = (process.env.ECRANS || 'journee,ventes,achats').split(',');

const base = fabriquer({ comptes: 3 });
const uid0 = base.accounts[0].vinted_user_id;
{ // un achat « Transaction suspendue » (mesuré chez lui : livré, compté « en route »)
  const r = base.rows.find((x) => x.id === `harvest_${uid0}_orders_purchased`);
  r.data.payload.my_orders.unshift({ transaction_id: 99000000001, conversation_id: 99000000002, title: 'Achat suspendu banc', price: { amount: '14.39', currency_code: 'EUR' },
    status: 'Transaction suspendue - en attente de vérification.', transaction_user_status: 'waiting', date: new Date(Date.now() - 3 * 864e5).toISOString() });
}
base.rows.push({ id: 'vc_ventes', data: { capturedAt: new Date().toISOString(), ventes: { 72000001: { ref: '', date: new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 19).replace('T', ' '), etat: 'ACTION_NEEDED', titre: 'Sac banc Vestiaire', compte: '',
  montant: { cle: 'sellerEarning', devise: 'EUR', valeur: 203.23 }, sources: ['ventes'], statutVc: 'shipmentInProgress', aExpedier: true } } } });

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ port ' + PORT + ' pris (' + e.code + ') — BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);
const VP = { '390': { width: 390, height: 844 }, '1512': { width: 1512, height: 982 } };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  for (const vue of VUES) for (const ecran of ECRANS) {
    const [l, theme] = vue.split('-'); const sombre = theme === 'sombre';
    const tel = l === '390';
    const ctx = await b.newContext({ viewport: VP[l], colorScheme: sombre ? 'dark' : 'light', ...(tel ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
    const pg = await ctx.newPage();
    const errs = [];
    pg.on('pageerror', (e) => errs.push('page: ' + e.message));
    pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|status of 4\d\d/.test(m.text())) errs.push('console: ' + m.text().slice(0, 160)); });
    await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', 'true'); localStorage.setItem('vinted_dark', JSON.stringify(s)); } catch (_) {} }, sombre);
    await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
      const u = r.request().url();
      if (/\/rest\/v1\/|\/auth\/v1\//.test(u)) return r.fallback();
      if (r.request().resourceType() === 'image') return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#dfe3e8"/></svg>' });
      return ['media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' });
    });
    await pg.route('**/rest/v1/**', (route) => {
      const req = route.request();
      if (req.method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
      const r = repondre(req.url(), req.headers()['range'], base);
      return route.fulfill({ status: r.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', ...(r.headers || {}) }, body: JSON.stringify(r.body) });
    });
    await pg.route(/localhost:\d+\/api\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
    const tab = ecran === 'achats' ? 'cat_achats&vue=achats' : ecran;
    await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
    const pret = { journee: '[data-journal-case="colis"][data-valeur], [data-journal-case="colis"] .vrm-js-sous', ventes: '[data-carte-stats="ventes-toutes"] [data-carte-chiffre="vendu"][data-carte-valeur]:not([data-carte-valeur=""])', achats: '[data-achat-tx]' }[ecran];
    await pg.waitForSelector(pret, { timeout: 60000 }).catch(() => {});
    await pg.waitForTimeout(2500);
    const etat = await pg.evaluate(() => {
      const t = document.body.innerText;
      return { mots: t.match(/\b(undefined|NaN|null)\b|\[object Object\]/g) || [], garde: /pas pu s.afficher|Quelque chose s.est mal passé|Recharger l.app/i.test(t) };
    });
    dit(!etat.garde && !etat.mots.length, `${vue} ${ecran} : aucun garde-fou, aucun « undefined/NaN/null » affiché`, JSON.stringify(etat));
    if (CAPT) { fs.mkdirSync(CAPT, { recursive: true }); await pg.screenshot({ path: path.join(CAPT, `onglets-a-${ecran}-${vue}.png`), fullPage: !tel }); }
    if (vue === '1512-clair' && ecran === 'ventes') {
      await pg.click('[data-carte-stats="ventes-toutes"] [data-carte-aide]').catch(() => {});
      const f = await pg.waitForSelector('[data-carte-aide-feuille]', { timeout: 5000 }).then(() => true).catch(() => false);
      const lignes = f ? await pg.$$eval('[data-carte-aide-feuille] [data-carte-aide-chiffre]', (els) => els.map((e) => ({ id: e.getAttribute('data-carte-aide-chiffre'), phrase: (e.querySelector('dd') || {}).textContent || '' }))) : [];
      dit(f && lignes.length >= 3 && lignes.every((x) => x.phrase.length > 20), 'Ventes : « ? » ouvre « D’où viennent ces chiffres », une phrase par chiffre de la carte', JSON.stringify(lignes.map((x) => x.id)));
      if (CAPT && f) await pg.screenshot({ path: path.join(CAPT, 'onglets-a-ventes-aide-1512-clair.png') });
      await pg.keyboard.press('Escape').catch(() => {});
      const vc = await pg.evaluate(() => { const l = [...document.querySelectorAll('*')].find((e) => e.children.length < 40 && /Sac banc Vestiaire/.test(e.textContent || '') && /203,23/.test(e.textContent || '')); return !!l; });
      dit(vc, 'Ventes · Tous : la vente Vestiaire porte le montant que « vendu » compte (203,23 €)');
    }
    if (vue === '1512-clair' && ecran === 'achats') {
      const seg = await pg.evaluate(() => [...document.querySelectorAll('[data-achats-onglet]')].map((b) => ({ id: b.getAttribute('data-achats-onglet'), n: b.getAttribute('data-n'), vu: !!b.querySelector('.vrm-seg-n') })));
      const carte = await pg.evaluate(() => { const e = document.querySelector('[data-carte-stats="achats"] [data-carte-chiffre="enroute"]'); return e ? e.getAttribute('data-carte-valeur') : null; });
      const route = seg.find((x) => x.id === 'route');
      dit(!!route && carte != null && !route.vu, 'Achats : « En route » n’est pas redit dans l’onglet (la carte le dit)', JSON.stringify({ seg, carte }));
      const attendu = String(base.rows.filter((r) => /_orders_purchased$/.test(r.id) && base.accounts.some((a) => r.id === `harvest_${a.vinted_user_id}_orders_purchased`))
        .flatMap((r) => r.data.payload.my_orders).filter((o) => !/annul|rembours|refus|retour|suspend|finalis|livr|point relais|déposé/i.test(o.status)).length);
      dit(carte === attendu, 'Achats : « En route » = recalcul indépendant (l’achat suspendu n’y est pas)', `${carte} / ${attendu}`);
    }
    if (vue === '1512-clair' && ecran === 'journee') {
      const c = await pg.evaluate(() => { const e = document.querySelector('[data-journal-case="colis"]'); return e ? { v: e.getAttribute('data-valeur'), sous: (e.querySelector('.vrm-js-sous') || {}).textContent || '' } : null; });
      dit(!!c && c.v !== '0', 'Ma journée : « Colis envoyés » ne dit pas 0 quand des ventes n’ont aucun geste', JSON.stringify(c));
    }
    dit(errs.length === 0, `${vue} ${ecran} : aucune erreur de page ni de console`, errs.slice(0, 3).join(' | '));
    await ctx.close();
  }
  await b.close(); srv.close();
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ banc', e.message); srv.close(); process.exit(1); });
