// Banc : UNE PAIRE, UNE PROPOSITION — et des cartes lisibles (17 octobre).
//   BANC_PORT=7210 node scripts/bancs/cross-post.cjs
//
// Julien : « une paire est 2 fois proposée sur VRM, la 80 et la 81, et ça me
// propose de la publier sur eBay, je l'ai donc publiée deux fois » ; « sur eBay
// j'ai "Description" qui s'affiche dans la description » ; « j'aime pas le
// visuel quand j'ai les propositions des paires à publier ».
//
// Données INVENTÉES (il vit dans le dépôt, public). Deux annonces Vinted
// portent la MÊME photo (même fichier, autre taille, autre signature) sous deux
// N° (80 et 81) — l'identité de la paire est la photo exacte (§5), jamais le
// titre ; une troisième (82) a sa propre photo.
//   E1. eBay : la N°80 est déjà en vente (SKU VRM-80) ⇒ le sélecteur ne propose
//       PAS la N°81 (même paire), dit qu'une paire est masquée, et la N°80 dit
//       « déjà en vente sur eBay ».
//   E2. eBay : rien n'est en vente ⇒ une seule des deux est proposée (la plus
//       récente, N°81) ; la choisir remplit une description SANS le libellé
//       « Description » collé (la forme mesurée chez lui).
//   L.  Leboncoin : la file reste celle de l'extension (§11), mais la N°80 dit
//       « même photo que la N°81 » et n'a PAS de bouton Publier ; chaque paire
//       est une CARTE (photo, N°, prix) ; 390 px sans débordement ; sombre.
// On juge des attributs (`data-choix-paire`, `data-apub`, `data-apub-jumelle`,
// `data-bouton-publier`, `data-jumelles-masquees`), jamais une formulation.
const path = require('path'), fs = require('fs'), http = require('http');
const RACINE = path.join(__dirname, '..', '..');
const { projette } = require(path.join(RACINE, 'scripts/_fond-vm.cjs'));
const { metaVersData } = require('./_meta.cjs');
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const DIST = path.join(RACINE, 'dist');
const PORT = Number(process.env.BANC_PORT) || 7210;
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { dit(false, quoi, 'a levé : ' + String((e && e.message) || e).split('\n')[0].slice(0, 160)); return null; } };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGNk+M+ADzCOKgAAV7wDA8mm/lgAAAAASUVORK5CYII=', 'base64');
const auj = new Date().toISOString();
// La MÊME photo (même dossier, même fichier) vue à deux tailles, deux signatures.
const PHOTO_A1 = 'https://images1.vinted.net/t/03_01217_banctestjumelle/f800/6ef7066d.jpeg?s=aaaa';
const PHOTO_A2 = 'https://images2.vinted.net/t/03_01217_banctestjumelle/310x430/6ef7066d.webp?s=bbbb';
const PHOTO_B = 'https://images1.vinted.net/t/04_00999_bancautrepaire/f800/1234abcd.jpeg?s=cccc';
const NUMS = {
  '9100000001': { numero: '80', title: 'Autry reelwind gris taille 37', photo: PHOTO_A1, photoK: '03_01217_banctestjumelle/6ef7066d', mp: { lbc: true }, numberedAt: auj },
  '9100000002': { numero: '81', title: 'Autry reelwind gris taille 37', photo: PHOTO_A2, photoK: '03_01217_banctestjumelle/6ef7066d', mp: { lbc: true }, numberedAt: auj },
  '9100000003': { numero: '82', title: 'Nike Air Max 1 noir taille 44', photo: PHOTO_B, photoK: '04_00999_bancautrepaire/1234abcd', mp: { lbc: true }, numberedAt: auj },
};
const annonce = (id, titre, prix, photo) => ({ id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, nPhotos: 3, photo: { url: photo } });
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj }];
const lignes = ({ ebaySku80 = false, lbcPosee81 = false, sombre = false } = {}) => {
  const l = {
    main: { vinted_annonce_numeros: NUMS, vinted_accounts: [{ vinted_user_id: '111', login: 'compte_test' }], ...(sombre ? { vinted_dark: true } : {}) },
    harvest_111_listings: { uid: '111', capturedAt: auj, payload: { items: [annonce(9100000001, 'Autry reelwind gris taille 37', 84, PHOTO_A1), annonce(9100000002, 'Autry reelwind gris taille 37', 84, PHOTO_A2), annonce(9100000003, 'Nike Air Max 1 noir taille 44', 68, PHOTO_B)] } },
    harvest_111_orders_sold: { uid: '111', capturedAt: auj, payload: { my_orders: [] } },
    vinted_item_details: {
      '9100000002': { description: 'Descriptionautry reelwind gris \n\ntaille 37\n\ntrès bon état', photos: [PHOTO_A2, PHOTO_A2.replace('6ef7066d', '7aa1'), PHOTO_A2.replace('6ef7066d', '7bb2')] },
      '9100000001': { description: 'Descriptionautry reelwind gris \n\ntaille 37\n\ntrès bon état', photos: [PHOTO_A1] },
    },
  };
  if (ebaySku80) l.ebay_listings = { capturedAt: Date.now(), ack: 'Success', items: [{ itemId: '128100000080', sku: 'VRM-80', title: 'Autry reelwind gris taille 37', price: '84.0', qty: '1', fin: '' }] };
  else l.ebay_listings = { capturedAt: Date.now(), ack: 'Success', items: [] };
  if (lbcPosee81) l.vinted_lbc_posted = { ids: ['9100000002'] };
  return l;
};
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, res) => { let fi = q.url.split('?')[0]; if (fi === '/' || !path.extname(fi)) fi = '/index.html'; const p = path.join(DIST, fi); if (!fs.existsSync(p)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res); });
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });

async function page(b, l, vp, { sombre = false } = {}) {
  const rows = Object.entries(l).map(([id, data]) => ({ id, data }));
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(([nums, sombre]) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_annonce_numeros', JSON.stringify(nums)); localStorage.setItem('vinted_nums_physiques', JSON.stringify({ nums: ['80', '81', '82'], at: Date.now() })); if (sombre) { localStorage.setItem('vinted_dark', 'true'); localStorage.setItem('vrm_bascule_mineral_v1', '1'); } } catch (_) {} }, [NUMS, sombre]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => { const t = r.request().resourceType(); if (t === 'image') return r.fulfill({ status: 200, contentType: 'image/png', body: PNG }); if (t === 'media' || t === 'font') return r.abort(); return r.fulfill({ status: 200, contentType: 'text/plain', body: '' }); });
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (rw) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel) && sel !== 'data') ? projette(rw, sel) : ({ ...rw, updated_at: auj, cap: rw.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((x) => x.id === eq[1]).map(forme));
    const dans = /id=in\.\(([^)]*)\)/.exec(u);
    if (dans) { const ks = dans[1].split(','); return j(rows.filter((x) => ks.includes(x.id)).map(forme)); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((x) => re.test(x.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (rt) => rt.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"pret":true}' }));
  await pg.route('**/api/ebay**', (route) => { const req = route.request(); const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (req.method() !== 'POST') return j({ ready: true, canConsent: true });
    let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch (_) {}
    if (body.action === 'status') return j({ ok: true, connected: true });
    if (body.action === 'pubinfo') return j({ ok: true, categorie: { categoryId: '15709', suggeree: { categoryId: '15709', categoryName: 'Baskets' } }, categories: [{ categoryId: '15709', categoryName: 'Baskets' }], conditions: [{ id: '3000', label: "D'occasion" }], attributs: [], attributsObligatoires: [] });
    if (body.action === 'finances') return j({ ok: false, reason: 'scope', error: 'x' });
    return j({ ok: true }); });
  return { ctx, pg, errs };
}

async function selecteurEbay(b, l, vp) {
  const { ctx, pg, errs } = await page(b, l, vp);
  await pg.goto(`http://localhost:${PORT}/?tab=plat_ebay`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(2500);
  try { await pg.getByRole('button', { name: 'Annonces', exact: true }).first().click({ timeout: 5000 }); } catch (_) {}
  await pg.waitForTimeout(1500);
  const btn = await pg.$('text=Vendre une paire sur eBay'); if (btn) await btn.click();
  await pg.waitForFunction(() => document.querySelectorAll('[data-choix-paire]').length > 0, null, { timeout: 12000 }).catch(() => {});
  await pg.waitForTimeout(800);
  const v = await pg.evaluate(() => ({
    choix: [...document.querySelectorAll('[data-choix-paire]')].map((e) => e.getAttribute('data-choix-paire')).sort(),
    masquees: (document.querySelector('[data-jumelles-masquees]') || { getAttribute: () => null }).getAttribute('data-jumelles-masquees'),
    deja: [...document.querySelectorAll('[data-choix-paire]')].filter((e) => e.querySelector('[data-paire-deja-ebay]')).map((e) => e.getAttribute('data-choix-paire')),
  }));
  return { ctx, pg, errs, v };
}

(async () => {
  await new Promise((ok) => srv.listen(PORT, ok));
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    console.log('── E1. eBay : la N°80 est déjà en vente, la N°81 est la même paire (photo exacte)');
    await essaie('E1', async () => {
      const r = await selecteurEbay(b, lignes({ ebaySku80: true }), { width: 1512, height: 950 });
      dit(!r.v.choix.includes('81'), 'la N°81 (même photo que la N°80, déjà sur eBay) n\'est PAS proposée', JSON.stringify(r.v.choix));
      dit(r.v.choix.includes('80') && r.v.choix.includes('82'), 'la N°80 et l\'autre paire (N°82) restent dans la liste', JSON.stringify(r.v.choix));
      dit(r.v.deja.includes('80'), 'la N°80 dit « déjà en vente sur eBay »', JSON.stringify(r.v.deja));
      dit(r.v.masquees === '1', 'la liste DIT qu\'une paire porte deux N° (elle n\'est pas cachée en silence)', String(r.v.masquees));
      dit(r.errs.length === 0, 'aucune erreur de page', r.errs.join(' | ').slice(0, 140));
      await r.ctx.close();
    });
    console.log('── E2. eBay : rien en vente ⇒ une seule des deux, et une description sans « Description »');
    await essaie('E2', async () => {
      const r = await selecteurEbay(b, lignes(), { width: 390, height: 1400 });
      const jum = r.v.choix.filter((n) => n === '80' || n === '81');
      dit(jum.length === 1 && jum[0] === '81', 'une seule des deux est proposée : la plus récente (N°81)', JSON.stringify(r.v.choix));
      await r.pg.click('[data-choix-paire="81"]').catch(() => {});
      await r.pg.waitForTimeout(1200);
      const desc = await r.pg.evaluate(() => { const t = [...document.querySelectorAll('textarea')].find((e) => /particularités|authenticité/.test(e.getAttribute('placeholder') || '')); return t ? t.value : null; });
      dit(desc != null && /autry reelwind gris/i.test(desc), 'la description de la paire est reprise', JSON.stringify(desc && desc.slice(0, 40)));
      dit(desc != null && !/^\s*description/i.test(desc), 'le libellé « Description » collé devant le texte n\'y est plus', JSON.stringify(desc && desc.slice(0, 20)));
      dit(r.errs.length === 0, 'aucune erreur de page', r.errs.join(' | ').slice(0, 140));
      await r.ctx.close();
    });
    for (const [nom, opts] of [['L1 · 1512 px', { vp: { width: 1512, height: 950 } }], ['L2 · 390 px', { vp: { width: 390, height: 844 } }], ['L3 · 1512 px sombre', { vp: { width: 1512, height: 950 }, sombre: true }], ['L4 · la N°81 déjà sur Leboncoin', { vp: { width: 1512, height: 950 }, posee: true }]]) {
      console.log('── ' + nom + ' : Leboncoin → Annonces');
      await essaie(nom, async () => {
        const { ctx, pg, errs } = await page(b, lignes({ lbcPosee81: !!opts.posee, sombre: !!opts.sombre }), opts.vp, { sombre: !!opts.sombre });
        await pg.goto(`http://localhost:${PORT}/?tab=leboncoin`, { waitUntil: 'domcontentloaded' });
        await pg.waitForFunction(() => document.querySelectorAll('[data-apub]').length > 0, null, { timeout: 20000 }).catch(() => {});
        await pg.waitForTimeout(1500);
        const v = await pg.evaluate(() => {
          const cartes = [...document.querySelectorAll('[data-apub]')];
          const c80 = cartes.find((e) => e.getAttribute('data-apub') === '80');
          const c81 = cartes.find((e) => e.getAttribute('data-apub') === '81');
          const lum = (el) => { if (!el) return null; const m = getComputedStyle(el).backgroundColor.match(/[\d.]+/g); if (!m) return null; const [r, g, b] = m.map(Number); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
          return {
            apub: cartes.map((e) => e.getAttribute('data-apub')).sort(),
            j80: c80 && c80.getAttribute('data-apub-jumelle'), j81: c81 && c81.getAttribute('data-apub-jumelle'),
            pub80: !!(c80 && c80.querySelector('[data-bouton-publier]')), pub81: !!(c81 && c81.querySelector('[data-bouton-publier]')),
            texte80: c80 ? (c80.querySelector('[data-apub-jumelle-texte]') || {}).innerText || '' : '',
            photo80: !!(c80 && c80.querySelector('img, [data-photo-vinted]')),
            grille: !!document.querySelector('.vrm-apub-grille'),
            lumCarte: lum(c80 || cartes[0]),
            sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
          };
        });
        if (!opts.posee) {
          dit(v.apub.includes('80') && v.apub.includes('81') && v.apub.includes('82'), 'la file reste celle de l\'extension (les trois N°, §11)', JSON.stringify(v.apub));
          dit(v.j80 === '81' && !v.j81, 'la N°80 est marquée « même photo que la N°81 » (la N°81, plus récente, est la bonne)', `j80=${v.j80} j81=${v.j81}`);
          dit(!v.pub80 && v.pub81, 'la N°80 n\'a PAS de bouton Publier, la N°81 si', `pub80=${v.pub80} pub81=${v.pub81}`);
        } else {
          dit(!v.apub.includes('81'), 'la N°81, déjà sur Leboncoin, sort de la file', JSON.stringify(v.apub));
          dit(v.j80 === '81' && !v.pub80 && /déjà sur Leboncoin/.test(v.texte80), 'la N°80 dit que sa jumelle est DÉJÀ sur Leboncoin, sans bouton Publier', `j80=${v.j80} pub80=${v.pub80} « ${v.texte80.slice(0, 60)} »`);
        }
        dit(v.grille && v.photo80, 'chaque paire est une CARTE avec sa photo, dans une grille', `grille=${v.grille} photo=${v.photo80}`);
        if (opts.sombre) dit(v.lumCarte != null && v.lumCarte < 0.2, 'en sombre, la carte est sombre', String(v.lumCarte && v.lumCarte.toFixed(3)));
        dit(v.sw <= v.cw + 1, 'aucun débordement horizontal', `${v.sw} > ${v.cw}`);
        dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 140));
        if (process.env.BANC_CAPTURE) await pg.screenshot({ path: path.join(process.env.BANC_CAPTURE, `cross-post-${nom.split(' ')[0]}.png`), fullPage: false });
        await ctx.close();
      });
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu\'au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ cross-post : ${ko} rouge(s)` : '\n✅ cross-post : une paire, une proposition, et des cartes lisibles');
  process.exit(ko ? 1 : 0);
})();
