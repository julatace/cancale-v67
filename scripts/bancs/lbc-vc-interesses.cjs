// BANC : lbc-vc-interesses (20 nov.) — après la construction (BANC_PORT pour le port ; SHOTS=dossier pour les captures).
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 8093;
const SHOTS = process.env.SHOTS || process.env.BANC_SHOTS || '';
// Banc : LEBONCOIN, LES INTÉRESSÉS · VESTIAIRE, LA DATE EN LIGNE (20 nov., lot lbc-vc-interesses, extension 5.410).
// Données INVENTÉES (le dépôt est public). 390 tactile clair, 1512 sombre.
//   A. Vestiaire · Annonces : une date LUE se dit « en ligne depuis le … » ; une borne basse « vue en ligne depuis
//      au moins le … », jamais « depuis le » ; `data-vc-depuis` = exacte | au-moins.
//   B. Messages · Leboncoin · Favoris reçus : la phrase (qui t'a écrit, Leboncoin ne dit pas qui a mis en favori,
//      leur écrire depuis le panneau), « 2 intéressés · 1 attend ta réponse » sur SON annonce, la conversation
//      sans annonce lue comptée à part, la personne qui n'a rien écrit pas comptée ; AUCUN bouton d'envoi.
const MAINTENANT = Date.now(), H = 3600000, J = 24 * H;
const ilYaH = (h) => new Date(MAINTENANT - h * H).toISOString();
const MOI = '11112222', LBC = 'aaaa1111-bbbb-2222-cccc-333344445555';
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: ilYaH(0) }];
const PHOTO = (n) => `https://images.vestiairecollective.com/produit/${n}-1_3.jpg`;
const fil = (conv, o) => ({ id: 'lbc_fil_' + conv, data: Object.assign({ v: 1, conv, compte: LBC, annonce: '2987654321', n: 2, deLuiN: 1, premierDeLuiAt: ilYaH(30), dernierAt: ilYaH(2), dernierDeMoi: false, apercu: 'Toujours dispo ?', messages: [] }, o) });
const lignes = () => [
  { id: 'main', data: { vinted_used_numeros: [1, 2, 3], vinted_annonce_numeros: {} } },
  { id: 'harvest_111_listings', data: { capturedAt: ilYaH(0.1), payload: { items: [] } } },
  { id: 'vc_session', data: { id: MOI, at: ilYaH(0.1), source: 'me' } },
  { id: 'vc_listings', data: { capturedAt: ilYaH(0.3), complet: true, liens: {}, items: {
    71000001: { titre: 'Salomon XT-6', photo: PHOTO(71000001), statut: 'published', vuAt: ilYaH(0.3), compte: MOI, prix: { valeur: 220, devise: 'EUR', cle: 'product.price.cents' }, misEnLigne: '2026-10-30T14:53:37.000Z', vueDepuis: ilYaH(48) },
    71000002: { titre: 'Sac cabas', photo: PHOTO(71000002), statut: 'published', vuAt: ilYaH(0.3), compte: MOI, prix: { valeur: 150, devise: 'EUR', cle: 'product.price.cents' }, misEnLigne: '', vueDepuis: '2026-11-02T20:00:32.174Z' },
  } } },
  { id: 'lbc_accounts', data: { accounts: { ['lbc-account:' + LBC]: { id: 'lbc-account:' + LBC, name: 'Moncompte', type: 'particulier', sessionAt: ilYaH(0.2) } } } },
  { id: 'lbc_listings', data: { items: {
    2987654321: { id: 2987654321, subject: 'Nike Air Max 90 blanche 42', status: 'active', ref: 'VRM-12', account: LBC, price: [80], url: 'https://www.leboncoin.fr/ad/chaussures/2987654321', images: [] },
    2987650000: { id: 2987650000, subject: 'Adidas Samba 41', status: 'active', ref: 'VRM-13', account: LBC, price: [70], url: 'https://www.leboncoin.fr/ad/chaussures/2987650000', images: [] },
  }, lectures: {} } },
  fil('conv-0001'), fil('conv-0002', { dernierDeMoi: true, dernierAt: ilYaH(5) }), fil('conv-0003', { deLuiN: 0, dernierDeMoi: true }), fil('conv-0004', { annonce: '' }),
];
let LIGNES = lignes();
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 200)); } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.onnx': 'application/octet-stream', '.mjs': 'text/javascript' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ')'); process.exit(1); });
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? String(v) : v);
  }
  return out;
};
// Le faux pont de l'extension 5.364 : il note les commandes et répond comme le fond.
const PONT = ({ version }) => {
  window.__cmds = []; window.__VRM_BAISSE_PAUSE = 0;
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, code: version, vrm: { ok: true, connecte: true, email: '' }, vinted: null, cmds: {}, vcOffre: true, vcPrix: true } });
    if (d.__vmr === 'cmd') {
      const c = {}; for (const k of Object.keys(d)) if (!['__vmr', 'reqId'].includes(k)) c[k] = d[k];
      window.__cmds.push(c);
      if (d.cmd === 'vcPrix') { post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: true, etape: 'fait', ancien: d.avantCents / 100, prixVu: d.apresCents / 100 } }); return; }
      post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: true, jobId: 'vc:' + d.id, etape: 'depot' } });
    }
  });
  post({ __vmr: 'ready', version });
};

async function preparer(b, vp, sombre) {
  const ctx = await b.newContext({ viewport: vp, locale: 'fr-FR', colorScheme: sombre ? 'dark' : 'light', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((sombre) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_langue', 'fr'); localStorage.setItem('vinted_dark', JSON.stringify(!!sombre)); localStorage.setItem('vrm_visite_vue', 'true'); } catch (_) {} }, sombre);
  await pg.addInitScript(PONT, { version: '5.410.0' });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    if (/images\.vestiairecollective\.com|img\.test|vinted\.net/.test(r.request().url())) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="300" height="200" fill="#c8b08a"/></svg>' });
    return r.fulfill({ status: 404, body: '' });
  });
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt || ilYaH(0), cap: r.data.capturedAt });
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(LIGNES.filter((r) => ids.includes(r.id)).map(forme)); }
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs };
}
const capture = async (pg, nom) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, 'lvi-' + nom + '.png'), fullPage: false }); };
const sain = async (pg, ecran) => {
  const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, t: document.body.innerText }));
  dit(r.sw <= r.cw + 1, `${ecran} : aucun débordement horizontal`, `${r.sw} > ${r.cw}`);
  const m = /n'a pas pu s'afficher|n’a pas pu s’afficher|Cannot access|is not defined|vcDate\.|interessesLbc\./.exec(r.t);
  dit(!m, `${ecran} : ni garde-fou ni clé de traduction affichée`, m && m[0]);
};

(async () => {
  let b;
  try {
    srv.listen(PORT);
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const [vp, sombre] of [[{ width: 390, height: 844 }, false], [{ width: 1512, height: 950 }, true]]) {
      const nomVp = `${vp.width}${sombre ? '-sombre' : ''}`;
      console.log(`── ${nomVp}`);
      LIGNES = lignes();
      const { ctx, pg, errs } = await preparer(b, vp, sombre);
      await essaie('A. Vestiaire', async () => {
        // (20 nov.) Annonces est la liste UNIQUE (« à égalité ») : l'article Vestiaire y est, et la limite « Vestiaire ne
        // donne pas la date de mise en ligne » n'est plus dite (la date est lue, 5.410). Les rangées de l'ancien écran
        // Vestiaire (`data-vc-depuis`) ne sont plus montées sur cette route ; la phrase « au moins » est jugée par
        // audit-lbc-vc-interesses (A1), sur le module de l'écran.
        await pg.goto(`http://localhost:${PORT}/?tab=annonces&site=vestiaire`, { waitUntil: 'domcontentloaded' });
        await pg.waitForFunction(() => /Sac cabas/.test(document.body.innerText), null, { timeout: 25000 });
        await pg.waitForTimeout(800);
        const t = await pg.evaluate(() => document.body.innerText);
        dit(/Salomon XT-6/.test(t) && /Sac cabas/.test(t), 'A · les deux articles Vestiaire sont dans Annonces');
        dit(!/Vestiaire : le site ne donne pas la date de mise en ligne/.test(t), 'A · la limite « Vestiaire ne donne pas la date de mise en ligne » n’est plus dite (la date est lue)', (/Vestiaire :[^.]*\./.exec(t) || [''])[0]);
        // La date LUE (30 oct.) s'affiche ; la borne basse (2 nov., « au moins ») ne se montre JAMAIS comme une date.
        const rangees = await pg.evaluate(() => [...document.querySelectorAll('tr, li, [role="row"]')].map((e) => e.innerText.replace(/\s+/g, ' ')).filter((x) => /Salomon XT-6|Sac cabas/.test(x) && x.length < 400));
        const sal = rangees.find((x) => /Salomon/.test(x)) || '', sac = rangees.find((x) => /Sac cabas/.test(x)) || '';
        if (vp.width > 1000) dit(/30\/10\/2026/.test(sal), 'A · la date LUE chez Vestiaire est dans la colonne Date', sal);
        dit(!/02\/11\/2026|2 nov/.test(sac), 'A · la borne basse (« au moins ») n’est jamais montrée comme une date de mise en ligne', sac);
        await sain(pg, 'Annonces');
        await capture(pg, 'annonces-' + nomVp);
      });
      await essaie('B. Leboncoin', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=messages`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(2000);
        await pg.click('[data-filtre-site="messages"] [data-site="leboncoin"]', { timeout: 15000 });
        await pg.click('[data-lbc-zone-favoris]', { timeout: 15000 });
        await pg.waitForSelector('[data-interesses-lbc]', { timeout: 20000 });
        await pg.waitForTimeout(500);
        const v = await pg.evaluate(() => {
          const z = document.querySelector('[data-favoris-lbc]');
          const r = (id) => { const e = document.querySelector(`[data-favoris-lbc-annonce="${id}"]`); return e ? { t: e.innerText, n: (e.querySelector('[data-interesses-lbc-annonce]') || {}).getAttribute ? e.querySelector('[data-interesses-lbc-annonce]').getAttribute('data-interesses-lbc-annonce') : null, att: e.querySelector('[data-interesses-lbc-attendent]') ? e.querySelector('[data-interesses-lbc-attendent]').getAttribute('data-interesses-lbc-attendent') : null } : null; };
          return { phrase: (document.querySelector('[data-interesses-lbc-phrase]') || {}).innerText || '', sans: (document.querySelector('[data-interesses-lbc-sans-annonce]') || { getAttribute: () => null }).getAttribute('data-interesses-lbc-sans-annonce'),
            a: r('2987654321'), b: r('2987650000'), boutons: z ? [...z.querySelectorAll('button')].map((x) => x.innerText) : [], etat: (document.querySelector('[data-interesses-lbc]') || {}).getAttribute('data-interesses-lbc') };
        });
        dit(/t’ont écrit/.test(v.phrase) && /ne dit pas qui/.test(v.phrase) && /panneau VRM sur leboncoin\.fr/.test(v.phrase), 'B · la phrase : qui t’a écrit, Leboncoin ne dit pas qui a mis en favori, leur écrire depuis le panneau', v.phrase);
        dit(v.a && v.a.n === '2' && v.a.att === '1' && /2 intéressés · 1 attend ta réponse/.test(v.a.t), 'B · SON annonce : « 2 intéressés · 1 attend ta réponse » (la personne qui n’a rien écrit n’est pas comptée)', v.a && v.a.t.replace(/\n/g, ' · '));
        dit(v.b && v.b.n === null, 'B · une annonce sans conversation : rien d’inventé', v.b && v.b.t.replace(/\n/g, ' · '));
        dit(v.sans === '1', 'B · la conversation dont l’annonce n’est pas lue est comptée à part (pas rangée au hasard)', v.sans);
        dit(v.etat === 'lu', 'B · extension 5.410 à jour : l’état est « lu »', v.etat);
        dit(!v.boutons.some((t) => /écrire|envoyer/i.test(t)), 'B · AUCUN bouton d’envoi dans l’app (le geste est dans le panneau)', v.boutons.join(' | '));
        await sain(pg, 'Messages · Leboncoin · Favoris reçus');
        await capture(pg, 'leboncoin-' + nomVp);
      });
      dit(errs.length === 0, `${nomVp} : aucune erreur d’app`, errs.join(' | ').slice(0, 200));
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ banc lbc-vc-interesses : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ banc lbc-vc-interesses : ${ok} verts`);
  process.exit(ko ? 1 : 0);
})();
