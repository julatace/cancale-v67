// ═══════════════════════════════════════════════════════════════════════════
// LA CARTE DE L'APERÇU (25 nov.) — Julien : « Il voit 5 ventes et 5 annonces et tu
// peux faire une animation sur ce qu'il peut faire », puis « Fais quelque chose de
// logique » : UNE carte, posée là où le flou commence (`data-apercu-debut`, voir
// src/abonnement/apercu.js), le même message et le même bouton partout :
//   · le compteur : « 142 ventes et 87 annonces lues » (les VRAIS nombres de ses
//     lignes ; pas su ⇒ la ligne se tait, jamais un « au moins » inventé) ;
//   · une courte séquence de ce qu'il pourra faire (exemples, marqués « Exemple » ;
//     aucun chiffre présenté comme le sien), en boucle ; mouvement réduit ⇒ la
//     même chose en liste fixe ;
//   · le prix des offres (Solo, Pro), lu de la source existante (serveur ; repli :
//     les prix des CGV) — passé par l'appelant, jamais écrit ici ;
//   · UN bouton plein : « Commencer l'essai gratuit » s'il y a droit (`essaiDispo`,
//     la règle du serveur), sinon « Débloquer tout ». Les deux cases légales (CGV,
//     accès immédiat) s'ouvrent DANS la carte au premier toucher.
// Présentation seule : la logique (paiement, retour) vit dans App.jsx
// (`ApercuSansAbonnement`). Les jetons et composants ACTUELS de l'app (aucun style neuf).
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr } from '../i18n/index.js';

export const SCENES_APERCU = [
  { cle: 'bordereaux', icone: 'printer' },
  { cle: 'favoris', icone: 'heart' },
  { cle: 'numeros', icone: 'tag' },
  { cle: 'benefice', icone: 'chart' },
  { cle: 'sites', icone: 'grid' },
];

function Scene({ s, Icon }) {
  return (
    <div className="vrm-apercu-scene" data-apercu-scene={s.cle}>
      <span className="vrm-apercu-scene-icone" aria-hidden="true">{Icon ? <Icon name={s.icone} size={22}/> : null}</span>
      <span className="vrm-apercu-scene-texte">{tr('apercuAbo.scene.' + s.cle)}</span>
      <span className="vrm-apercu-scene-dessin" aria-hidden="true" data-dessin={s.cle}>
        {s.cle === 'bordereaux' && <><i/><i/><i/></>}
        {s.cle === 'favoris' && <><i/><i/><i/></>}
        {s.cle === 'numeros' && <b>{tr('apercuAbo.exempleNumero')}</b>}
        {s.cle === 'benefice' && <><i/><i/><i/><i/></>}
        {s.cle === 'sites' && <><i/><i/><i/><i/></>}
      </span>
    </div>
  );
}

export function AnimationApercu({ Icon }) {
  return (
    <div className="vrm-apercu-anim" data-apercu-anim="" role="img" aria-label={tr('apercuAbo.animLibelle')}>
      <span className="vrm-apercu-exemple">{tr('apercuAbo.exemple')}</span>
      <div className="vrm-apercu-scenes">{SCENES_APERCU.map((s) => <Scene key={s.cle} s={s} Icon={Icon}/>)}</div>
    </div>
  );
}

// `e` : etatAbonnement ; `x` : la réponse du serveur ; `nVentes`/`nAnnonces` : nombres lus ou null.
export function CarteApercu({ e, x, nVentes, nAnnonces, prixSolo, prixPro, Icon, Bouton, cgv, montrerCgv, cgvOk, occupe, payable, onDebloquer, signe }) {
  const essai = !!(x && x.essaiDispo) && !e.impaye;
  const compteur = Number.isInteger(nVentes) && Number.isInteger(nAnnonces)
    ? tr('apercuAbo.compteur', { v: nVentes, a: nAnnonces })
    : Number.isInteger(nVentes) ? tr('apercuAbo.compteurVentes', { v: nVentes })
      : Number.isInteger(nAnnonces) ? tr('apercuAbo.compteurAnnonces', { a: nAnnonces }) : null;
  const titre = e.impaye ? tr('apercuAbo.titreImpaye') : compteur || tr('apercuAbo.titre');
  const libelle = occupe ? tr('apercuAbo.ouverture') : e.impaye ? tr('apercuAbo.carte') : essai ? tr('apercuAbo.essai') : tr('apercuAbo.debloquer');
  return (
    <div className="vrm-apercu-carte" role="region" aria-labelledby="vrm-apercu-titre" data-carte-apercu="" data-signe={signe || undefined}
      data-apercu-compteur={compteur ? '' : undefined} data-apercu-essai={essai ? '' : undefined} key={signe}>
      <div className="vrm-apercu-titre" id="vrm-apercu-titre">{titre}</div>
      <div className="vrm-apercu-phrase">{e.impaye ? tr('apercuAbo.phraseImpaye') : tr('apercuAbo.phrase')}</div>
      {!e.impaye && <AnimationApercu Icon={Icon}/>}
      {!e.impaye && (prixSolo || prixPro) && (
        <div className="vrm-apercu-prix" data-apercu-prix="">
          {prixSolo && <span data-apercu-prix-solo=""><b>{tr('apercuAbo.solo')}</b> {prixSolo}</span>}
          {prixPro && <span data-apercu-prix-pro=""><b>{tr('apercuAbo.pro')}</b> {prixPro}</span>}
        </div>
      )}
      {!e.impaye && essai && <div className="vrm-apercu-essai-note">{tr('apercuAbo.essaiNote', { j: (x && x.essaiJours) || 7 })}</div>}
      {montrerCgv && payable && !e.impaye && <div className="vrm-apercu-cgv" data-apercu-cgv="">{cgv}</div>}
      {payable || e.impaye
        ? <Bouton variante="primaire" plein disabled={!!occupe || (montrerCgv && !cgvOk && !e.impaye)} onClick={onDebloquer} data-apercu-reprendre="" data-apercu-debloquer="">{libelle}</Bouton>
        : <div className="vrm-apercu-phrase" data-apercu-paiement-ferme="">{tr('apercuAbo.paiementFerme')}</div>}
    </div>
  );
}
