require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  ACHATS EN LOT : DIVISER UN ACHAT, RÉPARTIR SON PRIX (22 nov. 2026, lot achats-lot)
//  Base INVENTÉE (design-passe : 3 comptes) + trois achats posés ici :
//    · « Lot 3 articles » (90 €) dont SA transaction (côté acheteur) porte 3 articles, chacun son prix affiché (50 · 30 · 20) ;
//    · « Lot 2 articles » (40 €) SANS transaction lue : seulement « peut-être un lot » (le titre ne prouve rien) ;
//    · « Nike Dunk Low panda » (45,50 €) : un achat simple.
//  Récit : docs/passation/2026-11-22-achats-lot.md. 390 × 844 tactile et 1512 × 950 ; mesures data-* et boîtes RENDUES :
//    L  l'étiquette de la rangée : « Lot de 3 articles » (prouvé), « Peut-être un lot » (titre), rien pour l'achat simple ;
//    F  la feuille : 3 articles lus (titres de la transaction), « Prix des articles » proposé, 45 · 27 · 18 € (somme 90 € au
//       centime), avant / après ; à la main : le reste dit en direct, « Diviser » bloqué tant qu'il ne fait pas 0 ;
//    D  « Diviser en 3 » (SON toucher) ⇒ 3 parts, 3 nouveaux N° servis à la suite, leurs coûts posés (somme = 90 €), l'achat
//       déclaré lot ; la rangée dit « Divisé en 3 · N°… » ; « Regrouper » rend l'achat (coûts retirés, N° gardés au pool) ;
//    S  l'achat simple se divise à la main en 2 (« Diviser cet achat » dans ⋯ / le menu de la ligne) ;
//    G  44 px au doigt, aucun débordement, aucune erreur de page.
//  `BANC_DIST=…` juge un autre build (le code d'avant : rouge attendu). `SHOTS=dossier` garde les captures.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const P = require('./design-passe.cjs');
const { ouvrir, base, srv, PORT, chromium } = P;
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-achats-lot');
fs.mkdirSync(SHOTS, { recursive: true });
const DSF = process.env.SHOTS ? 2 : 1;
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARG = liste('VUES', '390,1512').map(Number);
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 600) : '')); } return c; };
const attendre = async (pg, f, ms = 30000, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await pg.evaluate(f, arg).catch(() => false)) return true; await pg.waitForTimeout(300); } return false; };
const svg = (h) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="hsl(${h},40%,80%)"/></svg>`);

const TX_LOT = '77000000001', TX_TITRE = '77000000002', TX_SIMPLE = '77000000003';
function baseLot() {
  const b = base();
  const r = b.rows.find((x) => /_orders_purchased$/.test(x.id));
  const uid = r.id.replace(/^harvest_/, '').replace(/_orders_purchased$/, '');
  const now = Date.now(), d = (h) => new Date(now - h * 3600e3).toISOString();
  const achats = r.data.payload.my_orders;
  achats.unshift(
    { transaction_id: Number(TX_LOT), conversation_id: Number(TX_LOT), title: 'Lot 3 articles', price: { amount: '90.0', currency_code: 'EUR' }, status: 'Commande finalisée', date: d(2), photo: { url: svg(200) } },
    { transaction_id: Number(TX_TITRE), conversation_id: Number(TX_TITRE), title: 'Lot 2 articles', price: { amount: '40.0', currency_code: 'EUR' }, status: 'Commande finalisée', date: d(3), photo: { url: svg(120) } },
    { transaction_id: Number(TX_SIMPLE), conversation_id: Number(TX_SIMPLE), title: 'Nike Dunk Low panda 42', price: { amount: '45.5', currency_code: 'EUR' }, status: 'Commande finalisée', date: d(4), photo: { url: svg(40) } });
  r.data.nItems = achats.length;
  const it = (id, titre, prix, h, t) => ({ id: Number(id), title: titre, price: { amount: prix, currency_code: 'EUR' }, photos: [{ url: svg(h) }], size_title: t, status: 'Très bon état', is_closed: true });
  b.rows.push({ id: `harvest_${uid}_txn_${TX_LOT}`, data: { capturedAt: d(1), payload: { transaction: { id: Number(TX_LOT), user_side: 'buyer', items_count: 3, status: 450, status_title: 'Commande finalisée',
    order: { items: [it('5100001', 'Adidas Samba OG blanc 42', '50.0', 10, '42'), it('5100002', 'Nike Air Max 1 rouge 43', '30.0', 90, '43'), it('5100003', 'Asics Gel 1130 argent 41', '20.0', 160, '41')] } } } } });
  return b;
};

const mesureFeuille = () => {
  const f = document.querySelector('[data-diviser-achat]'); if (!f) return null;
  const lignes = [...f.querySelectorAll('[data-lot-ligne]')].map((e) => ({ k: e.getAttribute('data-lot-ligne'), prix: e.getAttribute('data-lot-ligne-prix'), num: e.getAttribute('data-lot-ligne-num'), titre: (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80) }));
  const modes = [...f.querySelectorAll('[data-lot-mode]')].map((e) => e.getAttribute('data-lot-mode'));
  const choisi = (f.querySelector('[data-lot-mode][aria-checked="true"], [data-lot-mode][aria-selected="true"], [data-lot-mode][aria-pressed="true"]') || { getAttribute: () => '' }).getAttribute('data-lot-mode');
  const tot = f.querySelector('[data-lot-total]'), reste = f.querySelector('[data-lot-reste]'), apres = f.querySelector('[data-lot-apres]'), val = f.querySelector('[data-lot-valider]');
  const petits = [...f.querySelectorAll('button, input, [role="button"], a[href]')].filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map((e) => { const r = e.getBoundingClientRect(); return { h: Math.round(r.height), w: Math.round(r.width), t: (e.getAttribute('aria-label') || e.textContent || e.tagName).trim().slice(0, 30) }; }).filter((x) => x.h > 0 && (x.h < 43.5 || x.w < 43.5));
  return { lignes, modes, choisi, total: tot ? tot.getAttribute('data-lot-total') : null, reste: reste ? reste.getAttribute('data-lot-reste') : null, apres: apres ? apres.getAttribute('data-lot-apres') : null,
    valider: val ? val.getAttribute('data-lot-valider') : null, etat: (f.querySelector('[data-lot-etat]') || { getAttribute: () => '' }).getAttribute('data-lot-etat'), petits, deborde: document.documentElement.scrollWidth - innerWidth,
    texte: (f.textContent || '').replace(/\s+/g, ' ').slice(0, 400) };
};
const lire = (pg, k) => pg.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } }, k);

async function ouvrirFeuille(pg, tx, tel) {
  if (tel) {
    const chip = await pg.evaluate((tx) => { const r = document.querySelector(`[data-achat-tx="${tx}"]`); const c = r && r.querySelector('[data-achat-lot]'); if (c) { c.scrollIntoView({ block: 'center' }); c.click(); return true; } return false; }, tx);
    if (!chip) {   // pas d'étiquette (achat simple) : « ⋯ » puis « Diviser cet achat »
      await pg.evaluate((tx) => { const r = document.querySelector(`[data-achat-tx="${tx}"]`); const b = r && r.querySelector('.vrm-buy-more'); if (b) { b.scrollIntoView({ block: 'center' }); b.click(); } }, tx);
      await pg.waitForTimeout(400);
      await pg.evaluate((tx) => { const b = [...document.querySelectorAll(`[data-achat-diviser="${tx}"]`)].find((e) => e.getClientRects().length); if (b) b.click(); }, tx);
    }
  } else {
    await pg.evaluate((tx) => { const b = document.querySelector(`[data-tt-plus="${tx}"]`); if (b) { b.scrollIntoView({ block: 'center' }); b.click(); } }, tx);
    await pg.waitForTimeout(400);
    await pg.evaluate(() => { const b = document.querySelector('[data-tt-plus-choix="diviser"]'); if (b) b.click(); });
  }
  return attendre(pg, () => { const f = document.querySelector('[data-diviser-achat]'); return !!(f && f.querySelector('[data-lot-ligne]')); }, 15000);
}
const fermer = async (pg) => { if (await pg.evaluate(() => !!document.querySelector('[data-diviser-achat]')).catch(() => false)) await pg.keyboard.press('Escape').catch(() => {}); await attendre(pg, () => !document.querySelector('[data-diviser-achat]'), 5000); };

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] }).catch(() => chromium.launch({ args: ['--no-sandbox'] }));
  try {
    for (const W of LARG) {
      const tel = W < 600;
      console.log(`\n── Achats en lot · ${W}`);
      const A = await ouvrir(nav, { W: tel ? 390 : 1512, sombre: false, b: baseLot(), url: '/?tab=achats', dsf: DSF });
      const pg = A.pg;
      const vu = await attendre(pg, (tx) => !!document.querySelector(`[data-achat-tx="${tx}"]`), 45000, TX_LOT);
      await pg.waitForTimeout(2500);
      dit(vu, 'l’écran Achats montre l’achat « Lot 3 articles »');
      // L — l'étiquette de la rangée.
      const lab = await pg.evaluate(([a, b, c]) => {
        const de = (tx) => { const r = document.querySelector(`[data-achat-tx="${tx}"]`); if (!r) return null; const e = r.querySelector('[data-achat-lot]'); return { etat: e ? e.getAttribute('data-achat-lot') : '', n: e ? e.getAttribute('data-achat-lot-n') : '', texte: (r.textContent || '').replace(/\s+/g, ' ') }; };
        return { lot: de(a), titre: de(b), simple: de(c) };
      }, [TX_LOT, TX_TITRE, TX_SIMPLE]);
      if (tel) {
        await attendre(pg, (tx) => { const r = document.querySelector(`[data-achat-tx="${tx}"] [data-achat-lot]`); return !!r && r.getAttribute('data-achat-lot') === 'prouve'; }, 20000, TX_LOT);
        const l2 = await pg.evaluate((tx) => { const e = document.querySelector(`[data-achat-tx="${tx}"] [data-achat-lot]`); return e ? e.getAttribute('data-achat-lot') + ':' + e.getAttribute('data-achat-lot-n') : ''; }, TX_LOT);
        dit(l2 === 'prouve:3', 'L le lot dont SA transaction dit 3 articles : « Lot de 3 articles »', l2);
        dit(lab.titre && lab.titre.etat === 'peutEtre', 'L « Lot 2 articles » sans transaction lue : seulement « Peut-être un lot »', lab.titre);
        dit(lab.simple && lab.simple.etat === '', 'L l’achat simple : aucune étiquette', lab.simple);
      } else {
        await attendre(pg, (tx) => /Lot de 3 articles/.test((document.querySelector(`[data-achat-tx="${tx}"]`) || {}).textContent || ''), 20000, TX_LOT);
        const t2 = await pg.evaluate(([a, b, c]) => [a, b, c].map((tx) => ((document.querySelector(`[data-achat-tx="${tx}"]`) || {}).textContent || '').replace(/\s+/g, ' ')), [TX_LOT, TX_TITRE, TX_SIMPLE]);
        dit(/Lot de 3 articles/.test(t2[0]), 'L le tableau : « Lot de 3 articles » sous le titre', t2[0].slice(0, 160));
        dit(/Peut-être un lot/.test(t2[1]) && !/Lot de 2 articles/.test(t2[1]), 'L « Lot 2 articles » : « Peut-être un lot » (jamais affirmé)', t2[1].slice(0, 160));
        dit(!/Peut-être un lot|Lot de/.test(t2[2]), 'L l’achat simple : rien', t2[2].slice(0, 160));
      }
      await pg.screenshot({ path: path.join(SHOTS, `achats-lot-${W}-liste.png`) });

      // F — la feuille du lot prouvé.
      const ouverte = await ouvrirFeuille(pg, TX_LOT, tel);
      dit(ouverte, 'F la feuille « Diviser cet achat » s’ouvre (un toucher sur l’étiquette / le menu de la ligne)');
      await attendre(pg, () => { const f = document.querySelector('[data-diviser-achat]'); return !!(f && f.querySelector('[data-lot-ligne-num]:not([data-lot-ligne-num=""])')); }, 8000);
      await pg.waitForTimeout(600);
      let m = await pg.evaluate(mesureFeuille);
      await pg.screenshot({ path: path.join(SHOTS, `achats-lot-${W}-feuille.png`) });
      const somme = (l) => l.reduce((s, x) => s + Number(x.prix || 0), 0);
      dit(m && m.etat === 'prouve' && m.lignes.length === 3, 'F 3 articles, lus dans SA transaction', m && { etat: m.etat, n: m.lignes.length });
      dit(m && /Adidas Samba OG/.test(m.lignes[0].titre) && /Nike Air Max 1/.test(m.lignes[1].titre), 'F chaque part porte le titre de SON article', m && m.lignes.map((x) => x.titre));
      dit(m && m.modes.includes('articles') && m.modes.includes('egal') && m.modes.includes('main'), 'F les choix : parts égales · prix des articles · à la main', m && m.modes);
      dit(m && m.lignes.map((x) => x.prix).join(',') === '4500,2700,1800' && m.total === '9000' && m.apres === '9000', 'F au prorata des prix affichés : 45 · 27 · 18 € = 90 € (avant / après)', m && { l: m.lignes.map((x) => x.prix), total: m.total, apres: m.apres });
      dit(m && m.lignes.every((x) => x.num), 'F chaque part montre SON nouveau N° (à la suite)', m && m.lignes.map((x) => x.num));
      dit(m && m.valider === 'pret', 'F « Diviser en 3 » prêt', m && m.valider);
      dit(m && !m.petits.length, 'G toutes les cibles de la feuille font 44 px', m && m.petits.slice(0, 6));
      dit(m && m.deborde <= 0, 'G aucun débordement horizontal', m && m.deborde);
      // À la main : le reste en direct, bloqué tant qu'il n'est pas 0.
      await pg.evaluate(() => { const b = document.querySelector('[data-lot-mode="main"]'); if (b) b.click(); });
      await pg.waitForTimeout(300);
      const taper = async (k, v) => { const l = pg.locator(`[data-lot-main="${k}"]`); await l.scrollIntoViewIfNeeded().catch(() => {}); await l.fill(v).catch(() => {}); };
      await taper(1, '40'); await taper(2, '30'); await taper(3, '19,99');
      await pg.waitForTimeout(300);
      m = await pg.evaluate(mesureFeuille);
      await pg.screenshot({ path: path.join(SHOTS, `achats-lot-${W}-main-reste.png`) });
      dit(m && m.reste === '1' && m.valider === 'bloque', 'F à la main 40 + 30 + 19,99 : « reste 0,01 € », « Diviser » bloqué', m && { reste: m.reste, v: m.valider });
      await taper(3, '20');
      await pg.waitForTimeout(300);
      m = await pg.evaluate(mesureFeuille);
      dit(m && m.reste === '0' && m.valider === 'pret', 'F 40 + 30 + 20 = 90 € : tout est réparti, « Diviser » prêt', m && { reste: m.reste, v: m.valider });
      // Retour au prorata, puis D — « Diviser en 3 ».
      await pg.evaluate(() => { const b = document.querySelector('[data-lot-mode="articles"]'); if (b) b.click(); });
      await pg.waitForTimeout(300);
      const poolAvant = (await lire(pg, 'vinted_used_numeros')) || [];
      const nums = (await pg.evaluate(mesureFeuille)).lignes.map((x) => x.num);
      await pg.locator('[data-lot-valider="pret"]').click().catch(() => {});
      const fait = await attendre(pg, (tx) => { try { const v = JSON.parse(localStorage.getItem('vrm_achats_divises') || '{}'); return !!(v[tx] && !v[tx].regroupe); } catch (_) { return false; } }, 15000, TX_LOT);
      await pg.waitForTimeout(1200);
      const div = ((await lire(pg, 'vrm_achats_divises')) || {})[TX_LOT];
      const couts = (await lire(pg, 'vinted_buyprice_by_num')) || {};
      const pool = (await lire(pg, 'vinted_used_numeros')) || [];
      const decl = ((await lire(pg, 'vrm_lots_declares')) || {})[TX_LOT];
      dit(fait && div && div.parts.length === 3 && div.parts.map((p) => p.id).join(',') === `achat:${TX_LOT}#1,achat:${TX_LOT}#2,achat:${TX_LOT}#3`, 'D 3 parts, chacune SON identité achat:{tx}#k', div && div.parts.map((p) => p.id));
      dit(div && div.parts.map((p) => p.numero).join(',') === nums.join(','), 'D les N° montés dans la feuille sont ceux servis', div && div.parts.map((p) => p.numero));
      const sc = div ? div.parts.reduce((s, p) => s + Math.round(parseFloat(String(couts[p.numero] || 'NaN').replace(',', '.')) * 100), 0) : NaN;
      dit(sc === 9000, 'D les coûts posés par N° font 90 € au centime', div && div.parts.map((p) => couts[p.numero]));
      dit(div && div.parts.every((p) => pool.map(String).includes(String(p.numero))) && pool.length >= poolAvant.length + 3, 'D les 3 N° entrent au pool (jamais redonnés)');
      dit(decl === 3, 'D l’achat est déclaré lot de 3 (le reçu entier ne se pose plus seul sur une paire)', decl);
      await fermer(pg);
      await pg.waitForTimeout(800);
      const apresTxt = await pg.evaluate((tx) => ((document.querySelector(`[data-achat-tx="${tx}"]`) || {}).textContent || '').replace(/\s+/g, ' '), TX_LOT);
      await pg.screenshot({ path: path.join(SHOTS, `achats-lot-${W}-divise.png`) });
      const etiq = await pg.evaluate((tx) => { const e = document.querySelector(`[data-achat-tx="${tx}"] [data-achat-lot]`); return e ? (e.getAttribute('data-achat-lot') + '|' + (e.getAttribute('aria-label') || '')) : ''; }, TX_LOT);
      const txtDiv = tel ? etiq : apresTxt;
      dit(/Divisé en 3/.test(txtDiv) && div && txtDiv.includes('N°' + div.parts[0].numero) && (!tel || etiq.startsWith('divise|')), 'D la rangée dit « Divisé en 3 · N°… » (téléphone : « 3 parts », la phrase entière lue)', txtDiv.slice(0, 200));
      if (process.env.ESC_TEST) { await pg.keyboard.press('Escape'); await pg.waitForTimeout(2500); }
      const encore = ((await lire(pg, 'vrm_achats_divises')) || {})[TX_LOT];
      dit(encore && !encore.regroupe, 'D la division tient après la fermeture de la feuille', encore && { regroupe: encore.regroupe });
      // Regrouper (aucune part vendue).
      const re = await ouvrirFeuille(pg, TX_LOT, tel).catch(() => false);
      await attendre(pg, () => !!document.querySelector('[data-lot-regrouper]'), 8000);
      await pg.waitForTimeout(400);
      await pg.screenshot({ path: path.join(SHOTS, `achats-lot-${W}-division.png`) });
      const etatR = await pg.evaluate(() => (document.querySelector('[data-lot-regrouper]') || { getAttribute: () => '' }).getAttribute('data-lot-regrouper'));
      const parts = await pg.evaluate(() => [...document.querySelectorAll('[data-lot-part]')].map((e) => e.getAttribute('data-lot-part-prix')));
      dit(parts.join(',') === '4500,2700,1800', 'D la feuille de l’achat divisé : ses 3 parts et leurs prix', parts);
      dit(etatR === 'ok', 'R « Regrouper » possible (aucune part vendue, ventes lues)', etatR);
      await pg.locator('[data-lot-regrouper="ok"]').click().catch(() => {});
      await pg.waitForTimeout(300);
      await pg.locator('[data-lot-regrouper="ok"]').click().catch(() => {});   // le 2e toucher (destructif)
      const regr = await attendre(pg, (tx) => { try { const v = JSON.parse(localStorage.getItem('vrm_achats_divises') || '{}'); return !!(v[tx] && v[tx].regroupe); } catch (_) { return false; } }, 15000, TX_LOT);
      await pg.waitForTimeout(800);
      const couts2 = (await lire(pg, 'vinted_buyprice_by_num')) || {};
      const pool2 = (await lire(pg, 'vinted_used_numeros')) || [];
      dit(regr && div && div.parts.every((p) => couts2[p.numero] === undefined), 'R regroupé : les coûts des parts sont retirés', div && div.parts.map((p) => couts2[p.numero]));
      dit(div && div.parts.every((p) => pool2.map(String).includes(String(p.numero))), 'R les N° restent au pool (écrits sur des cartons : jamais redonnés)');
      await fermer(pg);
      // S — l'achat simple, divisé à la main en 2.
      const os2 = await ouvrirFeuille(pg, TX_SIMPLE, tel);
      await pg.waitForTimeout(600);
      const s = await pg.evaluate(mesureFeuille);
      await pg.screenshot({ path: path.join(SHOTS, `achats-lot-${W}-simple.png`) });
      dit(os2 && s && s.etat === 'simple' && s.lignes.length === 2 && s.lignes.map((x) => x.prix).join(',') === '2275,2275' && s.total === '4550', 'S un achat simple (45,50 €) : 2 parts égales de 22,75 €', s && { etat: s.etat, l: s.lignes.map((x) => x.prix), t: s.total });
      dit(s && !s.modes.includes('articles'), 'S pas de « Prix des articles » sans articles lus (jamais deviné)', s && s.modes);
      dit(!A.erreurs.length, 'G aucune erreur de page', A.erreurs.slice(0, 3));
      await A.ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.stack || e).slice(0, 400)); }
  await nav.close(); srv.close();
  console.log(`\n${ok} ✅ · ${ko} ❌   (captures : ${SHOTS})`);
  process.exit(ko ? 1 : 0);
})();
