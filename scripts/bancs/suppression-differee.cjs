require('./_porte-banc.cjs');
// ═════════════════════════════════════════════════════════════════════════
//  BANC « SUPPRIMER MON COMPTE » : 30 JOURS DE GRÂCE (13 nov., lot 51)
//  390 px tactile ET 1512 px, clair ET sombre. Données INVENTÉES (le jeu de
//  `nouveau-vendeur.cjs`). Le serveur est simulé À ÉTAT (la demande posée,
//  puis annulée) ; la RÈGLE serveur est jugée par
//  scripts/audit-suppression-differee.cjs. Ici, l'ÉCRAN :
//   · avant : « Quand » dit 30 jours (`data-supprimer-quand`), le bouton le dit ;
//   · « SUPPRIMER » + mot de passe ⇒ UN POST ; le panneau passe à « prévue »
//     (`data-supprimer-prevue` = la date du serveur), la phrase du serveur,
//     « Annuler la suppression » ; il reste connecté (aucune déconnexion) ;
//   · la date s'écrit UNE fois dans Paramètres (pas de bandeau là, §7) ; ailleurs
//     (Ma journée) la coque porte le bandeau (`data-bandeau-suppression`) ;
//   · « Annuler » (dans le panneau à 390, dans le bandeau de Ma journée à 1512) ⇒ UN POST
//     `supprimer-annuler`, le bandeau part, le panneau revient à « possible » ;
//   · 44 px au doigt, rien ne déborde, aucune erreur de page.
//  Captures : SHOTS (défaut <tmp>/banc-suppression-differee) — à REGARDER (§6.2).
// ═════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-suppression-differee');
fs.mkdirSync(SHOTS, { recursive: true });
const LARGEURS = [390, 1512], THEMES = ['clair', 'sombre'];
let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) ok++; else ko++; console.log(`${bon ? '✅' : '❌'} ${quoi}${!bon && det !== undefined ? ' — ' + String(typeof det === 'string' ? det : JSON.stringify(det)).slice(0, 220) : ''}`); };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const EFFACE_LE = '2026-12-13T10:00:00.000Z';
const INVENTAIRE = { ok: true, proprietaire: false, nombres: { donnees: 128, facturesPro: 4, comptesVinted: 3, preuvesAdresse: 1, indexJetons: 2, signalements: 1 }, abonnement: { actif: true, resilie: false, fin: '2026-12-01T10:00:00.000Z' }, fenetreMinutes: 10, mot: 'SUPPRIMER', graceJours: 30, vide: false, prevueSu: true };

(async () => {
  const NV = require('./nouveau-vendeur.cjs');
  await new Promise((r) => NV.srv.listen(NV.PORT, r));
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const W of LARGEURS) for (const theme of THEMES) {
      const tag = `${W}-${theme}`, sombre = theme === 'sombre';
      const base = { lignes: JSON.parse(JSON.stringify(NV.JEU_LIGNES)), comptes: NV.JEU_COMPTES, ecritures: 0 };
      const { ctx, pg, journal, tel } = await NV.ouvrir(nav, { W, sombre, base, tab: 'settings' });
      // Le serveur simulé, À ÉTAT : `prevue` posée par le POST, retirée par l'annulation.
      let prevue = null; const posts = [], annulations = [];
      // Playwright prend la DERNIÈRE route enregistrée (§6.6) : celles-ci passent avant le `/api/**` du jeu.
      await pg.route('**/api/compte?mode=supprimer*', (r) => {
        const u = r.request().url(), m = r.request().method();
        if (/mode=supprimer-annuler/.test(u)) {
          annulations.push(u); prevue = null;
          return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, annule: true, abonnement: 'repris', message: 'Suppression annulée : ton compte et tes données restent. Ton abonnement continue comme avant.' }) });
        }
        if (m !== 'GET') {
          posts.push(r.request().postData() || '');
          prevue = { demandeLe: '2026-11-13T10:00:00.000Z', effaceLe: EFFACE_LE, abonnement: 'resilie' };
          return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, prevue, etapes: { abonnement: 'resilie', email: 'non-configure' }, message: "C'est noté : ton compte sera supprimé le 13 décembre 2026. D'ici là, rien n'est effacé et tu peux annuler. Ton abonnement est résilié : aucun nouveau prélèvement." }) });
        }
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...INVENTAIRE, prevue }) });
      });
      await pg.route('**/api/compte?mode=suppression-prevue*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, prevue }) }));
      let deconnecte = false;
      await pg.route('**/auth/v1/logout*', (r) => { deconnecte = true; return r.fulfill({ status: 204, body: '' }); });
      await pg.goto(`http://localhost:${NV.PORT}/?tab=settings&vue=compte`, { waitUntil: 'domcontentloaded' }); await attendre(1800);
      dit(!(await pg.locator('[data-bandeau-suppression]').count()), `${tag} : aucune suppression prévue ⇒ aucun bandeau`);
      await pg.click('[data-onglets-reglages] [data-vue="compte"]').catch(() => {}); await attendre(500);
      await pg.click('[data-sous-ouvrir="fermer"]', { timeout: 8000 }).catch((e) => dit(false, `${tag} : la ligne se touche`, e.message.split('\n')[0])); await attendre(500);
      await pg.locator('[data-fermer-compte] button[aria-expanded]:visible').first().click({ timeout: 10000 }); await attendre(900);
      const avant = await pg.evaluate(() => {
        const h = [...document.querySelectorAll('[data-fermer-compte]')].find((e) => e.getClientRects().length);
        if (!h) return null;
        const q = h.querySelector('[data-supprimer-quand]');
        return { etat: (h.querySelector('[data-fermer-etat]') || { getAttribute: () => null }).getAttribute('data-fermer-etat'), quand: q ? q.getAttribute('data-supprimer-quand') : null, quandTexte: q ? q.innerText : '', bouton: (h.querySelector('[data-fermer-bouton]') || {}).innerText || '' };
      });
      dit(avant && avant.etat === 'possible', `${tag} : dépliée, la suppression est proposée`, avant);
      dit(avant && avant.quand === 'dans-30-jours' && /30 jours/.test(avant.quandTexte) && /annuler/.test(avant.quandTexte), `${tag} : « Quand » dit 30 jours et qu’on peut annuler`, avant && avant.quandTexte);
      dit(avant && /30 jours/.test(avant.bouton), `${tag} : le bouton dit « dans 30 jours »`, avant && avant.bouton);
      await pg.locator('[data-fermer-confirmation]:visible').first().fill('SUPPRIMER');
      await pg.locator('[data-supprimer-mdp]:visible').first().fill('motdepasse-du-banc'); await attendre(250);
      await pg.locator('[data-fermer-bouton]:visible').first().click(); await attendre(1200);
      const apres = await pg.evaluate(() => {
        const h = [...document.querySelectorAll('[data-fermer-compte]')].find((e) => e.getClientRects().length);
        if (!h) return null;
        const p = h.querySelector('[data-supprimer-prevue]');
        const cibles = [...h.querySelectorAll('button, input')].filter((b) => b.getClientRects().length).map((b) => Math.round(b.getBoundingClientRect().height));
        return { etat: (h.querySelector('[data-fermer-etat]') || { getAttribute: () => null }).getAttribute('data-fermer-etat'), prevue: p ? p.getAttribute('data-supprimer-prevue') : null, texte: h.innerText,
          abo: !!h.querySelector('[data-supprimer-abonnement-prevue]'), dates: (h.innerText.match(/13 décembre/g) || []).length, annuler: !!h.querySelector('[data-supprimer-annuler]'), petit: Math.min(...cibles),
          bandeau: (document.querySelector('[data-bandeau-suppression]') || { getAttribute: () => null }).getAttribute('data-bandeau-suppression'),
          deborde: document.documentElement.scrollWidth > window.innerWidth + 1 };
      });
      dit(posts.length === 1 && /"confirmation":"SUPPRIMER"/.test(posts[0]), `${tag} : UN POST, avec « SUPPRIMER »`, posts);
      dit(apres && apres.etat === 'prevue' && apres.prevue === EFFACE_LE, `${tag} : le panneau passe à « prévue », à la date du SERVEUR`, apres && { etat: apres.etat, prevue: apres.prevue });
      dit(apres && /13 décembre 2026/.test(apres.texte) && /rien n’est effacé|rien n'est effacé/.test(apres.texte), `${tag} : la date en clair et « rien n’est effacé d’ici là »`, apres && apres.texte.slice(0, 200));
      dit(apres && apres.abo, `${tag} : « ton abonnement est résilié : aucun nouveau prélèvement »`);
      dit(apres && apres.dates === 1 && !apres.bandeau, `${tag} : la date s’écrit UNE fois dans Paramètres (aucun bandeau en double)`, apres && { dates: apres.dates, bandeau: apres.bandeau });
      dit(apres && apres.annuler, `${tag} : « Annuler la suppression » est là`);
      if (tel) dit(apres && apres.petit >= 43.5, `${tag} : 44 px au doigt`, apres && apres.petit);
      dit(apres && !apres.deborde, `${tag} : rien ne déborde`);
      dit(!deconnecte, `${tag} : il reste connecté (aucune déconnexion après la demande)`);
      const haut = await pg.evaluate(() => { const h = [...document.querySelectorAll('[data-fermer-compte]')].find((e) => e.getClientRects().length); return h ? Math.ceil(h.getBoundingClientRect().bottom + 120) : 0; });
      const vp = pg.viewportSize();
      if (haut > vp.height) { await pg.setViewportSize({ width: vp.width, height: haut }); await attendre(400); }
      await pg.evaluate(() => { const h = [...document.querySelectorAll('[data-fermer-compte]')].find((e) => e.getClientRects().length); if (h) h.scrollIntoView({ block: 'end' }); }); await attendre(300);
      await pg.screenshot({ path: path.join(SHOTS, `prevue-${tag}.png`) });
      // Ailleurs que dans Paramètres, la coque porte le bandeau.
      await pg.setViewportSize(vp);
      await pg.evaluate(() => { const b = [...document.querySelectorAll('[data-tab="journee"], [data-nav="journee"], a[href*="tab=journee"]')].find((e) => e.getClientRects().length); if (b) b.click(); });
      await attendre(900);
      if (!(await pg.locator('[data-attente-ecran="journee"], [data-bandeau-suppression]').count())) { await pg.goto(`http://localhost:${NV.PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' }); await attendre(1800); }
      await pg.locator('[data-bandeau-suppression]').first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}); await attendre(800);
      const bandeau = await pg.evaluate(() => (document.querySelector('[data-bandeau-suppression]') || { getAttribute: () => null }).getAttribute('data-bandeau-suppression'));
      dit(bandeau === EFFACE_LE, `${tag} : sur Ma journée, la coque porte le bandeau « ton compte sera supprimé le … »`, bandeau);
      await pg.screenshot({ path: path.join(SHOTS, `bandeau-${tag}.png`) });
      // Annuler : dans le bandeau de Ma journée (1512), dans le panneau (390).
      if (W === 390) {
        await pg.goto(`http://localhost:${NV.PORT}/?tab=settings&section=supprimer`, { waitUntil: 'domcontentloaded' }); await attendre(1800);
        const ouvert = await pg.locator('[data-supprimer-annuler]:visible').count();
        if (!ouvert) { await pg.locator('[data-fermer-compte] button[aria-expanded]:visible').first().click({ timeout: 10000 }).catch(() => {}); await attendre(900); }
        await pg.locator('[data-supprimer-annuler]:visible').first().click();
      } else await pg.locator('[data-bandeau-suppression-annuler]').first().click();
      await attendre(1200);
      if (W !== 390) {
        dit(!(await pg.locator('[data-bandeau-suppression]').count()), `${tag} : annulée depuis le bandeau, il part`);
        await pg.goto(`http://localhost:${NV.PORT}/?tab=settings&section=supprimer`, { waitUntil: 'domcontentloaded' }); await attendre(1800);
        if (!(await pg.locator('[data-fermer-etat]:visible').count())) { await pg.locator('[data-fermer-compte] button[aria-expanded]:visible').first().click({ timeout: 10000 }).catch(() => {}); await attendre(900); }
      }
      const fin = await pg.evaluate(() => {
        const h = [...document.querySelectorAll('[data-fermer-compte]')].find((e) => e.getClientRects().length);
        return { etat: h && h.querySelector('[data-fermer-etat]') ? h.querySelector('[data-fermer-etat]').getAttribute('data-fermer-etat') : null, bandeau: !!document.querySelector('[data-bandeau-suppression]') };
      });
      dit(annulations.length === 1, `${tag} : « Annuler » (${W === 390 ? 'panneau' : 'bandeau'}) ⇒ UN POST supprimer-annuler`, annulations);
      dit(fin.etat === 'possible' && !fin.bandeau, `${tag} : annulée, le panneau revient à « possible », aucun bandeau`, fin);
      dit(posts.length === 1, `${tag} : aucune nouvelle demande envoyée par l’annulation`, posts.length);
      dit(!journal.erreurs.length, `${tag} : aucune erreur de page`, journal.erreurs);
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc s’exécute', String(e && e.message || e).slice(0, 200)); }
  finally { await nav.close(); NV.srv.close(); }
  console.log(`\n${ok} OK, ${ko} en échec — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
