// Rejoue les régressions dans des copies locales ; zéro appel marketplace réel.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const mutations=[
 ['écriture native non confirmée','api/ebay.js','post.ok && memeRegle(post.lecture,demande,P)!==false?post.lecture','post.ok?post.lecture','[Suite-incertain]'],
 ['règle USD oubliée','src/App.jsx',"engagement:avaitRegle && e.offresActives===true?'oui':null","engagement:null",'[R-engage]'],
 ['doute effacé sur la carte','src/App.jsx','lu:L.lu!==false','lu:true','[Suite-carte]'],
];
for(const [label,file,avant,apres,preuve] of mutations){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'vrm-agent-preuve-'));
 try{
  fs.cpSync(path.join(root,'api'),path.join(temp,'api'),{recursive:true});fs.mkdirSync(path.join(temp,'src'));fs.copyFileSync(path.join(root,'src/App.jsx'),path.join(temp,'src/App.jsx'));
  fs.writeFileSync(path.join(temp,'package.json'),' {"type":"module"}');fs.symlinkSync(path.join(root,'node_modules'),path.join(temp,'node_modules'),'dir');
  const target=path.join(temp,file),source=fs.readFileSync(target,'utf8');assert.equal(source.split(avant).length,2,'ancre unique : '+label);fs.writeFileSync(target,source.replace(avant,apres));
  const r=spawnSync(process.execPath,[path.join(root,'scripts/audit-ebay-route.cjs'),'--src',temp],{encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024});
  const rouges=(r.stdout || '').split('\n').filter(l=>l.startsWith('❌') && l.includes(preuve));assert.ok(r.status!==0 && rouges.length,'la mutation doit échouer sur son comportement : '+label+'\n'+r.stderr);
  console.log('OK mutation détectée : '+label+' · '+rouges.length+' contrôle(s)');
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
}
