// Banc (10 nov.) : COLIS PROPRE + LOGOS + « POINT RELAIS CHANGÉ ». Julien, captures iPhone du 10 nov. :
//  « Je veux que ce soit le logo Mondial Relay et Chronopost » ; « Enlève imprime bordereaux … garde tout
//  imprimer » ; « Enlève ça, car c'est déjà marqué au-dessus » (bandeaux e-mails) ; « Votre colis a changé
//  de plan … Regarde le colis a pas été livré c'est pas bon ». Données INVENTÉES (dépôt public).
// Exige (jugé sur data-* et nombres, §6.4), à 390 tactile clair/sombre et 1512 clair/sombre :
//  P1 le colis redirigé n'est PAS compté à retirer (`vrm_colis_retirer` = 2, pas 3) ;
//  P2 l'alerte ambre « Point relais changé » est là, avec le nouveau point LU et un lien « Itinéraire »
//     vers son adresse (44 px au doigt) ;
//  P3 les logos sont les VRAIS dessins (Mondial Relay : un tracé, plus le sigle « MR ») ;
//  P4 plus de ligne « prochain geste », ni « N comptes n'envoient aucun e-mail », ni « N colis de X » ;
//  P5 le mot « inconnu » n'est écrit nulle part dans l'écran ; rien ne déborde ; aucune erreur.
// Rouge sur origin/main (P1, P2, P3, P4). Captures dans SHOTS.
const path = require('path');
let chromium, PW;
try { PW = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright')); }
catch (_) { PW = require('playwright'); }
({ chromium } = PW);
// (6 nov., filet 6) `NAVIGATEUR=webkit` : le moteur de Safari (_navigateur.cjs).
const { lancer, estWebkit } = require('./_navigateur.cjs');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4421);
const SHOTS = process.env.SHOTS || '';
const maintenant = new Date(2026, 10, 10, 10, 0, 0);
const MS = maintenant.getTime(), J = 864e5;
const iso = (t) => new Date(t).toISOString();
const ilYa = (j) => iso(MS - j * J);
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(MS) }];
const cap = iso(MS);
// Données INVENTÉES (dépôt public) à la forme des vraies lignes `email_track_*`.
// · 90000001 : arrivé au relais Mondial Relay, code connu ⇒ à retirer (son logo) ;
// · 87654321 : « Votre colis a changé de plan » RANGÉ AVANT LA RÈGLE en « Arrivé au point de retrait »
//   (la forme de la ligne de Julien) : la relecture doit la remettre EN ROUTE, alerte ambre, nouveau point lu ;
// · 90000003 : arrivé chez Chronopost (n° de forme stricte), code connu.
const track = (id, d) => ({ id, data: Object.assign({ type: 'suivi', receivedAt: ilYa(0.2), emailAt: ilYa(0.2), arriveLe: ilYa(0.2), consigne: false, account: 'compte_a' }, d) });
const TRACKS = [
  track('email_track_mondialrelay_90000001', { carrier: 'mondialrelay', suivi: '90000001', status: 'available', statusLabel: 'Arrivé au point de retrait', subject: 'Votre colis 90000001 est disponible', code: '012345', lieu: 'TABAC DE LA HOULE, 2 Quai Gambetta, 35260 Cancale' }),
  track('email_track_mondialrelay_87654321', { carrier: 'mondialrelay', suivi: '87654321', status: 'available', statusLabel: 'Arrivé au point de retrait', subject: 'Votre colis a changé de plan', code: null, lieu: 'INTERMARCHE EXEMPLE, 4 Avenue de l’Essai, 35350 Saint-Méloir-des-Ondes' }),
  track('email_track_chronopost_XW123456789FR', { carrier: 'chronopost', suivi: 'XW123456789FR', status: 'available', statusLabel: 'Arrivé au point de retrait', subject: 'Votre colis est arrivé en relais Pickup', code: '654321', lieu: 'PRESSE DU PORT, 1 Rue du Port, 35260 Cancale' }),
];
const LIGNES = [
  { id: 'main', data: { vrm_ville: 'Cancale' } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: cap, payload: { my_orders: [] } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: cap, payload: { my_orders: [] } } },
  ...TRACKS,
];
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 200)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.mjs': 'text/javascript' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);

const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = cap; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? String(v) : v);
  }
  return out;
};
const TEINTES = ['#dfe3e8', '#e8e1d8', '#dfe5dd', '#e6dcdc', '#e2dfe8', '#e8e4d6'];
const photoSvg = (k) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${TEINTES[k % 6]}"/><path d="M60 250 C80 190 150 175 190 200 C230 222 285 205 330 232 C352 246 346 282 306 284 L84 284 C62 284 52 268 60 250 Z" fill="rgba(30,34,40,.62)"/><path d="M60 284 L330 284 L326 300 L66 300 Z" fill="rgba(255,255,255,.85)"/><text x="200" y="120" font-size="90" text-anchor="middle" fill="rgba(0,0,0,.35)" font-family="sans-serif">${k}</text></svg>`;
const sacSvg = (c) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#efe9df"/><rect x="110" y="150" width="180" height="170" rx="18" fill="${c}"/><path d="M150 150 C150 80 250 80 250 150" stroke="${c}" stroke-width="16" fill="none"/></svg>`;

const ouvrir = async (b, vp, sombre) => {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_visite_vue', JSON.stringify(true)); } catch (_) {} }, !!sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    const m = /images1\.vinted\.net\/t\/b(\d+)\//.exec(u);
    if (m) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: photoSvg(Number(m[1])) });
    if (/api-adresse\.data\.gouv\.fr/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ features: [] }) });
    if (/\/favicon\.ico$/i.test(u)) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect x="4" y="4" width="24" height="24" rx="5" fill="#8e8e93"/></svg>' });
    return ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue();
  });
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    if (route.request().method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: cap, cap: r.data.capturedAt });
    const filtres = [...u.matchAll(/[?&]data->>([a-zA-Z_]+)=(not\.)?is\.null/g)];
    const passe = (r) => filtres.every(([, k, non]) => (r.data[k] == null) === !non);
    const inn = /[?&]id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(',').map((x) => x.replace(/^"|"$/g, '')); return j(LIGNES.filter((r) => ids.includes(r.id) && passe(r)).map(forme)); }
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1] && passe(r)).map(forme));
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id) && passe(r)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs };
};

(async () => {
  const b = await lancer(PW, { executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch((e) => { if (estWebkit) throw e; return chromium.launch(); });
  try {
    for (const [vp, sombre, nom] of [[{ width: 390, height: 844 }, false, '390-clair'], [{ width: 390, height: 844 }, true, '390-sombre'], [{ width: 1512, height: 982 }, false, '1512-clair'], [{ width: 1512, height: 982 }, true, '1512-sombre']]) {
      console.log(`\n— Colis → À retirer · ${nom}`);
      const { ctx, pg, errs } = await ouvrir(b, vp, sombre);
      await essaie(nom, async () => {
        await pg.locator('[data-colis-section]').first().waitFor({ timeout: 30000 });
        await pg.waitForFunction(() => { try { return !!JSON.parse(localStorage.getItem('vrm_colis_retirer') || 'null'); } catch (_) { return false; } }, null, { timeout: 20000 }).catch(() => {});
        await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=retraits' }))); /* (11 nov., lot DJ3) « À retirer » est en tête d'Achats */ await pg.locator('[data-colis-section="achats"]').first().waitFor({ timeout: 30000 });
        await pg.waitForSelector('[data-rp-redirige="1"]', { state: 'attached', timeout: 12000 }).catch(() => {});
        await pg.evaluate(() => { document.querySelectorAll('.vrm-rpf details[data-rp-section="route"]').forEach((d) => { d.open = true; }); });
        await pg.waitForTimeout(1500);
        const m = await pg.evaluate(() => {
          const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
          const main = document.querySelector('.vrm-main');
          // (13 nov.) Le colis « point changé » : UNE ligne sous son nouveau point, dans « En route » (plus de carte à part).
          const ligne = document.querySelector('[data-rp-redirige="1"][data-cc-carte="r:rc:87654321"]');
          const a = ligne && ligne.closest('.vrm-rpf-point');
          const it = a && a.querySelector('[data-relais-itineraire]');
          const mr = [...document.querySelectorAll('[data-marque="mondialrelay"]')].filter(vis);
          const ch = [...document.querySelectorAll('[data-marque="chronopost"]')].filter(vis);
          return {
            pub: JSON.parse(localStorage.getItem('vrm_colis_retirer') || 'null'),
            alerte: a ? { vis: vis(ligne), txt: ligne.innerText, lieu: ((a.querySelector('.vrm-rpf-nom') || {}).textContent || '') + ', ' + ((a.querySelector('[data-relais-adresse]') || {}).textContent || ''), href: it ? it.getAttribute('href') : '', h: it ? Math.round(it.getBoundingClientRect().height) : 0, bord: getComputedStyle(a).borderTopColor } : null,
            mr: mr.length, mrTrace: mr.some((x) => !!x.querySelector('path') && !/^\s*MR\s*$/.test(x.textContent || '')),
            ch: ch.length,
            prochain: document.querySelectorAll('[data-colis-prochain]').length,
            muets: document.querySelectorAll('[data-colis-comptes-muets]').length,
            arelier: document.querySelectorAll('[data-colis-a-relier]').length,
            inconnu: /inconnu/i.test(main ? main.innerText : ''),
            deb: document.documentElement.scrollWidth - window.innerWidth,
          };
        });
        const N = m.pub && Number.isFinite(m.pub.total) ? m.pub.total : null;
        dit(N === 2, 'P1 le colis redirigé n’est PAS compté à retirer (2 colis, pas 3)', JSON.stringify(m.pub));
        dit(!!(m.alerte && m.alerte.vis && /point changé/.test(m.alerte.txt)), 'P2 le colis redirigé est une ligne « En route · point changé » (plus de carte à part)', JSON.stringify(m.alerte));
        dit(!!(m.alerte && /Intermarché Exemple|INTERMARCHE EXEMPLE/i.test(m.alerte.lieu) && /35350/.test(m.alerte.lieu)), 'P2 sous son nouveau point LU (nom + adresse)', m.alerte && m.alerte.lieu);
        dit(!!(m.alerte && /maps/.test(m.alerte.href) && /intermarch/i.test(decodeURIComponent(m.alerte.href))), 'P2 « Itinéraire » vers l’adresse lue', m.alerte && `${m.alerte.href} · ${m.alerte.h}px`);
        dit(m.mr > 0 && m.mrTrace, 'P3 le logo Mondial Relay est le vrai dessin (tracé, plus le sigle « MR »)', `${m.mr} / ${m.mrTrace}`);
        dit(m.ch > 0, 'P3 le logo Chronopost est montré pour le colis Chronopost', String(m.ch));
        dit(m.prochain === 0 && m.muets === 0 && m.arelier === 0, 'P4 plus de ligne « prochain geste » ni de bandeau e-mails doublon', JSON.stringify({ p: m.prochain, mu: m.muets, ar: m.arelier }));
        dit(!m.inconnu, 'P5 le mot « inconnu » n’est écrit nulle part dans l’écran');
        dit(m.deb <= 0, 'P5 aucun débordement horizontal', String(m.deb));
        if (SHOTS) {
          const el = pg.locator('[data-rp-redirige="1"]').first();
          if (await el.count()) await el.scrollIntoViewIfNeeded().catch(() => {});
          await pg.screenshot({ path: path.join(SHOTS, `colis-propre-${nom}.png`) });
          await pg.locator('[data-colis-onglet-choix="envoyer"]').first().click().catch(() => {});
          await pg.waitForTimeout(1200);
          await pg.screenshot({ path: path.join(SHOTS, `colis-propre-envoyer-${nom}.png`) });
        }
      });
      dit(errs.length === 0, 'P5 aucune erreur de page', errs.slice(0, 2).join(' | '));
      await ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s), ${ok} vert(s)` : `\n✅ Colis propre + logos + point relais changé : ${ok} verts`);
  process.exit(ko ? 1 : 0);
})();
