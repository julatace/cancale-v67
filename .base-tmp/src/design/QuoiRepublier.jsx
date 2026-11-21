// ═══════════════════════════════════════════════════════════════════════════
// « QUELLES ANNONCES REPUBLIER ? » (11 nov., lot quoi-republier)
// ═══════════════════════════════════════════════════════════════════════════
// La carte posée en tête de l'atelier Republier (Annonces → Republier pour Vinted,
// la feuille « Republier sur Leboncoin »). Rien n'est calculé ici : la liste vient
// de `quoiRepublier` (src/quoiRepublier.js, sur `articlesQuiDorment`). Un toucher
// sur une ligne la COCHE (ou la décoche) dans l'atelier ; rien ne part : c'est lui
// qui lance ensuite (§3). « Pas su » est dit (« vues pas lues »), jamais 0.
// Tout le texte passe par tr() (5 langues).
import React from 'react';
import { tr } from '../i18n/index.js';
import { SegmenteBase } from '../composants/Bouton.jsx';
import { SEUILS_JOURS, SEUILS_FAVORIS_MAX, SEUILS_VUES_MAX, raisonRepublier } from '../quoiRepublier.js';

const MONTRES = 5;

// La raison d'une ligne : « 45 j en ligne · 2 favoris · 12 vues ».
export const texteRaison = (l) => {
  const r = raisonRepublier(l); if (!r) return '';
  return [
    tr('qr.raison.jours', { n: r.jours }),
    r.favoris == null ? tr('qr.raison.favorisPasLus') : tr('qr.raison.favoris', { n: r.favoris }),
    r.vues == null ? tr('qr.raison.vuesPasLues') : tr('qr.raison.vues', { n: r.vues }),
  ].join(' · ');
};

function Ligne({ l, coche, onBasculer, Photo }) {
  return (
    <li>
      <button type="button" className="vrm-qr-ligne" data-qr-ligne={l.cle} data-qr-coche={coche ? '1' : '0'}
        data-qr-age={l.age} data-qr-vues={l.vues == null ? '' : l.vues} data-qr-favoris={l.favoris == null ? '' : l.favoris}
        aria-pressed={coche} onClick={() => onBasculer(l)}>
        {l.photo ? (Photo ? <Photo src={l.photo} alt="" className="vrm-qr-photo" loading="lazy"/> : <img className="vrm-qr-photo" src={l.photo} alt="" loading="lazy"/>) : <span className="vrm-qr-photo" aria-hidden="true"/>}
        <span className="vrm-qr-centre">
          <span className="vrm-qr-nom">{l.numero ? <span className="vrm-qr-num">N°{l.numero}</span> : null}{l.titre || tr('qr.sansTitre')}</span>
          <span className="vrm-qr-raison" data-qr-raison="">{texteRaison(l)}</span>
          {l.compte ? <span className="vrm-qr-compte">{l.compte}</span> : null}
        </span>
        <span className="vrm-qr-marque" aria-hidden="true">{coche ? '✓' : '+'}</span>
      </button>
    </li>
  );
}

export default function QuoiRepublier({ res, reglage, onReglage, estCoche, onBasculer, onCocherTout, Photo, pasLu, site = 'vinted' }) {
  const [tout, setTout] = React.useState(false);
  const r = (res && res.reglage) || reglage;
  const poser = (k, v) => onReglage && onReglage({ ...r, [k]: Number(v) });
  const liste = res ? res.liste : [];
  const montres = tout ? liste : liste.slice(0, MONTRES);
  const nonCochees = liste.filter((l) => !estCoche(l));
  const resume = [tr('qr.reglage.joursOpt', { n: r.jours }), tr('qr.reglage.favorisMax', { n: r.favoris }), tr('qr.reglage.vuesMax', { n: r.vues })].join(' · ');
  return (
    <section className="vrm-qr" data-quoi-republier={site} data-qr-n={res ? res.n : ''} data-qr-verifier={res ? res.aVerifier.length : ''}
      data-qr-jours={r.jours} data-qr-fav-max={r.favoris} data-qr-vues-max={r.vues}>
      <div className="vrm-qr-tete">
        <h2 className="vrm-qr-titre">{tr('qr.titre')}{res ? <span className="vrm-qr-n">{res.n}</span> : null}</h2>
        {res && res.n > 0 && nonCochees.length > 0 ? (
          <button type="button" className="vrm-lien-action vrm-qr-tout" data-qr-tout={nonCochees.length} onClick={() => onCocherTout(nonCochees)}>{tr('qr.toutCocher', { n: nonCochees.length })}</button>
        ) : null}
      </div>
      <details className="vrm-repli vrm-qr-reglages" data-qr-reglages="">
        <summary>{resume}</summary>
        <div className="vrm-qr-reglages-corps">
          <span className="vrm-qr-label">{tr('qr.reglage.jours')}</span>
          <SegmenteBase label={tr('qr.reglage.jours')} value={String(r.jours)} onChange={(v) => poser('jours', v)}
            options={SEUILS_JOURS.map((s) => ({ v: String(s), l: tr('qr.reglage.joursOpt', { n: s }), data: { 'data-qr-jours-choix': s } }))}/>
          <span className="vrm-qr-label">{tr('qr.reglage.favoris')}</span>
          <SegmenteBase label={tr('qr.reglage.favoris')} value={String(r.favoris)} onChange={(v) => poser('favoris', v)}
            options={SEUILS_FAVORIS_MAX.map((s) => ({ v: String(s), l: tr('qr.reglage.auPlus', { n: s }), data: { 'data-qr-fav-choix': s } }))}/>
          <span className="vrm-qr-label">{tr('qr.reglage.vues')}</span>
          <SegmenteBase label={tr('qr.reglage.vues')} value={String(r.vues)} onChange={(v) => poser('vues', v)}
            options={SEUILS_VUES_MAX.map((s) => ({ v: String(s), l: tr('qr.reglage.auPlus', { n: s }), data: { 'data-qr-vues-choix': s } }))}/>
        </div>
      </details>
      {!res ? <p className="vrm-qr-vide" data-qr-pas-lu="">— {pasLu || tr('qr.pasLu')}</p>
        : !res.n ? <p className="vrm-qr-vide" data-qr-vide="">{tr('qr.vide')}</p>
          : (<>
            <ul className="vrm-qr-liste">{montres.map((l) => <Ligne key={l.cle} l={l} coche={estCoche(l)} onBasculer={onBasculer} Photo={Photo}/>)}</ul>
            {liste.length > MONTRES ? <button type="button" className="vrm-lien-action vrm-qr-plus" data-qr-plus="" aria-expanded={tout} onClick={() => setTout((v) => !v)}>{tout ? tr('qr.moins') : tr('qr.voirTout', { n: liste.length })}</button> : null}
          </>)}
      {res && res.aVerifier.length ? (
        <details className="vrm-repli vrm-qr-verifier" data-qr-a-verifier={res.aVerifier.length}>
          <summary>{tr('qr.aVerifier', { n: res.aVerifier.length })}</summary>
          <ul className="vrm-qr-liste">{res.aVerifier.map((l) => <Ligne key={l.cle} l={l} coche={estCoche(l)} onBasculer={onBasculer} Photo={Photo}/>)}</ul>
        </details>
      ) : null}
      {res && res.sansDate > 0 ? <p className="vrm-qr-note" data-qr-sans-date={res.sansDate}>{tr('qr.sansDate', { n: res.sansDate })}</p> : null}
    </section>
  );
}
