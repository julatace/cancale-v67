// ════════════════════════════════════════════════════════════════════════════
//  ARGENT VISUEL (24 nov., lot visuel-argent — Julien : « toute l'application visuelle », « pas d'un coup en bloc »,
//  « fais quelque chose sans latence »). Des pièces d'AFFICHAGE seulement : chaque nombre arrive calculé par son
//  propriétaire (src/ecrans/Compta.jsx : `valeurChiffre`, `questionsArgent`, `progressionObjectif`, `jaugeSeuils`,
//  `aVenirPour`/`parEtape`) ; rien n'est recalculé ici, rien n'est arrondi autrement.
//    · `AnneauObjectif` : l'anneau du mois vers SON objectif (src/objectifMois.js) ; pas d'objectif ⇒ rien ; pas su ⇒
//      l'anneau en pointillé et « — » (jamais plein, jamais 0) ;
//    · `BarreChiffre` : la petite barre sous un chiffre du mois (part du plus grand des chiffres montrés), hachurée quand
//      le chiffre est un minimum (« au moins ») ; `CouvertureBarre` : la couverture des prix d'achat (k sur n) ;
//    · `JaugesSeuils` : le CA de l'année (daté au VERSEMENT, la ligne publiée) face au plafond micro et au seuil de TVA
//      (repère du seuil majoré) ; pas su ⇒ piste en pointillé, « — » ; minimum ⇒ « au moins », fin hachurée ;
//    · `AVenirCartes` : l'argent à venir, une carte par étape, son médaillon (src/natif/Jeu.jsx `TuilePaire`).
//  Apparition (src/natif/arrivee.js) : déjà connu au premier rendu ⇒ rien ne bouge ; arrivé pendant qu'on regarde, et
//  jamais vu dans la session ⇒ une pousse de 180 ms, 15 ms de décalage par élément (≤ 120 ms). Mouvement réduit ⇒ rien.
//  Aucune couleur orange : l'ardoise (`--n-accent`), le vert « fait », la sarcelle, l'encre.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr } from '../../i18n/index.js';
import { Carte, TIRET, Anneau, TuilePaire } from '../index.js';
import { useArriveeNeuve, retard } from '../arrivee.js';
import './argent-visuel.css';

const pctTexte = (p) => (p == null ? TIRET : String(p).replace('.', ',') + ' %');

// L'anneau de l'objectif. `o` : { etat: 'aucun' | 'passu' | 'lu', type, cible, valeur, pct, partiel, atteint }.
export function AnneauObjectif({ o, montant, nombre = (x) => String(x) }) {
  const neuf = useArriveeNeuve('argent-objectif', !!o && o.etat !== 'encours');
  if (!o || o.etat === 'aucun') return null;
  const f = (x) => (o.type === 'ventes' ? nombre(x) : montant(x));
  const su = o.etat === 'lu' && o.pct != null;
  const cible = f(o.cible);
  return (
    <div className="n-agv-obj" data-agv-objectif={su ? 'lu' : 'passu'} data-agv-objectif-pct={su ? String(o.pct) : ''} data-agv-objectif-cible={String(Math.round(Number(o.cible) * 100))}
      data-agv-anime={neuf ? '1' : undefined} style={{ '--n-agv-c': (2 * Math.PI * 28.5).toFixed(2) }}>
      <Anneau valeur={su ? o.pct : null} total={su ? 100 : null} taille={64} epaisseur={7} fait={!!o.atteint}
        centre={su ? <span className="n-agv-obj-pct">{(o.partiel ? '≥' : '') + o.pct}<small>%</small></span> : TIRET}
        libelle={su ? tr('agv.objectifAria', { pct: o.pct, cible }) : tr('agv.objectifPasSu')}/>
      <span className="n-agv-obj-txt" aria-hidden="true">
        <span className="n-agv-obj-lib">{o.atteint ? tr('agv.atteint') : tr('agv.objectif')}</span>
        <span className="n-agv-obj-cible">{tr('agv.sur', { cible })}</span>
      </span>
    </div>
  );
}

// La petite barre d'un chiffre : `part` 0..1 (null = pas su ⇒ pointillé), `partiel` ⇒ fin hachurée.
export function BarreChiffre({ part, partiel = false, ton = 'accent', neuf = false, rang = 0, attrs = null }) {
  const su = part != null && Number.isFinite(part);
  const p = su ? Math.max(0, Math.min(1, part)) : 0;
  return (
    <span className="n-agv-barre" aria-hidden="true" data-agv-barre-su={su ? '1' : '0'} data-agv-barre-part={su ? p.toFixed(3) : ''} data-agv-partiel={partiel ? '1' : undefined} data-agv-ton={ton} {...(attrs || {})}>
      {su && p > 0 ? <span className={'n-agv-barre-plein' + (neuf ? ' n-agv-pousse' : '')} style={{ width: (Math.max(2, p * 100)).toFixed(1) + '%', ...(neuf ? { animationDelay: retard(rang) + 'ms' } : {}) }}/> : null}
    </span>
  );
}

// La couverture des prix d'achat : k cases pleines sur n (au-delà de 24, une barre continue).
export function CouvertureBarre({ k, n }) {
  if (!(n > 0) || !(k >= 0)) return null;
  return (
    <span className="n-agv-couv" role="img" aria-label={tr('agv.couvAria', { k, n })} data-agv-couv={`${k}/${n}`}>
      {n <= 24 ? Array.from({ length: n }, (_, i) => <i key={i} data-plein={i < k ? '1' : undefined}/>)
        : <span className="n-agv-couv-continu"><span style={{ width: ((k / n) * 100).toFixed(1) + '%' }}/></span>}
    </span>
  );
}

// Une jauge de seuil. `pct` = la part de la règle (`position().pct`, déjà arrondie au dixième) ; `marque` = un repère
// (le seuil majoré de TVA), en part du seuil.
function Jauge({ nom, cle, pct, seuil, etat, partiel, marque = null, montant, neuf, rang }) {
  const su = pct != null && Number.isFinite(pct);
  // Avec un repère au-delà du seuil (le majoré), la piste va jusqu'au repère : le seuil est posé à 100 / part %.
  const max = marque ? marque.part : 1;
  const w = su ? Math.min(100, Math.max(0, pct) / max) : 0;
  const etatTxt = etat === 'proche' ? tr('agv.proche') : (etat && etat !== 'ok') ? tr('agv.depasse') : '';
  return (
    <div className="n-agv-jauge" data-agv-jauge={cle} data-agv-jauge-su={su ? '1' : '0'} data-agv-jauge-pct={su ? String(pct) : ''} data-agv-jauge-etat={etat || ''}
      data-agv-jauge-seuil={String(Math.round(seuil * 100))} data-agv-partiel={partiel ? '1' : undefined}
      role="img" aria-label={su ? tr('agv.jaugeAria', { nom, pct: String(pct).replace('.', ','), seuil: montant(seuil) }) : tr('agv.jaugePasSu', { nom })}>
      <div className="n-agv-jauge-tete" aria-hidden="true">
        <span className="n-agv-jauge-nom">{nom}{etatTxt ? <b className="n-agv-jauge-etat">{' · ' + etatTxt}</b> : null}</span>
        <span className="n-agv-jauge-pct">{su ? (partiel ? '≥ ' : '') + pctTexte(pct) : TIRET}</span>
      </div>
      <div className="n-agv-jauge-piste" aria-hidden="true">
        {su && w > 0 ? <span className={'n-agv-jauge-plein' + (neuf ? ' n-agv-pousse' : '')} style={{ width: w.toFixed(2) + '%', ...(neuf ? { animationDelay: retard(rang) + 'ms' } : {}) }}/> : null}
        {marque ? <span className="n-agv-jauge-seuil" style={{ left: (100 / max).toFixed(2) + '%' }}/> : null}
      </div>
      <div className="n-agv-jauge-pied" aria-hidden="true">
        <span className="n-agv-jauge-borne" style={marque ? { width: (100 / max).toFixed(2) + '%' } : undefined}>{su ? montant(seuil) : ''}</span>
        {marque ? <span>{tr('agv.majore', { seuil: montant(marque.seuil) })}</span> : null}
      </div>
    </div>
  );
}

// `J` : le retour de `jaugeSeuils` (src/microEntreprise.js) ou null (pas su) ; `etat` : 'encours' | 'lu'.
export function JaugesSeuils({ J, annee, montant, etat = 'lu' }) {
  const neuf = useArriveeNeuve('argent-seuils', etat !== 'encours');
  const nomP = tr('agv.plafond'), nomT = tr('agv.tva');
  return (
    <Carte titre={tr('agv.seuils', { annee })} className="n-agv-seuils" attrs={{ 'data-agv-seuils': etat === 'encours' ? 'encours' : J ? 'lu' : 'passu', 'data-agv-ca': J ? String(Math.round(J.ca * 100)) : '' }}>
      <div className="n-agv-seuils-ca" data-agv-anime={neuf ? '1' : undefined}>
        <span className="n-agv-seuils-ca-lib">{tr('agv.recuAnnee', { annee })}</span>
        <span className="n-agv-seuils-ca-v" data-arg-montant="" data-n-vide={J ? undefined : '1'}>{J ? (J.partiel ? tr('journee.moins') + ' ' : '') + montant(J.ca) : TIRET}</span>
      </div>
      {etat === 'encours' ? <div className="n-agv-squelette-jauges" aria-hidden="true"><i/><i/></div> : (<>
        <Jauge cle="plafond" nom={nomP} pct={J ? J.plafond.pct : null} seuil={J ? J.plafond.seuil : 0} etat={J ? J.plafond.etat : ''} partiel={!!(J && J.partiel)} montant={montant} neuf={neuf} rang={0}/>
        <Jauge cle="tva" nom={nomT} pct={J ? J.tva.pct : null} seuil={J ? J.tva.seuil : 0} etat={J ? J.tva.etat : ''} partiel={!!(J && J.partiel)} montant={montant} neuf={neuf} rang={1}
          marque={J && J.tva.majore ? { seuil: J.tva.majore, part: J.tva.majore / J.tva.seuil } : null}/>
      </>)}
    </Carte>
  );
}

// L'argent à venir en cartes. `A` : `liveStats.aVenir` (la règle de la coque) ; `T` : `aVenirPour(A, {})` (le total,
// déjà dit sur la rangée « À venir » des chiffres : il n'est pas redit ici). Une étape seule ⇒ son nombre de ventes (son
// montant serait le total, redit).
const ICONE_ETAPE = { envoyer: 'box', route: 'truck', livree: 'home', versement: 'wallet', autre: 'clock' };
const GENRE_ETAPE = { envoyer: 'rappel', route: 'arrivee', livree: 'arrivee', versement: 'argent', autre: 'offre' };
export function AVenirCartes({ A, montant, onOuvrir, Icon }) {
  const pret = !!A && !A.enCours;
  const neuf = useArriveeNeuve('argent-avenir', pret);
  if (!pret) return null;
  const parEtape = (A.parEtape || []).filter((g) => g.n > 0);
  if (!parEtape.length) return null;
  const seul = parEtape.length === 1;
  return (
    <section className="n-agv-avenir" aria-label={tr('agv.aVenir')} data-agv-avenir={String(parEtape.length)}>
      <h2 className="n-agv-avenir-titre">{tr('agv.aVenir')}</h2>
      <div className="n-agv-avenir-grille">
        {parEtape.map((g, i) => (
          <button key={g.etape} type="button" className={'n-agv-av-carte' + (neuf ? ' n-agv-apparait' : '')} style={neuf ? { animationDelay: retard(i) + 'ms' } : undefined}
            onClick={onOuvrir} data-agv-etape={g.etape} data-eur={String(Math.round(g.eur * 100))} data-agv-n={String(g.n)}>
            <TuilePaire icone={ICONE_ETAPE[g.etape] || 'clock'} genre={GENRE_ETAPE[g.etape] || 'offre'} Icon={Icon} taille="m"/>
            <span className="n-agv-av-txt">
              <span className="n-agv-av-lib">{tr('verre2.etape.' + g.etape)}</span>
              <span className="n-agv-av-v" data-arg-montant="">{seul ? tr('agv.ventes', { n: g.n }) : montant(g.eur)}</span>
              {seul ? null : <span className="n-agv-av-n">{tr('agv.ventes', { n: g.n })}</span>}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
