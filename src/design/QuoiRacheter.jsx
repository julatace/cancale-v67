// ═══════════════════════════════════════════════════════════════════════════
// « MODÈLE ET TAILLE — QUOI RACHETER » — la carte d'Argent → Statistiques
// (14 nov., proposition 80). La règle : src/quoiRacheter.js (sur
// `classementRapporte`, les ventes RELIÉES à leur prix d'achat seulement).
// ═══════════════════════════════════════════════════════════════════════════
// En haut, « À racheter » (rentables ET rapides) ; dessous, chaque modèle × taille :
// bénéfice, par paire, marge, délai, nombre — trié à son choix. La couverture est
// dite à côté du titre (« sur 120 ventes reliées · 340 ventes ») ; le comment est
// replié. Chaque nombre rendu porte son attribut (centimes, '' = « — ») pour le banc.
import React from 'react';
import { tr } from '../i18n/index.js';
import { quoiRacheter, TRIS_RACHAT, MIN_RACHAT } from '../quoiRacheter.js';
import '../argent-choix.css';

const cents = (v) => (v == null ? '' : String(Math.round(Number(v) * 100)));
const VISIBLES = 8;
// Le délai médian : au dixième sous 10 jours (« 4,5 j »), au jour au-delà.
const jours = (m) => (m == null ? '—' : m < 1 ? tr('ac.qr.moinsUnJour') : tr('ac.qr.jours', { n: m < 10 ? Math.round(m * 10) / 10 : Math.round(m) }));

export default function QuoiRacheter({ lignes, Segmente, fmt, etat, onSaisirPrix = null }) {
  const [tri, setTri] = React.useState(() => { try { const v = localStorage.getItem('vrm_qr_tri'); return TRIS_RACHAT.includes(v) ? v : 'brut'; } catch (_) { return 'brut'; } });
  const [tout, setTout] = React.useState(false);
  const choisir = (v) => { setTri(v); setTout(false); try { localStorage.setItem('vrm_qr_tri', v); } catch (_) {} };
  const Q = React.useMemo(() => (Array.isArray(lignes) ? quoiRacheter(lignes, { tri }) : null), [lignes, tri]);
  const montant = (v) => (v == null ? '—' : fmt(v));
  const titre = <h2 className="vrm-ac-titre">{tr('ac.qr.titre')}</h2>;

  if (!Q || !Q.nReliees) {
    return (
      <section className="vrm-ac-section vrm-sv-repliee" data-stats-carte="sv-racheter" data-qr-etat={Q ? 'lu' : (etat || 'passu')} data-qr-n={Q ? Q.n : ''} data-qr-reliees={Q ? Q.nReliees : ''}>
        {titre}
        <p className="vrm-ac-couv">{!Q ? (etat === 'encours' ? tr('ac.qr.encours') : tr('ac.qr.pasLu')) : Q.n ? tr('ac.qr.aucuneReliee', { n: Q.n }) : tr('ac.qr.aucune')}</p>
        {Q && Q.n && onSaisirPrix ? <button type="button" className="vrm-lien-action vrm-ac-lien" data-qr-saisir="" onClick={onSaisirPrix}>{tr('ac.qr.saisir')}</button> : null}
      </section>
    );
  }
  const vus = tout ? Q.groupes : Q.groupes.slice(0, VISIBLES);
  const options = TRIS_RACHAT.filter((v) => v !== 'nombre').map((v) => ({ v, l: tr('ac.qr.tri.' + v), data: { 'data-qr-tri': v } }));
  return (
    <section className="vrm-ac-section" data-stats-carte="sv-racheter" data-qr-etat="lu" data-qr-n={Q.n} data-qr-reliees={Q.nReliees} data-qr-ndelai={Q.nDelai} data-qr-ecartees={Q.ecartees}
      data-qr-autres={Q.autres.n} data-qr-classables={Q.classables} data-qr-peu={Q.peu ? '1' : '0'} data-qr-tri-actif={tri}>
      <div className="vrm-ac-tete">
        {titre}
        <p className="vrm-ac-couv" data-qr-couv={`${Q.nReliees}/${Q.n}`}>{tr('ac.qr.couverture', { reliees: Q.nReliees, n: Q.n })}</p>
      </div>
      <div className="vrm-at-carte vrm-ac-carte vrm-ac-racheter" data-qr-racheter={Q.aRacheter.map((g) => g.k).join(',')}>
        <div className="vrm-ac-libelle vrm-ac-etiquette">{tr('ac.qr.aRacheter')}</div>
        {Q.peu ? <p className="vrm-ac-note" data-qr-peu-texte="">{tr('ac.qr.peu', { min: MIN_RACHAT })}</p>
          : !Q.aRacheter.length ? <p className="vrm-ac-note">{tr('ac.qr.aucunRachat')}</p>
            : (
              <ol className="vrm-ac-liste-rachat">
                {Q.aRacheter.slice(0, 3).map((g) => (
                  <li key={g.k} className="vrm-ac-rachat" data-qr-rachat={g.k} data-moyen={cents(g.moyen)} data-mediane={g.mediane}>
                    <span className="vrm-ac-rachat-nom">{g.nom}</span>
                    <span className="vrm-ac-rachat-chiffres">
                      <span><b className="vrm-ac-chiffre">{montant(g.moyen)}</b><span className="vrm-ac-libelle">{tr('ac.qr.parPaire')}</span></span>
                      <span><b className="vrm-ac-chiffre">{jours(g.mediane)}</b><span className="vrm-ac-libelle">{tr('ac.qr.pourVendre')}</span></span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
      </div>
      <Segmente label={tr('ac.qr.trier')} className="vrm-ac-tris" value={tri} onChange={choisir} options={options}/>
      <ol className="vrm-at-carte vrm-ac-carte vrm-ac-liste" data-qr-liste={Q.groupes.length}>
        {vus.map((g, rang) => (
          <li key={g.k} className="vrm-ac-groupe vrm-at-rangee" data-qr-ligne={g.k} data-n={g.n} data-brut={cents(g.brut)} data-moyen={cents(g.moyen)}
            data-marge={g.marge == null ? '' : g.marge} data-mediane={g.mediane == null ? '' : g.mediane} data-ndelai={g.nDelai}
            data-qr-a-racheter={Q.aRacheter.some((x) => x.k === g.k) ? '1' : undefined}>
            <span className="vrm-ac-rang">{rang + 1}</span>
            <span className="vrm-ac-corps">
              <span className="vrm-ac-titre-ligne">{g.nom}</span>
              <span className="vrm-ac-sous">{tr('ac.qr.vendues', { n: g.n })}{g.moyen != null ? ` · ${tr('ac.qr.moyPaire', { x: fmt(g.moyen) })}` : ''}{g.mediane != null ? ` · ${jours(g.mediane)}` : ''}</span>
            </span>
            <span className="vrm-ac-droite">
              <b className="vrm-ac-montant">{tri === 'moyen' ? montant(g.moyen) : tri === 'marge' ? (g.marge == null ? '—' : `${String(g.marge).replace('.', ',')} %`) : tri === 'vite' ? jours(g.mediane) : tri === 'nombre' ? String(g.n) : montant(g.brut)}</b>
              <span className="vrm-ac-libelle">{tri === 'moyen' ? tr('ac.qr.parPaire') : tri === 'marge' ? tr('ac.qr.marge') : tri === 'vite' ? tr('ac.qr.pourVendre') : tri === 'nombre' ? tr('ac.qr.ventes') : tr('ac.qr.benefice')}</span>
            </span>
          </li>
        ))}
      </ol>
      {Q.groupes.length > VISIBLES ? <button type="button" className="vrm-lien-action vrm-ac-lien" data-qr-tout={tout ? '1' : '0'} onClick={() => setTout(!tout)}>{tout ? tr('ac.qr.moins') : tr('ac.qr.toutVoir', { n: Q.groupes.length })}</button> : null}
      <details className="vrm-repli vrm-ac-repli">
        <summary>{tr('ac.qr.comment')}</summary>
        <p className="vrm-ac-note">{tr('ac.qr.commentTexte', { min: MIN_RACHAT })}</p>
        {Q.autres.n ? <p className="vrm-ac-note" data-qr-autres-texte="">{tr('ac.qr.autres', { n: Q.autres.n })}</p> : null}
        {Q.ecartees ? <p className="vrm-ac-note">{tr('ac.qr.ecartees', { n: Q.ecartees })}</p> : null}
      </details>
    </section>
  );
}
