// ════════════════════════════════════════════════════════════════════════════
//  LE STATUT CHEZ LE TRANSPORTEUR — LE BANC DE RENDU PROUVÉ PAR MUTATION (29 oct.)
//    node scripts/prouve-banc-transporteurs.cjs [--seule nom]
//
//  « La fonction n'existait pas avant » ne prouve rien (CLAUDE.md §6.1). Pour
//  chaque mutation : une copie de l'arbre courant (sans node_modules, dist,
//  .git ni scripts/bancs/fx) dans os.tmpdir()/mut-transp-{nom}, UN défaut
//  injecté dans `src/App.jsx` (ancre exacte, trouvée UNE fois — sinon ROUGE
//  « non appliquée »), `vite build` DANS la copie, puis la section E du banc
//  `scripts/bancs/transporteurs.cjs` lancée DEPUIS la copie (son `DIST` se
//  déduit de son `__dirname` : il rend le build muté). Le contrôle nommé doit
//  sortir rouge (`KO`), pour chaque mutation.
//  Les règles serveur (api/_lib) sont prouvées par
//  `node scripts/audit-statut-transporteurs.cjs --prouve`.
//  Le banc écoute $BANC_PORT (8505 par défaut) : lancer ce script SEUL.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const os = require('os');
const cp = require('child_process');
const RACINE = path.join(__dirname, '..');
const iSeule = process.argv.indexOf('--seule');
const SEULE = iSeule > 0 ? process.argv[iSeule + 1] : null;
const PORT = String(process.env.BANC_PORT || 8505);

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };

// [nom, ancre, remplacement, contrôle du banc (expression) qui doit rougir]
const MUTATIONS = [
  // n° 1 : la capture des achats redevient l'« arrivée » d'un achat Vinted.
  ['borne-arrivee', 'const so = sortiParSuivis(ks, fins, ev.arriveeSure, { borne: ev.borneMs });', 'const so = sortiParSuivis(ks, fins, ev.arriveeMs);', /n° 1 : un achat Vinted/],
  // n° 2 : un e-mail « en transit » / un n° manuel sorti ne va plus nulle part.
  ['nulle-part', 'const t0 = parSuivi.get(k) || (manuels.has(k) ? ligneDeSuiviTransporteur(tr) : null);', 'const t0 = null;', /n° 2 : un e-mail resté « en transit »/],
  // constat a : l'achat sans code au n° d'un e-mail connu redevient une 2e carte.
  ['une-carte', 'if (!c && ks.some(k => nEmailConnus.has(k))) continue;', '', /constat a : un achat Vinted sans code/],
  // constat b : l'achat sans identité est compté « à retirer ».
  ['en-verification', '{ aConfirmer.push(o); continue; }', '{ }', /constat b : un achat sans aucune identité/],
  // n° 5 et 11 : la carte d'un achat vu par Vinted ne lit plus le transporteur.
  ['limite-extra', 'const ev = etatColisVinted(o, Date.now(), transpMap); const jl', 'const ev = etatColisVinted(o, Date.now(), null); const jl', /n° 5 et n° 11 : un achat Vinted porte la limite/],
  // n° 5 : la publication (widget, rappels) ne porte plus la limite du transporteur.
  ['publication-transp', 'const e = etatColisVinted(o, Date.now(), transpMap); const uid', 'const e = etatColisVinted(o, Date.now(), null); const uid', /la publication porte la limite et l'heure/],
  // n° 10 : plus de coupure de 30 jours pour un reparti vu par le transporteur.
  ['repartis-30j', "repartiAffichable} from '../api/_lib/suivi-colis.js';", "} from '../api/_lib/suivi-colis.js'; const repartiAffichable = () => true;", /n° 10 : reparti il y a 40 j/],
  // n° 8 : la fenêtre de 45 jours revient chez le lecteur de l'app.
  ['fenetre-45j', 'return rows.map(ligneTranspDeMeta).filter(Boolean);', "return rows.map(ligneTranspDeMeta).filter((t) => t && (Date.now() - Date.parse(t.lu || '') < 45 * 86400000));", /n° 8 : retiré il y a 60 jours/],
  // constat d : « sans doute repartis » revient au titre du bloc.
  ['sans-doute', '<Icon name="alert" size={16} color={C.warn}/>{pickupUnion.aVerifier.length} colis à vérifier', '<Icon name="alert" size={16} color={C.warn}/>{pickupUnion.aVerifier.length} colis à vérifier — sans doute repartis chez le vendeur', /constat d : le bloc « à vérifier »/],
];

const copier = (dest) => {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  cp.execSync(`tar -C ${JSON.stringify(RACINE)} --exclude=./node_modules --exclude=./dist --exclude=./.git --exclude=./scripts/bancs/fx -cf - . | tar -C ${JSON.stringify(dest)} -xf -`, { stdio: 'ignore', maxBuffer: 1 << 30 });
  fs.symlinkSync(fs.realpathSync(path.join(RACINE, 'node_modules')), path.join(dest, 'node_modules'));
};

for (const [nom, ancre, rempl, controle] of MUTATIONS) {
  if (SEULE && SEULE !== nom) continue;
  const dest = path.join(os.tmpdir(), 'mut-transp-' + nom);
  try {
    copier(dest);
    const f = path.join(dest, 'src', 'App.jsx');
    const s = fs.readFileSync(f, 'utf8');
    if (s.split(ancre).length !== 2) { dit(false, `mutation « ${nom} » non appliquée (ancre trouvée ${s.split(ancre).length - 1} fois)`); continue; }
    fs.writeFileSync(f, s.replace(ancre, rempl));
    const env = { ...process.env, NODE_OPTIONS: '' };
    cp.execSync(`node ${JSON.stringify(path.join(dest, 'node_modules', 'vite', 'bin', 'vite.js'))} build`, { cwd: dest, stdio: 'ignore', env });
    let sortie = '';
    try {
      sortie = cp.execSync('node scripts/bancs/transporteurs.cjs', { cwd: dest, encoding: 'utf8', env: { ...process.env, BANC_SEUL: 'E', BANC_PORT: PORT, PORT, BANC_DIST: '' }, maxBuffer: 1 << 28 });
    } catch (e) { sortie = String(e.stdout || '') + String(e.stderr || ''); }
    const rouges = sortie.split('\n').filter((l) => /^KO /.test(l));
    const vise = rouges.filter((l) => controle.test(l));
    dit(vise.length > 0, `mutation « ${nom} » ⇒ ${rouges.length} rouge(s), dont le contrôle visé`, (vise[0] || rouges[0] || 'aucun rouge').slice(0, 160));
  } catch (e) {
    dit(false, `mutation « ${nom} » — elle a pu s'exécuter`, String(e && e.message).split('\n')[0].slice(0, 160));
  } finally {
    fs.rmSync(dest, { recursive: true, force: true });
  }
}
console.log(ko ? `\n❌ ${ko} mutation(s) non attrapée(s) sur ${ok + ko}` : `\n✅ ${ok}/${ok + ko} mutations attrapées`);
process.exit(ko ? 1 : 0);
