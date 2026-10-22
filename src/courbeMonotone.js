// Interpolation monotone : aucun sommet ajouté entre deux mesures.
export function cheminMonotone(points) {
 if(!points.length)return '';
 if(points.length===1)return `M${points[0][0]},${points[0][1]}`;
 const p=points,dy=[],m=[];
 for(let i=0;i<p.length-1;i++)dy.push((p[i+1][1]-p[i][1])/(p[i+1][0]-p[i][0]));
 m.push(dy[0]);for(let i=1;i<p.length-1;i++)m.push(dy[i-1]*dy[i]<=0?0:(dy[i-1]+dy[i])/2);m.push(dy.at(-1));
 for(let i=0;i<dy.length;i++){
  if(dy[i]===0){m[i]=m[i+1]=0;continue;}
  const a=m[i]/dy[i],b=m[i+1]/dy[i],h=a*a+b*b;
  if(h>9){const t=3/Math.sqrt(h);m[i]=t*a*dy[i];m[i+1]=t*b*dy[i];}
 }
 let d=`M${p[0][0].toFixed(2)},${p[0][1].toFixed(2)}`;
 for(let i=0;i<p.length-1;i++){const h=(p[i+1][0]-p[i][0])/3;d+=` C${(p[i][0]+h).toFixed(2)},${(p[i][1]+m[i]*h).toFixed(2)} ${(p[i+1][0]-h).toFixed(2)},${(p[i+1][1]-m[i+1]*h).toFixed(2)} ${p[i+1][0].toFixed(2)},${p[i+1][1].toFixed(2)}`;}
 return d;
}
