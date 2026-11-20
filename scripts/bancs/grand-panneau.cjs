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
VEN[0].transporteur = 'Chronopost'; VEN[0].transporteurCle = 'chronopost'; VEN[2].transporteur = 'Mondial Relay'; VEN[2].transporteurCle = 'mondialrelay';
VEN.forEach((x, i) => { x.statutVinted = ['Envoie le colis avant le 23 nov.', 'Bordereau en préparation', 'Colis en route vers l’acheteur', 'Commande finalisée', 'Commande annulée'][i]; });
MSG.forEach((x, i) => { if (i % 2 === 0) x.avatar = img('p' + i); });
const CADENCE = { favorisHeure: 15, actionsHeure: 50, parJour: null, pauseMin: 40, pauseMax: 90, poses: [] };
const AUTO = { cadence: CADENCE, offres: { actif: true, minis: 12, refus: true }, favoris: { regle: true, versions: 3, rythme: 'normal', textes: ['Bonjour {pseudo}, une offre rien que pour toi.', 'Salut {pseudo} ! Je te fais un prix.', 'Hello {pseudo}, elle t’attend.'], auto: { actif: false, attenteMin: 10, attenteMax: 60, parJour: 30, parHeure: 12, heureDebut: 9, heureFin: 21 } }, paliers: { actif: true, paliers: [50, 80, 100], remiseMax: null, messages: 2 }, baisse: { actif: false, pct: 5, jours: 14 } };
const NOTIFS = { vu: T0 - 3 * H, liste: [{ p: 'vinted', c: '111', s: 'ventes', id: '91000000000', t: T0 - H }, { p: 'vinted', c: '111', s: 'codes', id: '91000000002:AB12', t: T0 - 2 * H }, { p: 'vinted', c: '111', s: 'messages', id: '60000@x', t: T0 - 5 * H }, { p: 'vinted', c: '111', s: 'refus', id: 'pause@1', q: 'pause', t: T0 - 2 * J }] };
const OFFRES = [{ conv: '60000', prix: 48, tx: '91000000009', oid: '777', item: '7001', titre: 'Adidas Samba OG noires 40', pseudo: 'acheteuse_0' }];
const LISTES = { ok: true, plateforme: 'vinted', compte: { id: '111', nom: 'shop_sophie' }, offres: OFFRES,
  annonces: { lu: T0 - 20 * MIN, aConfirmer: false, total: ANN.length, liste: ANN, toutes: TOUTES, nTous: TOUTES.length, statuts: { en_vente: 5, brouillon: 2, masque: 1, reserve: 1, vendu: 1, a_confirmer: 0 } }, automatisations: AUTO, notifications: NOTIFS, ventes: { lu: T0 - 10 * MIN, total: VEN.length, liste: VEN }, messages: { lu: T0 - 5 * MIN, liste: MSG }, autres: null };
const ETAT = { ok: true, plateforme: 'vinted', capte: true, version: '5.410.0', code: '5.410.0', vrm: { ok: true, connecte: true, email: 'sophie@exemple.fr', cloisonne: true },
  site: { id: '111', nom: 'shop_sophie', choix: 'oui', jauge: { h: 12, maxH: 50, j: 40, maxJ: 200, complet: true }, favoris: { apercu: { at: T0 - MIN, etat: 'pret', total: 8 }, file: null } },
  secu: { niveau: 'ok', texte: 'Tout va bien sur ce compte' }, toutArrete: false,
  flux: { okAt: T0 - 3 * MIN }, liens: [{ cle: 'messages', libelle: 'Messages', url: 'https://www.vinted.fr/inbox' }], capteCoupe: false };
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8sPfefwAHiQM0TP3mWgAAAABJRU5ErkJggg==', 'base64');

async function ouvrir(nav, { scheme = 'light', largeur = 1512, hauteur = 900, mobile = false, orion = false, L = LISTES, url = 'https://www.vinted.fr/catalog' } = {}) {
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
  await pg.goto(url);
  await pg.evaluate(({ e, js, ui, ap, L }) => {
    window.__envoyes = []; window.__ouverts = []; const ouvrirVrai = window.open; window.open = (u) => { window.__ouverts.push(String(u)); return null; };
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
          else if (msg.action === 'reglagesFavoris') rep = { ok: true };
          else if (msg.action === 'prixCarte') rep = msg.confirme === true ? { ok: true, ranges: msg.items.map((x) => x.id), refus: [] } : { ok: false };
          else if (msg.action === 'atelierVerifier') { const okR = !!(msg.reponses && msg.reponses['7001']); const paires = Object.fromEntries((msg.tous || msg.ids).map((id) => [id, id === '7001' && !okR ? { id, etat: 'a-corriger', corrections: [], manque: ['la taille'], question: { champ: 'size_id', nom: 'la taille', options: [['206', '42'], ['207', '43']] } } : { id, etat: id === '7007' ? 'corrige' : 'ok', corrections: id === '7007' ? [{ champ: 'size_id', nom: 'Taille', raison: 'même libellé dans la grille du jour' }] : [], manque: [] }]));
            const aC = Object.values(paires).filter((x) => x.etat === 'a-corriger').length; rep = { ok: true, paires, resume: { total: msg.tous.length, verifiees: msg.tous.length, ok: 1, corrige: 1, aCorriger: aC, absente: 0, pasVerifie: 0 }, lancer: aC ? { ok: false, raison: 'a-corriger', n: aC } : { ok: true } }; }
          else if (msg.action === 'atelierLancer') rep = msg.confirme === true ? { ok: true } : { ok: false };
          else if (msg.action === 'offreCarte') rep = msg.quoi === 'accept' && msg.avisVu !== true ? { ok: false, code: 'avis', avis: 'VRM n’a pas pu vérifier tes autres sites : vérifie qu’elle n’y est pas vendue.' } : { ok: true };
          else if (msg.action === 'publierCarte') rep = !msg.reponses ? { ok: false, code: 'questions', questions: [{ champ: 'categorie', choix: ['Baskets', 'Bottes'], saisie: '' }] } : msg.verifVu !== true ? { accepte: false, code: 'verification', problemes: [{ code: 'photos', texte: '1 photo seulement' }] } : { accepte: true };
          else if (msg.action === 'favorisAuto') rep = msg.actif && msg.confirme !== true ? { ok: false, code: 'confirmation' } : { ok: true, actif: msg.actif };
          else if (msg.action === 'reglageAuto') rep = msg.cle === 'vinted_cadence' && msg.valeur.actionsHeure > 50 && msg.confirme !== true ? { ok: false, code: 'confirmation' } : { ok: true, relu: true };
          else if (msg.action === 'masquerCarte') rep = msg.confirme === true ? { ok: true, faits: (msg.ids || []).map((id) => ({ id, ok: true, relu: true })) } : { ok: false };
          setTimeout(() => cb && cb(rep), 0);
        } },
      storage: { local: { get: (k, cb) => { if (cb) setTimeout(() => cb({}), 0); return Promise.resolve({}); }, set: (o, cb) => { (window.__ranges = window.__ranges || []).push(copie(o)); if (cb) setTimeout(cb, 0); return Promise.resolve(); } }, onChanged: { addListener() {} } },
    };
    if (ui) { const u = document.createElement('script'); u.textContent = ui; document.documentElement.appendChild(u); }
    const s = document.createElement('script'); s.textContent = js; document.documentElement.appendChild(s);
  }, { e: ETAT, js: BADGE, ui: UI, ap: APERCU, L });
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
    onglets: Array.from(r.querySelectorAll('.side6 [data-onglet-b]')).filter(vis).map((b) => b.getAttribute('data-onglet-b')),
    vx: q('[data-vx]') ? { page: q('[data-vx]').getAttribute('data-page'), reduit: q('[data-vx]').hasAttribute('data-reduit'), side: rect(q('.side6')), titre: q('[data-vx-titre]') ? q('[data-vx-titre]').innerText : '', compte: q('[data-vx-compte]') ? q('[data-vx-compte]').innerText : '', maj: q('[data-vx-maj]') ? q('[data-vx-maj]').innerText : '', courant: (q('.side6 [aria-current="page"]') || { getAttribute: () => null }).getAttribute('data-onglet-b'), navW: q('.side6 .nav6') ? Math.round(q('.side6 .nav6').getBoundingClientRect().width) : 0 } : null,
    accueil: q('[data-accueil-page]') ? { tuiles: Array.from(r.querySelectorAll('[data-accueil]')).map((x) => x.getAttribute('data-accueil') + ':' + x.querySelector('b').innerText.replace(/\s/g, '')), capte: Array.from(r.querySelectorAll('[data-accueil-capte]')).map((x) => x.getAttribute('data-accueil-capte')), jauge: !!q('[data-accueil-jauge]') } : null,
    statutsMenu: Array.from(r.querySelectorAll('[data-ann-statut]')).map((c) => c.getAttribute('data-ann-statut') + ':' + c.closest('label').querySelector('b').textContent + (c.checked ? '' : '-')),
    nArticles: q('[data-ann-n]') ? Number(q('[data-ann-n]').getAttribute('data-ann-n')) : null,
    entetes: Array.from(r.querySelectorAll('.table6 .th6r .th6')).filter(vis).map((b) => b.textContent.replace(/[▲▼↑↓↕]/g, '').trim()),
    tri: q('.table6') ? q('.table6').getAttribute('data-tri') : null,
    ordreAnn: Array.from(r.querySelectorAll('.table6 [data-annonce]')).map((x) => x.getAttribute('data-annonce')),
    etiquettes: Array.from(r.querySelectorAll('.table6 .et6')).map((x) => x.getAttribute('data-statut') + ':' + (x.getAttribute('data-ton') || '')),
    ventesT: Array.from(r.querySelectorAll('.table6 [data-vente]')).map((x) => x.getAttribute('data-vente-etat')),
    logos: r.querySelectorAll('.table6 .vu-transp').length, sousTitres: Array.from(r.querySelectorAll('.table6 .st6')).map((x) => x.innerText).filter(Boolean).length,
    avatars: r.querySelectorAll('img.av6').length, initiales: r.querySelectorAll('span.av6').length, vignettesMsg: r.querySelectorAll('.vig6').length,
    autoListe: Array.from(r.querySelectorAll('[data-auto-choix]')).map((x) => x.getAttribute('data-auto-choix') + ':' + x.querySelector('[data-etat]').getAttribute('data-etat') + (x.getAttribute('aria-selected') === 'true' ? '*' : '')),
    autoSections: Array.from(r.querySelectorAll('.au6-d .sec6 h3')).filter(vis).map((x) => x.textContent.trim()), autoMessages: Array.from(r.querySelectorAll('[data-rf-texte]')).filter((t) => t.value).length, autoDemarrer: !!q('[data-auto-guide]'), apercu: q('[data-paliers-apercu]') ? q('[data-paliers-apercu]').getAttribute('data-paliers-apercu') : null,
    lienPanneau: document.getElementById('vrm-badge').getAttribute('data-lien-panneau'), adresse: location.href,
    couleursVives: (() => { const out = []; for (const el of r.querySelectorAll('.vx6 *')) { if (!vis(el)) continue; const cs = getComputedStyle(el); for (const v of [cs.color, cs.backgroundColor]) { const m = /rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?/.exec(v); if (!m || (m[4] !== undefined && Number(m[4]) < 0.2)) continue; const [R, G, B] = [+m[1], +m[2], +m[3]]; if ((R > 180 && G < 90 && B < 90) || (G > 160 && R < 90 && B < 110) || (R > 120 && B > 160 && G < 90)) out.push(el.className + ':' + v); } } return out.slice(0, 5); })(),
    msgs: r.querySelectorAll('[data-conv]').length, volet: q('[data-volet-conv]') ? q('[data-volet-conv]').getAttribute('data-volet-conv') : null,
    convOuverte: Array.from(r.querySelectorAll('[data-conv-ouverte]')).filter(vis).map((x) => x.getAttribute('data-conv-ouverte')),
    repondre: Array.from(r.querySelectorAll('[data-geste="repondre"]')).filter(vis).map((a) => a.href),
    fiche: q('[data-fiche]') ? { id: q('[data-fiche]').getAttribute('data-fiche'), faits: Object.fromEntries(Array.from(r.querySelectorAll('[data-fiche] [data-fait]')).map((f) => [f.getAttribute('data-fait'), f.querySelector('b').innerText.replace(/\s/g, ' ')])), photos: r.querySelectorAll('[data-fiche] .ph5 img').length, desc: !!q('[data-fiche] [data-desc]') } : null,
    etape: q('[data-fav-etape]') ? q('[data-fav-etape]').getAttribute('data-fav-etape') : null, guide: q('[data-fav-guide]') ? q('[data-fav-guide]').innerText : '',
    rythme: q('[data-fav-rythme]') ? q('[data-fav-rythme]').getAttribute('data-fav-rythme') : null,
    secu: /Sécurité du compte/.test(texte), toutArreter: !!q('[data-tout-arreter]'),
    repOk: !!q('[data-rep-etat="ok"]'),
    confirmeM: q('[data-ann-confirme]') ? q('[data-ann-confirme]').getAttribute('data-ann-confirme') : null, resultatM: q('[data-ann-resultat]') ? q('[data-ann-resultat]').getAttribute('data-ann-resultat') : null,
    chips: Array.from(r.querySelectorAll('[data-ann-statut]')).map((b) => b.getAttribute('data-ann-statut') + ':' + (b.innerText.split('·')[1] || '').trim()),
    annVue: q('[data-vue]') ? q('[data-vue]').getAttribute('data-vue') : null,
    lignesAnn: r.querySelectorAll('.table6 [data-annonce]').length, cartesGrille: r.querySelectorAll('.grille5 [data-annonce]').length,
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

const LISTES_VIDE = { ok: true, plateforme: 'vinted', compte: { id: '111', nom: 'shop_sophie' },
  annonces: { lu: T0 - 20 * MIN, aConfirmer: false, total: 0, liste: [], toutes: [], nTous: 0, statuts: { en_vente: 0, brouillon: 0, masque: 0, reserve: 0, vendu: 0, a_confirmer: 0 } },
  automatisations: { offres: { actif: false, minis: 0, refus: false }, favoris: { regle: false, versions: 0, rythme: 'normal', textes: [], auto: { actif: false } }, paliers: { actif: false, paliers: [], remiseMax: null, messages: 0 }, baisse: { actif: false, pct: null, jours: null } },
  notifications: { vu: T0 - H, liste: [] }, ventes: { lu: T0 - 10 * MIN, total: 0, liste: [] }, messages: { lu: T0 - 5 * MIN, liste: [] }, autres: null };

(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  fs.mkdirSync(SORTIE, { recursive: true });
  const cap = async (pg, nom) => { try { await pg.screenshot({ path: path.join(SORTIE, nom + '.png') }); } catch (_) {} };
  const NAV_ATTENDU = ['accueil', 'annonces', 'ventes', 'messages', 'favoris', 'notifications', 'automatisations', 'parametres'];
  try {
    for (const [largeur, hauteur, mobile, orion] of [[1512, 900, false, false], [1280, 800, false, false], [390, 844, true, false], [390, 844, true, true]]) for (const scheme of (orion || largeur === 1280 ? ['light'] : ['light', 'dark'])) {
      const T = `${largeur}${orion ? ' Orion' : ''} ${scheme}`;
      const N = (k) => `${orion ? 'orion-' : ''}${k}-${largeur}-${scheme}`;
      console.log(`\n${T}`);
      await essaie(T, async () => {
        const t = await ouvrir(nav, { scheme, largeur, hauteur, mobile, orion });
        await montrer(t.pg, mobile);
        let a = await lire(t.pg);
        await cap(t.pg, N('accueil'));
        dit(a.on && a.grand && a.vx, `${T} : la carte s’ouvre en GRAND panneau « comme Vintex »`, JSON.stringify({ on: a.on, g: a.grand, vx: !!a.vx }));
        const large = mobile ? a.carte && a.carte.w >= largeur - 1 && a.carte.h >= hauteur - 1 : a.carte && a.carte.w >= largeur * 0.9;
        dit(large && a.carte.x >= 0 && a.carte.r <= largeur && !a.debord, `${T} : ${mobile ? 'plein écran' : '≥ 90 % de la largeur'}, dans l’écran, rien ne déborde`, JSON.stringify(a.carte));
        dit(JSON.stringify(a.onglets) === JSON.stringify(NAV_ATTENDU), `${T} : barre latérale Accueil · Articles · Commandes · Messagerie · Favoris · Notifications · Automatisations · Paramètres`, JSON.stringify(a.onglets));
        if (!mobile) dit(a.vx.side && a.vx.side.x === a.carte.x && a.vx.side.w >= 220 && a.vx.side.w <= 240 && a.vx.side.h >= a.carte.h - 2, `${T} : barre latérale fixe à gauche (232 px, toute la hauteur)`, JSON.stringify(a.vx.side));
        else dit(a.vx.side && a.vx.side.b >= hauteur - 2 && a.vx.side.w >= largeur - 1, `${T} : au téléphone, la barre devient une rangée en bas, pleine largeur`, JSON.stringify(a.vx.side));
        dit(a.vx.page === 'accueil' && a.vx.courant === 'accueil' && a.vx.titre === 'Accueil' && a.vx.compte.includes('shop_sophie') && /Mis à jour/.test(a.vx.maj || 'Mis à jour'), `${T} : en-tête « Accueil · shop_sophie » + « Mis à jour … ⟳ »`, JSON.stringify(a.vx));
        dit(a.accueil && a.accueil.tuiles.join('|') === 'v6_ventes_jour:1|v6_a_expedier:2|v6_non_lus:2|v6_en_vente:5' && a.accueil.jauge, `${T} : Accueil : ventes du jour 1, à expédier 2, non lus 2, en vente 5, jauge — lus, jamais inventés`, JSON.stringify(a.accueil));
        dit(a.accueil && a.accueil.capte.join(',') === 'ventes,codes', `${T} : Accueil : seulement ce qui a été capté depuis la dernière visite`, JSON.stringify(a.accueil && a.accueil.capte));
        dit(!a.secu && !a.toutArreter, `${T} : plus de « Sécurité du compte » ni de « Tout arrêter »`);
        if (mobile) {
          const rond = await t.pg.evaluate(() => { const r = document.getElementById('vrm-badge').shadowRoot; const b = r.querySelector('.btn'); const f = r.querySelector('.side6 [data-onglet-b="favoris"]'); const fr = f.getBoundingClientRect(); const el = r.elementFromPoint(fr.left + fr.width / 2, fr.top + fr.height / 2); return { rondVisible: !!(b && b.getClientRects().length && getComputedStyle(b).display !== 'none'), favorisLibre: !!(el && (el === f || f.contains(el))), dansEcran: fr.right <= innerWidth + 1 }; });
          dit(!rond.rondVisible && rond.favorisLibre, `${T} : panneau ouvert au téléphone : le rond VRM s'écarte, rien ne couvre l'onglet « Favoris » de la barre du bas`, JSON.stringify(rond));
        }
        dit(a.couleursVives.length === 0, `${T} : ni rouge vif, ni vert vif, ni violet`, JSON.stringify(a.couleursVives));
        // Articles : le tableau.
        await clic(t.pg, '[data-onglet-b="annonces"]');
        a = await lire(t.pg);
        await cap(t.pg, N('articles'));
        dit(a.vx.titre === 'Articles' && a.vx.courant === 'annonces', `${T} : « Articles » dans l’en-tête et la barre`, JSON.stringify(a.vx));
        dit(a.statutsMenu.join('|') === 'en_vente:5|brouillon:2|masque:1|reserve:1|vendu:1' && a.lignesAnn === 10 && a.nArticles === 10, `${T} : « Statut ▾ » à compteurs (En vente 5 · Brouillon 2 · Masqué 1 · Réservé 1 · Vendu 1), « 10 article(s) »`, JSON.stringify({ m: a.statutsMenu, n: a.lignesAnn }));
        if (!mobile) dit(a.entetes.join('|') === 'Article|Prix|En ligne|Vues|Favoris|Statut', `${T} : colonnes Article · Prix · En ligne (date) · Vues · Favoris · Statut`, JSON.stringify(a.entetes));
        dit(a.etiquettes.filter((x) => /^brouillon:ambre$/.test(x)).length === 2 && a.etiquettes.filter((x) => /^en_vente:$/.test(x)).length === 5, `${T} : statut en étiquette douce (brouillon en ambre, le reste neutre)`, JSON.stringify(a.etiquettes));
        dit(a.action && a.action.off && !a.action.options.includes('supprimer'), `${T} : « Choisir une action ▾ » grisé sans sélection, aucune suppression en série`, JSON.stringify(a.action));
        await t.pg.evaluate(() => { const r = document.getElementById('vrm-badge').shadowRoot; const c = r.querySelector('[data-ann-statut="en_vente"]'); c.checked = false; c.dispatchEvent(new Event('change')); });
        await t.pg.waitForTimeout(200);
        a = await lire(t.pg);
        dit(a.lignesAnn === 5 && !a.ordreAnn.some((id) => ['7000', '7001', '7004', '7007', '7008'].includes(id)), `${T} : décocher « En vente » retire les 5 annonces en vente`, JSON.stringify({ n: a.lignesAnn, o: a.ordreAnn }));
        await t.pg.evaluate(() => { const r = document.getElementById('vrm-badge').shadowRoot; const c = r.querySelector('[data-ann-statut="en_vente"]'); c.checked = true; c.dispatchEvent(new Event('change')); });
        await t.pg.waitForTimeout(200);
        if (!mobile) {
          await clic(t.pg, '[data-ann-tri="prix"]');
          a = await lire(t.pg);
          const p1 = a.ordreAnn.map((id) => ANN.find((x) => x.id === id).prix);
          await clic(t.pg, '[data-ann-tri="prix"]');
          const b = await lire(t.pg);
          const p2 = b.ordreAnn.map((id) => ANN.find((x) => x.id === id).prix);
          const monte = (l) => l.every((v, i) => !i || l[i - 1] <= v), descend = (l) => l.every((v, i) => !i || l[i - 1] >= v);
          dit((monte(p1) && descend(p2)) || (descend(p1) && monte(p2)), `${T} : un clic sur « Prix » trie, un second inverse`, JSON.stringify({ p1, p2, t: [a.tri, b.tri] }));
        }
        await t.pg.evaluate(() => { const r = document.getElementById('vrm-badge').shadowRoot; const d = r.querySelector('[data-ann-cols]'); d.open = true; const c = r.querySelector('[data-ann-col="mini"]'); c.checked = true; c.dispatchEvent(new Event('change')); });
        await t.pg.waitForTimeout(200);
        a = await lire(t.pg);
        await cap(t.pg, N('colonnes'));
        dit(a.cols.includes('mini') && a.ranges.some((x) => x.vrmPanneauAnnonces && x.vrmPanneauAnnonces.cols.includes('mini')), `${T} : « Colonnes ▾ » : Prix mini ajoutée, le choix est gardé`, JSON.stringify({ c: a.cols }));
        await clic(t.pg, '[data-fiche-b="a:7001"]');
        a = await lire(t.pg);
        await cap(t.pg, N('fiche'));
        const f = a.fiche || { faits: {} };
        dit(f.id === 'a:7001' && f.photos === 3 && f.faits.num === '121' && /46/.test(f.faits.mini) && f.faits.achat === '—', `${T} : toucher un article déplie sa fiche ; acheté pas su ⇒ « — »`, JSON.stringify(f));
        await clic(t.pg, '[data-fiche-b="a:7001"]');
        // Masquer : choisi, confirmé, envoyé.
        await t.pg.evaluate(() => { const r = document.getElementById('vrm-badge').shadowRoot; const c = r.querySelector('[data-ann-sel="7001"]'); c.checked = true; c.dispatchEvent(new Event('change')); });
        await t.pg.waitForTimeout(150);
        await t.pg.evaluate(() => { const r = document.getElementById('vrm-badge').shadowRoot; const s2 = r.querySelector('[data-ann-action]'); s2.value = 'masquer'; s2.dispatchEvent(new Event('change')); });
        await t.pg.waitForTimeout(200);
        a = await lire(t.pg);
        await cap(t.pg, N('masquer'));
        dit(a.confirmeM === 'masquer' && !a.envoyes.some((m) => m.action === 'masquerCarte'), `${T} : « Masquer » demande confirmation, rien ne part avant`, JSON.stringify({ c: a.confirmeM }));
        await clic(t.pg, '[data-ann-confirme-ok]');
        await t.pg.waitForTimeout(200);
        a = await lire(t.pg);
        const mq = a.envoyes.find((m) => m.action === 'masquerCarte');
        dit(mq && mq.confirme === true && JSON.stringify(mq.ids) === '["7001"]' && a.resultatM === 'ok', `${T} : confirmé : SA sélection part, le résultat est dit`, JSON.stringify({ mq, r: a.resultatM }));
        // 5.410 — LES GESTES DANS LE PANNEAU (plus rien vers vrm.center).
        const coche = async (ids) => t.pg.evaluate((ids) => { const r = document.getElementById('vrm-badge').shadowRoot; for (const c of r.querySelectorAll('[data-ann-sel]')) { const v = ids.includes(c.getAttribute('data-ann-sel')); if (c.checked !== v) { c.checked = v; c.dispatchEvent(new Event('change')); } } }, ids);
        const action = async (k) => { await t.pg.evaluate((k) => { const s2 = document.getElementById('vrm-badge').shadowRoot.querySelector('[data-ann-action]'); s2.value = k; s2.dispatchEvent(new Event('change')); }, k); await t.pg.waitForTimeout(220); };
        const env = async (k) => (await t.pg.evaluate(() => window.__envoyes)).filter((m) => m.action === k);
        await coche(['7001', '7004']); await t.pg.waitForTimeout(150);
        await action('baisser');
        const lp = await t.pg.evaluate(() => Array.from(document.getElementById('vrm-badge').shadowRoot.querySelectorAll('[data-prix-ligne]')).map((x) => x.getAttribute('data-prix-ligne') + ':' + x.innerText.replace(/\s+/g, ' ')));
        await clic(t.pg, '[data-prix-pct="10"]');
        await cap(t.pg, N('geste-prix'));
        await clic(t.pg, '[data-prix-confirmer]');
        const pe = await env('prixCarte');
        dit(lp.length === 2 && /plancher : ton prix mini 46/.test(lp[0]) && /plancher pas su|achat/.test(lp[1]) && pe.length === 1 && pe[0].confirme === true && pe[0].items.map((x) => x.id + '=' + x.prix + '<' + x.prixVu).join(',') === '7001=54.00<60,7004=67.50<75',
          `${T} : « Changer le prix » : prix vu, plancher dit, −10 % pour toutes, confirmé ⇒ la commande gardée`, JSON.stringify({ lp, pe }));
        // Une HAUSSE : « Monter à X € ? » d'abord, puis seulement SON « Oui, monter ».
        await t.pg.evaluate(() => { const c = document.getElementById('vrm-badge').shadowRoot.querySelector('[data-prix-nouveau="7001"]'); c.value = '70'; c.dispatchEvent(new Event('input')); });
        await clic(t.pg, '[data-prix-confirmer]');
        const hc = await t.pg.evaluate(() => { const b = document.getElementById('vrm-badge').shadowRoot.querySelector('[data-prix-hausse]'); return b ? b.innerText : ''; });
        const n1 = (await env('prixCarte')).length;
        await cap(t.pg, N('geste-prix-hausse'));
        await clic(t.pg, '[data-prix-hausse-oui]');
        const ph = await env('prixCarte');
        dit(/Monter à 70,00 €/.test(hc) && n1 === 1 && ph.length === 2 && ph[1].hausseConfirmee === true && ph[1].items.some((x) => x.id === '7001' && x.prix === '70'), `${T} : une hausse demande « Monter à 70,00 € ? » puis part sur SON « Oui, monter »`, JSON.stringify({ hc, ph: ph[1] }));
        await clic(t.pg, '[data-geste-fermer]');
        await coche(['7001', '7004', '7007']); await t.pg.waitForTimeout(150);
        await action('republier');
        await t.pg.waitForTimeout(250);
        const av1 = await t.pg.evaluate(() => { const r = document.getElementById('vrm-badge').shadowRoot; const b = r.querySelector('[data-atelier-lancer]'); return { off: b && b.disabled, recap: (r.querySelector('[data-atelier-recap]') || {}).innerText || '', q: !!r.querySelector('[data-atelier-question="7001"]'), retirer: !!r.querySelector('[data-atelier-retirer="7001"]'), ferme: !!r.querySelector('[data-atelier-ferme]') }; });
        await cap(t.pg, N('geste-atelier-verif'));
        dit(av1.off && /1 à corriger/.test(av1.recap) && av1.q && av1.retirer && av1.ferme, `${T} : atelier : le contrôle avant de lancer (verifierRepub) — récapitulatif, « Choisir : la taille », « Retirer de la file », Lancer fermé`, JSON.stringify(av1));
        await t.pg.evaluate(() => { const c = document.getElementById('vrm-badge').shadowRoot.querySelector('[data-atelier-question="7001"]'); c.value = '206'; c.dispatchEvent(new Event('change')); });
        await t.pg.waitForTimeout(250);
        const vv = await env('atelierVerifier');
        const av2 = await t.pg.evaluate(() => { const b = document.getElementById('vrm-badge').shadowRoot.querySelector('[data-atelier-lancer]'); return b && b.disabled; });
        dit(vv.length === 2 && vv[1].ids.join(',') === '7001' && vv[1].reponses['7001'].size_id === '206' && av2 === false, `${T} : atelier : SA taille choisie revérifiée pour SA paire ⇒ « Lancer » s’ouvre`, JSON.stringify({ vv, av2 }));
        await clic(t.pg, '[data-atelier-bas="0"]');
        await clic(t.pg, '[data-atelier-mode="fixe"]');
        await t.pg.evaluate(() => { const c = document.getElementById('vrm-badge').shadowRoot.querySelector('[data-atelier-photo="bright"]'); c.value = '1.2'; c.dispatchEvent(new Event('input')); });
        await cap(t.pg, N('geste-atelier'));
        await clic(t.pg, '[data-atelier-lancer]');
        const ae = await env('atelierLancer');
        dit(ae.length === 1 && ae[0].ids.join(',') === '7004,7001,7007' && ae[0].espacement.mode === 'fixe' && ae[0].photo.bright === 1.2 && ae[0].confirme === true, `${T} : atelier Republier : SON ordre, SON espacement, SON réglage photo, « Lancer »`, JSON.stringify(ae));
        await coche(['7001']); await t.pg.waitForTimeout(150);
        await action('publier');
        await clic(t.pg, '[data-publier-envoyer]');
        await t.pg.evaluate(() => { const c = document.getElementById('vrm-badge').shadowRoot.querySelector('[data-publier-rep="categorie"]'); c.value = 'Baskets'; c.dispatchEvent(new Event('change')); });
        await clic(t.pg, '[data-publier-envoyer]');
        await cap(t.pg, N('geste-publier'));
        const pv = await t.pg.evaluate(() => !!document.getElementById('vrm-badge').shadowRoot.querySelector('[data-publier-probleme="photos"]'));
        await clic(t.pg, '[data-publier-envoyer]');
        const pu = await env('publierCarte');
        dit(pu.length === 3 && !pu[0].reponses && pu[1].reponses.categorie === 'Baskets' && !pu[1].verifVu && pv && pu[2].verifVu === true, `${T} : « Publier sur… » : la question posée ici, puis la vérification dite, « Publier quand même » ⇒ verifVu`, JSON.stringify(pu));
        await clic(t.pg, '[data-geste-fermer]');
        await coche([]);
        // Offres (Commandes) : accepter ⇒ confirmation ⇒ avis « pas su » ⇒ « J’ai vérifié, accepter ».
        await clic(t.pg, '[data-onglet-b="ventes"]');
        await clic(t.pg, '[data-offre-quoi="accept"]');
        await clic(t.pg, '[data-offre-oui]');
        await cap(t.pg, N('geste-offre'));
        const av = await t.pg.evaluate(() => { const b = document.getElementById('vrm-badge').shadowRoot.querySelector('[data-offre-confirme]'); return b ? b.innerText : ''; });
        await clic(t.pg, '[data-offre-oui]');
        const oe = await env('offreCarte');
        dit(/vérifie/.test(av) && oe.length === 2 && !oe[0].avisVu && oe[1].avisVu === true && oe[1].tx === '91000000009' && oe[1].oid === '777', `${T} : offre : « Accepter » ⇒ « pas su » dit ⇒ SON second toucher (avisVu)`, JSON.stringify({ av, oe }));
        const ouv = await t.pg.evaluate(() => window.__ouverts);
        dit(!ouv.some((u) => /vrm\.center/.test(u)), `${T} : aucun de ces gestes n’ouvre vrm.center`, JSON.stringify(ouv));
        await clic(t.pg, '[data-onglet-b="annonces"]');
        await clic(t.pg, '[data-ann-vue="grille"]');
        a = await lire(t.pg);
        await cap(t.pg, N('grille'));
        dit(a.annVue === 'grille' && a.cartesGrille === 10, `${T} : la vue grille montre les 10 articles`, JSON.stringify({ v: a.annVue, n: a.cartesGrille }));
        await clic(t.pg, '[data-ann-vue="liste"]');
        // Commandes.
        await clic(t.pg, '[data-onglet-b="ventes"]');
        a = await lire(t.pg);
        await cap(t.pg, N('commandes'));
        dit(a.vx.titre === 'Commandes' && a.ventesT.length === 5 && a.sousTitres === 5, `${T} : Commandes : 5 lignes, le statut Vinted sous chaque titre`, JSON.stringify({ t: a.vx.titre, v: a.ventesT, s: a.sousTitres }));
        dit(a.logos === 2, `${T} : transporteur avec SON logo (Chronopost, Mondial Relay) ; inconnu ⇒ rien`, a.logos);
        // 5.410.2 : le bordereau de chaque vente (prêt ⇒ « Imprimer le bordereau » ; pas fourni ⇒ « Pas encore de bordereau »).
        { const imp = await t.pg.evaluate(() => { const r = document.getElementById('vrm-badge').shadowRoot; return { imp: Array.from(r.querySelectorAll('.table6 [data-imprimer]')).map((b) => b.getAttribute('data-imprimer')), manque: Array.from(r.querySelectorAll('.table6 [data-bordereau-manque]')).map((b) => b.getAttribute('data-bordereau-manque')), n: !!r.querySelector('[data-imprimer-n]'), texte: r.querySelector('.carte').innerText }; });
          dit(JSON.stringify(imp.imp) === '["91000000000"]' && JSON.stringify(imp.manque) === '["91000000001"]' && imp.n && /Pas encore de bordereau/.test(imp.texte), `${T} : « Imprimer le bordereau » sur la vente prête, « Pas encore de bordereau » sur l'autre, « Imprimer » en haut`, JSON.stringify({ i: imp.imp, m: imp.manque, n: imp.n }));
          dit(!/à confirmer/i.test(imp.texte), `${T} : jamais « à confirmer » à l'écran`); }
        dit(a.etiquettes.filter((x) => /:ambre$/.test(x)).length === 2 && a.etiquettes.filter((x) => /:ambre$/.test(x)).every((x) => /^a_expedier/.test(x)), `${T} : « À expédier » en ambre, le reste neutre`, JSON.stringify(a.etiquettes));
        await clic(t.pg, '[data-fiche-b="v:91000000000"]');
        a = await lire(t.pg);
        dit(a.fiche && a.fiche.id === 'v:91000000000' && a.fiche.faits.bordereau === 'prêt', `${T} : une commande déplie sa fiche (bordereau prêt)`, JSON.stringify(a.fiche));
        // Messagerie.
        await clic(t.pg, '[data-onglet-b="messages"]');
        a = await lire(t.pg);
        await cap(t.pg, N('messagerie'));
        dit(a.vx.titre === 'Messagerie' && a.msgs === 7 && a.avatars === 4 && a.initiales === 3 && a.vignettesMsg === 7, `${T} : Messagerie : 7 conversations, avatar (ou initiale), vignette de l’article`, JSON.stringify({ m: a.msgs, av: a.avatars, i: a.initiales, v: a.vignettesMsg }));
        await clic(t.pg, '[data-conv-b="60001"]');
        await t.pg.evaluate(() => { const ta = document.getElementById('vrm-badge').shadowRoot.querySelector('[data-rep-texte="60001"]'); ta.value = 'Oui, toujours disponible'; ta.dispatchEvent(new Event('input')); });
        await clic(t.pg, '[data-rep-envoyer="60001"]');
        await t.pg.waitForTimeout(200);
        a = await lire(t.pg);
        await cap(t.pg, N('conversation'));
        const rp = a.envoyes.find((m) => m.action === 'repondreCarte');
        dit(rp && rp.conv === '60001' && rp.confirme === true && a.repOk, `${T} : répondre depuis le volet : SA conversation, son toucher`, JSON.stringify({ rp }));
        // Automatisations : deux volets.
        await clic(t.pg, '[data-onglet-b="automatisations"]');
        a = await lire(t.pg);
        await cap(t.pg, N('automatisations'));
        dit(a.autoListe.join('|') === 'favoris:off*|offres:on|paliers:on|baisse:off', `${T} : Automatisations : la liste avec Activé / Désactivé, favoris choisi`, JSON.stringify(a.autoListe));
        if (mobile) {
          // 5.410.1 : au téléphone, la LISTE seule (aucun titre en double), puis le détail en page poussée avec « ‹ Retour ».
          const lv = await t.pg.evaluate(() => { const r = document.getElementById('vrm-badge').shadowRoot; const vis = (el) => !!(el && el.getClientRects().length && getComputedStyle(el).display !== 'none'); const txt = r.querySelector('.carte').innerText; return { vue: r.querySelector('[data-auto-vue]').getAttribute('data-auto-vue'), detail: vis(r.querySelector('.au6-d')), fois: (txt.match(/Messages aux favoris/g) || []).length }; });
          dit(lv.vue === 'liste' && !lv.detail && lv.fois === 1, `${T} : au téléphone, Automatisations montre la liste seule (« Messages aux favoris » une fois)`, JSON.stringify(lv));
          await clic(t.pg, '[data-auto-choix="favoris"]');
          const dv = await t.pg.evaluate(() => { const r = document.getElementById('vrm-badge').shadowRoot; const vis = (el) => !!(el && el.getClientRects().length && getComputedStyle(el).display !== 'none'); return { vue: r.querySelector('[data-auto-vue]').getAttribute('data-auto-vue'), liste: vis(r.querySelector('.au6 .gauche5')), retour: vis(r.querySelector('[data-auto-retour]')) }; });
          await cap(t.pg, N('automatisations-detail'));
          await clic(t.pg, '[data-auto-retour]');
          const rv = await t.pg.evaluate(() => document.getElementById('vrm-badge').shadowRoot.querySelector('[data-auto-vue]').getAttribute('data-auto-vue'));
          dit(dv.vue === 'detail' && !dv.liste && dv.retour && rv === 'liste', `${T} : toucher une automatisation pousse son détail ; « ‹ Retour » revient à la liste`, JSON.stringify({ dv, rv }));
          await clic(t.pg, '[data-auto-choix="favoris"]');
          a = await lire(t.pg);
        }
        dit(a.autoSections.join('|') === 'Messages|Ciblage|Délais' && a.autoMessages === 3 && a.autoDemarrer, `${T} : détail MESSAGES · CIBLAGE · DÉLAIS, ses 3 textes modifiables, « Démarrer »`, JSON.stringify({ s: a.autoSections, m: a.autoMessages }));
        // 5.410 : les messages aux favoris se règlent ici : un texte changé, le rythme, « Enregistrer » ; le mode auto ⇒ « Oui, allumer ».
        await t.pg.evaluate(() => { const ta = document.getElementById('vrm-badge').shadowRoot.querySelector('[data-rf-texte="1"]'); ta.value = 'Coucou {pseudo}, prix doux !'; ta.dispatchEvent(new Event('input')); ta.dispatchEvent(new Event('change')); });
        await t.pg.waitForTimeout(150);
        await clic(t.pg, '[data-rf-rythme="prudent"]');
        await clic(t.pg, '[data-rf-enregistrer]');
        a = await lire(t.pg);
        const rf = a.envoyes.filter((m) => m.action === 'reglagesFavoris');
        dit(rf.length === 1 && rf[0].message === 'Bonjour {pseudo}, une offre rien que pour toi.' && rf[0].variantes[0] === 'Coucou {pseudo}, prix doux !' && rf[0].rythme === 'prudent', `${T} : messages aux favoris : SES textes et SON rythme partent à « Enregistrer »`, JSON.stringify(rf));
        await clic(t.pg, '[data-rf-auto]');
        a = await lire(t.pg);
        await cap(t.pg, N('favoris-auto'));
        const fa1 = a.envoyes.filter((m) => m.action === 'favorisAuto');
        const faConf = await t.pg.evaluate(() => !!document.getElementById('vrm-badge').shadowRoot.querySelector('[data-ra-confirme="favoris-auto"]'));
        await clic(t.pg, '[data-ra-oui]');
        a = await lire(t.pg);
        const fa2 = a.envoyes.filter((m) => m.action === 'favorisAuto');
        dit(fa1.length === 1 && fa1[0].actif === true && fa1[0].confirme !== true && faConf && fa2.length === 2 && fa2[1].confirme === true && fa2[1].actif === true, `${T} : mode auto : « Allumer » ⇒ « Oui, allumer » ⇒ envoyé confirmé`, JSON.stringify({ fa1, faConf, fa2 }));
        await clic(t.pg, '[data-auto-choix="paliers"]');
        a = await lire(t.pg);
        await cap(t.pg, N('paliers'));
        dit(a.autoListe.includes('paliers:on*') && a.apercu === '100>93>88>85', `${T} : paliers : l’aperçu 100 → 93 → 88 → 85 (jamais sous le plancher)`, JSON.stringify({ l: a.autoListe, ap: a.apercu }));
        // 5.410 : régler ici. Éteindre les paliers part sans confirmation ; allumer la baisse demande « Oui, allumer ».
        await clic(t.pg, '[data-ra-bascule="paliers"]');
        a = await lire(t.pg);
        const ra1 = a.envoyes.filter((m) => m.action === 'reglageAuto');
        dit(ra1.length === 1 && ra1[0].cle === 'vinted_offres_paliers' && ra1[0].valeur.actif === false && ra1[0].confirme === false, `${T} : « Éteindre » les paliers part tout de suite (ligne des réglages)`, JSON.stringify(ra1));
        await clic(t.pg, '[data-auto-choix="baisse"]');
        await clic(t.pg, '[data-ra-pct="10"]');
        await clic(t.pg, '[data-ra-bascule="baisse"]');
        a = await lire(t.pg);
        await cap(t.pg, N('reglage-confirme'));
        const avantOui = a.envoyes.filter((m) => m.action === 'reglageAuto').length;
        const conf = await t.pg.evaluate(() => !!document.getElementById('vrm-badge').shadowRoot.querySelector('[data-ra-confirme="vinted_baisse_regle"]'));
        dit(conf && avantOui === 1, `${T} : « Allumer » la baisse demande « Oui, allumer » ; rien ne part avant`, JSON.stringify({ conf, avantOui }));
        await clic(t.pg, '[data-ra-oui]');
        a = await lire(t.pg);
        const ra2 = a.envoyes.filter((m) => m.action === 'reglageAuto')[1];
        dit(ra2 && ra2.cle === 'vinted_baisse_regle' && ra2.confirme === true && ra2.valeur.uid === '111' && ra2.valeur.actif === true && ra2.valeur.pct === 10 && ra2.valeur.jours === 14, `${T} : confirmé : la règle de CE compte part (10 % après 14 j)`, JSON.stringify(ra2));
        // Notifications.
        await clic(t.pg, '[data-onglet-b="notifications"]');
        a = await lire(t.pg);
        await cap(t.pg, N('notifications'));
        dit(a.notifs.join('|') === 'ventes:nouveau|codes:nouveau|messages:vu|refus:vu', `${T} : Notifications : 4 lignes, « nouveau » après le marqueur`, JSON.stringify(a.notifs));
        // Paramètres.
        await clic(t.pg, '[data-onglet-b="parametres"]');
        a = await lire(t.pg);
        await cap(t.pg, N('parametres'));
        dit(a.parametres && a.remettre && a.details, `${T} : Paramètres en bas de la barre : le logo, Détails`, JSON.stringify({ p: a.parametres }));
        // 5.410 : la cadence, SON réglage par compte (curseurs), plus vite ⇒ « Oui, aller plus vite ».
        const cad0 = await t.pg.evaluate(() => { const r = document.getElementById('vrm-badge').shadowRoot; return { n: r.querySelectorAll('[data-cad]').length, risque: !!r.querySelector('[data-cad-risque]'), vals: Array.from(r.querySelectorAll('[data-cad]')).map((c) => c.getAttribute('data-cad') + ':' + c.value) }; });
        dit(cad0.n === 5 && cad0.risque && cad0.vals.join('|') === 'favorisHeure:15|actionsHeure:50|parJour:200|pauseMin:40|pauseMax:90', `${T} : Paramètres · Cadence : 5 curseurs aux valeurs par défaut, la phrase du risque`, JSON.stringify(cad0));
        await t.pg.evaluate(() => { const c = document.getElementById('vrm-badge').shadowRoot.querySelector('[data-cad="actionsHeure"]'); c.value = '70'; c.dispatchEvent(new Event('input')); c.dispatchEvent(new Event('change')); });
        await t.pg.waitForTimeout(200);
        await clic(t.pg, '[data-cad-enregistrer]');
        await t.pg.waitForTimeout(150);
        const cadC = await t.pg.evaluate(() => !!document.getElementById('vrm-badge').shadowRoot.querySelector('[data-cad-confirme]'));
        await cap(t.pg, N('cadence'));
        await clic(t.pg, '[data-cad-oui]');
        a = await lire(t.pg);
        const cadE = a.envoyes.filter((m) => m.action === 'reglageAuto' && m.cle === 'vinted_cadence');
        dit(cadC && cadE.length === 2 && cadE[0].confirme === false && cadE[1].confirme === true && cadE[1].valeur.actionsHeure === 70 && cadE[1].valeur.uid === '111', `${T} : 70 actions/h : « Oui, aller plus vite » demandé, puis envoyé confirmé pour CE compte`, JSON.stringify({ cadC, cadE }));
        if (!mobile) {
          await clic(t.pg, '[data-vx-reduire]');
          a = await lire(t.pg);
          await cap(t.pg, N('reduit'));
          dit(a.vx.reduit && a.vx.side.w <= 70 && a.ranges.some((x) => x.vrmPanneauReduit === true), `${T} : la barre se réduit aux icônes (64 px), le choix est gardé`, JSON.stringify({ r: a.vx.reduit, w: a.vx.side.w }));
          await clic(t.pg, '[data-vx-reduire]');
        }
        a = await lire(t.pg);
        dit(a.petits.length === 0, `${T} : cibles ≥ 44 px`, JSON.stringify(a.petits));
        await t.pg.keyboard.press('Escape');
        await t.pg.waitForTimeout(250);
        a = await lire(t.pg);
        dit(!a.on, `${T} : Échap ferme le panneau`);
        dit(t.erreurs.length === 0, `${T} : aucune erreur de page`, JSON.stringify(t.erreurs));
        await t.ctx.close();
      });
      if (orion || largeur === 1280) continue;
      // Base vide : chaque page le dit, rien d'inventé.
      await essaie(T + ' vide', async () => {
        const t = await ouvrir(nav, { scheme, largeur, hauteur, mobile, L: LISTES_VIDE });
        await montrer(t.pg, mobile);
        let a = await lire(t.pg);
        await cap(t.pg, N('vide-accueil'));
        dit(a.accueil && a.accueil.tuiles.join('|') === 'v6_ventes_jour:0|v6_a_expedier:0|v6_non_lus:0|v6_en_vente:0' && a.accueil.capte.length === 0, `${T} vide : Accueil à zéro (lu), rien de capté`, JSON.stringify(a.accueil));
        for (const [o, nom] of [['annonces', 'articles'], ['ventes', 'commandes'], ['messages', 'messagerie'], ['automatisations', 'automatisations']]) {
          await clic(t.pg, `[data-onglet-b="${o}"]`);
          a = await lire(t.pg);
          await cap(t.pg, N('vide-' + nom));
          dit(!a.debord && a.lignesAnn === 0 && a.ventesT.length === 0 && a.msgs === 0, `${T} vide : ${nom} vide, dit, rien ne déborde`);
        }
        dit(t.erreurs.length === 0, `${T} vide : aucune erreur de page`, JSON.stringify(t.erreurs));
        await t.ctx.close();
      });
    }
    // Le lien profond de l'app (décision du 20 nov.) : la page, la sélection cochée, l'action pré-choisie, RIEN ne part.
    for (const [q, attendu] of [['page=articles&ids=7001,7004&action=baisser', 'baisser'], ['page=articles&ids=7002&action=masquer', 'masquer'], ['page=commandes', ''], ['page=automatisations', '']]) {
      const T = 'lien ' + q;
      console.log('\n' + T);
      await essaie(T, async () => {
        const t = await ouvrir(nav, { url: 'https://www.vinted.fr/member/items?vrm=panneau&' + q });
        await t.pg.waitForTimeout(700);
        const a = await lire(t.pg);
        await cap(t.pg, 'lien-' + q.replace(/[^a-z0-9]+/gi, '-').slice(0, 50));
        const page = /commandes/.test(q) ? 'ventes' : /automatisations/.test(q) ? 'automatisations' : 'annonces';
        dit(a.on && a.grand && a.vx && a.vx.page === page && a.lienPanneau === page, `${T} : le panneau s’ouvre seul sur ${page}`, JSON.stringify({ on: a.on, vx: a.vx && a.vx.page }));
        dit(!/vrm=|ids=|action=/.test(a.adresse), `${T} : les paramètres sont retirés de l’adresse`, a.adresse);
        if (/ids=/.test(q)) {
          const ids = /ids=([\d,]+)/.exec(q)[1].split(',');
          const coches = await t.pg.evaluate(() => Array.from(document.getElementById('vrm-badge').shadowRoot.querySelectorAll('[data-ann-sel]')).filter((c) => c.checked).map((c) => c.getAttribute('data-ann-sel')));
          dit(JSON.stringify(coches.sort()) === JSON.stringify(ids.sort()), `${T} : la sélection arrive cochée`, JSON.stringify(coches));
          const choisi = await t.pg.evaluate(() => { const s = document.getElementById('vrm-badge').shadowRoot.querySelector('[data-ann-action]'); return s ? s.value : null; });
          if (attendu === 'masquer') dit(a.confirmeM === 'masquer', `${T} : « Masquer » arrive sur SA confirmation`, a.confirmeM);
          else dit(choisi === attendu, `${T} : l’action « ${attendu} » arrive pré-choisie`, choisi);
        }
        const geste = a.envoyes.filter((m) => ['masquerCarte', 'repondreCarte', 'baisserCarte', 'prixCarte'].includes(m.action) || m.quoi === 'lancer' || m.confirme === true);
        dit(geste.length === 0, `${T} : rien ne part sans SON toucher dans le panneau`, JSON.stringify(geste));
        dit(t.erreurs.length === 0, `${T} : aucune erreur de page`, JSON.stringify(t.erreurs));
        await t.ctx.close();
      });
    }
  } finally { await nav.close(); }
  console.log(ko ? `\n❌ grand-panneau : ${ko} rouge(s) sur ${ok + ko}` : `\n✅ grand-panneau : ${ok} contrôles`);
  process.exit(ko ? 1 : 0);
})();
