// ════════════════════════════════════════════════════════════════════════════
//  STATISTIQUES — PILOTAGE · FINANCES, 7 j · 30 j · 90 j (21 nov., lot journee-stats). Julien : « je veux que tu
//  proposes beaucoup plus de statistiques […] de la vraie data », « toujours dans le style Vintex » (inspiré de l'Accueil
//  de Bleam), puis « toute l'application doit être simplifiée et ergonomique » : ici le détail, rangé — deux segments,
//  une période, des cartes à filet côte à côte (jamais une carte dans une carte), la même boîte dans les trois états.
//  AUCUNE règle ici : le modèle arrive calculé (src/aujourdhui/pilotage.js `statsFenetre`, chaque chiffre demandé à son
//  propriétaire). Un chiffre pas su = « — » et sa raison ; un total partiel dit sa couverture (« sur N ») ; jamais 0 inventé.
//  Chaque chiffre porte `data-ps-*` (centimes ou nombre ; '' = « — ») : le banc lit les nombres, jamais un libellé.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr, nombre } from '../../i18n/index.js';
import { Segmente, Colonnes, Colonne, Carte, Faits, Fait, Rangee, Courbe } from '../index.js';
import { FENETRES, SEGMENTS_STATS } from '../../aujourdhui/pilotage.js';
import { ilYaCourt } from './Aujourdhui.jsx';
import './stats.css';

const cents = (x) => (x == null || !Number.isFinite(Number(x)) ? '' : String(Math.round(Number(x) * 100)));
const LIGNES_TOP = 5;

// `M` : le modèle de `statsFenetre` (ou null tant que rien n'est calculé) ; `etats` : { ventes, journal, releve } ∈
// 'encours' | 'passu' | 'lu' ; `montant(x)` : « 1 284 € » ; `seg`/`setSeg`, `f`/`setF` : le segment et la fenêtre.
export default function StatsPilotage({ M = null, etats = {}, montant = (x) => String(x), seg = 'pilotage', setSeg, f = '30', setF, Icon, onNav = null, onJournal = null, onDorment = null }) {
  const [jour, setJour] = React.useState(null);
  const lecture = (k) => (etats[k] || 'encours') === 'encours';
  const raison = (k, x = '') => (lecture(k) ? tr('v2.jour.lecture') : (etats[k] === 'passu' ? tr('v2.jour.pasSu') : x));
  const sur = tr('v2.ps.fenetre.' + f);
  const C = M ? M.chiffres : null;
  const ouvrirVentes = onNav ? () => onNav('cat_ventes') : null;

  // ── PILOTAGE ──
  const G = M && M.gestes, T = M && M.temps, Se = M && M.serie, Fv = M && M.favoris, D = M && M.dernier;
  const J = M && Array.isArray(M.jours) ? M.jours : [];
  const k = jour == null || jour >= J.length ? J.length - 1 : jour, jj = J[k] || null;
  const quand = jj ? new Date(jj.de).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) : '';
  const serie = (cle, lib, fmt) => (
    <div className="n-ps-serie" data-ps-serie={cle} data-ps-serie-valeurs={J.map((x) => (x[cle] == null ? '' : cle === 'ca' ? cents(x[cle]) : String(x[cle]))).join(',')}>
      <p className="n-ps-serie-tete"><span>{lib}</span><span className="n-ps-serie-v">{[quand, jj && jj[cle] != null ? fmt(jj[cle]) : '—'].filter(Boolean).join(' · ')}</span></p>
      <Courbe className="n-ps-courbe" libelle={lib} choisie={k} onChoisir={setJour}
        barres={J.map((x) => ({ cle: x.cle, valeur: x[cle], libelle: new Date(x.de).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) + ' · ' + (x[cle] == null ? '—' : fmt(x[cle])) }))}
        attrs={{ 'data-ps-barres': String(J.length), 'data-n-dense': J.length > 31 ? '1' : undefined }}/>
      <p className="n-ps-serie-pied" data-ps-echelle={M && M.echelles && M.echelles[cle] != null ? String(M.echelles[cle]) : ''}>
        <span>{tr('v2.ps.debut', { n: J.length ? J.length - 1 : 0 })}</span>
        <span>{M && M.echelles && M.echelles[cle] != null ? tr('v2.ps.echelle', { v: fmt(M.echelles[cle]) }) : ' '}</span>
        <span>{tr('v2.ps.auj')}</span>
      </p>
    </div>
  );
  const nomGeste = (t) => tr('v2.ps.geste.' + (['favori', 'favori_offre', 'republication', 'bordereau', 'baisse_prix', 'offre_acceptee', 'offre_faite', 'message_envoye'].includes(t) ? t : 'autre'));
  const pilotage = (
    <>
      <Colonne pleine>
        <Carte titre={tr('v2.ps.dernier.titre')} attrs={{ 'data-ps-bloc': 'dernier', 'data-ps-dernier': D ? String(D.t) : '' }}>
          <Rangee icone={<Icon name="check" size={22}/>} titre={D ? nomGeste(D.type) : '—'}
            sousTitre={D ? [ilYaCourt(D.t), D.auto ? tr('v2.ps.auto') : tr('v2.ps.surTonClic')].filter(Boolean).join(' · ') : raison('journal', tr('v2.ps.dernier.aucun'))}
            fin="chevron" onClick={onJournal}/>
        </Carte>
      </Colonne>
      <Colonne>
        <Carte titre={tr('v2.ps.fait.titre')} sousTitre={sur} attrs={{ 'data-ps-bloc': 'fait', 'aria-busy': lecture('journal') ? 'true' : undefined }}>
          <Rangee icone={<Icon name="clock" size={22}/>} titre={tr('v2.ps.temps')} valeur={T ? tr('v2.ps.minutes', { n: T.minutes, m: nombre(T.minutes) }) : '—'} valeurForte
            sousTitre={T ? tr('v2.ps.temps.detail', { k: nombre(T.nCompte), n: nombre(T.n) }) : raison('journal')} attrs={{ 'data-ps-temps': T ? String(T.minutes) : '' }}/>
          <Rangee icone={<Icon name="chart" size={22}/>} titre={tr('v2.ps.serie')} valeur={Se ? tr('v2.ps.jours', { n: Se.jours, j: nombre(Se.jours) }) : '—'} valeurForte
            sousTitre={Se ? (Se.jours === 0 ? tr('v2.ps.serie.zero') : Se.aujourdhui ? tr('v2.ps.serie.auj') : tr('v2.ps.serie.hier')) : raison('journal')} attrs={{ 'data-ps-serie-jours': Se ? String(Se.jours) : '' }}/>
          <Rangee icone={<Icon name="check" size={22}/>} titre={tr('v2.ps.gestes')} valeur={G ? nombre(G.n) : '—'} valeurForte
            sousTitre={G ? tr('v2.ps.gestes.auto', { n: nombre(G.auto) }) : raison('journal')} fin="chevron" onClick={onJournal} attrs={{ 'data-ps-gestes': G ? String(G.n) : '', 'data-ps-gestes-auto': G ? String(G.auto) : '' }}/>
        </Carte>
      </Colonne>
      <Colonne>
        <Carte titre={tr('v2.ps.favoris.titre')} sousTitre={sur} attrs={{ 'data-ps-bloc': 'favoris' }}>
          <Rangee icone={<Icon name="heart" size={22}/>} titre={tr('v2.ps.favoris.envoyes')} valeur={Fv ? nombre(Fv.envoyes) : '—'} valeurForte
            sousTitre={Fv ? tr('v2.ps.favoris.offre', { n: nombre(Fv.avecOffre) }) : raison('journal')} attrs={{ 'data-ps-fav-envoyes': Fv ? String(Fv.envoyes) : '' }}/>
          <Rangee icone={<Icon name="bag" size={22}/>} titre={tr('v2.ps.favoris.vendues')} valeur={Fv && Fv.ventes != null ? nombre(Fv.ventes) : '—'} valeurForte
            sousTitre={!Fv ? raison('journal') : Fv.ventes == null ? raison('ventes', tr('v2.ps.favoris.pasRelie')) : tr('v2.ps.favoris.sur', { n: nombre(Fv.annonces) })} attrs={{ 'data-ps-fav-ventes': Fv && Fv.ventes != null ? String(Fv.ventes) : '' }}/>
          <Rangee icone={<Icon name="target" size={22}/>} titre={tr('v2.ps.favoris.taux')} valeur={Fv && Fv.taux != null ? Fv.taux + ' %' : '—'} valeurForte
            sousTitre={Fv && Fv.taux != null ? tr('v2.ps.favoris.delai') : Fv && Fv.annonces === 0 ? tr('v2.ps.favoris.aucun') : raison('journal')} attrs={{ 'data-ps-fav-taux': Fv && Fv.taux != null ? String(Fv.taux) : '' }}/>
        </Carte>
      </Colonne>
      <Colonne pleine>
        <Carte titre={tr('v2.ps.activite.titre')} sousTitre={tr('v2.ps.activite.sous')} attrs={{ 'data-ps-bloc': 'activite' }}>
          {serie('ventes', tr('v2.stats.ventes'), (x) => nombre(x))}
          {serie('ca', tr('v2.stats.ca'), (x) => montant(x))}
          {serie('gestes', tr('v2.ps.gestes'), (x) => nombre(x))}
        </Carte>
      </Colonne>
      <Colonne pleine>
        <Carte titre={tr('v2.comptes.titre')} sousTitre={sur} attrs={{ 'data-ps-bloc': 'comptes', 'data-ps-comptes': M && M.comptes ? M.comptes.map((x) => x.cle + ':' + cents(x.v) + ':' + (x.n == null ? '' : x.n)).join(',') : '' }}>
          {M && M.comptes && M.comptes.length ? M.comptes.slice(0, 6).map((x) => (
            <Rangee key={x.cle} titre={x.nom} sousTitre={[x.site !== x.nom ? x.site : '', x.n != null ? tr('v2.comptes.ventes', { n: x.n }) : ''].filter(Boolean).join(' · ')}
              valeur={x.v == null ? '—' : (x.vp ? tr('journee.moins') + ' ' : '') + montant(x.v)} valeurForte onClick={ouvrirVentes}/>
          )) : <Rangee titre={M && M.comptes ? tr('v2.comptes.vide') : raison('ventes')}/>}
        </Carte>
      </Colonne>
    </>
  );

  // ── FINANCES ──
  const R = M ? M.releve : undefined;
  const montrer = (lu, k) => lu || lecture(k) || !M;   // (audit R5) en lecture : la place ; lu sans valeur : rien
  const Br = C && C.brut, Vt = R && R.vitesse, Mg = R && R.marge, E = M && M.ecoulement, Do = M && M.dorment;
  // (audit R5) Une liste sans rangée, une fois lue, n'existe pas (jamais « aucune vente » à côté de 39 ventes).
  const top = (cle, titre, Q) => (R !== undefined && !(Q && Q.top.length) ? null : (
    <Colonne>
      <Carte titre={titre} sousTitre={sur} attrs={{ 'data-ps-bloc': cle, ['data-ps-' + cle]: Q ? Q.top.map((x) => x.k + ':' + x.n).join(',') : '' }}>
        {Q && Q.top.length ? Q.top.slice(0, LIGNES_TOP).map((x) => <Rangee key={x.k} titre={x.k} sousTitre={tr('v2.comptes.ventes', { n: x.n })} valeur={montant(x.ca)} valeurForte/>)
          : <Rangee titre={R === undefined ? tr('v2.jour.lecture') : !R ? tr('v2.st.raison.releve') : tr('v2.ps.top.aucun')}/>}
        {Q && Q.sans ? <Rangee titre={tr('v2.ps.top.sans', { n: Q.sans })}/> : null}
      </Carte>
    </Colonne>
  ));
  const finances = (
    <>
      <Colonne pleine>
        <Carte titre={tr('v2.ps.ventes.titre')} sousTitre={sur} attrs={{ 'data-ps-bloc': 'ventes', 'aria-busy': lecture('ventes') ? 'true' : undefined }}>
          <Faits colonnes={3}>
            {/* (21 nov., audit R5) Une case sans valeur, une fois LUE, ne se montre pas ; en lecture, elle garde sa place. */}
            <Fait libelle={tr('v2.stats.ca')} valeur={C && C.vendu.valeur != null ? (C.vendu.partiel ? tr('journee.moins') + ' ' : '') + montant(C.vendu.valeur) : null}
              detail={C && C.vendu.valeur == null ? (C.vendu.note || raison('ventes')) : ''} onModifier={ouvrirVentes} attrs={{ 'data-ps-vendu': C ? cents(C.vendu.valeur) : '' }}/>
            <Fait libelle={tr('v2.stats.ventes')} valeur={C && C.ventes.valeur != null ? nombre(C.ventes.valeur) : null}
              detail={C && C.ventes.valeur == null ? (C.ventes.note || raison('ventes')) : (C && C.ventes.partiel ? tr('journee.moins') : '')} onModifier={ouvrirVentes} attrs={{ 'data-ps-ventes': C && C.ventes.valeur != null ? String(C.ventes.valeur) : '' }}/>
            {montrer(C && C.panier.valeur != null, 'ventes') ? <Fait libelle={tr('v2.stats.panier')} valeur={C && C.panier.valeur != null ? montant(C.panier.valeur) : null}
              detail={!C ? raison('ventes') : C.panier.valeur != null ? '' : C.panier.note === 'aucune' ? tr('v2.stats.aucune') : C.panier.note === 'partiel' ? tr('v2.stats.pasTout') : (C.panier.note || '')} attrs={{ 'data-ps-panier': C ? cents(C.panier.valeur) : '' }}/> : null}
            {montrer(Br && Br.valeur != null, 'ventes') ? <Fait libelle={tr('v2.stats.beneficeBrut')} valeur={Br && Br.valeur != null ? montant(Br.valeur) : null}
              detail={!Br ? raison('ventes') : Br.valeur == null ? (Br.note || '') : Br.couverture ? tr('v2.stats.surVentes', { c: Br.couverture }) : ''} onModifier={onNav ? () => onNav('compta') : null}
              attrs={{ 'data-ps-brut': Br ? cents(Br.valeur) : '', 'data-ps-brut-couv': Br ? Br.couverture || '' : '', 'data-benef-notion': 'brut' }}/> : null}
            {montrer(Mg && Mg.pct != null, 'releve') ? <Fait libelle={tr('v2.st.marge.pct')} valeur={Mg && Mg.pct != null ? nombre(Mg.pct) + ' %' : null}
              detail={R === undefined ? tr('v2.jour.lecture') : !R ? tr('v2.st.raison.releve') : Mg && Mg.pct != null ? tr('v2.st.marge.sur', { k: nombre(Mg.nCout), n: nombre(Mg.n) }) : tr('v2.st.raison.achats')} attrs={{ 'data-ps-marge': Mg && Mg.pct != null ? String(Mg.pct) : '' }}/> : null}
            {montrer(Vt && Vt.mediane != null, 'releve') ? <Fait libelle={tr('v2.st.vitesse.delai')} valeur={Vt && Vt.mediane != null ? tr('v2.st.jours', { n: Math.round(Vt.mediane), j: nombre(Math.round(Vt.mediane)) }) : null}
              detail={R === undefined ? tr('v2.jour.lecture') : !R ? tr('v2.st.raison.releve') : Vt && Vt.mediane != null ? tr('v2.st.mediane', { k: nombre(Vt.nDelai), n: nombre(Vt.n) }) : tr('v2.st.raison.dates')} attrs={{ 'data-ps-delai': Vt && Vt.mediane != null ? String(Vt.mediane) : '' }}/> : null}
          </Faits>
        </Carte>
      </Colonne>
      <Colonne pleine>
        <Carte titre={tr('v2.ps.stock.titre')} attrs={{ 'data-ps-bloc': 'stock' }}>
          <Rangee icone={<Icon name="box" size={22}/>} titre={tr('v2.st.stock.enLigne')} valeur={E ? nombre(E.enLigne) : '—'} valeurForte sousTitre={E ? '' : tr('v2.st.raison.ecoulement')} attrs={{ 'data-ps-enligne': E ? String(E.enLigne) : '' }}/>
          <Rangee icone={<Icon name="target" size={22}/>} titre={tr('v2.ps.taux')} valeur={E ? E.pct + ' %' : '—'} valeurForte sousTitre={E ? tr('v2.st.ecoulementSur', { v: nombre(E.ventes), n: nombre(E.enLigne) }) : tr('v2.st.raison.ecoulement')} attrs={{ 'data-ps-taux': E ? String(E.pct) : '' }}/>
          <Rangee icone={<Icon name="sleep" size={22}/>} titre={tr('v2.st.dorment.titre')} valeur={Do && Do.valeur != null ? (Do.partiel ? tr('journee.moins') + ' ' : '') + nombre(Do.valeur) : '—'} valeurForte
            sousTitre={Do && Do.valeur != null ? tr('v2.st.dorment.sous') : (Do && Do.raison) || tr('v2.jour.pasSu')} fin={onDorment ? 'chevron' : null} onClick={onDorment} attrs={{ 'data-ps-dorment': Do && Do.valeur != null ? String(Do.valeur) : '' }}/>
        </Carte>
      </Colonne>
      <Colonne>
        <Carte titre={tr('v2.ps.sites.titre')} sousTitre={sur} attrs={{ 'data-ps-bloc': 'sites', 'data-ps-sites': M && M.plateformes ? M.plateformes.map((x) => x.cle + ':' + cents(x.v) + ':' + (x.n == null ? '' : x.n)).join(',') : '' }}>
          {M && M.plateformes && M.plateformes.length ? M.plateformes.map((x) => (
            <Rangee key={x.cle} titre={x.nom} sousTitre={x.n != null ? tr('v2.comptes.ventes', { n: x.n }) : ''} valeur={x.v == null ? '—' : (x.vp ? tr('journee.moins') + ' ' : '') + montant(x.v)} valeurForte onClick={ouvrirVentes}/>
          )) : <Rangee titre={M && M.plateformes ? tr('v2.comptes.vide') : raison('ventes')}/>}
        </Carte>
      </Colonne>
      {top('marques', tr('v2.st.marques.titre'), R && R.marques ? { top: R.marques.top, sans: R.marques.sansMarque } : null)}
      {top('modeles', tr('v2.ps.modeles.titre'), R && R.modeles)}
      {top('tailles', tr('v2.ps.tailles.titre'), R && R.tailles)}
    </>
  );
  return (
    <section className="n-ps" data-ps="" data-ps-seg={seg} data-ps-fenetre={f} aria-label={tr('v2.ps.titre')}>
      <Colonnes>
        <Colonne pleine>
          <div className="n-ps-barre">
            <Segmente libelle={tr('v2.ps.segments')} valeur={seg} onChange={setSeg} options={SEGMENTS_STATS.map((x) => ({ cle: x, libelle: tr('v2.ps.seg.' + x) }))}/>
            <Segmente libelle={tr('v2.stats.periode')} valeur={f} onChange={(x) => { setJour(null); setF(x); }} options={FENETRES.map((x) => ({ cle: x, libelle: tr('v2.ps.court.' + x) }))}/>
          </div>
        </Colonne>
        {seg === 'finances' ? finances : pilotage}
      </Colonnes>
    </section>
  );
}
