const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
let n=0;const check=(v,m)=>{assert.ok(v,m);n++;};
const lire=(z,f)=>execFileSync('unzip',['-p',z,f]);
for(const orion of [false,true]){
 const z=path.resolve('public',orion?'VRM-Capture-Orion.xpi':'VRM-Capture.zip'),m=JSON.parse(lire(z,'manifest.json'));
 check(m.version==='1.0.0'&&m.name.startsWith('VRM Capture'),'identité autonome');
 check(m.manifest_version===(orion?2:3),'format du navigateur');
 check(m.permissions.includes('activeTab')&&m.permissions.includes('storage')&&!m.permissions.some(x=>['cookies','scripting','downloads','webRequest','debugger'].includes(x)),'permissions limitées à la capture');
 check(!m.host_permissions&&!m.externally_connectable,'pas de connexion à VRM ni origine serveur');
 for(const f of ['background.js','capture.js','popup.js','LIRE-MOI.txt'])check(lire(z,f).equals(fs.readFileSync(path.join('vrm-capture-extension',f))),f+' identique à la source');
 const html=lire(z,'popup.html').toString();check(html.includes('Enregistrer le parcours')&&!html.includes('id="auth"'),'bouton principal sans écran de connexion');
 if(orion){check(lire(z,'compat-orion.js').equals(fs.readFileSync('scripts/extension-orion/compat-orion.js')),'adaptateur Orion testé');check(m.background.scripts.includes('compat-orion.js')&&m.background.persistent===false,'fond Orion adapté');}
 for(const f of ['background.js','capture.js','popup.js'])check(!/\bfetch\s*\(|new\s+WebSocket|sendBeacon\s*\(|new\s+XMLHttpRequest/.test(lire(z,f).toString()),'aucune requête réseau dans '+f);
}
check(fs.readFileSync('public/VRM-Capture-Orion.xpi').equals(fs.readFileSync('public/VRM-Capture-Orion.zip')),'XPI et ZIP Orion identiques');
console.log(n+' contrôles des paquets Capture indépendants réussis');
