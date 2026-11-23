// ── src/conseiller/Presentation.jsx — la présentation animée du Conseiller (23 nov.) ──────────────────────────────
// Julien : « fais un vrai accompagnement ; n'hésite pas à faire du motion design pour expliquer ». Au PREMIER passage sur
// l'écran Conseiller : une feuille, 4 étapes de ~4,5 s (≈ 18 s), chacune une petite scène animée en CSS (aucune image,
// aucune bibliothèque) et une phrase : ce qu'est un conseil · d'où viennent les chiffres · rien ne part sans ton toucher ·
// comment poser une question. « Passer » à tout moment ; les points disent où l'on en est et se touchent.
// Mouvement réduit (prefers-reduced-motion) : aucune animation et aucun défilement automatique — il avance à son rythme.
// « Vu » : sur CET appareil (une commodité d'affichage, jamais une donnée ; lecture/écriture protégées).
import React from 'react';
import { Feuille, Bouton } from '../natif/index.js';
import { tr } from '../i18n/index.js';

export const CLE_PRESENTATION = 'vrm_conseiller_presentation_vue';
export const ETAPES = ['conseil', 'source', 'toucher', 'question'];
export const DUREE_ETAPE_MS = 4500;
export function presentationVue() { try { return !!localStorage.getItem(CLE_PRESENTATION); } catch (_) { return true; /* stockage muet : on ne l'impose pas */ } }
export function noterPresentationVue() { try { localStorage.setItem(CLE_PRESENTATION, new Date().toISOString()); } catch (_) { /* rien */ } }
const mouvementReduit = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };

// Les quatre scènes. Des boîtes et des traits aux couleurs des jetons ; les classes `n-pres-*` portent le mouvement.
function Scene({ etape }) {
  if (etape === 'conseil') return (
    <div className="n-pres-scene n-pres-carte" data-pres-scene="conseil" aria-hidden="true">
      {[0, 1, 2].map((k) => <span key={k} className="n-pres-ligne" data-k={k}><span className="n-pres-rond"/><span className="n-pres-traits"><span className="n-pres-trait" data-l="long"/><span className="n-pres-trait" data-l="court"/></span>{k === 0 ? <span className="n-pres-pastille"/> : null}<span className="n-pres-bouton"/></span>)}
    </div>);
  if (etape === 'source') return (
    <div className="n-pres-scene n-pres-sources" data-pres-scene="source" aria-hidden="true">
      <span className="n-pres-colonne">{['ventes', 'argent', 'annonces'].map((k) => <span key={k} className="n-pres-source">{tr('cons.pres.src.' + k)}</span>)}</span>
      <span className="n-pres-flux">{[0, 1, 2].map((k) => <span key={k} className="n-pres-point" data-k={k}/>)}</span>
      <span className="n-pres-cible"><span className="n-pres-trait" data-l="long"/><span className="n-pres-trait" data-l="court"/><span className="n-pres-chiffre">12</span></span>
    </div>);
  if (etape === 'toucher') return (
    <div className="n-pres-scene n-pres-toucher" data-pres-scene="toucher" aria-hidden="true">
      <span className="n-pres-gros-bouton">{tr('cons.pres.ouvrir')}</span>
      <span className="n-pres-doigt"/>
      <span className="n-pres-onde"/>
    </div>);
  return (
    <div className="n-pres-scene n-pres-question" data-pres-scene="question" aria-hidden="true">
      <span className="n-pres-champ"><span className="n-pres-tape">{tr('ia.sugg.baisser')}</span><span className="n-pres-curseur"/></span>
      <span className="n-pres-reponse"><span className="n-pres-trait" data-l="long"/><span className="n-pres-trait" data-l="moyen"/></span>
    </div>);
}

export default function Presentation({ ouverte, onFermer }) {
  const [k, setK] = React.useState(0);
  const reduit = React.useMemo(mouvementReduit, []);
  React.useEffect(() => { if (ouverte) setK(0); }, [ouverte]);
  React.useEffect(() => {
    if (!ouverte || reduit || k >= ETAPES.length - 1) return undefined;
    const t = setTimeout(() => setK((x) => Math.min(ETAPES.length - 1, x + 1)), DUREE_ETAPE_MS);
    return () => clearTimeout(t);
  }, [ouverte, reduit, k]);
  const fermer = () => { noterPresentationVue(); if (onFermer) onFermer(); };
  const derniere = k === ETAPES.length - 1;
  const e = ETAPES[k];
  return (
    <Feuille ouverte={ouverte} onFermer={fermer} titre={tr('cons.pres.titre')} detente="auto"
      action={!derniere ? <Bouton variante="texte" onClick={fermer} attrs={{ 'data-pres-passer': '' }}>{tr('cons.pres.passer')}</Bouton> : null}
      pied={<Bouton variante="plein" onClick={derniere ? fermer : () => setK(k + 1)} attrs={{ 'data-pres-suivant': derniere ? 'fin' : String(k + 1) }}>{derniere ? tr('cons.pres.fin') : tr('cons.pres.suivant')}</Bouton>}
      attrs={{ 'data-pres': e, 'data-pres-reduit': reduit ? '1' : '0' }}>
      <div className="n-pres" key={e}>
        <Scene etape={e}/>
        <p className="n-pres-titre">{tr('cons.pres.' + e + '.titre')}</p>
        <p className="n-pres-phrase">{tr('cons.pres.' + e + '.phrase')}</p>
        <div className="n-pres-points" role="tablist" aria-label={tr('cons.pres.etapes')}>
          {ETAPES.map((x, i) => <button key={x} type="button" role="tab" aria-selected={i === k ? 'true' : 'false'} aria-label={tr('cons.pres.etape', { n: i + 1, total: ETAPES.length })} className="n-pres-pt" data-actif={i === k ? '1' : undefined} onClick={() => setK(i)}><span/></button>)}
        </div>
      </div>
    </Feuille>
  );
}
