// ════════════════════════════════════════════════════════════════════════════
//  BANC « PETITS PLUS » (5 novembre) — la page d'accueil et le guide iPhone,
//  RENDUS. Données INVENTÉES (aucune `fx/`) : un visiteur sans session pour la
//  page publique ; un vendeur fictif sans aucune donnée pour Paramètres.
//
//  A. LA PAGE D'ACCUEIL (390 tactile, 1512 ; clair et sombre du système) :
//     A1 le premier écran nomme chaque navigateur servi (`data-navigateurs`) et
//        dit qu'il faut un ordinateur ; A2 aucune forme « Chrome obligatoire »
//        dans le texte rendu ; A3 Orion « en essai », Safari « pas encore » ;
//        A4 « ton ordinateur reste nécessaire » ; A5 rien ne déborde de côté ;
//        A6 aucun texte de ces lignes sous 12 px.
//  I. LE GUIDE « INSTALLER VRM SUR L'IPHONE » (Paramètres → Notifications du
//     téléphone), agent iPhone SAFARI (sans `PushManager`, comme iOS dans un
//     onglet), 390 × 844 tactile, clair et sombre (`vinted_dark`) :
//     I1 visible, trois étapes, chacune avec un dessin de taille réelle ;
//     I2 rien ne déborde (le guide, la page) ; textes ≥ 12 px ;
//     I3 la croix fait ≥ 44 × 44 px et le doigt tombe sur elle ;
//     I4 la ligne « Partager → Sur l'écran d'accueil » ne double pas le guide,
//        et revient une fois le guide fermé ;
//     I5 fermé : il disparaît, et reste fermé après rechargement ;
//     I6 en sombre : fond et encre du thème sombre (pas le clair) ;
//     I7 iPhone couché (844 × 390) : trois colonnes côte à côte, sans débord ;
//     I8 JAMAIS : app installée (`navigator.standalone`), Chrome sur iPhone
//        (CriOS), Orion (`window.KAGI`), ordinateur à 1512 px.
//  `BANC_PORT` (défaut 8931, plage 8900–8949), `CAPTURES=<dossier>`,
//  `BANC_PARTIE=A|I`. Construire `dist/` d'abord (`npm run build`).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 8931;
const CAPTURES = process.env.CAPTURES || '';
const PARTIE = process.env.BANC_PARTIE || '';

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d !== undefined ? ' — ' + String(d).slice(0, 300) : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'a levé : ' + String((e && e.message) || e).slice(0, 240)); } };
const capture = async (cible, nom) => { if (!CAPTURES) return; try { fs.mkdirSync(CAPTURES, { recursive: true }); await cible.screenshot({ path: path.join(CAPTURES, nom + '.png') }); } catch (_) {} };

const UA = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1',
  ordi: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};
const CHROME_SEUL = [/\bdans (?:ce |le |ton |son |un )?Chrome\b(?! Web Store|, Edge)/, /\bà Chrome\b/, /\bavec Chrome\b/, /\bChrome (?:ouvert|obligatoire|seulement|uniquement)/, /\b(?:ton|son|mon|du|au) Chrome\b(?! Web Store)/];

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.zip': 'application/zip' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!p.startsWith(DIST) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });

// ── A. la page publique : un visiteur, aucune session ───────────────────────
const visiteur = async (b, { largeur, hauteur, mobile, sombre }) => {
  const ctx = await b.newContext({ viewport: { width: largeur, height: hauteur }, isMobile: !!mobile, hasTouch: !!mobile, deviceScaleFactor: mobile ? 2 : 1, colorScheme: sombre ? 'dark' : 'light', reducedMotion: 'reduce', serviceWorkers: 'block' });
  await ctx.addInitScript(() => { try { localStorage.setItem('vrm_banc_sans_session', '1'); } catch (_) {} });
  await ctx.route(/supabase\.co|\/api\//, (rt) => rt.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await ctx.route(/^https?:\/\/(?!localhost)/, (rt) => rt.abort());
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('[data-prerequis]', { timeout: 15000 }).catch(() => {});
  await pg.waitForTimeout(1200);
  return { ctx, pg, errs };
};

// ── I. l'app : un vendeur fictif, base vide ─────────────────────────────────
const appareil = async (b, { largeur = 390, hauteur = 844, mobile = true, ua = UA.iphoneSafari, sombre = false, standalone = false, kagi = false, sansPush = true } = {}) => {
  const ctx = await b.newContext({ viewport: { width: largeur, height: hauteur }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1, userAgent: ua, serviceWorkers: 'block' });
  await ctx.addInitScript((o) => {
    try {
      if (!localStorage.getItem('__banc_pose__')) {
        localStorage.setItem('__banc_pose__', '1');
        localStorage.setItem('vrm_acces_direct', '1');
        localStorage.setItem('vrm_prenom', JSON.stringify('Camille'));
        localStorage.setItem('vrm_bascule_mineral_v1', '1');
        localStorage.setItem('vrm_bienvenue_vue', JSON.stringify({ at: '2026-10-01T00:00:00Z' }));
        localStorage.setItem('vinted_dark', JSON.stringify(!!o.sombre));
      }
    } catch (_) {}
    // iOS dans un onglet de Safari : pas de PushManager (il n'existe que dans l'app installée).
    if (o.sansPush) { try { delete window.PushManager; } catch (_) {} }
    if (o.standalone) { try { Object.defineProperty(Navigator.prototype, 'standalone', { get: () => true, configurable: true }); } catch (_) {} }
    if (o.kagi) { try { window.KAGI = {}; } catch (_) {} }
  }, { sombre, standalone, kagi, sansPush });
  await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(route.request().url());
    if (route.request().method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', body: '{"m":1}' });
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '*/0' }, body: '[]' });
  });
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true,"devices":0}' }));
  return ctx;
};
const ouvrirNotifications = async (ctx) => {
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.goto(`http://localhost:${PORT}/?tab=settings`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => document.querySelector('.vrm-main') || /pas pu s'afficher/.test(document.body.innerText), null, { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(2500);
  const sous = pg.locator('[data-sous-ouvrir="push"]').first();
  await sous.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  if (await sous.isVisible().catch(() => false)) { await sous.click().catch(() => {}); }
  await pg.waitForFunction(() => /Vente, bordereau, argent reçu/.test(document.body.innerText), null, { timeout: 8000 }).catch(() => {});
  await pg.waitForTimeout(700);
  return { pg, errs };
};
const mesureGuide = (pg) => pg.evaluate(() => {
  const g = document.querySelector('[data-guide-iphone]');
  const page = { docW: document.documentElement.scrollWidth, vw: innerWidth, ligneInstall: (document.body.innerText.match(/Non disponible ici/g) || []).length, ecran: /Vente, bordereau, argent reçu/.test(document.body.innerText) };
  if (!g) return { present: false, ...page };
  const r = g.getBoundingClientRect();
  const etapes = [...g.querySelectorAll('[data-guide-etape]')].map((e) => {
    const s = e.querySelector('svg'); const q = s ? s.getBoundingClientRect() : { width: 0, height: 0 }; const re = e.getBoundingClientRect();
    return { cle: e.getAttribute('data-guide-etape'), dessinW: Math.round(q.width), dessinH: Math.round(q.height), dessinHaut: Math.round(q.top || 0), texteHaut: Math.round((e.querySelector('.vrm-gi-texte') || e).getBoundingClientRect().top), haut: Math.round(re.top), gauche: Math.round(re.left), droite: Math.round(re.right) };
  });
  const petits = [...g.querySelectorAll('h3, p, b, span')].filter((x) => x.childNodes.length && [...x.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())).map((x) => parseFloat(getComputedStyle(x).fontSize)).filter((f) => f < 12);
  const f = g.querySelector('[data-guide-iphone-fermer]'); const fq = f ? f.getBoundingClientRect() : null;
  const hit = fq ? document.elementFromPoint(fq.left + fq.width / 2, fq.top + fq.height / 2) : null;
  const cs = getComputedStyle(g); const titre = g.querySelector('h3');
  return {
    present: true, visible: r.width > 0 && r.height > 0, largeur: Math.round(r.width), deborde: g.scrollWidth > g.clientWidth + 1, ...page, etapes, petits,
    fermer: fq ? { w: Math.round(fq.width), h: Math.round(fq.height), touche: !!hit && f.contains(hit) } : null,
    fond: cs.backgroundColor, encre: titre ? getComputedStyle(titre).color : '',
  };
});
const lum = (rgb) => { const m = /(\d+)\D+(\d+)\D+(\d+)/.exec(rgb || ''); if (!m) return null; return (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255; };

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.log('❌ dist/ absent — lance `npm run build` d’abord'); process.exit(1); }
  await new Promise((ok2) => srv.listen(PORT, ok2));
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });

  if (!PARTIE || PARTIE === 'A') {
    console.log('── A. la page d’accueil');
    for (const [nom, opt] of [['390 tactile clair', { largeur: 390, hauteur: 844, mobile: true }], ['390 tactile sombre', { largeur: 390, hauteur: 844, mobile: true, sombre: true }], ['1512 clair', { largeur: 1512, hauteur: 900 }], ['1512 sombre', { largeur: 1512, hauteur: 900, sombre: true }]]) {
      await essaie('A ' + nom, async () => {
        const { ctx, pg, errs } = await visiteur(b, opt);
        const m = await pg.evaluate(() => {
          const pre = document.querySelector('[data-prerequis]'); const r = pre ? pre.getBoundingClientRect() : null;
          const essai = document.querySelector('[data-navigateurs-essai]'); const note = document.querySelector('[data-ordinateur-necessaire]');
          const tailles = [pre, essai, note].filter(Boolean).map((e) => parseFloat(getComputedStyle(e).fontSize));
          return {
            pre: pre ? { texte: pre.innerText, navs: (pre.getAttribute('data-navigateurs') || '').split(',').filter(Boolean), tel: pre.getAttribute('data-lecture-telephone'), bas: Math.round(r.bottom), variante: pre.getAttribute('data-variante') } : null,
            essai: essai ? { navs: essai.getAttribute('data-navigateurs-essai'), texte: essai.innerText } : null,
            note: note ? note.innerText : '', texte: document.body.innerText, docW: document.documentElement.scrollWidth, vw: innerWidth, vh: innerHeight, tailles,
          };
        });
        dit(m.pre && m.pre.navs.length >= 5 && m.pre.navs.every((n) => m.pre.texte.includes(n)) && /ordinateur/.test(m.pre.texte) && m.pre.bas <= m.vh, `A1 ${nom} : le premier écran nomme ${m.pre ? m.pre.navs.join(', ') : '—'} et l’ordinateur`, m.pre && `${m.pre.texte} (bas ${m.pre.bas}/${m.vh})`);
        dit(m.pre && m.pre.variante === (opt.mobile ? 'tactile' : 'souris') && m.pre.tel === 'non', `A1b ${nom} : la phrase de ${opt.mobile ? 'téléphone' : 'l’ordinateur'}, aucun chemin téléphone promis`, m.pre && `${m.pre.variante} ${m.pre.tel}`);
        const fautes = CHROME_SEUL.map((re) => re.exec(m.texte)).filter(Boolean).map((x) => x[0]);
        dit(!fautes.length, `A2 ${nom} : aucune forme « Chrome obligatoire » rendue`, fautes.join(' | '));
        dit(m.essai && m.essai.navs === 'Orion' && /en essai/.test(m.essai.texte) && /pas encore confirmée/.test(m.essai.texte) && /Safari/.test(m.essai.texte), `A3 ${nom} : Orion « en essai », Safari « pas encore »`, m.essai && m.essai.texte);
        dit(/ordinateur reste nécessaire/.test(m.note) && !/Chrome/.test(m.note), `A4 ${nom} : « ton ordinateur reste nécessaire », sans Chrome`, m.note);
        dit(m.docW <= m.vw + 1, `A5 ${nom} : rien ne déborde de côté`, `${m.docW} > ${m.vw}`);
        dit(m.tailles.length === 3 && m.tailles.every((t) => t >= 12), `A6 ${nom} : ces lignes à 12 px ou plus`, m.tailles.join(','));
        dit(!errs.length, `A7 ${nom} : aucune erreur JavaScript`, errs.join(' | '));
        const t = nom.replace(/\s+/g, '-');
        await capture(pg, `accueil-${t}-haut`);
        const sec = pg.locator('[data-section="comment"]').first();
        if (await sec.count()) { await sec.scrollIntoViewIfNeeded().catch(() => {}); await pg.waitForTimeout(400); await capture(sec, `accueil-${t}-installation`); }
        await ctx.close();
      });
    }
  }

  if (!PARTIE || PARTIE === 'I') {
    console.log('\n── I. le guide « Installer VRM sur l’iPhone »');
    for (const sombre of [false, true]) {
      const T = `390 iPhone Safari ${sombre ? 'sombre' : 'clair'}`;
      await essaie('I ' + T, async () => {
        const ctx = await appareil(b, { sombre });
        const { pg, errs } = await ouvrirNotifications(ctx);
        const m = await mesureGuide(pg);
        dit(m.ecran && m.present && m.visible && m.etapes.length === 3 && m.etapes.map((e) => e.cle).join(',') === 'partager,accueil,notifications', `I1 ${T} : le guide est là, trois étapes`, JSON.stringify(m.etapes || m));
        dit(m.present && m.etapes.every((e) => e.dessinW >= 60 && e.dessinH >= 40), `I1b ${T} : chaque étape a son dessin de taille réelle`, JSON.stringify(m.etapes));
        dit(m.present && !m.deborde && m.docW <= m.vw + 1 && !m.petits.length, `I2 ${T} : rien ne déborde, aucun texte sous 12 px`, `guide ${m.deborde} page ${m.docW}/${m.vw} petits ${m.petits}`);
        dit(m.fermer && m.fermer.w >= 44 && m.fermer.h >= 44 && m.fermer.touche, `I3 ${T} : la croix fait au moins 44 × 44 px et le doigt tombe sur elle`, JSON.stringify(m.fermer));
        dit(m.ligneInstall === 0, `I4 ${T} : la ligne « Partager → Sur l’écran d’accueil » ne double pas le guide`, String(m.ligneInstall));
        const l = lum(m.fond), e = lum(m.encre);
        dit(l != null && e != null && (sombre ? (l < 0.3 && e > 0.7) : (l > 0.85 && e < 0.3)), `I6 ${T} : fond et encre du thème ${sombre ? 'sombre' : 'clair'}`, `${m.fond} / ${m.encre}`);
        const g = pg.locator('[data-guide-iphone]').first();
        await capture(g, `guide-iphone-390-${sombre ? 'sombre' : 'clair'}`);
        await capture(pg, `guide-iphone-390-${sombre ? 'sombre' : 'clair'}-ecran`);
        await pg.locator('[data-guide-iphone-fermer]').first().tap().catch(() => {});
        await pg.waitForTimeout(500);
        const apres = await mesureGuide(pg);
        dit(!apres.present && apres.ligneInstall === 1, `I5 ${T} : fermé, il disparaît ; la ligne d’installation revient, une fois`, `${apres.present} · ${apres.ligneInstall}`);
        await pg.close();
        const { pg: pg2 } = await ouvrirNotifications(ctx);
        const relu = await mesureGuide(pg2);
        dit(!relu.present, `I5b ${T} : rouvert, il reste fermé`, String(relu.present));
        dit(!errs.length, `I ${T} : aucune erreur JavaScript`, errs.join(' | '));
        await ctx.close();
      });
    }
    await essaie('I7 couché', async () => {
      const ctx = await appareil(b, { largeur: 844, hauteur: 390 });
      const { pg } = await ouvrirNotifications(ctx);
      const m = await mesureGuide(pg);
      const hauts = m.etapes ? [...new Set(m.etapes.map((e) => e.haut))] : [];
      dit(m.present && m.etapes.length === 3 && hauts.length === 1 && m.etapes[0].droite <= m.etapes[1].gauche && !m.deborde && m.docW <= m.vw + 1, 'I7 iPhone couché (844 × 390) : trois colonnes côte à côte, sans débord', JSON.stringify(m.etapes));
      dit(m.present && new Set(m.etapes.map((e) => e.dessinHaut)).size === 1 && new Set(m.etapes.map((e) => e.texteHaut)).size === 1, 'I7b couché : les dessins et les textes des trois colonnes sont alignés', JSON.stringify(m.etapes));
      await capture(pg.locator('[data-guide-iphone]').first(), 'guide-iphone-844-couche');
      await ctx.close();
    });
    for (const [nom, opt] of [
      ['app installée (navigator.standalone)', { standalone: true, sansPush: false }],
      ['Chrome sur iPhone (CriOS)', { ua: UA.iphoneChrome }],
      ['Orion sur iPhone (window.KAGI)', { kagi: true }],
      ['ordinateur 1512 clair', { largeur: 1512, hauteur: 950, mobile: false, ua: UA.ordi, sansPush: false }],
      ['ordinateur 1512 sombre', { largeur: 1512, hauteur: 950, mobile: false, ua: UA.ordi, sansPush: false, sombre: true }],
    ]) {
      await essaie('I8 ' + nom, async () => {
        const ctx = await appareil(b, opt);
        const { pg } = await ouvrirNotifications(ctx);
        const m = await mesureGuide(pg);
        const vu = m.ecran;
        dit(vu && !m.present, `I8 ${nom} : l’écran des notifications est rendu, sans le guide`, `écran ${vu} · guide ${m.present}`);
        if (/1512/.test(nom)) await capture(pg, `guide-iphone-absent-${nom.replace(/\s+/g, '-')}`);
        await ctx.close();
      });
    }
  }

  await b.close(); srv.close();
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ le banc a levé : ' + ((e && e.stack) || e)); process.exit(1); });
