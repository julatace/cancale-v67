// La recherche de zone libre (3 nov.) : exécutée seule, sur des cartes de pixels.
// Le chemin complet (rendu, bande, fiche, rotation) : scripts/bancs/tampon-bordereau.cjs.
require('../_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../../src/App.jsx'),'utf8');
const region=source.slice(source.indexOf('// ── LE TAMPON DU BORDEREAU'),source.indexOf('// ── IMPRIMANTE NORMALE OU THERMIQUE'));
const {trouverZoneBlanche:chercher}=new Function(region+';return {trouverZoneBlanche};')();
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
