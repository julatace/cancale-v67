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
//      dit « paire(s) » est dans la liste FERMÉE ci-dessous, avec sa raison, OU est la
//      forme Sneakers d'une clé À DEUX FORMES (26 nov.) : sa sœur `cle.art` (traductions,
//      choisie par t() hors Sneakers), `cle_art` (textes de l'extension, choisie par T()),
//      `champArt` (« Quoi de neuf ») existe et ne dit pas « paire » ; ou elle est dans
//      une nouveauté `pour: 'sneakers'` (montrée aux seuls vendeurs Sneakers) ;
//   E4 t() EXÉCUTÉ : hors Sneakers, chaque clé à deux formes rend sa forme « article »
//      (sans « paire »), en Sneakers le texte d'avant ; « Quoi de neuf » de même ;
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
  ['src/i18n/langues/fr.js', /^(Tes paires|Paires|Chercher une paire|Aucune paire réglée\.|Aucune paire\.|Allumées · \{n\} paires? réglées?|Le moteur tourne dans l’extension.*Une paire vendue ailleurs n’est jamais acceptée\.)$/, 'Offres auto (lot prix-mini) : la variante Sneakers d’une clé à deux formes (`oa.…` / `oa.….art`), choisie par `tv` (src/OffresAuto.jsx, intégration g1)'],
  ['src/OffresAuto.jsx', /^oa\.paires\./, 'des CLÉS de traduction (`oa.paires.…`), pas des textes : le texte vient de `tv` (variante `.art` hors Sneakers)'],
  ['src/i18n/langues/fr.js', /^(Vérifier la paire : \{n\} jours après réception|Le colis revient : vérifie la paire en l'ouvrant\.|Paire remise au stock avec son N°\.|Paire revenue|Paire revenue · N°\{n\}|Pas la bonne paire \/ abîmée)$/, 'Retours (lot retours-litiges) : la variante Sneakers d’une clé à deux formes (`pap.…` / `pap.….art`), choisie par `tv` (src/RetoursLitiges.jsx, intégration g1)'],
  ['src/i18n/langues/fr.js', /^(La paire|La paire sort du stock \(son N° est gardé\).*|N° pas sûr \(aucune fiche ou plusieurs\) : sors la paire du stock à la main\.)$/, 'remise en main propre (lbc-plus) : variante Sneakers de `lbcplus.remise.*` ; hors Sneakers, `tv` prend la variante `.art` (intégration 11nov-g2)'],
  ['src/i18n/langues/fr.js', /^Comment s’écrivent les numéros de tes prochaines paires\.$/, 'la variante Sneakers d’une clé à deux formes (`reglages.numeros.desc.paires` / `.articles`), choisie par ce qu’il vend'],
  ['src/vocabulaireVendeur.js', null, 'les exemples de Sneakers (lot DJ2) et la liste des mots de chaussure de l’audit'],
  ['vinted-sync-extension/vrm-mots.js', null, 'la copie de la table (formes de Sneakers)'],
  ['src/Bienvenue.jsx', /^(Vinted, Leboncoin, eBay et Vestiaire Collective au même endroit|Un numéro par paire|Chaque paire reçoit)/, 'cartes de Sneakers : `demoBienvenue` les remplace hors Sneakers (audit-vendeurs-differents)'],
  ['src/Accueil.jsx', null, 'page PUBLIQUE vrm.center (aucun vendeur connecté, donc aucun « ce qu’il vend ») ; la démo publique est gardée (lot DJ2)'],
  ['src/ConfigurationDepart.jsx', /dira « paire »/, 'la description du choix « Sneakers » lui-même'],
  ['src/ecrans/Reglages.jsx', /« paires »|Autre paire · taille 41/, 'la description du choix « Sneakers » / l’exemple Sneakers (gardé par `snEx`)'],
  ['src/annulerCommandes.js', /^(Relier un achat à une paire|N° déjà servi|sort la paire du stock|Achats, Compta, Paramètres, Messages, fiche paire)/, 'CONFIRMATIONS : l’inventaire lu par audit-annuler-commandes, jamais affiché'],
  ['src/operations/description.js', /^À plusieurs : tâches, paires/, '`DESCRIPTION_ORGANISATION` gardée pour les audits d’Organisation ; l’app lit `descriptionOrganisation()`'],
  ['api/_lib/vestiaire-regle.js', /^la paire$/, 'repli quand aucun mot n’est passé (serveur seul) ; l’app passe `mots: motsVendeur()` (B10)'],
  ['src/aideFiches.js', /^(Deux paires présentes|deux paires présentes|une autre paire|la bonne paire|Chaque paire|chaque paire|deux paires|Une paire|une paire|La paire|de la paire|la paire|Tes paires|tes paires|les paires|des paires)$/, 'GROUPES_AUTRE (centre d’aide, lot de main) : la colonne Sneakers de sa table de remplacement (audit-centre-aide)'],
  ['src/aideEcrans.js', null, 'rendu par `phraseVendeur` (AideEcran.jsx) : chaque phrase a sa version « article » (B2, B3)'],
  ['src/aideEtapes.js', null, 'généré par scripts/aide-generer.cjs ; rendu par `phraseVendeur` (B2, B3)'],
  ['src/rechercheUnique.js', /^Paires$/, 'GROUPES_LOUPE : l’étiquette « Paires » est remplacée par `motsVendeur().Noms` dans la recherche (App.jsx, B9)'],
  ['api/_lib/agent-ebay-rappel.js', /^aucune paire proposée$/, 'raison de diagnostic du cron (réponse JSON), jamais montrée au vendeur'],
  ['api/_lib/veille-plantages.js', /^Fiche d’une paire$/, 'alerte TECHNIQUE envoyée au seul propriétaire de l’installation (VRM_OWNER_UID)'],
  ['src/reponsesRapides.js', /^vraie paire$/, 'MOT-CLÉ cherché dans le message d’un ACHETEUR (réponses rapides, « est-ce une vraie paire ? ») : jamais affiché'],
  ['vinted-sync-extension/background.js', /^vraie paire$/, 'la même liste de mots-clés des réponses rapides (message d’un ACHETEUR), jamais affichée'],
  ['src/accueil/tempsGagne.js', /^À la main : enregistrer les photos.*Avec VRM : cocher la paire et lancer/, '`GESTES_JOURNAL[].pourquoi` : la JUSTIFICATION écrite d’une durée de référence (§2.3), jamais affichée (`secondesGeste` ne lit que sans/avec)'],
  ['src/recherchePhrase.js', /^le la les l de du des .* paire paires /, 'mots VIDES de la recherche en phrase (retirés de ce qu’il tape), jamais affichés'],
];
// Une ligne gardée par « sneakers » (même ligne) : le texte de Sneakers, l'autre branche dit article.
const GARDE = /seul: 'sneakers'|(?:===|!==) ?'sneakers'|'sneakers' ?(?:===|!==)|\b(?:sn|snEx) \?|vend !== 'sneakers'|\.nom ?=== ?'paire' \?/;
const MOT = /\b[Pp]aires?\b/;

// (26 nov.) LES CLÉS À DEUX FORMES : le nom de la propriété qui porte le texte (en sautant les
// langues et les formes du pluriel) et la sœur qui porte la forme « article ».
const FORMES = new Set(['fr', 'en', 'es', 'it', 'de', 'one', 'other', 'zero', 'two', 'few', 'many']);
const nomCle = (k) => (k && (k.type === 'Identifier' ? k.name : k.type === 'StringLiteral' ? k.value : null));
const SOEURS = (k) => [k + '.art', k + '_art', k + 'Art', ...(/\.sneakers$/.test(k) ? [k.replace(/\.sneakers$/, '.autre')] : [])];   // + les variantes par profil (« nn.notif.sneakers » / « .autre »)
function textesDeNoeud(n) {
  const out = [];
  const w = (x) => { if (!x || typeof x !== 'object') return; if (Array.isArray(x)) { x.forEach(w); return; } if (x.type === 'StringLiteral') out.push(x.value); else if (x.type === 'TemplateElement') out.push(x.value.cooked || ''); for (const k of Object.keys(x)) if (!['loc', 'start', 'end', 'leadingComments', 'trailingComments'].includes(k) && x[k] && typeof x[k] === 'object') w(x[k]); };
  w(n);
  return out;
}
// Rend une raison si le littéral est la forme Sneakers d'une clé à deux formes, ou une nouveauté Sneakers.
function deuxFormes(p) {
  let q = p.parentPath;
  for (let i = 0; q && i < 6; i++, q = q.parentPath) {
    const n = q.node;
    if (n.type !== 'ObjectProperty') continue;
    const k = nomCle(n.key);
    if (!k || FORMES.has(k)) continue;
    const obj = q.parentPath && q.parentPath.node;
    if (!obj || obj.type !== 'ObjectExpression') return null;
    if (obj.properties.some((pr) => pr.type === 'ObjectProperty' && nomCle(pr.key) === 'pour' && pr.value.type === 'StringLiteral' && pr.value.value === 'sneakers')) return 'nouveauté pour Sneakers';
    const soeur = obj.properties.find((pr) => pr.type === 'ObjectProperty' && SOEURS(k).includes(nomCle(pr.key)));
    if (!soeur) return null;
    const t = textesDeNoeud(soeur.value);
    return t.length && !t.some((x) => MOT.test(x)) ? 'deux formes' : null;
  }
  return null;
}
// Le mot VISIBLE : hors commentaires CSS/HTML, et pas collé à un nom de code (« data-atelier-paire », « nav.paires »,
// « [data-espace="paires"] », « p:data->paires »).
const visible = (v) => /(?:^|[^\w\-.:>"=[])[Pp]aires?(?![\w-])/.test(String(v).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/<!--[\s\S]*?-->/g, ' '));
const CLE_CODE = /^[a-z][\w-]*(?:\.[\w-]+)+$/i;   // une clé de traduction (« studio.paires.fermer »)
function textesDe(racine, rel, parse, traverse) {
  const src = lire(racine, rel);
  let ast;
  try { ast = parse(src, { sourceType: 'unambiguous', plugins: ['jsx'], errorRecovery: true }); } catch (e) { return { erreur: e.message, l: [] }; }
  const L = src.split('\n'), out = [];
  const iA = L.findIndex((l) => l.startsWith(MARQUE_A)), iB = L.findIndex((l) => l.startsWith(MARQUE_B));
  const dansCopie = COPIES.includes(rel) && iA >= 0 && iB > iA ? [iA + 1, iB + 1] : null;
  // (26 nov.) Le bloc <gardes-app> de background.js est RECOPIÉ de src/ par scripts/recopier-gardes-extension.cjs
  // (`--verifie` le tient identique) : chacun de ses textes est jugé dans SON fichier de src/.
  const gA = L.findIndex((l) => l.startsWith('// <gardes-app>')), gB = L.findIndex((l) => l.startsWith('// </gardes-app>'));
  const dansGardes = rel === 'vinted-sync-extension/background.js' && gA >= 0 && gB > gA ? [gA + 1, gB + 1] : null;
  traverse(ast, {
    'StringLiteral|JSXText|TemplateElement'(p) {
      const n = p.node, v = n.type === 'TemplateElement' ? n.value.cooked : n.value;
      if (!v || !MOT.test(v) || !visible(v)) return;
      if (CLE_CODE.test(v.trim())) return;
      const par = p.parent;
      // une valeur posée dans un attribut de code (data-*, className, key, id), même dans une expression
      for (let q = p.parentPath, i = 0; q && i < 4; q = q.parentPath, i++) if (q.node.type === 'JSXAttribute' && q.node.name && /^(className|data-|key$|id$)/.test(q.node.name.name)) return;
      if (n.type === 'StringLiteral') {
        if ((par.type === 'ObjectProperty' || par.type === 'ObjectMethod') && par.key === n) return;
        if (par.type === 'ImportDeclaration' || par.type === 'ExportNamedDeclaration') return;
        if (par.type === 'BinaryExpression' && /[=!]==?/.test(par.operator)) return;
        if (par.type === 'SwitchCase') return;
        // Le REPLI d'une page de l'extension si vrm-mots.js manquait (B7 l'exige avant chaque page) :
        // seulement le littéral à DROITE d'un `||` dont la gauche lit VRM_MOTS (le texte d'avant).
        if (par.type === 'LogicalExpression' && par.operator === '||' && par.right === n && /VRM_MOTS/.test(src.slice(par.left.start, par.left.end))) return;
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
      if (dansGardes && ligne > dansGardes[0] && ligne < dansGardes[1]) return;   // recopié de src/ (jugé là-bas)
      out.push({ rel, ligne, v: v.replace(/\s+/g, ' ').trim(), code: L[ligne - 1] || '', deux: deuxFormes(p) });
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

  // ── E4 (26 nov.) : t() EXÉCUTÉ sur les clés à deux formes, dans les cinq langues ──
  try {
    const I = await imp(racine, 'src/i18n/index.js');
    const FR = (await imp(racine, 'src/i18n/langues/fr.js')).default;
    I.ajouterSourceApp(FR);
    const bases = Object.keys(FR).filter((k) => /\.art$/.test(k) && FR[k.slice(0, -4)] != null).map((k) => k.slice(0, -4));
    const PAIR = { fr: MOT, en: /\bpairs?\b/i, es: /\bpar(?:es)?\b/i, it: /\bpai[oa]\b/i, de: /\bPaar(?:e|en|s|es)?\b/ };
    const rendre = (k) => [I.t(k, { n: 1 }), I.t(k, { n: 2 })];
    const disent = [], changes = [], absentes = [];
    for (const l of ['fr', 'en', 'es', 'it', 'de']) {
      if (!(await I.appliquerLangue(l))) { absentes.push(l); continue; }
      I.poserVarianteArticle(null);
      const avant = Object.fromEntries(bases.map((k) => [k, JSON.stringify(rendre(k))]));
      I.poserVarianteArticle(() => false);
      for (const k of bases) if (JSON.stringify(rendre(k)) !== avant[k]) changes.push(`${l}:${k}`);
      I.poserVarianteArticle(() => true);
      for (const k of bases) if (rendre(k).some((x) => PAIR[l].test(x) || x === k)) disent.push(`${l}:${k} → ${rendre(k)[1]}`);
    }
    I.poserVarianteArticle(null); await I.appliquerLangue('fr');
    dit(bases.length >= 130 && !absentes.length && !disent.length, `E4 t() hors Sneakers : les ${bases.length} clés à deux formes rendent leur forme « article », dans les cinq langues`, { absentes, disent: disent.slice(0, 20) });
    dit(!changes.length, 'E5 t() en Sneakers (ou sans source) : chaque clé rend EXACTEMENT son texte d’avant', changes.slice(0, 20));
  } catch (e) { dit(false, 'E4 src/i18n/index.js et fr.js se chargent', e.message); }
  // « Quoi de neuf » : hors Sneakers, aucune nouveauté montrée ne dit « paire » ; Sneakers mot pour mot.
  try {
    const N = await imp(racine, 'src/nouveautes.js');
    const ctx = { inscritLe: '2020-01-01', mode: 'complet', proprietaire: true, pro: true };
    const aut = N.nouveautesDuCompte({ ...ctx, vend: 'autre', categories: ['vetements'] });
    const sn = N.nouveautesDuCompte({ ...ctx, vend: 'sneakers', categories: ['sneakers'] });
    const disent = aut.filter((n) => MOT.test(n.titre) || MOT.test(n.phrase)).map((n) => n.id);
    const brut = new Map(N.NOUVEAUTES.map((n) => [n.id, n]));
    const changes = sn.filter((n) => n.titre !== brut.get(n.id).titre || n.phrase !== brut.get(n.id).phrase).map((n) => n.id);
    dit(aut.length > 100 && !disent.length && !changes.length, `E6 « Quoi de neuf » : hors Sneakers, aucune des ${aut.length} nouveautés ne dit « paire » ; Sneakers mot pour mot`, { disent, changes });
  } catch (e) { dit(false, 'E6 src/nouveautes.js se charge', e.message); }

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
  let nTextes = 0, nPermis = 0, nGardes = 0, nDeux = 0;
  for (const rel of fichiersDe(racine)) {
    const { l, erreur } = textesDe(racine, rel, parse, traverse);
    if (erreur) { erreurs.push(`${rel} : ${erreur}`); continue; }
    for (const t of l) {
      nTextes++;
      if (PERMIS.some(([fi, re]) => fi === rel && (!re || re.test(t.v)))) { nPermis++; continue; }
      if (GARDE.test(t.code)) { nGardes++; continue; }
      if (t.deux) { nDeux++; continue; }
      hors.push(`${rel}:${t.ligne} ${t.v.slice(0, 110)}`);
    }
  }
  dit(!erreurs.length, 'S0 chaque fichier se lit', erreurs);
  if (process.env.VOCAB_TOUT) console.log(hors.join("\n"));
  dit(!hors.length, `S1 aucun texte ne dit « paire(s) » hors Sneakers (${nPermis} permis, ${nGardes} gardés par « sneakers », ${nDeux} à deux formes)`, hors);

  // ── B : le branchement ──
  // (24 nov., main-vert) App.jsx découpé (src/ecrans/*.jsx) : l'app se lit RECOLLÉE (_source-app.cjs).
  const app = require('./_source-app.cjs').sourceApp(racine);
  dit(/poserSourceVend\(\(\) => vendActuel\(\)\);/.test(app), 'B1 l’app pose la source du vocabulaire (`poserSourceVend(() => vendActuel())`)');
  dit(/poserVarianteArticle\(\(\) => vendCourant\(\) !== 'sneakers'\);/.test(app), 'B11 l’app pose la source des clés à deux formes (`poserVarianteArticle(() => vendCourant() !== \'sneakers\')`)');
  {
    const ui = lire(racine, 'vinted-sync-extension/vrm-ui.js'), dep = lire(racine, 'vinted-sync-extension/vrm-depot.js');
    dit(/const m = \(MOTS\[cle \+ '_art'\] && horsSneakers\(\) \? MOTS\[cle \+ '_art'\] : null\) \|\| MOTS\[cle\];/.test(ui) && /VRM_MOTS\.vend\(\) !== 'sneakers'/.test(ui)
      && /const m = \(hors && MOTS\[cle \+ '_art'\]\) \|\| MOTS\[cle\];/.test(dep), 'B12 extension : T() (vrm-ui.js, vrm-depot.js) prend `cle_art` hors Sneakers (`VRM_MOTS.vend()`)');
  }
  const aide = lire(racine, 'src/composants/AideEcran.jsx');
  dit(/phraseVendeur\(e, vend\)/.test(aide) && /phraseVendeur\(qq, vend\)/.test(aide) && /phraseVendeur\(r, vend\)/.test(aide), 'B2 l’aide du « ? » (étapes, questions, réponses) passe par `phraseVendeur`');
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
  dit(/await rafraichirVendExt\(main\.vrm_je_vends, owner\);/.test(fond) && /'vrm_numero_ecrit', 'vrm_je_vends'(?:, '\w+')*\]/.test(fond)   /* (16 nov.) la lecture de `main` a d'autres clés à la suite (liste de recherche, achetées) */ && /function fullSync\(\) \{ vendExtAJour\(\);/.test(fond), 'B8 fond : `vrm_je_vends` relu avec les infos de page et à chaque synchronisation (au plus toutes les 6 h)');
  // (16 nov.) Depuis le 15 nov. les groupes suivent l'ordre de la requête et passent par `libGroupe` (stock, retours) : « paire » ⇒ le mot du vendeur.
  dit(/const GROUPES = GROUPES_LOUPE\.map\(\(\[t, l\]\) => \[t, t === 'paire' \? motsVendeur\(\)\.Noms : l\]\);/.test(app) || (/const libGroupe = \(t, l\) => \(t === 'paire' \? motsVendeur\(\)\.Noms : /.test(app) && /\.map\(\(\[t, l\]\) => \[t, libGroupe\(t, l\)\]\);/.test(app)), 'B9 la recherche : le groupe « Paires » s’appelle « Articles » hors Sneakers');
  dit(/const rv = retraitsVestiaire\(\{.*, mots: motsVendeur\(\) \}\);/.test(app), 'B10 Ma journée (Vestiaire) passe le mot du vendeur à `retraitsVestiaire`');
  if (arbreAvant) try { fs.rmSync(arbreAvant, { recursive: true, force: true }); } catch (_) {}
  return ko;
}

const MUTATIONS = [
  ['src/profilVendeur.js', 'la forme « article » redit paire', "Ce: 'Cet article',", "Ce: 'Cette paire',"],
  ['src/profilVendeur.js', 'sans source ⇒ article (Sneakers changé)', "const v = sourceVend ? sourceVend() : 'sneakers';", "const v = sourceVend ? sourceVend() : 'autre';"],
  ['src/App.jsx', 'la source n’est plus posée', 'poserSourceVend(() => vendActuel());', ''],
  ['src/ecrans/Comptabilite.jsx', 'un texte remis en « paire »', '`${motsVendeur().Aucune} à baisser`', "'Aucune paire à baisser'"],
  ['src/ecrans/Comptabilite.jsx', 'un texte remis en « paire » (JSX)', '>Régler par {motsVendeur().nom}, voir l’historique ›</button>', '>Régler par paire, voir l’historique ›</button>'],
  ['src/aTrancher.js', 'une règle pure remise en « paire »', "get 'numeros-double'() { return `N° portés par deux ${motsVendeur().noms}`; },", "'numeros-double': 'N° portés par deux paires',"],
  ['src/composants/AideEcran.jsx', 'l’aide ne passe plus par phraseVendeur', 'pourVendeur(phraseVendeur(r, vend), vend)', 'pourVendeur(r, vend)'],
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
  // (26 nov.) les clés à deux formes
  ['src/i18n/index.js', 't() ignore la forme « article »', '  let e = variante(cle);\n', '  let e = null;\n'],
  ['src/App.jsx', 'la source des clés à deux formes n’est plus posée', "poserVarianteArticle(() => vendCourant() !== 'sneakers');\n", ''],
  ['src/i18n/langues/fr/deuxComptes.js', 'une forme « article » retirée', '  "deuxComptes.titre.art": "Deux comptes, un article",\n', ''],
  ['src/i18n/langues/fr/deuxComptes.js', 'une forme « article » qui redit paire', '"deuxComptes.titre.art": "Deux comptes, un article"', '"deuxComptes.titre.art": "Deux comptes, une paire"'],
  ['src/i18n/langues/en/deuxComptes.js', 'une forme « article » anglaise qui redit pair', '"deuxComptes.titre.art": "Two accounts, one item"', '"deuxComptes.titre.art": "Two accounts, one pair"'],
  ['src/nouveautes.js', '« Quoi de neuf » ignore la version article', '.map((n) => pourSonMot(n, ctx.vend));', ';'],
  ['src/nouveautes.js', 'une nouveauté sans sa version article', ", titreArt: 'Comparer deux articles côte à côte'", ''],
  ['vinted-sync-extension/vrm-ui.js', 'T() de l’extension ignore `cle_art`', "const m = (MOTS[cle + '_art'] && horsSneakers() ? MOTS[cle + '_art'] : null) || MOTS[cle];", 'const m = MOTS[cle];'],
  ['vinted-sync-extension/vrm-ui.js', 'un texte de l’extension sans forme article', '    rp_rien_art: {', '    rp_rien_x: {'],
  ['vinted-sync-extension/background.js', 'un texte du fond remis en paire', "get 'repub-serie'() { return `Compte précieux : pas de republication en série — ${motsExt().un} à la fois, sur ton toucher.`; },", "'repub-serie': 'Compte précieux : pas de republication en série — une paire à la fois, sur ton toucher.',"],
  ['api/_lib/retraits-retard-notif.js', 'une notification serveur remise en paire', "`⚠️ ${m.Un} vendu${m.e} encore en ligne`", "'⚠️ Une paire vendue encore en ligne'"],
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
  // `VOCAB_MUT=<regex>` : seulement les mutations dont le nom correspond (relancer celles qu'on vient d'écrire).
  const choisies = process.env.VOCAB_MUT ? MUTATIONS.filter(([, quoi]) => new RegExp(process.env.VOCAB_MUT).test(quoi)) : MUTATIONS;
  for (const [f, quoi, de, vers] of choisies) {
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
  console.log(`${attrapees}/${choisies.length} mutations attrapées`);
  process.exit(attrapees === choisies.length ? 0 : 1);
})();
