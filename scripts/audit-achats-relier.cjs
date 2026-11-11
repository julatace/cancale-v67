// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : ACHATS (lot DJ5, 11 nov.) — CHOISIR UN AUTRE ACHAT, REÇU OUVERT,
//         « NOUVEL ACHAT » HORS PLATEFORME, ICÔNES ANNONCES ET MA JOURNÉE
//         node scripts/audit-achats-relier.cjs [--prouve]
// EXÉCUTE src/relierAutreAchat.js et src/suggestionsAchat.js, puis lit l'app.
//  1. 50 achats au MÊME titre, même prix, même date : « Déjà relié à N°… » ne se
//     lit que par `buyFromId` (le n° de transaction) — jamais par le titre ; les
//     libres et les déjà reliés passent les mêmes filtres et ne se mêlent jamais ;
//  2. « Délier » retire le lien et le prix posé PAR lui ; un prix retapé reste ;
//     « Déplacer ici » délie les AUTRES détenteurs, jamais la cible ;
//  3. l'app : « Choisir un autre achat » / « Autre achat » à côté de CHAQUE
//     proposition (file « Sans achat relié », coût d'une vente, numérotage, saisie
//     en série) ; la feuille ouverte ainsi part sur la recherche ;
//  4. « Reçu » d'un achat relié (fiche d'annonce, récapitulatif de vente) OUVRE
//     (feuille du reçu e-mail, sinon visionneuse PDF) — aucun téléchargement direct ;
//  5. « Nouvel achat » : la photo d'abord, le N° proposé posé par SON toucher et
//     réservé dans le pool (append-only) ; rien de pré-rempli dans le prix ;
//  6. icônes : Ma journée = soleilLevant, Annonces = vitrine, dans ICON_PATHS.
// `AUDIT_RACINE=<dossier>` : juger un autre arbre (code d'avant / mutation).
// `--prouve` : rejoue l'audit sur des copies MUTÉES (chacune doit rougir).
// ═══════════════════════════════════════════════════════════════════════════
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const RACINE = process.env.AUDIT_RACINE || path.join(__dirname, '..');
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (!c && d != null && d !== '' ? ' — ' + d : '')); };
const lire = (rel) => { try { return fs.readFileSync(path.join(RACINE, rel), 'utf8'); } catch (_) { return ''; } };
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

async function auditer() {
  let R = null, S = null;
  try { R = await import(path.join(RACINE, 'src', 'relierAutreAchat.js')); } catch (e) { dit(false, '1 · src/relierAutreAchat.js existe et se charge', String(e && e.message).slice(0, 120)); }
  try { S = await import(path.join(RACINE, 'src', 'suggestionsAchat.js')); } catch (e) { dit(false, '1 · src/suggestionsAchat.js se charge', String(e && e.message).slice(0, 120)); }
  const TITRE = 'Adidas Spezial noir 42';
  const achats = Array.from({ length: 50 }, (_, i) => ({ transaction_id: String(91000001 + i), title: TITRE, price: { amount: '40.00', currency_code: 'EUR' }, date: '2026-10-01T10:00:00Z', status: 'Commande finalisée' }));
  const numeros = { a1: { numero: '6', title: TITRE, buyFromId: '91000037', buyPrice: '40', buyFrom: { price: 40 } }, a2: { numero: '7', title: TITRE }, a3: { numero: '8', title: TITRE, buyPrice: '40' } };
  const saleOv = { 95000001: { buyFromId: '91000012', buyPrice: '55', buyFrom: { price: 40 } } };
  if (R && S) {
    // 1
    const d37 = R.detenteursAchat('91000037', { numeros, saleOv });
    dit(d37.length === 1 && d37[0].cle === 'a1' && R.texteDejaRelie(d37) === 'Déjà relié à N°6', '1 · « Déjà relié à N°6 » : par le n° de transaction seul', JSON.stringify(d37));
    const autres = achats.filter((a) => a.transaction_id !== '91000037' && a.transaction_id !== '91000012').map((a) => R.detenteursAchat(a.transaction_id, { numeros, saleOv }).length);
    dit(autres.every((n) => n === 0), '1 · 48 achats au MÊME titre que la paire N°6 : aucun n’est « déjà relié » (le titre n’entre pas)', autres.filter((n) => n).length + ' rattachés par erreur');
    dit(R.texteDejaRelie(R.detenteursAchat('91000012', { numeros, saleOv })) === 'Déjà relié à une vente', '1 · une vente sans N° est dite « une vente »');
    const liens = S.liensParAchat(numeros, saleOv);
    const det = S.tousAchatsLibresDetail({ achats, liens, q: 'spezial' });
    const libres = det.liste.map((a) => a.transaction_id), pris = (det.pris || []).map((a) => a.transaction_id);
    dit(libres.length === 48 && pris.length === 2 && pris.includes('91000037') && pris.includes('91000012') && !libres.some((t) => pris.includes(t)), '1 · recherche : 48 libres, 2 déjà reliés, jamais mêlés', JSON.stringify({ l: libres.length, p: pris }));
    const det2 = S.tousAchatsLibresDetail({ achats, liens, curTx: '91000037' });
    dit(det2.liste.some((a) => a.transaction_id === '91000037') && !(det2.pris || []).some((a) => a.transaction_id === '91000037'), '1 · l’achat déjà relié à CET article reste libre pour lui');
    // 2
    dit(JSON.stringify(R.patchDelier(numeros.a1)) === '{"buyFromId":null,"buyFrom":null,"buyPrice":""}', '2 · « Délier » : le lien et le prix posé par lui partent', JSON.stringify(R.patchDelier(numeros.a1)));
    dit(JSON.stringify(R.patchDelier(saleOv[95000001])) === '{"buyFromId":null,"buyFrom":null}', '2 · un prix retapé (55 ≠ 40) reste après « Délier »', JSON.stringify(R.patchDelier(saleOv[95000001])));
    dit(R.patchDelier(numeros.a3) === null, '2 · une fiche sans lien : rien à délier');
    const dep = R.ecrituresDeplacer(achats[36], { numeros: { ...numeros, a2: { ...numeros.a2, buyFromId: '91000037' } }, saleOv, ici: { ou: 'fiche', cle: 'a2' } });
    dit(dep.length === 1 && dep[0].cle === 'a1' && dep[0].patch.buyFromId === null, '2 · « Déplacer ici » délie l’autre détenteur, jamais la cible', JSON.stringify(dep.map((x) => x.cle)));
  }
  // 3
  const app = require('./_source-app.cjs').enFrancais(lire('src/App.jsx'), RACINE), appS = sansCommentaires(app);   // (11 nov.) le texte français recollé (tr() ⇒ sa phrase)
  const ach = sansCommentaires(lire('src/ecrans/Achats.jsx'));
  const ar = (/function AchatsARelier\([\s\S]*?\n}\n/.exec(appS) || [''])[0];
  dit(/data-ar-autre=/.test(ar) && /onChoisir\(it, l\.sugg\.achat\)/.test(ar), '3 · « Sans achat relié » : « Autre achat » à côté de la suggestion');
  const cv = (/function CoutAchatVente\([\s\S]*?\n}\n/.exec(appS) || [''])[0];
  dit(/data-cout-vente-autre/.test(cv) && /Choisir un autre achat/.test(cv), '3 · coût d’une vente : avec une proposition, « Choisir un autre achat »');
  dit(/data-num-neuf-autre=/.test(appS) && /data-ask-autre=/.test(appS) && /rep\.autre && sugg/.test(appS), '3 · numérotage : « Autre achat » (bloc des nouveaux et question du prix)');
  dit(/data-prix-autre-achat=/.test(appS), '3 · saisie en série : « Choisir un autre achat » à côté du prix proposé');
  const rc = (/function RelierAchatCorps\([\s\S]*?\n}\n/.exec(ach) || [''])[0];
  dit(/useState\(!!autre\)/.test(rc) && /!autre && sugg\.length/.test(rc), '3 · la feuille ouverte par « autre » part sur la recherche, sans suggestion');
  dit(/data-relier-delier/.test(rc) && /data-relier-deplacer/.test(rc) && /data-achat-pris/.test(rc), '3 · la feuille : « Délier », « Déjà reliés » et « Déplacer ici »');
  dit(/onRelier\(a\)/.test(rc) && !/title\b[^\n]{0,40}===/.test(rc), '3 · « Relier » passe l’achat de la LIGNE (son n°), aucun test de titre');
  // 4
  const ar2 = (/const AchatRelie = \(\{ entry, numero \}\) => \{[\s\S]*?\n  \};/.exec(appS) || [''])[0];
  dit(/ouvrirRecuRelie\(a, numero\)/.test(ar2) && !/generateAchatJustificatif\(/.test(ar2), '4 · fiche d’annonce : « Reçu » ouvre (plus de téléchargement direct)');
  const recap = (appS.match(/data-recu-relie=\{String\(aRelie[^\n]*/) || [''])[0];
  dit(/ouvrirRecuRelie\(aRelie, num\)/.test(recap) && !/generateAchatJustificatif\(/.test(recap), '4 · récapitulatif de vente : « Reçu d’achat » ouvre');
  const ouvrir = (/const ouvrirRecuRelie = async[\s\S]*?\n  \};/.exec(appS) || [''])[0];
  dit(/setReceiptView\(rc\)/.test(ouvrir) && /ouvrir: true/.test(ouvrir) && /recuDeLAchat\(/.test(ouvrir), '4 · reçu e-mail (par son n°) ⇒ la feuille d’Achats ; sinon l’attestation dans la visionneuse');
  const gen = (/const generateAchatJustificatif = async[\s\S]*?\n};/.exec(appS) || [''])[0];
  dit(/if \(opts\.ouvrir\) \{ _poserVisionneuse\(/.test(gen) && gen.indexOf('opts.ouvrir') < gen.indexOf('a.download'), '4 · `ouvrir` : la visionneuse PDF AVANT tout lien de téléchargement');
  // 5
  const form = (/function AchatsHorsPlateforme\([\s\S]*?\n}\n/.exec(ach) || [''])[0];
  const iPh = form.indexOf('data-achat-hors-photo'), iTi = form.indexOf('data-champ="titre"'), iPx = form.indexOf('data-champ="prix"'), iOu = form.indexOf('data-champ="lieu"'), iDa = form.indexOf('data-champ="date"'), iNu = form.indexOf('data-champ="numero"');
  dit(iPh > 0 && iPh < iTi && iTi < iPx && iPx < iOu && iOu < iDa && iDa < iNu, '5 · « Nouvel achat » : photo, nom, prix, où, date, N° (dans cet ordre)', JSON.stringify([iPh, iTi, iPx, iOu, iDa, iNu]));
  dit(/data-achat-hors-num-propose/.test(form) && /onClick=\{\(\) => setForm\(d => \(\{ \.\.\.d, numero: numPropose \}\)\)\}/.test(form) && !/numero: numPropose[^}]*BROUILLON0/.test(form) && /BROUILLON0 = \(\) => \(\{[^}]*numero: ''/.test(form), '5 · le N° proposé n’est posé que par SON toucher (brouillon vide)');
  dit(/rec\.numero === String\(prochainNumero\) && onReserverNumero/.test(form) && /onReserverNumero=\{recordUsed\}/.test(appS), '5 · le N° proposé pris est réservé dans le pool (recordUsed, append-only)');
  dit(/BROUILLON0 = \(\) => \(\{[^}]*price: ''/.test(form), '5 · le prix n’est jamais pré-rempli (§2.5)');
  // 6
  const bloc = (/const ICON_PATHS = \{([\s\S]*?)\n\};/.exec(app) || ['', ''])[1];
  dit(/\n  vitrine:\s*<>/.test(bloc) && /\n  soleilLevant:\s*<>/.test(bloc), '6 · ICON_PATHS dessine « vitrine » et « soleilLevant »');
  dit(/\{id:'journee',\s*icon:'soleilLevant'/.test(appS) && /\{id:'annonces',\s*icon:'vitrine'/.test(appS), '6 · la navigation : Ma journée = soleil levant, Annonces = vitrine');
}

const MUTATIONS = [
  ['déjà relié par le TITRE', 'src/relierAutreAchat.js', "if (e && e.buyFromId != null && String(e.buyFromId) === t) out.push({ ou: 'fiche'", "if (e && (String(e.buyFromId) === t || e.title === 'Adidas Spezial noir 42')) out.push({ ou: 'fiche'"],
  ['délier garde le lien', 'src/relierAutreAchat.js', 'return { buyFromId: null, buyFrom: null,', 'return { buyFrom: null,'],
  ['délier efface un prix retapé', 'src/relierAutreAchat.js', 'const prixDuLien = prix == null || (pose != null && Math.abs(prix - pose) < 0.005);', 'const prixDuLien = true;'],
  ['déplacer délie aussi la cible', 'src/relierAutreAchat.js', 'if (ici && ici.ou === d.ou && String(ici.cle) === d.cle) continue;', ''],
  ['déjà reliés mêlés aux libres', 'src/suggestionsAchat.js', '(libre ? out : pris).push(', 'out.push('],
  ['pas d’« Autre achat » dans la file', 'src/App.jsx', 'data-ar-autre={String(l.sugg.achat.transaction_id)}', 'data-ar-x={String(l.sugg.achat.transaction_id)}'],
  ['le reçu se télécharge encore', 'src/App.jsx', "onClick={()=>ouvrirRecuRelie(a, numero)}", "onClick={()=>generateAchatJustificatif(a,{ numero })}"],
  ['N° proposé pré-rempli', 'src/ecrans/Achats.jsx', "const BROUILLON0 = () => ({ title: '', price: '', date: dateLocaleISO(), source: '', numero: ''", "const BROUILLON0 = () => ({ title: '', price: '', date: dateLocaleISO(), source: '', numero: String(prochainNumero || '')"],
  ['ancienne icône d’Annonces', 'src/App.jsx', "{id:'annonces', icon:'vitrine'", "{id:'annonces', icon:'grid'"],
];

(async () => {
  if (process.argv.includes('--prouve')) {
    let rouges = 0;
    for (const [nom, fic, avant, apres] of MUTATIONS) {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-dj5-'));
      fs.cpSync(path.join(RACINE, 'src'), path.join(tmp, 'src'), { recursive: true });
      const f = path.join(tmp, fic), t = fs.readFileSync(f, 'utf8');
      if (!t.includes(avant)) { console.log(`❌ mutation « ${nom} » : texte introuvable`); ko++; continue; }
      fs.writeFileSync(f, t.replace(avant, apres));
      let rouge = false;
      try { execFileSync(process.execPath, [__filename], { env: { ...process.env, AUDIT_RACINE: tmp }, stdio: 'pipe' }); } catch (_) { rouge = true; }
      fs.rmSync(tmp, { recursive: true, force: true });
      console.log(`${rouge ? '✅' : '❌'} mutation « ${nom} » ⇒ ${rouge ? 'ROUGE' : 'reste vert'}`);
      if (rouge) rouges++; else ko++;
    }
    console.log(`\n${rouges}/${MUTATIONS.length} mutations rouges`);
    process.exit(ko ? 1 : 0);
  }
  await auditer();
  console.log(ko ? `\n❌ ${ko} contrôle(s) au rouge` : '\n✅ Achats (DJ5) : autre achat, reçu ouvert, nouvel achat, icônes');
  process.exit(ko ? 1 : 0);
})();
