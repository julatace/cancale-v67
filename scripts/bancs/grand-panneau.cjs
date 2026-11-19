// ════════════════════════════════════════════════════════════════════════
//  BANC « LE GRAND PANNEAU » (19 nov., ext. 5.409)
//
//  Julien, 19 nov. : « je veux que l'extension prenne tout l'écran, ou une très grosse partie de l'écran sur
//  Vinted […] Fais un onglet Messages (très important), Mes annonces / mon dressing, Favoris, et Ventes. Dès qu'on
//  clique sur un élément, le grand déroulé s'affiche […] "Sécuriser le compte" ça sert à rien, tu peux enlever
//  l'onglet, et "Tout arrêter" ».
//  Le VRAI vrm-badge.js + vrm-ui.js dans une page vinted.fr (faux `chrome` : il répond ce que dirait le service
//  worker ; `carteListes` est exécuté sur le vrai background.js par scripts/audit-carte-listes.cjs). 390 px au
//  doigt et 1512 px à la souris, clair et sombre ; captures dans `captures/grand-panneau`. On juge :
//   · le panneau : ≥ 70 % de la largeur à l'ordinateur, plein écran au téléphone, dans l'écran, rien ne déborde ;
//   · cinq onglets Messages · Annonces · Favoris · Ventes · Paramètres, Messages d'abord ;
//   · Messages : les conversations du compte, « Non lus · N » filtre, toucher ⇒ la conversation (volet droit à
//     l'ordinateur, sous la rangée au téléphone) avec « Répondre sur Vinted » ;
//   · Annonces : toucher ⇒ la fiche dépliée (photos, N°, prix, prix mini, acheté, taille, marque, vues…) ;
//     « pas su » ⇒ « — », jamais un chiffre inventé ;
//   · Favoris : les étapes numérotées (1 Choisir…) et la phrase qui dit quoi faire ; le rythme « au hasard 40–90 s »
//     ou « plus prudent » à l'étape de confirmation, envoyé avec `lancer` ;
//   · plus de « Sécurité du compte » ni de « Tout arrêter » ; Paramètres : le logo (remettre en place), Détails ;
//   · Échap ferme ; cibles ≥ 44 px ; aucune erreur de page.
//  `BANC_EXT=<arbre d'avant>/vinted-sync-extension` : la 5.408 (rouge attendu). Tout est inventé (dépôt public).
// ════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const RACINE = path.join(__dirname, '..', '..');
const EXT = process.env.BANC_EXT || path.join(RACINE, 'vinted-sync-extension');
const BADGE = fs.readFileSync(path.join(EXT, 'vrm-badge.js'), 'utf8');
const UI = fs.existsSync(path.join(EXT, 'vrm-ui.js')) ? fs.readFileSync(path.join(EXT, 'vrm-ui.js'), 'utf8') : '';
const LOGO = fs.readFileSync(path.join(RACINE, 'vinted-sync-extension', 'logo-vrm-96.png'));
const SORTIE = process.env.BANC_CAPTURES ? path.join(process.env.BANC_CAPTURES, 'grand-panneau') : path.join(__dirname, 'captures', 'grand-panneau');

let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + detail : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`  ❌ ${quoi} — a levé : ${String(e && e.message).slice(0, 220)}`); return null; } };

const MIN = 60000, H = 3600000, J = 86400000, T0 = Date.now();
const MODELES = ['Nike Air Max 90 blanches', 'Adidas Samba OG noires', 'New Balance 550 crème', 'Puma Suede bleues', 'Asics Gel-Kayano 14 argent', 'Nike Dunk Low Panda'];
// Des vignettes dessinées (data:) : aucune image réelle, rien de joint au réseau.
const img = (c) => `https://images1.vinted.net/banc/${c}.jpg`;
const FAVS = Array.from({ length: 8 }, (_, k) => ({ id: 'n' + k, itemId: String(500 + k), pseudo: 'acheteur_' + k, titre: `${MODELES[k % 6]} ${38 + k}`, prix: 40 + k, offre: 36 + k, date: new Date(T0 - k * 37 * MIN).toISOString(), photo: '', cochable: true, texte: `Bonjour acheteur_${k}, une offre pour toi !` }));
const APERCU = { etat: 'pret', total: 8, nonProuves: 0, ecartes: 0, selection: FAVS.map((x) => x.id), liste: FAVS, tous: FAVS, max: 15,
  message: { versions: 1, offre: { mode: 'pct', valeur: 10, arrondi: false }, intervalleMinutes: 6, intervalleMaxMinutes: null, rythme: 'normal' }, reglages: { version: 1, message: 'Bonjour {pseudo}', pourcentage: 10, offreMode: 'pct' } };
const ANN = Array.from({ length: 10 }, (_, i) => ({ id: String(7000 + i), titre: `${MODELES[i % 6]} ${39 + (i % 6)}`, prix: 55 + i * 5, photo: img('a' + i), photos: [img('a' + i), img('b' + i), img('c' + i)], num: i === 3 ? '' : String(120 + i), jours: i * 3, favoris: i % 5, depuis: T0 - i * 3 * J,
  taille: String(39 + (i % 6)), marque: MODELES[i % 6].split(' ')[0], etat: 'Très bon état', vues: 30 + i * 7, description: 'Portées quelques fois, boîte d’origine.', mini: i % 2 ? 45 + i : null, achat: i === 0 ? 30 : null }));
const VEN = [['a_expedier', true], ['a_expedier', false], ['en_route', null], ['finalisee', null], ['annulee', null]].map(([etat, b], i) => ({ tx: String(91000000000 + i), conv: String(80000 + i), titre: `${MODELES[i]} 42`, prix: 60 + i * 10, photo: img('v' + i), date: T0 - i * 30 * H, etat, vendue: etat !== 'annulee', num: String(200 + i), bordereau: b }));
const MSG = Array.from({ length: 7 }, (_, i) => ({ conv: String(60000 + i), qui: 'acheteuse_' + i, texte: i === 0 ? 'Bonjour, elle est toujours disponible ?' : 'Merci, bonne journée !', at: T0 - (i * 3 + 1) * H, nonlu: i < 2, photo: img('m' + i) }));
const STATUTS = ['en_vente', 'en_vente', 'brouillon', 'masque', 'en_vente', 'reserve', 'vendu', 'en_vente', 'en_vente', 'brouillon'];
const TOUTES = ANN.map((x, i) => Object.assign({}, x, { statut: STATUTS[i] }));
VEN[0].transporteur = 'Chronopost';
const AUTO = { offres: { actif: true, minis: 12, refus: true }, favoris: { regle: true, versions: 3, rythme: 'normal', auto: { actif: false, attenteMin: 10, attenteMax: 60, parJour: 30, parHeure: 12, heureDebut: 9, heureFin: 21 } }, baisse: null };
const NOTIFS = { vu: T0 - 3 * H, liste: [{ p: 'vinted', c: '111', s: 'ventes', id: '91000000000', t: T0 - H }, { p: 'vinted', c: '111', s: 'codes', id: '91000000002:AB12', t: T0 - 2 * H }, { p: 'vinted', c: '111', s: 'messages', id: '60000@x', t: T0 - 5 * H }, { p: 'vinted', c: '111', s: 'refus', id: 'pause@1', q: 'pause', t: T0 - 2 * J }] };
const LISTES = { ok: true, plateforme: 'vinted', compte: { id: '111', nom: 'shop_sophie' },
  annonces: { lu: T0 - 20 * MIN, aConfirmer: false, total: ANN.length, liste: ANN, toutes: TOUTES, nTous: TOUTES.length, statuts: { en_vente: 5, brouillon: 2, masque: 1, reserve: 1, vendu: 1, a_confirmer: 0 } }, automatisations: AUTO, notifications: NOTIFS, ventes: { lu: T0 - 10 * MIN, total: VEN.length, liste: VEN }, messages: { lu: T0 - 5 * MIN, liste: MSG }, autres: null };
const ETAT = { ok: true, plateforme: 'vinted', capte: true, version: '5.409.0', code: '5.409.0', vrm: { ok: true, connecte: true, email: 'sophie@exemple.fr', cloisonne: true },
  site: { id: '111', nom: 'shop_sophie', choix: 'oui', jauge: { h: 12, maxH: 50, j: 40, maxJ: 200, complet: true }, favoris: { apercu: { at: T0 - MIN, etat: 'pret', total: 8 }, file: null } },
  secu: { niveau: 'ok', texte: 'Tout va bien sur ce compte' }, toutArrete: false,
  flux: { okAt: T0 - 3 * MIN }, liens: [{ cle: 'messages', libelle: 'Messages', url: 'https://www.vinted.fr/inbox' }], capteCoupe: false };
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8sPfefwAHiQM0TP3mWgAAAABJRU5ErkJggg==', 'base64');

async function ouvrir(nav, { scheme = 'light', largeur = 1512, hauteur = 900, mobile = false, orion = false } = {}) {
  // Orion (iPhone) : le moteur WebKit n'est pas installé ici ; on joue Chromium avec l'agent et l'écran d'Orion sur iPhone.
  const ctx = await nav.newContext(Object.assign({ colorScheme: scheme, viewport: { width: largeur, height: hauteur } }, mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}, orion ? { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1 Orion/1.0' } : {}));
  const pg = await ctx.newPage();
  const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 200)));
  await pg.route('**/*', (r) => {
    const u = r.request().url();
    if (/logo-vrm-96\.png/.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: LOGO });
    if (/vinted\.net\/banc\//.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: PIXEL });
    return r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#fff;font-family:sans-serif"><header style="height:64px;border-bottom:1px solid #ddd;padding:20px">Une page Vinted</header><main style="padding:20px;height:2000px">Annonces…</main></body></html>' });
  });
  await pg.goto('https://www.vinted.fr/catalog');
  await pg.evaluate(({ e, js, ui, ap, L }) => {
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
          else if (msg.action === 'carteListes') rep = copie(L);
          else if (msg.action === 'capteLot') rep = { ok: true, lot: null };
          else if (msg.action === 'favorisCarte' && msg.quoi === 'apercu') rep = { ok: true, uid: '111', apercu: copie(ap) };
          else if (msg.action === 'favorisCarte' && msg.quoi === 'lancer') rep = msg.confirme === true ? { ok: true } : { ok: false };
          else if (msg.action === 'repondreCarte') rep = msg.confirme === true ? { ok: true } : { ok: false, raison: 'non' };
          setTimeout(() => cb && cb(rep), 0);
        } },
      storage: { local: { get: (k, cb) => { if (cb) setTimeout(() => cb({}), 0); return Promise.resolve({}); }, set: (o, cb) => { (window.__ranges = window.__ranges || []).push(copie(o)); if (cb) setTimeout(cb, 0); return Promise.resolve(); } }, onChanged: { addListener() {} } },
    };
    if (ui) { const u = document.createElement('script'); u.textContent = ui; document.documentElement.appendChild(u); }
    const s = document.createElement('script'); s.textContent = js; document.documentElement.appendChild(s);
  }, { e: ETAT, js: BADGE, ui: UI, ap: APERCU, L: LISTES });
  await pg.waitForTimeout(250);
  return { ctx, pg, erreurs };
}
const lire = (pg) => pg.evaluate(() => {
  const r = document.getElementById('vrm-badge').shadowRoot, q = (s) => r.querySelector(s);
  const rect = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), r: Math.round(b.right), b: Math.round(b.bottom), w: Math.round(b.width), h: Math.round(b.height) }; };
  const vis = (el) => !!(el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none');
  const carte = q('.carte');
  const ctl = Array.from(r.querySelectorAll('.carte button, .carte a[href], .carte input')).filter(vis);
  const texte = carte ? carte.innerText : '';
  return {
    carte: rect(carte), grand: !!(carte && carte.hasAttribute('data-grand')), on: !!(carte && carte.classList.contains('on')),
    onglet: q('[data-listes]') && q('[data-listes]').getAttribute('data-onglet'),
    onglets: Array.from(r.querySelectorAll('[data-onglet-b]')).filter(vis).map((b) => b.getAttribute('data-onglet-b')),
    msgs: r.querySelectorAll('[data-conv]').length, volet: q('[data-volet-conv]') ? q('[data-volet-conv]').getAttribute('data-volet-conv') : null,
    convOuverte: Array.from(r.querySelectorAll('[data-conv-ouverte]')).filter(vis).map((x) => x.getAttribute('data-conv-ouverte')),
    repondre: Array.from(r.querySelectorAll('[data-geste="repondre"]')).filter(vis).map((a) => a.href),
    fiche: q('[data-fiche]') ? { id: q('[data-fiche]').getAttribute('data-fiche'), faits: Object.fromEntries(Array.from(r.querySelectorAll('[data-fiche] [data-fait]')).map((f) => [f.getAttribute('data-fait'), f.querySelector('b').innerText.replace(/\s/g, ' ')])), photos: r.querySelectorAll('[data-fiche] .ph5 img').length, desc: !!q('[data-fiche] [data-desc]') } : null,
    etape: q('[data-fav-etape]') ? q('[data-fav-etape]').getAttribute('data-fav-etape') : null, guide: q('[data-fav-guide]') ? q('[data-fav-guide]').innerText : '',
    rythme: q('[data-fav-rythme]') ? q('[data-fav-rythme]').getAttribute('data-fav-rythme') : null,
    secu: /Sécurité du compte/.test(texte), toutArreter: !!q('[data-tout-arreter]'),
    repOk: !!q('[data-rep-etat="ok"]'),
    chips: Array.from(r.querySelectorAll('[data-ann-statut]')).map((b) => b.getAttribute('data-ann-statut') + ':' + (b.innerText.split('·')[1] || '').trim()),
    annVue: q('[data-vue]') ? q('[data-vue]').getAttribute('data-vue') : null,
    lignesAnn: r.querySelectorAll('.table5 [data-annonce]').length, cartesGrille: r.querySelectorAll('.grille5 [data-annonce]').length,
    action: q('[data-ann-action]') ? { off: q('[data-ann-action]').disabled, options: Array.from(q('[data-ann-action]').options).map((o) => o.value) } : null,
    cols: q('[data-cols]') ? q('[data-cols]').getAttribute('data-cols').split(' ') : [],
    coches: Array.from(r.querySelectorAll('[data-ann-sel]')).filter((c) => c.checked).length,
    ranges: window.__ranges || [],
    auto: Array.from(r.querySelectorAll('[data-auto-carte]')).map((x) => x.getAttribute('data-auto-carte') + ':' + x.querySelector('[data-etat]').getAttribute('data-etat')),
    notifs: Array.from(r.querySelectorAll('[data-notif]')).map((x) => x.getAttribute('data-notif') + ':' + x.getAttribute('data-notif-statut-l')),
    parametres: !!q('[data-parametres]'), remettre: !!q('[data-parametres] [data-replacer-logo]'), details: !!q('[data-parametres] [data-detail]'),
    petits: ctl.filter((b) => b.offsetHeight < 44 && !b.closest('.outils') && !b.closest('.detail') && b.tagName !== 'INPUT').map((b) => (b.className || b.tagName) + ':' + b.offsetHeight + ':' + (b.innerText || '').slice(0, 20)),
    debord: document.documentElement.scrollWidth > window.innerWidth || (carte && carte.scrollWidth > carte.clientWidth + 1),
    envoyes: window.__envoyes.filter((m) => m.action !== 'etat' && m.action !== 'capteLot'),
  };
});
const clic = async (pg, sel) => { await pg.evaluate((s) => { const b = document.getElementById('vrm-badge').shadowRoot.querySelector(s); if (b) b.click(); }, sel); await pg.waitForTimeout(220); };
const montrer = async (pg, mobile) => {
  const b = await pg.evaluate(() => { const x = document.getElementById('vrm-badge').shadowRoot.querySelector('.btn').getBoundingClientRect(); return { x: x.left + x.width / 2, y: x.top + x.height / 2 }; });
  if (mobile) await pg.touchscreen.tap(b.x, b.y); else { await pg.mouse.move(5, 5); await pg.mouse.move(b.x, b.y); await pg.mouse.click(b.x, b.y); }
  await pg.waitForTimeout(400);
};

(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  fs.mkdirSync(SORTIE, { recursive: true });
  const cap = async (pg, nom) => { try { await pg.screenshot({ path: path.join(SORTIE, nom + '.png') }); } catch (_) {} };
  try {
    for (const [largeur, hauteur, mobile, orion] of [[1512, 900, false, false], [390, 844, true, false], [390, 844, true, true]]) for (const scheme of (orion ? ['light'] : ['light', 'dark'])) {
      const T = `${largeur}${orion ? ' Orion' : ''} ${scheme}`;
      console.log(`\n${T}`);
      await essaie(T, async () => {
        const t = await ouvrir(nav, { scheme, largeur, hauteur, mobile, orion });
        await montrer(t.pg, mobile);
        let a = await lire(t.pg);
        await cap(t.pg, `${orion ? 'orion-' : ''}messages-${largeur}-${scheme}`);
        dit(a.on && a.grand, `${T} : la carte s’ouvre en GRAND panneau`, JSON.stringify({ on: a.on, g: a.grand }));
        const large = mobile ? a.carte && a.carte.w >= largeur - 1 && a.carte.h >= hauteur - 1 : a.carte && a.carte.w >= largeur * 0.7;
        dit(large && a.carte.x >= 0 && a.carte.r <= largeur && !a.debord, `${T} : ${mobile ? 'plein écran' : '≥ 70 % de la largeur'}, dans l’écran, rien ne déborde`, JSON.stringify(a.carte));
        dit(JSON.stringify(a.onglets) === JSON.stringify(['messages', 'annonces', 'favoris', 'ventes', 'notifications', 'automatisations', 'parametres']) && a.onglet === 'messages', `${T} : Messages · Annonces · Favoris · Ventes · Notifications · Automatisations · Paramètres, Messages d’abord`, JSON.stringify(a.onglets));
        dit(!a.secu && !a.toutArreter, `${T} : plus de « Sécurité du compte » ni de « Tout arrêter »`);
        dit(a.msgs === 7, `${T} : les 7 conversations du compte de l’onglet`, a.msgs);
        await clic(t.pg, '[data-msg-nonlus]');
        a = await lire(t.pg);
        dit(a.msgs === 2, `${T} : « Non lus · 2 » ne garde que les 2 non lues`, a.msgs);
        await clic(t.pg, '[data-msg-nonlus]');
        await clic(t.pg, '[data-conv-b="60000"]');
        a = await lire(t.pg);
        await cap(t.pg, `${orion ? 'orion-' : ''}conversation-${largeur}-${scheme}`);
        dit(a.convOuverte.includes('60000') && a.repondre.some((h) => /\/inbox\/60000$/.test(h)), `${T} : toucher une conversation la montre (${mobile ? 'sous la rangée' : 'volet droit'}), « Répondre sur Vinted »`, JSON.stringify({ c: a.convOuverte, r: a.repondre }));
        // Annonces : la fiche dépliée.
        await clic(t.pg, '[data-onglet-b="annonces"]');
        await clic(t.pg, '[data-fiche-b="a:7001"]');
        a = await lire(t.pg);
        await cap(t.pg, `${orion ? 'orion-' : ''}fiche-${largeur}-${scheme}`);
        const f = a.fiche || { faits: {} };
        dit(f.id === 'a:7001' && f.photos === 3 && f.desc && f.faits.num === '121' && /46/.test(f.faits.mini) && f.faits.achat === '—' && f.faits.taille === '40' && f.faits.vues === '37', `${T} : toucher une annonce déplie sa fiche : photos, N°, prix mini, taille, vues ; acheté pas su ⇒ « — »`, JSON.stringify(f));
        await clic(t.pg, '[data-fiche-b="a:7001"]');
        a = await lire(t.pg);
        dit(!a.fiche, `${T} : la retoucher la replie`);
        await clic(t.pg, '[data-fiche-b="a:7000"]');
        a = await lire(t.pg);
        dit(a.fiche && a.fiche.faits.achat === '30 €' && a.fiche.faits.ecart === '+25 €' && a.fiche.faits.mini === '—', `${T} : acheté connu ⇒ « Prix − achat » ; prix mini pas posé ⇒ « — »`, JSON.stringify(a.fiche && a.fiche.faits));
        // Ventes.
        await clic(t.pg, '[data-onglet-b="ventes"]');
        await clic(t.pg, '[data-fiche-b="v:91000000000"]');
        a = await lire(t.pg);
        await cap(t.pg, `${orion ? 'orion-' : ''}ventes-${largeur}-${scheme}`);
        dit(a.fiche && a.fiche.id === 'v:91000000000' && /Action requise/.test(a.fiche.faits.etat) && a.fiche.faits.bordereau === 'prêt', `${T} : une vente déplie sa fiche (état en mots clairs, bordereau)`, JSON.stringify(a.fiche));
        // Favoris : les étapes.
        await clic(t.pg, '[data-onglet-b="favoris"]');
        await t.pg.waitForTimeout(300);
        a = await lire(t.pg);
        await cap(t.pg, `${orion ? 'orion-' : ''}favoris-${largeur}-${scheme}`);
        dit(a.etape === '1' && /Coche/.test(a.guide), `${T} : Favoris · étape 1 « Choisir », la phrase qui dit quoi faire`, JSON.stringify({ e: a.etape, g: a.guide }));
        await clic(t.pg, '[data-fav-envoyer]');
        a = await lire(t.pg);
        await cap(t.pg, `${orion ? 'orion-' : ''}favoris-recap-${largeur}-${scheme}`);
        dit(a.etape === '4' && a.rythme === 'normal', `${T} : étape 4 « Confirmer » : le rythme au hasard (40–90 s) par défaut`, JSON.stringify({ e: a.etape, r: a.rythme }));
        await clic(t.pg, '[data-fav-rythme-b="prudent"]');
        a = await lire(t.pg);
        dit(a.rythme === 'prudent', `${T} : « Plus prudent » se choisit à l’étape du rythme`, a.rythme);
        await clic(t.pg, '[data-fav-lancer]');
        a = await lire(t.pg);
        const l = a.envoyes.find((m) => m.quoi === 'lancer');
        dit(l && l.confirme === true && l.rythme === 'prudent', `${T} : « Confirmer l’envoi » part avec SON rythme et son clic`, JSON.stringify(l));
        // Répondre depuis le volet Messages.
        if (!(await lire(t.pg)).on) await montrer(t.pg, mobile);
        await clic(t.pg, '[data-onglet-b="messages"]');
        await clic(t.pg, '[data-conv-b="60001"]');
        await t.pg.evaluate(() => { const ta = document.getElementById('vrm-badge').shadowRoot.querySelector('[data-rep-texte="60001"]'); ta.value = 'Oui, toujours disponible'; ta.dispatchEvent(new Event('input')); });
        await clic(t.pg, '[data-rep-envoyer="60001"]');
        await t.pg.waitForTimeout(200);
        a = await lire(t.pg);
        await cap(t.pg, `${orion ? 'orion-' : ''}reponse-${largeur}-${scheme}`);
        const rp = a.envoyes.find((m) => m.action === 'repondreCarte');
        dit(rp && rp.conv === '60001' && rp.confirme === true && rp.texte === 'Oui, toujours disponible' && a.repOk, `${T} : répondre depuis le volet : SA conversation, son texte, son toucher ; « Envoyé » dit`, JSON.stringify({ rp, ok: a.repOk }));
        // Annonces : action, statuts, colonnes, grille, cases.
        await clic(t.pg, '[data-onglet-b="annonces"]');
        a = await lire(t.pg);
        await cap(t.pg, `${orion ? 'orion-' : ''}annonces-${largeur}-${scheme}`);
        dit(a.chips.join('|') === 'tous:10|en_vente:5|brouillon:2|masque:1|reserve:1|vendu:1' && a.annVue === 'liste' && a.lignesAnn === 5, `${T} : Annonces : statuts à compteurs (Toutes 10 · En vente 5 · Brouillon 2 · Masqué 1 · Réservé 1 · Vendu 1), « En vente » d’abord`, JSON.stringify({ c: a.chips, v: a.annVue, n: a.lignesAnn }));
        dit(a.action && a.action.off && !a.action.options.includes('supprimer'), `${T} : « Choisir une action » grisé sans sélection, aucune suppression en série`, JSON.stringify(a.action));
        await clic(t.pg, '[data-ann-statut="brouillon"]');
        a = await lire(t.pg);
        dit(a.lignesAnn === 2, `${T} : le filtre « Brouillon » ne garde que les 2 brouillons`, a.lignesAnn);
        await clic(t.pg, '[data-ann-statut="tous"]');
        await t.pg.evaluate(() => { const r = document.getElementById('vrm-badge').shadowRoot; const d = r.querySelector('[data-ann-cols]'); d.open = true; const c = r.querySelector('[data-ann-col="vues"]'); c.checked = true; c.dispatchEvent(new Event('change')); });
        await t.pg.waitForTimeout(200);
        a = await lire(t.pg);
        await cap(t.pg, `${orion ? 'orion-' : ''}colonnes-${largeur}-${scheme}`);
        dit(a.cols.includes('vues') && a.ranges.some((x) => x.vrmPanneauAnnonces && x.vrmPanneauAnnonces.cols.includes('vues')), `${T} : « Colonnes ▾ » : Vues ajoutée, le choix est gardé`, JSON.stringify({ c: a.cols, r: a.ranges.slice(-1) }));
        await t.pg.evaluate(() => { const r = document.getElementById('vrm-badge').shadowRoot; const c = r.querySelector('[data-ann-tout]'); c.checked = true; c.dispatchEvent(new Event('change')); });
        await t.pg.waitForTimeout(200);
        a = await lire(t.pg);
        dit(a.coches === 10 && a.action && !a.action.off, `${T} : « tout » coche les 10 lignes, l’action devient possible`, JSON.stringify({ c: a.coches, a: a.action }));
        await clic(t.pg, '[data-ann-vue="grille"]');
        a = await lire(t.pg);
        await cap(t.pg, `${orion ? 'orion-' : ''}grille-${largeur}-${scheme}`);
        dit(a.annVue === 'grille' && a.cartesGrille === 10, `${T} : la grille montre les 10 annonces`, JSON.stringify({ v: a.annVue, n: a.cartesGrille }));
        await clic(t.pg, '[data-ann-vue="liste"]');
        // Automatisations.
        await clic(t.pg, '[data-onglet-b="automatisations"]');
        a = await lire(t.pg);
        await cap(t.pg, `${orion ? 'orion-' : ''}automatisations-${largeur}-${scheme}`);
        dit(a.auto.join('|') === 'favoris:off|offres:on|baisse:bientot', `${T} : Automatisations : favoris Désactivé, offres Activé, baisse « pas su » (pas livrée) — lus`, JSON.stringify(a.auto));
        // Notifications.
        await clic(t.pg, '[data-onglet-b="notifications"]');
        a = await lire(t.pg);
        await cap(t.pg, `${orion ? 'orion-' : ''}notifications-${largeur}-${scheme}`);
        dit(a.notifs.join('|') === 'ventes:nouveau|codes:nouveau|messages:vu|refus:vu', `${T} : Notifications : 4 lignes, « nouveau » après le marqueur, « vu » avant`, JSON.stringify(a.notifs));
        await t.pg.evaluate(() => { const s2 = document.getElementById('vrm-badge').shadowRoot.querySelector('[data-notif-type]'); s2.value = 'codes'; s2.dispatchEvent(new Event('change')); });
        await t.pg.waitForTimeout(200);
        a = await lire(t.pg);
        dit(a.notifs.join('|') === 'codes:nouveau', `${T} : le filtre « type » garde les codes de retrait`, JSON.stringify(a.notifs));
        // Paramètres.
        if (!(await lire(t.pg)).on) await montrer(t.pg, mobile);
        await clic(t.pg, '[data-onglet-b="parametres"]');
        a = await lire(t.pg);
        await cap(t.pg, `${orion ? 'orion-' : ''}parametres-${largeur}-${scheme}`);
        dit(a.parametres && a.remettre && a.details, `${T} : Paramètres : le logo (« Remettre le logo en place »), Détails replié`, JSON.stringify({ p: a.parametres, r: a.remettre, d: a.details }));
        dit(a.petits.length === 0, `${T} : cibles ≥ 44 px`, JSON.stringify(a.petits));
        await t.pg.keyboard.press('Escape');
        await t.pg.waitForTimeout(250);
        a = await lire(t.pg);
        dit(!a.on, `${T} : Échap ferme le panneau`);
        dit(t.erreurs.length === 0, `${T} : aucune erreur de page`, JSON.stringify(t.erreurs));
        await t.ctx.close();
      });
    }
  } finally { await nav.close(); }
  console.log(ko ? `\n❌ grand-panneau : ${ko} rouge(s) sur ${ok + ko}` : `\n✅ grand-panneau : ${ok} contrôles`);
  process.exit(ko ? 1 : 0);
})();
