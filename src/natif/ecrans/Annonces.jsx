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
import { PropositionLiaison } from './PropositionLiaison.jsx';   // (20 nov.) relier depuis la liste
import { tr } from '../../i18n/index.js';
import { Page, PagePoussee, ChampRecherche } from '../Page.jsx';
import { Groupe } from '../Groupe.jsx';
import { Rangee, Vignette } from '../Rangee.jsx';
import { Bouton, BoutonIcone } from '../Bouton.jsx';
import { Segmente } from '../Segmente.jsx';
import { Feuille } from '../Feuille.jsx';
import { Faits, Fait } from '../Faits.jsx';
import { Plaque } from '../Plaque.jsx';
import { LogoSite } from '../LogoSite.jsx';   // (20 nov. soir) le logo du site de chaque annonce
import { Vide } from '../Vide.jsx';
import { Attente } from '../Attente.jsx';
import { attrsAttente } from '../outils.js';   // (25 nov., chargement propre) « mis à jour » en cours de lecture = un squelette
import { Toast } from '../Toast.jsx';
import { useOrdinateur } from '../Coque.jsx';
import '../jetons.css';
import '../natif.css';
import './annonces.css';
import AnnoncesTableau from './AnnoncesTableau.jsx';   // (19 nov. soir) l'ordinateur : le tableau de travail
import { Glyphe } from '../icones.jsx';
import { groupesParCompte, lireReplis, ecrireReplis } from './annoncesComptes.js';
import { BadgeLectureSeule } from '../../agir/Agir.jsx';   // (24 nov., lot agir-si-connecte)   // (20 nov.) la liste divisée par compte
import { CarteAnnonce, RangeeArticle, lireVueTel, ecrireVueTel, traceDe, texteTrace, seulementBloque, bandeauDe, tailleDansTitre } from './AnnoncesCartes.jsx';   // (21 nov.) la grille « Dressing »
import { depuisMaj } from '../TableauTravail.jsx';
import GrilleInventaire from '../visuel/GrilleInventaire.jsx';
import { useArrive } from '../Jeu.jsx';
import { Puce } from '../Puce.jsx';   // (24 nov., visuel-annonces) les puces de filtre, natives
import { AvatarCompte } from '../visuel/Inventaire.jsx';   // (24 nov.) le rond du compte, le même que sur ses tuiles   // (24 nov., lot visuel-annonces) la grille d'inventaire virtualisée

const PAR_PAGE = 60;
// Les segments (audit d'utilité du 19 nov.) : En ligne · À publier · Dorment.
const ETATS = ['enligne', 'apublier', 'dorment'];
// (21 nov.) « Bloqués » : le segment n'apparaît que s'il y a la dernière trace d'un compte bloqué (jamais un segment vide).
const ETATS_AVEC_BLOQUE = [...ETATS, 'bloque'];
// (24 nov.) Une annonce vendue d'après l'e-mail de vente (Vinted pas encore relu) le dit : « Vendue · par e-mail, en attente de Vinted ».
const etatMot = (e, x) => (e === 'vendue' && x && x.venteMail ? tr('vm.statut') : tr('egalite.etatAnnonce.' + e));

// Ce que dit la 2e ligne d'une rangée (20 nov., Julien : « améliore le visuel » — NATIF §1 bis) : COURTE, après la plaque N° :
// « T. 40 · sur 2 sites · acheté 30 € ». Le compte et le site sont dans l'en-tête du groupe (la liste est divisée par compte) ;
// un fait INCONNU ne s'écrit jamais sur la ligne (plus de « acheté — » / « mini — » répétés) : le manque est dit UNE fois,
// en tête du groupe (« 5 prix d'achat à compléter »).
function sousDe(a, nomSite, filtreSite, euros = (n) => String(n)) {
  const bouts = [];
  if (a.taille) bouts.push(tr('egalite.taille', { t: a.taille }));
  // (20 nov. soir) Les sites de l'article sont dits par leurs logos, devant le N° : plus de « sur N sites ».
  if (a.etat !== 'enligne') bouts.push(etatMot(a.etat, a));
  if (a.achat != null) bouts.push(tr('egalite.achete', { p: euros(a.achat) }));
  // (20 nov.) « à relier » n'est plus sur la ligne : il est dit UNE fois, en tête du groupe (« N à relier › »).
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
function FicheArticle({ a, ouverte, onRetour, euros, depuisTexte, nomSite, onSaisir, onNumero, onPlace, onPrix, onRelier, onFiche, Icon, cote = false, liaison = null }) {
  const l = liaison && a ? liaison.de(a) : null;   // (20 nov.) la ligne du site non relié porte sa proposition, en place
  return (
    <PagePoussee ouverte={ouverte} titre={a ? (a.numero ? tr('egalite.numeroCourt', { n: a.numero }) : a.titre) : ''} libelleRetour={tr('egalite.titre')} onRetour={onRetour} className={cote ? 'n-tt-fiche' : ''} attrs={{ 'data-eg-fiche': a ? a.cle : undefined }}>
      {a ? <>
        <Groupe>
          <Rangee vignette={<Vignette src={a.photo || ''} alt=""/>} titre={a.titre} lignes={2} plaque={a.numero ? <Plaque numero={a.numero} doublon={a.doublon}/> : null}
            sousTitre={[a.taille ? tr('egalite.taille', { t: a.taille }) : '', a.condition, etatMot(a.etat, a)].filter(Boolean).join(' · ')}/>
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
          {a.annonces.map((x) => <Rangee key={x.site + x.id} titre={nomSite(x.site) + (x.pseudo ? ' · ' + x.pseudo : '')} sousTitre={[etatMot(x.etat, x), x.depuis != null ? depuisTexte(x.depuis) : '', x.favoris != null ? tr('egalite.favoris', { n: x.favoris }) : ''].filter(Boolean).join(' · ')}
            valeur={x.prix != null ? euros(x.prix) : null} fin={x.url ? 'chevron' : null} href={x.url || ''} attrs={{ 'data-eg-annonce': x.site + ':' + x.id }}/>)}
          {l && l.etat === 'aRelier' ? <PropositionLiaison l={l} forme="fiche" onRelier={liaison.relier} onAutre={liaison.autre} onPropre={liaison.propre} Photo={liaison.Photo || null}/>
            : a.aRelier && onRelier ? <Rangee ton="ambre" titre={tr('egalite.relier.titre')} sousTitre={tr('egalite.relier.sous')} fin="chevron" onClick={() => onRelier(a)} attrs={{ 'data-eg-relier': a.cle }}/> : null}
        </Groupe>
        {onFiche && a.numero ? <Groupe><Rangee icone={Icon ? <Icon name="list" size={22}/> : null} titre={tr('egalite.touteLaFiche')} fin="chevron" onClick={() => onFiche(a)} attrs={{ 'data-eg-toute-fiche': '' }}/></Groupe> : null}
      </> : null}
    </PagePoussee>
  );
}

export default function VueAnnonces({ articles, comptes = null, filtre = { site: 'tous', etat: 'enligne' }, onFiltre, sites = [], recherche = '', onRecherche,
  aRegler = [], actions: actionsEcran = [], onAction: onActionEcran, onFait, onNumero = null, onPlace = null, onPrix = null, onRelier = null, onRelierAchat = null, onFiche = null, limites = [], manque = '', liaison = null,
  euros = (n) => String(n) + ' €', depuisTexte = () => '', nomSite = (s) => s, Icon = null, onPublier = null, onEcranSite = null, travail = null,
  filtreSite = true, Logo = null, onCompleter = null, dortDe = null, plusVueDe = null, Photo = null, formeRangee = 'a', videAction = null, priorite = null, photoDouble = null, parMail = null }) {   // (22 nov., choix 27) plusVueDe(a) → jours ou null   // (22 nov., choix n° 35) photoDouble : { n, contenu } — le segment « Photo en double »   // (21 nov., prio-recherche) priorite : { n, contenu, plein } — le segment « À republier »   // (21 nov., ux-reglages) videAction : LE geste de l'état vide (« Relier un compte »)   // (21 nov., 2e passe) formeRangee : 'a' | 'b'   // (21 nov.) dortDe(a) → jours (règle « Dorment ») ou null   // Logo(site) : le logo d'un site ; onCompleter(sujet) : ouvre « Compléter »   // (20 nov.) faux ⇒ le site vient du sélecteur global de l'app : pas de menu des sites ici
  const ordinateur = useOrdinateur();
  // (20 nov.) RELIER DEPUIS LA LISTE : l'état du lien et LA proposition de chaque annonce (`liaison.de(a)`, lu dans
  // src/liaisonEtat.js) ; « Relier les N sûres » est une action de la sélection comme les autres (la relecture, puis un geste).
  const lienDe = (a) => (liaison && a ? liaison.de(a) : null);
  const actionLot = liaison ? { cle: 'relierSurs', libelle: tr('liaL.lot'), icone: 'link', phrase: tr('liaL.lotPhrase'),
    pour: (a) => { const l = lienDe(a); return !!(l && l.etat === 'aRelier' && l.prop && l.prop.niveau === 'sur'); },
    juger: (sel) => (sel.length ? { ok: true } : { ok: false, raison: tr('liaL.lotAucune') }) } : null;
  const actions = actionLot && (Array.isArray(actionsEcran) ? actionsEcran : []).every((x) => x.cle !== 'relierSurs') ? [...(actionsEcran || []), actionLot] : (actionsEcran || []);
  const onAction = (cle, sel) => { if (cle === 'relierSurs' && liaison) { liaison.lot(sel.map((a) => lienDe(a)).filter(Boolean)); return; } if (onActionEcran) onActionEcran(cle, sel); };
  const [reglerOuvert, setReglerOuvert] = React.useState(false);
  const [menuSites, setMenuSites] = React.useState(false);
  const [menuActions, setMenuActions] = React.useState(false);
  const [action, setAction] = React.useState(null);          // l'action choisie ⇒ la liste est en SÉLECTION
  const [sel, setSel] = React.useState(() => new Set());
  const [ouvert, setOuvert] = React.useState('');            // la clé de l'article ouvert
  const [saisie, setSaisie] = React.useState(null);          // { article, champ }
  const [dit, setDit] = React.useState(null);                // le toast
  const [max, setMax] = React.useState(PAR_PAGE);
  const [replis, setReplis] = React.useState(lireReplis);   // (20 nov.) les comptes repliés (cet appareil)
  const basculerRepli = (cle) => setReplis((r) => { const n = new Set(r); if (n.has(cle)) n.delete(cle); else n.add(cle); ecrireReplis(n); return n; });
  React.useEffect(() => { setMax(PAR_PAGE); }, [filtre.site, filtre.etat, recherche]);
  const liste = Array.isArray(articles) ? articles : [];
  const visibles = liste.slice(0, max);
  // (20 nov., Julien : « divise par comptes ») Un groupe par compte, au site choisi ; seuls les groupes qui ont un résultat.
  // Chaque compte montre ses `max` premières annonces (« Voir N de plus » les allonge toutes) : un compte n'est jamais caché
  // derrière la pagination d'un autre.
  // (24 nov., lot visuel-annonces — « la praticité ») Au pouce, sous les segments : un tri et des puces (Sans N°, À confirmer, un
  // compte). Elles filtrent ce que l'écran a DÉJÀ donné (aucune lecture, aucune règle) ; « Dorment » reste un segment.
  const [puce, setPuce] = React.useState('');
  const [tri, setTri] = React.useState('recent');
  const [menuTri, setMenuTri] = React.useState(false);
  const groupesTous = React.useMemo(() => groupesParCompte(liste, filtre.site), [liste, filtre.site]);
  const listeVue = React.useMemo(() => {
    let l = liste;
    if (puce === 'sansnum') l = l.filter((a) => !a.numero);
    else if (puce === 'aconfirmer') l = l.filter((a) => a.annonces.some((x) => x.etat === 'aconfirmer'));
    else if (puce.startsWith('compte:')) { const g = groupesTous.find((x) => 'compte:' + x.cle === puce); const dans = new Set(g ? g.articles.map((a) => a.cle) : []); l = l.filter((a) => dans.has(a.cle)); }
    const n = (v) => (v == null ? -Infinity : v);
    if (tri === 'prixHaut') l = l.slice().sort((x, y) => n(y.prix) - n(x.prix));
    else if (tri === 'prixBas') l = l.slice().sort((x, y) => (x.prix == null ? Infinity : x.prix) - (y.prix == null ? Infinity : y.prix));
    else if (tri === 'vues') l = l.slice().sort((x, y) => n(y.vues) - n(x.vues));
    else if (tri === 'favoris') l = l.slice().sort((x, y) => n(y.favoris) - n(x.favoris));
    else if (tri === 'anciennes') l = l.slice().sort((x, y) => (x.depuis == null ? Infinity : x.depuis) - (y.depuis == null ? Infinity : y.depuis));
    return l;
  }, [liste, puce, tri, groupesTous]);
  const groupes = React.useMemo(() => groupesParCompte(listeVue, filtre.site), [listeVue, filtre.site]);
  // (24 nov., lot visuel-annonces) « Sans latence » : le contenu DÉJÀ connu s'affiche tel quel ; seule la liste qui ARRIVE (la
  // lecture finie pendant que l'écran est ouvert) se dévoile, une fois (GrilleInventaire fige les rangs). Calculé AU RENDU.
  const arrivee = React.useRef({ vide: articles === undefined, liste: null });
  if (articles === undefined) arrivee.current.vide = true;
  else if (arrivee.current.vide && Array.isArray(articles)) { arrivee.current.vide = false; arrivee.current.liste = articles; }
  // `useArrive` (Jeu.jsx) : déjà montrée une fois dans la session (retour sur l'onglet) ⇒ plus jamais de cascade.
  const arriveeSession = useArrive(Array.isArray(articles), 'annonces');
  const enArrivee = arriveeSession && Array.isArray(articles) && articles === arrivee.current.liste;
  // La cascade continue d'un compte au suivant : chacun compte les cases de SA 1re fenêtre (5 rangées ; 2 colonnes en « Détaillé »).
  const debutDe = (cle) => { let n = 0; for (const g of groupes) { if (g.cle === cle) return n; if (!replis.has(g.cle)) n += Math.min(g.articles.length, vueTel === 'grille' ? 10 : 5); } return n; };
  const resteGroupes = groupes.reduce((n, g) => n + Math.max(0, g.articles.length - max), 0);
  const A = action ? actions.find((x) => x.cle === action) : null;
  const cochable = (a) => !A || !A.pour || A.pour(a);
  const choisis = liste.filter((a) => sel.has(a.cle));
  const jugement = A && A.juger ? A.juger(choisis) : { ok: choisis.length > 0, raison: '' };
  const basculer = (a) => { if (!cochable(a)) return; setSel((s) => { const n = new Set(s); if (n.has(a.cle)) n.delete(a.cle); else n.add(a.cle); return n; }); };
  const toutCocher = () => { const tous = liste.filter(cochable); setSel((s) => (tous.every((a) => s.has(a.cle)) ? new Set() : new Set(tous.map((a) => a.cle)))); };
  const quitter = () => { setAction(null); setSel(new Set()); };
  const lancer = () => { if (!A || !jugement.ok) return; const c = choisis; quitter(); if (onAction) onAction(A.cle, c); };
  // (19 nov., fiche directe — Julien : « je dois cliquer sur la paire puis […] pour avoir des informations ») UN toucher : un
  // article qui a son N° ouvre LA fiche complète (`onFiche`) ; sans N°, la fiche courte d'ici (il n'a pas encore de fiche).
  const ouvrir = (a) => { if (A) basculer(a); else if (onFiche && a.numero) onFiche(a); else setOuvert(a.cle); };
  const saisir = (a, champ) => setSaisie({ article: a, champ });
  const articleOuvert = ouvert ? liste.find((a) => a.cle === ouvert) || null : null;
  const nSite = (s) => (comptes && comptes[s] ? comptes[s][filtre.etat] : null);
  const nBloque = comptes && comptes[filtre.site] ? comptes[filtre.site].bloque || 0 : 0;
  // (21 nov., prio-recherche) « À republier » : un segment de plus quand l'écran donne la liste du jour (src/republierPriorite.js).
  // (22 nov., choix n° 35) « Photo en double » : un segment de plus SEULEMENT quand la règle en signale (ou qu'on y est).
  const avecPhoto = !!photoDouble && (photoDouble.n > 0 || filtre.etat === 'photodouble');
  const ETATS_BASE = [...ETATS, ...(priorite ? ['arepublier'] : []), ...(avecPhoto ? ['photodouble'] : [])];
  const ETATS_VUS = nBloque || filtre.etat === 'bloque' ? [...ETATS_BASE, 'bloque'] : ETATS_BASE;
  const enPhoto = !!photoDouble && filtre.etat === 'photodouble';
  const enPrio = (!!priorite && filtre.etat === 'arepublier') || enPhoto;   // une vue à elle (son contenu, pas la liste)
  // Quatre segments sur 390 : le nombre seulement sur le segment choisi (sinon « À publ… » est coupé) ; le nombre de chacun reste lu
  // par le lecteur d'écran et dans `data-eg-segment-n`.
  const optionsEtat = ETATS_VUS.map((e) => { const nE = e === 'arepublier' ? (priorite && Number.isFinite(priorite.n) ? priorite.n : undefined) : e === 'photodouble' ? (photoDouble && Number.isFinite(photoDouble.n) ? photoDouble.n : undefined) : comptes && comptes[filtre.site] ? comptes[filtre.site][e] : undefined;
    return { cle: e, libelle: e === 'photodouble' ? tr('photoDouble.segment') : tr('egalite.etat.' + e), n: (ETATS_VUS.length > 3 && e !== filtre.etat) || (e === 'arepublier' && ETATS_VUS.length > 3) ? undefined : nE, attrs: { 'data-eg-segment': e, 'data-eg-segment-n': nE != null ? String(nE) : undefined, 'aria-label': nE != null ? tr('egalite.etat.' + e) + ' · ' + nE : undefined } }; });
  // (21 nov.) La vue du téléphone : GRILLE de cartes (le Dressing de Bleam) ou LISTE (les « Articles » de Vintex), mémorisée.
  const [vueTel, setVueTel] = React.useState(lireVueTel);
  const basculerVue = () => setVueTel((v) => { const n = v === 'grille' ? 'liste' : 'grille'; ecrireVueTel(n); return n; });
  const [gestesDe, setGestesDe] = React.useState('');
  const [reglerTel, setReglerTel] = React.useState(false);      // la clé de l'article dont la feuille des gestes est ouverte
  const majLe = travail ? travail.majLe : undefined;
  const [maintenantMaj, setMaintenantMaj] = React.useState(() => Date.now());
  React.useEffect(() => { setMaintenantMaj(Date.now()); const t = setInterval(() => setMaintenantMaj(Date.now()), 30000); return () => clearInterval(t); }, [majLe]);
  const lesSites = ['tous', ...sites];

  const plein = enPhoto ? null : enPrio ? (priorite.plein || null) : A
    ? <Bouton variante="plein" indisponible={!jugement.ok} raison={!jugement.ok ? (jugement.raison || tr('egalite.selection.aucune')) : ''} onClick={lancer} attrs={{ 'data-eg-lancer': A.cle, 'data-eg-n': String(choisis.length) }}>{tr('egalite.selection.lancer', { action: A.libelle, n: choisis.length })}</Bouton>
    // (20 nov., affichage instantané) Aucun bouton d'action au-dessus d'un squelette : la liste pas encore lue, pas de « Publier ».
    // (21 nov., captures iPhone de Julien) Au téléphone, plus de grand plein « Publier un article » collé sur la barre : le geste
    // est dans « ⋯ » (et le « + » de la barre). L'ordinateur (sans tableau de travail) le garde.
    : (onPublier && articles !== undefined && ordinateur ? <Bouton variante="plein" onClick={onPublier} attrs={{ 'data-eg-publier': '' }}>{tr('egalite.publier')}</Bouton> : null);

  const tete = (
    <div className="n-eg-tete" data-eg-tete="">
      <Segmente libelle={tr('egalite.etat.libelle')} valeur={filtre.etat} onChange={(e) => onFiltre({ ...filtre, etat: e })} options={optionsEtat}/>
      <div className="n-eg-outils" data-eg-outils={A || (filtreSite && sites.length > 1) ? '1' : undefined}>
        {A ? <>
          <Bouton variante="texte" onClick={toutCocher} attrs={{ 'data-eg-tout': '' }}>{liste.filter(cochable).every((a) => sel.has(a.cle)) && sel.size ? tr('egalite.selection.rien') : tr('egalite.selection.tout')}</Bouton>
          <Bouton variante="texte" onClick={quitter} attrs={{ 'data-eg-annuler': '' }}>{tr('egalite.selection.annuler')}</Bouton>
        </> : (filtreSite && sites.length > 1 ? <Bouton variante="texte" onClick={() => setMenuSites(true)} attrs={{ 'data-eg-filtre': filtre.site }}>{filtre.site === 'tous' ? tr('egalite.site.titre') : tr('egalite.site.titre') + ' · ' + nomSite(filtre.site)}</Bouton> : null)}
      </div>
      {A ? <p className="n-eg-phrase" data-eg-phrase={A.cle}>{A.phrase}</p> : null}
    </div>
  );

  // Une cellule du tableau : la valeur, ou « — » qui se touche et ouvre SA saisie.
  const cellule = (a, cle, valeur, onModifier) => (
    <td className="n-eg-td" data-eg-col={cle} data-eg-vide={valeur == null ? '1' : undefined}>
      {onModifier && !A ? <button type="button" data-n-famille="lien" className="n-eg-cellule" data-eg-modifier={cle} aria-label={(valeur == null ? '— · ' : typeof valeur === 'string' || typeof valeur === 'number' ? String(valeur) + ' · ' : '') + tr('egalite.modifier', { quoi: tr('egalite.col.' + cle), article: a.titre })} onClick={(e) => { e.stopPropagation(); onModifier(); }}>{valeur == null ? '—' : valeur}</button>
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
                  <span className="n-eg-article-sous">{[a.taille ? tr('egalite.taille', { t: a.taille }) : '', a.condition, a.etat !== 'enligne' ? etatMot(a.etat, a) : ''].filter(Boolean).join(' · ') || ' '}</span></span></td>
                <td className="n-eg-td" data-eg-col="numero">{a.numero ? <Plaque numero={a.numero} doublon={a.doublon}/> : (onNumero && !A ? <button type="button" data-n-famille="lien" className="n-eg-cellule" data-eg-modifier="numero" aria-label={'— · ' + tr('egalite.modifier', { quoi: tr('egalite.col.numero'), article: a.titre })} onClick={(e) => { e.stopPropagation(); onNumero(a); }}>—</button> : <span className="n-eg-valeur">—</span>)}</td>
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

  // (19 nov. soir, NATIF.md §2 bis) À l'ordinateur : le TABLEAU DE TRAVAIL (barre d'outils, Statut à compteurs, colonnes,
  // sélection). Mêmes articles, mêmes saisies, mêmes actions ; la fiche s'ouvre en panneau à droite, la liste reste visible.
  const actionsTableau = actions;
  // (24 nov., vente-mail-annonce) Les annonces VENDUES d'après l'e-mail de vente, Vinted pas encore relu : hors d'« En ligne » et des
  // totaux, dites ici une fois (gris, jamais ambre) — « Vendue · par e-mail, en attente de Vinted » ; un toucher ouvre SA fiche.
  const parMailHaut = Array.isArray(parMail) && parMail.length && filtre.etat === 'enligne' && !A ? <Groupe titre={tr('vm.statut')} attrs={{ 'data-vm-annonces': String(parMail.length) }}>
    {parMail.map((a) => <Rangee key={a.cle} vignette={<Vignette src={a.photo || ''} alt="" taille={44} image={a.photo && Photo ? Photo(a.photo) : null}/>} titre={a.titre || tr('egalite.sansTitre')} lignes={2}
      plaque={a.numero ? <Plaque numero={a.numero}/> : null} sousTitre={(a.annonces || []).map((x) => x.pseudo).filter(Boolean)[0] || ''} fin={onFiche && a.numero ? 'chevron' : null}
      onClick={onFiche && a.numero ? () => onFiche(a) : null} attrs={{ 'data-vm-annonce': a.cle, 'data-vm-annonce-num': a.numero || '' }}/>)}
  </Groupe> : null;
  const aReglerHaut = aRegler.length ? <Groupe titre={tr('egalite.aRegler')} repli={{ ouvert: reglerOuvert, onBascule: () => setReglerOuvert((o) => !o), n: aRegler.length }} attrs={{ 'data-eg-regler': String(aRegler.length) }}>
    {aRegler.map((r) => <Rangee key={r.cle} titre={r.titre} sousTitre={r.sousTitre || ''} valeur={r.valeur != null ? r.valeur : null} ton={r.doublon ? 'neutre' : 'ambre'} plaque={r.doublon ? <Plaque numero={r.doublon} doublon/> : null} fin={r.onClick ? 'chevron' : null} onClick={r.onClick || null} attrs={{ 'data-eg-regle': r.cle }}/>)}
  </Groupe> : null;
  const listeTableau = travail && Array.isArray(travail.articles) ? travail.articles : (travail ? travail.articles : undefined);
  const articleOuvertT = ouvert && Array.isArray(listeTableau) ? (listeTableau.find((x) => x.a.cle === ouvert) || {}).a || null : null;
  if (ordinateur && travail && !enPrio) {
    return (
      <>
        <AnnoncesTableau site={travail.site || 'tous'} Logo={Logo} dortDe={dortDe} plusVueDe={plusVueDe} Photo={Photo} liaison={liaison} articles={listeTableau} filtres={travail.filtres || []} compte={travail.compte || ''} majLe={travail.majLe} onRafraichir={travail.onRafraichir} rafraichit={!!travail.rafraichit}
          actions={actionsTableau} onAction={onAction} onOuvrir={(a) => { if (onFiche && a.numero) onFiche(a); else setOuvert(a.cle); }} saisir={saisir} onNumero={onNumero} onPrix={onPrix} onRelier={onRelier} onRelierAchat={onRelierAchat} onFiche={onFiche}
          onPublier={onPublier || null}
          haut={<>{parMailHaut}{aReglerHaut}</>} pied={manque || ''} onAutomatisations={travail.onAutomatisations || null} euros={euros} depuisTexte={depuisTexte} nomSite={nomSite} Icon={Icon} sites={sites}/>
        <FeuilleFait cible={saisie} euros={euros} onFait={onFait} onFermer={(ok) => { const s = saisie; setSaisie(null); if (ok && s) setDit({ id: Date.now(), message: tr('egalite.enregistre', { quoi: tr('egalite.col.' + (s.champ === 'min' ? 'prixMini' : 'achat')) }) }); }}/>
        <FicheArticle liaison={liaison} a={articleOuvertT} ouverte={!!articleOuvertT} cote onRetour={() => setOuvert('')} euros={euros} depuisTexte={depuisTexte} nomSite={nomSite} onSaisir={saisir}
          onNumero={onNumero} onPlace={onPlace} onPrix={onPrix} onRelier={onRelier} onFiche={onFiche} Icon={Icon}/>
        {dit ? <Toast key={dit.id} message={dit.message} onFin={() => setDit(null)}/> : null}
      </>
    );
  }

  // ── le téléphone (21 nov., « Dressing » + « Articles ») ───────────────────────────────────────────────────────
  // En haut, UNE barre : la recherche, la bascule grille ⇄ liste, « ⋯ » (Actions). Dessous, les segments, puis UNE ligne
  // discrète « Mis à jour il y a 18 min · ⟳ ». Puis la liste, divisée par compte : un intertitre (logo · pseudo · N), au plus une
  // ligne ambre par geste à faire, puis les cartes (grille) ou les rangées (liste). Rien d'autre n'est empilé.
  const vueG = vueTel === 'grille';
  const lesGestes = (a) => {
    if (!a || seulementBloque(a)) return [];
    const l = lienDe(a);
    const out = actions.filter((x) => x.cle !== 'relierSurs' && (!x.pour || x.pour(a))).map((x) => ({ cle: 'action:' + x.cle, libelle: x.libelle, icone: x.icone,
      onClick: () => { const j = x.juger ? x.juger([a]) : { ok: true }; if (j && j.ok) onAction(x.cle, [a]); else setDit({ id: Date.now(), message: (j && j.raison) || tr('egalite.selection.aucune') }); } }));
    // (23 nov.) « Relier un achat » : EN TÊTE quand l'article n'a pas d'achat relié ; sinon « Achat relié » (sa fiche : Délier, Reçu).
    if (onRelierAchat) { const g = { cle: 'relierAchat', libelle: a.achat == null ? tr('ventes.relierAchat2') : tr('ru.ann.achatRelie'), icone: 'link', onClick: () => onRelierAchat(a) }; if (a.achat == null) out.unshift(g); else out.push(g); }
    out.push({ cle: 'mini', libelle: tr('egalite.saisie.min'), icone: 'tag', onClick: () => saisir(a, 'min') });
    out.push({ cle: 'achat', libelle: tr('egalite.saisie.buyPrice'), icone: 'pencil', onClick: () => saisir(a, 'buyPrice') });
    // (24 nov.) « Copier le lien » : l'adresse LUE de l'annonce (jamais fabriquée) ; sans adresse, pas de geste.
    const url = (a.annonces.find((x) => x && x.url && /^https:\/\//.test(x.url)) || {}).url;
    if (url) out.push({ cle: 'lien', libelle: tr('inv.copier'), icone: 'link', onClick: () => { const dire = (ok) => setDit({ id: Date.now(), message: tr(ok ? 'inv.lienCopie' : 'inv.lienPasCopie') });
      try { navigator.clipboard.writeText(url).then(() => dire(true), () => dire(false)); } catch (_) { dire(false); } } });
    // (le balayage d'avant : « Relier N° » · « Autre… » · « Que sur ce site ») — les mêmes gestes, dans la feuille.
    if (l && l.etat === 'aRelier' && liaison) {
      if (l.prop) out.push({ cle: 'relier', libelle: tr('liaL.relierN', { numero: l.prop.numero }), icone: 'link', ambre: true, onClick: () => liaison.relier(l) });
      out.push({ cle: 'autre', libelle: tr('liaL.autre'), icone: 'link', onClick: () => liaison.autre(l) });
      if (!l.prop) out.push({ cle: 'propre', libelle: tr('liaL.propreCourt'), icone: 'check', onClick: () => liaison.propre(l) });
    }
    else if (a.aRelier && onRelier) out.push({ cle: 'relier', libelle: tr('egalite.relier.titre'), icone: 'link', ambre: true, onClick: () => onRelier(a) });
    return out;
  };
  const articleGestes = gestesDe ? liste.find((x) => x.cle === gestesDe) || null : null;
  const gestesOuverts = articleGestes ? lesGestes(articleGestes) : [];
  const carte = (a, cleCompte, rv = null, etatDit = null) => (
    <CarteAnnonce key={a.cle + '|' + cleCompte} a={a} revele={rv} groupe etatDit={etatDit} onOuvrir={ouvrir} onGestes={(x) => setGestesDe(x.cle)} euros={euros} depuisTexte={depuisTexte} nomSite={nomSite} Icon={Icon}
      Photo={Photo} dort={dortDe && !A ? dortDe(a) : null} plusVue={plusVueDe && !A ? plusVueDe(a) : null}
      selection={A ? { cochee: sel.has(a.cle), cochable: cochable(a), onBascule: () => basculer(a) } : null}
      attrs={{ 'data-eg-article': a.cle, 'data-eg-sites': a.sites.join(','), 'data-eg-numero': a.numero || '', 'data-eg-coche': A ? (sel.has(a.cle) ? '1' : '0') : undefined, 'data-eg-compte': cleCompte }}/>
  );
  // La liste « Articles » au téléphone (21 nov., 2e passe) : `RangeeArticle`, forme A ou B (`formeRangee`), pleine largeur, filets fins.
  // Glisser la rangée : « Baisser le prix » et « Republier » (les actions EXISTANTES de l'écran, jugées sur cet article).
  const rapidesDe = (a) => {
    if (A || seulementBloque(a)) return null;
    const out = [];
    for (const cle of ['baisser', 'recreer']) {
      const x = actions.find((y) => y.cle === cle); if (!x || (x.pour && !x.pour(a))) continue;
      out.push({ cle, libelle: cle === 'baisser' ? tr('inv.rapide.baisser') : tr('inv.rapide.republier'), icone: x.icone || (cle === 'baisser' ? 'tag' : 'sync'),
        onClick: () => { const j = x.juger ? x.juger([a]) : { ok: true }; if (j && j.ok) onAction(x.cle, [a]); else setDit({ id: Date.now(), message: (j && j.raison) || tr('egalite.selection.aucune') }); } });
    }
    return out.length ? out : null;
  };
  const rangeeTel = (a, cleCompte, rv = null, etatDit = null) => (
    <RangeeArticle key={a.cle + '|' + cleCompte} a={a} forme={formeRangee} groupe etatDit={etatDit} revele={rv} rapides={rapidesDe(a)} onOuvrir={ouvrir} onGestes={(x) => setGestesDe(x.cle)} euros={euros} depuisTexte={depuisTexte}
      nomSite={nomSite} Icon={Icon} Photo={Photo} plusVue={plusVueDe && !A ? plusVueDe(a) : null} selection={A ? { cochee: sel.has(a.cle), cochable: cochable(a), onBascule: () => basculer(a) } : null}
      attrs={{ 'data-eg-article': a.cle, 'data-eg-sites': a.sites.join(','), 'data-eg-numero': a.numero || '', 'data-eg-coche': A ? (sel.has(a.cle) ? '1' : '0') : undefined, 'data-eg-compte': cleCompte }}/>
  );
  // (25 nov., régressions — capture iPhone de Julien : « Pas revue récemment » écrit sur CHAQUE rangée) Une même phrase sur
  // chaque ligne est UNE phrase, dans l'en-tête du groupe (CLAUDE.md §7) : dès que deux rangées d'un compte portent le même
  // état « à confirmer », l'en-tête le dit une fois (avec leur nombre quand ce ne sont pas toutes) ; chaque rangée concernée ne
  // garde qu'un point discret (son nom au lecteur d'écran). Aucune règle ne change : c'est l'état de `bandeauDe`.
  const etatGroupe = (g) => {
    const k = g.articles.filter((a) => bandeauDe(a) === 'aconfirmer').length;
    return k >= 2 ? { cle: 'aconfirmer', n: k, tous: k === g.articles.length } : null;
  };
  const enTeteCompte = (g, n) => {
    const titre = g.cle === 'sans' ? tr('egalite.groupe.sansCompte') : (g.pseudo || ('#' + g.compte));
    const eg = etatGroupe(g);
    const ouvertG = !replis.has(g.cle);
    const bloque = g.articles.length > 0 && g.articles.every((x) => x.annonces.some((y) => y.etat === 'bloque' && (y.site + ':' + y.compte) === g.cle));
    const trace = bloque ? g.articles.map(traceDe).filter((t) => t && t.le != null).sort((x, y) => y.le - x.le)[0] || null : null;
    return (
      <div className="n-ad-tete-compte" data-ad-bloque={bloque ? '1' : undefined}>
        <button type="button" className="n-ad-compte" data-n-famille="rangee" aria-expanded={ouvertG ? 'true' : 'false'} onClick={() => basculerRepli(g.cle)} data-ad-repli={g.cle}>
          {Logo && g.site ? <span className="n-eg-compte-logo" aria-hidden="true">{Logo(g.site)}</span> : null}
          {g.cle !== 'sans' ? <AvatarCompte pseudo={titre} cle={g.cle} petit/> : null}
          <span className="n-ad-compte-nom">{titre}<span className="n-ad-compte-n"> · {n}</span></span>
          {g.site ? <span className="n-eg-sr"> · {nomSite(g.site)} · {tr('egalite.groupe.n', { n })}</span> : null}
          {bloque ? <span className="n-ad-etiquette" data-ad-bandeau="bloque">{tr('tableau.etat.bloque')}</span> : null}
          {/* (24 nov.) « Lecture seule » : l'extension n'a ce compte dans aucun onglet — ses annonces restent visibles, ses gestes éteints. */}
          {['vinted', 'leboncoin', 'vestiaire'].includes(g.site) && g.compte ? <BadgeLectureSeule site={g.site} compte={g.compte}/> : null}
          {!bloque && eg ? <span className="n-ad-etiquette" data-ad-bandeau={eg.cle} data-ad-etat-groupe={String(eg.n)}>{tr('tableau.etat.' + eg.cle) + (eg.tous ? '' : ' · ' + eg.n)}</span> : null}
          <span className="n-ad-chevron" data-ouvert={ouvertG ? '1' : '0'} aria-hidden="true"><Glyphe nom="chevron" taille={16}/></span>
        </button>
        {bloque && ouvertG ? <p className="n-ad-phrase" data-ad-phrase-bloque="">{trace ? tr('egalite.d.bloque.phraseDate', { d: texteTrace(trace) }) : tr('egalite.d.bloque.phrase')}</p> : null}
      </div>
    );
  };
  // (21 nov., audit-design §11 + captures de Julien) « 22 prix d'achat à compléter » n'est plus en tête de CHAQUE compte : UNE rangée
  // « À régler » sous les segments, pour tout l'écran (point ambre). Un seul sujet ⇒ elle mène droit au geste ; deux ⇒ une feuille.
  const aRelTous = !A && (onRelier || liaison) ? liste.filter((x) => x.aRelier || (lienDe(x) && lienDe(x).etat === 'aRelier')) : [];
  const sansAchatTous = !A && onCompleter ? liste.filter((x) => x.numero && x.achat == null && !seulementBloque(x)).length : 0;
  const sujets = [];
  if (aRelTous.length) sujets.push({ cle: 'relier', n: aRelTous.length, libelle: tr('egalite.groupe.aRelier', { n: aRelTous.length }),
    go: () => { const l0 = lienDe(aRelTous[0]); if (l0 && liaison) liaison.autre(l0); else if (onRelier) onRelier(aRelTous[0]); } });
  if (sansAchatTous) sujets.push({ cle: 'achat', n: sansAchatTous, libelle: tr('egalite.groupe.achats', { n: sansAchatTous }), go: () => onCompleter('achat') });
  // (21 nov., 2e passe) « À régler » et « Mis à jour » sur UNE ligne fine : « Mis à jour il y a 18 min · ● 24 à régler › · ⟳ ».
  const nRegler = sujets.reduce((t, x) => t + x.n, 0);
  const aReglerTel = sujets.length ? (
    <button type="button" data-n-famille="lien" className="n-ad-afaire n-ad-aregler" data-ad-aregler={String(nRegler)} aria-label={tr('egalite.d.aReglerN', { n: nRegler }) + ' · ' + sujets.map((x) => x.libelle).join(' · ')}
      onClick={() => (sujets.length === 1 ? sujets[0].go() : setReglerTel(true))}>
      <span className="n-ad-point" aria-hidden="true"/><span className="n-ad-afaire-texte">{tr('egalite.d.aReglerN', { n: nRegler })}</span><Glyphe nom="chevron" taille={14}/>
    </button>) : null;
  const barreHaut = (
    <div className="n-eg-recherche">
      <ChampRecherche valeur={recherche} onChange={onRecherche} placeholder={tr('egalite.chercher')} libelle={tr('egalite.chercherNom')}/>
      {(actions.length || onPublier || (onEcranSite && filtre.site !== 'tous')) && !A && articles !== undefined ? <BoutonIcone libelle={tr('egalite.actions')} icone={<Glyphe nom="more" taille={22}/>} onClick={() => setMenuActions(true)} attrs={{ 'data-eg-actions': '' }}/> : null}
    </div>
  );
  // (24 nov., lot visuel-annonces) Le squelette a la FORME finale : l'intertitre d'un compte, puis la grille aux mêmes cases.
  const attenteGrille = <div data-ad-attente="" aria-busy="true" aria-label={tr('inv.chargement')}><section className="n-ad-section"><div className="n-ad-tete-compte n-inv-tete-os" aria-hidden="true"><span className="n-os"/></div>
    <GrilleInventaire items={undefined} attente={6} corps={96}/></section></div>;
  return (
    <>
      <Page titre={tr('egalite.titre')} plein={plein} attrs={{ 'data-eg-ecran': '', 'data-eg-site': filtre.site, 'data-eg-etat': filtre.etat, 'data-eg-selection': A ? A.cle : undefined, 'data-eg-vue': ordinateur ? 'tableau' : 'liste', 'data-ad-vue': vueG ? 'grille' : 'liste' }}
        recherche={barreHaut}>
        {tete}
        {/* Pendant la lecture, la rangée des puces est déjà là (même hauteur) : rien ne saute à l'arrivée. */}
        {!A && !enPrio && articles === undefined && !ordinateur ? <div className="n-ad-puces" aria-hidden="true" data-ad-puces-os="">{[96, 84, 110].map((w) => <span key={'os-' + w} className="n-ad-puce"><span className="n-ad-puce-pilule n-os" style={{ width: w }}/></span>)}</div> : null}
        {!A && !enPrio && Array.isArray(articles) && liste.length ? <div className="n-ad-puces" role="toolbar" aria-label={tr('inv.puces')} data-ad-puces="">
          <Puce className="n-ad-puce" onClick={() => setMenuTri(true)} attrs={{ 'data-ad-tri': tri, 'aria-haspopup': 'dialog' }}><span className="n-ad-puce-pilule">{Icon ? <Icon name="filter" size={15}/> : null}{tr('inv.tri.' + tri)}</span></Puce>
          {[['sansnum', liste.filter((a) => !a.numero).length], ['aconfirmer', liste.filter((a) => a.annonces.some((x) => x.etat === 'aconfirmer')).length]].filter(([, k]) => k > 0 || puce)
            .map(([c, k]) => <Puce key={c} className="n-ad-puce" presse={puce === c} onClick={() => setPuce((p) => (p === c ? '' : c))} attrs={{ 'data-ad-puce': c, 'data-ad-puce-n': String(k) }}><span className="n-ad-puce-pilule">{tr('inv.puce.' + c)}<span className="n-ad-puce-n">{k}</span></span></Puce>)}
          {groupesTous.length > 1 ? groupesTous.filter((g) => g.cle !== 'sans').map((g) => <Puce key={g.cle} className="n-ad-puce" presse={puce === 'compte:' + g.cle} attrs={{ 'data-ad-puce': 'compte:' + g.cle }}
            onClick={() => setPuce((p) => (p === 'compte:' + g.cle ? '' : 'compte:' + g.cle))}><span className="n-ad-puce-pilule"><AvatarCompte pseudo={g.pseudo || g.compte} cle={g.cle} petit/>{g.pseudo || ('#' + g.compte)}</span></Puce>) : null}
        </div> : null}
        {(travail || aReglerTel) && !A && !ordinateur ? <div className="n-ad-maj" data-ad-maj={!travail ? 'aucun' : majLe === undefined ? 'lecture' : majLe == null ? 'passu' : 'lu'}>
          <span className="n-ad-maj-texte" data-copie-vide="" {...(attrsAttente(!!travail && majLe === undefined, 'valeur') || {})}>{travail ? depuisMaj(majLe, maintenantMaj) : ''}</span>
          {aReglerTel}
          {travail && travail.onRafraichir ? <BoutonIcone libelle={tr('tableau.rafraichir')} indisponible={!!travail.rafraichit} icone={Icon ? <Icon name="sync" size={18}/> : null}
            onClick={() => { if (!travail.rafraichit) travail.onRafraichir(); }} className="n-ad-rafraichir" attrs={{ 'data-ad-rafraichir': '', 'aria-busy': travail.rafraichit ? 'true' : undefined }}/> : null}
        </div> : null}
        {!enPrio ? parMailHaut : null}
        {aRegler.length && !A && !enPrio ? <Groupe titre={tr('egalite.aRegler')} repli={{ ouvert: reglerOuvert, onBascule: () => setReglerOuvert((o) => !o), n: aRegler.length }} attrs={{ 'data-eg-regler': String(aRegler.length) }}>
          {aRegler.map((r) => <Rangee key={r.cle} titre={r.titre} sousTitre={r.sousTitre || ''} valeur={r.valeur != null ? r.valeur : null} ton={r.doublon ? 'neutre' : 'ambre'} plaque={r.doublon ? <Plaque numero={r.doublon} doublon/> : null} fin={r.onClick ? 'chevron' : null} onClick={r.onClick || null} attrs={{ 'data-eg-regle': r.cle }}/>)}
        </Groupe> : null}
        {enPhoto ? photoDouble.contenu : enPrio ? priorite.contenu
          : articles === undefined ? (vueG ? attenteGrille : <div data-ad-attente="" aria-busy="true" aria-label={tr('inv.chargement')}><section className="n-ad-section"><div className="n-ad-tete-compte n-inv-tete-os" aria-hidden="true"><span className="n-os"/></div>
              <GrilleInventaire items={undefined} attente={9} ligne={72} gap={0} squelette={() => <span className="n-ar-os" aria-hidden="true"><span className="n-os n-ar-os-photo"/><span className="n-ar-os-texte"><span className="n-os"/><span className="n-os" data-court=""/></span></span>}/></section></div>)
          : articles === null ? <Vide icone={Icon ? <Icon name="alert" size={40}/> : null} phrase={tr('egalite.pasSu')} detail={manque}/>
          // (20 nov., chasse-bugs) Rien d'affiché ET une lecture ratée (`manque`) : « VRM n'a pas pu lire », jamais « Aucune annonce » (§5 : rien lu ≠ rien).
          : !liste.length && manque && !recherche ? <Vide icone={Icon ? <Icon name="alert" size={40}/> : null} phrase={tr('egalite.pasSu')}/>
          : !liste.length ? <Vide icone={Icon ? <Icon name="tag" size={40}/> : null} phrase={recherche ? tr('egalite.videRecherche') : tr('egalite.vide.' + filtre.etat)} action={!recherche ? videAction : null}/>
          : ordinateur ? tableau
          : <div data-eg-liste="" data-eg-groupes={String(groupes.length)} data-inv-arrivee={enArrivee ? '1' : undefined} data-ad-liste={vueG ? 'grille' : 'liste'}>{groupes.map((g) => {
              const n = g.articles.length;
              const ouvertG = !replis.has(g.cle);
              return (
                <section key={g.cle} className="n-ad-section" data-eg-groupe={g.cle} data-eg-groupe-n={String(n)}>
                  {enTeteCompte(g, n)}
                  {ouvertG ? <>
                    {vueG ? <GrilleInventaire items={g.articles} cle={(a) => a.cle + '|' + g.cle} rendu={(a, i, rv) => carte(a, g.cle, rv, etatGroupe(g))} corps={96} revele={enArrivee} debut={debutDe(g.cle)} attrs={{ 'data-ad-grille': g.cle }}/>
                      : <GrilleInventaire items={g.articles} ligne={72} gap={0} cle={(a) => a.cle + '|' + g.cle} rendu={(a, i, rv) => rangeeTel(a, g.cle, rv, etatGroupe(g))} revele={enArrivee} debut={debutDe(g.cle)} className="n-ar-liste" attrs={{ 'data-ad-forme': formeRangee, 'data-ad-liste-compte': g.cle }}/>}
                  </> : null}
                </section>);
            })}</div>}
        {!enPrio && (ordinateur && liste.length > max) ? <Groupe nu><Bouton variante="texte" large onClick={() => setMax((m) => m + PAR_PAGE)} attrs={{ 'data-eg-plus': '' }}>{tr('egalite.plus', { n: ordinateur ? liste.length - max : resteGroupes })}</Bouton></Groupe> : null}
        {/* (20 nov., « téléphone bâclé ») Sous la liste, seulement ce qui MANQUE (un site pas lu : « rien lu » n'est pas « rien »). */}
        {!enPrio && Array.isArray(articles) && manque ? <Groupe nu pied={manque} attrs={{ 'data-eg-pied': '' }}/> : null}
      </Page>

      <Feuille ouverte={!!articleGestes} onFermer={() => setGestesDe('')} titre={articleGestes ? (articleGestes.numero ? tr('egalite.numeroCourt', { n: articleGestes.numero }) + ' · ' : '') + (articleGestes.titre || '') : ''} attrs={{ 'data-ad-feuille-gestes': articleGestes ? articleGestes.cle : undefined }}>
        {articleGestes ? <>
          {seulementBloque(articleGestes) ? <Groupe nu pied={tr('egalite.d.bloque.aucunGeste')} attrs={{ 'data-ad-aucun-geste': '' }}/> : null}
          {gestesOuverts.length ? <Groupe>{gestesOuverts.map((x) => <Rangee key={x.cle} icone={Icon && x.icone ? <Icon name={x.icone} size={22}/> : null} titre={x.libelle} ton={x.ambre ? 'ambre' : 'neutre'} fin="chevron"
            onClick={() => { setGestesDe(''); x.onClick(); }} attrs={{ 'data-ad-geste': x.cle }}/>)}</Groupe> : null}
          <Groupe><Rangee icone={Icon ? <Icon name="list" size={22}/> : null} titre={tr(articleGestes.numero && onFiche ? 'egalite.touteLaFiche' : 'egalite.d.ouvrir')} fin="chevron"
            onClick={() => { const a = articleGestes; setGestesDe(''); ouvrir(a); }} attrs={{ 'data-ad-geste': 'fiche' }}/></Groupe>
        </> : null}
      </Feuille>

      <Feuille ouverte={menuTri} onFermer={() => setMenuTri(false)} titre={tr('inv.tri.titre')} attrs={{ 'data-ad-menu-tri': '' }}>
        <Groupe>{['recent', 'prixHaut', 'prixBas', 'vues', 'favoris', 'anciennes'].map((t) => <Rangee key={t} titre={tr('inv.tri.' + t)} fin={tri === t ? 'coche' : null}
          onClick={() => { setTri(t); setMenuTri(false); }} attrs={{ 'data-ad-tri-choix': t }}/>)}</Groupe>
      </Feuille>

      <Feuille ouverte={reglerTel && sujets.length > 1} onFermer={() => setReglerTel(false)} titre={tr('egalite.aRegler')} attrs={{ 'data-ad-feuille-regler': '' }}>
        <Groupe>{sujets.map((x) => <Rangee key={x.cle} titre={x.libelle} ton="ambre" fin="chevron" onClick={() => { setReglerTel(false); x.go(); }} attrs={{ 'data-eg-manque': x.cle, 'data-eg-manque-n': String(x.n) }}/>)}</Groupe>
      </Feuille>

      <Feuille ouverte={menuSites} onFermer={() => setMenuSites(false)} titre={tr('egalite.site.titre')} attrs={{ 'data-eg-menu-sites': '' }}>
        <Groupe>{lesSites.map((s) => <Rangee key={s} titre={s === 'tous' ? tr('egalite.site.tous') : nomSite(s)} valeur={nSite(s) != null ? String(nSite(s)) : null} fin={filtre.site === s ? 'coche' : null}
          onClick={() => { onFiltre({ ...filtre, site: s }); setMenuSites(false); }} attrs={{ 'data-eg-site-choix': s }}/>)}</Groupe>
      </Feuille>

      <Feuille ouverte={menuActions} onFermer={() => setMenuActions(false)} titre={tr('egalite.actions')} attrs={{ 'data-eg-menu-actions': '' }}>
        {onPublier && !ordinateur ? <Groupe><Rangee icone={Icon ? <Icon name="plus" size={22}/> : <Glyphe nom="plus" taille={22}/>} titre={tr('egalite.publier')} fin="chevron"
          onClick={() => { setMenuActions(false); onPublier(); }} attrs={{ 'data-eg-publier': '' }}/></Groupe> : null}
        {/* (24 nov.) L'affichage vit ici (plus dans la barre du haut) : Liste par défaut, Détaillé (les tuiles). */}
        {!ordinateur ? <Groupe titre={tr('inv.affichage')} attrs={{ 'data-ad-affichage': vueG ? 'grille' : 'liste' }}>
          {['liste', 'grille'].map((v) => <Rangee key={v} icone={Icon ? <Icon name={v === 'liste' ? 'menu' : 'grid'} size={22}/> : null} titre={tr('inv.vue.' + v)} fin={vueTel === v ? 'coche' : null}
            onClick={() => { setMenuActions(false); if (vueTel !== v) basculerVue(); }} attrs={{ 'data-ad-vue-choix': v }}/>)}
        </Groupe> : null}
        <Groupe>{actions.map((x) => <Rangee key={x.cle} icone={Icon && x.icone ? <Icon name={x.icone} size={22}/> : null} titre={x.libelle} sousTitre={x.court || ''} fin="chevron"
          onClick={() => { setMenuActions(false); setSel(new Set()); setAction(x.cle); }} attrs={{ 'data-eg-action': x.cle }}/>)}</Groupe>
        {/* (21 nov., lot relier-code) « Relier mes achats en série » : annonce après annonce, la meilleure proposition en tête. */}
        {onCompleter && !A ? <Groupe><Rangee icone={Icon ? <Icon name="link" size={22}/> : <Glyphe nom="link" taille={22}/>} titre={tr('la.serie.entreeAnnonces')} fin="chevron"
          onClick={() => { setMenuActions(false); onCompleter('relier-serie'); }} attrs={{ 'data-eg-serie-relier': '' }}/></Groupe> : null}
        {/* (20 nov., « téléphone bâclé ») Les outils propres d'un site vivent ICI, plus en bas de la liste. */}
        {onEcranSite && filtre.site !== 'tous' ? <Groupe><Rangee titre={tr('egalite.ecranSite', { site: nomSite(filtre.site) })} sousTitre={tr('egalite.ecranSite.sous')} fin="chevron"
          onClick={() => { setMenuActions(false); onEcranSite(filtre.site); }} attrs={{ 'data-eg-ecran-site': filtre.site }}/></Groupe> : null}
      </Feuille>

      <FeuilleFait cible={saisie} euros={euros} onFait={onFait} onFermer={(ok) => { const s = saisie; setSaisie(null); if (ok && s) setDit({ id: Date.now(), message: tr('egalite.enregistre', { quoi: tr('egalite.col.' + (s.champ === 'min' ? 'prixMini' : 'achat')) }) }); }}/>

      <FicheArticle liaison={liaison} a={articleOuvert} ouverte={!!articleOuvert} onRetour={() => setOuvert('')} euros={euros} depuisTexte={depuisTexte} nomSite={nomSite} onSaisir={saisir}
        onNumero={onNumero} onPlace={onPlace} onPrix={onPrix} onRelier={onRelier} onFiche={onFiche} Icon={Icon}/>

      {dit ? <Toast key={dit.id} message={dit.message} onFin={() => setDit(null)}/> : null}
    </>
  );
}
