// (6 nov., vitesse 2) Sorti tel quel de src/ebayGestion.jsx : Messages s'en sert pour
// TOUTES les conversations, sans charger les écrans eBay (chargés à la demande).
import React,{useEffect,useState} from 'react';
import {createPortal} from 'react-dom';

// (24 nov., WCAG 2.1 AA) Au téléphone le fil est posé SUR l'écran (portail plein écran) : une feuille modale
// (`aria-modal`) ; à l'ordinateur, un volet à côté de la liste (pas modal). Même seuil que le portail.
export const telFil = () => { try { return window.matchMedia('(max-width:767px)').matches; } catch (_) { return false; } };
export function ResponsiveChatPortal({children}){
 const [mobile,setMobile]=useState(()=>window.matchMedia('(max-width:767px)').matches);
 useEffect(()=>{const m=window.matchMedia('(max-width:767px)'),change=()=>setMobile(m.matches);m.addEventListener('change',change);return()=>m.removeEventListener('change',change);},[]);
 return mobile?createPortal(children,document.body):children;
}
