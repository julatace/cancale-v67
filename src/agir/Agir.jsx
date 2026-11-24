// ═══════════════════════════════════════════════════════════════════════════
// LES BOUTONS DE LA PORTE (24 nov., lot agir-si-connecte) — la règle : src/agir/peutAgir.js
// ═══════════════════════════════════════════════════════════════════════════
//   <BoutonAgir site compte geste onClick>…</BoutonAgir>   un geste ; NON ⇒ visible, éteint, la raison et le geste dessous
//   <BadgeLectureSeule site compte/>                       « Lecture seule » à côté d'un compte qui ne peut rien faire
//   <ComposerReponse site compte conv/>                     le champ « Répondre » d'une conversation (Vinted, Leboncoin, Vestiaire)
//   <GestesOffreVinted compte tx oid conv prix contre/>     Accepter (confirmé) · Refuser · Proposer N €
// Un bouton éteint ne cache RIEN et n'envoie RIEN : le toucher ne fait que dire la raison (lecteur d'écran compris).
// Tout ce qui part passe par `envoyerGeste` (src/agir/porte.js) ⇒ la file `cmd_dist_*` exécutée par l'extension.
import React from 'react';
import { tr } from '../i18n/index.js';
import { Bouton, Feuille } from '../natif/index.js';
import { usePeutAgir, useCompteAgir, envoyerGeste } from './porte.js';
import { NOMS_SITES_AGIR } from './peutAgir.js';
import './agir.css';

// La phrase d'un « non » : la raison ET le geste, en une phrase (« Connecte l'extension sur shop_x : ouvre Vinted dans Chrome »).
export function texteRaison(v) {
  if (!v || v.ok) return '';
  const vars = { compte: '—', site: 'Vinted', autre: '', version: '?', attendue: '', ou: '', ...(v.vars || {}) };
  return tr(v.cle || 'agir.raison.passu', vars);
}

export function BoutonAgir({ site, compte, geste, par = '', onClick, children, variante = 'teinte', icone = null, large = false, taille = 'normal', attrs = null, className = '' }) {
  const v = usePeutAgir(site, compte, geste, par);
  const a = { 'data-agir': v.ok ? 'ok' : 'lecture', 'data-agir-site': site, 'data-agir-geste': geste, 'data-agir-raison': v.ok ? undefined : v.raison, 'data-agir-voie': v.ok ? v.voie : undefined, ...(attrs || {}) };
  return <Bouton variante={variante} icone={icone} large={large} taille={taille} className={className} indisponible={!v.ok} raison={v.ok ? '' : texteRaison(v)}
    onClick={v.ok ? onClick : undefined} attrs={a}>{children}</Bouton>;
}

export function BadgeLectureSeule({ site, compte }) {
  const e = useCompteAgir(site, compte);
  if (!e || !e.lecture) return null;
  const raison = texteRaison(e.raison);
  return <span className="vrm-agir-badge" data-agir-badge="lecture" data-agir-site={site} data-agir-compte={String(compte == null ? '' : compte)} title={raison} aria-label={tr('agir.badge') + ' · ' + raison}>
    <span aria-hidden="true" className="vrm-agir-badge-point"/>{tr('agir.badge')}</span>;
}

// La ligne de l'issue d'un envoi : « Parti vers l'extension » · « Déjà en attente » · « Pas envoyé ».
function issueTexte(r) {
  if (!r) return '';
  if (r.ok) return tr(r.voie === 'distance' ? 'agir.envoi.distance' : 'agir.envoi.ici');
  if (r.raison === 'deja') return tr('agir.envoi.deja');
  if (r.verdict) return texteRaison(r.verdict);
  return tr('agir.envoi.base');
}

export function ComposerReponse({ site, compte, conv, max = 2000, onEnvoye = null }) {
  const [texte, setTexte] = React.useState('');
  const [issue, setIssue] = React.useState(null);
  const v = usePeutAgir(site, compte, 'repondre', 'file');
  const envoyer = async () => {
    const t = texte.trim(); if (!t) return;
    const r = await envoyerGeste({ site, compte, geste: 'repondre', distGeste: 'repondre', args: { conv: String(conv), texte: t } });
    setIssue(r);
    if (r.ok) { setTexte(''); if (onEnvoye) { try { onEnvoye(r); } catch (_) {} } }
  };
  return (
    <div className="vrm-agir-composer" data-agir-composer={site} data-agir-compte={String(compte == null ? '' : compte)} data-agir={v.ok ? 'ok' : 'lecture'}>
      <textarea value={texte} onChange={(e) => setTexte(e.target.value.slice(0, max))} rows={2} maxLength={max} disabled={!v.ok}
        aria-label={tr('agir.repondre.place', { site: NOMS_SITES_AGIR[site] || '' })} placeholder={v.ok ? tr('agir.repondre.place', { site: NOMS_SITES_AGIR[site] || '' }) : tr('agir.badge')}/>
      <BoutonAgir site={site} compte={compte} geste="repondre" par="file" variante="plein" onClick={envoyer} attrs={{ 'data-agir-envoyer': site }}>{tr('agir.repondre.envoyer')}</BoutonAgir>
      {issue ? <p className="vrm-agir-issue" role="status" data-agir-issue={issue.ok ? 'ok' : issue.raison || 'non'}>{issueTexte(issue)}</p> : null}
    </div>
  );
}

const eur = (n) => { const x = Number(n); return Number.isFinite(x) ? x.toLocaleString(undefined, { style: 'currency', currency: 'EUR', minimumFractionDigits: Number.isInteger(x) ? 0 : 2 }) : '—'; };

// Les gestes d'une offre Vinted reçue (5.135 → file 5.436) : Accepter vend la paire ⇒ SA confirmation (§2.10) ;
// Refuser part en un toucher ; Proposer N € seulement quand N vient de SON prix mini (`contreOffreMini`).
export function GestesOffreVinted({ compte, tx, oid, conv, prix, contre = null }) {
  const [issue, setIssue] = React.useState(null);
  const [confirmer, setConfirmer] = React.useState(false);
  const base = { site: 'vinted', compte, geste: 'offre' };
  const partir = async (distGeste, args, confirme = false) => setIssue(await envoyerGeste({ ...base, distGeste, args, confirme }));
  const ids = { tx: String(tx), oid: String(oid), ...(conv != null ? { conv: String(conv) } : {}) };
  return (
    <div className="vrm-agir-offre" data-agir-offre={String(oid)}>
      {contre != null ? <BoutonAgir {...base} par="file" variante="plein" onClick={() => partir('contreOffre', { tx: String(tx), prix: contre, ...(conv != null ? { conv: String(conv) } : {}) })} attrs={{ 'data-agir-contre': String(contre) }}>{tr('agir.offre.contre', { prix: eur(contre) })}</BoutonAgir> : null}
      <BoutonAgir {...base} par="file" variante={contre != null ? 'teinte' : 'plein'} onClick={() => setConfirmer(true)} attrs={{ 'data-agir-accepter': String(prix) }}>{tr('agir.offre.accepter', { prix: eur(prix) })}</BoutonAgir>
      <BoutonAgir {...base} par="file" variante="texte" onClick={() => partir('refuser', ids)} attrs={{ 'data-agir-refuser': '' }}>{tr('agir.offre.refuser')}</BoutonAgir>
      {issue ? <p className="vrm-agir-issue" role="status" data-agir-issue={issue.ok ? 'ok' : issue.raison || 'non'}>{issueTexte(issue)}</p> : null}
      {confirmer ? <Feuille ouverte titre={tr('agir.offre.accepter', { prix: eur(prix) })} onFermer={() => setConfirmer(false)}
        pied={<Bouton variante="plein" onClick={() => { setConfirmer(false); partir('accepter', { ...ids, prix }, true); }} attrs={{ 'data-agir-accepter-confirmer': '' }}>{tr('agir.offre.confirmerOui')}</Bouton>}>
        <p className="vrm-agir-feuille-p">{tr('agir.offre.confirmer')}</p>
      </Feuille> : null}
    </div>
  );
}

// « Republier » d'UNE annonce Vinted depuis l'app (l'atelier de l'extension, `recreerVinted` : coffre → brouillon →
// suppression → en ligne, §3). Il supprime l'ancienne annonce ⇒ SA confirmation, toujours.
export function BoutonRepublierAgir({ compte, id, num = '', libelle = '' }) {
  const [issue, setIssue] = React.useState(null);
  const [confirmer, setConfirmer] = React.useState(false);
  return (
    <span className="vrm-agir-repub" data-agir-repub={String(id)}>
      <BoutonAgir site="vinted" compte={compte} geste="republier" par="file" onClick={() => setConfirmer(true)} attrs={{ 'data-agir-republier': String(id) }}>{libelle || tr('agir.republier')}</BoutonAgir>
      {issue ? <span className="vrm-agir-issue" role="status" data-agir-issue={issue.ok ? 'ok' : issue.raison || 'non'}>{issueTexte(issue)}</span> : null}
      {confirmer ? <Feuille ouverte titre={tr('agir.republier')} onFermer={() => setConfirmer(false)}
        pied={<Bouton variante="plein" onClick={async () => { setConfirmer(false); setIssue(await envoyerGeste({ site: 'vinted', compte, geste: 'republier', distGeste: 'republier', args: { id: String(id) }, confirme: true, num })); }} attrs={{ 'data-agir-republier-confirmer': String(id) }}>{tr('agir.republier.oui')}</Bouton>}>
        <p className="vrm-agir-feuille-p">{tr('agir.republier.confirmer')}</p>
      </Feuille> : null}
    </span>
  );
}
