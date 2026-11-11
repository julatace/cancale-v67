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
//  Le zoom 200 % et le clavier seul : `accessibilite-clavier.cjs`.
//  BANC_PORT, BANC_DIST, BANC_CAPTURES, BANC_LARGEUR=390|1512, BANC_ECRANS=a,b, BANC_SEUL=A|C, BANC_DUMP=1.
// ════════════════════════════════════════════════════════════════════════════
const A = require('./_a11y.cjs');
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
  } finally { await b.close(); A.srv.close(); }
  const { ok, ko } = A.compte();
  console.log(`\n${ok} ✅ · ${ko} ❌ — captures : ${A.CAPTURES}`);
  process.exit(ko ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
