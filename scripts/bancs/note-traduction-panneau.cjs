// ════════════════════════════════════════════════════════════════════════
//  BANC « NOTE DES ACHETEURS · TRADUCTION SUR L'APPAREIL » DANS LE PANNEAU (21 nov., ext. 5.430)
//  N1 étiquette de note (conversation + offre, ambre ≤ seuil) ; T1 Chrome : « Traduire » présent, texte traduit sous l'original ;
//  Orion / navigateur sans traducteur : pas de bouton, UNE ligne dit pourquoi ; T2 sa réponse traduite : les deux textes,
//  rien ne part ; T3 aucune requête réseau, traductions par l'API du navigateur ; T4 langue reconnue passée aux réponses
//  rapides ; A1 son acceptation à la main sur ★ 1,0 : l'avertissement, puis son second toucher ; R1 le réglage (seuil).
//  Le décor ci-dessous (faux chrome, données inventées) est celui du banc agent-panneau (5.421), recopié tel quel :
//  Le VRAI vrm-badge.js + vrm-ui.js sur une FAUSSE page vinted.fr (faux `chrome`), données INVENTÉES aux formes du fond
//  (reponsesRapidesCarte, lotsFavorisCarte, relancesCarte, agentCarte). On juge :
//   Q1–Q3 fil : réponses proposées (catégorie, texte rempli), manque dit, IA absente dite ; « Envoyer » ⇒ UNE réponse,
//         ce texte, cette conversation (repondreCarte, confirme) ; rien avant son toucher ; 44 px ; rien ne déborde ;
//   A1–A2 Automatisations → Agent VRM : réglages, mode Essai dit, tableau de bord (décisions, à toi, taux) ;
//   R1–R3 Automatisations → Relancer : prête / en attente / écartée (raison) ; confirmation, puis UNE relance ;
//   L1–L3 Favoris : « Lot de 3 · 193 € proposé (au lieu de 215 €) », lot sans plancher dit, confirmation puis UN lot ;
//   aucune erreur de page. Tailles : 390 Orion d'abord, puis 1512 clair et sombre. `BANC_EXT=<arbre d'avant>` : rouge.
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
const SORTIE = process.env.BANC_CAPTURES ? path.join(process.env.BANC_CAPTURES, 'agent-panneau') : path.join(__dirname, 'captures', 'agent-panneau');
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
          if (window.__r5 && window.__r5(msg, cb)) return;   // 5.421 : réponses rapides, lots, relances, agent
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
try {
  const code = [blocBG('// <reglages-auto-ligne>', '// </reglages-auto-ligne>'), blocBG('// <message-sur-regle>', '// </message-sur-regle>'), blocBG('// <favoris-perso-regle>', '// </favoris-perso-regle>'),
    fonctionBG('prixTexteFavori'), fonctionBG('personnaliserMessageFavori'), fonctionBG('fpJugerTexte'), fonctionBG('fpApercu'), fonctionBG('favorisPersoCarte')].join('\n');
  if (!/favorisPersoCarte/.test(code)) throw new Error('favorisPersoCarte absente');
  const ctx = { Intl, Date, Math, Number, String, Array, Object, Set, Map, JSON, RegExp, isFinite, ongletCarte: () => ({ url: 'https://www.vinted.fr/' }), compteConnecte: async () => '111', chrome: { storage: { local: { get: async () => ({}) } } } };
  vm.runInNewContext(code + '\n;globalThis.__f = { favorisPersoCarte, fpReglage };', ctx);
  FOND_PERSO = async (m) => {
    if (m.quoi === 'stats') return STATS;
    if (m.quoi === 'enregistrer') { const R = ctx.__f.fpReglage(m.reglage || {}); ENREG.push({ reglage: JSON.parse(JSON.stringify(R)), offre: m.offre || null, rythme: m.rythme || null }); return { ok: true, relu: true, reglage: R }; }
    return JSON.parse(JSON.stringify(await ctx.__f.favorisPersoCarte(m, { tab: { url: 'https://www.vinted.fr/' } })));
  };
} catch (e) { console.log('  ❌ le fond (favorisPersoCarte) ne se charge pas : ' + e.message); FOND_PERSO = async () => ({ ok: false }); }
const STATS = { ok: true, envois: 15, ventesLues: true, stats: { a1: { envoyes: 12, avecOffre: 5, vendus: 2, vendusSansDate: 0, mesure: true }, a2: { envoyes: 3, avecOffre: 1, vendus: 0, vendusSansDate: 0, mesure: false } } };
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
// ── 5.421 : les réponses du fond pour les gestes neufs (données inventées, formes du vrai fond) ──
const R5 = {
  reponsesRapides: { ok: true, fil: 'lu', item: '7001', ia: { dispo: false }, question: 'Bonjour, elle est toujours disponible ? Quelle taille exactement ?', langue: 'fr',
    propositions: [{ cat: 'dispo', texte: 'Bonjour acheteuse_0, oui, Adidas Samba OG noires 40 est toujours disponible.', sienne: false }, { cat: 'taille', texte: 'Bonjour acheteuse_0, c’est une taille 40, celle indiquée sur l’annonce.', sienne: true }, { cat: 'prix', manque: 'prix_mini_cache' }] },
  lotsFavoris: { ok: true, uid: '111', taux: 10, lotAppris: false, lots: [
    { receiver: '501', pseudo: 'fan_sneakers', at: T0, items: [{ itemId: '7001', titre: 'Adidas Samba OG noires 40', photo: img('a1') }, { itemId: '7002', titre: 'New Balance 550 crème 41' }, { itemId: '7004', titre: 'Asics Gel-Kayano 14 argent 43' }], offre: { ok: true, n: 3, somme: 21500, plancher: 15000, prix: 19300, remontee: false } },
    { receiver: '502', pseudo: 'lea_33', at: T0 - H, items: [{ itemId: '7003', titre: 'Puma Suede bleues 42' }, { itemId: '7005', titre: 'Nike Dunk Low Panda 44' }], offre: { ok: false, raison: 'plancher_inconnu', items: ['7003'] } }] },
  relancesOffres: { ok: true, uid: '111', reglage: { actif: false, jours: 3, taux: 10 }, liste: [
    { conv: '60003', acheteur: '903', pseudo: 'acheteur_3', item: '7003', titre: 'Puma Suede bleues 42', offre: 4500, etatOffre: 'refusee', prix: 6300, etat: 'pret', raison: '', quand: T0 - J },
    { conv: '60004', acheteur: '904', pseudo: 'acheteur_4', item: '7004', titre: 'Asics Gel-Kayano 14 argent 43', offre: 5000, etatOffre: 'expiree', prix: 6900, etat: 'attente', raison: '', quand: T0 + 2 * J },
    { conv: '60005', acheteur: '905', pseudo: 'acheteur_5', item: '7005', titre: 'Nike Dunk Low Panda 44', offre: 3000, etatOffre: 'refusee', prix: null, etat: 'ecarte', raison: 'plancher_inconnu' }] },
  agentVrm: { ok: true, uid: '111', essai: true, arrete: null, agent: { actif: true, negocier: true, repondre: true, essaiJours: 3, essaiJusqua: T0 + 2 * J, heuresCalmes: { de: 22, a: 8 }, allumeAt: T0 - J },
    tableau: { jour: 6, essai: 6, attente: 1, aToi: 2, acceptees: 3, tranchees: 5, taux: 60, envoyes: 5 },
    decisions: [{ id: 'o:1', at: T0 - 5 * MIN, sorte: 'offre', geste: 'contre', raison: 'palier', etat: 'essai', essai: true, prix: 93, offre: 70, palier: 0 },
      { id: 'm:1', at: T0 - 9 * MIN, sorte: 'message', geste: 'repondre', raison: 'dispo', etat: 'essai', essai: true, texte: 'Bonjour lea_33, oui, Adidas Samba OG noires 40 est toujours disponible.' },
      { id: 'm:2', at: T0 - 20 * MIN, sorte: 'message', geste: 'a_toi', raison: 'risque_retour', etat: 'a_toi', conv: '60006' },
      { id: 'o:2', at: T0 - H, sorte: 'offre', geste: 'a_toi', raison: 'plancher_inconnu', etat: 'a_toi', offre: 40, conv: '60007' },
      { id: 'o:3', at: T0 - 2 * H, sorte: 'offre', geste: 'accepter', raison: 'au_dessus_du_seuil', etat: 'essai', essai: true, prix: 86, offre: 86 }] },
};
const L5 = JSON.parse(JSON.stringify(LISTES));
L5.automatisations.bleam = Object.assign({}, L5.automatisations.bleam, { agent: R5.agentVrm.agent, relanceOffres: { actif: false, jours: 3, taux: 10 }, lotFavoris: { actif: false, taux: 10 } });
L5.automatisations.reponsesRapides = { v: 1, modeles: { taille: ['Bonjour {pseudo}, c’est une taille {taille}, celle indiquée sur l’annonce.'] }, revelerMini: false };
const lire5 = (pg, sel) => pg.evaluate((s) => {
  const r = document.getElementById('vrm-badge').shadowRoot, z = r.querySelector(s);
  const vis = (el) => !!(el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none');
  if (!z) return { la: false };
  const ctl = Array.from(z.querySelectorAll('button, input, select, textarea, a.vu-btn')).filter(vis);
  return { la: true, vis: vis(z), texte: z.textContent.replace(/\s+/g, ' ').slice(0, 4000), petits: ctl.filter((b) => b.getBoundingClientRect().height < 43.5).map((b) => (b.className || b.tagName) + ':' + Math.round(b.getBoundingClientRect().height) + ':' + (b.innerText || b.getAttribute('aria-label') || '').slice(0, 30)),
    debord: document.documentElement.scrollWidth > window.innerWidth || z.scrollWidth > z.clientWidth + 2, envoyes: window.__envoyes.map((m) => m.action + ':' + (m.quoi || '') + ':' + (m.confirme === true ? 'c' : '')) };
}, sel);
const envoyes = (pg) => pg.evaluate(() => window.__envoyes);
// ══ 5.430 — LE BANC : note des acheteurs et traduction sur l'appareil (le reste du fichier : le décor du banc agent-panneau, recopié) ══
const R6 = Object.assign({}, R5, {
  reponsesRapides: { ok: true, fil: 'lu', item: '7001', ia: { dispo: false }, question: 'Hi, is it still available? What size exactly?', langueIndice: null, langue: 'fr',   // Chrome : les indices simples du fond n'ont rien conclu (langue = celle de l'interface) ; le NAVIGATEUR reconnaît l'anglais
    propositions: [{ cat: 'dispo', texte: 'Hi acheteuse_0, yes, Adidas Samba OG noires 40 is still available.', sienne: false }] },
  noteAcheteur: { ok: true, note: { k: 'note', etoiles: 1, n: 3, ambre: true }, seuil: 1.5 },
});
const L6 = JSON.parse(JSON.stringify(L5));
L6.messages.liste[0].texte = 'Hi, is it still available? What size exactly?';
L6.messages.liste[0].note = { k: 'note', etoiles: 1, n: 3, ambre: true };
L6.messages.liste[1].note = { k: 'note', etoiles: 4.9, n: 132, ambre: false };
L6.messages.liste[2].note = { k: 'neuf', etoiles: null, n: 0, ambre: true };
L6.offres = [Object.assign({}, OFFRES[0], { note: { k: 'note', etoiles: 1, n: 3, ambre: true } })];
L6.automatisations.bleam = Object.assign({}, L6.automatisations.bleam, { noteAcheteurs: { actif: false, seuil: 1.5, neufAccepter: true } });
// Le traducteur INTÉGRÉ de Chrome, simulé (sur l'appareil : aucune requête) ; Orion n'en a pas.
const TRADUCTEUR = () => {
  window.__traductions = [];
  window.LanguageDetector = { availability: async () => 'available', create: async () => ({ detect: async (t) => [{ detectedLanguage: /[a-z]/i.test(t) && /\b(is|it|the|what|hi|still)\b/i.test(t) ? 'en' : 'fr', confidence: 0.97 }], destroy() {} }) };
  window.Translator = { availability: async () => 'available', create: async (o) => ({ translate: async (t) => { window.__traductions.push(o.sourceLanguage + '>' + o.targetLanguage); return o.targetLanguage === 'fr' ? 'Bonjour, est-elle toujours disponible ? Quelle taille exactement ?' : 'Hello, yes, it is still available.'; }, destroy() {} }) };
};
(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const S = SORTIE.replace(/agent-panneau$/, 'note-traduction');
  fs.mkdirSync(S, { recursive: true });
  const capS = async (pg, nom) => { try { await pg.screenshot({ path: path.join(S, nom + '.png') }); } catch (_) {} };
  const TAILLES = [{ T: '390 Orion', largeur: 390, hauteur: 844, mobile: true, orion: true, scheme: 'light', trad: false },
    { T: '390 Chrome', largeur: 390, hauteur: 844, mobile: true, scheme: 'light', trad: true },
    { T: '1512 light', largeur: 1512, scheme: 'light', trad: true }, { T: '1512 dark', largeur: 1512, scheme: 'dark', trad: true }, { T: '1512 sans', largeur: 1512, scheme: 'light', trad: false }];
  for (const o of TAILLES) {
    const T = o.T, N = (s) => T.replace(' ', '-') + '-' + s;
    console.log('\n' + T);
    const t = await ouvrir(nav, Object.assign({}, o, { AP: AP2, L: L6, url: 'https://www.vinted.fr/inbox/60000' }));
    const requetes = []; t.pg.on('request', (r) => requetes.push(r.url()));
    // Chrome récent : son traducteur intégré (simulé, pour des résultats fixes) ; sans : AUCUNE des deux API (le Chromium du
    // banc a les siennes — elles sont retirées, comme sur Orion, Safari ou un ancien Chrome).
    if (o.trad) await t.pg.evaluate(TRADUCTEUR); else await t.pg.evaluate(() => { try { delete window.Translator; delete window.LanguageDetector; } catch (_) {} window.Translator = undefined; window.LanguageDetector = undefined; });
    // Orion / sans traducteur : les indices simples du fond lisent l'anglais (rrLangue de « Hi, is it still available? »).
    const R6v = o.trad ? R6 : Object.assign({}, R6, { reponsesRapides: Object.assign({}, R6.reponsesRapides, { langue: 'en', langueIndice: 'en' }) });
    await t.pg.evaluate((r6) => { window.__r5 = (msg, cb) => {
      if (msg.action === 'offreCarte') { setTimeout(() => cb && cb(msg.quoi === 'accept' && msg.noteVue !== true ? { ok: false, code: 'note', decision: 'basse', note: { k: 'note', etoiles: 1, n: 3, ambre: true }, seuil: 1.5 } : { ok: true }), 0); return true; }
      if (r6[msg.action] && (msg.quoi || 'lire') === 'lire') { setTimeout(() => cb && cb(JSON.parse(JSON.stringify(r6[msg.action]))), 0); return true; }
      if (msg.action === 'agentVrm') { setTimeout(() => cb && cb({ ok: true }), 0); return true; }
      return false; }; }, R6v);
    await essaie(T, async () => {
      await montrer(t.pg, o.mobile);
      await clic(t.pg, '.side6 [data-onglet-b="messages"]'); await t.pg.waitForTimeout(400);
      await clic(t.pg, '[data-conv-b="60000"]'); await t.pg.waitForTimeout(900);
      // ── N : la note sur la conversation et sur l'offre ──
      const note = await t.pg.evaluate(() => { const r = document.getElementById('vrm-badge').shadowRoot; return Array.from(r.querySelectorAll('[data-note-acheteur]')).map((x) => ({ k: x.getAttribute('data-note-acheteur'), ambre: x.getAttribute('data-k') === 'ambre', t: x.textContent, h: Math.round(x.getBoundingClientRect().height) })); });
      dit(note.some((x) => x.k === 'note' && x.ambre && /★ 1,0 · 3 évaluations/.test(x.t)), `${T} N1 — conversation : « ★ 1,0 · 3 évaluations » en ambre`, JSON.stringify(note));
      dit(note.filter((x) => /★ 1,0/.test(x.t)).length >= 2, `${T} N1 — l’offre en attente porte la même étiquette (offre et conversation)`, JSON.stringify(note));
      // ── T : la traduction ──
      const etatT = await lire5(t.pg, '[data-conv-ouverte="60000"]');
      if (o.trad) {
        dit(/Traduire/.test(etatT.texte) && !/ne sait pas traduire/.test(etatT.texte), `${T} T1 — Chrome : message anglais reconnu, « Traduire » présent`, etatT.texte.slice(0, 400));
        const avant = requetes.length;
        await clic(t.pg, '[data-traduire="60000:d"]'); await t.pg.waitForTimeout(500);
        const tr1 = await lire5(t.pg, '[data-traduit]');
        dit(tr1.la && /toujours disponible/.test(tr1.texte) && /Traduit sur cet appareil, depuis : anglais/.test(tr1.texte), `${T} T1 — « Traduire » : le texte traduit SOUS l’original, provenance dite`, tr1.texte);
        // sa réponse
        await ecrire(t.pg, '[data-rep-texte="60000"]', 'Bonjour, oui elle est toujours disponible.'); await t.pg.waitForTimeout(150);
        await t.pg.evaluate(() => { const r = document.getElementById('vrm-badge').shadowRoot.querySelector('[data-trad-rep-lancer]'); if (r) r.scrollIntoView({ block: 'center' }); }); await t.pg.waitForTimeout(150);
        await clic(t.pg, '[data-trad-rep-lancer="60000"]'); await t.pg.waitForTimeout(500);
        const rr = await lire5(t.pg, '[data-conv-ouverte="60000"]');
        const champ0 = await t.pg.evaluate(() => document.getElementById('vrm-badge').shadowRoot.querySelector('[data-rep-texte="60000"]').value);
        dit(champ0 === 'Bonjour, oui elle est toujours disponible.' && /Ta réponse traduite \(anglais\)/.test(rr.texte) && /Hello, yes, it is still available/.test(rr.texte) && /rien ne part avant/.test(rr.texte) && !/Ton texte/.test(rr.texte), `${T} T2 — sa réponse traduite en anglais : SON texte dans le champ, la traduction dessous (les deux, jamais en double), rien ne part`, rr.texte.slice(0, 600));
        dit(!(await envoyes(t.pg)).some((m) => m.action === 'repondreCarte'), `${T} T2 — aucune réponse envoyée par la traduction`);
        await capS(t.pg, N('2-traduction'));
        await clic(t.pg, '[data-trad-rep-utiliser="60000"]'); await t.pg.waitForTimeout(250);
        const champ = await t.pg.evaluate(() => document.getElementById('vrm-badge').shadowRoot.querySelector('[data-rep-texte="60000"]').value);
        const apres = await lire5(t.pg, '[data-trad-rep="utilise"]');
        dit(champ === 'Hello, yes, it is still available.' && apres.la && /Ton texte/.test(apres.texte) && /Bonjour, oui elle est toujours disponible/.test(apres.texte), `${T} T2 — « Mettre la traduction dans le champ » : la traduction dans le champ, SON texte d’origine dit dessous ; son toucher « Envoyer » reste à faire`, champ + ' | ' + apres.texte);
        await capS(t.pg, N('2b-traduction-dans-le-champ'));
        dit((await t.pg.evaluate(() => window.__traductions)).join(',') === 'en>fr,fr>en', `${T} T3 — traductions par l’API du navigateur (en→fr, fr→en)`);
        const nouvelles = requetes.slice(avant).filter((u) => !/^data:|vinted\.net\/banc|logo-vrm/.test(u));
        dit(!nouvelles.length, `${T} T3 — AUCUNE requête réseau pendant les traductions`, nouvelles.join(' | '));
        const env = await envoyes(t.pg);
        dit(!env.some((m) => /tradu/i.test(m.action || '')), `${T} T3 — rien envoyé au fond pour traduire`);
        const rrq = env.filter((m) => m.action === 'reponsesRapides').map((m) => m.langueAcheteur || '');
        dit(rrq.includes('en'), `${T} T4 — la langue reconnue par le navigateur est passée aux réponses rapides (SES versions en anglais d’abord)`, JSON.stringify(rrq));
      } else {
        dit(!/data-traduire/.test(await t.pg.evaluate(() => document.getElementById('vrm-badge').shadowRoot.innerHTML)), `${T} T1 — navigateur sans traducteur : pas de bouton « Traduire »`);
        dit(/semble écrit en : anglais/.test(etatT.texte) && /Chrome 138/.test(etatT.texte) && /aucun service de traduction/.test(etatT.texte), `${T} T1 — UNE ligne dit pourquoi`, etatT.texte.slice(0, 500));
        dit((etatT.texte.match(/ne sait pas traduire/g) || []).length === 1, `${T} T1 — la ligne n’est dite qu’une fois`);
        dit(!/Traduire ma réponse/.test(etatT.texte), `${T} T1 — pas de traduction de sa réponse non plus`);
      }
      await t.pg.evaluate(() => { const z = document.getElementById('vrm-badge').shadowRoot.querySelector('[data-conv-ouverte]'); if (z) z.scrollIntoView({ block: 'start' }); }); await t.pg.waitForTimeout(150);
      await capS(t.pg, N('1-conversation'));
      // ── A : son acceptation à la main, avertissement d'abord ──
      await t.pg.evaluate(() => { const z = document.getElementById('vrm-badge').shadowRoot.querySelector('[data-offres]'); if (z) z.scrollIntoView({ block: 'start' }); }); await t.pg.waitForTimeout(150);
      await clic(t.pg, '[data-offre-quoi="accept"]'); await clic(t.pg, '[data-offre-oui]'); await t.pg.waitForTimeout(300);
      let of = await lire5(t.pg, '[data-offres]');
      const acc1 = (await envoyes(t.pg)).filter((m) => m.action === 'offreCarte');
      dit(acc1.length === 1 && acc1[0].noteVue !== true && /noté ★ 1,0 \(3 évaluations\)/.test(of.texte) && /Accepter quand même/.test(of.texte), `${T} A1 — Accepter sur un acheteur ★ 1,0 : l’avertissement, « Accepter quand même »`, of.texte.slice(0, 400));
      await capS(t.pg, N('3-avertissement'));
      await clic(t.pg, '[data-offre-note-avis]'); await t.pg.waitForTimeout(300);
      const acc2 = (await envoyes(t.pg)).filter((m) => m.action === 'offreCarte');
      dit(acc2.length === 2 && acc2[1].noteVue === true && acc2[1].confirme === true, `${T} A1 — son second toucher : l’acceptation part (noteVue)`, JSON.stringify(acc2));
      dit(!of.petits.length && !of.debord, `${T} A2 — cibles ≥ 44 px, rien ne déborde`, of.petits.join(' · '));
      // ── R : le réglage ──
      await clic(t.pg, '.side6 [data-onglet-b="automatisations"]'); await t.pg.waitForTimeout(400);
      await clic(t.pg, '[data-auto-choix="agent"]'); await t.pg.waitForTimeout(600);
      await t.pg.evaluate(() => { const z = document.getElementById('vrm-badge').shadowRoot.querySelector('[data-na-reglage]'); if (z) z.scrollIntoView({ block: 'start' }); }); await t.pg.waitForTimeout(200);
      const rg = await lire5(t.pg, '[data-na-reglage]');
      dit(rg.la && /Note des acheteurs/.test(rg.texte) && /1,5 ★ ou moins/.test(rg.texte) && /Compte sans évaluation/.test(rg.texte), `${T} R1 — Agent VRM : « Note des acheteurs », seuil 1,5 par défaut, compte neuf`, rg.texte.slice(0, 400));
      await capS(t.pg, N('4-reglage'));
      await t.pg.evaluate(() => { const s = document.getElementById('vrm-badge').shadowRoot.querySelector('[data-na-seuil]'); s.value = '2'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await t.pg.waitForTimeout(300);
      const w = (await envoyes(t.pg)).filter((m) => m.action === 'reglageAuto' && m.cle === 'vinted_bleam');
      dit(w.length === 1 && w[0].valeur.section === 'noteAcheteurs' && w[0].valeur.valeur.seuil === 2 && w[0].valeur.valeur.neufAccepter === true && w[0].valeur.uid === '111', `${T} R1 — changer le seuil écrit SON réglage (section noteAcheteurs, seuil 2)`, JSON.stringify(w));
      dit(!rg.petits.length && !rg.debord, `${T} R2 — cibles ≥ 44 px, rien ne déborde`, rg.petits.join(' · '));
      dit(!t.erreurs.length, `${T} — aucune erreur de page`, t.erreurs.join(' | '));
    });
    await t.ctx.close();
  }
  await nav.close();
  console.log(`\nbanc note-traduction-panneau : ${ok} vert(s), ${ko} rouge(s) — captures : ${S}`);
  process.exit(ko ? 1 : 0);
})();
