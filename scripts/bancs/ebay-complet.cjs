// Banc : eBay complet (11 nov., lot `ebay-complet`) — la connexion guidée, TOUS
// les réglages de publication, les questions (« l'app DEMANDE »), les fenêtres
// guidées, les erreurs d'eBay traduites. Rendu réel (dist/), FAUX eBay (aucun
// appel réel), données INVENTÉES. 390 px tactile et 1512 px sombre ; captures
// dans scripts/bancs/captures/ebay-complet-*.png (à REGARDER, §6.2).
//   NODE_OPTIONS="--require=./scripts/bancs/_porte-banc.cjs --require=./scripts/bancs/_garde-reseau.cjs" BANC_PORT=… node scripts/bancs/ebay-complet.cjs
// On exige :
//   A. non relié : trois étapes dites AVANT, un bouton qui demande `authurl` ;
//   B. retour raté (« autre navigateur ») : la phrase traduite + son geste, jamais le texte brut ;
//   C. deux comptes : le jeton qui expire dans 18 j est dit (ambre) avec « Reconnecter » ;
//      l'autre dit sa date ; « Réglages de publication » ⇒ la feuille (défauts) : enchères + délai 1 j
//      rangés (`vrm_ebay_publication_defaut`), le résumé suit ; la politique d'expédition n'est jamais proposée ;
//   D. 1re publication en un clic : la fenêtre « Ta première annonce » ; une caractéristique OBLIGATOIRE que
//      Vinted ne donne pas (Couleur, liste fermée) ⇒ DEMANDÉE avec les valeurs d'eBay ; la réponse part dans
//      l'annonce ; sans réglage, l'annonce ne porte pas `parametres` (comme avant) ;
//   E. réglages de CETTE annonce (offres, retours 30 j, sponsorisée 6 %) : la confirmation dit le coût ;
//      `parametres` = { offres, retours } exactement ; puis `promouvoir` (6.0) sur l'annonce créée ;
//   F. aucune catégorie proposée ⇒ « Quelle catégorie ? » : recherche par mots (`parametres` q), choix ⇒ ses
//      caractéristiques (pubinfo avec SA catégorie) ;
//   G. eBay refuse (caractéristique manquante, code 21919303) ⇒ phrase traduite + geste + « eBay dit » ;
//   H. « Comment faire ? » sur Ventes eBay ⇒ la fenêtre « vendue » (étiquette prépayée dans eBay, §2.8) ;
//   I. 390 px : pas de défilement horizontal, cibles de la feuille ≥ 44 px ; aucune erreur de page.
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const CAPT = path.join(__dirname, 'captures');
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 7941;
const MAINTENANT = Date.parse('2026-11-11T09:00:00.000Z');
const JOUR = 86400000;
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: new Date(MAINTENANT).toISOString() }];
const PAIRES = [[31, 'Nike Air Max 90 taille 42', 'Nike', '42', 95], [32, 'Adidas Samba taille 40', 'Adidas', '40', 80], [33, 'Objet bizarre sans nom', '', '', 30]];
const idDe = (n) => 7000 + n;
const LISTINGS = { capturedAt: new Date(MAINTENANT).toISOString(), payload: { items: PAIRES.map(([n, t, m, tl, p]) => ({ id: idDe(n), title: t, brand: m, size: tl, status: 'Très bon état', price: { amount: String(p), currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, nPhotos: 1, photos: [{ url: `https://img.test/v${idDe(n)}.jpg` }] })) } };
const FICHES = Object.fromEntries(PAIRES.map(([n, t]) => [String(idDe(n)), { numero: String(n), title: t, photo: `https://img.test/v${idDe(n)}.jpg` }]));
const DETAILS = Object.fromEntries(PAIRES.map(([n]) => [String(idDe(n)), { photos: [`https://img.test/v${idDe(n)}.jpg`] }]));
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGNk+M+ADzCOKgAAV7wDA8mm/lgAAAAASUVORK5CYII=', 'base64');
const JETON = (savedJ) => ({ enregistreLe: MAINTENANT - savedJ * JOUR, expireLe: MAINTENANT + (548 - savedJ) * JOUR, joursRestants: 548 - savedJ, etat: 548 - savedJ <= 0 ? 'expire' : 548 - savedJ <= 30 ? 'bientot' : 'ok' });

let rows = [], envois = [], SC = {};
const remettre = (sc = {}) => {
  SC = sc;
  rows = [
    { id: 'main', data: { vinted_annonce_numeros: FICHES } },
    { id: 'harvest_111_listings', data: LISTINGS },
    { id: 'vinted_item_details', data: DETAILS },
    { id: 'ebay_listings', data: { items: [{ itemId: '110000000044', title: 'Nike Air Max 90 taille 42', price: '95.0', sku: 'VRM-99' }], capturedAt: MAINTENANT } },
    { id: 'ebay_comptes', data: { comptes: [{ principal: true, cle: 'aaaaaaaaaaaaaaaa', pseudo: 'vendeur_pro', type: 'pro', site: 'FR' }] } },
    // Une vente payée : l'acheteur a payé 106,50 € (port compris) ; dû au vendeur 105, frais eBay 5 ⇒ REÇU 100 €.
    { id: 'ebay_orders', data: { orders: [{ orderId: '07-11111-22222', creationDate: '2026-11-10T10:00:00.000Z', orderPaymentStatus: 'PAID', orderFulfillmentStatus: 'NOT_STARTED', lineItems: [{ sku: 'VRM-99', title: 'Nike Air Max 90 taille 42', quantity: 1 }], pricingSummary: { total: { value: '106.50', currency: 'EUR' } }, paymentSummary: { totalDueSeller: { value: '105.00', currency: 'EUR' } }, totalMarketplaceFee: { value: '5.00', currency: 'EUR' } }], capturedAt: MAINTENANT } },
  ];
  envois = [];
};
let ko = 0, okc = 0;
const dit = (c, m, d) => { if (c) okc++; else ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + String(d).slice(0, 300) : '')); };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { dit(false, quoi, 'a levé : ' + String((e && e.message) || e).split('\n')[0].slice(0, 200)); return null; } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.onnx': 'application/octet-stream' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg.replace(/^"|"$/g, '')];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? String(v) : v);
  }
  return out;
};
const ASPECTS_31 = [
  { nom: 'Marque', requis: true, mode: 'FREE_TEXT', valeurs: ['Nike', 'Adidas'] },
  { nom: 'Couleur', requis: true, mode: 'SELECTION_ONLY', valeurs: ['Noir', 'Blanc', 'Bleu'] },
];
async function ouvrir(b, vp, sombre) {
  const ctx = await b.newContext({ viewport: vp, locale: 'fr-FR', timezoneId: 'Europe/Paris', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.setFixedTime(new Date(MAINTENANT));
  await pg.addInitScript(([fiches, sombre]) => { try {
    localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_annonce_numeros', JSON.stringify(fiches));
    if (sombre) { localStorage.setItem('vinted_dark', 'true'); localStorage.setItem('vrm_bascule_mineral_v1', '1'); } } catch (_) {} }, [FICHES, !!sombre]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image'].includes(r.request().resourceType()) ? r.fulfill({ status: 200, contentType: 'image/png', body: PNG }) : r.abort()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return j({ m: 1 }, 400);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: new Date(MAINTENANT).toISOString(), cap: r.data && r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(rows.filter((r) => ids.includes(r.id)).map(forme)); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.route('**/api/ebay**', async (route) => {
    const req = route.request();
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (req.method() !== 'POST') return j({ ok: true, ready: true, canConsent: true });
    let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch (_) {}
    envois.push(JSON.parse(JSON.stringify(body)));
    if (body.action === 'status') return SC.nonRelie ? j({ ok: true, connected: false, comptes: [] })
      : j({ ok: true, connected: true, comptes: [{ cle: 'aaaaaaaaaaaaaaaa', pseudo: 'vendeur_pro', principal: true, relie: true, type: 'pro', site: 'FR', siteLu: true, jeton: JETON(530) }, ...(SC.unSeul ? [] : [{ cle: 'bbbbbbbbbbbbbbbb', pseudo: 'vendeur_perso', principal: false, relie: true, type: 'particulier', site: 'FR', siteLu: true, jeton: JETON(10) }])] });
    if (body.action === 'authurl') return j({ ok: false, error: 'banc : aucun départ vers eBay' });
    if (body.action === 'parametres') {
      if (body.q) return j({ ok: true, categories: [{ id: '15709', nom: 'Baskets', chemin: 'Mode › Chaussures homme' }, { id: '11450', nom: 'Vêtements', chemin: 'Mode' }], categoryId: null, aspects: null, conditions: null, compte: null });
      return j({ ok: true, categories: null, aspects: null, conditions: null, compte: { type: 'pro', politiquesActivees: true, paiement: [{ id: '6200000001', nom: 'Paiement immédiat' }], retour: [{ id: '6200000002', nom: 'Retours 30 jours' }], expedition: [{ id: '6200000009', nom: 'Livraison standard' }], emplacements: [] } });
    }
    if (body.action === 'pubinfo') {
      if (/bizarre/i.test(body.title || '') && !body.categoryId) return j({ ok: true, categorie: { categoryId: '', suggeree: null }, categories: [], conditions: [], attributs: [] });
      const attributs = /Nike/.test(body.title || '') ? ASPECTS_31 : [{ nom: 'Marque', requis: true, mode: 'FREE_TEXT', valeurs: [] }];
      return j({ ok: true, categorie: { categoryId: body.categoryId || '15709', suggeree: { categoryId: body.categoryId || '15709', categoryName: 'Baskets' } }, categories: [{ categoryId: '15709', categoryName: 'Baskets' }], conditions: [{ id: '3000', label: "D'occasion" }], attributs, attributsObligatoires: attributs.filter((a) => a.requis).map((a) => a.nom) });
    }
    if (body.action === 'pubverify') {
      if (SC.refusCarac) return j({ ok: false, error: 'The item specific Brand is missing.', erreurs: [{ code: '21919303', severite: 'Error', message: 'The item specific Brand is missing.', params: ['Brand'] }] });
      return j({ ok: true, fees: 0.35, frais: { total: 0.35, insertion: 0.35, programmation: null, remises: null, devise: 'EUR', lignes: [] } });
    }
    if (body.action === 'publish') return j({ ok: true, itemId: '110000000031', url: 'https://www.ebay.fr/itm/110000000031', sku: 'VRM-' + ((body.item && body.item.numero) || '') });
    if (body.action === 'promouvoir') return j({ ok: true, taux: body.taux, campagne: '1' });
    if (body.action === 'remises') return j({ ok: true, remises: [{ id: '9001', nom: 'Soldes', etat: 'RUNNING', type: 'periode', debut: '2026-11-01T00:00:00Z', fin: '2026-11-20T10:00:00Z' }] });
    if (body.action === 'poserremise') return j({ ok: true, id: '9100', type: body.type, fin: body.fin, n: (body.listingIds || []).length });
    if (body.action === 'messages') return j({ ok: true, page: 1, totalPages: 1, messages: [{ id: '5550001', itemId: '110000000044', titre: 'Nike Air Max 90 taille 42', sender: 'acheteur_x', subject: 'Question', body: 'Elle taille grand ?', responses: [], status: 'Unanswered', date: '2026-11-11T08:00:00Z', type: 'AskSellerQuestion' }] });
    if (body.action === 'repondre') return j({ ok: true });
    return j({ ok: true });
  });
  return { ctx, pg, errs };
}
const capt = async (pg, nom) => { try { fs.mkdirSync(CAPT, { recursive: true }); await pg.screenshot({ path: path.join(CAPT, `ebay-complet-${nom}.png`) }); } catch (_) {} };
const action = (a) => envois.filter((e) => e.action === a);
const ouvrirVendre = async (pg) => {
  await pg.goto(`http://localhost:${PORT}/?tab=annonces&site=ebay`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('[data-poster="ebay"]', { timeout: 25000 });
  await pg.click('[data-poster="ebay"]');
  await pg.waitForSelector('[data-choix-paire="31"]', { timeout: 15000 });
};
const SEUL = (process.env.BANC_SEUL || '').split(',').filter(Boolean);
let PGC = null, TAGC = '';
const garde = (q, f) => (SEUL.length && !SEUL.includes(q) ? Promise.resolve() : essaie(q, async () => { try { return await f(); } catch (e) { if (PGC) await capt(PGC, `${q}-echec-${TAGC}`); throw e; } }));
// « 1 point à vérifier » (src/verifAnnonce.js : une seule photo) : il publie quand même.
const quandMeme = async (pg) => { try { await pg.getByRole('button', { name: /Publier quand même/ }).last().click({ timeout: 4000 }); } catch (_) {} };
const ok = async (pg, nom = /Oui, publier/) => { if (/publier/i.test(String(nom))) await quandMeme(pg); await pg.getByRole('button', { name: nom }).last().click({ timeout: 8000 }); };

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const [vp, sombre] of [[{ width: 390, height: 844 }, false], [{ width: 1512, height: 950 }, true]]) {
      const mobile = vp.width < 600, tag = mobile ? '390' : '1512';
      console.log(`── ${vp.width} px${sombre ? ' (sombre)' : ''}`);
      remettre({ nonRelie: true });
      const { ctx, pg, errs } = await ouvrir(b, vp, sombre); PGC = pg; TAGC = tag;
      await garde('A', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=plat_ebay&section=compte`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-ebay-connexion-guidee]', { timeout: 25000 });
        const n = await pg.$$eval('[data-ebay-cx-etape]', (l) => l.length);
        const t = await pg.$eval('[data-ebay-connexion-guidee]', (e) => e.innerText);
        dit(n === 3 && /mot de passe ne passe jamais par VRM/.test(t), 'A. non relié : trois étapes dites AVANT (le mot de passe ne passe pas par VRM)', t.replace(/\s+/g, ' ').slice(0, 160));
        await pg.click('[data-ebay-connecter]');
        await pg.waitForTimeout(600);
        dit(action('authurl').length === 1, '   le bouton demande UNE adresse de connexion (`authurl`)', JSON.stringify(action('authurl')));
        await capt(pg, `A-${tag}`);
      });
      await garde('B', async () => {
        await pg.goto(`http://localhost:${PORT}/?ebay=erreur&raison=${encodeURIComponent('demande expirée ou faite dans un autre navigateur — relance la connexion eBay depuis VRM, dans ce navigateur')}`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-ebay-retour]', { timeout: 25000 }).catch(async (e) => { await capt(pg, `B-echec-${tag}`); console.log('    (B) url=' + pg.url() + ' section=' + !!(await pg.$('[data-ebay-compte-section]')) + ' guidee=' + !!(await pg.$('[data-ebay-connexion-guidee]'))); throw e; });
        const code = await pg.$eval('[data-ebay-retour]', (e) => e.getAttribute('data-ebay-retour'));
        const t = await pg.$eval('[data-ebay-retour]', (e) => e.innerText);
        dit(code === 'navigateur' && /dans ce navigateur, en moins de 30 min/.test(t) && !/demande expirée ou faite/.test(t), 'B. retour raté : la phrase traduite et son geste, jamais le texte brut', t.replace(/\s+/g, ' '));
        await capt(pg, `B-${tag}`);
        await pg.goto(`http://localhost:${PORT}/?ebay=connecte&compte=vendeur_pro&nouveau=1`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-ebay-retour="connecte"]', { timeout: 25000 });
        const t2 = await pg.$eval('[data-ebay-retour]', (e) => e.innerText);
        dit(/Compte eBay « vendeur_pro » ajouté/.test(t2) && /Vérifié chez eBay/.test(t2), '   retour réussi (adresse SANS onglet, celle d’eBay) : Comptes eBay s’ouvre et dit le compte constaté', t2.replace(/\s+/g, ' '));
        dit(!/ebay=/.test(pg.url()), '   l’adresse est nettoyée', pg.url());
      });
      await ctx.close();
      remettre({});
      const o2 = await ouvrir(b, vp, sombre); const pg2 = o2.pg; PGC = pg2;
      await garde('C', async () => {
        await pg2.goto(`http://localhost:${PORT}/?tab=plat_ebay&section=compte`, { waitUntil: 'domcontentloaded' });
        await pg2.waitForSelector('[data-ebay-compte-ligne="principal"]', { timeout: 25000 });
        const bientot = await pg2.$('[data-ebay-compte-ligne="principal"] [data-ebay-jeton="bientot"]');
        const t = bientot ? await bientot.innerText() : '';
        dit(!!bientot && /expire dans 18 jours/.test(t) && !!(await pg2.$('[data-ebay-compte-ligne="principal"] [data-ebay-reconnecter]')), 'C. le jeton du compte pro expire dans 18 j : dit AVANT, avec « Reconnecter »', t);
        dit(!!(await pg2.$('[data-ebay-compte-ligne="bbbbbbbbbbbbbbbb"] [data-ebay-jeton="ok"]')), '   l’autre compte dit sa date (pas d’alerte)');
        await pg2.click('[data-ebay-defauts-ouvrir]');
        await pg2.waitForSelector('[data-ebay-parametres="defauts"] [data-ebay-politiques="oui"]', { timeout: 10000 });
        const opts = await pg2.$$eval('[data-ebay-pol] option', (l) => l.map((o) => o.value));
        dit(opts.includes('6200000001') && opts.includes('6200000002') && !opts.includes('6200000009') && !(await pg2.$('[data-ebay-pol="expedition"]')), '   la feuille propose les politiques de paiement et de retour, JAMAIS d’expédition (§2.8)', opts.join(','));
        dit(!!(await pg2.$('[data-ebay-param="livraison"][data-ebay-livraison="geree"]')), '   « Livraison : gérée par eBay », sans port ni transporteur');
        await capt(pg2, `C-feuille-${tag}`);
        await pg2.click('[data-ebay-parametres="defauts"] [data-ebay-format] [data-ebay-choix="enchere"]');
        await pg2.selectOption('[data-ebay-parametres="defauts"] [data-ebay-delai]', '1');
        await pg2.waitForFunction(() => { try { const v = JSON.parse(localStorage.getItem('vrm_ebay_publication_defaut') || 'null'); return v && v.delaiEnvoi === 1; } catch (_) { return false; } }, null, { timeout: 5000 }).catch(() => {});
        const ranges = await pg2.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_ebay_publication_defaut') || 'null'); } catch (_) { return null; } });
        dit(ranges && ranges.format === 'enchere' && ranges.delaiEnvoi === 1, '   enchères + délai 1 j rangés comme défauts (synchronisés)', JSON.stringify(ranges));
        if (mobile) {
          const larg = await pg2.evaluate(() => { const f = document.querySelector('[data-ebay-parametres]'); return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, fw: f ? f.scrollWidth - f.clientWidth : -1 }; });
          dit(larg.sw <= larg.cw + 1 && larg.fw <= 1, 'I. 390 px : la feuille ne déborde pas', JSON.stringify(larg));
          const petites = await pg2.$$eval('[data-ebay-parametres] button', (l) => l.filter((x) => x.getClientRects().length).map((x) => { const r = x.getBoundingClientRect(); return [x.innerText.trim().slice(0, 14) || x.getAttribute('aria-label'), Math.round(r.height)]; }).filter(([, h]) => h < 44));
          dit(petites.length === 0, '   cibles de la feuille ≥ 44 px', JSON.stringify(petites));
        }
        await pg2.click('[data-ebay-param-fini]');
        await pg2.waitForTimeout(400);
        const res = await pg2.$eval('[data-ebay-defauts-resume]', (e) => e.innerText);
        dit(/Enchères 7 j/.test(res) && /Envoi sous 1 j/.test(res), '   le résumé suit (« Enchères 7 j · Envoi sous 1 j »)', res);
        await capt(pg2, `C-${tag}`);
        await pg2.evaluate(() => { try { localStorage.removeItem('vrm_ebay_publication_defaut'); } catch (_) {} });
      });
      await garde('D', async () => {
        envois = [];
        await ouvrirVendre(pg2);
        await pg2.click('[data-publier-un-clic="31"]');
        await pg2.waitForSelector('[data-ebay-guide="premiere"]', { timeout: 10000 });
        dit((await pg2.$$eval('[data-ebay-guide="premiere"] [data-ebay-guide-etapes] li', (l) => l.length)) === 3, 'D. 1re publication : la fenêtre « Ta première annonce eBay » (3 étapes)');
        await capt(pg2, `D-guide-${tag}`);
        await pg2.click('[data-ebay-guide-continuer]');
        await pg2.waitForSelector('[data-ebay-questions][data-ebay-question="caracteristique"]', { timeout: 15000 });
        const vals = await pg2.$$eval('[data-ebay-q-valeur]', (l) => l.map((x) => x.getAttribute('data-ebay-q-valeur')));
        const t = await pg2.$eval('[data-ebay-questions]', (e) => e.innerText);
        dit(/Couleur/.test(t) && vals.join() === 'Noir,Blanc,Bleu', '   Couleur (obligatoire, inconnue de Vinted) est DEMANDÉE avec les valeurs d’eBay', vals.join());
        dit(action('pubverify').length === 0 && action('publish').length === 0, '   rien n’est vérifié ni publié avant la réponse');
        await capt(pg2, `D-question-${tag}`);
        await pg2.click('[data-ebay-q-valeur="Noir"]');
        await ok(pg2);
        await pg2.waitForTimeout(1500);
        const p = action('publish')[0];
        dit(!!p && p.item.aspects.Couleur === 'Noir' && p.item.aspects.Marque === 'Nike', '   la réponse part dans l’annonce (Couleur : Noir)', p ? JSON.stringify(p.item.aspects) : 'aucun publish');
        dit(!!p && !('parametres' in p.item) && p.item.ebayGere === true, '   sans réglage, l’annonce ne porte PAS `parametres` (comme avant), livraison gérée par eBay', p ? Object.keys(p.item).join(',') : '');
        const vu = await pg2.evaluate(() => localStorage.getItem('vrm_ebay_guide_vu'));
        dit(vu === 'true', '   la fenêtre de 1re publication ne revient pas (rangée)', vu);
      });
      await garde('E', async () => {
        envois = [];
        await ouvrirVendre(pg2);
        await pg2.click('[data-choix-paire="32"]');
        await pg2.waitForSelector('[data-ebay-tous-reglages]', { timeout: 15000 });
        await pg2.click('[data-ebay-tous-reglages]');
        await pg2.waitForSelector('[data-ebay-parametres="annonce"]', { timeout: 10000 });
        await pg2.click('[data-ebay-param="offres"] [role="switch"]');
        await pg2.click('[data-ebay-param="retours.jours"] [data-ebay-choix="30"]');
        await pg2.click('[data-ebay-param="sponsorisee"] [role="switch"]');
        await pg2.fill('[data-ebay-sponsor-taux]', '6');
        const cout = await pg2.$eval('[data-ebay-sponsor-cout]', (e) => e.innerText);
        dit(/6 % du prix de vente, prélevé seulement si/.test(cout), 'E. sponsorisée (éteinte d’origine) : son coût est dit', cout);
        await capt(pg2, `E-feuille-${tag}`);
        await pg2.click('[data-ebay-param-fini]');
        await pg2.fill('input[placeholder="ex. Nike"]', 'Adidas').catch(() => {});
        const marque = await pg2.$$('input');
        for (const m of marque) { const ph = await m.getAttribute('placeholder'); if (ph === 'ex. Nike') await m.fill('Adidas'); }
        await pg2.click('[data-publier-ebay]'); await quandMeme(pg2);
        const conf = pg2.locator('div[style*="z-index"]').filter({ hasText: /Publier (cette annonce sur eBay|sur ton compte eBay)/ }).last();
        await conf.waitFor({ timeout: 8000 });
        const tc = await conf.innerText();
        dit(/Offres/.test(tc) && /Retours 30 j/.test(tc) && /6 % du prix de vente/.test(tc), '   la confirmation dit les réglages et le coût de la sponsorisée', tc.replace(/\s+/g, ' ').slice(0, 220));
        await capt(pg2, `E-confirmation-${tag}`);
        await ok(pg2);
        await pg2.waitForTimeout(1500);
        const p = action('publish')[0], pr = action('promouvoir')[0];
        dit(!!p && JSON.stringify(p.item.parametres) === JSON.stringify({ offres: true, retours: { acceptes: true, jours: 30, payePar: 'Buyer' } }), '   `parametres` = ce qui diffère d’avant, exactement', p ? JSON.stringify(p.item.parametres) : 'aucun publish');
        dit(!!pr && pr.taux === '6.0' && pr.listingId === '110000000031' && pr.confirme === true, '   puis `promouvoir` à 6.0 % sur l’annonce créée, confirmé', JSON.stringify(pr));
        await pg2.waitForSelector('[data-publie-sponsor]', { timeout: 5000 });
        await capt(pg2, `E-publiee-${tag}`);
      });
      await garde('F', async () => {
        envois = [];
        await ouvrirVendre(pg2);
        await pg2.click('[data-choix-paire="33"]');
        await pg2.waitForSelector('[data-ebay-questions][data-ebay-question="categorie"]', { timeout: 15000 });
        await pg2.fill('[data-ebay-q-cherche]', 'chaussures');
        await pg2.click('[data-ebay-q-chercher]');
        await pg2.waitForSelector('[data-ebay-q-categorie="15709"]', { timeout: 8000 });
        const q = action('parametres').find((e) => e.q);
        dit(!!q && q.q === 'chaussures', 'F. aucune catégorie proposée ⇒ « Quelle catégorie ? », recherche par SES mots', JSON.stringify(q));
        await capt(pg2, `F-${tag}`);
        await pg2.click('[data-ebay-q-categorie="15709"]');
        await pg2.waitForTimeout(1200);
        dit(action('pubinfo').some((e) => e.categoryId === '15709'), '   son choix ⇒ les caractéristiques de SA catégorie (pubinfo 15709)', JSON.stringify(action('pubinfo').map((e) => e.categoryId)));
      });
      await garde('G', async () => {
        SC.refusCarac = true; envois = [];
        await ouvrirVendre(pg2);
        await pg2.click('[data-choix-paire="32"]');
        await pg2.waitForSelector('[data-publier-ebay]', { timeout: 15000 });
        for (const m of await pg2.$$('input')) { const ph = await m.getAttribute('placeholder'); if (ph === 'ex. Nike') await m.fill('Adidas'); }
        await pg2.getByRole('button', { name: /Vérifier/ }).last().click();
        await pg2.waitForSelector('[data-ebay-erreur="caracteristique"]', { timeout: 8000 });
        const t = await pg2.$eval('[data-ebay-erreur]', (e) => e.innerText);
        dit(/Il manque une caractéristique « Brand »/.test(t) && /Choisis-la dans « Caractéristiques »/.test(t), 'G. refus d’eBay (21919303) : phrase traduite, la caractéristique nommée, le geste', t.replace(/\s+/g, ' '));
        await capt(pg2, `G-${tag}`);
        SC.refusCarac = false;
      });
      await garde('H', async () => {
        await pg2.goto(`http://localhost:${PORT}/?tab=plat_ebay&section=ventes`, { waitUntil: 'domcontentloaded' });
        await pg2.waitForSelector('[data-ebay-guide-bouton="vente"]', { timeout: 25000 });
        await pg2.click('[data-ebay-guide-bouton="vente"]');
        await pg2.waitForSelector('[data-ebay-guide="vente"]', { timeout: 8000 });
        const t = await pg2.$eval('[data-ebay-guide="vente"]', (e) => e.innerText);
        dit(/tu ne paies rien/.test(t) && /étiquette prépayée/.test(t) && !!(await pg2.$('[data-ebay-guide-lien="vente"]')), 'H. « Comment faire ? » ⇒ la fenêtre « vendue » : l’acheteur a payé le port, l’étiquette prépayée dans eBay', t.replace(/\s+/g, ' ').slice(0, 200));
        await capt(pg2, `H-${tag}`);
      });
      await garde('J', async () => {
        envois = [];
        await pg2.goto(`http://localhost:${PORT}/?tab=plat_ebay&section=promo`, { waitUntil: 'domcontentloaded' });
        await pg2.waitForSelector('[data-ebay-remises="1"]', { timeout: 25000 });
        const fin = await pg2.$eval('[data-ebay-remise="9001"]', (e) => e.innerText);
        dit(/fin le 20 novembre/.test(fin), 'J. remises en cours : la date de fin est dite', fin.replace(/\s+/g, ' '));
        await pg2.waitForSelector('[data-ebay-remise-annonce="110000000044"] input', { timeout: 10000 });
        await pg2.fill('[data-ebay-remise-pct]', '15');
        await pg2.check('[data-ebay-remise-annonce="110000000044"] input');
        const prix = await pg2.$eval('[data-ebay-remise-annonce="110000000044"] [data-ebay-remise-prix]', (e) => e.getAttribute('data-ebay-remise-prix'));
        dit(prix === '80.75', '   le prix après remise est dit (95 € − 15 % = 80,75 €)', prix);
        await capt(pg2, `J-${tag}`);
        await pg2.click('[data-ebay-remise-poser]');
        const conf = pg2.locator('div[style*="z-index"]').filter({ hasText: 'Poser cette remise sur eBay ?' }).last();
        await conf.waitFor({ timeout: 8000 });
        const tc = await conf.innerText();
        dit(/−15 % sur 1 annonce/.test(tc) && /s'arrête le/.test(tc) && /jamais de livraison gratuite/.test(tc), '   la confirmation dit la remise, la date de fin, et jamais de livraison gratuite (§2.8)', tc.replace(/\s+/g, ' ').slice(0, 220));
        dit(action('poserremise').length === 0, '   rien n’est posé avant « Oui »');
        await ok(pg2, /Oui, poser/);
        await pg2.waitForTimeout(800);
        const p = action('poserremise')[0];
        dit(!!p && p.confirme === true && p.type === 'periode' && p.remise === 15 && p.listingIds.join() === '110000000044' && Math.abs(Date.parse(p.fin) - MAINTENANT - 7 * JOUR) < 5 * 60000, '   `poserremise` : −15 %, SON annonce, fin dans 7 j, confirmé', JSON.stringify(p));
      });
      await garde('K', async () => {
        envois = [];
        await pg2.goto(`http://localhost:${PORT}/?tab=messages`, { waitUntil: 'domcontentloaded' });
        await pg2.waitForSelector('[data-fil-sites="ebay"]', { timeout: 25000 });
        dit(true, 'K. Messages · Tous : l’échange eBay est dans la liste unifiée');
        await pg2.click('[data-fil-sites="ebay"]');
        await pg2.waitForSelector('[data-fil-ebay="5550001"]', { timeout: 10000 });
        const q = await pg2.$eval('[data-fil-ebay-question]', (e) => e.innerText);
        dit(/taille grand/.test(q), '   le fil eBay montre la question', q);
        await pg2.fill('[data-fil-ebay-saisie]', 'Elle taille normalement.');
        await pg2.click('[data-fil-ebay-envoyer]');
        await ok(pg2, /Oui, envoyer/);
        await pg2.waitForTimeout(800);
        const r = action('repondre')[0];
        dit(!!r && r.confirme === true && r.messageId === '5550001' && r.itemId === '110000000044' && r.body === 'Elle taille normalement.', '   « Envoyer » sur SON clic confirmé : `repondre` sur CETTE question', JSON.stringify(r));
        await capt(pg2, `K-${tag}`);
      });
      await garde('L', async () => {
        await pg2.goto(`http://localhost:${PORT}/?tab=plat_ebay&section=ventes`, { waitUntil: 'domcontentloaded' });
        await pg2.waitForSelector('[data-ebay-vente="07-11111-22222"]', { timeout: 25000 });
        const t = await pg2.$eval('[data-ebay-vente="07-11111-22222"]', (e) => e.innerText);
        dit(/100,00/.test(t) && !/106,50/.test(t), 'L. Ventes eBay : la ligne dit l’argent REÇU (100,00 €), pas ce que l’acheteur a payé port compris (106,50 €)', t.replace(/\s+/g, ' ').slice(0, 160));
        await capt(pg2, `L-${tag}`);
        await pg2.goto(`http://localhost:${PORT}/?tab=plat_ebay&section=compte`, { waitUntil: 'domcontentloaded' });
        await pg2.waitForSelector('[data-ebay-argent-recu]', { state: 'attached', timeout: 25000 });
        const v = await pg2.$eval('[data-ebay-argent-recu]', (e) => e.getAttribute('data-ebay-argent-recu'));
        dit(v === '100.00', '   Comptes eBay → Argent : « reçu » = 100,00 (le port n’est pas une recette, §2.8)', v);
      });
      const tous = [...errs, ...o2.errs];
      dit(tous.length === 0, `aucune erreur de page (${tag})`, tous.join(' | '));
      await o2.ctx.close();
    }
  } catch (e) { dit(false, 'le banc a levé', String((e && e.stack) || e).slice(0, 300)); }
  finally { try { await b.close(); } catch (_) {} srv.close(); }
  console.log(`\n${okc} OK, ${ko} KO`);
  process.exit(ko ? 1 : 0);
})();
