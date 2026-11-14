// ════════════════════════════════════════════════════════════════════════
//  BANC « LA CARTE DU LOGO : LE SITE, PAS VRM — ET LES FAVORIS LANCÉS D'ICI » (5.376)
//
//  Julien, 14 nov., midi : « quand tu appuies dessus ça ouvre juste les ventes de
//  ce compte, les messages de ce compte, mais pas plus, ça n'ouvre pas VRM » ;
//  « on peut lancer les messages aux favoris directement quand on est sur le compte ».
//
//  Le VRAI vrm-badge.js dans une page vinted.fr (faux `chrome` : il répond ce que
//  dirait le service worker — sa règle à lui est EXÉCUTÉE par
//  scripts/audit-carte-extension.cjs sur le vrai background.js et la vraie route).
//  390 px au doigt et 1512 px à la souris, clair et sombre, captures dans
//  `captures/carte-favoris`. Ce que le banc juge (data-*, attributs et nombres, §6.4) :
//   · plus de « Ouvrir VRM » ni de « Colis · Messages · Offres » ; aucun clic de la
//     carte (liens, boutons, logo à la souris) n'envoie `ouvrirVRM` ; aucun lien vers
//     vrm.center ; chaque lien est sur le site de l'onglet, et un clic y MÈNE ;
//   · « 3 favoris à qui écrire · Voir » ⇒ l'aperçu : la phrase de ce qui va se passer,
//     le message rendu, l'offre, une ligne par personne, « Lancer (3) », l'aide « ? » ;
//   · rien ne part sans « Lancer » ; « Lancer » envoie la sélection de l'aperçu avec
//     `confirme` ; la progression « 1/3 envoyés · prochain dans … » + « Tout arrêter » ;
//     une attente dite (« autre compte… rien ne part ») ; la fin ; un blocage dit ;
//   · un seul bouton plein (accent) à la fois ; cibles ≥ 44 px ; la carte dans
//     l'écran ; aucune erreur de page.
//  Tout est inventé (dépôt public).
// ════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const RACINE = path.join(__dirname, '..', '..');
const EXT = path.join(RACINE, 'vinted-sync-extension');
const BADGE = fs.readFileSync(path.join(EXT, 'vrm-badge.js'), 'utf8');
const LOGO = fs.readFileSync(path.join(EXT, 'logo-vrm-96.png'));
const VERSION = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8')).version;
const SORTIE = process.env.BANC_CAPTURES ? path.join(process.env.BANC_CAPTURES, 'carte-favoris') : path.join(__dirname, 'captures', 'carte-favoris');

let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + detail : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`  ❌ ${quoi} — a levé : ${String(e && e.message).slice(0, 220)}`); return null; } };

const MIN = 60000;
const LIENS = [{ cle: 'ventes', libelle: 'Mes ventes', url: 'https://www.vinted.fr/my_orders/sold' }, { cle: 'messages', libelle: 'Messages', url: 'https://www.vinted.fr/inbox' }, { cle: 'dressing', libelle: 'Mon dressing', url: 'https://www.vinted.fr/member/111' }];
const APERCU = { etat: 'pret', total: 3, nonProuves: 1, ecartes: 2, ventesAilleurs: 'ok', selection: ['n1', 'n2', 'n5'],
  liste: [
    { id: 'n1', itemId: '101', pseudo: 'camille_b', titre: 'Nike Air Max 90 blanches 42', prix: 50, offre: 45, texte: 'Bonjour camille_b, Nike Air Max 90 blanches 42 est à 45 € pour toi !' },
    { id: 'n2', itemId: '102', pseudo: 'lea.vintage', titre: 'Adidas Samba OG 41 — très bon état, boîte d’origine', prix: 80, offre: 72, texte: 'Bonjour lea.vintage, Adidas Samba OG 41 est à 72 € pour toi !' },
    { id: 'n5', itemId: '105', pseudo: 'tom_75', titre: 'Puma Suede 40', prix: 45, offre: 40.5, texte: 'Bonjour tom_75, Puma Suede 40 est à 40,50 € pour toi !' }],
  message: { versions: 2, offre: { mode: 'pct', valeur: 10, arrondi: false }, intervalleMinutes: 0, intervalleMaxMinutes: null },
  reglages: { version: 1, message: 'Bonjour {pseudo}, {article} est à {prix} pour toi !', pourcentage: 10, offreMode: 'pct' } };
const base = (fav, x) => Object.assign({ ok: true, plateforme: 'vinted', capte: true, version: VERSION, code: VERSION,
  vrm: { ok: true, connecte: true, email: 'sophie@exemple.fr', cloisonne: true },
  site: { id: '111', nom: 'shop_sophie', choix: 'oui', jauge: { h: 12, maxH: 50, j: 40, maxJ: 200, complet: true }, favoris: fav === undefined ? { apercu: { at: Date.now() - MIN, etat: 'pret', total: 3 }, file: null } : fav },
  flux: { okAt: Date.now() - 3 * MIN }, bascule: null, liens: LIENS }, x || {});

async function ouvrir(nav, etat, { scheme = 'light', largeur = 1512, hauteur = 900, mobile = false, apercu = APERCU } = {}) {
  const ctx = await nav.newContext(Object.assign({ colorScheme: scheme, viewport: { width: largeur, height: hauteur } }, mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}));
  const pg = await ctx.newPage();
  const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 200)));
  await pg.route('**/*', (r) => {
    if (/logo-vrm-96\.png/.test(r.request().url())) return r.fulfill({ status: 200, contentType: 'image/png', body: LOGO });
    return r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#fff;font-family:sans-serif"><header style="height:64px;border-bottom:1px solid #ddd;padding:20px">Une page Vinted</header><main style="padding:20px;height:2000px">Annonces…</main></body></html>' });
  });
  await pg.goto('https://www.vinted.fr/catalog');
  await pg.evaluate(({ e, js, ap }) => {
    window.__envoyes = [];
    const copie = (x) => JSON.parse(JSON.stringify(x));
    window.__etat = copie(e);
    const orig = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (o) { return orig.call(this, Object.assign({}, o, { mode: 'open' })); };
    window.chrome = {
      runtime: { id: 'ext', getURL: (p) => location.origin + '/' + p, getManifest: () => ({ version: e.version }), lastError: null,
        sendMessage: (msg, cb) => {
          window.__envoyes.push(copie(msg));
          let rep = { ok: true };
          if (msg.action === 'etat') rep = copie(window.__etat);
          else if (msg.action === 'favorisCarte' && msg.quoi === 'apercu') rep = { ok: true, uid: '111', apercu: copie(ap) };
          else if (msg.action === 'favorisCarte' && msg.quoi === 'lancer') {
            rep = msg.confirme === true ? { ok: true } : { ok: false, code: 'confirmation' };
            if (rep.ok) window.__etat.site.favoris = { apercu: null, file: { v: 1, uid: '111', actif: true, total: 3, file: { total: 3, envoyes: 1, refuses: 0, ignores: 0, incertains: 0 }, prochain: Date.now() + 6 * 60000, attente: null } };
          } else if (msg.action === 'favorisCarte' && msg.quoi === 'arreter') { window.__etat.site.favoris = { apercu: null, file: { v: 1, uid: '111', actif: false, total: 3, file: { total: 3, envoyes: 1, refuses: 0, ignores: 0, incertains: 0, annules: 2 }, fin: { at: Date.now(), raison: 'arret' } } }; }
          setTimeout(() => cb && cb(rep), 0);
        } },
      storage: { local: { get: (k, cb) => { if (cb) setTimeout(() => cb({}), 0); return Promise.resolve({}); }, set: (o, cb) => { if (cb) setTimeout(cb, 0); return Promise.resolve(); } }, onChanged: { addListener() {} } },
    };
    const s = document.createElement('script'); s.textContent = js; document.documentElement.appendChild(s);
  }, { e: etat, js: BADGE, ap: apercu });
  await pg.waitForTimeout(250);
  return { ctx, pg, erreurs };
}
const lire = (pg) => pg.evaluate(() => {
  const h = document.getElementById('vrm-badge');
  if (!h || !h.shadowRoot) return null;
  const r = h.shadowRoot, q = (s) => r.querySelector(s);
  const rect = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), r: Math.round(b.right), b: Math.round(b.bottom), w: Math.round(b.width), h: Math.round(b.height) }; };
  const carte = q('.carte');
  const visible = (el) => !!(el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
  const boutons = Array.from(r.querySelectorAll('.carte button, .carte a')).filter(visible);
  const accent = getComputedStyle(carte).getPropertyValue('--accent').trim();
  return {
    carteVisible: !!(carte && getComputedStyle(carte).display !== 'none'), carte: rect(carte), btn: rect(q('.btn')),
    ouvrirVrm: !!q('[data-ouvrir-vrm]'), raccourcis: r.querySelectorAll('[data-ouvrir-ecran]').length,
    liens: Array.from(r.querySelectorAll('[data-lien-site]')).map((a) => ({ cle: a.getAttribute('data-lien-site'), href: a.href, target: a.target, h: Math.round(a.getBoundingClientRect().height) })),
    fav: q('[data-fav]') ? q('[data-fav]').getAttribute('data-fav') : null, favN: q('[data-fav]') ? q('[data-fav]').getAttribute('data-fav-n') : null,
    favTexte: q('[data-fav]') ? q('[data-fav]').innerText.replace(/\s+/g, ' ').trim() : '',
    vue: q('[data-fav-vue]') ? q('[data-fav-vue]').getAttribute('data-fav-vue') : null,
    phrase: q('.ap-phrase') ? q('.ap-phrase').innerText.trim() : '', message: q('[data-fav-message]') ? q('[data-fav-message]').innerText.trim() : '',
    offre: q('[data-fav-offre]') ? q('[data-fav-offre]').getAttribute('data-fav-offre') : null, lignes: r.querySelectorAll('[data-fav-qui]').length,
    lancer: q('[data-fav-lancer]') ? q('[data-fav-lancer]').innerText.trim() : null, aide: !!q('[data-fav-aide-texte]'),
    attente: q('[data-fav-attente-texte]') ? q('[data-fav-attente-texte]').innerText.trim() : '', dans: q('[data-fav-dans]') ? q('[data-fav-dans]').innerText.trim() : '',
    envoyes: q('[data-fav]') ? q('[data-fav]').getAttribute('data-fav-envoyes') : null, fin: q('[data-fav-fin]') ? q('[data-fav-fin]').getAttribute('data-fav-fin') : null,
    pleins: boutons.filter((b) => b.classList.contains('b') && !b.classList.contains('sec') && getComputedStyle(b).backgroundColor !== 'rgba(0, 0, 0, 0)').length,
    petits: boutons.filter((b) => b.offsetHeight < 44 && !b.closest('.outils')).map((b) => (b.className || b.tagName) + ':' + b.offsetHeight),   // taille de mise en page (l’animation d’entrée la réduit de 2 % un instant)
    vrmLiens: Array.from(r.querySelectorAll('a[href]')).filter((a) => /vrm\.center/.test(a.href) && !/VRM-extension|VRM-Orion|mot-de-passe/.test(a.href)).length,
    envoyes2: window.__envoyes.filter((x) => x.action !== 'etat'), accent,
    debord: document.documentElement.scrollWidth > window.innerWidth,
  };
});
const dedans = (c, W, H) => !!c && c.x >= 0 && c.y >= 0 && c.r <= W && c.b <= H;
const montrer = async (pg, mobile) => {
  const a = await lire(pg);
  if (mobile) await pg.tap('#vrm-badge', { position: { x: a.btn.w / 2, y: a.btn.h / 2 } }).catch(() => {});
  else { await pg.mouse.move(5, 5); await pg.waitForTimeout(80); await pg.mouse.move(a.btn.x + a.btn.w / 2, a.btn.y + a.btn.h / 2); await pg.waitForTimeout(60); await pg.mouse.click(a.btn.x + a.btn.w / 2, a.btn.y + a.btn.h / 2); }
  await pg.waitForTimeout(320);
};
const clic = async (pg, sel) => { await pg.evaluate((s) => { const b = document.getElementById('vrm-badge').shadowRoot.querySelector(s); if (b) b.click(); }, sel); await pg.waitForTimeout(200); };

(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  fs.mkdirSync(SORTIE, { recursive: true });
  const cap = async (pg, nom) => { try { await pg.screenshot({ path: path.join(SORTIE, nom + '.png') }); } catch (_) {} };
  try {
    for (const [largeur, hauteur, mobile] of [[1512, 900, false], [390, 844, true]]) for (const scheme of ['light', 'dark']) {
      const T = `${largeur} ${scheme}`;
      console.log(`\n${T}`);
      await essaie(`A ${T}`, async () => {
        const t = await ouvrir(nav, base(), { scheme, largeur, hauteur, mobile });
        await montrer(t.pg, mobile);
        const a = await lire(t.pg);
        await cap(t.pg, `carte-${largeur}-${scheme}`);
        dit(a.carteVisible && dedans(a.carte, largeur, hauteur), `${T} : la carte s’ouvre (et reste ouverte au clic du logo), dans l’écran`, JSON.stringify(a.carte));
        dit(!a.ouvrirVrm && a.raccourcis === 0, `${T} : plus de « Ouvrir VRM » ni de « Colis · Messages · Offres »`, JSON.stringify({ o: a.ouvrirVrm, r: a.raccourcis }));
        dit(a.liens.map((l) => l.cle).join(',') === 'ventes,messages,dressing' && a.liens.every((l) => new URL(l.href).origin === 'https://www.vinted.fr' && l.target === '_top'), `${T} : Mes ventes · Messages · Mon dressing, sur vinted.fr, dans cet onglet`, JSON.stringify(a.liens));
        dit(a.vrmLiens === 0, `${T} : aucun lien vers vrm.center`, String(a.vrmLiens));
        dit(a.fav === 'pret' && a.favN === '3' && /3 favoris à qui écrire/.test(a.favTexte), `${T} : « 3 favoris à qui écrire · Voir »`, a.favTexte);
        dit(!a.envoyes2.some((m) => m.action === 'ouvrirVRM'), `${T} : ouvrir la carte (logo touché / cliqué) n’ouvre PAS VRM`, JSON.stringify(a.envoyes2));
        dit(a.petits.length === 0, `${T} : cibles ≥ 44 px`, JSON.stringify(a.petits));
        dit(a.pleins === 0, `${T} : aucun bouton plein sur la carte au repos (l’accent est rare)`, String(a.pleins));
        // L'aperçu.
        await clic(t.pg, '[data-fav-voir]');
        const b = await lire(t.pg);
        await cap(t.pg, `apercu-${largeur}-${scheme}`);
        dit(b.vue === 'apercu' && /ces 3 personnes, une par une/.test(b.phrase) && /Rien ne part avant «.Lancer.»/.test(b.phrase), `${T} : l’aperçu dit ce qui va se passer, en une phrase`, b.phrase);
        dit(b.message === APERCU.liste[0].texte && b.offre === 'pct' && b.lignes === 3, `${T} : le message rendu, l’offre, une ligne par personne`, JSON.stringify({ m: b.message, o: b.offre, l: b.lignes }));
        dit(b.lancer === 'Lancer (3)' && b.pleins === 1, `${T} : un seul bouton plein, « Lancer (3) »`, JSON.stringify({ l: b.lancer, p: b.pleins }));
        dit(dedans(b.carte, largeur, hauteur) && b.petits.length === 0 && !b.debord, `${T} : l’aperçu tient dans l’écran, cibles ≥ 44 px, rien ne déborde`, JSON.stringify({ c: b.carte, p: b.petits }));
        dit(!b.envoyes2.some((m) => m.quoi === 'lancer'), `${T} : rien n’est lancé tant qu’il n’a pas touché « Lancer »`, JSON.stringify(b.envoyes2));
        await clic(t.pg, '[data-fav-aide]');
        const c = await lire(t.pg);
        dit(c.aide, `${T} : « ? » explique comment ça marche`, String(c.aide));
        if (largeur === 390) await cap(t.pg, `apercu-aide-${largeur}-${scheme}`);
        await clic(t.pg, '[data-fav-lancer]');
        await t.pg.waitForTimeout(250);
        const d = await lire(t.pg);
        const lance = d.envoyes2.find((m) => m.quoi === 'lancer');
        dit(!!lance && lance.confirme === true && JSON.stringify(lance.selection) === JSON.stringify(APERCU.selection) && lance.uid === '111' && !!lance.reglages, `${T} : « Lancer » envoie la sélection de l’aperçu, son clic (confirme), le compte de l’onglet`, JSON.stringify(lance));
        dit(d.fav === 'encours' && d.envoyes === '1' && /1\/3 envoyés/.test(d.favTexte) && /prochain dans/.test(d.favTexte) && /Tout arrêter/.test(d.favTexte), `${T} : « 1/3 envoyés · prochain dans … · Tout arrêter »`, d.favTexte);
        dit(d.liens.every((l) => l.target === '_blank'), `${T} : pendant l’envoi, un lien s’ouvre dans un nouvel onglet du site (l’envoi garde le sien)`, JSON.stringify(d.liens.map((l) => l.target)));
        await cap(t.pg, `encours-${largeur}-${scheme}`);
        await clic(t.pg, '[data-fav-arreter]');
        await t.pg.waitForTimeout(250);
        const e = await lire(t.pg);
        dit(e.envoyes2.some((m) => m.quoi === 'arreter') && e.fav === 'fini' && e.fin === 'arret', `${T} : « Tout arrêter » arrête, et la carte dit ce qui est parti`, JSON.stringify({ f: e.fav, fin: e.fin, t: e.favTexte }));
        dit(!e.envoyes2.some((m) => m.action === 'ouvrirVRM') && t.erreurs.length === 0, `${T} : de bout en bout, jamais VRM ouvert, aucune erreur de page`, JSON.stringify({ e: t.erreurs }));
        await t.ctx.close();
      });
    }
    console.log('\nÉtats');
    await essaie('attente', async () => {
      const t = await ouvrir(nav, base({ apercu: null, file: { v: 1, uid: '111', actif: true, total: 5, file: { total: 5, envoyes: 2 }, attente: 'autre_compte' } }), { mobile: true, largeur: 390, hauteur: 844 });
      await montrer(t.pg, true);
      const a = await lire(t.pg);
      await cap(t.pg, 'attente-390-light');
      dit(a.fav === 'encours' && /autre compte Vinted : rien ne part/.test(a.attente), 'une attente est dite (« autre compte… rien ne part »)', a.attente);
      await t.ctx.close();
    });
    await essaie('bloque', async () => {
      const t = await ouvrir(nav, base({ apercu: { at: Date.now(), etat: 'bloque', raison: 'reglages' }, file: null }), { mobile: true, largeur: 390, hauteur: 844 });
      await montrer(t.pg, true);
      const a = await lire(t.pg);
      dit(a.fav === 'bloque' && /Écris ton message une seule fois/.test(a.favTexte), 'aucun message enregistré : le geste est dit, en une phrase', a.favTexte);
      await t.ctx.close();
    });
    await essaie('clic lien', async () => {
      const t = await ouvrir(nav, base(), { largeur: 1512, hauteur: 900 });
      await montrer(t.pg, false);
      await t.pg.evaluate(() => document.getElementById('vrm-badge').shadowRoot.querySelector('[data-lien-site="ventes"]').click());
      await t.pg.waitForURL('**/my_orders/sold', { timeout: 4000 }).catch(() => {});
      dit(t.pg.url() === 'https://www.vinted.fr/my_orders/sold', '« Mes ventes » mène aux ventes du compte, sur Vinted, dans cet onglet', t.pg.url());
      await t.ctx.close();
    });
  } finally { await nav.close(); }
  console.log(ko ? `\n❌ carte-favoris : ${ko} rouge(s) sur ${ok + ko}` : `\n✅ carte-favoris : ${ok} contrôles`);
  process.exit(ko ? 1 : 0);
})();
