// ── src/conseiller/DemandeVRM.jsx — « Demande à VRM » (23 nov., tranche 2) ──────────────────────────────────────
// docs/passation/2026-11-23-conseiller.md. ⚠️ §2.9 : l'IA ne tourne QUE sur la clé Claude DU VENDEUR, collée ici une
// fois, rangée CHIFFRÉE côté serveur (/api/compte?mode=claude) et jamais relue par le navigateur (il n'en voit que les
// 4 derniers caractères). Sans elle : AUCUNE requête IA — l'écran se tait, dit pourquoi, et les conseils sans IA
// (au-dessus) restent. La question part avec des AGRÉGATS seulement (src/conseiller/contexte.js). La réponse cite ses
// chiffres et peut proposer UN geste de la liste fermée : un bouton, c'est SON toucher qui agit. Coût dit avant
// (estimation) et après (jetons réels × prix publics).
import React from 'react';
import { Groupe, Rangee, Bouton, Champ } from '../natif/index.js';
import { tr, localeCourante } from '../i18n/index.js';
import { contexteIA, estimationUsd } from './contexte.js';
import './demande.css';

const usd = (x) => {
  if (x == null || !Number.isFinite(Number(x))) return '—';
  if (Number(x) < 0.0001) return '< ' + (0.0001).toLocaleString(localeCourante()) + ' $';
  return Number(x).toLocaleString(localeCourante(), { maximumFractionDigits: 4 }) + ' $';
};
const GESTE_LIB = { envoyer: 'cons.colis.geste', offres: 'cons.offres.geste', argent: 'cons.seuil.geste', baisses: 'cons.baisses.geste', prix: 'cons.prix.geste', stats: 'cons.stats.geste', dorment: 'cons.dorment.geste' };

export default function DemandeVRM({ sources = null, conseils = [], outils = null, onGeste = null, Icon = null }) {
  const entete = () => { try { return outils && outils.entete ? outils.entete() : {}; } catch (_) { return {}; } };
  const [cle, setCle] = React.useState(undefined);   // undefined lecture · null pas su · { etat, fin }
  const [saisie, setSaisie] = React.useState('');
  const [msgCle, setMsgCle] = React.useState('');
  const [occupe, setOccupe] = React.useState(false);
  const [question, setQuestion] = React.useState('');
  const [fil, setFil] = React.useState([]);   // [{ q, r, chiffres, geste, cout }]
  const [erreur, setErreur] = React.useState('');
  const lireStatut = React.useCallback(async () => {
    try {
      const r = await fetch('/api/compte?mode=claude', { headers: entete() });
      const j = await r.json().catch(() => null);
      setCle(r.ok && j && j.ok ? { etat: j.etat, fin: j.fin } : null);
    } catch (_) { setCle(null); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { lireStatut(); }, [lireStatut]);
  const envoyerCle = async (action) => {
    setOccupe(true); setMsgCle('');
    try {
      const r = await fetch('/api/compte?mode=claude', { method: 'POST', headers: { ...entete(), 'content-type': 'application/json' },
        body: JSON.stringify(action === 'poser' ? { action, cle: saisie } : { action, confirme: true }) });
      const j = await r.json().catch(() => null);
      if (r.ok && j && j.ok) { setCle({ etat: j.etat, fin: j.fin }); setSaisie(''); if (action === 'retirer') setFil([]); }
      else setMsgCle(tr('ia.cle.erreur.' + (j && ['cle', 'refusee', 'coffre', 'abonnement'].includes(j.erreur) ? j.erreur : 'base')));
    } catch (_) { setMsgCle(tr('ia.cle.erreur.base')); }
    setOccupe(false);
  };
  const contexte = React.useMemo(() => contexteIA(sources, conseils), [sources, conseils]);
  const estime = estimationUsd(contexte, question);
  const posee = !!cle && cle.etat === 'posee';
  const [montrerCle, setMontrerCle] = React.useState(false);
  // Demander : avec SA clé seulement. Sans elle, RIEN ne part — la carte de la clé s'ouvre et dit pourquoi.
  const demander = async (texte) => {
    const q = String(texte == null ? question : texte).trim();
    if (!q || occupe) return;
    if (!posee) { setQuestion(q); setMontrerCle(true); return; }   // ⚠️ sans SA clé, aucune requête IA ne part d'ici
    setQuestion(q); setOccupe(true); setErreur('');
    try {
      const r = await fetch('/api/ai?mode=conseiller', { method: 'POST', headers: { ...entete(), 'content-type': 'application/json' },
        body: JSON.stringify({ question: q, contexte, historique: fil.slice(-4).map((x) => ({ q: x.q, r: x.r })) }) });
      const j = await r.json().catch(() => null);
      if (j && j.ok) { setFil((f) => [...f, { q, r: j.reponse, chiffres: j.chiffres || [], geste: j.geste, cout: j.cout }]); setQuestion(''); }
      else if (j && j.reason === 'no-key') { setCle({ etat: 'aucune' }); setMontrerCle(true); }
      else setErreur(tr('ia.erreur.' + (j && ['cle-refusee', 'refus', 'parse', 'api-error', 'abonnement'].includes(j.reason) ? j.reason : 'network')));
    } catch (_) { setErreur(tr('ia.erreur.network')); }
    setOccupe(false);
  };
  const etat = cle === undefined ? 'lecture' : cle === null ? 'passu' : cle.etat;
  // Trois questions toutes prêtes (23 nov., coordinateur) : un toucher les pose (avec SA clé), sinon ouvre la carte de la clé.
  const SUGGESTIONS = ['ia.sugg.baisser', 'ia.sugg.gagne', 'ia.sugg.ca'];
  return (
    <Groupe titre={tr('ia.titre')} pied={posee ? tr('ia.pied') : tr('ia.piedSansCle')} attrs={{ 'data-ia': etat }}>
      {/* LA QUESTION, en haut, toujours visible : le champ, « Demander », trois questions toutes prêtes. */}
      <div className="n-cons-ligne" data-ia-zone="">
        <Champ libelle={tr('ia.question')} valeur={question} onChange={setQuestion} placeholder={tr('ia.exemple')} attrs={{ maxLength: 500, 'data-ia-question': '', onKeyDown: (e) => { if (e.key === 'Enter') demander(); } }}/>
        <Bouton variante="teinte" icone={Icon ? <Icon name="conseiller" size={18}/> : null} chargement={occupe} onClick={() => demander()} attrs={{ 'data-ia-demander': '' }}>{tr('ia.demander')}</Bouton>
      </div>
      <div className="n-cons-suggestions" data-ia-suggestions="">
        {SUGGESTIONS.map((k) => <Bouton key={k} variante="teinte" taille="compact" onClick={() => demander(tr(k))} attrs={{ 'data-ia-suggestion': k }}>{tr(k)}</Bouton>)}
      </div>
      {cle === null ? <Rangee titre={tr('ia.passu')} sousTitre={tr('ia.passuSous')} lignes={2} sousLignes={2} attrs={{ 'data-ia-passu': '' }}/> : null}
      {cle && !posee && montrerCle ? <>
        <Rangee icone={Icon ? <Icon name="conseiller" size={22}/> : null} titre={tr('ia.sansCle')} sousTitre={tr('ia.sansCleSous')} lignes={2} sousLignes={2} attrs={{ 'data-ia-sans-cle': '' }}/>
        <div className="n-cons-ligne">
          <Champ libelle={tr('ia.cle.libelle')} valeur={saisie} onChange={setSaisie} placeholder="sk-ant-…" attrs={{ type: 'password', spellCheck: 'false', 'data-ia-cle-saisie': '' }}/>
          <Bouton variante="teinte" chargement={occupe} indisponible={!saisie.trim()} raison={tr('ia.cle.raison')} onClick={() => envoyerCle('poser')} attrs={{ 'data-ia-cle-poser': '' }}>{tr('ia.cle.poser')}</Bouton>
        </div>
        {msgCle ? <Rangee titre={msgCle} lignes={2} attrs={{ 'data-ia-cle-msg': '' }}/> : null}
      </> : null}
      {erreur ? <Rangee titre={erreur} lignes={2} attrs={{ 'data-ia-erreur': '' }}/> : null}
      {posee ? fil.map((x, i) => (
        <Rangee key={i} titre={x.q} sousTitre={x.r} lignes={2} sousLignes={2} attrs={{ 'data-ia-reponse': String(i) }}
          pied={<div className="n-cons-pied">
            <span className="n-cons-cite" data-ia-chiffres={String(x.chiffres.length)} data-ia-cout={x.cout == null ? '' : String(x.cout)}>
              {(x.chiffres.length ? x.chiffres.map((c) => `${c.libelle} : ${c.valeur}`).join(' · ') + ' · ' : '') + tr('ia.cout', { c: usd(x.cout) })}</span>
            {x.geste && x.geste !== 'aucun' && GESTE_LIB[x.geste] && onGeste ? <Bouton variante="teinte" taille="compact" onClick={() => onGeste(x.geste)} attrs={{ 'data-ia-geste': x.geste }}>{tr(GESTE_LIB[x.geste])}</Bouton> : null}
          </div>}/>)) : null}
      {posee ? <Rangee titre={tr('ia.estimation', { c: usd(estime) })} sousTitre={tr('ia.estimationSous', { fin: cle.fin || '' })} lignes={1} sousLignes={2}
        fin={<Bouton variante="destructif" taille="compact" confirmation={tr('ia.cle.retirerConfirme')} onClick={() => envoyerCle('retirer')} attrs={{ 'data-ia-cle-retirer': '' }}>{tr('ia.cle.retirer')}</Bouton>}
        attrs={{ 'data-ia-estimation': String(estime) }}/> : null}
    </Groupe>
  );
}
