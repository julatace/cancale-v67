// Banc : eBay → « Vendre une paire sur eBay » — LA DESCRIPTION ET LE PRIX DE
// VINTED, ET CE QUI EST VRAIMENT EN LIGNE APRÈS LA PUBLICATION (15 octobre).
//        PORT=5991 node scripts/bancs/ebay-prep.cjs     (après `npm run build`)
//
// Julien : « quand je publie une annonce sur eBay, que ça prenne la description
// de Vinted et la copie sur eBay » ; « le même prix d'une plateforme à
// l'autre ». Prompt maître : sans écraser une personnalisation, aperçu et
// confirmation des différences ; après la publication, plateforme, compte,
// numéro d'annonce et résultat réel — « demandée » n'est pas « publiée ».
//
// Ce que le banc REND et JUGE (les `data-*`, le corps exact de ce qui part vers
// `/api/ebay`, jamais un libellé seul — §6.5), à 390 et 1512 px, clair et
// sombre :
//   1. choisir une paire pré-remplit le prix ET la description de Vinted ;
//   2. une autre paire : les valeurs posées par VRM SUIVENT ;
//   3. ce qu'il tape n'est JAMAIS écrasé, même en changeant de paire — l'écart
//      se montre (« Vinted : 49,00 € · ici : 70,00 € ») avec « Reprendre » ;
//   4. « Voir », « Reprendre celle de Vinted », « Annuler » sur la description ;
//   5. « Publier » avec des écarts : UNE confirmation qui les dit, « Annuler »
//      n'envoie rien ;
//   6. sans écart : aucune feuille de plus, et le corps part au prix de Vinted ;
//   7. relecture ratée ⇒ « Demandée à eBay — pas encore vérifiée » (jamais
//      « publiée »), « Relire chez eBay » ⇒ « Publiée et vérifiée » ;
//   8. un écart relu chez eBay se DIT, avec les deux valeurs ;
//   9. prix Vinted inconnu (autre devise) ⇒ champ vide, dit, et « Publier »
//      refuse (les champs obligatoires ne sont pas contournés) ; texte de
//      Vinted ⇒ jamais repris comme description ;
//  10. un brouillon rouvert garde SES valeurs, l'écart avec Vinted se voit.
// Données INVENTÉES : il vit dans le dépôt.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.PORT) || 5991;
const CAPTURES = process.env.CAPTURES || os.tmpdir();
const MAINTENANT = Date.parse('2026-10-15T09:00:00.000Z');

const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: new Date(MAINTENANT).toISOString() }];
const idDe = (n) => 7000 + n;
const DESC_41 = 'Très bon état, portées 3 fois. Boîte d\'origine.';
const DESC_42 = 'Salomon XT-6, semelle comme neuve.';
const PUB_VINTED = 'Pour chaque achat effectué, tu bénéficies de notre Politique de remboursement, de transactions sécurisées et d\'un service client.';
// [N°, titre, prix Vinted, devise]
const PAIRES = [[41, 'Nike Air Max 1 bleu taille 44', '49.0', 'EUR'], [42, 'Salomon XT-6 noir taille 41', '62.5', 'EUR'], [43, 'Adidas Samba blanc taille 40', '40.0', 'USD'], [44, 'Vans Old Skool noir taille 42', '30.0', 'EUR']];
const LISTINGS = { capturedAt: new Date(MAINTENANT).toISOString(), payload: { items: PAIRES.map(([n, t, p, d]) => ({ id: idDe(n), title: t, price: { amount: p, currency_code: d }, brand_title: t.split(' ')[0], is_closed: false, is_hidden: false, is_draft: false, nPhotos: 2, photo: { url: `https://img.test/v${idDe(n)}.jpg` } })) } };
const FICHES = Object.fromEntries(PAIRES.map(([n, t]) => [String(idDe(n)), { numero: String(n), title: t, photo: `https://img.test/v${idDe(n)}.jpg` }]));
const ph = (n) => [`https://img.test/v${idDe(n)}.jpg`, `https://img.test/v${idDe(n)}b.jpg`];
const DETAILS = { [idDe(41)]: { description: DESC_41, photos: ph(41) }, [idDe(42)]: { description: DESC_42, photos: ph(42) }, [idDe(43)]: { photos: ph(43) }, [idDe(44)]: { description: PUB_VINTED, photos: ph(44) } };
const BROUILLONS = () => ({ 'b-41': { id: 'b-41', creeLe: MAINTENANT - 60000, majLe: MAINTENANT - 60000, pairId: String(idDe(41)), numero: '41', titre: 'Nike Air Max 1 bleu taille 44', prix: '59', quantite: '1', etat: '3000', description: 'Mon texte de brouillon', photos: ph(41), categorie: { id: '15709', nom: 'Baskets', requis: ['Marque'] }, aspects: { Marque: 'Nike' }, etatBrouillon: 'brouillon' } });

let rows = [], envois = [], pubMode = 'demandee';
// `vinted_dark` est un réglage SYNCHRONISÉ : le nuage (`main`) le remplace au
// démarrage — servi là aussi ; et la bascule « Minéral » (une fois par
// appareil) le remet en clair si `vrm_bascule_mineral_v1` n'est pas posé.
const remettre = (sombre) => {
  rows = [
    { id: 'main', data: { vinted_annonce_numeros: FICHES, vinted_dark: !!sombre } },
    { id: 'harvest_111_listings', data: LISTINGS },
    { id: 'vinted_item_details', data: DETAILS },
    { id: 'ebay_listings', data: { items: [], capturedAt: MAINTENANT } },
    { id: 'ebay_orders', data: { orders: [], capturedAt: MAINTENANT } },
    { id: 'ebay_programmees', data: { items: [], enLigne: [], complet: true, capturedAt: MAINTENANT } },
    { id: 'ebay_brouillons', data: { items: BROUILLONS(), majAt: MAINTENANT } },
  ];
  envois = []; pubMode = 'demandee';
};

let ko = 0, okN = 0;
const dit = (c, m, d) => { if (c) okN++; else ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
// Un banc ne meurt pas, il rapporte : ce qui lève devient un contrôle ROUGE.
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { dit(false, quoi, 'a levé : ' + String((e && e.message) || e).split('\n')[0].slice(0, 160)); return null; } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
srv.listen(PORT);
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
// Ce que la VRAIE route rend après une publication (`api/ebay.js`, la forme de
// `verifPublication`) : relecture ratée · tout conforme · le prix diffère.
const pointsOk = (b) => [{ cle: 'annonce', etat: 'ok', vu: 'Active', attendu: 'Active' }, { cle: 'compte', etat: 'ok', vu: 'julien_part', attendu: 'julien_part' }, { cle: 'reference', etat: 'ok', vu: 'VRM-' + b.item.numero, attendu: 'VRM-' + b.item.numero }, { cle: 'prix', etat: 'ok', vu: Number(b.item.price), devise: 'EUR', attendu: Number(b.item.price) }, { cle: 'titre', etat: 'ok', vu: b.item.title, attendu: b.item.title }, { cle: 'quantite', etat: 'ok', vu: 1, attendu: 1 }, { cle: 'photos', etat: 'ok', vu: b.item.photos.length, attendu: b.item.photos.length }];
const verifDe = (b, mode) => {
  if (mode === 'demandee') return { lu: false, raison: 'lecture' };
  const pts = pointsOk(b);
  if (mode === 'ecarts') { const p = pts.find((x) => x.cle === 'prix'); p.etat = 'ecart'; p.vu = 50; }
  return { lu: true, itemId: '110000000555', verdict: mode === 'ecarts' ? 'ecarts' : 'verifiee', points: pts, vendeur: 'julien_part' };
};

async function ouvrir(b, vp, sombre) {
  const ctx = await b.newContext({ viewport: vp, locale: 'fr-FR', timezoneId: 'Europe/Paris', colorScheme: sombre ? 'dark' : 'light', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  // Un geste qui ne trouve pas sa cible ROUGIT au bout de 15 s — il n'attend
  // jamais pour toujours (Playwright n'a pas de limite par défaut).
  pg.setDefaultTimeout(15000);
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.setFixedTime(new Date(MAINTENANT));
  await pg.addInitScript(([fiches, sombre]) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_annonce_numeros', JSON.stringify(fiches)); localStorage.setItem('vinted_dark', sombre ? 'true' : 'false'); localStorage.setItem('vrm_bascule_mineral_v1', '1'); } catch (_) {} }, [FICHES, sombre]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') {
      try {
        for (const l of [].concat(JSON.parse(route.request().postData() || 'null') || [])) {
          if (!l || !l.id) continue;
          const i = rows.findIndex((r) => r.id === l.id);
          if (i >= 0) rows[i] = { id: l.id, data: l.data }; else rows.push({ id: l.id, data: l.data });
        }
      } catch (_) {}
      return j([]);
    }
    if (/select=owner/.test(u)) return j({ m: 1 }, 400);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: new Date(MAINTENANT).toISOString(), cap: r.data && r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  // ⚠️ enregistré APRÈS le fourre-tout → Playwright le prend en PREMIER (§6.6).
  await pg.route('**/api/ebay**', (route) => {
    const req = route.request();
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (req.method() !== 'POST') return j({ ok: true, ready: true, canConsent: true });
    let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch (_) {}
    envois.push(JSON.parse(JSON.stringify(body)));
    if (body.action === 'status') return j({ ok: true, connected: true });
    if (body.action === 'offreinfo') return j({ ok: true, eligibles: [], complet: true });
    if (body.action === 'finances') return j({ ok: false, reason: 'scope' });
    if (body.action === 'limites') return j({ ok: true, quantite: 10, montant: 500, devise: 'EUR', inscrit: true });
    if (body.action === 'programmees') return j({ ok: true, items: [], enLigne: [], complet: true, capturedAt: MAINTENANT });
    if (body.action === 'pubinfo') return j({ ok: true, categorie: { categoryId: '15709', suggeree: { categoryId: '15709', categoryName: 'Baskets' } }, categories: [{ categoryId: '15709', categoryName: 'Baskets' }], conditions: [{ id: '3000', label: "D'occasion" }], attributs: [{ nom: 'Marque', requis: true, mode: 'SELECTION_ONLY', valeurs: ['Nike', 'Adidas', 'Salomon', 'Vans'] }], attributsObligatoires: ['Marque'] });
    if (body.action === 'pubverify') return j({ ok: true, fees: 0, frais: { total: 0, insertion: 0, programmation: null, remises: null, devise: 'EUR', lignes: [] } });
    if (body.action === 'publish') return j({ ok: true, plateforme: 'ebay', itemId: '110000000555', url: 'https://www.ebay.fr/itm/110000000555', sku: 'VRM-' + body.item.numero, compte: 'julien_part', avertissements: [], verification: verifDe(body, pubMode) });
    if (body.action === 'relirepub') return j({ ok: true, plateforme: 'ebay', itemId: body.itemId, compte: 'julien_part', verification: verifDe({ item: { numero: '41', price: String((body.attendu || {}).prix), title: (body.attendu || {}).titre || '', photos: new Array((body.attendu || {}).photos || 0).fill('') } }, 'verifiee') });
    return j({ ok: true });
  });
  return { ctx, pg, errs };
}
const feuille = (pg) => pg.locator('div[style*="z-index: 2000"]');
const valPrix = (pg) => pg.$eval('input[placeholder="ex. 74"]', (e) => e.value).catch(() => null);
const valDesc = (pg) => pg.$eval('main textarea', (e) => e.value).catch(() => null);
const attr = (pg, sel, a) => pg.$eval(sel, (e, a) => e.getAttribute(a), a).catch(() => null);
const deborde = (pg) => pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
// La garde « je vérifie encore que la paire n'est pas vendue » grise « Publier »
// le temps que les ventes soient lues : on l'attend, comme ebay-programmer.
const publierClic = async (pg) => {
  await pg.waitForFunction(() => !document.querySelector('[data-publier-garde="en-cours"]'), null, { timeout: 10000 }).catch(() => {});
  await pg.locator('button:has-text("Publier sur eBay")').click({ timeout: 5000 });
};
const choisir = async (pg, n) => {
  const changer = pg.getByRole('button', { name: 'Changer', exact: true });
  if (await changer.count()) await changer.first().click();
  await pg.locator('button', { hasText: 'N°' + n }).first().click({ timeout: 8000 });
  await pg.getByRole('button', { name: 'Trouver la catégorie eBay' }).click({ timeout: 5000 });
  await pg.waitForSelector('text=Catégorie eBay', { timeout: 8000 });
  await pg.waitForTimeout(200);
};
const photo = async (pg, sel, nom) => {
  try {
    await pg.locator(sel).first().evaluate((e) => e.scrollIntoView({ block: 'center' }));
    await pg.waitForTimeout(250);
    await pg.screenshot({ path: path.join(CAPTURES, nom + '.png') });
  } catch (_) {}
};
const sansCasse = (pg, T) => pg.evaluate(() => !/n'a pas pu s'afficher|Cannot access|is not defined/.test(document.body.innerText)).then((v) => dit(v, `${T} aucun écran tombé sur le garde-fou`));

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const COMBOS = [[{ width: 390, height: 844 }, false], [{ width: 1512, height: 950 }, true], [{ width: 390, height: 844 }, true], [{ width: 1512, height: 950 }, false]];
    // `COMBO=0` : une seule taille (mise au point) ; par défaut, les quatre.
    for (const [vp, sombre] of (process.env.COMBO != null ? [COMBOS[Number(process.env.COMBO)]] : COMBOS)) {
      const T = `[${vp.width}${sombre ? ' sombre' : ' clair'}]`;
      const tag = `ebay-prep-${vp.width}-${sombre ? 'sombre' : 'clair'}`;
      console.log(`── ${T}`);
      remettre(sombre);
      const { ctx, pg, errs } = await ouvrir(b, vp, sombre);
      await essaie(`${T} écran`, async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=plat_ebay`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(1500);
        await pg.getByRole('button', { name: 'Annonces', exact: true }).first().click({ timeout: 8000 });
        await pg.waitForSelector('[data-ebay-brouillons="lu"]', { timeout: 15000 });
        await pg.click('[data-poster="ebay"]');
      });
      // ── 1. REPRIS DE VINTED ─────────────────────────────────────────────────
      await essaie(`${T} 1. prix et description de Vinted`, async () => {
        await choisir(pg, 41);
        const p = await valPrix(pg), d = await valDesc(pg);
        dit(p === '49' && d === DESC_41, `${T} 1. la N°41 : prix « 49 » et SA description Vinted, sans rien taper`, `prix=${p} · desc=${(d || '').slice(0, 30)}`);
        dit(await attr(pg, '[data-ebay-prix-vinted]', 'data-ebay-prix-vinted') === 'repris' && await attr(pg, '[data-ebay-desc-vinted]', 'data-ebay-desc-vinted') === 'reprise',
          `${T} 1. l'écran le dit : « Même prix que sur Vinted », « Description de ton annonce Vinted »`);
        await photo(pg, '[data-ebay-prix-vinted]', `${tag}-1-repris`);
      });
      // ── 2. UNE AUTRE PAIRE : LES VALEURS DE VRM SUIVENT ─────────────────────
      await essaie(`${T} 2. autre paire`, async () => {
        await choisir(pg, 42);
        const p = await valPrix(pg), d = await valDesc(pg);
        dit(p === '62,50' && d === DESC_42, `${T} 2. la N°42 : les valeurs posées par VRM suivent (62,50 · sa description)`, `prix=${p} · desc=${(d || '').slice(0, 30)}`);
      });
      // ── 3. SA SAISIE N'EST JAMAIS ÉCRASÉE ───────────────────────────────────
      await essaie(`${T} 3. personnalisation gardée`, async () => {
        await pg.fill('input[placeholder="ex. 74"]', '70');
        await pg.fill('main textarea', 'Ma description perso');
        await pg.waitForTimeout(200);
        const ecart = await pg.$eval('[data-ebay-prix-vinted="ecart"]', (e) => e.innerText).catch(() => '');
        dit(/62,50\s*€/.test(ecart) && /70,00\s*€/.test(ecart) && /Reprendre/.test(ecart), `${T} 3. l'écart se dit : « Vinted : 62,50 € · ici : 70,00 € » + « Reprendre »`, ecart.replace(/\s+/g, ' '));
        await choisir(pg, 41);
        const p = await valPrix(pg), d = await valDesc(pg);
        dit(p === '70' && d === 'Ma description perso', `${T} 3. une autre paire choisie : CE QU'IL A TAPÉ reste (70 · « Ma description perso ») — jamais écrasé`, `prix=${p} · desc=${d}`);
        const e2 = await pg.$eval('[data-ebay-prix-vinted="ecart"]', (e) => e.innerText).catch(() => '');
        dit(/49,00\s*€/.test(e2) && await attr(pg, '[data-ebay-desc-vinted]', 'data-ebay-desc-vinted') === 'ecart', `${T} 3. et l'écart montre la NOUVELLE paire (Vinted : 49,00 €), description « pas celle de Vinted »`, e2.replace(/\s+/g, ' '));
        const n49 = await pg.evaluate(() => (document.querySelector('main').innerText.match(/Vinted : 49,00/g) || []).length);
        dit(n49 === 1, `${T} 3. §7 : l'écart de prix est dit UNE fois`, `×${n49}`);
        await photo(pg, '[data-ebay-prix-vinted]', `${tag}-3-ecart-prix`);
      });
      // ── 4. VOIR · REPRENDRE · ANNULER ───────────────────────────────────────
      await essaie(`${T} 4. description : voir, reprendre, annuler`, async () => {
        await pg.click('[data-ebay-desc-voir]');
        const t = await pg.$eval('[data-ebay-desc-vinted-texte]', (e) => e.innerText).catch(() => '');
        dit(t === DESC_41, `${T} 4. « Voir » montre la description Vinted, sans rien remplacer`, t.slice(0, 40));
        await photo(pg, '[data-ebay-desc-vinted]', `${tag}-4-voir`);
        await pg.click('[data-ebay-desc-reprendre]');
        const d1 = await valDesc(pg);
        await pg.click('[data-ebay-desc-annuler]');
        const d2 = await valDesc(pg);
        dit(d1 === DESC_41 && d2 === 'Ma description perso', `${T} 4. « Reprendre celle de Vinted » la pose ; « Annuler » rend la sienne`, `${(d1 || '').slice(0, 20)} → ${d2}`);
      });
      // ── 5. PUBLIER AVEC DES ÉCARTS : UNE CONFIRMATION ───────────────────────
      await essaie(`${T} 5. confirmation des écarts`, async () => {
        const n0 = envois.filter((x) => x.action === 'publish').length;
        await publierClic(pg);
        await feuille(pg).getByRole('button', { name: 'Oui, publier' }).waitFor({ timeout: 5000 });
        const t = await feuille(pg).innerText();
        await photo(pg, 'div[style*="z-index: 2000"]', `${tag}-5-confirmation`);
        await feuille(pg).getByRole('button', { name: 'Annuler' }).click();
        await pg.waitForTimeout(300);
        dit(/70,00\s*€ sur eBay, 49,00\s*€ sur Vinted/.test(t) && /Description : pas celle de ton annonce Vinted/.test(t), `${T} 5. la feuille dit les deux écarts (prix et description)`, t.replace(/\s+/g, ' ').slice(0, 160));
        dit(envois.filter((x) => x.action === 'publish').length === n0, `${T} 5. « Annuler » : AUCUN \`publish\` envoyé`);
      });
      // ── 6+7. SANS ÉCART : AUCUNE FEUILLE ; « DEMANDÉE » PUIS « RELIRE » ─────
      await essaie(`${T} 6. publier au prix de Vinted`, async () => {
        await pg.click('[data-ebay-prix-reprendre]');
        await pg.click('[data-ebay-desc-reprendre]');
        await pg.waitForTimeout(200);
        dit(await valPrix(pg) === '49' && await attr(pg, '[data-ebay-prix-vinted]', 'data-ebay-prix-vinted') === 'repris', `${T} 6. « Reprendre 49,00 € » remet le prix de Vinted`);
        pubMode = 'demandee';
        await publierClic(pg);
        await pg.waitForSelector('[data-publie-etat]', { timeout: 8000 });
        const p = envois.filter((x) => x.action === 'publish').pop();
        dit(!!p && p.item.price === '49' && p.item.description === DESC_41 && String(p.item.numero) === '41', `${T} 6. sans écart, aucune feuille de plus : part au prix (49) et avec la description de Vinted`, p ? `${p.item.price} · ${(p.item.description || '').slice(0, 20)}` : 'rien');
        const etat = await attr(pg, '[data-publie-etat]', 'data-publie-etat');
        const quoi = await pg.$eval('[data-publie-plateforme]', (e) => [e.getAttribute('data-publie-plateforme'), e.getAttribute('data-publie-compte'), e.getAttribute('data-publie-itemid'), e.innerText]).catch(() => []);
        const texte = await pg.$eval('[data-publie-etat]', (e) => e.innerText).catch(() => '');
        dit(etat === 'demandee' && !/Publiée et vérifiée|Annonce publiée/.test(texte), `${T} 7. relecture ratée ⇒ « demandée, pas encore vérifiée » — jamais « publiée »`, `${etat} · ${texte.split('\n')[1] || ''}`);
        dit(quoi[0] === 'ebay' && quoi[1] === 'julien_part' && quoi[2] === '110000000555' && /eBay/.test(quoi[3] || '') && /julien_part/.test(quoi[3] || '') && /110000000555/.test(quoi[3] || ''),
          `${T} 7. plateforme, compte et numéro d'annonce dits`, quoi[3]);
        await photo(pg, '[data-publie-etat]', `${tag}-7-demandee`);
        await pg.click('[data-publie-relire]');
        await pg.waitForFunction(() => { const e = document.querySelector('[data-publie-etat]'); return e && e.getAttribute('data-publie-etat') === 'verifiee'; }, null, { timeout: 8000 });
        const r = envois.filter((x) => x.action === 'relirepub').pop();
        const relu = await attr(pg, '[data-publie-relu]', 'data-publie-relu');
        dit(!!r && r.itemId === '110000000555' && r.attendu && r.attendu.prix === 49 && r.attendu.sku === 'VRM-41', `${T} 7. « Relire chez eBay » : une relecture de CE numéro, avec ce qui est parti (49 €, VRM-41)`, r ? JSON.stringify(r.attendu) : 'rien');
        dit(/annonce/.test(relu || '') && /prix/.test(relu || '') && !(await pg.$('[data-publie-relire]')), `${T} 7. relue ⇒ « Publiée et vérifiée », les points relus dits, plus de bouton « Relire »`, relu);
        await photo(pg, '[data-publie-etat]', `${tag}-7-verifiee`);
        await pg.getByRole('button', { name: 'Terminé', exact: true }).click();
      });
      // ── 8. UN ÉCART RELU CHEZ eBAY ──────────────────────────────────────────
      await essaie(`${T} 8. écart relu`, async () => {
        await pg.click('[data-poster="ebay"]');
        await choisir(pg, 41);
        pubMode = 'ecarts';
        await publierClic(pg);
        await pg.waitForSelector('[data-publie-etat]', { timeout: 8000 });
        const etat = await attr(pg, '[data-publie-etat]', 'data-publie-etat');
        const ec = await pg.$eval('[data-publie-ecart="prix"]', (e) => e.innerText).catch(() => '');
        dit(etat === 'ecarts' && /^Prix chez eBay/.test(ec) && /50,00\s*€/.test(ec) && /49,00\s*€/.test(ec), `${T} 8. eBay montre un autre prix ⇒ « à vérifier », les deux valeurs dites`, `${etat} · ${ec}`);
        await photo(pg, '[data-publie-etat]', `${tag}-8-ecarts`);
        await pg.getByRole('button', { name: 'Terminé', exact: true }).click();
      });
      // ── 9. PRIX INCONNU, TEXTE DE VINTED ────────────────────────────────────
      await essaie(`${T} 9. prix inconnu`, async () => {
        await pg.click('[data-poster="ebay"]');
        await choisir(pg, 43);
        const p = await valPrix(pg);
        dit(p === '' && await attr(pg, '[data-ebay-prix-vinted]', 'data-ebay-prix-vinted') === 'inconnu' && await attr(pg, '[data-ebay-desc-vinted]', 'data-ebay-desc-vinted') === 'absente',
          `${T} 9. prix Vinted en dollars ⇒ inconnu : champ VIDE et dit ; aucune description captée ⇒ dit`, `prix=« ${p} »`);
        const n0 = envois.filter((x) => x.action === 'publish').length;
        await publierClic(pg);
        await pg.waitForTimeout(400);
        dit(envois.filter((x) => x.action === 'publish').length === n0 && /Mets un prix/.test(await pg.evaluate(() => document.body.innerText)), `${T} 9. sans prix, « Publier » refuse (« Mets un prix. ») — rien ne part`);
        await choisir(pg, 44);
        dit(await valPrix(pg) === '30' && await valDesc(pg) === '' && await attr(pg, '[data-ebay-desc-vinted]', 'data-ebay-desc-vinted') === 'absente', `${T} 9. la N°44 : 30 €, et le texte de Vinted (protection acheteur) n'est PAS repris comme description`);
      });
      // ── 10. UN BROUILLON ROUVERT GARDE SES VALEURS ──────────────────────────
      // On repart d'un écran NEUF (aucune paire choisie) : rouvrir le brouillon
      // CHANGE alors la paire du formulaire, et la règle de reprise est bien
      // appelée sur ses valeurs — sinon le contrôle dépendrait de l'étape d'avant.
      await essaie(`${T} 10. brouillon`, async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=plat_ebay`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(1500);
        await pg.getByRole('button', { name: 'Annonces', exact: true }).first().click({ timeout: 8000 });
        await pg.waitForSelector('[data-ebay-brouillons="lu"]', { timeout: 15000 });
        await pg.click('[data-brouillon-modifier="b-41"]');
        await pg.waitForFunction(() => { const e = document.querySelector('[data-publier-brouillon-id]'); return e && e.getAttribute('data-publier-brouillon-id') === 'b-41'; }, null, { timeout: 8000 });
        await pg.waitForSelector('[data-ebay-prix-vinted]', { timeout: 8000 });
        const p = await valPrix(pg), d = await valDesc(pg);
        const e = await pg.$eval('[data-ebay-prix-vinted="ecart"]', (x) => x.innerText).catch(() => '');
        dit(p === '59' && d === 'Mon texte de brouillon' && /49,00\s*€/.test(e) && /59,00\s*€/.test(e), `${T} 10. le brouillon garde SON prix (59) et SON texte ; l'écart avec Vinted (49 €) se voit`, `prix=${p} · ${e.replace(/\s+/g, ' ')}`);
        await photo(pg, '[data-ebay-prix-vinted]', `${tag}-10-brouillon`);
      });
      await essaie(`${T} rendu`, async () => {
        const fond = await pg.evaluate(() => { const m = /rgba?\((\d+), (\d+), (\d+)/.exec(getComputedStyle(document.body).backgroundColor) || [0, 255, 255, 255]; return (Number(m[1]) + Number(m[2]) + Number(m[3])) / 3; });
        dit(sombre ? fond < 80 : fond > 170, `${T} le thème demandé est bien celui rendu (fond ${Math.round(fond)})`);
        const db = await deborde(pg);
        dit(db.sw <= db.cw + 1, `${T} aucun débordement horizontal`, `${db.sw}/${db.cw}`);
        await sansCasse(pg, T);
        dit(errs.length === 0, `${T} aucune erreur d'app`, errs.slice(0, 1).join(''));
      });
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a levé', String((e && e.message) || e).split('\n')[0]); }
  finally { try { await b.close(); } catch (_) {} srv.close(); }
  console.log(`\n${okN} OK · ${ko} KO`);
  process.exit(ko ? 1 : 0);
})();
