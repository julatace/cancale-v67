// (Ces composants vivent dans App.jsx lui-même : lu tel quel, sans recoller src/ecrans/*.jsx.)
// LA MÊME ENTRÉE VERS LA FICHE DEPUIS LES TROIS PLATEFORMES (Vinted, Leboncoin, eBay).
// (14 nov., proposition 62) Toucher la ligne d'une vente ouvre LA fiche de la paire (src/ficheLigne.js), désignée par les N°
// trouvés PAR IDENTITÉ (`numerosArticle`) — avant, le toucher ouvrait un tiroir puis « Fiche article N°… → ». Le vrai
// `LigneVenteCompacte` (et `CompteVente`) d'App.jsx est rendu avec les VRAIS ficheLigne.js, DansFiche.jsx, Numero.jsx et
// i18n ; seuls la photo, l'icône, la note privée et le geste « Retour » sont posés neutres (présentation).
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{chromium}=require('playwright'),esbuild=require('esbuild');
const racine=path.resolve(__dirname,'../..');
(async()=>{
 const s=fs.readFileSync(path.join(racine,'src/App.jsx'),'utf8');
 const bout=(debut)=>{const a=s.indexOf(debut);assert.ok(a>=0,'introuvable : '+debut);const b=s.indexOf('\nfunction ',a+10);return s.slice(a,b);};
 const compte=s.slice(s.indexOf('const TEXTE_COMPTE_PAS_SU ='),s.indexOf('\nfunction ',s.indexOf('function CompteVente(')+10));
 assert.ok(compte.includes('function CompteVente(')&&compte.includes('const compteFourni'),'CompteVente introuvable');
 const composant=bout('function LigneVenteCompacte(');
 const cleNum=s.slice(s.indexOf('const cleNum = (v) => {'),s.indexOf('\n};\n',s.indexOf('const cleNum = (v) => {'))+4);assert.ok(cleNum.length>20);
 const bundle=await esbuild.build({stdin:{resolveDir:path.join(racine,'src'),loader:'jsx',contents:`
 import React from 'react';import ReactDOM from 'react-dom/client';import {createPortal} from 'react-dom';
 import { abonner, ligneOuverte, ouvrirLigne, fermerLigne, lireLigne, attrsFicheLigne } from './ficheLigne.js';
 import DansFiche from './DansFiche.jsx';import { Numero } from './composants/Numero.jsx';
 import { tr } from './i18n/index.js';import { trj } from './i18n/react.js';
 ${cleNum}
 const FermeAuRetour=()=>null,Icon=()=>React.createElement('span'),PhotoVente=()=>React.createElement('span',null,'Photo'),NotePaireCoque=()=>null;
 const Bouton=({variante,style,children,...p})=>React.createElement('button',{type:'button',...p},children);
 ${compte}
 ${composant}
 window.ouvertures=[];abonner(()=>{const l=ligneOuverte();if(l)window.ouvertures.push({site:l.site,nums:l.nums});});
 ReactDOM.createRoot(document.getElementById('root')).render(React.createElement('div',{className:'vrm-app-shell vrm-main'},['vinted','leboncoin','ebay'].map((plateforme,i)=>React.createElement(LigneVenteCompacte,{key:plateforme,plateforme,titre:'Article '+plateforme,sous:'Compte test',etat:'À expédier',montant:'50 €',numerosArticle:i===2?['C125','C125 ']:['C125']},React.createElement('p',null,'Actions de cette vente')))));
 window.fermerLigne=fermerLigne;`},bundle:true,write:false,format:'iife',logLevel:'silent',define:{'process.env.NODE_ENV':'"development"'},loader:{'.css':'empty'}});
 const b=await chromium.launch({executablePath:process.env.VRM_CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
 for(const width of [390,1512]){
 const p=await b.newPage({viewport:{width,height:950}});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('http://vrm.test/**',r=>r.fulfill({contentType:'text/html',body:'<div id="root"></div>'}));await p.goto('http://vrm.test/');
 for(const file of ['styles-gestion.css','styles-annonces-ventes.css'])await p.addStyleTag({content:fs.readFileSync(path.join(racine,'src',file),'utf8')});
 await p.addScriptTag({content:bundle.outputFiles[0].text});
 for(const plateforme of ['vinted','leboncoin','ebay']){
  const row=p.locator(`[data-plateforme-vente="${plateforme}"]`);await row.waitFor();
  assert.equal(await row.getAttribute('data-fl-num'),'C125',`${plateforme} : la ligne porte le N° trouvé par identité`);
  const avant=await p.evaluate(()=>ouvertures.length);
  await row.locator('button').first().click();
  await p.waitForFunction(n=>ouvertures.length===n+1,avant);
  assert.equal(await row.getAttribute('data-ligne-ouverte'),'false',`${plateforme} : la fiche s'ouvre, pas l'ancien tiroir`);
  await p.evaluate(()=>fermerLigne());
 }
 assert.deepEqual(await p.evaluate(()=>ouvertures),[{site:'vinted',nums:['C125']},{site:'leboncoin',nums:['C125']},{site:'ebay',nums:['C125']}]);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
 console.log(`OK ${width}px : même entrée vers la fiche (N°C125) depuis les trois plateformes, sans tiroir, sans débordement.`);await p.close();
 }
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
