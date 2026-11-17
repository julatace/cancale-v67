require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  ANNONCES, NOUVEAU DESIGN : LES TROIS DESSINS DE LA RANGÉE (17 nov.) — A « Liste nette » · B « Carte photo » ·
//  C « Fiche compacte » (src/designV2/LigneAnnonce.jsx), choisis par la clé d'essai `vrm_design_v2_ligne`.
//  Base INVENTÉE de 1 000 annonces en ligne (3 comptes, `_base-volume` `annonces: 2500`, 40 % en ligne) et les PIRES
//  CAS réels, posés sur les plus anciennes (le haut de la liste) : un titre très long, un N° « B188 », pas de taille,
//  pas de photo, un article qui n'est pas une chaussure. 390 tactile, clair et sombre. Mesure, par dessin :
//    · la 1re annonce sur la moitié haute ; combien d'annonces lisibles sur le premier écran ;
//    · TOUTES les rangées de la même hauteur ; rien de redit par rangée (ni compte, ni « Relier un achat ») ;
//    · aucun texte qui déborde de sa rangée ; le N° « B188 » lisible en entier ; la photo absente = le cintre ;
//    · le temps jusqu'à la 1re rangée, le nombre de nœuds de la liste (1 000 annonces).
//  Les captures vont dans SHOTS ; la planche de comparaison se fait ensuite (scripts/bancs/_planche-abc.py).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const { fabriquer } = require('./_base-volume.cjs');
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-design-v2-annonces');
fs.mkdirSync(SHOTS, { recursive: true });
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + JSON.stringify(d).slice(0, 400) : '')); } return c; };

function baseMille() {
  const b = P.base();
  const q = fabriquer({ comptes: 3, annonces: 2500 });
  const listings = q.rows.filter((r) => /_listings$/.test(r.id));
  b.rows = b.rows.filter((r) => !/_listings$/.test(r.id)).concat(listings);
  b.main[0].data.vinted_annonce_numeros = q.main[0].data.vinted_annonce_numeros;
  b.main[0].data.vinted_used_nums = q.main[0].data.vinted_used_nums;
  // Les pires cas, sur les annonces EN LIGNE les plus anciennes du premier compte (le haut de la liste « En ligne »).
  const items = listings[0].data.payload.items.filter((x) => !x.is_closed).sort((x, y) => String(x.created_at_ts).localeCompare(String(y.created_at_ts)));
  const [a, p, c, d] = items;
  a.title = 'Nike Air Max 1 ’86 OG Big Bubble Sport Red édition anniversaire taille 43'; a.size_title = '43';
  b.main[0].data.vinted_annonce_numeros[a.id] = { ...(b.main[0].data.vinted_annonce_numeros[a.id] || {}), num: 'B188', numero: 'B188' };
  p.photo = null; p.title = 'Asics Gel-Kayano 14 argent taille 41';
  c.title = 'Manteau en laine bouillie camel'; c.size_title = ''; c.brand_title = 'Sézane';
  d.title = 'Lot de 3 manuels première ST2S'; d.size_title = ''; d.brand_title = '';
  return { b, enLigne: listings.reduce((t, r) => t + r.data.payload.items.filter((x) => !x.is_closed).length, 0) };
}

async function dessin(nav, b, v, sombre) {
  const th = sombre ? 'sombre' : 'clair';
  const { ctx, pg, erreurs } = await P.ouvrir(nav, { W: 390, sombre, b, url: '/?tab=annonces', dsf: 2 });
  await pg.waitForSelector('.vrm-main', { timeout: 30000 }).catch(() => {}); await pg.waitForTimeout(1500);
  await pg.evaluate((x) => { localStorage.setItem('vrm_design_v2', '1'); localStorage.setItem('vrm_design_v2_ligne', x); }, v);
  const t0 = Date.now();
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('[data-v2l]', { timeout: 60000 }).catch(() => {});
  const tPremiere = Date.now() - t0;
  await pg.waitForTimeout(4000);
  await pg.evaluate(() => { for (const t of document.querySelectorAll('.vrm-toast')) t.click(); }); await pg.waitForTimeout(400);
  const m = await pg.evaluate(() => {
    const vis = (e) => e && e.getClientRects().length && getComputedStyle(e).display !== 'none';
    const rows = [...document.querySelectorAll('[data-v2l]')].filter(vis); const q = (e) => e.getBoundingClientRect();
    const hauteurs = [...new Set(rows.slice(0, 60).map((r) => Math.round(q(r).height)))];
    const bas = innerHeight - (document.querySelector('.vrm-tabbar') ? document.querySelector('.vrm-tabbar').getBoundingClientRect().height + 16 : 0) - 74;
    const lisibles = rows.filter((r) => q(r).top >= 0 && q(r).bottom <= bas).length;
    const deborde = rows.slice(0, 40).flatMap((r) => [...r.querySelectorAll('*')].filter((e) => !e.closest('[data-lg-tiroir]')).filter((e) => { const a = q(e), z = q(r); return vis(e) && e.children.length === 0 && (a.right > z.right + 1 || a.left < z.left - 1); }).map((e) => e.textContent.trim().slice(0, 20)));
    const b188 = [...document.querySelectorAll('[data-v2l] .sb-plaque')].find((p) => /B188/.test(p.textContent));
    return { n: rows.length, premiere: rows[0] ? Math.round(q(rows[0]).top) : null, hauteurs, lisibles, deborde: deborde.slice(0, 6),
      b188: b188 ? b188.scrollWidth <= b188.clientWidth + 1 : null, cintre: document.querySelectorAll('[data-v2l] .v2l-sans').length,
      compte: rows.filter((r) => /vendeur_\d/.test(r.textContent)).length, relierBouton: [...document.querySelectorAll('[data-v2l] button')].filter((x) => /Relier un achat/.test(x.textContent)).length,
      noeuds: (document.querySelector('.sb-liste') || { querySelectorAll: () => [] }).querySelectorAll('*').length };
  });
  console.log(`\n── ${v} · ${th} — ${m.n} rangées rendues, 1re à ${m.premiere} px, ${m.lisibles} lisibles, ${tPremiere} ms jusqu’à la 1re, ${m.noeuds} nœuds`);
  dit(m.premiere != null && m.premiere <= 422, `${v} ${th} : la 1re annonce sur la moitié haute (${m.premiere} px)`);
  dit(m.hauteurs.length === 1, `${v} ${th} : toutes les rangées de la même hauteur (${m.hauteurs.join(', ')} px)`, m.hauteurs);
  dit(m.compte === 0 && m.relierBouton === 0, `${v} ${th} : ni compte, ni bouton « Relier un achat » redits par rangée`, m);
  dit(!m.deborde.length, `${v} ${th} : rien ne sort de sa rangée`, m.deborde);
  dit(m.b188 === true, `${v} ${th} : « N°B188 » lisible en entier`, m.b188);
  dit(m.cintre >= 1, `${v} ${th} : la paire sans photo porte le cintre sur fond uni`, m.cintre);
  dit(!erreurs.length, `${v} ${th} : aucune erreur JS`, erreurs);
  await pg.screenshot({ path: path.join(SHOTS, `annonces-${v}-390-${th}.png`) });
  await ctx.close();
  return { v, th, ...m, tPremiere };
}

(async () => {
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const { b, enLigne } = baseMille();
  console.log(`base : ${enLigne} annonces en ligne`);
  dit(enLigne >= 1000, `1 000 annonces en ligne dans la base (${enLigne})`);
  const res = [];
  try { for (const v of (process.env.DESSINS || 'A,B,C').split(',')) for (const s of [false, true]) res.push(await dessin(nav, b, v, s)); }
  catch (e) { ko++; console.log('  ❌ le banc s’est arrêté : ' + String(e && e.stack || e).slice(0, 1200)); }
  fs.writeFileSync(path.join(SHOTS, 'mesures.json'), JSON.stringify(res, null, 1));
  await nav.close(); P.srv.close();
  console.log(`\n${ko ? '❌' : '✅'} design-v2-annonces : ${ok} verts, ${ko} rouges — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
