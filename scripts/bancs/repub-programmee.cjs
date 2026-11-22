// ════════════════════════════════════════════════════════════════════════
//  BANC « LANCER MAINTENANT » OU « PROGRAMMER À … » — L'ATELIER REPUBLIER DU PANNEAU (21 nov., ext. 5.422)
//
//  Julien, 21 nov. : « après que j'ai choisi les paires, l'ordre et l'espacement, un choix "Lancer maintenant" ou
//  "Programmer à …" (date et heure que je tape) ; confirmation claire "Republier 6 paires ce soir à 20:00, espacées de
//  4 à 8 min" ; annulable à tout moment ». Le VRAI vrm-badge.js + vrm-ui.js sur une FAUSSE page vinted.fr (le faux
//  `chrome` du banc grand-panneau, repris tel quel) ; le départ lui-même est jugé sur le vrai fond par
//  scripts/audit-repub-programmee.cjs. On juge : le choix « Quand », le champ date et heure, la phrase AVANT de
//  confirmer, rien ne part avant SON « Confirmer », `atelierProgrammer` porte SES paires / SON ordre / SON espacement /
//  SON heure ; une heure impossible est dite ; la programmation en attente (phrase, « Annuler la programmation ») ;
//  « Pas partie » (raison, « Relancer maintenant », « Effacer ») ; cibles 44 px, rien ne déborde, aucune erreur.
//  390 Orion clair et sombre d'abord, puis 1512 clair et sombre. `BANC_EXT=<arbre d'avant>` : rouge attendu.
//  Tout est inventé (dépôt public).
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
const SORTIE = process.env.BANC_CAPTURES ? path.join(process.env.BANC_CAPTURES, 'repub-programmee') : path.join(__dirname, 'captures', 'repub-programmee');

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
        await montrer(t.pg, mobile);
        await clic(t.pg, '[data-onglet-b="annonces"]');
        const coche = async (ids) => t.pg.evaluate((ids) => { const r = document.getElementById('vrm-badge').shadowRoot; for (const c of r.querySelectorAll('[data-ann-sel]')) { const v = ids.includes(c.getAttribute('data-ann-sel')); if (c.checked !== v) { c.checked = v; c.dispatchEvent(new Event('change')); } } }, ids);
        const action = async (k) => { await t.pg.evaluate((k) => { const s2 = document.getElementById('vrm-badge').shadowRoot.querySelector('[data-ann-action]'); s2.value = k; s2.dispatchEvent(new Event('change')); }, k); await t.pg.waitForTimeout(220); };
        const env = async (k) => (await t.pg.evaluate(() => window.__envoyes)).filter((m) => m.action === k);
        await coche(['7002', '7004', '7007']); await t.pg.waitForTimeout(150);
        await action('republier'); await t.pg.waitForTimeout(250);
        const q0 = await q6(t.pg, '[data-atelier-quand]');
        const l0 = await q6(t.pg, '[data-atelier-lancer]');
        dit(q0 && q0.d.atelierQuand === 'maintenant' && l0 && /^(Lancer|Start|Voir l’avant / après)$/.test(l0.t.trim())   /* (22 nov.) 5.423 : « Maintenant » ouvre d'abord l'avant / après, puis « Lancer » (arbitrage de la 5.433) */, `${T} : l’atelier s’ouvre sur « Lancer maintenant » (Lancer)`, JSON.stringify([q0, l0]));
        await clic(t.pg, '[data-atelier-quand-choix="programmer"]');
        const h1 = await q6(t.pg, '[data-atelier-at]');
        const l1 = await q6(t.pg, '[data-atelier-lancer]');
        dit(h1 && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(h1.t) && l1 && /Programmer|Schedule/.test(l1.t), `${T} : « Programmer à… » : le champ date et heure (pré-rempli, modifiable), le bouton « Programmer »`, JSON.stringify([h1, l1]));
        // SON heure : ce soir 20:00 (ou demain si 20:00 est passé).
        const val = await t.pg.evaluate((ms) => { const d = new Date(ms); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; }, soir);
        await t.pg.evaluate((v) => { const c = document.getElementById('vrm-badge').shadowRoot.querySelector('[data-atelier-at]'); c.value = v; c.dispatchEvent(new Event('input')); c.dispatchEvent(new Event('change')); }, val);
        await t.pg.waitForTimeout(150);
        await montrer6(t.pg, '[data-atelier-quand]');
        await cap(t.pg, N('atelier-programmer'));
        await clic(t.pg, '[data-atelier-lancer]');
        const c1 = await q6(t.pg, '[data-atelier-prog-confirme]');
        const avant = (await env('atelierProgrammer')).length + (await env('atelierLancer')).length;
        const ceSoir = new Date(soir).toDateString() === new Date().toDateString();
        dit(c1 && new RegExp(`^(Republier 3 paires ${ceSoir ? 'ce soir' : 'demain'} à 20:00, espacées de 3 à 8 min \\?|Relist 3 pairs ${ceSoir ? 'tonight' : 'tomorrow'} at 20:00, 3 to 8 min apart\\?)`).test(c1.t.replace(/\s+/g, ' ').trim()) && avant === 0, `${T} : la phrase AVANT : « Republier 3 paires ${ceSoir ? 'ce soir' : 'demain'} à 20:00, espacées de 3 à 8 min ? » — rien n’est parti`, JSON.stringify([c1, avant]));
        await montrer6(t.pg, '[data-atelier-prog-confirme]');
        await cap(t.pg, N('atelier-confirmation'));
        const g1 = await vis6(t.pg);
        dit(!g1.petits.length && !g1.deborde.length, `${T} : cibles ≥ 44 px, rien ne déborde`, JSON.stringify(g1));
        await clic(t.pg, '[data-atelier-prog-oui]');
        const pr = await env('atelierProgrammer');
        dit(pr.length === 1 && pr[0].confirme === true && pr[0].at === soir && pr[0].ids.join(',') === '7002,7004,7007' && pr[0].espacement.mode === 'aleatoire' && pr[0].espacement.min === 3 && pr[0].espacement.max === 8 && !(await env('atelierLancer')).length,
          `${T} : SON « Confirmer » ⇒ atelierProgrammer (SES paires, SON ordre, SON espacement, SON heure), jamais « Lancer »`, JSON.stringify(pr));
        // Heure impossible ⇒ dit, rien ne part.
        await coche(['7002']); await t.pg.waitForTimeout(120); await action('republier'); await t.pg.waitForTimeout(200);
        await clic(t.pg, '[data-atelier-quand-choix="programmer"]');
        await t.pg.evaluate(() => { const c = document.getElementById('vrm-badge').shadowRoot.querySelector('[data-atelier-at]'); const d = new Date(Date.now() - 3600e3); const p = (n) => String(n).padStart(2, '0'); c.value = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; c.dispatchEvent(new Event('input')); });
        await clic(t.pg, '[data-atelier-lancer]');
        const e1 = await q6(t.pg, '[data-geste-etat]');
        dit(e1 && /2 min|7/.test(e1.t) && !(await q6(t.pg, '[data-atelier-prog-confirme]')) && (await env('atelierProgrammer')).length === 1, `${T} : une heure passée ⇒ « Choisis une heure au moins 2 min plus tard… », aucune confirmation, rien ne part`, JSON.stringify(e1));
        await clic(t.pg, '[data-geste-fermer]');
        await t.ctx.close();

        // La programmation en attente : la phrase et « Annuler la programmation ».
        const t2 = await ouvrir(nav, { scheme, largeur, hauteur, mobile, orion, L: PROG_ATTENTE });
        await montrer(t2.pg, mobile); await clic(t2.pg, '[data-onglet-b="annonces"]');
        const pa = await q6(t2.pg, '[data-atelier-prog="attente"]');
        dit(pa && new RegExp(`(6 paires ${ceSoir ? 'ce soir' : 'demain'} à 20:00, espacées de 4 à 8 min, dans ton ordre|6 pairs ${ceSoir ? 'tonight' : 'tomorrow'} at 20:00)`).test(pa.t.replace(/\s+/g, ' ')) && /Annuler la programmation|Cancel the schedule/.test(pa.t), `${T} : « Republication programmée · 6 paires ${ceSoir ? 'ce soir' : 'demain'} à 20:00, espacées de 4 à 8 min » + « Annuler la programmation »`, JSON.stringify(pa && pa.t));
        await montrer6(t2.pg, '[data-atelier-prog]');
        await cap(t2.pg, N('programmee'));
        const g2 = await vis6(t2.pg);
        dit(!g2.petits.length && !g2.deborde.length, `${T} : programmée : cibles ≥ 44 px, rien ne déborde`, JSON.stringify(g2));
        await clic(t2.pg, '[data-atelier-prog-annuler]');
        const an = (await t2.pg.evaluate(() => window.__envoyes)).filter((m) => m.action === 'atelierProgAnnuler');
        dit(an.length === 1, `${T} : « Annuler la programmation » ⇒ atelierProgAnnuler`, JSON.stringify(an));
        await t2.ctx.close();

        // Pas partie : la raison, « Relancer maintenant » (SON toucher), « Effacer ».
        const t3 = await ouvrir(nav, { scheme, largeur, hauteur, mobile, orion, L: PROG_PAS });
        await montrer(t3.pg, mobile); await clic(t3.pg, '[data-onglet-b="annonces"]');
        const pp = await q6(t3.pg, '[data-atelier-prog="pas-partie"]');
        dit(pp && /Pas partie|Did not start/.test(pp.t) && /navigateur était fermé|browser was closed/.test(pp.t) && /Relancer maintenant|Start again now/.test(pp.t) && /Effacer|Clear/.test(pp.t), `${T} : « Pas partie … » : « Le navigateur était fermé… », « Relancer maintenant », « Effacer »`, JSON.stringify(pp && pp.t));
        await montrer6(t3.pg, '[data-atelier-prog]');
        await cap(t3.pg, N('pas-partie'));
        const g3 = await vis6(t3.pg);
        dit(!g3.petits.length && !g3.deborde.length, `${T} : pas partie : cibles ≥ 44 px, rien ne déborde`, JSON.stringify(g3));
        await clic(t3.pg, '[data-atelier-prog-relancer]');
        const rl = (await t3.pg.evaluate(() => window.__envoyes)).filter((m) => m.action === 'atelierProgRelancer');
        dit(rl.length === 1 && rl[0].confirme === true, `${T} : « Relancer maintenant » ⇒ atelierProgRelancer, confirmé par SON toucher`, JSON.stringify(rl));
        dit(!t.erreurs.length && !t2.erreurs.length && !t3.erreurs.length, `${T} : aucune erreur de page`, JSON.stringify([...t.erreurs, ...t2.erreurs, ...t3.erreurs]));
        await t3.ctx.close();
      });
    }
  } finally { await nav.close(); }
  console.log(`\n${ko ? '❌' : '✅'} banc repub-programmee : ${ok} vert(s), ${ko} rouge(s) — captures : ${SORTIE}`);
  process.exit(ko ? 1 : 0);
})();
