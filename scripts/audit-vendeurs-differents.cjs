// Audit : VRM POUR DES VENDEURS DIFFÉRENTS DE JULIEN (8 nov.)
//
//   A. AFFICHAGE SIMPLE / COMPLET (src/profilVendeur.js), EXÉCUTÉ : Simple
//      seulement pour un compte Vinted et moins de 30 ventes LUES sur 30 jours ;
//      jamais pour le propriétaire de l'installation ; « pas su » ⇒ Complet ; le
//      choix posé gagne ; en Simple, une entrée n'est cachée que si l'on SAIT
//      qu'elle ne sert pas (Stock sans meuble, Republier jamais lancé, site
//      jamais relié) ; Ma journée ne tait que le conseil « Prix à baisser ».
//   B. AUCUN TOTAL CHANGÉ (src/App.jsx) : le mode n'est lu QUE par la navigation
//      (`groupesVisibles`), les filtres de site (`FiltreSites`) et les cases de
//      Ma journée — et le compteur d'une case tue reste publié (bloc caché
//      `data-tuile`). « Tous » des ventes reçoit toujours tous les sites.
//   C. HORS SNEAKERS (src/verifAnnonce.js), EXÉCUTÉ : `facultatifs` ⇒ jamais
//      « Taille absente » ni « Marque absente », ni « pas lues » ; un vendeur de
//      sneakers garde les deux. Chaque appel de `problemesAnnonce` /
//      `manquesEnvoi` de l'app passe `facultatifs`. Les mots « article » ne
//      contiennent jamais « paire ».
//   D. iPHONE SEUL (src/navigateurExtension.js), EXÉCUTÉ : dans Orion (iPhone) et
//      Firefox (Android), « où vit l'extension » ne dit jamais « ordinateur » ;
//      et les phrases du parcours qui le disaient à tort ont disparu du code.
//   E. MODE ÉQUIPE : tant que la 016 manque, Réglages → Équipe dit la phrase,
//      ce que verra l'aide, qui fait le geste — et aucun bouton « Inviter ».
// `--prouve` : chaque règle réaffaiblie doit passer au rouge.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const RAC = path.join(__dirname, '..');
const { sourceApp } = require('./_source-app.cjs');
const PROUVE = process.argv.includes('--prouve');

const lire = (rel) => { try { return fs.readFileSync(path.join(RAC, rel), 'utf8'); } catch (_) { return null; } };
const sansCommentaires = (s) => String(s || '').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

// Charge des modules ESM depuis une copie (une mutation ne touche jamais le dépôt).
async function charger(fichiers) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vendeurs-'));
  for (const [rel, txt] of Object.entries(fichiers)) { if (txt == null) continue; fs.writeFileSync(path.join(dir, path.basename(rel).replace(/\.js$/, '.mjs')), txt.replace(/from '\.\/([A-Za-z]+)\.js'/g, "from './$1.mjs'")); }
  return dir;
}
async function importer(dir, nom) { return import(path.join(dir, nom + '.mjs')); }

async function controles(T, ok) {
  // ── A ────────────────────────────────────────────────────────────────────
  const dir = await charger({ 'profilVendeur.js': T.profil, 'verifAnnonce.js': T.verif, 'navigateurExtension.js': T.nav, 'navigateursServis.js': T.servis });
  let P = null, V = null, N = null;
  try { P = await importer(dir, 'profilVendeur'); } catch (e) { ok(false, 'A0 src/profilVendeur.js se charge', e.message); }
  try { V = await importer(dir, 'verifAnnonce'); } catch (e) { ok(false, 'C0 src/verifAnnonce.js se charge', e.message); }
  try { N = await importer(dir, 'navigateurExtension'); } catch (e) { ok(false, 'D0 src/navigateurExtension.js se charge', e.message); }
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  if (P) {
    const A = P.affichageAuto;
    ok(typeof A === 'function', 'A1 la règle du défaut existe');
    if (typeof A === 'function') {
      ok(A({ proprietaire: false, nComptesVinted: 1, nVentes30j: 5 }) === 'simple', 'A2 un compte, 5 ventes sur 30 j ⇒ Simple');
      ok(A({ proprietaire: false, nComptesVinted: 1, nVentes30j: 29 }) === 'simple' && A({ proprietaire: false, nComptesVinted: 1, nVentes30j: 30 }) === 'complet', 'A3 le seuil est 30 ventes (29 Simple, 30 Complet)');
      ok(A({ proprietaire: false, nComptesVinted: 2, nVentes30j: 3 }) === 'complet', 'A4 deux comptes Vinted ⇒ Complet');
      ok(A({ proprietaire: true, nComptesVinted: 1, nVentes30j: 0 }) === 'complet', 'A5 jamais pour le propriétaire (Julien)');
      ok(A({ proprietaire: null, nComptesVinted: 1, nVentes30j: 0 }) === 'complet', 'A6 propriétaire pas su ⇒ Complet');
      ok(A({ proprietaire: false, nComptesVinted: null, nVentes30j: 0 }) === 'complet' && A({ proprietaire: false, nComptesVinted: 1, nVentes30j: null }) === 'complet', 'A7 comptes ou ventes pas sus ⇒ Complet (rien de caché sur un doute)');
      ok(P.affichageEffectif({ choix: 'simple' }, { proprietaire: true }).mode === 'simple' && P.affichageEffectif({ choix: 'complet' }, { proprietaire: false, nComptesVinted: 1, nVentes30j: 0 }).mode === 'complet', 'A8 son choix gagne, toujours modifiable');
      ok(P.ventesSur30j({ lignes: [{ ts: Date.now() }], partiel: true }) === null && P.ventesSur30j({ lignes: [{ ts: Date.now() }, { ts: 0 }], nonComptees: [{ ts: Date.now() }] }) === 2, 'A9 ventes sur 30 j : partiel ⇒ pas su ; non comptées datées comptées');
    }
    const E = P.entreeMontree;
    if (typeof E === 'function') {
      const ent = [{ id: 'garage' }, { id: 'cat_annonces', cle: 'republier' }, { id: 'ebay_agent', cle: 'plat_ebay', site: 'ebay' }, { id: 'compta' }, { id: 'settings' }];
      ok(ent.every((t) => E(t, { mode: 'complet', usage: { stock: false, republier: false }, relies: { ebay: false } })), 'A10 Complet : tout est montré');
      ok(!E(ent[0], { mode: 'simple', usage: { stock: false } }) && E(ent[0], { mode: 'simple', usage: { stock: null } }) && E(ent[0], { mode: 'simple', usage: { stock: true } }), 'A11 Simple : Stock caché seulement s’il n’a AUCUN meuble (pas su ⇒ montré)');
      ok(!E(ent[1], { mode: 'simple', usage: { republier: false } }) && E(ent[1], { mode: 'simple', usage: { republier: true } }), 'A12 Simple : Republier caché seulement s’il n’a jamais servi');
      ok(!E(ent[2], { mode: 'simple', relies: { ebay: false } }) && E(ent[2], { mode: 'simple', relies: { ebay: null } }), 'A13 Simple : un site caché seulement s’il est PROUVÉ non relié');
      ok(E(ent[3], { mode: 'simple' }) && E(ent[4], { mode: 'simple' }), 'A14 Simple : Compta et Paramètres restent');
      ok(P.siteMontre('vinted', { mode: 'simple', relies: { vinted: false } }) && P.siteMontre('ebay', { mode: 'simple', relies: { ebay: false }, choisi: 'ebay' }) && !P.siteMontre('ebay', { mode: 'simple', relies: { ebay: false } }), 'A15 filtres : Vinted et le site choisi restent toujours');
      ok(!P.caseJourneeMontree('prix', 'simple') && ['envoyer', 'retirer', 'messages'].every((id) => P.caseJourneeMontree(id, 'simple')) && P.caseJourneeMontree('prix', 'complet'), 'A16 Ma journée Simple : seul « Prix à baisser » se tait, les gestes dus restent');
    } else ok(false, 'A10 la règle des entrées existe');
  }
  // ── B ────────────────────────────────────────────────────────────────────
  const app = T.app || '';
  const brut = sansCommentaires(app);
  const lectures = brut.split('\n').filter((l) => /PROFIL_VENDEUR\.mode|\bprofil\.mode\b|mode: p\.mode/.test(l));
  // (11 nov., lot centre-aide) l'aide choisit ses fiches selon Simple/Complet (`chercherAide`) : lecture d'affichage, permise.
  const permises = lectures.filter((l) => /caseJourneeMontree\(|const ctx = \{[^}]*?\bmode: (p|profil)\.mode|chercherAide\(/.test(l));
  ok(lectures.length > 0 && lectures.length === permises.length, 'B1 le mode n’est lu que par la navigation, les filtres de site et les cases de Ma journée', lectures.filter((l) => !permises.includes(l)).map((l) => l.trim().slice(0, 120)).join(' | '));
  ok(/<div hidden>\{T\.filter\(\(x\) => !cases\.includes\(x\)\)\.map\(\(x\) => <span key=\{x\.id\} data-tuile=\{x\.id\}/.test(app), 'B2 une case tue garde son compteur publié (bloc caché `data-tuile`)');
  ok(/entreeMontree\(t, ctx\)/.test(app) && /\.filter\(\(o\) => siteMontre\(o\.id, ctx\)\)/.test(app), 'B3 la navigation et les filtres passent par la règle');
  ok(/<VentesToutes sites=\{sitesPresents\}/.test(app), 'B4 « Tous » des ventes reçoit tous les sites présents (aucun filtre Simple)');
  ok(/'vrm_affichage','vrm_je_vends'/.test(app), 'B5 les deux réglages sont synchronisés (SYNC_KEYS)');
  // ── C ────────────────────────────────────────────────────────────────────
  if (V) {
    const livre = { titre: 'Le Petit Prince, Gallimard', taille: '', famille: '', marque: '', nPhotos: 4, prix: 8, achat: null };
    const codes = (a, s) => V.problemesAnnonce(a, s).map((x) => x.code);
    const sites = ['lbc', 'ebay', 'vestiaire', 'vinted'];
    ok(sites.every((s) => !codes({ ...livre, facultatifs: true }, s).some((c) => c === 'taille' || c === 'marque')), 'C1 hors sneakers : ni « Taille absente » ni « Marque absente », sur aucun site');
    ok(sites.every((s) => !codes({ ...livre, famille: 'vetements', facultatifs: true }, s).some((c) => c === 'taille' || c === 'marque')), 'C2 un vêtement sans taille ni marque (Autre) : rien à dire');
    const sn = { titre: 'Nike Air Max 1', taille: '', famille: 'chaussures', marque: '', nPhotos: 4, prix: 80, achat: 40 };
    ok(codes(sn, 'lbc').includes('taille') && codes(sn, 'lbc').includes('marque'), 'C3 un vendeur de sneakers garde « Taille absente » et « Marque absente »');
    const nl = V.champsNonJuges({ titre: 'x', prix: 3, nPhotos: 3, descLen: 30, couleur: 'bleu', etat: 'bon', categorie: 'Livres', facultatifs: true }, 'vinted');
    ok(!nl.includes('la taille') && !nl.includes('la marque'), 'C4 hors sneakers : taille et marque ne sont pas « à vérifier »', nl.join(', '));
  }
  const ecrans = ['src/ecrans/Ebay.jsx', 'src/ecrans/Leboncoin.jsx', 'src/ecrans/Vestiaire.jsx'].map((f) => [f, lire(f) || '']);
  const appels = [];
  for (const [f, s] of [['src/App.jsx', app], ...ecrans]) {
    const re = /problemesAnnonce\(([^;]*?)\}, '(?:lbc|ebay|vestiaire|vinted)'\)/g; let m;
    while ((m = re.exec(sansCommentaires(s)))) appels.push([f, /facultatifs/.test(m[1]) || /verifV/.test(m[1])]);
    if (/problemesAnnonce\(verifV, 'vinted'\)/.test(s)) appels.push([f, /const verifV = \{ \.\.\.\(a\.verif \|\| \{\}\), facultatifs: champsFacultatifs\(vendActuel\(\)\) \}/.test(s)]);
  }
  ok(appels.length >= 4 && appels.every(([, o]) => o), 'C5 chaque vérification de publication de l’app passe `facultatifs`', appels.filter(([, o]) => !o).map(([f]) => f).join(', ') || `${appels.length} appels`);
  ok(/manquesEnvoi\(sx, apercu, \{[\s\S]{0,200}?facultatifs: champsFacultatifs\(vendActuel\(\)\)/.test(app) && /facultatifs: facultatifs === true \}, SITE_VERIF\[site\]/.test(T.publier || ''), 'C6 « Publier ailleurs » (manquesEnvoi) passe `facultatifs`');
  if (P) {
    const m = P.motsArticle('autre');
    ok(Object.values(m).every((x) => !/paire/i.test(x)) && /paire/.test(P.motsArticle('sneakers').nom), 'C7 les mots « article » ne disent jamais « paire » ; Julien garde « paire »');
    ok(P.jeVendsEffectif(null, { proprietaire: true }).vend === 'sneakers' && P.jeVendsEffectif(null, { proprietaire: false }).vend === 'autre' && P.jeVendsEffectif({ choix: 'sneakers' }, { proprietaire: false }).vend === 'sneakers', 'C8 « Je vends » : Sneakers pour Julien par défaut, Autre sinon, son choix gagne');
  }
  // ── D ────────────────────────────────────────────────────────────────────
  if (N && typeof N.phraseOuExtension === 'function') {
    const f = N.phraseOuExtension;
    ok(!/ordinateur/.test(f('ios-orion', { orionPublie: true })) && !/ordinateur/.test(f('firefox-android', { firefoxPublie: true })), 'D1 Orion (iPhone) et Firefox (Android) : jamais « ordinateur »');
    ok(!/ordinateur/.test(f('autre')), 'D2 sur un ordinateur : « dans ce navigateur »');
    ok(/ordinateur/.test(f('ios', {})) && /Orion/.test(f('ios', { orionPublie: true })) && !/Orion/.test(f('ios', { orionPublie: false })), 'D3 Safari sur iPhone : « ordinateur », et Orion seulement si sa fiche est publiée');
  } else ok(false, 'D1 la règle « où vit l’extension » existe');
  const toutSrc = [app, T.guide || '', T.bienvenue || '', ...ecrans.map(([, s]) => s)].map(sansCommentaires).join('\n');
  const fausses = ['installe l’extension VRM sur ton ordinateur', "Installer l'extension sur ton ordinateur et", 'Elle vit sur ton ordinateur', "Ouvre l'annonce sur Vinted, sur ton ordinateur", "à relier depuis ton ordinateur", "l'extension, sur ton ordinateur,", 'Ouvre l\'annonce Vinted une fois sur ton ordinateur'];
  const restent = fausses.filter((x) => toutSrc.includes(x));
  ok(restent.length === 0, 'D4 le parcours iPhone ne dit plus « ordinateur » là où l’extension peut être sur le téléphone', restent.join(' | '));
  ok(/pont\.telephone && !pont\.ici/.test(T.guide || '') && /ici: \['ios-orion', 'firefox-android'\]\.includes\(mobileIci\(\)\)/.test(app), 'D5 « Vérifier mon installation » : sur Orion, l’extension s’installe ICI (pas « sur ton ordinateur »)');
  // ── E ────────────────────────────────────────────────────────────────────
  const reg = T.reglages || '';
  const i = reg.indexOf('if (lu.nonInstalle) return (');
  const bloc = i >= 0 ? reg.slice(i, reg.indexOf(');', i)) : '';
  ok(/EQUIPE_NON_INSTALLE_TXT/.test(bloc) && /CE_QUE_VOIT_UN_MEMBRE/.test(bloc) && /data-equipe-attente-geste/.test(bloc) && !/data-equipe-inviter/.test(bloc), 'E1 sans la 016 : la phrase, ce que verra l’aide, qui fait le geste — aucun « Inviter »');
}

function textes(racine) {
  const l = (rel) => { try { return fs.readFileSync(path.join(racine, rel), 'utf8'); } catch (_) { return null; } };
  let app = ''; try { app = sourceApp(racine); } catch (_) { app = l('src/App.jsx') || ''; }
  return { app, profil: l('src/profilVendeur.js'), verif: l('src/verifAnnonce.js'), nav: l('src/navigateurExtension.js'), servis: l('src/navigateursServis.js'), guide: l('src/guideDemarrage.js'), bienvenue: l('src/Bienvenue.jsx'), reglages: l('src/ecrans/Reglages.jsx'), publier: l('src/publierAilleurs.js') };
}

async function lancer(T, muet) {
  let rouges = 0;
  const ok = (c, nom, detail) => { if (!c) rouges += 1; if (!muet) console.log(`${c ? '✅' : '❌'} ${nom}${!c && detail ? ` — ${detail}` : ''}`); };
  await controles(T, ok);
  return rouges;
}

const MUTATIONS = {
  proprio_simple: ['profil', (s) => s.replace("if (proprietaire !== false) return 'complet';", "if (proprietaire === true) return 'complet';")],
  pas_su_simple: ['profil', (s) => s.replace("if (typeof nVentes30j !== 'number' || !Number.isFinite(nVentes30j)) return 'complet';", "if (typeof nVentes30j !== 'number' || !Number.isFinite(nVentes30j)) return 'simple';")],
  seuil_50: ['profil', (s) => s.replace('export const SEUIL_VENTES_SIMPLE = 30;', 'export const SEUIL_VENTES_SIMPLE = 50;')],
  stock_cache_pas_su: ['profil', (s) => s.replace('if (u) return usage[u] !== false;', 'if (u) return usage[u] === true;')],
  journee_tout_cache: ['profil', (s) => s.replace("export const CASES_JOURNEE_CONSEIL = ['prix'];", "export const CASES_JOURNEE_CONSEIL = ['prix', 'messages'];")],
  compteur_tu: ['app', (s) => s.replace('<div hidden>{T.filter((x) => !cases.includes(x)).map(', '<div hidden>{T.filter((x) => !cases.includes(x) && caseJourneeMontree(x.id, PROFIL_VENDEUR.mode)).map(')],
  total_filtre: ['app', (s) => s.replace('<VentesToutes sites={sitesPresents}', '<VentesToutes sites={new Set([...sitesPresents].filter((x) => siteMontre(x, { mode: PROFIL_VENDEUR.mode, relies: PROFIL_VENDEUR.relies })))}')],
  facultatif_ignore: ['verif', (s) => s.replace('const fac = x.facultatifs === true;', 'const fac = false;')],
  non_lu_marque: ['verif', (s) => s.replace("if ((k === 'taille' || k === 'marque') && x.facultatifs === true) return false;", "if (k === 'taille' && x.facultatifs === true) return false;")],
  appel_oublie: ['app', (s) => s.replace(', facultatifs: champsFacultatifs(vendActuel()) }), etat: etats[sx]', ' }), etat: etats[sx]')],
  mot_paire: ['profil', (s) => s.replace("noms: 'articles', un: 'un article'", "noms: 'paires', un: 'un article'")],
  orion_ordinateur: ['nav', (s) => s.replace("if (mobile === 'ios-orion') return 'dans Orion, sur cet iPhone';", "if (mobile === 'ios-orion') return 'sur ton ordinateur';")],
  phrase_revient: ['guide', (s) => s.replace("'Elle vit dans un autre navigateur : tes comptes arrivent bien.'", "'Elle vit sur ton ordinateur : tes comptes arrivent bien.'")],
  equipe_muet: ['reglages', (s) => s.replace('<div data-equipe-ce-qui-viendra="" style={{ color: C.muted, marginTop: 8 }}>{CE_QUE_VOIT_UN_MEMBRE}</div>', '')],
};

(async () => {
  const T = textes(RAC);
  const r = await lancer(T, false);
  console.log(r ? `\n❌ vendeurs différents : ${r} rouge(s)` : '\n✅ vendeurs différents : tout est vert');
  if (!PROUVE) { process.exitCode = r ? 1 : 0; return; }
  if (r) { process.exitCode = 1; return; }
  let pris = 0, n = 0;
  for (const [nom, [cle, f]] of Object.entries(MUTATIONS)) {
    n += 1;
    const t2 = { ...T, [cle]: f(T[cle] || '') };
    if (t2[cle] === T[cle]) { console.log(`❌ ${nom} : la mutation ne s'applique plus`); continue; }
    const rr = await lancer(t2, true);
    if (rr > 0) { pris += 1; console.log(`✅ mutation ${nom} : ${rr} rouge(s)`); } else console.log(`❌ mutation ${nom} : RIEN n'a vu`);
  }
  console.log(`\n${pris}/${n} mutations attrapées`);
  process.exitCode = pris === n ? 0 : 1;
})();
