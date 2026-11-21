// ══════════════════════════════════════════════════════════════════════════════
//  L'AIDE À LA RÉPONSE, AU-DESSUS DU CHAMP (14 nov., lot messages-achats-plus, 108 + 109)
// ══════════════════════════════════════════════════════════════════════════════
// Une rangée qui défile, juste au-dessus des réponses rapides :
//   · « Taille ? » repéré dans le message de l'acheteur (src/questionsFrequentes.js,
//     des mots FERMÉS, aucune IA) ⇒ la réponse proposée, en un toucher ;
//   · les infos à partager de la paire (src/infosPaire.js : taille réelle, défauts,
//     semelle en cm), chacune en un toucher ;
//   · une info qui manque pour répondre ⇒ « + taille réelle » ouvre la fiche à remplir.
// Un toucher INSÈRE dans le champ (`onInserer(nouveauTexte)`) : il relit, il envoie.
// Cette rangée n'envoie RIEN, n'appelle rien (ni réseau, ni extension).
// ══════════════════════════════════════════════════════════════════════════════
import React, { useMemo } from 'react';
import { tr, langueCourante } from './i18n/index.js';
import { propositionsPour, questionEnAttente, langueDuMessage } from './questionsFrequentes.js';
import { morceauxInfos, insererDansReponse, cmTexte } from './infosPaire.js';
import './styles-aide-reponse.css';

const court = (t, n = 64) => (t.length > n ? t.slice(0, n - 1) + '…' : t);
const IconePlus = () => <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><path d="M6 1.5v9M1.5 6h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>;
const IconeFiche = () => <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>;

export default function AideReponse({ messages = [], infos = null, tailleFiche = '', partie = false, valeur = '', onInserer, desactive = false, onEditerInfos = null }) {
  const question = useMemo(() => questionEnAttente(messages), [messages]);
  const langueApp = langueCourante();
  const langue = (question && langueDuMessage(question)) || langueApp;
  const propositions = useMemo(() => propositionsPour(question, { langueApp, infos, tailleFiche, partie }), [question, langueApp, infos, tailleFiche, partie]);
  const morceaux = useMemo(() => morceauxInfos(infos, langue), [infos, langue]);
  const cachees = !!(infos && infos.cachee);
  const manques = propositions.filter((p) => !p.texte && ['taille', 'defauts', 'semelle'].includes(p.manque));
  const pretes = propositions.filter((p) => p.texte);
  if (!pretes.length && !morceaux.length && !manques.length && !onEditerInfos && !cachees) return null;
  const inserer = (t) => { if (!desactive && typeof onInserer === 'function') onInserer(insererDansReponse(valeur, t)); };
  const libInfo = (m) => (m.champ === 'semelle' ? tr('plus.aide.puceSemelle', { cm: cmTexte(infos.semelle, langueApp) }) : m.champ === 'taille' ? tr('plus.aide.puceTaille') : tr('plus.aide.puceDefauts'));
  const sujets = propositions.map((p) => tr('plus.sujet.' + p.sujet)).join(' · ');
  return (
    <div className="vrm-aide-rep" data-aide-reponse="" data-aide-langue={langue} role="group" aria-label={tr('plus.aide.titre')}>
      {propositions.length ? <p className="vrm-aide-rep-q" data-aide-question={propositions.map((p) => p.sujet).join(' ')}>{tr('plus.aide.question', { sujets })}</p> : null}
      <div className="vrm-aide-rep-rangee">
        {pretes.map((p) => (
          <button key={'p' + p.sujet} type="button" className="vrm-aide-puce is-proposee" data-aide-proposition={p.sujet} disabled={desactive}
            aria-label={tr('plus.aide.insere', { t: p.texte })} title={p.texte} onClick={() => inserer(p.texte)}><span className="vrm-aide-puce-t">{court(p.texte)}</span></button>
        ))}
        {morceaux.filter((m) => !pretes.some((p) => p.texte.includes(m.texte))).map((m) => (
          <button key={'i' + m.champ} type="button" className="vrm-aide-puce" data-aide-info={m.champ} disabled={desactive}
            aria-label={tr('plus.aide.insere', { t: m.texte })} title={m.texte} onClick={() => inserer(m.texte)}><span className="vrm-aide-puce-t">{libInfo(m)}</span></button>
        ))}
        {onEditerInfos && manques.map((p) => (
          <button key={'m' + p.manque} type="button" className="vrm-aide-puce is-manque" data-aide-manque={p.manque} onClick={onEditerInfos}>
            <IconePlus/><span className="vrm-aide-puce-t">{tr('plus.aide.manque.' + p.manque)}</span></button>
        ))}
        {cachees ? <span className="vrm-aide-puce is-muette" data-aide-cachees="">{tr('plus.infos.cachees')}</span> : null}
        {onEditerInfos && !cachees ? <button type="button" className="vrm-aide-puce is-icone" data-aide-editer="" aria-label={tr('plus.infos.titre')} title={tr('plus.infos.titre')} onClick={onEditerInfos}><IconeFiche/></button> : null}
      </div>
    </div>
  );
}
