// ════════════════════════════════════════════════════════════════════════════
//  AUJOURD'HUI — le nouveau design (17 nov.), à la place de Ma journée quand l'essai est allumé.
//  Composition (planche J2, groupes de N) :
//    1. le CHIFFRE DE L'ÉCRAN en affiche : les colis à envoyer (« — » tant que ce n'est pas lu) et, sur
//       la même ligne, son mot ; dessous, l'écart NOMMÉ (« 5 prêts · 1 sans bordereau ») ;
//    2. la BANDE des paires à envoyer (photo, plaque N°, prix, date limite ambre si elle presse) ;
//    3. « À retirer » : la passe du premier point relais (code en grand), et « N colis à N points » ;
//    4. « À faire » : un groupe par chose, son nombre et UN geste ;
//    5. le geste plein au pouce : « Imprimer N bordereaux » (son nombre est celui des bordereaux prêts) ;
//    6. tout fait ⇒ « Rien à faire », calme.
//  AUCUNE règle ici : tout arrive calculé par Ma journée (src/App.jsx, `Comptabilite only="journee"`) —
//  `toShip`, `aExpedier`, `pickupUnion` (src/retraitPreuves.js), le N° par identité, les mêmes gestes.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr } from '../i18n/index.js';
import { BoutonV2, BoutonIconeV2, RangeeTouchable } from './BoutonV2.jsx';
import './design-v2.css';
import { ChiffreAffiche, Etiquette } from './Signature.jsx';

function Vignette({ photo, Photo, Icon, taille = 56 }) {
  return (
    <span className="v2-vignette" style={{ width: taille, height: taille }} aria-hidden="true">
      {photo && Photo ? <Photo src={photo} alt="" loading="lazy" decoding="async" width={taille} height={taille}/> : <Icon name="cintre" size={22}/>}
    </span>
  );
}

function RienAFaire({ Icon }) {
  return (
    <section className="v2-rien" data-v2-rien="" aria-label={tr('v2.rien.titre')}>
      <svg className="v2-rien-dessin" width="120" height="96" viewBox="0 0 120 96" fill="none" aria-hidden="true">
        <path d="M18 38 L60 22 L102 38 L60 54 Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
        <path d="M18 38 V70 L60 86 V54 M102 38 V70 L60 86" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
        <path d="M39 30 L81 46" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity=".5"/>
      </svg>
      <h2 className="v2-rien-titre">{tr('v2.rien.titre')}</h2>
      <p className="v2-rien-sous">{tr('v2.rien.sous')}</p>
    </section>
  );
}

// `pret` : les lectures dont dépend l'écran sont arrivées (à envoyer ET à retirer). Avant : le titre et le chiffre en
// attente, RIEN d'autre — puis tout arrive d'un coup, sous le chiffre, à sa place (17 nov., Julien : « quand ça charge
// tout bouge bizarrement » : aucun bloc qui apparaît puis s'en va, aucun ordre qui change, chaque boîte à sa taille).
export default function Aujourdhui({ affiche, colis = [], retraits = null, groupes = [], plein = null, Photo, Plaque, Icon, onColis, onRetraits, onScanner = null, titre, pret: pretLu = true }) {
  // Prêt une fois, prêt pour de bon (une relecture ne remet pas l'écran en attente) ; une lecture qui ne répond pas
  // n'enferme pas l'écran : au bout de 10 s, il se montre tel qu'il est (« — » là où ce n'est pas su).
  const dejaPret = React.useRef(false);
  const [delai, setDelai] = React.useState(false);
  React.useEffect(() => { if (pretLu) return undefined; const t = setTimeout(() => setDelai(true), 10000); return () => clearTimeout(t); }, [pretLu]);
  if (pretLu || delai) dejaPret.current = true;
  const pret = dejaPret.current;
  // La HAUTEUR RÉELLE du plein au pouce (une ou deux lignes en très grand texte) : la page garde barre + plein + 16 dessous
  // (`--v2-pouce-h`, design-v2.css), aucune carte ne reste cachée sous lui.
  const poucer = React.useCallback((el) => {
    if (!el || typeof ResizeObserver === 'undefined') return;
    const poser = () => { try { document.documentElement.style.setProperty('--v2-pouce-h', Math.round(el.getBoundingClientRect().height) + 'px'); } catch (_) {} };
    poser(); try { new ResizeObserver(poser).observe(el); } catch (_) {}
  }, []);
  // L'ORDRE DES GROUPES est celui de leur première apparition : un groupe lu plus tard se range à la fin, jamais
  // au-dessus des autres (rien ne glisse sous le doigt pendant la lecture).
  const ordre = React.useRef([]);
  for (const g of groupes) if (!ordre.current.includes(g.id)) ordre.current.push(g.id);
  groupes = [...groupes].sort((a, b) => ordre.current.indexOf(a.id) - ordre.current.indexOf(b.id));
  const n = affiche && !affiche.pasSu ? affiche.n : null;
  const nRet = retraits && !retraits.pasSu ? retraits.n : null;
  const rien = pret && n === 0 && nRet === 0 && groupes.length === 0;
  const premierPoint = retraits && Array.isArray(retraits.points) ? retraits.points[0] : null;
  // LES BLOCS SOUS LE CHIFFRE, dans l'ORDRE DE LEUR ARRIVÉE : l'ordre voulu (bande, à retirer, à faire) quand tout est lu
  // ensemble ; un bloc lu plus tard se pose à la fin, jamais au-dessus d'un autre (rien ne pousse ce que l'œil lit).
  const ordreBlocs = React.useRef([]);
  const BLOCS = {
    bande: () => (n > 0 ? (
          <div className="v2-bande" role="list" aria-label={tr('v2.bande.aria')} data-v2-bande={String(colis.length)} data-v2-bloc="bande">
            {colis.slice(0, 12).map((c) => (
              <RangeeTouchable key={c.cle} className="v2-bande-carte" onClick={() => onColis && onColis(c)} label={[c.num ? 'N° ' + c.num : '', c.titre, c.prix, c.e && c.e.txt].filter(Boolean).join(' · ')}
                attrs={{ role: 'listitem', 'data-v2-colis': c.cle }}>
                <span className="v2-bande-photo">{c.photo && Photo ? <Photo src={c.photo} alt="" loading="lazy" decoding="async" width={104} height={104}/> : <Icon name="cintre" size={26}/>}
                  {c.num ? <span className="v2-bande-plaque"><Etiquette num={c.num} taille="moyen"/></span> : null}</span>
                <span className="v2-bande-prix">{c.prix || ' '}</span>
                <span className={'v2-bande-quand' + (c.e && c.e.ambre ? ' is-ambre' : '')}>{c.e && c.e.ambre ? <i className="v2-point" aria-hidden="true"/> : null}{(c.e && c.e.txt) || ' '}</span>
              </RangeeTouchable>
            ))}
            {/* Les colis comptés mais pas encore décrits : la même carte, vide, à la même taille (jamais un saut). */}
            {Array.from({ length: Math.max(0, Math.min(n, 12) - Math.min(colis.length, 12)) }, (_, k) => (
              <span key={'a' + k} className="v2-bande-carte v2-bande-attente" aria-hidden="true"><span className="v2-bande-photo"/><span className="v2-bande-prix">{'\u00a0'}</span><span className="v2-bande-quand">{'\u00a0'}</span></span>
            ))}
          </div>
        ) : null),
    retirer: () => (nRet ? (
          <section className="v2-groupe" data-v2-groupe="retirer" data-v2-bloc="retirer" aria-label={tr('v2.retirer.titre')}>
            <h2 className="v2-groupe-titre"><span>{tr('v2.retirer.titre')}</span><span className="v2-groupe-n" data-v2-n={String(nRet)}>{nRet}</span></h2>
            <RangeeTouchable className="v2-passe-mini" onClick={onRetraits} label={tr('v2.retirer.voir')} attrs={{ 'data-v2-passe-mini': '' }}>
              <span className="v2-passe-mini-haut">
                <Icon name="pin" size={18}/>
                <span className="v2-passe-mini-lieu">{premierPoint ? (premierPoint.lieu || tr('v2.retirer.pointInconnu')) : tr('v2.retirer.codesAVenir')}</span>
                {premierPoint && premierPoint.code ? <b className="v2-passe-mini-code">{premierPoint.code}</b> : null}
              </span>
              <span className="v2-passe-mini-bas">
                <span>{premierPoint ? tr('v2.retirer.resume', { n: nRet, p: retraits.nPoints || 1 }) : tr('v2.retirer.resumeN', { n: nRet })}</span>
                {retraits.premier ? <span className={retraits.premier.ambre ? 'is-ambre' : ''}>{retraits.premier.ambre ? <i className="v2-point" aria-hidden="true"/> : null}{retraits.premier.txt}</span> : null}
              </span>
            </RangeeTouchable>
          </section>
        ) : null),
    afaire: () => (groupes.length ? (
          <section className="v2-afaire" aria-label={tr('v2.afaire.titre')} data-v2-afaire={String(groupes.length)} data-v2-bloc="afaire">
            <h2 className="v2-groupe-titre"><span>{tr('v2.afaire.titre')}</span></h2>
            <div className="v2-liste">
              {groupes.map((g) => (
                <div key={g.id} className="v2-afaire-ligne" data-v2-job={g.id} data-n={g.n == null ? '' : String(g.n)}>
                  {g.photo ? <Vignette photo={g.photo} Photo={Photo} Icon={Icon} taille={40}/> : <span className="v2-afaire-ic" aria-hidden="true"><Icon name={g.icone || 'check'} size={20}/></span>}
                  <span className="v2-afaire-txt">
                    <span className="v2-afaire-titre">{g.ambre ? <i className="v2-point" aria-hidden="true"/> : null}{g.titre}</span>
                    {g.detail ? <span className="v2-afaire-detail">{g.detail}</span> : null}
                  </span>
                  {g.geste ? <BoutonV2 role="secondaire" onClick={g.geste.faire} attrs={{ 'data-v2-geste': g.id }}>{g.geste.txt}</BoutonV2> : null}
                </div>
              ))}
            </div>
          </section>
        ) : null),
  };
  const presents = { bande: n > 0, retirer: !!nRet, afaire: groupes.length > 0 };
  if (pret && !rien) for (const k of ['bande', 'retirer', 'afaire']) if (presents[k] && !ordreBlocs.current.includes(k)) ordreBlocs.current.push(k);
  const blocs = ordreBlocs.current.filter((k) => presents[k]).map((k) => <React.Fragment key={k}>{BLOCS[k]()}</React.Fragment>);
  return (
    <div className="v2-ecran v2-aujourdhui" data-v2-ecran="aujourdhui" data-espace="journee" data-v2-plein={plein ? '1' : '0'}>
      <header className="v2-tete v2-titre-ligne">
        <h1 className="v2-titre">{titre}</h1>
        {/* Le « Scanner » du disque d'hier : un code-barres de colis ⇒ SA vente ou SON achat (le même scanner). */}
        {onScanner ? <BoutonIconeV2 icone={<Icon name="scan" size={24}/>} label={tr('v2.scanner')} onClick={onScanner} attrs={{ 'data-v2-scanner': '' }}/> : null}
      </header>

      {rien ? <div data-v2-bloc="rien"><RienAFaire Icon={Icon}/></div> : !pret ? (
        <ChiffreAffiche attente n={null} mot={tr('v2.aEnvoyer.mot', { n: 2 })} attrs={{ 'data-v2-bloc': 'affiche', 'aria-label': tr('v2.chargement') }}/>
      ) : (<>
        {/* 1. LE CHIFFRE DE L'ÉCRAN (la signature : 56/700, son mot sur la même ligne de base, l'écart nommé dessous). */}
        <ChiffreAffiche n={n} mot={tr('v2.aEnvoyer.mot', { n: n == null ? 2 : n })} sous={affiche && affiche.sous} ambre={!!(affiche && affiche.ambre)}
          attrs={{ 'data-v2-bloc': 'affiche', 'aria-label': tr('v2.aEnvoyer.aria', { n: n == null ? '—' : String(n) }) }}/>

        {blocs}
      </>)}

      {/* 5. LE GESTE PLEIN, au pouce (en haut à droite sur l'ordinateur, design-v2.css). */}
      {plein ? (
        <div className="v2-pouce" data-v2-pouce="" ref={poucer}>
          <BoutonV2 role="principal" plein n={plein.n} icone={<Icon name="printer" size={22}/>} onClick={plein.faire} attrs={{ 'data-v2-principal': String(plein.n) }}>{plein.txt}</BoutonV2>
        </div>
      ) : null}
    </div>
  );
}
