// ════════════════════════════════════════════════════════════════════════════
//  BANC « LE N° SUR L'ANNONCE ET LE N° CHANGÉ À LA MAIN » (5 nov., v31).
//  Julien, 5 novembre : « les numéros sur les annonces Vinted doivent être bien
//  mieux positionnés » ; « plusieurs façons d'étiqueter, accompagné par l'app » ;
//  « pouvoir modifier le numéro attribué par VRM, même une fois l'article publié ».
//
//  A. Réglages → Numéros : « Le N° sur tes annonces Vinted » — par défaut
//     « Nulle part » (aucun texte ne change) ; deux questions proposent un choix
//     pris sur SON clic ; la forme (#12…) et la place (titre / description)
//     changent l'APERÇU en direct sur une annonce inventée ; le réglage est
//     rangé (`vrm_num_vinted`, synchronisé : l'audit le vérifie) ; 44 px, pas de défilement de
//     côté à 390 px.
//  B. Annonces : une mise en ligne de moins de 48 h numérotée par VRM est
//     listée avec SON champ N° ; changer 7 → 40 écrit `manuelAt`, garde 7 dans le
//     pool, et met « N°7 → N°40 » dans « à écrire sur tes cartons » (changé par
//     toi) jusqu'à « C'est écrit » ; une annonce publiée il y a longtemps ou déjà
//     touchée à la main n'y est pas ; changer le N° APRÈS (carte) fait pareil ;
//     un N° porté par une autre paire présente est refusé (Annuler ⇒ rien) ;
//     avec un endroit choisi, la ligne dit l'étiquette à remplacer et la copie.
//  Clair et sombre, 390 px tactile et 1512 px. Aucune fixture, rien de réel.
//  BANC_PORT (7963 par défaut), BANC_DIST (dist par défaut), BANC_CAPTURES.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const { routeMain, ecritesMain, attendre } = require('./_base-ecritures.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 7963;
const CAPTURES = process.env.BANC_CAPTURES || path.join(require('os').tmpdir(), 'banc-numero-etiquette');
try { fs.mkdirSync(CAPTURES, { recursive: true }); } catch (_) {}
const auj = new Date();
const ilYa = (h) => new Date(Date.now() - h * 3600e3).toISOString();
const ann = (id, title, heures) => ({ id, title, price: { amount: '49.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, photo: null, brand_title: 'Nike', size_title: '42', status: 'Très bon état', view_count: 3, favourite_count: 0, created_at_ts: Math.floor((Date.now() - heures * 3600e3) / 1000) });
// 9201 : publiée il y a 1 h, numérotée par VRM il y a 1 h (N°7) → « mise en ligne ».
// 9202 : N°5 posé à la main. 9203 : N°3, publiée il y a 30 jours. 9204 : publiée il
// y a 30 jours, numérotée aujourd'hui (premier passage) → pas une mise en ligne.
// 9203 porte « N°3 » en fin de titre (posé par lui) ; 9205 : REPUBLIÉE il y a 1 h,
// elle garde le N°2 de son carton (`recreeDe`) → pas une mise en ligne à renuméroter.
const ITEMS = [ann(9201, 'Nike Air Max 90 blanc taille 42', 1), ann(9202, 'Salomon XT-6 noir taille 41', 40), ann(9203, 'Adidas Samba vert taille 40 N°3', 720), ann(9204, 'Asics Gel 1130 argent taille 43', 720), ann(9205, 'New Balance 550 blanc taille 44', 1)];
const MAIN = (extra = {}) => ({
  vinted_annonce_numeros: {
    '9201': { numero: '7', auto: true, numberedAt: ilYa(1) },
    '9202': { numero: '5', auto: false, manuelAt: ilYa(30), numberedAt: ilYa(40) },
    '9203': { numero: '3', auto: true, numberedAt: ilYa(720) },   // avant la panne du 11-18 oct. : pas « à vérifier »
    '9204': { numero: '6', auto: true, numberedAt: ilYa(2) },
    '9205': { numero: '2', auto: true, numberedAt: ilYa(1), recreeDe: '9100', recreeAt: ilYa(1) },
  },
  vinted_used_numeros: [1, 2, 3, 4, 5, 6, 7], ...extra,
});
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`  ${c ? '✅' : '❌'} ${m}${d ? ' — ' + d : ''}`); };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log(`  ❌ le port ${PORT} est pris (${e.code}) — BANC_PORT=… ou relance le banc seul`); process.exit(1); });
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

async function ouvrir(b, { main, url, largeur, sombre }) {
  // (5 nov.) `main` à la VRAIE forme (`routeMain`) sur une base CLOISONNÉE (la
  // production) : sur l'ancienne base non cloisonnée l'app n'écrivait jamais
  // `main`, et ni le réglage ni le N° changé n'étaient jugés dans le nuage.
  const base = { main, maj: new Date(Date.now() - 86400e3).toISOString(), ecritures: [] };
  const rows = [{ id: 'harvest_111_listings', data: { capturedAt: auj.toISOString(), payload: { items: ITEMS } } }];
  const mobile = largeur < 700;
  const ctx = await b.newContext({ viewport: { width: largeur, height: mobile ? 844 : 950 }, isMobile: mobile, hasTouch: mobile, permissions: ['clipboard-read', 'clipboard-write'] });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); } catch (_) {} }, !!sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d, st = 200) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: typeof d === 'string' ? d : JSON.stringify(d) });
    if (/select=owner&limit=1/.test(u)) return j([{ owner: 'banc' }]);
    const mm = routeMain(req, base); if (mm) return j(mm.body, mm.status);
    if (req.method() !== 'GET') return j([]);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data$|^data,/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: auj.toISOString(), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}${url}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(5500);
  return { pg, ctx, errs, base };
}
const local = (pg, k) => pg.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } }, k);
// Les cartes se recomposent (photos, île) : on laisse la page se poser, sans délai
// qui juge quoi que ce soit (le geste attend l'élément, §6.5).
const toucher = async (pg, sel, mobile) => { const l = pg.locator(sel).first(); await l.scrollIntoViewIfNeeded({ timeout: 8000 }).catch(() => {}); if (mobile) await l.tap({ timeout: 8000 }); else await l.click({ timeout: 8000 }); };
const pasDeCote = (pg) => pg.evaluate(() => (document.scrollingElement || document.documentElement).scrollWidth <= window.innerWidth + 1);
// Un N° neuf sans prix d'achat ⇒ VRM demande le prix (« Plus tard » ne pose rien).
const repondre = async (pg, libelle) => {
  const bt = pg.locator('button:visible', { hasText: libelle }).last();
  if (!await bt.waitFor({ state: 'visible', timeout: 4000 }).then(() => true).catch(() => false)) return;
  // La feuille entre en glissant : un clic pendant l'entrée peut se perdre — on
  // réessaie tant qu'elle est là (au plus 4 fois), jamais un délai qui juge.
  for (let k = 0; k < 4; k++) {
    await bt.click({ timeout: 3000 }).catch(() => {});
    if (await bt.waitFor({ state: 'hidden', timeout: 1500 }).then(() => true).catch(() => false)) return;
  }
};
const plusTard = (pg) => repondre(pg, /^Plus tard$/);
const capture = async (pg, nom) => { try { await pg.screenshot({ path: path.join(CAPTURES, nom + '.png'), fullPage: false }); } catch (_) {} };

async function reglages(b, largeur, sombre) {
  const mobile = largeur < 700, tag = `${largeur}${sombre ? ' sombre' : ' clair'}`;
  console.log(`\n── A. Réglages → Numéros (${tag})`);
  const { pg, ctx, errs, base } = await ouvrir(b, { main: MAIN(), url: '/?tab=settings', largeur, sombre });
  try {
    await pg.waitForSelector('[data-sous-ouvrir="numeros"]', { timeout: 20000 });
    await toucher(pg, '[data-sous-ouvrir="numeros"]', mobile);
    const vu = await pg.waitForSelector('[data-num-vinted]', { timeout: 6000 }).then(() => true).catch(() => false);
    dit(vu, `${tag} : « Le N° sur tes annonces Vinted » est dans le réglage des numéros`);
    if (!vu) { await capture(pg, `A-${largeur}-${sombre ? 'sombre' : 'clair'}-absent`); return; }
    dit(await pg.getAttribute('[data-num-vinted]', 'data-num-vinted') === 'aucune', `${tag} : par défaut « Nulle part » — aucun texte d'annonce ne change`);
    dit(await pg.locator('[data-num-vinted-portee]').count() === 0, `${tag} : « Nulle part » ne promet rien`);
    // L'accompagnement : deux réponses → une proposition, rien n'est pris sans clic.
    await toucher(pg, '[data-num-vinted-reponse="ou:liste"]', mobile);
    await toucher(pg, '[data-num-vinted-reponse="vu:egal"]', mobile);
    const prop = await pg.getAttribute('[data-num-vinted-proposition]', 'data-num-vinted-proposition').catch(() => null);
    dit(prop === 'titre_fin:numero', `${tag} : « dans la liste » + « égal » ⇒ fin du titre, « N°12 »`, String(prop));
    dit(await pg.getAttribute('[data-num-vinted]', 'data-num-vinted') === 'aucune', `${tag} : la proposition n'est pas prise toute seule`);
    await toucher(pg, '[data-num-vinted-prendre]', mobile);
    await pg.waitForTimeout(300);
    dit(await pg.getAttribute('[data-num-vinted]', 'data-num-vinted') === 'titre_fin', `${tag} : « Prendre ce choix » la pose`);
    let t = await pg.getAttribute('[data-apercu-titre]', 'data-apercu-titre');
    dit(/ N°12$/.test(t), `${tag} : l'aperçu montre le titre inventé finissant par « N°12 »`, t);
    dit(await pg.locator('[data-num-vinted-apercu] mark[data-apercu-etiquette="N°12"]').count() >= 1, `${tag} : l'étiquette est mise en évidence dans l'aperçu`);
    // Une autre forme, puis une autre place : l'aperçu suit EN DIRECT.
    await toucher(pg, '[data-num-vinted-forme-choix="diese"]', mobile);
    t = await pg.getAttribute('[data-apercu-titre]', 'data-apercu-titre');
    dit(/ #12$/.test(t) && !/N°12/.test(t), `${tag} : forme « #12 » ⇒ le titre change aussitôt`, t);
    await toucher(pg, '[data-num-vinted-place="desc_fin"]', mobile);
    t = await pg.getAttribute('[data-apercu-titre]', 'data-apercu-titre');
    const d = await pg.getAttribute('[data-apercu-desc]', 'data-apercu-desc');
    dit(!/#12/.test(t) && /\n\n#12$/.test(d), `${tag} : « en bas de la description » ⇒ le titre redevient propre, « #12 » en dernière ligne`, JSON.stringify([t, d.slice(-20)]));
    await toucher(pg, '[data-num-vinted-place="desc_debut"]', mobile);
    const d2 = await pg.getAttribute('[data-apercu-desc]', 'data-apercu-desc');
    dit(/^#12\n\n/.test(d2) && (d2.match(/#12/g) || []).length === 1, `${tag} : « en haut » ⇒ première ligne, jamais deux étiquettes`, JSON.stringify(d2.slice(0, 30)));
    dit(await pg.locator('[data-num-vinted-portee]').count() === 1, `${tag} : l'écran dit où le réglage s'applique aujourd'hui (et ce que l'extension ne fait pas)`);
    await pg.waitForTimeout(2500);   // `save` range 500 ms après le geste, le nuage ensuite
    const reg = await local(pg, 'vrm_num_vinted');
    dit(reg && reg.place === 'desc_debut' && reg.forme === 'diese', `${tag} : réglage rangé sur l'appareil`, JSON.stringify(reg));
    // (5 nov.) Le réglage part au nuage (`vrm_num_vinted` est dans SYNC_KEYS), jugé
    // sur ce que la base a GARDÉ.
    await attendre(() => { const v = base.main && base.main.vrm_num_vinted; return !!(v && v.place === 'desc_debut'); }, 10000);
    const regN = base.main && base.main.vrm_num_vinted;
    dit(ecritesMain(base).length > 0 && regN && regN.place === 'desc_debut' && regN.forme === 'diese', `${tag} : le réglage part au nuage`, `${ecritesMain(base).length} écriture(s) · ${JSON.stringify(regN || null)}`);
    // 44 px au doigt : chaque place et chaque forme.
    const petits = await pg.evaluate(() => [...document.querySelectorAll('[data-num-vinted-place],[data-num-vinted-forme-choix],[data-num-vinted-reponse]')].filter((e) => e.getBoundingClientRect().height < 43.5).map((e) => e.textContent.slice(0, 20)));
    dit(petits.length === 0, `${tag} : chaque choix fait au moins 44 px`, petits.join(' | '));
    dit(await pasDeCote(pg), `${tag} : aucune page qui défile de côté`);
    await pg.locator('[data-num-vinted-apercu]').scrollIntoViewIfNeeded().catch(() => {});
    await capture(pg, `A-${largeur}-${sombre ? 'sombre' : 'clair'}`);
    dit(errs.length === 0, `${tag} : aucune erreur d'app`, errs.join(' | ').slice(0, 200));
  } catch (e) { dit(false, `${tag} : le scénario A a tourné jusqu'au bout`, String(e && e.message).slice(0, 200)); await capture(pg, `A-${largeur}-erreur`); }
  finally { await ctx.close(); }
}

async function annonces(b, largeur, sombre) {
  const mobile = largeur < 700, tag = `${largeur}${sombre ? ' sombre' : ' clair'}`;
  console.log(`\n── B. Annonces : N° à la mise en ligne et après (${tag})`);
  const { pg, ctx, errs, base } = await ouvrir(b, { main: MAIN({ vrm_num_vinted: { place: 'titre_fin', forme: 'numero' } }), url: '/?tab=cat_annonces', largeur, sombre });
  try {
    // (5 nov., chantier C) La liste se déplie sous la ligne d'avis (« N nouveaux N° · Vérifier ») :
    //  ouverte, elle porte les mêmes lignes, le même champ. On la déplie comme la personne.
    await pg.waitForSelector('[data-num-neufs-ouvrir]', { timeout: 8000 }).then(() => pg.click('[data-num-neufs-ouvrir]')).catch(() => {});
    const bloc = await pg.waitForSelector('[data-num-neufs]', { timeout: 8000 }).then(() => true).catch(() => false);
    dit(bloc, `${tag} : la mise en ligne numérotée par VRM est listée`);
    if (bloc) {
      const ids = await pg.evaluate(() => [...document.querySelectorAll('[data-num-neuf]')].map((e) => e.getAttribute('data-num-neuf')));
      dit(ids.length === 1 && ids[0] === '9201', `${tag} : seulement 9201 (pas la paire à la main, ni l'ancienne, ni la vieille annonce numérotée aujourd'hui, ni la republiée qui garde son N°)`, ids.join(','));
      await capture(pg, `B-${largeur}-${sombre ? 'sombre' : 'clair'}-neuf`);
    } else await capture(pg, `B-${largeur}-${sombre ? 'sombre' : 'clair'}-absent`);
    // À la mise en ligne : 7 → 40 (sans le bloc — code d'avant —, par la carte :
    // le reste du scénario juge quand même la règle du N° changé).
    await toucher(pg, bloc ? '[data-num-neuf="9201"] [data-edition="numero-neuf"]' : '[data-carte-annonce="9201"] [data-edition="numero"]', mobile);
    await pg.keyboard.press('Control+A'); await pg.keyboard.type('40'); await pg.keyboard.press('Enter');
    await pg.waitForTimeout(1200); await plusTard(pg);
    let f = ((await local(pg, 'vinted_annonce_numeros')) || {})['9201'] || {};
    dit(String(f.numero) === '40' && !!f.manuelAt, `${tag} : le N° devient 40, posé à la main (manuelAt)`, JSON.stringify(f));
    dit(f.reattribue && String(f.reattribue.de) === '7' && String(f.reattribue.vers) === '40' && f.reattribue.main === true, `${tag} : « N°7 → N°40 » noté comme SON geste`, JSON.stringify(f.reattribue || null));
    const pool = ((await local(pg, 'vinted_used_numeros')) || []).map(String);
    dit(pool.includes('7') && pool.includes('40'), `${tag} : 7 reste brûlé, 40 l'est aussi — jamais redonnés`, pool.join(','));
    const ligne = pg.locator('[data-a-ecrire="9201"]');
    dit(await ligne.count() === 1 && await ligne.getAttribute('data-a-ecrire-de') === '7' && await ligne.getAttribute('data-a-ecrire-vers') === '40' && await ligne.getAttribute('data-a-ecrire-main') === '1', `${tag} : « N°7 → N°40 » dans « à écrire sur tes cartons », changé par toi`);
    dit(await pg.locator('[data-num-neuf="9201"]').count() === 0, `${tag} : la ligne « mise en ligne » s'efface (le N° est maintenant le sien)`);
    dit(await pg.locator('[data-a-ecrire="9201"] [data-a-ecrire-copier="N°40"]').count() === 1, `${tag} : avec « fin du titre » choisie, la ligne propose de copier « N°40 »`);
    // Rien d'affirmé qu'on n'a pas lu : le titre lu de 9201 ne porte pas « N°7 »
    // (VRM n'écrit pas dans les annonces en ligne) ⇒ « ajoute », jamais « remplace « N°7 » ».
    dit(await pg.getAttribute('[data-a-ecrire="9201"] [data-a-ecrire-vinted]', 'data-a-ecrire-vinted').catch(() => null) === 'ajouter', `${tag} : titre lu sans « N°7 » ⇒ la ligne dit d'ajouter « N°40 », pas de remplacer un « N°7 » absent`);
    await ligne.scrollIntoViewIfNeeded().catch(() => {});
    await capture(pg, `B-${largeur}-${sombre ? 'sombre' : 'clair'}-a-ecrire`);
    // APRÈS la mise en ligne, sur la carte : un N° porté par une autre paire présente.
    await toucher(pg, '[data-carte-annonce="9202"] [data-edition="numero"]', mobile);
    await pg.keyboard.press('Control+A'); await pg.keyboard.type('3'); await pg.keyboard.press('Enter');
    await pg.waitForTimeout(1000);
    const alerte = await pg.evaluate(() => { const t = [...document.querySelectorAll('div,h2,h3')].map((e) => e.textContent || '').find((t) => /déjà pris/i.test(t)); return t ? t.slice(0, 60) : ''; });
    dit(/déjà pris/i.test(alerte), `${tag} : N°3 (porté par une autre paire en ligne) ⇒ VRM demande`, alerte);
    await repondre(pg, /^Annuler$/);
    f = ((await local(pg, 'vinted_annonce_numeros')) || {})['9202'] || {};
    dit(String(f.numero) === '5' && !f.reattribue, `${tag} : Annuler ⇒ la paire garde N°5, rien à barrer`, JSON.stringify(f));
    // APRÈS : un numéro libre, sur la carte.
    await toucher(pg, '[data-carte-annonce="9203"] [data-edition="numero"]', mobile);
    await pg.keyboard.press('Control+A'); await pg.keyboard.type('41'); await pg.keyboard.press('Enter');
    await pg.waitForTimeout(1200); await plusTard(pg);
    f = ((await local(pg, 'vinted_annonce_numeros')) || {})['9203'] || {};
    dit(String(f.numero) === '41' && f.reattribue && String(f.reattribue.de) === '3' && f.reattribue.main === true, `${tag} : N°3 → N°41 sur une annonce en ligne depuis 30 jours, noté à barrer`, JSON.stringify(f));
    dit(await pg.locator('[data-a-ecrire="9203"]').count() === 1, `${tag} : la ligne « N°3 → N°41 » est dans la liste`);
    dit(await pg.getAttribute('[data-a-ecrire="9203"] [data-a-ecrire-vinted]', 'data-a-ecrire-vinted').catch(() => null) === 'remplacer', `${tag} : titre lu finissant par « N°3 » ⇒ « remplace « N°3 » par « N°41 » »`);
    // « C'est écrit » range la ligne.
    await toucher(pg, '[data-a-ecrire="9201"] button:has-text("C\'est écrit")', mobile);
    await pg.waitForTimeout(800);
    f = ((await local(pg, 'vinted_annonce_numeros')) || {})['9201'] || {};
    dit(await pg.locator('[data-a-ecrire="9201"]').count() === 0 && f.reattribue && !!f.reattribue.ecrit && String(f.numero) === '40', `${tag} : « C'est écrit » range N°7 → N°40, le N° reste 40`, JSON.stringify(f.reattribue || null));
    // (5 nov.) Ce qui part au nuage : 40 et 41 posés à la main, 5 gardé, 7 et 3
    // toujours brûlés — jugé sur ce que la base a GARDÉ, pas seulement l'appareil.
    const nuageOk = () => { const n = (base.main && base.main.vinted_annonce_numeros) || {}; const p = ((base.main && base.main.vinted_used_numeros) || []).map(String); return String((n['9201'] || {}).numero) === '40' && !!(n['9201'] || {}).manuelAt && String((n['9203'] || {}).numero) === '41' && String((n['9202'] || {}).numero) === '5' && ['3', '7', '40', '41'].every((x) => p.includes(x)); };
    await attendre(nuageOk, 10000);
    { const n = (base.main && base.main.vinted_annonce_numeros) || {}; dit(ecritesMain(base).length > 0 && nuageOk(), `${tag} : le nuage garde 40 et 41 posés à la main, 5 inchangé, 3 et 7 brûlés`, `${ecritesMain(base).length} écriture(s) · ${JSON.stringify(Object.fromEntries(Object.entries(n).map(([k, e]) => [k, e && e.numero])))} · pool ${JSON.stringify((base.main || {}).vinted_used_numeros)}`); }
    dit(await pasDeCote(pg), `${tag} : aucune page qui défile de côté`);
    dit(errs.length === 0, `${tag} : aucune erreur d'app`, errs.join(' | ').slice(0, 200));
  } catch (e) { dit(false, `${tag} : le scénario B a tourné jusqu'au bout`, String(e && e.message).replace(/\x1b\[[0-9;]*m/g, '').slice(0, 900)); await capture(pg, `B-${largeur}-erreur`); }
  finally { await ctx.close(); }
}

(async () => {
  let b;
  await new Promise((res) => srv.listen(PORT, res));
  try {
    b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const largeur of [390, 1512]) for (const sombre of [false, true]) {
      await reglages(b, largeur, sombre);
      await annonces(b, largeur, sombre);
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu\'au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(`\nCaptures : ${CAPTURES}`);
  console.log(ko ? `\n❌ N° sur l'annonce / N° changé : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ N° sur l'annonce / N° changé : ${ok} contrôles verts`);
  process.exit(ko ? 1 : 0);
})();
