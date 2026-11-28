// ── src/crm/FicheAcheteur.jsx — LA FICHE D'UN ACHETEUR eBAY (28 nov., lot ebay-crm, C1) ─────────────
// Regroupée par l'IDENTIFIANT de son compte eBay (api/_lib/ebay-crm-regle.js), jamais par nom : ses achats
// chez lui (tous ses comptes eBay), le montant payé (en euros, une autre devise dite à part), ses messages,
// retours et litiges, ses évaluations ; les gestes : lui écrire (modèles), l'exclure des automatismes,
// le bloquer sur eBay (Seller Hub, son geste). Trois états partout : en cours · pas su · lu.
import React from 'react';
import { Feuille, Groupe, Rangee, Faits, Fait, Bouton, Attente } from '../natif/index.js';
import { tr, monnaie, date as dateLangue } from '../i18n/index.js';
import { appelCrm, LONGUEUR_MESSAGE } from './api.js';
import ModelesReponse from './ModelesReponse.jsx';
export { ModelesReponse };
import './crm.css';

const jour = (iso) => (iso ? dateLangue(iso, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const euros = (v) => (v == null ? null : monnaie(Number(v), 'EUR'));
const SORTE = { retour: 'crm.sorte.retour', reclamation: 'crm.sorte.reclamation', cas: 'crm.sorte.cas', paiement: 'crm.sorte.paiement' };
const TYPE_AVIS = { Positive: 'crm.avis.positive', Neutral: 'crm.avis.neutre', Negative: 'crm.avis.negative' };

// La zone de texte, sur la forme d'un champ natif.
export function ZoneTexte({ libelle, valeur, onChange, max = LONGUEUR_MESSAGE, lignes = 4, attrs = null }) {
  const id = React.useId();
  return <label className="crm-texte" htmlFor={id}><span className="crm-texte-libelle">{libelle}</span>
    <textarea id={id} className="crm-texte-zone" rows={lignes} maxLength={max} value={valeur} onChange={(e) => onChange(e.target.value.slice(0, max))} {...(attrs || {})}/>
    <span className="crm-texte-compte" aria-hidden="true">{valeur.length}/{max}</span></label>;
}

// Écrire à l'acheteur : au sujet d'une commande (`orderId`) ou d'une annonce de la conversation (`itemId`).
export function EcrireAcheteur({ ouverte, onFermer, acheteur, compte, headers, confirm, orderId = null, itemId = null, article = '' }) {
  const [texte, setTexte] = React.useState('');
  const [etat, setEtat] = React.useState('');
  React.useEffect(() => { if (ouverte) { setTexte(''); setEtat(''); } }, [ouverte, acheteur, orderId, itemId]);
  const envoyer = async () => {
    if (!texte.trim()) return undefined;
    if (!await confirm({ title: tr('crm.ecrire.confirmer.titre', { acheteur }), desc: texte, ok: tr('crm.ecrire.envoyer'), cancel: tr('crm.annuler') })) return undefined;
    try {
      await appelCrm('crmecrire', { ...(orderId ? { orderId } : { itemId }), acheteur, texte, confirme: true }, headers, compte, true);
      setEtat('envoye'); setTexte('');
      return tr('crm.ecrire.envoye');
    } catch (e) { throw new Error(tr('crm.erreur', { raison: e.message })); }
  };
  return <Feuille ouverte={ouverte} onFermer={onFermer} titre={tr('crm.ecrire.titre', { acheteur })} detente="auto" attrs={{ 'data-crm-ecrire': acheteur }}
    pied={<Bouton variante="plein" indisponible={!texte.trim()} onClick={envoyer} attrs={{ 'data-crm-envoyer': '' }}>{tr('crm.ecrire.envoyer')}</Bouton>}>
    <div className="crm-vues"><ModelesReponse headers={headers} compte={compte} vars={{ acheteur, article, suivi: null }} onChoisir={setTexte}/></div>
    <ZoneTexte libelle={tr('crm.ecrire.message')} valeur={texte} onChange={setTexte} attrs={{ 'data-crm-message': '' }}/>
    {etat === 'envoye' ? <p className="crm-pied" role="status">{tr('crm.ecrire.envoye')}</p> : null}
  </Feuille>;
}

export default function FicheAcheteur({ acheteur, compte = 'principal', headers, confirm, ouverte, onFermer, ecrireAuDepart = null }) {
  const [f, setF] = React.useState(undefined);   // undefined : en cours · null : pas su · objet : lu
  const [erreur, setErreur] = React.useState('');
  const [ecrire, setEcrire] = React.useState(null);
  const [exclu, setExclu] = React.useState(null);
  const charger = React.useCallback(async () => {
    setF(undefined); setErreur('');
    try { const j = await appelCrm('crmfiche', { acheteur }, headers, compte); setF(j); setExclu(j.exclu); }
    catch (e) { setF(null); setErreur(e.message); }
  }, [acheteur, compte]);
  React.useEffect(() => { if (ouverte && acheteur) charger(); }, [ouverte, acheteur, compte]);
  React.useEffect(() => { if (ouverte && ecrireAuDepart) setEcrire(ecrireAuDepart); }, [ouverte, ecrireAuDepart && ecrireAuDepart.itemId]);
  const nom = (f && f.acheteur) || acheteur;
  const derniere = f && f.commandes && f.commandes[0];
  const basculerExclu = async (v) => {
    if (v && !await confirm({ title: tr('crm.exclus.confirmer.titre', { id: nom }), desc: tr('crm.exclus.confirmer.desc', { site: 'eBay' }), ok: tr('crm.exclus.confirmer.ok'), cancel: tr('crm.annuler') })) return;
    try { const j = await appelCrm(v ? 'crmexclure' : 'crmreintegrer', { site: 'ebay', id: nom, confirme: true }, headers, compte, true); setExclu(j.exclus.some((e) => e.site === 'ebay' && e.id === String(nom).toLowerCase())); }
    catch (e) { setErreur(e.message); }
  };
  const t = f && f.total;
  return <>
    <Feuille ouverte={ouverte} onFermer={onFermer} titre={tr('crm.fiche.titre', { acheteur: nom })} detente="pleine" detentes={['moitie', 'pleine']} attrs={{ 'data-crm-fiche': nom }}>
      {f === undefined ? <Attente forme="rangees" n={4} titre/> : f === null ? <Groupe pied={erreur}><Rangee titre={tr('crm.passu')} fin="chevron" onClick={charger} attrs={{ 'data-crm-fiche-passu': '' }}/></Groupe> : <>
        <Groupe attrs={{ 'data-crm-fiche-total': t && t.eur != null ? t.eur : '' }} pied={[...(t.autresDevises || []).map((x) => tr('crm.fiche.autresDevises', { n: x.n, devise: x.devise })), t.illisibles ? tr('crm.fiche.illisibles', { n: t.illisibles }) : ''].filter(Boolean).join(' · ')}>
          <Faits colonnes={2}>
            <Fait libelle={tr('crm.fiche.achats')} valeur={String(f.commandes.length)}/>
            <Fait libelle={tr('crm.fiche.total')} valeur={euros(t.eur)} detail={t.eur != null ? tr('crm.fiche.totalSur', { n: t.nCompte }) : ''}/>
            <Fait libelle={tr('crm.fiche.dernier')} valeur={derniere ? jour(derniere.date) : null}/>
          </Faits>
        </Groupe>
        <Groupe titre={tr('crm.fiche.gestes')}>
          {derniere ? <Rangee titre={tr('crm.fiche.ecrire', { acheteur: nom })} sousTitre={tr('crm.fiche.ecrireSous')} fin="chevron" onClick={() => setEcrire({ orderId: derniere.orderId, article: derniere.titre })} attrs={{ 'data-crm-ecrire-ouvrir': '' }}/> : null}
          <Rangee titre={tr('crm.fiche.exclure')} sousTitre={tr('crm.fiche.exclureSous')} interrupteur={{ actif: exclu === true, onChange: basculerExclu }} indisponible={exclu === null} attrs={{ 'data-crm-exclu': exclu === true ? '1' : exclu === false ? '0' : '?' }}/>
          <Rangee titre={tr('crm.fiche.bloquer')} sousTitre={tr('crm.fiche.bloquerSous')} fin="chevron" onClick={() => { try { window.open(f.lienBloquer, '_blank', 'noopener'); } catch (_) {} }} attrs={{ 'data-crm-bloquer': f.lienBloquer }}/>
        </Groupe>
        <Groupe titre={tr('crm.fiche.achats')}>
          {f.commandes.map((c) => <Rangee key={c.orderId} titre={c.titre || c.orderId} lignes={2} sousTitre={`${jour(c.date)} · ${c.etat.label}`} valeur={c.montant != null ? monnaie(Number(c.montant), c.devise || 'EUR') : null} attrs={{ 'data-crm-commande': c.orderId }}/>)}
        </Groupe>
        <Groupe titre={tr('crm.fiche.messages')}>
          {f.messages === null ? <Rangee titre={tr('crm.passu')} fin="chevron" onClick={charger}/> : f.messages.length ? f.messages.map((m) => <Rangee key={m.id} titre={m.sujet || m.titre} sousTitre={`${jour(m.date)} · ${m.titre}`} detailValeur={tr(m.repondu ? 'crm.fiche.repondu' : 'crm.fiche.sansReponse')} ton={m.repondu ? 'neutre' : 'ambre'} onClick={() => setEcrire({ itemId: m.itemId, article: m.titre })} attrs={{ 'data-crm-message-fiche': m.id }}/>) : <Rangee titre={tr('crm.fiche.messagesVide')}/>}
        </Groupe>
        <Groupe titre={tr('crm.fiche.litiges')} pied={f.litigesManque && f.litigesManque.length ? tr('crm.fiche.litigesManque') : ''}>
          {f.litiges === null ? <Rangee titre={tr('crm.passu')} fin="chevron" onClick={charger}/> : f.litiges.length ? f.litiges.map((x) => <Rangee key={x.sorte + x.id} titre={tr(SORTE[x.sorte] || 'crm.sorte.cas')} sousTitre={x.ouvert ? (x.limite ? tr('crm.litiges.avant', { date: jour(x.limite) }) : tr('crm.litiges.sansDate')) : tr('crm.litiges.clos')} ton={x.ouvert ? 'ambre' : 'neutre'} valeur={x.montant ? monnaie(Number(x.montant.value), x.montant.currency) : null} attrs={{ 'data-crm-litige-fiche': x.id }}/>) : <Rangee titre={tr('crm.fiche.litigesVide')}/>}
        </Groupe>
        <Groupe titre={tr('crm.fiche.avis')} pied={tr('crm.fiche.avisPied', { n: f.avisSur || 200 })}>
          {f.avis === null ? <Rangee titre={tr('crm.passu')} fin="chevron" onClick={charger}/> : f.avis.length ? f.avis.map((a) => <Rangee key={a.id} titre={a.texte || '—'} lignes={2} sousTitre={`${tr(TYPE_AVIS[a.type])} · ${jour(a.date)}`} attrs={{ 'data-crm-avis-fiche': a.id }}/>) : <Rangee titre={tr('crm.fiche.avisVide')}/>}
        </Groupe>
        {erreur ? <p className="crm-pied" role="status">{erreur}</p> : null}
      </>}
    </Feuille>
    <EcrireAcheteur ouverte={!!ecrire && ouverte} onFermer={() => setEcrire(null)} acheteur={nom} compte={compte} headers={headers} confirm={confirm} orderId={ecrire && ecrire.orderId} itemId={ecrire && ecrire.itemId} article={(ecrire && ecrire.article) || ''}/>
  </>;
}

