// ════════════════════════════════════════════════════════════════════════
//  BANC « ENVOYER AUX FAVORIS, DIRECTEMENT » (28 nov., ext. 5.455.8)
//  Julien : « un envoi ne peut pas échouer […] tu ouvres la conversation, tu fais une offre et un message ». Le VRAI panneau
//  (vrm-badge.js + vrm-ui.js) branché sur le VRAI background.js et la VRAIE route du serveur (scripts/_favoris-monde-reel.cjs),
//  à 1512 px et 390 px (tactile), clair et sombre : la liste, le récapitulatif « Envoyer », après l'envoi des deux favoris
//  (« Message envoyé · Offre faite 49,50 € »), et un refus de Vinted sur une rangée (la liste reste). Captures dans
//  captures/favoris-envoi-direct/ — à REGARDER (§6.2). On juge aussi : rien ne déborde, cibles ≥ 44 px dans la feuille.
//  `BANC_RACINE=<arbre d'avant>` : rouge attendu.
// ════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const RACINE = process.env.BANC_RACINE ? path.resolve(process.env.BANC_RACINE) : path.join(__dirname, '..', '..');
const { monde, ouvrirPanneau } = require('../_favoris-monde-reel.cjs');
const SORTIE = process.env.BANC_CAPTURES ? path.join(process.env.BANC_CAPTURES, 'favoris-envoi-direct') : path.join(__dirname, 'captures', 'favoris-envoi-direct');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d ? '  → ' + String(d).slice(0, 400) : '')); } };
(async () => {
  fs.mkdirSync(SORTIE, { recursive: true });
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const TAILLES = [{ T: '1512-clair', largeur: 1512, scheme: 'light' }, { T: '1512-sombre', largeur: 1512, scheme: 'dark' }, { T: '390-clair', largeur: 390, hauteur: 844, mobile: true, scheme: 'light' }, { T: '390-sombre', largeur: 390, hauteur: 844, mobile: true, scheme: 'dark' }];
  const cap = (P, nom) => P.pg.screenshot({ path: path.join(SORTIE, nom + '.png') }).catch(() => {});
  const mesures = (P) => P.R(() => { const r = document.getElementById('vrm-badge').shadowRoot; const f = r.querySelector('.fav6-feuille');
    const vis = (el) => !!(el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
    const petits = f ? Array.from(f.querySelectorAll('button')).filter(vis).filter((b) => b.getBoundingClientRect().height < 43.5).map((b) => (b.innerText || b.getAttribute('aria-label') || '').slice(0, 24) + ':' + Math.round(b.getBoundingClientRect().height)) : [];
    return { debord: document.documentElement.scrollWidth > window.innerWidth + 1, petits }; });
  for (const o of TAILLES) {
    console.log('\n' + o.T);
    try {
      const m = await monde(RACINE, { n: 2, dressingAncien: true });
      const P = await ouvrirPanneau(nav, m, RACINE, o);
      await P.ouvrirFavoris();
      let l = await P.lire();
      dit(l.tableau && l.rangs.jn0 && l.rangs.jn0.un && l.rangs.jn1 && l.rangs.jn1.un, `${o.T} : la liste, « Envoyer » sur chaque favori`, JSON.stringify(Object.keys(l.rangs)));
      await cap(P, o.T + '-1-liste');
      for (const id of ['jn0', 'jn1']) await P.clic(`.fav6-table li[data-fav-qui="${id}"] input[data-fav-coche]`);
      await P.clic('[data-fav-envoyer]'); await P.pg.waitForTimeout(700);
      l = await P.lire(); const me = await mesures(P);
      dit(l.etape === '4' && l.lancer, `${o.T} : « Envoyer » ⇒ directement le récapitulatif et « Lancer »`, l.etape);
      dit(!me.debord && !me.petits.length, `${o.T} : rien ne déborde, cibles ≥ 44 px`, JSON.stringify(me));
      await cap(P, o.T + '-2-envoyer');
      await P.clic('.fav6-feuille [data-fav-lancer]'); await P.pg.waitForTimeout(600);
      await m.tours(8, () => P.pg.waitForTimeout(200)); await P.pg.waitForTimeout(900);
      l = await P.lire();
      dit(['jn0', 'jn1'].every((id) => l.rangs[id] && /Message envoyé/.test(l.rangs[id].texte) && /Offre faite 49,50 €/.test(l.rangs[id].texte)) && !l.vuLecture.length, `${o.T} : après l’envoi, « Message envoyé · Offre faite 49,50 € » sur les deux rangées`, JSON.stringify(Object.values(l.rangs).map((x) => x.texte.slice(0, 120))));
      await cap(P, o.T + '-3-apres');
      await P.ctx.close(); m.fin();
      // Un refus de Vinted sur la 1re rangée : la liste reste, le refus est sur SA rangée.
      const m2 = await monde(RACINE, { n: 2, vinted: (e) => (e.methode === 'POST' && e.chemin === '/api/v2/transactions/6000/offers' ? { status: 400, body: { code: 106 } } : null) });
      const P2 = await ouvrirPanneau(nav, m2, RACINE, o);
      await P2.ouvrirFavoris();
      for (const id of ['jn0', 'jn1']) await P2.clic(`.fav6-table li[data-fav-qui="${id}"] input[data-fav-coche]`);
      await P2.clic('[data-fav-envoyer]'); await P2.pg.waitForTimeout(500); await P2.clic('.fav6-feuille [data-fav-lancer]'); await P2.pg.waitForTimeout(500);
      await m2.tours(8, () => P2.pg.waitForTimeout(200)); await P2.pg.waitForTimeout(900);
      l = await P2.lire();
      dit(l.tableau && /Refusé par Vinted/.test((l.rangs.jn0 || {}).texte || '') && /Message envoyé/.test((l.rangs.jn1 || {}).texte || ''), `${o.T} : un refus de Vinted sur SA rangée, l’autre envoyée, la liste reste`, JSON.stringify(Object.values(l.rangs).map((x) => x.texte.slice(0, 120))));
      await cap(P2, o.T + '-4-refus');
      dit(!P.erreurs.length && !P2.erreurs.length, `${o.T} : aucune erreur de page`, JSON.stringify(P.erreurs.concat(P2.erreurs)));
      await P2.ctx.close(); m2.fin();
    } catch (e) { ko++; console.log('  ❌ ' + o.T + ' a levé : ' + String(e && e.stack || e).slice(0, 400)); }
  }
  await nav.close();
  console.log(`\n${ko ? '❌' : '✅'} banc favoris-envoi-direct : ${ok} vert(s), ${ko} rouge(s) — captures : ${SORTIE}`);
  process.exit(ko ? 1 : 0);
})();
