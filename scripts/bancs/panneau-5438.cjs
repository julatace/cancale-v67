// ═════════════════════════════════════════════════════════════════
//  BANC « EXT. 5.438 » — NOTE DE SANTÉ, COMPTE PRÉCIEUX, LOT ET BROUILLONS SEULS, RELANCES, « À NOUVEAU VISIBLE »
//  (22 nov., choix 1, 2, 3, 5, 6, 11 de Julien). Le harnais (faux chrome, fausse page) est celui du banc
//  sauvegarde-reglages-panneau, recopié tel quel ; la suite juge ce que la 5.438 montre (le vrai fond : audit-ext-5438).
//  Ci-dessous, la description d'origine du harnais :
//
//  Le VRAI vrm-badge.js + vrm-ui.js sur une FAUSSE page vinted.fr (le faux `chrome` du banc repub-programmee, recopié par
//  ce fichier tel quel). On juge : la section dans Paramètres et sa promesse (aucun secret), « Sauvegarder » télécharge le
//  fichier daté, « Restaurer… » lit le fichier et montre avant → après (compte nommé, « S’allume » marqué, autre version
//  dite, autre compte en case décochée), RIEN ne part avant SON « Oui » (puis avec le jeton de l'aperçu), « Non » ⇒ rien ;
//  cibles 44 px, rien ne déborde, aucune erreur. 390 Orion clair et sombre, puis 1512 clair et sombre.
//  `BANC_EXT=<arbre d'avant>` : rouge attendu. Tout est inventé (dépôt public). Le vrai fond : audit-sauvegarde-reglages.
// ═════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const RACINE = path.join(__dirname, '..', '..');
const EXT = process.env.BANC_EXT || path.join(RACINE, 'vinted-sync-extension');
const BADGE = fs.readFileSync(path.join(EXT, 'vrm-badge.js'), 'utf8');
const UI = fs.existsSync(path.join(EXT, 'vrm-ui.js')) ? fs.readFileSync(path.join(EXT, 'vrm-ui.js'), 'utf8') : '';
const LOGO = fs.readFileSync(path.join(RACINE, 'vinted-sync-extension', 'logo-vrm-96.png'));
const SORTIE = process.env.BANC_CAPTURES ? path.join(process.env.BANC_CAPTURES, 'panneau-5438') : path.join(__dirname, 'captures', 'panneau-5438');

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

async function ouvrir(nav, { scheme = 'light', largeur = 1512, hauteur = 900, mobile = false, orion = false, L = LISTES, url = 'https://www.vinted.fr/catalog', reps = {} } = {}) {
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
  await pg.evaluate(({ e, js, ui, ap, L, reps }) => {
    window.__repStatic = reps;
    window.__envoyes = []; window.__ouverts = []; const ouvrirVrai = window.open; window.open = (u) => { window.__ouverts.push(String(u)); return null; };
    const copie = (x) => JSON.parse(JSON.stringify(x));
    const orig = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (o) { return orig.call(this, Object.assign({}, o, { mode: 'open' })); };
    window.chrome = {
      runtime: { id: 'ext', getURL: (p) => location.origin + '/' + p, getManifest: () => ({ version: e.version }), lastError: null,
        sendMessage: (msg, cb) => {
          window.__envoyes.push(copie(msg));
          let rep = { ok: true };
          if (window.__repStatic && window.__repStatic[msg.action] !== undefined) { const v = copie(window.__repStatic[msg.action]); setTimeout(() => cb && cb(v), 0); return; }
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
          else if (msg.action === 'atelierProgrammer') rep = msg.confirme === true ? { ok: true } : { ok: false };
          else if (msg.action === 'atelierProgAnnuler') rep = { ok: true, annulee: true };
          else if (msg.action === 'atelierProgRelancer') rep = msg.confirme === true ? { ok: true } : { ok: false };
          else if (msg.action === 'offreCarte') rep = msg.quoi === 'accept' && msg.avisVu !== true ? { ok: false, code: 'avis', avis: 'VRM n’a pas pu vérifier tes autres sites : vérifie qu’elle n’y est pas vendue.' } : { ok: true };
          else if (msg.action === 'publierCarte') rep = !msg.reponses ? { ok: false, code: 'questions', questions: [{ champ: 'categorie', choix: ['Baskets', 'Bottes'], saisie: '' }] } : msg.verifVu !== true ? { accepte: false, code: 'verification', problemes: [{ code: 'photos', texte: '1 photo seulement' }] } : { accepte: true };
          else if (msg.action === 'favorisAuto') rep = msg.actif && msg.confirme !== true ? { ok: false, code: 'confirmation' } : { ok: true, actif: msg.actif };
          else if (msg.action === 'reglageAuto') rep = msg.cle === 'vinted_cadence' && msg.valeur.actionsHeure > 50 && msg.confirme !== true ? { ok: false, code: 'confirmation' } : { ok: true, relu: true };
          else if (msg.action === 'commeBleamLire') rep = { ok: true, reglages: window.__cb || (window.__cb = { methode: 'formulaire', favoris: true, messageLot: 'Bonjour {username}, je peux vous faire un prix sur un lot !', offreMin: 8, offreMax: 15 }), onglet: { tabId: 9, chemin: '/items/…/edit', etape: 'champ', travaille: true, maj: Date.now() } };
          else if (msg.action === 'commeBleamPoser') { window.__cb = Object.assign({}, window.__cb, msg.valeur); rep = { ok: true, reglages: window.__cb }; }
          else if (msg.action === 'sauvegardeReglages') rep = window.__sr ? window.__sr(msg) : { ok: false };
          else if (msg.action === 'masquerCarte') rep = msg.confirme === true ? { ok: true, faits: (msg.ids || []).map((id) => ({ id, ok: true, relu: true })) } : { ok: false };
          setTimeout(() => cb && cb(rep), 0);
        } },
      storage: { local: { get: (k, cb) => { if (cb) setTimeout(() => cb({}), 0); return Promise.resolve({}); }, set: (o, cb) => { (window.__ranges = window.__ranges || []).push(copie(o)); if (cb) setTimeout(cb, 0); return Promise.resolve(); } }, onChanged: { addListener() {} } },
    };
    if (ui) { const u = document.createElement('script'); u.textContent = ui; document.documentElement.appendChild(u); }
    const s = document.createElement('script'); s.textContent = js; document.documentElement.appendChild(s);
  }, { e: ETAT, js: BADGE, ui: UI, ap: APERCU, L, reps });
  await pg.waitForTimeout(250);
  return { ctx, pg, erreurs };
}
const clic = async (pg, sel) => { await pg.evaluate((s) => { const b = document.getElementById('vrm-badge').shadowRoot.querySelector(s); if (b) b.click(); }, sel); await pg.waitForTimeout(220); };
const montrer = async (pg, mobile) => {
  const b = await pg.evaluate(() => { const x = document.getElementById('vrm-badge').shadowRoot.querySelector('.btn').getBoundingClientRect(); return { x: x.left + x.width / 2, y: x.top + x.height / 2 }; });
  if (mobile) await pg.touchscreen.tap(b.x, b.y); else { await pg.mouse.move(5, 5); await pg.mouse.move(b.x, b.y); await pg.mouse.click(b.x, b.y); }
  await pg.waitForTimeout(400);
};


// 5.422 : l'état d'une programmation tel que le fond le rend (`atelierProgPour`).
const espaceL = { mode: 'aleatoire', min: 4, max: 8 };
const soir = (() => { const d = new Date(); d.setHours(20, 0, 0, 0); if (d.getTime() < Date.now() + 5 * 60000) d.setDate(d.getDate() + 1); return d.getTime(); })();
const PROG_ATTENTE = Object.assign({}, LISTES, { atelierProg: { id: 'p1', uid: '111', at: soir, etat: 'attente', ids: ['7004', '7001', '7007', '7002', '7005', '7008'], espacement: espaceL, lettre: false } });
const PROG_PAS = Object.assign({}, LISTES, { atelierProg: { id: 'p2', uid: '111', at: T0 - 50 * MIN, etat: 'pas-partie', code: 'ferme', ids: ['7004', '7001'], espacement: espaceL } });
const vis6 = (pg) => pg.evaluate(() => {
  const r = document.getElementById('vrm-badge').shadowRoot;
  const vis = (el) => !!(el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none');
  const carte = r.querySelector('.carte'); const cb = carte ? carte.getBoundingClientRect() : null;
  const sec = r.querySelector('[data-geste="atelier"]') || r.querySelector('[data-atelier-prog]');
  const petits = Array.from((sec || r).querySelectorAll('button, input[type="datetime-local"]')).filter(vis).map((b) => { const x = b.getBoundingClientRect(); return { t: (b.innerText || b.getAttribute('aria-label') || b.type || '').slice(0, 30), h: Math.round(x.height), w: Math.round(x.width), r: Math.round(x.right), l: Math.round(x.left) }; });
  return { petits: petits.filter((x) => x.h < 43.5 || (x.w < 43.5)), deborde: cb ? petits.filter((x) => x.r > cb.right + 1 || x.l < cb.left - 1) : [] };
});
const q6 = (pg, sel) => pg.evaluate((s) => { const e = document.getElementById('vrm-badge').shadowRoot.querySelector(s); return e ? { t: e.innerText || e.value || '', d: Object.assign({}, e.dataset), off: !!e.disabled } : null; }, sel);
const montrer6 = async (pg, sel) => pg.evaluate((s) => { const e = document.getElementById('vrm-badge').shadowRoot.querySelector(s); if (e) e.scrollIntoView({ block: 'center' }); }, sel);
// ══ La suite propre à ce banc (5.438) ══════════════════════════════════════
// Ce que le fond rendrait (le vrai fond est jugé par scripts/audit-ext-5438.cjs) — tout inventé.
const SANTE = { ok: true, ici: '111', v: 1, at: T0, comptes: [{ uid: '111', nom: 'shop_sophie', h: 12, maxH: 30, j: 40, maxJ: 200, complet: true, favH: 2, favJour: 6, favMaxH: 9,
  refus: { '403': 0, '429': 0, captcha: 2, pasvu: 0 }, dernierCaptcha: T0 - 2 * H, pauseJusqua: null, prudenceJusqua: null, arret: null, bloque: 'actif',
  sante: { etat: 'attention', raison: 'verification_recente', geste: 'ralentir' },
  note: { note: 70, pct: 60, points: [{ k: 'captcha', n24: 2, n72: 2, retire: 30 }], principal: { k: 'captcha', n24: 2, n72: 2, retire: 30 }, manque: ['vues'], at: T0 - 4 * MIN },
  cadence: { actionsHeure: 30, favorisHeure: 9, reglage: { actionsHeure: 50, favorisHeure: 15 }, reduite: true, par: ['note'], pctNote: 60 }, precieux: false,
  phrase: { cle: 'reduite', v: { cap: 30, fav: 9, note: 70 }, raison: { k: 'captcha', n: 2, h: 24 } } }] };
const SANTE_PREC = JSON.parse(JSON.stringify(SANTE)); Object.assign(SANTE_PREC.comptes[0], { precieux: true, cadence: { actionsHeure: 15, favorisHeure: 4, reglage: { actionsHeure: 50, favorisHeure: 15 }, reduite: true, par: ['note', 'precieux'], pctNote: 60 }, phrase: { cle: 'reduite_precieux', v: { cap: 15, fav: 4, note: 70 }, raison: { k: 'captcha', n: 2, h: 24 } } });
const MOD = { ok: true, uid: '111', liste: [{ k: 'masquee:7003:1', s: 'masquee', t: T0 - 3 * H, a: '7003', ti: 'Puma Suede bleues', ta: '42', r: '', c: '' }], revenues: [{ k: 'masquee:7005:1', s: 'masquee', t: T0 - 30 * H, f: T0 - 2 * H, a: '7005', ti: 'Asics Gel-Kayano 14 argent', ta: '41' }] };
const BILAN = { ok: true, relances: { envoyees: 6, ventes: 2, montant: 9500 }, relancesAuto: 4, sansAchat: 3, lots: { envoyes: 3, auto: 2 } };
const RELANCES = { ok: true, uid: '111', reglage: { actif: true, jours: 1, taux: 10, messages: [] }, liste: [
  { conv: '60001', acheteur: '9001', pseudo: 'acheteuse_1', item: '7001', titre: 'Adidas Samba OG noires 40', tx: '91', offre: 4000, etatOffre: 'acceptee', prix: 4000, etat: 'pret', raison: '', quand: T0 - H },
  { conv: '60002', acheteur: '9002', pseudo: 'acheteur_2', item: '7002', titre: 'New Balance 550 crème 41', tx: '92', offre: 3000, etatOffre: 'refusee', prix: 4400, etat: 'attente', raison: 'relire', quand: T0 + 5 * H },
  { conv: '60003', acheteur: '9003', pseudo: 'acheteur_3', item: '7004', titre: 'Nike Dunk Low Panda 43', tx: '93', offre: 2000, etatOffre: 'refusee', prix: null, etat: 'ecarte', raison: 'note_basse', quand: null }] };
const avecBleam = (b) => Object.assign({}, LISTES, { progVerif: [{ id: 'p1', titre: 'Nike Dunk Low Panda', nouvelId: '7009', aToi: true, prochaine: T0 + 30 * MIN, depuis: T0 - 25 * H, restants: 3 }] }, { automatisations: Object.assign({}, AUTO, { bleam: Object.assign({}, BLEAM, { lotFavoris: { actif: false, taux: 10 }, relanceOffres: { actif: true, jours: 1, taux: 10, messages: ['Bonjour {pseudo}, toujours partant à {prix} ?'] }, brouillonsAuto: { actif: false }, precieux: { actif: false }, agent: { actif: false } }, b) }) });
const REPS = (sante) => ({ santeCarte: sante, moderationCarte: MOD, bilanAuto: BILAN, relancesOffres: RELANCES });
(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  fs.mkdirSync(SORTIE, { recursive: true });
  const cap = async (pg, nom) => { try { await pg.screenshot({ path: path.join(SORTIE, nom + '.png') }); } catch (_) {} };
  const cibles = (pg, sel) => pg.evaluate((s) => { const r = document.getElementById('vrm-badge').shadowRoot; const z = r.querySelector(s); const cb = r.querySelector('.carte').getBoundingClientRect();
    return z ? Array.from(z.querySelectorAll('button, a.vu-btn')).filter((b) => b.getClientRects().length && getComputedStyle(b).visibility !== 'hidden').map((b) => { const x = b.getBoundingClientRect(); return { t: (b.innerText || '').trim().slice(0, 30), h: Math.round(x.height), w: Math.round(x.width), r: x.right, l: x.left, cr: cb.right, cl: cb.left }; }) : null; }, sel);
  try {
    for (const [largeur, hauteur, mobile, orion, schemes] of [[390, 844, true, true, ['light', 'dark']], [1512, 900, false, false, ['light']]]) for (const scheme of schemes) {
      const T = `${largeur}${orion ? ' Orion' : ''} ${scheme}`;
      const N = (k) => `${largeur}${orion ? '-orion' : ''}-${scheme}-${k}`;
      console.log(`\n${T}`);
      await essaie(T, async () => {
        const t = await ouvrir(nav, { scheme, largeur, hauteur, mobile, orion, L: avecBleam({}), reps: REPS(SANTE) });
        await montrer(t.pg, mobile);
        if (!mobile) await clic(t.pg, '[data-onglet-b="accueil"]');
        else { await clic(t.pg, '[data-onglet-b="accueil"]'); }
        await t.pg.waitForTimeout(300);
        const acc = await q6(t.pg, '[data-accueil-note]');
        dit(acc && acc.d.accueilNote === '70' && /70\/100/.test(acc.t) && /30\/h/.test(acc.t) && /vérification/.test(acc.t), `${T} : Accueil — « Note de santé · 70/100 · Cadence réduite à 30/h : 2 vérification(s) demandée(s) en 24 h »`, acc && acc.t);
        const rev = await q6(t.pg, '[data-moderation-revenue="7005"]');
        const gestes = await t.pg.evaluate(() => { const r = document.getElementById('vrm-badge').shadowRoot; return ['ouvrir', 'modifier', 'contacter'].map((k) => !!r.querySelector(`[data-moderation-${k}="7003"]`)); });
        dit(rev && /à nouveau visible|visible again/.test(rev.t) && gestes.every(Boolean), `${T} : Accueil — « Asics … est à nouveau visible » ; la masquée : Ouvrir · Modifier · Contacter Vinted`, JSON.stringify({ rev: rev && rev.t, gestes }));
        const pv = await q6(t.pg, '[data-prog-verif-etat="a-toi"]');
        dit(pv && /toujours en vérification|still under review/.test(pv.t) && /Reprendre la série|Resume the series/.test(pv.t), `${T} : la programmation d’avant en pause > 24 h : dite, « Reprendre la série »`, pv && pv.t);
        await clic(t.pg, '[data-prog-verif-reprendre="p1"]');
        const epv = await t.pg.evaluate(() => window.__envoyes.filter((m) => m.action === 'progVerifReprendre'));
        dit(epv.length === 1 && epv[0].id === 'p1' && epv[0].confirme === true, `${T} : SON toucher ⇒ progVerifReprendre(p1, confirmé)`, JSON.stringify(epv));
        await montrer6(t.pg, '[data-accueil-moderation]');
        await cap(t.pg, N('accueil'));
        // Santé
        if (mobile) await clic(t.pg, '[data-vx-plus]');
        await clic(t.pg, '[data-onglet-b="sante"]');
        await t.pg.waitForTimeout(300);
        const sn = await q6(t.pg, '[data-sante-note-compte]');
        const pt = await q6(t.pg, '[data-sante-point="captcha"]');
        const mq = await q6(t.pg, '[data-sante-manque="vues"]');
        dit(sn && sn.d.santeNoteCompte === '70' && sn.d.santeCap === '30' && pt && /−30/.test(pt.t) && /2 en 24 h|2 in 24 h/.test(pt.t) && mq && /pas comptées|not counted/.test(mq.t), `${T} : Santé — la note, le point « vérifications : 2 en 24 h · −30 », les vues « pas assez lues — pas comptées »`, JSON.stringify({ sn: sn && sn.t, pt: pt && pt.t }));
        await montrer6(t.pg, '[data-sante-note-compte]');
        await cap(t.pg, N('sante'));
        // Paramètres : compte précieux
        if (mobile) await clic(t.pg, '[data-vx-plus]');
        await clic(t.pg, '[data-onglet-b="parametres"]');
        await t.pg.waitForTimeout(300);
        const pr = await q6(t.pg, '[data-precieux]');
        dit(pr && pr.d.precieux === 'non' && /Compte précieux|Precious account/.test(pr.t) && /30\/h/.test(pr.t), `${T} : Paramètres — « Compte précieux » (éteint) et la cadence appliquée dite`, pr && pr.t.slice(0, 200));
        await clic(t.pg, '[data-pr-bascule]');
        await t.pg.waitForTimeout(300);
        const env = await t.pg.evaluate(() => window.__envoyes.filter((m) => m.action === 'reglageAuto' && m.cle === 'vinted_bleam' && m.valeur && m.valeur.section === 'precieux'));
        dit(env.length === 1 && env[0].valeur.valeur.actif === true && env[0].confirme !== true, `${T} : « Rendre ce compte précieux » part tout de suite (il protège : aucune question)`, JSON.stringify(env));
        await montrer6(t.pg, '[data-precieux]');
        const g = await cibles(t.pg, '[data-precieux]');
        dit(g && g.length && g.every((x) => x.h >= 44 && x.w >= 44 && x.r <= x.cr + 1 && x.l >= x.cl - 1), `${T} : l’interrupteur ≥ 44 px, dans la carte`, JSON.stringify(g));
        await cap(t.pg, N('parametres-precieux'));
        await t.ctx.close();
        // Précieux allumé : l'éteindre demande SA confirmation ; les automatisations le disent.
        const t2 = await ouvrir(nav, { scheme, largeur, hauteur, mobile, orion, L: avecBleam({ precieux: { actif: true } }), reps: REPS(SANTE_PREC) });
        await montrer(t2.pg, mobile);
        if (mobile) await clic(t2.pg, '[data-vx-plus]');
        await clic(t2.pg, '[data-onglet-b="parametres"]');
        await t2.pg.waitForTimeout(300);
        await clic(t2.pg, '[data-pr-bascule]');
        const cf = await q6(t2.pg, '[data-pr-confirme]');
        const env0 = await t2.pg.evaluate(() => window.__envoyes.filter((m) => m.action === 'reglageAuto' && m.valeur && m.valeur.section === 'precieux').length);
        dit(cf && /plus précieux|no longer precious/.test(cf.t) && env0 === 0, `${T} : l’éteindre ⇒ « Ce compte n’est plus précieux ? » d’abord, rien d’envoyé`, cf && cf.t);
        await montrer6(t2.pg, '[data-pr-confirme]');
        await cap(t2.pg, N('precieux-eteindre'));
        await clic(t2.pg, '[data-pr-oui]');
        const env1 = await t2.pg.evaluate(() => window.__envoyes.filter((m) => m.action === 'reglageAuto' && m.valeur && m.valeur.section === 'precieux'));
        dit(env1.length === 1 && env1[0].valeur.valeur.actif === false && env1[0].confirme === true, `${T} : SON « Oui » ⇒ éteint, confirmé`, JSON.stringify(env1));
        if (mobile) await clic(t2.pg, '[data-vx-plus]');
        await clic(t2.pg, '[data-onglet-b="automatisations"]');
        await clic(t2.pg, '[data-auto-choix="lot"]');
        await t2.pg.waitForTimeout(300);
        const lot = await q6(t2.pg, '[data-bm-section="lotFavoris"]');
        const bl = await q6(t2.pg, '[data-bilan="lot"]');
        dit(lot && /Proposer le lot seul|Offer the bundle/.test(lot.t) && /Bloqué sur ce compte|Blocked on this account/.test(lot.t) && bl && /3/.test(bl.t), `${T} : Automatisations → « Lot aux favoris » : l’interrupteur, « bloqué : compte précieux », le bilan`, lot && lot.t.slice(0, 160));
        await montrer6(t2.pg, '[data-bm-section="lotFavoris"]');
        await cap(t2.pg, N('auto-lot'));
        await clic(t2.pg, '[data-auto-choix="relance"]');
        await t2.pg.waitForFunction(() => !!document.getElementById('vrm-badge').shadowRoot.querySelector('[data-rel-ligne="60003:7004"]'), null, { timeout: 4000 }).catch(() => {});
        await t2.pg.waitForTimeout(200);
        const bi = await q6(t2.pg, '[data-bilan="relance"]');
        const rl = await q6(t2.pg, '[data-rel-ligne="60003:7004"]');
        dit(bi && /envoyées : 6 · ventes obtenues : 2|sent: 6 · sales won: 2/.test(bi.t) && /95 €/.test(bi.t) && rl && /1 étoile|1-star/.test(rl.t), `${T} : Relance — bilan « 6 relances · 2 ventes obtenues · 95 € », l’acheteur 1 étoile écarté et dit`, JSON.stringify({ bi: bi && bi.t, rl: rl && rl.t }));
        await montrer6(t2.pg, '[data-bilan="relance"]');
        await cap(t2.pg, N('auto-relance'));
        await clic(t2.pg, '[data-auto-choix="brouillons"]');
        await t2.pg.waitForTimeout(300);
        const br = await q6(t2.pg, '[data-bm-section="brouillonsAuto"]');
        dit(br && /brouillon Vinted|Vinted draft/.test(br.t) && /reste vide|stays empty/.test(br.t), `${T} : « Brouillons préparés seuls » : ce qui est fait, « ce que la fiche ne dit pas reste vide et est nommé »`, br && br.t.slice(0, 160));
        await cap(t2.pg, N('auto-brouillons'));
        dit(!t.erreurs.length && !t2.erreurs.length, `${T} : aucune erreur de page`, t.erreurs.concat(t2.erreurs).join(' | '));
        await t2.ctx.close();
      });
    }
  } finally { await nav.close(); }
  console.log(`\n${ko ? '❌' : '✅'} banc panneau-5438 : ${ok} vert(s), ${ko} rouge(s) — captures : ${SORTIE}`);
  process.exit(ko ? 1 : 0);
})();
