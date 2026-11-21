// ══════════════════════════════════════════════════════════════════════════════
//  LES EN-TÊTES DES GROUPES PAR COMPTE — la FORME seulement (11 nov., Julien :
//  « les ventes ne sont pas regroupées donc ce n'est pas très lisible »)
// ══════════════════════════════════════════════════════════════════════════════
// La règle est src/regroupeComptes.js (elle suit le flou de l'écran, jamais une
// autre). Ici : l'en-tête du compte ouvert (« Compte ouvert dans Chrome :
// angeled92 · 12 ventes »), « Compte pas relevé », puis « Autres comptes » et une
// rangée REPLIÉE par autre compte (« shop_x · 12 ventes › », 44 px, au doigt).
// Une même phrase n'est dite qu'UNE fois, dans l'en-tête du groupe (§7).
// ══════════════════════════════════════════════════════════════════════════════
import React, { useState, useCallback } from 'react';
import './styles-groupes-comptes.css';
import { grouperParCompte, entreesGroupees, nombreDe } from './regroupeComptes.js';

// Les comptes dépliés d'UNE liste (l'état vit dans l'écran, rien n'est enregistré).
export function useDepliesComptes() {
  const [deplies, setDeplies] = useState(() => new Set());
  const [maxCompte, setMaxCompte] = useState(60);
  const basculer = useCallback((c) => setDeplies((s) => { const n = new Set(s); if (n.has(c)) n.delete(c); else n.add(c); return n; }), []);
  const plus = useCallback(() => setMaxCompte((m) => m + 120), []);
  return { deplies, basculer, maxCompte, plus };
}

// Un repère de `entreesGroupees` → son en-tête. `libelle` : d'où vient le compte
// ouvert (« Compte ouvert dans Chrome », « Compte choisi », « Compte ouvert sur
// Leboncoin »…) ; `geste` : un bouton facultatif posé à droite de cet en-tête.
// (14 nov., refonte Achats) `court` : l'en-tête façon Réglages d'iOS — le nom du groupe à gauche, les nombres
// calés à droite (`vrm-gc-n` seul dans sa colonne). Les MÊMES mots et nombres ; sans `court`, rien ne change.
export function TeteGroupeCompte({ e, unite = 'vente', libelle = 'Compte ouvert', nomOuvert = '', nomDe = (c) => c, onBasculer, onSuite, geste = null, court = false }) {
  if (!e) return null;
  if (e.sansDate != null) return null; // dit par l'écran (sa phrase « sans date »)
  if (e.suite != null) {
    return <button type="button" className="vrm-gc-suite" data-groupe-suite={e.suite} onClick={() => onSuite && onSuite(e.suite)}>
      Afficher {e.n > 1 ? `les ${Math.min(120, e.n)} suivantes` : 'la suivante'}
    </button>;
  }
  if (court && (e.tete === 'ouvert' || e.tete === 'sans' || e.tete === 'autres')) {
    return <div className={'vrm-gc-tete is-court' + (e.tete === 'autres' ? ' vrm-gc-autres' : '')} data-groupe-compte={e.tete} data-groupe-n={e.n} {...(e.tete === 'autres' ? { 'data-groupe-comptes': e.comptes } : {})}>
      <span className="vrm-gc-titre">{e.tete === 'ouvert' ? <><span className="vrm-gc-libelle">{libelle}</span> · <b>{nomOuvert || '—'}</b></> : <span className="vrm-gc-libelle">{e.tete === 'sans' ? 'Compte pas relevé' : 'Autres comptes'}</span>}</span>
      <span className="vrm-gc-n">{e.tete === 'autres' && e.comptes > 1 ? `${e.comptes} comptes · ` : ''}{nombreDe(e.n, unite)}</span>
      {geste}
    </div>;
  }
  if (e.tete === 'ouvert') {
    return <div className="vrm-gc-tete" data-groupe-compte="ouvert" data-groupe-n={e.n}>
      <span className="vrm-gc-titre"><span className="vrm-gc-libelle">{libelle} :</span> <b>{nomOuvert || '—'}</b><span className="vrm-gc-n"> · {nombreDe(e.n, unite)}</span></span>
      {geste}
    </div>;
  }
  if (e.tete === 'sans') {
    return <div className="vrm-gc-tete" data-groupe-compte="sans" data-groupe-n={e.n}>
      <span className="vrm-gc-titre"><span className="vrm-gc-libelle">Compte pas relevé</span><span className="vrm-gc-n"> · {nombreDe(e.n, unite)}</span></span>
    </div>;
  }
  if (e.tete === 'autres') {
    return <div className="vrm-gc-tete vrm-gc-autres" data-groupe-compte="autres" data-groupe-n={e.n} data-groupe-comptes={e.comptes}>
      <span className="vrm-gc-titre"><span className="vrm-gc-libelle">Autres comptes</span><span className="vrm-gc-n">{e.comptes > 1 ? ` · ${e.comptes} comptes` : ''} · {nombreDe(e.n, unite)}</span></span>
    </div>;
  }
  if (e.tete === 'compte') {
    const nom = e.compte ? (nomDe(e.compte) || e.compte) : 'Compte pas su';
    return <button type="button" className="vrm-gc-compte" data-groupe-compte="compte" data-groupe-compte-id={e.compte} data-groupe-n={e.n} data-deplie={e.deplie ? '1' : '0'}
      aria-expanded={e.deplie ? 'true' : 'false'} onClick={() => onBasculer && onBasculer(e.compte)}>
      <span className="vrm-gc-nom">{nom}</span>
      <span className="vrm-gc-n">{nombreDe(e.n, unite)}</span>
      <span className="vrm-gc-chevron" aria-hidden="true">›</span>
    </button>;
  }
  return null;
}

// Pour une liste simple : groupée quand un compte est ouvert et que des lignes
// sont floutées, sinon EXACTEMENT `lignes.map(rendre)` (pas su ⇒ comme avant).
// `rendre(ligne, i)` dessine une ligne (l'écran garde son flou) ; `SansDate` :
// la phrase « sans date » de l'écran, posée en bas de chaque groupe. `enLi` : la
// liste est un <ul> (annonces en fiches) ⇒ chaque en-tête est un <li> pleine largeur.
export function ListeParCompte({ lignes, ouvert, floute, compteDe, rendre, unite = 'vente', libelle = 'Compte ouvert', nomDe = (c) => c, quand = null, SansDate = null, geste = null, enLi = false, court = false }) {
  const dep = useDepliesComptes();
  const L = Array.isArray(lignes) ? lignes : [];
  const g = grouperParCompte(L, { ouvert, floute, compteDe });
  if (!g) return <>{L.map((l, i) => rendre(l, i))}</>;
  const r = entreesGroupees(g, { deplies: dep.deplies, quand, maxCompte: dep.maxCompte });
  let i = 0;
  return <>{r.entrees.map((e, k) => {
    if (e.ligne !== undefined) { const n = rendre(e.ligne, i); i += 1; return n; }
    if (e.sansDate != null) return SansDate ? <SansDate key={'gc-sd-' + k} n={e.sansDate}/> : null;
    const cle = 'gc-' + k + '-' + (e.compte || e.tete || 'suite');
    const t = <TeteGroupeCompte key={cle} e={e} unite={unite} libelle={libelle} nomOuvert={nomDe(g.ouvert) || g.ouvert} nomDe={nomDe}
      onBasculer={dep.basculer} onSuite={dep.plus} geste={e.tete === 'ouvert' ? geste : null} court={court}/>;
    return enLi ? <li key={cle} className="vrm-gc-li">{t}</li> : t;
  })}</>;
}
