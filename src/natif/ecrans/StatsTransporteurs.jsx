// ════════════════════════════════════════════════════════════════════════════
//  STATISTIQUES · TRANSPORTEURS — VENTES ET ACHATS (21 nov., lot journee-stats). Julien : « fais les stats par
//  transporteur, achat et vente ». AUCUNE règle ici : le modèle arrive calculé (src/statsTransporteurs.js
//  `statsTransporteurs`). Au téléphone : une rangée par transporteur (logo, nom, nombre, délai principal) qui s'ouvre sur
//  son détail ; à l'ordinateur : un tableau à colonnes. Un délai sur moins de 3 colis mesurés = « — » ; chaque délai dit
//  s'il est une médiane ou une moyenne et sur combien de colis (« sur N »). « Transporteur inconnu » est compté à part.
//  Chaque nombre porte `data-pt-*` (le banc lit les nombres, jamais un libellé).
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr, nombre } from '../../i18n/index.js';
import { Colonne, Carte, Rangee, Faits, Fait, useOrdinateur } from '../index.js';
import { LogoTransporteur } from '../../PastilleTransporteur.jsx';

const jours = (d) => (d && d.jours != null ? tr('v2.pt.jours', { j: nombre(d.jours) }) : '—');
const sousDelai = (d) => (!d ? '' : d.jours != null ? tr(d.mode === 'mediane' ? 'v2.pt.mediane' : 'v2.pt.moyenne', { n: nombre(d.n), s: nombre(d.sur) })
  : d.n > 0 ? tr('v2.pt.peu', { n: nombre(d.n), s: nombre(d.sur) }) : tr('v2.pt.aucuneDate', { s: nombre(d.sur) }));
const dj = (d) => (d && d.jours != null ? String(d.jours) : '');
const Logo = ({ cle }) => <LogoTransporteur cle={cle} taille={28} repli={<span className="n-pt-logo-vide" aria-hidden="true"/>}/>;

// Les colonnes de chaque partie : [clé, libellé, valeur affichée, data-*].
const COLONNES = {
  ventes: [
    ['depot', 'v2.pt.v.depot', (x) => jours(x.depot), (x) => dj(x.depot), (x) => sousDelai(x.depot)],
    ['livraison', 'v2.pt.v.livraison', (x) => jours(x.livraison), (x) => dj(x.livraison), (x) => sousDelai(x.livraison)],
    ['atemps', 'v2.pt.v.aTemps', (x) => (x.aTemps.ok != null ? tr('v2.pt.surN', { k: nombre(x.aTemps.ok), n: nombre(x.aTemps.sur) }) : '—'), (x) => (x.aTemps.ok != null ? x.aTemps.ok + '/' + x.aTemps.sur : ''),
      (x) => (x.aTemps.ok != null ? tr('v2.pt.v.retard', { n: nombre(x.aTemps.retard) }) : x.aTemps.sur ? tr('v2.pt.peuLimite', { n: nombre(x.aTemps.sur) }) : tr('v2.pt.v.limitePasLue'))],
    ['retours', 'v2.pt.v.retours', (x) => nombre(x.retours + x.litiges), (x) => x.retours + ':' + x.litiges, (x) => tr('v2.pt.v.retoursDetail', { r: nombre(x.retours), l: nombre(x.litiges) })],
    ['averifier', 'v2.pt.v.aVerifier', (x) => nombre(x.aVerifier), (x) => String(x.aVerifier), () => ''],
  ],
  achats: [
    ['expedition', 'v2.pt.a.expedition', (x) => jours(x.expedition), (x) => dj(x.expedition), (x) => sousDelai(x.expedition)],
    ['arrivee', 'v2.pt.a.arrivee', (x) => jours(x.arrivee), (x) => dj(x.arrivee), (x) => sousDelai(x.arrivee)],
    ['retrait', 'v2.pt.a.retrait', (x) => jours(x.retrait), (x) => dj(x.retrait), (x) => sousDelai(x.retrait)],
    ['nonreclames', 'v2.pt.a.nonReclames', (x) => nombre(x.nonReclames), (x) => String(x.nonReclames), () => ''],
    ['point', 'v2.pt.a.point', (x) => (x.point ? x.point.nom : '—'), (x) => (x.point ? x.point.n : ''), (x) => (x.point ? tr('v2.pt.a.pointFois', { n: nombre(x.point.n) }) : tr('v2.pt.a.pointPasLu'))],
  ],
};
// Le délai qui se lit sur la rangée du téléphone.
const PRINCIPAL = { ventes: 'depot', achats: 'retrait' };

function Partie({ sens, P, etat }) {
  const ordinateur = useOrdinateur();
  const [ouvert, setOuvert] = React.useState(null);
  const cols = COLONNES[sens];
  const titre = tr(sens === 'ventes' ? 'v2.pt.ventes.titre' : 'v2.pt.achats.titre');
  const sous = !P ? (etat === 'encours' ? tr('v2.jour.lecture') : tr(sens === 'ventes' ? 'v2.pt.passu.ventes' : 'v2.pt.passu.achats'))
    : tr('v2.pt.total', { n: nombre(P.total) });
  const lignes = P ? [...P.transporteurs.map((x) => ({ ...x, inconnu: false })), ...(P.inconnu ? [{ cle: 'pas-lu', nom: tr('v2.pt.inconnu'), ...P.inconnu, inconnu: true }] : [])] : [];
  const attrs = { 'data-pt-bloc': sens, 'data-pt-total': P ? String(P.total) : '', 'data-pt-lignes': lignes.map((x) => x.cle + ':' + x.n).join(',') };
  const nomLigne = (x) => x.nom || tr('v2.pt.autre');
  if (P && !lignes.length) return <Colonne pleine><Carte className="n-pt-carte" titre={titre} sousTitre={sous} attrs={attrs}><Rangee titre={tr('v2.pt.aucun')}/></Carte></Colonne>;
  if (!P) return <Colonne pleine><Carte className="n-pt-carte" titre={titre} sousTitre={sous} attrs={attrs}><Rangee titre={sous}/></Carte></Colonne>;
  if (ordinateur) return (
    <Colonne pleine>
      <Carte className="n-pt-carte" titre={titre} sousTitre={sous} attrs={attrs}>
        <div className="n-pt-tableau" role="table" aria-label={titre}>
          <div className="n-pt-ligne n-pt-tete" role="row">
            <span role="columnheader">{tr('v2.pt.transporteur')}</span><span role="columnheader">{tr('v2.pt.colis')}</span>
            {cols.map(([k, lib]) => <span key={k} role="columnheader">{tr(lib)}</span>)}
          </div>
          {lignes.map((x) => (
            <div key={x.cle} className="n-pt-ligne" role="row" data-pt-ligne={x.cle} data-pt-n={String(x.n)} data-pt-inconnu={x.inconnu ? '1' : undefined}
              {...Object.fromEntries(cols.map(([k, , , d]) => ['data-pt-' + k, String(d(x))]))}>
              <span role="cell" className="n-pt-nom">{x.inconnu ? <span className="n-pt-logo-vide" aria-hidden="true"/> : <Logo cle={x.cle}/>}<span>{nomLigne(x)}</span></span>
              <span role="cell" className="n-pt-v"><b>{nombre(x.n)}</b><small>{tr('v2.pt.part', { p: nombre(x.part) })}</small></span>
              {cols.map(([k, , v, , s]) => <span key={k} role="cell" className="n-pt-v"><b title={v(x)}>{v(x)}</b><small>{s(x)}</small></span>)}
            </div>
          ))}
        </div>
      </Carte>
    </Colonne>
  );
  const pr = cols.find((c) => c[0] === PRINCIPAL[sens]);
  return (
    <Colonne pleine>
      <Carte className="n-pt-carte" titre={titre} sousTitre={sous} attrs={attrs}>
        {lignes.map((x) => (
          <React.Fragment key={x.cle}>
            <Rangee icone={x.inconnu ? <span className="n-pt-logo-vide" aria-hidden="true"/> : <Logo cle={x.cle}/>} titre={nomLigne(x)}
              sousTitre={[tr('v2.pt.nColis', { n: x.n, k: nombre(x.n) }), tr('v2.pt.part', { p: nombre(x.part) })].join(' · ')}
              valeur={pr[2](x)} detailValeur={tr(pr[1])} valeurForte fin="chevron" onClick={() => setOuvert(ouvert === x.cle ? null : x.cle)}
              attrs={{ 'data-pt-ligne': x.cle, 'data-pt-n': String(x.n), 'data-pt-inconnu': x.inconnu ? '1' : undefined, 'aria-expanded': ouvert === x.cle ? 'true' : 'false',
                ...Object.fromEntries(cols.map(([k, , , d]) => ['data-pt-' + k, String(d(x))])) }}/>
            {ouvert === x.cle ? (
              <div className="n-pt-detail" data-pt-detail={x.cle}>
                <Faits colonnes={2}>{cols.map(([k, lib, v, , s]) => <Fait key={k} libelle={tr(lib)} valeur={v(x) === '—' ? null : v(x)} detail={s(x)}/>)}</Faits>
              </div>
            ) : null}
          </React.Fragment>
        ))}
      </Carte>
    </Colonne>
  );
}

// ── (21 nov., lot relier-retires) « Colis non retirés » : les colis qu'il n'est pas allé chercher (src/statsTransporteurs.js
// `statsNonRetires`). La période de l'écran, ou « Tout » (tous ses achats lus). Chaque nombre porte `data-nr-*`.
const eurC = (c) => (c == null ? '—' : (c / 100).toLocaleString(undefined, { style: 'currency', currency: 'EUR', maximumFractionDigits: c % 100 ? 2 : 0 }));
function NonRetires({ NR = null, etat = 'encours', f = '30' }) {
  const [tout, setTout] = React.useState(false);
  const S = NR ? (tout ? NR.tout : NR.periode) : null;
  const titre = tr('nr.titre');
  const attrs = { 'data-nr-bloc': tout ? 'tout' : String(f), 'data-nr-n': S ? String(S.n) : '', 'data-nr-total': S ? String(S.total) : '', 'data-nr-part': S && S.part != null ? String(S.part) : '' };
  if (!S) return <Colonne pleine><Carte className="n-pt-carte" titre={titre} sousTitre={etat === 'encours' ? tr('v2.jour.lecture') : tr('nr.passu')} attrs={attrs}><Rangee titre={etat === 'encours' ? tr('v2.jour.lecture') : tr('nr.passu')}/></Carte></Colonne>;
  const A = S.argent;
  const sous = S.total ? tr('nr.sous', { n: nombre(S.n), total: nombre(S.total), p: S.part != null ? nombre(S.part) : '—' }) : tr('nr.aucunAchat');
  return (
    <Colonne pleine>
      <Carte className="n-pt-carte n-nr" titre={titre} sousTitre={sous} attrs={attrs}>
        <div className="n-nr-choix" role="group" aria-label={tr('nr.periode')}>
          <button type="button" className="n-la-plus" aria-pressed={!tout ? 'true' : 'false'} data-nr-choix="periode" onClick={() => setTout(false)}>{tr('v2.ps.court.' + f)}</button>
          <button type="button" className="n-la-plus" aria-pressed={tout ? 'true' : 'false'} data-nr-choix="tout" onClick={() => setTout(true)}>{tr('nr.tout')}</button>
        </div>
        <Faits colonnes={2}>
          <Fait libelle={tr('nr.colis')} valeur={nombre(S.n)} detail={S.total ? tr('nr.part', { p: S.part != null ? nombre(S.part) : '—', total: nombre(S.total) }) : ''} attrs={{ 'data-nr-fait': 'n' }}/>
          <Fait libelle={tr('nr.paye')} valeur={S.n ? (A.paye.c == null ? null : eurC(A.paye.c)) : eurC(0)} detail={S.n && A.paye.connus < A.paye.sur ? tr('nr.surN', { k: nombre(A.paye.connus), n: nombre(A.paye.sur) }) : ''} attrs={{ 'data-nr-fait': 'paye', 'data-nr-c': A.paye.c == null ? '' : String(A.paye.c) }}/>
          <Fait libelle={tr('nr.rembourse')} valeur={A.rembourse.n ? eurC(A.rembourse.c) : (S.n ? null : eurC(0))} detail={A.rembourse.n ? tr('nr.nColis', { n: nombre(A.rembourse.n) }) : S.n ? tr('nr.rienLu') : ''} attrs={{ 'data-nr-fait': 'rembourse', 'data-nr-c': A.rembourse.c == null ? '' : String(A.rembourse.c), 'data-nr-k': String(A.rembourse.n) }}/>
          <Fait libelle={tr('nr.attente')} valeur={nombre(A.attente.n)} detail={A.attente.n ? (A.attente.c != null ? eurC(A.attente.c) : '') + (A.pasSu ? ' · ' + tr('nr.pasSu', { n: nombre(A.pasSu) }) : '') : (A.pasSu ? tr('nr.pasSu', { n: nombre(A.pasSu) }) : '')} attrs={{ 'data-nr-fait': 'attente', 'data-nr-k': String(A.attente.n), 'data-nr-pas-su': String(A.pasSu) }}/>
          <Fait libelle={tr('nr.garde')} valeur={S.garde && S.garde.jours != null ? tr('v2.pt.jours', { j: nombre(S.garde.jours) }) : null} detail={sousDelai(S.garde)} attrs={{ 'data-nr-fait': 'garde', 'data-nr-j': dj(S.garde) }}/>
        </Faits>
        {S.transporteurs.length ? (<>
          <div className="n-nr-tete">{tr('nr.parTransporteur')}</div>
          {S.transporteurs.map((x) => <Rangee key={x.cle} icone={x.cle === 'pas-lu' ? <span className="n-pt-logo-vide" aria-hidden="true"/> : <Logo cle={x.cle}/>} titre={x.cle === 'pas-lu' ? tr('v2.pt.inconnu') : (x.nom || tr('v2.pt.autre'))}
            sousTitre={tr('nr.surSesColis', { n: nombre(x.n), total: nombre(x.total), p: nombre(x.part) })} valeur={nombre(x.n)} attrs={{ 'data-nr-transp': x.cle, 'data-nr-n': String(x.n), 'data-nr-total': String(x.total) }}/>)}
        </>) : null}
        {S.points.length ? (<>
          <div className="n-nr-tete">{tr('nr.parPoint')}</div>
          {S.points.map((x) => <Rangee key={x.nom} titre={x.nom} valeur={nombre(x.n)} attrs={{ 'data-nr-point': '', 'data-nr-n': String(x.n) }}/>)}
        </>) : null}
        <div className="n-nr-tete">{tr('nr.enCours', { n: nombre(S.enCours.length) })}</div>
        {S.enCours.length ? S.enCours.map((x, i) => (
          <Rangee key={i} icone={x.t ? <Logo cle={x.t}/> : <span className="n-pt-logo-vide" aria-hidden="true"/>} titre={x.point || (x.t ? x.nom : tr('v2.pt.inconnu'))}
            sousTitre={x.depuis != null ? tr('nr.depuis', { n: nombre(x.depuis) }) : tr('nr.depuisPasSu')}
            valeur={x.risque === 'depasse' ? tr('nr.depasse') : x.reste != null ? tr('nr.reste', { n: nombre(x.reste) }) : '—'}
            ton={x.risque === 'depasse' || x.risque === 'proche' ? 'ambre' : 'neutre'}
            attrs={{ 'data-nr-encours': x.risque || 'pas-su', 'data-nr-depuis': x.depuis == null ? '' : String(x.depuis), 'data-nr-reste': x.reste == null ? '' : String(x.reste) }}/>
        )) : <Rangee titre={tr('nr.aucunEnCours')}/>}
        <p className="n-pt-note" data-nr-note="">{tr('nr.note')}</p>
      </Carte>
    </Colonne>
  );
}

// `T` : le rendu de `statsTransporteurs` pour la fenêtre (ou null) ; `etats` : { ventes, achats } ∈ encours · passu · lu.
export default function StatsTransporteurs({ T = null, etats = {}, NR = null, f = '30' }) {
  return (
    <>
      <Partie sens="ventes" P={T ? T.ventes : null} etat={etats.ventes || 'encours'}/>
      <Partie sens="achats" P={T ? T.achats : null} etat={etats.achats || 'encours'}/>
      <NonRetires NR={NR} etat={etats.nonRetires || 'encours'} f={f}/>
      <Colonne pleine><p className="n-pt-note" data-pt-note="">{tr('v2.pt.note')}</p></Colonne>
    </>
  );
}
