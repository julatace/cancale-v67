// ══════════════════════════════════════════════════════════════════════════════
//  L'ÉCRAN « À TRANCHER » (9 nov., lot AC ; cartes le 10 nov.)
//  Julien, sur la capture iPhone : « Améliore ça » ; avant : « je n'aime pas du tout
//  les pop-up », « Encore du texte ». Donc : UNE CARTE PAR DOUTE — la photo de la
//  paire quand une identité la donne (publiée par l'écran propriétaire, `ex`), son
//  N°, une question de 12 mots au plus, et le geste en gros boutons (44 px et plus) :
//    · deux boutons quand le geste est binaire et interne à VRM (`onTrancher`, la
//      coque l'écrit en geste annulable : pilule « Annuler » 5 s, aucune confirmation) ;
//    · sinon UN bouton qui OUVRE l'endroit où il se fait (`onAller`), rien d'écrit.
//  Les doutes groupés par type (titre court, un compte) ; « pas su » reste « — » ;
//  l'état vide est dessiné. Les nombres et les règles : src/aTrancher.js, inchangés.
//  Style : src/styles-a-trancher.css (direction artistique 6 : widgets blancs,
//  rayon 22, ambre = un geste, rouge = deux paires sous un N° seulement).
// ══════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { GroupeIos, RangeeIos } from './composants/Ios.jsx';
import { cartesATrancher } from './aTrancher.js';
import './styles-a-trancher.css';

const Chevron = () => (
  <svg className="vrm-at-chevron" width="7" height="12" viewBox="0 0 8 13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m1.5 1.5 5 5-5 5"/></svg>
);

// La vignette : la photo de L'ANNONCE (identité) ; sinon son N° ; sinon le nombre de la source.
function Vignette({ carte, ton, Photo }) {
  const P = Photo || ((p) => <img {...p} alt=""/>);
  const tuile = (contenu, attrs = {}) => <span className="vrm-at-tuile" data-ton={ton} {...attrs}>{contenu}</span>;
  // Une chose sans photo (ou dont la photo ne vient pas) : une tuile neutre — le N° est
  // déjà écrit à côté, une fois.
  const neutre = (attrs) => tuile(<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-9 9"/></svg>, attrs);
  if (carte.photo) {
    const repli = neutre();
    return (
      <span className={'vrm-at-photos' + (carte.photo2 ? ' is-deux' : '')} data-a-trancher-photo="">
        <P src={carte.photo} alt="" loading="lazy" className="vrm-at-photo" repli={repli}/>
        {carte.photo2 ? <P src={carte.photo2} alt="" loading="lazy" className="vrm-at-photo is-seconde" repli={null}/> : null}
      </span>
    );
  }
  if (carte.id) return neutre({ 'data-a-trancher-sans-photo': '' });
  return tuile(<b>{carte.n}</b>, { 'data-a-trancher-nombre': carte.n });
}

function Carte({ carte, ton, Photo, onAller, onTrancher, ligne }) {
  const ouvrir = () => onAller && onAller({ ...ligne, geste: carte.geste });
  return (
    <article className="vrm-at-carte" data-ton={ton} data-a-trancher-carte={carte.cle} data-a-trancher-id={carte.id || undefined} data-num={carte.num || undefined}>
      <div className="vrm-at-haut">
        <Vignette carte={carte} ton={ton} Photo={Photo}/>
        <div className="vrm-at-textes">
          {carte.id && carte.num ? <span className="vrm-at-num" data-ton={ton}>N°{carte.num}</span> : null}
          <span className="vrm-at-question">{carte.question}</span>
          {carte.noms && carte.noms.length ? <span className="vrm-at-noms">{carte.noms.map((n) => <span key={n} className="vrm-at-nom">{n}</span>)}</span> : null}
        </div>
      </div>
      {carte.binaire && carte.id && onTrancher ? (
        <div className="vrm-at-gestes is-deux">
          <button type="button" className="vrm-at-b" data-role="oui" data-a-trancher-oui={carte.id} onClick={() => onTrancher(carte, 'oui')}>{carte.binaire.oui}</button>
          <button type="button" className="vrm-at-b" data-role="non" data-a-trancher-non={carte.id} data-a-trancher-ouvrir={carte.cle} onClick={ouvrir}>{carte.binaire.non}<Chevron/></button>
        </div>
      ) : (
        <div className="vrm-at-gestes">
          <button type="button" className="vrm-at-b" data-role="ouvrir" data-ton={ton} data-a-trancher-geste={carte.cle} data-a-trancher-ouvrir={carte.cle} onClick={ouvrir}>{carte.geste.libelle}<Chevron/></button>
        </div>
      )}
    </article>
  );
}

export default function ATrancher({ etat, onAller, onTrancher = null, Photo = null, entete = null }) {
  if (!etat) return null;
  const { total, partiel, manque } = etat;
  const c = cartesATrancher(etat);
  // Un seul groupe : le total du haut est déjà son compte (un nombre ne s'écrit qu'une fois).
  if (c.groupes.length === 1) c.groupes[0] = { ...c.groupes[0], compteVisible: false };
  const lignes = new Map((etat.lignes || []).map((l) => [l.cle, l]));
  return (
    <div className="vrm-a-trancher vrm-at" data-a-trancher={total} data-a-trancher-partiel={partiel ? '1' : '0'}>
      {entete}
      {c.groupes.length ? (
        <div className="vrm-at-resume" data-a-trancher-resume={total}>
          {partiel ? <span>Au moins</span> : null}
          <b className="vrm-at-total">{total}</b>
          <span>à trancher</span>
        </div>
      ) : null}
      {c.groupes.length ? c.groupes.map((g) => (
        <section key={g.type} className="vrm-at-groupe" data-a-trancher-type={g.type} data-n={g.n}>
          <h2 className="vrm-at-groupe-titre">{g.titre}{g.compteVisible ? <span className="vrm-at-compte">{g.n}</span> : null}</h2>
          <div className="vrm-at-grille">
            {g.sources.map((s) => (
              <div key={s.cle} className="vrm-at-source" data-a-trancher-ligne={s.cle} data-n={s.n}>
                {s.cartes.map((k) => <Carte key={k.cle + ':' + (k.id || 'n')} carte={k} ton={s.ton} Photo={Photo} onAller={onAller} onTrancher={onTrancher} ligne={lignes.get(s.cle)}/>)}
                {s.autres > 0 ? (
                  <button type="button" className="vrm-at-autres" data-a-trancher-autres={s.autres} onClick={() => onAller && onAller(lignes.get(s.cle))}>+ {s.autres}<Chevron/></button>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      )) : (
        <div className="vrm-at-vide vrm-vide-dessin" data-a-trancher-vide={partiel ? 'partiel' : 'zero'}>
          <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true" className="vrm-at-vide-dessin">
            <circle cx="36" cy="36" r="34" fill="currentColor" opacity=".10"/>
            <path d="M22 37.5 31.5 47 50 26" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p className="vrm-at-vide-titre">{partiel ? 'Rien à trancher dans ce qui est compté' : 'Rien à trancher'}</p>
        </div>
      )}
      {manque.length ? (
        <GroupeIos titre="Pas encore compté" data-a-trancher-groupe="pas-su" className="vrm-at-passu">
          {manque.map((l) => (
            <RangeeIos key={l.cle} data-a-trancher-passu={l.cle}
              titre={l.nom} detail={/^pas encore compté/.test(l.raison || '') ? `Ouvre ${l.ecran}` : l.raison} valeur="—"
              onClick={() => onAller && onAller(l)}/>
          ))}
        </GroupeIos>
      ) : null}
    </div>
  );
}
