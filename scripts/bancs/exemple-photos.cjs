require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « LE MODE EXEMPLE NE SE CONFOND PLUS, ET IL A SES PHOTOS » (14 nov.)
//
//  Julien, devant l'exemple sur ordinateur : « fais des exemples avec des photos
//  pour les annonces », et il a cru que « Le Fournil, Rennes » était un de SES
//  colis. On entre comme un visiteur (lien `/?exemple`, aucune session), puis :
//  B1  sur CHAQUE écran : le bandeau « Exemple — données inventées » dans l'écran,
//      le cadre hachuré et sa languette « Exemple · données inventées » au-dessus
//      de TOUT (aucun élément de la page plus haut), sans prendre un toucher ;
//  B2  une feuille ouverte (la loupe) : le cadre reste au-dessus ;
//  B3  Achats « À retirer » (où vivent les colis à retirer) : chaque code et chaque adresse inventés portent la marque
//      « exemple » (posée par la feuille de style, hors du texte copié) ;
//  B4  le lieu est manifestement fictif : « Relais Exemple », plus aucun
//      « Le Fournil » ni « rue de la Paix » ;
//  C1  « J'ai déjà un compte · Me connecter » à côté de « Créer mon compte », 44 px
//      au doigt, rien ne le couvre ; il mène à la connexion (`?connexion`, le
//      formulaire « in »), l'exemple disparaît, aucune session dans le vrai stockage ;
//  W1  pendant l'exemple : AUCUNE requête vers la base ni /api, AUCUNE écriture
//      (méthode autre que GET/HEAD) vers aucun hôte ;
//  P1  Annonces, Ventes, Achats, Colis : chaque rangée d'article a une IMAGE
//      chargée (servie par /exemple/), aucune vignette neutre — ROUGE tant que
//      src/exemplePhotos.js est vide (les photos n'ont pas pu être récupérées le
//      14 nov., voir docs/passation/2026-11-14-exemple-photos.md).
//  Toujours : rien ne déborde, aucune erreur JS.
//  `SHOTS=dossier` range les captures (à REGARDER, §6.2). `LARGEURS=390,1512` /
//  `THEMES=clair,sombre` restreignent ; `SANS_PHOTOS=1` saute P1.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), http = require('http'), fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 10191;
const SHOTS = process.env.SHOTS || '';
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.md': 'text/markdown' };
const ECRANS = ['journee', 'annonces', 'ventes', 'achats', 'cat_bord', 'messages', 'stockvinted', 'compta', 'settings'];
const AVEC_PHOTOS = ['annonces', 'ventes', 'achats', 'cat_bord'];

let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det ? ' — ' + String(det).slice(0, 400) : ''}`); };

const srv = http.createServer((q, r) => {
  let f = decodeURIComponent(q.url.split('?')[0]); if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!p.startsWith(DIST) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

async function appareil(nav, { W, sombre }) {
  const tel = W < 600;
  const ctx = await nav.newContext({ ...(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1512, height: 950 } }), colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const pg = await ctx.newPage();
  const journal = { erreurs: [], base: [], ecritures: [], phase: 'avant' };
  pg.on('pageerror', (e) => journal.erreurs.push(String(e.message || e).slice(0, 240)));
  await pg.addInitScript((sombre) => { try { if (!sessionStorage.getItem('banc_init')) { localStorage.setItem('vinted_dark', sombre ? 'true' : 'false'); sessionStorage.setItem('banc_init', '1'); } } catch (_) {} }, sombre);
  pg.on('framenavigated', (f) => { if (f === pg.mainFrame()) journal.phase = journal.prochaine || journal.phase; });
  // Toute requête qui SORT de la page (le navigateur la voit) : une écriture est comptée, où qu'elle aille.
  pg.on('request', (q) => { const m = q.method(); if (m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS' && !/^data:|^blob:/.test(q.url())) journal.ecritures.push({ phase: journal.phase, m, u: q.url().slice(0, 120) }); });
  await pg.route(/supabase\.co/i, (r) => {
    journal.base.push({ phase: journal.phase, m: r.request().method(), u: r.request().url().replace(/^https?:\/\/[^/]+/, '').slice(0, 120) });
    const u = r.request().url();
    if (/\/auth\/v1\/settings/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ external: { email: true }, disable_signup: false }) });
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': '0-0/0' }, body: '[]' });
  });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)(?!.*supabase\.co)/i, (r) => r.abort());
  await pg.route('**/api/**', (r) => { journal.base.push({ phase: journal.phase, m: r.request().method(), u: r.request().url().replace(/^https?:\/\/[^/]+/, '').slice(0, 120) }); return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }); });
  return { ctx, pg, journal, tel };
}
async function capture(pg, nom) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await pg.waitForTimeout(300);
  await pg.screenshot({ path: path.join(SHOTS, nom + '.png') });
}
// Une navigation qu'un geste précédent de la page (Échap, loupe) interrompt (ERR_ABORTED) : on la refait une fois.
const aller = async (pg, url, o) => { try { return await pg.goto(url, o); } catch (e) { if (!/ERR_ABORTED|interrupted/.test(String(e))) throw e; await pg.waitForTimeout(500); return pg.goto(url, o); } };
// L'écran de démarrage (#vrm-demarrage, z 2147483000) couvre tout tant que l'écran charge : on attend qu'il parte
// (sur une condition, jamais un délai fixe) — sinon « rien ne couvre » jugerait le chargement, pas la page.
const sansDemarrage = (pg) => pg.waitForFunction(() => { const d = document.getElementById('vrm-demarrage'); return !d || d.hasAttribute('data-sortie'); }, null, { timeout: 20000 }).then(() => pg.waitForTimeout(300)).catch(() => {});
const attendre = async (pg, f, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await f().catch(() => false)) return true; await pg.waitForTimeout(250); } return false; };

// Le bandeau, le cadre et sa languette : visibles, et le cadre au-dessus de TOUT.
const marques = (pg) => pg.evaluate(() => {
  const vis = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { top: b.top, bas: b.bottom, g: b.left, d: b.right, h: b.height, w: b.width, visible: b.width > 0 && b.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0 }; };
  const band = document.querySelector('[data-exemple-bandeau]');
  const cadre = document.querySelector('[data-exemple-cadre]');
  const mot = cadre && cadre.querySelector('.vrm-exemple-cadre-mot');
  const zc = cadre ? Number(getComputedStyle(cadre).zIndex) || 0 : -1;
  let zMax = 0, plusHaut = '';
  for (const e of document.body.querySelectorAll('*')) {
    if (cadre && (e === cadre || cadre.contains(e))) continue;
    const cs = getComputedStyle(e); if (cs.position === 'static') continue;
    const z = Number(cs.zIndex); if (Number.isFinite(z) && z >= zMax) { zMax = z; plusHaut = (e.className && String(e.className).slice(0, 40)) || e.tagName; }
  }
  const cs = cadre ? getComputedStyle(cadre) : null;
  return { bandeau: vis(band), texte: band ? band.innerText.replace(/\s+/g, ' ').trim() : '', cadre: vis(cadre), mot: vis(mot), motTexte: mot ? mot.textContent : '',
    zCadre: zc, zMax, plusHaut, toucher: cs ? cs.pointerEvents : '', fixe: cs ? cs.position : '', dansBody: !!cadre && cadre.parentElement === document.body, vw: innerWidth, vh: innerHeight };
});
// Les rangées d'article de l'écran : chacune a-t-elle une image chargée ? On compte les
// TITRES d'article affichés (« … taille 42 », la forme des titres de l'exemple) et les
// photos d'exemple chargées, distinctes : il faut au moins une photo par titre, et
// aucune vignette neutre (`data-sans-photo`).
const rangees = (pg) => pg.evaluate(() => {
  const m = document.querySelector('.vrm-main'); if (!m) return { titres: 0, sans: 0, chargees: 0, exemple: 0 };
  const vis = (e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
  const sans = [...m.querySelectorAll('[data-sans-photo]')].filter(vis).length;
  const imgs = [...m.querySelectorAll('img')].filter((i) => vis(i) && /\/exemple\//.test(i.currentSrc || i.src));
  const titres = new Set([...m.querySelectorAll('*')].filter((e) => !e.children.length && vis(e) && /^.{3,90} taille \d\d$/.test(e.textContent.trim())).map((e) => e.textContent.trim()));
  const ok = new Set(imgs.filter((i) => i.complete && i.naturalWidth > 0).map((i) => i.currentSrc || i.src));
  return { titres: titres.size, sans, exemple: imgs.length, chargees: ok.size };
});
// La marque « exemple » posée sur les codes et les adresses inventés (::after).
const marquesCodes = (pg) => pg.evaluate(() => {
  const els = [...document.querySelectorAll('[data-stream-type="code"], [data-stream-type="adresse"], .vrm-rp-code, [data-relais-adresse], [data-rp-code-visible]:not([data-rp-code-visible="qr"], [data-rp-code-visible="desaccord"])')]
    .filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; });
  return els.map((e) => ({ quoi: (e.getAttribute('data-stream-type') || e.className || '').toString().slice(0, 30), txt: e.textContent.trim().slice(0, 40), apres: getComputedStyle(e, (e.matches('[data-stream-type="adresse"], [data-relais-adresse]') ? '::before' : '::after')).content }));
});

async function parcours(nav, W, theme) {
  const sombre = theme === 'sombre', T = `[${W}px ${theme}]`;
  const o = await appareil(nav, { W, sombre });
  o.journal.prochaine = 'exemple';
  await o.pg.goto(`http://localhost:${PORT}/?exemple`, { waitUntil: 'domcontentloaded' });
  await o.pg.waitForSelector('[data-exemple-bandeau]', { timeout: 25000 }).catch(() => {});
  await o.pg.waitForSelector('.vrm-main', { timeout: 25000 }).catch(() => {}); await sansDemarrage(o.pg);
  await o.pg.waitForTimeout(2500);
  const actif = await o.pg.evaluate(() => (typeof window.__vrmExemple === 'function' ? window.__vrmExemple().actif : false));
  dit(actif, `${T} le lien /?exemple ouvre l'app EN MODE EXEMPLE`);
  if (!actif) { await o.ctx.close(); return; }

  for (const tab of ECRANS) {
    await aller(o.pg, `http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
    await o.pg.waitForSelector('[data-exemple-bandeau]', { timeout: 20000 }).catch(() => {});
    await o.pg.waitForSelector('.vrm-main', { timeout: 20000 }).catch(() => {}); await sansDemarrage(o.pg);
    await o.pg.waitForTimeout(2200);
    const k = await marques(o.pg);
    const b = k.bandeau;
    dit(b && b.visible && b.top >= -1 && b.bas <= k.vh && b.h > 30 && /Exemple — données inventées/.test(k.texte), `${T} B1 ${tab} : le bandeau « Exemple — données inventées » est dans l'écran`, JSON.stringify({ b, t: k.texte }));
    dit(k.cadre && k.cadre.visible && k.fixe === 'fixed' && k.dansBody && Math.abs(k.cadre.w - k.vw) < 2 && Math.abs(k.cadre.h - k.vh) < 2 && k.toucher === 'none', `${T} B1 ${tab} : le cadre couvre tout l'écran, fixe, sans prendre un toucher`, JSON.stringify(k));
    dit(k.mot && k.mot.visible && k.mot.top >= -1 && /Exemple · données inventées/i.test(k.motTexte), `${T} B1 ${tab} : la languette « Exemple · données inventées » est visible`, JSON.stringify(k.mot));
    dit(k.zCadre > k.zMax, `${T} B1 ${tab} : le cadre est au-dessus de TOUT (z ${k.zCadre} > ${k.zMax}, ${k.plusHaut})`);
    if (AVEC_PHOTOS.includes(tab) && !process.env.SANS_PHOTOS) {
      await o.pg.waitForTimeout(800);
      const r = await rangees(o.pg);
      dit(r.titres > 0 && r.sans === 0 && r.chargees >= r.titres, `${T} P1 ${tab} : chaque rangée a une image chargée (${r.chargees} photos d’exemple chargées pour ${r.titres} articles, ${r.sans} vignette(s) neutre(s))`, JSON.stringify(r));
    }
    if (tab === 'achats') {   // (Colis vit dans Ventes « À envoyer » et Achats « À retirer » : les codes et les points sont ici)
      // Le code ne s'écrit qu'à l'ouverture de la ligne : on ouvre le premier colis « à retirer ».
      await o.pg.evaluate(() => { const b = document.querySelector('.vrm-rpf-ouvrir'); if (b) b.scrollIntoView({ block: 'center' }); });
      await o.pg.click('.vrm-rpf-ouvrir').catch(() => {});
      await o.pg.waitForTimeout(700);
      const c = await marquesCodes(o.pg);
      const codes = c.filter((x) => !/adresse|vrm-rpf-adr/.test(x.quoi));
      dit(c.length > 0 && c.every((x) => /exemple/i.test(x.apres)), `${T} B3 ${tab} : chaque code et chaque adresse inventés portent « exemple » (${c.length})`, JSON.stringify(c.slice(0, 6)));
      dit(codes.length > 0, `${T} B3 ${tab} : un code de retrait ouvert est bien à l'écran (${codes.length})`, JSON.stringify(c.slice(0, 6)));
      await capture(o.pg, `ph-${W}-${theme}-${tab}-code`);
    }
    const corps = await o.pg.evaluate(() => document.body.innerText);
    dit(!/Fournil|rue de la Paix/i.test(corps), `${T} B4 ${tab} : aucun lieu qui ressemble à un vrai commerce`);
    if (tab === 'achats') dit(/Relais Exemple/.test(corps), `${T} B4 Achats « À retirer » : le point relais s'appelle « Relais Exemple »`, corps.slice(0, 300));
    dit(!(await o.pg.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)), `${T} ${tab} : rien ne déborde`);
    await capture(o.pg, `ph-${W}-${theme}-${tab}`);
  }

  // B2 : une feuille ouverte (la loupe, Ctrl/⌘ K sur ordinateur, l'icône au téléphone).
  await aller(o.pg, `http://localhost:${PORT}/?tab=ventes`, { waitUntil: 'domcontentloaded' });
  await o.pg.waitForSelector('[data-exemple-bandeau]', { timeout: 20000 }).catch(() => {}); await sansDemarrage(o.pg);
  await o.pg.waitForTimeout(1800);
  if (o.tel) await o.pg.click('[data-recherche-loupe]').catch(() => {}); else await o.pg.keyboard.press('Control+k').catch(() => {});
  await o.pg.waitForTimeout(900);
  const kf = await marques(o.pg);
  dit(kf.mot && kf.mot.visible && kf.zCadre > kf.zMax, `${T} B2 la loupe ouverte : la languette reste au-dessus (z ${kf.zCadre} > ${kf.zMax}, ${kf.plusHaut})`, JSON.stringify(kf.mot));
  await capture(o.pg, `ph-${W}-${theme}-loupe`);
  await o.pg.keyboard.press('Escape').catch(() => {});

  // W1 : rien n'est sorti pendant l'exemple.
  const versBase = o.journal.base.filter((r) => r.phase === 'exemple');
  const ecrites = o.journal.ecritures.filter((r) => r.phase === 'exemple');
  dit(versBase.length === 0, `${T} W1 AUCUNE requête vers la base ni /api pendant l'exemple`, JSON.stringify(versBase.slice(0, 5)));
  dit(ecrites.length === 0, `${T} W1 AUCUNE écriture (POST/PATCH/PUT/DELETE) n'est sortie de la page`, JSON.stringify(ecrites.slice(0, 5)));

  // C1 : « J'ai déjà un compte · Me connecter ».
  await aller(o.pg, `http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
  await o.pg.waitForSelector('[data-exemple-bandeau]', { timeout: 20000 }).catch(() => {}); await sansDemarrage(o.pg);
  await o.pg.waitForTimeout(1500);
  const lien = await o.pg.evaluate(() => {
    const e = document.querySelector('[data-exemple-bandeau] [data-exemple-connexion]'); const c = document.querySelector('[data-exemple-bandeau] [data-exemple-brancher]');
    if (!e) return null;
    const b = e.getBoundingClientRect(), bc = c ? c.getBoundingClientRect() : null;
    const x = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return { texte: e.textContent.trim(), h: b.height, libre: !!x && (x === e || e.contains(x)), dessus: x && !(x === e || e.contains(x)) ? (x.tagName + "." + String(x.className).slice(0, 60)) : "", creer: c ? c.textContent.trim() : '', ecart: bc ? Math.hypot((b.left + b.right) / 2 - (bc.left + bc.right) / 2, (b.top + b.bottom) / 2 - (bc.top + bc.bottom) / 2) : 9999 };
  });
  dit(lien && lien.texte === 'J’ai déjà un compte · Me connecter' && lien.creer === 'Créer mon compte', `${T} C1 « J’ai déjà un compte · Me connecter » à côté de « Créer mon compte »`, JSON.stringify(lien));
  dit(lien && lien.libre && lien.h >= 43.5 && lien.ecart < 320, `${T} C1 « Me connecter » : 44 px, rien ne le couvre, près de « Créer mon compte »`, JSON.stringify(lien));
  await capture(o.pg, `ph-${W}-${theme}-bandeau`);
  if (lien) {
    o.journal.prochaine = 'apres';
    await Promise.all([o.pg.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}), o.pg.click('[data-exemple-connexion]')]);
    await o.pg.waitForSelector('[data-auth-valider]', { timeout: 20000 }).catch(() => {});
    await o.pg.waitForTimeout(1200);
    const apres = await o.pg.evaluate(() => ({ url: location.href, bandeau: !!document.querySelector('[data-exemple-bandeau]'), cadre: !!document.querySelector('[data-exemple-cadre]'), racine: document.documentElement.hasAttribute('data-vrm-exemple'),
      valider: (document.querySelector('[data-auth-valider]') || {}).textContent || '', session: (() => { try { return localStorage.getItem('vrm_session'); } catch (_) { return 'illisible'; } })(), cle: sessionStorage.getItem('vrm_mode_exemple') }));
    dit(/[?&]connexion/.test(apres.url) && !!apres.valider && !/Créer/i.test(apres.valider), `${T} C1 « Me connecter » ⇒ l'écran de connexion`, JSON.stringify(apres));
    dit(!apres.bandeau && !apres.cadre && !apres.racine && apres.cle == null && apres.session == null, `${T} C1 l'exemple a disparu (bandeau, cadre, clé de l'onglet) et aucune session dans le vrai stockage`, JSON.stringify(apres));
    await capture(o.pg, `ph-${W}-${theme}-connexion`);
  }
  dit(!o.journal.erreurs.length, `${T} aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
  await o.ctx.close();
}

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.log('KO  dist/ absent : npm run build'); process.exit(1); }
  await new Promise((ok) => srv.listen(PORT, ok));
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try { for (const W of LARGEURS) for (const theme of THEMES) await parcours(nav, W, theme); }
  catch (e) { dit(false, 'le banc a rencontré une erreur', e && e.stack); }
  await nav.close(); srv.close();
  console.log(ko ? `\n❌ exemple-photos : ${ko} KO` : '\n✅ exemple-photos : rien à signaler');
  process.exit(ko ? 1 : 0);
})();
