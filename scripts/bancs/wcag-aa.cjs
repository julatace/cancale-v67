require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));   // heures calmes : midi (Paris) pour ce banc
// ════════════════════════════════════════════════════════════════════════════
//  BANC « WCAG 2.1 AA » des 6 écrans principaux (24 nov., Julien : plugin fairmind-design,
//  skill `fairmind-design:wcag-quick-reference` comme référence).
//
//  Base INVENTÉE au volume d'un vrai vendeur (`_base-volume.cjs`, 3 comptes, aucune fx/,
//  aucune écriture réelle), build servi (dist/), Chromium du banc. Écrans : Ma journée,
//  Annonces, Ventes, Achats, Messages, Argent — à 390 px tactile et 1512 px, clair ET sombre.
//
//  Par écran, mesuré sur la page RENDUE :
//   A  axe-core (wcag2a/aa, wcag21a/aa + aria-allowed-role, aria-dialog-name) : aucune violation
//      « serious »/« critical » — sauf celles que la PR #1376 (main-vert) corrige déjà
//      (`PAR_1376`, nommées une par une : ce banc ne les refait pas, il ne les compte pas).
//   B  1.4.3 contraste du texte mesuré sur les PIXELS (`_a11y-mesure.cjs`) : ≥ 4,5:1 (3:1 en grand).
//   C  44 × 44 px au doigt (390 tactile, clair).
//   D  4.1.2 aucun contrôle sans nom dans l'arbre d'accessibilité de Chrome (hors `PAR_1376`).
//   E  2.4.7 + 1.4.11 (1512) 40 Tab : chaque arrêt porte un anneau visible, et sa couleur
//      fait ≥ 3:1 contre le fond SUR lequel il est dessiné (mesuré : pixels autour de l'élément,
//      anneau effacé ⇒ fond ; couleur de l'anneau lue dans le style calculé).
//   F  4.1.3 la zone des messages passagers existe AVANT le premier message, est une région
//      vivante (`aria-live`) et son rôle autorise son nom (`role="status"`).
//   G  Les feuilles trouvées par l'inventaire (QUOI=inventaire) sans aria-modal : la période d'Achats (390) et
//      la conversation de Messages (feuille au téléphone, volet à l'ordinateur) — role=dialog, nommée dans la
//      langue choisie, aria-modal="true" quand elle recouvre l'écran (et pas quand c'est un volet).
//   H  3.1.1 <html lang> suit la langue choisie (`vrm_langue` = en / de) — et « fr » sans choix.
//
//  BANC_MUTATION=pops|contraste|gris|noms|libelle|filnom|feuille|anneau|lang ré-affaiblit une correction après l'ouverture : le
//  banc doit sortir ROUGE (`--prouve` les joue toutes et exige chacune rouge).
//  Variables : BANC_PORT, BANC_DIST, CAPTURES=<dossier>, LARGEURS=390,1512, THEMES=clair,sombre,
//  ECRANS=journee,…, QUOI=ecrans,feuilles,langue.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), http = require('http'), fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { fabriquer } = require(path.join(__dirname, '_base-volume.cjs'));
const { servir } = require('./_minipgrest.cjs');
const { metaVersData } = require('./_meta.cjs');
const M = require('./_a11y-mesure.cjs');

if (process.argv.includes('--prouve')) {
  // Chaque mutation doit faire sortir le banc ROUGE (sinon le contrôle ne peut pas échouer).
  const { spawnSync } = require('child_process');
  const MUTS = { pops: 'ECRANS=journee LARGEURS=390 THEMES=clair QUOI=ecrans', contraste: 'ECRANS=journee LARGEURS=1512 THEMES=sombre QUOI=ecrans', gris: 'ECRANS=journee LARGEURS=1512 THEMES=clair QUOI=ecrans', noms: 'ECRANS=achats LARGEURS=390 THEMES=clair QUOI=ecrans', libelle: 'ECRANS=messages LARGEURS=390 THEMES=clair QUOI=ecrans', filnom: 'ECRANS=messages LARGEURS=390 THEMES=clair QUOI=ecrans', anneau: 'ECRANS=ventes LARGEURS=1512 THEMES=sombre QUOI=ecrans', feuille: 'QUOI=feuilles LARGEURS=390 THEMES=clair', lang: 'QUOI=langue' };
  let bon = 0;
  for (const [m, env] of Object.entries(MUTS)) {
    const e = { ...process.env, BANC_MUTATION: m }; for (const kv of env.split(' ')) { const [k, v] = kv.split('='); e[k] = v; }
    const r = spawnSync(process.execPath, [__filename], { env: e, encoding: 'utf8' });
    const rouge = r.status !== 0 && /❌/.test(r.stdout);
    if (rouge) bon++;
    console.log(`${rouge ? '  ✅' : '  ❌'} mutation « ${m} » ⇒ banc ROUGE${rouge ? '' : ' — resté vert :\n' + r.stdout.slice(-800)}`);
    if (rouge) console.log('      ' + (r.stdout.split('\n').find((l) => l.includes('❌')) || '').trim().slice(0, 220));
  }
  console.log(`\n${bon}/${Object.keys(MUTS).length} mutations rouges`);
  process.exit(bon === Object.keys(MUTS).length ? 0 : 1);
}

const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 10933;
const SORTIE = process.env.CAPTURES || '';
const MUT = process.env.BANC_MUTATION || '';
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const QUOI = liste('QUOI', 'ecrans,feuilles,langue');
const ECRANS_VOULUS = liste('ECRANS', '');
const ECRANS = [['journee', 'Ma journée'], ['annonces', 'Annonces'], ['ventes', 'Ventes'], ['achats', 'Achats'], ['messages', 'Messages'], ['compta', 'Argent']]
  .filter(([t]) => !ECRANS_VOULUS.length || ECRANS_VOULUS.includes(t));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.webp': 'image/webp', '.wasm': 'application/wasm' };
const UID = '7a1e0c55-2b1d-4c3e-9f00-0000000000e7';
const SESSION = { access_token: 'jeton-banc', refresh_token: 'r', expires_at: Date.now() + 3600e3, user: { id: UID, email: 'vendeur.exemple@exemple.test', user_metadata: { full_name: 'Camille Exemple' } } };
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js', { paths: [path.join(__dirname, '..', '..')] }), 'utf8');

// Ce que la PR #1376 (claude/main-vert, 24 nov.) corrige déjà : ce banc ne le compte pas
// (même défaut, même correction — le refaire ici doublerait le travail et les conflits).
const PAR_1376 = [
  { regle: 'label-content-name-mismatch', cible: /\.n-laterale-compte/, quoi: 'carte du compte (le nom commence par le texte visible)' },
  { regle: 'label-content-name-mismatch', cible: /\.n-ad-afaire/, quoi: '« Choisir une action »' },
  { regle: 'label-content-name-mismatch', cible: /data-eg-modifier="(prix|achat)"/, quoi: 'cellules prix / achat' },
  { regle: 'label-content-name-mismatch', cible: /data-tt-col="(prix|achat|regler)"|a-regler|aregler/i, quoi: 'cellules « À régler »' },
  { regle: 'button-name', cible: /data-tt-trier="site"/, quoi: 'en-tête de tri « Site »' },
  { regle: 'aria-allowed-attr', cible: /n-segmente|data-msg-vue|role="radio"/, quoi: 'Segmente : aria-pressed sur role=radio' },
  { regle: 'aria-allowed-attr', cible: /class="n-rangee"[^>]*aria-(pressed|expanded)/, quoi: 'Rangee : les aria-* d’attrs sur l’élément touchable, pas sur le cadre <div>' },
  { regle: 'nom-vide', cible: /data-tt-trier="site"/, quoi: 'en-tête de tri « Site »' },
];
const par1376 = (regle, cible) => PAR_1376.some((e) => e.regle === regle && e.cible.test(cible));

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0];
  if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!p.startsWith(DIST) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});
const vignette = (graine) => {
  let h = 0; for (const c of String(graine)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="hsl(${h % 360},28%,88%)"/><rect x="70" y="200" width="270" height="60" rx="20" fill="hsl(${h % 360},35%,40%)"/></svg>`;
};
function base() {
  const b = fabriquer({ comptes: 3 });
  const m = b.main[0].data, at = '2026-11-01T10:00:00.000Z';
  m.vrm_bienvenue_vue = { at }; m.vrm_visite_vue = { at };
  m.vrm_je_vends = { choix: 'sneakers', at };
  m.vrm_configuration = { etat: 'fait', at, statut: null, version: 1 };
  m.vrm_plateformes_affichees = { sites: ['vinted', 'leboncoin', 'ebay'], at };
  m.vrm_parcours = { etat: 'fini', at };
  const vus = {}; for (const a of b.accounts) vus[a.vinted_user_id] = Date.now() - 120000;
  b.rows.push({ id: 'ext_appareil_0123456789abcdef', data: { appareil: { paquet: 'chromium', nav: 'chrome', systeme: 'mac' }, ver: '5.372.0', code: '5.372.0', atMs: Date.now() - 60000, flux: {}, vus: { vinted: vus } } });
  return b;
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
async function ouvrir(nav, { W, sombre, url, langue = null }) {
  const tel = W < 600, b = base();
  const ctx = await nav.newContext({ ...(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : { viewport: { width: 1512, height: 950 } }), colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR', timezoneId: 'Europe/Paris', serviceWorkers: 'block' });
  const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e.message || e).slice(0, 200)));
  await pg.addInitScript(([s, sombre, langue]) => {
    try {
      if (!sessionStorage.getItem('banc_init')) {
        localStorage.setItem('vrm_banc_vends', '1');
        localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_local_owner', s.user.id);
        localStorage.setItem('vinted_dark', sombre ? 'true' : 'false');
        localStorage.setItem('vrm_bienvenue_vue', JSON.stringify({ at: 'banc' }));
        localStorage.setItem('vrm_visite_vue', JSON.stringify({ at: 'banc' }));
        localStorage.setItem('vrm_aide_installation_vue', '1');
        if (langue) localStorage.setItem('vrm_langue', JSON.stringify(langue));
        sessionStorage.setItem('banc_init', '1');
      }
    } catch (_) {}
  }, [SESSION, sombre, langue]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    if (/vinted\.net|vinted\.fr\/.*\.(jpe?g|png|webp)/i.test(u) || r.request().resourceType() === 'image') return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: vignette(u) });
    if (/\/auth\/v1\/settings/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ external: { email: true } }) });
    if (/\/auth\/v1\//.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: SESSION.access_token, refresh_token: 'r', expires_in: 3600, user: SESSION.user }) });
    if (/\/rest\/v1\//.test(u)) return rest(r, b);
    return r.abort();
  });
  await pg.route('**/api/**', (r) => {
    if (/mode=abonnement/.test(r.request().url())) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, proprietaire: true, acces: true }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await pg.route('**/rest/v1/**', (r) => rest(r, b));
  await pg.goto(`http://localhost:${PORT}${url}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.vrm-main, main', { timeout: 30000 }).catch(() => {});
  await M.attendreDemarrage(pg);
  await pg.waitForTimeout(2600);
  // L'écran derrière son squelette (`.vrm-attente-cache`, caché aux lecteurs) : on attend qu'il soit montré.
  for (let i = 0; i < 60 && await pg.evaluate(() => !!document.querySelector('.vrm-attente-cache')).catch(() => false); i++) await pg.waitForTimeout(500);
  await finir(pg);
  return { ctx, pg, erreurs };
}
const finir = (pg) => pg.evaluate(() => { try { for (const a of document.getAnimations()) { try { a.finish(); } catch (_) {} } } catch (_) {} });
const capture = async (pg, nom) => { if (!SORTIE) return; fs.mkdirSync(SORTIE, { recursive: true }); await pg.screenshot({ path: path.join(SORTIE, nom + '.png') }); };

let rouges = 0, verts = 0;
const dit = (ok, quoi, detail) => { if (ok) verts++; else rouges++; console.log(`${ok ? '  ✅' : '  ❌'} ${quoi}${ok ? '' : ' — ' + String(detail == null ? '' : detail).slice(0, 600)}`); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 200)); } };

// Les mutations : une correction ré-affaiblie APRÈS l'ouverture (le banc doit alors rougir).
async function saboter(pg) {
  if (MUT === 'pops') await pg.evaluate(() => { for (const e of document.querySelectorAll('[data-n-pops]')) e.removeAttribute('role'); });
  if (MUT === 'contraste') await pg.addStyleTag({ content: ':root[data-theme="dark"] .vrm-an-principal{color:#fff!important;background:var(--an-accent)!important}' });
  if (MUT === 'gris') await pg.addStyleTag({ content: '.vrm-an,.vrm-an-voile{--an-gris:#6E6E73!important}' });
  if (MUT === 'noms') await pg.addStyleTag({ content: ':root:root:root:root:root:root:root:root body .vrm-plus-groupe .vrm-ui-ligne{content-visibility:auto!important}' });
  if (MUT === 'libelle') await pg.evaluate(() => { for (const b of document.querySelectorAll('button.vg-fil')) b.setAttribute('aria-label', 'Ouvrir le fil ' + (b.querySelector('b') || b).textContent); });
  if (MUT === 'filnom') await pg.addStyleTag({ content: ':root:root:root:root:root:root body .vg-fil{content-visibility:auto!important}' });
  // Anneau pâle (≈ 1,5:1 sur clair comme sur sombre), quelle que soit sa forme (contour ou ombre). Posé EN LIGNE au focus :
  // l'anneau de l'app est un !important dans une @layer, qu'aucune feuille ajoutée après ne bat (une style en ligne, si).
  if (MUT === 'anneau') await pg.evaluate(() => document.addEventListener('focusin', (e) => { const t = e.target; if (!t || !t.style) return; t.style.setProperty('outline-color', 'rgba(127,127,127,.35)', 'important'); t.style.setProperty('box-shadow', '0 0 0 2px rgba(127,127,127,.35)', 'important'); }, true));
}

async function axe(pg, racine) {
  await finir(pg);
  await pg.evaluate(AXE);
  return pg.evaluate(async (racine) => {
    const ids = [...new Set([...window.axe.getRules(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).map((r) => r.ruleId), 'aria-allowed-role', 'aria-dialog-name'])];
    const cible = racine ? ([...document.querySelectorAll(racine)].filter((e) => e.getClientRects().length).pop() || document) : document;
    const r = await window.axe.run(cible, { runOnly: { type: 'rule', values: ids }, resultTypes: ['violations'] });
    const out = [];
    for (const v of r.violations) for (const n of v.nodes) out.push({ id: v.id, impact: v.impact, cible: n.target.join(' '), html: n.html.replace(/\s+/g, ' ').slice(0, 160) });
    return out;
  }, racine || null);
}

// E : la séquence de Tab, l'anneau mesuré à chaque arrêt.
async function anneaux(pg, n = 40) {
  await pg.evaluate(() => { const a = document.createElement('div'); a.tabIndex = -1; document.body.prepend(a); a.focus(); a.remove(); });
  const out = [];
  for (let i = 0; i < n; i++) {
    await pg.keyboard.press('Tab'); await pg.waitForTimeout(40);
    const info = await pg.evaluate(() => {
      const e = document.activeElement; if (!e || e === document.body) return null;
      // un conteneur focalisé PAR L'APP (tabindex=-1 : feuille, bilan) n'est pas un arrêt de Tab ⇒ pas compté
      if (e.tabIndex < 0) return { horsVue: true };
      const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return { horsVue: true };
      const cs = getComputedStyle(e);
      const parse = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c || ''); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
      let couleur = null, largeur = 0, sorte = '';
      if (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 1) { couleur = parse(cs.outlineColor); largeur = parseFloat(cs.outlineWidth); sorte = 'outline'; }
      else if (cs.boxShadow && cs.boxShadow !== 'none') {
        // la DERNIÈRE ombre « pleine » (étalement ≥ 1 px) = l'anneau
        const parts = cs.boxShadow.split(/,(?![^(]*\))/);
        for (const p of parts) { const c = parse(p); const nums = p.replace(/rgba?\([^)]*\)/, '').trim().split(/\s+/).map(parseFloat); if (c && nums.length >= 4 && nums[3] >= 1 && !/inset/.test(p)) { couleur = c; largeur = nums[3]; sorte = 'ombre'; } }
      }
      const nom = (e.getAttribute('aria-label') || e.innerText || e.value || '').trim().replace(/\s+/g, ' ').slice(0, 30);
      e.setAttribute('data-banc-focus', '1');
      return { tag: e.tagName.toLowerCase(), cls: (typeof e.className === 'string' ? e.className : '').slice(0, 40), nom, couleur, largeur, sorte, off: parseFloat(cs.outlineOffset) || 0,
        x: r.left, y: r.top, w: r.width, h: r.height };
    });
    if (!info || info.horsVue) continue;
    // Le fond SOUS l'anneau : l'anneau rendu transparent, la bande juste à l'extérieur de l'élément (pixels).
    if (info.couleur) {
      // Effacé EN LIGNE (l'anneau de l'app est un !important dans une @layer : une feuille ajoutée ne le bat pas).
      await pg.evaluate(() => { const e = document.querySelector('[data-banc-focus]'); if (!e) return; e.dataset.bancAvant = e.getAttribute('style') || ''; e.style.setProperty('outline-color', 'transparent', 'important'); e.style.setProperty('box-shadow', 'none', 'important'); });
      // Le cadre de capture borné à la fenêtre ; la couronne de 1 à 5 px mesurée HORS de la boîte, côtés visibles seulement.
      const VW = pg.viewportSize().width, VH = pg.viewportSize().height;
      const x0 = Math.max(0, Math.floor(info.x - 8)), y0 = Math.max(0, Math.floor(info.y - 8)), x1 = Math.min(VW, Math.ceil(info.x + info.w + 8)), y1 = Math.min(VH, Math.ceil(info.y + info.h + 8));
      const buf = x1 - x0 >= 2 && y1 - y0 >= 2 ? await pg.screenshot({ clip: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } }).catch(() => null) : null;
      await pg.evaluate(() => { const e = document.querySelector('[data-banc-focus]'); if (!e) return; const a = e.dataset.bancAvant; if (a) e.setAttribute('style', a); else e.removeAttribute('style'); delete e.dataset.bancAvant; });
      if (buf) info.fond = await pg.evaluate(async ({ b64, l, t, r, b }) => {
        const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
        const d = x.getImageData(0, 0, c.width, c.height).data, px = [];
        // la couronne de 2 à 5 px autour de la boîte (là où l'anneau se dessine)
        for (let yy = 0; yy < c.height; yy++) for (let xx = 0; xx < c.width; xx++) {
          const dist = Math.max(l - xx, xx - r, t - yy, yy - b);
          if (dist >= 1 && dist <= 5) { const i = (yy * c.width + xx) * 4; px.push([d[i], d[i + 1], d[i + 2]]); }
        }
        const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
        px.sort((a, b) => lum(a) - lum(b)); return px.length ? px[Math.floor(px.length / 2)] : null;
      }, { b64: buf.toString('base64'), l: info.x - x0, t: info.y - y0, r: info.x + info.w - x0, b: info.y + info.h - y0 });
    }
    await pg.evaluate(() => { const e = document.querySelector('[data-banc-focus]'); if (e) e.removeAttribute('data-banc-focus'); });
    out.push(info);
  }
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  for (const i of out) {
    if (!i.couleur || !i.fond) { i.ratio = 0; continue; }
    const a = i.couleur[3], c = i.couleur.slice(0, 3).map((v, k) => v * a + i.fond[k] * (1 - a));
    const p = lum(c), q = lum(i.fond); i.ratio = Math.round(((Math.max(p, q) + 0.05) / (Math.min(p, q) + 0.05)) * 100) / 100;
  }
  return out;
}

(async () => {
  await new Promise((ok) => srv.listen(PORT, ok));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    // Sonde (mise au point) : SONDE=fichier.js SONDE_URL=/?tab=… [SONDE_W=390] [SONDE_THEME=sombre] — affiche l'évaluation, ne juge rien.
    if (process.env.SONDE) { const o = await ouvrir(nav, { W: Number(process.env.SONDE_W || 390), sombre: process.env.SONDE_THEME === 'sombre', url: process.env.SONDE_URL || '/?tab=journee' }); console.log(JSON.stringify(await o.pg.evaluate(fs.readFileSync(process.env.SONDE, 'utf8')).catch((e) => String(e)), null, 1)); await capture(o.pg, 'sonde'); await o.ctx.close(); return; }
    // Inventaire (mise au point, ne juge rien) : QUOI=inventaire touche les boutons de chaque écran un à un et dit
    // chaque calque qui s'ouvre par-dessus (feuille, panneau) avec son rôle, aria-modal et son nom.
    if (QUOI.includes('inventaire')) for (const W of LARGEURS) for (const [tab, nom] of ECRANS) {
      let o = await ouvrir(nav, { W, sombre: false, url: `/?tab=${tab}` });
      const n = await o.pg.evaluate(() => { const l = [...document.querySelectorAll('main button, main [role="button"]')].filter((e) => e.getClientRects().length && !e.closest('nav,[data-n-onglets]')); l.forEach((e, i) => e.setAttribute('data-banc-i', i)); return l.length; });
      const vus = new Set();
      for (let i = 0; i < Math.min(n, Number(process.env.INVENTAIRE_MAX || 40)); i++) {
        const r = await o.pg.evaluate(async (i) => {
          const b = document.querySelector(`[data-banc-i="${i}"]`); if (!b || !b.getClientRects().length) return null;
          const avant = new Set([...document.querySelectorAll('body *')]);
          const etiquette = (b.getAttribute('aria-label') || b.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40);
          b.click(); await new Promise((ok) => setTimeout(ok, 700));
          const neufs = [...document.querySelectorAll('body *')].filter((e) => !avant.has(e) && e.getClientRects().length);
          const calques = neufs.filter((e) => { const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return (cs.position === 'fixed' || e.getAttribute('role') === 'dialog') && r.width * r.height > innerWidth * innerHeight * 0.2 && !(e.parentElement && neufs.includes(e.parentElement)); });
          return { etiquette, calques: calques.slice(0, 3).map((c) => { const d = c.matches('[role=dialog],[role=alertdialog]') ? c : c.querySelector('[role=dialog],[role=alertdialog]'); const lb = d && d.getAttribute('aria-labelledby'); return { cls: (typeof c.className === 'string' ? c.className : '').slice(0, 50), role: d && d.getAttribute('role'), modal: d && d.getAttribute('aria-modal'), nom: d && ((d.getAttribute('aria-label') || (lb && document.getElementById(lb) && document.getElementById(lb).textContent) || '').trim().slice(0, 40)), html: (d || c).outerHTML.slice(0, 160).replace(/\s+/g, ' ') }; }), tab: location.search };
        }, i).catch((e) => ({ erreur: String(e).slice(0, 80) }));
        if (r && r.calques && r.calques.length) for (const c of r.calques) { const k = c.cls + c.role + c.nom; if (vus.has(k)) continue; vus.add(k); console.log(`  ${W} ${nom} « ${r.etiquette} » ⇒ ${c.role === 'dialog' && c.modal === 'true' && c.nom ? 'OK ' : 'DÉFAUT '}${JSON.stringify(c)}`); }
        if (r && (r.calques && r.calques.length || r.tab !== `?tab=${tab}`)) { await o.ctx.close(); o = await ouvrir(nav, { W, sombre: false, url: `/?tab=${tab}` }); await o.pg.evaluate(() => { const l = [...document.querySelectorAll('main button, main [role="button"]')].filter((e) => e.getClientRects().length && !e.closest('nav,[data-n-onglets]')); l.forEach((e, i) => e.setAttribute('data-banc-i', i)); }); }
      }
      await o.ctx.close();
    }
    if (QUOI.includes('ecrans')) for (const W of LARGEURS) for (const theme of THEMES) {
      const sombre = theme === 'sombre', T = `${W < 600 ? '📱' : '🖥️'}${sombre ? '🌙' : '☀️'}`;
      for (const [tab, nom] of ECRANS) await essaie(`${T} ${nom}`, async () => {
        const { ctx, pg, erreurs } = await ouvrir(nav, { W, sombre, url: `/?tab=${tab}` });
        await saboter(pg);
        await capture(pg, `${tab}-${W}-${theme}`);
        // A
        const v = (await axe(pg)).filter((x) => (['serious', 'critical'].includes(x.impact) || ['aria-allowed-role', 'aria-dialog-name'].includes(x.id)) && !par1376(x.id, x.cible + ' ' + x.html));
        dit(!v.length, `${T} ${nom} · A axe : aucune violation grave (hors #1376)`, `${v.length} : ` + v.slice(0, 6).map((x) => `${x.id} [${x.impact}] ${x.cible} — ${x.html}`).join(' ║ '));
        // F
        const pops = await pg.evaluate(() => [...document.querySelectorAll('[data-n-pops], .vrm-toasts')].map((e) => ({ cls: e.className, role: e.getAttribute('role'), live: e.getAttribute('aria-live'), nom: e.getAttribute('aria-label') })));
        const okPops = pops.length >= 1 && pops.every((p) => p.live && (!p.nom || ['status', 'region', 'log', 'alert'].includes(p.role)));
        dit(okPops, `${T} ${nom} · F 4.1.3 la zone des messages passagers est montée, vivante, nommée légalement`, JSON.stringify(pops));
        // B
        const c = await M.contrastePixels(pg);
        dit(!c.length, `${T} ${nom} · B 1.4.3 aucun texte sous 4,5:1 (3:1 en grand)`, `${c.length} : ` + c.slice(0, 5).map((x) => `${x.ratio}:1 « ${x.texte} » ${x.sel} ${x.fg} sur ${x.bg}`).join(' ║ '));
        // C
        if (W < 600 && !sombre) { const p = await M.cibles(pg); dit(!p.length, `${T} ${nom} · C 44 × 44 px au doigt`, `${p.length} : ` + p.slice(0, 5).join(' ║ ')); }
        // D
        const n = (await M.nomsVides(pg)).filter((x) => !par1376('nom-vide', x));
        dit(!n.length, `${T} ${nom} · D 4.1.2 aucun contrôle sans nom`, `${n.length} : ` + n.slice(0, 4).join(' ║ '));
        // E
        if (W >= 600) {
          const s = await anneaux(pg, 40);
          const sans = s.filter((x) => !x.couleur || x.couleur[3] < 0.05);
          dit(!sans.length, `${T} ${nom} · E 2.4.7 un anneau visible à chaque arrêt de Tab (${s.length} arrêts)`, sans.slice(0, 4).map((x) => `${x.tag}.${x.cls} « ${x.nom} »`).join(' | '));
          const faibles = s.filter((x) => x.couleur && x.couleur[3] >= 0.05 && x.ratio < 3);
          dit(!faibles.length, `${T} ${nom} · E 1.4.11 l'anneau fait ≥ 3:1 contre son fond`, `${faibles.length} : ` + faibles.slice(0, 4).map((x) => `${x.ratio}:1 ${x.sorte} rgba(${x.couleur.join(',')}) sur rgb(${(x.fond || []).join(',')}) ${x.tag}.${x.cls} « ${x.nom} »`).join(' | '));
        }
        dit(!erreurs.length, `${T} ${nom} · aucune erreur de page`, erreurs.slice(0, 2).join(' | '));
        await ctx.close();
      });
    }
    // G — les feuilles des 6 écrans qui n'étaient pas des feuilles pour un lecteur d'écran (inventaire du 24 nov.) :
    //     la période d'Achats au téléphone, la conversation de Messages (feuille plein écran au téléphone, volet à l'ordinateur).
    //     Chacune : role=dialog, un nom DANS LA LANGUE CHOISIE, aria-modal="true" quand elle recouvre l'écran (390).
    const FEUILLES = [
      { id: 'periode', nom: 'Achats · période', tab: 'achats', sel: '.vrm-cal-feuille, .vrm-cal-pop', ouvrir: (pg) => pg.locator('main [data-periode-ouvrir]').first().click({ timeout: 8000 }), nomAttendu: { fr: /période/i, en: /period|purchases/i } },
      { id: 'fil', nom: 'Messages · conversation', tab: 'messages', sel: '.vrm-chat-panel', ouvrir: (pg) => pg.locator('main button.vg-fil').first().click({ timeout: 8000 }), nomAttendu: { fr: /^Conversation Vinted$/, en: /^Vinted conversation$/ } },
    ];
    if (QUOI.includes('feuilles')) for (const W of LARGEURS) for (const theme of THEMES) for (const langue of ['fr', 'en']) for (const F of FEUILLES) {
      const sombre = theme === 'sombre', T = `${W < 600 ? '📱' : '🖥️'}${sombre ? '🌙' : '☀️'} ${langue}`;
      if (F.id === 'periode' && W >= 600) continue;   // à l'ordinateur la période est une bulle sous son bouton (non modale)
      await essaie(`${T} G ${F.nom}`, async () => {
        const { ctx, pg, erreurs } = await ouvrir(nav, { W, sombre, url: `/?tab=${F.tab}`, langue });
        await F.ouvrir(pg);
        // La feuille ATTENDUE (pas un délai fixe) : la liste peut se re-rendre juste après le toucher ⇒ un second toucher.
        const vue = () => pg.waitForFunction((sel) => [...document.querySelectorAll(sel)].some((x) => x.getClientRects().length), F.sel, { timeout: 6000 }).then(() => true, () => false);
        if (!await vue()) { await F.ouvrir(pg).catch(() => {}); await vue(); }
        await pg.waitForTimeout(400); await finir(pg);
        // Lue jusqu'à ce qu'elle soit là (la liste peut remonter la feuille un instant) ; la mutation « feuille » est
        // rejouée à chaque lecture (un remontage remettrait l'attribut).
        const d = await pg.waitForFunction(([sel, mut]) => {
          const e = [...document.querySelectorAll(sel)].filter((x) => x.getClientRects().length).pop(); if (!e) return null;
          if (mut === 'feuille') e.removeAttribute('aria-modal');
          const lb = e.getAttribute('aria-labelledby'); const nom = (e.getAttribute('aria-label') || (lb && document.getElementById(lb) && document.getElementById(lb).textContent) || '').trim();
          const r = e.getBoundingClientRect();
          return { role: e.getAttribute('role'), modal: e.getAttribute('aria-modal'), nom, couvre: Math.round((r.width * r.height) / (innerWidth * innerHeight) * 100), lang: document.documentElement.lang };
        }, [F.sel, MUT], { timeout: 8000 }).then((h) => h.jsonValue(), () => null);
        const modaleVoulue = W < 600;
        dit(!!d && d.role === 'dialog' && !!d.nom && (modaleVoulue ? d.modal === 'true' : d.modal !== 'true'), `${T} G ${F.nom} : role=dialog, nommée, ${modaleVoulue ? 'aria-modal="true" (elle recouvre l’écran)' : 'pas modale (volet à côté de la liste)'}`, JSON.stringify(d));
        dit(!!d && F.nomAttendu[langue].test(d.nom), `${T} G ${F.nom} : son nom est dans la langue choisie`, JSON.stringify(d));
        const v = (await axe(pg, F.sel)).filter((x) => ['serious', 'critical'].includes(x.impact) && !par1376(x.id, x.cible + ' ' + x.html));
        dit(!v.length, `${T} G ${F.nom} : axe dans la feuille`, `${v.length} : ` + v.slice(0, 4).map((x) => `${x.id} ${x.cible} — ${x.html}`).join(' ║ '));
        await capture(pg, `feuille-${F.id}-${W}-${theme}-${langue}`);
        dit(!erreurs.length, `${T} G ${F.nom} : aucune erreur de page`, erreurs.slice(0, 2).join(' | '));
        await ctx.close();
      });
    }
    // H — <html lang> suit la langue choisie.
    if (QUOI.includes('langue')) for (const langue of [null, 'en', 'de']) {
      await essaie(`H lang ${langue}`, async () => {
        const { ctx, pg } = await ouvrir(nav, { W: 1512, sombre: false, url: '/?tab=journee', langue });
        if (MUT === 'lang') await pg.evaluate(() => document.documentElement.setAttribute('lang', 'fr'));
        const l = await pg.evaluate(() => document.documentElement.getAttribute('lang'));
        dit(l === (langue || 'fr'), `H 3.1.1 <html lang="${langue || 'fr'}"> (vrm_langue = ${langue || 'aucun choix'})`, `lang="${l}"`);
        await ctx.close();
      });
    }
  } finally { await nav.close(); srv.close(); }
  console.log(`\n${verts} ✅ · ${rouges} ❌${SORTIE ? ' — captures : ' + SORTIE : ''}`);
  process.exit(rouges ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
