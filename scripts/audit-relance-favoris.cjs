// ════════════════════════════════════════════════════════════════════════════
//  RELANCER LES FAVORIS AU BON MOMENT (15 nov. 2026, « vendre plus », validé par Julien) — EXÉCUTÉ
//
//  La VRAIE règle (src/relanceFavoris.js) sur des annonces INVENTÉES (aucune donnée réelle) :
//    A  ≥ N personnes (compteur LU) ET rien depuis 7 jours ⇒ une carte « 5 personnes aiment N°124 ·
//       depuis 9 j » ; 6 j ⇒ pas encore ; un favori daté d'il y a 3 j ⇒ pas encore ;
//    B  compteur pas lu ⇒ jamais une carte (pas « 0 ») ; sous N ⇒ rien ; aucune date connue ⇒ rien
//       (on ne sait pas si c'est le moment) ; vendue ⇒ rien ; relancée il y a 2 j ⇒ rien ;
//    C  les offres pas lues ne valent pas « aucune » : la carte le dit ;
//    D  IDENTITÉ : 50 annonces au MÊME titre ⇒ 50 cartes possibles, chacune par SON identifiant ;
//       le favori daté d'UNE annonce ne retarde pas sa jumelle ; la date vient du LIEN /items/<id> ;
//    E  le geste : Vinted ⇒ « Offre aux favoris » (extension trop ancienne ⇒ dit, pas envoyé) ;
//       eBay ⇒ « Offre aux observateurs » ; ordre : le plus de personnes d'abord ;
//    F  l'app : la carte ouvre Messages → Favoris avec les favoris de CETTE annonce (la règle
//       `favorisAContacter` : une personne une fois, jamais un déjà contacté) ; rien ne part d'ici.
//  `--prouve` : chaque mutation doit faire rougir au moins un contrôle. `--racine <dir>` : un autre arbre.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require('./_source-app.cjs').brancher();   // (22 nov., intégration finale) Comptabilite vit dans src/ecrans/ : la lecture d'App.jsx rend le texte entier
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const iR = process.argv.indexOf('--racine');
const R = iR > 0 ? path.resolve(process.argv[iR + 1]) : path.join(__dirname, '..');
const PROUVE = process.argv.includes('--prouve');
const J = 86400000, T0 = Date.UTC(2026, 10, 15, 10);
const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return ''; } };

async function controles(fichier, parler) {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; if (parler) console.log((c ? 'OK  ' : 'KO  ') + m + (d && !c ? ' — ' + d : '')); };
  let M = null;
  try { M = await import(pathToFileURL(fichier).href + '?v=' + Math.random()); } catch (e) { dit(false, 'src/relanceFavoris.js se charge', e.message); return ko; }
  const a = (o) => ({ plateforme: 'vinted', id: '124', uid: 'u1', numero: '124', titre: 'Nike Dunk Low', favoris: 5, age: 9, offresLues: false, ...o });
  const C = (annonces, o = {}) => M.cartesRelance({ annonces, maintenant: T0, ...o });

  // A
  const r1 = C([a()]);
  dit(r1 && r1.n === 1 && r1.cartes[0].personnes === 5 && r1.cartes[0].depuisJ === 9 && r1.cartes[0].numero === '124', 'A1 5 favoris lus, en ligne depuis 9 j, rien d\'autre ⇒ « 5 personnes aiment N°124 · depuis 9 j »', JSON.stringify(r1));
  dit(C([a({ age: 6 })]).n === 0 && C([a({ age: 7 })]).n === 1, 'A2 le bon moment : 6 j ⇒ pas encore ; 7 j ⇒ oui');
  dit(C([a({ age: 30 })], { datesFavoris: { 124: T0 - 3 * J } }).n === 0, 'A3 un nouveau favori il y a 3 j ⇒ pas encore (ça bouge)');
  dit(C([a({ age: 30 })], { datesFavoris: { 124: T0 - 8 * J } }).cartes[0].depuisJ === 8, 'A4 dernier favori il y a 8 j ⇒ « depuis 8 j »');
  dit(C([a({ age: 30, derniereOffre: T0 - 2 * J, offresLues: true })]).n === 0, 'A5 une offre reçue lue il y a 2 j ⇒ pas encore');
  // B
  dit(C([a({ favoris: null })]).n === 0 && C([a({ favoris: null })]).ecartees.pasLu === 1, 'B1 favoris pas lus ⇒ aucune carte, compté « pas lu »');
  dit(C([a({ favoris: 2 })]).n === 0 && C([a({ favoris: 2 })], { seuil: 2 }).n === 1, 'B2 sous le seuil ⇒ rien ; seuil réglé à 2 ⇒ la carte');
  dit(C([a({ age: null })]).n === 0 && C([a({ age: null })]).ecartees.sansDate === 1, 'B3 aucune date connue ⇒ rien (on ne sait pas si c\'est le moment)');
  dit(C([a()], { vendus: new Set(['vinted:124']) }).n === 0, 'B4 vendue (preuve, par identité) ⇒ rien');
  dit(C([a({ age: 30 })], { relances: { 'vinted:124': T0 - 2 * J } }).n === 0, 'B5 relancée par VRM il y a 2 j ⇒ rien');
  dit(C(null) === null, 'B6 annonces pas lues ⇒ null (pas « aucune carte »)');
  // C
  dit(r1.cartes[0].offresLues === false && C([a({ offresLues: true })]).cartes[0].offresLues === true, 'C1 offres pas lues ⇒ la carte le sait (et le dit) ; lues ⇒ « ni offre ni vente »');
  // D
  const ann = Array.from({ length: 50 }, (_, i) => a({ id: String(5000 + i), numero: String(i + 1), age: 20 }));
  const r50 = C(ann, { max: 100, datesFavoris: { 5017: T0 - 2 * J } });
  dit(r50.n === 49 && new Set(r50.cartes.map((c) => c.cle)).size === 49 && !r50.cartes.some((c) => c.id === '5017'), 'D1 50 annonces au même titre : 49 cartes distinctes, seule celle au favori récent (5017) attend', `${r50.n}`);
  const dates = M.datesFavorisParAnnonce([{ lien: 'https://www.vinted.fr/items/5017-nike-dunk', date: new Date(T0 - 2 * J).toISOString(), body: 'Nike Dunk Low 5018' }, { lien: 'https://www.vinted.fr/member/9', date: new Date(T0).toISOString() }]);
  dit(dates && dates['5017'] === T0 - 2 * J && Object.keys(dates).length === 1, 'D2 la date d\'un favori va à l\'annonce de SON LIEN /items/<id> (jamais au texte)', JSON.stringify(dates));
  dit(C([a(), a()]).n === 1, 'D3 la même annonce deux fois = une carte');
  // E
  const g = M.gesteRelance(r1.cartes[0], { cap: () => 'retard', version: () => '5.372.0' });
  dit(g.k === 'favoris' && g.bloque === 'extension' && g.version === '5.372.0', 'E1 extension trop ancienne ⇒ le geste le dit (rien ne part)');
  dit(M.gesteRelance({ ...r1.cartes[0], uid: '' }).bloque === 'compte', 'E2 compte pas su ⇒ le geste le dit');
  dit(M.gesteRelance({ plateforme: 'ebay', id: '1' }).k === 'observateurs', 'E3 eBay ⇒ « Offre aux observateurs »');
  const ord = C([a({ id: '1', favoris: 3, age: 40 }), a({ id: '2', favoris: 9, age: 8 }), a({ id: '3', favoris: 9, age: 20 })]);
  dit(ord.cartes.map((c) => c.id).join(',') === '3,2,1', 'E4 le plus de personnes d\'abord, puis le plus long calme', ord.cartes.map((c) => c.id).join(','));
  return ko;
}

const MUTATIONS = [
  ['aucun calme', 'export const CALME_J = 7;', 'export const CALME_J = 0;'],
  ['seuil ignoré', 'if (f < s) { ecartees.peu++; continue; }', ''],
  ['pas lu = 0', "if (f == null) { ecartees.pasLu++; continue; }", 'if (f == null) { /* compté 0 */ }'],
  ['favori daté ignoré', 'if (plat === \'vinted\' && datesFavoris && datesFavoris[id] != null) dates.push(Number(datesFavoris[id]));', ''],
  ['vendue ignorée', "if (vendus && typeof vendus.has === 'function' && vendus.has(cle)) { ecartees.vendue++; continue; }", ''],
  ['relance ignorée', 'const rel = relances ? ms(relances[cle]) : null; if (rel != null) dates.push(rel);', 'const rel = null;'],
  ['sans date = maintenant', "if (!der.length) { ecartees.sansDate++; continue; }", "if (!der.length) der.push(0);"],
  ['date par le texte', "const id = (/\\/items\\/([1-9]\\d{0,19})(?:[-/?#]|$)/.exec(str(l && l.lien)) || [])[1];", "const id = (/(\\d{4,})/.exec(str(l && l.body)) || [])[1];"],
];

(async () => {
  const F = path.join(R, 'src', 'relanceFavoris.js');
  let ko = await controles(F, true);
  const sans = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
  const APP = sans(lire('src/App.jsx')), CARTE = sans(lire('src/RelanceFavorisCarte.jsx')), FV = sans(lire('src/FavorisVinted.jsx')), FJ = sans(lire('src/favorisJournee.js'));
  const dit = (c, m) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m); };
  dit(/preparerEnvoiFavoris\(c\.uid, undefined, c\.id\)/.test(APP) && /demanderVue\('favoris'\)/.test(APP), 'F1 la carte ouvre Messages → Favoris préparé pour CETTE annonce');
  // (20 nov., décision de Julien) Vinted : « Écrire aux favoris dans l'extension » ouvre le panneau sur CETTE annonce (la règle
  // `favorisAContacter` reste pour l'extension ; l'écran Favoris de l'app est retiré).
  void FV;
  dit(/<BoutonExtension className="sb-touche vrm-rf-geste" action="favoris" ids=\{\[String\(c\.id \|\| ''\)\]\}/.test(CARTE), 'F2 (20 nov.) Vinted : la carte ouvre les favoris de CETTE annonce dans le panneau de l’extension');
  dit(CARTE.length > 0 && !/vmrCmd|fetch\(|envoyer/i.test(CARTE.replace(/rf\.note/g, '')), 'F3 la carte n\'envoie rien elle-même');
  dit(/lignes: res/.test(FJ) && /cartesRelance\(\{/.test(APP), 'F4 la MÊME lecture des favoris (aucune requête de plus), la règle dans Ma journée');
  let koM = 0;
  if (PROUVE && fs.existsSync(F)) {
    const src = fs.readFileSync(F, 'utf8');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'relance-favoris-'));
    for (const [nom, x, y] of MUTATIONS) {
      if (!src.includes(x)) { console.log(`KO  mutation « ${nom} » : texte introuvable`); koM++; continue; }
      const f = path.join(dir, `m${MUTATIONS.findIndex((m) => m[0] === nom)}.mjs`);
      fs.writeFileSync(f, src.replace(x, y));
      const k = await controles(f, false);
      console.log((k > 0 ? 'OK  ' : 'KO  ') + `mutation « ${nom} » ⇒ ${k} contrôle(s) rouge(s)`);
      if (!k) koM++;
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(ko || koM ? `\n${ko} contrôle(s) rouge(s)${PROUVE ? `, ${koM} mutation(s) non vue(s)` : ''}` : '\nTout est vert.');
  process.exit(ko || koM ? 1 : 0);
})();
