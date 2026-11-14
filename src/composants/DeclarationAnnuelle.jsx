// ═══════════════════════════════════════════════════════════════════════════
// « TA DÉCLARATION DE REVENUS » PRÊTE — Argent → Déclarer (14 nov., proposition 82)
// La règle : src/declarationAnnuelle.js (le montant et la case de
// `declarationRevenus`, la source recomposée depuis la MÊME ligne publiée).
// ═══════════════════════════════════════════════════════════════════════════
// Chaque montant avec SA case et SA source : « 12 340 € = ventes reçues en 2026,
// 340 ventes » ; ce qui est hors total est NOMMÉ ; le statut n'est jamais deviné.
// Le comment (notice, abattement appliqué par les impôts) est replié.
import React from 'react';
import { tr } from '../i18n/index.js';
import '../argent-choix.css';

const cents = (v) => (v == null ? '' : String(Math.round(Number(v) * 100)));

export default function DeclarationAnnuelle({ D, fmt, id = 'compta-revenus' }) {
  if (!D || D.etat === 'sansObjet') return null;
  const titre = <h2 className="vrm-ac-titre">{D.annee ? tr('ac.dr.titreAnnee', { annee: String(D.annee) }) : tr('ac.dr.titre')}</h2>;
  if (D.etat === 'encours' || D.etat === 'statut' || D.etat === 'passu') {
    return (
      <section id={id} className="vrm-ac-section vrm-sv-repliee" data-dr-etat={D.etat}>
        {titre}
        <p className="vrm-ac-couv">{tr('ac.dr.' + D.etat)}</p>
      </section>
    );
  }
  const S = D.source;
  const H = S.horsTotal;
  const auMoins = D.partiel;
  const quand = D.enCours ? tr('ac.dr.quandEnCours', { annee: String(D.annee + 1) }) : tr('ac.dr.quandPret', { annee: String(D.annee + 1) });
  return (
    <section id={id} className="vrm-ac-section" data-dr-etat={D.etat} data-dr-annee={D.annee} data-dr-ca={cents(D.ca)} data-dr-cases={D.cases.join(',')}
      data-dr-n={S.nVentes} data-dr-adater-sur={S.aDaterSur ? S.aDaterSur.n : 0} data-dr-hors-adater={H.aDater.n} data-dr-illisibles={H.illisibles} data-dr-passu={H.pasSu.join(',')} data-dr-partiel={auMoins ? '1' : '0'}>
      <div className="vrm-ac-tete">
        {titre}
        <p className="vrm-ac-couv">{quand}</p>
      </div>
      <div className="vrm-at-carte vrm-ac-carte vrm-ac-decl">
        {D.montants.map((m) => (
          <div key={m.case} className="vrm-ac-montant-case" data-dr-case={m.case} data-dr-montant={cents(m.montant)}>
            <span className="vrm-ac-case-pastille">{tr('ac.dr.case', { c: m.case })}</span>
            <span className="vrm-ac-affiche">{auMoins ? <span className="vrm-ac-aumoins">{tr('ac.dr.auMoins')} </span> : null}{D.etat === 'incoherent' ? '—' : fmt(m.montant)}</span>
            {m.si ? <span className="vrm-ac-libelle">{tr(m.si === 'avec' ? 'ac.dr.siAvec' : 'ac.dr.siSans')}</span> : null}
          </div>
        ))}
        {D.etat === 'incoherent' ? <p className="vrm-ac-note is-ambre" data-dr-incoherent="">{tr('ac.dr.incoherent')}</p> : (
          <>
            <p className="vrm-ac-source" data-dr-source="">{tr('ac.dr.source', { annee: String(D.annee), n: S.nVentes })}</p>
            {S.parSites.length ? (
              <ul className="vrm-ac-sites">
                {S.parSites.map((x) => (
                  <li key={x.plateforme} className="vrm-ac-site" data-dr-site={x.plateforme} data-n={x.n} data-eur={cents(x.ca)}>
                    <span className="vrm-ac-site-nom">{x.plateforme}</span>
                    <span className="vrm-ac-site-n">{tr('ac.dr.ventes', { n: x.n })}</span>
                    <span className="vrm-ac-site-eur">{fmt(x.ca)}</span>
                  </li>
                ))}
                {S.aDaterSur ? (
                  <li className="vrm-ac-site" data-dr-site="aDaterSur" data-n={S.aDaterSur.n} data-eur={cents(S.aDaterSur.ca)}>
                    <span className="vrm-ac-site-nom">{tr('ac.dr.aDaterSur')}</span>
                    <span className="vrm-ac-site-n">{tr('ac.dr.ventes', { n: S.aDaterSur.n })}</span>
                    <span className="vrm-ac-site-eur">{fmt(S.aDaterSur.ca)}</span>
                  </li>
                ) : null}
              </ul>
            ) : null}
          </>
        )}
        {H.aDater.n || H.illisibles || H.pasSu.length || H.nonComptees ? (
          <ul className="vrm-ac-hors" data-dr-hors="">
            {H.aDater.n ? <li className="is-ambre" data-dr-hors-ligne="adater">{tr('ac.dr.horsADater', { n: H.aDater.n, x: fmt(H.aDater.ca) })}</li> : null}
            {H.pasSu.length ? <li className="is-ambre" data-dr-hors-ligne="passu">{tr('ac.dr.horsPasSu', { x: H.pasSu.join(', ') })}</li> : null}
            {H.illisibles ? <li className="is-ambre" data-dr-hors-ligne="illisibles">{tr('ac.dr.horsIllisibles', { n: H.illisibles })}</li> : null}
            {H.nonComptees ? <li className="is-ambre" data-dr-hors-ligne="noncomptees">{tr('ac.dr.horsNonComptees', { n: H.nonComptees })}</li> : null}
          </ul>
        ) : null}
        {!D.liberatoire ? <p className="vrm-ac-note is-ambre" data-dr-question="">{tr('ac.dr.question')}</p> : null}
      </div>
      <details className="vrm-repli vrm-ac-repli">
        <summary>{tr('ac.dr.comment')}</summary>
        <p className="vrm-ac-note">{tr(D.liberatoire === 'oui' ? 'ac.dr.commentOui' : 'ac.dr.commentNon')}</p>
        <p className="vrm-ac-note">{tr('ac.dr.commentDate')}</p>
      </details>
    </section>
  );
}
