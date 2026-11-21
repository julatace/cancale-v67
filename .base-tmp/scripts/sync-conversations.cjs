// Une seule définition éditable de la fusion, générée dans le worker classique.
const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');const file=path.join(root,'vinted-sync-extension/background.js');
const definition=fs.readFileSync(path.join(root,'src/conversations.js'),'utf8').replace(/^\/\/.*\n/,'').replace(/^export /,'').trim();
const old=fs.readFileSync(file,'utf8');if(!old.includes('// BEGIN CONVERSATION PARTAGEE') || !old.includes('// END CONVERSATION PARTAGEE'))throw new Error('Section de conversation du worker absente.');const updated=old.replace(/\/\/ BEGIN CONVERSATION PARTAGEE[\s\S]*?\/\/ END CONVERSATION PARTAGEE/,'// BEGIN CONVERSATION PARTAGEE\n'+definition+'\n// END CONVERSATION PARTAGEE');
if(updated===old)console.log('Fusion des conversations synchronisée.');else{fs.writeFileSync(file,updated);console.log('Fusion du worker actualisée.');}
