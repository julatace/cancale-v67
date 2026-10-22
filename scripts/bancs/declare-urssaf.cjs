// ═══════════════════════════════════════════════════════════════════════════
// BANC : « C'EST DÉCLARÉ », LE NET AVANT DÉPENSES, LE RELEVÉ SANS PROMESSE (22 octobre)
//        (BANC_PORT=6341 node scripts/bancs/declare-urssaf.cjs — après `npm run build`)
// ═══════════════════════════════════════════════════════════════════════════
// Trois propositions du 22 octobre, mesurées sur sa base :
//   (5) il n'a JAMAIS noté un mois « déclaré » : le geste n'existait que dans
//       Ventes → Outils → Rapport comptable, alors que le rappel et Ma journée
//       envoient sur Comptabilité. « C'est déclaré » (Comptabilité ET Ma
//       journée) ouvre LE formulaire du rapport sur le bon mois — mêmes gardes ;
//   (9) son « bénéfice net » retirait 0 € de dépenses jamais notées et se
//       présentait comme complet : « net avant tes dépenses », et le choix une
//       seule fois (aucune dépense à noter / ajouter une dépense) ;
//  (10) le rapport promettait « l'extension récupère ton relevé à ta prochaine
//       visite » — faux chez lui (0 relevé, `history` vide) : plus de promesse.
// Ce banc rend l'app sur des données INVENTÉES (il vit dans le dépôt, public),
// horloge fixée au 27 octobre 2026, aux deux tailles (390 px tactile, 1512 px).
// On juge les ATTRIBUTS, les nombres et ce qui est écrit dans la base — jamais
// une formulation seule.
require('./_porte-banc.cjs');                       // la session de banc (l'accès direct n'existe plus)
const { chromium } = require('playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 6341;
const MAINTENANT = '2026-10-27T10:00:00+01:00';

const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'atelier_test', domain: 'www.vinted.fr', updated_at: '2026-10-27T08:00:00Z' }];
// Trois ventes versées en septembre (300 €), une en octobre (60 €).
const VENTES = [
  [9301, 'Nike Air Max inventée taille 42', 100, '2026-09-10T12:00:00+02:00', '2026-09-15T08:00:00+02:00'],
  [9302, 'Salomon XT-6 inventée taille 40', 80, '2026-09-12T12:00:00+02:00', '2026-09-20T08:00:00+02:00'],
  [9303, 'Adidas Samba inventée taille 41', 120, '2026-09-25T12:00:00+02:00', '2026-09-29T08:00:00+02:00'],
  [9304, 'Asics Gel inventée taille 43', 60, '2026-10-05T12:00:00+02:00', '2026-10-10T08:00:00+02:00'],
];
const LIGNE = { at: Date.parse('2026-10-27T07:00:00Z'), mois: [{ ym: '2026-10', ca: 60, n: 1, par: { Vinted: { n: 1, ca: 60 } } }, { ym: '2026-09', ca: 300, n: 3, par: { Vinted: { n: 3, ca: 300 } } }], aDater: { n: 0, ca: 0, par: {} }, sources: { Vinted: 'lu', Leboncoin: 'lu', eBay: 'lu', Vestiaire: 'nonRelie' } };
const ROWS = [
  { id: 'harvest_111_orders_sold', data: { capturedAt: '2026-10-27T07:30:00Z', payload: { my_orders: VENTES.map(([tx, t, p, d]) => ({ transaction_id: tx, title: t, price: { amount: String(p), currency_code: 'EUR' }, status: 'Commande finalisée', date: d })) } } },
  ...VENTES.map(([tx, , , , v]) => ({ id: `harvest_111_txn_${tx}`, data: { capturedAt: '2026-10-27T07:30:00Z', payload: { transaction: { id: tx, item_id: tx + 500000, status: 450, status_title: 'Commande finalisée', status_updated_at: v } } } })),
  { id: 'lbc_ventes', data: { ventes: {} } },
  { id: 'ebay_orders', data: { orders: [] } },
];
const mainDe = (extra = {}) => ({ vinted_urssaf_freq: 'mensuel', vinted_urssaf_mois: LIGNE, vrm_journee_benefice: true,
  vinted_sale_overrides: { 9301: { buyPrice: '40' }, 9302: { buyPrice: '30' }, 9303: { buyPrice: '50' }, 9304: { buyPrice: '30' } }, ...extra });

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
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
  const ctx = await b.newContext({ viewport: vp, timezoneId: 'Europe/Paris', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.setFixedTime(new Date(MAINTENANT));
  await pg.addInitScript((v) => {
    try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {}
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
      return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    }
    // Base CLOISONNÉE (la production l'est) : sinon l'app n'envoie rien au nuage
    // (`cloudPush` exige CLOISONNE) et l'écriture de la déclaration ne se voit pas.
    if (/select=owner&limit=1/.test(u)) return j([{ owner: 'x' }]);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    if (opts.txnKO && /_txn_/.test(u)) return panne();
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
};
const touche = async (pg, sel, vp) => { const l = pg.locator(sel).first(); await l.scrollIntoViewIfNeeded(); if (vp.width < 600) await l.tap(); else await l.click(); };
const attrs = (pg, sel, pref) => pg.evaluate(([s, p]) => { const e = document.querySelector(s); if (!e) return null; const o = {}; for (const a of e.getAttributeNames()) if (a.startsWith(p)) o[a.slice(p.length)] = e.getAttribute(a); return o; }, [sel, pref]);
const registre = (pg) => pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_urssaf_declare') || 'null'); } catch (_) { return null; } });
const sain = async (pg, ecran) => {
  const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, t: document.body.innerText }));
  dit(r.sw <= r.cw + 1, `${ecran} : aucun débordement horizontal`, `${r.sw} > ${r.cw}`);
  const m = /n'a pas pu s'afficher|n’a pas pu s’afficher|Cannot access|is not defined/.exec(r.t);
  dit(!m, `${ecran} : l'écran n'est pas tombé sur le garde-fou`, m && m[0]);
};
const formulaire = async (pg) => {
  await pg.waitForFunction(() => document.querySelector('[data-decl-form]') || document.querySelector('[data-decl-bloque]'), null, { timeout: 25000 }).catch(() => {});
  await pg.waitForTimeout(400);
  return pg.evaluate(() => { const f = document.querySelector('[data-decl-form]'); return f ? f.innerText : null; });
};

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      const T = `${vp.width} px`;
      console.log(`── ${T}`);

      await essaie(`A ${T}`, async () => {
        console.log('A. Comptabilité → « C\'est déclaré » → le formulaire du rapport, sur septembre');
        const opts = { main: mainDe() };
        const { ctx, pg, errs } = await rendre(b, vp, opts);
        await aller(pg, 'compta', '[data-compta-urssaf]', 2500);
        const bt = await pg.evaluate(() => [...document.querySelectorAll('[data-urssaf-cest-declare]')].map((e) => e.getAttribute('data-urssaf-cest-declare')));
        dit(bt.length === 1 && bt[0] === '2026-09', `A ${T} : la carte URSSAF de Comptabilité porte « C'est déclaré », pour septembre`, JSON.stringify(bt));
        await sain(pg, `Comptabilité ${T}`);
        if (bt.length) {
          await touche(pg, '[data-urssaf-cest-declare]', vp);
          const f = await formulaire(pg);
          dit(!!f && /septembre 2026/.test(f), `A ${T} : le formulaire du rapport s'ouvre, déplié, sur septembre 2026`, (f || '').replace(/\n/g, ' | ').slice(0, 120));
          dit(!!f && /300,00/.test(f), `A ${T} : il porte le CA du mois (300,00 €, 3 ventes) — celui du rapport`, (f || '').replace(/\n/g, ' | ').slice(0, 160));
          if (f) {
            await touche(pg, '[data-decl-enregistrer]', vp);
            await pg.waitForTimeout(2600);
            const reg = await registre(pg);
            const s = reg && reg['2026-09'];
            dit(!!s && Array.isArray(s.ids) && s.ids.length === 3 && s.regle === 'versement', `A ${T} : septembre est noté, par l'IDENTITÉ de ses 3 ventes`, JSON.stringify(s).slice(0, 120));
            dit(!!(opts.main && opts.main.vrm_urssaf_declare && opts.main.vrm_urssaf_declare['2026-09']), `A ${T} : la déclaration part dans le nuage (vrm_urssaf_declare)`);
            await aller(pg, 'compta', '[data-compta-urssaf]', 2500);
            const apres = await pg.evaluate(() => ({ bt: document.querySelectorAll('[data-urssaf-cest-declare]').length, faite: (document.querySelector('[data-urssaf-declaree]') || {}).getAttribute ? document.querySelector('[data-urssaf-declaree]').getAttribute('data-urssaf-declaree') : null }));
            dit(apres.bt === 0 && apres.faite === '2026-09', `A ${T} : de retour sur Comptabilité, la carte dit « notée déclarée » et le bouton est parti`, JSON.stringify(apres));
          }
        }
        dit(errs.length === 0, `A ${T} : aucune erreur de page`, errs.join(' | ').slice(0, 200));
        await ctx.close();
      });

      await essaie(`B ${T}`, async () => {
        console.log('B. Ma journée → « C\'est déclaré » sur la ligne URSSAF');
        const opts = { main: mainDe() };
        const { ctx, pg, errs } = await rendre(b, vp, opts);
        await aller(pg, 'journee', '[data-job="urssaf"]', 2500);
        const l = await pg.evaluate(() => { const j = document.querySelector('[data-job="urssaf"]'); const bt = j && j.querySelector('[data-urssaf-cest-declare]'); return { n: document.querySelectorAll('[data-job="urssaf"]').length, bt: bt ? bt.getAttribute('data-urssaf-cest-declare') : null, apayer: j && j.getAttribute('data-urssaf-apayer') }; });
        dit(l.n === 1 && l.bt === '2026-09', `B ${T} : la ligne URSSAF de Ma journée porte « C'est déclaré » (septembre), une fois`, JSON.stringify(l));
        dit(l.apayer === '40.5', `B ${T} : elle garde son montant (300 € × 13,5 % = 40,50 €)`, l.apayer);
        await sain(pg, `Ma journée ${T}`);
        if (l.bt) {
          await touche(pg, '[data-job="urssaf"] [data-urssaf-cest-declare]', vp);
          const f = await formulaire(pg);
          dit(!!f && /septembre 2026/.test(f), `B ${T} : le même formulaire s'ouvre, sur septembre 2026`, (f || '').replace(/\n/g, ' | ').slice(0, 120));
          if (f) {
            await touche(pg, '[data-decl-enregistrer]', vp);
            await pg.waitForTimeout(1300);
            await pg.evaluate(() => { const x = [...document.querySelectorAll('button[aria-label="Fermer"]')].pop(); if (x) x.click(); });
            await pg.waitForTimeout(500);
            // Retour sur Ma journée SANS recharger (la barre de navigation de l'app).
            const nav = pg.locator('button[aria-label="Ma journée"]:visible').first();
            if (await nav.count()) await nav.click(); else await pg.goBack().catch(() => {});
            await pg.waitForTimeout(2500);
            const ici = await pg.evaluate(() => ({ urssaf: document.querySelectorAll('[data-job="urssaf"]').length, journee: !!document.querySelector('.vrm-day-layout, [data-barre-jour]') }));
            dit(ici.journee && ici.urssaf === 0, `B ${T} : revenu sur Ma journée sans recharger, la ligne URSSAF est partie (le mois est noté)`, JSON.stringify(ici));
          }
        }
        dit(errs.length === 0, `B ${T} : aucune erreur de page`, errs.join(' | ').slice(0, 200));
        await ctx.close();
      });

      await essaie(`C ${T}`, async () => {
        console.log('C. Mêmes gardes : dates de versement illisibles ⇒ rien ne s\'ouvre, rien n\'est noté');
        const opts = { main: mainDe(), txnKO: true };
        const { ctx, pg } = await rendre(b, vp, opts);
        await aller(pg, 'compta', '[data-compta-urssaf]', 2500);
        if (await pg.locator('[data-urssaf-cest-declare]').count()) {
          await touche(pg, '[data-urssaf-cest-declare]', vp);
          await formulaire(pg);
          await pg.waitForTimeout(3000);
          const g = await pg.evaluate(() => { const o = document.querySelector('[data-decl-ouvrir]'); return { form: !!document.querySelector('[data-decl-form]'), bloque: !!document.querySelector('[data-decl-bloque]'), ouvrirGrise: o ? o.disabled : null }; });
          dit(!g.form && g.bloque && g.ouvrirGrise === true, `C ${T} : lecture ratée ⇒ le formulaire ne s'ouvre PAS, le bouton est grisé avec sa raison`, JSON.stringify(g));
          const reg = await registre(pg);
          dit(!reg || !reg['2026-09'], `C ${T} : rien n'est noté sur une lecture incomplète`, JSON.stringify(reg));
        } else dit(false, `C ${T} : « C'est déclaré » existe sur Comptabilité`);
        await ctx.close();
      });

      await essaie(`E ${T}`, async () => {
        console.log('E. Le net « avant tes dépenses » tant que rien n\'a jamais été noté');
        const opts = { main: mainDe() };
        const { ctx, pg, errs } = await rendre(b, vp, opts);
        await aller(pg, 'journee', '[data-journee-benef]', 3500);
        const a = await attrs(pg, '[data-journee-benef]', 'data-journee-benef-');
        const txt = await pg.evaluate(() => { const e = document.querySelector('[data-journee-benef]'); return e ? e.innerText : ''; });
        dit(!!a && a.depenses === 'jamais', `E ${T} : Ma journée sait que rien n'a jamais été noté (depenses=jamais)`, JSON.stringify(a));
        dit(/avant tes dépenses/i.test(txt), `E ${T} : le net se dit « avant tes dépenses »`, txt.replace(/\n/g, ' | ').slice(0, 160));
        dit(await pg.locator('[data-journee-benef] [data-depenses-choix]').count() === 1, `E ${T} : le choix est proposé, une fois`);
        if (await pg.locator('[data-depenses-aucune]').count()) {
          await touche(pg, '[data-depenses-aucune]', vp);
          await pg.waitForTimeout(2600);
          const a2 = await attrs(pg, '[data-journee-benef]', 'data-journee-benef-');
          const txt2 = await pg.evaluate(() => { const e = document.querySelector('[data-journee-benef]'); return e ? e.innerText : ''; });
          dit(!!a2 && a2.depenses === 'aucune' && !/avant tes dépenses/i.test(txt2) && (await pg.locator('[data-depenses-choix]').count()) === 0, `E ${T} : « je n'ai pas de dépenses à noter » ⇒ le net redevient le net, le choix disparaît`, JSON.stringify(a2));
          const sd = opts.main && opts.main.vrm_compta && opts.main.vrm_compta.sansDepenses;
          dit(!!(sd && sd.at), `E ${T} : la réponse est rangée dans vrm_compta (synchronisée)`, JSON.stringify(opts.main && opts.main.vrm_compta));
          await aller(pg, 'compta', '[data-benef-etat]', 2500);
          const c = await attrs(pg, '[data-benef-etat]', 'data-benef-');
          dit(!!c && c.depenses === 'aucune' && (await pg.locator('[data-depenses-choix]').count()) === 0, `E ${T} : Comptabilité lit la même réponse, sans reposer la question`, JSON.stringify(c && { depenses: c.depenses }));
        }
        dit(errs.length === 0, `E ${T} : aucune erreur de page`, errs.join(' | ').slice(0, 200));
        await ctx.close();
      });

      await essaie(`F ${T}`, async () => {
        console.log('F. « Ajouter une dépense » mène au formulaire de Comptabilité ; une charge notée ⇒ plus de question');
        const opts = { main: mainDe() };
        const { ctx, pg } = await rendre(b, vp, opts);
        // Le bénéfice se PUBLIE en lisant les ventes (Ma journée) ; Comptabilité le consomme.
        await aller(pg, 'journee', '[data-journee-benef-etat="lu"]', 1500);
        await aller(pg, 'compta', '[data-benef-depenses]:not([data-benef-depenses=""])', 2000);
        const c = await attrs(pg, '[data-benef-etat]', 'data-benef-');
        const lib = await pg.evaluate(() => { const l = document.querySelector('[data-benef-ligne="net"]'); return l ? l.innerText : ''; });
        dit(!!c && c.depenses === 'jamais' && /avant tes dépenses/i.test(lib), `F ${T} : Comptabilité dit aussi « net avant tes dépenses »`, lib.replace(/\n/g, ' | '));
        dit((await pg.locator('[data-depenses-choix]').count()) === 1, `F ${T} : une cause, une phrase : le choix est écrit UNE fois sur l'écran`);
        await aller(pg, 'journee', '[data-journee-benef]', 3000);
        if (await pg.locator('[data-depenses-ajouter]').count()) {
          await touche(pg, '[data-depenses-ajouter]', vp);
          await pg.waitForFunction(() => document.querySelector('[data-dep-form]'), null, { timeout: 20000 }).catch(() => {});
          dit((await pg.locator('[data-dep-form]').count()) === 1, `F ${T} : « Ajouter une dépense » ouvre le formulaire des dépenses de Comptabilité`);
        } else dit(false, `F ${T} : « Ajouter une dépense » existe sur Ma journée`);
        await ctx.close();
        const opts2 = { main: mainDe({ vrm_compta: { depenses: [{ id: 'd1', date: '2026-10-03', libelle: 'cartons inventés', cat: 'Emballage', montant: 12 }], fixes: [], packs: [], abonnements: [] } }) };
        const r2 = await rendre(b, vp, opts2);
        await aller(r2.pg, 'journee', '[data-journee-benef]', 3500);
        const a = await attrs(r2.pg, '[data-journee-benef]', 'data-journee-benef-');
        const txt = await r2.pg.evaluate(() => { const e = document.querySelector('[data-journee-benef]'); return e ? e.innerText : ''; });
        dit(!!a && a.depenses === 'notees' && !/avant tes dépenses/i.test(txt) && (await r2.pg.locator('[data-depenses-choix]').count()) === 0, `F ${T} : une dépense notée ⇒ le net est le net, aucune question`, JSON.stringify(a && { depenses: a.depenses, net: a.net }));
        await r2.ctx.close();
      });
    }

    console.log('── D. Le relevé du porte-monnaie : aucune promesse, quelle que soit l\'extension (1512 px)');
    const vp = { width: 1512, height: 950 };
    const releve = async (opts) => {
      const { ctx, pg } = await rendre(b, vp, { main: mainDe(), ...opts });
      await aller(pg, 'cat_ventes', null, 3000);
      await pg.getByText('Outils', { exact: false }).first().click({ timeout: 8000 }).catch(() => {});
      await pg.getByText('Rapport comptable', { exact: true }).first().click({ timeout: 8000 }).catch(() => {});
      await pg.waitForTimeout(3000);
      const r = await pg.evaluate(() => { const e = document.querySelector('[data-releve]'); const t = [...document.querySelectorAll('div')].map((d) => d.innerText).find((x) => /^Relevé du porte-monnaie/.test(x || '')) || ''; return { etat: e ? e.getAttribute('data-releve') : null, texte: (e ? e.innerText : t).trim() }; });
      await ctx.close();
      return r;
    };
    await essaie('D', async () => {
      const sans = await releve({ pont: null });
      const ajour = await releve({ pont: '5.211.0' });
      dit(sans.etat === 'pasencore' && ajour.etat === 'pasencore', 'D : aucun relevé en base ⇒ « pas encore lu » (data-releve), extension absente comme à jour', `${sans.etat} · ${ajour.etat}`);
      dit(!!sans.texte && sans.texte === ajour.texte, 'D : la phrase ne dépend PAS de la version de l\'extension (aucune ne le tient chez lui)', `absente « ${sans.texte.slice(0, 90)} » · à jour « ${ajour.texte.slice(0, 90)} »`);
      const ko2 = await releve({ pont: '5.211.0', releveKO: true });
      dit(ko2.etat === 'passu', 'D : relevé illisible (522) ⇒ « pas su », jamais « rien de capté »', `${ko2.etat} — ${ko2.texte.slice(0, 90)}`);
    });
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ declare-urssaf : ${ko} rouge(s)` : '\n✅ declare-urssaf : tout est vert');
  process.exit(ko ? 1 : 0);
})();
