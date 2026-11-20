// ════════════════════════════════════════════════════════════════════════════
//  src/natif/RetraitsPoints.jsx — LES COLIS À RETIRER, UNE CARTE PAR POINT (20 nov.)
//  Julien : « Colis à retirer beaucoup plus visuel, c'est pas exceptionnel, tu peux encore faire ».
//  Style natif « entre Vintex et natif » (docs/design/NATIF.md §2 bis) : cartes à filet, petites capitales grises,
//  étiquettes douces, accent rare, ambre = urgent. AUCUNE règle ici : les points arrivent de `pointsARetirer`
//  (src/relaisColis.js) sur la liste `pickupUnion`, chaque geste est celui d'avant (`enGrand` = openQrView). Tri, résumé, compte à rebours, itinéraire : src/retraitsVue.js.
//    · une bande résumé et le plan des points (liste ordonnée, aucune carte payante) ;
//    · une carte par point : nom en grand, sorte (consigne / comptoir), transporteur et logo, adresse + Itinéraire,
//      horaires LUS, compte à rebours de la limite LUE, mini-carte seulement si un repère sûr existe ;
//    · chaque colis : photo, titre, N°, prix payé, le CODE en très grand + « Copier », miniature du QR s'il existe,
//      « Nouveau » s'il vient d'arriver ;
//    · (20 nov., suite) la BARRE DU TRAJET de chaque colis (Payé · Expédié · En transit · Au point · Retiré), chaque
//      étape sur sa date LUE (src/retraitTrajet.js), grise sinon ; le QR à DROITE du code, en grand, sur blanc ;
//      la RÉTENTION : un colis « à vérifier » (date limite dépassée…) reste dans sa carte, code et QR visibles ;
//    · (20 nov., Julien : « je ne veux plus de Je suis au point ») plus d'écran plein : le contenu, le code et le QR
//      restent dans la carte du point ; toucher le code ou le QR l'ouvre en grand (`enGrand` = openQrView, comme avant).
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr, localeCourante } from '../i18n/index.js';
import { CLE_RETRAITS_VUS, estNouveau, marquerVu } from '../retraitsNouveaux.js';
import { trierPoints, resumeRetraits, limiteDuPoint, compteARebours, lienItineraire, appareilApple, colisDuPoint, mentionVerif } from '../retraitsVue.js';
import { jourCourt } from '../retraitTrajet.js';
import { MiniCarte } from './MiniCarte.jsx';
import { texteContenu, rangeeRetrait } from '../contenuColis.js';
import './retraits.css';

// (20 nov., rétention) Tout colis que `pickupUnion` n'a pas FINI par une preuve reste dans la carte de son point :
// les comptés, puis les « à vérifier » (date limite dépassée…), code et QR visibles (src/retraitsVue.js `colisDuPoint`).
const SITES = { leboncoin: 'Leboncoin', vestiaire: 'Vestiaire Collective', ebay: 'eBay' };   // noms de marque, non traduits
const MENTION = { depasse: 'retraits.m.depasse', 'trop-long': 'retraits.m.tropLong', 'sans-code': 'retraits.m.sansCode', transporteur: 'retraits.m.transporteur', doute: 'retraits.m.doute', autre: 'retraits.m.autre' };
const lireNouveaux = () => { try { return JSON.parse(localStorage.getItem(CLE_RETRAITS_VUS) || 'null'); } catch (_) { return null; } };
const texteRebours = (c) => {
  if (!c) return '';
  if (c.cle === 'depasse') return tr('retraits.v.depasse');
  if (c.cle === 'aujourdhui') return c.heure ? tr('retraits.v.aujourdhuiHeure', { h: c.heure }) : tr('retraits.v.aujourdhui');
  if (c.cle === 'demain') return c.heure ? tr('retraits.v.demainHeure', { h: c.heure }) : tr('retraits.v.demain');
  return tr('retraits.v.dans', { n: c.n });
};

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

// Ce qu'il y a dans le colis : { photo, titre (2 lignes), taille · prix · compte, lot } — ou « pas encore lu ».
function Contenu({ x, c, rg, photo, aides, Icon, prix, neuf, }) {
  const relie = !!(c && c.etat === 'relie');
  const pasLu = !!(c && c.etat === 'pas-lu');
  // (20 nov., Julien : « les mêmes dispositions sur toutes les plateformes ») Un achat Leboncoin ou Vestiaire relié à CE
  // colis par son n° de suivi (`achatsAutres`, src/retraitQr.js) : SA photo et SON titre, comme un achat Vinted ; le site dit.
  const autre = !!(c && c.etat === 'autre-site');
  const titre = relie || autre ? (c.titre || aides.titre(x)) : (rg && rg.titreDe === 'email' ? rg.titre : (pasLu ? '' : aides.titre(x)));
  const phrase = texteContenu(c, tr);
  const details = relie ? [c.taille ? tr('retraits.c.taille', { t: c.taille }) : '', phrase].filter(Boolean) : [];
  return (
    <div className={'n-rp-contenu' + (pasLu && !titre ? ' is-pas-lu' : '')} data-rp-contenu={c ? c.etat : ''} data-rp-contenu-tx={relie ? c.tx : undefined}>
      <span className={'n-rp-vignette v2-passe-photo' + (relie && c.nb ? ' is-lot' : '')} aria-hidden="true" data-rp-photo={photo ? '1' : '0'} data-rp-photo-src={photo && (relie || autre) ? (c.photo || x.photo || undefined) : undefined} data-v2-photo-article={photo ? '' : undefined}>
        {photo || <Icon name="box" size={26}/>}
        {relie && c.nb ? <span className="n-rp-lot-n" data-rp-lot={c.nb}>×{c.nb}</span> : null}
      </span>
      <span className="n-rp-colis-texte">
        {titre ? <span className="n-rp-colis-titre v2-passe-titre" data-rp-titre="">{titre}</span> : null}
        {pasLu ? <span className={'n-rp-pas-lu' + (titre ? '' : ' is-seul')} data-rp-pas-lu="" data-v2-contenu="pas-lu" data-v2-contenu-raison={c.raison} data-v2-contenu-compte={c.compte || undefined}>{phrase}</span> : null}
        <span className="n-rp-colis-meta">
          {neuf ? <span className="n-rp-etiquette" data-n-ton="accent" data-rp-nouveau="">{tr('v2.passe.nouveau')}</span> : null}
          {x.num ? <span className="n-rp-num" data-rp-num={x.num}>N° {x.num}</span> : null}
          {relie && c.nb ? <span className="n-rp-etiquette" data-n-ton="neutre">{tr('retraits.c.lot', { n: c.nb })}</span> : null}
          {autre && SITES[c.site] ? <span className="n-rp-etiquette" data-n-ton="neutre" data-rp-site={c.site}>{SITES[c.site]}</span> : null}
          {prix ? <span className="n-rp-prix" data-rp-prix="">{prix}</span> : null}
          {details.length ? <span className="n-rp-dedans" data-rp-prix={c.prix ? '' : undefined} data-v2-contenu="relie" data-v2-contenu-tx={c.tx || undefined} data-v2-contenu-compte={c.compte || undefined}>{details.join(' · ')}</span> : null}
        </span>
      </span>
    </div>
  );
}

function LigneColis({ x, aides, Photo, Icon, nouveaux }) {
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
  const voirQr = ouvrir && qr ? () => { if (neuf) nouveaux.vu(x.cle || x.id); ouvrir(); } : null;
  const voirCode = ouvrir ? () => { if (neuf) nouveaux.vu(x.cle || x.id); ouvrir(); } : null;
  const long = code.length > 7;
  return (
    <li className={'n-rp-colis' + (neuf ? ' is-nouveau' : '')  + (mention ? ' is-verif' : '')} data-rp-colis={x.cle || x.id} data-rp-code={code} data-rp-sorte={x.sorte || ''} data-rp-verif={mention || undefined}
      data-v2-face={x.cle || x.id} data-v2-code={x.code || ''} data-v2-sorte={x.sorte || ''} data-v2-code-etat={rg.codeEtat} data-v2-qr-dispo={rg.qr ? '1' : '0'} data-v2-limite-jour={(rg.limite && rg.limite.jour) || ''} data-v2-limite-source={(rg.limite && rg.limite.source) || ''} data-v2-titre-de={rg.titreDe || ''} data-v2-transporteur={(rg.transporteur && rg.transporteur.cle) || ''}>
      {/* (20 nov., Julien : « même quand c'est à retirer, on doit voir ce qu'il y a à l'intérieur ») LE CONTENU D'ABORD, EN GRAND :
          la photo et le titre de l'achat relié PAR IDENTITÉ (x.contenu), sa taille, le prix payé, le compte, « lot » s'il l'est ;
          pas encore lu ⇒ vignette grise et la phrase qui dit quoi faire — jamais « Colis Mondial Relay » mis en avant. */}
      <Contenu x={x} c={contenu} rg={rg} photo={photo} aides={aides} Icon={Icon} prix={prix} neuf={neuf}/>
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

function CartePoint({ p, aides, Photo, Icon, Logo, nouveaux, apple }) {
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
        {comptes.map((x) => <LigneColis key={x.cle || x.id} x={x} aides={aides} Photo={Photo} Icon={Icon} nouveaux={nouveaux}/>)}
      </ul>
      {verif.length ? <>
        <p className="n-rp-verif-tete" data-rp-verif-tete={verif.length}>{tr('retraits.m.horsCompte')}</p>
        <ul className="n-rp-liste" data-rp-verif-liste="">
          {verif.map((x) => <LigneColis key={x.cle || x.id} x={x} aides={aides} Photo={Photo} Icon={Icon} nouveaux={nouveaux}/>)}
        </ul>
      </> : null}
    </article>
  );
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
  const apple = React.useMemo(() => appareilApple(), []);
  if (!avec.length) return null;
  const r = resumeRetraits(avec);
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
        {avec.map((p) => <CartePoint key={p.cle || p.numero} p={p} aides={aides} Photo={Photo} Icon={Icon} Logo={Logo} nouveaux={nouveaux} apple={apple}/>)}
      </div>
    </div>
  );
}

export default RetraitsPoints;
