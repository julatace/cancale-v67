// ════════════════════════════════════════════════════════════════════════════
//  L'ATELIER « COMPLÉTER » (19 nov. 2026, lot completer-infos) — l'écran
// ════════════════════════════════════════════════════════════════════════════
// Julien : « trouve autre chose pour relier les achats, mettre les prix plancher minimum, mettre
// les prix — toutes les informations […] ça doit être beaucoup plus simple et rapide » ; « l'outil
// doit être pratique, pas chiant ».
//   · UNE file, UNE question à la fois, sur une page poussée (docs/design/NATIF.md) : la photo, la
//     plaque N°, le titre, ses faits (taille, prix, site, compte) ; puis seulement ce qui MANQUE ;
//   · « Payée combien ? » : jusqu'à 3 achats proposés en rangées photo — UN toucher relie (c'est
//     SON geste, par le n° de transaction de la rangée) ; sinon le pavé ; « Autre achat » ; « Je ne
//     sais plus » ; « Plus tard » ;
//   · « Ton prix mini ? » : des puces calculées et DITES (« −15 % → 72 € ») ; ou le pavé ;
//   · chaque réponse = UNE écriture annulable 10 s (le bandeau, dans l'atelier), puis la carte
//     suivante — déjà dessinée, ses photos décodées ;
//   · la règle en lot des prix mini (une feuille) : choisir, voir l'aperçu ligne par ligne,
//     décocher, poser ;
//   · à l'ordinateur : la file à gauche, la carte à droite, tout au clavier ; une vue « grille ».
// Les règles : src/completer/regles.js (pures, exécutées par scripts/audit-completer.cjs).
// Aucune confirmation là où « Annuler » suffit ; aucun texte à lire à chaque carte ; aucun style
// en ligne (src/completer/completer.css, jetons --n-* du design natif).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { tr, monnaie } from '../i18n/index.js';
import { fileCompleter, filtrer, parGenre, questionsDe, compteurs, pucesMini, jugerMini, apercuLot, ecrituresLot, candidatsAchat, opsPrixAchat, opsMini, opsPrixFiche, opsSans, opsRevoir,
  prixCertains, opsPrixCertains, indexReprise, indexNumero, toucheSuivante, montantTape, CLE_REPRISE, LOT_POURCENTS, ACHAT_PLUS, LOT_SEUIL, GENRES } from './regles.js';
import { morceauxPourquoi } from '../liaisonAchat.js';
import { faitsAchat } from '../faitsAchat.js';
import { ecriturePrixSaisi } from '../prixAuNumerotage.js';
import { montantSeuil } from '../offresSures.js';
import './completer.css';

const eur = (n) => (n == null || !Number.isFinite(Number(n)) ? '—' : monnaie(Number(n), 'EUR', Number.isInteger(Number(n)) ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : undefined));
const jourCourt = (d) => { const t = typeof d === 'number' ? d : Date.parse(d || ''); if (!Number.isFinite(t)) return ''; try { return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); } catch (_) { return ''; } };
const lireReprise = () => { try { const v = JSON.parse(localStorage.getItem(CLE_REPRISE) || 'null'); return v && typeof v === 'object' ? v : null; } catch (_) { return null; } };
const noterReprise = (v) => { try { localStorage.setItem(CLE_REPRISE, JSON.stringify(v)); } catch (_) { /* stockage bloqué : on reprend au début */ } };
const COULEURS = ['noir', 'blanc', 'gris', 'bleu', 'vert', 'rouge', 'rose', 'jaune', 'orange', 'violet', 'beige', 'marron'];
const QUI = (a) => (a && a.numero ? `N°${a.numero}` : String((a && a.titre) || '').slice(0, 28));

const Chevron = () => <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M14.5 5 7.5 12l7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const Bas = () => <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const Revoir = () => <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M9 6.5 4.5 11 9 15.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 11h9.5a4.5 4.5 0 0 1 0 9H12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>;
const Efface = () => <svg viewBox="0 0 28 24" width="26" height="22" aria-hidden="true"><path d="M9.5 4.5h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-14L3 12z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="m13 9 6 6m0-6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>;
const Coche = () => <svg viewBox="0 0 20 20" width="26" height="26" aria-hidden="true"><path d="M4.5 10.5 8.3 14 15.5 6.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>;

// ── LE PAVÉ : grosses touches, virgule, « OK » (le seul bouton plein de l'écran) ──
function Pave({ valeur, onTouche, onOk, okActif, note = null, ambre = false }) {
  const T = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'efface'];
  return (
    <div className="vrm-cp-pave" data-cp-pave="">
      <div className={'vrm-cp-affiche' + (ambre ? ' is-ambre' : '')} data-cp-affiche={valeur} aria-live="polite">
        <span className="vrm-cp-affiche-n">{valeur || '0'}</span><span className="vrm-cp-affiche-e" aria-hidden="true">€</span>
        {note ? <span className="vrm-cp-affiche-note" data-cp-note="">{note}</span> : null}
      </div>
      <div className="vrm-cp-touches">
        {T.map((t) => (
          <button key={t} type="button" className="vrm-cp-t" data-cp-touche={t} aria-label={t === 'efface' ? tr('cpl.efface') : t === ',' ? tr('cpl.virgule') : t}
            onPointerDown={(e) => { e.preventDefault(); onTouche(t); }} onClick={(e) => { if (e.detail === 0) onTouche(t); }}>
            {t === 'efface' ? <Efface/> : t}
          </button>
        ))}
      </div>
      <button type="button" className="vrm-cp-plein" data-cp-ok="" disabled={!okActif} onClick={onOk}>{tr('cpl.ok')}</button>
    </div>
  );
}

// ── LE BANDEAU « ANNULER » (10 s) : le visage, DANS l'atelier, du moteur des gestes (src/gesteAnnulable.js) ──
function Bandeau({ gestes }) {
  const [etat, setEtat] = useState(() => (gestes ? gestes.etat() : { visible: null }));
  useEffect(() => (gestes ? gestes.abonner(setEtat) : undefined), [gestes]);
  const v = etat && etat.visible;
  if (!v) return <div className="vrm-cp-toast-zone" role="status" aria-live="polite"/>;
  const echec = v.etat === 'echec' || v.etat === 'echec-annulation';
  const texte = v.etat === 'annulation' ? tr('cpl.annulation') : v.etat === 'annule' ? tr('cpl.annule') : echec ? tr('cpl.pasEnregistre') : v.texte;
  return (
    <div className="vrm-cp-toast-zone" role="status" aria-live="polite">
      <div key={v.id + ':' + v.etat} className={'vrm-cp-toast' + (echec ? ' is-alerte' : '')} data-cp-bandeau={v.etat}>
        <span className="vrm-cp-toast-txt">{texte}{v.etat === 'garde' ? <small> · {tr('cpl.garde')}</small> : null}{echec && v.texte ? <small> · {v.texte}</small> : null}</span>
        {v.peutAnnuler ? <button type="button" className="vrm-cp-toast-b" data-cp-annuler="" onClick={() => gestes.annuler(v.id)}>{tr('cpl.annuler')}</button> : null}
        {v.peutReessayer ? <button type="button" className="vrm-cp-toast-b" data-cp-reessayer="" onClick={() => gestes.reessayer(v.id)}>{tr('cpl.reessayer')}</button> : null}
      </div>
    </div>
  );
}

// ── L'ARTICLE : la photo en grand, la plaque, le titre, ses faits ──
function Article({ a, Photo, Plaque, vend }) {
  const faits = [
    a.taille ? [tr('cpl.f.taille'), a.taille] : null,
    a.prix != null ? [a.genre === 'vente' ? tr(vend === 'sneakers' ? 'cpl.f.vendue.sneakers' : 'cpl.f.vendue.autre') : tr('cpl.f.prix'), eur(a.prix)] : null,
    a.genre === 'vente' && a.ts ? [tr('cpl.f.le'), jourCourt(a.ts)] : null,
    a.genre === 'annonce' && a.achat != null ? [tr('cpl.f.achat'), eur(a.achat)] : null,
    a.genre === 'annonce' && a.favoris > 0 ? [tr('cpl.f.favoris'), String(a.favoris)] : null,
    [tr('cpl.f.site'), [a.site === 'vrm' ? tr('cpl.aPublier') : a.site === 'vinted' ? 'Vinted' : a.site, a.compte].filter(Boolean).join(' · ')],
  ].filter(Boolean).slice(0, 4);
  return (
    <div className="vrm-cp-article" data-cp-article={a.cle} data-cp-genre={a.genre}>
      <div className="vrm-cp-photo">
        {a.photo && Photo ? <Photo src={a.photo} alt="" decoding="async" draggable={false}/> : <span className="vrm-cp-photo-vide" aria-hidden="true"/>}
        {a.numero && Plaque ? <span className="vrm-cp-plaque"><Plaque n={a.numero} taille="grand"/></span> : null}
      </div>
      <p className="vrm-cp-titre" data-cp-titre="">{a.titre || tr('cpl.sansTitre')}</p>
      <dl className="vrm-cp-faits" data-cp-faits={faits.length}>
        {faits.map(([l, v]) => <div key={l} className="vrm-cp-fait"><dt>{l}</dt><dd>{v}</dd></div>)}
      </dl>
    </div>
  );
}

// ── UN ACHAT PROPOSÉ : une rangée — sa photo, son titre, ce qu'on en sait, ce qu'il a payé ──
function RangeeAchat({ c, i, article, Photo, prixDe, photoDe, compteDe, details, onChoisir, occupe }) {
  const a = c.achat;
  const f = faitsAchat(a, { details, cible: { taille: article.taille, titre: article.titre } });
  const px = c.lot ? null : prixDe(a);
  const src = photoDe(a);
  const pourquoi = c.niveau === 'identite' ? [tr('liaison.p.photo')] : morceauxPourquoi(c.p).filter((m) => m.cle !== 'tailleInconnue' && m.cle !== 'marque' && m.cle !== 'taille' && m.cle !== 'mots').map((m) => {
    if (m.cle === 'couleur') return COULEURS.includes(m.vars.couleur) ? tr('liaison.couleur.' + m.vars.couleur) : '';
    if (m.cle === 'couleurPhoto') return COULEURS.includes(m.vars.couleur) ? tr('liaison.p.couleurPhoto', { couleur: tr('liaison.couleur.' + m.vars.couleur) }) : '';
    return tr('liaison.p.' + m.cle, m.cle.startsWith('jours.') ? { n: Number(m.vars.n) } : m.vars);
  }).filter(Boolean).slice(0, 2);
  const sous = [f.taille ? (f.accord === 'meme' ? '✓ ' : '') + tr('cpl.taille', { taille: f.taille }) : '', f.vendeur || a.seller || a.user_login || '', jourCourt(a.date), compteDe ? compteDe(a) : ''].filter(Boolean);
  return (
    <button type="button" className="vrm-cp-rangee" data-cp-achat={c.tx} data-cp-niveau={c.niveau} disabled={occupe} onClick={() => onChoisir(c)} aria-keyshortcuts={String(i + 1)}>
      <span className="vrm-cp-vignette">{src && Photo ? <Photo src={src} alt="" decoding="async" draggable={false}/> : <span className="vrm-cp-photo-vide" aria-hidden="true"/>}</span>
      <span className="vrm-cp-rangee-txt">
        <span className="vrm-cp-rangee-titre">{a.title || ''}</span>
        <span className="vrm-cp-rangee-sous" data-cp-achat-taille={f.taille || undefined} data-cp-achat-accord={f.accord || undefined}>{sous.join(' · ')}</span>
        {pourquoi.length ? <span className="vrm-cp-rangee-sous">{pourquoi.join(' · ')}</span> : null}
      </span>
      <b className="vrm-cp-rangee-valeur" data-cp-achat-prix={px == null ? '' : String(px)}>{c.lot ? tr('cpl.achat.lot') : px != null ? eur(px) : '—'}</b>
      <kbd className="vrm-cp-raccourci" aria-hidden="true">{i + 1}</kbd>
    </button>
  );
}

export default function Completer({ demande = null, entrees, achats, liens = null, liaison = null, identiteDe = null, prixDe = () => null, photoDe = () => '', compteDe = null, details = null, horsRelier = null,
  courant, ficheNeuveDe = null, geste, gestes = null, onRelier, onAutreAchat = null, onNumero = null, numeroPropose = null, propositionDe = null, miniActif, arrivees = null, vend = 'sneakers',
  Photo = null, Plaque = null, Retour = null, onFermer }) {
  const [sujet, setSujet] = useState(() => (demande && demande.sujet) || 'tout');
  const [genre, setGenre] = useState('tous');                 // « Toutes · En ligne · Vendues »
  const [vue, setVue] = useState('cartes');                  // 'cartes' · 'grille'
  const [lotOuvert, setLotOuvert] = useState(false);          // la feuille « Prix mini en lot »
  const [resteOuvert, setResteOuvert] = useState(false);      // la feuille « Ce qui reste »
  const [sautees, setSautees] = useState(() => new Set());   // « Plus tard » : cle|question, pour cette séance
  // AUCUNE ATTENTE entre deux cartes : une réponse fait avancer TOUT DE SUITE (la question répondue sort d'ici, `repondues`),
  // l'écriture part juste après que la carte suivante est dessinée (`apresPeinture`) ; quand la lecture de l'app a suivi,
  // la marque ne sert plus. Un « Annuler », un refus : les marques tombent, l'article revient tel que l'app le lit.
  const [repondues, setRepondues] = useState(() => new Set());
  const [connus, setConnus] = useState({});                  // { [cle]: { achat } } : ce qu'il vient de répondre, pour la question suivante
  const [pris, setPris] = useState(() => new Set());         // les achats qu'il vient de relier : plus proposés, sans attendre la lecture
  const [histo, setHisto] = useState([]);                    // [{ article, q, resume }]
  const [retour, setRetour] = useState(null);                // l'index dans `histo` qu'on revoit, ou null
  const [saisie, setSaisie] = useState('');
  const [mode, setMode] = useState('choix');                 // 'choix' (achats proposés / puces) · 'pave'
  const [occupe, setOccupe] = useState(false);
  const [large, setLarge] = useState(() => (typeof window !== 'undefined' ? window.innerWidth >= 1024 : false));
  const [regle, setRegle] = useState(null), [choix, setChoix] = useState({}), [autrePct, setAutrePct] = useState('');
  const [grille, setGrille] = useState({ cles: null, vals: {}, poses: {} });
  const [, forcer] = useState(0);
  const racine = useRef(null), dernierIdx = useRef(0), pret = useRef(false), vus = useRef(new Set()), certainsFaits = useRef(false), lotJuge = useRef(false);
  useEffect(() => { const f = () => setLarge(window.innerWidth >= 1024); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);

  const resTout = useMemo(() => (entrees ? fileCompleter(entrees) : entrees), [entrees]);
  const res = useMemo(() => parGenre(resTout, genre), [resTout, genre]);
  const C = useMemo(() => (res ? compteurs(res) : null), [res]);
  const liste0 = useMemo(() => (res ? filtrer(res, sujet) : []), [res, sujet]);
  const qDe = (a) => questionsDe(a, sujet, res ? res.miniActif : true).filter((q) => !sautees.has(a.cle + '|' + q) && !repondues.has(a.cle + '|' + q));
  const liste = useMemo(() => liste0.filter((a) => qDe(a).length).map((a) => (connus[a.cle] ? { ...a, ...connus[a.cle] } : a)), [liste0, sautees, repondues, connus]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!gestes) return undefined;
    return gestes.abonner((s) => { const e = s && s.visible ? s.visible.etat : ''; if (e === 'annulation' || e === 'annule' || e === 'echec' || e === 'echec-annulation') { setRepondues((r) => (r.size ? new Set() : r)); setConnus((c) => (Object.keys(c).length ? {} : c)); setPris((p) => (p.size ? new Set() : p)); } });
  }, [gestes]);
  const nPlusTard = liste0.length - liste.length;

  // Le départ : l'article de SON N° (ouvrirCompleter({ num })), sinon là où il s'est arrêté.
  if (res && !pret.current) {
    pret.current = true;
    const parNum = demande && demande.num ? indexNumero(liste, demande.num) : -1;
    dernierIdx.current = parNum >= 0 ? parNum : indexReprise(liste, lireReprise(), sujet);
  }
  // L'entrée « prix mini » avec beaucoup d'annonces : la règle en lot d'abord (3 touchers : ouvrir, choisir, poser).
  if (res && !lotJuge.current) {
    lotJuge.current = true;
    const nMini = filtrer(res, 'mini').length;
    if (demande && (demande.lot || (demande.sujet === 'mini' && !demande.num && nMini >= LOT_SEUIL)) && nMini > 0 && !lotOuvert) setLotOuvert(true);
  }
  let idx = Math.min(dernierIdx.current, Math.max(0, liste.length - 1));
  if (dernierIdx.current >= liste.length) idx = 0;
  const enRetour = retour != null && histo[retour] ? histo[retour] : null;
  const article = enRetour ? enRetour.article : (liste[idx] || null);
  const suivant = !enRetour && liste.length > 1 ? liste[(idx + 1) % liste.length] : null;
  const question = enRetour ? enRetour.q : (article ? qDe(article)[0] : null);
  for (const a of liste) vus.current.add(a.cle);
  const clesListe = useMemo(() => new Set(liste.map((a) => a.cle)), [liste]);
  const sortis = useMemo(() => { let n = 0; for (const c of vus.current) if (!clesListe.has(c)) n++; return n; }, [clesListe]);
  useEffect(() => { if (article && !enRetour) { dernierIdx.current = idx; noterReprise({ sujet, cle: article.cle }); } }, [article && article.cle, enRetour, idx, sujet]);   // eslint-disable-line react-hooks/exhaustive-deps
  // Une nouvelle carte : la saisie repart de zéro, sur les propositions.
  const cleCarte = article ? article.cle + '|' + question + (enRetour ? '|r' : '') : '';
  useEffect(() => { setSaisie(''); setMode('choix'); setOccupe(false); }, [cleCarte]);

  // ── Les achats proposés de l'article courant (et du suivant : ses photos se décodent d'avance) ──
  const horsOuPris = (a) => pris.has(String(a && a.transaction_id)) || (typeof horsRelier === 'function' && horsRelier(a));
  const candidatsDe = (a) => (a && Array.isArray(achats) ? candidatsAchat({ article: a, liaison, liens, identite: identiteDe ? identiteDe(a) : null, horsRelier: horsOuPris }) : { liste: [], autres: 0 });
  const cand = useMemo(() => (question === 'achat' ? candidatsDe(article) : { liste: [], autres: 0 }), [article && article.cle, question, achats, liaison, liens, pris]);   // eslint-disable-line react-hooks/exhaustive-deps
  const candSuivant = useMemo(() => (suivant && qDe(suivant)[0] === 'achat' ? candidatsDe(suivant) : { liste: [], autres: 0 }), [suivant && suivant.cle, achats, liaison, liens, pris]);   // eslint-disable-line react-hooks/exhaustive-deps
  const puces = useMemo(() => (question === 'mini' && article ? pucesMini(article) : []), [article, question]);
  const enPave = mode === 'pave' || question === 'prix' || question === 'numero' || (question === 'achat' && !cand.liste.length) || (question === 'mini' && !puces.length);

  // ── Ce qui est CERTAIN se remplit sans lui : un achat qu'IL a relié, prix resté vide ⇒ ce qu'il a payé ──
  useEffect(() => {
    if (certainsFaits.current || !Array.isArray(achats) || typeof propositionDe !== 'function' || typeof courant !== 'function') return;
    certainsFaits.current = true;
    const k = courant(); const parTx = new Map(achats.filter((a) => a && a.transaction_id != null).map((a) => [String(a.transaction_id), a]));
    const liees = [...Object.entries(k.fiches || {}).map(([cle, entree]) => ({ ou: 'fiche', cle, entree })), ...Object.entries(k.ventes || {}).map(([cle, entree]) => ({ ou: 'vente', cle, entree }))];
    const c = prixCertains({ entrees: liees, achatDe: (tx) => parTx.get(tx) || null, propositionDe });
    const ops = opsPrixCertains(c, k);
    if (ops.length) geste(tr('cpl.fait.certains', { n: c.length }), ops);
  }, [achats]);   // eslint-disable-line react-hooks/exhaustive-deps

  // ── Les réponses : UNE écriture chacune, par le moteur des gestes (annulable 10 s) ──
  const apresPeinture = (f) => setTimeout(f, 40);
  const ecrire = (texte, ops) => apresPeinture(() => geste(texte, ops));
  const noter = (a, q, resume, su = null) => {
    setRepondues((r) => new Set(r).add(a.cle + '|' + q));
    if (su) setConnus((c) => ({ ...c, [a.cle]: { ...(c[a.cle] || {}), ...su } }));
    setHisto((h) => (enRetour ? h.map((x, i) => (i === retour ? { ...x, resume } : x)) : [...h, { article: a, q, resume }].slice(-40))); setRetour(null);
  };
  const oublier = (a, q) => { setRepondues((r) => { const n = new Set(r); n.delete(a.cle + '|' + q); return n; }); setConnus((c) => { const n = { ...c }; delete n[a.cle]; return n; }); };
  const poserPrixAchat = (a, texte) => {
    const w = ecriturePrixSaisi(texte); if (w.etat !== 'ok') return false;
    const k = courant();
    const ops = opsPrixAchat({ article: a, patch: w.patch, fiches: k.fiches, ventes: k.ventes, prixParNum: k.prixParNum, ficheNeuve: a.genre === 'annonce' && ficheNeuveDe ? ficheNeuveDe(a.id) : null });
    if (!ops.length) return false;
    const px = Number(String(w.patch.buyPrice).replace(',', '.'));
    const r = tr('cpl.fait.achat', { qui: QUI(a), prix: eur(px) });
    ecrire(r, ops); noter(a, 'achat', r, { achat: px, frais: a.frais == null ? 0 : a.frais }); return true;
  };
  const poserMini = (a, valeur) => {
    const j = jugerMini(a, valeur); if (j.valeur == null) return false;
    const ops = opsMini([{ id: a.id, min: montantSeuil(String(j.valeur)) }], { fiches: courant().fiches, ficheNeuveDe });
    if (!ops.length) return false;
    const r = tr('cpl.fait.mini', { qui: QUI(a), prix: eur(j.valeur) });
    ecrire(r, ops); noter(a, 'mini', r); return true;
  };
  const poserPrix = (a, valeur) => {
    const ops = opsPrixFiche({ article: a, prix: valeur, fichesNeuves: courant().fichesNeuves }); if (!ops.length) return false;
    const r = tr('cpl.fait.prix', { qui: QUI(a), prix: eur(valeur) });
    ecrire(r, ops); noter(a, 'prix', r); return true;
  };
  const neSaitPlus = (a, q) => {
    const ops = opsSans({ article: a, sujet: q, sans: courant().sans }); if (!ops.length) return;
    const r = tr('cpl.fait.sans', { qui: QUI(a) });
    ecrire(r, ops); noter(a, q, r);
  };
  const plusTard = () => { if (!article || enRetour) { setRetour(null); return; } setSautees((s) => new Set(s).add(article.cle + '|' + question)); };
  const relier = async (c) => {
    if (occupe || !article) return;
    const a = article, px = c.lot ? null : prixDe(c.achat);
    if (c.lot) {
      setOccupe(true);
      let ok = false;
      try { ok = await onRelier(a, c.achat); } catch (_) { ok = false; }
      if (ok) noter(a, 'achat', tr('cpl.fait.relie', { qui: QUI(a) })); else setOccupe(false);
      return;
    }
    noter(a, 'achat', tr('cpl.fait.relie', { qui: QUI(a) }), px != null ? { achat: px, frais: a.frais == null ? 0 : a.frais } : null);
    setPris((p) => new Set(p).add(c.tx));
    apresPeinture(async () => { let ok = false; try { ok = await onRelier(a, c.achat); } catch (_) { ok = false; } if (!ok) { oublier(a, 'achat'); setPris((p) => { const n = new Set(p); n.delete(c.tx); return n; }); } });
  };
  const valider = async () => {
    if (!article || occupe) return;
    if (question === 'numero') { const v = saisie || (numeroPropose ? String(numeroPropose() || '') : ''); if (!v || !onNumero) return; setOccupe(true);
      try {
        await onNumero(article, v);
        let pose = '';
        for (let i = 0; i < 12 && !pose; i++) { await new Promise((ok) => setTimeout(ok, 150)); const f = (courant().fiches || {})[String(article.id)]; pose = f && String(f.numero || '').trim(); }
        if (pose) noter(article, 'numero', tr('cpl.fait.numero', { num: pose }));
      } finally { setOccupe(false); }
      return;
    }
    const m = montantTape(saisie); if (m == null) return;
    if (question === 'achat') poserPrixAchat(article, saisie.replace(/,$/, ''));
    else if (question === 'mini') poserMini(article, m);
    else if (question === 'prix') poserPrix(article, m);
  };
  const touche = (t) => {
    if (question === 'numero') { setSaisie((s) => (t === 'efface' ? s.slice(0, -1) : /^\d$/.test(t) && s.length < 5 ? s + t : s)); return; }
    setSaisie((s) => toucheSuivante(s, t));
  };
  const reculer = () => { if (!histo.length) return; setRetour((r) => (r == null ? histo.length - 1 : Math.max(0, r - 1))); };
  const fermer = () => { if (onFermer) onFermer(); };
  const repartir = () => { vus.current = new Set(); dernierIdx.current = 0; setSautees(new Set()); setRetour(null); };
  const changerSujet = (s) => { repartir(); setSujet(s); setResteOuvert(false); setLotOuvert(false); setVue('cartes'); };
  const changerGenre = (g) => { repartir(); setGenre(g); };
  const ouvrirLot = () => { setResteOuvert(false); setRegle(null); setChoix({}); setLotOuvert(true); };

  // ── Le clavier (ordinateur) : chiffres, Entrée, Tab, 1/2/3, ←, Échap ──
  const actions = useRef({});
  actions.current = { touche, valider, plusTard, reculer, fermer, relier, poserMini, setMode, etat: { vue, lotOuvert, resteOuvert, question, enPave, cand, puces, article, saisie } };
  useEffect(() => {
    const f = (e) => {
      const A = actions.current, S = A.etat;
      const t = e.target; const champ = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Une feuille au-dessus (« Autre achat », une question de l'app) garde son clavier.
      if (document.querySelector('[data-relier-feuille]') || (t && t !== document.body && racine.current && !racine.current.contains(t))) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        if (S.resteOuvert) setResteOuvert(false); else if (S.lotOuvert) setLotOuvert(false); else if (S.vue !== 'cartes') setVue('cartes');
        else if (S.enPave && (S.cand.liste.length || S.puces.length) && S.question !== 'prix' && S.question !== 'numero') A.setMode('choix'); else A.fermer();
        return;
      }
      if (champ || S.vue !== 'cartes' || S.resteOuvert || S.lotOuvert || !S.article) return;
      if (e.key === 'Tab') { e.preventDefault(); A.plusTard(); return; }
      if (e.key === 'ArrowLeft') { e.preventDefault(); A.reculer(); return; }
      if (e.key === 'Enter') { e.preventDefault(); A.valider(); return; }
      if (!S.enPave && /^[1-4]$/.test(e.key)) {
        e.preventDefault(); const i = Number(e.key) - 1;
        if (S.question === 'achat' && S.cand.liste[i]) A.relier(S.cand.liste[i]);
        else if (S.question === 'mini' && S.puces[i]) A.poserMini(S.article, S.puces[i].valeur);
        return;
      }
      if (/^\d$/.test(e.key) || e.key === ',' || e.key === '.') { e.preventDefault(); if (!S.enPave) A.setMode('pave'); A.touche(e.key === '.' ? ',' : e.key); return; }
      if (e.key === 'Backspace') { e.preventDefault(); A.touche('efface'); }
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, []);
  useEffect(() => { try { document.body.setAttribute('data-completer-ouvert', '1'); } catch (_) {} return () => { try { document.body.removeAttribute('data-completer-ouvert'); } catch (_) {} }; }, []);

  if (typeof document === 'undefined') return null;
  const total = sortis + liste.length;
  const libSujet = [{ tout: '', achat: tr('cpl.reste.achat'), mini: tr('cpl.reste.mini'), prix: tr('cpl.reste.prix'), numero: tr('cpl.reste.numero'), anciennes: tr('cpl.reste.anciennes') }[sujet] || '',
    genre === 'annonce' ? tr('cpl.genre.annonce') : genre === 'vente' ? tr('cpl.genre.vente') : ''].filter(Boolean).join(' · ');
  const titreQ = (q) => (q === 'achat' ? tr(vend === 'sneakers' ? 'cpl.q.achat.sneakers' : 'cpl.q.achat.autre') : tr('cpl.q.' + q));

  // ── La zone de la question ──
  const zoneQuestion = (a, q, vivante) => {
    if (!a || !q) return null;
    const c = vivante ? cand : candSuivant;
    const pu = vivante ? puces : (q === 'mini' ? pucesMini(a) : []);
    const pave = vivante ? enPave : (q === 'prix' || q === 'numero' || (q === 'achat' && !c.liste.length) || (q === 'mini' && !pu.length));
    const m = montantTape(saisie);
    const jm = vivante && q === 'mini' && m != null ? jugerMini(a, m) : null;
    const note = !vivante ? null : q === 'mini' && jm ? (jm.auPrix ? tr('cpl.mini.auPrix') : jm.sousAchat ? tr('cpl.mini.sousAchat', { prix: eur(jm.cout) }) : null)
      : q === 'numero' && !saisie && numeroPropose ? tr('cpl.numero.propose', { num: String(numeroPropose() || '') }) : null;
    const okActif = vivante && !occupe && (q === 'numero' ? !!(saisie || (numeroPropose && numeroPropose())) : m != null && !(jm && jm.auPrix));
    return (
      <div className="vrm-cp-question" data-cp-question={vivante ? q : undefined} data-cp-mode={pave ? 'pave' : 'choix'}>
        <h2 className="vrm-cp-q">{titreQ(q)}</h2>
        {vivante && enRetour && enRetour.resume ? <p className="vrm-cp-legende" data-cp-deja="">{enRetour.resume}</p> : null}
        {q === 'achat' && !pave ? (
          <div className="vrm-cp-groupe" data-cp-achats={c.liste.length}>
            {c.liste.map((x, i) => <RangeeAchat key={x.tx} c={x} i={i} article={a} Photo={Photo} prixDe={prixDe} photoDe={photoDe} compteDe={compteDe} details={details} onChoisir={vivante ? relier : () => {}} occupe={!vivante || occupe}/>)}
          </div>
        ) : null}
        {q === 'mini' && !pave ? (
          <div className="vrm-cp-puces" data-cp-puces={pu.length}>
            {pu.map((p, i) => (
              <button key={p.id} type="button" className={'vrm-cp-puce' + (p.sousAchat ? ' is-sous' : '')} data-cp-puce={p.id} data-cp-puce-valeur={String(p.valeur)} data-cp-puce-sous={p.sousAchat ? '1' : undefined} disabled={!vivante}
                onClick={() => poserMini(a, p.valeur)} aria-keyshortcuts={String(i + 1)}>
                <span className="vrm-cp-puce-regle">{p.sorte === 'pct' ? tr('cpl.mini.pct', { v: p.v }) : tr('cpl.mini.achatPlus', { v: p.v })}</span>
                <b className="vrm-cp-puce-val">{eur(p.valeur)}</b>
                {p.sousAchat ? <span className="vrm-cp-puce-note">{tr('cpl.mini.sousAchat', { prix: eur(p.cout) })}</span> : null}
                <kbd className="vrm-cp-raccourci" aria-hidden="true">{i + 1}</kbd>
              </button>
            ))}
          </div>
        ) : null}
        {pave ? <Pave valeur={vivante ? saisie : ''} onTouche={vivante ? touche : () => {}} onOk={valider} okActif={okActif} note={note} ambre={!!(jm && (jm.sousAchat || jm.auPrix))}/> : null}
        {q === 'achat' && vivante && achats === undefined ? <p className="vrm-cp-legende" data-cp-attente="">{tr('cpl.achat.cherche')}</p> : null}
        {q === 'achat' || q === 'mini' ? (
          <div className="vrm-cp-gestes">
            {q === 'achat' && !pave ? <button type="button" className="vrm-cp-teinte" data-cp-taper="" disabled={!vivante} onClick={() => setMode('pave')}>{tr('cpl.achat.taper')}</button> : null}
            {q === 'achat' && pave && c.liste.length ? <button type="button" className="vrm-cp-teinte" data-cp-proposes="" disabled={!vivante} onClick={() => { setMode('choix'); setSaisie(''); }}>{tr('cpl.achat.proposes')}</button> : null}
            {q === 'achat' && onAutreAchat ? <button type="button" className="vrm-cp-teinte" data-cp-autre-achat="" disabled={!vivante} onClick={() => onAutreAchat(a)}>{tr('cpl.achat.autre')}</button> : null}
            {q === 'mini' && !pave ? <button type="button" className="vrm-cp-teinte" data-cp-autre-montant="" disabled={!vivante} onClick={() => setMode('pave')}>{tr('cpl.mini.autre')}</button> : null}
            {q === 'mini' && pave && pu.length ? <button type="button" className="vrm-cp-teinte" data-cp-reductions="" disabled={!vivante} onClick={() => { setMode('choix'); setSaisie(''); }}>{tr('cpl.mini.puces')}</button> : null}
          </div>
        ) : null}
        <div className="vrm-cp-liens">
          {(q === 'achat' || q === 'mini') && !(vivante && enRetour) ? <button type="button" className="vrm-cp-texte" data-cp-sans={q} disabled={!vivante} onClick={() => neSaitPlus(a, q)}>{tr(q === 'achat' ? 'cpl.achat.sansPlus' : 'cpl.mini.sans')}</button> : <span/>}
          <button type="button" className="vrm-cp-texte" data-cp-plus-tard="" disabled={!vivante} onClick={plusTard}>{vivante && enRetour ? tr('cpl.retourFile') : tr('cpl.plusTard')}</button>
        </div>
        {q === 'mini' && vivante && miniActif === false ? <p className="vrm-cp-legende" data-cp-mini-eteint="">{tr('cpl.mini.eteint')}</p> : null}
      </div>
    );
  };
  const carte = (a, vivante) => (a ? (
    <section key={a.cle + (vivante && enRetour ? '|r' : '')} className={'vrm-cp-carte ' + (vivante ? 'is-courante' : 'is-suivante')} data-cp-carte={vivante ? a.cle : undefined} data-cp-suivante={vivante ? undefined : a.cle}
      aria-hidden={vivante ? undefined : 'true'} inert={vivante ? undefined : ''}>
      <Article a={a} Photo={Photo} Plaque={Plaque} vend={vend}/>
      {zoneQuestion(a, vivante ? question : qDe(a)[0], vivante)}
    </section>
  ) : null);

  // ── La fin (ou rien à faire ici) ──
  const fin = (
    <section className="vrm-cp-carte is-courante vrm-cp-fin" data-cp-fin={sujet}>
      <span className="vrm-cp-fin-coche" aria-hidden="true"><Coche/></span>
      <h2 className="vrm-cp-q">{sujet === 'tout' && genre === 'tous' && !nPlusTard ? tr('cpl.fin.titre') : tr('cpl.fin.sujet')}</h2>
      {nPlusTard ? <button type="button" className="vrm-cp-teinte" data-cp-reprendre="" onClick={() => setSautees(new Set())}>{tr('cpl.fin.reprendre', { n: nPlusTard })}</button> : null}
      {(sujet !== 'tout' || genre !== 'tous') && C && C.articles ? <button type="button" className="vrm-cp-teinte" data-cp-voir-tout="" onClick={() => { setGenre('tous'); changerSujet('tout'); }}>{tr('cpl.fin.voirTout', { n: C.articles })}</button> : null}
      {C && C.anciennes && sujet !== 'anciennes' ? <button type="button" className="vrm-cp-texte" data-cp-anciennes="" onClick={() => changerSujet('anciennes')}>{tr('cpl.fin.anciennes', { n: C.anciennes })}</button> : null}
      {arrivees && arrivees.n > 0 ? <button type="button" className="vrm-cp-texte" data-cp-arrivees="" onClick={() => { fermer(); arrivees.ouvrir(); }}>{tr('cpl.reste.arrivees')} · {arrivees.n}</button> : null}
      <button type="button" className="vrm-cp-plein" data-cp-fin-fermer="" onClick={fermer}>{tr('cpl.fin.fermer')}</button>
    </section>
  );

  // ── « Ce qui reste » (une feuille) : En ligne · Vendues, par sorte, la règle en lot, ce qui est mis de côté ──
  const ligneReste = (s, lib, n, extra = null) => (n ? (
    <li key={s}><button type="button" className="vrm-cp-ligne" data-cp-sujet={s} aria-current={sujet === s ? 'true' : undefined} onClick={() => changerSujet(s)}><span>{lib}</span><b>{n}</b></button>{extra}</li>
  ) : null);
  const feuilleReste = resteOuvert ? (
    <div className="vrm-cp-voile" onClick={() => setResteOuvert(false)}>
      <div className="vrm-cp-feuille" role="dialog" aria-modal="true" aria-label={tr('cpl.reste.titre')} data-cp-reste="" onClick={(e) => e.stopPropagation()}>
        <span className="vrm-cp-poignee" aria-hidden="true"/>
        <h2 className="vrm-cp-q">{tr('cpl.reste.titre')}</h2>
        <div className="vrm-cp-segmente" role="group" aria-label={tr('cpl.genre.titre')}>
          {GENRES.map((g) => <button key={g} type="button" className="vrm-cp-segment" data-cp-genre={g} aria-pressed={genre === g} onClick={() => changerGenre(g)}>{tr('cpl.genre.' + g)}</button>)}
        </div>
        <ul className="vrm-cp-groupe">
          {ligneReste('tout', tr('cpl.reste.tout'), C ? C.articles : 0)}
          {ligneReste('achat', tr('cpl.reste.achat'), C ? C.achat : 0)}
          {ligneReste('mini', tr('cpl.reste.mini'), C ? C.mini : 0, C && C.mini > 1 ? <button type="button" className="vrm-cp-texte" data-cp-lot-ouvrir="" onClick={ouvrirLot}>{tr('cpl.reste.lot')}</button> : null)}
          {ligneReste('numero', tr('cpl.reste.numero'), C ? C.numero : 0)}
          {ligneReste('prix', tr('cpl.reste.prix'), C ? C.prix : 0)}
          {ligneReste('anciennes', tr('cpl.reste.anciennes'), C ? C.anciennes : 0)}
          {arrivees && arrivees.n > 0 ? <li><button type="button" className="vrm-cp-ligne" data-cp-arrivees="" onClick={() => { fermer(); arrivees.ouvrir(); }}><span>{tr('cpl.reste.arrivees')}</span><b>{arrivees.n}</b></button></li> : null}
        </ul>
        {C && C.mis ? <div className="vrm-cp-mis"><span>{tr('cpl.reste.mis', { n: C.mis })}</span><button type="button" className="vrm-cp-texte" data-cp-revoir="" onClick={() => { const ops = opsRevoir(courant().sans); if (ops.length) geste(tr('cpl.fait.revoir', { n: ops.length }), ops); setResteOuvert(false); }}>{tr('cpl.reste.revoir')}</button></div> : null}
        {large ? <p className="vrm-cp-legende">{tr('cpl.clavier')}</p> : null}
      </div>
    </div>
  ) : null;

  // ── La règle en lot des prix mini (une feuille pleine hauteur) ──
  const feuilleLot = () => {
    const articles = resTout ? filtrer(resTout, 'mini') : [];
    const ap = apercuLot(articles, regle);
    const ecr = ecrituresLot(ap, choix);
    const cochees = new Set(ecr.map((w) => w.cle));
    const ecartees = ap.filter((l) => l.ecartee && !cochees.has(l.cle));
    const poser = () => {
      const ops = opsMini(ecr, { fiches: courant().fiches, ficheNeuveDe }); if (!ops.length) return;
      geste(tr('cpl.fait.lot', { n: ecr.length }), ops); setRegle(null); setChoix({}); setLotOuvert(false);
    };
    const estRegle = (s, v) => !!regle && regle.sorte === s && regle.v === v && !regle.autre;
    return (
      <div className="vrm-cp-voile">
        <div className="vrm-cp-feuille is-pleine" role="dialog" aria-modal="true" aria-label={tr('cpl.lot.titre')} data-cp-lot={articles.length}>
          <span className="vrm-cp-poignee" aria-hidden="true"/>
          <div className="vrm-cp-feuille-tete">
            <button type="button" className="vrm-cp-texte" data-cp-lot-fermer="" onClick={() => setLotOuvert(false)}>{tr('cpl.fermer')}</button>
            <b className="vrm-cp-feuille-titre">{tr('cpl.lot.titre')}</b>
            <button type="button" className="vrm-cp-texte" data-cp-un-par-un="" onClick={() => changerSujet('mini')}>{tr('cpl.lot.unParUn')}</button>
          </div>
          <p className="vrm-cp-legende">{tr('cpl.lot.phrase', { n: articles.length })}</p>
          <div className="vrm-cp-segmente" role="group" aria-label={tr('cpl.lot.choisir')}>
            {LOT_POURCENTS.map((p) => <button key={p} type="button" className="vrm-cp-segment" data-cp-regle={'p' + p} aria-pressed={estRegle('pct', p)} onClick={() => { setRegle({ sorte: 'pct', v: p }); setChoix({}); }}>{tr('cpl.mini.pct', { v: p })}</button>)}
            <button type="button" className="vrm-cp-segment" data-cp-regle="autre" aria-pressed={!!(regle && regle.autre)} onClick={() => { const v = Number(autrePct) || 25; setAutrePct(String(v)); setRegle({ sorte: 'pct', v, autre: true }); setChoix({}); }}>{tr('cpl.lot.autre')}</button>
            <button type="button" className="vrm-cp-segment" data-cp-regle={'a' + ACHAT_PLUS} aria-pressed={estRegle('achat', ACHAT_PLUS)} onClick={() => { setRegle({ sorte: 'achat', v: ACHAT_PLUS }); setChoix({}); }}>{tr('cpl.mini.achatPlus', { v: ACHAT_PLUS })}</button>
          </div>
          {regle && regle.autre ? (
            <label className="vrm-cp-champ"><span>{tr('cpl.lot.champ')}</span>
              <input type="text" inputMode="numeric" enterKeyHint="done" autoComplete="off" data-cp-autre-pct="" value={autrePct} onChange={(e) => { const t = e.target.value.replace(/\D/g, '').slice(0, 2); setAutrePct(t); const v = Number(t); if (v >= 1 && v <= 90) { setRegle({ sorte: 'pct', v, autre: true }); setChoix({}); } }}/>
              <b aria-hidden="true">%</b></label>
          ) : null}
          <ul className="vrm-cp-groupe vrm-cp-lot-liste" data-cp-lot-liste="">
            {ap.slice(0, 400).map((l) => {
              const coche = cochees.has(l.cle);
              return (
                <li key={l.cle} className={'vrm-cp-lot-l' + (l.ecartee ? ' is-ecartee' : '')} data-cp-lot-ligne={l.id} data-cp-lot-mini={l.mini == null ? '' : String(l.mini)} data-cp-lot-ecartee={l.ecartee || undefined} data-cp-lot-coche={coche ? '1' : '0'}>
                  <label>
                    <input type="checkbox" checked={coche} disabled={!l.cochable} onChange={(e) => setChoix((c) => ({ ...c, [l.cle]: e.target.checked }))} aria-label={tr('cpl.lot.cocher', { qui: l.numero ? `N°${l.numero}` : l.titre })}/>
                    <span className="vrm-cp-vignette is-petite">{l.photo && Photo ? <Photo src={l.photo} alt="" loading="lazy" decoding="async"/> : null}</span>
                    <span className="vrm-cp-rangee-txt"><span className="vrm-cp-nom">{l.numero && Plaque ? <Plaque n={l.numero} taille="petit"/> : null}<span>{l.titre}</span></span>
                      {l.ecartee ? <span className="vrm-cp-rangee-sous is-ambre" data-cp-lot-raison={l.ecartee}>{tr('cpl.lot.ecartee.' + l.ecartee, { prix: eur(l.achat) })}</span> : null}</span>
                    <span className="vrm-cp-lot-prix"><span>{eur(l.prix)}</span>{l.mini != null ? <b>→ {eur(l.mini)}</b> : <b>—</b>}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="vrm-cp-pied">
            <p className="vrm-cp-legende">{!regle ? tr('cpl.lot.choisir') : ecartees.length ? tr('cpl.lot.ecartees', { n: ecartees.length }) + ' · ' : ''}{regle ? tr(miniActif === false ? 'cpl.lot.noteEteint' : 'cpl.lot.note') : ''}</p>
            <button type="button" className="vrm-cp-plein" data-cp-lot-poser={ecr.length} disabled={!ecr.length} onClick={poser}>{ecr.length ? tr('cpl.lot.poser', { n: ecr.length }) : tr('cpl.lot.rien')}</button>
          </div>
        </div>
      </div>
    );
  };

  // ── La grille (ordinateur, facultative) : N° · photo · titre · prix · prix mini · acheté ──
  const vueGrille = () => {
    const cles = grille.cles || liste0.slice(0, 150).map((a) => a.cle);
    const vivants = new Map(liste0.map((a) => [a.cle, a]));
    const figes = grille.figes || {};
    const poserCase = (a, q, texte) => {
      const t = String(texte || '').trim(); if (!t || grille.poses[a.cle + '|' + q] === t) return;
      const m = montantTape(t.replace('.', ',')); if (m == null) return;
      const ok = q === 'achat' ? poserPrixAchat(a, t) : q === 'mini' ? (!jugerMini(a, m).auPrix && poserMini(a, m)) : poserPrix(a, m);
      if (ok) setGrille((g) => ({ ...g, poses: { ...g.poses, [a.cle + '|' + q]: t } }));
    };
    const champ = (a, q, i) => {
      const k = a.cle + '|' + q;
      if (!a.manques.includes(q) && !grille.poses[k]) return q === 'achat' && a.achat != null ? eur(a.achat) : q === 'prix' ? eur(a.prix) : '';
      return <input type="text" inputMode="decimal" autoComplete="off" className="vrm-cp-case" data-cp-case={k} data-cp-case-rang={i} data-cp-case-q={q} data-cp-case-pose={grille.poses[k] ? '1' : undefined}
        aria-label={tr(q === 'mini' ? 'cpl.grille.champMini' : q === 'achat' ? 'cpl.grille.champAchat' : 'cpl.grille.champPrix', { qui: QUI(a) })} value={grille.vals[k] || ''}
        onChange={(e) => { const v = e.target.value.slice(0, 9); setGrille((g) => ({ ...g, cles, vals: { ...g.vals, [k]: v } })); }}
        onBlur={(e) => poserCase(a, q, e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); poserCase(a, q, e.currentTarget.value); const s = racine.current && racine.current.querySelector(`[data-cp-case-rang="${i + 1}"][data-cp-case-q="${q}"]`); if (s) s.focus(); } }}/>;
    };
    return (
      <section className="vrm-cp-grille" data-cp-grille={cles.length}>
        <table>
          <thead><tr><th>{tr('cpl.col.numero')}</th><th aria-label={tr('cpl.col.photo')}/><th>{tr('cpl.col.titre')}</th><th className="is-n">{tr('cpl.col.prix')}</th><th className="is-n">{tr('cpl.col.mini')}</th><th className="is-n">{tr('cpl.col.achat')}</th></tr></thead>
          <tbody>
            {cles.map((cle, i) => {
              const a = vivants.get(cle) || figes[cle]; if (!a) return null;
              return (
                <tr key={cle} data-cp-ligne={cle}>
                  <td>{a.numero && Plaque ? <Plaque n={a.numero} taille="petit"/> : null}</td>
                  <td><span className="vrm-cp-vignette is-petite">{a.photo && Photo ? <Photo src={a.photo} alt="" loading="lazy" decoding="async"/> : null}</span></td>
                  <td className="vrm-cp-grille-titre">{a.titre}</td>
                  <td className="is-n">{a.genre === 'fiche' ? champ(a, 'prix', i) : eur(a.prix)}</td>
                  <td className="is-n">{a.genre === 'annonce' ? champ(a, 'mini', i) : ''}</td>
                  <td className="is-n">{a.genre !== 'fiche' ? champ(a, 'achat', i) : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    );
  };
  const ouvrirGrille = () => { const l = liste0.slice(0, 150); setGrille({ cles: l.map((a) => a.cle), figes: Object.fromEntries(l.map((a) => [a.cle, a])), vals: {}, poses: {} }); setVue('grille'); };

  const corps = entrees === undefined ? <p className="vrm-cp-etat" data-cp-etat="lecture">{tr('cpl.lecture')}</p>
    : !res ? <p className="vrm-cp-etat" data-cp-etat="pas-su">{tr('cpl.pasSu')}</p>
    : vue === 'grille' ? vueGrille()
    : (
      <div className="vrm-cp-scene" data-cp-scene="">
        {article ? carte(article, true) : fin}
        {suivant && suivant.cle !== (article && article.cle) ? carte(suivant, false) : null}
      </div>
    );
  const position = article && !enRetour ? sortis + idx + 1 : 0;

  return createPortal(
    <div ref={racine} className={'vrm-cp' + (large ? ' is-large' : '')} data-completer={sujet} data-cp-vue={lotOuvert ? 'lot' : vue} data-cp-large={large ? '1' : '0'} role="dialog" aria-modal="true" aria-label={tr('cpl.titre')}>
      {Retour ? <Retour fermer={fermer}/> : null}
      <header className="vrm-cp-barre">
        <button type="button" className="vrm-cp-nav" data-cp-fermer="" aria-label={vue === 'grille' ? tr('cpl.titre') : tr('cpl.fermer')} onClick={vue === 'grille' ? () => setVue('cartes') : fermer}><Chevron/></button>
        <button type="button" className="vrm-cp-progres" data-cp-progres={position && vue === 'cartes' ? `${position}/${total}` : ''} aria-haspopup="dialog" onClick={() => setResteOuvert(true)}>
          <span className="vrm-cp-progres-n">{vue === 'grille' ? tr('cpl.vue.grille') : position ? tr('cpl.progression', { i: position, n: total }) : tr('cpl.titre')}</span>
          {libSujet && vue === 'cartes' ? <span className="vrm-cp-progres-s">{libSujet}</span> : null}
          <Bas/>
        </button>
        <span className="vrm-cp-barre-droite">
          {large && vue === 'cartes' && liste0.length ? <button type="button" className="vrm-cp-texte" data-cp-grille-ouvrir="" onClick={ouvrirGrille}>{tr('cpl.vue.grille')}</button> : null}
          {vue === 'cartes' ? <button type="button" className="vrm-cp-nav" data-cp-reculer="" aria-label={tr('cpl.retour')} disabled={!histo.length || retour === 0} onClick={reculer}><Revoir/></button> : null}
        </span>
      </header>
      <progress className="vrm-cp-avance" aria-hidden="true" value={total ? sortis + (article ? idx : liste.length) : 0} max={Math.max(1, total)}/>
      <Bandeau gestes={gestes}/>
      <div className="vrm-cp-corps">
        {large && vue === 'cartes' && res ? (
          <nav className="vrm-cp-file" aria-label={tr('cpl.reste.titre')} data-cp-file={liste.length}>
            <ul>
              {liste.slice(0, 200).map((a, i) => (
                <li key={a.cle}><button type="button" className="vrm-cp-file-l" data-cp-file-ligne={a.cle} aria-current={!enRetour && article && a.cle === article.cle ? 'true' : undefined} onClick={() => { setRetour(null); dernierIdx.current = i; setSaisie(''); setMode('choix'); forcer((n) => n + 1); }}>
                  <span className="vrm-cp-vignette is-petite">{a.photo && Photo ? <Photo src={a.photo} alt="" loading="lazy" decoding="async"/> : null}</span>
                  <span className="vrm-cp-rangee-txt"><span className="vrm-cp-nom">{a.numero && Plaque ? <Plaque n={a.numero} taille="petit"/> : null}<span>{a.titre}</span></span>
                    <span className="vrm-cp-rangee-sous">{qDe(a).map((q) => tr('cpl.reste.' + q)).join(' · ')}</span></span>
                </button></li>
              ))}
            </ul>
          </nav>
        ) : null}
        <main className="vrm-cp-main">{corps}</main>
      </div>
      {feuilleReste}
      {lotOuvert && resTout ? feuilleLot() : null}
    </div>,
    document.body,
  );
}
