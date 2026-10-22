// Une lecture à la fois ; un signal reçu pendant la lecture impose une reprise.
export function suivreReceptionLeboncoin({fenetre,document,relire,onErreur=()=>{},delai=400}) {
  let vivant=true,enCours=false,encore=false,timer=null;
  const executer=async()=>{
    if(!vivant)return;
    if(enCours){encore=true;return;}
    enCours=true;
    try{do{encore=false;try{await relire(()=>vivant);}catch(e){if(vivant)onErreur(e);}}while(vivant&&encore);}
    finally{enCours=false;}
  };
  const actualiser=()=>{
    if(!vivant)return;
    if(enCours){encore=true;return;}
    clearTimeout(timer);timer=setTimeout(executer,delai);
  };
  const retour=()=>{if(!document.hidden)actualiser();};
  const signal=e=>{if(e?.detail?.type==='maj'&&e.detail.quoi==='lbc')actualiser();};
  fenetre.addEventListener('focus',retour);
  document.addEventListener('visibilitychange',retour);
  fenetre.addEventListener('vrm:ext',signal);
  return {actualiser,arreter(){vivant=false;encore=false;clearTimeout(timer);fenetre.removeEventListener('focus',retour);document.removeEventListener('visibilitychange',retour);fenetre.removeEventListener('vrm:ext',signal);}};
}

// Une requête perdue ne laisse pas le bouton « Actualiser » attendre sans fin.
export async function lireReceptionLeboncoin(url,headers,{transport=fetch,delai=12000}={}) {
  const controle=new AbortController(),timer=setTimeout(()=>controle.abort(),delai);
  try{const r=await transport(url,{headers,cache:'no-store',signal:controle.signal});return r.ok?await r.json():null;}
  catch(_){return null;}
  finally{clearTimeout(timer);}
}
