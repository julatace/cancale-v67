// ════════════════════════════════════════════════════════════════════════════
//  FRAIS DE L'ANNÉE — Argent (14 nov., frais-carte, proposition 123 choisie par
//  Julien : « ce que chaque plateforme t'a coûté dans l'année en frais »).
//  Rien n'est calculé ici : `fraisAnnee` (src/fraisPlateformes.js), qui est la règle
//  de « Frais par site » sur les bornes de l'année. Aucun import d'App.jsx : le
//  relevé, les commandes eBay, les Dépenses, les règles arrivent en props.
//  Dessin (direction « Atelier », règle des 1 000 articles) : le titre de section
//  HORS de la carte, LE chiffre en grand avec sa couverture À CÔTÉ en une ligne,
//  une rangée par site (nom · une ligne grise · montant à l'encre), l'explication
//  repliée. Rien de connu ⇒ UNE ligne, jamais une carte pour « — ».
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { fraisAnnee, anneesFrais } from './fraisPlateformes.js';
import { SegmenteBase } from './composants/Bouton.jsx';
import { tr, monnaie } from './i18n/index.js';
import { useLangue } from './i18n/react.js';
import './frais-carte.css';

const NOMS = { Vinted: 'Vinted', eBay: 'eBay', Vestiaire: 'Vestiaire Collective', Leboncoin: 'Leboncoin', Autre: '' };
const eur = (x) => { const c = Math.round(Number(x) * 100); return monnaie(c / 100, 'EUR', c % 100 ? undefined : { minimumFractionDigits: 0, maximumFractionDigits: 0 }); };
const CLE_ANNEE = 'vrm_frais_annee_vue';

// La ligne grise d'un site : sa couverture ou la raison du « — » (une seule phrase courte).
export function ligneSite(s) {
  const n = s.n || 0;
  const bouts = [];
  switch (s.raison) {
    case 'couverture': bouts.push(tr('fc.r.couverture', { lus: s.couverture.lus, n: s.couverture.n })); break;
    case 'boostsPasLus': bouts.push(tr('fc.r.boostsPasLus')); break;
    case 'optionsPasLues': bouts.push(tr('fc.r.optionsPasLues')); break;
    case 'fraisPasLus': bouts.push(tr('fc.r.fraisPasLus', { n })); break;
    case 'commissionPasLue': bouts.push(tr('fc.r.commissionPasLue', { n })); break;
    case 'pasLu': bouts.push(s.plateforme === 'eBay' ? tr('fc.r.pasLu') : tr('fc.ouvreVentes')); break;
    case 'avantReleve': bouts.push(tr('fc.r.avantReleve')); break;
    case 'rienNote': bouts.push(tr('fc.r.rienNote')); break;
    default: if (n) bouts.push(tr('fc.complet', { n }));
  }
  if (s.autreDevise) bouts.push(tr('fc.devise', { n: s.autreDevise, devises: (s.devises || []).join(', ') }));
  return bouts.join(' · ');
}

export default function FraisPlateformes({ releve, releveAt, ebay, packs, excluAutre, R, vestiaire, maintenant: tFourni = null }) {
  useLangue();
  const [maintenant] = React.useState(() => tFourni || Date.now());
  const annees = React.useMemo(() => anneesFrais({ releve, ebay, maintenant }), [releve, ebay, maintenant]);
  const [annee, setAnneeEtat] = React.useState(() => { try { const v = Number(localStorage.getItem(CLE_ANNEE)); return v > 2000 ? v : new Date(maintenant).getFullYear(); } catch (_) { return new Date(maintenant).getFullYear(); } });
  const setAnnee = (v) => { setAnneeEtat(Number(v)); try { localStorage.setItem(CLE_ANNEE, String(v)); } catch (_) {} };
  const y = annees.includes(annee) ? annee : annees[0];
  const F = React.useMemo(() => fraisAnnee({ releve, releveAt, ebay, packs, annee: y, excluAutre, R, vestiaire, maintenant }),
    [releve, releveAt, ebay, packs, y, excluAutre, R, vestiaire, maintenant]);
  const [ouvert, setOuvert] = React.useState(false);
  const choix = annees.slice(0, 4).map((a) => ({ v: String(a), l: String(a), data: { 'data-fa-choix': String(a) } }));
  const tete = (
    <div className="vrm-fc-tete">
      <h2 className="vrm-fc-titre" data-titre-section="">{tr('fc.fraisTitre')}</h2>
      {choix.length > 1 ? <SegmenteBase label={tr('fc.annee')} className="vrm-fc-seg" value={String(y)} onChange={setAnnee} options={choix}/> : null}
    </div>
  );
  const attrs = { 'data-frais-annee': String(y), 'data-fa-total': F.total == null ? '' : String(Math.round(F.total * 100)), 'data-fa-au-moins': F.auMoins ? '1' : undefined };
  // Aucun site cette année, ou aucun montant connu : une ligne, pas de carte (§ règle des cartes vides).
  if (!F.sites.length || F.total == null) {
    const tousPasLus = F.sites.length > 0 && F.sites.every((s) => s.etat === 'passu');
    return (
      <section className="vrm-fc" {...attrs} data-fa-vide={!F.sites.length ? 'aucune' : 'inconnu'}>
        {tete}
        <p className="vrm-fc-ligne-vide" data-fa-ligne-vide="">
          <b>—</b> {!F.sites.length ? tr('fc.pasDeVente', { annee: String(y) }) : tr('fc.aucunFrais', { annee: String(y) })}{tousPasLus ? ` · ${tr('fc.ouvreVentes')}` : ''}
        </p>
        {F.sites.length ? <ListeSites F={F}/> : null}
      </section>
    );
  }
  return (
    <section className="vrm-fc" {...attrs}>
      {tete}
      <div className="vrm-fc-chiffre">
        <span className="vrm-fc-lib">{tr('fc.totalLib', { annee: String(y) })}</span>
        <span className="vrm-fc-grand" data-fa-grand="">
          {F.auMoins ? <small className="vrm-fc-aumoins">{tr('fc.auMoins')} </small> : null}{eur(F.total)}
        </span>
        <span className="vrm-fc-sous">{tr('fc.surVentes', { n: F.nVentes })}</span>
      </div>
      <ListeSites F={F}/>
      <button type="button" className="vrm-fc-repli" aria-expanded={ouvert} onClick={() => setOuvert(!ouvert)} data-fa-comment="">
        {tr('fc.comment')} <span aria-hidden="true" className="vrm-fc-chev">{ouvert ? '⌃' : '⌄'}</span>
      </button>
      {ouvert ? <div className="vrm-fc-expl" data-fa-expl=""><p>{tr('fc.explication1')}</p><p>{tr('fc.explication2')}</p></div> : null}
    </section>
  );
}

function ListeSites({ F }) {
  return (
    <div className="vrm-fc-carte" role="list">
      {F.sites.map((s) => {
        const sous = ligneSite(s);
        const det = [s.boosts > 0 ? tr('fc.dontBoosts', { montant: eur(s.boosts) }) : '', s.options > 0 ? tr('fc.dontOptions', { montant: eur(s.options) }) : ''].filter(Boolean).join(' · ');
        return (
          <div key={s.plateforme} role="listitem" className="vrm-fc-rangee" data-fa-site={s.plateforme} data-fa-etat={s.etat} data-fa-raison={s.raison || undefined}
            data-fa-eur={s.frais == null ? '' : String(Math.round(s.frais * 100))} data-fa-lus={s.couverture ? `${s.couverture.lus}/${s.couverture.n}` : ''}
            data-fa-devise={s.autreDevise ? String(s.autreDevise) : undefined} data-fa-boosts={s.boosts > 0 ? String(Math.round(s.boosts * 100)) : undefined}>
            <span className="vrm-fc-pastille" aria-hidden="true">{(NOMS[s.plateforme] || '·').slice(0, 1)}</span>
            <span className="vrm-fc-nom">
              <span className="vrm-fc-nom-t">{NOMS[s.plateforme] || s.plateforme}</span>
              {sous ? <span className="vrm-fc-nom-s">{sous}</span> : null}
              {det ? <span className="vrm-fc-nom-s">{det}</span> : null}
            </span>
            <span className={'vrm-fc-val' + (s.frais == null ? ' is-vide' : '')}>
              {s.frais == null ? '—' : eur(s.frais)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
