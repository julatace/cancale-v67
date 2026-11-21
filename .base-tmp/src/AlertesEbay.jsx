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

const heure = (iso) => { const t = Date.parse(iso || ''); return Number.isFinite(t) ? new Date(t).toLocaleTimeString(localeCourante(), { hour: '2-digit', minute: '2-digit' }) : ''; };
const jourHeure = (iso) => { const t = Date.parse(iso || ''); return Number.isFinite(t) ? new Date(t).toLocaleString(localeCourante(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''; };

function LigneAlerte({ x, veille, revente, contexte, C, onRetirer, occupe }) {
  const m = margePossible(x, veille, { revente, contexte });
  return <div className="vrm-buy-row vrm-alerte-ebay" data-alerte-ebay={x.itemId}>
    <div className="vrm-buy-ph" style={{ background: C.card2 || C.bg }}>{x.photo ? <img src={x.photo} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}</div>
    <div className="vrm-buy-main" style={{ minWidth: 0 }}>
      <div className="vrm-buy-title" style={{ color: C.text }} title={x.titre}>{x.titre || x.itemId}</div>
      <div className="vrm-buy-meta" style={{ color: C.muted, flexWrap: 'wrap' }}>
        <span data-alerte-prix={x.prix} data-alerte-port={x.port == null ? 'inconnu' : x.port} style={{ color: C.text, fontWeight: 600 }}>
          {x.port == null ? <>{eurosCalc(x.prix)} <span style={{ fontWeight: 400, color: C.muted }}>{tr('alertesEbay.portInconnu')}</span></>
            : x.port === 0 ? <>{eurosCalc(x.prix)} <span style={{ fontWeight: 400, color: C.muted }}>{tr('alertesEbay.portCompris')}</span></>
            : <>{eurosCalc(x.total)} <span style={{ fontWeight: 400, color: C.muted }}>{tr('alertesEbay.dontPort', { prix: eurosCalc(x.prix), port: eurosCalc(x.port) })}</span></>}
        </span>
      </div>
      <div style={{ fontSize: 12, color: C.muted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.recherche}{x.etat ? ' · ' + x.etat : ''}</div>
      <div data-alerte-marge={m.etat === 'ok' ? m.benefice : m.etat} data-alerte-borne={m.etat === 'ok' ? m.borne : ''} style={{ fontSize: 13, color: C.muted, marginTop: 3, lineHeight: 1.4 }}>
        {m.etat === 'ok' ? <>{tr('alertesEbay.marge')} <strong style={{ color: C.text, fontWeight: 600 }}>{m.borne === 'au-plus' ? tr('alertesEbay.auPlus') + ' ' : m.borne === 'environ' ? tr('alertesEbay.environ') + ' ' : ''}{eurosCalc(m.benefice)}</strong> · {m.base.source === 'toi' ? tr('alertesEbay.baseToi', { prix: eurosCalc(m.base.montant), site: tr('alertesEbay.site.' + m.base.site) }) : tr('alertesEbay.baseMediane', { prix: eurosCalc(m.base.montant), n: m.base.n })}</>
          : <>{tr('alertesEbay.marge')} — {tr(m.etat === 'pas-su' ? 'alertesEbay.margePasSu' : 'alertesEbay.margeSansBase')}</>}
      </div>
      <div className="vrm-alerte-act" style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: -10, flexWrap: 'wrap' }}>
      <a href={x.url} target="_blank" rel="noreferrer noopener" data-voir-ebay="" style={{ display: 'flex', alignItems: 'center', minHeight: 44, padding: '0 10px', color: C.text, fontSize: 13, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>{tr('alertesEbay.voir')}</a>
      <button type="button" className="vrm-lien-action" disabled={occupe} onClick={() => onRetirer([x.itemId])} data-alerte-retirer="" style={{ minHeight: 44, border: 'none', background: 'transparent', padding: '0 10px', fontSize: 13, whiteSpace: 'nowrap' }}>{tr('alertesEbay.retirer')}</button>
      </div>
    </div>
  </div>;
}

function EtatRecherche({ v, r }) {
  let t;
  if (!r) t = tr('alertesEbay.etat.attente');
  else if (r.refus) t = tr('alertesEbay.etat.refus', { raison: r.refus });
  else if (r.echec) t = tr('alertesEbay.etat.echec', { heure: heure(r.at) });
  else if (r.premiere && r.premiere === r.at) t = tr('alertesEbay.etat.premiere', { heure: heure(r.at) });
  else t = tr('alertesEbay.etat.lue', { heure: heure(r.at), n: Number.isSafeInteger(r.n) ? r.n : 0 });
  return <div className="vrm-ligne-info" data-alerte-recherche={v.id} data-alerte-recherche-etat={!r ? 'attente' : r.refus ? 'refus' : r.echec ? 'echec' : 'lue'} style={{ fontSize: 13, padding: '4px 0' }}><strong style={{ fontWeight: 600 }}>{v.titre}</strong> · {t}</div>;
}

export default function AlertesEbay({ headers, theme: C, revente = () => undefined, contexte = {} }) {
  useLangue();
  const [vue, setVue] = useState(undefined);       // undefined lecture · null pas su · corps de la route
  const [erreur, setErreur] = useState('');
  const [veilles, setVeilles] = useState(undefined);
  const [occupe, setOccupe] = useState(false);
  const vivant = useRef(true);
  const lire = async () => {
    setErreur('');
    try { const j = await appelerEbay('alertes', { op: 'lire' }, headers); if (vivant.current) setVue(j); }
    catch (e) { if (vivant.current) { setVue(null); setErreur(e && e.message && e.reason !== 'lecture' ? e.message : tr('alertesEbay.pasSu')); } }
  };
  useEffect(() => {
    vivant.current = true; lire();
    const maj = (e) => { const d = e && e.detail; if (d && Array.isArray(d.veilles)) setVeilles(d.veilles); };
    window.addEventListener('vrm:veilles-maj', maj);
    return () => { vivant.current = false; window.removeEventListener('vrm:veilles-maj', maj); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const retirer = async (ids) => {
    setOccupe(true); setErreur('');
    try { const j = await appelerEbay('alertes', { op: 'ecarter', itemIds: ids }, headers, { write: true }); if (vivant.current) setVue(j); }
    catch (e) { if (vivant.current) setErreur(e && e.message ? e.message : tr('alertesEbay.pasSu')); }
    finally { if (vivant.current) setOccupe(false); }
  };
  const enAlerte = veillesEnAlerte(veilles || []);
  const parId = new Map((veilles || []).map((v) => [v.id, v]));
  const nouvelles = vue && Array.isArray(vue.nouvelles) ? vue.nouvelles : [];
  const lim = (vue && vue.limites) || { parHeure: 4, intervalleMin: 60, partAuto: 150, plafondJour: 200 };
  return <section id="alertes-ebay" data-alertes-ebay={vue === undefined ? 'en-cours' : vue === null ? 'pas-su' : nouvelles.length} data-alertes-allumees={veilles === undefined ? 'en-cours' : enAlerte.length} style={{ display: 'grid', gap: 10, marginBottom: 18 }}>
    <h3 style={{ fontSize: 17, fontWeight: 600, color: C.text, margin: 0 }}>{tr('alertesEbay.titre')}</h3>
    <p style={{ fontSize: 13, color: C.muted, margin: 0, lineHeight: 1.5 }}>
      {veilles === undefined ? tr('alertesEbay.lectureRecherches') : enAlerte.length ? tr('alertesEbay.allumees', { n: enAlerte.length }) : tr('alertesEbay.aucune')}
      {' '}<Pourquoi>{tr('alertesEbay.pourquoi', { parHeure: lim.parHeure, partAuto: lim.partAuto, plafond: lim.plafondJour })}</Pourquoi>
    </p>
    {vue === undefined && <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>{tr('alertesEbay.lecture')}</p>}
    {vue === null && <p data-alertes-etat="pas-su" style={{ fontSize: 13, color: C.muted, margin: 0 }}>— {erreur || tr('alertesEbay.pasSu')} <button type="button" onClick={lire} style={{ marginLeft: 6 }}>{tr('commun.reessayer')}</button></p>}
    {vue && erreur && <p role="alert" style={{ fontSize: 13, color: C.muted, margin: 0 }}>{erreur}</p>}
    {vue && !nouvelles.length && enAlerte.length > 0 && <p data-alertes-vide="" style={{ fontSize: 13, color: C.muted, margin: 0 }}>{vue.dernier && vue.dernier.at ? tr('alertesEbay.videDepuis', { quand: jourHeure(vue.dernier.at) }) : tr('alertesEbay.videPasEncore')}</p>}
    {nouvelles.length > 0 && <>
      <div className="vrm-buy-list" data-alertes-liste="">
        {nouvelles.map((x) => <LigneAlerte key={x.itemId} x={x} veille={parId.get(x.veille) || null} revente={revente} contexte={contexte} C={C} onRetirer={retirer} occupe={occupe} />)}
      </div>
      <p style={{ fontSize: 12, color: C.muted, margin: 0, lineHeight: 1.5 }}>{tr('alertesEbay.margeExplique')}{' '}
        <button type="button" className="vrm-lien-action" disabled={occupe} onClick={() => retirer(nouvelles.map((x) => x.itemId))} data-alertes-tout-retirer="" style={{ minHeight: 44, border: 'none', background: 'transparent', padding: '0 4px', fontSize: 12 }}>{tr('alertesEbay.toutRetirer')}</button></p>
    </>}
    {vue && enAlerte.length > 0 && <details className="vrm-repli" data-alertes-recherches="">
      <summary>{tr('alertesEbay.tesAlertes', { n: enAlerte.length })}</summary>
      <div style={{ paddingTop: 6 }}>{enAlerte.map((v) => <EtatRecherche key={v.id} v={v} r={vue.recherches && vue.recherches[v.id]} />)}</div>
    </details>}
  </section>;
}
