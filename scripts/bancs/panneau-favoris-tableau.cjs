// ════════════════════════════════════════════════════════════════════════
//  BANC « LES FAVORIS EN TABLEAU » DU GRAND PANNEAU (21 nov., ext. 5.410.7)
//
//  Julien, 21 nov. : « je veux qu'on ait une liste pour les favoris comme pour les ventes » (le parcours en étapes
//  1 Choisir · 2 Offre et message · 3 Rythme · 4 Confirmer · 5 Suivi, trouvé « nul », est remplacé dans le grand panneau).
//  Le VRAI vrm-badge.js + vrm-ui.js sur une FAUSSE page vinted.fr (faux `chrome`), des favoris INVENTÉS. On juge :
//   T1. le tableau : une rangée par favori, colonnes Article · Prix · Acheteur · Favori le · État (les pièces de
//       « Commandes » : .table6/.tr6/.case5/.art6/.cels6/.et6/plaque), du plus récent au plus ancien, rangées ≥ 56 px ;
//   T2. l'état en étiquette : pas encore contacté, message envoyé, offre faite, à vérifier, ignoré + raison courte ;
//   T3. l'offre prévue (5.410.8) : toujours ; remontée au plancher (prix mini, sinon achat + 10 %), sans plancher au % réglé ;
//   T4. filtres en segments (Tous · Pas encore contactés · Envoyés · Ignorés) avec leurs nombres, recherche, tri ;
//   T5. « tout cocher » (les pas encore contactés seulement) ⇒ la barre basse collée « Envoyer à N favoris » (15 au plus) ;
//   T6. la feuille de confirmation (5.420 : en étapes — sélection, taux, message, récapitulatif) ; RIEN ne part avant « Lancer », puis
//       `lancer` reçoit exactement des favoris cochables, `confirme: true` ;
//   T7. pendant l'envoi : « 3 sur 15 », « Tout arrêter », les rangées passent En attente → Envoi en cours → Message envoyé ;
//   T8. un refus du serveur (« déjà préparés ») se dit SUR les rangées concernées, aucune feuille qui reste ouverte ;
//   T9. « Réglages » ouvre une feuille (5.417 : l’éditeur des messages — versions, rythme), Échap la ferme ;
//   J.  (5.410.8, la file de Julien du 21 nov. : 25 annulés, 1 en attente, 5 envoyés, 1 refus « vinted_robot », file ACTIVE)
//       l'aperçu calculé par la VRAIE règle du serveur (api/_lib/favoris-carte.js) : 26 « Pas encore contacté » avec leur
//       case, « offre X € » sur chacun, la file d'hier dite (« 1 en attente · Reprendre · Annuler la file »), « Annuler
//       l'ancienne file et envoyer à N » ⇒ `lancer` avec `remplacer`, le compteur = les cases cochées visibles ;
//   G.  cibles ≥ 44 px, rien ne déborde, aucune erreur de page — 1512 et 390 (doigt), clair et sombre.
//  `BANC_EXT=<arbre d'avant>/vinted-sync-extension` : la 5.410.6 (rouge attendu : pas de tableau). Tout est inventé.
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
const SORTIE = process.env.BANC_CAPTURES ? path.join(process.env.BANC_CAPTURES, 'panneau-favoris-tableau') : path.join(__dirname, 'captures', 'panneau-favoris-tableau');
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
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGO4eechAAUoApeWrujeAAAAAElFTkSuQmCC', 'base64');

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
    hauteurs: rangs.filter(vis).filter((li) => !li.querySelector('[data-fav6-trancher-ligne]')).map((li) => Math.round(li.getBoundingClientRect().height)),
    // 5.453.2 (Julien, 26 nov.) : un envoi « À vérifier » se tranche SUR sa ligne (« C'est parti » · « Pas parti ») — la rangée
    // porte une ligne de boutons de plus ; jugée à part : ses deux boutons, et une seule ligne de boutons en plus (≤ +48 px).
    tranche: rangs.filter(vis).filter((li) => li.querySelector('[data-fav6-trancher-ligne]')).map((li) => ({ id: li.getAttribute('data-fav-qui'), h: Math.round(li.getBoundingClientRect().height), b: Array.from(li.querySelectorAll('[data-fav6-trancher]')).map((b) => b.getAttribute('data-fav6-trancher')).join(',') })),
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
// (26 nov.) 5.420 (`favorisetapes`, CLAUDE.md §8) : la feuille « confirmer » du grand panneau est un parcours en 4 étapes
// (1 la sélection · 2 la réduction · 3 le message · 4 le récapitulatif et « Lancer ») ; RIEN ne part avant « Lancer ». On
// relève, à chaque étape, ce qu'elle montre et ce qui est parti, sans jamais toucher « Lancer » en chemin.
const etapes = async (pg) => {
  const lire = () => pg.evaluate(() => { const r = document.getElementById('vrm-badge').shadowRoot, f = r.querySelector('.fav6-feuille[data-fav6-feuille="confirmer"]'), q = (s) => (f ? f.querySelector(s) : null);
    const sec = q('[data-fav-etape]');
    return { k: sec ? Number(sec.getAttribute('data-fav-etape')) : null, taux: q('[data-fav-env-taux]') ? q('[data-fav-env-taux]').getAttribute('data-fav-env-taux') : (q('[data-fav-r="taux"]') ? q('[data-fav-r="taux"]').getAttribute('data-taux') : null),
      msg: q('[data-fav-message]') ? q('[data-fav-message]').textContent : '', rythme: q('[data-fav-rythme]') ? q('[data-fav-rythme]').getAttribute('data-fav-rythme') : null,
      lancer: q('[data-fav-lancer]') ? !q('[data-fav-lancer]').disabled : null, suivant: q('[data-fav-etape-suivant]') ? !q('[data-fav-etape-suivant]').disabled : null,
      partis: window.__envoyes.filter((m) => m.action === 'favorisCarte' && m.quoi === 'lancer').length }; });
  const vu = [];
  let e = await lire(); vu.push(e);
  for (let i = 0; i < 4 && e.k != null && e.k < 4 && e.suivant; i++) { await clic(pg, '.fav6-feuille [data-fav-etape-suivant]'); await pg.waitForTimeout(500); e = await lire(); vu.push(e); }
  return { vu, fin: e, taux: (vu.find((x) => x.k === 2) || {}).taux, msg: (vu.find((x) => x.k === 3) || {}).msg || '', partis: Math.max(...vu.map((x) => x.partis)) };
};
const montrer = async (pg, mobile) => {
  const b = await pg.evaluate(() => { const x = document.getElementById('vrm-badge').shadowRoot.querySelector('.btn').getBoundingClientRect(); return { x: x.left + x.width / 2, y: x.top + x.height / 2 }; });
  if (mobile) await pg.touchscreen.tap(b.x, b.y); else { await pg.mouse.move(5, 5); await pg.mouse.move(b.x, b.y); await pg.mouse.click(b.x, b.y); }
  await pg.waitForTimeout(400);
};
// L'état que le fond poserait, puis le signal de chrome.storage (comme `vrmFavorisCarte` qui change).
const poserEtat = async (pg, file) => { await pg.evaluate((f) => { const e = JSON.parse(JSON.stringify(window.__etatBase)); e.site.favoris.file = f; window.__etat = e; for (const l of window.__ecoutes || []) try { l({ vrmFavorisCarte: { newValue: f } }, 'local'); } catch (_) {} }, file); await pg.waitForTimeout(450); };
const cap = async (pg, nom) => { try { await pg.screenshot({ path: path.join(SORTIE, nom + '.png') }); } catch (_) {} };

(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  fs.mkdirSync(SORTIE, { recursive: true });
  const TAILLES = [{ T: '1512 light', largeur: 1512, scheme: 'light' }, { T: '1512 dark', largeur: 1512, scheme: 'dark' }, { T: '390 light', largeur: 390, hauteur: 844, mobile: true, scheme: 'light' }, { T: '390 dark', largeur: 390, hauteur: 844, mobile: true, scheme: 'dark' }];
  for (const o of TAILLES) {
    const T = o.T, N = (s) => T.replace(' ', '-') + '-' + s;
    console.log('\n' + T);
    const t = await ouvrir(nav, Object.assign({}, o, { AP: AP2 }));
    await t.pg.evaluate((e) => { window.__etatBase = e; }, ETAT);
    await essaie(T, async () => {
      await montrer(t.pg, o.mobile);
      await clic(t.pg, '.side6 [data-onglet-b="favoris"]');
      await t.pg.waitForTimeout(400);
      let a = await lireF(t.pg);
      dit(a.page === 'favoris' && a.tableau && !a.etapes, `${T} : Favoris est un TABLEAU (plus d’étapes 1 Choisir…)`, JSON.stringify({ p: a.page, t: a.tableau, e: a.etapes }));
      if (!o.mobile) dit(a.entetes.join('|') === 'Article|Prix|Acheteur|Favori le|État', `${T} : colonnes Article · Prix · Acheteur · Favori le · État, triables`, a.entetes.join('|'));
      dit(a.ids.length === FAV2.length && a.dates.every((d, i) => i === 0 || a.dates[i - 1] >= d), `${T} : ${FAV2.length} rangées, du plus récent au plus ancien`, JSON.stringify(a.ids));
      dit(a.vignettes === FAV2.length && a.plaques === FAV2.filter((x) => x.num).length, `${T} : chaque rangée a sa photo, la plaque N° quand il y en a un`, `${a.vignettes} ${a.plaques}`);
      dit(a.hauteurs.length > 0 && a.hauteurs.every((h) => h >= 56 && h <= (o.mobile ? 140 : 76)), `${T} : rangées de 56 à ${o.mobile ? 140 : 72} px`, a.hauteurs.join(','));
      dit(a.tranche.length === 1 && a.tranche[0].id === 'f12' && a.tranche[0].b === 'parti,pas' && a.tranche[0].h >= 56 && a.tranche[0].h <= (o.mobile ? 140 : 76) + 48, `${T} : 5.453.2 : la rangée « À vérifier » (et elle seule) porte « C'est parti » · « Pas parti », une ligne de boutons de plus au plus`, JSON.stringify(a.tranche));
      const E = (id) => a.etats[id] || '';
      dit(/^nouveau\|Pas encore contacté/.test(E('f0')) && /^offre\|Offre faite/.test(E('f4')) && /^envoye\|Message envoyé/.test(E('f7')) && /^ignore\|Ignoré\|acheteur pas encore confirmé/.test(E('f9')) && /^verifier\|À vérifier/.test(E('f12')) && /^ignore\|Ignoré\|écarté par tes filtres/.test(E('f15')),
        `${T} : l’état en étiquette (pas encore contacté, offre faite, message envoyé, à vérifier, ignoré + raison)`, JSON.stringify([E('f0'), E('f4'), E('f7'), E('f9'), E('f12'), E('f15')]));
      dit(COCHABLES.every((id) => a.cases[a.ids.indexOf(id)]) && a.ids.filter((id, i) => a.cases[i]).length === COCHABLES.length, `${T} : une case seulement sur les favoris pas encore contactés`, '');
      // T3 : 7000 (achat 30 ⇒ plancher 33) offre ; 7001 (mini 46) offre ; 7002 (ni mini ni achat) sans offre ; f3 = 7003 offre 40 < mini 48 ⇒ sans offre.
      dit(a.offres.f0 === 'oui:49.5' && a.offres.f1 === 'oui:54' && a.offres.f2 === 'oui:58.5' && a.offres.f3 === 'remontee:48' && a.offres.f4 === '', `${T} : 5.410.8 : l’offre part toujours ; sans plancher au % réglé (58,50 €) ; sous le prix mini ⇒ REMONTÉE (48 €), jamais dessous`, JSON.stringify([a.offres.f0, a.offres.f1, a.offres.f2, a.offres.f3, a.offres.f4]));
      dit(a.segs.join(' ') === `tous:22* nouveaux:${COCHABLES.length} envoyes:2 ignores:3`, `${T} : segments Tous · Pas encore contactés · Envoyés · Ignorés, avec leurs nombres`, a.segs.join(' '));
      dit(!a.debord && !a.petits.length, `${T} : rien ne déborde, cibles ≥ 44 px`, JSON.stringify({ d: a.debord, p: a.petits.slice(0, 6) }));
      await cap(t.pg, N('1-liste'));
      // T4 : filtres, recherche, tri
      await clic(t.pg, '[data-fav6-filtre="ignores"]'); a = await lireF(t.pg);
      dit(a.ids.join(',') === 'f9,f12,f15', `${T} : « Ignorés » ne montre que les ignorés et à vérifier`, a.ids.join(','));
      await clic(t.pg, '[data-fav6-filtre="nouveaux"]'); a = await lireF(t.pg);
      dit(a.ids.length === COCHABLES.length && a.ids.every((id) => COCHABLES.includes(id)), `${T} : « Pas encore contactés »`, a.ids.join(','));
      await clic(t.pg, '[data-fav6-filtre="tous"]');
      await t.pg.evaluate(() => { const i = document.getElementById('vrm-badge').shadowRoot.querySelector('[data-fav6-cherche]'); i.value = 'acheteur_13'; i.dispatchEvent(new Event('input')); }); await t.pg.waitForTimeout(250); a = await lireF(t.pg);
      dit(a.ids.join(',') === 'f13', `${T} : la recherche trouve un acheteur`, a.ids.join(','));
      await t.pg.evaluate(() => { const i = document.getElementById('vrm-badge').shadowRoot.querySelector('[data-fav6-cherche]'); i.value = ''; i.dispatchEvent(new Event('input')); }); await t.pg.waitForTimeout(250);
      if (!o.mobile) { await clic(t.pg, '[data-fav6-tri="prix"]'); a = await lireF(t.pg); const px = a.ids.map((id) => FAV2.find((x) => x.id === id).prix); dit(a.tri === 'prix:-1' && px.every((p, i) => i === 0 || px[i - 1] >= p), `${T} : tri par prix (en-tête)`, a.tri); await clic(t.pg, '[data-fav6-tri="date"]'); }
      // T5 : tout cocher ⇒ barre basse
      dit(!a.bas, `${T} : sans sélection, pas de barre d’envoi`, JSON.stringify(a.bas));
      await clic(t.pg, '.fav6-table .th6r [data-fav-tout], [data-fav-tout="tous"]'); a = await lireF(t.pg);
      dit(a.coches.length === COCHABLES.length && a.coches.every((id) => COCHABLES.includes(id)), `${T} : « tout cocher » coche les ${COCHABLES.length} pas encore contactés, aucun autre`, a.coches.join(','));
      dit(!!a.bas && a.bas.vis && a.bas.colle === 'sticky' && a.bas.bouton === 'Envoyer à 15 favoris' && !a.bas.off && a.bas.bas <= a.bas.corps + 1, `${T} : barre basse collée « Envoyer à 15 favoris » (15 au plus par envoi), visible`, JSON.stringify(a.bas));
      await cap(t.pg, N('2-selection'));
      // T6 : confirmation — le parcours en étapes (5.420) : 1 → 2 (le taux réglé) → 3 (le message pré-rempli) → 4 (« Lancer »)
      await clic(t.pg, '[data-fav-envoyer]');
      const P = await etapes(t.pg); a = await lireF(t.pg);
      dit(a.feuille && a.feuille.k === 'confirmer' && a.feuille.vis && P.vu[0].k === 1 && P.fin.k === 4 && P.fin.lancer === true && /acheteur_/.test(P.msg) && P.taux === '10' && P.fin.rythme === 'normal', `${T} : la feuille de confirmation (5.419) : message pré-rempli, taux réglé (10 %), rythme au hasard, « Confirmer l’envoi »`, JSON.stringify(P.vu));
      dit(a.envoyes.length === 0 && P.partis === 0, `${T} : rien n’est parti avant « Confirmer l’envoi »`, JSON.stringify(a.envoyes));
      dit(!a.petits.length, `${T} : feuille : cibles ≥ 44 px`, JSON.stringify(a.petits.slice(0, 6)));
      await cap(t.pg, N('3-confirmer'));
      await clic(t.pg, '.fav6-feuille [data-fav-rythme-b="prudent"]');
      await clic(t.pg, '.fav6-feuille [data-fav-lancer]'); await t.pg.waitForTimeout(300); a = await lireF(t.pg);
      const L0 = a.envoyes[0] || {};
      dit(a.envoyes.length === 1 && L0.confirme === true && L0.selection.length === 15 && L0.selection.every((id) => COCHABLES.includes(id)) && L0.rythme === 'prudent', `${T} : « Confirmer l’envoi » ⇒ \`lancer\` avec 15 favoris cochables, confirme, rythme choisi`, JSON.stringify(L0).slice(0, 300));
      // T7 : pendant l'envoi
      const sel = L0.selection || COCHABLES.slice(0, 15);
      const jobs = sel.map((id, i) => [id, i < 3 ? 'envoye' : i === 3 ? 'reserve' : 'attente', '', i === 1 ? 1 : 0]);
      await poserEtat(t.pg, { v: 1, uid: '111', actif: true, debut: Date.now() - 5 * MIN, total: 15, file: { total: 15, envoyes: 3, active: true }, enCours: Date.now(), cours: sel[3], sel, jobs, prochain: null, quoi: '' });
      a = await lireF(t.pg);
      dit(a.envoi && /3 sur 15/.test(a.envoi.texte) && a.envoi.arreter && !a.principalAilleurs, `${T} : en tête de page « 3 sur 15 » et « Tout arrêter » (une seule fois)`, JSON.stringify(a.envoi));
      dit(/^envoye\|/.test(a.etats[sel[0]]) && /^offre\|/.test(a.etats[sel[1]]) && /^encours\|Envoi en cours/.test(a.etats[sel[3]]) && /^attente\|En attente/.test(a.etats[sel[4]]) && !a.cases.some(Boolean), `${T} : les rangées disent Envoyé / Offre faite / Envoi en cours / En attente, aucune case pendant l’envoi`, JSON.stringify(sel.slice(0, 5).map((id) => a.etats[id])));
      await cap(t.pg, N('4-envoi'));
      const jobs2 = sel.map((id, i) => [id, i < 4 ? 'envoye' : 'attente', '', 0]);
      await poserEtat(t.pg, { v: 1, uid: '111', actif: true, debut: Date.now() - 6 * MIN, total: 15, file: { total: 15, envoyes: 4, active: true }, enCours: null, sel, jobs: jobs2, prochain: Date.now() + 70000, quoi: 'rythme' });
      a = await lireF(t.pg);
      dit(/^envoye\|Message envoyé/.test(a.etats[sel[3]]) && /^attente\|En attente · \d/.test(a.etats[sel[4]]) && /4 sur 15/.test(a.envoi && a.envoi.texte), `${T} : en direct : la rangée passe « Message envoyé », la suivante « En attente · heure prévue »`, JSON.stringify([a.etats[sel[3]], a.etats[sel[4]]]));
      await clic(t.pg, '.fav6-envoi [data-fav-arreter]');
      const arr = await t.pg.evaluate(() => window.__envoyes.filter((m) => m.action === 'favorisCarte' && m.quoi === 'arreter').length);
      dit(arr === 1, `${T} : « Tout arrêter » demande l’arrêt au fond`, String(arr));
    });
    await t.ctx.close();
    // T8 : un refus du serveur, sur les rangées ; T9 : Réglages
    const t2 = await ouvrir(nav, Object.assign({}, o, { AP: AP2 }));
    await essaie(T + ' refus', async () => {
      await t2.pg.evaluate(() => { window.__refusLancer = { ok: false, code: 'serveur', raison: 'Ces destinataires ont déjà été préparés pour ces articles. Aucun nouvel envoi.', ids: ['f0', 'f1'], travail: true }; });
      await montrer(t2.pg, o.mobile); await clic(t2.pg, '.side6 [data-onglet-b="favoris"]'); await t2.pg.waitForTimeout(300);
      await clic(t2.pg, '.fav6-table li[data-fav-qui="f0"] input[data-fav-coche]');
      await clic(t2.pg, '.fav6-table li[data-fav-qui="f1"] .art6');
      let a = await lireF(t2.pg);
      dit(a.coches.join(',') === 'f0,f1' && a.bas && a.bas.n === '2', `${T} : cocher la case, puis toucher la rangée entière : 2 cochés`, JSON.stringify({ c: a.coches, b: a.bas }));
      await clic(t2.pg, '[data-fav-envoyer]'); await etapes(t2.pg); await clic(t2.pg, '.fav6-feuille [data-fav-lancer]'); await t2.pg.waitForTimeout(300); a = await lireF(t2.pg);
      dit(!a.feuille && /^refus\|Pas parti\|Ces destinataires ont déjà été préparés/.test(a.etats.f0) && /^refus\|/.test(a.etats.f1) && /^nouveau\|/.test(a.etats.f5) && /déjà été préparés/.test(a.erreur), `${T} : refus du serveur ⇒ dit SUR les deux rangées (et en haut), la feuille fermée, les autres intactes`, JSON.stringify({ f0: a.etats.f0, f5: a.etats.f5, e: a.erreur, fe: a.feuille }));
      await cap(t2.pg, N('5-refus'));
      await clic(t2.pg, '[data-fav6-reglages]'); a = await lireF(t2.pg);
      dit(a.feuille && a.feuille.k === 'reglages' && a.feuille.textes >= 3, `${T} : « Réglages » ouvre une feuille (versions du message, rythme)`, JSON.stringify(a.feuille));
      await cap(t2.pg, N('6-reglages'));
      await t2.pg.keyboard.press('Escape'); await t2.pg.waitForTimeout(250); a = await lireF(t2.pg);
      dit(!a.feuille && a.tableau, `${T} : Échap ferme la feuille, le panneau reste`, JSON.stringify({ f: a.feuille, t: a.tableau }));
      dit(!t.erreurs.length && !t2.erreurs.length, `${T} : aucune erreur de page`, JSON.stringify(t.erreurs.concat(t2.erreurs)));
    });
    await t2.ctx.close();
  }

  // ── J : la file de Julien ──
  const APJ = await apercuJulien();
  for (const o of [TAILLES[0], TAILLES[2]]) {
    const T = o.T + ' J', N = (x) => o.T.replace(' ', '-') + '-J-' + x;
    console.log('\n' + T);
    const t = await ouvrir(nav, Object.assign({}, o, { AP: APJ }));
    await essaie(T, async () => {
      await montrer(t.pg, o.mobile); await clic(t.pg, '.side6 [data-onglet-b="favoris"]'); await t.pg.waitForTimeout(400);
      let a = await lireF(t.pg);
      const nouveaux = Object.values(a.etats).filter((x) => /^nouveau\|/.test(x)).length;
      dit(a.ids.length === 32 && nouveaux === 26 && /^nouveau\|/.test(a.etats.n0) && /^nouveau\|/.test(a.etats.n31) && /^attente\|En attente/.test(a.etats.n25) && /^(envoye|offre)\|/.test(a.etats.n26), `${T} : 25 annulés + 1 refus « vinted_robot » = 26 « Pas encore contacté » ; l’attente « En attente » ; les envoyés « Message envoyé »`, JSON.stringify([nouveaux, a.etats.n0, a.etats.n25, a.etats.n26, a.etats.n31]));
      dit(a.segs.join(' ') === 'tous:32* nouveaux:26 envoyes:6 ignores:0', `${T} : segments justes (personne « Ignoré · pas parti » pour une file annulée)`, a.segs.join(' '));
      dit(a.casesVues === 26, `${T} : une case VISIBLE de 44 px sur chacune des 26 rangées cochables`, String(a.casesVues));
      dit(Object.entries(a.offres).filter(([id, v]) => /^nouveau/.test(a.etats[id])).every(([, v]) => /^oui:\d/.test(v)), `${T} : « offre X € » sur chaque rangée (au % réglé, aucun plancher connu ici)`, JSON.stringify(a.offres).slice(0, 200));
      dit(a.fileHier && a.fileHier.k === 'active' && a.fileHier.n === '1' && a.fileHier.reprendre && a.fileHier.annuler, `${T} : la file d’hier est DITE : « 1 en attente · Reprendre · Annuler la file »`, JSON.stringify(a.fileHier));
      await cap(t.pg, N('1-file'));
      await clic(t.pg, '.fav6-table li[data-fav-qui="n0"] input[data-fav-coche]'); await clic(t.pg, '.fav6-table li[data-fav-qui="n31"] .art6');
      a = await lireF(t.pg);
      dit(a.bas && a.bas.n === '2' && a.cochesVues === 2 && /Annuler l’ancienne file et envoyer à 2/.test(a.bas.bouton), `${T} : 2 cases cochées ⇒ « 2 cochés » et « Annuler l’ancienne file et envoyer à 2 »`, JSON.stringify({ b: a.bas, c: a.cochesVues }));
      await cap(t.pg, N('2-remplacer'));
      await clic(t.pg, '[data-fav-envoyer]'); await etapes(t.pg); await clic(t.pg, '.fav6-feuille [data-fav-lancer]'); await t.pg.waitForTimeout(300); a = await lireF(t.pg);
      const L = a.envoyes[0] || {};
      dit(a.envoyes.length === 1 && L.remplacer === true && L.confirme === true && L.selection.slice().sort().join(',') === 'n0,n31', `${T} : « Confirmer l’envoi » ⇒ \`lancer\` des 2 favoris avec \`remplacer\` (l’ancienne file annulée d’abord)`, JSON.stringify(L).slice(0, 240));
    });
    await t.ctx.close();
    const t2 = await ouvrir(nav, Object.assign({}, o, { AP: APJ }));
    await essaie(T + ' reprendre', async () => {
      await montrer(t2.pg, o.mobile); await clic(t2.pg, '.side6 [data-onglet-b="favoris"]'); await t2.pg.waitForTimeout(400);
      await clic(t2.pg, '[data-fav6-continuer]'); await t2.pg.waitForTimeout(200);
      await clic(t2.pg, '[data-fav6-annuler]'); await t2.pg.waitForTimeout(200);
      const a = await lireF(t2.pg);
      dit(a.autres.join(',') === 'continuer,arreter', `${T} : « Reprendre » demande au fond de mener la file d’hier, « Annuler la file » l’arrête`, a.autres.join(','));
      dit(!t2.erreurs.length, `${T} : aucune erreur de page`, JSON.stringify(t2.erreurs));
    });
    await t2.ctx.close();
  }
  // ── Z (5.440.1, Julien 23 nov. 19:44) : « … puis touche « » coupé, « plusieurs favoris de suite » après UN refus, et « 1 sauté »
  //    / « 1 refusé » / « 1 pas envoyé » pour le MÊME favori. La file est jouée par la VRAIE file du serveur (3 refus d'identité
  //    de suite sur 5) ; le panneau montre la fin ET la file en pause : la phrase ENTIÈRE finit par « Reprendre », les nombres
  //    viennent de la règle du bilan, un mot par état (pas envoyé · en attente), jamais « sauté » ni « refusé » pour eux.
  const { favZ, finZ } = await (async () => {
    const F = await import(pathToFileURL(path.join(RACINE, 'api', '_lib', 'favoris-file.js')).href);
    const P = await import(pathToFileURL(path.join(RACINE, 'src', 'favorisProgression.js')).href);
    const C = await import(pathToFileURL(path.join(RACINE, 'api', '_lib', 'favoris-carte.js')).href);
    let d = null, now = T0 - 30 * MIN, n = 0; const maj = (x) => { if (x.data) d = x.data; return x.valeur; };
    const notifs = Array.from({ length: 8 }, (_, i) => ({ id: 'z' + i, user_id: 800 + i, body: `acheteur_${i} a ajouté ton article à ses favoris.`, link: `/items/${7100 + i}/want_it/new?offering_id=${800 + i}`, created_at: new Date(T0 - (i + 1) * 20 * MIN).toISOString() }));
    maj(F.lancerFile(d, { owner: 'o', targets: notifs.slice(0, 5).map((x, i) => ({ itemId: String(7100 + i), recipientId: String(800 + i), notificationId: x.id, initiator: 'favourite' })), message: 'Bonjour', intervalleMinutes: 0, maintenant: now, lot: 'LZ' }));
    let vue = null;
    for (let i = 0; i < 3; i++) { now += 60000; const jeton = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`; maj(F.reserverFile(d, { owner: 'o', maintenant: now, jeton, suivi: 's' })); maj(F.consommerFile(d, { owner: 'o', jeton, maintenant: now })); maj(F.verifierReservation(d, { owner: 'o', jeton, maintenant: now }));
      const t = P.traduireResultatFavori({ ok: false, data: { resultat: 'refuse', raison: 'identite_non_confirmee', ecrits: 0, etape: 'conversation', cause: 'lien_autre' } });
      vue = maj(F.terminerFile(d, { owner: 'o', jeton, resultat: t.resultat, raison: t.raison, maintenant: now + 1000, ecrits: 0, etape: t.etape, cause: t.cause })); }
    const items = notifs.map((_, i) => ({ id: 7100 + i, title: 'Nike Air Max 1 bleu taille 4' + i, price: { amount: '60.0', currency_code: 'EUR' }, photo: { url: img('z' + i) } }));
    const ap = C.apercuCarte({ prefs: { version: 1, envoisActifs: false, message: 'Bonjour', pourcentage: 5, offreMode: 'pct', intervalleMinutes: 1 }, capture: { payload: { notifications: notifs }, domain: 'www.vinted.fr' }, vue, dressing: { cap: new Date(T0 - 10 * MIN).toISOString(), pg: { total_entries: 8 }, items }, prouve: () => true, maintenant: T0 });
    const carte = C.resumeFileCarte(vue, T0);
    const fin = { at: Date.now(), raison: 'interrompu', texte: vue.raison, code: vue.raisonCode, refus: vue.raisonRefus, n: vue.raisonN, bilan: P.phraseBilanFavoris(vue.bilan) };
    return { favZ: ap, finZ: { actif: false, total: 5, file: carte, fin } };
  })();
  for (const o of TAILLES) {
    const T = o.T + ' Z', N = (x) => o.T.replace(' ', '-') + '-Z-' + x;
    console.log('\n' + T);
    const t = await ouvrir(nav, Object.assign({}, o, { AP: favZ }));
    await essaie(T, async () => {
      await t.pg.evaluate(({ base, st }) => { const e = JSON.parse(JSON.stringify(base)); e.site.favoris.file = st; window.__etat = e; for (const f of (window.__ecoutes || [])) try { f({}, 'local'); } catch (_) {} }, { base: ETAT, st: finZ });
      await montrer(t.pg, o.mobile); await clic(t.pg, '.side6 [data-onglet-b="favoris"]'); await t.pg.waitForTimeout(500);
      const z = await t.pg.evaluate(() => { const r = document.getElementById('vrm-badge').shadowRoot, q = (s) => r.querySelector(s);
        const fin = q('[data-fav="fini"]'), ban = q('[data-fav6-file]');
        const vis = (el) => !!(el && el.getClientRects().length);
        const deb = (el) => { if (!el) return 0; const b = el.getBoundingClientRect(); return [...el.querySelectorAll('*')].filter((x) => { const c = x.getBoundingClientRect(); return c.width && c.right > b.right + 1; }).length; };
        return { fin: fin ? fin.innerText : '', comptes: fin && q('[data-fav="fini"] [data-fav-comptes]') ? q('[data-fav="fini"] [data-fav-comptes]').getAttribute('data-fav-comptes') : '', raison: q('[data-fav-raison-fin]') ? q('[data-fav-raison-fin]').innerText : '',
          bilan: q('[data-fav-bilan]') ? q('[data-fav-bilan]').innerText : '', ban: ban ? ban.innerText : '', banRaison: q('[data-fav6-file-raison]') ? q('[data-fav6-file-raison]').innerText : '', banK: ban ? ban.getAttribute('data-fav6-file') + ':' + ban.getAttribute('data-fav6-attente') : '',
          visibles: vis(fin) && vis(ban), deborde: deb(fin) + deb(ban), larg: innerWidth, sw: document.documentElement.scrollWidth }; });
      if (process.env.DEBUG_Z) console.log(JSON.stringify({ etat: favZ.etat, raison: favZ.raison, file: favZ.file, ban: z.ban }).slice(0, 900));
      const fini = (x) => /« Reprendre »\.$/.test(String(x).trim());
      dit(fini(z.raison) && /^Interrompu : 3 favoris de suite ne sont pas partis \(le dernier : article ou destinataire pas confirmé\)/.test(z.raison) && !/plusieurs/.test(z.raison), `${T} : la fin dit « 3 favoris de suite … (le dernier : article ou destinataire pas confirmé) » ENTIÈRE, finie par « Reprendre »`, z.raison);
      dit(fini(z.banRaison) && z.banK === 'pause:2', `${T} : la file en pause (2 en attente) répète la phrase ENTIÈRE, finie par « Reprendre »`, z.banK + ' ' + z.banRaison);
      dit(z.comptes === '3:0:2:0' && /3 pas envoyés · 2 en attente/.test(z.fin) && !/sauté|refusé|pas envoyé\(s\)/.test(z.fin.split('\n').slice(0, 2).join(' ')), `${T} : les nombres de la règle du bilan, un mot par état : « 0 envoyé · 3 pas envoyés · 2 en attente »`, z.comptes + ' | ' + z.fin.split('\n').slice(0, 2).join(' / '));
      dit(/^0 envoyé · 3 pas envoyés : article ou destinataire pas confirmé$/.test(z.bilan), `${T} : le bilan dit « pas envoyés » (plus « refusé »)`, z.bilan);
      dit(z.visibles && !z.deborde && z.sw <= z.larg, `${T} : tout est visible, rien ne déborde`, JSON.stringify({ v: z.visibles, d: z.deborde, sw: z.sw, l: z.larg }));
      dit(!t.erreurs.length, `${T} : aucune erreur de page`, JSON.stringify(t.erreurs));
      await cap(t.pg, N('fin-pause'));
    });
    await t.ctx.close();
  }
  await nav.close();
  console.log(ko ? `\n❌ panneau-favoris-tableau : ${ko} rouge(s) sur ${ok + ko}` : `\n✅ panneau-favoris-tableau : ${ok} contrôles`);
  process.exit(ko ? 1 : 0);
})();
