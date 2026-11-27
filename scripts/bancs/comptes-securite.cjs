require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « COMPTES ET SÉCURITÉ » (4 nov.) — l'app RENDUE, données INVENTÉES
//  (le jeu de `nouveau-vendeur.cjs` : 2 comptes Vinted, ventes, achats, colis).
//  390 px tactile ET 1512 px, clair ET sombre. Ce qui est jugé : des `data-*`,
//  des nombres rendus et des requêtes — jamais un libellé.
//   A. Les comptes dans Ventes (natif, 26 nov.) : chaque vente porte SON compte ;
//      à l'ordinateur, le filtre « Compte » du tableau de « Terminées » montre les
//      ventes de CE compte et elles seules (par n° de transaction). La rangée de
//      puces d'avant n'est plus rendue (sans sélecteur, 20 nov.).
//   B. Cacher les montants : l'interrupteur « Mode stream » de l'écran Menu (natif ;
//      avant : le bouton de la tête, src/modeStream.js), puis CHAQUE écran —
//      aucun nombre suivi de « € » ne reste lisible ; les N° restent ; mémorisé ;
//      éteint, les montants reviennent.
//   C. Appareils connectés : la liste rendue, « Cet appareil » sans bouton, un
//      autre appareil fermé par SON identifiant seul.
//   D. Se déconnecter partout : confirmé ⇒ `logout?scope=global` ; une panne
//      (503) n'efface RIEN ici ; un oui efface la session de ce navigateur.
//   E. Ce que VRM a fait : chaque ligne nomme le N° par l'identifiant (fiche),
//      un identifiant sans fiche n'a jamais de N° ; filtres type et compte ; ce
//      qui n'est pas noté est dit.
//  `SHOTS=dossier` : une capture par étape (à REGARDER). `PARTIES=A,B,…`.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
// (26 nov., bancs natifs) L'app RÉELLE (« VRM natif », 19 nov.) : jamais le DOM d'avant le 17 nov. (échafaudage
// `vrm_banc_dom_ancien`, _garde-reseau.cjs, src/designV2/reglage.js).
process.env.BANC_DESIGN_V2 = process.env.BANC_DESIGN_V2 || 'defaut';
const path = require('path'), fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const NV = require('./nouveau-vendeur.cjs');
const SHOTS = process.env.SHOTS || '';
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const PARTIES = liste('PARTIES', 'A,B,C,D,E');
const ECRANS = ['journee', 'annonces', 'ventes', 'plat_vinted', 'cat_bord', 'messages', 'garage', 'achats', 'dashboard', 'compta', 'settings'];

let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det ? ' — ' + String(det).slice(0, 300) : ''}`); };
// (6 nov.) Le bouton « Stream » n'est dans l'en-tête que s'il est choisi (Réglages →
// Mode stream → « Afficher le bouton Stream ») : ce banc le choisit, dans `main`.
const base = () => { const lignes = JSON.parse(JSON.stringify(NV.JEU_LIGNES)); const m = lignes.find((l) => l.id === 'main'); m.data.vrm_stream_regles = { v: 1, bouton: true }; return { lignes, comptes: NV.JEU_COMPTES, ecritures: 0 }; };
const capture = async (pg, nom) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }).catch(() => {}); };
// Un montant lisible : un chiffre suivi de « € » (ou « k€ »), ou « € » suivi d'un chiffre.
const MONTANTS = (pg) => pg.evaluate(() => {
  const t = (document.body.innerText || '');
  const re = /\d(?:[\d   .,]*\d)?[   ]?(?:[kM][   ]?)?€|€[   ]?\d/g;
  return { n: (t.match(re) || []).length, ex: (t.match(re) || []).slice(0, 4), nums: (t.match(/N°\s?[A-Z]?\d+/g) || []).length };
});
const FEUILLE = (pg) => pg.locator('div[style*="z-index: 20000"]');
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await new Promise((ok) => NV.srv.listen(NV.PORT, ok));
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const W of LARGEURS) for (const theme of THEMES) {
      const sombre = theme === 'sombre', tag = `${W}-${theme}`;
      // ── A. Les puces de compte ─────────────────────────────────────────────
      if (PARTIES.includes('A')) {
        // (26 nov., bancs natifs) La rangée de puces de compte de Ventes · Vinted (`[data-compte-puces="vrm-sel-compte"]`, 4 nov.)
        // n'est plus rendue : Ventes est l'écran natif où TOUS les sites et comptes sont mêlés (« plus de sélecteur de
        // plateforme », Julien, 20 nov. soir — docs/passation/2026-11-20-sans-selecteur.md) ; le choix du compte ne vivait plus
        // que dans le menu d'un site, qui n'est plus jamais ouvert (`site === 'vinted'`). Ce qui reste, et qui est jugé :
        //   · chaque vente porte SON compte (comptes séparés, jamais mélangés en silence) ;
        //   · à l'ordinateur, le filtre « Compte » du tableau de « Terminées » (`data-tt-filtre="compte"`) montre les ventes de
        //     CE compte et elles seules — jugé par IDENTITÉ (les n° de transaction du compte dans le jeu), jamais par le titre.
        // (27 nov.) Le téléphone a de nouveau son filtre de compte, retenu par vendeur (plus bas).
        const b0 = base();
        const txDe = (uid) => (((b0.lignes.find((l) => l.id === `harvest_${uid}_orders_sold`) || {}).data || {}).payload || {}).my_orders.map((o) => String(o.transaction_id)).sort();
        const tx111 = txDe('111'), tx222 = txDe('222');
        const { ctx, pg, tel } = await NV.ouvrir(nav, { W, sombre, base: b0, tab: 'ventes' });
        await pg.locator('[data-colis-onglet-choix="toutes"]').first().click({ timeout: 15000 });
        await pg.waitForSelector('[data-toutes-vente]', { timeout: 15000 }).catch(() => {});
        await attendre(800);
        const rangees = () => pg.evaluate(() => [...document.querySelectorAll('[data-toutes-vente="vinted"]')].filter((r) => r.getClientRects().length).map((r) => ({ id: r.getAttribute('data-toutes-id'), compte: r.getAttribute('data-toutes-compte') })));
        const r0 = await rangees();
        const ids0 = r0.map((x) => x.id).sort();
        dit(JSON.stringify(ids0) === JSON.stringify([...tx111, ...tx222].sort()), `A ${tag} : « Terminées » montre les ventes des DEUX comptes`, JSON.stringify({ vu: ids0, attendu: [...tx111, ...tx222] }));
        dit(r0.every((x) => (tx111.includes(x.id) && x.compte === 'vendeuse_a') || (tx222.includes(x.id) && x.compte === 'vendeuse_b')), `A ${tag} : chaque vente porte SON compte`, JSON.stringify(r0));
        await capture(pg, `A-${tag}-avant`);
        // (27 nov., Julien : rendre au téléphone le filtre « Compte ») Le MÊME filtre au téléphone et à l'ordinateur : le bouton
        // `data-tt-filtre="compte"` (la famille du tableau de travail ; au téléphone, ses choix dans une feuille), « Tous les
        // comptes » par défaut, jugé par IDENTITÉ (n° de transaction du compte), jamais par le titre.
        const filtreC = () => pg.evaluate(() => { const b = [...document.querySelectorAll('[data-tt-filtre="compte"]')].find((x) => x.getClientRects().length); if (!b) return null; const r = b.getBoundingClientRect(); return { v: b.getAttribute('data-tt-filtre-valeur'), h: Math.round(r.height), w: Math.round(r.width) }; });
        const choisirC = async (cle) => {
          await pg.locator('[data-tt-filtre="compte"]:visible').first().click();
          await pg.locator(`[data-tt-filtre-choix="compte:${cle}"]:visible`).first().click({ timeout: 8000 });
          await attendre(600);
        };
        const f0 = await filtreC();
        dit(!!f0 && f0.v === 'tous', `A ${tag} : un filtre « Compte » est là${tel ? ' au téléphone' : ''}, « Tous les comptes » par défaut`, JSON.stringify(f0));
        if (tel) dit(!!f0 && f0.h >= 44 && f0.w >= 44, `A ${tag} : le filtre « Compte » fait 44 px au doigt`, JSON.stringify(f0));
        if (f0) {
          if (tel) {
            await pg.locator('[data-tt-filtre="compte"]:visible').first().click();
            await pg.waitForSelector('[data-tt-feuille="filtre:compte"] [data-tt-filtre-choix]', { timeout: 8000 }).catch(() => {});
            const opts = await pg.evaluate(() => [...document.querySelectorAll('[data-tt-feuille="filtre:compte"] [data-tt-filtre-choix]')].filter((x) => x.getClientRects().length).map((x) => { const r = x.getBoundingClientRect(); return { c: x.getAttribute('data-tt-filtre-choix'), h: Math.round(r.height) }; }));
            dit(opts.map((o) => o.c).join(',') === 'compte:tous,compte:vinted:111,compte:vinted:222' && opts.every((o) => o.h >= 44), `A ${tag} : la feuille propose « Tous les comptes » puis chaque compte (44 px)`, JSON.stringify(opts));
            await capture(pg, `A-${tag}-feuille`);
            await pg.locator('[data-tt-filtre-choix="compte:vinted:222"]:visible').first().click();
            await attendre(600);
          } else await choisirC('vinted:222');
          const r1 = await rangees();
          dit(JSON.stringify(r1.map((x) => x.id).sort()) === JSON.stringify(tx222), `A ${tag} : le filtre « Compte » = vendeuse_b montre SES ventes et elles seules (par n° de transaction)`, JSON.stringify(r1));
          dit(((await filtreC()) || {}).v === 'vinted:222', `A ${tag} : le filtre dit le compte choisi`);
          await capture(pg, `A-${tag}-choisi`);
          if (tel) {
            // Retenu PAR VENDEUR sur l'appareil, comme le choix du site (`vrm_filtre_plateformes`) : relu au retour.
            const memo = await pg.evaluate(() => { try { return { v: JSON.parse(localStorage.getItem('vrm_filtre_plateformes') || '{}')['compte:ventes'], uid: localStorage.getItem('vrm_local_owner') }; } catch (_) { return null; } });
            dit(!!memo && memo.v && memo.v.compte === 'vinted:222' && memo.v.vendeur === memo.uid, `A ${tag} : le choix est retenu pour CE vendeur`, JSON.stringify(memo));
            const recharger = async () => { await pg.reload({ waitUntil: 'domcontentloaded' }); await pg.locator('[data-colis-onglet-choix="toutes"]').first().click({ timeout: 15000 }); await pg.waitForSelector('[data-toutes-vente]', { timeout: 15000 }).catch(() => {}); await attendre(900); };
            await recharger();
            dit(JSON.stringify((await rangees()).map((x) => x.id).sort()) === JSON.stringify(tx222) && ((await filtreC()) || {}).v === 'vinted:222', `A ${tag} : relu au retour sur l'écran (même vendeur)`);
            // Un AUTRE vendeur sur le même appareil : son choix ne vaut pas pour lui ⇒ « Tous les comptes ».
            await pg.evaluate(() => { const o = JSON.parse(localStorage.getItem('vrm_filtre_plateformes') || '{}'); o['compte:ventes'] = { ...o['compte:ventes'], vendeur: 'un-autre-vendeur' }; localStorage.setItem('vrm_filtre_plateformes', JSON.stringify(o)); });
            await recharger();
            dit((await rangees()).length === ids0.length && ((await filtreC()) || {}).v === 'tous', `A ${tag} : le choix d'un autre vendeur ne s'applique pas`);
            await pg.evaluate(() => { const o = JSON.parse(localStorage.getItem('vrm_filtre_plateformes') || '{}'); o['compte:ventes'] = { vendeur: localStorage.getItem('vrm_local_owner'), compte: 'vinted:222' }; localStorage.setItem('vrm_filtre_plateformes', JSON.stringify(o)); });
            await recharger();
          }
          await choisirC('tous');
          dit((await rangees()).length === ids0.length && ((await filtreC()) || {}).v === 'tous', `A ${tag} : « Tous les comptes » rend toutes les ventes`);
        }
        if (!tel) {
          // L'ordinateur ne change pas : le choix retenu au téléphone ne s'y applique pas (son tableau garde SON filtre).
          await pg.evaluate(() => { const o = JSON.parse(localStorage.getItem('vrm_filtre_plateformes') || '{}'); o['compte:ventes'] = { vendeur: localStorage.getItem('vrm_local_owner'), compte: 'vinted:222' }; localStorage.setItem('vrm_filtre_plateformes', JSON.stringify(o)); });
          await pg.reload({ waitUntil: 'domcontentloaded' });
          await pg.locator('[data-colis-onglet-choix="toutes"]').first().click({ timeout: 15000 });
          await pg.waitForSelector('[data-toutes-vente]', { timeout: 15000 }).catch(() => {}); await attendre(900);
          dit((await rangees()).length === ids0.length && ((await filtreC()) || {}).v === 'tous', `A ${tag} : à l'ordinateur, le tableau garde son filtre (le choix du téléphone ne s'y applique pas)`);
        }
        await ctx.close();
        // Un compte EXCLU (`vinted_accounts_hidden`) n'apparaît jamais : ni ses ventes, ni un choix à son nom.
        {
          const b1 = base(); const m1 = b1.lignes.find((l) => l.id === 'main'); m1.data.vinted_accounts_hidden = ['222'];
          const o1 = await NV.ouvrir(nav, { W, sombre, base: b1, tab: 'ventes' });
          await o1.pg.locator('[data-colis-onglet-choix="toutes"]').first().click({ timeout: 15000 });
          await o1.pg.waitForSelector('[data-toutes-vente]', { timeout: 15000 }).catch(() => {}); await attendre(900);
          const r = await o1.pg.evaluate(() => ({ comptes: [...new Set([...document.querySelectorAll('[data-toutes-vente]')].filter((x) => x.getClientRects().length).map((x) => x.getAttribute('data-toutes-compte')))], choix: document.querySelectorAll('[data-tt-filtre-choix="compte:vinted:222"]').length, filtre: document.querySelectorAll('[data-tt-filtre="compte"]').length }));
          dit(r.comptes.join(',') === 'vendeuse_a' && r.choix === 0 && r.filtre === 0, `A ${tag} : un compte exclu n'apparaît jamais (ni ses ventes, ni un choix « Compte »)`, JSON.stringify(r));
          await o1.ctx.close();
        }
        // (27 nov., chasse aux bugs) DEUX COMPTES AU MÊME NOM (son étiquette « Julien » posée sur les deux, comme deux comptes
        // Leboncoin au même prénom affiché) : deux choix, chacun SES ventes — par identité (uid), jamais par le nom.
        {
          const b2 = base(); const m2 = b2.lignes.find((l) => l.id === 'main'); m2.data.vinted_account_labels = { 111: 'Julien', 222: 'Julien' };
          const o2 = await NV.ouvrir(nav, { W, sombre, base: b2, tab: 'ventes' });
          await o2.pg.locator('[data-colis-onglet-choix="toutes"]').first().click({ timeout: 15000 });
          await o2.pg.waitForSelector('[data-toutes-vente]', { timeout: 15000 }).catch(() => {}); await attendre(900);
          await o2.pg.locator('[data-tt-filtre="compte"]:visible').first().click({ timeout: 8000 }).catch(() => {});
          await o2.pg.waitForSelector('[data-tt-filtre-choix="compte:vinted:222"]', { timeout: 8000 }).catch(() => {});
          const opts = await o2.pg.evaluate(() => [...document.querySelectorAll('[data-tt-filtre-choix^="compte:"]')].filter((x) => x.getClientRects().length).map((x) => ({ c: x.getAttribute('data-tt-filtre-choix'), t: (x.innerText || '').split('\n')[0].trim() })));
          const libs = opts.filter((o) => o.c !== 'compte:tous').map((o) => o.t);
          dit(opts.map((o) => o.c).join(',') === 'compte:tous,compte:vinted:111,compte:vinted:222' && new Set(libs).size === 2, `A ${tag} : deux comptes au même nom = deux choix, deux libellés`, JSON.stringify(opts));
          await capture(o2.pg, `A-${tag}-meme-nom`);
          await o2.pg.locator('[data-tt-filtre-choix="compte:vinted:222"]:visible').first().click({ timeout: 8000 }).catch(() => {});
          await attendre(700);
          const r2 = await o2.pg.evaluate(() => [...document.querySelectorAll('[data-toutes-vente="vinted"]')].filter((r) => r.getClientRects().length).map((r) => r.getAttribute('data-toutes-id')).sort());
          dit(JSON.stringify(r2) === JSON.stringify(tx222), `A ${tag} : le 2e « Julien » montre SES ventes et elles seules (jamais celles de l'autre)`, JSON.stringify({ vu: r2, attendu: tx222 }));
          await o2.ctx.close();
        }
      }
      // ── B. Cacher les montants ─────────────────────────────────────────────
      if (PARTIES.includes('B')) {
        // (26 nov., bancs natifs) Coque native : l'interrupteur « Mode stream » (`data-bouton-stream`, `data-stream-on`) est une
        // rangée de l'écran Menu (`?tab=menu`, EcranMenu, App.jsx) — le bouton de la tête d'avant (`BoutonStream`) n'est rendu
        // que par l'ancienne coque. Mêmes règles : chaque écran sans montant lisible, N° lisibles, mémorisé, éteint ⇒ revenus.
        const { ctx, pg } = await NV.ouvrir(nav, { W, sombre, base: base(), tab: 'ventes' });
        await attendre(2500);
        const avant = await MONTANTS(pg);
        dit(avant.n > 0, `B ${tag} : Ventes montre des montants avant (le banc n'est pas vide)`, JSON.stringify(avant));
        const menuStream = async () => {
          await pg.goto(`http://localhost:${NV.PORT}/?tab=menu`, { waitUntil: 'domcontentloaded' });
          await pg.waitForSelector('[data-bouton-stream]', { timeout: 15000 });
          await attendre(300);
        };
        await menuStream();
        await pg.click('[data-bouton-stream]');
        await attendre(400);
        let pire = null, totalNums = 0;
        for (const e of ECRANS) {
          await pg.goto(`http://localhost:${NV.PORT}/?tab=${e}`, { waitUntil: 'domcontentloaded' });
          await pg.waitForSelector('.vrm-main', { timeout: 15000 }).catch(() => {});
          await attendre(2200);
          const m = await MONTANTS(pg); totalNums += m.nums;
          dit(m.n === 0, `B ${tag} : ${e} — aucun montant lisible`, JSON.stringify(m.ex));
          if (m.n && !pire) pire = e;
          if (['journee', 'compta', 'ventes'].includes(e)) await capture(pg, `B-${tag}-${e}`);
        }
        dit(totalNums > 0, `B ${tag} : les N° restent lisibles`, totalNums);
        await menuStream();
        const etat = await pg.evaluate(() => ({ racine: document.documentElement.getAttribute('data-stream'), memo: localStorage.getItem('vrm_stream'), bouton: (document.querySelector('[data-bouton-stream]') || { getAttribute: () => null }).getAttribute('data-stream-on') }));
        dit(etat.racine === '1' && etat.memo === '1' && etat.bouton === '1', `B ${tag} : mémorisé sur l'appareil, l'interrupteur « Stream » le dit`, JSON.stringify(etat));
        // Éteint à la main : les montants reviennent SANS recharger (l'onglet Ventes rejoint par la navigation de l'app).
        await pg.click('[data-bouton-stream]'); await attendre(400);
        await pg.locator(W < 600 ? '[data-n-onglet="ventes"]' : '[data-n-laterale] [data-n-entree="ventes"], [data-n-laterale] [data-nav-entree="ventes"]').first().click();
        await pg.waitForSelector('[data-tache="ventes"]', { timeout: 15000 }).catch(() => {}); await attendre(2200);
        const rendu = await MONTANTS(pg);
        dit(rendu.n > 0, `B ${tag} : « Stream » éteint rend les montants`, JSON.stringify(rendu));
        // Une valeur qui CHANGE pendant que c'est caché reste cachée (React réécrit le nœud).
        await menuStream();
        await pg.click('[data-bouton-stream]'); await attendre(300);
        await pg.evaluate(() => { const d = document.createElement('div'); d.id = 'banc-montant'; d.className = 'vrm-main'; document.body.appendChild(d); d.textContent = '12'; const s = document.createElement('span'); s.textContent = ' €'; d.appendChild(s); });
        await attendre(100);
        await pg.evaluate(() => { const d = document.getElementById('banc-montant'); d.firstChild.nodeValue = '99,50 € de plus'; });
        await attendre(100);
        const vivant = await pg.evaluate(() => document.getElementById('banc-montant').innerText);
        dit(!/\d/.test(vivant.replace(/•/g, '')) || !/€/.test(vivant), `B ${tag} : un montant réécrit pendant que c'est caché reste caché, même coupé en deux nœuds`, vivant);
        await ctx.close();
      }
      // ── C et D. Appareils connectés, se déconnecter partout ────────────────
      if (PARTIES.includes('C') || PARTIES.includes('D')) {
        for (const issue of (PARTIES.includes('D') ? ['panne', 'oui'] : ['oui'])) {
          const { ctx, pg } = await NV.ouvrir(nav, { W, sombre, base: base(), tab: 'settings' });
          const posts = []; const logouts = [];
          await pg.route('**/api/compte?mode=appareils', async (r) => {
            const q = r.request();
            if (q.method() === 'POST') { if (JSON.parse(q.postData() || '{}').action === 'verifier') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, nouveaux: 0 }) }); posts.push(q.postData()); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, ferme: 'b2c3d4e5-0000-4000-8000-000000000002' }) }); }
            return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, appareils: [
              { id: 'a1b2c3d4-0000-4000-8000-000000000001', appareil: 'iPhone · Safari', actifLe: new Date().toISOString(), ici: true },
              { id: 'b2c3d4e5-0000-4000-8000-000000000002', appareil: 'Mac · Chrome', actifLe: new Date(Date.now() - 3 * 3600e3).toISOString(), ici: false },
            ] }) });
          });
          await pg.route('**/auth/v1/logout**', (r) => { logouts.push(r.request().url()); return r.fulfill({ status: issue === 'panne' ? 503 : 204, body: '' }); });
          await pg.goto(`http://localhost:${NV.PORT}/?tab=settings&vue=compte`, { waitUntil: 'domcontentloaded' }); await attendre(1800);
          await pg.click('[data-sous-ouvrir="appareils"]').catch(() => {});
          await pg.waitForSelector('[data-appareils="2"]', { timeout: 8000 }).catch(() => {});
          // (11 nov., lot connexions-oauth) Regroupé : cet appareil en tête, les autres repliés.
          const groupes = await pg.evaluate(() => ({ ici: [...document.querySelectorAll('[data-appareils-ici] [data-appareil-groupe]')].map((g) => g.getAttribute('data-appareil-groupe')), autres: [...document.querySelectorAll('[data-appareils-autres] [data-appareil-groupe]')].map((g) => g.getAttribute('data-appareil-groupe')), boutonsVisibles: [...document.querySelectorAll('[data-appareil-fermer]')].filter((b) => b.getClientRects().length).length }));
          await pg.click('[data-appareils-autres] > summary').catch(() => {}); await attendre(200);
          await pg.click('[data-appareil-groupe="Mac · Chrome"]').catch(() => {}); await attendre(200);
          const lignes = await pg.evaluate(() => [...document.querySelectorAll('[data-appareil]')].map((l) => ({ ici: l.getAttribute('data-appareil'), bouton: !!l.querySelector('[data-appareil-fermer]') })));
          if (PARTIES.includes('C') && issue === 'oui') {
            dit(groupes.ici.join() === 'iPhone · Safari' && groupes.autres.join() === 'Mac · Chrome' && groupes.boutonsVisibles === 0, `C ${tag} : cet appareil en tête, les autres repliés, aucun « Déconnecter » avant de déplier`, JSON.stringify(groupes));
            dit(lignes.length === 1 && lignes[0].ici === 'autre' && lignes[0].bouton, `C ${tag} : déplié, la connexion de l'autre appareil porte « Déconnecter »`, JSON.stringify(lignes));
            await capture(pg, `C-${tag}-appareils`);
            await pg.click('[data-appareil-fermer]');
            await FEUILLE(pg).getByRole('button', { name: 'Déconnecter', exact: true }).waitFor({ timeout: 5000 }).catch(() => {});
            await capture(pg, `C-${tag}-confirmer`);
            // (11 nov.) Depuis le lot H, l'ouverture envoie {action:'verifier'} une fois
            // (alerte « nouvel appareil », src/appareilNouveau.js) : la règle se juge sur
            // ce que le CLIC envoie, et la demande d'ouverture ne doit rien porter d'autre.
            const avantClic = posts.length;
            const ouverture = posts.slice(0, avantClic);
            dit(ouverture.every((p) => JSON.stringify(JSON.parse(p || '{}')) === '{"action":"verifier"}'), `C ${tag} : avant le clic, seule la vérification d'ouverture est partie`, JSON.stringify(ouverture));
            await FEUILLE(pg).getByRole('button', { name: 'Déconnecter', exact: true }).click({ timeout: 5000 }).catch(() => {});
            for (let i = 0; i < 40 && posts.length === avantClic; i++) await attendre(200);
            await attendre(500);
            const clic = posts.slice(avantClic);
            dit(clic.length === 1 && JSON.parse(clic[0] || '{}').session === 'b2c3d4e5-0000-4000-8000-000000000002' && Object.keys(JSON.parse(clic[0] || '{}')).length === 1, `C ${tag} : « Déconnecter » n'envoie QUE l'identifiant de cet appareil`, JSON.stringify(clic));
          }
          if (PARTIES.includes('D')) {
            await pg.click('[data-deconnexion-partout]', { timeout: 8000 }).catch((e) => dit(false, `D ${tag} : « Se déconnecter partout » se touche`, String(e.message).split('\n')[0]));
            // (26 nov.) Sous charge (CI : trois bancs à la fois), la feuille de confirmation met plus de 5 s à venir : on attend
            // le FAIT (la feuille, puis l'appel), 20 s au plus — jamais un délai qui décide du résultat.
            await FEUILLE(pg).getByRole('button', { name: 'Se déconnecter partout' }).waitFor({ timeout: 20000 }).catch(() => {});
            await capture(pg, `D-${tag}-confirmer`);
            await FEUILLE(pg).getByRole('button', { name: 'Se déconnecter partout' }).click({ timeout: 20000 }).catch(() => {});
            // (11 nov.) Attendre le FAIT (l'appel parti, puis la session effacée sur un oui) plutôt qu'un délai fixe :
            // sur une machine chargée, 2,6 s ne suffisaient pas (rouges changeants d'un passage à l'autre).
            for (let i = 0; i < 40 && !logouts.length; i++) await attendre(200);
            if (issue === 'oui') await pg.waitForFunction(() => { try { return !localStorage.getItem('vrm_session'); } catch (_) { return true; } }, null, { timeout: 8000 }).catch(() => {});
            await attendre(800);
            // Un oui recharge la page (déconnexion) : la lecture se refait sur la page d'APRÈS, jamais pendant la navigation.
            const lireReste = () => pg.evaluate(() => { try { return !!localStorage.getItem('vrm_session'); } catch (_) { return null; } });
            let reste; for (let i = 0; i < 5; i++) { try { await pg.waitForLoadState('domcontentloaded'); reste = await lireReste(); break; } catch (_) { await attendre(500); } }
            dit(logouts.length === 1 && /scope=global/.test(logouts[0]), `D ${tag} (${issue}) : un seul appel, scope=global`, JSON.stringify(logouts));
            if (issue === 'panne') dit(reste === true, `D ${tag} : une panne de Supabase n'efface RIEN ici`, reste);
            else dit(reste === false, `D ${tag} : un oui efface la session de ce navigateur`, reste);
          }
          await ctx.close();
        }
      }
      // ── E. Ce que VRM a fait ───────────────────────────────────────────────
      if (PARTIES.includes('E')) {
        const { ctx, pg } = await NV.ouvrir(nav, { W, sombre, base: base(), tab: 'settings' });
        const t = (h) => Date.now() - h * 3600e3;
        await pg.route('**/api/compte?mode=journal', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, pasLu: ['bordereaux'], nonJournalise: [{ id: 'offres', texte: 'Offres : pas notées.' }, { id: 'lbc', texte: 'Leboncoin : pas noté.' }], evenements: [
          { at: t(1), type: 'favori_offre', site: 'vinted', compte: '111', cle: { item: '51003' }, resultat: 'ok' },
          { at: t(2), type: 'favori', site: 'vinted', compte: '222', cle: { item: '99999' }, resultat: 'refuse' },
          { at: t(3), type: 'republication', site: 'vinted', compte: '111', cle: { item: '77777', ancien: '51001' }, resultat: 'ok' },
          { at: t(30), type: 'ebay_retrait', site: 'ebay', compte: 'principal', cle: { sku: 'VRM-12' }, resultat: 'ok' },
        ] }) }));
        // (26 nov., bancs natifs) Paramètres natif : « Journal : ce que VRM a fait » est une rubrique de « Tes données »
        // (src/parametres/categories.js) ; elle s'ouvre par son lien profond `reglage=journal-vrm`. Les lignes se lisent
        // VISIBLES (une ligne montée mais cachée rend son texte collé : « N°4 » + « 20:11 » = « N°420:11 »).
        await pg.goto(`http://localhost:${NV.PORT}/?tab=settings&reglage=journal-vrm`, { waitUntil: 'domcontentloaded' }); await attendre(1800);
        await pg.waitForSelector('[data-journal-ligne]', { state: 'visible', timeout: 8000 }).catch(() => {});
        const L = await pg.evaluate(() => [...document.querySelectorAll('[data-journal-ligne]')].filter((l) => l.getClientRects().length).map((l) => ({ type: l.getAttribute('data-journal-ligne'), res: l.getAttribute('data-journal-resultat'), txt: l.innerText.replace(/\s+/g, ' ') })));
        dit(L.length === 4, `E ${tag} : 4 lignes`, JSON.stringify(L));
        dit(L[0] && /N°4\b/.test(L[0].txt), `E ${tag} : le N° vient de la fiche de l'identifiant (51003 ⇒ N°4)`, L[0] && L[0].txt);
        dit(L[1] && !/N°/.test(L[1].txt) && /99999/.test(L[1].txt), `E ${tag} : un identifiant sans fiche n'a JAMAIS de N°`, L[1] && L[1].txt);
        dit(L[2] && /N°2\b/.test(L[2].txt), `E ${tag} : une republication garde le N° de l'ancienne annonce`, L[2] && L[2].txt);
        dit(L[3] && /VRM-12/.test(L[3].txt) && !/N°12/.test(L[3].txt), `E ${tag} : eBay dit le SKU tel qu'écrit, sans le deviner en N°`, L[3] && L[3].txt);
        const trous = await pg.evaluate(() => ({ pasLu: !!document.querySelector('[data-journal-pas-lu="bordereaux"]'), non: document.querySelectorAll('[data-journal-non]').length }));
        dit(trous.pasLu && trous.non === 2, `E ${tag} : ce qui n'a pas pu être lu et ce qui n'est pas noté est dit`, JSON.stringify(trous));
        await capture(pg, `E-${tag}-journal`);
        await pg.click('[data-journal-type="ebay"]'); await attendre(300);
        const nE = await pg.evaluate(() => [...document.querySelectorAll('[data-journal-ligne]')].filter((l) => l.getClientRects().length).length);
        dit(nE === 1, `E ${tag} : filtre eBay`, nE);
        await pg.click('[data-journal-type="tous"]'); await attendre(300);
        await pg.click('[data-compte-puces="vrm-journal-compte"] [data-compte-puce="111"]').catch(() => {});
        await attendre(300);
        const n111 = await pg.evaluate(() => [...document.querySelectorAll('[data-journal-ligne]')].filter((l) => l.getClientRects().length).length);
        dit(n111 === 2, `E ${tag} : filtre de compte (2 lignes du compte 111)`, n111);
        await ctx.close();
      }
    }
  } finally { await nav.close(); NV.srv.close(); }
  console.log(ko ? `\n${ko} KO` : '\nTout est vert');
  process.exit(ko ? 1 : 0);
})();
