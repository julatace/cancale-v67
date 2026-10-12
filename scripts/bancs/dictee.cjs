// ── BANC : SAISIE VOCALE (G34) ──────────────────────────────────────────────
// Le micro de dictée (Web Speech) n'apparaît QUE si le navigateur fournit
// l'API — sinon RIEN (Safari iPhone), jamais un bouton mort (§2.7/§2.9). Quand
// il est là et qu'on dicte, le texte reconnu se pose dans le champ.
// `SpeechRecognition` n'existe PAS dans le Chromium du banc : on la MOCKE pour
// prouver le câblage (comme le pont, le presse-papier, le CDN) — la
// reconnaissance elle-même n'est pas du code de VRM.
const { chromium } = require('playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4374);
const auj = new Date();

const ITEMS = [{ id: 9101, title: 'Salomon XT-6 blanc taille 40', brand_title: 'Salomon', price: { amount: '49.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, photo: null, size_title: '40', status: 'Très bon état', view_count: 10, favourite_count: 0, created_at_ts: auj.getTime() - 3 * 86400000, nPhotos: 2 }];
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const rows = [
  { id: 'main', data: { vinted_annonce_numeros: { '9101': { numero: '40' } } } },
  { id: 'harvest_111_listings', data: { capturedAt: auj.toISOString(), payload: { items: ITEMS } } },
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 140)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
srv.listen(PORT);

const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (src.includes('->>') && typeof v === 'object' ? JSON.stringify(v) : v);
  }
  return out;
};

// Mock Web Speech : start() rend un résultat « salomon » puis se termine.
const MOCK = () => {
  window.__SR_LANG = null;
  class MockSR {
    start() { window.__SR_LANG = this.lang; setTimeout(() => { try { this.onresult && this.onresult({ results: [[{ transcript: 'salomon' }]] }); } catch (_) {} try { this.onend && this.onend(); } catch (_) {} }, 40); }
    stop() { try { this.onend && this.onend(); } catch (_) {} }
  }
  window.webkitSpeechRecognition = MockSR;
  window.SpeechRecognition = MockSR;   // le composant lit l'une OU l'autre
};

async function preparer(b, vp, avecMock) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  if (avecMock) await pg.addInitScript(MOCK);
  else await pg.addInitScript(() => { try { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; } catch (_) {} });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data$|^data,/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: auj.toISOString(), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1100);
  return { ctx, pg };
}

async function main() {
  let b;
  try {
    b = await chromium.launch({ executablePath: require('../_chromium.cjs').executablePath(), args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      const T = vp.width < 600 ? '📱' : '🖥️';

      // ── API présente : le micro est là, dicter remplit la recherche ─────────
      await essaie(`${T} présent`, async () => {
        const { ctx, pg } = await preparer(b, vp, true);
        const mic = await pg.$('[data-mic-dictee]');
        dit(!!mic, `${T} le micro de dictée est présent quand le navigateur fournit l’API`);
        if (mic) {
          await mic.click();
          await pg.waitForTimeout(250);
          const val = await pg.$eval('input[placeholder^="Rechercher (titre"]', (el) => el.value);
          dit(val === 'salomon', `${T} dicter pose le texte reconnu dans la recherche`, JSON.stringify(val));
          const lang = await pg.evaluate(() => window.__SR_LANG);
          dit(lang === 'fr-FR', `${T} la reconnaissance écoute en français`, String(lang));
        }
        await ctx.close();
      });

      // ── API absente : aucun bouton mort ─────────────────────────────────────
      await essaie(`${T} absent`, async () => {
        const { ctx, pg } = await preparer(b, vp, false);
        const mic = await pg.$('[data-mic-dictee]');
        dit(!mic, `${T} sans l’API, AUCUN micro (jamais un bouton mort)`, mic ? 'présent à tort' : '');
        await ctx.close();
      });
    }
  } finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ saisie vocale : ${ko} rouge(s).` : `\n✅ saisie vocale : tout est vert`);
  process.exit(ko ? 1 : 0);
}
main();
