#!/usr/bin/env node
// AUDIT (14 nov., soir) — « JE N'AI PLUS LES RETRAITS D'ACHAT » : le repli « À retirer » d'Achats.
// Mesuré sur sa base (lecture seule) : la règle comptait 3 colis à retirer, chacun avec son code ; la refonte d'Achats
// du même jour les rangeait dans un repli FERMÉ par défaut, sans ligne sur Achats · Vinted. §5 : un colis caché est un
// colis perdu. Ce contrôle EXÉCUTE la règle (src/repliRetirer.js, `etatRepliRetirer` / `choixApresBascule`) :
//   A. au moins un colis à retirer, appareil neuf ⇒ ouvert ;
//   B. l'ancien « fermé » ('0', d'avant ce correctif) ne ferme jamais une liste de colis ;
//   C. il referme ⇒ fermé pour CETTE liste ; la même liste ⇒ reste fermé ; un colis de plus / un autre ⇒ rouvert ;
//   D. il l'a ouvert ('1') ou il vient pour un retrait (demande) ⇒ ouvert, même à 0 ;
//   E. rien à retirer ⇒ fermé, et le nombre « à vérifier » (+ en vérification) est rendu pour la ligne ;
//   F. publication pas lue ⇒ rien décidé sur un nombre inconnu (fermé, n = null) ;
//   G. l'app passe par la règle (RepliRetirerAchats appelle `etatRepliRetirer` et `choixApresBascule`).
// `--prouve` : réaffaiblit la règle de plusieurs façons, chacune doit rendre ROUGE. Données inventées.
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');

const MUTATIONS = {
  'ferme-par-defaut': ['src/repliRetirer.js', 'else if (n != null && n > 0) ouvert = ferme !== signatureColis(pub);', 'else if (n != null && n > 0) ouvert = false;'],
  'ancien-zero-cache': ['src/repliRetirer.js', "if (demande || choix === '1') ouvert = true;", "if (demande || choix === '1') ouvert = true;\n  else if (choix === '0') ouvert = false;"],
  'fermer-pour-toujours': ['src/repliRetirer.js', "return n != null && n > 0 ? 'f:' + signatureColis(pub) : '0';", "return '0';"],
  'signature-sans-colis': ['src/repliRetirer.js', "const brut = ids.length ? ids.join('|') : `n${nombre(pub && pub.total) ?? ''}`;", "const brut = 'x';"],
  'verif-oublie': ['src/repliRetirer.js', 'const nVerif = pub ? (nombre(pub.aVerifier) || 0) + (nombre(pub.enVerification) || 0) : 0;', 'const nVerif = 0;'],
  'app-sans-regle': ['src/App.jsx', 'const e = etatRepliRetirer(pub, { choix, demande });', "const e = { ouvert: choix === '1' || demande, n: pub && pub.total, nVerif: 0, presse: false };"],
};
if (process.argv.includes('--prouve')) {
  let ok = 0;
  for (const [nom, [f, de, vers]] of Object.entries(MUTATIONS)) {
    const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-repli-'));
    fs.mkdirSync(path.join(t, 'src'), { recursive: true });
    for (const x of ['src/repliRetirer.js', 'src/App.jsx']) fs.copyFileSync(path.join(R, x), path.join(t, x));
    const src = fs.readFileSync(path.join(t, f), 'utf8');
    if (!src.includes(de)) { console.log(`  ⚠️  mutation « ${nom} » : texte introuvable (la règle a changé ? mets la mutation à jour)`); continue; }
    fs.writeFileSync(path.join(t, f), src.replace(de, vers));
    const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, AUDIT_RACINE: t }, encoding: 'utf8' });
    const rouge = r.status !== 0;
    if (rouge) ok++;
    console.log(`  ${rouge ? '✅' : '❌'} mutation « ${nom} » ⇒ ${rouge ? 'ROUGE' : 'reste vert (le contrôle ne la voit pas)'}`);
    fs.rmSync(t, { recursive: true, force: true });
  }
  const n = Object.keys(MUTATIONS).length;
  console.log(`\n${ok}/${n} mutations rouges`);
  process.exit(ok === n ? 0 : 1);
}

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d != null && !c ? ' — ' + d : '')); };
(async () => {
  const fichier = path.join(R, 'src', 'repliRetirer.js');
  if (!fs.existsSync(fichier)) { dit(false, 'src/repliRetirer.js existe (la règle du repli)', 'absent'); console.log(`\n${ok} vert(s), ${ko} rouge(s)`); process.exit(1); }
  // Copie .mjs : Node lit le fichier comme un module, quelle que soit la racine.
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'repli-')), 'r.mjs');
  fs.copyFileSync(fichier, tmp);
  const { etatRepliRetirer, choixApresBascule } = await import(pathToFileURL(tmp).href);
  const pub3 = { total: 3, urgents: 0, aVerifier: 5, enVerification: 1, colis: [['2026-11-19', 1, 'mondialrelay', 'e:A1'], ['2026-11-19', 1, 'mondialrelay', 'e:A2'], ['', 1, 'vinted', 'v:1:7']] };
  const pub4 = { ...pub3, total: 4, colis: [...pub3.colis, ['2026-11-20', 1, 'mondialrelay', 'e:A3']] };
  const pubAutre = { ...pub3, colis: [pub3.colis[0], pub3.colis[1], ['', 1, 'vinted', 'v:1:8']] };
  const pub0 = { total: 0, urgents: 0, aVerifier: 5, enVerification: 1, colis: [] };

  dit(etatRepliRetirer(pub3, {}).ouvert === true, 'A au moins un colis à retirer, appareil neuf ⇒ ouvert');
  dit(etatRepliRetirer(pub3, { choix: '0' }).ouvert === true, 'B l’ancien « fermé » (\'0\') ne cache pas une liste de colis');
  const f = choixApresBascule(pub3, { ouvert: true });
  dit(typeof f === 'string' && f.startsWith('f:') && etatRepliRetirer(pub3, { choix: f }).ouvert === false, 'C il referme ⇒ fermé pour CETTE liste', f);
  const melange = { ...pub3, colis: [...pub3.colis].reverse() };
  dit(etatRepliRetirer(melange, { choix: f }).ouvert === false, 'C la même liste (dans un autre ordre) ⇒ reste fermé');
  dit(etatRepliRetirer(pub4, { choix: f }).ouvert === true, 'C un colis de plus ⇒ rouvert');
  dit(etatRepliRetirer(pubAutre, { choix: f }).ouvert === true, 'C un AUTRE colis (même nombre) ⇒ rouvert');
  dit(choixApresBascule(pub3, { ouvert: false }) === '1', 'D l’ouvrir retient « ouvert »');
  dit(etatRepliRetirer(pub0, { choix: '1' }).ouvert === true && etatRepliRetirer(pub0, { demande: true }).ouvert === true && etatRepliRetirer(pub3, { choix: f, demande: true }).ouvert === true, 'D ouvert par lui ou venu pour un retrait ⇒ ouvert');
  const e0 = etatRepliRetirer(pub0, {});
  dit(e0.ouvert === false && e0.nVerif === 6, 'E rien à retirer ⇒ fermé, 6 « à vérifier » (5 + 1 en vérification) rendus pour la ligne', JSON.stringify(e0));
  dit(choixApresBascule(pub0, { ouvert: true }) === '0', 'E le refermer à 0 retient « fermé »');
  const en = etatRepliRetirer(null, {});
  dit(en.ouvert === false && en.n === null && en.nVerif === 0, 'F publication pas lue ⇒ rien décidé (fermé, n inconnu)', JSON.stringify(en));
  dit(etatRepliRetirer({ ...pub3, urgents: 1 }, {}).presse === true, 'un retrait pressé est signalé (point ambre)');
  const app = fs.readFileSync(path.join(R, 'src', 'App.jsx'), 'utf8');
  // (20 nov., chasse-bugs) Depuis le filtre des sites, `RepliRetirerAchats` passe la main à `RepliRetirerAchatsTous` (sans filtre) : c'est lui qui décide.
  const corps = ((app.split('function RepliRetirerAchatsTous(')[1] || app.split('function RepliRetirerAchats(')[1] || '')).split('\n}\n')[0];
  dit(/etatRepliRetirer\(pub, \{ choix, demande \}\)/.test(corps) && /choixApresBascule\(pub,/.test(corps), 'G RepliRetirerAchats passe par la règle (etatRepliRetirer, choixApresBascule)');
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
