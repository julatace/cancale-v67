// ══════════════════════════════════════════════════════════════════════════════
// « SIRI ET RACCOURCIS » — Paramètres → Affichage (10 novembre, lot AH)
// ══════════════════════════════════════════════════════════════════════════════
// Pour chaque raccourci : ce qu'on dit à Siri, le lien à copier, trois étapes
// dans l'app Raccourcis ; le reste replié. Les liens et la règle de lecture :
// src/raccourcisSiri.js. Le style : celui du guide SMS (src/design/sms-colis.css).
import React from 'react';
import './design/sms-colis.css';
import { BoutonBase as Bouton } from './composants/Bouton.jsx';
import { RACCOURCIS_SIRI, ORIGINE_VRM } from './raccourcisSiri.js';

export default function RaccourcisSiri({ toast = () => {}, origine = ORIGINE_VRM }) {
  const copier = async (lien) => {
    try { await navigator.clipboard.writeText(lien); toast('✓ Lien copié'); } catch (_) { toast('Copie impossible : sélectionne le lien', 'error'); }
  };
  return (
    <div className="vrm-sc" data-raccourcis-siri="">
      <p className="vrm-sc-intro">Parle à Siri : VRM s’ouvre au bon endroit.</p>
      {RACCOURCIS_SIRI.map((r) => {
        const lien = r.lien(origine);
        return (
          <section key={r.cle} className="vrm-sc-bloc" data-raccourci={r.cle} aria-label={r.nom}>
            <div className="vrm-sc-etat">{r.nom}</div>
            <div className="vrm-sc-sous">{r.dire}</div>
            <div className="vrm-sc-code" data-raccourci-lien={r.cle}>{lien}</div>
            <div className="vrm-sc-gestes">
              <Bouton variante="primaire" data-raccourci-copier={r.cle} onClick={() => copier(lien)}>Copier le lien</Bouton>
            </div>
            <ol className="vrm-sc-court" aria-label={`Créer « ${r.nom} » en 3 étapes`} data-raccourci-etapes={r.cle}>
              {r.etapes.map((e) => <li key={e}>{e}</li>)}
            </ol>
            <details className="vrm-sc-detail" data-raccourci-plus={r.cle}>
              <summary>Aller plus loin</summary>
              <p className="vrm-sc-sous">{r.plus}</p>
            </details>
          </section>
        );
      })}
      <details className="vrm-sc-detail" data-raccourcis-pourquoi="">
        <summary>Pourquoi ?</summary>
        <p className="vrm-sc-sous">Le lien s’ouvre dans Safari : connecte-toi une fois à VRM dans Safari. Le lien ne contient que ce que tu dis à Siri ; VRM l’efface dès qu’il l’a lu.</p>
      </details>
    </div>
  );
}
