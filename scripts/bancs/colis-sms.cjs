// Banc : LES COLIS ANNONCÉS PAR SMS (6 nov.) — Colis → À retirer, et la carte
// Réglages → Notifications → « SMS Mondial Relay ».
// Les lignes sont fabriquées par la VRAIE règle du serveur (api/_lib/sms-mondialrelay.js :
// `lireSmsMondialRelay` puis `ligneSms`), à partir de SMS INVENTÉS de la forme réelle :
// deux casiers différents (INTERMARCHÉ, SUPER U), reliés à AUCUN achat, et un SMS de forme
// pas apprise (n° seul). Exige (data-* et nombres, §6.4) : vrm_colis_retirer = 2 ; DEUX
// cartes de point (« Casier 24/7 Intermarché », « Casier 24/7 Super U ») ; le code de chaque
// colis ; au toucher : « Reçu par SMS Mondial Relay · achat pas encore relu », « En grand » ;
// le SMS pas reconnu dans « À vérifier » (jamais compté, jamais caché) ; la carte Réglages
// (créer le jeton ⇒ adresse ; « Tester » ⇒ résultat de l'essai) ; rien ne déborde ; aucune
// erreur. 390 tactile clair/sombre + 1512.   BANC_PORT (10450-10499), SHOTS=<dossier>.
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 10461);
const SHOTS = process.env.SHOTS || '';
const VUES = process.env.JR_VUES ? process.env.JR_VUES.split(',') : null;
const maintenant = new Date(2026, 10, 6, 10, 0, 0);
const MS = maintenant.getTime();
const iso = (t) => new Date(t).toISOString();
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(MS) }];
const cap = iso(MS);
const SMS = [
  ['Votre colis 81234567 est disponible au LOCKER 24/7 INTERMARCHÉ. Retirez-le vite avec le code 712345. Détails sur l\'app mrcolis.fr', iso(MS - 2 * 3600e3)],
  ['Votre colis 41234568 est disponible au LOCKER 24/7 SUPER U. Retirez-le vite avec le code 154321. Détails sur l\'app mrcolis.fr', iso(MS - 26 * 3600e3)],
  ['Mondial Relay : votre colis 87654321 rencontre un incident, consultez mrcolis.fr', iso(MS - 3600e3)],
];
let LIGNES = null;
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

const ouvrir = async (b, vp, sombre, tab, init = {}) => {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const essais = [];
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript(([s, i]) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_visite_vue', JSON.stringify(true)); for (const [k, v] of Object.entries(i)) localStorage.setItem(k, v); } catch (_) {} }, [!!sombre, init]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    if (/vrm\.center\/api\/widget\?mode=sms/.test(u)) { essais.push(r.request().postData() || ''); return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ok: true, essai: true, range: false, message: 'Essai : Colis …0001 rangé · code ✓ · LOCKER 24/7 EXEMPLE (rien n\'a été rangé)' }) }); }
    if (/api-adresse\.data\.gouv\.fr/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ features: [] }) });
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
  // Playwright prend la DERNIÈRE route en premier (§6.6) : l'essai des SMS est servi ici.
  await pg.route('**/api/**', (r) => {
    if (/\/api\/widget\?mode=sms&k=[A-Za-z0-9]{32}$/.test(r.request().url()) && r.request().method() === 'POST') { essais.push(r.request().postData() || ''); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, essai: true, range: false, message: 'Essai : Colis …0001 rangé · code ✓ · LOCKER 24/7 EXEMPLE (rien n\'a été rangé)' }) }); }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' });
  });
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs, essais };
};

(async () => {
  const lib = await import('file://' + path.join(__dirname, '..', '..', 'api', '_lib', 'sms-mondialrelay.js'));
  const lignesSms = SMS.map(([t, at]) => { const lu = lib.lireSmsMondialRelay({ texte: t, expediteur: 'MRELAY' }); const l = lib.ligneSms(lu, null, { smsAt: at, maintenant: at }); return { id: lib.idLigneSms(lu.suivi), data: l.data }; });
  LIGNES = [
    { id: 'main', data: { vrm_ville: 'Cancale' } },
    { id: 'harvest_111_orders_purchased', data: { capturedAt: cap, payload: { my_orders: [] } } },
    { id: 'harvest_111_orders_sold', data: { capturedAt: cap, payload: { my_orders: [] } } },
    { id: 'panel_colis_relais', data: {} },
    ...lignesSms,
  ];
  srv.listen(PORT);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch(() => chromium.launch());
  try {
    for (const [vp, sombre, nom] of [[{ width: 390, height: 844 }, false, '390-clair'], [{ width: 390, height: 844 }, true, '390-sombre'], [{ width: 1512, height: 982 }, false, '1512-clair']]) {
      if (VUES && !VUES.includes(nom)) continue;
      console.log(`\n— Colis → À retirer (SMS) · ${nom}`);
      const { ctx, pg, errs } = await ouvrir(b, vp, sombre, 'cat_bord');
      await essaie('retirer', async () => {
        await pg.locator('[data-colis-section]').first().waitFor({ timeout: 30000 });
        await pg.waitForFunction(() => { try { return !!JSON.parse(localStorage.getItem('vrm_colis_retirer') || 'null'); } catch (_) { return false; } }, null, { timeout: 20000 }).catch(() => {});
        await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=retraits' }))); /* (11 nov., lot DJ3) « À retirer » est en tête d'Achats */ await pg.locator('[data-colis-section="achats"]').first().waitFor({ timeout: 30000 });
        await pg.waitForTimeout(2500);
        const m = await pg.evaluate(() => {
          const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
          const pub = JSON.parse(localStorage.getItem('vrm_colis_retirer') || 'null');
          const lignes = [...document.querySelectorAll('.vrm-rpf [data-cc-carte]')];
          return {
            pub, onglet: (document.querySelector('[data-colis-onglet-choix="retirer"]') || { getAttribute: () => null }).getAttribute('data-colis-onglet-n'),
            points: [...document.querySelectorAll('.vrm-rpf-section:not(.is-repli) .vrm-rpf-point:not(.vrm-rpf-verifier)')].map((p) => ({ nom: ((p.querySelector('.vrm-rpf-nom') || {}).textContent || '').trim(), n: p.querySelectorAll('[data-cc-carte]').length })),
            comptes: lignes.filter((l) => !l.hasAttribute('data-hors-compte')).map((l) => ({ id: l.getAttribute('data-cc-carte'), code: !!l.querySelector('[data-rp-code]') })),
            verif: (() => { const d = document.querySelector('.vrm-rpf-verifier'); return d ? d.getAttribute('data-retirer-a-verifier') : null; })(),
            deb: document.documentElement.scrollWidth - window.innerWidth,
            hors: [...document.querySelectorAll('.vrm-main *')].filter((e) => vis(e) && !e.closest('svg,.vrm-rangee,.vrm-filtres,[data-defile],.maplibregl-map') && getComputedStyle(e).position !== 'fixed' && e.getBoundingClientRect().right > window.innerWidth + 1).map((e) => String(e.className).slice(0, 40)).slice(0, 4),
          };
        });
        dit(m.pub && m.pub.total === 2, 'vrm_colis_retirer = 2 (les deux casiers annoncés par SMS)', JSON.stringify(m.pub && { total: m.pub.total }));
        dit(m.onglet === '2', '« À retirer · 2 »', m.onglet);
        const noms = m.points.map((p) => p.nom).sort();
        dit(noms.length === 2 && noms[0] === 'Casier 24/7 Intermarché' && noms[1] === 'Casier 24/7 Super U' && m.points.every((p) => p.n === 1), 'deux casiers différents ⇒ deux cartes, nommées « Casier 24/7 … »', JSON.stringify(m.points));
        dit(m.comptes.length === 2 && m.comptes.every((c) => c.code), 'chaque colis SMS montre son code', JSON.stringify(m.comptes));
        dit(m.verif === '1', 'le SMS pas reconnu est dans « À vérifier · 1 » (visible, hors compte)', m.verif);
        dit(m.deb <= 1 && !m.hors.length, 'rien ne déborde', `${m.deb}px ${m.hors.join(' | ')}`);
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `sms-retirer-${nom}.png`) });
        // Le détail au toucher : reçu par SMS, achat pas encore relu, « En grand ».
        await pg.locator('[data-cc-carte*="81234567"] .vrm-rpf-ouvrir').first().click();
        await pg.waitForTimeout(400);
        const det = await pg.evaluate(() => { const l = document.querySelector('[data-cc-carte*="81234567"]'); const d = l && l.querySelector('[data-rp-detail]'); if (!d) return null; const s = d.querySelector('[data-colis-sms]');
          return { sms: s && s.getAttribute('data-colis-sms'), sans: s && s.getAttribute('data-colis-sans-achat'), txt: s ? s.textContent : '', grand: !!d.querySelector('[data-colis-plein-ecran]'), code: /712345/.test(d.innerText.replace(/\s/g, '')) }; });
        dit(!!det && det.sms === 'sms' && det.sans === '1' && /Reçu par SMS Mondial Relay · achat pas encore relu/.test(det.txt), '« Reçu par SMS Mondial Relay · achat pas encore relu »', JSON.stringify(det));
        dit(!!det && det.grand && det.code, '« En grand » et le code 712345 dans le détail', JSON.stringify(det));
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `sms-retirer-detail-${nom}.png`) });
        await pg.locator('[data-cc-carte*="81234567"] [data-colis-plein-ecran]').first().click();
        await pg.waitForTimeout(500);
        const grand = await pg.evaluate(() => /712345/.test(document.body.innerText.replace(/\s/g, '')) && !!document.querySelector('[role="dialog"], .vrm-sheet, [data-qr-vue], .vrm-qr-view'));
        dit(grand, '« En grand » ouvre le code en grand', String(grand));
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `sms-en-grand-${nom}.png`) });
      });
      dit(!errs.length, 'aucune erreur d’app', errs.join(' | ').slice(0, 300));
      await ctx.close();

      console.log(`— Réglages → SMS Mondial Relay · ${nom}`);
      const R2 = await ouvrir(b, vp, sombre, 'settings', { vrm_reglages_vue: 'reglages' });
      await essaie('reglages', async () => {
        const pg = R2.pg;
        await pg.locator('[data-sous-ouvrir="sms-colis"]').first().waitFor({ timeout: 30000 });
        const val = await pg.evaluate(() => (document.querySelector('[data-sous-ouvrir="sms-colis"]') || {}).getAttribute('data-reglage-sms'));
        dit(val === 'aucun', 'ligne « SMS Mondial Relay » : à activer', val);
        await pg.locator('[data-sous-ouvrir="sms-colis"]').first().click();
        await pg.locator('[data-sms-creer]').first().waitFor({ timeout: 10000 });
        const etapes = await pg.evaluate(() => [...document.querySelectorAll('[data-sms-etape]')].map((e) => e.getAttribute('data-sms-etape')));
        dit(etapes.join(',') === 'automatisation,declencheur,immediat,url,post,vestiaire', 'le pas-à-pas : 6 étapes en liste courte numérotée (Vestiaire comprise, 9 nov.)', etapes.join(','));
        await pg.locator('[data-sms-creer]').first().click();
        // `save` écrit le stockage après son délai (debounce) : on attend la valeur, jamais un délai fixe (§6.5).
        await pg.waitForFunction(() => /[A-Za-z0-9]{32}/.test(localStorage.getItem('vrm_sms_token') || ''), null, { timeout: 8000 }).catch(() => {});
        if (SHOTS) { await pg.locator('[data-sms-colis]').first().scrollIntoViewIfNeeded().catch(() => {}); await pg.screenshot({ path: path.join(SHOTS, `sms-reglage-${nom}.png`) }); }
        const a = await pg.evaluate(() => ({ url: (document.querySelector('[data-sms-url]') || {}).textContent || '', jeton: localStorage.getItem('vrm_sms_token'), etat: (document.querySelector('[data-sms-colis]') || {}).getAttribute('data-sms-colis') }));
        let jeton = ''; try { jeton = JSON.parse(a.jeton); } catch (_) { jeton = a.jeton || ''; }
        dit(a.etat === 'actif' && /^[A-Za-z0-9]{32}$/.test(jeton) && /^https:\/\/vrm\.center\/api\/widget\?mode=sms&k=/.test(a.url) && !a.url.includes(jeton), 'créer ⇒ jeton de 32 caractères, adresse affichée masquée', JSON.stringify({ url: a.url, etat: a.etat }));
        await pg.locator('[data-sms-voir]').first().click();
        const u2 = await pg.evaluate(() => (document.querySelector('[data-sms-url]') || {}).textContent || '');
        dit(u2 === `https://vrm.center/api/widget?mode=sms&k=${jeton}`, '« Afficher » ⇒ l’adresse exacte', u2);
        await pg.locator('[data-sms-voir]').first().click();
        await pg.locator('[data-sms-tester]').first().click();
        await pg.locator('[data-sms-essai]').first().waitFor({ timeout: 10000 });
        const e = await pg.evaluate(() => { const x = document.querySelector('[data-sms-essai]'); return { etat: x.getAttribute('data-sms-essai'), t: x.textContent }; });
        const corps = R2.essais[0] ? JSON.parse(R2.essais[0]) : {};
        dit(e.etat === 'ok' && /rien n'a été rangé/.test(e.t) && corps.essai === true && /80000001/.test(corps.texte || ''), '« Tester » envoie le SMS d’exemple en mode essai et montre le résultat', JSON.stringify({ e, corps }));
        const deb = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        dit(deb <= 1, 'rien ne déborde', `${deb}px`);
        if (SHOTS) {
          await pg.screenshot({ path: path.join(SHOTS, `sms-reglages-${nom}.png`) });
          if (vp.width < 600) { await pg.setViewportSize({ width: vp.width, height: 2600 }); await pg.waitForTimeout(300); await pg.screenshot({ path: path.join(SHOTS, `sms-reglages-${nom}-long.png`) }); await pg.setViewportSize(vp); }
        }
        await pg.locator('[data-sms-regenerer]').first().click();
        await pg.locator('[data-sms-confirmer]').first().click();
        await pg.waitForFunction((j) => { const v = localStorage.getItem('vrm_sms_token') || ''; return v && !v.includes(j); }, jeton, { timeout: 5000 }).catch(() => {});
        let j2 = ''; { const v = await pg.evaluate(() => localStorage.getItem('vrm_sms_token')); try { j2 = JSON.parse(v); } catch (_) { j2 = v || ''; } }
        dit(/^[A-Za-z0-9]{32}$/.test(j2) && j2 !== jeton, '« Régénérer » (confirmé) ⇒ un autre jeton', '');
        await pg.locator('[data-sms-couper]').first().click();
        await pg.locator('[data-sms-confirmer]').first().click();
        await pg.waitForTimeout(200);
        const c = await pg.evaluate(() => ({ etat: (document.querySelector('[data-sms-colis]') || {}).getAttribute('data-sms-colis'), url: !!document.querySelector('[data-sms-url]') }));
        dit(c.etat === 'coupe' && !c.url, '« Couper » ⇒ plus d’adresse', JSON.stringify(c));
      });
      dit(!R2.errs.length, 'aucune erreur d’app (Réglages)', R2.errs.join(' | ').slice(0, 300));
      await R2.ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
