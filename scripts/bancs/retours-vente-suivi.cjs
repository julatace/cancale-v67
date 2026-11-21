require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  VENTES · LE SUIVI DES RETOURS (21 nov., lot 77) — l'écran RENDU, base INVENTÉE (design-passe + 4 retours).
//  Sur le 1er compte, 4 ventes en retour (transaction 440) :
//    A  en transit : ligne `harvest_{uid}_retour_{tx}` (n° 85000001, « pris en charge » après le début du retour) ;
//    B  au point : n° 85000002 + e-mail Mondial Relay « disponible » du MÊME n° (code 482913, point « Tabac du Port ») ;
//    C  arrivé : n° 85000003 + e-mail « retiré » du même n° ⇒ revenu en stock sous SON N° 403, « Remettre en ligne » ;
//    D  initié, rien lu ⇒ « suivi pas encore lu » (jamais « arrivé »).
//  Mesure (Ventes, « En route », groupe « Retours et litiges » ouvert ; Achats › À retirer) :
//    S  « Retours en route · 2 » à côté du titre ; A dit son n° et « En transit » ; B « Au point relais », son code ;
//       D « suivi pas encore lu » ; C remis sous le N° 403, preuve e-mail, geste « Remettre en ligne » ;
//    F  téléphone : toucher B ⇒ la feuille dit la frise (Retour accepté · Expédié par l'acheteur · En transit · Arrivé
//       au point) et le code ;
//    R  Achats › À retirer : la rangée « Retours en route · 2 » et la carte du colis B dite « Retour de ta vente · N°402 ».
//  `BANC_DIST=…` juge un autre build (rouge attendu sur le code d'avant). `SHOTS=dossier` garde les captures (DSF 2).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const P = require('./design-passe.cjs');
const { ouvrir, base, srv, PORT, chromium } = P;
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-retours-vente-suivi');
fs.mkdirSync(SHOTS, { recursive: true });
const DSF = process.env.SHOTS ? 2 : 1;
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARG = liste('VUES', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 600) : '')); } return c; };
const attendre = async (pg, f, ms = 30000, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await pg.evaluate(f, arg).catch(() => false)) return true; await pg.waitForTimeout(300); } return false; };
const sansToasts = async (pg) => { await pg.evaluate(() => { for (const t of document.querySelectorAll('.vrm-toast')) t.click(); }).catch(() => {}); await pg.waitForTimeout(300); };

const J = 864e5, ISO = (j) => new Date(Date.now() - j * J).toISOString();
const TX = { A: 22950000001, B: 22950000002, C: 22950000003, D: 22950000004 };
function baseSuivi() {
  const b = base();
  const a0 = b.accounts[0], uid = a0.vinted_user_id;
  const sold = b.rows.find((r) => r.id === `harvest_${uid}_orders_sold`);
  const ov = b.main[0].data.vinted_sale_overrides = b.main[0].data.vinted_sale_overrides || {};
  const TIT = { A: 'Nike Dunk Low Panda taille 42', B: 'Adidas Samba OG blanches taille 40', C: 'Asics Gel-Kayano 14 argent taille 43', D: 'New Balance 550 crème taille 41' };
  const N = { A: '401', B: '402', C: '403', D: '404' };
  const nouvelles = [];
  for (const k of Object.keys(TX)) {
    const t = TX[k], it = 7950000000 + (t % 100);
    nouvelles.push({ transaction_id: t, title: TIT[k], price: { amount: '55.0', currency_code: 'EUR' }, status: 'Retour initié', date: ISO(12), item_id: it,
      transaction_user_status: 'waiting', photo: { url: `https://images1.vinted.net/t/${it}/f800/r.jpeg?s=abc` }, user_login: 'acheteuse_' + k, conversation_id: 18950000000 + (t % 100) });
    b.rows.push({ id: `harvest_${uid}_txn_${t}`, data: { capturedAt: ISO(0.1), payload: { transaction: { id: t, item_id: it, status: 440, status_title: 'Retour initié', status_updated_at: ISO(5), user_side: 'seller',
      shipment: { status_title: k === 'D' ? 'Bordereau envoyé au vendeur' : 'La livraison n\'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais' }, item: { id: it, title: TIT[k] } } } } });
    ov[String(t)] = { ...(ov[String(t)] || {}), numero: N[k] };
    if (k !== 'D') b.rows.push({ id: `harvest_${uid}_retour_${t}`, data: { v: 1, tx: String(t), sens: 'retour', capturedAt: ISO(0.2), suivi: '8500000' + { A: 1, B: 2, C: 3 }[k], transporteur: 'Mondial Relay',
      etapes: [{ t: 'Colis pris en charge par Mondial Relay', at: ISO(3) }], dernier: { t: 'Colis pris en charge par Mondial Relay', at: ISO(3) }, n: 1 } });
  }
  b.rows.push({ id: 'email_track_mondialrelay_85000002', data: { type: 'suivi', carrier: 'mondialrelay', suivi: '85000002', status: 'available', statusLabel: 'Arrivé au point de retrait',
    subject: 'Votre colis 85000002 est disponible', receivedAt: ISO(0.5), emailAt: ISO(0.5), code: '482913', lieu: 'Tabac du Port\n3 quai Duguay-Trouin\n35400 Saint-Malo', limite: new Date(Date.now() + 6 * J).toISOString().slice(0, 10), account: a0.login || '' } });
  b.rows.push({ id: 'email_track_mondialrelay_85000003', data: { type: 'suivi', carrier: 'mondialrelay', suivi: '85000003', status: 'delivered', statusLabel: 'Livré / retiré',
    subject: 'Votre colis 85000003 a été retiré', receivedAt: ISO(0.3), emailAt: ISO(0.3), retireLe: ISO(0.3), account: a0.login || '' } });
  sold.data.payload.my_orders = [...nouvelles, ...sold.data.payload.my_orders];
  sold.data.nItems = sold.data.payload.my_orders.length;
  return b;
}

function mesure(TX) {
  const vis = (e) => { if (!e || !e.getClientRects().length) return false; const cs = getComputedStyle(e); return cs.visibility !== 'hidden' && Number(cs.opacity) > 0; };
  const rang = (tx) => { const r = [...document.querySelectorAll(`[data-retour="${tx}"]`)].find(vis); if (!r) return null;
    const et = r.querySelector('[data-vr-etape], .n-pastille'); const sous = r.querySelector('.n-tt-article-sous, .n-rangee-sous');
    const g = [...r.querySelectorAll('[data-vr-geste]')].find(vis);
    return { suivi: r.getAttribute('data-retour-suivi'), etat: r.getAttribute('data-retour-suivi-etat'), colis: r.getAttribute('data-retour-colis'), code: r.getAttribute('data-retour-code'), num: r.getAttribute('data-retour-num'),
      preuve: r.getAttribute('data-retour-preuve'), etape: et ? et.textContent.trim() : '', sous: sous ? sous.textContent.trim() : '', geste: g ? g.textContent.trim() : '' }; };
  const er = document.querySelector('[data-vr-enroute]');
  return { enRoute: er && vis(er) ? Number(er.getAttribute('data-vr-enroute')) : null, enRouteTexte: er ? er.textContent.trim() : '', A: rang(TX.A), B: rang(TX.B), C: rang(TX.C), D: rang(TX.D),
    deborde: document.documentElement.scrollWidth - innerWidth };
}

async function ouvrirVentes(nav, { W, sombre, b }) {
  const { ctx, pg, erreurs } = await ouvrir(nav, { W, sombre, b, url: '/?tab=ventes', dsf: DSF });
  await pg.waitForSelector('.vrm-main', { timeout: 30000 }).catch(() => {});
  await attendre(pg, () => !!document.querySelector('[data-vn="ventes"]') && !!document.querySelector('[data-vn="ventes"] [data-tt-ligne], [data-vn-liste] [data-vn-rang]'), 40000);
  await pg.waitForTimeout(2000); await sansToasts(pg);
  return { ctx, pg, erreurs };
}
const segment = async (pg, i) => { await pg.locator('[data-vn="ventes"] .n-segmente button, [data-vn="ventes"] .n-segmente [role="tab"], .n-vt-segment .n-segmente button').nth(i).click({ timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(1500); };

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] }).catch(() => chromium.launch({ args: ['--no-sandbox'] }));
  const b = baseSuivi();
  const T = Object.fromEntries(Object.entries(TX).map(([k, v]) => [k, String(v)]));
  try {
    for (const W of LARG) for (const th of THEMES) {
      const tel = W < 600, sombre = th === 'sombre';
      console.log(`\n── Ventes · suivi des retours · ${W} · ${th}`);
      const { ctx, pg, erreurs } = await ouvrirVentes(nav, { W, sombre, b });
      await segment(pg, 1);
      if (tel) { await pg.locator('[data-vn-acces-ouvrir]').first().click({ timeout: 5000 }).catch(() => {}); await pg.waitForTimeout(800); }
      else { const replie = await pg.evaluate(() => (document.querySelector('[data-vr-groupe]') || {}).getAttribute && document.querySelector('[data-vr-groupe]').getAttribute('data-vr-groupe'));
        if (replie === 'replie') await pg.locator('[data-vr-groupe] .n-groupe-repli').first().click({ timeout: 5000 }).catch(() => {}); await pg.waitForTimeout(700); }
      await attendre(pg, (T) => !!document.querySelector(`[data-retour="${T.A}"][data-retour-suivi]`), 15000, T);
      await pg.evaluate(() => { const g = document.querySelector('[data-vr-groupe]'); if (g) g.scrollIntoView({ block: 'start' }); });
      await pg.waitForTimeout(500);
      const m = await pg.evaluate(mesure, T);
      await pg.screenshot({ path: path.join(SHOTS, `retours-suivi-${W}-${th}.png`) });
      dit(m.enRoute === 2 && /Retours en route · 2/.test(m.enRouteTexte), `S « Retours en route · 2 » (${m.enRoute} · « ${m.enRouteTexte} »)`);
      dit(m.A && m.A.suivi === '85000001' && m.A.colis === 'transit' && /En transit/.test(m.A.etape) && /85000001/.test(m.A.sous), `S A : n° 85000001 et « En transit »`, m.A);
      dit(m.B && m.B.colis === 'point' && m.B.code === '482913' && /point relais/i.test(m.B.etape) && /482913/.test(m.B.sous), `S B : « Au point relais », code LU 482913`, m.B);
      dit(m.D && m.D.etat === 'pas-lu' && /suivi pas encore lu/.test(m.D.sous) && !m.D.preuve, `S D : « suivi pas encore lu », jamais arrivé`, m.D);
      dit(m.C && m.C.num === '403' && m.C.preuve === 'email' && (tel || /Remettre en ligne/.test(m.C.geste)) && /arrivé selon le suivi/.test(m.C.sous), `S C : revenu sous SON N° 403 (preuve e-mail), « Remettre en ligne »`, m.C);
      dit(m.deborde <= 1, `rien ne déborde (${m.deborde})`);
      if (tel) {
        await pg.locator(`[data-retour="${T.B}"]`).first().click({ timeout: 5000 }).catch(() => {});
        await pg.waitForTimeout(800);
        const f = await pg.evaluate(() => { const fr = [...document.querySelectorAll('[data-vr-frise] [data-vr-frise-etape]')].map((e) => ({ k: e.getAttribute('data-vr-frise-etape'), f: e.getAttribute('data-fait'), t: e.textContent.trim() }));
          const c = document.querySelector('[data-vr-colis-code]'); return { fr, code: c ? c.getAttribute('data-vr-colis-code') : null, gestes: [...document.querySelectorAll('[data-vr-gestes] [data-vr-geste]')].map((e) => e.getAttribute('data-vr-geste')) }; });
        await pg.screenshot({ path: path.join(SHOTS, `retours-suivi-${W}-${th}-feuille.png`) });
        dit(f.fr.length === 4 && f.fr.map((x) => x.t).join(' · ') === 'Retour accepté · Expédié par l’acheteur · En transit · Arrivé au point' && f.fr.every((x) => x.f === '1') && f.code === '482913',
          `F la feuille de B : frise et code (${f.fr.map((x) => x.t + ':' + x.f).join(' · ')} · ${f.code})`, f);
        await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
        await pg.locator(`[data-retour="${T.D}"]`).first().click({ timeout: 5000 }).catch(() => {});
        await pg.waitForTimeout(700);
        const fd = await pg.evaluate(() => ({ fr: [...document.querySelectorAll('[data-vr-frise] [data-vr-frise-etape]')].map((e) => e.getAttribute('data-fait')).join(''), su: (document.querySelector('[data-vr-colis-suivi]') || {}).textContent || '' }));
        await pg.screenshot({ path: path.join(SHOTS, `retours-suivi-${W}-${th}-feuille-d.png`) });
        dit(fd.fr === '1000' && /suivi pas encore lu/.test(fd.su), `F la feuille de D : seul « Retour accepté », suivi pas encore lu (${fd.fr})`, fd);
      }
      dit(!erreurs.length, 'aucune erreur de page', erreurs.slice(0, 3));
      await ctx.close();
      // R — Achats › À retirer
      const o = await ouvrir(nav, { W, sombre, b, url: '/?tab=achats', dsf: DSF });
      await o.pg.addInitScript(() => { try { localStorage.setItem('vrm_design_v2', '1'); } catch (_) {} });
      await o.pg.reload({ waitUntil: 'domcontentloaded' });
      await o.pg.waitForSelector('.vrm-main', { timeout: 30000 }).catch(() => {});
      await attendre(o.pg, () => !!document.querySelector('[data-achats-retours-route]') || !!document.querySelector('[data-rp-contenu="retour"]'), 40000);
      await o.pg.waitForTimeout(1500); await sansToasts(o.pg);
      const r = await o.pg.evaluate((T) => { const z = document.querySelector('[data-achats-retours-route]'); const c = document.querySelector('[data-rp-contenu="retour"]');
        const carte = c ? c.closest('[data-rp-colis]') : null;
        return { n: z ? z.getAttribute('data-achats-retours-route') : null, point: z ? z.getAttribute('data-achats-retours-point') : null, tx: c ? c.getAttribute('data-rp-contenu-tx') : null,
          texte: c ? c.textContent.replace(/\s+/g, ' ').trim() : '', code: carte ? carte.getAttribute('data-rp-code') : null }; }, T);
      await o.pg.evaluate(() => { const z = document.querySelector('[data-achats-retours-route]'); if (z) z.scrollIntoView({ block: 'start' }); });
      await o.pg.waitForTimeout(400);
      await o.pg.screenshot({ path: path.join(SHOTS, `achats-retirer-${W}-${th}.png`) });
      dit(r.n === '2' && r.point === '1', `R Achats › À retirer : « Retours en route · 2 » (1 au point)`, r);
      dit(r.tx === T.B && /Retour de ta vente · N°402/.test(r.texte) && r.code === '482913', `R la carte du colis B : « Retour de ta vente · N°402 », code 482913`, r);
      dit(!o.erreurs.length, 'Achats : aucune erreur de page', o.erreurs.slice(0, 3));
      await o.ctx.close();
    }
  } catch (e) { dit(false, 'le banc a rencontré une erreur', String(e && e.stack || e)); }
  await nav.close(); srv.close();
  console.log(`\n${ok} vert(s), ${ko} rouge(s) — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
