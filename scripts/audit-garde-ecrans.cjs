// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : UN GARDE-FOU PAR ÉCRAN ET PAR FEUILLE — node scripts/audit-garde-ecrans.cjs [App.jsx]
// ═══════════════════════════════════════════════════════════════════════════
// (6 nov., filet 2) Chaque écran monté par la coque (`{tab==='x'&&…}`) et chaque
// feuille plein écran montée hors de la zone des écrans (fiche d'une paire, « Le
// prix partout », « Publier ailleurs », lien Vestiaire, Bienvenue, visite,
// sauvegarde, panneau de synchro, recherche) passe par `GardeEcran`
// (src/composants/GardeEcran.jsx). §4 loi 11 : les écrans montés sont COMPTÉS —
// un écran ajouté sans garde-fou, ou un écran disparu, rougit l'audit.
// Le comportement (un écran planté ne fait tomber que lui, la navigation reste,
// le plantage est noté avec son nom, le garde-fou se remet à zéro) est jugé par
// le banc scripts/bancs/garde-ecrans.cjs (l'app rendue).
// Lit le code, n'écrit rien. Un chemin en argument : juger un autre App.jsx
// (l'arbre d'avant : il doit être ROUGE).
'use strict';
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
const fichier = process.argv[2] || path.join(R, 'src', 'App.jsx');
const src = fs.readFileSync(fichier, 'utf8');
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (!c && d ? ' — ' + String(d).slice(0, 600) : '')); };

// Les écrans montés par la coque : les lignes `{tab==='x'…&&` au niveau de la zone des écrans.
const lignes = src.split('\n');
const montages = lignes.map((l, i) => ({ l, i: i + 1 })).filter(({ l }) => /^        \{\(?tab==='[a-z_]+'/.test(l));
// Les titres seuls (un <header> sans écran) ne sont pas des écrans.
const ecrans = montages.filter(({ l }) => !/&&<header className="vrm-market-heading/.test(l));
// Un montage écrit sur deux lignes (`{…&&(` puis `<GardeEcran …>`) : la ligne suivante compte.
const sansGarde = ecrans.filter(({ l, i }) => !/<GardeEcran nom=/.test(l) && !/^\s*<GardeEcran nom=/.test(lignes[i] || ''));
console.log(`${ecrans.length} écrans montés par la coque (lignes « {tab==='…'&& »), ${montages.length - ecrans.length} titre(s) seul(s).`);
// Le 6 nov. : 26 montages (dont 1 titre seul), AVANT comme APRÈS l'ajout des garde-fous.
// Moins = un écran a disparu (§4 loi 11).
dit(ecrans.length >= 25, 'aucun écran n’a disparu de la coque (25 au 6 nov., avant comme après)', `${ecrans.length} seulement`);
dit(!sansGarde.length, 'chaque écran monté passe par GardeEcran', sansGarde.map(({ l, i }) => `l.${i} ${l.trim().slice(0, 70)}`).join(' | '));
// L'écran Annonces/Ventes/Colis de l'ancienne table (`map[tab]`) et « À retirer ».
dit(/return map\[tab\] \? <GardeEcran nom=\{tab\} resetKey=\{platSub\}><Comptabilite key=\{tab\}/.test(src), 'les écrans Annonces · Ventes · Colis de la table `map` passent par GardeEcran');
dit(/<GardeEcran nom="cat_bord:retirer"><section id="colis-a-retirer"/.test(src), 'Colis · « À retirer » passe par GardeEcran');
// Les sections de site des tâches (Ventes · Vinted, Annonces · Leboncoin…) : la section tombe seule.
dit(/<GardeEcran nom=\{t\+':'\+site\} resetKey=\{platSub\}>/.test(src), 'la section d’un site (rendreTache) a son garde-fou : le filtre des sites reste');
// Les feuilles hors de la zone des écrans.
const FEUILLES = [
  ['fiche', /<GardeEcran nom="fiche" feuille resetKey=\{ficheNum\} onFermer=\{\(\)=>setFicheNum\(null\)\}><Differe rendre=/],
  ['prix', /<GardeEcran nom="prix" feuille resetKey=\{prixNum\} onFermer=\{\(\)=>setPrixNum\(null\)\}><Differe rendre=/],
  ['publier', /<GardeEcran nom="publier" feuille [^>]*onFermer=\{\(\)=>setPubAil\(null\)\}><Differe rendre=/],
  ['lienvc', /<GardeEcran nom="lienvc" feuille><HoteLienVc /],
  ['bienvenue', /<GardeEcran nom="bienvenue" feuille [^\n]*><Bienvenue /],
  ['visite', /<GardeEcran nom="visite" feuille onFermer=\{\(\)=>setVisite\(false\)\}><VisiteBulles /],
  ['sauvegarde', /<GardeEcran nom="sauvegarde" feuille onFermer=\{\(\)=>setShowBackup\(false\)\}><BackupModal/],
  ['sync', /<GardeEcran nom="sync" feuille onFermer=\{\(\)=>setSyncOuvert\(false\)\}><PanneauSync /],
  ['recherche', /const panneauRecherche = !gsOpen \? null : <GardeEcran nom="recherche" feuille onFermer=\{fermerRecherche\}><Differe rendre=/],
];
for (const [nom, re] of FEUILLES) dit(re.test(src), `la feuille « ${nom} » a son garde-fou (calculée SOUS lui : <Differe>)`);
// Aucune feuille calculée dans la coque elle-même (une IIFE plante la coque, hors de portée de tout garde-fou).
const iife = ['ficheNum', 'prixNum', 'pubAil'].filter((v) => new RegExp(`\\{${v} && \\(\\(\\)=>\\{`).test(src));
dit(!iife.length, 'aucune feuille calculée par une IIFE dans la coque (`{x && (()=>{…})()}`)', iife.join(', '));
// La coque garde un garde-fou d'ensemble (bandeaux), et l'ancien a disparu (une seule forme).
dit(/<GardeEcran nom=\{'coque:'\+tab\} resetKey=\{tab\}>/.test(src), 'la zone des écrans garde un garde-fou d’ensemble (les bandeaux de la coque)');
dit(!/<EcranGardeFou\b/.test(src), 'l’ancien EcranGardeFou n’est plus monté (une seule forme, un seul chemin de notation)');
// Le composant : rien au rendu quand tout va bien, la phrase des bancs, la notation par src/plantages.js,
// la remise à zéro, le crochet de banc limité à localhost.
let g = '';
try { g = fs.readFileSync(path.join(R, 'src', 'composants', 'GardeEcran.jsx'), 'utf8'); } catch (_) { dit(false, 'src/composants/GardeEcran.jsx existe'); }
dit(/if \(!this\.state\.err\) return plantageDeBancDemande\(nom\) \? <PlanteurDeBanc nom=\{nom\}\/> : \(children === undefined \? null : children\);/.test(g), 'GardeEcran rend ses enfants TELS QUELS quand rien ne plante (aucun élément ajouté)');
dit(/n'a pas pu s'afficher/.test(g), 'la phrase « n’a pas pu s’afficher » reste (une quarantaine de bancs reconnaissent un écran tombé à elle)');
dit(/noterPlantage\(err, \{ origine: this\.props\.feuille \? 'feuille' : 'ecran', ecran: String\(this\.props\.nom/.test(g), 'le plantage est noté par src/plantages.js avec le NOM de l’écran');
dit(/prev\.resetKey !== this\.props\.resetKey\) this\.setState\(\{ err: null \}\)/.test(g), 'le garde-fou se remet à zéro quand on change d’écran ou de section');
dit(/\^\(localhost\|127\\\.0\\\.0\\\.1\)\$/.test(g), 'le crochet de banc ne s’allume que servi depuis localhost (jamais sur vrm.center)');
console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s)` : '\n✅ un garde-fou par écran et par feuille');
process.exit(ko ? 1 : 0);
