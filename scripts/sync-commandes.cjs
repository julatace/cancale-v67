// Une seule définition éditable de la fusion des commandes (src/commandesFusion.js),
// recopiée dans le worker classique (`background.js`, bloc COMMANDES PARTAGEES).
// `--verifier` : n'écrit rien, sort en erreur si la copie diffère (audit).
const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');
const file=process.env.VRM_BG||path.join(root,'vinted-sync-extension/background.js');
const definition=fs.readFileSync(path.join(root,'src/commandesFusion.js'),'utf8').replace(/^\/\/.*\n/,'').replace(/^export /gm,'').trim();
const old=fs.readFileSync(file,'utf8');
if(!old.includes('// BEGIN COMMANDES PARTAGEES')||!old.includes('// END COMMANDES PARTAGEES'))throw new Error('Section des commandes du worker absente.');
const updated=old.replace(/\/\/ BEGIN COMMANDES PARTAGEES[\s\S]*?\/\/ END COMMANDES PARTAGEES/,()=>'// BEGIN COMMANDES PARTAGEES\n'+definition+'\n// END COMMANDES PARTAGEES');
if(process.argv.includes('--verifier')){if(updated!==old){console.log('❌ background.js : la fusion des commandes diffère de src/commandesFusion.js — node scripts/sync-commandes.cjs');process.exit(1);}console.log('✅ fusion des commandes : background.js = src/commandesFusion.js');process.exit(0);}
if(updated===old)console.log('Fusion des commandes synchronisée.');else{fs.writeFileSync(file,updated);console.log('Fusion des commandes du worker actualisée.');}
