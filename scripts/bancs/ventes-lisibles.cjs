require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  VENTES LISIBLES (21 nov. 2026) — l'écran Ventes RENDU, base INVENTÉE (design-passe : 3 comptes, colis à envoyer, achats).
//  Julien, sur ses captures iPhone : vignettes trop petites, nom de la paire coupé, sans la taille ; prix d'achat et « Relier »
//  derrière « ⋯ » ; squelette entre la liste et « Imprimer » ; pilule « Où est cet article dans le stock » posée sur la liste ;
//  « 56 bordereaux déjà traités » bord à bord ; un groupe « EBAY » au milieu ; « Imprimer · Coche un colis » sans sélection ;
//  « À régler », « Retours et litiges », « Retours à imprimer » empilés. Et « Lier à un achat » façon Bleam.
//  Récit : docs/passation/2026-11-21-ventes-lisibles.md. Code : src/natif/ecrans/Ventes.jsx, celluleAchat.jsx, LierAchatGrille.jsx.
//
//  390 × 844 tactile et 1512 × 950 ; mesures data-* et boîtes RENDUES (jamais un libellé seul) :
//    V  vignette ≥ 52 px au téléphone (23 nov., Julien : « moins zoomé », rangées de 64–72 px), ≥ 56 px dans le tableau de l'ordinateur ;
//    T  le titre de chaque vente est ENTIER (rien de rogné) et la taille est écrite sur la rangée ;
//    G  « Relier » et le champ « Prix d'achat » sont SUR chaque rangée Vinted sans achat (aucun menu « ⋯ » à ouvrir) ;
//    O  aucune pilule « stock », aucune rangée « bordereaux déjà traités », aucun groupe « eBay » posés sur la liste ;
//    R  pas de titres de groupe « À régler » / « Retours et litiges » / « Retours à imprimer » empilés au téléphone ;
//    I  rien de coché ⇒ AUCUN bouton « Imprimer » visible ;
//    S  la liste lue : aucun squelette visible dans l'écran ;
//    L  « Relier » ouvre la grille : des photos carrées (≥ 96 px), seulement les achats ARRIVÉS, du plus récent ; SON toucher
//       sur une case ⇒ « Relier à cet achat ? Non · Oui » ; « Oui » relie (la cellule dit « Acheté … ») et le geste s'annule ;
//    P  taper « 24,50 » dans « Prix d'achat » ⇒ la rangée dit « Acheté 24,50 € », le champ disparaît (jamais réécrit).
//  `BANC_DIST=…` juge un autre build (le code d'avant : rouge attendu). `SHOTS=dossier` garde les captures.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const P = require('./design-passe.cjs');
const { ouvrir, base, srv, PORT, chromium } = P;
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-ventes-lisibles');
fs.mkdirSync(SHOTS, { recursive: true });
const DSF = process.env.SHOTS ? 2 : 1;
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARG = liste('VUES', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 600) : '')); } return c; };
const attendre = async (pg, f, ms = 30000, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await pg.evaluate(f, arg).catch(() => false)) return true; await pg.waitForTimeout(300); } return false; };
const sansToasts = async (pg) => { await pg.evaluate(() => { for (const e of document.querySelectorAll('body *')) { if (getComputedStyle(e).position !== 'fixed' || !/paires? numérotées?/.test(e.textContent || '') || e.closest('.n-onglets, .vrm-tabbar')) continue;
  const f = [...e.querySelectorAll('button')].find((b) => /fermer|close|×/i.test((b.getAttribute('aria-label') || '') + b.textContent)); if (f) { f.click(); break; } } }).catch(() => {}); await pg.waitForTimeout(400); };

// Les achats inventés reçoivent une photo inventée (data:) : la grille a des images. Les arrivés = « Commande finalisée ».
const ARRIVE = /finalis/i;
function baseLisible() {
  const b = base();
  const arrives = new Set(), tous = new Map();
  for (const r of b.rows) if (/_orders_purchased$/.test(r.id)) for (const a of ((r.data && r.data.payload && r.data.payload.my_orders) || [])) {
    const teinte = (Number(a.transaction_id) * 37) % 360;
    a.photo = { url: 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="hsl(${teinte},40%,80%)"/></svg>`) };
    tous.set(String(a.transaction_id), a.status); if (ARRIVE.test(a.status || '')) arrives.add(String(a.transaction_id));
  }
  return { b, arrives, tous };
}

function mesure() {
  const vis = (e) => { if (!e || !e.getClientRects().length) return false; const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false; if (e.closest('[hidden], [aria-hidden="true"], .n-lu-seul, .v2-cache, .n-tt-sr, .vrm-sr-seul')) return false; const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
  const R = (e) => e.getBoundingClientRect();
  const ecran = document.querySelector('[data-vn="ventes"]');
  const horsFeuille = (e) => !e.closest('[role="dialog"], .n-feuille, [data-n-feuille]');
  const rogne = (t) => !!t && (t.scrollHeight > t.clientHeight + 1 || t.scrollWidth > t.clientWidth + 1);
  const tel = [...document.querySelectorAll('[data-vn-liste] [data-vn-rang], [data-vn-liste] [data-vn-route]')].filter(vis).map((r) => {
    const v = r.querySelector('.n-vignette'), t = r.querySelector('.n-rangee-titre');
    return { cle: r.getAttribute('data-vn-rang') || r.getAttribute('data-vn-route'), vig: v ? Math.round(R(v).width) : 0, titreRogne: rogne(t), titre: t ? t.textContent.trim() : '',
      taille: /\b(taille|T)\s?\d{2}/.test(r.textContent), relier: !!r.querySelector('[data-vt-relier]') && vis(r.querySelector('[data-vt-relier]')),
      achat: r.getAttribute('data-vr-achat') || (r.querySelector('[data-vt-achat]') || { getAttribute: () => '' }).getAttribute('data-vt-achat'),
      balayage: [...r.querySelectorAll('.n-rangee-action')].map((b) => b.textContent.trim()), champ: (!!r.querySelector('[data-vt-prix-champ]') && vis(r.querySelector('[data-vt-prix-champ]'))) || (!!r.querySelector('[data-vt-plus-prix]') && vis(r.querySelector('[data-vt-plus-prix]'))),
      haut: Math.round(R(r).height) };
  });
  const tab = [...document.querySelectorAll('[data-vn="ventes"] [data-tt-ligne], [data-ventes-tableau] [data-tt-ligne]')].filter(vis).map((l) => {
    const v = l.querySelector('.n-vignette'), t = l.querySelector('.n-tt-article-titre');
    return { cle: l.getAttribute('data-tt-ligne'), vig: v ? Math.round(R(v).width) : 0, titreRogne: rogne(t), titre: t ? t.textContent.trim() : '', taille: /\b(taille|T)\s?\d{2}/.test(l.textContent),
      relier: !!l.querySelector('[data-vt-relier]'), champ: !!l.querySelector('[data-vt-prix-champ], [data-vt-plus-prix]'), droite: Math.round(R(l).right), scroll: (() => { const s = l.closest('.n-tt-defile, [data-tt-defile]') || l.parentElement; return s ? s.scrollWidth - s.clientWidth : 0; })() };
  });
  const surListe = (sel) => [...document.querySelectorAll(sel)].filter(vis).filter(horsFeuille).length;
  const tetes = [...document.querySelectorAll('.n-groupe-tete, .n-groupe-titre, h2, h3')].filter(vis).filter(horsFeuille).map((e) => e.textContent.replace(/\s+/g, ' ').trim()).filter((x) => /à régler|retours et litiges|retours à imprimer/i.test(x));
  const imprimer = [...document.querySelectorAll('[data-vn-plein], [data-colis-barre-btn="imprimer"]')].filter(vis).filter(horsFeuille).map((e) => e.textContent.trim());
  const squelettes = [...document.querySelectorAll('[data-v2v-corps="lecture"], .n-attente, [data-n-attente], .vrm-squelette')].filter(vis).filter(horsFeuille).filter((e) => !e.closest('.n-la')).length;
  return { tel, tab, stock: surListe('[data-colis-stock]'), bords: surListe('[data-bords-faits], [data-bords-faits-voir]'), ebay: surListe('[data-tache-sections]'), tetes, imprimer, squelettes,
    deb: document.documentElement.scrollWidth - innerWidth, ecran: !!ecran };
}

async function ouvrirVentes(nav, { W, sombre, b }) {
  const { ctx, pg, erreurs } = await ouvrir(nav, { W: W < 600 ? 390 : 1512, sombre, b, url: '/?tab=ventes', dsf: DSF });
  await pg.waitForSelector('.vrm-main', { timeout: 30000 }).catch(() => {});
  await attendre(pg, () => !!document.querySelector('[data-vn="ventes"]') && !!document.querySelector('[data-vn="ventes"] [data-tt-ligne], [data-vn-liste] [data-vn-rang]'), 40000);
  await pg.waitForTimeout(2000); await sansToasts(pg);
  return { ctx, pg, erreurs };
}

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] }).catch(() => chromium.launch({ args: ['--no-sandbox'] }));
  const { b, arrives, tous } = baseLisible();
  try {
    for (const W of LARG) for (const th of THEMES) {
      const tel = W < 600;
      console.log(`\n── Ventes lisibles · ${W} · ${th}`);
      const { ctx, pg, erreurs } = await ouvrirVentes(nav, { W, sombre: th === 'sombre', b });
      // Les rangées à partir de la 20ᵉ portent `content-visibility: auto` (natif.css) : hors de la fenêtre, leur contenu n'est pas
      // mis en page (vignette 0 px, hauteur de réserve 64). Pour juger CHAQUE rangée (vignette, hauteur), on les fait toutes mettre
      // en page le temps de la mesure — la règle mesurée (taille de la vignette, hauteur de la rangée) est la même.
      await pg.addStyleTag({ content: '.n-rangee { content-visibility: visible !important; }' });
      await pg.waitForTimeout(150);
      const m = await pg.evaluate(mesure);
      await pg.screenshot({ path: path.join(SHOTS, `lisibles-${W}-${th}.png`) });
      const rangs = tel ? m.tel : m.tab;
      dit(rangs.length > 5, `les ventes sont rendues (${rangs.length})`);
      const vMin = tel ? 52 : 56;
      dit(rangs.length && rangs.every((x) => x.vig >= vMin), `V vignette ≥ ${vMin} px sur chaque vente (mini ${Math.min(...rangs.map((x) => x.vig))})`, rangs.filter((x) => x.vig < vMin).slice(0, 3));
      // H (23 nov., Julien : « moins zoomé ») au téléphone, une rangée de vente tient en 64–80 px (pied « Relier · + prix » compris).
      // (25 nov., ventes-rangee) 60–104 px : le titre ENTIER sur deux lignes, le prix à droite, une ligne d'état qui peut passer à la ligne
      // (« sans bordereau · à vérifier ») ; plus de pied « Relier · + prix » (scripts/bancs/ventes-rangee.cjs juge le reste).
      if (tel) { const hs = await pg.evaluate(() => [...document.querySelectorAll('[data-vn-rang]')].filter((e) => e.getClientRects().length).map((e) => Math.round(e.getBoundingClientRect().height)));
        dit(hs.length > 3 && hs.every((h) => h >= 60 && h <= 104), `H chaque rangée de vente de 60 à 104 px au téléphone (${hs.length} : ${[...new Set(hs)].join(', ')})`, hs.filter((h) => h < 60 || h > 104).slice(0, 8)); }
      dit(rangs.length && rangs.every((x) => !x.titreRogne), 'T le titre de chaque vente est entier (rien de rogné)', rangs.filter((x) => x.titreRogne).map((x) => x.titre).slice(0, 4));
      dit(rangs.length && rangs.every((x) => x.taille), 'T la taille est écrite sur chaque rangée', rangs.filter((x) => !x.taille).map((x) => x.titre).slice(0, 4));
      const sansAchat = rangs.filter((x) => tel ? x.achat === 'libre' : x.champ);
      // (25 nov., ventes-rangee — Julien : « c'est atroce ») Au téléphone, « Relier » et « Prix d'achat » ne sont plus posés en gros sur
      // chaque rangée : ils sont au BALAYAGE de la rangée d'une vente sans achat (et seulement d'elle), toujours sans « ⋯ ».
      if (tel) dit(sansAchat.length > 3 && sansAchat.every((x) => !x.relier && !x.champ && x.balayage.some((a) => /relier/i.test(a)) && x.balayage.some((a) => /prix d/i.test(a))),
        `G « Relier » et « Prix d'achat » au balayage de chaque vente sans achat, rien de posé sur la rangée (${sansAchat.length} rangées)`, sansAchat.slice(0, 2));
      else dit(sansAchat.length > 3 && sansAchat.every((x) => x.relier && x.champ), `G « Relier » et « Prix d'achat » (le champ, ou « + prix » qui l'ouvre) sur la rangée, sans « ⋯ » (${sansAchat.length} rangées)`, rangs.slice(0, 3));
      dit(m.stock === 0, `O aucune pilule « stock » posée sur la liste (${m.stock})`);
      dit(m.bords === 0, `O aucune rangée « bordereaux déjà traités » sur la liste (${m.bords})`);
      dit(m.ebay === 0, `O aucun groupe « eBay » au milieu de Ventes (${m.ebay})`);
      if (tel) dit(m.tetes.length === 0, `R aucun titre « À régler / Retours … » empilé (${m.tetes.join(' | ')})`);
      dit(m.squelettes === 0, `S la liste lue : aucun squelette visible (${m.squelettes})`);
      dit(m.deb <= 1, `rien ne déborde (${m.deb})`);
      if (!tel) dit(m.tab.every((x) => x.scroll <= 1), `le tableau tient sans défilement de côté (${Math.max(0, ...m.tab.map((x) => x.scroll))})`);
      if (tel) { const h = Math.max(...m.tel.map((x) => x.haut)); dit(h <= 180, `rangées denses (la plus haute : ${h} px ≤ 180 : titre sur 2 lignes + « sans bordereau » + le pied de 44)`); }

      // I — tout décocher : aucun « Imprimer » ne reste.
      if (tel) { for (let k = 0; k < 40; k++) { const n = await pg.evaluate(() => { const c = [...document.querySelectorAll('[data-vn-coche] input, input[data-vn-coche]')].find((x) => x.checked); if (!c) return 0; c.click(); return 1; }); if (!n) break; await pg.waitForTimeout(120); } }
      else { await pg.evaluate(() => { for (const c of document.querySelectorAll('[data-vn="ventes"] [data-tt-ligne] input[type="checkbox"]')) if (c.checked) c.click(); }); }
      await pg.waitForTimeout(800);
      const mi = await pg.evaluate(mesure);
      await pg.screenshot({ path: path.join(SHOTS, `lisibles-${W}-${th}-sans-coche.png`) });
      dit(mi.imprimer.length === 0, `I rien de coché ⇒ aucun « Imprimer » (${mi.imprimer.join(' | ')})`);

      // P — saisir un prix d'achat sur une rangée sans achat.
      // (23 nov., style-clarte-5) Dans le tableau, le champ s'ouvre au toucher de « + prix » (la même saisie ensuite).
      if (tel) await pg.evaluate(() => { const r = [...document.querySelectorAll('[data-vn-rang][data-vr-achat="libre"]')][1]; const b = r && [...r.querySelectorAll('.n-rangee-action')].find((x) => /prix d/i.test(x.textContent)); if (b) b.click(); });
      else await pg.evaluate(() => { const b = [...document.querySelectorAll('[data-vt-plus-prix]')].filter((e) => e.getClientRects().length)[1]; if (b) b.click(); });
      await pg.waitForTimeout(300);
      const cibleP = await pg.evaluate((tel) => { const vus = [...document.querySelectorAll('[data-vt-prix-champ]')].filter((e) => e.getClientRects().length); const r = tel ? vus[0] : vus.length > 1 ? vus[1] : vus[0]; if (!r) return ''; const l = r.closest('[data-vn-rang], [data-tt-ligne]'); return l ? (l.getAttribute('data-vn-rang') || l.getAttribute('data-tt-ligne')) : ''; }, tel);
      if (cibleP) {
        const sel = tel ? `[data-vn-rang="${cibleP}"]` : `[data-tt-ligne="${cibleP}"]`;
        await pg.locator(`${sel} [data-vt-prix-champ]`).first().fill('24,50');
        await pg.locator(`${sel} [data-vt-prix-champ]`).first().press('Enter');
        await pg.waitForTimeout(1200);
        const p = await pg.evaluate((s) => { const l = document.querySelector(s); if (!l) return null; const a = l.querySelector('[data-vt-achat]'); return { etat: a ? a.getAttribute('data-vt-achat') : '', texte: a ? a.textContent.trim() : '', champ: !!l.querySelector('[data-vt-prix-champ]'), vr: l.getAttribute('data-vr-achat') }; }, sel);
        // (25 nov., ventes-rangee) Au téléphone, le prix posé fait de la vente une vente « au prix connu » (`data-vr-achat="connu"`) : le
        // champ se referme et « Relier » / « Prix d'achat » quittent son balayage ; « Acheté 24,50 € » se lit dans sa fiche.
        if (tel) dit(!!p && p.vr === 'connu' && !p.champ, `P « 24,50 » tapé ⇒ la vente a son prix d'achat (${p && p.vr}), le champ disparaît`, p);
        else dit(!!p && p.etat === 'prix' && /24,50/.test(p.texte) && !p.champ, `P « 24,50 » tapé ⇒ « ${p && p.texte} », le champ disparaît`, p);
      } else dit(false, 'P une rangée avec le champ « Prix d’achat »');

      // L — « Relier » ouvre la grille façon Bleam.
      const cibleL = tel ? await pg.evaluate(() => { const r = [...document.querySelectorAll('[data-vn-rang][data-vr-achat="libre"]')][0]; return r ? r.getAttribute('data-vn-rang') : ''; })
        : await pg.evaluate(() => { const r = [...document.querySelectorAll('[data-vt-relier="libre"]')].find((e) => e.getClientRects().length); if (!r) return ''; const l = r.closest('[data-vn-rang], [data-tt-ligne]'); return l ? (l.getAttribute('data-vn-rang') || l.getAttribute('data-tt-ligne')) : ''; });
      const selL = tel ? `[data-vn-rang="${cibleL}"]` : `[data-tt-ligne="${cibleL}"]`;
      if (tel) await pg.evaluate((s) => { const r = document.querySelector(s); const b = r && [...r.querySelectorAll('.n-rangee-action')].find((x) => /relier/i.test(x.textContent)); if (b) b.click(); }, selL);
      else await pg.locator(`${selL} [data-vt-relier="libre"]`).first().click({ timeout: 8000 }).catch(() => {});
      const vu = await attendre(pg, () => !!document.querySelector('[data-la-grille] [data-la-achat]'), 15000);
      await pg.waitForTimeout(600);
      await pg.screenshot({ path: path.join(SHOTS, `lier-${W}-${th}.png`) });
      const g = await pg.evaluate(() => { const c = [...document.querySelectorAll('[data-la-achat]')]; const ph = c[0] && c[0].querySelector('.n-la-photo'); const r = ph ? ph.getBoundingClientRect() : null;
        return { n: c.length, tx: c.map((x) => x.getAttribute('data-la-achat')), t: c.map((x) => Number(x.getAttribute('data-la-t') || 0)), carre: r ? { w: Math.round(r.width), h: Math.round(r.height) } : null,
          vente: !!document.querySelector('[data-relier-cible]'), recherche: !!document.querySelector('[data-la-recherche]'), filtres: [...document.querySelectorAll('[data-la-filtre]')].map((x) => x.getAttribute('data-la-filtre')) }; });
      dit(vu && g.n > 0, `L « Relier » ⇒ la grille des achats (${g.n} cases)`, g);
      dit(g.vente && g.recherche && g.filtres.includes('prix') && g.filtres.includes('marque'), `L la vente en haut, une recherche, les filtres Marque et Prix (${g.filtres.join(', ')})`);
      dit(!!g.carre && g.carre.w >= 96 && Math.abs(g.carre.w - g.carre.h) <= 1, `L photos carrées ≥ 96 px (${g.carre && g.carre.w + '×' + g.carre.h})`);
      dit(g.tx.length && g.tx.every((x) => arrives.has(x)), `L seulement les achats ARRIVÉS (${g.tx.filter((x) => !arrives.has(x)).length} pas arrivés montrés)`, g.tx.filter((x) => !arrives.has(x)).slice(0, 3).map((x) => tous.get(x)));
      dit(g.t.every((x, i) => i === 0 || x <= g.t[i - 1]), 'L du plus récent au plus ancien');
      if (g.n) {
        await pg.locator('[data-la-achat]').first().click();
        await pg.waitForTimeout(400);
        const conf = await pg.evaluate(() => !!document.querySelector('[data-la-confirme] [data-la-oui]'));
        await pg.screenshot({ path: path.join(SHOTS, `lier-${W}-${th}-choisi.png`) });
        dit(conf, 'L SON toucher sur une case ⇒ « Relier à cet achat ? Non · Oui »');
        await pg.locator('[data-la-oui]').click({ timeout: 5000 }).catch(() => {});
        await attendre(pg, () => !document.querySelector('[data-relier-feuille]'), 8000);
        await pg.waitForTimeout(1200);
        const apres = await pg.evaluate((s) => { const l = document.querySelector(s); const a = l && l.querySelector('[data-vt-achat]'); const vr = l && l.getAttribute('data-vr-achat');
          const ann = [...document.querySelectorAll('button')].filter((b) => b.getClientRects().length && /^annuler$/i.test(b.textContent.trim()));
          return { etat: vr ? (vr === 'connu' ? 'relie' : vr) : a ? a.getAttribute('data-vt-achat') : '', texte: vr ? 'achet' : a ? a.textContent.trim() : '', annuler: ann.length, ferme: !document.querySelector('[data-relier-feuille]') }; }, selL);
        await pg.screenshot({ path: path.join(SHOTS, `lier-${W}-${th}-relie.png`) });
        dit(apres.ferme && apres.etat === 'relie' && /achet/i.test(apres.texte), `L « Oui » ⇒ reliée (« ${apres.texte} »)`, apres);
        dit(apres.annuler >= 1, `L le geste s'annule (« Annuler » visible : ${apres.annuler})`);
        if (apres.annuler) {
          await pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.getClientRects().length && /^annuler$/i.test(x.textContent.trim())); if (b) b.click(); });
          await pg.waitForTimeout(1500);
          const ann = await pg.evaluate((s) => { const l = document.querySelector(s); const vr = l && l.getAttribute('data-vr-achat'); if (vr) return vr; const a = l && l.querySelector('[data-vt-achat]'); return a ? a.getAttribute('data-vt-achat') : ''; }, selL);
          dit(ann === 'libre', `L « Annuler » ⇒ la vente redevient « à relier » (${ann})`);
        }
      }
      dit(!erreurs.length, 'aucune erreur de page', erreurs.slice(0, 3));
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a rencontré une erreur', String(e && e.stack || e)); }
  await nav.close(); srv.close();
  console.log(`\n${ok} vert(s), ${ko} rouge(s) — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
