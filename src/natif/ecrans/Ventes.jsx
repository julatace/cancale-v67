// ── src/natif/ecrans/Ventes.jsx — VENTES, « VRM natif » (19 nov. 2026, docs/design/NATIF.md §4) ──────────────
// Julien : « la mise en page est catastrophique, revois absolument tout […] quelque chose de drastique ». Le CONTENU de
// Ventes qu'il aimait reste : À envoyer · En route · Toutes avec leurs nombres, les cases cochées d'office, la plaque N°,
// la date limite, la place dans le stock, le prix, le transporteur, « Imprimer N bordereaux », En route avec ses étapes
// prouvées. La mise en page est celle du contrat : <Page> à grand titre, <Segmente>, une liste groupée de <Rangee> de 72,
// le plein collé au-dessus de la barre d'onglets, balayage = imprimer, toucher = la fiche poussée (le volet de détail
// à l'ordinateur, posé par la coque).
// Cet écran ne CALCULE rien : `m` est le modèle assemblé par src/App.jsx (Comptabilite) avec les règles d'avant
// (src/ventes/modeleVentes.js range, scripts/audit-ventes-modele.cjs juge) ; `g` porte les gestes, les fonctions d'avant.
// Aucun style en ligne, aucune classe de mise en page, aucune couleur : des composants de src/natif/.
import React from 'react';
import { tr } from '../../i18n/index.js';
import { Page, PagePoussee, ChampRecherche, Groupe, Rangee, Vignette, Plaque, Bouton, BoutonIcone, Segmente, Vide, Attente, Faits, Fait, Feuille, ContexteCoque, poserIcone, iconePosee } from '../index.js';
import { filtrerRangs, rangChoisi, statutRangee } from '../../ventes/modeleVentes.js';
import { TableauTravail } from '../TableauTravail.jsx';
import { useOrdinateur } from '../Coque.jsx';
import { FermeAuRetourUi } from '../../ui/retour.jsx';
import { Pastille } from '../Pastille.jsx';
import { LogoTransporteur } from '../../PastilleTransporteur.jsx';
import { LogoSite } from '../LogoSite.jsx';   // (20 nov. soir) tout est mélangé : le logo du site de chaque vente
import { celluleAchat, GestesAchat } from './celluleAchat.jsx';
import { morceauxMarqueTaille } from '../../ventes/marqueTaille.js';
import '../ventes-lisibles.css';
import { useARegler } from '../../designV2/useARegler.js';
import { groupesDe, atelierCompleter } from '../../designV2/aRegler.js';   // (21 nov.) vignettes lisibles, titre entier, gestes de l'achat
import { ParPaquets } from '../../composants/ParPaquets.jsx';   // (22 nov., latence) 70 colis à envoyer posés par paquets

const joint = (...x) => x.filter(Boolean).join(' · ');
// Les morceaux d'une méta qui peut passer à la ligne : chacun reste entier (« à vérifier » ne se coupe jamais en deux).
const morceaux = (...x) => x.filter(Boolean).map((t, i) => <React.Fragment key={i}>{i ? ' · ' : ''}<span className="n-vt-morceau">{t}</span></React.Fragment>);
// La photo d'une rangée : la <PhotoVinted> de l'app quand elle est passée (sans référent, relais de l'extension quand l'adresse
// Vinted a expiré — sinon le CDN refuse et la vignette restait un carré vide), sinon l'icône dessinée.
const vignette = (r, Photo, taille = 56) => <Vignette src={r.photo || ''} alt="" taille={taille} image={r.photo && Photo ? <Photo src={r.photo} alt="" loading="lazy" decoding="async"/> : null}/>;
// (21 nov., Julien : « les icônes devant […] beaucoup trop petit, il n'y a même pas le nom de la paire en entier avec la taille »)
// « Marque · T42 » sous le titre : la marque LUE (ou écrite dans le titre, pour l'affichage seulement — jamais une identité) et la taille.
// « rien en double » : ce que le titre dit déjà (la marque, la taille) ne se répète pas (src/ventes/marqueTaille.js).
const marqueTailleM = (r) => morceauxMarqueTaille(r, (t) => tr('vv.taille', { t }));
const marqueTaille = (r) => joint(...marqueTailleM(r));

// La date limite en mots : LUE ⇒ « avant le 22 nov. · dans 3 j » ; ESTIMÉE ⇒ « vers le 22 nov. » (jamais « en retard », §5).
function texteEcheance(e) {
  if (!e) return '';
  if (e.code !== 'date') return e.texte;
  if (e.sorte === 'estimee') return tr('v2v.versLe', { date: e.texte });
  return joint(tr('vv.ech.avantLe', { date: e.texte }), e.dans ? tr('vv.ech.dans', { n: e.dans }) : '');
}
const textePlace = (p) => (p ? tr('vv.ou.court', { meuble: p.nom || tr('vv.ou.meuble'), r: p.rangee, c: p.colonne }) : '');
const texteBordereau = (b) => (b === 'imprime' ? tr('vv.bord.imprime') : b === 'attente' ? tr('v2v.sansBordereau') : '');
function texteEtape(etapes) {
  const i = (etapes || []).findIndex((e) => e.ici);
  return i < 0 ? tr('v2v.etapeAucune') : tr('vn.etape', { n: i + 1, m: etapes.length, mot: tr('vv.route.' + etapes[i].cle) });
}

// (20 nov., Julien sur sa capture de Ventes à l'ordinateur : « fais comme Vintex et comme l'extension avec les transporteurs »)
// LE TRANSPORTEUR d'une rangée : son LOGO (src/transporteursVisuels.js, le même que le panneau « Commandes » de l'extension)
// et son nom ; pas su ⇒ rien (le tableau écrit « — »), jamais une marque devinée.
const logoTr = (r, taille = 24) => (r && r.transporteurCle ? <LogoTransporteur cle={r.transporteurCle} taille={taille}/> : null);
// L'ÉTIQUETTE d'état (« À expédier » ambre ; « En route », « Livrée », « Terminée » neutres) — `statutRangee`, aucune règle neuve.
const MOT_STATUT = { envoyer: 'vt.expedier', route: 'tableau.vente.route', livree: 'vt.livree', terminee: 'tableau.vente.terminee' };
const motStatut = (r) => tr(MOT_STATUT[statutRangee(r)] || 'tableau.vente.route');
// (20 nov., « corrige le défaut visuel ») Un colis SANS bordereau n'a pas de rond (rien ne se coche) : sa raison est dite à la
// dans la méta (« N° 40 · sans bordereau · vers le 23 nov. », qui passe à la ligne plutôt que d'être coupée).
const sansBordereau = (r) => r.bordereau === 'attente' && !(r.coche && r.coche.possible);
const etiquetteTel = (r) => <Pastille ton={statutRangee(r) === 'envoyer' ? 'ambre' : 'neutre'}>{motStatut(r)}</Pastille>;
// La date limite COURTE de la rangée (« avant le 25 nov. », « vers le 23 nov. ») : le « dans N j » reste dans la fiche.
const echeanceCourte = (e) => (!e ? '' : e.code !== 'date' ? e.texte : e.sorte === 'estimee' ? tr('v2v.versLe', { date: e.texte }) : tr('vv.ech.avantLe', { date: e.texte }));
// (21 nov., « comme la page Commandes de Vintex », version empilée) Au téléphone, la ligne SOUS le titre : le prix (gras), l'étiquette
// d'état, le logo du transporteur, la date limite — le titre garde toute la largeur (jamais coupé à 20 caractères).
const ligneTel = (r, fin) => <span className="n-vt-valeur n-vt-ligne" data-vt-ligne="">{r.prix ? <span className="n-vt-ligne-prix" data-vt-prix="">{r.prix}</span> : null}{etiquetteTel(r)}{logoTel(r)}{fin ? <span className="n-vt-ligne-fin">{fin}</span> : null}</span>;
const piedAchat = (r, Icon) => (r.achat ? <GestesAchat a={{ ...r.achat, titre: r.achat.titre || r.titre }} Icon={Icon} court replie/> : null);
// (20 nov. soir, plus de sélecteur de plateforme) Le logo du SITE de la vente, devant le N° (au téléphone comme dans le volet).
const avecSite = (r, plaque) => (r && r.site ? <>{<LogoSite site={r.site} taille={20}/>}{plaque}</> : plaque);
const logoTel = (r) => (r.transporteurCle ? <span className="n-vt-logo" data-vt-transporteur={r.transporteurCle} title={r.transporteur || ''}>{logoTr(r, 22)}</span> : null);

function RangeeColis({ r, g, Icon, Photo, choisie, onOuvrir }) {
  const ech = echeanceCourte(r.echeance);
  const actions = [
    r.gestes.depose ? { cle: 'depose', libelle: tr('vn.b.depose'), ton: 'neutre', icone: <Icon name="check" size={20}/>, onClick: r.gestes.depose } : null,
    r.gestes.imprimer ? { cle: 'imprimer', libelle: tr('vn.b.imprimer'), icone: <Icon name="printer" size={20}/>, onClick: () => r.gestes.imprimer(), franc: true } : null,
  ].filter(Boolean);
  return (
    <Rangee
      // (21 nov., ventes-lisibles) Vignette de 64, le titre ENTIER sur toute la largeur (deux lignes), « Marque · T42 » et le N°
      // dessous, puis le prix, l'étiquette, le transporteur et la date limite ; les gestes de l'achat au pied (hors du bouton).
      vignette={vignette(r, Photo, 64)}
      titre={r.titre} lignes={2}
      plaque={avecSite(r, r.num ? <Plaque numero={r.num} doublon={r.numDouble}/> : null)}
      // (21 nov., 2e passe) Dense : la date limite rejoint la ligne du N° (chaque morceau reste entier, la ligne passe à la ligne
      // seulement s'il le faut) ; dessous, prix · étiquette · transporteur ; au pied, l'achat.
      sousTitre={morceaux(!r.num && r.numAttendu ? tr('vn.numAttente') : '', ...marqueTailleM(r), sansBordereau(r) ? tr('vt.sansBordMeta') : '',
        ech ? <span className="n-vt-limite" data-vt-limite-rangee="" data-vt-ambre={r.echeance && r.echeance.ambre ? '1' : undefined}>{ech}</span> : '')} sousLignes={2}
      note={ligneTel(r, null)}
      pied={piedAchat(r, Icon)}
      selection={{ cochee: r.coche.on, indisponible: !r.coche.possible, libelle: tr(r.coche.possible ? 'vv.coche.label' : 'vv.coche.sansBordereau', { titre: r.titre }),
        onChange: () => g.basculer(r.coche.cle), attrs: { 'data-vn-coche': r.cle } }}
      // Pas de chevron : la rangée entière s'ouvre (comme une liste en mode choix) ; le titre garde ses deux lignes entières.
      className={sansBordereau(r) ? 'n-vt-rang n-vt-sans-case' : 'n-vt-rang'}
      selectionnee={choisie} fin={null} onClick={() => onOuvrir(r.cle)} actions={actions.length ? actions : null}
      attrs={{ 'data-vn-rang': r.cle, 'data-vn-bordereau': r.bordereau || '', 'data-vn-limite': r.echeance ? r.echeance.sorte : '', 'data-vn-limite-code': r.echeance ? r.echeance.code : '',
        'data-vn-num': r.num, 'data-vn-place': r.place ? `${r.place.nom || ''}|${r.place.rangee}|${r.place.colonne}` : '', 'data-vn-coche-on': r.coche.on ? '1' : '0', 'data-vn-prix': r.prix }}
    />
  );
}

function RangeeRoute({ r, Icon, Photo, choisie, onOuvrir }) {
  return (
    <Rangee
      vignette={vignette(r, Photo, 64)}
      titre={r.titre} lignes={2}
      plaque={avecSite(r, r.num ? <Plaque numero={r.num}/> : null)}
      sousTitre={morceaux(...marqueTailleM(r), texteEtape(r.etapes))} sousLignes={2}
      ton={r.etat.ambre ? 'ambre' : 'neutre'}
      note={ligneTel(r, null)}
      pied={piedAchat(r, Icon)}
      selectionnee={choisie} fin="chevron" onClick={() => onOuvrir(r.cle)}
      actions={r.lienSuivi ? [{ cle: 'suivre', libelle: tr('vn.b.suivre'), icone: <Icon name="truck" size={20}/>, onClick: () => { try { window.open(r.lienSuivi, '_blank', 'noopener'); } catch (_) {} }, franc: true }] : null}
      className="n-vt-rang" attrs={{ 'data-vn-route': r.cle, 'data-vn-num': r.num, 'data-vn-etape': String((r.etapes || []).filter((e) => e.fait).length) }}
    />
  );
}

// LE DÉTAIL D'UNE VENTE (la fiche poussée ; à l'ordinateur, le volet de détail) : les faits, les étapes prouvées, les gestes en rangées.
function DetailVente({ r, g, Icon, Logo, Photo, Generer }) {
  if (!r) return null;
  const d = r.detail || {};
  const route = Array.isArray(r.etapes);
  const G = r.gestes || {};
  const etapes = route ? r.etapes.map((e) => ({ cle: e.cle, fait: e.fait, ici: e.ici, libelle: tr('vv.route.' + e.cle), valeur: '' }))
    // (20 nov., décision « 4 oui ») L'étape du dépôt se dit « Déposé » (un FAIT, coché quand le suivi le constate), jamais
    // « À déposer · à faire » : aucun geste de dépôt n'est demandé.
    : (d.etapes || []).map((e) => ({ cle: e.cle, fait: e.fait, ici: e.ici, geste: false, libelle: tr(e.cle === 'adeposer' ? 'vv.route.depose' : 'vv.fiche.' + e.cle),
      valeur: e.cle === 'vendue' ? d.quand : e.cle === 'bordereau' ? d.bordereau : e.cle === 'adeposer' ? texteEcheance(r.echeance) : e.cle === 'versement' && d.versement === 'vinted' ? tr('vv.fiche.versementVinted') : '' }));
  return (
    <>
      <Groupe>
        <Rangee vignette={vignette(r, Photo)} titre={r.titre} lignes={2} plaque={r.num ? <Plaque numero={r.num} doublon={r.numDouble}/> : null}
          sousTitre={joint(r.taille ? tr('vv.taille', { t: r.taille }) : '', r.compte, r.site !== 'vinted' && Logo ? Logo.nom(r.site) : '')} attrs={{ 'data-vn-detail-tete': r.cle }}/>
        <Faits colonnes={2}>
          <Fait libelle={tr('vv.fiche.vendu')} valeur={(route ? r.prix : d.vendu) || null}/>
          <Fait libelle={tr('vv.fiche.pourToi')} valeur={(route ? (r.pourToi ? r.prix : '') : d.pourToi) || null} detail={!route && d.sansFrais ? tr('vv.fiche.sansFrais') : ''}/>
          {!route ? <Fait libelle={tr('vv.col.limite')} valeur={texteEcheance(r.echeance) || null} ton={r.echeance && r.echeance.ambre ? 'ambre' : 'neutre'} detail={r.echeance && r.echeance.sorte === 'estimee' ? tr('vv.ech.estimee') : ''}/> : null}
          {!route ? <Fait libelle={tr('vv.col.ou')} valeur={textePlace(r.place) || null}/> : null}
          <Fait libelle={tr('vv.col.transport')} valeur={r.transporteur || null} detail={route ? r.suivi : texteBordereau(r.bordereau)}/>
          <Fait libelle={tr('vn.f.acheteur')} valeur={r.acheteur || null}/>
        </Faits>
      </Groupe>
      {(r.notes || []).length ? <Groupe>{r.notes.map((n) => <Rangee key={n.cle} titre={n.texte} lignes={2} ton="ambre" attrs={{ 'data-vn-note': n.cle }}/>)}</Groupe> : null}
      {/* (24 nov., lot suivi-ventes) Un colis vendu PARTI : la piste de l'envoi (dessinée par l'app, `g.parcours`) remplace les étapes. */}
      {r.envoi && g && g.parcours ? <Groupe nu attrs={{ 'data-vn-parcours': r.cle }}>{g.parcours(r)}</Groupe>
      : etapes.length ? <Groupe titre={tr('vv.route.etapes')} attrs={{ 'data-vn-etapes': r.cle }}>
        {etapes.map((e) => <Rangee key={e.cle} titre={e.libelle} valeur={e.valeur || null} fin={e.fait ? 'coche' : null} sousTitre={!e.fait && e.geste ? tr('vn.aFaire') : ''} ton={e.geste ? 'ambre' : 'neutre'}
          attrs={{ 'data-etape': e.cle, 'data-fait': e.fait ? '1' : '0' }}/>)}
      </Groupe> : null}
      <Groupe attrs={{ 'data-vn-gestes': r.cle }}>
        {r.achat ? <Rangee icone={<Icon name="relier" size={22}/>} titre={r.achat.relie ? tr('vt.achatRelie', { prix: r.achat.prix || '—' }) : tr('vt.relier')} fin="chevron"
          onClick={r.achat.ouvrir} attrs={{ 'data-vn-geste': 'relier-achat', 'data-vt-relier': r.achat.relie ? 'relie' : 'libre' }}/> : null}
        {G.imprimer ? <Rangee icone={<Icon name="printer" size={22}/>} titre={tr(G.facture ? 'vn.g.imprimerFacture' : 'vn.g.imprimer')} onClick={(ev) => G.imprimer(ev)} attrs={{ 'data-vn-geste': 'imprimer' }}/> : null}
        {G.lien ? <Rangee icone={<Icon name="printer" size={22}/>} titre={tr('vn.g.lien.' + G.lien.sorte)} href={G.lien.url} fin="chevron" attrs={{ 'data-vn-geste': 'lien' }}/> : null}
        {G.depose ? <Rangee icone={<Icon name="check" size={22}/>} titre={tr(r.depose ? 'vv.volet.pasDepose' : 'vn.g.depose')} onClick={G.depose} attrs={{ 'data-vn-geste': 'depose' }}/> : null}
        {G.pasDepose ? <Rangee icone={<Icon name="undo" size={22}/>} titre={tr('vv.volet.pasDepose')} onClick={G.pasDepose} attrs={{ 'data-vn-geste': 'pas-depose' }}/> : null}
        {r.lienSuivi || G.suivre ? <Rangee icone={<Icon name="truck" size={22}/>} titre={tr('vv.volet.suivre')} href={r.lienSuivi || G.suivre} fin="chevron" attrs={{ 'data-vn-geste': 'suivre' }}/> : null}
        {G.sortir ? <Rangee icone={<Icon name="home" size={22}/>} titre={tr('vv.fiche.jeLaiSortie')} onClick={G.sortir} attrs={{ 'data-vn-geste': 'sortir' }}/> : null}
        {G.marquerImprime ? <Rangee icone={<Icon name="doc" size={22}/>} titre={tr(G.imprimeMarque ? 'vn.g.demarquer' : 'vn.g.marquerImprime')} onClick={G.marquerImprime} attrs={{ 'data-vn-geste': 'marquer-imprime' }}/> : null}
        {G.jaiLePdf ? <Rangee icone={<Icon name="doc" size={22}/>} titre={tr('vn.g.jaiLePdf')} onClick={G.jaiLePdf} attrs={{ 'data-vn-geste': 'pdf' }}/> : null}
        {G.relier ? <Rangee icone={<Icon name="link" size={22}/>} titre={tr('vn.g.relier')} onClick={G.relier} attrs={{ 'data-vn-geste': 'relier' }}/> : null}
        {G.poserNum ? <Rangee icone={<Icon name="tag" size={22}/>} titre={tr('vn.g.poserNum')} onClick={G.poserNum} attrs={{ 'data-vn-geste': 'poser-num' }}/> : null}
        {r.fiche && g.fiche ? <Rangee icone={<Icon name="info" size={22}/>} titre={tr('vn.g.fiche')} fin="chevron" onClick={() => g.fiche(r)} attrs={{ 'data-vn-geste': 'fiche' }}/> : null}
        {G.masquer ? <Rangee icone={<Icon name="eyeOff" size={22}/>} titre={tr('vn.g.masquer')} onClick={G.masquer} attrs={{ 'data-vn-geste': 'masquer' }}/> : null}
      </Groupe>
      {G.generer && Generer ? <Groupe nu attrs={{ 'data-vn-generer': r.cle }}><Generer {...G.generer}/></Groupe> : null}
    </>
  );
}


// ── (20 nov.) VENTES À L'ORDINATEUR, EN TABLEAU DE TRAVAIL (NATIF.md §2 bis) ─────────────────────────────────────────────
// Julien, sur sa capture (Edge ~1500 px : liste étroite au centre, en-tête « AU MOINS 10 À ENVOYER · … · 1 À DÉPOSER »,
// « Imprimer » pâle désactivé, grand volet vide) : « j'aime pas ça du tout, je veux que tu fasses comme Vintex et comme
// l'extension avec les transporteurs ». La référence : la page « Commandes » du panneau de l'extension 5.410 (barre d'outils,
// tableau pleine largeur, transporteur en logo, statut en étiquette). Les MÊMES rangées-objets (`m`, src/ventes/modeleVentes.js),
// les mêmes gestes (`g`) : aucun chiffre ne change, c'est la disposition. Le détail ne s'ouvre à droite QUE sur le toucher d'une
// vente (plus de volet vide permanent). Plus de phrase-en-tête : les compteurs sont dans « Statut ▾ » et en tête de colonne.
// « Imprimer N bordereaux » vit dans la barre d'outils, montré seulement quand des bordereaux partent. Jamais « à déposer ».
const dateCourte = (ms) => { if (ms == null) return null; try { return new Date(ms).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch (_) { return null; } };
const STATUTS_ENVOYER = ['pret', 'attente', 'imprime', 'site'];
const statutEnvoyer = (r) => (r.bordereau === 'pret' || r.bordereau === 'attente' || r.bordereau === 'imprime' ? r.bordereau : 'site');
const rangLimite = (e) => (!e ? null : e.ambre ? 0 : e.sorte === 'lue' ? 1 : 2);

function VentesBureau({ m, g, Icon, Logo, Photo, Generer, segment, avant, avantRoute, apresListe, filtre, onOutils }) {
  const [choisie, setChoisie] = React.useState(null);
  const [majLe, setMajLe] = React.useState(undefined);
  // (20 nov. soir) Un filtre « Site » DISCRET, dans le menu de filtres du tableau (pas de barre) ; « Tous » par défaut.
  const [siteF, setSiteF] = React.useState('toutes');
  const E = m.envoyer, R = m.route;
  const surEnvoyer = m.onglet === 'envoyer';
  React.useEffect(() => { setChoisie(null); }, [m.onglet]);
  const rangs = surEnvoyer ? E.rangs : R ? R.rangs : [];
  const lu = surEnvoyer ? (E.lu || E.rangs.length > 0) : !!(R && R.lu);
  const erreur = surEnvoyer ? (E.erreur && !E.rangs.length) : !!(R && R.erreur && !R.lu);
  const ouverte = rangChoisi(rangs, choisie);
  // La fraîcheur : l'heure où la liste montrée a été lue ici (« pas su » si la lecture a échoué) ; ⟳ relance la lecture EXISTANTE.
  React.useEffect(() => { if (erreur) setMajLe(null); else if (lu) setMajLe(Date.now()); }, [lu, erreur, rangs]);
  React.useEffect(() => {
    if (!ouverte) return undefined;
    const f = (e) => { if (e.key === 'Escape' && !e.defaultPrevented) setChoisie(null); };
    window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f);
  }, [ouverte]);
  // UNE vérité : une lecture ratée sans rien de lu ⇒ « pas su » (jamais « Mis à jour à l'instant » + « Rien à envoyer »).
  const sitesVus = [...new Set(rangs.map((r) => r.site).filter(Boolean))];
  const rangsVus = siteF === 'toutes' ? rangs : rangs.filter((r) => r.site === siteF);
  const filtresSite = sitesVus.length > 1 ? [{ cle: 'site', libelle: tr('tableau.col.site'), valeur: siteF, onChange: setSiteF,
    options: [{ cle: 'toutes', libelle: tr('tableau.site.tous') }, ...sitesVus.map((x) => ({ cle: x, libelle: Logo && Logo.nom ? Logo.nom(x) : x, n: rangs.filter((r) => r.site === x).length }))] }] : [];
  // (23 nov., style-clarte-5 — §7 « une même phrase sur chaque ligne est UNE phrase ») L'état d'envoi (« Bordereau prêt »…) n'est
  // écrit sur la rangée que s'il ne vaut PAS pour toutes les rangées montrées ; sinon il est dit une fois, à côté du nombre.
  const sousDe = (r) => { const st = surEnvoyer ? statutEnvoyer(r) : statutRangee(r); return surEnvoyer ? (st === 'site' ? '' : tr('vt.st.' + st)) : (r.etat && r.etat.texte) || ''; };
  // L'état le PLUS FRÉQUENT (au moins deux rangées) se tait sur les rangées et se dit une fois en tête (« 24 · bordereau prêt ») ;
  // seules les rangées qui en diffèrent gardent le leur — on lit l'exception, pas la règle répétée.
  const compteSous = new Map(); for (const r of rangsVus) { const x = sousDe(r); if (x) compteSous.set(x, (compteSous.get(x) || 0) + 1); }
  const [sousCommun, nCommun] = [...compteSous.entries()].sort((a, b) => b[1] - a[1])[0] || ['', 0];
  const lignes = erreur ? null : !lu ? undefined : rangsVus.map((r) => {
    const st = surEnvoyer ? statutEnvoyer(r) : statutRangee(r);
    const sousR = sousDe(r);
    const sous = sousCommun && nCommun >= 2 && sousR === sousCommun ? '' : sousR;
    return { cle: r.cle, r, titre: r.titre, photo: r.photo || '', image: r.photo && Photo ? <Photo src={r.photo} alt="" loading="lazy" decoding="async"/> : null,
      sous: joint(marqueTaille(r), sous), statut: st, statutLibelle: motStatut(r), nonCochable: !(r.coche && r.coche.possible), num: r.num, prix: r.prix, t: r.t, prixGrille: r.prix,
      texte: [r.titre, r.num ? 'n' + r.num + ' n°' + r.num + ' ' + r.num : '', r.taille, r.acheteur, r.compte, r.transporteur, r.suivi, sousR].filter(Boolean).join(' '),
      attrs: surEnvoyer
        ? { 'data-vn-rang': r.cle, 'data-vn-bordereau': r.bordereau || '', 'data-vn-limite': r.echeance ? r.echeance.sorte : '', 'data-vn-limite-code': r.echeance ? r.echeance.code : '', 'data-vn-num': r.num, 'data-vn-prix': r.prix, 'data-vt-site': r.site, 'data-vt-statut': 'envoyer', 'data-vt-transporteur': r.transporteurCle || '' }
        : { 'data-vt-site': r.site, 'data-vn-route': r.cle, 'data-vn-num': r.num, 'data-vn-etape': String((r.etapes || []).filter((e) => e.fait).length), 'data-vt-statut': st, 'data-vt-transporteur': r.transporteurCle || '' } };
  });
  const presses = surEnvoyer ? rangs.filter((r) => r.echeance && r.echeance.ambre).length : 0;
  const nAVerifier = surEnvoyer ? rangsVus.filter((r) => r.echeance && r.echeance.code === 'estimee-depassee').length : 0;
  const aVerifierPartout = nAVerifier >= 2;
  const colonnes = [
    // (20 nov. soir) Tout est mélangé : une colonne « Site » ÉTROITE, le logo seul (le nom au survol).
    { cle: 'site', libelle: tr('tableau.col.site'), titreCourt: true, tri: (l) => l.r.site || null, rendu: (l) => (l.r.site ? <LogoSite site={l.r.site} taille={18} nom={Logo && Logo.nom ? Logo.nom(l.r.site) : l.r.site}/> : null) },
    // (20 nov., Julien : « il y a la place pour mettre le bouton relier ») L'ACHAT : le bouton-icône « Relier » (les deux maillons) ouvre
    // l'atelier sur CETTE vente ; reliée : les maillons en gris et le prix d'achat. Hors Vinted : « — ». Jamais relié tout seul (§5).
    { cle: 'achat', libelle: tr('vt.col.achat'), tri: (l) => (l.r.achat ? (l.r.achat.relie ? 1 : 0) : null), rendu: (l) => celluleAchat(l.r.achat ? { ...l.r.achat, titre: l.r.achat.titre || l.r.titre } : null, Icon) },
    { cle: 'numero', libelle: tr('egalite.col.numero'), tri: (l) => l.num || null, rendu: (l) => (l.num ? <Plaque numero={l.num} doublon={l.r.numDouble}/> : null) },
    { cle: 'prix', libelle: tr('egalite.col.prix'), num: true, tri: (l) => { const n = parseFloat(String(l.prix || '').replace(/[^\d,.-]/g, '').replace(',', '.')); return Number.isFinite(n) ? n : null; }, rendu: (l) => l.prix || null },
    // (20 nov.) Tableau étroit (1280 px, Site + Achat en plus) : la date de vente se replie (src/natif/tableau.css, requête de conteneur)
    // pour que le titre garde ≥ 200 px ; la date LIMITE reste.
    { cle: 'date', libelle: tr('tableau.col.date'), num: true, tri: (l) => l.t, rendu: (l) => dateCourte(l.t) },
    // (23 nov.) Une colonne vide sur TOUTES les rangées montrées (aucun transporteur lu) ne se montre pas (`replieVide`).
    { cle: 'transporteur', libelle: tr('tableau.col.transporteur'), replieVide: true, tri: (l) => l.r.transporteur || null,
      rendu: (l) => (l.r.transporteur ? <span className="n-tt-transporteur" data-transporteur={l.r.transporteurCle || ''}>{logoTr(l.r)}<span>{l.r.transporteur}</span></span> : null) },
    { cle: 'statut', libelle: tr('tableau.col.statut'), tri: (l) => l.statut },
    ...(surEnvoyer ? [{ cle: 'limite', apresStatut: true, libelle: tr('vt.col.limite'), titreCourt: presses > 0 ? tr('vt.col.limiteN', { n: presses }) : '', tri: (l) => rangLimite(l.r.echeance),
      // (23 nov.) « à vérifier » (aucune date lue) répété sur chaque rangée ne disait rien : la case reste vide (« — » du tableau) et
      // l'en-tête dit combien sont à vérifier ; une date lue ou estimée s'écrit comme avant.
      rendu: (l) => { const e = l.r.echeance; const t = e && e.code === 'estimee-depassee' && aVerifierPartout ? '' : texteEcheance(e); return t ? <span className="n-vt-limite" data-vt-ambre={e.ambre ? '1' : undefined}>{t}</span> : null; } }] : []),
  ];
  const statuts = surEnvoyer
    ? STATUTS_ENVOYER.map((c) => ({ cle: c, libelle: tr('vt.st.' + c), ton: 'ambre' }))
    : ['route', 'livree', 'terminee'].map((c) => ({ cle: c, libelle: tr(MOT_STATUT[c]), ton: 'neutre' }));
  const P = E.plein;
  // LES CASES = LE LOT D'IMPRESSION (la règle d'avant : `cochesEffectives`, cochées d'office là où le bordereau est prêt, jamais
  // sans bordereau) ; « Imprimer N bordereaux » de la barre d'outils imprime CES cases (N = le plein d'avant, `pleinImprimer`).
  const coches = React.useMemo(() => new Set(rangs.filter((r) => r.coche && r.coche.on).map((r) => r.cle)), [rangs]);
  const cocher = (cles, on) => { const k = new Set(cles); for (const r of rangs) if (k.has(r.cle) && r.coche && r.coche.possible && !!r.coche.on !== !!on) g.basculer(r.coche.cle); };
  const outilsPlus = surEnvoyer ? <>
    {P.n > 0 || P.occupe ? <Bouton variante="plein" ajuste icone={<Icon name="printer" size={18}/>} chargement={P.occupe} onClick={g.imprimer}
      attrs={{ 'data-vn-plein': String(P.n), 'data-colis-barre-btn': 'imprimer', 'data-imprimer-prets': P.nVentes, 'data-impr-lot': P.nVentes, 'data-impr-retours-coches': P.nRetours }}>{tr('vt.imprimerN', { n: P.n })}</Bouton> : null}
    {filtre}
    <BoutonIcone libelle={tr('vt.outils')} icone={<Icon name="more" size={20}/>} onClick={onOutils} attrs={{ 'data-vn-plus': '' }}/>
  </> : filtre;
  const unite = (n) => [m.auMoins && surEnvoyer && n === rangs.length ? tr('vt.auMoins', { n }) : tr('tableau.ventes', { n }),
    sousCommun && nCommun >= 2 && rangsVus.length === n ? (nCommun === n ? tr('vt.tous', { etat: sousCommun.toLowerCase() }) : tr('vt.nEtat', { n: nCommun, etat: sousCommun.toLowerCase() })) : '',
    aVerifierPartout ? tr('vt.limitesAVerifier', { n: nAVerifier }) : ''].filter(Boolean).join(' · ');
  const retours = surEnvoyer && E.retours.length ? <Groupe titre={tr('vn.retours')} attrs={{ 'data-vn-retours': String(E.retours.length) }}>
    {E.retours.map((l) => <Rangee key={l.cle} titre={l.titre || tr('retours.article')} plaque={l.num ? <Plaque numero={l.num}/> : null} sousTitre={l.vendeur ? tr('impr.retour.vendeur', { qui: l.vendeur }) : ''}
      selection={{ cochee: l.on, libelle: tr('impr.retour.caseAria', { qui: l.num ? tr('retours.numero', { n: l.num }) : (l.titre || tr('retours.article')) }), onChange: () => g.basculerRetour(l.cle), attrs: { 'data-retour-coche': l.cle } }}
      attrs={{ 'data-lot-retour': l.tx }}/>)}
  </Groupe> : null;
  return (
    <div className="n-vt" data-vt={m.onglet} data-vt-detail={ouverte ? '1' : '0'}>
      <TableauTravail key={m.onglet} id={'ventes-' + m.onglet} titre={tr('vn.titre')} cases={surEnvoyer} coches={surEnvoyer ? coches : null} onCocher={surEnvoyer ? cocher : null} majLe={majLe} onRafraichir={() => { setMajLe(undefined); try { window.dispatchEvent(new Event('vrm:relire-coque')); } catch (_) {} }} lignes={lignes} filtres={filtresSite} statuts={statuts} colonnes={colonnes}
        onOuvrir={(l) => setChoisie((c) => (c === l.cle ? null : l.cle))} ligneChoisie={ouverte ? ouverte.cle : ''}
        menuLigne={(l) => [{ cle: 'ouvrir', libelle: tr('tableau.ouvrirVente'), onClick: () => setChoisie(l.cle) },
          ...(l.r.lienSuivi ? [{ cle: 'suivre', libelle: tr('vv.volet.suivre'), onClick: () => { try { window.open(l.r.lienSuivi, '_blank', 'noopener'); } catch (_) {} } }] : [])]}
        unite={unite} placeholder={tr('vt.chercher')} avantOutils={segment} haut={<>{avant}{surEnvoyer ? null : avantRoute}</>} outilsPlus={outilsPlus}
        pied={surEnvoyer && E.bordsPasSu ? tr('vt.bordsPasSu') : ''} grille={false}
        vide={tr(surEnvoyer ? 'v2v.vide.envoyer' : 'v2v.vide.route')} pasSu={tr('v2v.erreur')} Icon={Icon} iconeVide={surEnvoyer ? 'box' : 'truck'}
        actionPasSu={g.relire ? <Bouton variante="texte" onClick={g.relire} attrs={{ 'data-vt-reessayer': '' }}>{tr('commun.reessayer')}</Bouton> : null}
        enfants={<>{retours}{surEnvoyer ? apresListe : null}</>} attrs={{ 'data-vn': 'ventes', 'data-vn-onglet': m.onglet, 'data-vn-liste': surEnvoyer ? 'envoyer' : 'route', 'data-vn-n': String(rangs.length), 'data-vn-affiche': surEnvoyer && m.nEnv != null ? String(m.nEnv) : '' }}/>
      {/* (22 nov., bugs-totale) Le volet du détail se ferme au geste « retour » (← du navigateur, glisser du trackpad) comme une
          feuille : avant, le retour quittait Ventes pour l'écran d'avant, volet ouvert. Une entrée pour tout le temps où un détail
          est montré (passer d'une vente à l'autre n'en ajoute pas). */}
      {ouverte ? <FermeAuRetourUi fermer={() => setChoisie(null)}/> : null}
      {ouverte ? <aside className="n-vt-volet" data-vn-detail={ouverte.cle} aria-label={ouverte.num ? tr('natif.plaque.prefixe') + ' ' + ouverte.num : tr('vn.detail')}>
        <div className="n-vt-volet-tete">
          <span className="n-vt-volet-titre">{ouverte.num ? tr('natif.plaque.prefixe') + ' ' + ouverte.num : tr('vn.detail')}</span>
          <BoutonIcone libelle={tr('vt.fermer')} icone={<Icon name="close" size={20}/>} onClick={() => setChoisie(null)} attrs={{ 'data-vt-fermer': '' }}/>
        </div>
        <div className="n-vt-volet-corps"><DetailVente r={ouverte} g={g} Icon={Icon} Logo={Logo} Photo={Photo} Generer={Generer}/></div>
      </aside> : null}
    </div>
  );
}

export default function VentesNatif({ m, g, Icon, Logo = null, Photo = null, Generer = null, plateforme = null, avantRoute = null, apresListe = null, avant = null, relances = null, nRetoursAvant = 0, children = null }) {
  if (!iconePosee()) poserIcone(Icon);
  const [q, setQ] = React.useState('');
  const [choisie, setChoisie] = React.useState(null);
  const [feuillePlateforme, setFeuillePlateforme] = React.useState(false);
  const [feuilleGestes, setFeuilleGestes] = React.useState(false);
  const [seulSans, setSeulSans] = React.useState(false);   // (23 nov.) « N sans bordereau » filtre la liste
  const [feuilleAvant, setFeuilleAvant] = React.useState(false);
  const ordinateur = useOrdinateur();
  // Combien « À régler » en a pour Ventes : la MÊME publication et la même règle que le bloc (src/designV2/aRegler.js `groupesDe`).
  const pubRegler = useARegler();
  const nRegler = React.useMemo(() => { try { return pubRegler && pubRegler.groupes ? groupesDe('ventes', pubRegler.groupes, { completer: atelierCompleter() }).length : 0; } catch (_) { return 0; } }, [pubRegler]);
  const presseRegler = React.useMemo(() => { try { return !!(pubRegler && pubRegler.groupes && groupesDe('ventes', pubRegler.groupes, { completer: atelierCompleter() }).some((x) => x.ambre)); } catch (_) { return false; } }, [pubRegler]);
  const E = m.envoyer, R = m.route;
  const fg = (f) => () => { setFeuilleGestes(false); if (f) f(); };
  const surEnvoyer = m.onglet === 'envoyer', surRoute = m.onglet === 'envoyes';
  React.useEffect(() => { setChoisie(null); }, [m.onglet]);
  const rangs = surEnvoyer ? filtrerRangs(E.rangs, q) : surRoute && R ? filtrerRangs(R.rangs, q) : [];
  const ouverte = rangChoisi(surEnvoyer ? E.rangs : surRoute && R ? R.rangs : [], choisie);
  // À l'ordinateur, la coque pose le volet de détail à droite (ContexteCoque.voletDetail) : sans vente touchée, il dit
  // quoi faire (l'état vide dessiné du contrat, §2) au lieu de rester blanc.
  const coque = React.useContext(ContexteCoque);
  const volet = !!(coque && coque.voletDetail);
  const P = E.plein;
  // (21 nov., capture iPhone de Julien : « Imprimer · Coche un colis pour l'imprimer » toujours là, sans rien de coché) Le plein
  // n'apparaît qu'avec une sélection (N > 0) ou pendant l'impression — comme à l'ordinateur.
  const plein = surEnvoyer && (P.n > 0 || P.occupe)
    ? <Bouton variante="plein" icone={<Icon name="printer" size={20}/>} chargement={P.occupe} indisponible={!P.dispo && !P.occupe}
        raison={P.raison ? tr('vn.plein.' + P.raison) : ''} onClick={g.imprimer}
        attrs={{ 'data-vn-plein': String(P.n), 'data-colis-barre-btn': 'imprimer', 'data-imprimer-prets': P.nVentes, 'data-impr-lot': P.nVentes, 'data-impr-retours-coches': P.nRetours }}>
        {P.n > 0 ? tr('vt.imprimerN', { n: P.n }) : tr('v2v.imprimer')}
      </Bouton>
    : null;
  // Les retours à imprimer (étiquettes retour) : des rangées de la MÊME liste, cochables, sans titre de groupe à elles.
  const retoursTel = E.retours.length ? E.retours.map((l) => <Rangee key={l.cle} icone={<Icon name="undo" size={22}/>} titre={l.titre || tr('retours.article')} plaque={l.num ? <Plaque numero={l.num}/> : null}
    sousTitre={joint(tr('vn.retourEtiquette'), l.vendeur ? tr('impr.retour.vendeur', { qui: l.vendeur }) : '')}
    selection={{ cochee: l.on, libelle: tr('impr.retour.caseAria', { qui: l.num ? tr('retours.numero', { n: l.num }) : (l.titre || tr('retours.article')) }), onChange: () => g.basculerRetour(l.cle), attrs: { 'data-retour-coche': l.cle } }}
    attrs={{ 'data-lot-retour': l.tx, 'data-vn-retours': String(E.retours.length) }}/>) : null;
  // (23 nov., revue UX P1 #5) « N sans bordereau » n'est plus un chiffre gris dans l'en-tête : une rangée ambre « À faire » qui FILTRE la
  // liste sur ces colis (le toucher suivant remet tout) ; « N cochés » reste dans l'en-tête (il vit avec le bouton d'impression).
  const ecart = joint(E.ecart.coches ? tr('vn.e.coches', { n: E.ecart.coches }) : '');   // (20 nov.) plus de « N à déposer » : le départ est constaté par le suivi (décision « 4 oui »)
  // (audit d'utilité du 19 nov.) Plus de grand chiffre : le segment porte le nombre. L'en-tête de la liste dit ce que
  // le nombre ne dit pas — ce qui part à l'impression, ce qui attend son bordereau, ce qui presse (« au moins » si le
  // compte est partiel, §5 : un total partiel ne se présente jamais comme complet).
  const teteListe = joint(m.auMoins && m.nEnv != null ? tr('vn.auMoins', { n: m.nEnv }) : '', m.presses > 0 ? tr('sv.presses.envoyer', { n: m.presses }) : '', ecart) || tr('vv.seg.expedier');
  // (audit d'utilité du 19 nov.) UN bouton « Filtrer » au lieu de la rangée des sites ; les gestes rares (Préparer mes colis,
  // Je dépose, la tournée, Emballer — décision n° 6 en attente de Julien : ils RESTENT) sont rangés derrière « ⋯ ».
  const filtre = plateforme ? <Bouton variante="texte" onClick={() => setFeuillePlateforme(true)} attrs={{ 'data-vn-plateforme': plateforme.cle }}>{plateforme.cle === 'toutes' ? tr('vn.filtrer') : plateforme.libelle}</Bouton> : null;
  const actionPlateforme = <>{filtre}{surEnvoyer || g.sections ? <BoutonIcone libelle={tr('vn.plus')} icone={<Icon name="more" size={22}/>} onClick={() => setFeuilleGestes(true)} attrs={{ 'data-vn-plus': '' }}/> : null}</>;
  const segment = <Segmente libelle={tr('vv.seg.label')} valeur={m.onglet} onChange={g.onglet}
    options={[{ cle: 'envoyer', libelle: tr('vv.seg.expedier'), n: m.nEnv || undefined }, { cle: 'envoyes', libelle: tr('vv.seg.route'), n: m.nRoute || undefined }, { cle: 'toutes', libelle: tr('vn.terminees') }]}/>;
  // (20 nov.) À l'ordinateur, « À envoyer » et « En route » sont le TABLEAU DE TRAVAIL (VentesBureau) ; « Terminées » est déjà le
  // tableau de VentesToutes (src/natif/ecrans/VentesTableau.jsx) : ici, seulement le segmenté au-dessus de lui.
  // (21 nov., ventes-lisibles — captures iPhone de Julien) Le menu « ⋯ » de Ventes porte aussi ce qui était posé SUR la liste : « Où sont
  // ces articles dans le stock » (la pilule flottante), l'historique des bordereaux déjà traités (la rangée collée bord à bord) et ce
  // qu'eBay a en plus (le groupe « EBAY » au milieu de Ventes). Les mêmes gestes, rangés ; rien n'est retiré.
  const corpsOutils = <>
    <Groupe attrs={{ 'data-vn-outils': '' }}>
        <Rangee icone={<Icon name="printer" size={22}/>} titre={tr('vv.format')} valeur={tr('impr.format.' + E.format)} fin="chevron" onClick={fg(g.format)} attrs={{ 'data-impr-format': E.format }}/>
        <Rangee icone={<Icon name="check" size={22}/>} titre={E.autres > 0 ? tr('impr.choisirAutres', { n: E.autres }) : tr('vv.choisir')} fin="chevron" onClick={fg(g.choisir)} attrs={{ 'data-lot-ouvrir': '1' }}/>
        <Rangee icone={<Icon name="scan" size={22}/>} titre={tr('sv.scanner.envoi')} fin="chevron" onClick={fg(g.scanner)} attrs={{ 'data-vn-outil': 'scanner' }}/>
        {g.stock ? <Rangee icone={<Icon name="home" size={22}/>} titre={tr(g.stock.n > 1 ? 'vn.o.stockN' : 'vn.o.stock1')} fin="chevron" onClick={fg(g.stock.ouvrir)} attrs={{ 'data-colis-stock': String(g.stock.n) }}/> : null}
        {/* (21 nov., lot relier-code) « N ventes sans achat » : la feuille « Lier à un achat », vente après vente. */}
        {g.serieRelier ? <Rangee icone={<Icon name="link" size={22}/>} titre={tr('la.serie.entree')} valeur={tr('la.serie.sansAchat', { n: g.serieRelier.n })} fin="chevron" onClick={fg(g.serieRelier.ouvrir)}
          attrs={{ 'data-vn-serie-relier': String(g.serieRelier.n) }}/> : null}
        {g.bordsFaits ? <Rangee icone={<Icon name="doc" size={22}/>} titre={tr('vn.o.bordsFaits', { n: g.bordsFaits.n })} valeur={tr(g.bordsFaits.ouvert ? 'vn.o.masquer' : 'vn.o.voir')} onClick={fg(g.bordsFaits.basculer)}
          attrs={{ 'data-bords-faits': String(g.bordsFaits.n), 'data-bords-faits-voir': '', 'aria-expanded': g.bordsFaits.ouvert ? 'true' : 'false' }}/> : null}
    </Groupe>
    {g.sections ? <Groupe titre={Logo && Logo.nom ? Logo.nom('ebay') : 'eBay'} attrs={{ 'data-tache-sections': 'ebay' }}>
      {g.sections.map((x) => <Rangee key={x.cle} titre={x.libelle} fin="chevron" onClick={fg(x.onClick)} attrs={{ 'data-tache-section-entree': x.cle }}/>)}
    </Groupe> : null}
  </>;
  const feuilles = <>
      <Feuille ouverte={feuilleGestes} onFermer={() => setFeuilleGestes(false)} titre={tr('v2v.outils.titre')} detente="moitie" detentes={['moitie', 'pleine']}>
        {corpsOutils}
      </Feuille>
      {plateforme ? <Feuille ouverte={feuillePlateforme} onFermer={() => setFeuillePlateforme(false)} titre={tr('vn.plateformes')} detente="moitie">
        <Groupe>{plateforme.options.map((o) => <Rangee key={o.cle} titre={o.libelle} fin={o.cle === plateforme.cle ? 'coche' : null} onClick={() => { setFeuillePlateforme(false); plateforme.onChoisir(o.cle); }} attrs={{ 'data-vn-plateforme-choix': o.cle }}/>)}</Groupe>
      </Feuille> : null}
  </>;
  if (ordinateur && m.onglet !== 'toutes') {
    return <>
      <VentesBureau m={m} g={g} Icon={Icon} Logo={Logo} Photo={Photo} Generer={Generer} segment={<div className="n-vt-segment">{segment}</div>} avant={avant} avantRoute={avantRoute} apresListe={apresListe}
        filtre={filtre} onOutils={() => setFeuilleGestes(true)}/>
      {children}
      {feuilles}
    </>;
  }
  // `vv-tete` : la section des colis cache tout le reste sous « Toutes » (src/design/ventes-verre.css) — le segmenté doit rester.
  // Sous « Terminées », la liste est VentesToutes (son tableau à l'ordinateur) : ici, seulement le segmenté pour revenir
  // (avant le 20 nov., la page natif de « Toutes » était cachée par cette règle : on ne revenait plus à « À envoyer »).
  if (m.onglet === 'toutes') return <><div className="vv-tete"><div className={ordinateur ? 'n-vt-segment n-vt-segment-seul' : 'n-vt-segment n-vt-segment-tel'} data-vn="ventes" data-vn-onglet="toutes">{segment}{ordinateur ? filtre : null}</div></div>{children}{feuilles}</>;
  return (
    <>
      <Page titre={tr('vn.titre')} plein={plein} attrs={{ 'data-vn': 'ventes', 'data-vn-onglet': m.onglet }}
        recherche={m.onglet !== 'toutes' ? <ChampRecherche valeur={q} onChange={setQ} placeholder={tr('v2v.rechercher')} libelle={tr('v2v.rechercher')} onScanner={g.retrouver} attrs={{ 'data-vn-champ': '' }}/> : null}>
        {/* (20 nov.) Le segmenté reste collé sous la barre de titre, sur un fond opaque : jamais caché, rien ne passe dessus. */}
        <div className="n-vn-colle" data-vn-colle="">{segment}</div>
        {/* (21 nov., capture iPhone de Julien : « À RÉGLER · 2 », « RETOURS ET LITIGES · 10 », « RETOURS À IMPRIMER » en titres empilés)
            Au téléphone : UNE ligne d'accès discrète, qui ouvre une feuille avec « À régler » et « Retours et litiges » (les mêmes blocs,
            les mêmes gestes, ouverts). Les retours à IMPRIMER rejoignent la liste des colis (ils partent avec le même plein). */}
        {avant && (nRegler > 0 || nRetoursAvant > 0) ? <><Groupe attrs={{ 'data-vn-acces': '' }}><Rangee icone={<Icon name="check" size={22}/>} titre={tr('vn.acces.titre')} ton={presseRegler ? 'ambre' : 'neutre'}
            sousTitre={joint(nRegler > 0 ? tr('vn.acces.regler', { n: nRegler }) : '', nRetoursAvant > 0 ? tr('vn.acces.retours', { n: nRetoursAvant }) : '')} fin="chevron" onClick={() => setFeuilleAvant(true)}
            attrs={{ 'data-vn-acces-ouvrir': '', 'data-vn-acces-n': String(nRegler + nRetoursAvant) }}/></Groupe>
          <Feuille ouverte={feuilleAvant} onFermer={() => setFeuilleAvant(false)} titre={tr('vn.acces.titre')} detente="pleine" attrs={{ 'data-vn-acces-feuille': '' }}>
            <div className="n-vn-acces-corps" data-vn-acces-corps="">{avant}</div>
          </Feuille></> : null}
        {surEnvoyer ? <>
          {!E.lu && !E.rangs.length ? <Attente forme="rangees" n={5} vignette={56} titre/>
            : E.erreur && !E.rangs.length ? <Vide icone={<Icon name="cloudOff" size={40}/>} phrase={tr('v2v.erreur')}
                action={g.relire ? <Bouton variante="texte" onClick={g.relire} attrs={{ 'data-vt-reessayer': '' }}>{tr('commun.reessayer')}</Bouton> : null}/>
            : !E.rangs.length ? <Vide icone={<Icon name="box" size={40}/>} phrase={tr('v2v.vide.envoyer')}/>
            : <>{E.ecart.sans > 0 ? <Groupe attrs={{ 'data-vn-sans-ligne': String(E.ecart.sans) }}>
                <Rangee icone={<Icon name="printer" size={22}/>} ton="ambre" titre={seulSans ? tr('vt.sansTout') : tr('vt.sansAFaire', { n: E.ecart.sans })} fin="chevron"
                  onClick={() => setSeulSans(!seulSans)} attrs={{ 'data-vn-sans-filtre': seulSans ? '1' : '0', 'aria-pressed': seulSans ? 'true' : 'false' }}/>
              </Groupe> : null}
              <Groupe titre={teteListe} action={actionPlateforme} attrs={{ 'data-vn-liste': 'envoyer', 'data-vn-n': String(E.rangs.length), 'data-vn-affiche': m.nEnv == null ? '' : String(m.nEnv) }}>
                <ParPaquets items={seulSans ? rangs.filter(sansBordereau) : rangs} rendre={(r) => <RangeeColis key={r.cle} r={r} g={g} Icon={Icon} Photo={Photo} choisie={!!ouverte && ouverte.cle === r.cle} onOuvrir={setChoisie}/>}/>
                {!rangs.length ? <Vide phrase={tr('v2v.vide.recherche', { q: q.trim() })}/> : null}
                {retoursTel}
              </Groupe></>}
          {!E.rangs.length && filtre ? <Groupe nu>{filtre}</Groupe> : null}
          {!E.rangs.length && E.retours.length ? <Groupe titre={tr('vn.retours')} attrs={{ 'data-vn-retours': String(E.retours.length) }}>{retoursTel}</Groupe> : null}
          {apresListe}
        </> : null}
        {surRoute ? <>
          {avantRoute}
          {!R || !R.lu ? (R && R.erreur ? <Vide icone={<Icon name="cloudOff" size={40}/>} phrase={tr('v2v.erreur')}/> : <Attente forme="rangees" n={5} vignette={56} titre/>)
            : !R.rangs.length ? <Vide icone={<Icon name="truck" size={40}/>} phrase={tr('v2v.vide.route')}/>
            : <Groupe titre={tr('vv.seg.route')} action={actionPlateforme} attrs={{ 'data-vn-liste': 'route', 'data-vn-n': String(R.rangs.length) }}>
                <ParPaquets items={rangs} rendre={(r) => <RangeeRoute key={r.cle} r={r} Icon={Icon} Photo={Photo} choisie={!!ouverte && ouverte.cle === r.cle} onOuvrir={setChoisie}/>}/>
                {!rangs.length ? <Vide phrase={tr('v2v.vide.recherche', { q: q.trim() })}/> : null}
              </Groupe>}
        </> : null}
        {m.onglet === 'toutes' && filtre ? <Groupe nu>{filtre}</Groupe> : null}
        {/* (22 nov.) « À relancer » au téléphone : son groupe à lui (replié), APRÈS la liste — il se lit à part, et posé
            au-dessus il poussait les colis vers le bas en arrivant (banc couches-chargement, décalage 0,17). */}
        {relances}
        {children}
      </Page>
      <PagePoussee ouverte={!!ouverte || (volet && m.onglet !== 'toutes')} titre={ouverte && ouverte.num ? tr('natif.plaque.prefixe') + ' ' + ouverte.num : ouverte ? tr('vn.detail') : ''} libelleRetour={tr('vn.titre')} onRetour={() => setChoisie(null)}
        attrs={{ 'data-vn-detail': ouverte ? ouverte.cle : '' }}>
        {ouverte ? <DetailVente r={ouverte} g={g} Icon={Icon} Logo={Logo} Photo={Photo} Generer={Generer}/> : <Vide icone={<Icon name="box" size={40}/>} phrase={tr('vn.detailVide')}/>}
      </PagePoussee>
      <Feuille ouverte={feuilleGestes} onFermer={() => setFeuilleGestes(false)} titre={tr('v2v.outils.titre')} detente="moitie" detentes={['moitie', 'pleine']}>
        {/* (19 nov., décision de Julien « 4 oui ») « Préparer mes colis », « Je dépose », la tournée et « Emballer » sont RETIRÉS :
            le dépôt est constaté par le suivi du transporteur (aExpedier, statut lu). Restent le format, le choix du lot, le scanner. */}
        {corpsOutils}
      </Feuille>
      {plateforme ? <Feuille ouverte={feuillePlateforme} onFermer={() => setFeuillePlateforme(false)} titre={tr('vn.plateformes')} detente="moitie">
        <Groupe>{plateforme.options.map((o) => <Rangee key={o.cle} titre={o.libelle} fin={o.cle === plateforme.cle ? 'coche' : null} onClick={() => { setFeuillePlateforme(false); plateforme.onChoisir(o.cle); }} attrs={{ 'data-vn-plateforme-choix': o.cle }}/>)}</Groupe>
      </Feuille> : null}
    </>
  );
}
