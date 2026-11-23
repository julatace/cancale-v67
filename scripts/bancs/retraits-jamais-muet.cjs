require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  « À RETIRER » N'EST JAMAIS UN VIDE MUET (20 nov., bugs-terrain — captures iPhone de Julien, 15:35 :
//  « À retirer au moins · 18 », « 13 à vérifier », puis RIEN en dessous, la barre de chargement figée).
//  Mesuré : à son volume, les e-mails de suivi mettent > 20 s à être posés (processeur pris) ; une lecture
//  RATÉE les laissait `null` pour toujours, sans phrase ni relecture. Base INVENTÉE (`design-passe.cjs`) + trois
//  colis Mondial Relay inventés, Achats v2, 390 tactile et 1512 :
//    L  e-mails de suivi TENUS (requête retenue, jamais un délai fixe) : la place des colis dit « Je lis tes colis… »
//       (`data-retraits-lecture`) — jamais rien ; relâchés ⇒ les cartes arrivent ;
//    K  e-mails de suivi en panne (503) : la phrase et « Réessayer » (`data-retraits-suivis-ko`) ; la base revient,
//       « Réessayer » ⇒ les cartes arrivent.
//  Un banc ne meurt pas, il rapporte. `BANC_DIST` pour juger un autre build ; `SHOTS` pour les captures.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const { ouvrir, base, srv, PORT, chromium } = P;
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-retraits-jamais-muet');
fs.mkdirSync(SHOTS, { recursive: true });
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 400) : '')); } return c; };
const J = 86400000;
const isoDans = (ms) => new Date(Date.now() + ms).toISOString();
function baseRJ() {
  const b = base();
  const colis = (suivi, code) => ({ id: `email_track_mondialrelay_${suivi}`, data: { type: 'suivi', carrier: 'mondialrelay', suivi, status: 'available', statusLabel: 'Arrivé au point de retrait',
    subject: `Votre colis ${suivi} est disponible`, receivedAt: isoDans(-3 * 3600000), emailAt: isoDans(-3 * 3600000), arriveLe: isoDans(-3 * 3600000), code, code2: null, artTitle: null,
    lieu: 'RELAIS INVENTE, 1 RUE DU TEST, 11111 VILLETEST', limite: isoDans(4 * J).slice(0, 10), consigne: false, qrUrl: null, qrB64: null, account: '' } });
  b.rows.push(colis('87100001', '111111'), colis('87100002', '222222'), colis('87100003', '333333'));
  return b;
}
const releve = (pg) => pg.evaluate(() => ({
  lecture: !!document.querySelector('[data-retraits-lecture]'),
  ko: !!document.querySelector('[data-retraits-suivis-ko]'),
  points: document.querySelectorAll('[data-rp-point]').length,
  codes: [...document.querySelectorAll('[data-rp-code-grand]')].map((e) => e.textContent.trim()),
  zone: ((document.querySelector('[data-v2-achats-retirer]') || {}).innerText || '').trim().slice(0, 80),
}));
const attendre = async (pg, f, n = 40) => { let r = null; for (let k = 0; k < n; k++) { r = await releve(pg); if (f(r)) return r; await pg.waitForTimeout(500); } return r; };
const estSuivi = (u) => /\/rest\/v1\/app_data\?[^#]*id=like\.email_track_/.test(decodeURIComponent(u));

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const b = baseRJ();
  try {
    for (const W of [390, 1512]) {
      // ── L : lecture TENUE ───────────────────────────────────────────────
      {
        const { ctx, pg, erreurs } = await ouvrir(nav, { W, sombre: false, b, url: '/?tab=achats' });
        await pg.addInitScript(() => { try { localStorage.setItem('vrm_design_v2', '1'); localStorage.removeItem('vrm_banc_dom_ancien'); } catch (_) {} });
        const tenues = []; let lache = false;
        await pg.route((u) => estSuivi(String(u)), async (r) => { if (lache) return r.fallback(); tenues.push(r); });
        await pg.reload({ waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('.vrm-main', { timeout: 25000 }).catch(() => {});
        const r1 = await attendre(pg, (r) => r.lecture || r.points > 0, 24);
        await pg.screenshot({ path: path.join(SHOTS, `L-tenue-${W}.png`) });
        dit(tenues.length > 0 && r1.lecture && r1.points === 0, `L ${W} : e-mails de suivi en lecture ⇒ « Je lis tes colis… » à la place des colis`, { tenues: tenues.length, ...r1 });
        lache = true; for (const r of tenues.splice(0)) await r.fallback().catch(() => {});
        const r2 = await attendre(pg, (r) => r.codes.includes('333333'));
        dit(r2.codes.includes('111111') && r2.codes.includes('333333') && !r2.lecture, `L ${W} : relâchés ⇒ les codes arrivent, plus de « Je lis »`, r2);
        dit(!erreurs.length, `L ${W} : aucune erreur de page`, erreurs);
        await ctx.close();
      }
      // ── K : lecture RATÉE ───────────────────────────────────────────────
      {
        const { ctx, pg, erreurs } = await ouvrir(nav, { W, sombre: false, b, url: '/?tab=achats' });
        await pg.addInitScript(() => { try { localStorage.setItem('vrm_design_v2', '1'); localStorage.removeItem('vrm_banc_dom_ancien'); } catch (_) {} });
        let panne = true;
        await pg.route((u) => estSuivi(String(u)), (r) => (panne ? r.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"panne inventée"}' }) : r.fallback()));
        await pg.reload({ waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('.vrm-main', { timeout: 25000 }).catch(() => {});
        const r1 = await attendre(pg, (r) => r.ko || r.points > 0, 40);
        await pg.waitForSelector('[data-retraits-suivis-ko]', { timeout: 8000 }).catch(() => {});
        await pg.screenshot({ path: path.join(SHOTS, `K-panne-${W}.png`) });
        dit(r1.ko && r1.points === 0, `K ${W} : e-mails de suivi en panne ⇒ la phrase et « Réessayer », jamais un vide`, r1);
        panne = false;
        const btn = pg.locator('[data-retraits-suivis-ko] [data-suivis-reessayer]').first();
        if (await btn.count()) { if (W < 600) await btn.tap().catch(() => {}); else await btn.click().catch(() => {}); }
        const r2 = await attendre(pg, (r) => r.codes.includes('333333'));
        dit(r2.codes.includes('333333') && !r2.ko, `K ${W} : la base revient, « Réessayer » ⇒ les codes arrivent`, r2);
        dit(!erreurs.length, `K ${W} : aucune erreur de page`, erreurs);
        await ctx.close();
      }
    }
  } catch (e) { ko++; console.log('  ❌ le banc s’est arrêté : ' + String(e && e.stack || e).slice(0, 1500)); }
  await nav.close(); srv.close();
  console.log(`\n${ko ? '❌' : '✅'} retraits-jamais-muet : ${ok} verts, ${ko} rouges — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
