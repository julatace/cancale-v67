// ════════════════════════════════════════════════════════════════════════════
//  Banc d'ÉCRAN : « Photos en double entre tes comptes » (11 nov., lot photos-comptes).
//
//  Données ET images INVENTÉES, fabriquées par le banc (le dépôt est public) : les
//  chaussures dessinées par le banc du seuil (`photos-comptes-seuil.cjs`, mêmes
//  fonctions), exportées en JPEG, servies comme des photos de vinted.net ; leurs
//  empreintes calculées par le VRAI src/photoEmpreinte.js (image dessinée en 64 × 64,
//  comme l'extension), rangées à la forme de l'extension 5.358 :
//  `photo_emprunte_{uid}` → `payload.annonces[id][clé de photo] = empreinte`.
//  Trois comptes Vinted (alpha 111, beta 222, gamma 333) :
//    alpha : 5000001 P1 (N°12) · 5000002 P2 (N°13) · 5000003 P3 vue 1 (N°14)
//            · 5000004 P5 (N°15) · 5000005 P5 recadrée + recompressée (N°16) — MÊME compte
//    beta  : 6000001 P1 recadrée 4 % + JPEG 60 % + moitié, AUTRE fichier (N°40)
//            · 6000002 P3 vue 2 = la MÊME paire, une AUTRE photo (N°41)
//            · 6000003 P4, empreinte pas encore calculée (N°42)
//    gamma : 8000001 P2 réduite de moitié (N°70)
//  Ce qui est jugé, sur ce qui est RENDU (data-*), téléphone 390 tactile et 1512,
//  clair et sombre, captures écrites (CAPTURES=<dossier>) pour être REGARDÉES :
//   A1 Ma journée : UNE carte ambre `[data-journee-photos-comptes]`, data-n = 2 (P1, P2),
//      comptée dans « N gestes » ; la ligne en ambre, jamais le rouge du doublon de N°.
//   A2 la feuille : 2 groupes, P3 vue 1 / vue 2 PAS groupées (deux photos de la même
//      paire), le même compte (5000004/5000005) PAS groupé ; 8 vérifiées, 1 pas encore
//      vérifiée (dite) ; chaque vignette : la miniature CHARGÉE, côte à côte, le compte et
//      le N° ; « Ouvrir sur Vinted » = vinted.fr, nouvel onglet ; le geste ≥ 44 px, sur
//      l'annonce la plus RÉCENTE du groupe ; aucun débordement, aucune erreur JS.
//   A3 « Republier avec d'autres photos » depuis Ma journée ouvre Republier à la main
//      sur cette annonce ; rien n'est écrit, aucune commande ne part (VRM ne supprime,
//      ne modifie, ne relie rien tout seul).
//   A4 Annonces → Outils : « Photos en double » porte 2, ouvre la même feuille.
//   C  la lecture des empreintes RATÉE (500) : aucune carte ; la feuille dit « pas lues »,
//      0 groupe, 9 photos pas vérifiées — jamais « aucun doublon ».
//   D  beta lu il y a 30 h : son groupe se tait (« pas su »), beta nommé « pas relu » ;
//      le groupe alpha/gamma reste.
//   E  rien en double (P1 seule) : aucune carte, la feuille ne montre aucun groupe.
//  `BANC_DIST=<dist>` : rendre un autre build (l'arbre d'avant, une mutation).
//  Lancer :
//    npm run build && BANC_PORT=$((20000+RANDOM%40000)) node -r ./scripts/bancs/_porte-banc.cjs scripts/bancs/photos-comptes.cjs
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path');
const fs = require('fs'), http = require('http');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const RACINE = path.join(__dirname, '..', '..');
const DIST = process.env.BANC_DIST || path.join(RACINE, 'dist');
const PORT = Number(process.env.BANC_PORT) || 9671;
const CAPT = process.env.CAPTURES || '';
if (CAPT) fs.mkdirSync(CAPT, { recursive: true });

const maintenant = new Date(2026, 10, 11, 15, 30, 0);
const MS = maintenant.getTime();
const iso = (h) => new Date(MS - h * 3600e3).toISOString();
const A = '111', B = '222', G = '333';
const ACCOUNTS = [
  { id: 1, vinted_user_id: A, login: 'compte-alpha', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() },
  { id: 2, vinted_user_id: B, login: 'compte-beta', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() },
  { id: 3, vinted_user_id: G, login: 'compte-gamma', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() },
];

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d && !c ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).split('\n')[0].slice(0, 300)); } };

// ── Les photos inventées : le dessin du banc du seuil, la règle d'empreinte de l'app ──
const SEUIL_SRC = fs.readFileSync(path.join(__dirname, 'photos-comptes-seuil.cjs'), 'utf8');
const DESSIN = SEUIL_SRC.slice(SEUIL_SRC.indexOf('function alea('), SEUIL_SRC.indexOf('window.__mesure'));
const REGLE = fs.readFileSync(path.join(RACINE, 'src', 'photoEmpreinte.js'), 'utf8').replace(/^export /gm, '');
const PAGE_GEN = `<!doctype html><meta charset="utf-8"><body><script>
${REGLE}
${DESSIN}
window.__fabrique = async (liste) => {
  const out = {};
  for (const f of liste) {
    const c = photo(paire(f.k), vueDe(f.k, f.v));
    const base = await jpeg(c, 0.9);
    const W = c.width, H = c.height;
    let img = base;
    if (f.t === 'combo') { const r = versCanvas(base, Math.round(W * 0.92), Math.round(H * 0.92), W * 0.04, H * 0.04, W * 0.92, H * 0.92); img = await jpeg(versCanvas(await jpeg(r, 0.6), W / 2, H / 2), 0.7); }
    if (f.t === 'moitie') img = await jpeg(versCanvas(base, W / 2, H / 2), 0.8);
    const cv = versCanvas(img, img.width, img.height);
    out[f.nom] = { b64: cv.toDataURL('image/jpeg', 0.85).split(',')[1], h: await empreinte(await charge(cv.toDataURL('image/jpeg', 0.85))) };
  }
  out.__d = (a, b) => distanceEmpreintes(a, b);
  return out;
};
window.__distance = (a, b) => distanceEmpreintes(a, b);
window.__seuil = SEUIL_PHOTO;
</script>`;
const PHOTOS = [
  { nom: 'P1', k: 0, v: 0 }, { nom: 'P1b', k: 0, v: 0, t: 'combo' },
  { nom: 'P2', k: 1, v: 0 }, { nom: 'P2b', k: 1, v: 0, t: 'moitie' },
  { nom: 'P3', k: 2, v: 1 }, { nom: 'P3v', k: 2, v: 5 },
  { nom: 'P4', k: 3, v: 0 },
  { nom: 'P5', k: 4, v: 0 }, { nom: 'P5b', k: 4, v: 0, t: 'combo' },
];
const url = (nom) => `https://images1.vinted.net/t/05_${nom.toLowerCase()}_banc/f800/17${nom.length}${nom.charCodeAt(1)}${nom.charCodeAt(nom.length - 1)}.jpeg?s=inventee`;
const cleDe = (u) => u.split('?')[0];

function scenarios(F) {
  const annonce = (id, title, nom) => ({ id, title, photo: url(nom), url: `https://www.vinted.fr/items/${id}-annonce-inventee`, price: { amount: '60.0', currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, created_at_ts: iso(240), favourite_count: 1, view_count: 10 });
  const lA = [annonce(5000001, 'Basket blanche inventée 42', 'P1'), annonce(5000002, 'Basket bleue inventée 41', 'P2'), annonce(5000003, 'Basket verte inventée 40', 'P3'), annonce(5000004, 'Basket rouge inventée 43', 'P5'), annonce(5000005, 'Basket rouge inventée 43 bis', 'P5b')];
  const lB = [annonce(6000001, 'Basket blanche 42 (beta)', 'P1b'), annonce(6000002, 'Basket verte 40 (beta)', 'P3v'), annonce(6000003, 'Basket grise 44 (beta)', 'P4')];
  const lG = [annonce(8000001, 'Basket bleue 41 (gamma)', 'P2b')];
  const emp = (items, sauf = []) => Object.fromEntries(items.filter((it) => !sauf.includes(it.id)).map((it) => [String(it.id), { [cleDe(it.photo)]: F[/\/05_([a-z0-9]+)_banc\//.exec(it.photo)[1].replace(/^p/, 'P')].h }]));
  const fiches = { 5000001: '12', 5000002: '13', 5000003: '14', 5000004: '15', 5000005: '16', 6000001: '40', 6000002: '41', 6000003: '42', 8000001: '70' };
  const uidDe = (id) => (String(id)[0] === '5' ? A : String(id)[0] === '6' ? B : G);
  const numeros = Object.fromEntries(Object.entries(fiches).map(([id, n]) => [id, { numero: n, accountId: uidDe(id), title: '' }]));
  const base = { listings: { [A]: { cap: iso(1), items: lA }, [B]: { cap: iso(2), items: lB }, [G]: { cap: iso(1), items: lG } },
    empreintes: { [A]: emp(lA), [B]: emp(lB, [6000003]), [G]: emp(lG) }, numeros };
  return {
    A: base,
    C: { ...base, empreintesKO: true },
    D: { ...base, listings: { ...base.listings, [B]: { ...base.listings[B], cap: iso(30) } } },
    E: { listings: { [A]: { cap: iso(1), items: [lA[0]] }, [B]: { cap: iso(1), items: [lB[2]] } }, empreintes: { [A]: emp([lA[0]]), [B]: {} }, numeros },
  };
}

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });

const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = (row.data && row.data.capturedAt) || maintenant.toISOString(); continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v === 'object' ? JSON.stringify(v) : (/->>/.test(src) ? String(v) : v));
  }
  return out;
};
const BRUIT = /vrm_journee|push_|_vues|vrm_reprise|vrm_ecran|vrm_lu_|vrm_nouveautes|vrm_quoi_de_neuf|vrm_derniere|vrm_appareil|vrm_session/;

async function ouvrir(b, vp, sc, { sombre = false, tab = 'journee', images }) {
  const tel = vp.width < 600;
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: tel ? 2 : 1, timezoneId: 'Europe/Paris', locale: 'fr-FR', ...(tel ? { isMobile: true, hasTouch: true } : {}), colorScheme: sombre ? 'dark' : 'light' });
  const pg = await ctx.newPage();
  const errs = [], ecritures = [], api = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_prenom', JSON.stringify('Julien')); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_apparence', JSON.stringify(s ? 'sombre' : 'clair')); } catch (_) {} }, sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : /api-adresse|openfreemap/.test(r.request().url()) ? r.abort() : r.continue()));
  // Les photos INVENTÉES, servies comme vinted.net (enregistrée APRÈS : Playwright la prend en premier).
  await pg.route(/^https:\/\/images1\.vinted\.net\//, (r) => {
    const m = /\/05_([a-z0-9]+)_banc\//.exec(r.request().url());
    const im = m && images[m[1].replace(/^p/, 'P')];
    return im ? r.fulfill({ status: 200, contentType: 'image/jpeg', headers: { 'access-control-allow-origin': '*' }, body: Buffer.from(im.b64, 'base64') }) : r.abort();
  });
  const LIGNES = [
    ...Object.entries(sc.listings).map(([uid, l]) => ({ id: `harvest_${uid}_listings`, data: { capturedAt: l.cap, uid, payload: { items: l.items, pagination: { total_entries: l.items.length } } } })),
    ...Object.entries(sc.empreintes).map(([uid, a]) => ({ id: `photo_emprunte_${uid}`, data: { capturedAt: iso(1), uid, payload: { annonces: a } } })),
  ];
  const main = { vinted_annonce_numeros: sc.numeros, vinted_dark: sombre };
  pg.lectEmpreintes = 0;
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (req.method() !== 'GET' && req.method() !== 'HEAD') { ecritures.push({ m: req.method(), u: u.slice(0, 200) + ' ' + String(req.postData() || '').replace(/"data":[\s\S]*$/, '').slice(0, 160) }); return j([]); }
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    if (/photo_emprunte/.test(u)) {
      pg.lectEmpreintes++;
      if (/select=data(&|$)/.test(u)) pg.selectData = true;
      if (sc.empreintesKO) return route.fulfill({ status: 500, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"message":"panne inventée"}' });
    }
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || '';
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq && eq[1] === 'main') return j([projette({ id: 'main', data: main }, sel)]);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map((r) => projette(r, sel)));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map((r) => projette(r, sel))); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => { if (r.request().method() !== 'GET') api.push(r.request().url().replace(/^https?:\/\/[^/]+/, '') + ' ' + (r.request().postData() || '').slice(0, 120)); return r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }); });
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  if (tab === 'journee') {
    await pg.waitForFunction(() => document.querySelector('.vrm-fu-afaire, [data-tout-a-jour]') || /pas pu s'afficher/.test(document.body.innerText), null, { timeout: 25000 }).catch(() => {});
    await pg.waitForFunction(() => document.querySelector('[data-journee-photos-comptes]'), null, { timeout: 8000 }).catch(() => {});
  } else {
    await pg.waitForSelector('[aria-label="Outils des annonces"]', { timeout: 25000 }).catch(() => {});
  }
  await pg.waitForTimeout(1200);
  return { ctx, pg, errs, ecritures, api };
}

const toucher = async (pg, tel, sel) => { const l = pg.locator(sel).first(); await l.scrollIntoViewIfNeeded().catch(() => {}); if (tel) await l.tap(); else await l.click(); };
const lireFeuille = (pg) => pg.evaluate(() => {
  const s = document.querySelector('[data-feuille-photos-comptes] [data-photos-comptes], [data-photos-comptes]');
  if (!s) return { feuille: false, pasPret: !!document.querySelector('[data-pc-pas-pret]'), texte: document.body.innerText.slice(0, 300) };
  const groupes = [...s.querySelectorAll('[data-pc-groupe]')].map((g) => {
    const vigs = [...g.querySelectorAll('[data-pc-annonce]')].map((v) => {
      const img = v.querySelector('img'); const r = v.getBoundingClientRect();
      const a = v.querySelector('[data-pc-ouvrir]');
      const ph = v.querySelector('.vrm-phc-photo'), cap = v.querySelector('figcaption'), rg = v.closest('.vrm-phc-rangee');
      const rc = cap && cap.getBoundingClientRect(), rr = rg && rg.getBoundingClientRect();
      const chaine = []; for (let e = ph; e && chaine.length < 6; e = e.parentElement) { const cs = getComputedStyle(e); chaine.push(`${e.tagName}.${String(e.className).slice(0, 30)} h${Math.round(e.getBoundingClientRect().height)} mh${cs.maxHeight} ov${cs.overflow} d${cs.display}`); }
      return { hPhoto: ph ? Math.round(ph.getBoundingClientRect().height) : 0, legendeVue: !!(rc && rr && rc.height > 10 && rc.bottom <= rr.bottom + 1), chaine: chaine.join(' < '),
        id: v.getAttribute('data-pc-annonce'), charge: !!(img && img.complete && img.naturalWidth > 0), top: Math.round(r.top), left: Math.round(r.left), w: Math.round(r.width),
        legende: (v.querySelector('figcaption') || {}).textContent || '', href: a && a.getAttribute('href'), cible: a && a.getAttribute('target') };
    });
    const geste = g.querySelector('[data-pc-republier]'); const gr = geste && geste.getBoundingClientRect();
    return { id: g.getAttribute('data-pc-groupe'), d: Number(g.getAttribute('data-pc-distance')), vigs, geste: geste && geste.getAttribute('data-pc-republier'), hGeste: gr ? Math.round(gr.height) : 0 };
  });
  const coupe = [...s.querySelectorAll('*')].some((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > window.innerWidth + 1 && !e.closest('.vrm-phc-rangee'); });
  return { feuille: true, lu: s.getAttribute('data-pc-lu'), n: Number(s.getAttribute('data-pc-groupes')), verifiees: Number(s.getAttribute('data-pc-verifiees')), pasVerifiees: Number(s.getAttribute('data-pc-pas-verifiees')),
    manqueDit: !!s.querySelector('[data-pc-manque]'), pasRelus: (s.querySelector('[data-pc-pas-relus]') || { getAttribute: () => '' }).getAttribute('data-pc-pas-relus'),
    etat: (s.querySelector('[data-pc-etat]') || {}).textContent || '', groupes, coupe, deborde: document.documentElement.scrollWidth > window.innerWidth + 1,
    boutonsSupprimer: [...s.querySelectorAll('button')].filter((x) => /supprim/i.test(x.textContent)).length };
});

(async () => {
  let b;
  srv.listen(PORT);
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    // 1. Fabriquer les photos et leurs empreintes (la règle de l'app, dans Chromium).
    const gen = await b.newPage();
    await gen.route('**/*', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: PAGE_GEN }));
    await gen.goto('http://localhost/fabrique');
    const F = await gen.evaluate((l) => window.__fabrique(l), PHOTOS);
    const dist = async (x, y) => gen.evaluate(([a, c]) => window.__distance(a, c), [F[x].h, F[y].h]);
    const seuil = await gen.evaluate(() => window.__seuil);
    const d = { P1: await dist('P1', 'P1b'), P2: await dist('P2', 'P2b'), P5: await dist('P5', 'P5b'), P3: await dist('P3', 'P3v'), P1P2: await dist('P1', 'P2') };
    await gen.close();
    console.log(`── jeu inventé : distances P1~P1b ${d.P1} · P2~P2b ${d.P2} · P5~P5b ${d.P5} · P3 vue1~vue2 ${d.P3} · P1~P2 ${d.P1P2} (seuil ${seuil})`);
    dit(d.P1 <= seuil && d.P2 <= seuil && d.P5 <= seuil, 'le jeu : les copies recadrées / recompressées sont PROCHES', JSON.stringify(d));
    dit(d.P3 > seuil && d.P1P2 > seuil, 'le jeu : deux photos de la même paire, deux paires ⇒ LOIN', JSON.stringify(d));
    if (CAPT) for (const n of ['P1', 'P1b', 'P3', 'P3v']) fs.writeFileSync(path.join(CAPT, `photo-${n}.jpg`), Buffer.from(F[n].b64, 'base64'));
    const SC = scenarios(F);

    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 945 }].filter((v) => !process.env.BANC_SEUL || String(v.width) === process.env.BANC_SEUL)) {
      const tel = vp.width < 600, nomVp = tel ? '390' : '1512';
      for (const sombre of [false, true].filter((x) => !process.env.BANC_THEME || (x ? 'sombre' : 'clair') === process.env.BANC_THEME)) {
        const th = sombre ? 'sombre' : 'clair';
        console.log(`\n── ${nomVp} px · ${th}`);
        await essaie(`A ${nomVp} ${th}`, async () => {
          const { ctx, pg, errs, ecritures, api } = await ouvrir(b, vp, SC.A, { sombre, images: F });
          if (CAPT) await pg.screenshot({ path: path.join(CAPT, `pc-A-${nomVp}-${th}-journee.png`) });
          const r = await pg.evaluate(() => {
            const c = document.querySelector('[data-journee-photos-comptes]');
            if (!c) return { carte: false, texte: document.body.innerText.slice(0, 300) };
            const n = c.querySelector('.vrm-day-task-note'), t = c.querySelector('.vrm-day-task-title');
            const g = document.querySelector('[data-fu-gestes]');
            return { carte: true, n: c.getAttribute('data-n'), ids: c.getAttribute('data-journee-photos-comptes'), titre: t && t.textContent, note: n && n.textContent,
              cNote: n && getComputedStyle(n).color, cTitre: t && getComputedStyle(t).color, gestes: g ? g.getAttribute('data-fu-gestes') : null,
              rouge: !!document.querySelector('[data-job="numeros-en-double"]'), deborde: document.documentElement.scrollWidth > window.innerWidth + 1, sombre: document.documentElement.getAttribute('data-theme') || '' };
          });
          dit(r.carte, 'A1 Ma journée : la carte « photos sur deux comptes » est là', r.texte);
          if (r.carte) {
            dit(r.n === '2', 'A1 deux groupes (P1 alpha/beta, P2 alpha/gamma)', `${r.n} · ${r.ids}`);
            dit(/compte-alpha/.test(r.note || '') && /compte-beta/.test(r.note || '') && /compte-gamma/.test(r.note || ''), 'A1 la ligne nomme les trois comptes', r.note);
            const rgb = (s) => (/rgba?\(([^)]+)\)/.exec(s || '') || [])[1];
            dit(!!rgb(r.cNote) && rgb(r.cNote) !== rgb(r.cTitre) && !/255,\s*59,\s*48|255,\s*69,\s*58/.test(r.cNote), 'A1 la ligne en AMBRE (ni l’encre, ni le rouge)', `${r.cNote} / ${r.cTitre}`);
            dit(r.gestes != null && Number(r.gestes) >= 1, 'A1 comptée dans « N gestes »', String(r.gestes));
            dit(!r.rouge && !r.deborde, 'A1 pas de rouge « deux paires sous un N° », aucun débordement', JSON.stringify(r));
          }
          const avant = ecritures.length, avantApi = api.length;
          await toucher(pg, tel, '[data-journee-photos-comptes]').catch(() => {});
          await pg.waitForSelector('[data-feuille-photos-comptes] [data-photos-comptes]', { timeout: 6000 }).catch(() => {});
          await pg.waitForFunction(() => [...document.querySelectorAll('[data-photos-comptes] [data-pc-annonce] img')].every((i) => i.complete), null, { timeout: 6000 }).catch(() => {});
          await pg.waitForTimeout(500);
          if (CAPT) await pg.screenshot({ path: path.join(CAPT, `pc-A-${nomVp}-${th}-feuille.png`) });
          const f = await lireFeuille(pg);
          dit(f.feuille, 'A2 la carte ouvre la feuille', f.texte);
          if (f.feuille) {
            const ids = f.groupes.map((g) => g.id).sort();
            dit(f.n === 2 && ids.join(' ') === 'vinted:111|5000001+vinted:222|6000001 vinted:111|5000002+vinted:333|8000001', 'A2 les deux groupes : P1 (alpha 5000001 + beta 6000001), P2 (alpha 5000002 + gamma 8000001)', ids.join(' '));
            dit(!f.groupes.some((g) => /5000003|6000002/.test(g.id)), 'A2 deux photos DIFFÉRENTES de la même paire (P3 vue 1 / vue 2) : pas un doublon');
            dit(!f.groupes.some((g) => /5000004|5000005/.test(g.id)), 'A2 la même photo sur le MÊME compte (5000004/5000005) : pas d’alerte');
            dit(f.groupes.every((g) => g.d <= seuil), 'A2 chaque groupe sous le seuil', f.groupes.map((g) => g.d).join(','));
            dit(f.verifiees === 8 && f.pasVerifiees === 1 && f.manqueDit, 'A2 8 photos vérifiées, « 1 photo pas encore vérifiée » DITE (6000003)', `${f.verifiees} / ${f.pasVerifiees} / dit ${f.manqueDit}`);
            const vigs = f.groupes.flatMap((g) => g.vigs);
            dit(vigs.length === 4 && vigs.every((v) => v.charge), 'A2 les 4 miniatures sont CHARGÉES (les photos inventées)', JSON.stringify(vigs.map((v) => [v.id, v.charge])));
            dit(f.groupes.every((g) => g.vigs.length === 2 && g.vigs[0].top === g.vigs[1].top && g.vigs[1].left >= g.vigs[0].left + g.vigs[0].w), 'A2 côte à côte (même ligne)', JSON.stringify(f.groupes.map((g) => g.vigs.map((v) => [v.top, v.left]))));
            dit(vigs.every((v) => v.hPhoto >= 150 && v.legendeVue), 'A2 chaque miniature ENTIÈRE (≥ 150 px de haut) et sa légende VISIBLE (compte, N°)', JSON.stringify(vigs.map((v) => [v.hPhoto, v.legendeVue, v.chaine]).slice(0, 1)));
            const leg = Object.fromEntries(vigs.map((v) => [v.id, v.legende]));
            dit(/compte-alpha/.test(leg['vinted:111|5000001']) && /N°12/.test(leg['vinted:111|5000001']) && /compte-beta/.test(leg['vinted:222|6000001']) && /N°40/.test(leg['vinted:222|6000001']) && /compte-gamma/.test(leg['vinted:333|8000001']) && /N°70/.test(leg['vinted:333|8000001']), 'A2 chaque vignette : son compte et son N°', JSON.stringify(leg));
            dit(vigs.every((v) => /^https:\/\/www\.vinted\.fr\/items\/\d+/.test(v.href || '') && v.cible === '_blank'), 'A2 « Ouvrir sur Vinted » : vinted.fr, nouvel onglet', JSON.stringify(vigs.map((v) => v.href)));
            dit(f.groupes.map((g) => g.geste).sort().join(' ') === '222:6000001 333:8000001', 'A2 le geste sur l’annonce la plus RÉCENTE du groupe', f.groupes.map((g) => g.geste).join(' '));
            dit(f.groupes.every((g) => g.hGeste >= 44), 'A2 le geste ≥ 44 px', f.groupes.map((g) => g.hGeste).join(','));
            dit(!f.deborde && !f.coupe && f.boutonsSupprimer === 0, 'A2 aucun débordement, aucun bouton qui supprime', JSON.stringify({ deborde: f.deborde, coupe: f.coupe, s: f.boutonsSupprimer }));
          }
          // A3 Republier avec d'autres photos ⇒ Republier à la main, rien d'écrit.
          await toucher(pg, tel, '[data-pc-republier="222:6000001"]').catch(() => {});
          await pg.waitForSelector('[data-repub-main]', { timeout: 6000 }).catch(() => {});
          await pg.waitForTimeout(500);
          if (CAPT) await pg.screenshot({ path: path.join(CAPT, `pc-A-${nomVp}-${th}-republier.png`) });
          const rm = await pg.evaluate(() => { const e = document.querySelector('[data-repub-main]'); return e ? e.getAttribute('data-repub-main') : null; });
          dit(rm === '6000001', 'A3 « Republier avec d’autres photos » (depuis Ma journée) ouvre Republier à la main sur 6000001', String(rm));
          const ecr = ecritures.slice(avant).filter((e) => !BRUIT.test(e.u));
          const cmd = api.slice(avantApi).filter((x) => !/\/api\/(push|sante)|mode=mesures/.test(x));   // mesures d'usage (compteurs anonymes) : pas une commande
          dit(ecr.length === 0 && cmd.length === 0, 'A3 ouvrir la feuille et le geste : rien écrit, aucune commande', JSON.stringify([...ecr, ...cmd].slice(0, 3)));
          dit(!pg.selectData && pg.lectEmpreintes >= 1, 'les empreintes lues par PROJECTION (jamais select=data)', `${pg.lectEmpreintes} lecture(s), select=data ${!!pg.selectData}`);
          dit(errs.length === 0, 'aucune erreur JS', errs.slice(0, 2).join(' | '));
          await ctx.close();
        });
        // A4 Annonces → Outils (une fois par taille d'écran et thème).
        await essaie(`A4 ${nomVp} ${th}`, async () => {
          const { ctx, pg, errs } = await ouvrir(b, vp, SC.A, { sombre, tab: 'annonces', images: F });
          await toucher(pg, tel, 'button[aria-label="Outils des annonces"]');
          await pg.waitForSelector('[data-outil-annonces="photos-comptes"]', { timeout: 6000 }).catch(() => {});
          await pg.waitForTimeout(300);
          if (CAPT) await pg.screenshot({ path: path.join(CAPT, `pc-A4-${nomVp}-${th}-outils.png`) });
          const n = await pg.evaluate(() => { const e = document.querySelector('[data-outil-annonces="photos-comptes"]'); return e ? e.getAttribute('data-outil-n') : 'absent'; });
          dit(n === '2', 'A4 Annonces → Outils : « Photos en double » porte 2', String(n));
          await toucher(pg, tel, '[data-outil-annonces="photos-comptes"]').catch(() => {});
          await pg.waitForSelector('[data-photos-comptes]', { timeout: 6000 }).catch(() => {});
          await pg.waitForTimeout(600);
          if (CAPT && !tel) await pg.screenshot({ path: path.join(CAPT, `pc-A4-${nomVp}-${th}-feuille.png`) });
          const f = await lireFeuille(pg);
          dit(f.feuille && f.n === 2, 'A4 … et ouvre la même feuille (2 groupes)', JSON.stringify({ f: f.feuille, n: f.n }));
          dit(errs.length === 0, 'aucune erreur JS', errs.slice(0, 2).join(' | '));
          await ctx.close();
        });
      }
      console.log(`\n── ${nomVp} px · C, D, E (clair)`);
      await essaie(`C ${nomVp}`, async () => {
        const j = await ouvrir(b, vp, SC.C, { images: F });
        const carte = await j.pg.evaluate(() => ({ carte: !!document.querySelector('[data-journee-photos-comptes]'), rendu: !!document.querySelector('.vrm-fu-afaire, [data-tout-a-jour]') }));
        dit(carte.rendu && !carte.carte, 'C lecture des empreintes ratée : aucune carte', JSON.stringify(carte));
        dit(j.errs.length === 0, 'aucune erreur JS', j.errs.slice(0, 2).join(' | '));
        await j.ctx.close();
        const { ctx, pg, errs } = await ouvrir(b, vp, SC.C, { tab: 'annonces', images: F });
        await toucher(pg, tel, 'button[aria-label="Outils des annonces"]');
        await toucher(pg, tel, '[data-outil-annonces="photos-comptes"]').catch(() => {});
        await pg.waitForSelector('[data-photos-comptes]', { timeout: 6000 }).catch(() => {});
        await pg.waitForTimeout(500);
        if (CAPT) await pg.screenshot({ path: path.join(CAPT, `pc-C-${nomVp}-feuille.png`) });
        const f = await lireFeuille(pg);
        dit(f.feuille && f.n === 0 && f.verifiees === 0 && f.pasVerifiees === 9 && f.manqueDit, 'C la feuille : 0 groupe, 9 photos pas vérifiées, DIT', JSON.stringify({ f: f.feuille, n: f.n, v: f.verifiees, p: f.pasVerifiees }));
        dit(f.lu === '0' && f.n === 0, 'C « pas lues » (data-pc-lu=0), jamais « aucun doublon »', JSON.stringify({ lu: f.lu, etat: f.etat }));
        dit(/pas lues/i.test(f.etat) && !/aucune/i.test(f.etat), 'C la phrase (français) : « pas lues », pas « aucune »', f.etat);
        dit(errs.length === 0, 'aucune erreur JS', errs.slice(0, 2).join(' | '));
        await ctx.close();
      });
      await essaie(`D ${nomVp}`, async () => {
        const { ctx, pg, errs } = await ouvrir(b, vp, SC.D, { images: F });
        const r = await pg.evaluate(() => { const c = document.querySelector('[data-journee-photos-comptes]'); return { n: c ? c.getAttribute('data-n') : null, ids: c ? c.getAttribute('data-journee-photos-comptes') : '' }; });
        dit(r.n === '1' && !/222/.test(r.ids), 'D beta lu il y a 30 h : son groupe se tait, alpha/gamma reste (1)', JSON.stringify(r));
        await toucher(pg, tel, '[data-journee-photos-comptes]').catch(() => {});
        await pg.waitForSelector('[data-photos-comptes]', { timeout: 6000 }).catch(() => {});
        await pg.waitForTimeout(500);
        if (CAPT) await pg.screenshot({ path: path.join(CAPT, `pc-D-${nomVp}-feuille.png`) });
        const f = await lireFeuille(pg);
        dit(f.feuille && f.n === 1 && /compte-beta/.test(f.pasRelus || ''), 'D la feuille : 1 groupe, beta NOMMÉ « pas relu » (jamais un silence)', JSON.stringify({ n: f.n, pr: f.pasRelus, p: f.pasVerifiees }));
        dit(errs.length === 0, 'aucune erreur JS', errs.slice(0, 2).join(' | '));
        await ctx.close();
      });
      await essaie(`E ${nomVp}`, async () => {
        const { ctx, pg, errs } = await ouvrir(b, vp, SC.E, { images: F });
        const r = await pg.evaluate(() => ({ carte: !!document.querySelector('[data-journee-photos-comptes]'), rendu: !!document.querySelector('.vrm-fu-afaire, [data-tout-a-jour]') }));
        dit(r.rendu && !r.carte, 'E rien en double : aucune carte', JSON.stringify(r));
        dit(errs.length === 0, 'aucune erreur JS', errs.slice(0, 2).join(' | '));
        await ctx.close();
      });
    }
  } finally {
    if (b) await b.close();
    srv.close();
  }
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
