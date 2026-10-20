// Mini PostgREST pour servir une copie fraîche (lecture seule) à l'app rendue.
function getPath(row, path){
  if(path==='id'||path==='owner'||path==='updated_at') return row[path];
  const m=/^(data|meta)(.*)$/.exec(path); if(!m) return row[path];
  let v=row[m[1]]; const segs=m[2].split(/(->>|->)/).filter(Boolean);
  let txt=false;
  for(let i=0;i<segs.length;i++){ const s=segs[i]; if(s==='->'){txt=false;continue;} if(s==='->>'){txt=true;continue;}
    if(v==null) return null;
    if(Array.isArray(v)&&/^-?\d+$/.test(s)){ const n=+s; v=n<0?v[v.length+n]:v[n]; }
    else v=v[s];
  }
  if(txt && v!=null && typeof v==='object') return JSON.stringify(v);
  if(txt && v!=null) return String(v);
  return v===undefined?null:v;
}
function likeRe(p,ci){ return new RegExp('^'+p.replace(/[.+?^${}()|[\]\\]/g,'\\$&').replace(/[*%]/g,'.*')+'$', ci?'i':''); }
function contient(a,b){ if(b===null||typeof b!=='object') return a===b || (a!=null && typeof b!=='object' && String(a)===String(b));
  if(Array.isArray(b)){ if(!Array.isArray(a)) return false; return b.every(x=>a.some(y=>contient(y,x))); }
  if(a==null||typeof a!=='object') return false; return Object.keys(b).every(k=>contient(a[k],b[k])); }
function test(row,col,expr){
  let neg=false; if(expr.startsWith('not.')){neg=true;expr=expr.slice(4);}
  const i=expr.indexOf('.'); const op=expr.slice(0,i), val=expr.slice(i+1);
  const v=getPath(row,col); let r;
  switch(op){
    case 'eq': r= v!=null && String(v)===val; break;
    case 'neq': r= v!=null && String(v)!==val; break;
    case 'is': r= val==='null'? v==null : (val==='true'? v===true||v==='true' : v===false||v==='false'); break;
    case 'like': r= v!=null && likeRe(val).test(String(v)); break;
    case 'ilike': r= v!=null && likeRe(val.replace(/^"|"$/g,'').replace(/\\"/g,'"'),true).test(String(v)); break;
    case 'gte': r= v!=null && (isNaN(+v)||isNaN(+val) ? String(v)>=val : +v>=+val); break;
    case 'gt': r= v!=null && (isNaN(+v)||isNaN(+val) ? String(v)>val : +v>+val); break;
    case 'lte': r= v!=null && (isNaN(+v)||isNaN(+val) ? String(v)<=val : +v<=+val); break;
    case 'lt': r= v!=null && (isNaN(+v)||isNaN(+val) ? String(v)<val : +v<+val); break;
    case 'in': { const l=val.replace(/^\(|\)$/g,'').split(',').map(s=>s.replace(/^"|"$/g,'')); r= v!=null && l.includes(String(v)); break; }
    case 'cs': { let b; try{ b=JSON.parse(val);}catch(_){ b=null; } let a=v; if(typeof a==='string'){try{a=JSON.parse(a);}catch(_){}} r= b!=null && contient(a,b); break; }
    default: r=true;
  }
  return neg?!r:r;
}
function splitTop(s){ const out=[]; let d=0,cur='',q=false; for(const c of s){ if(c==='"'&&cur.slice(-1)!=='\\') q=!q; if(!q&&c==='(')d++; if(!q&&c===')')d--; if(!q&&d===0&&c===','){out.push(cur);cur='';continue;} cur+=c; } if(cur) out.push(cur); return out; }
function cond(row,c){
  const m=/^(or|and)\((.*)\)$/.exec(c); if(m){ const parts=splitTop(m[2]); return m[1]==='or'?parts.some(p=>cond(row,p)):parts.every(p=>cond(row,p)); }
  // col.op.val — col peut contenir ->>
  const mm=/^([a-z_]+(?:(?:->>|->)[A-Za-z0-9_-]+)*)\.(.*)$/.exec(c); if(!mm) return true;
  return test(row,mm[1],mm[2]);
}
function projette(row,select){
  if(!select||select==='*') return {id:row.id,data:row.data,owner:row.owner,updated_at:row.updated_at};
  const out={};
  for(const part of splitTop(select)){
    const m=/^(?:([^:]+):)?(.+)$/.exec(part.trim()); if(!m) continue;
    const src=m[2]; const alias=m[1]||src.split(/->>|->/).pop();
    out[alias]=getPath(row,src);
  }
  return out;
}
function servir(rows,url,headers){
  const u=new URL(url); const p=u.searchParams;
  let res=rows.slice();
  for(const [k,v] of p.entries()){
    if(['select','order','limit','offset','on_conflict','columns'].includes(k)) continue;
    if(k==='or'||k==='and'){ res=res.filter(r=>cond(r,k+v)); continue; }
    res=res.filter(r=>test(r,k,v));
  }
  const o=p.get('order'); if(o){ const parts=o.split(','); res.sort((a,b)=>{ for(const pp of parts){ const mm=/^(.+?)(?:\.(asc|desc))?(?:\.nulls(first|last))?$/.exec(pp); const x=getPath(a,mm[1]), y=getPath(b,mm[1]); if(x==y) continue; const s=(x==null?-1:y==null?1:(x<y?-1:1)); return mm[2]==='desc'?-s:s; } return 0; }); }
  const total=res.length; let from=0,to=res.length-1;
  const rg=headers.range||headers.Range; if(rg){ const mm=/(\d+)-(\d+)/.exec(rg); if(mm){from=+mm[1];to=+mm[2];} }
  if(p.get('offset')) from=+p.get('offset'); if(p.get('limit')) to=from+(+p.get('limit'))-1;
  res=res.slice(from,to+1);
  return { body: res.map(r=>projette(r,p.get('select'))), range: `${from}-${from+res.length-1}/${total}` };
}
module.exports={servir,getPath,test};
