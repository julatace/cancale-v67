// ════════════════════════════════════════════════════════════════════════
//  BANC « COMMANDES : SÉLECTIONNER ET AGIR » (21 nov., ext. 5.419, `commandeslot`)
//
//  Julien, 21 nov. : « dans les Commandes, je veux pouvoir sélectionner les commandes et faire des choses dessus, par
//  exemple sélectionner celles qui ne sont pas encore expédiées pour imprimer les bordereaux ». Le VRAI vrm-badge.js +
//  vrm-ui.js sur une FAUSSE page vinted.fr (faux `chrome`), des ventes INVENTÉES. On juge :
//   C1. une case sur CHAQUE commande + « tout sélectionner » ; C2. les filtres rapides et leurs nombres ;
//   C3. « sans bordereau » + tout sélectionner ⇒ la barre ; C4. « Commander » : confirmation, puis CETTE vente seulement ;
//   C5. sélection mêlée : « Imprimer » ne demande QUE les bordereaux prêts, le manque est dit ;
//   C6. « Copier les n° de suivi » (le manque dit) ; C7. « Ouvrir sur Vinted » par conversation ;
//   G. cibles ≥ 44 px, rien ne déborde, aucune erreur — 390 Orion clair/sombre, 1512 clair/sombre.
//  `BANC_EXT=<arbre d'avant>/vinted-sync-extension` : rouge attendu (pas de sélection). Tout est inventé.
// ════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const RACINE = process.env.BANC_RACINE ? path.resolve(process.env.BANC_RACINE) : path.join(__dirname, '..', '..');
const EXT = process.env.BANC_EXT || path.join(RACINE, 'vinted-sync-extension');
const { pathToFileURL } = require('url');
const BADGE = fs.readFileSync(path.join(EXT, 'vrm-badge.js'), 'utf8');
const UI = fs.existsSync(path.join(EXT, 'vrm-ui.js')) ? fs.readFileSync(path.join(EXT, 'vrm-ui.js'), 'utf8') : '';
const LOGO = fs.readFileSync(path.join(__dirname, '..', '..', 'vinted-sync-extension', 'logo-vrm-96.png'));
const SORTIE = process.env.BANC_CAPTURES ? path.join(process.env.BANC_CAPTURES, 'commandes-selection') : path.join(__dirname, 'captures', 'commandes-selection');
let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + String(detail).slice(0, 600) : ''}`); } };
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
// 5.410.4 : les réglages « comme Bleam » de CE compte, tels que le fond les rend (bleamDe : chaque section, éteinte sauf le bordereau).
const BLEAM = { bordereau: { actif: true, colissimo: 'relais' }, msgVente: { actif: false, textes: ['Merci pour ton achat, je prépare ton colis !', 'Merci beaucoup, le colis part vite.'] }, msgFinalise: { actif: false, textes: [] }, msgRelais: { actif: false, textes: [], heures: 24 }, msgEvaluation: { actif: false, textes: [], heures: 24 }, eval5: { actif: false, textes: [] },
  stockAuto: { actif: false, stock: { 12: 3 } }, cycle: { actif: false, strategie: 'anti', etapes: [{ apres: 7, action: 'baisse', pct: 10 }, { apres: 10, action: 'republier' }], repeter: 7, plafondPct: 20, ensuite: 0, rythme: { repub: { min: 5, max: 10 }, prix: { min: 5, max: 10 }, jours: [1, 2, 3, 4, 5], heureDebut: 9, heureFin: 21 } },
  favoris: { actif: false, noteMin: 0, parArticle: 0, periodeJours: 0, apresMin: 0, reecrireJours: 1 }, sauvegarde: { actif: false }, dressing: { actif: false, tri: 'recentes', filtre: 'toutes' } };
const AUTO = { bleam: BLEAM, sauvegarde: { at: Date.now() - 20 * 60000, n: 42 }, cadence: CADENCE, offres: { actif: true, minis: 12, refus: true }, favoris: { regle: true, versions: 3, rythme: 'normal', textes: ['Bonjour {pseudo}, une offre rien que pour toi.', 'Salut {pseudo} ! Je te fais un prix.', 'Hello {pseudo}, elle t’attend.'], auto: { actif: false, attenteMin: 10, attenteMax: 60, parJour: 30, parHeure: 12, heureDebut: 9, heureFin: 21 } }, paliers: { actif: true, paliers: [50, 80, 100], remiseMax: null, messages: 2 }, baisse: { actif: false, pct: 5, jours: 14 } };
const NOTIFS = { vu: T0 - 3 * H, liste: [{ p: 'vinted', c: '111', s: 'ventes', id: '91000000000', t: T0 - H }, { p: 'vinted', c: '111', s: 'codes', id: '91000000002:AB12', t: T0 - 2 * H }, { p: 'vinted', c: '111', s: 'messages', id: '60000@x', t: T0 - 5 * H }, { p: 'vinted', c: '111', s: 'refus', id: 'pause@1', q: 'pause', t: T0 - 2 * J }] };
const OFFRES = [{ conv: '60000', prix: 48, tx: '91000000009', oid: '777', item: '7001', titre: 'Adidas Samba OG noires 40', pseudo: 'acheteuse_0' }];
const LISTES = { ok: true, plateforme: 'vinted', compte: { id: '111', nom: 'shop_sophie' }, offres: OFFRES,
  annonces: { lu: T0 - 20 * MIN, aConfirmer: false, total: ANN.length, liste: ANN, toutes: TOUTES, nTous: TOUTES.length, statuts: { en_vente: 5, brouillon: 2, masque: 1, reserve: 1, vendu: 1, a_confirmer: 0 } }, automatisations: AUTO, notifications: NOTIFS, ventes: { lu: T0 - 10 * MIN, total: VEN.length, liste: VEN }, messages: { lu: T0 - 5 * MIN, liste: MSG }, autres: null };
const ETAT = { ok: true, plateforme: 'vinted', capte: true, version: '5.410.0', code: '5.410.0', vrm: { ok: true, connecte: true, email: 'sophie@exemple.fr', cloisonne: true },
  site: { id: '111', nom: 'shop_sophie', choix: 'oui', jauge: { h: 12, maxH: 50, j: 40, maxJ: 200, complet: true }, favoris: { apercu: { at: T0 - MIN, etat: 'pret', total: 8 }, file: null } },
  secu: { niveau: 'ok', texte: 'Tout va bien sur ce compte' }, toutArrete: false,
  flux: { okAt: T0 - 3 * MIN }, liens: [{ cle: 'messages', libelle: 'Messages', url: 'https://www.vinted.fr/inbox' }], capteCoupe: false };
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8sPfefwAHiQM0TP3mWgAAAABJRU5ErkJggg==', 'base64');

async function ouvrir(nav, { scheme = 'light', largeur = 1512, hauteur = 900, mobile = false, orion = false, L = LISTES, url = 'https://www.vinted.fr/catalog', AP = APERCU } = {}) {
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
          if (msg.action === 'etat') rep = copie(window.__etat || e);
          else if (msg.action === 'carteListes') rep = copie(L);
          else if (msg.action === 'capteLot') rep = { ok: true, lot: null };
          else if (msg.action === 'bordereauCarte') rep = { ok: true, pdfs: (msg.txs || []).map((tx) => ({ tx, b64: 'JVBERi0xLjQKJcOkw7zDtsOfCjEgMCBvYmoKPDwvVHlwZS9DYXRhbG9nPj4KZW5kb2JqCnRyYWlsZXIKPDwvUm9vdCAxIDAgUj4+CiUlRU9GCg==' })), manque: [], passu: [] };
          else if (msg.action === 'bordereauxCommander') rep = msg.confirme === true ? { ok: true, acceptes: (msg.txs || []).map((tx) => ({ tx, etape: 'file' })), refus: [] } : { ok: false, raison: 'non' };
          else if (msg.action === 'favorisCarte' && msg.quoi === 'apercu') rep = { ok: true, uid: '111', apercu: copie(ap) };
          else if (msg.action === 'favorisCarte' && msg.quoi === 'lancer') rep = window.__refusLancer ? copie(window.__refusLancer) : msg.confirme === true ? { ok: true } : { ok: false };
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
          else if (msg.action === 'commeBleamLire') rep = { ok: true, reglages: window.__cb || (window.__cb = { methode: 'formulaire', favoris: true, messageLot: 'Bonjour {username}, je peux vous faire un prix sur un lot !', offreMin: 8, offreMax: 15 }), onglet: { tabId: 9, chemin: '/items/…/edit', etape: 'champ', travaille: true, maj: Date.now() } };
          else if (msg.action === 'commeBleamPoser') { window.__cb = Object.assign({}, window.__cb, msg.valeur); rep = { ok: true, reglages: window.__cb }; }
          else if (msg.action === 'masquerCarte') rep = msg.confirme === true ? { ok: true, faits: (msg.ids || []).map((id) => ({ id, ok: true, relu: true })) } : { ok: false };
          setTimeout(() => cb && cb(rep), 0);
        } },
      storage: { local: { get: (k, cb) => { if (cb) setTimeout(() => cb({}), 0); return Promise.resolve({}); }, set: (o, cb) => { (window.__ranges = window.__ranges || []).push(copie(o)); if (cb) setTimeout(cb, 0); return Promise.resolve(); } }, onChanged: { addListener(f) { (window.__ecoutes = window.__ecoutes || []).push(f); } } },
    };
    if (ui) { const u = document.createElement('script'); u.textContent = ui; document.documentElement.appendChild(u); }
    const s = document.createElement('script'); s.textContent = js; document.documentElement.appendChild(s);
  }, { e: ETAT, js: BADGE, ui: UI, ap: AP, L });
  await pg.waitForTimeout(250);
  return { ctx, pg, erreurs };
}
// ── Les favoris inventés : 22 rangées, sur les 10 annonces inventées (TOUTES : prix mini sur les impaires, achat sur 7000) ──
const SPEC = { 4: { envoi: 'envoye', offreFaite: true }, 7: { envoi: 'envoye' }, 9: { raison: 'non_prouve' }, 12: { envoi: 'a_verifier' }, 15: { raisonFiltre: 'note' } };
const FAV2 = Array.from({ length: 22 }, (_, k) => { const a = TOUTES[k % 10]; const s = SPEC[k] || {}; const cochable = !s.envoi && !s.raison && !s.raisonFiltre;
  return Object.assign({ id: 'f' + k, itemId: a.id, pseudo: 'acheteur_' + k, titre: a.titre, prix: a.prix, date: new Date(T0 - (k * 41 + 3) * MIN).toISOString(), photo: img('a' + (k % 10)), num: a.num || undefined,
    envoi: s.envoi || 'a_envoyer', cochable }, cochable ? { offre: k === 3 ? 40 : Math.round(a.prix * 90) / 100, texte: `Bonjour acheteur_${k}, une offre pour toi !` } : {}, s.offreFaite ? { offreFaite: true } : {}, s.raison ? { raison: s.raison } : {}, s.raisonFiltre ? { cochable: false, raisonFiltre: s.raisonFiltre } : {}); });
FAV2.forEach((x) => { if (!x.num) delete x.num; });
const AP2 = { etat: 'pret', total: FAV2.filter((x) => x.cochable).length, nonProuves: 1, ecartes: 0, selection: [], liste: FAV2.filter((x) => x.cochable).slice(0, 15), tous: FAV2, totalTous: FAV2.length, retires: 2, max: 15,
  message: { versions: 3, offre: { mode: 'pct', valeur: 10, arrondi: false }, intervalleMinutes: 1, intervalleMaxMinutes: 2, rythme: 'normal' }, reglages: { version: 1, message: 'Bonjour {pseudo}', pourcentage: 10, offreMode: 'pct' } };
const COCHABLES = FAV2.filter((x) => x.cochable).map((x) => x.id);


// ── J : la forme de la file de Julien (21 nov.), l'aperçu par la VRAIE règle du serveur ──────────────────────────────
async function apercuJulien() {
  const M = await import(pathToFileURL(path.join(RACINE, 'api', '_lib', 'favoris-carte.js')).href);
  const H = 3600000, iso = (t) => new Date(t).toISOString();
  const notifs = Array.from({ length: 32 }, (_, i) => ({ id: 'n' + i, user_id: 900 + i, body: `acheteur_${i} a ajouté ton article à ses favoris.`, link: `/items/${6000 + i}/conversation/new?from_notification=true`, created_at: iso(T0 - (i + 1) * 20 * MIN) }));
  const items = notifs.map((_, i) => ({ id: 6000 + i, title: 'Baskets inventées ' + i, price: { amount: String(50 + i) + '.0', currency_code: 'EUR' }, photo: { url: img('j' + i) } }));
  const jobs = notifs.map((n, i) => ({ id: `${6000 + i}:${900 + i}`, notificationId: n.id, itemId: String(6000 + i), recipientId: String(900 + i),
    ...(i < 25 ? { etat: 'annule', lot: 'L0' } : i === 25 ? { etat: 'attente', lot: 'L1' } : i < 31 ? { etat: 'envoye', lot: 'L1', ecrits: 3, envoyeLe: T0 - H } : { etat: 'refuse', raison: 'vinted_robot', ecrits: 1, lot: 'L1' }) }));
  const vue = { active: true, lot: 'L1', prochain: 0, raison: '', jobs };
  const prefs = { version: 1, envoisActifs: false, message: 'Bonjour {pseudo}, je te propose une offre dessus !', pourcentage: 5, offreMode: 'pct', offreValeur: null, arrondi: false, intervalleMinutes: 1, intervalleMaxMinutes: 2 };
  return M.apercuCarte({ prefs, capture: { payload: { notifications: notifs }, domain: 'www.vinted.fr' }, vue, dressing: { cap: iso(T0 - H / 2), pg: { total_entries: 32 }, items }, prouve: () => true, maintenant: T0 });
}
const lireF = (pg) => pg.evaluate(() => {
  const r = document.getElementById('vrm-badge').shadowRoot, q = (s) => r.querySelector(s);
  const vis = (el) => !!(el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none');
  const rangs = Array.from(r.querySelectorAll('.fav6-table .rangs > li[data-fav-qui]'));
  const carte = q('.carte');
  const zone = q('.fav6');
  const ctl = zone ? Array.from(r.querySelectorAll('.fav6 button, .fav6 input, .fav6 label.case5, .fav6-feuille button, .fav6-feuille textarea')).filter(vis).filter((b) => !(b.tagName === 'INPUT' && b.closest('label.case5'))) : [];
  return {
    page: q('[data-vx]') && q('[data-vx]').getAttribute('data-page'), tableau: !!q('.fav6-table'), etapes: !!q('[data-fav-etape]'),
    entetes: Array.from(r.querySelectorAll('.fav6-table .th6r .th6')).filter(vis).map((b) => b.textContent.replace(/[↑↓↕]/g, '').trim()),
    ids: rangs.map((li) => li.getAttribute('data-fav-qui')), dates: rangs.map((li) => Date.parse(li.getAttribute('data-fav-date') || '')),
    etats: Object.fromEntries(rangs.map((li) => [li.getAttribute('data-fav-qui'), li.getAttribute('data-fav-etat6') + '|' + ((li.querySelector('.et6') || {}).textContent || '') + '|' + ((li.querySelector('.rs6') || {}).textContent || '')])),
    offres: Object.fromEntries(rangs.map((li) => { const o = li.querySelector('[data-fav-offre6]'); return [li.getAttribute('data-fav-qui'), o ? o.getAttribute('data-fav-offre6') + ':' + (o.getAttribute('data-offre') || '') : '']; })),
    cases: rangs.map((li) => !!li.querySelector('input[data-fav-coche]')), coches: rangs.filter((li) => li.hasAttribute('data-coche')).map((li) => li.getAttribute('data-fav-qui')),
    hauteurs: rangs.filter(vis).map((li) => Math.round(li.getBoundingClientRect().height)),
    plaques: r.querySelectorAll('.fav6-table .plaque').length, vignettes: r.querySelectorAll('.fav6-table .vig').length,
    segs: Array.from(r.querySelectorAll('[data-fav6-filtre]')).map((b) => b.getAttribute('data-fav6-filtre') + ':' + b.querySelector('b').textContent + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')),
    tri: q('.fav6-table') ? q('.fav6-table').getAttribute('data-tri') : null,
    bas: q('[data-fav6-bas]') ? { vis: vis(q('[data-fav6-bas]')), n: q('[data-fav-coches]').getAttribute('data-fav-coches'), bouton: q('[data-fav-envoyer]').textContent, off: q('[data-fav-envoyer]').disabled, colle: getComputedStyle(q('[data-fav6-bas]')).position, bas: Math.round(q('[data-fav6-bas]').getBoundingClientRect().bottom), corps: Math.round(q('.corps6').getBoundingClientRect().bottom) } : null,
    feuille: q('[data-fav6-feuille]') ? { k: q('[data-fav6-feuille]').getAttribute('data-fav6-feuille'), vis: vis(q('[data-fav6-feuille]')), msg: q('.fav6-feuille [data-fav-message]') ? q('.fav6-feuille [data-fav-message]').textContent : '', versions: /versions?/.test(q('.fav6-feuille').innerText), offre: q('.fav6-feuille [data-fav-offre]') ? q('.fav6-feuille [data-fav-offre]').getAttribute('data-fav-offre') : null, taux: q('.fav6-feuille [data-fav-env-taux]') ? q('.fav6-feuille [data-fav-env-taux]').getAttribute('data-fav-env-taux') : null, rythme: q('.fav6-feuille [data-fav-rythme]') ? q('.fav6-feuille [data-fav-rythme]').getAttribute('data-fav-rythme') : null, lancer: !!q('.fav6-feuille [data-fav-lancer]'), textes: r.querySelectorAll('.fav6-feuille [data-rf-texte], .fav6-feuille [data-fp-texte]').length } : null,
    envoi: q('.fav6-envoi') ? { texte: q('.fav6-envoi').innerText, arreter: !!q('.fav6-envoi [data-fav-arreter]'), faits: q('.fav6-envoi [data-fav-envoyes]') ? q('.fav6-envoi [data-fav-envoyes]').getAttribute('data-fav-envoyes') : null } : null,
    principalAilleurs: !!q('.ext6 [data-fav="encours"]'),
    erreur: q('[data-fav-erreur6]') ? q('[data-fav-erreur6]').textContent : '',
    fileHier: q('[data-fav6-file]') ? { k: q('[data-fav6-file]').getAttribute('data-fav6-file'), n: q('[data-fav6-file]').getAttribute('data-fav6-attente'), reprendre: !!q('[data-fav6-continuer]'), annuler: !!q('[data-fav6-annuler]'), texte: q('[data-fav6-file]').innerText } : null,
    casesVues: Array.from(r.querySelectorAll('.fav6-table input[data-fav-coche]')).filter((c) => { const l = c.closest('label'); return l && l.getBoundingClientRect().height >= 43.5 && getComputedStyle(l).visibility !== 'hidden'; }).length,
    cochesVues: Array.from(r.querySelectorAll('.fav6-table input[data-fav-coche]')).filter((c) => c.checked).length,
    autres: window.__envoyes.filter((m) => m.action === 'favorisCarte' && ['continuer', 'arreter'].includes(m.quoi)).map((m) => m.quoi),
    petits: ctl.filter((b) => b.getBoundingClientRect().height < 43.5 && !b.closest('.fl-recap .outils')).map((b) => (b.className || b.tagName) + ':' + Math.round(b.getBoundingClientRect().height) + ':' + (b.innerText || b.getAttribute('aria-label') || '').slice(0, 24)),
    debord: document.documentElement.scrollWidth > window.innerWidth || (carte && carte.scrollWidth > carte.clientWidth + 1) || !!(zone && zone.scrollWidth > zone.clientWidth + 1),
    envoyes: window.__envoyes.filter((m) => m.action === 'favorisCarte' && m.quoi === 'lancer'),
  };
});
const clic = async (pg, sel) => { await pg.evaluate((s) => { const b = document.getElementById('vrm-badge').shadowRoot.querySelector(s); if (b) b.click(); }, sel); await pg.waitForTimeout(220); };
const montrer = async (pg, mobile) => {
  const b = await pg.evaluate(() => { const x = document.getElementById('vrm-badge').shadowRoot.querySelector('.btn').getBoundingClientRect(); return { x: x.left + x.width / 2, y: x.top + x.height / 2 }; });
  if (mobile) await pg.touchscreen.tap(b.x, b.y); else { await pg.mouse.move(5, 5); await pg.mouse.move(b.x, b.y); await pg.mouse.click(b.x, b.y); }
  await pg.waitForTimeout(400);
};
// L'état que le fond poserait, puis le signal de chrome.storage (comme `vrmFavorisCarte` qui change).
const poserEtat = async (pg, file) => { await pg.evaluate((f) => { const e = JSON.parse(JSON.stringify(window.__etatBase)); e.site.favoris.file = f; window.__etat = e; for (const l of window.__ecoutes || []) try { l({ vrmFavorisCarte: { newValue: f } }, 'local'); } catch (_) {} }, file); await pg.waitForTimeout(450); };
const cap = async (pg, nom) => { try { await pg.screenshot({ path: path.join(SORTIE, nom + '.png') }); } catch (_) {} };

VEN[0].suivi = 'XW123456789FR'; VEN[2].suivi = 'MR987654321';
const lireC = (pg) => pg.evaluate(() => {
  const r = document.getElementById('vrm-badge').shadowRoot, q = (s) => r.querySelector(s);
  const vis = (el) => !!(el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none');
  const t = q('[data-ventes]') || q('.vide6');
  const ctl = Array.from(r.querySelectorAll('.contenu button, .contenu input, .contenu summary')).filter(vis).filter((b) => !b.closest('.side6'));
  return { cases: Array.from(r.querySelectorAll('[data-ven-sel]')).map((c) => c.getAttribute('data-ven-sel')), tout: !!q('[data-ven-tout]'),
    filtres: Array.from(r.querySelectorAll('[data-ven-filtre]')).map((b) => b.getAttribute('data-ven-filtre') + ':' + b.querySelector('b').textContent + ':' + b.getAttribute('aria-pressed')),
    bas: q('[data-ven-bas]') ? { n: q('[data-ven-bas]').getAttribute('data-ven-bas'), sans: (q('[data-ven-sans-bord]') || {}).textContent || '', imp: q('[data-ven-imprimer]') ? q('[data-ven-imprimer]').getAttribute('data-imprimer-n') : null, impOff: q('[data-ven-imprimer]') ? q('[data-ven-imprimer]').disabled : null,
      cmd: q('[data-ven-commander]') ? q('[data-ven-commander]').getAttribute('data-ven-commander') : null, copier: !!q('[data-ven-copier]'), ouvrir: !!q('[data-ven-ouvrir]'), vis: vis(q('[data-ven-bas]')) } : null,
    conf: !!q('[data-ven-confirme]'), etat: (q('[data-imp-etat]') || {}).textContent || '',
    envoyes: window.__envoyes.filter((m) => m.action === 'bordereauCarte' || m.action === 'bordereauxCommander'), copies: window.__copies || [], ouverts: window.__ouverts || [],
    petits: ctl.map((b) => (b.tagName === 'INPUT' && b.closest('label') ? b.closest('label') : b)).filter((b) => b.getBoundingClientRect().height < 43.5 && !b.closest('details:not([open])') && !b.closest('.cels6') && !b.closest('.th6r')).map((b) => (b.className || b.tagName) + ':' + Math.round(b.getBoundingClientRect().height) + ':' + (b.innerText || b.getAttribute('aria-label') || '').slice(0, 24)),
    debord: document.documentElement.scrollWidth > window.innerWidth, ok: !!t };
});
const cocher = async (pg, tx) => { await pg.evaluate((k) => { const c = document.getElementById('vrm-badge').shadowRoot.querySelector(`[data-ven-sel="${k}"]`); if (c) { c.checked = !c.checked; c.dispatchEvent(new Event('change', { bubbles: true })); } }, tx); await pg.waitForTimeout(220); };
(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  fs.mkdirSync(SORTIE, { recursive: true });
  const TAILLES = [{ T: '390 Orion', largeur: 390, hauteur: 844, mobile: true, orion: true, scheme: 'light' }, { T: '390 Orion sombre', largeur: 390, hauteur: 844, mobile: true, orion: true, scheme: 'dark' }, { T: '1512 light', largeur: 1512, scheme: 'light' }, { T: '1512 dark', largeur: 1512, scheme: 'dark' }];
  for (const o of TAILLES) {
    const T = o.T, N = (s) => T.replace(/ /g, '-') + '-' + s;
    console.log('\n' + T);
    const t = await ouvrir(nav, o);
    await essaie(T, async () => {
      await t.pg.evaluate(() => { window.__copies = []; try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: (x) => { window.__copies.push(String(x)); return Promise.resolve(); } }, configurable: true }); } catch (_) {} const o0 = window.open; window.open = (u) => { (window.__ouverts = window.__ouverts || []).push(String(u)); return u ? {} : null; }; void o0; });
      await montrer(t.pg, o.mobile);
      await clic(t.pg, '.side6 [data-onglet-b="ventes"]');
      await t.pg.waitForTimeout(500);
      let c = await lireC(t.pg);
      // C1 — une case sur CHAQUE commande, « tout sélectionner »
      dit(c.cases.length === VEN.length && VEN.every((x) => c.cases.includes(x.tx)) && c.tout, `${T} C1 — une case sur chaque commande (${VEN.length}) et « tout sélectionner »`, JSON.stringify(c.cases));
      // C2 — les filtres rapides et leurs nombres
      const n = (k) => (c.filtres.find((f) => f.startsWith(k + ':')) || '').split(':')[1];
      dit(n('tous') === '5' && n('sans_bord') === '1' && n('bord_pret') === '1' && n('en_route') === '1' && n('terminees') === '2', `${T} C2 — filtres rapides : Toutes 5 · sans bordereau 1 · prêt 1 · en route 1 · terminées 2`, JSON.stringify(c.filtres));
      await cap(t.pg, N('1-commandes'));
      // C3 — « À expédier — sans bordereau » puis « tout sélectionner » : seulement CETTE commande
      await clic(t.pg, '[data-ven-filtre="sans_bord"]');
      c = await lireC(t.pg);
      dit(c.cases.length === 1 && c.cases[0] === VEN[1].tx, `${T} C3 — le filtre « sans bordereau » montre la seule commande sans bordereau`, JSON.stringify(c.cases));
      await t.pg.evaluate(() => { const c0 = document.getElementById('vrm-badge').shadowRoot.querySelector('[data-ven-tout]'); c0.checked = true; c0.dispatchEvent(new Event('change', { bubbles: true })); }); await t.pg.waitForTimeout(250);
      c = await lireC(t.pg);
      dit(c.bas && c.bas.n === '1' && c.bas.vis && c.bas.cmd === VEN[1].tx && c.bas.impOff === true, `${T} C3 — tout sélectionner (filtre) ⇒ la barre : 1 choisie, « Commander le bordereau », impression fermée (rien à imprimer)`, JSON.stringify(c.bas));
      // C4 — « Commander » : confirmation, puis SON toucher ⇒ bordereauxCommander (Vinted, ce n° de transaction, confirme)
      await clic(t.pg, '[data-ven-commander]');
      c = await lireC(t.pg);
      dit(c.conf && !c.envoyes.some((m) => m.action === 'bordereauxCommander'), `${T} C4 — « Commander » demande d’abord sa confirmation (rien ne part)`);
      await cap(t.pg, N('2-commander-confirmer'));
      await clic(t.pg, '[data-ven-confirme-ok]'); await t.pg.waitForTimeout(300);
      c = await lireC(t.pg);
      const cm = c.envoyes.filter((m) => m.action === 'bordereauxCommander');
      dit(cm.length === 1 && cm[0].confirme === true && JSON.stringify(cm[0].txs) === JSON.stringify([VEN[1].tx]), `${T} C4 — confirmé : la commande part pour CETTE vente seulement`, JSON.stringify(cm));
      // C5 — toutes : sélection mêlée (prêt + sans bordereau + en route) ⇒ « Imprimer » n'envoie QUE le bordereau prêt, le reste est dit
      await clic(t.pg, '[data-ven-filtre="tous"]');
      await clic(t.pg, '[data-ven-rien]');
      for (const x of [VEN[0], VEN[1], VEN[2]]) await cocher(t.pg, x.tx);
      c = await lireC(t.pg);
      dit(c.bas && c.bas.n === '3' && c.bas.imp === VEN[0].tx && /1 sans bordereau/.test(c.bas.sans) && c.bas.copier && c.bas.ouvrir, `${T} C5 — 3 choisies : « Imprimer » ne porte que le bordereau prêt, « 1 sans bordereau » est dit`, JSON.stringify(c.bas));
      await cap(t.pg, N('3-selection'));
      await clic(t.pg, '[data-ven-imprimer]'); await t.pg.waitForTimeout(400);
      c = await lireC(t.pg);
      const im = c.envoyes.filter((m) => m.action === 'bordereauCarte');
      dit(im.length === 1 && JSON.stringify(im[0].txs) === JSON.stringify([VEN[0].tx]), `${T} C5 — l’impression ne demande QUE le bordereau prêt (jamais une commande sans bordereau)`, JSON.stringify(im));
      // C6 — « Copier les n° de suivi » : ceux qu'on connaît, le manque dit
      for (const x of [VEN[1], VEN[2]]) { const on = (await lireC(t.pg)).cases.includes(x.tx); if (on) {} }
      await clic(t.pg, '[data-ven-rien]');
      for (const x of [VEN[0], VEN[1], VEN[2]]) await cocher(t.pg, x.tx);
      await clic(t.pg, '[data-ven-copier]'); await t.pg.waitForTimeout(250);
      c = await lireC(t.pg);
      dit(c.copies.length === 1 && c.copies[0] === `${VEN[0].suivi}\n${VEN[2].suivi}` && /1 sans n° de suivi/.test(c.etat), `${T} C6 — « Copier » : les 2 n° de suivi connus, « 1 sans n° de suivi » dit`, JSON.stringify([c.copies, c.etat]));
      // C7 — « Ouvrir sur Vinted » : la conversation de CHAQUE commande (par son n°)
      await clic(t.pg, '[data-ven-ouvrir]'); await t.pg.waitForTimeout(200);
      c = await lireC(t.pg);
      dit([VEN[0], VEN[1], VEN[2]].every((x) => c.ouverts.some((u) => u.endsWith('/inbox/' + x.conv))), `${T} C7 — « Ouvrir sur Vinted » ouvre la conversation de chaque commande choisie`, JSON.stringify(c.ouverts));
      dit(!c.petits.length, `${T} G — cibles ≥ 44 px`, c.petits.slice(0, 8).join(' · '));
      dit(!c.debord, `${T} G — rien ne déborde`);
      dit(!t.erreurs.length, `${T} G — aucune erreur de page`, t.erreurs.join(' | '));
    });
    await t.ctx.close();
  }
  await nav.close();
  console.log(`\nbanc commandes-selection : ${ok} vert(s), ${ko} rouge(s) — captures : ${SORTIE}`);
  process.exit(ko ? 1 : 0);
})();
