// ── src/natif/ecrans/Fiche.jsx — LA FICHE D'UN ARTICLE, « VRM natif » (19 nov. 2026) ─────────────────
// Contrat : docs/design/NATIF.md §4 et docs/design/2026-11-19-audit-utilite.md (§1 n° 5, §4.6). Récit :
// docs/passation/2026-11-19-fiche-directe.md. Julien : « je dois cliquer sur la paire puis cliquer sur les points pour
// avoir des informations. Ce n'est pas normal » ; « l'outil doit être pratique, pas chiant ».
//
// Une PAGE POUSSÉE (retour ‹, balayage du bord ; à l'ordinateur : le volet de détail de la coque) :
//   photo · plaque · titre · UNE ligne d'état ; `Faits` (Prix · Prix mini · Achat · Bénéfice · Taille · En ligne ·
//   Place · Favoris) — chaque valeur qui se corrige se TOUCHE (achat, prix mini : tapés sur place) ; groupe « Sites » ;
//   UN plein (collé en bas) ; les gestes en rangées ; l'histoire repliée. « ⋯ » : le rare seulement.
//
// VUE PURE : elle ne lit aucune donnée et ne porte aucune règle. Elle reçoit
//   article   l'objet de `articleFiche` (src/ficheProduit.js) : { num, titre, photo, photos, double, etat, faits, prixRef,
//             sites, sitesManques, action, histoire } — ou null (une ligne sans article : `sans`) ;
//   textes    les libellés déjà traduits (voir `FichePaire.jsx`) ; `rendre` : { photo(src), icone(nom, taille), logo(site) } ;
//   portes    { [porte]: fn } · edition / setEdition (le fait tapé sur place) · plein { libelle, icone, onClick, attrs } ;
//   gestes, rares  [{ cle, libelle, icone, onClick, attrs, ouvert }] · blocs (nœuds hérités, posés tels quels).
// Aucun style en ligne, aucune classe de mise en page à elle : elle compose `src/natif/`.
import React from 'react';
import { PagePoussee, Groupe, Rangee, Faits, Fait, Plaque, Bouton, BoutonIcone, Feuille, EnteteArticle, Photos, Herite, useOrdinateur } from '../index.js';

const HISTOIRE_REPLIEE = 3;

export default function Fiche({ article: A, numero = '', sans = null, titreBarre = '', libelleRetour = '', onRetour, attrs = null, textes: T, rendre, portes = {}, edition = null, setEdition,
  contexteBarre = '', plein = null, proposition = null, ligneAction = null, gestes = [], rares = [], histoire = null, achatRelie = null, blocs = {}, sansNumero = '', suiteEtat = null }) {
  const ordi = useOrdinateur();
  const [grand, setGrand] = React.useState(false);
  const [plus, setPlus] = React.useState(false);
  const [toutHist, setToutHist] = React.useState(false);
  const [ouvert, setOuvert] = React.useState(null);   // le geste dont le contenu est montré en feuille (note, photos…)
  React.useEffect(() => { setGrand(false); setPlus(false); setToutHist(false); setOuvert(null); }, [numero]);
  const photos = A ? A.photos : (sans && sans.photo ? [sans.photo] : []);
  const photo = photos[0] || '';
  const etat = A && A.etat ? A.etat : null;
  const faits = A ? A.faits : [];
  const colonnes = ordi ? 4 : 2;
  const valeurDe = (f) => (f.cle === 'interet' ? [f.favoris, f.vues].filter((x) => x != null).join(' · ')
    : f.cle === 'taille' || f.cle === 'place' ? (f.texte || null)
    : f.cle === 'quand' ? (f.date != null ? T.date(f.date) : f.jours != null ? T.jours(f.jours) : null)
    : f.cents == null ? null : f.signe ? T.signe(f.cents) : T.euros(f.cents));
  const suDe = (f, v) => (f.cle === 'interet' ? true : v != null && v !== '');
  const tous = histoire ? histoire.lignes : [];
  const etapes = toutHist ? tous : tous.slice(-HISTOIRE_REPLIEE);
  const allerAchat = () => setToutHist(true);
  const toucher = (g) => { if (g.contenu) setOuvert(g); else if (g.onClick) g.onClick(); };
  // Un geste = une rangée (icône + libellé). Sur la fiche, les gestes forment une GRILLE de rangées (2 colonnes au téléphone,
  // 4 à l'ordinateur) : tous visibles, la fiche tient sur un écran et demi ; dans « ⋯ », une liste (avec son chevron).
  const rangeeGeste = (g, grille = false) => <Rangee key={g.cle} icone={rendre.icone(g.icone, 22)} titre={g.libelle} lignes={grille ? 2 : 1} fin={grille ? null : 'chevron'} onClick={() => { setPlus(false); toucher(g); }} attrs={{ 'data-fd-tuile': g.cle, ...(g.attrs || {}) }}/>;
  return (
    <PagePoussee ouverte titre={titreBarre} libelleRetour={libelleRetour} onRetour={onRetour}
      actions={rares.length ? <BoutonIcone libelle={T.plus} icone={rendre.icone('more', 22)} onClick={() => setPlus(true)} attrs={{ 'data-fd-plus-ouvrir': '' }}/> : null}
      plein={plein ? <Bouton variante="plein" large icone={plein.icone ? rendre.icone(plein.icone, 20) : null} onClick={plein.onClick} attrs={{ 'data-fd-plein': '', ...(plein.attrs || {}) }}>{plein.libelle}</Bouton> : null}
      attrs={attrs}>
      {A || sans ? <EnteteArticle
        photo={photo ? rendre.photo(photo) : null} nPhotos={photos.length} onPhoto={photo ? () => setGrand(true) : null} libellePhoto={photos.length > 1 ? T.voirPhotos(photos.length) : T.agrandir}
        plaque={A ? <span data-fiche-grand-num=""><Plaque numero={A.num} doublon={A.double} grand/></span> : sansNumero ? <span data-fiche-grand-num="" data-fiche-sans-num="">{sansNumero}</span> : null}
        titre={A ? T.titre : (sans && sans.titre) || T.sansTitre}
        etat={etat ? T.etat(etat) : (sans && sans.prix) || ''} ton={etat && etat.rouge ? 'doublon' : etat && etat.ambre ? 'ambre' : 'neutre'} suite={suiteEtat}
        attrs={{ 'data-fiche-heros': contexteBarre || 'numero', 'data-fiche-photo-vedette': photo ? '1' : '0' }} attrsPhoto={{ 'data-fiche-heros-photo': photo ? '1' : '0', 'data-fd-photo-agrandir': photos.length }}
        attrsTitre={{ 'data-fd-titre': '' }} attrsEtat={etat ? { 'data-fd-etat': etat.cle, 'data-fd-ambre': etat.ambre ? '1' : '0', 'data-fd-limite': etat.limite ? (etat.limite.jour || '') : undefined } : null}/> : null}
      {blocs.alerte || null}
      {blocs.noteLue ? <Herite nu attrs={{ 'data-fd-note-lue': '' }}>{blocs.noteLue}</Herite> : null}
      {faits.length ? <Groupe attrs={{ 'data-fd-faits': faits.map((f) => f.cle).join(','), 'data-fd-vue-argent': faits.filter((f) => ['achat', 'benefice', 'si-vendue'].includes(f.cle)).map((f) => f.cle).join(',') }}>
        <Faits colonnes={colonnes}>
          {faits.map((f) => {
            const v = valeurDe(f); const su = suDe(f, v);
            const porte = f.porte && portes[f.porte] ? f.porte : null;
            const surPlace = porte === 'achat' || porte === 'mini';
            const detail = !su && f.raison ? T.raison(f.raison) : f.partiel ? T.auPlus : f.auMoins ? T.auMoins : '';
            const a = { 'data-fd-fait': f.cle, 'data-fd-fait-su': su ? '1' : '0', 'data-fd-fait-porte': porte || undefined, ...(T.attrsFait(f) || {}) };
            return <Fait key={f.cle} libelle={T.libelle(f.lib)} valeur={v} detail={detail} attrs={a}
              saisie={surPlace && edition === f.cle ? { depart: f.cents == null ? '' : String(f.cents / 100).replace('.', ','), placeholder: '€', onValider: (t) => portes[porte](f, t), onFin: () => setEdition(null) } : null}
              onModifier={porte ? () => { if (surPlace) setEdition(f.cle); else if (porte === 'lien') allerAchat(); else portes[porte](f); } : null}/>;
          })}
        </Faits>
      </Groupe> : null}
      {A && !A.double ? <Groupe titre={T.sites} pied={A.sitesManques && A.sitesManques.length ? T.pasLus(A.sitesManques.join(', ')) : ''} attrs={{ 'data-fd-sites': A.sites.length, 'data-fiche-sites': A.sites.length, 'data-fd-sites-pas-lus': A.sitesManques && A.sitesManques.length ? A.sitesManques.join(',') : undefined }}>
        {A.sites.length ? A.sites.map((s, i) => {
          const prix = s.prix != null && s.prix !== A.prixRef ? T.euros(s.prix) : null;
          return <Rangee key={i} icone={rendre.logo(s.site)} titre={T.site(s.site)} sousTitre={s.compte || ''} valeur={prix || T.etatSite(s)} valeurForte={!!prix} detailValeur={prix ? T.etatSite(s) : ''}
            fin={s.lien && s.etat !== 'vendue' ? 'chevron' : null} href={s.lien && s.etat !== 'vendue' ? s.lien : ''} attrs={{ 'data-fiche-site': s.site, 'data-fiche-site-etat': s.etat, ...(s.lien && s.etat !== 'vendue' ? { target: '_blank', rel: 'noreferrer', 'data-fiche-site-lien': '' } : {}) }}/>;
        }) : <Rangee titre={T.aucunSite} indisponible/>}
      </Groupe> : null}
      {proposition || ligneAction ? <Groupe titre={proposition ? T.achatPropose : ''} attrs={{ 'data-fd-action-contexte': '' }}>
        {proposition ? <Rangee vignette={rendre.vignette(proposition.photo)} titre={proposition.titre} lignes={2} sousTitre={proposition.sous} attrs={proposition.attrs}/> : null}
        {proposition && proposition.onAutre ? <Rangee titre={T.autreAchat} fin="chevron" onClick={proposition.onAutre} attrs={{ 'data-fd-relier-autre': '' }}/> : null}
        {ligneAction ? <Rangee titre={ligneAction.titre} valeur={ligneAction.valeur || null} ton={ligneAction.ambre ? 'ambre' : 'neutre'} sousTitre={ligneAction.sous || ''} attrs={ligneAction.attrs}/> : null}
      </Groupe> : null}
      {blocs.sansPaire || null}
      {blocs.questions ? <Herite nu attrs={{ 'data-fd-questions': '' }}>{blocs.questions}</Herite> : null}
      {gestes.length || blocs.vendueAilleurs ? <Groupe titre={T.gestes} className="n-gestes" attrs={{ 'data-fd-tuiles': gestes.map((g) => g.cle).join(','), 'data-n-colonnes': ordi ? 4 : 2 }}>
        {gestes.map((g) => rangeeGeste(g, true))}
        {blocs.vendueAilleurs ? <div className="n-gestes-case" data-fd-gestes="">{blocs.vendueAilleurs}</div> : null}
      </Groupe> : null}
      {blocs.contexte || null}
      {histoire ? <Groupe titre={T.histoire} attrs={{ 'data-fd-histoire': toutHist ? 'tout' : 'repliee', 'data-fiche-hist': tous.length }}>
        {etapes.map((l) => <Rangee key={l.cle} titre={l.titre} sousTitre={l.reste} ton={l.ambre ? 'ambre' : 'neutre'} attrs={{ 'data-fiche-hist-etape': l.cle }}/>)}
        {toutHist && achatRelie && achatRelie.recu ? <Rangee titre={T.recu} fin="chevron" onClick={achatRelie.onRecu} attrs={{ 'data-fd-recu': achatRelie.tx }}/> : null}
        {toutHist && achatRelie ? <Rangee titre={T.delier} fin="chevron" onClick={achatRelie.onDelier} attrs={{ 'data-fd-delier': achatRelie.tx, 'data-fd-achat-relie': achatRelie.tx }}/> : null}
        <Rangee titre={toutHist ? T.replier : T.toutVoir} fin={toutHist ? null : 'chevron'} onClick={() => setToutHist((x) => !x)} attrs={{ 'data-fd-tout-voir': '', 'aria-expanded': toutHist ? 'true' : 'false' }}/>
      </Groupe> : null}
      {histoire && toutHist && blocs.toutVoir ? <Herite attrs={{ 'data-fiche-plus': '' }}>{blocs.toutVoir}</Herite> : null}
      {blocs.actions || null}
      {blocs.lecture || null}
      <Feuille ouverte={grand && photos.length > 0} onFermer={() => setGrand(false)} titre={A ? T.titre : ''} detente="pleine" attrs={{ 'data-fd-visionneuse': photos.length }}>
        <Photos sources={photos} rendre={rendre.photo}/>
      </Feuille>
      <Feuille ouverte={plus} onFermer={() => setPlus(false)} titre={T.plus} attrs={{ 'data-fd-plus': plus ? '1' : '0' }}>
        <Groupe>{rares.map((g) => rangeeGeste(g))}</Groupe>
      </Feuille>
      <Feuille ouverte={!!ouvert} onFermer={() => setOuvert(null)} titre={ouvert ? ouvert.libelle : ''} detente="pleine" attrs={{ 'data-fd-tuile-vue': ouvert ? ouvert.cle : '' }}>
        {ouvert ? <Herite>{ouvert.contenu}</Herite> : null}
      </Feuille>
    </PagePoussee>
  );
}
