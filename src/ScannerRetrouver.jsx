// ════════════════════════════════════════════════════════════════════════════
//  SCANNER POUR RETROUVER (15 nov.) — Julien : « tu scannes le code-barres d'un colis
//  reçu ou d'un bordereau, et VRM ouvre directement la bonne vente ou le bon achat,
//  grâce au numéro de suivi. Zéro recherche. »
//
//  Aucune règle ici : `lireCodeColis` (src/scanColis.js) dit le n° que porte le code
//  (formes documentées ou mesurées), `retrouverParSuivi` les enregistrements qui portent
//  CE n° (égalité exacte, §5). Un seul ⇒ SA fiche s'ouvre tout de suite ; plusieurs ⇒ la
//  liste courte, il choisit ; aucun ⇒ « Ce colis n'est pas dans VRM » avec ce qui a été lu
//  et « Chercher ce n° ». Jamais la mauvaise fiche, jamais une ressemblance.
//
//  LES SOURCES : les écrans qui ont les données (Ventes / Achats : ventes, achats, retours,
//  Vestiaire ; la coque : Leboncoin) s'enregistrent (`enregistrerSourceColis`) ; le scanner
//  les lit AU MOMENT du scan. Une source pas encore lue n'est jamais « rien » : le scanner
//  attend (« Lecture de tes ventes et achats… »), puis dit ce qui manque.
//
//  RIEN N'EST ÉCRIT, RIEN N'EST ENVOYÉ : la caméra lit DANS la page (BarcodeDetector, sinon
//  ZXing, comme le scanner de bordereau), le flux est coupé en sortant ; « Ouvrir » passe
//  par le chemin des notifications (`vrm:aller`, `?tab=…&cible=…`).
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { createPortal } from 'react-dom';
import { tr, monnaie, date as dateLangue } from './i18n/index.js';
import { useLangue } from './i18n/react.js';
import { lireCodeColis, retrouverParSuivi, normaliserN } from './scanColis.js';
import { useLectureCamera, raisonCamera, vibrer, creerBip, zoomDe, poserZoom } from './ScannerColis.jsx';
import { lireSourcesColis, EV_RETROUVER_CODE, chercherCodeSources, sourcePrincipalePresente } from './retrouverColis.js';
import { codeCherchable, normaliserCode } from './etiquettesScan.js';
import { achatDuScan } from './arriveeAchat.js';
import { achatParIdentite } from './scanAchatSuite.js';
import { cleLigne, ouvrirLigne } from './ficheLigne.js';
import './design/scanner-retrouver.css';

const ATTENTE_SOURCES_MS = 10000;
// Les zones lues par ZXing, à tour de rôle : le centre du viseur (là où il vise), puis large (un bordereau
// se tient souvent de travers). Voir `creerLecteur` (src/ScannerColis.jsx) : mesuré sur le banc scan-colis.
const CENTRE = { x: 0.15, y: 0.3, l: 0.7, h: 0.4 };
// (17 nov., lot scan-instantane) Le milieu du viseur AGRANDI ×2 (lecteur WebAssembly) : un code tenu loin, dont les
// barres tombent entre deux pixels, se lit agrandi (banc scan-instantane). Trois zones à tour de rôle, sans pause.
const LOIN = { x: 0.2, y: 0.38, l: 0.6, h: 0.24, k: 2 };
const ZONE = [CENTRE, LOIN, { x: 0.04, y: 0.18, l: 0.92, h: 0.64 }];
// Le zoom posé à l'ouverture quand la caméra en a un (Safari 17+, Chrome Android) : on vise de deux fois plus loin.
const ZOOM_LOIN = 2;
const SORTES = ['vente', 'achat', 'retour', 'colis'];
const SCANNERS_OUVERTS = { n: 0 };

// La phrase quand la caméra manque : un refus dit OÙ l'autoriser (la raison gardée par la caméra du scanner).
const phraseCamera = () => {
  const r = raisonCamera();
  return r === 'refus' ? tr('scan.r.camRefus') : r === 'occupee' ? tr('scan.r.camOccupee') : r === 'lecteur' ? tr('scan.r.camLecteur') : tr('scan.r.sansCamera');
};
const achatsLus = (S) => sourcePrincipalePresente() && !(S.manques || []).includes(tr('scan.r.manque.achats'));
const court = (s) => { const n = normaliserN(s); return n.length > 18 ? `${n.slice(0, 8)}…${n.slice(-6)}` : n; };

function Icone({ d, taille = 22 }) {
  return <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{d}</svg>;
}
const I_FERMER = <path d="M6 6l12 12M18 6L6 18"/>;
const I_LAMPE = <><path d="M9 2.5h6l-1 5.5h-4z"/><path d="M10 8h4v11a2 2 0 0 1-4 0z"/><path d="M12 12v2"/></>;
const I_CLAVIER = <><rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M7 10h.01M10.5 10h.01M14 10h.01M17 10h.01M8 14.2h8"/></>;
const I_LOUPE = <><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></>;
const I_CHEVRON = <path d="M9 6l6 6-6 6"/>;
const I_BOITE = <><path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5L12 12l8.5-4.5M12 12v9"/></>;

// Le libellé de la sorte (Vente · Vinted, Achat · Leboncoin, Retour d'achat…) : traduit, le site est un nom propre.
const SITES = { vinted: 'Vinted', vestiaire: 'Vestiaire', leboncoin: 'Leboncoin', ebay: 'eBay' };
const sorteDe = (e) => {
  const s = SORTES.includes(e && e.sorte) ? e.sorte : 'colis';
  const site = e && SITES[e.site] ? SITES[e.site] : '';
  return site && s !== 'retour' ? tr('scan.r.sorte.' + s + 'Site', { site }) : tr('scan.r.sorte.' + s);
};
const ouvrirLib = (e) => tr('scan.r.ouvrir.' + (SORTES.includes(e && e.sorte) ? e.sorte : 'colis'));

function Vignette({ e, Photo, grande = false }) {
  return (
    <span className={'vrm-rtv-photo' + (grande ? ' is-grande' : '')} aria-hidden="true">
      {e && e.photo && Photo ? <Photo src={e.photo} alt="" decoding="async" loading="lazy"/> : <Icone d={I_BOITE} taille={grande ? 34 : 22}/>}
    </span>
  );
}

// LA FICHE d'un enregistrement trouvé : photo, N°, titre, état, code de retrait et point (achat), étape (retour).
function Fiche({ e, lu, Photo, onOuvrir }) {
  return (
    <div className="vrm-rtv-fiche" data-scan-r-fiche={`${e.sorte}:${e.cle}`} data-scan-r-sorte={e.sorte} data-scan-r-num={e.num || ''}>
      <div className="vrm-rtv-fiche-tete">
        <Vignette e={e} Photo={Photo} grande/>
        <div className="vrm-rtv-fiche-id">
          <span className="vrm-rtv-kicker" data-scan-r-kicker="">{sorteDe(e)}</span>
          {e.num ? <span className="vrm-rtv-plaque" data-scan-r-plaque={e.num}><small>N°</small>{e.num}</span> : null}
          <span className="vrm-rtv-titre" data-scan-r-titre="">{e.titre || tr('scan.r.sansTitre')}</span>
          {e.taille || e.compte ? <span className="vrm-rtv-sous">{[e.taille ? (/^\d/.test(String(e.taille)) ? tr('scan.r.taille', { t: e.taille }) : e.taille) : '', ''].filter(Boolean).join(' · ')}{e.compte ? <>{e.taille ? ' · ' : ''}<span className="vrm-sensible" data-stream-type="compte">{e.compte}</span></> : null}</span> : null}
        </div>
      </div>
      {e.etat ? (
        <div className={'vrm-rtv-etat' + (e.aFaire ? ' is-afaire' : '')} data-scan-r-bandeau={e.aFaire ? 'afaire' : 'info'}>
          <span className="vrm-rtv-etat-point" aria-hidden="true"/>
          <span className="vrm-rtv-etat-txt"><b>{e.etat}</b>{e.detail ? <small>{e.detail}</small> : null}</span>
        </div>
      ) : null}
      {e.code || e.lieu ? (
        <div className="vrm-rtv-retrait" data-scan-r-retrait="">
          {e.code ? <span className="vrm-rtv-code"><small>{tr('scan.r.code')}</small><b data-scan-r-code={e.code}>{e.code}</b></span> : null}
          {e.lieu ? <span className="vrm-rtv-lieu vrm-sensible" data-stream-type="adresse">{e.lieu}</span> : null}
        </div>
      ) : null}
      <p className="vrm-rtv-lu" data-scan-r-lu={lu ? lu.suivi : ''}>{lu && lu.nom ? `${lu.nom} · ` : ''}{lu ? court(lu.suivi) : ''}</p>
      <button type="button" className="vrm-rtv-plein" data-scan-r-ouvrir={`${e.sorte}:${e.cle}`} data-acc-apres="colis.retrouver" onClick={() => onOuvrir(e)}>{ouvrirLib(e)}</button>
    </div>
  );
}

// ── (16 nov., lot scan-achat) CE QU'IL Y A DANS LE COLIS D'UN ACHAT ───────────────────────────────────────────
// Julien : « quand on scanne un bordereau d'ACHAT, l'app doit pouvoir dire, avec les infos du bordereau, ce qu'il y
// a dans le colis ». L'achat vient de son n° de suivi SEULEMENT (`retrouverParSuivi`, égalité exacte) ; ce qui est
// montré est ce que VRM a LU : la commande (titre, prix payé, date, compte), SA transaction (le pseudo du vendeur,
// et chaque article : photo, titre, taille, état, prix — un lot ⇒ la liste), la marque seulement si le titre la
// nomme. Ce qui manque est « — », jamais deviné. Les gestes : « Ranger » (l'atelier d'arrivée : N°, case),
// « Signaler un problème » (la conversation de l'achat sur Vinted, où le signalement se fait), « Ce n'est pas ça ».
function LigneArticle({ a, Photo }) {
  return (
    <li className="vrm-rtv-article" data-scan-a-article="">
      <span className="vrm-rtv-photo" aria-hidden="true">{a.photo && Photo ? <Photo src={a.photo} alt="" decoding="async" loading="lazy"/> : <Icone d={I_BOITE} taille={22}/>}</span>
      <span className="vrm-rtv-article-txt">
        <b>{a.titre || tr('scan.r.sansTitre')}</b>
        <small>{[a.taille ? (/^\d/.test(String(a.taille)) ? tr('scan.r.taille', { t: a.taille }) : a.taille) : '', a.etat || '', a.prix != null ? monnaie(a.prix) : ''].filter(Boolean).join(' · ')}</small>
      </span>
    </li>
  );
}
// (23 nov., lot scan-achat) SON N° et LE GESTE SUIVANT (src/scanAchatSuite.js) : le N° de CET achat (par son n° de
// transaction), sa case (notée, sinon proposée par la règle du Stock), la vente qui porte déjà ce N°. Aucun N° n'est
// « prévu » sans être servi : sans N° ⇒ « Numéroter » (l'écran d'arrivée le sert, pool d'abord, puis le montre).
const caseCourte = (p) => (p ? tr('scan.a.caseCourte', { meuble: p.meuble || tr('scan.a.meuble'), r: p.rangee, c: p.colonne }) : '');
const caseLongue = (p) => (p ? tr('arv.case.mots', { meuble: p.meuble || tr('scan.a.meuble'), r: p.rangee, c: p.colonne }) : '');
function lireSuite(e) {
  if (!e || typeof e.suite !== 'function') return { su: false };
  try { const s = e.suite(); return s && typeof s === 'object' ? s : { su: false }; } catch (_) { return { su: false }; }
}
function BlocNumero({ s }) {
  if (!s || !s.su) return null;
  const nums = Array.isArray(s.numeros) ? s.numeros : [];
  const places = Array.isArray(s.places) ? s.places : null;
  const ton = s.etat === 'vendue' ? ' is-afaire' : s.etat === 'range' ? ' is-fait' : '';
  const ligne = s.etat === 'aNumeroter' ? tr('scan.a.sansNum')
    : s.etat === 'vendue' ? tr('scan.a.vendue', { num: s.vente.num })
    : s.etat === 'range' ? (nums.length > 1 ? tr('scan.a.rangesN', { n: nums.length }) : tr('scan.a.range', { lieu: caseLongue(places && places[0]) }))
    : places && nums.length === 1 && places[0] ? tr(places[0].propose ? 'scan.a.casePrevue' : 'scan.a.caseNotee', { lieu: caseLongue(places[0]) })
    : s.aucunMeuble ? tr('scan.a.sansMeuble') : places ? tr('scan.a.sansCase') : '';
  return (
    <div className={'vrm-rtv-etat vrm-rtv-num' + ton} data-scan-a-suite={s.etat} data-scan-a-nums={nums.join(',')}
      data-scan-a-case={places && places[0] ? `${places[0].meubleId}:${places[0].i}` : ''} data-scan-a-vente={s.etat === 'vendue' ? s.vente.tx : undefined}>
      <span className="vrm-rtv-etat-point" aria-hidden="true"/>
      <span className="vrm-rtv-etat-txt">
        <b>{nums.length ? nums.map((n) => <span key={n} className="vrm-rtv-plaque is-petite" data-scan-a-num={n}><small>N°</small>{n}</span>) : null}{nums.length ? null : tr('scan.a.sonNum')}</b>
        {ligne ? <small>{ligne}</small> : null}
        {s.etat !== 'vendue' && places && nums.length > 1 ? nums.map((n, k) => <small key={'p' + n} data-scan-a-place={n}>{`N°${n} · ${places[k] ? caseLongue(places[k]) : tr('scan.a.sansCase')}`}</small>) : null}
      </span>
    </div>
  );
}
// Le plein de la fiche : CE geste-là, un seul (« Numéroter », « Ranger en … », « Ouvrir la vente ») — rangé : aucun.
function libellePlein(s) {
  if (!s || !s.su) return tr('scan.a.ranger');
  if (s.etat === 'aNumeroter') return tr('scan.a.numeroter');
  if (s.etat === 'vendue') return tr('scan.r.ouvrir.vente');
  if (s.etat === 'range') return '';
  const p = Array.isArray(s.places) && s.numeros.length === 1 ? s.places[0] : null;
  return p ? tr('scan.a.rangerEn', { lieu: caseCourte(p) }) : s.numeros.length > 1 ? tr('scan.a.rangerN', { n: s.numeros.length }) : tr('scan.a.rangerNum', { num: s.numeros[0] });
}
function FicheAchat({ e, lu, Photo, onOuvrir, onRanger, onPasCa, onRelierVente }) {
  const suite = React.useMemo(() => lireSuite(e), [e]);
  const [det, setDet] = React.useState(() => (typeof e.details === 'function' ? undefined : null));
  React.useEffect(() => {
    if (typeof e.details !== 'function') return undefined;
    let vivant = true;
    Promise.resolve().then(() => e.details()).then((d) => { if (vivant) setDet(d && typeof d === 'object' ? d : null); }, () => { if (vivant) setDet(null); });
    return () => { vivant = false; };
  }, [e]);
  const articles = det && Array.isArray(det.articles) ? det.articles : [];
  const lot = articles.length > 1;
  const un = articles.length === 1 ? articles[0] : null;
  const photo = (un && un.photo) || e.photo || null;
  const titre = (un && un.titre) || e.titre || '';
  const taille = (un && un.taille) || e.taille || '';
  const etatArticle = (un && un.etat) || '';
  const vendeur = (det && det.vendeur) || e.vendeur || '';
  const tirets = '—';
  return (
    <div className="vrm-rtv-fiche vrm-rtv-achat" data-scan-r-fiche={`${e.sorte}:${e.cle}`} data-scan-r-sorte={e.sorte} data-scan-r-num={e.num || ''} data-scan-a-details={det === undefined ? 'lecture' : det === null ? 'pas-su' : String(articles.length)}>
      <span className="vrm-rtv-kicker" data-scan-r-kicker="">{tr('scan.a.dedans')}{lot ? ` · ${tr('scan.a.lot', { n: articles.length })}` : ''}</span>
      {lot ? (
        <ul className="vrm-rtv-articles" data-scan-a-lot={articles.length}>{articles.map((a, n) => <LigneArticle key={a.cle || `n${n}`} a={a} Photo={Photo}/>)}</ul>
      ) : (
        <div className="vrm-rtv-achat-tete">
          <span className="vrm-rtv-photo is-tres-grande" aria-hidden="true">{photo && Photo ? <Photo src={photo} alt="" decoding="async" loading="lazy"/> : <Icone d={I_BOITE} taille={40}/>}</span>
          <div className="vrm-rtv-fiche-id">
            {e.num && !suite.su ? <span className="vrm-rtv-plaque" data-scan-r-plaque={e.num}><small>N°</small>{e.num}</span> : null}
            <span className="vrm-rtv-titre" data-scan-r-titre="">{titre || tr('scan.r.sansTitre')}</span>
            {taille || etatArticle ? <span className="vrm-rtv-sous" data-scan-a-taille={taille}>{[taille ? (/^\d/.test(String(taille)) ? tr('scan.r.taille', { t: taille }) : taille) : '', etatArticle].filter(Boolean).join(' · ')}</span> : null}
          </div>
        </div>
      )}
      <dl className="vrm-rtv-achat-infos">
        {e.marque ? <div><dt>{tr('scan.a.marque')}</dt><dd data-scan-a-marque={e.marque}>{e.marque}</dd></div> : null}
        <div><dt>{tr('scan.a.paye')}</dt><dd data-scan-a-prix={e.prix != null ? String(e.prix) : ''}>{e.prix != null ? monnaie(e.prix, e.devise || 'EUR') : tirets}</dd></div>
        <div><dt>{tr('scan.a.date')}</dt><dd>{e.date ? dateLangue(e.date, { day: 'numeric', month: 'long' }) : tirets}</dd></div>
        <div><dt>{tr('scan.a.vendeur')}</dt><dd className="vrm-sensible" data-scan-a-vendeur={vendeur}>{vendeur || (det === undefined ? '…' : tirets)}</dd></div>
        {e.compte ? <div><dt>{tr('scan.a.compte')}</dt><dd className="vrm-sensible">{e.compte}</dd></div> : null}
      </dl>
      {e.etat ? (
        <div className={'vrm-rtv-etat' + (e.aFaire ? ' is-afaire' : '')} data-scan-r-bandeau={e.aFaire ? 'afaire' : 'info'}>
          <span className="vrm-rtv-etat-point" aria-hidden="true"/>
          <span className="vrm-rtv-etat-txt"><b>{e.etat}</b>{e.detail ? <small>{e.detail}</small> : null}</span>
        </div>
      ) : null}
      {e.code || e.lieu ? (
        <div className="vrm-rtv-retrait" data-scan-r-retrait="">
          {e.code ? <span className="vrm-rtv-code"><small>{tr('scan.r.code')}</small><b data-scan-r-code={e.code}>{e.code}</b></span> : null}
          {e.lieu ? <span className="vrm-rtv-lieu vrm-sensible" data-stream-type="adresse">{e.lieu}</span> : null}
        </div>
      ) : null}
      <p className="vrm-rtv-lu" data-scan-r-lu={lu ? lu.suivi : ''}>{lu && lu.nom ? `${lu.nom} · ` : ''}{lu ? court(lu.suivi) : ''}</p>
      <BlocNumero s={suite}/>
      {suite.su && suite.etat === 'vendue' ? (
        <button type="button" className="vrm-rtv-plein" data-scan-a-plein="vente" data-scan-a-ouvrir-vente={suite.vente.tx}
          onClick={() => onOuvrir({ sorte: 'vente', site: 'vinted', cle: 'v:' + suite.vente.tx, num: suite.vente.num, titre: e.titre || '', photo: e.photo || null, etat: '', lien: typeof e.lienVente === 'function' ? e.lienVente(suite.vente.tx) : '' })}>{libellePlein(suite)}</button>
      ) : typeof e.ranger === 'function' && libellePlein(suite) ? (
        <button type="button" className="vrm-rtv-plein" data-scan-a-ranger={e.cle} data-scan-a-plein={suite.su ? suite.etat : 'ranger'} onClick={() => onRanger(e)}>{libellePlein(suite)}</button>
      ) : null}
      {suite.su && suite.etat === 'aNumeroter' && suite.venteSu !== false && typeof e.relierVente === 'function' && onRelierVente ? (
        <button type="button" className="vrm-rtv-touche vrm-rtv-large" data-scan-a-relier-vente={e.cle} onClick={() => onRelierVente(e)}>{tr('scan.a.relierVente')}</button>
      ) : null}
      <div className="vrm-rtv-gestes">
        {e.signaler ? <a className="vrm-rtv-touche" data-scan-a-signaler={e.cle} href={e.signaler} target="_blank" rel="noreferrer">{tr('scan.a.signaler')}</a> : null}
        <button type="button" className="vrm-rtv-touche" data-scan-r-ouvrir={`${e.sorte}:${e.cle}`} onClick={() => onOuvrir(e)}>{ouvrirLib(e)}</button>
      </div>
      <button type="button" className="vrm-rtv-lien" data-scan-a-pas-ca="" onClick={onPasCa}>{tr('scan.a.pasCa')}</button>
    </div>
  );
}
// (20 nov., lot arrivee-scan) `arrivee` : le scanner de l'ARRIVÉE (« j'ai un colis en main, lequel est-ce ? ») — seuls les
// ACHATS répondent (`achatDuScan`, src/arriveeAchat.js : n° de suivi exact) ; un seul ⇒ `onArrivee(achat, lu)` (l'écran
// d'arrivée s'ouvre), plusieurs ⇒ la liste (SON toucher choisit), aucun ⇒ dit. Les étiquettes de VENTES ne sont pas fouillées.
export default function ScannerRetrouver({ Photo = null, onFermer, onChercher = null, onAttendreSources = null, onRelier = null, codeInitial = '', zIndex = 18000, children = null, arrivee = false, onArrivee = null, indexHorsLigne = null }) {
  useLangue();
  const video = React.useRef(null);
  const saisieRef = React.useRef(null);
  const [res, setRes] = React.useState(null);          // { etat, lu, trouve?, trouves?, brut, n, manques? }
  const [choisi, setChoisi] = React.useState(null);    // dans « plusieurs » : celui qu'il a touché
  const [indice, setIndice] = React.useState('');      // un code lu qui n'est pas un n° de suivi (la caméra continue)
  const [saisie, setSaisie] = React.useState('');
  const [clavier, setClavier] = React.useState(false);
  const [lampe, setLampe] = React.useState(null);      // null : pas de lampe ; false / true
  const [zoom, setZoom] = React.useState(null);        // (17 nov.) null : pas de zoom ; sinon le zoom posé (1, 2…)
  const [luAt, setLuAt] = React.useState(0);           // (17 nov.) l'instant où un code a été lu (le viseur le montre tout de suite)
  const piste = React.useRef(null);
  const bip = React.useRef(null); if (!bip.current) bip.current = creerBip();
  const n = React.useRef(0);
  const enCours = React.useRef(null);                  // la lecture qui attend les sources
  const resRef = React.useRef(null); resRef.current = res;

  const dejaCherches = React.useRef(new Set());       // (17 nov.) codes déjà cherchés dans les étiquettes, sans résultat
  const resoudre = React.useCallback((brut, { tape = false } = {}) => {
    const lu = lireCodeColis(brut);
    // (17 nov., lot scan-bordereau-vente) Un code qui n'est pas un n° de suivi (le grand code d'une étiquette
    // Mondial Relay / InPost, un code de dépôt…) est cherché, tel quel, dans le texte des étiquettes de SES ventes
    // (src/etiquettesScan.js) : une identité exacte. Trop court ⇒ jamais cherché.
    const cherchable = codeCherchable(brut);
    const code = normaliserCode(brut);
    // (23 nov., lot scan-achat) Un n° TAPÉ (ou lu par la douchette) qui n'est pas un n° de suivi peut être le n° de
    // TRANSACTION d'un achat ou le CODE DE RETRAIT d'un colis : une identité exacte (`achatParIdentite`), cherchée une
    // fois les sources lues. Jamais pour une lecture de la caméra (un code quelconque ne doit rien ouvrir).
    const idPossible = tape && normaliserN(brut).length >= 4;
    if (!lu && !idPossible && (arrivee || !cherchable || (!tape && dejaCherches.current.has(code)))) {
      if (tape) { n.current += 1; setRes({ etat: 'pasReconnu', brut: String(brut), n: n.current, cherche: dejaCherches.current.has(code) }); vibrer([30, 60, 30]); bip.current(false); }
      else setIndice(court(brut));
      return;
    }
    setIndice('');
    const finir = (incomplet, Sf = null) => {
      const S = Sf || lireSourcesColis();
      const parId = idPossible ? achatParIdentite(brut, S.enregistrements) : { etat: 'aucun' };
      const luId = parId.etat !== 'aucun' ? { suivi: normaliserN(brut), nom: null, transporteur: null, forme: parId.par } : null;
      const trouvesId = parId.etat === 'un' ? [parId.trouve] : parId.etat === 'plusieurs' ? parId.trouves : [];
      if (arrivee) {
        n.current += 1;
        if (!lu && !luId) { if (tape) { setRes({ etat: 'pasReconnu', brut: String(brut), n: n.current }); vibrer([30, 60, 30]); bip.current(false); } else { setRes(null); setIndice(court(brut)); } return; }
        let ra = lu ? achatDuScan(lu, S.enregistrements) : { etat: 'aucun', lu: null };
        if (ra.etat !== 'un' && ra.etat !== 'plusieurs' && luId) {
          const A = trouvesId.filter((x) => x.sorte === 'achat');
          ra = A.length === 1 ? { etat: 'un', lu: luId, trouve: A[0] } : A.length > 1 ? { etat: 'plusieurs', lu: luId, trouves: A } : lu ? ra : { etat: 'sansAchat', lu: luId };
        }
        const bon = ra.etat === 'un' || ra.etat === 'plusieurs';
        vibrer(bon ? 40 : [30, 60, 30]); bip.current(bon); setChoisi(null);
        setRes({ ...ra, brut: String(brut), n: n.current, manques: incomplet || !bon ? S.manques : [], incomplet: !!incomplet });
        if (ra.etat === 'un' && onArrivee) { const t = ra.trouve; setTimeout(() => { try { onArrivee(t, lu); } catch (_) {} }, 0); }
        return;
      }
      let r = lu ? retrouverParSuivi(lu, S.enregistrements) : { etat: 'aucun', lu: null };
      if (r.etat !== 'un' && r.etat !== 'plusieurs' && luId) r = trouvesId.length === 1 ? { etat: 'un', lu: luId, trouve: trouvesId[0], parIdentite: parId.par } : { etat: 'plusieurs', lu: luId, trouves: trouvesId, parIdentite: parId.par };
      const trouveR = r.etat === 'un' || r.etat === 'plusieurs';
      if (r.etat === 'aucun' && cherchable && S.chercheurs && S.chercheurs.length && !dejaCherches.current.has(code)) {
        setRes({ etat: 'attente', lu, brut: String(brut), n: n.current, etiquettes: true });
        chercherCodeSources(code, S.chercheurs).then((rc) => {
          n.current += 1;
          if (rc.etat === 'un' || rc.etat === 'plusieurs') {
            vibrer(40); bip.current(true); setChoisi(null);
            const luE = lu || { suivi: code, nom: null, transporteur: null, forme: 'etiquette' };
            setRes(rc.etat === 'un' ? { etat: 'un', lu: luE, trouve: rc.trouves[0], brut: String(brut), n: n.current, parEtiquette: true }
              : { etat: 'plusieurs', lu: luE, trouves: rc.trouves, brut: String(brut), n: n.current, parEtiquette: true });
            return;
          }
          if (rc.etat === 'aucun') dejaCherches.current.add(code);
          if (!lu) {
            if (tape) { setRes({ etat: 'pasReconnu', brut: String(brut), n: n.current, cherche: true, pasSu: rc.etat === 'pasSu' }); vibrer([30, 60, 30]); bip.current(false); }
            else { setRes(null); setIndice(court(brut)); }
            return;
          }
          vibrer([30, 60, 30]); bip.current(false); setChoisi(null);
          setRes({ ...r, brut: String(brut), n: n.current, manques: S.manques, incomplet: !!incomplet, cherche: true, pasSu: rc.etat === 'pasSu' });
        });
        return;
      }
      if (!lu && !trouveR) {
        n.current += 1;
        if (tape) { setRes({ etat: 'pasReconnu', brut: String(brut), n: n.current }); vibrer([30, 60, 30]); bip.current(false); }
        else { setRes(null); setIndice(court(brut)); }
        return;
      }
      n.current += 1;
      const bon = r.etat === 'un' || r.etat === 'plusieurs';
      vibrer(bon ? 40 : [30, 60, 30]); bip.current(bon);
      setChoisi(null);
      setRes({ ...r, brut: String(brut), n: n.current, manques: incomplet || r.etat === 'aucun' ? S.manques : [], incomplet: !!incomplet });
    };
    const t0 = Date.now();
    const essayer = () => {
      enCours.current = null;
      const S = lireSourcesColis();
      if (S.pret) { finir(false); return; }
      // (20 nov., lot arrivee-scan) L'arrivée ne cherche que des ACHATS : leur liste lue (même en cache, hors ligne) suffit,
      // les ventes et bordereaux pas lus ne peuvent pas porter un achat. Achats pas lus ⇒ on attend, comme avant.
      if (arrivee && achatsLus(S)) { finir(false); return; }
      // Hors ligne, les écrans ne relisent rien : les achats connus de CET appareil (l'index gardé à la dernière lecture
      // complète, par n° de suivi — src/App.jsx `garderIndexArrivee`) reconnaissent le colis. Jamais en ligne (on relit).
      if (arrivee && typeof indexHorsLigne === 'function' && typeof navigator !== 'undefined' && navigator.onLine === false) {
        const L = indexHorsLigne();
        if (Array.isArray(L) && L.length) { finir(false, { pret: true, enregistrements: L, manques: [] }); return; }
      }
      // Une source pas lue n'est jamais « rien » (ni « un seul » : l'autre source pourrait porter le même n°) :
      // on attend qu'elles soient lues ; au-delà de 10 s, on dit ce qui manque.
      if (Date.now() - t0 >= ATTENTE_SOURCES_MS) { finir(true); return; }
      setRes({ etat: 'attente', lu, brut: String(brut), n: n.current });
      enCours.current = setTimeout(essayer, 300);
    };
    if (enCours.current) clearTimeout(enCours.current);
    if (!lireSourcesColis().pret && onAttendreSources) { try { onAttendreSources(); } catch (_) {} }
    essayer();
  }, [onAttendreSources, arrivee, onArrivee, indexHorsLigne]);

  // La caméra lit en continu ; une fiche montrée, elle ne remplace plus rien tant qu'il ne rescanne pas.
  const traiter = React.useCallback((brut) => {
    if (resRef.current) return;   // une fiche, une liste, un message ou une attente est montré
    setLuAt(Date.now());
    resoudre(brut);
  }, [resoudre]);
  const opts = React.useMemo(() => ({
    zone: ZONE, pause: 90,   // (ZXing en JavaScript seulement : le lecteur WebAssembly lit chaque image, sans pause)
    surFlux: (flux) => {
      try {
        const t = flux && flux.getVideoTracks ? flux.getVideoTracks()[0] : null; piste.current = t || null;
        const caps = t && typeof t.getCapabilities === 'function' ? t.getCapabilities() : null;
        setLampe(caps && caps.torch ? false : null);
        const z = zoomDe(t);
        if (z && z.max >= ZOOM_LOIN) poserZoom(t, ZOOM_LOIN).then((v) => setZoom(v != null ? v : null)); else setZoom(null);
      } catch (_) { setLampe(null); setZoom(null); }
    },
  }), []);
  const camera = useLectureCamera(video, traiter, opts);

  React.useEffect(() => () => { if (enCours.current) clearTimeout(enCours.current); }, []);
  // (16 nov., lot scan-achat) Un code DÉJÀ lu (la douchette) à l'ouverture, ou pendant que le scanner est ouvert.
  React.useEffect(() => { if (codeInitial) resoudre(codeInitial, { tape: true }); }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    const f = (ev) => { const c = ev && ev.detail && ev.detail.code; if (!c) return; setRes(null); setChoisi(null); resoudre(String(c), { tape: true }); };
    window.addEventListener(EV_RETROUVER_CODE, f); return () => window.removeEventListener(EV_RETROUVER_CODE, f);
  }, [resoudre]);
  // L'app dessous n'est plus dessinée tant que le scanner la couvre (scanner-retrouver.css), rendue à la fermeture.
  // (17 nov., lot scan-instantane) Rendue APRÈS la première image qui suit la fermeture : redessiner toute l'app
  // (le style de chaque élément) dans la même tâche que la fiche ouverte retardait la fiche (banc scan-instantane).
  React.useEffect(() => {
    const h = document.documentElement; SCANNERS_OUVERTS.n += 1; h.setAttribute('data-scan-retrouver', '');
    return () => { SCANNERS_OUVERTS.n -= 1; const rendre = () => { if (SCANNERS_OUVERTS.n <= 0) h.removeAttribute('data-scan-retrouver'); };
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setTimeout(rendre, 0)); else rendre(); };
  }, []);
  React.useEffect(() => {
    const f = (e) => { if (e.key === 'Escape') { if (resRef.current) { setRes(null); setChoisi(null); } else if (onFermer) onFermer(); } };
    window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f);
  }, [onFermer]);
  // Sans caméra (ordinateur sans webcam, refus) : la saisie prend la main.
  React.useEffect(() => { if (camera === 'sans') { setClavier(true); setTimeout(() => { try { saisieRef.current && saisieRef.current.focus({ preventScroll: true }); } catch (_) {} }, 50); } }, [camera]);
  // Un indice (« ce code n'est pas un n° de suivi ») s'efface seul.
  React.useEffect(() => { if (!indice) return undefined; const t = setTimeout(() => setIndice(''), 2600); return () => clearTimeout(t); }, [indice]);

  const basculerLampe = async () => {
    const t = piste.current; if (!t || lampe == null) return;
    const v = !lampe;
    try { await t.applyConstraints({ advanced: [{ torch: v }] }); setLampe(v); } catch (_) { setLampe(null); }
  };
  // (17 nov.) « 2× / 1× » : de plus loin, ou tout près (une étiquette qui déborde du viseur).
  const basculerZoom = async () => {
    const t = piste.current; if (!t || zoom == null) return;
    const z = zoomDe(t); if (!z) { setZoom(null); return; }
    const v = await poserZoom(t, zoom >= ZOOM_LOIN ? z.min : ZOOM_LOIN);
    if (v != null) setZoom(v);
  };
  React.useEffect(() => { if (!luAt) return undefined; const t = setTimeout(() => setLuAt(0), 700); return () => clearTimeout(t); }, [luAt]);
  const valider = (e) => { e.preventDefault(); const s = saisie.trim(); if (!s) return; resoudre(s, { tape: true }); setSaisie(''); };
  const autre = () => { setRes(null); setChoisi(null); setIndice(''); };
  // (17 nov., lot scan-instantane) « Ouvrir la vente » : LA FICHE de la vente s'ouvre À L'INSTANT avec ce que le
  // scanner sait déjà (N°, transaction, photo, titre, état — les identités de CETTE vente, jamais un titre), puis
  // Ventes se place dessous sur la ligne de cette vente ; la ligne trouvée, la fiche devient la sienne et se
  // remplit (récapitulatif, gestes : `fiche=` dans le lien, src/cibleNotif.js). Avant : l'écran Ventes, défiler,
  // puis un toucher simulé sur la ligne, rejoué à 0,7, 1,6 et 3 s — lent, et la fiche se rouvrait.
  const ouvrir = (e) => {
    if (!e || !e.lien) return;
    let lien = e.lien;
    const tx = e.sorte === 'vente' && e.site === 'vinted' && /^v:\d+$/.test(String(e.cle || '')) ? String(e.cle).slice(2) : '';
    if (tx) {
      const cle = cleLigne({ contexte: 'vente', site: 'vinted', cle: 'scan-' + tx });
      try {
        ouvrirLigne({ cle, contexte: 'vente', site: 'vinted', nums: e.num ? [String(e.num)] : [], item: '', tx, suivi: '', photo: e.photo || '', titre: e.titre || '', prix: '', sous: e.etat || '' });
        lien += '&fiche=' + encodeURIComponent(cle);
      } catch (_) {}
    }
    if (onFermer) onFermer();
    // L'écran dessous (Ventes, la ligne) se place APRÈS la première image de la fiche : la fiche ne l'attend pas.
    const aller = () => { try { window.dispatchEvent(new CustomEvent('vrm:aller', { detail: lien })); } catch (_) {} };
    if (tx && typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setTimeout(aller, 0)); else aller();
  };
  const chercher = (lu) => { if (onChercher && lu) onChercher(lu.suivi); if (onFermer) onFermer(); };
  // (16 nov., lot scan-achat) « Ranger » : l'atelier d'arrivée s'ouvre une fois le scanner fermé (il le couvrirait).
  const ranger = (e) => { if (onFermer) onFermer(); setTimeout(() => { try { e.ranger(); } catch (_) {} }, 60); };
  // « Relier à un achat » : le n° lu part avec la demande ; SON clic dans la liste relie (src/relierColis.js).
  // (23 nov.) « Déjà vendue ? Relier à une vente » : la feuille d'Achats s'ouvre sur CET achat, une fois le scanner fermé.
  const relierVente = (e) => { if (onFermer) onFermer(); setTimeout(() => { try { e.relierVente(); } catch (_) {} }, 60); };
  const relier = (lu) => { if (!lu || !onRelier) return; if (onFermer) onFermer(); setTimeout(() => { try { onRelier({ suivi: lu.suivi, transporteur: lu.transporteur || '', nom: lu.nom || '' }); } catch (_) {} }, 60); };
  const pasCa = () => { setRes(null); setChoisi(null); setIndice(tr('scan.a.pasCaIndice')); };
  const montrer = arrivee ? null : res && res.etat === 'un' ? res.trouve : res && res.etat === 'plusieurs' && choisi ? choisi : null;
  const choisirArrivee = (e) => { if (onArrivee) onArrivee(e, res ? res.lu : null); };
  // (17 nov.) Une vente trouvée : le morceau de la fiche se charge PENDANT qu'il lit la feuille (« Ouvrir » n'attend pas le réseau).
  const venteMontree = !!(montrer && montrer.sorte === 'vente');
  React.useEffect(() => { if (venteMontree) import('./FichePaire.jsx').catch(() => {}); }, [venteMontree]);
  const sansCam = camera === 'sans';

  return createPortal(
    <div className={'vrm-rtv' + (res && res.etat !== 'attente' ? ' a-resultat' : '') + (sansCam ? ' sans-camera' : '')} role="dialog" aria-modal="true" aria-label={arrivee ? tr('arv.scan.titre') : tr('scan.r.titre')} data-scan-arrivee={arrivee ? '' : undefined}
      data-scan-r="" data-scan-r-camera={camera} data-scan-r-etat={res ? res.etat : ''} data-scan-r-n={res ? res.n : 0} style={{ zIndex }}>
      {children}
      <div className="vrm-rtv-vue" aria-hidden="true">
        <video ref={video} playsInline muted autoPlay/>
        <span className="vrm-rtv-voile"/>
      </div>
      <header className="vrm-rtv-tete">
        <h2 className="vrm-rtv-h">{arrivee ? tr('arv.scan.titre') : tr('scan.r.titre')}</h2>
        <button type="button" className="vrm-rtv-rond" data-scan-r-fermer="" aria-label={tr('scan.r.fermer')} onClick={onFermer}><Icone d={I_FERMER} taille={20}/></button>
      </header>
      {!sansCam ? (
        <div className={'vrm-rtv-viseur' + (res && (res.etat === 'un' || res.etat === 'plusieurs') ? ' is-trouve' : '') + (luAt || (res && res.etat === 'attente') ? ' is-lu' : '')} aria-hidden="true" data-scan-r-lu-vu={luAt ? '1' : ''}>
          <i/><i/><i/><i/><span className="vrm-rtv-ligne"/>
        </div>
      ) : null}
      <div className="vrm-rtv-aide" role="status" aria-live="polite">
        {sansCam ? <p className="vrm-rtv-aide-txt" data-scan-r-sans-camera={raisonCamera() || ''}>{phraseCamera()}</p>
          : indice ? <p className="vrm-rtv-aide-txt is-indice" data-acc-echec="colis.retrouver" data-acc-raison="pasReconnu" data-scan-r-indice={indice}>{tr('scan.r.indice')}</p>
          : !res ? <p className="vrm-rtv-aide-txt" data-acc-avant="colis.retrouver">{camera === 'demarrage' ? tr('scan.r.demarrage') : arrivee ? tr('arv.scan.aide') : tr('acc.colis.retrouver.avant')}</p> : null}
      </div>
      <div className="vrm-rtv-bas">
        {res && res.etat !== 'attente' ? (
          <section className="vrm-rtv-feuille" role="status" aria-live="assertive" data-scan-r-resultat={res.etat} data-scan-r-par={res.parEtiquette ? 'etiquette' : 'suivi'} data-scan-r-cle={montrer ? `${montrer.sorte}:${montrer.cle}` : ''}>
            {arrivee && res.etat === 'un' ? (
              <div className="vrm-rtv-msg" data-arv-scan="un" data-arv-scan-cle={res.trouve ? res.trouve.cle : ''}>
                <p className="vrm-rtv-msg-titre">{res.trouve && res.trouve.titre ? res.trouve.titre : tr('scan.r.sansTitre')}</p>
                <button type="button" className="vrm-rtv-plein" data-arv-scan-ouvrir="" onClick={() => choisirArrivee(res.trouve)}>{tr('arv.scan.ouvrir')}</button>
              </div>
            ) : arrivee && (res.etat === 'sansAchat' || res.etat === 'aucun') ? (
              <div className="vrm-rtv-msg" data-arv-scan={res.etat}>
                <p className="vrm-rtv-msg-titre" data-scan-r-message="">{res.incomplet ? tr('scan.r.pasLu') : res.etat === 'sansAchat' ? tr('arv.scan.sansAchat') : tr('arv.scan.aucun')}</p>
                <dl className="vrm-rtv-lu-detail">
                  <div><dt>{tr('scan.r.transporteur')}</dt><dd>{res.lu.nom || tr('scan.r.transporteurInconnu')}</dd></div>
                  <div><dt>{tr('scan.r.numero')}</dt><dd className="vrm-rtv-mono" data-scan-r-suivi={res.lu.suivi}>{res.lu.suivi}</dd></div>
                </dl>
                <p className="vrm-rtv-msg-sous">{res.manques && res.manques.length ? tr('scan.r.manques', { quoi: res.manques.join(', ') }) : tr('arv.scan.aucunSous')}</p>
              </div>
            ) : montrer ? <>
              {res.etat === 'plusieurs' ? <button type="button" className="vrm-rtv-lien vrm-rtv-retour" data-scan-r-liste-retour="" onClick={() => setChoisi(null)}>{tr('scan.r.plusieursRetour', { n: res.trouves.length })}</button> : null}
              {montrer.sorte === 'achat' ? <FicheAchat e={montrer} lu={res.lu} Photo={Photo} onOuvrir={ouvrir} onRanger={ranger} onPasCa={pasCa} onRelierVente={relierVente}/> : <Fiche e={montrer} lu={res.lu} Photo={Photo} onOuvrir={ouvrir}/>}
              {montrer.sorte === 'colis' && onRelier && res.lu ? <button type="button" className="vrm-rtv-touche" data-scan-a-relier={res.lu.suivi} onClick={() => relier(res.lu)}>{tr('scan.a.relier')}</button> : null}
            </> : res.etat === 'plusieurs' ? (
              <div className="vrm-rtv-plusieurs" data-scan-r-plusieurs={res.trouves.length}>
                <p className="vrm-rtv-msg-titre">{tr('scan.r.plusieurs', { n: res.trouves.length })}</p>
                <p className="vrm-rtv-msg-sous">{tr('scan.r.plusieursSous')}</p>
                <ul className="vrm-rtv-liste">
                  {res.trouves.map((e) => (
                    <li key={`${e.sorte}:${e.cle}`}>
                      <button type="button" className="vrm-rtv-rangee" data-scan-r-choix={`${e.sorte}:${e.cle}`} onClick={() => (arrivee ? choisirArrivee(e) : setChoisi(e))}>
                        <Vignette e={e} Photo={Photo}/>
                        <span className="vrm-rtv-rangee-txt"><small>{sorteDe(e)}</small><b>{e.num ? <span className="vrm-rtv-plaque is-petite"><small>N°</small>{e.num}</span> : null}{e.titre || tr('scan.r.sansTitre')}</b></span>
                        <Icone d={I_CHEVRON} taille={18}/>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="vrm-rtv-lu">{res.lu && res.lu.nom ? `${res.lu.nom} · ` : ''}{res.lu ? court(res.lu.suivi) : ''}</p>
              </div>
            ) : res.etat === 'aucun' ? (
              <div className="vrm-rtv-msg" data-acc-echec="colis.retrouver" data-acc-raison={res.incomplet ? 'pasSu' : 'pasTrouve'}>
                <p className="vrm-rtv-msg-titre" data-scan-r-message="" data-scan-a-inconnu={res.incomplet ? undefined : res.lu.suivi}>{res.incomplet ? tr('scan.r.pasLu') : tr('scan.a.inconnu', { n: res.lu.suivi })}</p>
                <dl className="vrm-rtv-lu-detail">
                  <div><dt>{tr('scan.r.transporteur')}</dt><dd data-scan-r-transporteur={res.lu.transporteur || ''}>{res.lu.nom || tr('scan.r.transporteurInconnu')}</dd></div>
                  <div><dt>{tr('scan.r.numero')}</dt><dd className="vrm-rtv-mono" data-scan-r-suivi={res.lu.suivi}>{res.lu.suivi}</dd></div>
                </dl>
                {res.manques && res.manques.length ? <p className="vrm-rtv-msg-sous" data-scan-r-manques="">{tr('scan.r.manques', { quoi: res.manques.join(', ') })}</p> : <>
                  <p className="vrm-rtv-msg-sous">{tr('acc.colis.retrouver.pasTrouve')}</p>
                  <p className="vrm-rtv-msg-sous" data-scan-a-quoi-faire="">{tr('scan.a.quoiFaire')}</p>
                </>}
                {!res.incomplet && onRelier ? <button type="button" className="vrm-rtv-plein" data-scan-a-relier={res.lu.suivi} onClick={() => relier(res.lu)}>{tr('scan.a.relier')}</button> : null}
                {onChercher ? <button type="button" className="vrm-rtv-touche" data-scan-r-chercher={res.lu.suivi} onClick={() => chercher(res.lu)}><Icone d={I_LOUPE} taille={18}/>{tr('scan.r.chercher')}</button> : null}
              </div>
            ) : (
              <div className="vrm-rtv-msg" data-acc-echec="colis.retrouver" data-acc-raison="pasReconnu">
                <p className="vrm-rtv-msg-titre" data-scan-r-message="">{tr('scan.r.pasReconnu')}</p>
                <dl className="vrm-rtv-lu-detail"><div><dt>{tr('scan.b.codeLu')}</dt><dd className="vrm-rtv-mono" data-scan-b-code-lu={normaliserCode(res.brut)}>{court(res.brut)}</dd></div></dl>
                <p className="vrm-rtv-msg-sous" data-scan-b-quoi-faire={res.cherche ? (res.pasSu ? 'pas-su' : 'cherche') : 'court'}>{res.cherche ? (res.pasSu ? tr('scan.b.pasSu') : tr('scan.b.pasSurEtiquette')) : tr('acc.colis.retrouver.pasReconnu')}</p>
              </div>
            )}
            <button type="button" className="vrm-rtv-lien" data-scan-r-autre="" onClick={autre}>{tr('scan.r.autre')}</button>
          </section>
        ) : res && res.etat === 'attente' ? (
          <section className="vrm-rtv-feuille is-attente" role="status" data-scan-r-resultat="attente"><span className="vrm-rtv-roue" aria-hidden="true"/><p className="vrm-rtv-msg-sous">{res.etiquettes ? tr('scan.b.attente') : tr('scan.r.attente')}</p></section>
        ) : (
          <div className="vrm-rtv-outils">
            {lampe != null ? <button type="button" className={'vrm-rtv-rond' + (lampe ? ' is-actif' : '')} data-scan-r-lampe={lampe ? '1' : '0'} aria-pressed={lampe ? 'true' : 'false'} aria-label={tr('scan.r.lampe')} onClick={basculerLampe}><Icone d={I_LAMPE}/></button> : null}
            {zoom != null ? <button type="button" className={'vrm-rtv-rond vrm-rtv-zoom' + (zoom >= ZOOM_LOIN ? ' is-actif' : '')} data-scan-r-zoom={String(zoom)} aria-pressed={zoom >= ZOOM_LOIN ? 'true' : 'false'} aria-label={tr('scan.r.zoom')} onClick={basculerZoom}>{zoom >= ZOOM_LOIN ? '2×' : '1×'}</button> : null}
            {clavier || sansCam ? (
              <form className="vrm-rtv-saisie" onSubmit={valider}>
                <input ref={saisieRef} data-scan-r-saisie="" value={saisie} onChange={(e) => setSaisie(e.target.value)} placeholder={tr('scan.r.saisie')} aria-label={tr('scan.r.saisie')}
                  inputMode="text" autoCapitalize="characters" autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="search"/>
                <button type="submit" data-scan-r-ok="" disabled={!saisie.trim()}>{tr('scan.r.ok')}</button>
              </form>
            ) : (
              <button type="button" className="vrm-rtv-touche is-verre" data-scan-r-clavier="" onClick={() => { setClavier(true); setTimeout(() => { try { saisieRef.current && saisieRef.current.focus({ preventScroll: true }); } catch (_) {} }, 30); }}>
                <Icone d={I_CLAVIER} taille={20}/>{tr('scan.r.taper')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
