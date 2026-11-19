// ════════════════════════════════════════════════════════════════════════════
//  L'ATELIER « COMPLÉTER » (19 nov. 2026, lot completer-infos) — l'écran
// ════════════════════════════════════════════════════════════════════════════
// Julien : « trouve autre chose pour relier les achats, mettre les prix plancher minimum, mettre
// les prix — toutes les informations […] ça doit être beaucoup plus simple et rapide » ; « l'outil
// doit être pratique, pas chiant ».
// Une PAGE POUSSÉE du design natif (docs/design/NATIF.md, src/natif/) : `PagePoussee`, `Faits`,
// `Groupe` + `Rangee` (les achats proposés), `Bouton`, `Segmente`, `Feuille` (« Ce qui reste », la
// règle en lot), `Toast` (« Annuler », 10 s) ; le pavé et les puces sont dans les mêmes jetons.
//   · UNE file, UNE question à la fois : la photo, la plaque N°, le titre, ses faits ; puis
//     seulement ce qui MANQUE ;
//   · « Payée combien ? » : jusqu'à 3 achats proposés en rangées photo — UN toucher relie (c'est
//     SON geste, par le n° de transaction de la rangée) ; sinon le pavé ; « Autre achat » ; « Je ne
//     sais plus » ; « Plus tard » ;
//   · « Ton prix mini ? » : des puces calculées et DITES (« −15 % → 72 € ») ; ou le pavé ;
//   · chaque réponse = UNE écriture annulable 10 s, et la carte suivante TOUT DE SUITE (déjà
//     dessinée, ses photos décodées ; l'écriture part après elle) ;
//   · la règle en lot des prix mini : choisir, voir l'aperçu ligne par ligne, décocher, poser ;
//   · à l'ordinateur : la file à gauche, la carte à droite, tout au clavier ; une vue « grille ».
// Les règles : src/completer/regles.js (pures, exécutées par scripts/audit-completer.cjs).
// Aucune confirmation là où « Annuler » suffit ; aucun texte à lire à chaque carte ; aucun style
// en ligne.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { portailNatif } from '../natif/outils.js';
import { tr, monnaie } from '../i18n/index.js';
import { PagePoussee, Groupe, Rangee, Plaque, Bouton, BoutonIcone, Segmente, Feuille, Faits, Fait, Toast, useOrdinateur, poserIcone, iconePosee } from '../natif/index.js';
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
const racine = () => (typeof document !== 'undefined' ? document.querySelector('[data-completer]') : null);
// La vignette d'une rangée : la photo de l'app (ses adresses Vinted se relisent) dans la forme du natif.
const vignette = (Photo, src, taille = 56) => (src && Photo ? <Photo src={src} alt="" className="n-vignette" data-n-taille={String(taille)} width={taille} height={taille} decoding="async" draggable={false}/> : <span className="n-vignette n-vignette-vide" data-n-taille={String(taille)} aria-hidden="true"/>);

// ── LE PAVÉ : grosses touches, virgule (« OK », le bouton plein, est collé en bas de la page) ──
function Pave({ valeur, onTouche, note = null, ambre = false }) {
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
            {t === 'efface' ? '⌫' : t}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── « ANNULER » (10 s) : le Toast du natif, tenu par le moteur des gestes (src/gesteAnnulable.js) ──
function Bandeau({ gestes }) {
  const [etat, setEtat] = useState(() => (gestes ? gestes.etat() : { visible: null }));
  useEffect(() => (gestes ? gestes.abonner(setEtat) : undefined), [gestes]);
  const v = etat && etat.visible;
  if (!v) return null;
  // Par le portail du natif (comme les feuilles) : rendu à côté de la page, il restait dans l'écran
  // d'en dessous, masqué sur téléphone — « Annuler » n'était plus visible (banc completer, 390 px).
  const cible = portailNatif(); if (!cible) return null;
  const echec = v.etat === 'echec' || v.etat === 'echec-annulation';
  const texte = v.etat === 'annulation' ? tr('cpl.annulation') : v.etat === 'annule' ? tr('cpl.annule') : echec ? `${tr('cpl.pasEnregistre')} · ${v.texte}` : v.etat === 'garde' ? `${v.texte} · ${tr('cpl.garde')}` : v.texte;
  return createPortal(
    <div data-cp-bandeau={v.etat}>
      <Toast key={v.id + ':' + v.etat} className="vrm-cp-toast" message={texte} duree={600000}
        onAnnuler={v.peutAnnuler ? () => gestes.annuler(v.id) : v.peutReessayer ? () => gestes.reessayer(v.id) : null} libelleAnnuler={v.peutReessayer ? tr('cpl.reessayer') : tr('cpl.annuler')}/>
    </div>,
    cible
  );
}

// ── L'ARTICLE : la photo en grand, la plaque, le titre, ses faits ──
function Article({ a, Photo, vend }) {
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
        {a.numero ? <span className="vrm-cp-plaque"><Plaque numero={a.numero} grand/></span> : null}
      </div>
      <p className="vrm-cp-titre" data-cp-titre="">{a.titre || tr('cpl.sansTitre')}</p>
      <Faits colonnes={Math.max(2, faits.length)}>{faits.map(([l, v]) => <Fait key={l} libelle={l} valeur={v}/>)}</Faits>
    </div>
  );
}

// ── UN ACHAT PROPOSÉ : une rangée — sa photo, son titre, ce qu'on en sait, ce qu'il a payé ──
function RangeeAchat({ c, article, Photo, prixDe, photoDe, compteDe, details, onChoisir, vivante }) {
  const a = c.achat;
  const f = faitsAchat(a, { details, cible: { taille: article.taille, titre: article.titre } });
  const px = c.lot ? null : prixDe(a);
  const pourquoi = c.niveau === 'identite' ? [tr('liaison.p.photo')] : morceauxPourquoi(c.p).filter((m) => m.cle !== 'tailleInconnue' && m.cle !== 'marque' && m.cle !== 'taille' && m.cle !== 'mots').map((m) => {
    if (m.cle === 'couleur') return COULEURS.includes(m.vars.couleur) ? tr('liaison.couleur.' + m.vars.couleur) : '';
    if (m.cle === 'couleurPhoto') return COULEURS.includes(m.vars.couleur) ? tr('liaison.p.couleurPhoto', { couleur: tr('liaison.couleur.' + m.vars.couleur) }) : '';
    return tr('liaison.p.' + m.cle, m.cle.startsWith('jours.') ? { n: Number(m.vars.n) } : m.vars);
  }).filter(Boolean).slice(0, 1);
  const sous = [f.taille ? (f.accord === 'meme' ? '✓ ' : '') + tr('cpl.taille', { taille: f.taille }) : '', f.vendeur || a.seller || a.user_login || '', jourCourt(a.date), compteDe ? compteDe(a) : '', ...pourquoi].filter(Boolean);
  return <Rangee vignette={vignette(Photo, photoDe(a))} titre={a.title || ''} lignes={2} sousTitre={sous.join(' · ')} valeur={c.lot ? tr('cpl.achat.lot') : px != null ? eur(px) : '—'} valeurForte
    onClick={vivante ? () => onChoisir(c) : undefined} attrs={{ 'data-cp-achat': c.tx, 'data-cp-niveau': c.niveau, 'data-cp-achat-prix': px == null ? '' : String(px), 'data-cp-achat-taille': f.taille || undefined }}/>;
}

export default function Completer({ demande = null, entrees, achats, liens = null, liaison = null, identiteDe = null, prixDe = () => null, photoDe = () => '', compteDe = null, details = null, horsRelier = null,
  courant, ficheNeuveDe = null, geste, gestes = null, onRelier, onAutreAchat = null, onNumero = null, numeroPropose = null, propositionDe = null, miniActif, arrivees = null, vend = 'sneakers',
  Photo = null, Icon = null, onFermer }) {
  if (Icon && !iconePosee()) poserIcone(Icon);
  const large = useOrdinateur();
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
  const [regle, setRegle] = useState(null), [choix, setChoix] = useState({}), [autrePct, setAutrePct] = useState('');
  const [grille, setGrille] = useState({ cles: null, vals: {}, poses: {} });
  const [, forcer] = useState(0);
  const dernierIdx = useRef(0), pret = useRef(false), vus = useRef(new Set()), certainsFaits = useRef(false), lotJuge = useRef(false);

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
  const nPlusTard = liste0.filter((a) => questionsDe(a, sujet, res ? res.miniActif : true).some((q) => sautees.has(a.cle + '|' + q)) && !qDe(a).length).length;

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
      // Un lot : le prix de CET article est demandé (jamais partagé tout seul) — la carte attend sa réponse.
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
    if (question === 'numero') {
      const v = saisie || (numeroPropose ? String(numeroPropose() || '') : ''); if (!v || !onNumero) return;
      // Le N° passe par l'écriture de l'app (ses garde-fous) ; la question suivante attend qu'il soit RANGÉ sur l'appareil.
      setOccupe(true);
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

  // ── Le clavier (ordinateur) : chiffres, Entrée, Tab, 1/2/3, ← ──
  const actions = useRef({});
  actions.current = { touche, valider, plusTard, reculer, relier, poserMini, setMode, etat: { vue, lotOuvert, resteOuvert, question, enPave, cand, puces, article, saisie } };
  useEffect(() => {
    const f = (e) => {
      const A = actions.current, S = A.etat;
      const t = e.target; const champ = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Une feuille au-dessus (« Autre achat », « Ce qui reste », une question de l'app) garde son clavier.
      const r = racine();
      if (document.querySelector('[data-relier-feuille]') || (t && t !== document.body && r && !r.contains(t))) return;
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
  const position = article && !enRetour ? sortis + idx + 1 : 0;
  const libSujet = [{ tout: '', achat: tr('cpl.reste.achat'), mini: tr('cpl.reste.mini'), prix: tr('cpl.reste.prix'), numero: tr('cpl.reste.numero'), anciennes: tr('cpl.reste.anciennes') }[sujet] || '',
    genre === 'annonce' ? tr('cpl.genre.annonce') : genre === 'vente' ? tr('cpl.genre.vente') : ''].filter(Boolean).join(' · ');
  const titreQ = (q) => (q === 'achat' ? tr(vend === 'sneakers' ? 'cpl.q.achat.sneakers' : 'cpl.q.achat.autre') : tr('cpl.q.' + q));
  const ic = (name) => (Icon ? <Icon name={name} size={22}/> : null);

  // ── La zone de la question ──
  const m = montantTape(saisie);
  const jm = question === 'mini' && article && m != null ? jugerMini(article, m) : null;
  const okActif = !!article && !occupe && (question === 'numero' ? !!(saisie || (numeroPropose && numeroPropose())) : m != null && !(jm && jm.auPrix));
  const zoneQuestion = (a, q, vivante) => {
    if (!a || !q) return null;
    const c = vivante ? cand : candSuivant;
    const pu = vivante ? puces : (q === 'mini' ? pucesMini(a) : []);
    const pave = vivante ? enPave : (q === 'prix' || q === 'numero' || (q === 'achat' && !c.liste.length) || (q === 'mini' && !pu.length));
    const note = !vivante ? null : q === 'mini' && jm ? (jm.auPrix ? tr('cpl.mini.auPrix') : jm.sousAchat ? tr('cpl.mini.sousAchat', { prix: eur(jm.cout) }) : null)
      : q === 'numero' && !saisie && numeroPropose ? tr('cpl.numero.propose', { num: String(numeroPropose() || '') }) : null;
    return (
      <div className="vrm-cp-question" data-cp-question={vivante ? q : undefined} data-cp-mode={pave ? 'pave' : 'choix'}>
        <h2 className="vrm-cp-q">{titreQ(q)}</h2>
        {vivante && enRetour && enRetour.resume ? <p className="vrm-cp-legende" data-cp-deja="">{enRetour.resume}</p> : null}
        {q === 'achat' && !pave ? (
          <Groupe nu className="vrm-cp-groupe" attrs={{ 'data-cp-achats': String(c.liste.length) }}>
            {c.liste.map((x) => <RangeeAchat key={x.tx} c={x} article={a} Photo={Photo} prixDe={prixDe} photoDe={photoDe} compteDe={compteDe} details={details} onChoisir={relier} vivante={vivante && !occupe}/>)}
          </Groupe>
        ) : null}
        {q === 'mini' && !pave ? (
          <div className="vrm-cp-puces" data-cp-puces={pu.length}>
            {pu.map((p, i) => (
              <button key={p.id} type="button" className="vrm-cp-puce" data-cp-puce={p.id} data-cp-puce-valeur={String(p.valeur)} data-cp-puce-sous={p.sousAchat ? '1' : undefined} disabled={!vivante}
                onClick={() => poserMini(a, p.valeur)} aria-keyshortcuts={String(i + 1)}>
                <span className="vrm-cp-puce-regle">{p.sorte === 'pct' ? tr('cpl.mini.pct', { v: p.v }) : tr('cpl.mini.achatPlus', { v: p.v })}</span>
                <b className="vrm-cp-puce-val">{eur(p.valeur)}</b>
                {p.sousAchat ? <span className="vrm-cp-puce-note">{tr('cpl.mini.sousAchat', { prix: eur(p.cout) })}</span> : null}
              </button>
            ))}
          </div>
        ) : null}
        {pave ? <Pave valeur={vivante ? saisie : ''} onTouche={vivante ? touche : () => {}} note={note} ambre={!!(vivante && jm && (jm.sousAchat || jm.auPrix))}/> : null}
        {q === 'achat' && vivante && achats === undefined ? <p className="vrm-cp-legende" data-cp-attente="">{tr('cpl.achat.cherche')}</p> : null}
        {q === 'achat' || q === 'mini' ? (
          <div className="vrm-cp-gestes">
            {q === 'achat' && !pave ? <Bouton large onClick={() => setMode('pave')} attrs={{ 'data-cp-taper': '' }}>{tr('cpl.achat.taper')}</Bouton> : null}
            {q === 'achat' && pave && c.liste.length ? <Bouton large onClick={() => { setMode('choix'); setSaisie(''); }} attrs={{ 'data-cp-proposes': '' }}>{tr('cpl.achat.proposes')}</Bouton> : null}
            {q === 'achat' && onAutreAchat ? <Bouton large onClick={() => onAutreAchat(a)} attrs={{ 'data-cp-autre-achat': '' }}>{tr('cpl.achat.autre')}</Bouton> : null}
            {q === 'mini' && !pave ? <Bouton large onClick={() => setMode('pave')} attrs={{ 'data-cp-autre-montant': '' }}>{tr('cpl.mini.autre')}</Bouton> : null}
            {q === 'mini' && pave && pu.length ? <Bouton large onClick={() => { setMode('choix'); setSaisie(''); }} attrs={{ 'data-cp-reductions': '' }}>{tr('cpl.mini.puces')}</Bouton> : null}
          </div>
        ) : null}
        <div className="vrm-cp-liens">
          {(q === 'achat' || q === 'mini') && !(vivante && enRetour) ? <Bouton variante="texte" onClick={() => neSaitPlus(a, q)} attrs={{ 'data-cp-sans': q }}>{tr(q === 'achat' ? 'cpl.achat.sansPlus' : 'cpl.mini.sans')}</Bouton> : <span/>}
          <Bouton variante="texte" onClick={plusTard} attrs={{ 'data-cp-plus-tard': '' }}>{vivante && enRetour ? tr('cpl.retourFile') : tr('cpl.plusTard')}</Bouton>
        </div>
        {q === 'mini' && vivante && miniActif === false ? <p className="vrm-cp-legende" data-cp-mini-eteint="">{tr('cpl.mini.eteint')}</p> : null}
      </div>
    );
  };
  const carte = (a, vivante) => (a ? (
    <section key={a.cle + (vivante && enRetour ? '|r' : '')} className={'vrm-cp-carte ' + (vivante ? 'is-courante' : 'is-suivante')} data-cp-carte={vivante ? a.cle : undefined} data-cp-suivante={vivante ? undefined : a.cle}
      aria-hidden={vivante ? undefined : 'true'} inert={vivante ? undefined : ''}>
      <Article a={a} Photo={Photo} vend={vend}/>
      {zoneQuestion(a, vivante ? question : qDe(a)[0], vivante)}
    </section>
  ) : null);

  // ── La fin (ou rien à faire ici) ──
  const fin = (
    <section className="vrm-cp-carte is-courante vrm-cp-fin" data-cp-fin={sujet}>
      <h2 className="vrm-cp-q">{sujet === 'tout' && genre === 'tous' && !nPlusTard ? tr('cpl.fin.titre') : tr('cpl.fin.sujet')}</h2>
      {nPlusTard ? <Bouton large onClick={() => setSautees(new Set())} attrs={{ 'data-cp-reprendre': '' }}>{tr('cpl.fin.reprendre', { n: nPlusTard })}</Bouton> : null}
      {(sujet !== 'tout' || genre !== 'tous') && C && C.articles ? <Bouton large onClick={() => { setGenre('tous'); changerSujet('tout'); }} attrs={{ 'data-cp-voir-tout': '' }}>{tr('cpl.fin.voirTout', { n: C.articles })}</Bouton> : null}
      {C && C.anciennes && sujet !== 'anciennes' ? <Bouton variante="texte" onClick={() => changerSujet('anciennes')} attrs={{ 'data-cp-anciennes': '' }}>{tr('cpl.fin.anciennes', { n: C.anciennes })}</Bouton> : null}
      {arrivees && arrivees.n > 0 ? <Bouton variante="texte" onClick={() => { fermer(); arrivees.ouvrir(); }} attrs={{ 'data-cp-arrivees': '' }}>{tr('cpl.reste.arrivees')} · {arrivees.n}</Bouton> : null}
    </section>
  );

  // ── « Ce qui reste » (une feuille) : En ligne · Vendues, par sorte, la règle en lot, ce qui est mis de côté ──
  const ligneReste = (s, lib, n) => (n ? <Rangee key={s} titre={lib} valeur={String(n)} fin={sujet === s ? 'coche' : 'chevron'} onClick={() => changerSujet(s)} attrs={{ 'data-cp-sujet': s, 'data-cp-n': String(n) }}/> : null);
  const feuilleReste = (
    <Feuille ouverte={resteOuvert} onFermer={() => setResteOuvert(false)} titre={tr('cpl.reste.titre')} attrs={{ 'data-cp-reste': '' }}>
      <Segmente libelle={tr('cpl.genre.titre')} valeur={genre} onChange={changerGenre} options={GENRES.map((g) => ({ cle: g, libelle: tr('cpl.genre.' + g) }))}/>
      <Groupe>
        {ligneReste('tout', tr('cpl.reste.tout'), C ? C.articles : 0)}
        {ligneReste('achat', tr('cpl.reste.achat'), C ? C.achat : 0)}
        {ligneReste('mini', tr('cpl.reste.mini'), C ? C.mini : 0)}
        {ligneReste('numero', tr('cpl.reste.numero'), C ? C.numero : 0)}
        {ligneReste('prix', tr('cpl.reste.prix'), C ? C.prix : 0)}
        {ligneReste('anciennes', tr('cpl.reste.anciennes'), C ? C.anciennes : 0)}
      </Groupe>
      <Groupe pied={large ? tr('cpl.clavier') : ''}>
        {C && C.mini > 1 ? <Rangee titre={tr('cpl.lot.titre')} fin="chevron" onClick={ouvrirLot} attrs={{ 'data-cp-lot-ouvrir': '' }}/> : null}
        {arrivees && arrivees.n > 0 ? <Rangee titre={tr('cpl.reste.arrivees')} valeur={String(arrivees.n)} fin="chevron" onClick={() => { fermer(); arrivees.ouvrir(); }} attrs={{ 'data-cp-arrivees': '' }}/> : null}
        {C && C.mis ? <Rangee titre={tr('cpl.reste.mis', { n: C.mis })} valeur={tr('cpl.reste.revoir')} onClick={() => { const ops = opsRevoir(courant().sans); if (ops.length) geste(tr('cpl.fait.revoir', { n: ops.length }), ops); setResteOuvert(false); }} attrs={{ 'data-cp-revoir': '' }}/> : null}
        {large && vue === 'cartes' && liste0.length ? <Rangee titre={tr('cpl.vue.grille')} fin="chevron" onClick={() => { setResteOuvert(false); ouvrirGrille(); }} attrs={{ 'data-cp-grille-ouvrir': '' }}/> : null}
      </Groupe>
    </Feuille>
  );

  // ── La règle en lot des prix mini (une feuille pleine hauteur) ──
  const articlesLot = resTout && lotOuvert ? filtrer(resTout, 'mini') : [];
  const ap = lotOuvert ? apercuLot(articlesLot, regle) : [];
  const ecr = ecrituresLot(ap, choix);
  const cochees = new Set(ecr.map((w) => w.cle));
  const ecartees = ap.filter((l) => l.ecartee && !cochees.has(l.cle));
  const poserLot = () => {
    const ops = opsMini(ecr, { fiches: courant().fiches, ficheNeuveDe }); if (!ops.length) return;
    geste(tr('cpl.fait.lot', { n: ecr.length }), ops); setRegle(null); setChoix({}); setLotOuvert(false);
  };
  const cleRegle = !regle ? '' : regle.autre ? 'autre' : (regle.sorte === 'pct' ? 'p' : 'a') + regle.v;
  const choisirRegle = (k) => {
    setChoix({});
    if (k === 'autre') { const v = Number(autrePct) || 25; setAutrePct(String(v)); setRegle({ sorte: 'pct', v, autre: true }); }
    else setRegle(k[0] === 'p' ? { sorte: 'pct', v: Number(k.slice(1)) } : { sorte: 'achat', v: Number(k.slice(1)) });
  };
  const feuilleLot = (
    <Feuille ouverte={lotOuvert} onFermer={() => setLotOuvert(false)} titre={tr('cpl.lot.titre')} detente="pleine" attrs={{ 'data-cp-lot': String(articlesLot.length) }}
      action={<Bouton variante="texte" onClick={() => changerSujet('mini')} attrs={{ 'data-cp-un-par-un': '' }}>{tr('cpl.lot.unParUn')}</Bouton>}
      pied={<Bouton variante="plein" onClick={poserLot} indisponible={!ecr.length} raison={!regle ? tr('cpl.lot.choisir') : tr('cpl.lot.rien')} attrs={{ 'data-cp-lot-poser': String(ecr.length) }}>{tr('cpl.lot.poser', { n: ecr.length })}</Bouton>}>
      <Segmente libelle={tr('cpl.lot.choisir')} valeur={cleRegle} onChange={choisirRegle} className="vrm-cp-regles"
        options={[...LOT_POURCENTS.map((p) => ({ cle: 'p' + p, libelle: tr('cpl.mini.pct', { v: p }) })), { cle: 'autre', libelle: tr('cpl.lot.autre') }, { cle: 'a' + ACHAT_PLUS, libelle: tr('cpl.mini.achatPlus', { v: ACHAT_PLUS }) }]}/>
      {regle && regle.autre ? (
        <label className="vrm-cp-champ"><span>{tr('cpl.lot.champ')}</span>
          <input type="text" inputMode="numeric" enterKeyHint="done" autoComplete="off" data-cp-autre-pct="" value={autrePct} onChange={(e) => { const t = e.target.value.replace(/\D/g, '').slice(0, 2); setAutrePct(t); const v = Number(t); if (v >= 1 && v <= 90) { setRegle({ sorte: 'pct', v, autre: true }); setChoix({}); } }}/>
          <b aria-hidden="true">%</b></label>
      ) : null}
      <Groupe titre={tr('cpl.lot.phrase', { n: articlesLot.length })} pied={regle ? [ecartees.length ? tr('cpl.lot.ecartees', { n: ecartees.length }) : '', tr(miniActif === false ? 'cpl.lot.noteEteint' : 'cpl.lot.note')].filter(Boolean).join(' · ') : ''} attrs={{ 'data-cp-lot-liste': '' }}>
        {ap.slice(0, 400).map((l) => {
          const coche = cochees.has(l.cle);
          return <Rangee key={l.cle} vignette={vignette(Photo, l.photo, 44)} plaque={l.numero ? <Plaque numero={l.numero}/> : null} titre={l.titre} sousTitre={l.ecartee ? tr('cpl.lot.ecartee.' + l.ecartee, { prix: eur(l.achat) }) : ''} ton={l.ecartee ? 'ambre' : 'neutre'}
            valeur={l.mini != null ? eur(l.mini) : '—'} valeurForte={coche} detailValeur={eur(l.prix)} fin={coche ? 'coche' : <span className="vrm-cp-sans-coche" aria-hidden="true"/>}
            onClick={l.cochable ? () => setChoix((c) => ({ ...c, [l.cle]: !coche })) : undefined}
            attrs={{ 'data-cp-lot-ligne': l.id, 'data-cp-lot-mini': l.mini == null ? '' : String(l.mini), 'data-cp-lot-ecartee': l.ecartee || undefined, 'data-cp-lot-coche': coche ? '1' : '0' }}/>;
        })}
      </Groupe>
    </Feuille>
  );

  // ── La grille (ordinateur, facultative) : N° · photo · titre · prix · prix mini · acheté ──
  const vueGrille = () => {
    const cles = grille.cles || liste0.slice(0, 150).map((a) => a.cle);
    const vivants = new Map(liste0.map((a) => [a.cle, a]));
    const figes = grille.figes || {};
    const poserCase = (a, q, texte) => {
      const t = String(texte || '').trim(); if (!t || grille.poses[a.cle + '|' + q] === t) return;
      const v = montantTape(t.replace('.', ',')); if (v == null) return;
      const ok = q === 'achat' ? poserPrixAchat(a, t) : q === 'mini' ? (!jugerMini(a, v).auPrix && poserMini(a, v)) : poserPrix(a, v);
      if (ok) setGrille((g) => ({ ...g, poses: { ...g.poses, [a.cle + '|' + q]: t } }));
    };
    const champ = (a, q, i) => {
      const k = a.cle + '|' + q;
      if (!a.manques.includes(q) && !grille.poses[k]) return q === 'achat' && a.achat != null ? eur(a.achat) : q === 'prix' ? eur(a.prix) : '';
      return <input type="text" inputMode="decimal" autoComplete="off" className="vrm-cp-case" data-cp-case={k} data-cp-case-rang={i} data-cp-case-q={q} data-cp-case-pose={grille.poses[k] ? '1' : undefined}
        aria-label={tr(q === 'mini' ? 'cpl.grille.champMini' : q === 'achat' ? 'cpl.grille.champAchat' : 'cpl.grille.champPrix', { qui: QUI(a) })} value={grille.vals[k] || ''}
        onChange={(e) => { const v = e.target.value.slice(0, 9); setGrille((g) => ({ ...g, cles, vals: { ...g.vals, [k]: v } })); }}
        onBlur={(e) => poserCase(a, q, e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); poserCase(a, q, e.currentTarget.value); const r = racine(); const s = r && r.querySelector(`[data-cp-case-rang="${i + 1}"][data-cp-case-q="${q}"]`); if (s) s.focus(); } }}/>;
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
                  <td>{a.numero ? <Plaque numero={a.numero}/> : null}</td>
                  <td>{vignette(Photo, a.photo, 44)}</td>
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
  function ouvrirGrille() { const l = liste0.slice(0, 150); setGrille({ cles: l.map((a) => a.cle), figes: Object.fromEntries(l.map((a) => [a.cle, a])), vals: {}, poses: {} }); setVue('grille'); }

  const corps = entrees === undefined ? <p className="vrm-cp-etat" data-cp-etat="lecture">{tr('cpl.lecture')}</p>
    : !res ? <p className="vrm-cp-etat" data-cp-etat="pas-su">{tr('cpl.pasSu')}</p>
    : vue === 'grille' ? vueGrille()
    : (
      <div className="vrm-cp-scene" data-cp-scene="">
        {article ? carte(article, true) : fin}
        {suivant && suivant.cle !== (article && article.cle) ? carte(suivant, false) : null}
      </div>
    );
  const titrePage = vue === 'grille' ? tr('cpl.vue.grille') : position ? [tr('cpl.progression', { i: position, n: total }), libSujet].filter(Boolean).join(' · ') : tr('cpl.titre');
  const pleinPage = vue !== 'cartes' || !res ? null
    : !article ? <Bouton variante="plein" onClick={fermer} attrs={{ 'data-cp-fin-fermer': '' }}>{tr('cpl.fin.fermer')}</Bouton>
    : enPave ? <Bouton variante="plein" onClick={valider} indisponible={!okActif} raison={jm && jm.auPrix ? tr('cpl.mini.auPrix') : tr('cpl.ok.raison')} attrs={{ 'data-cp-ok': '' }}>{tr('cpl.ok')}</Bouton> : null;

  return (
    <>
      <PagePoussee ouverte titre={titrePage} onRetour={vue === 'grille' ? () => setVue('cartes') : fermer} className={'vrm-cp' + (large ? ' is-large' : '')} plein={pleinPage}
        attrs={{ 'data-completer': sujet, 'data-cp-vue': lotOuvert ? 'lot' : vue, 'data-cp-large': large ? '1' : '0', 'data-cp-progres': position && vue === 'cartes' ? `${position}/${total}` : '' }}
        actions={vue === 'cartes' ? <>
          <BoutonIcone libelle={tr('cpl.retour')} icone={ic('undo')} indisponible={!histo.length || retour === 0} onClick={reculer} attrs={{ 'data-cp-reculer': '' }}/>
          <BoutonIcone libelle={tr('cpl.reste.titre')} icone={ic('more')} onClick={() => setResteOuvert(true)} attrs={{ 'data-cp-reste-ouvrir': '' }}/>
        </> : null}>
        <progress className="vrm-cp-avance" aria-hidden="true" value={total ? sortis + (article ? idx : liste.length) : 0} max={Math.max(1, total)}/>
        <div className="vrm-cp-corps">
          {large && vue === 'cartes' && res ? (
            <nav className="vrm-cp-file" aria-label={tr('cpl.reste.titre')} data-cp-file={liste.length}>
              <Groupe nu>
                {liste.slice(0, 200).map((a, i) => <Rangee key={a.cle} vignette={vignette(Photo, a.photo, 44)} plaque={a.numero ? <Plaque numero={a.numero}/> : null} titre={a.titre} sousTitre={qDe(a).map((q) => tr('cpl.reste.' + q)).join(' · ')}
                  selectionnee={!enRetour && !!article && a.cle === article.cle} onClick={() => { setRetour(null); dernierIdx.current = i; setSaisie(''); setMode('choix'); forcer((n) => n + 1); }} attrs={{ 'data-cp-file-ligne': a.cle }}/>)}
              </Groupe>
            </nav>
          ) : null}
          <main className="vrm-cp-main">{corps}</main>
        </div>
      </PagePoussee>
      <Bandeau gestes={gestes}/>
      {feuilleReste}
      {feuilleLot}
    </>
  );
}
