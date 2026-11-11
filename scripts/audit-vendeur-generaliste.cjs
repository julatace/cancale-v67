// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — VRM POUR TOUS LES VENDEURS (lot DJ2, 11 nov., claude/vendeur-generaliste)
//  Julien, 11 nov. : « tout le monde ne vend pas des sneakers : la première question
//  c'est sneakers ou autre chose, fais plein de propositions » ; « ça peut très bien
//  être sur des étagères et pas dans des cartons » ; « "Simple ou complet ?" pas
//  clair » ; « arrête de faire allusion à des chaussures, il y a des personnes qui
//  vendent des lunettes ».
//  Exécute les VRAIES règles :
//   Q  « Tu vends quoi ? » : 1re étape, ≥ 15 propositions dont Lunettes ; un compte
//      installé (Julien compris) la voit UNE fois, seule, rien de pré-coché ; « Plus
//      tard » ⇒ `vu` rangé dans `vrm_je_vends` (rien d'autre) ; jamais pour un compte
//      qui a déjà choisi, ni en exemple, ni « pas su » ;
//   E  les exemples (src/vocabulaireVendeur.js) : Sneakers seules ⇒ les textes d'avant
//      MOT POUR MOT (Julien inchangé) ; Lunettes ⇒ un exemple de lunettes ; aucune autre
//      catégorie, ni le neutre, ne parle de chaussure ; plusieurs catégories ⇒ neutre ;
//   A  « Quel VRM te ressemble ? » : 2 cartes, 3 puces, pour qui, un aperçu, le chemin
//      « Paramètres » ; les puces de Simple disent ce que la règle cache vraiment ;
//   S  relevé STATIQUE de src/ : un texte affiché qui parle de chaussure (chaussure,
//      basket, sneaker, pointure, semelle, lacet) est soit GARDÉ par « sneakers »
//      (même ligne), soit dans la liste ci-dessous avec sa raison ; et aucun texte ne
//      dit que le N° s'écrit « sur le/son/leur carton » (le rangement peut être une
//      étagère, un bac…) ;
//   B  le branchement : la note, la recherche, la phrase d'Annonces/Stock, le Stock,
//      la question une fois, la carte d'emballage passent par la règle.
//  `--prouve` : chaque mutation doit rendre l'audit ROUGE.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');

// Les textes de chaussure PERMIS hors garde « sneakers » (fichier, motif, raison).
const PERMIS = [
  ['src/App.jsx', /^'\^\(\?:chaussures|^'\(taille\|pointure/, 'expression de lecture d’un titre (aucun texte affiché)'],
  ['src/App.jsx', /^'Chaussures( enfants)?'$/, 'catégorie Leboncoin (le nom du site), choisie seulement pour un article chaussure'],
  ['src/Accueil.jsx', /seulement pour les baskets \?/, 'la question de l’accueil, dont la réponse est « Non : tout article »'],
  ['src/ebayRecherche.jsx', /^(>Pointure<|"Pointure")$/, 'critère de recherche eBay (veille) : la donnée elle-même s’appelle pointure (2 chiffres)'],
  ['src/operations/Operations.jsx', /Pointure/, 'le même critère de veille eBay (Organisation, retirée du menu)'],
  ['src/operations/metier.js', /Pointure attendue/, 'la validation du critère de veille eBay'],
  ['src/verifAnnonce.js', /Remplis la pointure/, 'jugé seulement pour Sneakers (`champsFacultatifs`)'],
  ['src/vocabulaireVendeur.js', /./, 'la source des exemples : ceux de Sneakers y vivent'],
  ['src/profilVendeur.js', /./, 'la tuile « Sneakers » et la règle du mot'],
  ['src/ecrans/Reglages.jsx', /^'Sneakers'$/, 'Je vends : « Sneakers » est un des choix proposés'],
  ['src/ecrans/Ebay.jsx', /^'baskets mode'$/, 'clé de rapprochement des types d’article eBay (jamais affichée)'],
];
const MOTS = /\b(chaussures?|baskets?|sneakers?|pointures?|semelles?|lacets?)\b/i;
const sansCom = (s) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).split('\n').map((l) => (/^\s*\/\//.test(l) ? '' : l.replace(/(^|[^:'"`\\])\/\/\s.*$/, '$1'))).join('\n');
const fichiersSrc = (racine) => { const out = []; const w = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) w(p); else if (/\.jsx?$/.test(f.name)) out.push(p); } }; w(path.join(racine, 'src')); return out; };

async function verifier(racine, { muet = false } = {}) {
  let ko = 0;
  const dit = (bon, quoi, det) => { if (!bon) ko++; if (!muet || !bon) console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det !== undefined ? ' — ' + String(typeof det === 'string' ? det : JSON.stringify(det)).slice(0, 600) : ''}`); };
  const imp = (p) => import(pathToFileURL(path.join(racine, p)).href + '?v=' + Math.random());
  let PV, G, V, ET;
  try { PV = await imp('src/profilVendeur.js'); G = await imp('src/configurationDepart.js'); V = await imp('src/vocabulaireVendeur.js'); ET = await imp('src/etiquetteNumero.js'); }
  catch (e) { dit(false, 'les modules se chargent', e.message); return ko || 1; }
  const lire = (p) => fs.readFileSync(path.join(racine, p), 'utf8');

  // ── Q : la question ──
  const ids = PV.CATEGORIES_VENDS.map((c) => c.v);
  const voulues = ['sneakers', 'vetements', 'sacs', 'montres', 'lunettes', 'vintage', 'enfants', 'maison', 'livres', 'jeux', 'hightech', 'jouets', 'sport', 'beaute', 'autre'];
  dit(voulues.every((v) => ids.includes(v)), `Q1 « Tu vends quoi ? » propose ${ids.length} tuiles, Lunettes comprise`, voulues.filter((v) => !ids.includes(v)));
  dit(G.ETAPES_CONFIGURATION[0].cle === 'vends' && /Tu vends quoi/.test(G.ETAPES_CONFIGURATION[0].titre) && !V.MOTS_CHAUSSURE.test(G.ETAPES_CONFIGURATION[0].sous), 'Q2 c’est la 1re question, sans parler de chaussures', G.ETAPES_CONFIGURATION[0]);
  const ok = { pret: true, baseKO: false, exemple: false, bienvenue: false, configuration: { etat: 'fait', at: 'x' }, plateformes: { sites: ['vinted'], at: 'x' } };
  dit(G.questionVendsAOuvrir({ ...ok, proprietaire: true, jeVends: null }) === true && G.questionVendsAOuvrir({ ...ok, proprietaire: false, jeVends: { choix: 'auto' } }) === true, 'Q3 un compte installé qui n’a rien choisi (Julien compris) la voit');
  dit(G.questionVendsAOuvrir({ ...ok, proprietaire: true, jeVends: { choix: 'sneakers' } }) === false && G.questionVendsAOuvrir({ ...ok, proprietaire: false, jeVends: { choix: 'autre', categories: ['lunettes'] } }) === false, 'Q4 un compte qui a déjà choisi ne la revoit pas');
  dit(G.questionVendsAOuvrir({ ...ok, proprietaire: true, jeVends: { choix: 'auto', vu: '2026-11-11T08:00:00Z' } }) === false, 'Q5 « Plus tard » une fois ⇒ elle ne revient pas');
  dit(G.questionVendsAOuvrir({ ...ok, proprietaire: null, jeVends: null }) === false && G.questionVendsAOuvrir({ ...ok, exemple: true, proprietaire: true }) === false && G.questionVendsAOuvrir({ ...ok, baseKO: true, proprietaire: true }) === false && G.questionVendsAOuvrir({ ...ok, bienvenue: true, proprietaire: true }) === false, 'Q6 jamais sur un « pas su », en exemple, base injoignable ou pendant Bienvenue');
  dit(G.questionVendsAOuvrir({ pret: true, proprietaire: false, configuration: null, plateformes: null, jeVends: null }) === false, 'Q7 un vendeur NEUF a la configuration complète (elle commence par cette question) : pas deux fois');
  const w = G.ecritureVendsVu({ choix: 'auto', at: 'a' }, 'T');
  dit(w && w.cle === 'vrm_je_vends' && w.valeur.choix === 'auto' && w.valeur.vu === 'T' && !w.valeur.categories && G.ecritureVendsVu({ choix: 'sneakers' }, 'T') === null && G.ecritureVendsVu({ choix: 'auto', vu: 'x' }, 'T') === null, 'Q8 « Plus tard » écrit `vu` seulement (aucun choix posé à sa place) ; déjà choisi ⇒ rien', w);
  const vide = G.choixInitiaux({ jeVends: null });
  dit(vide.vends === null && PV.jeVendsEffectif({ choix: 'auto', vu: 'x' }, { proprietaire: true }).vend === 'sneakers', 'Q9 rien de pré-coché ; tant qu’il n’a pas choisi, le propriétaire garde « paire »');
  dit(PV.reglageJeVendsDe(['lunettes'], '', 'T').choix === 'autre' && PV.motsArticle('autre').nom === 'article', 'Q10 Lunettes ⇒ « article »');

  // ── E : les exemples ──
  const sn = V.exemplesVendeur({ vend: 'sneakers', categories: ['sneakers'] });
  dit(sn.note === 'ex : petite tache semelle gauche' && JSON.stringify(sn.annonce) === JSON.stringify(ET.ANNONCE_EXEMPLE) && sn.essaiNumero === 'Très bon état, pointure 42.\nN° 125', 'E1 Sneakers : les exemples d’avant, mot pour mot (Julien inchangé)', sn);
  dit(V.exemplesVendeur({ vend: 'sneakers', categories: null }) === sn, 'E2 propriétaire sans choix (défaut « sneakers ») : inchangé');
  const lu = V.exemplesVendeur({ vend: 'autre', categories: ['lunettes'] });
  dit(/verre|étui|monture/.test(lu.note) && /lunettes|Ray-Ban/i.test(lu.annonce.titre + lu.achat), 'E3 Lunettes ⇒ un exemple de lunettes', lu);
  const fautifs = [];
  for (const c of V.CATEGORIES_AVEC_EXEMPLES.filter((x) => x !== 'sneakers').concat(['autre', '?'])) {
    const e = V.exemplesVendeur({ vend: 'autre', categories: [c] });
    const t = JSON.stringify(e);
    if (V.MOTS_CHAUSSURE.test(t) || /Nike|Air Max|Adidas/.test(t)) fautifs.push(c);
  }
  dit(!fautifs.length, 'E4 aucune autre catégorie (ni le neutre) ne parle de chaussure', fautifs);
  dit(V.exemplesVendeur({ vend: 'autre', categories: ['sneakers', 'lunettes'] }) === V.EXEMPLES_NEUTRES && V.exemplesVendeur({ vend: 'autre', categories: null }) === V.EXEMPLES_NEUTRES, 'E5 plusieurs catégories, ou rien chez un autre vendeur ⇒ neutre');
  dit(V.motTaille('sneakers') === 'Pointure' && V.motTaille('autre') === 'Taille', 'E6 « Pointure » seulement pour Sneakers');

  // ── A : l'affichage ──
  const A = G.CHOIX_AFFICHAGE;
  dit(A.length === 2 && A.map((x) => x.v).join() === 'simple,complet', 'A1 deux cartes : Simple, Complet', A.map((x) => x.v));
  dit(A.every((x) => Array.isArray(x.puces) && x.puces.length === 3 && x.puces.every((p) => p.ic && p.t && p.t.split(/\s+/).length <= 12) && x.pourQui && x.apercu > 0), 'A2 pour qui, 3 puces courtes à icône, un aperçu, par carte', A);
  const ps = A[0].puces.map((p) => p.t).join(' ');
  dit(/Stock/.test(ps) && /Republier/.test(ps) && /plateformes/.test(ps) && /Prix à baisser/.test(ps) && /débute|peu/.test(A[0].pourQui) && /beaucoup|plusieurs comptes/.test(A[1].pourQui), 'A3 Simple dit ce que la règle cache (Stock, Republier, plateformes, « Prix à baisser »)', ps);
  const etA = G.ETAPES_CONFIGURATION.find((e) => e.cle === 'affichage');
  dit(!/Simple ou complet|à tout moment/.test(etA.titre + etA.sous) && G.CHEMIN_REGLAGE_AFFICHAGE === 'Paramètres → Affichage', 'A4 plus de « Simple ou complet ? Tu pourras changer à tout moment » ; le chemin dit « Paramètres »', etA);
  dit(/\{CHEMIN_REGLAGE_AFFICHAGE\}/.test(lire('src/ConfigurationDepart.jsx')) && /Tu pourras changer dans \{CHEMIN_REGLAGE_AFFICHAGE\}/.test(lire('src/ConfigurationDepart.jsx')), 'A5 l’écran dit « Tu pourras changer dans Paramètres → Affichage »');

  // ── S : le relevé statique ──
  const hors = [];
  const cartons = [];
  for (const f of fichiersSrc(racine)) {
    const rel = path.relative(racine, f).split(path.sep).join('/');
    const t = sansCom(fs.readFileSync(f, 'utf8'));
    t.split('\n').forEach((l, i) => {
      // « sur ${pl(n, 'son carton', 'leurs cartons')} » : les morceaux d'un gabarit comptent aussi.
      if (/['"](?:son|leurs?|ton|tes) cartons?['"]/.test(l)) cartons.push(`${rel}:${i + 1} ${l.trim().slice(0, 90)}`);
      const lits = l.match(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`|>[^<>{}\n]+</g) || [];
      for (const s of lits) {
        if ((/(?:sur|à) (?:le|son|leur|leurs|les|ton|tes) cartons?\b(?! (?:fermé|du colis|d’envoi))(?!, l’étagère)/i.test(s) || /^['"`](?:son|leur|leurs|ton|tes) cartons?['"`]$/.test(s)) && !/[Pp]hoto du carton/.test(s)) cartons.push(`${rel}:${i + 1} ${s.slice(0, 90)}`);
        if (!MOTS.test(s)) continue;
        if (/^['"`][a-z-]+['"`]$/.test(s)) continue;                    // une clé (« sneakers », « chaussures »), pas un texte
        if (/(?:===|!==) ?'sneakers'|'sneakers' ?(?:===|!==)/.test(l)) continue;   // gardé par ce qu'il vend
        if (PERMIS.some(([fi, re]) => fi === rel && re.test(s))) continue;
        hors.push(`${rel}:${i + 1} ${s.slice(0, 90)}`);
      }
    });
  }
  dit(!hors.length, 'S1 aucun texte de chaussure hors « Sneakers » (sauf la liste justifiée)', hors);
  dit(!cartons.length, 'S2 aucun texte ne dit que le N° s’écrit « sur le carton » (étagère, bac…)', cartons);

  // ── B : le branchement ──
  const app = sansCom(lire('src/App.jsx'));
  dit(/placeholder: exemplesActuels\(\)\.note/.test(app) && !/petite tache semelle/.test(app), 'B1 la note d’un article prend l’exemple de ce qu’il vend');
  dit(/aria-label=\{`Rechercher \$\{motsArticle\(/.test(app) && !/'Rechercher une paire'|"Rechercher une paire"/.test(app), 'B2 la recherche dit « une paire » / « un article » selon ce qu’il vend');
  dit(/phraseEcranPour\(cle, p\.vend \|\| vendActuel\(\)\)/.test(app) && /garage: 'Où est rangé chaque article/.test(lire('src/phrasesEcran.js')), 'B3 la phrase d’Annonces et de Stock suit ce qu’il vend');
  dit(/questionVendsAOuvrir\(\{/.test(app) && /setConfigSeule\('vends'\)/.test(app), 'B4 la question « Tu vends quoi ? » s’ouvre seule, une fois');
  const st = sansCom(lire('src/ecrans/Stock.jsx'));
  dit(/StatBox label=\{motsStock\.noms/.test(st) && /exemple=\{exemplesStock\.emballage\}/.test(st) && !/Boîte à chaussures/.test(sansCom(lire('src/EmballagesCarte.jsx'))), 'B5 Stock : « Paires » / « Articles » et l’emballage proposé suivent ce qu’il vend');
  dit(/vend !== 'sneakers'\) c\.groupes/.test(sansCom(lire('src/ATrancher.jsx'))) && /titre: 'Annonces', cles: \['supprimes-vinted'/.test(lire('src/aTrancher.js')), 'B6 À trancher : « article » hors Sneakers, le groupe s’appelle « Annonces »');
  return ko;
}

(async () => {
  if (!process.argv.includes('--prouve')) {
    const ko = await verifier(RACINE);
    console.log(ko ? `❌ audit-vendeur-generaliste : ${ko} rouge(s)` : '✅ audit-vendeur-generaliste : tout est vert');
    process.exit(ko ? 1 : 0);
  }
  const MUTATIONS = [
    ['src/profilVendeur.js', 'Lunettes retirée des tuiles', "  { v: 'lunettes', titre: 'Lunettes' },", ''],
    ['src/configurationDepart.js', 'question reposée après « Plus tard »', '  return l.choix === \'auto\' && !l.categories && !l.vu;', '  return l.choix === \'auto\' && !l.categories;'],
    ['src/configurationDepart.js', 'question pour un compte qui a choisi', '  return l.choix === \'auto\' && !l.categories && !l.vu;', '  return !l.vu;'],
    ['src/configurationDepart.js', '« Plus tard » pose un choix à sa place', "valeur: { ...brut, choix: 'auto', vu: at } };", "valeur: { ...brut, choix: 'sneakers', vu: at } };"],
    ['src/configurationDepart.js', 'question sur un « pas su »', "  if (typeof proprietaire !== 'boolean') return false;", ''],
    ['src/vocabulaireVendeur.js', 'Julien changé (exemple neutre pour Sneakers)', "  return vend === 'sneakers' ? 'sneakers' : null;", '  return null;'],
    ['src/vocabulaireVendeur.js', 'exemple de chaussure pour les lunettes', "lunettes: { note: 'ex : petite rayure verre gauche'", "lunettes: { note: 'ex : petite tache semelle gauche'"],
    ['src/vocabulaireVendeur.js', 'plusieurs catégories ⇒ la 1re', '  if (cats.length > 1) return null;', '  if (cats.length > 1) return EXEMPLES[cats[0]] ? cats[0] : null;'],
    ['src/configurationDepart.js', 'trois cartes d’affichage', "  { v: 'complet', titre: 'Complet',", "  { v: 'auto', titre: 'Laisser VRM choisir', pourQui: 'x', apercu: 1, puces: [{ ic: 'menu', t: 'a' }, { ic: 'menu', t: 'b' }, { ic: 'menu', t: 'c' }] },\n  { v: 'complet', titre: 'Complet',"],
    ['src/App.jsx', 'note : l’exemple de chaussure remis', 'placeholder: exemplesActuels().note,', "placeholder: 'ex : petite tache semelle gauche',"],
    ['src/App.jsx', 'recherche : « une paire » pour tous', "aria-label={mobile ? 'Rechercher : N°, pseudo, suivi, code, titre' : `Rechercher ${motsArticle(PROFIL_VENDEUR.vend || vendActuel()).un}`}", "aria-label={mobile ? 'Rechercher : N°, pseudo, suivi, code, titre' : 'Rechercher une paire'}"],
    ['src/App.jsx', '« Pointure » pour tous', "placeholder={motTaille(vendActuel())} inputMode=\"decimal\"", 'placeholder="Pointure" inputMode="decimal"'],
    ['src/aTrancher.js', '« sur leurs cartons » remis', "à écrire là où ${pl(n, 'l’article est rangé', 'les articles sont rangés')}`", "à écrire sur ${pl(n, 'son carton', 'leurs cartons')}`"],
    ['src/PreparerColis.jsx', '« vérifie sur son carton » remis', '`Le N°${n} est à vérifier là où l’article est rangé.`', '`Le N°${n} est à vérifier sur son carton.`'],
    ['src/ecrans/Stock.jsx', 'Stock : « Paires » pour tous', '<StatBox label={motsStock.noms.charAt(0).toUpperCase() + motsStock.noms.slice(1)} value={counts.all}/>', '<StatBox label="Paires" value={counts.all}/>'],
    ['src/EmballagesCarte.jsx', '« Boîte à chaussures » pour tous', 'placeholder={exemple} data-emb-champ="nom"', 'placeholder="Boîte à chaussures" data-emb-champ="nom"'],
  ];
  let rates = 0;
  for (const [fichier, nom, avant, apres] of MUTATIONS) {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-dj2-'));
    fs.cpSync(path.join(RACINE, 'src'), path.join(d, 'src'), { recursive: true });
    fs.cpSync(path.join(RACINE, 'api'), path.join(d, 'api'), { recursive: true });
    fs.writeFileSync(path.join(d, 'package.json'), fs.readFileSync(path.join(RACINE, 'package.json')));
    const p = path.join(d, fichier); const brut = fs.readFileSync(p, 'utf8');
    if (!brut.includes(avant)) { console.log(`KO  mutation introuvable : ${nom}`); rates++; fs.rmSync(d, { recursive: true, force: true }); continue; }
    fs.writeFileSync(p, brut.replace(avant, apres));
    const ko = await verifier(d, { muet: true }).catch(() => 1);
    console.log(`${ko ? 'OK  rouge' : 'KO  VERT'} sous mutation : ${nom}${ko ? ` (${ko})` : ''}`);
    if (!ko) rates++;
    fs.rmSync(d, { recursive: true, force: true });
  }
  console.log(rates ? `❌ ${rates} mutation(s) pas attrapée(s)` : `✅ ${MUTATIONS.length}/${MUTATIONS.length} mutations attrapées`);
  process.exit(rates ? 1 : 0);
})();
