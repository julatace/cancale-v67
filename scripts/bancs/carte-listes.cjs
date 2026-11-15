// ════════════════════════════════════════════════════════════════════════
//  BANC « LA CARTE : FAVORIS · ANNONCES · VENTES DU COMPTE CONNECTÉ » (5.377)
//
//  Julien, 14 nov. : « que l'on puisse voir les favoris du plus récent au plus vieux
//  pour envoyer des messages aux favoris, voir les annonces et ventes à chaque fois
//  sur le compte connecté ; les autres comptes sont floutés sauf si la personne met
//  tous les comptes sélectionnés, mais aucune action n'est possible dessus ».
//
//  Le VRAI vrm-badge.js dans une page vinted.fr (faux `chrome` : il répond ce que dirait
//  le service worker — `carteListes` et la garde « autre compte » sont EXÉCUTÉES sur le
//  vrai background.js par scripts/audit-carte-listes.cjs). 30 favoris, 2 comptes,
//  390 px au doigt et 1512 px à la souris, clair et sombre ; captures dans
//  `captures/carte-listes`. Le banc juge (data-*, nombres) :
//   · trois onglets Favoris · Annonces · Ventes (touches 44 px, l'actif enfoncé + diode) ;
//   · Favoris : l'aperçu trié du plus récent au plus ancien, des cases (la rangée entière),
//     « Tout cocher », « Envoyer le message (N) » = le seul bouton plein ; il n'envoie QUE
//     ce qui est coché, avec `confirme` ;
//   · Annonces / Ventes : celles du compte de l'onglet (N°, prix, état, bordereau) ;
//   · « Tous les comptes » : l'autre compte FLOUTÉ, `inert`, détails `aria-hidden`, aucun
//     bouton ni lien ni case actionnable, « Connecte-toi à ce compte pour agir » ;
//   · rien ne déborde, la carte dans l'écran, aucune erreur de page, jamais VRM ouvert.
//  Tout est inventé (dépôt public).
// ════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const RACINE = path.join(__dirname, '..', '..');
const EXT = process.env.BANC_EXT || path.join(RACINE, 'vinted-sync-extension');
const BADGE = fs.readFileSync(path.join(EXT, 'vrm-badge.js'), 'utf8');
const LOGO = fs.readFileSync(path.join(RACINE, 'vinted-sync-extension', 'logo-vrm-96.png'));
const SORTIE = process.env.BANC_CAPTURES ? path.join(process.env.BANC_CAPTURES, 'carte-listes') : path.join(__dirname, 'captures', 'carte-listes');

let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + detail : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`  ❌ ${quoi} — a levé : ${String(e && e.message).slice(0, 220)}`); return null; } };

const MIN = 60000, H = 3600000, J = 86400000, T0 = Date.now();
const MODELES = ['Nike Air Max 90 blanches', 'Adidas Samba OG noires', 'New Balance 550 crème', 'Puma Suede bleues', 'Asics Gel-Kayano 14 argent', 'Nike Dunk Low Panda'];
// 30 favoris, dans le DÉSORDRE (le serveur peut rendre n'importe quel ordre) : la carte trie.
const FAVS = Array.from({ length: 30 }, (_, i) => { const k = (i * 7) % 30; return { id: 'n' + k, itemId: String(500 + k), pseudo: 'acheteur_' + k, titre: `${MODELES[k % 6]} ${38 + (k % 8)}`, prix: 40 + k, offre: Math.round((40 + k) * 0.9 * 100) / 100, date: new Date(T0 - k * 37 * MIN).toISOString(), photo: '', texte: `Bonjour acheteur_${k}, ${MODELES[k % 6]} est à ${Math.round((40 + k) * 0.9)} € pour toi !` }; });
const APERCU = { etat: 'pret', total: 30, nonProuves: 0, ecartes: 0, selection: FAVS.map((x) => x.id), liste: FAVS,
  message: { versions: 1, offre: { mode: 'pct', valeur: 10, arrondi: false }, intervalleMinutes: 0, intervalleMaxMinutes: null }, reglages: { version: 1, message: 'Bonjour {pseudo}', pourcentage: 10, offreMode: 'pct' } };
const ANN = Array.from({ length: 12 }, (_, i) => ({ id: String(7000 + i), titre: `${MODELES[i % 6]} ${39 + (i % 6)}`, prix: 55 + i * 5, photo: '', num: i % 4 === 3 ? '' : String(120 + i), jours: i * 3, favoris: i % 5, depuis: T0 - i * 3 * J }));
const VEN = [['a_expedier', true], ['a_expedier', false], ['en_route', null], ['finalisee', null], ['finalisee', null], ['annulee', null]].map(([etat, b], i) => ({ tx: String(91000000000 + i), titre: `${MODELES[i]} 42`, prix: 60 + i * 10, photo: '', date: T0 - i * 30 * H, etat, vendue: etat !== 'annulee', num: String(200 + i), bordereau: b }));
const LISTES = (tous) => ({ ok: true, plateforme: 'vinted', compte: { id: '111', nom: 'shop_sophie' },
  annonces: { lu: T0 - 20 * MIN, aConfirmer: false, total: ANN.length, liste: ANN }, ventes: { lu: T0 - 10 * MIN, total: VEN.length, liste: VEN },
  autres: tous ? [{ id: '222', nom: 'julien_kicks', lectureSeule: true, annonces: { n: 120, liste: ANN.slice(0, 4).map((x) => ({ titre: x.titre, prix: x.prix })) }, ventes: { n: 340, liste: VEN.slice(0, 4).map((x) => ({ titre: x.titre, prix: x.prix, etat: x.etat })) } }] : null });
const ETAT = { ok: true, plateforme: 'vinted', capte: true, version: '5.377.0', code: '5.377.0', vrm: { ok: true, connecte: true, email: 'sophie@exemple.fr', cloisonne: true },
  site: { id: '111', nom: 'shop_sophie', choix: 'oui', jauge: { h: 12, maxH: 50, j: 40, maxJ: 200, complet: true }, favoris: { apercu: { at: T0 - MIN, etat: 'pret', total: 30 }, file: null } },
  flux: { okAt: T0 - 3 * MIN }, liens: [{ cle: 'messages', libelle: 'Messages', url: 'https://www.vinted.fr/inbox' }], capteCoupe: false };

async function ouvrir(nav, { scheme = 'light', largeur = 1512, hauteur = 900, mobile = false } = {}) {
  const ctx = await nav.newContext(Object.assign({ colorScheme: scheme, viewport: { width: largeur, height: hauteur } }, mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}));
  const pg = await ctx.newPage();
  const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 200)));
  await pg.route('**/*', (r) => {
    if (/logo-vrm-96\.png/.test(r.request().url())) return r.fulfill({ status: 200, contentType: 'image/png', body: LOGO });
    return r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#fff;font-family:sans-serif"><header style="height:64px;border-bottom:1px solid #ddd;padding:20px">Une page Vinted</header><main style="padding:20px;height:2000px">Annonces…</main></body></html>' });
  });
  await pg.goto('https://www.vinted.fr/catalog');
  await pg.evaluate(({ e, js, ap, L0, L1 }) => {
    window.__envoyes = [];
    const copie = (x) => JSON.parse(JSON.stringify(x));
    const orig = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (o) { return orig.call(this, Object.assign({}, o, { mode: 'open' })); };
    window.chrome = {
      runtime: { id: 'ext', getURL: (p) => location.origin + '/' + p, getManifest: () => ({ version: e.version }), lastError: null,
        sendMessage: (msg, cb) => {
          window.__envoyes.push(copie(msg));
          let rep = { ok: true };
          if (msg.action === 'etat') rep = copie(e);
          else if (msg.action === 'carteListes') rep = copie(msg.tous ? L1 : L0);
          else if (msg.action === 'capteLot') rep = { ok: true, lot: null };
          else if (msg.action === 'favorisCarte' && msg.quoi === 'apercu') rep = { ok: true, uid: '111', apercu: copie(ap) };
          else if (msg.action === 'favorisCarte' && msg.quoi === 'lancer') rep = msg.confirme === true ? { ok: true } : { ok: false };
          setTimeout(() => cb && cb(rep), 0);
        } },
      storage: { local: { get: (k, cb) => { if (cb) setTimeout(() => cb({}), 0); return Promise.resolve({}); }, set: (o, cb) => { if (cb) setTimeout(cb, 0); return Promise.resolve(); } }, onChanged: { addListener() {} } },
    };
    const s = document.createElement('script'); s.textContent = js; document.documentElement.appendChild(s);
  }, { e: ETAT, js: BADGE, ap: APERCU, L0: LISTES(false), L1: LISTES(true) });
  await pg.waitForTimeout(250);
  return { ctx, pg, erreurs };
}
const lire = (pg) => pg.evaluate(() => {
  const h = document.getElementById('vrm-badge');
  const r = h.shadowRoot, q = (s) => r.querySelector(s);
  const rect = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), r: Math.round(b.right), b: Math.round(b.bottom), w: Math.round(b.width), h: Math.round(b.height) }; };
  const vis = (el) => !!(el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
  const carte = q('.carte');
  const ctl = Array.from(r.querySelectorAll('.carte button, .carte a[href], .carte input')).filter(vis);
  const autre = q('[data-autre]');
  const actifsAutre = autre ? Array.from(autre.querySelectorAll('button, a[href], input, [tabindex]')).length : null;
  return {
    carte: rect(carte), onglet: q('[data-listes]') && q('[data-listes]').getAttribute('data-onglet'), portee: q('[data-listes]') && q('[data-listes]').getAttribute('data-portee'),
    touches: Array.from(r.querySelectorAll('.touche')).filter(vis).map((b) => ({ t: b.innerText.trim(), h: b.offsetHeight, actif: b.hasAttribute('data-actif'), diode: getComputedStyle(b, '::after').content !== 'none' && b.hasAttribute('data-actif') })),
    vue: q('[data-fav-vue]') ? q('[data-fav-vue]').getAttribute('data-fav-vue') : null,
    dates: Array.from(r.querySelectorAll('[data-fav-date]')).map((li) => Date.parse(li.getAttribute('data-fav-date'))),
    coches: Array.from(r.querySelectorAll('[data-fav-coche]')).filter((c) => c.checked).map((c) => c.getAttribute('data-fav-coche')),
    lignesFav: Array.from(r.querySelectorAll('li.coche-l')).filter(vis).map((li) => li.offsetHeight),
    envoyer: q('[data-fav-lancer]') ? { t: q('[data-fav-lancer]').innerText.trim(), off: q('[data-fav-lancer]').disabled } : null,
    tout: q('[data-fav-tout]') ? q('[data-fav-tout]').getAttribute('data-fav-tout') : null,
    annonces: r.querySelectorAll('[data-annonce]').length, nums: Array.from(r.querySelectorAll('[data-annonce] [data-num]')).map((x) => x.getAttribute('data-num')),
    annonceHref: q('[data-annonce]') ? q('[data-annonce]').href : '', ventes: Array.from(r.querySelectorAll('[data-vente]')).map((x) => ({ e: x.getAttribute('data-vente-etat'), b: x.getAttribute('data-bordereau') })),
    autre: autre ? { inert: autre.hasAttribute('inert') && autre.inert === true, flou: getComputedStyle(autre.querySelector('.flou')).filter, cache: autre.querySelector('.flou').getAttribute('aria-hidden'), texte: autre.innerText.replace(/\s+/g, ' ').trim(), actifs: actifsAutre } : null,
    pleins: ctl.filter((b) => b.classList.contains('b') && !b.classList.contains('sec')).length,
    petits: ctl.filter((b) => b.offsetHeight < 44 && !b.closest('.outils') && b.tagName !== 'INPUT').map((b) => (b.className || b.tagName) + ':' + b.offsetHeight),
    debord: document.documentElement.scrollWidth > window.innerWidth || (carte && carte.scrollWidth > carte.clientWidth + 1),
    envoyes: window.__envoyes.filter((m) => m.action !== 'etat' && m.action !== 'capteLot'),
  };
});
const dedans = (c, W, H) => !!c && c.x >= 0 && c.y >= 0 && c.r <= W && c.b <= H;
const clic = async (pg, sel) => { await pg.evaluate((s) => { const b = document.getElementById('vrm-badge').shadowRoot.querySelector(s); if (b) b.click(); }, sel); await pg.waitForTimeout(220); };
const montrer = async (pg, mobile) => {
  const b = await pg.evaluate(() => { const x = document.getElementById('vrm-badge').shadowRoot.querySelector('.btn').getBoundingClientRect(); return { x: x.left + x.width / 2, y: x.top + x.height / 2 }; });
  if (mobile) await pg.touchscreen.tap(b.x, b.y); else { await pg.mouse.move(5, 5); await pg.mouse.move(b.x, b.y); await pg.mouse.click(b.x, b.y); }
  await pg.waitForTimeout(350);
};

(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  fs.mkdirSync(SORTIE, { recursive: true });
  const cap = async (pg, nom) => { try { await pg.screenshot({ path: path.join(SORTIE, nom + '.png') }); } catch (_) {} };
  try {
    for (const [largeur, hauteur, mobile] of [[1512, 900, false], [390, 844, true]]) for (const scheme of ['light', 'dark']) {
      const T = `${largeur} ${scheme}`;
      console.log(`\n${T}`);
      await essaie(T, async () => {
        const t = await ouvrir(nav, { scheme, largeur, hauteur, mobile });
        await montrer(t.pg, mobile);
        let a = await lire(t.pg);
        await cap(t.pg, `favoris-${largeur}-${scheme}`);
        dit(a.onglet === 'favoris' && a.touches.filter((x) => ['Favoris', 'Annonces', 'Ventes'].includes(x.t)).length === 3, `${T} : trois onglets Favoris · Annonces · Ventes, Favoris d’abord`, JSON.stringify(a.touches));
        dit(a.touches.every((x) => x.h >= 44) && a.touches.filter((x) => x.actif).length === 2 && a.touches.filter((x) => x.actif).every((x) => x.diode), `${T} : touches de 44 px, l’actif enfoncé + diode (l’onglet et le compte)`, JSON.stringify(a.touches));
        dit(a.portee === 'ce' && a.touches.some((x) => x.t === 'shop_sophie' && x.actif) && a.touches.some((x) => x.t === 'Tous les comptes' && !x.actif), `${T} : « shop_sophie · Tous les comptes », le compte connecté par défaut`, JSON.stringify(a.touches.map((x) => x.t)));
        // L'aperçu des favoris : trié, coché, un seul plein.
        await clic(t.pg, '[data-fav-voir]');
        a = await lire(t.pg);
        await cap(t.pg, `apercu-${largeur}-${scheme}`);
        const trie = a.dates.length === 30 && a.dates.every((d, i) => i === 0 || a.dates[i - 1] >= d);
        dit(trie, `${T} : 30 favoris, du plus récent au plus ancien`, JSON.stringify(a.dates.slice(0, 5)));
        dit(a.coches.length === 30 && a.envoyer && a.envoyer.t === 'Envoyer le message (30)' && !a.envoyer.off && a.pleins === 1, `${T} : tout coché, « Envoyer le message (30) », le seul bouton plein`, JSON.stringify({ c: a.coches.length, e: a.envoyer, p: a.pleins }));
        dit(a.lignesFav.length === 30 && a.lignesFav.every((h) => h >= 44), `${T} : chaque favori est une rangée de 44 px au moins (toute la rangée coche)`, JSON.stringify(a.lignesFav.slice(0, 3)));
        await clic(t.pg, '[data-fav-tout]');
        a = await lire(t.pg);
        dit(a.coches.length === 0 && a.envoyer.off && a.tout === 'tous', `${T} : « Tout décocher » ⇒ rien de coché, « Envoyer » grisé`, JSON.stringify({ c: a.coches.length, e: a.envoyer }));
        await clic(t.pg, 'li.coche-l[data-fav-qui="n0"]');
        await clic(t.pg, 'li.coche-l[data-fav-qui="n2"]');
        a = await lire(t.pg);
        dit(a.coches.length === 2 && a.envoyer.t === 'Envoyer le message (2)', `${T} : toucher deux rangées les coche`, JSON.stringify({ c: a.coches, e: a.envoyer }));
        dit(!a.envoyes.some((m) => m.quoi === 'lancer'), `${T} : rien n’est envoyé avant son clic`, JSON.stringify(a.envoyes));
        await clic(t.pg, '[data-fav-lancer]');
        a = await lire(t.pg);
        const l = a.envoyes.find((m) => m.quoi === 'lancer');
        dit(l && l.confirme === true && JSON.stringify(l.selection) === JSON.stringify(['n0', 'n2']) && l.uid === '111', `${T} : « Envoyer » part avec SA sélection (n0, n2), son clic, le compte de l’onglet`, JSON.stringify(l));
        // Annonces.
        const ouverte = await t.pg.evaluate(() => document.getElementById('vrm-badge').shadowRoot.querySelector('.carte').classList.contains('on'));
        if (!ouverte) await montrer(t.pg, mobile);
        await clic(t.pg, '[data-onglet-b="annonces"]');
        a = await lire(t.pg);
        await cap(t.pg, `annonces-${largeur}-${scheme}`);
        dit(a.onglet === 'annonces' && a.annonces === 12 && a.nums.length === 9 && /^https:\/\/www\.vinted\.fr\/items\/7000$/.test(a.annonceHref), `${T} : Annonces du compte connecté (12, N° quand il existe, toucher ouvre l’annonce sur Vinted)`, JSON.stringify({ o: a.onglet, n: a.annonces, nums: a.nums.length, h: a.annonceHref }));
        dit(dedans(a.carte, largeur, hauteur) && !a.debord, `${T} : la carte tient dans l’écran, rien ne déborde`, JSON.stringify(a.carte));
        await clic(t.pg, '[data-onglet-b="ventes"]');
        a = await lire(t.pg);
        await cap(t.pg, `ventes-${largeur}-${scheme}`);
        dit(a.ventes.length === 6 && a.ventes[0].e === 'a_expedier' && a.ventes[0].b === 'pret' && a.ventes[1].b === 'manque' && a.ventes[5].e === 'annulee', `${T} : Ventes : état, bordereau prêt / pas encore, l’annulée dite`, JSON.stringify(a.ventes));
        // Tous les comptes.
        await clic(t.pg, '[data-portee-b="tous"]');
        await t.pg.waitForTimeout(200);
        a = await lire(t.pg);
        await cap(t.pg, `tous-${largeur}-${scheme}`);
        dit(a.portee === 'tous' && a.autre && a.autre.inert && /blur/.test(a.autre.flou) && a.autre.cache === 'true', `${T} : « Tous les comptes » : l’autre compte flouté, inert, détails cachés aux lecteurs d’écran`, JSON.stringify(a.autre));
        dit(a.autre && a.autre.actifs === 0 && /julien_kicks/.test(a.autre.texte) && /Connecte-toi à ce compte pour agir/.test(a.autre.texte), `${T} : aucun bouton, lien ni case sur l’autre compte ; « Connecte-toi à ce compte pour agir »`, JSON.stringify(a.autre));
        dit(a.envoyes.some((m) => m.action === 'carteListes' && m.tous === true), `${T} : les autres comptes ne sont demandés qu’avec « Tous les comptes »`, JSON.stringify(a.envoyes.filter((m) => m.action === 'carteListes')));
        dit(a.petits.length === 0 && !a.debord && dedans(a.carte, largeur, hauteur), `${T} : cibles ≥ 44 px, rien ne déborde`, JSON.stringify({ p: a.petits, c: a.carte }));
        dit(!a.envoyes.some((m) => m.action === 'ouvrirVRM') && t.erreurs.length === 0, `${T} : jamais VRM ouvert, aucune erreur de page`, JSON.stringify(t.erreurs));
        await t.ctx.close();
      });
    }
  } finally { await nav.close(); }
  console.log(ko ? `\n❌ carte-listes : ${ko} rouge(s) sur ${ok + ko}` : `\n✅ carte-listes : ${ok} contrôles`);
  process.exit(ko ? 1 : 0);
})();
