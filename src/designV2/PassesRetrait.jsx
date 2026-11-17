// ════════════════════════════════════════════════════════════════════════════
//  LES CODES DE RETRAIT EN PASSES « WALLET » (17 nov., nouveau design, Achats).
//  Un point relais = UNE passe. La date limite est AU-DESSUS du QR ; le code est en grand ; le QR
//  n'est montré que s'il EXISTE (lu dans l'e-mail ou la capture — jamais fabriqué, src/retraitQr.js) ;
//  plusieurs colis au même point ⇒ on glisse de code en code dans la passe (« 1 sur 2 »).
//  Aucune règle ici : les points arrivent de `pointsARetirer` (src/relaisColis.js) sur la liste
//  `pickupUnion` (src/retraitPreuves.js), et chaque geste est celui de la carte d'avant
//  (`qrRetrait` ⇒ en grand, `retirerColis` ⇒ « J'ai retiré », `relierRetrait`).
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr } from '../i18n/index.js';
import { BoutonV2 } from './BoutonV2.jsx';
import './design-v2.css';

function Passe({ p, Icon, Photo, Plaque, aides }) {
  const colis = p.arrives || [];
  const [i, setI] = React.useState(0);
  const piste = React.useRef(null);
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
        {colis.map((x) => {
          const ech = aides.echeance(x);
          const qr = aides.qrSrc(x);
          const ouvrir = aides.enGrand(x);
          const relier = aides.relier(x);
          return (
            <div key={x.cle || x.id} className="v2-passe-face" data-v2-face={x.cle || x.id} data-v2-code={x.code || ''}>
              {/* La date limite AU-DESSUS du QR ; inconnue ⇒ rien d'inventé. */}
              <div className={'v2-passe-limite' + (ech && ech.ambre ? ' is-ambre' : '')} data-v2-limite={ech ? ech.code : ''}>
                {ech ? <><i className="v2-point" aria-hidden="true" hidden={!ech.ambre}/>{ech.t}</> : <span className="v2-muet">{tr('v2.passe.limiteInconnue')}</span>}
              </div>
              {qr ? <img className="v2-passe-qr" src={qr} alt={tr('v2.passe.qr')} width={168} height={168} decoding="async" data-v2-qr=""/> : null}
              {x.code ? <b className="v2-passe-code" data-v2-code-grand="">{x.code}</b> : x.code2 ? <b className="v2-passe-code">{x.code2}</b> : <span className="v2-passe-sans" data-v2-sans-code="">{tr('v2.passe.codeAVenir')}</span>}
              <div className="v2-passe-paire">
                <span className="v2-vignette" style={{ width: 40, height: 40 }} aria-hidden="true">{x.photo && Photo ? Photo(x.photo) : <Icon name="cintre" size={18}/>}</span>
                <span className="v2-passe-titre">{aides.titre(x)}</span>
                {x.num ? <Plaque num={x.num}/> : null}
              </div>
              <div className="v2-passe-gestes">
                {ouvrir ? <BoutonV2 role="secondaire" icone={<Icon name="qr" size={20}/>} onClick={() => ouvrir()} attrs={{ 'data-v2-en-grand': '' }}>{tr('v2.passe.enGrand')}</BoutonV2> : null}
                {relier ? <BoutonV2 role="texte" onClick={relier} attrs={{ 'data-v2-relier': '' }}>{tr('v2.passe.relier')}</BoutonV2> : null}
                <BoutonV2 role="texte" onClick={() => aides.retirer(x)} attrs={{ 'data-v2-retire': '' }}>{tr('v2.passe.retire')}</BoutonV2>
              </div>
            </div>
          );
        })}
      </div>
      {colis.length > 1 ? <div className="v2-passe-pages" data-v2-page={String(i + 1)} aria-live="polite">{tr('v2.passe.page', { i: i + 1, n: colis.length })}</div> : null}
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
    <div className="v2-passes" data-v2-passes={String(avecColis.length)}>
      {avecColis.map((p, k) => <Passe key={(p.numero || 'x') + ':' + k} p={p} Icon={Icon} Photo={Photo} Plaque={Plaque} aides={aides}/>)}
    </div>
  );
}

// LES ACHATS EN ROUTE, en lignes iOS : vignette 56, titre sur UNE ligne, « N° · compte » dessous,
// à droite le point relais (ou « point pas encore dit ») et l'arrivée estimée. La rangée entière se touche.
export function EnRouteListe({ lignes = [], Icon, Photo, onOuvrir = null, max = 40 }) {
  if (!lignes.length) return null;
  return (
    <section className="v2-groupe" data-v2-en-route={String(lignes.length)} aria-label={tr('v2.enRoute.titre')}>
      <h2 className="v2-groupe-titre"><span>{tr('v2.enRoute.titre')}</span><span className="v2-groupe-n">{lignes.length}</span></h2>
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
              <span className="v2-ligne-meta">{[l.num ? 'N° ' + l.num : '', l.compte].filter(Boolean).join(' · ') || ' '}</span>
            </span>
            <span className="v2-ligne-droite">
              <span className="v2-ligne-valeur">{l.prix || ''}</span>
              <span className="v2-ligne-meta">{l.point || tr('v2.enRoute.pointPasDit')}</span>
            </span>
            {onOuvrir ? <span className="v2-chevron" aria-hidden="true"><Icon name="chevron" size={16}/></span> : null}
          </Corps>); })}
      </div>
      {lignes.length > max ? <p className="v2-liste-reste" data-v2-reste={String(lignes.length - max)}>{tr('v2.enRoute.autres', { n: lignes.length - max })}</p> : null}
    </section>
  );
}
