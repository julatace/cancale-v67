// ══ « RELIER MES ANNONCES » — LE PARCOURS (19 nov.) ═════════════════════════════════════════════
// Une annonce à la fois, au téléphone d'abord : en haut l'annonce du site (photo, titre, taille, prix,
// compte) ; dessous les ARTICLES candidats, photo contre photo, du plus sûr au plus proche. TOUCHER une
// candidate relie (annulable 10 s, puis « Délier » depuis l'annonce) : aucun écran intermédiaire, aucune
// phrase à lire quand il n'y a pas de doute. Une question seulement quand il y a un vrai doute, et alors
// une seule. À l'ordinateur : trois volets (la file · l'annonce · les candidates), flèches, Entrée, Échap.
//
// Ce fichier ne lit ni n'écrit la base : l'état vient de src/liaisonEtat.js (calculé par l'app avec
// src/liaisonSites.js), chaque geste passe par `actions` (src/liaisonActions.js, App.jsx
// `ACTIONS_LIAISON`). Les gardes vivent dans la règle : ici on montre, on demande, on dit.
// Design « VRM natif » (docs/design/NATIF.md) : une page poussée (`PagePoussee`), `Groupe` / `Rangee`,
// `Bouton`, `Plaque`, `Vide`, `ChampRecherche` ; les cartes « photo contre photo » et les volets sont à
// cet écran (src/liaison-sites.css, jetons `--n-*`). Aucun style en ligne.
import React from 'react';
import { PhotoVide } from './composants/PhotoVide.jsx';
import { tr } from './i18n/index.js';
import { useLangue } from './i18n/react.js';
import { montant } from './format.js';
import { PagePoussee, Groupe, Rangee, Bouton, Plaque, Vide, ChampRecherche, Glyphe, poserIcone, iconePosee } from './natif/index.js';
import { lireLiaison, abonnerLiaison, lireReprise, noterReprise } from './liaisonEtat.js';
import { candidatesPour, sursDuLot, tailleDe, SITES_LIAISON } from './liaisonSites.js';
import './liaison-sites.css';

const PAR_PAGE = 12;
const prixTxt = (p) => (p != null && Number.isFinite(Number(p)) && Number(p) > 0 ? montant(Number(p)) : '');
const virgule = (t) => String(t || '').replace('.', ',');
const tailleTxt = (x) => { const t = tailleDe(x).taille; return t ? tr('lia.taille', { t: virgule(t) }) : ''; };
const dateCourte = (iso) => { const t = Date.parse(String(iso || '')); return Number.isFinite(t) ? new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : ''; };
const siteCompte = (a) => [a.plateforme, a.compteNom && a.compteNom !== a.plateforme ? a.compteNom : ''].filter(Boolean).join(' · ');
const origineTxt = (p) => [p.origine || 'Vinted', p.compteNom && p.compteNom !== p.origine ? p.compteNom : ''].filter(Boolean).join(' · ');
const cleEgale = (x, y) => String(x || '').toUpperCase() === String(y || '').toUpperCase();
const faits = (...l) => l.filter(Boolean).join(' · ');

function useEtatLiaison() {
  const [, maj] = React.useReducer((n) => n + 1, 0);
  React.useEffect(() => abonnerLiaison(maj), []);
  return lireLiaison();
}
// La photo d'une annonce, rendue par le lecteur de l'app (Vinted, Vestiaire…) dans un cadre carré.
function Photo2({ src, Photo, sorte = '' }) {
  return <span className="n-lia-photo" data-sorte={sorte || undefined}>{src && Photo ? Photo(src) : <PhotoVide remplir/>}</span>;
}
// Deux photos (ou trois) côte à côte, chacune avec sa légende : « photo contre photo ».
function Face({ children }) { return <div className="n-lia-face">{children}</div>; }
function Cote({ src, Photo, attrs = null, legende, sous = '', geste = null }) {
  return <figure className="n-lia-cote" {...(attrs || {})}><Photo2 src={src} Photo={Photo}/><figcaption className="n-lia-legende">{legende}{sous ? <span className="n-lia-legende-sous">{sous}</span> : null}</figcaption>{geste}</figure>;
}
const EtatPhoto = ({ etat, site }) => (etat === 'sur' ? <span className="n-lia-etat" data-ton="sur" data-liaison-niveau="sur"><span className="n-lia-diode" aria-hidden="true"/>{tr('lia.sur')}</span>
  : etat === 'verifier' ? <span className="n-lia-etat" data-ton="ambre" data-liaison-niveau="verifier"><span className="n-lia-point" aria-hidden="true"/>{tr('lia.memePhoto')}</span>
  : etat === 'publiee' ? <span className="n-lia-etat" data-ton="ambre" data-liaison-niveau="publiee"><span className="n-lia-point" aria-hidden="true"/>{tr('lia.publiee', { site })}</span> : null);

// ── La carte d'un ARTICLE candidat : la photo en grand, puis N° · prix · titre · taille · site · place. ──
// Toucher la carte — photo comprise — RELIE : la photo n'ouvre pas la visionneuse (`data-sans-visionneuse`, src/visionneuse.js).
function CarteCandidate({ c, annonce, Photo, focus, enCours, onRelier, refCarte }) {
  const p = c.paire;
  const t = tailleDe(p).taille, ta = tailleDe(annonce).taille;
  const etat = c.niveau === 'sur' ? 'sur' : c.niveau === 'verifier' ? (c.raison === 'publiee' ? 'publiee' : 'verifier') : '';
  return (
    <button type="button" ref={refCarte} className="n-lia-carte" data-sans-visionneuse="" data-focus={focus ? '1' : undefined} data-liaison-candidate={p.id} data-numero={p.numero} data-niveau={etat} data-proche={String(c.proche)}
      aria-disabled={enCours ? 'true' : undefined} aria-label={tr('lia.relier', { numero: p.numero })} onClick={() => { if (!enCours) onRelier(c); }}>
      <Photo2 src={p.photo} Photo={Photo}/>
      <EtatPhoto etat={etat} site={annonce.plateforme}/>
      <span className="n-lia-carte-tete"><Plaque numero={p.numero}/><span className="n-lia-carte-prix">{prixTxt(p.prix)}</span></span>
      <span className="n-lia-carte-titre">{p.titre || '—'}</span>
      <span className="n-lia-carte-sous">
        {t ? <span data-ton={t && ta && t !== ta ? 'ambre' : undefined} data-liaison-taille={t}>{tr('lia.taille', { t: virgule(t) })}</span> : null}
        <span>{origineTxt(p)}</span>
        {p.place ? <span data-liaison-place="">{p.place}</span> : null}
      </span>
    </button>
  );
}

// ── La question (UN vrai doute) ou le refus (expliqué), à la place des candidates. ──
function Question({ q, annonce, Photo, onReponse, onFermer }) {
  const p = q.paire, r = q.r, n = p.numero;
  const lignes = [];
  let boutons;
  if (q.sorte === 'demander') {
    lignes.push(tr('lia.q.deuxNumeros'));
    boutons = <>
      {r.numeros.map((x) => <Bouton key={x} large attrs={{ 'data-liaison-garder': x }} onClick={() => onReponse({ garder: x })}>{'N°' + x}</Bouton>)}
      <Bouton variante="texte" large attrs={{ 'data-liaison-question-non': '' }} onClick={onFermer}>{tr('lia.q.jeRegarde')}</Bouton>
    </>;
  } else if (q.sorte === 'confirmer') {
    for (const d of r.confirmer) {
      if (d === 'prix') lignes.push(tr('lia.q.prix', { a: prixTxt(annonce.prix), p: prixTxt(p.prix), numero: n }));
      if (d === 'marque') lignes.push(tr('lia.q.marque'));
      if (d === 'taille') lignes.push(tr('lia.q.taille', { a: virgule(r.tailleAnnonce), p: virgule(r.taillePaire), numero: n }));
      if (d === 'reference') lignes.push(tr('lia.q.reference', { ecrit: r.numeroEcrit, numero: n }));
    }
    boutons = <>
      <Bouton large attrs={{ 'data-liaison-question-oui': '' }} onClick={() => onReponse({ doutes: true })}>{tr('lia.q.oui', { numero: n })}</Bouton>
      <Bouton variante="texte" large attrs={{ 'data-liaison-question-non': '' }} onClick={onFermer}>{tr('lia.q.non')}</Bouton>
    </>;
  } else {
    const site = annonce.plateforme;
    lignes.push(r.refus === 'taille' ? tr('lia.r.taille', { a: virgule(r.tailleAnnonce), p: virgule(r.taillePaire), numero: n })
      : r.refus === 'annonce-reliee' ? tr('lia.r.annonceReliee', { numero: r.numero || '' })
      : r.refus === 'paire-prise' ? tr('lia.r.pairePrise', { numero: n, site })
      : r.refus === 'numero-double' ? tr('lia.r.numeroDouble', { numero: r.numero || n })
      : r.refus === 'sans-numero' ? tr('lia.r.sansNumero')
      : r.refus === 'garder-vinted' ? tr('lia.r.garderVinted', { numero: r.numero, garder: r.garder })
      : r.refus === 'ecrit-sur-le-site' ? tr('lia.r.ecrit', { site })
      : r.refus === 'numero-servi' ? tr('lia.r.numeroServi', { numero: r.numero || '' })
      : tr('lia.r.pasSu'));
    boutons = <>
      {r.refus === 'paire-prise' && r.declarable ? <Bouton large attrs={{ 'data-liaison-declarer': '' }} onClick={() => onReponse({ plusieurs: true })}>{tr('lia.r.declarer')}</Bouton> : null}
      <Bouton variante="texte" large attrs={{ 'data-liaison-question-non': '' }} onClick={onFermer}>{tr('lia.r.ok')}</Bouton>
    </>;
  }
  const autre = q.sorte === 'refus' && r.refus === 'paire-prise' ? r.autre : null;
  return (
    <section className="n-lia-bloc" role="alertdialog" aria-label={lignes[0]} data-liaison-question={q.sorte} data-liaison-refus={q.sorte === 'refus' ? r.refus : undefined} data-liaison-doutes={q.sorte === 'confirmer' ? r.confirmer.join(' ') : undefined}>
      <Face>
        <Cote src={annonce.photo} Photo={Photo} legende={faits(siteCompte(annonce), tailleTxt(annonce), prixTxt(annonce.prix))}/>
        {p.id != null ? <Cote src={p.photo} Photo={Photo} legende={<><Plaque numero={n}/> {faits(tailleTxt(p), prixTxt(p.prix))}</>}/> : null}
        {autre ? <Cote src={autre.photo} Photo={Photo} legende={tr('lia.r.autreAnnonce', { site: autre.plateforme })}/> : null}
      </Face>
      {lignes.map((l, i) => <p key={i} className="n-lia-phrase">{l}</p>)}
      <div className="n-lia-gestes">{boutons}</div>
    </section>
  );
}

// ── Les liens qui se contredisent : les deux côtés montrés, il garde ou délie. ──
function Contradiction({ c, Photo, enCours, onGarder, onDelier, onRemplacer }) {
  const a0 = c.annonces[0];
  const titre = c.type === 'deux-numeros' ? tr('lia.c.deuxNumeros')
    : c.type === 'deux-annonces' ? tr('lia.c.deuxAnnonces', { site: c.plateforme, numero: c.numeros[0] })
    : c.type === 'taille' ? tr('lia.c.taille', { a: virgule(c.tailleAnnonce), p: virgule(c.taillePaire) })
    : c.type === 'prix' ? tr('lia.c.prix')
    : tr('lia.c.orphelin', { numero: c.numeros[0] });
  const srcDe = (n) => (c.identites || []).filter((i) => i.numero === n).map((i) => tr('lia.c.src.' + i.sorte)).join(' · ');
  return (
    <section className="n-lia-bloc" data-liaison-contradiction={c.id} data-type={c.type}>
      <h3 className="n-lia-bloc-titre"><span className="n-lia-point" aria-hidden="true"/>{titre}</h3>
      <Face>
        {c.annonces.map((a) => <Cote key={a.id} src={a.photo} Photo={Photo} attrs={{ 'data-liaison-cote': `annonce:${a.id}` }} legende={faits(siteCompte(a), tailleTxt(a), prixTxt(a.prix))} sous={a.titre}
          geste={c.type === 'deux-annonces' ? <Bouton large indisponible={enCours} attrs={{ 'data-liaison-garder-annonce': a.id }} onClick={() => onDelier(c.annonces.filter((x) => x !== a))}>{tr('lia.c.garder')}</Bouton> : null}/>)}
        {c.type !== 'deux-annonces' ? c.numeros.map((n, i) => {
          const p = c.paires[i];
          return <Cote key={n} src={p && p.photo} Photo={Photo} attrs={{ 'data-liaison-cote': `numero:${n}` }} legende={<><Plaque numero={n}/> {p ? faits(tailleTxt(p), prixTxt(p.prix)) : ''}</>} sous={c.type === 'deux-numeros' ? srcDe(n) : (p && p.titre) || ''}
            geste={c.type !== 'deux-numeros' ? null : cleEgale(a0.numero, n)
              ? <Bouton large indisponible={enCours} attrs={{ 'data-liaison-garder-numero': n }} onClick={() => onGarder(c, n)}>{tr('lia.c.garder')}</Bouton>
              : p ? <Bouton large indisponible={enCours} attrs={{ 'data-liaison-cest': n }} onClick={() => onRemplacer(a0, p)}>{tr('lia.c.cestLui', { numero: n })}</Bouton> : null}/>;
        }) : null}
      </Face>
      <div className="n-lia-gestes">
        {c.type === 'deux-annonces' ? <Bouton variante="texte" large indisponible={enCours} attrs={{ 'data-liaison-les-deux': '' }} onClick={() => onGarder(c, 'les-deux')}>{tr('lia.c.lesDeux')}</Bouton> : null}
        {['taille', 'prix', 'orphelin'].includes(c.type) ? <Bouton large indisponible={enCours} attrs={{ 'data-liaison-garder-lien': '' }} onClick={() => onGarder(c, 'garder')}>{tr('lia.c.garderLien')}</Bouton> : null}
        {c.type !== 'deux-annonces' ? <Bouton variante="texte" large indisponible={enCours} attrs={{ 'data-liaison-delier': a0.id }} onClick={() => onDelier([a0])}>{tr('lia.c.delier')}</Bouton> : null}
      </div>
    </section>
  );
}

export default function LiaisonSites({ cible, actions, Photo, Icon = null, onFermer }) {
  useLangue();
  if (Icon && !iconePosee()) poserIcone(Icon);   // les glyphes du natif (chevron, loupe, coche) sont les icônes de l'app
  const res = useEtatLiaison();
  const [vue, setVue] = React.useState(cible.vue === 'contradictions' ? 'contradictions' : 'file');
  const [courant, setCourant] = React.useState(null);
  const [q, setQ] = React.useState('');
  const [sansTaille, setSansTaille] = React.useState(false);
  const [limite, setLimite] = React.useState(PAR_PAGE);
  const [question, setQuestion] = React.useState(null);
  const [focus, setFocus] = React.useState(-1);
  const [enCours, setEnCours] = React.useState(false);
  const [dernier, setDernier] = React.useState(null);            // { cle, numero, etat: 'attente'|'verifie'|'autre'|'pas-su' }
  const [traitees, setTraitees] = React.useState(() => new Map()); // clé ⇒ heure du geste (l'écran avance sans attendre la relecture)
  const [lotCoches, setLotCoches] = React.useState(null);        // Set des clés cochées dans la relecture du lot
  const [lotVu, setLotVu] = React.useState(false);
  const total0 = React.useRef(null);
  const refFinLot = React.useRef(null), refRacine = React.useRef(null);
  const refCartes = React.useRef([]);

  React.useEffect(() => { actions.charger(true); }, [actions]);
  // Un geste annulé (« Annuler » de la pilule) : l'annonce revient dans la file, l'écran aussi.
  React.useEffect(() => {
    if (!res || !res.lu || !traitees.size) return;
    let change = false; const m = new Map(traitees);
    for (const [k, t] of traitees) { const e = res.parCle.get(k); if (e && e.etat === 'aRelier' && !e.plusTard && res.at > t + 1500) { m.delete(k); change = true; } }
    if (change) setTraitees(m);
  }, [res]);   // eslint-disable-line react-hooks/exhaustive-deps

  const lu = !!(res && res.lu);
  const duSite = (e) => !cible.site || e.annonce.plateforme === cible.site;
  const file = lu ? res.file.filter((e) => duSite(e) && !traitees.has(e.cle)) : [];
  // « Plus tard » : relu de la règle, même si l'annonce vient d'être écartée de la file par SON geste (sinon la fin l'oublie).
  const aFaire = file.filter((e) => !e.plusTard), tard = lu ? res.file.filter((e) => duSite(e) && e.plusTard) : [];
  const contras = lu ? res.contradictions.filter((c) => !cible.site || c.plateforme === cible.site) : [];
  if (lu && total0.current == null) total0.current = aFaire.length;
  const nFaits = traitees.size;
  const total = Math.max(total0.current || 0, nFaits + aFaire.length);

  // L'annonce montrée : celle demandée, sinon là où il s'est arrêté, sinon la première.
  // Une annonce DEMANDÉE absente d'un calcul d'avant l'ouverture (il a pu être fait sans elle) : on attend le calcul relancé
  // à l'ouverture, jamais une autre annonce à sa place (sinon « Relier » d'une rangée montrerait la mauvaise annonce).
  const ouvertA = React.useRef(Date.now());
  React.useEffect(() => {
    if (!lu || courant) return;
    if (cible.id && cible.site) { const k = `${cible.site}:${cible.id}`; if (res.parCle.has(k)) { setCourant(k); return; } if (!(res.at >= ouvertA.current)) return; }
    if (vue !== 'file') return;
    const rep = lireReprise();
    const e = aFaire.find((x) => x.cle === rep) || aFaire[0] || null;
    if (e) setCourant(e.cle);
  }, [lu, courant, res && res.at]);   // eslint-disable-line react-hooks/exhaustive-deps
  const entree = lu && courant ? res.parCle.get(courant) || null : null;
  const dansFile = !!(entree && entree.etat === 'aRelier' && !traitees.has(entree.cle));
  React.useEffect(() => { if (dansFile) noterReprise(courant); }, [courant, dansFile]);
  const haut = () => { const el = refRacine.current && refRacine.current.closest('.n-poussee'); if (el) el.scrollTop = 0; };
  React.useEffect(() => { setQ(''); setSansTaille(false); setLimite(PAR_PAGE); setQuestion(null); setFocus(-1); haut(); }, [courant, vue]);

  const tailleAnnonce = entree ? tailleDe(entree.annonce).taille : '';
  const puceTaille = !!tailleAnnonce && !sansTaille && !q.trim();
  const candidates = React.useMemo(() => (dansFile ? candidatesPour(entree, res.articles, { q, taille: puceTaille ? tailleAnnonce : '', autres: res.autres || [] }) : []),
    [dansFile, entree, res, q, puceTaille, tailleAnnonce]);
  const montrees = candidates.slice(0, limite);
  const avant = dansFile && entree.avant && !q.trim() ? candidates.find((c) => String(c.paire.id) === entree.avant) || null : null;
  React.useEffect(() => { setFocus(avant ? 0 : -1); }, [courant, !!avant]);   // eslint-disable-line react-hooks/exhaustive-deps

  const suivante = (apres) => { const l = aFaire.filter((e) => e.cle !== apres); const i = aFaire.findIndex((e) => e.cle === apres); return l[i] || l[0] || null; };
  const avancer = (cleFaite) => { const s = suivante(cleFaite); if (s) setCourant(s.cle); else { setCourant(null); noterReprise(''); setVue('fin'); } };
  const marquer = (k) => setTraitees((m) => new Map(m).set(k, Date.now()));
  const suivreLien = (k, numero) => {
    setDernier({ cle: k, numero, etat: 'attente' });
    Promise.resolve(actions.verifier({ cle: k, numero })).then((v) => setDernier((d) => (d && d.cle === k ? { ...d, etat: v || 'pas-su' } : d))).catch(() => setDernier((d) => (d && d.cle === k ? { ...d, etat: 'pas-su' } : d)));
  };
  const preuveDe = (c) => (c.niveau === 'sur' ? 'photo-sure' : c.niveau === 'verifier' && c.raison !== 'publiee' ? 'photo' : 'recherche');

  // RELIER : SON toucher sur une candidate. Tout va bien ⇒ c'est fait, annonce suivante. Un doute ⇒ UNE question.
  const relier = async (c, accepte = {}) => {
    if (enCours || !entree) return;
    setEnCours(true);
    try {
      const r = await actions.relier({ annonce: entree.annonce, paire: c.paire, preuve: preuveDe(c), accepte });
      if (r && r.ok) { const k = entree.cle; setQuestion(null); marquer(k); suivreLien(k, r.numero); avancer(k); }
      else if (r && r.demander) { setQuestion({ sorte: 'demander', c, paire: c.paire, r, accepte }); haut(); }
      else if (r && r.confirmer) { setQuestion({ sorte: 'confirmer', c, paire: c.paire, r, accepte }); haut(); }
      else { setQuestion({ sorte: 'refus', c, paire: c.paire, r: r || { refus: 'pas-su' }, accepte }); haut(); }
    } catch (_) { setQuestion({ sorte: 'refus', c, paire: c.paire, r: { refus: 'pas-su' }, accepte }); } finally { setEnCours(false); }
  };
  const sortir = async (quoi) => {
    if (enCours || !entree) return;
    setEnCours(true);
    try {
      const k = entree.cle;
      if (quoi === 'aucune') { await actions.pasCellesCi({ entree }); setLimite(PAR_PAGE); const ch = refRacine.current && refRacine.current.querySelector('[data-liaison-chercher]'); if (ch) ch.focus(); return; }
      const r = quoi === 'tard' ? await actions.plusTard({ annonce: entree.annonce }) : await actions.propre({ annonce: entree.annonce });
      if (r && r.ok) { marquer(k); avancer(k); } else setQuestion({ sorte: 'refus', c: null, paire: { numero: '' }, r: r || { refus: 'pas-su' } });
    } finally { setEnCours(false); }
  };
  const delier = async (annonces) => { if (enCours) return; setEnCours(true); try { for (const a of annonces) await actions.delier({ annonce: a }); } finally { setEnCours(false); } };

  // ── Le lot « Relier les N sûres » ──
  const surs = lu ? sursDuLot(res).filter((e) => duSite(e) && !traitees.has(e.cle)) : [];
  const ouvrirLot = () => { setLotCoches(new Set(surs.map((e) => e.cle))); setLotVu(false); setVue('lot'); };
  React.useEffect(() => {
    if (vue !== 'lot') return undefined;
    if (!refFinLot.current || typeof IntersectionObserver === 'undefined') { setLotVu(true); return undefined; }
    const o = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) setLotVu(true); }, { threshold: 0.6 });
    o.observe(refFinLot.current);
    return () => o.disconnect();
  }, [vue, surs.length]);
  const relierLot = async () => {
    if (enCours || !lotCoches || !lotVu || !lotCoches.size) return;
    setEnCours(true);
    try {
      const r = await actions.relierLot({ entrees: surs.filter((e) => lotCoches.has(e.cle)) });
      if (r && r.ok) { setTraitees((m) => { const n = new Map(m); for (const f of r.faits) n.set(f.cle, Date.now()); return n; }); const der = r.faits[r.faits.length - 1]; if (der) suivreLien(der.cle, der.numero); }
      setLotCoches(null); setCourant(null); setVue('file');
    } finally { setEnCours(false); }
  };
  // Après le lot (ou un retour dans la file) : reprendre sur la première annonce restante.
  React.useEffect(() => { if (vue === 'file' && lu && !courant) { const e = aFaire[0]; if (e) setCourant(e.cle); else if (total0.current != null) setVue('fin'); } }, [vue, lu, courant, aFaire.length]);   // eslint-disable-line react-hooks/exhaustive-deps

  const retour = () => { if (question) { setQuestion(null); return; } if (vue === 'lot' || (vue === 'contradictions' && cible.vue !== 'contradictions')) { setVue(aFaire.length ? 'file' : 'fin'); return; } onFermer(); };
  // ── Le clavier : ← → la candidate, ↑ ↓ l'annonce, Entrée relie, « / » cherche, Échap revient. ──
  React.useEffect(() => {
    const f = (e) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const champ = e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); retour(); return; }
      if (vue !== 'file' || !dansFile || question) return;
      if (e.key === '/' && !champ) { e.preventDefault(); const ch = refRacine.current && refRacine.current.querySelector('[data-liaison-chercher]'); if (ch) ch.focus(); return; }
      if (champ && !['ArrowDown', 'ArrowUp', 'Enter'].includes(e.key)) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); setFocus((i) => Math.max(0, Math.min(montrees.length - 1, i < 0 ? 0 : i + (e.key === 'ArrowRight' ? 1 : -1)))); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); const i = aFaire.findIndex((x) => x.cle === courant); const s = aFaire[i + (e.key === 'ArrowDown' ? 1 : -1)]; if (s) setCourant(s.cle); return; }
      if (e.key === 'Enter' && focus >= 0 && montrees[focus]) { e.preventDefault(); relier(montrees[focus]); }
    };
    window.addEventListener('keydown', f, true);
    return () => window.removeEventListener('keydown', f, true);
  });
  React.useEffect(() => { const el = refCartes.current[focus]; if (el && el.scrollIntoView) { try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (_) { /* vieux navigateur */ } } }, [focus]);

  const vueRendue = entree && !dansFile && vue === 'file' ? 'annonce' : vue === 'file' && !entree && lu ? 'fin' : vue;
  const titre = vue === 'contradictions' ? tr('lia.c.titre') : vue === 'lot' ? tr('lia.lot.titre', { n: surs.length }) : tr('lia.titre');
  const position = vue === 'file' && dansFile && total > 0 ? tr('lia.progress', { k: Math.min(total, nFaits + 1), n: total }) : '';
  const illisibles = lu ? (res.illisibles || []).filter((s) => !cible.site || s === cible.site) : [];
  const vignette = (src) => <span className="n-lia-photo" data-sorte="rangee">{src && Photo ? Photo(src) : <PhotoVide remplir/>}</span>;

  let corps, plein = null;
  if (!res) corps = <p className="n-lia-note" data-liaison-attente="">{tr('lia.lecture')}</p>;
  else if (!lu) corps = <div data-liaison-pas-su=""><Vide phrase={tr('lia.pasLuTitre')} detail={res.paires == null ? tr('lia.vintedPasLu') : tr('lia.pasLu', { sites: SITES_LIAISON.join(' · ') })} action={<Bouton attrs={{ 'data-liaison-relire': '' }} onClick={() => actions.charger(true)}>{tr('lia.relire')}</Bouton>}/></div>;
  else if (vue === 'contradictions') {
    corps = contras.length ? <div className="n-lia-colonne" data-liaison-contradictions={contras.length}>
      {contras.map((c) => <Contradiction key={c.id} c={c} Photo={Photo} enCours={enCours}
        onGarder={(cc, choix) => actions.garder({ contradiction: cc, choix })} onDelier={delier}
        onRemplacer={(a, p) => actions.remplacer({ annonce: a, paire: p })}/>)}
    </div> : <div data-liaison-contradictions="0"><Vide icone={<Glyphe nom="check" taille={40}/>} phrase={tr('lia.c.rien')}/></div>;
  } else if (vue === 'lot') {
    corps = <div className="n-lia-colonne" data-liaison-lot={surs.length}>
      {surs.map((e) => { const c = e.candidats.find((x) => String(x.paire.id) === e.avant); const on = !!(lotCoches && lotCoches.has(e.cle)); return (
        <label key={e.cle} className="n-lia-lot-ligne" data-sans-visionneuse="" data-liaison-lot-ligne={e.cle} data-coche={on ? '1' : '0'}>
          <Photo2 src={e.annonce.photo} Photo={Photo}/>
          <Photo2 src={c.paire.photo} Photo={Photo}/>
          <span className="n-lia-lot-textes"><Plaque numero={c.paire.numero}/><span className="n-lia-carte-titre">{e.annonce.titre || '—'}</span><span className="n-lia-carte-sous"><span>{siteCompte(e.annonce)}</span></span></span>
          <input type="checkbox" className="n-lia-coche" checked={on} onChange={() => setLotCoches((s0) => { const n = new Set(s0); if (n.has(e.cle)) n.delete(e.cle); else n.add(e.cle); return n; })} aria-label={tr('lia.relier', { numero: c.paire.numero })}/>
        </label>); })}
      <span ref={refFinLot} className="n-lia-lot-fin" aria-hidden="true"/>
    </div>;
    const nb = lotCoches ? lotCoches.size : 0;
    plein = <Bouton variante="plein" chargement={enCours} indisponible={!lotVu || !nb} raison={!lotVu ? tr('lia.lot.defile') : ''} attrs={{ 'data-liaison-lot-valider': String(nb), 'data-vu': lotVu ? '1' : '0' }} onClick={relierLot}>{tr('lia.lot.valider', { n: nb })}</Bouton>;
  } else if (vueRendue === 'annonce') {
    // Une annonce reliée, ou « que sur ce site » : son lien, sa preuve, « Délier ».
    const a = entree.annonce;
    const article = res.articles.find((p) => cleEgale(p.numero, entree.numero) && String(p.id) !== entree.cle) || null;
    corps = <div className="n-lia-colonne" data-liaison-fiche={entree.cle} data-etat={entree.etat}>
      <section className="n-lia-bloc">
        <Face>
          <Cote src={a.photo} Photo={Photo} legende={siteCompte(a)} sous={a.titre}/>
          {article ? <Cote src={article.photo} Photo={Photo} legende={<><Plaque numero={article.numero}/> {origineTxt(article)}</>} sous={article.titre}/> : null}
        </Face>
        <p className="n-lia-phrase" data-liaison-fiche-etat={entree.etat}>
          {entree.etat === 'propre' ? (entree.numero ? tr('liaE.seuleNumero', { site: a.plateforme, numero: entree.numero }) : tr('liaE.seule', { site: a.plateforme })) : entree.etat === 'aVerifier' ? tr('liaE.aVerifier') : tr('liaE.relie', { numero: entree.numero })}
          {entree.etat === 'relie' && entree.preuve ? <span className="n-lia-legende-sous">{faits(tr('lia.preuve.' + entree.preuve), dateCourte(entree.lieLe))}</span> : null}
        </p>
        <div className="n-lia-gestes">
          {entree.etat === 'relie' ? <Bouton variante="texte" large indisponible={enCours} attrs={{ 'data-liaison-delier': a.id }} onClick={async () => { setEnCours(true); try { const r = await actions.delier({ annonce: a }); if (r && r.refus) setQuestion({ sorte: 'refus', c: null, paire: { numero: entree.numero }, r }); } finally { setEnCours(false); } }}>{tr('lia.c.delier')}</Bouton> : null}
          {entree.etat === 'propre' ? <Bouton variante="texte" large indisponible={enCours} attrs={{ 'data-liaison-reprendre': a.id }} onClick={() => actions.propre({ annonce: a, annuler: true })}>{tr('lia.fin.reprendre')}</Bouton> : null}
          {entree.etat === 'aVerifier' ? <Bouton large attrs={{ 'data-liaison-voir-contradictions': '' }} onClick={() => setVue('contradictions')}>{tr('lia.c.titre')}</Bouton> : null}
        </div>
      </section>
      {question ? <Question q={question} annonce={a} Photo={Photo} onReponse={() => setQuestion(null)} onFermer={() => setQuestion(null)}/> : null}
    </div>;
  } else if (vueRendue === 'fin') {
    const reste = aFaire.length;
    corps = <div className="n-lia-colonne" data-liaison-fin="" data-reste={reste} data-plus-tard={tard.length} data-contradictions={contras.length}>
      <Vide icone={<Glyphe nom="check" taille={40}/>} phrase={reste ? tr('lia.fin.reste', { n: reste }) : res.entrees.filter(duSite).length ? tr('lia.fin.titre') : tr('lia.vide')}
        action={reste ? <Bouton attrs={{ 'data-liaison-reprendre': '' }} onClick={() => { setCourant(aFaire[0].cle); setVue('file'); }}>{tr('lia.fin.reprendre')}</Bouton> : null}/>
      {contras.length ? <Groupe><Rangee titre={tr('liaE.aVerifierN', { n: contras.length })} fin="chevron" ton="ambre" attrs={{ 'data-liaison-fin-contradictions': String(contras.length) }} onClick={() => setVue('contradictions')}/></Groupe> : null}
      {tard.length ? <Groupe titre={tr('lia.fin.plusTard')}>
        {tard.map((e) => <Rangee key={e.cle} vignette={vignette(e.annonce.photo)} titre={e.annonce.titre || '—'} sousTitre={siteCompte(e.annonce)} fin="chevron" attrs={{ 'data-liaison-tard': e.cle }}
          onClick={async () => { await actions.plusTard({ annonce: e.annonce, annuler: true }); setTraitees((m) => { const n = new Map(m); n.delete(e.cle); return n; }); setCourant(e.cle); setVue('file'); }}/>)}
      </Groupe> : null}
      {illisibles.length ? <p className="n-lia-note" data-liaison-illisibles={illisibles.join(' ')}>{tr('lia.pasLu', { sites: illisibles.join(' · ') })}</p> : null}
    </div>;
  } else if (entree) {
    const a = entree.annonce;
    refCartes.current = [];
    corps = <div className="n-lia-volets">
      <aside className="n-lia-file" aria-label={tr('lia.file')} data-liaison-file={aFaire.length}>
        <Groupe>{aFaire.map((e) => <Rangee key={e.cle} vignette={vignette(e.annonce.photo)} titre={e.annonce.titre || '—'} sousTitre={faits(e.annonce.plateforme, e.avant ? tr('lia.sur') : '')} selectionnee={e.cle === courant} attrs={{ 'data-liaison-file-ligne': e.cle, 'data-sans-visionneuse': '' }} onClick={() => setCourant(e.cle)}/>)}</Groupe>
      </aside>
      <section className="n-lia-annonce" data-liaison-annonce={entree.cle} data-liaison-site={a.plateforme}>
        <Photo2 src={a.photo} Photo={Photo} sorte="annonce"/>
        <div className="n-lia-annonce-textes">
          <span className="n-lia-annonce-site">{siteCompte(a)}</span>
          <h2 className="n-lia-annonce-titre">{a.titre || '—'}</h2>
          <span className="n-lia-annonce-faits">{faits(tailleTxt(a), prixTxt(a.prix), entree.numeroSite ? 'N°' + entree.numeroSite : '')}</span>
          {a.lien ? <a className="n-lia-annonce-lien" href={a.lien} target="_blank" rel="noopener noreferrer">{tr('lia.ouvrir')} ↗</a> : null}
        </div>
      </section>
      <section className="n-lia-candidates" data-liaison-candidates={candidates.length}>
        {question ? <Question q={question} annonce={a} Photo={Photo} onReponse={(acc) => relier(question.c, { ...question.accepte, ...acc })} onFermer={() => setQuestion(null)}/> : <>
          {avant ? (
            <div className="n-lia-avant" data-liaison-avant={avant.paire.id}>
              <Face>
                <Cote src={a.photo} Photo={Photo} legende={a.plateforme}/>
                <Cote src={avant.paire.photo} Photo={Photo} legende={<><Plaque numero={avant.paire.numero}/> {faits(origineTxt(avant.paire), avant.paire.place)}</>}/>
              </Face>
              <EtatPhoto etat="sur"/>
            </div>
          ) : null}
          <div className="n-lia-cherche">
            <ChampRecherche valeur={q} onChange={(v) => { setQ(v); setLimite(PAR_PAGE); setFocus(-1); }} placeholder={tr('lia.chercher')} attrs={{ 'data-liaison-chercher': '' }}/>
            {tailleAnnonce && !q.trim() ? <Bouton variante={sansTaille ? 'texte' : 'teinte'} attrs={{ 'aria-pressed': sansTaille ? 'false' : 'true', 'data-liaison-puce-taille': tailleAnnonce }} onClick={() => { setSansTaille((v) => !v); setLimite(PAR_PAGE); }}>{tr('lia.taille', { t: virgule(tailleAnnonce) })}</Bouton> : null}
          </div>
          <div className="n-lia-grille" role="list" data-liaison-grille={montrees.length}>
            {montrees.filter((c) => c !== avant).map((c, i) => <CarteCandidate key={c.paire.id} c={c} annonce={a} Photo={Photo} focus={focus === i + (avant ? 1 : 0)} enCours={enCours} onRelier={relier} refCarte={(el) => { refCartes.current[i + (avant ? 1 : 0)] = el; }}/>)}
          </div>
          {!candidates.length ? <p className="n-lia-note" data-liaison-aucune="">{puceTaille ? tr('lia.aucuneTaille', { t: virgule(tailleAnnonce) }) : tr('lia.aucune')}</p> : null}
          {candidates.length > limite ? <Bouton variante="texte" large attrs={{ 'data-liaison-plus': '' }} onClick={() => setLimite((l) => l + PAR_PAGE * 2)}>{tr('lia.voirPlus', { n: candidates.length - limite })}</Bouton> : null}
          {res.vintedPartiel ? <p className="n-lia-note" data-liaison-vinted-partiel="">{tr('lia.vintedPartiel')}</p> : null}
        </>}
      </section>
    </div>;
    // Le bas de la page : LE plein quand une candidate est mise en avant (« sûr »), puis les sorties.
    plein = question ? null : <>
      {avant ? <Bouton variante="plein" chargement={enCours} attrs={{ 'data-liaison-relier-avant': avant.paire.id, 'data-numero': avant.paire.numero }} onClick={() => relier(avant)}>{tr('lia.relier', { numero: avant.paire.numero })}</Bouton> : null}
      <div className="n-lia-sorties" data-liaison-pied="file">
        {entree.candidats.some((c) => c.raison !== 'publiee') ? <Bouton variante="texte" indisponible={enCours} attrs={{ 'data-liaison-sortie': 'aucune' }} onClick={() => sortir('aucune')}>{tr('lia.s.aucune')}</Bouton> : null}
        <Bouton variante="texte" indisponible={enCours} attrs={{ 'data-liaison-sortie': 'propre' }} onClick={() => sortir('propre')}>{tr('lia.s.propre', { site: a.plateforme })}</Bouton>
        <Bouton variante="texte" indisponible={enCours} attrs={{ 'data-liaison-sortie': 'tard' }} onClick={() => sortir('tard')}>{tr('lia.s.plusTard')}</Bouton>
      </div>
    </>;
  } else corps = <p className="n-lia-note" data-liaison-attente="">{tr('lia.lecture')}</p>;

  return (
    <PagePoussee ouverte titre={titre} onRetour={retour} plein={plein} className="n-lia" actions={position ? <span className="n-lia-position">{position}</span> : null}
      attrs={{ 'data-liaison': '', 'data-liaison-vue': vueRendue, 'data-liaison-lu': lu ? '1' : res ? '0' : '', 'data-liaison-position': position }}>
      <div ref={refRacine} className="n-lia-corps" data-vue={vueRendue}>
        {vue === 'file' && lu && (surs.length >= 2 || dernier || contras.length) ? (
          <div className="n-lia-bande" data-liaison-bande="">
            {dernier ? <span className="n-lia-dernier" role="status" data-ton={dernier.etat === 'autre' ? 'ambre' : dernier.etat === 'verifie' ? 'sur' : undefined} data-liaison-dernier={dernier.etat} data-numero={dernier.numero}>
              {tr('lia.verif.' + (dernier.etat === 'verifie' ? 'verifie' : dernier.etat === 'autre' ? 'autre' : dernier.etat === 'attente' ? 'attente' : 'passu'), { numero: dernier.numero })}
            </span> : null}
            {dernier && dernier.etat === 'autre' ? <Bouton variante="texte" onClick={() => setVue('contradictions')}>{tr('lia.voir')}</Bouton> : null}
            {surs.length >= 2 ? <Bouton attrs={{ 'data-liaison-lot-ouvrir': String(surs.length) }} onClick={ouvrirLot}>{tr('lia.lot.ouvrir', { n: surs.length })}</Bouton> : null}
            {contras.length && !dernier ? <Bouton variante="texte" attrs={{ 'data-liaison-voir-contradictions': String(contras.length) }} onClick={() => setVue('contradictions')}>{tr('liaE.aVerifierN', { n: contras.length })}</Bouton> : null}
          </div>
        ) : null}
        {corps}
      </div>
    </PagePoussee>
  );
}
