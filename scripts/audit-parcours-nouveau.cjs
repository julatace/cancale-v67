#!/usr/bin/env node
// ── audit-parcours-nouveau — LE PARCOURS D'UN NOUVEAU, L'ONGLET « NOUVEAUX COMPTES »,
//    LA RÉPONSE AUX SIGNALEMENTS, LE CENTRE D'AIDE À JOUR (15 nov.) ─────────────────
// Exécute les VRAIES règles (src/parcoursNouveau/regle.js, src/modeExemple.js,
// api/_lib/parcours-comptes.js, api/_lib/signalement.js) et lit la coque, la route
// (api/compte.js), vercel.json et le centre d'aide. Récit : docs/passation/2026-11-15-parcours-nouveau.md
//   R  la règle du parcours : jamais le propriétaire, jamais « pas su », jamais en mode
//      exemple ; un compte neuf seulement ; repris s'il est commencé ; « pas su » ≠ « fait » ;
//      les écritures ont la forme des réglages de toujours ;
//   B  le bac à sable : seulement dans le cadre nommé, posé par une page de la MÊME origine ;
//      stockage en mémoire, ni IndexedDB, ni `storage`, ni écriture dans le vrai sessionStorage,
//      base et /api répondues sur place, aucun bandeau « Exemple » ;
//   V  vercel.json : seul /apercu-nouveau se laisse encadrer, par nous seuls ;
//   P  « Nouveaux comptes » : propriétaire seul (403 sinon, RIEN lu), anonyme, « pas su » dit ;
//   S  la réponse : propriétaire seul, rangée sur la ligne du signalement, notifiée à
//      l'auteur ; « Mes signalements » ne rend QUE les siens ;
//   A  le centre d'aide : aucun « Réglages → » (l'écran s'appelle Paramètres), chaque
//      « Paramètres → X » nomme une catégorie qui existe, les articles = ARTICLES_AIDE.
//   node scripts/audit-parcours-nouveau.cjs [--mutation=NOM | --prouve | --racine=<arbre>]
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const RAC = path.join(__dirname, '..');

// [fichier relatif, avant, après] — chaque défaut remis exprès : il faut du ROUGE.
const MUTATIONS = {
  'proprio-interrompu': ['src/parcoursNouveau/regle.js', "  if (proprietaire !== false) return false;\n", ''],
  'deja-installe': ['src/parcoursNouveau/regle.js', "return premierJour === true && !bienvenueVue;", 'return true;'],
  'passu-fait': ['src/parcoursNouveau/regle.js', "const etatSur = (x) => (x && ETATS_ETAPE.includes(x.etat) ? x.etat : 'passu');", "const etatSur = (x) => (x && ETATS_ETAPE.includes(x.etat) ? x.etat : 'fait');"],
  'cartons-forme': ['src/parcoursNouveau/regle.js', "if (choix === 'cartons') return { ...base, actif: true, depuis: at, choisi: at, par: 'cartons' };", "if (choix === 'cartons') return { ...base, actif: false, depuis: at };"],
  'bac-sans-cadre': ['src/modeExemple.js', "if (!win || win.name !== NOM_CADRE_BAC || win.top === win || !win.parent) return null;", 'if (!win) return null;'],
  'bac-idb': ['src/modeExemple.js', "    try { Object.defineProperty(win, 'indexedDB', { configurable: true, value: undefined }); } catch (_) {}\n", ''],
  'bac-ecrit-session': ['src/modeExemple.js', "  if (ETAT && ETAT.bac) return false;   // (15 nov.) le bac à sable n'écrit jamais", "  if (false) return false;   // (15 nov.) le bac à sable n'écrit jamais"],
  'garde-parcours': ['api/_lib/parcours-comptes.js', "  if (String(utilisateur.id).toLowerCase() !== proprio) return { code: 403, corps: { ok: false, raison: 'proprietaire' } };\n  // La garde est passée", "  // La garde est passée"],
  'email-sort': ['api/_lib/parcours-comptes.js', "    return {\n      semaine: semaineDe(c.cree),", "    return {\n      email: c.email || c.id,\n      semaine: semaineDe(c.cree),"],
  'reponse-tous': ['api/_lib/signalement.js', "  if (String(utilisateur.id).toLowerCase() !== proprio) return { code: 403, corps: { ok: false, raison: 'proprietaire' } };\n  const id = String((corps && corps.id) || '');\n  if (!ID_SIG.test(id))", "  const id = String((corps && corps.id) || '');\n  if (!ID_SIG.test(id))"],
  'suivi-tous': ['api/_lib/signalement.js', '&data->>de=eq.${uid}&select=${SELECT_SUIVI}', '&select=${SELECT_SUIVI}'],
  'vercel-cadre-tous': ['vercel.json', "frame-ancestors 'self'", "frame-ancestors *"],
  'aide-ancien-chemin': ['scripts/aide-contenu.cjs', "**Paramètres → Ventes et colis → Imprimante et étiquettes**", "**Réglages → Impression**"],
};

const arg = process.argv.slice(2);
const mut = (arg.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
const racineArg = (arg.find((a) => a.startsWith('--racine=')) || '').split('=')[1] || '';
if (arg.includes('--prouve')) {
  let ok = 0; const noms = Object.keys(MUTATIONS);
  for (const m of noms) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8' });
    const rouge = r.status !== 0 && r.status !== 3;
    console.log(`${rouge ? '✓ rouge' : '✗ VERT '} · mutation ${m}${r.status === 3 ? ' (introuvable)' : ''}`);
    if (rouge) ok++;
  }
  console.log(`\n${ok}/${noms.length} mutations rouges`);
  process.exit(ok === noms.length ? 0 : 1);
}

let verts = 0, rouges = 0;
const dit = (c, m) => { if (c) { verts++; console.log('  ✓ ' + m); } else { rouges++; console.log('  ✗ ' + m); } };

(async () => {
  const SRC = racineArg ? path.resolve(racineArg) : RAC;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-pn-'));
  for (const d of ['src', 'api']) fs.cpSync(path.join(SRC, d), path.join(tmp, d), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'scripts'), { recursive: true });
  for (const f of ['vercel.json', 'scripts/aide-contenu.cjs', 'package.json']) if (fs.existsSync(path.join(SRC, f))) fs.copyFileSync(path.join(SRC, f), path.join(tmp, f));
  if (mut) {
    const [f, a, b] = MUTATIONS[mut] || [];
    const p = f && path.join(tmp, f);
    if (!p || !fs.existsSync(p) || !fs.readFileSync(p, 'utf8').includes(a)) { console.log('mutation introuvable : ' + mut); process.exit(3); }
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8').split(a).join(b));
  }
  const lire = (f) => { try { return fs.readFileSync(path.join(tmp, f), 'utf8'); } catch (_) { return ''; } };
  const imp = (f) => import(pathToFileURL(path.join(tmp, f)).href);
  let R, PC, SG, CN;
  try { R = await imp('src/parcoursNouveau/regle.js'); PC = await imp('api/_lib/parcours-comptes.js'); SG = await imp('api/_lib/signalement.js'); CN = await imp('src/accueilReste/cartonsNumeros.js'); }
  catch (e) { console.log('✗ les modules ne se chargent pas : ' + e.message); process.exit(1); }

  console.log('R. La règle du parcours');
  const J = 864e5, now = Date.parse('2026-11-15T12:00:00Z');
  const ouvre = (o) => R.parcoursNouveauAOuvrir({ pret: true, proprietaire: false, premierJour: true, valeur: null, bienvenueVue: false, maintenant: now, ...o });
  dit(ouvre({}) === true, 'un compte neuf (aucun compte Vinted, Bienvenue jamais vu) : le parcours s’ouvre');
  dit(ouvre({ proprietaire: true }) === false && ouvre({ proprietaire: undefined }) === false && ouvre({ proprietaire: null }) === false, 'jamais le propriétaire, jamais sur « pas su »');
  dit(ouvre({ exemple: true }) === false && ouvre({ pret: false }) === false, 'jamais en mode exemple, jamais avant le nuage');
  dit(ouvre({ premierJour: false }) === false && ouvre({ bienvenueVue: true }) === false, 'un vendeur installé n’est jamais interrompu');
  dit(ouvre({ premierJour: false, bienvenueVue: true, valeur: { etape: 'comptes' } }) === true, 'commencé, pas fini : repris (même après le premier compte relié)');
  dit(ouvre({ valeur: { etape: 'comptes', fini: true } }) === false, 'fini : plus jamais');
  dit(ouvre({ valeur: { etape: 'comptes', plusTard: new Date(now - J).toISOString() } }) === false && ouvre({ valeur: { etape: 'comptes', plusTard: new Date(now - 4 * J).toISOString() } }) === true, '« Plus tard » : trois jours de côté');
  const e1 = R.etatsEtapes({ session: true, plateformes: null, arrivee: { route: 'vinted', etapes: [{ cle: 'compte', etat: 'fait' }, { cle: 'extension', etat: 'passu' }, { cle: 'vinted', etat: 'passu' }] }, numerotation: null, imports: null, abonnement: { etat: 'pas-su' } });
  dit(e1.extension.etat === 'passu' && e1.comptes.etat === 'passu' && e1.historique.etat === 'passu' && e1.abonnement.etat === 'passu', '« pas su » reste « pas su » (extension, comptes, historique, abonnement)');
  const e1b = R.etatsEtapes({ session: true, arrivee: { route: 'vinted', etapes: [{ cle: 'extension', etat: 'illisible' }, { cle: 'vinted' }] } });
  dit(e1b.extension.etat === 'passu' && e1b.comptes.etat === 'passu', 'un état illisible de l’arrivée vaut « pas su », jamais « fait »');
  const e2 = R.etatsEtapes({ session: true, plateformes: { sites: ['ebay'] }, route: { cle: 'ebay' }, arrivee: undefined, numerotation: {}, imports: {}, abonnement: undefined });
  dit(e2.extension.etat === 'inutile' && e2.historique.etat === 'inutile' && e2.numeros.etat === 'afaire' && e2.plateformes.etat === 'fait', 'eBay seul : ni extension ni import demandés');
  const e3 = R.etatsEtapes({ session: true, imports: { '1': { etat: 'encours', ventes: { lus: 40, total: 100 }, achats: { lus: 10, total: 20 } } } });
  dit(e3.historique.etat === 'encours' && e3.historique.n === 50 && e3.historique.N === 120, 'l’import se dit lu : 50 sur 120');
  const at = '2026-11-15T10:00:00.000Z';
  const pc = R.reglageNumerotation('cartons', at), rc = CN.reponseCartons(true, at);
  dit(JSON.stringify(pc) === JSON.stringify(rc), '« J’ai déjà mes N° sur mes cartons » écrit EXACTEMENT ce qu’écrit Ma journée (cartonsNumeros)');
  dit(R.reglageNumerotation('moi', at).actif === true && R.reglageNumerotation('vrm', at).actif === false && R.reglageNumerotation('x', at) === null, 'VRM / moi-même : la forme de `vrm_numero_ecrit`');
  dit(JSON.stringify(R.reglagePlateformes(['leboncoin', 'pirate', 'vinted'], at)) === JSON.stringify({ sites: ['vinted', 'leboncoin'], at }) && R.reglagePlateformes([], at) === null, '« Où vends-tu ? » : les quatre sites seulement, jamais vide');
  dit(R.appareilIci('Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 Version/18.1 Mobile Safari/604.1') === 'iphone' && R.appareilIci('Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36') === 'ordinateur' && R.appareilIci('x', 'iphone') === 'iphone', 'l’appareil : iPhone ⇒ Orion, ordinateur ⇒ zip');

  console.log('B. Le bac à sable (src/modeExemple.js, exécuté sur une fenêtre simulée)');
  const ME = lire('src/modeExemple.js');
  const fenetre = ({ name = 'vrm-bac-a-sable-nouveau', framed = true, parentOrigin = 'https://vrm.center', search = '?bac=extension&appareil=iphone' } = {}) => {
    const ecritsSS = [], ecritsLS = [];
    const stock = (journal, init = {}) => { const m = new Map(Object.entries(init)); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { journal.push(k); m.set(k, String(v)); }, removeItem: (k) => { journal.push('-' + k); m.delete(k); }, key: (i) => [...m.keys()][i], get length() { return m.size; } }; };
    const ecoutes = [];
    const w = {
      name, location: { origin: 'https://vrm.center', search, href: 'https://vrm.center/apercu-nouveau' + search, assign() {} },
      sessionStorage: stock(ecritsSS), localStorage: stock(ecritsLS, { vrm_session: '{"user":{"id":"proprio"}}' }),
      history: { state: null, replaceState() {} }, document: { documentElement: { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } } },
      navigator: { sendBeacon: () => true }, fetch: async () => ({ ok: true, status: 200 }), postMessage() {}, addEventListener(t, f, c) { ecoutes.push([t, c]); },
      indexedDB: { open() {} }, WebSocket: function () {},
    };
    w.top = framed ? {} : w;
    w.parent = framed ? { location: { get origin() { if (parentOrigin === 'throw') throw new Error('cross-origin'); return parentOrigin; } } } : w;
    return { w, ecritsSS, ecritsLS, ecoutes };
  };
  const chargerME = async (tag) => { const f = path.join(tmp, 'src', `modeExemple.${tag}.js`); fs.writeFileSync(f, ME.replace(/\nif \(typeof window !== 'undefined'\) installerModeExemple\(window\);\s*$/, '\n')); return import(pathToFileURL(f).href); };
  const M0 = await chargerME('d');
  dit(M0.demandeBacASable(fenetre({ name: 'autre' }).w) === null && M0.demandeBacASable(fenetre({ framed: false }).w) === null && M0.demandeBacASable(fenetre({ parentOrigin: 'throw' }).w) === null && M0.demandeBacASable(fenetre({ parentOrigin: 'https://pirate.example' }).w) === null, 'seulement dans le cadre nommé, sous une page de la MÊME origine (onglet, autre nom, autre site : jamais)');
  dit(JSON.stringify(M0.demandeBacASable(fenetre({}).w)) === JSON.stringify({ etape: 'extension', appareil: 'iphone' }), 'l’étape et l’appareil lus dans l’adresse du cadre');
  const M1 = await chargerME('i');
  const F = fenetre({});
  const lsAvant = F.w.localStorage;
  const pose = M1.installerModeExemple(F.w);
  const sess = (() => { try { return JSON.parse(F.w.localStorage.getItem('vrm_session')); } catch (_) { return null; } })();
  dit(pose === true && M1.bacASableActif() && !M1.exempleActif() && M1.bacASableEtape() === 'extension' && M1.bacASableAppareil() === 'iphone', 'posé : bac actif, pas « Exemple », l’étape demandée');
  dit(F.w.localStorage !== lsAvant && sess && sess.user && sess.user.id === M1.UID_BAC && F.ecritsLS.length === 0, 'stockage en mémoire, session d’un compte neuf — le vrai stockage ni lu pour la session ni écrit');
  dit(F.w.indexedDB === undefined && F.ecoutes.some(([t, c]) => t === 'storage' && c === true), 'ni IndexedDB, ni l’évènement `storage` de l’onglet');
  M1.entrerModeExemple(F.w); M1.sortirModeExemple(F.w);
  dit(F.ecritsSS.length === 0, 'rien écrit dans le VRAI sessionStorage (partagé avec l’onglet de Julien), même par « Découvrir avec des exemples »');
  const rb = await F.w.fetch('https://lgonxzrzjcqthjtbdpzo.supabase.co/rest/v1/app_data?id=eq.main', { method: 'POST', body: '[]' });
  const ra = await F.w.fetch('/api/compte?mode=signalement', { method: 'POST', body: '{}' });
  const bil = M1.bilanExemple();
  dit(rb && ra && ra.status === 409 && bil.reponduesSurPlace === 2 && bil.ecrituresGardees === 2 && bil.bac === 'extension', 'la base et /api répondues SUR PLACE, les écritures gardées en mémoire et comptées');
  dit(F.w.document.documentElement.attrs['data-vrm-bac-a-sable'] === 'extension' && !F.w.document.documentElement.attrs['data-vrm-exemple'], 'la racine porte le bac, pas le bandeau « Exemple »');

  console.log('V. vercel.json');
  const V = require(path.join(RAC, 'scripts', 'bancs', '_vercel.cjs'));
  process.env.BANC_VERCEL_JSON = path.join(tmp, 'vercel.json');
  const cfg = JSON.parse(lire('vercel.json'));
  const motif = V.motif;
  const entetes = (p) => { const out = {}; for (const h of cfg.headers || []) if (motif(h.source).test(p)) for (const e of h.headers || []) out[e.key] = e.value; return out; };
  const fa = (p) => ((entetes(p)['Content-Security-Policy'] || '').match(/frame-ancestors ([^;]+)/) || [])[1];
  dit(fa('/') === "'none'" && entetes('/')['X-Frame-Options'] === 'DENY' && fa('/aide/extension') === "'none'", 'l’app et les autres pages : jamais dans un cadre');
  dit(fa('/apercu-nouveau') === "'self'" && entetes('/apercu-nouveau')['X-Frame-Options'] === 'SAMEORIGIN' && fa('/apercu-nouveau-x') === "'none'", '/apercu-nouveau : dans un cadre de vrm.center SEULEMENT');
  dit(/frame-src 'self'/.test(entetes('/')['Content-Security-Policy'] || '') && cfg.rewrites.some((r) => r.source === '/apercu-nouveau' && r.destination === '/index.html'), 'la page de Julien peut encadrer la sienne ; /apercu-nouveau sert l’app');

  console.log('P. « Nouveaux comptes » (api/_lib/parcours-comptes.js)');
  const PROPRIO = '0a0a0a0a-1111-4000-8000-00000000aaaa', AUTRE = '0c0c0c0c-3333-4000-8000-00000000cccc';
  const u = (i) => `9e9e9e9e-0000-4000-8000-0000000000${String(i).padStart(2, '0')}`;
  const appels = [];
  const base = {
    users: [{ id: PROPRIO, created_at: '2026-08-01T00:00:00Z', email: 'p@x.invalid' }, ...[1, 2, 3].map((i) => ({ id: u(i), created_at: '2026-11-1' + i + 'T00:00:00Z', email: `c${i}@x.invalid` }))],
    main: [{ owner: u(1), pn: { etape: 'extension' } }, { owner: u(2), pn: null }], vinted: [{ owner: u(2) }], ext: [], lect: [{ owner: u(2) }], abos: [{ owner: u(2), statut: 'trialing', mode_test: false }, { owner: u(3), statut: 'active', mode_test: true }],
  };
  const faux = (casse) => async (url) => {
    appels.push(url);
    const U = new URL(url);
    const r = (d) => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => d });
    if (U.pathname === '/auth/v1/admin/users') return r({ users: U.searchParams.get('page') === '1' ? base.users : [] });
    if (casse && url.includes(casse)) return { ok: false, status: 500, headers: { get: () => null }, json: async () => null };
    if (U.pathname.endsWith('vinted_accounts')) return r(base.vinted);
    if (U.pathname.endsWith('abonnements')) return r(base.abos);
    if (url.includes('id=eq.main')) return r(base.main);
    if (url.includes('ext_appareil')) return r(base.ext);
    if (url.includes('harvest')) return r(base.lect);
    return r([]);
  };
  const ENV = { SUPABASE_SERVICE_KEY: 'k', SUPABASE_URL: 'https://b.invalid', VRM_OWNER_UID: PROPRIO };
  appels.length = 0;
  const refus = await PC.routeParcoursComptes({ utilisateur: { id: AUTRE }, env: ENV, fetcher: faux() });
  dit(refus.code === 403 && appels.length === 0, 'un autre compte : 403, et RIEN n’est lu');
  const ok = await PC.routeParcoursComptes({ utilisateur: { id: PROPRIO }, env: ENV, fetcher: faux() });
  const txt = JSON.stringify(ok.corps);
  dit(ok.code === 200 && ok.corps.total === 3 && ok.corps.entonnoir.ouvert === 2 && ok.corps.entonnoir.extension === 1 && ok.corps.entonnoir.abonnes === 1, 'le propriétaire : 3 inscrits (lui exclu), 2 apps ouvertes, 1 extension, 1 abonné (test écarté)');
  dit(!/@|9e9e9e9e|0a0a0a0a/.test(txt), 'anonyme : aucun e-mail, aucun identifiant dans la réponse');
  dit(ok.corps.sansMesureParcours === 2 && ok.corps.etapes.extension === 1, 'l’étape du parcours : mesurée là où elle existe, « pas mesuré » compté ailleurs');
  const casse = await PC.routeParcoursComptes({ utilisateur: { id: PROPRIO }, env: ENV, fetcher: faux('harvest') });
  dit(casse.corps.entonnoir.lecture === null && casse.corps.raisons.lecture === 'base' && casse.corps.arrets === null, 'une lecture ratée : « — » et sa raison, jamais 0');
  const compte = lire('api/compte.js');
  dit(/if \(mode === 'pilotage'\) \{[\s\S]{0,300}vendeurExige\(req, res\)[\s\S]{0,400}quoi === 'parcours' \? await routeParcoursComptes\(\{ utilisateur \}\)/.test(compte), 'api/compte.js : le jeton vérifié AVANT, puis `quoi=parcours` (pas de 13ᵉ fonction)');
  dit(fs.readdirSync(path.join(tmp, 'api')).filter((f) => f.endsWith('.js')).length <= 12, 'au plus 12 fonctions dans api/');

  console.log('S. La réponse à un signalement (api/_lib/signalement.js)');
  const rows = [];
  const fauxS = async (url, init = {}) => {
    const U = new URL(url); const m = String(init.method || 'GET').toUpperCase();
    const r = (d, st = 200) => ({ ok: st < 300, status: st, headers: { get: () => null }, json: async () => d });
    if (m === 'POST') { const l = JSON.parse(init.body); const faites = []; for (const x of l) if (!rows.some((y) => y.owner === x.owner && y.id === x.id)) { rows.push(x); faites.push(x); } return r(faites, 201); }
    const id = (U.searchParams.get('id') || '').replace(/^eq\./, '');
    if (m === 'PATCH') { const b = JSON.parse(init.body); const x = rows.find((y) => y.id === id); if (x) x.data = b.data; return r(x ? [x] : []); }
    let out = rows.filter((x) => x.owner === (U.searchParams.get('owner') || '').replace(/^eq\./, ''));
    if (id && !/^like/.test(U.searchParams.get('id'))) out = out.filter((x) => x.id === id);
    const de = U.searchParams.get('data->>de'); if (de) out = out.filter((x) => x.data.de === de.replace(/^eq\./, ''));
    const sel = U.searchParams.get('select') || '';
    return r(out.map((x) => (sel === 'data' || sel === 'id,data' ? { id: x.id, data: x.data } : { id: x.id, texte: x.data.texte, ecran: x.data.ecran, at: x.data.at, traite: String(x.data.traite), reponse: x.data.reponse, reponduLe: x.data.reponduLe, de: x.data.de })));
  };
  const envoi = await SG.envoyerSignalement({ utilisateur: { id: AUTRE }, corps: { texte: 'Colis reste vide', ecran: 'colis' }, env: ENV, fetcher: fauxS, pousser: async () => ({ sent: 1 }) });
  await SG.envoyerSignalement({ utilisateur: { id: u(1) }, corps: { texte: 'Autre souci ici', ecran: 'ventes' }, env: ENV, fetcher: fauxS, maintenant: Date.now() + 1000 });
  const idS = envoi.corps.id;
  dit(envoi.code === 200 && rows.length === 2 && rows.every((x) => x.owner === PROPRIO), 'rangé chez le propriétaire');
  const volee = await SG.repondreSignalement({ utilisateur: { id: AUTRE }, corps: { id: idS, texte: 'je me réponds' }, env: ENV, fetcher: fauxS });
  dit(volee.code === 403 && !rows.find((x) => x.id === idS).data.reponse, 'un autre compte ne répond pas (403, rien d’écrit)');
  const rep = await SG.repondreSignalement({ utilisateur: { id: PROPRIO }, corps: { id: idS, texte: 'Merci, corrigé.' }, env: ENV, fetcher: fauxS });
  dit(rep.code === 200 && rep.de === AUTRE && rows.find((x) => x.id === idS).data.reponse === 'Merci, corrigé.' && rows.find((x) => x.id === idS).data.traite === true, 'le propriétaire répond : rangé sur la ligne, `de` rendu pour la notification');
  const n = SG.notifReponse({ reponse: 'Merci, corrigé.' });
  dit(/reglage=mes-signalements/.test(n.url) && n.title.length <= 40, 'la notification de l’auteur ouvre « Mes signalements »');
  const suivi = await SG.suiviSignalements({ utilisateur: { id: AUTRE }, env: ENV, fetcher: fauxS });
  dit(suivi.code === 200 && suivi.corps.signalements.length === 1 && suivi.corps.signalements[0].reponse === 'Merci, corrigé.', '« Mes signalements » : les SIENS seulement, avec la réponse');
  dit(/quoi === 'suivi'\) \{[^\n]*suiviSignalements\(\{ utilisateur \}\)/.test(compte) && /corps\.action === 'repondre'\) \{[\s\S]{0,200}repondreSignalement\(\{ utilisateur, corps \}\)[\s\S]{0,200}contexteVendeur\.run\(\{ owner: r\.de \}/.test(compte), 'api/compte.js : suivi et réponse branchés, la notification part dans le contexte de l’AUTEUR');

  console.log('A. Le centre d’aide à jour');
  const { ARTICLES } = require(path.join(tmp, 'scripts', 'aide-contenu.cjs'));
  const AE = await imp('src/aideEcrans.js');
  const tout = JSON.stringify(ARTICLES);
  dit(!/Réglages →/.test(tout), 'aucun « Réglages → » : l’écran s’appelle Paramètres');
  const fr = await imp('src/i18n/langues/fr/parametres.js');
  const cats = Object.entries(fr.default).filter(([k]) => /^parametres\.cat\.[a-z-]+$/.test(k)).map(([, v]) => v);
  const chemins = [...tout.matchAll(/Paramètres → ([^→*,.;)]+?)(?: →|\*\*|,|\.|;|\))/g)].map((x) => x[1].trim());
  const mauvais = chemins.filter((c) => !cats.includes(c));
  dit(chemins.length >= 8 && !mauvais.length, `chaque « Paramètres → X » nomme une catégorie qui existe (${chemins.length} chemins)` + (mauvais.length ? ' — ' + mauvais.join(' | ') : ''));
  dit(['premiers-pas', 'parametres', 'stock', 'retirer-ailleurs', 'meme-photo', 'republier', 'retours', 'argent-a-venir'].every((s) => ARTICLES.some((a) => a.slug === s) && AE.ARTICLES_AIDE[s]), 'les écrans d’aujourd’hui ont leur fiche (premiers pas, Paramètres, Stock, retrait ailleurs, même photo, republier, retours, argent à venir)');
  dit(/raccourci/.test(tout) && /Ouvrir les URL/.test(tout) && /écran d’accueil n’a AUCUNE extension/.test(tout), 'iPhone : Orion + le raccourci « Ouvrir les URL », l’écran d’accueil sans extension');
  dit(/Mes signalements/.test(tout) && /Reçu · on te répond ici/.test(tout), 'Signaler : « Reçu · on te répond ici » et où lire la réponse');

  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
  console.log(`\n${verts} verts, ${rouges} rouges`);
  process.exit(rouges ? 1 : 0);
})();
