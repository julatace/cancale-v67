const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),PL=require('pdf-lib');
const source=fs.readFileSync('src/App.jsx','utf8');
const extract=name=>source.match(new RegExp('const '+name+' = [\\s\\S]*?\\n};'))[0];
const chercher=vm.runInNewContext(extract('trouverZoneBlanche')+';trouverZoneBlanche');
const stamp=vm.runInNewContext(extract('drawBordereauStamp')+';drawBordereauStamp');
const W=500,H=300, pixels=new Uint8ClampedArray(W*H*4).fill(255);
// Faux code QR central : seules les marges sont libres.
for(let y=60;y<240;y++)for(let x=150;x<350;x++){const i=(y*W+x)*4;pixels[i]=pixels[i+1]=pixels[i+2]=0;}
const zone=chercher(pixels,W,H,100,30,18);assert.ok(zone);
for(let y=zone.y-18;y<zone.y+48;y++)for(let x=zone.x-18;x<zone.x+118;x++)assert.equal(pixels[(y*W+x)*4],255);
assert.equal(chercher(new Uint8ClampedArray(W*H*4),W,H,100,30,18),null,'Page occupée : aucun placement');
assert.equal(chercher(pixels,40,30,100,30,18),null,'Page trop petite : refus');
(async()=>{
  for(const [width,height] of [[595,842],[842,595],[283,425]]) {
    const doc=await PL.PDFDocument.create();const p=doc.addPage([width,height]);
    p.drawRectangle({x:width/2,y:height/2,width:40,height:40,color:PL.rgb(0,0,0)});
    const bold=await doc.embedFont(PL.StandardFonts.HelveticaBold),reg=await doc.embedFont(PL.StandardFonts.Helvetica);
    p.scaleContent=()=>{throw Error('Ne pas réduire le document');};p.drawRectangle=()=>{throw Error('Ne pas couvrir le document');};
    assert.throws(()=>stamp(doc,PL.rgb,bold,reg,'125','Test',{xr:.4,yr:.4}),/non vérifié/);
    stamp(doc,PL.rgb,bold,reg,'125','Test',{x:20,y:20,w:160,h:38,verifie:true});
    const loaded=await PL.PDFDocument.load(await doc.save());assert.equal(loaded.getPages()[0].getWidth(),width);assert.equal(loaded.getPages()[0].getHeight(),height);
  }
  console.log('OK : zone blanche et marge vérifiées pixel par pixel, refus page occupée, anciennes coordonnées refusées, aucune réduction ni rectangle opaque sur trois formats PDF.');
})().catch(e=>{console.error(e);process.exitCode=1;});
