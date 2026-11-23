// ═════════════════════════════════════════════════════════════════════════════
// INVENTAIRE DES GESTES DE PLATEFORME DE L'APP (20 nov., décision de Julien :
// « toute action doit être faite dans l'extension, on ne doit plus pouvoir faire
// d'action dans l'app »). Lecture seule.
//
// Cherche, dans src/ (un arbre au choix), chaque chemin par lequel l'app AGIT sur
// Vinted, Leboncoin ou Vestiaire :
//   · une commande d'extension qui agit (`cmd: 'baisserPrixVinted'`… — la liste
//     CMDS ci-dessous, la même que src/actionsExtension.js `CMDS_PLATEFORME`) ;
//   · une requête brute qui écrit (`vmrExec`/`vmrExecUn` avec method POST/PUT/DELETE) ;
//   · une baisse rangée pour l'extension (`deposerPrixAttente`, lignes `cmd_prix_*`) ;
//   · la file serveur des messages aux favoris (`/api/compte?mode=favoris`, POST) ;
//   · l'écriture d'un réglage d'automatisation (offres auto, refus, paliers, baisse
//     par règle, vacances).
// Pour chacun : le fichier, la ligne, la fonction qui l'englobe, l'écran, le chemin,
// et les audits/bancs qui le nomment (fichier ou commande).
//
//   node scripts/inventaire-actions-app.cjs                  l'arbre de ce dépôt
//   node scripts/inventaire-actions-app.cjs --arbre <dossier> un autre arbre (ex. `git archive origin/main`)
//   node scripts/inventaire-actions-app.cjs --json            la liste brute
// ═════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let parser;
try { parser = require(path.join(__dirname, '..', 'node_modules', '@babel', 'parser')); } catch (_) { parser = require('@babel/parser'); }

const args = process.argv.slice(2);
const iA = args.indexOf('--arbre');
const RACINE = iA >= 0 ? path.resolve(args[iA + 1]) : path.join(__dirname, '..');
const JSON_SEUL = args.includes('--json');

// La même liste que src/actionsExtension.js (`CMDS_PLATEFORME`) — recopiée ici pour juger un arbre où ce fichier n'existe pas.
const CMDS = ['baisserPrixVinted', 'planifierBaisses', 'annulerBaisses', 'lbcPrix', 'vcPrix', 'lbcPause', 'lbcSupprime', 'lbcPublier', 'lbcRepondre',
  'vcRepondre', 'vcOffre', 'vcOffreAimes', 'vcPreparer', 'creerVintedFiche', 'publierFiche', 'publierBrouillon', 'recreerVinted', 'republierVinted',
  'reprendreRepub', 'refaireBrouillon', 'vacancesVinted'];
// Le geste de chaque commande (la colonne « geste » du tableau).
const GESTE = {
  baisserPrixVinted: 'changer / baisser un prix Vinted', planifierBaisses: 'baisse programmée Vinted', annulerBaisses: 'annuler une baisse programmée',
  lbcPrix: 'changer un prix Leboncoin', vcPrix: 'changer un prix Vestiaire', lbcPause: 'mettre en pause (Leboncoin)', lbcSupprime: 'supprimer (Leboncoin)',
  lbcPublier: 'publier sur Leboncoin', lbcRepondre: 'répondre (Leboncoin)', vcRepondre: 'répondre (Vestiaire)', vcOffre: 'offre / contre-offre (Vestiaire)',
  vcOffreAimes: 'offre aux « aimés » (Vestiaire)', vcPreparer: 'publier sur Vestiaire', creerVintedFiche: 'Créer sur Vinted', publierFiche: 'Publier sur… (agent)',
  publierBrouillon: 'mettre un brouillon en ligne', recreerVinted: 'republier (recréer)', republierVinted: 'modifier sur place / republier', reprendreRepub: 'reprendre une republication',
  refaireBrouillon: 'refaire un brouillon', vacancesVinted: 'mode vacances',
};
const REGLAGES = { vinted_offres_auto: 'allumer / éteindre les offres auto', vinted_offre_refus_msg: 'message de refus auto', vinted_offre_refus_variantes: 'variantes du refus',
  CLE_PALIERS: 'négociation par paliers', REGLE_CLE: 'baisse par règle', vinted_baisse_regle: 'baisse par règle', vinted_offres_paliers: 'négociation par paliers' };

// L'écran d'un fichier (pour le tableau) ; App.jsx : l'écran se lit dans la fonction englobante.
const ECRAN = [
  [/PrixPartout|prixPartout|prixAttente/, 'Fiche → « Changer le prix » (feuille Prix partout)'], [/BaissePrix|LbcBaissePrix|baissePrix/, 'Annonces → Actions → Baisser'],
  [/soldes|ArgentPrix/, 'Argent → Soldes → Remettre les prix'], [/Republier|RepubProgramme/, 'Annonces → Republier (atelier)'],
  [/CreerSurVinted|publier\/agent|PublierAgent/, 'À publier → Créer sur Vinted / Publier sur…'], [/PublierPartout/, 'Annonces → Publier partout'],
  [/ecrans\/Leboncoin/, 'Leboncoin (publier, republier, pause, supprimer)'], [/MessagesLeboncoin/, 'Messages → Leboncoin (répondre)'],
  [/ecrans\/Vestiaire|OffresVestiaire|AimesVestiaire/, 'Vestiaire (publier, prix, répondre, offres)'], [/AnnoncesEgalite/, 'Annonces (natif) → Actions → Pause Leboncoin'],
  [/Favoris|favoris/, 'Messages → Favoris (messages aux favoris, mode auto)'], [/OffresAuto|NegociationPaliers/, 'Messages → Offres auto'],
  [/automatisations/, 'Paramètres → Automatisations'], [/ModeVacances/, 'Réglages → Mode vacances'],
];
// App.jsx : l'écran se déduit du chemin (une fonction de 10 000 lignes ne dit rien).
const ECRAN_APP = [
  [/publierBrouillon|recreerVinted|republierVinted|reprendreRepub|refaireBrouillon/, 'Annonces → Republier / Brouillons (atelier)'],
  [/baisserPrixVinted|planifierBaisses|annulerBaisses/, 'Annonces → Actions → Baisser le prix (série)'],
  [/lbcSupprime/, 'Ma journée / À retirer ailleurs → Supprimer de Leboncoin'],
  [/lbcPublier|vcPreparer/, 'Annonces → Publier partout'],
  [/cmd_prix|REGLE_CLE/, 'Fiche → « Changer le prix » (feuille Prix partout)'],
  [/vinted_offre|vinted_offres_auto/, 'Messages → Offres auto'],
  [/favoris/, 'Messages → Favoris (messages aux favoris, mode auto)'],
  [/replies/, 'Messages → Vinted (répondre)'], [/offer_requests/, 'Messages → Vinted (offre reçue)'],
];
const ecranDe = (f, fn, chemin) => {
  if (f.endsWith('App.jsx')) { for (const [re, e] of ECRAN_APP) if (re.test(chemin || '')) return e; return 'App.jsx · ' + (fn || '?'); }
  for (const [re, e] of ECRAN) if (re.test(f) || re.test(fn || '')) return e; return f;
};

function fichiers(d, out = []) {
  if (!fs.existsSync(d)) return out;
  for (const n of fs.readdirSync(d)) {
    const p = path.join(d, n);
    const st = fs.statSync(p);
    if (st.isDirectory()) { if (n !== 'i18n' && n !== 'node_modules') fichiers(p, out); }
    else if (/\.(jsx?|mjs)$/.test(n)) out.push(p);
  }
  return out;
}

// Les noms de fonctions qui englobent chaque ligne (par l'AST ; repli : aucune).
function englobantes(src) {
  const parties = [];
  let ast = null;
  try { ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx'], errorRecovery: true }); } catch (_) { return () => ''; }
  const marche = (n, nom) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach((x) => marche(x, nom)); return; }
    let ici = nom;
    if (n.type === 'FunctionDeclaration' && n.id) ici = n.id.name;
    if (n.type === 'VariableDeclarator' && n.id && n.id.name && n.init && /Function/.test(n.init.type)) ici = n.id.name;
    if (ici !== nom && n.loc) parties.push({ a: n.loc.start.line, b: n.loc.end.line, nom: ici });
    for (const k of Object.keys(n)) { if (k === 'loc' || k === 'start' || k === 'end' || k === 'leadingComments' || k === 'trailingComments') continue; const v = n[k]; if (v && typeof v === 'object') marche(v, ici); }
  };
  marche(ast.program, '');
  return (ligne) => { let m = null; for (const p of parties) if (p.a <= ligne && ligne <= p.b && (!m || p.b - p.a <= m.b - m.a)) m = p; return m ? m.nom : ''; };
}

const sansCommentaires = (l) => l.replace(/\/\/.*$/, '');
const trouve = [];
for (const f of fichiers(path.join(RACINE, 'src'))) {
  const rel = path.relative(RACINE, f).split(path.sep).join('/');
  if (rel === 'src/actionsExtension.js') continue;   // le registre lui-même
  const src = fs.readFileSync(f, 'utf8');
  const lignes = src.split('\n');
  const fnDe = englobantes(src);
  lignes.forEach((brut, i) => {
    const l = sansCommentaires(brut);
    const n = i + 1;
    for (const m of l.matchAll(/cmd\s*:\s*['"]([a-zA-Z]+)['"]/g)) if (CMDS.includes(m[1])) trouve.push({ fichier: rel, ligne: n, fn: fnDe(n), chemin: 'commande ' + m[1], geste: GESTE[m[1]] });
    for (const m of l.matchAll(/\b(cmd(?:R)?)\s*=\s*[^;]*['"](refaireBrouillon|reprendreRepub)['"]/g)) trouve.push({ fichier: rel, ligne: n, fn: fnDe(n), chemin: 'commande ' + m[2] + ' (choisie)', geste: GESTE[m[2]] });
    if (/\bvmrExec(?:Un)?\s*\(\s*\{[^}]*method\s*:\s*['"](POST|PUT|DELETE|PATCH)['"]/.test(l)) {
      const ep = (/endpoint\s*:\s*[`'"]([^`'"]+)/.exec(l) || [])[1] || '';
      trouve.push({ fichier: rel, ligne: n, fn: fnDe(n), chemin: 'écriture brute ' + ep, geste: /replies/.test(ep) ? 'répondre (Vinted)' : /favoris/.test(ep) ? 'messages aux favoris' : /offer/.test(ep) ? 'offre (Vinted)' : 'écriture Vinted' });
    }
    if (/let method\s*=\s*'PUT'/.test(l)) trouve.push({ fichier: rel, ligne: n, fn: fnDe(n), chemin: 'écriture brute offer_requests (accept/reject/offre)', geste: 'accepter / refuser / contre-offre (Vinted)' });
    if (/\bdeposerPrixAttente\s*\(/.test(l) && !/export (async )?function/.test(l)) trouve.push({ fichier: rel, ligne: n, fn: fnDe(n), chemin: 'ligne cmd_prix_* rangée pour l\'extension', geste: 'changer un prix (en attente)' });
    if (/mode=favoris/.test(l) && /method\s*:\s*'POST'|POST/.test(l + (lignes[i + 1] || '') + (lignes[i + 2] || ''))) trouve.push({ fichier: rel, ligne: n, fn: fnDe(n), chemin: '/api/compte?mode=favoris (POST)', geste: 'messages aux favoris (file serveur / mode auto)' });
    for (const m of l.matchAll(/\bsave\(\s*['"]?([A-Za-z_]+)['"]?\s*,/g)) if (REGLAGES[m[1]]) trouve.push({ fichier: rel, ligne: n, fn: fnDe(n), chemin: 'réglage ' + m[1], geste: REGLAGES[m[1]] });
  });
}

// Les tests qui nomment le fichier ou la commande.
const lesCjs = (d, out = []) => { if (!fs.existsSync(d)) return out; for (const n of fs.readdirSync(d)) { const p = path.join(d, n); if (fs.statSync(p).isDirectory()) { if (n !== 'node_modules' && n !== 'fx') lesCjs(p, out); } else if (/\.cjs$/.test(n)) out.push(p); } return out; };
const TESTS = lesCjs(path.join(RACINE, 'scripts'));
const testsDe = (() => {
  const cache = new Map();
  const corps = TESTS.map((t) => ({ nom: path.relative(path.join(RACINE, 'scripts'), t), src: fs.readFileSync(t, 'utf8') }));
  return (x) => {
    const base = path.basename(x.fichier);
    const cmd = (/commande (\w+)/.exec(x.chemin) || [])[1] || '';
    const k = base + '|' + cmd;
    if (!cache.has(k)) cache.set(k, corps.filter((c) => c.nom !== 'inventaire-actions-app.cjs' && c.nom !== 'audit-actions-app.cjs' && (c.src.includes(base) && base !== 'App.jsx' || (cmd && c.src.includes(cmd)))).map((c) => c.nom).slice(0, 6));
    return cache.get(k);
  };
})();
for (const x of trouve) { x.ecran = ecranDe(x.fichier, x.fn, x.chemin); x.tests = testsDe(x); }

if (JSON_SEUL) { process.stdout.write(JSON.stringify(trouve, null, 1) + '\n'); process.exit(0); }
console.log(`Inventaire des gestes de plateforme · arbre ${path.relative(process.cwd(), RACINE) || '.'} · ${trouve.length} chemin(s)\n`);
console.log('| geste | écran | chemin | fichier:ligne (fonction) | tests |');
console.log('|---|---|---|---|---|');
for (const x of trouve) console.log(`| ${x.geste} | ${x.ecran} | ${x.chemin} | ${x.fichier}:${x.ligne} (${x.fn || '—'}) | ${x.tests.join(', ') || '—'} |`);
