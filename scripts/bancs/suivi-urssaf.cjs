// ═══════════════════════════════════════════════════════════════════════════
// BANC : LE SUIVI DES DÉCLARATIONS URSSAF (29 octobre, « un vrai suivi », puis
//        « je veux quelque chose de parfait »)
//        (BANC_PORT=6351 node scripts/bancs/suivi-urssaf.cjs — après `npm run build`)
// ═══════════════════════════════════════════════════════════════════════════
// Données INVENTÉES (le dépôt est public), horloge au 27 octobre 2026, 390 px
// tactile et 1512 px. On juge les attributs, les nombres et le registre écrit.
//   A. septembre noté avec le CA TAPÉ (300 €) et sans cotisations : la carte ne
//      dit JAMAIS « payé » pour ce chiffre ; « Compléter » range les cotisations
//      payées SANS toucher aux ventes de la déclaration, et ça part au nuage.
//   B. une saisie illisible (« 12,345 ») : rien n'est écrit, et c'est dit.
//   C. l'export CSV porte la période et les cotisations.
//   D. « C'est déclaré » : le formulaire du rapport a le champ des cotisations
//      payées, et elles sont rangées avec la déclaration.
require('./_porte-banc.cjs');                       // la session de banc (l'accès direct n'existe plus)
const { chromium } = require('playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 6351;
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
const mainDe = (extra = {}) => ({ vinted_regime: 'micro', vinted_urssaf_taux: 13.5, vinted_urssaf_freq: 'mensuel', vinted_urssaf_mois: LIGNE, vrm_journee_benefice: true,
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
const DECL_SEPT = { '2026-09': { ids: ['vinted:9301', 'vinted:9302', 'vinted:9303'], n: 3, ca: 300, montant: 300, regle: 'versement', at: Date.parse('2026-10-12T09:00:00Z') } };
const ligneSuivi = (pg, label) => pg.evaluate((lb) => { const c = document.querySelector(`[data-suivi-periode="${lb}"]`); if (!c) return null; const o = { texte: c.innerText }; for (const a of c.getAttributeNames()) if (a.startsWith('data-suivi-')) o[a.slice(11)] = c.getAttribute(a); return o; }, label);

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      const T = `${vp.width} px`;
      console.log(`── ${T}`);
      await essaie(`A ${T}`, async () => {
        const opts = { main: mainDe({ vrm_urssaf_declare: DECL_SEPT }) };
        const { ctx, pg, errs } = await rendre(b, vp, opts);
        await aller(pg, 'compta', '[data-suivi-urssaf="lu"]', 2500);
        let l = await ligneSuivi(pg, 'septembre 2026');
        dit(!!l && l.etat === 'declaree' && l.decl === '300' && l.paye === '', `A ${T} : septembre « déclarée », 300 € déclarés, cotisations pas notées`, JSON.stringify(l && { etat: l.etat, decl: l.decl, paye: l.paye }));
        dit(!!l && !/payé 300|payées 300/.test(l.texte) && /cotisations ≈/.test(l.texte), `A ${T} : le CA tapé n'est jamais affiché comme un paiement`, l && l.texte.replace(/\n/g, ' | ').slice(0, 160));
        if (process.env.SHOTS) { const el = await pg.$('[data-suivi-urssaf]'); if (el) await el.screenshot({ path: `${process.env.SHOTS}/suivi-avant-${vp.width}.png` }); }
        if (process.env.SHOTS) { await pg.setViewportSize({ width: vp.width, height: 7000 }); await pg.waitForTimeout(600); await pg.screenshot({ path: `${process.env.SHOTS}/compta-${vp.width}.png` }); await pg.setViewportSize(vp); await pg.waitForTimeout(300); }
        // (29 oct.) Ta micro-entreprise : profil, calendrier, seuils.
        const mp = await attrs(pg, '[data-micro-profil]', 'data-micro-');
        dit(!!mp && mp.profil === 'passu' && await pg.$('[data-micro-vl-question]') != null, `M ${T} : versement libératoire pas encore répondu ⇒ la question est posée`, JSON.stringify(mp));
        const mc = await attrs(pg, '[data-micro-calendrier]', 'data-micro-');
        dit(!!mc && mc.calendrier === 'mensuel', `M ${T} : le calendrier suit son rythme (mensuel)`, JSON.stringify(mc));
        const ms = await attrs(pg, '[data-micro-seuils]', 'data-micro-');
        dit(!!ms && ms.seuils === 'lu' && ms.tva === 'ok' && ms.plafond === 'ok' && Number(ms.ca) > 0, `M ${T} : jauge des seuils lue (TVA et plafond)`, JSON.stringify(ms));
        if (process.env.SHOTS) { const el = await pg.$('[data-micro-entreprise]'); if (el) await el.screenshot({ path: `${process.env.SHOTS}/micro-${vp.width}.png` }); }
        const mi0 = await attrs(pg, '[data-micro-impots]', 'data-micro-impots-');
        dit(!!mi0 && mi0.cases === '5KO,5TA' && Number(mi0.ca) > 0, `I ${T} : déclaration de revenus — versement libératoire pas répondu ⇒ les deux cases`, JSON.stringify(mi0));
        await touche(pg, '[data-micro-vl-choix="non"]', vp);
        await pg.waitForTimeout(1600);
        dit(opts.main && opts.main.vrm_micro_options && opts.main.vrm_micro_options.liberatoire === 'non', `M ${T} : « Non » est rangé au nuage`, JSON.stringify(opts.main && opts.main.vrm_micro_options));
        dit((await attrs(pg, '[data-micro-profil]', 'data-micro-') || {}).profil === 'non' && await pg.$('[data-micro-vl-question]') == null, `M ${T} : la question disparaît une fois répondue`);
        dit(((await attrs(pg, '[data-micro-impots]', 'data-micro-impots-')) || {}).cases === '5KO', `I ${T} : « Non » ⇒ case 5KO seule`);
        if (process.env.SHOTS) { const el = await pg.$('[data-micro-impots]'); if (el) await el.screenshot({ path: `${process.env.SHOTS}/impots-${vp.width}.png` }); }
        await touche(pg, '[data-micro-freq-choix="trimestriel"]', vp);
        await pg.waitForTimeout(1600);
        dit(opts.main && opts.main.vinted_urssaf_freq === 'trimestriel' && (await attrs(pg, '[data-micro-calendrier]', 'data-micro-') || {}).calendrier === 'trimestriel' && (await attrs(pg, '[data-urssaf-rythme]', 'data-urssaf-') || {}).rythme === 'trimestriel', `M ${T} : changer le rythme ⇒ un seul réglage, suivi par le calendrier et la carte du mois`);
        await touche(pg, '[data-micro-freq-choix="mensuel"]', vp);
        await pg.waitForTimeout(1200);
        await touche(pg, '[data-suivi-completer="2026-09"]', vp);
        await pg.waitForSelector('[data-suivi-edit="2026-09"]', { timeout: 5000 });
        // B : une saisie illisible
        await pg.fill('[data-suivi-edit-paye]', '12,345');
        await touche(pg, '[data-suivi-edit-ok]', vp);
        await pg.waitForTimeout(400);
        const alerte = await pg.evaluate(() => { const a = document.querySelector('[data-suivi-edit] [role="alert"]'); return a ? a.innerText : null; });
        let reg = await registre(pg);
        dit(!!alerte && reg['2026-09'].paye == null, `B ${T} : « 12,345 » refusé, rien n'est écrit, et c'est dit`, alerte);
        await pg.fill('[data-suivi-edit-paye]', '37,20');
        if (process.env.SHOTS) { const el = await pg.$('[data-suivi-urssaf]'); if (el) await el.screenshot({ path: `${process.env.SHOTS}/suivi-edit-${vp.width}.png` }); }
        await touche(pg, '[data-suivi-edit-ok]', vp);
        await pg.waitForTimeout(2600);
        reg = await registre(pg);
        const s = reg && reg['2026-09'];
        dit(!!s && s.paye === 37.2 && s.montant === 300 && s.ids.length === 3 && s.at === DECL_SEPT['2026-09'].at, `A ${T} : « Compléter » range 37,20 € payés, les ventes et la date de la déclaration ne bougent pas`, JSON.stringify(s).slice(0, 160));
        dit(!!(opts.main && opts.main.vrm_urssaf_declare && opts.main.vrm_urssaf_declare['2026-09'] && opts.main.vrm_urssaf_declare['2026-09'].paye === 37.2), `A ${T} : la saisie part au nuage`);
        l = await ligneSuivi(pg, 'septembre 2026');
        const an = await attrs(pg, '[data-suivi-annee]', 'data-suivi-annee-');
        dit(!!l && l.paye === '37.2' && !l.texte.includes('Compléter') && an && an.paye === '37.2', `A ${T} : la ligne et l'année disent 37,20 € payés, plus rien à compléter`, JSON.stringify({ paye: l && l.paye, an }));
        // C : l'export
        const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 6000 }), touche(pg, '[data-suivi-export]', vp)]);
        const csv = fs.readFileSync(await dl.path(), 'utf8');
        dit(/septembre 2026;[^\n]*;déclarée;[^\n]*;300,00;oui;37,20/.test(csv), `C ${T} : le CSV porte septembre, 300 € déclarés et 37,20 € payés`, csv.split('\n').find((x) => /septembre/.test(x)));
        if (process.env.SHOTS) { const el = await pg.$('[data-suivi-urssaf]'); if (el) await el.screenshot({ path: `${process.env.SHOTS}/suivi-apres-${vp.width}.png` }); }
        await sain(pg, `Comptabilité ${T}`);
        dit(errs.length === 0, `A ${T} : aucune erreur de page`, errs.join(' | ').slice(0, 200));
        await ctx.close();
      });
      await essaie(`R ${T}`, async () => {
        // (29 oct.) Rien à confirmer, seuils loin ⇒ « Ta micro-entreprise » repliée, résumé lisible ;
        // le récap mensuel aussi. Un geste l'ouvre.
        const opts = { main: mainDe({ vrm_urssaf_declare: DECL_SEPT, vrm_micro_options: { liberatoire: 'non', acre: false, at: Date.parse('2026-10-20T09:00:00Z') } }) };
        const { ctx, pg, errs } = await rendre(b, vp, opts);
        await aller(pg, 'compta', '[data-suivi-urssaf="lu"]', 2500);
        await pg.waitForTimeout(800);
        const r = await attrs(pg, '[data-micro-repli]', 'data-micro-');
        dit(!!r && r.repli === 'ferme' && !r.attention, `R ${T} : rien à confirmer ⇒ la micro-entreprise est repliée`, JSON.stringify(r));
        const resume = await pg.evaluate(() => { const d = document.querySelector('[data-micro-repli]'); return d ? d.querySelector('summary').innerText : ''; });
        dit(/Ta micro-entreprise/.test(resume) && /taux/.test(resume) && /à déclarer avant le/.test(resume), `R ${T} : le résumé dit le taux et la prochaine échéance`, resume.replace(/\n/g, ' | '));
        const vis = await pg.evaluate(() => { const e = document.querySelector('[data-micro-seuils]'); return !!e && (e.checkVisibility ? e.checkVisibility() : e.getClientRects().length > 0); });
        dit(!vis, `R ${T} : les seuils ne sont pas affichés tant que c'est replié`);
        const rec = await pg.evaluate(() => { const d = document.querySelector('[data-recap-repli]'); return d ? { open: d.open } : null; });
        dit(!rec || rec.open === false, `R ${T} : le récap mensuel est replié`, JSON.stringify(rec));
        await touche(pg, '[data-micro-repli] > summary', vp);
        await pg.waitForTimeout(400);
        const r2 = await attrs(pg, '[data-micro-repli]', 'data-micro-');
        const vis2 = await pg.evaluate(() => { const e = document.querySelector('[data-micro-seuils]'); return !!e && (e.checkVisibility ? e.checkVisibility() : e.getClientRects().length > 0); });
        dit(!!r2 && r2.repli === 'ouvert' && vis2, `R ${T} : un geste l'ouvre et montre les seuils`, JSON.stringify(r2));
        if (process.env.SHOTS) { await pg.setViewportSize({ width: vp.width, height: 7000 }); await pg.evaluate(() => { const d = document.querySelector('[data-micro-repli]'); if (d) d.open = false; }); await pg.waitForTimeout(600); await pg.screenshot({ path: `${process.env.SHOTS}/compta-replie-${vp.width}.png` }); await pg.setViewportSize(vp); }
        dit(errs.length === 0, `R ${T} : aucune erreur de page`, errs.join(' | ').slice(0, 200));
        await ctx.close();
      });
      await essaie(`D ${T}`, async () => {
        const opts = { main: mainDe() };
        const { ctx, pg, errs } = await rendre(b, vp, opts);
        await aller(pg, 'compta', '[data-suivi-urssaf="lu"]', 2500);
        await touche(pg, '[data-suivi-noter="2026-09"]', vp);
        const f = await formulaire(pg);
        dit(!!f && /Cotisations payées/.test(f), `D ${T} : le formulaire du rapport demande les cotisations payées`, (f || '').replace(/\n/g, ' | ').slice(0, 160));
        if (f) {
          await pg.fill('[data-decl-paye]', '37,20');
          await touche(pg, '[data-decl-enregistrer]', vp);
          await pg.waitForTimeout(2600);
          const s = (await registre(pg) || {})['2026-09'];
          dit(!!s && s.paye === 37.2 && s.ids.length === 3, `D ${T} : la déclaration est rangée avec 37,20 € payés`, JSON.stringify(s).slice(0, 160));
          const lu = await pg.evaluate(() => { const e = document.querySelector('[data-decl-paye-lu]'); return e ? e.getAttribute('data-decl-paye-lu') : null; });
          dit(lu === '37.2', `D ${T} : le rapport le dit (« Cotisations payées »)`, lu);
        }
        dit(errs.length === 0, `D ${T} : aucune erreur de page`, errs.join(' | ').slice(0, 200));
        await ctx.close();
      });
      // S (29 oct.) : rattrapage en série — « Noter mes N mois à la suite ».
      await essaie(`S ${T}`, async () => {
        const LIGNE_S = { ...LIGNE, mois: [...LIGNE.mois, { ym: '2026-08', ca: 120, n: 1, par: { Vinted: { n: 1, ca: 120 } } }, { ym: '2026-07', ca: 80, n: 1, par: { Vinted: { n: 1, ca: 80 } } }] };
        const opts = { main: mainDe({ vinted_urssaf_mois: LIGNE_S }) };
        const { ctx, pg, errs } = await rendre(b, vp, opts);
        await aller(pg, 'compta', '[data-suivi-urssaf="lu"]', 2500);
        const n = await pg.evaluate(() => { const e = document.querySelector('[data-suivi-serie]'); return e ? Number(e.getAttribute('data-suivi-serie')) : 0; });
        dit(n >= 2, `S ${T} : plusieurs mois à noter ⇒ « Noter mes ${n} mois à la suite »`, String(n));
        if (n >= 2) {
          await touche(pg, '[data-suivi-serie]', vp);
          await formulaire(pg);
          const s1 = await pg.evaluate(() => { const e = document.querySelector('[data-decl-serie]'); return e ? e.getAttribute('data-decl-serie') : null; });
          dit(s1 === `1/${n}`, `S ${T} : le plus ancien mois s'ouvre, « mois 1 sur ${n} »`, s1);
          await touche(pg, '[data-decl-enregistrer]', vp);
          await pg.waitForFunction((v) => { const e = document.querySelector('[data-decl-serie]'); return e && e.getAttribute('data-decl-serie') === v; }, `2/${n}`, { timeout: 25000 }).catch(() => {});
          await pg.waitForTimeout(1500);   // l'écriture du registre part un peu après le geste
          const s2 = await pg.evaluate(() => { const e = document.querySelector('[data-decl-serie]'); return e ? e.getAttribute('data-decl-serie') : null; });
          const reg = await registre(pg) || {};
          dit(s2 === `2/${n}` && Object.keys(reg).length === 1, `S ${T} : enregistré ⇒ le mois suivant s'ouvre tout seul (un seul mois noté)`, JSON.stringify({ s2, notes: Object.keys(reg) }));
          await touche(pg, '[data-decl-passer]', vp);
          await pg.waitForTimeout(1500);
          const s3 = await pg.evaluate(() => { const e = document.querySelector('[data-decl-serie]'); return e ? e.getAttribute('data-decl-serie') : null; });
          const reg2 = await registre(pg) || {};
          dit((n === 2 ? s3 === null : s3 === `3/${n}`) && Object.keys(reg2).length === 1, `S ${T} : « Pas encore déclaré » passe au suivant sans rien noter`, JSON.stringify({ s3, notes: Object.keys(reg2) }));
          if (n > 2) { await touche(pg, '[data-decl-serie-stop]', vp); await pg.waitForTimeout(600); dit(!(await pg.$('[data-decl-form]')), `S ${T} : « Arrêter » referme le formulaire`); }
        }
        dit(errs.length === 0, `S ${T} : aucune erreur de page`, errs.join(' | ').slice(0, 200));
        await ctx.close();
      });
    }
  } finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n${ko} KO` : '\nTout est vert');
  process.exit(ko ? 1 : 0);
})();
