// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — « ARTICLE » HORS SNEAKERS, PARTOUT (11 nov., lot vocabulaire-article)
//  Julien (lot DJ2) : tout le monde ne vend pas des sneakers. Le lot DJ2 a changé la
//  1re question et les exemples ; celui-ci change le MOT : partout où VRM disait
//  « paire(s) » à un vendeur qui ne vend pas (que) des sneakers, il dit « article(s) »,
//  accords compris (« 3 articles en ligne », « cet article », « l'article »). Un vendeur
//  Sneakers seul garde « paire » MOT POUR MOT.
//  UNE fonction de vocabulaire : `motsArticle` / `motsVendeur()` / `motArticle(n)`
//  (src/profilVendeur.js) ; le serveur l'importe (api/_lib/mots-vendeur.js), l'extension
//  la recopie (`--recopie`, vrm-mots.js et background.js).
//   R  la recopie de la table dans l'extension est identique à la source ;
//   M  la table : mêmes formes des deux côtés, aucune forme « article » ne dit paire ;
//   E  EXÉCUTION, code d'AVANT contre code d'APRÈS (git archive de `--avant`, défaut
//      origin/main) : chaque texte témoin rendu pour Sneakers est IDENTIQUE à celui
//      d'avant ; rendu pour un autre vendeur, il ne dit plus « paire » ;
//   V  le serveur (`vendServeur`) et l'extension (`vendDeReglage`) disent la même chose
//      que l'app (`jeVendsEffectif`) pour chaque réglage et chaque propriétaire ;
//   X  l'extension EXÉCUTÉE : vrm-mots.js lit `vrm_vend_ext` ; le vrai background.js
//      (scripts/_fond-vm.cjs) range « article » pour un vendeur « autre », « paire » pour
//      le propriétaire en automatique (lu chez vrm.center), les textes d'avant sans rien ;
//   S  relevé STATIQUE (@babel/parser) de src/, api/ et de l'extension : tout texte qui
//      dit « paire(s) » est dans la liste FERMÉE ci-dessous, avec sa raison ;
//   B  le branchement : la source posée par l'app, l'aide du « ? », Ma semaine, l'offre
//      par e-mail, les erreurs eBay, le manifeste (vrm-mots.js avant chaque page).
//  `--prouve` : chaque mutation doit rendre l'audit ROUGE. `--recopie` : refabrique la copie.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
const lire = (racine, f) => fs.readFileSync(path.join(racine, f), 'utf8');
const MARQUE_A = '// <mots-article>', MARQUE_B = '// </mots-article>';
const COPIES = ['vinted-sync-extension/vrm-mots.js', 'vinted-sync-extension/background.js'];

// Le bloc source : de `const MOTS = {` à `};` (entre les marques de src/profilVendeur.js).
function blocSource(racine) {
  const s = lire(racine, 'src/profilVendeur.js');
  const i = s.indexOf(MARQUE_A), j = s.indexOf(MARQUE_B);
  if (i < 0 || j < 0) return null;
  const corps = s.slice(i, j).split('\n').slice(1).join('\n');
  const k = corps.indexOf('const MOTS = {');
  return k < 0 ? null : corps.slice(k).trimEnd() + '\n';
}
function copieDans(racine, f) {
  const s = lire(racine, f);
  const i = s.indexOf(MARQUE_A), j = s.indexOf(MARQUE_B);
  if (i < 0 || j < 0) return null;
  return s.slice(s.indexOf('\n', i) + 1, j);
}
function recopier(racine) {
  const b = blocSource(racine);
  if (!b) throw new Error('bloc <mots-article> introuvable dans src/profilVendeur.js');
  for (const f of COPIES) {
    const p = path.join(racine, f), s = fs.readFileSync(p, 'utf8');
    const i = s.indexOf(MARQUE_A), j = s.indexOf(MARQUE_B);
    if (i < 0 || j < 0) throw new Error('marques absentes : ' + f);
    fs.writeFileSync(p, s.slice(0, s.indexOf('\n', i) + 1) + b + s.slice(j));
    console.log('recopié →', f);
  }
}

// ── La liste FERMÉE des textes qui gardent « paire(s) », avec leur raison ────────
// [fichier, motif sur le texte (ou null = tout le fichier), raison]
const PERMIS = [
  ['src/profilVendeur.js', null, 'la source du vocabulaire : les formes de Sneakers y vivent'],
  ['src/vocabulaireVendeur.js', null, 'les exemples de Sneakers (lot DJ2) et la liste des mots de chaussure de l’audit'],
  ['vinted-sync-extension/vrm-mots.js', null, 'la copie de la table (formes de Sneakers)'],
  ['src/Bienvenue.jsx', /^(Vinted, Leboncoin, eBay et Vestiaire Collective au même endroit|Un numéro par paire|Chaque paire reçoit)/, 'cartes de Sneakers : `demoBienvenue` les remplace hors Sneakers (audit-vendeurs-differents)'],
  ['src/Accueil.jsx', null, 'page PUBLIQUE vrm.center (aucun vendeur connecté, donc aucun « ce qu’il vend ») ; la démo publique est gardée (lot DJ2)'],
  ['src/ConfigurationDepart.jsx', /dira « paire »/, 'la description du choix « Sneakers » lui-même'],
  ['src/ecrans/Reglages.jsx', /« paires »|Autre paire · taille 41/, 'la description du choix « Sneakers » / l’exemple Sneakers (gardé par `snEx`)'],
  ['src/annulerCommandes.js', /^(Relier un achat à une paire|N° déjà servi|sort la paire du stock|Achats, Compta, Paramètres, Messages, fiche paire)/, 'CONFIRMATIONS : l’inventaire lu par audit-annuler-commandes, jamais affiché'],
  ['src/operations/description.js', /^À plusieurs : tâches, paires/, '`DESCRIPTION_ORGANISATION` gardée pour les audits d’Organisation ; l’app lit `descriptionOrganisation()`'],
  ['src/aideEcrans.js', null, 'rendu par `phraseVendeur` (AideEcran.jsx) : chaque phrase a sa version « article » (B2, B3)'],
  ['src/aideEtapes.js', null, 'généré par scripts/aide-generer.cjs ; rendu par `phraseVendeur` (B2, B3)'],
  ['src/rechercheUnique.js', /^Paires$/, 'GROUPES_LOUPE : l’étiquette « Paires » est remplacée par `motsVendeur().Noms` dans la recherche (App.jsx, B9)'],
  ['api/_lib/agent-ebay-rappel.js', /^aucune paire proposée$/, 'raison de diagnostic du cron (réponse JSON), jamais montrée au vendeur'],
  ['api/_lib/veille-plantages.js', /^Fiche d’une paire$/, 'alerte TECHNIQUE envoyée au seul propriétaire de l’installation (VRM_OWNER_UID)'],
];
// Une ligne gardée par « sneakers » (même ligne) : le texte de Sneakers, l'autre branche dit article.
const GARDE = /(?:===|!==) ?'sneakers'|'sneakers' ?(?:===|!==)|\b(?:sn|snEx) \?|vend !== 'sneakers'/;
// Le REPLI d'une page de l'extension si vrm-mots.js manquait (B7 l'exige avant chaque page) : le texte d'avant.
const REPLI_EXT = /globalThis\.VRM_MOTS \? globalThis\.VRM_MOTS\.mots\(\) : \{\}\)\.[A-Za-z]+ \|\| '[^']*paires?'/;
const MOT = /\b[Pp]aires?\b/;

function textesDe(racine, rel, parse, traverse) {
  const src = lire(racine, rel);
  let ast;
  try { ast = parse(src, { sourceType: 'unambiguous', plugins: ['jsx'], errorRecovery: true }); } catch (e) { return { erreur: e.message, l: [] }; }
  const L = src.split('\n'), out = [];
  const iA = L.findIndex((l) => l.startsWith(MARQUE_A)), iB = L.findIndex((l) => l.startsWith(MARQUE_B));
  const dansCopie = COPIES.includes(rel) && iA >= 0 && iB > iA ? [iA + 1, iB + 1] : null;
  traverse(ast, {
    'StringLiteral|JSXText|TemplateElement'(p) {
      const n = p.node, v = n.type === 'TemplateElement' ? n.value.cooked : n.value;
      if (!v || !MOT.test(v)) return;
      const par = p.parent;
      if (n.type === 'StringLiteral') {
        if ((par.type === 'ObjectProperty' || par.type === 'ObjectMethod') && par.key === n) return;
        if (par.type === 'ImportDeclaration' || par.type === 'ExportNamedDeclaration') return;
        if (par.type === 'BinaryExpression' && /[=!]==?/.test(par.operator)) return;
        if (par.type === 'SwitchCase') return;
        if (par.type === 'JSXAttribute' && /^(className|data-|key$|id$)/.test(par.name.name)) return;
        if (/^[a-z_:-]+$/.test(v)) {
          // une CLÉ (« paire », « vrm:fiche-paire », un mot vide d'une liste de lecture) — sauf
          // passée telle quelle à une fonction qui écrit un texte (pl, plur, ternaire d'un mot).
          const arg = par.type === 'CallExpression' && par.arguments.includes(n) && /^(pl|plur|pluriel|plurLbc)$/.test((par.callee && par.callee.name) || '');
          const tern = par.type === 'ConditionalExpression' && (par.consequent === n || par.alternate === n) && /^paires?$/.test(v);
          if (!arg && !tern) return;
        }
      }
      if (n.type === 'JSXText' && !v.trim()) return;
      // une clé de code dans un gabarit ou une classe (« a-paire », « :deux-paires », `[data-vc-paire="`) : un séparateur collé au mot.
      if (n.type !== 'JSXText' && /^\s*[a-z_:.\[\]="-]*[-:_[][a-z_:.\[\]="-]*\s*$/.test(v)) return;
      const ligne = n.loc.start.line;
      if (dansCopie && ligne > dansCopie[0] && ligne < dansCopie[1]) return;   // la copie de la table (R1)
      out.push({ rel, ligne, v: v.replace(/\s+/g, ' ').trim(), code: L[ligne - 1] || '' });
    },
  });
  return { l: out };
}
const fichiersDe = (racine) => {
  const out = [];
  const w = (d) => { for (const f of fs.readdirSync(path.join(racine, d), { withFileTypes: true })) { const p = path.posix.join(d, f.name); if (f.isDirectory()) w(p); else if (/\.(jsx?|mjs)$/.test(f.name)) out.push(p); } };
  w('src'); w('api');
  for (const f of fs.readdirSync(path.join(racine, 'vinted-sync-extension'))) if (/\.js$/.test(f)) out.push('vinted-sync-extension/' + f);
  return out;
};

async function verifier(racine, { muet = false, avant = null } = {}) {
  let ko = 0;
  const dit = (bon, quoi, det) => { if (!bon) ko++; if (!muet || !bon) console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det !== undefined ? ' — ' + String(typeof det === 'string' ? det : JSON.stringify(det)).slice(0, process.env.VOCAB_LONG ? 20000 : 700) : ''}`); };
  const imp = (r, p) => import(pathToFileURL(path.join(r, p)).href + '?v=' + Math.random());

  // ── R : la recopie ──
  const b = blocSource(racine);
  dit(!!b, 'R0 la table est entre les marques <mots-article> de src/profilVendeur.js');
  for (const f of COPIES) dit(b && copieDans(racine, f) === b, `R1 ${f} porte la copie EXACTE de la table`, 'node scripts/audit-vocabulaire-article.cjs --recopie');

  // ── M : la table ──
  let PV;
  // SANS « ?v= » : l'instance même que les autres modules importent (la source posée doit être la leur).
  try { PV = await import(pathToFileURL(path.join(racine, 'src/profilVendeur.js')).href); } catch (e) { dit(false, 'src/profilVendeur.js se charge', e.message); return ko || 1; }
  const S = PV.motsArticle('sneakers'), A = PV.motsArticle('autre');
  const kS = Object.keys(S).sort().join(','), kA = Object.keys(A).sort().join(',');
  dit(kS === kA, 'M1 mêmes formes pour Sneakers et pour « article »', { kS, kA });
  const avecPaire = Object.entries(A).filter(([, v]) => MOT.test(v));
  dit(!avecPaire.length && A.nom === 'article' && A.noms === 'articles' && A.ce === 'cet article' && A.le === 'l’article', 'M2 aucune forme « article » ne dit paire (« cet article », « l’article »)', avecPaire);
  dit(S.nom === 'paire' && S.noms === 'paires' && S.ce === 'cette paire' && S.le === 'la paire' && S.Un === 'Une paire', 'M3 les formes de Sneakers sont celles d’avant');
  dit(PV.motArticle(3, { vend: 'autre' }) === '3 articles' && PV.motArticle(1, { vend: 'autre' }) === '1 article' && PV.motArticle(3, { vend: 'sneakers' }) === '3 paires', 'M4 `motArticle(n, { vend })` : « 3 articles », « 1 article », « 3 paires »');
  const sansSource = PV.vendCourant();
  dit(sansSource === 'sneakers', 'M5 sans source posée (règle seule, banc) ⇒ Sneakers : les textes d’avant', sansSource);
  dit(Object.keys(PV.PHRASES_ARTICLE).every((k) => MOT.test(k)) && Object.values(PV.PHRASES_ARTICLE).every((v) => !MOT.test(v)), 'M6 PHRASES_ARTICLE : chaque phrase de Sneakers a sa version « article », écrite en entier, sans « paire »');

  // ── E : exécution, avant contre après ──
  const TEMOINS = [
    ['src/aTrancher.js', (m) => [m.NOMS['numeros-double'], m.SOURCES[0].quoi(3), m.SOURCES[0].pourquoi, m.SOURCES.find((s) => s.cle === 'achats-sans-prix').pourquoi, m.QUESTIONS['numeros-double'].n(), m.QUESTIONS['numeros-double'].x(), m.QUESTIONS['remise-en-ligne'].x({ de: '12' }), m.QUESTIONS['numeros-a-ecrire'].x()]],
    ['src/enLigneDeuxFois.js', (m) => { const g = { numeros: [], comptes: ['a'], memeCompte: true, annonces: [{ nom: 'shop' }, { nom: 'shop' }] }; return [m.texteCarte([g]).titre, m.texteCarte([g]).complet, m.texteCarte([{ ...g, numeros: ['1', '2'] }]).complet, m.texteCarte([g, g]).titre]; }],
    ['src/favorisAuto.js', (m) => [m.RAISONS_AUTO.vendue, m.RAISONS_AUTO.reservee, m.RAISONS_AUTO.garde_absente, m.RAISONS_AUTO.dressing_absent, m.ETATS_AUTO.garde_absente]],
    ['src/journeeWidgets.js', (m) => [m.WIDGETS_JOURNEE.prix.desc, m.WIDGETS_JOURNEE.tendances.desc]],
    ['src/emballage.js', (m) => [m.CASES_EMBALLAGE.find((c) => c.cle === 'trouvee').libelle]],
    ['src/coutVente.js', (m) => [JSON.stringify(m.texteValeurStock({ eur: 120, n: 3, nCout: 3 })), JSON.stringify(m.texteValeurStock({ eur: 40, n: 1, nCout: 1 }))]],
    ['src/dejaEnStock.js', (m) => [m.phraseDejaEnStock(2), m.phraseDejaEnStock(1, { autres: true })]],
    ['src/cibleNotif.js', (m) => [m.phraseAbsente({ cible: 'doublon' })]],
    ['src/guideDemarrage.js', (m) => [m.ETAPES_GUIDE.flatMap((e) => (e.choix || e.options || [])).map((o) => o && o.titre).filter(Boolean).join(' | ') || JSON.stringify(m.ETAPES_GUIDE).slice(0, 4000)]],
    ['src/tesDonnees.js', (m) => (Object.values(m).find((v) => Array.isArray(v) && v[0] && v[0].lignes) || []).flatMap((g) => g.lignes.map((l) => l.texte))],
    ['src/operations/atelier.js', (m) => [JSON.stringify(m.ligneAtelierJournee({ enRetard: 3, etapes: [{ nom: 'Nettoyage', enRetard: 3 }] })), JSON.stringify(m.ligneAtelierJournee({ enRetard: 3, etapes: [{ nom: 'A', enRetard: 1 }, { nom: 'B', enRetard: 2 }] }))]],
    ['src/bilanMois.js', (m) => [m.bilanDuMois({ ym: '2026-10', vendu: { eur: 10, n: 2 } }).lignes.find((l) => l.cle === 'paires').nom]],
    ['api/_lib/bilan-semaine.js', (m, c) => { const b = { vendu: { etat: 'su', n: 2, eur: 50 }, recu: { etat: 'su', eur: 40 }, colis: { etat: 'su', n: 0 } }; const s = { lundi: '2026-11-02', dimanche: '2026-11-08' }; return [m.texteBilan({ ...b, dorment: { etat: 'su', n: 4 } }, s, c.mots).corps, m.texteBilan({ ...b, dorment: { etat: 'su', n: 0 } }, s, c.mots).corps]; }],
    ['api/_lib/notif-apercus.js', (m) => [m.APERCUS_NOTIF.ventes.quoi, m.APERCUS_NOTIF.doublevente.quoi, JSON.stringify(m.APERCUS_NOTIF.rappels.exemples)]],
    ['api/email-inbound.js', (m, c) => [m.phraseConseilOffre({ etat: 'unique', prix: 40, ...(c.mots ? { mots: c.mots } : {}) }, 55), m.phraseConseilOffre({ etat: 'ambigu', n: 3, ...(c.mots ? { mots: c.mots } : {}) }, 55)]],
    ['api/_lib/ebay-relance.js', (m, c) => { c.requete(); return [JSON.stringify(m.jugerRelance({ itemId: '1', variantes: true }, { itemId: '1' })), JSON.stringify(m.jugerRelance({ itemId: '1', statut: 'Ended', vendus: 0 }, { itemId: '1', numero: '' })), JSON.stringify(m.jugerRelance({ itemId: '1', statut: 'Ended', vendus: 0, sku: 'rien' }, { itemId: '1', numero: '12' }))]; }],
  ];
  let arbreAvant = null;
  if (avant) {
    arbreAvant = fs.mkdtempSync(path.join(os.tmpdir(), 'vocab-avant-'));
    try { cp.execSync(`git archive ${avant} src api | tar -x -C ${arbreAvant}`, { cwd: racine, stdio: ['ignore', 'ignore', 'pipe'] }); fs.symlinkSync(path.join(racine, 'node_modules'), path.join(arbreAvant, 'node_modules')); }
    catch (e) { dit(false, `E0 l’arbre d’avant (${avant}) s’extrait`, e.message); arbreAvant = null; }
  }
  const pasDit = [], change = [], egaux = [];
  for (const [f, rendre] of TEMOINS) {
    let apresS, apresA, avantS;
    const MSr = await import(pathToFileURL(path.join(racine, 'api/_lib/mots-vendeur.js')).href).catch(() => null);   // l'instance qu'importe ebay-relance
    const ctx = (autre) => ({ mots: autre ? PV.motsArticle('autre') : undefined, requete: () => { if (MSr) MSr.poserMotsRequete(JSON.stringify({ choix: autre ? 'autre' : 'sneakers' }), 'x', {}); } });
    try { PV.poserSourceVend(null); const m = await imp(racine, f); apresS = rendre(m, ctx(false)); } catch (e) { dit(false, `E1 ${f} : rendu Sneakers`, e.message); continue; }
    try { PV.poserSourceVend(() => 'autre'); const m = await imp(racine, f); apresA = rendre(m, ctx(true)); } catch (e) { dit(false, `E1 ${f} : rendu « article »`, e.message); continue; } finally { PV.poserSourceVend(null); }
    if (arbreAvant) {
      try { const m = await imp(arbreAvant, f); avantS = rendre(m, { mots: undefined, requete: () => {} }); } catch (e) { avantS = { erreur: e.message }; }
      if (JSON.stringify(avantS) === JSON.stringify(apresS)) egaux.push(f); else change.push({ f, avant: avantS, apres: apresS });
    }
    const reste = (apresA || []).filter((t) => MOT.test(String(t)));
    if (reste.length) pasDit.push({ f, reste: reste.map((t) => String(t).slice(0, 160)) });
  }
  if (arbreAvant) dit(!change.length, `E2 Sneakers : ${egaux.length}/${TEMOINS.length} modules rendent EXACTEMENT les textes d’avant (${avant})`, change);
  dit(!pasDit.length, 'E3 pour un vendeur « autre », aucun texte témoin ne dit « paire »', pasDit);

  // ── V : serveur et extension = la règle de l'app ──
  let MS;
  try { MS = await imp(racine, 'api/_lib/mots-vendeur.js'); } catch (e) { dit(false, 'api/_lib/mots-vendeur.js se charge', e.message); }
  const reglages = [null, { choix: 'auto' }, { choix: 'sneakers' }, { choix: 'autre' }, { choix: 'autre', categories: ['lunettes'] }, { choix: 'sneakers', categories: ['sneakers'] }, 'n’importe quoi'];
  const env = { VRM_OWNER_UID: 'julien' };
  if (MS) {
    const ecarts = [];
    for (const r of reglages) for (const [owner, proprio] of [['julien', true], ['autre-vendeur', false]]) {
      const app = PV.jeVendsEffectif(r, { proprietaire: proprio }).vend, srv = MS.vendServeur(r, owner, env);
      if (app !== srv) ecarts.push({ r, owner, app, srv });
    }
    dit(!ecarts.length, 'V1 serveur : « paire » pour le propriétaire en automatique, « article » pour les autres — la règle de l’app', ecarts);
    dit(MS.vendServeur(null, '', env) === 'sneakers' && MS.vendServeur(null, 'x', {}) === 'autre', 'V2 serveur : sans vendeur nommé, l’installation parle à son propriétaire ; propriétaire inconnu ⇒ « article » (comme l’app, pas su)');
  }
  const fond = lire(racine, 'vinted-sync-extension/background.js');
  const fx = fond.match(/function vendDeReglage\(r, proprietaire\) \{[\s\S]*?\n\}/);
  if (fx) {
    const vendDeReglage = new Function(fx[0] + '\nreturn vendDeReglage;')();
    const ecarts = [];
    for (const r of reglages) for (const pr of [true, false, null]) { const app = PV.jeVendsEffectif(r, { proprietaire: pr }).vend, ext = vendDeReglage(r, pr); if (app !== ext) ecarts.push({ r, pr, app, ext }); }
    dit(!ecarts.length, 'V3 extension : `vendDeReglage` = `jeVendsEffectif` pour chaque réglage et chaque propriétaire (vrai, faux, pas su)', ecarts);
  } else dit(false, 'V3 `vendDeReglage` existe dans background.js');

  // ── X : l'extension exécutée ──
  try {
    const vm = require('vm');
    const code = lire(racine, 'vinted-sync-extension/vrm-mots.js');
    const page = async (valeur) => {
      const ecoutes = [];
      const ctx = { chrome: { storage: { local: { get: async () => (valeur === undefined ? {} : { vrm_vend_ext: valeur }) }, onChanged: { addListener: (f) => ecoutes.push(f) } } } };
      ctx.globalThis = ctx; vm.createContext(ctx); vm.runInContext(code, ctx);
      await new Promise((r) => setTimeout(r, 5));
      return { M: ctx.VRM_MOTS, ecoutes };
    };
    const a = await page({ vend: 'autre', owner: 'x', at: 1 }), s0 = await page(undefined), s1 = await page({ vend: 'sneakers' });
    a.ecoutes.forEach((f) => f({ vrm_vend_ext: { newValue: { vend: 'sneakers' } } }, 'local'));
    dit(s0.M.mots().nom === 'paire' && s1.M.mots().nom === 'paire' && a.M.vend() === 'sneakers', 'X1 vrm-mots.js : rien de rangé ⇒ « paire » (textes d’avant) ; un changement rangé est suivi');
    const a2 = await page({ vend: 'autre' });
    dit(a2.M.mots().ce === 'cet article' && a2.M.mots().Aucune === 'Aucun article', 'X2 vrm-mots.js : « autre » rangé ⇒ « cet article », « Aucun article »');
  } catch (e) { dit(false, 'X1 vrm-mots.js s’exécute', e.message); }
  try {
    const { faireFond } = require('./_fond-vm.cjs');
    const src = path.join(racine, 'vinted-sync-extension/background.js');
    const appels = [];
    const vrm = (proprio) => async (req) => { appels.push(req.chemin || req.url); return /mode=abonnement/.test(req.url || req.chemin || '') ? { status: 200, body: { ok: true, proprietaire: proprio } } : { status: 404, body: {} }; };
    const f1 = faireFond({ src, lignes: { main: { vrm_je_vends: { choix: 'autre', at: 'x' } } }, vrm: vrm(false) });
    await new Promise((r) => setTimeout(r, 10));
    const v1 = await f1.ctx.rafraichirVendExt({ choix: 'autre' }, 'owner-banc');
    const t1 = f1.ctx.motsExt();
    dit(v1 === 'autre' && t1.ce === 'cet article' && f1.store.vrm_vend_ext && f1.store.vrm_vend_ext.vend === 'autre' && !appels.length, 'X3 fond : « autre » choisi ⇒ « article », rangé pour les pages, sans rien demander à vrm.center', { v1, store: f1.store.vrm_vend_ext, appels });
    const f2 = faireFond({ src, lignes: { main: {} }, vrm: vrm(true) });
    await new Promise((r) => setTimeout(r, 10));
    const v2 = await f2.ctx.rafraichirVendExt(null, 'owner-banc');
    dit(v2 === 'sneakers' && f2.ctx.motsExt().ce === 'cette paire' && appels.some((a) => /mode=abonnement/.test(a)), 'X4 fond : automatique + propriétaire (lu chez vrm.center) ⇒ « paire »', { v2, appels });
    const f3 = faireFond({ src, lignes: { main: {} }, vrm: vrm(false) });
    await new Promise((r) => setTimeout(r, 10));
    const v3 = await f3.ctx.rafraichirVendExt({ choix: 'auto' }, 'owner-banc');
    dit(v3 === 'autre' && f3.ctx.motsExt().le === 'l’article', 'X5 fond : automatique + pas le propriétaire ⇒ « article »', v3);
    const f4 = faireFond({ src, lignes: {} });
    await new Promise((r) => setTimeout(r, 10));
    dit(f4.ctx.motsExt().ce === 'cette paire', 'X6 fond : rien de su ⇒ les textes d’avant (« cette paire »)');
    // Un texte réel du fond, pour un vendeur « autre ».
    const f5 = faireFond({ src, lignes: {}, store: { vrm_vend_ext: { vend: 'autre', owner: 'owner-banc', at: Date.now() } } });
    await new Promise((r) => setTimeout(r, 15));
    const conf = String((f5.ctx.RAISONS_COMMANDE || {}).confirmation || '') || (fond.match(/'confirmation': `[^`]*`/) || [''])[0];
    dit(f5.ctx.motsExt().nom === 'article' && /\$\{motsExt\(\)\.le\}/.test(conf), 'X7 fond : `vrm_vend_ext` rangé est relu au réveil du service worker ; « ce geste vend l’article »', conf.slice(0, 120));
  } catch (e) { dit(false, 'X3 le vrai background.js s’exécute (scripts/_fond-vm.cjs)', e.message); }

  // ── S : relevé statique ──
  let parse, traverse;
  try { ({ parse } = require(path.join(racine, 'node_modules/@babel/parser'))); traverse = require(path.join(racine, 'node_modules/@babel/traverse')).default; }
  catch (e) { dit(false, 'S0 @babel/parser et @babel/traverse sont là', e.message); return ko; }
  const hors = [], erreurs = [];
  let nTextes = 0, nPermis = 0, nGardes = 0;
  for (const rel of fichiersDe(racine)) {
    const { l, erreur } = textesDe(racine, rel, parse, traverse);
    if (erreur) { erreurs.push(`${rel} : ${erreur}`); continue; }
    for (const t of l) {
      nTextes++;
      if (PERMIS.some(([fi, re]) => fi === rel && (!re || re.test(t.v)))) { nPermis++; continue; }
      if (GARDE.test(t.code)) { nGardes++; continue; }
      if (rel.startsWith('vinted-sync-extension/') && REPLI_EXT.test(t.code)) { nGardes++; continue; }
      hors.push(`${rel}:${t.ligne} ${t.v.slice(0, 110)}`);
    }
  }
  dit(!erreurs.length, 'S0 chaque fichier se lit', erreurs);
  dit(!hors.length, `S1 aucun texte ne dit « paire(s) » hors Sneakers (${nPermis} permis, ${nGardes} gardés par « sneakers »)`, hors);

  // ── B : le branchement ──
  const app = lire(racine, 'src/App.jsx');
  dit(/poserSourceVend\(\(\) => vendActuel\(\)\);/.test(app), 'B1 l’app pose la source du vocabulaire (`poserSourceVend(() => vendActuel())`)');
  const aide = lire(racine, 'src/composants/AideEcran.jsx');
  dit(/phraseVendeur\(e\)/.test(aide) && /phraseVendeur\(q\)/.test(aide) && /phraseVendeur\(r\)/.test(aide), 'B2 l’aide du « ? » (étapes, questions, réponses) passe par `phraseVendeur`');
  try {
    const AE = await imp(racine, 'src/aideEcrans.js'), ET = await imp(racine, 'src/aideEtapes.js');
    const phrases = [...Object.values(ET.ETAPES_ECRANS).flat(), ...Object.values(AE.AIDE_ECRANS).flatMap((a) => a.questions.flat())].filter((t) => MOT.test(t));
    const manque = phrases.filter((t) => !PV.PHRASES_ARTICLE[t]);
    dit(phrases.length > 0 && !manque.length, `B3 chaque phrase d’aide qui dit « paire » (${phrases.length}) a sa version « article »`, manque);
  } catch (e) { dit(false, 'B3 l’aide se charge', e.message); }
  const rem = lire(racine, 'api/ship-reminders.js');
  dit(/texteBilan\(b, sem, motsServeur\(d\.main && d\.main\[MAIN_MOTS\], proprietaireCourant\(\)\)\)/.test(rem) && /const MAIN_BILAN = \[MAIN_MOTS,/.test(rem), 'B4 Ma semaine : la ligne main projette `vrm_je_vends`, le texte prend le mot du vendeur du tour');
  const inb = lire(racine, 'api/email-inbound.js');
  dit(/select=data->vinted_annonce_numeros,jv:data->vrm_je_vends/.test(inb) && /mots: motsServeur\(rows\[0\] && rows\[0\]\.jv, proprietaireCourant\(\)\)/.test(inb), 'B5 l’offre par e-mail : `vrm_je_vends` projeté, le conseil dit « article » hors Sneakers');
  const eb = lire(racine, 'api/ebay.js');
  const iA = eb.indexOf("reason: 'abonnement'"), iP = eb.indexOf('poserMotsRequete(await lireReglageVendeur(MAIN_MOTS, owner), owner);');
  dit(iA > 0 && iP > iA && !/Numéro de paire illisible/.test(eb), 'B6 eBay : le mot du vendeur est posé APRÈS la session et l’abonnement, les erreurs le lisent');
  let man = null; try { man = JSON.parse(lire(racine, 'vinted-sync-extension/manifest.json')); } catch (_) {}
  const pages = ['vinted-capture.js', 'vinted-infos.js', 'lbc.js', 'vc-depot.js', 'vrm-badge.js'];
  const malPlaces = man ? pages.filter((p) => !(man.content_scripts || []).some((c) => { const js = c.js || []; return js.includes(p) && js.indexOf('vrm-mots.js') > -1 && js.indexOf('vrm-mots.js') < js.indexOf(p); })) : pages;
  dit(!malPlaces.length, 'B7 manifeste : vrm-mots.js chargé AVANT chaque page qui l’utilise', malPlaces);
  dit(/await rafraichirVendExt\(main\.vrm_je_vends, owner\);/.test(fond) && /'vrm_numero_ecrit', 'vrm_je_vends'\]/.test(fond) && /function fullSync\(\) \{ vendExtAJour\(\);/.test(fond), 'B8 fond : `vrm_je_vends` relu avec les infos de page et à chaque synchronisation (au plus toutes les 6 h)');
  dit(/const GROUPES = GROUPES_LOUPE\.map\(\(\[t, l\]\) => \[t, t === 'paire' \? motsVendeur\(\)\.Noms : l\]\);/.test(app), 'B9 la recherche : le groupe « Paires » s’appelle « Articles » hors Sneakers');
  if (arbreAvant) try { fs.rmSync(arbreAvant, { recursive: true, force: true }); } catch (_) {}
  return ko;
}

const MUTATIONS = [
  ['src/profilVendeur.js', 'la forme « article » redit paire', "Ce: 'Cet article',", "Ce: 'Cette paire',"],
  ['src/profilVendeur.js', 'sans source ⇒ article (Sneakers changé)', "const v = sourceVend ? sourceVend() : 'sneakers';", "const v = sourceVend ? sourceVend() : 'autre';"],
  ['src/App.jsx', 'la source n’est plus posée', 'poserSourceVend(() => vendActuel());', ''],
  ['src/App.jsx', 'un texte remis en « paire »', '`Régler par {motsVendeur().nom}', '`Régler par paire'],
  ['src/App.jsx', 'un texte remis en « paire » (JSX)', '>Régler par {motsVendeur().nom}, voir l’historique ›</button>', '>Régler par paire, voir l’historique ›</button>'],
  ['src/aTrancher.js', 'une règle pure remise en « paire »', "get 'numeros-double'() { return `N° portés par deux ${motsVendeur().noms}`; },", "'numeros-double': 'N° portés par deux paires',"],
  ['src/composants/AideEcran.jsx', 'l’aide ne passe plus par phraseVendeur', '<span>{phraseVendeur(e)}</span>', '<span>{e}</span>'],
  ['src/profilVendeur.js', 'une phrase d’aide sans version article', "  'Range chaque paire là où VRM l’indique.': 'Range chaque article là où VRM l’indique.',\n", ''],
  ['api/_lib/bilan-semaine.js', 'Ma semaine ignore le mot', '${b.dorment.n > 1 ? mots.noms : mots.nom} en ligne', '${b.dorment.n > 1 ? \'paires\' : \'paire\'} en ligne'],
  ['api/ship-reminders.js', 'Ma semaine ne lit plus vrm_je_vends', 'const MAIN_BILAN = [MAIN_MOTS, ', 'const MAIN_BILAN = ['],
  ['api/_lib/mots-vendeur.js', 'le serveur dit paire à tout le monde', "  return jeVendsEffectif(jeVends, { proprietaire: proprio && o ? o === proprio : null }).vend;", "  return 'sneakers';"],
  ['api/ebay.js', 'eBay ne pose plus le mot', '  poserMotsRequete(await lireReglageVendeur(MAIN_MOTS, owner), owner);\n', ''],
  ['api/email-inbound.js', 'l’offre par e-mail dit paire', '${m.un} à ce titre a coûté', 'une paire à ce titre a coûté'],
  ['vinted-sync-extension/manifest.json', 'vrm-mots.js retiré d’une page', '"vrm-mots.js",\n        "lbc.js"', '"lbc.js"'],
  ['vinted-sync-extension/background.js', 'la copie dérive', "Ce: 'Cet article',", "Ce: 'Cet objet',"],
  ['vinted-sync-extension/background.js', 'le fond ignore le choix', "  if (c === 'sneakers' || c === 'autre') return c;\n  return proprietaire === true ? 'sneakers' : 'autre';", "  return 'sneakers';"],
  ['vinted-sync-extension/background.js', 'le fond ne range plus le mot', "  try { await chrome.storage.local.set({ vrm_vend_ext: { vend, owner, at: Date.now() } }); } catch (_) {}\n", ''],
  ['vinted-sync-extension/vrm-mots.js', 'la page ignore le mot rangé', "vend = v && typeof v === 'object' && v.vend === 'autre' ? 'autre' : 'sneakers';", "vend = 'sneakers';"],
  ['vinted-sync-extension/vinted-infos.js', 'l’encart remis en paire', "r.aConfirmer ? `${(globalThis.VRM_MOTS", "r.aConfirmer ? 'Aucune paire proche en ligne. Des comptes sont à relire.' || `${(globalThis.VRM_MOTS"],
  ['src/favorisAuto.js', 'une raison remise en paire (accord oublié)', 'get reservee() { return `${motsVendeur().Nom} réservé${motsVendeur().e} : aucun message.`; },', "reservee: 'Paire réservée : aucun message.',"],
];

(async () => {
  const argv = process.argv;
  if (argv.includes('--recopie')) { recopier(RACINE); process.exit(0); }
  const iAv = argv.indexOf('--avant');
  const avant = iAv > 0 ? argv[iAv + 1] : (() => { try { return cp.execSync('git merge-base HEAD origin/main', { cwd: RACINE }).toString().trim(); } catch (_) { return null; } })();
  if (!argv.includes('--prouve')) {
    const ko = await verifier(RACINE, { avant });
    console.log(ko ? `❌ audit-vocabulaire-article : ${ko} rouge(s)` : '✅ audit-vocabulaire-article : tout est vert');
    process.exit(ko ? 1 : 0);
  }
  // --prouve : chaque mutation, sur une copie de l'arbre, doit rendre ROUGE.
  let attrapees = 0;
  for (const [f, quoi, de, vers] of MUTATIONS) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vocab-mut-'));
    for (const d of ['src', 'api', 'vinted-sync-extension']) fs.cpSync(path.join(RACINE, d), path.join(tmp, d), { recursive: true });
    fs.symlinkSync(path.join(RACINE, 'node_modules'), path.join(tmp, 'node_modules'));
    for (const s of ['_fond-vm.cjs', '_chemin-json.cjs']) fs.copyFileSync(path.join(RACINE, 'scripts', s), path.join(tmp, s));
    fs.mkdirSync(path.join(tmp, 'bancs'), { recursive: true }); fs.cpSync(path.join(RACINE, 'scripts/bancs/_meta.cjs'), path.join(tmp, 'bancs/_meta.cjs'));
    const p = path.join(tmp, f), s = fs.readFileSync(p, 'utf8');
    if (!s.includes(de)) { console.log(`?? mutation « ${quoi} » : motif absent de ${f}`); fs.rmSync(tmp, { recursive: true, force: true }); continue; }
    fs.writeFileSync(p, s.replace(de, vers));
    const ko = await verifier(tmp, { muet: true, avant: null }).catch(() => 1);
    console.log(`${ko ? 'ROUGE ✓' : 'VERT ✗'}  ${quoi} (${f})`);
    if (ko) attrapees++;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`${attrapees}/${MUTATIONS.length} mutations attrapées`);
  process.exit(attrapees === MUTATIONS.length ? 0 : 1);
})();
