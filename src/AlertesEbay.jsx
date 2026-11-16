// ── eBAY → ACHATS : « NOUVELLES ANNONCES POUR TES RECHERCHES » (11 nov., lot alertes-ebay) ──
// Ce que le SERVEUR a trouvé pour les recherches dont il a allumé l'alerte
// (api/_lib/ebay-alertes.js, chaque heure), lu par la route `alertes` d'api/ebay.js.
// Chaque annonce : photo, prix, port, lien eBay, et la marge POSSIBLE avec SES
// chiffres (src/alertesEbayMarge.js → la calculette) — jamais un verdict. Rien
// n'est acheté : « Voir sur eBay ». « Retirer » l'enlève de la liste (jamais revue).
// Trois états : lecture en cours · pas su (« — » et la raison) · lue.
import React, { useEffect, useRef, useState } from 'react';
import { appelerEbay } from './ebayRequetes.js';
import Pourquoi from './composants/PourquoiReplie.jsx';
import { tr, localeCourante } from './i18n/index.js';
import { useLangue } from './i18n/react.js';
import { veillesEnAlerte } from './operations/metier.js';
import { margePossible } from './alertesEbayMarge.js';
import { eurosCalc } from './calculetteAchat.js';

const jourHeure = (iso) => { const t = Date.parse(iso || ''); return Number.isFinite(t) ? new Date(t).toLocaleString(localeCourante(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''; };

function LigneAlerte({ x, veille, revente, contexte, onRetirer, occupe }) {
  const m = margePossible(x, veille, { revente, contexte });
  return <div className="vrm-buy-row vrm-alerte-ebay eba-annonce" data-alerte-ebay={x.itemId}>
    <div className="vrm-buy-ph">{x.photo ? <img src={x.photo} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}</div>
    <div className="vrm-buy-main">
      <div className="vrm-buy-title" title={x.titre}>{x.titre || x.itemId}</div>
      <div className="vrm-buy-meta">
        <span data-alerte-prix={x.prix} data-alerte-port={x.port == null ? 'inconnu' : x.port}>
          {x.port == null ? <><span className="eba-prix">{eurosCalc(x.prix)}</span> {tr('alertesEbay.portInconnu')}</>
            : x.port === 0 ? <><span className="eba-prix">{eurosCalc(x.prix)}</span> {tr('alertesEbay.portCompris')}</>
            : <><span className="eba-prix">{eurosCalc(x.total)}</span> {tr('alertesEbay.dontPort', { prix: eurosCalc(x.prix), port: eurosCalc(x.port) })}</>}
        </span>
        <span>· {x.recherche}{x.etat ? ' · ' + x.etat : ''}</span>
      </div>
      <div className="vrm-buy-meta" data-alerte-marge={m.etat === 'ok' ? m.benefice : m.etat} data-alerte-borne={m.etat === 'ok' ? m.borne : ''}>
        {m.etat === 'ok' ? <span>{tr('alertesEbay.marge')} <span className="eba-prix">{m.borne === 'au-plus' ? tr('alertesEbay.auPlus') + ' ' : m.borne === 'environ' ? tr('alertesEbay.environ') + ' ' : ''}{eurosCalc(m.benefice)}</span> · {m.base.source === 'toi' ? tr('alertesEbay.baseToi', { prix: eurosCalc(m.base.montant), site: tr('alertesEbay.site.' + m.base.site) }) : tr('alertesEbay.baseMediane', { prix: eurosCalc(m.base.montant), n: m.base.n })}</span>
          : <span>{tr('alertesEbay.marge')} — {tr(m.etat === 'pas-su' ? 'alertesEbay.margePasSu' : 'alertesEbay.margeSansBase')}</span>}
      </div>
    </div>
    <div className="vrm-buy-act vrm-alerte-act">
      <a className="eba-lien" href={x.url} target="_blank" rel="noreferrer noopener" data-voir-ebay="">{tr('alertesEbay.voir')}</a>
      <button type="button" className="eba-lien" disabled={occupe} onClick={() => onRetirer([x.itemId])} data-alerte-retirer="">{tr('alertesEbay.retirer')}</button>
    </div>
  </div>;
}

// (16 nov., lot ebay-achats-refonte) La 3e carte d'eBay → Achats, rendue par src/ebayRecherche.jsx :
// la liste seulement s'il y en a ; sinon UNE phrase courte avec le geste. L'état de chaque
// recherche en alerte se dit sur SA ligne de « Mes recherches » (`onRecherches`), plus ici.
export default function AlertesEbay({ headers, revente = () => undefined, contexte = {}, veilles: veillesProp, onRecherches }) {
  useLangue();
  const [vue, setVue] = useState(undefined);       // undefined lecture · null pas su · corps de la route
  const [erreur, setErreur] = useState('');
  const [veillesEv, setVeillesEv] = useState(undefined);
  const [occupe, setOccupe] = useState(false);
  const vivant = useRef(true);
  const lire = async () => {
    setErreur('');
    try { const j = await appelerEbay('alertes', { op: 'lire' }, headers); if (vivant.current) setVue(j); }
    catch (e) { if (vivant.current) { setVue(null); setErreur(e && e.message && e.reason !== 'lecture' ? e.message : tr('alertesEbay.pasSu')); } }
  };
  useEffect(() => {
    vivant.current = true; lire();
    const maj = (e) => { const d = e && e.detail; if (d && Array.isArray(d.veilles)) setVeillesEv(d.veilles); };
    window.addEventListener('vrm:veilles-maj', maj);
    return () => { vivant.current = false; window.removeEventListener('vrm:veilles-maj', maj); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (onRecherches) onRecherches((vue && vue.recherches) || {}); }, [vue, onRecherches]);
  const retirer = async (ids) => {
    setOccupe(true); setErreur('');
    try { const j = await appelerEbay('alertes', { op: 'ecarter', itemIds: ids }, headers, { write: true }); if (vivant.current) setVue(j); }
    catch (e) { if (vivant.current) setErreur(e && e.message ? e.message : tr('alertesEbay.pasSu')); }
    finally { if (vivant.current) setOccupe(false); }
  };
  const veilles = Array.isArray(veillesProp) ? veillesProp : veillesEv;
  const enAlerte = veillesEnAlerte(veilles || []);
  const parId = new Map((veilles || []).map((v) => [v.id, v]));
  const nouvelles = vue && Array.isArray(vue.nouvelles) ? vue.nouvelles : [];
  const lim = (vue && vue.limites) || { parHeure: 4, intervalleMin: 60, partAuto: 150, plafondJour: 200 };
  const pourquoi = <Pourquoi label={tr('ebayAchats.pourquoi')}>{tr('alertesEbay.pourquoi', { parHeure: lim.parHeure, partAuto: lim.partAuto, plafond: lim.plafondJour })}</Pourquoi>;
  return <section id="alertes-ebay" className="eba-carte" data-ebay-bloc="nouvelles" data-alertes-ebay={vue === undefined ? 'en-cours' : vue === null ? 'pas-su' : nouvelles.length} data-alertes-allumees={veilles === undefined ? 'en-cours' : enAlerte.length}>
    <div className="eba-tete"><h3 className="eba-titre">{tr('ebayAchats.nouvelles.titre')}{nouvelles.length ? <span className="eba-n"> · {nouvelles.length}</span> : null}</h3></div>
    {vue === undefined && <p className="eba-gris">{tr('alertesEbay.lecture')}</p>}
    {vue === null && <p data-alertes-etat="pas-su" className="eba-texte">— {erreur || tr('alertesEbay.pasSu')} <button type="button" className="eba-lien" onClick={lire}>{tr('commun.reessayer')}</button></p>}
    {vue && erreur && <p role="alert" className="eba-alerte is-ambre">{erreur}</p>}
    {vue && !nouvelles.length && <p data-alertes-vide={enAlerte.length ? 'allumees' : 'aucune'} className="eba-gris">
      {veilles === undefined ? tr('alertesEbay.lectureRecherches') : !enAlerte.length ? tr('ebayAchats.nouvelles.aucuneAlerte') : vue.dernier && vue.dernier.at ? tr('alertesEbay.videDepuis', { quand: jourHeure(vue.dernier.at) }) : tr('alertesEbay.videPasEncore')}
    </p>}
    {vue && !nouvelles.length && pourquoi}
    {nouvelles.length > 0 && <>
      <div className="vrm-buy-list" data-alertes-liste="">
        {nouvelles.map((x) => <LigneAlerte key={x.itemId} x={x} veille={parId.get(x.veille) || null} revente={revente} contexte={contexte} onRetirer={retirer} occupe={occupe} />)}
      </div>
      <p className="eba-gris" style={{ fontSize: 12 }}>{tr('alertesEbay.margeExplique')}{' '}
        <button type="button" className="eba-lien" disabled={occupe} onClick={() => retirer(nouvelles.map((x) => x.itemId))} data-alertes-tout-retirer="" style={{ fontSize: 13 }}>{tr('alertesEbay.toutRetirer')}</button></p>
      {pourquoi}
    </>}
  </section>;
}
