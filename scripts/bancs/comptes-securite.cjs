require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « COMPTES ET SÉCURITÉ » (4 nov.) — l'app RENDUE, données INVENTÉES
//  (le jeu de `nouveau-vendeur.cjs` : 2 comptes Vinted, ventes, achats, colis).
//  390 px tactile ET 1512 px, clair ET sombre. Ce qui est jugé : des `data-*`,
//  des nombres rendus et des requêtes — jamais un libellé.
//   A. Changer de compte en un tap : une rangée de puces (Tous + 2 comptes) en
//      haut de Ventes · Vinted, 44 px au doigt ; un tap filtre l'écran (la vente
//      de l'autre compte n'est plus nette) ; le choix survit au rechargement ;
//      la liste native (bancs plus anciens) dit la même valeur.
//   B. Cacher les montants : (5 nov.) le bouton « Stream » de la tête, qui remplace
//      l'œil (src/modeStream.js, montants cachés par défaut), puis CHAQUE écran —
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
        const { ctx, pg, tel } = await NV.ouvrir(nav, { W, sombre, base: base(), tab: 'plat_vinted' });
        await pg.waitForSelector('[data-compte-puces]', { timeout: 15000 }).catch(() => {});
        const p = await pg.evaluate(() => [...document.querySelectorAll('[data-compte-puces="vrm-sel-compte"] [data-compte-puce]')].map((b) => { const r = b.getBoundingClientRect(); return { v: b.getAttribute('data-compte-puce'), a: b.getAttribute('aria-checked'), h: r.height, top: r.top }; }));
        dit(p.length === 3 && p[0].v === '*', `A ${tag} : la rangée « Tous » + 2 comptes`, JSON.stringify(p));
        if (tel) dit(p.every((x) => x.h >= 43.5), `A ${tag} : 44 px au doigt`, JSON.stringify(p.map((x) => x.h)));
        const carte = await pg.evaluate(() => { const c = document.querySelector('.vrm-market-space .vrm-fu-ecran, .vrm-market-space [data-carte-stats]'); return c ? c.getBoundingClientRect().top : null; });
        if (p.length && carte != null) dit(p[0].top < carte, `A ${tag} : les puces sont AU-DESSUS de la carte`, `${p[0].top} vs ${carte}`);
        await capture(pg, `A-${tag}-avant`);
        await pg.click('[data-compte-puces="vrm-sel-compte"] [data-compte-puce="222"]');
        await attendre(600);
        const apres = await pg.evaluate(() => ({ actif: (document.querySelector('[data-compte-puces="vrm-sel-compte"] [aria-checked="true"]') || {}).getAttribute && document.querySelector('[data-compte-puces="vrm-sel-compte"] [aria-checked="true"]').getAttribute('data-compte-puce'), select: (document.querySelector('#vrm-sel-compte') || {}).value, memo: localStorage.getItem('vrm_compte_choisi') }));
        dit(apres.actif === '222' && apres.select === '222', `A ${tag} : un tap choisit le compte (puce et liste disent la même valeur)`, JSON.stringify(apres));
        dit(/"vinted":"222"/.test(apres.memo || ''), `A ${tag} : mémorisé PAR SITE`, apres.memo);
        await capture(pg, `A-${tag}-choisi`);
        await pg.goto(`http://localhost:${NV.PORT}/?tab=plat_vinted`, { waitUntil: 'domcontentloaded' }); await pg.waitForSelector('[data-compte-puces]', { timeout: 15000 }).catch(() => {}); await attendre(800);
        const rel = await pg.evaluate(() => { const b = document.querySelector('[data-compte-puces="vrm-sel-compte"] [aria-checked="true"]'); return b && b.getAttribute('data-compte-puce'); });
        dit(rel === '222', `A ${tag} : le choix survit au rechargement`, rel);
        // Un autre site ne reçoit pas ce choix.
        await pg.goto(`http://localhost:${NV.PORT}/?tab=plat_ebay`, { waitUntil: 'domcontentloaded' }); await attendre(1500);
        const memoEbay = await pg.evaluate(() => localStorage.getItem('vrm_compte_choisi'));
        dit(!/"ebay"/.test(memoEbay || ''), `A ${tag} : un autre site ne reçoit pas le choix de Vinted`, memoEbay);
        await pg.click('[data-compte-puces="vrm-sel-compte"] [data-compte-puce="*"]').catch(() => {});
        await ctx.close();
      }
      // ── B. Cacher les montants ─────────────────────────────────────────────
      if (PARTIES.includes('B')) {
        const { ctx, pg } = await NV.ouvrir(nav, { W, sombre, base: base(), tab: 'plat_vinted' });
        await attendre(2500);
        const avant = await MONTANTS(pg);
        dit(avant.n > 0, `B ${tag} : Ventes · Vinted montre des montants avant (le banc n'est pas vide)`, JSON.stringify(avant));
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
        const etat = await pg.evaluate(() => ({ racine: document.documentElement.getAttribute('data-stream'), memo: localStorage.getItem('vrm_stream'), bouton: (document.querySelector('[data-bouton-stream]') || {}).getAttribute && document.querySelector('[data-bouton-stream]').getAttribute('aria-pressed') }));
        dit(etat.racine === '1' && etat.memo === '1' && etat.bouton === 'true', `B ${tag} : mémorisé sur l'appareil, le bouton « Stream » le dit`, JSON.stringify(etat));
        // Rendu à la main : les montants reviennent sans recharger.
        await pg.goto(`http://localhost:${NV.PORT}/?tab=plat_vinted`, { waitUntil: 'domcontentloaded' }); await attendre(2200);
        await pg.click('[data-bouton-stream]'); await attendre(400);
        const rendu = await MONTANTS(pg);
        dit(rendu.n > 0, `B ${tag} : « Stream » éteint rend les montants`, JSON.stringify(rendu));
        // Une valeur qui CHANGE pendant que c'est caché reste cachée (React réécrit le nœud).
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
            if (q.method() === 'POST') { posts.push(q.postData()); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, ferme: 'b2c3d4e5-0000-4000-8000-000000000002' }) }); }
            return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, appareils: [
              { id: 'a1b2c3d4-0000-4000-8000-000000000001', appareil: 'iPhone · Safari', actifLe: new Date().toISOString(), ici: true },
              { id: 'b2c3d4e5-0000-4000-8000-000000000002', appareil: 'Mac · Chrome', actifLe: new Date(Date.now() - 3 * 3600e3).toISOString(), ici: false },
            ] }) });
          });
          await pg.route('**/auth/v1/logout**', (r) => { logouts.push(r.request().url()); return r.fulfill({ status: issue === 'panne' ? 503 : 204, body: '' }); });
          await pg.goto(`http://localhost:${NV.PORT}/?tab=settings&vue=compte`, { waitUntil: 'domcontentloaded' }); await attendre(1800);
          await pg.click('[data-sous-ouvrir="appareils"]').catch(() => {});
          await pg.waitForSelector('[data-appareils="2"]', { timeout: 8000 }).catch(() => {});
          const lignes = await pg.evaluate(() => [...document.querySelectorAll('[data-appareil]')].map((l) => ({ ici: l.getAttribute('data-appareil'), bouton: !!l.querySelector('[data-appareil-fermer]') })));
          if (PARTIES.includes('C') && issue === 'oui') {
            dit(lignes.length === 2 && lignes[0].ici === 'ici' && !lignes[0].bouton && lignes[1].bouton, `C ${tag} : la liste, « cet appareil » sans bouton`, JSON.stringify(lignes));
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
            await attendre(700);
            const clic = posts.slice(avantClic);
            dit(clic.length === 1 && JSON.parse(clic[0] || '{}').session === 'b2c3d4e5-0000-4000-8000-000000000002' && Object.keys(JSON.parse(clic[0] || '{}')).length === 1, `C ${tag} : « Déconnecter » n'envoie QUE l'identifiant de cet appareil`, JSON.stringify(clic));
          }
          if (PARTIES.includes('D')) {
            await pg.click('[data-deconnexion-partout]', { timeout: 8000 }).catch((e) => dit(false, `D ${tag} : « Se déconnecter partout » se touche`, String(e.message).split('\n')[0]));
            await FEUILLE(pg).getByRole('button', { name: 'Se déconnecter partout' }).waitFor({ timeout: 5000 }).catch(() => {});
            await capture(pg, `D-${tag}-confirmer`);
            await FEUILLE(pg).getByRole('button', { name: 'Se déconnecter partout' }).click({ timeout: 5000 }).catch(() => {});
            await attendre(2600);
            const reste = await pg.evaluate(() => { try { return !!localStorage.getItem('vrm_session'); } catch (_) { return null; } });
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
        await pg.goto(`http://localhost:${NV.PORT}/?tab=settings&vue=compte`, { waitUntil: 'domcontentloaded' }); await attendre(1800);
        await pg.click('[data-onglets-reglages] [data-vue="compte"]').catch(() => {}); await attendre(400);   // (8 nov.) `?vue=compte` n'est lu qu'au premier chargement
        await pg.click('[data-sous-ouvrir="journal-vrm"]').catch(() => {});
        await pg.waitForSelector('[data-journal-ligne]', { timeout: 8000 }).catch(() => {});
        const L = await pg.evaluate(() => [...document.querySelectorAll('[data-journal-ligne]')].map((l) => ({ type: l.getAttribute('data-journal-ligne'), res: l.getAttribute('data-journal-resultat'), txt: l.innerText.replace(/\s+/g, ' ') })));
        dit(L.length === 4, `E ${tag} : 4 lignes`, JSON.stringify(L));
        dit(L[0] && /N°4\b/.test(L[0].txt), `E ${tag} : le N° vient de la fiche de l'identifiant (51003 ⇒ N°4)`, L[0] && L[0].txt);
        dit(L[1] && !/N°/.test(L[1].txt) && /99999/.test(L[1].txt), `E ${tag} : un identifiant sans fiche n'a JAMAIS de N°`, L[1] && L[1].txt);
        dit(L[2] && /N°2\b/.test(L[2].txt), `E ${tag} : une republication garde le N° de l'ancienne annonce`, L[2] && L[2].txt);
        dit(L[3] && /VRM-12/.test(L[3].txt) && !/N°12/.test(L[3].txt), `E ${tag} : eBay dit le SKU tel qu'écrit, sans le deviner en N°`, L[3] && L[3].txt);
        const trous = await pg.evaluate(() => ({ pasLu: !!document.querySelector('[data-journal-pas-lu="bordereaux"]'), non: document.querySelectorAll('[data-journal-non]').length }));
        dit(trous.pasLu && trous.non === 2, `E ${tag} : ce qui n'a pas pu être lu et ce qui n'est pas noté est dit`, JSON.stringify(trous));
        await capture(pg, `E-${tag}-journal`);
        await pg.click('[data-journal-type="ebay"]'); await attendre(300);
        const nE = await pg.evaluate(() => document.querySelectorAll('[data-journal-ligne]').length);
        dit(nE === 1, `E ${tag} : filtre eBay`, nE);
        await pg.click('[data-journal-type="tous"]'); await attendre(300);
        await pg.click('[data-compte-puces="vrm-journal-compte"] [data-compte-puce="111"]').catch(() => {});
        await attendre(300);
        const n111 = await pg.evaluate(() => [...document.querySelectorAll('[data-journal-ligne]')].length);
        dit(n111 === 2, `E ${tag} : filtre de compte (2 lignes du compte 111)`, n111);
        await ctx.close();
      }
    }
  } finally { await nav.close(); NV.srv.close(); }
  console.log(ko ? `\n${ko} KO` : '\nTout est vert');
  process.exit(ko ? 1 : 0);
})();
