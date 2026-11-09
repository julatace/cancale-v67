require('./_porte-banc.cjs');
// ═════════════════════════════════════════════════════════════════════════
//  BANC « SUPPRIMER MON COMPTE » (9 nov., RGPD) — 390 px tactile ET 1512 px,
//  clair ET sombre. Données INVENTÉES (le jeu de `nouveau-vendeur.cjs`).
//   · la ligne est TOUT EN BAS de Mon compte (le dernier groupe), son libellé
//     dans la couleur `danger` du thème — jamais le rouge des doublons (§7) ;
//   · dépliée : l'export d'abord, ce qui part (nombres du SERVEUR, GET
//     ?mode=supprimer), ce qui reste et pourquoi (factures Pro 10 ans), les deux
//     champs de la confirmation ; 44 px au doigt ; rien ne déborde ; aucune erreur ;
//   · le bouton reste éteint sans « SUPPRIMER » ; RIEN n'est envoyé en POST tant
//     qu'il n'est pas touché (ce banc ne le touche pas : la route est jugée par
//     scripts/audit-supprimer-compte.cjs).
//  Captures : SHOTS (défaut <tmp>/banc-supprimer-compte) — à REGARDER (§6.2).
// ═════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-supprimer-compte');
fs.mkdirSync(SHOTS, { recursive: true });
const LARGEURS = [390, 1512], THEMES = ['clair', 'sombre'];
let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) ok++; else ko++; console.log(`${bon ? '✅' : '❌'} ${quoi}${!bon && det !== undefined ? ' — ' + String(typeof det === 'string' ? det : JSON.stringify(det)).slice(0, 220) : ''}`); };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const INVENTAIRE = { ok: true, proprietaire: false, nombres: { donnees: 128, facturesPro: 4, comptesVinted: 3, preuvesAdresse: 1, indexJetons: 2, signalements: 1 }, abonnement: { actif: true, resilie: false, fin: '2026-12-01T10:00:00.000Z' }, fenetreMinutes: 10, mot: 'SUPPRIMER' };

(async () => {
  const NV = require('./nouveau-vendeur.cjs');
  await new Promise((r) => NV.srv.listen(NV.PORT, r));
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const W of LARGEURS) for (const theme of THEMES) {
      const tag = `${W}-${theme}`, sombre = theme === 'sombre';
      const base = { lignes: JSON.parse(JSON.stringify(NV.JEU_LIGNES)), comptes: NV.JEU_COMPTES, ecritures: 0 };
      const { ctx, pg, journal, tel } = await NV.ouvrir(nav, { W, sombre, base, tab: 'settings' });
      const posts = [];
      // Playwright prend la DERNIÈRE route enregistrée (§6.6) : celle-ci passe avant le `/api/**` du jeu.
      await pg.route('**/api/compte?mode=supprimer*', (r) => {
        if (r.request().method() !== 'GET') { posts.push(r.request().url()); return r.fulfill({ status: 500, contentType: 'application/json', body: '{}' }); }
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(INVENTAIRE) });
      });
      await pg.goto(`http://localhost:${NV.PORT}/?tab=settings&vue=compte`, { waitUntil: 'domcontentloaded' }); await attendre(1800);
      await pg.click('[data-onglets-reglages] [data-vue="compte"]').catch(() => {}); await attendre(500);
      const enBas = await pg.evaluate(() => { const g = [...document.querySelectorAll('[data-groupe-reglages]')]; return g.map((x) => x.getAttribute('data-groupe-reglages')); });
      dit(enBas[enBas.length - 1] === 'supprimer', `${tag} : « Supprimer mon compte » est le DERNIER groupe de Mon compte`, enBas);
      const couleur = await pg.evaluate((tel) => {
        const e = document.querySelector('[data-sous-ouvrir="fermer"] b') || [...document.querySelectorAll('[data-fermer-compte] button[aria-expanded] span span')].find((x) => x.getClientRects().length);
        return e ? getComputedStyle(e).color : null;
      }, tel);
      dit(!!couleur && !/rgb\(215, 0, 21\)|rgb\(255, 105, 97\)/.test(couleur), `${tag} : le libellé n’est pas le rouge des doublons (§7)`, couleur);
      { await pg.click('[data-sous-ouvrir="fermer"]', { timeout: 8000 }).catch((e) => dit(false, `${tag} : la ligne se touche`, e.message.split('\n')[0])); await attendre(500); }
      await pg.locator('[data-fermer-compte] button[aria-expanded]:visible').first().click({ timeout: 10000 }); await attendre(900);
      const r = await pg.evaluate(() => {
        const hote = [...document.querySelectorAll('[data-fermer-compte]')].find((e) => e.getClientRects().length);
        if (!hote) return null;
        const cibles = [...hote.querySelectorAll('button, input')].filter((b) => b.getClientRects().length).map((b) => Math.round(b.getBoundingClientRect().height));
        return { etat: (hote.querySelector('[data-fermer-etat]') || {}).getAttribute ? hote.querySelector('[data-fermer-etat]').getAttribute('data-fermer-etat') : null,
          exporter: !!hote.querySelector('[data-supprimer-exporter]'), liste: (hote.querySelector('[data-supprimer-liste]') || {}).innerText || '',
          garde: (hote.querySelector('[data-supprimer-garde]') || {}).innerText || '', abo: !!hote.querySelector('[data-supprimer-abonnement]'),
          mdp: !!hote.querySelector('input[type="password"][data-supprimer-mdp]'), eteint: !!(hote.querySelector('[data-fermer-bouton]') || {}).disabled,
          petit: Math.min(...cibles), deborde: document.documentElement.scrollWidth > window.innerWidth + 1 };
      });
      dit(r && r.etat === 'possible', `${tag} : dépliée, la suppression est proposée`, r);
      dit(r && r.exporter, `${tag} : « Exporter mes données » est proposé d’abord`);
      dit(r && /124 éléments/.test(r.liste) && /3\)/.test(r.liste) && r.abo, `${tag} : ce qui part, avec les nombres du serveur (124 éléments, 3 comptes Vinted), l’abonnement résilié d’abord`, r && r.liste.slice(0, 160));
      dit(r && /4 factures Pro/.test(r.garde) && /10 ans/.test(r.garde) && /Stripe/.test(r.garde) && /3 ans/.test(r.garde), `${tag} : ce qui reste et pourquoi (factures Pro 10 ans, Stripe, preuve 3 ans)`, r && r.garde.slice(0, 160));
      dit(r && r.mdp && r.eteint, `${tag} : le champ mot de passe ; le bouton éteint sans « SUPPRIMER »`);
      if (tel) dit(r && r.petit >= 43.5, `${tag} : 44 px au doigt`, r && r.petit);
      dit(r && !r.deborde, `${tag} : rien ne déborde`);
      await pg.locator('[data-fermer-confirmation]:visible').first().fill('SUPPRIMER'); await attendre(250);
      dit(!(await pg.locator('[data-fermer-bouton]:visible').first().isDisabled()), `${tag} : « SUPPRIMER » tapé ⇒ le bouton s’allume`);
      const haut = await pg.evaluate(() => { const h = [...document.querySelectorAll('[data-fermer-compte]')].find((e) => e.getClientRects().length); return h ? Math.ceil(h.getBoundingClientRect().bottom + 120) : 0; });
      const vp = pg.viewportSize();
      if (haut > vp.height) { await pg.setViewportSize({ width: vp.width, height: haut }); await attendre(400); }
      await pg.evaluate(() => { const h = [...document.querySelectorAll('[data-fermer-compte]')].find((e) => e.getClientRects().length); if (h) h.scrollIntoView({ block: 'end' }); });
      await attendre(300);
      await pg.screenshot({ path: path.join(SHOTS, `supprimer-${tag}.png`) });
      dit(!posts.length, `${tag} : rien n’est envoyé tant que le bouton n’est pas touché`, posts);
      dit(!journal.erreurs.length, `${tag} : aucune erreur de page`, journal.erreurs);
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc s’exécute', String(e && e.message || e).slice(0, 200)); }
  finally { await nav.close(); NV.srv.close(); }
  console.log(`\n${ok} OK, ${ko} en échec — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
