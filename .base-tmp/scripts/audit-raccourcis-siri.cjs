// Audit : SIRI / RACCOURCIS (10 novembre, lot AH) — src/raccourcisSiri.js.
// Deux liens profonds que l'app Raccourcis de l'iPhone ouvre :
//   « Ajouter un achat » `?tab=achats&achat=1[&titre=…&prix=…&ou=…]` ⇒ « Nouvel achat »
//     pré-rempli de ce qu'il a dit — un champ illisible reste VIDE (jamais deviné) ;
//   « Où est le N° » `?tab=journee&q=…` ⇒ la loupe sur ce N° (dictée lue par `requeteDeLaVoix`).
// Plus le branchement : `goto` (App.jsx) lit les deux, le formulaire d'Achats consomme la
// demande UNE fois et n'écrit RIEN tout seul, Paramètres montre l'aide.
// `--prouve` : chaque règle réaffaiblie doit faire passer l'audit au rouge.
require('./_source-app.cjs').brancher(); // App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
const SRC = path.join(R, 'src', 'raccourcisSiri.js');
const lire = (f) => fs.readFileSync(path.join(R, f), 'utf8');
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/(^|[^:'"`])\/\/.*$/, '$1')).join('\n');

const P = (o) => new URLSearchParams(o);
const CAS_ACHAT = [
  ['sans achat=1 : rien', P({ tab: 'achats', titre: 'Nike' }), null],
  ['achat=0 : rien', P({ achat: '0', titre: 'Nike' }), null],
  ['achat=1 seul : formulaire vide', P({ tab: 'achats', achat: '1' }), { titre: '', prix: '', lieu: '' }],
  ['titre, prix, lieu', P({ achat: '1', titre: '  Nike  Dunk   42 ', prix: '45', ou: 'Brocante' }), { titre: 'Nike Dunk 42', prix: '45', lieu: 'Brocante' }],
  ['prix 45,5', P({ achat: '1', prix: '45,5' }), { titre: '', prix: '45,5', lieu: '' }],
  ['prix 45.50 (Siri)', P({ achat: '1', prix: '45.50' }), { titre: '', prix: '45,50', lieu: '' }],
  ['prix « 45 € »', P({ achat: '1', prix: '45 €' }), { titre: '', prix: '45', lieu: '' }],
  ['prix en lettres : vide', P({ achat: '1', prix: 'quarante' }), { titre: '', prix: '', lieu: '' }],
  ['prix négatif : vide', P({ achat: '1', prix: '-3' }), { titre: '', prix: '', lieu: '' }],
  ['prix à 3 décimales : vide', P({ achat: '1', prix: '12,345' }), { titre: '', prix: '', lieu: '' }],
  ['prix « 12 et 50 » : vide', P({ achat: '1', prix: '12 et 50' }), { titre: '', prix: '', lieu: '' }],
  ['caractères invisibles retirés', P({ achat: '1', titre: 'Air\u0000Max‮ 90\n' }), { titre: 'Air Max 90', prix: '', lieu: '' }],
  ['titre borné à 80', P({ achat: '1', titre: 'x'.repeat(200) }), { titre: 'x'.repeat(80), prix: '', lieu: '' }],
  ['lieu borné à 40', P({ achat: '1', ou: 'y'.repeat(90) }), { titre: '', prix: '', lieu: 'y'.repeat(40) }],
];
const CAS_Q = [
  ['124', '124'], ['numéro 124', '124'], ['cent vingt-quatre', '124'], ['B 125', 'B125'], ['n° 7', '7'],
  ['Nike Dunk', 'Nike Dunk'], ['', ''], ['   ', ''], ['z'.repeat(70), ''],
];

async function charger(src) {
  // À côté du vrai module : son `import './rechercheVocale.js'` se résout.
  const f = path.join(R, 'src', `.raccourcisSiri-audit-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(f, src);
  try { return await import(f); } finally { try { fs.unlinkSync(f); } catch (_) {} }
}

async function audit(src, bavard) {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; if (bavard) console.log((c ? '✅ ' : '❌ ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
  let M; try { M = await charger(src); } catch (e) { dit(false, 'le module se charge', e.message); return ko || 1; }
  for (const [nom, p, att] of CAS_ACHAT) {
    const r = M.lireDemandeAchat(p);
    dit(JSON.stringify(r) === JSON.stringify(att), `achat : ${nom}`, JSON.stringify(r));
  }
  dit(M.lireDemandeAchat(null) === null && M.lireDemandeAchat({}) === null, 'achat : sans paramètres lisibles, rien');
  for (const [q, att] of CAS_Q) {
    const r = M.lireRechercheLien(P({ tab: 'journee', q }));
    dit(r === att, `recherche : « ${q.length > 20 ? q.slice(0, 8) + '…' : q} » ⇒ « ${att} »`, r);
  }
  dit(M.lireRechercheLien(P({ tab: 'journee' })) === '', 'recherche : sans `q`, rien');
  // La demande se consomme UNE fois.
  M.poserDemandeAchat({ titre: 'a', prix: '', lieu: '' });
  const a1 = M.prendreDemandeAchat(), a2 = M.prendreDemandeAchat();
  dit(a1 && a1.titre === 'a' && a2 === null, 'la demande d’achat est consommée une seule fois');
  // Les liens montrés : exacts, et rien d'autre que ce qu'il tape.
  const L = Object.fromEntries((M.RACCOURCIS_SIRI || []).map((r) => [r.cle, r]));
  dit(L.achat && L.achat.lien() === 'https://vrm.center/?tab=achats&achat=1', 'lien « Ajouter un achat » exact', L.achat && L.achat.lien());
  dit(L.numero && L.numero.lien() === 'https://vrm.center/?tab=journee&q=', 'lien « Où est le N° » exact', L.numero && L.numero.lien());
  dit((M.RACCOURCIS_SIRI || []).length === 2 && M.RACCOURCIS_SIRI.every((r) => Array.isArray(r.etapes) && r.etapes.length === 3), 'deux raccourcis, trois étapes chacun');
  dit((M.RACCOURCIS_SIRI || []).every((r) => r.etapes.every((e) => e.split(/\s+/).filter((w) => /\p{L}/u.test(w)).length <= 12)), 'chaque étape tient en 12 mots au plus');
  return ko;
}

const MUTATIONS = {
  prix_devine: (s) => s.replace("if (!/^\\d{1,5}(?:[.,]\\d{1,2})?$/.test(s)) return '';", "const d = /\\d+/.exec(s); if (!d) return ''; if (!/^\\d{1,5}(?:[.,]\\d{1,2})?$/.test(s)) return d[0];"),
  sans_achat1: (s) => s.replace("|| p.get('achat') !== '1') return null;", ") return null;"),
  sans_voix: (s) => s.replace('const r = requeteDeLaVoix(brut);', 'const r = { requete: brut };'),
  sans_borne_titre: (s) => s.replace("titre: propre(p.get('titre'), TITRE_MAX)", "titre: propre(p.get('titre'), 9999)"),
  sans_nettoyage: (s) => s.replace(".replace(/[\\p{Cc}\\p{Cf}\\p{Zl}\\p{Zp}]/gu, ' ')", ''),
  sans_consomme: (s) => s.replace('const b = DEMANDE.brouillon; DEMANDE.brouillon = null;', 'const b = DEMANDE.brouillon;'),
  sans_borne_q: (s) => s.replace('return q && q.length <= RECHERCHE_MAX ? q : \'\';', 'return q;').replace('propre(r.requete, RECHERCHE_MAX + 1)', 'propre(r.requete, 999)'),
  lien_bavard: (s) => s.replace('`${o}/?tab=achats&achat=1`', '`${o}/?tab=achats&achat=1&uid=${typeof localStorage === "undefined" ? "x" : "y"}`'),
};

function branchement() {
  let ko = 0;
  const dit = (c, m) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m); };
  const app = sansCommentaires(lire('src/App.jsx'));
  const achats = sansCommentaires(lire('src/ecrans/Achats.jsx'));
  const reglages = sansCommentaires(lire('src/ecrans/Reglages.jsx'));
  const goto = (/const goto=\(search\)=>\{[\s\S]*?goto\(window\.location\.search\);/.exec(app) || [''])[0];
  dit(/const da=lireDemandeAchat\(p\); if\(da\)\{ poserDemandeAchat\(da\);/.test(goto), '`goto` lit `achat=1` et pose la demande d’achat');
  dit(/const rq=lireRechercheLien\(p\); if\(rq\) setTimeout\(\(\)=>\{ try\{ window\.dispatchEvent\(new CustomEvent\('vrm:fiche-article',\{detail:rq\}\)\)/.test(goto), '`goto` ouvre la loupe sur `q` (le même événement que « Fiche article »)');
  dit(/if\(\(da\|\|rq\)&&!t\)\{ window\.history\.replaceState\(/.test(goto) && /setTab\(tt\); window\.history\.replaceState\(/.test(goto), 'l’adresse est effacée après lecture (avec ou sans `tab`)');
  dit(/window\.addEventListener\('vrm:fiche-article',ouvrir\)/.test(app), 'la loupe écoute `vrm:fiche-article`');
  const liens = (/const ONGLETS_LIENS=\[([^\]]*)\]/.exec(app) || ['', ''])[1];
  dit(/'achats'/.test(liens) && /'journee'/.test(liens), '`achats` et `journee` sont des écrans qu’un lien peut ouvrir');
  const servir = (/const servir = \(\) => \{\s*const d = prendreDemandeAchat\(\);[\s\S]*?\n {4}\};/.exec(achats) || [''])[0];
  dit(!!servir && /setForm\(\{ \.\.\.BROUILLON0\(\), title: d\.titre/.test(servir), 'Achats : la demande ouvre « Nouvel achat » pré-rempli');
  dit(!!servir && !/onAjouter|onModifier|save\(|cloudPush|withOwner|fetch\(/.test(servir), 'Achats : rien n’est enregistré sans son clic');
  dit(/window\.addEventListener\(EVT_ACHAT_LIEN, servir\)/.test(achats), 'Achats : un lien reçu app ouverte est servi aussi');
  dit(/id:'raccourcis-siri'[^\n]*el:<RaccourcisSiri /.test(reglages), 'Paramètres : l’aide « Siri et Raccourcis »');
  return ko;
}

(async () => {
  const src = fs.readFileSync(SRC, 'utf8');
  if (process.argv.includes('--prouve')) {
    let rate = 0;
    for (const [nom, f] of Object.entries(MUTATIONS)) {
      const m = f(src);
      if (m === src) { console.log(`❌ mutation ${nom} : motif absent`); rate++; continue; }
      const ko = await audit(m, false);
      console.log(`${ko ? '✅' : '❌'} mutation ${nom} : ${ko ? ko + ' rouge(s)' : 'AUCUN rouge'}`);
      if (!ko) rate++;
    }
    console.log(rate ? `\n❌ ${rate} mutation(s) non détectée(s)` : `\n✅ toutes les mutations (${Object.keys(MUTATIONS).length}) sont rouges`);
    process.exit(rate ? 1 : 0);
  }
  let ko = await audit(src, true);
  ko += branchement();
  console.log(ko ? `\n❌ audit-raccourcis-siri : ${ko} rouge(s)` : '\n✅ audit-raccourcis-siri : tout vert');
  process.exit(ko ? 1 : 0);
})();
