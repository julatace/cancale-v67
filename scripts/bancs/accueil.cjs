// ════════════════════════════════════════════════════════════════════════════
//  BANC « PAGE D'ACCUEIL » — ce que voit quelqu'un qui ne connaît pas VRM.
//
//  Julien, 3 octobre : « je veux une vraie page d'accueil avant de rentrer dans
//  VRM, qui donne envie avant d'arriver sur la connexion ».
//
//  Ce banc juge ce qui est RENDU, jamais la formulation :
//   • qui voit la page : un visiteur sans session — et PERSONNE d'autre (une
//     session, un retour de lien email, `?tab=` vont droit dans l'app, sans
//     même un éclair de page d'accueil) ;
//   • qu'un visiteur ne télécharge PAS l'application (le gros fichier `App-*`) ;
//   • que les deux boutons ouvrent le BON formulaire ;
//   • qu'il n'y a ni débordement à 390 px, ni écran tombé ;
//   • que l'animation bouge… et qu'elle reste immobile quand le système demande
//     moins d'animations ;
//   • que le prix dit la même chose que les CGV (une seule source, §5) et que la
//     page n'invente aucun chiffre de clients ;
//   • que chaque lien légal mène à un fichier qui existe.
//  ⚠️ AUCUNE FIXTURE : une page publique ne lit aucune donnée.
// ════════════════════════════════════════════════════════════════════════════
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const RACINE = path.join(__dirname, '..', '..');
const DIST = path.join(RACINE, 'dist');            // ⚠️ jamais un chemin absolu (§6.1)
const PORT = 4523;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.zip': 'application/zip', '.webmanifest': 'application/manifest+json' };
const CAPT = process.env.CAPTURES || '';

let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => {
  if (bon) { ok++; console.log(`  ✅ ${quoi}`); }
  else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + detail : ''}`); }
};
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'le contrôle a levé : ' + String(e && e.message || e).slice(0, 160)); } };

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0].split('#')[0];
  if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!p.startsWith(DIST) || !fs.existsSync(p)) { r.writeHead(404); return r.end('nope'); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
  r.end(fs.readFileSync(p));
});
const ecouter = () => new Promise((res, rej) => {
  srv.once('error', (e) => rej(e.code === 'EADDRINUSE' ? new Error(`le port ${PORT} est déjà pris — relance ce banc seul.`) : e));
  srv.listen(PORT, () => res());
});

const SESSION = { access_token: 'jeton-de-banc', refresh_token: 'r', expires_at: Date.now() + 3600e3, user: { id: '11111111-2222-3333-4444-555555555555', email: 'banc@exemple.fr' } };

async function page(nav, { largeur = 1512, hauteur = 900, mobile = false, session = false, url = '/', reduit = false } = {}) {
  const ctx = await nav.newContext({ viewport: { width: largeur, height: hauteur }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1, reducedMotion: reduit ? 'reduce' : 'no-preference', serviceWorkers: 'block' });
  // La base : une installation neuve, qui ne lit rien (la page publique ne doit
  // de toute façon RIEN lire).
  const lectures = [];
  await ctx.route(/supabase\.co|\/api\//, (rt) => { lectures.push(rt.request().url()); rt.fulfill({ status: 200, contentType: 'application/json', body: '[]' }); });
  await ctx.route(/^https?:\/\/(?!localhost)/, (rt) => rt.abort());
  if (session) await ctx.addInitScript((s) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); } catch (_) {} }, SESSION);
  // On note si la page d'accueil apparaît, MÊME un instant (un éclair compte).
  await ctx.addInitScript(() => {
    window.__accueilVu = false;
    new MutationObserver(() => { if (document.querySelector('[data-accueil]')) window.__accueilVu = true; })
      .observe(document, { childList: true, subtree: true });   // `document` existe toujours, documentElement pas encore
  });
  const pg = await ctx.newPage();
  const scripts = [];
  pg.on('request', (rq) => { if (/\.js(\?|$)/.test(rq.url())) scripts.push(rq.url().split('/').pop()); });
  const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 160)));
  await pg.goto(`http://localhost:${PORT}${url}`, { waitUntil: 'domcontentloaded' });
  // On attend que QUELQUE CHOSE soit rendu (page d'accueil ou app), pas un délai fixe.
  await pg.waitForFunction(() => { const r = document.getElementById('root'); return r && r.children.length && r.innerText.trim().length > 3; }, null, { timeout: 15000 }).catch(() => {});
  await pg.waitForTimeout(400);
  return { ctx, pg, scripts, erreurs, lectures };
}

(async () => {
  try { await ecouter(); } catch (e) { console.log('❌ ' + e.message); process.exit(1); }
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.log('❌ dist/ absent — lance npm run build'); process.exit(1); }
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try {
    console.log('\n── UN VISITEUR SANS SESSION');
    for (const [nom, opt] of [['ordinateur (1512 px)', { largeur: 1512, hauteur: 900 }], ['téléphone (390 px)', { largeur: 390, hauteur: 844, mobile: true }]]) {
      await essaie(`page d'accueil · ${nom}`, async () => {
        const { ctx, pg, scripts, erreurs, lectures } = await page(nav, opt);
        const vu = await pg.evaluate(() => !!document.querySelector('[data-accueil]'));
        dit(vu, `${nom} : la page d'accueil s'affiche`);
        const texte = await pg.evaluate(() => document.body.innerText);
        dit(!/n'a pas pu s'afficher|Cannot access|is not defined/.test(texte), `${nom} : aucun écran tombé`);
        dit(erreurs.length === 0, `${nom} : aucune erreur de page`, erreurs.join(' | '));
        const deb = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        dit(deb <= 1, `${nom} : aucun débordement horizontal`, `${deb} px de trop`);
        dit(!scripts.some((s) => /^App-/.test(s)), `${nom} : le visiteur ne télécharge PAS l'application`, scripts.join(', '));
        dit(lectures.length === 0, `${nom} : la page publique ne lit rien en base`, lectures.slice(0, 3).join(' · '));
        // Tous les liens légaux mènent à un fichier qui existe.
        const liens = await pg.evaluate(() => [...document.querySelectorAll('[data-accueil] a[href^="/legal/"]')].map((a) => a.getAttribute('href')));
        const manquants = liens.filter((h) => !fs.existsSync(path.join(DIST, h)));
        dit(liens.length >= 5 && manquants.length === 0, `${nom} : les ${liens.length} liens légaux mènent à une vraie page`, manquants.join(', ') || `${liens.length} lien(s)`);
        // CONTACT (5 octobre) : une ligne, lue dans src/contact.js. Tant que
        // l'adresse n'existe pas, la page le DIT — jamais une adresse inventée
        // qui ne recevrait rien. La donnée décide : on lit la constante, on ne
        // suppose pas qu'elle est vide.
        const constante = ((/CONTACT_EMAIL\s*=\s*'([^']*)'/.exec(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'contact.js'), 'utf8')) || [])[1] || '').trim();
        const contact = await pg.evaluate(() => { const e = document.querySelector('[data-accueil] [data-contact]'); return e ? { texte: e.innerText, absent: e.hasAttribute('data-contact-absent'), href: e.getAttribute('href') || '' } : null; });
        dit(!!contact && (constante
          ? contact.href === `mailto:${constante}`
          : contact.absent && /à venir/.test(contact.texte) && !contact.href),
          `${nom} : une ligne Contact — ${constante ? 'l’adresse de src/contact.js' : '« adresse de contact à venir », aucune adresse inventée'}`, contact ? `${contact.texte} ${contact.href}` : 'absente');
        // Le bouton « Commencer » reste à portée en faisant défiler : la barre du
        // haut est collante. Un `overflow-x:hidden` sur la racine en fait un
        // conteneur de défilement et la barre partait avec la page (vu au rendu).
        const barre = await pg.evaluate(async () => {
          scrollTo(0, 3000); await new Promise((r) => setTimeout(r, 200));
          const n = document.querySelector('[data-accueil] .acc-nav'); const r = n && n.getBoundingClientRect();
          const out = r ? Math.round(r.top) : null; scrollTo(0, 0); return out;
        });
        dit(barre === 0, `${nom} : la barre du haut reste visible en faisant défiler`, `haut de la barre à ${barre} px`);
        if (CAPT) {
          await pg.screenshot({ path: path.join(CAPT, `accueil-${opt.largeur}.png`), fullPage: true });
          await pg.screenshot({ path: path.join(CAPT, `accueil-${opt.largeur}-haut.png`) });
        }
        await ctx.close();
      });
    }

    console.log('\n── L\'ANIMATION BOUGE… ET S\'ARRÊTE QUAND ON LE DEMANDE');
    await essaie('animation', async () => {
      const { ctx, pg } = await page(nav, {});
      const titre = () => pg.evaluate(() => { const d = document.querySelector('[data-demo-animee] [aria-live]'); return d ? d.innerText.trim() : ''; });
      const a = await titre(); await pg.waitForTimeout(6200); const b = await titre();
      dit(!!a && !!b && a !== b, 'les scènes s\'enchaînent toutes seules', `« ${a.slice(0, 40)} » puis « ${b.slice(0, 40)} »`);
      // La barre de progression saute à une scène précise.
      await pg.click('[data-demo-animee] button[aria-label^="Voir : Tes chiffres"]');
      await pg.waitForTimeout(700);
      dit(/Tes chiffres/.test(await titre()), 'la barre de progression mène à la scène choisie');
      await ctx.close();
      const r = await page(nav, { reduit: true });
      const titreR = () => r.pg.evaluate(() => { const d = document.querySelector('[data-demo-animee] [aria-live]'); return d ? d.innerText.trim() : ''; });
      const c = await titreR(); await r.pg.waitForTimeout(4600); const d = await titreR();
      dit(!!c && c === d, '« réduire les animations » : l\'animation reste immobile', `« ${c.slice(0, 40)} » puis « ${d.slice(0, 40)} »`);
      await r.pg.click('[data-demo-animee] button[aria-label^="Voir : Le bordereau"]');
      await r.pg.waitForTimeout(400);
      dit(/bordereau/i.test(await titreR()), '…et on change quand même de scène à la main');
      await r.ctx.close();
    });

    console.log('\n── LES BOUTONS OUVRENT LE BON FORMULAIRE');
    for (const [cta, attendu, q] of [['inscription', /Créer ton compte/, 'inscription'], ['connexion', /Se connecter/, 'connexion']]) {
      await essaie(`bouton ${cta}`, async () => {
        const { ctx, pg } = await page(nav, {});
        await pg.click(`[data-accueil] .acc-hero [data-cta="${cta}"]`, { timeout: 8000 });
        await pg.waitForFunction((re) => new RegExp(re).test(document.body.innerText), attendu.source, { timeout: 15000 }).catch(() => {});
        const t = await pg.evaluate(() => document.body.innerText);
        dit(attendu.test(t) && !/data-accueil/.test(await pg.evaluate(() => document.querySelector('[data-accueil]') ? 'data-accueil' : '')), `« ${cta} » ouvre le formulaire « ${String(attendu).replace(/[/\\]/g, '')} »`, t.slice(0, 120));
        dit(new RegExp(`[?&]${q}`).test(pg.url()), `« ${cta} » : l'adresse le dit (lien partageable, rechargement fidèle)`, pg.url());
        // Le retour arrière ramène à la page d'accueil (pas un cul-de-sac).
        await pg.goBack();
        await pg.waitForSelector('[data-accueil]', { timeout: 8000 }).catch(() => {});
        dit(await pg.evaluate(() => !!document.querySelector('[data-accueil]')), `« ${cta} » : le retour arrière ramène à la page d'accueil`);
        await ctx.close();
      });
    }
    await essaie('lien retour depuis la connexion', async () => {
      const { ctx, pg } = await page(nav, { url: '/?connexion' });
      await pg.waitForSelector('[data-retour-accueil]', { timeout: 15000 }).catch(() => {});
      const lien = await pg.$('[data-retour-accueil]');
      dit(!!lien, 'l\'écran de connexion propose de revenir à la page d\'accueil');
      if (lien) { await lien.click(); await pg.waitForSelector('[data-accueil]', { timeout: 8000 }).catch(() => {}); dit(await pg.evaluate(() => !!document.querySelector('[data-accueil]')), '…et y revient vraiment'); }
      await ctx.close();
    });

    console.log('\n── PERSONNE D\'AUTRE NE LA VOIT (pas même un éclair)');
    for (const [nom, opt] of [
      ['une session', { session: true }],
      ['un retour de lien email (?code=)', { url: '/?code=abc' }],
      ['un retour de lien email (#access_token=)', { url: '/#access_token=x&type=signup' }],
      ['un lien vers un onglet (?tab=)', { url: '/?tab=journee' }],
    ]) {
      await essaie(nom, async () => {
        const { ctx, pg } = await page(nav, opt);
        await pg.waitForTimeout(800);
        dit(await pg.evaluate(() => window.__accueilVu === false), `${nom} : va droit dans l'app, sans éclair de page d'accueil`);
        await ctx.close();
      });
    }

    console.log('\n── HONNÊTETÉ : LE PRIX VIENT DES CGV, AUCUN CHIFFRE INVENTÉ');
    await essaie('honnêteté', async () => {
      const { ctx, pg } = await page(nav, {});
      const t = await pg.evaluate(() => document.querySelector('[data-accueil]').innerText);
      const cgv = fs.readFileSync(path.join(RACINE, 'public', 'legal', 'cgv.html'), 'utf8');
      // ⚠️ Le prix vient des CGV, une seule source (§11). Depuis le 4 octobre
      //    elles annoncent l'abonnement (« 9,99 € par mois ») : la page d'accueil
      //    doit dire CE montant — et aucun autre montant mensuel, ni « 0 € ».
      const gratuitCgv = /VRM est gratuit/i.test(cgv);
      const prixCgv = (/abonnement à (\d+,\d{2}) € par mois/i.exec(cgv) || [])[1] || null;
      if (gratuitCgv) dit(/gratuit/i.test(t) && /0 €/.test(t), 'le prix affiché est celui des CGV (« gratuit »)');
      else {
        const montants = [...t.matchAll(/(\d+,\d{2})\s*€\s*(?:\/\s*mois|par mois)/gi)].map((m) => m[1]);
        dit(!!prixCgv && montants.length > 0 && montants.every((m) => m === prixCgv) && !/(^|\s)0 €/.test(t), `le prix affiché est celui des CGV (${prixCgv} € par mois), aucun autre`, `CGV ${prixCgv} · page ${montants.join(', ')}`);
        dit(/sans engagement/i.test(t) && /résili/i.test(t), '  et il dit « sans engagement » et comment résilier (comme les CGV)');
      }
      // Aucun chiffre de clientèle inventé : « 10 000 vendeurs », « 4,9/5 »,
      // « +38 % de ventes ». La donnée déclenche, pas un mot : on cherche un
      // NOMBRE accolé à une promesse de résultat ou de foule.
      const invente = t.match(/\d[\d\s.,]*\s*(\+|k|K)?\s*(vendeurs|revendeurs|utilisateurs|clients|avis|étoiles|\/\s*5|%\s*de\s*(ventes|chiffre|temps))/i);
      dit(!invente, 'aucun chiffre de clientèle ni de résultat inventé', invente ? invente[0] : '');
      dit(!/(★|⭐)/.test(t), 'aucune note en étoiles (aucun avis réel à afficher)');
      const conf = fs.readFileSync(path.join(RACINE, 'public', 'legal', 'confidentialite.html'), 'utf8');
      dit(!/donnée revendue|ne vend aucune donnée/i.test(t) || /ne vend aucune donnée/i.test(conf), '« aucune donnée revendue » s\'appuie sur la politique publiée');
      // Julien, 4 oct. : « insiste bien dans la FAQ qu'on évite les automatisations
      // comme les messages aux favoris et les republications pour éviter les bans. »
      // On juge sur la DONNÉE rendue (les deux notions NOMMÉES), jamais une formule
      // (§6.5) : « favori » n'apparaît nulle part avant ce changement → rouge sur
      // le code d'avant, vert après.
      dit(/favori/i.test(t) && /republi/i.test(t), 'la page insiste : pas de relance en série aux favoris ni de republication automatique', `favori=${/favori/i.test(t)} republi=${/republi/i.test(t)}`);
      await ctx.close();
    });
  } finally {
    await nav.close(); srv.close();
  }
  console.log(ko ? `\n❌ accueil : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ accueil : ${ok} verts, 0 rouge`);
  process.exit(ko ? 1 : 0);
})();
