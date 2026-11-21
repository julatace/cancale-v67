const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),source=path.join(root,'vrm-capture-extension'),publicDir=path.join(root,'public');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'vrm-capture-'));
try{
 for(const orion of [false,true]){
  const dir=path.join(tmp,orion?'orion':'chrome');fs.mkdirSync(dir);
  for(const f of ['manifest.json','background.js','capture.js','popup.html','popup.js'])fs.copyFileSync(path.join(source,f),path.join(dir,f));
  fs.copyFileSync(path.join(source,'LIRE-MOI.txt'),path.join(dir,'LIRE-MOI.txt'));
  if(orion){
   const m=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));m.manifest_version=2;m.browser_action=m.action;delete m.action;m.background={scripts:['compat-orion.js','background.js'],persistent:false};m.permissions=[...m.permissions,...m.content_scripts[0].matches];m.content_scripts[0].js=['compat-orion.js','capture.js'];
   fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(m,null,2)+'\n');fs.copyFileSync(path.join(root,'scripts/extension-orion/compat-orion.js'),path.join(dir,'compat-orion.js'));
   const p=path.join(dir,'popup.html');fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace('<script src="popup.js">','<script src="compat-orion.js"></script><script src="popup.js">'));
  }
  for(const f of fs.readdirSync(dir))fs.utimesSync(path.join(dir,f),new Date('2020-01-01'),new Date('2020-01-01'));
  const out=path.join(publicDir,orion?'VRM-Capture-Orion.xpi':'VRM-Capture.zip');fs.rmSync(out,{force:true});execFileSync('zip',['-qrX',out,...fs.readdirSync(dir).sort()],{cwd:dir});console.log(out);
  if(orion)fs.copyFileSync(out,path.join(publicDir,'VRM-Capture-Orion.zip'));
 }
 fs.copyFileSync(path.join(source,'LIRE-MOI.txt'),path.join(publicDir,'VRM-Capture-installation.txt'));
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
