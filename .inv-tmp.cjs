const L=require("fs").readFileSync(process.argv[2],"utf8").split("\n");
L.forEach((l,i)=>{ if(!/(vintedPage(Photo)?|vintedSend)\(/.test(l)&&!/executerPourAppCoeur\(\{/.test(l))return; if(/async function vinted/.test(l))return; if(/'GET'/.test(l)&&!/'(POST|PUT|DELETE)'/.test(l))return;
 let f="?"; for(let j=i;j>=0;j--){const m=/^(?:async )?function ([\w$]+)/.exec(L[j]); if(m){f=m[1]+"@"+(j+1);break;}}
 console.log((i+1)+"\t"+f+"\t"+l.trim().slice(0,140));});
