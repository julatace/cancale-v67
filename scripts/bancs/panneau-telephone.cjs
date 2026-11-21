// ════════════════════════════════════════════════════════════════════════
//  BANC « LE PANNEAU AU TÉLÉPHONE » (21 nov., ext. 5.413)
//
//  Julien, 21 nov., trois photos du panneau d'un outil concurrent à l'ordinateur : « je veux que ce soit dans ce
//  style-là, surtout sur le téléphone ; fais ça pour l'extension déjà ». Il utilise Orion (iPhone, extensions Chrome).
//  Le VRAI vrm-badge.js + vrm-ui.js sur une fausse page vinted.fr (le faux `chrome` et les données INVENTÉES de
//  grand-panneau.cjs, titres longs en plus). Chaque page du panneau, à 390 × 844 au doigt (agent d'Orion ; WebKit de
//  Playwright aussi s'il est installé) et à 1512 px. On mesure (data-* et géométrie, jamais un libellé seul) :
//   · aucun débordement horizontal (page, panneau, corps, chaque rangée : scrollWidth ≤ clientWidth) ;
//   · chaque cible visible ≥ 44 px ; les champs ≥ 16 px (Safari / Orion ne zooment pas) ;
//   · au téléphone : barre du bas = 5 onglets égaux (Accueil · Articles · Commandes · Messagerie · Plus), « Plus » ⇒
//     feuille du bas avec les 4 autres ; « Mis à jour … » dit en clair ; rangées empilées (vignette 48, titre COMPLET,
//     méta « prix · date · étiquette » sans libellés) ; le menu Statut est une feuille du bas ;
//   · à l'ordinateur : la barre latérale de 232 px et ses neuf entrées (5.420 : Santé), les en-têtes de colonnes — rien ne régresse.
//  `BANC_EXT=<arbre d'avant>/vinted-sync-extension` : la 5.410.8 (rouge attendu au téléphone, vert à 1512).
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
const SORTIE = process.env.BANC_CAPTURES ? path.join(process.env.BANC_CAPTURES, 'panneau-telephone') : path.join(__dirname, 'captures', 'panneau-telephone');

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
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGO4eechAAUoApeWrujeAAAAAElFTkSuQmCC', 'base64');

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

// ── 5.413 : des titres LONGS (comme ceux de Julien : « … taille 42,5 ») — un titre complet ne doit jamais être coupé.
ANN[0].titre = 'Nike Air Max 1 Travis Scott Baroque Brown cuir et daim taille 42,5';
ANN[1].titre = 'Adidas Handball Spezial bleu marine semelle gomme taille 40';
TOUTES[0].titre = ANN[0].titre; TOUTES[1].titre = ANN[1].titre;
VEN[0].titre = 'Nike Zoom Vaporfly Next% 4 blanc et orange taille 41'; VEN[1].titre = 'Salomon XT-6 gris clair Advanced taille 44,5';

const mesurer = (pg) => pg.evaluate(() => {
  const r = document.getElementById('vrm-badge').shadowRoot, q = (s) => r.querySelector(s);
  const vis = (el) => { if (!el || !el.getClientRects().length) return false; const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') return false; const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0 && b.bottom > 0 && b.top < innerHeight && b.right > 0 && b.left < innerWidth; };
  const rect = (el) => { const b = el.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height), r: Math.round(b.right), b: Math.round(b.bottom) }; };
  const carte = q('.carte');
  // Débordement horizontal : la page, le panneau, le corps, chaque rangée (la barre d'outils qui DÉFILE exprès est exclue).
  const debords = [];
  const boites = [document.documentElement, carte, q('.main6'), q('.corps6'), ...r.querySelectorAll('.corps6 .table6, .corps6 .table5, .corps6 .rangs > li, .corps6 .tr6, .corps6 .acc6, .corps6 .au6, .corps6 .geste6')];
  for (const el of boites) if (el && vis(el) && el.scrollWidth > el.clientWidth + 1) debords.push((el.className || el.tagName) + ':' + el.scrollWidth + '>' + el.clientWidth);
  // Cibles : chaque contrôle VISIBLE (bouton, lien, liste, menu) ≥ 44 px de haut ; une case se touche par son label.
  const petits = [];
  for (const el of r.querySelectorAll('.carte button, .carte a[href], .carte select, .carte summary, .carte input')) {
    if (!vis(el)) continue;
    const cible = el.matches('input[type=checkbox], input[type=radio]') ? (el.closest('label') || el) : el;
    if (el.matches('input[type=range]')) continue;
    const b = cible.getBoundingClientRect();
    if (b.height < 43.5 || b.width < 43.5) petits.push((el.className || el.tagName) + ':' + Math.round(b.width) + 'x' + Math.round(b.height) + ':' + (el.innerText || el.getAttribute('aria-label') || '').slice(0, 18));
  }
  // Titres : complets (aucune coupe, ni « … », ni ligne cachée).
  const coupes = [];
  for (const ti of r.querySelectorAll('.corps6 .art6 .ti')) if (vis(ti) && (ti.scrollHeight > ti.clientHeight + 1 || ti.scrollWidth > ti.clientWidth + 1 || getComputedStyle(ti).textOverflow === 'ellipsis' && getComputedStyle(ti).whiteSpace === 'nowrap')) coupes.push(ti.innerText.slice(0, 40));
  // Les champs : 16 px au moins (Safari / Orion zooment sous 16 px).
  const champs = Array.from(r.querySelectorAll('.carte input:not([type=checkbox]):not([type=radio]):not([type=range]), .carte select, .carte textarea')).filter(vis).map((el) => parseFloat(getComputedStyle(el).fontSize));
  // Libellés devant les valeurs de la ligne méta (« Prix », « Date », « Statut »…) : visibles ?
  const libelles = Array.from(r.querySelectorAll('.corps6 .tr6 .cel6[data-col="prix"] .lc5, .corps6 .tr6 .cel6[data-col="date"] .lc5, .corps6 .tr6 .cel6[data-col="statut"] .lc5')).filter(vis).length;
  const barre = Array.from(r.querySelectorAll('.side6 .nav6')).filter(vis).map((b) => ({ k: b.getAttribute('data-onglet-b') || (b.hasAttribute('data-vx-plus') ? 'plus' : '?'), ...rect(b) }));
  const maj = q('[data-vx-maj]'); const majTxt = maj ? Array.from(maj.querySelectorAll('span')).filter(vis).map((s) => s.innerText).join('') : '';
  const premiere = q('.corps6 .table6 .rangs > li');
  const rangee = premiere ? (() => { const v = premiere.querySelector('.vig'), ti = premiere.querySelector('.ti'), c = premiere.querySelector('.cels6'), c1 = premiere.querySelector('.cel6[data-col="prix"]'); return { vig: v ? rect(v) : null, ti: ti ? rect(ti) : null, meta: c1 ? rect(c1) : null, texteMeta: c ? c.innerText.replace(/\s+/g, ' ').trim() : '', sepDate: (() => { const d = premiere.querySelector('.cel6[data-col="date"]'); return d ? getComputedStyle(d, '::before').content : ''; })(),
    ligne1: (() => { const p = premiere.querySelector('.cel6[data-col="prix"]'), d = premiere.querySelector('.cel6[data-col="date"]'), st = premiere.querySelector('.cel6[data-col="statut"]'); return p && d && st ? Math.abs(p.getBoundingClientRect().top - d.getBoundingClientRect().top) < 2 && Math.abs(d.getBoundingClientRect().top - st.getBoundingClientRect().top) < 4 : false; })() }; })() : null;
  return { page: q('[data-vx]') && q('[data-vx]').getAttribute('data-page'), carte: carte ? rect(carte) : null, side: q('.side6') ? rect(q('.side6')) : null,
    debords, petits, coupes, champs, libelles, barre, majTxt, rangee, enTete: !!(q('.th6r') && vis(q('.th6r'))), plusVisible: vis(q('[data-vx-plus]')),
    feuillePlus: q('[data-vx-plus-feuille]') && vis(q('[data-vx-plus-feuille] .nav6')) ? rect(q('[data-vx-plus-feuille]')) : null };
});
const clic = async (pg, sel) => { await pg.evaluate((s) => { const b = document.getElementById('vrm-badge').shadowRoot.querySelector(s); if (b) b.click(); }, sel); await pg.waitForTimeout(260); };
const toucher = async (pg, sel) => { const b = await pg.evaluate((s) => { const el = document.getElementById('vrm-badge').shadowRoot.querySelector(s); if (!el) return null; const x = el.getBoundingClientRect(); return { x: x.left + x.width / 2, y: x.top + x.height / 2 }; }, sel); if (b) { await pg.touchscreen.tap(b.x, b.y); await pg.waitForTimeout(300); } return !!b; };
const montrer = async (pg, mobile) => {
  const b = await pg.evaluate(() => { const x = document.getElementById('vrm-badge').shadowRoot.querySelector('.btn').getBoundingClientRect(); return { x: x.left + x.width / 2, y: x.top + x.height / 2 }; });
  if (mobile) await pg.touchscreen.tap(b.x, b.y); else { await pg.mouse.move(5, 5); await pg.mouse.move(b.x, b.y); await pg.mouse.click(b.x, b.y); }
  await pg.waitForTimeout(400);
};
const PAGES = ['accueil', 'annonces', 'ventes', 'messages', 'favoris', 'notifications', 'automatisations', 'sante', 'parametres'];

(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  let navWk = null;
  try { navWk = await require('playwright').webkit.launch(); } catch (_) { navWk = null; }
  console.log(navWk ? 'WebKit de Playwright : présent, joué aussi.' : 'WebKit de Playwright : absent ici (téléchargement refusé) — Chromium avec l’agent d’Orion sur iPhone.');
  fs.mkdirSync(SORTIE, { recursive: true });
  const cap = async (pg, nom) => { try { await pg.screenshot({ path: path.join(SORTIE, nom + '.png') }); } catch (_) {} };
  const jeux = [['390 Orion', { largeur: 390, hauteur: 844, mobile: true, orion: true }, nav], ['390 sombre', { largeur: 390, hauteur: 844, mobile: true, scheme: 'dark' }, nav], ['1512', { largeur: 1512, hauteur: 900 }, nav]];
  if (navWk) jeux.splice(1, 0, ['390 WebKit', { largeur: 390, hauteur: 844, mobile: true, orion: true }, navWk]);
  try {
    for (const [T, o, n] of jeux) {
      console.log(`\n${T}`);
      await essaie(T, async () => {
        const t = await ouvrir(n, Object.assign({ scheme: 'light' }, o));
        await montrer(t.pg, o.mobile);
        const N = (k) => `${T.replace(/\s+/g, '-').toLowerCase()}-${k}`;
        for (const p of PAGES) {
          if (o.mobile && ['favoris', 'notifications', 'automatisations', 'sante', 'parametres'].includes(p)) {
            // Au téléphone : « Plus » ⇒ la feuille du bas ⇒ la page.
            await toucher(t.pg, '[data-vx-plus]');
            const f = await mesurer(t.pg);
            if (p === 'favoris') { await cap(t.pg, N('plus')); dit(f.feuillePlus && f.feuillePlus.b <= 844 && f.feuillePlus.w >= 389 && f.barre.filter((b) => ['favoris', 'notifications', 'automatisations', 'parametres'].includes(b.k)).length === 4, `${T} : « Plus » ouvre une feuille du bas pleine largeur avec Favoris · Notifications · Automatisations · Paramètres`, JSON.stringify(f.feuillePlus)); }
            await toucher(t.pg, `[data-vx-plus-feuille] [data-onglet-b="${p}"]`);
          } else await clic(t.pg, `.side6 [data-onglet-b="${p}"]`);
          await t.pg.waitForTimeout(250);
          const m = await mesurer(t.pg);
          await cap(t.pg, N(p));
          dit(m.page === p, `${T} · ${p} : la page s’ouvre`, m.page);
          dit(!m.debords.length, `${T} · ${p} : aucun débordement horizontal (scrollWidth ≤ clientWidth)`, m.debords.slice(0, 4).join(' | '));
          dit(!m.petits.length, `${T} · ${p} : chaque cible visible ≥ 44 px`, m.petits.slice(0, 6).join(' | '));
          if (o.mobile) {
            dit(!m.coupes.length, `${T} · ${p} : titres complets (jamais coupés)`, m.coupes.slice(0, 3).join(' | '));
            dit(m.champs.every((x) => x >= 16), `${T} · ${p} : champs ≥ 16 px (pas de zoom à la saisie)`, JSON.stringify(m.champs));
            dit(m.feuillePlus === null, `${T} · ${p} : la feuille « Plus » se referme en arrivant`);
            const b5 = m.barre.map((b) => b.k);
            dit(b5.join(',') === 'accueil,annonces,ventes,messages,plus' && m.barre.every((b) => b.x >= 0 && b.r <= 391 && b.h >= 44 && Math.abs(b.w - m.barre[0].w) <= 1) && m.side && m.side.b >= 843, `${T} · ${p} : barre du bas = cinq onglets ÉGAUX, tous dans l’écran`, JSON.stringify(m.barre.map((b) => b.k + ':' + b.x + '+' + b.w)));
            dit(/Mis à jour|Mettre à jour/.test(m.majTxt), `${T} · ${p} : « Mis à jour … » dit en clair sous le titre`, m.majTxt);
            if (p === 'annonces' || p === 'ventes') {
              dit(m.libelles === 0 && !m.enTete, `${T} · ${p} : rangées empilées, ligne méta sans libellés (prix · date · étiquette)`, `libellés visibles ${m.libelles}`);
              const g = m.rangee;
              dit(g && g.vig && g.vig.w === 48 && g.ti && g.meta && g.meta.y >= g.ti.y && g.meta.x >= g.ti.x - 1 && /€/.test(g.texteMeta) && /·/.test(g.sepDate) && g.ligne1, `${T} · ${p} : vignette 48 px, titre à côté, méta « prix · date · étiquette » sur UNE ligne dessous`, JSON.stringify(g));
              await clic(t.pg, p === 'annonces' ? '[data-ann-statut-menu] > summary' : '[data-ven-statut-menu] > summary');
              const s = await t.pg.evaluate(() => { const l = document.getElementById('vrm-badge').shadowRoot.querySelector('details.cols5[open] > .cols5-l'); if (!l) return null; const b = l.getBoundingClientRect(); return { b: Math.round(b.bottom), w: Math.round(b.width), x: Math.round(b.left) }; });
              await cap(t.pg, N(p + '-statut'));
              dit(s && s.b >= 843 && s.w >= 389 && s.x === 0, `${T} · ${p} : le menu Statut est une feuille du bas`, JSON.stringify(s));
              await clic(t.pg, 'details.cols5[open] > summary');
            }
          } else {
            dit(m.side && m.side.w >= 220 && m.side.w <= 240 && m.barre.length === 9 && !m.plusVisible, `${T} · ${p} : barre latérale inchangée (232 px, neuf entrées, Santé comprise (5.420), pas de « Plus »)`, JSON.stringify([m.side, m.barre.length, m.plusVisible]));
            if (p === 'annonces' || p === 'ventes') dit(m.enTete && m.libelles === 0, `${T} · ${p} : le tableau garde ses en-têtes de colonnes`, JSON.stringify([m.enTete, m.libelles]));
          }
        }
        dit(!t.erreurs.length, `${T} : aucune erreur de page`, t.erreurs.join(' | '));
        await t.ctx.close();
      });
    }
  } finally { await nav.close(); if (navWk) await navWk.close(); }
  console.log(`\n${ko ? '❌' : '✅'} panneau-telephone : ${ko} rouge(s) sur ${ko + ok} — captures dans ${SORTIE}`);
  process.exit(ko ? 1 : 0);
})();
