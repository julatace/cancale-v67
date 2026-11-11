require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « ME LE RAPPELER » (11 nov.) — l'app RENDUE, données INVENTÉES (le jeu
//  de `nouveau-vendeur.cjs`), 390 px tactile ET 1512 px, clair ET sombre. Jugé
//  sur des `data-*`, le localStorage et la base du banc (jamais un libellé seul).
//   J. Ma journée : la carte « Rappels du jour » (du jour + en retard, pas ceux à
//      venir, le plus ancien d'abord) ; « Fait » ; « Reporter » (feuille ⇒ 3 jours) ;
//      l'écriture part vers la base ; 44 px au doigt.
//   V. La fiche d'une vente : « Me le rappeler » ⇒ la feuille (quand + note
//      rapide) ⇒ « Enregistrer » pose le rappel PAR n° de transaction ; le bouton
//      dit ensuite « Rappel <jour> ».
//   N. L'adresse d'une notification : `?tab=journee&num=5&rappel=…` sur une
//      annonce VENDUE entre-temps ⇒ le bandeau le dit (pas un écran vide) ;
//      `?tab=ventes&cible=vente&tx=…&rappel=…` ⇒ Ventes + le bandeau.
//   P. Paramètres → Rappels : aujourd'hui, à venir.
//  Aucune erreur JS, aucune requête 4xx/5xx non voulue. `SHOTS=dossier` : une
//  capture par étape (à REGARDER, §6.2). `PARTIES=J,V,N,P`.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const NV = require('./nouveau-vendeur.cjs');
const SHOTS = process.env.SHOTS || '';
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const PARTIES = liste('PARTIES', 'J,V,N,P');
let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det !== undefined ? ' — ' + String(det).slice(0, 300) : ''}`); };
const capture = async (pg, nom) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }).catch(() => {}); };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const jourP = (dec = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + dec * 86400e3));
const ajout = (jour, n) => { const [y, m, d] = jour.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n, 12)).toISOString().slice(0, 10); };
const AUJ = jourP(0);
const R = (id, o) => ({ id, creeAt: new Date(Date.now() - 3 * 86400e3).toISOString(), majAt: new Date(Date.now() - 3 * 86400e3).toISOString(), etat: 'actif', ...o });
const rA = R('rbancA0001', { sorte: 'article', num: '1', item: '51000', jour: AUJ, note: 'Rebaisser le prix' });
const rV = R('rbancV0001', { sorte: 'vente', tx: '62001', num: '2', plat: 'vinted', jour: ajout(AUJ, -1), note: 'Relancer l’acheteur' });
const rF = R('rbancF0001', { sorte: 'article', num: '3', jour: ajout(AUJ, 5) });
const rX = R('rbancX0001', { sorte: 'article', num: '5', item: '51004', jour: AUJ, note: 'Republier' });
const base = (main = {}) => {
  const lignes = JSON.parse(JSON.stringify(NV.JEU_LIGNES));
  const m = lignes.find((l) => l.id === 'main'); Object.assign(m.data, JSON.parse(JSON.stringify(main)));
  return { lignes, comptes: NV.JEU_COMPTES, ecritures: 0 };
};
// La pilule « Annuler » (5 s) se pose en bas : comme lui, on attend qu'elle parte avant le toucher suivant.
const sansPilule = async (pg) => { for (let i = 0; i < 30; i++) { if (!(await pg.$('[data-pilule]'))) return; await attendre(300); } };
const lireLocal = (pg) => pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_rappels') || '{}'); } catch (_) { return null; } });
const sansErreur = (journal, quoi) => dit(!journal.erreurs.length && !journal.http.length, `${quoi} : aucune erreur JS ni requête en échec`, JSON.stringify({ e: journal.erreurs, h: journal.http }));

(async () => {
  await new Promise((ok) => NV.srv.listen(NV.PORT, ok));
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const W of LARGEURS) for (const theme of THEMES) {
      const sombre = theme === 'sombre', tag = `${W}-${theme}`;
      // ── J. Ma journée ─────────────────────────────────────────────────────
      if (PARTIES.includes('J')) {
        const b = base({ vrm_rappels: { [rA.id]: rA, [rV.id]: rV, [rF.id]: rF } });
        const { ctx, pg, journal, tel } = await NV.ouvrir(nav, { W, sombre, base: b, tab: 'journee' });
        await pg.waitForSelector('[data-rappels-jour]', { timeout: 15000 }).catch(() => {});
        const c = await pg.evaluate(() => { const s = document.querySelector('[data-rappels-jour]'); return s ? { n: s.getAttribute('data-rappels-jour'), ids: [...s.querySelectorAll('[data-rappel]')].map((l) => l.getAttribute('data-rappel')), gestes: [...s.querySelectorAll('.vrm-rp-geste,.vrm-rp-ouvrir')].map((x) => Math.round(x.getBoundingClientRect().height)), deborde: document.documentElement.scrollWidth > innerWidth + 1 } : null; });
        dit(c && c.n === '2' && c.ids.join() === 'rbancV0001,rbancA0001', `J ${tag} : « Rappels du jour » = le rappel en retard puis celui du jour (pas celui à venir)`, JSON.stringify(c));
        if (tel) dit(c && c.gestes.every((h) => h >= 44), `J ${tag} : 44 px au doigt`, JSON.stringify(c && c.gestes));
        dit(c && !c.deborde, `J ${tag} : rien ne déborde à l'horizontale`);
        await pg.locator('#vrm-rappels-jour').scrollIntoViewIfNeeded().catch(() => {});
        await capture(pg, `J-${tag}-carte`);
        await pg.click(`[data-rappel-fait="${rA.id}"]`);
        await attendre(700);
        let loc = await lireLocal(pg);
        const n1 = await pg.evaluate(() => (document.querySelector('[data-rappels-jour]') || { getAttribute: () => '0' }).getAttribute('data-rappels-jour'));
        dit(loc && loc[rA.id] && loc[rA.id].etat === 'fait' && loc[rA.id].faitAt && n1 === '1', `J ${tag} : « Fait » le range (état fait, daté), la carte n'en garde qu'un`, JSON.stringify({ e: loc && loc[rA.id], n1 }));
        await sansPilule(pg);
        await pg.click(`[data-rappel-reporter="${rV.id}"]`);
        await pg.waitForSelector('[data-rappel-feuille="reporter"]', { timeout: 5000 }).catch(() => {});
        await capture(pg, `J-${tag}-reporter`);
        await pg.click('[data-rappel-choix="3j"]').catch(() => {});
        await pg.click('[data-rappel-enregistrer]').catch((e) => dit(false, `J ${tag} : « Reporter » se touche`, e.message.split('\n')[0]));
        await attendre(900);
        loc = await lireLocal(pg);
        const vide = await pg.evaluate(() => !document.querySelector('[data-rappels-jour]'));
        dit(loc && loc[rV.id] && loc[rV.id].jour === ajout(AUJ, 3) && loc[rV.id].reports === 1 && loc[rV.id].etat === 'actif' && vide, `J ${tag} : « Reporter » ⇒ dans 3 jours ; la carte disparaît (plus rien aujourd'hui)`, JSON.stringify({ r: loc && loc[rV.id], vide }));
        for (let i = 0; i < 20; i++) { const m = b.lignes.find((l) => l.id === 'main'); if (m && m.data.vrm_rappels && m.data.vrm_rappels[rV.id] && m.data.vrm_rappels[rV.id].reports === 1) break; await attendre(500); }
        const enBase = (b.lignes.find((l) => l.id === 'main') || {}).data || {};
        dit(enBase.vrm_rappels && enBase.vrm_rappels[rV.id] && enBase.vrm_rappels[rV.id].jour === ajout(AUJ, 3) && enBase.vrm_rappels[rA.id].etat === 'fait' && enBase.vrm_rappels[rF.id], `J ${tag} : l'écriture part vers la base (synchronisée par compte), rien d'autre de perdu`, JSON.stringify(enBase.vrm_rappels || null).slice(0, 200));
        sansErreur(journal, `J ${tag}`);
        await ctx.close();
      }
      // ── V. La fiche d'une vente ───────────────────────────────────────────
      if (PARTIES.includes('V')) {
        const b = base();
        const { ctx, pg, journal } = await NV.ouvrir(nav, { W, sombre, base: b, tab: 'ventes' });
        await pg.waitForSelector('[data-tx="62001"] .vrm-ledger-sale-toggle', { timeout: 15000 }).catch(() => {});
        await pg.click('[data-tx="62001"] .vrm-ledger-sale-toggle').catch((e) => dit(false, `V ${tag} : la vente 62001 s'ouvre`, e.message.split('\n')[0]));
        await pg.waitForSelector('[data-recap-vente] [data-rappel-bouton]', { timeout: 8000 }).catch(() => {});
        const bouton = await pg.evaluate(() => { const x = document.querySelector('[data-recap-vente] [data-rappel-bouton]'); return x ? { etat: x.getAttribute('data-rappel-bouton'), h: Math.round(x.getBoundingClientRect().height) } : null; });
        dit(bouton && bouton.etat === 'neuf', `V ${tag} : la fiche de la vente porte « Me le rappeler »`, JSON.stringify(bouton));
        await pg.click('[data-recap-vente] [data-rappel-bouton]').catch(() => {});
        await pg.waitForSelector('[data-rappel-feuille="creer"]', { timeout: 5000 }).catch(() => {});
        await pg.click('[data-rappel-choix="7j"]').catch(() => {});
        await pg.click('[data-rappel-rapide="Vérifier le colis"]').catch((e) => dit(false, `V ${tag} : une note rapide se touche`, e.message.split('\n')[0]));
        const f = await pg.evaluate(() => ({ note: (document.querySelector('[data-rappel-note]') || {}).value, jour: (document.querySelector('[data-rappel-jour]') || { getAttribute: () => '' }).getAttribute('data-rappel-jour'), deborde: document.documentElement.scrollWidth > innerWidth + 1 }));
        dit(f.note === 'Vérifier le colis' && f.jour === ajout(AUJ, 7) && !f.deborde, `V ${tag} : la feuille : « Dans 7 jours » + la note rapide`, JSON.stringify(f));
        await capture(pg, `V-${tag}-feuille`);
        const ecrAvant = b.ecritures;
        await pg.click('[data-rappel-enregistrer]');
        await attendre(900);
        const loc = await lireLocal(pg);
        const poses = Object.values(loc || {}).filter((r) => r && r.sorte === 'vente');
        dit(poses.length === 1 && poses[0].tx === '62001' && poses[0].jour === ajout(AUJ, 7) && poses[0].note === 'Vérifier le colis' && !/Nike|Adidas|Salomon|Asics|Balance/.test(JSON.stringify(poses[0])), `V ${tag} : « Enregistrer » pose le rappel PAR n° de transaction (aucun titre gardé)`, JSON.stringify(poses));
        const apres = await pg.evaluate(() => { const x = document.querySelector('[data-recap-vente] [data-rappel-bouton]'); return x ? { etat: x.getAttribute('data-rappel-bouton'), t: x.textContent } : null; });
        dit(apres && apres.etat === 'actif' && /^Rappel /.test(apres.t), `V ${tag} : le bouton dit ensuite « Rappel <jour> »`, JSON.stringify(apres));
        await capture(pg, `V-${tag}-apres`);
        for (let i = 0; i < 20 && b.ecritures === ecrAvant; i++) await attendre(400);
        dit(b.ecritures > ecrAvant, `V ${tag} : le rappel part vers la base`);
        sansErreur(journal, `V ${tag}`);
        await ctx.close();
      }
      // ── N. L'adresse d'une notification ───────────────────────────────────
      if (PARTIES.includes('N')) {
        const b = base({ vrm_rappels: { [rX.id]: rX, [rV.id]: { ...rV, jour: AUJ } }, vinted_annonces_vendues: ['51004'] });
        const { ctx, pg, journal } = await NV.ouvrir(nav, { W, sombre, base: b, tab: 'journee' });
        await pg.goto(`http://localhost:${NV.PORT}/?tab=journee&num=5&rappel=${rX.id}`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector(`[data-rappel-bandeau="${rX.id}"]`, { timeout: 15000 }).catch(() => {});
        const bd = await pg.evaluate((id) => { const x = document.querySelector(`[data-rappel-bandeau="${id}"]`); if (!x) return null; const r = x.getBoundingClientRect(); return { etat: x.getAttribute('data-rappel-etat-cible'), t: x.innerText, histoire: !!x.querySelector('[data-rappel-histoire]'), dedans: r.left >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight }; }, rX.id);
        dit(bd && bd.etat === 'vendu' && /vendu entre-temps/.test(bd.t) && bd.histoire && bd.dedans, `N ${tag} : l'annonce VENDUE entre-temps : le bandeau le dit (« Voir son histoire »), pas un écran vide`, JSON.stringify(bd));
        await capture(pg, `N-${tag}-vendu`);
        await pg.click(`[data-rappel-bandeau="${rX.id}"] [data-rappel-fait="${rX.id}"]`).catch(() => {});
        await attendre(700);
        const loc = await lireLocal(pg);
        dit(loc && loc[rX.id] && loc[rX.id].etat === 'fait' && !(await pg.$(`[data-rappel-bandeau="${rX.id}"]`)), `N ${tag} : « Fait » depuis le bandeau`, JSON.stringify(loc && loc[rX.id]));
        await pg.goto(`http://localhost:${NV.PORT}/?tab=ventes&site=vinted&cible=vente&tx=62001&rappel=${rV.id}`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector(`[data-rappel-bandeau="${rV.id}"]`, { timeout: 15000 }).catch(() => {});
        const v = await pg.evaluate((id) => ({ bandeau: !!document.querySelector(`[data-rappel-bandeau="${id}"]`), vente: !!document.querySelector('[data-cible~="vente:62001"]') }), rV.id);
        dit(v.bandeau && v.vente, `N ${tag} : la notification d'une vente ouvre Ventes sur CETTE vente, avec le bandeau du rappel`, JSON.stringify(v));
        await capture(pg, `N-${tag}-vente`);
        sansErreur(journal, `N ${tag}`);
        await ctx.close();
      }
      // ── P. Paramètres → Rappels ───────────────────────────────────────────
      if (PARTIES.includes('P')) {
        const b = base({ vrm_rappels: { [rA.id]: rA, [rF.id]: rF } });
        const { ctx, pg, journal } = await NV.ouvrir(nav, { W, sombre, base: b, tab: 'settings' });
        await attendre(1500);
        await pg.click('[data-onglets-reglages] [data-vue="reglages"]').catch(() => {}); await attendre(300);
        await pg.click('[data-sous-ouvrir="rappels"]', { timeout: 8000 }).catch((e) => dit(false, `P ${tag} : la ligne « Rappels » se touche`, String(e.message).split('\n')[0]));
        await pg.waitForSelector('[data-rappels-liste]', { timeout: 8000 }).catch(() => {});
        const l = await pg.evaluate(() => ({ n: (document.querySelector('[data-rappels-liste]') || { getAttribute: () => null }).getAttribute('data-rappels-liste'), blocs: [...document.querySelectorAll('[data-rappels-bloc]')].map((x) => x.getAttribute('data-rappels-bloc') + ':' + x.querySelectorAll('[data-rappel]').length) }));
        dit(l.n === '2' && l.blocs.join() === 'jour:1,avenir:1', `P ${tag} : Paramètres → Rappels : aujourd'hui (1), à venir (1)`, JSON.stringify(l));
        await capture(pg, `P-${tag}-liste`);
        sansErreur(journal, `P ${tag}`);
        await ctx.close();
      }
    }
  } finally { await nav.close(); NV.srv.close(); }
  console.log(ko ? `\n${ko} KO` : '\nTout est vert');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
