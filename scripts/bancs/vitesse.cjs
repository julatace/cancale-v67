// ════════════════════════════════════════════════════════════════════════════
//  VITESSE — ce que coûte l'ouverture de chaque écran, MESURÉ (« app plus
//  rapide », retenue par Julien le 11 octobre).
//
//  Base INVENTÉE au volume de la sienne (`_base-volume.cjs`, aucune donnée
//  réelle, il vit dans le dépôt). Chaque requête à NOTRE base est servie avec
//  un aller-retour réseau simulé (RTT + débit), et notée : URL, octets, début,
//  fin. On en tire, par écran ouvert à froid :
//    · le temps jusqu'au premier écran UTILE (Ma journée : son héros rendu) ;
//    · le nombre de requêtes et d'octets ;
//    · les lectures IDENTIQUES faites plusieurs fois (même URL, même Range) ;
//    · les octets de PDF rapatriés (doit être ZÉRO à l'ouverture d'un écran) ;
//    · le « chemin critique » : combien d'allers-retours À LA SUITE.
//  ⚠️ Ce banc ne touche que NOTRE base. Les requêtes à Vinted ne passent jamais
//  par l'app, et §3 interdit de les paralléliser — rien ici n'y touche.
//
//  Lancer : npm run build && node scripts/bancs/vitesse.cjs
//  `VITESSE_DETAIL=1` imprime chaque requête ; `PORT=…` change le port.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), http = require('http');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
const { fabriquer, repondre } = require('./_base-volume.cjs');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.PORT) || 4871;
const DETAIL = !!process.env.VITESSE_DETAIL;
const RTT = 150;            // ms — un aller-retour vers Supabase depuis la France (mesuré : 165–536 ms)
const DEBIT = 2_000_000;    // octets/s — une 4G correcte
const CPU = Number(process.env.VITESSE_CPU || 4);   // téléphone : processeur 4× plus lent qu'un ordinateur (émulation Chrome)

const base = fabriquer();
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ')'); process.exit(1); });
srv.listen(PORT);

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };

async function ouvrir(b, vp, tab, attendre, frappe, opts = {}) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  if (vp.width < 600 && CPU > 1) { const cdp = await ctx.newCDPSession(pg); await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU }); }
  const req = [];
  const t0 = Date.now();
  // L'histoire du héros de Ma journée : à quel moment il apparaît, avec quelle
  // valeur (un héros qui apparaît tôt avec un FAUX chiffre ne compte pas).
  await pg.addInitScript((t0) => {
    window.__heros = [];
    const note = () => { const e = document.querySelector('[data-vendu-mois]'); const v = e ? e.getAttribute('data-vendu-mois') : null; const l = window.__heros[window.__heros.length - 1]; if (!l || l.v !== v) window.__heros.push({ t: Date.now() - t0, v }); };
    document.addEventListener('DOMContentLoaded', () => new MutationObserver(note).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-vendu-mois'] }));
  }, t0);
  await pg.route('**/rest/v1/**', async (route) => {
    const rq = route.request();
    const url = rq.url();
    const debut = Date.now() - t0;
    if (rq.method() !== 'GET') {
      req.push({ m: rq.method(), url, debut, fin: debut + RTT, octets: 0, pdf: 0 });
      await new Promise((r) => setTimeout(r, RTT));
      return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    }
    const h = await rq.allHeaders();
    // `couperFamille` : la lecture de TOUTES les commandes en une fois (le
    // préchargement du démarrage) échoue — l'app doit retomber sur la lecture
    // par compte et rendre EXACTEMENT le même écran.
    if (opts.couperFamille && /id=like\.harvest_\*_orders_\*&select=id,data/.test(decodeURIComponent(url))) {
      req.push({ m: 'GET', url, range: h.range || '', debut, fin: debut + RTT, octets: 0, pdf: 0, coupe: true });
      await new Promise((r) => setTimeout(r, RTT));
      return route.fulfill({ status: 503, contentType: 'text/html', headers: { 'access-control-allow-origin': '*' }, body: '<html>503</html>' });
    }
    const rep = repondre(url, h.range, base);
    const body = JSON.stringify(rep.body);
    const pdf = (body.match(/JVBERi0x*/g) || []).reduce((a, s) => a + s.length, 0);
    const delai = RTT + Math.round(body.length / DEBIT * 1000);
    const e = { m: 'GET', url, range: h.range || '', debut, fin: debut + delai, octets: body.length, pdf };
    req.push(e);
    await new Promise((r) => setTimeout(r, delai));
    return route.fulfill({ status: rep.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', ...(rep.headers || {}) }, body });
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true,"devices":1}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  let utile = null;
  try { await pg.waitForFunction(attendre, null, { timeout: 30000, polling: 50 }); utile = Date.now() - t0; } catch (_) {}
  // Le calme : plus aucune requête GET pendant 3 s.
  for (let i = 0; i < 120; i++) {
    await pg.waitForTimeout(500);
    const dern = req.length ? Math.max(...req.map((x) => x.fin)) : 0;
    if (Date.now() - t0 - dern > 3000) break;
  }
  const lu = await pg.evaluate(() => ({ tombe: /pas pu s'afficher|Cannot access|is not defined/.test(document.body.innerText), texte: document.body.innerText }));
  // Ce que coûte une FRAPPE dans la recherche de la liste : chaque lettre de
  // « salomon », jusqu'à l'image suivante peinte (deux rAF).
  let frappes = null;
  if (frappe) {
    frappes = await pg.evaluate(async (sel) => {
      const i = document.querySelector(sel); if (!i) return null;
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      const peint = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const t = [];
      let v = '';
      for (const c of 'salomon') {
        v += c; const t0 = performance.now();
        set.call(i, v); i.dispatchEvent(new Event('input', { bubbles: true }));
        await peint(); t.push(Math.round(performance.now() - t0));
        await new Promise((r) => setTimeout(r, 120));
      }
      await new Promise((r) => setTimeout(r, 400));
      const apres = document.body.innerText.length;
      set.call(i, ''); i.dispatchEvent(new Event('input', { bubbles: true }));
      return { t, max: Math.max(...t), moy: Math.round(t.reduce((a, x) => a + x, 0) / t.length), apres };
    }, frappe);
  }
  const heros = await pg.evaluate(() => window.__heros || []).catch(() => []);
  if (DETAIL) console.log('    héros :', JSON.stringify(heros));
  await ctx.close();
  return { req, utile, errs, lu, frappes, heros };
}

function bilan(nom, r) {
  const gets = r.req.filter((x) => x.m === 'GET');
  const octets = gets.reduce((a, x) => a + x.octets, 0);
  const pdf = gets.reduce((a, x) => a + x.pdf, 0);
  const cle = (x) => x.url.replace(/^https?:\/\/[^/]+/, '') + '|' + x.range;
  const vus = new Map();
  for (const x of gets) vus.set(cle(x), (vus.get(cle(x)) || 0) + 1);
  const doublons = [...vus.entries()].filter(([, n]) => n > 1);
  const enDouble = doublons.reduce((a, [, n]) => a + n - 1, 0);
  // Profondeur : la plus longue chaîne de requêtes dont chacune démarre après la fin de la précédente.
  const tri = [...gets].sort((a, b) => a.debut - b.debut);
  const prof = new Array(tri.length).fill(1);
  for (let i = 0; i < tri.length; i++) for (let j = 0; j < i; j++) if (tri[j].fin <= tri[i].debut && prof[j] + 1 > prof[i]) prof[i] = prof[j] + 1;
  const profondeur = tri.length ? Math.max(...prof) : 0;
  const fin = gets.length ? Math.max(...gets.map((x) => x.fin)) : 0;
  const dec = (x) => decodeURIComponent(x.url);
  // La chaîne jusqu'aux VENTES (ce que le héros de Ma journée attend) : à quelle
  // profondeur part la lecture des commandes (par compte, ou toutes à la fois)
  // qui a servi. Avant le 16 octobre : sonde → comptes → commandes = 3.
  const estVentes = (x) => !x.coupe && /id=like\.harvest_[^&]*_orders_[%*]&select=id,data/.test(dec(x));
  const profVentes = tri.reduce((m, x, i) => (estVentes(x) && (r.utile == null || x.debut < r.utile) ? Math.max(m, prof[i]) : m), 0);
  // Balayages complets de la famille des transactions (la requête la plus
  // coûteuse de la base, `pg_stat_statements`) : on compte la PREMIÈRE page.
  const txn = gets.filter((x) => /id=like\.harvest_[%*]_txn_[%*]/.test(dec(x)) && (!x.range || /^0-/.test(x.range))).length;
  const supprParCompte = gets.filter((x) => /id=eq\.harvest_\d+_supprimees/.test(dec(x))).length;
  console.log(`  ${nom.padEnd(26)} utile ${String(r.utile ?? '—').padStart(6)} ms · calme ${String(fin).padStart(6)} ms · ${String(gets.length).padStart(3)} lectures · ${String(Math.round(octets / 1024)).padStart(6)} Ko · PDF ${Math.round(pdf / 1024)} Ko · en double ${enDouble} · ${profondeur} allers-retours à la suite · ${txn} balayage(s) des transactions`);
  if (DETAIL) {
    for (const x of tri) console.log(`      ${String(x.debut).padStart(6)}→${String(x.fin).padStart(6)} ${String(Math.round(x.octets / 1024)).padStart(5)} Ko ${decodeURIComponent(x.url.replace(/^https?:\/\/[^/]+\/rest\/v1\//, '')).slice(0, 170)} ${x.range}`);
    for (const [k, n] of doublons) console.log(`      ×${n} ${decodeURIComponent(k).slice(0, 170)}`);
  }
  if (profVentes) console.log(`     ventes lues au ${profVentes}ᵉ aller-retour à la suite · héros ${JSON.stringify(r.heros || [])}`);
  return { utile: r.utile, fin, n: gets.length, octets, pdf, enDouble, profondeur, txn, supprParCompte, profVentes };
}

// ⚠️ PLAFONDS MESURÉS le 16 octobre (base inventée, 7 comptes). Avant les
// correctifs : Ma journée 72–77 lectures dont 16–21 identiques, Ventes 98–104
// (31–36), Colis 102–107 (31–36), Annonces 87–92 (32–37), Achats 97–102
// (31–36), Messages 95–100 (40–45), tableau de bord 63–68 (9–14), 2 à 7
// balayages de la famille des transactions et 7 lectures `_supprimees` (une
// par compte) par écran. Après : 47–69 lectures, aucune `_supprimees` par compte,
// 0 à 6 identiques (des relectures séparées par une écriture, voulues), un
// ou deux balayages (le pont + la preuve de vente, deux projections
// différentes). Les plafonds laissent une marge ; ils ne bloquent que le retour
// du défaut. Aucun plancher de TEMPS ici : la machine des bancs est partagée,
// un temps mesuré dessus varie du simple au double (`perfv.cjs` garde ceux de
// la frappe sur Ventes).
const DOUBLONS_MAX = 8;
const PLAFONDS = { journee: 62, cat_ventes: 82, cat_bord: 82, cat_annonces: 66, cat_achats: 78, cat_msg: 66, dashboard: 60 };
const ECRANS = [
  ['journee', () => !!document.querySelector('[data-vendu-mois],[data-vendu-pas-su]') || /pas pu s'afficher/.test(document.body.innerText)],
  ['cat_ventes', () => document.querySelectorAll('[data-vente],[data-tx]').length > 0 || /\d+ ventes/.test(document.body.innerText), 'input[aria-label="Rechercher dans les ventes Vinted"]'],
  ['cat_bord', () => /bordereau/i.test(document.body.innerText)],
  ['cat_annonces', () => /en ligne/i.test(document.body.innerText), 'input[aria-label="Rechercher une annonce"]'],
  ['cat_achats', () => /achat/i.test(document.body.innerText), 'input[placeholder^="Rechercher (titre, N°"]'],
  ['cat_msg', () => /message|offre/i.test(document.body.innerText)],
  ['dashboard', () => /annonces|vendu/i.test(document.body.innerText)],
];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const res = {};
  try {
    const seuls = process.env.ECRANS ? process.env.ECRANS.split(',') : null;
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      console.log(`\n── ${vp.width} px (RTT ${RTT} ms, ${DEBIT / 1e6} Mo/s)`);
      for (const [tab, att, frappe] of ECRANS) {
        if (seuls && !seuls.includes(tab)) continue;
        const r = await ouvrir(b, vp, tab, att, frappe);
        res[vp.width + ':' + tab] = { ...bilan(tab, r), tombe: r.lu.tombe, errs: r.errs, frappes: r.frappes };
        if (r.frappes) console.log(`     frappe « salomon » : ${r.frappes.t.join(' · ')} ms (max ${r.frappes.max})`);
        if (process.env.VITESSE_TEXTES) fs.writeFileSync(path.join(process.env.VITESSE_TEXTES, vp.width + '-' + tab + '.txt'), r.lu.texte);
        const m = res[vp.width + ':' + tab];
        const plafond = PLAFONDS[tab];
        dit(!r.lu.tombe && !r.errs.length, `${vp.width} px · ${tab} : l'écran s'affiche, sans erreur`, (r.errs.join(' | ') || (r.lu.tombe ? 'écran tombé' : '')).slice(0, 200));
        dit(m.pdf === 0, `${vp.width} px · ${tab} : aucun octet de PDF rapatrié à l'ouverture`, Math.round(m.pdf / 1024) + ' Ko');
        dit(m.enDouble <= DOUBLONS_MAX, `${vp.width} px · ${tab} : au plus ${DOUBLONS_MAX} lectures identiques refaites`, `${m.enDouble}`);
        dit(m.n <= plafond, `${vp.width} px · ${tab} : au plus ${plafond} lectures de la base`, `${m.n}`);
        // Deux lecteurs LÉGITIMES : le pont transaction → annonce + dates de versement
        // (une projection, partagée) et la preuve de vente (une autre). Avant : 2 à 7.
        dit(m.txn <= 2, `${vp.width} px · ${tab} : la famille des transactions balayée deux fois au plus`, `${m.txn}`);
        dit(m.supprParCompte === 0, `${vp.width} px · ${tab} : les suppressions lues en une lecture, pas une par compte`, `${m.supprParCompte}`);
        if (tab === 'journee') {
          // ── LE PREMIER ÉCRAN : la chaîne sonde → comptes → ventes (16 octobre) ──
          // Les ventes partent EN MÊME TEMPS que les comptes (le préchargement du
          // démarrage), plus après eux : au plus deux allers-retours à la suite
          // (la sonde de schéma, puis comptes + ventes). Avant : 3, et au
          // téléphone le rendu d'AppCoeur s'intercalait (~600 ms de processeur).
          dit(m.profVentes > 0 && m.profVentes <= 2, `${vp.width} px · journee : les ventes partent au plus au 2ᵉ aller-retour (sonde, puis comptes ET ventes)`, `${m.profVentes}ᵉ`);
          const h = r.heros.filter((x) => x.v != null);
          const finale = (r.lu.texte.match(/Vendu en [^\n]*\n+([^\n]+)/) || [])[1] || '';
          dit(h.length >= 1 && h.every((x) => x.v === h[0].v), `${vp.width} px · journee : le héros apparaît UNE fois, avec sa valeur finale (jamais un chiffre provisoire)`, JSON.stringify(r.heros));
          // Le même écran quand la lecture de toutes les commandes échoue : l'app
          // retombe sur la lecture par compte (le chemin d'avant) et doit rendre
          // EXACTEMENT le même texte — la preuve que la part servie à chaque
          // compte est celle qu'il aurait lue lui-même.
          const r2 = await ouvrir(b, vp, tab, att, null, { couperFamille: true });
          const norm = (t) => String(t || '').replace(/\s+/g, ' ').trim();
          const a = norm(r.lu.texte), c = norm(r2.lu.texte);
          let i = 0; while (i < a.length && a[i] === c[i]) i++;
          dit(!r2.errs.length && !r2.lu.tombe && a === c, `${vp.width} px · journee : texte rendu IDENTIQUE, préchargement ou lecture par compte`, a === c ? `${a.length} caractères` : `écart au caractère ${i} : « ${a.slice(Math.max(0, i - 40), i + 60)} » ≠ « ${c.slice(Math.max(0, i - 40), i + 60)} »`);
          const h2 = r2.heros.filter((x) => x.v != null);
          dit(h.length && h2.length && h[h.length - 1].v === h2[h2.length - 1].v, `${vp.width} px · journee : même « vendu ce mois » par les deux chemins`, `${h.length ? h[h.length - 1].v : '—'} / ${h2.length ? h2[h2.length - 1].v : '—'}${finale ? ' · ' + finale.slice(0, 30) : ''}`);
        }
      }
    }
    if (process.env.VITESSE_JSON) fs.writeFileSync(process.env.VITESSE_JSON, JSON.stringify(res, null, 1));
  } finally { await b.close(); srv.close(); }
  process.exit(ko ? 1 : 0);
})();
