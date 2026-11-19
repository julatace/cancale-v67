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
// Design « VRM natif » (docs/design/NATIF.md) : une page poussée, classes `n-lia-*`, jetons `--n-*`.
import React from 'react';
import { createPortal } from 'react-dom';
import { PhotoVide } from './composants/PhotoVide.jsx';
import { tr } from './i18n/index.js';
import { useLangue } from './i18n/react.js';
import { montant } from './format.js';
import { lireLiaison, abonnerLiaison, lireReprise, noterReprise } from './liaisonEtat.js';
import { candidatesPour, sursDuLot, tailleDe, SITES_LIAISON } from './liaisonSites.js';
import './liaison-sites.css';

const PAR_PAGE = 12;
const prixTxt = (p) => (p != null && Number.isFinite(Number(p)) && Number(p) > 0 ? montant(Number(p)) : '');
const tailleTxt = (x) => { const t = tailleDe(x).taille; return t ? tr('lia.taille', { t: t.replace('.', ',') }) : ''; };
const dateCourte = (iso) => { const t = Date.parse(String(iso || '')); return Number.isFinite(t) ? new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : ''; };
const siteCompte = (a) => [a.plateforme, a.compteNom && a.compteNom !== a.plateforme ? a.compteNom : ''].filter(Boolean).join(' · ');
const origineTxt = (p) => [p.origine || 'Vinted', p.compteNom && p.compteNom !== p.origine ? p.compteNom : ''].filter(Boolean).join(' · ');

function useEtatLiaison() {
  const [, maj] = React.useReducer((n) => n + 1, 0);
  React.useEffect(() => abonnerLiaison(maj), []);
  return lireLiaison();
}
function Vignette({ src, Photo, className = '' }) {
  return <span className={`n-lia-photo ${className}`}>{src && Photo ? Photo(src) : <PhotoVide remplir/>}</span>;
}
const Plaque = ({ numero }) => (numero ? <span className="n-lia-plaque" data-plaque={numero}>N°{numero}</span> : null);
const Coche = () => <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M5 10.5l3.2 3.2L15 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>;

// ── La carte d'un ARTICLE candidat : la photo en grand, puis N° · taille · prix · site · place. ──
function CarteCandidate({ c, annonce, Photo, focus, enCours, onRelier, refCarte }) {
  const p = c.paire;
  const t = tailleDe(p).taille, ta = tailleDe(annonce).taille;
  const autreTaille = !!(t && ta && t !== ta);
  const etat = c.niveau === 'sur' ? 'sur' : c.niveau === 'verifier' ? (c.raison === 'publiee' ? 'publiee' : 'verifier') : '';
  return (
    <button type="button" ref={refCarte} className={`n-lia-carte${focus ? ' is-focus' : ''}`} data-liaison-candidate={p.id} data-numero={p.numero} data-niveau={etat} data-proche={String(c.proche)}
      disabled={enCours} aria-label={tr('lia.relier', { numero: p.numero })} onClick={() => onRelier(c)}>
      <Vignette src={p.photo} Photo={Photo} className="is-carte"/>
      {etat === 'sur' ? <span className="n-lia-etat is-sur" data-liaison-niveau="sur"><span className="n-lia-diode" aria-hidden="true"/>{tr('lia.sur')}</span>
        : etat === 'verifier' ? <span className="n-lia-etat is-verifier" data-liaison-niveau="verifier"><span className="n-lia-point" aria-hidden="true"/>{tr('lia.memePhoto')}</span>
        : etat === 'publiee' ? <span className="n-lia-etat is-verifier" data-liaison-niveau="publiee"><span className="n-lia-point" aria-hidden="true"/>{tr('lia.publiee', { site: annonce.plateforme })}</span> : null}
      <span className="n-lia-carte-tete"><Plaque numero={p.numero}/><span className="n-lia-carte-prix">{prixTxt(p.prix)}</span></span>
      <span className="n-lia-carte-titre">{p.titre || '—'}</span>
      <span className="n-lia-carte-sous">
        {t ? <span className={autreTaille ? 'is-ambre' : ''} data-liaison-taille={t}>{tr('lia.taille', { t: t.replace('.', ',') })}</span> : null}
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
    const [na, ns] = r.numeros;
    lignes.push(tr('lia.q.deuxNumeros'));
    boutons = <>
      <button type="button" className="n-lia-btn is-teinte" data-liaison-garder={na} onClick={() => onReponse({ garder: na })}>N°{na}</button>
      <button type="button" className="n-lia-btn is-teinte" data-liaison-garder={ns} onClick={() => onReponse({ garder: ns })}>N°{ns}</button>
      <button type="button" className="n-lia-btn is-texte" data-liaison-question-non="" onClick={onFermer}>{tr('lia.q.jeRegarde')}</button>
    </>;
  } else if (q.sorte === 'confirmer') {
    for (const d of r.confirmer) {
      if (d === 'prix') lignes.push(tr('lia.q.prix', { a: prixTxt(annonce.prix), p: prixTxt(p.prix), numero: n }));
      if (d === 'marque') lignes.push(tr('lia.q.marque'));
      if (d === 'taille') lignes.push(tr('lia.q.taille', { a: String(r.tailleAnnonce || '').replace('.', ','), p: String(r.taillePaire || '').replace('.', ','), numero: n }));
      if (d === 'reference') lignes.push(tr('lia.q.reference', { ecrit: r.numeroEcrit, numero: n }));
    }
    boutons = <>
      <button type="button" className="n-lia-btn is-teinte" data-liaison-question-oui="" onClick={() => onReponse({ doutes: true })}>{tr('lia.q.oui', { numero: n })}</button>
      <button type="button" className="n-lia-btn is-texte" data-liaison-question-non="" onClick={onFermer}>{tr('lia.q.non')}</button>
    </>;
  } else {
    const site = annonce.plateforme;
    const texte = r.refus === 'taille' ? tr('lia.r.taille', { a: String(r.tailleAnnonce || '').replace('.', ','), p: String(r.taillePaire || '').replace('.', ','), numero: n })
      : r.refus === 'annonce-reliee' ? tr('lia.r.annonceReliee', { numero: r.numero || '' })
      : r.refus === 'paire-prise' ? tr('lia.r.pairePrise', { numero: n, site })
      : r.refus === 'numero-double' ? tr('lia.r.numeroDouble', { numero: r.numero || n })
      : r.refus === 'sans-numero' ? tr('lia.r.sansNumero')
      : r.refus === 'garder-vinted' ? tr('lia.r.garderVinted', { numero: r.numero, garder: r.garder })
      : r.refus === 'ecrit-sur-le-site' ? tr('lia.r.ecrit', { site })
      : r.refus === 'numero-servi' ? tr('lia.r.numeroServi', { numero: r.numero || '' })
      : tr('lia.r.pasSu');
    lignes.push(texte);
    boutons = <>
      {r.refus === 'paire-prise' && r.declarable ? <button type="button" className="n-lia-btn is-teinte" data-liaison-declarer="" onClick={() => onReponse({ plusieurs: true })}>{tr('lia.r.declarer')}</button> : null}
      <button type="button" className="n-lia-btn is-texte" data-liaison-question-non="" onClick={onFermer}>{tr('lia.r.ok')}</button>
    </>;
  }
  const autre = q.sorte === 'refus' && r.refus === 'paire-prise' ? r.autre : null;
  return (
    <section className="n-lia-question" role="alertdialog" aria-label={lignes[0]} data-liaison-question={q.sorte} data-liaison-refus={q.sorte === 'refus' ? r.refus : undefined} data-liaison-doutes={q.sorte === 'confirmer' ? r.confirmer.join(' ') : undefined}>
      <div className="n-lia-face">
        <figure><Vignette src={annonce.photo} Photo={Photo} className="is-face"/><figcaption>{siteCompte(annonce)}{tailleTxt(annonce) ? ' · ' + tailleTxt(annonce) : ''}{prixTxt(annonce.prix) ? ' · ' + prixTxt(annonce.prix) : ''}</figcaption></figure>
        <figure><Vignette src={p.photo} Photo={Photo} className="is-face"/><figcaption><Plaque numero={n}/>{tailleTxt(p) ? ' ' + tailleTxt(p) : ''}{prixTxt(p.prix) ? ' · ' + prixTxt(p.prix) : ''}</figcaption></figure>
        {autre ? <figure><Vignette src={autre.photo} Photo={Photo} className="is-face"/><figcaption>{tr('lia.r.autreAnnonce', { site: autre.plateforme })}</figcaption></figure> : null}
      </div>
      {lignes.map((l, i) => <p key={i} className="n-lia-question-texte">{l}</p>)}
      <div className="n-lia-question-gestes">{boutons}</div>
    </section>
  );
}

// ── Les liens qui se contredisent : les deux côtés montrés, il garde ou délie. ──
function Contradiction({ c, Photo, enCours, onGarder, onDelier, onRemplacer }) {
  const a0 = c.annonces[0];
  const titre = c.type === 'deux-numeros' ? tr('lia.c.deuxNumeros')
    : c.type === 'deux-annonces' ? tr('lia.c.deuxAnnonces', { site: c.plateforme, numero: c.numeros[0] })
    : c.type === 'taille' ? tr('lia.c.taille', { a: String(c.tailleAnnonce || '').replace('.', ','), p: String(c.taillePaire || '').replace('.', ',') })
    : c.type === 'prix' ? tr('lia.c.prix')
    : tr('lia.c.orphelin', { numero: c.numeros[0] });
  const lienDe = (n) => (c.identites || []).filter((i) => i.numero === n).map((i) => tr('lia.c.src.' + i.sorte)).join(' · ');
  return (
    <section className="n-lia-contra" data-liaison-contradiction={c.id} data-type={c.type}>
      <h3 className="n-lia-contra-titre"><span className="n-lia-point" aria-hidden="true"/>{titre}</h3>
      <div className="n-lia-face">
        {c.annonces.map((a) => (
          <figure key={a.id} data-liaison-cote={`annonce:${a.id}`}>
            <Vignette src={a.photo} Photo={Photo} className="is-face"/>
            <figcaption>{siteCompte(a)}{tailleTxt(a) ? ' · ' + tailleTxt(a) : ''}{prixTxt(a.prix) ? ' · ' + prixTxt(a.prix) : ''}<small>{a.titre}</small></figcaption>
            {c.type === 'deux-annonces' ? <button type="button" className="n-lia-btn is-teinte" disabled={enCours} data-liaison-garder-annonce={a.id} onClick={() => onDelier(c.annonces.filter((x) => x !== a))}>{tr('lia.c.garder')}</button> : null}
          </figure>
        ))}
        {c.type !== 'deux-annonces' ? c.numeros.map((n, i) => {
          const p = c.paires[i];
          return (
            <figure key={n} data-liaison-cote={`numero:${n}`}>
              <Vignette src={p && p.photo} Photo={Photo} className="is-face"/>
              <figcaption><Plaque numero={n}/>{p && tailleTxt(p) ? ' ' + tailleTxt(p) : ''}{p && prixTxt(p.prix) ? ' · ' + prixTxt(p.prix) : ''}<small>{c.type === 'deux-numeros' ? lienDe(n) : (p && p.titre) || ''}</small></figcaption>
              {c.type === 'deux-numeros' ? (cleEgale(a0.numero, n)
                ? <button type="button" className="n-lia-btn is-teinte" disabled={enCours} data-liaison-garder-numero={n} onClick={() => onGarder(c, n)}>{tr('lia.c.garder')}</button>
                : p ? <button type="button" className="n-lia-btn is-teinte" disabled={enCours} data-liaison-cest={n} onClick={() => onRemplacer(a0, p)}>{tr('lia.c.cestLui', { numero: n })}</button> : null) : null}
            </figure>
          );
        }) : null}
      </div>
      <div className="n-lia-question-gestes">
        {c.type === 'deux-annonces' ? <button type="button" className="n-lia-btn is-texte" disabled={enCours} data-liaison-les-deux="" onClick={() => onGarder(c, 'les-deux')}>{tr('lia.c.lesDeux')}</button> : null}
        {['taille', 'prix', 'orphelin'].includes(c.type) ? <button type="button" className="n-lia-btn is-teinte" disabled={enCours} data-liaison-garder-lien="" onClick={() => onGarder(c, 'garder')}>{tr('lia.c.garderLien')}</button> : null}
        {c.type !== 'deux-annonces' ? <button type="button" className="n-lia-btn is-texte" disabled={enCours} data-liaison-delier={a0.id} onClick={() => onDelier([a0])}>{tr('lia.c.delier')}</button> : null}
      </div>
    </section>
  );
}
const cleEgale = (x, y) => String(x || '').toUpperCase() === String(y || '').toUpperCase();

export default function LiaisonSites({ cible, actions, Photo, onFermer, FermeAuRetour }) {
  useLangue();
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
  const refCorps = React.useRef(null), refChamp = React.useRef(null), refFinLot = React.useRef(null);
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
  const aFaire = file.filter((e) => !e.plusTard), tard = file.filter((e) => e.plusTard);
  const contras = lu ? res.contradictions.filter((c) => !cible.site || c.plateforme === cible.site) : [];
  if (lu && total0.current == null) total0.current = aFaire.length;
  const nFaits = traitees.size;
  const total = Math.max(total0.current || 0, nFaits + aFaire.length);

  // L'annonce montrée : celle demandée, sinon là où il s'est arrêté, sinon la première.
  React.useEffect(() => {
    if (!lu || courant) return;
    if (cible.id && cible.site) { const k = `${cible.site}:${cible.id}`; if (res.parCle.has(k)) { setCourant(k); return; } }
    if (vue !== 'file') return;
    const rep = lireReprise();
    const e = aFaire.find((x) => x.cle === rep) || aFaire[0] || null;
    if (e) setCourant(e.cle);
  }, [lu, courant]);   // eslint-disable-line react-hooks/exhaustive-deps
  const entree = lu && courant ? res.parCle.get(courant) || null : null;
  const dansFile = !!(entree && entree.etat === 'aRelier' && !traitees.has(entree.cle));
  React.useEffect(() => { if (dansFile) noterReprise(courant); }, [courant, dansFile]);
  React.useEffect(() => { setQ(''); setSansTaille(false); setLimite(PAR_PAGE); setQuestion(null); setFocus(-1); if (refCorps.current) refCorps.current.scrollTop = 0; }, [courant]);

  const tailleAnnonce = entree ? tailleDe(entree.annonce).taille : '';
  const puceTaille = !!tailleAnnonce && !sansTaille && !q.trim();
  const candidates = React.useMemo(() => (dansFile ? candidatesPour(entree, res.articles, { q, taille: puceTaille ? tailleAnnonce : '', autres: res.autres || [] }) : []),
    [dansFile, entree, res, q, puceTaille, tailleAnnonce]);
  // La puce « Taille 42 » ne cache jamais tout : aucune à cette taille ⇒ toutes les tailles.
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
      else if (r && r.demander) setQuestion({ sorte: 'demander', c, paire: c.paire, r, accepte });
      else if (r && r.confirmer) setQuestion({ sorte: 'confirmer', c, paire: c.paire, r, accepte });
      else setQuestion({ sorte: 'refus', c, paire: c.paire, r: r || { refus: 'pas-su' }, accepte });
    } catch (_) { setQuestion({ sorte: 'refus', c, paire: c.paire, r: { refus: 'pas-su' }, accepte }); } finally { setEnCours(false); }
  };
  const sortir = async (quoi) => {
    if (enCours || !entree) return;
    setEnCours(true);
    try {
      const k = entree.cle;
      if (quoi === 'aucune') { await actions.pasCellesCi({ entree }); setLimite(PAR_PAGE); if (refChamp.current) refChamp.current.focus(); return; }
      const r = quoi === 'tard' ? await actions.plusTard({ annonce: entree.annonce }) : await actions.propre({ annonce: entree.annonce });
      if (r && r.ok) { marquer(k); avancer(k); } else setQuestion({ sorte: 'refus', c: null, paire: { numero: '' }, r: r || { refus: 'pas-su' } });
    } finally { setEnCours(false); }
  };
  const delier = async (annonces) => { if (enCours) return; setEnCours(true); try { for (const a of annonces) await actions.delier({ annonce: a }); } finally { setEnCours(false); } };

  // ── Le lot « Relier les N sûres » ──
  const surs = lu ? sursDuLot(res).filter((e) => duSite(e) && !traitees.has(e.cle)) : [];
  const ouvrirLot = () => { setLotCoches(new Set(surs.map((e) => e.cle))); setLotVu(false); setVue('lot'); };
  React.useEffect(() => {
    if (vue !== 'lot' || !refFinLot.current || typeof IntersectionObserver === 'undefined') { if (vue === 'lot') setLotVu(true); return undefined; }
    const o = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) setLotVu(true); }, { root: refCorps.current, threshold: 0.6 });
    o.observe(refFinLot.current);
    return () => o.disconnect();
  }, [vue, surs.length]);
  const relierLot = async () => {
    if (enCours || !lotCoches) return;
    setEnCours(true);
    try {
      const r = await actions.relierLot({ entrees: surs.filter((e) => lotCoches.has(e.cle)) });
      if (r && r.ok) { setTraitees((m) => { const n = new Map(m); for (const f of r.faits) n.set(f.cle, Date.now()); return n; }); const der = r.faits[r.faits.length - 1]; if (der) suivreLien(der.cle, der.numero); }
      setLotCoches(null); setCourant(null); setVue('file');
    } finally { setEnCours(false); }
  };
  // Après le lot (ou un retour dans la file) : reprendre sur la première annonce restante.
  React.useEffect(() => { if (vue === 'file' && lu && !courant) { const e = aFaire[0]; if (e) setCourant(e.cle); else if (total0.current != null) setVue('fin'); } }, [vue, lu, courant, aFaire.length]);   // eslint-disable-line react-hooks/exhaustive-deps

  // ── Le clavier : ← → la candidate, ↑ ↓ l'annonce, Entrée relie, « / » cherche, Échap ferme. ──
  React.useEffect(() => {
    const f = (e) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const champ = e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if (e.key === 'Escape') { e.preventDefault(); if (question) setQuestion(null); else if (vue === 'lot') setVue('file'); else onFermer(); return; }
      if (vue !== 'file' || !dansFile || question) return;
      if (e.key === '/' && !champ) { e.preventDefault(); if (refChamp.current) refChamp.current.focus(); return; }
      if (champ && !['ArrowDown', 'ArrowUp', 'Enter'].includes(e.key)) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); setFocus((i) => Math.max(0, Math.min(montrees.length - 1, (i < 0 ? (e.key === 'ArrowRight' ? -1 : 0) : i) + (e.key === 'ArrowRight' ? 1 : -1)))); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const i = aFaire.findIndex((x) => x.cle === courant); const s = aFaire[i + (e.key === 'ArrowDown' ? 1 : -1)]; if (s) setCourant(s.cle); return; }
      if (e.key === 'Enter' && focus >= 0 && montrees[focus]) { e.preventDefault(); relier(montrees[focus]); }
    };
    window.addEventListener('keydown', f, true);
    return () => window.removeEventListener('keydown', f, true);
  });
  React.useEffect(() => { const el = refCartes.current[focus]; if (el && el.scrollIntoView) { try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (_) { /* vieux navigateur */ } } }, [focus]);

  if (typeof document === 'undefined') return null;
  const titre = vue === 'contradictions' ? tr('lia.c.titre') : vue === 'lot' ? tr('lia.lot.titre', { n: surs.length }) : tr('lia.titre');
  const position = vue === 'file' && dansFile && total > 0 ? tr('lia.progress', { k: Math.min(total, nFaits + 1), n: total }) : '';
  const retour = () => { if (vue === 'lot' || (vue === 'contradictions' && cible.vue !== 'contradictions')) { setVue(aFaire.length ? 'file' : 'fin'); } else onFermer(); };

  const illisibles = lu ? (res.illisibles || []).filter((s) => !cible.site || s === cible.site) : [];
  let corps;
  if (!res) corps = <p className="n-lia-attente" data-liaison-attente="">{tr('lia.lecture')}</p>;
  else if (!lu) corps = <div className="n-lia-vide" data-liaison-pas-su=""><p className="n-lia-vide-titre">{tr('lia.pasLuTitre')}</p><p>{res.paires == null ? tr('lia.vintedPasLu') : tr('lia.pasLu', { sites: SITES_LIAISON.join(' · ') })}</p><button type="button" className="n-lia-btn is-teinte" data-liaison-relire="" onClick={() => actions.charger(true)}>{tr('lia.relire')}</button></div>;
  else if (vue === 'contradictions') {
    corps = contras.length ? <div className="n-lia-contras" data-liaison-contradictions={contras.length}>
      {contras.map((c) => <Contradiction key={c.id} c={c} Photo={Photo} enCours={enCours}
        onGarder={(cc, choix) => actions.garder({ contradiction: cc, choix })} onDelier={delier}
        onRemplacer={(a, p) => actions.remplacer({ annonce: a, paire: p })}/>)}
    </div> : <div className="n-lia-vide" data-liaison-contradictions="0"><span className="n-lia-vide-coche"><Coche/></span><p className="n-lia-vide-titre">{tr('lia.c.rien')}</p></div>;
  } else if (vue === 'lot') {
    corps = <div className="n-lia-lot" data-liaison-lot={surs.length}>
      {surs.map((e) => { const c = e.candidats.find((x) => String(x.paire.id) === e.avant); const on = !!(lotCoches && lotCoches.has(e.cle)); return (
        <label key={e.cle} className="n-lia-lot-ligne" data-liaison-lot-ligne={e.cle} data-coche={on ? '1' : '0'}>
          <Vignette src={e.annonce.photo} Photo={Photo} className="is-lot"/>
          <Vignette src={c.paire.photo} Photo={Photo} className="is-lot"/>
          <span className="n-lia-lot-textes"><span className="n-lia-carte-tete"><Plaque numero={c.paire.numero}/></span><span className="n-lia-carte-titre">{e.annonce.titre || '—'}</span><span className="n-lia-carte-sous"><span>{siteCompte(e.annonce)}</span></span></span>
          <input type="checkbox" className="n-lia-coche" checked={on} onChange={() => setLotCoches((s0) => { const n = new Set(s0); if (n.has(e.cle)) n.delete(e.cle); else n.add(e.cle); return n; })} aria-label={tr('lia.relier', { numero: c.paire.numero })}/>
        </label>); })}
      <span ref={refFinLot} className="n-lia-lot-fin" aria-hidden="true"/>
    </div>;
  } else if (entree && !dansFile && entree.etat !== 'aRelier') {
    // Une annonce reliée, ou « que sur ce site » : son lien, sa preuve, « Délier ».
    const a = entree.annonce;
    const article = res.articles.find((p) => cleEgale(p.numero, entree.numero) && String(p.id) !== entree.cle) || null;
    corps = <div className="n-lia-fiche" data-liaison-fiche={entree.cle} data-etat={entree.etat}>
      <div className="n-lia-face">
        <figure><Vignette src={a.photo} Photo={Photo} className="is-face"/><figcaption>{siteCompte(a)}<small>{a.titre}</small></figcaption></figure>
        {article ? <figure><Vignette src={article.photo} Photo={Photo} className="is-face"/><figcaption><Plaque numero={article.numero}/> {origineTxt(article)}<small>{article.titre}</small></figcaption></figure> : null}
      </div>
      <p className="n-lia-fiche-etat" data-liaison-fiche-etat={entree.etat}>
        {entree.etat === 'propre' ? (entree.numero ? tr('liaE.seuleNumero', { site: a.plateforme, numero: entree.numero }) : tr('liaE.seule', { site: a.plateforme })) : entree.etat === 'aVerifier' ? tr('liaE.aVerifier') : tr('liaE.relie', { numero: entree.numero })}
        {entree.etat === 'relie' && entree.preuve ? <small> · {tr('lia.preuve.' + entree.preuve)}{dateCourte(entree.lieLe) ? ' · ' + dateCourte(entree.lieLe) : ''}</small> : null}
      </p>
      <div className="n-lia-question-gestes">
        {entree.etat === 'relie' ? <button type="button" className="n-lia-btn is-texte" disabled={enCours} data-liaison-delier={a.id} onClick={async () => { setEnCours(true); try { const r = await actions.delier({ annonce: a }); if (r && r.refus) setQuestion({ sorte: 'refus', c: null, paire: { numero: entree.numero }, r }); } finally { setEnCours(false); } }}>{tr('lia.c.delier')}</button> : null}
        {entree.etat === 'propre' ? <button type="button" className="n-lia-btn is-texte" disabled={enCours} data-liaison-reprendre={a.id} onClick={() => actions.propre({ annonce: a, annuler: true })}>{tr('lia.fin.reprendre')}</button> : null}
        {entree.etat === 'aVerifier' ? <button type="button" className="n-lia-btn is-teinte" data-liaison-voir-contradictions="" onClick={() => setVue('contradictions')}>{tr('lia.c.titre')}</button> : null}
      </div>
      {question ? <Question q={question} annonce={a} Photo={Photo} onReponse={() => setQuestion(null)} onFermer={() => setQuestion(null)}/> : null}
    </div>;
  } else if (vue === 'fin' || !entree) {
    const reste = aFaire.length;
    corps = <div className="n-lia-fin" data-liaison-fin="" data-reste={reste} data-plus-tard={tard.length} data-contradictions={contras.length}>
      <div className="n-lia-vide">
        <span className="n-lia-vide-coche"><Coche/></span>
        <p className="n-lia-vide-titre" data-liaison-fin-titre="">{reste ? tr('lia.fin.reste', { n: reste }) : res.entrees.filter(duSite).length ? tr('lia.fin.titre') : tr('lia.vide')}</p>
        {reste ? <button type="button" className="n-lia-btn is-plein" data-liaison-reprendre="" onClick={() => { setCourant(aFaire[0].cle); setVue('file'); }}>{tr('lia.fin.reprendre')}</button> : null}
      </div>
      {contras.length ? <button type="button" className="n-lia-rangee" data-liaison-fin-contradictions={contras.length} onClick={() => setVue('contradictions')}><span className="n-lia-point" aria-hidden="true"/><span className="n-lia-rangee-titre">{tr('liaE.aVerifierN', { n: contras.length })}</span><span className="n-lia-chevron" aria-hidden="true">›</span></button> : null}
      {tard.length ? <section className="n-lia-groupe"><h3 className="n-lia-groupe-titre">{tr('lia.fin.plusTard')}</h3>
        {tard.map((e) => <button key={e.cle} type="button" className="n-lia-rangee" data-liaison-tard={e.cle} onClick={async () => { await actions.plusTard({ annonce: e.annonce, annuler: true }); setCourant(e.cle); setVue('file'); }}>
          <Vignette src={e.annonce.photo} Photo={Photo} className="is-rangee"/><span className="n-lia-rangee-textes"><span className="n-lia-rangee-titre">{e.annonce.titre || '—'}</span><span className="n-lia-rangee-sous">{siteCompte(e.annonce)}</span></span><span className="n-lia-chevron" aria-hidden="true">›</span></button>)}
      </section> : null}
      {illisibles.length ? <p className="n-lia-note" data-liaison-illisibles={illisibles.join(' ')}>{tr('lia.pasLu', { sites: illisibles.join(' · ') })}</p> : null}
    </div>;
  } else {
    const a = entree.annonce;
    refCartes.current = [];
    corps = <>
      <aside className="n-lia-file" aria-label={tr('lia.file')} data-liaison-file={aFaire.length}>
        {aFaire.map((e) => <button key={e.cle} type="button" className="n-lia-rangee" aria-current={e.cle === courant ? 'true' : undefined} data-liaison-file-ligne={e.cle} onClick={() => setCourant(e.cle)}>
          <Vignette src={e.annonce.photo} Photo={Photo} className="is-rangee"/>
          <span className="n-lia-rangee-textes"><span className="n-lia-rangee-titre">{e.annonce.titre || '—'}</span><span className="n-lia-rangee-sous">{e.annonce.plateforme}{e.avant ? ' · ' + tr('lia.sur') : ''}</span></span>
        </button>)}
      </aside>
      <section className="n-lia-annonce" data-liaison-annonce={entree.cle} data-liaison-site={a.plateforme}>
        <Vignette src={a.photo} Photo={Photo} className="is-annonce"/>
        <div className="n-lia-annonce-textes">
          <span className="n-lia-annonce-site">{siteCompte(a)}</span>
          <h2 className="n-lia-annonce-titre">{a.titre || '—'}</h2>
          <span className="n-lia-annonce-faits">{[tailleTxt(a), prixTxt(a.prix), entree.numeroSite ? 'N°' + entree.numeroSite : ''].filter(Boolean).join(' · ')}</span>
          {a.lien ? <a className="n-lia-annonce-lien" href={a.lien} target="_blank" rel="noopener noreferrer">{tr('lia.ouvrir')} ↗</a> : null}
        </div>
      </section>
      <section className="n-lia-candidates" data-liaison-candidates={candidates.length}>
        {question ? <Question q={question} annonce={a} Photo={Photo} onReponse={(acc) => relier(question.c, { ...question.accepte, ...acc })} onFermer={() => setQuestion(null)}/> : <>
          {avant ? (
            <div className="n-lia-avant" data-liaison-avant={avant.paire.id}>
              <div className="n-lia-face">
                <figure><Vignette src={a.photo} Photo={Photo} className="is-face"/><figcaption>{a.plateforme}</figcaption></figure>
                <figure><Vignette src={avant.paire.photo} Photo={Photo} className="is-face"/><figcaption><Plaque numero={avant.paire.numero}/> {origineTxt(avant.paire)}{avant.paire.place ? ' · ' + avant.paire.place : ''}</figcaption></figure>
              </div>
              <span className="n-lia-etat is-sur" data-liaison-niveau="sur"><span className="n-lia-diode" aria-hidden="true"/>{tr('lia.sur')}</span>
              <button type="button" className="n-lia-btn is-plein" ref={(el) => { refCartes.current[0] = el; }} disabled={enCours} data-liaison-relier-avant={avant.paire.id} data-numero={avant.paire.numero} onClick={() => relier(avant)}>{tr('lia.relier', { numero: avant.paire.numero })}</button>
            </div>
          ) : null}
          <div className="n-lia-cherche">
            <input ref={refChamp} type="search" inputMode="search" enterKeyHint="search" autoCapitalize="none" autoCorrect="off" className="n-lia-champ" value={q} placeholder={tr('lia.chercher')} aria-label={tr('lia.chercher')} data-liaison-chercher="" onChange={(e) => { setQ(e.target.value); setLimite(PAR_PAGE); setFocus(-1); }}/>
            {tailleAnnonce && !q.trim() ? <button type="button" className="n-lia-puce" aria-pressed={!sansTaille} data-liaison-puce-taille={tailleAnnonce} onClick={() => { setSansTaille((v) => !v); setLimite(PAR_PAGE); }}>{tr('lia.taille', { t: tailleAnnonce.replace('.', ',') })}</button> : null}
          </div>
          <div className="n-lia-grille" role="list" data-liaison-grille={montrees.length}>
            {montrees.filter((c) => !avant || c !== avant).map((c, i) => <CarteCandidate key={c.paire.id} c={c} annonce={a} Photo={Photo} focus={focus === i + (avant ? 1 : 0)} enCours={enCours} onRelier={relier} refCarte={(el) => { refCartes.current[i + (avant ? 1 : 0)] = el; }}/>)}
          </div>
          {!candidates.length ? <p className="n-lia-note" data-liaison-aucune="">{puceTaille ? tr('lia.aucuneTaille', { t: tailleAnnonce.replace('.', ',') }) : tr('lia.aucune')}</p> : null}
          {candidates.length > limite ? <button type="button" className="n-lia-btn is-texte" data-liaison-plus="" onClick={() => setLimite((l) => l + PAR_PAGE * 2)}>{tr('lia.voirPlus', { n: candidates.length - limite })}</button> : null}
          {res.vintedPartiel ? <p className="n-lia-note" data-liaison-vinted-partiel="">{tr('lia.vintedPartiel')}</p> : null}
        </>}
      </section>
    </>;
  }

  const pied = vue === 'lot' ? (
    <footer className="n-lia-pied" data-liaison-pied="lot">
      <button type="button" className="n-lia-btn is-plein" disabled={enCours || !lotVu || !lotCoches || !lotCoches.size} data-liaison-lot-valider={lotCoches ? lotCoches.size : 0} data-vu={lotVu ? '1' : '0'} onClick={relierLot}>{lotVu ? tr('lia.lot.valider', { n: lotCoches ? lotCoches.size : 0 }) : tr('lia.lot.defile')}</button>
    </footer>
  ) : vue === 'file' && dansFile && !question ? (
    <footer className="n-lia-pied" data-liaison-pied="file">
      {entree.candidats.some((c) => c.raison !== 'publiee') ? <button type="button" className="n-lia-btn is-texte" disabled={enCours} data-liaison-sortie="aucune" onClick={() => sortir('aucune')}>{tr('lia.s.aucune')}</button> : null}
      <button type="button" className="n-lia-btn is-texte" disabled={enCours} data-liaison-sortie="propre" onClick={() => sortir('propre')}>{tr('lia.s.propre', { site: entree.annonce.plateforme })}</button>
      <button type="button" className="n-lia-btn is-texte" disabled={enCours} data-liaison-sortie="tard" onClick={() => sortir('tard')}>{tr('lia.s.plusTard')}</button>
    </footer>
  ) : null;

  return createPortal(
    <div className="n-lia" role="dialog" aria-modal="true" aria-label={titre} data-liaison="" data-liaison-vue={entree && !dansFile && vue === 'file' ? 'annonce' : vue} data-liaison-lu={lu ? '1' : res ? '0' : ''}>
      {FermeAuRetour ? <FermeAuRetour fermer={onFermer}/> : null}
      <header className="n-lia-barre">
        <button type="button" className="n-lia-retour" aria-label={tr('lia.retour')} data-liaison-retour="" onClick={retour}><svg viewBox="0 0 12 20" width="12" height="20" aria-hidden="true"><path d="M10 2L2 10l8 8" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
        <h1 className="n-lia-titre">{titre}</h1>
        <span className="n-lia-position" data-liaison-position={position}>{position}</span>
      </header>
      {vue === 'file' && lu && (surs.length >= 2 || dernier || contras.length) ? (
        <div className="n-lia-bande" data-liaison-bande="">
          {dernier ? <span className={`n-lia-dernier is-${dernier.etat}`} role="status" data-liaison-dernier={dernier.etat} data-numero={dernier.numero}>
            {dernier.etat === 'verifie' ? <Coche/> : null}{tr('lia.verif.' + (dernier.etat === 'verifie' ? 'verifie' : dernier.etat === 'autre' ? 'autre' : dernier.etat === 'attente' ? 'attente' : 'passu'), { numero: dernier.numero })}
            {dernier.etat === 'autre' ? <button type="button" className="n-lia-btn is-texte" onClick={() => setVue('contradictions')}>{tr('lia.voir')}</button> : null}
          </span> : null}
          {surs.length >= 2 ? <button type="button" className="n-lia-btn is-teinte" data-liaison-lot-ouvrir={surs.length} onClick={ouvrirLot}>{tr('lia.lot.ouvrir', { n: surs.length })}</button> : null}
          {contras.length && !dernier ? <button type="button" className="n-lia-btn is-texte" data-liaison-voir-contradictions={contras.length} onClick={() => setVue('contradictions')}>{tr('liaE.aVerifierN', { n: contras.length })}</button> : null}
        </div>
      ) : null}
      <main ref={refCorps} className={`n-lia-corps is-${entree && !dansFile && vue === 'file' ? 'annonce' : vue}${vue === 'file' && dansFile ? ' is-volets' : ''}`}>{corps}</main>
      {pied}
    </div>, document.body);
}
