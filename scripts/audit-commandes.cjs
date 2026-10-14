// Inventaire de toutes les définitions natives de boutons ; aucune action distante.
const fs=require('node:fs'),path=require('node:path'),parser=require('@babel/parser');
const root=path.resolve(__dirname,'..'),items=[];
const content=n=>n.type==='JSXText'?n.value.trim():n.type==='JSXExpressionContainer'?(n.expression.type==='JSXEmptyExpression'?'':'[calculé]'):n.type==='JSXElement'?(n.children||[]).map(content).join(' '):'';
for(const file of fs.readdirSync(path.join(root,'src')).filter(f=>f.endsWith('.jsx'))){
 const src=fs.readFileSync(path.join(root,'src',file),'utf8');
 function walk(n,scope='module'){
  if(!n||typeof n!=='object')return;
  if(n.type==='FunctionDeclaration'&&n.id)scope=n.id.name;
  if(n.type==='JSXElement'&&n.openingElement.name.name==='button'){
   const attrs=n.openingElement.attributes;const attr=k=>attrs.find(a=>a.name?.name===k);const has=k=>!!attr(k);
   const text=n.children.map(content).join(' ').replace(/\s+/g,' ').trim();
   const label=attr('aria-label')||attr('aria-labelledby')||attr('title');
   const nom=label?.value?.type==='StringLiteral'?label.value.value:label?'[nom calculé]':text;
   const type=attr('type')?.value?.value;
   items.push({file,line:n.loc.start.line,scope,nom,type,disabled:has('disabled'),expanded:has('aria-expanded'),selected:has('aria-pressed')||has('aria-current')||has('aria-checked'),delegue:attrs.some(a=>a.type==='JSXSpreadAttribute'),action:attrs.some(a=>/^on[A-Z]/.test(a.name?.name||'')),ambigu:!label&&(!text||!/[a-zA-ZÀ-ÿ0-9]/.test(text))});
  }
  for(const[k,v]of Object.entries(n)){if(['loc','start','end','extra'].includes(k))continue;if(Array.isArray(v))v.forEach(x=>walk(x,scope));else if(v&&typeof v==='object')walk(v,scope);}
 }
 walk(parser.parse(src,{sourceType:'module',plugins:['jsx']}));
}
const invalides=items.filter(x=>!['button','submit','reset'].includes(x.type)||x.ambigu);
console.log(`${items.length} définitions : ${invalides.length} sans type explicite ou sans nom utilisable.`);
for(const x of invalides)console.error(`${x.file}:${x.line} — ${x.nom||'nom absent'}`);
const i=process.argv.indexOf('--rapport');if(i>=0){const fichier=path.resolve(root,process.argv[i+1]);const escape=s=>String(s).replace(/\|/g,'/').replace(/\n/g,' ');const lines=['# Inventaire des boutons','',`Source : ${items.length} définitions natives dans tous les fichiers JSX de src.`, '', 'Cet inventaire vérifie les types explicites et les noms dans le code. Les noms calculés, les états dépendant des comptes et les actions distantes nécessitent une vérification au rendu. Il ne prétend pas tester tous les clics sur des comptes réels.', '', '| Fichier : ligne | Composant | Nom | Type | État disponible |', '|---|---|---|---|---|',...items.map(x=>`| ${x.file}:${x.line} | ${x.scope} | ${escape(x.nom)} | ${x.type||'absent'} | ${[x.disabled?'désactivé':'',x.expanded?'ouvert/fermé':'',x.selected?'sélection':''].filter(Boolean).join(', ')||'—'} |`)];fs.writeFileSync(fichier,lines.join('\n')+'\n');console.log('Rapport : '+path.relative(root,fichier));}
process.exitCode=invalides.length?1:0;
