// ══════════════════════════════════════════════════════════════════════════════
//  LES INFOS À PARTAGER D'UNE PAIRE — la FORME (14 nov., lot messages-achats-plus, n° 108)
// ══════════════════════════════════════════════════════════════════════════════
// La règle (identité, nettoyage, écriture) est src/infosPaire.js ; l'état et le geste
// annulable vivent dans App.jsx (`InfosPaireCoque`, `editerInfosPaire`). Ici :
//   · `InfosPaireVue` : la ligne de la fiche (« Taille réelle · Défauts · Semelle 28,5 cm »),
//     un toucher la modifie ;
//   · `InfosPaireFeuille` : les trois champs, « Enregistrer ».
// Neutre : une info n'est pas un geste à faire (ni ambre, ni rouge).
// ══════════════════════════════════════════════════════════════════════════════
import React, { useState } from 'react';
import { tr, langueCourante } from './i18n/index.js';
import { Feuille } from './ui/Feuille.jsx';
import { semelleCm, cmTexte } from './infosPaire.js';
import './styles-aide-reponse.css';

export function InfosPaireVue({ infos = null, onEditer = null, numero = '' }) {
  if (infos && infos.cachee) return <p className="vrm-plus-vide" data-infos-paire="cachee">{tr('plus.infos.cachees')}</p>;
  const morceaux = infos ? [infos.taille ? `${tr('plus.infos.taille')} : ${infos.taille}` : '', infos.defauts ? `${tr('plus.infos.defauts')} : ${infos.defauts}` : '', infos.semelle != null ? tr('plus.aide.puceSemelle', { cm: cmTexte(infos.semelle, langueCourante()) }) : ''].filter(Boolean) : [];
  if (!onEditer && !morceaux.length) return null;
  return (
    <button type="button" className="vrm-ui-ligne" data-infos-paire={morceaux.length ? 'lues' : 'ajout'} data-infos-num={numero || undefined} onClick={onEditer || undefined} disabled={!onEditer}>
      <span className="vrm-plus-icone" aria-hidden="true" style={{ width: 36, height: 36, borderRadius: 10 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M4 12h16M4 17h10"/></svg>
      </span>
      <span className="vrm-ui-ligne-textes">
        <span className="vrm-ui-ligne-titre"><span>{tr('plus.infos.titre')}</span></span>
        <span className="vrm-ui-ligne-sous">{morceaux.length ? morceaux.join(' · ') : tr('plus.infos.ajouter')}</span>
      </span>
      <svg className="vrm-ui-chevron" width="8" height="14" viewBox="0 0 8 14" aria-hidden="true"><path d="m1.5 1.5 5 5.5-5 5.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </button>
  );
}

export function InfosPaireFeuille({ valeur = null, numero = '', onEnregistrer, onClose }) {
  const [taille, setTaille] = useState((valeur && valeur.taille) || '');
  const [defauts, setDefauts] = useState((valeur && valeur.defauts) || '');
  const [semelle, setSemelle] = useState(valeur && valeur.semelle != null ? cmTexte(valeur.semelle, langueCourante()) : '');
  const semelleKo = String(semelle).trim() !== '' && semelleCm(semelle) == null;
  return (
    <Feuille titre={numero ? tr('plus.infos.titreNum', { n: numero }) : tr('plus.infos.titre')} onClose={onClose} data-infos-feuille="" className="vrm-ui-feuille vrm-plus-feuille">
      <p className="vrm-plus-desc">{tr('plus.infos.desc')}</p>
      <label className="vrm-plus-champ">{tr('plus.infos.taille')}
        <input data-infos-champ="taille" value={taille} maxLength={160} placeholder={tr('plus.infos.tailleEx')} onChange={(e) => setTaille(e.target.value)}/>
      </label>
      <label className="vrm-plus-champ">{tr('plus.infos.defauts')}
        <input data-infos-champ="defauts" value={defauts} maxLength={160} placeholder={tr('plus.infos.defautsEx')} onChange={(e) => setDefauts(e.target.value)}/>
      </label>
      <label className="vrm-plus-champ">{tr('plus.infos.semelle')}
        <input data-infos-champ="semelle" inputMode="decimal" value={semelle} maxLength={6} placeholder={tr('plus.infos.semelleEx')} onChange={(e) => setSemelle(e.target.value)}/>
      </label>
      {semelleKo ? <p className="vrm-plus-erreur" role="status">{tr('plus.infos.semelleKo')}</p> : null}
      <div className="vrm-plus-actions">
        <button type="button" className="vrm-plus-principal" data-infos-enregistrer="" disabled={semelleKo}
          onClick={() => { onEnregistrer && onEnregistrer({ taille, defauts, semelle }); onClose && onClose(); }}>{tr('plus.infos.enregistrer')}</button>
      </div>
    </Feuille>
  );
}
