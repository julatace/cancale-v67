// ════════════════════════════════════════════════════════════════════════════
//  L'APERÇU AVANT IMPRESSION (16 nov., lot tampons-parametres)
//  Julien, mot pour mot : « quand j'ai des bordereaux à imprimer, je sélectionne
//  ce que je veux imprimer, et après ça m'ouvre une vignette avec un visuel un peu
//  éloigné du bordereau, et le N° / le tamponnage je peux le régler là où je veux ;
//  et quand je touche Imprimer, les réglages sont appliqués aux bordereaux ».
//
//  · chaque bordereau choisi, en vignette : SA page, tamponnée par LE code
//    d'impression (le vrai PDF de la vente, `composerLot`) — ce qu'on voit est ce
//    qui sortira ;
//  · le N° et la mention se déplacent / s'agrandissent sur la vignette
//    (`SceneTampons` : aimantation, zones interdites hachurées et refusées) ;
//  · « Appliquer à tous les bordereaux de ce type » (coché) : la place est aussi
//    gardée pour les prochains du même transporteur et format (`vrm_tampons`) ;
//    décoché, elle ne vaut que pour CE bordereau, cette fois ;
//  · « Revenir à la place d'origine » sur chaque tampon ;
//  · RIEN ne s'imprime avant « Imprimer » : ce toucher ouvre le PDF fait avec
//    EXACTEMENT ces placements.
//  Composant PUR d'affichage : l'état et les gestes viennent du moteur de Colis.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr } from '../i18n/index.js';
import { useLangue } from '../i18n/react.js';
import SceneTampons from './SceneTampons.jsx';
import { Z_APERCU_IMPRESSION } from './couches.js';
import '../styles-tampons.css';

export default function ApercuAvantImpression({ onMonte, Feuille, Bouton, etat, entree, dessiner, onPoser, onOrigine, onTous, onImprimer, onFermer, occupe = false }) {
  useLangue();
  React.useEffect(() => { if (onMonte) onMonte(); }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  const [vu, setVu] = React.useState(null);      // le dernier PDF prêt montré (pas d'éclair pendant qu'on refait)
  React.useEffect(() => { if (entree && entree.etat === 'pret' && entree.res) setVu(entree.res); }, [entree && entree.res, entree && entree.etat]);   // eslint-disable-line react-hooks/exhaustive-deps
  const [refus, setRefus] = React.useState(null);
  const res = vu;
  const enCours = !entree || entree.etat === 'encours';
  const largeur = Math.round(Math.max(200, Math.min(380, (typeof window !== 'undefined' ? window.innerWidth : 420) - 72)));
  const n = (etat.choisies || []).length;
  const pret = !!(entree && entree.etat === 'pret');
  const plages = res ? (res.plages || []) : [];
  const items = res ? (res.items || []) : [];
  return (
    <Feuille onClose={onFermer} maxWidth={560} z={Z_APERCU_IMPRESSION} titre={tr('tampons.apercu.titre', { n })} data-impr-apercu={pret ? 'pret' : enCours ? 'encours' : (entree && entree.etat) || 'encours'} data-impr-apercu-n={n} data-noswipe="1" className="vrm-impr-feuille vrm-tampons-apercu">
      <p className="vrm-impr-phrase" style={{ margin: '0 0 8px' }}>{tr('tampons.apercu.phrase')}</p>
      <label className="vrm-tampon-case">
        <input type="checkbox" data-impr-apercu-tous={etat.tous ? '1' : '0'} checked={!!etat.tous} onChange={(e) => onTous(e.target.checked)}/>
        {tr('tampons.apercu.tous')}
      </label>
      {refus ? <p role="alert" data-tampons-refus={refus} className="vrm-impr-sous" style={{ color: 'var(--vrm-warn, #B25E00)' }}>{tr(`tampons.refus.${['qr', 'code', 'adresse'].includes(refus) ? refus : 'code'}`)}</p> : null}
      {entree && entree.etat === 'echec' ? <p role="alert" className="vrm-impr-sous">{tr('tampons.apercu.ko')}</p> : null}
      {!res && enCours ? <p className="vrm-impr-sous" role="status" data-impr-apercu-prepare="">{tr('impr.enCours', { fait: '…', total: n })}</p> : null}
      <div className="vrm-tampons-apercu-liste" role="list">
        {plages.map((pg) => {
          const it = items.find((x) => String(x.cle) === String(pg.cle)) || {};
          const pose = (pg.poses || [])[0] || null;
          const perso = (etat.places || {})[pg.cle] || {};
          return (
            <div key={pg.cle} role="listitem" className="vrm-tampons-apercu-item" data-impr-apercu-item={pg.cle} data-cle-forme={pose ? pose.cle : ''}
              data-n={pose && pose.place ? `${pose.place.x.toFixed(1)},${pose.place.y.toFixed(1)}` : ''} data-m={pose && pose.mentionBoite ? `${pose.mentionBoite.x.toFixed(1)},${pose.mentionBoite.y.toFixed(1)}` : ''}>
              <div className="vrm-tampons-apercu-tete">
                {it.numero ? <b>N°{it.numero}</b> : null} <span>{it.title || ''}</span>
              </div>
              {pose ? <SceneTampons octets={res.unitBytes || res.bytes} pose={pose} largeur={largeur} dessiner={dessiner} occupe={occupe || enCours}
                libres={{ n: !!perso.n || (pose.libre && !('n' in perso)), m: !!perso.m }} libelles={{ n: tr('tampons.el.n'), m: tr('tampons.el.m') }} compact
                onPoser={(quoi, b, f) => { setRefus(null); onPoser(pg.cle, quoi, b, pose, f); }} onRefus={(q) => setRefus(q)}/>
                : <p className="vrm-impr-sous">{tr('tampons.apercu.sansPose')}</p>}
              {pose ? <div className="vrm-tampons-apercu-actions">
                <Bouton variante="discret" taille="petit" data-impr-apercu-origine={`${pg.cle}:n`} disabled={occupe} onClick={() => onOrigine(pg.cle, 'n', pose)}>{tr('tampons.apercu.origine.n')}</Bouton>
                <Bouton variante="discret" taille="petit" data-impr-apercu-origine={`${pg.cle}:m`} disabled={occupe} onClick={() => onOrigine(pg.cle, 'm', pose)}>{tr('tampons.apercu.origine.m')}</Bouton>
              </div> : null}
            </div>
          );
        })}
      </div>
      <div className="vrm-tampons-apercu-pied">
        <Bouton variante="primaire" plein icone="printer" data-impr-apercu-imprimer="" data-imprime="1" disabled={occupe || !res} onClick={onImprimer}>{tr('impr.bouton', { n })}</Bouton>
      </div>
    </Feuille>
  );
}
