import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {suivreReceptionLeboncoin} from '../../src/rafraichissementLeboncoin.js';
import { createRequire as creerRequireSourceApp } from 'node:module';
creerRequireSourceApp(import.meta.url)('../_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const s=fs.readFileSync(new URL('../../src/App.jsx',import.meta.url),'utf8'),pause=()=>new Promise(r=>setTimeout(r,20));
// (22 nov.) Les deux lecteurs PROJETTENT `lbc_ventes` (`select=ventes:data->ventes`, §4.4) : la base sert la FORME de la
// projection (§6.3), pas la ligne entière. Ce faux PostgREST applique le `select=` de l'URL à LA ligne rangée
// (`alias:data->a->b`, `data->>x`, `data`) et refuse toute autre ligne que `lbc_ventes`.
function projeter(url,ligne){
 const u=new URL(url);assert.equal(u.searchParams.get('id'),'eq.lbc_ventes');
 const sel=u.searchParams.get('select');assert.ok(sel,'lecture projetée');
 const sortie={};
 for(const brut of sel.split(',')){
  const [alias,chemin]=brut.includes(':')?brut.split(/:(.*)/s):[null,brut];
  const segs=chemin.split(/->>?/);let v=ligne;for(const k of segs)v=v!=null&&typeof v==='object'?v[k]:undefined;
  if(/->>/.test(chemin)&&v!=null&&typeof v==='object')v=JSON.stringify(v);
  sortie[alias||segs[segs.length-1]]=v===undefined?null:v;
 }
 return [sortie];
}
for(const [nom,ancre] of [['ventes et finances', '  const [lbcCoqueLu,setLbcCoqueLu]=useState(undefined);'],['Ma journée', "  // ── LES MESSAGES eBAY SANS RÉPONSE, POUR MA JOURNÉE"]])test(`${nom} : une vente actualisée remplace la lecture ancienne au retour`,async()=>{
 const i=s.indexOf(ancre);assert.ok(i>=0,'ancre introuvable : '+nom);
 const a=s.indexOf('  useEffect(',i),b=s.indexOf('  }, []);',a)+'  }, []);'.length;
 const fenetre=new EventTarget(),document=new EventTarget();document.hidden=false;let nettoyer,valeur,lu,lectures=0;let donnees={tx:{txId:'tx',isSeller:true,price:4000,stepStatus:'paid'},achat:{txId:'achat',isSeller:false,price:1000}};
 const lire=async url=>{lectures++;return projeter(url,{id:'lbc_ventes',data:{ventes:donnees}});};
 const ctx={window:fenetre,document,useEffect:f=>nettoyer=f(),suivreReceptionLeboncoin:o=>suivreReceptionLeboncoin({...o,delai:2}),lireReceptionLeboncoin:lire,lireBaseRelue:lire,SUPABASE_URL:'https://base.test',sbAuth:()=>({}),lbcAnnulee:()=>false,setLbcVentes:v=>valeur=v,setLbcCoqueLu:v=>lu=v,setLbcLu:v=>lu=v};
 vm.runInNewContext(s.slice(a,b),ctx);await pause();assert.equal(lectures,1);assert.equal(lu,true);assert.equal(valeur.ventes.length,1);assert.equal(valeur.ventes[0].price,4000);assert.equal(valeur.achats.length,1);
 donnees={...donnees,tx:{...donnees.tx,price:4500,stepStatus:'completed'}};fenetre.dispatchEvent(new Event('focus'));await pause();assert.equal(lectures,2);assert.equal(valeur.ventes.length,1);assert.equal(valeur.ventes[0].price,4500);assert.equal(valeur.ventes[0].stepStatus,'completed');
 // Une relecture ratée (null = pas su) ne garde ni n'efface en silence : l'état devient « pas su ».
 const avant=valeur;ctx.lireBaseRelue=ctx.lireReceptionLeboncoin=async()=>null;
 fenetre.dispatchEvent(new Event('focus'));await pause();assert.equal(lu,null);assert.equal(valeur,avant,'une lecture ratée ne remplace pas les ventes par une liste vide');
 nettoyer();
});
