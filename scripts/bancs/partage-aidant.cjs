// ═══════════════════════════════════════════════════════════════════════════
// BANC : LA PAGE DE L'AIDANT (16 nov., lot partage-aidant) — `/?aidant=<jeton>`
//        (node scripts/bancs/partage-aidant.cjs — après le build ; BANC_PORT, BANC_DIST, SHOTS)
// ═══════════════════════════════════════════════════════════════════════════
// Données INVENTÉES. La route `/api/compte?mode=aidant` est servie à la forme de
// api/_lib/aidant-lien.js (200 : { ok, exp, vue: { items: [{ num, lieu, titre, photo }] } } ;
// 410 expiré/révoqué ; 503 panne). À 390 px tactile (clair, sombre) et 1512 :
//   · la liste : chaque N° avec son lieu ; la recherche « case 3 » ne garde que les bons ;
//   · AUCUN prix, pseudo, adresse dans la page ; aucune requête d'écriture, aucune autre route ;
//   · lien expiré ou révoqué (410) ⇒ « Ce lien n'est plus valable » (pas de liste) ;
//   · panne (503) ⇒ « Réessayer » ; cibles ≥ 44 px, aucun débordement, aucune erreur.
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 12871;
const SHOTS = process.env.SHOTS || '';
const JETON = 'A'.repeat(32) + '.mi0abcde.' + 'B'.repeat(22);
const ITEMS = [
  { num: '124', lieu: 'Garage · Étagère B · case 3', titre: 'Jordan 1 Mid Chicago 42', photo: '' },
  { num: 'B12', lieu: 'Bureau · Carton 4', titre: 'Asics Gel Kayano 14', photo: '' },
  ...Array.from({ length: 30 }, (_, i) => ({ num: String(200 + i), lieu: `Garage · Étagère C · case ${i % 6}`, titre: `Paire inventée ${i}`, photo: '' })),
];
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d && !c ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.listen(PORT);

async function page(b, vp, { sombre = false, reponse }) {
  const tel = vp.width < 600;
  const ctx = await b.newContext({ viewport: vp, locale: 'fr-FR', colorScheme: sombre ? 'dark' : 'light', ...(tel ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = [], appels = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
  await pg.route('**/rest/v1/**', (r) => { appels.push('rest ' + r.request().method() + ' ' + r.request().url()); return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }); });
  await pg.route('**/api/**', (r) => {
    const u = r.request().url();
    appels.push(r.request().method() + ' ' + u.replace(/^https?:\/\/[^/]+/, ''));
    if (/mode=aidant/.test(u)) return r.fulfill({ status: reponse.status, contentType: 'application/json', body: JSON.stringify(reponse.body) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await pg.goto(`http://localhost:${PORT}/?aidant=${JETON}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => { const e = document.querySelector('[data-vue-aidant]'); return e && e.getAttribute('data-vue-aidant') !== 'encours'; }, null, { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(400);
  return { ctx, pg, errs, appels, tel };
}

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const [vp, sombre] of [[{ width: 390, height: 844 }, false], [{ width: 390, height: 844 }, true], [{ width: 1512, height: 950 }, false]]) {
      const T = `[${vp.width}${sombre ? ' sombre' : ''}]`, suf = `${vp.width}${sombre ? '-sombre' : ''}`;
      console.log('── ' + T);
      let o = await page(b, vp, { sombre, reponse: { status: 200, body: { ok: true, exp: Date.now() + 20 * 3600e3, vue: { items: ITEMS } } } });
      let r = await o.pg.evaluate(() => ({ etat: (document.querySelector('[data-vue-aidant]') || {}).getAttribute && document.querySelector('[data-vue-aidant]').getAttribute('data-vue-aidant'),
        n: document.querySelectorAll('[data-aidant-num]').length, l124: (document.querySelector('[data-aidant-num="124"] [data-aidant-lieu]') || {}).textContent || '',
        texte: document.body.innerText, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
        champ: Math.round((document.querySelector('[data-aidant-cherche]') || { getBoundingClientRect: () => ({ height: 0 }) }).getBoundingClientRect().height) }));
      dit(r.etat === 'lu' && r.n === ITEMS.length && r.l124 === 'Garage · Étagère B · case 3', `${T} la liste : ${ITEMS.length} N°, chacun avec son lieu (case, meuble)`, JSON.stringify({ etat: r.etat, n: r.n, l: r.l124 }));
      dit(!/€|\bprix\b|acheteu|pseudo|rue /i.test(r.texte), `${T} aucun prix, acheteur, pseudo, adresse dans la page`, r.texte.slice(0, 160));
      dit(r.sw <= r.cw + 1 && r.champ >= 44, `${T} aucun débordement, champ de recherche ≥ 44 px`, JSON.stringify({ sw: r.sw, cw: r.cw, champ: r.champ }));
      if (SHOTS) await o.pg.screenshot({ path: path.join(SHOTS, `aidant-liste-${suf}.png`) });
      await o.pg.locator('[data-aidant-cherche]').fill('case 3');
      await o.pg.waitForTimeout(300);
      const f = await o.pg.evaluate(() => [...document.querySelectorAll('[data-aidant-num]')].map((e) => e.getAttribute('data-aidant-num')));
      dit(f.length === 6 && f.includes('124') && f.every((n) => n === '124' || Number(n) >= 200), `${T} « case 3 » : seulement les paires de ces cases`, f.join(','));
      if (SHOTS) await o.pg.screenshot({ path: path.join(SHOTS, `aidant-recherche-${suf}.png`) });
      const ecritures = o.appels.filter((a) => !/^GET \/api\/compte\?mode=aidant&j=/.test(a));
      dit(ecritures.length === 0 && o.appels.length === 1, `${T} une seule requête (GET du lien), aucune écriture, aucune autre route`, o.appels.join(' | '));
      dit(o.errs.length === 0, `${T} aucune erreur`, o.errs.join(' | '));
      await o.ctx.close();
      o = await page(b, vp, { sombre, reponse: { status: 410, body: { erreur: 'lien', raison: 'revoque' } } });
      r = await o.pg.evaluate(() => ({ etat: document.querySelector('[data-vue-aidant]').getAttribute('data-vue-aidant'), n: document.querySelectorAll('[data-aidant-num]').length, t: document.body.innerText }));
      dit(r.etat === 'lien' && r.n === 0 && /plus valable/.test(r.t), `${T} lien révoqué ou expiré (410) : « Ce lien n’est plus valable », aucune liste`, JSON.stringify(r).slice(0, 160));
      if (SHOTS) await o.pg.screenshot({ path: path.join(SHOTS, `aidant-410-${suf}.png`) });
      await o.ctx.close();
      o = await page(b, vp, { sombre, reponse: { status: 503, body: { erreur: 'base' } } });
      r = await o.pg.evaluate(() => ({ etat: document.querySelector('[data-vue-aidant]').getAttribute('data-vue-aidant'), h: Math.round((document.querySelector('[data-aidant-reessayer]') || { getBoundingClientRect: () => ({ height: 0 }) }).getBoundingClientRect().height) }));
      dit(r.etat === 'panne' && r.h >= 44, `${T} panne (503) : « Réessayer » (≥ 44 px), jamais un stock vide`, JSON.stringify(r));
      await o.ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ partage aidant : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ partage aidant : ${ok} vert(s)`);
  process.exit(ko ? 1 : 0);
})();
