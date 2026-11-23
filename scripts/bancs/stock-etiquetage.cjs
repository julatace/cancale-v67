// Banc : « LE STOCK EN MEUBLES, PLEINE LARGEUR » + « LA MÉTHODE D'ÉTIQUETAGE » (19 nov. 2026, lot stock-etiquetage)
//
// Julien : « Pour chaque article, mets "à ranger maintenant" […] Fais une meilleure représentation du meuble, avec une
// animation quand je range l'article dans le meuble. Je veux voir le meuble d'un peu plus loin : qu'il occupe toute la
// largeur de l'écran, et que "ranger" n'apparaisse que quand on le demande. Je veux tous les meubles de rangement
// parfaitement dans l'onglet Stock. » — « À la création du compte, et même après, qu'on puisse choisir la méthode
// d'étiquetage que l'on veut. » Récit : docs/passation/2026-11-19-stock-etiquetage.md. Données INVENTÉES (dépôt public).
//
// Pour chaque rendu (390 tactile clair et sombre, 1512 clair et sombre ; base de VOLUME et base VIDE ; mouvement réduit) :
//   M1  tous les meubles sont dans l'onglet Stock, DESSINÉS, d'entrée (vue « Meubles ») — un par tuile ;
//   M2  téléphone : chaque meuble occupe toute la largeur (≥ 92 % du contenu) ; ordinateur : côte à côte, rien ne déborde ;
//   M3  « de loin » : aucune photo dans la vue d'ensemble, chaque N° écrit fait ≥ 13 px et n'est pas coupé, encre ≥ 4,5:1 ;
//   R1  « Ranger » n'est PAS à l'écran tant qu'on ne le demande pas (aucune séance, aucune case proposée) ;
//   R2  « À ranger · N » : une rangée par article, « Ranger » au bout ; le toucher de la rangée ouvre la séance sur CET article ;
//   R3  la case proposée est celle de src/ouRanger.js (première libre) ; « Ranger ici » l'écrit dans `vrm_slots` ;
//   R4  l'article VOLE dans sa case : une animation de 200–300 ms, courbe iOS ; mouvement réduit ⇒ aucun vol, un fondu ;
//   R5  une autre case touchée sur le meuble dessiné y pose l'article ;
//   Z1  un toucher sur un meuble le zoome : ses cases se touchent (≥ 44 px), « Tous les meubles » revient ;
//   N1  AUCUN N° changé (`vinted_annonce_numeros` identique), aucune paire déjà rangée bougée ;
//   E1  Paramètres → Méthode d'étiquetage : « Je numérote moi-même » ⇒ `vrm_numero_ecrit.actif` ; VRM + lettre ⇒
//       `vrm_num_prefixe` ; la lettre des anciens N° REFUSÉE (rien écrit) ; « Imprimée » + format ⇒ `vrm_etiquetage` ;
//       aucun N° changé ;
//   Q   aucune erreur de page, aucun défilement de côté, un seul bouton plein visible, cibles ≥ 44 px.
// `BANC_DIST=<dist>` : l'arbre jugé ; `SHOT=prefixe` : les captures (jamais commitées). Lancer :
//   node scripts/bancs/stock-etiquetage.cjs
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const AUJ = Date.now();

// ── Les bases inventées ──────────────────────────────────────────────────────
const PHOTOS = fs.readdirSync(path.join(__dirname, '..', '..', 'public', 'exemple')).filter((x) => /-400\.webp$/.test(x)).sort();
const ph = (k) => '/exemple/' + PHOTOS[k % PHOTOS.length];
const MODELES = ['Nike Air Max 90 noire', 'Adidas Samba OG blanche', 'Salomon XT-6 grise', 'New Balance 550 crème', 'Asics Gel-Kayano 14 argent', 'Nike Dunk Low panda',
  'Adidas Campus 00s marron', 'Nike Air Force 1 blanche', 'New Balance 2002R grise', 'Adidas Gazelle bleue', 'Puma Speedcat rouge', 'Nike Vomero 5 beige'];
function base(volume) {
  if (!volume) return { main: { vinted_annonce_numeros: {}, vrm_meubles: [], vrm_slots: {}, vinted_nums_physiques: { nums: [], at: AUJ }, vrm_je_vends: { choix: 'sneakers' } }, listings: [] };
  const NUMS = []; for (let n = 1; n <= 96; n++) NUMS.push(String(n));
  const NUMEROS = {}; // Une photo = une identité (src/App.jsx, `jumellesParPhoto`) : seules les paires à ranger (N°81…96) en ont une, chacune la sienne.
  NUMS.forEach((n, k) => { NUMEROS[String(7000 + k)] = { numero: n, title: MODELES[k % MODELES.length] + ' ' + (38 + (k % 8)), photo: k >= 80 ? ph(k - 80) : null, accountId: '111' }; });
  const meubles = [{ id: 'mA', name: 'Étagère entrée', cols: 4, rows: 3 }, { id: 'mB', name: 'Armoire chambre', cols: 3, rows: 4, couleur: 'sable' },
    { id: 'mC', name: 'Rayonnage garage', cols: 8, rows: 6, couleur: 'ardoise', reglages: { affichage: 'rayonnage' } }, { id: 'mD', name: 'Bacs du couloir', cols: 5, rows: 2, couleur: 'sauge', reglages: { affichage: 'plan' } }];
  // 80 paires rangées (N°1…80, dont N°3 vendue), 16 à ranger (N°81…96).
  const slots = {}; let k = 0; const caps = meubles.map((m) => m.cols * m.rows);
  for (let n = 1; n <= 80; n++) { let mi = 0, i = k; while (i >= caps[mi]) { i -= caps[mi]; mi++; } slots[String(n)] = { m: meubles[mi].id, i }; k++; }
  // mA (12) plein, mB (12) plein, mC : 48 cases, 56 posées au-delà ⇒ on libère de la place : mA garde 2 trous.
  delete slots['5']; delete slots['9'];
  const idDe = (n) => Number(Object.keys(NUMEROS).find((id) => NUMEROS[id].numero === n));
  const enLigne = NUMS.filter((n) => n !== '3' && n !== '5' && n !== '9').map((n) => ({ id: idDe(n), title: NUMEROS[String(idDe(n))].title, is_closed: false, is_hidden: false, is_draft: false, price: { amount: '80.0', currency_code: 'EUR' }, photo: NUMEROS[String(idDe(n))].photo ? { url: NUMEROS[String(idDe(n))].photo } : null }));
  return {
    main: { vinted_annonce_numeros: NUMEROS, vrm_meubles: meubles, vrm_slots: slots, vrm_stock_vendus: { nums: ['3'], at: AUJ }, vinted_nums_physiques: { nums: NUMS, at: AUJ },
      vrm_je_vends: { choix: 'sneakers' }, vrm_numerotation: { archive: 'B', version: 2, coupure: '2026-10-09T00:00:00Z' } },
    listings: [{ id: 'harvest_111_listings', data: { capturedAt: new Date(AUJ - 3600000).toISOString(), nItems: enLigne.length, payload: { items: enLigne } } }],
  };
}

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const serveur = (dist) => http.createServer((q, r) => {
  let f = decodeURIComponent(q.url.split('?')[0]); if (f === '/' || !path.extname(f)) f = '/index.html';
  let p = path.join(dist, f);
  if (!fs.existsSync(p) && f.startsWith('/exemple/')) p = path.join(__dirname, '..', '..', 'public', f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
const PORT = Number(process.env.BANC_PORT) || 0;
const ecouter = (srv) => new Promise((ok) => srv.listen(PORT, () => ok(srv.address().port)));

async function rendre(b, port, { tel, sombre = false, reduit = false, volume = true, url = '?tab=garage' }) {
  const B = base(volume);
  const ctx = await b.newContext({ viewport: tel ? { width: 390, height: 844 } : { width: 1512, height: 950 }, ...(tel ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}), colorScheme: sombre ? 'dark' : 'light', reducedMotion: reduit ? 'reduce' : 'no-preference', locale: 'fr-FR', serviceWorkers: 'block' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(volume ? [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }] : []);
    if (/id=eq\.main/.test(u)) return j([{ id: 'main', data: B.main }]);
    if (/id=like\.harvest_\*_listings/.test(u) || /id=eq\.harvest_111_listings/.test(u)) return j(B.listings);
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  // Les animations demandées (le vol de l'article) : leurs durées et courbes, pour juger R4.
  await pg.addInitScript(() => {
    window.__vols = [];
    const a = Element.prototype.animate;
    Element.prototype.animate = function (k, o) { try { if (this.classList && this.classList.contains('sm-vol')) window.__vols.push({ ms: o && o.duration, courbe: o && o.easing }); } catch (_) {} return a.call(this, k, o); };
  });
  await pg.addInitScript(({ m, sombre }) => { try { localStorage.setItem('vrm_acces_direct', '1'); for (const k in m) localStorage.setItem(k, JSON.stringify(m[k])); localStorage.setItem('vinted_dark', JSON.stringify(!!sombre)); localStorage.removeItem('vrm_stock_v2_vue'); localStorage.setItem('vrm_design_v2', '1'); localStorage.removeItem('vrm_banc_dom_ancien'); /* le design natif (la garde réseau pose l'ancien DOM par défaut) */ } catch (_) {} }, { m: B.main, sombre });
  await pg.goto(`http://localhost:${port}/${url}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs, B };
}
const shot = async (pg, nom) => { if (process.env.SHOT) await pg.screenshot({ path: `${process.env.SHOT}-${nom}.png`, fullPage: false }).catch(() => {}); };
const toucher = async (pg, tel, sel) => { const el = pg.locator(sel).locator('visible=true').first(); await el.waitFor({ state: 'visible', timeout: 10000 }); await el.scrollIntoViewIfNeeded(); if (tel) await el.tap(); else await el.click(); await pg.waitForTimeout(300); };
const lireLs = (pg) => pg.evaluate(() => { const j = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } }; return { slots: j('vrm_slots'), numeros: localStorage.getItem('vinted_annonce_numeros'), ecrit: j('vrm_numero_ecrit'), prefixe: j('vrm_num_prefixe'), etiquetage: j('vrm_etiquetage') }; });

// Les règles visibles : cibles, débordements, pleins, contrastes du dessin, largeur des meubles.
const regles = (pg) => pg.evaluate(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); return e.getClientRects().length && r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight; };
  const rgb = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const fond = (e) => { for (let x = e; x; x = x.parentElement) { const c = rgb(getComputedStyle(x).backgroundColor); if (c && c.a > 0.9) return c; } return { r: 255, g: 255, b: 255 }; };
  const ratio = (e) => { const a = lum(rgb(getComputedStyle(e).color)), b = lum(fond(e)); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
  const ecran = document.querySelector('[data-sr-ecran]'); const W = ecran ? ecran.getBoundingClientRect().width : innerWidth;
  const tuiles = [...document.querySelectorAll('[data-sm-tuile]')].filter((e) => e.getClientRects().length);
  const largeurs = tuiles.map((t) => Math.round(t.getBoundingClientRect().width / W * 100));
  const lignes = new Set(tuiles.map((t) => Math.round(t.getBoundingClientRect().top))).size;
  const nums = [...document.querySelectorAll('[data-sm-tous] .sm-n')].filter((e) => e.getClientRects().length && getComputedStyle(e).display !== 'none' && getComputedStyle(e.parentElement).display !== 'none');
  const petitsN = nums.filter((e) => parseFloat(getComputedStyle(e).fontSize) < 12.9).length;
  const coupesN = nums.filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent).slice(0, 5);
  const contrN = nums.filter(vis).map(ratio).filter((r) => r < 4.5).length;
  const textes = [...document.querySelectorAll('.sm-tuile-nom, .sm-tuile-n, .sm-titre, .sm-zoom-nom, .sm-zoom-n, .n-groupe-titre-texte, .n-rangee-titre, .sm-ranger-fin, .sm-propose-ou, .sm-article-titre')].filter(vis);
  const contr = textes.map((e) => ({ t: (e.textContent || '').slice(0, 24), r: Math.round(ratio(e) * 100) / 100 })).filter((x) => x.r < 4.5).slice(0, 5);
  const photosLoin = document.querySelectorAll('[data-sm-tous] img').length;
  const btns = [...document.querySelectorAll('[data-sr-ecran] button, [data-sr-seance] button, .sm-case')].filter(vis).filter((b) => b.tagName === 'BUTTON');
  const petits = btns.filter((b) => { const r = b.getBoundingClientRect(); return r.height < 43.5 || r.width < 43.5; }).map((b) => (b.getAttribute('aria-label') || b.textContent || '').slice(0, 30) + ' ' + Math.round(b.getBoundingClientRect().width) + '×' + Math.round(b.getBoundingClientRect().height));
  // Une feuille ouverte est l'écran du moment : on compte ses pleins à elle (celui de l'écran reste posé dessous, sous le voile).
  const haut = document.querySelector('[data-n-feuille-couche][data-n-etat="ouverte"] .n-feuille, [data-n-feuille-couche][data-n-etat="entree"] .n-feuille') || document;
  const pleins = [...haut.querySelectorAll('[data-n-variante="plein"]')].filter(vis).length;
  return { tuiles: tuiles.length, largeurs, lignes, petitsN, coupesN, contrN, contr, photosLoin, petits, pleins, sw: document.documentElement.scrollWidth, iw: innerWidth };
});

async function stock(b, port, { tel, sombre, nom, reduit = false }) {
  const t = `${nom}${reduit ? ' réduit' : ''}`;
  const r = await rendre(b, port, { tel, sombre, reduit });
  const { pg } = r;
  await pg.waitForSelector('[data-sm-tous]', { timeout: 40000 }).catch(() => {});
  await pg.waitForSelector('[data-sm-a-ranger]', { timeout: 15000 }).catch(() => {});
  await pg.waitForTimeout(900);
  const avant = await lireLs(pg);
  if (process.env.SONDE2) console.log(JSON.stringify(await pg.evaluate(() => { const o = []; for (let e = document.querySelector('[data-sr-ecran]'); e && e !== document.body; e = e.parentElement) { const c = getComputedStyle(e); o.push([e.tagName, (e.className || '').toString().slice(0, 60), e.getAttribute('data-ecran') || '', Math.round(e.getBoundingClientRect().width), c.maxWidth, c.marginLeft, c.marginRight, c.paddingRight, c.display, c.gridTemplateColumns.slice(0, 40), c.flexDirection, c.alignItems, c.flex, c.justifyContent, c.width, c.justifySelf, c.alignSelf, c.gridColumn]); } return o; }), null, 0));
  // SONDE=1 (diagnostic) : les styles calculés et les règles qui gagnent, pour quelques éléments.
  if (process.env.SONDE) console.log(JSON.stringify(await pg.evaluate(() => ['[data-sm-tuile]', '[data-sr-groupe="aranger"]', '[data-sm-a-ranger-tous] ', '[data-sr-lancer]', '.sm-plein'].map((q) => { const e = document.querySelector(q.trim()); if (!e) return q + ' absent'; const c = getComputedStyle(e);
    const regles = []; for (const sh of document.styleSheets) { let rs; try { rs = sh.cssRules; } catch (_) { continue; } const tour = (l) => { for (const r of l) { if (r.cssRules && !r.selectorText) tour(r.cssRules); else if (r.selectorText) { try { if (e.matches(r.selectorText) && /background|position|bottom/.test(r.style.cssText)) regles.push(r.selectorText.slice(0, 80) + ' {' + r.style.cssText.slice(0, 90)); } catch (_) {} } } }; tour(rs); }
    return { q, bg: c.backgroundColor, pos: c.position, bottom: c.bottom, top: Math.round(e.getBoundingClientRect().top), regles: regles.slice(-6) }; })), null, 1));
  await shot(pg, nom + '-ecran');
  await pg.evaluate(() => { const e = document.querySelector('[data-sm-tous]'); if (e) e.scrollIntoView({ block: 'start' }); }); await pg.waitForTimeout(300);
  await shot(pg, nom + '-meubles');
  await pg.evaluate(() => window.scrollTo(0, 0)); await pg.evaluate(() => { const m = document.getElementById('vrm-contenu'); if (m) m.scrollTop = 0; });
  const g = await regles(pg);
  dit(g.tuiles === 4, `${t} : M1 — les 4 meubles dessinés dans Stock, d'entrée`, String(g.tuiles));
  if (tel) dit(g.largeurs.length && g.largeurs.every((x) => x >= 92), `${t} : M2 — chaque meuble sur toute la largeur`, g.largeurs.join(','));
  else dit(g.lignes < g.tuiles && g.sw <= g.iw, `${t} : M2 — à l'ordinateur, côte à côte, rien ne déborde`, `${g.lignes} lignes · ${g.sw}/${g.iw}`);
  dit(g.photosLoin === 0 && g.petitsN === 0 && !g.coupesN.length && g.contrN === 0, `${t} : M3 — de loin : sans photo, N° ≥ 13 px, entiers, encre ≥ 4,5:1`, JSON.stringify({ p: g.photosLoin, petits: g.petitsN, coupes: g.coupesN, c: g.contrN }));
  dit(!g.contr.length, `${t} : Q — textes de l'écran ≥ 4,5:1`, JSON.stringify(g.contr));
  const rien = await pg.evaluate(() => ({ seance: !!document.querySelector('[data-sr-seance] [data-sr-courant]'), propose: !!document.querySelector('[data-sr-propose]') }));
  dit(!rien.seance && !rien.propose, `${t} : R1 — « Ranger » n'apparaît pas tant qu'on ne le demande pas`, JSON.stringify(rien));
  const rangees = await pg.evaluate(() => [...document.querySelectorAll('[data-sr-groupe="aranger"] [data-sm-ranger]')].map((e) => ({ k: e.getAttribute('data-sm-ranger'), fin: (e.querySelector('.sm-ranger-fin') || {}).textContent || '' })));
  dit(rangees.length >= 5 && rangees.every((x) => x.fin === 'Ranger'), `${t} : R2 — « À ranger » : une rangée par article, « Ranger » au bout`, rangees.map((x) => x.k).join(','));
  dit(g.sw <= g.iw && g.pleins <= 1 && !g.petits.length, `${t} : Q — pas de défilement de côté, un plein au plus, cibles ≥ 44`, JSON.stringify({ sw: g.sw, iw: g.iw, pleins: g.pleins, petits: g.petits.slice(0, 4) }));
  // R2 suite : le toucher de la rangée N°83 ouvre la séance sur N°83 (pas sur le premier de la liste).
  await toucher(pg, tel, '[data-sm-ranger="83"]');
  await pg.waitForSelector('[data-sr-courant="83"]', { timeout: 8000 }).catch(() => {});
  const cour = await pg.getAttribute('[data-sr-courant]', 'data-sr-courant').catch(() => null);
  dit(cour === '83', `${t} : R2 — toucher la rangée range CET article`, String(cour));
  const prop = await pg.getAttribute('[data-sr-propose]', 'data-sr-propose').catch(() => null);
  dit(prop === 'mA:4', `${t} : R3 — la case proposée est la première libre (src/ouRanger.js)`, String(prop));
  await pg.waitForTimeout(400);
  await shot(pg, nom + (reduit ? '-reduit' : '') + '-seance');
  const gs = await regles(pg);
  dit(gs.pleins === 1 && !gs.petits.length, `${t} : Q — séance : un plein, cases ≥ 44`, JSON.stringify({ pleins: gs.pleins, petits: gs.petits.slice(0, 4) }));
  await toucher(pg, tel, '[data-sr-ranger-ici]');
  await pg.waitForFunction(() => { try { const s = JSON.parse(localStorage.getItem('vrm_slots') || '{}'); return !!s['83']; } catch (_) { return false; } }, null, { timeout: 6000 }).catch(() => {});
  const ap = await lireLs(pg);
  dit(ap.slots && ap.slots['83'] && ap.slots['83'].m === 'mA' && ap.slots['83'].i === 4, `${t} : R3 — « Ranger ici » écrit la case proposée`, JSON.stringify(ap.slots && ap.slots['83']));
  const vols = await pg.evaluate(() => window.__vols);
  if (reduit) {
    const anim = await pg.evaluate(() => { const e = document.querySelector('.sm-case.is-arrive .sm-boite'); return e ? getComputedStyle(e).animationName : null; });
    dit(vols.length === 0 && (anim === 'sm-fondu' || anim === null), `${t} : R4 — mouvement réduit : aucun vol, un fondu`, JSON.stringify({ vols, anim }));
  } else dit(vols.length >= 1 && vols.every((v) => v.ms >= 200 && v.ms <= 300 && /cubic-bezier\(\s*0?\.32,\s*0?\.72,\s*0,\s*1\s*\)/.test(v.courbe)), `${t} : R4 — l'article vole dans sa case (200–300 ms, courbe iOS)`, JSON.stringify(vols));
  // R5 : le suivant (N°81, le premier de la file) se pose sur une AUTRE case touchée : mC, première libre du rayonnage.
  await pg.waitForSelector('[data-sr-courant="81"]', { timeout: 8000 }).catch(() => {});
  await toucher(pg, tel, '[data-sr-onglet="mD"]');
  await toucher(pg, tel, '[data-sr-grille="mD"] [data-sm-case="mD:9"]');
  await pg.waitForFunction(() => { try { const s = JSON.parse(localStorage.getItem('vrm_slots') || '{}'); return !!s['81']; } catch (_) { return false; } }, null, { timeout: 6000 }).catch(() => {});
  const ap2 = await lireLs(pg);
  dit(ap2.slots && ap2.slots['81'] && ap2.slots['81'].m === 'mD' && ap2.slots['81'].i === 9, `${t} : R5 — une autre case touchée sur le meuble dessiné y pose l'article`, JSON.stringify(ap2.slots && ap2.slots['81']));
  dit(ap2.numeros === avant.numeros && Object.keys(avant.slots).every((k) => JSON.stringify(ap2.slots[k]) === JSON.stringify(avant.slots[k])), `${t} : N1 — aucun N° changé, aucune paire déjà rangée bougée`);
  // Z1 : fermer la séance, zoomer sur le rayonnage.
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(500);
  await pg.evaluate(() => { const b = document.querySelector('[data-n-feuille-couche] .n-feuille-fermer, [data-n-feuille-couche] [aria-label="Fermer"]'); if (b) b.click(); });
  await pg.waitForTimeout(500);
  await toucher(pg, tel, '[data-sm-tuile="mC"]');
  await pg.waitForSelector('[data-sm-zoom="mC"]', { timeout: 6000 }).catch(() => {});
  await pg.waitForTimeout(400);
  await shot(pg, nom + '-zoom');
  const z = await pg.evaluate(() => { const c = [...document.querySelectorAll('[data-sm-zoom] button.sm-case')]; const r = c.map((e) => e.getBoundingClientRect()); return { n: c.length, min: r.length ? Math.round(Math.min(...r.map((x) => Math.min(x.width, x.height)))) : 0, sw: document.documentElement.scrollWidth, iw: innerWidth }; });
  dit(z.n === 48 && z.min >= 44 && z.sw <= z.iw, `${t} : Z1 — le meuble zoomé : ses 48 cases se touchent (≥ 44 px), la page ne défile pas de côté`, JSON.stringify(z));
  await toucher(pg, tel, '[data-sm-dezoom]');
  const deZ = await pg.evaluate(() => document.querySelectorAll('[data-sm-tuile]').length);
  dit(deZ === 4, `${t} : Z1 — « Tous les meubles » revient à la vue d'ensemble`, String(deZ));
  dit(!r.errs.length, `${t} : Q — aucune erreur de page`, r.errs.slice(0, 2).join(' | '));
  await r.ctx.close();
}

async function vide(b, port, { tel, sombre, nom }) {
  const r = await rendre(b, port, { tel, sombre, volume: false });
  await r.pg.waitForSelector('[data-sm-tous]', { timeout: 40000 }).catch(() => {});
  await r.pg.waitForTimeout(800);
  await shot(r.pg, nom + '-vide');
  const v = await r.pg.evaluate(() => ({ tous: !!document.querySelector('[data-sm-tous]'), ajout: !!document.querySelector('.sm-tuile-ajout[data-creer-meuble]'), sw: document.documentElement.scrollWidth, iw: innerWidth }));
  dit(v.tous && v.ajout && v.sw <= v.iw && !r.errs.length, `${nom} : base vide — l'écran dit quoi faire (« Ajouter un meuble »), aucune erreur`, JSON.stringify({ ...v, errs: r.errs.slice(0, 2) }));
  await r.ctx.close();
}

async function etiquetage(b, port, { tel, sombre, nom }) {
  const r = await rendre(b, port, { tel, sombre, url: '?tab=settings&reglage=etiquetage' });
  const { pg } = r;
  await pg.waitForSelector('[data-etiquetage-reglage]', { timeout: 40000 }).catch(() => {});
  await pg.waitForTimeout(600);
  const avant = await lireLs(pg);
  await shot(pg, nom + '-etiquetage');
  const ok = !!(await pg.$('[data-etiquetage-reglage]'));
  dit(ok, `${nom} : E1 — Paramètres → Stock → Méthode d'étiquetage s'ouvre`);
  if (!ok) { await r.ctx.close(); return; }
  await toucher(pg, tel, '[data-etiquetage-choix="qui:moi"]');
  await pg.waitForFunction(() => { try { return JSON.parse(localStorage.getItem('vrm_numero_ecrit') || 'null').actif === true; } catch (_) { return false; } }, null, { timeout: 4000 }).catch(() => {});
  let l = await lireLs(pg);
  dit(l.ecrit && l.ecrit.actif === true, `${nom} : E1 — « Je numérote moi-même » ⇒ vrm_numero_ecrit allumé (le réglage de l'extension, 5.382)`, JSON.stringify(l.ecrit));
  await toucher(pg, tel, '[data-etiquetage-choix="qui:vrm"]');
  await toucher(pg, tel, '[data-etiquetage-choix="serie:lettre"]');
  const champ = pg.locator('[data-etiquetage-lettre-champ]');
  await champ.fill('B'); await champ.press('Enter'); await pg.waitForTimeout(500);
  l = await lireLs(pg);
  const refus = await pg.getAttribute('[data-etiquetage-refus]', 'data-etiquetage-refus').catch(() => null);
  dit(refus === 'archive' && !l.prefixe, `${nom} : E1 — la lettre des anciens N° (« B ») est refusée, rien écrit`, JSON.stringify({ refus, prefixe: l.prefixe }));
  await champ.fill('C'); await champ.press('Enter');
  await pg.waitForFunction(() => { try { return JSON.parse(localStorage.getItem('vrm_num_prefixe') || 'null') === 'C'; } catch (_) { return false; } }, null, { timeout: 4000 }).catch(() => {});
  l = await lireLs(pg);
  dit(l.prefixe === 'C' && l.ecrit && l.ecrit.actif === false, `${nom} : E1 — VRM numérote, série « C » : vrm_num_prefixe = C`, JSON.stringify({ p: l.prefixe, e: l.ecrit && l.ecrit.actif }));
  await toucher(pg, tel, '[data-etiquetage-choix="support:imprimee"]');
  await toucher(pg, tel, '[data-etiquetage-choix="format:a4-24"]');
  await pg.waitForFunction(() => { try { return JSON.parse(localStorage.getItem('vrm_etiquetage') || 'null').format === 'a4-24'; } catch (_) { return false; } }, null, { timeout: 4000 }).catch(() => {});
  l = await lireLs(pg);
  await shot(pg, nom + '-etiquetage-imprimee');
  dit(l.etiquetage && l.etiquetage.support === 'imprimee' && l.etiquetage.format === 'a4-24', `${nom} : E1 — étiquette imprimée, planche A4 ⇒ vrm_etiquetage`, JSON.stringify(l.etiquetage));
  dit(l.numeros === avant.numeros && JSON.stringify(l.slots) === JSON.stringify(avant.slots), `${nom} : E1 — aucun N° changé, aucune case touchée`);
  const g = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
  dit(g.sw <= g.iw && !r.errs.length, `${nom} : Q — Paramètres : pas de défilement de côté, aucune erreur`, JSON.stringify({ ...g, errs: r.errs.slice(0, 2) }));
  await r.ctx.close();
}

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.log('KO  pas de dist : ' + DIST); process.exit(1); }
  const srv = serveur(DIST); const port = await ecouter(srv);
  const b = await chromium.launch({ executablePath: fs.existsSync(CHROMIUM) ? CHROMIUM : undefined, args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const seul = process.env.SEUL || '';
  try {
    for (const [tel, sombre, nom] of [[true, false, '390-clair'], [true, true, '390-sombre'], [false, false, '1512-clair'], [false, true, '1512-sombre']]) {
      if (seul && !nom.includes(seul)) continue;
      await stock(b, port, { tel, sombre, nom });
      await vide(b, port, { tel, sombre, nom });
    }
    if (!seul || seul === 'reduit') await stock(b, port, { tel: true, sombre: false, nom: '390-clair', reduit: true });
    if (!seul || seul === 'etiq') { await etiquetage(b, port, { tel: true, sombre: false, nom: '390-clair' }); await etiquetage(b, port, { tel: false, sombre: true, nom: '1512-sombre' }); }
  } finally { await b.close(); srv.close(); }
  console.log(ko ? `\n${ko} KO` : '\nTout est vert');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
