// ── src/natif/ecrans/VentesTableau.jsx — Ventes à l'ordinateur, en TABLEAU DE TRAVAIL (19 nov. soir) ──────────────────
// Les MÊMES ventes que la liste « Toutes » (VentesToutes, src/App.jsx : chaque ligne est UNE vente lue sur SON site, sous
// SON identité, rangée du plus récent au plus ancien) ; la même étiquette d'état (`etapeVente` et celles des autres sites),
// rangée dans les cases du filtre Statut (`categorieVente`, src/ventesEcran.js). Une VUE : aucune lecture, aucune règle.
//
// Props : lignes (la forme de VentesToutes) · undefined · null ; etats (phrases de lecture, dites une fois) ; majLe ;
// onRafraichir ; compte ; filtres ; prix(l) ; jour(l.t) ; motEtat(etat) ; nomSite(site) ; logoSite(site) ; logoTransporteur(tr) ;
// onOuvrir(l) ; onImprimer([l]) (le chemin EXISTANT de l'impression) ; imprimable(l) ; Icon.
import React from 'react';
import { tr } from '../../i18n/index.js';
import { TableauTravail } from '../TableauTravail.jsx';
import { Plaque } from '../Plaque.jsx';
import { CATEGORIES_VENTE, categorieVente } from '../../ventesEcran.js';
import { celluleAchat } from './celluleAchat.jsx';

const TON = { envoyer: 'ambre', route: 'accent', terminee: 'encre', annulee: 'neutre', litige: 'ambre', encours: 'neutre' };
const dateCourte = (ms) => { try { return new Date(ms).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch (_) { return ''; } };

export default function VentesTableau({ lignes, haut = null, pied = '', majLe, onRafraichir = null, rafraichit = false, compte = '', filtres = [],
  prix = (l) => (l.prix == null ? '' : String(l.prix) + ' €'), motEtat = (e) => e, nomSite = (s) => s, logoSite = () => null, logoTransporteur = () => null,
  onOuvrir = null, onImprimer = null, imprimable = () => false, Icon = null, achatDe = null }) {
  const rangees = React.useMemo(() => (Array.isArray(lignes) ? lignes.map((l) => {
    const mot = l.etat ? motEtat(l.etat) : '';
    return { ...l, v: l, titre: l.titre, photo: typeof l.photo === 'string' ? l.photo : '', statut: categorieVente(mot), statutLibelle: mot,
      sous: [nomSite(l.site), l.compte].filter(Boolean).join(' · '),
      texte: [l.titre, l.num ? 'n' + l.num + ' n°' + l.num + ' ' + l.num : '', l.compte, nomSite(l.site), l.tr && l.tr.nom, l.id].filter(Boolean).join(' '),
      prixGrille: prix(l), attrs: { 'data-vt-site': l.site, 'data-toutes-vente': l.site, 'data-toutes-id': l.id, 'data-ordre-t': l.t != null ? String(l.t) : '' } };
  }) : lignes), [lignes, motEtat, nomSite, prix]);
  const colonnes = [
    // (20 nov.) « Achat » : relier CETTE vente à son achat (son toucher), ou voir l'achat relié — src/natif/ecrans/celluleAchat.jsx.
    ...(achatDe ? [{ cle: 'achat', libelle: tr('vt.col.achat'), tri: (l) => { const a = achatDe(l.v); return a ? (a.relie ? 1 : 0) : null; }, rendu: (l) => celluleAchat(achatDe(l.v), Icon) }] : []),
    { cle: 'numero', libelle: tr('egalite.col.numero'), tri: (l) => l.num || null, rendu: (l) => (l.num ? <Plaque numero={l.num}/> : null) },
    { cle: 'site', libelle: tr('tableau.col.site'), defaut: false, tri: (l) => l.site, rendu: (l) => <span className="n-tt-transporteur">{logoSite(l.site)}<span>{nomSite(l.site)}</span></span> },
    { cle: 'prix', libelle: tr('egalite.col.prix'), num: true, tri: (l) => l.prix, rendu: (l) => prix(l) || null },
    { cle: 'date', libelle: tr('tableau.col.date'), num: true, tri: (l) => l.t, rendu: (l) => (l.t != null ? dateCourte(l.t) : null) },
    { cle: 'transporteur', libelle: tr('tableau.col.transporteur'), tri: (l) => (l.tr && l.tr.nom) || null,
      rendu: (l) => (l.tr && l.tr.nom ? <span className="n-tt-transporteur" data-transporteur={l.tr.cle || ''}>{logoTransporteur(l.tr)}<span>{l.tr.nom}</span></span> : null) },
    { cle: 'statut', libelle: tr('tableau.col.statut'), tri: (l) => CATEGORIES_VENTE.indexOf(l.statut) },
  ];
  const statuts = CATEGORIES_VENTE.map((c) => ({ cle: c, libelle: tr('tableau.vente.' + c), ton: TON[c] }));
  const actions = onImprimer ? [{ cle: 'imprimer', libelle: tr('tableau.action.imprimer'), aucune: tr('tableau.action.imprimerAucune'), pour: (l) => imprimable(l.v) }] : [];
  return (
    <TableauTravail id="ventes" titre={tr('tableau.ventes.titre')} compte={compte} majLe={majLe} onRafraichir={onRafraichir} rafraichit={rafraichit}
      lignes={rangees} statuts={statuts} filtres={filtres} colonnes={colonnes} actions={actions}
      onAction={(cle, ls) => { if (cle === 'imprimer' && onImprimer) onImprimer(ls.map((l) => l.v)); }}
      menuLigne={onOuvrir ? (l) => [{ cle: 'ouvrir', libelle: tr('tableau.ouvrirVente'), onClick: () => onOuvrir(l.v) }] : null}
      onOuvrir={onOuvrir ? (l) => onOuvrir(l.v) : null}
      ligneTel={(l) => ({ sousTitre: [l.statutLibelle, l.t != null ? dateCourte(l.t) : ''].filter(Boolean).join(' · '), valeur: l.prixGrille || null, detailValeur: l.sous, plaque: l.num ? <Plaque numero={l.num}/> : null, ton: l.statut === 'envoyer' ? 'ambre' : 'neutre' })}
      unite={(n) => tr('tableau.ventes', { n })} placeholder={tr('tableau.chercherVente')} haut={haut} pied={pied}
      vide={tr('tableau.videVentes')} Icon={Icon} attrs={{ 'data-ventes-tableau': '' }}/>
  );
}
