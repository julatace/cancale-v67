// ════════════════════════════════════════════════════════════════════════════
//  BANC — VRM POUR TOUS LES VENDEURS (lot DJ2, 11 nov.)
//  Julien : « tout le monde ne vend pas des sneakers : la première question c'est
//  sneakers ou autre chose » ; « arrête de faire allusion à des chaussures, il y a
//  des personnes qui vendent des lunettes » ; « Simple ou complet ? » pas clair.
//  Base INVENTÉE (_base-volume, 1 compte, titres réécrits en lunettes) ; rien de réel.
//
//  V1  vendeuse NEUVE : « Ma configuration » s'ouvre sur « Tu vends quoi ? » (1re
//      étape), des tuiles à cocher (≥ 15, Lunettes comprise, ≥ 44 px, plusieurs
//      possibles), « Autre chose » ouvre un champ libre ; Lunettes ⇒ `vrm_je_vends`
//      { choix: 'autre', categories: ['lunettes'] } dans `main`.
//  V2  l'étape d'affichage : DEUX grandes cartes, 3 puces chacune, « pour qui », un
//      aperçu miniature, « Tu pourras changer dans Paramètres ».
//  V3  vendeuse « Lunettes » installée : relevé du TEXTE du DOM (titres, boutons,
//      champs, aides, attributs `placeholder`, `aria-label`, `title`) sur les écrans
//      principaux : AUCUN mot de chaussure (chaussure, basket, sneaker, pointure,
//      semelle, lacet, paire) ; la note d'un article propose un exemple de lunettes.
//  V4  Julien (propriétaire, données, rien choisi) : la question « Tu vends quoi ? »
//      s'ouvre UNE fois, RIEN de pré-coché ; tant qu'il n'a pas choisi, VRM parle
//      toujours de « paires » (rien changé sans son clic) ; « Plus tard » ⇒ retenue
//      (`vu`), elle ne revient pas au rechargement ; il choisit Sneakers ⇒ inchangé.
//  Chaque fois : aucune erreur JS, rien ne déborde. `SHOTS=dossier` range les captures
//  (à REGARDER). `LARGEURS=390,1512` / `THEMES=clair,sombre` / `SCENARIOS=V1,V2,V3,V4`.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), http = require('http'), fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { fabriquer } = require(path.join(__dirname, '_base-volume.cjs'));
const { servir } = require('./_minipgrest.cjs');
const { metaVersData } = require('./_meta.cjs');
const DIST = process.env.BANC_DIST || process.argv[2] || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 10231;
const SHOTS = process.env.SHOTS || '';
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const SCENARIOS = liste('SCENARIOS', 'V1,V2,V3,V4');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const UID = '7a1e0c55-2b1d-4c3e-9f00-0000000000d2';
const SESSION = { access_token: 'jeton-generaliste', refresh_token: 'r', totp: [], expires_at: Date.now() + 3600e3, user: { id: UID, email: 'vendeuse.lunettes@exemple.test', totp: [] } };
// Les mots qui supposent des chaussures (jamais « paire de lunettes » non plus : VRM dit « article »).
const MOTS_CHAUSSURE = /\b(chaussures?|baskets?|sneakers?|pointures?|semelles?|lacets?|paires?)\b/i;

let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det ? ' — ' + String(det).slice(0, 500) : ''}`); };

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!p.startsWith(DIST) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

// ── La base : un compte, ses annonces et ventes devenues des LUNETTES ─────────
const MODELES_L = ['Ray-Ban Wayfarer noires', 'Persol 714 écaille', 'Oakley Holbrook', 'Gucci GG0061S', 'Ray-Ban Aviator dorées', 'Prada Linea Rossa', 'Tom Ford Snowdon', 'Carrera Champion'];
function baseLunettes({ vend = { choix: 'autre', categories: ['lunettes'], at: '2026-11-01T10:00:00.000Z' }, neuve = false } = {}) {
  const b = fabriquer({ comptes: 1 });
  let k = 0;
  const lunette = () => MODELES_L[(k++) % MODELES_L.length];
  for (const r of b.rows) {
    const p = r.data && r.data.payload;
    if (p && Array.isArray(p.items)) for (const it of p.items) { it.title = lunette(); it.size_title = ''; it.brand_title = it.title.split(' ')[0]; }
    if (p && Array.isArray(p.my_orders)) for (const o of p.my_orders) o.title = lunette();
    if (r.data && Array.isArray(r.data.items)) for (const it of r.data.items) it.title = lunette();
    if (r.id === 'vinted_item_details') for (const v of Object.values(r.data)) if (v && typeof v === 'object') { v.desc = 'Très bon état, étui d’origine.'; v.description = v.desc; }
  }
  b.rows = b.rows.filter((r) => !/^email_track_/.test(r.id) && r.id !== 'email_journal');
  const m = b.main[0].data;
  m.vrm_bienvenue_vue = { at: '2026-11-01T10:00:00.000Z' }; m.vrm_visite_vue = { at: '2026-11-01T10:00:00.000Z' };
  if (vend) m.vrm_je_vends = vend;
  if (!neuve) {
    m.vrm_configuration = { etat: 'fait', at: '2026-11-01T10:00:00.000Z', statut: null, version: 1 };
    m.vrm_plateformes_affichees = { sites: ['vinted'], at: '2026-11-01T10:00:00.000Z' };
  } else {
    b.rows = []; b.accounts = []; b.main[0].data = { vrm_bienvenue_vue: { at: '2026-11-01T10:00:00.000Z' }, vrm_visite_vue: { at: '2026-11-01T10:00:00.000Z' } };
  }
  return b;
}
const ligneMain = (b) => (b.main[0] || {}).data || {};

async function ouvrir(nav, { W, sombre, base, tab = 'journee', proprio = false }) {
  const tel = W < 600;
  const ctx = await nav.newContext({ ...(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1512, height: 950 } }), colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const pg = await ctx.newPage();
  const journal = { erreurs: [] };
  pg.on('pageerror', (e) => journal.erreurs.push(String(e.message || e).slice(0, 240)));
  await pg.addInitScript(([s, sombre]) => {
    try {
      if (!sessionStorage.getItem('banc_init')) {
        // La porte des bancs marque « Tu vends quoi ? » vue : ce banc la juge.
        localStorage.removeItem('vrm_je_vends'); localStorage.setItem('vrm_banc_vends', '1');
        localStorage.setItem('vrm_session', JSON.stringify(s));
        localStorage.setItem('vrm_local_owner', s.user.id);
        localStorage.setItem('vinted_dark', sombre ? 'true' : 'false');
        localStorage.setItem('vrm_bienvenue_vue', JSON.stringify({ at: 'banc' }));
        localStorage.setItem('vrm_visite_vue', JSON.stringify({ at: 'banc' }));
        sessionStorage.setItem('banc_init', '1');
      }
    } catch (_) {}
  }, [SESSION, sombre]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: SESSION.access_token, refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route('**/rest/v1/**', async (route) => {
    const req = route.request(), m = req.method();
    const u = decodeURIComponent(req.url());
    if (/\/rest\/v1\/rpc\//.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
    if (m === 'POST' || m === 'PATCH') {
      if (process.env.BANC_DEBUG) console.log('ECRIT', m, u.slice(0, 160), String(req.postData() || '').slice(0, 300));
      try {
        const b = JSON.parse(req.postData() || 'null');
        const rows = Array.isArray(b) ? b : b && b.id ? [b] : [];
        const eqm = /[?&]id=eq\.([^&]*)/.exec(u);
        if (m === 'PATCH' && eqm && b && b.data) rows.push({ id: eqm[1], data: b.data });
        for (const r of rows) {
          if (!r || !r.id || !/\/app_data/.test(u)) continue;
          if (r.id === 'main') base.main[0] = { id: 'main', data: r.data };
          else { const i = base.rows.findIndex((x) => x.id === r.id); if (i >= 0) base.rows[i] = { id: r.id, data: r.data }; else base.rows.push({ id: r.id, data: r.data }); }
        }
      } catch (_) {}
      return route.fulfill({ status: m === 'POST' ? 201 : 200, contentType: 'application/json', body: m === 'PATCH' ? '[{"id":"main"}]' : '[]' });
    }
    if (m === 'DELETE') return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(base.accounts.map((a) => ({ ...a, owner: UID }))) });
    if (!/\/rest\/v1\/app_data/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    const lignes = [...base.main, ...base.rows].map((l) => ({ owner: UID, updated_at: new Date().toISOString(), ...l }));
    const r = servir(lignes, decodeURIComponent(metaVersData(req.url())), req.headers());
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': r.range || '0-0/0' }, body: JSON.stringify(r.body) });
  });
  await pg.route('**/api/**', (r) => {
    const u = r.request().url();
    if (/mode=abonnement/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, proprietaire: proprio, acces: true }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.vrm-main', { timeout: 25000 }).catch(() => {});
  return { ctx, pg, journal, tel };
}
async function capture(pg, nom, plein = false) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await pg.waitForTimeout(450);
  await pg.screenshot({ path: path.join(SHOTS, nom + '.png'), fullPage: plein });
}
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
const attendre = async (pg, f, ms = 9000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await f()) return true; await pg.waitForTimeout(200); } return false; };
const etape = (pg) => pg.evaluate(() => { const c = document.querySelector('[data-configuration]'); return c ? c.getAttribute('data-configuration') : null; });
// Le TEXTE que voit (ou entend) la vendeuse : texte visible + placeholder, aria-label, title, alt.
const releveTexte = (pg) => pg.evaluate(() => {
  const morceaux = [document.body.innerText || ''];
  for (const el of document.querySelectorAll('[placeholder],[aria-label],[title],img[alt]')) {
    for (const a of ['placeholder', 'aria-label', 'title', 'alt']) { const v = el.getAttribute(a); if (v) morceaux.push(v); }
  }
  return morceaux.join('\n');
});
const phrasesAvec = (texte, re) => texte.split(/\n+/).filter((l) => re.test(l)).map((l) => l.trim().slice(0, 140));

async function scenario(nav, nom, W, theme) {
  const sombre = theme === 'sombre';
  const T = `[${nom} ${W} ${theme}]`;
  const pref = `${nom}-${W}-${theme}`;
  if (nom === 'V1' || nom === 'V2') {
    const base = baseLunettes({ vend: null, neuve: true });
    const o = await ouvrir(nav, { W, sombre, base, proprio: false });
    const vu = await attendre(o.pg, async () => !!(await etape(o.pg)), 15000);
    dit(vu, `${T} la configuration s’ouvre seule pour une vendeuse neuve`);
    if (!vu) { await capture(o.pg, pref + '-rien'); await o.ctx.close(); return; }
    if (nom === 'V1') {
      const e = await o.pg.evaluate(() => {
        const t = document.querySelector('#vrm-cfg-titre');
        const tuiles = [...document.querySelectorAll('[data-configuration-choix^="vends:"]')];
        return { etape: document.querySelector('[data-configuration]').getAttribute('data-configuration-etape'), titre: t && t.textContent,
          ids: tuiles.map((b) => b.getAttribute('data-configuration-choix').slice(6)),
          petites: tuiles.filter((b) => { const r = b.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).length };
      });
      dit(e.etape === '1' && /Tu vends quoi/.test(e.titre || ''), `${T} 1re question : « Tu vends quoi ? »`, JSON.stringify(e));
      const attendues = ['sneakers', 'vetements', 'sacs', 'montres', 'lunettes', 'vintage', 'enfants', 'maison', 'livres', 'jeux', 'hightech', 'jouets', 'sport', 'beaute', 'autre'];
      dit(attendues.every((v) => e.ids.includes(v)) && e.ids.length >= 15, `${T} les tuiles proposées (Lunettes comprise, ${e.ids.length})`, e.ids.join(','));
      dit(e.petites === 0, `${T} chaque tuile ≥ 44 px`, e.petites);
      await capture(o.pg, pref + '-vends');
      await o.pg.click('[data-configuration-choix="vends:lunettes"]');
      await o.pg.click('[data-configuration-choix="vends:montres"]');
      await o.pg.click('[data-configuration-choix="vends:autre"]');
      const libre = await o.pg.$('[data-configuration-autre]');
      dit(!!libre, `${T} « Autre chose » ouvre un champ libre`);
      if (libre) await libre.fill('Pièces d’horlogerie');
      await o.pg.click('[data-configuration-choix="vends:autre"]');
      await o.pg.click('[data-configuration-choix="vends:montres"]');
      const coches = await o.pg.$$eval('[data-configuration-choix^="vends:"][aria-pressed="true"]', (l) => l.map((b) => b.getAttribute('data-configuration-choix')));
      dit(coches.join() === 'vends:lunettes', `${T} plusieurs choix possibles, décochables`, coches.join());
      const note = await o.pg.$eval('[data-configuration-mot]', (n) => n.textContent).catch(() => '');
      dit(!MOTS_CHAUSSURE.test(note) || /Sneakers/.test(note) === false, `${T} la note sous les tuiles ne parle pas de chaussures`, note);
      await capture(o.pg, pref + '-lunettes');
      await o.pg.click('[data-configuration-suivant]');
      const ecrit = await attendre(o.pg, async () => { const v = ligneMain(base).vrm_je_vends || {}; return v.choix === 'autre' && (v.categories || []).join() === 'lunettes'; });
      dit(ecrit, `${T} Lunettes ⇒ vrm_je_vends { choix: 'autre', categories: ['lunettes'] }`, JSON.stringify(ligneMain(base).vrm_je_vends));
    } else {
      // Aller jusqu'à l'étape d'affichage (passer les autres).
      for (let i = 0; i < 9 && (await etape(o.pg)) !== 'affichage'; i++) { await o.pg.click('[data-configuration-suivant]'); await o.pg.waitForTimeout(350); }
      dit((await etape(o.pg)) === 'affichage', `${T} l’étape d’affichage est atteinte`);
      const a = await o.pg.evaluate(() => {
        const cartes = [...document.querySelectorAll('[data-configuration-choix^="affichage:"]')];
        const corps = document.querySelector('.vrm-cfg-corps');
        return { n: cartes.length, ids: cartes.map((c) => c.getAttribute('data-configuration-choix')),
          puces: cartes.map((c) => c.querySelectorAll('.vrm-cfg-puces li').length),
          pourQui: cartes.map((c) => (c.querySelector('[data-affichage-pour-qui]') || {}).textContent || ''),
          apercus: cartes.map((c) => !!c.querySelector('[data-affichage-apercu] svg, [data-affichage-apercu] [data-apercu-ligne]')),
          hauteur: cartes.map((c) => Math.round(c.getBoundingClientRect().height)),
          texte: corps ? corps.innerText : '', titre: (document.querySelector('#vrm-cfg-titre') || {}).textContent || '' };
      });
      dit(a.n === 2 && a.ids.join() === 'affichage:simple,affichage:complet', `${T} deux grandes cartes (Simple, Complet)`, a.ids.join());
      dit(a.puces.every((n) => n === 3), `${T} trois puces par carte`, a.puces.join());
      dit(/débute|vends peu/i.test(a.pourQui[0] || '') && /beaucoup|plusieurs comptes/i.test(a.pourQui[1] || ''), `${T} « pour qui » sur chaque carte`, a.pourQui.join(' | '));
      dit(a.apercus.every(Boolean), `${T} un aperçu miniature par carte`, a.apercus.join());
      dit(/Tu pourras changer dans Paramètres/.test(a.texte) && !/Simple ou complet/.test(a.titre) && !/à tout moment/.test(a.texte), `${T} « Tu pourras changer dans Paramètres »`, a.texte.slice(-200));
      dit(a.hauteur.every((h) => h >= 120), `${T} des cartes GRANDES (≥ 120 px)`, a.hauteur.join());
      await capture(o.pg, pref + '-affichage');
      await o.pg.click('[data-configuration-choix="affichage:simple"]');
      await o.pg.click('[data-configuration-suivant]');
      const ok = await attendre(o.pg, async () => ((ligneMain(base).vrm_affichage || {}).choix === 'simple'));
      dit(ok, `${T} « Simple » écrit vrm_affichage`, JSON.stringify(ligneMain(base).vrm_affichage));
    }
    dit(!(await deborde(o.pg)), `${T} rien ne déborde`);
    dit(!o.journal.erreurs.length, `${T} aucune erreur JS`, o.journal.erreurs.join(' | '));
    await o.ctx.close();
    return;
  }
  if (nom === 'V3') {
    const base = baseLunettes();
    const ecrans = ['journee', 'annonces', 'ventes', 'achats', 'colis', 'messages', 'garage', 'compta', 'settings'];
    const o = await ouvrir(nav, { W, sombre, base, proprio: false });
    await attendre(o.pg, async () => (await o.pg.$$('[data-attente-ecran]')).length === 0, 12000);
    dit(!(await etape(o.pg)), `${T} une vendeuse qui a choisi n’est pas re-questionnée`);
    for (const t of ecrans) {
      await o.pg.goto(`http://localhost:${PORT}/?tab=${t}`, { waitUntil: 'domcontentloaded' });
      await o.pg.waitForSelector('.vrm-main', { timeout: 20000 }).catch(() => {});
      await o.pg.waitForTimeout(2600);
      const tx = await releveTexte(o.pg);
      const mauvais = phrasesAvec(tx, MOTS_CHAUSSURE);
      dit(mauvais.length === 0, `${T} ${t} : aucun mot de chaussure`, mauvais.slice(0, 6).join(' ¦ '));
      // (11 nov., reprise) ni exemple de basket (marques), ni dessin de basket (états vides, Stock).
      const marques = phrasesAvec(tx, /\b(nike|adidas|air ?max|spezial|salomon|gel-lyte|p-6000)\b/i);
      const dessins = await o.pg.$$eval('[data-illustration="basket"], [data-sx-dessin="basket"]', (e) => e.length);
      dit(marques.length === 0 && dessins === 0, `${T} ${t} : aucun exemple ni dessin de basket`, `${marques.slice(0, 4).join(' ¦ ')} · dessins ${dessins}`);
      if (t === 'journee' || t === 'annonces') await capture(o.pg, `${pref}-${t}`);
      if (t === 'garage') {
        // Le test n'est pas vide : l'explication est bien là, avec l'étiquette et « Article ».
        const sx = await o.pg.$('[data-stock-explication]');
        const etq = sx ? await o.pg.$eval('[data-stock-explication]', (e) => ({ d: (e.querySelector('[data-sx-dessin]') || {}).getAttribute?.('data-sx-dessin') || null, t: e.textContent })) : null;
        dit(!!etq && etq.d === 'etiquette' && /Article/.test(etq.t) && /Vendu(?!e)/.test(etq.t), `${T} « Comment marche le Stock » : une étiquette, « Article », « Vendu »`, etq);
        if (sx && SHOTS) { await sx.scrollIntoViewIfNeeded().catch(() => {}); await o.pg.waitForTimeout(300); await sx.screenshot({ path: path.join(SHOTS, `${pref}-stock-explication.png`) }).catch(() => {}); }
      }
    }
    // La note d'un article : un exemple de lunettes (jamais « semelle »).
    await o.pg.goto(`http://localhost:${PORT}/?tab=annonces`, { waitUntil: 'domcontentloaded' });
    await o.pg.waitForSelector('.vrm-main', { timeout: 20000 }).catch(() => {});
    const bouton = await attendre(o.pg, async () => !!(await o.pg.$('[data-note-paire="ajout"]')), 8000);
    if (bouton) {
      await o.pg.evaluate(() => document.querySelector('[data-note-paire="ajout"]').click());
      const vu = await attendre(o.pg, async () => !!(await o.pg.$('[data-ask-champ="note-paire"]')), 5000);
      const ph = vu ? await o.pg.$eval('[data-ask-champ="note-paire"]', (i) => i.getAttribute('placeholder') || '') : null;
      const tout = await releveTexte(o.pg);
      dit(ph != null && /verre|monture|étui|rayure/i.test(ph) && !phrasesAvec(tout, MOTS_CHAUSSURE).length, `${T} la note d’un article propose un exemple de lunettes`, `${ph} | ${phrasesAvec(tout, MOTS_CHAUSSURE).join(' ¦ ')}`);
      await capture(o.pg, `${pref}-note`);
      await o.pg.keyboard.press('Escape').catch(() => {});
    } else dit(false, `${T} le bouton « note » d’un article est trouvé`);
    dit(!(await deborde(o.pg)), `${T} rien ne déborde`);
    dit(!o.journal.erreurs.length, `${T} aucune erreur JS`, o.journal.erreurs.join(' | '));
    await o.ctx.close();
    return;
  }
  if (nom === 'V4') {
    const base = baseLunettes({ vend: null });
    // Julien : des sneakers, rien choisi (le défaut du propriétaire = « paire »).
    for (const r of base.rows) { const p = r.data && r.data.payload; if (p && Array.isArray(p.items)) for (const it of p.items) it.title = 'Nike Air Max 90 taille 42'; }
    const o = await ouvrir(nav, { W, sombre, base, proprio: true });
    const vu = await attendre(o.pg, async () => (await etape(o.pg)) === 'vends', 15000);
    dit(vu, `${T} un compte existant voit « Tu vends quoi ? » une fois`);
    if (vu) {
      const e = await o.pg.evaluate(() => ({ coches: document.querySelectorAll('[data-configuration-choix^="vends:"][aria-pressed="true"]').length,
        seule: document.querySelector('[data-configuration]').getAttribute('data-configuration-sur'), titre: (document.querySelector('#vrm-cfg-titre') || {}).textContent }));
      dit(e.coches === 0, `${T} rien de pré-coché`, e.coches);
      dit(e.seule === '1', `${T} la question seule (pas toute la configuration)`, e.seule);
      await capture(o.pg, pref + '-question');
      await o.pg.click('[data-configuration-plus-tard]');
      const garde = await attendre(o.pg, async () => !!((ligneMain(base).vrm_je_vends || {}).vu));
      dit(garde, `${T} « Plus tard » est retenu (vu), rien d’autre écrit`, JSON.stringify(ligneMain(base).vrm_je_vends));
      dit(((ligneMain(base).vrm_je_vends || {}).choix || 'auto') === 'auto' && !(ligneMain(base).vrm_je_vends || {}).categories, `${T} aucun choix posé à sa place`, JSON.stringify(ligneMain(base).vrm_je_vends));
    }
    await o.pg.goto(`http://localhost:${PORT}/?tab=annonces`, { waitUntil: 'domcontentloaded' });
    await o.pg.waitForSelector('.vrm-main', { timeout: 20000 }).catch(() => {});
    await o.pg.waitForTimeout(3000);
    dit(!(await etape(o.pg)), `${T} la question ne revient pas au rechargement`);
    const tx = await releveTexte(o.pg);
    dit(/\bpaires?\b/i.test(tx), `${T} Julien (rien choisi) : VRM dit toujours « paire »`, phrasesAvec(tx, /article/).slice(0, 4).join(' ¦ '));
    // Il choisit Sneakers dans Réglages → Ma configuration ⇒ rien ne change.
    await o.pg.evaluate(() => window.dispatchEvent(new Event('vrm:configuration')));
    if (await attendre(o.pg, async () => (await etape(o.pg)) === 'vends', 6000)) {
      await o.pg.click('[data-configuration-choix="vends:sneakers"]');
      await o.pg.click('[data-configuration-suivant]');
      const ok = await attendre(o.pg, async () => (ligneMain(base).vrm_je_vends || {}).choix === 'sneakers');
      dit(ok, `${T} Sneakers seules ⇒ choix « sneakers »`, JSON.stringify(ligneMain(base).vrm_je_vends));
      await o.pg.click('[data-configuration-plus-tard]').catch(() => {});
    } else dit(false, `${T} « Ma configuration » se rouvre`);
    await o.pg.waitForTimeout(1200);
    const tx2 = await releveTexte(o.pg);
    dit(/\bpaires?\b/i.test(tx2), `${T} Sneakers : « paire » reste`);
    dit(!(await deborde(o.pg)), `${T} rien ne déborde`);
    dit(!o.journal.erreurs.length, `${T} aucune erreur JS`, o.journal.erreurs.join(' | '));
    await o.ctx.close();
  }
}

(async () => {
  await new Promise((res, rej) => { srv.on('error', rej); srv.listen(PORT, res); }).catch((e) => { console.log(`KO  port ${PORT} pris (${e.code})`); process.exit(1); });
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const W of LARGEURS) for (const th of THEMES) for (const s of SCENARIOS) {
      try { await scenario(nav, s, W, th); } catch (e) { dit(false, `[${s} ${W} ${th}] le scénario s’exécute`, e && e.message); }
    }
  } finally { await nav.close(); srv.close(); }
  console.log(ko ? `\n${ko} défaut(s)` : '\nTout est vert');
  process.exit(ko ? 1 : 0);
})();
