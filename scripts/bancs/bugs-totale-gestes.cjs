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
          const n = await pg.locator('button.vrm-set-ligne').filter({ visible: true }).count();
          dit(vue, 'Paramètres : des rangées se voient', n >= 6, String(n));
          for (let i = 0; i < n; i++) {
            const b = pg.locator('button.vrm-set-ligne').filter({ visible: true }).nth(i);
            if (!(await b.count())) { await B.aller(pg, 'settings', 2000); continue; }
            const t = (await b.innerText().catch(() => '')).split('\n')[0].trim();
            await b.click(); await pg.waitForTimeout(1500);
            const r = await pg.evaluate(() => ({ e: document.querySelector('#vrm-contenu')?.dataset.ecran || '', sous: !!document.querySelector('[data-sous-ecran-ouvert], .vrm-set[data-sous-ecran-ouvert]'), souci: /Cet écran a un souci|Something went wrong/.test(document.body.innerText), h: ([...document.querySelectorAll('.vrm-main h2, .vrm-main h1')].filter((x) => x.getClientRects().length).map((x) => x.innerText.trim()).join(' / ')).slice(0, 80) }));
            await cap('param-' + i);
            dit(vue, `Paramètres · ${t} : s'ouvre`, !r.souci && (r.e === 'settings' || r.e === 'vintedaccounts' || r.e === 'automatisations'), JSON.stringify(r));
            if (!ordi) {
              await pg.evaluate(() => history.back()); await pg.waitForTimeout(1300);
              const ap = { url: pg.url(), e: await B.ecranMonte(pg), liste: await pg.locator('button.vrm-set-ligne').filter({ visible: true }).count() };
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
