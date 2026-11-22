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
const code = socle.slice(i0, i1).replace('|| 4531', '|| 4797') + `
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
        await pg.goto(`http://localhost:${PORT}/?tab=plat_vestiaire`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-vc-annonces="lu"]', { timeout: 30000 }).catch(() => {});
        await pg.waitForTimeout(1200);
        const r = await pg.evaluate(() => {
          const L = Object.fromEntries([...document.querySelectorAll('[data-vc-annonce]')].map((e) => { const m = e.querySelector('[data-vc-moderation]'); const cs = m ? getComputedStyle(m) : null;
            return [e.getAttribute('data-vc-annonce'), { etat: e.getAttribute('data-vc-annonce-etat'), mod: m ? m.getAttribute('data-vc-moderation') : '', geste: m ? m.getAttribute('data-vc-moderation-geste') || '' : '', couleur: cs ? cs.color : '', txt: e.innerText.replace(/\s+/g, ' ').slice(0, 160), corriger: !!e.querySelector('[data-vc-corriger]') }]; }));
          const c = document.querySelector('[data-vc-compteurs-compte]');
          const neutre = getComputedStyle(document.querySelector('.vrm-pf-sous-texte') || document.body).color;
          return { L, cpt: c ? { a: c.getAttribute('data-attente'), p: c.getAttribute('data-photos'), r: c.getAttribute('data-refusees'), inc: c.getAttribute('data-inconnues'), h: c.getBoundingClientRect().height, laquelle: !!c.querySelector('[data-vc-cpt-laquelle]') } : null, neutre, deb: document.documentElement.scrollWidth - document.documentElement.clientWidth };
        });
        const a = r.L['72000002'] || {}, c = r.L['72000003'] || {}, x = r.L['72000004'] || {}, e = r.L['72000001'] || {};
        dit(a.etat === 'attente' && a.mod === 'attente' && a.geste === '' && !a.corriger, 'M · « en attente de validation » sur la rangée : pas un geste (ni ambre ni bouton)', JSON.stringify(a));
        dit(c.etat === 'corriger' && c.geste === '1' && c.corriger && c.couleur !== a.couleur, 'M · « à corriger » : ambre (une autre couleur que « en attente ») et le geste « Corriger sur Vestiaire »', JSON.stringify({ c, ca: a.couleur }));
        dit(x.etat === 'refusee' && x.mod === 'refusee' && x.geste === '', 'M · « refusée par Vestiaire » : dite, présente (pas « retirée »)', JSON.stringify(x));
        dit(e.etat === 'en-ligne' && e.mod === '', 'M · l’annonce validée est « en ligne » (plus de modération)', JSON.stringify(e));
        dit(r.cpt && r.cpt.a === '2' && r.cpt.p === '1' && r.cpt.r === '1' && r.cpt.inc === '1' && r.cpt.laquelle && r.cpt.h >= 44, 'M · les compteurs de Vestiaire : 2 en attente, 1 photos, 1 refusée ; « laquelle : pas su » dit pour celle qui n’est pas lue', JSON.stringify(r.cpt));
        dit(r.deb <= 1, 'M · aucun débordement horizontal', `${r.deb}px`);
        dit(errs.length === 0, 'M · aucune erreur d’app', errs.join(' | ').slice(0, 200));
        await capture(pg, `vestiaire-validation-${T.nom}`, '[data-vc-compteurs]');
        await ctx.close();
      });
    }
  } catch (e) { dit(false, 'le banc s’exécute', String(e.message || e).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); const { ko, ok } = S.fin(); console.log(ko ? `\n❌ annulees-vc-validation : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ annulees-vc-validation : ${ok} verts, 0 rouge`); process.exit(ko ? 1 : 0); }
})();
