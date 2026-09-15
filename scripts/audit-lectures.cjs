// ⚠️ CONTRÔLE PERMANENT — CE QU'UNE LECTURE A LE DROIT DE RAPATRIER.
//
// Demande de Julien, 15 septembre : « améliore la rapidité de la capture de
// bordereau, de lecture de donnée et de transmission ».
//
// Mesuré sur sa VRAIE base avant de coder :
//   · `harvest_*_txn_*`  : **704 lignes**. `select=data` rend **19,8 Mo en
//     5,0 s** ; la projection `item_id` rend **16 Ko en 0,36 s** — 1 251× moins
//     d'octets, 14× plus vite, et **exactement les mêmes 242 ventes prouvées**.
//     Cette lecture était écrite **quatre fois** (app, buildLbcData,
//     buildEbayData, buildPanelData) : 77 Mo par tour de panneau.
//   · `harvest_*_conv_*` : **939 lignes**. `select=id,data` rend **4,3 Mo** ;
//     les huit champs utiles rendent **994 Ko** — 4,3× moins, messages
//     identiques (629 conversations comparées, 0 différence).
//
// C'est §4.4 mot pour mot (« jamais `select=data` sur une ligne lourde »), et
// c'est de l'ÉGRESS : un `select=data` sur le widget avait déjà crevé le quota
// (5,7 Go).
//
// ⚠️ ET LE PLAFOND DES 1 000 LIGNES (§4.5). Mesuré le même jour :
// `Content-Range: 0-999/4999` — au-delà de mille, Supabase coupe **sans le
// dire**. `harvest_*_conv_*` est à **939 lignes** : à soixante et une du
// plafond. Le jour où il le franchit, le panneau cesse de voir des offres et
// des codes de retrait, en silence.
//
// ⚠️ CE CONTRÔLE PORTE SUR LA REQUÊTE, PAS SUR SON ORTHOGRAPHE : ce qui est
//    interdit, c'est de demander le blob d'une famille lourde — quelle que soit
//    la façon de l'écrire.
const fs = require('fs'), path = require('path');
const racine = path.join(__dirname, '..');

let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${det ? ' — ' + det : ''}`); };

// Les familles mesurées comme lourdes, avec ce que coûtait le blob.
const LOURDES = [
  { motif: 'harvest_*_txn_*',  lignes: 704, blob: '19,8 Mo' },
  { motif: 'harvest_*_conv_*', lignes: 939, blob: '4,3 Mo' },
];

const FICHIERS = ['src/App.jsx', 'vinted-sync-extension/background.js',
  'api/widget.js', 'api/ship-reminders.js', 'api/email-inbound.js'];

// Un audit lit le CODE : les commentaires sortent d'abord (ils citent les
// anciennes requêtes pour expliquer pourquoi elles sont parties).
const sansCommentaires = (t) => t
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(Math.max(0, m.length - p1.length)));

console.log('── AUCUNE LECTURE NE RAPATRIE LE BLOB D\'UNE FAMILLE LOURDE');
for (const f of FICHIERS) {
  const p = path.join(racine, f);
  if (!fs.existsSync(p)) continue;
  const src = sansCommentaires(fs.readFileSync(p, 'utf8'));
  for (const fam of LOURDES) {
    // La famille telle qu'elle s'écrit dans une requête, suivie d'un select
    // qui demande `data` entier (seul ou avec `id`).
    const motif = new RegExp('id=like\\.' + fam.motif.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '\\*')
      + '&select=(?:id,)?data(?![-,>])', 'g');
    const trouves = (src.match(motif) || []).length;
    dit(trouves === 0, `${f} : ${fam.motif} n'est jamais lu en entier`,
      trouves ? `${trouves} lecture(s) — ${fam.lignes} lignes, ${fam.blob} par appel` : '');
  }
}

console.log('\n── LES FAMILLES QUI APPROCHENT DES 1 000 LIGNES SONT PAGINÉES');
{
  const bg = sansCommentaires(fs.readFileSync(path.join(racine, 'vinted-sync-extension/background.js'), 'utf8'));
  dit(/async function sbGetTout\(/.test(bg), 'l\'extension sait paginer',
    'sans ça, au-delà de 1 000 lignes la réponse est coupée SANS le dire (§4.5)');
  // La pagination doit garder la règle du fichier : `null` sur échec, jamais une
  // demi-liste présentée comme complète.
  const m = /async function sbGetTout\([\s\S]*?\n\}/.exec(bg);
  dit(!!m && /return null/.test(m[0]), 'et une page ratée rend `null`, pas une demi-liste',
    'une liste tronquée a l\'air d\'une réponse — c\'est pire qu\'une lecture ratée');
  // Chaque lecture d'une famille lourde passe par la pagination.
  for (const fam of LOURDES) {
    // ⚠️ SEIZIÈME FOIS QU'UN DE MES CONTRÔLES CRIE AU LOUP. Premier jet : chaque
    //    `*` de la famille valait « n'importe quoi » — donc il attrapait
    //    `harvest_*_conv_${convId}`, qui lit **UNE** conversation par son
    //    identifiant. Une lecture d'UNE ligne n'a pas besoin d'être paginée, et
    //    elle a le droit de rapatrier son blob. Ce qui est en cause, c'est le
    //    BALAYAGE d'une famille entière : le `*` de fin doit être un vrai `*`.
    const prefixe = fam.motif.replace(/_\*$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '[^`\'"&]*');
    const motif = new RegExp('(\\w+)\\(\\s*[`\'"]app_data\\?id=like\\.' + prefixe + '_\\*[&`\'"]', 'g');
    const lecteurs = [...bg.matchAll(motif)].map((x) => x[1]);
    // ⚠️ DIX-SEPTIÈME FOIS QU'UN DE MES CONTRÔLES CRIE AU LOUP : `lire()` (le
    //    lecteur du panneau) EST paginé — il route lui-même les balayages de
    //    famille vers `sbGetTout`. Exiger le nom `sbGetTout` au point d'appel,
    //    c'est juger l'orthographe ; la règle est « ce lecteur pagine ». On suit
    //    donc l'expression jusqu'à sa définition, comme `audit-panneau.cjs`.
    const pagine = (nom) => {
      if (nom === 'sbGetTout') return true;
      const def = new RegExp('const ' + nom + ' = async \\(q\\) => \\{[\\s\\S]{0,400}?\\n  \\};').exec(bg);
      return !!def && /sbGetTout/.test(def[0]);
    };
    const mauvais = lecteurs.filter((l) => !pagine(l));
    dit(mauvais.length === 0, `${fam.motif} : lu avec pagination (${lecteurs.length} lecture(s))`,
      mauvais.length ? `lu par ${[...new Set(mauvais)].join(', ')} — coupé à 1 000 lignes en silence` : '');
  }
}

console.log('\n── LA LIGNE `main` (197 Ko) N\'EST JAMAIS RAPATRIÉE EN ENTIER');
{
  // ⚠️⚠️ MESURÉ LE 15 SEPTEMBRE SUR SA VRAIE BASE : `main` pèse **197 Ko** —
  // 127 Ko de `vinted_annonce_numeros`, 25 Ko de `vinted_sale_overrides` — et
  // **huit** endroits la lisaient en `select=data` : le panneau à chaque visite
  // sur Vinted, les files Leboncoin et eBay sur chaque page de ces sites,
  // l'écran Leboncoin de l'app, et **le widget de son iPhone**, qui n'en lit
  // que trois clés pesant 1 Ko à elles trois.
  // C'est §4.4 (« jamais `select=data` sur une ligne lourde ») sur la ligne la
  // plus lue du projet, et c'est de l'ÉGRESS — un `select=data` avait déjà
  // crevé le quota (5,7 Go) sur cette même route widget. *La leçon avait été
  // apprise pour les commandes, jamais pour `main`.*
  //
  // ⚠️ UN SEUL LECTEUR A LE DROIT DE TOUT PRENDRE : `cloudLoad`, qui restaure
  //    toutes les clés synchronisées dans le navigateur — c'est le
  //    PROPRIÉTAIRE de la ligne (§11). Tous les autres projettent.
  const PROPRIETAIRE = 'cloudLoad';
  const CIBLES = ['src/App.jsx', 'vinted-sync-extension/background.js',
    'api/widget.js', 'api/ship-reminders.js', 'api/email-inbound.js'];
  for (const f of CIBLES) {
    const p2 = path.join(racine, f);
    if (!fs.existsSync(p2)) continue;
    const src = sansCommentaires(fs.readFileSync(p2, 'utf8'));
    // La lecture fautive : `id=eq.main` suivi d'un `select` qui demande `data`
    // entier. Ce qui est en cause est la REQUÊTE, pas la façon de l'écrire.
    const brutes = [...src.matchAll(/id=eq\.main&select=(?:id,)?data(?![-,>])/g)];
    const dansProprietaire = brutes.filter((m) => {
      const av = src.slice(Math.max(0, m.index - 1500), m.index);
      return av.includes(PROPRIETAIRE);
    }).length;
    const fautives = brutes.length - dansProprietaire;
    dit(fautives === 0, `${f} : \`main\` n'est lue en entier que par son propriétaire`,
      fautives ? `${fautives} lecture(s) de 197 Ko — projette les clés utilisées` : '');
  }
}

console.log('\n── ET UNE PROJECTION DÉCLARE TOUTES LES CLÉS QUE SA FONCTION LIT');
{
  // ⚠️ LA MOITIÉ QUI MANQUERAIT À UN CONTRÔLE POSÉ SUR LES SEULS OCTETS :
  //    projeter trop peu ne coûte rien et ne lève rien — la clé oubliée vaut
  //    `undefined`, c'est-à-dire un compte exclu qui revient dans la file, ou
  //    une paire retirée du stock qu'on republie. **En silence.** C'est
  //    exactement ce qui existait déjà : `vinted_pairs_lost` était écarté par
  //    l'app et par la file eBay, et PAS par la file Leboncoin du panneau —
  //    « l'app annonçait 39, le panneau 40 » (§11).
  // ⚠️ CE CONTRÔLE PORTE SUR LA RÈGLE, PAS SUR UNE LISTE ÉCRITE À LA MAIN : il
  //    relit le corps de chaque fonction, y cherche les clés de `main` qu'elle
  //    utilise vraiment, et exige que la liste projetée les contienne toutes.
  //    Ajouter une clé sans l'ajouter à la liste passe au rouge.
  const corpsDe = (src, i) => {
    let p2 = src.indexOf('{', i), n = 0, j = p2;
    for (; j < src.length; j++) { const c = src[j]; if (c === '{') n++; else if (c === '}') { n--; if (!n) break; } }
    return src.slice(p2, j + 1);
  };
  const LECTEURS = [
    { f: 'vinted-sync-extension/background.js', fn: 'buildPanelData', liste: 'MAIN_PANNEAU' },
    { f: 'vinted-sync-extension/background.js', fn: 'buildLbcData',   liste: 'MAIN_FILE' },
    { f: 'vinted-sync-extension/background.js', fn: 'buildEbayData',  liste: 'MAIN_FILE' },
    { f: 'src/App.jsx',                         fn: 'LeboncoinScreen', liste: 'MAIN_LEBONCOIN' },
    { f: 'api/widget.js',                       fn: 'handler',         liste: 'MAIN_WIDGET' },
  ];
  for (const L of LECTEURS) {
    const p2 = path.join(racine, L.f);
    if (!fs.existsSync(p2)) { dit(false, `${L.f} introuvable`); continue; }
    const src = sansCommentaires(fs.readFileSync(p2, 'utf8'));
    const decl = new RegExp('const ' + L.liste + ' = \\[([^\\]]*)\\]').exec(src);
    if (!decl) { dit(false, `${L.fn} : la liste ${L.liste} est introuvable`); continue; }
    const declarees = new Set((decl[1].match(/'([^']+)'/g) || []).map((x) => x.slice(1, -1)));
    const i = src.search(new RegExp('(async function|function|const) ' + L.fn + '\\b'));
    if (i < 0) { dit(false, `${L.fn} introuvable dans ${L.f}`); continue; }
    const c = corpsDe(src, i);
    const utilisees = [...new Set([...c.matchAll(/\b(?:main|d|m)\.((?:vinted|vrm)_[a-zA-Z0-9_]+)/g)].map((x) => x[1]))];
    const manquantes = utilisees.filter((k) => !declarees.has(k));
    dit(manquantes.length === 0,
      `${L.fn} : ${L.liste} déclare les ${utilisees.length} clé(s) qu'elle lit`,
      manquantes.length ? `absente(s) de la projection : ${manquantes.join(', ')} — elles vaudraient \`undefined\`, en silence` : '');
  }
}

console.log('\n── ET LA PREUVE DE VENTE NE SE CALCULE QU\'À UN SEUL ENDROIT');
{
  const bg = sansCommentaires(fs.readFileSync(path.join(racine, 'vinted-sync-extension/background.js'), 'utf8'));
  dit(/async function lireVentesProuvees\(/.test(bg), 'l\'extension a une seule règle de preuve (§11)');
  const appels = (bg.match(/lireVentesProuvees\(\)/g) || []).length;
  dit(appels >= 2, `et les deux files s'en servent (${appels} appels)`,
    'sinon la même lecture est réécrite, et l\'une des deux dérive');
  // « rien lu » ne vaut pas « rien » : l'échec doit être RENDU, pas avalé.
  const m = /async function lireVentesProuvees\([\s\S]*?\n\}/.exec(bg);
  dit(!!m && /echec/.test(m[0]), 'et elle PORTE l\'échec de lecture',
    'une lecture ratée deviendrait « aucune vente » : 15 paires vendues reproposées (mesuré le 15 septembre)');
}

console.log('\n── ET CE QU\'ON A MESURÉ, ON LE GARDE');
{
  const bg = sansCommentaires(fs.readFileSync(path.join(racine, 'vinted-sync-extension/background.js'), 'utf8'));
  // ⚠️⚠️ `recupererLabel` essaie TROIS chemins Vinted l'un après l'autre et
  // s'arrête au premier qui donne l'URL du PDF. Il calculait `via` — le chemin
  // gagnant — et ne l'enregistrait NULLE PART. Or c'est la seule mesure qui
  // permettrait d'en retirer un ou de les réordonner : relevé du 13 septembre,
  // **`label_url_trouve` 29 contre `label_url_introuvable` 61**, l'URL est
  // introuvable deux fois sur trois, et rien ne disait lequel répond.
  // Sans cette trace, accélérer cette capture serait une supposition.
  const m = /async function recupererLabel\([\s\S]*?\n\}/.exec(bg);
  dit(!!m, 'la récupération du bordereau est toujours là');
  if (m) {
    dit(/via\s*=\s*chemin/.test(m[0]), 'elle sait QUEL chemin a donné l\'URL');
    dit(/noterDiag\([^)]*via/.test(m[0]), 'et elle l\'ENREGISTRE',
      'un chemin gagnant calculé puis jeté, c\'est la mesure qui manque pour accélérer');
    dit(/label_ko_statuts/.test(m[0]), 'et quand aucun ne répond, elle note les statuts',
      '« Vinted a refusé » et « Vinted a répondu sans URL » ne se corrigent pas pareil');
  }
}

console.log(ko ? `\n${ko} contrôle(s) non conforme(s).` : '\nAucune lecture ne rapatrie plus que ce qu\'elle lit.');
process.exit(ko ? 1 : 0);
