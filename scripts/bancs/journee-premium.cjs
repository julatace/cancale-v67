// Banc : Ma journée « premium » sur téléphone (390 px) et ordinateur (1512 px),
// sur des données INVENTÉES et réalistes (aucune donnée réelle : ce banc vit
// dans le dépôt, qui est public). Demande de Julien (16 octobre) : le rendu
// iPhone « pas ouf, pas premium, pas classe ».
//
// Il juge ce qui est RENDU, jamais un libellé exact (§6.5) :
//   1. aucun débordement horizontal, écran sans erreur ;
//   2. le bonjour ne contient JAMAIS « @ » — un email n'est pas un prénom
//      (vu sur sa capture : « Bon après-midi shopcancale35@gmail.com ») ; un
//      vrai prénom, lui, est bien dit (l'autre sens : se taire passerait) ;
//   3. le graphique de la semaine est VISIBLE sans clic (plus dans un repli) ;
//   4. la barre des 4 gestes est là, avec ses nombres ;
//   5. aucune ligne de la carte « en attente » ne déborde de sa boîte.
// Captures : SHOTS=<dossier> node scripts/bancs/journee-premium.cjs
// Lancer : npm run build && BANC_PORT=48xx node scripts/bancs/journee-premium.cjs
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4861;
const SHOTS = process.env.SHOTS || '';

// Un jeudi après-midi, heure locale : la semaine a déjà quatre jours.
const maintenant = new Date(2026, 9, 15, 15, 30, 0);
const il = (n, h = 12) => { const d = new Date(maintenant); d.setHours(h, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
const UID = '111';
let nPhoto = 0;
const vente = (id, titre, prix, statut, d, extra = {}) => ({ transaction_id: id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: statut, date: d.toISOString(), photo: { url: `https://images1.vinted.net/t/b${++nPhoto}/f800/${id}.jpeg?s=x` }, ...extra });
const VENTES = [
  vente(7001, 'Nike Air Max 90 blanche taille 42', 65, 'Le paiement a été validé', il(0, 11), { transaction_user_status: 'needs_action' }),
  vente(7002, 'Adidas Samba OG noir taille 40', 72, 'Le paiement a été validé', il(0, 9), { transaction_user_status: 'needs_action' }),
  vente(7003, 'Salomon XT-6 gris taille 43', 110, 'Colis en cours d\'acheminement', il(1), { transaction_user_status: 'waiting' }),
  vente(7004, 'New Balance 550 crème taille 41', 58, 'Commande finalisée', il(3), { transaction_user_status: 'completed' }),
  vente(7005, 'Asics Gel-Kayano 14 argent taille 44', 89, 'Commande finalisée', il(2), { transaction_user_status: 'completed' }),
  vente(7006, 'Nike Dunk Low panda taille 38', 61, 'Commande finalisée', il(8), { transaction_user_status: 'completed' }),
  vente(7007, 'Adidas Spezial bleu taille 39', 54, 'Commande finalisée', il(10), { transaction_user_status: 'completed' }),
  vente(7008, 'Converse Chuck 70 noir taille 42', 38, 'Commande finalisée', il(12), { transaction_user_status: 'completed' }),
  vente(7009, 'Nike Shox TL noir taille 41', 95, 'Commande annulée', il(1)),
];
// Dates de versement : les ventes finalisées sont versées quelques jours après.
const VERSE = { 7004: il(1), 7005: il(0, 10), 7006: il(5), 7007: il(7), 7008: il(9) };
const ACHATS = [
  { transaction_id: 8101, title: 'Adidas Gazelle rouge taille 40', price: { amount: '28', currency_code: 'EUR' }, status: 'Retour initié', date: il(4).toISOString() },
];
const CONVS = [1, 2, 3].map((k) => ({ id: 9000 + k, unread: true, updated_at: il(k - 1, 10).toISOString(), opposite_user: { login: 'acheteur' + k }, description: 'Bonjour, toujours dispo ?' }));
const ANNONCES = Array.from({ length: 6 }, (_, k) => ({ id: 6000 + k, title: 'Annonce ' + k, price: { amount: String(40 + k * 7), currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, created_at_ts: il(30 + k).toISOString(), favourite_count: 0, view_count: 3 }));

const ACCOUNTS = [{ id: 1, vinted_user_id: UID, login: 'julatace35260', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() }];
const cap = maintenant.toISOString();
const LIGNES = [
  { id: `harvest_${UID}_orders_sold`, data: { capturedAt: cap, payload: { my_orders: VENTES } } },
  { id: `harvest_${UID}_orders_purchased`, data: { capturedAt: cap, payload: { my_orders: ACHATS } } },
  { id: `harvest_${UID}_listings`, data: { capturedAt: cap, payload: { items: ANNONCES, pagination: { total_entries: ANNONCES.length } } } },
  { id: `harvest_${UID}_inbox`, data: { capturedAt: cap, payload: { conversations: CONVS } } },
  { id: `harvest_${UID}_billing`, data: { capturedAt: cap, payload: { escrow: { amount: '1759.40', currency_code: 'EUR' }, main: { amount: '227.54', currency_code: 'EUR' } } } },
  ...Object.entries(VERSE).map(([tx, d]) => ({ id: `harvest_${UID}_txn_${tx}`, data: { capturedAt: cap, payload: { transaction: { id: Number(tx), status: 450, status_title: 'Commande finalisée', status_updated_at: d.toISOString() } } } })),
];

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 200)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);

// Une « photo » neutre par article (le CDN de Vinted n'est jamais appelé).
const teintes = ['#d9d4cc', '#c9ced6', '#e2ddd4', '#cfd6cf', '#d8d0d6', '#d3d8de', '#ddd8cc', '#cdd2d8', '#d6d1c8'];
const photoSvg = (k) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${teintes[k % teintes.length]}"/><ellipse cx="200" cy="300" rx="150" ry="22" fill="rgba(0,0,0,.08)"/><path d="M70 250 C90 190 150 180 190 200 C230 220 280 205 320 230 C345 245 340 280 300 282 L90 282 C70 282 62 268 70 250 Z" fill="rgba(30,34,40,.55)"/></svg>`;

const ouvrir = async (b, vp, prenom, ventesKO = false) => {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript((p) => { try { localStorage.setItem('vrm_acces_direct', '1'); if (p != null) localStorage.setItem('vrm_prenom', JSON.stringify(p)); } catch (_) {} }, prenom);
  await pg.route(/^https?:\/\/[^/]*vinted\.net\//i, (r) => { const m = /\/b(\d+)\//.exec(r.request().url()); return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: photoSvg(m ? Number(m[1]) : 0) }); });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1|[^/]*vinted\.net)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    if (route.request().method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || '';
    const forme = (r) => {
      if (/^[a-z]+:data->[a-z]+$/i.test(sel)) { const [al, src] = sel.split(':'); return { [al]: (r.data || {})[src.split('->')[1]] }; }
      if (/^[a-z]+:data->/i.test(sel)) {
        const o = {};
        for (const champ of sel.split(',')) { const m = /^([a-z]+):data->(.+)$/i.exec(champ); if (!m) continue; let v = r.data; for (const p of m[2].split(/->>?/)) v = v == null ? v : v[p]; o[m[1]] = (v != null && /->>/.test(m[2])) ? String(v) : v; }
        return o;
      }
      return { ...r, updated_at: cap, cap: r.data.capturedAt };
    };
    // (16 oct.) Toutes les FORMES de lecture des commandes échouent, y compris la
    // lecture de tous les comptes à la fois du préchargement (`orders_*`) — sinon
    // le banc ne simule plus la panne qu'il décrit (§6.3).
    if (ventesKO && /orders_(sold|%|\*)/.test(u)) return route.fulfill({ status: 503, contentType: 'text/html', body: '<html>503</html>' });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => document.querySelector('[data-vendu-mois]') || /pas pu s'afficher/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
  await pg.waitForFunction(() => document.querySelector('[data-courbe-semaine]') && document.querySelector('[data-barre-jour] [data-n="2"]'), null, { timeout: 8000 }).catch(() => {});
  await pg.waitForTimeout(900);
  return { ctx, pg, errs };
};

const lire = (pg) => pg.evaluate(() => {
  const g = document.querySelector('.vrm-day-greeting');
  const courbe = document.querySelector('[data-courbe-semaine]');
  const rc = courbe ? courbe.getBoundingClientRect() : null;
  // Visible sans clic : posé, de taille réelle, et pas dans un <details> fermé.
  const ferme = courbe && courbe.closest('details:not([open])');
  const tuiles = [...document.querySelectorAll('[data-barre-jour] [data-tuile]')].map((e) => [e.getAttribute('data-tuile'), e.getAttribute('data-n')]);
  // Un texte qui déborde de sa boîte (le « porte-monnaie » coupé de sa capture).
  const deborde = [];
  for (const e of document.querySelectorAll('.vrm-day-layout *')) {
    if (!e.closest('svg') && !e.children.length && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow === 'visible' && getComputedStyle(e).whiteSpace === 'nowrap') deborde.push(e.textContent.slice(0, 40));
  }
  return {
    bonjour: g ? g.innerText.replace(/\s+/g, ' ').trim() : '',
    hBonjour: g ? Math.round(g.getBoundingClientRect().height) : 0,
    courbeVisible: !!(rc && rc.width > 200 && rc.height > 80 && !ferme),
    tuiles, deborde,
    tombe: /pas pu s'afficher|Cannot access|is not defined/.test(document.body.innerText),
    deb: document.documentElement.scrollWidth - window.innerWidth,
  };
});

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      console.log(`\n── Ma journée, ${vp.width} px, prénom = un EMAIL`);
      await essaie(`${vp.width} px`, async () => {
        const { ctx, pg, errs } = await ouvrir(b, vp, 'shopcancale35@gmail.com');
        const lu = await lire(pg);
        if (SHOTS) {
          // L'écran tel qu'il s'ouvre, puis toute la page (fenêtre haute : le
          // défilement vit dans un conteneur, une capture « pleine page » s'y arrête).
          await pg.screenshot({ path: path.join(SHOTS, `journee-premium-${vp.width}-ecran.png`) });
          await pg.setViewportSize({ width: vp.width, height: 2000 }); await pg.waitForTimeout(500);
          await pg.screenshot({ path: path.join(SHOTS, `journee-premium-${vp.width}.png`) });
        }
        dit(!lu.tombe && errs.length === 0, 'l’écran s’affiche, sans erreur', errs.join(' | ').slice(0, 160));
        dit(lu.deb <= 1, 'aucun débordement horizontal', `${lu.deb} px`);
        dit(!!lu.bonjour && !lu.bonjour.includes('@'), 'le bonjour ne montre jamais un email', `« ${lu.bonjour} »`);
        if (vp.width < 600) dit(lu.hBonjour > 0 && lu.hBonjour <= 56, 'le bonjour reste compact sur téléphone (≤ 56 px, comme compact.cjs)', `${lu.hBonjour} px`);
        dit(lu.courbeVisible, 'le graphique de la semaine est visible sans clic');
        dit(lu.tuiles.length === 4, 'la barre des 4 gestes est là', JSON.stringify(lu.tuiles));
        dit(lu.tuiles.some(([id, n]) => id === 'envoyer' && n === '2'), '« À envoyer » compte les 2 ventes à expédier', JSON.stringify(lu.tuiles));
        dit(lu.deborde.length === 0, 'aucun texte ne sort de sa boîte', lu.deborde.join(' | '));
        await ctx.close();
      });
    }
    console.log('\n── Ventes illisibles : « — », jamais « 0 € » (§5)');
    await essaie('ventes illisibles', async () => {
      const { ctx, pg } = await ouvrir(b, { width: 390, height: 844 }, 'Julien', true);
      await pg.waitForTimeout(1500);
      const r = await pg.evaluate(() => { const e = document.querySelector('[data-vendu-mois]'); return { v: e ? e.getAttribute('data-vendu-mois') : null, t: e ? e.innerText : '', m: (document.querySelector('[data-vendu-manque]') || {}).innerText || '' }; });
      dit(r.v === null || (r.v === '' && /—/.test(r.t) && /pas pu être lues/.test(r.m)), 'aucun compte lu ⇒ le vendu du mois n’affiche pas « 0 € »', JSON.stringify(r));
      await ctx.close();
    });
    console.log('\n── L’autre sens : un vrai prénom est dit');
    await essaie('prénom', async () => {
      const { ctx, pg } = await ouvrir(b, { width: 390, height: 844 }, 'Julien');
      const lu = await lire(pg);
      dit(/Julien/.test(lu.bonjour), 'le bonjour suit le prénom réglé', `« ${lu.bonjour} »`);
      await ctx.close();
    });
  } catch (e) { dit(false, 'banc', String(e.message || e).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
