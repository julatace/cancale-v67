// ── src/natif/ecrans/AchatsTableau.jsx — Achats à l'ordinateur, en TABLEAU DE TRAVAIL (19 nov. soir) ──────────────────
// Les MÊMES achats que la liste d'Achats (Comptabilite, `buysBase`, du plus récent au plus ancien, `ordreRecent`) et la même
// étape (`etapeAchat` : Payé · En route · À retirer · Arrivé · À renvoyer · Annulé), rangée dans le filtre Statut. Le code de
// retrait n'est écrit que quand la règle des colis à retirer le donne (étape « À retirer », code lu). Une VUE.
//
// Props : lignes [{ cle, o, titre, photo, prix (texte), t, num, compte, transporteur: { nom, logo }, code, etape: { label, step, retour } }]
// · undefined · null ; filtres ; compte ; majLe ; onRafraichir ; onOuvrir(l) ; onCode(l) ; haut ; pied ; Icon.
import React from 'react';
import { tr } from '../../i18n/index.js';
import { TableauTravail } from '../TableauTravail.jsx';
import { Plaque } from '../Plaque.jsx';

export const CATEGORIES_ACHAT = ['retirer', 'renvoyer', 'route', 'paye', 'arrive', 'annule'];
const TON = { retirer: 'ambre', renvoyer: 'ambre', route: 'teal', paye: 'neutre', arrive: 'vert', annule: 'neutre' };
// L'étape déjà calculée (`etapeAchat`) rangée dans sa case : une mise en forme, jamais une règle neuve.
export const categorieAchat = (e) => {
  if (!e) return 'paye';
  if (e.retour) return 'renvoyer';
  if (e.step === 0) return 'annule';
  if (e.step === 4) return 'arrive';
  if (e.step === 3) return 'retirer';
  if (e.step === 2) return 'route';
  return 'paye';
};
function NumeroSuivi({ suivi }) {
  const [copie, setCopie] = React.useState(false);
  const copier = async (e) => { e.stopPropagation(); try { await navigator.clipboard.writeText(suivi.n); setCopie(true); setTimeout(() => setCopie(false), 1500); } catch (_) {} };
  return (
    <span className="n-tt-suivi" data-achat-suivi={suivi.n}>
      <button type="button" className="n-tt-suivi-n" data-suivi-copier={suivi.n} aria-label={tr('tableau.copierSuivi', { n: suivi.n })} title={tr('tableau.copierSuivi', { n: suivi.n })} onClick={copier}>
        {copie ? tr('tableau.copie') : suivi.n}</button>
      {suivi.lien && suivi.lien.url ? <a className="n-tt-suivi-lien" href={suivi.lien.url} target="_blank" rel="noreferrer" data-suivi-lien={suivi.lien.site ? 'transporteur' : 'recherche'}
        aria-label={tr('tableau.suivreChez')} title={tr('tableau.suivreChez')} onClick={(e) => e.stopPropagation()}>↗</a> : null}
    </span>
  );
}
const dateCourte = (ms) => { try { return new Date(ms).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch (_) { return ''; } };

export default function AchatsTableau({ lignes, filtres = [], compte = '', majLe, onRafraichir = null, onOuvrir = null, onCode = null, haut = null, pied = '', Icon = null }) {
  const rangees = React.useMemo(() => (Array.isArray(lignes) ? lignes.map((l) => ({ ...l, statut: categorieAchat(l.etape), statutLibelle: l.etape ? l.etape.label : '',
    sous: l.compte || '', texte: [l.titre, l.num ? 'n' + l.num + ' n°' + l.num : '', l.compte, l.transporteur && l.transporteur.nom, l.suivi && l.suivi.n, l.code, l.cle].filter(Boolean).join(' '),
    prixGrille: l.prix, attrs: { 'data-achat-tx': l.cle } })) : lignes), [lignes]);
  const colonnes = [
    { cle: 'numero', libelle: tr('egalite.col.numero'), defaut: false, tri: (l) => l.num || null, rendu: (l) => (l.num ? <Plaque numero={l.num}/> : null) },
    { cle: 'prix', libelle: tr('tableau.col.prixPaye'), num: true, tri: (l) => l.prixNombre, rendu: (l) => l.prix || null },
    { cle: 'date', libelle: tr('tableau.col.date'), num: true, tri: (l) => l.t, rendu: (l) => (l.t != null ? dateCourte(l.t) : null) },
    { cle: 'transporteur', libelle: tr('tableau.col.transporteur'), tri: (l) => (l.transporteur && l.transporteur.nom) || null,
      rendu: (l) => (l.transporteur && l.transporteur.nom ? <span className="n-tt-transporteur">{l.transporteur.logo}<span>{l.transporteur.nom}</span></span> : null) },
    // (20 nov.) Le N° de suivi : toucher = le copier (« Copié ✓ »), ↗ = le suivre chez SON transporteur (lien lu, jamais deviné).
    { cle: 'suivi', libelle: tr('tableau.col.suivi'), tri: (l) => (l.suivi && l.suivi.n) || null, rendu: (l) => (l.suivi ? <NumeroSuivi suivi={l.suivi}/> : null) },
    { cle: 'code', libelle: tr('tableau.col.code'), titreCourt: tr('tableau.col.codeCourt'), tri: (l) => l.code || null,
      rendu: (l) => (l.code ? (onCode ? <button type="button" className="n-eg-cellule n-tt-code" data-achat-code={l.cle} aria-label={tr('tableau.voirCode', { code: l.code })} onClick={(e) => { e.stopPropagation(); onCode(l); }}>{l.code}</button> : <span className="n-tt-code">{l.code}</span>) : null) },
    { cle: 'statut', libelle: tr('tableau.col.statut'), tri: (l) => CATEGORIES_ACHAT.indexOf(l.statut) },
  ];
  const statuts = CATEGORIES_ACHAT.map((c) => ({ cle: c, libelle: tr('tableau.achat.' + c), ton: TON[c] }));
  return (
    <TableauTravail id="achats" titre={tr('tableau.achats.titre')} compte={compte} majLe={majLe} onRafraichir={onRafraichir} lignes={rangees} statuts={statuts}
      statutsDefaut={['retirer', 'renvoyer', 'route', 'paye', 'arrive']} filtres={filtres} colonnes={colonnes}
      menuLigne={onOuvrir ? (l) => [{ cle: 'ouvrir', libelle: tr('tableau.ouvrir'), onClick: () => onOuvrir(l) }, ...(l.code && onCode ? [{ cle: 'code', libelle: tr('tableau.col.code'), onClick: () => onCode(l) }] : [])] : null}
      onOuvrir={onOuvrir} unite={(n) => tr('tableau.achats', { n })} placeholder={tr('tableau.chercherAchat')} haut={haut} pied={pied}
      ligneTel={(l) => ({ sousTitre: [l.statutLibelle, l.t != null ? dateCourte(l.t) : ''].filter(Boolean).join(' · '), valeur: l.prix || null, detailValeur: l.code || l.compte, ton: l.statut === 'retirer' ? 'ambre' : 'neutre' })}
      vide={tr('tableau.videAchats')} Icon={Icon} attrs={{ 'data-achats-tableau': '' }}/>
  );
}
