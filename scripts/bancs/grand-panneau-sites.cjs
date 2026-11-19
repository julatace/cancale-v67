// ════════════════════════════════════════════════════════════════════════
//  BANC « LE GRAND PANNEAU » SUR LEBONCOIN ET VESTIAIRE (19 nov., ext. 5.409) — Julien : « tout doit marcher aussi
//  pour Leboncoin et Vestiaire Collective ». Même harnais que grand-panneau.cjs (vrai vrm-badge.js + vrm-ui.js).
//  On juge : le panneau s'ouvre en grand, les annonces du compte de l'onglet (statuts), celles lues sans compte
//  DITES, les ventes, ce que le site ne permet pas dit UNE fois (favoris, automatisations), « Choisir une action »
//  sans geste qu'il n'a pas (pas de « Republier » ni d'« Offre aux favoris »), Notifications filtrées sur ce site.
//  ---------------------------------------------------------------------------------------------------------------
//  (l'en-tête d'origine suit)
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
const SORTIE = process.env.BANC_CAPTURES ? path.join(process.env.BANC_CAPTURES, 'grand-panneau-sites') : path.join(__dirname, 'captures', 'grand-panneau-sites');

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


const SITES = {
  leboncoin: { url: 'https://www.leboncoin.fr/mes-annonces', etat: { ok: true, plateforme: 'leboncoin', capte: true, version: '5.409.0', code: '5.409.0', vrm: { ok: true, connecte: true, email: 'sophie@exemple.fr' }, site: { id: 'lbc-account:moi', nom: 'Sophie' }, lbc: { compte: { ok: true, texte: 'Sophie' }, annonces: { ok: true, texte: '2 annonces' }, ventes: { ok: true, texte: '1 vente' } }, flux: { okAt: T0 - 3 * MIN }, liens: [], capteCoupe: false },
    listes: { ok: true, plateforme: 'leboncoin', compte: { id: 'moi', nom: 'Sophie' }, annonces: { lu: T0 - H, aConfirmer: false, total: 2, liste: [], toutes: [{ id: 'a1', titre: 'Paire A', prix: 80, statut: 'en_vente', url: 'https://www.leboncoin.fr/ad/a1', photos: [], photo: '' }, { id: 'a2', titre: 'Paire B', prix: 60, statut: 'masque', url: 'https://www.leboncoin.fr/ad/a2', photos: [], photo: '' }], nTous: 2, statuts: { en_vente: 1, brouillon: 0, masque: 1, reserve: 0, vendu: 0, a_confirmer: 0 }, sansCompte: 124 }, ventes: { lu: null, total: 1, liste: [{ tx: 'T1', titre: 'Paire A', prix: 80, date: T0 - H, etat: 'a_expedier', vendue: true, num: '' }] }, messages: null, automatisations: null, notifications: { vu: T0 - 2 * H, liste: [{ p: 'leboncoin', c: 'moi', s: 'ventes', id: 'T1', t: T0 - H }] }, autres: null } },
  vestiaire: { url: 'https://www.vestiairecollective.com/', etat: { ok: true, plateforme: 'vestiaire', capte: true, version: '5.409.0', code: '5.409.0', vrm: { ok: true, connecte: true, email: 'sophie@exemple.fr' }, site: { id: '42', nom: 'Sophie VC' }, vcCapte: { ventes: { n: 1, at: T0 - H } }, flux: { okAt: T0 - 3 * MIN }, liens: [], capteCoupe: false },
    listes: { ok: true, plateforme: 'vestiaire', compte: { id: '42', nom: 'Sophie VC' }, annonces: { lu: T0 - H, aConfirmer: false, total: 1, liste: [], toutes: [{ id: 'p1', titre: 'Sac', prix: 300, statut: 'en_vente', favoris: 7, photos: [], photo: '' }], nTous: 1, statuts: { en_vente: 1, brouillon: 0, masque: 0, reserve: 0, vendu: 0, a_confirmer: 0 }, sansCompte: 0 }, ventes: { lu: null, total: 1, liste: [{ tx: 'p9', titre: 'Sac vendu', prix: 250, date: T0 - H, etat: 'a_expedier', vendue: true, num: '', bordereau: true, transporteur: 'Chronopost' }] }, messages: null, automatisations: null, notifications: { vu: T0 - 2 * H, liste: [] }, autres: null } },
};
async function ouvrirSite(nav, site, { scheme, largeur, hauteur, mobile }) {
  const S = SITES[site];
  const ctx = await nav.newContext(Object.assign({ colorScheme: scheme, viewport: { width: largeur, height: hauteur } }, mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}));
  const pg = await ctx.newPage();
  const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 200)));
  await pg.route('**/*', (r) => (/logo-vrm-96\.png/.test(r.request().url()) ? r.fulfill({ status: 200, contentType: 'image/png', body: LOGO }) : r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;font-family:sans-serif"><main style="padding:20px;height:2000px">Le site</main></body></html>' })));
  await pg.goto(S.url);
  await pg.evaluate(({ e, js, ui, L }) => {
    window.__envoyes = [];
    const copie = (x) => JSON.parse(JSON.stringify(x));
    const orig = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (o) { return orig.call(this, Object.assign({}, o, { mode: 'open' })); };
    window.chrome = { runtime: { id: 'ext', getURL: (p) => location.origin + '/' + p, getManifest: () => ({ version: e.version }), lastError: null,
      sendMessage: (msg, cb) => { window.__envoyes.push(copie(msg)); let rep = { ok: true }; if (msg.action === 'etat') rep = copie(e); else if (msg.action === 'carteListes') rep = copie(L); else if (msg.action === 'capteLot') rep = { ok: true, lot: null }; setTimeout(() => cb && cb(rep), 0); } },
      storage: { local: { get: (k, cb) => { if (cb) setTimeout(() => cb({}), 0); return Promise.resolve({}); }, set: (o, cb) => { if (cb) setTimeout(cb, 0); return Promise.resolve(); } }, onChanged: { addListener() {} } } };
    if (ui) { const u = document.createElement('script'); u.textContent = ui; document.documentElement.appendChild(u); }
    const s = document.createElement('script'); s.textContent = js; document.documentElement.appendChild(s);
  }, { e: S.etat, js: BADGE, ui: UI, L: S.listes });
  await pg.waitForTimeout(250);
  return { ctx, pg, erreurs };
}
const lireS = (pg) => pg.evaluate(() => {
  const r = document.getElementById('vrm-badge').shadowRoot, q = (s) => r.querySelector(s);
  const carte = q('.carte'), b = carte ? carte.getBoundingClientRect() : null;
  return { grand: !!(carte && carte.hasAttribute('data-grand')), on: !!(carte && carte.classList.contains('on')), w: b ? Math.round(b.width) : 0,
    onglets: Array.from(r.querySelectorAll('[data-onglet-b]')).map((x) => x.getAttribute('data-onglet-b')),
    lignes: r.querySelectorAll('.table5 [data-annonce]').length, sansCompte: q('[data-sans-compte]') ? q('[data-sans-compte]').getAttribute('data-sans-compte') : null,
    options: q('[data-ann-action]') ? Array.from(q('[data-ann-action]').options).map((o) => o.value).filter(Boolean) : [],
    ventes: Array.from(r.querySelectorAll('[data-vente]')).map((x) => x.getAttribute('data-vente') + ':' + x.getAttribute('data-vente-etat')),
    favSite: q('[data-favoris-site]') ? q('[data-favoris-site]').innerText : '', autoSite: q('[data-auto-site]') ? q('[data-auto-site]').innerText : '',
    notifs: r.querySelectorAll('[data-notif]').length, transporteur: q('[data-fait="transporteur"] b') ? q('[data-fait="transporteur"] b').innerText : '',
    debord: document.documentElement.scrollWidth > window.innerWidth };
});

(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  fs.mkdirSync(SORTIE, { recursive: true });
  try {
    for (const site of ['leboncoin', 'vestiaire']) for (const [largeur, hauteur, mobile] of [[1512, 900, false], [390, 844, true]]) for (const scheme of ['light', 'dark']) {
      const T = `${site} ${largeur} ${scheme}`; console.log('\n' + T);
      await essaie(T, async () => {
        const t = await ouvrirSite(nav, site, { scheme, largeur, hauteur, mobile });
        await montrer(t.pg, mobile);
        await clic(t.pg, '[data-onglet-b="annonces"]');
        let a = await lireS(t.pg);
        await t.pg.screenshot({ path: path.join(SORTIE, `${site}-annonces-${largeur}-${scheme}.png`) });
        dit(a.on && a.grand && (mobile ? a.w >= largeur - 1 : a.w >= largeur * 0.7) && !a.debord, `${T} : le grand panneau s’ouvre aussi ici`, JSON.stringify(a));
        dit(a.onglets.join(',') === 'messages,annonces,favoris,ventes,notifications,automatisations,parametres', `${T} : les mêmes onglets`, a.onglets.join(','));
        dit(a.lignes === (site === 'leboncoin' ? 1 : 1) && JSON.stringify(a.options) === JSON.stringify(['baisser', 'ouvrir']), `${T} : annonces « En vente » du compte de l’onglet ; « Choisir une action » sans Republier ni Offre aux favoris`, JSON.stringify(a));
        if (site === 'leboncoin') dit(a.sansCompte === '124', `${T} : les 124 annonces lues sans compte sont DITES, jamais montrées`, a.sansCompte);
        await clic(t.pg, '[data-onglet-b="ventes"]');
        await clic(t.pg, '[data-fiche-b]');
        a = await lireS(t.pg);
        await t.pg.screenshot({ path: path.join(SORTIE, `${site}-ventes-${largeur}-${scheme}.png`) });
        dit(a.ventes.length === 1 && /a_expedier/.test(a.ventes[0]) && (site === 'vestiaire' ? a.transporteur === 'Chronopost' : true), `${T} : ventes du compte (à expédier${site === 'vestiaire' ? ', transporteur lu' : ''})`, JSON.stringify(a));
        await clic(t.pg, '[data-onglet-b="favoris"]');
        a = await lireS(t.pg);
        dit(a.favSite.length > 20, `${T} : Favoris : ce que le site ne permet pas, dit une fois`, a.favSite);
        await clic(t.pg, '[data-onglet-b="automatisations"]');
        a = await lireS(t.pg);
        await t.pg.screenshot({ path: path.join(SORTIE, `${site}-automatisations-${largeur}-${scheme}.png`) });
        dit(a.autoSite.length > 20, `${T} : Automatisations : ce qui existe et ce qui arrive pour ce site, dit`, a.autoSite);
        await clic(t.pg, '[data-onglet-b="notifications"]');
        a = await lireS(t.pg);
        dit(a.notifs === (site === 'leboncoin' ? 1 : 0), `${T} : Notifications de ce site`, a.notifs);
        dit(t.erreurs.length === 0, `${T} : aucune erreur de page`, JSON.stringify(t.erreurs));
        await t.ctx.close();
      });
    }
  } finally { await nav.close(); }
  console.log(ko ? `\n❌ grand-panneau-sites : ${ko} rouge(s) sur ${ok + ko}` : `\n✅ grand-panneau-sites : ${ok} contrôles`);
  process.exit(ko ? 1 : 0);
})();
