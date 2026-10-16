// ═══════════════════════════════════════════════════════════════════════════
// BANC : LEBONCOIN → ANNONCES LISTE SES ANNONCES EN LIGNE, AVEC LEUR PHOTO
//        (node scripts/bancs/lbc-annonces.cjs — après `npm run build`)
// ═══════════════════════════════════════════════════════════════════════════
// Julien, 15 octobre : « pour Leboncoin, j'ai beau actualiser la page, les
// photos des annonces n'apparaissent pas ». Mesuré : l'écran ne LISTAIT pas
// ses annonces en ligne (seulement « à relier », vendues, non reliées) — ses
// 5 annonces en ligne (8 à lui sur 183 captées) n'y étaient nulle part.
//
// Données INVENTÉES, aux FORMES mesurées (aucune fixture : il vit dans le dépôt) :
//   · 9300000001 — à lui (compte connecté `lbcUser`), réf VRM-12 ⇒ N°12 ;
//   · 9300000003 — à lui (son compte est PROUVÉ par une vente où il est le
//     vendeur), lien posé à la main ⇒ N°14, statut « inactive » ;
//   · 9300000002 — à lui, aucune identité ⇒ « à relier », vue il y a 10 j ;
//   · 9300000005 — à lui, VENDUE sur Leboncoin ⇒ pas « en ligne » ;
//   · 9300000009 — d'un INCONNU (flux « découverte »), titre « n°12 » : le
//     piège — jamais affichée, et jamais reliée à la N°12 par son titre (§5).
// Il exige, à 390 px tactile et à 1512 px :
//   A. lu : les 3 annonces à lui, chacune avec sa PHOTO affichée (servie sous
//      img.leboncoin.fr), son titre, son prix, son statut, son lien Leboncoin ;
//      le N° seulement par identité ; l'inconnu et la vendue absents ;
//   B. lecture ratée de `lbc_listings` : dit UNE fois, jamais « aucune » ni
//      « pas encore vues », et aucune annonce inventée ;
//   C. jamais capté (seule l'annonce de l'inconnu en base) : le geste
//      (« Mes annonces » sur leboncoin.fr), et toujours pas l'inconnu.
// On juge les attributs rendus (`data-lbc-annonces`, `data-annonce-lbc`,
// `data-numero`) et les images chargées, pas une formulation.
// Port : PORT_BANC (5891). BANC_DIST pour mesurer un autre build (§6.1).
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = +process.env.PORT_BANC || 5891;
const SORTIE = process.env.BANC_CAPTURES || os.tmpdir();

const MAINTENANT = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const IMG = (k) => `https://img.leboncoin.fr/api/v1/lbcpb1/images/a${k}/b${k}/c${k}/${String(k).repeat(40).slice(0, 40)}.jpg?rule=ad-image`;
const AD = (id, sujet, extra) => ({ id, subject: sujet, price: 45, status: 'active', images: [IMG(+id.slice(-1)), IMG(+id.slice(-1) + 10)], url: 'https://www.leboncoin.fr/ad/chaussures/' + id, seenAt: iso(MAINTENANT), ...extra });
const ITEMS = {
  '9300000001': AD('9300000001', 'Nike Air Max 1 olive T42', { lbcUser: 'u_banc', lbcUserName: 'Boutique Banc', account: 'u_banc', accountName: 'Boutique Banc', ref: '12', customRef: 'VRM-12', price: 45 }),
  // Un titre LONG : sur iPhone il doit s'abréger, pas pousser la page hors de l'écran.
  '9300000002': AD('9300000002', 'Adidas Spezial noir gomme semelle originale très bon état boîte T38', { lbcUser: 'u_banc', account: 'u_banc', accountName: 'Boutique Banc', price: 39.5, seenAt: iso(MAINTENANT - 10 * 86400e3) }),
  // Sans `lbcUser` : à lui parce que son compte est PROUVÉ par la vente de 9300000005.
  '9300000003': AD('9300000003', 'Salomon XT-6 blanc T40', { account: 'u_banc', accountName: 'Boutique Banc', price: 99, status: 'inactive' }),
  '9300000005': AD('9300000005', 'Asics Gel-Kayano T41 vendue', { account: 'u_banc', accountName: 'Boutique Banc' }),
  '9300000009': AD('9300000009', 'Chalet n°12 à louer La Plagne', { account: 'autre_vendeur', accountName: 'Gîtes du Lac', price: 890 }),
};
const VENTES = {
  '7300001': { txId: '7300001', itemId: '9300000005', isSeller: true, title: 'Asics Gel-Kayano T41 vendue', price: 6000, stepStatus: 'validation', stepLabel: 'Paiement effectué', at: iso(MAINTENANT) },
};
const MAIN = {
  vinted_annonce_numeros: { '8001': { numero: '12', title: 'Nike Air Max 1 olive' }, '8003': { numero: '14', title: 'Salomon XT-6 blanc' } },
  vrm_lbc_liens: { '9300000003': '14' },
};
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: iso(MAINTENANT) }];
const vItem = (id, titre) => ({ id: +id, title: titre, price: { amount: '45.0', currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, photo: { url: '' }, user: { id: 111 } });
const BASE = [
  { id: 'main', data: MAIN },
  { id: 'harvest_111_listings', data: { uid: '111', capturedAt: iso(MAINTENANT), nItems: 2, payload: { items: [vItem('8001', 'Nike Air Max 1 olive'), vItem('8003', 'Salomon XT-6 blanc')], pagination: { total_entries: 2, total_pages: 1, current_page: 1 } } } },
  { id: 'lbc_ventes', data: { ventes: VENTES } },
];
const SCENARIOS = {
  lu: { rows: [...BASE, { id: 'lbc_listings', data: { items: ITEMS, updatedAt: iso(MAINTENANT) } }], lbcKO: false },
  passu: { rows: [...BASE], lbcKO: true },
  jamais: { rows: [...BASE, { id: 'lbc_listings', data: { items: { '9300000009': ITEMS['9300000009'] }, updatedAt: iso(MAINTENANT) } }], lbcKO: false },
  // D. DEUX comptes à lui (le second prouvé par sa propre vente) : là seulement
  //    la ligne nomme le compte.
  deux: { rows: [...BASE.filter((r) => r.id !== 'lbc_ventes'),
    { id: 'lbc_ventes', data: { ventes: { ...VENTES, '7300002': { ...VENTES['7300001'], txId: '7300002', itemId: '9300000006' } } } },
    { id: 'lbc_listings', data: { updatedAt: iso(MAINTENANT), items: { ...ITEMS,
      '9300000006': AD('9300000006', 'Vendue sur le second compte', { account: 'u_second', accountName: 'Second Compte' }),
      '9300000007': AD('9300000007', 'New Balance 990 T44', { account: 'u_second', accountName: 'Second Compte', price: 70 }) } } }], lbcKO: false },
};

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 180)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });

const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (src.includes('->>') && typeof v === 'object' ? JSON.stringify(v) : v);
  }
  return out;
};
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==', 'base64');

async function preparer(b, vp, sc) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const lectures = { lbc: 0 };
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  // Le CDN de Leboncoin : une vraie image PNG (le banc photos-leboncoin.cjs
  // couvre déjà le refus et le secours ; ici on juge la LISTE).
  await pg.route(/^https:\/\/img\.leboncoin\.fr\//i, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1|img\.leboncoin\.fr)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d, s = 200) => route.fulfill({ status: s, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    if (/id=eq\.lbc_listings/.test(u)) {
      lectures.lbc++;
      // La lecture ratée a la vraie forme d'une panne : un 522 en HTML.
      if (sc.lbcKO) return route.fulfill({ status: 522, contentType: 'text/html', headers: { 'access-control-allow-origin': '*' }, body: '<html>522</html>' });
    }
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data$|^data,/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: iso(MAINTENANT) });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(sc.rows.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(sc.rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route(`http://localhost:${PORT}/api/**`, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs, lectures };
}
const ouvrir = async (pg) => { await pg.goto(`http://localhost:${PORT}/?tab=leboncoin`, { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(4500); };
// Ce que dit l'écran : l'état de la liste, et chaque ligne rendue.
const lire = (pg) => pg.evaluate(() => {
  const liste = document.querySelector('[data-lbc-annonces]');
  const lignes = [...document.querySelectorAll('[data-annonce-lbc]')].map((el) => {
    const img = el.querySelector('img');
    const a = [...el.querySelectorAll('a[href]')].map((x) => x.getAttribute('href'));
    return { id: el.getAttribute('data-annonce-lbc'), numero: el.getAttribute('data-numero'), t: el.innerText,
      img: img ? (img.currentSrc || img.src || '') : '', affichee: !!(img && img.complete && img.naturalWidth > 0),
      liens: a, relier: !!el.querySelector('[data-lbc-relier] input') };
  });
  return { etat: liste ? liste.getAttribute('data-lbc-annonces') : null, n: liste ? liste.getAttribute('data-n') : null, lignes,
    txt: document.body.innerText, ratee: !!document.querySelector('[data-lbc-lecture-ratee]'),
    rateeTxt: (document.querySelector('[data-lbc-lecture-ratee]') || {}).innerText || '',
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
    // La racine COUPE ce qui dépasse (`overflow-x: clip`) : `scrollWidth` ne voit
    // donc rien. On mesure les bords réels de ce qu'il doit pouvoir toucher.
    dehors: [...document.querySelectorAll('[data-annonce-lbc], [data-lbc-relier] button, [data-lbc-annonces], button')]
      .filter((el) => el.offsetParent !== null && /Actualiser|Relier|Voir|^$/.test((el.innerText || '').trim()) || el.hasAttribute('data-annonce-lbc'))
      .map((el) => ({ t: (el.innerText || '').trim().slice(0, 30), r: Math.round(el.getBoundingClientRect().right) }))
      .filter((x) => x.r > window.innerWidth + 1) };
});
const garde = (t) => (/n'a pas pu s'afficher|n’a pas pu s’afficher|Cannot access|is not defined/.exec(t) || [null])[0];

(async () => {
  let b;
  await new Promise((ok) => srv.listen(PORT, ok));
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      const T = vp.width + ' px';
      // ── A. lu ─────────────────────────────────────────────────────────────
      await essaie(`[A ${T}]`, async () => {
        console.log(`── A. lu · ${T}`);
        const { ctx, pg, errs } = await preparer(b, vp, SCENARIOS.lu);
        await ouvrir(pg);
        // Les images paresseuses ne se chargent qu'à l'écran : on passe dessus.
        const n = await pg.evaluate(() => document.querySelectorAll('[data-annonce-lbc]').length);
        for (let i = 0; i < n; i++) { await pg.evaluate((i) => { const el = document.querySelectorAll('[data-annonce-lbc]')[i]; if (el) el.scrollIntoView({ block: 'center' }); }, i); await pg.waitForTimeout(400); }
        await pg.waitForTimeout(1200);
        const r = await lire(pg);
        await pg.evaluate(() => { const el = document.querySelector('[data-lbc-annonces]'); if (el) el.scrollIntoView({ block: 'start' }); });
        await pg.waitForTimeout(400);
        await pg.screenshot({ path: path.join(SORTIE, `lbc-annonces-lu-${vp.width}.png`) }).catch(() => {});
        const L = (id) => r.lignes.find((l) => l.id === id);
        dit(r.etat === 'lu', `[A ${T}] la liste de ses annonces Leboncoin est là`, String(r.etat));
        dit(r.lignes.length === 3 && L('9300000001') && L('9300000002') && L('9300000003'), `[A ${T}] ses 3 annonces en ligne, et elles seules`, r.lignes.map((l) => l.id).join(','));
        dit(!L('9300000009') && !/Chalet|Gîtes du Lac/.test(r.txt), `[A ${T}] l’annonce d’un inconnu n’apparaît nulle part (même avec « n°12 » dans son titre)`);
        dit(!L('9300000005'), `[A ${T}] l’annonce vendue sur Leboncoin n’est pas « en ligne »`);
        const tout = r.lignes.length === 3 && r.lignes.every((l) => l.affichee && /^https:\/\/img\.leboncoin\.fr\//.test(l.img));
        dit(tout, `[A ${T}] chaque annonce montre SA photo (img.leboncoin.fr, chargée)`, r.lignes.map((l) => `${l.id}:${l.affichee ? 'ok' : 'non'}:${l.img.slice(0, 40)}`).join(' | '));
        const a1 = L('9300000001') || {}, a2 = L('9300000002') || {}, a3 = L('9300000003') || {};
        dit(a1.numero === '12', `[A ${T}] la réf VRM-12 la relie à la N°12`, String(a1.numero));
        dit(a3.numero === '14', `[A ${T}] le lien posé à la main la relie à la N°14`, String(a3.numero));
        dit(a2.numero === '' && a2.relier, `[A ${T}] sans identité : pas de N° deviné, « à relier » avec le champ N°`, `numero=${a2.numero} relier=${a2.relier}`);
        dit(/Nike Air Max 1 olive T42/.test(a1.t || '') && /45,00 €/.test(a1.t || '') && /en ligne/.test(a1.t || ''), `[A ${T}] titre, prix et statut lisibles`, String(a1.t).replace(/\n/g, ' | ').slice(0, 140));
        dit(/désactivée/.test(a3.t || ''), `[A ${T}] un statut « inactive » se lit « désactivée », pas « en ligne »`, String(a3.t).replace(/\n/g, ' | ').slice(0, 140));
        dit((a1.liens || []).includes('https://www.leboncoin.fr/ad/chaussures/9300000001'), `[A ${T}] le lien mène à l’annonce sur leboncoin.fr`, JSON.stringify(a1.liens));
        dit(/vue il y a 10 j/.test(a2.t || '') && !/vue il y a/.test(a1.t || ''), `[A ${T}] l’âge n’est dit que pour une annonce vue il y a plus de 2 jours`, String(a2.t).replace(/\n/g, ' | ').slice(0, 140));
        dit(!/Boutique Banc/.test((a1.t || '') + (a2.t || '') + (a3.t || '')), `[A ${T}] un seul compte : il n’est pas répété sur chaque ligne (§7)`, String(a1.t).replace(/\n/g, ' | ').slice(0, 140));
        dit(!r.ratee, `[A ${T}] aucune fausse alerte de lecture`);
        dit(r.sw <= r.cw + 1 && !r.dehors.length, `[A ${T}] rien ne sort de l’écran (titre long compris)`, `${r.sw}/${r.cw} ${JSON.stringify(r.dehors).slice(0, 160)}`);
        dit(!garde(r.txt) && errs.length === 0, `[A ${T}] aucune erreur d’app`, (garde(r.txt) || '') + errs.join(' | ').slice(0, 160));
        await ctx.close();
      });
      // ── D. deux comptes ───────────────────────────────────────────────────
      await essaie(`[D ${T}]`, async () => {
        console.log(`── D. deux comptes · ${T}`);
        const { ctx, pg, errs } = await preparer(b, vp, SCENARIOS.deux);
        await ouvrir(pg);
        const r = await lire(pg);
        const L = (id) => r.lignes.find((l) => l.id === id) || {};
        dit(r.lignes.length === 4 && L('9300000007').id, `[D ${T}] les annonces des DEUX comptes à lui`, r.lignes.map((l) => l.id).join(','));
        dit(/Second Compte/.test(L('9300000007').t || '') && /Boutique Banc/.test(L('9300000001').t || ''), `[D ${T}] chaque ligne nomme son compte`, String(L('9300000007').t).replace(/\n/g, ' | ').slice(0, 140));
        dit(!L('9300000006').id && !L('9300000009').id, `[D ${T}] ni la vendue, ni l’inconnu`);
        dit(!garde(r.txt) && errs.length === 0, `[D ${T}] aucune erreur d’app`, (garde(r.txt) || '') + errs.join(' | ').slice(0, 160));
        await ctx.close();
      });
      // ── B. lecture ratée ──────────────────────────────────────────────────
      await essaie(`[B ${T}]`, async () => {
        console.log(`── B. lecture ratée · ${T}`);
        const { ctx, pg, errs, lectures } = await preparer(b, vp, SCENARIOS.passu);
        await ouvrir(pg);
        const r = await lire(pg);
        await pg.screenshot({ path: path.join(SORTIE, `lbc-annonces-passu-${vp.width}.png`) }).catch(() => {});
        dit(lectures.lbc > 0, `[B ${T}] la lecture des annonces Leboncoin a bien échoué (522)`, String(lectures.lbc));
        dit(r.ratee && /annonces Leboncoin/.test(r.rateeTxt), `[B ${T}] la lecture ratée est dite, en nommant tes annonces Leboncoin`, r.rateeTxt.slice(0, 160));
        dit((r.txt.match(/Je n'ai pas pu lire/g) || []).length === 1, `[B ${T}] dite UNE fois (§7)`, String((r.txt.match(/Je n'ai pas pu lire/g) || []).length));
        dit(r.etat !== 'aucune' && r.etat !== 'jamais' && !/Aucune en ligne|Pas encore vues/.test(r.txt), `[B ${T}] jamais « aucune annonce » ni « pas encore vues » sur une lecture ratée`, String(r.etat));
        dit(r.lignes.length === 0, `[B ${T}] aucune annonce inventée`, String(r.lignes.length));
        dit(r.sw <= r.cw + 1 && !r.dehors.length, `[B ${T}] rien ne sort de l’écran`, `${r.sw}/${r.cw} ${JSON.stringify(r.dehors).slice(0, 160)}`);
        dit(!garde(r.txt) && errs.length === 0, `[B ${T}] aucune erreur d’app`, (garde(r.txt) || '') + errs.join(' | ').slice(0, 160));
        await ctx.close();
      });
      // ── C. jamais capté ───────────────────────────────────────────────────
      await essaie(`[C ${T}]`, async () => {
        console.log(`── C. jamais capté · ${T}`);
        const { ctx, pg, errs } = await preparer(b, vp, SCENARIOS.jamais);
        await ouvrir(pg);
        const r = await lire(pg);
        await pg.screenshot({ path: path.join(SORTIE, `lbc-annonces-jamais-${vp.width}.png`) }).catch(() => {});
        dit(r.etat === 'jamais', `[C ${T}] « jamais capté » est un état à part`, String(r.etat));
        dit(/Mes annonces/.test(r.txt) && /leboncoin\.fr/.test(r.txt), `[C ${T}] il dit le geste : « Mes annonces » sur leboncoin.fr`);
        dit(r.lignes.length === 0 && !/Chalet|Gîtes du Lac/.test(r.txt), `[C ${T}] l’annonce de l’inconnu n’est toujours pas à lui`, String(r.lignes.length));
        dit(!r.ratee, `[C ${T}] ce n’est pas une panne : aucune alerte de lecture`);
        dit(r.sw <= r.cw + 1 && !r.dehors.length, `[C ${T}] rien ne sort de l’écran`, `${r.sw}/${r.cw} ${JSON.stringify(r.dehors).slice(0, 160)}`);
        dit(!garde(r.txt) && errs.length === 0, `[C ${T}] aucune erreur d’app`, (garde(r.txt) || '') + errs.join(' | ').slice(0, 160));
        await ctx.close();
      });
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ annonces Leboncoin : ${ko} rouge(s)` : '\n✅ annonces Leboncoin : tout est vert');
  process.exit(ko ? 1 : 0);
})();
