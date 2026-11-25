// ═════════════════════════════════════════════════════════════════════════════
//  BANC « LE ROND RETROUVER EST LIBRE » (24 nov., robot chaque-bouton, 2ᵉ passe, morceau F).
//  Au téléphone, Ventes · eBay « À traiter » (`?tab=ebay_agent` ; le grand titre est dans la coque) : la tête de la tâche ne
//  portait plus que le rond « Retrouver un colis », posé en absolu (right 16, top 8) — il tombait SUR les segments
//  « Commandes · Tableau · À traiter · Offres » : « Offres » couvrait le rond (le robot : « recouvert par Offres »), et
//  le rond cachait le mot. Règle jugée : pour chaque rond `[data-scan-retrouver-bouton]` visible, le point au centre
//  est le rond lui-même, et aucun bouton de segment / onglet ne le chevauche. Vues 390 tactile et 1512.
//  Vendeur inventé (_base-volume.cjs), écritures interceptées. BANC_DIST=<dist d'avant> pour la preuve « rouge avant ».
// ═════════════════════════════════════════════════════════════════════════════
const B = require('./_bt-commun.cjs');
const ECRANS = ['ebay_agent', 'plat_ebay', 'plat_leboncoin', 'plat_vestiaire', 'ventes', 'achats'];
(async () => {
  const J = B.journal('retrouver-libre');
  const { srv, ICI } = await B.serveur(); const nav = await B.navigateur();
  try {
    for (const vue of ['tel', 'ordi']) {
      const { pg } = await B.ouvrir(nav, vue, B.fabriquer());
      await B.demarrer(pg, ICI, 'ventes');
      let vus = 0;
      for (const e of ECRANS) {
        await B.aller(pg, e, 2500);
        // Chaque segment de l'écran : le rond doit rester libre sur chacun (« À traiter » d'eBay est celui qui l'a montré).
        const segs = await pg.evaluate(() => [...document.querySelectorAll('#vrm-contenu .vrm-seg-btn, #vrm-contenu [role="tab"]')].map((b) => (b.textContent || '').trim()).filter(Boolean).slice(0, 6));
        for (const s of [''].concat(segs)) {
          if (s) { await pg.evaluate((s) => { const b = [...document.querySelectorAll('#vrm-contenu .vrm-seg-btn, #vrm-contenu [role="tab"]')].find((x) => (x.textContent || '').trim() === s); if (b) b.click(); }, s); await pg.waitForTimeout(900); }
          const r = await pg.evaluate(() => {
            const vis = (el) => { const b = el.getBoundingClientRect(); const c = getComputedStyle(el); return b.width > 4 && b.height > 4 && c.visibility !== 'hidden' && c.display !== 'none' && !el.closest('[hidden],[inert],[aria-hidden="true"]'); };
            const out = [];
            for (const rond of document.querySelectorAll('[data-scan-retrouver-bouton]')) {
              if (!vis(rond) || rond.closest('[role="dialog"]')) continue;
              const b = rond.getBoundingClientRect(); if (b.bottom < 0 || b.top > innerHeight) continue;
              const pt = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
              const libre = !!pt && (pt === rond || rond.contains(pt));
              const chevauche = [...document.querySelectorAll('.vrm-seg-btn, [role="tab"]')].filter((x) => vis(x) && !rond.contains(x)).filter((x) => { const c = x.getBoundingClientRect(); return c.left < b.right - 1 && c.right > b.left + 1 && c.top < b.bottom - 1 && c.bottom > b.top + 1; }).map((x) => (x.textContent || '').trim());
              out.push({ libre, par: libre ? '' : (pt ? pt.tagName + '.' + String(pt.className || '').split(' ')[0] + ' «' + (pt.textContent || '').trim().slice(0, 20) + '»' : 'rien'), chevauche });
            }
            return { ecran: document.querySelector('#vrm-contenu')?.dataset.ecran || '', ronds: out };
          });
          for (const x of r.ronds) {
            vus++;
            J.dit(vue, `${e}${s ? ' › ' + s : ''} : le rond « Retrouver un colis » est libre`, x.libre && !x.chevauche.length, x.libre && !x.chevauche.length ? '' : `au centre : ${x.par || 'le rond'} ; chevauché par : ${x.chevauche.join(', ') || 'rien'}`);
          }
        }
      }
      J.dit(vue, 'au moins un rond « Retrouver un colis » mesuré', vus > 0, `${vus} mesures`);
      await pg.context().close();
    }
  } catch (err) { J.dit('—', 'le banc a tourné jusqu’au bout', false, String(err && err.stack || err).slice(0, 300)); }
  await nav.close(); srv.close();
  process.exitCode = J.fin() ? 1 : 0;
})();
