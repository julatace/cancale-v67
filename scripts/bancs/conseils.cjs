require('./_porte-banc.cjs');
// BANC — L'ACCOMPAGNEMENT : LES CONSEILS EN BULLE (6 nov.).
// Julien : « Je veux quelque chose de plus beau, simple et visuel ; peut-être un
// accompagnement à faire telle ou telle action quand tu juges favorable, que l'on
// peut skip. » La règle : src/accompagnement.js ; la bulle : src/Conseils.jsx.
// Aucune donnée réelle : un vendeur fictif (un compte Vinted « vendeuse »), une base
// servie par le banc, dont la ligne `vrm_accompagnement` est tenue en
// comparer-et-échanger sur `data->>rev` comme le ferait PostgREST.
// Deux conseils de la coque, sur Ma journée :
//   · 1512 px : « Ton extension est en retard » (un pont qui annonce la 5.200.0)
//     ⇒ la bulle pointe « Paramètres » de la colonne ;
//   · 390 px tactile, iPhone/Safari pas installé : « VRM sur ton écran d'accueil »
//     ⇒ la bulle pointe « Plus » de la barre du bas.
// Exige, en clair ET en sombre :
//   C1 une bulle, une seule, sur le bon conseil ; son « vu » est ÉCRIT dans la ligne
//      avant qu'elle paraisse ;
//   C2 la pointe tombe DANS le rectangle de la cible (et du bon côté) ; un halo
//      entoure la cible ; la bulle tient dans l'écran, au-dessus de la barre du bas ;
//      aucun voile (le reste de l'écran se touche) ;
//   C3 « Plus tard », « Ne plus montrer » et le geste font 44 px ;
//   C4 « Plus tard » ferme ; la réponse est écrite ; rechargée, elle ne revient pas ;
//   C5 Échap = « Plus tard » ; « Ne plus montrer » est écrit (jamais) ;
//   C6 le geste « Voir comment » ouvre le bon panneau de Paramètres ;
//   C7 lecture de la ligne ratée (500) ⇒ aucune bulle, aucune écriture ;
//   C8 Paramètres → Aide : l'interrupteur coupe (la ligne le dit) et plus rien ne
//      paraît ; « Revoir les conseils » remet tout ;
//   C9 mouvement réduit : un fondu, rien ne bouge ; aucune erreur JS.
// Usage : npm run build && node scripts/bancs/conseils.cjs   (BANC_CAPTURES=<dossier>)
'use strict';
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const http = require('http'), fs = require('fs');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 12011;
const CAPTURES = process.env.BANC_CAPTURES || '';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const SESSION = { access_token: 'jeton-de-banc', refresh_token: 'r', expires_at: Date.now() + 3600e3, user: { id: '11111111-2222-3333-4444-555555555555', email: 'banc@exemple.fr' } };
const COMPTES = [{ vinted_user_id: '777', login: 'vendeuse', owner: SESSION.user.id }];
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';

let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`  ${bon ? '✅' : '❌'} ${quoi}${!bon && det ? ' — ' + det : ''}`); };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!p.startsWith(DIST) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

// base : { main, acc (la ligne vrm_accompagnement ou null), ecritures: [], lectureKO }
async function page(nav, { telephone, base, sombre = false, reduit = false, tab = 'journee' }) {
  const ctx = await nav.newContext({ ...(telephone ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: UA_IPHONE } : { viewport: { width: 1512, height: 950 } }), reducedMotion: reduit ? 'reduce' : 'no-preference', colorScheme: sombre ? 'dark' : 'light' });
  const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e.message || e).slice(0, 200)));
  await pg.addInitScript(([s, sombre, ordi]) => {
    try {
      localStorage.setItem('vrm_banc_conseils', '1');
      localStorage.removeItem('vrm_conseils_appareil');
      localStorage.setItem('vinted_dark', JSON.stringify(!!sombre));
      if (!sessionStorage.getItem('banc_init')) {
        localStorage.setItem('vrm_session', JSON.stringify(s));
        localStorage.setItem('vrm_local_owner', s.user.id);
        sessionStorage.setItem('banc_init', '1');
      }
    } catch (_) {}
    // Sur l'ordinateur, un pont d'extension qui annonce une VIEILLE version (5.200.0).
    if (ordi) {
      const dire = () => { try { window.postMessage({ __vmr: 'ready', version: '5.200.0' }, '*'); } catch (_) {} };
      let n = 0; const t = setInterval(() => { dire(); if (++n > 40) clearInterval(t); }, 250);
    }
  }, [SESSION, sombre, !telephone]);
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'jeton-de-banc', refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route('**/rest/v1/**', (r) => {
    const u = decodeURIComponent(r.request().url()); const m = r.request().method();
    const json = (d, st = 200) => r.fulfill({ status: st, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: JSON.stringify(d) });
    if (/vinted_accounts/.test(u) && m === 'GET') return json(COMPTES);
    // ── LA LIGNE vrm_accompagnement, tenue comme PostgREST (comparer-et-échanger sur rev).
    if (/app_data/.test(u) && /id=eq\.vrm_accompagnement/.test(u)) {
      if (m === 'GET') { base.lectures++; if (base.lectureKO) return json({ message: 'panne de banc' }, 500); return json(base.acc ? [{ data: base.acc }] : []); }
      if (m === 'PATCH') {
        const g = /data->>rev=eq\.([^&]+)/.exec(u); const nul = /data->>rev=is\.null/.test(u);
        const revBase = base.acc && base.acc.rev != null ? String(base.acc.rev) : null;
        const passe = base.acc && ((nul && revBase === null) || (g && g[1] === revBase));
        if (!passe) return json([]);
        try { base.acc = JSON.parse(r.request().postData() || '{}').data; base.ecritures.push(JSON.parse(JSON.stringify(base.acc))); } catch (_) {}
        return json([{ id: 'vrm_accompagnement' }]);
      }
    }
    if (/app_data/.test(u) && m === 'POST') {
      try {
        const b = JSON.parse(r.request().postData() || '{}'); const rows = Array.isArray(b) ? b : [b];
        for (const row of rows) {
          if (row.id === 'main') base.main = row.data;
          if (row.id === 'vrm_accompagnement') { if (base.acc) return json({ message: 'existe' }, 409); base.acc = row.data; base.ecritures.push(JSON.parse(JSON.stringify(row.data))); }
        }
      } catch (_) {}
      return json([], 201);
    }
    if (/app_data/.test(u) && /id=eq\.main/.test(u) && m === 'GET') return json([{ id: 'main', owner: SESSION.user.id, data: base.main, updated_at: new Date().toISOString() }]);
    if (/app_data/.test(u) && /id=eq\.main/.test(u) && m === 'PATCH') { try { const b = JSON.parse(r.request().postData() || '{}'); if (b && b.data) base.main = b.data; } catch (_) {} return json([{ id: 'main' }]); }
    return json([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await pg.route('**://*.vinted.net/**', (r) => r.abort());
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => document.querySelector('.vrm-main'), null, { timeout: 15000 }).catch(() => {});
  return { ctx, pg, erreurs };
}
const baseNeuve = () => ({ main: { vrm_bienvenue_vue: { at: 'banc' }, vrm_visite_vue: { at: 'banc' } }, acc: null, ecritures: [], lectures: 0, lectureKO: false });
const attendreBulle = (pg, ms = 9000) => pg.waitForSelector('.vrm-conseil-bulle[data-cote]:not([data-cote="mesure"])', { timeout: ms }).then(() => true).catch(() => false);
const lireBulle = (pg) => pg.evaluate(() => {
  const v = document.querySelector('.vrm-conseil'); if (!v) return null;
  const b = v.querySelector('.vrm-conseil-bulle'); const sels = (v.getAttribute('data-conseil-cible') || '').split(' , ');
  let cible = null;
  for (const s of sels) { cible = [...document.querySelectorAll(s)].find((e) => !e.closest('.vrm-conseil') && e.getClientRects().length && e.getBoundingClientRect().width > 4); if (cible) break; }
  const rb = b.getBoundingClientRect(); const rc = cible ? cible.getBoundingClientRect() : null;
  const fl = b.querySelector('.vrm-conseil-fleche').getBoundingClientRect();
  const halo = v.querySelector('.vrm-conseil-halo'); const rh = halo ? halo.getBoundingClientRect() : null;
  const nav = document.querySelector('.vrm-mobile-nav'); const rn = nav && nav.getClientRects().length ? nav.getBoundingClientRect() : null;
  const cote = b.getAttribute('data-cote');
  const fx = fl.left + fl.width / 2;
  const pointe = rc ? (fx >= rc.left && fx <= rc.right) : false;
  const cotes = rc ? (cote === 'dessous' ? (rb.top >= rc.bottom - 1 && fl.top <= rc.bottom + 14) : (rb.bottom <= rc.top + 1 && fl.bottom >= rc.top - 14)) : false;
  const auBas = !!(cible && cible.closest('.vrm-mobile-nav'));
  const boutons = [...b.querySelectorAll('button')].map((x) => { const r = x.getBoundingClientRect(); return { t: x.innerText.trim(), w: Math.round(r.width), h: Math.round(r.height) }; });
  // Aucun voile : le point au centre de l'écran (hors bulle) est un élément de l'app.
  const cx = innerWidth / 2, cy = 40; const dessous = document.elementFromPoint(cx, cy);
  return {
    cle: v.getAttribute('data-conseil'), cote, pointe, cotes, n: document.querySelectorAll('.vrm-conseil-bulle').length,
    dedans: rb.left >= 0 && rb.top >= 0 && rb.right <= innerWidth + 0.5 && rb.bottom <= innerHeight + 0.5,
    auDessusBarre: auBas || !rn || rb.bottom <= rn.top + 0.5,
    // Le halo entoure la part VISIBLE de la cible (rentré de 3 px au bord de l'écran) et n'en sort pas.
    halo: !!(rh && rc && rh.left <= Math.max(rc.left, 3) + 0.5 && rh.right >= Math.min(rc.right, innerWidth - 3) - 0.5 && rh.top <= Math.max(rc.top, 3) + 0.5 && rh.bottom >= Math.min(rc.bottom, innerHeight - 3) - 0.5
      && rh.left >= 0 && rh.top >= 0 && rh.right <= innerWidth && rh.bottom <= innerHeight),
    sansVoile: !!(dessous && !dessous.closest('.vrm-conseil')),
    boutons, titre: (b.querySelector('.vrm-conseil-titre') || {}).innerText || '', anim: getComputedStyle(b).animationName,
    fond: getComputedStyle(b).backgroundColor,
  };
});
const capture = async (pg, nom) => { if (!CAPTURES) return; fs.mkdirSync(CAPTURES, { recursive: true }); await pg.screenshot({ path: path.join(CAPTURES, nom + '.png') }); };
const etatDe = (base, cle) => (base.acc && base.acc.etats && base.acc.etats[cle]) || {};

(async () => {
  await new Promise((ok) => srv.listen(PORT, ok));
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader'] });
  try {
    for (const telephone of [false, true]) {
      const W = telephone ? 390 : 1512; const CLE = telephone ? 'ecran-accueil' : 'extension';
      for (const sombre of [false, true]) {
        const T = `[${W} ${sombre ? 'sombre' : 'clair'}]`;
        console.log(`── ${T}`);
        // ── C1-C4 : la bulle, puis « Plus tard », puis rechargement.
        const base = baseNeuve();
        const a = await page(nav, { telephone, base, sombre });
        const vue = await attendreBulle(a.pg, 12000);
        dit(vue, `${T} C1 la bulle paraît sur Ma journée`);
        if (vue) {
          await a.pg.waitForTimeout(700);           // l'entrée finie
          const b = await lireBulle(a.pg);
          dit(b.n === 1 && b.cle === CLE, `${T} C1 une seule bulle, « ${CLE} »`, `${b.n} · ${b.cle}`);
          dit(Number.isFinite(etatDe(base, CLE).vu) && base.ecritures.length >= 1, `${T} C1 son « vu » est écrit dans la ligne vrm_accompagnement`, JSON.stringify(base.acc));
          dit(b.pointe && b.cotes, `${T} C2 la pointe tombe dans la cible (${b.cote})`, JSON.stringify(b));
          dit(b.halo, `${T} C2 un halo entoure la cible`);
          dit(b.dedans && b.auDessusBarre, `${T} C2 la bulle tient dans l'écran, au-dessus de la barre du bas`);
          dit(b.sansVoile, `${T} C2 aucun voile : l'écran reste touchable`);
          dit(b.boutons.length === 3 && b.boutons.every((x) => x.h >= 44 && x.w >= 44), `${T} C3 geste, « Plus tard », « Ne plus montrer » à 44 px`, JSON.stringify(b.boutons));
          dit(sombre ? /rgb\(28, 28, 30\)/.test(b.fond) : /rgb\(255, 255, 255\)/.test(b.fond), `${T} la bulle suit le thème`, b.fond);
          await capture(a.pg, `conseils-${W}-${sombre ? 'sombre' : 'clair'}`);
          await a.pg.locator('[data-conseil-plus-tard]').click();
          await a.pg.waitForTimeout(400);
          dit(await a.pg.locator('.vrm-conseil').count() === 0, `${T} C4 « Plus tard » ferme`);
          await a.pg.waitForTimeout(800);
          dit(Number.isFinite(etatDe(base, CLE).plusTard), `${T} C4 « Plus tard » est écrit`, JSON.stringify(etatDe(base, CLE)));
        }
        dit(a.erreurs.length === 0, `${T} aucune erreur JS`, a.erreurs.join(' ¦ '));
        await a.ctx.close();
        const r = await page(nav, { telephone, base, sombre });
        dit(!(await attendreBulle(r.pg, 5000)), `${T} C4 rechargée : la bulle ne revient pas`);
        await r.ctx.close();
      }
      const T = `[${W}]`;
      // ── C5 : Échap = « Plus tard » ; « Ne plus montrer ».
      if (!telephone) {
        const b2 = baseNeuve(); const e = await page(nav, { telephone, base: b2 });
        if (await attendreBulle(e.pg)) { await e.pg.keyboard.press('Escape'); await e.pg.waitForTimeout(900);
          dit(await e.pg.locator('.vrm-conseil').count() === 0 && Number.isFinite(etatDe(b2, CLE).plusTard), `${T} C5 Échap = « Plus tard » (fermée, écrit)`);
        } else dit(false, `${T} C5 Échap : la bulle n'a pas paru`);
        await e.ctx.close();
      }
      { const b3 = baseNeuve(); const j = await page(nav, { telephone, base: b3 });
        if (await attendreBulle(j.pg)) { await j.pg.locator('[data-conseil-jamais]').click(); await j.pg.waitForTimeout(900);
          dit(await j.pg.locator('.vrm-conseil').count() === 0 && Number.isFinite(etatDe(b3, CLE).jamais), `${T} C5 « Ne plus montrer » ferme et s'écrit (jamais)`, JSON.stringify(etatDe(b3, CLE)));
        } else dit(false, `${T} C5 jamais : la bulle n'a pas paru`);
        await j.ctx.close(); }
      // ── C6 : le geste ouvre le bon panneau de Paramètres.
      { const b4 = baseNeuve(); const g = await page(nav, { telephone, base: b4 });
        if (await attendreBulle(g.pg)) {
          await g.pg.locator('[data-conseil-geste]').click(); await g.pg.waitForTimeout(1500);
          const sous = telephone ? 'push' : 'connexions';
          const ici = await g.pg.evaluate((s) => ({ tab: new URL(location.href).searchParams.get('tab') || (history.state || {}).vrmTab || '', reglages: !!document.querySelector('[data-reglage-visite]') || !!document.querySelector('.vrm-set-ligne'), sous: !![...document.querySelectorAll('[data-sous-ouvrir="' + s + '"]')].length, texte: document.body.innerText.slice(0, 4000) }), sous);
          const ouvert = telephone ? /Notifications du téléphone/.test(ici.texte) : /État des connexions|Ordinateur · version/.test(ici.texte);
          dit(ici.reglages && ouvert, `${T} C6 « Voir comment » ouvre Paramètres → ${telephone ? 'Notifications' : 'État des connexions'}`, JSON.stringify({ tab: ici.tab, reglages: ici.reglages }));
          dit(Number.isFinite(etatDe(b4, CLE).fait), `${T} C6 le geste fait est écrit (3 jours de repos)`);
          await capture(g.pg, `conseils-${W}-geste`);
        } else dit(false, `${T} C6 : la bulle n'a pas paru`);
        await g.ctx.close(); }
      // ── C7 : lecture ratée ⇒ rien.
      { const b5 = baseNeuve(); b5.lectureKO = true; const k = await page(nav, { telephone, base: b5 });
        dit(!(await attendreBulle(k.pg, 6000)) && b5.ecritures.length === 0 && b5.lectures >= 1, `${T} C7 lecture de la ligne ratée ⇒ aucune bulle, aucune écriture`, `lectures=${b5.lectures} écritures=${b5.ecritures.length}`);
        await k.ctx.close(); }
      // ── C8 : l'interrupteur et « Revoir les conseils ».
      { const b6 = baseNeuve(); const s = await page(nav, { telephone, base: b6, tab: 'settings' });
        await s.pg.waitForTimeout(2500);
        const inter = s.pg.locator('[data-reglage-conseils]');
        if (await inter.count()) {
          await inter.first().scrollIntoViewIfNeeded();
          dit(await inter.first().getAttribute('data-reglage-conseils') === 'on', `${T} C8 l'interrupteur « Conseils » dit allumé`);
          await inter.first().click(); await s.pg.waitForTimeout(900);
          dit(b6.acc && b6.acc.coupe === true && await inter.first().getAttribute('data-reglage-conseils') === 'off', `${T} C8 coupé : la ligne le dit, l'interrupteur aussi`, JSON.stringify(b6.acc));
          await capture(s.pg, `conseils-${W}-reglages`);
          await s.ctx.close();
          const p2 = await page(nav, { telephone, base: b6 });
          dit(!(await attendreBulle(p2.pg, 6000)), `${T} C8 coupés : aucune bulle sur Ma journée`);
          await p2.ctx.close();
          b6.acc = { ...b6.acc, etats: { [CLE]: { vu: Date.now(), jamais: Date.now() } } };
          const s2 = await page(nav, { telephone, base: b6, tab: 'settings' }); await s2.pg.waitForTimeout(2500);
          const rv = s2.pg.locator('[data-reglage-conseils-revoir]'); await rv.first().scrollIntoViewIfNeeded(); await rv.first().click(); await s2.pg.waitForTimeout(900);
          dit(b6.acc.coupe === false && Object.keys(b6.acc.etats || {}).length === 0, `${T} C8 « Revoir les conseils » : rallumés, les « Ne plus montrer » oubliés`, JSON.stringify(b6.acc));
          await s2.ctx.close();
          const p3 = await page(nav, { telephone, base: b6 });
          dit(await attendreBulle(p3.pg, 12000), `${T} C8 après « Revoir » : la bulle revient`);
          await p3.ctx.close();
        } else { dit(false, `${T} C8 l'interrupteur « Conseils » est dans Paramètres`); await s.ctx.close(); }
      }
      // ── C9 : mouvement réduit.
      { const b7 = baseNeuve(); const m = await page(nav, { telephone, base: b7, reduit: true });
        if (await attendreBulle(m.pg)) { const b = await lireBulle(m.pg); dit(!/entre/.test(b.anim), `${T} C9 mouvement réduit : un fondu, rien ne bouge`, b.anim); }
        else dit(false, `${T} C9 : la bulle n'a pas paru`);
        await m.ctx.close(); }
    }
  } catch (e) { dit(false, 'le banc a pu aller au bout', String(e.message).slice(0, 300)); }
  await nav.close(); srv.close();
  console.log(ko ? `\n❌ conseils : ${ko} défaut(s)` : '\n✅ conseils : rien à signaler');
  process.exit(ko ? 1 : 0);
})();
