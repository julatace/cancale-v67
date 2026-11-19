// ════════════════════════════════════════════════════════════════════════════
//  LES CODES DE RETRAIT EN PASSES « WALLET » (17 nov., nouveau design, Achats).
//  Un point relais = UNE passe. La date limite est AU-DESSUS du QR ; le code est en grand ; le QR
//  n'est montré que s'il EXISTE (lu dans l'e-mail ou la capture — jamais fabriqué, src/retraitQr.js) ;
//  plusieurs colis au même point ⇒ une LIGNE par colis, tous les codes visibles (19 nov.).
//  Aucune règle ici : les points arrivent de `pointsARetirer` (src/relaisColis.js) sur la liste
//  `pickupUnion` (src/retraitPreuves.js), et chaque geste est celui de la carte d'avant
//  (`qrRetrait` ⇒ en grand, `retirerColis` ⇒ « J'ai retiré », `relierRetrait`).
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr } from '../i18n/index.js';
import './design-v2.css';
import './achats-v2.css';
import { Etiquette, RangeeFaite } from './Signature.jsx';
import './retraits-liste.css';
import { CLE_RETRAITS_VUS, estNouveau, marquerVu } from '../retraitsNouveaux.js';

// (19 nov., retraits parfaits) « NOUVEAU » sur la ligne d'un colis qui vient d'arriver (src/retraitsNouveaux.js : par
// identité, par appareil) jusqu'à ce qu'il l'ouvre. L'écran relit l'état à chaque annonce (`vrm:retraits-nouveaux`).
const lireNouveaux = () => { try { return JSON.parse(localStorage.getItem(CLE_RETRAITS_VUS) || 'null'); } catch (_) { return null; } };
function useNouveaux() {
  const [etat, setEtat] = React.useState(lireNouveaux);
  React.useEffect(() => { const f = () => setEtat(lireNouveaux()); window.addEventListener('vrm:retraits-nouveaux', f); return () => window.removeEventListener('vrm:retraits-nouveaux', f); }, []);
  const vu = React.useCallback((cle) => { const e = marquerVu(lireNouveaux(), cle); if (!e) return; try { localStorage.setItem(CLE_RETRAITS_VUS, JSON.stringify(e)); } catch (_) {} setEtat(e); }, []);
  return { etat, vu };
}

// 19 nov. (Julien : « il y a 4 colis, j'ai un seul code ») : plus de carrousel « 1 sur 4 » qui cachait 3 codes sur 4.
// Une passe = un point ; DEDANS, une ligne par colis avec SON code en grand, tous visibles d'un coup.
// Toucher la ligne ⇒ le code (et le QR s'il existe) en plein écran pour le comptoir. Pas de « Relier » ici :
// un colis se relie seul à son achat (n° de suivi, code), jamais par un bouton.
function LigneRetrait({ x, Icon, Photo, aides, nouveaux }) {
  const [fait, setFait] = React.useState(false);
  const neuf = !!(nouveaux && estNouveau(nouveaux.etat, x.cle || x.id));
  const ech = aides.echeance(x);
  const qr = aides.qrSrc(x);
  const ouvrir = aides.enGrand(x);
  const photo = x.photo && Photo ? Photo(x.photo) : null;
  const codesEnConflit = x.codesDesaccord?.length > 1;
  const code = codesEnConflit ? '' : (x.code || x.code2 || '');
  const fin = React.useCallback(() => aides.retirer(x), [aides, x]);
  const ouvrirVu = ouvrir ? () => { if (neuf && nouveaux) nouveaux.vu(x.cle || x.id); ouvrir(); } : null;
  const corps = (
    <>
      <span className="v2r-photo" aria-hidden="true">{photo || <Icon name="box" size={22}/>}</span>
      <span className="v2r-texte">
        <span className="v2r-titre">{aides.titre(x)}{x.num ? <> <Etiquette num={x.num}/></> : null}</span>
        <span className={'v2r-limite v2-passe-limite' + (ech && ech.ambre ? ' is-ambre' : '')} data-v2-limite={ech ? ech.code : ''}>
          {neuf ? <span className="v2r-nouveau" data-v2-nouveau="">{tr('v2.passe.nouveau')}</span> : null}{ech ? ech.t : tr('v2.passe.limiteInconnue')}{qr ? ' · QR' : ''}
        </span>
      </span>
      {code
        ? <b className="v2r-code" data-v2-code-grand="">{code}</b>
        : <span className="v2r-sans v2-passe-sans" data-v2-sans-code="">{tr(codesEnConflit ? 'v2.passe.codesEnConflit' : 'v2.passe.codeAVenir')}</span>}
    </>
  );
  return (
    <RangeeFaite fait={fait} onFin={fin} className={'v2r-ligne' + (neuf ? ' is-nouveau' : '')} attrs={{ 'data-v2-face': x.cle || x.id, 'data-v2-code': x.code || '', 'data-v2-sorte': x.sorte || '' }}>
      {ouvrir && (!codesEnConflit || qr)
        ? <button type="button" className="v2r-haut" onClick={ouvrirVu} data-v2-en-grand="" aria-label={tr(qr ? 'v2.passe.afficherQr' : 'v2.passe.afficherCode') + ' · ' + aides.titre(x)}>{corps}</button>
        : <div className="v2r-haut">{corps}</div>}
      <div className="v2r-gestes">
        <button type="button" className="v2r-retire" onClick={() => setFait(true)} data-v2-retire="">{tr('v2.passe.retire')}</button>
      </div>
    </RangeeFaite>
  );
}

function Passe({ p, Icon, Photo, Plaque, aides, nouveaux }) {
  const colis = p.arrives || [];
  const lieu = p.nom || tr('v2.retirer.pointInconnu');
  const transp = (p.transporteurs || []).map((k) => aides.nomTransporteur(k)).filter(Boolean)[0] || '';
  return (
    <article className="v2-passe" data-v2-passe={p.inconnu ? 'inconnu' : String(p.numero || '')} data-v2-passe-n={String(colis.length)} aria-label={tr('v2.passe.aria', { lieu, n: colis.length })}>
      <header className="v2-passe-tete">
        <span className="v2-passe-transp">{transp || ' '}</span>
        <span className="v2-passe-compte">{tr('v2.passe.colis', { n: colis.length })}</span>
      </header>
      <div className="v2-passe-lieu">
        <Icon name="pin" size={18}/>
        {/* (19 nov., retraits parfaits) Consigne (on TAPE le code sur l'écran du casier) ou comptoir (on le DONNE) : dit
            une fois par point, sous l'adresse — un casier et le comptoir du même magasin sont deux passes (src/retraitSorte.js). */}
        <span><b>{lieu}</b>{p.adresseCourte || p.adresse ? <small>{p.adresseCourte || p.adresse}</small> : null}
          <small className="v2-passe-sorte" data-v2-sorte={p.consigne ? 'consigne' : 'comptoir'}>{tr(p.consigne ? 'v2.passe.consigne' : 'v2.passe.comptoir')}</small></span>
      </div>
      <div className="v2r-liste" data-v2-retraits={String(colis.length)}>
        {colis.map((x) => <LigneRetrait key={x.cle || x.id} x={x} Icon={Icon} Photo={Photo} aides={aides} nouveaux={nouveaux}/>)}
      </div>
    </article>
  );
}

// Une passe ne porte QUE les colis COMPTÉS « à retirer » (la règle `pickupUnion`) : un colis « à vérifier » ou hors du
// compte n'est pas un code à présenter au comptoir — il reste dans « Tout le détail des retraits », avec sa raison.
const aPresenter = (x) => x && !x.aVerifier && !x.horsCompte && !x.redirige;
export function PassesRetrait({ points = [], Icon, Photo, Plaque, aides }) {
  const avecColis = points.map((p) => ({ ...p, arrives: (p.arrives || []).filter(aPresenter) })).filter((p) => p.arrives.length > 0);
  const nouveaux = useNouveaux();
  if (!avecColis.length) return null;
  return (
    <div className="v2-passes" data-v2-bloc="passes" data-v2-passes={String(avecColis.length)}>
      {avecColis.map((p, k) => <Passe key={(p.numero || 'x') + ':' + k} p={p} Icon={Icon} Photo={Photo} Plaque={Plaque} aides={aides} nouveaux={nouveaux}/>)}
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
