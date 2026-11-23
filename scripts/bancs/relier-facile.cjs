require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  RELIER PLUS FACILE (21 nov. 2026, lot relier-code) — la feuille « Lier à un achat » RENDUE, base INVENTÉE (design-passe :
//  3 comptes ; chaque vente reçoit un titre de modèle distinct et SON achat arrivé 15 j avant ; une vente sur cinq a trois
//  achats identiques — l'égalité ; une sur sept est servie par un LOT de 2).
//  Julien : « rends relier les achats à la vente / à l'annonce plus facile ». Récit : docs/passation/2026-11-21-relier-code.md.
//  390 × 844 tactile et 1512 × 950, clair et sombre ; mesures data-* et boîtes RENDUES :
//    B  en tête de la feuille, LA meilleure proposition (une), sa raison écrite (« même modèle … · taille … »), « Relier » ≥ 44 px ;
//       une vente à égalité ⇒ AUCUNE meilleure, « à égalité » dit, les suggestions restent ; la grille complète dessous ;
//    T  « Relier » ne relie PAS : il ouvre « Relier à cet achat ? Non · Oui » ; « Oui » relie (la rangée dit « Acheté … ») ;
//    S  Ventes ⋯ ▸ « Relier en série » : « 1 sur N », « Passer » ⇒ « 2 sur N » sans rien écrire, « Relier » + « Oui » ⇒ la suivante,
//       la pilule « Annuler » du geste ;
//    I  Achats ▸ « ⋯ » d'un achat arrivé ▸ « Relier à une vente / annonce » ⇒ la feuille inverse (l'achat en haut, ses ventes) ;
//    L  un lot dit « Lot · 0/2 reliés ».
//  `BANC_DIST=…` juge un autre build (le code d'avant : rouge attendu). `SHOTS=dossier` garde les captures.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const P = require('./design-passe.cjs');
const { ouvrir, base, srv, PORT, chromium } = P;
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-relier-facile');
fs.mkdirSync(SHOTS, { recursive: true });
const DSF = process.env.SHOTS ? 2 : 1;
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARG = liste('VUES', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 600) : '')); } return c; };
const attendre = async (pg, f, ms = 30000, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await pg.evaluate(f, arg).catch(() => false)) return true; await pg.waitForTimeout(300); } return false; };
const sansToasts = async (pg) => { await pg.evaluate(() => { for (const e of document.querySelectorAll('body *')) { if (getComputedStyle(e).position !== 'fixed' || !/paires? numérotées?/.test(e.textContent || '') || e.closest('.n-onglets, .vrm-tabbar')) continue;
  const f = [...e.querySelectorAll('button')].find((b) => /fermer|close|×/i.test((b.getAttribute('aria-label') || '') + b.textContent)); if (f) { f.click(); break; } } }).catch(() => {}); await pg.waitForTimeout(400); };

const MODELES = ['Adidas Handball Spezial bleu marine', 'Nike Air Force 1 blanc', 'Salomon XT-6 noir', 'Asics Gel Kayano 14 argent', 'New Balance 550 vert', 'Nike Dunk Low panda noir',
  'Adidas Samba beige', 'Onitsuka Tiger Mexico 66 jaune', 'Nike Air Max 90 rouge', 'Asics Novablast 4 bleu', 'Saucony Triumph 21 gris', 'New Balance 9060 rose', 'Adidas Gazelle vert', 'Nike Vomero 5 gris', 'Salomon Speedcross 6 orange'];
const TAILLES = ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47'];
const svg = (h) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="hsl(${h},40%,80%)"/></svg>`);
function baseRelier() {
  const b = base();
  const attendu = new Map();   // titre de la vente → 'meilleure' | 'egalite' | 'lot'
  let k = 0, tx = 99000000000;
  const achatsDe = new Map();
  for (const r of b.rows) if (/_orders_purchased$/.test(r.id)) achatsDe.set(r.id.replace(/_orders_purchased$/, ''), r);
  for (const r of b.rows) {
    if (!/_orders_sold$/.test(r.id)) continue;
    const pr = achatsDe.get(r.id.replace(/_orders_sold$/, '')); if (!pr) continue;
    const achats = pr.data.payload.my_orders;
    for (const o of r.data.payload.my_orders || []) {
      const m = MODELES[k % MODELES.length], t = TAILLES[Math.floor(k / MODELES.length) % TAILLES.length];
      o.title = `${m} taille ${t}`; o.size_title = t;
      const d = new Date(Date.parse(o.date) - 15 * 86400e3).toISOString();
      const genre = k % 5 === 4 ? 'egalite' : k % 7 === 3 ? 'lot' : 'meilleure';
      attendu.set(o.title, genre);
      const nb = genre === 'egalite' ? 3 : 1;
      for (let j = 0; j < nb; j++) achats.push({ transaction_id: ++tx, conversation_id: tx, title: genre === 'lot' ? `Lot de 2 ${m} ${t}` : `${m} ${t}`, price: { amount: genre === 'lot' ? '60.0' : String(18 + (k % 9)) + '.0', currency_code: 'EUR' },
        status: 'Commande finalisée', date: new Date(Date.parse(d) - j * 3600e3).toISOString(), photo: { url: svg((k * 37 + j * 90) % 360) } });
      k++;
    }
  }
  for (const r of b.rows) if (/_orders_purchased$/.test(r.id)) for (const a of r.data.payload.my_orders || []) if (!a.photo) a.photo = { url: svg((Number(a.transaction_id) * 37) % 360) };
  return { b, attendu };
}

const mesureFeuille = () => {
  const vis = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  const R = (e) => e.getBoundingClientRect();
  const f = document.querySelector('[data-relier-feuille]');
  const best = f && f.querySelector('[data-la-meilleure]');
  const rel = best && best.querySelector('[data-la-relier]');
  const autres = f ? [...f.querySelectorAll('[data-la-suggestion]')].filter(vis) : [];
  const grille = f && f.querySelector('[data-la-grille]');
  const boite = f && f.querySelector('.vrm-relier-feuille-boite');
  const deborde = boite ? [...boite.querySelectorAll('.n-rf-best, .n-rf-autre, .n-la-case')].filter(vis).some((e) => R(e).right > R(boite).right + 1) : false;
  return { ouverte: !!f, titre: ((f && f.querySelector('[data-relier-cible-titre]')) || { textContent: '' }).textContent.trim(),
    best: best ? best.getAttribute('data-la-meilleure') : '', niveau: best ? best.getAttribute('data-la-niveau') : '', raison: best ? ((best.querySelector('[data-la-raison]') || {}).textContent || '').trim() : '',
    relierH: rel ? Math.round(R(rel).height) : 0, pasCelle: !!(best && best.querySelector('[data-la-pas-celle]')), autres: autres.length,
    raisonsAutres: autres.map((a) => ((a.querySelector('[data-la-raison]') || {}).textContent || '').trim()), egalite: !!(f && f.querySelector('[data-la-egalite]')),
    grille: grille ? Number(grille.getAttribute('data-la-grille')) : 0, lot: f ? [...f.querySelectorAll('[data-la-lot]')].filter(vis).map((x) => x.textContent.trim()) : [],
    confirme: !!(f && f.querySelector('[data-la-confirme] [data-la-oui]')), serie: ((f && f.querySelector('[data-la-serie]')) || { getAttribute: () => '' }).getAttribute('data-la-serie'),
    inverse: !!(f && f.querySelector('[data-la-inverse]')), deborde, debordePage: document.documentElement.scrollWidth - innerWidth };
};

async function ouvrirEcran(nav, { W, sombre, b, tab }) {
  const { ctx, pg, erreurs } = await ouvrir(nav, { W: W < 600 ? 390 : 1512, sombre, b, url: '/?tab=' + tab, dsf: DSF });
  await pg.waitForSelector('.vrm-main', { timeout: 30000 }).catch(() => {});
  return { ctx, pg, erreurs };
}
const fermer = async (pg) => { await pg.locator('[data-relier-fermer]').first().click({ timeout: 4000 }).catch(() => {}); await attendre(pg, () => !document.querySelector('[data-relier-feuille]'), 5000); };

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] }).catch(() => chromium.launch({ args: ['--no-sandbox'] }));
  const { b, attendu } = baseRelier();
  try {
    for (const W of LARG) for (const th of THEMES) {
      const tel = W < 600;
      console.log(`\n── Relier plus facile · ${W} · ${th}`);
      const { ctx, pg, erreurs } = await ouvrirEcran(nav, { W, sombre: th === 'sombre', b, tab: 'ventes' });
      await attendre(pg, () => !!document.querySelector('[data-vt-relier="libre"]'), 40000);
      await pg.waitForTimeout(1500); await sansToasts(pg);
      // B — ouvrir « Relier » sur les rangées libres jusqu'à voir une « meilleure », une égalité et un lot.
      const vus = { meilleure: null, egalite: null, lot: null };
      const n = await pg.evaluate(() => [...document.querySelectorAll('[data-vt-relier="libre"]')].filter((e) => e.getClientRects().length).length);
      for (let i = 0; i < Math.min(n, 14) && (!vus.meilleure || !vus.egalite || !vus.lot); i++) {
        await pg.evaluate((i) => { const r = [...document.querySelectorAll('[data-vt-relier="libre"]')].filter((e) => e.getClientRects().length)[i]; if (r) { r.scrollIntoView({ block: 'center' }); r.click(); } }, i);
        if (!await attendre(pg, () => !!document.querySelector('[data-la-grille] [data-la-achat]'), 12000)) { await fermer(pg); continue; }
        await pg.waitForTimeout(500);
        const m = await pg.evaluate(mesureFeuille);
        const g = attendu.get(m.titre) || '?';
        if (!vus[g]) { vus[g] = m; await pg.screenshot({ path: path.join(SHOTS, `relier-${W}-${th}-${g}.png`) }); }
        if (g === 'meilleure' && vus.meilleure === m) {
          dit(!!m.best, `B la meilleure proposition en tête (« ${m.titre} »)`, m);
          dit(/même modèle/.test(m.raison) && /taille/.test(m.raison), `B sa raison est écrite (« ${m.raison} »)`);
          dit(m.relierH >= 44 && m.pasCelle, `B « Relier » ≥ 44 px (${m.relierH}) et « Pas celle-ci »`);
          dit(m.grille > 0, `B la grille complète dessous (${m.grille} cases)`);
          dit(!m.deborde && m.debordePage <= 1, 'B rien ne déborde de la feuille', m);
          // T — « Relier » choisit, « Oui » relie.
          await pg.locator('[data-la-meilleure] [data-la-relier]').click();
          await pg.waitForTimeout(400);
          const c = await pg.evaluate(mesureFeuille);
          await pg.screenshot({ path: path.join(SHOTS, `relier-${W}-${th}-confirme.png`) });
          dit(c.ouverte && c.confirme, 'T « Relier » ne relie pas seul : « Relier à cet achat ? Non · Oui »');
          await pg.locator('[data-la-oui]').click({ timeout: 5000 }).catch(() => {});
          await attendre(pg, () => !document.querySelector('[data-relier-feuille]'), 8000);
          await pg.waitForTimeout(1200);
          const ann = await pg.evaluate(() => [...document.querySelectorAll('button')].filter((x) => x.getClientRects().length && /^annuler$/i.test(x.textContent.trim())).length);
          await pg.screenshot({ path: path.join(SHOTS, `relier-${W}-${th}-relie.png`) });
          dit(ann >= 1, `T « Oui » ⇒ relié, le geste s'annule (« Annuler » : ${ann})`);
          if (ann) { await pg.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.getClientRects().length && /^annuler$/i.test(y.textContent.trim())); if (x) x.click(); }); await pg.waitForTimeout(1200); }
          continue;
        }
        if (g === 'egalite' && vus.egalite === m) {
          dit(!m.best, 'B une égalité (3 achats identiques) ⇒ AUCUNE meilleure', m);
          dit(m.egalite && m.autres >= 2, `B … « à égalité » est dit, les suggestions restent (${m.autres})`);
        }
        if (g === 'lot' && vus.lot === m) dit(m.lot.some((x) => /0\/2/.test(x)), `L un lot dit « Lot · 0/2 reliés » (${m.lot.join(' | ')})`);
        await fermer(pg);
      }
      dit(!!vus.meilleure && !!vus.egalite, `B les deux cas vus (meilleure : ${!!vus.meilleure}, égalité : ${!!vus.egalite}, lot : ${!!vus.lot})`);

      // S — « Relier en série » depuis Ventes ⋯.
      await pg.evaluate(() => window.scrollTo(0, 0));
      await pg.locator('[data-vn-plus]').first().click({ timeout: 6000 }).catch(() => {});
      const entree = await attendre(pg, () => !!document.querySelector('[data-vn-serie-relier]'), 6000);
      await pg.screenshot({ path: path.join(SHOTS, `serie-${W}-${th}-menu.png`) });
      dit(entree, 'S Ventes ⋯ ▸ « Relier en série · N sans achat »');
      if (entree) {
        await pg.locator('[data-vn-serie-relier]').first().click();
        await attendre(pg, () => !!document.querySelector('[data-la-serie]') && !!document.querySelector('[data-la-grille] [data-la-achat]'), 12000);
        await pg.waitForTimeout(500);
        const s1 = await pg.evaluate(mesureFeuille);
        await pg.screenshot({ path: path.join(SHOTS, `serie-${W}-${th}-1.png`) });
        dit(/^1\/\d+$/.test(s1.serie), `S « 1 sur N » (${s1.serie})`);
        await pg.locator('[data-la-passer]').click().catch(() => {});
        await attendre(pg, () => /^2\//.test((document.querySelector('[data-la-serie]') || { getAttribute: () => '' }).getAttribute('data-la-serie')), 8000);
        const s2 = await pg.evaluate(mesureFeuille);
        dit(/^2\//.test(s2.serie) && s2.titre !== s1.titre, `S « Passer » ⇒ la suivante (${s2.serie})`);
        // Relier la première qui a une meilleure proposition.
        let relie = false;
        for (let j = 0; j < 6 && !relie; j++) {
          const m = await pg.evaluate(mesureFeuille);
          if (m.best) {
            const avant = m.serie;
            await pg.locator('[data-la-meilleure] [data-la-relier]').click(); await pg.waitForTimeout(300);
            await pg.locator('[data-la-oui]').click({ timeout: 5000 }).catch(() => {});
            relie = await attendre(pg, (a) => { const s = document.querySelector('[data-la-serie]'); return !!s && s.getAttribute('data-la-serie') !== a; }, 10000, avant);
            await pg.waitForTimeout(800);
            const apres = await pg.evaluate(mesureFeuille);
            await pg.screenshot({ path: path.join(SHOTS, `serie-${W}-${th}-apres.png`) });
            dit(relie, `S « Relier » + « Oui » ⇒ la suivante (${avant} → ${apres.serie})`);
          } else { await pg.locator('[data-la-passer]').click().catch(() => {}); await pg.waitForTimeout(800); }
        }
        if (!relie) dit(false, 'S une vente de la série avait une meilleure proposition');
        await fermer(pg);
      }
      dit(!erreurs.length, 'aucune erreur de page (Ventes)', erreurs.slice(0, 3));
      await ctx.close();

      // I — le geste inverse depuis Achats.
      const A = await ouvrirEcran(nav, { W, sombre: th === 'sombre', b, tab: 'achats' });
      await attendre(A.pg, () => !!document.querySelector('.vrm-buy-more, [data-achats-tableau] [data-tt-ligne]'), 40000);
      await A.pg.waitForTimeout(1500); await sansToasts(A.pg);
      let ouvert = false;
      if (tel) {
        // Un achat de la base qui porte un modèle (les « Nike achat N » de la base n'ont aucune vente après eux).
        const idx = await A.pg.evaluate((mods) => { const out = []; document.querySelectorAll('.vrm-buy-more').forEach((x, i) => { const r = x.closest('[data-buy-row], .vrm-buy-row, li, [class*="vrm-buy-item"]') || x.parentElement.parentElement.parentElement; if (r && mods.some((m) => r.textContent.includes(m))) out.push(i); }); return out; }, MODELES);
        for (const i of idx.slice(0, 8)) {
          if (ouvert) break;
          await A.pg.evaluate((i) => { const x = document.querySelectorAll('.vrm-buy-more')[i]; if (x) { x.scrollIntoView({ block: 'center' }); x.click(); } }, i);
          await A.pg.waitForTimeout(300);
          if (await A.pg.evaluate(() => !!document.querySelector('[data-achat-relier]'))) { await A.pg.locator('[data-achat-relier]').first().click(); ouvert = true; }
          else await A.pg.keyboard.press('Escape').catch(() => {});
        }
      } else {
        const idx = await A.pg.evaluate((mods) => [...document.querySelectorAll('[data-achats-tableau] [data-tt-ligne]')].map((l, i) => (mods.some((m) => l.textContent.includes(m)) ? i : -1)).filter((i) => i >= 0), MODELES);
        for (const i of idx.slice(0, 8)) {
          if (ouvert) break;
          await A.pg.evaluate((i) => { const l = document.querySelectorAll('[data-achats-tableau] [data-tt-ligne]')[i]; const b = l && l.querySelector('[data-tt-menu], .n-tt-menu, button[aria-haspopup]'); if (b) { b.scrollIntoView({ block: 'center' }); b.click(); } }, i);
          await A.pg.waitForTimeout(300);
          const it = await A.pg.evaluate(() => { const x = [...document.querySelectorAll('[role="menuitem"], [data-tt-menu-item], button')].find((y) => y.getClientRects().length && /Relier à une vente/.test(y.textContent)); if (x) { x.click(); return true; } return false; });
          if (it) ouvert = true; else await A.pg.keyboard.press('Escape').catch(() => {});
        }
      }
      dit(ouvert, 'I « ⋯ » d’un achat arrivé ▸ « Relier à une vente / annonce »');
      if (ouvert) {
        await attendre(A.pg, () => !!document.querySelector('[data-la-inverse] [data-la-grille], [data-la-inverse] [data-la-vide]'), 15000);
        await A.pg.waitForTimeout(600);
        const m = await A.pg.evaluate(mesureFeuille);
        await A.pg.screenshot({ path: path.join(SHOTS, `inverse-${W}-${th}.png`) });
        dit(m.inverse && !!A.pg && (await A.pg.evaluate(() => !!document.querySelector('[data-relier-achat]'))), 'I la feuille inverse : l’achat en haut');
        dit(m.grille > 0, `I ses ventes et annonces sans achat en grille (${m.grille})`);
        dit(!m.deborde && m.debordePage <= 1, 'I rien ne déborde');
      }
      dit(!A.erreurs.length, 'aucune erreur de page (Achats)', A.erreurs.slice(0, 3));
      await A.ctx.close();
    }
  } catch (e) { dit(false, 'le banc a rencontré une erreur', String(e && e.stack || e)); }
  await nav.close(); srv.close();
  console.log(`\n${ok} vert(s), ${ko} rouge(s) — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
