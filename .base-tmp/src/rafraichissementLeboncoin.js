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
// ⚠️ (1er nov.) « Il ne doit plus y avoir d'erreur pendant la lecture des données
// Leboncoin » : un écran Leboncoin enchaîne une dizaine de lectures, et UNE seule
// lecture ratée suffisait à afficher « je n'ai pas pu lire… ». Or l'échec courant
// est PASSAGER — un jeton qui vient d'expirer (401 : `rafraichir` le renouvelle
// avant de relire, `headers` peut être une fonction pour reprendre le jeton neuf),
// une base qui hoquette (5xx, 408, 429), le réseau, un corps tronqué. Une SEULE
// relecture, `pauseRelecture` plus tard, dans le même délai total ; un refus net
// (400, 403, 404) ne se relit pas. Au bout : toujours `null` (« pas su »), jamais `[]`.
export async function lireReceptionLeboncoin(url,headers,{transport=fetch,delai=12000,rafraichir=null,pauseRelecture=800}={}) {
  let timer;
  const expire=new Promise(r=>{timer=setTimeout(()=>r(undefined),delai);});
  const entetes=()=>typeof headers==='function'?headers():headers;
  try{
    const lecture=(async()=>{
      for(let essai=0;essai<2;essai++){
        let r=null;
        try{r=await transport(url,{headers:entetes()});}catch(_){r=null;}
        if(r&&r.ok){try{return await r.json();}catch(_){/* corps illisible : relu une fois */}}
        const st=r?Number(r.status)||0:0;
        const passager=!r||r.ok||st===0||st===401||st===408||st===429||st>=500;
        if(!passager||essai>0)return null;
        if(st===401&&typeof rafraichir==='function'){try{await rafraichir();}catch(_){}}
        await new Promise(res=>setTimeout(res,pauseRelecture));
      }
      return null;
    })();
    const rep=await Promise.race([lecture,expire]);
    return rep===undefined?null:rep;
  }
  catch(_){return null;}
  finally{clearTimeout(timer);}
}
