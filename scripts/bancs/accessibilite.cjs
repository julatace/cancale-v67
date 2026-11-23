// ════════════════════════════════════════════════════════════════════════════
//  BANC « ACCESSIBILITÉ WCAG 2.1 AA » (11 nov., lot accessibilité).
//  Données INVENTÉES (socle `_a11y.cjs` : un compte Vinted, quatre annonces, trois ventes dont
//  une à expédier avec son bordereau, un achat ; une annonce Leboncoin, eBay, Vestiaire),
//  aucune fx/, aucune écriture réelle.
//
//  A. axe-core (paquet npm `axe-core`, version exacte en devDependency) sur CHAQUE écran
//     principal (17 : Ma journée, Annonces, Ventes, Colis, Messages, Achats, Stock, Argent,
//     À trancher, E-mails, Paramètres, Statistiques, Communauté, Leboncoin, eBay, Vestiaire,
//     Organisation), à 390 px tactile et 1512 px, en clair ET en sombre : règles wcag2a,
//     wcag2aa, wcag21a, wcag21aa, + `aria-allowed-role` et `aria-dialog-name`. Toute violation
//     « serious »/« critical » (et toute violation de ces deux-là) est ROUGE (EXCEPTIONS du socle,
//     une par une, justifiée — vide). Les « moderate »/« minor » sont seulement dites.
//  B. Zones tactiles (390 px, clair) : chaque bouton visible offre 44 × 44 px au doigt.
//  C. Les FEUILLES principales (390 et 1512, clair et sombre), axe DANS la feuille ouverte :
//     fiche d'une paire (« Tout sur le N° »), fiche d'une vente, Nouvel achat, « Tout imprimer »,
//     la confirmation avant impression (N° « à vérifier sur son carton »).
//     Et la feuille « ? » : Échap la ferme et le focus REVIENT au bouton d'avant.
//  D. La page : <html lang="fr"> et un <title> qui nomme VRM.
//  E. (17 nov., audit WCAG 2.1 AA — `_a11y-mesure.cjs`) sur les 7 écrans de l'audit (Ma journée, Ventes,
//     Achats, Colis, Annonces, Argent, Paramètres), à 390 tactile clair et sombre et à 1512 clair :
//      E1 CONTRASTE MESURÉ SUR LES PIXELS (le fond tel qu'il s'affiche : verre, dégradé bleu) — aucun
//         texte sous 4,5:1 (3:1 en grand) ; E2 (390 clair) chaque contrôle offre 44 × 44 au doigt (un
//         lien dans une phrase est exempté) ; E3 aucun contrôle sans nom dans l'arbre de Chrome ;
//      E4 (1512) 45 Tab : le premier arrêt est le lien d'évitement, la navigation passe AVANT l'écran,
//         aucun arrêt dans les suggestions de la recherche, aucun arrêt invisible (0 px), un contour
//         à chaque arrêt ; Paramètres porte un h1 ;
//      E5 la fiche « Tout sur le N° » (390 et 1512) : le focus y ENTRE, 30 Tab restent DEDANS, Échap
//         la ferme et le focus REVIENT.
//     BANC_MUTATION=contraste|focus|cibles|noms|fiche sabote après l'ouverture : E doit sortir ROUGE.
//  Le zoom 200 % et le clavier seul : `accessibilite-clavier.cjs`.
//  BANC_PORT, BANC_DIST, BANC_CAPTURES, BANC_LARGEUR=390|1512, BANC_ECRANS=a,b, BANC_SEUL=A|C|E, BANC_DUMP=1, BANC_MUTATION.
// ════════════════════════════════════════════════════════════════════════════
const A = require('./_a11y.cjs');
const M = require('./_a11y-mesure.cjs');
const { dit, essaie } = A;

// Les feuilles : comment l'ouvrir, et où passer axe (la feuille du dessus).
const FEUILLES = [
  { id: 'fiche', nom: 'fiche d’une paire', tab: 'annonces', ctx: '[role="dialog"]',
    ouvrir: (pg) => pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:fiche-paire', { detail: '12' }))) },
  { id: 'vente', nom: 'fiche d’une vente', url: '?tab=ventes&site=vinted', ctx: '[role="dialog"]',
    ouvrir: (pg) => pg.locator('.vrm-ledger-sale-toggle').first().click() },
  { id: 'achat', nom: 'Nouvel achat', url: '?tab=achats&achat=1', ctx: 'main', ouvrir: async () => {},
    pret: (pg) => pg.evaluate(() => /Ce que tu as acheté/.test(document.body.innerText)) },
  { id: 'lot', nom: '« Tout imprimer »', tab: 'cat_bord', attente: 8000, ctx: '[role="dialog"]',
    ouvrir: (pg) => pg.locator('button[data-lot-ouvrir="1"]').first().click() },
  { id: 'confirmation', nom: 'confirmation avant impression', tab: 'cat_bord', attente: 8000, ctx: '.vrm-confirmation',
    ouvrir: async (pg) => { await pg.locator('button[data-lot-ouvrir="1"]').first().click(); await pg.waitForTimeout(900); await pg.locator('button[data-lot-imprimer]').first().click(); },
    pret: (pg) => pg.evaluate(() => !!document.querySelector('.vrm-confirmation')) },
];
const dialogues = (pg) => pg.evaluate(() => [...document.querySelectorAll('[role="dialog"],[role="alertdialog"]')].filter((e) => e.getClientRects().length).length);

async function main() {
  A.srv.listen(A.PORT);
  const b = await A.lancerNavigateur();
  const ECR = (process.env.BANC_ECRANS || '').split(',').filter(Boolean);
  const SEUL = process.env.BANC_SEUL || '';
  const largeurs = [390, 1512].filter((l) => !process.env.BANC_LARGEUR || String(l) === process.env.BANC_LARGEUR);
  try {
    // ── A/B/D. Les écrans ───────────────────────────────────────────────────
    for (const largeur of largeurs) {
      if (SEUL && SEUL !== 'A') break;
      for (const sombre of [false, true]) {
        const T = `${largeur < 700 ? '📱' : '🖥️'}${sombre ? '🌙' : '☀️'}`;
        for (const [tab, nom, url] of A.ECRANS) {
          if (ECR.length && !ECR.includes(tab)) continue;
          await essaie(`${T} ${nom}`, async () => {
            const { pg, ctx, errs } = await A.ouvrir(b, { largeur, sombre, tab, url });
            await A.capture(pg, `${tab}-${largeur}-${sombre ? 'sombre' : 'clair'}`);
            A.juger(T, nom, await A.axe(pg));
            if (largeur < 700 && !sombre) {
              const p = await A.petitesCibles(pg);
              dit(p.length === 0, `${T} ${nom} · B chaque bouton offre 44 × 44 px au doigt`, `${p.length} : ` + p.slice(0, 6).join(' ║ '));
            }
            if (tab === 'journee' && !sombre) {
              const d = await pg.evaluate(() => ({ lang: document.documentElement.getAttribute('lang'), titre: document.title }));
              dit(d.lang === 'fr', `${T} D <html lang="fr">`, JSON.stringify(d));
              dit(/\S/.test(d.titre || '') && /VRM/.test(d.titre), `${T} D la page a un titre`, JSON.stringify(d));
            }
            dit(errs.length === 0, `${T} ${nom} · aucune erreur de page`, errs.slice(0, 2).join(' | '));
            await ctx.close();
          });
        }
      }
    }
    // ── C. Les feuilles ─────────────────────────────────────────────────────
    for (const largeur of largeurs) {
      if (ECR.length || (SEUL && SEUL !== 'C')) break;
      for (const sombre of [false, true]) {
        const T = `${largeur < 700 ? '📱' : '🖥️'}${sombre ? '🌙' : '☀️'}`;
        for (const F of FEUILLES) {
          await essaie(`${T} feuille ${F.nom}`, async () => {
            const { pg, ctx, errs } = await A.ouvrir(b, { largeur, sombre, tab: F.tab, url: F.url, attente: F.attente });
            const avant = await dialogues(pg);
            await F.ouvrir(pg);
            await pg.waitForTimeout(1500);
            const ouverte = F.pret ? await F.pret(pg) : (await dialogues(pg)) > avant;
            dit(ouverte, `${T} C ${F.nom} s'ouvre`);
            await A.capture(pg, `feuille-${F.id}-${largeur}-${sombre ? 'sombre' : 'clair'}`);
            if (ouverte) A.juger(T, `feuille ${F.nom}`, await A.axe(pg, F.ctx));
            dit(errs.length === 0, `${T} feuille ${F.nom} · aucune erreur de page`, errs.slice(0, 2).join(' | '));
            await ctx.close();
          });
        }
        // La feuille « ? » : le focus rendu à la fermeture (ordinateur : « ? » est un raccourci clavier).
        if (largeur < 700) continue;
        await essaie(`${T} feuille « ? »`, async () => {
          const { pg, ctx, errs } = await A.ouvrir(b, { largeur, sombre, tab: 'journee' });
          const avant = await pg.evaluate(() => {
            const c = [...document.querySelectorAll('main button:not([disabled])')].find((e) => e.getClientRects().length);
            if (!c) return null; c.setAttribute('data-banc-avant', '1'); c.focus(); return document.activeElement === c;
          });
          await pg.keyboard.press('Shift+?'); await pg.waitForTimeout(800);
          const ouverte = await pg.evaluate(() => !!document.querySelector('[data-raccourcis-clavier]'));
          dit(avant && ouverte, `${T} C la feuille des raccourcis s'ouvre (un bouton focalisé avant)`, JSON.stringify({ avant, ouverte }));
          A.juger(T, 'feuille « ? »', await A.axe(pg, '[role="dialog"]'));
          await pg.keyboard.press('Escape'); await pg.waitForTimeout(700);
          const rendu = await pg.evaluate(() => ({ ferme: !document.querySelector('[data-raccourcis-clavier]'), retour: !!(document.activeElement && document.activeElement.hasAttribute('data-banc-avant')), actif: (document.activeElement && document.activeElement.outerHTML || '').slice(0, 100) }));
          dit(rendu.ferme && rendu.retour, `${T} C Échap ferme la feuille et rend le focus au bouton d'avant`, JSON.stringify(rendu));
          dit(errs.length === 0, `${T} feuille « ? » · aucune erreur de page`, errs.slice(0, 2).join(' | '));
          await ctx.close();
        });
      }
    }

    // ── E. L'audit WCAG du 17 nov. : contraste mesuré, 44 px, noms, clavier, la fiche ──
    const MUT = process.env.BANC_MUTATION || '';
    const saboter = async (pg) => {
      const css = {
        contraste: '@layer vrm-a11y{.vrm-main [data-ann-resume],.vrm-main [data-ann-resume] *,.vrm-achats-sources :is(.vrm-ms-hors,.vrm-ms-calcul>summary){color:#3F5468!important}}',
        focus: '@layer vrm-a11y{:focus-visible,:focus{outline:none!important;box-shadow:none!important}}',
        cibles: '@layer vrm-a11y{button.vrm-cible-44::before{content:none!important}}',
      }[MUT];
      if (css) await pg.addStyleTag({ content: css });
      if (MUT === 'noms') await pg.evaluate(() => { for (const b of document.querySelectorAll('.vrm-toutes-ligne')) { b.removeAttribute('aria-label'); b.style.contentVisibility = 'hidden'; } });
    };
    const ECRANS_E = [['journee', 'Ma journée'], ['ventes', 'Ventes'], ['achats', 'Achats'], ['cat_bord', 'Colis'], ['annonces', 'Annonces'], ['compta', 'Argent'], ['settings', 'Paramètres']];
    for (const [largeur, sombre] of [[390, false], [390, true], [1512, false]]) {
      if (SEUL && SEUL !== 'E') break;
      if (process.env.BANC_LARGEUR && String(largeur) !== process.env.BANC_LARGEUR) continue;
      const T = `${largeur < 700 ? '📱' : '🖥️'}${sombre ? '🌙' : '☀️'}`;
      for (const [tab, nom] of ECRANS_E) {
        if (ECR.length && !ECR.includes(tab)) continue;
        await essaie(`${T} E ${nom}`, async () => {
          const { pg, ctx } = await A.ouvrir(b, { largeur, sombre, tab });
          const pret = await M.attendreDemarrage(pg); await pg.waitForTimeout(800);
          dit(pret, `${T} E ${nom} · l'écran de démarrage s'est retiré`);
          await saboter(pg); await A.finirAnimations(pg);
          await A.capture(pg, `e-${tab}-${largeur}-${sombre ? 'sombre' : 'clair'}`);
          const c = await M.contrastePixels(pg);
          dit(c.length === 0, `${T} E1 ${nom} · aucun texte sous 4,5:1 (3:1 en grand), mesuré sur les pixels`, `${c.length} : ` + c.slice(0, 5).map((x) => `${x.ratio}:1 « ${x.texte} » ${x.sel} ${x.fg} sur ${x.bg}`).join(' ║ '));
          if (largeur < 700 && !sombre) { const p = await M.cibles(pg); dit(p.length === 0, `${T} E2 ${nom} · chaque contrôle offre 44 × 44 px au doigt`, `${p.length} : ` + p.slice(0, 5).join(' ║ ')); }
          const n = await M.nomsVides(pg);
          dit(n.length === 0, `${T} E3 ${nom} · aucun contrôle sans nom (arbre de Chrome)`, `${n.length} : ` + n.slice(0, 4).join(' ║ '));
          if (largeur >= 700) {
            const seq = await M.sequenceTab(pg, 45);
            const vus = seq.filter((x) => !x.body);
            dit(vus.length && vus[0].evitement, `${T} E4 ${nom} · le premier Tab est « Aller au contenu »`, JSON.stringify(vus[0] || null));
            const iNav = vus.findIndex((x) => x.rail), iMain = vus.findIndex((x) => x.main && !x.evitement);
            dit(iNav >= 0 && (iMain < 0 || iNav < iMain), `${T} E4 ${nom} · la colonne de navigation passe avant l'écran`, `nav au ${iNav}e arrêt, écran au ${iMain}e`);
            const sugg = vus.filter((x) => x.suggestion);
            dit(sugg.length === 0, `${T} E4 ${nom} · Tab ne traverse pas les suggestions de la recherche`, `${sugg.length} arrêts : ` + sugg.slice(0, 3).map((x) => x.nom).join(' | '));
            const inv = vus.filter((x) => !x.evitement && (x.w < 2 || x.h < 2));
            dit(inv.length === 0, `${T} E4 ${nom} · aucun arrêt invisible`, inv.slice(0, 3).map((x) => `${x.w}×${x.h} ${x.tag}.${x.cls.slice(0, 40)}`).join(' | '));
            const sans = vus.filter((x) => !x.contour);
            dit(sans.length === 0, `${T} E4 ${nom} · un contour à chaque arrêt`, `${sans.length} : ` + sans.slice(0, 4).map((x) => `${x.tag}.${x.cls.slice(0, 30)} « ${x.nom} »`).join(' | '));
          }
          if (tab === 'settings') { const h1 = await pg.evaluate(() => document.querySelectorAll('main h1').length); dit(h1 >= 1, `${T} E ${nom} · un h1`, `${h1}`); }
          await ctx.close();
        });
      }
    }
    for (const largeur of [390, 1512]) {
      if ((SEUL && SEUL !== 'E') || ECR.length) break;
      if (process.env.BANC_LARGEUR && String(largeur) !== process.env.BANC_LARGEUR) continue;
      await essaie(`E5 fiche ${largeur}`, async () => {
        const { pg, ctx } = await A.ouvrir(b, { largeur, tab: 'annonces' });
        await M.attendreDemarrage(pg); await pg.waitForTimeout(600);
        await pg.evaluate(() => { const c = [...document.querySelectorAll('main button:not([disabled])')].find((e) => e.getClientRects().length); if (c) { c.setAttribute('data-banc-avant', '1'); c.focus(); } });
        await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:fiche-paire', { detail: '12' })));
        await pg.waitForTimeout(1500);
        if (MUT === 'fiche') await pg.evaluate(() => { const d = document.querySelector('[data-fiche-paire]'); if (d) d.setAttribute('aria-modal', 'false'); document.body.focus(); try { document.activeElement.blur(); } catch (_) {} });
        const T = `${largeur < 700 ? '📱' : '🖥️'}`;
        const d0 = await pg.evaluate(() => { const d = document.querySelector('[data-fiche-paire]'); return d ? { dedans: d.contains(document.activeElement) } : null; });
        dit(!!d0 && d0.dedans, `${T} E5 la fiche s'ouvre et le focus y ENTRE`, JSON.stringify(d0));
        let sorties = 0;
        for (let i = 0; i < 30; i++) { await pg.keyboard.press(i % 7 === 6 ? 'Shift+Tab' : 'Tab'); if (!(await pg.evaluate(() => { const d = document.querySelector('[data-fiche-paire]'); return !!d && d.contains(document.activeElement); }))) sorties++; }
        dit(sorties === 0, `${T} E5 30 Tab / Maj+Tab restent DANS la fiche`, `${sorties} sorties`);
        await A.capture(pg, `e-fiche-${largeur}`);
        await pg.keyboard.press('Escape'); await pg.waitForTimeout(700);
        const fin = await pg.evaluate(() => ({ fermee: !document.querySelector('[data-fiche-paire]'), retour: !!(document.activeElement && document.activeElement.hasAttribute('data-banc-avant')) }));
        dit(fin.fermee && fin.retour, `${T} E5 Échap ferme la fiche et rend le focus`, JSON.stringify(fin));
        await ctx.close();
      });
    }
  } finally { await b.close(); A.srv.close(); }
  const { ok, ko } = A.compte();
  console.log(`\n${ok} ✅ · ${ko} ❌ — captures : ${A.CAPTURES}`);
  process.exit(ko ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
