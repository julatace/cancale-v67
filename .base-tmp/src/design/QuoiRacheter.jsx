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
import { Carte, Rangee, Segmente as NSegmente } from '../natif/index.js';
import { AideArgent } from '../natif/ecrans/AideArgent.jsx';

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
  // (20 nov., lot argent-natif) AU STYLE NATIF §2 bis : une carte à filet (« MODÈLE ET TAILLE », la couverture en une ligne
  // grise), « Comment c'est calculé » en « ? » dans l'en-tête ; « À racheter » puis le classement en rangées sobres (le
  // nom, « N vendues · X € par paire · N j » en gris, le chiffre du tri à droite). La même règle (`quoiRacheter`).
  if (!Q || !Q.nReliees) {
    return (
      <Carte titre={tr('ac.qr.titre')} className="vrm-sv-repliee" sousTitre={!Q ? (etat === 'encours' ? tr('ac.qr.encours') : tr('ac.qr.pasLu')) : Q.n ? tr('ac.qr.aucuneReliee', { n: Q.n }) : tr('ac.qr.aucune')}
        attrs={{ 'data-stats-carte': 'sv-racheter', 'data-qr-etat': Q ? 'lu' : (etat || 'passu'), 'data-qr-n': Q ? Q.n : '', 'data-qr-reliees': Q ? Q.nReliees : '' }}>
        {Q && Q.n && onSaisirPrix ? <Rangee titre={tr('ac.qr.saisir')} ton="ambre" fin="chevron" onClick={onSaisirPrix} attrs={{ 'data-qr-saisir': '' }}/> : null}
      </Carte>
    );
  }
  const vus = tout ? Q.groupes : Q.groupes.slice(0, VISIBLES);
  const options = TRIS_RACHAT.filter((v) => v !== 'nombre').map((v) => ({ cle: v, libelle: tr('ac.qr.tri.' + v), attrs: { 'data-qr-tri': v } }));
  const droite = (g) => (tri === 'moyen' ? montant(g.moyen) : tri === 'marge' ? (g.marge == null ? '—' : `${String(g.marge).replace('.', ',')} %`) : tri === 'vite' ? jours(g.mediane) : tri === 'nombre' ? String(g.n) : montant(g.brut));
  const libDroite = tri === 'moyen' ? tr('ac.qr.parPaire') : tri === 'marge' ? tr('ac.qr.marge') : tri === 'vite' ? tr('ac.qr.pourVendre') : tri === 'nombre' ? tr('ac.qr.ventes') : tr('ac.qr.benefice');
  return (
    <Carte titre={tr('ac.qr.titre')} sousTitre={<span data-qr-couv={`${Q.nReliees}/${Q.n}`}>{tr('ac.qr.couverture', { reliees: Q.nReliees, n: Q.n })}</span>}
      action={<AideArgent titre={tr('ac.qr.comment')}>
        <p>{tr('ac.qr.commentTexte', { min: MIN_RACHAT })}</p>
        {Q.autres.n ? <p data-qr-autres-texte="">{tr('ac.qr.autres', { n: Q.autres.n })}</p> : null}
        {Q.ecartees ? <p>{tr('ac.qr.ecartees', { n: Q.ecartees })}</p> : null}
      </AideArgent>}
      attrs={{ 'data-stats-carte': 'sv-racheter', 'data-qr-etat': 'lu', 'data-qr-n': Q.n, 'data-qr-reliees': Q.nReliees, 'data-qr-ndelai': Q.nDelai, 'data-qr-ecartees': Q.ecartees,
        'data-qr-autres': Q.autres.n, 'data-qr-classables': Q.classables, 'data-qr-peu': Q.peu ? '1' : '0', 'data-qr-tri-actif': tri }}>
      <div className="n-arg-sous-groupe" data-qr-racheter={Q.aRacheter.map((g) => g.k).join(',')}>
        <h3 className="n-arg-sous-titre">{tr('ac.qr.aRacheter')}</h3>
        {Q.peu ? <Rangee titre={tr('ac.qr.peu', { min: MIN_RACHAT })} attrs={{ 'data-qr-peu-texte': '' }}/>
          : !Q.aRacheter.length ? <Rangee titre={tr('ac.qr.aucunRachat')}/>
            : Q.aRacheter.slice(0, 3).map((g) => (
              <Rangee key={g.k} titre={g.nom} valeur={montant(g.moyen)} detailValeur={tr('ac.qr.parPaire')} sousTitre={`${jours(g.mediane)} ${tr('ac.qr.pourVendre')}`}
                attrs={{ 'data-qr-rachat': g.k, 'data-moyen': cents(g.moyen), 'data-mediane': g.mediane }}/>
            ))}
      </div>
      <div className="n-arg-tri"><NSegmente libelle={tr('ac.qr.trier')} valeur={tri} onChange={choisir} options={options}/></div>
      <div className="n-arg-liste" data-qr-liste={Q.groupes.length}>
        {vus.map((g, rang) => (
          <Rangee key={g.k} titre={`${rang + 1}. ${g.nom}`} valeur={droite(g)} valeurForte detailValeur={libDroite}
            sousTitre={`${tr('ac.qr.vendues', { n: g.n })}${g.moyen != null ? ` · ${tr('ac.qr.moyPaire', { x: fmt(g.moyen) })}` : ''}${g.mediane != null ? ` · ${jours(g.mediane)}` : ''}`}
            attrs={{ 'data-qr-ligne': g.k, 'data-n': g.n, 'data-brut': cents(g.brut), 'data-moyen': cents(g.moyen), 'data-marge': g.marge == null ? '' : g.marge, 'data-mediane': g.mediane == null ? '' : g.mediane,
              'data-ndelai': g.nDelai, 'data-qr-a-racheter': Q.aRacheter.some((x) => x.k === g.k) ? '1' : undefined }}/>
        ))}
        {Q.groupes.length > VISIBLES ? <Rangee titre={tout ? tr('ac.qr.moins') : tr('ac.qr.toutVoir', { n: Q.groupes.length })} fin="chevron" onClick={() => setTout(!tout)} attrs={{ 'data-qr-tout': tout ? '1' : '0' }}/> : null}
      </div>
    </Carte>
  );
}
