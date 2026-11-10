// ═══════════════════════════════════════════════════════════════════════════
// « ARTICLES QUI DORMENT » — la liste de l'écran Annonces (3 novembre)
// ═══════════════════════════════════════════════════════════════════════════
// Les articles en ligne depuis longtemps, le plus ancien d'abord (la règle :
// src/quiDorment.js), seuil 30 / 60 / 90 j, vues et favoris quand ils sont lus,
// et UN geste par ligne (« Agir ») qui ouvre le choix : baisser le prix,
// republier, mettre sur Leboncoin ou sur eBay — chacun ouvre l'écran EXISTANT
// (rien ne part tout seul). Rien n'est calculé ici.
// (9 nov., « vendre plus ») Deux listes dans la même vue : « Qui dorment » et
// « Favoris sans vente » (src/vendrePlus.js, `favorisSansVente`). Un compteur
// pas LU s'écrit « pas lu » (jamais 0) ; les offres reçues par annonce ne sont
// pas lues par VRM : la phrase est dite UNE fois, en tête (§7).
import React from 'react';
import { SEUILS_QUI_DORMENT } from '../quiDorment.js';
import { SEUILS_FAVORIS, texteCompteur } from '../vendrePlus.js';

export default function QuiDorment({ liste, seuil, onSeuil, onAgir, Segmente, fmt, attrs, mode = 'dort', onMode, seuilFavoris = 5, onSeuilFavoris, nDort, nFavoris, pasLus }) {
  const fav = mode === 'favoris';
  const titre = fav ? 'Favoris sans vente' : 'Articles qui dorment';
  return (
    <section className="vrm-qd" data-qui-dorment="" data-qd-mode={mode} data-qd-seuil={fav ? seuilFavoris : seuil} data-qd-n={liste ? liste.length : ''} {...(attrs || {})}>
      {onMode ? (
        <Segmente label="Quelle liste" className="vrm-qd-modes" value={mode} onChange={(v) => onMode(v)}
          options={[
            { v: 'dort', l: <>Qui dorment{nDort != null ? <span className="vrm-of-n">{nDort}</span> : null}</>, data: { 'data-qd-mode-choix': 'dort' } },
            { v: 'favoris', l: <>Favoris sans vente{nFavoris != null ? <span className="vrm-of-n">{nFavoris}</span> : null}</>, data: { 'data-qd-mode-choix': 'favoris' } },
          ]}/>
      ) : null}
      <div className="vrm-qd-tete">
        <h2 className="vrm-display vrm-qd-titre">{titre}{liste ? <span className="vrm-qd-n">{liste.length}</span> : null}</h2>
        {fav
          ? <Segmente label="Au moins" className="vrm-qd-seuils" value={String(seuilFavoris)} onChange={(v) => onSeuilFavoris && onSeuilFavoris(Number(v))}
              options={SEUILS_FAVORIS.map((s) => ({ v: String(s), l: `${s} favoris`, data: { 'data-qd-choix': s } }))}/>
          : <Segmente label="En ligne depuis" className="vrm-qd-seuils" value={String(seuil)} onChange={(v) => onSeuil(Number(v))}
              options={SEUILS_QUI_DORMENT.map((s) => ({ v: String(s), l: `${s} j`, data: { 'data-qd-choix': s } }))}/>}
      </div>
      <p className="vrm-qd-sous vrm-qd-note" data-qd-note="">
        {fav ? 'Toujours en ligne, donc pas vendues. ' : ''}Offres reçues par annonce : pas lues par VRM.{pasLus ? ` ${pasLus}` : ''}
      </p>
      {!liste ? <div className="vrm-qd-vide">—</div>
        : !liste.length ? <div className="vrm-qd-vide" data-qd-vide="">{fav ? `Aucune annonce en ligne avec ${seuilFavoris} favoris ou plus.` : `Aucun article en ligne depuis ${seuil} jours ou plus.`}</div>
          : (
            <ul className="vrm-qd-liste">
              {liste.map((a) => (
                <li key={a.id} className="vrm-qd-ligne" data-qd-ligne={a.id} data-qd-age={a.age == null ? '' : a.age} data-qd-vues={a.vues == null ? '' : a.vues} data-qd-favoris={a.favoris == null ? '' : a.favoris}>
                  {a.photo ? <img className="vrm-qd-photo" data-vrm-vignette="" src={a.photo} alt="" loading="lazy"/> : <span className="vrm-qd-photo" aria-hidden="true"/>}
                  <span className="vrm-qd-centre">
                    <span className="vrm-qd-nom">{a.numero ? <span className="vrm-qd-num">N°{a.numero}</span> : null}{a.titre || 'Sans titre'}</span>
                    <span className="vrm-qd-sous">
                      <span className="vrm-qd-age vrm-qd-bloc">{a.age == null ? 'date pas lue' : `${a.age} j`}</span>
                      {a.prix != null ? <> · <span className="vrm-qd-bloc">{fmt(a.prix)}</span></> : null}
                      {' · '}<span className="vrm-qd-bloc" data-qd-vues-txt="">{texteCompteur(a.vues, 'vue', 'vues', 'vues pas lues')}</span>
                      {' · '}<span className="vrm-qd-bloc" data-qd-favoris-txt="">{texteCompteur(a.favoris, 'favori', 'favoris', 'favoris pas lus')}</span>
                    </span>
                    {a.compte ? <span className="vrm-qd-sous">{a.compte}</span> : null}
                  </span>
                  <button type="button" className="vrm-qd-agir" data-qd-agir={a.id} aria-haspopup="dialog" onClick={() => onAgir(a)}>Agir</button>
                </li>
              ))}
            </ul>
          )}
    </section>
  );
}
