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
import { Colonne, Carte, Rangee, Faits, Fait, useOrdinateur, LogoSite, Segmente } from '../index.js';
import { LogoTransporteur } from '../../PastilleTransporteur.jsx';
import './stats.css';   // (21 nov., transp-depenses) l'écran porte ses styles (monté seul dans un banc)

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
// (21 nov., transp-depenses) LES SITES d'un transporteur (Vinted, Leboncoin, eBay, Vestiaire) : le logo et le nombre de chacun,
// tels que `statsTransporteurs` les a comptés (`sites`), dans l'ordre de SITES_ORDRE ; rien de recompté ici.
const SITES_ORDRE = ['vinted', 'leboncoin', 'ebay', 'vestiaire'];
const Sites = ({ x, compact = false }) => (
  <span className="n-pt-sites" data-pt-sites={SITES_ORDRE.filter((k) => x.sites && x.sites[k]).map((k) => k + ':' + x.sites[k]).join(',')}>
    {SITES_ORDRE.filter((k) => x.sites && x.sites[k]).map((k) => <span key={k} className="n-pt-site"><LogoSite site={k} taille={16} nom={tr('v2.pt.site.' + k)}/>{compact ? null : <small>{nombre(x.sites[k])}</small>}</span>)}
  </span>
);
// Le délai qui se lit sur la rangée du téléphone.
const PRINCIPAL = { ventes: 'depot', achats: 'retrait' };

function Partie({ sens, P, etat, pasLus = [] }) {
  const ordinateur = useOrdinateur();
  const [ouvert, setOuvert] = React.useState(null);
  const cols = COLONNES[sens];
  const titre = tr(sens === 'ventes' ? 'v2.pt.ventes.titre' : 'v2.pt.achats.titre');
  const manque = P && pasLus.length ? tr('v2.pt.pasLus', { sites: pasLus.map((k) => tr('v2.pt.site.' + k)).join(', ') }) : '';
  const sous = !P ? (etat === 'encours' ? tr('v2.jour.lecture') : tr(sens === 'ventes' ? 'v2.pt.passu.ventes' : 'v2.pt.passu.achats'))
    : [tr('v2.pt.total', { n: nombre(P.total) }), manque].filter(Boolean).join(' · ');
  const lignes = P ? [...P.transporteurs.map((x) => ({ ...x, inconnu: false })), ...(P.inconnu ? [{ cle: 'pas-lu', nom: tr('v2.pt.inconnu'), ...P.inconnu, inconnu: true }] : [])] : [];
  const attrs = { 'data-pt-bloc': sens, 'data-pt-total': P ? String(P.total) : '', 'data-pt-lignes': lignes.map((x) => x.cle + ':' + x.n).join(','), 'data-pt-pas-lus': pasLus.join(','), 'data-pt-site': P ? P.site : '' };
  const nomLigne = (x) => x.nom || tr('v2.pt.autre');
  if (P && !lignes.length) return <Colonne pleine><Carte className="n-pt-carte" titre={titre} sousTitre={sous} attrs={attrs}><Rangee titre={tr('v2.pt.aucun')}/></Carte></Colonne>;
  if (!P) return <Colonne pleine><Carte className="n-pt-carte" titre={titre} sousTitre={sous} attrs={attrs}><Rangee titre={sous}/></Carte></Colonne>;
  if (ordinateur) return (
    <Colonne pleine>
      <Carte className="n-pt-carte" titre={titre} sousTitre={sous} attrs={attrs}>
        <div className="n-pt-tableau" role="table" aria-label={titre}>
          <div className="n-pt-ligne n-pt-tete" role="row">
            <span role="columnheader">{tr('v2.pt.transporteur')}</span><span role="columnheader">{tr('v2.pt.colis')}</span><span role="columnheader">{tr('v2.pt.sites')}</span>
            {cols.map(([k, lib]) => <span key={k} role="columnheader">{tr(lib)}</span>)}
          </div>
          {lignes.map((x) => (
            <div key={x.cle} className="n-pt-ligne" role="row" data-pt-ligne={x.cle} data-pt-n={String(x.n)} data-pt-inconnu={x.inconnu ? '1' : undefined}
              {...Object.fromEntries(cols.map(([k, , , d]) => ['data-pt-' + k, String(d(x))]))}>
              <span role="cell" className="n-pt-nom">{x.inconnu ? <span className="n-pt-logo-vide" aria-hidden="true"/> : <Logo cle={x.cle}/>}<span>{nomLigne(x)}</span></span>
              <span role="cell" className="n-pt-v"><b>{nombre(x.n)}</b><small>{tr('v2.pt.part', { p: nombre(x.part) })}</small></span>
              <span role="cell" className="n-pt-v"><Sites x={x}/></span>
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
              pastilleSous={<Sites x={x} compact/>} valeur={pr[2](x)} detailValeur={tr(pr[1])} valeurForte fin="chevron" onClick={() => setOuvert(ouvert === x.cle ? null : x.cle)}
              attrs={{ 'data-pt-ligne': x.cle, 'data-pt-n': String(x.n), 'data-pt-inconnu': x.inconnu ? '1' : undefined, 'aria-expanded': ouvert === x.cle ? 'true' : 'false',
                ...Object.fromEntries(cols.map(([k, , , d]) => ['data-pt-' + k, String(d(x))])) }}/>
            {ouvert === x.cle ? (
              <div className="n-pt-detail" data-pt-detail={x.cle}>
                <Sites x={x}/>
                <Faits colonnes={2}>{cols.map(([k, lib, v, , s]) => <Fait key={k} libelle={tr(lib)} valeur={v(x) === '—' ? null : v(x)} detail={s(x)}/>)}</Faits>
              </div>
            ) : null}
          </React.Fragment>
        ))}
      </Carte>
    </Colonne>
  );
}

// `T` : le rendu de `statsTransporteurs` pour la fenêtre (ou null) ; `etats` : { ventes, achats } ∈ encours · passu · lu.
// (21 nov., transp-depenses) Le filtre « Site » vit dans la tête des tableaux À L'ORDINATEUR seulement (décision du 20 nov. :
// plus de sélecteur de plateforme au téléphone — chaque rangée y montre les logos de ses sites). Les sites proposés sont
// ceux qui ont des colis dans la fenêtre (`sites` de la partie), « Tous » d'abord.
export default function StatsTransporteurs({ T = null, etats = {} }) {
  const ordinateur = useOrdinateur();
  const site = etats.site || 'toutes';
  const presents = SITES_ORDRE.filter((k) => (T && T.ventes && T.ventes.sites.includes(k)) || (T && T.achats && T.achats.sites.includes(k)) || k === site);
  const pasLus = etats.pasLus || {};
  return (
    <>
      {ordinateur && etats.setSite && presents.length > 1 ? (
        <Colonne pleine><div className="n-pt-filtre" data-pt-filtre={site}>
          <Segmente libelle={tr('v2.pt.site')} valeur={site} onChange={etats.setSite} options={[{ cle: 'toutes', libelle: tr('v2.pt.site.toutes') }, ...presents.map((k) => ({ cle: k, libelle: tr('v2.pt.site.' + k) }))]}/>
        </div></Colonne>
      ) : null}
      <Partie sens="ventes" P={T ? T.ventes : null} etat={etats.ventes || 'encours'} pasLus={site === 'toutes' ? (pasLus.ventes || []) : (pasLus.ventes || []).filter((k) => k === site)}/>
      <Partie sens="achats" P={T ? T.achats : null} etat={etats.achats || 'encours'} pasLus={site === 'toutes' ? (pasLus.achats || []) : (pasLus.achats || []).filter((k) => k === site)}/>
      <Colonne pleine><p className="n-pt-note" data-pt-note="">{tr('v2.pt.note2')}</p></Colonne>
    </>
  );
}
