#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  BANC « DRESSING AMÉLIORÉ » (20 nov., ext. 5.410.4) — le VRAI vrm-ui.js + vrm-dressing.js sur une FAUSSE page
//  vinted.fr/member/{id} (aucune donnée réelle, dépôt public). Le fond est simulé à sa frontière (`sendMessage`) avec
//  la règle de `dressingPlus` : le profil d'un AUTRE compte, ou le réglage éteint ⇒ rien. On juge (data-*, jamais un
//  libellé) : la plaque N° par identité d'annonce ; la case ne suit pas le lien ; le tri (prix ↑) et le filtre
//  (sauvegardées) ; la barre (Sauvegardes, Planifications, Stock auto ; Planifier, Modifier, Republier, Supprimer) ;
//  Supprimer demande SA confirmation et rien ne part avant ; autre profil / éteint ⇒ aucune plaque, aucune barre.
//  390 px tactile et 1512 px ; captures dans `captures/dressing-ameliore`.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const RACINE = path.join(__dirname, '..', '..');
const EXT = path.join(RACINE, 'vinted-sync-extension');
const SORTIE = process.env.BANC_CAPTURES ? path.join(process.env.BANC_CAPTURES, 'dressing-ameliore') : path.join(__dirname, 'captures', 'dressing-ameliore');
fs.mkdirSync(SORTIE, { recursive: true });
const UI = fs.readFileSync(path.join(EXT, 'vrm-ui.js'), 'utf8'), DP = fs.readFileSync(path.join(EXT, 'vrm-dressing.js'), 'utf8');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d ? ' — ' + String(d).slice(0, 300) : '')); } };
const ITEMS = [['7001', 'Nike Air Max 90', 60], ['7002', 'Adidas Samba OG', 45], ['7003', 'New Balance 550', 80], ['7004', 'Puma Suede', 30]];
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;font:15px system-ui;background:#fff}.grille{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;padding:16px}.c a{display:block;color:#111;text-decoration:none}.c .img{height:180px;background:#e9eef3;border-radius:8px}</style></head><body><h1 style="padding:0 16px">shop_sophie</h1><div class="grille" data-testid="grid">${ITEMS.map(([id, t, p]) => `<div class="c" data-banc-id="${id}"><a href="/items/${id}-${t.toLowerCase().replace(/\s+/g, '-')}"><div class="img"></div><div>${t}</div><div>${p},00 €</div></a></div>`).join('')}</div></body></html>`;
const PLUS = { ok: true, actif: true, uid: '111', tri: 'prix_bas', filtre: 'toutes', nums: { 7001: '12', 7002: '13', 7003: 'B125' }, sauve: ['7001', '7003'],
  stats: { 7001: { vues: 30, favoris: 4, prix: 60, cree: 3 }, 7002: { vues: 10, favoris: 1, prix: 45, cree: 2 }, 7003: { vues: 50, favoris: 9, prix: 80, cree: 1 }, 7004: { vues: 5, favoris: 0, prix: 30, cree: 4 } }, stock: {} };
async function ouvrir(nav, { largeur, mobile, membre = '111', plus = PLUS }) {
  const ctx = await nav.newContext(Object.assign({ viewport: { width: largeur, height: 820 } }, mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}));
  const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e)));
  await pg.route('**/*', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: PAGE }));
  await pg.addInitScript(({ plus }) => {
    window.__envoyes = []; window.__ouverts = []; window.open = (u) => { window.__ouverts.push(String(u)); return null; };
    const orig = Element.prototype.attachShadow; Element.prototype.attachShadow = function (o) { return orig.call(this, Object.assign({}, o, { mode: 'open' })); };
    window.chrome = { runtime: { id: 'ext', lastError: null, getURL: (p) => location.origin + '/' + p, sendMessage: (msg, cb) => {
      window.__envoyes.push(JSON.parse(JSON.stringify(msg)));
      let rep = { ok: false };
      // La règle de `dressingPlus` à la frontière : le profil du compte de l'onglet (111) seulement, et réglage allumé.
      if (msg.action === 'dressingPlus') rep = msg.membre !== '111' ? { ok: true, actif: false, raison: 'autre-profil' } : JSON.parse(JSON.stringify(plus));
      if (msg.action === 'dressingAction') rep = msg.confirme === true ? { ok: true } : { ok: false, code: 'confirmation' };
      setTimeout(() => cb && cb(rep), 5);
    } } };
  }, { plus });
  await pg.goto(`https://www.vinted.fr/member/${membre}-shop`);
  await pg.addScriptTag({ content: UI }); await pg.addScriptTag({ content: DP });
  await pg.waitForTimeout(700);
  return { ctx, pg, erreurs };
}
const lire = (pg) => pg.evaluate(() => {
  const ordre = [...document.querySelectorAll('[data-banc-id]')].filter((x) => x.style.display !== 'none').map((x) => x.getAttribute('data-banc-id'));
  const nums = Object.fromEntries([...document.querySelectorAll('[data-vrm-dp]')].map((x) => [x.getAttribute('data-vrm-dp'), (x.querySelector('[data-vrm-dp-num]') || { getAttribute: () => '' }).getAttribute('data-vrm-dp-num')]));
  const h = document.getElementById('vrm-dressing'); const r = h && h.shadowRoot;
  return { ordre, nums, barre: !!r, n: r ? Number((r.querySelector('[data-dp-barre]') || { getAttribute: () => -1 }).getAttribute('data-dp-barre')) : -1, boutons: r ? [...r.querySelectorAll('[data-dp]')].map((b) => b.getAttribute('data-dp') + (b.disabled ? '-' : '+')) : [], confirme: r ? !!r.querySelector('[data-dp-confirme]') : false, envoyes: window.__envoyes.filter((m) => m.action === 'dressingAction'), url: location.pathname };
});
(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  for (const [largeur, mobile] of [[1512, false], [390, true]]) {
    const T = String(largeur);
    const { ctx, pg, erreurs } = await ouvrir(nav, { largeur, mobile });
    let a = await lire(pg);
    dit(a.nums['7001'] === '12' && a.nums['7003'] === 'B125' && a.nums['7004'] === '', `${T} : la plaque N° de CHAQUE annonce par son identité (sans N° : une case seule)`, JSON.stringify(a.nums));
    dit(a.ordre.join(',') === '7004,7002,7001,7003', `${T} : tri « prix croissant » appliqué à l’affichage`, a.ordre.join(','));
    dit(a.barre && a.n === 0 && a.boutons.join(' ') === 'sauvegardes+ planifications+ stock- planifier- modifier- republier- supprimer-', `${T} : la barre en bas, actions de sélection grisées sans sélection`, a.boutons.join(' '));
    await pg.screenshot({ path: path.join(SORTIE, `dressing-${T}.png`) });
    await pg.click('[data-vrm-dp-case="7002"]'); await pg.click('[data-vrm-dp-case="7004"]'); await pg.waitForTimeout(150);
    a = await lire(pg);
    dit(a.url === '/member/111-shop' && a.n === 2 && a.boutons.includes('supprimer+') && a.boutons.includes('modifier-'), `${T} : toucher la case choisit l’annonce sans suivre son lien ; 2 choisies`, JSON.stringify(a));
    const sh = (sel) => pg.evaluate((s) => { const b = document.getElementById('vrm-dressing').shadowRoot.querySelector(s); if (b) b.click(); return !!b; }, sel);
    await sh('[data-dp="supprimer"]'); await pg.waitForTimeout(120);
    a = await lire(pg);
    await pg.screenshot({ path: path.join(SORTIE, `dressing-confirme-${T}.png`) });
    dit(a.confirme && a.envoyes.length === 0, `${T} : Supprimer demande SA confirmation ; rien ne part avant`, JSON.stringify(a.envoyes));
    await sh('[data-dp-oui]'); await pg.waitForTimeout(200);
    a = await lire(pg);
    dit(a.envoyes.length === 1 && a.envoyes[0].quoi === 'supprimer' && a.envoyes[0].confirme === true && a.envoyes[0].ids.join(',') === '7002,7004' && a.envoyes[0].membre === '111', `${T} : confirmé : la suppression part au fond (chemin gardé), SES deux annonces, SON profil`, JSON.stringify(a.envoyes));
    await sh('[data-dp="planifications"]');
    const ouv = await pg.evaluate(() => window.__ouverts.slice());
    dit(ouv.some((u) => /vrm\.center\/.*programme/.test(u)), `${T} : « Planifications » ouvre VRM`, JSON.stringify(ouv));
    dit(!erreurs.length, `${T} : aucune erreur de page`, erreurs.join(' | '));
    await ctx.close();
    // Filtre « sauvegardées ».
    const f = await ouvrir(nav, { largeur, mobile, plus: Object.assign({}, PLUS, { filtre: 'sauvegardees', tri: 'recentes' }) });
    a = await lire(f.pg);
    dit(a.ordre.join(',') === '7001,7003', `${T} : filtre « sauvegardées » : seules les annonces au coffre restent affichées`, a.ordre.join(','));
    await f.ctx.close();
    // Autre profil ; réglage éteint.
    const o = await ouvrir(nav, { largeur, mobile, membre: '222' });
    a = await lire(o.pg);
    dit(!a.barre && !Object.keys(a.nums).length, `${T} : le dressing d’un AUTRE compte : ni plaque ni barre`, JSON.stringify(a));
    await o.pg.screenshot({ path: path.join(SORTIE, `dressing-autre-${T}.png`) });
    await o.ctx.close();
    const e = await ouvrir(nav, { largeur, mobile, plus: { ok: true, actif: false, raison: 'eteint' } });
    a = await lire(e.pg);
    dit(!a.barre && !Object.keys(a.nums).length, `${T} : réglage éteint (par défaut) : rien`, JSON.stringify(a));
    await e.ctx.close();
  }
  await nav.close();
  console.log(`\n${ko ? '❌' : '✅'} dressing-ameliore : ${ok} contrôles, ${ko} rouge(s) — captures : ${SORTIE}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
