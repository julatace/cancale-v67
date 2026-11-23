// ════════════════════════════════════════════════════════════════════════════
//  BANC « ARGENT → MOIS DIT LES VENTES À DATER » (22 nov., chasse aux bugs P1-4)
//    node scripts/bancs/argent-mois-adater.cjs            (BANC_DIST=<dist> pour juger un autre build)
//  Chez lui, 41 ventes finalisées de juillet et 46 d'août n'avaient pas de date de versement lue : elles ne sont dans
//  AUCUN mois (§5, CA daté au versement) et la barre de juillet se lisait « presque rien » sans le dire.
//  Le banc pose, dans la publication `vinted_urssaf_mois` de l'appareil, 41 ventes à dater vendues il y a 4 mois
//  (`aDater.parMois`) et vérifie sur la barre de CE mois-là : « au moins » + « 41 à dater » (data-arg-m6-adater) ; les
//  autres mois passés n'en portent pas. Un build d'avant (sans la règle) est ROUGE.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), http = require('http'), os = require('os');
require('./_porte-banc.cjs');
const { chromium } = require('playwright');
const { fabriquer, repondre } = require('./_base-volume.cjs');
const R = path.join(__dirname, '..', '..');
const DIST = process.env.BANC_DIST || path.join(R, 'dist');
const SORTIE = process.env.SORTIE || path.join(os.tmpdir(), 'vrm-bancs', 'argent-mois-adater');
fs.mkdirSync(SORTIE, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm', '.mjs': 'text/javascript', '.png': 'image/png' };
const srv = http.createServer((q, r) => { let f = decodeURIComponent((q.url || '/').split('?')[0]); if (f === '/' || !path.extname(f)) f = '/index.html'; const p = path.join(DIST, f); if (!p.startsWith(DIST) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); });
let ko = 0, ok = 0;
const dit = (b, q, d = '') => { if (b) ok++; else ko++; console.log((b ? '  ✅ ' : '  ❌ ') + q + (d ? ' — ' + d : '')); };
(async () => {
  await new Promise((r) => srv.listen(0, r)); const U = 'http://localhost:' + srv.address().port;
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const W of [390, 1512]) {
      const base = fabriquer({ volumeReel: true, annonces: 1000 });
      const ctx = await nav.newContext({ viewport: { width: W, height: W < 600 ? 844 : 950 }, isMobile: W < 600, hasTouch: W < 600, locale: 'fr-FR', serviceWorkers: 'block' });
      const pg = await ctx.newPage();
      await pg.addInitScript(() => { localStorage.setItem('vrm_acces_direct', '1'); });
      await pg.route(/^https?:\/\/(?!localhost)/, (r) => (/supabase/.test(r.request().url()) ? r.fallback() : r.abort()));
      await pg.route('**/rest/v1/**', async (route) => { const rq = route.request(); if (rq.method() !== 'GET') return route.fulfill({ status: 201, body: '[]', contentType: 'application/json' }); const h = await rq.allHeaders(); const rep = repondre(rq.url(), h.range, base); route.fulfill({ status: rep.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', ...(rep.headers || {}) }, body: JSON.stringify(rep.body) }); });
      await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: /abonnement/.test(r.request().url()) ? '{"ok":true,"acces":true,"statut":"active","configure":true}' : '{"pret":true,"devices":1}' }));
      // La publication est faite par Ventes : on l'y laisse se poser, puis on y ajoute les ventes à dater.
      await pg.goto(U + '/?tab=ventes'); await pg.waitForTimeout(12000);
      const d = new Date(); const de = new Date(d.getFullYear(), d.getMonth() - 4, 1);
      const ym = `${de.getFullYear()}-${String(de.getMonth() + 1).padStart(2, '0')}`;
      const de2 = new Date(d.getFullYear(), d.getMonth() - 2, 1);
      const ym2 = `${de2.getFullYear()}-${String(de2.getMonth() + 1).padStart(2, '0')}`;   // un mois qui a reçu de l'argent
      const pose = await pg.evaluate(([ym, ym2]) => {
        let v = null; try { v = JSON.parse(localStorage.getItem('vinted_urssaf_mois') || 'null'); } catch (_) {}
        if (!v || typeof v !== 'object') return 'pas de publication';
        const t = Date.parse(ym + '-15T12:00:00');
        v.aDater = { ...(v.aDater || {}), n: 46, ca: 1380, de: t, a: Date.parse(ym2 + '-15T12:00:00'), parMois: { [ym]: 41, [ym2]: 5 } };
        localStorage.setItem('vinted_urssaf_mois', JSON.stringify(v));
        window.dispatchEvent(new CustomEvent('vrm:save', { detail: { k: 'vinted_urssaf_mois' } }));
        return 'ok';
      }, [ym, ym2]);
      dit(pose === 'ok', `${W} px : la publication de Ventes est là`, pose);
      await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=compta' }))); await pg.waitForTimeout(5000);
      // Ventes ne doit pas republier par-dessus pendant le jugement : on relit la barre.
      const b = await pg.evaluate(([ym, ym2]) => {
        const li = document.querySelector(`[data-arg-m6="${ym}"]`), li2 = document.querySelector(`[data-arg-m6="${ym2}"]`);
        const autres = [...document.querySelectorAll('[data-arg-m6]')].filter((x) => ![ym, ym2].includes(x.getAttribute('data-arg-m6')) && !x.hasAttribute('data-courant'));
        return li ? { txt: li.innerText.replace(/\s+/g, ' '), ad: li.getAttribute('data-arg-m6-adater'), partiel: li.getAttribute('data-arg-m6-partiel'), autresAD: autres.filter((x) => x.hasAttribute('data-arg-m6-adater')).length,
          txt2: li2 ? li2.innerText.replace(/\s+/g, ' ') : '', v2: li2 ? li2.getAttribute('data-arg-m6-v') : '', ad2: li2 ? li2.getAttribute('data-arg-m6-adater') : null } : null;
      }, [ym, ym2]);
      await pg.screenshot({ path: path.join(SORTIE, `mois-${W}.png`) });
      dit(!!b, `${W} px : la barre du mois ${ym} est rendue`);
      if (b) {
        dit(b.ad === '41' && /41 à dater/.test(b.txt), `${W} px : la barre dit « 41 à dater »`, b.txt);
        // Le mois du banc n'a rien reçu (0 €) : « au moins 0 € » ne se dit jamais (§5) ⇒ « — » ; un mois reçu ⇒ « au moins ».
        dit(b.partiel === '1' && (/au moins [1-9]/.test(b.txt) || (/—/.test(b.txt) && !/au moins 0/.test(b.txt))), `${W} px : et son montant est un minimum dit (« au moins N € », ou « — » à 0 €), jamais « au moins 0 € »`, b.txt);
        if (Number(b.v2) > 0) dit(b.ad2 === '5' && /au moins [1-9]/.test(b.txt2) && /5 à dater/.test(b.txt2), `${W} px : un mois qui a reçu de l'argent dit « au moins N € · 5 à dater »`, b.txt2);
        else dit(false, `${W} px : la base du banc a de l'argent reçu en ${ym2}`, b.txt2);
        dit(b.autresAD === 0, `${W} px : les autres mois passés n'en portent pas`, String(b.autresAD));
      }
      await ctx.close();
    }
  } finally { await nav.close(); srv.close(); }
  console.log(ko ? `\n❌ argent-mois-adater : ${ko} rouge(s), ${ok} vert(s) — captures ${SORTIE}` : `\n✅ argent-mois-adater : ${ok} verts — captures ${SORTIE}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
