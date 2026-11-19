// ── L'ÉCRAN « E-MAILS » ──────────────────────────────────────────────────────────────────────────────
// (5 nov.) « Un onglet dédié aux e-mails… une vraie boîte de réception » ; (6 nov., v36) lu / non lu, code de
// retrait copiable, piles de rafales, carte « ce qu'il faut savoir », message d'origine dans un cadre isolé ;
// (17 nov.) segments, « Ranger », e-mails à rattacher.
//
// (19 nov., lot emails-mail — Julien : « L'onglet e-mails est absolument catastrophique, les e-mails sont
// moches, et quand je ne clique sur rien tout est regroupé à gauche, condensé. "À traiter · Colis · Ventes"
// peut être en haut et prendre toute la largeur, et après on a le beau mail directement dans l'application. »)
// Refait comme Mail d'Apple, en « VRM natif » (docs/design/NATIF.md, classes `n-mail-*`, src/emails-mail.css) :
//   · le segmenté À traiter · Colis · Ventes · Achats · Tout EN HAUT, sur toute la largeur, puis la recherche ;
//   · la liste : expéditeur (ou plateforme), sujet, ce que VRM a compris en UNE ligne, date ;
//   · SANS sélection, la liste prend toute la place (à l'ordinateur : une rangée par e-mail, colonnes
//     expéditeur | sujet — compris | date) ; un e-mail ouvert ⇒ DEUX volets (liste | lecture) ;
//   · l'e-mail ouvert : en tête « Ce que VRM a compris » (colis, code de retrait en grand, point, date
//     limite, vente / achat relié PAR IDENTITÉ), puis le message d'origine lisible (HTML assaini dans le
//     cadre isolé de src/CadreEmail.jsx, images à la demande, liens dans un nouvel onglet), « Ranger ».
//   · « Relier ma boîte » : le parcours accompagné, une étape par écran (src/RelierMaBoite.jsx).
//
// ⚠️ Lecture : la route existante `/api/email-rattacher?mode=journal` (aucune fonction serverless de plus).
//    Une page = scalaires projetés ; le corps d'UN e-mail se lit sur son clic (`lire=`). Jamais `select=data`.
// ⚠️ Trois états partout : `undefined` en cours · `null` pas su · valeur lue.
// ⚠️ AUCUN HTML n'est rendu dans cet écran : le texte gardé est dessiné en éléments React (`lireCorps`) ;
//    un lien n'est gardé qu'en http(s), ouvert ailleurs (`noopener noreferrer`). Le HTML d'origine ASSAINI
//    (api/_lib/email-html.js) ne vit QUE dans le cadre isolé (src/CadreEmail.jsx), pas en mode stream.
// ⚠️ §5 : un geste (« Voir le colis… ») ne part QUE d'une identité lue ; le N° n'est jamais retrouvé par titre.
// ⚠️ On ne jette rien : « Ranger » est une marque (`vrm_emails_ranges`), les rangés restent en bas de leur vue ;
//    les e-mails qu'aucune adresse de réception n'attribue restent « à rattacher » (« C'est à moi », SA session).
// ⚠️ Au téléphone, la feuille de lecture est OPAQUE dès sa première image.
import React, { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RUBRIQUES_BOITE, rubriqueEmail } from '../api/_lib/boite-email.js';
import { expediteurLisible, dateEmail, poidsLisible, ceQueVrmAFait, titreSimple, titreEnClair, groupesParJour, siteExpediteur, ligneEmail, gesteAmbre, monogramme, empiler, carteHeros, gestesEmail, lireCorps, lieuLisible, codeSurLigne, adresseLisible, enClair, titreEnClairLangue } from './boiteEmails.js';
import { requeteJsonBornee } from './requeteJsonBornee.js';
import { LogoSite } from './SelecteurSites.jsx';
import { LogoTransporteur } from './PastilleTransporteur.jsx';
import { cleTransporteur, nomDuTransporteur } from './transporteursVisuels.js';
import RelierBoite from './RelierBoite.jsx';
import RelierMaBoite from './RelierMaBoite.jsx';
import { phraseARelier } from './relierCompte.js';
import { EtatPanne } from './composants/EtatPanne.jsx';
import CadreEmail from './CadreEmail.jsx';
import { streamAllume } from './modeStream.js';
import { prendreDemande, DEMANDE_RECHERCHE } from './rechercheEcran.js';
import { SEGMENTS_EMAILS, filtresDuSegment, segmentDesFiltres, numeroEmail, estRange, separerRanges } from './designV2/messagesV2.js';
import { lectureEmail } from './journalEmail.js';
import { CompteEmailAVerifier } from './ActionsClaires.jsx';
import { useSelectionSerie, CaseSerie, BarreSerie } from './composants/SelectionSerie.jsx';   // (11 nov., lot actions-serie)
import { trierSerie, resumeSerie } from './selectionSerie.js';
import { Segmente, Bouton, BoutonIcone, Feuille, Groupe, Rangee, Vide, Attente, Plaque, Glyphe, useOrdinateur } from './natif/index.js';
import { tr } from './i18n/index.js';
import { trj } from './i18n/react.js';
import './boite-emails.css';   // le cadre du message d'origine et l'ancienne scène (adresse VRM pas ouverte)
import './emails-mail.css';

const PAR_PAGE = 50;
const formeListe = (j) => j && j.ok === true && Array.isArray(j.emails) && j.compteurs && typeof j.compteurs.sur === 'number';
const heure = (v) => { const t = Date.parse(v || ''); return Number.isFinite(t) ? new Date(t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : ''; };
const quandLong = (v) => { const t = Date.parse(v || ''); return Number.isFinite(t) ? new Date(t).toLocaleString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : tr('mail.dateNonLue'); };
const reduitMvt = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };
// Une liste qui a plus d'une minute : « Actualiser » devient utile.
const VIEILLE = 60e3;
function raisonPanne(err, statut) {
  try { if (typeof navigator !== 'undefined' && navigator.onLine === false) return tr('mail.panne.horsLigne'); } catch (_) { /* rien */ }
  if (err && err.name === 'AbortError') return tr('mail.panne.delai');
  if (statut === 401 || statut === 403) return tr('mail.panne.session');
  if (err) return tr('mail.panne.connexion');
  return tr('mail.panne.lecture');
}
// Copier un code : le presse-papiers de l'appareil, sinon un champ sélectionné.
async function copier(texte) {
  try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(texte); return true; } } catch (_) { /* repli */ }
  try { const t = document.createElement('textarea'); t.value = texte; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select(); const ok = document.execCommand('copy'); t.remove(); return ok; } catch (_) { return false; }
}

const Ic = {
  trombone: <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M10.5 4.5 5.8 9.2a1.4 1.4 0 0 0 2 2l5-5a2.8 2.8 0 0 0-4-4l-5.2 5.2a4.2 4.2 0 0 0 6 6l4-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  copier: <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><rect x="7" y="7" width="9.5" height="9.5" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.6"/><path d="M13 4.5A1.5 1.5 0 0 0 11.5 3h-6A2.5 2.5 0 0 0 3 5.5v6A1.5 1.5 0 0 0 4.5 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,
  coche: <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="m4.5 10.5 3.5 3.5 7.5-8" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  chevron: <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="m4.5 2.5 3.5 3.5-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  lieu: <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M10 17.5s5.5-5 5.5-9.5a5.5 5.5 0 0 0-11 0c0 4.5 5.5 9.5 5.5 9.5Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><circle cx="10" cy="8" r="2" fill="none" stroke="currentColor" strokeWidth="1.6"/></svg>,
  horloge: <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="1.6"/><path d="M10 6v4.2l2.8 1.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,
  lu: <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="M3 6.5 10 11l7-4.5M3.5 5h13a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>,
};

// ── L'AVATAR DE L'EXPÉDITEUR (rond) ─────────────────────────────────────────────────────────────────────
// Le logo du site (fichiers de l'app), le logo du transporteur (celui que l'app montre déjà), sinon un
// monogramme neutre. Jamais une couleur ni un logo inventés.
function Avatar({ from, grande = false }) {
  const site = siteExpediteur(from);
  const nom = expediteurLisible(from);
  const tp = site ? '' : cleTransporteur(nom);
  const mono = <span className="n-mail-mono">{monogramme(nom)}</span>;
  return <span className={'n-mail-marque' + (grande ? ' is-grande' : '')} data-marque={site || (tp ? 'transporteur' : 'monogramme')} data-transporteur={tp || undefined} data-stream-libre="" aria-hidden="true">
    {site ? <LogoSite site={site}/> : tp ? <LogoTransporteur cle={tp} taille={grande ? 30 : 24} repli={mono}/> : mono}
  </span>;
}

// ── LE CODE DE RETRAIT, COPIABLE D'UN TOUCHER ──────────────────────────────────────────────────────────
// Le code LU dans le résumé ; un toucher le copie (sans espace) et le dit. En mode stream, caché.
function PuceCode({ code, grande = false }) {
  const [copie, setCopie] = useState(false);
  useEffect(() => { if (!copie) return undefined; const t = setTimeout(() => setCopie(false), 1600); return () => clearTimeout(t); }, [copie]);
  const brut = String(code).replace(/\s+/g, '');
  return <button type="button" className={'n-mail-code' + (grande ? ' is-grande' : '')} data-boite-code-copier={brut} data-copie={copie ? '1' : undefined}
    aria-label={copie ? tr('emails.codeCopie', { code: String(code) }) : tr('emails.copierCodeRetrait', { code: String(code) })}
    onClick={async (ev) => { ev.stopPropagation(); setCopie(await copier(brut)); }}>
    {grande ? null : <span className="n-mail-code-chiffres vrm-sensible" data-stream-type="code">{code}</span>}
    <span className="n-mail-code-ic" aria-hidden="true">{copie ? Ic.coche : Ic.copier}</span>
    {grande ? <span className="n-mail-code-mot">{copie ? tr('emails.copie') : tr('mail.copierCode')}</span> : <span className="n-mail-sr" aria-live="polite">{copie ? tr('emails.copie') : ''}</span>}
  </button>;
}

// La photo d'une paire vient de la vente VINTED reliée (`photoDe`) : elle passe par la règle des photos
// Vinted de l'app (`PhotoVinted`, reçue en `Photo`) — jamais un <img> nu (audit-photos-vinted).
const PhotoBoite = createContext(null);
const REMPLIT = { width: '100%', height: '100%', objectFit: 'cover', display: 'block' };
function PhotoPaire({ src, className, data }) {
  const Photo = useContext(PhotoBoite);
  if (!src || !Photo) return null;
  return <span className={className} {...data}><Photo src={src} loading="lazy" decoding="async" style={REMPLIT}/></span>;
}

// ── « CE QUE VRM A COMPRIS » (en tête de l'e-mail ouvert) ──────────────────────────────────────────────
// Le titre en mots simples (tiré de ce que VRM a rangé, jamais du sujet), puis les faits LUS : code de
// retrait en grand, point, date limite ; ou le montant, l'article, le N° lu ; puis l'objet relié PAR
// IDENTITÉ (le geste) et ce que VRM en a fait.
function Compris({ e, delies, photo, onGeste }) {
  const t = titreSimple(e, delies);
  const h = carteHeros(e, delies);
  const lecture = ceQueVrmAFait(e, delies);
  const gestes = gestesEmail(e, delies);
  const aVerifier = lecture && (lecture.etat === 'verifier' || lecture.etat === 'incompris');
  // Un nombre, une fois : ce que les faits disent déjà sort de la ligne de détails.
  const dejaDit = (x) => (h && ((h.code && /^code /.test(x)) || (h.lieu && h.lieu.nom && x === (e.resume && e.resume.lieu)) || (h.limite && /avant le /.test(x)) || (h.montant && x.endsWith('€') && x.includes(h.montant.replace(/\s*€$/, ''))) || (h.article && (x === h.article || x === `sur ${h.article}`)) || (h.num && x === `N°${h.num}`)));
  const details = t.details.filter((x) => !dejaDit(x) && !/^code pas encore lu$/.test(x));
  const tp = h.transporteur ? cleTransporteur(h.transporteur) : null;
  const relies = gestes.filter((g) => g.ident);
  return (
    <section className="n-mail-compris-carte" data-boite-heros={h.genre} data-boite-haut="" data-etat={lecture.etat} aria-label={tr('mail.compris')}>
      <p className="n-mail-compris-sur">{tr('mail.compris')}</p>
      <div className="n-mail-compris-tete">
        {photo ? <PhotoPaire className="n-mail-compris-photo" src={photo} data={{ 'data-boite-photo': '' }}/> : null}
        <div className="n-mail-compris-txt">
          <p className="n-mail-compris-titre" data-boite-compris-titre={t.titre}>{enClair(t.titre)}</p>
          {h.article ? <p className="n-mail-compris-article">{h.article}</p> : null}
          {details.length ? <p className="n-mail-compris-details">{details.map(enClair).join(' · ')}{t.rien ? ` · ${tr('emails.rienFaire')}` : ''}</p> : t.rien ? <p className="n-mail-compris-details">{tr('emails.rienFaire')}</p> : null}
        </div>
        {h.num ? <span className="n-mail-compris-plaque" data-boite-num={h.num}><Plaque numero={h.num} grand/></span> : null}
      </div>
      {h.genre === 'retrait' ? <div className="n-mail-retrait" aria-label={tr('mail.colisRetirer')}>
        <p className="n-mail-fait-lib">{tp ? <LogoTransporteur cle={tp} taille={18} repli={null}/> : null}<span>{tr('mail.codeRetrait')}{tp ? ` · ${nomDuTransporteur(tp)}` : ''}</span></p>
        {h.code
          ? <div className="n-mail-retrait-code" data-boite-code={h.code}><span className="n-mail-retrait-chiffres vrm-sensible" data-stream-type="code">{h.code}</span><PuceCode code={h.code} grande/></div>
          : <p className="n-mail-retrait-sans" data-boite-code="">{tr('mail.codeAbsent')}</p>}
      </div> : null}
      {h.montant || h.lieu || h.limite ? <dl className="n-mail-faits">
        {h.montant ? <div data-boite-montant={h.montant}><dt>{h.montantMot || tr('mail.montant')}</dt><dd>{h.montant}</dd></div> : null}
        {h.lieu ? <div data-boite-lieu=""><dt>{Ic.lieu}<span>{tr('mail.point')}</span></dt><dd><b>{h.lieu.nom}</b>{h.lieu.adresse ? <span>{h.lieu.adresse}</span> : null}</dd></div> : null}
        {h.limite ? <div data-boite-limite={h.limite.jours == null ? '' : h.limite.jours} data-ambre={h.limite.proche ? '1' : undefined}><dt>{Ic.horloge}<span>{h.genre === 'retrait' ? tr('mail.retirerAvant') : tr('emails.envoyerAvant')}</span></dt><dd><b>{h.limite.date}</b>{h.limite.mot ? <span>{h.limite.mot}</span> : null}</dd></div> : null}
      </dl> : null}
      {!e.compte && (e.compteAmbigu || siteExpediteur(e.from) === 'vinted') ? <CompteEmailAVerifier ambigu={e.compteAmbigu} onVerifier={onGeste && onGeste.relier}/> : null}
      {aVerifier ? <div className="n-mail-averif" data-boite-averif="">
        {lecture.raison ? <p><b>{tr('emails.verifier')}</b> {lecture.raison}</p> : null}
        {lecture.geste ? <p><b>{tr('emails.faire')}</b> {lecture.geste}</p> : null}
      </div> : null}
      {gestes.length ? <div className="n-mail-gestes" data-boite-gestes={gestes.length}>
        {gestes.map((g) => <Bouton key={g.k} variante={g.principal ? 'plein' : 'teinte'} large onClick={() => onGeste && onGeste.aller(g)}
          attrs={{ 'data-boite-objet': g.principal ? g.k : undefined, 'data-boite-geste-id': g.k, 'data-boite-ident': g.ident || '' }}>{enClair(g.mot)}</Bouton>)}
      </div> : null}
      <p className="n-mail-compris-fait" data-boite-fait="" data-boite-objet={relies.length ? undefined : 'aucun'}>
        {relies.length ? tr('mail.relie', { ident: relies.map((g) => enClair(g.ident)).join(' · ') }) + ' · ' : ''}{tr('emails.dansVrm')} {lecture.fait}{relies.length ? '' : tr('emails.relieAucunColis')}
      </p>
    </section>
  );
}

// ── LE MESSAGE D'ORIGINE, EN ÉLÉMENTS REACT (jamais du HTML dans l'écran) ──────────────────────────────
function Morceau({ p }) {
  const t = p.lien ? <a href={p.lien} target="_blank" rel="noopener noreferrer nofollow" data-boite-lien="">{p.t}</a> : p.t;
  return p.gras ? <b>{t}</b> : <>{t}</>;
}
function Corps({ texte, coupe }) {
  const c = useMemo(() => lireCorps(texte), [texte]);
  if (!c || !c.blocs.length) return null;
  const blocs = [];
  let liste = null;
  c.blocs.forEach((b, i) => {
    const contenu = b.parts.map((p, j) => <Morceau key={j} p={p}/>);
    if (b.k === 'li') { if (!liste) { liste = []; blocs.push(<ul key={'l' + i} className="n-mail-msg-liste">{liste}</ul>); } liste.push(<li key={i} data-n={b.n || undefined}>{b.n ? <span className="n-mail-msg-n">{b.n}.</span> : null}<span>{contenu}</span></li>); return; }
    liste = null;
    if (b.k === 'etiquette') blocs.push(<p key={i} className="n-mail-msg-etiq">{contenu}</p>);
    else if (b.k === 'note') blocs.push(<p key={i} className="n-mail-msg-note">{contenu}</p>);
    else blocs.push(<p key={i} className={b.fin ? 'is-fin' : undefined}>{contenu}</p>);
  });
  return <div className="n-mail-msg" data-boite-corps={coupe ? 'extrait' : 'lu'}>
    {blocs}
    {coupe ? <p className="n-mail-doux" data-boite-extrait="">{tr('emails.extraitVrmGarde')}</p> : null}
    {c.pied ? <details className="n-mail-msg-pied" data-boite-mentions=""><summary>{tr('emails.mentionsExpediteur')}</summary><p>{c.pied}</p></details> : null}
  </div>;
}

// Le mode stream, suivi ici (l'évènement que pose l'interrupteur de l'app).
function useStreamIci() {
  const [on, setOn] = useState(() => { try { return streamAllume(); } catch (_) { return false; } });
  useEffect(() => { const f = (ev) => setOn(!!(ev && ev.detail)); window.addEventListener('vrm:stream', f); return () => window.removeEventListener('vrm:stream', f); }, []);
  return on;
}
const appSombre = () => { try { return document.documentElement.getAttribute('data-theme') === 'dark'; } catch (_) { return false; } };
// Sa MISE EN PAGE (HTML assaini, cadre isolé, images à la demande) quand elle est gardée, sinon le texte
// remis en forme — et une ligne qui dit pourquoi, s'il y en a une.
function MessageOrigine({ e, stream }) {
  const o = e.origine;
  const texte = typeof e.texte === 'string' && e.texte.trim()
    ? <Corps texte={e.texte} coupe={!!e.texteCoupe}/>
    : <p className="n-mail-doux" data-boite-corps="absent">{tr('emails.texteGardeDans')}</p>;
  if (stream) return <><p className="n-mail-doux" data-boite-origine="stream">{tr('emails.misePageOrigine')}</p>{texte}</>;
  if (o && o.etat === 'garde' && typeof o.html === 'string') return <div data-boite-origine="html"><CadreEmail html={o.html} images={Number(o.images) || 0} sombreEmail={!!o.sombre} appSombre={appSombre()} titre={tr('mail.cadreTitre', { sujet: e.subject || tr('emails.eMailSans') })}/></div>;
  const [cle, note] = o === null ? ['pas-su', tr('mail.origine.pasLue')]
    : o && o.etat === 'trop' ? ['trop', tr('mail.origine.trop', { poids: o.octets ? poidsLisible(o.octets) : '—' })]
    : o && o.raison === 'trop-vieux' ? ['trop-vieux', tr('mail.origine.vieux')]
    : ['texte', ''];
  return <>{note ? <p className="n-mail-doux" data-boite-origine={cle}>{note}</p> : <span hidden data-boite-origine={cle}/>}{texte}</>;
}

// ── LIRE UN E-MAIL ─────────────────────────────────────────────────────────────────────────────────────
function Lecture({ id, entetes, delies, onFermer, onAller, onNum, plein, FermeAuRetour, lu, onLu, photoDe, onRelier, range = null, onRanger = null }) {
  const [m, setM] = useState(undefined); // undefined en cours · null pas su · {email}
  const [essai, setEssai] = useState(0);
  const titre = useRef(null);
  const stream = useStreamIci();
  useEffect(() => {
    let vivant = true; setM(undefined);
    (async () => {
      try {
        // (6 nov.) `html=1` : la mise en page d'origine, jamais demandée en mode stream.
        const r = await requeteJsonBornee(`/api/email-rattacher?mode=journal&lire=${encodeURIComponent(id)}${stream ? '' : '&html=1'}`, { headers: entetes(), cache: 'no-store' });
        if (!vivant) return;
        setM(r.ok && r.json && r.json.ok === true && r.json.id === id ? { email: r.json.email || null } : null);
      } catch (_) { if (vivant) setM(null); }
    })();
    return () => { vivant = false; };
  }, [id, entetes, essai, stream]);
  // Au téléphone (feuille plein écran), le titre prend le focus ; à l'ordinateur il reste sur la ligne (↑ ↓).
  useEffect(() => { if (plein && m && m.email && titre.current) { try { titre.current.focus({ preventScroll: true }); } catch (_) { /* rien */ } } }, [m, plein]);
  const e = m && m.email;
  const photo = e && photoDe ? photoDe(e) : null;
  const pdfConnu = e && e.resume && e.resume.pdf === 1;
  const gestes = e ? gestesEmail(e, delies) : [];
  const aller = (g) => (g.k === 'num' ? onNum && onNum(g.num) : onAller && onAller(g.url));
  const contenu = (
    <article className="n-mail-lecture" data-boite-lecture={id} data-plein={plein ? '1' : '0'} aria-label={tr('emails.eMailOuvert')} aria-busy={m === undefined ? 'true' : undefined}>
      <div className="n-mail-lecture-barre" data-boite-barre="">
        <button type="button" className="n-mail-barre-btn" data-boite-fermer="" onClick={onFermer}>{plein ? <><span className="n-mail-chevron-g" aria-hidden="true">‹</span>{tr('nav.emails')}</> : tr('commun.fermer')}</button>
        <span className="n-mail-barre-droite">
          {e && onRanger ? <button type="button" className="n-mail-barre-btn" data-boite-ranger={range ? 'sortir' : 'ranger'} onClick={() => onRanger(e, !range)}>{range ? tr('v2.mail.sortir') : tr('v2.mail.ranger')}</button> : null}
          {e && lu !== null ? <button type="button" className="n-mail-barre-btn" data-boite-basculer-lu={lu ? 'nonlu' : 'lu'} onClick={() => onLu(e, !lu)}>{lu ? tr('emails.marquerNonLu') : tr('emails.marquerLu')}</button> : null}
        </span>
      </div>
      {m === undefined ? <div className="n-mail-lecture-attente" role="status"><span className="n-mail-sr">{tr('emails.ouvertureEMail')}</span><Attente forme="texte" n={6}/></div> : null}
      {m === null ? <EtatPanne className="n-mail-panne" role="alert" data-boite-lecture-etat="pas-su" quoi={tr('mail.cetEmail')} raison={tr('mail.lecturePasAboutie')} onReessayer={() => setEssai((n) => n + 1)}/> : null}
      {m && !e ? <div className="n-mail-etat" data-boite-lecture-etat="absent"><Vide phrase={tr('emails.eMailPlus')}/></div> : null}
      {e ? <>
        <header className="n-mail-entete">
          <h2 tabIndex={-1} ref={titre} className="n-mail-sujet-grand" data-boite-titre={titreSimple(e, delies).titre} data-boite-sujet="">{e.subject || tr('emails.eMailSans')}</h2>
          <div className="n-mail-entete-de">
            <Avatar from={e.from} grande/>
            <p className="n-mail-entete-txt">
              <b>{expediteurLisible(e.from)}</b>
              <span>{e.compte ? <span className="vrm-sensible" data-stream-type="compte">{e.compte.nom}</span> : e.compteAmbigu ? tr('emails.plusieursComptes2') : null}{e.compte || e.compteAmbigu ? ' · ' : ''}<time dateTime={dateEmail(e) || ''}>{quandLong(dateEmail(e))}</time></span>
            </p>
          </div>
        </header>
        <Compris e={e} delies={delies} photo={photo} onGeste={{ aller, relier: onRelier }}/>
        <section className="n-mail-origine" aria-label={tr('emails.messageOrigine')} data-boite-gestes-n={gestes.length}>
          <p className="n-mail-section-titre">{tr('emails.messageOrigine')}</p>
          <div className="n-mail-message"><MessageOrigine e={e} stream={stream}/></div>
        </section>
        <section className="n-mail-pieces" data-boite-pieces={e.pieces == null ? 'pas-su' : e.pieces.length}>
          {e.pieces == null
            ? <><p className="n-mail-section-titre">{tr('emails.piecesJointes')}</p><p className="n-mail-doux">{tr('emails.listeNonGardee')}{pdfConnu ? ' ' + tr(e.resume.t === 'achat' ? 'mail.pdfRecu' : 'mail.pdfBordereau') : ''}</p></>
            : e.pieces.length === 0 ? <p className="n-mail-doux">{tr('emails.aucunePieceJointe')}</p>
            : <><p className="n-mail-section-titre">{tr('emails.piecesJointes')}</p><ul className="n-mail-pieces-liste">{e.pieces.map((p, i) => <li key={i} data-boite-piece={p.n}><span className="n-mail-piece-ic" aria-hidden="true">{p.t === 'application/pdf' ? 'PDF' : Ic.trombone}</span><span className="n-mail-piece-nom">{p.n}</span><small>{[p.t === 'application/pdf' ? 'PDF' : p.t, poidsLisible(p.o)].filter(Boolean).join(' · ')}</small></li>)}</ul>
              <p className="n-mail-doux">{gestes.some((g) => g.k === 'colis') ? tr('emails.bordereauImprimeDepuis') : tr('emails.imprimerBordereauRecu')}</p></>}
        </section>
        <p className="n-mail-meta" data-boite-meta="">
          <span data-boite-de="">{tr('emails.texte')} <b>{expediteurLisible(e.from)}</b>{adresseLisible(e.from) ? ` (${adresseLisible(e.from)})` : ''}</span>
          <span aria-hidden="true"> · </span>
          <span data-boite-recu="">{tr('emails.recu')} {e.adresses && e.adresses.length ? e.adresses.join(', ') : tr('emails.adresseNonLue')}{e.compte ? ` (${e.compte.nom})` : ''}</span>
          <span aria-hidden="true"> · </span>
          <span data-boite-date=""><time dateTime={dateEmail(e) || ''}>{e.sourceDate ? tr('emails.texte2') : tr('emails.transmisVrm')}{quandLong(dateEmail(e))}</time></span>
        </p>
      </> : null}
    </article>
  );
  if (!plein) return contenu;
  return createPortal(<div className="n-mail-feuille" data-boite-feuille="" role="dialog" aria-modal="true" aria-label={tr('emails.eMailOuvert')}>{FermeAuRetour ? <FermeAuRetour fermer={onFermer}/> : null}{contenu}</div>, document.body);
}

// ── UNE LIGNE (comme Mail) ─────────────────────────────────────────────────────────────────────────────
// L'expéditeur (gras si non lu) et la date ; le sujet ; ce que VRM a compris en UNE ligne (la nature, les
// faits courts, le geste en ambre s'il est proche). À droite, le code de retrait copiable ou la photo.
// Au doigt : glisser à droite = lu / non lu, à gauche = Ranger (rien n'est jamais caché sans un mot).
const SEUIL_GLISSE = 76;
const Ligne = memo(function Ligne({ e, delies, ouvert, lu, photo, onOuvrir, onLu, maintenant, attrsSerie = null, caseSerie = null, range = false, onRanger = null }) {
  const r = rubriqueEmail(e);
  const t = titreSimple(e, delies);
  const l = ligneEmail(e, delies, maintenant);
  const g = l.geste;
  const h = heure(dateEmail(e));
  const res = e.resume && typeof e.resume === 'object' ? e.resume : null;
  const code = codeSurLigne(e);
  const lieu = res && res.lieu ? lieuLisible(res.lieu) : null;
  const lec = lectureEmail(e, delies);
  const num = numeroEmail(lec, res);
  const essentiel = l.essentiel.filter((x) => !(code && /^code /.test(x)) && x !== 'N°' + num).map((x) => (lieu && x === res.lieu ? lieu.nom : x));
  const pasLu = lu === false;
  const ref = useRef(null), fond = useRef(null), geste = useRef(null), glisse = useRef(false);
  const [fondVu, setFondVu] = useState(false);
  const relacher = (ev) => {
    const gs = geste.current; geste.current = null;
    if (!gs || !gs.parti) { if (ev && ev.currentTarget) delete ev.currentTarget.dataset.appui; return; }
    const v = gs.dx / Math.max(1, performance.now() - gs.t0);
    const bascule = gs.dx > SEUIL_GLISSE || (gs.dx > 24 && v > 0.6);
    const el = ref.current;
    if (el) { el.style.transition = reduitMvt() ? 'none' : 'transform .34s cubic-bezier(.32,.72,0,1)'; el.style.transform = ''; }
    if (fond.current) fond.current.dataset.actif = '0';
    if (bascule && gs.gauche) { if (onRanger) onRanger(e, !range); }
    else if (bascule && lu !== null) onLu(e, pasLu);
    setTimeout(() => { glisse.current = false; }, 0);
    setTimeout(() => setFondVu(false), reduitMvt() ? 0 : 360);
  };
  const de = expediteurLisible(e.from);
  return <li {...(attrsSerie || {})} className="n-mail-item" data-pas-lu={pasLu ? '1' : undefined} data-ouvert={ouvert ? '1' : undefined}>
    {caseSerie}
    {fondVu && lu !== null ? <span ref={fond} className="n-mail-glisse-fond" aria-hidden="true" data-actif="0" data-sens={geste.current && geste.current.gauche ? 'gauche' : 'droite'}>{Ic.lu}<span>{geste.current && geste.current.gauche ? (range ? tr('v2.mail.sortir') : tr('v2.mail.ranger')) : pasLu ? tr('emails.lu') : tr('emails.nonLu')}</span></span> : null}
    <button ref={ref} type="button" className="n-mail-ligne" data-boite-email={e.id} data-rubrique={r} data-etat={e.etat} data-lu={lu === null ? undefined : lu ? '1' : '0'}
      data-boite-geste={g ? g.k : undefined} data-boite-proche={g && g.proche ? '1' : undefined} data-boite-rien={l.rien ? '1' : undefined} data-boite-a-code={code ? '1' : undefined} data-boite-a-photo={photo ? '1' : undefined} data-v2-range={range ? '1' : undefined} data-v2-num={num || undefined}
      aria-current={ouvert ? 'true' : undefined}
      aria-label={`${pasLu ? tr('mail.nonLuPoint') : ''}${de}. ${e.subject || tr('emails.eMailSans')}. ${titreEnClairLangue(t)}${e.compte ? ', ' + e.compte.nom : ''}${h ? ', ' + h : ''}`}
      onClick={() => { if (glisse.current) return; onOuvrir(e); }}
      onPointerDown={(ev) => { ev.currentTarget.dataset.appui = '1'; if (ev.pointerType === 'touch' && lu !== null) geste.current = { x: ev.clientX, y: ev.clientY, t0: performance.now(), dx: 0, parti: false }; }}
      onPointerMove={(ev) => {
        const gs = geste.current; if (!gs) return;
        const dx = ev.clientX - gs.x, dy = ev.clientY - gs.y;
        if (!gs.parti) { if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { geste.current = null; delete ev.currentTarget.dataset.appui; return; } if (dx < 10 && !(onRanger && dx < -10)) return; gs.gauche = dx < 0; gs.parti = true; glisse.current = true; setFondVu(true); delete ev.currentTarget.dataset.appui; try { ev.currentTarget.setPointerCapture(ev.pointerId); } catch (_) { /* rien */ } }
        const d = gs.gauche ? Math.max(0, -dx) : Math.max(0, dx); const x0 = d <= 96 ? d : 96 + ((d - 96) * 0.35); const x = gs.gauche ? -x0 : x0;
        gs.dx = d;
        ev.currentTarget.style.transition = 'none'; ev.currentTarget.style.transform = `translateX(${x}px)`;
        if (fond.current) fond.current.dataset.actif = d > SEUIL_GLISSE ? '1' : '0';
      }}
      onPointerUp={relacher} onPointerCancel={relacher} onPointerLeave={(ev) => { if (!geste.current) delete ev.currentTarget.dataset.appui; }}>
      <span className="n-mail-point" aria-hidden="true" data-boite-point={pasLu ? '1' : '0'}/>
      <Avatar from={e.from}/>
      <span className="n-mail-txt">
        <span className="n-mail-de" data-boite-de-ligne=""><span className="n-mail-de-nom">{de}</span>{e.compte ? <span className="n-mail-compte vrm-sensible" data-stream-type="compte">{e.compte.nom}</span> : null}</span>
        <span className="n-mail-milieu">
          <span className="n-mail-sujet" data-boite-sujet-ligne="">{e.subject || tr('emails.eMailSans')}</span>
          <span className="n-mail-compris" data-boite-compris="">
            <span className="n-mail-quoi" data-boite-quoi={l.titre}>{enClair(l.titre)}</span>
            {num ? <Plaque numero={num}/> : null}
            {essentiel.length ? <span className="n-mail-essentiel" data-boite-essentiel="">{essentiel.map((x, i) => <span key={i} className={/^(?:de|par) /.test(x) ? 'vrm-sensible' : undefined} data-stream-type={/^(?:de|par) /.test(x) ? 'acheteur' : undefined}>{i ? ' · ' : ''}{enClair(x)}</span>)}</span> : null}
            {g ? <span className="n-mail-geste" data-boite-geste-mot={g.k} data-ambre={gesteAmbre(g) ? '1' : '0'} data-passe={g.passe ? '1' : undefined} data-boite-averifier={g.k === 'verifier' ? '' : undefined}>{enClair(g.mot)}</span> : null}
          </span>
        </span>
        <span className="n-mail-date">{e.pj > 0 ? <span className="n-mail-pj" data-boite-pj={e.pj} aria-label={tr('emails.piecesJointes')}>{Ic.trombone}</span> : null}<time dateTime={dateEmail(e) || ''}>{h}</time></span>
      </span>
      {!code && photo ? <PhotoPaire className="n-mail-vignette" src={photo} data={{ 'data-boite-vignette': '' }}/> : null}
    </button>
    {code ? <PuceCode code={code}/> : null}
  </li>;
});

// Une PILE : une rafale d'e-mails identiques, en une ligne qui se déplie.
function Pile({ p, rendre, deplie, onDeplier, lus, delies, maintenant }) {
  const e = p.emails[0];
  const l = ligneEmail(e, delies, maintenant);
  const nonLus = p.emails.filter((x) => lus(x) === false).length;
  const h1 = heure(dateEmail(e));
  return <li className="n-mail-item n-mail-pile" data-boite-pile={p.emails.length} data-deplie={deplie ? '1' : '0'} data-pas-lu={nonLus ? '1' : undefined}>
    <button type="button" className="n-mail-ligne" data-boite-pile-tete="" data-boite-rien={l.rien ? '1' : undefined} aria-expanded={deplie} onClick={onDeplier}
      aria-label={tr('mail.pile', { titre: enClair(l.titre), n: p.emails.length })}>
      <span className="n-mail-point" aria-hidden="true" data-boite-point={nonLus ? '1' : '0'}/>
      <span className="n-mail-pile-avatar" aria-hidden="true"><Avatar from={e.from}/><span className="n-mail-pile-n">{p.emails.length}</span></span>
      <span className="n-mail-txt">
        <span className="n-mail-de"><span className="n-mail-de-nom">{expediteurLisible(e.from)}</span></span>
        <span className="n-mail-milieu">
          <span className="n-mail-sujet">{tr('mail.pileSujet', { n: p.emails.length })}</span>
          <span className="n-mail-compris"><span className="n-mail-quoi" data-boite-quoi={l.titre}>{enClair(l.titre)}</span>{l.essentiel.length ? <span className="n-mail-essentiel">{' · ' + l.essentiel.map(enClair).join(' · ')}</span> : null}{l.geste ? <span className="n-mail-geste" data-ambre={gesteAmbre(l.geste) ? '1' : '0'}>{enClair(l.geste.mot)}</span> : null}</span>
        </span>
        <span className="n-mail-date"><time>{h1}</time><span className="n-mail-pile-chevron" aria-hidden="true">{Ic.chevron}</span></span>
      </span>
    </button>
    {deplie ? <ul className="n-mail-pile-liste">{p.emails.map(rendre)}</ul> : null}
  </li>;
}

// ── LES COMPTES DONT LES E-MAILS N'ARRIVENT PAS (6 nov.) ───────────────────────────────────────────────
function ARelier({ comptes, onRelier }) {
  if (!Array.isArray(comptes) || !comptes.length) return null;
  const n = comptes.length;
  return <div className="n-mail-arelier" data-boite-a-relier={n} role="note">
    <p className="n-mail-arelier-titre"><b>{n > 1 ? tr('emails.comptesEnvoientAucun', { x: String(n) }) : tr('emails.compteEnvoieAucun')}</b></p>
    <ul>
      {comptes.map((c) => <li key={c.uid} data-boite-a-relier-compte={c.uid}>
        <span className="n-mail-arelier-qui"><b>{c.login}</b> · {phraseARelier(c)}</span>
        <Bouton variante="texte" onClick={() => onRelier(c.uid)} attrs={{ 'data-boite-relier-compte': c.uid }}>{trj('emails.relierBoite', { login: c.login })}</Bouton>
      </li>)}
    </ul>
  </div>;
}

// ── LES E-MAILS À RATTACHER (17 nov.) ──────────────────────────────────────────────────────────────────
// Ceux qu'aucune adresse de réception n'a pu attribuer (mis de côté, §5 : jamais donnés au hasard, jamais
// jetés), lus par la route (`/api/email-rattacher?mode=liste`, la même lecture que Paramètres), et le MÊME
// geste « C'est à moi » (le rejeu de la route, avec SA session).
function Quarantaine({ q }) {
  const [occupe, setOccupe] = useState('');
  const [max, setMax] = useState(5);
  if (q.emails === undefined) return null;
  if (q.emails === null) return <section className="n-mail-quarantaine" data-v2-mail-quarantaine="pas-su"><EtatPanne compact quoi={tr('v2.mail.q.titre')} raison={tr('v2.mail.q.passu')} onReessayer={q.relire}/></section>;
  if (!q.emails.length) return null;
  return (
    <section className="n-mail-quarantaine" data-v2-mail-quarantaine={q.emails.length} aria-label={tr('v2.mail.q.titre')}>
      <Groupe titre={`${tr('v2.mail.q.titre')} · ${q.emails.length}`} pied={tr('v2.mail.q.phrase')}>
        {q.emails.slice(0, max).map((x) => <div key={x.id} className="n-mail-q-ligne" data-v2-mail-q={x.id}>
          <span className="n-mail-q-txt"><span className="n-mail-q-sujet">{x.sujet || tr('emails.eMailSans')}</span>{x.raison ? <span className="n-mail-q-raison">{x.raison}</span> : null}</span>
          <Bouton variante="teinte" chargement={occupe === x.id} attrs={{ 'data-v2-mail-amoi': x.id }} onClick={async () => { setOccupe(x.id); try { await q.rattacher(x.id); } finally { setOccupe(''); } }}>{tr('v2.mail.q.amoi')}</Bouton>
        </div>)}
      </Groupe>
      {q.emails.length > max ? <Bouton variante="texte" onClick={() => setMax((m) => m + 10)}>{tr('v2.mail.q.suite', { n: q.emails.length - max })}</Bouton> : null}
    </section>
  );
}

// ── LA BOÎTE ───────────────────────────────────────────────────────────────────────────────────────────
function Boite({ headers, delies, onAller, onNum, FermeAuRetour, onRelier, tete = null, ecrireLus, photoDe, ranges = null, onRanger = null, quarantaine = null }) {
  const [feuille, setFeuille] = useState(false);
  const [rubrique, setRubrique] = useState('');
  const [adresse, setAdresse] = useState('');
  const [aVerif, setAVerif] = useState(false);
  const [nonLus, setNonLus] = useState(false);
  const [saisie, setSaisie] = useState('');
  const [cherche, setCherche] = useState('');
  useEffect(() => { const t = setTimeout(() => setCherche(saisie.trim().length >= 2 ? saisie.trim() : ''), 150); return () => clearTimeout(t); }, [saisie]);
  const [pages, setPages] = useState(undefined);
  const [lecture, setLecture] = useState(false);
  const [ouvert, setOuvert] = useState('');
  const [panne, setPanne] = useState('');
  // Un e-mail choisi dans la loupe (src/rechercheEcran.js) : il s'ouvre ici, par l'id de SA ligne.
  useEffect(() => { const f = () => { const id = prendreDemande('email'); if (id) setOuvert(id); }; f(); window.addEventListener('vrm:recherche-ouvrir', f); return () => window.removeEventListener('vrm:recherche-ouvrir', f); }, []);
  const [luA, setLuA] = useState(0);
  const [vieille, setVieille] = useState(false);
  const [deplies, setDeplies] = useState(() => new Set());
  const [lusLocaux, setLusLocaux] = useState(() => new Map());
  const [avis, setAvis] = useState('');
  // Deux volets à l'ordinateur (≥ 1024, la règle de la coque) ; en dessous, la lecture est une feuille.
  const large = useOrdinateur();
  useEffect(() => { if (!avis) return undefined; const t = setTimeout(() => setAvis(''), 2600); return () => clearTimeout(t); }, [avis]);
  const gen = useRef(0);
  const auth = useRef(headers); auth.current = headers;
  const entetes = useCallback(() => (auth.current ? auth.current() : {}), []);
  const charger = useCallback(async (page = 0) => {
    const g = ++gen.current;
    setLecture(true);
    if (page === 0) { setPages(undefined); setPanne(''); }
    let statut = 0;
    try {
      const q = new URLSearchParams({ mode: 'journal', page: String(page), parPage: String(PAR_PAGE) });
      if (rubrique) q.set('boite', rubrique); if (adresse) q.set('adresse', adresse);
      if (aVerif) q.set('etat', 'a-verifier'); if (cherche) q.set('cherche', cherche); if (nonLus) q.set('nonlus', '1');
      const r = await requeteJsonBornee(`/api/email-rattacher?${q}`, { headers: entetes(), cache: 'no-store' });
      statut = r.status;
      if (g !== gen.current) return;
      if (!r.ok || !formeListe(r.json)) { if (page === 0) { setPages(null); setPanne(raisonPanne(null, statut)); } else setPages((p) => (p ? { ...p, suiteKO: true } : p)); return; }
      const j = r.json;
      setPages((p) => (page === 0 || !p ? j : { ...j, compteurs: p.compteurs, emails: [...p.emails, ...j.emails.filter((x) => !p.emails.some((y) => y.id === x.id))] }));
      if (page === 0) { setLuA(Date.now()); setVieille(false); }
    } catch (err) { if (g === gen.current) { if (page === 0) { setPages(null); setPanne(raisonPanne(err, statut)); } else setPages((p) => (p ? { ...p, suiteKO: true } : p)); } }
    finally { if (g === gen.current) setLecture(false); }
  }, [rubrique, adresse, aVerif, cherche, nonLus, entetes]);
  useEffect(() => { charger(0); }, [charger]);
  useEffect(() => {
    if (!luA) return undefined;
    const voir = () => { if (Date.now() - luA >= VIEILLE) setVieille(true); };
    const t = setTimeout(voir, Math.max(0, VIEILLE - (Date.now() - luA)) + 50);
    document.addEventListener('visibilitychange', voir); window.addEventListener('focus', voir);
    return () => { clearTimeout(t); document.removeEventListener('visibilitychange', voir); window.removeEventListener('focus', voir); };
  }, [luA]);
  // (16 nov.) Un e-mail vient d'être rangé chez le serveur : « Actualiser » paraît — la liste n'est relue
  // que sur SON geste (rien ne bouge sous ses yeux pendant qu'il lit).
  useEffect(() => {
    const f = (e) => { const d = e && e.detail; if (d && Array.isArray(d.quoi) && d.quoi.some((q) => q && q.quoi === 'emails')) setVieille(true); };
    window.addEventListener('vrm:neuf', f);
    return () => window.removeEventListener('vrm:neuf', f);
  }, []);
  const [adressesLues, setAdresses] = useState(null);
  const adresses = adressesLues || (pages && Array.isArray(pages.adresses) ? pages.adresses : null);
  useEffect(() => { if (pages && Array.isArray(pages.adresses)) setAdresses(pages.adresses); }, [pages]);
  const c = pages && pages.compteurs;
  const parR = c && c.parRubrique && typeof c.parRubrique === 'object' ? c.parRubrique : null;
  const lusSus = !!(pages && pages.lus === 'lu');
  const luDe = useCallback((e) => (lusLocaux.has(e.id) ? lusLocaux.get(e.id) : (typeof e.lu === 'boolean' ? e.lu : null)), [lusLocaux]);
  const nNonLus = useMemo(() => {
    if (!c || !Number.isFinite(c.nonLus)) return null;
    let n = c.nonLus;
    for (const e of (pages && pages.emails) || []) if (lusLocaux.has(e.id) && typeof e.lu === 'boolean' && lusLocaux.get(e.id) !== e.lu) n += lusLocaux.get(e.id) ? -1 : 1;
    return Math.max(0, n);
  }, [c, pages, lusLocaux]);
  const ecrire = useRef(ecrireLus); ecrire.current = ecrireLus;
  const poserLu = useCallback((liste, valeur, gestes) => {
    setLusLocaux((m) => { const n = new Map(m); for (const e of liste) n.set(e.id, valeur); return n; });
    if (!ecrire.current) return;
    Promise.resolve(ecrire.current(gestes)).then((ok) => { if (!ok) setAvis(tr('emails.enregistreAutresAppareils')); }).catch(() => setAvis(tr('emails.enregistreAutresAppareils')));
  }, []);
  const onLu = useCallback((e, valeur) => poserLu([e], valeur, [{ k: valeur ? 'lu' : 'nonlu', id: e.id, at: e.at }]), [poserLu]);
  const ouvrir = useCallback((e) => { setOuvert(e.id); if (luDe(e) === false) onLu(e, true); }, [luDe, onLu]);
  const filtreActif = !!(rubrique || adresse || aVerif || cherche || nonLus);
  const toutMarquerLu = () => {
    const charges = ((pages && pages.emails) || []).filter((e) => luDe(e) === false);
    if (!filtreActif && pages && pages.dernierAt) poserLu(charges, true, [{ k: 'tout', jusqua: pages.dernierAt }]);
    else if (charges.length) poserLu(charges, true, charges.map((e) => ({ k: 'lu', id: e.id, at: e.at })));
    setAvis(filtreActif ? tr('mail.marquesLus', { n: charges.length }) : tr('mail.toutLu'));
  };
  const maintenant = useMemo(() => Date.now(), [pages]);
  // Comme Mail : pendant que la boîte cherche chez VRM, les e-mails DÉJÀ lus qui contiennent le mot se montrent.
  const motLocal = saisie.trim().length >= 2 && saisie.trim() !== cherche ? saisie.trim().toLowerCase() : '';
  const groupes = useMemo(() => {
    if (!(pages && Array.isArray(pages.emails))) return [];
    const l = motLocal ? pages.emails.filter((e) => [e.subject, e.from, e.compte && e.compte.nom, JSON.stringify(e.resume || {})].join(' ').toLowerCase().includes(motLocal)) : pages.emails;
    return groupesParJour(l).map((g) => ({ ...g, items: empiler(g.emails, delies, maintenant) }));
  }, [pages, delies, maintenant, motLocal]);
  // Rangés à part (mêmes e-mails, même ordre), repliés en bas de LEUR vue.
  const { groupesV, rangesV } = useMemo(() => {
    const tous = [];
    const gs = groupes.map((g) => { const { visibles, ranges: rr } = separerRanges(g.items, ranges); tous.push(...rr); return { ...g, items: visibles }; });
    return { groupesV: gs, rangesV: tous };
  }, [groupes, ranges]);
  const nomCompte = (adr) => { const a = Array.isArray(adresses) ? adresses.find((x) => x.adresse === adr) : null; return (a && a.nom) || adr; };
  const nomsDoubles = useMemo(() => { const n = {}; (adresses || []).forEach((a) => { if (a.nom) n[a.nom] = (n[a.nom] || 0) + 1; }); return n; }, [adresses]);
  const libelleCompte = (a) => (a.nom ? (nomsDoubles[a.nom] > 1 ? `${a.nom} · ${a.adresse}` : a.nom) : a.adresse);
  const choixCompte = Array.isArray(adresses) && (adresses.length > 1 || (adresse && adresses.length > 0));
  const filtre = !!(cherche || aVerif || nonLus);
  // (6 nov.) Les rubriques ne portent leur nombre que s'il est COMPLET (la route compte les 200 derniers).
  const complet = !!(c && parR && !c.plus);
  // Les nombres des segments : relevés sur la vue « Tout » (sans filtre), gardés quand un segment filtre.
  const nombres = useRef(null);
  if (!filtre && c && (!rubrique || !nombres.current)) nombres.current = { tout: complet ? c.sur : null, colis: complet && Number.isFinite(parR.colis) ? parR.colis : null, ventes: complet && Number.isFinite(parR.ventes) ? parR.ventes : null,
    achats: complet && Number.isFinite(parR.achats) ? parR.achats : null, atraiter: c.aVerifier > 0 ? c.aVerifier : (Number.isFinite(c.aVerifier) ? 0 : null), plus: !!c.plus };
  const motRubrique = (RUBRIQUES_BOITE.find((x) => x.id === rubrique) || {}).mot || '';
  const vide = pages && pages.emails.length === 0;
  // La suite se charge au défilement (une sentinelle en bas de la liste).
  const sentinelle = useRef(null);
  const suiteRef = useRef(null); suiteRef.current = () => { if (pages && pages.suite && !pages.suiteKO && !lecture) charger((pages.page || 0) + 1); };
  useEffect(() => {
    const n = sentinelle.current; if (!n || typeof IntersectionObserver === 'undefined' || lecture) return undefined;
    let racine = null;
    for (let p = n.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowY; if (o === 'auto' || o === 'scroll') { racine = p; break; } }
    const io = new IntersectionObserver((l) => { if (l.some((x) => x.isIntersecting)) suiteRef.current(); }, { root: racine, rootMargin: '600px 0px' });
    io.observe(n);
    return () => io.disconnect();
  }, [pages, lecture]);
  const photoLigne = useCallback((e) => (photoDe ? photoDe(e) : null), [photoDe]);
  const lectureCol = useRef(null);
  useEffect(() => { if (large && lectureCol.current) lectureCol.current.scrollTop = 0; }, [ouvert, large]);
  // Le clavier, comme Mail (ordinateur) : ↓ / ↑ ouvrent l'e-mail voisin, Échap ferme la lecture.
  const auClavier = (ev) => {
    if (!large || ev.altKey || ev.metaKey || ev.ctrlKey) return;
    const ligne = ev.target && ev.target.closest ? ev.target.closest('.n-mail-ligne') : null;
    if (ev.key === 'Escape' && ouvert && !/^(INPUT|SELECT|TEXTAREA)$/.test(ev.target.tagName || '')) { ev.preventDefault(); setOuvert(''); return; }
    if (!ligne || (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp')) return;
    const toutes = [...ev.currentTarget.querySelectorAll('.n-mail-ligne[data-boite-email], .n-mail-ligne[data-boite-pile-tete]')];
    const i = toutes.indexOf(ligne);
    const suiv = toutes[i + (ev.key === 'ArrowDown' ? 1 : -1)];
    if (i < 0 || !suiv) return;
    ev.preventDefault();
    try { suiv.focus({ preventScroll: true }); suiv.scrollIntoView({ block: 'nearest' }); } catch (_) { /* rien */ }
    const id = suiv.getAttribute('data-boite-email');
    const e = id && pages && pages.emails.find((x) => x.id === id);
    if (e) ouvrir(e);
  };
  // (11 nov., lot actions-serie) Plusieurs e-mails, « Lu » / « Non lu » une fois, en UNE écriture.
  const ordreSerie = useMemo(() => ((pages && pages.emails) || []).map((e) => String(e.id)), [pages]);
  const serie = useSelectionSerie(ordreSerie, { nom: 'emails' });
  const actionsSerie = [true, false].map((valeur) => ({ k: valeur ? 'lu' : 'nonlu', libelle: valeur ? tr('emails.lu') : tr('emails.nonLu'), variante: valeur ? 'primaire' : 'secondaire', faire: (cles) => {
    const parId = new Map(((pages && pages.emails) || []).map((e) => [String(e.id), e]));
    const { ok, pasFaits } = trierSerie(cles.map((k) => parId.get(k)).filter(Boolean), (e) => luDe(e) === valeur ? (valeur ? 'déjà lu' : 'déjà non lu') : true);
    if (ok.length) poserLu(ok, valeur, ok.map((e) => ({ k: valeur ? 'lu' : 'nonlu', id: e.id, at: e.at })));
    return resumeSerie({ faits: ok, pasFaits }, valeur ? { un: 'marqué lu', plusieurs: 'marqués lus' } : { un: 'marqué non lu', plusieurs: 'marqués non lus' });
  } }));
  const rendreEmail = (e) => <Ligne key={e.id} e={e} delies={delies} ouvert={ouvert === e.id} lu={luDe(e)} photo={photoLigne(e)} onOuvrir={ouvrir} onLu={onLu} maintenant={maintenant}
    attrsSerie={serie.ligne(String(e.id))} caseSerie={serie.actif ? <CaseSerie serie={serie} cle={String(e.id)} etiquette={e.subject || tr('emails.eMailSans')}/> : null}
    range={estRange(ranges, e.id)} onRanger={onRanger}/>;
  const N = nombres.current || {};
  const segActif = nonLus ? '' : segmentDesFiltres({ rubrique, aVerif });
  const MOT_SEG = { atraiter: tr('v2.mail.atraiter'), colis: tr('v2.mail.colis'), ventes: tr('v2.mail.ventes'), achats: tr('v2.mail.achats'), tout: tr('v2.mail.tout') };
  const choisirSeg = (v) => { const f = filtresDuSegment(v); setNonLus(false); setAVerif(f.aVerif); setRubrique(f.rubrique); setOuvert(''); };
  const filtreHorsSeg = (rubrique && !['colis', 'ventes', 'achats'].includes(rubrique)) || nonLus || (aVerif && rubrique);
  const emailOuvert = ouvert && pages ? pages.emails.find((x) => x.id === ouvert) : null;
  const deuxVolets = !!(large && ouvert);
  const lectureProps = { onRelier, id: ouvert, entetes, delies, onFermer: () => setOuvert(''), photoDe, onLu, lu: emailOuvert ? luDe(emailOuvert) : null, range: emailOuvert ? estRange(ranges, emailOuvert.id) : null, onRanger: emailOuvert ? onRanger : null };
  const choixFeuille = [['nonlus', tr('emails.nonLus'), nNonLus, nonLus], ['codes', (RUBRIQUES_BOITE.find((x) => x.id === 'codes') || {}).mot, null, rubrique === 'codes'], ['offres', (RUBRIQUES_BOITE.find((x) => x.id === 'offres') || {}).mot, null, rubrique === 'offres']];
  return (
    <div className="n-mail-boite" data-boite-large={large ? '1' : '0'} data-boite-ouvert={ouvert ? '1' : '0'} data-deux-volets={deuxVolets ? '1' : '0'} onKeyDown={auClavier}>
      {/* LE HAUT, sur toute la largeur : le segmenté, puis la recherche, le compte, « ⋯ ». */}
      <div className="n-mail-haut" data-v2-mail-tete="">
        <Segmente className="n-mail-seg" libelle={tr('emails.trierEMails')} valeur={segActif} onChange={choisirSeg}
          options={SEGMENTS_EMAILS.map((v) => ({ cle: v, libelle: MOT_SEG[v], n: N[v] != null && (v !== 'atraiter' || N[v] > 0) ? String(N[v]) + (v === 'atraiter' && N.plus ? '+' : '') : undefined }))}/>
        <div className="n-mail-outils" data-v2-mail-outils="">
          <label className="n-mail-cherche" data-boite-cherche={cherche ? '1' : '0'}>
            <span className="n-mail-sr">{tr('emails.chercherEMail')}</span>
            <Glyphe nom="search" taille={18}/>
            <input type="search" value={saisie} onChange={(ev) => { setSaisie(ev.target.value); setOuvert(''); }} placeholder={tr('emails.articleCodeSuivi')} aria-label={tr('emails.chercherEMail')} data-boite-cherche-champ="" enterKeyHint="search" autoComplete="off"/>
          </label>
          {choixCompte ? <label className="n-mail-compte-choix" data-v2-mail-compte="">
            <span className="n-mail-sr">{tr('ventes.compte4')}</span>
            <select value={adresse} onChange={(ev) => { setAdresse(ev.target.value); setOuvert(''); }} data-boite-adresse="" aria-label={tr('ventes.compte4')}>
              <option value="">{tr('achats.tousComptes')}</option>
              {(adresses || []).map((a) => <option key={a.adresse} value={a.adresse}>{libelleCompte(a)}</option>)}
            </select>
          </label> : null}
          {vieille && pages !== null ? <Bouton variante="texte" chargement={lecture} onClick={() => charger(0)} attrs={{ 'data-boite-actualiser': '', title: luA ? tr('emails.lue', { heure: String(heure(new Date(luA).toISOString())) }) : undefined }}>{tr('emails.actualiser')}</Bouton> : null}
          {large ? <Bouton variante="texte" onClick={onRelier} attrs={{ 'data-boite-relier': '' }}>{tr('v2.mail.relier')}</Bouton> : null}
          <BoutonIcone libelle={tr('v2.mail.plus')} icone={<Glyphe nom="more" taille={22}/>} actif={nonLus || rubrique === 'codes' || rubrique === 'offres'} onClick={() => setFeuille(true)} attrs={{ 'data-v2-mail-plus': '' }}/>
        </div>
        {saisie.trim().length === 1 ? <p className="n-mail-aide" data-boite-aide-recherche="">{tr('emails.saisisMoins2')}</p> : null}
        {filtreHorsSeg ? <div className="n-mail-filtre" data-v2-mail-filtre="">
          <span>{[rubrique && !['colis', 'ventes', 'achats'].includes(rubrique) ? motRubrique : '', nonLus ? tr('emails.nonLus') : ''].filter(Boolean).join(' · ') || tr('journee.verifier')}</span>
          <Bouton variante="texte" onClick={() => { setRubrique(''); setNonLus(false); setAVerif(false); setOuvert(''); }}>{tr('v2.mail.tout')}</Bouton>
        </div> : null}
        {tete}
      </div>
      <Feuille ouverte={feuille} onFermer={() => setFeuille(false)} titre={tr('v2.mail.plus')} attrs={{ 'data-v2-mail-feuille': '' }}>
        <Groupe>
          {choixFeuille.map(([k, l, n, on]) => <Rangee key={k} titre={l} valeur={n != null && n > 0 ? String(n) : undefined} fin={on ? 'coche' : undefined} attrs={{ 'data-v2-mail-choix': k, 'aria-pressed': on ? 'true' : 'false' }}
            onClick={() => { if (k === 'nonlus') setNonLus((v) => !v); else { setNonLus(false); setAVerif(false); setRubrique(rubrique === k ? '' : k); } setOuvert(''); setFeuille(false); }}/>)}
        </Groupe>
        {choixCompte ? <label className="n-mail-compte-feuille" data-v2-mail-compte-feuille="">
          <span className="n-mail-sr">{tr('ventes.compte4')}</span>
          <select value={adresse} onChange={(ev) => { setAdresse(ev.target.value); setOuvert(''); setFeuille(false); }} aria-label={tr('ventes.compte4')}>
            <option value="">{tr('achats.tousComptes')}</option>
            {(adresses || []).map((a) => <option key={a.adresse} value={a.adresse}>{libelleCompte(a)}</option>)}
          </select>
        </label> : null}
        <Groupe>
          {lusSus && nNonLus > 0 ? <Rangee titre={filtreActif ? tr('emails.marquerCeuxCi') : tr('emails.toutMarquerLu')} attrs={{ 'data-boite-tout-lu': '' }} onClick={() => { toutMarquerLu(); setFeuille(false); }}/> : null}
          {!serie.actif && serie.total && ordreSerie.length > 1 ? <Rangee titre={tr('v2.mail.selectionner')} attrs={{ 'data-v2-mail-choix': 'selectionner' }} onClick={() => { setFeuille(false); serie.ouvrir(); }}/> : null}
          <Rangee titre={tr('v2.mail.relier')} fin="chevron" attrs={{ 'data-v2-mail-choix': 'relier' }} onClick={() => { setFeuille(false); onRelier && onRelier(); }}/>
        </Groupe>
      </Feuille>
      <BarreSerie serie={serie} actions={actionsSerie} unite={{ un: 'e-mail sélectionné', plusieurs: 'e-mails sélectionnés' }}/>
      <div className="n-mail-corps" data-boite-corps-ecran="">
        <div className="n-mail-liste-col" data-boite-liste-col="">
          {pages === undefined ? <div className="n-mail-attente" data-boite-chargement="" role="status" aria-busy="true"><span className="n-mail-sr">{tr('emails.lectureBoite')}</span><Attente forme="rangees" n={7} vignette={44} titre/></div> : null}
          {pages === null ? <EtatPanne className="n-mail-panne" role="alert" data-boite-etat="panne" data-boite="pas-su" quoi={tr('mail.taBoite')} raison={`${panne || tr('mail.panne.lecture')} ${tr('mail.rienPerdu')}`} onReessayer={() => charger(0)}/> : null}
          {vide ? <div className="n-mail-etat" data-boite-etat={cherche ? 'recherche-vide' : nonLus ? 'nonlus-vide' : aVerif ? 'rien-a-verifier' : adresse ? 'compte-vide' : rubrique ? 'rubrique-vide' : 'vide'} data-boite={cherche ? undefined : 'vide'}>
            {cherche ? <Vide icone={<Glyphe nom="search" taille={40}/>} phrase={tr('emails.aucunEMail', { cherche: String(cherche) })} detail={tr('mail.vide.rechercheDetail')} action={<Bouton onClick={() => { setSaisie(''); setCherche(''); }} attrs={{ 'data-boite-etat-geste': 'effacer' }}>{tr('mail.vide.effacer')}</Bouton>}/>
              : nonLus ? <Vide icone={Ic.lu} phrase={tr('emails.toutLu')} action={<Bouton onClick={() => setNonLus(false)} attrs={{ 'data-boite-etat-geste': 'tout' }}>{tr('mail.vide.voirTout')}</Bouton>}/>
              : aVerif && !rubrique ? <Vide icone={Ic.lu} phrase={tr('mail.vide.rienATraiter')} detail={tr('mail.vide.rienATraiterDetail')} action={<Bouton onClick={() => choisirSeg('tout')} attrs={{ 'data-boite-etat-geste': 'tout' }}>{tr('mail.vide.voirTout')}</Bouton>}/>
              : adresse ? <Vide icone={Ic.lu} phrase={tr('mail.vide.compte', { compte: nomCompte(adresse) })} action={<Bouton onClick={() => setAdresse('')} attrs={{ 'data-boite-etat-geste': 'comptes' }}>{tr('achats.tousComptes')}</Bouton>}/>
              : rubrique ? <Vide icone={Ic.lu} phrase={tr('emails.aucunEMail2', { motRubrique: String(motRubrique) })} action={<Bouton onClick={() => choisirSeg('tout')} attrs={{ 'data-boite-etat-geste': 'tout' }}>{tr('mail.vide.voirTout')}</Bouton>}/>
              : <Vide icone={<Glyphe nom="mail" taille={40}/>} phrase={tr('emails.boiteVrmVide')} detail={tr('mail.vide.relierDetail')} action={<Bouton variante="plein" onClick={onRelier} attrs={{ 'data-boite-etat-geste': 'relier' }}>{tr('v2.mail.relier')}</Bouton>}/>}
          </div> : null}
          {groupes.length > 0 ? <div className="n-mail-liste" data-boite-liste="">
            {groupesV.map((g) => (g.items.length ? <section key={g.cle} className="n-mail-jour" data-boite-jour={g.mot} aria-label={enClair(g.mot)}>
              <h2 className="n-mail-jour-titre">{enClair(g.mot)}</h2>
              <ul>
                {g.items.map((it) => (it.k === 'pile'
                  ? <Pile key={it.cle} p={it} rendre={rendreEmail} lus={luDe} delies={delies} maintenant={maintenant} deplie={deplies.has(it.cle)} onDeplier={() => setDeplies((s) => { const n = new Set(s); if (n.has(it.cle)) n.delete(it.cle); else n.add(it.cle); return n; })}/>
                  : rendreEmail(it.e)))}
              </ul>
            </section> : null))}
            {rangesV.length > 0 ? <details className="n-mail-ranges" data-v2-mail-ranges={rangesV.length}>
              <summary><span>{tr('v2.mail.ranges')}</span><span className="n-mail-n">{rangesV.length}</span></summary>
              <ul>{rangesV.map((it) => (it.k === 'pile' ? it.emails.map((x) => rendreEmail(x)) : rendreEmail(it.e)))}</ul>
            </details> : null}
          </div> : null}
          {quarantaine ? <Quarantaine q={quarantaine}/> : null}
          <div ref={sentinelle} className="n-mail-sentinelle" aria-hidden="true"/>
          {pages && pages.suiteKO ? <EtatPanne compact className="n-mail-panne" role="alert" data-boite-suite="pas-su" quoi={tr('mail.laSuite')} raison={tr('mail.suiteRestent')} onReessayer={() => charger((pages.page || 0) + 1)}/> : null}
          {pages && pages.suite && !pages.suiteKO ? <div className="n-mail-plus"><Bouton variante="texte" chargement={lecture} onClick={() => charger((pages.page || 0) + 1)} attrs={{ 'data-boite-plus': '' }}>{tr('achats.voirPlus')}</Bouton></div> : null}
          {pages && !pages.suite && pages.emails.length > 0 ? <p className="n-mail-fin" data-boite-fin="">{tr('mail.fin', { n: pages.emails.length })}</p> : null}
        </div>
        {deuxVolets ? <div ref={lectureCol} className="n-mail-lecture-col" data-boite-lecture-col="">
          <Lecture key={ouvert} {...lectureProps} onAller={onAller} onNum={onNum} plein={false}/>
        </div> : null}
      </div>
      {!large && ouvert ? <Lecture key={ouvert} {...lectureProps} onAller={(u) => { setOuvert(''); onAller && onAller(u); }} onNum={(n) => { setOuvert(''); onNum && onNum(n); }} plein FermeAuRetour={FermeAuRetour}/> : null}
      {avis ? createPortal(<div className="n-mail-avis" role="status" data-boite-avis="">{avis}</div>, document.body) : null}
    </div>
  );
}

// (5 nov., chantier G) UN seul écran « E-mails » : la boîte, et « Relier ma boîte » (le parcours accompagné,
// src/RelierMaBoite.jsx ; l'ancienne scène vers la boîte collective seulement si l'adresse VRM n'est pas ouverte).
// `ecrireLus(gestes)` : l'écriture des lus (src/emailsLusEcriture.js) ; `photoDe(e)` : la photo de la paire
// reliée PAR IDENTITÉ (n° de transaction), ou `null`.
const VUES = ['boite', 'relier'];
export default function BoiteEmails({ headers, delies: deliesRecus = {}, onAller, onNum, onAdresses, FermeAuRetour, vueInitiale = 'boite', reglages = null, aRelier, boites = [], compteInitial = '', lireDernier, ecrireLus, photoDe, Photo = null, ranges = null, onRanger = null, quarantaine = null }) {
  // L'app repasse un objet neuf à chaque rendu : on le garde tant que son CONTENU ne change pas.
  const deliesCle = JSON.stringify(deliesRecus || {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const delies = useMemo(() => deliesRecus || {}, [deliesCle]);
  const [vue, setVue] = useState(VUES.includes(vueInitiale) ? (compteInitial ? 'relier' : vueInitiale) : 'boite');
  const [compte, setCompte] = useState(String(compteInitial || ''));
  const [relies, setRelies] = useState(() => new Set());
  const [pret, setPret] = useState(undefined);   // l'adresse VRM est-elle ouverte ? (undefined en cours · null pas su)
  const haut = useRef(null);
  useEffect(() => {
    const f = () => setVue('relier');
    const g = (ev) => { const u = String((ev && ev.detail) || ''); setVue('relier'); if (u) setCompte(u); };
    const h = () => { if (DEMANDE_RECHERCHE.email) setVue('boite'); };
    h();
    window.addEventListener('vrm:ouvrir-adresses', f);
    window.addEventListener('vrm:relier-compte', g);
    window.addEventListener('vrm:recherche-ouvrir', h);
    return () => { window.removeEventListener('vrm:ouvrir-adresses', f); window.removeEventListener('vrm:relier-compte', g); window.removeEventListener('vrm:recherche-ouvrir', h); };
  }, []);
  const aRelierListe = Array.isArray(aRelier) ? aRelier : [];
  const bandeau = aRelierListe.filter((c) => !relies.has(c.uid));
  const compteOuvert = compte && aRelierListe.some((c) => c.uid === compte) ? compte : '';
  const relierCompte = (uid) => { setCompte(String(uid)); setVue('relier'); };
  const noterRelie = useCallback((uid) => setRelies((s) => (s.has(uid) ? s : new Set([...s, uid]))), []);
  const [voirReglages, setVoirReglages] = useState(false);
  const versAdresses = () => {
    setVoirReglages(true);
    if (onAdresses) onAdresses();
    try { haut.current && haut.current.scrollIntoView({ block: 'start', behavior: reduitMvt() ? 'auto' : 'smooth' }); } catch (_) { /* rien */ }
  };
  return (
    <PhotoBoite.Provider value={Photo}>
    <section className="n-mail" data-boite-emails="" data-vue={vue}>
      {vue === 'boite' ? <Boite headers={headers} delies={delies} onAller={onAller} onNum={onNum} FermeAuRetour={FermeAuRetour} onRelier={() => setVue('relier')} ecrireLus={ecrireLus} photoDe={photoDe} ranges={ranges} onRanger={onRanger} quarantaine={quarantaine}
        tete={<ARelier comptes={bandeau} onRelier={relierCompte}/>}/> : null}
      {vue === 'relier' ? <div className="n-mail-relier" data-boite-relier="">
        <div className="n-mail-relier-retour"><Bouton variante="texte" onClick={() => setVue('boite')} attrs={{ 'data-v2-mail-retour': '' }}>{'‹ ' + tr('v2.mail.boite')}</Bouton></div>
        <RelierMaBoite headers={headers} onBoite={() => setVue('boite')} comptes={aRelierListe} uid={compteOuvert} onChoisir={setCompte} boites={boites} lireDernier={lireDernier} onRelie={noterRelie} onPret={setPret}/>
        {/* (19 nov.) L'ancien panneau « Aperçu · Journal · Adresses · À rattacher » (le suivi technique de la réception) :
            rangé, replié sous le parcours — il s'ouvre sur SON toucher (ou quand l'ancienne scène demande « Mes adresses »). */}
        {reglages ? <details ref={haut} className="n-mail-reglages" data-boite-reglages="" open={voirReglages} onToggle={(ev) => setVoirReglages(ev.currentTarget.open)}>
          <summary className="n-mail-reglages-tete"><span className="n-mail-reglages-titre">{tr('mail.reglages.titre')}</span><span className="n-mail-reglages-sous">{tr('mail.reglages.sous')}</span><Glyphe nom="chevron" taille={16}/></summary>
          {voirReglages ? <div className="n-mail-reglages-corps">{reglages}</div> : null}
        </details> : null}
        {pret === false && <section className="vrm-boite-guide" aria-label={tr('emails.faireSuivreE')} data-boite-guide="">
          <div className="vrm-boite">
            {reglages ? <h2 className="vrm-boite-guide-titre">{tr('emails.faireSuivreE')}</h2> : null}
            <RelierBoite messagerieInitiale={(aRelierListe.find((c) => c.uid === compteOuvert) || {}).messagerie} onAdresses={onAdresses ? versAdresses : undefined}/>
          </div>
        </section>}
      </div> : null}
    </section>
    </PhotoBoite.Provider>
  );
}
