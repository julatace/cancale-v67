// ═════════════════════════════════════════════════════════════════════════════
//  BANC « BUGS-TOTALE — GESTES » (22 nov.) : les gestes que la chasse du 22 nov. n'avait pas pu jouer (ses sélecteurs
//  par texte ne trouvaient rien : « pas de champ », « segment absent », « aucune conversation »). Ici chaque geste est
//  désigné par ses data-* (jamais un libellé) et JUGÉ : ce qui doit s'ouvrir s'ouvre, ce qui doit se fermer se ferme
//  (×, Échap, geste retour), l'écran reste le bon, aucune erreur. Vendeur inventé (_base-volume.cjs).
//  VUES=tel,ordi,tel-sombre,ordi-sombre (défaut tel,ordi)  SORTIE=<dossier>  SEUL=<regex d'un geste>
// ═════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), os = require('os');
const B = require('./_bt-commun.cjs');
const SORTIE = process.env.SORTIE || path.join(os.tmpdir(), 'vrm-bancs', 'bugs-totale-gestes');
fs.mkdirSync(SORTIE, { recursive: true });
const VUES = String(process.env.VUES || 'tel,ordi').split(',').map((x) => x.trim()).filter(Boolean);
const SEUL = process.env.SEUL ? new RegExp(process.env.SEUL) : null;
const { dit, fin } = B.journal('bugs-totale-gestes');

async function main() {
  const { srv, ICI } = await B.serveur();
  const nav = await B.navigateur();
  try {
    for (const vue of VUES) {
      const ordi = !/^tel/.test(vue);
      const base = B.fabriquer({ volumeReel: true, annonces: 300 });
      if (process.env.PIRE) B.pire(base);
      await B.bordereauxLisibles(base);
      const { ctx, pg, J } = await B.ouvrir(nav, vue, base);
      const cap = (n) => pg.screenshot({ path: path.join(SORTIE, `${vue}-${n}.png`) }).catch(() => {});
      const vis = (sel) => pg.evaluate((sel) => [...document.querySelectorAll(sel)].some((e) => { const b = e.getBoundingClientRect(); return b.width > 2 && b.height > 2 && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden],[inert]'); }), sel).catch(() => false);
      const geste = async (nom, f) => {
        if (SEUL && !SEUL.test(nom)) return;
        const e0 = J.erreurs.length;
        try { await f(); } catch (e) { dit(vue, nom, false, 'le geste a pu jouer : ' + String(e && e.message).slice(0, 200)); }
        const err = [...new Set(J.erreurs.slice(e0))].filter((x) => !/Service Worker registration blocked|language detection model/.test(x));
        if (err.length) dit(vue, nom + ' · sans erreur', false, err.slice(0, 4).join(' ¦ '));
      };
      try {
        await B.demarrer(pg, ICI, 'journee');
        // On ferme le toast des N° neufs (il n'est pas jugé ici).
        await pg.locator('[data-toast-numeros] .n-toast-action').click({ timeout: 1500 }).catch(() => {});

        // ── iPhone : un champ en dessous de 16 px fait ZOOMER Safari au toucher (et la page reste zoomée) ──
        if (!ordi) await geste('Champs ≥ 16 px (pas de zoom iOS)', async () => {
          const petits = new Set();
          for (const e of ['journee', 'annonces', 'ventes', 'achats', 'compta', 'messages', 'emails', 'garage', 'settings']) {
            await B.aller(pg, e, 2500);
            const l = await pg.evaluate(() => [...document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=range]):not([type=file]), textarea, select')]
              .filter((x) => x.getClientRects().length && getComputedStyle(x).visibility !== 'hidden' && !x.closest('[hidden],[inert]'))
              .map((x) => ({ fs: parseFloat(getComputedStyle(x).fontSize), id: (x.getAttribute('placeholder') || x.getAttribute('aria-label') || x.name || x.className || x.tagName).slice(0, 40) }))
              .filter((x) => x.fs < 16));
            for (const x of l) petits.add(`${e}: « ${x.id} » ${x.fs}px`);
          }
          dit(vue, 'Champs ≥ 16 px au téléphone (sinon Safari zoome au toucher)', !petits.size, [...petits].slice(0, 12).join(' ¦ '));
        });

        // ── Ventes : saisir un prix d'achat ──
        await geste('Ventes : prix d\'achat saisi', async () => {
          await B.aller(pg, 'ventes', 3500);
          await pg.locator('[data-vt-prix-champ]').filter({ visible: true }).first().waitFor({ timeout: 12000 }).catch(() => {}); const c = pg.locator('[data-vt-prix-champ]').filter({ visible: true }).first();
          if (!(await c.count())) return dit(vue, 'Ventes : un champ prix d\'achat', false, 'aucun [data-vt-prix-champ]');
          const ligne = await c.evaluate((e) => { const r = e.closest('[data-vn-rang], tr, .n-rangee, [data-fiche-ligne]'); return r ? (r.getAttribute('data-vn-rang') || r.getAttribute('data-fiche-ligne') || '') : ''; });
          const n0 = J.ecritures.length;
          await c.click(); await c.fill('40'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(2500);
          const vu = await pg.evaluate(() => [...document.querySelectorAll('.n-vt-relier-prix')].some((e) => /40/.test(e.textContent)));
          const t = await pg.evaluate(() => [...document.querySelectorAll('.n-toast-message, [role="status"]')].map((e) => e.textContent.trim()).filter(Boolean).join(' | ').slice(0, 160));
          await cap('ventes-prix-achat');
          dit(vue, 'Ventes : le prix d\'achat tapé (40) se voit sur la vente', vu, `rangée ${ligne} · ${t}`);
          await pg.waitForTimeout(20000);
          dit(vue, 'Ventes : le prix d\'achat part en base', J.ecritures.length > n0, J.ecritures.slice(n0).join(' ; ').slice(0, 200));
        });

        // ── Ventes : « Imprimer N bordereaux » jusqu'au PDF ──
        await geste('Ventes : imprimer jusqu\'au PDF', async () => {
          await B.aller(pg, 'ventes', 3000);
          const b = pg.locator('[data-colis-barre-btn="imprimer"], [data-vn-plein]').filter({ visible: true }).first();
          if (!(await b.count())) return dit(vue, 'Ventes : le bouton Imprimer', false, 'absent');
          const pages = []; const surPage = (p) => pages.push(p); ctx.on('page', surPage);
          const tel = []; const surDl = (d) => tel.push(d.suggestedFilename()); pg.on('download', surDl);
          await pg.evaluate(() => { window.__btBlobs = []; const o = URL.createObjectURL; URL.createObjectURL = function (x) { try { window.__btBlobs.push({ type: x && x.type, taille: x && x.size }); } catch (_) {} return o.apply(this, arguments); }; window.__btOpen = []; const wo = window.open; window.open = function (u) { window.__btOpen.push(String(u).slice(0, 60)); return wo.apply(this, arguments); }; });
          await b.click(); await pg.waitForTimeout(3000); { const ch = pg.locator('.n-feuille button, [role="dialog"] button').filter({ hasText: /^\s*Classique/, visible: true }).first(); if (await ch.count()) { await cap('imprimer-choix'); await ch.click(); } } await pg.waitForTimeout(8000);
          const r = await pg.evaluate(() => ({ blobs: window.__btBlobs, open: window.__btOpen, feuille: [...document.querySelectorAll('.n-feuille, [role="dialog"]')].filter((e) => e.getClientRects().length).map((e) => (e.innerText || '').replace(/\s+/g, ' ').slice(0, 120)) }));
          await cap('imprimer');
          ctx.off('page', surPage); pg.off('download', surDl);
          const pdf = (r.blobs || []).some((x) => /pdf/.test(x.type || '') && x.taille > 1000) || tel.some((x) => /\.pdf$/i.test(x));
          dit(vue, 'Ventes : « Imprimer » produit un PDF (ou une feuille qui le prépare)', pdf || (r.feuille && r.feuille.length), JSON.stringify({ ...r, telechargements: tel, onglets: pages.length }));
          if (r.feuille && r.feuille.length) {
            await cap('imprimer-feuille');
            await pg.keyboard.press('Escape'); await pg.waitForTimeout(900);
            dit(vue, 'Imprimer : Échap ferme la feuille', !(await vis('.n-feuille, [role="dialog"]')), '');
          }
        });

        // ── Achats : « Relier achats et ventes » s'ouvre, se ferme (Échap, puis retour) ──
        await geste('Achats : Relier', async () => {
          await B.aller(pg, 'achats', 3500);
          const b = pg.locator('[data-glisser-ouvrir="achats"]').filter({ visible: true }).first();
          if (!(await b.count())) return dit(vue, 'Achats : « Relier achats et ventes » se voit', false, '');
          await b.click(); await pg.waitForTimeout(2500);
          const ouvert = await B.feuilleOuverte(pg);
          await cap('relier');
          dit(vue, 'Achats : « Relier achats et ventes » s\'ouvre', ouvert, '');
          await pg.keyboard.press('Escape'); await pg.waitForTimeout(1000);
          const ferme1 = !(await B.feuilleOuverte(pg));
          dit(vue, 'Relier : Échap ferme', ferme1, '');
          if (!ferme1) { await pg.evaluate(() => history.back()); await pg.waitForTimeout(1000); }
          await b.click().catch(() => {}); await pg.waitForTimeout(2000);
          await pg.evaluate(() => history.back()); await pg.waitForTimeout(1300);
          dit(vue, 'Relier : le retour ferme sans quitter Achats', !(await B.feuilleOuverte(pg)) && (await B.ecranMonte(pg)) === 'achats' && pg.url().startsWith(ICI), await B.ecranMonte(pg));
          if (!pg.url().startsWith(ICI)) await B.demarrer(pg, ICI, 'achats');
        });

        // ── La loupe (téléphone : l'icône de la barre ; ordinateur : le champ du haut) ──
        await geste('Loupe', async () => {
          await B.aller(pg, 'ventes', 2500);
          if (!ordi) { const l = pg.locator('[data-n-tete-loupe], [data-recherche-loupe]').filter({ visible: true }).first(); if (await l.count()) { await l.click(); await pg.waitForTimeout(1200); } }
          const champ = pg.locator('input[type="search"]').filter({ visible: true }).first();
          if (!(await champ.count())) return dit(vue, 'Loupe : un champ de recherche', false, 'aucun');
          await champ.fill('22'); await pg.waitForTimeout(2500);
          const t = await pg.evaluate(() => (document.body.innerText.match(/N°\s?22\b[^\n]{0,40}/) || [''])[0]);
          await cap('loupe-22');
          dit(vue, 'Loupe : « 22 » trouve le N° 22', !!t, t);
          await pg.keyboard.press('Escape'); await pg.waitForTimeout(900);
          await B.aller(pg, 'compta', 2000);
          const reste = await pg.evaluate(() => { const i = [...document.querySelectorAll('input[type="search"]')].find((x) => x.getClientRects().length && x.value); return i ? i.value : ''; });
          const panneau = await pg.evaluate(() => /N°\s?22\b/.test((document.querySelector('[data-gs-panneau], [data-loupe-resultats], [role="listbox"]') || {}).innerText || ''));
          await cap('loupe-apres');
          dit(vue, 'Loupe : après Échap et un autre écran, plus de résultats ouverts', !panneau, `champ « ${reste} »`);
        });

        // ── Messages : ouvrir une conversation, la refermer par le geste retour ──
        await geste('Messages : ouvrir un fil, le fermer au retour', async () => {
          await B.aller(pg, 'messages', 3500);
          const fil = pg.locator('[data-fil]').filter({ visible: true }).first();
          if (!(await fil.count())) return dit(vue, 'Messages : un fil se voit', false, 'aucune rangée [data-fil]');
          await fil.click(); await pg.waitForTimeout(2500);
          const ouvert = await vis('.vrm-chat-panel');
          await cap('messages-fil');
          // La bulle d'un message court ne se coupe pas au milieu d'un mot (« Bonj / our »).
          const bulles = await pg.evaluate(() => [...document.querySelectorAll('.vrm-chat-panel .vrm-bulle-t')].filter((e) => e.getClientRects().length).map((e) => { const t = e.textContent.trim(); const rg = document.createRange(); rg.selectNodeContents(e); const lignes = rg.getClientRects().length; const mots = t.split(/\s+/).length; return { t: t.slice(0, 30), lignes, mots }; }));
          const coupees = bulles.filter((b) => b.lignes > b.mots);
          dit(vue, 'Messages : un mot n\'est jamais coupé dans une bulle', bulles.length && !coupees.length, JSON.stringify(coupees.length ? coupees : bulles.slice(0, 3)));
          // L'article du fil : UNE carte (avant : deux blocs qui disaient la même paire), la taille une fois.
          const art = await pg.evaluate(() => ({ n: [...document.querySelectorAll('.vrm-chat-panel .n-fil-article, .vrm-chat-panel .vrm-chat-paire')].filter((e) => e.getClientRects().length).length, t: ((document.querySelector('.vrm-chat-panel .vrm-chat-paire-n') || {}).textContent || '') }));
          dit(vue, 'Messages : l\'article du fil dit une fois', art.n <= 1 && !/taille (\d+[.,]?\d*) · \1\b/.test(art.t), JSON.stringify(art));
          // Le toast ne couvre pas « Répondre dans l'extension » (fil ouvert au téléphone).
          if (!ordi) {
            const cache = await pg.evaluate(() => { const t = document.querySelector('.n-toast'); const b = [...document.querySelectorAll('.vrm-chat-panel button')].filter((x) => x.getClientRects().length).pop(); if (!t || !b) return true; const a = t.getBoundingClientRect(), c = b.getBoundingClientRect(); return a.bottom <= c.top || a.top >= c.bottom; });
            dit(vue, 'Messages : aucun toast posé sur le bouton du bas du fil', cache, '');
          }
          await pg.evaluate(() => history.back()); await pg.waitForTimeout(1500);
          const apres = { url: pg.url(), ecran: await B.ecranMonte(pg), ouvert: ordi ? null : await vis('.vrm-chat-panel') };
          dit(vue, 'Messages : le retour ferme le fil sans quitter Messages', ouvert && apres.url.startsWith(ICI) && apres.ecran === 'messages' && (ordi || apres.ouvert === false), JSON.stringify({ ouvert, ...apres }));
          if (!apres.url.startsWith(ICI)) await B.demarrer(pg, ICI, 'messages');
        });

        // ── Argent : chaque segment, puis ceux de Statistiques ──
        await geste('Argent : segments', async () => {
          await B.aller(pg, 'compta', 3000);
          const segs = await pg.evaluate(() => [...document.querySelectorAll('.vrm-main [role="radio"], .vrm-main [role="tab"]')].filter((e) => e.getClientRects().length).map((e) => e.innerText.trim()).filter(Boolean));
          dit(vue, 'Argent : des segments se voient', segs.length >= 4, segs.join(' | '));
          for (const s of ['Mois', 'Statistiques', 'Déclarer', 'Factures']) {
            const b = pg.locator('.vrm-main [role="radio"], .vrm-main [role="tab"]').filter({ hasText: new RegExp('^\\s*' + s), visible: true }).first();
            if (!(await b.count())) { dit(vue, `Argent · ${s} : le segment existe`, false, segs.join(' | ')); continue; }
            await b.click(); await pg.waitForTimeout(2200);
            const etat = await b.evaluate((e) => e.getAttribute('aria-checked') || e.getAttribute('aria-selected') || '').catch(() => '');
            const souci = await pg.evaluate(() => /Cet écran a un souci|Something went wrong/.test(document.body.innerText));
            await cap('argent-' + s.normalize('NFD').replace(/\W+/g, ''));
            dit(vue, `Argent · ${s} : choisi et rendu`, /true/.test(etat) && !souci, `état ${etat}`);
            if (s === 'Statistiques') {
              for (const t of ['Pilotage', 'Finances', 'Transporteurs', '7 j', '30 j', '90 j']) {
                const c = pg.locator('.vrm-main [role="radio"], .vrm-main [role="tab"]').filter({ hasText: new RegExp('^\\s*' + t.replace(' ', '\\s*') + '\\s*$'), visible: true }).first();
                if (!(await c.count())) { dit(vue, `Statistiques · ${t} : le segment existe`, false, ''); continue; }
                await c.click(); await pg.waitForTimeout(1500);
                const e2 = await c.evaluate((e) => e.getAttribute('aria-checked') || e.getAttribute('aria-selected') || '').catch(() => '');
                const attente = await pg.evaluate(() => ((document.querySelector('.vrm-main') || document.body).innerText.match(/Je lis [^.\n]{0,40}|Chargement[^.\n]{0,20}/g) || []).join(' | '));
                await cap('stats-' + t.replace(/\W+/g, ''));
                dit(vue, `Statistiques · ${t} : choisi et rendu`, /true/.test(e2), `état ${e2}${attente ? ' · attente : ' + attente : ''}`);
              }
            }
          }
        });

        // ── Annonces : chaque segment (téléphone) ──
        if (!ordi) await geste('Annonces : segments', async () => {
          await B.aller(pg, 'annonces', 3000);
          const n = await pg.locator('.vrm-main [data-eg-segment]').count();
          for (let i = 0; i < n; i++) {
            const b = pg.locator('.vrm-main [data-eg-segment]').nth(i);
            const t = (await b.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
            await b.click(); await pg.waitForTimeout(1500);
            const e = await b.getAttribute('aria-checked').catch(() => '');
            await cap('annonces-seg-' + i);
            dit(vue, `Annonces · ${t} : choisi`, e === 'true', e);
          }
        });

        // ── Paramètres : chaque rangée ouvre sa page, le retour revient à la liste ──
        await geste('Paramètres : chaque sous-page', async () => {
          await B.aller(pg, 'settings', 2500);
          const n = await pg.locator('button.vrm-set-ligne, button[data-categorie-ouvrir]').filter({ visible: true }).count();
          dit(vue, 'Paramètres : des rangées se voient', n >= 6, String(n));
          for (let i = 0; i < n; i++) {
            const b = pg.locator('button.vrm-set-ligne, button[data-categorie-ouvrir]').filter({ visible: true }).nth(i);
            if (!(await b.count())) { await B.aller(pg, 'settings', 2000); continue; }
            const t = (await b.innerText().catch(() => '')).split('\n')[0].trim();
            await b.click(); await pg.waitForTimeout(1500);
            const r = await pg.evaluate(() => ({ e: document.querySelector('#vrm-contenu')?.dataset.ecran || '', sous: !!document.querySelector('[data-sous-ecran-ouvert], .vrm-set[data-sous-ecran-ouvert]'), souci: /Cet écran a un souci|Something went wrong/.test(document.body.innerText), h: ([...document.querySelectorAll('.vrm-main h2, .vrm-main h1')].filter((x) => x.getClientRects().length).map((x) => x.innerText.trim()).join(' / ')).slice(0, 80) }));
            await cap('param-' + i);
            dit(vue, `Paramètres · ${t} : s'ouvre`, !r.souci && (r.e === 'settings' || r.e === 'vintedaccounts' || r.e === 'automatisations'), JSON.stringify(r));
            if (!ordi) {
              // UN retour visible, qui dit où il mène (avant : « ‹ Menu » dans la barre et « ‹ Paramètres » dans la page).
              const retours = await pg.evaluate(() => [...document.querySelectorAll('.n-barre-retour, .ux-pm-retour, .vrm-settings-back')].filter((x) => x.getClientRects().length && getComputedStyle(x).visibility !== 'hidden').map((x) => x.innerText.trim()));
              dit(vue, `Paramètres · ${t} : un seul retour, vers Paramètres`, retours.length === 1 && !/^Menu$/.test(retours[0]), JSON.stringify(retours));
              await pg.evaluate(() => history.back()); await pg.waitForTimeout(1300);
              const ap = { url: pg.url(), e: await B.ecranMonte(pg), liste: await pg.locator('button.vrm-set-ligne, button[data-categorie-ouvrir]').filter({ visible: true }).count() };
              dit(vue, `Paramètres · ${t} : le retour revient à la liste`, ap.url.startsWith(ICI) && ap.e === 'settings' && ap.liste >= 6, JSON.stringify(ap));
              if (!ap.url.startsWith(ICI) || ap.e !== 'settings' || ap.liste < 6) { if (!ap.url.startsWith(ICI)) await B.demarrer(pg, ICI, 'settings'); else await B.aller(pg, 'settings', 2000); }
            }
          }
        });

        // ── Clair / sombre par le Menu ──
        if (!ordi) await geste('Mode sombre par le Menu', async () => {
          await B.aller(pg, 'menu', 2000);
          const s = pg.locator('.vrm-main [role="switch"], .vrm-main input[type="checkbox"]').filter({ hasText: /sombre/i });
          const lig = pg.locator('.vrm-main *').filter({ hasText: /^Mode sombre$/ }).first();
          const avant = await pg.evaluate(() => document.documentElement.dataset.theme || '');
          if (await s.count()) await s.first().click(); else await lig.click().catch(() => {});
          await pg.waitForTimeout(1200);
          const apres = await pg.evaluate(() => ({ theme: document.documentElement.dataset.theme || '', fond: getComputedStyle(document.body).backgroundColor }));
          await cap('menu-sombre');
          dit(vue, 'Mode sombre par le Menu : le thème change', apres.theme !== avant, JSON.stringify({ avant, ...apres }));
          await B.aller(pg, 'ventes', 2000); await cap('ventes-sombre');
          if (await s.count()) await s.first().click(); else { await B.aller(pg, 'menu', 1500); await lig.click().catch(() => {}); }
          await pg.waitForTimeout(800);
        });
      } catch (e) { dit(vue, 'le parcours a pu jouer', false, e && e.message); }
      await ctx.close();
    }
  } finally { await nav.close(); srv.close(); }
  process.exit(fin(SORTIE) ? 1 : 0);
}
main();
