// ── src/natif/ecrans/StatsVendsMieux.jsx — Statistiques › Finances : « Ce que tu vends le mieux » (21 nov., lot rentabilite, n° 36) ──
// Remplace les trois listes « marques · modèles · tailles » (lot journee-stats) par UNE carte : l'axe (modèle, marque,
// taille, modèle × taille), le tri (marge, vitesse, volume), « à racheter en priorité » (meilleur score marge × vitesse,
// 3 ventes reliées et datées au moins) et le classement ; puis « Ce qui a été regroupé », replié, pour VOIR ce que la
// normalisation du modèle a rassemblé (une statistique, jamais une identité).
// Une VUE : tout arrive calculé (`M.mieux`, src/vendsMieux.js) — aucun calcul, aucun tri ici (l'ordre de chaque tri est
// dans le modèle). Un chiffre pas su = « — » et sa raison ; une marge porte sa couverture (« sur N ») ; jamais 0 inventé.
// Chaque nombre porte `data-ps-mieux-*` (centimes ou nombre, '' = « — ») : le banc lit les nombres, jamais un libellé.
import React from 'react';
import { tr, nombre } from '../../i18n/index.js';
import { Segmente, Colonne, Carte, Rangee } from '../index.js';
import { AXES_MIEUX, TRIS_MIEUX } from '../../vendsMieux.js';
// (23 nov., lot rentabilite-source) le 5e regroupement : la SOURCE de l'achat (src/rentabiliteSource.js, sur la publication
// de « Tes meilleures sources » — aucune règle neuve ; `sources` : undefined lecture · null pas su · modèle).
import { AXE_SOURCE } from '../../rentabiliteSource.js';
const AXES = [...AXES_MIEUX, AXE_SOURCE];

const cents = (x) => (x == null || !Number.isFinite(Number(x)) ? '' : String(Math.round(Number(x) * 100)));
const MAX_LIGNES = 8;
const lireChoix = (k, ok, d) => { try { const v = localStorage.getItem(k); return ok.includes(v) ? v : d; } catch (_) { return d; } };
const garder = (k, v) => { try { localStorage.setItem(k, v); } catch (_) { /* rien */ } };

export default function StatsVendsMieux({ mieux, sur = '', montant = (x) => String(x), lecture = false, raison = '', sources = undefined }) {
  const [axe, setAxe] = React.useState(() => lireChoix('vrm_stats_mieux_axe', AXES, 'modele'));
  const [tri, setTri] = React.useState(() => lireChoix('vrm_stats_mieux_tri', TRIS_MIEUX, 'marge'));
  const [voirRegroupe, setVoirRegroupe] = React.useState(false);
  const A = mieux ? mieux[axe] : null;
  const parK = A ? new Map(A.groupes.map((g) => [g.k, g])) : null;
  const ordre = A ? A.ordre[tri].map((k) => parK.get(k)).filter(Boolean) : [];
  const jours = (j) => tr('v2.st.jours', { n: Math.round(j), j: nombre(Math.round(j)) });
  // Le chiffre du tri est à droite ; il ne se redit pas dessous (le même nombre jamais deux fois sur une rangée).
  const sous = (g) => [tri !== 'volume' ? tr('v2.comptes.ventes', { n: g.n }) : '', g.prixMoyen != null ? tr('rt.prixMoyen', { p: montant(g.prixMoyen) }) : '',
    tri !== 'vitesse' && g.mediane != null ? tr('rt.delai', { d: jours(g.mediane) }) : '', g.taux != null ? tr('rt.taux', { t: nombre(g.taux) }) : ''].filter(Boolean).join(' · ');
  const valeur = (g) => (tri === 'vitesse' ? (g.mediane != null ? jours(g.mediane) : '—')
    : tri === 'volume' ? nombre(g.n)
      : g.moyen != null ? (g.moyen >= 0 ? '+' : '−') + montant(Math.abs(g.moyen)) : '—');
  const detail = (g) => (tri === 'marge' && g.moyen != null && g.nCout < g.n ? tr('rt.surN', { k: nombre(g.nCout), n: nombre(g.n) }) : tri === 'marge' && g.moyen == null ? tr('rt.sansPrix') : '');
  const choix = (
    <div className="n-ps-mieux-choix">
      <Segmente libelle={tr('rt.axe')} valeur={axe} onChange={(x) => { setAxe(x); garder('vrm_stats_mieux_axe', x); setVoirRegroupe(false); }}
        options={AXES.map((x) => ({ cle: x, libelle: tr('rt.axe.' + x) }))}/>
      <Segmente libelle={tr('rt.tri')} valeur={tri} onChange={(x) => { setTri(x); garder('vrm_stats_mieux_tri', x); }}
        options={TRIS_MIEUX.map((x) => ({ cle: x, libelle: tr('rt.tri.' + x) }))}/>
    </div>
  );
  if (axe === AXE_SOURCE) return <ParSource S={sources} tri={tri} choix={choix} montant={montant} jours={jours}/>;
  const attente = lecture || mieux === undefined;
  return (
    <>
      <Colonne pleine>
        <Carte titre={tr('rt.titre')} sousTitre={sur} className="n-ps-mieux"
          attrs={{ 'data-ps-bloc': 'mieux', 'data-ps-mieux-axe': axe, 'data-ps-mieux-tri': tri, 'aria-busy': attente ? 'true' : undefined,
            'data-ps-mieux-ordre': ordre.map((g) => g.k).join('|'), 'data-ps-mieux-n': A ? String(A.n) : '', 'data-ps-mieux-ncout': A ? String(A.nCout) : '' }}>
          {choix}
          <p className="n-ps-mieux-tete">{tr('rt.racheter')}</p>
          <div data-ps-racheter={A ? A.aRacheter.map((g) => g.k).join('|') : ''}>
            {!A ? <Rangee titre={attente ? tr('v2.jour.lecture') : (raison || tr('v2.st.raison.releve'))}/>
              : A.aRacheter.length ? A.aRacheter.map((g) => (
                <Rangee key={g.k} titre={g.nom} sousLignes={2} sousTitre={[tr('rt.parPaire', { p: montant(g.moyen) }), tr('rt.delai', { d: jours(g.mediane) }), tr('rt.reliees', { n: nombre(g.n) })].join(' · ')}
                  valeur={tr('rt.parJour', { p: montant(g.score) })} valeurForte attrs={{ 'data-ps-racheter-k': g.k, 'data-ps-score': cents(g.score) }}/>
              )) : <Rangee titre={tr('rt.racheter.peu', { n: A.min })}/>}
          </div>
          <p className="n-ps-mieux-tete">{tr('rt.classement')}</p>
          {!A ? null : ordre.length ? ordre.slice(0, MAX_LIGNES).map((g) => (
            <Rangee key={g.k} titre={g.nom} sousTitre={sous(g)} sousLignes={2} valeur={valeur(g)} valeurForte detailValeur={detail(g)}
              attrs={{ 'data-ps-mieux-ligne': g.k, 'data-n': String(g.n), 'data-ncout': String(g.nCout), 'data-moyen': cents(g.moyen), 'data-prix': cents(g.prixMoyen),
                'data-mediane': g.mediane == null ? '' : String(g.mediane), 'data-taux': g.taux == null ? '' : String(g.taux), 'data-mises': g.mises == null ? '' : String(g.mises) }}/>
          )) : <Rangee titre={tr('v2.ps.top.aucun')}/>}
          {A ? <p className="n-ps-mieux-note" data-ps-mieux-couv="">{[
            tr('rt.couv.marge', { k: nombre(A.nCout), n: nombre(A.n) }),
            A.taux ? tr('rt.couv.taux', { n: nombre(A.taux.datees) }) : tr('rt.couv.tauxPasSu'),
            A.autres && A.autres.n ? tr('rt.couv.autres', { n: nombre(A.autres.n) }) : '',
          ].filter(Boolean).join(' · ')}</p> : null}
          {A && A.regroupes.length ? <Rangee titre={tr('rt.regroupe')} sousLignes={2} sousTitre={tr('rt.regroupe.sous', { n: nombre(A.regroupes.length) })} fin="chevron"
            onClick={() => setVoirRegroupe((x) => !x)} attrs={{ 'aria-expanded': voirRegroupe ? 'true' : 'false', 'data-ps-regroupe-ouvrir': '' }}/> : null}
          {A && voirRegroupe ? <div data-ps-regroupe={String(A.regroupes.length)}>
            {A.regroupes.map((r) => (
              <Rangee key={r.k} titre={r.nom} sousLignes={2}
                sousTitre={r.titres.map((x) => '« ' + x.t + ' »' + (x.n > 1 ? ' × ' + x.n : '')).join(' · ') + (r.reste ? ' · ' + tr('rt.regroupe.reste', { n: nombre(r.reste) }) : '')}
                valeur={nombre(r.n)} attrs={{ 'data-ps-regroupe-k': r.k, 'data-variantes': String(r.variantes) }}/>
            ))}
          </div> : null}
        </Carte>
      </Colonne>
    </>
  );
}

// ── LE 5e REGROUPEMENT : LA SOURCE DE L'ACHAT (23 nov., lot rentabilite-source) ──
// Tous ses achats (pas la fenêtre : la publication de « Tes meilleures sources » couvre tout, c'est dit en sous-titre).
// Une rangée par source : le chiffre du tri à droite ; dessous, ce qui ne se redit pas (reventes, taux, délai).
function ParSource({ S, tri, choix, montant, jours }) {
  const parK = S ? new Map(S.groupes.map((g) => [g.k, g])) : null;
  const ordre = S ? S.ordre[tri].map((k) => parK.get(k)).filter(Boolean) : [];
  const signe = (c) => (c >= 0 ? '+' : '−') + montant(Math.abs(c) / 100);
  const valeur = (g) => (tri === 'vitesse' ? (g.delai != null ? jours(g.delai) : '—')
    : tri === 'volume' ? nombre(g.revendus)
      : g.beneficeMoyen != null ? (g.partiel ? tr('rs.auPlus', { p: signe(g.beneficeMoyen) }) : signe(g.beneficeMoyen)) : '—');
  const detail = (g) => (tri === 'marge' && g.beneficeMoyen != null && g.nBenef < g.revendus ? tr('rt.surN', { k: nombre(g.nBenef), n: nombre(g.revendus) })
    : tri === 'marge' && g.beneficeMoyen == null ? (g.revendus ? tr('rt.sansPrix') : tr('rs.rienRevendu')) : '');
  const sous = (g) => [tri !== 'volume' ? tr('rs.revendus', { k: nombre(g.revendus), n: nombre(g.articles) }) : tr('rs.achetes', { n: nombre(g.articles) }),
    g.taux != null ? tr('rs.taux', { t: nombre(g.taux) }) : '',
    tri !== 'vitesse' && g.delai != null ? tr('rt.delai', { d: jours(g.delai) }) + (g.nDelai < g.revendus ? ' · ' + tr('rs.surDatees', { n: nombre(g.nDelai) }) : '') : ''].filter(Boolean).join(' · ');
  return (
    <Colonne pleine>
      <Carte titre={tr('rt.titre')} sousTitre={tr('rs.tousAchats')} className="n-ps-mieux"
        attrs={{ 'data-ps-bloc': 'mieux', 'data-ps-mieux-axe': AXE_SOURCE, 'data-ps-mieux-tri': tri, 'aria-busy': S === undefined ? 'true' : undefined,
          'data-ps-mieux-ordre': ordre.map((g) => g.k).join('|'), 'data-ps-mieux-n': S ? String(S.n) : '', 'data-ps-mieux-ncout': S ? String(S.nCout) : '' }}>
        {choix}
        <p className="n-ps-mieux-tete">{tr('rt.classement')}</p>
        {S === undefined ? <Rangee titre={tr('v2.jour.lecture')}/> : !S ? <Rangee titre={tr('rs.pasSu')} attrs={{ 'data-ps-source-passu': '' }}/>
          : ordre.length ? ordre.map((g) => (
            <Rangee key={g.k} titre={g.pasSaisie ? tr('rs.pasSaisie') : g.nom} sousTitre={sous(g)} sousLignes={2} valeur={valeur(g)} valeurForte detailValeur={detail(g)}
              attrs={{ 'data-ps-source': g.k, 'data-articles': String(g.articles), 'data-revendus': String(g.revendus), 'data-nbenef': String(g.nBenef),
                'data-moyen': g.beneficeMoyen == null ? '' : String(g.beneficeMoyen), 'data-taux': g.taux == null ? '' : String(g.taux),
                'data-delai': g.delai == null ? '' : String(g.delai), 'data-partiel': g.partiel ? '1' : '' }}/>
          )) : <Rangee titre={tr('v2.ps.top.aucun')}/>}
        {S ? <p className="n-ps-mieux-note" data-ps-mieux-couv="" data-ps-source-sansachat={String(S.sansAchat)}>{[
          tr('rs.couv', { k: nombre(S.nCout), n: nombre(S.n) }),
          S.sansAchat ? tr('rs.couv.sansAchat', { n: nombre(S.sansAchat) }) : '',
          S.achatPasLu ? tr('rs.couv.pasLu', { n: nombre(S.achatPasLu) }) : '',
          S.vintedLus ? '' : tr('rs.couv.vintedPasLus'),
        ].filter(Boolean).join(' · ')}</p> : null}
      </Carte>
    </Colonne>
  );
}
