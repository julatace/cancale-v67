require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  STUDIO — LA DENSITÉ DES LISTES (idée 149) ET « AUTOMATIQUE (LE SOIR) » (idée 150), RENDUS.
//  Récit : docs/passation/2026-11-14-studio-fondation.md. Base inventée (`design-passe.cjs`).
//    D1 « Serrées » : la racine porte `data-densite="serree"` DÈS LE PREMIER RENDU (script de démarrage),
//       les rangées font 56 px, et une liste qui remplit l'écran d'un iPhone en montre ≥ 12 ;
//    D2 « Aérées » : 72 px, ≤ 9 rangées sur le même écran ; « Normales » : 64 ; les rangées restent ≥ 44 px ;
//    D3 le choix se fait dans Paramètres (Densité des listes) et vaut pour CET appareil (localStorage) ;
//    A1 fuseau Europe/Paris, « Automatique (le soir) », horloge à 22 h ⇒ sombre au PREMIER rendu, jamais clair
//       entre-temps (aucun flash) ; à 12 h ⇒ clair, jamais sombre ;
//    A2 la teinte bascule toute seule au coucher du soleil (horloge avancée d'une minute après lui) ;
//    A3 Paramètres dit « Automatique (le soir) ».
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const { ouvrir, base, srv, PORT, chromium } = P;
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-studio-reglages');
fs.mkdirSync(SHOTS, { recursive: true });
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + JSON.stringify(d).slice(0, 300) : '')); } return c; };
const pret = async (pg) => { await pg.waitForSelector('.vrm-main', { timeout: 30000 }).catch(() => {}); await pg.waitForTimeout(2600); };

// Une liste qui remplit l'écran : un fond de page fait de rangées du studio (la règle, pas un écran précis).
const MESURE = (n) => {
  const main = document.querySelector('.vrm-main');
  const hote = document.createElement('div'); hote.setAttribute('data-banc-liste', '');
  for (let i = 0; i < n; i++) { const r = document.createElement('button'); r.type = 'button'; r.className = 'sb-rangee'; r.innerHTML = '<span class="sb-plaque"><small>N°</small>' + (100 + i) + '</span><span class="sb-vignette"></span><span><span class="sb-rangee-titre">Paire ' + i + '</span><span class="sb-rangee-meta">T.42</span></span><span class="sb-prix">' + (20 + i) + '</span>'; hote.appendChild(r); }
  main.prepend(hote); main.scrollTop = 0;
  const haut = (document.querySelector('.vrm-app-header') || { getBoundingClientRect: () => ({ bottom: 0 }) }).getBoundingClientRect().bottom;
  const barre = document.querySelector('.vrm-tabbar'); const bas = barre ? barre.getBoundingClientRect().top : innerHeight;
  hote.scrollIntoView({ block: 'start' }); main.scrollTop -= haut;
  const rs = [...hote.children].map((r) => r.getBoundingClientRect());
  const vus = rs.filter((r) => r.top >= haut - 1 && r.bottom <= bas + 1).length;
  return { h: Math.round(rs[0].height), vus, racine: document.documentElement.getAttribute('data-densite') || '', var: getComputedStyle(document.documentElement).getPropertyValue('--sb-rangee-h').trim() };
};

async function densite(nav, b) {
  console.log('\n── densité des listes (390 tactile)');
  const res = {};
  for (const d of ['serree', 'normale', 'aeree']) {
    const { ctx, pg } = await ouvrir(nav, { W: 390, sombre: false, b, url: '/?tab=journee' });
    await pret(pg);
    await pg.evaluate((d) => { if (d === 'normale') localStorage.removeItem('vrm_densite'); else localStorage.setItem('vrm_densite', JSON.stringify(d)); }, d);
    // Au rechargement : la racine doit porter la densité AVANT React (le script de démarrage).
    await pg.addInitScript(() => { document.addEventListener('DOMContentLoaded', () => { window.__densiteAvantApp = document.documentElement.getAttribute('data-densite') || ''; }, { once: true }); });
    await pg.reload({ waitUntil: 'domcontentloaded' }); await pret(pg);
    const avant = await pg.evaluate(() => window.__densiteAvantApp);
    res[d] = { ...(await pg.evaluate(MESURE, 30)), avant };
    await pg.screenshot({ path: path.join(SHOTS, `densite-${d}.png`) });
    await ctx.close();
  }
  dit(res.serree.avant === 'serree' && res.aeree.avant === 'aeree' && res.normale.avant === '', 'D1 la densité est posée sur la racine AVANT le premier rendu (aucun saut)', res);
  dit(res.serree.h === 56 && res.normale.h === 64 && res.aeree.h === 72, 'D1/D2 rangées de 56 · 64 · 72 px', { s: res.serree.h, n: res.normale.h, a: res.aeree.h });
  dit(res.serree.vus >= 12, 'D1 « Serrées » : 12 paires ou plus sur un écran d’iPhone', res.serree.vus);
  dit(res.aeree.vus <= 9 && res.aeree.vus >= 7, 'D2 « Aérées » : 8 paires environ (7 à 9)', res.aeree.vus);
  dit(res.serree.vus > res.normale.vus && res.normale.vus > res.aeree.vus, 'D2 plus serré ⇒ plus de paires à l’écran', [res.serree.vus, res.normale.vus, res.aeree.vus]);
  // D3 — le choix dans Paramètres.
  const { ctx, pg } = await ouvrir(nav, { W: 390, sombre: false, b, url: '/?tab=settings' });
  await pret(pg);
  const ligne = pg.locator('[data-reglage-densite]').first();
  let choisi = null;
  if (await ligne.count()) {
    await ligne.scrollIntoViewIfNeeded().catch(() => {}); await ligne.click(); await pg.waitForTimeout(600);
    const btn = pg.locator('[data-densite-choix] [data-densite="serree"]').first();
    if (await btn.count()) { await btn.click(); await pg.waitForTimeout(300); choisi = await pg.evaluate(() => ({ racine: document.documentElement.getAttribute('data-densite'), stock: localStorage.getItem('vrm_densite'), coche: document.querySelector('[data-densite="serree"]').getAttribute('aria-checked') })); }
  }
  dit(choisi && choisi.racine === 'serree' && choisi.stock === '"serree"' && choisi.coche === 'true', 'D3 Paramètres → Densité des listes → « Serrées » : la racine et CET appareil (localStorage)', choisi);
  await ctx.close();
}

async function soir(nav, b) {
  console.log('\n── « Automatique (le soir) » (fuseau Europe/Paris)');
  const essai = async (heureParis, avancer = 0) => {
    const { ctx, pg } = await ouvrir(nav, { W: 390, sombre: false, b, url: '/?tab=journee' });
    await pret(pg);
    await pg.evaluate(() => { localStorage.setItem('vrm_apparence', JSON.stringify('soir')); });
    await pg.clock.install({ time: new Date(`2026-11-08T${heureParis}:00+01:00`) });
    // Le journal des teintes depuis le tout premier instant du document.
    await pg.addInitScript(() => { const vus = window.__teintes = []; const noter = () => { const t = document.documentElement.getAttribute('data-theme'); if (t && vus[vus.length - 1] !== t) vus.push(t); };
      new MutationObserver(noter).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }); });
    await pg.reload({ waitUntil: 'domcontentloaded' }); await pret(pg);
    if (avancer) { await pg.clock.runFor(avancer); await pg.waitForTimeout(800); }
    const r = await pg.evaluate(() => ({ teintes: window.__teintes, maintenant: document.documentElement.getAttribute('data-theme') }));
    await pg.screenshot({ path: path.join(SHOTS, `soir-${heureParis.replace(':', 'h')}${avancer ? '-avance' : ''}.png`) });
    await ctx.close();
    return r;
  };
  // `ouvrir` (design-passe) pose le fuseau Europe/Paris sur le contexte : Intl le dit à l'app et au script de démarrage.
  const nuit = await essai('22:00'), midi = await essai('12:00');
  dit(nuit.teintes[0] === 'dark' && nuit.teintes.every((t) => t === 'dark') && nuit.maintenant === 'dark', 'A1 à 22 h : sombre dès le premier rendu, jamais clair (aucun flash)', nuit);
  dit(midi.teintes[0] === 'light' && midi.teintes.every((t) => t === 'light') && midi.maintenant === 'light', 'A1 à 12 h : clair dès le premier rendu, jamais sombre', midi);
  // A2 — 17 h 05 à Paris le 8 nov. : clair ; 20 minutes plus tard (après le coucher, ≈ 17 h 15) : sombre, tout seul.
  const bascule = await essai('17:05', 20 * 60000);
  dit(bascule.teintes[0] === 'light' && bascule.maintenant === 'dark', 'A2 la teinte bascule toute seule au coucher du soleil (revue chaque minute)', bascule);
  // A3 — Paramètres le dit.
  const { ctx, pg } = await ouvrir(nav, { W: 390, sombre: false, b, url: '/?tab=settings' });
  await pret(pg);
  await pg.evaluate(() => localStorage.setItem('vrm_apparence', JSON.stringify('soir'))); await pg.reload(); await pret(pg);
  const dits = await pg.evaluate(() => { const e = document.querySelector('[data-reglage-apparence]'); return e ? { v: e.getAttribute('data-reglage-apparence'), t: e.innerText } : null; });
  dit(dits && dits.v === 'soir' && /Automatique \(le soir\)/.test(dits.t), 'A3 Paramètres dit « Automatique (le soir) »', dits);
  await ctx.close();
}

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const b = base();
  try { await densite(nav, b); await soir(nav, b); } catch (e) { ko++; console.log('  ❌ le banc s’est arrêté : ' + String(e && e.message || e).replace(/\x1b\[[0-9;]*m/g, '').slice(0, 1200)); }
  await nav.close(); srv.close();
  console.log(`\n${ko ? '❌' : '✅'} studio-reglages : ${ok} verts, ${ko} rouges — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
