// Audit : VÉRIFIER UNE ANNONCE AVANT DE LA PUBLIER (3 nov., choisie par Julien).
//
//   A. la règle PURE (src/verifAnnonce.js), EXÉCUTÉE : chaque problème est
//      détecté (moins de 3 photos, taille absente, prix sous le prix d'achat
//      CONNU, titre trop long pour le site — 50 Leboncoin · 80 eBay · 100 Vinted,
//      les limites du code existant —, marque absente, catégorie absente), une
//      ligne chacun avec son geste ; rien à dire sur une annonce propre ; un
//      champ non lu (`undefined`) ou un prix d'achat inconnu n'est pas jugé ; un
//      sac n'a pas de taille ; Vestiaire n'a pas de limite de titre connue ;
//      aucun montant écrit autre que le prix et le prix d'achat (aucun prix
//      conseillé — refusé le 11 oct.) ;
//   B. l'app (src/App.jsx) : les QUATRE gestes — « Publier sur Leboncoin »
//      (la fiche), « Publier sur eBay » (les deux chemins), « Préparer sur
//      Vestiaire », « Republier » (le lancement) — passent par
//      `verifierAvantPublication` avec la règle du BON site AVANT tout envoi, et
//      la feuille a « Publier quand même » (true) et « Corriger » (false).
// `--prouve` : chaque règle réaffaiblie doit passer au rouge.
const fs = require('fs'), path = require('path'), os = require('os');
const RAC = path.join(__dirname, '..');
const SRC = path.join(RAC, 'src', 'verifAnnonce.js');
const APP = path.join(RAC, 'src', 'App.jsx');

const MUTATIONS = {
  photos_min_1: (s) => s.replace('export const PHOTOS_MIN = 3;', 'export const PHOTOS_MIN = 1;'),
  sac_avec_taille: (s) => s.replace("!SANS_TAILLE.has(String(x.famille || '')) && ", ''),
  prix_egal: (s) => s.replace('p < ac) pose', 'p <= ac + 5) pose'),
  achat_devine: (s) => s.replace('const p = num(x.prix), ac = num(x.achat);', 'const p = num(x.prix), ac = num(x.achat) ?? (p != null ? p + 1 : null);'),
  lbc_80: (s) => s.replace('lbc: 50, ebay: 80', 'lbc: 80, ebay: 80'),
  vinted_sans_limite: (s) => s.replace(', vinted: 100 }', ' }'),
  sans_marque: (s) => s.replace("if (x.marque !== undefined && vide(x.marque)) pose('marque', 'Marque absente');", ''),
  sans_categorie: (s) => s.replace("if (x.categorie !== undefined && vide(x.categorie)) pose('categorie', 'Catégorie absente');", ''),
  non_lu_juge: (s) => s.replace("if (x.taille !== undefined && ", "if (").replace("if (x.nPhotos !== undefined) {", "{"),
  prix_conseille: (s) => s.replace("pose('prix', `Prix ${eur(p)} sous ton prix d’achat ${eur(ac)}`);", "pose('prix', `Prix ${eur(p)} sous ton prix d’achat ${eur(ac)} — mets ${eur(Math.ceil(ac * 1.3))}`);"),
  sans_geste: (s) => s.replace('out.push({ code, texte, geste: g[code] });', 'out.push({ code, texte, geste: \'\' });'),
};

async function charger(src) {
  const f = path.join(os.tmpdir(), `verifAnnonce-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(f, src);
  try { return await import(f); } finally { try { fs.unlinkSync(f); } catch (_) {} }
}
const PROPRE = { titre: 'Nike Air Max 1 blanc taille 42', taille: '42', famille: 'chaussures', marque: 'Nike', categorie: 'Chaussures', nPhotos: 5, prix: 80, achat: 40 };

async function regle(src, ok) {
  let M;
  try { M = await charger(src); } catch (e) { ok(false, 'le module se charge', e.message); return; }
  const P = M.problemesAnnonce, L = M.problemesLot;
  ok(typeof P === 'function' && typeof L === 'function', 'A0 problemesAnnonce et problemesLot existent');
  if (typeof P !== 'function' || typeof L !== 'function') return;
  const codes = (a, site) => P(a, site).map((x) => x.code);
  for (const site of ['lbc', 'ebay', 'vestiaire', 'vinted']) ok(P(PROPRE, site).length === 0, `A1 annonce propre sur ${site} : rien à dire`, JSON.stringify(P(PROPRE, site)));
  ok(codes({ ...PROPRE, nPhotos: 2 }, 'lbc').join() === 'photos', 'A2 deux photos ⇒ « photos »');
  ok(codes({ ...PROPRE, nPhotos: 0 }, 'ebay').join() === 'photos' && /Aucune photo/.test((P({ ...PROPRE, nPhotos: 0 }, 'ebay')[0] || {}).texte), 'A2b aucune photo ⇒ « Aucune photo »');
  ok(codes({ ...PROPRE, nPhotos: 3 }, 'lbc').length === 0, 'A2c trois photos suffisent');
  ok(codes({ ...PROPRE, taille: '' }, 'lbc').join() === 'taille', 'A3 taille absente');
  ok(codes({ ...PROPRE, taille: '', famille: 'sacs' }, 'lbc').length === 0, 'A3b un sac n’a pas de taille : rien à dire');
  ok(codes({ ...PROPRE, prix: 39 }, 'vinted').join() === 'prix', 'A4 prix sous le prix d’achat connu');
  ok(codes({ ...PROPRE, prix: 40 }, 'vinted').length === 0, 'A4b prix = prix d’achat : pas « sous »');
  ok(codes({ ...PROPRE, prix: 10, achat: null }, 'vinted').length === 0 && codes({ ...PROPRE, prix: 10, achat: undefined }, 'lbc').length === 0, 'A4c prix d’achat inconnu ⇒ pas jugé (jamais deviné)');
  const t51 = 'x'.repeat(51), t81 = 'x'.repeat(81), t101 = 'x'.repeat(101);
  ok(codes({ ...PROPRE, titre: t51 }, 'lbc').join() === 'titre' && codes({ ...PROPRE, titre: 'x'.repeat(50) }, 'lbc').length === 0, 'A5 Leboncoin : 51 caractères trop long, 50 passe');
  ok(codes({ ...PROPRE, titre: t81 }, 'ebay').join() === 'titre' && codes({ ...PROPRE, titre: t51 }, 'ebay').length === 0, 'A5b eBay : 81 trop long, 51 passe');
  ok(codes({ ...PROPRE, titre: t101 }, 'vinted').join() === 'titre' && codes({ ...PROPRE, titre: t81 }, 'vinted').length === 0, 'A5c Vinted : 101 trop long, 81 passe');
  ok(codes({ ...PROPRE, titre: t101 }, 'vestiaire').length === 0, 'A5d Vestiaire : aucune limite connue ⇒ pas jugé');
  ok(/51\/50/.test((P({ ...PROPRE, titre: t51 }, 'lbc')[0] || {}).texte), 'A5e la ligne dit la longueur et la limite (51/50)');
  ok(codes({ ...PROPRE, marque: '' }, 'lbc').join() === 'marque', 'A6 marque absente');
  ok(codes({ ...PROPRE, categorie: '' }, 'ebay').join() === 'categorie', 'A7 catégorie absente');
  ok(codes({ titre: 'x', prix: 10 }, 'lbc').length === 0, 'A8 ce qui n’est pas lu (undefined) n’est pas jugé');
  const tout = P({ titre: t51, taille: '', famille: '', marque: '', categorie: '', nPhotos: 1, prix: 30, achat: 45 }, 'lbc');
  ok(tout.map((x) => x.code).join() === 'photos,taille,prix,titre,marque,categorie', 'A9 tous les problèmes, une ligne chacun, le plus bloquant d’abord', tout.map((x) => x.code).join());
  ok(tout.every((x) => typeof x.geste === 'string' && x.geste.length > 8 && x.texte.length > 3), 'A10 chaque ligne porte son geste');
  const montants = tout.map((x) => x.texte + ' ' + x.geste).join(' ').match(/\d+(?:,\d+)?\s?€/g) || [];
  ok(montants.length === 2 && montants.some((m) => /^30\s?€/.test(m)) && montants.some((m) => /^45\s?€/.test(m)), 'A11 aucun prix conseillé : seuls le prix et le prix d’achat sont écrits', JSON.stringify(montants));
  const lot = L([{ ...PROPRE, numero: '12', nPhotos: 1 }, { ...PROPRE, numero: '13' }, { ...PROPRE, titre: 'Sac', marque: '' }], 'vinted');
  ok(lot.length === 2 && lot[1] && lot[0].qui === 'N°12' && lot[0].code === 'photos' && lot[1].qui === 'Sac' && lot[1].code === 'marque', 'A12 Republier : une ligne par problème, préfixée du N° (ou du titre)', JSON.stringify(lot));
}

function app(ok) {
  const s = fs.readFileSync(APP, 'utf8').replace(/\/\/[^\n]*/g, '');
  const entre = (a, b) => { const i = s.indexOf(a); const j = i < 0 ? -1 : s.indexOf(b, i); return i < 0 || j < 0 ? '' : s.slice(i, j); };
  // Leboncoin : la fiche.
  const lbc = entre('const publier = async (confirme) => {', 'const basculerPhoto');
  ok(/await verifierAvantPublication\(problemesAnnonce\(\{[^]*?\}, 'lbc'\)/.test(lbc) && lbc.indexOf('verifierAvantPublication') < lbc.indexOf('await envoyer('), 'B1 « Publier sur Leboncoin » vérifie (règle Leboncoin) AVANT l’envoi');
  ok(/achat: q\.achat/.test(lbc) && /achat: \(\(\) => \{ try \{ return prixAchatDe\(e, load\('vinted_buyprice_by_num'/.test(s), 'B1b le prix d’achat est celui de la fiche du N° (prixAchatDe), jamais deviné');
  // eBay : les deux chemins.
  const ebP = entre('const publier = async (opts = {}) => {', 'const lab = {');
  ok(/verifierAvantPublication\(verifEbay\(b\.item\), \{ site: 'ebay' \}\)/.test(ebP) && ebP.indexOf('verifierAvantPublication') < ebP.indexOf("action: 'publish'"), 'B2 « Publier sur eBay » vérifie AVANT la publication');
  const ebA = entre('setAutoPub({ id: autoPub.id, etape: \'verif\' });', 'const publier = async (opts = {}) => {');
  ok(ebA.indexOf('verifierAvantPublication(verifEbay(b.item)') > 0 && ebA.indexOf('verifierAvantPublication') < ebA.indexOf("action: 'pubverify'") && /publier\(\{ dejaConfirme: true, verifie: true \}\)/.test(ebA), 'B2b publier en un clic vérifie aussi, une seule fois');
  ok(/problemesAnnonce\(\{[^]*?\}, 'ebay'\)/.test(entre('const verifEbay = (item) => {', 'const [autoPub')), 'B2c avec la règle eBay');
  // Vestiaire.
  const vc = entre('const preparer = async (p) => {', 'const marquer = async (p) => {');
  ok(/verifierAvantPublication\(problemesAnnonce\(\{[^]*?\}, 'vestiaire'\)/.test(vc) && vc.indexOf('verifierAvantPublication') < vc.indexOf("cmd: 'vcPreparer'"), 'B3 « Préparer sur Vestiaire » vérifie AVANT l’envoi');
  // Republier.
  const rp = entre('const lancerFile = async () => {', 'const idAnnoncee');
  ok(/verifierAvantPublication\(problemesLot\(lot, 'vinted'\)/.test(rp) && rp.indexOf('verifierAvantPublication') < rp.indexOf("setMode('run')"), 'B4 « Republier » vérifie le lot AVANT de lancer');
  ok(/titre: x\.titre \|\| a\.titre, prix: x\.prix != null \? x\.prix : a\.prix, achat: a\.floor/.test(rp), 'B4b Republier juge le titre et le prix QUI PARTIRONT (l’aperçu), contre le prix d’achat');
  // La feuille.
  const f = entre("if (q.kind === 'verif') return createPortal(", '</SheetShell>, document.body);');
  ok(/data-verif-publier="" onClick=\{\(\) => close\(true\)\}/.test(f) && /data-verif-corriger="" onClick=\{\(\) => close\(false\)\}/.test(f) && /Publier quand même/.test(f), 'B5 la feuille : « Publier quand même » continue, « Corriger » arrête');
  ok(/if \(!Array\.isArray\(lignes\) \|\| !lignes\.length\) return true;/.test(s), 'B6 rien à dire ⇒ aucune feuille, l’envoi part');
}

async function audit(src, bavard) {
  let ko = 0;
  const ok = (c, m, d) => { if (!c) ko++; if (bavard) console.log(`${c ? '✅' : '❌'} ${m}${!c && d != null ? ` — ${d}` : ''}`); };
  try { await regle(src, ok); } catch (e) { ok(false, 'la règle a tourné', e.message); }
  if (bavard) app(ok);
  return ko;
}

(async () => {
  const src = fs.existsSync(SRC) ? fs.readFileSync(SRC, 'utf8') : '';
  if (process.argv.includes('--prouve')) {
    let rouges = 0;
    for (const [nom, f] of Object.entries(MUTATIONS)) {
      const m = f(src);
      if (m === src) { console.log(`❌ ${nom} : la mutation ne s'applique plus`); continue; }
      const k = await audit(m, false);
      console.log(`${k ? '✅' : '❌'} mutation ${nom} : ${k} rouge(s)`);
      if (k) rouges++;
    }
    const n = Object.keys(MUTATIONS).length;
    console.log(`\n${rouges}/${n} mutations attrapées`);
    process.exit(rouges === n ? 0 : 1);
  }
  const ko = await audit(src, true);
  console.log(ko ? `\n❌ ${ko} échec(s)` : '\n✅ vérifier avant de publier : tout est vert');
  process.exit(ko ? 1 : 0);
})();
