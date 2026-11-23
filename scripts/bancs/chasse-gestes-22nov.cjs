require('./_porte-banc.cjs');
// ═════════════════════════════════════════════════════════════════════════════
//  BANC « GESTES DU VENDEUR » (chasse du 22 nov.) — les gestes courants, joués par leur TEXTE visible (comme un
//  doigt), sur la base de volume : la loupe (N°, pseudo, n° de suivi, faute de frappe), les segments d'Annonces
//  et le filtre Site, Argent (chaque onglet) et Statistiques (chaque segment), Paramètres (chaque rangée puis
//  retour), Messages (une conversation), Relier achats et ventes, saisir un prix d'achat, imprimer, passage
//  clair/sombre. Chaque geste : capture, erreurs, le texte de l'écran (rapport-gestes.json). Il RAPPORTE.
//  VUES=tel,ordi  SORTIE=<dossier>
// ═════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), http = require('http'), os = require('os');
const { chromium } = require('playwright');
const { fabriquer, repondre } = require('./_base-volume.cjs');
const R = path.join(__dirname, '..', '..');
const DIST = process.env.BANC_DIST || path.join(R, 'dist');
const SORTIE = process.env.SORTIE || path.join(os.tmpdir(), 'vrm-bancs', 'chasse-gestes');
fs.mkdirSync(SORTIE, { recursive: true });
const VUES = String(process.env.VUES || 'tel,ordi').split(',');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.webp': 'image/webp', '.ico': 'image/x-icon', '.wasm': 'application/wasm', '.mjs': 'text/javascript' };
const srv = http.createServer((q, r) => {
  let f = decodeURIComponent((q.url || '/').split('?')[0]); if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!p.startsWith(DIST) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
const journal = [];
const dit = (vue, geste, ok, detail) => { journal.push({ vue, geste, ok, detail }); console.log(`${ok ? '·' : '❌'} [${vue}] ${geste}${detail ? ' — ' + String(detail).slice(0, 300) : ''}`); };

async function main() {
  await new Promise((r) => srv.listen(Number(process.env.BANC_PORT) || 0, r));
  const ICI = `http://localhost:${srv.address().port}`;
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  for (const vue of VUES) {
    const tel = vue === 'tel';
    const base = fabriquer({ volumeReel: true, annonces: 1000 });
    const ctx = await nav.newContext({ viewport: tel ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: tel, hasTouch: tel, deviceScaleFactor: tel ? 2 : 1, locale: 'fr-FR', serviceWorkers: 'block' });
    const pg = await ctx.newPage();
    ctx.on('page', (p) => { if (p !== pg) { dit(vue, 'un onglet s\'est ouvert', true, p.url()); p.close().catch(() => {}); } });
    pg.on('dialog', (d) => { dit(vue, 'boîte de dialogue du navigateur', false, d.message()); d.dismiss().catch(() => {}); });
    const err = [];
    pg.on('pageerror', (e) => err.push('pageerror ' + String(e.message || e).slice(0, 240)));
    pg.on('console', (m) => { if (m.type() === 'error') { const t = m.text(); if (!/Failed to load resource|net::ERR|favicon|ERR_FAILED/.test(t)) err.push('console ' + t.slice(0, 240)); } });
    await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
    await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (/supabase\.co/.test(r.request().url()) ? r.fallback() : r.abort()));
    const ecritures = [];
    await pg.route('**/rest/v1/**', async (route) => {
      const rq = route.request();
      if (rq.method() !== 'GET') { ecritures.push(rq.method() + ' ' + decodeURIComponent(rq.url()).replace(/^.*\/rest\/v1\//, '').slice(0, 80)); return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' }).catch(() => {}); }
      const h = await rq.allHeaders().catch(() => ({}));
      const rep = repondre(rq.url(), h.range, base);
      return route.fulfill({ status: rep.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', ...(rep.headers || {}) }, body: JSON.stringify(rep.body) }).catch(() => {});
    });
    await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: /mode=abonnement/.test(r.request().url()) ? '{"ok":true,"acces":true,"statut":"active","configure":true}' : '{"pret":true,"devices":1}' }));
    const cap = (n) => pg.screenshot({ path: path.join(SORTIE, `${vue}-${n}.png`) }).catch(() => {});
    const aller = async (t) => { await pg.evaluate((t) => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=' + t })), t).catch(() => {}); await pg.waitForTimeout(2500); };
    const texte = () => pg.evaluate(() => (document.querySelector('.vrm-main') || document.body).innerText.replace(/\s+/g, ' ')).catch(() => '');
    const toucher = async (re, ou = '.vrm-main, [role="dialog"], .n-feuille, body') => { const l = pg.locator(ou).locator(`button, [role="button"], [role="tab"], a, summary, label, .n-rangee`).filter({ hasText: re, visible: true }).first(); if (!(await l.count().catch(() => 0))) return false; await l.click({ timeout: 3000 }).catch(() => {}); await pg.waitForTimeout(1200); return true; };
    const fermer = async () => { await pg.keyboard.press('Escape').catch(() => {}); await pg.waitForTimeout(500); };
    const geste = async (nom, f) => { const a = err.length; let r; try { r = await f(); } catch (e) { r = 'exception ' + e.message; } const e2 = err.slice(a); dit(vue, nom, !e2.length && r !== false && !/^exception/.test(String(r || '')), (e2.length ? e2.join(' ¦ ') + ' ' : '') + (r && r !== true ? r : '')); };
    try {
      await pg.goto(`${ICI}/?tab=journee`, { waitUntil: 'domcontentloaded' });
      await pg.waitForFunction(() => { const d = document.getElementById('vrm-demarrage'); return !d || d.hasAttribute('data-sortie') || getComputedStyle(d).opacity === '0'; }, null, { timeout: 60000 }).catch(() => {});
      await pg.waitForTimeout(4000);
      // 1. La loupe.
      const ouvrirLoupe = async () => {
        let champ = pg.locator('input[type="search"], input[placeholder*="N°"]').filter({ visible: true }).first();
        if (!(await champ.count())) { const b = pg.locator('button[aria-label*="echerch"], button[aria-label*="oupe"]').filter({ visible: true }).first(); if (await b.count()) { await b.click().catch(() => {}); await pg.waitForTimeout(900); } champ = pg.locator('input[type="search"], input[placeholder*="N°"]').filter({ visible: true }).first(); }
        return (await champ.count()) ? champ : null;
      };
      const premierNum = await pg.evaluate(() => { const p = [...document.querySelectorAll('.n-plaque, [data-n-plaque]')].map((e) => e.innerText.replace(/\D/g, '')).filter(Boolean); return p[0] || '22'; }).catch(() => '22');
      const suivi = (base.rows.find((r) => /suivi|track|XW|tracking_code/i.test(JSON.stringify(r.data || {}).slice(0, 4000))) || {}).data;
      const nSuivi = (/(XW\d{8,}|\b\d{10,14}\b)/.exec(JSON.stringify(suivi || '')) || [])[1] || 'XW22000000253';
      for (const [k, q] of [['N°', premierNum], ['pseudo', 'acheteur_3'], ['suivi', nSuivi], ['faute', 'sambaa'], ['modele', 'spezial 38']]) {
        await geste(`loupe : ${k} « ${q} »`, async () => {
          const c = await ouvrirLoupe(); if (!c) return 'pas de champ de recherche trouvé';
          await c.fill(''); await c.type(q, { delay: 30 }); await pg.waitForTimeout(2500);
          await cap(`loupe-${k}`);
          const t = await pg.evaluate(() => { const p = document.querySelector('[role="listbox"], [data-loupe], .n-loupe, [class*="loupe"]'); return (p ? p.innerText : document.body.innerText).replace(/\s+/g, ' ').slice(0, 260); });
          await fermer(); await fermer();
          return t;
        });
      }
      // La loupe reste-t-elle ouverte en changeant d'écran ?
      await geste('loupe fermée en changeant d\'écran', async () => { const c = await ouvrirLoupe(); if (!c) return 'pas de champ'; await c.fill(premierNum); await pg.waitForTimeout(1500); await aller('compta'); const ouverte = await pg.evaluate(() => { const i = document.querySelector('input[type="search"], input[placeholder*="N°"]'); return i ? i.value : ''; }); await cap('loupe-apres-navigation'); await fermer(); return ouverte ? `false: la recherche « ${ouverte} » reste dans le champ sur Argent` : true; });
      // 2. Annonces : segments et filtre Site.
      await aller('annonces');
      for (const s of ['En ligne', 'À publier', 'Dorment', 'Republier', 'Vendue', 'En pause', 'Masquée']) {
        await geste(`Annonces · ${s}`, async () => { const ok = await toucher(new RegExp('^\\s*' + s)); if (!ok) return 'segment absent'; await pg.waitForTimeout(800); await cap(`annonces-${s.replace(/\W+/g, '')}`); const t = await texte(); return t.slice(0, 200); });
      }
      await geste('Annonces · filtre Site', async () => { const ok = (await toucher(/^\s*Site/)) || (await toucher(/Filtr/)); await cap('annonces-filtre-site'); const t = await pg.evaluate(() => document.body.innerText.replace(/\s+/g, ' ')); await fermer(); return ok ? (t.match(/(Vinted|Leboncoin|eBay|Vestiaire)[^·]{0,20}/g) || []).slice(0, 6).join(' | ') : 'filtre Site introuvable'; });
      // 3. Argent : onglets ; Statistiques : segments.
      await aller('compta');
      for (const o of ['Résumé', 'Statistiques', 'Déclarer', 'Factures']) {
        await geste(`Argent · ${o}`, async () => { const ok = await toucher(new RegExp('^\\s*' + o)); if (!ok) return 'onglet absent'; await pg.waitForTimeout(1800); await cap(`argent-${o}`); return (await texte()).slice(0, 220); });
        if (o === 'Statistiques') {
          const segs = await pg.evaluate(() => [...document.querySelectorAll('.vrm-main [role="tab"], .vrm-main .n-segment button')].map((e) => e.innerText.trim()).filter((x) => x && x.length < 24)).catch(() => []);
          for (const s of [...new Set(segs)].filter((x) => !/Résumé|Statistiques|Déclarer|Factures/.test(x)).slice(0, 10)) {
            await geste(`Statistiques · ${s}`, async () => { await toucher(new RegExp('^\\s*' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))); await pg.waitForTimeout(1500); await cap(`stats-${s.replace(/\W+/g, '')}`); return (await texte()).slice(0, 160); });
          }
        }
      }
      // 4. Ventes : saisir un prix d'achat ; Imprimer.
      await aller('ventes');
      await geste('Ventes · saisir un prix d\'achat (40) puis Entrée', async () => {
        const i = pg.locator('.vrm-main input[placeholder*="achat"], .vrm-main input[inputmode="decimal"]').filter({ visible: true }).first();
        if (!(await i.count())) return 'pas de champ prix d\'achat';
        const n0 = ecritures.length; await i.click(); await i.fill('40'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(2000);
        await cap('ventes-prix-achat');
        const v = await i.inputValue().catch(() => '?');
        return `valeur après : « ${v} » · écritures envoyées : ${ecritures.slice(n0).join(' ; ') || 'AUCUNE'}`;
      });
      await geste('Ventes · Imprimer', async () => { const ok = await toucher(/^\s*Imprimer/); await pg.waitForTimeout(2500); await cap('ventes-imprimer'); const t = await pg.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 300)); await fermer(); return ok ? t : 'bouton Imprimer absent'; });
      // 5. Achats : relier.
      await aller('achats');
      await geste('Achats · Relier achats et ventes', async () => { const ok = await toucher(/Relier achats/); await pg.waitForTimeout(2500); await cap('relier'); const t = await texte(); if (!ok) return 'bouton absent'; const l = pg.locator('[role="dialog"] .n-rangee, .n-feuille .n-rangee, .vrm-main .n-rangee').filter({ visible: true }).first(); if (await l.count()) { await l.click().catch(() => {}); await pg.waitForTimeout(1500); await cap('relier-choix'); } const t2 = await pg.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 300)); await fermer(); await fermer(); return t.slice(0, 120) + ' ⇒ ' + t2; });
      // 6. Messages : une conversation.
      await aller('messages');
      await geste('Messages · ouvrir une conversation', async () => { const l = pg.locator('.vrm-main .n-rangee, .vrm-main [data-conv], .vrm-main [role="row"], .vrm-main li').filter({ visible: true }).first(); if (!(await l.count())) return 'aucune conversation visible'; await l.click().catch(() => {}); await pg.waitForTimeout(2500); await cap('messages-conv'); const t = await pg.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 260)); await fermer(); return t; });
      // 7. Paramètres : chaque rangée, puis retour (le geste).
      await aller('settings');
      const rangs = await pg.evaluate(() => [...document.querySelectorAll('.vrm-main .n-rangee, .vrm-main [role="button"]')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; }).map((e) => (e.innerText || '').split('\n')[0].trim()).filter((x) => x && x.length < 40 && !/déconnect|supprim|effac|fermer/i.test(x))).catch(() => []);
      for (const r of [...new Set(rangs)].slice(0, 22)) {
        await geste(`Paramètres · ${r}`, async () => {
          await toucher(new RegExp('^\\s*' + r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
          await pg.waitForTimeout(1300); await cap(`param-${r.replace(/\W+/g, '').slice(0, 24)}`);
          const t = (await texte()).slice(0, 120);
          await pg.evaluate(() => history.back()).catch(() => {}); await pg.waitForTimeout(1200);
          if (!pg.url().startsWith(ICI)) { await pg.goto(`${ICI}/?tab=settings`, { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(4000); return `false: le retour QUITTE l'app (${t})`; }
          const e = await pg.evaluate(() => document.querySelector('#vrm-contenu')?.dataset.ecran || '');
          if (e !== 'settings') { const r2 = `retour ⇒ écran « ${e} » au lieu de Paramètres`; await aller('settings'); return 'false: ' + r2; }
          return t;
        });
      }
      // 8. Clair / sombre.
      await geste('passage en sombre (réglage) puis retour', async () => {
        await aller('settings');
        const ok = (await toucher(/^\s*(Apparence|Affichage|Mode sombre|Thème)/)) ;
        await pg.waitForTimeout(800);
        const s = (await toucher(/^\s*Sombre/)) || (await toucher(/Mode sombre/));
        await pg.waitForTimeout(1200); await cap('sombre-reglage');
        const fond = await pg.evaluate(() => getComputedStyle(document.body).backgroundColor);
        await aller('ventes'); await cap('sombre-ventes');
        return `${ok ? '' : 'rangée Apparence introuvable · '}${s ? '' : 'choix Sombre introuvable · '}fond du corps : ${fond}`;
      });
    } catch (e) { dit(vue, 'le parcours a pu jouer', false, e.message); }
    await ctx.close();
  }
  await nav.close(); srv.close();
  fs.writeFileSync(path.join(SORTIE, 'rapport-gestes.json'), JSON.stringify(journal, null, 1));
  console.log(`\n${journal.filter((x) => !x.ok).length} gestes rouges / ${journal.length} · ${SORTIE}`);
}
main();
