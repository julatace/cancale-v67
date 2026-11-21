// Seules les valeurs déjà publiques dans l'app peuvent sortir de cette route.
export function configurationAuthPublique(url,cle){
 try{const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||!u.hostname.endsWith('.supabase.co'))return null;
  if(String(cle).startsWith('sb_publishable_'))return{url:u.origin,cle};
  const morceaux=String(cle).split('.');if(morceaux.length!==3)return null;
  const j=JSON.parse(Buffer.from(morceaux[1],'base64url').toString());
  return j.role==='anon'?{url:u.origin,cle}:null;
 }catch(_){return null;}
}
