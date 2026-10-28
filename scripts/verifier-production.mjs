// Sonde publique, en lecture seule, sans compte ni contenu vendeur.
import {execFileSync} from 'node:child_process';
const origin='https://vrm.center';
function lire(path){
 const raw=execFileSync('curl',['--silent','--show-error','--max-time','20','--proto','=https','--write-out','\n%{http_code}',origin+path],{encoding:'utf8',maxBuffer:2e6});
 const i=raw.lastIndexOf('\n');return {status:Number(raw.slice(i+1)),body:raw.slice(0,i)};
}
let erreurs=0;
for(const [path,verifier] of [
 ['/',r=>r.status===200&&r.body.includes('/assets/')],
 ['/recuperation.html',r=>r.status===200&&r.body.includes('recuperation.js')&&r.body.includes('id="nouveau"')],
 ['/api/sante',r=>{try{return r.status===200&&JSON.parse(r.body).ok===true;}catch{return false;}}],
 ['/api/compte?mode=confidentialite',r=>r.status===401],
]){
 try{const r=lire(path),ok=verifier(r);console.log(`${ok?'OK':'ÉCHEC'} ${path} : HTTP ${r.status}`);if(!ok)erreurs++;}
 catch{console.error(`ÉCHEC réseau : ${path}`);erreurs++;}
}
console.log('Sonde publique uniquement : ne vérifie ni la livraison des emails, ni les comptes privés, ni la capacité de charge.');
process.exitCode=erreurs?1:0;
