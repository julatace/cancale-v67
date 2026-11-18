// ═══════════════════════════════════════════════════════════════════════════
// BANC : OÙ S'OUVRE UN ÉCRAN, ET QUEL ONGLET EST ALLUMÉ (17 nov., chasse-bugs)
//        node scripts/bancs/defilement-navigation.cjs — après `npm run build` (NAVIGATEUR=webkit pour Safari)
// ═══════════════════════════════════════════════════════════════════════════
// Julien (iPhone) : « Quand j'ai déclaré par exemple, ça me met en plein milieu de la page, j'ai pas tout en
// haut » ; sur une autre capture, l'écran Argent avec « Ventes » allumé dans la barre, et le bas de la page
// (« Imprimer… / Télécharger en PDF ») sous la barre. Données INVENTÉES : le jeu de `nouveau-vendeur`, avec
// un statut micro-entrepreneur et un mois à déclarer. 390 px tactile. Exige (scrollTop de `.vrm-main`) :
//   N1 chaque segment d'Argent (Résumé · Statistiques · Déclarer · Factures) s'ouvre EN HAUT, même si on avait
//      fait défiler le segment d'avant ;
//   N2 « J'ai déclaré » ouvre sa destination EN HAUT (même si cet écran gardait une position d'une visite d'avant) ;
//   N3 chaque carte de Ma journée qui mène à un écran l'ouvre EN HAUT (même cas) ;
//   N4 toucher l'onglet déjà allumé remonte en haut SANS changer d'écran ni de segment (Argent sur Statistiques) ;
//   N5 revenir sur un onglet par la barre garde SA position (le contrôle de l'autre sens) ;
//   N6 sur chaque écran, l'onglet allumé de la barre est celui de l'écran montré ;
//   N7 tout en bas d'un écran, le dernier élément passe AU-DESSUS de la barre (rien de coincé dessous).
// `BANC_MUTATION=garde-tout` : la position gardée est rendue à chaque arrivée (la règle d'avant) — doit rougir.
'use strict';
process.env.BANC_PORT = process.env.BANC_PORT || '10791';
const path = require('path');
const NV = require('./nouveau-vendeur.cjs');
const PW = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { lancer } = require('./_navigateur.cjs');
const SHOTS = process.env.SHOTS || '';

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (!c && d != null ? ' — ' + String(d).slice(0, 400) : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 200)); } };

// Un mois à déclarer : le mois d'avant, publié comme Ventes le publie (`vinted_urssaf_mois`).
const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
const YM = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const base = () => {
  const lignes = JSON.parse(JSON.stringify(NV.JEU_LIGNES));
  const m = lignes.find((l) => l.id === 'main');
  Object.assign(m.data, { vinted_regime: 'micro', vinted_urssaf_taux: 13.4, vinted_urssaf_freq: 'mensuel',
    vinted_urssaf_mois: { at: Date.now() - 3600000, mois: [{ ym: YM, ca: 300, n: 3, par: { Vinted: { n: 3, ca: 300 } } }], aDater: { n: 0, ca: 0, par: {} }, sources: { Vinted: 'lu', Leboncoin: 'lu', eBay: 'lu', Vestiaire: 'nonRelie' } } });
  return { lignes, comptes: NV.JEU_COMPTES, ecritures: 0 };
};
const ATTENDU = { journee: 'journee', annonces: 'paires', garage: 'paires', achats: 'achats', ventes: 'ventes', cat_bord: 'ventes', compta: 'compta', dashboard: 'compta' };

const etat = (pg) => pg.evaluate(() => {
  const m = document.querySelector('.vrm-main'); const a = document.querySelector('.vrm-tabbar [aria-current="page"]');
  const seg = document.querySelector('[data-plat-sub-actif], .vrm-plat-subnav [aria-pressed="true"], .vrm-plat-subnav [aria-selected="true"]');
  return { ecran: m ? m.getAttribute('data-ecran') : null, top: m ? Math.round(m.scrollTop) : null, haut: m ? m.scrollHeight - m.clientHeight : 0, actif: a ? a.getAttribute('data-nav-entree') : null, seg: seg ? seg.innerText.trim() : '', url: location.search };
});
const defiler = (pg, y) => pg.evaluate((y) => { const m = document.querySelector('.vrm-main'); m.scrollTop = Math.min(y, m.scrollHeight - m.clientHeight); return Math.round(m.scrollTop); }, y);
const attendre = (pg, ms = 1200) => pg.waitForTimeout(ms);
// Le geste « pause » : la mémoire du défilement range la position à la sortie ; on laisse le temps au tenir (2,5 s) de finir.
const poser = async (pg) => { await pg.mouse.move(5, 300).catch(() => {}); await attendre(pg, 2800); };
const barre = async (pg, id) => { await pg.locator(`.vrm-tabbar [data-nav-entree="${id}"]`).first().tap(); await attendre(pg, 1800); };
const segment = async (pg, libelle) => {
  const l = pg.locator('.vrm-main').getByRole('button', { name: new RegExp('^' + libelle + '$') }).first();
  if (await l.count()) await l.tap(); else await pg.locator(`.vrm-main :text-is("${libelle}")`).first().tap();
  await attendre(pg, 1800);
};

(async () => {
  await new Promise((r) => NV.srv.listen(NV.PORT, r));
  const nav = await lancer(PW, { executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    const o = await NV.ouvrir(nav, { W: 390, sombre: false, base: base(), tab: 'journee' });
    const { pg, journal } = o;
    await pg.addInitScript(() => {});
    await attendre(pg, 5000);
    if (process.env.BANC_MUTATION === 'garde-tout') console.log('(mutation garde-tout : jouée par le build muté, BANC_DIST)');

    // N5 d'abord : Ventes défilée, on part par la barre et on revient par la barre ⇒ sa position.
    await essaie('N5', async () => {
      await barre(pg, 'ventes');
      const y = await defiler(pg, 700); await poser(pg);
      await barre(pg, 'compta'); await barre(pg, 'ventes');
      const e = await etat(pg);
      dit(y > 200 && e.top >= Math.min(y, e.haut) - 40, `N5 revenir sur Ventes par la barre garde sa position (${y})`, JSON.stringify(e));
    });
    // N2 « J'ai déclaré » : Ventes gardait 700 ; le geste doit ouvrir sa destination en haut.
    await essaie('N2', async () => {
      await barre(pg, 'compta');
      await segment(pg, 'Déclarer');
      const b = pg.locator('[data-urssaf-cest-declare]').filter({ visible: true }).first();
      const la = await b.count();
      dit(la > 0, `N2 « J’ai déclaré » est là (mois ${YM} à déclarer)`);
      if (!la) return;
      await b.scrollIntoViewIfNeeded(); await b.tap(); await attendre(pg, 2500);
      const e = await etat(pg);
      dit(e.top === 0, `N2 « J’ai déclaré » ouvre ${e.ecran} EN HAUT`, JSON.stringify(e));
      dit(e.actif === ATTENDU[e.ecran], `N6 après « J’ai déclaré », l’onglet allumé (${e.actif}) est celui de l’écran montré (${e.ecran})`, JSON.stringify(e));
      if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, 'defil-declare.png') });
      await pg.keyboard.press('Escape').catch(() => {}); const f = pg.locator('[aria-label="Fermer"]').filter({ visible: true }).last(); if (await f.count()) await f.tap().catch(() => {});
      await attendre(pg, 1000);
    });
    // N1 les segments d'Argent.
    await essaie('N1', async () => {
      await barre(pg, 'compta');
      // Deux tours : au second, chaque segment a déjà une position d'une visite d'avant — un geste l'ouvre quand même en haut.
      for (const s of ['Statistiques', 'Déclarer', 'Factures', 'Résumé', 'Déclarer', 'Statistiques', 'Résumé']) {
        const y = await defiler(pg, 900); await poser(pg);
        await segment(pg, s);
        const e = await etat(pg);
        dit(e.top === 0, `N1 Argent → « ${s} » s’ouvre en haut (le segment d’avant était à ${y})`, JSON.stringify(e));
        dit(e.actif === ATTENDU[e.ecran], `N6 Argent → « ${s} » : l’onglet allumé (${e.actif}) est celui de l’écran (${e.ecran})`, JSON.stringify(e));
      }
    });
    // N4 l'onglet allumé retouché (Argent sur Statistiques).
    await essaie('N4', async () => {
      await segment(pg, 'Statistiques');
      const y = await defiler(pg, 600); await poser(pg);
      const e0 = await etat(pg);
      await pg.locator('.vrm-tabbar [data-nav-entree="compta"]').first().tap(); await attendre(pg, 1500);
      const e = await etat(pg);
      dit(y > 100 && e.top === 0 && e.ecran === e0.ecran, `N4 retoucher « Argent » sur Statistiques remonte en haut sans changer d’écran (${e0.ecran} → ${e.ecran})`, JSON.stringify({ e0, e }));
    });
    // N3 les cartes de Ma journée : chaque destination gardait une position (visite par la barre, défilée).
    await essaie('N3', async () => {
      for (const dest of ['ventes', 'achats']) { await barre(pg, dest); await defiler(pg, 800); await poser(pg); }
      await barre(pg, 'journee');
      await pg.waitForSelector('.vrm-main [data-tuile]', { timeout: 15000 }).catch(() => {});
      const cartes = await pg.evaluate(() => [...document.querySelectorAll('.vrm-main [data-tuile], .vrm-main [data-sj-lien]')].filter((x) => x.getClientRects().length).map((x, i) => { x.setAttribute('data-banc-carte', String(i)); return { i, t: (x.innerText || '').split('\n')[0].slice(0, 30) }; }));
      console.log(`   (N3 : ${cartes.length} cartes : ${cartes.map((c) => c.t).join(' | ')})`);
      let vues = 0;
      for (const c of cartes) {
        // Chaque carte depuis une Ma journée fraîche (une carte qui ouvre une feuille ne gêne pas la suivante).
        await pg.goto(`http://localhost:${NV.PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('.vrm-main [data-tuile]', { timeout: 20000 }).catch(() => {});
        await attendre(pg, 1500);
        await pg.evaluate(() => [...document.querySelectorAll('.vrm-main [data-tuile], .vrm-main [data-sj-lien]')].filter((x) => x.getClientRects().length).forEach((x, i) => x.setAttribute('data-banc-carte', String(i))));
        const l = pg.locator(`[data-banc-carte="${c.i}"]`);
        const avant = await etat(pg);
        await l.first().tap({ timeout: 4000 }).catch((e) => console.log(`   (N3 « ${c.t} » : toucher impossible : ${String(e.message).split('\n')[0]})`));
        await pg.waitForFunction((a) => { const m = document.querySelector('.vrm-main'); return m && m.getAttribute('data-ecran') !== a; }, avant.ecran, { timeout: 8000 }).catch(() => {});
        await attendre(pg, 1500);
        const e = await etat(pg);
        if (e.ecran === avant.ecran) { console.log(`   (N3 « ${c.t} » : reste sur ${e.ecran})`); continue; }
        vues++;
        // En haut — ou sur l'élément que la carte vise (« À envoyer » mène à la section des colis, près du haut) ; jamais la
        // position d'une visite d'avant (800 px posés plus haut).
        dit(e.top < 300, `N3 Ma journée → carte « ${c.t} » ouvre ${e.ecran} en haut (ou sur ce qu’elle vise), pas à la position d’avant`, JSON.stringify(e));
        dit(e.actif === ATTENDU[e.ecran] || !ATTENDU[e.ecran], `N6 carte « ${c.t} » : l’onglet allumé (${e.actif}) est celui de ${e.ecran}`, JSON.stringify(e));
      }
      dit(vues >= 1, `N3 au moins une carte de Ma journée mène à un écran (${vues} ; les autres ouvrent une feuille)`);
    });
    // N6 + N7 : chaque écran de la barre.
    for (const id of ['journee', 'paires', 'achats', 'ventes', 'compta']) await essaie('N7 ' + id, async () => {
      await barre(pg, id);
      const e = await etat(pg);
      dit(e.actif === ATTENDU[e.ecran], `N6 ${id} : l’onglet allumé (${e.actif}) est celui de l’écran montré (${e.ecran})`, JSON.stringify(e));
      // Tout en bas, une fois le contenu arrivé (la hauteur ne bouge plus).
      for (let k = 0, h0 = -1; k < 10; k++) { await defiler(pg, 1e7); await attendre(pg, 800); const h = await pg.evaluate(() => { const m = document.querySelector('.vrm-main'); return { h: m.scrollHeight, auBout: Math.abs(m.scrollTop - (m.scrollHeight - m.clientHeight)) < 2 }; }); if (h.h === h0 && h.auBout) break; h0 = h.h; }
      const b = await pg.evaluate(() => {
        const bar = document.querySelector('.vrm-tabbar'); const m = document.querySelector('.vrm-main'); if (!bar || !m) return null;
        const haut = bar.getBoundingClientRect().top;
        let bas = 0, quoi = '';
        const mr = m.getBoundingClientRect();
        for (const x of m.querySelectorAll('button, a, p, h1, h2, h3, li, [data-fu-principal]')) {
          const r = x.getBoundingClientRect(); const s = getComputedStyle(x);
          if (!r.width || !r.height || s.visibility === 'hidden' || s.position === 'fixed' || x.closest('[role="dialog"], .vrm-sheet, .vrm-tabbar, [aria-hidden="true"], [hidden]')) continue;
          if (!((x.innerText || '').trim() || x.getAttribute('aria-label'))) continue;
          if (r.top >= mr.bottom || (x.checkVisibility && !x.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }))) continue;
          // Coupé par un parent qui ne déborde pas (liste repliée, carrousel) : pas une ligne de la page.
          let clip = false; for (let p = x.parentElement; p && p !== m; p = p.parentElement) { const cs = getComputedStyle(p); if (/(hidden|clip|auto|scroll)/.test(cs.overflowY) && r.top >= p.getBoundingClientRect().bottom - 1) { clip = true; break; } } if (clip) continue;
          if (r.bottom > bas) { bas = r.bottom; quoi = (x.innerText || '').trim().slice(0, 30); }
        }
        return { haut: Math.round(haut), bas: Math.round(bas), quoi };
      });
      dit(!!b && b.bas <= b.haut + 1, `N7 ${id} : tout en bas, le dernier élément (« ${b && b.quoi} ») passe au-dessus de la barre`, JSON.stringify(b));
    });
    dit(!journal.erreurs.filter((x) => !/access control checks|lgonxzrzjcqthjtbdpzo\.supabase\.co/.test(x)).length, 'aucune erreur de page', journal.erreurs.filter((x) => !/access control checks|lgonxzrzjcqthjtbdpzo\.supabase\.co/.test(x)).join(' | '));
    await o.ctx.close();
  } catch (e) { dit(false, 'le banc a pu tourner', String(e && e.stack || e).slice(0, 400)); }
  finally { await nav.close().catch(() => {}); NV.srv.close(); }
  console.log(`\n${ko ? 'KO' : 'OK'} defilement-navigation : ${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})();
