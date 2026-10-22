import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {suivreReceptionLeboncoin} from '../../src/rafraichissementLeboncoin.js';
const s=fs.readFileSync(new URL('../../src/App.jsx',import.meta.url),'utf8'),pause=()=>new Promise(r=>setTimeout(r,20));
for(const [nom,ancre] of [['ventes et finances', '  const [lbcCoqueLu,setLbcCoqueLu]=useState(undefined);'],['Ma journée', "  // ── LES MESSAGES eBAY SANS RÉPONSE, POUR MA JOURNÉE"]])test(`${nom} : une vente actualisée remplace la lecture ancienne au retour`,async()=>{
 const a=s.indexOf('  useEffect(',s.indexOf(ancre)),b=s.indexOf('  }, []);',a)+'  }, []);'.length;
 const fenetre=new EventTarget(),document=new EventTarget();document.hidden=false;let nettoyer,valeur,lu;let donnees={tx:{txId:'tx',isSeller:true,price:4000,stepStatus:'paid'},achat:{txId:'achat',isSeller:false,price:1000}};
 const ctx={window:fenetre,document,useEffect:f=>nettoyer=f(),suivreReceptionLeboncoin:o=>suivreReceptionLeboncoin({...o,delai:2}),lireReceptionLeboncoin:async()=>[{data:{ventes:donnees}}],SUPABASE_URL:'https://base.test',sbAuth:()=>({}),lbcAnnulee:()=>false,setLbcVentes:v=>valeur=v,setLbcCoqueLu:v=>lu=v,setLbcLu:v=>lu=v};
 vm.runInNewContext(s.slice(a,b),ctx);await pause();assert.equal(lu,true);assert.equal(valeur.ventes.length,1);assert.equal(valeur.ventes[0].price,4000);
 donnees={...donnees,tx:{...donnees.tx,price:4500,stepStatus:'completed'}};fenetre.dispatchEvent(new Event('focus'));await pause();assert.equal(valeur.ventes.length,1);assert.equal(valeur.ventes[0].price,4500);assert.equal(valeur.ventes[0].stepStatus,'completed');nettoyer();
});
