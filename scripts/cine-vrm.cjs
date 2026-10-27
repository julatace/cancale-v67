// CINÉ VRM — filme le VRAI app (dist/, le vrai App.jsx) sur des données de
// démo, en vertical 9:16, avec caméra cinématique, fondus et sous-titres
// français incrustés. AUCUNE donnée réelle (ce dépôt est public) : les chiffres
// sont inventés mais aux formes exactes de l'app, donc l'écran est au pixel près
// le vrai écran. Sortie : un .webm (Playwright) transcodé en .mp4 1080×1920
// (ffmpeg fourni par Playwright). Branché sur SES données via l'ordinateur relié
// ou le mode ciné intégré — la fabrication, elle, est ici, de bout en bout.
//
// Lancer : npm run build (si dist/ absent) puis
//   node scripts/cine-vrm.cjs            → écrit scratchpad/vrm-demo.mp4
const path = require('path'), fs = require('fs'), http = require('http');
const { execFileSync } = require('child_process');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
const { metaVersData } = require('./bancs/_meta.cjs');

const DIST = path.join(__dirname, '..', 'dist');
const OUT = process.env.CINE_OUT || path.join(__dirname, '..', '..', '..', 'scratchpad');
const PORT = Number(process.env.CINE_PORT) || 4933;
// Playwright fournit un ffmpeg VP8/WebM uniquement (pas de H.264). Pour sortir
// un .mp4 pour les réseaux, passe un vrai ffmpeg via FFMPEG=/chemin/ffmpeg
// (ex. `npm i ffmpeg-static`). Sinon le .webm est laissé tel quel.
const FFMPEG = process.env.FFMPEG || '/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux';

// ── Données de démo (inventées, formes réelles) ─────────────────────────────
const maintenant = new Date();
const il = (n) => { const d = new Date(maintenant); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
const vente = (id, prix, statut, d) => ({ transaction_id: id, title: 'Paire ' + id, price: { amount: String(prix), currency_code: 'EUR' }, status: statut, date: d.toISOString() });
const V = [
  { o: vente(9101, 59, 'Paiement validé', il(0)), recu: null },
  { o: vente(9102, 85, 'Commande finalisée', il(2)), recu: il(0) },
  { o: vente(9103, 42, 'Commande finalisée', il(20)), recu: il(1) },
  { o: vente(9105, 120, 'Commande finalisée', il(3)), recu: il(0) },
  { o: vente(9106, 70, 'Commande finalisée', il(6)), recu: il(5) },
  { o: vente(9107, 48, 'Commande finalisée', il(9)), recu: il(8) },
  { o: vente(9108, 95, 'Commande finalisée', il(11)), recu: il(10) },
];
const LBC = { A: { txId: 'A', isSeller: true, price: 6500, stepLabel: 'Paiement effectué', dateVente: il(4).toISOString(), title: 'Air Max 1' } };
const EBAY = [{ orderId: 'E1', orderPaymentStatus: 'PAID', creationDate: il(7).toISOString(), pricingSummary: { total: { value: '110.00', currency: 'EUR' } }, paymentSummary: { totalDueSeller: { value: '104.00', currency: 'EUR' } }, totalMarketplaceFee: { value: '6.00', currency: 'EUR' }, lineItems: [{ title: 'Jordan 1' }] }];
const ACCOUNTS = [
  { id: 1, vinted_user_id: '111', login: 'sneaks_fr', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() },
  { id: 2, vinted_user_id: '222', login: 'kickz_resell', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() },
];
const annonce = (uid, n, titre, prix) => ({ id: 'harvest_' + uid + '_listings', data: { capturedAt: maintenant.toISOString(), payload: { items: Array.from({ length: n }, (_, i) => ({ id: Number(uid) * 100 + i, title: titre + ' #' + (i + 1), brand_title: titre.split(' ')[0], price: { amount: String(prix + i), currency_code: 'EUR' }, size_title: 'T4' + (i % 6), status: 'active', is_closed: false, is_hidden: false, is_draft: false, view_count: 30 + i * 7, favourite_count: i % 5 })) } } });
const lignes = [
  annonce('111', 14, 'Adidas Samba', 65), annonce('222', 9, 'Nike Dunk', 90),
  { id: 'harvest_111_orders_sold', data: { capturedAt: maintenant.toISOString(), payload: { my_orders: V.map((x) => x.o) } } },
  { id: 'harvest_222_orders_sold', data: { capturedAt: maintenant.toISOString(), payload: { my_orders: [vente(9201, 55, 'Paiement validé', il(0)), vente(9202, 40, 'Commande finalisée', il(1))] } } },
  { id: 'lbc_ventes', data: { ventes: LBC } },
  { id: 'ebay_orders', data: { orders: EBAY } },
  ...V.filter((x) => x.recu).map((x) => ({ id: 'harvest_111_txn_' + x.o.transaction_id, data: { capturedAt: maintenant.toISOString(), payload: { transaction: { id: x.o.transaction_id, status: 450, status_updated_at: x.recu.toISOString() } } } })),
  { id: 'harvest_111_billing', data: { capturedAt: maintenant.toISOString(), payload: { balance: { amount: '284.50' }, available: { amount: '284.50' }, main: { amount: '284.50' }, escrow: { amount: '612.00' } } } },
];

// ── Le film : des plans (onglet, durée, caméra, sous-titre) ─────────────────
const PLANS = [
  { tab: null, ms: 2600, cap: 'Tu vends sur Vinted, Leboncoin, eBay ?', intro: true },
  { tab: 'journee', ms: 4200, cap: 'VRM réunit tout dans un seul tableau de bord.', cam: { from: 'scale(1.08) translateY(2%)', to: 'scale(1.0) translateY(0)' } },
  { tab: 'journee', ms: 4200, cap: 'Tes ventes et ton argent reçu, jour par jour.', scroll: 520, cam: { from: 'scale(1.02)', to: 'scale(1.06) translateY(-3%)' } },
  { tab: 'dashboard', ms: 4200, cap: 'Tes chiffres, prêts pour l’URSSAF — automatiquement.', cam: { from: 'scale(1.06)', to: 'scale(1.0)' } },
  { tab: null, ms: 3200, cap: 'VRM — l’atelier du revendeur.', outro: true },
];

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('port ' + PORT + ' pris (' + e.code + ')'); process.exit(1); });
srv.listen(PORT);

const mock = async (pg) => {
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', '1'); } catch (_) {} });
  // Coupe tout le réseau externe (déterminisme ; le CDN Vinted ferait expirer le banc).
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    if (route.request().method() === 'POST') return route.fulfill({ status: 201, headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || '';
    const forme = (r) => {
      if (/^[a-z]+:data->[a-z]+$/i.test(sel)) { const [al, src] = sel.split(':'); return { [al]: (r.data || {})[src.split('->')[1]] }; }
      if (/^[a-z]+:data->/i.test(sel)) { const o = {}; for (const champ of sel.split(',')) { const m = /^([a-z]+):data->(.+)$/i.exec(champ); if (!m) continue; let v = r.data; for (const p of m[2].split(/->>?/)) v = v == null ? v : v[p]; o[m[1]] = (v != null && /->>/.test(m[2])) ? String(v) : v; } return o; }
      return { ...r, updated_at: maintenant.toISOString(), cap: r.data.capturedAt };
    };
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(lignes.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(lignes.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
};

// La couche ciné (fondu noir au chargement, sous-titre, logo), posée dès le
// premier paint hors de #root pour qu'un transform caméra sur #root ne la touche
// pas, et pour masquer le flash de navigation.
const COUCHE = `(${(() => {
  function pose() {
    if (document.getElementById('cine-l')) return;
    const b = document.body; if (!b) return;
    const root = document.getElementById('root'); if (root) { root.style.transformOrigin = '50% 42%'; root.style.transition = 'transform 4.2s cubic-bezier(.33,.0,.2,1)'; root.style.willChange = 'transform'; }
    const l = document.createElement('div'); l.id = 'cine-l';
    l.innerHTML = '<div id="cine-fade"></div>'
      + '<div id="cine-vign"></div>'
      + '<div id="cine-logo"><img src="/vrm-logo-v4-192.png"/><b>VRM</b></div>'
      + '<div id="cine-cap"><span></span></div>';
    const s = document.createElement('style');
    s.textContent = `
      #cine-l{position:fixed;inset:0;z-index:2147483646;pointer-events:none;font-family:"Inter",system-ui,sans-serif}
      #cine-fade{position:absolute;inset:0;background:#05070A;opacity:1;transition:opacity .9s ease}
      #cine-vign{position:absolute;inset:0;background:radial-gradient(130% 90% at 50% 38%,transparent 55%,rgba(3,5,10,.55) 100%)}
      #cine-logo{position:absolute;top:calc(20px + env(safe-area-inset-top,0px));left:22px;display:flex;align-items:center;gap:9px;opacity:0;transition:opacity .7s ease}
      #cine-logo img{width:30px;height:30px;border-radius:9px;box-shadow:0 0 0 1px rgba(255,255,255,.12)}
      #cine-logo b{font-size:17px;font-weight:700;letter-spacing:-.03em;color:#fff;text-shadow:0 2px 12px rgba(0,0,0,.6)}
      #cine-cap{position:absolute;left:0;right:0;bottom:calc(86px + env(safe-area-inset-bottom,0px));display:flex;justify-content:center;padding:0 30px}
      #cine-cap span{display:inline-block;max-width:16ch;text-align:center;font-size:33px;line-height:1.18;font-weight:700;letter-spacing:-.02em;
        color:#fff;text-shadow:0 2px 20px rgba(0,0,0,.85),0 1px 3px rgba(0,0,0,.9);opacity:0;transform:translateY(14px);transition:opacity .55s ease,transform .55s cubic-bezier(.23,1,.32,1)}
      #cine-cap span.on{opacity:1;transform:none}
      #cine-cap span b{color:#7FA8FF}
      body.cine-intro #root{filter:brightness(.4) blur(3px)}
      #cine-big{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;text-align:center;padding:0 34px;opacity:0;transition:opacity .8s ease}
      #cine-big.on{opacity:1}
      #cine-big .t{font-size:40px;font-weight:800;letter-spacing:-.03em;color:#fff;line-height:1.1;max-width:14ch}
      #cine-big .u{font-size:22px;font-weight:600;color:#7FA8FF;letter-spacing:.02em}
    `;
    document.head.appendChild(s); document.body.appendChild(l);
    window.__cine = {
      fade(v) { const f = document.getElementById('cine-fade'); if (f) f.style.opacity = v; },
      logo(v) { const e = document.getElementById('cine-logo'); if (e) e.style.opacity = v; },
      cap(html) { const e = document.querySelector('#cine-cap span'); if (!e) return; e.classList.remove('on'); setTimeout(() => { e.innerHTML = html; e.classList.add('on'); }, 260); },
      capOff() { const e = document.querySelector('#cine-cap span'); if (e) e.classList.remove('on'); },
      cam(to) { const r = document.getElementById('root'); if (r) r.style.transform = to; },
      camNow(from) { const r = document.getElementById('root'); if (r) { r.style.transition = 'none'; r.style.transform = from; r.offsetHeight; r.style.transition = 'transform 4.2s cubic-bezier(.33,.0,.2,1)'; } },
      big(t, u) { let e = document.getElementById('cine-big'); if (!e) { e = document.createElement('div'); e.id = 'cine-big'; document.getElementById('cine-l').appendChild(e); } e.innerHTML = '<div class="t">' + t + '</div>' + (u ? '<div class="u">' + u + '</div>' : ''); requestAnimationFrame(() => e.classList.add('on')); },
      bigOff() { const e = document.getElementById('cine-big'); if (e) e.classList.remove('on'); },
    };
  }
  if (document.body) pose(); else document.addEventListener('DOMContentLoaded', pose);
}).toString()})()`;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  if (!fs.existsSync(DIST)) { console.log('dist/ absent — fais `npm run build` d’abord'); process.exit(1); }
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const vdir = fs.mkdirSync(path.join(OUT, '_cine_raw'), { recursive: true }) || path.join(OUT, '_cine_raw');
  const vp = { width: 540, height: 960 };
  const ctx = await b.newContext({ viewport: vp, isMobile: true, hasTouch: true, deviceScaleFactor: 2, recordVideo: { dir: vdir, size: vp } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await mock(pg);
  if (!process.env.CINE_LIVE) await pg.addInitScript(COUCHE);

  if (process.env.CINE_LIVE) {
    // Le film est joué par l'app elle-même (CineStudio, `?cine&auto=1`) : on se
    // contente de charger et d'enregistrer ce que l'app fait toute seule.
    await pg.goto(`http://localhost:${PORT}/?cine&auto=1`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await wait(27000);
  } else {
  let first = true;
  for (const plan of PLANS) {
    if (plan.tab) {
      await pg.goto(`http://localhost:${PORT}/?tab=${plan.tab}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
      // le fond noir est posé par la couche dès le 1er paint
      await pg.waitForTimeout(900);
      if (plan.scroll) await pg.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), plan.scroll).catch(() => {});
      await pg.evaluate((p) => { window.__cine && window.__cine.logo(1); if (p.cam) { window.__cine.camNow(p.cam.from); requestAnimationFrame(() => window.__cine.cam(p.cam.to)); } }, plan).catch(() => {});
      await pg.evaluate(() => { document.body.classList.remove('cine-intro'); window.__cine && window.__cine.bigOff(); window.__cine && window.__cine.fade(0); }).catch(() => {});
      await wait(350);
      await pg.evaluate((c) => window.__cine && window.__cine.cap(c), plan.cap).catch(() => {});
      await wait(plan.ms);
      // fondu sortant si le plan suivant recharge (sinon on garde l'image)
      await pg.evaluate(() => { window.__cine && window.__cine.capOff(); window.__cine && window.__cine.fade(1); }).catch(() => {});
      await wait(650);
    } else {
      // intro / outro : fond noir, grand texte centré
      if (first) { await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' }).catch(() => {}); await pg.waitForTimeout(700); }
      await pg.evaluate((p) => {
        document.body.classList.add('cine-intro');
        window.__cine && window.__cine.fade(0.0);
        window.__cine && window.__cine.capOff();
        window.__cine && window.__cine.logo(p.outro ? 1 : 0);
        window.__cine && window.__cine.big(p.cap, p.outro ? 'vrm.center' : '');
      }, plan).catch(() => {});
      await wait(plan.ms);
      await pg.evaluate(() => { window.__cine && window.__cine.bigOff(); window.__cine && window.__cine.fade(1); }).catch(() => {});
      await wait(650);
    }
    first = false;
  }
  }
  await wait(300);
  await pg.close(); await ctx.close();
  await b.close(); srv.close();

  // Playwright a écrit un .webm : on le transcode en .mp4 vertical 1080×1920.
  const webm = fs.readdirSync(vdir).filter((f) => f.endsWith('.webm')).map((f) => path.join(vdir, f)).sort((a, z) => fs.statSync(z).mtimeMs - fs.statSync(a).mtimeMs)[0];
  if (!webm) { console.log('aucune vidéo produite'); process.exit(1); }
  const mp4 = path.join(OUT, 'vrm-demo.mp4');
  try {
    execFileSync(FFMPEG, ['-y', '-i', webm,
      '-vf', 'scale=1080:1920:flags=lanczos,format=yuv420p',
      '-r', '30', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-movflags', '+faststart', mp4], { stdio: 'inherit' });
  } catch (e) { console.log('ffmpeg a échoué, je laisse le .webm :', webm); console.log(String(e.message || e)); process.exit(0); }
  const ko = Math.round(fs.statSync(mp4).size / 1024);
  console.log('OK →', mp4, '(' + ko + ' Ko)', 'erreurs app:', errs.length);
})();
