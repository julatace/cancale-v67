// ── src/natif/ecrans/AnnoncesTableau.jsx — Annonces à l'ordinateur, en TABLEAU DE TRAVAIL (19 nov. soir) ──────────────
// Les MÊMES articles que la liste (src/articles/modele.js, `construireArticles`), les mêmes faits, les mêmes saisies, les
// mêmes actions (« Actions » d'annonces-a-egalite, `onAction` → le chemin existant) : seule la disposition change
// (TableauTravail, NATIF.md §2 bis). Une VUE : aucune lecture, aucune règle.
//
// Props : articles [{ a: article, statut }] (déjà au site et au compte choisis) · undefined · null ; filtres ; compte ; majLe ;
// onRafraichir ; rafraichit ; actions [{ cle, libelle, pour(a), juger([a]) }] ; onAction(cle, [a]) ; onOuvrir(a) ; saisir(a, champ) ;
// onNumero(a) ; onPrix(a) ; onRelier(a) ; onFiche(a) ; plein ; haut ; pied ; euros ; depuisTexte ; nomSite ; Icon.
import React from 'react';
import { tr } from '../../i18n/index.js';
import { TableauTravail } from '../TableauTravail.jsx';
import { Plaque } from '../Plaque.jsx';
import { LogoSite } from '../LogoSite.jsx';   // (20 nov. soir) le logo du site
import { PropositionLiaison } from './PropositionLiaison.jsx';   // (20 nov.) relier depuis la liste
import { STATUTS_TABLEAU, STATUTS_EN_LIGNE, statutTableau } from '../../articles/modele.js';
import { groupesParCompte } from './annoncesComptes.js';   // (20 nov.) un intertitre par compte
import { CarteAnnonce, seulementBloque, traceDe, texteTrace } from './AnnoncesCartes.jsx';   // (21 nov.) la grille « Dressing », le compte bloqué

const TON = { enligne: 'vert', masquee: 'neutre', pause: 'neutre', aconfirmer: 'ambre', bloque: 'neutre', brouillon: 'neutre', vendue: 'vert', retiree: 'neutre' };
const dateCourte = (ms) => { try { return new Date(ms).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch (_) { return ''; } };

export default function AnnoncesTableau({ articles, filtres = [], compte = '', majLe, onRafraichir = null, rafraichit = false, actions = [], onAction, onOuvrir,
  saisir, onNumero = null, onPrix = null, onRelier = null, onFiche = null, plein = null, haut = null, pied = '', euros = (n) => String(n) + ' €',
  depuisTexte = () => '', nomSite = (s) => s, Icon = null, sites = [], onAutomatisations = null, onPublier = null, liaison = null, site = 'tous', Logo = null, dortDe = null, plusVueDe = null, Photo = null }) {
  // (20 nov.) La colonne et le filtre « Liaison » : l'état du lien de chaque article (Reliée · À relier · Que sur ce site), lu
  // dans src/liaisonEtat.js par l'écran (`liaison.de`). Un article seulement sur Vinted n'a rien à relier : « — ».
  const [filtreLien, setFiltreLien] = React.useState('tous');
  const lienDe = (a) => (liaison && a ? liaison.de(a) : null);
  const classeLien = (a) => { const l = lienDe(a); if (!l) return ''; return l.etat === 'aRelier' ? 'arelier' : l.etat === 'propre' ? 'propre' : l.etat === 'relie' || l.etat === 'aVerifier' ? 'reliee' : ''; };
  // (20 nov., Julien : « divise par comptes ») Les lignes rangées PAR COMPTE (src/natif/ecrans/annoncesComptes.js) : une paire en
  // ligne sur deux comptes a une ligne sous chacun (`cle` = article | compte) ; une action reçoit chaque ARTICLE une fois.
  const lignes = React.useMemo(() => {
    if (!Array.isArray(articles)) return articles;
    const statutDe = new Map(articles.map(({ a, statut }) => [a.cle, statut]));
    const garde = articles.filter(({ a }) => filtreLien === 'tous' || classeLien(a) === filtreLien).map(({ a }) => a);
    const out = [];
    for (const g of groupesParCompte(garde, site)) {
      const titre = <span className="n-eg-compte">{Logo && g.site ? <span className="n-eg-compte-logo" aria-hidden="true">{Logo(g.site)}</span> : null}{g.cle === 'sans' ? tr('egalite.groupe.sansCompte') : (g.pseudo || ('#' + g.compte))}<span className="n-tt-intertitre-n">{tr('egalite.groupe.n', { n: g.articles.length })}</span></span>;
      // (22 nov., Julien : « les filtres ne sont pas précis ») La rangée d'un COMPTE porte l'état de SON annonce (vendue sur Vinted,
      // en ligne sur Leboncoin : deux rangées, « Vendue » et « En ligne ») — le compteur de chaque statut = ses rangées.
      for (const a of g.articles) out.push({ a, statut: (g.cle !== 'sans' && statutTableau(a, { site: g.site, compte: g.compte })) || statutDe.get(a.cle), groupe: { cle: g.cle, titre } });
    }
    return out.map(({ a, statut, groupe }) => ({
    cle: a.cle + '|' + groupe.cle, groupe, a, statut, titre: a.titre || tr('egalite.sansTitre'), photo: a.photo || '',
    // (21 nov.) Une annonce d'un compte bloqué dit sa dernière trace (« Lu le 21 nov. ») à la place de son état.
    sous: [a.taille ? tr('egalite.taille', { t: a.taille }) : '', a.condition, statut === 'bloque' ? texteTrace(traceDe(a)) : ''].filter(Boolean).join(' · '),
    nonCochable: seulementBloque(a),
    texte: [a.titre, a.numero ? 'n' + a.numero + ' n°' + a.numero + ' ' + a.numero : '', a.taille, ...a.annonces.map((x) => x.pseudo + ' ' + nomSite(x.site))].join(' '),
    prixGrille: a.prix != null ? euros(a.prix) : '',
    attrs: { 'data-eg-article': a.cle, 'data-eg-numero': a.numero || '', 'data-eg-sites': a.sites.join(','), 'data-eg-compte': groupe.cle },
  })); }, [articles, euros, nomSite, filtreLien, liaison, site, Logo]);   // eslint-disable-line react-hooks/exhaustive-deps
  const unParArticle = (ls) => { const vu = new Set(); return ls.filter((l) => (vu.has(l.a.cle) ? false : (vu.add(l.a.cle), true))).map((l) => l.a); };

  // Une cellule qui se modifie : la valeur, ou « — » qui ouvre SA saisie (la même feuille que la liste).
  const modifiable = (l, cle, valeur, onModifier) => (onModifier && !seulementBloque(l.a)
    ? <button type="button" className="n-eg-cellule" data-eg-modifier={cle} data-eg-vide={valeur == null ? '1' : undefined}
        aria-label={tr('egalite.modifier', { quoi: tr('egalite.col.' + cle), article: l.titre })} onClick={(e) => { e.stopPropagation(); onModifier(); }}>{valeur == null ? '—' : valeur}</button>
    : valeur);
  const pasFourni = () => <span className="n-tt-vide-cellule" title={tr('cqm.pasFourni')} aria-label={'— · ' + tr('cqm.pasFourni')} data-eg-pasfourni="">—</span>;
  const colonnes = [
    // (20 nov. soir, plus de sélecteur de plateforme) Une colonne « Site » ÉTROITE : le logo de chaque site où l'article est en
    // vente, rien d'autre (le compte est l'intertitre du groupe ; le nom au survol).
    { cle: 'site', libelle: tr('tableau.col.site'), titreCourt: true, tri: (l) => l.a.sites.join(','),
      rendu: (l) => <span className="n-eg-logos" data-eg-logos={l.a.sites.join(',')}>{l.a.sites.map((x) => <LogoSite key={x} site={x} taille={18} nom={nomSite(x)}/>)}</span> },
    { cle: 'numero', libelle: tr('egalite.col.numero'), tri: (l) => l.a.numero || null,
      rendu: (l) => (l.a.numero ? <Plaque numero={l.a.numero} doublon={l.a.doublon}/> : modifiable(l, 'numero', null, onNumero ? () => onNumero(l.a) : null)) },
    { cle: 'prix', libelle: tr('egalite.col.prix'), num: true, tri: (l) => l.a.prix, rendu: (l) => modifiable(l, 'prix', l.a.prix != null ? euros(l.a.prix) : null, onPrix ? () => onPrix(l.a) : null) },
    { cle: 'prixMini', libelle: tr('egalite.col.prixMini'), num: true, replieVide: true, priorite: 3, tri: (l) => l.a.prixMini, rendu: (l) => modifiable(l, 'prixMini', l.a.prixMini != null ? euros(l.a.prixMini) : null, () => saisir(l.a, 'min')) },
    { cle: 'achat', libelle: tr('egalite.col.achat'), num: true, replieVide: true, priorite: 2, tri: (l) => l.a.achat, rendu: (l) => modifiable(l, 'achat', l.a.achat != null ? euros(l.a.achat) : null, () => saisir(l.a, 'buyPrice')) },
    { cle: 'benefice', libelle: tr('egalite.col.benefice'), num: true, defaut: false, replieVide: true, priorite: 2.5, tri: (l) => l.a.benefice, rendu: (l) => (l.a.benefice != null ? euros(l.a.benefice) : null) },
    // (22 nov.) Une annonce VENDUE dit la date de SA vente (lue) ; les autres, leur mise en ligne.
    { cle: 'date', libelle: tr('tableau.col.date'), num: true, priorite: 6, tri: (l) => (l.statut === 'vendue' && l.a.venduLe != null ? l.a.venduLe : l.a.depuis),
      rendu: (l) => (l.statut === 'vendue' && l.a.venduLe != null ? <span data-eg-vendu-le=""><span>{dateCourte(l.a.venduLe)}</span><span className="n-tt-cellule-sous">{tr('tableau.venduLe')}</span></span>
        : l.a.depuis != null ? <span><span>{dateCourte(l.a.depuis)}</span><span className="n-tt-cellule-sous">{depuisTexte(l.a.depuis)}</span></span> : null) },
    // (20 nov., « ce qui manque ») Vues et favoris : lus dans le dressing de chaque site (aucune requête de plus) ; ce qu'aucun
    // de ses sites ne donne s'écrit « — », dit au survol et à la lecture d'écran « pas fourni par le site » (une fois par
    // cellule, jamais une phrase répétée à l'écran).
    { cle: 'vues', libelle: tr('tableau.col.vues'), num: true, replieVide: true, priorite: 4, tri: (l) => l.a.vues, rendu: (l) => { const pv = plusVueDe ? plusVueDe(l.a) : null; const v = l.a.vues != null ? String(l.a.vues) : pasFourni();
        // (22 nov., choix 27) « Plus vue depuis N j » (src/plusVue.js), sous le nombre de vues.
        return pv != null ? <span><span>{v}</span><span className="n-tt-cellule-sous n-ad-etiquette" data-ad-conseil="plusvue" data-ad-plusvue={String(pv)}>{tr('af.pv.etiquette', { n: pv })}</span></span> : v; } },
    { cle: 'favoris', libelle: tr('egalite.col.favoris'), num: true, replieVide: true, priorite: 5, tri: (l) => l.a.favoris, rendu: (l) => (l.a.favoris != null ? String(l.a.favoris) : pasFourni()) },
    { cle: 'place', libelle: tr('egalite.col.place'), defaut: false, replieVide: true, priorite: 1.5, tri: (l) => (l.a.place ? (l.a.place.nom || String(l.a.place.i)) : null),
      rendu: (l) => (l.a.place ? (l.a.place.nom || tr('egalite.placeCase', { i: Number(l.a.place.i) + 1 })) : null) },
    ...(liaison ? [{ cle: 'liaison', libelle: tr('liaL.col'), replieVide: true, priorite: 1, vide: (l) => !lienDe(l.a) || lienDe(l.a).etat === 'passu', tri: (l) => ({ arelier: 0, propre: 2, reliee: 1 }[classeLien(l.a)] ?? 3),
      rendu: (l) => { const x = lienDe(l.a); if (!x) return null;
        if (x.etat === 'aRelier') return <PropositionLiaison l={x} forme="cellule" onRelier={liaison.relier} onAutre={liaison.autre} onPropre={liaison.propre} Photo={liaison.Photo || null}/>;
        if (x.etat === 'propre') return <span data-eg-lien="propre">{tr('liaL.etat.propre', { site: x.site })}</span>;
        if (x.etat === 'relie') return <span data-eg-lien="reliee">{tr('liaL.etat.reliee', { numero: x.numero })}</span>;
        if (x.etat === 'aVerifier') return <span className="n-eg-arelier" data-eg-lien="averifier">{tr('liaL.etat.aVerifier')}</span>;
        return null; } }] : []),
    { cle: 'statut', libelle: tr('tableau.col.statut'), tri: (l) => STATUTS_TABLEAU.indexOf(l.statut) },
  ];
  const filtresL = liaison ? [...filtres, { cle: 'liaison', libelle: tr('liaL.col'), valeur: filtreLien, onChange: setFiltreLien,
    options: [{ cle: 'tous', libelle: tr('liaL.filtre.tous') }, { cle: 'arelier', libelle: tr('liaL.filtre.arelier') }, { cle: 'reliee', libelle: tr('liaL.filtre.reliee') }, { cle: 'propre', libelle: tr('liaL.filtre.propre') }] }] : filtres;
  const statuts = STATUTS_TABLEAU.map((s) => ({ cle: s, libelle: tr('tableau.etat.' + s), ton: TON[s] }));
  const acts = actions.map((x) => ({ cle: x.cle, libelle: x.libelle, aucune: tr('tableau.actionAucuneIci'),
    pour: x.pour ? (l) => x.pour(l.a) : null, juger: x.juger ? (ls) => x.juger(unParArticle(ls)) : null }));
  const menuLigne = (l) => (seulementBloque(l.a) ? [{ cle: 'fiche', libelle: tr('tableau.ouvrir'), onClick: () => onOuvrir(l.a) }] : [
    { cle: 'fiche', libelle: tr('tableau.ouvrir'), onClick: () => onOuvrir(l.a) },
    { cle: 'mini', libelle: tr('egalite.saisie.min'), onClick: () => saisir(l.a, 'min') },
    { cle: 'achat', libelle: tr('egalite.saisie.buyPrice'), onClick: () => saisir(l.a, 'buyPrice') },
    ...(l.a.aRelier && onRelier ? [{ cle: 'relier', libelle: tr('egalite.relier.titre'), onClick: () => onRelier(l.a) }] : []),
    ...(onFiche && l.a.numero ? [{ cle: 'toute', libelle: tr('egalite.touteLaFiche'), onClick: () => onFiche(l.a) }] : []),
  ]);
  // (21 nov.) La GRILLE de l'ordinateur : les mêmes cartes que le téléphone (photo, N°, logos, prix, vues · favoris · jours).
  const carteGrille = (l, { coche, cochable, basculer, ouvrir: ouvrirL, selection }) => (
    <CarteAnnonce a={l.a} onOuvrir={() => ouvrirL(l)} euros={euros} depuisTexte={depuisTexte} nomSite={nomSite} Icon={Icon} Photo={Photo} dort={dortDe && !selection ? dortDe(l.a) : null} plusVue={plusVueDe && !selection ? plusVueDe(l.a) : null}
      selection={selection ? { cochee: coche, cochable, onBascule: () => basculer(l) } : null} attrs={{ ...l.attrs, 'data-tt-ligne': l.cle, 'data-tt-coche': coche ? '1' : undefined }}/>
  );
  return (
    <TableauTravail id="annonces" titre={tr('egalite.titre')} compte={compte} majLe={majLe} onRafraichir={onRafraichir} rafraichit={rafraichit}
      lignes={lignes} statuts={statuts} statutsDefaut={[...STATUTS_EN_LIGNE, 'bloque']} carteGrille={carteGrille} filtres={filtresL} colonnes={colonnes}
      actions={acts} onAction={(cle, ls) => onAction(cle, unParArticle(ls))} menuLigne={menuLigne} onOuvrir={(l) => onOuvrir(l.a)} groupe={(l) => l.groupe}
      unite={(n) => tr('tableau.articles', { n })} placeholder={tr('tableau.chercherArticle')} plein={plein} haut={haut} pied={pied}
      outilsPlus={onPublier || onAutomatisations ? <>{onPublier ? <button type="button" className="n-tt-bouton" data-eg-publier="" onClick={onPublier}>{Icon ? <Icon name="plus" size={16}/> : null}<span className="n-tt-bouton-libelle">{tr('egalite.publier')}</span></button> : null}{onAutomatisations ? <button type="button" className="n-tt-bouton" data-tt-automatisations="" onClick={onAutomatisations}>{Icon ? <Icon name="spark" size={16}/> : null}<span className="n-tt-bouton-libelle">{tr('auto.titre')}</span></button> : null}</> : null}
      vide={tr('tableau.videAnnonces')} pasSu={tr('egalite.pasSu')} Icon={Icon} attrs={{ 'data-eg-ecran': '', 'data-eg-vue': 'tableau' }}/>
  );
}
