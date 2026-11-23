// ═════════════════════════════════════════════════════════════════
//  BANC « SAUVEGARDER / RESTAURER MES RÉGLAGES » — PARAMÈTRES DU PANNEAU (22 nov., ext. 5.435, choix 22 de Julien)
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
const SORTIE = process.env.BANC_CAPTURES ? path.join(process.env.BANC_CAPTURES, 'sauvegarde-reglages') : path.join(__dirname, 'captures', 'sauvegarde-reglages');

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
  }, { e: ETAT, js: BADGE, ui: UI, ap: APERCU, L });
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
// ══ La suite propre à ce banc ══════════════════════════════════════════════
// Le faux fond de « sauvegardeReglages » : `exporter` rend un fichier, `apercu` rend ce qui changerait, `restaurer` exige
// `confirme` et le jeton (le vrai fond est jugé par scripts/audit-sauvegarde-reglages.cjs).
const FICHIER = JSON.stringify({ format: 'vrm-reglages-extension', formatVersion: 1, extension: '5.435.0', cree: new Date().toISOString(), compteOnglet: '111', generaux: { vrm_seuil_prix: { seuil: 55 } }, comptes: { 111: { cadence: { actionsHeure: 60 } } } }, null, 2);
const APERCU_SR = { ok: true, jeton: 'j-banc', extension: '5.420.0', cree: new Date(T0 - 3 * J).toISOString(), memeVersion: false, compteOnglet: '111', compteFichier: '222', autres: ['222'], choix: {}, retires: 2,
  changements: [{ cle: 'vrm_seuil_prix', section: '', compte: '', avant: { x: 40 }, apres: { x: 55 }, allume: false },
    { cle: 'vinted_offres_paliers', section: '', compte: '', avant: { n: 4, actif: false }, apres: { n: 4, actif: true }, allume: true },
    { cle: 'vinted_cadence', section: 'cadence', compte: '111', avant: { n: 5, x: 50 }, apres: { n: 5, x: 60 }, allume: false },
    { cle: 'vinted_bleam', section: 'favMessages', compte: '111', avant: { n: 2 }, apres: { n: 4 }, allume: false },
    { cle: 'vinted_offre_refus_msg', section: '', compte: '', avant: { rien: true }, apres: { t: 'Merci pour ton offre, je ne peux pas descendre aussi bas.' }, allume: false }], refus: [] };
(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  fs.mkdirSync(SORTIE, { recursive: true });
  const cap = async (pg, nom) => { try { await pg.screenshot({ path: path.join(SORTIE, nom + '.png') }); } catch (_) {} };
  try {
    for (const [largeur, hauteur, mobile, orion] of [[390, 844, true, true], [1512, 900, false, false]]) for (const scheme of ['light', 'dark']) {
      const T = `${largeur}${orion ? ' Orion' : ''} ${scheme}`;
      const N = (k) => `${largeur}${orion ? '-orion' : ''}-${scheme}-${k}`;
      console.log(`\n${T}`);
      await essaie(T, async () => {
        const t = await ouvrir(nav, { scheme, largeur, hauteur, mobile, orion });
        await t.pg.evaluate(({ f, a }) => { window.__sr = (msg) => msg.quoi === 'exporter' ? { ok: true, nom: 'vrm-reglages-2026-11-22-1030.json', texte: f } : msg.quoi === 'apercu' ? Object.assign(JSON.parse(JSON.stringify(a)), { choix: msg.choix || {} }) : msg.quoi === 'restaurer' ? (msg.confirme === true && msg.jeton === 'j-banc' ? { ok: true, faits: 5, ecrits: 2, refus: [] } : { ok: false, code: 'confirmation', raison: 'Rien n’a changé : réponds « Oui » d’abord.' }) : { ok: true }; }, { f: FICHIER, a: APERCU_SR });
        const tele = [];
        t.ctx.on('page', () => {});
        t.pg.on('download', (d) => tele.push(d.suggestedFilename()));
        await montrer(t.pg, mobile);
        if (mobile) { await clic(t.pg, '[data-vx-plus]'); }
        await clic(t.pg, '[data-onglet-b="parametres"]');
        const sec = await q6(t.pg, '[data-sauvegarde-reglages]');
        dit(sec && /Sauvegarde de mes réglages|Backup of my settings/.test(sec.t) && /Jamais de mot de passe|Never a password/.test(sec.t), `${T} : Paramètres → « Sauvegarde de mes réglages », la promesse « jamais de mot de passe, jeton, cookie… »`, sec && sec.t.slice(0, 160));
        await montrer6(t.pg, '[data-sauvegarde-reglages]');
        await cap(t.pg, N('parametres-sauvegarde'));
        const g0 = await t.pg.evaluate(() => { const r = document.getElementById('vrm-badge').shadowRoot; const s = r.querySelector('[data-sauvegarde-reglages]'); const cb = r.querySelector('.carte').getBoundingClientRect();
          return Array.from(s.querySelectorAll('button, label.vu-btn')).filter((b) => b.getClientRects().length).map((b) => { const x = b.getBoundingClientRect(); return { t: b.innerText.trim().slice(0, 30), h: Math.round(x.height), w: Math.round(x.width), r: x.right, l: x.left, cr: cb.right, cl: cb.left }; }); });
        dit(g0.length >= 2 && g0.every((x) => x.h >= 44 && x.w >= 44 && x.r <= x.cr + 1 && x.l >= x.cl - 1), `${T} : « Sauvegarder » et « Restaurer… » : cibles ≥ 44 px, rien ne déborde`, JSON.stringify(g0));
        // « Sauvegarder » : le fichier part (téléchargement), l'état le dit.
        await clic(t.pg, '[data-sr-sauver]');
        await t.pg.waitForTimeout(500);
        const e1 = await q6(t.pg, '[data-sr-etat]');
        const env = async (q) => (await t.pg.evaluate(() => window.__envoyes)).filter((m) => m.action === 'sauvegardeReglages' && (!q || m.quoi === q));
        dit((await env('exporter')).length === 1 && e1 && e1.d.srEtat === 'ok' && /vrm-reglages-2026-11-22-1030\.json/.test(e1.t) && tele.includes('vrm-reglages-2026-11-22-1030.json'), `${T} : « Sauvegarder mes réglages » ⇒ le fichier daté est téléchargé, c’est dit`, JSON.stringify({ e1, tele }));
        // « Restaurer » : le fichier choisi est lu, l'aperçu montre avant → après ; RIEN n'est écrit avant « Oui ».
        await t.pg.evaluate((f) => { const i = document.getElementById('vrm-badge').shadowRoot.querySelector('[data-sr-fichier]'); const dt = new DataTransfer(); dt.items.add(new File([f], 'vrm-reglages.json', { type: 'application/json' })); i.files = dt.files; i.dispatchEvent(new Event('change')); }, FICHIER);
        await t.pg.waitForTimeout(500);
        const ap = await q6(t.pg, '[data-sr-apercu]');
        const lignes = await t.pg.evaluate(() => Array.from(document.getElementById('vrm-badge').shadowRoot.querySelectorAll('[data-sr-ligne]')).map((l) => ({ k: l.getAttribute('data-sr-ligne'), t: l.innerText.replace(/\s+/g, ' ').trim(), allume: l.hasAttribute('data-sr-allume') })));
        dit(ap && ap.d.srApercu === '5' && /Remplacer 5 réglages|Replace 5 settings/.test(ap.t) && lignes.length === 5, `${T} : l’aperçu : « Remplacer 5 réglages par ceux du fichier ? », une ligne par réglage`, JSON.stringify(lignes).slice(0, 300));
        dit(lignes.some((l) => l.k === 'vrm_seuil_prix' && /40 → 55/.test(l.t)) && lignes.some((l) => l.k === 'vinted_cadence:cadence@111' && /50 → 60/.test(l.t) && /compte 111|account 111/.test(l.t)), `${T} : avant → après, le compte nommé`, JSON.stringify(lignes));
        dit(lignes.some((l) => l.k === 'vinted_offres_paliers' && l.allume && /S’allume|Turns on/.test(l.t)), `${T} : un réglage qui s’allume est marqué « S’allume » (ambre)`, JSON.stringify(lignes.filter((l) => l.allume)));
        const ver = await q6(t.pg, '[data-sr-version]');
        dit(ver && ver.d.srVersion === 'autre' && /5\.420\.0/.test(ver.t), `${T} : une autre version compatible est DITE`, ver && ver.t);
        const au = await q6(t.pg, '[data-sr-autre="222"]');
        dit(au && /222/.test(au.t), `${T} : les réglages d’un autre compte : une case, décochée (rien sans son choix)`, au && au.t);
        dit(!(await env('restaurer')).length, `${T} : rien n’est écrit pendant l’aperçu`);
        await montrer6(t.pg, '[data-sr-apercu]');
        await cap(t.pg, N('restaurer-apercu'));
        const g1 = await t.pg.evaluate(() => { const r = document.getElementById('vrm-badge').shadowRoot; const s = r.querySelector('[data-sr-apercu]'); const cb = r.querySelector('.carte').getBoundingClientRect();
          return Array.from(s.querySelectorAll('button')).filter((b) => b.getClientRects().length).map((b) => { const x = b.getBoundingClientRect(); return { t: b.innerText.trim(), h: Math.round(x.height), w: Math.round(x.width), r: x.right, cr: cb.right }; }); });
        dit(g1.length === 2 && g1.every((x) => x.h >= 44 && x.w >= 44 && x.r <= x.cr + 1), `${T} : « Non » / « Oui, remplacer » ≥ 44 px, dans la carte`, JSON.stringify(g1));
        // SON choix pour l'autre compte : l'aperçu est redemandé avec la case.
        await t.pg.evaluate(() => { const c = document.getElementById('vrm-badge').shadowRoot.querySelector('[data-sr-choix="222"]'); c.checked = true; c.dispatchEvent(new Event('change')); });
        await t.pg.waitForTimeout(300);
        const ap2 = await env('apercu');
        dit(ap2.length === 2 && ap2[1].choix && ap2[1].choix['222'] === true && ap2[1].texte === FICHIER, `${T} : cocher l’autre compte redemande l’aperçu avec SON choix (même fichier)`, JSON.stringify(ap2.map((m) => m.choix)));
        // « Oui » ⇒ restaurer, confirmé, avec le jeton de l'aperçu.
        await clic(t.pg, '[data-sr-oui]');
        await t.pg.waitForTimeout(300);
        const rs = await env('restaurer');
        const e2 = await q6(t.pg, '[data-sr-etat]');
        dit(rs.length === 1 && rs[0].confirme === true && rs[0].jeton === 'j-banc' && e2 && /5 réglages restaurés|5 settings restored/.test(e2.t), `${T} : SON « Oui » ⇒ restaurer (confirmé, jeton de l’aperçu), « 5 réglages restaurés. »`, JSON.stringify({ rs, e2 }));
        await montrer6(t.pg, '[data-sauvegarde-reglages]');
        await cap(t.pg, N('restaure'));
        // « Non » : rien n'est écrit, c'est dit.
        await t.pg.evaluate((f) => { const i = document.getElementById('vrm-badge').shadowRoot.querySelector('[data-sr-fichier]'); const dt = new DataTransfer(); dt.items.add(new File([f], 'x.json', { type: 'application/json' })); i.files = dt.files; i.dispatchEvent(new Event('change')); }, FICHIER);
        await t.pg.waitForTimeout(400);
        await clic(t.pg, '[data-sr-non]');
        const e3 = await q6(t.pg, '[data-sr-etat]');
        dit((await env('restaurer')).length === 1 && (await env('annuler')).length === 1 && e3 && /Rien n’a changé|Nothing changed/.test(e3.t), `${T} : « Non » ⇒ rien d’écrit, « Rien n’a changé. »`, JSON.stringify(e3));
        dit(!t.erreurs.length, `${T} : aucune erreur de page`, t.erreurs.join(' | '));
        await t.ctx.close();
      });
    }
  } finally { await nav.close(); }
  console.log(`\n${ko ? '❌' : '✅'} banc sauvegarde-reglages : ${ok} vert(s), ${ko} rouge(s) — captures : ${SORTIE}`);
  process.exit(ko ? 1 : 0);
})();
