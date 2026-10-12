// ── BANC : TRADUCTION DES MESSAGES (G35) ────────────────────────────────────
// Un acheteur écrit en anglais : on traduit en français avec le traducteur
// INTÉGRÉ du navigateur (API `Translator`/`LanguageDetector`), SANS clé ni
// serveur (§2.9). Le bouton « 🌐 Traduire » n'apparaît QUE si l'API existe, et
// SEULEMENT sur un message ENTRANT (jamais les miens, jamais un évènement). Un
// message déjà en français n'est pas « traduit » pour rien. Absent ⇒ RIEN (§2.7).
// `Translator` n'existe pas dans le Chromium du banc : on la MOCKE pour prouver
// le câblage (comme le micro, le pont, le presse-papier) — la traduction
// elle-même n'est pas du code de VRM. Données INVENTÉES (vit dans le dépôt).
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4381);
const iso = (h) => new Date(Date.now() - h * 3600000).toISOString();

const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(0) }];
// conv 301 : message ENTRANT en anglais (+ un message À MOI, pas de bouton dessus).
const FIL_EN = { id: 301, opposite_user: { id: 5301, login: 'buyer_uk' }, description: 'Nike Air Max 1',
  messages: [
    { entity_type: 'message', entity: { user_id: 5301, body: 'Hello, are the trainers still available?' }, created_at_ts: Date.now() - 3600000 },
    { entity_type: 'message', entity: { user_id: 1, body: 'Oui, toujours dispo !' }, created_at_ts: Date.now() - 1800000 },
  ] };
// conv 302 : message ENTRANT déjà en français (ne doit pas se « traduire »).
const FIL_FR = { id: 302, opposite_user: { id: 5302, login: 'acheteur_fr' }, description: 'Salomon XT-6',
  messages: [{ entity_type: 'message', entity: { user_id: 5302, body: 'Bonjour, toujours disponible ?' }, created_at_ts: Date.now() - 3600000 }] };
const conv = (id, login, desc, h) => ({ id, unread: true, updated_at: iso(h), description: desc, opposite_user: { id: 5000 + id, login } });
const rows = [
  { id: 'main', data: {} },
  { id: 'harvest_111_inbox', data: { capturedAt: iso(0), payload: { conversations: [conv(301, 'buyer_uk', 'Nike Air Max 1', 3), conv(302, 'acheteur_fr', 'Salomon XT-6', 5)] } } },
  { id: 'harvest_111_conv_301', data: { capturedAt: iso(0), payload: { conversation: FIL_EN } } },
  { id: 'harvest_111_conv_302', data: { capturedAt: iso(0), payload: { conversation: FIL_FR } } },
];

// Mock du traducteur intégré : détecte EN sauf si le texte « sonne » français,
// et traduit en préfixant « [fr] » (une transformation visible, pas du code VRM).
const TRAD = () => {
  window.LanguageDetector = { create: async () => ({ detect: async (t) => [{ detectedLanguage: /bonjour|merci|dispo|toujours dispon/i.test(t) ? 'fr' : 'en', confidence: 0.9 }] }) };
  window.Translator = {
    availability: async () => 'available',
    create: async () => ({ translate: async (t) => '[fr] ' + String(t) }),
  };
};
const SANS_TRAD = () => { try { delete window.Translator; delete window.LanguageDetector; } catch (_) {} };

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
    out[alias] = v == null ? null : v;
  }
  return out;
};

async function preparer(b, vp, avecTrad) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await pg.addInitScript(avecTrad ? TRAD : SANS_TRAD);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data,updated_at/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: iso(0), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=cat_msg`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(3000);
  return { ctx, pg };
}

async function main() {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      const T = vp.width < 600 ? '📱' : '🖥️';

      // ── API présente : bouton sur l'entrant anglais, pas sur le mien ─────────
      await essaie(`${T} présent`, async () => {
        const { ctx, pg } = await preparer(b, vp, true);
        await pg.click('[data-conv="301"]');
        await pg.waitForTimeout(700);
        const nBoutons = await pg.$$eval('[data-traduire]', (els) => els.length);
        dit(nBoutons === 1, `${T} un seul « Traduire » (le message entrant, pas le mien)`, 'boutons=' + nBoutons);
        await pg.click('[data-traduire]');
        await pg.waitForTimeout(400);
        const tr = await pg.evaluate(() => { const e = document.querySelector('[data-traduit]'); return e ? { lang: e.getAttribute('data-traduit'), txt: e.innerText } : null; });
        dit(tr && tr.lang === 'en' && /\[fr\] Hello/.test(tr.txt), `${T} la traduction s'affiche, et dit « traduit de l'anglais »`, tr ? tr.lang + ' : ' + tr.txt.replace(/\s+/g, ' ').slice(0, 60) : 'rien');
        await ctx.close();
      });

      // ── Un message déjà en français n'est pas traduit ───────────────────────
      await essaie(`${T} déjà fr`, async () => {
        const { ctx, pg } = await preparer(b, vp, true);
        await pg.click('[data-conv="302"]');
        await pg.waitForTimeout(700);
        await pg.click('[data-traduire]');
        await pg.waitForTimeout(400);
        const tr = await pg.evaluate(() => { const e = document.querySelector('[data-traduit]'); return e ? { lang: e.getAttribute('data-traduit'), txt: e.innerText } : null; });
        dit(tr && tr.lang === 'fr' && /déjà en français/i.test(tr.txt), `${T} un message déjà en français dit « déjà en français », pas une fausse traduction`, tr ? tr.lang + ' : ' + tr.txt : 'rien');
        await ctx.close();
      });

      // ── API absente : AUCUN bouton (jamais un bouton mort) ──────────────────
      await essaie(`${T} absent`, async () => {
        const { ctx, pg } = await preparer(b, vp, false);
        await pg.click('[data-conv="301"]');
        await pg.waitForTimeout(700);
        const n = await pg.$$eval('[data-traduire]', (els) => els.length);
        dit(n === 0, `${T} sans traducteur intégré, AUCUN bouton « Traduire » (§2.7)`, 'boutons=' + n);
        await ctx.close();
      });
    }
  } finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ traduction des messages : ${ko} rouge(s).` : `\n✅ traduction des messages : tout est vert`);
  process.exit(ko ? 1 : 0);
}
main();
