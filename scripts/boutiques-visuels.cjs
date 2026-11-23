#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  LES IMAGES DES FICHES DE BOUTIQUE — Chrome Web Store, Edge, Firefox
//  (8 nov. ; refait le 15 nov. : palette « Studio bleu clair », Inter, écran
//  Achats au lieu de cat_bord qui rendait Ventes, et la VRAIE carte du logo ;
//  refait le 20 nov. pour la 5.409.0 au style « VRM natif » : fond gris des Réglages
//  #F2F2F7, encre #111114, aucune ombre (un filet), et l'écran Stock à la place
//  d'Achats — plus aucun logo de transporteur dans les captures, risque de refus)
//
//  Fabrique dans `docs/boutiques/visuels/` (ou `--sortie <dossier>`) :
//   · capture-1…4 (1280 × 800, PNG) : l'app en MODE EXEMPLE (données inventées
//     par src/exempleDonnees.js ; toute requête vers un autre site que localhost
//     est COUPÉE, le script rougit si la base de VRM ou vrm.center est approchée) ;
//   · capture-5-extension : le vrai vrm-badge.js (carte du logo, onglet Ventes)
//     sur une page de dressing INVENTÉE, sans marque de site, faux `chrome` qui
//     répond « boutique_exemple / vendeur@exemple.test » — rien de réel ;
//   · tuile-440x280.png, tuile-1400x560.png, logo-300x300.png.
//  `--langue en` : textes anglais et app en anglais (`vrm_langue`), fichiers
//  préfixés `en-` (une fiche anglaise demande `_locales` dans le paquet).
//
//  Prérequis : `npm run build` (dist/). Chromium du banc : /opt/pw-browsers/chromium.
//    node scripts/boutiques-visuels.cjs [--langue fr|en] [--sortie dossier]
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), http = require('http'), fs = require('fs');
const RACINE = path.join(__dirname, '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const LANGUE = arg('--langue', 'fr');
if (!['fr', 'en'].includes(LANGUE)) { console.error('--langue fr|en'); process.exit(1); }
const LANGUES = [LANGUE];
const PREFIXE = LANGUE === 'fr' ? '' : LANGUE + '-';
const SORTIE = path.resolve(arg('--sortie', path.join(RACINE, 'docs', 'boutiques', 'visuels')));
fs.mkdirSync(SORTIE, { recursive: true });
const { chromium } = require(path.join(RACINE, 'node_modules', 'playwright'));
const DIST = process.env.BANC_DIST || path.join(RACINE, 'dist');
const EXT = path.join(RACINE, 'vinted-sync-extension');
const PORT = Number(process.env.PORT_VISUELS) || 10178;
const CHROMIUM = process.env.CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

const INTER = fs.readdirSync(path.join(DIST, 'assets')).filter((f) => /^inter-latin-wght-normal.*\.woff2$/.test(f))[0];
const INTER_B64 = INTER ? fs.readFileSync(path.join(DIST, 'assets', INTER)).toString('base64') : '';
const FONTE = INTER_B64 ? `@font-face{font-family:InterV;src:url(data:font/woff2;base64,${INTER_B64}) format('woff2');font-weight:100 900}` : '';
const POLICE = `InterV, Inter, -apple-system, system-ui, sans-serif`;
// (23 nov., « tous les tutos doivent ressembler à l'application ») : le cadre prend le GRIS-ARDOISE de la page publique
// vrm.center (src/accueil/accueil.css, nuit : #27272B → #0F0F10), texte blanc, gris #B8B8C0 ; l'app est capturée dans son
// apparence d'aujourd'hui, CLAIRE (Julien : « toute l'app en gris clair » ; `vinted_dark` posé explicitement à false).
const ENCRE = '#FFFFFF', ENCRE2 = '#B8B8C0';
const CIEL = 'radial-gradient(90% 40% at 18% 0%,rgb(244 244 245 / .10),transparent 70%),linear-gradient(180deg,#27272B 0%,#19191C 38%,#0F0F10 100%)';
const FILET = '0 0 0 .5px rgba(255,255,255,.16)';   // aucune ombre : un filet (NATIF.md §1 bis)
const VERSION_EXT = JSON.parse(fs.readFileSync(path.join(RACINE, 'vinted-sync-extension', 'manifest.json'), 'utf8')).version;

const TEXTES = {
  fr: {
    ecrans: [
      { tab: 'journee', titre: 'Ta journée de revendeur, en un coup d’œil.', sous: 'Ventes, colis, messages : ce que l’extension relève sur tes comptes arrive ici.' },
      { tab: 'ventes', titre: 'Toutes tes ventes, de tous tes comptes.', sous: 'Vinted, Leboncoin, eBay, Vestiaire Collective — au même endroit.' },
      { tab: 'garage', titre: 'Ton stock, un numéro par article.', sous: 'Chaque article a son numéro ; « Ranger » lui donne sa place.' },
      { tab: 'annonces', titre: 'Tes annonces en ligne, avec leur numéro.', sous: 'Prix d’achat, paires qui dorment, offres : rangés par compte.' },
    ],
    carteTitre: 'Sur le site,<br>une petite carte.<br>Rien de plus.',
    carteSous: 'Touche le logo VRM : la carte nomme le compte VRM où partent tes données et montre tes ventes du compte connecté. L’extension n’agit que pour ce compte-là, au plus 50 actions par heure, une requête à la fois.',
    illustration: 'Page de démonstration — données inventées',
    tuile: 'L’outil du revendeur.<br>Vinted, Leboncoin, eBay,<br>Vestiaire Collective.',
  },
  en: {
    ecrans: [
      { tab: 'journee', titre: 'Your reseller day, at a glance.', sous: 'Sales, parcels, messages: what the extension reads on your accounts lands here.' },
      { tab: 'ventes', titre: 'All your sales, from all your accounts.', sous: 'Vinted, Leboncoin, eBay, Vestiaire Collective — in one place.' },
      { tab: 'garage', titre: 'Your stock, one number per item.', sous: 'Every item has its number; “Store” gives it its place.' },
      { tab: 'annonces', titre: 'Your live listings, each with its number.', sous: 'Purchase price, slow movers, offers: sorted by account.' },
    ],
    carteTitre: 'On the site,<br>one small card.<br>Nothing more.',
    carteSous: 'Tap the VRM logo: the card names the VRM account your data goes to and shows the sales of the signed-in account. The extension only acts for that account, 50 actions per hour at most, one request at a time.',
    illustration: 'Demo page — invented data',
    tuile: 'The reseller’s toolkit.<br>Vinted, Leboncoin, eBay,<br>Vestiaire Collective.',
  },
};

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
const servir = () => http.createServer((q, r) => {
  let f = decodeURIComponent(q.url.split('?')[0]); if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!p.startsWith(DIST) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

async function capturesApp(nav, langue, externes) {
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, locale: langue === 'en' ? 'en-GB' : 'fr-FR', timezoneId: 'Europe/Paris', colorScheme: 'light' });
  const pg = await ctx.newPage();
  await pg.addInitScript((l) => { try { sessionStorage.setItem('vrm_mode_exemple', '1'); localStorage.setItem('vrm_langue', l); localStorage.setItem('vinted_dark', 'false'); } catch (_) {} }, langue);
  await pg.route(/^https?:\/\/(?!localhost)/i, (r) => { externes.push(r.request().url().replace(/^https?:\/\//, '').slice(0, 90)); return r.abort(); });
  const brutes = [];
  for (const e of TEXTES[langue].ecrans) {
    await pg.goto(`http://localhost:${PORT}/?tab=${e.tab}`, { waitUntil: 'domcontentloaded' });
    await pg.waitForSelector('[data-exemple-bandeau]', { timeout: 120000 });
    await pg.waitForTimeout(3500);
    const png = await pg.screenshot({ type: 'png', timeout: 180000 });
    brutes.push({ ...e, png });
  }
  await ctx.close();
  return brutes;
}

// ── La carte de l'extension, VRAI vrm-badge.js, sur une page de dressing inventée ──
const MIN = 60000, H = 3600000, J = 86400000, T0 = Date.now();   // (20 nov.) « lu il y a 20 min », jamais « il y a 5 j » sur une capture fraîche
const MODELES = ['Nike Air Max 90 blanches', 'Adidas Samba OG noires', 'New Balance 550 crème', 'Puma Suede bleues', 'Asics Gel-Kayano 14 argent', 'Nike Dunk Low Panda'];
const ANN = Array.from({ length: 8 }, (_, i) => ({ id: String(7000 + i), titre: `${MODELES[i % 6]} ${39 + (i % 6)}`, prix: 55 + i * 5, photo: '', num: String(120 + i), jours: i * 3, favoris: i % 5, depuis: T0 - i * 3 * J }));
const VEN = [['a_expedier', true], ['a_expedier', true], ['en_route', null], ['finalisee', null], ['finalisee', null]].map(([etat, b], i) => ({ tx: String(91000000000 + i), titre: `${MODELES[i]} 42`, prix: 60 + i * 10, photo: '', date: T0 - i * 30 * H, etat, vendue: true, num: String(200 + i), bordereau: b }));
const LISTES = { ok: true, plateforme: 'vinted', compte: { id: '111', nom: 'boutique_exemple' }, annonces: { lu: T0 - 20 * MIN, aConfirmer: false, total: ANN.length, liste: ANN }, ventes: { lu: T0 - 10 * MIN, total: VEN.length, liste: VEN }, autres: null };
const ETAT = { ok: true, plateforme: 'vinted', capte: true, version: VERSION_EXT, code: VERSION_EXT, vrm: { ok: true, connecte: true, email: 'vendeur@exemple.test', cloisonne: true },
  site: { id: '111', nom: 'boutique_exemple', choix: 'oui', jauge: { h: 6, maxH: 50, j: 18, maxJ: 200, complet: true }, favoris: { apercu: { at: T0 - MIN, etat: 'pret', total: 0 }, file: null } },
  flux: { okAt: T0 - 3 * MIN }, liens: [], capteCoupe: false };

const carreau = (i) => { const teintes = ['#E8EEF4', '#EFE9E2', '#E6EEE8', '#ECE7F0', '#F0ECE4', '#E4ECF2']; return teintes[i % teintes.length]; };
const PAGE = (illus) => `<!doctype html><html><head><meta charset="utf-8"><style>${FONTE}
 body{margin:0;background:#fff;font-family:${POLICE};color:#222}
 header{height:60px;border-bottom:1px solid #e6e6e6;display:flex;align-items:center;gap:18px;padding:0 28px}
 .marque{width:120px;height:18px;border-radius:9px;background:#e9ecef}
 .rech{flex:1;max-width:520px;height:36px;border-radius:8px;background:#f2f3f5}
 .ill{position:absolute;left:28px;top:76px;font-size:12px;color:#8a94a0;letter-spacing:.02em}
 main{padding:44px 28px 0}
 h1{font-size:22px;font-weight:600;margin:6px 0 4px} .p{color:#777;font-size:13px;margin-bottom:22px}
 .g{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}
 .c .ph{aspect-ratio:4/5;border-radius:6px;display:flex;align-items:center;justify-content:center}
 .c .t{font-size:13px;margin-top:8px;color:#333} .c .pr{font-size:13px;font-weight:600;margin-top:2px}
</style></head><body><header><div class="marque"></div><div class="rech"></div></header>
<div class="ill">${illus}</div>
<main><h1>Mon dressing</h1><div class="p">8 articles</div><div class="g">
${ANN.slice(0, 8).map((a, i) => `<div class="c"><div class="ph" style="background:${carreau(i)}"><svg width="96" height="48" viewBox="0 0 96 48"><path d="M6 36c10 0 18-4 26-14l10 6c8 5 22 7 40 8 6 0 8 4 8 6H6z" fill="#c9d2dc"/></svg></div><div class="t">${a.titre}</div><div class="pr">${a.prix} €</div></div>`).join('')}
</div></main></body></html>`;

async function captureCarte(nav, langue) {
  const ctx = await nav.newContext({ colorScheme: 'light', viewport: { width: 860, height: 740 }, deviceScaleFactor: 2, locale: langue === 'en' ? 'en-GB' : 'fr-FR' });
  const pg = await ctx.newPage();
  const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 200)));
  const LOGO = fs.readFileSync(path.join(EXT, 'logo-vrm-96.png'));
  await pg.route('**/*', (r) => {
    if (/logo-vrm(-96)?\.png/.test(r.request().url())) return r.fulfill({ status: 200, contentType: 'image/png', body: LOGO });
    return r.fulfill({ status: 200, contentType: 'text/html', body: PAGE(TEXTES[langue].illustration) });
  });
  // Adresse servie sur place par la route ci-dessus : aucune requête ne sort.
  await pg.goto('https://www.vinted.fr/member/exemple');
  await pg.evaluate(({ e, js, L }) => {
    const copie = (x) => JSON.parse(JSON.stringify(x));
    const orig = Element.prototype.attachShadow;   // ouverte pour le banc seulement (pour toucher le logo)
    Element.prototype.attachShadow = function (o) { return orig.call(this, Object.assign({}, o, { mode: 'open' })); };
    window.chrome = {
      runtime: { id: 'ext', getURL: (p) => location.origin + '/' + p, getManifest: () => ({ version: e.version }), lastError: null,
        sendMessage: (msg, cb) => {
          let rep = { ok: true };
          if (msg.action === 'etat') rep = copie(e);
          else if (msg.action === 'carteListes') rep = copie(L);
          else if (msg.action === 'capteLot') rep = { ok: true, lot: null };
          else if (msg.action === 'favorisCarte') rep = { ok: true, uid: '111', apercu: { etat: 'pret', total: 0, liste: [], selection: [] } };
          setTimeout(() => cb && cb(rep), 0);
        } },
      storage: { local: { get: (k, cb) => { if (cb) setTimeout(() => cb({}), 0); return Promise.resolve({}); }, set: (o, cb) => { if (cb) setTimeout(cb, 0); return Promise.resolve(); } }, onChanged: { addListener() {} } },
    };
    const s = document.createElement('script'); s.textContent = js; document.documentElement.appendChild(s);
  }, { e: ETAT, js: ['vrm-ui.js', 'vrm-mots.js', 'vrm-badge.js'].map((f) => fs.readFileSync(path.join(EXT, f), 'utf8')).join('\n;\n'), L: LISTES });   // (20 nov.) l'ordre du manifeste 5.409 : la feuille commune et les mots d'abord
  await pg.waitForTimeout(400);
  const b = await pg.evaluate(() => { const h = document.getElementById('vrm-badge'); const x = h && h.shadowRoot ? h.shadowRoot.querySelector('.btn') : null; if (!x) return null; const r = x.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  if (!b) throw new Error('carte : le shadow root est fermé, impossible de toucher le logo');
  await pg.mouse.move(5, 5); await pg.mouse.move(b.x, b.y); await pg.mouse.click(b.x, b.y);
  await pg.waitForTimeout(500);
  await pg.evaluate(() => { const q = document.getElementById('vrm-badge').shadowRoot.querySelector('[data-onglet-b="ventes"]'); if (q) q.click(); });
  await pg.waitForTimeout(500);
  const png = await pg.screenshot({ type: 'png', timeout: 180000 });
  if (erreurs.length) console.log('  erreurs de page (carte) :', erreurs);
  await ctx.close();
  return png;
}

async function composer(nav, largeur, hauteur, corps, fichier) {
  const ctx = await nav.newContext({ viewport: { width: largeur, height: hauteur }, deviceScaleFactor: 1 });
  const pg = await ctx.newPage();
  await pg.route(/^https?:\/\//i, (r) => r.abort());
  await pg.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${FONTE}
    *{box-sizing:border-box;margin:0;padding:0} html,body{width:${largeur}px;height:${hauteur}px;overflow:hidden}
    body{font-family:${POLICE};color:${ENCRE};background:${CIEL};-webkit-font-smoothing:antialiased;position:relative}
  </style></head><body>${corps}</body></html>`);
  await pg.evaluate(() => document.fonts.ready);
  await pg.waitForTimeout(200);
  await pg.screenshot({ path: path.join(SORTIE, fichier), type: 'png', timeout: 180000 });
  await ctx.close();
  console.log('✓ ' + fichier);
}
const b64 = (png) => 'data:image/png;base64,' + png.toString('base64');
const cadreEcran = (e) => `
  <div style="position:absolute;left:0;right:0;top:44px;text-align:center">
    <div style="font-size:38px;font-weight:600;letter-spacing:-0.02em">${e.titre}</div>
    <div style="margin-top:10px;font-size:19px;color:${ENCRE2}">${e.sous}</div>
  </div>
  <img src="${b64(e.png)}" style="position:absolute;left:120px;top:164px;width:1040px;height:650px;border-radius:14px 14px 0 0;box-shadow:${FILET}">`;
const cadreCarte = (t, png) => `
  <div style="position:absolute;left:72px;top:0;bottom:0;width:410px;display:flex;flex-direction:column;justify-content:center">
    <div style="font-size:36px;font-weight:600;letter-spacing:-0.02em;line-height:1.15">${t.carteTitre}</div>
    <div style="margin-top:18px;font-size:18px;line-height:1.55;color:${ENCRE2}">${t.carteSous}</div>
  </div>
  <img src="${b64(png)}" style="position:absolute;right:56px;top:${(800 - 620) / 2}px;width:${Math.round(620 * 860 / 740)}px;height:620px;border-radius:12px;box-shadow:${FILET};background:#fff">`;
const ICONE512 = path.join(RACINE, 'public', 'vrm-icon-v4-512.png');
const tuile = (t, l, h, ic, ti, st) => `
  <div style="width:${l}px;height:${h}px;display:flex;align-items:center;justify-content:center;gap:${Math.round(ic * 0.25)}px">
    <img src="data:image/png;base64,${fs.readFileSync(ICONE512).toString('base64')}" style="width:${ic}px;height:${ic}px;border-radius:${Math.round(ic * 0.23)}px;box-shadow:${FILET}">
    <div><div style="font-size:${ti}px;font-weight:600;letter-spacing:-0.02em">VRM</div>
    <div style="margin-top:${Math.round(st * 0.45)}px;font-size:${st}px;line-height:1.4;color:${ENCRE2}">${t.tuile}</div></div>
  </div>`;

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.error('dist/ absent : npm run build'); process.exit(1); }
  const srv = servir(); await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: CHROMIUM, args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  const externes = [];
  try {
    for (const l of LANGUES) {
      const t = TEXTES[l];
      const brutes = await capturesApp(nav, l, externes);
      const interdits = externes.filter((u) => /supabase\.co|vrm\.center|vercel\.app/.test(u));
      if (interdits.length) { console.error('✗ le mode exemple a tenté de joindre VRM :', interdits); process.exitCode = 1; return; }
      for (let i = 0; i < brutes.length; i++) await composer(nav, 1280, 800, cadreEcran(brutes[i]), `${PREFIXE}capture-${i + 1}-${brutes[i].tab}.png`);
      await composer(nav, 1280, 800, cadreCarte(t, await captureCarte(nav, l)), `${PREFIXE}capture-5-extension.png`);
      await composer(nav, 440, 280, tuile(t, 440, 280, 104, 36, 14), `${PREFIXE}tuile-440x280.png`);
      await composer(nav, 1400, 560, tuile(t, 1400, 560, 240, 80, 28), `${PREFIXE}tuile-1400x560.png`);
    }
    if (LANGUE === 'fr') await composer(nav, 300, 300, `<img src="data:image/png;base64,${fs.readFileSync(ICONE512).toString('base64')}" style="width:300px;height:300px;display:block">`, 'logo-300x300.png');
    console.log(`requêtes externes coupées : ${externes.length}`, [...new Set(externes.map((u) => u.split('/')[0]))].slice(0, 10));
  } finally { await nav.close(); srv.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
