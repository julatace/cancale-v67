// Film jetable (25 nov.) : le CHARGEMENT de chaque onglet à 390 px, réponses lentes (BANC_LENT, 700–1500 ms au hasard
// fixé), une image toutes les ~150 ms pendant 6 s ; puis la DEUXIÈME ouverture (rechargement : copies, caches).
// Rapporte par image : squelettes visibles, copie montrée, positions des blocs (sauts), et sort les images.
process.env.BANC_DESIGN_V2 = process.env.BANC_DESIGN_V2 || 'defaut';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const OUT = process.env.FILM_OUT || '/tmp/film';
const ONGLETS = (process.env.ONGLETS || 'journee,cat_annonces,cat_ventes,achats,compta').split(',');
const DUREE = Number(process.env.FILM_MS || 6000);
const PAS = 150;
const MESURE = () => {
  const vu = (e) => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < innerHeight; };
  const sq = [...document.querySelectorAll('.vrm-skeleton, .n-os, [data-place-attente], .vrm-sq-barre, .ebt-squelette')].filter(vu).length;
  const copie = !!document.querySelector('[data-copie-ecran]:not([hidden])') && [...document.querySelectorAll('[data-copie-ecran]')].some(vu);
  // Les blocs suivis : les enfants directs du contenu de page (cartes, groupes) et leurs positions.
  const blocs = [...document.querySelectorAll('.vrm-main .n-page-contenu > *, .vrm-main .n-colonnes > *, .vrm-main .n-groupe, .vrm-main .n-carte')].filter(vu).slice(0, 40)
    .map((e) => ({ k: (e.getAttribute('data-v2-bloc') || e.getAttribute('data-tb') || e.className || e.tagName).toString().slice(0, 40) + '|' + (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 18), y: Math.round(e.getBoundingClientRect().top), h: Math.round(e.getBoundingClientRect().height) }));
  const imgsBlanches = [...document.querySelectorAll('.vrm-main img')].filter((i) => vu(i) && (!i.complete || !i.naturalWidth)).length;
  return { sq, copie, blocs, imgsBlanches };
};
(async () => {
  const b = P.base();
  if (process.env.EBAY) b.rows.push({ id: 'ebay_comptes', data: { comptes: [{ principal: true, pseudo: 'boutique-ebay', ajouteLe: Date.now() - 9e8 }] } });
  await new Promise((ok) => P.srv.listen(P.PORT, ok));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const rapport = {};
  try {
    for (const tab of ONGLETS) {
      fs.mkdirSync(path.join(OUT, tab), { recursive: true });
      const { ctx, pg, erreurs } = await P.ouvrir(nav, { W: 390, b, url: '/?tab=' + tab, dsf: 1 });
      rapport[tab] = {};
      for (const tour of ['premiere', 'deuxieme']) {
        if (tour === 'deuxieme') { await pg.waitForTimeout(4000); await pg.reload({ waitUntil: 'commit' }); }
        const t0 = Date.now(); const images = [];
        for (let i = 0; Date.now() - t0 < DUREE; i++) {
          const t = Date.now() - t0;
          const m = await pg.evaluate(MESURE).catch(() => null);
          const f = path.join(OUT, tab, `${tour}-${String(i).padStart(3, '0')}-${t}.jpg`);
          await pg.screenshot({ path: f, type: 'jpeg', quality: 55 }).catch(() => {});
          images.push({ t, f, ...(m || {}) });
          const reste = PAS - ((Date.now() - t0) - t); if (reste > 0) await pg.waitForTimeout(reste);
        }
        rapport[tab][tour] = images;
        // Sauts : un bloc (même clé) dont y change entre deux images après la 1re image où il paraît.
        const sauts = []; const vu = {};
        for (const im of images) for (const bl of im.blocs || []) { if (vu[bl.k] != null && Math.abs(vu[bl.k] - bl.y) > 2) sauts.push(`${im.t}ms ${bl.k} ${vu[bl.k]}→${bl.y}`); vu[bl.k] = bl.y; }
        console.log(`\n▶ ${tab} · ${tour} · ${images.length} images`);
        console.log('  squelettes par image : ' + images.map((x) => x.sq).join(','));
        console.log('  copie montrée       : ' + images.map((x) => (x.copie ? 'C' : '.')).join(''));
        console.log('  images non chargées : ' + images.map((x) => x.imgsBlanches).join(','));
        console.log('  sauts (' + sauts.length + ') : ' + sauts.slice(0, 14).join(' | '));
        if (erreurs.length) console.log('  erreurs : ' + erreurs.join(' | '));
      }
      await ctx.close();
    }
  } finally { await nav.close(); P.srv.close(); fs.writeFileSync(path.join(OUT, 'rapport.json'), JSON.stringify(rapport)); }
})();
