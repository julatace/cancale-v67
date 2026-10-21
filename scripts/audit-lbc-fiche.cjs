// ════════════════════════════════════════════════════════════════════════════
//  LA FICHE « PUBLIER SUR LEBONCOIN » DE L'APP (5.182) — l'annonce CORRIGÉE dans
//  VRM arrive à la page de dépôt, et rien d'autre.
//
//  Julien, 16 octobre : « je veux que le poste d'annonce sur leboncoin se fasse
//  comme pour eBay, pour tout gérer depuis VRM ». L'app envoie maintenant le
//  titre, la description, le prix, l'état et les photos choisies. Ce qui doit
//  rester vrai, exécuté sur le VRAI background.js dans un `vm` (§4.10) :
//   1. la règle (`<annonce-lbc-regle>`) est la MÊME, texte pour texte, dans
//      l'app et l'extension — et rend les mêmes sorties sur les mêmes entrées ;
//   2. une fiche valide : le titre, le prix, l'état, les photos (dans l'ORDRE
//      choisi) et la description arrivent dans la paire en attente du dépôt ;
//   3. l'identité vient TOUJOURS de la file : une paire vendue / absente reste
//      refusée même avec une fiche ; un titre glissé hors de `annonce` ne part
//      jamais ;
//   4. l'extension REVÉRIFIE : titre > 50, prix qui n'est pas un nombre, photo
//      d'un autre site, photo non captée ⇒ REFUSÉ, rien ne s'ouvre, rien n'est
//      mémorisé ; la référence VRM-{n°} retirée est remise ;
//   5. l'avancement dit par lbc.js (`depotProgres`) arrive dans la commande que
//      l'app suit — nettoyé (étape connue, nombres bornés, libellés courts) — et
//      seulement pour un dépôt EN COURS ;
//   6. le double clic n'ouvre qu'UN dépôt.
//  `--src chemin` exécute une autre copie de background.js (preuve sur le code
//  d'avant, §6.1). Aucune donnée réelle : tout est inventé (dépôt public).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), vm = require('vm'), path = require('path');
const iSrc = process.argv.indexOf('--src');
const SRC_BG = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(__dirname, '..', 'vinted-sync-extension', 'background.js');
const iApp = process.argv.indexOf('--app');
const SRC_APP = iApp > 0 ? path.resolve(process.argv[iApp + 1]) : path.join(__dirname, '..', 'src', 'App.jsx');
const src = fs.readFileSync(SRC_BG, 'utf8');
const app = require('./_source-app.cjs')(SRC_APP);
const dual = (v) => function (...a) { const cb = a[a.length - 1]; if (typeof cb === 'function') { cb(v); return; } return Promise.resolve(v); };
let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`✅ ${quoi}`); } else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + det : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`❌ ${quoi} — a levé : ${e && e.message}`); return null; } };

const PH = ['https://images1.vinted.net/t/01_a/f800/1.jpeg?s=aa', 'https://images1.vinted.net/t/01_b/f800/2.jpeg?s=bb', 'https://images1.vinted.net/t/01_c/f800/3.jpeg?s=cc'];
const AD = { id: '1001', numero: '401', title: 'Salomon XT-6 blanc taille 40', price: '99.00', photos: PH, ref: 'VRM-401', etat: 'Très bon état', category: 'Chaussures',
  description: '📦 Réf. VRM-401\n\nTrès bon état.\n\nRéf. VRM-401' };

// ── 1. LA RÈGLE PARTAGÉE ────────────────────────────────────────────────────
function bloc(texte) {
  const m = /\/\/ <annonce-lbc-regle>[^\n]*\n([\s\S]*?)\/\/ <\/annonce-lbc-regle>/.exec(texte);
  return m ? m[1] : null;
}
function charger(texte) {
  const b = bloc(texte);
  if (!b) return null;
  const ctx = { URL, Map, Set };
  vm.createContext(ctx);
  vm.runInContext('const LBC_TITRE_MAX = 50;\n' + b + '\n;this.v = valideAnnonceLbc; this.d = descriptionLbcDe; this.c = categorieLbcDe; this.k = clePhotoLbc;', ctx);
  return ctx;
}
const CAS = [
  { title: AD.title, description: AD.description, price: '99,00', photos: [PH[2], PH[0]], etat: 'Bon état' },
  { title: 'x'.repeat(51), description: 'a', price: '10', photos: [PH[0]] },
  { title: 'Ok', description: 'sans ref', price: '12.5', photos: [PH[0]] },
  { title: 'Ok', description: 'd', price: 'abc', photos: [PH[0]] },
  { title: 'Ok', description: 'd', price: '-3', photos: [PH[0]] },
  { title: 'Ok', description: 'd', price: '10', photos: ['https://evil.example/1.jpeg'] },
  { title: 'Ok', description: 'd', price: '10', photos: ['https://images1.vinted.net/t/99_z/f800/9.jpeg'] },
  { title: 'Ok', description: 'd', price: '10', photos: [] },
  { title: 'Ok', description: 'd', price: '10', photos: [PH[0].replace('/f800/', '/f1200/')] },
  { title: 'Ok', description: 'd', price: '10', photos: [PH[0]], etat: 'Comme neuf' },
  { title: 'Ok', description: 'd', price: '10', photos: [PH[0]], etat: 'Très bon état' },
  { title: 'Ok', description: 'y'.repeat(4001), price: '10', photos: [PH[0]] },
];
{
  const bApp = bloc(app), bExt = bloc(src);
  dit(!!bApp && !!bExt, 'la règle de la fiche existe des DEUX côtés (bloc <annonce-lbc-regle>)', `app:${!!bApp} ext:${!!bExt}`);
  dit(!!bApp && bApp === bExt, 'et c\'est le MÊME texte (§11 : une règle, deux lecteurs)');
  const A = charger(app), E = charger(src);
  if (A && E) {
    const base = { ref: AD.ref, photos: PH, etat: AD.etat };
    const sa = CAS.map((c) => JSON.stringify(A.v(c, base))), se = CAS.map((c) => JSON.stringify(E.v(c, base)));
    dit(sa.every((x, i) => x === se[i]), 'les deux rendent la même chose sur les mêmes fiches', String(sa.findIndex((x, i) => x !== se[i])));
    const r = CAS.map((c) => E.v(c, base));
    dit(r[0].ok && r[0].annonce.photos[0] === PH[2] && r[0].annonce.photos[1] === PH[0] && r[0].annonce.price === '99', 'fiche valide : photos dans l\'ordre CHOISI, prix « 99,00 » lu 99', JSON.stringify(r[0]));
    dit(!r[1].ok && r[1].erreurs[0].champ === 'title', 'titre de 51 caractères : refusé');
    dit(r[2].ok && /Réf\. VRM-401$/.test(r[2].annonce.description), 'référence retirée de la description : remise à la fin', r[2].ok ? r[2].annonce.description : '');
    dit(!r[3].ok && !r[4].ok, 'un prix qui n\'est pas un nombre positif : refusé');
    dit(!r[5].ok && !r[6].ok && !r[7].ok, 'photo d\'un autre site, photo non captée, aucune photo : refusé');
    dit(r[8].ok && r[8].annonce.photos[0] === PH[0], 'la même photo dans un autre format (f1200) est reconnue — et c\'est l\'URL CAPTÉE qui part');
    dit(!r[9].ok && r[10].ok, 'état : un libellé inventé refusé, un libellé mesuré accepté');
    dit(!r[11].ok, 'description de plus de 4 000 caractères : refusée');
    const dApp = A.d({ ref: 'VRM-7', texte: 'Top', base: 'b', marque: 'Nike', taille: '42', etat: 'Bon état', couleur: '' });
    dit(dApp === E.d({ ref: 'VRM-7', texte: 'Top', base: 'b', marque: 'Nike', taille: '42', etat: 'Bon état', couleur: '' }) && /^📦 Réf\. VRM-7/.test(dApp) && /Réf\. VRM-7$/.test(dApp), 'la description proposée est la même des deux côtés, avec la référence en haut ET en bas');
    dit(A.c('Nike air max', '', '42') === 'Chaussures' && E.c('sweat gris', '', 'M') === 'Vêtements' && A.c('objet', '', 'M') === '', 'la catégorie montrée par la fiche suit la règle de l\'extension (et ne force rien d\'inconnu)');
  }
  // L'extension se sert bien de la règle partagée pour sa propre description.
  dit(/const description = descriptionLbcDe\(/.test(src) && /return categorieLbcDe\(/.test(src), 'buildLbcAd et lbcCategory passent par la règle partagée (pas une seconde copie)');
}

// ── 2-6. LE VRAI background.js ──────────────────────────────────────────────
function faire({ queue = [AD], preuveKO = false } = {}) {
  const store = {}; const onglets = []; let ecouteur = null; const evts = [];
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms || 0, 1)), clearTimeout, setInterval: () => 0, clearInterval,
    URL, TextDecoder, TextEncoder,
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'), atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    fetch: async () => ({ ok: true, status: 200, json: async () => [], text: async () => '[]', headers: { get: () => '' } }),
    chrome: {
      runtime: { onInstalled: { addListener() {} }, onStartup: { addListener() {} }, onMessage: { addListener(fn) { ecouteur = fn; } }, getManifest: () => ({ version: '9.9.9' }), lastError: null, id: 'x' },
      alarms: { create() {}, onAlarm: { addListener() {} } },
      cookies: { get: dual(null), getAll: dual([]), onChanged: { addListener() {} } },
      downloads: { onCreated: { addListener() {} } },
      action: { setBadgeText() {}, setBadgeBackgroundColor() {}, setTitle() {}, onClicked: { addListener() {} }, setPopup() {} },
      tabs: { onUpdated: { addListener() {} }, onActivated: { addListener() {} }, onRemoved: { addListener() {} },
        query: async () => [{ id: 99, url: 'https://vrm.center/' }],
        sendMessage: (id, m, cb) => { if (m && m.__vmrEvt) evts.push(JSON.parse(JSON.stringify(m.evt))); if (typeof cb === 'function') cb(); },
        get: async (id) => ({ id, url: 'https://www.leboncoin.fr/deposer-une-annonce', status: 'loading' }),
        update: async () => ({}),
        create: async (o) => { onglets.push(o.url); return { id: 50 + onglets.length }; } },
      windows: { update: async () => ({}) },
      storage: { local: {
        get(k, cb) { const cles = Array.isArray(k) ? k : (typeof k === 'string' ? [k] : Object.keys(k || {})); const out = {}; for (const c of cles) if (store[c] !== undefined) out[c] = store[c]; if (typeof cb === 'function') { cb(out); return; } return Promise.resolve(out); },
        set(o, cb) { Object.assign(store, JSON.parse(JSON.stringify(o))); if (typeof cb === 'function') { cb(); return; } return Promise.resolve(); },
        remove: dual(undefined),
      }, onChanged: { addListener() {} } },
      webNavigation: { onCompleted: { addListener() {} } },
      scripting: { executeScript: dual([]) },
    },
  };
  ctx.self = ctx; ctx.globalThis = ctx; ctx.window = undefined;
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'background.js' });
  ctx.buildLbcData = async () => ({ queue: JSON.parse(JSON.stringify(queue)), removals: [], unlinked: [], stats: { preuveKO }, postedList: [] });
  ctx.markLbcPosted = async () => true;
  ctx.compteConnecte = async () => null;   // aucune lecture Vinted dans ce banc
  const cmd = (msg) => new Promise((res) => {
    ecouteur(Object.assign({ from: 'vmr-bridge', action: 'cmd' }, msg), { origin: 'https://vrm.center', url: 'https://vrm.center/' }, res);
  });
  const lbc = (msg, tabId = 51) => new Promise((res) => { ecouteur(Object.assign({ from: 'cancale-lbc' }, msg), { tab: { id: tabId, url: 'https://www.leboncoin.fr/deposer-une-annonce' } }, res); });
  return { ctx, store, onglets, cmd, lbc, evts };
}
const FICHE = { title: 'Salomon XT-6 « Wings » blanc taille 40', description: 'Ma description à moi.\n\nRéf. VRM-401', price: '87,50', etat: 'Bon état', photos: [PH[2], PH[0]] };

(async () => {
  await essaie('fiche valide', async () => {
    const b = faire();
    const r = await b.cmd({ cmd: 'lbcPublier', id: '1001', annonce: FICHE, title: 'GLISSÉ HORS FICHE' });
    dit(r && r.accepte === true && r.jobId === 'lbc:1001', 'une fiche valide est acceptée', JSON.stringify(r));
    const p = b.store.vrmPendingAd && b.store.vrmPendingAd.ad;
    dit(p && p.title === FICHE.title, 'le TITRE corrigé arrive dans la paire en attente du dépôt', p && p.title);
    dit(p && p.price === '87.5', 'le PRIX corrigé aussi (en euros, lu « 87,50 »)', p && p.price);
    dit(p && Array.isArray(p.photos) && p.photos.length === 2 && p.photos[0] === PH[2] && p.photos[1] === PH[0], 'les PHOTOS choisies, dans l\'ordre choisi (la couverture d\'abord)', p && JSON.stringify(p.photos));
    dit(p && p.description === FICHE.description && p.etat === 'Bon état', 'la description et l\'état corrigés aussi');
    dit(p && p.titreEdite === true && p.descriptionEditee === true && p.prixEdite === true, 'et lbc.js sait quels champs POSER par-dessus ce que Leboncoin aurait écrit', p && JSON.stringify({ t: p.titreEdite, d: p.descriptionEditee, pr: p.prixEdite }));
    dit(p && p.id === '1001' && p.numero === '401' && p.ref === 'VRM-401' && p.category === 'Chaussures' && p.publier === true, 'l\'identité, le N°, la référence et la catégorie restent ceux de la FILE (feu vert de publication pour CETTE paire)');
    dit(b.onglets.length === 1 && /leboncoin\.fr\/deposer-une-annonce/.test(b.onglets[0]), 'et UNE page de dépôt s\'ouvre', b.onglets.join(','));
    // 5. L'AVANCEMENT
    const r2 = await b.lbc({ action: 'depotProgres', id: '1001', progres: { etape: 'photos', photos: { posees: 1, total: 2, confirmees: null, rates: 0 }, champs: 3, manque: ['Univers', 'x'.repeat(200)], pirate: '<script>' } });
    const c = (b.store.vrmCmds || {})['lbc:1001'];
    dit(r2 && r2.ok && c && c.progres && c.progres.etape === 'photos' && c.progres.photos.posees === 1 && c.progres.photos.total === 2, 'l\'avancement dit par lbc.js arrive dans la commande que l\'app suit (photos posées 1/2)', JSON.stringify(c && c.progres));
    dit(c && c.progres && !('pirate' in c.progres) && c.progres.manque[1].length <= 40, 'nettoyé : aucun champ inconnu, libellés bornés');
    await new Promise((res) => setTimeout(res, 30));
    dit(b.evts.some((e) => e.type === 'cmd' && e.jobId === 'lbc:1001' && e.progres && e.progres.etape === 'photos'), 'et l\'app est PRÉVENUE (évènement `cmd` avec l\'avancement)');
    await b.lbc({ action: 'depotProgres', id: '1001', progres: { etape: 'champ-manquant', manque: ['Univers'] } });
    dit(((b.store.vrmCmds || {})['lbc:1001'].progres || {}).manque?.[0] === 'Univers', 'champ obligatoire manquant : l\'app sait LEQUEL (« Univers »)');
    await b.lbc({ action: 'depotProgres', id: '1001', progres: { etape: 'photos' } }, 777);
    dit(((b.store.vrmCmds || {})['lbc:1001'].progres || {}).etape === 'champ-manquant', 'une AUTRE page de dépôt ne parle pas à la place de celle de cette paire');
    await b.lbc({ action: 'markPosted', id: '1001' });
    const fin = (b.store.vrmCmds || {})['lbc:1001'];
    dit(fin && fin.etape === 'fait', 'publiée : la commande passe à « fait »');
    await b.lbc({ action: 'depotProgres', id: '1001', progres: { etape: 'photos' } });
    dit(((b.store.vrmCmds || {})['lbc:1001'] || {}).etape === 'fait' && ((b.store.vrmCmds || {})['lbc:1001'].progres || {}).etape === 'champ-manquant', 'et un avancement tardif ne réécrit pas un dépôt terminé');
  });
  await essaie('fiche invalide', async () => {
    const mauvaises = [
      ['titre trop long', { ...FICHE, title: 'x'.repeat(51) }],
      ['prix pas un nombre', { ...FICHE, price: 'gratuit' }],
      ['photo d\'un autre site', { ...FICHE, photos: ['https://evil.example/x.jpeg'] }],
      ['photo non captée', { ...FICHE, photos: ['https://images1.vinted.net/t/99_z/f800/9.jpeg'] }],
      ['aucune photo', { ...FICHE, photos: [] }],
    ];
    for (const [quoi, f] of mauvaises) {
      const b = faire();
      const r = await b.cmd({ cmd: 'lbcPublier', id: '1001', annonce: f });
      dit(r && r.accepte === false && r.code === 'invalide' && !b.onglets.length && !b.store.vrmPendingAd && r.raison, `${quoi} : REFUSÉ par l'extension, rien ne s'ouvre, rien n'est mémorisé`, JSON.stringify(r));
    }
    const b = faire();
    const r = await b.cmd({ cmd: 'lbcPublier', id: '1001', annonce: { ...FICHE, description: 'Sans référence.' } });
    const p = b.store.vrmPendingAd && b.store.vrmPendingAd.ad;
    dit(r && r.accepte && p && /Réf\. VRM-401$/.test(p.description), 'référence retirée par la fiche : l\'extension la remet', p && p.description);
  });
  await essaie('identité', async () => {
    const b = faire({ queue: [] });
    const r = await b.cmd({ cmd: 'lbcPublier', id: '1001', annonce: FICHE });
    dit(r && r.accepte === false && r.code === 'absente' && !b.onglets.length, 'une paire absente de la file (vendue, décochée, déjà publiée) reste REFUSÉE, même avec une fiche', JSON.stringify(r));
    const b2 = faire({ preuveKO: true });
    const r2 = await b2.cmd({ cmd: 'lbcPublier', id: '1001', annonce: FICHE });
    dit(r2 && r2.accepte === false && r2.code === 'preuve', 'preuve de vente illisible : refusée aussi (« pas su » ≠ « pas vendue »)');
    const b3 = faire();
    await b3.cmd({ cmd: 'lbcPublier', id: '1001' });
    const p3 = b3.store.vrmPendingAd && b3.store.vrmPendingAd.ad;
    dit(p3 && p3.title === AD.title && !p3.edite, 'sans fiche (extension appelée comme avant) : la version de la file part, inchangée');
  });
  await essaie('double clic', async () => {
    const b = faire();
    const [r1, r2] = await Promise.all([b.cmd({ cmd: 'lbcPublier', id: '1001', annonce: FICHE }), b.cmd({ cmd: 'lbcPublier', id: '1001', annonce: FICHE })]);
    dit([r1, r2].filter((r) => r && r.accepte).length === 1 && b.onglets.length === 1, 'double clic : UN seul dépôt ouvert', JSON.stringify([r1 && r1.code, r2 && r2.code]));
  });
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
