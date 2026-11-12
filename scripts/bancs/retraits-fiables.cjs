#!/usr/bin/env node
// BANC (11 nov.) — RETRAITS FIABLES (docs/passation/2026-11-11-retraits-fiables.md). Julien : « Là tu me regroupes
// tout à Super U. Ceux qui ont changé de point relais, tu les mets dans un autre, mais tu ne donnes pas les codes. »
// La vraie app construite, 390 tactile sombre + 1512 clair, des colis INVENTÉS de la vraie forme (lignes
// `email_track_*`) dans plusieurs villes de France (Lille, Marseille, Ajaccio, Saint-Denis de La Réunion) :
//   F1 chaque colis sous SON point ; deux Super U de Lille à deux rues = deux cartes ;
//   F2 un casier au nom seul (« LOCKER 24/7 SUPER U », adresse pas lue) reste seul, jamais avec un autre ;
//   F3 le code se LIT sur la ligne (0 toucher) ;
//   F4 « Point relais changé » montre le code d'un autre e-mail du même n° s'il est daté APRÈS le changement (sinon « à confirmer ») et l'ancien point ;
//   F5 un colis non revu depuis 48 h dit « pas confirmé depuis le … » (ambre), les autres non ;
//   F6 masquer un point laisse sa trace (« 1 point masqué · Afficher »), et le rend d'un toucher.
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 12191);
const SHOTS = process.env.SHOTS || '';
const VUES = process.env.JR_VUES ? process.env.JR_VUES.split(',') : null;
const maintenant = new Date('2026-11-12T09:00:00Z');   // 10 h à Paris
const MS = maintenant.getTime();
const iso = (t) => new Date(t).toISOString();
const Z = (s) => `2026-${s}:00.000Z`;
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(MS) }];
const capFrais = iso(MS - 2 * 3600e3);   // achats de compte_a relus il y a 2 h
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 200)); } };

const iso2 = iso;
const ligne = (carrier, suivi, o) => ({ id: `email_track_${carrier}_${suivi}`, data: { type: 'suivi', carrier, suivi, status: 'available', statusLabel: 'Arrivé au point de retrait', subject: `Votre colis ${suivi} est disponible`, code2: null, qrB64: null, qrUrl: null, qrType: null, consigne: false, account: 'compte_a', artTitle: null, emailAt: Z('11-11T09:00'), receivedAt: Z('11-11T09:01'), arriveLe: Z('11-11T09:00'), limite: '2026-11-16', ...o } });
const LIGNES = [
  { id: 'main', data: {} },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: capFrais, payload: { my_orders: [] } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: capFrais, payload: { my_orders: [] } } },
  ligne('mondialrelay', '41100001', { code: '510001', lieu: 'SUPER U, 12 Rue Exemple, 59000 Lille' }),
  ligne('mondialrelay', '41100002', { code: '510002', lieu: 'SUPER U, 40 Avenue Exemple, 59000 Lille' }),
  ligne('chronopost', 'XW511000003TS', { code: '510003', lieu: 'PRESSE EXEMPLE, 3 Quai Exemple, 13002 Marseille' }),
  ligne('relaiscolis', '4110000400000', { code: '510004', lieu: 'TABAC EXEMPLE, 8 Place Exemple, 20000 Ajaccio' }),
  ligne('chronopost', 'XW511000005TS', { code: '510005', lieu: 'EPICERIE EXEMPLE, 2 Rue Exemple, 97400 Saint-Denis' }),
  ligne('mondialrelay', '41100006', { code: '510006', lieu: 'LOCKER 24/7 SUPER U' }),
  ligne('mondialrelay', '41100007', { code: '510007', lieu: 'LOCKER 24/7 SUPER U' }),
  // un colis vu il y a 4 jours, rien depuis (aucune lecture chez le transporteur) : pas confirmé
  ligne('colissimo', '6A41100000801', { code: '5108', lieu: 'BUREAU DE POSTE EXEMPLE, 4 Rue Exemple, 59000 Lille', emailAt: Z('11-08T09:00'), receivedAt: Z('11-08T09:01'), arriveLe: Z('11-08T09:00'), limite: '2026-11-20' }),
  // point relais changé : l'e-mail du changement n'a pas de code, un autre e-mail du même n° l'a
  { id: 'email_track_mondialrelay_41100009', data: { type: 'suivi', carrier: 'mondialrelay', suivi: '41100009', status: 'transit', statusLabel: 'Point relais changé', subject: 'Votre colis a changé de plan 📍', relaisChange: true, code: null, lieu: 'BAR EXEMPLE, 7 Rue Exemple, 13001 Marseille', ancienLieu: 'TABAC ANCIEN EXEMPLE, 1 Rue Exemple, 13003 Marseille', account: 'compte_a', emailAt: Z('11-11T10:00'), receivedAt: Z('11-11T10:01'), qrB64: null, qrUrl: null, qrType: null } },
  { id: 'email_track_vinted_41100009', data: { type: 'suivi', carrier: 'vinted', suivi: '41100009', status: 'info', statusLabel: 'Mise à jour', subject: 'Ton colis a été déposé', code: '510009', lieu: null, account: 'compte_a', emailAt: Z('11-09T10:00'), receivedAt: Z('11-09T10:01'), qrB64: null, qrUrl: null, qrType: null } },
  // (arbitrage d, revue-colis) même cas, mais l'e-mail du code est daté APRÈS le changement de point : il vaut, il est montré
  { id: 'email_track_mondialrelay_41100010', data: { type: 'suivi', carrier: 'mondialrelay', suivi: '41100010', status: 'transit', statusLabel: 'Point relais changé', subject: 'Votre colis a changé de plan 📍', relaisChange: true, code: null, lieu: 'BAR EXEMPLE, 7 Rue Exemple, 13001 Marseille', ancienLieu: 'TABAC ANCIEN EXEMPLE, 1 Rue Exemple, 13003 Marseille', account: 'compte_a', emailAt: Z('11-11T08:00'), receivedAt: Z('11-11T08:01'), qrB64: null, qrUrl: null, qrType: null } },
  { id: 'email_track_vinted_41100010', data: { type: 'suivi', carrier: 'vinted', suivi: '41100010', status: 'info', statusLabel: 'Mise à jour', subject: 'Ton colis a été déposé', code: '510010', lieu: null, account: 'compte_a', emailAt: Z('11-11T09:30'), receivedAt: Z('11-11T09:31'), qrB64: null, qrUrl: null, qrType: null } },
];
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.mjs': 'text/javascript' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
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
    if (src === 'updated_at') { out[alias] = capFrais; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? (typeof v === 'object' ? JSON.stringify(v) : String(v)) : v);
  }
  return out;
};
const ouvrir = async (b, vp, sombre) => {
  const tel = vp.width < 600;
  const ctx = await b.newContext({ viewport: vp, ...(tel ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_visite_vue', JSON.stringify(true)); } catch (_) {} }, !!sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    if (/api-adresse\.data\.gouv\.fr/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"features":[]}' });
    return ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue();
  });
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    if (route.request().method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    if (!/\/rest\/v1\/app_data/.test(u)) return j([]);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: capFrais, cap: r.data && r.data.capturedAt });
    const filtres = [...u.matchAll(/[?&]data->>([a-zA-Z_]+)=(not\.)?is\.null/g)];
    const passe = (r) => filtres.every(([, k, non]) => ((r.data || {})[k] == null) === !non);
    const inn = /[?&]id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(',').map((x) => x.replace(/^"|"$/g, '')); return j(LIGNES.filter((r) => ids.includes(r.id) && passe(r)).map(forme)); }
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1] && passe(r)).map(forme));
    const lks = [...u.matchAll(/[?&]id=like\.([^&]*)/g)];
    if (lks.length) { const res = lks.map((lk) => new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$')); return j(LIGNES.filter((r) => res.every((re) => re.test(r.id)) && passe(r)).map(forme)); }
    const ors = /[?&]or=\(([^&]*)\)/.exec(u);
    if (ors) { const pats = [...ors[1].matchAll(/id\.like\.([^,)]*)/g)].map((m) => new RegExp('^' + m[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$')); if (pats.length) return j(LIGNES.filter((r) => pats.some((re) => re.test(r.id)) && passe(r)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs };
};

const lire = (pg) => pg.evaluate(() => {
  const pub = JSON.parse(localStorage.getItem('vrm_colis_retirer') || 'null');
  const lignes = [...document.querySelectorAll('.vrm-rpf-ligne[data-cc-carte]')].map((l) => ({
    cle: l.getAttribute('data-cc-carte'), sources: l.getAttribute('data-rp-sources') || '', verifie: l.getAttribute('data-rp-verifie') || '',
    sur: l.getAttribute('data-rp-code-sur') === '1', desaccord: l.getAttribute('data-rp-codes-desaccord') || '',
    code: (l.querySelector('[data-code-retrait]') || { getAttribute: () => '' }).getAttribute('data-code-retrait') || '',
    aVenir: !!l.querySelector('[data-rp-code-a-venir]'), horsCompte: l.hasAttribute('data-hors-compte'),
    verifieTexte: ((l.querySelector('[data-rp-verifie-texte]') || {}).textContent || '').trim(),
    marques: [...l.querySelectorAll('[data-rp-source]')].map((e) => e.textContent.trim()),
    point: ((l.closest('[data-rp-point], [data-relais-point], section, details') || { textContent: '' }).textContent || '').slice(0, 400),
    bouton2: !!l.querySelector('[data-rp-code-desaccord]'),
  }));
  const onglet = document.querySelector('[data-colis-onglet-choix="retirer"]');
  return { pub, lignes, ongletN: (() => { /* (11 nov., lot DJ3) « À retirer » n'a plus d'onglet : le nombre de SA liste (`data-cc-n`) */ const c = document.querySelector('[data-cc-colonne="retirer"]'); return c ? c.getAttribute('data-cc-n') : (onglet ? onglet.getAttribute('data-colis-onglet-n') : null); })(), deb: document.documentElement.scrollWidth - window.innerWidth };
});

(async () => {
  srv.listen(PORT);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch(() => chromium.launch());
  try {
    for (const [vp, sombre, nom] of [[{ width: 390, height: 844 }, true, '390-sombre'], [{ width: 1512, height: 982 }, false, '1512-clair']]) {
      if (VUES && !VUES.includes(nom)) continue;
      console.log(`\n— Achats → À retirer, chaque colis à SON point · ${nom}`);
      const { ctx, pg, errs } = await ouvrir(b, vp, sombre);
      await essaie('retirer', async () => {
        await pg.locator('[data-colis-section]').first().waitFor({ timeout: 40000 });
        await pg.waitForTimeout(1500);
        await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=retraits' })));
        await pg.locator('[data-colis-section="achats"]').first().waitFor({ timeout: 30000 });
        await pg.waitForSelector('.vrm-rpf-ligne[data-cc-carte]', { timeout: 20000 }).catch(() => {});
        await pg.waitForTimeout(800);
        const lire2 = () => pg.evaluate(() => [...document.querySelectorAll('.vrm-rpf-ligne[data-cc-carte]')].map((l) => {
          const sec = l.closest('[data-relais-point], [data-relais-point-suite]');
          return { cle: l.getAttribute('data-cc-carte'), point: sec ? (sec.getAttribute('data-relais-point') || sec.getAttribute('data-relais-point-suite')) : '',
            pasLue: !!(sec && sec.querySelector('[data-relais-adresse-pas-lue]')), adr: sec ? ((sec.querySelector('[data-relais-adresse]') || {}).textContent || '') : '',
            visible: (l.querySelector('[data-rp-code-visible]') || { getAttribute: () => '' }).getAttribute('data-rp-code-visible') || '',
            // (intégration journee-perso) le code est ÉCRIT sur la ligne (plus de bouton « Code ») ; « pas confirmé depuis »
            // est la puce ambre de la ligne (les sources et l'heure de vérification sont passées dans le détail ouvert).
            texteCode: ((l.querySelector('[data-rp-code-visible]') || {}).textContent || '').trim(), pasConfirme: !!l.querySelector('[data-rp-pas-confirme="1"]'),
            verifie: ((l.querySelector('[data-rp-pas-confirme="1"]') || l.querySelector('[data-rp-verifie-texte]') || {}).textContent || '').trim() };
        }));
        const m = await lire2();
        const L = (k) => m.find((l) => l.cle.includes(k)) || null;
        const J = (o) => JSON.stringify(o);
        const a = L('41100001'), bb = L('41100002'), mar = L('XW511000003TS'), aj = L('4110000400000'), re = L('XW511000005TS'), l6 = L('41100006'), l7 = L('41100007');
        dit(a && bb && a.point && bb.point && a.point !== bb.point && /12 Rue/.test(a.adr) && /40 Avenue/.test(bb.adr), 'F1 deux Super U de Lille, deux rues ⇒ deux cartes, chacune avec SON adresse', J([a, bb]));
        dit(mar && aj && re && new Set([mar.point, aj.point, re.point, a && a.point]).size === 4 && /13002/.test(mar.adr) && /20000/.test(aj.adr) && /97400/.test(re.adr), 'F1 Marseille, Ajaccio, Saint-Denis : chacun à SON point', J([mar, aj, re].map((x) => x && x.adr)));
        dit(l6 && l7 && l6.point && l7.point && l6.point !== l7.point && l6.pasLue && l7.pasLue && ![a, bb].some((x) => x && (x.point === l6.point || x.point === l7.point)), 'F2 casier « Super U » au nom seul : seul sur sa carte, « Adresse pas lue », jamais avec les Super U de Lille', J([l6, l7]));
        dit([['41100001', '510001'], ['XW511000003TS', '510003'], ['4110000400000', '510004'], ['41100006', '510006']].every(([k, c]) => { const x = L(k); return x && x.visible === c && x.texteCode === c; }), 'F3 le code se lit sur la ligne (sans toucher)', J(m.map((x) => [x.cle, x.texteCode])));
        const al = await pg.evaluate(() => [...document.querySelectorAll('[data-relais-change-suivi]')].map((e) => ({ s: e.getAttribute('data-relais-change-suivi'), code: (e.querySelector('[data-relais-change-code]') || { getAttribute: () => null }).getAttribute('data-relais-change-code'), de: (e.querySelector('[data-relais-change-code-de]') || { getAttribute: () => null }).getAttribute('data-relais-change-code-de'), ancien: ((e.querySelector('[data-relais-change-ancien]') || {}).textContent || '') })));
        const c9 = al.find((x) => x.s === '41100009');
        // (arbitrage d, revue-colis) Le code d'un AUTRE e-mail du même n° n'est montré que s'il est daté APRÈS le changement de
        // point (il pourrait ne plus valoir) ; daté d'avant ⇒ « Code à confirmer », aucun code montré.
        const c10 = al.find((x) => x.s === '41100010');
        dit(c10 && c10.code === '510010' && c10.de === 'autre-email' && /TABAC ANCIEN EXEMPLE/.test(c10.ancien), 'F4 « Point relais changé » : le code d’un autre e-mail du même n°, daté APRÈS le changement, et l’ancien point', J(al));
        dit(c9 && !c9.code && c9.de === 'a-confirmer' && /TABAC ANCIEN EXEMPLE/.test(c9.ancien), 'F4 code d’un autre e-mail daté AVANT le changement ⇒ « Code à confirmer », jamais montré', J(c9));
        const vieux = L('6A41100000801');
        dit(vieux && vieux.pasConfirme && /pas confirmé depuis le 8 nov/.test(vieux.verifie) && a && !a.pasConfirme, 'F5 vu il y a 4 jours, rien depuis ⇒ « pas confirmé depuis le 8 nov. » (ambre) ; un colis vu hier ne l’est pas', J([vieux, a && a.verifie]));
        // (intégration journee-perso — Julien : « des infos dans tous les sens ») Les sources et l'heure de la dernière
        // vérification sont dans le DÉTAIL ouvert de la ligne, plus sur la ligne : on ouvre la ligne et on y lit QUI a vérifié.
        const sansSources = await pg.evaluate(() => { const l = [...document.querySelectorAll('.vrm-rpf-ligne[data-cc-carte]')].find((x) => x.getAttribute('data-cc-carte').includes('41100001')); return !!l && !l.querySelector('[data-rp-detail]') && !l.querySelector('[data-rp-sources-ligne]'); });
        await pg.locator('.vrm-rpf-ligne[data-cc-carte*="41100001"] button[aria-expanded], .vrm-rpf-ligne[data-cc-carte*="41100001"] .vrm-rpf-tap').first().click().catch(() => {});
        await pg.waitForSelector('.vrm-rpf-ligne[data-cc-carte*="41100001"] [data-rp-detail] [data-rp-verifie-texte]', { timeout: 8000 }).catch(() => {});
        const verifDetail = await pg.evaluate(() => { const l = [...document.querySelectorAll('.vrm-rpf-ligne[data-cc-carte]')].find((x) => x.getAttribute('data-cc-carte').includes('41100001')); const v = l && l.querySelector('[data-rp-detail] [data-rp-verifie-texte]'); return v ? v.textContent.trim() : ''; });
        dit(sansSources && /^vérifié par e-mail/.test(verifDetail), 'F7 la ligne fermée ne porte plus ses sources ; ouverte, son détail dit QUI a vérifié en dernier (« vérifié par e-mail … »)', JSON.stringify({ sansSources, verifDetail }));
        const deb = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        dit(deb <= 1, 'rien ne déborde', `${deb}px`);
        if (SHOTS) {
          await pg.evaluate(() => { const e = document.querySelector('.vrm-rpf-ligne[data-cc-carte]'); if (e) e.scrollIntoView({ block: 'start' }); window.scrollBy(0, -140); });
          await pg.waitForTimeout(300); await pg.screenshot({ path: path.join(SHOTS, `retraits-fiables-${nom}.png`) });
          await pg.evaluate(() => { const e = document.querySelector('[data-relais-change-suivi]'); if (e) e.scrollIntoView({ block: 'center' }); });
          await pg.waitForTimeout(300); await pg.screenshot({ path: path.join(SHOTS, `retraits-fiables-change-${nom}.png`) });
        }
        // F6 masquer le point de Marseille : il part, sa trace reste, un toucher le rend
        const btn = pg.locator(`[data-relais-masquer="${mar.point}"]`).first();
        await btn.click();
        await pg.waitForTimeout(400);
        const apres = await lire2();
        const trace = await pg.evaluate(() => { const e = document.querySelector('[data-relais-masques]'); return e ? { n: e.getAttribute('data-relais-masques'), t: e.textContent.trim() } : null; });
        dit(!apres.some((x) => x.cle.includes('XW511000003TS')) && trace && trace.n === '1' && /1 point masqué/.test(trace.t), 'F6 masquer un point : il part, « 1 point masqué · Afficher » reste', J(trace));
        await pg.locator('[data-relais-masques]').first().click();
        await pg.waitForTimeout(400);
        const encore = await lire2();
        dit(encore.some((x) => x.cle.includes('XW511000003TS')) && !(await pg.locator('[data-relais-masques]').count()), 'F6 « Afficher » le rend');
      });
      dit(!errs.length, 'aucune erreur d’app', errs.join(' | ').slice(0, 300));
      await ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
