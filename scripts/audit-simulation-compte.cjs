// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : « Simuler une création de compte » (Réglages, propriétaire seul)
//         node scripts/audit-simulation-compte.cjs [--prouve]
// ═══════════════════════════════════════════════════════════════════════════
// 1. ISOLÉE : chaque scénario de src/simulationCompte.js tourne avec `fetch`,
//    `XMLHttpRequest`, `WebSocket`, `localStorage`, `sessionStorage`, `indexedDB`
//    et `navigator.sendBeacon` PIÉGÉS — un seul appel ⇒ rouge (jamais la vraie
//    base, aucun e-mail, aucun compte Supabase).
// 2. LES VRAIES RÈGLES : les requêtes du parcours sont, au caractère près,
//    celles d'App.jsx (`lireEmailsParcours`…) ; le module importe les règles de
//    l'app (parcoursArrivee, configurationDepart, profilVendeur, plan-regle),
//    jamais une copie.
// 3. CHAQUE scénario est conforme à l'attendu (✓ quand il le faut, ✗ avec ce qui
//    a accroché quand il le faut) ; au moins un scénario bloque sur chaque cause
//    (extension absente, autre compte, e-mails, dressing pas lu, panne) ; les
//    mots suivent « Tu vends quoi ? » (Sneakers ⇒ « paire », Lunettes ⇒ « article ») ;
//    Solo écarte la vente d'un autre compte, Pro jamais.
// 4. L'écran n'est monté QUE pour le propriétaire de l'installation (Réglages,
//    `proprioInst &&`), comme « Ton entreprise ».
// --prouve : chaque affaiblissement (requête réelle, preuve inventée, mot figé,
// règle recopiée) doit rougir.
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');
const RACINE = process.env.SIM_RACINE || path.join(__dirname, '..');

if (process.argv[2] === '--prouve') {
  const MUT = [
    ['une lecture part vers la vraie base', 'src/simulationCompte.js', 'b.requetes.push(q);', 'b.requetes.push(q); try { fetch("https://exemple.supabase.co/rest/v1/app_data?" + q); } catch (_) {}'],
    ['l\'extension se coche toute seule', 'src/simulationCompte.js', "preuves.extension = preuveExtension(sc.extension, base.comptes);", "preuves.extension = { etat: 'fait' };"],
    ['la requête du dressing n\'est plus celle de l\'app', 'src/simulationCompte.js', "annonces: 'id=like.harvest_*_listings&select=id,n:data->>nItems',", "annonces: 'id=like.harvest_*_listings&select=id,data',"],
    ['le mot est figé à « paire »', 'src/simulationCompte.js', 'const mots = motsArticle(vend);', "const mots = motsArticle('sneakers');"],
    ['une panne vaut « aucun e-mail »', 'src/simulationCompte.js', 'if (b.panne[nom]) return null;', 'if (b.panne[nom]) return [];'],
    ['l\'écran est monté pour tout le monde', 'src/ecrans/Reglages.jsx', "proprioInst && { id:'simulation-compte'", "{ id:'simulation-compte'"],
  ];
  let ko = 0;
  for (const [nom, f, de, vers] of MUT) {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'sim-mut-'));
    for (const x of ['src', 'api', 'package.json']) fs.cpSync(path.join(RACINE, x), path.join(d, x), { recursive: true });
    try { fs.symlinkSync(path.join(RACINE, 'node_modules'), path.join(d, 'node_modules')); } catch (_) {}
    const p = path.join(d, f); const s = fs.readFileSync(p, 'utf8');
    if (!s.includes(de)) { console.log(`❌ mutation « ${nom} » : motif introuvable`); ko++; continue; }
    fs.writeFileSync(p, s.replace(de, vers));
    const r = spawnSync(process.execPath, [__filename], { encoding: 'utf8', env: { ...process.env, SIM_RACINE: d } });
    fs.rmSync(d, { recursive: true, force: true });
    const rouge = r.status !== 0;
    console.log(`${rouge ? '✅' : '❌'} mutation « ${nom} » ⇒ ${rouge ? 'ROUGE' : 'reste vert'}${rouge ? ' — ' + (String(r.stdout).split('\n').find((l) => l.startsWith('❌')) || '').slice(0, 160) : ''}`);
    if (!rouge) ko++;
  }
  console.log(`\n${MUT.length - ko}/${MUT.length} mutations rouges`);
  process.exit(ko ? 1 : 0);
}

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (!c && d ? ' — ' + d : '')); };

// ── Les pièges ────────────────────────────────────────────────────────────
const appels = [];
const piege = (nom) => (...a) => { appels.push(nom + ' ' + String(a[0] || '').slice(0, 80)); throw new Error('simulation : ' + nom + ' interdit'); };
global.fetch = piege('fetch');
global.XMLHttpRequest = function () { appels.push('XMLHttpRequest'); throw new Error('XHR interdit'); };
global.WebSocket = function () { appels.push('WebSocket'); throw new Error('WebSocket interdit'); };
const stockage = (nom) => new Proxy({}, { get: (_, k) => { if (typeof k === 'symbol') return undefined; appels.push(`${nom}.${String(k)}`); return () => null; } });
global.localStorage = stockage('localStorage');
global.sessionStorage = stockage('sessionStorage');
global.indexedDB = stockage('indexedDB');
global.navigator = { sendBeacon: piege('sendBeacon') };

(async () => {
  const src = fs.readFileSync(path.join(RACINE, 'src', 'simulationCompte.js'), 'utf8');
  const app = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
  const reg = fs.readFileSync(path.join(RACINE, 'src', 'ecrans', 'Reglages.jsx'), 'utf8');
  // 2. Les requêtes = celles d'App.jsx ; les règles importées.
  const reqApp = (nom) => { const m = new RegExp(`const ${nom} = \\(\\) => lireLignesParcours\\('([^']+)'\\)`).exec(app); return m ? m[1] : null; };
  const sim = await import('file://' + path.join(RACINE, 'src', 'simulationCompte.js'));
  for (const [cle, nom] of [['annonces', 'lireAnnoncesParcours'], ['commandes', 'lireCommandesParcours']]) {
    const a = reqApp(nom);
    dit(a && sim.REQUETES[cle] === a, `la requête « ${cle} » est celle de l'app (${nom})`, `app : ${a} · simulation : ${sim.REQUETES[cle]}`);
  }
  for (const m of ["from './parcoursArrivee.js'", "from './configurationDepart.js'", "from './profilVendeur.js'", "from '../api/_lib/plan-regle.js'"]) dit(src.includes(m), `les règles viennent de l'app : ${m}`);
  dit(!/\bfetch\s*\(|localStorage|sessionStorage|indexedDB|XMLHttpRequest|supabase/i.test(src.replace(/\/\/.*$/gm, '')), 'le module ne nomme ni le réseau, ni le stockage, ni Supabase (hors commentaires)');

  // 1 et 3. Chaque scénario, pièges posés.
  const res = sim.jouerTout({ maintenant: Date.parse('2026-11-11T12:00:00Z') });
  dit(appels.length === 0, `isolée : aucun appel réseau ni stockage pendant les ${res.length} simulations`, appels.slice(0, 5).join(' · '));
  dit(res.length >= 6, `au moins 6 scénarios (${res.length})`);
  for (const r of res) {
    const ecarts = r.etapes.filter((e) => !e.conforme).map((e) => `${e.cle} : ${e.etat} au lieu de ${e.attendu}`);
    dit(r.conforme, `« ${r.sc.nom} » conforme à l'attendu`, [...ecarts, r.motOk ? '' : `mot ${r.mots.nom} ≠ ${r.sc.mot}`, r.horsOk ? '' : `hors offre ${r.horsOffre}`].filter(Boolean).join(' ; '));
    for (const e of r.etapes) if (!e.ok) dit(!!e.accroche, `« ${r.sc.nom} » · ${e.court} bloquée : ce qui a accroché est dit`, JSON.stringify(e));
    dit(r.etapes.every((e) => e.apercu && e.apercu.etat && e.apercu.montree), `« ${r.sc.nom} » : un aperçu (miniature) par étape`);
    dit(/^51000000-0000-4000-8000-/.test(r.uid), `« ${r.sc.nom} » : identifiant FICTIF (${r.uid})`);
  }
  const bloque = (cle, etat) => res.some((r) => r.etapes.some((e) => e.cle === cle && e.etat === etat));
  dit(bloque('extension', 'afaire'), 'un scénario bloque sur l\'extension');
  dit(bloque('vinted', 'afaire'), 'un scénario bloque sur Vinted (aucun compte relié)');
  dit(bloque('vinted', 'attente'), 'un scénario attend la première lecture de Vinted');
  dit(bloque('vinted', 'passu'), 'une panne de lecture reste « pas su », jamais faite ni « aucun »');
  dit(res.every((r) => r.etapes.length === 3), 'trois étapes par scénario (13 nov., lot 46)');
  dit(res.some((r) => r.sc.vente == null && r.sc.achat == null && r.final.fini), 'un vendeur sans aucune vente finit le démarrage (dressing lu)');
  dit(res.some((r) => r.final.fini), 'au moins un scénario va jusqu\'à « C\'est prêt »');
  const parMot = (cat) => res.find((r) => r.sc.vends.length === 1 && r.sc.vends[0] === cat);
  dit(parMot('sneakers') && parMot('sneakers').mots.nom === 'paire', 'Sneakers ⇒ « paire »');
  dit(parMot('lunettes') && parMot('lunettes').mots.nom === 'article', 'Lunettes ⇒ « article »');
  dit(res.some((r) => r.sc.offre === 'solo' && r.horsOffre === true), 'Solo : la vente d\'un autre compte que le compte vendeur sort de l\'offre');
  dit(res.filter((r) => r.sc.offre === 'pro').every((r) => r.horsOffre === false), 'Pro : aucune vente hors offre');
  // 4. Propriétaire seul.
  dit(/proprioInst && \{ id:'simulation-compte'/.test(reg), 'l\'écran n\'est proposé qu\'au propriétaire de l\'installation (Réglages)');
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ levée : ' + (e && e.stack || e)); process.exit(1); });
