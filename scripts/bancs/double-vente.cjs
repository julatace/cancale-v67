// Banc : VENDUE SUR LEBONCOIN → À RETIRER DE VINTED (anti double vente, 4 octobre).
//
// Julien : « quand une paire est vendue sur une plateforme, elle doit disparaître
// des autres, pour éviter de vendre deux fois la même paire ». Sur des données
// INVENTÉES (il vit dans le dépôt), rendu à 390 et 1512 px, il exige :
//   · une vente Leboncoin reliée (lien posé à la main) à une paire encore en
//     vente sur Vinted ⇒ l'alerte, avec le N° et le LIEN vers l'annonce Vinted ;
//   · une vente NON reliée, dont le titre est IDENTIQUE à deux paires en ligne,
//     ne déclenche AUCUNE alerte toute seule : elle demande « quelle paire ? » et
//     PROPOSE les deux (c'est son clic qui relie, §5) ;
//   · un clic sur la bonne paire écrit le lien (`vrm_lbc_liens`) et l'alerte
//     apparaît pour celle-là — et pas pour sa jumelle ;
//   · son annonce jamais reliée, sur le compte dont il a VENDU une annonce, est
//     enfin listée ; celle d'un inconnu (étiquetée de son propre compte) non ;
//   · le tableau de bord dit la même chose (même règle, §11) ;
//   · aucun débordement, aucune erreur.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = 4341;

const auj = new Date();
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const annonce = (id, titre, prix) => ({ id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, brand_title: titre.split(' ')[0], size_title: (/taille (\d+)/.exec(titre) || [])[1] || '', is_closed: false, is_hidden: false, is_draft: false, photo: { url: 'https://img.test/v' + id + '.jpg' } });
const LISTINGS = { capturedAt: auj.toISOString(), payload: { items: [
  annonce(5001, 'Nike Air Max 1 olive taille 42', 80),
  annonce(5002, 'Salomon XT-6 blanc taille 40', 99),
  annonce(5003, 'Adidas Samba noir taille 39', 70),
  annonce(5004, 'Adidas Samba noir taille 39', 70),     // sa jumelle exacte
] } };
const MAIN = {
  vinted_annonce_numeros: {
    '5001': { numero: '12', title: 'Nike Air Max 1 olive taille 42', mp: { lbc: true } },
    '5002': { numero: '13', title: 'Salomon XT-6 blanc taille 40', mp: { lbc: true } },
    '5003': { numero: '14', title: 'Adidas Samba noir taille 39', mp: { lbc: true } },
    '5004': { numero: '15', title: 'Adidas Samba noir taille 39', mp: { lbc: true } },
  },
  vrm_lbc_liens: { lbc1: '12' },
};
const MON = 'acc9';
const ITEMS = {
  lbc1: { id: 'lbc1', subject: 'Nike Air Max 1 olive T42', price: 85, account: MON, platform: 'leboncoin', status: 'active', images: ['https://img.test/lbc1.jpg'] },
  lbc2: { id: 'lbc2', subject: 'Adidas Samba noir taille 39', price: 72, account: MON, platform: 'leboncoin', status: 'active', images: ['https://img.test/lbc2.jpg'] },
  lbc3: { id: 'lbc3', subject: 'Salomon XT-6 blanc T40', price: 105, account: MON, platform: 'leboncoin', status: 'active', images: ['https://img.test/lbc3.jpg'] },
  lbc4: { id: 'lbc4', subject: 'Chalet 8 personnes', price: 900, account: 'inconnu', platform: 'leboncoin', status: 'active', images: [] },
};
const VENTES = {
  t1: { txId: 't1', itemId: 'lbc1', isSeller: true, stepStatus: 'action', stepLabel: 'Colis à envoyer', price: 8500, title: 'Nike Air Max 1 olive T42', at: auj.toISOString() },
  t2: { txId: 't2', itemId: 'lbc2', isSeller: true, stepStatus: 'validation', stepLabel: 'Paiement effectué', price: 7200, title: 'Adidas Samba noir taille 39', at: auj.toISOString() },
};
const rows = [
  { id: 'main', data: MAIN },
  { id: 'harvest_111_listings', data: LISTINGS },
  { id: 'lbc_listings', data: { items: ITEMS } },
  { id: 'lbc_ventes', data: { ventes: VENTES } },
];
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
srv.listen(PORT);
// Projection PostgREST : `alias:data->champ` / `alias:data->>champ` (§6.3).
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

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      console.log(`── ${vp.width} px`);
      rows[0].data = JSON.parse(JSON.stringify(MAIN));   // chaque passe repart de la même base
      const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
      const pg = await ctx.newPage();
      const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
      await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
      await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
      await pg.route('**/rest/v1/**', (route) => {
        const u = decodeURIComponent(metaVersData(route.request().url()));
        const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
        // Une écriture de `main` est GARDÉE, comme dans la vraie base : sans ça,
        // l'écran suivant relisait l'ancien `main` et le banc mesurait une
        // fiction (§6.3 — le lien posé « disparaissait » au rechargement).
        if (route.request().method() !== 'GET') {
          try {
            const corps = JSON.parse(route.request().postData() || 'null');
            for (const l of [].concat(corps || [])) if (l && l.id === 'main' && l.data) rows[0].data = l.data;
          } catch (_) {}
          return j([]);
        }
        if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
        if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
        const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
        const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: auj.toISOString(), cap: r.data.capturedAt });
        const eq = /id=eq\.([^&]*)/.exec(u);
        if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
        const lk = /id=like\.([^&]*)/.exec(u);
        if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
        return j([]);
      });
      await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
      await pg.goto(`http://localhost:${PORT}/?tab=leboncoin`, { waitUntil: 'domcontentloaded' });
      await pg.waitForSelector('[data-lbc-doublons], [data-lbc-ventes-a-relier]', { timeout: 15000 }).catch(() => {});
      await pg.waitForTimeout(800);
      const lire = () => pg.evaluate(() => ({
        n: Number((document.querySelector('[data-lbc-doublons]') || {}).getAttribute ? document.querySelector('[data-lbc-doublons]').getAttribute('data-lbc-doublons') : 0),
        doublons: [...document.querySelectorAll('[data-doublon]')].map((e) => ({ num: e.getAttribute('data-doublon'), href: (e.querySelector('a[href*="vinted.fr/items/"]') || {}).href || '' })),
        aRelier: Number((document.querySelector('[data-lbc-ventes-a-relier]') || { getAttribute: () => 0 }).getAttribute('data-lbc-ventes-a-relier')),
        sugg: [...document.querySelectorAll('[data-lbc-suggestions="lbc2"] [data-suggestion]')].map((e) => e.getAttribute('data-suggestion')),
        relier: [...document.querySelectorAll('[data-lbc-relier]')].map((e) => e.getAttribute('data-lbc-relier')),
      }));
      const v1 = await lire();
      await pg.screenshot({ path: path.join(require('os').tmpdir(), 'double-vente-' + vp.width + '.png'), fullPage: true });
      dit(v1.doublons.length === 1 && v1.doublons[0].num === '12', 'vendue sur Leboncoin, encore sur Vinted ⇒ alerte pour la N°12, et elle seule', JSON.stringify(v1.doublons.map((d) => d.num)));
      dit(v1.doublons[0] && /vinted\.fr\/items\/5001$/.test(v1.doublons[0].href), 'l’alerte mène à L’annonce Vinted de cette paire', v1.doublons[0] && v1.doublons[0].href);
      dit(v1.aRelier === 1, 'la vente non reliée demande « quelle paire ? »', String(v1.aRelier));
      dit(v1.sugg.includes('14') && v1.sugg.includes('15'), 'et PROPOSE les deux paires identiques — sans en choisir une', JSON.stringify(v1.sugg));
      dit(v1.relier.includes('lbc3'), 'son annonce jamais reliée (compte prouvé par une vente) est listée', JSON.stringify(v1.relier));
      dit(!v1.relier.includes('lbc4'), 'l’annonce d’un inconnu ne l’est pas');
      dit(!v1.relier.includes('lbc1') && v1.relier.filter((x) => x === 'lbc2').length === 1,
        'une annonce vendue n’est pas présentée comme « en ligne non reliée » (elle n’est que dans « quelle paire ? »)', JSON.stringify(v1.relier));
      try {
        await pg.click('[data-lbc-suggestions="lbc2"] [data-suggestion="15"]');
        await pg.waitForTimeout(2500);
      } catch (e) { dit(false, 'la suggestion se clique', String(e.message).slice(0, 100)); }
      const liens = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_lbc_liens') || 'null'); } catch (_) { return null; } });
      dit(liens && liens.lbc2 === '15', 'son clic écrit le lien : vrm_lbc_liens.lbc2 = "15"', JSON.stringify(liens));
      const v2 = await lire();
      const n2 = v2.doublons.map((d) => d.num).sort();
      dit(n2.join() === '12,15', 'l’alerte apparaît pour la N°15 — pas pour sa jumelle N°14', JSON.stringify(n2));
      dit(v2.aRelier === 0, 'plus rien à relier');
      const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      dit(r.sw <= r.cw + 1, 'aucun débordement horizontal', `${r.sw} > ${r.cw}`);
      // Le tableau de bord : la MÊME règle, la même conclusion (§11).
      await pg.goto(`http://localhost:${PORT}/?tab=dashboard`, { waitUntil: 'domcontentloaded' });
      await pg.waitForFunction(() => /vendues? sur Leboncoin, encore en vente sur Vinted/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
      const txt = await pg.evaluate(() => document.body.innerText);
      const m = /(\d+) paires? vendues? sur Leboncoin, encore en vente sur Vinted/.exec(txt);
      dit(m && m[1] === '2', 'le tableau de bord annonce les mêmes 2 paires', m ? m[0] : 'absent');
      dit(!/vendues? sur Vinted\)/.test(txt), 'et ne dit « vendue sur Vinted » d’aucune paire non prouvée vendue');
      dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 160));
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ anti double vente : ${ko} rouge(s)` : '\n✅ anti double vente : tout est vert');
  process.exit(ko ? 1 : 0);
})();
