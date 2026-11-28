// ── src/sneakers/BlocFiche.jsx — « Modèle » sur la fiche d'un N° (28 nov. 2026, lot sneakers-cote) ─────────────────
// La référence fabricant, la pointure normalisée (EU / US / UK) et les étiquettes du N°. Rien n'est posé tout seul :
// les références lues dans le titre sont des PUCES, c'est SON toucher qui pose (src/sneakers/reference.js).
// ⚠️ PAS DE COTE ICI : la fiche montre une annonce en ligne, et « prix conseillé à la mise en ligne » est refusé
//    (§3, 11 oct.). La cote vit à l'ACHAT (la calculette) et dans la VALEUR DU STOCK (la feuille Sneakers).
// ⚠️ La référence n'est pas une identité (§5) : ce bloc n'ouvre, ne relie, ne retrouve aucune autre paire.
import React from 'react';
import { tr } from '../i18n/index.js';
import { Groupe, Rangee, Bouton, Puce, Champ } from '../natif/index.js';
import { proposerRefs, pointureDuTexte, normaliserPointure, equivalents, normaliserRef } from './reference.js';
import { CLE_SNEAKERS, etatSneakers, poserFiches, cleNumSneakers } from './stockage.js';
import { creerTag, basculerTag, tagsDe } from './tags.js';
import './sneakers.css';

export function useEtatSneakers(load, save) {
  const [etat, setEtat] = React.useState(() => etatSneakers(load ? load(CLE_SNEAKERS, null) : null));
  React.useEffect(() => {
    const f = (e) => { if (e && e.detail && e.detail.k === CLE_SNEAKERS) setEtat(etatSneakers(load(CLE_SNEAKERS, null))); };
    window.addEventListener('vrm:save', f);
    return () => window.removeEventListener('vrm:save', f);
  }, [load]);
  const ecrire = React.useCallback((suivant) => { const e = etatSneakers(suivant); setEtat(e); if (save) save(CLE_SNEAKERS, e); }, [save]);
  return [etat, ecrire];
}

export function PucesTags({ etat, cles, onEcrire, attrs = null }) {
  const [nouveau, setNouveau] = React.useState(null);
  const poses = new Set(cles.length === 1 ? tagsDe(etat, cles[0]).map((g) => g.id) : []);
  return (
    <div className="snk-tags" {...(attrs || {})}>
      {etat.tags.map((g) => (
        <Puce key={g.id} presse={poses.has(g.id)} className="snk-tag" attrs={{ 'data-snk-tag': g.id, 'data-snk-couleur': g.couleur }}
          onClick={() => onEcrire(basculerTag(etat, g.id, cles, !poses.has(g.id)))}><span className="snk-pastille" aria-hidden="true"/>{g.nom}</Puce>
      ))}
      {nouveau == null
        ? <Puce className="snk-tag snk-tag-plus" attrs={{ 'data-snk-tag-nouveau': '' }} onClick={() => setNouveau('')}>{tr('snk.tag.nouveau')}</Puce>
        : <span className="snk-tag-saisie">
            <Champ libelle={tr('snk.tag.nom')} valeur={nouveau} onChange={setNouveau} attrs={{ 'data-snk-tag-champ': '', autoFocus: true, maxLength: 24 }}/>
            <Bouton variante="texte" attrs={{ 'data-snk-tag-creer': '' }} onClick={() => {
              const n = nouveau.trim(); if (!n) { setNouveau(null); return; }
              const id = 't' + Date.now().toString(36);
              const avec = creerTag(etat, n, ['gris', 'bleu', 'vert', 'sable', 'ardoise', 'turquoise'][etat.tags.length % 6], id);
              onEcrire(cles.length ? basculerTag(avec, id, cles, true) : avec); setNouveau(null);
            }}>{tr('snk.tag.creer')}</Bouton>
          </span>}
    </div>
  );
}

export default function BlocFicheSneakers({ num, titre = '', taille = '', load, save }) {
  const [etat, ecrire] = useEtatSneakers(load, save);
  const n = cleNumSneakers(num);
  const f = etat.fiches[n] || {};
  const [edite, setEdite] = React.useState(null);   // 'ref' | 'pointure'
  const [saisie, setSaisie] = React.useState('');
  React.useEffect(() => { setEdite(null); }, [n]);
  if (!n) return null;
  const props = proposerRefs(titre);
  const pLue = normaliserPointure(taille) || pointureDuTexte(titre);
  const p = f.pointure || null;
  const eq = p ? equivalents(p, f.ref || props.unique) : null;
  const poser = (champs) => ecrire(poserFiches(etat, [n], champs));
  const valider = () => {
    const t = saisie.trim();
    if (edite === 'ref') { if (!t) poser({ ref: '' }); else if (normaliserRef(t)) poser({ ref: t }); else return; }
    if (edite === 'pointure') { if (!t) poser({ pointure: '' }); else if (normaliserPointure(t)) poser({ pointure: t }); else return; }
    setEdite(null);
  };
  const lisible = edite === 'ref' ? !saisie.trim() || !!normaliserRef(saisie) : edite === 'pointure' ? !saisie.trim() || !!normaliserPointure(saisie) : true;
  const editeur = (quoi) => (
    <div className="snk-edite" data-snk-edite={quoi}>
      <Champ libelle={tr(quoi === 'ref' ? 'snk.ref' : 'snk.pointure')} valeur={saisie} onChange={setSaisie} placeholder={quoi === 'ref' ? 'DD1391-100' : 'EU 42,5 · US 9'} attrs={{ autoFocus: true, 'data-snk-champ': quoi, onKeyDown: (e) => { if (e.key === 'Enter') { e.preventDefault(); valider(); } else if (e.key === 'Escape') setEdite(null); } }}/>
      {!lisible ? <p className="snk-note" data-snk-illisible="">{tr(quoi === 'ref' ? 'snk.ref.illisible' : 'snk.pointure.illisible')}</p> : null}
      <div className="snk-edite-gestes"><Bouton variante="texte" onClick={() => setEdite(null)}>{tr('snk.annuler')}</Bouton><Bouton variante="teinte" indisponible={!lisible} onClick={valider} attrs={{ 'data-snk-valider': quoi }}>{tr('snk.valider')}</Bouton></div>
    </div>
  );
  const ouvrir = (quoi, depart) => { setSaisie(depart || ''); setEdite(quoi); };
  return (
    <Groupe titre={tr('snk.fiche.titre')} pied={tr('snk.fiche.pied')} attrs={{ 'data-snk-fiche': n, 'data-snk-ref': f.ref || '', 'data-snk-pointure': p ? p.texte : '' }}>
      {edite === 'ref' ? editeur('ref') : (
        <Rangee titre={tr('snk.ref')} valeur={f.ref || tr('snk.ajouter')} onClick={() => ouvrir('ref', f.ref || props.unique)} attrs={{ 'data-snk-rangee': 'ref' }}
          pied={!f.ref && props.refs.length ? (
            <div className="snk-propositions" data-snk-propositions={props.refs.join(',')} data-snk-ambigu={props.refs.length > 1 ? '1' : '0'}>
              <span className="snk-note">{tr(props.refs.length > 1 ? 'snk.ref.plusieurs' : 'snk.ref.lue')}</span>
              {props.refs.map((r) => <Puce key={r} className="snk-tag" attrs={{ 'data-snk-proposee': r }} onClick={() => poser({ ref: r })}>{r}</Puce>)}
            </div>) : null}/>
      )}
      {edite === 'pointure' ? editeur('pointure') : (
        <Rangee titre={tr('snk.pointure')} valeur={p ? p.texte.replace('.', ',') : tr('snk.ajouter')} sousTitre={eq ? tr('snk.pointure.eq', eq) : ''} onClick={() => ouvrir('pointure', p ? p.texte : (pLue ? pLue.texte : ''))} attrs={{ 'data-snk-rangee': 'pointure' }}
          pied={!p && pLue ? (
            <div className="snk-propositions" data-snk-pointure-lue={pLue.texte}>
              <span className="snk-note">{tr('snk.pointure.lue')}</span>
              <Puce className="snk-tag" attrs={{ 'data-snk-pointure-proposee': pLue.texte }} onClick={() => poser({ pointure: pLue })}>{pLue.texte}</Puce>
            </div>) : null}/>
      )}
      <Rangee titre={tr('snk.tags')} pied={<PucesTags etat={etat} cles={[n]} onEcrire={ecrire}/>} attrs={{ 'data-snk-rangee': 'tags' }}/>
    </Groupe>
  );
}
