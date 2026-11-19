// ════════════════════════════════════════════════════════════════════════════
//  LES CODES DE RETRAIT EN PASSES « WALLET » (17 nov., nouveau design, Achats).
//  Un point relais = UNE passe. La date limite est AU-DESSUS du QR ; le code est en grand ; le QR
//  n'est montré que s'il EXISTE (lu dans l'e-mail ou la capture — jamais fabriqué, src/retraitQr.js) ;
//  plusieurs colis au même point ⇒ on glisse de code en code dans la passe (« 1 sur 2 »).
//  Aucune règle ici : les points arrivent de `pointsARetirer` (src/relaisColis.js) sur la liste
//  `pickupUnion` (src/retraitPreuves.js), et chaque geste est celui de la carte d'avant
//  (`qrRetrait` ⇒ en grand, `retirerColis` ⇒ « J'ai retiré »).
//  (19 nov., Julien : « on ne doit pas avoir le bouton relier un achat ») Plus de « Relier l'achat » : la passe dit ce
//  qu'il y a DEDANS quand une identité le prouve (photo, titre, prix payé, compte — le sélecteur `x.contenu` de la
//  carte, src/contenuColis.js), sinon « Contenu pas encore lu » et le geste connu, sans bouton. Le minimum : le dessin
//  des passes sera refait par « VRM natif » (docs/design/NATIF.md), qui lira le même `x.contenu`.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr } from '../i18n/index.js';
import { texteContenu } from '../contenuColis.js';
import { BoutonV2, BoutonIconeV2 } from './BoutonV2.jsx';
import './design-v2.css';
import './achats-v2.css';
import { Etiquette, Ticket, RangeeFaite } from './Signature.jsx';

// Le QR lu (e-mail ou capture). Une image qui ne se charge pas ne se montre pas (jamais une image cassée au comptoir).
function QrPasse({ src }) {
  const [ko, setKo] = React.useState(false);
  // Une image qui ne vient pas garde SA place (168 × 168) : la passe ne se replie pas sous le doigt ; le code, dessous, suffit.
  if (ko) return <span className="v2-passe-qr v2-passe-qr-ko" role="img" aria-label={tr('v2.passe.qrKo')} data-v2-qr="ko">{tr('v2.passe.qrKo')}</span>;
  return <img className="v2-passe-qr" src={src} alt={tr('v2.passe.qr')} width={168} height={168} decoding="async" data-v2-qr="" onError={() => setKo(true)}/>;
}

// Une face de la passe = un TICKET (la signature) : la date limite AU-DESSUS (perforée), le QR s'il existe, le code en 44.
// « J'ai retiré » : la face se replie (220 ms, un coche — `RangeeFaite`), PUIS le geste d'hier part (`retirerColis`).
function FacePasse({ x, Icon, Photo, aides }) {
  const [fait, setFait] = React.useState(false);
  const ech = aides.echeance(x);
  const qr = aides.qrSrc(x);
  const ouvrir = aides.enGrand(x);
  const contenu = x.contenu || null;
  const contenuTxt = texteContenu(contenu, tr);
  const photo = x.photo && Photo ? Photo(x.photo) : null;
  const codesEnConflit = x.codesDesaccord?.length > 1;
  const fin = React.useCallback(() => aides.retirer(x), [aides, x]);
  return (
    <RangeeFaite fait={fait} onFin={fin} className="v2-passe-face" attrs={{ 'data-v2-face': x.cle || x.id, 'data-v2-code': x.code || '' }}>
      <Ticket
        haut={<div className="v2-passe-contenu">
          <div className="v2-passe-paire">
            <span className="v2-vignette v2-passe-photo" data-v2-photo-article={photo ? '' : undefined} aria-hidden="true">
              {photo || <Icon name="box" size={24}/>}
            </span>
            <span className="v2-passe-quoi">
              <span className="v2-passe-titre">
                {aides.titre(x)}
                {x.num ? <small><Etiquette num={x.num}/></small> : null}
              </span>
              {/* Ce qu'il y a dedans : le prix payé et le compte de l'achat relié par identité, ou « Contenu pas encore lu ». */}
              {contenuTxt ? <span className={'v2-passe-dedans' + (contenu.etat === 'pas-lu' ? ' is-pas-lu' : '')} data-v2-contenu={contenu.etat} data-v2-contenu-tx={contenu.tx || undefined} data-v2-contenu-raison={contenu.etat === 'pas-lu' ? contenu.raison : undefined} data-v2-contenu-compte={contenu.compte || undefined}>{contenuTxt}</span> : null}
            </span>
          </div>
          <div className={'v2-passe-limite' + (ech && ech.ambre ? ' is-ambre' : '')} data-v2-limite={ech ? ech.code : ''}>
            {ech ? <><i className="v2-point" aria-hidden="true" hidden={!ech.ambre}/>{ech.t}</> : <span className="v2-muet">{tr('v2.passe.limiteInconnue')}</span>}
          </div>
        </div>}
        qr={qr ? <QrPasse src={qr}/> : null}
        code={codesEnConflit ? '' : x.code || x.code2 || ''}
        codeVide={<span className="v2-passe-sans" data-v2-sans-code="">{tr(codesEnConflit ? 'v2.passe.codesEnConflit' : 'v2.passe.codeAVenir')}</span>}>
        <div className="v2-passe-gestes">
          {ouvrir && (!codesEnConflit || qr) ? <BoutonV2 role="secondaire" icone={<Icon name={qr ? "qr" : "scan"} size={20}/>} onClick={ouvrir} attrs={{ 'data-v2-en-grand': '' }}>{tr(qr ? 'v2.passe.afficherQr' : 'v2.passe.afficherCode')}</BoutonV2> : null}
          <BoutonV2 role="texte" onClick={() => setFait(true)} attrs={{ 'data-v2-retire': '' }}>{tr('v2.passe.retire')}</BoutonV2>
        </div>
      </Ticket>
    </RangeeFaite>
  );
}

function Passe({ p, Icon, Photo, Plaque, aides }) {
  const colis = p.arrives || [];
  const [i, setI] = React.useState(0);
  const piste = React.useRef(null);
  const aller = (index) => {
    const el = piste.current;
    if (!el) return;
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    el.scrollTo({ left: el.clientWidth * index, behavior });
  };
  const page = Math.min(i, colis.length - 1);
  const surDefilement = () => {
    const el = piste.current; if (!el || !el.clientWidth) return;
    const k = Math.round(el.scrollLeft / el.clientWidth); if (k !== i) setI(k);
  };
  const lieu = p.nom || tr('v2.retirer.pointInconnu');
  const transp = (p.transporteurs || []).map((k) => aides.nomTransporteur(k)).filter(Boolean)[0] || '';
  return (
    <article className="v2-passe" data-v2-passe={p.inconnu ? 'inconnu' : String(p.numero || '')} data-v2-passe-n={String(colis.length)} aria-label={tr('v2.passe.aria', { lieu, n: colis.length })}>
      <header className="v2-passe-tete">
        <span className="v2-passe-transp">{transp || ' '}</span>
        <span className="v2-passe-compte">{tr('v2.passe.colis', { n: colis.length })}</span>
      </header>
      <div className="v2-passe-lieu">
        <Icon name="pin" size={18}/>
        <span><b>{lieu}</b>{p.adresseCourte || p.adresse ? <small>{p.adresseCourte || p.adresse}</small> : null}</span>
      </div>
      <div className="v2-passe-piste" ref={piste} onScroll={surDefilement} data-v2-piste="">
        {colis.map((x) => <FacePasse key={x.cle || x.id} x={x} Icon={Icon} Photo={Photo} aides={aides}/>)}
      </div>
      {colis.length > 1 ? <div className="v2-passe-pages" data-v2-page={String(page + 1)}>
        <BoutonIconeV2 label={tr('v2.passe.precedent')} onClick={() => aller(page - 1)} attrs={{ disabled: page === 0 }} icone={<Icon name="chevron" size={16} style={{ transform: 'rotate(180deg)' }}/>}/>
        <span aria-live="polite">{tr('v2.passe.page', { i: page + 1, n: colis.length })}</span>
        <BoutonIconeV2 label={tr('v2.passe.suivant')} onClick={() => aller(page + 1)} attrs={{ disabled: page === colis.length - 1 }} icone={<Icon name="chevron" size={16}/>}/>
      </div> : null}
    </article>
  );
}

// Une passe ne porte QUE les colis COMPTÉS « à retirer » (la règle `pickupUnion`) : un colis « à vérifier » ou hors du
// compte n'est pas un code à présenter au comptoir — il reste dans « Tout le détail des retraits », avec sa raison.
const aPresenter = (x) => x && !x.aVerifier && !x.horsCompte && !x.redirige;
export function PassesRetrait({ points = [], Icon, Photo, Plaque, aides }) {
  const avecColis = points.map((p) => ({ ...p, arrives: (p.arrives || []).filter(aPresenter) })).filter((p) => p.arrives.length > 0);
  if (!avecColis.length) return null;
  return (
    <div className="v2-passes" data-v2-bloc="passes" data-v2-passes={String(avecColis.length)}>
      {avecColis.map((p, k) => <Passe key={(p.numero || 'x') + ':' + k} p={p} Icon={Icon} Photo={Photo} Plaque={Plaque} aides={aides}/>)}
    </div>
  );
}

// LES ACHATS EN ROUTE, en lignes iOS : vignette 56, titre sur UNE ligne, « N° · compte » dessous,
// à droite le point relais (ou « point pas encore dit ») et l'arrivée estimée. La rangée entière se touche.
export function EnRouteListe({ lignes = [], Icon, Photo, onOuvrir = null, max = 40, touteSansPoint = false }) {
  if (!lignes.length) return null;
  return (
    <section className="v2-groupe" data-v2-bloc="enroute" data-v2-en-route={String(lignes.length)} aria-label={tr('v2.enRoute.titre')}>
      <h2 className="v2-groupe-titre"><span>{tr('v2.enRoute.titre')}</span><span className="v2-groupe-n">{lignes.length}{touteSansPoint ? ' · ' + tr('v2.enRoute.pointPasDit') : ''}</span></h2>
      <div className="v2-liste">
        {lignes.slice(0, max).map((l, k) => {
          const Corps = onOuvrir ? 'button' : 'div';
          return (
          <Corps key={l.id} {...(onOuvrir ? { type: 'button', 'data-v2-rangee': '', onClick: () => onOuvrir(l) } : {})} className={(onOuvrir ? 'v2-rangee ' : '') + 'v2-ligne'} data-v2-achat={l.id}>
            <span className="v2-vignette" style={{ width: 56, height: 56 }} aria-hidden="true">
              {l.photo && Photo ? Photo(l.photo, k >= 12) : <Icon name="cintre" size={22}/>}
            </span>
            <span className="v2-ligne-txt">
              <span className="v2-ligne-titre">{l.titre || tr('v2.enRoute.sansTitre')}</span>
              <span className="v2-ligne-meta">{[l.num ? 'N° ' + l.num : '', l.compte, l.point].filter(Boolean).join(' · ') || '\u00a0'}</span>
            </span>
            {l.prix ? <span className="v2-ligne-droite"><span className="v2-ligne-valeur">{l.prix}</span></span> : null}
            {onOuvrir ? <span className="v2-chevron" aria-hidden="true"><Icon name="chevron" size={16}/></span> : null}
          </Corps>); })}
      </div>
      {lignes.length > max ? <p className="v2-liste-reste" data-v2-reste={String(lignes.length - max)}>{tr('v2.enRoute.autres', { n: lignes.length - max })}</p> : null}
    </section>
  );
}
