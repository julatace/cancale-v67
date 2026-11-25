// ════════════════════════════════════════════════════════════════════════════
//  PASSAGES D'ONGLET (25 nov., Julien : « améliore encore l'affichage quand les données apparaissent d'un onglet à l'autre »).
//  Module partagé par regressions-25nov (cas O) et lançable seul pour FILMER :
//    node scripts/bancs/_passages-onglets.cjs   (FILM=<dossier> : une image toutes les ~120 ms par passage ; W=390|1512 ; THEME)
//  La base inventée de design-passe.cjs, chaque réponse tenue BANC_LENT ms (700 par défaut). Parcours : Aujourd'hui → Annonces →
//  Ventes → Achats → Argent → Aujourd'hui → (2e tour) Annonces → … → Argent. Pour CHAQUE passage, mesuré DANS la page à chaque
//  image (requestAnimationFrame) pendant FENETRE ms après le toucher :
//    sq      images où un squelette est visible (`.n-os`, `.vrm-skeleton`, `[data-place-attente]`, `.vrm-sq-barre`) ;
//    vide    images où l'écran n'a presque rien (< 20 signes de texte dans `.vrm-main`) — un clignotement blanc / gris ;
//    sauts   nœuds (identité DOM) déjà affichés qui bougent de > 4 px (position dans le contenu défilé : le défilement ne compte pas) ;
//    defile  2e visite : la position de défilement laissée (300 px) est-elle retrouvée ?
// ════════════════════════════════════════════════════════════════════════════
'use strict';
process.env.BANC_DESIGN_V2 = process.env.BANC_DESIGN_V2 || 'defaut';
if (!process.env.BANC_LENT) process.env.BANC_LENT = '700';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const ONGLETS = [['annonces', 'Annonces'], ['ventes', 'Ventes'], ['achats', 'Achats'], ['argent', 'Argent'], ['journee', 'Aujourd']];
const FENETRE = Number(process.env.FENETRE || 2400);

// Posé dans la page : un échantillonneur par image, armé à chaque passage.
const SONDE = () => {
  const ids = new WeakMap(); let nid = 0;
  const id = (e) => { if (!ids.has(e)) ids.set(e, ++nid); return ids.get(e); };
  const SEL_SQ = '.n-os, .vrm-skeleton, [data-place-attente], .vrm-sq-barre';
  const SEL_BL = '.vrm-main :is([data-v2-bloc], .n-groupe, .n-carte, .n-rangee, [data-ad-rangee], tr, .n-tuile, .n-ar, h1, h2)';
  window.__passage = (ms) => new Promise((fin) => {
    const t0 = performance.now(); const res = { images: 0, sq: 0, vide: 0, sauts: 0, detail: [] }; const pos = new Map();
    const tour = () => {
      const main = document.querySelector('.vrm-main');
      if (main) {
        res.images++;
        const vu = (e) => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < innerHeight && getComputedStyle(e).visibility !== 'hidden'; };
        const sqv = [...main.querySelectorAll(SEL_SQ)].filter(vu); if (sqv.length) { res.sq++; if (!res.quoi) { const ch = []; for (let x = sqv[0]; x && ch.length < 6; x = x.parentElement) ch.push((typeof x.className === 'string' && x.className ? x.className.split(' ')[0] : x.tagName) + [...x.attributes].filter((a) => a.name.startsWith('data-')).slice(0, 1).map((a) => '[' + a.name + '=' + a.value.slice(0, 14) + ']').join('')); res.quoi = ch.join('<'); } }
        if ((main.innerText || '').replace(/\s+/g, '').length < 20) res.vide++;
        const s = main.scrollTop || 0;
        for (const e of [...main.querySelectorAll(SEL_BL)].slice(0, 200)) {
          if (!vu(e)) continue;
          const y = Math.round(e.getBoundingClientRect().top + s), k = id(e);
          const avant = pos.get(k);
          if (avant != null && Math.abs(avant - y) > 4) { res.sauts++; if (res.detail.length < 6) res.detail.push(Math.round(performance.now() - t0) + 'ms ' + (e.getAttribute('data-v2-bloc') || e.className || e.tagName).toString().slice(0, 30) + ' ' + avant + '→' + y); }
          pos.set(k, y);
        }
      }
      if (performance.now() - t0 < ms) requestAnimationFrame(tour); else fin(res);
    };
    requestAnimationFrame(tour);
  });
};

async function parcours(nav, { W = 390, sombre = false, film = '', b = P.base() } = {}) {
  const { ctx, pg, erreurs } = await P.ouvrir(nav, { W, b, url: '/?tab=journee', sombre, dsf: 1 });
  await pg.evaluate(SONDE);
  await pg.waitForSelector('.vrm-main [data-attente="pret"]', { timeout: 40000 }).catch(() => {});
  await pg.waitForTimeout(Number(process.env.REPOS || 6000));   // l'app ouverte, au repos (les préchargements ont eu leur chance)
  const lignes = []; const laisses = {};
  const toucher = (lib) => pg.evaluate((lib) => {
    const c = [...document.querySelectorAll('nav a, nav button, [role="tab"], .n-onglets button, .n-laterale a, .n-laterale button')].find((x) => (x.textContent || '').replace(/[0-9\s]+/g, '').startsWith(lib) && x.getClientRects().length);
    if (c) c.click(); return !!c;
  }, lib);
  for (const visite of [1, 2]) {
    for (const [cle, lib] of ONGLETS) {
      if (visite === 2 && cle === 'journee') continue;
      const mesure = pg.evaluate((ms) => window.__passage(ms), FENETRE);
      const ok = await toucher(lib);
      let images = [];
      if (film) {
        const t0 = Date.now(); let i = 0;
        while (Date.now() - t0 < FENETRE) { const f = path.join(film, `${W}-${sombre ? 'sombre' : 'clair'}-v${visite}-${cle}-${String(i++).padStart(2, '0')}-${Date.now() - t0}.jpg`); await pg.screenshot({ path: f, type: 'jpeg', quality: 50 }).catch(() => {}); images.push(f); await pg.waitForTimeout(60); }
      }
      const r = await mesure;
      let defile = null;
      if (visite === 2) defile = await pg.evaluate(() => { const m = document.querySelector('.vrm-main'); return m ? Math.round(m.scrollTop) : null; });
      // Le squelette vu est-il celui de l'ÉCRAN (sa forme, `data-squelette` / attente native de l'écran) ou un bloc gris étranger ?
      lignes.push({ visite, cle, ok, ...r, defile, laisse: laisses[cle] });
      // Laisser l'écran défilé de 300 px (la 2e visite doit retrouver CE qui a été laissé), une fois l'écran prêt.
      if (visite === 1) {
        await pg.waitForSelector('.vrm-main [data-attente="pret"], .vrm-main [data-attente="plafond"]', { timeout: 15000 }).catch(() => {});
        await pg.waitForTimeout(1200);
        laisses[cle] = await pg.evaluate(() => { const m = document.querySelector('.vrm-main'); if (!m) return null; m.scrollTop = 300; return Math.round(m.scrollTop); });
      }
      await pg.waitForTimeout(visite === 1 ? 2500 : 800);
    }
  }
  await ctx.close();
  return { lignes, erreurs };
}
module.exports = { parcours };

if (require.main === module) (async () => {
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try {
    const film = process.env.FILM || ''; if (film) fs.mkdirSync(film, { recursive: true });
    for (const W of String(process.env.W || '390,1512').split(',').map(Number)) for (const th of String(process.env.THEME || 'clair').split(',')) {
      const { lignes, erreurs } = await parcours(nav, { W, sombre: th === 'sombre', film });
      console.log(`\n▶ ${W} ${th}`);
      for (const l of lignes) console.log(`  v${l.visite} ${l.cle.padEnd(9)} images ${String(l.images).padStart(3)} · squelette ${String(l.sq).padStart(3)} · vide ${String(l.vide).padStart(3)} · sauts ${String(l.sauts).padStart(3)}${l.defile != null ? ' · défilement ' + l.defile : ''}${l.ok ? '' : ' (onglet pas trouvé)'}${l.quoi ? '  [' + l.quoi + ']' : ''}${l.detail.length ? '  ' + l.detail.join(' | ') : ''}`);
      if (erreurs.length) console.log('  erreurs : ' + erreurs.join(' | '));
    }
  } finally { await nav.close(); P.srv.close(); }
})();
