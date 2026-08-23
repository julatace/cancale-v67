#!/usr/bin/env node
// BANC : la récupération du PDF INSISTE quand Vinted ne l'a pas encore produit,
// et n'insiste PAS sur un refus dur. Exécute la VRAIE fonction du fichier.
const fs=require('fs'), vm=require('vm');
const SRC=fs.readFileSync('/home/user/cancale-v67/vinted-sync-extension/background.js','utf8');
const deb=SRC.indexOf('const LABEL_ATTENTES_MS');
const fin=SRC.indexOf('async function genererBordereauxEnAttente');
const bloc=SRC.slice(deb,fin);
let ko=0; const ok=t=>console.log('✅ '+t); const nok=(t,d)=>{ko++;console.log('❌ '+t+(d?' — '+d:''));};

const essai = async (nom, reponses, attenduOk, attenduEssais) => {
  let n=0; const diag=[];
  const ctx={ console,
    setTimeout:(f)=>f(),                       // pas d'attente réelle au banc
    noterDiag:async(k)=>{diag.push(k);},
    recupererLabel:async()=>{ const r=reponses[Math.min(n,reponses.length-1)]; n++; return r; } };
  vm.createContext(ctx);
  vm.runInContext(bloc+'\nglobalThis.__f = recupererLabelInsiste;', ctx);
  const r=await ctx.__f({},'1','tx');
  const pbs=[];
  if(!!r.ok!==attenduOk) pbs.push(`ok=${r.ok} au lieu de ${attenduOk}`);
  if(n!==attenduEssais) pbs.push(`${n} essai(s) au lieu de ${attenduEssais}`);
  pbs.length?nok(nom,pbs.join(' · ')):ok(`${nom} → ${n} essai(s), ${r.ok?'PDF envoyé':'abandon'}${diag.length?' ['+diag.join(',')+']':''}`);
};

(async()=>{
  const pasEncore={ok:false,raison:"Vinted n'a pas donné l'URL du PDF"};
  const pasExpe={ok:false,raison:"Vinted n'expose pas encore l'expédition de cette vente"};
  const dur={ok:false,raison:'Téléchargement du PDF refusé par le navigateur — recharge l\'extension (permissions)'};
  const vide={ok:false,raison:'PDF vide'};
  const bon={ok:true};

  await essai('PDF prêt du premier coup', [bon], true, 1);
  await essai('PDF prêt au 2e essai', [pasEncore,bon], true, 2);
  await essai('PDF prêt au 4e (dernier) essai', [pasEncore,pasEncore,pasEncore,bon], true, 4);
  await essai("l'expédition n'existe pas encore, puis oui", [pasExpe,bon], true, 2);
  await essai('jamais prêt → abandon après 4 essais', [pasEncore], false, 4);
  await essai('refus DUR (permissions) → aucun réessai', [dur], false, 1);
  await essai('PDF vide → aucun réessai', [vide], false, 1);

  console.log(ko?`\n${ko} cas non conforme(s).`:'\nLa récupération du PDF insiste juste ce qu\'il faut.');
  process.exit(ko?1:0);
})();
