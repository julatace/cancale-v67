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
import { celluleAchat, GestesAchat } from './celluleAchat.jsx';
import { Groupe } from '../Groupe.jsx';
import { Rangee, Vignette } from '../Rangee.jsx';
import { Pastille } from '../Pastille.jsx';
import { LogoSite } from '../LogoSite.jsx';
import '../ventes-lisibles.css';
import { morceauxMarqueTaille } from '../../ventes/marqueTaille.js';
import { texteNet } from '../../coutReel.js';
import { ParPaquets } from '../../composants/ParPaquets.jsx';   // (22 nov., latence) la liste des ventes au téléphone posée par paquets

const TON = { envoyer: 'ambre', route: 'teal', terminee: 'vert', annulee: 'neutre', litige: 'ambre', encours: 'neutre' };
const joint = (...x) => x.filter(Boolean).join(' · ');
// (21 nov.) « Marque · T42 » : la marque de la ligne (lue, ou écrite dans le titre — pour l'affichage seulement) et sa taille.
// Ce que le titre dit déjà ne se répète pas (src/ventes/marqueTaille.js).
const marqueTaille = (l) => joint(...morceauxMarqueTaille(l, (t) => tr('vv.taille', { t })));
const dateCourte = (ms) => { try { return new Date(ms).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch (_) { return ''; } };

export default function VentesTableau({ lignes, haut = null, pied = '', majLe, onRafraichir = null, rafraichit = false, compte = '', filtres = [],
  prix = (l) => (l.prix == null ? '' : String(l.prix) + ' €'), motEtat = (e) => e, nomSite = (s) => s, logoSite = () => null, logoTransporteur = () => null,
  onOuvrir = null, onImprimer = null, imprimable = () => false, Icon = null, achatDe = null, netDe = null, euros = null }) {
  const rangees = React.useMemo(() => (Array.isArray(lignes) ? lignes.map((l) => {
    const mot = l.etat ? motEtat(l.etat) : '';
    return { ...l, v: l, titre: l.titre, photo: typeof l.photo === 'string' ? l.photo : '', statut: categorieVente(mot), statutLibelle: mot,
      sous: joint(marqueTaille(l), nomSite(l.site), l.compte),
      texte: [l.titre, l.num ? 'n' + l.num + ' n°' + l.num + ' ' + l.num : '', l.compte, nomSite(l.site), l.tr && l.tr.nom, l.id].filter(Boolean).join(' '),
      prixGrille: prix(l), attrs: { 'data-vt-site': l.site, 'data-toutes-vente': l.site, 'data-toutes-id': l.id, 'data-ordre-t': l.t != null ? String(l.t) : '' } };
  }) : lignes), [lignes, motEtat, nomSite, prix]);
  const colonnes = [
    // (20 nov.) « Achat » : relier CETTE vente à son achat (son toucher), ou voir l'achat relié — src/natif/ecrans/celluleAchat.jsx.
    ...(achatDe ? [{ cle: 'achat', libelle: tr('vt.col.achat'), tri: (l) => { const a = achatDe(l.v); return a ? (a.relie ? 1 : 0) : null; }, rendu: (l) => { const a = achatDe(l.v); return celluleAchat(a ? { ...a, titre: a.titre || l.titre } : null, Icon); } }] : []),
    { cle: 'numero', libelle: tr('egalite.col.numero'), tri: (l) => l.num || null, rendu: (l) => (l.num ? <Plaque numero={l.num}/> : null) },
    { cle: 'site', libelle: tr('tableau.col.site'), defaut: false, tri: (l) => l.site, rendu: (l) => <span className="n-tt-transporteur">{logoSite(l.site)}<span>{nomSite(l.site)}</span></span> },
    { cle: 'prix', libelle: tr('egalite.col.prix'), num: true, tri: (l) => l.prix, rendu: (l) => prix(l) || null },
    // (21 nov., lot rentabilite — choix n° 41) « Net » : le bénéfice net de la paire, la règle du bénéfice (src/coutReel.js), posé
    // par l'app (`netDe`) ; « — » s'il n'est pas su, « au plus » tant que des frais ne sont pas confirmés. Une vue : rien calculé ici.
    ...(netDe ? [{ cle: 'net', libelle: tr('cr.col.net'), num: true, tri: (l) => { const n = netDe(l.v); return n && n.c != null ? n.c : null; },
      rendu: (l) => { const n = netDe(l.v); if (!n || n.etat === 'annulee') return null; return <span data-vt-net={n.c == null ? '' : String(n.c)} data-vt-net-etat={n.etat}>{texteNet(n.c, n.etat, euros || undefined)}</span>; } }] : []),
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

// ── (21 nov., ventes-lisibles) TERMINÉES AU TÉLÉPHONE : la rangée de Ventes « comme la page Commandes de Vintex », empilée ─────────
// Julien : « les icônes devant […] beaucoup trop petit, on ne voit même pas ce que c'est, il n'y a même pas le nom de la paire en
// entier avec la taille ». Les MÊMES lignes que le tableau (VentesToutes, src/App.jsx), dans le même ordre ; une rangée native :
// vignette de 64, le titre ENTIER (deux lignes, toute la largeur), « logo du site · N° · Marque · T42 », puis le prix, l'étiquette
// d'état, le transporteur et la date ; au pied, l'ACHAT (Relier, prix d'achat) en un toucher — jamais derrière « ⋯ ».
// Une VUE : aucune lecture, aucune règle (`achatDe` vient de l'app, comme la colonne « Achat » du tableau).
export function VentesListeTel({ lignes, avant = null, prix = (l) => (l.prix == null ? '' : String(l.prix) + ' €'), motEtat = (e) => e, jour = (t) => dateCourte(t),
  nomSite = (s) => s, logoTransporteur = () => null, Plaque: PlaqueN = Plaque, Photo = null, onOuvrir = null, attrsDe = () => ({}), achatDe = null, Icon = null }) {
  return (
    <Groupe attrs={{ 'data-vt-liste-tel': String((lignes || []).length) }}>
      <ParPaquets items={lignes || []} rendre={(l, i) => {
        const mot = l.etat ? motEtat(l.etat) : '';
        const cat = categorieVente(mot);
        const a = achatDe ? achatDe(l) : null;
        const photo = typeof l.photo === 'string' ? l.photo : '';
        return (
          <React.Fragment key={l.cle}>
            {avant ? avant(i) : null}
            <Rangee
              vignette={<Vignette src={photo} alt="" taille={64} image={photo && Photo ? <Photo src={photo} alt="" loading="lazy" decoding="async"/> : null}/>}
              titre={l.titre} lignes={2}
              plaque={<>{l.site ? <LogoSite site={l.site} taille={20} nom={nomSite(l.site)}/> : null}{l.num ? <PlaqueN numero={l.num}/> : null}</>}
              sousTitre={joint(marqueTaille(l), l.compte, l.detail)}
              note={<span className="n-vt-valeur n-vt-ligne" data-vt-ligne="">
                {prix(l) ? <span className="n-vt-ligne-prix" data-vt-prix="">{prix(l)}</span> : null}
                {mot ? <Pastille ton={TON[cat] === 'ambre' ? 'ambre' : 'neutre'}>{mot}</Pastille> : null}
                {l.tr && l.tr.cle ? <span className="n-vt-logo" data-vt-transporteur={l.tr.cle} title={l.tr.nom || ''}>{logoTransporteur(l.tr)}</span> : null}
                <span className="n-vt-ligne-fin">{jour(l.t)}</span>
              </span>}
              pied={a ? <GestesAchat a={{ ...a, titre: a.titre || l.titre }} Icon={Icon}/> : null}
              onClick={onOuvrir ? () => onOuvrir(l) : null} fin={null}
              attrs={{ 'data-toutes-vente': l.site, 'data-toutes-id': l.id, 'data-toutes-compte': l.compte || '', 'data-ordre-t': l.t != null ? String(l.t) : '', 'data-vt-statut': cat, ...attrsDe(l) }}/>
          </React.Fragment>
        );
      }}/>
    </Groupe>
  );
}
