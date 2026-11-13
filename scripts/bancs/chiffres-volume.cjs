// ════════════════════════════════════════════════════════════════════════════
//  « AUCUN CHIFFRE NE CHANGE » (12 nov., lot vitesse-volume)
//  node scripts/bancs/chiffres-volume.cjs <dist> <sortie.json> [port]
//  VENTES=20000 : la base d'un gros vendeur (`_base-volume`), sinon la base par défaut.
//
//  Ouvre, dans le même navigateur (1512, sans bridage), Ma journée, Ventes, Achats,
//  Colis, Argent (Résumé, Déclarer) et Statistiques ; sur chaque écran, attend le
//  CALME (aucune lecture depuis 4 s), puis relève :
//   · chaque montant (« 1 234,56 € ») et chaque compte (« 12 ventes », « 3 colis »)
//     du contenu de l'écran, dans l'ordre ;
//   · les nombres portés par les attributs `data-*` de l'écran ;
//  et, à la fin, ce que les écrans PUBLIENT (le `localStorage` : bénéfice par jour,
//  URSSAF du mois, colis à poster / à retirer, statistiques, widget…), sans les
//  horodatages. Le tout est écrit dans <sortie.json>.
//
//  `scripts/compare-chiffres-volume.cjs avant.json apres.json` compare au centime.
//  Deux passes du MÊME build doivent être identiques (le banc est déterministe) ;
//  un build qui change une règle de calcul diffère. Aucune donnée réelle.
// ════════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http'), zlib = require('zlib');
const RACINE = path.join(__dirname, '..', '..');
let chromium;
try { ({ chromium } = require(path.join(RACINE, 'node_modules', 'playwright'))); } catch (_) { ({ chromium } = require('playwright')); }
const { fabriquer, repondre } = require(path.join(__dirname, '_base-volume.cjs'));
const DIST = process.argv[2] || path.join(RACINE, 'dist');
const SORTIE = process.argv[3] || '';
const PORT = +(process.argv[4] || process.env.BANC_PORT || 9660);
const ONGLETS = (process.env.TABS || 'journee,ventes,achats,cat_bord,argent,argent_declarer,stats').split(',');
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/json', '.json': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  const t = types[path.extname(p)] || 'application/octet-stream'; const b = fs.readFileSync(p);
  if (/javascript|css|html|json|svg/.test(t)) { r.writeHead(200, { 'content-type': t, 'content-encoding': 'gzip' }); r.end(zlib.gzipSync(b)); }
  else { r.writeHead(200, { 'content-type': t }); r.end(b); }
}).listen(PORT);
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
// Horodatages et jetons : ils changent d'une passe à l'autre sans être des chiffres.
const HEURE = /^(at|ts|t|le|depuis|maj|majLe|capturedAt|updatedAt|updated_at|calculeLe|publieLe|lu|luLe|vu|vuLe|heure|date|quand|expire|exp|token|jeton|id|nonce|rev|cle|v|version|seed)$/i;
const ISO = /^\d{4}-\d\d-\d\dT\d\d:\d\d/;
function nettoie(x, k) {
  if (Array.isArray(x)) return x.map((v) => nettoie(v));
  if (x && typeof x === 'object') { const o = {}; for (const [kk, v] of Object.entries(x).sort()) { if (HEURE.test(kk)) continue; o[kk] = nettoie(v, kk); } return o; }
  if (typeof x === 'string' && ISO.test(x)) return '·date·';
  if (typeof x === 'number' && x > 1.6e12 && x < 2.2e12) return '·ms·';
  return x;
}
// Ce que les écrans publient (les notions) — les autres clés sont des préférences ou des caches.
const PUBLIE = /^(vinted_urssaf_mois|vrm_benefice_jours|vrm_colis_aposter|vrm_colis_retirer|vrm_colis_prets|widget_stats|vinted_nums_physiques|vrm_stats_ventes|vrm_stats_stock|vrm_stock_vendus|vrm_paires_dorment|vrm_num_doublons|vrm_compta|vrm_lbc_a_retirer_pub)$/;

(async () => {
  const base = fabriquer({ volumeReel: true, ventes: Number(process.env.VENTES) || 0 });
  const b = await chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch(() => chromium.launch());
  const res = { ventes: Number(process.env.VENTES) || 0, ecrans: {}, publie: {}, erreurs: [] };
  try {
    const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 1512, height: 982 } });
    await ctx.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vrm_visite_bulles_vue', '1'); } catch (_) {} });
    let derniere = Date.now();
    await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
    await ctx.route('**/rest/v1/**', async (route) => {
      const rq = route.request(); derniere = Date.now();
      if (rq.method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
      const h = await rq.allHeaders(); const rep = repondre(rq.url(), h.range, base);
      return route.fulfill({ status: rep.status, contentType: 'application/json', headers: { ...(rep.headers || {}) }, body: JSON.stringify(rep.body) });
    });
    await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    const pg = await ctx.newPage();
    pg.on('pageerror', (e) => res.erreurs.push(e.message.slice(0, 200)));
    for (const tab of ONGLETS) {
      await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'commit' });
      await pg.waitForSelector('.vrm-main', { timeout: 90000 }).catch(() => {});
      derniere = Date.now(); const fin = Date.now() + 120000;
      while (Date.now() - derniere < 4000 && Date.now() < fin) await attendre(250);
      await attendre(1500);
      res.ecrans[tab] = await pg.evaluate(() => {
        const main = document.querySelector('.vrm-main') || document.body;
        const texte = (main.innerText || '').replace(/[\u00a0\u202f]/g, ' ');
        const montants = texte.match(/-?\d[\d ]*(?:,\d{1,2})? ?€/g) || [];
        const comptes = texte.match(/\b\d[\d ]* (?:ventes?|achats?|colis|annonces?|paires?|comptes?|bordereaux?)\b/g) || [];
        const attrs = [];
        for (const e of main.querySelectorAll('*')) for (const a of e.attributes) if (a.name.startsWith('data-') && /^-?\d+(?:[.,]\d+)?$/.test(a.value)) attrs.push(a.name + '=' + a.value);
        return { montants, comptes, attrs };
      });
    }
    const ls = await pg.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])));
    for (const [k, v] of Object.entries(ls)) { const kk = k.replace(/_[0-9a-f-]{36}$/, ''); if (!PUBLIE.test(kk)) continue; let x = v; try { x = JSON.parse(v); } catch (_) {} res.publie[kk] = nettoie(x); }
    await ctx.close();
  } finally { await b.close(); srv.close(); }
  const s = JSON.stringify(res, null, 1);
  if (SORTIE) fs.writeFileSync(SORTIE, s);
  console.log(`chiffres relevés : ${Object.entries(res.ecrans).map(([t, e]) => `${t} ${e.montants.length} € · ${e.comptes.length} n · ${e.attrs.length} data`).join(' | ')} · publiés ${Object.keys(res.publie).length} · erreurs ${res.erreurs.length}`);
})();
