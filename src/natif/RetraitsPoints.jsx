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
//    · (20 nov., suite) la BARRE DU TRAJET de chaque colis (Payé · Expédié · En transit · Au point · Retiré), chaque
//      étape sur sa date LUE (src/retraitTrajet.js), grise sinon ; le QR à DROITE du code, en grand, sur blanc ;
//      la RÉTENTION : un colis « à vérifier » (date limite dépassée…) reste dans sa carte, code et QR visibles ;
//    · « Je suis au point » : plein écran sombre, tous les codes l'un sous l'autre, QR sur blanc, écran gardé allumé
//      (`navigator.wakeLock`), « J'ai tout retiré » ou colis par colis — annulable 10 s.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { createPortal } from 'react-dom';
import { tr, localeCourante } from '../i18n/index.js';
import { CLE_RETRAITS_VUS, estNouveau, marquerVu } from '../retraitsNouveaux.js';
import { trierPoints, resumeRetraits, limiteDuPoint, compteARebours, lienItineraire, appareilApple, colisDuPoint, mentionVerif } from '../retraitsVue.js';
import { jourCourt } from '../retraitTrajet.js';
import { MiniCarte } from './MiniCarte.jsx';
import { texteContenu, rangeeRetrait } from '../contenuColis.js';
import './retraits.css';

const ANNULER_MS = 10000;
// (20 nov., rétention) Tout colis que `pickupUnion` n'a pas FINI par une preuve reste dans la carte de son point :
// les comptés, puis les « à vérifier » (date limite dépassée…), code et QR visibles (src/retraitsVue.js `colisDuPoint`).
const MENTION = { depasse: 'retraits.m.depasse', 'trop-long': 'retraits.m.tropLong', 'sans-code': 'retraits.m.sansCode', transporteur: 'retraits.m.transporteur', doute: 'retraits.m.doute', autre: 'retraits.m.autre' };
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

// La barre du trajet : cinq étapes, chacune allumée par SA date lue (jamais déduite d'une autre). La plus avancée des
// étapes lues est la courante (accent) ; une étape non lue reste grise, sans date.
function Trajet({ t }) {
  if (!t || !Array.isArray(t.etapes) || !t.etapes.length) return null;
  const loc = localeCourante();
  const aria = t.etapes.map((e) => tr('retraits.t.' + e.cle) + ' ' + (e.lue ? jourCourt(e.at, loc) : tr('retraits.t.pasLue'))).join(', ');
  return (
    <ol className="n-rp-trajet" data-rp-trajet="" data-rp-trajet-courante={t.courante >= 0 ? t.etapes[t.courante].cle : ''} aria-label={tr('retraits.t.aria', { etapes: aria })}>
      {t.etapes.map((e, i) => {
        const lienLu = i > 0 && e.lue && t.etapes[i - 1].lue;
        return (
          <li key={e.cle} className={'n-rp-etape' + (e.lue ? ' is-lue' : '') + (i === t.courante ? ' is-courante' : '') + (lienLu ? ' is-lien-lu' : '')}
            data-rp-etape={e.cle} data-rp-etape-lue={e.lue ? '1' : '0'} data-rp-etape-courante={i === t.courante ? '1' : undefined} data-rp-etape-at={e.lue ? new Date(e.at).toISOString() : ''} aria-hidden="true">
            <span className="n-rp-etape-point"/>
            <span className="n-rp-etape-nom">{tr('retraits.t.' + e.cle)}</span>
            <span className="n-rp-etape-date">{e.lue ? jourCourt(e.at, loc) : ''}</span>
          </li>);
      })}
    </ol>
  );
}

function LigneColis({ x, aides, Photo, Icon, nouveaux, enCours }) {
  const neuf = !!(nouveaux && estNouveau(nouveaux.etat, x.cle || x.id));
  const conflit = x.codesDesaccord && x.codesDesaccord.length > 1;
  const code = conflit ? '' : (x.code || '');
  const qr = aides.qrSrc(x);
  const ouvrir = aides.enGrand(x);
  const mention = mentionVerif(x);
  // Ce qu'il y a DEDANS (src/contenuColis.js : l'achat relié par identité, prix payé, compte ; ou « pas encore lu »).
  const contenu = x.contenu || null;
  const contenuTxt = texteContenu(contenu, tr);
  const prix = contenuTxt ? '' : (aides.prixDe ? aides.prixDe(x) : '');
  const rg = rangeeRetrait(x) || { codeEtat: '', qr: false, limite: {}, titreDe: '', transporteur: {} };
  const photo = x.photo && Photo ? Photo(x.photo) : null;
  const retireBientot = !!enCours[x.cle || x.id];
  const voirQr = ouvrir && qr ? () => { if (neuf) nouveaux.vu(x.cle || x.id); ouvrir(); } : null;
  const voirCode = ouvrir ? () => { if (neuf) nouveaux.vu(x.cle || x.id); ouvrir(); } : null;
  const long = code.length > 7;
  return (
    <li className={'n-rp-colis' + (neuf ? ' is-nouveau' : '') + (retireBientot ? ' is-retire' : '') + (mention ? ' is-verif' : '')} data-rp-colis={x.cle || x.id} data-rp-code={code} data-rp-sorte={x.sorte || ''} data-rp-verif={mention || undefined}
      data-v2-face={x.cle || x.id} data-v2-code={x.code || ''} data-v2-sorte={x.sorte || ''} data-v2-code-etat={rg.codeEtat} data-v2-qr-dispo={rg.qr ? '1' : '0'} data-v2-limite-jour={(rg.limite && rg.limite.jour) || ''} data-v2-limite-source={(rg.limite && rg.limite.source) || ''} data-v2-titre-de={rg.titreDe || ''} data-v2-transporteur={(rg.transporteur && rg.transporteur.cle) || ''}>
      <div className="n-rp-colis-haut">
        <span className="n-rp-vignette v2-passe-photo" aria-hidden="true" data-rp-photo={photo ? '1' : '0'} data-v2-photo-article={photo ? '' : undefined}>{photo || <Icon name="box" size={22}/>}</span>
        <span className="n-rp-colis-texte">
          <span className="n-rp-colis-titre v2-passe-titre">{aides.titre(x)}</span>
          <span className="n-rp-colis-meta">
            {neuf ? <span className="n-rp-etiquette" data-n-ton="accent" data-rp-nouveau="">{tr('v2.passe.nouveau')}</span> : null}
            {x.num ? <span className="n-rp-num" data-rp-num={x.num}>N° {x.num}</span> : null}
            {prix ? <span className="n-rp-prix" data-rp-prix="">{prix}</span> : null}
            {contenuTxt ? <span className={'n-rp-dedans' + (contenu.etat === 'pas-lu' ? ' is-pas-lu' : '')} data-rp-prix={contenu.etat === 'relie' && contenu.prix ? '' : undefined} data-v2-contenu={contenu.etat} data-v2-contenu-tx={contenu.tx || undefined} data-v2-contenu-raison={contenu.etat === 'pas-lu' ? contenu.raison : undefined} data-v2-contenu-compte={contenu.compte || undefined}>{contenuTxt}</span> : null}
          </span>
        </span>
      </div>
      {mention ? <p className="n-rp-verif" data-rp-verif-mention={mention}><span className="n-rp-etiquette" data-n-ton="ambre">{tr(MENTION[mention] || MENTION.autre)}</span>{mention === 'autre' && x.raisonVerif ? <span className="n-rp-verif-raison">{x.raisonVerif}</span> : null}</p> : null}
      <Trajet t={x.trajet}/>
      <div className={'n-rp-code-zone' + (qr ? ' avec-qr' : '')}>
        <div className="n-rp-code-col">
          {code ? (voirCode
            ? <div role="button" tabIndex={0} className={'n-rp-code n-rp-code-btn' + (long ? ' is-long' : '')} onClick={voirCode} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); voirCode(); } }} data-v2-en-grand="" aria-label={tr('v2.passe.afficherCode') + ' · ' + code}><b data-rp-code-grand="" data-v2-code-grand="">{code}</b></div>
            : <b className={'n-rp-code' + (long ? ' is-long' : '')} data-rp-code-grand="" data-v2-code-grand="">{code}</b>)
            : <span className="n-rp-sans-code" data-rp-sans-code={conflit ? 'conflit' : 'pas-lu'}>{tr(conflit ? 'v2.passe.codesEnConflit' : 'retraits.v.codePasLu')}</span>}
          {code ? <Copier code={code}/> : null}
        </div>
        {/* (20 nov.) LE QR À DROITE DU CODE, en grand, sur blanc ; toucher = plein écran. Jamais fabriqué : l'image LUE (src/retraitQr.js). */}
        {qr ? <button type="button" className="n-rp-qr" onClick={voirQr || undefined} data-rp-qr="" aria-label={tr('retraits.v.qrEnGrand') + ' · ' + aides.titre(x)}><img src={qr} alt="" loading="lazy" decoding="async"/></button> : null}
      </div>
    </li>
  );
}

function CartePoint({ p, aides, Photo, Icon, Logo, nouveaux, enCours, onAuPoint, apple }) {
  const { comptes, verif } = colisDuPoint(p);
  const colis = [...comptes, ...verif];
  const transp = (p.transporteurs || [])[0] || '';
  const nomT = transp ? aides.nomTransporteur(transp) : '';
  const rebours = compteARebours(limiteDuPoint(p));
  const horaires = aides.horairesDe ? aides.horairesDe(p) : '';
  const lien = lienItineraire(p, { apple });
  const lieu = p.nom || tr('v2.retirer.pointInconnu');
  return (
    <article className="n-rp-carte" data-v2-passe={p.inconnu ? 'inconnu' : String(p.numero || '')} data-v2-passe-n={String(colis.length)} id={'n-rp-' + (p.cle || p.numero)} data-rp-point={p.inconnu ? 'inconnu' : String(p.numero || '')} data-rp-n={String(comptes.length)} data-rp-verif-n={String(verif.length)} data-rp-sorte={p.consigne ? 'consigne' : 'comptoir'} aria-label={tr('v2.passe.aria', { lieu, n: colis.length })}>
      <header className="n-rp-tete">
        <div className="n-rp-tete-ligne">
          <span className="n-rp-transp" data-rp-transp={transp}>{transp && Logo ? <Logo cle={transp} taille={20}/> : null}<span>{nomT || tr('retraits.v.transpInconnu')}</span></span>
          {!comptes.length ? <span className="n-rp-etiquette" data-n-ton="ambre" data-rp-rebours="verif">{tr('retraits.v.nVerif', { n: verif.length })}</span>
            : rebours ? <span className="n-rp-etiquette" data-n-ton={rebours.ambre ? 'ambre' : 'neutre'} data-rp-rebours={rebours.cle}>{texteRebours(rebours)}</span> : <span className="n-rp-etiquette" data-n-ton="neutre" data-rp-rebours="pas-lu">{tr('retraits.v.limitePasLue')}</span>}
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
        {comptes.map((x) => <LigneColis key={x.cle || x.id} x={x} aides={aides} Photo={Photo} Icon={Icon} nouveaux={nouveaux} enCours={enCours}/>)}
      </ul>
      {verif.length ? <>
        <p className="n-rp-verif-tete" data-rp-verif-tete={verif.length}>{tr('retraits.m.horsCompte')}</p>
        <ul className="n-rp-liste" data-rp-verif-liste="">
          {verif.map((x) => <LigneColis key={x.cle || x.id} x={x} aides={aides} Photo={Photo} Icon={Icon} nouveaux={nouveaux} enCours={enCours}/>)}
        </ul>
      </> : null}
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
  // Les comptés d'abord, puis les « à vérifier » qui ont encore un code ou un QR (il est peut-être encore là).
  const { comptes: cAp, verif: vAp } = colisDuPoint(p);
  const colis = [...cAp, ...vAp];
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
              {mentionVerif(x) ? <span className="n-rp-ap-verif" data-rp-ap-verif={mentionVerif(x)}>{tr(MENTION[mentionVerif(x)] || MENTION.autre)}</span> : null}
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
  const avec = trierPoints(points.map((p) => ({ ...p, arrives: (p.arrives || []).filter((x) => x && !x.redirige) })).filter((p) => { const d = colisDuPoint(p); return d.comptes.length + d.verif.length > 0; }));
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
          {r.verif ? <><span aria-hidden="true"> · </span><span className="n-rp-urgent" data-rp-resume-verif={r.verif}>{tr('retraits.v.nVerif', { n: r.verif })}</span></> : null}
        </p>
        <ol className="n-rp-plan" data-rp-plan="">
          {avec.map((p, i) => { const c = compteARebours(limiteDuPoint(p)); return (
            <li key={p.cle || i}><button type="button" className="n-rp-plan-btn" onClick={() => aller(p)} data-rp-plan-point={p.cle || ''}>
              <span className="n-rp-plan-i" aria-hidden="true">{i + 1}</span>
              <span className="n-rp-plan-nom">{p.nom || tr('v2.retirer.pointInconnu')}</span>
              <span className="n-rp-plan-n">{(() => { const d = colisDuPoint(p); return d.comptes.length ? tr('v2.passe.colis', { n: d.comptes.length }) : tr('retraits.v.nVerif', { n: d.verif.length }); })()}{c ? ' · ' : ''}{c ? <span className={c.ambre ? 'n-rp-urgent' : ''}>{texteRebours(c)}</span> : null}</span>
            </button></li>); })}
        </ol>
      </section>
      <div className="n-rp-cartes" data-v2-bloc="passes">
        {avec.map((p) => <CartePoint key={p.cle || p.numero} p={p} aides={aides} Photo={Photo} Icon={Icon} Logo={Logo} nouveaux={nouveaux} enCours={differe.enCours} onAuPoint={ouvrirAuPoint} apple={apple}/>)}
      </div>
      {pOuvert ? <AuPoint p={pOuvert} aides={aides} onFermer={fermer} differe={differe}/> : null}
    </div>
  );
}

export default RetraitsPoints;
