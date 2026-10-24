// The actual readiness function must prefer the latest addressed response over
// an unrelated missed page heartbeat. No network or Vinted message.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('src/App.jsx','utf8'),start=source.indexOf('function etatExtensionFavoris('),end=source.indexOf('\nfunction FavorisConnectes(',start);
const ctx={__vmrEtat:null,__vmrPlusieurs:null,codePerime:()=>true,textePerime:()=> 'old page',textePlusieurs:()=> 'duplicates',vmrExtPresent:()=>false,vmrExtVersion:()=>'',AUTH:{user:{id:'owner-A'}},EXT_CAPACITES:{favoris:'5.217.0'},cmpVersion:(a,b)=>a.localeCompare(b,undefined,{numeric:true})};vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);
const measured={ok:true,ext:'a'.repeat(32),version:'5.218.0',code:'5.218.0',vrm:{connecte:true,user_id:'owner-A'},vinted:{uid:'111'}};
assert.equal(ctx.etatExtensionFavoris('111',measured).disponible,true,'fresh addressed state overrides stale heartbeat');
assert.equal(ctx.etatExtensionFavoris('111').disponible,false,'no fresh measurement never assumes ready');
assert.equal(ctx.etatExtensionFavoris('111',{...measured,code:'5.216.0'}).disponible,false,'stale worker stays blocked');
assert.equal(ctx.etatExtensionFavoris('111',{...measured,vrm:{connecte:true,user_id:'owner-B'}}).disponible,false,'wrong VRM owner stays blocked');
assert.equal(ctx.etatExtensionFavoris('222',measured).disponible,false,'wrong Vinted account stays blocked');
ctx.__vmrPlusieurs=['5.218.0','5.218.0'];assert.equal(ctx.etatExtensionFavoris('111',measured).disponible,false,'duplicate copies stay blocked');
console.log('6 contrôles de disponibilité favoris réussis');
