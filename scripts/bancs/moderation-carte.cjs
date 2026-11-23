require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « VINTED A AGI » REGROUPÉE (23 nov., lot moderation-carte — Julien, sur une
//  capture iPhone : « c'est moche »). src/AlerteModeration.jsx ; règle inchangée
//  (src/moderationVinted.js). Base INVENTÉE (dépôt public), servie par la règle de
//  table du mode exemple (src/exempleBase.js).
//   Les « disparues » d'un compte = UN groupe :
//    1. l'en-tête dit le compte et la fenêtre UNE fois (« 5 annonces disparues ·
//       shop_cancale », « entre le … et le … ») ; le nom du compte n'est écrit qu'une
//       fois par groupe ; aucune ligne ne répète la fenêtre ;
//    2. l'explication (« Aucune vente prouvée… ») UNE fois par groupe, sous « Pourquoi ? » ;
//    3. UN bouton « Vérifier sur Vinted » par groupe (il ouvre vinted.fr/inbox) ;
//    4. chaque ligne : la photo de SA fiche (identifiant), jamais celle d'une fiche au
//       même titre ; le N° ; « Vu » (44 px) qui la range dans `vrm_moderation_vu` ;
//    5. 30 disparues : 5 lignes, puis « Voir les 25 autres » ;
//    6. deux comptes : deux groupes, chacun son en-tête et son bouton ; « Tout est vu »
//       d'un groupe ne range que le sien ;
//    7. aucun orange ni ambre (couleurs CALCULÉES de chaque élément de la carte), aucun
//       trait de couleur sur le bord ; 390 tactile et 1512, clair et sombre.
//  Captures dans BANC_CAPTURES (à regarder : §6.2).
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), http = require('http'), fs = require('fs'), os = require('os');
const RACINE = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(RACINE, 'node_modules', 'playwright'));
const DIST = process.env.BANC_DIST || path.join(RACINE, 'dist');
const PORT = Number(process.env.BANC_PORT) || 4643;
const CAPTURES = process.env.BANC_CAPTURES || path.join(os.tmpdir(), 'banc-moderation-carte');
fs.mkdirSync(CAPTURES, { recursive: true });
const UID = '11111111-2222-3333-4444-555555555555';
const SESSION = { access_token: 'aaa.bbb.ccc', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: UID, email: 'vendeuse@exemple.test', created_at: '2025-01-10T10:00:00.000Z' } };
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const H = 3600e3;
const iso = (ilYa) => new Date(Date.now() - ilYa).toISOString();
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d ? ' — ' + String(d).slice(0, 400) : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String((e && e.stack) || e).split('\n').slice(0, 3).join(' ')); } };
let servirTable;
const ligne = (id, data) => ({ id, owner: UID, data, updated_at: iso(0) });
const compte = (uid, login) => ({ id: Number(uid), vinted_user_id: String(uid), login, domain: 'www.vinted.fr', owner: UID, updated_at: iso(0) });
const T = Date.now() - 2 * H;
const AV = T - 50 * H; // la lecture d'avant : deux jours plus tôt ⇒ « entre le … et le … »
// Une vignette inventée (une couleur par paire), servie en data: — jamais une adresse Vinted.
const vignette = (i) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="hsl(${(i * 47) % 360} 12% ${55 + (i % 4) * 8}%)"/><path d="M14 52c10-2 22-14 30-14s12 8 22 8v10H14z" fill="#fff" opacity=".85"/></svg>`);
const disp = (uid, id, dt = 0) => ({ k: `disparue:${id}:${T - dt}`, s: 'disparue', t: T - dt, a: String(id), av: AV });
const MOD = (uid, e) => ligne(`moderation_vinted_${uid}`, { uid: String(uid), v: '5.350.0', e });
// N disparues sur un compte ; les fiches : N° 132, 140, 157… + photo ; la DERNIÈRE n'a pas de fiche (pas de N°, pas de photo).
function jeu(uid, n, base = 0) {
  const evts = [], fiches = {};
  for (let i = 0; i < n; i++) {
    const id = 2000000 + base + i;
    evts.push(disp(uid, id, i * 60e3));
    if (i < n - 1 || n === 1) fiches[id] = { numero: String(132 + base + i * 3), numberedAt: iso(20 * 864e5), title: `Nike Air Max 90 blanche taille ${38 + (i % 8)}`, photo: vignette(base + i) };
  }
  return { evts, fiches };
}
// Une fiche LEURRE : même titre qu'une paire disparue sans fiche, autre identifiant, une photo. Elle ne doit JAMAIS servir.
const LEURRE_ID = '2999999';
const LEURRE_PHOTO = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#123"/></svg>');
function base({ comptes, lignesMod, fiches }) {
  return { app_data: { lignes: [
    ligne('main', { vrm_bienvenue_vue: { at: iso(30 * 864e5) }, vrm_visite: { at: iso(30 * 864e5), fin: 'fin' },
      vinted_annonce_numeros: { ...fiches, [LEURRE_ID]: { numero: '999', numberedAt: iso(20 * 864e5), title: 'Nike Air Max 90 blanche taille 38', photo: LEURRE_PHOTO } } }),
    ...comptes.map((c) => ligne(`harvest_${c.vinted_user_id}_listings`, { capturedAt: iso(1 * H), nItems: 2, payload: { items: [] } })),
    ...lignesMod] }, vinted_accounts: { lignes: comptes } };
}

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

async function ouvrir(nav, { b, largeur = 390, sombre = false }) {
  const mobile = largeur < 600;
  const ctx = await nav.newContext({ viewport: { width: largeur, height: mobile ? 844 : 950 }, isMobile: mobile, hasTouch: mobile, colorScheme: sombre ? 'dark' : 'light', deviceScaleFactor: mobile ? 2 : 1 });
  const pg = await ctx.newPage();
  const etat = { erreurs: [], ouverts: [] };
  pg.on('pageerror', (e) => etat.erreurs.push(e.message));
  ctx.on('page', (p) => { etat.ouverts.push(p.url()); p.on('framenavigated', (fr) => { if (fr === p.mainFrame()) etat.ouverts.push(fr.url()); }); });
  await pg.addInitScript(({ s, sombre }) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_mfa_plus_tard_' + s.user.id, String(Date.now())); localStorage.setItem('vinted_dark', sombre ? 'true' : 'false'); localStorage.setItem('vrm_bienvenue_vue', JSON.stringify({ at: new Date().toISOString() })); localStorage.setItem('vrm_parcours_plus_tard', JSON.stringify({ at: Date.now() })); } catch (_) {} }, { s: SESSION, sombre });
  await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (/vinted\.fr\/inbox/.test(r.request().url()) ? r.fulfill({ status: 200, contentType: 'text/html', body: '<p>inbox</p>' })
    : ['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.(net|fr)\//i.test(r.request().url()) ? r.abort() : r.continue()));
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...SESSION, expires_in: 3600, id: UID, email: SESSION.user.email, created_at: SESSION.user.created_at }) }));
  await pg.route('**/rest/v1/**', (r) => {
    const url = new URL(r.request().url()), m = r.request().method();
    if (/\/rpc\//.test(url.pathname)) return r.fulfill({ status: 200, contentType: 'application/json', body: 'true' });
    const t = url.pathname.slice('/rest/v1/'.length).split('/')[0];
    const table = b[t] || { lignes: [] };
    let corps = null; try { corps = r.request().postData() ? JSON.parse(r.request().postData()) : null; } catch (_) {}
    const x = servirTable(table, { methode: m, url: url.pathname + url.search, entetes: r.request().headers(), corps, owner: UID });
    return r.fulfill({ status: x.status, headers: x.headers, body: x.status === 204 || x.body == null ? '' : JSON.stringify(x.body) });
  });
  await pg.route('**/api/**', (r) => {
    const u = r.request().url();
    if (/mode=abonnement/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, actif: true, acces: true, statut: 'active', configure: false, obligatoire: false }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, etat };
}
const CARTE = '[data-moderation]';
const attendre = (pg, ms = 25000) => pg.locator(CARTE).first().waitFor({ timeout: ms }).then(() => true).catch(() => false);
// L'écran tel qu'il s'ouvre, puis la carte entière (élément).
const capture = async (pg, nom) => { await pg.evaluate(() => window.scrollTo(0, 0)).catch(() => {}); await pg.screenshot({ path: path.join(CAPTURES, `moderation-carte-${nom}.png`) }).catch(() => {}); await pg.locator(CARTE).first().screenshot({ path: path.join(CAPTURES, `moderation-carte-${nom}-carte.png`) }).catch(() => {}); };

// Toutes les couleurs CALCULÉES de la carte (texte, fond, bords, ombre) : aucune n'est orange / ambre / brune.
// Orange = teinte 10°–60°, saturation ≥ 0,30, pas presque blanc ni presque noir.
const couleursOrange = (pg) => pg.evaluate((sel) => {
  const carte = document.querySelector(sel); if (!carte) return ['(pas de carte)'];
  const rgb = (s) => [...String(s).matchAll(/rgba?\(([^)]+)\)/g)].map((m) => m[1].split(/[ ,/]+/).filter(Boolean).map(Number));
  const orange = ([r, g, b, a = 1]) => {
    if (a < 0.15) return false;
    const R = r / 255, G = g / 255, B = b / 255, mx = Math.max(R, G, B), mn = Math.min(R, G, B), l = (mx + mn) / 2, d = mx - mn;
    if (d < 1e-6 || l > 0.97 || l < 0.08) return false;
    const s = d / (1 - Math.abs(2 * l - 1));
    let h = mx === R ? ((G - B) / d) % 6 : mx === G ? (B - R) / d + 2 : (R - G) / d + 4; h *= 60; if (h < 0) h += 360;
    return s >= 0.30 && h >= 10 && h <= 60;
  };
  const out = [];
  for (const el of [carte, ...carte.querySelectorAll('*')]) {
    if (!el.getClientRects().length) continue;
    const cs = getComputedStyle(el);
    const props = ['color', 'backgroundColor', 'boxShadow'];
    for (const cote of ['Top', 'Right', 'Bottom', 'Left']) if (parseFloat(cs[`border${cote}Width`]) > 0) props.push(`border${cote}Color`);
    for (const p of props) for (const c of rgb(cs[p])) if (orange(c)) out.push(`${el.className || el.tagName}.${p}=${cs[p]}`);
  }
  return out;
}, CARTE);
const bordCouleur = (pg) => pg.evaluate((sel) => { const c = document.querySelector(sel); const cs = getComputedStyle(c); return Math.max(...['Top', 'Right', 'Bottom', 'Left'].map((k) => parseFloat(cs[`border${k}Width`]) || 0)); }, CARTE);
const cibles44 = (pg) => pg.evaluate((sel) => { const p = [...document.querySelectorAll(`${sel} button, ${sel} a, ${sel} summary`)].filter((e) => e.getClientRects().length && e.getBoundingClientRect().height < 43.5); return p.length ? p.length + ' : ' + p.slice(0, 3).map((e) => (e.getAttribute('class') || e.tagName) + '=' + Math.round(e.getBoundingClientRect().height) + 'px').join(', ') : 0; }, CARTE);
const occurrences = (txt, mot) => (String(txt).match(new RegExp(mot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;

// Les règles communes à chaque groupe.
async function verifierGroupes(pg, nom, attendus) {
  const c = pg.locator(CARTE).first();
  const g = c.locator('[data-moderation-groupe="disparue"]');
  dit((await g.count()) === attendus.length, `${nom} : ${attendus.length} groupe(s) de disparues (un par compte)`, String(await g.count()));
  const texteCarte = await c.innerText();
  const contenuCarte = await c.textContent();
  for (const [i, a] of attendus.entries()) {
    const gi = c.locator(`[data-moderation-groupe="disparue"][data-moderation-compte="${a.uid}"]`);
    if (!(await gi.count())) { dit(false, `${nom} : groupe ${a.login} présent`); continue; }
    dit(Number(await gi.getAttribute('data-moderation-n')) === a.n, `${nom} : groupe ${a.login} : ${a.n} disparue(s)`, await gi.getAttribute('data-moderation-n'));
    // 1. le compte UNE fois (par groupe) ; l'en-tête au pluriel.
    // (hors des lignes d'une AUTRE sorte — une masquée dit son compte sur sa ligne)
    const texteDisparues = await pg.evaluate((sel) => { const c = document.querySelector(sel).cloneNode(true); c.querySelectorAll('.vrm-moderation-ligne').forEach((x) => x.remove()); document.body.appendChild(c); const t = c.innerText; c.remove(); return t; }, CARTE);
    dit(occurrences(texteDisparues, a.login) === 1, `${nom} : « ${a.login} » écrit une seule fois pour ses disparues`, String(occurrences(texteDisparues, a.login)));
    const enTete = new RegExp(`${a.n} annonces? disparues?[ \u00a0]·[ \u00a0]${a.login}`);
    dit(enTete.test(texteCarte), `${nom} : en-tête « ${a.n} annonce(s) disparue(s) · ${a.login} »`, texteCarte.slice(0, 200));
    // La fenêtre : une fois par groupe, jamais sur une ligne.
    dit((await gi.locator('[data-moderation-fenetre]').count()) === 1 && /entre le .+ et le /.test(await gi.locator('[data-moderation-fenetre]').innerText()), `${nom} : ${a.login} : la fenêtre dite une fois (« entre le … et le … »)`, (await gi.locator('[data-moderation-fenetre]').count()) ? await gi.locator('[data-moderation-fenetre]').innerText() : '');
    const lignesTxt = await gi.locator('[data-moderation-sorte="disparue"]').allInnerTexts();
    dit(lignesTxt.every((t) => !/entre le|vue |·|Vinted|vente/i.test(t)), `${nom} : ${a.login} : aucune ligne ne répète compte, fenêtre ou explication`, lignesTxt.find((t) => /entre le|vue |·|Vinted|vente/i.test(t)));
    // 2. l'explication UNE fois, sous « Pourquoi ? » (repliée).
    dit((await gi.locator('[data-moderation-pourquoi="disparue"]').count()) === 1, `${nom} : ${a.login} : un seul « Pourquoi ? »`, String(await gi.locator('[data-moderation-pourquoi="disparue"]').count()));
    dit(occurrences(await gi.textContent(), 'Aucune vente prouvée') === 1, `${nom} : ${a.login} : l’explication « Aucune vente prouvée » une seule fois`, String(occurrences(await gi.textContent(), 'Aucune vente prouvée')));
    // 3. UN bouton « Vérifier sur Vinted ».
    const geste = gi.locator('[data-moderation-geste="disparue"]');
    dit((await geste.count()) === 1 && /Vérifier sur Vinted/.test(await geste.innerText()), `${nom} : ${a.login} : UN bouton « Vérifier sur Vinted »`, String(await geste.count()));
    if (i === 0) dit(occurrences(contenuCarte, 'Vérifie tes messages Vinted') === 0, `${nom} : l’ancienne pilule « Vérifie tes messages Vinted » n’est plus sur les lignes`);
  }
}

async function scenario(nav, { cas, largeur, sombre }) {
  const nom = `${cas}-${largeur}-${sombre ? 'sombre' : 'clair'}`;
  console.log(`\n${nom}`);
  let comptes, lignesMod, fiches, attendus, sansFiche;
  if (cas === 'deux') {
    const a = jeu(111, 3, 0), b = jeu(222, 2, 100);
    comptes = [compte(111, 'shop_cancale'), compte(222, 'paris_sneak')];
    const masq = { k: `masquee:2000500:${T}`, s: 'masquee', t: T + 1000, a: '2000500', av: AV, ti: 'Asics Gel 1130', ta: '41' };
    lignesMod = [MOD(111, [...a.evts, masq]), MOD(222, b.evts)];
    fiches = { ...a.fiches, ...b.fiches };
    attendus = [{ uid: '111', login: 'shop_cancale', n: 3 }, { uid: '222', login: 'paris_sneak', n: 2 }];
    sansFiche = a.evts[a.evts.length - 1].a;
  } else {
    const n = Number(cas.replace('n', ''));
    const a = jeu(111, n, 0);
    comptes = [compte(111, 'shop_cancale')];
    lignesMod = [MOD(111, a.evts)];
    fiches = a.fiches;
    attendus = [{ uid: '111', login: 'shop_cancale', n }];
    sansFiche = n > 1 ? a.evts[a.evts.length - 1].a : null;
  }
  const total = attendus.reduce((s, x) => s + x.n, 0) + (cas === 'deux' ? 1 : 0);
  const { ctx, pg, etat } = await ouvrir(nav, { b: base({ comptes, lignesMod, fiches }), largeur, sombre });
  try {
    dit(await attendre(pg), `${nom} : la carte paraît`);
    await pg.waitForTimeout(1500);
    const c = pg.locator(CARTE).first();
    dit(Number(await c.getAttribute('data-moderation')) === total, `${nom} : ${total} alerte(s)`, await c.getAttribute('data-moderation'));
    await verifierGroupes(pg, nom, attendus);
    // 4. lignes : photo par IDENTITÉ, N°.
    const g0 = c.locator('[data-moderation-groupe="disparue"]').first();
    const l0 = g0.locator('[data-moderation-sorte="disparue"]').first();
    const id0 = await l0.getAttribute('data-moderation-item');
    const src0 = await l0.locator('img').getAttribute('src').catch(() => null);
    dit(!!src0 && fiches[id0] && src0 === fiches[id0].photo, `${nom} : la vignette est celle de SA fiche (identifiant ${id0})`, String(src0).slice(0, 60));
    dit(/^N°\d+$/.test((await l0.locator('[data-moderation-num]').innerText()).trim()) && (await l0.locator('[data-moderation-num]').innerText()).trim() === 'N°' + fiches[id0].numero, `${nom} : le N° de SA fiche`, await l0.innerText());
    if (sansFiche) {
      if (attendus[0].n > 5) await g0.locator('[data-moderation-plus]').click();
      const ls = c.locator(`[data-moderation-sorte="disparue"][data-moderation-item="${sansFiche}"]`);
      await pg.waitForTimeout(200);
      dit((await ls.count()) === 1 && (await ls.getAttribute('data-moderation-photo')) === '0' && (await ls.locator('img').count()) === 0 && !/N°/.test(await ls.innerText()) && new RegExp(sansFiche).test(await ls.innerText()),
        `${nom} : sans fiche ⇒ ni photo ni N° (la fiche LEURRE au même titre ne sert jamais), l’identifiant`, (await ls.count()) ? await ls.innerText() : 'absente');
      const leurre = await pg.evaluate((p) => [...document.querySelectorAll('[data-moderation] img')].some((i) => i.getAttribute('src') === p), LEURRE_PHOTO);
      dit(!leurre, `${nom} : la photo de la fiche leurre n’apparaît nulle part`);
    }
    // 5. trente : 5 lignes puis « Voir les 25 autres ».
    if (cas === 'n30') {
      // (la ligne sans fiche a déjà ouvert la liste ci-dessus) — on recharge l'état replié pour la capture.
      dit((await g0.locator('[data-moderation-sorte="disparue"]').count()) === 30, `${nom} : « Voir les 25 autres » ⇒ les 30 lignes`, String(await g0.locator('[data-moderation-sorte="disparue"]').count()));
    }
    // 7. couleurs.
    const oranges = await couleursOrange(pg);
    dit(!oranges.length, `${nom} : aucune couleur orange / ambre (couleurs calculées)`, oranges.slice(0, 4).join(' ; '));
    dit((await bordCouleur(pg)) <= 1, `${nom} : aucun trait de couleur sur le bord de la carte`, String(await bordCouleur(pg)));
    dit((await cibles44(pg)) === 0, `${nom} : cibles de 44 px`, String(await cibles44(pg)));
    dit(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${nom} : pas de débordement horizontal`);
    if (cas === 'n30') { await pg.reload({ waitUntil: 'domcontentloaded' }); await attendre(pg); await pg.waitForTimeout(1500);
      dit((await pg.locator('[data-moderation-groupe="disparue"] [data-moderation-sorte="disparue"]').count()) === 5 && /Voir les 25 autres/.test(await pg.locator('[data-moderation-plus]').innerText()), `${nom} : repliée : 5 lignes et « Voir les 25 autres »`); }
    await capture(pg, nom);
    // « Pourquoi ? » ouvert : l'explication lisible.
    if (cas === 'n5' && !sombre) {
      await pg.locator('[data-moderation-pourquoi] summary').first().click();
      await pg.waitForTimeout(250);
      dit(/Aucune vente prouvée/.test(await pg.locator('[data-moderation-pourquoi]').first().innerText()), `${nom} : « Pourquoi ? » ouvert ⇒ l’explication`);
      await capture(pg, nom + '-pourquoi');
      // Le bouton ouvre la messagerie Vinted.
      const avant = etat.ouverts.length;
      await pg.locator('[data-moderation-geste="disparue"]').first().click();
      await pg.waitForTimeout(1200);
      dit(etat.ouverts.slice(avant).some((u) => /^https:\/\/www\.vinted\.fr\/inbox/.test(u)), `${nom} : « Vérifier sur Vinted » ouvre vinted.fr/inbox`, etat.ouverts.slice(avant).join(' '));
      // « Vu » d'une ligne : elle sort, rangée dans vrm_moderation_vu (la règle d'avant).
      const cle = await pg.locator('[data-moderation-groupe] [data-moderation-vu]').first().getAttribute('data-moderation-vu');
      await pg.locator('[data-moderation-groupe] [data-moderation-vu]').first().click();
      await pg.waitForTimeout(700);
      dit(Number(await pg.locator(CARTE).getAttribute('data-moderation')) === 4 && /4 annonces disparues[ \u00a0]·[ \u00a0]shop_cancale/.test(await pg.locator(CARTE).innerText()), `${nom} : « Vu » ⇒ la ligne sort (4 restantes, en-tête à jour)`);
      const vu = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_moderation_vu') || '{}'); } catch (_) { return {}; } });
      dit(Object.prototype.hasOwnProperty.call(vu, cle), `${nom} : rangée dans vrm_moderation_vu`, JSON.stringify(vu).slice(0, 120));
    }
    // 6. deux comptes : « Tout est vu » d'un groupe ne range que le sien.
    if (cas === 'deux' && largeur === 390 && !sombre) {
      await pg.locator('[data-moderation-groupe-vu="222"]').click();
      await pg.waitForTimeout(700);
      dit((await pg.locator('[data-moderation-groupe="disparue"][data-moderation-compte="222"]').count()) === 0 && (await pg.locator('[data-moderation-groupe="disparue"][data-moderation-compte="111"]').count()) === 1 && Number(await pg.locator(CARTE).getAttribute('data-moderation')) === 4,
        `${nom} : « Tout est vu » de paris_sneak ne range que ce groupe`);
    }
    dit(!etat.erreurs.length, `${nom} : aucune erreur d’app`, etat.erreurs.join(' | ').slice(0, 300));
  } finally { await ctx.close(); }
}

(async () => {
  let nav;
  try {
    ({ servirTable } = await import('file://' + path.join(RACINE, 'src', 'exempleBase.js')));
    await new Promise((okk) => srv.listen(PORT, okk));
    nav = await chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const seul = (process.env.BANC_SEUL || '').split(',').filter(Boolean);
    for (const cas of ['n1', 'n5', 'n30', 'deux']) {
      if (seul.length && !seul.includes(cas)) continue;
      for (const [largeur, sombre] of [[390, false], [1512, false], [390, true], [1512, true]]) await essaie(`${cas}-${largeur}`, () => scenario(nav, { cas, largeur, sombre }));
    }
  } finally {
    if (nav) await nav.close();
    srv.close();
    console.log(`\n${ok} vert(s), ${ko} rouge(s) · captures : ${CAPTURES}`);
    process.exit(ko ? 1 : 0);
  }
})();
