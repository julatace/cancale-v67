// La recherche de zone libre (3 nov.) : exécutée seule, sur des cartes de pixels.
// Le chemin complet (rendu, bande, fiche, rotation) : scripts/bancs/tampon-bordereau.cjs.
require('../_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../../src/App.jsx'),'utf8');
const region=source.slice(source.indexOf('// ── LE TAMPON DU BORDEREAU'),source.indexOf('// ── IMPRIMANTE NORMALE OU THERMIQUE'));
const {trouverZoneBlanche:chercher,placeMentionVrm,MENTION}=new Function(region+';return {trouverZoneBlanche,placeMentionVrm:typeof placeMentionVrm==="function"?placeMentionVrm:null,MENTION:typeof MENTION==="object"?MENTION:null};')();
const W=500,H=300,carte=(v)=>new Uint8ClampedArray(W*H*4).fill(v);
const peindre=(px,x0,y0,x1,y1,v)=>{for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const i=(y*W+x)*4;px[i]=px[i+1]=px[i+2]=v;}};
// Un faux QR au centre : seule la marge autour est libre, et elle est respectée.
const px=carte(255);peindre(px,150,60,350,240,0);
const z=chercher(px,W,H,100,30,18);assert.ok(z);
for(let y=z.y-18;y<z.y+48;y++)for(let x=z.x-18;x<z.x+118;x++)assert.equal(px[(y*W+x)*4],255,'la zone et sa marge sont libres');
assert.equal(chercher(carte(0),W,H,100,30,18),null,'page noire : aucune zone');
assert.equal(chercher(px,40,30,100,30,18),null,'page trop petite : aucune zone');
// Fond gris clair (luminance 224) : c'est du papier.
assert.ok(chercher(carte(224),W,H,100,30,18),'gris clair = libre');
assert.equal(chercher(carte(150),W,H,100,30,18),null,'gris foncé = encre');
// Bruit de scan : des points noirs ISOLÉS ne bloquent pas, un trait si.
const bruit=carte(245);for(let i=0;i<300;i++){const x=(i*97)%W,y=(i*61)%H;peindre(bruit,x,y,x+1,y+1,40);}
assert.ok(chercher(bruit,W,H,100,30,18),'points isolés ignorés');
const traits=carte(255);for(let y=0;y<H;y+=20)peindre(traits,0,y,W,y+2,0);
assert.equal(chercher(traits,W,H,100,30,18),null,'des traits tous les 20 px : aucune zone de 66 px');
// Marges distinctes : 5 mm sur les côtés (zone de silence d'un code-barres).
const barre=carte(255);peindre(barre,0,0,200,H,0);
const zb=chercher(barre,W,H,100,30,{mx:21,my:15});assert.ok(zb&&zb.x>=221,'au moins mx à droite du code-barres');
console.log('OK : zone libre et marges respectées, gris clair libre, bruit isolé ignoré, traits et page pleine refusés.');
// (11 nov.) LA MENTION « Créé par VRM » : la même recherche, partie du coin
// bas-droit, hors de l'encre + marges, des zones interdites et d'une bordure.
assert.ok(placeMentionVrm&&MENTION,'placeMentionVrm existe');
assert.equal(MENTION.texte,'Créé par vrm.center');   // (11 nov.) le texte retenu (Quoi de neuf « cree-par-vrm »)assert.ok(MENTION.taille>=6&&MENTION.taille<=7,'6–7 pt');
{
 const W2=600,H2=800,page=new Uint8ClampedArray(W2*H2*4).fill(255),bw=40,bh=9;
 const encre=(x0,y0,x1,y1)=>{for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const i=(y*W2+x)*4;page[i]=page[i+1]=page[i+2]=0;}};
 encre(420,600,560,760);                                  // un QR dans le coin bas-droit
 const tampon={x:30,y:30,w:180,h:44},interdit={x:0,y:300,w:W2,h:150}; // le N° en haut, une étiquette au milieu
 const r={pixels:page,w:W2,h:H2,s:1},p=placeMentionVrm(r,bw,bh,[tampon,interdit]);
 assert.ok(p,'une place existe');
 const B=MENTION.bord,inter=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y,boite={x:p.x,y:p.y,w:bw,h:bh};
 assert.ok(!inter(boite,{x:420-14,y:600-10,w:140+28,h:160+20}),'jamais sur le QR ni dans sa marge');
 assert.ok(!inter(boite,tampon)&&!inter(boite,interdit),'jamais dans une zone interdite');
 assert.ok(p.x>=B&&p.y>=B&&p.x+bw<=W2-B&&p.y+bh<=H2-B,'hors de la bordure non imprimable');
 assert.ok(p.y>H2-B-10-bh-6,'au plus bas possible (coin bas) : '+JSON.stringify(p));
 for(let y=p.y-10;y<p.y+bh+10;y++)for(let x=p.x-14;x<p.x+bw+14;x++)assert.equal(page[(y*W2+x)*4],255,'la mention et sa marge sont sur du papier');
 // Plus aucune place sûre ⇒ null (aucune mention).
 assert.equal(placeMentionVrm(r,bw,bh,[{x:0,y:0,w:W2,h:H2}]),null,'tout est interdit : rien');
 assert.equal(placeMentionVrm({pixels:new Uint8ClampedArray(W2*H2*4).fill(0),w:W2,h:H2,s:1},bw,bh,[]),null,'page pleine : rien');
 // MUTATION : sans les interdits, la mention tomberait dans l'étiquette ⇒ ce test le voit.
 const sans=placeMentionVrm(r,bw,bh,[{x:0,y:0,w:W2,h:449}]);assert.ok(sans&&!inter({x:sans.x,y:sans.y,w:bw,h:bh},{x:0,y:0,w:W2,h:449}),'les interdits sont bien respectés');
}
console.log('OK : mention « Créé par VRM » hors encre, QR, zones interdites et bordure ; rien sans place sûre.');
