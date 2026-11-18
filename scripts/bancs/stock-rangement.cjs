// Banc : « RANGER, NATUREL ET SIMPLE » (17 nov. 2026, lot stock-rangement)
//
// Julien : « l'onglet stock… pour ranger c'est un peu la galère, il faudrait que ce soit beaucoup plus naturel
// et simple d'utilisation ». Récit : docs/passation/2026-11-17-stock-rangement.md. Données INVENTÉES (dépôt
// public), photos du mode exemple (public/exemple/, CC0).
// Le banc JOUE les mêmes parcours deux fois — réglage éteint (l'écran d'avant) et allumé (`vrm_design_v2`) — et
// COMPTE les touchers de chacun :
//   P1  ranger UNE paire qui vient d'être numérotée (N°201) ;
//   P2  ranger les 10 paires qui viennent d'arriver (N°201…210) ;
//   P3  trouver où est la N°178 (taper « 178 ») ;
//   P4  déplacer la N°178 dans une autre case ;
//   P5  voir ce qu'il y a dans un meuble (« Armoire ») — touchers ET distance à faire défiler ;
//   P6  une paire vendue (N°3) : sa case reste allumée, aucun geste ; la sortie à l'expédition prouvée est
//       automatique (bancs stock-case-a-sortir / retour-stock-auto) — 0 toucher des deux côtés.
// Il exige, réglage ALLUMÉ : chaque parcours abouti (la case écrite dans `vrm_slots`, la bonne) et en MOINS de
// touchers qu'éteint pour P2, P3, P4 (P1 au plus autant) ; la case proposée suit la dernière place (même meuble) ;
// AUCUN N° changé (`vinted_annonce_numeros` identique, aucun N° réécrit dans `vrm_slots`) ; cibles ≥ 44 px ;
// aucun texte coupé, aucun défilement de côté ; un seul bouton plein à l'écran.
// Réglage ÉTEINT : l'écran d'avant, mêmes parcours ; avec `BANC_REF=<dist de main>`, sa signature DOM est
// comparée à celle de main (identique exigé).
// `BANC_DIST=<dist>` : l'arbre jugé ; `SHOT=prefixe` pour les captures. Lancer : node scripts/bancs/stock-rangement.cjs
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const REF = process.env.BANC_REF || '';
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const AUJ = Date.now();

// ── La base inventée : deux meubles, 7 paires rangées (dont N°3 vendue), 10 qui viennent d'arriver. ──
const PHOTOS = fs.readdirSync(path.join(__dirname, '..', '..', 'public', 'exemple')).filter((x) => /-400\.webp$/.test(x)).sort();
const ph = (k) => '/exemple/' + PHOTOS[k % PHOTOS.length];
const MODELES = ['Nike Air Max 90 noire 42', 'Adidas Samba OG blanche 41', 'Salomon XT-6 grise 43', 'New Balance 550 crème 41', 'Asics Gel-Kayano 14 argent 42', 'Nike Dunk Low panda 40',
  'Adidas Campus 00s marron 42', 'Nike Air Force 1 blanche 44', 'New Balance 2002R grise 43', 'Adidas Gazelle bleue 39', 'Puma Speedcat rouge 40', 'Nike Vomero 5 beige 42',
  'Asics GT-2160 blanche 41', 'Adidas Handball Spezial noire 43', 'Nike Cortez blanche 38', 'Salomon ACS Pro noire 44', 'Onitsuka Mexico 66 jaune 41'];
const NUMS = ['1', '2', '3', '4', '5', '6', '178', '201', '202', '203', '204', '205', '206', '207', '208', '209', '210'];
const NUMEROS = {}; NUMS.forEach((n, k) => { NUMEROS[String(5000 + k)] = { numero: n, title: MODELES[k], photo: ph(k), accountId: '111' }; });
const idDe = (n) => Number(Object.keys(NUMEROS).find((id) => NUMEROS[id].numero === n));
const MAIN = {
  vinted_annonce_numeros: NUMEROS,
  vrm_meubles: [{ id: 'mA', name: 'Étagère entrée', cols: 4, rows: 3 }, { id: 'mB', name: 'Armoire chambre', cols: 3, rows: 4 }],
  vrm_slots: { '1': { m: 'mA', i: 0 }, '2': { m: 'mA', i: 1 }, '3': { m: 'mA', i: 2 }, '4': { m: 'mA', i: 3 }, '5': { m: 'mA', i: 4 }, '6': { m: 'mA', i: 5 }, '178': { m: 'mB', i: 4 } },
  vrm_stock_vendus: { nums: ['3'], at: AUJ },
  vinted_nums_physiques: { nums: NUMS, at: AUJ },
  vrm_je_vends: { choix: 'sneakers' },   // Julien vend des sneakers : « paire », « T. 44 »
};
const enLigne = (n) => ({ id: idDe(n), title: NUMEROS[String(idDe(n))].title, is_closed: false, is_hidden: false, is_draft: false, price: { amount: '80.0', currency_code: 'EUR' }, photo: { url: NUMEROS[String(idDe(n))].photo } });
const LISTINGS = [{ id: 'harvest_111_listings', data: { capturedAt: new Date(AUJ - 3600000).toISOString(), nItems: NUMS.length - 1, payload: { items: NUMS.filter((n) => n !== '3').map(enLigne) } } }];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const serveur = (dist) => http.createServer((q, r) => {
  let f = decodeURIComponent(q.url.split('?')[0]); if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(dist, f);
  if (!p.startsWith(dist) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
const ecouter = (srv) => new Promise((ok) => srv.listen(0, () => ok(srv.address().port)));

async function rendre(b, port, { tel, sombre = false, v2, reduit = false, petit = false }) {
  const ctx = await b.newContext({ viewport: petit ? { width: 375, height: 667 } : tel ? { width: 390, height: 844 } : { width: 1512, height: 950 }, ...(tel ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}), colorScheme: sombre ? 'dark' : 'light', reducedMotion: reduit ? 'reduce' : 'no-preference', locale: 'fr-FR', serviceWorkers: 'block' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j([{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]);
    if (/id=eq\.main/.test(u)) return j([{ id: 'main', data: MAIN }]);
    if (/id=like\.harvest_\*_listings/.test(u) || /id=eq\.harvest_111_listings/.test(u)) return j(LISTINGS);
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  // LA GRILLE « QUALITÉ ET FLUIDITÉ » : les décalages de mise en page (hors geste), et le temps entre un toucher et la
  // coche « fait » de la séance.
  await pg.addInitScript(() => {
    window.__cls = 0; window.__reponses = [];
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch (_) {}
    let t0 = 0;
    addEventListener('pointerdown', (e) => { if (e.target && e.target.closest && e.target.closest('[data-sr-ranger-ici]')) t0 = performance.now(); }, true);
    new MutationObserver(() => { if (t0 && document.querySelector('.sr-coche')) { window.__reponses.push(Math.round(performance.now() - t0)); t0 = 0; } }).observe(document, { childList: true, subtree: true });
  });
  await pg.addInitScript(({ m, sombre, v2, petit }) => { try { localStorage.setItem('vrm_acces_direct', '1'); for (const k in m) localStorage.setItem(k, JSON.stringify(m[k])); localStorage.setItem('vinted_dark', JSON.stringify(!!sombre)); localStorage.setItem('vrm_meubles_zoom', 'normal'); localStorage.setItem('vrm_design_v2', v2 ? '1' : '0');   // (18 nov.) allumé par défaut : « 0 » = l'ancien design if (petit) localStorage.setItem('vrm_taille_texte', 'tresGrand'); } catch (_) {} }, { m: MAIN, sombre, v2, petit });
  await pg.goto(`http://localhost:${port}/?tab=garage`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector(v2 ? '[data-sr-ecran] [data-sr-lancer]' : '[data-case-ici="mA:0"]', { timeout: 40000 }).catch(() => {});
  await pg.waitForTimeout(1200);
  // Compteur de touchers : chaque geste du banc passe par `toucher`.
  let n = 0;
  const toucher = async (sel) => { const el = pg.locator(sel).locator('visible=true').first(); try { await el.waitFor({ state: 'visible', timeout: 10000 }); } catch (e) { await shot(pg, 'echec'); throw new Error('introuvable : ' + sel); } await el.scrollIntoViewIfNeeded(); n++; if (tel) await el.tap(); else await el.click(); await pg.waitForTimeout(260); };
  const taper = async (sel, texte) => { await toucher(sel); await pg.keyboard.type(texte, { delay: 30 }); await pg.waitForTimeout(400); };
  // `vrm_slots` est écrit sur l'appareil 500 ms après le geste (`save`) : on attend la clé voulue, jamais un délai fixe.
  const attendreSlots = (cles) => pg.waitForFunction((ks) => { try { const s = JSON.parse(localStorage.getItem('vrm_slots') || 'null'); return !!s && ks.every((k) => !!s[k]); } catch (_) { return false; } }, cles, { timeout: 6000 }).catch(() => {});
  const lireLs = () => pg.evaluate(() => ({ slots: JSON.parse(localStorage.getItem('vrm_slots') || 'null'), numeros: localStorage.getItem('vinted_annonce_numeros') }));
  return { ctx, pg, errs, toucher, taper, lireLs, attendreSlots, touchers: () => n, zero: () => { n = 0; } };
}
const shot = async (pg, nom) => { if (process.env.SHOT) await pg.screenshot({ path: `${process.env.SHOT}-${nom}.png`, fullPage: false }).catch(() => {}); };
// Une case libre d'un meuble, sur l'écran d'avant (la première dans l'ordre de lecture).
const caseLibreAvant = (m) => `[data-meuble="${m}"] button[data-case-ici]:not([data-case-num]):not([data-case-notee])`;

// Les cibles, les textes coupés, le défilement de côté, le nombre de pleins (seulement les formes du nouveau Stock).
const regles = (pg) => pg.evaluate(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); return e.getClientRects().length && r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight; };
  const btns = [...document.querySelectorAll('.sr-ecran button, .sr-feuille button, .sr-ecran [data-v2l]')].filter((b) => /(^| )(sr-|v2b|v2-rangee|v2l)/.test(b.className) && vis(b) && !b.closest('.sr-place-corps, .sr-ancien'));
  const petits = btns.filter((b) => { const r = b.getBoundingClientRect(); return r.height < 43.5 || r.width < 43.5; }).map((b) => (b.getAttribute('aria-label') || b.textContent || b.className).slice(0, 40) + ' ' + Math.round(b.getBoundingClientRect().width) + '×' + Math.round(b.getBoundingClientRect().height));
  const coupes = [...document.querySelectorAll('.v2b-lib, .v2-menu-lib, .v2-plaque, .v2-ann-groupe, .sr-plus-txt b, .sr-btn, .sr-h2, .sr-titre, .sr-plaque, .sr-ici-meuble, .sr-ici-case, .sr-affiche-mot, .sr-meuble-onglet, .sr-fin-titre, .sr-rangee-s, .vrm-fs-titre, .vrm-fs-sous-titre')]
    .filter((e) => vis(e) && e.closest('.sr-ecran, .sr-feuille') && !e.closest('.sr-place-corps, .sr-ancien') && (e.scrollWidth > e.clientWidth + 1)).map((e) => (e.textContent || '').trim().slice(0, 50));
  const pleins = [...document.querySelectorAll('.sr-btn-plein, .v2b-principal')].filter(vis).length;
  // La 1re paire de la liste : sa hauteur à l'écran (Julien : elle arrivait à 1 260 px sur 2 000).
  const l1 = document.querySelector('[data-sr-ligne]'); const premiere = l1 ? Math.round(l1.getBoundingClientRect().top) : null;
  // L'AIR : rangées ≥ 64 px, cartes ≥ 20 px de marge intérieure ; l'ordinateur en deux colonnes (la liste, la place).
  const basses = [...document.querySelectorAll('.sr-ecran .sr-ligne, .sr-ecran .sr-rangee, .sr-feuille .sr-plus-ligne')].filter(vis).filter((e) => e.getBoundingClientRect().height < 63.5).length;
  const serrees = [...document.querySelectorAll('.sr-reponse, .sr-ici, .sr-place-corps')].filter(vis).filter((e) => { const cs = getComputedStyle(e); return parseFloat(cs.paddingRight) < 19.5 || parseFloat(cs.paddingTop) < 3.5; }).length;
  const liste = document.querySelector('.sr-liste-paires'), cote = document.querySelector('.sr-cote');
  const deux = !!(liste && cote && cote.getBoundingClientRect().left >= liste.getBoundingClientRect().right - 1);
  return { petits, coupes, pleins, premiere, ih: innerHeight, basses, serrees, deux, ordi: innerWidth >= 1024, glisse: !!document.querySelector('[data-sr-glisse="ranger"]'), sw: document.documentElement.scrollWidth, iw: innerWidth };
});
// La signature de l'écran Stock (éteint) : balises, attributs data-*, textes — pour la comparer à celle de main.
const signature = (pg) => pg.evaluate(() => {
  const el = document.querySelector('[data-refonte-ms="stock"]'); if (!el) return '';
  const out = [];
  const walk = (n, d) => { if (n.nodeType === 3) { const t = n.textContent.replace(/\s+/g, ' ').trim(); if (t) out.push(d + '#' + t); return; } if (n.nodeType !== 1) return;
    out.push(d + n.tagName + [...n.attributes].filter((a) => /^(data-|aria-|class$|role$|type$)/.test(a.name) && !/^data-(tombe|ms-vise|vu)$/.test(a.name)).map((a) => a.name + '=' + a.value).sort().join(','));
    n.childNodes.forEach((c) => walk(c, d + ' ')); };
  walk(el, ''); return out.join('\n');
});

async function parcours(b, port, { tel, sombre, v2, nom, petit = false }) {
  const res = {};
  const t = `${nom} ${v2 ? 'ALLUMÉ' : 'éteint'}`;
  // P1 — une paire.
  { const r = await rendre(b, port, { tel, sombre, v2, petit }); const avant = await r.lireLs();
    await shot(r.pg, nom + (v2 ? '-apres' : '-avant') + '-ecran');
    // Le geste plein reçoit VRAIMENT le doigt (mesuré : la boîte transparente de l'en-tête à la cloche le couvrait).
    if (v2) { const pt = await r.pg.evaluate(() => { const b = document.querySelector('[data-sr-lancer]'); if (!b) return null; const q = b.getBoundingClientRect(); const e = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); return { dans: !!(e && b.contains(e)), tag: e && e.tagName }; });
      dit(!!pt && pt.dans, `${t} : écran — « Ranger » reçoit le toucher (rien ne le couvre)`, JSON.stringify(pt)); }
    if (v2) { await r.toucher('[data-sr-lancer]'); await shot(r.pg, nom + '-apres-seance'); await r.toucher('[data-sr-ranger-ici]'); }
    else { await r.toucher('[data-a-ranger="201"]'); await r.toucher(caseLibreAvant('mA')); }
    await r.pg.waitForTimeout(400); const ap = await r.lireLs();
    res.p1 = r.touchers();
    dit(ap.slots && ap.slots['201'] && ap.slots['201'].m === 'mA' && ap.slots['201'].i === 6, `${t} : P1 — N°201 rangée dans la première case libre (Étagère entrée, 7e case)`, JSON.stringify(ap.slots && ap.slots['201']));
    dit(ap.numeros === avant.numeros, `${t} : P1 — aucun N° changé`);
    dit(!r.errs.length, `${t} : P1 — aucune erreur de page`, r.errs.slice(0, 2).join(' | '));
    if (v2) { const g = await regles(r.pg); res.regles = g; }
    await r.ctx.close(); }
  // P2 — dix paires.
  { const r = await rendre(b, port, { tel, sombre, v2, petit }); const avant = await r.lireLs();
    const cles = ['201', '202', '203', '204', '205', '206', '207', '208', '209', '210'];
    let suite = true, regl = null;
    if (v2) {
      await r.toucher('[data-sr-lancer]');
      for (let k = 0; k < cles.length; k++) {
        await r.pg.waitForSelector(`[data-sr-courant="${cles[k]}"]`, { timeout: 8000 }).catch(() => {});
        const prop = await r.pg.getAttribute('[data-sr-propose]', 'data-sr-propose').catch(() => null);
        if (k > 0 && k < 6 && !(prop && prop.startsWith('mA:'))) suite = false;   // il reste 5 cases dans l'Étagère après la 1re : la suite y reste
        if (k === 3) { await shot(r.pg, nom + '-apres-seance-suite'); regl = await regles(r.pg); }
        await r.toucher('[data-sr-ranger-ici]');
      }
      await r.pg.waitForSelector('[data-sr-fin]', { timeout: 5000 }).catch(() => {});
      await shot(r.pg, nom + '-apres-seance-fin');
    } else {
      for (const k of cles) { await r.toucher(`[data-a-ranger="${k}"]`); await r.toucher(`${caseLibreAvant('mA')}, ${caseLibreAvant('mB')}`); }
    }
    await r.attendreSlots(cles); const ap = await r.lireLs();
    res.p2 = r.touchers();
    const places = cles.map((k) => ap.slots && ap.slots[k] ? ap.slots[k].m + ':' + ap.slots[k].i : null);
    dit(places.every(Boolean) && new Set(places).size === 10 && !Object.values(MAIN.vrm_slots).some((v) => places.includes(v.m + ':' + v.i)), `${t} : P2 — les 10 paires rangées, chacune dans SA case libre`, places.join(' '));
    dit(ap.numeros === avant.numeros && Object.keys(MAIN.vrm_slots).every((k) => JSON.stringify(ap.slots[k]) === JSON.stringify(MAIN.vrm_slots[k])), `${t} : P2 — aucun N° changé, aucune paire déjà rangée bougée`);
    if (v2) { dit(suite, `${t} : P2 — la case proposée suit la dernière place (le même meuble)`); if (regl) res.reglesSeance = regl; }
    await r.ctx.close(); }
  // P7 (allumé) — LA DERNIÈRE PLACE : la 1re paire posée par « Autre place » dans l'Armoire (mB:0) ; la suivante doit se
  // voir proposer l'Armoire (mB:1), pas la première case libre de l'Étagère (mA:6).
  if (v2) { const r = await rendre(b, port, { tel, sombre, v2, petit });
    await r.toucher('[data-sr-lancer]'); await r.toucher('[data-sr-autre]'); await r.toucher('[data-sr-onglet="mB"]');
    await shot(r.pg, nom + '-apres-autre-place');
    await r.toucher('[data-sr-grille="mB"] [data-sr-case="mB:0"]');
    await r.pg.waitForSelector('[data-sr-courant="202"]', { timeout: 8000 }).catch(() => {});
    const prop = await r.pg.getAttribute('[data-sr-propose]', 'data-sr-propose').catch(() => null);
    await r.attendreSlots(['201']); const ap = await r.lireLs();
    dit(ap.slots && ap.slots['201'] && ap.slots['201'].m === 'mB' && ap.slots['201'].i === 0, `${t} : P7 — N°201 posée dans l'Armoire par « Autre place »`, JSON.stringify(ap.slots && ap.slots['201']));
    dit(prop === 'mB:1', `${t} : P7 — la suivante se voit proposer la case d'à côté dans l'Armoire (la dernière place utilisée)`, String(prop));
    await r.ctx.close(); }
  // Q — LA GRILLE QUALITÉ (allumé) : coche < 100 ms après le toucher ; un 2e toucher PENDANT le mouvement fait arriver
  // la suivante sans reposer la paire ; mouvement réduit = aucune animation ; rangées en content-visibility, photos
  // paresseuses ; aucun décalage de mise en page (CLS < 0,05) en passant Paires → Places → Paires.
  if (v2) {
    { const r = await rendre(b, port, { tel, sombre, v2, petit });
      const q = await r.pg.evaluate(() => { const l = document.querySelector('.sr-liste-paires > .sr-ligne'); const imgs = [...document.querySelectorAll('.sr-liste-paires img')];
        return { cv: l ? getComputedStyle(l).contentVisibility : null, lazy: imgs.length > 0 && imgs.every((i) => i.loading === 'lazy') }; });
      dit(q.cv === 'auto' && q.lazy, `${t} : Q — rangées en content-visibility, photos paresseuses`, JSON.stringify(q));
      await r.toucher('[data-sr-seg="places"]'); await r.toucher('[data-sr-seg="paires"]');
      await r.toucher('[data-sr-lancer]');
      const el = r.pg.locator('[data-sr-ranger-ici]').first(); await el.waitFor({ state: 'visible' });
      // Le 2e toucher arrive PENDANT les 220 ms du mouvement (un toucher de Playwright attend la stabilité : il pourrait
      // arriver après) — il est donc rejoué dans la page, 60 ms après le premier.
      if (tel) await el.tap(); else await el.click();
      await r.pg.evaluate(() => new Promise((ok) => setTimeout(() => { const b = document.querySelector('[data-sr-ranger-ici]'); if (b) b.click(); ok(); }, 60)));
      await r.pg.waitForTimeout(120);
      const courant2 = await r.pg.evaluate(() => { const e = document.querySelector('[data-sr-courant]'); return e && e.getAttribute('data-sr-courant'); });
      await r.attendreSlots(['201']); await r.pg.waitForTimeout(800);   // `vrm_slots` part 500 ms après : 202 ne doit pas y être
      const apres = await r.pg.evaluate(() => ({ courant: document.querySelector('[data-sr-courant]') && document.querySelector('[data-sr-courant]').getAttribute('data-sr-courant'), rep: window.__reponses.slice(), cls: window.__cls, slots: JSON.parse(localStorage.getItem('vrm_slots') || 'null') }));
      dit(apres.rep.length && Math.max(...apres.rep) < 100, `${t} : Q — la coche « fait » arrive < 100 ms après le toucher`, apres.rep.join(',') + ' ms');
      dit(courant2 === '202' && apres.courant === '202' && apres.slots['201'] && apres.slots['201'].m === 'mA' && apres.slots['201'].i === 6 && !apres.slots['202'], `${t} : Q — un 2e toucher pendant le mouvement : la suivante arrive, rien n'est reposé`, JSON.stringify({ c: apres.courant, s201: apres.slots['201'], s202: apres.slots['202'] }));
      dit(apres.cls < 0.05, `${t} : Q — aucun saut de mise en page (CLS hors geste)`, apres.cls.toFixed(4));
      await r.ctx.close(); }
    { const r = await rendre(b, port, { tel, sombre, v2, petit, reduit: true });
      await r.toucher('[data-sr-lancer]'); await r.toucher('[data-sr-ranger-ici]');
      // Mouvement réduit : aucun DÉPLACEMENT (un fondu d'opacité reste permis, il ne bouge rien).
      const q = await r.pg.evaluate(() => ({ anims: document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('.sr-feuille, .sr-ecran')
          && (() => { try { return a.effect.getKeyframes().some((k) => (k.transform && k.transform !== 'none') || k.translate || k.scale); } catch (_) { return true; } })()).length,
        courant: document.querySelector('[data-sr-courant]') && document.querySelector('[data-sr-courant]').getAttribute('data-sr-courant') }));
      dit(q.anims === 0 && q.courant === '202', `${t} : Q — mouvement réduit : aucune animation, la suivante est là`, JSON.stringify(q));
      await r.ctx.close(); }
  }
  // P3 + P4 — trouver N°178, puis la déplacer.
  { const r = await rendre(b, port, { tel, sombre, v2, petit }); const avant = await r.lireLs();
    let trouve = false;
    if (v2) {
      await r.taper('[data-sr-cherche]', '178');
      trouve = await r.pg.evaluate(() => { const e = document.querySelector('[data-sr-reponse="178"]'); return !!e && e.getAttribute('data-sr-reponse-ou') === 'Armoire chambre|2|2' && !!e.querySelector('[data-sr-plan-vise]'); });
      await shot(r.pg, nom + '-apres-trouver');
      res.p3 = r.touchers();
      await r.toucher('[data-sr-deplacer]');
      await shot(r.pg, nom + '-apres-deplacer');
      const g = await regles(r.pg); res.reglesDeplacer = g;
      await r.toucher('[data-sr-grille="mB"] [data-sr-case]:not(.is-prise):not(.is-ici)');
    } else {
      await r.taper('[data-stock-recherche] input', '178');
      await r.toucher('[data-stock-res="178"]');
      await r.pg.waitForFunction(() => { const e = document.querySelector('[data-case-num="178"]'); if (!e) return false; const q = e.getBoundingClientRect(); return q.top >= 0 && q.bottom <= innerHeight; }, null, { timeout: 5000 }).catch(() => {});
      trouve = await r.pg.evaluate(() => { const e = document.querySelector('[data-case-num="178"]'); if (!e) return false; const q = e.getBoundingClientRect(); return q.top >= 0 && q.bottom <= innerHeight; });
      await shot(r.pg, nom + '-avant-trouver');
      res.p3 = r.touchers();
      await r.toucher('[data-case-num="178"]');
      // La fiche s'ouvre ; « Déplacer » vit dans sa feuille « ⋯ » (src/FichePaire.jsx, 16 nov.).
      await r.toucher('[data-fd-plus-ouvrir]');
      await r.toucher('[data-fiche-ranger="deplacer"]');
      await r.toucher(caseLibreAvant('mB'));
    }
    dit(trouve, `${t} : P3 — N°178 trouvée et sa place montrée (Armoire chambre, rangée 2, colonne 2)`);
    await r.pg.waitForTimeout(500); const ap = await r.lireLs();
    res.p4 = r.touchers();
    dit(ap.slots && ap.slots['178'] && ap.slots['178'].m === 'mB' && ap.slots['178'].i !== 4, `${t} : P4 — N°178 déplacée dans une autre case de l'Armoire`, JSON.stringify(ap.slots && ap.slots['178']));
    dit(ap.numeros === avant.numeros, `${t} : P4 — aucun N° changé`);
    await r.ctx.close(); }
  // P5 — voir ce qu'il y a dans l'Armoire ; P6 — la vendue allumée.
  { const r = await rendre(b, port, { tel, sombre, v2, petit });
    if (v2) { await r.toucher('[data-sr-seg="places"]'); await r.toucher('[data-sr-place-ouvrir="mB"]'); }
    await r.pg.waitForTimeout(300);
    // La distance à faire défiler pour AVOIR l'Armoire sous les yeux (le haut de ses cases), mesurée avant de défiler.
    const dist = await r.pg.evaluate(() => { const e = document.querySelector('[data-meuble="mB"] [data-meuble-grille]'); if (!e) return null; const q = e.getBoundingClientRect(); return Math.max(0, Math.round(q.bottom - innerHeight)); });
    await r.pg.evaluate(() => { const e = document.querySelector('[data-meuble="mB"]'); if (e) e.scrollIntoView({ block: 'center' }); });
    await r.pg.waitForTimeout(400);
    const vu = await r.pg.evaluate(() => { const e = document.querySelector('[data-meuble="mB"] [data-case-num="178"]'); if (!e) return null; const q = e.getBoundingClientRect(); return { dedans: q.top >= 0 && q.bottom <= innerHeight }; });
    res.p5 = r.touchers(); res.p5defile = dist;
    dit(!!vu && vu.dedans, `${t} : P5 — l'Armoire montre ses cases (N°178 à l'écran)`, dist != null ? `${dist} px à défiler` : 'absente');
    await shot(r.pg, nom + (v2 ? '-apres' : '-avant') + '-meuble');
    if (v2) { await r.toucher('[data-sr-place-ouvrir="mA"]'); r.zero(); }
    const vend = await r.pg.evaluate(() => { const e = document.querySelector('[data-case-num="3"]'); return e ? { allumee: e.classList.contains('is-vendue'), ligne: document.querySelector('[data-sr-place="mA"] [data-sr-a-sortir]') ? 1 : 0 } : null; });
    res.p6 = 0;
    dit(!!vend && vend.allumee, `${t} : P6 — la case de N°3 (vendue) reste allumée, sans geste`, JSON.stringify(vend));
    if (v2) dit(!!vend && vend.ligne === 1, `${t} : P6 — « Mes places » dit « 1 à sortir » sur l'Étagère`);
    if (!v2 && REF) res.sig = await signature(r.pg);
    await r.ctx.close(); }
  return res;
}

(async () => {
  const srv = serveur(DIST); const port = await ecouter(srv);
  let srvRef = null, portRef = null; if (REF) { srvRef = serveur(REF); portRef = await ecouter(srvRef); }
  const lancer = () => chromium.launch({ executablePath: CHROMIUM, args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const tous = [{ tel: true, sombre: false, nom: '390-clair' }, { tel: true, sombre: true, nom: '390-sombre' }, { tel: false, sombre: false, nom: '1512-clair' },
    { tel: true, sombre: false, nom: '375-tresgrand', petit: true }];   // 375 × 667, Paramètres → Taille du texte « Très grand » (×1,36)
  // `BANC_SEUL=390-clair` : un seul cas (les mutations).
  const cas = process.env.BANC_SEUL ? tous.filter((c) => c.nom === process.env.BANC_SEUL) : tous;
  const tableau = [];
  for (const c of cas) {
    let b;
    try {
      b = await lancer();
      const av = await parcours(b, port, { ...c, v2: false });
      const ap = await parcours(b, port, { ...c, v2: true });
      tableau.push([c.nom, av, ap]);
      const t = c.nom;
      dit(ap.p1 <= av.p1, `${t} : P1 — une paire : ${av.p1} → ${ap.p1} touchers (au plus autant, sans chercher la case)`);
      dit(ap.p2 < av.p2, `${t} : P2 — dix paires : ${av.p2} → ${ap.p2} touchers`);
      dit(ap.p3 < av.p3, `${t} : P3 — trouver N°178 : ${av.p3} → ${ap.p3} touchers (+ « 178 » tapé)`);
      dit(ap.p4 < av.p4, `${t} : P4 — trouver puis déplacer N°178 : ${av.p4} → ${ap.p4} touchers`);
      console.log(`MESURE ${t} : P5 voir l'Armoire : ${av.p5} toucher, ${av.p5defile} px défilés → ${ap.p5} toucher, ${ap.p5defile} px ; P6 vendue expédiée : 0 → 0`);
      for (const [k, g] of [['écran', ap.regles], ['séance', ap.reglesSeance], ['déplacer', ap.reglesDeplacer]]) {
        if (!g) { dit(false, `${t} : règles (${k}) mesurées`); continue; }
        dit(!g.petits.length, `${t} : ${k} — cibles ≥ 44 px`, g.petits.join(' | '));
        dit(!g.coupes.length, `${t} : ${k} — aucun texte coupé`, g.coupes.join(' | '));
        dit(g.sw <= g.iw, `${t} : ${k} — aucun défilement de côté`, `${g.sw}/${g.iw}`);
        dit(g.pleins <= 1, `${t} : ${k} — un seul bouton plein`, String(g.pleins));
        dit(!g.basses && !g.serrees, `${t} : ${k} — l'air : rangées ≥ 64 px, cartes ≥ 20 px à l'intérieur`, `${g.basses} rangées basses, ${g.serrees} cartes serrées`);
        if (k === 'écran' && g.ordi) dit(g.deux, `${t} : écran — ordinateur : la liste à gauche, les places à droite`);
        if (k === 'écran') { dit(g.premiere != null && g.premiere <= g.ih * (/^375/.test(t) ? 0.6 : 0.5), `${t} : écran — la 1re paire de la liste dans la moitié haute du premier écran`, `${g.premiere} px / ${g.ih}`);
          if (/^3(90|75)/.test(t)) dit(g.glisse, `${t} : écran — glisser à gauche une paire à ranger : « Ranger »`); }
      }
      if (REF) {
        const ref = await parcours(b, portRef, { ...c, v2: false, nom: c.nom + '-main' });
        const pareil = ref.sig && ref.sig === av.sig;
        if (!pareil && ref.sig && av.sig) { const a = ref.sig.split('\n'), z = av.sig.split('\n'); const i = a.findIndex((x, j) => x !== z[j]); console.log('  première différence, ligne ' + i + ' :\n  main : ' + a[i] + '\n  ici  : ' + z[i]); }
        dit(pareil, `${t} : réglage éteint — l'écran Stock est celui de main (signature DOM identique, ${ref.sig ? ref.sig.split('\n').length : 0} nœuds)`);
        dit(ref.p1 === av.p1 && ref.p2 === av.p2 && ref.p3 === av.p3 && ref.p4 === av.p4, `${t} : réglage éteint — mêmes touchers que main`, `${ref.p1}/${ref.p2}/${ref.p3}/${ref.p4}`);
      }
    } catch (e) { dit(false, `${c.nom} : le scénario a tourné jusqu'au bout`, String(e && e.message).split('\n')[0].slice(0, 300)); }
    finally { if (b) await b.close().catch(() => {}); }
  }
  console.log('\nTOUCHERS (éteint → allumé)');
  for (const [nom, av, ap] of tableau) console.log(`  ${nom} : une paire ${av.p1}→${ap.p1} · dix paires ${av.p2}→${ap.p2} · trouver ${av.p3}→${ap.p3} · déplacer ${av.p4}→${ap.p4} · voir un meuble ${av.p5}(${av.p5defile} px)→${ap.p5}(${ap.p5defile} px) · vendue expédiée 0→0`);
  srv.close(); if (srvRef) srvRef.close();
  console.log(ko ? `\n${ko} KO` : '\nTOUT VERT');
  process.exit(ko ? 1 : 0);
})();
