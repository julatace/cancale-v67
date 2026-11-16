// ════════════════════════════════════════════════════════════════════════════
//  BANC « ACCESSIBILITÉ DES FEUILLES ET DES SOUS-ÉCRANS » (16 nov., lot bancs-rouges-b, mission 55)
//  Suite d'`accessibilite.cjs` (2026-11-11-accessibilite.md) et du reste dit par
//  2026-11-14-ergonomie-gestes.md (« Focus et retour au même défilement après une feuille : pas mesurés »).
//  Socle `_a11y.cjs` : données INVENTÉES (un compte Vinted, quatre annonces, ventes, une annonce
//  Leboncoin / eBay / Vestiaire), aucune fx/, aucune écriture réelle. 390 px tactile et 1512 px, clair ET sombre.
//
//  A. axe-core (WCAG 2.0/2.1 A et AA + aria-allowed-role, aria-dialog-name ; « serious »/« critical » ROUGES)
//     DANS : l'atelier Republier (Annonces → Republier), « Publier ailleurs » (Leboncoin), une catégorie de
//     Paramètres (« Ventes et colis ») et la feuille d'un de ses réglages, le centre d'aide (`vrm:aide`).
//  F. Fermer rend la main là où elle était : la fiche d'une annonce ouverte depuis la liste défilée, puis fermée
//     (croix au doigt, Échap au clavier) ⇒ le défilement est le même (± 4 px) et le focus revient sur la
//     rangée touchée ; même chose pour une catégorie de Paramètres et son « ‹ Paramètres ».
//  BANC_PORT, BANC_DIST, BANC_CAPTURES, BANC_LARGEUR=390|1512, BANC_SEUL=A|F, BANC_DUMP=1.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const A = require('./_a11y.cjs');
const { dit, essaie } = A;
const SEUL = process.env.BANC_SEUL || '';
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const dialogues = (pg) => pg.evaluate(() => [...document.querySelectorAll('[role="dialog"],[role="alertdialog"]')].filter((e) => e.getClientRects().length).length);
const toucher = async (pg, sel, tel) => { const l = pg.locator(sel).filter({ visible: true }).first(); await l.scrollIntoViewIfNeeded({ timeout: 8000 }).catch(() => {}); if (tel) await l.tap({ timeout: 10000 }); else await l.click({ timeout: 10000 }); };

// A — les feuilles et vues à passer à axe.
const CIBLES = [
  { id: 'republier', nom: 'atelier Republier', tab: 'annonces', ctx: '.vrm-main',
    ouvrir: async (pg, tel) => { await toucher(pg, '[data-vue-republier]', tel); await pg.waitForSelector('[data-selection-vue="republier"], [data-republier-etape], [data-republier-vide], [data-republier-rien]', { timeout: 15000 }); },
    pret: (pg) => pg.evaluate(() => !!document.querySelector('[data-selection-vue="republier"], [data-republier-etape], [data-republier-vide], [data-republier-rien]')) },
  { id: 'publier-ailleurs', nom: '« Publier ailleurs » (Leboncoin)', tab: 'annonces', ctx: '[role="dialog"]',
    ouvrir: (pg) => pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:publier-ailleurs', { detail: { site: 'leboncoin' } }))) },
  { id: 'parametres-categorie', nom: 'Paramètres · catégorie « Ventes et colis »', tab: 'settings', ctx: '.vrm-main', seulTel: true,
    ouvrir: async (pg, tel) => { await toucher(pg, '[data-categorie-ouvrir="ventes"]', tel); await pg.waitForSelector('[data-categorie-ouverte]', { timeout: 10000 }); },
    pret: (pg) => pg.evaluate(() => !!document.querySelector('[data-categorie-ouverte]')) },
  { id: 'parametres-feuille', nom: 'Paramètres · feuille d’un réglage (« Ventes et colis »)', tab: 'settings', ctx: '[role="dialog"]',
    ouvrir: async (pg, tel) => {
      if (tel) { await toucher(pg, '[data-categorie-ouvrir="ventes"]', tel); await pg.waitForSelector('[data-categorie-ouverte]', { timeout: 10000 }); }
      const zone = tel ? '[data-categorie-ouverte]' : '[data-categorie-ecran="ventes"], [data-categorie-valeur], .vrm-main';
      const b = pg.locator(`${zone} [aria-haspopup="dialog"]`).filter({ visible: true }).first();
      if (await b.count()) { await b.scrollIntoViewIfNeeded().catch(() => {}); if (tel) await b.tap(); else await b.click(); }
    } },
  { id: 'centre-aide', nom: 'centre d’aide', tab: 'journee', ctx: '[role="dialog"]',
    ouvrir: (pg) => pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:aide', { detail: {} }))) },
];

async function main() {
  A.srv.listen(A.PORT);
  const b = await A.lancerNavigateur();
  const largeurs = [390, 1512].filter((l) => !process.env.BANC_LARGEUR || String(l) === process.env.BANC_LARGEUR);
  try {
    for (const largeur of largeurs) for (const sombre of [false, true]) {
      const tel = largeur < 700;
      const T = `${tel ? '📱' : '🖥️'}${sombre ? '🌙' : '☀️'}`;
      if (!SEUL || SEUL === 'A') for (const C of CIBLES) {
        if (C.seulTel && !tel) continue;
        await essaie(`${T} ${C.nom}`, async () => {
          const { pg, ctx, errs } = await A.ouvrir(b, { largeur, sombre, tab: C.tab, attente: 6000 });
          try {
            const avant = await dialogues(pg);
            await C.ouvrir(pg, tel);
            await dormir(1500);
            const ouverte = C.pret ? await C.pret(pg) : (await dialogues(pg)) > avant;
            dit(ouverte, `${T} A ${C.nom} s’ouvre`);
            await A.capture(pg, `feuilles-${C.id}-${largeur}-${sombre ? 'sombre' : 'clair'}`);
            if (ouverte) A.juger(T, C.nom, await A.axe(pg, C.ctx));
            if (ouverte && tel && !sombre) { const p = await A.petitesCibles(pg); dit(p.length === 0, `${T} ${C.nom} · chaque bouton offre 44 × 44 px au doigt`, `${p.length} : ` + p.slice(0, 5).join(' ║ ')); }
            dit(errs.length === 0, `${T} ${C.nom} · aucune erreur de page`, errs.slice(0, 2).join(' | '));
          } finally { await ctx.close(); }
        });
      }
      if (sombre || (SEUL && SEUL !== 'F')) continue;
      // F1 — la fiche d'une annonce, ouverte depuis la liste DÉFILÉE, puis fermée.
      await essaie(`${T} F1 fiche d’une annonce`, async () => {
        const { pg, ctx, errs } = await A.ouvrir(b, { largeur, sombre, tab: 'annonces', attente: 6000 });
        try {
          const rangee = '[data-fiche-ligne][data-fl-site="vinted"]';
          await pg.waitForSelector(rangee, { timeout: 20000 });
          // La DERNIÈRE rangée, amenée au milieu : la page est défilée (une liste courte : on fait de la place en bas).
          const avant = await pg.evaluate((q) => { const l = [...document.querySelectorAll(q)].filter((e) => e.getClientRects().length); const e = l[l.length - 1];
            const pied = document.createElement('div'); pied.style.height = '1600px'; pied.setAttribute('data-banc-pied', ''); (document.querySelector('.vrm-main') || document.body).appendChild(pied);
            e.setAttribute('data-banc-rangee', ''); e.scrollIntoView({ block: 'center' }); return { y: Math.round(scrollY), y2: Math.round((document.scrollingElement || document.documentElement).scrollTop), mainY: Math.round(((document.querySelector('.vrm-main') || {}).scrollTop) || 0) }; }, rangee);
          await dormir(400);
          const pos0 = await pg.evaluate(() => ({ y: Math.round(scrollY), top: Math.round(document.querySelector('[data-banc-rangee]').getBoundingClientRect().top) }));
          const d0 = await dialogues(pg);
          if (tel) await pg.locator('[data-banc-rangee]').tap({ position: { x: 150, y: 20 } }); else { await pg.locator('[data-banc-rangee]').focus().catch(() => {}); await pg.keyboard.press('Enter'); }
          let ouverte = await pg.waitForFunction((n) => [...document.querySelectorAll('[role="dialog"]')].filter((e) => e.getClientRects().length).length > n, d0, { timeout: 8000 }).then(() => true).catch(() => false);
          if (!ouverte && !tel) { await pg.locator('[data-banc-rangee]').click({ position: { x: 150, y: 20 } }); ouverte = await pg.waitForFunction((n) => [...document.querySelectorAll('[role="dialog"]')].filter((e) => e.getClientRects().length).length > n, d0, { timeout: 8000 }).then(() => true).catch(() => false); }
          dit(ouverte, `${T} F1 toucher la rangée ouvre la fiche`, JSON.stringify(avant));
          if (!ouverte) return;
          await dormir(600);
          if (tel) await toucher(pg, '[role="dialog"] [data-feuille-croix]', true); else await pg.keyboard.press('Escape');
          await pg.waitForFunction((n) => [...document.querySelectorAll('[role="dialog"]')].filter((e) => e.getClientRects().length).length <= n, d0, { timeout: 8000 }).catch(() => {});
          await dormir(700);
          const apres = await pg.evaluate(() => { const r = document.querySelector('[data-banc-rangee]'); const a = document.activeElement;
            return { y: Math.round(scrollY), top: r ? Math.round(r.getBoundingClientRect().top) : null, focus: !!(r && a && (a === r || r.contains(a))), actif: a ? (a.outerHTML || '').replace(/\s+/g, ' ').slice(0, 90) : '' }; });
          dit(Math.abs(apres.top - pos0.top) <= 4, `${T} F1 fermée, la liste est au MÊME défilement (± 4 px)`, JSON.stringify({ avant: pos0, apres: { y: apres.y, top: apres.top } }));
          dit(apres.focus, `${T} F1 fermée, le focus revient sur la rangée touchée`, apres.actif);
          await A.capture(pg, `feuilles-F1-${largeur}`);
          dit(errs.length === 0, `${T} F1 aucune erreur de page`, errs.slice(0, 2).join(' | '));
        } finally { await ctx.close(); }
      });
      // F2 — une catégorie de Paramètres (téléphone : un sous-écran), puis « ‹ Paramètres ».
      if (tel) await essaie(`${T} F2 catégorie de Paramètres`, async () => {
        const { pg, ctx, errs } = await A.ouvrir(b, { largeur, sombre, tab: 'settings', attente: 6000 });
        try {
          const cat = '[data-categorie-ouvrir="donnees"], [data-categorie-ouvrir]';
          await pg.waitForSelector('[data-categorie-ouvrir]', { timeout: 15000 });
          const pos0 = await pg.evaluate(() => { const l = [...document.querySelectorAll('[data-categorie-ouvrir]')].filter((e) => e.getClientRects().length); const e = l[l.length - 1]; e.setAttribute('data-banc-cat', ''); e.scrollIntoView({ block: 'center' }); return null; });
          void pos0; void cat;
          await dormir(400);
          const p0 = await pg.evaluate(() => ({ y: Math.round(scrollY), top: Math.round(document.querySelector('[data-banc-cat]').getBoundingClientRect().top), cle: document.querySelector('[data-banc-cat]').getAttribute('data-categorie-ouvrir') }));
          await pg.locator('[data-banc-cat]').tap();
          await pg.waitForSelector('[data-categorie-ouverte]', { timeout: 10000 });
          await dormir(500);
          await toucher(pg, '[data-categorie-retour]', true);
          await pg.waitForFunction(() => !document.querySelector('[data-categorie-ouverte]'), null, { timeout: 8000 }).catch(() => {});
          await dormir(700);
          const ap = await pg.evaluate((cle) => { const r = document.querySelector(`[data-categorie-ouvrir="${cle}"]`); const a = document.activeElement;
            return { y: Math.round(scrollY), top: r ? Math.round(r.getBoundingClientRect().top) : null, focus: !!(r && a && (a === r || r.contains(a))), actif: a ? (a.outerHTML || '').replace(/\s+/g, ' ').slice(0, 90) : '' }; }, p0.cle);
          dit(ap.top != null && Math.abs(ap.top - p0.top) <= 4, `${T} F2 « ‹ Paramètres » revient au MÊME défilement (la catégorie « ${p0.cle} » au même endroit, ± 4 px)`, JSON.stringify({ avant: p0, apres: { y: ap.y, top: ap.top } }));
          dit(ap.focus, `${T} F2 et le focus revient sur la catégorie ouverte`, ap.actif);
          await A.capture(pg, `feuilles-F2-${largeur}`);
          dit(errs.length === 0, `${T} F2 aucune erreur de page`, errs.slice(0, 2).join(' | '));
        } finally { await ctx.close(); }
      });
    }
  } finally { await b.close(); A.srv.close(); }
  const { ok, ko } = A.compte();
  console.log(`\n${ok} ✅ · ${ko} ❌ — captures : ${A.CAPTURES}`);
  process.exit(ko ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
