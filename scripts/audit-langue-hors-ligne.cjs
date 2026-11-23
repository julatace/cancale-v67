// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « LA LANGUE DU VENDEUR SEULE » (19 nov., capacite-3000)
//  Le service worker range l'app pour le hors-ligne (public/sw.js, `rechaufferMorceaux`).
//  Avant : les quatre dictionnaires étrangers (≈ 670 Ko compressés) partaient chez TOUT
//  le monde à chaque déploiement. Ici on EXÉCUTE le vrai sw.js (vm, cache et réseau
//  simulés) et on exige :
//    1. page en français (ou langue pas dite) : aucun dictionnaire étranger rangé ;
//    2. page en anglais : les morceaux `en` rangés, ni `es`, ni `it`, ni `de` ;
//    3. tous les morceaux communs rangés dans les deux cas ;
//    4. la purge d'un déploiement garde les morceaux de la langue dite ;
//    5. une langue inconnue est ignorée (français) ;
//    6. le build range les dictionnaires à part (`langues`, vite.config.js).
//  `--prouve` : rejoue 1-2 sur un sw.js d'AVANT (tout rangé) — doit être rouge.
//  Lancer : node scripts/audit-langue-hors-ligne.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), vm = require('vm');
const RACINE = path.join(__dirname, '..');
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };

const LISTE = {
  v: 1,
  fichiers: ['/assets/App-a1.js', '/assets/App-a1.css', '/assets/Ventes-b2.js'],
  langues: { en: ['/assets/en-c3.js', '/assets/en-accueil-c4.js'], es: ['/assets/es-d5.js'], it: ['/assets/it-e6.js'], de: ['/assets/de-f7.js'] },
};

function monde(source) {
  const stock = new Map();
  const cache = {
    match: async (k) => { const key = new URL(typeof k === 'string' ? k : k.url, 'https://vrm.center').pathname; const v = stock.get(key); return v ? v.clone() : undefined; },
    put: async (k, r) => { const key = new URL(typeof k === 'string' ? k : k.url, 'https://vrm.center').pathname; stock.set(key, r); },
    delete: async (k) => stock.delete(typeof k === 'string' ? k : new URL(k.url).pathname),
    keys: async () => [...stock.keys()].map((p) => ({ url: 'https://vrm.center' + p })),
  };
  const ecouteurs = {};
  const fetchFaux = async (u) => {
    const p = new URL(typeof u === 'string' ? u : u.url, 'https://vrm.center').pathname;
    const corps = p === '/hors-ligne-assets.json' ? JSON.stringify(LISTE) : 'x';
    const r = new Response(corps, { status: 200 });
    Object.defineProperty(r, 'type', { value: 'basic' });
    return r;
  };
  const ctx = {
    self: { addEventListener: (n, f) => { (ecouteurs[n] = ecouteurs[n] || []).push(f); }, location: { origin: 'https://vrm.center' }, skipWaiting: () => {}, registration: {} },
    caches: { open: async () => cache, keys: async () => [], delete: async () => true },
    clients: { claim: async () => {} },
    fetch: fetchFaux, Response, Request: function (u) { return { url: new URL(u, 'https://vrm.center').href }; }, Headers, URL, console, setTimeout: (f) => setTimeout(f, 0), clearTimeout, Promise, JSON, Set, Map, Array, Object, String, Number, AbortSignal,
  };
  ctx.self.self = ctx.self;
  vm.createContext(ctx);
  vm.runInContext(source.replace(/const ATTENTE_RECHAUFFE_MS = \d+;/, 'const ATTENTE_RECHAUFFE_MS = 0;'), ctx, { filename: 'sw.js' });
  const envoyer = async (data) => {
    const attendus = [];
    for (const f of ecouteurs.message || []) f({ data, ports: [], waitUntil: (p) => attendus.push(p) });
    await Promise.all(attendus);
    for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 5));
  };
  return { stock, envoyer, ctx };
}

async function rangesPour(source, langue) {
  const m = monde(source);
  await m.envoyer({ type: 'VRM_RANGER_COQUILLE', ...(langue !== undefined ? { langue } : {}) });
  return [...m.stock.keys()].filter((k) => k.startsWith('/assets/'));
}

(async () => {
  const prouve = process.argv.includes('--prouve');
  const sw = fs.readFileSync(path.join(RACINE, 'public', 'sw.js'), 'utf8');
  const source = prouve
    // le sw.js d'avant : la liste entière, langue ignorée
    ? sw.replace(/\[\.\.\.j\.fichiers, \.\.\.morceauxDeLangue\(j, await langueHorsLigne\(cache\)\)\]/g, '[...j.fichiers, ...Object.values(j.langues || {}).flat()]')
    : sw;
  const etrangers = (l) => l.filter((k) => /\/(en|es|it|de)(-accueil)?-/.test(k));
  const fr = await rangesPour(source, 'fr');
  dit(etrangers(fr).length === 0, '1. page en français : aucun dictionnaire étranger rangé', etrangers(fr).join(', ') || 'aucun');
  const rien = await rangesPour(source, undefined);
  dit(etrangers(rien).length === 0, '1. langue pas dite : aucun dictionnaire étranger rangé', etrangers(rien).join(', ') || 'aucun');
  const en = await rangesPour(source, 'en');
  const enE = etrangers(en);
  dit(enE.length === 2 && enE.every((k) => /\/en(-accueil)?-/.test(k)), '2. page en anglais : les morceaux anglais seuls', enE.join(', '));
  for (const [nom, l] of [['français', fr], ['anglais', en]]) dit(LISTE.fichiers.every((f) => l.includes(f)), `3. ${nom} : tous les morceaux communs rangés`, `${LISTE.fichiers.filter((f) => l.includes(f)).length}/${LISTE.fichiers.length}`);
  const bizarre = await rangesPour(source, '../../etc');
  dit(etrangers(bizarre).length === 0, '5. une langue inconnue est ignorée');
  if (!prouve) {
    // 4. la purge garde la langue dite
    const m = monde(source);
    await m.envoyer({ type: 'VRM_RANGER_COQUILLE', langue: 'en' });
    const garde = await vm.runInContext('(async () => { const c = await caches.open(CACHE); return nomsGardesHorsLigne(c); })()', m.ctx);
    dit(LISTE.langues.en.every((f) => garde.includes(f)) && !garde.includes(LISTE.langues.es[0]), '4. la purge garde les morceaux de la langue dite, pas les autres', garde.filter((k) => /\/(en|es|it|de)/.test(k)).join(', '));
    const vite = fs.readFileSync(path.join(RACINE, 'vite.config.js'), 'utf8');
    dit(/langues\[l\] = langues\[l\] \|\| \[\]\)\.push/.test(vite) && /JSON\.stringify\(\{ v: 1, fichiers, langues \}\)/.test(vite) && /\(en\|es\|it\|de\)\(\?:-accueil\)\?\\\.js\$/.test(vite), '6. le build range les dictionnaires étrangers à part');
    // la liste du build, si un build est là
    const hl = path.join(RACINE, 'dist', 'hors-ligne-assets.json');
    if (fs.existsSync(hl)) {
      const j = JSON.parse(fs.readFileSync(hl, 'utf8'));
      const dansCommun = (j.fichiers || []).filter((f) => /\/(en|es|it|de)(-accueil)?-[A-Za-z0-9_-]{8}\.js$/.test(f));
      dit(dansCommun.length === 0 && j.langues && ['en', 'es', 'it', 'de'].every((l) => Array.isArray(j.langues[l]) && j.langues[l].length === 2), '6. dist : 2 morceaux par langue étrangère, aucun dans la liste commune', JSON.stringify(Object.fromEntries(Object.entries(j.langues || {}).map(([k, v]) => [k, v.length]))));
    }
  }
  if (prouve) {
    if (ko > 0) { console.log(`\n✅ preuve : le sw.js d'avant est rouge (${ko})`); process.exit(0); }
    console.log('\n❌ preuve : le sw.js d\'avant passe — le contrôle ne prouve rien'); process.exit(1);
  }
  if (ko) { console.log(`\n${ko} rouge(s)`); process.exit(1); }
  console.log('\ntout est vert');
})().catch((e) => { console.error(e); process.exit(1); });
