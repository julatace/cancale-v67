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
import { filtrerRangs, rangChoisi } from '../../ventes/modeleVentes.js';

const joint = (...x) => x.filter(Boolean).join(' · ');
// La photo d'une rangée : la <PhotoVinted> de l'app quand elle est passée (sans référent, relais de l'extension quand l'adresse
// Vinted a expiré — sinon le CDN refuse et la vignette restait un carré vide), sinon l'icône dessinée.
const vignette = (r, Photo) => <Vignette src={r.photo || ''} alt="" image={r.photo && Photo ? <Photo src={r.photo} alt="" loading="lazy" decoding="async"/> : null}/>;

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

function RangeeColis({ r, g, Icon, Photo, choisie, onOuvrir }) {
  const ech = texteEcheance(r.echeance);
  const actions = [
    r.gestes.depose ? { cle: 'depose', libelle: tr('vn.b.depose'), ton: 'neutre', icone: <Icon name="check" size={20}/>, onClick: r.gestes.depose } : null,
    r.gestes.imprimer ? { cle: 'imprimer', libelle: tr('vn.b.imprimer'), icone: <Icon name="printer" size={20}/>, onClick: () => r.gestes.imprimer(), franc: true } : null,
  ].filter(Boolean);
  return (
    <Rangee
      vignette={vignette(r, Photo)}
      titre={r.titre}
      plaque={r.num ? <Plaque numero={r.num} doublon={r.numDouble}/> : null}
      // La date limite d'abord (jamais coupée), puis la place, puis la taille : ce qui déborde part par la fin.
      sousTitre={joint(!r.num && r.numAttendu ? tr('vn.numAttente') : '', ech, textePlace(r.place), r.taille ? tr('vv.taille', { t: r.taille }) : '')}
      ton={r.echeance && r.echeance.ambre ? 'ambre' : 'neutre'}
      valeur={r.prix || null} valeurForte
      selection={{ cochee: r.coche.on, indisponible: !r.coche.possible, libelle: tr(r.coche.possible ? 'vv.coche.label' : 'vv.coche.sansBordereau', { titre: r.titre }),
        onChange: () => g.basculer(r.coche.cle), attrs: { 'data-vn-coche': r.cle } }}
      selectionnee={choisie} fin="chevron" onClick={() => onOuvrir(r.cle)} actions={actions.length ? actions : null}
      attrs={{ 'data-vn-rang': r.cle, 'data-vn-bordereau': r.bordereau || '', 'data-vn-limite': r.echeance ? r.echeance.sorte : '', 'data-vn-limite-code': r.echeance ? r.echeance.code : '',
        'data-vn-num': r.num, 'data-vn-place': r.place ? `${r.place.nom || ''}|${r.place.rangee}|${r.place.colonne}` : '', 'data-vn-coche-on': r.coche.on ? '1' : '0', 'data-vn-prix': r.prix }}
    />
  );
}

function RangeeRoute({ r, Icon, Photo, choisie, onOuvrir }) {
  return (
    <Rangee
      vignette={vignette(r, Photo)}
      titre={r.titre}
      plaque={r.num ? <Plaque numero={r.num}/> : null}
      sousTitre={joint(texteEtape(r.etapes), r.taille ? tr('vv.taille', { t: r.taille }) : '')}
      ton={r.etat.ambre ? 'ambre' : 'neutre'}
      valeur={r.prix || null} valeurForte
      selectionnee={choisie} fin="chevron" onClick={() => onOuvrir(r.cle)}
      actions={r.lienSuivi ? [{ cle: 'suivre', libelle: tr('vn.b.suivre'), icone: <Icon name="truck" size={20}/>, onClick: () => { try { window.open(r.lienSuivi, '_blank', 'noopener'); } catch (_) {} }, franc: true }] : null}
      attrs={{ 'data-vn-route': r.cle, 'data-vn-num': r.num, 'data-vn-etape': String((r.etapes || []).filter((e) => e.fait).length) }}
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
    : (d.etapes || []).map((e) => ({ cle: e.cle, fait: e.fait, ici: e.ici, geste: e.geste, libelle: tr('vv.fiche.' + e.cle),
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
      {etapes.length ? <Groupe titre={tr('vv.route.etapes')} attrs={{ 'data-vn-etapes': r.cle }}>
        {etapes.map((e) => <Rangee key={e.cle} titre={e.libelle} valeur={e.valeur || null} fin={e.fait ? 'coche' : null} sousTitre={!e.fait && e.geste ? tr('vn.aFaire') : ''} ton={e.geste ? 'ambre' : 'neutre'}
          attrs={{ 'data-etape': e.cle, 'data-fait': e.fait ? '1' : '0' }}/>)}
      </Groupe> : null}
      <Groupe attrs={{ 'data-vn-gestes': r.cle }}>
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

export default function VentesNatif({ m, g, Icon, Logo = null, Photo = null, Generer = null, plateforme = null, avantRoute = null, apresListe = null, children = null }) {
  if (!iconePosee()) poserIcone(Icon);
  const [q, setQ] = React.useState('');
  const [choisie, setChoisie] = React.useState(null);
  const [feuillePlateforme, setFeuillePlateforme] = React.useState(false);
  const [feuilleGestes, setFeuilleGestes] = React.useState(false);
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
  const plein = surEnvoyer && (E.rangs.length > 0 || E.retours.length > 0)
    ? <Bouton variante="plein" icone={<Icon name="printer" size={20}/>} chargement={P.occupe} indisponible={!P.dispo && !P.occupe}
        raison={P.raison ? tr('vn.plein.' + P.raison) : ''} onClick={g.imprimer}
        attrs={{ 'data-vn-plein': String(P.n), 'data-colis-barre-btn': 'imprimer', 'data-imprimer-prets': P.nVentes, 'data-impr-lot': P.nVentes, 'data-impr-retours-coches': P.nRetours }}>
        {P.n > 0 ? tr('vv.imprimer.n', { n: P.n }) : tr('v2v.imprimer')}
      </Bouton>
    : null;
  const ecart = joint(E.ecart.coches ? tr('vn.e.coches', { n: E.ecart.coches }) : '', E.ecart.sans ? tr('v2v.ecart.sans', { n: E.ecart.sans }) : '', E.ecart.imprimes ? tr('vn.e.deposer', { n: E.ecart.imprimes }) : '');
  // (audit d'utilité du 19 nov.) Plus de grand chiffre : le segment porte le nombre. L'en-tête de la liste dit ce que
  // le nombre ne dit pas — ce qui part à l'impression, ce qui attend son bordereau, ce qui presse (« au moins » si le
  // compte est partiel, §5 : un total partiel ne se présente jamais comme complet).
  const teteListe = joint(m.auMoins && m.nEnv != null ? tr('vn.auMoins', { n: m.nEnv }) : '', m.presses > 0 ? tr('sv.presses.envoyer', { n: m.presses }) : '', ecart) || tr('vv.seg.expedier');
  // (audit d'utilité du 19 nov.) UN bouton « Filtrer » au lieu de la rangée des sites ; les gestes rares (Préparer mes colis,
  // Je dépose, la tournée, Emballer — décision n° 6 en attente de Julien : ils RESTENT) sont rangés derrière « ⋯ ».
  const filtre = plateforme ? <Bouton variante="texte" onClick={() => setFeuillePlateforme(true)} attrs={{ 'data-vn-plateforme': plateforme.cle }}>{plateforme.cle === 'toutes' ? tr('vn.filtrer') : plateforme.libelle}</Bouton> : null;
  const actionPlateforme = <>{filtre}{surEnvoyer ? <BoutonIcone libelle={tr('vn.plus')} icone={<Icon name="more" size={22}/>} onClick={() => setFeuilleGestes(true)} attrs={{ 'data-vn-plus': '' }}/> : null}</>;
  return (
    <>
      <Page titre={tr('vn.titre')} plein={plein} attrs={{ 'data-vn': 'ventes', 'data-vn-onglet': m.onglet }}
        recherche={m.onglet !== 'toutes' ? <ChampRecherche valeur={q} onChange={setQ} placeholder={tr('v2v.rechercher')} libelle={tr('v2v.rechercher')} onScanner={g.retrouver} attrs={{ 'data-vn-champ': '' }}/> : null}>
        <Segmente libelle={tr('vv.seg.label')} valeur={m.onglet} onChange={g.onglet}
          options={[{ cle: 'envoyer', libelle: tr('vv.seg.expedier'), n: m.nEnv || undefined }, { cle: 'envoyes', libelle: tr('vv.seg.route'), n: m.nRoute || undefined }, { cle: 'toutes', libelle: tr('vn.terminees') }]}/>
        {surEnvoyer ? <>
          {!E.lu && !E.rangs.length ? <Attente forme="rangees" n={5} vignette={56} titre/>
            : E.erreur && !E.rangs.length ? <Vide icone={<Icon name="cloudOff" size={40}/>} phrase={tr('v2v.erreur')}/>
            : !E.rangs.length ? <Vide icone={<Icon name="box" size={40}/>} phrase={tr('v2v.vide.envoyer')}/>
            : <Groupe titre={teteListe} action={actionPlateforme} attrs={{ 'data-vn-liste': 'envoyer', 'data-vn-n': String(E.rangs.length), 'data-vn-affiche': m.nEnv == null ? '' : String(m.nEnv) }}>
                {rangs.map((r) => <RangeeColis key={r.cle} r={r} g={g} Icon={Icon} Photo={Photo} choisie={!!ouverte && ouverte.cle === r.cle} onOuvrir={setChoisie}/>)}
                {!rangs.length ? <Vide phrase={tr('v2v.vide.recherche', { q: q.trim() })}/> : null}
              </Groupe>}
          {!E.rangs.length && filtre ? <Groupe nu>{filtre}</Groupe> : null}
          {E.retours.length ? <Groupe titre={tr('vn.retours')} attrs={{ 'data-vn-retours': String(E.retours.length) }}>
            {E.retours.map((l) => <Rangee key={l.cle} titre={l.titre || tr('retours.article')} plaque={l.num ? <Plaque numero={l.num}/> : null} sousTitre={l.vendeur ? tr('impr.retour.vendeur', { qui: l.vendeur }) : ''}
              selection={{ cochee: l.on, libelle: tr('impr.retour.caseAria', { qui: l.num ? tr('retours.numero', { n: l.num }) : (l.titre || tr('retours.article')) }), onChange: () => g.basculerRetour(l.cle), attrs: { 'data-retour-coche': l.cle } }}
              attrs={{ 'data-lot-retour': l.tx }}/>)}
          </Groupe> : null}
          {apresListe}
        </> : null}
        {surRoute ? <>
          {avantRoute}
          {!R || !R.lu ? (R && R.erreur ? <Vide icone={<Icon name="cloudOff" size={40}/>} phrase={tr('v2v.erreur')}/> : <Attente forme="rangees" n={5} vignette={56} titre/>)
            : !R.rangs.length ? <Vide icone={<Icon name="truck" size={40}/>} phrase={tr('v2v.vide.route')}/>
            : <Groupe titre={tr('vv.seg.route')} action={actionPlateforme} attrs={{ 'data-vn-liste': 'route', 'data-vn-n': String(R.rangs.length) }}>
                {rangs.map((r) => <RangeeRoute key={r.cle} r={r} Icon={Icon} Photo={Photo} choisie={!!ouverte && ouverte.cle === r.cle} onOuvrir={setChoisie}/>)}
                {!rangs.length ? <Vide phrase={tr('v2v.vide.recherche', { q: q.trim() })}/> : null}
              </Groupe>}
        </> : null}
        {m.onglet === 'toutes' && filtre ? <Groupe nu>{filtre}</Groupe> : null}
        {children}
      </Page>
      <PagePoussee ouverte={!!ouverte || (volet && m.onglet !== 'toutes')} titre={ouverte && ouverte.num ? tr('natif.plaque.prefixe') + ' ' + ouverte.num : ouverte ? tr('vn.detail') : ''} libelleRetour={tr('vn.titre')} onRetour={() => setChoisie(null)}
        attrs={{ 'data-vn-detail': ouverte ? ouverte.cle : '' }}>
        {ouverte ? <DetailVente r={ouverte} g={g} Icon={Icon} Logo={Logo} Photo={Photo} Generer={Generer}/> : <Vide icone={<Icon name="box" size={40}/>} phrase={tr('vn.detailVide')}/>}
      </PagePoussee>
      <Feuille ouverte={feuilleGestes} onFermer={() => setFeuilleGestes(false)} titre={tr('v2v.outils.titre')} detente="moitie" detentes={['moitie', 'pleine']}>
        {/* (19 nov., décision de Julien « 4 oui ») « Préparer mes colis », « Je dépose », la tournée et « Emballer » sont RETIRÉS :
            le dépôt est constaté par le suivi du transporteur (aExpedier, statut lu). Restent le format, le choix du lot, le scanner. */}
        <Groupe attrs={{ 'data-vn-outils': '' }}>
            <Rangee icone={<Icon name="printer" size={22}/>} titre={tr('vv.format')} valeur={tr('impr.format.' + E.format)} fin="chevron" onClick={fg(g.format)} attrs={{ 'data-impr-format': E.format }}/>
            <Rangee icone={<Icon name="check" size={22}/>} titre={E.autres > 0 ? tr('impr.choisirAutres', { n: E.autres }) : tr('vv.choisir')} fin="chevron" onClick={fg(g.choisir)} attrs={{ 'data-lot-ouvrir': '1' }}/>
            <Rangee icone={<Icon name="scan" size={22}/>} titre={tr('sv.scanner.envoi')} fin="chevron" onClick={fg(g.scanner)} attrs={{ 'data-vn-outil': 'scanner' }}/>
        </Groupe>
      </Feuille>
      {plateforme ? <Feuille ouverte={feuillePlateforme} onFermer={() => setFeuillePlateforme(false)} titre={tr('vn.plateformes')} detente="moitie">
        <Groupe>{plateforme.options.map((o) => <Rangee key={o.cle} titre={o.libelle} fin={o.cle === plateforme.cle ? 'coche' : null} onClick={() => { setFeuillePlateforme(false); plateforme.onChoisir(o.cle); }} attrs={{ 'data-vn-plateforme-choix': o.cle }}/>)}</Groupe>
      </Feuille> : null}
    </>
  );
}
