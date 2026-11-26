// ════════════════════════════════════════════════════════════════════════════
//  « L'ARGENT QUI DORT, PAR MEUBLE » (16 nov., lot aide-decision) — UNE carte de
//  Statistiques, isolée : elle LIT la publication de l'écran Annonces
//  (`vrm_argent_dort`, src/argentDort.js) et les meubles du Stock (`vrm_meubles`,
//  `vrm_slots`) ; elle ne redécide ni prix d'achat, ni âge, ni place.
//  Par meuble : articles, total d'achat (« N sans prix » nommé), âge moyen ; trié
//  du plus gros argent immobilisé ; toucher un meuble ⇒ ses articles.
// ════════════════════════════════════════════════════════════════════════════
import React, { useEffect, useMemo, useState } from 'react';
import { argentDortParMeuble, lireArgentDort, CLE_ARGENT_DORT, EVT_ARGENT_DORT } from './argentDort.js';
import { eurosStock } from './coutVente.js';
import { load, cleNum, onCloudReady } from './App.jsx';
import { Numero } from './composants/Numero.jsx';
import { tr } from './i18n/index.js';
import './styles-argent-dort.css';

const lireMeubles = () => { const m = load('vrm_meubles', null); return Array.isArray(m) ? m : null; };
const lireSlots = () => { const s = load('vrm_slots', null); return s && typeof s === 'object' && !Array.isArray(s) ? s : null; };

function useArgentDort(owner) {
  const [pub, setPub] = useState(() => lireArgentDort(owner));
  const [meubles, setMeubles] = useState(lireMeubles);
  const [slots, setSlots] = useState(lireSlots);
  useEffect(() => {
    const relire = () => { setPub(lireArgentDort(owner)); setMeubles(lireMeubles()); setSlots(lireSlots()); };
    relire();
    const surStockage = (e) => { if (!e || e.key == null || e.key === CLE_ARGENT_DORT) relire(); };
    const surSave = (e) => { const k = e && e.detail && e.detail.k; if (k === 'vrm_meubles' || k === 'vrm_slots') relire(); };
    window.addEventListener(EVT_ARGENT_DORT, relire);
    window.addEventListener('storage', surStockage);
    window.addEventListener('vrm:save', surSave);
    window.addEventListener('vrm:stock-slots', relire);
    const fin = onCloudReady(relire);
    return () => { window.removeEventListener(EVT_ARGENT_DORT, relire); window.removeEventListener('storage', surStockage); window.removeEventListener('vrm:save', surSave); window.removeEventListener('vrm:stock-slots', relire); if (typeof fin === 'function') fin(); };
  }, [owner]);
  return { pub, meubles, slots };
}

const jours = (n) => (n == null ? '—' : tr('ad.dort.jours', { n }));

function Ligne({ id, nom, g, ouvert, basculer }) {
  return (
    <li className="vrm-ad-meuble" data-ad-meuble={id} data-n={g.n} data-centimes={g.centimes == null ? '' : g.centimes} data-sans-prix={g.sansPrix} data-age={g.ageMoyen == null ? '' : g.ageMoyen} data-ouvert={ouvert ? '1' : undefined}>
      <button type="button" className="vrm-ad-ligne" aria-expanded={ouvert} onClick={basculer}>
        <span className="vrm-ad-centre">
          <span className="vrm-ad-nom">{nom}</span>
          <span className="vrm-ad-sous">
            {tr('ad.dort.articles', { n: g.n })}
            {g.sansPrix ? <> · <span data-ad-sans-prix={g.sansPrix}>{tr('ad.dort.sansPrix', { n: g.sansPrix })}</span></> : null}
            {' · '}{g.ageMoyen == null ? tr('ad.dort.agePasSu') : tr('ad.dort.age', { n: g.ageMoyen })}
          </span>
        </span>
        <span className="vrm-ad-montant" data-vide={g.centimes == null ? '1' : undefined}>{eurosStock(g.centimes)}</span>
      </button>
      {ouvert ? (
        <ul className="vrm-ad-articles" data-ad-articles={g.articles.length}>
          {g.articles.map((a) => (
            <li key={a.cle} className="vrm-ad-article" data-ad-article={a.cle} data-achat={a.achat == null ? '' : a.achat}>
              <Numero n={a.cle} taille="petit"/>
              <span className="vrm-ad-article-age">{jours(a.age)}</span>
              <span className="vrm-ad-article-prix" data-vide={a.achat == null ? '1' : undefined}>{a.achat == null ? tr('ad.dort.prixPasSaisi') : eurosStock(a.achat)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export default function ArgentDort({ owner = '' }) {
  const { pub, meubles, slots } = useArgentDort(owner);
  const A = useMemo(() => (pub && meubles && slots ? argentDortParMeuble({ meubles, slots, lignes: pub.lignes, cle: cleNum }) : null), [pub, meubles, slots]);
  const [ouvert, setOuvert] = useState(null);
  const tete = <div className="vrm-sv-carte-tete"><h2 className="vrm-display vrm-sv-carte-titre">{tr('ad.dort.titre')}</h2><span className="vrm-sv-note">{tr('ad.dort.note')}</span></div>;
  let corps;
  if (!A) corps = <p className="vrm-ad-vide" data-ad-etat="passu">{!pub ? tr('ad.dort.pasPublie') : tr('ad.dort.meublesPasLus')}</p>;
  else if (!meubles.length) corps = <p className="vrm-ad-vide" data-ad-etat="lu" data-ad-meubles="0">{tr('ad.dort.aucunMeuble')}</p>;
  else {
    const h = A.horsMeuble;
    corps = (
      <div data-ad-etat="lu" data-ad-total={A.centimes == null ? '' : A.centimes} data-ad-n={A.n} data-ad-nprix={A.nPrix} data-ad-partiel={pub.partiel ? '1' : undefined}>
        <div className="vrm-ad-tout">
          <b className="vrm-display">{(A.nPrix < A.n || pub.partiel) && A.centimes != null ? tr('ad.dort.auMoins', { montant: eurosStock(A.centimes) }) : eurosStock(A.centimes)}</b>
          <span>{tr('ad.dort.tout', { n: A.n })}{A.nPrix < A.n ? ' · ' + tr('ad.dort.sansPrix', { n: A.n - A.nPrix }) : ''}</span>
        </div>
        <ol className="vrm-ad-liste">
          {A.meubles.map((m) => <Ligne key={m.id} id={m.id} nom={m.nom || tr('ad.dort.meubleSansNom')} g={m} ouvert={ouvert === m.id} basculer={() => setOuvert(ouvert === m.id ? null : m.id)}/>)}
          {h.n ? <Ligne id="_hors" nom={tr('ad.dort.horsMeuble')} g={h} ouvert={ouvert === '_hors'} basculer={() => setOuvert(ouvert === '_hors' ? null : '_hors')}/> : null}
        </ol>
        {pub.partiel ? <p className="vrm-ad-note" data-ad-manque="lecture">{tr('ad.dort.partiel')}</p> : null}
      </div>
    );
  }
  return <section className="vrm-sv-carte vrm-ad-carte" data-stats-carte="argent-dort">{tete}{corps}</section>;
}
