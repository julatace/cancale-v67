// Banc « Comptabilité simple » et « Organisation hors du menu » (29 octobre).
//
// Julien : « Pour la compta, améliore tout, mets de côté la facturation
// électronique et fais quelque chose de simple. » — puis, pour Organisation :
// « ça doit être utile sinon ça n'a rien à faire ici ».
//
// Ce que le banc exige, sur des données INVENTÉES (rien de réel, dépôt public) :
//  A. Comptabilité, 390 tactile clair et 1512 sombre :
//     • l'ordre de lecture : Vendu/Reçu → Bénéfice → URSSAF → Dépenses → Avancé ;
//     • « Avancé » REPLIÉ par défaut, et c'est lui qui porte le résultat de
//       l'année, le récap mensuel, les packs, l'entreprise, les factures et la
//       facturation électronique (rien de supprimé : ils sont dans le DOM) ;
//     • les chiffres n'ont pas bougé (les mêmes que le code d'avant) ;
//     • la carte URSSAF ne redit plus « Bénéfice — » (il a sa carte au-dessus) ;
//     • « Ta micro-entreprise » repliée… sauf s'il y a une question à
//       trancher (versement libératoire pas dit) : alors ouverte, et elle ne
//       se referme pas sous le doigt quand il répond ;
//     • le sommaire mène à « Avancé » et l'ouvre ; cibles ≥ 44 px au doigt.
//  B. versement libératoire déjà dit ⇒ la micro-entreprise reste repliée.
//  C. Organisation n'est plus dans le menu (Gestion au téléphone, rail à
//     l'ordinateur), mais on y entre par Réglages → Stock et rangement, et
//     `?tab=organisation` marche toujours.
//
// Lancer : npm run build && node scripts/bancs/compta-simple.cjs
//          (BANC_PORT pour changer de port ; CHROMIUM_PATH pour le navigateur)

require('./_porte-banc.cjs');
const { chromium } = require('playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 9311;
const MAINTENANT = '2026-10-27T10:00:00+01:00';
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'atelier_test', domain: 'www.vinted.fr', updated_at: '2026-10-27T08:00:00Z' }];
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
const main = (sombre, avecVl) => ({
  vinted_dark: sombre, vinted_regime: 'micro', vinted_urssaf_taux: 12.4, vinted_urssaf_freq: 'mensuel', vinted_urssaf_mois: LIGNE,
  vinted_sale_overrides: { 9301: { buyPrice: '40' }, 9302: { buyPrice: '30' }, 9303: { buyPrice: '50' }, 9304: { buyPrice: '30' } },
  vrm_compta: { depenses: [{ id: 'd1', date: '2026-10-03', libelle: 'cartons', cat: 'Emballage', montant: 12.5 }], abonnements: [{ id: 'a1', libelle: 'VRM', montant: 12.99, periode: 'mois', debut: '2026-09-01', fin: '' }], fixes: [], packs: [] },
  vrm_urssaf_declare: { '2026-09': { ids: ['vinted:9301', 'vinted:9302', 'vinted:9303'], n: 3, ca: 300, montant: 300, regle: 'versement', at: Date.parse('2026-10-12T09:00:00Z') } },
  ...(avecVl ? { vrm_micro_options: { liberatoire: 'non', acre: false, at: Date.parse('2026-10-20T09:00:00Z') } } : {}),
});

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.onnx': 'application/octet-stream' };
const srv = http.createServer((q, r) => { let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html'; const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); });
srv.on('error', (e) => { console.log(e.code === 'EADDRINUSE' ? `KO le port ${PORT} est pris — relance-le seul (BANC_PORT=…)` : `KO serveur : ${e.message}`); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => { if (!sel || sel === '*') return row; const out = {}; for (const part of sel.split(',')) { const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue; const src = m[2], alias = m[1] || src.split(/->>|->/).pop(); if (src === 'id') { out[alias] = row.id; continue; } if (src === 'data') { out[alias] = row.data; continue; } let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg]; if (/->>/.test(src) && v != null && typeof v !== 'object') v = String(v); out[alias] = v == null ? null : v; } return out; };

let ko = 0, ok = 0;
const check = (cond, msg) => { if (cond) { ok++; console.log('✅ ' + msg); } else { ko++; console.log('❌ ' + msg); } };
const essaie = async (msg, fn) => { try { await fn(); } catch (e) { ko++; console.log(`❌ ${msg} — ${String(e.message || e).split('\n')[0].slice(0, 200)}`); } };

async function page(b, vp, sombre, avecVl, errs) {
  const tel = vp.width < 600;
  const ctx = await b.newContext({ viewport: vp, timezoneId: 'Europe/Paris', ...(tel ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.setFixedTime(new Date(MAINTENANT));
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', s ? 'true' : 'false'); } catch (_) {} }, sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  // La ligne `main` GARDE ce que l'app y écrit (une relecture du nuage ne doit
  // pas rendre l'ancienne valeur : un banc qui jette les écritures mesure une fiction).
  let m = main(sombre, avecVl);
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') {
      try { const corps = JSON.parse(route.request().postData() || 'null'); for (const x of [].concat(corps || [])) if (x && x.id === 'main' && x.data && typeof x.data === 'object') m = x.data; } catch (_) {}
      return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    }
    if (/select=owner&limit=1/.test(u)) return j([{ owner: 'x' }]);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: '2026-10-27T08:00:00Z', cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq && eq[1] === 'main') return j([forme({ id: 'main', data: m })]);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  // Organisation lit sa route : servie à la forme de `api/_lib/operations.js`.
  const { VIDE } = await import(path.join(__dirname, '..', '..', 'src', 'operations', 'metier.js'));
  await pg.route('**/api/**', (r) => {
    if (/mode=operations/.test(r.request().url())) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, donnees: VIDE(), equipe: [], serveur: new Date(MAINTENANT).toISOString(), confirmees: [] }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' });
  });
  return { ctx, pg, tel };
}

async function ouvrir(pg, tab) {
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
}
const mort = async (pg) => /n'a pas pu s'afficher|Cannot access|is not defined/.test(await pg.evaluate(() => document.body.innerText));
const deborde = async (pg) => pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);

// L'ordre de deux éléments dans la page (le suivant est-il APRÈS ?).
const avant = (pg, a, b) => pg.evaluate(([a, b]) => { const x = document.querySelector(a), y = document.querySelector(b); return !!(x && y && (x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING)); }, [a, b]);
const visible = (pg, sel) => pg.evaluate((sel) => { const e = document.querySelector(sel); return !!(e && e.checkVisibility && e.checkVisibility()); }, sel);
const attr = (pg, sel, a) => pg.evaluate(([sel, a]) => { const e = document.querySelector(sel); return e ? e.getAttribute(a) : null; }, [sel, a]);
const dansAvance = (pg, sel) => pg.evaluate((sel) => { const d = document.querySelector('[data-compta-avance]'); const e = document.querySelector(sel); return !!(d && e && d.contains(e)); }, sel);

async function scenarioA(b, vp, sombre) {
  const nom = `${vp.width}${sombre ? ' sombre' : ' clair'}`;
  const errs = [];
  const { ctx, pg, tel } = await page(b, vp, sombre, false, errs);
  await essaie(`A ${nom} — l'écran se rend`, async () => {
    await ouvrir(pg, 'cat_ventes');
    await pg.waitForTimeout(3500);
    await ouvrir(pg, 'compta');
    await pg.locator('[data-ca-cur="vendu"]').first().waitFor({ timeout: 40000 });
    await pg.locator('[data-benef-etat="lu"]').first().waitFor({ timeout: 40000 });
    await pg.locator('[data-echeance-apayer]').first().waitFor({ timeout: 40000 });
    await pg.locator('[data-micro-repli]').first().waitFor({ timeout: 40000 });
    await pg.waitForTimeout(800);
  });
  // SHOTS=dossier : capture de tout l'écran (à regarder : §6.2).
  if (process.env.SHOTS) {
    for (let i = 0; i < 8; i++) {
      await pg.screenshot({ path: path.join(process.env.SHOTS, `compta-${vp.width}${sombre ? '-sombre' : ''}-${i}.png`) }).catch(() => {});
      const fin = await pg.evaluate((h) => { const els = [document.scrollingElement, ...document.querySelectorAll('main, .vrm-main, [class*="scroll"]')].filter((e) => e && e.scrollHeight > e.clientHeight + 4); const e = els.find((x) => getComputedStyle(x).overflowY !== 'visible' || x === document.scrollingElement); if (!e) return true; const avant = e.scrollTop; e.scrollTop += h * 0.85; return e.scrollTop === avant; }, vp.height);
      if (fin) break;
      await pg.waitForTimeout(250);
    }
    await pg.evaluate(() => { for (const e of [document.scrollingElement, ...document.querySelectorAll('main, .vrm-main')]) if (e) e.scrollTop = 0; });
  }
  await essaie(`A ${nom}`, async () => {
    check(!(await mort(pg)), `A ${nom} — aucun écran tombé sur le garde-fou`);
    // ── l'ordre de lecture
    check(await avant(pg, '[data-ca-periode]', '[data-benef-etat]'), `A ${nom} — « Vendu et reçu » avant le bénéfice`);
    check(await avant(pg, '[data-benef-etat]', '[data-compta-urssaf]'), `A ${nom} — le bénéfice avant l'URSSAF`);
    check(await avant(pg, '[data-compta-urssaf]', '[data-compta-depenses]'), `A ${nom} — l'URSSAF avant les dépenses`);
    check(await avant(pg, '[data-compta-depenses]', '[data-compta-avance]'), `A ${nom} — les dépenses avant « Avancé »`);
    // ── « Avancé » replié, et ce qui y vit
    check((await attr(pg, '[data-compta-avance]', 'data-compta-avance')) === 'ferme', `A ${nom} — « Avancé » est replié par défaut`);
    for (const [sel, lib] of [['[data-compta-resultat]', 'le résultat de l\'année'], ['[data-recap-regle]', 'le récap mensuel'], ['[data-compta-section="packs"]', 'les packs'], ['[data-profil-fiscal]', 'l\'entreprise'], ['#compta-factures', 'les factures'], ['[data-fe-etat]', 'la facturation électronique']]) {
      check(await dansAvance(pg, sel), `A ${nom} — ${lib} vit dans « Avancé » (rien n'est supprimé)`);
      check(!(await visible(pg, sel)), `A ${nom} — ${lib} n'est pas affiché tant qu'« Avancé » est replié`);
    }
    // ── l'essentiel, visible
    for (const [sel, lib] of [['[data-ca-cur="vendu"]', 'Vendu'], ['[data-ca-cur="recu"]', 'Reçu'], ['[data-benef-net]', 'le bénéfice'], ['[data-echeance-apayer]', 'l\'URSSAF à payer'], ['[data-dep-ouvrir]', 'Ajouter une dépense'], ['[data-compta-kpi="mois"]', 'les dépenses du mois']]) {
      check(await visible(pg, sel), `A ${nom} — ${lib} est visible sans rien ouvrir`);
    }
    // ── les chiffres n'ont pas bougé (mêmes valeurs que sur le code d'avant)
    check((await attr(pg, '[data-ca-cur="vendu"]', 'data-ca-eur')) === '60', `A ${nom} — Vendu du mois 60 € (inchangé)`);
    check((await attr(pg, '[data-ca-cur="recu"]', 'data-ca-eur')) === '60', `A ${nom} — Reçu du mois 60 € (inchangé)`);
    check((await attr(pg, '[data-benef-net]', 'data-benef-net')) === '-2.93', `A ${nom} — bénéfice net −2,93 € (inchangé) : ${await attr(pg, '[data-benef-net]', 'data-benef-net')}`);
    check((await attr(pg, '[data-echeance-apayer]', 'data-echeance-apayer')) === '37.2', `A ${nom} — prochaine échéance : 37,20 € à payer (inchangé)`);
    check((await attr(pg, '[data-compta-kpi="mois"]', 'data-eur')) === '25.49', `A ${nom} — dépenses du mois 25,49 € (inchangé)`);
    check((await attr(pg, '[data-compta-resultat]', 'data-compta-resultat')) === '321.52', `A ${nom} — résultat de l'année 321,52 € (inchangé)`);
    // ── la carte URSSAF ne redit pas un « Bénéfice — » : il a sa carte
    const carteMois = await pg.evaluate(() => { const e = document.querySelector('[data-stats-carte="mois"]'); return e ? e.innerText : null; });
    check(carteMois != null && !/Bénéfice/.test(carteMois), `A ${nom} — la carte URSSAF du mois ne redit pas « Bénéfice » (la carte Bénéfice est juste au-dessus)`);
    // ── la micro-entreprise : une question à trancher ⇒ ouverte
    check((await attr(pg, '[data-micro-repli]', 'data-micro-attention')) === '1', `A ${nom} — versement libératoire pas dit ⇒ « Ta micro-entreprise » signale une chose à trancher`);
    check((await attr(pg, '[data-micro-repli]', 'data-micro-repli')) === 'ouvert', `A ${nom} — et elle est ouverte d'elle-même`);
    check(await visible(pg, '[data-micro-vl-question]'), `A ${nom} — la question du versement libératoire est visible`);
    const resume = await pg.evaluate(() => { const s = document.querySelector('[data-micro-repli] > summary'); return s ? s.innerText : ''; });
    check(/à confirmer/i.test(resume), `A ${nom} — le titre replié dit ce qui reste à trancher : « ${resume.replace(/\s+/g, ' ').trim()} »`);
    await pg.locator('[data-micro-vl-choix="non"]').first().click();
    // Sous charge, React peut mettre plus d'une demi-seconde : on attend l'écriture (5 s au plus), sans juger dessus.
    await pg.waitForFunction(() => /"liberatoire":"non"/.test(localStorage.getItem('vrm_micro_options') || ''), null, { timeout: 5000 }).catch(() => {});
    await pg.waitForTimeout(300);
    check((await attr(pg, '[data-micro-repli]', 'data-micro-repli')) === 'ouvert', `A ${nom} — il répond « Non » : le bloc ne se referme pas sous son doigt`);
    const opts = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_micro_options') || 'null'); } catch (_) { return null; } });
    check(!!opts && opts.liberatoire === 'non', `A ${nom} — sa réponse est enregistrée (vrm_micro_options.liberatoire = non)`);
    // ── cibles au doigt
    if (tel) {
      const hauteurs = await pg.evaluate(() => [...document.querySelectorAll('[data-compta-aller], [data-compta-avance] > summary, [data-micro-repli] > summary')].map((e) => Math.round(e.getBoundingClientRect().height)));
      check(hauteurs.length >= 7 && hauteurs.every((h) => h >= 43), `A ${nom} — sommaire et replis ≥ 44 px au doigt : ${hauteurs.join(', ')}`);
    }
    // ── le sommaire mène à « Avancé » et l'ouvre
    await pg.locator('[data-compta-aller="compta-avance"]').first().click();
    await pg.waitForTimeout(700);
    check((await attr(pg, '[data-compta-avance]', 'data-compta-avance')) === 'ouvert', `A ${nom} — « Avancé » du sommaire ouvre le repli`);
    check(await visible(pg, '[data-compta-resultat]'), `A ${nom} — le résultat de l'année apparaît une fois « Avancé » ouvert`);
    check(await visible(pg, '[data-fe-etat]'), `A ${nom} — la facturation électronique est là, en bas`);
    check(!(await deborde(pg)), `A ${nom} — aucun débordement horizontal`);
    check(!errs.length, `A ${nom} — aucune erreur JavaScript${errs.length ? ' : ' + errs[0].slice(0, 160) : ''}`);
  });
  await ctx.close();
}

async function scenarioB(b, vp, sombre) {
  const nom = `${vp.width}${sombre ? ' sombre' : ' clair'}`;
  const errs = [];
  const { ctx, pg } = await page(b, vp, sombre, true, errs);
  await essaie(`B ${nom}`, async () => {
    await ouvrir(pg, 'compta');
    await pg.locator('[data-micro-repli]').first().waitFor({ timeout: 40000 });
    await pg.waitForTimeout(1500);
    check((await attr(pg, '[data-micro-repli]', 'data-micro-attention')) !== '1', `B ${nom} — versement libératoire déjà dit : rien à trancher`);
    check((await attr(pg, '[data-micro-repli]', 'data-micro-repli')) === 'ferme', `B ${nom} — « Ta micro-entreprise » reste repliée`);
    check(!(await visible(pg, '[data-micro-profil]')), `B ${nom} — son profil URSSAF n'occupe pas l'écran`);
    check(await visible(pg, '[data-echeance-apayer]'), `B ${nom} — l'échéance URSSAF reste visible au-dessus`);
    check(!errs.length, `B ${nom} — aucune erreur JavaScript${errs.length ? ' : ' + errs[0].slice(0, 160) : ''}`);
  });
  await ctx.close();
}

async function scenarioC(b, vp, sombre) {
  const nom = `${vp.width}${sombre ? ' sombre' : ' clair'}`;
  const errs = [];
  const { ctx, pg, tel } = await page(b, vp, sombre, true, errs);
  await essaie(`C ${nom}`, async () => {
    await ouvrir(pg, 'journee');
    await pg.waitForTimeout(2500);
    if (tel) {
      await pg.locator('.vrm-tabbar').getByRole('button', { name: 'Gestion', exact: true }).click();
      await pg.getByRole('menuitem', { name: 'Comptabilité', exact: true }).waitFor({ timeout: 8000 });
      check(await pg.getByRole('menuitem', { name: 'Comptabilité', exact: true }).isVisible(), `C ${nom} — le menu Gestion s'ouvre (Comptabilité y est)`);
      check((await pg.getByRole('menuitem', { name: 'Organisation', exact: true }).count()) === 0, `C ${nom} — « Organisation » n'est plus dans le menu Gestion`);
      await pg.keyboard.press('Escape');
    } else {
      check((await pg.locator('.vrm-sidebar').getByRole('button', { name: 'Comptabilité', exact: true }).count()) === 1, `C ${nom} — le rail porte Comptabilité`);
      check((await pg.locator('.vrm-sidebar').getByRole('button', { name: 'Organisation', exact: true }).count()) === 0, `C ${nom} — « Organisation » n'est plus dans le rail`);
    }
    await ouvrir(pg, 'settings');
    await pg.locator('[data-reglage-organisation]').first().waitFor({ timeout: 10000 });
    await pg.locator('[data-reglage-organisation]').first().click();
    // L'écran (au téléphone son titre est celui de l'en-tête de l'app : on vise la section).
    const ecran = pg.locator('section.vrm-operations[aria-label="Organisation"]');
    await ecran.waitFor({ timeout: 10000 });
    check(await ecran.isVisible() && await pg.getByRole('button', { name: 'Réservations', exact: true }).isVisible(), `C ${nom} — Réglages → Stock et rangement → Organisation l'ouvre`);
    await ouvrir(pg, 'organisation');
    await ecran.waitFor({ timeout: 10000 });
    check(await ecran.isVisible(), `C ${nom} — ?tab=organisation marche toujours`);
    check(!(await deborde(pg)), `C ${nom} — aucun débordement horizontal`);
    check(!errs.length, `C ${nom} — aucune erreur JavaScript${errs.length ? ' : ' + errs[0].slice(0, 160) : ''}`);
  });
  await ctx.close();
}

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const TEL = { width: 390, height: 844 }, ORDI = { width: 1512, height: 950 };
  try {
    await scenarioA(b, TEL, false);
    await scenarioA(b, ORDI, true);
    await scenarioB(b, TEL, false);
    await scenarioB(b, ORDI, true);
    await scenarioC(b, TEL, false);
    await scenarioC(b, ORDI, true);
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
