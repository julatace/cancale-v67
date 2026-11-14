// ════════════════════════════════════════════════════════════════════════════
// AUDIT DE LA TRADUCTION (11 nov., lot traduction — décision de Julien : VRM en
// français, anglais, espagnol, italien, allemand). Lecture seule.
//
//  D. Les dictionnaires (src/i18n/langues/*.js) :
//     D1 les cinq existent et se chargent ; D2 chaque clé du français existe dans
//     les quatre autres, et aucune clé en trop ; D3 même forme (texte ou pluriel) ;
//     D4 un pluriel porte `one` ET `other` ; D5 les mêmes variables `{x}` partout
//     (chaque forme d'un pluriel comprise) ; D6 aucune valeur vide ; D7 longueur
//     raisonnable (≤ 160 % du français + 12 caractères ; l'allemand déborde le premier) ;
//     D8 les libellés de la barre du bas restent courts (≤ 12) ; D9 la phrase des
//     offres en français est CELLE du serveur (OFFRES, api/_lib/plan-regle.js).
//  C. Le code : C1 chaque `tr('…')` / `t('…')` écrit en clair existe en français ;
//     C2 chaque entrée de navigation (`entreeNav`, `groupeNav`) a sa clé ;
//     C3 les moments de l'accueil ont leurs cinq clés.
//  F. Pas de texte français codé en dur dans les écrans DÉJÀ migrés (liste
//     MIGRES ci-dessous, fonction par fonction) : texte JSX, attributs lus
//     (placeholder, aria-label, title, alt, label) et phrases passées à
//     setErr/setInfo/toast. Un écran migré qui regagne une phrase en dur rougit.
//  R. La règle à l'exécution (src/i18n/index.js) : repli sur le français, pluriels,
//     variables, formats Intl, langue du navigateur.
//
//  `--prouve` : chaque mutation doit rendre l'audit ROUGE.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
let parser, traverse;
try { parser = require(path.join(__dirname, '..', 'node_modules', '@babel', 'parser')); } catch (_) { parser = require('@babel/parser'); }
const R = process.env.TRAD_RACINE || path.join(__dirname, '..');
const LANGUES = ['fr', 'en', 'es', 'it', 'de'];

// Les écrans migrés : [fichier, fonctions (ou constantes) dont le texte passe par tr()].
// `*` = tout le fichier. Ajouter ici chaque écran migré (méthode : docs/passation/2026-11-11-traduction.md).
const MIGRES = [
  ['src/Accueil.jsx', ['*']],
  ['src/accueil/TempsGagne.jsx', ['*']],
  ['src/RetoursLitiges.jsx', ['*']],
  ['src/profil/MenuProfil.jsx', ['*']],
  ['src/composants/GardeEcran.jsx', ['*']],
  ['src/i18n/ChoixLangue.jsx', ['*']],
  ['src/PublierPartout.jsx', ['*']],
  ['src/main.jsx', ['DernierFilet']],
  ['src/App.jsx', ['AuthScreen', 'CaptchaConnexion', 'LiensLegaux', 'titreEcran', 'SideBar']],
  ['src/ecrans/Reglages.jsx', ['LangueSetting', 'SettingsScreen:groupes', 'ImpressionBordereaux', 'nomPapier']],
  // (11 nov., lot vestiaire-plus) Vestiaire : le parcours, les photos exigées, la baisse de prix, les offres.
  ['src/ParcoursVestiaire.jsx', ['*']],
  ['src/PhotosVestiaire.jsx', ['*']],
  ['src/BaissePrixVestiaire.jsx', ['*']],
  ['src/OffresVestiaire.jsx', ['*']],
  ['src/composants/SuiviTravail.jsx', ['*']],   // (11 nov., lot suivi-travail)
  ['src/MainsLibres.jsx', ['*']],   // (14 nov., lot colis-plus 100) mains libres
  ['src/TempsColis.jsx', ['*']],    // (14 nov., lot colis-plus 101) le temps par colis
  ['src/TvaMargeCarte.jsx', ['*']],
  ['src/RangerAchat.jsx', ['*']],   // (11 nov., lot rangement-guide)
  ['src/FavorisEtapes.jsx', ['*']],   // (11 nov., lot favoris-clair)
  ['src/FavorisSansVente.jsx', ['*']],   // (13 nov., lot 31) très aimées, pas vendues
  // (11 nov., lot prix-mini) Offres auto refait, et « Prix mini manquants ».
  ['src/OffresAuto.jsx', ['*']],
  ['src/PrixMiniManquants.jsx', ['*']],
  ['src/design/QuoiRepublier.jsx', ['*']],   // (11 nov., lot quoi-republier)
  // (14 nov., lot argent-choix) coller des prix, modèle et taille, déclaration annuelle.
  ['src/composants/CollerPrixAchat.jsx', ['*']],
  ['src/design/QuoiRacheter.jsx', ['*']],
  ['src/composants/DeclarationAnnuelle.jsx', ['*']],
  ['src/RepubProgramme.jsx', ['*']],   // (11 nov., lot republier-programme)
  ['src/HistoriqueRepub.jsx', ['*']],
  ['src/ecrans/Achats.jsx', ['*']],
  ['src/ecrans/PrixMarche.jsx', ['*']],
  ['src/CadreEmail.jsx', ['*']],
  ['src/EspaceEmails.jsx', ['*']],
  ['src/JournalEmails.jsx', ['*']],
  ['src/ReceptionEmails.jsx', ['*']],
  ['src/RecusEmail.jsx', ['*']],
  ['src/ActionsClaires.jsx', ['*']],
  ['src/composants/ChampRecherche.jsx', ['*']],
  ['src/LitigesEnCours.jsx', ['*']],
  ['src/LigneFraicheur.jsx', ['*']],
];
// Ce qui n'est PAS du texte à traduire (noms propres, marques, données, symboles).
const PROPRES = /\b(?:VRM|Google|Discord|Vinted|Leboncoin|eBay|Vestiaire Collective|Scriptable|URSSAF|PDF|SIRET|SIREN|DAC7|ACRE|CFE)\b/g;
const PERMIS = [/^[A-Z]{2}$/, /^[\s·—–…→←›✓✕×©+\-:;,.()0-9€%/]*$/];

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${!c && d !== undefined ? '  → ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 900) : ''}`); };
const lire = (p) => fs.readFileSync(path.join(R, p), 'utf8');
const vars = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const formes = (v) => (v && typeof v === 'object' ? Object.values(v) : [v]);

async function principal() {
  // ── D. les dictionnaires ──
  console.log('── D. les dictionnaires (src/i18n/langues/)');
  const D = {};
  for (const l of LANGUES) {
    // Deux parties par langue : `<l>-accueil.js` (dans le fichier d'entrée) et `<l>.js` (avec l'app).
    try {
      const imp = async (n) => (await import(pathToFileURL(path.join(R, 'src', 'i18n', 'langues', n)).href + '?v=' + Math.random())).default;
      const a = await imp(`${l}-accueil.js`), b = await imp(`${l}.js`);
      const deuxFois = Object.keys(a).filter((k) => k in b);
      if (deuxFois.length) dit(false, `D0 ${l} : une clé vit dans un seul des deux fichiers`, deuxFois);
      D[l] = { ...a, ...b };
    } catch (e) { D[l] = null; dit(false, `D1 ${l}.js et ${l}-accueil.js se chargent`, e.message); }
  }
  // Les clés publiques (lues par la page d'accueil AVANT l'app) sont dans la partie publique.
  try {
    const acc = lire('src/Accueil.jsx') + lire('src/accueil/TempsGagne.jsx') + lire('src/main.jsx') + lire('src/i18n/ChoixLangue.jsx');
    const pub = (await import(pathToFileURL(path.join(R, 'src', 'i18n', 'langues', 'fr-accueil.js')).href + '?v=' + Math.random())).default;
    const hors = [...new Set([...acc.matchAll(/\btr\(\s*'([a-z][\w-]*(?:\.[\w-]+)+)'/g)].map((m) => m[1]))].filter((k) => !(k in pub));
    dit(!hors.length, 'D0 chaque clé de l’accueil, du démarrage et du sélecteur est dans fr-accueil.js (sinon : la clé brute avant l’app)', hors);
  } catch (e) { dit(false, 'D0 fr-accueil.js se lit', e.message); }
  const fr = D.fr || {};
  const cles = Object.keys(fr);
  dit(cles.length > 100 && LANGUES.every((l) => D[l] && typeof D[l] === 'object'), `D1 les cinq dictionnaires se chargent (${cles.length} clés en français)`);
  for (const l of LANGUES.slice(1)) {
    const d = D[l] || {};
    const manque = cles.filter((k) => !(k in d)), trop = Object.keys(d).filter((k) => !(k in fr));
    dit(!manque.length && !trop.length, `D2 ${l} : toutes les clés du français, aucune en trop`, { manque: manque.slice(0, 25), nManque: manque.length, trop: trop.slice(0, 10) });
    const forme = cles.filter((k) => k in d && (typeof fr[k] === 'object') !== (typeof d[k] === 'object'));
    dit(!forme.length, `D3 ${l} : même forme que le français (texte ou pluriel)`, forme);
    const varsKo = cles.filter((k) => k in d && formes(d[k]).some((x) => vars(x) !== vars(typeof fr[k] === 'object' ? fr[k].other : fr[k])));
    dit(!varsKo.length, `D5 ${l} : les mêmes variables {x} que le français`, varsKo.map((k) => `${k} fr[${vars(typeof fr[k] === 'object' ? fr[k].other : fr[k])}] ${l}[${formes(d[k]).map(vars).join('|')}]`));
    const vides = cles.filter((k) => k in d && formes(d[k]).some((x) => typeof x !== 'string' || (!x.trim() && formes(fr[k]).some((y) => String(y).trim()))));
    dit(!vides.length, `D6 ${l} : aucune valeur vide`, vides);
    const longs = cles.filter((k) => k in d).filter((k) => { const a = formes(fr[k]).map((x) => String(x).length), b = formes(d[k]).map((x) => String(x).length); if (formes(fr[k]).every((x) => /^[A-Z]{2,4}$/.test(String(x)))) return Math.max(...b) > 24;   // une abréviation française (CGV, CGU) se déplie ailleurs
      return Math.max(...b) > Math.max(...a) * 1.6 + 12; });
    dit(!longs.length, `D7 ${l} : longueur raisonnable (≤ 160 % du français + 12)`, longs.map((k) => `${k} (${String(formes(fr[k])[0]).length} → ${String(formes(d[k])[0]).length})`));
    const barre = Object.keys(fr).filter((k) => /^nav\.(journee\.court|annonces|ventes|cat_bord|plus)$/.test(k)).filter((k) => String(d[k] || '').length > 12);
    dit(!barre.length, `D8 ${l} : les libellés de la barre du bas tiennent (≤ 12 caractères)`, barre.map((k) => `${k} « ${d[k]} »`));
  }
  const plurielsKo = LANGUES.flatMap((l) => Object.entries(D[l] || {}).filter(([, v]) => v && typeof v === 'object' && (typeof v.one !== 'string' || typeof v.other !== 'string')).map(([k]) => `${l}:${k}`));
  dit(!plurielsKo.length, 'D4 chaque pluriel porte `one` et `other`', plurielsKo);
  const vidFr = cles.filter((k) => formes(fr[k]).some((x) => typeof x !== 'string' || !x.length));
  dit(!vidFr.length, 'D6 fr : aucune valeur vide', vidFr);
  try {
    const P = await import(pathToFileURL(path.join(R, 'api', '_lib', 'plan-regle.js')).href);
    dit(fr['accueil.offre.solo.phrase'] === P.OFFRES.solo.phrase && fr['accueil.offre.pro.phrase'] === P.OFFRES.pro.phrase,
      'D9 la phrase des offres en français est celle du serveur (OFFRES) : la copie ne peut pas diverger');
  } catch (e) { dit(false, 'D9 OFFRES se lit', e.message); }

  // D10 (11 nov., lot 2) Les phrases d'écran : le français du dictionnaire est CELUI de src/phrasesEcran.js
  // (le banc et l'audit des phrases jugent ce fichier) — une copie qui diverge rougit.
  try {
    const PE = await import(pathToFileURL(path.join(R, 'src', 'phrasesEcran.js')).href + '?v=' + Math.random());
    const attendu = { ...Object.fromEntries(Object.entries(PE.PHRASES_ECRAN).map(([k, v]) => ['phrase.' + k, v])), ...Object.fromEntries(Object.entries(PE.PHRASES_ECRAN_ARTICLES).map(([k, v]) => ['phrase.' + k + '.articles', v])) };
    // (13 nov., intégration) Depuis la fusion avec main, la phrase d'écran n'est plus copiée dans le dictionnaire
    // (PhraseEcran de main la tire de phrasesEcran.js, mots du vendeur compris) : la copie de la branche était morte
    // et retirée. La règle tient pour toute copie qui reviendrait : une clé `phrase.*` présente doit valoir la phrase.
    const presentes = Object.keys(fr).some((k) => /^phrase\./.test(k));
    const ecarts = (presentes ? Object.keys(attendu).filter((k) => fr[k] !== attendu[k]) : []).concat(Object.keys(fr).filter((k) => /^phrase\./.test(k) && !(k in attendu)));
    dit(!ecarts.length, `D10 les ${Object.keys(attendu).length} phrases d'écran en français sont celles de src/phrasesEcran.js`, ecarts);
  } catch (e) { dit(false, 'D10 src/phrasesEcran.js se lit', e.message); }

  // ── C. le code ──
  console.log('\n── C. les clés écrites dans le code');
  const fichiers = [];
  (function w(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) { if (f.name !== 'langues') w(p); } else if (/\.(jsx?|mjs)$/.test(f.name)) fichiers.push(p); } })(path.join(R, 'src'));
  const absentes = [];
  let nAppels = 0;
  for (const f of fichiers) {
    const src = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
    if (!/from ['"][./]*(?:\.\.\/)*i18n\/index\.js['"]|from ['"]\.\/index\.js['"]/.test(src) && !/i18n[\\/]index\.js$/.test(f)) continue;
    for (const m of src.matchAll(/\b(?:trj|tr|t)\(\s*'([a-z][\w-]*(?:\.[\w-]+)+)'/g)) { nAppels++; if (!(m[1] in fr)) absentes.push(`${path.relative(R, f)} : ${m[1]}`); }
    // tr(cond ? 'a' : 'b') : les deux branches
    for (const m of src.matchAll(/\btr\(\s*[^'()]*?\?\s*'([a-z][\w-]*(?:\.[\w-]+)+)'\s*:\s*'([a-z][\w-]*(?:\.[\w-]+)+)'/g)) for (const k of [m[1], m[2]]) { nAppels++; if (!(k in fr)) absentes.push(`${path.relative(R, f)} : ${k}`); }
  }
  dit(nAppels > 300 && !absentes.length, `C1 chaque clé écrite en clair existe en français (${nAppels} appels)`, absentes);
  const app = lire('src/App.jsx');
  const idsNav = [...app.matchAll(/entreeNav\(\{(?:\.\.\.\w+,\s*)?id:'(\w+)'/g)].map((m) => m[1]);
  const groupes = [...app.matchAll(/groupeNav\(\{ cle:'(\w+)'/g)].map((m) => m[1]);
  const navKo = [...idsNav.map((i) => `nav.${i}`), 'nav.journee.court', ...groupes.map((g) => `nav.groupe.${g}`)].filter((k) => !(k in fr));
  // (11 nov., lot DJ3 intégré) l'entrée Colis a quitté la navigation (Ventes · À expédier, Achats · À retirer) : 9 entrées.
  dit(idsNav.length >= 9 && groupes.length >= 3 && !navKo.length, `C2 chaque entrée de navigation a sa clé (${idsNav.length} entrées, ${groupes.length} groupes)`, navKo);
  const acc = lire('src/Accueil.jsx');
  const moments = [...acc.matchAll(/\{ id: '(\w+)', capture: '\w+' \}/g)].map((m) => m[1]);
  const momKo = moments.flatMap((id) => ['titre', 'texte', 'alt', 'point1', 'point2'].map((c) => `accueil.moment.${id}.${c}`)).filter((k) => !(k in fr));
  dit(moments.length >= 4 && !momKo.length, `C3 les ${moments.length} moments de l'accueil ont leurs cinq clés`, momKo);

  // ── F. pas de français en dur dans les écrans migrés ──
  console.log('\n── F. aucun texte en dur dans les écrans migrés');
  const ATTR = new Set(['placeholder', 'aria-label', 'title', 'alt', 'label', 'titre']);
  const APPELS = new Set(['setErr', 'setInfo', 'toast', 'setLierFournisseurMot']);
  const estTexte = (s) => { const v = String(s).replace(PROPRES, '').replace(/\s+/g, ' ').trim(); return /[A-Za-zÀ-ÿ]{2,}/.test(v) && !PERMIS.some((re) => re.test(v)); };
  const durs = [];
  for (const [rel, quoi] of MIGRES) {
    let src; try { src = lire(rel); } catch (_) { durs.push(`${rel} absent`); continue; }
    const ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx'] });
    const zones = [];
    const tout = quoi.includes('*');
    // Les zones : les fonctions (ou classes, constantes) nommées ; `X:groupes` = les listes GROUPES_* de X.
    const visiter = (n, f) => { if (!n || typeof n !== 'object') return; if (Array.isArray(n)) { n.forEach((x) => visiter(x, f)); return; } if (typeof n.type === 'string') f(n); for (const k of Object.keys(n)) if (k !== 'loc' && k !== 'start' && k !== 'end' && n[k] && typeof n[k] === 'object') visiter(n[k], f); };
    if (tout) zones.push(ast.program);
    else visiter(ast.program, (n) => {
      const nom = (n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') && n.id ? n.id.name : n.type === 'VariableDeclarator' && n.id && n.id.name ? n.id.name : null;
      if (!nom) return;
      if (quoi.includes(nom)) zones.push(n);
      for (const q of quoi) { const [fn, sous] = q.split(':'); if (sous === 'groupes' && fn === nom) visiter(n, (m) => { if (m.type === 'VariableDeclarator' && m.id && /^GROUPES_/.test(m.id.name || '')) zones.push(m.init); }); }
    });
    if (!zones.length) durs.push(`${rel} : aucune zone ${quoi.join(',')} trouvée`);
    for (const z of zones) visiter(z, (n) => {
      const ligne = n.loc ? n.loc.start.line : 0;
      if (n.type === 'JSXText' && estTexte(n.value)) durs.push(`${rel}:${ligne} texte « ${n.value.trim().slice(0, 60)} »`);
      if (n.type === 'JSXAttribute' && n.name && ATTR.has(n.name.name) && n.value && n.value.type === 'StringLiteral' && estTexte(n.value.value)) durs.push(`${rel}:${ligne} ${n.name.name}="${n.value.value.slice(0, 60)}"`);
      if (n.type === 'ObjectProperty' && n.key && ['lib', 'desc', 'titre', 'pied', 'val'].includes(n.key.name) && n.value && (n.value.type === 'StringLiteral' || n.value.type === 'TemplateLiteral')) {
        const v = n.value.type === 'StringLiteral' ? n.value.value : n.value.quasis.map((q) => q.value.cooked).join('');
        if (estTexte(v)) durs.push(`${rel}:${ligne} ${n.key.name}:'${v.slice(0, 60)}'`);
      }
      // Une phrase passée en argument (« ligne('deconnexion','door','Se déconnecter',…) ») : majuscule et espace.
      if (n.type === 'CallExpression') for (const a of n.arguments || []) if (a.type === 'StringLiteral' && /^[A-ZÀ-Ü]/.test(a.value) && /\s/.test(a.value) && estTexte(a.value)) durs.push(`${rel}:${ligne} argument '${a.value.slice(0, 60)}'`);
      if (n.type === 'CallExpression' && n.callee && APPELS.has(n.callee.name) && n.arguments[0] && (n.arguments[0].type === 'StringLiteral' || n.arguments[0].type === 'TemplateLiteral')) {
        const a = n.arguments[0]; const v = a.type === 'StringLiteral' ? a.value : a.quasis.map((q) => q.value.cooked).join('');
        if (estTexte(v)) durs.push(`${rel}:${ligne} ${n.callee.name}('${v.slice(0, 60)}')`);
      }
      // Un texte rendu par une expression JSX enfant : {'…'} ou {cond ? '…' : '…'} (jamais dans <style>).
      if (n.type === 'JSXElement' && !(n.openingElement.name && n.openingElement.name.name === 'style')) for (const c of n.children || []) {
        if (c.type !== 'JSXExpressionContainer') continue;
        const lits = [];
        const prendre = (x) => { if (!x) return; if (x.type === 'StringLiteral') lits.push(x.value); else if (x.type === 'ConditionalExpression') { prendre(x.consequent); prendre(x.alternate); } else if (x.type === 'LogicalExpression') prendre(x.right); else if (x.type === 'TemplateLiteral') lits.push(x.quasis.map((q) => q.value.cooked).join('')); };
        prendre(c.expression);
        for (const v of lits) if (estTexte(v) && !/^[\w-]+$/.test(v)) durs.push(`${rel}:${c.loc ? c.loc.start.line : 0} {'${v.slice(0, 60)}'}`);
      }
    });
  }
  dit(!durs.length, `F1 aucun texte français en dur dans les ${MIGRES.length} fichiers migrés`, durs.slice(0, 30).join('\n   ') + (durs.length > 30 ? `\n   … et ${durs.length - 30} autres` : ''));

  // ── R. la règle ──
  console.log('\n── R. la règle (src/i18n/index.js)');
  try {
    const store = {};
    global.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
    const I = await import(pathToFileURL(path.join(R, 'src', 'i18n', 'index.js')).href + '?v=' + Math.random());
    // Comme App.jsx à son chargement : la partie « app » du français rejoint la source.
    I.ajouterSourceApp((await import(pathToFileURL(path.join(R, 'src', 'i18n', 'langues', 'fr.js')).href)).default);
    dit(I.t('nav.ventes') === fr['nav.ventes'] && I.t('cle.qui.nexiste.pas') === 'cle.qui.nexiste.pas', 'R1 français par défaut ; une clé inconnue rend la clé (jamais un blanc)');
    dit(I.langueDuNavigateur({ languages: ['de-AT', 'en'] }) === 'de' && I.langueDuNavigateur({ languages: ['pt-BR'], language: 'pt-BR' }) === 'fr' && I.langueDuNavigateur({ languages: ['nl', 'it-CH'] }) === 'it', 'R2 langue du navigateur parmi les cinq (de-AT ⇒ de), sinon fr');
    store.vrm_langue = '"es"';
    dit(I.langueInitiale() === 'es', 'R3 le choix rangé (`vrm_langue`, JSON) passe avant le navigateur');
    store.vrm_langue = '"xx"';
    dit(I.langueInitiale() === I.langueDuNavigateur(), 'R4 une valeur rangée inconnue est ignorée');
    const ok1 = await I.appliquerLangue('de');
    dit(ok1 && I.langueCourante() === 'de' && I.t('nav.ventes') === D.de['nav.ventes'], 'R5 une langue chargée à la demande remplace le texte');
    dit(I.t('reglages.recherche.trouves', { n: 1 }) === D.de['reglages.recherche.trouves'].one.replace('{n}', '1') && I.t('reglages.recherche.trouves', { n: 3 }) === D.de['reglages.recherche.trouves'].other.replace('{n}', '3'), 'R6 pluriel par Intl.PluralRules (1 ⇒ one, 3 ⇒ other)');
    dit(/1\.234,5/.test(I.nombre(1234.5)) && /€/.test(I.monnaie(12.4)) && I.monnaie(null) === '—', 'R7 formats dans la langue (de : 1.234,5) ; un montant inconnu ⇒ « — », jamais 0');
    const dDe = await I.chargerLangue('de'); const garde = dDe['nav.ventes']; delete dDe['nav.ventes'];
    dit(I.t('nav.ventes') === fr['nav.ventes'], 'R5b une clé absente de la langue retombe sur le français');
    dDe['nav.ventes'] = garde;
    await I.appliquerLangue('en');
    dit(/12\.40/.test(I.monnaie(12.4)) && I.t('auth.renvoyerDans', { s: 7 }).includes('7'), 'R8 anglais : €12.40, variables remplies');
    await I.appliquerLangue('fr');
    dit(I.t('reglages.recherche.trouves', { n: 2 }) === '2 réglages trouvés' && /12,40\s€/.test(I.monnaie(12.4)), 'R9 retour au français : « 2 réglages trouvés », 12,40 €');
    const avant = I.langueCourante(); const r = await I.appliquerLangue('zz');
    dit(r === true && I.langueCourante() === 'fr' && avant === 'fr', 'R10 une langue inconnue retombe sur le français');
  } catch (e) { dit(false, 'R la règle se charge', e.stack || e.message); }

  console.log(`\n${ko ? '❌' : '✅'} audit-traduction : ${ok} verts, ${ko} rouge(s)`);
  return ko;
}

// ── --prouve : chaque mutation doit rougir ──
if (process.argv.includes('--prouve')) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'trad-'));
  const copier = (rel) => { const d = path.join(tmp, rel); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(R, rel), d); };
  const FICHIERS = ['src/i18n/index.js', 'src/i18n/react.js', 'src/i18n/ChoixLangue.jsx', 'src/Accueil.jsx', 'src/profil/MenuProfil.jsx', 'src/composants/GardeEcran.jsx', 'src/main.jsx', 'src/App.jsx', 'src/ecrans/Reglages.jsx', 'api/_lib/plan-regle.js', ...LANGUES.map((l) => `src/i18n/langues/${l}.js`), ...LANGUES.map((l) => `src/i18n/langues/${l}-accueil.js`)];
  const MUTS = [
    ['une clé manque en allemand', 'src/i18n/langues/de.js', /\n\s*"nav\.ventes": [^\n]*/, ''],
    ['une clé de l’accueil rangée avec l’app', 'src/i18n/langues/fr-accueil.js', /\n\s*"accueil\.hero\.titre": [^\n]*/, ''],
    ['une variable renommée en italien', 'src/i18n/langues/it.js', /("auth\.fournisseur\.continuer": "[^"]*)\{nom\}/, '$1{name}'],
    ['un pluriel sans `one` en espagnol', 'src/i18n/langues/es.js', /("reglages\.recherche\.trouves": \{ )one: "[^"]*", /, '$1'],
    ['un texte anglais trois fois trop long', 'src/i18n/langues/en.js', /("nav\.annonces": ")([^"]*)"/, '$1$2 $2 $2 $2 $2 and more words to overflow"'],
    ['« Se déconnecter » remis en dur dans le menu du profil', 'src/profil/MenuProfil.jsx', "tr('profil.deconnexion'),onDeconnexion", "'Se déconnecter',onDeconnexion"],
    ['un placeholder en dur à la connexion', 'src/App.jsx', "placeholder={tr('auth.champ.prenomPlaceholder')}", 'placeholder="Ton prénom (facultatif)"'],
    ['une ligne de Paramètres en dur', 'src/ecrans/Reglages.jsx', "lib:tr('reglages.corbeille.lib')", "lib:'Corbeille'"],
    ['une clé appelée mais absente du français', 'src/ecrans/Reglages.jsx', "tr('reglages.recherche.effacer')", "tr('reglages.recherche.effacerTout')"],
    ['la phrase Solo recopiée de travers', 'src/i18n/langues/fr-accueil.js', /("accueil\.offre\.solo\.phrase": "Un compte)/, '$1 et demi'],
    ['le repli sur le français retiré', 'src/i18n/index.js', 'if (e == null) e = fr[cle];', ''],
    ['la langue du navigateur ignorée', 'src/i18n/index.js', "if (estLangue(l)) return l;", ''],
  ];
  let rouges = 0;
  for (const [nom, rel, avant, apres] of MUTS) {
    fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp);
    FICHIERS.forEach(copier);
    try { fs.symlinkSync(path.join(R, 'node_modules'), path.join(tmp, 'node_modules')); } catch (_) {}
    const f = path.join(tmp, rel); const src = fs.readFileSync(f, 'utf8');
    const nouv = src.replace(avant, apres);
    if (nouv === src) { console.log(`❌ mutation « ${nom} » : motif introuvable (elle ne prouve rien)`); continue; }
    fs.writeFileSync(f, nouv);
    const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, TRAD_RACINE: tmp }, encoding: 'utf8', timeout: 120000 });
    if (r.status !== 0) rouges++;
    console.log(`${r.status !== 0 ? '✅' : '❌'} mutation « ${nom} » ⇒ ${r.status !== 0 ? 'ROUGE' : 'encore vert'}`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${rouges === MUTS.length ? '✅' : '❌'} ${rouges}/${MUTS.length} mutations rouges`);
  process.exit(rouges === MUTS.length ? 0 : 1);
} else {
  principal().then((k) => process.exit(k ? 1 : 0), (e) => { console.error(e); process.exit(1); });
}
