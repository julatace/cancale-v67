require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  RÉGRESSIONS DU 25 NOV. — six captures iPhone de Julien (version en ligne, gris moyen) : « Regarde comment tout est atroce ».
//  Récit : docs/passation/2026-11-25-regressions.md. L'app RENDUE (dist/), 390 px tactile, dsf 2, apparence par défaut,
//  base INVENTÉE (design-passe.cjs, aucune donnée réelle : le dépôt est public). Il juge des data-* et des mesures, jamais un libellé :
//    S  SQUELETTE  — Aujourd'hui avec un compte eBay dont le morceau (EspaceEbay) n'arrive JAMAIS (réseau de l'iPhone tenu) :
//                    l'écran prêt, aucune rangée grise `.vrm-skeleton` ne reste dans `.vrm-main` (sur main : trois, pour toujours).
//    E  EN-TÊTE    — Aujourd'hui défilé de 700 px, l'état « défilé » de la barre perdu (attributs retirés, comme dans la copie
//                    rouverte ou avant la relecture) : le fond de la barre reste OPAQUE (opacité 1, alpha 1) — rien ne passe dessous.
//    T  TUILES     — aucune tuile de « Dernières ventes » dont l'image est chargée mais cachée (opacité 0).
//    R  RANGÉE     — Ventes au téléphone, la feuille du morceau `ventes-lisibles` posée AVANT celle de l'app (ce que fait la copie
//                    d'un écran, et un préchargement) : la ligne prix · étiquette · logo reste une RANGÉE (flex row) et la rangée
//                    d'une vente mesure ≤ 140 px (sur main : colonne, rangées empilées).
//    P  PHRASE     — Annonces, dressing lu il y a 30 h (« à confirmer ») : l'état n'est écrit sur AUCUNE rangée d'un compte qui en
//                    compte ≥ 2 (≤ 2 rangées porteuses par compte) ; l'en-tête du compte le dit une fois (`data-ad-etat-groupe`).
//  Réglages : `BANC_DIST` (un autre build : l'AVANT), `SHOTS=<dossier>` (captures à REGARDER), `THEMES=clair,sombre`,
//  `CAS=S,E,T,R,P`. Un banc ne meurt pas, il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
process.env.BANC_DESIGN_V2 = process.env.BANC_DESIGN_V2 || 'defaut';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const SHOTS = process.env.SHOTS || '';
const CAS = String(process.env.CAS || 'S,E,T,R,P').split(',');
const THEMES = String(process.env.THEMES || 'clair,sombre').split(',').filter(Boolean);
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + JSON.stringify(d).slice(0, 500) : '')); } return c; };
const capture = async (pg, nom) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }); };
const defiler = (pg, y) => pg.evaluate((y) => { const s = document.querySelector('.n-coque-ecran') || document.scrollingElement; s.scrollTop = y; }, y);
const pret = async (pg, sel, ms = 30000) => { await pg.waitForSelector(sel, { timeout: ms }).catch(() => {}); };

function base({ ebay = false, vieux = false } = {}) {
  const b = P.base();
  if (ebay) b.rows.push({ id: 'ebay_comptes', data: { comptes: [{ principal: true, pseudo: 'boutique-ebay', ajouteLe: Date.now() - 9e8 }] } });
  if (vieux) for (const r of b.rows) if (/_(listings|enligne)$/.test(r.id) && r.data) r.data.capturedAt = new Date(Date.now() - 30 * 3600000).toISOString();
  // « Dernières ventes » en carrousel (les cartes que Julien a choisies : sans le graphique).
  b.main[0].data.vrm_aujourdhui_cartes = { ordre: ['chiffres', 'ventes'], montrees: ['chiffres', 'ventes'], at: Date.now() };
  return b;
}
async function ouvrir(nav, { b, url, sombre, tenir = null }) {
  if (tenir) {   // un morceau dont la réponse n'arrive jamais : la route est posée sur le contexte AVANT la page
    const nc = nav.newContext.bind(nav);
    nav.newContext = async (o) => { const c = await nc(o); nav.newContext = nc; await c.route(tenir, () => {}); return c; };
  }
  const o = await P.ouvrir(nav, { W: 390, b, url, sombre, dsf: 2 });
  if (tenir) await o.pg.route(tenir, () => {});
  await o.pg.evaluate(() => { try { localStorage.setItem('vrm_aujourdhui_cartes', JSON.stringify({ ordre: ['chiffres', 'ventes'], montrees: ['chiffres', 'ventes'], at: Date.now() })); } catch (_) {} });
  return o;
}

(async () => {
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try {
    for (const theme of THEMES) {
      const sombre = theme === 'sombre';
      console.log(`\n▶ ${theme}`);
      if (CAS.includes('S')) {
        const { ctx, pg, erreurs } = await ouvrir(nav, { b: base({ ebay: true }), url: '/?tab=journee', sombre, tenir: /EspaceEbay-[\w-]+\.js/ });
        await pret(pg, '[data-v2-ecran="aujourdhui"]:not([data-v2-attente])');
        await pg.waitForTimeout(9000);
        await defiler(pg, 5000); await pg.waitForTimeout(500);
        const n = await pg.evaluate(() => [...document.querySelectorAll('.vrm-main .vrm-skeleton')].filter((e) => e.getClientRects().length).length);
        const ecran = await pg.evaluate(() => !!document.querySelector('[data-v2-ecran="aujourdhui"]'));
        await capture(pg, `S-${theme}-bas`);
        dit(ecran, `S l'écran Aujourd'hui est rendu (${theme})`);
        dit(n === 0, `S aucune rangée grise qui reste (morceau eBay jamais arrivé) — ${n}`);
        dit(!erreurs.length, 'S aucune erreur JS', erreurs);
        await ctx.close();
      }
      if (CAS.includes('E') || CAS.includes('T')) {
        const { ctx, pg, erreurs } = await ouvrir(nav, { b: base(), url: '/?tab=journee', sombre });
        await pg.reload();
        await pret(pg, '[data-v2-ecran="aujourdhui"]:not([data-v2-attente])');
        await pg.waitForTimeout(6000);
        await defiler(pg, 700); await pg.waitForTimeout(600);
        await capture(pg, `E-${theme}-defile`);
        if (CAS.includes('E')) {
          const r = await pg.evaluate(async () => {
            const h = document.querySelector('header.n-barre-titre'); if (!h) return null;
            h.removeAttribute('data-n-fond'); h.removeAttribute('data-n-reduit');
            await new Promise((ok) => setTimeout(ok, 450));
            const cs = getComputedStyle(h, '::before');
            const m = /rgba?\(([^)]+)\)/.exec(cs.backgroundColor); const a = m ? (m[1].split(',')[3] == null ? 1 : Number(m[1].split(',')[3])) : 0;
            return { op: Number(cs.opacity), alpha: a, bg: cs.backgroundColor, perdu: !h.hasAttribute('data-n-fond') };
          });
          await capture(pg, `E-${theme}-etat-perdu`);
          dit(!!r, 'E la barre du haut est là');
          if (r) dit(r.op >= 0.99 && r.alpha >= 0.99, `E barre opaque même sans l'état « défilé » (opacité ${r.op}, alpha ${r.alpha})`, r);
        }
        if (CAS.includes('T')) {
          await pg.evaluate(() => { const c = document.querySelector('[data-n-jeu="ventes"]'); if (c) c.scrollLeft = 400; });
          await pg.waitForTimeout(800);
          const t = await pg.evaluate(() => [...document.querySelectorAll('[data-n-jeu="ventes"] .n-tuile-paire')].map((x) => { const i = x.querySelector('img'); return { charge: x.getAttribute('data-n-tuile-charge'), fini: !!(i && i.complete && i.naturalWidth), op: i ? Number(getComputedStyle(i).opacity) : null }; }));
          const caches = t.filter((x) => x.fini && x.op === 0);
          dit(t.length > 0, `T « Dernières ventes » a des tuiles (${t.length})`);
          dit(!caches.length, 'T aucune photo chargée mais cachée', caches);
        }
        dit(!erreurs.length, 'E aucune erreur JS', erreurs);
        await ctx.close();
      }
      if (CAS.includes('R')) {
        const { ctx, pg, erreurs } = await ouvrir(nav, { b: base(), url: '/?tab=cat_ventes', sombre });
        await pret(pg, '[data-vt-ligne], [data-vr-meta]');
        await pg.waitForTimeout(3000);
        await pg.evaluate(() => { for (const b of document.querySelectorAll('button, [role="tab"]')) if (/^En route/.test((b.textContent || '').trim())) { b.click(); break; } });
        await pg.waitForTimeout(2500);
        // La feuille du morceau AVANT celle de l'app (ordre de la copie d'un écran) : on la déplace en tête du <head>.
        const deplacee = await pg.evaluate(() => { const l = [...document.querySelectorAll('link[rel="stylesheet"]')].find((x) => /ventes-lisibles/.test(x.href)); if (!l) return false; document.head.prepend(l); return true; });
        await pg.waitForTimeout(600);
        const m = await pg.evaluate(() => [...document.querySelectorAll('[data-vt-ligne], [data-vr-meta]')].filter((e) => e.getClientRects().length).slice(0, 8).map((e) => { const r = e.closest('.n-rangee'); return { dir: getComputedStyle(e).flexDirection, disp: getComputedStyle(e).display, h: r ? Math.round(r.getBoundingClientRect().height) : 0, hl: Math.round(e.getBoundingClientRect().height) }; }));
        await defiler(pg, 200); await pg.waitForTimeout(300);
        await capture(pg, `R-${theme}-route`);
        dit(deplacee, 'R la feuille ventes-lisibles est chargée (déplacée en tête)');
        dit(m.length > 0, `R des lignes de vente sont rendues (${m.length})`);
        dit(m.every((x) => x.dir === 'row'), 'R la ligne prix · étiquette · logo est une rangée', m.map((x) => x.dir));
        dit(m.every((x) => x.h <= 140), 'R chaque rangée ≤ 140 px', m.map((x) => x.h));
        dit(!erreurs.length, 'R aucune erreur JS', erreurs);
        await ctx.close();
      }
      if (CAS.includes('P')) {
        const { ctx, pg, erreurs } = await ouvrir(nav, { b: base({ vieux: true }), url: '/?tab=cat_annonces', sombre });
        await pret(pg, '[data-ad-rangee]');
        await pg.waitForTimeout(3000);
        const g = await pg.evaluate(() => [...document.querySelectorAll('[data-eg-groupe]')].map((s) => ({ g: s.getAttribute('data-eg-groupe'),
          rangees: s.querySelectorAll('[data-ad-rangee]').length,
          phrase: [...s.querySelectorAll('[data-ad-rangee] [data-ad-bandeau="aconfirmer"]')].filter((e) => e.getClientRects().length).length,
          signe: s.querySelectorAll('[data-ad-rangee] [data-ad-signe="aconfirmer"]').length,
          tete: (s.querySelector('[data-ad-etat-groupe]') || {}).textContent || '' })));
        await capture(pg, `P-${theme}-annonces`);
        const aconf = g.filter((x) => x.phrase + x.signe >= 2 || !!x.tete);
        dit(aconf.length > 0, 'P la base sert des annonces « à confirmer » (dressing lu il y a 30 h)', g);
        dit(g.every((x) => x.phrase < 3), 'P aucune phrase d\'état répétée sur ≥ 3 rangées d\'un compte', g);
        dit(aconf.every((x) => !!x.tete), 'P l\'en-tête du compte dit l\'état une fois', aconf);
        dit(!erreurs.length, 'P aucune erreur JS', erreurs);
        await ctx.close();
      }
    }
  } finally { await nav.close(); P.srv.close(); }
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
