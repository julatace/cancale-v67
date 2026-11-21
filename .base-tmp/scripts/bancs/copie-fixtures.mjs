// Copies fraîches pour le banc. ⚠️ §4.4 : on ne copie JAMAIS les PDF (6 Mo).
import fs from 'fs';
const U=process.argv[2], K=process.argv[3];
const H={apikey:K,Authorization:'Bearer '+K};
async function tout(sel){ let out=[],from=0; for(;;){ const r=await fetch(U+'/rest/v1/'+sel,{headers:{...H,Range:`${from}-${from+499}`}});
  if(!r.ok) throw new Error(r.status+' '+sel); const j=await r.json(); out=out.concat(j); if(j.length<500) break; from+=500; } return out; }
const q=async(s)=>{const r=await fetch(U+'/rest/v1/'+s,{headers:H}); if(!r.ok) throw new Error(r.status); return r.json();};

// ventes fraîches
const ids=await q("app_data?id=like.harvest_*_orders_sold&select=id");
const sold=[]; for(const r of ids){ const o=await q(`app_data?id=eq.${encodeURIComponent(r.id)}&select=id,data`); if(o[0]) sold.push(o[0]); }
fs.writeFileSync('fx/sold.json', JSON.stringify(sold));

// bordereaux : SANS les PDF, mais on garde `filename` (le témoin) et on pose
// un pdfB64 factice de 4 octets pour que la ligne reste réaliste sans le poids.
const champs=['uid','type','suivi','modele','numero','taille','account','article',
  'filename','posKnown','dateLimite','receivedAt','transaction'];
const bord=await tout("app_data?id=like.email_bord_*&select=id,"+champs.map(c=>`${c}:data->>${c}`).join(','));
const bordRows=bord.map(r=>{const d={}; champs.forEach(c=>{ if(r[c]!=null) d[c]=r[c]; }); if(d.filename) d.pdfB64='JVBE'; return {id:r.id,data:d};});
fs.writeFileSync('fx/bord.json', JSON.stringify(bordRows));

// bordereaux captés par l'extension (scalaires)
const lab=await tout("app_data?id=like.harvest_*_label_*&select=id,tx:data->>tx,item:data->>item,capturedAt:data->>capturedAt");
fs.writeFileSync('fx/label.json', JSON.stringify(lab.map(r=>({id:r.id,data:{tx:r.tx,item:r.item,capturedAt:r.capturedAt,pdfB64:'JVBE'}}))));

console.log('ventes :',sold.length,'lignes · bordereaux :',bordRows.length,'(dont',bordRows.filter(r=>r.data.filename).length,'avec PDF) · labels :',lab.length);
console.log('poids fixtures :', Math.round((JSON.stringify(sold).length+JSON.stringify(bordRows).length)/1024),'Ko');
