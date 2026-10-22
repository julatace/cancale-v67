// ═══════════════════════════════════════════════════════════════════════════
// BANC : L'HEURE LIMITE D'ENVOI SUR LA LIGNE DU COLIS — COLIS ET MA JOURNÉE
//        (node scripts/bancs/colis-heure.cjs — après `npm run build`)
// ═══════════════════════════════════════════════════════════════════════════
// Mesuré le 22 octobre sur sa base : 204 bordereaux sur 205 donnent une HEURE
// limite (90 à « 10 h 00 ») et l'app la jetait (jour seul, 23:59) — « avant
// demain 10 h » s'affichait « à poster demain », et une limite « aujourd'hui
// 7 h » restait « aujourd'hui » toute la journée.
// Ce banc rend l'app sur UN compte INVENTÉ (aucune fixture : il vit dans le
// dépôt, qui est public), horloge du navigateur posée au 22 octobre 2026 à
// 8 h 10 (Paris), aux deux tailles (390 px tactile et 1512 px) :
//   9201 bordereau « 23/10/2026 10 h 00 »  → « à poster avant demain 10 h »
//   9202 bordereau « 22/10/2026 07 h 00 »  → EN RETARD (passé à 7 h)
//   9203 bordereau « 22/10/2026 » (sans heure) → « à poster aujourd'hui » (jour seul)
//   9204 aucun bordereau, vendue le 20     → limite ESTIMÉE (vente + 7 j)
// Il exige : sur Colis, la phrase de chaque carte et l'état porté (heure,
// limite estimée, jours) ; sur Ma journée, une ligne qui dit l'heure du plus
// pressé (« en retard — c'était avant 7 h aujourd'hui ») et compte les 3
// pressés. On juge l'état porté (`data-*`) ET la phrase rendue — ici, la
// phrase EST la chose demandée (l'heure écrite sur la ligne).
// Ports : 6301 (BANC_PORT pour en changer).
// `_meta.cjs` pose la porte des bancs (`_porte-banc.cjs`) sur `require('playwright')` :
// le MÊME module doit être pris ici (un chemin absolu en donnerait un autre, sans
// la porte — l'app resterait sur l'écran de connexion).
const { metaVersData } = require('./_meta.cjs');
const { chromium } = require('playwright');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 6301;

const MAINTENANT = Date.parse('2026-10-22T06:10:00Z');   // jeudi, 8 h 10 à Paris
const iso = (t) => new Date(t).toISOString();
const V = {
  9201: { titre: 'Kilo Runner taille 42', date: '2026-10-15T22:49:32Z', limite: '23/10/2026 10 h 00' },
  9202: { titre: 'Lima Runner taille 41', date: '2026-10-15T05:00:00Z', limite: '22/10/2026 07 h 00' },
  9203: { titre: 'Mike Runner taille 40', date: '2026-10-15T08:00:00Z', limite: '22/10/2026' },
  9204: { titre: 'November Runner taille 43', date: '2026-10-20T09:00:00Z', limite: null },
};
const VENTES = Object.entries(V).map(([tx, v], i) => ({
  transaction_id: Number(tx), title: v.titre, price: { amount: String(40 + i * 5), currency_code: 'EUR' },
  status: 'Bordereau envoyé au vendeur', transaction_user_status: 'needs_action', date: v.date,
}));
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: iso(MAINTENANT) }];
const PDF_B64 = fs.readFileSync(path.join(__dirname, 'bordereau-test.b64'), 'utf8').trim();
const ROWS = [
  { id: 'main', data: {} },
  ...Object.entries(V).filter(([, v]) => v.limite).map(([tx, v]) => ({ id: 'email_bord_banc_' + tx, data: {
    transaction: tx, filename: `Bordereau-Vinted-${tx}.pdf`, modele: v.titre, article: v.titre, receivedAt: iso(MAINTENANT - 5 * 86400000), dateLimite: v.limite, pdfB64: PDF_B64 } })),
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(MAINTENANT - 600000), payload: { my_orders: VENTES } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: iso(MAINTENANT - 600000), payload: { my_orders: [] } } },
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
// Un banc ne meurt pas, il rapporte : ce qui lève devient un contrôle ROUGE.
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
// Projection PostgREST minimale : `alias:data->>champ` (§6.3).
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

async function preparer(b, vp) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}), timezoneId: 'Europe/Paris' });
  const pg = await ctx.newPage();
  // L'horloge du navigateur : le 22 octobre à 8 h 10 (Paris). Les minuteurs
  // tournent normalement, seule la date est figée.
  await pg.clock.setFixedTime(new Date(MAINTENANT));
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: iso(MAINTENANT), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs };
}

async function sain(pg, ecran) {
  const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, t: document.body.innerText }));
  dit(r.sw <= r.cw + 1, `${ecran} : aucun débordement horizontal`, `${r.sw} > ${r.cw}`);
  const m = /n'a pas pu s'afficher|n’a pas pu s’afficher|Cannot access|is not defined/.exec(r.t);
  dit(!m, `${ecran} : l'écran n'est pas tombé sur le garde-fou`, m && m[0]);
}

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      console.log(`── ${vp.width} px`);
      const { ctx, pg, errs } = await preparer(b, vp);

      await essaie('Colis', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
        await pg.waitForFunction((n) => document.querySelectorAll('[data-bord-card]').length >= n, 4, { timeout: 15000 }).catch(() => {});
        await pg.waitForTimeout(800);
        const c = await pg.evaluate((V) => {
          const out = {};
          for (const el of document.querySelectorAll('[data-bord-card]')) {
            const txt = el.innerText || '';
            const tx = Object.keys(V).find((k) => txt.includes(V[k].titre));
            if (tx) out[tx] = { txt, heure: el.getAttribute('data-limite-heure'), limite: el.getAttribute('data-limite'), jours: el.getAttribute('data-jours') };
          }
          return out;
        }, V);
        const t = (tx) => (c[tx] ? c[tx].txt.replace(/\s+/g, ' ') : '');
        dit(Object.keys(c).length === 4, 'Colis : les 4 ventes à poster ont leur carte', JSON.stringify(Object.keys(c)));
        dit(!!c[9201] && c[9201].heure === '10:00' && /à poster avant demain 10 h/.test(t(9201)), '9201 : « à poster avant demain 10 h » (l’heure lue dans l’email)', c[9201] ? `${c[9201].heure} · ${(t(9201).match(/à poster[^·]*/) || [''])[0]}` : 'carte absente');
        dit(!!c[9202] && c[9202].jours !== '' && Number(c[9202].jours) < 0 && /en retard — c'était avant 7 h aujourd'hui/.test(t(9202)), '9202 : limite « aujourd’hui 7 h » passée à 8 h 10 ⇒ EN RETARD, et l’heure est dite', c[9202] ? `jours=${c[9202].jours} · ${(t(9202).match(/(en retard[^·]*|à poster[^·]*|\d+ j de retard)/) || [''])[0]}` : 'carte absente');
        dit(!!c[9203] && c[9203].heure === '' && c[9203].jours === '0' && /à poster aujourd'hui/.test(t(9203)) && !/avant \d+ h/.test(t(9203)), '9203 : sans heure ⇒ le jour seul, « à poster aujourd’hui » (comme avant)', c[9203] ? `jours=${c[9203].jours} · heure=${c[9203].heure}` : 'carte absente');
        dit(!!c[9204] && c[9204].limite === 'estimee' && c[9204].jours === '5', '9204 : sans bordereau, limite ESTIMÉE (vendue le 20 ⇒ le 27, dans 5 jours)', c[9204] ? `limite=${c[9204].limite} · jours=${c[9204].jours}` : 'carte absente');
        await pg.screenshot({ path: path.join(os.tmpdir(), 'colis-heure-colis-' + vp.width + '.png'), fullPage: true }).catch(() => {});
        await sain(pg, 'Colis');
      });

      await essaie('Ma journée', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await pg.waitForFunction(() => { const t = document.querySelector('[data-tuile="envoyer"]'); return t && t.getAttribute('data-n') !== ''; }, null, { timeout: 15000 }).catch(() => {});
        await pg.waitForTimeout(800);
        const j = await pg.evaluate(() => {
          const t = document.querySelector('[data-tuile="envoyer"]');
          const l = document.querySelector('[data-job="colis-limite"]');
          return { n: t ? t.getAttribute('data-n') : null, job: l ? { n: l.getAttribute('data-n'), heure: l.getAttribute('data-limite-heure'), txt: (l.innerText || '').replace(/\s+/g, ' ') } : null };
        });
        dit(j.n === '4', 'Ma journée : « À envoyer » vaut 4', 'lu ' + j.n);
        dit(!!j.job && j.job.n === '3', 'Ma journée : une ligne compte les 3 colis pressés (en retard, aujourd’hui, demain) — pas le 4ᵉ, dû dans 5 jours', JSON.stringify(j.job));
        dit(!!j.job && j.job.heure === '07:00' && /en retard — c'était avant 7 h aujourd'hui/.test(j.job.txt) && /Lima Runner/.test(j.job.txt), 'Ma journée : la ligne dit l’heure du plus pressé et le nomme (« en retard — c’était avant 7 h aujourd’hui »)', j.job ? j.job.txt.slice(0, 160) : 'ligne absente');
        await pg.screenshot({ path: path.join(os.tmpdir(), 'colis-heure-journee-' + vp.width + '.png'), fullPage: true }).catch(() => {});
        await sain(pg, 'Ma journée');
      });
      dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 200));
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ heure limite des colis : ${ko} rouge(s)` : '\n✅ heure limite des colis : tout est vert');
  process.exit(ko ? 1 : 0);
})();
