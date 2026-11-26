require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  LA FRISE D'UNE VENTE ET LE TRANSPORTEUR (17 nov.) — Julien : « ça met livré il y a deux jours mais à côté la barre de
//  progression avance pas ». Règle : src/friseTransporteur.js (« le transporteur tranche », une preuve jamais retirée,
//  « Validé » à Vinted seul). Base INVENTÉE : une vente que Vinted dit « en cours d'acheminement », son bordereau (n° de
//  suivi), et la ligne du transporteur (`depart_…`) qui dit « livré au relais de l'acheteur » il y a 2 jours.
//  Mesure, sur l'écran RENDU (Ventes → En route ; depuis le 20 nov. la fiche native, `data-vn-*`) :
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
  // Vinted ne dit « livré » NULLE PART pour cette vente (ni la commande, ni le détail de transaction, `shipment.status_title`) :
  // seul le transporteur le prouve (sinon la mutation ne mesurerait rien).
  for (const r of b.rows.filter((x) => new RegExp('_txn_' + tx + '$').test(x.id))) { const t = r.data && r.data.payload && r.data.payload.transaction; if (t && t.shipment) t.shipment.status_title = "Colis en cours d'acheminement"; }
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
      // (20 nov., chasse-bugs-2) « VRM natif » (19 nov.) est le seul design : Ventes → « En route », la rangée et sa fiche
      // (src/natif/ecrans/Ventes.jsx : `data-vn-route`, `data-vn-etape` = étapes faites, `data-vn-etapes` / `data-etape`).
      const { ctx, pg, erreurs } = await P.ouvrir(nav, { W, sombre, b, url: '/?tab=ventes', dsf: W < 600 ? 2 : 1 });
      await pg.waitForSelector('.vrm-main', { timeout: 30000 }).catch(() => {});
      await attendre(pg, () => [...document.querySelectorAll('button, [role="radio"], [role="tab"]')].some((x) => /^En route/.test((x.textContent || '').trim())));
      await pg.locator('button, [role="radio"], [role="tab"]').filter({ hasText: /^En route/ }).first().click({ timeout: 8000 }).catch(() => {});
      const vu = await attendre(pg, (tx) => !!document.querySelector(`[data-vn-route$="${tx}"]`), 30000, tx);
      await pg.waitForTimeout(1500);
      const r = await pg.evaluate((tx) => { const l = document.querySelector(`[data-vn-route$="${tx}"]`); if (l) l.scrollIntoView({ block: 'center' });
        return { n: l && l.getAttribute('data-vn-etape'), texte: l ? l.textContent.replace(/\s+/g, ' ') : '' }; }, tx);
      dit(vu && r.n === '3' && /Livré/.test(r.texte), `${th} : la rangée « En route » est à « Livré » (3 étapes faites sur 4), le transporteur tranche`, r);
      // Aucune rangée ne dit « Livré » à côté d'étapes restées avant « livré » (la phrase et les étapes lisent les mêmes preuves).
      const contra = await pg.evaluate(() => [...document.querySelectorAll('[data-vn-route]')].map((l) => ({ cle: l.getAttribute('data-vn-route'), n: Number(l.getAttribute('data-vn-etape')), t: (l.textContent || '').replace(/\s+/g, ' ') }))
        .filter((x) => /\bLivr[ée]/.test(x.t) && !/non\s+livr/i.test(x.t) && !(x.n >= 3)));
      dit(!contra.length, `${th} : aucune rangée ne dit « Livré » à côté d'étapes avant « livré » (${contra.length})`, contra.slice(0, 4));
      await pg.locator(`[data-vn-route$="${tx}"]`).first().click({ timeout: 6000 }).catch(() => {});
      // (24 nov., lot suivi-ventes) Un colis PARTI : la fiche porte la piste de l'envoi (`data-vn-parcours`, src/SuiviEnvoi.jsx) à la
      // place des quatre étapes — « Livré » y est « Au point » ou « Retiré » (lus chez le transporteur), « Validé » l'argent (Vinted seul).
      const vuF = await attendre(pg, (tx) => !!document.querySelector(`[data-vn-etapes$="${tx}"], [data-vn-parcours$="${tx}"]`), 15000, tx);
      const f = await pg.evaluate((tx) => { const pc = document.querySelector(`[data-vn-parcours$="${tx}"]`);
        if (pc) { const g = (k) => ((pc.querySelector(`[data-envoi-etape="${k}"]`) || { getAttribute: () => null }).getAttribute('data-envoi-etat') === 'fait' ? '1' : '0');
          return { livre: g('aupoint') === '1' || g('retire') === '1' ? '1' : '0', valide: g('argent'), depose: g('depose') === '1' || g('enroute') === '1' ? '1' : '0', piste: 1 }; }
        const e = document.querySelector(`[data-vn-etapes$="${tx}"]`); const g = (k) => (e && e.querySelector(`[data-etape="${k}"]`) || { getAttribute: () => null }).getAttribute('data-fait');
        return { livre: g('livre'), valide: g('valide'), depose: g('depose') }; }, tx);
      dit(vuF && f.livre === '1' && f.depose === '1' && f.valide === '0', `${th} : la fiche dit « Livré » (et donc « Déposé »), « Validé » reste à Vinted`, f);
      await pg.waitForTimeout(300); await pg.screenshot({ path: path.join(SHOTS, `frise-natif-${th}.png`) });
      dit(!erreurs.length, `${th} : aucune erreur JS`, erreurs); await ctx.close();
    }
  } catch (e) { ko++; console.log('  ❌ le banc s’est arrêté : ' + String(e && e.stack || e).slice(0, 1200)); }
  await nav.close(); P.srv.close();
  console.log(`\n${ko ? '❌' : '✅'} frise-transporteur : ${ok} verts, ${ko} rouges — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
