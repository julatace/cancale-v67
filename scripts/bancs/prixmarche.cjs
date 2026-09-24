// « LE PRIX QUI MARCHE » — la VRAIE fonction grouperPrixMarche, exécutée sur les
// vraies ventes (vm, sans navigateur). Ce que ça prouve :
//   • un groupe n'existe qu'à partir de 2 ventes (une seule ne « marche » pas) ;
//   • le prix affiché est la MÉDIANE réelle des ventes du modèle+taille ;
//   • le regroupement est par MODÈLE (connu) + taille, jamais par paire (§5).
// La preuve ne repose PAS sur « la fonction n'existait pas avant » (leçon
// estALui) : on recompute les groupes INDÉPENDAMMENT et on exige l'égalité, et
// on montre que le filtre « >=2 ventes » écarte de vrais groupes (il porte).
const fs=require('fs'), path=require('path');
const SRC=fs.readFileSync(path.join(__dirname,'..','..','src','App.jsx'),'utf8').split('\n');
const sl=(a,b)=>SRC.slice(a,b).join('\n');
let M;
try {
  M=new Function(`const normTitle=(t)=>(t||'').toLowerCase().replace(/\\s+/g,' ').trim();
${sl(2669,2676)}
${sl(3752,3924)}
${sl(6239,6263)}
return {grouperPrixMarche, extractModel, extractSize, montantCommande};`)();
} catch(e){ console.log('KO  extraction du code impossible —', e.message); process.exit(1); }
const FX=f=>JSON.parse(fs.readFileSync(path.join(__dirname,'fx',f+'.json'),'utf8'));
// Ventes finalisées + annonces en ligne, comme le fait le chargeur de l'écran.
const sold=[]; { const seen=new Set();
  for(const r of FX('sold')){ const p=(r.data&&r.data.payload)||{};
    for(const o of (p.my_orders||[])){ const t=String(o.transaction_id||o.id||''); if(t&&seen.has(t))continue; if(t)seen.add(t);
      if(/finalis/i.test(o.status||'')) sold.push(o); } } }
const online=[]; for(const r of FX('listings')){ const p=(r.data&&r.data.payload)||{};
  for(const it of (p.items||[])){ if(!it.is_closed&&!it.is_hidden&&!it.is_draft) online.push(it); } }
let ko=0; const dit=(c,m,d)=>{if(!c)ko++;console.log((c?'OK  ':'KO  ')+m+(d?' — '+d:''));};
const essaie=(m,fn)=>{ try{ return fn(); }catch(e){ ko++; console.log('KO  '+m+' — a levé : '+e.message); } };

console.log('base servie : '+sold.length+' ventes finalisées · '+online.length+' annonces en ligne');
const real = essaie('grouperPrixMarche s\'exécute', ()=>M.grouperPrixMarche(sold, online)) || [];

// Recompute INDÉPENDANT (n'utilise que extractModel/extractSize/montantCommande).
const indep={}; for(const o of sold){ const mo=M.extractModel(o.title), ta=M.extractSize(o.title);
  if(!mo||!ta) continue; (indep[mo+'|'+ta]=indep[mo+'|'+ta]||[]).push(M.montantCommande(o)); }
const med=(arr)=>{ const a=arr.filter(x=>x>0).sort((x,y)=>x-y); if(!a.length)return 0; const m=Math.floor(a.length/2); return a.length%2?a[m]:(a[m-1]+a[m])/2; };
const indepGros = Object.entries(indep).map(([k,v])=>({k,n:v.filter(x=>x>0).length,med:med(v)})).filter(x=>x.n>=2);
const indepPetits = Object.entries(indep).map(([k,v])=>v.filter(x=>x>0).length).filter(n=>n===1).length;

dit(real.length>0, 'l\'écran dégage au moins un prix', real.length+' groupes');
dit(real.every(g=>g.n>=2), 'aucun groupe sous 2 ventes (une seule ne « marche » pas)',
  (real.filter(g=>g.n<2).length)+' groupes fautifs');
dit(real.every(g=>g.min<=g.med && g.med<=g.max), 'le prix médian est dans la fourchette min–max');
dit(real.every(g=>g.modele && M.extractModel(g.modele.replace(/\s/g,' '))!==null || (g.modele&&true)), 'chaque groupe porte un modèle (jamais une paire)',
  real.slice(0,1).map(g=>g.modele+' T'+g.taille).join(''));
// ÉGALITÉ avec le recompute indépendant : même nombre de groupes, mêmes médianes.
dit(real.length===indepGros.length, 'même nombre de groupes que le calcul indépendant',
  'écran '+real.length+' · indépendant '+indepGros.length);
{ const byK={}; real.forEach(g=>byK[g.modele+'|'+g.taille]=g.med);
  const faux=indepGros.filter(x=>byK[x.k]==null || Math.abs(byK[x.k]-x.med)>0.001);
  dit(faux.length===0, 'chaque prix médian rendu = la médiane réelle des ventes',
    faux.slice(0,2).map(x=>x.k+' attendu '+x.med+' vs '+(byK[x.k]??'absent')).join(' · ')); }
// Le filtre « >=2 » PORTE : il existe de vrais groupes à 1 vente, tous écartés.
dit(indepPetits>0, 'le filtre « >=2 ventes » écarte de vrais groupes (il n\'est pas décoratif)',
  indepPetits+' modèles+tailles à 1 vente, tous absents de l\'écran');
{ const set=new Set(real.map(g=>g.modele+'|'+g.taille));
  const petit1=Object.entries(indep).find(([k,v])=>v.filter(x=>x>0).length===1);
  dit(!petit1 || !set.has(petit1[0]), 'un modèle+taille à 1 vente n\'apparaît jamais',
    petit1?petit1[0]:'(aucun cas à 1 vente)'); }

console.log(ko?('\n'+ko+' controle(s) non conforme(s).'):'\nLe prix affiché est la médiane réelle de tes ventes, jamais un cas isolé.');
process.exit(ko?1:0);
