// Banc : VRM POUR DES VENDEURS DIFFÉRENTS DE JULIEN (8 nov.) — l'app RENDUE.
//
// Données INVENTÉES (celles de `nouveau-vendeur.cjs`, un seul compte Vinted, trois
// ventes), base servie par ce banc, écritures gardées en mémoire. Port : celui de nouveau-vendeur (`BANC_PORT`).
//   A. PETIT VENDEUR (pas propriétaire, 1 compte, 3 ventes) : Paramètres →
//      Affichage dit « Simple » ; la navigation n'a ni Stock ni Republier ni
//      eBay/Leboncoin/Vestiaire ; Ma journée garde les MÊMES compteurs
//      (`data-tuile`) et les mêmes chiffres de tête qu'en Complet (aucun total
//      changé) ; « Complet » remet Stock et Republier d'un geste ; Stock dit
//      « articles » (Je vends : Autre).
//   B. JULIEN (propriétaire, les mêmes données) : Complet, Stock et Republier là,
//      « paires ».
//   C. iPHONE SEUL — ORION (agent d'iPhone + `window.KAGI`, compte vide) : aucune
//      phrase « sur ton ordinateur » sur Ma journée, Ventes et « Vérifier mon
//      installation ».
//   D. MODE ÉQUIPE sans la 016 : Réglages → Équipe dit la phrase, ce que verra
//      l'aide, aucun « Inviter ».
// 390 px tactile et 1512 px, clair et sombre. `SHOTS=dossier` : captures à regarder.
'use strict';
const path = require('path'), fs = require('fs');
const NV = require('./nouveau-vendeur.cjs');
const { lancer } = require('./_navigateur.cjs');
const PW = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const SHOTS = process.env.SHOTS || '';
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');

let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det ? ' — ' + String(det).slice(0, 300) : ''}`); };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

// Un seul compte (111) : les lignes du compte 222 retirées ; aucune ligne Leboncoin.
const lignesPetit = () => JSON.parse(JSON.stringify(NV.JEU_LIGNES.filter((r) => !/_222_|^lbc_/.test(r.id))));
const COMPTE_SEUL = [NV.JEU_COMPTES[0]];

// Un navigateur qui sert /api/compte?mode=abonnement (propriétaire ou non) et, au
// besoin, se présente en iPhone dans Orion.
function navAvec(nav, { proprio, orion = false }) {
  return {
    newContext: async (opts) => {
      const ctx = await nav.newContext({ ...opts, ...(orion ? { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1' } : {}) });
      if (orion) await ctx.addInitScript(() => { try { window.KAGI = {}; } catch (_) {} });
      const np = ctx.newPage.bind(ctx);
      ctx.newPage = async () => {
        const pg = await np();
        // (11 nov., ci-vert) Un vendeur déjà configuré : « Ma configuration » (parcours d'arrivée plein
        // écran, lot accompagnement-nouveau-vendeur) couvrait l'app et prenait le clic sur « Plus ». Ce
        // banc juge le menu et les chiffres ; le parcours a son banc (configuration-depart).
        await pg.addInitScript(() => { try { if (!localStorage.getItem('vrm_configuration')) localStorage.setItem('vrm_configuration', JSON.stringify({ etat: 'fait', at: '2026-11-01T10:00:00.000Z', statut: null, version: 1 })); } catch (_) {} });
        pg.__routeApi = true;
        const orig = pg.route.bind(pg);
        pg.route = async (motif, f) => {
          if (String(motif) === '**/api/**') return orig(motif, (r) => {
            const u = r.request().url();
            if (/mode=abonnement/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, proprietaire: proprio, acces: true }) });
            if (/mode=equipe/.test(u)) return r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, erreur: 'non-installe' }) });
            return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
          });
          return orig(motif, f);
        };
        return pg;
      };
      return ctx;
    },
  };
}

const entrees = (pg) => pg.evaluate(() => [...document.querySelectorAll('[data-nav-entree]')].map((e) => e.getAttribute('data-nav-entree')));
async function entreesVues(pg, tel) {
  if (!tel) return entrees(pg);
  await pg.click('.vrm-nav-more').catch(() => {});
  await attendre(500);
  const e = await entrees(pg);
  await pg.keyboard.press('Escape').catch(() => {});
  await attendre(300);
  return e;
}
const compteurs = (pg) => pg.evaluate(() => {
  const o = {};
  for (const e of document.querySelectorAll('[data-tuile]')) o['t:' + e.getAttribute('data-tuile')] = e.getAttribute('data-n');
  for (const e of document.querySelectorAll('[data-fu-vendu-jour],[data-vendu-mois],[data-journee-benef-n]')) o[e.getAttributeNames().find((a) => /^data-(fu-vendu-jour|vendu-mois|journee-benef-n)$/.test(a))] = e.textContent.trim();
  return o;
});
async function profil(pg) {
  await pg.goto(new URL('/?tab=settings', pg.url()).href, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('[data-reglage-affichage]', { timeout: 15000 }).catch(() => {});
  await attendre(1500);
  return pg.evaluate(() => { const e = document.querySelector('[data-reglage-affichage]'); const v = document.querySelector('[data-reglage-vends]'); return { mode: e && e.getAttribute('data-reglage-affichage'), vend: v && v.getAttribute('data-reglage-vends') }; });
}
async function capture(pg, nom) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await pg.screenshot({ path: path.join(SHOTS, nom + '.png'), fullPage: false }).catch(() => {});
}

(async () => {
  await new Promise((r) => NV.srv.listen(NV.PORT, r));
  const nav = await lancer(PW, { executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const W of LARGEURS) for (const theme of THEMES) {
      const sombre = theme === 'sombre', tel = W < 600, cle = `${W}-${theme}`;
      // ── A. le petit vendeur ──────────────────────────────────────────────
      {
        const base = { lignes: lignesPetit(), comptes: COMPTE_SEUL, ecritures: 0 };
        const { ctx, pg, journal } = await NV.ouvrir(navAvec(nav, { proprio: false }), { W, sombre, base });
        await attendre(4000);
        const p = await profil(pg);
        dit(p.mode === 'simple', `A1 ${cle} petit vendeur ⇒ Affichage « Simple » par défaut`, JSON.stringify(p));
        dit(p.vend === 'autre', `A2 ${cle} petit vendeur ⇒ « Je vends : Autre » par défaut`, JSON.stringify(p));
        await pg.click('[data-reglage-affichage]').catch(() => {});
        await attendre(600);
        await capture(pg, `A-reglage-affichage-${cle}`);
        await pg.goto(new URL('/?tab=journee', pg.url()).href, { waitUntil: 'domcontentloaded' });
        await attendre(4000);
        const eS = await entreesVues(pg, tel);
        // (9 nov., lot AL) « Republier » n'est plus une entrée du menu (une vue d'Annonces) : jamais dans le menu, en Simple comme en Complet.
        dit(!eS.includes('garage') && !eS.includes('republier'), `A3 ${cle} Simple : ni Stock ni Republier dans le menu`, eS.join(','));
        dit(!eS.some((x) => /^plat_(ebay|leboncoin|vestiaire)$/.test(x)), `A4 ${cle} Simple : aucun site jamais relié dans le menu`, eS.join(','));
        // (11 nov., ci-vert) Paramètres vit derrière la photo du profil (lot DJ6) : plus une entrée du menu ;
        // « Argent » (`compta`) reste, et le profil qui mène à Paramètres est là.
        const profilLa = await pg.evaluate(() => !!document.querySelector('[data-profil-tete], [data-nav-compte-ouvre="profil"]'));
        dit(eS.includes('compta') && !eS.includes('settings') && profilLa, `A5 ${cle} Simple : Argent reste, Paramètres derrière le profil`, eS.join(',') + ' · profil ' + profilLa);
        const cS = await compteurs(pg);
        await capture(pg, `A-journee-simple-${cle}`);
        // « Complet » d'un geste (le réglage), puis les mêmes compteurs.
        await pg.evaluate(() => { localStorage.setItem('vrm_affichage', JSON.stringify({ choix: 'complet', at: new Date().toISOString() })); });
        // (11 nov., ci-vert) Rouvrir Ma journée PAR SON LIEN : un rechargement de « / » reprend le dernier
        // écran TOUCHÉ (lot reprise-ecrans : un écran ouvert par `?tab=` n'est pas un geste), ici Paramètres.
        await pg.goto(new URL('/?tab=journee', pg.url()).href, { waitUntil: 'domcontentloaded' });
        await attendre(4500);
        const eC = await entreesVues(pg, tel);
        dit(eC.includes('garage') && !eC.includes('republier'), `A6 ${cle} Complet : Stock revient (Republier vit dans Annonces, lot AL)`, eC.join(','));
        const cC = await compteurs(pg);
        dit(Object.keys(cS).length > 0 && JSON.stringify(cS) === JSON.stringify(cC), `A7 ${cle} aucun compteur ni chiffre de Ma journée ne change entre Simple et Complet`, Object.keys({ ...cS, ...cC }).filter((k) => cS[k] !== cC[k]).map((k) => `${k}: ${JSON.stringify(cS[k])} ≠ ${JSON.stringify(cC[k])}`).join(" ¦ "));
        await pg.goto(new URL('/?tab=garage', pg.url()).href, { waitUntil: 'domcontentloaded' });
        await attendre(3500);
        const st = await pg.evaluate(() => { const e = document.querySelector('[data-stock-resume]'); return e ? e.textContent : ''; });
        dit(!st || (/article/.test(st) && !/paire/.test(st)), `A8 ${cle} Stock dit « article » (Je vends : Autre)`, st);
        dit(journal.erreurs.length === 0, `A9 ${cle} aucune erreur JS`, journal.erreurs.join(' | '));
        await ctx.close();
      }
      // ── B. Julien ────────────────────────────────────────────────────────
      {
        const base = { lignes: lignesPetit(), comptes: COMPTE_SEUL, ecritures: 0 };
        const { ctx, pg, journal } = await NV.ouvrir(navAvec(nav, { proprio: true }), { W, sombre, base });
        await attendre(4000);
        const p = await profil(pg);
        dit(p.mode === 'complet' && p.vend === 'sneakers', `B1 ${cle} propriétaire ⇒ Complet et Sneakers, jamais Simple`, JSON.stringify(p));
        await pg.goto(new URL('/?tab=journee', pg.url()).href, { waitUntil: 'domcontentloaded' });
        await attendre(3500);
        const e = await entreesVues(pg, tel);
        dit(e.includes('garage') && !e.includes('republier'), `B2 ${cle} propriétaire : Stock là (Republier vit dans Annonces, lot AL)`, e.join(','));
        dit(journal.erreurs.length === 0, `B3 ${cle} aucune erreur JS`, journal.erreurs.join(' | '));
        await ctx.close();
      }
      // ── C. iPhone seul, Orion ──────────────────────────────────────────────
      if (tel) {
        const base = { lignes: [{ id: 'main', data: { vrm_bienvenue_vue: { at: 'x' }, vrm_visite_vue: { at: 'x' } } }], comptes: [], ecritures: 0 };
        const { ctx, pg, journal } = await NV.ouvrir(navAvec(nav, { proprio: false, orion: true }), { W, sombre, base });
        for (const tab of ['journee', 'ventes', 'settings']) {
          await pg.goto(new URL('/?tab=' + tab, pg.url()).href, { waitUntil: 'domcontentloaded' });
          await attendre(3500);
          if (tab === 'settings') { await pg.click('[data-reglage-verifier]').catch(() => {}); await attendre(1500); }
          const t = await pg.evaluate(() => document.body.innerText);
          const m = /.{0,60}sur ton ordinateur.{0,40}/.exec(t);
          dit(!m, `C1 ${cle} Orion · ${tab} : jamais « sur ton ordinateur »`, m && m[0]);
          await capture(pg, `C-orion-${tab}-${cle}`);
        }
        dit(journal.erreurs.length === 0, `C2 ${cle} aucune erreur JS`, journal.erreurs.join(' | '));
        await ctx.close();
      }
      // ── D. Mode équipe sans la 016 ─────────────────────────────────────────
      if (theme === 'clair') {
        const base = { lignes: lignesPetit(), comptes: COMPTE_SEUL, ecritures: 0 };
        const { ctx, pg } = await NV.ouvrir(navAvec(nav, { proprio: false }), { W, sombre, base, tab: 'settings' });
        await attendre(3000);
        await pg.click('[data-onglet-compte], [data-vue="compte"]').catch(() => {});
        await pg.evaluate(() => { const b = [...document.querySelectorAll('button,[role="tab"]')].find((x) => /^Mon compte$/.test(x.textContent.trim())); if (b) b.click(); });
        await attendre(800);
        await pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /^Équipe/.test(x.textContent.trim())); if (b) b.click(); });
        await attendre(1500);
        const d = await pg.evaluate(() => { const e = document.querySelector('[data-equipe-reglage]'); return e ? { etat: e.getAttribute('data-equipe-reglage'), t: e.innerText, inviter: !!document.querySelector('[data-equipe-inviter]'), viendra: !!e.querySelector('[data-equipe-ce-qui-viendra]') } : null; });
        dit(d && d.etat === 'non-installe' && d.viendra && !d.inviter && /pas encore activé/.test(d.t), `D1 ${cle} Équipe sans la 016 : la phrase, ce que verra l’aide, aucun « Inviter »`, JSON.stringify(d));
        await capture(pg, `D-equipe-${cle}`);
        await ctx.close();
      }
    }
  } finally {
    await nav.close().catch(() => {});
    NV.srv.close();
  }
  console.log(ko ? `\n❌ banc vendeurs-différents : ${ko} rouge(s)` : '\n✅ banc vendeurs-différents : tout est vert');
  process.exitCode = ko ? 1 : 0;
})();
