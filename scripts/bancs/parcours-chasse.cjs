require('./_porte-banc.cjs');
// ═════════════════════════════════════════════════════════════════════════════
//  BANC « PARCOURS DE CHASSE » (20 nov., chasse-bugs-2) — Julien au téléphone (390 tactile) et à l'ordinateur
//  (1512) : chaque onglet, sa première rangée (la fiche), sa feuille « ⋯ », dans des conditions qui cassent :
//    volume  base inventée au poids de la sienne + 1 000 annonces (_base-volume.cjs)
//    vide    aucun compte, aucune ligne
//    lente   chaque lecture TENUE 8 s (on regarde l'écran pendant)
//    panne   503 partout
//    longs   titres de 180 caractères, sans espace sur 60
//    grand   texte agrandi (html 135 %), mode sombre
//  Il RAPPORTE, par onglet et condition : erreurs JS et console (React #31, TDZ…), garde-fou, débordement
//  horizontal, « undefined / NaN / [object Object] » à l'écran, cibles < 44 px au doigt, même lecture partie
//  plus de 3 fois en 12 s, minuteries qui s'accumulent d'un onglet à l'autre. CHASSE=volume,vide… ONGLETS=…
//  TAILLES=390,1512. Un banc ne meurt pas : il rapporte (code 1 s'il y a un rouge).
// ═════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), http = require('http'), os = require('os');
const { chromium } = require('playwright');
const { fabriquer, repondre } = require('./_base-volume.cjs');
const R = path.join(__dirname, '..', '..');
const DIST = process.env.BANC_DIST || path.join(R, 'dist');
const SORTIE = process.env.BANC_CAPTURES || path.join(os.tmpdir(), 'vrm-bancs', 'parcours-chasse');
fs.mkdirSync(SORTIE, { recursive: true });
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const CONDS = liste('CHASSE', 'volume,vide,lente,panne,longs,grand');
const TAILLES = liste('TAILLES', '390,1512').map(Number);
const ONGLETS = liste('ONGLETS', 'journee,ventes,achats,garage,messages,emails,settings,extension,automatisations,dashboard,litiges,communaute,annonces,compta');
const HORS_CHANTIER = new Set(['annonces', 'compta']);   // refaits ailleurs (minimaliste, argent-natif) : notés seulement
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.webp': 'image/webp', '.ico': 'image/x-icon', '.wasm': 'application/wasm', '.mjs': 'text/javascript' };
const srv = http.createServer((q, r) => {
  let f = decodeURIComponent((q.url || '/').split('?')[0]); if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!p.startsWith(DIST) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});

const rouges = [];
let nOk = 0;
const dit = (c, m, d = '') => { if (c) { nOk++; return; } rouges.push(m + (d !== '' ? ' — ' + String(d).slice(0, 300) : '')); console.log('❌ ' + m + (d !== '' ? ' — ' + String(d).slice(0, 300) : '')); };

const longs = (b) => {
  const T = 'Baskets Nike Air Max 1 Premium édition limitée couleur blanc cassé et rouge université taille 42,5 état neuf jamais portées boîte d’origine ' + 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  const walk = (o) => { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') for (const k of Object.keys(o)) { if ((k === 'title' || k === 'item_title') && typeof o[k] === 'string') o[k] = T; else walk(o[k]); } };
  for (const r of b.rows) walk(r.data);
  return b;
};
const BASES = {
  volume: () => fabriquer({ volumeReel: true, annonces: 1000 }),
  longs: () => longs(fabriquer({ volumeReel: false })),
  grand: () => fabriquer({ volumeReel: false }),
  lente: () => fabriquer({ volumeReel: false }),
  panne: () => fabriquer({ volumeReel: false }),
  vide: () => ({ rows: [], main: [], accounts: [] }),
};

async function ouvrir(nav, cond, W, base) {
  const tactile = W < 600;
  const sombre = cond === 'grand';
  const ctx = await nav.newContext({ viewport: { width: W, height: tactile ? 844 : 950 }, isMobile: tactile, hasTouch: tactile, locale: 'fr-FR', colorScheme: sombre ? 'dark' : 'light', serviceWorkers: 'block' });
  const pg = await ctx.newPage();
  ctx.on('page', (p) => { if (p !== pg) p.close().catch(() => {}); });
  pg.on('dialog', (d) => d.dismiss().catch(() => {}));
  const J = { erreurs: [], lectures: [] };
  // Une erreur levée par un script INJECTÉ par les bancs (pile `<anonymous>`, cadre d'origine opaque) n'est pas de l'app.
  pg.on('pageerror', (e) => { if (/^\s*at <anonymous>/m.test(String(e.stack || '').split('\n')[1] || '')) return; J.erreurs.push('pageerror ' + String(e.message || e).slice(0, 200)); });
  pg.on('console', (m) => { if (m.type() === 'error') { const t = m.text(); if (!/Failed to load resource|ERR_INTERNET|net::ERR|favicon|status of 50[23]|preload/.test(t)) J.erreurs.push('console ' + t.slice(0, 200)); } });
  await pg.addInitScript(([s]) => { try { localStorage.setItem('vrm_acces_direct', '1'); if (s) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, [sombre]);
  // Les minuteries : combien restent actives (une fuite grossit d'un onglet à l'autre).
  await pg.addInitScript(() => {
    const vivantes = new Set(); const si = window.setInterval, ci = window.clearInterval;
    window.setInterval = function (...a) { const id = si.apply(this, a); vivantes.add(id); return id; };
    window.clearInterval = function (id) { vivantes.delete(id); return ci.call(this, id); };
    window.__minuteries = () => vivantes.size;
  });
  if (cond === 'grand') await pg.addInitScript(() => { document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = 'html{font-size:135% !important}'; document.head.appendChild(s); }); });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (/supabase\.co/.test(r.request().url()) ? r.fallback() : r.abort()));
  await pg.route('**/rest/v1/**', async (route) => {
    const rq = route.request(); const url = rq.url();
    J.lectures.push({ m: rq.method(), u: decodeURIComponent(url).replace(/^.*\/rest\/v1\//, ''), t: Date.now() });
    if (cond === 'panne') return route.fulfill({ status: 503, contentType: 'text/html', headers: { 'access-control-allow-origin': '*' }, body: '<html>503</html>' });
    if (cond === 'lente') await new Promise((r) => setTimeout(r, 8000));
    if (rq.method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' }).catch(() => {});
    const h = await rq.allHeaders().catch(() => ({}));
    const rep = repondre(url, h.range, base);
    return route.fulfill({ status: rep.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', ...(rep.headers || {}) }, body: JSON.stringify(rep.body) }).catch(() => {});
  });
  await pg.route('**/api/**', (r) => (cond === 'panne' && !/mode=confidentialite/.test(r.request().url()) ? r.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false}' })
    : r.fulfill({ status: 200, contentType: 'application/json', body: /mode=abonnement/.test(r.request().url()) ? '{"ok":true,"acces":true,"statut":"active","configure":true}' : '{"pret":true,"devices":1}' })));
  return { ctx, pg, J };
}

const sonde = (pg, tactile) => pg.evaluate((tactile) => {
  const vis = (e) => { const b = e.getBoundingClientRect(); const s = getComputedStyle(e); return b.width > 0 && b.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !e.closest('[inert],[aria-hidden="true"],[hidden]'); };
  const texte = (document.body.innerText || '').replace(/\s+/g, ' ');
  const faux = (texte.match(/.{0,40}(\bundefined\b|\bNaN\b|\[object Object\]|\bnull €|Infinity).{0,40}/g) || []).slice(0, 3);
  const garde = [...document.querySelectorAll('[data-garde-ecran],[data-garde-morceau]')].filter((e) => vis(e)).map((e) => e.getAttribute('data-garde-morceau') || e.getAttribute('data-garde-ecran') || '?');
  const souci = /Cet écran a un souci|Something went wrong/i.test(texte);
  const deborde = document.documentElement.scrollWidth > window.innerWidth + 1 ? document.documentElement.scrollWidth : 0;
  let petites = [];
  if (tactile) {
    for (const e of document.querySelectorAll('button, a[href], [role="button"], input:not([type=hidden]), select')) {
      if (!vis(e) || e.closest('p, li > span') && e.tagName === 'A') continue;
      const b = e.getBoundingClientRect();
      if (b.bottom < 0 || b.top > window.innerHeight * 3) continue;
      // La zone étendue (::before / ::after en absolu) compte.
      let w = b.width, h = b.height;
      for (const ps of ['::before', '::after']) { const s = getComputedStyle(e, ps); if (s.position === 'absolute' && s.content !== 'none') { const ins = (k) => parseFloat(s[k]) || 0; w = Math.max(w, b.width - ins('left') - ins('right')); h = Math.max(h, b.height - ins('top') - ins('bottom')); } }
      if (w < 43.5 || h < 43.5) petites.push(`${(e.innerText || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 24)} ${Math.round(w)}×${Math.round(h)}`);
    }
  }
  // Un mot coupé au milieu par un débordement caché (texte plus large que sa boîte, sans « … »).
  const coupes = [];
  for (const e of document.querySelectorAll('h1,h2,h3,button,[role="row"] span,.n-rangee-titre,.n-titre')) {
    if (!vis(e) || !e.childElementCount === false) continue;
    const s = getComputedStyle(e);
    // La largeur du TEXTE (une plage), pas `scrollWidth` : un grand titre à approche négative débordait de 1 à 3 px sans rien couper.
    if (e.getBoundingClientRect().width <= 2) continue;   // texte pour lecteur d'écran seul (`vrm-sr-seul`, 1 px)
    const rg = document.createRange(); rg.selectNodeContents(e); const lt = rg.getBoundingClientRect().width;
    if (lt > e.getBoundingClientRect().width + 2 && s.overflowX !== 'visible' && s.textOverflow !== 'ellipsis' && !/clamp/.test(s.webkitLineClamp || '') && s.whiteSpace !== 'normal') coupes.push((e.innerText || '').trim().slice(0, 30));
    if (coupes.length > 4) break;
  }
  return { texte: texte.slice(0, 160), faux, garde, souci, deborde, petites: petites.slice(0, 8), nPetites: petites.length, coupes, minuteries: window.__minuteries ? window.__minuteries() : -1 };
}, tactile);

async function main() {
  await new Promise((r) => srv.listen(0, r));
  const PORT = srv.address().port;
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  const resume = [];
  try {
    for (const cond of CONDS) for (const W of TAILLES) {
      const base = BASES[cond]();
      const { ctx, pg, J } = await ouvrir(nav, cond, W, base);
      const tactile = W < 600;
      const minut = [], premiere = {};
      try {
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('.vrm-main, main', { timeout: 30000 }).catch(() => {});
        // L'écran de démarrage (index.html) posé par-dessus : ce qu'il cache, personne ne le lit.
        await pg.waitForFunction(() => { const d = document.getElementById('vrm-demarrage'); return !d || d.hasAttribute('data-sortie') || getComputedStyle(d).opacity === '0'; }, null, { timeout: 40000 }).catch(() => {});
        for (const tab of ONGLETS) {
          const T = `[${cond} ${W} ${tab}${HORS_CHANTIER.has(tab) ? ' (autre chantier)' : ''}]`;
          const avant = J.erreurs.length, l0 = J.lectures.length, t0 = Date.now();
          await pg.evaluate((t) => { try { window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=' + t })); } catch (_) {} }, tab);
          await pg.waitForTimeout(cond === 'lente' ? 3000 : 2500);
          let s = await sonde(pg, tactile);
          dit(s.minuteries >= 0 && /localhost/.test(pg.url()), `${T} la page est bien l'app`, pg.url());
          await pg.screenshot({ path: path.join(SORTIE, `${cond}-${W}-${tab}.png`) }).catch(() => {});
          // La première rangée (la fiche), puis on revient.
          const rang = pg.locator('[data-vn-rang], [data-fiche-ligne], .n-rangee[role="button"], [data-eg-article]').filter({ visible: true }).first();
          let fiche = null;
          if (await rang.count().catch(() => 0)) {
            await rang.click({ timeout: 3000 }).catch(() => {});
            await pg.waitForTimeout(1500);
            fiche = await sonde(pg, tactile);
            await pg.screenshot({ path: path.join(SORTIE, `${cond}-${W}-${tab}-fiche.png`) }).catch(() => {});
            await pg.keyboard.press('Escape').catch(() => {});
            // Jamais `goBack` : sans entrée poussée, il quitte l'app (about:blank) et tout le reste se jugeait sur une page vide.
            if (!pg.url().startsWith(`http://localhost:${PORT}`)) await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
            await pg.evaluate((t) => { try { window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=' + t })); } catch (_) {} }, tab);
            await pg.waitForTimeout(800);
          }
          const err = J.erreurs.slice(avant);
          const lect = J.lectures.slice(l0).filter((x) => x.m === 'GET' && x.t - t0 < 12000);
          const comptes = {}; for (const x of lect) comptes[x.u] = (comptes[x.u] || 0) + 1;
          const doubles = Object.entries(comptes).filter(([, n]) => n > 3).map(([u, n]) => `${n}× ${u.slice(0, 120)}`);
          dit(!err.length, `${T} aucune erreur JS / console`, err.join(' ¦ '));
          dit(!s.souci && !s.garde.length, `${T} pas de garde-fou`, s.garde.join(',') + ' ' + s.texte);
          dit(!s.deborde, `${T} rien ne déborde à l'horizontale`, s.deborde);
          dit(!s.faux.length, `${T} aucun « undefined / NaN / [object Object] » à l'écran`, s.faux.join(' | '));
          if (tactile) dit(!s.nPetites, `${T} cibles ≥ 44 px au doigt`, `${s.nPetites} : ${s.petites.join(' · ')}`);
          dit(!s.coupes.length, `${T} aucun texte coupé sans « … »`, s.coupes.join(' | '));
          dit(!doubles.length, `${T} aucune lecture répétée plus de 3 fois en 12 s`, doubles.join(' ¦ '));
          if (fiche) {
            dit(!fiche.souci && !fiche.garde.length, `${T} fiche : pas de garde-fou`, fiche.garde.join(',') + ' ' + fiche.texte);
            dit(!fiche.faux.length, `${T} fiche : aucun « undefined / NaN »`, fiche.faux.join(' | '));
            dit(!fiche.deborde, `${T} fiche : rien ne déborde`, fiche.deborde);
          }
          // Une fuite : le MÊME onglet, revu, n'a pas plus de minuteries qu'à sa première visite (les singletons démarrés une fois sont permis).
          if (premiere[tab] == null) premiere[tab] = s.minuteries;
          minut.push(`${tab}:${s.minuteries}`);
          // CLICS=1 : chaque bouton visible de l'onglet (25 au plus), un par un — une erreur, un garde-fou, une page quittée.
          if (process.env.CLICS) {
            const n = await pg.evaluate(() => { const vis = (e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && b.top < window.innerHeight * 2 && !e.closest('nav, [inert], [aria-hidden="true"]'); };
              const l = [...document.querySelectorAll('.vrm-main button, .vrm-main [role="button"], .vrm-main a[href^="?"], .vrm-main a[href^="/?"]')].filter(vis).slice(0, 25); l.forEach((e, i) => e.setAttribute('data-chasse-clic', String(i))); return l.length; });
            for (let i = 0; i < n; i++) {
              const avant = J.erreurs.length;
              const b = pg.locator(`[data-chasse-clic="${i}"]`);
              const nom = await b.evaluate((e) => (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 30)).catch(() => null);
              if (nom == null || /déconnecter|supprimer|effacer|vider|fermer mon compte|retirer/i.test(nom)) continue;
              await b.click({ timeout: 2000 }).catch(() => {});
              await pg.waitForTimeout(700);
              const x = await sonde(pg, false).catch(() => null);
              dit(J.erreurs.length === avant, `${T} clic « ${nom} » : aucune erreur`, J.erreurs.slice(avant).join(' ¦ '));
              if (x) dit(!x.souci && !x.garde.length && !x.faux.length, `${T} clic « ${nom} » : ni garde-fou ni « undefined »`, x.garde.join(',') + ' ' + x.faux.join(' | '));
              await pg.keyboard.press('Escape').catch(() => {});
              if (!pg.url().startsWith(`http://localhost:${PORT}`)) await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
              await pg.evaluate((t) => { try { window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=' + t })); } catch (_) {} }, tab);
              await pg.waitForTimeout(500);
              await pg.evaluate((k) => { const l = [...document.querySelectorAll('.vrm-main button, .vrm-main [role="button"], .vrm-main a[href^="?"], .vrm-main a[href^="/?"]')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && b.top < window.innerHeight * 2 && !e.closest('nav, [inert], [aria-hidden="true"]'); }).slice(0, 25); l.forEach((e, j) => e.setAttribute('data-chasse-clic', String(j))); }, i).catch(() => {});
            }
          }
        }
        // Une fuite de minuteries : après le tour, les minuteries uniques (démarrées une fois par l'app) sont toutes là ; un second
        // passage sur Ma journée, Ventes et Achats ne doit rien ajouter à ce qu'il y avait au DERNIER onglet du tour.
        const apresTour = Number(String(minut[minut.length - 1] || ':0').split(':').pop());
        for (const t of (cond === 'lente' ? [] : ['journee', 'ventes', 'achats']).filter((x) => ONGLETS.includes(x))) {
          await pg.evaluate((x) => { try { window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=' + x })); } catch (_) {} }, t);
          await pg.waitForTimeout(2500);
          const v = await pg.evaluate(() => (window.__minuteries ? window.__minuteries() : -1));
          dit(v <= Math.max(apresTour, premiere[t] == null ? 0 : premiere[t]) + 2, `[${cond} ${W} ${t}] revu après le tour : les minuteries ne s'accumulent pas (fin du tour ${apresTour}, 1re visite ${premiere[t]} → ${v})`);
        }
        const fin = await pg.evaluate(() => (window.__minuteries ? window.__minuteries() : -1));
        resume.push(`${cond} ${W} : minuteries ${minut.join(' ')} → ${fin}`);
      } catch (e) { dit(false, `[${cond} ${W}] le parcours a pu jouer`, e && e.message); }
      await ctx.close();
    }
  } finally { await nav.close(); srv.close(); }
  for (const l of resume) console.log('  · ' + l);
  console.log(`\n${nOk} OK · ${rouges.length} KO · captures : ${SORTIE}`);
  process.exit(rouges.length ? 1 : 0);
}
main();
