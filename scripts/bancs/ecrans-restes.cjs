// Banc : LES RESTES DES ÉCRANS (16 nov., lot ecrans-restes) — récit docs/passation/2026-11-16-ecrans-restes.md.
// Données INVENTÉES (aucun vrai pseudo, aucune vraie vente). Juge la RÈGLE (data-* et nombres rendus, §6.4) :
//   A. (27) le stock importé d'un autre outil (`vrm_stock_importe`) se voit dans le Stock, sous SON N°, avec
//      l'emplacement de son fichier ; une paire reliée à une annonce n'y est pas deux fois ; la loupe le trouve
//      par son N° (« Tout sur le N° ») ET par ses mots ;
//   B. (32) la fiche d'une vente à poster dit SA date limite (celle de l'e-mail du bordereau, `dateLimite`) ;
//      la loupe « colis à expédier » trouve le colis avec ce jour ;
//   C. (36) à la souris en 900 px, les filtres de site ne chevauchent pas la recherche (Ventes, Messages,
//      Achats) ; Messages entre 768 et 1023 px : aucun bloc blanc sous la conversation ; Paramètres à 1512 :
//      « Pas encore synchronisé · Réessayer » lisible (le bouton entier, sur une ligne) ;
//   D. aucune erreur d'app.
// Lancer : npm run build && BANC_PORT=… node scripts/bancs/ecrans-restes.cjs
//   BANC_DIST=<dist d'un autre arbre> (contre-épreuve) · SHOTS=<dossier> (captures) · PARTIES=A,B,C
const path = require('path'), fs = require('fs'), http = require('http');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');

const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 4000 + Math.floor(Math.random() * 3000);
const SHOTS = process.env.SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const PARTIES = (process.env.PARTIES || 'A,B,C,E').split(',');

const maintenant = new Date(2026, 10, 16, 10, 0, 0);
const il = (n, h = 12) => { const d = new Date(maintenant); d.setHours(h, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
const A = '111';
const cap = maintenant.toISOString();
const vente = (id, titre, prix, statut, d, tus) => ({ transaction_id: id, conversation_id: 50000 + id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: statut, transaction_user_status: tus, date: d.toISOString(), photo: { url: `https://images1.vinted.net/t/b${id % 4}/x.jpg` } });
const VENTES = [
  vente(8003, 'Nike Air Max 90 blanche taille 42', 65, 'Le paiement a été validé', il(1, 9), 'needs_action'),
  vente(8005, 'Adidas Samba noire taille 40', 55, 'Commande finalisée', il(6, 9), 'completed'),
];
const txn = (id, itemId, extra = {}) => ({ id: `harvest_${A}_txn_${id}`, data: { capturedAt: cap, payload: { transaction: { id, item_id: itemId, items_count: 1, status: extra.status || 230, status_title: extra.st || 'Le paiement a été validé', status_updated_at: il(0).toISOString(), order: { items: [{ id: itemId, title: 'x', price: { amount: '65', currency_code: 'EUR' } }] } } } } });
const FICHES = {
  6301: { numero: '160', buyPrice: '20', title: 'Nike Air Max 90 blanche', size: '42', accountId: A },
  6302: { numero: '161', buyPrice: '18', title: 'Adidas Samba noire', size: '40', accountId: A },
  6303: { numero: '905', title: 'New Balance 550 reliée', size: '43', accountId: A },
};
// Le stock importé : 2 paires libres, 1 reliée à une annonce par SON clic (N°905, `annonce`).
const IMPORTES = [
  { id: 'imp-1', importId: 'i1', numero: '900', titre: 'Asics Gel-1130 argent', prix: '25,00', date: '2026-10-02', emplacement: 'Carton B3', createdAt: il(5).toISOString(), source: 'importe' },
  { id: 'imp-2', importId: 'i1', numero: '901', titre: 'Puma Speedcat rouge', prix: '', date: '', emplacement: '', createdAt: il(5).toISOString(), source: 'importe' },
  { id: 'imp-3', importId: 'i1', numero: '905', titre: 'New Balance 550', prix: '30,00', date: '', emplacement: 'Carton C1', createdAt: il(5).toISOString(), source: 'importe', annonce: '6303' },
];
const LISTINGS = [{ id: `harvest_${A}_listings`, data: { capturedAt: cap, payload: { items: [
  { id: 6303, title: 'New Balance 550 reliée', brand_title: 'New Balance', size_title: '43', price: { amount: '70', currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, photo: { url: '' }, created_at_ts: il(10).toISOString() },
], pagination: null } } }];
const INBOX = [{ id: `harvest_${A}_inbox`, data: { capturedAt: cap, payload: { conversations: Array.from({ length: 6 }, (_, i) => ({
  id: 900000 + i, description: 'Bonjour, est-elle toujours disponible ? ' + i, unread: i % 2 === 0, updated_at: il(i).toISOString(),
  opposite_user: { id: 70000 + i, login: 'acheteur_test_' + i, photo: null }, item_count: 1, item_photos: [],
})), pagination: { current_page: 1, total_pages: 1 } } } }];
const LIGNES = [
  { id: `harvest_${A}_orders_sold`, data: { capturedAt: cap, payload: { my_orders: VENTES } } },
  txn(8003, 6301), txn(8005, 6302, { status: 450, st: 'Commande finalisée' }),
  // Le bordereau de 8003, reçu par e-mail : SA date limite (le texte de l'e-mail) et son PDF (témoin `_pdf`).
  { id: 'email_bord_8003', data: { type: 'bordereau', transaction: '8003', numero: '160', modele: 'Nike Air Max 90 blanche', article: 'Nike Air Max 90 blanche', account: 'boutique_banc', uid: A, filename: 'bordereau-8003.pdf', _pdf: 'true', dateLimite: '19/11/2026 10 h 00', receivedAt: il(0, 8).toISOString() } },
  ...LISTINGS, ...INBOX,
];
const ACCOUNTS = [
  { id: 1, vinted_user_id: A, login: 'boutique_banc', domain: 'www.vinted.fr', updated_at: cap, created_at: il(400).toISOString() },
  { id: 2, vinted_user_id: '222', login: 'boutique_deux', domain: 'www.vinted.fr', updated_at: cap, created_at: il(400).toISOString() },
];

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d && !c ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 200)); } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
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
const UA_PC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
// `ecrituresKO` : la base REFUSE d'écrire (503) — « Pas encore synchronisé » doit se montrer.
const ouvrir = async (b, vp, { tactile = vp.width < 600, ecrituresKO = false, sombre = false, cloisonne = false, main = null } = {}) => {
  const ctx = await b.newContext({ viewport: vp, locale: 'fr-FR', deviceScaleFactor: 1, ...(tactile ? { isMobile: true, hasTouch: true } : { userAgent: UA_PC }) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
  const ecrits = [];
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript(([f, imp, s]) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', s ? 'true' : 'false'); localStorage.setItem('vinted_annonce_numeros', JSON.stringify(f)); localStorage.setItem('vrm_stock_importe', JSON.stringify(imp)); localStorage.setItem('vinted_used_numeros', JSON.stringify(['160', '161', '900', '901', '905'])); } catch (_) {} }, [FICHES, IMPORTES, sombre]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const h = { 'access-control-allow-origin': '*' };
    if (route.request().method() !== 'GET') { try { ecrits.push(route.request().postData() || ''); } catch (_) {} }
    if (route.request().method() !== 'GET') return ecrituresKO ? route.fulfill({ status: 503, contentType: 'application/json', headers: h, body: '{"message":"indisponible"}' }) : route.fulfill({ status: 201, contentType: 'application/json', headers: h, body: '[]' });
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { ...h, 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return cloisonne ? j([]) : route.fulfill({ status: 400, contentType: 'application/json', headers: h, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: cap, cap: r.data.capturedAt });
    const dans = /[?&]id=in\.\(([^)]*)\)/.exec(u);
    if (dans) { const ids = dans[1].split(','); return j(LIGNES.filter((r) => ids.includes(r.id)).map(forme)); }
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq && eq[1] === 'main' && main) return j([forme({ id: 'main', data: main })]);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map(forme));
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs, ecrits };
};
const aller = async (pg, tab) => {
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.vrm-app-shell', { timeout: 30000 }).catch(() => {});
  await pg.waitForTimeout(2500);
};
const shot = async (pg, nom) => { if (SHOTS) { try { await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }); } catch (_) {} } };
// La loupe ouverte sur une requête : le chemin de « Tout sur le N° » (`vrm:fiche-article`, une chaîne), le même au
// téléphone et sur ordinateur (le champ du téléphone n'est monté qu'à l'ouverture).
const chercher = async (pg, q) => {
  await pg.evaluate((t) => { try { window.dispatchEvent(new CustomEvent('vrm:fiche-article', { detail: t })); } catch (_) {} }, q);
  await pg.waitForSelector('[data-recherche-panneau]', { timeout: 10000 }).catch(() => {});
  await pg.waitForTimeout(2000);
  return true;
};

// Les boîtes de la barre du haut : la recherche et chaque filtre de site visibles ne se chevauchent pas.
const CHEVAUCHE = () => {
  const vis = (e) => { if (!e) return false; const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return false; const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
  const recherche = [...document.querySelectorAll('.vrm-barre-recherche, [data-recherche-ouvrir]')].filter(vis);
  const filtres = [...document.querySelectorAll('.vrm-filtre-site, [data-filtre-site]')].filter(vis);
  const out = [];
  for (const a of recherche) for (const f of filtres) {
    if (a.contains(f) || f.contains(a)) continue;
    const x = a.getBoundingClientRect(), y = f.getBoundingClientRect();
    if (x.left < y.right - 1 && y.left < x.right - 1 && x.top < y.bottom - 1 && y.top < x.bottom - 1) out.push(`${Math.round(x.left)}–${Math.round(x.right)} / ${Math.round(y.left)}–${Math.round(y.right)} (${f.getAttribute('data-filtre-site') || f.className.slice(0, 30)})`);
  }
  return { n: recherche.length, f: filtres.length, out };
};

(async () => {
  await new Promise((res, rej) => { srv.once('error', rej); srv.listen(PORT, res); }).catch(() => { console.log('❌ port ' + PORT + ' pris — relance avec BANC_PORT=…'); process.exit(1); });
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });

  if (PARTIES.includes('A')) {
    console.log('\n── A. (27) le stock importé d’un autre outil');
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 945 }]) await essaie('A ' + vp.width, async () => {
      const { ctx, pg, errs } = await ouvrir(b, vp);
      await aller(pg, 'garage');
      await pg.waitForSelector('[data-stock-importees]', { timeout: 25000 }).catch(() => {});
      await pg.waitForFunction(() => [...document.querySelectorAll('[data-stock-importee="900"]')].some((e) => e.getClientRects().length && /Carton/.test(e.innerText || '')), null, { timeout: 15000 }).catch(() => {});
      const r = await pg.evaluate(() => {
        const s = [...document.querySelectorAll('[data-stock-importees]')].find((e) => e.getClientRects().length) || null;
        const l = (n) => [...document.querySelectorAll(`[data-stock-importee="${n}"]`)].find((e) => e.getClientRects().length) || null;
        return { n: s ? s.getAttribute('data-stock-importees') : null, a900: l('900') ? l('900').innerText.replace(/\s+/g, ' ') : null, a901: l('901') ? l('901').innerText.replace(/\s+/g, ' ') : null, a905: !!l('905') };
      });
      if (r.n) await pg.locator('[data-stock-importees]').first().scrollIntoViewIfNeeded().catch(() => {});
      await shot(pg, `A-stock-${vp.width}`);
      dit(r.n === '2', `A1 ${vp.width} Stock : les 2 paires importées libres se voient (la reliée N°905 est déjà dans la liste)`, JSON.stringify(r));
      dit(!!r.a900 && /900/.test(r.a900) && /Asics/.test(r.a900) && /Carton B3/.test(r.a900) && /25,00/.test(r.a900), `A2 ${vp.width} N°900 : titre, emplacement de son fichier, prix d’achat`, r.a900);
      dit(!!r.a901 && !/0,00|NaN|undefined/.test(r.a901), `A3 ${vp.width} N°901 sans emplacement ni prix : dit, jamais 0`, r.a901);
      dit(r.n != null && !r.a905, `A4 ${vp.width} la paire reliée à une annonce (N°905) n’est pas une seconde fois (la liste est là, sans elle)`, JSON.stringify(r));
      if (vp.width === 1512) {
        await chercher(pg, '900');
        await pg.waitForSelector('[data-tout-importe="900"]', { timeout: 15000 }).catch(() => {});
        const t = await pg.evaluate(() => { const e = document.querySelector('[data-tout-importe="900"]'); const z = document.querySelector('[data-tout-num="900"]'); return { ligne: e ? e.innerText.replace(/\s+/g, ' ') : null, etat: z ? z.getAttribute('data-tout-etat') : null }; });
        await shot(pg, 'A-loupe-numero-1512');
        dit(!!t.ligne && /Asics/.test(t.ligne) && /Carton B3/.test(t.ligne) && t.etat === 'trouve', 'A5 la loupe « Tout sur le N°900 » trouve la paire importée (par son N°)', JSON.stringify(t));
        await chercher(pg, 'speedcat');
        await pg.waitForSelector('[data-recherche-cle="stock:901"]', { timeout: 15000 }).catch(() => {});
        const m = await pg.evaluate(() => { const e = document.querySelector('[data-recherche-cle="stock:901"]'); return e ? e.innerText.replace(/\s+/g, ' ') : null; });
        await shot(pg, 'A-loupe-mots-1512');
        dit(!!m && /Puma Speedcat/.test(m) && /901/.test(m), 'A6 la loupe trouve une paire importée par ses mots (« speedcat »)', m);
      }
      if (errs.length) dit(false, `A ${vp.width} aucune erreur d’app`, errs.slice(0, 2).join(' | '));
      await ctx.close();
    });
  }
  if (PARTIES.includes('B')) {
    console.log('\n── B. (32) la date limite d’envoi dans la fiche et la loupe');
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 945 }]) await essaie('B ' + vp.width, async () => {
      const { ctx, pg, errs } = await ouvrir(b, vp);
      // Ventes « À expédier » publie la liste des colis (la loupe la lit) : ouverte d'abord.
      await aller(pg, 'cat_ventes');
      await pg.waitForFunction(() => { try { const p = JSON.parse(localStorage.getItem('vrm_colis_aposter') || 'null'); return !!p; } catch (_) { return false; } }, null, { timeout: 30000 }).catch(() => {});
      const pub = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_colis_aposter') || 'null'); } catch (_) { return null; } });
      dit(!!pub && Array.isArray(pub.liste) && pub.liste.some((x) => x.num === '160' && x.jour === '2026-11-19' && x.heure === '10:00' && !x.estimee), `B1 ${vp.width} la publication « à expédier » porte le colis N°160, sa limite LUE (19 nov. 10 h)`, JSON.stringify(pub && pub.liste));
      dit(!!pub && Array.isArray(pub.liste) && !JSON.stringify(pub.liste).match(/acheteur|rue |@/), `B2 ${vp.width} ni acheteur ni adresse dans la publication`);
      await chercher(pg, 'colis à expédier');
      await pg.waitForSelector('[data-recherche-resultat="phrase-colis-envoyer"]', { timeout: 15000 }).catch(() => {});
      const q = await pg.evaluate(() => [...document.querySelectorAll('[data-recherche-resultat="phrase-colis-envoyer"]')].map((e) => ({ lim: e.getAttribute('data-phrase-limite'), num: e.getAttribute('data-phrase-num'), t: e.innerText.replace(/\s+/g, ' ') })));
      await shot(pg, `B-loupe-envoyer-${vp.width}`);
      dit(q.length === 1 && q[0].lim === '2026-11-19' && q[0].num === '160' && /19 nov/.test(q[0].t), `B3 ${vp.width} la loupe « colis à expédier » trouve le colis et dit sa limite`, JSON.stringify(q));
      await chercher(pg, '160');
      await pg.locator('[data-tout-parcours="160"]').first().click({ timeout: 20000 }).catch(() => {});
      await pg.waitForSelector('[data-fd-limite]', { timeout: 20000 }).catch(() => {});
      const f = await pg.evaluate(() => [...document.querySelectorAll('[data-fd-limite]')].filter((e) => e.getClientRects().length).map((e) => ({ jour: e.getAttribute('data-fd-limite'), est: e.getAttribute('data-fd-limite-estimee'), t: e.innerText.replace(/\s+/g, ' ') })));
      await shot(pg, `B-fiche-${vp.width}`);
      dit(f.length >= 1 && f.every((x) => x.jour === '2026-11-19') && f.some((x) => /avant le 19 nov\. à 10 h/.test(x.t)), `B4 ${vp.width} la fiche du N°160 dit sa date limite d’envoi (celle du bordereau)`, JSON.stringify(f));
      if (errs.length) dit(false, `B ${vp.width} aucune erreur d’app`, errs.slice(0, 2).join(' | '));
      await ctx.close();
    });
  }
  if (PARTIES.includes('E')) {
    console.log('\n── E. (51) « Plus tard » de la carte MFA, sur tous ses appareils');
    await essaie('E', async () => {
      const { ctx, pg, ecrits } = await ouvrir(b, { width: 1512, height: 945 }, { cloisonne: true });
      await aller(pg, 'settings');
      const vue = await pg.waitForSelector('[data-carte-mfa-plus-tard]', { timeout: 20000 }).then(() => true).catch(() => false);
      dit(vue, 'E1 la carte « Protège ton compte VRM » se montre (double vérification lue inactive)');
      await pg.evaluate(() => { const b = [...document.querySelectorAll('[data-carte-mfa-plus-tard]')].find((e) => e.getClientRects().length); if (b) b.click(); });
      await pg.waitForFunction(() => !document.querySelector('[data-carte-mfa]'), null, { timeout: 5000 }).catch(() => {});
      for (let t = 0; t < 30 && !ecrits.some((x) => /vrm_carte_mfa_rangee/.test(x)); t++) await pg.waitForTimeout(1000);
      const dbg = await pg.evaluate(() => ({ carte: [...document.querySelectorAll('[data-carte-mfa]')].some((e) => e.getClientRects().length), ls: localStorage.getItem('vrm_carte_mfa_rangee') }));
      if (process.env.DBG) console.log(JSON.stringify(dbg));
      const part = ecrits.some((x) => /vrm_carte_mfa_rangee/.test(x));
      dit(part, 'E2 « Plus tard » part au nuage (ligne du vendeur), pas seulement sur cet appareil', `${ecrits.length} écritures, aucune avec la clé : ` + ecrits.map((x) => x.slice(0, 90)).join(' || '));
      await ctx.close();
      // Un AUTRE appareil (stockage vide) : le nuage dit « rangée » ⇒ la carte ne revient pas.
      const o2 = await ouvrir(b, { width: 390, height: 844 }, { cloisonne: true, main: { vrm_carte_mfa_rangee: 1 } });
      await o2.pg.goto(`http://localhost:${PORT}/?tab=settings`, { waitUntil: 'domcontentloaded' });
      await o2.pg.waitForSelector('.vrm-app-shell', { timeout: 30000 }).catch(() => {});
      await o2.pg.waitForTimeout(3000);
      await o2.pg.evaluate(() => { const b = [...document.querySelectorAll('button')].filter((e) => e.getClientRects().length && /Mon compte/.test(e.innerText || '') && !e.closest('nav')).pop(); if (b) b.click(); });
      await o2.pg.waitForSelector('input[aria-label="Ton prénom"]', { timeout: 20000 }).catch(() => {});
      await o2.pg.waitForTimeout(3000);
      const encore = await o2.pg.evaluate(() => [...document.querySelectorAll('[data-carte-mfa]')].some((e) => e.getClientRects().length));
      const temoin = await o2.pg.evaluate(() => [...document.querySelectorAll('input[aria-label="Ton prénom"]')].some((e) => e.getClientRects().length));
      await shot(o2.pg, 'E-autre-appareil-390');
      dit(temoin && !encore, 'E3 sur un autre appareil, la carte rangée ailleurs ne revient pas', JSON.stringify({ temoin, encore }));
      await o2.ctx.close();
    });
  }
  if (PARTIES.includes('C')) {
    console.log('\n── C. (36) iPad / 900 px / 1512 px');
    await essaie('C1', async () => {
      const { ctx, pg, errs } = await ouvrir(b, { width: 900, height: 760 }, { tactile: false });
      for (const t of ['cat_ventes', 'cat_msg', 'cat_achats']) {
        await aller(pg, t);
        const r = await pg.evaluate(CHEVAUCHE);
        await shot(pg, `C1-900-${t}`);
        dit(r.n > 0 && r.out.length === 0, `C1 900 px souris ${t} : la recherche et les filtres de site ne se chevauchent pas (${r.n} recherche, ${r.f} filtres)`, r.out.join(' | ') || `recherche visible : ${r.n}`);
      }
      if (errs.length) dit(false, 'C1 aucune erreur d’app', errs.slice(0, 2).join(' | '));
      await ctx.close();
    });
    for (const [w, h, tactile] of [[768, 1024, false], [900, 760, false], [1000, 800, false], [820, 1180, true]]) await essaie('C2 ' + w, async () => {
      const { ctx, pg } = await ouvrir(b, { width: w, height: h }, { tactile });
      await aller(pg, 'cat_msg');
      await pg.waitForSelector('[data-messagerie] .vrm-inbox-column', { timeout: 15000 }).catch(() => {});
      const conv = pg.locator('.vrm-inbox-column button.vrm-inbox-row[data-conv]').first();
      await conv.click({ timeout: 5000 }).catch(() => {});
      await pg.waitForTimeout(1500);
      // Le « bloc blanc » : la zone de travail (fond opaque) dépasse sous la conversation ou sous la liste.
      const r = await pg.evaluate(() => {
        const ws = document.querySelector('.vrm-message-workspace'); const chat = ws && ws.querySelector(':scope > .vrm-chat-column'); const inbox = ws && ws.querySelector(':scope > .vrm-inbox-column');
        if (!ws || !chat || !inbox) return { pas: true };
        const W = ws.getBoundingClientRect(), Ch = chat.getBoundingClientRect(), I = inbox.getBoundingClientRect();
        const m = /rgba?\(([^)]+)\)/.exec(getComputedStyle(ws).backgroundColor || ''); const p = m ? m[1].split(',').map(Number) : [0, 0, 0, 0]; const opaque = !!m && (p.length < 4 || p[3] > 0.5);
        const colonnes = Math.abs(Ch.top - I.top) < 4 && Ch.left >= I.right - 4;   // deux colonnes côte à côte
        return { colonnes, opaque, sousChat: Math.round(W.bottom - Ch.bottom), sousListe: Math.round(W.bottom - I.bottom), ouverte: chat.getAttribute('data-conv-ouverte') || '' };
      });
      await shot(pg, `C2-msg-${w}`);
      dit(!r.pas && (!r.colonnes || !r.opaque || (r.sousChat <= 24 && r.sousListe <= 24)), `C2 Messages à ${w} px${tactile ? ' (doigt)' : ''} : aucun bloc vide sous la conversation ni sous la liste`, JSON.stringify(r));
      await ctx.close();
    });
    await essaie('C3', async () => {
      const { ctx, pg } = await ouvrir(b, { width: 1512, height: 945 }, { tactile: false, ecrituresKO: true, cloisonne: true });
      await aller(pg, 'settings');
      // Un réglage synchronisé changé (son prénom), la base refuse d'écrire : la ligne d'état doit le dire, lisible.
      const champ = pg.locator('input[aria-label="Ton prénom"]').first();
      await champ.fill('Banc', { timeout: 8000 }).catch(() => {});
      await pg.waitForSelector('[data-statut-reglages="echec"]', { timeout: 90000 }).catch(() => {});
      await pg.waitForTimeout(800);
      const r = await pg.evaluate(() => {
        const s = document.querySelector('[data-statut-reglages]'); if (!s) return { absent: true };
        const b = s.querySelector('button'); const t = s.querySelector('span:not(.vrm-settings-status-pt)');
        const rb = b ? b.getBoundingClientRect() : null;
        const lh = b ? parseFloat(getComputedStyle(b).lineHeight) || 16 : 16;
        return { etat: s.getAttribute('data-statut-reglages'), bouton: b ? { w: Math.round(rb.width), h: Math.round(rb.height), sw: b.scrollWidth, cw: b.clientWidth, txt: b.innerText } : null,
          texte: t ? { sw: t.scrollWidth, cw: t.clientWidth, txt: t.innerText } : null, lh };
      });
      await shot(pg, 'C3-parametres-1512');
      if (r.absent) { dit(false, 'C3 Paramètres 1512 : la ligne « Pas encore synchronisé » se montre quand la base refuse', 'absente'); }
      else {
        dit(r.bouton && r.bouton.sw <= r.bouton.cw + 1 && r.bouton.h < 2 * r.lh + 20 && /Réessayer/.test(r.bouton.txt.replace(/\s/g, '')), 'C3 Paramètres 1512 : « Réessayer » entier, sur une ligne', JSON.stringify(r));
        dit(r.texte && r.texte.sw <= r.texte.cw + 1, 'C3 Paramètres 1512 : « Pas encore synchronisé » entier (jamais « Pas en… »)', JSON.stringify(r.texte));
      }
      await ctx.close();
    });
  }
  await b.close(); srv.close();
  console.log(`\n${ok} conformes · ${ko} non conformes`);
  process.exit(ko ? 1 : 0);
})();
