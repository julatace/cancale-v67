// ═════════════════════════════════════════════════════════════════════════════
//  BANC « BUGS-TOTALE » (22 nov., Julien : « l'app bug beaucoup trop », « fais tout »).
//  Chaque contrôle est un bug VU (capture regardée) puis corrigé ; il échoue sur le build d'avant (`BANC_DIST=<dist d'avant>`)
//  et passe après. Vendeur inventé (_base-volume.cjs), design par défaut. Un banc ne meurt pas : il rapporte.
//  VUES=tel,ordi (défaut : les deux)  SORTIE=<dossier des captures>  NAVIGATEUR=webkit (Safari, si installé)
// ═════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), os = require('os');
const B = require('./_bt-commun.cjs');
const SORTIE = process.env.SORTIE || path.join(os.tmpdir(), 'vrm-bancs', 'bugs-totale');
fs.mkdirSync(SORTIE, { recursive: true });
const VUES = String(process.env.VUES || 'tel,ordi').split(',').map((x) => x.trim()).filter(Boolean);
const SEUL = process.env.SEUL ? new RegExp(process.env.SEUL) : null;
const { dit, fin } = B.journal('bugs-totale');

async function main() {
  const { srv, ICI } = await B.serveur();
  const nav = await B.navigateur();
  try {
    for (const vue of VUES) {
      const ordi = !/^tel/.test(vue);
      const base = B.fabriquer({ volumeReel: true, annonces: 300 });
      const { ctx, pg, J } = await B.ouvrir(nav, vue, base);
      const cap = (n) => pg.screenshot({ path: path.join(SORTIE, `${vue}-${n}.png`) }).catch(() => {});
      const essai = async (nom, f) => { if (SEUL && !SEUL.test(nom)) return; try { await f(); } catch (e) { dit(vue, nom, false, 'le geste a pu jouer : ' + (e && e.message)); } };
      try {
        // Le toast des N° neufs : posé UNE fois, il ne se remonte pas à chaque nouveau N° (il clignotait et ne partait jamais).
        await pg.addInitScript(() => {
          window.__btToasts = 0;
          new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1 && (n.matches('.n-toast') || n.querySelector && n.querySelector('.n-toast'))) window.__btToasts++; })
            .observe(document, { childList: true, subtree: true });
        });
        await B.demarrer(pg, ICI, 'journee');
        await essai('toast des N° : part seul en ~10 s, même en changeant d\'écran', async () => {
          // Il vit dans l'écran : avant, chaque écran le remontait avec 10 s neuves (il suivait sur chaque écran jusqu'à « Fermer »).
          const vu0 = await pg.evaluate(() => !!document.querySelector('[data-toast-numeros] .n-toast'));
          await cap('toast');
          for (const e of ['ventes', 'achats', 'annonces', 'compta', 'journee']) await B.aller(pg, e, 3200);
          const encore = await pg.evaluate(() => { const t = document.querySelector('[data-toast-numeros] .n-toast-message'); return t ? t.textContent : ''; });
          await cap('toast-apres-16s');
          dit(vue, 'toast des N° : part seul en ~10 s, même en changeant d\'écran', vu0 && !encore, `montré au départ : ${vu0} · après 16 s et 5 écrans : « ${encore.slice(0, 50)} »`);
        });

        // E-mails : le « ? » sur la ligne du titre (il tombait seul sous le titre).
        await essai('E-mails : le « ? » à côté du titre', async () => {
          await B.aller(pg, 'emails', 2500);
          const r = await pg.evaluate(() => { const h = document.querySelector('.vrm-main h1'); const a = document.querySelector('.vrm-main [data-aide-ouvrir]'); if (!h || !a) return null; const bh = h.getBoundingClientRect(), ba = a.getBoundingClientRect(); return { h: [Math.round(bh.top), Math.round(bh.bottom)], a: Math.round(ba.top + ba.height / 2) }; });
          await cap('emails');
          dit(vue, 'E-mails : le « ? » à côté du titre', r && r.a > r.h[0] && r.a < r.h[1], JSON.stringify(r));
        });

        // Paramètres : le « ? » colle au titre (au téléphone il partait à droite, « Sur cet appareil seulement » orphelin).
        await essai('Paramètres : le « ? » à côté du titre', async () => {
          await B.aller(pg, 'settings', 2500);
          const r = await pg.evaluate(() => { const h = document.querySelector('.vrm-set-tete .vrm-set-h1'); const a = document.querySelector('.vrm-set-tete [data-aide-ouvrir]'); if (!h || !a) return null; const rg = document.createRange(); rg.selectNodeContents(h); const fin = rg.getBoundingClientRect().right; const ba = a.getBoundingClientRect(); const st = document.querySelector('.vrm-set-tete > .vrm-settings-status'); const bs = st ? st.getBoundingClientRect() : null; return { finTitre: Math.round(fin), aide: Math.round(ba.left), statut: bs ? Math.round(bs.left) : null, gauche: Math.round(h.getBoundingClientRect().left) }; });
          await cap('parametres');
          dit(vue, 'Paramètres : le « ? » à côté du titre', r && r.aide - r.finTitre < 24, JSON.stringify(r));
          if (!ordi) dit(vue, 'Paramètres (tél.) : « Sur cet appareil seulement » sous le titre, à gauche', r && (r.statut == null || Math.abs(r.statut - r.gauche) < 6), JSON.stringify(r));
        });

        // Un segmenté de 4 choix (Annonces) : aucun libellé coupé (« En li… 264 »).
        await essai('Annonces : libellés du segmenté entiers', async () => {
          await B.aller(pg, 'annonces', 3500);
          const r = await pg.evaluate(() => [...document.querySelectorAll('.vrm-main .n-segmente-libelle')].filter((e) => e.getClientRects().length).map((e) => ({ t: e.textContent, cw: e.clientWidth, sw: e.scrollWidth })));
          await cap('annonces');
          const coupes = r.filter((x) => x.sw > x.cw + 0.5);
          dit(vue, 'Annonces : libellés du segmenté entiers', (ordi || r.length) && !coupes.length, JSON.stringify(coupes.length ? coupes : r.map((x) => x.t)));
          // La fiche d'un article dont la photo ne se charge pas : pas un carré vide de 45 % de l'écran.
          const rang = pg.locator('.vrm-main [data-fiche-ligne], .vrm-main [data-eg-article], .vrm-main .n-rangee[role="button"]').filter({ visible: true }).first();
          if (await rang.count()) {
            await rang.click(); await pg.waitForTimeout(6000);
            const f = await pg.evaluate(() => { const d = [...document.querySelectorAll('.nf-defile')].find((x) => x.getClientRects().length); if (!d) return null; return { h: Math.round(d.getBoundingClientRect().height), vh: innerHeight, etats: [...d.querySelectorAll('[data-photo-vinted]')].map((x) => x.getAttribute('data-photo-vinted')).join(',') }; });
            await cap('fiche-sans-photo');
            dit(vue, 'Fiche : photo absente ⇒ bande basse (pas un carré vide)', f && (!/perdue/.test(f.etats) || /natif|secours/.test(f.etats) || f.h < f.vh * 0.25), JSON.stringify(f));
            await pg.keyboard.press('Escape'); await pg.waitForTimeout(800);
            if (await pg.evaluate(() => [...document.querySelectorAll('.nf-defile')].some((x) => x.getClientRects().length))) { await pg.evaluate(() => history.back()); await pg.waitForTimeout(1000); }
          }
        });

        // La feuille « Régler dans l'extension » : sa phrase ne colle pas au bord.
        await essai('Feuille extension : marge de la phrase', async () => {
          await B.aller(pg, 'automatisations', 2500);
          const r = await pg.evaluate(() => { const p = [...document.querySelectorAll('[data-vrm-panneau-explique]')].find((x) => x.getClientRects().length); if (!p) return null; const f = p.closest('.n-feuille, [role="dialog"]') || document.body; return { g: Math.round(p.getBoundingClientRect().left - f.getBoundingClientRect().left), d: Math.round(f.getBoundingClientRect().right - p.getBoundingClientRect().right) }; });
          await cap('feuille-extension');
          dit(vue, 'Feuille « Régler dans l\'extension » : la phrase a sa marge', r && r.g >= 12 && r.d >= 12, JSON.stringify(r));
          await pg.keyboard.press('Escape'); await pg.waitForTimeout(800);
        });

        if (!ordi) {
          // Comptes liés : UN retour, qui dit où il mène (avant : « ‹ Menu » dans la barre ET « ‹ Paramètres » dans la page).
          await essai('Comptes liés : un seul retour', async () => {
            await B.aller(pg, 'vintedaccounts', 2500);
            const r = await pg.evaluate(() => { const vis = (e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden'; const barre = [...document.querySelectorAll('.n-barre-retour')].filter(vis).map((e) => e.innerText.trim()); const page = [...document.querySelectorAll('.vrm-settings-back')].filter(vis).map((e) => e.innerText.trim()); return { barre, page }; });
            await cap('comptes-lies');
            dit(vue, 'Comptes liés : un seul retour, vers Paramètres', r.barre.length + r.page.length === 1 && /Paramètres/.test(r.barre.concat(r.page).join('')), JSON.stringify(r));
            const b = pg.locator('.n-barre-retour').filter({ visible: true }).first();
            if (await b.count()) { await b.click(); await pg.waitForTimeout(1500); const e = await B.ecranMonte(pg); dit(vue, 'Comptes liés : « ‹ Paramètres » mène à Paramètres', e === 'settings', e); }
          });
        }

        if (ordi) {
          // Aujourd'hui : un grand titre, et une carte seule sur sa rangée prend toute la largeur (Colis, Dernières ventes).
          await essai('Aujourd\'hui (ordi) : titre et largeur', async () => {
            await B.aller(pg, 'journee', 3500);
            const r = await pg.evaluate(() => { const h = [...document.querySelectorAll('.vrm-main h1')].find((x) => x.getClientRects().length); const c = document.querySelector('.n-colonnes'); const cw = c ? c.getBoundingClientRect().width : 0; const cartes = [...document.querySelectorAll('.n-colonnes > .n-colonne')].filter((x) => x.getBoundingClientRect().height > 20).map((x) => { const b = x.getBoundingClientRect(); return { y: Math.round(b.top), w: Math.round(b.width), t: (x.innerText || '').trim().split('\n')[0].slice(0, 20) }; }); const seules = cartes.filter((x) => x.w < cw * 0.6 && !cartes.some((y) => y !== x && Math.abs(y.y - x.y) < 4)); return { titre: h ? h.innerText : '', cw: Math.round(cw), seules }; });
            await cap('journee');
            dit(vue, 'Aujourd\'hui (ordi) : un grand titre', /Aujourd/.test(r.titre), r.titre);
            dit(vue, 'Aujourd\'hui (ordi) : aucune demi-carte seule sur sa rangée', !r.seules.length, JSON.stringify(r.seules));
          });
          // Ventes : le volet du détail se ferme au retour, sans quitter Ventes.
          await essai('Ventes (ordi) : le retour ferme le volet', async () => {
            await B.aller(pg, 'ventes', 3000);
            const t = pg.locator('.vrm-main .n-tt-article-titre').filter({ visible: true }).first();
            if (!(await t.count())) return dit(vue, 'Ventes (ordi) : le retour ferme le volet', false, 'aucune rangée');
            await t.click(); await pg.waitForTimeout(1200);
            const ouvert = await pg.evaluate(() => !!document.querySelector('.n-vt-volet'));
            await cap('ventes-volet');
            await pg.evaluate(() => history.back()); await pg.waitForTimeout(1500);
            const apres = { url: pg.url(), ecran: await B.ecranMonte(pg), volet: await pg.evaluate(() => !!document.querySelector('.n-vt-volet')).catch(() => null) };
            await cap('ventes-volet-retour');
            dit(vue, 'Ventes (ordi) : le retour ferme le volet', ouvert && apres.url.startsWith(ICI) && apres.ecran === 'ventes' && apres.volet === false, JSON.stringify({ ouvert, ...apres }));
            if (!apres.url.startsWith(ICI) || apres.ecran !== 'ventes') { await B.demarrer(pg, ICI, 'ventes'); }
          });
          await essai('Ventes (ordi) : × puis retour reste dans l\'app', async () => {
            await B.aller(pg, 'ventes', 2000);
            const t = pg.locator('.vrm-main .n-tt-article-titre').filter({ visible: true }).nth(1);
            await t.click(); await pg.waitForTimeout(1000);
            await pg.locator('[data-vt-fermer]').click().catch(() => {}); await pg.waitForTimeout(1200);
            const ferme = await pg.evaluate(() => !document.querySelector('.n-vt-volet'));
            dit(vue, 'Ventes (ordi) : × ferme le volet', ferme, '');
            const st = await pg.evaluate(() => JSON.stringify(history.state || {}));
            dit(vue, 'Ventes (ordi) : après ×, aucune entrée d\'historique fantôme', !/vrmFeuille/.test(st), st);
          });

          // Achats : la colonne de droite commence en haut (« À régler » ne la pousse plus sous la colonne des codes).
          await essai('Achats (ordi) : deux colonnes', async () => {
            await B.aller(pg, 'achats', 5000);
            const r = await pg.evaluate(() => {
              const t = document.querySelector('.vrm-tache[data-tache="achats"]'); if (!t) return null;
              const rep = t.querySelector(':scope > .vrm-achats-retirer-repli');
              const n = rep ? rep.getAttribute('data-retirer-n') : null;
              const droite = [...t.children].filter((x) => x !== rep && !x.matches('.v2-tete-tache, .v2-cache') && x.getBoundingClientRect().height > 0).map((x) => { const b = x.getBoundingClientRect(); return { c: String(x.className).split(' ')[0], x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width) }; });
              const rb = rep ? rep.getBoundingClientRect() : null;
              return { n, rep: rb ? { x: Math.round(rb.left), d: Math.round(rb.right), y: Math.round(rb.top), b: Math.round(rb.bottom), h: Math.round(rb.height) } : null, droite };
            });
            await cap('achats');
            // La colonne des codes posée à gauche (étroite) ⇒ TOUT le reste est à sa droite, et commence en haut.
            let ok = !!r;
            if (r && r.rep && r.rep.h > 0 && (r.rep.d - r.rep.x) < 700) ok = r.droite.every((d) => d.x >= r.rep.d) && r.droite.length > 0 && r.droite[0].y < r.rep.y + 200;
            dit(vue, 'Achats (ordi) : rien n\'est posé sous la colonne des codes (haut droit rempli)', ok, JSON.stringify(r));
            // Le tableau tient dans sa colonne : sa dernière colonne (Statut) se voit sans défiler.
            const tt = await pg.evaluate(() => { const c = document.querySelector('.vrm-tache[data-tache="achats"] .n-tt-cadre'); if (!c) return null; return { cw: c.clientWidth, sw: c.scrollWidth }; });
            dit(vue, 'Achats (ordi) : le tableau tient dans sa colonne (Statut visible)', tt && tt.sw <= tt.cw + 2, JSON.stringify(tt));
            // La calculette : son nom se lit (avant : « € » seul sur une bande grise qui dépassait de la colonne).
            const c = await pg.evaluate(() => { const b = [...document.querySelectorAll('.vrm-main [data-achats-calculette]')].find((x) => x.getClientRects().length); if (!b) return null; const s = getComputedStyle(b); const r = b.getBoundingClientRect(); const col = b.closest('.vrm-market-space'); const rc = col ? col.getBoundingClientRect() : null; return { couleur: s.color, w: Math.round(r.width), texte: b.innerText.trim(), dedans: rc ? r.right <= rc.right + 1 : null }; });
            dit(vue, 'Achats (ordi) : « Calculette » se lit en entier', c && !/rgba\(0, 0, 0, 0\)/.test(c.couleur) && c.w > 80 && /Calculette/.test(c.texte), JSON.stringify(c));
          });
        }
        const err = [...new Set(J.erreurs)].filter((e) => !/Service Worker registration blocked/.test(e));
        dit(vue, 'aucune erreur JS ni avertissement React', !err.length, err.slice(0, 6).join(' ¦ '));
      } catch (e) { dit(vue, 'le parcours a pu jouer', false, e && e.message); }
      await ctx.close();
    }
  } finally { await nav.close(); srv.close(); }
  process.exit(fin(SORTIE) ? 1 : 0);
}
main();
