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
import { tr } from './i18n/index.js';
import { useLangue } from './i18n/react.js';
import { lireCodeColis, retrouverParSuivi, normaliserN } from './scanColis.js';
import { useLectureCamera, raisonCamera, vibrer, creerBip } from './ScannerColis.jsx';
import { lireSourcesColis } from './retrouverColis.js';
import './design/scanner-retrouver.css';

const ATTENTE_SOURCES_MS = 10000;
// Les zones lues par ZXing, à tour de rôle : le centre du viseur (là où il vise), puis large (un bordereau
// se tient souvent de travers). Voir `creerLecteur` (src/ScannerColis.jsx) : mesuré sur le banc scan-colis.
const CENTRE = { x: 0.15, y: 0.3, l: 0.7, h: 0.4 };
const ZONE = [CENTRE, CENTRE, { x: 0.04, y: 0.18, l: 0.92, h: 0.64 }];
const SORTES = ['vente', 'achat', 'retour', 'colis'];

// La phrase quand la caméra manque : un refus dit OÙ l'autoriser (la raison gardée par la caméra du scanner).
const phraseCamera = () => {
  const r = raisonCamera();
  return r === 'refus' ? tr('scan.r.camRefus') : r === 'occupee' ? tr('scan.r.camOccupee') : r === 'lecteur' ? tr('scan.r.camLecteur') : tr('scan.r.sansCamera');
};
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

export default function ScannerRetrouver({ Photo = null, onFermer, onChercher = null, onAttendreSources = null, zIndex = 18000, children = null }) {
  useLangue();
  const video = React.useRef(null);
  const saisieRef = React.useRef(null);
  const [res, setRes] = React.useState(null);          // { etat, lu, trouve?, trouves?, brut, n, manques? }
  const [choisi, setChoisi] = React.useState(null);    // dans « plusieurs » : celui qu'il a touché
  const [indice, setIndice] = React.useState('');      // un code lu qui n'est pas un n° de suivi (la caméra continue)
  const [saisie, setSaisie] = React.useState('');
  const [clavier, setClavier] = React.useState(false);
  const [lampe, setLampe] = React.useState(null);      // null : pas de lampe ; false / true
  const piste = React.useRef(null);
  const bip = React.useRef(null); if (!bip.current) bip.current = creerBip();
  const n = React.useRef(0);
  const enCours = React.useRef(null);                  // la lecture qui attend les sources
  const resRef = React.useRef(null); resRef.current = res;

  const resoudre = React.useCallback((brut, { tape = false } = {}) => {
    const lu = lireCodeColis(brut);
    if (!lu) {
      if (tape) { n.current += 1; setRes({ etat: 'pasReconnu', brut: String(brut), n: n.current }); vibrer([30, 60, 30]); bip.current(false); }
      else setIndice(court(brut));
      return;
    }
    setIndice('');
    const finir = (incomplet) => {
      const S = lireSourcesColis();
      const r = retrouverParSuivi(lu, S.enregistrements);
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
      // Une source pas lue n'est jamais « rien » (ni « un seul » : l'autre source pourrait porter le même n°) :
      // on attend qu'elles soient lues ; au-delà de 10 s, on dit ce qui manque.
      if (Date.now() - t0 >= ATTENTE_SOURCES_MS) { finir(true); return; }
      setRes({ etat: 'attente', lu, brut: String(brut), n: n.current });
      enCours.current = setTimeout(essayer, 300);
    };
    if (enCours.current) clearTimeout(enCours.current);
    if (!lireSourcesColis().pret && onAttendreSources) { try { onAttendreSources(); } catch (_) {} }
    essayer();
  }, [onAttendreSources]);

  // La caméra lit en continu ; une fiche montrée, elle ne remplace plus rien tant qu'il ne rescanne pas.
  const traiter = React.useCallback((brut) => {
    if (resRef.current) return;   // une fiche, une liste, un message ou une attente est montré
    resoudre(brut);
  }, [resoudre]);
  const opts = React.useMemo(() => ({
    zone: ZONE, pause: 90,   // le centre deux fois sur trois, et peu d'attente entre deux lectures : < 1 s sur un code net
    surFlux: (flux) => {
      try {
        const t = flux && flux.getVideoTracks ? flux.getVideoTracks()[0] : null; piste.current = t || null;
        const caps = t && typeof t.getCapabilities === 'function' ? t.getCapabilities() : null;
        setLampe(caps && caps.torch ? false : null);
      } catch (_) { setLampe(null); }
    },
  }), []);
  const camera = useLectureCamera(video, traiter, opts);

  React.useEffect(() => () => { if (enCours.current) clearTimeout(enCours.current); }, []);
  // L'app dessous n'est plus dessinée tant que le scanner la couvre (scanner-retrouver.css), rendue à la fermeture.
  React.useEffect(() => { const h = document.documentElement; h.setAttribute('data-scan-retrouver', ''); return () => h.removeAttribute('data-scan-retrouver'); }, []);
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
  const valider = (e) => { e.preventDefault(); const s = saisie.trim(); if (!s) return; resoudre(s, { tape: true }); setSaisie(''); };
  const autre = () => { setRes(null); setChoisi(null); setIndice(''); };
  const ouvrir = (e) => {
    if (!e || !e.lien) return;
    try { window.dispatchEvent(new CustomEvent('vrm:aller', { detail: e.lien })); } catch (_) {}
    if (onFermer) onFermer();
  };
  const chercher = (lu) => { if (onChercher && lu) onChercher(lu.suivi); if (onFermer) onFermer(); };
  const montrer = res && res.etat === 'un' ? res.trouve : res && res.etat === 'plusieurs' && choisi ? choisi : null;
  const sansCam = camera === 'sans';

  return createPortal(
    <div className={'vrm-rtv' + (res && res.etat !== 'attente' ? ' a-resultat' : '') + (sansCam ? ' sans-camera' : '')} role="dialog" aria-modal="true" aria-label={tr('scan.r.titre')}
      data-scan-r="" data-scan-r-camera={camera} data-scan-r-etat={res ? res.etat : ''} data-scan-r-n={res ? res.n : 0} style={{ zIndex }}>
      {children}
      <div className="vrm-rtv-vue" aria-hidden="true">
        <video ref={video} playsInline muted autoPlay/>
        <span className="vrm-rtv-voile"/>
      </div>
      <header className="vrm-rtv-tete">
        <h2 className="vrm-rtv-h">{tr('scan.r.titre')}</h2>
        <button type="button" className="vrm-rtv-rond" data-scan-r-fermer="" aria-label={tr('scan.r.fermer')} onClick={onFermer}><Icone d={I_FERMER} taille={20}/></button>
      </header>
      {!sansCam ? (
        <div className={'vrm-rtv-viseur' + (res && (res.etat === 'un' || res.etat === 'plusieurs') ? ' is-trouve' : '')} aria-hidden="true">
          <i/><i/><i/><i/><span className="vrm-rtv-ligne"/>
        </div>
      ) : null}
      <div className="vrm-rtv-aide" role="status" aria-live="polite">
        {sansCam ? <p className="vrm-rtv-aide-txt" data-scan-r-sans-camera={raisonCamera() || ''}>{phraseCamera()}</p>
          : indice ? <p className="vrm-rtv-aide-txt is-indice" data-acc-echec="colis.retrouver" data-acc-raison="pasReconnu" data-scan-r-indice={indice}>{tr('scan.r.indice')}</p>
          : !res ? <p className="vrm-rtv-aide-txt" data-acc-avant="colis.retrouver">{camera === 'demarrage' ? tr('scan.r.demarrage') : tr('acc.colis.retrouver.avant')}</p> : null}
      </div>
      <div className="vrm-rtv-bas">
        {res && res.etat !== 'attente' ? (
          <section className="vrm-rtv-feuille" role="status" aria-live="assertive" data-scan-r-resultat={res.etat} data-scan-r-cle={montrer ? `${montrer.sorte}:${montrer.cle}` : ''}>
            {montrer ? <>
              {res.etat === 'plusieurs' ? <button type="button" className="vrm-rtv-lien vrm-rtv-retour" data-scan-r-liste-retour="" onClick={() => setChoisi(null)}>{tr('scan.r.plusieursRetour', { n: res.trouves.length })}</button> : null}
              <Fiche e={montrer} lu={res.lu} Photo={Photo} onOuvrir={ouvrir}/>
            </> : res.etat === 'plusieurs' ? (
              <div className="vrm-rtv-plusieurs" data-scan-r-plusieurs={res.trouves.length}>
                <p className="vrm-rtv-msg-titre">{tr('scan.r.plusieurs', { n: res.trouves.length })}</p>
                <p className="vrm-rtv-msg-sous">{tr('scan.r.plusieursSous')}</p>
                <ul className="vrm-rtv-liste">
                  {res.trouves.map((e) => (
                    <li key={`${e.sorte}:${e.cle}`}>
                      <button type="button" className="vrm-rtv-rangee" data-scan-r-choix={`${e.sorte}:${e.cle}`} onClick={() => setChoisi(e)}>
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
                <p className="vrm-rtv-msg-titre" data-scan-r-message="">{res.incomplet ? tr('scan.r.pasLu') : tr('scan.r.aucun')}</p>
                <dl className="vrm-rtv-lu-detail">
                  <div><dt>{tr('scan.r.transporteur')}</dt><dd data-scan-r-transporteur={res.lu.transporteur || ''}>{res.lu.nom || tr('scan.r.transporteurInconnu')}</dd></div>
                  <div><dt>{tr('scan.r.numero')}</dt><dd className="vrm-rtv-mono" data-scan-r-suivi={res.lu.suivi}>{res.lu.suivi}</dd></div>
                </dl>
                {res.manques && res.manques.length ? <p className="vrm-rtv-msg-sous" data-scan-r-manques="">{tr('scan.r.manques', { quoi: res.manques.join(', ') })}</p> : <p className="vrm-rtv-msg-sous">{tr('acc.colis.retrouver.pasTrouve')}</p>}
                {onChercher ? <button type="button" className="vrm-rtv-touche" data-scan-r-chercher={res.lu.suivi} onClick={() => chercher(res.lu)}><Icone d={I_LOUPE} taille={18}/>{tr('scan.r.chercher')}</button> : null}
              </div>
            ) : (
              <div className="vrm-rtv-msg" data-acc-echec="colis.retrouver" data-acc-raison="pasReconnu">
                <p className="vrm-rtv-msg-titre" data-scan-r-message="">{tr('scan.r.pasReconnu')}</p>
                <p className="vrm-rtv-msg-sous">{tr('acc.colis.retrouver.pasReconnu')}</p>
                <p className="vrm-rtv-lu vrm-rtv-mono">{court(res.brut)}</p>
              </div>
            )}
            <button type="button" className="vrm-rtv-lien" data-scan-r-autre="" onClick={autre}>{tr('scan.r.autre')}</button>
          </section>
        ) : res && res.etat === 'attente' ? (
          <section className="vrm-rtv-feuille is-attente" role="status" data-scan-r-resultat="attente"><span className="vrm-rtv-roue" aria-hidden="true"/><p className="vrm-rtv-msg-sous">{tr('scan.r.attente')}</p></section>
        ) : (
          <div className="vrm-rtv-outils">
            {lampe != null ? <button type="button" className={'vrm-rtv-rond' + (lampe ? ' is-actif' : '')} data-scan-r-lampe={lampe ? '1' : '0'} aria-pressed={lampe ? 'true' : 'false'} aria-label={tr('scan.r.lampe')} onClick={basculerLampe}><Icone d={I_LAMPE}/></button> : null}
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
