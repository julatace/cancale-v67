// ═══════════════════════════════════════════════════════════════════════════
// BANC : COMPTABILITÉ — SEUILS DE L'ANNÉE, DAC7 PAR PLATEFORME, PRÉVISION URSSAF
//        (3 novembre) — npm run build && node scripts/bancs/seuils-prevision.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Données INVENTÉES (dépôt public). La ligne publiée `vinted_urssaf_mois` est
// servie dans `main` (la forme réelle : mois, par, aDater, sources, at) ; les
// ventes Vinted ne se lisent pas (522) : l'écran Ventes ne republie donc rien
// et la ligne servie fait foi. Horloge : 3 novembre 2026, 10 h (Paris).
//   A. complet : CA 2026 80 500 € ⇒ seuil de TVA « vers novembre » (8 000 €/mois
//      sur 10 mois finis), aucun « vers » pour le plafond ; DAC7 : Vinted et
//      Leboncoin atteints, eBay « encore 27 ventes », Vestiaire « sous » ;
//      prochaine échéance (mensuel) : octobre 8 000 € ⇒ 992,00 € (12,4 %).
//   B. 2 ventes Vinted à dater : prévision « au moins » + « 2 à dater », plus
//      aucune projection de mois ; Vestiaire pas lu ⇒ DAC7 « — ».
//   C. rythme jamais choisi : « — » + le choix ; « Par mois » est rangé au nuage.
//   D. octobre déjà déclaré : la prévision passe à novembre (au moins 500 €).
require('./_porte-banc.cjs');
const { chromium } = require('playwright');
const { metaVersData } = require('./_meta.cjs');
const { ouvrirDetailCompta } = require('./_compta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 6371;
const CAPT = process.env.BANC_CAPTURE || '';
const MAINTENANT = '2026-11-03T10:00:00+01:00';
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'atelier_test', domain: 'www.vinted.fr', updated_at: '2026-11-03T08:00:00Z' }];
const mois = [];
for (let m = 1; m <= 10; m++) mois.push({ ym: `2026-${String(m).padStart(2, '0')}`, ca: 8000, n: m === 1 ? 8 : 5,
  par: m === 1 ? { Vinted: { n: 4, ca: 6000 }, Leboncoin: { n: 1, ca: 1950 }, eBay: { n: 3, ca: 50 } } : { Vinted: { n: 4, ca: 6000 }, Leboncoin: { n: 1, ca: 2000 } } });
mois.push({ ym: '2026-11', ca: 500, n: 1, par: { Vinted: { n: 1, ca: 500 } } });
const LIGNE = (extra = {}) => ({ at: Date.parse('2026-11-03T08:00:00Z'), mois: mois.slice().reverse(), aDater: { n: 0, ca: 0, par: {} }, ecartees: 0,
  sources: { Vinted: 'lu', Leboncoin: 'lu', eBay: 'lu', Vestiaire: 'lu' }, declare: 'lu', nonComptees: { n: 0, par: {} }, ...extra });
const ROWS = [{ id: 'lbc_ventes', data: { ventes: {} } }, { id: 'ebay_orders', data: { orders: [] } }];
const mainDe = (extra = {}, ligne = LIGNE()) => ({ vinted_regime: 'micro', vinted_urssaf_taux: 12.4, vinted_urssaf_freq: 'mensuel', vinted_urssaf_mois: ligne, vrm_urssaf_declare: {}, ...extra });
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d && !c ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 160)); } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.onnx': 'application/octet-stream' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul (BANC_PORT)'); process.exit(1); });
srv.listen(PORT);
// §6.3 : la projection `select=` s'applique pour de vrai.
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    if (/->>/.test(src) && v != null && typeof v !== 'object') v = String(v);
    out[alias] = v == null ? null : v;
  }
  return out;
};

// `opts.main` est GARDÉE quand l'app l'écrit (un banc qui jette les écritures
// mesure une fiction, §6.3). `opts.txnKO` : les dates de versement ne se lisent
// pas (la vraie forme : 522 + HTML). `opts.releveKO` : le relevé non plus.
// `opts.pont` : `undefined` = pas d'extension ; sinon la version annoncée.
async function rendre(b, vp, opts) {
  const ctx = await b.newContext({ viewport: vp, timezoneId: 'Europe/Paris', colorScheme: opts.sombre ? 'dark' : 'light', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.setFixedTime(new Date(MAINTENANT));
  await pg.addInitScript((v) => {
    try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {}
    try { if (window.__sombre) localStorage.setItem('vinted_dark', 'true'); } catch (_) {}
    if (v == null) return;
    window.addEventListener('message', (e) => { if (e.source !== window || !e.data || e.data.__vmr !== 'ping') return; window.postMessage({ __vmr: 'ready', version: v }, '*'); });
  }, opts.pont == null ? null : opts.pont);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    const panne = () => route.fulfill({ status: 522, contentType: 'text/html', headers: { 'access-control-allow-origin': '*' }, body: '<html>522</html>' });
    if (route.request().method() !== 'GET') {
      try { const corps = JSON.parse(route.request().postData() || 'null'); for (const x of [].concat(corps || [])) if (x && x.id === 'main' && x.data && typeof x.data === 'object') opts.main = x.data; } catch (_) {}
      // (1er nov.) `main` s'écrit par PATCH conditionnel (sur `data.rev`) : on le garde et on rend la ligne.
      if (route.request().method() === 'PATCH' && /id=eq\.main/.test(u)) { try { const c = JSON.parse(route.request().postData() || 'null'); if (c && c.data && typeof c.data === 'object') opts.main = c.data; } catch (_) {} return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify([{ id: 'main', data: opts.main }]) }); }
      return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    }
    // Base CLOISONNÉE (la production l'est) : sinon l'app n'envoie rien au nuage
    // (`cloudPush` exige CLOISONNE) et l'écriture de la déclaration ne se voit pas.
    if (/select=owner&limit=1/.test(u)) return j([{ owner: 'x' }]);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    if (/orders_sold|_orders_/.test(u)) return panne();
    if (opts.releveKO && /_releve_/.test(u)) return panne();
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: '2026-10-27T08:00:00Z', cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq && eq[1] === 'main') return j([forme({ id: 'main', data: opts.main || {} })]);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs };
}
const aller = async (pg, tab, repere, ms = 1500) => {
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  if (repere) await pg.waitForFunction((r) => document.querySelector(r) || /pas pu s'afficher/.test(document.body.innerText), repere, { timeout: 25000 }).catch(() => {});
  await pg.waitForTimeout(ms);
  // (2 nov., Comptabilité claire) Le suivi vit dans « Le détail », replié : on l'ouvre comme
  // Julien, d'un toucher sur son titre (sans effet sur un code d'avant).
  if (tab === 'compta') await ouvrirDetailCompta(pg, { attendre: 3000 }).catch(() => {});
};
const touche = async (pg, sel, vp) => { const l = pg.locator(sel + ':visible').first(); await l.scrollIntoViewIfNeeded(); if (vp.width < 600) await l.tap(); else await l.click(); };

const lire = (pg) => pg.evaluate(() => {
  const q = (s) => document.querySelector(s), at = (e, a) => (e ? e.getAttribute(a) : null);
  const p = q('[data-prevision-carte]');
  return {
    n: { echeance: document.querySelectorAll('[data-compta-echeance]').length, seuils: document.querySelectorAll('[data-micro-seuils]').length },
    atteinte: [...document.querySelectorAll('[data-micro-atteinte]')].map((e) => `${e.getAttribute('data-micro-atteinte')}:${e.getAttribute('data-mois')}`).join(','),
    dac7: Object.fromEntries([...document.querySelectorAll('[data-dac7-plateforme]')].map((e) => [e.getAttribute('data-dac7-plateforme'), { etat: at(e, 'data-etat'), n: at(e, 'data-n'), cts: at(e, 'data-cts'), v: at(e, 'data-verdict'), t: e.innerText.replace(/\s+/g, ' ') }])),
    prev: p ? { etat: at(p, 'data-prevision-carte'), label: at(p, 'data-prevision-label'), ca: at(p, 'data-prevision-ca'), partiel: at(p, 'data-prevision-partiel'), apayer: at(p, 'data-prevision-apayer'), adater: at(p, 'data-prevision-adater'), texte: p.innerText.replace(/\s+/g, ' '), visible: p.getBoundingClientRect().height > 0 } : null,
    deb: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
});
const ouvrirMicro = async (pg) => { await pg.evaluate(() => { const d = document.querySelector('[data-micro-repli]'); if (d) d.open = true; }); await pg.waitForTimeout(400); };
const capture = async (pg, sel, nom) => { if (!CAPT) return; fs.mkdirSync(CAPT, { recursive: true }); const el = pg.locator(sel + ':visible').first(); if (!(await el.count())) return; await el.scrollIntoViewIfNeeded(); await pg.waitForTimeout(300); await el.screenshot({ path: path.join(CAPT, nom + '.png') }); };
(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 1512, height: 950 }, { width: 390, height: 844 }]) {
      const T = vp.width;
      console.log(`\n══ ${T} px`);
      await essaie('A' + T, async () => {
        const opts = { main: mainDe() };
        const { ctx, pg, errs } = await rendre(b, vp, opts);
        await aller(pg, 'compta', '[data-compta-urssaf]', 2500); await ouvrirMicro(pg);
        const r = await lire(pg);
        dit(r.atteinte === 'tva:10', `A ${T} : seuil de TVA « vers novembre » ; aucun mois pour le plafond`, r.atteinte + ' ' + JSON.stringify(r.n));
        const d = r.dac7;
        dit(d.Vinted && d.Vinted.v === 'atteint' && d.Vinted.n === '41' && d.Leboncoin && d.Leboncoin.v === 'atteint' && d.Leboncoin.cts === '1995000', `A ${T} : DAC7 Vinted (41 ventes) et Leboncoin (19 950 €) atteints`, JSON.stringify(d));
        dit(d.eBay && d.eBay.v === 'sous' && /encore 27 ventes/.test(d.eBay.t), `A ${T} : DAC7 eBay sous les seuils, « encore 27 ventes ou … »`, d.eBay && d.eBay.t);
        dit(d.Vestiaire && d.Vestiaire.etat === 'lu' && d.Vestiaire.n === '0' && d.Vestiaire.v === 'sous', `A ${T} : Vestiaire lu, aucune vente ⇒ sous les seuils`, JSON.stringify(d.Vestiaire));
        dit(r.prev && r.prev.etat === 'lu' && r.prev.label === 'octobre 2026' && r.prev.ca === '8000' && r.prev.apayer === '992' && !r.prev.partiel && r.prev.visible, `A ${T} : (visible) prochaine échéance octobre : 8 000 € reçus ⇒ 992,00 € (12,4 %)`, JSON.stringify(r.prev));
        dit(r.deb <= 1, `A ${T} : aucun débordement horizontal`, String(r.deb));
        await capture(pg, '[data-prevision-carte]', `prevision-${T}`); await capture(pg, '[data-micro-seuils]', `seuils-${T}`);
        dit(errs.length === 0, `A ${T} : aucune erreur d’app`, errs.join(' | ').slice(0, 200));
        await ctx.close();
      });
      if (CAPT) await essaie('S' + T, async () => {
        const { ctx, pg } = await rendre(b, vp, { main: mainDe({ vinted_dark: true }), sombre: true });
        await pg.addInitScript(() => { window.__sombre = 1; });
        await aller(pg, 'compta', '[data-compta-urssaf]', 2500); await ouvrirMicro(pg);
        await capture(pg, '[data-prevision-carte]', `prevision-${T}-sombre`); await capture(pg, '[data-micro-seuils]', `seuils-${T}-sombre`);
        await ctx.close();
      });
      await essaie('B' + T, async () => {
        const { ctx, pg, errs } = await rendre(b, vp, { main: mainDe({}, LIGNE({ aDater: { n: 2, ca: 120, par: { Vinted: { n: 2, ca: 120 } } }, sources: { Vinted: 'lu', Leboncoin: 'lu', eBay: 'lu', Vestiaire: 'pasSu' } })) });
        await aller(pg, 'compta', '[data-compta-urssaf]', 2500); await ouvrirMicro(pg);
        const r = await lire(pg);
        dit(r.prev && r.prev.partiel === '1' && r.prev.adater === '2' && /au moins/.test(r.prev.texte), `B ${T} : 2 ventes à dater ⇒ « au moins » + « 2 ventes » à dater`, JSON.stringify(r.prev));
        dit(r.atteinte === '', `B ${T} : total partiel ⇒ aucun « vers [mois] »`, r.atteinte);
        const vc = r.dac7.Vestiaire || {};
        dit(vc.etat === 'passu' && vc.n === '' && /—/.test(vc.t), `B ${T} : DAC7 Vestiaire pas lu ⇒ « — », jamais 0`, JSON.stringify(vc));
        dit(errs.length === 0, `B ${T} : aucune erreur d’app`, errs.join(' | ').slice(0, 200));
        await ctx.close();
      });
      await essaie('C' + T, async () => {
        const m = mainDe(); delete m.vinted_urssaf_freq;
        const opts = { main: m };
        const { ctx, pg, errs } = await rendre(b, vp, opts);
        await aller(pg, 'compta', '[data-compta-urssaf]', 2500);
        let r = await lire(pg);
        dit(r.prev && r.prev.etat === 'rythme' && !/€/.test(r.prev.texte), `C ${T} : rythme jamais choisi ⇒ « — » et le choix, aucun montant`, JSON.stringify(r.prev));
        await capture(pg, '[data-prevision-carte]', `prevision-rythme-${T}`);
        await touche(pg, '[data-prevision-rythme="mensuel"]', vp);
        for (let i = 0; i < 40 && !(opts.main && opts.main.vinted_urssaf_freq === 'mensuel'); i++) await pg.waitForTimeout(250);
        r = await lire(pg);
        dit(opts.main && opts.main.vinted_urssaf_freq === 'mensuel' && r.prev && r.prev.etat === 'lu' && r.prev.label === 'octobre 2026', `C ${T} : « Par mois » rangé au nuage, la prévision s’affiche`, JSON.stringify({ f: opts.main && opts.main.vinted_urssaf_freq, p: r.prev }));
        dit(errs.length === 0, `C ${T} : aucune erreur d’app`, errs.join(' | ').slice(0, 200));
        await ctx.close();
      });
      await essaie('D' + T, async () => {
        const { ctx, pg, errs } = await rendre(b, vp, { main: mainDe({ vrm_urssaf_declare: { '2026-10': { ids: ['v:81001'], ca: 8000, at: Date.parse('2026-11-02T10:00:00Z') } } }) });
        await aller(pg, 'compta', '[data-compta-urssaf]', 2500);
        const r = await lire(pg);
        dit(r.prev && r.prev.etat === 'lu' && r.prev.label === 'novembre 2026' && r.prev.ca === '500' && r.prev.partiel === '1' && r.prev.apayer === '62', `D ${T} : octobre déclaré ⇒ prévision de novembre : au moins 500 € ⇒ 62,00 €`, JSON.stringify(r.prev));
        dit(errs.length === 0, `D ${T} : aucune erreur d’app`, errs.join(' | ').slice(0, 200));
        await ctx.close();
      });
    }
  } catch (e) { dit(false, 'le banc s’exécute', String(e.message || e).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); console.log(ko ? `\nKO seuils-prevision : ${ko} rouge(s), ${ok} vert(s)` : `\nOK seuils-prevision : ${ok} verts, 0 rouge`); process.exit(ko ? 1 : 0); }
})();
