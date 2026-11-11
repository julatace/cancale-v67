// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — « textes courts » (10 nov., 4e série — branche claude/textes-courts-4)
//
//  Julien : « encore du texte », « je n'aime pas du tout les pop-up ». La règle
//  (docs/passation/2026-11-09-popups-propre.md) : un texte affiché de plus de
//  90 caractères est RÉÉCRIT (le fait + le geste) ; le détail utile est replié
//  sous « Pourquoi ? » (`<Pourquoi>`, `<details>`), jamais perdu.
//
//  Relevé STATIQUE (babel) des fichiers passés à la règle : un élément bloc =
//  son texte + ses enfants en ligne (b, span, a…) ; une expression `{…}` compte
//  pour « … » (non mesurée) ; ce qui est sous `Pourquoi`/`details`/`style`/
//  `title`/`option` est ignoré. Chaque fichier de LISTE doit rendre 0 texte de
//  plus de 90 caractères (hors les EXCEPTIONS nommées, gardées exprès).
//   T1  aucun texte long dans chaque fichier de la liste ;
//   T2  « Aucune garantie contre un blocage Vinted » reste VISIBLE (hors repli)
//       dans les Favoris, et le rythme « 6 à 10 s » aussi (des avertissements) ;
//   T3  le détail d'avant est GARDÉ sous « Pourquoi ? » (morceaux témoins).
//  Rouge sur origin/main (T1 : 23 textes longs rien que dans Favoris,
//  Organisation, Communauté). `--prouve` : mutation — on recolle un ancien texte
//  long dans une copie, T1 doit rougir.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let parser;
try { parser = require(path.join(__dirname, '..', 'node_modules', '@babel', 'parser')); }
catch (_) { parser = require('@babel/parser'); }
const RACINE = process.env.TEXTES_RACINE || path.join(__dirname, '..');
const SEUIL = 90;
const LISTE = [
  'src/FavorisVinted.jsx', 'src/operations/Operations.jsx', 'src/communaute/Communaute.jsx',
  'src/communaute/Accompagnement.jsx', 'src/ebayRecherche.jsx', 'src/InventaireStock.jsx',
  'src/StudioPhoto.jsx', 'src/ConfigurationDepart.jsx', 'src/composants/SignalerProbleme.jsx',
  // (11 nov., 5e série — docs/passation/2026-11-11-textes-courts-5.md)
  'src/ecrans/Reglages.jsx', 'src/ecrans/Ebay.jsx', 'src/ecrans/Leboncoin.jsx', 'src/Accueil.jsx',
  'src/ConfigurerTransfert.jsx', 'src/RelierBoite.jsx', 'src/CarteRelais.jsx', 'src/ecrans/Stock.jsx',
  'src/ecrans/Vestiaire.jsx', 'src/ecrans/PrixMarche.jsx', 'src/ecrans/Republier.jsx', 'src/ecrans/Compta.jsx',
  'src/ecrans/MessagesLeboncoin.jsx', 'src/ecrans/PhotoEditor.jsx', 'src/Bienvenue.jsx', 'src/BoiteEmails.jsx',
  'src/JournalEmails.jsx', 'src/ReceptionEmails.jsx', 'src/ebayGestion.jsx', 'src/Tournee.jsx',
  'src/JaugeActions.jsx', 'src/ModeEmballage.jsx', 'src/GuideIphone.jsx', 'src/ExpliqueMondialRelay.jsx',
  'src/ParcoursArrivee.jsx', 'src/parcoursArrivee.js',
];
// Gardés exprès (dits dans docs/passation/2026-11-10-textes-courts-4.md).
const EXCEPTIONS = [
  /^S’y ajoutent l’identifiant de ton compte VRM/, // SignalerProbleme : ce qui part avec un signalement (vie privée, mot pour mot)
  /^Essai gratuit une seule fois — par adresse e-mail et par compte Vinted/, // Réglages → abonnement : l'essai (texte des CGV, gardé)
];
const INLINE = new Set(['b', 'strong', 'i', 'em', 'span', 'a', 'code', 'small', 'br', 'kbd', 'u', 'mark', 'abbr']);
// SourceChiffre (Compta) : « D'où vient ce chiffre ? », un repli comme Pourquoi.
const SKIP = new Set(['Pourquoi', 'details', 'style', 'script', 'title', 'svg', 'option', 'select', 'textarea', 'SourceChiffre']);

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${!c && d ? '  → ' + String(d).slice(0, 600) : ''}`); };

function longs(src) {
  const ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx'] });
  const out = [];
  const nom = (n) => { const o = n.openingElement.name; return o.type === 'JSXIdentifier' ? o.name : o.type === 'JSXMemberExpression' ? o.property.name : ''; };
  const txt = (n) => {
    let s = '';
    for (const c of n.children || []) {
      if (c.type === 'JSXText') s += c.value;
      else if (c.type === 'JSXExpressionContainer') { const e = c.expression;
        if (e.type === 'StringLiteral') s += e.value; else if (e.type === 'TemplateLiteral') s += e.quasis.map((q) => q.value.cooked).join('…'); else if (e.type !== 'JSXEmptyExpression') s += '…'; }
      else if (c.type === 'JSXElement' && INLINE.has(nom(c))) s += txt(c);
      else if (c.type === 'JSXFragment') s += txt(c);
    }
    return s;
  };
  const walk = (n, skip) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach((x) => walk(x, skip)); return; }
    if (n.type === 'JSXElement') {
      const nm = nom(n), sk = skip || SKIP.has(nm);
      if (!sk && !INLINE.has(nm)) { const t = txt(n).replace(/\s+/g, ' ').trim(); if (t.replace(/…/g, '').length > SEUIL && !EXCEPTIONS.some((re) => re.test(t))) out.push(`l.${n.loc.start.line} (${t.length}) ${t.slice(0, 120)}`); }
      for (const c of n.children) walk(c, sk);
      for (const a of n.openingElement.attributes) if (a.value && a.value.type === 'JSXExpressionContainer') walk(a.value.expression, sk);
      return;
    }
    for (const k in n) { if (k === 'loc' || k === 'start' || k === 'end' || /Comments$/.test(k)) continue; const v = n[k]; if (v && typeof v === 'object') walk(v, skip); }
  };
  walk(ast.program, false);
  return out;
}

function controles(lire) {
  for (const f of LISTE) {
    const src = lire(f);
    if (src == null) { dit(false, `T1 ${f} existe`); continue; }
    const l = longs(src);
    dit(l.length === 0, `T1 ${f} : aucun texte affiché de plus de ${SEUIL} caractères`, `${l.length} : ` + l.join(' | '));
  }
  const fav = lire('src/FavorisVinted.jsx') || '';
  // Hors repli : le texte de l'élément `data-favoris-avertissement` avant son <Pourquoi>.
  const av = /data-favoris-avertissement[^>]*>([\s\S]*?)<Pourquoi>/.exec(fav);
  dit(!!av && /Aucune garantie contre un blocage Vinted/.test(av[1]), 'T2 Favoris : « Aucune garantie contre un blocage Vinted » reste à l’écran (pas replié)', av && av[1]);
  dit(/Un message toutes les 6 à 10 s/.test(fav) && /rythme mesuré chez Vintex/.test(fav), 'T2 Favoris : le rythme « 6 à 10 s, au hasard » reste dit à l’écran');
  const temoins = [
    ['src/FavorisVinted.jsx', 'Une conversation qui contient déjà des messages est ignorée.'],
    ['src/FavorisVinted.jsx', 'Si le prix de l’annonce ne peut pas être lu, le message part sans offre.'],
    ['src/operations/Operations.jsx', 'Un acompte est enregistré, jamais encaissé par ce formulaire.'],
    ['src/operations/Operations.jsx', 'Port inconnu : jamais traité comme gratuit.'],
    ['src/communaute/Communaute.jsx', 'Jamais ton adresse, ton e-mail ni tes comptes Vinted.'],
    ['src/InventaireStock.jsx', 'Aucun numéro n’est changé.'],
    ['src/ecrans/Reglages.jsx', 'Supprimer ce compte effacerait toute la boutique'],
    ['src/ecrans/Ebay.jsx', 'se choisit dans eBay, et c\'est eBay qui fixe le montant'],
    ['src/ecrans/Leboncoin.jsx', 'pour ne pas vendre le même article deux fois'],
    ['src/ConfigurerTransfert.jsx', 'c\'est ce qui prouve qu\'il est à toi'],
    ['src/CarteRelais.jsx', 'Un colis n\'est rangé sous un point que par ce qui le désigne lui'],
  ];
  // §2.8 : « Tu ne paies jamais le port » reste À L'ÉCRAN sur eBay (jamais replié).
  const eb = lire('src/ecrans/Ebay.jsx') || '';
  { const i = eb.indexOf('Tu ne paies jamais le port.'), p = eb.lastIndexOf('<Pourquoi>', i), q = eb.lastIndexOf('</Pourquoi>', i);
    dit(i >= 0 && !(p >= 0 && p > q), 'T2 eBay : « Tu ne paies jamais le port » reste à l’écran (pas replié)'); }
  for (const [f, t] of temoins) {
    const src = lire(f) || '';
    const i = src.indexOf(t), p = src.lastIndexOf('<Pourquoi>', i), q = src.lastIndexOf('</Pourquoi>', i);
    dit(i >= 0 && p >= 0 && p > q, `T3 ${f} : « ${t.slice(0, 50)}… » gardé sous « Pourquoi ? »`);
  }
}

const lireIci = (f) => { try { return fs.readFileSync(path.join(RACINE, f), 'utf8'); } catch (_) { return null; } };
controles(lireIci);

if (process.argv.includes('--prouve')) {
  // Mutation : l'ancien avertissement des Favoris recollé tel quel ⇒ T1 doit rougir.
  const avant = ko;
  const muter = (f) => { const s = lireIci(f); if (s == null) return s;
    if (f === 'src/ecrans/Ebay.jsx') return s.replace("<b>La livraison est gérée par eBay</b> : eBay fixe le montant et l'encaisse.", "<b>La livraison est gérée par eBay.</b> Le <b>transporteur</b> (Mondial Relay, Chronopost, Colissimo…) se choisit <b>dans eBay</b>, et c'est <b>eBay</b> qui fixe le montant, l'encaisse et te fournit le bordereau.");
    if (f !== 'src/FavorisVinted.jsx') return s;
    return s.replace('<b>Aucune garantie contre un blocage Vinted.</b> Garde cet écran ouvert.', 'Garde cet écran ouvert et visible, avec l’extension à jour et le bon compte Vinted connecté. Une conversation qui contient déjà des messages est ignorée. Aucune garantie contre un blocage Vinted.'); };
  console.log('\n── mutation (ancien texte recollé) : doit être ROUGE');
  const okAvant = ok; controles(muter);
  const rouges = ko - avant; ok = okAvant; ko = avant;
  dit(rouges >= 2, `--prouve : les deux mutations (Favoris, eBay) sont vues (${rouges} rouge(s))`);
}
console.log(ko ? `\n❌ textes courts : ${ko} rouge(s)` : `\n✅ textes courts : ${ok} contrôles`);
process.exit(ko ? 1 : 0);
