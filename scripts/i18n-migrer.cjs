// ════════════════════════════════════════════════════════════════════════════
// MIGRER UN ÉCRAN VERS tr() — le geste mécanique (11 nov., lot traduction, lot 2).
// Méthode : docs/passation/2026-11-11-traduction.md. Deux temps :
//
//   1. node scripts/i18n-migrer.cjs lister <fichier> --zone <Z> [--zone <Z>…] --prefixe p --sortie plan.json
//        Z = une fonction (`FriseJournee`), une section de fonction rendue sous
//        `curSub==='x' && …` (`Comptabilite#journee`), ou des lignes (`120-480`).
//        Écrit le plan (chaque texte, sa clé, ses variables) et, à côté, `plan.json.tsv`
//        (clé ⇥ français) : la feuille à traduire.
//   2. node scripts/i18n-migrer.cjs appliquer plan.json --traductions trad.tsv
//        trad.tsv : `clé ⇥ en ⇥ es ⇥ it ⇥ de` (une ligne par clé NOUVELLE du plan).
//        Vérifie que chaque texte est TOUJOURS à sa place (sinon rien n'est écrit),
//        remplace (texte JSX ⇒ {tr('k')}, attribut ⇒ ={tr('k')}, littéral ⇒ tr('k'),
//        gabarit `${x}` ⇒ tr('k', { x: String(x) }) — String() garde le rendu français
//        EXACT : un N° ne prend jamais d'espace de milliers), ajoute l'import, et range
//        les clés dans les cinq dictionnaires (section `// ── <prefixe>`).
//
// Ce qui n'est JAMAIS touché : les attributs data-*, className, key, style ; un texte
// comparé quelque part (=== 'texte', case 'texte', .includes('texte')) ; un gabarit qui
// porte lui-même du texte (`${n} vente${n>1?'s':''}` : un pluriel, à écrire à la main) ;
// un endroit où `tr` est une variable locale ; le niveau module (une constante figerait
// la langue du chargement). Ces cas sont LISTÉS (« à la main »), jamais devinés.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const nm = (p) => { try { return require(path.join(__dirname, '..', 'node_modules', p)); } catch (_) { return require(p); } };
const parser = nm('@babel/parser');
const traverse = (nm('@babel/traverse').default || nm('@babel/traverse'));
const R = path.join(__dirname, '..');
const LANGUES = ['fr', 'en', 'es', 'it', 'de'];

const args = process.argv.slice(2);
const cmd = args[0];
const opt = (n) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : null; };
const opts = (n) => args.flatMap((a, i) => (a === '--' + n ? [args[i + 1]] : []));

const PROPRES = /\b(?:VRM|Google|Discord|Vinted|Leboncoin|eBay|Vestiaire Collective|Vestiaire|Scriptable|URSSAF|Mondial Relay|Colissimo|Chronopost|Relais Colis|InPost|Shop2Shop|UPS|DHL|DPD|Stripe|Supabase|Chrome|Orion|Safari|Firefox|Edge|iPhone|Android|PDF|SIRET|Photoroom|Brevo|Gmail|Discord|Kbis)\b/g;
const PERMIS = [/^[A-Z]{2}$/, /^[\s·—–…→←›✓✕×©+\-:;,.()0-9€%/]*$/];
const estTexte = (s) => { const v = String(s).replace(PROPRES, '').replace(/\s+/g, ' ').trim(); return /[A-Za-zÀ-ÿ]{2,}/.test(v) && !PERMIS.some((re) => re.test(v)); };
const ATTR = new Set(['placeholder', 'aria-label', 'title', 'alt', 'label', 'titre', 'sousTitre', 'aria-description', 'aria-roledescription']);
const CHAMPS = new Set(['lib', 'desc', 'titre', 'pied', 'label', 'texte', 'phrase', 'sousTitre', 'aide', 'sub', 'title', 'detail', 'court', 'probleme', 'annulation', 'message', 'raison', 'quoi', 'geste', 'bouton', 'libelle', 'intitule', 'explication', 'conseil', 'info', 'aria', 'confirmer', 'question']);
const APPELS = new Set(['setErr', 'setInfo', 'toast', 'setMessage', 'setErreur', 'setLierFournisseurMot', 'askConfirm', 'askText', 'setMsg', 'setNote', 'setStatut', 'setEtatMsg', 'notifier', 'alert', 'confirm']);
// Un argument « Phrase avec espace » passé à ces fonctions n'est pas affiché.
const PAS_AFFICHE = /^(?:console\.\w+|load|save|saveDirect|localStorage\.\w+|sessionStorage\.\w+|\w+\.(?:includes|startsWith|endsWith|indexOf|test|match|replace|split|querySelector|querySelectorAll|getItem|setItem|removeItem|dispatchEvent|addEventListener|has|get|set|delete)|fetch|sbFetch|sbGet|sbPost|sbPatch|RegExp|Error|require|import|tr|t|String|Number|JSON\.\w+|encodeURIComponent|decodeURIComponent|journal|log\w*|trace\w*|noter\w*|dit)$/;

const SANS_ACCENT = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const VIDES = new Set(['le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'd', 'l', 'et', 'a', 'à', 'en', 'ton', 'ta', 'tes', 'ce', 'cet', 'cette', 'pour', 'par', 'sur', 'au', 'aux', 'est', 'que', 'qui', 'ne', 'pas', 'tu', 'te', 's', 'n', 'x', 'il', 'elle', 'on', 'se', 'sa', 'son', 'ses', 'y', 'ou', 'si', 'qu', 'c', 'j']);
const nomCle = (texte) => {
  const mots = SANS_ACCENT(texte).toLowerCase().replace(/\{[^}]*\}/g, ' ').split(/[^a-z0-9]+/).filter((m) => m && !VIDES.has(m)).slice(0, 3);
  return mots.map((m, i) => (i ? m[0].toUpperCase() + m.slice(1) : m)).join('') || 'texte';
};

// Le texte JSX tel que React le rend (règle de Babel : lignes rognées, jointes par une espace).
function cuireJsx(v) {
  const lignes = v.split(/\r\n|\n|\r/);
  let dernier = 0;
  for (let i = 0; i < lignes.length; i++) if (/[^ \t]/.test(lignes[i])) dernier = i;
  let out = '';
  for (let i = 0; i < lignes.length; i++) {
    let l = lignes[i].replace(/\t/g, ' ');
    if (i !== 0) l = l.replace(/^[ ]+/, '');
    if (i !== lignes.length - 1) l = l.replace(/[ ]+$/, '');
    if (l) { if (i !== dernier) l += ' '; out += l; }
  }
  return out;
}

function lireDicos() {
  const D = {};
  for (const l of LANGUES) for (const part of [`${l}-accueil.js`, `${l}.js`]) {
    const t = fs.readFileSync(path.join(R, 'src', 'i18n', 'langues', part), 'utf8');
    D[l] = D[l] || {};
    for (const m of t.matchAll(/^\s*"([^"]+)": ("(?:[^"\\]|\\.)*")/gm)) D[l][m[1]] = JSON.parse(m[2]);
  }
  return D;
}

function parse(src) { return parser.parse(src, { sourceType: 'module', plugins: ['jsx'], ranges: true }); }

function lister() {
  const fichier = args[1];
  const zones = opts('zone');
  const prefixe = opt('prefixe');
  const sortie = opt('sortie');
  if (!fichier || !zones.length || !prefixe || !sortie) { console.log('usage : lister <fichier> --zone Z --prefixe p --sortie plan.json'); process.exit(2); }
  const src = fs.readFileSync(path.join(R, fichier), 'utf8');
  const ast = parse(src);
  const D = lireDicos();
  const fr = D.fr;
  const J = (v) => (typeof v === 'string' ? v : JSON.stringify(v));
  const parTexte = new Map(Object.entries(fr).map(([k, v]) => [J(v), k]));
  // Les textes COMPARÉS quelque part dans src/ (une identité, jamais traduite).
  const tousSrc = [];
  (function w(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) { if (f.name !== 'langues') w(p); } else if (/\.(jsx?|mjs)$/.test(f.name)) tousSrc.push(fs.readFileSync(p, 'utf8')); } })(path.join(R, 'src'));
  const toutSrc = tousSrc.join('\n');
  const echap = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const compare = (texte) => { const q = `['"\`]${echap(texte)}['"\`]`; return new RegExp(`(?:[=!]==?\\s*${q}|${q}\\s*[=!]==?|case\\s+${q}|\\.(?:includes|startsWith|endsWith|indexOf)\\(\\s*${q})`).test(toutSrc); };

  // Les zones en intervalles [début, fin) d'octets.
  const inter = [];
  traverse(ast, {
    enter(p) {
      const n = p.node;
      for (const z of zones) {
        const [fn, sous] = z.split('#');
        if (/^\d+-\d+$/.test(z)) continue;
        const nom = (n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') && n.id ? n.id.name : n.type === 'VariableDeclarator' && n.id && n.id.name ? n.id.name : null;
        if (nom !== fn) continue;
        if (!sous) { inter.push([n.start, n.end, z]); continue; }
        p.traverse({ LogicalExpression(q) { const l = q.node.left; if (q.node.operator === '&&' && l.type === 'BinaryExpression' && l.operator === '===' && l.left.type === 'Identifier' && l.left.name === 'curSub' && l.right.type === 'StringLiteral' && l.right.value === sous) inter.push([q.node.start, q.node.end, z]); } });
      }
    },
  });
  for (const z of zones) if (/^\d+-\d+$/.test(z)) {
    const [a, b] = z.split('-').map(Number);
    const lignes = src.split('\n'); let o = 0; let s = 0, e = src.length;
    for (let i = 0; i < lignes.length; i++) { if (i + 1 === a) s = o; if (i + 1 === b + 1) { e = o; break; } o += lignes[i].length + 1; }
    inter.push([s, e, z]);
  }
  for (const z of zones) if (!inter.some((x) => x[2] === z)) { console.log(`zone « ${z} » introuvable`); process.exit(2); }
  const dans = (n) => inter.some(([a, b]) => n.start >= a && n.end <= b);

  const items = [], manuels = [];
  const ligne = (n) => (n.loc ? n.loc.start.line : 0);
  const dansFonction = (p) => !!p.findParent((q) => q.isFunction());
  const trLocal = (p) => { const b = p.scope.getBinding('tr'); return !!(b && b.kind !== 'module'); };
  const sousIgnore = (p) => !!p.findParent((q) => q.isJSXElement() && q.node.openingElement.name && ['style', 'script', 'svg', 'path', 'code', 'kbd', 'pre'].includes(q.node.openingElement.name.name));
  const dansTr = (p) => !!p.findParent((q) => q.isCallExpression() && q.node.callee.type === 'Identifier' && (q.node.callee.name === 'tr' || q.node.callee.name === 't'));
  const garder = (p, n, quoi, texte, vars) => {
    if (!dans(n)) return;
    if (!dansFonction(p)) { manuels.push({ ligne: ligne(n), pourquoi: 'niveau module', texte }); return; }
    if (sousIgnore(p) || dansTr(p)) return;
    if (trLocal(p)) { manuels.push({ ligne: ligne(n), pourquoi: '`tr` est une variable locale ici', texte }); return; }
    if (quoi !== 'jsxtext' && quoi !== 'attr' && n.type === 'StringLiteral' && compare(n.value)) { manuels.push({ ligne: ligne(n), pourquoi: 'texte comparé ailleurs (identité)', texte }); return; }
    items.push({ start: n.start, end: n.end, ligne: ligne(n), quoi, texte, vars, brut: src.slice(n.start, n.end) });
  };
  const lit = (p, quoi) => {
    const n = p.node;
    if (n.type === 'StringLiteral') { if (estTexte(n.value) && (quoi !== 'enfant' || !/^[a-z][\w-]*$/.test(n.value))) garder(p, n, quoi, n.value, null); return; }
    if (n.type === 'TemplateLiteral') {
      const brut = n.quasis.map((q) => q.value.cooked).join(' ');
      if (!estTexte(brut)) return;
      // Un pluriel à la française : `${n} vente${n > 1 ? 's' : ''}` (même compteur partout) ⇒ { one, other }.
      const srcDe = (e) => src.slice(e.start, e.end);
      const plurielDe = (e) => {
        if (e.type !== 'ConditionalExpression' || e.consequent.type !== 'StringLiteral' || e.alternate.type !== 'StringLiteral') return null;
        const t = e.test; if (t.type !== 'BinaryExpression') return null;
        const un = (x) => x.type === 'NumericLiteral' && x.value === 1, deux = (x) => x.type === 'NumericLiteral' && x.value === 2;
        let X = null, sens = null;   // sens 'autre' : la conséquence est le pluriel
        if (un(t.right) && (t.operator === '>' || t.operator === '!==' || t.operator === '!=')) { X = t.left; sens = 'autre'; }
        else if (un(t.right) && (t.operator === '===' || t.operator === '==' || t.operator === '<=')) { X = t.left; sens = 'un'; }
        else if (deux(t.right) && t.operator === '<') { X = t.left; sens = 'un'; }
        else if (deux(t.right) && t.operator === '>=') { X = t.left; sens = 'autre'; }
        if (!X) return null;
        const [a, b] = [e.consequent.value, e.alternate.value];
        return { X: srcDe(X), one: sens === 'un' ? a : b, other: sens === 'un' ? b : a };
      };
      let texteInt = false; let compteur = null; let plurielOk = true;
      n.expressions.forEach((e) => {
        const pl = plurielDe(e);
        if (pl) { if (compteur && compteur !== pl.X) plurielOk = false; compteur = pl.X; return; }
        traverse(e, { noScope: true, enter(q) { if ((q.node.type === 'StringLiteral' && /[A-Za-zÀ-ÿ]/.test(q.node.value)) || q.node.type === 'TemplateLiteral') texteInt = true; } }, p.scope, null, p);
        if ((e.type === 'StringLiteral' && /[A-Za-zÀ-ÿ]/.test(e.value)) || e.type === 'TemplateLiteral') texteInt = true;
      });
      const lisible = n.quasis.map((q, i) => q.value.cooked + (i < n.expressions.length ? '${' + src.slice(n.expressions[i].start, n.expressions[i].end) + '}' : '')).join('');
      if (texteInt || !plurielOk) { if (dans(n)) manuels.push({ ligne: ligne(n), pourquoi: 'gabarit qui porte du texte : à la main', texte: lisible }); return; }
      const noms = new Map(); const vars = [];
      if (compteur) { noms.set(compteur, 'n'); }
      n.expressions.forEach((e) => {
        if (plurielDe(e)) { vars.push(null); return; }
        const s = srcDe(e);
        if (noms.has(s)) { vars.push({ nom: noms.get(s), expr: s }); return; }
        let nom = e.type === 'Identifier' ? e.name : e.type === 'MemberExpression' && e.property.type === 'Identifier' ? e.property.name : e.type === 'CallExpression' ? (e.callee.type === 'Identifier' ? e.callee.name : e.callee.property && e.callee.property.name) || 'x' : 'x';
        nom = String(nom).replace(/\W/g, '') || 'x';
        if (/^(length|toFixed|join|map)$/.test(nom)) nom = e.type === 'MemberExpression' && e.object.type === 'Identifier' ? e.object.name + 'N' : 'x';
        if (nom === 'n' || nom === 'count') nom = 'x';
        let k = nom, i = 2; while ([...noms.values()].includes(k)) k = nom + i++;
        noms.set(s, k); vars.push({ nom: k, expr: s });
      });
      const forme = (quelle) => n.quasis.map((q, i) => q.value.cooked + (i < n.expressions.length ? (vars[i] ? `{${vars[i].nom}}` : plurielDe(n.expressions[i])[quelle]) : '')).join('');
      const texte = compteur ? { one: forme('one'), other: forme('other') } : forme('other');
      const vs = vars.filter(Boolean); if (compteur) vs.unshift({ nom: 'n', expr: compteur });
      garder(p, n, quoi, texte, vs);
    }
  };
  // Remonte d'un littéral à son contexte : affiché ?
  const contexte = (p) => {
    let q = p;
    for (;;) {
      const par = q.parentPath; if (!par) return null;
      if (par.isConditionalExpression() && q.key !== 'test') { q = par; continue; }
      if (par.isLogicalExpression() && q.key === 'right') { q = par; continue; }
      if (par.isJSXExpressionContainer()) {
        const pp = par.parentPath;
        if (pp.isJSXElement() || pp.isJSXFragment()) return 'enfant';
        if (pp.isJSXAttribute() && pp.node.name && ATTR.has(pp.node.name.name)) return 'attrexpr';
        return null;
      }
      if (par.isObjectProperty() && q.key === 'value') { const k = par.node.key; const nomK = k.type === 'Identifier' ? k.name : k.type === 'StringLiteral' ? k.value : null; return CHAMPS.has(nomK) ? 'champ' : null; }
      if (par.isCallExpression() && q.listKey === 'arguments') {
        const c = par.node.callee; const nomC = c.type === 'Identifier' ? c.name : c.type === 'MemberExpression' ? `${c.object.type === 'Identifier' ? c.object.name : '_'}.${c.property.name || ''}` : '';
        if (APPELS.has(nomC) && q.key === 0) return 'appel';
        if (PAS_AFFICHE.test(nomC) || /^_\./.test(nomC)) return null;
        const v = q.node.type === 'StringLiteral' ? q.node.value : null;
        if (v && /^[A-ZÀ-Ü]/.test(v) && /\s/.test(v)) return 'arg';
        return null;
      }
      return null;
    }
  };
  traverse(ast, {
    JSXText(p) {
      const n = p.node; const cuit = cuireJsx(n.value);
      if (!estTexte(cuit)) return;
      garder(p, n, 'jsxtext', cuit.replace(/^ +| +$/g, ''), null);
    },
    JSXAttribute(p) {
      const n = p.node;
      if (!n.name || !ATTR.has(n.name.name) || !n.value || n.value.type !== 'StringLiteral') return;
      if (!estTexte(n.value.value)) return;
      garder(p.get('value'), n.value, 'attr', n.value.value, null);
    },
    StringLiteral(p) { if (p.parentPath.isJSXAttribute() || p.parentPath.isImportDeclaration() || p.parentPath.isExportDeclaration()) return; const c = contexte(p); if (c) lit(p, c); },
    TemplateLiteral(p) { if (p.parentPath.isTaggedTemplateExpression()) return; const c = contexte(p); if (c) lit(p, c); },
  });

  // Les clés.
  const nouvelles = {}; const parT = new Map();
  for (const it of items) {
    const jt = J(it.texte);
    let k = parTexte.get(jt) || parT.get(jt);
    if (!k) { const base = `${prefixe}.${nomCle(typeof it.texte === 'string' ? it.texte : it.texte.other)}`; k = base; let i = 2; while ((k in fr && J(fr[k]) !== jt) || (k in nouvelles && J(nouvelles[k]) !== jt)) k = `${base}${i++}`; nouvelles[k] = it.texte; }
    parT.set(jt, k); it.cle = k;
  }
  const plan = { fichier, prefixe, zones, items: items.sort((a, b) => a.start - b.start), nouvelles, manuels };
  fs.writeFileSync(sortie, JSON.stringify(plan, null, 1));
  fs.writeFileSync(sortie + '.tsv', Object.entries(nouvelles).map(([k, v]) => `${k}\t${typeof v === 'string' ? v : v.one + ' ¦ ' + v.other}`).join('\n') + '\n');
  console.log(`${fichier} · ${zones.join(', ')} — ${items.length} texte(s), ${Object.keys(nouvelles).length} clé(s) nouvelle(s), ${manuels.length} à la main`);
  for (const m of manuels) console.log(`  à la main  ${String(m.ligne).padStart(6)}  ${m.pourquoi} : ${String(m.texte).slice(0, 110)}`);
}

function appliquer() {
  const plan = JSON.parse(fs.readFileSync(args[1], 'utf8'));
  const tradF = opt('traductions');
  const trad = {};
  if (tradF) for (const l of fs.readFileSync(tradF, 'utf8').split('\n')) {
    if (!l.trim() || l.startsWith('#')) continue;
    const c = l.split('\t');
    if (c.length !== 5) { console.log(`ligne mal formée (5 colonnes) : ${l.slice(0, 120)}`); process.exit(1); }
    trad[c[0]] = c.slice(1).map((x) => x.trim());
    const f0 = plan.nouvelles[c[0]]; const f1 = typeof f0 === 'string' ? f0 : f0 && f0.other;
    if (typeof f1 === 'string') { const a = f1.match(/^\s*/)[0], b = f1.match(/\s*$/)[0]; trad[c[0]] = trad[c[0]].map((x) => x.split(/\s*¦\s*/).map((y) => a + y + b).join(' ¦ ')); }
  }
  const manque = Object.keys(plan.nouvelles).filter((k) => !trad[k]);
  if (manque.length) { console.log(`traductions absentes : ${manque.join(', ')}`); process.exit(1); }
  const vars = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
  // Un pluriel : « une ¦ plusieurs » dans chaque colonne (une seule forme ⇒ la même pour les deux).
  for (const k of Object.keys(plan.nouvelles)) if (typeof plan.nouvelles[k] === 'object') trad[k] = trad[k].map((x) => { const [a, b] = x.split(/\s*¦\s*/); return { one: a, other: b == null ? a : b }; });
  else if (trad[k].some((x) => x.includes('¦'))) { console.log(`« ¦ » dans une clé qui n'est pas un pluriel : ${k}`); process.exit(1); }
  const vfr = (v) => vars(typeof v === 'string' ? v : v.other);
  const varsKo = Object.keys(plan.nouvelles).filter((k) => trad[k].some((x) => (typeof x === 'string' ? [x] : [x.other]).some((y) => vars(y) !== vfr(plan.nouvelles[k]))));
  if (varsKo.length) { console.log(`variables différentes du français : ${varsKo.map((k) => `${k} [${vfr(plan.nouvelles[k])}] ⇒ ${trad[k].map(vfr).join(' | ')}`).join('\n  ')}`); process.exit(1); }
  const f = path.join(R, plan.fichier);
  let src = fs.readFileSync(f, 'utf8');
  for (const it of plan.items) if (src.slice(it.start, it.end) !== it.brut) { console.log(`le fichier a changé depuis le plan (ligne ${it.ligne}) : refaire « lister »`); process.exit(1); }
  const items = [...plan.items].sort((a, b) => b.start - a.start);
  for (const it of items) {
    const appel = it.vars && it.vars.length ? `tr('${it.cle}', { ${[...new Map(it.vars.map((v) => [v.nom, v.expr])).entries()].map(([n, e]) => `${n}: String(${e})`).join(', ')} })` : `tr('${it.cle}')`;
    let rempl;
    if (it.quoi === 'jsxtext') {
      const b = it.brut; const tete = b.match(/^[ \t\r\n]*/)[0], queue = b.slice(tete.length).match(/[ \t\r\n]*$/)[0];
      rempl = `${tete}{${appel}}${queue}`;
    } else if (it.quoi === 'attr') rempl = `{${appel}}`;
    else rempl = appel;
    src = src.slice(0, it.start) + rempl + src.slice(it.end);
  }
  // L'import.
  if (!/import\s*\{[^}]*\btr\b[^}]*\}\s*from\s*['"][./]*(?:\.\.\/)*i18n\/index\.js['"]/.test(src)) {
    const rel = path.relative(path.dirname(f), path.join(R, 'src', 'i18n', 'index.js')).replace(/\\/g, '/');
    const spec = rel.startsWith('.') ? rel : './' + rel;
    const imp = [...src.matchAll(/^import [^\n]*\n/gm)].pop();
    const ligneImp = `import { tr } from '${spec}';\n`;
    if (imp) src = src.slice(0, imp.index + imp[0].length) + ligneImp + src.slice(imp.index + imp[0].length);
    else src = ligneImp + src;
  }
  fs.writeFileSync(f, src);
  // Les dictionnaires.
  const nouv = Object.entries(plan.nouvelles);
  const ecrire = (v) => (typeof v === 'string' ? JSON.stringify(v) : `{ one: ${JSON.stringify(v.one)}, other: ${JSON.stringify(v.other)} }`);
  if (nouv.length) for (const [i, l] of LANGUES.entries()) {
    const d = path.join(R, 'src', 'i18n', 'langues', `${l}.js`);
    let t = fs.readFileSync(d, 'utf8');
    const bloc = `  // ── ${plan.prefixe} (${plan.zones.join(', ')})\n` + nouv.map(([k, v]) => `  ${JSON.stringify(k)}: ${ecrire(i === 0 ? v : trad[k][i - 1])},`).join('\n') + '\n';
    const fin = t.lastIndexOf('};');
    t = t.slice(0, fin) + bloc + t.slice(fin);
    fs.writeFileSync(d, t);
  }
  console.log(`${plan.fichier} : ${plan.items.length} texte(s) remplacé(s), ${nouv.length} clé(s) ajoutée(s) aux cinq langues`);
}

if (cmd === 'lister') lister();
else if (cmd === 'appliquer') appliquer();
else { console.log('usage : lister | appliquer (voir l’en-tête)'); process.exit(2); }
