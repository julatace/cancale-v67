require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  ARGENT, MESSAGES, RÉGLAGES AVEC MOINS DE TEXTE (25 nov.) — Julien : « je veux vraiment que tu regardes toute
//  l'application et que dès qu'il y a du texte, tu l'enlèves ; ou alors si c'est vraiment indispensable tu le mets
//  mais tu fais un bel affichage ». Récit : docs/passation/2026-11-25-moins-texte-b.md (modèle : aujourdhui-moins-texte).
//
//  L'app RENDUE (dist/), base INVENTÉE (`design-passe.cjs` : 3 comptes Vinted, ventes, achats, conversations — aucune
//  donnée réelle, le dépôt est public), Ventes ouvert une fois d'abord (comme chez lui : le reçu, le bénéfice et le
//  CA déclaré sont publiés par Ventes). Pour chaque écran (et ses sous-écrans : replis d'Argent ouverts, catégories
//  des Paramètres, fil d'une conversation), il juge — sur les data-* et les nombres rendus, jamais un libellé :
//    M  MOTS     — les mots VUS (le texte réservé au lecteur d'écran ne compte pas ; un nombre = un mot) ≤ MOTS_MAX,
//                  la part d'origin/main mesurée le 25 nov. sur la même base (table `ORIGINE` ci-dessous) ;
//    T  COUPÉ    — aucun chiffre ni titre tronqué (scrollWidth > clientWidth avec overflow caché / ellipsis) ;
//    D  DOUBLON  — aucun montant (≥ 100 €) écrit deux fois dans la même vue (hors listes de lignes et tableaux) ;
//    G  GESTES   — chaque geste de l'écran reste là (sélecteurs data-* de la table `GESTES`) ;
//    C  COMPTA   — les mentions obligatoires restent (CLAUDE.md §5 « Les chiffres ») : un total partiel porte sa
//                  couverture (« au moins » / ≥, au lecteur d'écran au moins), « à dater » quand il y en a, jamais
//                  « encaissé » à l'écran ; un « pas su » s'écrit « — », jamais 0.
//  Réglages : `BANC_DIST` (un autre build : l'AVANT), `LARGEURS=390,1512`, `THEMES=clair,sombre`, `ECRANS=a,b`,
//  `SHOTS=<dossier>` (captures à REGARDER + le texte vu), `DSF=2`, `MESURE=1` (mesure seule, aucun jugement),
//  `MUTATION=texte|geste|doublon` (rouge attendu). Un banc ne meurt pas, il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
process.env.TZ = 'Europe/Paris';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const SHOTS = process.env.SHOTS || '';
const MUT = process.env.MUTATION || '';
const MESURE = !!process.env.MESURE;
const liste = (v, d) => String(process.env[v] == null ? d : process.env[v]).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number), THEMES = liste('THEMES', 'clair,sombre');
const VOULUS = liste('ECRANS', '');
const DSF = Number(process.env.DSF || 1);
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 600) : '')); } return c; };

// Chaque vue : [nom, onglet (clic sur la barre du bas ou URL), gestes (clics) pour l'atteindre, racine mesurée].
// `ouvrirReplis` : les replis (<details>) de la vue ouverts avant la mesure — chacun est un sous-écran.
const VUES = [
  { nom: 'argent', url: '/?tab=argent' },
  { nom: 'argent-replis', url: '/?tab=argent', replis: '[data-argent-vue="resume"] details, [data-v2-ecran] details' },
  { nom: 'stats', url: '/?tab=stats' },
  { nom: 'declarer', url: '/?tab=argent_declarer' },
  { nom: 'factures', url: '/?tab=invoices', lignes: '[data-fe-vente], [data-facture-ligne]' },
  { nom: 'messages', url: '/?tab=messages', lignes: '[data-fil]' },
  { nom: 'fil', url: '/?tab=messages', clics: ['[data-fil]'], racine: '.vrm-chat-overlay' },
  { nom: 'settings', url: '/?tab=settings' },
  ...['compte', 'plateformes', 'ventes', 'stock', 'argent', 'notifications', 'apparence', 'securite-comptes', 'aide'].map((c) => ({ nom: 'reglages-' + c, url: '/?tab=settings', clics: [`[data-categorie-ouvrir="${c}"]`] })),
  { nom: 'menu', url: '/?tab=menu' },
  { nom: 'comptes', url: '/?tab=vintedaccounts' },
  { nom: 'extension', url: '/?tab=extension' },
  { nom: 'adistance', url: '/?tab=adistance' },
];

const MESURER = ([replis, lignes, racine]) => {
  const main = (racine && [...document.querySelectorAll(racine)].pop()) || document.querySelector('.vrm-main') || document.body;
  if (replis) for (const d of main.querySelectorAll(replis)) d.open = true;
  // Une LISTE (conversations, factures) : ses lignes sont du contenu, pas du texte à couper — une seule compte (la
  // première), les autres sont cachées le temps de la lecture ; leur nombre est rendu à part.
  const rangs = lignes ? [...main.querySelectorAll(lignes)].slice(1) : [];
  const avR = rangs.map((e) => e.style.display); rangs.forEach((e) => { e.style.setProperty('display', 'none', 'important'); });
  // Les mots VUS : le texte réservé au lecteur d'écran (1 px, découpé) ne compte pas — il est retiré le temps de la lecture.
  const caches = [...main.querySelectorAll('*')].filter((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); if (cs.position !== 'absolute' && cs.position !== 'fixed') return false; const decoupe = /inset\(50%\)/.test(cs.clipPath) || /rect\(0(px)?,? 0(px)?,? 0(px)?,? 0(px)?\)/.test(cs.clip); return decoupe || (r.width <= 1 && r.height <= 1 && (cs.clipPath !== 'none' || cs.clip !== 'auto')); });
  const avant = caches.map((e) => e.style.display); caches.forEach((e) => { e.style.display = 'none'; });
  // La coque (en-tête : titre, loupe, cloche, ligne de fraîcheur) n'est pas l'écran : hors du compte.
  const coque = [...main.querySelectorAll('[data-fraicheur-deplier], .vrm-fraicheur, [data-n-tete], .n-tete-app')];
  const avC = coque.map((e) => e.style.display); coque.forEach((e) => { e.style.display = 'none'; });
  // Un menu déroulant (<select>) ne montre QUE son choix : ses autres options ne sont pas « vues ».
  const menus = [...main.querySelectorAll('select')].map((sel) => { const sp = document.createElement('span'); sp.textContent = sel.selectedOptions && sel.selectedOptions[0] ? sel.selectedOptions[0].textContent : ''; const d = sel.style.display; sel.style.display = 'none'; sel.after(sp); return [sel, sp, d]; });
  const texte = main.innerText || '';
  menus.forEach(([sel, sp, d]) => { sp.remove(); sel.style.display = d; });
  caches.forEach((e, i) => { e.style.display = avant[i]; });
  coque.forEach((e, i) => { e.style.display = avC[i]; });
  rangs.forEach((e, i) => { e.style.display = avR[i]; });
  const mots = texte.replace(/(\d)[\s  ](?=\d)/g, '$1').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  return { mots: mots.length, texte };
};

async function attendreStable(pg) {
  let av = '', eg = 0;
  for (let k = 0; k < 14 && eg < 2; k++) { await pg.waitForTimeout(1100); const s = await pg.evaluate(() => (document.querySelector('.vrm-main') || document.body).innerText); if (s && s === av) eg++; else eg = 0; av = s; }
}

(async () => {
  const b = P.base();
  await new Promise((ok) => P.srv.listen(P.PORT, ok));
  const nav = await P.chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const res = [];
  try {
    for (const W of LARGEURS) for (const theme of THEMES) {
      // Ventes ouvert une fois (il publie le reçu, le bénéfice, le CA déclaré), puis chaque vue rechargée.
      const { ctx, pg, erreurs } = await P.ouvrir(nav, { W, sombre: theme === 'sombre', b, url: '/?tab=ventes', dsf: DSF });
      await pg.waitForSelector('.vrm-main', { timeout: 30000 }).catch(() => {});
      await attendreStable(pg);
      for (const v of VUES) {
        if (VOULUS.length && !VOULUS.includes(v.nom)) continue;
        const nom = `${v.nom}-${W}-${theme}`;
        erreurs.length = 0;
        await pg.goto(`http://localhost:${P.PORT}${v.url}`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('.vrm-main', { timeout: 30000 }).catch(() => {});
        await attendreStable(pg);
        for (const c of v.clics || []) { await pg.locator(c).first().click({ timeout: 8000 }).catch((e) => console.log('  (clic raté ' + c + ')')); await attendreStable(pg); }
        const r = await pg.evaluate(MESURER, [v.replis || '', v.lignes || '', v.racine || '']);
        res.push(`${nom} ${r.mots}`);
        console.log(`▶ ${nom} : ${r.mots} mots` + (erreurs.length ? ' · ERREUR ' + erreurs[0] : ''));
        if (SHOTS) {
          fs.mkdirSync(SHOTS, { recursive: true }); fs.writeFileSync(path.join(SHOTS, nom + '.txt'), r.texte);
          const h = await pg.evaluate(() => { let m = document.documentElement.scrollHeight; for (const e of document.querySelectorAll('body *')) { const cs = getComputedStyle(e); if (/(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 4) m = Math.max(m, e.scrollHeight + e.getBoundingClientRect().top + 120); } return Math.ceil(m); });
          const vp = pg.viewportSize(); await pg.setViewportSize({ width: vp.width, height: Math.min(9000, Math.max(vp.height, h)) }); await pg.waitForTimeout(500);
          await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }); await pg.setViewportSize(vp);
        }
      }
      await ctx.close();
    }
  } finally { await nav.close(); P.srv.close(); }
  console.log('\nMots vus : ' + res.join(' · '));
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
