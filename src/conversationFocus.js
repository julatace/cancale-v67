import {useEffect,useRef,useState} from 'react';

// Une conversation mobile est modale ; sur ordinateur la liste reste accessible.
export function useConversationFocus(panel,selectedId,onClose){
 const close=useRef(onClose);close.current=onClose;
 const [mobile,setMobile]=useState(()=>window.matchMedia('(max-width:767px)').matches);
 useEffect(()=>{const media=window.matchMedia('(max-width:767px)'),change=()=>setMobile(media.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
 useEffect(()=>{
  const node=panel.current;if(!selectedId || !node)return;
  const opener=document.activeElement;
  const locks=mobile?[document.body,document.querySelector('main')].filter(Boolean).map(el=>({el,value:el.style.getPropertyValue('overflow'),priority:el.style.getPropertyPriority('overflow')})):[];
  locks.forEach(({el})=>el.style.setProperty('overflow','hidden'));
  if(mobile)node.setAttribute('aria-modal','true');else node.removeAttribute('aria-modal');
  const controls=()=>[...node.querySelectorAll('button,input,select,textarea,a[href],[tabindex]')].filter(el=>!el.disabled && el.tabIndex>=0 && el.getClientRects().length>0);
  const initial=node.querySelector('[aria-label="Fermer la conversation eBay"]');
  initial?.focus({preventScroll:true});
  const keyboard=event=>{
   // Une confirmation d’envoi ouverte au-dessus conserve ses propres touches.
   if(!node.contains(event.target))return;
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close.current();return;}
   if(!mobile || event.key!=='Tab')return;
   const items=controls(),first=items[0],last=items[items.length-1];
   if(!first)return;
   if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
   else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
  };
  node.addEventListener('keydown',keyboard);
  return()=>{
   node.removeEventListener('keydown',keyboard);
   locks.forEach(({el,value,priority})=>{if(value)el.style.setProperty('overflow',value,priority);else el.style.removeProperty('overflow');});
   if(opener?.isConnected && opener!==document.body)opener.focus({preventScroll:true});
   else document.querySelector('[aria-label="Rechercher un message eBay"]')?.focus({preventScroll:true});
  };
 },[selectedId,mobile,panel]);
}
