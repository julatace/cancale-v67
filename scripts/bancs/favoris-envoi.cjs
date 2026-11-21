// ════════════════════════════════════════════════════════════════════════
//  BANC « LA FEUILLE D'ENVOI AUX FAVORIS » (21 nov., ext. 5.419, `favorisenvoi9`)
//
//  Julien, 21 nov. : « avant, je veux un message pré-rempli et je veux pouvoir choisir le taux de réduction que
//  j'applique à mes articles ». Le VRAI vrm-badge.js + vrm-ui.js sur une FAUSSE page vinted.fr (faux `chrome`), des
//  favoris INVENTÉS ; la question `favorisPerso · envoi` est répondue par le VRAI code du fond (background.js :
//  `favorisPersoCarte`, `offreFavoriDetail`, `plancherFavori`, `fpApercu` → `choisirMessageFavori`). On juge :
//   S1. le message pré-rempli = ce que la règle de l'envoi ferait partir pour le 1er favori (aucune variable laissée) ;
//   S2. le taux réglé (10 %) est choisi ; S3. −20 % : « prix → offre » par article = la règle, le plancher (prix mini /
//       achat + 10 %) REMONTE l'offre et c'est dit, jamais sous le plancher ; S4. un taux libre (7 %) ;
//   S5. « Modifier pour cet envoi » : SON modèle, un mot refusé ferme « Confirmer », corrigé la bulle suit ;
//   S6. rien avant « Confirmer l'envoi », puis `lancer` porte le taux et le texte ; S7. « Enregistrer comme modèle » ;
//   S8. 15 par heure atteint : l'heure du prochain envoi est dite ; G. cibles 44 px, rien ne déborde, aucune erreur.
//  Tailles : 390 Orion clair et sombre d'abord, puis 1512 clair et sombre. `BANC_EXT=<arbre d'avant>` : rouge attendu.
// ════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const vm = require('vm');
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const RACINE = process.env.BANC_RACINE ? path.resolve(process.env.BANC_RACINE) : path.join(__dirname, '..', '..');
const EXT = process.env.BANC_EXT || path.join(RACINE, 'vinted-sync-extension');
const { pathToFileURL } = require('url');
const BADGE = fs.readFileSync(path.join(EXT, 'vrm-badge.js'), 'utf8');
const UI = fs.existsSync(path.join(EXT, 'vrm-ui.js')) ? fs.readFileSync(path.join(EXT, 'vrm-ui.js'), 'utf8') : '';
const LOGO = fs.readFileSync(path.join(__dirname, '..', '..', 'vinted-sync-extension', 'logo-vrm-96.png'));
const SORTIE = process.env.BANC_CAPTURES ? path.join(process.env.BANC_CAPTURES, 'favoris-envoi') : path.join(__dirname, 'captures', 'favoris-envoi');
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
  if (FOND_PERSO) await pg.exposeFunction('__fpBg', (m) => FOND_PERSO(m, pg));
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
          else if (msg.action === 'favorisCarte' && msg.quoi === 'apercu') rep = { ok: true, uid: '111', apercu: copie(ap) };
          else if (msg.action === 'favorisCarte' && msg.quoi === 'lancer') rep = window.__refusLancer ? copie(window.__refusLancer) : msg.confirme === true ? { ok: true } : { ok: false };
          else if (msg.action === 'repondreCarte') rep = msg.confirme === true ? { ok: true } : { ok: false, raison: 'non' };
          else if (msg.action === 'favorisPerso') { window.__fpBg(copie(msg)).then((r) => cb && cb(r)); return; }
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

// ── LE FOND : le vrai code de background.js pour `favorisPerso` (verifier) ───────────────────────────────────────────
const BG = fs.readFileSync(path.join(EXT, 'background.js'), 'utf8');
const blocBG = (a, b) => { const i = BG.indexOf(a), j = BG.indexOf(b); return i < 0 || j < 0 ? '' : BG.slice(i, j + b.length); };
const fonctionBG = (nom) => { const i = BG.search(new RegExp(`(?:async )?function ${nom}\\(`)); if (i < 0) return ''; let p = BG.indexOf('{', BG.indexOf(')', i)), n = 0, j = p; for (; j < BG.length; j++) { if (BG[j] === '{') n++; else if (BG[j] === '}') { n--; if (!n) break; } } return BG.slice(i, j + 1); };
let FOND_PERSO = null;
const ENREG = [];
// Les prix mini et achats de SON dressing inventé (TOUTES) : la base que `plancherFavori` lit (projection main).
const FICHES = Object.fromEntries(TOUTES.map((a) => [a.id, Object.assign({ numero: a.num || null }, a.mini ? { min: String(a.mini) } : {}, a.achat ? { buyPrice: String(a.achat) } : {})]));
let PERSO = null;   // SES versions écrites (null = les textes d'avant)
let FP_CTX = null;
try {
  const code = [blocBG('// <reglages-auto-ligne>', '// </reglages-auto-ligne>'), blocBG('// <message-sur-regle>', '// </message-sur-regle>'), blocBG('// <favoris-perso-regle>', '// </favoris-perso-regle>'),
    fonctionBG('prixTexteFavori'), fonctionBG('personnaliserMessageFavori'), fonctionBG('fpJugerTexte'), fonctionBG('fpApercu'), fonctionBG('favorisPersoCarte'),
    fonctionBG('prixOffreFavori'), fonctionBG('offreFavoriDetail'), fonctionBG('plancherFavori'), fonctionBG('plancherBaisse'), fonctionBG('centimesPoses'), fonctionBG('favPersoCompte')].join('\n');
  if (!/offreFavoriDetail/.test(code) || !/quoi === 'envoi'/.test(code)) throw new Error('la feuille d’envoi (favorisPerso · envoi) est absente du fond');
  const ctx = { Intl, Date, Math, Number, String, Array, Object, Set, Map, JSON, RegExp, isFinite, encodeURIComponent, FAVORIS_CARTE_MAX: 15, REGLE_MARGE_ACHAT: 110, noterDiag: () => {},
    ongletCarte: () => ({ url: 'https://www.vinted.fr/' }), compteConnecte: async () => '111', chrome: { storage: { local: { get: async () => ({}) } } },
    bleamCompte: async () => ({ favMessages: PERSO }),
    sbGet: async (u) => { const m = /vinted_annonce_numeros->"(\d+)"/.exec(decodeURIComponent(u)); if (m) return [{ f: FICHES[m[1]] || null }]; const b = /vinted_buyprice_by_num/.test(u); if (b) return [{ b: null }]; return []; } };
  vm.runInNewContext(code + '\n;globalThis.__f = { favorisPersoCarte, fpReglage, fpApercu, offreFavoriDetail };', ctx);
  FP_CTX = ctx;
  FOND_PERSO = async (m) => {
    if (m.quoi === 'stats') return STATS;
    if (m.quoi === 'enregistrer') { const R = ctx.__f.fpReglage(m.reglage || {}); ENREG.push({ reglage: JSON.parse(JSON.stringify(R)) }); PERSO = R; return { ok: true, relu: true, reglage: R }; }
    return JSON.parse(JSON.stringify(await ctx.__f.favorisPersoCarte(m, { tab: { url: 'https://www.vinted.fr/' } })));
  };
} catch (e) { console.log('  ❌ le fond ne se charge pas : ' + e.message); FOND_PERSO = async () => ({ ok: false }); }
const STATS = { ok: true, envois: 0, ventesLues: true, stats: {} };
const clic = async (pg, sel) => { await pg.evaluate((s) => { const b = document.getElementById('vrm-badge').shadowRoot.querySelector(s); if (b) b.click(); }, sel); await pg.waitForTimeout(220); };
const montrer = async (pg, mobile) => {
  const b = await pg.evaluate(() => { const x = document.getElementById('vrm-badge').shadowRoot.querySelector('.btn').getBoundingClientRect(); return { x: x.left + x.width / 2, y: x.top + x.height / 2 }; });
  if (mobile) await pg.touchscreen.tap(b.x, b.y); else { await pg.mouse.move(5, 5); await pg.mouse.move(b.x, b.y); await pg.mouse.click(b.x, b.y); }
  await pg.waitForTimeout(400);
};
// L'état que le fond poserait, puis le signal de chrome.storage (comme `vrmFavorisCarte` qui change).
const poserEtat = async (pg, file) => { await pg.evaluate((f) => { const e = JSON.parse(JSON.stringify(window.__etatBase)); e.site.favoris.file = f; window.__etat = e; for (const l of window.__ecoutes || []) try { l({ vrmFavorisCarte: { newValue: f } }, 'local'); } catch (_) {} }, file); await pg.waitForTimeout(450); };
const cap = async (pg, nom) => { try { await pg.screenshot({ path: path.join(SORTIE, nom + '.png') }); } catch (_) {} };

// SES textes d'avant (rétro-compat) et l'offre réglée (10 %) ; le message lot d'avant (« comme Bleam »).
const L_P = JSON.parse(JSON.stringify(LISTES));
L_P.automatisations.favoris = Object.assign({}, L_P.automatisations.favoris, { textes: ['Bonjour {pseudo}, une offre rien que pour toi.', 'Salut {pseudo} ! Je te fais un prix.'], rythme: 'normal', offre: { mode: 'pct', pct: 10, valeur: null, arrondi: false } });
L_P.automatisations.bleam = Object.assign({}, L_P.automatisations.bleam, { favMessages: { actif: false, v: 1, un: [], lot: [], regles: [] } });
const lireE = (pg) => pg.evaluate(() => {
  const r = document.getElementById('vrm-badge').shadowRoot, q = (s) => r.querySelector(s);
  const vis = (el) => !!(el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none');
  const ed = q('[data-fp-editeur]'), f = q('.fav6-feuille');
  if (!ed) return { ed: false };
  const ctl = Array.from(ed.querySelectorAll('button, input, select, textarea')).filter(vis);
  const v = (k) => q(`[data-fp-v="${k}"]`);
  return { ed: true, vis: vis(ed), source: ed.getAttribute('data-fp-source'), compte: (q('[data-fp-compte]') || {}).textContent || '',
    un: Array.from(r.querySelectorAll('[data-fp-cas="un"] textarea')).map((t) => t.value), lot: Array.from(r.querySelectorAll('[data-fp-cas="lot"] textarea')).map((t) => t.value),
    stats: Object.fromEntries(Array.from(r.querySelectorAll('[data-fp-stats]')).map((s) => [s.getAttribute('data-fp-stats'), s.textContent])),
    compteurs: Object.fromEntries(Array.from(r.querySelectorAll('[data-fp-n]')).map((s) => [s.getAttribute('data-fp-n'), s.textContent])),
    alertes: Object.fromEntries(Array.from(r.querySelectorAll('[data-fp-alerte]')).map((s) => [s.getAttribute('data-fp-alerte'), s.textContent])),
    ko: Array.from(r.querySelectorAll('.fp-v[data-fp-ko]')).map((x) => x.getAttribute('data-fp-v')),
    ap: q('[data-fp-ap-texte]') ? { cas: q('.fp-ap').getAttribute('data-fp-ap-cas'), regle: q('.fp-ap').getAttribute('data-fp-ap-regle'), texte: q('[data-fp-ap-texte]').textContent, offre: q('[data-fp-ap-offre]').getAttribute('data-fp-ap-offre'), offreTxt: q('[data-fp-ap-offre]').textContent, titre: q('[data-fp-ap-titre]').textContent, lot: q('[data-fp-ap-lot]') ? q('[data-fp-ap-lot]').textContent : '' } : null,
    regles: Array.from(r.querySelectorAll('[data-fp-regle]')).map((x) => x.getAttribute('data-fp-regle') + ':' + x.getAttribute('data-fp-precision')),
    petits: ctl.filter((b) => b.getBoundingClientRect().height < 43.5).map((b) => (b.className || b.tagName) + ':' + Math.round(b.getBoundingClientRect().height) + ':' + (b.innerText || b.getAttribute('aria-label') || b.getAttribute('data-fp-rc') || '').slice(0, 24)),
    debord: document.documentElement.scrollWidth > window.innerWidth || (f && f.scrollWidth > f.clientWidth + 1),
    enregistrer: window.__envoyes.filter((m) => m.action === 'favorisPerso' && m.quoi === 'enregistrer').length };
});
const ecrire = async (pg, sel, texte) => { await pg.evaluate(({ s, t }) => { const el = document.getElementById('vrm-badge').shadowRoot.querySelector(s); el.focus(); el.value = t; try { el.setSelectionRange(t.length, t.length); } catch (_) {} el.dispatchEvent(new Event('input', { bubbles: true })); }, { s: sel, t: texte }); await pg.waitForTimeout(650); };
const defiler = async (pg, sel) => { await pg.evaluate((s) => { const el = document.getElementById('vrm-badge').shadowRoot.querySelector(s); if (el) el.scrollIntoView({ block: 'start' }); }, sel); await pg.waitForTimeout(200); };
const lireS = (pg) => pg.evaluate(() => {
  const r = document.getElementById('vrm-badge').shadowRoot, q = (s) => r.querySelector(s);
  const vis = (el) => !!(el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none');
  const f = q('.fav6-feuille[data-fav6-feuille="confirmer"]');
  if (!f) return { f: false };
  const ctl = Array.from(f.querySelectorAll('button, input, textarea')).filter(vis);
  return { f: vis(f), taux: (q('[data-fav-env-taux]') || {}).getAttribute ? q('[data-fav-env-taux]').getAttribute('data-fav-env-taux') : null,
    presses: Array.from(r.querySelectorAll('[data-fav-env-pct][aria-pressed="true"]')).map((b) => b.getAttribute('data-fav-env-pct')),
    bulle: (q('.fav6-feuille [data-fav-message]') || {}).textContent || '', ko: !!q('[data-fav-env-ko]'),
    lignes: Array.from(f.querySelectorAll('[data-fav-recap-item]')).map((li) => ({ id: li.getAttribute('data-fav-recap-item'), offre: li.getAttribute('data-fav-env-offre'), remontee: li.hasAttribute('data-fav-env-remontee'), sans: li.hasAttribute('data-fav-env-sans'), px: (li.querySelector('.fl-px') || {}).textContent || '', note: (li.querySelector('[data-fav-env-note-l]') || {}).textContent || '' })),
    texte: q('[data-fav-env-texte]') ? q('[data-fav-env-texte]').value : null, juge: (q('[data-fav-env-juge]') || {}).textContent || '',
    lancer: q('.fav6-feuille [data-fav-lancer]') ? !q('.fav6-feuille [data-fav-lancer]').disabled : null,
    petits: ctl.filter((b) => b.getBoundingClientRect().height < 43.5).map((b) => (b.className || b.tagName) + ':' + Math.round(b.getBoundingClientRect().height) + ':' + (b.innerText || b.getAttribute('aria-label') || '').slice(0, 30)),
    debord: document.documentElement.scrollWidth > window.innerWidth || f.scrollWidth > f.clientWidth + 1,
    lances: window.__envoyes.filter((m) => m.action === 'favorisCarte' && m.quoi === 'lancer') };
});
(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  fs.mkdirSync(SORTIE, { recursive: true });
  const TAILLES = [{ T: '390 Orion', largeur: 390, hauteur: 844, mobile: true, orion: true, scheme: 'light' }, { T: '390 Orion sombre', largeur: 390, hauteur: 844, mobile: true, orion: true, scheme: 'dark' }, { T: '1512 light', largeur: 1512, scheme: 'light' }, { T: '1512 dark', largeur: 1512, scheme: 'dark' }];
  for (const o of TAILLES) {
    const T = o.T, N = (s) => T.replace(/ /g, '-') + '-' + s;
    console.log('\n' + T);
    ENREG.length = 0; PERSO = null;
    const t = await ouvrir(nav, Object.assign({}, o, { AP: AP2, L: L_P }));
    await essaie(T, async () => {
      await montrer(t.pg, o.mobile);
      await clic(t.pg, '.side6 [data-onglet-b="favoris"]');
      await t.pg.waitForTimeout(400);
      // Il coche trois favoris : f0 (7000 : achat 30 €), f1 (7001 : prix mini 46 €), f2 (7002 : rien de posé).
      const choisis = ['f0', 'f1', 'f2'];
      for (const id of choisis) await clic(t.pg, `[data-fav-coche="${id}"]`);
      await clic(t.pg, '[data-fav-envoyer]');
      await t.pg.waitForTimeout(800);
      let e = await lireS(t.pg);
      dit(e.f, `${T} — la feuille « Confirmer l’envoi » s’ouvre`);
      // S1 — le message pré-rempli = la règle de l'envoi (fpApercu : choisirMessageFavori puis personnaliserMessageFavori)
      const x0 = AP2.tous.find((x) => x.id === 'f0');
      const anc = { message: L_P.automatisations.favoris.textes[0], variantes: L_P.automatisations.favoris.textes.slice(1), lot: '' };
      const of0 = await FP_CTX.__f.offreFavoriDetail(x0.itemId, x0.prix, { mode: 'pct', valeur: 10, arrondi: false });
      const attendu = FP_CTX.__f.fpApercu(null, anc, { pseudo: x0.pseudo, titre: x0.titre, prix: x0.prix }, of0.prix ? { prix: Number(of0.prix) } : null, false, null);
      dit(attendu.ok && e.bulle === attendu.texte && /acheteur_0/.test(e.bulle) && !/[{}]/.test(e.bulle), `${T} S1 — le message pré-rempli est celui que la règle de l’envoi ferait partir (1er favori)`, JSON.stringify([e.bulle, attendu.texte]));
      // S2 — le taux réglé (10 %) est enfoncé ; « 55 € → 49,50 € » ; plancher dit
      dit(e.taux === '10' && e.presses.join() === '10', `${T} S2 — le taux réglé (10 %) est choisi`, JSON.stringify([e.taux, e.presses]));
      await cap(t.pg, N('1-feuille'));
      // S3 — il choisit −20 % : chaque offre recalculée par le fond, remontée au plancher et DITE
      await clic(t.pg, '[data-fav-env-pct="20"]');
      await t.pg.waitForTimeout(700);
      e = await lireS(t.pg);
      const attendus = {};
      for (const id of choisis) { const x = AP2.tous.find((y) => y.id === id); const d = await FP_CTX.__f.offreFavoriDetail(x.itemId, x.prix, { mode: 'pct', valeur: 20, arrondi: false }); attendus[x.itemId] = d; }
      const L = Object.fromEntries(e.lignes.map((l) => [l.id, l]));
      const okOffres = Object.entries(attendus).every(([it, d]) => L[it] && (d.prix ? Number(L[it].offre) === Number(d.prix) && /→/.test(L[it].px) : L[it].sans));
      dit(e.taux === '20' && okOffres, `${T} S3 — −20 % : « prix → offre » par article = la règle de l’envoi`, JSON.stringify({ e: e.lignes, attendus }));
      await cap(t.pg, N('2-taux-20'));
      // S3b — un taux fort (40 %) : 7001 (60 €, prix mini 46 €) passerait à 36 € ⇒ REMONTÉE à 46 €, dit
      await t.pg.evaluate(() => { const i = document.getElementById('vrm-badge').shadowRoot.querySelector('[data-fav-env-libre]'); i.focus(); i.value = '40'; i.dispatchEvent(new Event('input', { bubbles: true })); });
      await t.pg.waitForTimeout(700);
      e = await lireS(t.pg);
      const L40 = Object.fromEntries(e.lignes.map((l) => [l.id, l]));
      for (const id of choisis) { const x = AP2.tous.find((y) => y.id === id); attendus[x.itemId] = await FP_CTX.__f.offreFavoriDetail(x.itemId, x.prix, { mode: 'pct', valeur: 40, arrondi: false }); }
      const rem = Object.entries(attendus).filter(([, d]) => d.remontee).map(([it, d]) => [it, d, L40[it]]);
      dit(rem.length >= 1 && rem.every(([, d, l]) => l && l.remontee && Number(l.offre) === Number(d.prix) && /mini|achat/.test(l.note) && l.note.includes(String(Number(d.prix)).replace('.', ','))), `${T} S3b — 40 % : le plancher (prix mini / achat + 10 %) REMONTE l’offre, et c’est dit sur la ligne`, JSON.stringify(rem));
      await cap(t.pg, N('2b-taux-40-plancher'));
      dit(Object.entries(attendus).every(([it, d]) => !d.prix || Number(d.prix) >= (Number(FICHES[it].min) || (FICHES[it].buyPrice ? Math.ceil(Number(FICHES[it].buyPrice) * 110) / 100 : 0))), `${T} S3 — aucune offre sous le plancher`);
      // S4 — un taux libre (7 %)
      await t.pg.evaluate(() => { const i = document.getElementById('vrm-badge').shadowRoot.querySelector('[data-fav-env-libre]'); i.focus(); i.value = '7'; i.dispatchEvent(new Event('input', { bubbles: true })); });
      await t.pg.waitForTimeout(700);
      e = await lireS(t.pg);
      const d7 = await FP_CTX.__f.offreFavoriDetail('7002', AP2.tous.find((y) => y.id === 'f2').prix, { mode: 'pct', valeur: 7, arrondi: false });
      dit(e.taux === '7' && !e.presses.length && Number((e.lignes.find((l) => l.id === '7002') || {}).offre) === Number(d7.prix), `${T} S4 — un autre taux (7 %) s’applique`, JSON.stringify([e.taux, e.lignes]));
      // S5 — il modifie le message pour cet envoi : le modèle s'ouvre (variables), la bulle suit, un mot refusé bloque l'envoi
      await clic(t.pg, '[data-fav-env-modifier]'); await t.pg.waitForTimeout(400);
      e = await lireS(t.pg);
      dit(e.texte === L_P.automatisations.favoris.textes[0], `${T} S5 — « Modifier pour cet envoi » ouvre SON modèle (variables comprises)`, JSON.stringify(e.texte));
      await ecrire(t.pg, '[data-fav-env-texte]', 'Coucou {prénom}, écris-moi sur WhatsApp');
      await t.pg.waitForTimeout(700);
      e = await lireS(t.pg);
      dit(/WhatsApp|whats/i.test(e.juge) && e.lancer === false, `${T} S5 — un mot que Vinted refuse est dit, « Confirmer l’envoi » est fermé`, JSON.stringify([e.juge, e.lancer]));
      await ecrire(t.pg, '[data-fav-env-texte]', 'Coucou {prénom} ! {article} est encore là.');
      await t.pg.waitForTimeout(700);
      e = await lireS(t.pg);
      dit(!e.juge && e.lancer === true && /^Coucou acheteur_0 !/.test(e.bulle) && !/[{}]/.test(e.bulle), `${T} S5 — corrigé : la bulle montre ce que recevra acheteur_0`, JSON.stringify([e.bulle, e.juge, e.lancer]));
      await cap(t.pg, N('3-modifie'));
      // S6 — rien ne part avant « Confirmer l'envoi » ; puis le taux et le texte partent avec SON toucher
      dit(!e.lances.length, `${T} S6 — rien ne part avant « Confirmer l’envoi »`);
      await clic(t.pg, '.fav6-feuille [data-fav-lancer]'); await t.pg.waitForTimeout(400);
      e = await lireS(t.pg);
      const l0 = e.lances && e.lances[0] || (await t.pg.evaluate(() => window.__envoyes.filter((m) => m.action === 'favorisCarte' && m.quoi === 'lancer')))[0];
      dit(l0 && l0.confirme === true && l0.taux === 7 && l0.texte === 'Coucou {prénom} ! {article} est encore là.' && l0.selection.length === 3, `${T} S6 — « Confirmer » : taux 7 % et le message de cet envoi partent avec la sélection`, JSON.stringify(l0 && { t: l0.taux, x: l0.texte, s: l0.selection }));
      // S7 — « Enregistrer comme modèle » (deux autres favoris cochés : les trois envoyés ont quitté le choix)
      for (const id of ['f3', 'f5']) await clic(t.pg, `[data-fav-coche="${id}"]`);
      await clic(t.pg, '[data-fav-envoyer]'); await t.pg.waitForTimeout(700);
      await clic(t.pg, '[data-fav-env-modifier]'); await t.pg.waitForTimeout(300);
      await ecrire(t.pg, '[data-fav-env-texte]', 'Bonjour {prénom}, je te fais un prix sur {article}.');
      await t.pg.waitForTimeout(600);
      await clic(t.pg, '[data-fav-env-garder]'); await t.pg.waitForTimeout(700);
      dit(ENREG.length === 1 && ENREG[0].reglage.un.some((v) => v.texte === 'Bonjour {prénom}, je te fais un prix sur {article}.'), `${T} S7 — « Enregistrer comme modèle » range le texte dans SES messages`, JSON.stringify(ENREG[0] && ENREG[0].reglage.un));
      e = await lireS(t.pg);
      dit(!e.petits.length, `${T} G — cibles ≥ 44 px`, e.petits.slice(0, 8).join(' · '));
      dit(!e.debord, `${T} G — rien ne déborde`);
      dit(!t.erreurs.length, `${T} G — aucune erreur de page`, t.erreurs.join(' | '));
      // S8 — le plafond qui bloque est DIT avec l'heure du prochain envoi
      await t.pg.keyboard.press('Escape'); await t.pg.waitForTimeout(200);
      const prochain = Date.now() + 23 * 60000;
      const h = await t.pg.evaluate((p) => new Date(p).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), prochain);
      await t.pg.evaluate((e0) => { window.__etatBase = e0; }, ETAT);
      await poserEtat(t.pg, { v: 1, uid: '111', actif: true, debut: Date.now() - 60000, total: 15, file: { total: 15, envoyes: 15, active: true }, attente: null, prochain, quoi: 'sorte', fin: null, items: [], sel: [] });
      await t.pg.waitForTimeout(900);
      const txt = await t.pg.evaluate(() => document.getElementById('vrm-badge').shadowRoot.querySelector('.fav6') ? document.getElementById('vrm-badge').shadowRoot.querySelector('.fav6').innerText : '');
      dit(txt.includes(h) && /15 par heure/i.test(txt), `${T} S8 — 15 par heure atteint : le panneau dit l’heure du prochain envoi (${h})`, txt.slice(0, 300));
      await cap(t.pg, N('4-plafond'));
    });
    await t.ctx.close();
  }
  await nav.close();
  console.log(`\nbanc favoris-envoi : ${ok} vert(s), ${ko} rouge(s) — captures : ${SORTIE}`);
  process.exit(ko ? 1 : 0);
})();
