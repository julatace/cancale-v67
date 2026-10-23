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
// ⚠️ (22 oct.) Ni `signal` ni mode de cache passés à `fetch` : l'un comme l'autre
// font sortir la lecture de la règle des lectures partagées (src/lecturesPartagees.js),
// et `lbc_ventes` était alors lue TROIS fois à l'ouverture de Ma journée (la coque,
// l'écran, le centre de notifications) au lieu d'une — mesuré au banc `vitesse.cjs`.
// L'attente est bornée ici : passé le délai on rend « pas su » (null), la lecture
// en vol finit sans personne pour l'attendre. Une lecture identique en vol, ou
// finie il y a moins de 2 s, est aussi fraîche qu'une neuve ; un signal de
// l'extension (`vrm:ext`) ou une écriture vident ce partage.
export async function lireReceptionLeboncoin(url,headers,{transport=fetch,delai=12000}={}) {
  let timer;
  const expire=new Promise(r=>{timer=setTimeout(()=>r(undefined),delai);});
  try{
    const lecture=(async()=>{const r=await transport(url,{headers});return r.ok?await r.json():null;})();
    const rep=await Promise.race([lecture,expire]);
    return rep===undefined?null:rep;
  }
  catch(_){return null;}
  finally{clearTimeout(timer);}
}
