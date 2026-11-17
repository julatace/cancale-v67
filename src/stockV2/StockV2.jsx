// ════════════════════════════════════════════════════════════════════════════
//  LE STOCK DU NOUVEAU DESIGN (17 nov., lot stock-rangement) — seulement allumé (`vrm_design_v2`).
//  Julien : « l'onglet stock… pour ranger c'est un peu la galère, il faudrait que ce soit beaucoup plus
//  naturel et simple d'utilisation ». Récit et mesures : docs/passation/2026-11-17-stock-rangement.md.
//
//  CE QUI CHANGE (la forme, le chemin) :
//    · « Ranger » est une SÉANCE : les articles à ranger arrivent un par un (photo, N°), la case proposée
//      est dite en grand avec son petit plan ; « Ranger ici » (un toucher) et le suivant arrive. La case
//      proposée suit la DERNIÈRE place utilisée (le même meuble), jamais imposée : « Autre place » à côté.
//    · « Où est… » : un N° tapé ou dit montre tout de suite SA place, en grand, sur le plan du meuble.
//    · « Mes places » : un meuble par rangée ; la toucher ouvre le meuble (ses cases, les photos, les N°).
//    · « Déplacer » : la même séance, sur une seule paire, avec le choix de la case ouvert.
//  CE QUI NE CHANGE PAS (les règles, toutes chez l'appelant, src/ecrans/Stock.jsx) : la pose (`poser`, qui
//  DEMANDE si la case est prise, la gravité des piles), les cases proposées (`casesProposees`, `caseLibreDans`,
//  src/ouRanger.js), la recherche par IDENTITÉ de N° (`resultats`), la case allumée d'une vendue et sa sortie,
//  la sortie automatique à l'expédition prouvée. Aucun N° n'est écrit, changé ni deviné ici : ce composant ne
//  connaît que des clés `cleNum` et appelle les gestes de l'écran.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr, nombre } from '../i18n/index.js';
import { requeteDeLaVoix } from '../rechercheVocale.js';
import { BoutonV2, BoutonIconeV2 } from '../designV2/BoutonV2.jsx';
import MenuPlateforme from '../designV2/MenuPlateforme.jsx';
import LigneGlissable from '../LigneGlissable.jsx';
import './stock-v2.css';

// Le petit plan d'un meuble : les cases en grille, la case visée pleine. Lecture seule (aucun toucher) ;
// au-delà de 240 cases, il n'est pas dessiné (la phrase « rangée, colonne » suffit).
function PetitPlan({ m, viseI, occupee }) {
  if (!m) return null;
  const cols = Math.max(1, Number(m.cols) || 1), rows = Math.max(1, Number(m.rows) || 1);
  if (cols * rows > 240) return null;
  const cote = Math.max(8, Math.min(22, Math.floor(220 / Math.max(cols, rows * 0.9))));
  return (
    <div className="sr-plan" aria-hidden="true" data-sr-plan={String(m.id)} style={{ gridTemplateColumns: `repeat(${cols}, ${cote}px)`, gridAutoRows: `${Math.round(cote * 0.72)}px` }}>
      {Array.from({ length: cols * rows }).map((_, i) => (
        <i key={i} className={'sr-plan-case' + (i === viseI ? ' is-vise' : (occupee(m.id, i) ? ' is-prise' : ''))} data-sr-plan-vise={i === viseI ? '' : undefined}/>
      ))}
    </div>
  );
}

// Les lettres de l'étiquette d'un meuble (« Étagère entrée » → « ÉE ») : comme celles écrites au feutre sur un carton.
const initiales = (nom) => String(nom || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '·';

function Plaque({ n, grand = false }) {
  return <span className={'sr-plaque' + (grand ? ' is-grand' : '')} data-sr-plaque={String(n)}>N°{n}</span>;
}

// Une photo de paire (fixe, recadrée) ; sans photo, une boîte au trait sur fond uni (jamais une photo inventée).
function Photo({ f, Photo: P, Icon, taille }) {
  return (
    <span className="sr-photo" style={{ width: taille, height: taille }}>
      {f && f.photo ? <P src={f.photo} loading="lazy" decoding="async" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}/> : <Icon name="box" size={Math.round(taille / 3)}/>}
    </span>
  );
}

// ── LA SÉANCE « RANGER » (et « Déplacer », la même sur une paire) ─────────────
function Seance({ s, seance, fermer }) {
  const { Icon, Feuille, mots } = s;
  const [faits, setFaits] = React.useState([]);          // clés rangées pendant la séance (dans l'ordre)
  const [passes, setPasses] = React.useState([]);        // clés passées (« Plus tard »)
  const [derniere, setDerniere] = React.useState(null);  // le meuble de la dernière pose (la place proposée suit)
  const [autre, setAutre] = React.useState(!!seance.deplacer);   // le choix d'une autre case, ouvert ou non
  const [meubleChoisi, setMeubleChoisi] = React.useState(null);
  const [enCours, setEnCours] = React.useState(false);
  const [sortie, setSortie] = React.useState(false);     // le mouvement « fait » (220 ms) avant que la suivante arrive
  const file = seance.cles;
  const cle = file.find((k) => !faits.includes(k) && !passes.includes(k)) || null;
  const f = cle ? s.ficheDe(cle) : null;
  const ou = f ? s.ouEst(f) : null;
  const total = file.length;
  // La case proposée : la première libre du meuble de la dernière pose, sinon la case proposée à cet article.
  const prop = cle && !seance.deplacer ? s.caseProposee(cle, derniere) : null;
  const mProp = prop ? s.meubles.find((m) => String(m.id) === String(prop.meubleId)) : null;
  const mAutre = s.meubles.find((m) => String(m.id) === String(meubleChoisi || (ou && ou.meuble.id) || (prop && prop.meubleId) || (s.meubles[0] && s.meubles[0].id))) || null;
  React.useEffect(() => { setMeubleChoisi(null); setAutre(!!seance.deplacer || !prop); /* eslint-disable-next-line */ }, [cle]);
  // Fin de séance : « Tout est rangé » se dit, puis la feuille se referme seule (aucun toucher de plus).
  React.useEffect(() => { if (cle) return undefined; const t = setTimeout(fermer, 1400); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [cle]);
  const poser = async (mid, i) => {
    if (!cle || enCours) return;
    setEnCours(true);
    let ok = false;
    try { ok = await s.poser(cle, mid, i, { muet: true }); } finally { setEnCours(false); }
    if (ok === false) return;
    // LE MOUVEMENT (la signature) : la paire rangée glisse et se replie avec sa coche, le compteur descend d'un cran.
    let reduit = false; try { reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) {}
    setSortie(true);
    await new Promise((r) => setTimeout(r, reduit ? 0 : 220));
    setSortie(false); setFaits((x) => [...x, cle]); setDerniere(String(mid)); setAutre(false);
  };
  const reste = Math.max(0, total - faits.length);
  // La dernière pose, DITE avec la case finale (relue : dans une pile, l'article a pu descendre).
  const kFait = faits[faits.length - 1] || null; const fFait = kFait ? s.ficheDe(kFait) : null; const ouFait = fFait ? s.ouEst(fFait) : null;
  const fait = ouFait ? tr('sr.fait', { num: String(fFait.numero), ou: s.placeEnMots(ouFait) }) : '';
  const titre = seance.deplacer ? tr('sr.deplacer.titre') : tr('sr.seance.titre');
  return (
    <Feuille onClose={fermer} titre={titre} sousTitre={!seance.deplacer && cle ? <span className="sr-reste" key={reste} data-sr-reste={reste}>{tr('sr.seance.reste', { n: reste, nb: nombre(reste) })}</span> : undefined} maxWidth={520} data-sr-seance={seance.deplacer ? 'deplacer' : 'ranger'} className="sr-feuille">
      {!cle ? (
        <div className="sr-fin" role="status" data-sr-fin={String(faits.length)}>
          <span className="sr-fin-ic" aria-hidden="true"><Icon name="check" size={30}/></span>
          {fait ? <p className="sr-fait is-fin" data-sr-fait={faits[faits.length - 1]}><span>{fait}</span></p> : null}
          <p className="sr-fin-titre">{seance.deplacer ? tr('sr.deplacer.fait') : tr('sr.seance.fin', { n: faits.length, mot: faits.length > 1 ? mots.noms : mots.nom })}</p>
        </div>
      ) : (
        <div className={'sr-seance' + (sortie ? ' is-sortie' : '')} data-sr-courant={cle} key={cle}>
          {fait ? <p className="sr-fait" role="status" data-sr-fait={faits[faits.length - 1]}><Icon name="check" size={16}/><span>{fait}</span></p> : null}
          <div className="sr-paire">
            <span className="sr-paire-photo"><Photo f={f} Photo={s.Photo} Icon={Icon} taille={112}/>{sortie ? <span className="sr-coche" aria-hidden="true"><Icon name="check" size={28}/></span> : null}</span>
            <div className="sr-paire-txt">
              <Plaque n={f ? f.numero : cle} grand/>
              <span className="sr-paire-titre">{(f && f.title) || '—'}</span>
              {ou ? <span className="sr-paire-ou" data-sr-ou-avant="">{tr('sr.deplacer.avant', { ou: s.placeEnMots(ou) })}</span> : null}
            </div>
          </div>
          {!autre && prop ? (
            <div className="sr-ici sr-kraft" data-sr-propose={prop.meubleId + ':' + prop.i} data-sr-propose-suite={derniere && String(derniere) === String(prop.meubleId) ? '' : undefined}>
              <span className="sr-ici-l">{derniere && String(derniere) === String(prop.meubleId) ? tr('sr.ici.suite') : tr('sr.ici.l')}</span>
              <span className="sr-ici-meuble">{prop.meuble}</span>
              <span className="sr-ici-case">{tr('sr.ici.case', { r: nombre(prop.rangee), c: nombre(prop.colonne) })}</span>
              <PetitPlan m={mProp} viseI={prop.i} occupee={s.occupee}/>
            </div>
          ) : null}
          {!autre && !prop ? <p className="sr-sans" data-sr-sans-case="">{s.meubles.length ? tr('sr.ici.plein') : tr('sr.ici.aucunMeuble')}</p> : null}
          {autre ? (
            <div className="sr-choix" data-sr-choix="">
              {s.meubles.length > 1 ? (
                <div className="sr-meubles" role="tablist" aria-label={tr('sr.choix.meubles')}>
                  {s.meubles.map((m) => (
                    <button key={m.id} type="button" role="tab" className="sr-meuble-onglet" aria-selected={mAutre && String(mAutre.id) === String(m.id)} data-sr-onglet={m.id} onClick={() => setMeubleChoisi(String(m.id))}>{m.name}</button>
                  ))}
                </div>
              ) : null}
              {mAutre ? (
                <div className="sr-grille-hote">
                  <div className="sr-grille" style={{ gridTemplateColumns: `repeat(${Math.max(1, Number(mAutre.cols) || 1)}, minmax(44px, 56px))` }} data-sr-grille={mAutre.id}>
                    {Array.from({ length: (Number(mAutre.cols) || 1) * (Number(mAutre.rows) || 1) }).map((_, i) => {
                      const occ = s.occupantNum(mAutre.id, i); const p = s.placeCase(i, mAutre);
                      const ici = ou && String(ou.meuble.id) === String(mAutre.id) && ou.i === i;
                      return (
                        <button key={i} type="button" className={'sr-case' + (occ ? ' is-prise' : '') + (ici ? ' is-ici' : '')} data-sr-case={mAutre.id + ':' + i} disabled={ici || enCours}
                          aria-label={occ ? tr('sr.case.prise', { num: occ, r: p.rangee, c: p.colonne }) : tr('sr.case.libre', { r: p.rangee, c: p.colonne })} onClick={() => poser(String(mAutre.id), i)}>
                          {occ ? <span className="sr-case-n">{occ}</span> : null}
                        </button>);
                    })}
                  </div>
                </div>
              ) : <p className="sr-sans">{tr('sr.ici.aucunMeuble')}</p>}
              <p className="sr-aide">{tr('sr.choix.aide')}</p>
            </div>
          ) : null}
          <div className="sr-gestes">
            {!autre && prop ? <button type="button" className="sr-btn sr-btn-plein" data-sr-ranger-ici="" disabled={enCours} onClick={() => poser(String(prop.meubleId), prop.i)}>{tr('sr.ici.ranger')}</button> : null}
            <div className="sr-gestes-bas">
              {!seance.deplacer && (prop || autre) ? <button type="button" className="sr-btn sr-btn-teinte" data-sr-autre="" aria-pressed={autre} onClick={() => setAutre((x) => !x)}>{autre ? (prop ? tr('sr.choix.retour') : tr('sr.choix.fermer')) : tr('sr.choix.autre')}</button> : null}
              {!seance.deplacer && total > 1 ? <button type="button" className="sr-btn sr-btn-texte" data-sr-passer="" onClick={() => setPasses((x) => [...x, cle])}>{tr('sr.seance.passer')}</button> : null}
              {!s.meubles.length ? <button type="button" className="sr-btn sr-btn-teinte" data-sr-creer-meuble="" onClick={() => { fermer(); s.creerMeuble(); }}>{tr('sr.places.ajouter')}</button> : null}
            </div>
          </div>
        </div>
      )}
    </Feuille>
  );
}

// ── « OÙ EST… » : la réponse d'un N° (une seule paire), en grand ──────────────
function Reponse({ s, f, onDeplacer, onRanger, onVoir }) {
  const { Icon } = s;
  const ou = s.ouEst(f);
  const vendue = s.estVendu(f);
  const k = s.cleDe(f);
  return (
    <div className="sr-reponse" data-sr-reponse={k} data-sr-reponse-ou={ou ? `${ou.meuble.name}|${ou.rangee}|${ou.colonne}` : 'non-range'}>
      <div className="sr-reponse-tete">
        <Photo f={f} Photo={s.Photo} Icon={Icon} taille={72}/>
        <div className="sr-paire-txt">
          <Plaque n={f.numero}/>
          <span className="sr-paire-titre">{f.title || '—'}</span>
          {vendue ? <span className="sr-vendue" data-sr-vendue="">{tr('sr.reponse.vendue')}</span> : null}
        </div>
      </div>
      {ou ? (
        <div className="sr-kraft-anneau"><div className="sr-ici sr-kraft is-reponse" data-sr-etiquette-place="">
          <span className="sr-ici-meuble" data-sr-reponse-meuble="">{ou.meuble.name}</span>
          <span className="sr-ici-case">{tr('sr.ici.case', { r: nombre(ou.rangee), c: nombre(ou.colonne) })}</span>
          <PetitPlan m={ou.meuble} viseI={ou.i} occupee={s.occupee}/>
        </div></div>
      ) : <p className="sr-sans" data-sr-reponse-pas-rangee="">{tr('sr.reponse.pasRangee')}</p>}
      <div className="sr-gestes-bas">
        {ou ? <button type="button" className="sr-btn sr-btn-teinte" data-sr-voir="" onClick={onVoir}>{tr('sr.reponse.voir')}</button> : null}
        {ou && !vendue ? <button type="button" className="sr-btn sr-btn-teinte" data-sr-deplacer="" onClick={onDeplacer}>{tr('sr.reponse.deplacer')}</button> : null}
        {!ou && !vendue && s.peutRanger(k) ? <button type="button" className="sr-btn sr-btn-teinte" data-sr-ranger-maintenant="" onClick={onRanger}>{tr('sr.reponse.ranger')}</button> : null}
      </div>
    </div>
  );
}

// La plaque N° d'une rangée : celle du nouveau design (`.v2-plaque`, src/designV2/design-v2.css).
function PlaqueV2({ num }) { return <span className="v2-plaque" data-v2-plaque={num}><small>N°</small>{num}</span>; }

// ── UNE PAIRE DANS LA LISTE : la rangée A du nouveau design (photo 64, titre sur 2 lignes, « N° · T. · place »).
// Toucher : sa place (une feuille) ; glisser à gauche : « Ranger » ou « Déplacer » (les mêmes gestes que la feuille).
function LignePaire({ s, l, onOuvrir, onRanger, onDeplacer }) {
  const { Icon } = s;
  const actions = !l.cle ? [] : [l.ou
    ? { cle: 'deplacer', libelle: tr('sr.glisse.deplacer'), icone: <Icon name="box" size={20}/>, faire: onDeplacer, data: { 'data-sr-glisse': 'deplacer' } }
    : { cle: 'ranger', libelle: tr('sr.glisse.ranger'), icone: <Icon name="box" size={20}/>, faire: onRanger, data: { 'data-sr-glisse': 'ranger' } }];
  const place = l.ou ? s.placeEnMots(l.ou) : '';
  const corps = (gp, tiroir) => (
    <div className="v2l v2l-a sr-ligne" data-v2l="A" role="listitem" data-sr-ligne={l.cle || 'sans'} data-sr-ligne-place={l.ou ? `${l.ou.meuble.name}|${l.ou.rangee}|${l.ou.colonne}` : (l.cle ? 'non-range' : 'sans-numero')}
      aria-label={[l.cle ? 'N°' + l.numero : '', l.titre, place || (l.cle ? tr('sr.ligne.aRanger') : tr('sr.ligne.sansNum'))].filter(Boolean).join(' · ')}
      tabIndex={0} onClick={() => onOuvrir(l)} onKeyDown={(e) => { if (e.key === 'Enter') onOuvrir(l); }} {...(gp || {})}>
      <span className="v2l-photo v2l-photo-a" aria-hidden="true">{l.photo ? <s.Photo src={l.photo} alt="" loading="lazy" decoding="async"/> : <span className="v2l-sans"><Icon name="cintre" size={22}/></span>}</span>
      <span className="v2l-a-txt">
        <span className="v2l-a-l1"><span className="v2l-a-titre">{l.titre || '—'}</span></span>
        <span className="v2l-a-l2">
          {l.cle ? <PlaqueV2 num={l.numero}/> : <span className="sr-sans-num">{tr('sr.ligne.sansNum')}</span>}
          <span className="v2l-faits-txt">{[l.taille ? tr('v2.l.taille', { t: l.taille }) : '', place].filter(Boolean).join(' · ')}</span>
          {l.vendue ? <span className="v2l-geste" data-sr-ligne-vendue="">{tr('sr.ligne.vendue')}</span> : null}
        </span>
      </span>
      {tiroir}
    </div>
  );
  if (!actions.length) return corps(null, null);
  return <LigneGlissable actions={actions} cle={'sr:' + l.cle} libelle={l.titre || 'N°' + l.numero}>{(gp, tiroir) => corps(gp, tiroir)}</LigneGlissable>;
}

// ── « ⋯ » : ce qui n'est pas compté (chacun avec SON geste) et les outils du Stock. ──
function FeuillePlus({ s, fermer }) {
  const { Icon, Feuille } = s;
  const geste = (f) => () => { fermer(); setTimeout(f, 60); };
  return (
    <Feuille onClose={fermer} titre={tr('sr.menu.titre')} maxWidth={520} data-sr-plus="" className="sr-feuille">
      <div className="sr-plus">
        {s.etats.length ? <>
          <h3 className="sr-plus-h">{tr('sr.menu.verifier')}</h3>
          <div className="sr-plus-groupe">
            {s.etats.map((e) => (
              <button key={e.k} type="button" className="sr-plus-ligne" data-sr-etat={e.k} onClick={e.faire ? geste(e.faire) : undefined} disabled={!e.faire}>
                <span className="sr-plus-txt"><b>{e.ambre ? <i className="v2-point" aria-hidden="true"/> : null}{e.titre}</b><span>{e.geste}</span></span>
                {e.faire ? <Icon name="chevron" size={16}/> : null}
              </button>))}
          </div>
        </> : null}
        <h3 className="sr-plus-h">{tr('sr.menu.outils')}</h3>
        <div className="sr-plus-groupe">
          <button type="button" className="sr-plus-ligne" data-stock-recherche-photo="" onClick={geste(s.ouvrirPhoto)}><Icon name="camera" size={20}/><span className="sr-plus-txt"><b>{tr('stock.trouverPhoto')}</b></span></button>
          <button type="button" className="sr-plus-ligne" data-stock-inventaire-ouvrir="" onClick={geste(s.ouvrirInventaire)}><Icon name="scan" size={20}/><span className="sr-plus-txt"><b>{tr('stock.faireInventaire')}</b></span></button>
          <button type="button" className="sr-plus-ligne" data-creer-meuble="" onClick={geste(s.creerMeuble)}><Icon name="box" size={20}/><span className="sr-plus-txt"><b>{tr('sr.places.ajouter')}</b></span></button>
          <button type="button" className="sr-plus-ligne" data-sr-vers-annonces="" onClick={geste(s.versAnnonces)}><Icon name="tag" size={20}/><span className="sr-plus-txt"><b>{tr('sr.menu.annonces')}</b></span></button>
        </div>
      </div>
    </Feuille>
  );
}

export default function StockV2({ s }) {
  const { Icon, Mic, mots, Feuille } = s;
  const [seance, setSeance] = React.useState(null);      // { cles: [...], deplacer: bool }
  const [ouverts, setOuverts] = React.useState(() => new Set());
  const [choisi, setChoisi] = React.useState(null);      // une clé choisie parmi plusieurs résultats
  const [vue, setVueEtat] = React.useState(() => { try { return localStorage.getItem('vrm_stock_v2_vue') === 'places' ? 'places' : 'paires'; } catch (_) { return 'paires'; } });
  const setVue = (v) => { setVueEtat(v); try { localStorage.setItem('vrm_stock_v2_vue', v); } catch (_) {} };
  const [plus, setPlus] = React.useState(false);
  const [fiche, setFiche] = React.useState(null);        // la paire touchée dans la liste (sa place, en feuille)
  const [max, setMax] = React.useState(60);
  const aRangerCles = s.aRanger.map(s.cleDe).filter(Boolean);
  const lancer = (cles, deplacer = false) => { if (cles.length) { setFiche(null); setSeance({ cles, deplacer }); } };
  const rangerA = (k) => lancer([k, ...aRangerCles.filter((x) => x !== k)]);
  // Une demande « ranger / déplacer CE N° » (Annonces, la fiche « Déplacer ») : la séance s'ouvre sur lui.
  React.useEffect(() => {
    if (!s.place) return;
    const k = s.place; s.setPlace(null);
    const f = s.ficheDe(k);
    if (f && s.ouEst(f)) lancer([k], true); else rangerA(k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.place]);
  const ouvrir = (id) => setOuverts((x) => { const n = new Set(x); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const voir = (f) => { const ou = s.ouEst(f); setFiche(null); if (ou) { setVue('places'); setOuverts((x) => new Set([...x, String(ou.meuble.id)])); } s.montrer(f); };
  const exact = s.qEstNum ? s.resultats.filter((f) => s.exactNum(f)) : [];
  const un = choisi ? s.resultats.find((f) => s.cleDe(f) === choisi) : (exact.length === 1 ? exact[0] : (s.resultats.length === 1 ? s.resultats[0] : null));
  React.useEffect(() => { setChoisi(null); }, [s.q]);
  const nPlein = aRangerCles.length;
  const chercheVide = !s.q.trim();
  const ficheF = fiche ? s.ficheDe(fiche) : null;
  const lignes = s.lignes;
  const nonRangees = lignes.filter((l) => l.cle && !l.ou), rangees = lignes.filter((l) => !l.cle || l.ou);
  const ligne = (l) => <LignePaire key={l.key} s={s} l={l} onOuvrir={(x) => { if (x.cle && s.ficheDe(x.cle)) setFiche(x.cle); }} onRanger={() => rangerA(l.cle)} onDeplacer={() => lancer([l.cle], true)}/>;
  let reste = max;
  const tranche = (arr) => { const a = arr.slice(0, Math.max(0, reste)); reste -= a.length; return a; };

  return (
    <div className="sr-ecran" data-sr-ecran="" data-sr-vue={vue}>
      {s.blocs.inventaire}{s.blocs.annuel}
      {/* La tête : le grand titre et LE geste de l'écran (compact, en haut à droite, comme Annonces). */}
      <div className="v2-titre-ligne sr-titre-ligne">
        <h1 className="sr-titre">{tr('nav.garage')}</h1>
        {nPlein && !seance ? <BoutonV2 role="principal" compact icone={<Icon name="box" size={20}/>} attrs={{ 'data-sr-lancer': nPlein, 'aria-label': tr('sr.lancer', { n: nPlein, mot: nPlein > 1 ? mots.noms : mots.nom }) }}
          onClick={() => lancer(aRangerCles)}>{tr('sr.lancerCourt', { n: nPlein })}</BoutonV2> : null}
      </div>
      {/* UNE ligne : plateforme · compte (les filtres d'avant, dans sa feuille). */}
      {s.filtres ? <div className="v2-sous-titre sr-sous-titre"><MenuPlateforme id="stock" Icon={Icon} Retour={s.Retour} libelle={s.filtres.libelle} sous={s.filtres.sous}>{s.filtres.corps}</MenuPlateforme></div> : null}
      {s.blocs.horsLigne}

      {/* « Où est… » : le champ (photo et voix dedans) et « ⋯ ». */}
      <div className="sr-cherche-ligne">
        <div className="sr-cherche" data-sr-recherche="">
          <span className="sr-cherche-ic" aria-hidden="true"><Icon name="search" size={18}/></span>
          <input ref={s.chercheRef} className="sr-champ" value={s.q} onChange={(e) => s.setQ(e.target.value)} type="search" enterKeyHint="search" autoComplete="off"
            placeholder={tr('sr.cherche.place')} aria-label={tr('stock.retrouverArticleDans')} data-sr-cherche=""
            onKeyDown={(e) => { if (e.key === 'Escape') s.setQ(''); if (e.key === 'Enter' && un && s.ouEst(un)) { e.preventDefault(); voir(un); } }}/>
          <span className="sr-cherche-mic">{s.q ? <button type="button" className="sr-rond is-petit" aria-label={tr('reglages.recherche.effacer')} onClick={() => s.setQ('')}><Icon name="close" size={18}/></button>
            : <>{s.dicteeOk ? <Mic nu titre={tr('stock.chercherVoixNumero')} onText={(t) => s.setQ(requeteDeLaVoix(t).requete)}/> : null}
              <button type="button" className="sr-rond is-petit" aria-label={tr('stock.trouverPhoto')} title={tr('stock.trouverPhoto')} data-sr-photo="" onClick={s.ouvrirPhoto}><Icon name="camera" size={20}/></button></>}</span>
        </div>
        <BoutonIconeV2 icone={<Icon name="more" size={22}/>} label={tr('sr.menu.ouvrir')} onClick={() => setPlus(true)} attrs={{ 'data-sr-plus-ouvrir': '', 'data-sr-etats': s.etats.length || undefined }}/>
      </div>

      {!chercheVide ? (
        <div className="sr-resultats" data-stock-resultats={s.resultats.length}>
          {un ? <Reponse s={s} f={un} onVoir={() => voir(un)} onDeplacer={() => lancer([s.cleDe(un)], true)} onRanger={() => rangerA(s.cleDe(un))}/> : null}
          {!un && s.resultats.length === 0 ? <p className="sr-vide-l" data-stock-rien="">{s.qEstNum ? tr('sr.cherche.rienNum', { num: s.q.trim() }) : tr('sr.cherche.rien', { q: s.q.trim() })}</p> : null}
          {!un && s.resultats.length > 1 ? (
            <div className="sr-liste">
              {s.resultats.slice(0, 30).map((f) => { const ou = s.ouEst(f); return (
                <button key={f.id} type="button" className="sr-rangee" data-stock-res={s.cleDe(f)} onClick={() => setChoisi(s.cleDe(f))}>
                  <Photo f={f} Photo={s.Photo} Icon={Icon} taille={52}/>
                  <span className="sr-rangee-txt"><span className="sr-rangee-t"><b>N°{f.numero}</b> {f.title || '—'}</span>
                    <span className="sr-rangee-s">{ou ? s.placeEnMots(ou) : tr('sr.reponse.pasRangee')}</span></span>
                  <span className="sr-chevron" aria-hidden="true"><Icon name="chevron" size={16}/></span>
                </button>); })}
            </div>) : null}
        </div>
      ) : null}
      {chercheVide && s.cibles.length ? (
        <section className="sr-groupe" data-stock-cibles={s.cibles.length}>
          <h2 className="sr-h2">{tr('stock.allerChercher')}</h2>
          <div className="sr-liste">
            {s.cibles.map((k) => { const f = s.ficheDe(k); const ou = f && s.ouEst(f); return (
              <button key={k} type="button" className="sr-rangee" data-aller-chercher={k} onClick={() => { if (f && ou) voir(f); }}>
                <Photo f={f} Photo={s.Photo} Icon={Icon} taille={52}/>
                <span className="sr-rangee-txt"><span className="sr-rangee-t"><b>N°{f ? f.numero : k}</b> {(f && f.title) || ''}</span><span className="sr-rangee-s">{ou ? s.placeEnMots(ou) : tr('sr.reponse.pasRangee')}</span></span>
              </button>); })}
          </div>
          <BoutonV2 role="texte" onClick={() => s.setCibles([])}>{tr('creerVinted.fermer')}</BoutonV2>
        </section>) : null}

      {chercheVide ? <>
        {/* Paires · Places : les deux façons de regarder le stock ; leurs nombres sont ceux d'avant (en ligne · meubles). */}
        <div className="v2-ann-segment sr-segment" data-sr-segment={vue}>
          <s.Segmente label={tr('sr.seg.label')} plein value={vue} onChange={setVue}
            options={[{ v: 'paires', l: mots.Noms, n: s.nombres.enLigne != null ? (s.nombres.auMoins ? '≥ ' : '') + nombre(s.nombres.enLigne) : undefined, data: { 'data-sr-seg': 'paires' } },
              { v: 'places', l: tr('sr.seg.places'), n: s.meubles.length ? nombre(s.meubles.length) : undefined, data: { 'data-sr-seg': 'places' } }]}/>
        </div>
        {vue === 'paires' ? <>
          {s.nombres.enLigne == null ? <p className="sr-vide-l" data-stock-actuelles={s.nombres.etat}>{s.nombres.attente ? tr('stock.jeLisAnnonces') : tr('sr.pasLu')}</p> : null}
          {lignes.length ? (
            <div className="v2-liste-annonces sr-liste-paires" data-v2-ligne="A" role="list" data-stock-actuelles={s.nombres.etat} data-sr-liste={lignes.length}>
              {nonRangees.length ? <h3 className="v2-ann-groupe" data-sr-groupe="aranger">{tr('sr.groupe.aRanger')}<span className="v2-ann-groupe-n">{nombre(nonRangees.length)}</span></h3> : null}
              {tranche(nonRangees).map(ligne)}
              {rangees.length && reste > 0 ? <h3 className="v2-ann-groupe" data-sr-groupe="rangees">{tr('sr.groupe.rangees')}<span className="v2-ann-groupe-n">{nombre(rangees.length)}</span></h3> : null}
              {tranche(rangees).map(ligne)}
            </div>) : null}
          {lignes.length > max ? <BoutonV2 role="texte" attrs={{ 'data-sr-liste-plus': '' }} onClick={() => setMax((x) => x + 60)}>{tr('sr.liste.plus', { n: nombre(Math.min(60, lignes.length - max)) })}</BoutonV2> : null}
          {s.blocs.aFaire}
          {s.blocs.importees}{s.blocs.aPart}{s.blocs.ecartes}
        </> : <>
          {/* MES PLACES : un meuble par rangée ; toucher l'ouvre (ses cases, photos et N°, le même plan qu'avant). */}
          <section className="sr-groupe" data-sr-places={s.meubles.length}>
            {s.meubles.length === 0 ? s.blocs.explication : null}
            <div className="sr-liste">
              {s.meubles.map((m, k) => { const c = s.compteMeuble(m); const ouvert = ouverts.has(String(m.id)) || (s.cherche && c.ici > 0); return (
                <div key={m.id} className="sr-place" data-sr-place={m.id} data-ouvert={ouvert ? '1' : '0'}>
                  <button type="button" className="sr-rangee" aria-expanded={ouvert} data-sr-place-ouvrir={m.id} onClick={() => ouvrir(String(m.id))}>
                    <span className="sr-place-etiquette sr-kraft" aria-hidden="true" data-sr-place-etiquette={m.id}>{initiales(m.name)}</span>
                    <span className="sr-rangee-txt"><span className="sr-rangee-t">{m.name}</span>
                      <span className="sr-rangee-s">{tr('sr.places.plein', { n: c.pleines, t: nombre(c.total) })}{c.aSortir ? <span className="sr-a-sortir" data-sr-a-sortir={c.aSortir}> · {tr('sr.places.aSortir', { n: c.aSortir })}</span> : null}</span></span>
                    <span className="sr-chevron" aria-hidden="true" data-ouvert={ouvert ? '1' : '0'}><Icon name="chevron" size={16}/></span>
                  </button>
                  {ouvert ? <div className="sr-place-corps">{s.rendreMeuble(m, k)}</div> : null}
                </div>); })}
              <button type="button" className="sr-rangee sr-rangee-ajout" data-creer-meuble="" onClick={s.creerMeuble}>
                <span className="sr-place-ic is-ajout" aria-hidden="true">+</span>
                <span className="sr-rangee-txt"><span className="sr-rangee-t is-lien">{tr('sr.places.ajouter')}</span></span>
              </button>
            </div>
          </section>
          {s.blocs.plus}
        </>}
      </> : null}
      {s.blocs.modale}

      {ficheF ? (
        <Feuille onClose={() => setFiche(null)} titre={'N°' + ficheF.numero} maxWidth={520} data-sr-fiche={fiche} className="sr-feuille">
          <div className="sr-seance is-fiche">
            <Reponse s={s} f={ficheF} onVoir={() => voir(ficheF)} onDeplacer={() => lancer([fiche], true)} onRanger={() => rangerA(fiche)}/>
            <button type="button" className="sr-btn sr-btn-texte" data-sr-tout-sur={fiche} onClick={() => { const n = String(ficheF.numero); setFiche(null); try { window.dispatchEvent(new CustomEvent('vrm:fiche-paire', { detail: n })); } catch (_) {} }}>{tr('sr.reponse.fiche')}</button>
          </div>
        </Feuille>) : null}
      {plus ? <FeuillePlus s={s} fermer={() => setPlus(false)}/> : null}
      {seance ? <Seance s={s} seance={seance} fermer={() => setSeance(null)}/> : null}
    </div>
  );
}
