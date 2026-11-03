// ═══════════════════════════════════════════════════════════════════════════
// « ARTICLES QUI DORMENT » — la liste de l'écran Annonces (3 novembre)
// ═══════════════════════════════════════════════════════════════════════════
// Les articles en ligne depuis longtemps, le plus ancien d'abord (la règle :
// src/quiDorment.js), seuil 30 / 60 / 90 j, vues et favoris quand ils sont lus,
// et UN geste par ligne (« Agir ») qui ouvre le choix : baisser le prix,
// republier, mettre sur Leboncoin ou sur eBay — chacun ouvre l'écran EXISTANT
// (rien ne part tout seul). Rien n'est calculé ici.
import React from 'react';
import { SEUILS_QUI_DORMENT } from '../quiDorment.js';

export default function QuiDorment({ liste, seuil, onSeuil, onAgir, Segmente, fmt, attrs }) {
  const pl = (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`;
  return (
    <section className="vrm-qd" data-qui-dorment="" data-qd-seuil={seuil} data-qd-n={liste ? liste.length : ''} {...(attrs || {})}>
      <div className="vrm-qd-tete">
        <h2 className="vrm-display vrm-qd-titre">Articles qui dorment{liste ? <span className="vrm-qd-n">{liste.length}</span> : null}</h2>
        <Segmente label="En ligne depuis" className="vrm-qd-seuils" value={String(seuil)} onChange={(v) => onSeuil(Number(v))}
          options={SEUILS_QUI_DORMENT.map((s) => ({ v: String(s), l: `${s} j`, data: { 'data-qd-choix': s } }))}/>
      </div>
      {!liste ? <div className="vrm-qd-vide">—</div>
        : !liste.length ? <div className="vrm-qd-vide" data-qd-vide="">Aucun article en ligne depuis {seuil} jours ou plus.</div>
          : (
            <ul className="vrm-qd-liste">
              {liste.map((a) => (
                <li key={a.id} className="vrm-qd-ligne" data-qd-ligne={a.id} data-qd-age={a.age} data-qd-vues={a.vues == null ? '' : a.vues} data-qd-favoris={a.favoris == null ? '' : a.favoris}>
                  {a.photo ? <img className="vrm-qd-photo" src={a.photo} alt="" loading="lazy"/> : <span className="vrm-qd-photo" aria-hidden="true"/>}
                  <span className="vrm-qd-centre">
                    <span className="vrm-qd-nom">{a.numero ? <span className="vrm-qd-num">N°{a.numero}</span> : null}{a.titre || 'Sans titre'}</span>
                    <span className="vrm-qd-sous"><span className="vrm-qd-age">{a.age} j</span>{a.prix != null ? <> · {fmt(a.prix)}</> : null}{a.vues != null ? <> · {pl(a.vues, 'vue')}</> : null}{a.favoris != null ? <> · {pl(a.favoris, 'favori')}</> : null}</span>
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
