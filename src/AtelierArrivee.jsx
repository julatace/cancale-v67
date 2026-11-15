// ════════════════════════════════════════════════════════════════════════════
//  L'ATELIER « ACHAT ARRIVÉ → EN LIGNE » — le dessin (15 nov.)
//  La règle : src/atelierArrivee.js. Récit : docs/passation/2026-11-15-atelier-arrivee.md
// ════════════════════════════════════════════════════════════════════════════
// Une feuille, une étape à la fois, une progression en haut (six traits qu'on touche) :
//   1 N° · 2 case (« Rangé » : le geste de la feuille « Ranger cet achat ») · 3 photos
//   (le studio) · 4 prix d'achat (le prix PAYÉ de CET achat, « Garder » sur son tap)
//   · 5 fiche « À publier » (ce que l'achat dit, la note) · 6 publier (« Créer sur
//   Vinted », puis « Publier partout »).
// Chaque étape a « Plus tard » ; rien n'est écrit ici : la coque écrit (App.jsx,
// `AtelierArriveeCoque`), chaque geste s'annule 5 s. Un seul bouton plein par étape.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr, monnaie } from './i18n/index.js';
import { useLangue } from './i18n/react.js';
import { lignesDeLAchat, validerNumeroTape, LOT_MAX } from './rangementArrivee.js';
import { ETAPES_ATELIER, etapesPaire, etapeReprise, progression, prixPayeArrivee, indicatifLot, ficheDepuisAchat, fichesDeLArrivee } from './atelierArrivee.js';
import { AccAvant } from './ui/Accompagne.jsx';
import './atelier-arrivee.css';

const CATEGORIES = ['baskets', 'vetements', 'sacs', 'accessoires', 'autre'];
const ETATS = ['neufEtiquette', 'neuf', 'tresBon', 'bon', 'satisfaisant'];
const motCase = (c) => (c ? tr('ranger.niveau', { meuble: c.meuble, niveau: c.rangee, case: c.colonne }) : '');
const caseFiche = (f, meubles) => {
  if (!f || !f.case) return '';
  const m = (meubles || []).find((x) => x && String(x.id) === String(f.case.m));
  if (!m) return '';
  const cols = Math.max(1, Number(m.cols) || 1), i = Number(f.case.i);
  return tr('ranger.niveau', { meuble: String(m.name || 'Meuble'), niveau: Math.floor(i / cols) + 1, case: (i % cols) + 1 });
};

// La progression : six traits, la reprise allumée ; un trait fait ou passé se touche (on y revient).
function Progression({ etapes, courante, onAller, verrou }) {
  const p = progression(etapes);
  return (
    <nav className="vrm-arr-prog" aria-label={tr('arr.prog.aria', { n: courante ? ETAPES_ATELIER.indexOf(courante) + 1 : p.total, m: p.total })} data-aa-prog={`${p.faites}/${p.total}`} data-aa-courante={courante}>
      <ol>
        {etapes.map((e, i) => {
          const touchable = !verrou && e.cle !== courante && (e.etat !== 'afaire' || etapes.slice(0, i).every((x) => x.etat !== 'afaire' || x.cle === courante)) && !(e.raison === 'sansNumero')
            // Rangée : le N° et la case sont écrits (un N° servi ne se reprend pas ici ; la case se change dans le Stock).
            && !(e.cle === 'numero' && e.etat !== 'afaire') && !(e.cle === 'case' && e.etat === 'fait');
          return (
            <li key={e.cle} className={`is-${e.etat}${e.cle === courante ? ' is-courante' : ''}`} data-aa-etape={e.cle} data-aa-etat={e.etat}>
              <button type="button" disabled={!touchable} aria-current={e.cle === courante ? 'step' : undefined} onClick={() => onAller(e.cle)}>
                <i aria-hidden="true"/>
                <span>{tr('arr.etape.' + e.cle)}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ── 1 et 2 : le N° et la case (la règle de « Ranger cet achat ») ─────────────
function EtapeRanger({ entree, prep, lignes, setLignes, courante, setCourante, n, setN, etape, Plan }) {
  const poser = (k, champs) => setLignes((L) => L.map((l, j) => (j === k ? { ...l, ...champs } : l)));
  if (prep === undefined) return <p className="vrm-arr-doux" data-aa-attente="">{tr('ranger.attente')}</p>;
  if (!prep || !prep.ok) return <p className="vrm-arr-doux" data-aa-passu={(prep && prep.raison) || ''}><b>—</b> {tr(prep && prep.raison === 'numeros' ? 'ranger.numPasSu' : 'ranger.refus.lecture')}</p>;
  if (etape === 'numero') {
    return (
      <div className="vrm-arr-corps" data-aa-corps="numero">
        {entree.lot ? (
          <div className="vrm-arr-lot" data-aa-lot={n}>
            <span>{tr('ranger.combien')}</span>
            <span className="vrm-arr-pas">
              <button type="button" aria-label={tr('ranger.moins')} disabled={n <= 1} onClick={() => setN(Math.max(1, n - 1))}>−</button>
              <b>{n}</b>
              <button type="button" aria-label={tr('ranger.plus')} disabled={n >= LOT_MAX} onClick={() => setN(Math.min(LOT_MAX, n + 1))}>+</button>
            </span>
          </div>
        ) : null}
        {prep.numeroEcrit ? <p className="vrm-arr-doux" data-aa-tape="">{tr('ranger.numeroTapeAide')}</p> : null}
        <ul className="vrm-arr-nums">
          {lignes.map((l, k) => {
            const v = prep.numeroEcrit ? validerNumeroTape(l.numero, { pris: prep.pris, archive: prep.archive, cleNum: prep.cleNum, autres: lignes.filter((_, j) => j !== k).map((x) => x.numero).filter(Boolean) }) : { ok: true };
            return (
              <li key={k} data-aa-ligne={k}>
                {prep.numeroEcrit ? (
                  <label className="vrm-arr-num-tape"><span>{tr('ranger.numero')}</span>
                    <input inputMode={prep.clavier || 'numeric'} autoComplete="off" value={l.numero} data-aa-num-tape={k} aria-invalid={!v.ok && v.raison !== 'vide' ? 'true' : undefined}
                      onChange={(e) => poser(k, { numero: e.target.value.toUpperCase().slice(0, 9) })}/>
                  </label>
                ) : <span className="vrm-arr-plaque sb-plaque" data-aa-num-propose={l.numero}>N°{l.numero}</span>}
                {lignes.length > 1 ? <small>{tr('arr.lot.article', { i: k + 1, n: lignes.length })}</small> : null}
                {!v.ok && v.raison !== 'vide' ? <p className="vrm-arr-refus" data-aa-refus={v.raison}>{tr('ranger.refus.' + (['pris', 'archive', 'illisible', 'double'].includes(v.raison) ? v.raison : 'illisible'), { n: l.numero, a: prep.archive || '' })}</p> : null}
              </li>
            );
          })}
        </ul>
        {prep.numeroEcrit ? null : <p className="vrm-arr-doux">{tr(lignes.length > 1 ? 'arr.numero.carton.n' : 'arr.numero.carton')}</p>}
        <AccAvant geste="arrivee.ranger"/>
      </div>
    );
  }
  return null;
}

// ── 2 : la case de L'ARTICLE (son N° est donné) — Julien : « on range une ANNONCE, pas un achat ».
// La case proposée est lue sur les cases ACTUELLES : jamais celle d'un autre article.
function EtapeCase({ fiche, prop, place, setPlace, meubles, slots, Plan, erreur }) {
  const lignes = [{ numero: String(fiche.numero), case: place }];
  return (
    <div className="vrm-arr-corps" data-aa-corps="case" data-aa-case-m={place ? place.meubleId : ''} data-aa-case-i={place ? place.i : ''}>
      <div className="vrm-arr-case-ligne is-courante" data-aa-case-ligne="0">
        <span className="sb-plaque vrm-arr-plaque-petite">N°{fiche.numero}</span>
        <span className="vrm-arr-case-mots">{place ? motCase(place) : (!prop || !prop.su) ? '— ' + tr('ranger.refus.lecture') : prop.aucunMeuble ? tr('ranger.aucunMeuble') : tr('ranger.plein')}</span>
      </div>
      {Array.isArray(meubles) && meubles.length && Plan ? (
        <>
          <p className="vrm-arr-doux">{tr('ranger.toucherCase')}</p>
          <Plan prep={{ meubles, slots }} lignes={lignes} courante={0} onCase={(c) => setPlace(c)}/>
        </>
      ) : null}
      {erreur ? <p className="vrm-arr-refus" role="alert" data-aa-case-erreur={erreur}>{tr(['case', 'deja'].includes(erreur) ? 'ranger.refus.' + erreur : 'ranger.refus.lecture')}</p> : null}
      <AccAvant geste="arrivee.case"/>
    </div>
  );
}

// ── 3 : les photos (le studio, sous CE N°) ───────────────────────────────────
function EtapePhotos({ fiche, photos, vignettes }) {
  return (
    <div className="vrm-arr-corps" data-aa-corps="photos" data-aa-photos={Number.isFinite(photos) ? photos : photos === null ? 'passu' : 'lecture'}>
      {Array.isArray(vignettes) && vignettes.length ? (
        <div className="vrm-arr-photos">
          {vignettes.slice(0, 8).map((p, i) => <img key={p.id || i} src={p.detoure || p.img} alt={tr('atelier.photos.alt', { i: i + 1, num: fiche.numero })} loading="lazy" decoding="async" width="96" height="128"/>)}
        </div>
      ) : (
        <div className="vrm-arr-vide" aria-hidden="true">
          <svg viewBox="0 0 120 64" width="120" height="64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 50c6-14 20-18 30-24l14-9c6 8 16 12 30 13 12 1 20 8 20 19v3H8z"/><path d="M8 53h104"/><path d="M40 27l6 6M48 22l6 6M56 18l5 6"/></svg>
        </div>
      )}
      <p className="vrm-arr-doux">{photos === undefined ? tr('atelier.photos.lecture') : photos === null ? '— ' + tr('atelier.photos.passu') : photos > 0 ? tr('atelier.photos.n', { n: photos }) : tr('arr.photos.aucune')}</p>
      <p className="vrm-arr-doux">{tr('arr.photos.detourage')}</p>
    </div>
  );
}

// ── 4 : le prix d'achat (SON prix payé, par l'identité de l'achat) ───────────
function EtapePrix({ entree, fiche, cout, corriger, setCorriger, saisie, setSaisie, erreur }) {
  const prop = prixPayeArrivee(entree);
  const pose = (cout != null && String(cout).trim() !== '') ? String(cout) : (fiche.prixAchat != null ? String(fiche.prixAchat).replace('.', ',') : '');
  if (pose) {
    return (
      <div className="vrm-arr-corps" data-aa-corps="prix" data-aa-prix-pose={pose}>
        <div className="vrm-arr-chiffre"><b>{monnaie(Number(pose.replace(',', '.')))}</b><span>{tr('arr.prix.pose')}</span></div>
      </div>
    );
  }
  const ind = indicatifLot(entree);
  return (
    <div className="vrm-arr-corps" data-aa-corps="prix" data-aa-prix-propose={prop ? prop.valeur : ''} data-aa-prix-source={prop ? prop.source : ''}>
      {prop && !corriger ? (
        <div className="vrm-arr-chiffre">
          <b>{monnaie(prop.centimes / 100)}</b>
          <span>{tr(prop.source === 'recu' ? 'arr.prix.recu' : 'arr.prix.article')}</span>
          <small>{prop.source === 'recu' ? prop.detail : tr('arr.prix.sansFrais')}</small>
        </div>
      ) : (
        <label className="vrm-arr-champ is-prix"><span>{tr('arr.prix.champ')}</span>
          <input inputMode="decimal" autoComplete="off" value={saisie} placeholder={ind ? '≈ ' + ind : ''} data-aa-prix-saisie="" onChange={(e) => setSaisie(e.target.value.replace(/[^\d.,]/g, '').slice(0, 9))}/>
        </label>
      )}
      {!prop ? <p className="vrm-arr-doux" data-aa-prix-pourquoi={entree.lot || (Number(entree.n) || 0) > 1 ? 'lot' : entree.tx ? 'illisible' : 'sansAchat'}>
        {tr(entree.lot || (Number(entree.n) || 0) > 1 ? 'arr.prix.lot' : entree.tx ? 'arr.prix.pasLu' : 'arr.prix.sansAchat')}</p> : null}
      {prop && corriger ? <p className="vrm-arr-doux">{tr('arr.prix.corrigerAide')}</p> : null}
      {prop && !corriger ? <button type="button" className="vrm-arr-lien sb-lien" data-aa-prix-corriger="" onClick={() => { setCorriger(true); setSaisie(''); }}>{tr('arr.prix.corriger')}</button> : null}
      {erreur ? <p className="vrm-arr-refus" role="alert" data-aa-prix-erreur={erreur}>{tr('arr.prix.erreur.' + erreur)}</p> : null}
      <AccAvant geste="arrivee.prix"/>
    </div>
  );
}

// ── 5 : la fiche « À publier » (ce que l'achat dit, sa note) ─────────────────
function EtapeFiche({ fiche, champs, setChamps, Note, erreur }) {
  const poser = (k, v) => setChamps((c) => ({ ...c, [k]: v }));
  const ch = (k, lib, extra = {}) => (
    <label className={'vrm-arr-champ' + (extra.large ? ' is-large' : '')} data-aa-champ={k}>
      <span>{lib}</span>
      {extra.zone ? <textarea rows={4} value={champs[k] || ''} onChange={(e) => poser(k, e.target.value)}/>
        : <input value={champs[k] || ''} inputMode={extra.mode} placeholder={extra.ph || ''} onChange={(e) => poser(k, k === 'prix' ? e.target.value.replace(/[^\d.,]/g, '').slice(0, 9) : e.target.value)}/>}
    </label>
  );
  return (
    <div className="vrm-arr-corps" data-aa-corps="fiche">
      {Note ? <div className="vrm-arr-note" data-aa-note={fiche.numero}>{Note(fiche.numero)}</div> : null}
      <div className="vrm-arr-champs">
        {ch('titre', tr('ranger.champ.titre'), { large: true })}
        {ch('marque', tr('ranger.champ.marque'))}
        {ch('taille', tr('ranger.champ.taille'))}
        {ch('couleur', tr('arr.fiche.couleur'))}
        {ch('prix', tr('arr.fiche.prixVente'), { mode: 'decimal' })}
      </div>
      <fieldset className="vrm-arr-choix" data-aa-categorie={champs.categorie || ''}>
        <legend>{tr('arr.fiche.categorie')}</legend>
        {CATEGORIES.map((c) => { const lib = tr('arr.cat.' + c); return <button key={c} type="button" aria-pressed={champs.categorie === lib} onClick={() => poser('categorie', champs.categorie === lib ? '' : lib)}>{lib}</button>; })}
      </fieldset>
      <fieldset className="vrm-arr-choix" data-aa-etat={champs.etat || ''}>
        <legend>{tr('arr.fiche.etat')}</legend>
        {ETATS.map((c) => { const lib = tr('arr.etat.' + c); return <button key={c} type="button" aria-pressed={champs.etat === lib} onClick={() => poser('etat', champs.etat === lib ? '' : lib)}>{lib}</button>; })}
      </fieldset>
      {ch('description', tr('arr.fiche.description'), { large: true, zone: true })}
      <p className="vrm-arr-doux">{tr('arr.fiche.sources')}</p>
      {erreur ? <p className="vrm-arr-refus" role="alert" data-aa-fiche-erreur={erreur}>{tr('arr.fiche.erreur.' + erreur)}</p> : null}
      <AccAvant geste="arrivee.fiche"/>
    </div>
  );
}

// ── 6 : publier (« Créer sur Vinted », puis « Publier partout ») ────────────
function EtapePublier({ etatVinted }) {
  return (
    <div className="vrm-arr-corps" data-aa-corps="publier" data-aa-vinted={etatVinted}>
      <p className="vrm-arr-etat-ligne"><i className={'vrm-arr-diode is-' + etatVinted} aria-hidden="true"/>{tr('arr.publier.' + etatVinted)}</p>
      <p className="vrm-arr-doux">{tr(etatVinted === 'en-ligne' ? 'arr.publier.partoutAide' : 'arr.publier.vintedAide')}</p>
    </div>
  );
}

// ── L'atelier d'UN achat ─────────────────────────────────────────────────────
function UnAchat({ entree, coque, onSuivant, onFermer, position, Bouton, Photo, Plan, Note }) {
  useLangue();
  const [, maj] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => { const f = () => maj(); window.addEventListener('vrm:save', f); return () => window.removeEventListener('vrm:save', f); }, []);
  const etat = coque.lireEtat();
  const [numeros, setNumeros] = React.useState([]);   // rendus par « Rangé » (un colis sans achat relié)
  const fiches = fichesDeLArrivee({ fiches: etat.fiches, tx: entree.tx, numeros: numeros.length ? numeros : (entree.numeros || []), cleNum: coque.cleNum });
  const range = fiches.length > 0;
  const [k, setK] = React.useState(0);                // l'article (un lot : 1 sur N)
  const fiche = range ? fiches[Math.min(k, fiches.length - 1)] : null;

  // N° et case : la préparation de « Ranger cet achat » (rien n'est écrit).
  const lotConnu = Math.max(1, Number(entree.n) || 1);
  const [n, setN] = React.useState(entree.lot && !entree.n ? 2 : lotConnu);
  const [prep, setPrep] = React.useState(undefined);
  const [lignes, setLignes] = React.useState([]);
  const [courante, setCourante] = React.useState(0);
  const [tour, setTour] = React.useState(0);
  React.useEffect(() => {
    if (range) return undefined;
    let vivant = true; setPrep(undefined);
    Promise.resolve(coque.preparer(entree, n)).then((p) => {
      if (!vivant) return;
      setPrep(p || { ok: false, raison: 'lecture' });
      if (p && p.ok) setLignes(lignesDeLAchat(entree, { n, marqueDe: p.marqueDe }).map((l, j) => ({ ...l, prix: '', numero: p.numeroEcrit ? '' : String((p.numeros || [])[j] || ''), case: (p.cases || [])[j] || null })));
    }).catch(() => { if (vivant) setPrep({ ok: false, raison: 'lecture' }); });
    return () => { vivant = false; };
  }, [entree, n, tour, range]); // eslint-disable-line react-hooks/exhaustive-deps

  // Les photos du studio sous CE N° (relues quand le studio en range une pour lui).
  const [photos, setPhotos] = React.useState(undefined);
  const [vignettes, setVignettes] = React.useState(null);
  const cleN = fiche ? coque.cleNum(fiche.numero) : '';
  React.useEffect(() => {
    if (!cleN) return undefined;
    let vivant = true; setPhotos(undefined);
    const relire = () => Promise.resolve(coque.lireStudio(cleN)).then((r) => { if (!vivant) return; const l = r && Array.isArray(r.photos) ? r.photos : null; setPhotos(l ? l.length : null); setVignettes(l); }).catch(() => { if (vivant) setPhotos(null); });
    relire();
    const surRange = (e) => { if (e && e.detail && e.detail.cle === cleN) relire(); };
    window.addEventListener('vrm:studio-range', surRange);
    return () => { vivant = false; window.removeEventListener('vrm:studio-range', surRange); };
  }, [cleN]); // eslint-disable-line react-hooks/exhaustive-deps

  const etatVinted = fiche ? coque.etatVinted(fiche) : 'a-creer';
  const etapes = etapesPaire({ fiche, photos, cout: fiche ? etat.couts[String(fiche.numero)] : null, etatVinted, marques: fiche ? etat.marques[String(fiche.id)] : null });
  const reprise = etapeReprise(etapes);
  const [vue, setVue] = React.useState(null);           // l'étape touchée dans la progression
  const etape = vue && etapes.some((e) => e.cle === vue) ? vue : (reprise || 'fin');
  React.useEffect(() => { setVue(null); }, [fiche && fiche.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Les saisies de l'étape (rien n'est écrit avant SON geste).
  const [corriger, setCorriger] = React.useState(false);
  const [saisie, setSaisie] = React.useState('');
  const [champs, setChamps] = React.useState(null);
  const [erreur, setErreur] = React.useState('');
  const [envoi, setEnvoi] = React.useState(false);
  React.useEffect(() => { setErreur(''); setCorriger(false); setSaisie(''); if (etape === 'fiche' && fiche) setChamps(ficheDepuisAchat(entree, fiche, { marqueDe: coque.marqueDe, couleursDe: coque.couleursDe })); }, [etape, fiche && fiche.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const aller = (cle) => { setVue(cle); setErreur(''); };
  const avancer = () => { setVue(null); };
  const marquer = (cle, quoi) => { if (fiche) coque.marquer(fiche.id, cle, quoi); setVue(null); };

  // « Donner ce N° » : le geste de « Ranger cet achat », SANS prix ni case (chacun a son étape, sur l'ARTICLE).
  const rangeOk = !!(prep && prep.ok) && lignes.length > 0 && lignes.every((l) => String(l.numero || '').trim())
    && (!prep.numeroEcrit || lignes.every((l, j) => validerNumeroTape(l.numero, { pris: prep.pris, archive: prep.archive, cleNum: prep.cleNum, autres: lignes.filter((_, x) => x !== j).map((x) => x.numero).filter(Boolean) }).ok));
  const ranger = async () => {
    if (!rangeOk || envoi) return;
    setEnvoi(true); setErreur('');
    let r = null; try { r = await coque.ranger(entree, lignes.map((l) => ({ ...l, prix: '', case: null }))); } catch (_) { r = { ok: false, raison: 'lecture' }; }
    setEnvoi(false);
    // La fiche arrive par l'écriture locale (un instant) : on attend sur l'étape de la case, sans rien proposer.
    if (r && r.ok) { setNumeros(r.numeros || []); setVue('case'); return; }
    setErreur(r && r.raison ? r.raison : 'lecture');
    if (r && (r.raison === 'pris' || r.raison === 'case')) setTour((t) => t + 1);
  };
  // La case de L'ARTICLE : proposée sur les cases actuelles ; « Ranger ici » l'écrit (refusée si prise entre-temps).
  const [place, setPlace] = React.useState(null);
  const propCase = etape === 'case' && fiche ? coque.caseProposee(fiche) : null;
  const cleProp = propCase && propCase.case ? propCase.case.meubleId + ':' + propCase.case.i : '';
  React.useEffect(() => { setPlace(propCase && propCase.case ? propCase.case : null); }, [etape, fiche && fiche.id, cleProp]); // eslint-disable-line react-hooks/exhaustive-deps
  const rangerIci = async () => {
    if (!fiche || !place || envoi) return;
    setEnvoi(true);
    const r = await coque.rangerCase(fiche, place);
    setEnvoi(false);
    if (r && r.ok) { setErreur(''); setVue(null); return; }
    setErreur((r && r.raison) || 'lecture');
  };
  const garderPrix = async (texte, source) => {
    if (!fiche || envoi) return;
    setEnvoi(true);
    const r = await coque.prixAchat(fiche, texte, source);
    setEnvoi(false);
    if (r && r.ok) { setErreur(''); setCorriger(false); setVue(null); return; }
    setErreur((r && r.raison) || 'lecture');
  };
  const enregistrerFiche = async () => {
    if (!fiche || !champs || envoi) return;
    setEnvoi(true);
    const r = await coque.fiche(fiche, champs);
    setEnvoi(false);
    if (r && r.ok) { setErreur(''); setVue(null); return; }
    setErreur((r && r.raison) || 'lecture');
  };

  // Le pied : UN bouton plein, « Plus tard » à côté.
  let plein = null, second = null;
  const attenteFiche = !fiche && etape !== 'numero';
  if (attenteFiche) {
    plein = null;
  } else if (etape === 'numero') {
    plein = <Bouton variante="primaire" plein data-aa-donner-numero="" occupe={envoi} disabled={!rangeOk} onClick={ranger}>{lignes.length > 1 ? tr('arr.numero.donnerN', { n: lignes.length }) : tr('arr.numero.donner')}</Bouton>;
    second = <Bouton variante="secondaire" data-aa-plus-tard="numero" onClick={onSuivant}>{tr('arr.plusTard')}</Bouton>;
  } else if (etape === 'case') {
    plein = <Bouton variante="primaire" plein data-aa-ranger-ici="" occupe={envoi} disabled={!place} onClick={rangerIci}>{tr('arr.case.ranger')}</Bouton>;
    second = <Bouton variante="secondaire" data-aa-plus-tard="case" onClick={() => marquer('case', 'passe')}>{tr('arr.plusTard')}</Bouton>;
  } else if (etape === 'photos') {
    plein = Number.isFinite(photos) && photos > 0
      ? <Bouton variante="primaire" plein data-aa-suivant="photos" onClick={() => marquer('photos', 'fait')}>{tr('arr.suivant')}</Bouton>
      : <Bouton variante="primaire" plein data-aa-studio={fiche ? fiche.numero : ''} onClick={() => coque.ouvrirStudio(cleN)}>{tr('arr.photos.prendre')}</Bouton>;
    second = Number.isFinite(photos) && photos > 0
      ? <Bouton variante="secondaire" data-aa-studio-encore="" onClick={() => coque.ouvrirStudio(cleN)}>{tr('arr.photos.encore')}</Bouton>
      : <Bouton variante="secondaire" data-aa-plus-tard="photos" onClick={() => marquer('photos', 'passe')}>{tr('arr.plusTard')}</Bouton>;
  } else if (etape === 'prix') {
    const prop = prixPayeArrivee(entree);
    const pose = etapes.find((e) => e.cle === 'prix').etat === 'fait';
    if (pose) plein = <Bouton variante="primaire" plein data-aa-suivant="prix" onClick={avancer}>{tr('arr.suivant')}</Bouton>;
    else if (prop && !corriger) plein = <Bouton variante="primaire" plein data-aa-prix-garder={prop.valeur} occupe={envoi} onClick={() => garderPrix(prop.valeur, prop.source === 'recu' ? 'recu' : 'achat')}>{tr('arr.prix.garder', { prix: monnaie(prop.centimes / 100) })}</Bouton>;
    else plein = <Bouton variante="primaire" plein data-aa-prix-enregistrer="" occupe={envoi} disabled={!saisie.trim()} onClick={() => garderPrix(saisie, 'tape')}>{tr('arr.enregistrer')}</Bouton>;
    second = pose ? null : <Bouton variante="secondaire" data-aa-plus-tard="prix" onClick={() => marquer('prix', 'passe')}>{tr('arr.plusTard')}</Bouton>;
  } else if (etape === 'fiche') {
    plein = <Bouton variante="primaire" plein data-aa-fiche-enregistrer="" occupe={envoi} onClick={enregistrerFiche}>{tr('arr.fiche.enregistrer')}</Bouton>;
    second = <Bouton variante="secondaire" data-aa-plus-tard="fiche" onClick={() => marquer('fiche', 'passe')}>{tr('arr.plusTard')}</Bouton>;
  } else if (etape === 'publier') {
    plein = etatVinted === 'en-ligne'
      ? <Bouton variante="primaire" plein data-aa-partout={fiche ? fiche.numero : ''} onClick={() => coque.publierPartout(fiche)}>{tr('arr.publier.partout')}</Bouton>
      : <Bouton variante="primaire" plein data-aa-creer-vinted={fiche ? fiche.numero : ''} onClick={() => coque.creerVinted(fiche)}>{tr(etatVinted === 'brouillon' ? 'arr.publier.mettreEnLigne' : 'arr.publier.creer')}</Bouton>;
    second = <Bouton variante="secondaire" data-aa-plus-tard="publier" onClick={() => marquer('publier', 'passe')}>{tr('arr.plusTard')}</Bouton>;
  } else if (fiche) {
    const encore = range && k + 1 < fiches.length;
    plein = <Bouton variante="primaire" plein data-aa-fin={encore ? 'article' : 'achat'} onClick={() => (encore ? setK(k + 1) : onSuivant())}>{encore ? tr('arr.fin.articleSuivant') : position ? tr('arr.fin.achatSuivant') : tr('arr.fin.fermer')}</Bouton>;
  }

  const titreAchat = (fiche && fiche.titre) || entree.titre || tr('ranger.sansTitre');
  const sous = [fiche ? `N°${fiche.numero}` : '', fiche ? caseFiche(fiche, etat.meubles) : '', fiches.length > 1 ? tr('arr.lot.article', { i: Math.min(k, fiches.length - 1) + 1, n: fiches.length }) : '', position].filter(Boolean).join(' · ');
  return (
    <>
      <div className="vrm-arr" data-aa-tx={entree.tx || ''} data-aa-fiche={fiche ? fiche.id : ''} data-aa-num={fiche ? fiche.numero : ''} data-aa-reprise={reprise || 'fini'}>
        <div className="vrm-arr-tete">
          <div className="vrm-arr-photo">{entree.photo && Photo ? <Photo src={entree.photo} alt=""/> : null}</div>
          <div className="vrm-arr-tete-txt"><b>{titreAchat}</b><small>{sous || tr('arr.sous.aNumeroter')}</small></div>
        </div>
        <Progression etapes={etapes} courante={etape === 'fin' ? '' : etape} onAller={aller} verrou={envoi}/>
        <h3 className="vrm-arr-h" data-aa-titre={etape}>{tr('arr.titre.' + etape)}</h3>
        {etape === 'case' && fiche ? <EtapeCase fiche={fiche} prop={propCase} place={place} setPlace={setPlace} meubles={etat.meubles} slots={etat.slots} Plan={Plan} erreur={erreur}/> : null}
        {etape === 'numero' ? <EtapeRanger entree={entree} prep={prep} lignes={lignes} setLignes={setLignes} courante={courante} setCourante={setCourante} n={n} setN={setN} etape={etape} Plan={Plan}/> : null}
        {attenteFiche ? <p className="vrm-arr-doux" data-aa-attente-fiche="">{tr('ranger.attente')}</p> : null}
        {etape === 'photos' && fiche ? <EtapePhotos fiche={fiche} photos={photos} vignettes={vignettes}/> : null}
        {etape === 'prix' && fiche ? <EtapePrix entree={entree} fiche={fiche} cout={etat.couts[String(fiche.numero)]} corriger={corriger} setCorriger={setCorriger} saisie={saisie} setSaisie={setSaisie} erreur={erreur}/> : null}
        {etape === 'fiche' && fiche && champs ? <EtapeFiche fiche={fiche} champs={champs} setChamps={setChamps} Note={Note} erreur={erreur}/> : null}
        {etape === 'publier' && fiche ? <EtapePublier etatVinted={etatVinted}/> : null}
        {etape === 'fin' && fiche ? (
          <div className="vrm-arr-corps" data-aa-corps="fin">
            <ul className="vrm-arr-bilan">
              {etapes.map((e) => <li key={e.cle} data-aa-bilan={e.cle} data-aa-etat={e.etat}><i aria-hidden="true" className={'is-' + e.etat}/>{tr('arr.etape.' + e.cle)}<span>{tr('arr.bilan.' + e.etat)}</span></li>)}
            </ul>
            {Note ? <div className="vrm-arr-note">{Note(fiche.numero)}</div> : null}
          </div>
        ) : null}
        {erreur && etape === 'numero' ? <p className="vrm-arr-refus" role="alert" data-aa-erreur={erreur}>{tr(['pris', 'case', 'deja', 'double', 'illisible', 'vide'].includes(erreur) ? 'ranger.refus.' + erreur : 'ranger.refus.lecture', { n: (lignes[0] && lignes[0].numero) || '' })}</p> : null}
      </div>
      <div className="vrm-fs-pied vrm-arr-pied">
        {plein}
        {second ? <div className="vrm-arr-pied-second">{second}</div> : null}
      </div>
    </>
  );
}

// La feuille : les achats retirés, un par un (« Plus tard » passe au suivant).
export default function AtelierArrivee({ entrees, coque, onFermer, Feuille, Bouton, Photo = null, Plan = null, Note = null }) {
  useLangue();
  const liste = Array.isArray(entrees) ? entrees.filter(Boolean) : [];
  const [idx, setIdx] = React.useState(0);
  const e = liste[idx];
  React.useEffect(() => { if (!e) onFermer(); }, [e]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!e) return null;
  const suivant = () => { if (idx + 1 < liste.length) setIdx(idx + 1); else onFermer(); };
  const position = liste.length > 1 ? tr('ranger.position', { i: idx + 1, n: liste.length }) : '';
  return (
    <Feuille titre={tr('arr.feuille')} onClose={onFermer} maxWidth={560} data-atelier-arrivee={liste.length}>
      <UnAchat key={(e.tx || e.suivi || (e.numeros || []).join(',') || 'x') + ':' + idx} entree={e} coque={coque} onSuivant={suivant} onFermer={onFermer} position={position} Bouton={Bouton} Photo={Photo} Plan={Plan} Note={Note}/>
    </Feuille>
  );
}
