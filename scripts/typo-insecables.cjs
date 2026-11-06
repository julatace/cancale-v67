// ═══════════════════════════════════════════════════════════════════════════
//  LES ESPACES INSÉCABLES DES TEXTES DE L'APP (6 nov., v36-finition)
//  node scripts/typo-insecables.cjs [--ecrire] [--signes=€%:;?!] [fichiers…]
// ═══════════════════════════════════════════════════════════════════════════
// En français, « € », « % », « : », « ; », « ? », « ! » ne passent jamais seuls à la
// ligne : l'espace qui les précède est insécable (U+00A0). Les textes de l'app étaient
// écrits à l'espace ORDINAIRE (« 12 € », « Statut : … ») — sur un téléphone, le « € »
// tombait seul sur la ligne suivante.
//
// Ce script relit les sources (src/**/*.js, *.jsx, ou les fichiers nommés) par l'arbre
// syntaxique (@babel/parser) — jamais par recherche de texte brut — et ne touche QUE
// des textes destinés à l'écran :
//   · texte JSX (« … €</b> ») : l'espace devient `&nbsp;` ;
//   · chaînes et gabarits (« ' €' », « `${n} €` ») : l'espace devient ` `.
// Il n'écrit jamais dans : une clé d'objet, un import, une comparaison (`===`), un
// attribut technique (className, data-*, style, href, id, key, type, role), une chaîne
// passée à includes/startsWith/endsWith/indexOf/split/replace/match/test/RegExp
// (une recherche dans un texte LU de Vinted ou d'un e-mail doit garder l'espace qu'il
// porte), ni un texte sans lettre ni chiffre avant le signe.
// Sans `--ecrire` : rend la liste (fichier, ligne, avant → après), n'écrit rien.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const RACINE = path.join(__dirname, '..');
const parser = require(path.join(RACINE, 'node_modules', '@babel', 'parser'));
const args = process.argv.slice(2);
const ECRIRE = args.includes('--ecrire');
const SIGNES = ((args.find((a) => a.startsWith('--signes=')) || '').slice(9) || '€%:;?!').split('');
const nommes = args.filter((a) => !a.startsWith('--'));
const fichiers = [];
if (nommes.length) fichiers.push(...nommes.map((f) => path.resolve(f)));
else (function f(d) { for (const n of fs.readdirSync(d)) { const p = path.join(d, n); const s = fs.statSync(p); if (s.isDirectory()) f(p); else if (/\.(jsx?|mjs)$/.test(n)) fichiers.push(p); } })(path.join(RACINE, 'src'));

const ATTR_TECH = /^(className|class|style|href|src|id|key|type|role|name|value|htmlFor|for|rel|target|method|action|accept|autoComplete|inputMode|pattern|d|viewBox|fill|stroke|points|transform)$|^data-|^on[A-Z]/;
const APPELS_RECHERCHE = new Set(['includes', 'startsWith', 'endsWith', 'indexOf', 'lastIndexOf', 'split', 'replace', 'replaceAll', 'match', 'matchAll', 'test', 'search', 'RegExp', 'querySelector', 'querySelectorAll', 'closest', 'getItem', 'setItem', 'removeItem', 'get', 'set', 'has', 'fetch', 'require']);
// « mot :» / « 12 € » / « ») ? » : avant l'espace, une lettre, un chiffre ou un signe fermant.
const avantOk = /[\p{L}\p{N}»)\]}%'’"]$/u;

function chemins(src, ast) {
  const sorties = [];
  const visite = (n, parent, gp) => {
    if (!n || typeof n.type !== 'string') return;
    const genre = n.type === 'JSXText' || (n.type === 'StringLiteral' && parent && parent.type === 'JSXAttribute') ? 'jsx' : n.type === 'StringLiteral' ? 'chaine' : n.type === 'TemplateElement' ? 'gabarit' : null;
    if (genre) {
      let saute = false;
      if (parent) {
        if (parent.type === 'ImportDeclaration' || parent.type === 'ExportAllDeclaration' || parent.type === 'ExportNamedDeclaration') saute = true;
        if ((parent.type === 'ObjectProperty' || parent.type === 'ObjectMethod' || parent.type === 'ClassProperty') && parent.key === n) saute = true;
        if (parent.type === 'BinaryExpression' && /^(===|!==|==|!=|in)$/.test(parent.operator)) saute = true;
        if (parent.type === 'SwitchCase') saute = true;
        if (parent.type === 'JSXAttribute' && ATTR_TECH.test((parent.name && parent.name.name) || '')) saute = true;
        if (parent.type === 'MemberExpression' && parent.property === n) saute = true;
        const appel = parent.type === 'CallExpression' || parent.type === 'NewExpression' ? parent : (parent.type === 'TemplateLiteral' && gp && (gp.type === 'CallExpression' || gp.type === 'NewExpression') ? gp : null);
        if (appel && appel.callee) { const c = appel.callee; const nom = c.type === 'Identifier' ? c.name : c.type === 'MemberExpression' && c.property ? c.property.name : ''; if (APPELS_RECHERCHE.has(nom)) saute = true; }
        if (parent.type === 'TaggedTemplateExpression' || (parent.type === 'TemplateLiteral' && gp && gp.type === 'TaggedTemplateExpression')) saute = true;
      }
      if (!saute) {
        // Le texte tel qu'écrit dans le fichier, et sa position.
        let debut = n.start, fin = n.end;
        if (n.type === 'StringLiteral') { debut += 1; fin -= 1; }
        const brut = src.slice(debut, fin);
        // Une chaîne en `'…'` ou un gabarit : un « \n » écrit reste « \n » (on ne touche qu'aux espaces).
        const premier = genre === 'gabarit' && parent && parent.quasis && parent.quasis[0] !== n;
        for (const signe of SIGNES) {
          const esc = signe.replace(/[?]/g, '\\?');
          const re = new RegExp(` (?=${esc}(?:[\\s»"'’)\\].,<]|$))`, 'g');
          let m;
          while ((m = re.exec(brut))) {
            const i = m.index;
            const avant = brut.slice(0, i);
            // Après « ${…} » (gabarit) ou « {…} » (JSX : le texte suit une expression) : l'expression vaut un mot.
            // … ou une chaîne collée à droite d'un `+` (« n.toFixed(2) + ' €' »).
            const apresExpr = (i === 0 && (premier || (genre === 'jsx' && src[debut - 1] === '}') || (parent && parent.type === 'BinaryExpression' && parent.operator === '+' && parent.right === n)));
            if (!apresExpr && !avantOk.test(avant)) continue;
            // « ? » et « ! » collés à une expression JS (« a ? b ») ne sont pas du texte : on reste dans du texte.
            if (signe === '%' && !/\d$/.test(avant) && !apresExpr) continue;
            sorties.push({ pos: debut + i, genre, signe, ligne: src.slice(0, debut + i).split('\n').length, extrait: brut.slice(Math.max(0, i - 24), i + 6) });
          }
        }
      }
    }
    for (const k of Object.keys(n)) {
      if (k === 'loc' || k === 'start' || k === 'end' || k === 'leadingComments' || k === 'trailingComments' || k === 'innerComments' || k === 'extra') continue;
      const v = n[k];
      if (Array.isArray(v)) { for (const c of v) if (c && typeof c.type === 'string') visite(c, n, parent); }
      else if (v && typeof v.type === 'string') visite(v, n, parent);
    }
  };
  visite(ast.program, null, null);
  return sorties;
}

let total = 0;
const parFichier = {};
for (const p of fichiers) {
  const src = fs.readFileSync(p, 'utf8');
  let ast;
  try { ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx'] }); } catch (e) { console.log('⚠️  illisible', path.relative(RACINE, p), e.message); continue; }
  const s = chemins(src, ast).sort((a, b) => b.pos - a.pos);
  if (!s.length) continue;
  parFichier[path.relative(RACINE, p)] = s.length; total += s.length;
  if (!ECRIRE) { for (const x of s.slice().reverse()) console.log(`${path.relative(RACINE, p)}:${x.ligne}  ${x.genre}  « ${x.extrait.replace(/\n/g, '⏎')} »`); continue; }
  let out = src;
  for (const x of s) out = out.slice(0, x.pos) + (x.genre === 'jsx' ? '&nbsp;' : '\\u00a0') + out.slice(x.pos + 1);
  fs.writeFileSync(p, out);
}
console.log(`\n${total} espace(s) à rendre insécable(s)${ECRIRE ? ' — écrit' : ''} :`, parFichier);
