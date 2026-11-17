require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  LA FRISE D'UNE VENTE ET LE TRANSPORTEUR (17 nov.) — Julien : « ça met livré il y a deux jours mais à côté la barre de
//  progression avance pas ». Règle : src/friseTransporteur.js (« le transporteur tranche », une preuve jamais retirée,
//  « Validé » à Vinted seul). Base INVENTÉE : une vente que Vinted dit « en cours d'acheminement », son bordereau (n° de
//  suivi), et la ligne du transporteur (`depart_…`) qui dit « livré au relais de l'acheteur » il y a 2 jours.
//  Mesure, sur l'écran RENDU, dans les DEUX designs (Ventes → En route) :
//    · éteint : les quatre étapes (`data-vv-etapes`) ont « Livré » fait, « Validé » pas fait ; la phrase du transporteur
//      sous la frise dit « Livré au relais » (la même source) ;
//    · allumé : la rangée est dans « Livrés », sa piste à 3 sur 4 (« Étape 3 sur 4 : Livré »), sa 3e ligne dit
//      « Livré au relais » ; la piste a la même boîte sur toutes les rangées.
//  Rouge sur main (la frise ne lit que Vinted) et par mutation (`MUTER=1` : le transporteur ne compte plus pour « Livré »).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
if (process.env.MUTER) {
  const src = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
  const dst = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-frise-'));
  fs.cpSync(src, dst, { recursive: true }); let n = 0;
  for (const f of fs.readdirSync(path.join(dst, 'assets'))) { const p = path.join(dst, 'assets', f); if (!/\.js$/.test(f)) continue;
    const t = fs.readFileSync(p, 'utf8'); const u = t.replace(/new Set\(\["disponible","retire","livre"\]\)/g, 'new Set([])').replace(/new Set\(\["available","delivered"\]\)/g, 'new Set([])'); if (u !== t) { n++; fs.writeFileSync(p, u); } }
  console.log(`MUTER : ${n} fichier(s) muté(s)`); if (!n) { console.log('  ❌ la mutation ne trouve pas son texte'); process.exit(2); }
  process.env.BANC_DIST = dst;
}
const P = require('./design-passe.cjs');
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-frise-transporteur');
fs.mkdirSync(SHOTS, { recursive: true });
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + JSON.stringify(d).slice(0, 400) : '')); } return c; };
const attendre = async (pg, f, ms = 30000, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await pg.evaluate(f, arg).catch(() => false)) return true; await pg.waitForTimeout(400); } return false; };

function baseFrise() {
  const b = P.base();
  const bords = new Set(b.rows.filter((r) => /^email_bord_/.test(r.id)).map((r) => String(r.data.transaction)));
  let cible = null;
  for (const r of b.rows.filter((x) => /_orders_sold$/.test(x.id))) for (const o of r.data.payload.my_orders || []) if (!cible && o && /achemin/i.test(String(o.status || '')) && bords.has(String(o.transaction_id))) cible = o;
  if (!cible) return { b, tx: null };
  const tx = String(cible.transaction_id); const bord = b.rows.find((r) => r.id === 'email_bord_' + tx); const su = String(bord.data.suivi || ('XW' + tx));
  const il2j = new Date(Date.now() - 2 * 86400e3 - 3600e3).toISOString();
  b.rows.push({ id: 'depart_chronopost_' + su, data: { suivi: su, carrier: 'chronopost', etat: 'disponible', etatAt: il2j, derAt: il2j, lu: new Date(Date.now() - 600e3).toISOString(), lieuNom: 'CONSIGNE CARREFOUR', lieuVille: 'SALIES DE BEARN', derLib: 'Livré au relais' } });
  return { b, tx };
}

(async () => {
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const { b, tx } = baseFrise();
  dit(!!tx, `la base porte une vente « en cours d'acheminement » chez Vinted, livrée au relais d'après le transporteur (tx ${tx})`);
  try {
    for (const [W, sombre] of [[390, false], [390, true], [1512, false], [1512, true]]) {
      const th = `${W}-${sombre ? 'sombre' : 'clair'}`;
      // ÉTEINT
      { const { ctx, pg, erreurs } = await P.ouvrir(nav, { W, sombre, b, url: '/?tab=ventes', dsf: W < 600 ? 2 : 1 });
        await attendre(pg, () => !!document.querySelector('[data-ventes-seg-choix="envoyes"]'));
        await pg.locator('[data-ventes-seg-choix="envoyes"]').first().click({ timeout: 8000 }).catch(() => {});
        const vu = await attendre(pg, (tx) => !!document.querySelector(`[data-vv-etapes="v:${tx}"]`), 30000, tx);
        await pg.waitForTimeout(2500);
        const r = await pg.evaluate((tx) => { const e = document.querySelector(`[data-vv-etapes="v:${tx}"]`); const c = e && e.closest('[data-colis-envoye]');
          if (c) c.scrollIntoView({ block: 'center' });
          const f = (k) => (e && e.querySelector(`[data-etape="${k}"]`) || { getAttribute: () => null }).getAttribute('data-fait');
          return { livre: f('livre'), valide: f('valide'), phrase: c ? /Livré au relais/.test(c.textContent) : null }; }, tx);
        dit(vu && r.livre === '1' && r.valide === '0', `éteint ${th} : la frise dit « Livré » (le transporteur tranche), « Validé » reste à Vinted`, r);
        dit(r.phrase === true, `éteint ${th} : la phrase sous la frise dit « Livré au relais » (même source)`, r);
        await pg.waitForTimeout(300); await pg.screenshot({ path: path.join(SHOTS, `frise-eteint-${th}.png`) });
        dit(!erreurs.length, `éteint ${th} : aucune erreur JS`, erreurs); await ctx.close(); }
      // ALLUMÉ
      { const { ctx, pg, erreurs } = await P.ouvrir(nav, { W, sombre, b, url: '/?tab=ventes', dsf: W < 600 ? 2 : 1 });
        await pg.waitForSelector('.vrm-main', { timeout: 30000 }).catch(() => {});
        await pg.evaluate(() => localStorage.setItem('vrm_design_v2', '1')); await pg.reload({ waitUntil: 'domcontentloaded' });
        await attendre(pg, () => !!document.querySelector('[data-v2v-seg="envoyes"]'));
        await pg.locator('[data-v2v-seg="envoyes"]').first().click({ timeout: 8000 }).catch(() => {});
        const vu = await attendre(pg, (tx) => !!document.querySelector(`[data-v2v-ligne="v:${tx}"]`), 30000, tx);
        await pg.waitForTimeout(2500);
        const r = await pg.evaluate((tx) => { const l = document.querySelector(`[data-v2v-ligne="v:${tx}"]`); if (l) l.scrollIntoView({ block: 'center' });
          const p = l && l.querySelector('.v2-piste'); const pistes = [...document.querySelectorAll('[data-v2v-liste="route"] .v2-piste')].map((x) => { const q = x.getBoundingClientRect(); return Math.round(q.width) + 'x' + Math.round(q.height); });
          const t3 = l && l.querySelector('[data-v2l-l3="etape"]'); const q3 = t3 && t3.getBoundingClientRect();
          return { groupe: l && l.getAttribute('data-v2v-groupe'), n: p && p.getAttribute('data-v2-piste'), aria: p && p.getAttribute('aria-label'), mot: t3 ? t3.textContent.trim() : '',
            unique: [...new Set(pistes)], uneLigne: q3 ? q3.height <= 20 : null }; }, tx);
        dit(vu && r.groupe === 'livre' && r.n === '3' && /3 sur 4/.test(r.aria || ''), `allumé ${th} : la rangée est dans « Livrés », sa piste à 3 sur 4 (« ${r.aria} »)`, r);
        dit(/Livré au relais/.test(r.mot), `allumé ${th} : à côté de la piste, l'étape en mots et sa date, de la même source que le transporteur (« ${r.mot} »)`, r);
        dit(r.unique.length === 1 && r.uneLigne === true, `allumé ${th} : la piste a la même boîte sur chaque rangée (${r.unique.join(', ')}) et tient sur une ligne`, r);
        await pg.waitForTimeout(300); await pg.screenshot({ path: path.join(SHOTS, `frise-allume-${th}.png`) });
        dit(!erreurs.length, `allumé ${th} : aucune erreur JS`, erreurs); await ctx.close(); }
    }
  } catch (e) { ko++; console.log('  ❌ le banc s’est arrêté : ' + String(e && e.stack || e).slice(0, 1200)); }
  await nav.close(); P.srv.close();
  console.log(`\n${ko ? '❌' : '✅'} frise-transporteur : ${ok} verts, ${ko} rouges — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
