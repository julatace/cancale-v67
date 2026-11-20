// ════════════════════════════════════════════════════════════════════════════
//  src/natif/RetraitsPoints.jsx — LES COLIS À RETIRER, UNE CARTE PAR POINT (20 nov.)
//  Julien : « Colis à retirer beaucoup plus visuel, c'est pas exceptionnel, tu peux encore faire ».
//  Style natif « entre Vintex et natif » (docs/design/NATIF.md §2 bis) : cartes à filet, petites capitales grises,
//  étiquettes douces, accent rare, ambre = urgent. AUCUNE règle ici : les points arrivent de `pointsARetirer`
//  (src/relaisColis.js) sur la liste `pickupUnion`, chaque geste est celui d'avant (`retirer` = markCollected /
//  markPickupDone, `enGrand` = openQrView). Tri, résumé, compte à rebours, itinéraire : src/retraitsVue.js.
//    · une bande résumé et le plan des points (liste ordonnée, aucune carte payante) ;
//    · une carte par point : nom en grand, sorte (consigne / comptoir), transporteur et logo, adresse + Itinéraire,
//      horaires LUS, compte à rebours de la limite LUE, mini-carte seulement si un repère sûr existe ;
//    · chaque colis : photo, titre, N°, prix payé, le CODE en très grand + « Copier », miniature du QR s'il existe,
//      « Nouveau » s'il vient d'arriver ;
//    · « Je suis au point » : plein écran sombre, tous les codes l'un sous l'autre, QR sur blanc, écran gardé allumé
//      (`navigator.wakeLock`), « J'ai tout retiré » ou colis par colis — annulable 10 s.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { createPortal } from 'react-dom';
import { tr } from '../i18n/index.js';
import { CLE_RETRAITS_VUS, estNouveau, marquerVu } from '../retraitsNouveaux.js';
import { trierPoints, resumeRetraits, limiteDuPoint, compteARebours, lienItineraire, appareilApple } from '../retraitsVue.js';
import { MiniCarte } from './MiniCarte.jsx';
import './retraits.css';

const ANNULER_MS = 10000;
const aPresenter = (x) => x && !x.aVerifier && !x.horsCompte && !x.redirige;
const lireNouveaux = () => { try { return JSON.parse(localStorage.getItem(CLE_RETRAITS_VUS) || 'null'); } catch (_) { return null; } };
const texteRebours = (c) => {
  if (!c) return '';
  if (c.cle === 'depasse') return tr('retraits.v.depasse');
  if (c.cle === 'aujourdhui') return c.heure ? tr('retraits.v.aujourdhuiHeure', { h: c.heure }) : tr('retraits.v.aujourdhui');
  if (c.cle === 'demain') return c.heure ? tr('retraits.v.demainHeure', { h: c.heure }) : tr('retraits.v.demain');
  return tr('retraits.v.dans', { n: c.n });
};

// Les retraits « en cours » (annulables 10 s) : une clé ⇒ minuterie ; à l'échéance, le geste d'avant.
function useRetraitsDiffere(retirer) {
  const [enCours, setEnCours] = React.useState({});
  const minut = React.useRef(new Map());
  React.useEffect(() => () => { for (const [, id] of minut.current) clearTimeout(id); }, []);
  const lancer = React.useCallback((colis) => {
    const fin = Date.now() + ANNULER_MS;
    for (const x of colis) {
      const k = x.cle || x.id;
      if (minut.current.has(k)) continue;
      minut.current.set(k, setTimeout(() => {
        minut.current.delete(k);
        try { retirer(x); } catch (_) {}
        setEnCours((e) => { const n = { ...e }; delete n[k]; return n; });
      }, ANNULER_MS));
    }
    setEnCours((e) => { const n = { ...e }; for (const x of colis) n[x.cle || x.id] = fin; return n; });
  }, [retirer]);
  const annuler = React.useCallback((cles) => {
    for (const k of cles) { const id = minut.current.get(k); if (id) clearTimeout(id); minut.current.delete(k); }
    setEnCours((e) => { const n = { ...e }; for (const k of cles) delete n[k]; return n; });
  }, []);
  return { enCours, lancer, annuler };
}

function Copier({ code }) {
  const [fait, setFait] = React.useState(false);
  const copier = async (e) => {
    e.stopPropagation();
    try { await navigator.clipboard.writeText(code); setFait(true); setTimeout(() => setFait(false), 1600); } catch (_) { setFait(false); }
  };
  return <button type="button" className="n-rp-copier" onClick={copier} data-rp-copier={code} aria-label={tr('retraits.v.copierAria', { code })}>{fait ? tr('retraits.v.copie') : tr('retraits.v.copier')}</button>;
}

function LigneColis({ x, aides, Photo, Icon, nouveaux, enCours }) {
  const neuf = !!(nouveaux && estNouveau(nouveaux.etat, x.cle || x.id));
  const conflit = x.codesDesaccord && x.codesDesaccord.length > 1;
  const code = conflit ? '' : (x.code || '');
  const qr = aides.qrSrc(x);
  const ouvrir = aides.enGrand(x);
  const prix = aides.prixDe ? aides.prixDe(x) : '';
  const photo = x.photo && Photo ? Photo(x.photo) : null;
  const retireBientot = !!enCours[x.cle || x.id];
  const voirQr = ouvrir && qr ? () => { if (neuf) nouveaux.vu(x.cle || x.id); ouvrir(); } : null;
  return (
    <li className={'n-rp-colis' + (neuf ? ' is-nouveau' : '') + (retireBientot ? ' is-retire' : '')} data-rp-colis={x.cle || x.id} data-rp-code={code} data-rp-sorte={x.sorte || ''}>
      <div className="n-rp-colis-haut">
        <span className="n-rp-vignette" aria-hidden="true" data-rp-photo={photo ? '1' : '0'}>{photo || <Icon name="box" size={22}/>}</span>
        <span className="n-rp-colis-texte">
          <span className="n-rp-colis-titre">{aides.titre(x)}</span>
          <span className="n-rp-colis-meta">
            {neuf ? <span className="n-rp-etiquette" data-n-ton="accent" data-rp-nouveau="">{tr('v2.passe.nouveau')}</span> : null}
            {x.num ? <span className="n-rp-num" data-rp-num={x.num}>N° {x.num}</span> : null}
            {prix ? <span className="n-rp-prix" data-rp-prix="">{prix}</span> : null}
          </span>
        </span>
      </div>
      <div className="n-rp-code-zone">
        {code ? <>
          <b className="n-rp-code" data-rp-code-grand="">{code}</b>
          <Copier code={code}/>
        </> : <span className="n-rp-sans-code" data-rp-sans-code={conflit ? 'conflit' : 'pas-lu'}>{tr(conflit ? 'v2.passe.codesEnConflit' : 'retraits.v.codePasLu')}</span>}
        {qr ? <button type="button" className="n-rp-qr-mini" onClick={voirQr || undefined} data-rp-qr="" aria-label={tr('v2.passe.afficherQr') + ' · ' + aides.titre(x)}><img src={qr} alt="" loading="lazy" decoding="async"/></button> : null}
      </div>
    </li>
  );
}

function CartePoint({ p, aides, Photo, Icon, Logo, nouveaux, enCours, onAuPoint, apple }) {
  const colis = p.arrives;
  const transp = (p.transporteurs || [])[0] || '';
  const nomT = transp ? aides.nomTransporteur(transp) : '';
  const rebours = compteARebours(limiteDuPoint(p));
  const horaires = aides.horairesDe ? aides.horairesDe(p) : '';
  const lien = lienItineraire(p, { apple });
  const lieu = p.nom || tr('v2.retirer.pointInconnu');
  return (
    <article className="n-rp-carte" id={'n-rp-' + (p.cle || p.numero)} data-rp-point={p.inconnu ? 'inconnu' : String(p.numero || '')} data-rp-n={String(colis.length)} data-rp-sorte={p.consigne ? 'consigne' : 'comptoir'} aria-label={tr('v2.passe.aria', { lieu, n: colis.length })}>
      <header className="n-rp-tete">
        <div className="n-rp-tete-ligne">
          <span className="n-rp-transp" data-rp-transp={transp}>{transp && Logo ? <Logo cle={transp} taille={20}/> : null}<span>{nomT || tr('retraits.v.transpInconnu')}</span></span>
          {rebours ? <span className="n-rp-etiquette" data-n-ton={rebours.ambre ? 'ambre' : 'neutre'} data-rp-rebours={rebours.cle}>{texteRebours(rebours)}</span> : <span className="n-rp-etiquette" data-n-ton="neutre" data-rp-rebours="pas-lu">{tr('retraits.v.limitePasLue')}</span>}
        </div>
        <h3 className="n-rp-nom">{lieu}</h3>
        <span className="n-rp-etiquette n-rp-sorte" data-n-ton="neutre" data-rp-sorte-etiquette={p.consigne ? 'consigne' : 'comptoir'}>{tr(p.consigne ? 'v2.passe.consigne' : 'v2.passe.comptoir')}</span>
        <div className="n-rp-adresse-ligne">
          <span className="n-rp-adresse" data-rp-adresse="">{p.adresse || tr('retraits.v.adressePasLue')}</span>
          {lien ? <a className="n-rp-itineraire" href={lien} target="_blank" rel="noopener noreferrer" data-rp-itineraire="">{tr('retraits.v.itineraire')}</a> : null}
        </div>
        {horaires ? <p className="n-rp-horaires" data-rp-horaires="">{horaires}</p> : null}
      </header>
      {p.repere && !p.sansCarte ? <MiniCarte lat={p.repere.lat} lon={p.repere.lon}/> : null}
      <ul className="n-rp-liste">
        {colis.map((x) => <LigneColis key={x.cle || x.id} x={x} aides={aides} Photo={Photo} Icon={Icon} nouveaux={nouveaux} enCours={enCours}/>)}
      </ul>
      <div className="n-rp-pied">
        <button type="button" className="n-rp-plein" onClick={() => onAuPoint(p)} data-rp-au-point="">{tr('retraits.v.auPoint')}</button>
      </div>
    </article>
  );
}

// ── « JE SUIS AU POINT » ─────────────────────────────────────────────────────
function AuPoint({ p, aides, onFermer, differe }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    let verrou = null, vivant = true;
    const demander = async () => { try { if (navigator.wakeLock && document.visibilityState === 'visible') { const v = await navigator.wakeLock.request('screen'); if (vivant) verrou = v; else v.release().catch(() => {}); } } catch (_) {} };
    demander();
    const vis = () => { if (document.visibilityState === 'visible') demander(); };
    document.addEventListener('visibilitychange', vis);
    const esc = (e) => { if (e.key === 'Escape') onFermer(); };
    window.addEventListener('keydown', esc);
    try { ref.current && ref.current.focus(); } catch (_) {}
    return () => { vivant = false; document.removeEventListener('visibilitychange', vis); window.removeEventListener('keydown', esc); try { if (verrou) verrou.release().catch(() => {}); } catch (_) {} };
  }, [onFermer]);
  const colis = p.arrives;
  const cles = colis.map((x) => x.cle || x.id);
  const tousEnCours = cles.every((k) => differe.enCours[k]);
  const noeud = (
    <div className="n-rp-aupoint" role="dialog" aria-modal="true" aria-label={tr('retraits.v.auPointAria', { lieu: p.nom || '' })} data-rp-aupoint="" tabIndex={-1} ref={ref}>
      <div className="n-rp-ap-tete">
        <div className="n-rp-ap-titres">
          <span className="n-rp-ap-sur">{tr(p.consigne ? 'v2.passe.consigne' : 'v2.passe.comptoir')}</span>
          <h2 className="n-rp-ap-nom">{p.nom || tr('v2.retirer.pointInconnu')}</h2>
          <span className="n-rp-ap-n">{tr('v2.passe.colis', { n: colis.length })}</span>
        </div>
        <button type="button" className="n-rp-ap-fermer" onClick={onFermer} data-rp-aupoint-fermer="">{tr('retraits.v.fermer')}</button>
      </div>
      <ol className="n-rp-ap-liste">
        {colis.map((x) => { const k = x.cle || x.id; const conflit = x.codesDesaccord && x.codesDesaccord.length > 1; const code = conflit ? '' : (x.code || ''); const qr = aides.qrSrc(x); const ec = differe.enCours[k];
          return (
            <li key={k} className={'n-rp-ap-colis' + (ec ? ' is-retire' : '')} data-rp-ap-colis={k} data-rp-ap-code={code}>
              <span className="n-rp-ap-titre">{aides.titre(x)}{x.num ? ` · N° ${x.num}` : ''}</span>
              {code ? <b className="n-rp-ap-code" data-rp-ap-code-grand="">{code}</b> : <span className="n-rp-ap-sans">{tr(conflit ? 'v2.passe.codesEnConflit' : 'retraits.v.codePasLu')}</span>}
              {x.code2 ? <span className="n-rp-ap-code2">{tr('retraits.v.identifiant', { c: x.code2 })}</span> : null}
              {qr ? <span className="n-rp-ap-qr" data-rp-ap-qr=""><img src={qr} alt={tr('v2.passe.qr')}/></span> : null}
              {ec
                ? <button type="button" className="n-rp-ap-annuler" onClick={() => differe.annuler([k])} data-rp-ap-annuler={k}>{tr('retraits.v.annuler')}</button>
                : <button type="button" className="n-rp-ap-un" onClick={() => differe.lancer([x])} data-rp-ap-retire={k}>{tr('v2.passe.retire')}</button>}
            </li>); })}
      </ol>
      <div className="n-rp-ap-pied">
        {tousEnCours
          ? <button type="button" className="n-rp-ap-tout is-annuler" onClick={() => differe.annuler(cles)} data-rp-ap-tout-annuler="">{tr('retraits.v.toutRetireAnnuler')}</button>
          : <button type="button" className="n-rp-ap-tout" onClick={() => differe.lancer(colis.filter((x) => !differe.enCours[x.cle || x.id]))} data-rp-ap-tout="">{tr('retraits.v.toutRetire')}</button>}
      </div>
    </div>
  );
  return typeof document !== 'undefined' ? createPortal(noeud, document.body) : noeud;
}

// L'illustration de « Rien à retirer » : un colis ouvert, sobre (traits seulement, jetons de l'encre).
const IllustrationVide = () => (
  <svg className="n-rp-vide-ill" viewBox="0 0 120 96" width="120" height="96" aria-hidden="true" focusable="false">
    <path d="M20 38 L60 22 L100 38 L60 54 Z" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/>
    <path d="M20 38 V70 L60 86 V54" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/>
    <path d="M100 38 V70 L60 86" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/>
    <path d="M20 38 L8 26 L48 10 L60 22 M100 38 L112 26 L72 10 L60 22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" opacity=".55"/>
  </svg>
);
export function RienARetirer({ phrase = '' }) {
  return (
    <div className="n-rp-vide" data-rp-vide="">
      <IllustrationVide/>
      <p className="n-rp-vide-phrase">{phrase || tr('retraits.v.rien')}</p>
    </div>
  );
}

export function RetraitsPoints({ points = [], aides, Photo, Icon, Logo }) {
  const avec = trierPoints(points.map((p) => ({ ...p, arrives: (p.arrives || []).filter(aPresenter) })).filter((p) => p.arrives.length > 0));
  const [etatN, setEtatN] = React.useState(lireNouveaux);
  React.useEffect(() => { const f = () => setEtatN(lireNouveaux()); window.addEventListener('vrm:retraits-nouveaux', f); return () => window.removeEventListener('vrm:retraits-nouveaux', f); }, []);
  const nouveaux = React.useMemo(() => ({ etat: etatN, vu: (cle) => { const e = marquerVu(lireNouveaux(), cle); if (!e) return; try { localStorage.setItem(CLE_RETRAITS_VUS, JSON.stringify(e)); } catch (_) {} setEtatN(e); } }), [etatN]);
  const differe = useRetraitsDiffere(aides.retirer);
  const [auPoint, setAuPoint] = React.useState(null);
  const apple = React.useMemo(() => appareilApple(), []);
  const fermer = React.useCallback(() => setAuPoint(null), []);
  if (!avec.length) return null;
  const r = resumeRetraits(avec);
  const pOuvert = auPoint ? avec.find((p) => (p.cle || p.numero) === auPoint) : null;
  // Il ouvre « Je suis au point » : les colis de ce point ne sont plus « nouveaux ».
  const ouvrirAuPoint = (p) => { for (const x of p.arrives) if (estNouveau(etatN, x.cle || x.id)) nouveaux.vu(x.cle || x.id); setAuPoint(p.cle || p.numero); };
  const aller = (p) => { try { document.getElementById('n-rp-' + (p.cle || p.numero)).scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (_) {} };
  return (
    <div className="n-rp" data-rp="" data-rp-points={String(avec.length)} data-rp-colis={String(r.colis)}>
      <section className="n-rp-resume" data-rp-resume="" aria-label={tr('retraits.v.resumeAria')}>
        <p className="n-rp-resume-ligne">
          <b data-rp-resume-colis={r.colis}>{tr('retraits.v.nColis', { n: r.colis })}</b>
          <span aria-hidden="true"> · </span><span data-rp-resume-points={r.points}>{tr('retraits.v.nPoints', { n: r.points })}</span>
          {r.urgents ? <><span aria-hidden="true"> · </span><span className="n-rp-urgent" data-rp-resume-urgents={r.urgents}>{tr('retraits.v.nUrgents', { n: r.urgents })}</span></> : null}
        </p>
        <ol className="n-rp-plan" data-rp-plan="">
          {avec.map((p, i) => { const c = compteARebours(limiteDuPoint(p)); return (
            <li key={p.cle || i}><button type="button" className="n-rp-plan-btn" onClick={() => aller(p)} data-rp-plan-point={p.cle || ''}>
              <span className="n-rp-plan-i" aria-hidden="true">{i + 1}</span>
              <span className="n-rp-plan-nom">{p.nom || tr('v2.retirer.pointInconnu')}</span>
              <span className="n-rp-plan-n">{tr('v2.passe.colis', { n: p.arrives.length })}{c ? ' · ' : ''}{c ? <span className={c.ambre ? 'n-rp-urgent' : ''}>{texteRebours(c)}</span> : null}</span>
            </button></li>); })}
        </ol>
      </section>
      <div className="n-rp-cartes">
        {avec.map((p) => <CartePoint key={p.cle || p.numero} p={p} aides={aides} Photo={Photo} Icon={Icon} Logo={Logo} nouveaux={nouveaux} enCours={differe.enCours} onAuPoint={ouvrirAuPoint} apple={apple}/>)}
      </div>
      {pOuvert ? <AuPoint p={pOuvert} aides={aides} onFermer={fermer} differe={differe}/> : null}
    </div>
  );
}

export default RetraitsPoints;
