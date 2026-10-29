require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « TA CLÉ PHOTOROOM » (29 octobre) — RENDU, 390 px tactile et 1512 px,
//  clair ET sombre.        BANC_PORT=9341 node scripts/bancs/photoroom-carte.cjs
//  Julien : « fais un meilleur visuel pour la clé API Photoroom des personnes
//  qui utilisent VRM ». La carte vit sur l'écran Vestiaire Collective — PAS
//  dans les Paramètres (29 oct., revue : décision du 17 oct., « ne le mets pas
//  dans les paramètres » ; `detourage-reglage.cjs` y refuse la carte). Le VRAI
//  api/compte.js (mode photoroom) est exécuté dans ce processus, devant une
//  fausse base (clé de service, filtre owner, comparer-et-échanger) et un FAUX
//  Photoroom ; la page, elle, ne voit que ce que la route renvoie.
//  Il exige :
//    · trois états rendus : aucune clé (formulaire) · rangée (4 derniers
//      caractères, date, ce que Photoroom a répondu) · pas su (AUCUN formulaire,
//      « Réessayer ») ;
//    · la clé tapée ne réapparaît JAMAIS (ni dans la page, ni dans un champ, ni
//      dans une réponse de la route), et elle est chiffrée en base ;
//    · ce que ça coûte (SON compte Photoroom, à la photo), où elle sert
//      (Vestiaire, Studio photo — rien d'autre promis), le lien vers Photoroom ;
//    · « Retirer » demande confirmation, puis efface ;
//    · aucune couleur rouge, cibles ≥ 44 px affichés, rien ne déborde ;
//    · sombre : la carte suit le thème (fond foncé, texte clair) et inversement ;
//    · (revue du 29 oct.) « Vérifier » sans réponse de Photoroom : la dernière
//      réponse connue reste et c'est DIT ; « maintenant chiffrée » seulement si
//      la copie en clair est vraiment effacée ; « en clair » dit SA cause, sans
//      prétendre que Photoroom a été interrogé ; aucune promesse « jamais
//      repayée » ; la carte n'est dans AUCUN onglet des Paramètres.
//  Données INVENTÉES (il vit dans le dépôt).
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), http = require('http'), fs = require('fs');
const RACINE = path.join(__dirname, '..', '..');
let chromium;
try { ({ chromium } = require(path.join(RACINE, 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
const DIST = path.join(RACINE, 'dist');   // ⚠️ jamais un chemin absolu (§6.1)
const PORT = Number(process.env.BANC_PORT || 9341);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.onnx': 'application/octet-stream' };

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + String(d).slice(0, 220) : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e && e.message || e).split('\n')[0].slice(0, 180)); } };

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const JWT = `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ sub: A, email: 'alice@exemple.test', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.c2ln`;
const SESSION = { access_token: JWT, refresh_token: 'r-a', expires_at: Date.now() + 3600e3, totp: [], user: { id: A, email: 'alice@exemple.test', totp: [] } };
// Une clé INVENTÉE.
const CLE = 'prBANC7c1e0f5a9b3d2e8f6a4c0b1d9e7KQ4Z';
process.env.SUPABASE_SERVICE_KEY = 'cle-service-de-banc-photoroom';
process.env.VRM_OWNER_UID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
delete process.env.PHOTOROOM_API_KEY;

// ── La base (vue du SERVEUR, clé de service) ─────────────────────────────────
let B;
const reset = () => { B = { lignes: {}, lectureKo: false, reponses: [], prMuet: false, effacerKo: false, ecrireKo: false }; };
const projette = (data, sel) => {
  if (!sel) return { data };
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], al = m[1] || src.split(/->>|->/).pop();
    if (src === 'data') { out[al] = data; continue; }
    let v = data; for (const s of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[s];
    if (v != null && /->>/.test(src) && typeof v !== 'string') v = typeof v === 'object' ? JSON.stringify(v) : String(v);
    out[al] = v == null ? null : v;
  }
  return out;
};
function fauxSupabase(urlBrut, methode, entetes, corps) {
  const u = decodeURIComponent(String(urlBrut));
  const h = {}; for (const [k, v] of Object.entries(entetes || {})) h[k.toLowerCase()] = v;
  const tok = String(h.authorization || '').replace(/^Bearer\s+/i, '');
  const json = (b, status = 200, hh = {}) => ({ status, body: b === undefined ? '' : JSON.stringify(b), headers: { 'content-type': 'application/json', ...hh } });
  const [chemin, qs = ''] = u.split('?');
  if (/\/auth\/v1\/user/.test(chemin)) return tok === JWT ? json({ id: A, email: 'alice@exemple.test', email_confirmed_at: '2026-10-01T00:00:00Z' }) : json({ msg: 'invalid' }, 401);
  if (/\/auth\/v1\//.test(chemin)) return json(tok === JWT ? { access_token: JWT, refresh_token: 'r', expires_in: 3600, user: SESSION.user } : {});
  const rest = /\/rest\/v1\/(.+)$/.exec(chemin);
  if (!rest) return json({}, 404);
  const cible = rest[1];
  if (cible.startsWith('rpc/')) {
    const fn = cible.slice(4);
    if (fn === 'vrm_acces') return json({ obligatoire: false, proprietaire: false, acces: true });
    if (fn === 'vrm_acces_pour') return json(true);
    return json({ code: 'PGRST202' }, 404);
  }
  if (cible === 'app_data' && /^select=owner&limit=1$/.test(qs)) return json([]);
  const service = h.apikey === process.env.SUPABASE_SERVICE_KEY;
  if (cible === 'app_data' && service) {
    const q = new URLSearchParams(qs);
    const idF = (q.get('id') || '').replace(/^eq\./, ''), ownF = (q.get('owner') || '').replace(/^eq\./, '');
    // Les filtres sur un champ de `data` (comparer-et-échanger) : la FORME de
    // PostgREST, appliquée pour de vrai (§6.3).
    const filtres = [...q.entries()].filter(([k]) => k.startsWith('data->>')).map(([k, v]) => ({ k: k.slice(7), nul: v === 'is.null', v: v.replace(/^eq\./, '') }));
    const passe = (d) => !!d && filtres.every((f) => { const x = d[f.k]; return f.nul ? x == null : (x != null && String(x) === f.v); });
    const prefer = String(h.prefer || '');
    const d0 = ownF && B.lignes[ownF] && B.lignes[ownF][idF];
    if (methode === 'GET' && B.lectureKo && /photoroom/.test(idF)) return json({ message: 'boom' }, 500);
    if (methode === 'GET') return json(d0 ? [projette(d0, q.get('select'))] : []);
    if (methode === 'DELETE') {
      if (B.effacerKo && idF === 'vrm_photoroom_cle') return json({ message: 'boom' }, 500);
      const ok = passe(d0); if (ok) delete B.lignes[ownF][idF];
      return /return=representation/.test(prefer) ? json(ok ? [{ id: idF }] : []) : json(undefined, 204);
    }
    if (B.ecrireKo) return json({ message: 'boom' }, 500);
    if (methode === 'PATCH') {
      const ok = passe(d0); if (ok) B.lignes[ownF][idF] = (corps.json || {}).data;
      return /return=representation/.test(prefer) ? json(ok ? [{ id: idF }] : []) : json(undefined, 204);
    }
    if (methode === 'POST') {
      const lignes = [].concat(corps.json || []);
      const fusion = /merge-duplicates/.test(prefer);
      if (!fusion && lignes.some((r) => B.lignes[r.owner] && B.lignes[r.owner][r.id])) return json({ code: '23505', message: 'duplicate key' }, 409);
      for (const r of lignes) { B.lignes[r.owner] = B.lignes[r.owner] || {}; B.lignes[r.owner][r.id] = r.data; }
      return json(undefined, 201);
    }
  }
  if (cible.startsWith('vinted_accounts')) return json([]);
  return json([], 200, { 'content-range': '0-0/0' });
}
const fetchReel = global.fetch;
global.fetch = async (url, opts = {}) => {
  const s = String(url);
  if (/supabase\.co\//.test(s)) {
    const r = fauxSupabase(s, opts.method || 'GET', opts.headers || {}, { json: (() => { try { return JSON.parse(opts.body || 'null'); } catch (_) { return null; } })() });
    return new Response(r.body === '' ? null : r.body, { status: r.status, headers: r.headers });
  }
  if (s === 'https://image-api.photoroom.com/v2/account') {
    if (B.prMuet) return new Response('<html>503</html>', { status: 503, headers: { 'content-type': 'text/html' } });
    const k = String((opts.headers || {})['x-api-key'] || '');
    return k === CLE ? new Response(JSON.stringify({ images: { available: 83, subscription: 100 } }), { status: 200, headers: { 'content-type': 'application/json' } })
      : new Response('{"detail":"invalid api key"}', { status: 401, headers: { 'content-type': 'application/json' } });
  }
  if (/photoroom|api\.stripe\.com/.test(s)) return new Response('{}', { status: 404 });
  return fetchReel(url, opts);
};
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

let compte = null;
async function ouvrir(nav, { largeur, sombre, chemin = '/?tab=plat_vestiaire', vue = 'compte', attendre = 'carte' }) {
  const mobile = largeur < 600;
  const ctx = await nav.newContext({ viewport: { width: largeur, height: mobile ? 844 : 950 }, isMobile: mobile, hasTouch: mobile, serviceWorkers: 'block' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(({ s, sombre, vue }) => {
    try { localStorage.setItem('vinted_dark', sombre ? 'true' : 'false'); localStorage.setItem('vrm_bascule_mineral_v1', '1'); localStorage.setItem('vrm_reglages_vue', vue); } catch (_) {}
    try { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_local_owner', s.user.id); } catch (_) {}
  }, { s: SESSION, sombre, vue });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, async (r) => {
    const rq = r.request(), u = rq.url();
    if (/supabase\.co\//.test(u)) {
      const x = fauxSupabase(u, rq.method(), rq.headers(), { json: (() => { try { return JSON.parse(rq.postData() || 'null'); } catch (_) { return null; } })() });
      return r.fulfill({ status: x.status, headers: x.headers, body: x.body });
    }
    return ['image', 'media', 'font'].includes(rq.resourceType()) ? r.abort() : r.fulfill({ status: 404, body: '' });
  });
  await pg.route('**/api/**', async (r) => {
    const rq = r.request(), u = new URL(rq.url());
    const mode = u.searchParams.get('mode');
    if (u.pathname === '/api/compte' && ['photoroom', 'abonnement'].includes(mode)) {
      let corps = null; try { corps = rq.postData() ? JSON.parse(rq.postData()) : null; } catch (_) {}
      const res = { code: 200, corps: null, setHeader() {}, status(n) { this.code = n; return this; }, json(o) { this.corps = o; return this; }, end() { return this; } };
      const req = { method: rq.method(), query: Object.fromEntries(u.searchParams), headers: rq.headers(), body: corps || undefined, [Symbol.asyncIterator]() { return (async function* () {})(); } };
      await compte(req, res);
      const body = JSON.stringify(res.corps);
      if (mode === 'photoroom') B.reponses.push(body);
      return r.fulfill({ status: res.code, contentType: 'application/json', body });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await pg.goto(`http://localhost:${PORT}${chemin}`, { waitUntil: 'domcontentloaded' });
  if (attendre === 'carte') await pg.waitForFunction(() => { const e = document.querySelector('[data-photoroom-cle]'); return e && e.getAttribute('data-photoroom-cle') !== 'chargement'; }, null, { timeout: 20000 }).catch(() => {});
  else await pg.waitForFunction(() => !!document.querySelector('[data-onglets-reglages]'), null, { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(attendre === 'carte' ? 500 : 2500);
  return { ctx, pg, errs };
}
const etat = (pg) => pg.evaluate(() => { const e = document.querySelector('[data-photoroom-cle]'); return e ? e.getAttribute('data-photoroom-cle') : null; });
const texteCarte = (pg) => pg.evaluate(() => { const e = document.querySelector('[data-photoroom-cle]'); return e ? e.innerText : ''; });
const contientCle = (pg) => pg.evaluate((k) => {
  const t = document.body.innerText + ' ' + [...document.querySelectorAll('input,textarea')].map((x) => x.value).join(' ') + ' ' + document.documentElement.outerHTML;
  return t.includes(k) || t.includes(k.slice(0, 12));
}, CLE);
// Rouge (teinte proche de 0° saturée) dans la carte : interdit (§7).
const rougeDans = (pg) => pg.evaluate(() => {
  const e = document.querySelector('[data-photoroom-cle]'); if (!e) return [];
  const rouge = (c) => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c || ''); if (!m) return false; const [r, g, b] = m.slice(1).map(Number); return r > 150 && g < 90 && b < 90; };
  return [...e.querySelectorAll('*')].filter((n) => { const s = getComputedStyle(n); return rouge(s.color) || rouge(s.backgroundColor) || rouge(s.borderTopColor); }).map((n) => n.tagName + ':' + n.textContent.slice(0, 30));
});
const ciblesPetites = (pg) => pg.evaluate(() => {
  const e = document.querySelector('[data-photoroom-cle]'); if (!e) return ['carte absente'];
  return [...e.querySelectorAll('button, a[href], input')].filter((n) => n.offsetParent !== null).map((n) => ({ n, r: n.getBoundingClientRect() }))
    .filter((x) => x.r.height < 43.5).map((x) => `${x.n.tagName} « ${(x.n.innerText || x.n.getAttribute('aria-label') || '').slice(0, 24)} » ${x.r.height.toFixed(1)} px`);
});
const deborde = (pg) => pg.evaluate(() => {
  const e = document.querySelector('[data-photoroom-cle]'); if (!e) return 'carte absente';
  const r = e.getBoundingClientRect();
  const page = document.documentElement.scrollWidth > window.innerWidth + 1;
  return (page ? `page ${document.documentElement.scrollWidth} > ${window.innerWidth}` : '') + (r.right > window.innerWidth + 1 || r.left < -1 ? ` carte ${r.left.toFixed(0)}–${r.right.toFixed(0)}` : '');
});
const lum = (c) => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c || ''); if (!m) return null; const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }; const [r, g, b] = m.slice(1).map(Number); return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const couleurs = (pg) => pg.evaluate(() => {
  const e = document.querySelector('[data-photoroom-cle]'); if (!e) return null;
  let n = e, bg = 'rgba(0, 0, 0, 0)';
  while (n && /rgba\(0, 0, 0, 0\)|transparent/.test(bg)) { bg = getComputedStyle(n).backgroundColor; n = n.parentElement; }
  const titre = [...e.querySelectorAll('span')].find((s) => /^Ta clé Photoroom$/.test(s.textContent.trim()));
  return { bg, texte: titre ? getComputedStyle(titre).color : null };
});

(async () => {
  try { compte = (await import('file://' + path.join(RACINE, 'api', 'compte.js'))).default; }
  catch (e) { console.log('❌ api/compte.js ne se charge pas : ' + e.message); process.exit(1); }
  await new Promise((res, rej) => { srv.once('error', rej); srv.listen(PORT, res); }).catch((e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    for (const [largeur, sombre] of [[1512, false], [390, true], [1512, true], [390, false]]) {
      const nom = `${largeur} px${largeur < 600 ? ' tactile' : ''}, ${sombre ? 'sombre' : 'clair'}`;
      console.log(`\n── ${nom}`);
      await essaie(`carte ${nom}`, async () => {
        reset();
        let o = await ouvrir(nav, { largeur, sombre });
        if (process.env.BANC_DEBUG) await o.pg.locator('[data-photoroom-cle]').screenshot({ path: `${process.env.BANC_DEBUG}/photoroom-aucune-${largeur}-${sombre ? 'sombre' : 'clair'}.png` }).catch(() => {});
        dit(!o.errs.length, 'l\'écran Vestiaire Collective se rend sans erreur', o.errs[0]);
        dit(await etat(o.pg) === 'aucune', 'la carte « Ta clé Photoroom » est sur l\'écran Vestiaire : « aucune clé » (lue)', await etat(o.pg));
        const t0 = await texteCarte(o.pg);
        dit(/ton compte Photoroom qui paie|\bton\b compte Photoroom qui paie/i.test(t0.replace(/\s+/g, ' ')) && /à la photo/.test(t0), 'ce que ça coûte : SON compte Photoroom, à la photo', t0.slice(0, 120));
        dit(/Vestiaire Collective/.test(t0) && /Studio photo/.test(t0) && /Leboncoin et eBay gardent tes photos d'origine/.test(t0), 'où elle sert : Vestiaire, Studio photo — et Leboncoin/eBay gardent leurs photos d\'origine');
        dit(!/publi(e|er) automatiquement|tes annonces partent/i.test(t0), 'aucune publication promise');
        dit(!/jamais repay/i.test(t0) && /gardée par VRM n'est pas repayée/.test(t0), '(revue) pas de promesse « jamais repayée » : seulement ce qui est vrai (une photo gardée par VRM)', (/[^.]*repay[^.]*\./.exec(t0) || [''])[0]);
        const lien = await o.pg.$eval('[data-photoroom-lien]', (a) => ({ href: a.href, cible: a.target, rel: a.rel })).catch(() => null);
        dit(!!lien && lien.href === 'https://app.photoroom.com/api-dashboard' && lien.cible === '_blank' && /noopener/.test(lien.rel), 'le lien mène à Photoroom (API dashboard), dans un nouvel onglet', JSON.stringify(lien));
        const tarifs = await o.pg.$eval('[data-photoroom-tarifs]', (a) => a.href).catch(() => null);
        dit(tarifs === 'https://www.photoroom.com/api/pricing', 'les tarifs de Photoroom sont à un clic', tarifs);
        dit(!!(await o.pg.$('[data-photoroom-form] [data-photoroom-champ][type="password"]')), 'le formulaire : un champ masqué pour coller la clé');
        dit((await rougeDans(o.pg)).length === 0, 'aucune couleur rouge dans la carte (§7)', (await rougeDans(o.pg)).join(' · '));
        dit((await ciblesPetites(o.pg)).length === 0, 'chaque cible fait au moins 44 px affichés', (await ciblesPetites(o.pg)).join(' · '));
        dit(!(await deborde(o.pg)), 'rien ne déborde de l\'écran', await deborde(o.pg));
        const c = await couleurs(o.pg); const lb = c && lum(c.bg), lt = c && lum(c.texte);
        dit(c && lb != null && lt != null && (sombre ? (lb < 0.2 && lt > 0.5) : (lb > 0.6 && lt < 0.2)), `la carte suit le thème (${sombre ? 'fond foncé, texte clair' : 'fond clair, texte foncé'})`, JSON.stringify(c));

        // ── Poser la clé ─────────────────────────────────────────────────────
        await o.pg.fill('[data-photoroom-champ]', CLE);
        await o.pg.click('[data-photoroom-enregistrer]');
        await o.pg.waitForFunction(() => document.querySelector('[data-photoroom-cle]')?.getAttribute('data-photoroom-cle') === 'posee', null, { timeout: 10000 }).catch(() => {});
        dit(await etat(o.pg) === 'posee', '« Vérifier et ranger » ⇒ la carte dit « rangée »');
        const ligne = B.lignes[A] && B.lignes[A].photoroom_cle;
        dit(!!ligne && /^v1\./.test(ligne.chiffre || '') && !JSON.stringify(ligne).includes(CLE), 'en base : chiffrée, jamais en clair', JSON.stringify(ligne || null).slice(0, 80));
        dit(!(await contientCle(o.pg)), 'la clé tapée n\'est plus nulle part dans la page (ni texte, ni champ, ni HTML)');
        const fin = await o.pg.$eval('[data-photoroom-fin]', (e) => ({ a: e.getAttribute('data-photoroom-fin'), t: e.innerText })).catch(() => null);
        dit(!!fin && fin.a === CLE.slice(-4) && fin.t.includes(CLE.slice(-4)) && /••••/.test(fin.t), 'seuls ses 4 derniers caractères sont montrés (•••• ' + CLE.slice(-4) + ')', JSON.stringify(fin));
        await o.ctx.close();

        // ── Rouvrir : l'état vient du serveur ────────────────────────────────
        o = await ouvrir(nav, { largeur, sombre });
        const t1 = await texteCarte(o.pg);
        dit(await etat(o.pg) === 'posee' && t1.includes(CLE.slice(-4)) && /rangée le/.test(t1), 'rouverte : « rangée le … », 4 derniers caractères', t1.slice(0, 160).replace(/\s+/g, ' '));
        dit(/Photoroom l'a acceptée/.test(t1) && /83 images/.test(t1), 'ce que Photoroom a répondu : acceptée, 83 images restantes (lu, jamais inventé)');
        dit(!(await contientCle(o.pg)), 'rouverte : la clé n\'est nulle part dans la page');
        dit(B.reponses.every((x) => !x.includes(CLE) && !x.includes(CLE.slice(0, 12)) && !/chiffre/.test(x)), 'aucune réponse de la route ne contient la clé (ni le chiffré)', B.reponses.length + ' réponse(s)');
        dit(!(await o.pg.$('[data-photoroom-form]')), 'clé rangée : pas de formulaire ouvert d\'office (« Remplacer » l\'ouvre)');
        dit((await ciblesPetites(o.pg)).length === 0, 'rangée : chaque cible fait au moins 44 px affichés', (await ciblesPetites(o.pg)).join(' · '));
        dit(!(await deborde(o.pg)), 'rangée : rien ne déborde', await deborde(o.pg));
        if (process.env.BANC_DEBUG) await o.pg.locator('[data-photoroom-cle]').screenshot({ path: `${process.env.BANC_DEBUG}/photoroom-posee-${largeur}-${sombre ? 'sombre' : 'clair'}.png` }).catch(() => {});

        // ── Retirer : confirmé, puis effacé ──────────────────────────────────
        await o.pg.click('[data-photoroom-retirer]');
        await o.pg.waitForTimeout(500);
        dit(!!(B.lignes[A] && B.lignes[A].photoroom_cle), 'un clic sur « Retirer » ne retire rien avant la confirmation');
        const ok2 = o.pg.getByRole('button', { name: 'Retirer la clé' });
        if (await ok2.count()) await ok2.first().click(); else await o.pg.keyboard.press('Enter');
        await o.pg.waitForFunction(() => document.querySelector('[data-photoroom-cle]')?.getAttribute('data-photoroom-cle') === 'aucune', null, { timeout: 10000 }).catch(() => {});
        dit(await etat(o.pg) === 'aucune' && !(B.lignes[A] && B.lignes[A].photoroom_cle), 'confirmé ⇒ la clé est effacée, la carte redit « aucune clé »');
        await o.ctx.close();

        // ── Pas su ───────────────────────────────────────────────────────────
        reset(); B.lectureKo = true;
        o = await ouvrir(nav, { largeur, sombre });
        dit(await etat(o.pg) === 'pas-su' && !(await o.pg.$('[data-photoroom-form]')) && !!(await o.pg.$('[data-photoroom-relire]')), 'base muette ⇒ « pas su » : aucun formulaire, « Réessayer » — jamais « aucune clé »', await etat(o.pg));
        dit(!/Aucune clé/.test(await texteCarte(o.pg)), 'pas su : la pastille ne dit pas « Aucune clé »');
        await o.ctx.close();
      });
    }

    // ══ REVUE DU 29 OCTOBRE ═════════════════════════════════════════════════
    const msgCarte = (pg) => pg.evaluate(() => { const e = document.querySelector('[data-photoroom-msg]'); return e ? { ton: e.getAttribute('data-photoroom-msg'), t: e.innerText } : null; });
    for (const [largeur, sombre] of [[390, false], [1512, true]]) {
      const nom = `${largeur} px${largeur < 600 ? ' tactile' : ''}, ${sombre ? 'sombre' : 'clair'}`;
      console.log(`\n── revue · ${nom}`);
      await essaie(`paramètres ${nom}`, async () => {
        reset();
        for (const vue of ['compte', 'reglages']) {
          const o = await ouvrir(nav, { largeur, sombre, chemin: `/?tab=settings&vue=${vue}`, vue, attendre: 'parametres' });
          const r = await o.pg.evaluate(() => ({ cartes: document.querySelectorAll('[data-photoroom-cle]').length, rendu: !!document.querySelector('[data-onglets-reglages]') }));
          dit(r.rendu && r.cartes === 0, `Paramètres (${vue === 'compte' ? 'Mon compte' : 'Réglages'}) : AUCUNE carte Photoroom (décision du 17 oct.) — et l'écran est bien rendu`, JSON.stringify(r));
          await o.ctx.close();
        }
      });
      await essaie(`vérifier sans réponse ${nom}`, async () => {
        reset();
        let o = await ouvrir(nav, { largeur, sombre });
        await o.pg.fill('[data-photoroom-champ]', CLE);
        await o.pg.click('[data-photoroom-enregistrer]');
        await o.pg.waitForFunction(() => document.querySelector('[data-photoroom-cle]')?.getAttribute('data-photoroom-cle') === 'posee', null, { timeout: 10000 }).catch(() => {});
        B.prMuet = true;
        await o.pg.click('[data-photoroom-verifier]');
        await o.pg.waitForFunction(() => /répondu|abouti|réessaie/.test(document.querySelector('[data-photoroom-msg]')?.innerText || '') && !/Vérification…/.test(document.querySelector('[data-photoroom-verifier]')?.innerText || ''), null, { timeout: 12000 }).catch(() => {});
        const m = await msgCarte(o.pg);
        const v = await o.pg.$eval('[data-photoroom-verif]', (e) => ({ a: e.getAttribute('data-photoroom-verif'), t: e.innerText })).catch(() => null);
        dit(!!m && /n'a pas répondu/.test(m.t) && /acceptée/.test(m.t), '« Vérifier » sans réponse de Photoroom : l\'écran le DIT et nomme la dernière réponse (acceptée, le …)', m && m.t);
        dit(!!v && v.a === 'ok' && /acceptée/.test(v.t) && /83 images/.test(v.t), 'et la carte garde « Photoroom l\'a acceptée · 83 images » (rien n\'est effacé)', v && v.t);
        dit(B.lignes[A].photoroom_cle.verif === 'ok' && B.lignes[A].photoroom_cle.restant === 83, 'en base : la vérification d\'avant reste', JSON.stringify({ v: B.lignes[A].photoroom_cle.verif, r: B.lignes[A].photoroom_cle.restant }));
        dit((await rougeDans(o.pg)).length === 0, 'aucune couleur rouge', (await rougeDans(o.pg)).join(' · '));
        await o.ctx.close();
      });
      await essaie(`migration ${nom}`, async () => {
        reset();
        B.lignes[A] = { vrm_photoroom_cle: { cle: CLE, at: '2026-10-26T10:00:00.000Z' } };
        B.effacerKo = true;
        let o = await ouvrir(nav, { largeur, sombre });
        let m = await msgCarte(o.pg);
        dit(await etat(o.pg) === 'posee' && !!B.lignes[A].photoroom_cle, 'ancienne clé en clair : rangée chiffrée au coffre', await etat(o.pg));
        dit(!!m && m.ton === 'attention' && /n'a pas pu être effacée/.test(m.t) && !/maintenant chiffrée/.test(m.t), 'effacement raté : « maintenant chiffrée » n\'est PAS dit ; la copie restante l\'est, avec « je réessaie »', m && m.t);
        dit(!(await contientCle(o.pg)), 'la clé n\'est nulle part dans la page');
        await o.ctx.close();
        B.effacerKo = false;
        o = await ouvrir(nav, { largeur, sombre });
        m = await msgCarte(o.pg);
        dit(!B.lignes[A].vrm_photoroom_cle, 'l\'ouverture suivante efface la copie en clair', Object.keys(B.lignes[A]).join(','));
        dit(!!m && /effacée/.test(m.t) && m.ton !== 'attention', 'et l\'écran dit qu\'elle est maintenant effacée', m && m.t);
        await o.ctx.close();
      });
      await essaie(`en clair ${nom}`, async () => {
        reset();
        B.lignes[A] = { vrm_photoroom_cle: { cle: CLE, at: '2026-10-26T10:00:00.000Z' } };
        B.ecrireKo = true;
        const o = await ouvrir(nav, { largeur, sombre });
        const t = await texteCarte(o.pg);
        const c = await o.pg.$eval('[data-photoroom-en-clair]', (e) => e.getAttribute('data-photoroom-en-clair')).catch(() => null);
        dit(await etat(o.pg) === 'en-clair' && c === 'rangement-rate', 'rangement raté : « en clair », cause « rangement raté »', `${await etat(o.pg)} · ${c}`);
        dit(!/coffre du serveur n'est pas configuré/.test(t), 'jamais « le coffre du serveur n\'est pas configuré » quand il l\'est', t.replace(/\s+/g, ' ').slice(0, 200));
        dit(!/n'a pas répondu|réponse lisible/.test(t), 'jamais « Photoroom n\'a pas répondu » : on ne lui a rien demandé', t.replace(/\s+/g, ' ').slice(0, 200));
        await o.ctx.close();
      });
    }
  } catch (e) { ko++; console.log('❌ le banc a levé — ' + (e && e.message)); }
  await nav.close(); srv.close();
  console.log(`\n${ko ? '❌ ' + ko + ' contrôle(s) au rouge' : '✅ tout est vert'} (${ok} ok)`);
  process.exit(ko ? 1 : 0);
})();
