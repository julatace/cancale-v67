require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));   // heures calmes : midi (Paris)
// ════════════════════════════════════════════════════════════════════════════
//  FINITIONS DU 12 NOV. — les défauts VUS en passant chaque écran (390 tactile,
//  1512, clair et sombre), jugés sur les boîtes RENDUES, jamais sur un libellé.
//  Base INVENTÉE (_base-volume.cjs, 3 comptes, même cadre que revue-design-captures),
//  garde réseau : rien ne sort. `BANC_PORT`, `BANC_DIST`, `CAPTURES=dossier`.
//   A. Catalogue : « Chercher » tient sur UNE ligne (il se coupait « Cherc / her »).
//   B. Stock Vinted : la marge de l'écran, « Ajouter » dans la largeur.
//   C. Argent → Factures, vide : la phrase et « + Nouvelle facture » dans la carte
//      (ils étaient centrés dans un tableau de 700 px, coupés au bord).
//   D. Ventes (l'ancien écran) : « Aucune vente » se lit en entier.
//   E. Ventes · Leboncoin : « À expédier » à la marge, pas de 2e grand titre.
//   F. Réglages → Numéros : « Ouvrir mes annonces » ne chevauche pas la phrase.
//   G. Ventes · À expédier : « N à imprimer » n'est pas redit sous « Tout imprimer (N) ».
//   H. Facturation électronique : ni « e-reporting », ni « JSON », ni « Factur-X » à l'écran (fichiers inchangés).
//   I. « Republier » choisi à l'instant : le bandeau « Affiché avec » ne le redit pas.
//   J. À expédier : le « … » de chaque carte se touche (il passait sous « Imprimer » / « Générer »).
//  (Le lien « Favoris » est jugé par navigation-fusion.cjs, partie L.)
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), http = require('http'), fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { fabriquer } = require(path.join(__dirname, '_base-volume.cjs'));
const { servir } = require('./_minipgrest.cjs');
const { metaVersData } = require('./_meta.cjs');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 10412;
const SORTIE = process.env.CAPTURES || '';
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const QUOI = liste('QUOI', 'ecrans,feuilles,public,neuf');
const ECRANS_VOULUS = liste('ECRANS', '');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.webp': 'image/webp' };
const UID = '7a1e0c55-2b1d-4c3e-9f00-0000000000e7';
const SESSION = { access_token: 'jeton-revue', refresh_token: 'r', expires_at: Date.now() + 3600e3, user: { id: UID, email: 'vendeur.exemple@exemple.test', user_metadata: { full_name: 'Camille Exemple' } } };

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0];
  if (/^\/f\//.test(f)) f = '/formateur.html';
  if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!p.startsWith(DIST) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

// Une vignette inventée : fond pastel + silhouette de chaussure (aucune photo réelle).
const vignette = (graine) => {
  let h = 0; for (const c of String(graine)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const teinte = h % 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect width="400" height="400" fill="hsl(${teinte},28%,88%)"/><path d="M70 250 C90 200 140 190 170 170 L210 150 C230 175 260 185 300 190 C330 195 345 215 340 245 L340 262 L70 262 Z" fill="hsl(${teinte},35%,${35 + (h % 30)}%)"/><rect x="70" y="262" width="270" height="16" rx="6" fill="#f4f4f4"/></svg>`;
};

function base({ neuve = false } = {}) {
  const b = fabriquer({ comptes: 3 });
  const m = b.main[0].data;
  const at = '2026-11-01T10:00:00.000Z';
  m.vrm_bienvenue_vue = { at }; m.vrm_visite_vue = { at };
  m.vrm_je_vends = { choix: 'sneakers', at };
  m.vrm_configuration = { etat: 'fait', at, statut: null, version: 1 };
  m.vrm_plateformes_affichees = { sites: ['vinted', 'leboncoin', 'ebay'], at };
  m.vrm_parcours = { etat: 'fini', at };
  // Un navigateur inventé où tourne l'extension (sinon le bandeau « jamais vue » couvre tout).
  const vus = {}; for (const a of b.accounts) vus[a.vinted_user_id] = Date.now() - 120000;
  b.rows.push({ id: 'ext_appareil_0123456789abcdef', data: { appareil: { paquet: 'chromium', nav: 'chrome', systeme: 'mac' }, ver: '5.344.0', code: '5.344.0', atMs: Date.now() - 60000, flux: {}, vus: { vinted: vus } } });
  if (neuve) { b.rows = []; b.accounts = []; b.main[0].data = { vrm_bienvenue_vue: { at }, vrm_visite_vue: { at } }; }
  return b;
}

async function ouvrir(nav, { W, sombre, b, url = '/?tab=journee', session = true }) {
  const tel = W < 600;
  const ctx = await nav.newContext({ ...(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : { viewport: { width: 1512, height: 950 } }), colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const pg = await ctx.newPage();
  const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push(String(e.message || e).slice(0, 200)));
  await pg.addInitScript(([s, sombre, session]) => {
    try {
      if (!sessionStorage.getItem('banc_init')) {
        localStorage.setItem('vrm_banc_vends', '1');
        if (session) { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_local_owner', s.user.id); }
        localStorage.setItem('vinted_dark', sombre ? 'true' : 'false');
        localStorage.setItem('vrm_bienvenue_vue', JSON.stringify({ at: 'banc' }));
        localStorage.setItem('vrm_visite_vue', JSON.stringify({ at: 'banc' }));
        localStorage.setItem('vrm_aide_installation_vue', '1');
        sessionStorage.setItem('banc_init', '1');
      }
    } catch (_) {}
  }, [SESSION, sombre, session]);
  // Garde réseau : rien ne sort. Les photos Vinted deviennent des vignettes inventées.
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    if (/vinted\.net|vinted\.fr\/.*\.(jpe?g|png|webp)/i.test(u) || r.request().resourceType() === 'image') return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: vignette(u) });
    if (/\/auth\/v1\/settings/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ external: { email: true, google: true, discord: true } }) });
    if (/\/auth\/v1\//.test(u)) return session ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: SESSION.access_token, refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }) : r.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
    if (/\/rest\/v1\//.test(u)) return rest(r, b);
    return r.abort();
  });
  await pg.route('**/api/**', (r) => {
    const u = r.request().url();
    if (/mode=abonnement/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, proprietaire: true, acces: true }) });
    if (/mode=appareils/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, appareils: [
      { id: 'a1b2c3d4-0000-4000-8000-000000000001', appareil: 'iPhone · Safari', actifLe: new Date().toISOString(), ici: true },
      { id: 'b2c3d4e5-0000-4000-8000-000000000002', appareil: 'Mac · Chrome', actifLe: new Date(Date.now() - 3 * 3600e3).toISOString(), ici: false },
      { id: 'c3d4e5f6-0000-4000-8000-000000000003', appareil: 'Mac · Orion', actifLe: new Date(Date.now() - 26 * 3600e3).toISOString(), ici: false },
      { id: 'd4e5f6a7-0000-4000-8000-000000000004', appareil: 'iPad · Safari', actifLe: new Date(Date.now() - 6 * 86400e3).toISOString(), ici: false },
    ] }) });
    if (/mode=formateur/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, page: { nom: 'Atelier Exemple', adresse: 'atelier-exemple', presentation: 'Je forme des revendeurs débutants : sourcing, photos, prix, expédition. Groupes de 10, un rendez-vous par semaine.', groupes: [
      { id: '11111111-2222-4333-8444-555555555555', nom: 'Débuter sur Vinted', description: 'Quatre semaines pour passer de 0 à 20 ventes.' },
      { id: '11111111-2222-4333-8444-666666666666', nom: 'Passer à Leboncoin et eBay', description: 'Publier partout sans doubler une vente.' },
    ] } }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await pg.route('**/rest/v1/**', (r) => rest(r, b));
  await pg.goto(`http://localhost:${PORT}${url}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, erreurs, tel };
}
async function rest(route, b) {
  const req = route.request(), m = req.method();
  const u = decodeURIComponent(req.url());
  if (/\/rest\/v1\/rpc\//.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
  if (m !== 'GET' && m !== 'HEAD') return route.fulfill({ status: m === 'POST' ? 201 : 200, contentType: 'application/json', body: m === 'PATCH' ? '[{"id":"main"}]' : '[]' });
  if (/\/rest\/v1\/vinted_accounts/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b.accounts.map((a) => ({ ...a, owner: UID }))) });
  if (!/\/rest\/v1\/app_data/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  const lignes = [...b.main, ...b.rows].map((l) => ({ owner: UID, updated_at: new Date().toISOString(), ...l }));
  const r = servir(lignes, decodeURIComponent(metaVersData(req.url())), req.headers());
  return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': r.range || '0-0/0' }, body: JSON.stringify(r.body) });
}

let rouges = 0, verts = 0;
const dit = (ok, quoi, detail) => { if (ok) verts++; else rouges++; console.log(`${ok ? '  ✅' : '  ❌'} ${quoi}${ok ? '' : ' — ' + String(detail == null ? '' : detail).slice(0, 300)}`); };
const pret = async (pg) => { await pg.waitForSelector('.vrm-main', { timeout: 25000 }).catch(() => {}); await pg.waitForTimeout(2600); };
const attendre = async (pg, fn, arg, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await pg.evaluate(fn, arg).catch(() => null); if (v) return v; await pg.waitForTimeout(250); } return null; };
const capture = async (pg, nom) => { if (!SORTIE) return; fs.mkdirSync(SORTIE, { recursive: true }); await pg.screenshot({ path: path.join(SORTIE, nom + '.jpg'), type: 'jpeg', quality: 70 }); };
// Le bord droit visible d'un élément : celui du premier ancêtre qui coupe (overflow), sinon la fenêtre.
const COUPE = `(e) => { let a = e.parentElement; while (a) { const o = getComputedStyle(a).overflowX; if (o !== 'visible') return Math.min(innerWidth, a.getBoundingClientRect().right); a = a.parentElement; } return innerWidth; }`;

(async () => {
  await new Promise((ok) => srv.listen(PORT, ok));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  // Sonde (mise au point) : `SONDE=fichier.js SONDE_URL=/?tab=… [SONDE_W=390]` — affiche l'évaluation, ne juge rien.
  if (process.env.SONDE) { for (const W of String(process.env.SONDE_W || '390,1512').split(',').map(Number)) { const o = await ouvrir(nav, { W, sombre: false, b: base(), url: process.env.SONDE_URL || '/?tab=journee' }); await pret(o.pg); console.log(W, JSON.stringify(await o.pg.evaluate(fs.readFileSync(process.env.SONDE, 'utf8')).catch((e) => String(e)))); if (SORTIE) await capture(o.pg, 'sonde-' + W); await o.ctx.close(); } await nav.close(); srv.close(); return; }
  for (const W of [390, 1512]) for (const sombre of [false, true]) {
    const T = `${W} ${sombre ? 'sombre' : 'clair'}`, s = `${W}-${sombre ? 's' : 'c'}`;
    console.log('── ' + T);
    const essai = async (url, fn) => {
      const o = await ouvrir(nav, { W, sombre, b: base(), url });
      try { await pret(o.pg); await o.pg.evaluate(`window.__coupe = ${COUPE}`); await fn(o.pg); dit(!o.erreurs.length, `${T} ${url} sans erreur`, o.erreurs.join(' | ')); } catch (e) { dit(false, `${T} ${url}`, e.message); }
      await o.ctx.close();
    };
    // A
    await essai('/?tab=catalog', async (pg) => {
      const r = await attendre(pg, () => { const b = [...document.querySelectorAll('.vrm-main button')].find((e) => e.innerText.replace(/\s+/g, '') === 'Chercher'); if (!b) return null; const t = document.createRange(); t.selectNodeContents(b); const l = new Set([...t.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top))); return { lignes: l.size }; });
      dit(r && r.lignes === 1, `A ${T} Catalogue : « Chercher » sur une ligne`, JSON.stringify(r)); await capture(pg, `A-catalogue-${s}`);
    });
    // B
    await essai('/?tab=stockvinted', async (pg) => {
      const r = await attendre(pg, () => { const h = [...document.querySelectorAll('.vrm-main h1, .vrm-main h2')].find((e) => /Stock Vinted/.test(e.innerText)); const a = [...document.querySelectorAll('.vrm-main button')].find((e) => e.innerText.trim() === 'Ajouter'); if (!h || !a) return null; return { titre: Math.round(h.getBoundingClientRect().left - document.querySelector('.vrm-main').getBoundingClientRect().left), ajouter: Math.round(window.__coupe(a) - a.getBoundingClientRect().right) }; });
      dit(r && r.titre >= 12 && r.ajouter >= 8, `B ${T} Stock Vinted : marge à gauche, « Ajouter » dans l'écran`, JSON.stringify(r)); await capture(pg, `B-stockvinted-${s}`);
    });
    // C
    await essai('/?tab=invoices', async (pg) => {
      const r = await attendre(pg, () => { const e = [...document.querySelectorAll('.vrm-main td, .vrm-main div')].filter((x) => /^Aucune facture en attente\./.test((x.innerText || '').trim())).pop(); if (!e) return null; const btn = [...e.querySelectorAll('button')].find((b) => /Nouvelle facture/.test(b.innerText)); const rg = document.createRange(); rg.selectNodeContents(e); const t = [...rg.getClientRects()].filter((x) => x.width > 0); const droite = Math.max(...t.map((x) => x.right)); return { droite: Math.round(droite), bouton: btn ? Math.round(btn.getBoundingClientRect().right) : null, coupe: Math.round(window.__coupe(e)) }; });
      dit(r && r.droite <= r.coupe + 1 && r.bouton != null && r.bouton <= r.coupe + 1, `C ${T} Factures vides : la phrase et « + Nouvelle facture » dans la carte`, JSON.stringify(r)); await capture(pg, `C-factures-${s}`);
    });
    // D
    await essai('/?tab=sales', async (pg) => {
      const r = await attendre(pg, () => { const e = [...document.querySelectorAll('.vrm-main td')].find((x) => x.innerText.trim() === 'Aucune vente'); if (!e) return null; const rg = document.createRange(); rg.selectNodeContents(e); const t = rg.getBoundingClientRect(); return { droite: Math.round(t.right), coupe: Math.round(window.__coupe(e)) }; });
      dit(r && r.droite <= r.coupe + 1, `D ${T} Ventes (ancien écran) : « Aucune vente » se lit en entier`, JSON.stringify(r));
    });
    // E
    await essai('/?tab=plat_leboncoin&section=colis', async (pg) => {
      const r = await attendre(pg, () => { const h = document.querySelector('[data-colis-site="leboncoin"] .vrm-colis-section-titre'); const z = document.querySelector('[data-colis-leboncoin]'); if (!h || !z) return null; const m = document.querySelector('.vrm-main').getBoundingClientRect().left; const titres = [...z.querySelectorAll('h1, h2')].map((x) => x.innerText.trim()); return { gauche: Math.round(h.getBoundingClientRect().left - m), titres }; });
      dit(r && r.gauche >= 12 && !r.titres.some((t) => /Colis Leboncoin/.test(t)), `E ${T} Ventes · Leboncoin : « À expédier » à la marge, sans 2e grand titre`, JSON.stringify(r)); await capture(pg, `E-leboncoin-${s}`);
    });
    // F
    await essai('/?tab=settings&reglage=numeros&section=numeros', async (pg) => {
      const r = await attendre(pg, () => { const b = document.querySelector('[data-numero-ecrit-ouvrir-annonces]'); if (!b) return null; const p = b.parentElement; const rg = document.createRange(); rg.setStart(p, 0); rg.setEndBefore(b); const lignes = [...rg.getClientRects()].filter((x) => x.width > 0); const br = b.getBoundingClientRect(); const chev = lignes.filter((l) => l.bottom > br.top + 1 && l.top < br.bottom - 1 && l.right > br.left + 1 && l.left < br.right - 1).length; return { chev, h: Math.round(br.height) }; }, null, 25000);
      dit(r && r.chev === 0 && r.h >= 44, `F ${T} Numéros : « Ouvrir mes annonces » ne chevauche pas la phrase (44 px)`, JSON.stringify(r)); await capture(pg, `F-numeros-${s}`);
    });
    // G
    await essai('/?tab=cat_bord', async (pg) => {
      const r = await attendre(pg, () => { const b = document.querySelector('[data-colis-barre-btn="imprimer"][data-imprimer-prets]'); if (!b || b.getAttribute('data-imprimer-prets') === '0') return null; const c = document.querySelector('[data-colis-resume="ventes"] [data-colis-resume-case="imprimer"]'); return { bouton: b.getAttribute('data-imprimer-prets'), caseN: c ? c.getAttribute('data-n') : null }; }, null, 25000);
      dit(r && r.caseN !== r.bouton, `G ${T} À expédier : le nombre de « Tout imprimer » n'est pas redit dessous`, JSON.stringify(r));
    });
    // H
    await essai('/?tab=invoices', async (pg) => {
      const r = await attendre(pg, () => { const b = document.querySelector('[data-fe-recap-json]'); if (!b) return null; const c = b.closest('.vrm-surface') || b.closest('section') || b.parentElement.parentElement.parentElement; return { texte: c.innerText.slice(0, 3000) }; }, null, 20000);
      const mots = r ? (r.texte.match(/e-reporting|JSON|Factur-X/gi) || []) : null;
      dit(mots && !mots.length, `H ${T} Facturation électronique en mots du quotidien (ni « e-reporting », ni « JSON », ni « Factur-X »)`, r ? mots.join(',') : 'carte absente');
    });
    // I
    await essai('/?tab=republier', async (pg) => {
      const r = await attendre(pg, () => { const v = document.querySelector('[data-selection-vue="republier"], [data-qr-carte], .vrm-ann-geste'); return v ? { bandeau: (document.querySelector('[data-reprise-retenue]') || { innerText: '' }).innerText } : null; }, null, 20000);
      await pg.waitForTimeout(1200);
      const b = await pg.evaluate(() => (document.querySelector('[data-reprise-retenue]') || { innerText: '' }).innerText);
      dit(r && !/Republier/.test(b) && !/Tri\s*:\s*Republier/.test(b), `I ${T} « Republier » choisi à l'instant : pas redit par le bandeau « Affiché avec »`, b);
    });
    // J
    await essai('/?tab=cat_bord', async (pg) => {
      const r = await attendre(pg, () => { const cs = [...document.querySelectorAll('.vrm-colis-carte[data-bord-card]')].filter((c) => c.getBoundingClientRect().height > 0 && c.querySelector('[data-colis-plus]')); if (!cs.length) return null; let ko = []; for (const c of cs.slice(0, 12)) { c.scrollIntoView({ block: 'center' }); const p = c.querySelector('[data-colis-plus]'); const r = p.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); const bord = c.querySelector('.vrm-rangee-bord > :is(button, a):not([data-colis-plus]), .vrm-rangee-bord [data-bouton-bord] button'); const rb = bord ? bord.getBoundingClientRect() : null; const ligne = !rb || Math.abs((rb.top + rb.height / 2) - (r.top + r.height / 2)) <= 4; const apart = !rb || r.right <= rb.left + 1 || r.left >= rb.right - 1; if (!(h && p.contains(h)) || r.width < 43.5 || r.height < 43.5 || !ligne || !apart) ko.push(c.getAttribute('data-colis-ident') || c.getAttribute('data-tx-colis') || '?'); } return { n: Math.min(cs.length, 12), ko }; }, null, 25000);
      dit(r && r.n > 0 && !r.ko.length, `J ${T} À expédier : le « … » de chaque carte se touche (44 px, rien dessus, sur la ligne du bouton du bordereau, à côté)`, JSON.stringify(r));
      await pg.evaluate(() => { const c = document.querySelector('.vrm-colis-carte[data-bord-card]'); if (c) c.scrollIntoView({ block: 'center' }); }); await capture(pg, `J-cartes-${s}`);
    });
  }
  await nav.close(); srv.close();
  console.log(`\n${rouges ? '❌' : '✅'} finitions-12nov : ${verts} vert(s), ${rouges} rouge(s)`);
  process.exit(rouges ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
