// (6 nov., vitesse 2) Sorti tel quel de src/ebayGestion.jsx : Messages s'en sert pour
// TOUTES les conversations, sans charger les écrans eBay (chargés à la demande).
import React,{useEffect,useState} from 'react';
import {createPortal} from 'react-dom';

export function ResponsiveChatPortal({children}){
 const [mobile,setMobile]=useState(()=>window.matchMedia('(max-width:767px)').matches);
 useEffect(()=>{const m=window.matchMedia('(max-width:767px)'),change=()=>setMobile(m.matches);m.addEventListener('change',change);return()=>m.removeEventListener('change',change);},[]);
 return mobile?createPortal(children,document.body):children;
}
