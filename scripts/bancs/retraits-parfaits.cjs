require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  RETRAITS PARFAITS (19 nov.) — l'app RENDUE (docs/passation/2026-11-19-retraits-parfaits.md).
//  Julien : « il y a quatre colis, j'ai un seul code de retrait » ; « je dois voir dans l'app quand un nouveau QR code
//  ou colis à retirer a été détecté ».
//  Base INVENTÉE (`design-passe.cjs`) + trois colis Mondial Relay au MÊME magasin inventé : deux au COMPTOIR
//  (« INTERMARCHE TEST »), un dans son CASIER (« LOCKER 24/7 INTERMARCHE TEST »), même rue, même code postal.
//  Cet appareil a déjà vu les deux du comptoir (`vrm_retraits_vus`) : le casier est NOUVEAU. À 390 tactile et 1512 :
//    S  deux passes pour ce magasin (le casier n'est pas rangé avec le comptoir), chacune dit sa sorte
//       (« Consigne · code à taper sur l'écran » / « Comptoir · … ») ;
//    N  le toast « Nouveau code de retrait · Mondial Relay … » ; la ligne du casier marquée « Nouveau », pas les autres ;
//       toucher la ligne ⇒ plus « Nouveau » (et après rechargement : pas réannoncé) ;
//    C  chacun des trois codes visible en grand.
//  `SHOTS=dossier` garde les captures (regarde-les). Un banc ne meurt pas, il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const { ouvrir, base, srv, PORT, chromium } = P;
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-retraits-parfaits');
fs.mkdirSync(SHOTS, { recursive: true });
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 500) : '')); } return c; };

const J = 86400000;
const isoDans = (ms) => new Date(Date.now() + ms).toISOString();
function baseRP() {
  const b = base();
  const colis = (suivi, code, lieu, consigne) => ({ id: `email_track_mondialrelay_${suivi}`, data: { type: 'suivi', carrier: 'mondialrelay', suivi, status: 'available', statusLabel: 'Arrivé au point de retrait',
    subject: `Votre colis ${suivi} est disponible`, receivedAt: isoDans(-3 * 3600000), emailAt: isoDans(-3 * 3600000), arriveLe: isoDans(-3 * 3600000), code, code2: null, artTitle: `Paire test ${code.slice(0, 1)}`,
    lieu, limite: isoDans(4 * J).slice(0, 10), consigne, qrUrl: null, qrB64: null, account: '' } });
  b.rows.push(colis('87000001', '111111', 'INTERMARCHE TEST, ZA DU TEST, 11111 VILLETEST', false));
  b.rows.push(colis('87000002', '222222', 'INTERMARCHE TEST, ZA DU TEST, 11111 VILLETEST', false));
  b.rows.push(colis('87000003', '333333', 'LOCKER 24/7 INTERMARCHE TEST, ZA DU TEST, 11111 VILLETEST', true));
  return b;
}
const VUS = JSON.stringify({ v: 1, vus: { 'e:87000001': 'c', 'e:87000002': 'c' }, nouveaux: {} });

async function releve(pg) {
  return pg.evaluate(() => {
    // (20 nov.) Les colis à retirer sont des cartes par point (src/natif/RetraitsPoints.jsx, `data-rp-*`).
    const passes = [...document.querySelectorAll('[data-rp-point]')].map((p) => ({
      n: Number(p.getAttribute('data-rp-n')), sorte: p.getAttribute('data-rp-sorte') || '',
      sorteTexte: (p.querySelector('.n-rp-sorte') || { textContent: '' }).textContent.trim(),
      codes: [...p.querySelectorAll('[data-rp-code-grand]')].map((e) => e.textContent.trim()),
      nouveaux: [...p.querySelectorAll('[data-rp-colis]')].filter((f) => f.querySelector('[data-rp-nouveau]')).map((f) => f.getAttribute('data-rp-code')),
      lieu: (p.querySelector('.n-rp-nom') || { textContent: '' }).textContent.trim() }));
    const toasts = (window.__toasts || []).slice();
    return { passes, toasts };
  });
}
async function attendrePasses(pg, attendreNouveau = true) {
  let r = null;
  // Les passes arrivent avec les lectures ; « Nouveau » et le toast avec la liste publiée (un peu après) : on attend les deux.
  for (let k = 0; k < 40; k++) { r = await releve(pg); if (r.passes.some((p) => p.codes.includes('333333')) && (!attendreNouveau || r.passes.some((p) => p.nouveaux.length))) break; await pg.waitForTimeout(700); }
  return r;
}

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const b = baseRP();
  try {
    for (const W of [390, 1512]) {
      const { ctx, pg, erreurs, tel } = await ouvrir(nav, { W, sombre: false, b, url: '/?tab=achats' });
      await pg.addInitScript((v) => { try { localStorage.setItem('vrm_design_v2', '1'); localStorage.removeItem('vrm_banc_dom_ancien'); /* (20 nov.) l'écran d'aujourd'hui, pas l'échafaudage d'avant */ if (!sessionStorage.getItem('rp_init')) { localStorage.setItem('vrm_retraits_vus', v); sessionStorage.setItem('rp_init', '1'); } } catch (_) {}
        // Les toasts vus (ils partent seuls après quelques secondes) : notés au passage.
        window.__toasts = []; const obs = new MutationObserver(() => { for (const t of document.querySelectorAll('.vrm-toast')) { const x = t.textContent.trim(); if (x && !window.__toasts.includes(x)) window.__toasts.push(x); } });
        document.addEventListener('DOMContentLoaded', () => obs.observe(document.body, { childList: true, subtree: true })); }, VUS);
      await pg.reload({ waitUntil: 'domcontentloaded' });
      await pg.waitForSelector('.vrm-main', { timeout: 25000 }).catch(() => {});
      const r = await attendrePasses(pg);
      const magasin = r.passes.filter((p) => p.codes.some((c) => ['111111', '222222', '333333'].includes(c)));
      const casier = magasin.find((p) => p.codes.includes('333333')), comptoir = magasin.find((p) => p.codes.includes('111111'));
      dit(magasin.length === 2 && casier && comptoir && casier !== comptoir, `S ${W} : le casier et le comptoir du même magasin sont DEUX passes`, magasin);
      dit(!!casier && casier.sorte === 'consigne' && /Consigne · code à taper/.test(casier.sorteTexte) && casier.n === 1, `S ${W} : la passe du casier dit « Consigne · code à taper sur l’écran » (1 colis)`, casier);
      dit(!!comptoir && comptoir.sorte === 'comptoir' && /Comptoir/.test(comptoir.sorteTexte) && comptoir.n === 2 && comptoir.codes.includes('222222'), `S ${W} : la passe du comptoir dit « Comptoir », ses 2 codes visibles`, comptoir);
      dit(!!casier && casier.nouveaux.length === 1 && casier.nouveaux[0] === '333333' && !!comptoir && comptoir.nouveaux.length === 0, `N ${W} : seule la ligne du casier (nouvelle) porte « Nouveau »`, { casier: casier && casier.nouveaux, comptoir: comptoir && comptoir.nouveaux });
      dit(r.toasts.some((t) => /Nouveau code de retrait · Mondial Relay/.test(t)), `N ${W} : le toast « Nouveau code de retrait · Mondial Relay … »`, r.toasts);
      await pg.screenshot({ path: path.join(SHOTS, `retraits-${W}.png`), fullPage: false });
      const passe = pg.locator('[data-rp-point]', { has: pg.locator('[data-rp-code="333333"]') }).first();
      if (await passe.count()) await passe.screenshot({ path: path.join(SHOTS, `passe-casier-${W}.png`) }).catch(() => {});
      // Il ouvre la ligne : plus « Nouveau ».
      // (20 nov.) Il touche le code (en grand) : la ligne n'est plus « nouvelle » (« Je suis au point » retiré, sa décision).
      const btn = pg.locator('li[data-rp-colis][data-rp-code="333333"] [data-v2-en-grand]').first();
      if (await btn.count()) { if (tel) await btn.tap().catch(() => {}); else await btn.click().catch(() => {}); await pg.waitForTimeout(700); }
      await pg.keyboard.press('Escape').catch(() => {}); await pg.waitForTimeout(400);
      const apres = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_retraits_vus') || 'null'); } catch (_) { return null; } });
      dit(!!apres && !(apres.nouveaux && apres.nouveaux['e:87000003']), `N ${W} : ouverte, la ligne n’est plus « Nouveau »`, apres && apres.nouveaux);
      await pg.reload({ waitUntil: 'domcontentloaded' }); await pg.waitForSelector('.vrm-main', { timeout: 25000 }).catch(() => {});
      const r2 = await attendrePasses(pg, false); await pg.waitForTimeout(4000); r2.toasts = (await releve(pg)).toasts;
      dit(!r2.toasts.some((t) => /Nouveau/.test(t)) && r2.passes.every((p) => p.nouveaux.length === 0), `N ${W} : après rechargement, rien n’est réannoncé`, r2.toasts);
      dit(!erreurs.length, `${W} : aucune erreur de page`, erreurs);
      await ctx.close();
    }
  } catch (e) { ko++; console.log('  ❌ le banc s’est arrêté : ' + String(e && e.stack || e).slice(0, 1500)); }
  await nav.close(); srv.close();
  console.log(`\n${ko ? '❌' : '✅'} retraits-parfaits : ${ok} verts, ${ko} rouges — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
