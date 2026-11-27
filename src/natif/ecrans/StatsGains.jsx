// ── src/natif/ecrans/StatsGains.jsx — Statistiques › Gains : « Ce que tu gagnes vraiment » (24 nov., lot gains-reels) ──
// Par paire · par modèle · par source · par compte : le net réel (prix − frais − prix d'achat), le délai moyen de vente,
// le meilleur et le moins bon (jamais sous 3 ventes au net connu), « À racheter » (expliqué sous « Pourquoi ? »).
// Une VUE : tout arrive calculé (`G`, src/gainsReels.js) — aucun calcul de chiffre ici, aucun tri. Un chiffre pas su =
// « — » ; un total partiel dit « sur K des N » et NOMME ce qui manque (« 12 ventes sans prix d'achat » + « Saisir », la
// porte de saisie). Jamais « au moins » sur un bénéfice : une paire au prix d'achat inconnu peut être vendue à perte
// (src/beneficeNoms.js). Chaque nombre porte `data-gr-*` (centimes ou nombre, '' = « — ») : le banc lit les nombres.
import React from 'react';
import { tr, nombre, date } from '../../i18n/index.js';
import { Segmente, Colonne, Carte, Rangee, Tuiles, Tuile, Actions, Pourquoi } from '../index.js';
import { VUES_GAINS, MIN_CLASSEMENT } from '../../gainsReels.js';
import { VUES_VRAI_BENEFICE } from '../../vraiBenefice.js';   // (27 nov., lot vrai-benefice) « Par mois »
import { ouvrirCompleter } from '../../completer/porte.js';
import './gains.css';

const c = (x) => (x == null || !Number.isFinite(Number(x)) ? '' : String(Math.round(Number(x))));
const VUES = [...VUES_GAINS, ...VUES_VRAI_BENEFICE];
const lireVue = () => { try { const v = localStorage.getItem('vrm_stats_gains_vue'); return VUES.includes(v) ? v : 'modele'; } catch (_) { return 'modele'; } };
const garderVue = (v) => { try { localStorage.setItem('vrm_stats_gains_vue', v); } catch (_) { /* rien */ } };
const MAX_LISTE = 8, MAX_SANS = 5;
// (27 nov., lot vrai-benefice) Cinq vues : au téléphone, « Par » se tait à l'écran (il reste lu par le lecteur d'écran),
// « Article · Modèle · Source · Compte · Mois » tiennent sur la ligne (gains.css).
const libelleVue = (t) => { const k = String(t).indexOf(' '); return k > 0 ? <><span className="n-gr-seg-pre">{t.slice(0, k + 1)}</span><span className="n-gr-seg-mot">{t.slice(k + 1)}</span></> : t; };

export default function StatsGains({ G, VB = undefined, sur = '', montant = (x) => String(x), Icon = null }) {
  const [vue, setVue] = React.useState(lireVue);
  const signe = (cents) => (cents == null ? '—' : (cents >= 0 ? '+' : '−') + montant(Math.abs(cents) / 100));
  const jours = (j) => (j == null ? '—' : tr('gr.jours', { j: nombre(Math.round(j)) }));
  const saisirTout = () => ouvrirCompleter({ sujet: 'achat' });
  const ic = (n) => (Icon ? <Icon name={n} size={18}/> : null);
  const Tt = G && G.total;
  const attente = G === undefined;

  const segments = (
    <Segmente libelle={tr('gr.vue')} valeur={vue} onChange={(x) => { setVue(x); garderVue(x); }}
      options={VUES.map((x) => ({ cle: x, libelle: libelleVue(tr('gr.vue.' + x)) }))}/>
  );

  // ── LE HAUT : gagné · par paire · délai, la couverture, ce qui manque (nommé, avec sa porte) ──
  const haut = (
    <>
      <Tuiles attrs={{ 'data-gr-tuiles': '' }}>
        <Tuile libelle={tr('gr.gagne')} valeur={Tt && Tt.net != null ? signe(Tt.net) : null}
          detail={!Tt ? (attente ? tr('v2.jour.lecture') : tr('gr.pasSu')) : Tt.net == null ? (Tt.n ? tr('gr.aucunAchat') : tr('gr.aucuneVente')) : (Tt.auPlus ? tr('vb.auPlusMot') + ' · ' : '') + (Tt.partiel ? tr('gr.sur', { k: Tt.nNet, n: Tt.n }) : tr('gr.toutes', { n: Tt.n }))}
          attrs={{ 'data-gr-net': Tt ? c(Tt.net) : '', 'data-gr-n': Tt ? String(Tt.n) : '', 'data-gr-nnet': Tt ? String(Tt.nNet) : '', 'data-gr-partiel': Tt && Tt.partiel ? '1' : '', 'data-gr-auplus': Tt ? String(Tt.auPlus || 0) : '' }}/>
        <Tuile libelle={tr('gr.parPaire')} valeur={Tt && Tt.netMoyen != null ? signe(Tt.netMoyen) : null}
          detail={Tt && Tt.netMoyen != null && Tt.caNet ? tr('gr.marge', { p: nombre(Math.round((Tt.net / Tt.caNet) * 100)) }) : ''} attrs={{ 'data-gr-moyen': Tt ? c(Tt.netMoyen) : '' }}/>
        <Tuile libelle={tr('gr.delai')} valeur={Tt && Tt.delaiMoyen != null ? jours(Tt.delaiMoyen) : null}
          detail={Tt && Tt.delaiMoyen != null ? (Tt.nDelai < Tt.n ? tr('gr.datees', { k: Tt.nDelai, n: Tt.n }) : '') : Tt ? tr('gr.pasDatees') : ''} attrs={{ 'data-gr-delai': Tt && Tt.delaiMoyen != null ? String(Tt.delaiMoyen) : '' }}/>
      </Tuiles>
      {Tt && Tt.sansAchat > 0 ? (
        <div className="n-gr-manque" data-gr-sansachat={String(Tt.sansAchat)}>
          <p>{tr('gr.sansAchat', { n: Tt.sansAchat })}</p>
          <Actions elements={[{ cle: 'saisir', icone: ic('pencil'), libelle: tr('gr.saisir'), onClick: saisirTout, plein: true, attrs: { 'data-gr-saisir': '' } }]}/>
        </div>
      ) : null}
      {Tt && (Tt.ecartees > 0 || Tt.horsEuro > 0) ? (
        <p className="n-gr-note" data-gr-ecartees={String(Tt.ecartees)} data-gr-horseuro={Tt.horsEuro == null ? '' : String(Tt.horsEuro)}>
          {[Tt.ecartees > 0 ? tr('gr.ecartees', { n: Tt.ecartees }) : '', Tt.horsEuro > 0 ? tr('gr.horsEuro', { n: Tt.horsEuro }) : ''].filter(Boolean).join(' · ')}
        </p>
      ) : null}
    </>
  );

  return (
    <Colonne pleine>
      <Carte titre={tr('gr.titre')} sousTitre={sur} className="n-gr"
        attrs={{ 'data-ps-bloc': 'gains', 'data-gr-vue': vue, 'aria-busy': attente ? 'true' : undefined }}>
        {segments}
        {haut}
        {vue === 'mois' ? <VueMois VB={VB} signe={signe}/> : G == null ? null : vue === 'paire' ? <VuePaires P={G.paire} signe={signe} jours={jours}/> : (
          <>{vue === 'compte' ? <VueComptes VB={VB} signe={signe}/> : null}<VueGroupes A={G[vue]} vue={vue} signe={signe} jours={jours}/></>)}
        <Pourquoi attrs={{ 'data-gr-pourquoi': '' }}><p>{tr('vb.pourquoi')}</p><p>{tr('gr.pourquoi.net')}</p><p>{tr('gr.pourquoi.racheter', { n: MIN_CLASSEMENT })}</p><p>{tr('gr.pourquoi.modele')}</p></Pourquoi>
      </Carte>
    </Colonne>
  );
}

// ── PAR PAIRE : les 3 meilleures, les 3 moins bonnes, puis les ventes sans prix d'achat (chacune ouvre SA saisie) ──
function VuePaires({ P, signe, jours }) {
  if (!P) return null;
  const parK = new Map(P.paires.map((p) => [p.k, p]));
  const ligne = (p, porte) => (
    <Rangee key={p.k} titre={p.titre || tr('gr.sansTitre')} sousLignes={2}
      sousTitre={[p.num ? tr('gr.num', { n: p.num }) : '', p.plateforme === 'Vinted' && p.compte ? p.compte : p.plateforme, p.delai != null ? tr('gr.venduEn', { d: jours(p.delai) }) : ''].filter(Boolean).join(' · ')}
      valeur={porte ? tr('gr.saisir') : signe(p.net)} valeurForte={!porte} fin={porte ? 'chevron' : null}
      onClick={porte ? () => ouvrirCompleter({ sujet: 'achat', num: p.num }) : null}
      attrs={{ 'data-gr-paire': p.id, 'data-gr-net': c(p.net), 'data-gr-delai': p.delai == null ? '' : String(p.delai), 'data-gr-porte': porte ? '1' : undefined }}/>
  );
  return (
    <>
      <Podium titre={tr('gr.meilleures')} cles={P.meilleurs} attr="meilleurs" vide={tr('gr.peu', { n: MIN_CLASSEMENT })} rendu={(k) => ligne(parK.get(k), false)}/>
      {P.meilleurs.length ? <Podium titre={tr('gr.moinsBonnes')} cles={P.moinsBons} attr="moinsbons" vide="" rendu={(k) => ligne(parK.get(k), false)}/> : null}
      {P.sansAchat.length ? (
        <>
          <p className="n-gr-tete">{tr('gr.aSaisir')}</p>
          <div data-gr-sans={P.sansAchat.length}>{P.sansAchat.slice(0, MAX_SANS).map((k) => ligne(parK.get(k), true))}</div>
        </>
      ) : null}
    </>
  );
}

// ── PAR MODÈLE / SOURCE / COMPTE : à racheter, le meilleur et le moins bon, puis tout, en barres ──
function VueGroupes({ A, vue, signe, jours }) {
  if (A === undefined) return <Rangee titre={tr('v2.jour.lecture')}/>;
  if (!A) return <Rangee titre={tr(vue === 'source' ? 'rs.pasSu' : 'gr.pasSu')} attrs={{ 'data-gr-passu': '' }}/>;
  const parK = new Map(A.groupes.map((g) => [g.k, g]));
  const nom = (g) => (g.pasSaisie ? tr('rs.pasSaisie') : g.autres ? tr('gr.autres') : g.nom);
  const sous = (g) => [tr('gr.ventes', { n: g.n }), g.netMoyen != null && g.nNet < g.n ? tr('gr.surK', { k: g.nNet }) : '',
    g.delaiMoyen != null ? tr(vue === 'source' ? 'gr.delaiAchat' : 'gr.venduEn', { d: jours(g.delaiMoyen) }) : ''].filter(Boolean).join(' · ');
  const moyen = (g) => (g.netMoyen == null ? '—' : g.partiel ? tr('rs.auPlus', { p: signe(g.netMoyen) }) : signe(g.netMoyen));
  const rang = (g) => <Rangee key={g.k} titre={nom(g)} sousTitre={sous(g)} sousLignes={2} valeur={moyen(g)} valeurForte detailValeur={tr('gr.parPaireCourt')}
    attrs={{ 'data-gr-groupe': g.k, 'data-gr-n': String(g.n), 'data-gr-nnet': String(g.nNet), 'data-gr-moyen': c(g.netMoyen), 'data-gr-delai': g.delaiMoyen == null ? '' : String(g.delaiMoyen) }}/>;
  const liste = A.liste.slice(0, MAX_LISTE);
  const max = Math.max(1, ...liste.map((g) => Math.abs(g.netMoyen || 0)));
  return (
    <>
      {vue === 'source' ? <p className="n-gr-note" data-gr-source-tout="">{tr('gr.source.periode')}</p> : null}
      {vue !== 'compte' ? (
        <>
          <p className="n-gr-tete">{tr('gr.racheter')}</p>
          <div data-gr-racheter={A.aRacheter.join('|')}>
            {A.aRacheter.length ? A.aRacheter.map((k) => { const g = parK.get(k); return (
              <Rangee key={k} titre={nom(g)} sousLignes={2} sousTitre={[signe(g.netMoyen) + ' ' + tr('gr.parPaireCourt'), tr(vue === 'source' ? 'gr.delaiAchat' : 'gr.venduEn', { d: jours(g.delaiMoyen) }), tr('gr.ventes', { n: g.nNet })].join(' · ')}
                valeur={tr('rt.parJour', { p: signe(Math.round(g.score * 100)) })} valeurForte attrs={{ 'data-gr-racheter-k': k, 'data-gr-score': c(g.score * 100) }}/>
            ); }) : <Rangee titre={tr('gr.racheter.rien', { n: MIN_CLASSEMENT })}/>}
          </div>
        </>
      ) : null}
      <Podium titre={tr('gr.meilleurs')} cles={A.meilleurs} attr="meilleurs" vide={tr('gr.peuGroupes', { n: MIN_CLASSEMENT })} rendu={(k) => rang(parK.get(k))}/>
      {A.meilleurs.length && A.moinsBons.length ? <Podium titre={tr('gr.moinsBons')} cles={A.moinsBons} attr="moinsbons" vide="" rendu={(k) => rang(parK.get(k))}/> : null}
      <p className="n-gr-tete">{tr('gr.tout')}</p>
      {liste.length ? (
        <ul className="n-gr-barres" data-gr-liste={liste.map((g) => g.k).join('|')} aria-label={tr('gr.barres.aria')}>
          {liste.map((g) => {
            const v = g.netMoyen, l = v == null ? 0 : Math.max(2, Math.round((Math.abs(v) / max) * 100));
            return (
              <li key={g.k} className="n-gr-barre" title={nom(g) + ' · ' + moyen(g) + ' ' + tr('gr.parPaireCourt') + ' · ' + sous(g)} data-gr-barre={g.k} data-gr-moyen={c(v)}>
                <span className="n-gr-barre-nom">{nom(g)}<small>{sous(g)}</small></span>
                <span className="n-gr-barre-piste" aria-hidden="true">{v != null ? <span className="n-gr-barre-plein" data-negatif={v < 0 ? '1' : undefined} style={{ width: l + '%' }}/> : null}</span>
                <span className="n-gr-barre-v">{moyen(g)}</span>
              </li>
            );
          })}
        </ul>
      ) : <Rangee titre={tr('v2.ps.top.aucun')}/>}
      {vue === 'source' && A.sansAchat ? <p className="n-gr-note" data-gr-source-sansachat={String(A.sansAchat)}>{tr('rs.couv.sansAchat', { n: A.sansAchat })}</p> : null}
    </>
  );
}

function Podium({ titre, cles, attr, vide, rendu }) {
  return (
    <>
      <p className="n-gr-tete">{titre}</p>
      <div {...{ ['data-gr-' + attr]: cles.join('|') }}>{cles.length ? cles.map(rendu) : vide ? <Rangee titre={vide} attrs={{ 'data-gr-peu': '' }}/> : null}</div>
    </>
  );
}

// ── (27 nov., lot vrai-benefice) LE VRAI BÉNÉFICE : par mois et par compte (src/vraiBenefice.js — la règle de l'export
// comptable, la seule). Chaque nombre porte `data-vb-*` (centimes ; '' = « — ») : le banc compare à l'export. ──
const attrsVb = (g) => ({ 'data-vb-net': c(g.net), 'data-vb-n': String(g.n), 'data-vb-nnet': String(g.nNet), 'data-vb-sansachat': String(g.sansAchat), 'data-vb-auplus': String(g.auPlus) });
const valeurVb = (g, signe) => (g.net == null ? '—' : g.plafond ? tr('rs.auPlus', { p: signe(g.net) }) : signe(g.net));
const sousVb = (g) => (!g.n ? tr('vb.aucune') : [g.partiel ? tr('gr.sur', { k: g.nNet, n: g.n }) : tr('gr.ventes', { n: g.n }),
  g.sansAchat ? tr('vb.sansAchat', { n: g.sansAchat }) : '', g.auPlus ? tr('vb.fraisPasConfirmes', { n: g.auPlus }) : ''].filter(Boolean).join(' · '));
const nomMoisVb = (ym) => { const [a, m] = String(ym).split('-').map(Number); return a && m ? date(new Date(a, m - 1, 15), { month: 'long', year: 'numeric' }) : ym; };

function VueMois({ VB, signe }) {
  if (VB === undefined) return <Rangee titre={tr('v2.jour.lecture')}/>;
  if (!VB) return <Rangee titre={tr('gr.pasSu')} attrs={{ 'data-vb-passu': '' }}/>;
  // Les deux mois les plus récents toujours ; avant, seulement les mois qui ont des ventes.
  const M = VB.mois.filter((g, i) => g.n > 0 || i < 2);
  return (
    <>
      <p className="n-gr-tete">{tr('vb.mois.tete')}</p>
      <div data-vb-mois-liste={M.map((g) => g.ym).join(',')}>
        {M.map((g) => <Rangee key={g.ym} titre={nomMoisVb(g.ym)} sousTitre={sousVb(g)} sousLignes={2} valeur={valeurVb(g, signe)} valeurForte={g.net != null}
          attrs={{ 'data-vb-mois': g.ym, ...attrsVb(g) }}/>)}
      </div>
      {VB.aDater > 0 || VB.ecartees > 0 ? <p className="n-gr-note" data-vb-adater={String(VB.aDater)} data-vb-ecartees={String(VB.ecartees)}>
        {[VB.aDater > 0 ? tr('vb.aDater', { n: VB.aDater }) : '', VB.ecartees > 0 ? tr('gr.ecartees', { n: VB.ecartees }) : ''].filter(Boolean).join(' · ')}</p> : null}
    </>
  );
}

function VueComptes({ VB, signe }) {
  if (VB === undefined || !VB) return null;
  return (
    <>
      <p className="n-gr-tete">{tr('vb.comptes.tete')}</p>
      <div data-vb-comptes={VB.comptes.map((g) => g.k).join(',')}>
        {VB.comptes.length ? VB.comptes.map((g) => <Rangee key={g.k} titre={g.nom} sousTitre={sousVb(g)} sousLignes={2} valeur={valeurVb(g, signe)} valeurForte={g.net != null}
          detailValeur={g.net != null ? tr('vb.total') : ''} attrs={{ 'data-vb-compte': g.k, ...attrsVb(g) }}/>) : <Rangee titre={tr('vb.aucune')}/>}
      </div>
    </>
  );
}
