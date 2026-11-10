// ════════════════════════════════════════════════════════════════════════════
//  LA LIGNE DE FRAÎCHEUR UNIQUE (9 nov., lot AG, proposition 47)
//  La VRAIE app (`dist`), une fausse base qui applique la projection `select=`.
//  Données inventées (dépôt public). À 390 px tactile SOMBRE et 1512 px clair :
//   A. tout frais (comptes, extension, suivi, e-mails) ⇒ « Tout est à jour ·
//      vérifié … », aucun point ambre ;
//   B. compte_a relu il y a 3 j ⇒ NOMMÉ en haut avec son geste (« pas relu
//      depuis 3 j — ouvre vinted.fr sur ce compte »), le détail au toucher ;
//   C. base injoignable (vinted_accounts en 522) ⇒ le bloc de panne, la ligne
//      se tait : jamais « à jour » ;
//   D. hors ligne (réseau coupé après l'ouverture) ⇒ le bandeau hors ligne,
//      jamais « à jour » ;
//   E. deux sources en retard (extension pas vue depuis 2 j, compte_a 3 j) ⇒
//      l'extension d'abord (la cause), « + 1 autre », le détail dans l'ordre ;
//   F. les appareils illisibles (503) ⇒ « Pas pu tout vérifier », jamais « à jour ».
//  Et partout : UNE ligne (une seule `[data-fraicheur-unique]`), plus de puce
//  « Relire compte » ni de « ✓ Ventes Vinted à jour » en double, cibles de 44 px,
//  aucun débordement, aucune erreur, la hauteur de la ligne ne change pas entre
//  « Vérification… » et la réponse (la page ne saute pas).
//  Captures dans BANC_CAPTURES (défaut : scripts/bancs/captures/), à REGARDER (§6.2).
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), http = require('http');
const { metaVersData } = require('./_meta.cjs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4393;
const CAPT = process.env.BANC_CAPTURES || path.join(__dirname, 'captures');
fs.mkdirSync(CAPT, { recursive: true });
const ATTENDUE = (/const EXT_ATTENDUE = '([\d.]+)'/.exec(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'App.jsx'), 'utf8')) || [])[1];

const H = 3600e3, M = 60e3, J = 864e5;
const iso = (ilYa) => new Date(Date.now() - ilYa).toISOString();
const ACCOUNTS = [
  { id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(0) },
  { id: 2, vinted_user_id: '222', login: 'compte_b', domain: 'www.vinted.fr', updated_at: iso(0) },
];
const appareil = (id, ap, ilYa) => ({ id: 'ext_appareil_' + id, data: { v: 1, appareil: ap, ver: ATTENDUE, code: ATTENDUE, at: iso(ilYa), atMs: Date.now() - ilYa, flux: { vinted: { okAt: Date.now() - ilYa, koAt: null, refus: [] } }, vus: {} } });
function base(scen) {
  const ageA = scen === 'vieux' || scen === 'deux' ? 3 * J : 1 * H;
  const ageExt = scen === 'deux' ? 2 * J : 5 * M;
  const harvest = (uid, age) => ['profile', 'listings', 'orders_sold', 'orders_purchased'].map((f) => ({ id: `harvest_${uid}_${f}`, data: { capturedAt: iso(age) } }));
  return [
    ...harvest('111', ageA), ...harvest('222', 40 * M),
    { id: 'panel_comptes_etat', data: { comptes: {} } },
    appareil('0f1e2d3c4b5a6978', { paquet: 'chromium', nav: 'chrome', systeme: 'mac' }, ageExt),
    { id: 'panel_diag_capture', data: { ver: ATTENDUE, verCode: ATTENDUE, majAt: iso(ageExt), n: {}, rates: {} } },
    { id: 'transp_vinted_1234567890123456', data: { suivi: '1234567890123456', carrier: 'vinted', etat: 'disponible', lu: iso(4 * M), essai: iso(4 * M), essaiRes: 'ok', fini: false } },
  ];
}

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (!c && d ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ port ' + PORT + ' pris (' + e.code + ')'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = null; continue; }
    const texte = /->>[^>]*$/.test(src);
    let v = row.data; for (const seg of src.replace(/^(data|meta)(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    if (texte && v != null && typeof v !== 'string') v = typeof v === 'object' ? JSON.stringify(v) : String(v);
    out[alias] = v == null ? null : v;
  }
  return out;
};

async function scenario(b, scen, largeur, sombre) {
  const rows = base(scen);
  const ctx = await b.newContext({ viewport: { width: largeur, height: 900 }, hasTouch: largeur < 600, colorScheme: sombre ? 'dark' : 'light' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', s ? 'true' : 'false'); } catch (_) {} }, sombre);
  // La hauteur de la ligne, à chaque changement (elle ne doit pas changer : la page ne saute pas).
  await pg.addInitScript(() => { window.__hauteursLigne = []; const o = new MutationObserver(() => { const e = document.querySelector('[data-fraicheur-unique]'); if (e) { const h = Math.round(e.getBoundingClientRect().height); const k = e.getAttribute('data-fraicheur-unique') + ':' + h; if (window.__hauteursLigne[window.__hauteursLigne.length - 1] !== k) window.__hauteursLigne.push(k); } }); document.addEventListener('DOMContentLoaded', () => o.observe(document.body, { subtree: true, childList: true, attributes: true })); });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u) && !/vinted_accounts/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return scen === 'baseko' ? route.fulfill({ status: 522, contentType: 'text/html', body: '<html>522</html>' }) : j(ACCOUNTS);
    if (scen === 'passu' && /ext_appareil_/.test(u)) return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map((r) => projette(r, sel)));
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map((r) => projette(r, sel))); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  const nom = `${scen}-${largeur}-${sombre ? 'sombre' : 'clair'}`;
  await pg.goto(`http://localhost:${PORT}/?tab=${scen === 'colis' ? 'cat_bord' : 'journee'}`, { waitUntil: 'domcontentloaded' });
  const lue = () => pg.waitForFunction(() => { const e = document.querySelector('[data-fraicheur-unique]'); return e && !['encours', 'charge'].includes(e.getAttribute('data-fraicheur-unique')); }, null, { timeout: 25000 }).catch(() => {});
  const etat = () => pg.evaluate(() => {
    const L = [...document.querySelectorAll('[data-fraicheur-unique]')];
    const e = L[0];
    return { n: L.length, etat: e ? e.getAttribute('data-fraicheur-unique') : null, source: e ? e.getAttribute('data-fraicheur-source') : null, nRet: e ? Number(e.getAttribute('data-fraicheur-n')) : null,
      passu: e ? e.getAttribute('data-fraicheur-passu') : null, texte: e ? e.innerText.replace(/\s+/g, ' ').trim() : '', h: e ? Math.round(e.getBoundingClientRect().height) : 0,
      ton: e ? getComputedStyle(e.querySelector('.vrm-fraicheur-point')).backgroundColor : '',
      toutAJour: /Tout est à jour/.test(document.body.innerText), panne: !!document.querySelector('[data-panne-vendeur]') || /Je n'arrive pas à joindre tes données/.test(document.body.innerText),
      horsLigne: !!document.querySelector('[data-hors-ligne], [data-hors-ligne-ligne], [data-hors-ligne-froid]'),
      puce: document.querySelectorAll('[data-comptes-a-relire]').length, ventesAJour: document.querySelectorAll('[data-fraicheur-ventes]').length, achats: document.querySelectorAll('[data-fraicheur-achats]').length };
  });
  const photo = async (suffixe = '') => { await pg.waitForFunction(() => { const d = document.getElementById('vrm-demarrage'); return !d || getComputedStyle(d).display === 'none' || getComputedStyle(d).opacity === '0'; }, null, { timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(400); await pg.screenshot({ path: path.join(CAPT, `fraicheur-unique-${nom}${suffixe}.png`) }).catch(() => {}); };

  if (scen === 'baseko') {
    await pg.waitForTimeout(6000);
    const s = await etat();
    dit(s.panne, `${nom} : le bloc « Je n’arrive pas à joindre tes données » est là`);
    dit(s.n === 0 && !s.toutAJour, `${nom} : base injoignable ⇒ la ligne se tait, jamais « Tout est à jour »`, JSON.stringify(s));
    await photo();
  } else if (scen === 'horsligne') {
    await lue();
    const avant = await etat();
    dit(avant.etat === 'a-jour', `${nom} : en ligne d’abord ⇒ « Tout est à jour »`, JSON.stringify(avant));
    await ctx.setOffline(true);
    await pg.evaluate(() => window.dispatchEvent(new Event('offline')));
    await pg.waitForTimeout(1200);
    const s = await etat();
    dit(s.horsLigne, `${nom} : hors ligne ⇒ le bandeau hors ligne`, JSON.stringify(s));
    dit(s.n === 0 && !s.toutAJour, `${nom} : hors ligne ⇒ jamais « Tout est à jour »`, JSON.stringify(s));
    await photo();
    await ctx.setOffline(false);
  } else {
    await lue();
    const s = await etat();
    dit(s.n === 1, `${nom} : UNE ligne de fraîcheur`, String(s.n));
    if (scen === 'frais') {
      dit(s.etat === 'a-jour' && /^Tout est à jour · vérifié (à l’instant|il y a \d+ min)$/.test(s.texte), `${nom} : tout frais ⇒ « Tout est à jour · vérifié … »`, JSON.stringify(s));
      dit(!/255, 1[0-9]{2}, 0|rgb\(2[0-9]{2}, 1[0-9]{2}, [0-9]{1,2}\)/.test(s.ton), `${nom} : aucun point ambre quand tout est à jour`, s.ton);
    } else if (scen === 'vieux') {
      dit(s.etat === 'retard' && s.source === 'compte' && /compte_a/.test(s.texte) && /pas relu depuis 3 j/.test(s.texte) && !/ouvre vinted\.fr/.test(s.texte), `${nom} : compte_a vieux de 3 j ⇒ nommé, état court, sans phrase d'instruction (10 nov., « je trouve ça moche »)`, s.texte);
      dit(!/compte_b/.test(s.texte), `${nom} : compte_b relu il y a 40 min n’est pas nommé`, s.texte);
      dit(!s.toutAJour, `${nom} : jamais « Tout est à jour » avec un compte en retard`);
      await photo();
      await pg.locator('[data-fraicheur-deplier]').click();
      const det0 = await pg.evaluate(() => { const d = document.querySelector('[data-fraicheur-detail]'); return d ? d.innerText : ''; });
      dit(!/navigateur où est l’extension VRM/.test(det0), `${nom} : déplié, une ligne par source, l'instruction n'est pas étalée`, det0.slice(0, 200));
      await pg.locator('.vrm-fraicheur-rangee-tete').first().click();
      const det = await pg.evaluate(() => { const d = document.querySelector('[data-fraicheur-detail]'); return d ? d.innerText : ''; });
      dit(/navigateur où est l’extension VRM/.test(det), `${nom} : rangée touchée ⇒ le geste entier (le navigateur où est l’extension)`, det.slice(0, 200));
    } else if (scen === 'deux') {
      dit(s.etat === 'retard' && s.source === 'extension' && s.nRet === 2 && /2 choses à revoir/.test(s.texte), `${nom} : deux retards ⇒ « 2 choses à revoir » (la plus grave en tête du détail)`, s.texte);
      await pg.locator('[data-fraicheur-deplier]').click();
      const ordre = await pg.evaluate(() => [...document.querySelectorAll('[data-fraicheur-rangee]')].map((x) => x.getAttribute('data-fraicheur-rangee-cle') || x.getAttribute('data-fraicheur-rangee')));
      dit(ordre[0] === 'extension:muette' && ordre[1] === 'compte:vinted:111', `${nom} : le détail dans l’ordre de gravité`, ordre.join(','));
      await photo('-detail');
    } else if (scen === 'passu') {
      dit(s.etat === 'passu' && /Pas pu tout vérifier/.test(s.texte) && !s.toutAJour, `${nom} : appareils illisibles ⇒ « Pas pu tout vérifier », jamais « à jour »`, JSON.stringify(s));
      dit((await pg.locator('[data-fraicheur-reessayer]').count()) === 1, `${nom} : « Réessayer »`);
    }
    if (scen === 'frais' || scen === 'vieux') await photo(scen === 'vieux' ? '-ouvert' : '');
    dit(s.puce === 0 && s.ventesAJour === 0 && s.achats === 0, `${nom} : aucune seconde voix (puce « Relire », « Ventes à jour », ligne d’Achats)`, JSON.stringify(s));
    const hs = await pg.evaluate(() => window.__hauteursLigne || []);
    const hauteurs = [...new Set(hs.map((x) => x.split(':')[1]))];
    dit(hauteurs.length === 1, `${nom} : la ligne garde sa hauteur de « Vérification… » à la réponse (rien ne saute)`, hs.join(' → '));
    const petites = await pg.evaluate(() => [...document.querySelectorAll('.vrm-fraicheur-hote button')].filter((e) => e.getClientRects().length && e.getBoundingClientRect().height < 43.5).map((e) => e.textContent.slice(0, 30)));
    dit(!petites.length, `${nom} : cibles de 44 px`, petites.join(' | '));
  }
  dit(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${nom} : pas de débordement horizontal`);
  dit(!errs.length, `${nom} : aucune erreur d’app`, errs.join(' | ').slice(0, 200));
  await ctx.close();
}

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const scen = ['frais', 'vieux', 'baseko', 'horsligne', 'deux', 'passu'];
    const seul = process.env.BANC_SCEN ? process.env.BANC_SCEN.split(',') : scen;
    for (const s of scen.filter((x) => seul.includes(x))) for (const [l, sombre] of [[390, true], [1512, false]]) {
      try { await scenario(b, s, l, sombre); } catch (e) { dit(false, `${s}-${l} s’exécute`, String(e.message || e).slice(0, 200)); }
    }
  } catch (e) { dit(false, 'le banc s’exécute', String(e.message || e).slice(0, 200)); }
  finally {
    if (b) await b.close(); srv.close();
    console.log(ko ? `\n❌ fraicheur-unique : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ fraicheur-unique : ${ok} verts`);
    process.exit(ko ? 1 : 0);
  }
})();
