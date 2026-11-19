// ── src/natif/ecrans/Annonces.jsx — l'écran Annonces : UNE liste pour TOUS les sites (19 nov.) ──
// Julien, 19 nov. (photo de l'écran Annonces → Leboncoin) : « je veux que tout soit comme Vinted, avec toutes les
// informations à côté : les prix minimum acceptés, relier un achat, relié à Vinted. Ce n'est pas parce que Vinted est
// ma plateforme principale que c'est la plateforme principale des autres. » — « Fais-moi un petit onglet "Action" :
// j'appuie, un menu déroulant, je choisis, et ça me permet de sélectionner toutes les annonces à qui appliquer. »
//
// C'est une VUE : elle ne lit aucune donnée et ne porte aucune règle. Les ARTICLES (src/articles/modele.js :
// `construireArticles`, un article = une paire, une ou plusieurs annonces) lui sont passés déjà construits, les
// gestes sont des fonctions. Le branchement (lectures, écritures par `gesteVrm`) est dans src/articles/EcranAnnonces.jsx.
//
// Props :
//   articles      undefined (lecture en cours) · null (pas su) · [article] DÉJÀ filtrés et triés
//   comptes       `compterArticles` (les nombres des segments) · filtre { site, etat } · onFiltre
//   sites         les sites que ce vendeur a (['leboncoin'] pour un vendeur Leboncoin seul) — aucun site par défaut
//   recherche / onRecherche
//   aRegler       [{ cle, titre, sousTitre, valeur, doublon, onClick }] — « À régler · N », replié en tête
//   actions       [{ cle, libelle, phrase, pour(article) → bool, juger(selection) → { ok, raison } }] — le bouton « Actions »
//   onAction(cle, [article])       lance le chemin EXISTANT de l'action sur la sélection
//   onFait(article, champs) → Promise<{ ok } | { refus }>   écrit un fait (acheté, prix mini) sur SA saisie
//   onNumero(article) / onPlace(article) / onPrix(article) / onRelier(article) / onFiche(article)
//   limites       [phrase] — ce qu'un site ne permet pas, dit UNE fois en pied
//   euros(n) → « 45 € » · depuisTexte(ms) → « 12 j » · nomSite(site) · Icon · manque (phrase : une lecture qui a raté)
// Téléphone : rangées de 72 (vignette, titre, « N° · taille · site · compte », prix ; dessous « mini · acheté »).
// Ordinateur : un TABLEAU (Article · N° · Sites · Prix · Prix mini · Acheté · Bénéfice · En ligne depuis) ; une cellule
// « — » se touche et ouvre SA saisie sur place. AUCUN bouton par rangée ; « à relier » est un état discret.
import React from 'react';
import { tr } from '../../i18n/index.js';
import { Page, PagePoussee, ChampRecherche } from '../Page.jsx';
import { Groupe } from '../Groupe.jsx';
import { Rangee, Vignette } from '../Rangee.jsx';
import { Bouton, BoutonIcone } from '../Bouton.jsx';
import { Segmente } from '../Segmente.jsx';
import { Feuille } from '../Feuille.jsx';
import { Faits, Fait } from '../Faits.jsx';
import { Plaque } from '../Plaque.jsx';
import { Vide } from '../Vide.jsx';
import { Attente } from '../Attente.jsx';
import { Toast } from '../Toast.jsx';
import { useOrdinateur } from '../Coque.jsx';
import '../jetons.css';
import '../natif.css';
import './annonces.css';

const PAR_PAGE = 60;
// Les segments (audit d'utilité du 19 nov.) : En ligne · À publier · Dorment.
const ETATS = ['enligne', 'apublier', 'dorment'];
const etatMot = (e) => tr('egalite.etatAnnonce.' + e);

// Ce que dit la 2e ligne d'une rangée : « 42 · Leboncoin · atelier-nord » (un site) ou « 42 · sur 3 sites ».
function sousDe(a, nomSite, filtreSite, euros = (n) => String(n)) {
  const bouts = [];
  if (a.taille) bouts.push(tr('egalite.taille', { t: a.taille }));
  bouts.push(tr('egalite.achete', { p: a.achat != null ? euros(a.achat) : '—' }));
  const ann = filtreSite && filtreSite !== 'tous' ? a.annonces.filter((x) => x.site === filtreSite) : a.annonces;
  if (a.sites.length > 1 && (!filtreSite || filtreSite === 'tous')) bouts.push(tr('egalite.surSites', { n: a.sites.length }));
  else { const x = ann[0] || a.annonces[0]; bouts.push(nomSite(x.site) + (x.pseudo ? ' · ' + x.pseudo : '')); }
  if (a.etat !== 'enligne') bouts.push(etatMot(a.etat));
  if (a.favoris != null && a.favoris > 0) bouts.push(tr('egalite.favoris', { n: a.favoris }));
  if (a.aRelier) bouts.push(tr('egalite.aRelier'));
  return bouts.join(' · ');
}

// La saisie d'UN fait (acheté, prix mini) : une feuille, un champ, « Enregistrer ».
function FeuilleFait({ cible, onFermer, onFait, euros }) {
  const [v, setV] = React.useState('');
  const [etat, setEtat] = React.useState('');           // '' · 'envoi' · le texte d'un refus
  const champ = cible ? cible.champ : '';
  const a = cible ? cible.article : null;
  React.useEffect(() => { setEtat(''); setV(a && champ ? (champ === 'buyPrice' ? (a.achat != null ? String(a.achat).replace('.', ',') : '') : (a.prixMini != null ? String(a.prixMini).replace('.', ',') : '')) : ''); }, [a && a.cle, champ]);
  const enregistrer = async () => {
    if (!a || etat === 'envoi') return;
    setEtat('envoi');
    let r = null; try { r = await onFait(a, { [champ]: v }); } catch (_) { r = null; }
    if (r && r.ok) { onFermer(true); return; }
    setEtat(tr('egalite.refus.' + ((r && r.refus) || 'pas-su')));
  };
  return (
    <Feuille ouverte={!!cible} onFermer={() => onFermer(false)} titre={champ ? tr('egalite.saisie.' + champ) : ''} attrs={{ 'data-eg-saisie': champ || undefined }}
      pied={<Bouton variante="plein" chargement={etat === 'envoi'} onClick={enregistrer} attrs={{ 'data-eg-enregistrer': '' }}>{tr('egalite.enregistrer')}</Bouton>}>
      {a ? <Groupe nu>
        <p className="n-eg-cible">{(a.numero ? tr('egalite.numeroCourt', { n: a.numero }) + ' · ' : '') + a.titre}{a.prix != null ? ' · ' + euros(a.prix) : ''}</p>
        <label className="n-eg-champ">
          <span className="n-eg-champ-nom">{tr('egalite.saisieEuros')}</span>
          <input className="n-eg-entree" type="text" inputMode="decimal" enterKeyHint="done" autoComplete="off" value={v} placeholder="0" data-eg-entree=""
            onChange={(e) => { setV(e.target.value); if (etat && etat !== 'envoi') setEtat(''); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); enregistrer(); } }}/>
        </label>
        {etat && etat !== 'envoi' ? <p className="n-eg-refus" role="alert" data-eg-refus="">{etat}</p> : null}
      </Groupe> : null}
    </Feuille>
  );
}

// La fiche courte de l'article (les MÊMES faits pour tous les sites) — la fiche complète est celle de l'app (`onFiche`).
function FicheArticle({ a, ouverte, onRetour, euros, depuisTexte, nomSite, onSaisir, onNumero, onPlace, onPrix, onRelier, onFiche, Icon }) {
  return (
    <PagePoussee ouverte={ouverte} titre={a ? (a.numero ? tr('egalite.numeroCourt', { n: a.numero }) : a.titre) : ''} libelleRetour={tr('egalite.titre')} onRetour={onRetour} attrs={{ 'data-eg-fiche': a ? a.cle : undefined }}>
      {a ? <>
        <Groupe>
          <Rangee vignette={<Vignette src={a.photo || ''} alt=""/>} titre={a.titre} lignes={2} plaque={a.numero ? <Plaque numero={a.numero} doublon={a.doublon}/> : null}
            sousTitre={[a.taille ? tr('egalite.taille', { t: a.taille }) : '', a.condition, etatMot(a.etat)].filter(Boolean).join(' · ')}/>
        </Groupe>
        <Groupe>
          <Faits colonnes={2}>
            <Fait libelle={tr('egalite.col.prix')} valeur={a.prix != null ? euros(a.prix) : null} onModifier={onPrix ? () => onPrix(a) : undefined}/>
            <Fait libelle={tr('egalite.col.prixMini')} valeur={a.prixMini != null ? euros(a.prixMini) : null} onModifier={() => onSaisir(a, 'min')}/>
            <Fait libelle={tr('egalite.col.achat')} valeur={a.achat != null ? euros(a.achat) : null} detail={a.achatRelie ? tr('egalite.achatRelie') : ''} onModifier={() => onSaisir(a, 'buyPrice')}/>
            <Fait libelle={tr('egalite.col.benefice')} valeur={a.benefice != null ? euros(a.benefice) : null}/>
            <Fait libelle={tr('egalite.col.numero')} valeur={a.numero || null} onModifier={!a.numero && onNumero ? () => onNumero(a) : undefined}/>
            <Fait libelle={tr('egalite.col.place')} valeur={a.place ? (a.place.nom || tr('egalite.placeCase', { i: Number(a.place.i) + 1 })) : null} onModifier={a.numero && onPlace ? () => onPlace(a) : undefined}/>
            <Fait libelle={tr('egalite.col.depuis')} valeur={a.depuis != null ? depuisTexte(a.depuis) : null}/>
            <Fait libelle={tr('egalite.col.favoris')} valeur={a.favoris != null ? String(a.favoris) : null} detail={a.vues != null ? tr('egalite.vues', { n: a.vues }) : ''}/>
          </Faits>
        </Groupe>
        <Groupe titre={tr('egalite.col.sites')}>
          {a.annonces.map((x) => <Rangee key={x.site + x.id} titre={nomSite(x.site) + (x.pseudo ? ' · ' + x.pseudo : '')} sousTitre={[etatMot(x.etat), x.depuis != null ? depuisTexte(x.depuis) : '', x.favoris != null ? tr('egalite.favoris', { n: x.favoris }) : ''].filter(Boolean).join(' · ')}
            valeur={x.prix != null ? euros(x.prix) : null} fin={x.url ? 'chevron' : null} href={x.url || ''} attrs={{ 'data-eg-annonce': x.site + ':' + x.id }}/>)}
          {a.aRelier && onRelier ? <Rangee ton="ambre" titre={tr('egalite.relier.titre')} sousTitre={tr('egalite.relier.sous')} fin="chevron" onClick={() => onRelier(a)} attrs={{ 'data-eg-relier': a.cle }}/> : null}
        </Groupe>
        {onFiche && a.numero ? <Groupe><Rangee icone={Icon ? <Icon name="list" size={22}/> : null} titre={tr('egalite.touteLaFiche')} fin="chevron" onClick={() => onFiche(a)} attrs={{ 'data-eg-toute-fiche': '' }}/></Groupe> : null}
      </> : null}
    </PagePoussee>
  );
}

export default function VueAnnonces({ articles, comptes = null, filtre = { site: 'tous', etat: 'enligne' }, onFiltre, sites = [], recherche = '', onRecherche,
  aRegler = [], actions = [], onAction, onFait, onNumero = null, onPlace = null, onPrix = null, onRelier = null, onFiche = null, limites = [], manque = '',
  euros = (n) => String(n) + ' €', depuisTexte = () => '', nomSite = (s) => s, Icon = null, onPublier = null, onEcranSite = null }) {
  const ordinateur = useOrdinateur();
  const [reglerOuvert, setReglerOuvert] = React.useState(false);
  const [menuSites, setMenuSites] = React.useState(false);
  const [menuActions, setMenuActions] = React.useState(false);
  const [action, setAction] = React.useState(null);          // l'action choisie ⇒ la liste est en SÉLECTION
  const [sel, setSel] = React.useState(() => new Set());
  const [ouvert, setOuvert] = React.useState('');            // la clé de l'article ouvert
  const [saisie, setSaisie] = React.useState(null);          // { article, champ }
  const [dit, setDit] = React.useState(null);                // le toast
  const [max, setMax] = React.useState(PAR_PAGE);
  React.useEffect(() => { setMax(PAR_PAGE); }, [filtre.site, filtre.etat, recherche]);
  const liste = Array.isArray(articles) ? articles : [];
  const visibles = liste.slice(0, max);
  const A = action ? actions.find((x) => x.cle === action) : null;
  const cochable = (a) => !A || !A.pour || A.pour(a);
  const choisis = liste.filter((a) => sel.has(a.cle));
  const jugement = A && A.juger ? A.juger(choisis) : { ok: choisis.length > 0, raison: '' };
  const basculer = (a) => { if (!cochable(a)) return; setSel((s) => { const n = new Set(s); if (n.has(a.cle)) n.delete(a.cle); else n.add(a.cle); return n; }); };
  const toutCocher = () => { const tous = liste.filter(cochable); setSel((s) => (tous.every((a) => s.has(a.cle)) ? new Set() : new Set(tous.map((a) => a.cle)))); };
  const quitter = () => { setAction(null); setSel(new Set()); };
  const lancer = () => { if (!A || !jugement.ok) return; const c = choisis; quitter(); if (onAction) onAction(A.cle, c); };
  const ouvrir = (a) => { if (A) basculer(a); else setOuvert(a.cle); };
  const saisir = (a, champ) => setSaisie({ article: a, champ });
  const articleOuvert = ouvert ? liste.find((a) => a.cle === ouvert) || null : null;
  const nSite = (s) => (comptes && comptes[s] ? comptes[s][filtre.etat] : null);
  const optionsEtat = ETATS.map((e) => ({ cle: e, libelle: tr('egalite.etat.' + e), n: comptes && comptes[filtre.site] ? comptes[filtre.site][e] : undefined }));
  const lesSites = ['tous', ...sites];

  const plein = A
    ? <Bouton variante="plein" indisponible={!jugement.ok} raison={!jugement.ok ? (jugement.raison || tr('egalite.selection.aucune')) : ''} onClick={lancer} attrs={{ 'data-eg-lancer': A.cle, 'data-eg-n': String(choisis.length) }}>{tr('egalite.selection.lancer', { action: A.libelle, n: choisis.length })}</Bouton>
    : (onPublier ? <Bouton variante="plein" onClick={onPublier} attrs={{ 'data-eg-publier': '' }}>{tr('egalite.publier')}</Bouton> : null);

  const tete = (
    <div className="n-eg-tete" data-eg-tete="">
      <Segmente libelle={tr('egalite.etat.libelle')} valeur={filtre.etat} onChange={(e) => onFiltre({ ...filtre, etat: e })} options={optionsEtat}/>
      <div className="n-eg-outils">
        {A ? <>
          <Bouton variante="texte" onClick={toutCocher} attrs={{ 'data-eg-tout': '' }}>{liste.filter(cochable).every((a) => sel.has(a.cle)) && sel.size ? tr('egalite.selection.rien') : tr('egalite.selection.tout')}</Bouton>
          <Bouton variante="texte" onClick={quitter} attrs={{ 'data-eg-annuler': '' }}>{tr('egalite.selection.annuler')}</Bouton>
        </> : <>
          {sites.length > 1 ? <Bouton variante="teinte" onClick={() => setMenuSites(true)} attrs={{ 'data-eg-filtre': filtre.site }}>{filtre.site === 'tous' ? tr('egalite.site.titre') : tr('egalite.site.titre') + ' · ' + nomSite(filtre.site)}</Bouton> : null}
          {actions.length ? <Bouton variante="teinte" onClick={() => setMenuActions(true)} attrs={{ 'data-eg-actions': '' }}>{tr('egalite.actions')}</Bouton> : null}
        </>}
      </div>
      {A ? <p className="n-eg-phrase" data-eg-phrase={A.cle}>{A.phrase}</p> : null}
    </div>
  );

  const rangee = (a) => {
    const grise = A && !cochable(a);
    return <Rangee key={a.cle} vignette={<Vignette src={a.photo || ''} alt=""/>} titre={a.titre || tr('egalite.sansTitre')}
      plaque={a.numero ? <Plaque numero={a.numero} doublon={a.doublon}/> : null} sousTitre={sousDe(a, nomSite, filtre.site, euros)} lignes={2} ton={a.aRelier ? 'ambre' : 'neutre'}
      valeur={a.prix != null ? euros(a.prix) : null} valeurForte
      detailValeur={tr('egalite.mini', { p: a.prixMini != null ? euros(a.prixMini) : '—' })}
      fin={A ? (sel.has(a.cle) ? 'coche' : <span className="n-eg-case" aria-hidden="true"/>) : 'chevron'} selectionnee={A ? sel.has(a.cle) : ouvert === a.cle}
      indisponible={!!grise} raison={grise ? tr('egalite.selection.pasPour', { site: nomSite(a.annonces[0].site) }) : ''} onClick={() => ouvrir(a)}
      actions={A ? null : [{ cle: 'mini', libelle: tr('egalite.col.prixMini'), ton: 'neutre', onClick: () => saisir(a, 'min') }, { cle: 'achat', libelle: tr('egalite.col.achat'), onClick: () => saisir(a, 'buyPrice') }]}
      attrs={{ 'data-eg-article': a.cle, 'data-eg-sites': a.sites.join(','), 'data-eg-numero': a.numero || '', 'data-eg-coche': A ? (sel.has(a.cle) ? '1' : '0') : undefined }}/>;
  };

  // Une cellule du tableau : la valeur, ou « — » qui se touche et ouvre SA saisie.
  const cellule = (a, cle, valeur, onModifier) => (
    <td className="n-eg-td" data-eg-col={cle} data-eg-vide={valeur == null ? '1' : undefined}>
      {onModifier && !A ? <button type="button" className="n-eg-cellule" data-eg-modifier={cle} aria-label={tr('egalite.modifier', { quoi: tr('egalite.col.' + cle), article: a.titre })} onClick={(e) => { e.stopPropagation(); onModifier(); }}>{valeur == null ? '—' : valeur}</button>
        : <span className="n-eg-valeur">{valeur == null ? '—' : valeur}</span>}
    </td>
  );
  const tableau = (
    <Groupe attrs={{ 'data-eg-tableau': '' }}>
      <table className="n-eg-table">
        <thead><tr>
          {A ? <th className="n-eg-th n-eg-th-case" scope="col"><span className="n-eg-sr">{tr('egalite.selection.colonne')}</span></th> : null}
          {['article', 'numero', 'sites', 'prix', 'prixMini', 'achat', 'benefice', 'depuis'].map((c) => <th key={c} scope="col" className="n-eg-th" data-eg-th={c}>{tr('egalite.col.' + c)}</th>)}
        </tr></thead>
        <tbody>
          {visibles.map((a) => {
            const grise = A && !cochable(a);
            return (
              <tr key={a.cle} className="n-eg-tr" tabIndex={0} data-eg-article={a.cle} data-eg-sites={a.sites.join(',')} data-eg-numero={a.numero || ''} data-eg-choisie={(A ? sel.has(a.cle) : ouvert === a.cle) ? '1' : undefined} data-eg-grise={grise ? '1' : undefined}
                data-eg-coche={A ? (sel.has(a.cle) ? '1' : '0') : undefined} onClick={() => ouvrir(a)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ouvrir(a); } }}>
                {A ? <td className="n-eg-td n-eg-td-case"><input type="checkbox" className="n-eg-coche" checked={sel.has(a.cle)} disabled={!!grise} aria-label={a.titre} onChange={() => basculer(a)} onClick={(e) => e.stopPropagation()}/></td> : null}
                <td className="n-eg-td n-eg-td-article" data-eg-col="article"><Vignette src={a.photo || ''} alt="" taille={44}/><span className="n-eg-article"><span className="n-eg-article-titre">{a.titre || tr('egalite.sansTitre')}</span>
                  <span className="n-eg-article-sous">{[a.taille ? tr('egalite.taille', { t: a.taille }) : '', a.condition, a.etat !== 'enligne' ? etatMot(a.etat) : ''].filter(Boolean).join(' · ') || ' '}</span></span></td>
                <td className="n-eg-td" data-eg-col="numero">{a.numero ? <Plaque numero={a.numero} doublon={a.doublon}/> : (onNumero && !A ? <button type="button" className="n-eg-cellule" data-eg-modifier="numero" aria-label={tr('egalite.modifier', { quoi: tr('egalite.col.numero'), article: a.titre })} onClick={(e) => { e.stopPropagation(); onNumero(a); }}>—</button> : <span className="n-eg-valeur">—</span>)}</td>
                <td className="n-eg-td" data-eg-col="sites"><span className="n-eg-sites">{a.sites.map((s) => nomSite(s)).join(' · ')}</span>
                  {a.aRelier ? <span className="n-eg-arelier" data-eg-arelier="">{tr('egalite.aRelier')}</span> : (a.annonces.length === 1 && a.annonces[0].pseudo ? <span className="n-eg-article-sous">{a.annonces[0].pseudo}</span> : null)}</td>
                {cellule(a, 'prix', a.prix != null ? euros(a.prix) : null, onPrix ? () => onPrix(a) : null)}
                {cellule(a, 'prixMini', a.prixMini != null ? euros(a.prixMini) : null, () => saisir(a, 'min'))}
                {cellule(a, 'achat', a.achat != null ? euros(a.achat) : null, () => saisir(a, 'buyPrice'))}
                {cellule(a, 'benefice', a.benefice != null ? euros(a.benefice) : null, null)}
                {cellule(a, 'depuis', a.depuis != null ? depuisTexte(a.depuis) : null, null)}
              </tr>
            );
          })}
        </tbody>
      </table>
    </Groupe>
  );

  return (
    <>
      <Page titre={tr('egalite.titre')} plein={plein} attrs={{ 'data-eg-ecran': '', 'data-eg-site': filtre.site, 'data-eg-etat': filtre.etat, 'data-eg-selection': A ? A.cle : undefined, 'data-eg-vue': ordinateur ? 'tableau' : 'liste' }}
        recherche={<ChampRecherche valeur={recherche} onChange={onRecherche} placeholder={tr('egalite.chercher')} libelle={tr('egalite.chercherNom')}/>}>
        {tete}
        {aRegler.length && !A ? <Groupe titre={tr('egalite.aRegler')} repli={{ ouvert: reglerOuvert, onBascule: () => setReglerOuvert((o) => !o), n: aRegler.length }} attrs={{ 'data-eg-regler': String(aRegler.length) }}>
          {aRegler.map((r) => <Rangee key={r.cle} titre={r.titre} sousTitre={r.sousTitre || ''} valeur={r.valeur != null ? r.valeur : null} ton={r.doublon ? 'neutre' : 'ambre'} plaque={r.doublon ? <Plaque numero={r.doublon} doublon/> : null} fin={r.onClick ? 'chevron' : null} onClick={r.onClick || null} attrs={{ 'data-eg-regle': r.cle }}/>)}
        </Groupe> : null}
        {articles === undefined ? <Attente forme="rangees" n={6} vignette={56} titre/>
          : articles === null ? <Vide icone={Icon ? <Icon name="alert" size={40}/> : null} phrase={tr('egalite.pasSu')} detail={manque}/>
          : !liste.length ? <Vide icone={Icon ? <Icon name="tag" size={40}/> : null} phrase={recherche ? tr('egalite.videRecherche') : tr('egalite.vide.' + filtre.etat)}/>
          : ordinateur ? tableau
          : <Groupe attrs={{ 'data-eg-liste': '' }}>{visibles.map(rangee)}</Groupe>}
        {liste.length > max ? <Groupe nu><Bouton variante="texte" large onClick={() => setMax((m) => m + PAR_PAGE)} attrs={{ 'data-eg-plus': '' }}>{tr('egalite.plus', { n: liste.length - max })}</Bouton></Groupe> : null}
        {onEcranSite && filtre.site !== 'tous' && !A ? <Groupe><Rangee titre={tr('egalite.ecranSite', { site: nomSite(filtre.site) })} sousTitre={tr('egalite.ecranSite.sous')} fin="chevron"
          onClick={() => onEcranSite(filtre.site)} attrs={{ 'data-eg-ecran-site': filtre.site }}/></Groupe> : null}
        {Array.isArray(articles) && (manque || limites.length) ? <Groupe nu pied={[manque, ...limites].filter(Boolean).join(' ')} attrs={{ 'data-eg-pied': '' }}/> : null}
      </Page>

      <Feuille ouverte={menuSites} onFermer={() => setMenuSites(false)} titre={tr('egalite.site.titre')} attrs={{ 'data-eg-menu-sites': '' }}>
        <Groupe>{lesSites.map((s) => <Rangee key={s} titre={s === 'tous' ? tr('egalite.site.tous') : nomSite(s)} valeur={nSite(s) != null ? String(nSite(s)) : null} fin={filtre.site === s ? 'coche' : null}
          onClick={() => { onFiltre({ ...filtre, site: s }); setMenuSites(false); }} attrs={{ 'data-eg-site-choix': s }}/>)}</Groupe>
      </Feuille>

      <Feuille ouverte={menuActions} onFermer={() => setMenuActions(false)} titre={tr('egalite.actions')} attrs={{ 'data-eg-menu-actions': '' }}>
        <Groupe>{actions.map((x) => <Rangee key={x.cle} icone={Icon && x.icone ? <Icon name={x.icone} size={22}/> : null} titre={x.libelle} sousTitre={x.court || ''} fin="chevron"
          onClick={() => { setMenuActions(false); setSel(new Set()); setAction(x.cle); }} attrs={{ 'data-eg-action': x.cle }}/>)}</Groupe>
      </Feuille>

      <FeuilleFait cible={saisie} euros={euros} onFait={onFait} onFermer={(ok) => { const s = saisie; setSaisie(null); if (ok && s) setDit({ id: Date.now(), message: tr('egalite.enregistre', { quoi: tr('egalite.col.' + (s.champ === 'min' ? 'prixMini' : 'achat')) }) }); }}/>

      <FicheArticle a={articleOuvert} ouverte={!!articleOuvert} onRetour={() => setOuvert('')} euros={euros} depuisTexte={depuisTexte} nomSite={nomSite} onSaisir={saisir}
        onNumero={onNumero} onPlace={onPlace} onPrix={onPrix} onRelier={onRelier} onFiche={onFiche} Icon={Icon}/>

      {dit ? <Toast key={dit.id} message={dit.message} onFin={() => setDit(null)}/> : null}
    </>
  );
}
