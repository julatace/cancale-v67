// Banc de REVUE (17 octobre, après les sept chantiers #558-#561) : chaque écran,
// chaque section d'une plateforme, chaque onglet des Paramètres, rendu à 390 px
// tactile et à 1512 px, en CLAIR et en SOMBRE, sur les fixtures (`fx/`, jamais
// dans le dépôt), puis en MODE STREAM. On ne juge aucun libellé : on juge ce qui
// se voit.
//   · un écran tombé sur le garde-fou, un débordement horizontal, un artefact
//     (`undefined`, `NaN`, `[object Object]`) ;
//   · une PHRASE (≥ 60 caractères) écrite deux fois sur un même écran (§7) ;
//   · en sombre, une SURFACE claire (fond de luminance > 0,45 sur plus de
//     8 000 px², hors boutons, champs, images et tuiles de marque) ;
//   · en mode stream, un pseudo de ses comptes LISIBLE (aucun ancêtre flouté) ;
//   · un lien de menu qui mène à un onglet retiré.
// `SHOTS=dossier` : une capture par écran (pour les REGARDER, §6.2).
// `ECRANS=a,b` : ne rendre que ces écrans. `MODES=clair,sombre,stream`.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const { dressingsDuJour } = require('./_instantane.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist'), SC = __dirname;
if (!fs.existsSync(path.join(SC, 'fx', 'main.json'))) { console.log('⚠️ fixtures absentes (scripts/bancs/fx) — banc non lancé'); process.exit(0); }
const FX = f => JSON.parse(fs.readFileSync(path.join(SC, 'fx', f + '.json'), 'utf8'));
const main = FX('main'), accounts = FX('accounts');
const LOGINS = accounts.map(a => a.login).filter(l => l && l.length >= 4);
const rows = [...FX('sold'), ...FX('purch'), ...dressingsDuJour(FX('listings')), ...FX('inbox'), ...FX('track'), ...FX('bord'), ...FX('label'), ...FX('billing')];
const txn = FX('txn');
function projette(row, select) {
  if (!select || select === '*') return row;
  const out = {};
  for (const part of select.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const alias = m[1] || m[2].split('->').pop().replace(/^>/, ''); const src = m[2];
    if (src === 'id' || src === 'updated_at') { out[alias] = row[src]; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (/^data(->|->>)/.test(src)) {
      let v = row.data;
      for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = (v == null ? null : v[seg]);
      out[alias] = v == null ? null : v; continue;
    }
    out[alias] = row[src];
  }
  return out;
}
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});
const PORT = Number(process.env.BANC_PORT) || 7010;
srv.on('error', e => { console.log('⚠️ port ' + PORT + ' pris (' + e.code + ') — relance avec BANC_PORT'); process.exit(1); });
srv.listen(PORT);

const ECRANS_TOUS = ['journee', 'plat_vinted', 'plat_leboncoin', 'plat_ebay', 'plat_vestiaire', 'cat_bord', 'garage', 'dashboard', 'compta', 'settings', 'settings@compte', 'settings@abonnement', 'vintedaccounts'];
const ECRANS = process.env.ECRANS ? process.env.ECRANS.split(',') : ECRANS_TOUS;
const MODES = process.env.MODES ? process.env.MODES.split(',') : ['clair', 'sombre', 'stream'];
const RETIRES = ['collectif', 'cat_detail', 'outils'];

(async () => {
  let ko = 0; const trouv = [];
  const dit = (c, m, d) => { if (!c) { ko++; trouv.push(m + (d ? ' — ' + d : '')); } console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  for (const mode of MODES) {
    for (const [W, H, tag, tactile] of [[390, 844, '390', true], [1512, 950, '1512', false]]) {
      const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: tactile, hasTouch: tactile });
      const pg = await ctx.newPage();
      const errs = [];
      pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message.slice(0, 120)));
      await pg.addInitScript((m) => {
        try {
          localStorage.setItem('vrm_acces_direct', '1');
          localStorage.setItem('vinted_dark', m === 'sombre' ? 'true' : 'false');
          localStorage.setItem('vrm_stream', m === 'stream' ? '1' : '0');
        } catch (_) {}
      }, mode);
      await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r3) => {
        const t3 = r3.request().resourceType();
        if (t3 === 'image' || t3 === 'media' || t3 === 'font') return r3.abort();
        return r3.continue();
      });
      await pg.route('**://*.vinted.net/**', r4 => r4.abort());
      await pg.route('**/rest/v1/**', route => {
        const u = metaVersData(route.request().url());
        const j = d => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
        if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', body: '{"m":1}' });
        if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(accounts);
        const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1]; const S = sel ? decodeURIComponent(sel) : null;
        if (/id=eq\.main/.test(u)) return j(main.map(r => projette(r, S)));
        if (/transaction->>id/.test(u)) return j(txn);
        const eq = /id=eq\.([^&]*)/.exec(u); if (eq) { const k = decodeURIComponent(eq[1]); return j(rows.filter(r => r.id === k).map(r => projette(r, S))); }
        const m = /id=like\.([^&]*)/.exec(u); if (m) { const re = new RegExp('^' + decodeURIComponent(m[1]).replace(/[*%]/g, '.*') + '$'); return j(rows.filter(r => re.test(r.id)).map(r => projette(r, S))); }
        return j([]);
      });
      await pg.route('**/api/**', r2 => r2.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true,"devices":1}' }));
      for (const e of ECRANS) {
        const [t, vue] = e.split('@');
        await pg.goto(`http://localhost:${PORT}/?tab=${t}${vue ? '&vue=' + vue : ''}`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(2600);
        // Les sections d'une plateforme : chaque segment du contrôle, cliqué.
        const sections = t.startsWith('plat_')
          ? await pg.$$eval('.vrm-rubriques .vrm-seg-btn, nav .vrm-seg-btn', bs => bs.map(x => (x.innerText || '').trim()).filter(Boolean)).catch(() => [])
          : [];
        const passes = sections.length ? sections : [''];
        for (const s of passes) {
          if (s) {
            const ok = await pg.locator('.vrm-seg-btn', { hasText: s }).first().click({ timeout: 3000 }).then(() => true).catch(() => false);
            if (!ok) continue;
            await pg.waitForTimeout(1400);
          }
          const nom = `${e}${s ? '›' + s : ''} [${mode} ${tag}]`;
          if (process.env.SHOTS) { try { fs.mkdirSync(process.env.SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(process.env.SHOTS, `${mode}-${tag}-${e.replace('@', '_')}${s ? '-' + s.replace(/[^\w]+/g, '_') : ''}.png`), fullPage: true, timeout: 15000 }); } catch (_) {} }
          const r = await pg.evaluate(({ mode, logins, retires }) => {
            const txt = document.body.innerText || '';
            const out = { n: txt.length, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
            out.mort = /n'a pas pu s'afficher|Cannot access|is not defined|is not a function/.test(txt);
            out.susp = (txt.match(/\bundefined\b|\bNaN\b|\[object Object\]/g) || []).slice(0, 3);
            // Phrases répétées (§7) : on découpe en phrases visibles de ≥ 60 caractères.
            const vus = new Map();
            for (const l of txt.split(/\n+|(?<=[.!?])\s+/)) {
              const p = l.trim(); if (p.length < 60) continue;
              vus.set(p, (vus.get(p) || 0) + 1);
            }
            // Une ligne répétée qui DISTINGUE (groupe mixte, §7) n'est pas un doublon :
            // la page porte alors une variante de cette ligne (même début, ≥ 30 car.).
            const toutes = txt.split(/\n+/).map(x => x.trim());
            const distingue = (p) => toutes.some(x => x !== p && x.length >= 30 && (p.startsWith(x) || x.startsWith(p.slice(0, 30))));
            out.doubles = [...vus].filter(([p, n]) => n > 1 && !distingue(p)).map(([p, n]) => n + '× « ' + p.slice(0, 70) + '… »');
            // Un repli avec le TRIANGLE du navigateur (§7 : un chevron, une forme).
            out.triangles = [...document.querySelectorAll('details > summary')].filter(sm => {
              const rc = sm.getBoundingClientRect(); if (!rc.width || !rc.height || !(sm.innerText || '').trim()) return false;
              return getComputedStyle(sm).display === 'list-item' && getComputedStyle(sm, '::marker').content !== '""' && getComputedStyle(sm).listStyleType !== 'none';
            }).map(sm => ((sm.innerText || '').trim().slice(0, 40) || sm.outerHTML.slice(0, 90)) + ' [' + String(sm.parentElement.className || '-').slice(0, 30) + ']').slice(0, 4);
            // Liens vers un onglet retiré.
            out.liensMorts = [...document.querySelectorAll('a[href*="tab="]')].map(a => a.getAttribute('href')).filter(h => retires.some(x => h.includes('tab=' + x)));
            // Sombre : surfaces claires.
            const lum = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return null; const [r, g, b, a] = m[1].split(',').map(Number); if (a != null && !isNaN(a) && a < 0.5) return null; const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
            out.clairs = [];
            if (mode === 'sombre') {
              for (const el of document.querySelectorAll('body *')) {
                if (el.closest('button, a, input, select, textarea, img, svg, canvas, iframe, [data-plat-entete], .vrm-plat-tuile, [data-stream-flou]')) continue;
                if (el.querySelector('canvas')) continue; // la scène 3D a son ambiance, choisie à part
                const cs = getComputedStyle(el); const L = lum(cs.backgroundColor);
                if (L == null || L < 0.45) continue;
                const rc = el.getBoundingClientRect(); if (rc.width * rc.height < 8000 || rc.width === 0) continue;
                if (cs.visibility === 'hidden' || cs.display === 'none') continue;
                const desc = (el.className && String(el.className).slice(0, 40)) || el.tagName;
                out.clairs.push(desc + ' ' + Math.round(rc.width) + 'x' + Math.round(rc.height) + ' « ' + (el.innerText || '').trim().slice(0, 40) + ' »');
                if (out.clairs.length > 6) break;
              }
            }
            // Stream : un pseudo lisible.
            out.fuites = [];
            if (mode === 'stream' && logins.length) {
              const re = new RegExp(logins.map(l => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i');
              const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
              while ((n = w.nextNode())) {
                if (!re.test(n.nodeValue || '')) continue;
                let el = n.parentElement, flou = false, cache = false;
                for (let x = el; x && x !== document.documentElement; x = x.parentElement) {
                  const cs = getComputedStyle(x);
                  if (/blur/.test(cs.filter)) { flou = true; break; }
                  if (cs.display === 'none' || cs.visibility === 'hidden') { cache = true; break; }
                }
                if (!flou && !cache) { const rc = el.getBoundingClientRect(); if (rc.width > 0 && rc.height > 0) out.fuites.push((n.nodeValue || '').trim().slice(0, 60)); }
                if (out.fuites.length > 4) break;
              }
            }
            return out;
          }, { mode, logins: LOGINS, retires: RETIRES });
          if (r.mort) dit(false, nom + ' : écran tombé');
          if (r.n < 120) dit(false, nom + ' : écran vide', String(r.n));
          if (r.sw > r.cw + 1) dit(false, nom + ' : débordement', `${r.sw}>${r.cw}`);
          if (r.susp.length) dit(false, nom + ' : artefact', r.susp.join(', '));
          if (r.doubles.length) dit(false, nom + ' : phrase en double', r.doubles.join(' // '));
          if (r.triangles.length) dit(false, nom + ' : repli avec le triangle du navigateur', r.triangles.join(' // '));
          if (r.liensMorts.length) dit(false, nom + ' : lien vers un onglet retiré', r.liensMorts.join(', '));
          if (r.clairs.length) dit(false, nom + ' : surface claire en sombre', r.clairs.join(' // '));
          if (r.fuites.length) dit(false, nom + ' : pseudo lisible en mode stream', r.fuites.join(' // '));
        }
      }
      if (errs.length) dit(false, `erreurs d'app [${mode} ${tag}]`, [...new Set(errs)].slice(0, 3).join(' | '));
      await ctx.close();
    }
  }
  await b.close(); srv.close();
  console.log(ko ? `\n${ko} défaut(s).` : '\n✅ revue des écrans : rien à signaler');
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log('❌ banc mort : ' + e.message); process.exit(1); });
