// Banc : eBay, 5 novembre — L'AGENT EST ARRÊTÉ, et LA MISE EN LIGNE PREND DES
// PHOTOS DU TÉLÉPHONE. Rendu réel (dist/), données INVENTÉES (le dépôt est
// public : aucune fixture réelle). Port BANC_PORT (7931 par défaut).
//   node scripts/bancs/ebay-photos-agent-arret.cjs
//
// Julien (demandes du 5 nov.) : « le bot eBay, arrête-le, c'est nul » ;
// « améliorer l'interface et la mise en ligne ; prendre en photo l'article ou
// l'importer depuis la galerie ».
//
// Les données sont celles où l'ANCIEN agent proposait trois paires (31, 35, 36)
// et où un résumé « 3 prêtes » de plus de 20 h attendait dans le nuage (l'agent
// en fond le refaisait, Ma journée le montrait). On exige :
//   A. eBay → À traiter : la liste des tâches est là, la section « Agent eBay »
//      n'y est plus ; rien ne part préparer de paire chez eBay (aucun pubinfo,
//      pubverify, publish) ; le résumé de l'agent n'est pas réécrit ;
//   B. Ma journée ne dit plus « … pour eBay » ;
//   C. Vendre sur eBay → bloc « Photos » : un champ appareil
//      (accept=image/*, capture=environment) et un champ galerie (multiple) ;
//      deux photos de la galerie partent UNE PAR UNE vers `photo` en JPEG,
//      reviennent en adresses i.ebayimg.com et rejoignent la liste ; ‹ ›
//      change l'ordre (la 1re = couverture) ; × retire ;
//   D. une photo d'appareil refusée par eBay : vignette « Pas envoyée », la
//      raison dite, la publication ATTEND (bouton grisé, garde nommée) ;
//      « Réessayer » la fait partir ;
//   E. « Publier » envoie les photos DANS L'ORDRE CHOISI, ajoutées comprises ;
//   F. 390 px : aucun débordement horizontal, cibles du bloc ≥ 44 px ; aucune
//      erreur de page.
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 7931;
const MAINTENANT = Date.parse('2026-11-05T08:00:00.000Z');
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: new Date(MAINTENANT).toISOString() }];
const PAIRES = [
  [31, 'Nike Dunk Low panda taille 42', 'Nike', '42', 95], [32, 'Adidas Gazelle bleu taille 40', 'Adidas', '40', 80], [33, 'Salomon XT-6 noir taille 41', 'Salomon', '41', 120],
  [34, 'New Balance 550 blanc taille 43', 'New Balance', '43', 90], [35, 'Asics Gel 1130 argent taille 39', 'Asics', '39', 70], [36, 'Puma Suede rouge taille 44', 'Puma', '44', 60],
];
const idDe = (n) => 7000 + n;
const LISTINGS = { capturedAt: new Date(MAINTENANT).toISOString(), payload: { items: PAIRES.map(([n, t, m, tl, p]) => ({ id: idDe(n), title: t, brand: m, size: tl, status: 'Très bon état', price: { amount: String(p), currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, nPhotos: 2, photos: [{ url: `https://img.test/v${idDe(n)}.jpg` }] })) } };
const FICHES = Object.fromEntries(PAIRES.map(([n, t]) => [String(idDe(n)), { numero: String(n), title: t, photo: `https://img.test/v${idDe(n)}.jpg`, ...(n === 34 ? { buyPrice: '100' } : {}) }]));
const DETAILS = Object.fromEntries(PAIRES.map(([n]) => [String(idDe(n)), { photos: [`https://img.test/v${idDe(n)}.jpg`, `https://img.test/v${idDe(n)}b.jpg`] }]));
// Le résumé que l'ANCIEN agent avait publié : 3 prêtes, 30 h (le fond le refaisait
// au-delà de 20 h ; Ma journée le montrait jusqu'à 48 h).
const RESUME = { v: 1, n: 3, pretes: 3, at: MAINTENANT - 30 * 3600000 };
const REGLES = { v: 1, actif: true };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGNk+M+ADzCOKgAAV7wDA8mm/lgAAAAASUVORK5CYII=', 'base64');

let rows = [], envois = [], ecritures = [], SC = {};
const remettre = (sc = {}) => {
  SC = sc;
  rows = [
    { id: 'main', data: { vinted_annonce_numeros: FICHES, vrm_agent_ebay_resume: RESUME, vrm_agent_ebay_regles: REGLES } },
    { id: 'harvest_111_listings', data: LISTINGS },
    { id: 'vinted_item_details', data: DETAILS },
    { id: 'ebay_listings', data: { items: [{ itemId: '110000000033', title: 'Salomon XT-6 noir taille 41', price: '120.0', sku: 'VRM-33' }], capturedAt: MAINTENANT } },
    { id: 'ebay_orders', data: { orders: [{ orderId: '07-032', orderPaymentStatus: 'PAID', orderFulfillmentStatus: 'FULFILLED', lineItems: [{ sku: 'VRM-32', title: 'Adidas Gazelle' }] }], capturedAt: MAINTENANT } },
  ];
  envois = []; ecritures = [];
};
let ko = 0, okc = 0;
const dit = (c, m, d) => { if (c) okc++; else ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { dit(false, quoi, 'a levé : ' + String((e && e.message) || e).split('\n')[0].slice(0, 160)); return null; } };
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
let nPhoto = 0;
async function ouvrir(b, vp, sombre) {
  const ctx = await b.newContext({ viewport: vp, locale: 'fr-FR', timezoneId: 'Europe/Paris', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.setFixedTime(new Date(MAINTENANT));
  await pg.addInitScript(([fiches, resume, regles, sombre]) => { try {
    localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_annonce_numeros', JSON.stringify(fiches));
    localStorage.setItem('vrm_agent_ebay_resume', JSON.stringify(resume)); localStorage.setItem('vrm_agent_ebay_regles', JSON.stringify(regles));
    if (sombre) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, [FICHES, RESUME, REGLES, !!sombre]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image'].includes(r.request().resourceType()) ? r.fulfill({ status: 200, contentType: 'image/png', body: PNG }) : ['media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') {
      try {
        for (const l of [].concat(JSON.parse(route.request().postData() || 'null') || [])) {
          if (!l || !l.id) continue;
          ecritures.push(JSON.parse(JSON.stringify(l)));
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
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(rows.filter((r) => ids.includes(r.id)).map(forme)); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  // Le faux eBay (enregistré APRÈS le fourre-tout : Playwright le prend en premier, §6.6).
  await pg.route('**/api/ebay**', async (route) => {
    const req = route.request();
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (req.method() !== 'POST') return j({ ok: true, ready: true, canConsent: true });
    let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch (_) {}
    envois.push({ ...JSON.parse(JSON.stringify(body)), image: body.image ? String(body.image).slice(0, 8) + '…' + String(body.image).length : undefined, t: Date.now() });
    if (body.action === 'status') return j({ ok: true, connected: true, comptes: [{ cle: '', pseudo: 'vendeur_test', principal: true, relie: true }] });
    if (body.action === 'agent') return j({ ok: true, tasks: [], sources: [{ nom: 'Commandes', ok: true, partiel: true }], journal: [], journalLisible: true });
    if (body.action === 'photo') {
      await new Promise((r) => setTimeout(r, 150));
      if (SC.photoKO) return j({ ok: false, reason: 'photo-refusee', error: 'eBay n\'a pas pris la photo : image trop petite (message inventé)' }, 422);
      nPhoto++;
      return j({ ok: true, url: `https://i.ebayimg.com/images/g/banc${nPhoto}/s-l1600.jpg` });
    }
    if (body.action === 'pubinfo') return j({ ok: true, categorie: { categoryId: '15709', suggeree: { categoryId: '15709', categoryName: 'Baskets' } }, categories: [{ categoryId: '15709', categoryName: 'Baskets' }], conditions: [{ id: '3000', label: "D'occasion" }], attributs: [], attributsObligatoires: [] });
    if (body.action === 'pubverify') return j({ ok: true, fees: 0.35, frais: { total: 0.35, insertion: 0.35, programmation: null, remises: null, devise: 'EUR', lignes: [] } });
    if (body.action === 'publish') return j({ ok: true, itemId: '110000000031', url: 'https://www.ebay.fr/itm/110000000031', sku: 'VRM-31' });
    if (body.action === 'sync' || body.action === 'relire') return j({ ok: true });
    return j({ ok: true });
  });
  return { ctx, pg, errs };
}
const resumeReecrit = () => ecritures.some((l) => l && l.data && Object.prototype.hasOwnProperty.call(l.data, 'vrm_agent_ebay_resume') && JSON.stringify(l.data.vrm_agent_ebay_resume) !== JSON.stringify(RESUME));
const actionsPrep = () => envois.filter((e) => ['pubinfo', 'pubverify', 'publish'].includes(e.action)).map((e) => e.action);
const photosEditeur = (pg) => pg.$$eval('[data-ebay-photo]', (els) => els.map((e) => e.getAttribute('data-ebay-photo-url')));

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const [vp, sombre] of [[{ width: 390, height: 844 }, false], [{ width: 1512, height: 950 }, true]]) {
      const mobile = vp.width < 600;
      console.log(`── ${vp.width} px${sombre ? ' (sombre)' : ''}`);
      remettre();
      const { ctx, pg, errs } = await ouvrir(b, vp, sombre);
      // ── A ──
      await essaie('A. eBay → À traiter sans agent', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=ebay_agent`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-ebay-titre-taches]', { timeout: 25000 });
        await pg.waitForTimeout(3500);   // l'ancien agent proposait et préparait dans ce délai
        dit(true, 'eBay → À traiter monte avec sa liste de tâches');
        const nAgent = await pg.$$eval('[data-agent-ebay], [data-agent-titre]', (l) => l.length);
        dit(nAgent === 0, 'la section « Agent eBay » n\'est plus dans À traiter', 'trouvées=' + nAgent);
        const txt = await pg.evaluate(() => document.body.innerText);
        dit(!/Agent eBay|prêtes? pour eBay|articles? à regarder pour eBay/i.test(txt), 'aucun texte de l\'agent à l\'écran');
        dit(actionsPrep().length === 0, 'rien n\'est préparé chez eBay tout seul (aucun pubinfo / pubverify / publish)', actionsPrep().join(',') || 'aucun');
      });
      // ── B ──
      await essaie('B. Ma journée', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(3500);
        const txt = await pg.evaluate(() => document.body.innerText);
        dit(!/pour eBay/i.test(txt), 'Ma journée ne dit plus « … pour eBay » (même avec un ancien résumé « 3 prêtes » dans le nuage)');
        const local = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_agent_ebay_resume') || 'null'); } catch (_) { return 'illisible'; } });
        dit(!resumeReecrit() && JSON.stringify(local) === JSON.stringify(RESUME), 'le résumé de l\'agent n\'est jamais réécrit, ni sur l\'appareil ni dans le nuage (plus rien ne le calcule)', JSON.stringify(local).slice(0, 160));
        dit(actionsPrep().length === 0, 'toujours rien de préparé chez eBay', actionsPrep().join(',') || 'aucun');
      });
      if (mobile) {
        // ── C ──
        await essaie('C. photos ajoutées', async () => {
          await pg.goto(`http://localhost:${PORT}/?tab=annonces&site=ebay`, { waitUntil: 'domcontentloaded' });
          await pg.waitForSelector('[data-poster="ebay"]', { timeout: 25000 });
          await pg.click('[data-poster="ebay"]');
          await pg.waitForSelector('[data-choix-paire="31"]', { timeout: 15000 });
          await pg.click('[data-choix-paire="31"]');
          await pg.waitForSelector('[data-ebay-photos-editeur]', { timeout: 10000 });
          const cam = await pg.$('input[type="file"][data-ebay-photo-appareil]');
          const gal = await pg.$('input[type="file"][data-ebay-photo-galerie]');
          const aCam = cam ? await cam.evaluate((e) => ({ accept: e.getAttribute('accept'), capture: e.getAttribute('capture'), multiple: e.multiple })) : null;
          const aGal = gal ? await gal.evaluate((e) => ({ accept: e.getAttribute('accept'), capture: e.getAttribute('capture'), multiple: e.multiple })) : null;
          dit(!!aCam && aCam.accept === 'image/*' && aCam.capture === 'environment', '« Prendre une photo » : accept=image/*, capture=environment (l\'appareil arrière)', JSON.stringify(aCam));
          dit(!!aGal && aGal.accept === 'image/*' && aGal.multiple && !aGal.capture, '« Depuis la galerie » : accept=image/*, plusieurs à la fois', JSON.stringify(aGal));
          await pg.waitForFunction(() => document.querySelectorAll('[data-ebay-photo]').length === 2, null, { timeout: 10000 });
          const avant = await photosEditeur(pg);
          dit(avant.join(' ') === `https://img.test/v${idDe(31)}.jpg https://img.test/v${idDe(31)}b.jpg`, 'les deux photos Vinted de la N°31 sont dans « Photos »', avant.join(' '));
          await gal.setInputFiles([{ name: 'a.png', mimeType: 'image/png', buffer: PNG }, { name: 'b.png', mimeType: 'image/png', buffer: PNG }]);
          const enCours = await pg.waitForSelector('[data-ebay-photo-envoi="envoi"]', { timeout: 3000 }).then(() => true).catch(() => false);
          dit(enCours, 'pendant l\'envoi, la vignette dit « Envoi à eBay… » (aperçu local)');
          await pg.waitForFunction(() => document.querySelectorAll('[data-ebay-photo]').length === 4 && !document.querySelector('[data-ebay-photo-envoi]'), null, { timeout: 15000 });
          const ph = envois.filter((e) => e.action === 'photo');
          dit(ph.length === 2 && ph.every((e) => /^\/9j\//.test(e.image || '')), 'deux envois `photo`, chacun une image JPEG réduite', ph.map((e) => e.image).join(' | '));
          dit(ph.length === 2 && ph[1].t - ph[0].t >= 140, 'les photos partent UNE PAR UNE (la 2e après la réponse de la 1re)', ph.length === 2 ? (ph[1].t - ph[0].t) + ' ms' : '');
          const apres = await photosEditeur(pg);
          dit(apres[2] === 'https://i.ebayimg.com/images/g/banc1/s-l1600.jpg' && apres[3] === 'https://i.ebayimg.com/images/g/banc2/s-l1600.jpg', 'les adresses i.ebayimg.com rejoignent la liste, dans l\'ordre d\'ajout', apres.join(' '));
          // ‹ trois fois : la dernière ajoutée devient la couverture.
          for (let i = 3; i >= 1; i--) await pg.click(`[data-ebay-photo-avant="${i}"]`);
          const ordre = await photosEditeur(pg);
          const couv = await pg.$eval('[data-ebay-photo="0"]', (e) => /couverture/.test(e.innerText));
          dit(ordre[0] === 'https://i.ebayimg.com/images/g/banc2/s-l1600.jpg' && couv, '‹ fait avancer une photo ; en tête, elle est la couverture', ordre.join(' '));
          await pg.click('[data-ebay-photo-retirer="2"]');   // ordre : banc2, v7031, v7031b, banc1 ⇒ retire v7031b
          const sans = await photosEditeur(pg);
          dit(sans.length === 3 && !sans.includes(`https://img.test/v${idDe(31)}b.jpg`) && sans.includes(`https://img.test/v${idDe(31)}.jpg`), '× retire CETTE photo, et seulement elle', sans.join(' '));
          // ── D ──
          SC.photoKO = true;
          const camI = await pg.$('input[type="file"][data-ebay-photo-appareil]');
          await camI.setInputFiles([{ name: 'cam.png', mimeType: 'image/png', buffer: PNG }]);
          await pg.waitForSelector('[data-ebay-photo-envoi="echec"]', { timeout: 10000 });
          const garde = await pg.$eval('[data-publier-garde]', (e) => e.getAttribute('data-publier-garde')).catch(() => null);
          const btn = await pg.$eval('[data-publier-ebay]', (e) => e.disabled).catch(() => null);
          const raison = await pg.$eval('[data-ebay-photos-raison]', (e) => e.textContent).catch(() => '');
          dit(garde === 'photos-echec' && btn === true, 'une photo pas envoyée : la publication ATTEND (bouton grisé, garde nommée)', `garde=${garde} grisé=${btn}`);
          dit(/trop petite/.test(raison), 'la raison d\'eBay est dite sous les photos', raison);
          SC.photoKO = false;
          await pg.click('[data-ebay-photo-reessayer]');
          await pg.waitForFunction(() => document.querySelectorAll('[data-ebay-photo]').length === 4 && !document.querySelector('[data-ebay-photo-envoi]'), null, { timeout: 10000 });
          const fin = await photosEditeur(pg);
          dit(fin[3] === 'https://i.ebayimg.com/images/g/banc3/s-l1600.jpg', '« Réessayer » la fait partir, elle rejoint la liste', fin.join(' '));
          // ── F (cibles, débordement) ──
          const petites = await pg.$$eval('[data-ebay-photos-editeur] button', (l) => l.filter((x) => { const r = x.getBoundingClientRect(); return r.width > 0 && (r.height < 43.5 || r.width < 43.5); }).map((x) => x.getAttribute('aria-label') || x.textContent).slice(0, 5));
          dit(petites.length === 0, 'les gestes du bloc « Photos » font au moins 44 px', petites.join(' · '));
          const deb = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          dit(deb <= 1, 'aucun débordement horizontal à 390 px', String(deb));
          await pg.$eval('[data-ebay-photos-editeur]', (e) => e.scrollIntoView({ block: 'center' })).catch(() => {});
          await pg.waitForTimeout(300);
          await pg.screenshot({ path: path.join(__dirname, 'captures', 'ebay-photos-390.png'), fullPage: false }).catch(() => {});
          // ── E ──
          await pg.waitForFunction(() => { const b = document.querySelector('[data-publier-ebay]'); return b && !b.disabled; }, null, { timeout: 15000 });
          const n0 = envois.length;
          await pg.click('[data-publier-ebay]');
          const v = await pg.waitForSelector('[data-verif-publier]', { timeout: 2500 }).catch(() => null);
          if (v) await v.click();
          for (let i = 0; i < 40 && !envois.slice(n0).some((e) => e.action === 'publish'); i++) await pg.waitForTimeout(150);
          const pub = envois.slice(n0).find((e) => e.action === 'publish');
          const attendu = [fin[0], fin[1], fin[2], fin[3]];
          dit(!!pub && JSON.stringify(pub.item && pub.item.photos) === JSON.stringify(attendu), 'la publication emporte les photos DANS L\'ORDRE CHOISI, ajoutées comprises', pub ? JSON.stringify(pub.item.photos) : 'aucun publish');
          dit(!!pub && pub.confirme === true && pub.agent !== true, 'publiée sur SON clic (confirme:true), jamais « par l\'agent »', pub ? `confirme=${pub.confirme} agent=${pub.agent}` : '');
        });
      }
      dit(!errs.length, 'aucune erreur de page', errs.slice(0, 2).join(' | '));
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc tourne', String((e && e.message) || e).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(`\n${okc} contrôle(s) OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
