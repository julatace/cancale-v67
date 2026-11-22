// ═══════════════════════════════════════════════════════════════════════════
// BANC : VENTES ANNULÉES (tous sites) DANS « VENTES » + VESTIAIRE « EN ATTENTE DE VALIDATION » (22 novembre)
//        npm run build && BANC_PORT=4797 node scripts/bancs/annulees-vc-validation.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Données INVENTÉES (dépôt public), de la FORME réelle mesurée le 22 nov. Le socle (ventes Vinted, Leboncoin, eBay,
// Vestiaire, faux serveur, projection `select=`) est celui de scripts/bancs/annulations-notes.cjs, exécuté ici.
//   V. Ventes → « Terminées », 390 tactile : la liste ne porte plus les annulées ; UN groupe replié « Annulées · N »
//      (Vinted 3, Leboncoin 1 — avant CACHÉE —, eBay 1, Vestiaire 1), chaque rangée avec le logo de SON site et son
//      motif ; l'annulée Leboncoin sans rôle lu n'y est pas. 1512 : le tableau, statut « Annulée », Leboncoin compris.
//   M. Vestiaire → annonces : « en attente de validation » (neutre), « à corriger » (ambre + geste), « refusée » ;
//      les compteurs de Vestiaire (2 en attente dont 1 « laquelle : pas su ») ; l'annonce en attente n'est pas « en ligne ».
// `BANC_CAPTURE=<dossier>` : captures 390 et 1512.
const fs = require('fs'), path = require('path');
const socle = fs.readFileSync(path.join(__dirname, 'annulations-notes.cjs'), 'utf8');
const i0 = socle.indexOf("require('./_porte-banc.cjs');"), i1 = socle.indexOf('const lire = (pg) =>');
if (i0 < 0 || i1 < 0) { console.log('❌ socle introuvable (annulations-notes.cjs)'); process.exit(1); }
// Le port de CE banc, et l'horloge du socle (29 oct. 2026).
// Le socle ne sert que `id=eq.` et `id=like.` : ce banc ajoute `id=in.(a,b)` (la forme des lectures de Ventes et de la coque).
const code = socle.slice(i0, i1).replace('|| 4531', '|| 4797').replace("    const lk = /id=like\\.([^&]*)/.exec(u);", "    const dans = /id=in\\.\\(([^)]*)\\)/.exec(u); if (dans) { const ids = dans[1].split(','); return j(rows.filter((r) => ids.includes(r.id)).map((r) => projette(r, S))); }\n    const lk = /id=like\\.([^&]*)/.exec(u);") + `
const frais = ilya(0);
const annVc = (statut, extra = {}) => Object.assign({ statut, vuAt: frais, compte: '37000001', prix: { valeur: 120, devise: 'EUR', cle: 'price.cents' }, boost: null, cles: [], favoris: null }, extra);
rows.push({ id: 'vc_listings', data: { capturedAt: frais, complet: true, total: 4, liens: {}, items: {
  72000001: annVc('published', { titre: 'Escarpins inventés en cuir T38', ref: '11', moderation: { vers: 'validee', at: ilya(0.1), de: 'waitingValidation' } }),
  72000002: annVc('waitingValidation', { titre: 'Sac inventé en toile', ref: '12' }),
  72000003: annVc('waitingPicture', { titre: 'Bottes inventées T39', ref: '13' }),
  72000004: annVc('refused', { titre: 'Mocassins inventés T41', ref: '14', moderation: { vers: 'refusee', at: ilya(1), de: 'waitingValidation' } }) },
  compteurs: { 37000001: { enVente: 1, attenteValidation: 2, attentePhoto: 1, refusees: 1, vendues: 3, nonRecues: 0, at: frais } } } },
  { id: 'vc_session', data: { compte: '37000001', at: frais } });
return { chromium, srv, page, TAILLES, PORT, CAPT, dit, essaie, fin: () => ({ ko, ok }) };`;
const S = new Function('require', '__dirname', 'process', 'console', code)(require, __dirname, process, console);
const { chromium, srv, page, TAILLES, PORT, CAPT, dit, essaie } = S;
const capture = async (pg, nom, sel) => {
  if (!CAPT) return;
  fs.mkdirSync(CAPT, { recursive: true });
  if (sel) { const el = await pg.$(sel); if (el) { await el.scrollIntoViewIfNeeded(); await pg.waitForTimeout(300); } }
  await pg.screenshot({ path: path.join(CAPT, `${nom}.png`) });
};
(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const T of TAILLES) {
      console.log(`\n══ ${T.nom} px${T.hasTouch ? ' (tactile)' : ''}`);
      await essaie('V' + T.nom, async () => {
        const { ctx, pg, errs } = await page(b, T);
        await pg.goto(`http://localhost:${PORT}/?tab=ventes`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-vn-onglet], [data-ventes-toutes], .n-segmente, [role="tablist"]', { timeout: 30000 }).catch(() => {});
        await pg.waitForTimeout(1500);
        // « Terminées » : la dernière option du segmenté de Ventes.
        const seg = pg.locator('.n-vt-segment [role="tab"], .n-vt-segment button, .n-vn-colle [role="tab"], .n-vn-colle button');
        const nSeg = await seg.count();
        if (nSeg) { const d = seg.nth(nSeg - 1); await d.scrollIntoViewIfNeeded(); if (T.hasTouch) await d.tap(); else await d.click(); }
        await pg.waitForFunction(() => { const e = document.querySelector('[data-ventes-toutes]'); return e && e.getAttribute('data-ventes-toutes') === 'lu' && e.getBoundingClientRect().height > 0; }, null, { timeout: 20000 }).catch(() => {});
        await pg.waitForTimeout(1200);
        if (T.hasTouch) {
          const r = await pg.evaluate(() => {
            const g = document.querySelector('[data-toutes-annulees]');
            const dans = g ? [...g.querySelectorAll('[data-toutes-vente]')] : [];
            const hors = [...document.querySelectorAll('[data-toutes-vente]')].filter((e) => !g || !g.contains(e));
            return { n: g && g.getAttribute('data-toutes-annulees'), ouvert: !!(g && g.open), tete: g ? g.querySelector('summary').getBoundingClientRect().height : 0,
              dans: dans.map((e) => e.getAttribute('data-toutes-vente') + ':' + e.getAttribute('data-toutes-id') + ':' + e.getAttribute('data-annul-motif')),
              horsAnnul: hors.filter((e) => e.getAttribute('data-vt-statut') === 'annulee').map((e) => e.getAttribute('data-toutes-id')), nHors: hors.length,
              deb: document.documentElement.scrollWidth - document.documentElement.clientWidth };
          });
          dit(r.n === '7' && !r.ouvert && r.tete >= 44, 'V · UN groupe replié « Annulées · 7 » (cible ≥ 44 px), fermé à l’arrivée', JSON.stringify({ n: r.n, o: r.ouvert, h: r.tete }));
          dit(r.horsAnnul.length === 0 && r.nHors >= 6, 'V · la liste d’au-dessus ne porte plus aucune vente annulée (les autres y restent)', JSON.stringify({ h: r.horsAnnul, n: r.nHors }));
          const s = pg.locator('[data-toutes-annulees] > summary').first(); await s.scrollIntoViewIfNeeded(); await s.tap(); await pg.waitForTimeout(500);
          const o = await pg.evaluate(() => { const g = document.querySelector('[data-toutes-annulees]'); const l = [...g.querySelectorAll('[data-toutes-vente]')];
            return { ids: l.map((e) => e.getAttribute('data-toutes-vente') + ':' + e.getAttribute('data-toutes-id') + ':' + e.getAttribute('data-annul-motif')).sort(), logos: l.every((e) => !!e.querySelector('[data-logo-site], .n-logo-site, [class*="logo-site"], svg, img')), h: Math.min(...l.map((e) => e.getBoundingClientRect().height)), txt: g.innerText }; });
          dit(o.ids.join() === ['ebay:E2:acheteur', 'leboncoin:L2:passu', 'vestiaire:V2:passu', 'vinted:81002:passu', 'vinted:81003:non-payee', 'vinted:81005:passu', 'vinted:82001:remboursee'].join(), 'V · ouvert : Vinted 4, Leboncoin 1 (avant cachée), eBay 1, Vestiaire 1 — par identité, chacune son motif', o.ids.join());
          dit(!o.ids.some((x) => /:L3:|:E3:|:83001:/.test(x)), 'V · l’annulée Leboncoin sans rôle lu et l’annulation eBay seulement demandée n’y sont pas', o.ids.join());
          dit(o.logos && o.h >= 44, 'V · chaque rangée porte le logo de son site, cibles ≥ 44 px', JSON.stringify({ l: o.logos, h: o.h }));
          dit(r.deb <= 1, 'V · aucun débordement horizontal', `${r.deb}px`);
          await capture(pg, `ventes-annulees-${T.nom}`, '[data-toutes-annulees]');
        } else {
          const r = await pg.evaluate(() => { const l = [...document.querySelectorAll('[data-ventes-toutes] tr, [data-ventes-toutes] [role="row"]')].map((e) => e.innerText.replace(/\s+/g, ' ')); return { lbc: l.filter((x) => /Air Max inventée 43/.test(x)), n: document.querySelector('[data-ventes-toutes]') && document.querySelector('[data-ventes-toutes]').getAttribute('data-n'), deb: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
          dit(r.lbc.length === 1 && /Annulée/.test(r.lbc[0]), 'V · tableau : la vente Leboncoin annulée est là (avant cachée), statut « Annulée »', JSON.stringify(r.lbc).slice(0, 200));
          dit(r.deb <= 1, 'V · aucun débordement horizontal', `${r.deb}px`);
          await capture(pg, `ventes-annulees-${T.nom}`);
        }
        dit(errs.length === 0, 'V · aucune erreur d’app', errs.join(' | ').slice(0, 200));
        await ctx.close();
      });
      await essaie('M' + T.nom, async () => {
        const { ctx, pg, errs } = await page(b, T);
        await pg.goto(`http://localhost:${PORT}/?tab=annonces`, { waitUntil: 'domcontentloaded' });
        await pg.waitForFunction(() => /Escarpins inventés/.test(document.body.innerText), null, { timeout: 30000 }).catch(() => {});
        await pg.waitForTimeout(1200);
        const lire = () => pg.evaluate(() => { const m = document.querySelector('.vrm-main') || document.body; const e = [...m.querySelectorAll('[data-ad-bandeau]')].filter((x) => x.getBoundingClientRect().height > 0);
          return { txt: m.innerText.replace(/\s+/g, ' '), bandeaux: e.map((x) => x.getAttribute('data-ad-bandeau')).sort(), couleurs: Object.fromEntries(e.map((x) => [x.getAttribute('data-ad-bandeau'), getComputedStyle(x).color])), textes: Object.fromEntries(e.map((x) => [x.getAttribute('data-ad-bandeau'), x.innerText.trim()])), deb: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
        let r = await lire();
        dit(/Escarpins inventés/.test(r.txt) && !/Sac inventé|Bottes inventées|Mocassins inventés/.test(r.txt), 'M · « En ligne » : seule l’annonce validée y est — en attente, à corriger, refusée n’y sont PAS (avant : 4 « en ligne »)', r.txt.slice(0, 200));
        await capture(pg, `annonces-enligne-${T.nom}`);
        // « À publier » : le deuxième segment.
        const seg = pg.locator('.n-segmente [role="tab"], .n-segmente button'); const d = seg.nth(1); await d.scrollIntoViewIfNeeded(); if (T.hasTouch) await d.tap(); else await d.click();
        await pg.waitForFunction(() => /Sac inventé/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
        await pg.waitForTimeout(800);
        r = await lire();
        dit(/Sac inventé/.test(r.txt) && /Bottes inventées/.test(r.txt) && /Mocassins inventés/.test(r.txt) && !/Escarpins inventés/.test(r.txt), 'M · « À publier » : les trois annonces que Vestiaire n’a pas mises en ligne', r.txt.slice(0, 200));
        dit(r.bandeaux.join() === 'attente,corriger,refusee', 'M · chacune porte SON état : en attente de validation · à corriger · refusée', r.bandeaux.join());
        dit(r.couleurs.corriger && r.couleurs.attente && r.couleurs.corriger !== r.couleurs.attente && r.couleurs.attente === r.couleurs.refusee, 'M · l’ambre seulement pour « à corriger » (attendre n’est pas un geste)', JSON.stringify(r.couleurs));
        dit(r.deb <= 1, 'M · aucun débordement horizontal', `${r.deb}px`);
        dit(errs.length === 0, 'M · aucune erreur d’app', errs.join(' | ').slice(0, 200));
        await capture(pg, `vestiaire-validation-${T.nom}`);
        await ctx.close();
      });
    }
  } catch (e) { dit(false, 'le banc s’exécute', String(e.message || e).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); const { ko, ok } = S.fin(); console.log(ko ? `\n❌ annulees-vc-validation : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ annulees-vc-validation : ${ok} verts, 0 rouge`); process.exit(ko ? 1 : 0); }
})();
