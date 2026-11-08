// ── L'ÉCRAN « E-MAILS » (5 nov., demande de Julien) ─────────────────────────
// « Un onglet dédié aux e-mails… une vraie boîte de réception, une liste des
// reçus, des filtres (par compte, ventes, achats, codes de retrait…) » et « un
// motion design qui montre, boîte par boîte, comment transmettre les e-mails ».
// (5 nov., soir et nuit : « bcp plus clair », « tu peux faire mieux ».) Chaque
// ligne dit D'ABORD ce que c'est (`titreSimple`/`ligneEmail`, src/boiteEmails.js —
// tiré de ce que VRM a rangé, jamais du sujet), groupée par jour, la marque de
// l'expéditeur à gauche, le geste en ambre seulement s'il est proche.
//
// (6 nov., v36 — Julien : « continue à améliorer la boîte mail de l'app, c'est
// pas ouf » ; « je veux vraiment quelque chose de plus visuel, de beaucoup plus
// beau ».) La boîte façon Mail d'iPhone, pensée pour un revendeur :
//   · LU / NON LU (api/_lib/emails-lus.js, une règle lue par la route ET ici) :
//     point bleu, filtre « Non lus », « Tout marquer lu », « Marquer non lu »
//     (au doigt : glisser la ligne vers la droite) — rien n'est jamais caché ;
//   · le CODE DE RETRAIT en grand sur la ligne, copiable d'un toucher —
//     seulement s'il est LU dans le résumé (pas su ⇒ pas de code) ;
//   · avatars ronds : logo du site, logo du transporteur (ceux de l'app), sinon
//     un monogramme neutre ; la PHOTO de la paire quand l'e-mail est relié à une
//     vente par identité (n° de transaction) ;
//   · les rafales d'e-mails identiques (11 « Commande mise à jour » en une
//     minute) en UNE pile qui se déplie ; en-têtes de jour collants ;
//   · la lecture : une carte « ce qu'il faut savoir » (le code façon carte
//     d'embarquement, le montant en grand, la photo, le lieu, la date limite),
//     les gestes PAR IDENTITÉ, puis le message d'origine RENDU PROPREMENT
//     (`lireCorps` : paragraphes recollés, gras, liens, mentions repliées) ;
//   · 50 e-mails par page, la suite chargée au défilement ;
//   · des états illustrés qui disent quoi faire.
//
// ⚠️ Lecture : la route existante `/api/email-rattacher?mode=journal` (aucune
//    fonction serverless de plus). Une page = scalaires projetés ; le corps
//    d'UN e-mail se lit sur son clic (`lire=`). Jamais `select=data`.
// ⚠️ Trois états partout : `undefined` en cours · `null` pas su · valeur lue.
// ⚠️ AUCUN HTML n'est rendu : le texte gardé est dessiné en éléments React
//    (aucun `dangerouslySetInnerHTML`, aucun `iframe`) ; balises, scripts et
//    `on…=` restés dans le texte sont retirés (`retirerBalises`) ; un lien n'est
//    gardé qu'en http(s), ouvert ailleurs (`noopener noreferrer`).
// ⚠️ (6 nov., décision de Julien) Le HTML d'origine ASSAINI des e-mails « à geste »
//    (30 jours, api/_lib/email-html.js) n'est rendu QUE dans le cadre isolé de
//    src/CadreEmail.jsx (`sandbox` sans `allow-scripts`) — jamais dans cet écran ;
//    pas demandé en mode stream (« Masqué en mode stream » : noms et adresses).
// ⚠️ §5 : un geste (« Voir le colis… ») ne part QUE d'une identité lue.
// ⚠️ Au téléphone, la feuille de lecture est OPAQUE dès sa première image.
import React, { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RUBRIQUES_BOITE, rubriqueEmail } from '../api/_lib/boite-email.js';
import { expediteurLisible, dateEmail, poidsLisible, ceQueVrmAFait, titreSimple, titreEnClair, groupesParJour, siteExpediteur, ligneEmail, gesteAmbre, monogramme, empiler, carteHeros, gestesEmail, lireCorps, lieuLisible, codeSurLigne, adresseLisible } from './boiteEmails.js';
import { requeteJsonBornee } from './requeteJsonBornee.js';
import { LogoSite } from './SelecteurSites.jsx';
import { LogoTransporteur } from './PastilleTransporteur.jsx';
import { cleTransporteur, nomDuTransporteur } from './transporteursVisuels.js';
import RelierBoite from './RelierBoite.jsx';
import RelierCompte from './RelierCompte.jsx';
import { phraseARelier } from './relierCompte.js';
import { EtatPanne } from './composants/EtatPanne.jsx';
import CadreEmail from './CadreEmail.jsx';
import { streamAllume } from './modeStream.js';
import { prendreDemande, DEMANDE_RECHERCHE } from './rechercheEcran.js';
import './boite-emails.css';
import {CompteEmailAVerifier} from './ActionsClaires.jsx';

const PAR_PAGE = 50;
const formeListe = (j) => j && j.ok === true && Array.isArray(j.emails) && j.compteurs && typeof j.compteurs.sur === 'number';
const heure = (v) => { const t = Date.parse(v || ''); return Number.isFinite(t) ? new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''; };
const quandLong = (v) => { const t = Date.parse(v || ''); return Number.isFinite(t) ? new Date(t).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'date non lue'; };
const reduitMvt = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };
// Une liste qui a plus d'une minute : « Actualiser » devient utile.
const VIEILLE = 60e3;
function raisonPanne(err, statut) {
  try { if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'Cet appareil n’est pas connecté à internet.'; } catch (_) {}
  if (err && err.name === 'AbortError') return 'VRM n’a pas répondu à temps.';
  if (statut === 401 || statut === 403) return 'Ta session n’a pas été reconnue : reconnecte-toi.';
  if (err) return 'La connexion à VRM a échoué.';
  return 'VRM n’a pas pu lire ta boîte.';
}
// Copier un code : le presse-papiers de l'appareil, sinon un champ sélectionné.
async function copier(texte) {
  try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(texte); return true; } } catch (_) {}
  try { const t = document.createElement('textarea'); t.value = texte; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select(); const ok = document.execCommand('copy'); t.remove(); return ok; } catch (_) { return false; }
}

// ── ICÔNES (traits de 1,6, une seule famille) ───────────────────────────────
const Ic = {
  trombone: <svg className="vrm-boite-pj-ic" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M10.5 4.5 5.8 9.2a1.4 1.4 0 0 0 2 2l5-5a2.8 2.8 0 0 0-4-4l-5.2 5.2a4.2 4.2 0 0 0 6 6l4-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  actualiser: <svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true"><path d="M16 10a6 6 0 1 1-1.8-4.3M16 3.5v3.2h-3.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  copier: <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><rect x="7" y="7" width="9.5" height="9.5" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.6"/><path d="M13 4.5A1.5 1.5 0 0 0 11.5 3h-6A2.5 2.5 0 0 0 3 5.5v6A1.5 1.5 0 0 0 4.5 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,
  coche: <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="m4.5 10.5 3.5 3.5 7.5-8" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  chevron: <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="m4.5 2.5 3.5 3.5-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  lu: <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="M3 6.5 10 11l7-4.5M3.5 5h13a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>,
  lieu: <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M10 17.5s5.5-5 5.5-9.5a5.5 5.5 0 0 0-11 0c0 4.5 5.5 9.5 5.5 9.5Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><circle cx="10" cy="8" r="2" fill="none" stroke="currentColor" strokeWidth="1.6"/></svg>,
  horloge: <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="1.6"/><path d="M10 6v4.2l2.8 1.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,
};

// ── LES DESSINS DES ÉTATS (traits fins, encre douce ; un seul point d'accent) ─
function Dessin({ k }) {
  const trait = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  return <svg className="vrm-boite-dessin" data-boite-dessin={k} viewBox="0 0 120 96" width="120" height="96" aria-hidden="true">
    <ellipse cx="60" cy="86" rx="38" ry="5" className="vrm-boite-dessin-sol"/>
    {k === 'lu' ? <>
      <rect x="26" y="22" width="68" height="50" rx="10" {...trait}/>
      <path d="m30 28 30 22 30-22" {...trait}/>
      <circle cx="88" cy="22" r="13" className="vrm-boite-dessin-accent"/>
      <path d="m82 22 4.5 4.5L95 18" fill="none" stroke="var(--bx-sur-accent)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
    </> : k === 'recherche' ? <>
      <rect x="20" y="26" width="60" height="44" rx="9" {...trait}/>
      <path d="m24 31 26 19 26-19" {...trait}/>
      <circle cx="80" cy="56" r="14" className="vrm-boite-dessin-fond" {...trait}/>
      <path d="m90 66 10 10" {...trait} strokeWidth="3"/>
    </> : k === 'relier' ? <>
      <rect x="10" y="30" width="44" height="34" rx="8" {...trait}/>
      <path d="m14 34 18 13 18-13" {...trait}/>
      <rect x="66" y="30" width="44" height="34" rx="8" {...trait}/>
      <path d="M44 20c10-10 22-10 32 0" {...trait} strokeDasharray="3 5"/>
      <circle cx="76" cy="20" r="4" className="vrm-boite-dessin-accent"/>
    </> : <>
      <path d="M28 46 42 24h36l14 22v24a6 6 0 0 1-6 6H34a6 6 0 0 1-6-6Z" {...trait}/>
      <path d="M28 46h20l4 8h16l4-8h20" {...trait}/>
      <circle cx="60" cy="14" r="4" className="vrm-boite-dessin-accent"/>
    </>}
  </svg>;
}

// ── L'AVATAR DE L'EXPÉDITEUR (rond, 40 px) ───────────────────────────────────
// Le logo du site (Vinted, Leboncoin, eBay, Vestiaire — fichiers de l'app), le
// logo du transporteur (celui que l'app montre déjà, src/PastilleTransporteur),
// sinon un monogramme neutre. Jamais une couleur ni un logo inventés.
function Avatar({ from, grande = false }) {
  const site = siteExpediteur(from);
  const nom = expediteurLisible(from);
  const tr = site ? '' : cleTransporteur(nom);
  const mono = <span className="vrm-boite-mono">{monogramme(nom)}</span>;
  return <span className={'vrm-boite-marque' + (grande ? ' is-grande' : '')} data-marque={site || (tr ? 'transporteur' : 'monogramme')} data-transporteur={tr || undefined} data-stream-libre="" aria-hidden="true">
    {site ? <LogoSite site={site}/> : tr ? <LogoTransporteur cle={tr} taille={grande ? 30 : 26} repli={mono}/> : mono}
  </span>;
}

// ── LE CODE DE RETRAIT, COPIABLE D'UN TOUCHER ────────────────────────────────
// Le code LU dans le résumé, en gros chiffres ; un toucher le copie (le code sans
// espace) et le dit. En mode stream, il est caché comme tous les codes.
function PuceCode({ code, grande = false, onCopie }) {
  const [copie, setCopie] = useState(false);
  useEffect(() => { if (!copie) return undefined; const t = setTimeout(() => setCopie(false), 1600); return () => clearTimeout(t); }, [copie]);
  const brut = String(code).replace(/\s+/g, '');
  return <button type="button" className={'vrm-boite-puce-code' + (grande ? ' is-grande' : '')} data-boite-code-copier={brut} data-copie={copie ? '1' : undefined}
    aria-label={copie ? `Code ${code} copié` : `Copier le code de retrait ${code}`}
    onClick={async (ev) => { ev.stopPropagation(); const ok = await copier(brut); setCopie(ok); if (onCopie) onCopie(ok); }}>
    {grande ? null : <span className="vrm-boite-puce-chiffres vrm-sensible" data-stream-type="code">{code}</span>}
    <span className="vrm-boite-puce-ic" aria-hidden="true">{copie ? Ic.coche : Ic.copier}</span>
    <span className="vrm-boite-sr" aria-live="polite">{copie ? 'Copié' : ''}</span>
  </button>;
}

// (8 nov.) La photo d'une paire vient de la vente VINTED reliée (`photoDe`) : c'est une photo
// Vinted. Elle passe par la règle des photos Vinted de l'app (`PhotoVinted` : sans référent,
// secours par l'extension, le pictogramme plutôt qu'une image cassée), reçue en `Photo` —
// jamais un <img> nu (audit-photos-vinted). Sans elle, aucune photo n'est montrée.
// Le cadre (taille, coins, place dans la grille) reste celui de la classe : la photo le
// remplit, et l'attente ou le pictogramme s'y posent sans déplacer la ligne.
const PhotoBoite = createContext(null);
const REMPLIT = { width: '100%', height: '100%', objectFit: 'cover', display: 'block' };
function PhotoPaire({ src, className, data }) {
  const Photo = useContext(PhotoBoite);
  if (!src || !Photo) return null;
  return <span className={className} {...data} style={{ display: 'block', overflow: 'hidden' }}><Photo src={src} loading="lazy" decoding="async" style={REMPLIT}/></span>;
}

// ── LA CARTE « CE QU'IL FAUT SAVOIR » ────────────────────────────────────────
function Heros({ e, h, photo }) {
  if (h.genre === 'retrait') {
    const tr = h.transporteur ? cleTransporteur(h.transporteur) : null;
    return <section className="vrm-boite-billet" data-boite-heros="retrait" aria-label="Colis à retirer">
      <div className="vrm-boite-billet-haut">
        <span className="vrm-boite-billet-qui">{tr ? <LogoTransporteur cle={tr} taille={22} repli={null}/> : null}<span>{tr ? nomDuTransporteur(tr) : expediteurLisible(e.from)}</span></span>
        <span className="vrm-boite-billet-etiq">Code de retrait</span>
      </div>
      {h.code
        ? <div className="vrm-boite-billet-code" data-boite-code={h.code}><span className="vrm-boite-billet-chiffres vrm-sensible" data-stream-type="code">{h.code}</span><PuceCode code={h.code} grande/></div>
        : <p className="vrm-boite-billet-sans" data-boite-code="">Code pas encore lu — il est dans le message ci-dessous ou dans l’app du transporteur.</p>}
      <div className="vrm-boite-billet-trou" aria-hidden="true"/>
      <dl className="vrm-boite-billet-bas">
        {h.lieu && <div data-boite-lieu=""><dt>{Ic.lieu}<span>Point de retrait</span></dt><dd><b>{h.lieu.nom}</b>{h.lieu.adresse ? <span>{h.lieu.adresse}</span> : null}</dd></div>}
        {h.limite && <div data-boite-limite={h.limite.jours == null ? '' : h.limite.jours} data-ambre={h.limite.proche ? '1' : undefined}><dt>{Ic.horloge}<span>À retirer avant le</span></dt><dd><b>{h.limite.date}</b>{h.limite.mot ? <span>{h.limite.mot}</span> : null}</dd></div>}
      </dl>
    </section>;
  }
  if (h.montant || h.article || photo) {
    return <section className="vrm-boite-heros" data-boite-heros={h.genre} aria-label="Ce qu’il faut savoir">
      {photo ? <PhotoPaire className="vrm-boite-heros-photo" src={photo} data={{ 'data-boite-photo': '' }}/> : null}
      <div className="vrm-boite-heros-txt">
        {h.montant ? <p className="vrm-boite-heros-montant" data-boite-montant={h.montant}><b>{h.montant}</b>{h.montantMot ? <span>{h.montantMot}</span> : null}</p> : null}
        {h.article ? <p className="vrm-boite-heros-article">{h.article}</p> : null}
        {h.num ? <p className="vrm-boite-heros-num" data-boite-num={h.num}>N°{h.num}</p> : null}
        {h.limite ? <p className="vrm-boite-heros-limite" data-ambre={h.limite.proche ? '1' : undefined}>à envoyer avant le {h.limite.date}{h.limite.mot ? ` · ${h.limite.mot}` : ''}</p> : null}
      </div>
    </section>;
  }
  return null;
}

// ── LE MESSAGE D'ORIGINE, EN ÉLÉMENTS REACT (jamais du HTML) ─────────────────
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
    if (b.k === 'li') { if (!liste) { liste = []; blocs.push(<ul key={'l' + i} className="vrm-boite-msg-liste">{liste}</ul>); } liste.push(<li key={i} data-n={b.n || undefined}>{b.n ? <span className="vrm-boite-msg-n">{b.n}.</span> : null}<span>{contenu}</span></li>); return; }
    liste = null;
    if (b.k === 'etiquette') blocs.push(<p key={i} className="vrm-boite-msg-etiq">{contenu}</p>);
    else if (b.k === 'note') blocs.push(<p key={i} className="vrm-boite-msg-note">{contenu}</p>);
    else blocs.push(<p key={i} className={b.fin ? 'is-fin' : undefined}>{contenu}</p>);
  });
  return <div className="vrm-boite-msg" data-boite-corps={coupe ? 'extrait' : 'lu'}>
    {blocs}
    {coupe ? <p className="vrm-boite-doux" data-boite-extrait="">Extrait : VRM garde le début du message. La suite est dans ta messagerie.</p> : null}
    {c.pied ? <details className="vrm-boite-msg-pied" data-boite-mentions=""><summary>Mentions de l’expéditeur</summary><p>{c.pied}</p></details> : null}
  </div>;
}

// (6 nov.) Le mode stream, suivi ici (l'évènement que pose l'interrupteur de l'app).
function useStreamIci() {
  const [on, setOn] = useState(() => { try { return streamAllume(); } catch (_) { return false; } });
  useEffect(() => { const f = (ev) => setOn(!!(ev && ev.detail)); window.addEventListener('vrm:stream', f); return () => window.removeEventListener('vrm:stream', f); }, []);
  return on;
}
const appSombre = () => { try { return document.documentElement.getAttribute('data-theme') === 'dark'; } catch (_) { return false; } };
// Le message d'origine : sa MISE EN PAGE (HTML assaini, cadre isolé) quand elle est
// gardée, sinon le texte remis en forme — et une ligne qui dit pourquoi, s'il y en a une.
function MessageOrigine({ e, stream }) {
  const o = e.origine;
  const texte = typeof e.texte === 'string' && e.texte.trim()
    ? <Corps texte={e.texte} coupe={!!e.texteCoupe}/>
    : <p className="vrm-boite-doux" data-boite-corps="absent">Le texte de cet e-mail n’est pas gardé dans VRM (rangé avant le 31 oct.). Il est dans ta messagerie.</p>;
  if (stream) return <><p className="vrm-boite-doux" data-boite-origine="stream">Mise en page d’origine masquée en mode stream (elle contient noms et adresses).</p>{texte}</>;
  if (o && o.etat === 'garde' && typeof o.html === 'string') return <div data-boite-origine="html"><CadreEmail html={o.html} images={Number(o.images) || 0} sombreEmail={!!o.sombre} appSombre={appSombre()} titre={`Message d’origine : ${e.subject || 'e-mail sans objet'}`}/></div>;
  const [cle, note] = o === null ? ['pas-su', 'Mise en page d’origine pas lue cette fois : voici le texte.']
    : o && o.etat === 'trop' ? ['trop', `Mise en page trop lourde${o.octets ? ` (${poidsLisible(o.octets)})` : ''} : VRM n’en garde que le texte.`]
    : o && o.raison === 'trop-vieux' ? ['trop-vieux', 'La mise en page d’origine n’est gardée que 30 jours : voici le texte.']
    : ['texte', ''];
  return <>{note ? <p className="vrm-boite-doux" data-boite-origine={cle}>{note}</p> : <span hidden data-boite-origine={cle}/>}{texte}</>;
}

// ── LIRE UN E-MAIL ───────────────────────────────────────────────────────────
function Lecture({ id, entetes, delies, onFermer, onAller, onNum, plein, FermeAuRetour, lu, onLu, photoDe, onRelier }) {
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
  useEffect(() => { if (m && m.email && titre.current) { try { titre.current.focus({ preventScroll: true }); } catch (_) {} } }, [m]);
  const e = m && m.email;
  const lecture = e ? ceQueVrmAFait(e, delies) : null;
  const t = e ? titreSimple(e, delies) : null;
  const h = e ? carteHeros(e, delies) : null;
  const gestes = e ? gestesEmail(e, delies) : [];
  const photo = e && photoDe ? photoDe(e) : null;
  const aVerifier = lecture && (lecture.etat === 'verifier' || lecture.etat === 'incompris');
  // Un nombre, une fois : ce que la carte dit déjà sort de la ligne de détails.
  const dejaDit = (x) => (h && ((h.code && /^code /.test(x)) || (h.lieu && h.lieu.nom && x === (h && e.resume && e.resume.lieu)) || (h.limite && /avant le /.test(x)) || (h.montant && x.endsWith('€') && x.includes(h.montant.replace(/\s*€$/, ''))) || (h.article && (x === h.article || x === `sur ${h.article}`)) || (h.num && x === `N°${h.num}`)));
  const details = t ? [...t.details.filter((x) => !dejaDit(x) && !/^code pas encore lu$/.test(x)), ...(t.rien ? ['rien à faire'] : [])] : [];
  const pdfConnu = e && e.resume && e.resume.pdf === 1;
  const aller = (g) => (g.k === 'num' ? onNum && onNum(g.num) : onAller && onAller(g.url));
  const contenu = (
    <article className="vrm-boite-lecture" data-boite-lecture={id} data-plein={plein ? '1' : '0'} aria-label="E-mail ouvert" aria-busy={m === undefined ? 'true' : undefined}>
      <div className="vrm-boite-lecture-barre" data-boite-barre="">
        <button type="button" className="vrm-boite-retour" data-boite-fermer="" onClick={onFermer}>{plein ? <><span className="vrm-boite-chevron" aria-hidden="true">‹</span>Boîte de réception</> : 'Fermer'}</button>
        {e && lu !== null && <button type="button" className="vrm-boite-retour vrm-boite-basculer-lu" data-boite-basculer-lu={lu ? 'nonlu' : 'lu'} onClick={() => onLu(e, !lu)}>{lu ? 'Marquer non lu' : 'Marquer lu'}</button>}
      </div>
      {m === undefined && <div className="vrm-boite-lecture-attente" role="status"><span className="vrm-boite-sr">Ouverture de l’e-mail…</span><i/><i/><i/></div>}
      {m === null && <EtatPanne className="vrm-boite-panne" role="alert" data-boite-lecture-etat="pas-su" quoi="Cet e-mail" raison="La lecture n’a pas abouti. Rien n’est perdu : il reste rangé." onReessayer={() => setEssai((n) => n + 1)}/>}
      {m && !e && <div className="vrm-boite-etat-bloc" data-boite-lecture-etat="absent"><p className="vrm-boite-etat-titre">Cet e-mail n’est plus dans ta boîte VRM.</p></div>}
      {e && <>
        <header className="vrm-boite-haut" data-boite-haut="" data-etat={lecture.etat}>
          <div className="vrm-boite-haut-tete">
            <Avatar from={e.from} grande/>
            <div className="vrm-boite-haut-txt">
              <h2 tabIndex={-1} ref={titre} className="vrm-boite-titre" data-boite-titre={t.titre}>{t.titre}</h2>
              <p className="vrm-boite-haut-de">{expediteurLisible(e.from)}{e.compte ? <> · <span className="vrm-sensible" data-stream-type="compte">{e.compte.nom}</span></> : e.compteAmbigu ? ' · plusieurs comptes' : ''} · <time dateTime={dateEmail(e) || ''}>{heure(dateEmail(e))}</time></p>
            </div>
          </div>
          {!e.compte&&(e.compteAmbigu||siteExpediteur(e.from)==='vinted')&&<CompteEmailAVerifier ambigu={e.compteAmbigu} onVerifier={onRelier}/> }
          <Heros e={e} h={h} photo={photo}/>
          {details.length > 0 && <p className="vrm-boite-details">{details.join(' · ')}</p>}
          {aVerifier && <div className="vrm-boite-averif" data-boite-averif="">
            {lecture.raison && <p><b>À vérifier :</b> {lecture.raison}</p>}
            {lecture.geste && <p><b>Que faire :</b> {lecture.geste}</p>}
          </div>}
          {gestes.length > 0 && <div className="vrm-boite-gestes" data-boite-gestes={gestes.length}>
            {gestes.map((g) => <button key={g.k} type="button" className={g.principal ? 'vrm-boite-objet vrm-boite-principal' : 'vrm-boite-second'} data-boite-objet={g.principal ? g.k : undefined} data-boite-geste-id={g.k} data-boite-ident={g.ident || ''} onClick={() => aller(g)}>{g.mot}</button>)}
          </div>}
          <p className="vrm-boite-fait" data-boite-fait="" data-boite-objet={gestes.some((g) => g.ident) ? undefined : 'aucun'}>Dans VRM : {lecture.fait}{gestes.some((g) => g.ident) ? '' : ' — relié à aucun colis, vente ou achat précis (aucun numéro lu dans l’e-mail).'}</p>
        </header>
        <section className="vrm-boite-corps-bloc" aria-label="Message d’origine">
          <p className="vrm-boite-sous">Message d’origine</p>
          <div className="vrm-boite-message">
            <h3 className="vrm-boite-sujet" data-boite-sujet="">{e.subject || 'E-mail sans objet'}</h3>
            <MessageOrigine e={e} stream={stream}/>
          </div>
        </section>
        <section className="vrm-boite-pieces" data-boite-pieces={e.pieces == null ? 'pas-su' : e.pieces.length}>
          {e.pieces == null
            ? <><p className="vrm-boite-sous">Pièces jointes</p><p className="vrm-boite-doux">Liste non gardée : cet e-mail a été rangé avant le 5 nov.{pdfConnu ? ' Le PDF joint est gardé avec ' + (e.resume.t === 'achat' ? 'le reçu d’achat.' : 'le bordereau.') : ''}</p></>
            : e.pieces.length === 0 ? <p className="vrm-boite-doux">Aucune pièce jointe.</p>
            : <><p className="vrm-boite-sous">Pièces jointes</p><ul>{e.pieces.map((p, i) => <li key={i} data-boite-piece={p.n}><span className="vrm-boite-piece-ic" aria-hidden="true">{p.t === 'application/pdf' ? 'PDF' : Ic.trombone}</span><span className="vrm-boite-piece-nom">{p.n}</span><small>{[p.t === 'application/pdf' ? 'PDF' : p.t, poidsLisible(p.o)].filter(Boolean).join(' · ')}</small></li>)}</ul>
              <p className="vrm-boite-doux">{gestes.some((g) => g.k === 'colis') ? 'Le bordereau s’imprime depuis sa carte, dans Colis.' : 'Pour imprimer un bordereau ou un reçu : Colis ou Achats.'}</p></>}
        </section>
        <p className="vrm-boite-meta" data-boite-meta="">
          <span data-boite-de="">De <b>{expediteurLisible(e.from)}</b>{adresseLisible(e.from) ? ` (${adresseLisible(e.from)})` : ''}</span>
          <span aria-hidden="true"> · </span>
          <span data-boite-recu="">Reçu sur {e.adresses && e.adresses.length ? e.adresses.join(', ') : 'une adresse non lue'}{e.compte ? ` (${e.compte.nom})` : e.compteAmbigu ? ' (plusieurs comptes)' : ''}</span>
          <span aria-hidden="true"> · </span>
          <span data-boite-date=""><time dateTime={dateEmail(e) || ''}>{e.sourceDate ? 'le ' : 'transmis à VRM le '}{quandLong(dateEmail(e))}</time></span>
        </p>
      </>}
    </article>
  );
  if (!plein) return contenu;
  return createPortal(<div className="vrm-boite-feuille" data-boite-feuille="" role="dialog" aria-modal="true" aria-label="E-mail ouvert">{FermeAuRetour ? <FermeAuRetour fermer={onFermer}/> : null}{contenu}</div>, document.body);
}

// ── UNE LIGNE ────────────────────────────────────────────────────────────────
// Trois étages à droite de l'avatar : la NATURE (gras si non lu) et l'heure ;
// l'ESSENTIEL (lieu court, montant, N°, article) ; le GESTE puis « qui ». À
// droite, le code de retrait en grand (copiable) ou la photo de la paire.
// Au doigt, glisser vers la droite bascule lu / non lu (rien n'est caché).
const SEUIL_GLISSE = 76;
const Ligne = memo(function Ligne({ e, delies, ouvert, lu, photo, onOuvrir, onLu, maintenant }) {
  const r = rubriqueEmail(e);
  const t = titreSimple(e, delies);
  const l = ligneEmail(e, delies, maintenant);
  const g = l.geste;
  const h = heure(dateEmail(e));
  const site = siteExpediteur(e.from);
  const res = e.resume && typeof e.resume === 'object' ? e.resume : null;
  // Le code : seulement LU (le résumé), seulement sur un colis à retirer.
  const code = codeSurLigne(e);
  // L'essentiel, sans le code (il est à droite, en grand) ; le lieu en court.
  const lieu = res && res.lieu ? lieuLisible(res.lieu) : null;
  const essentiel = l.essentiel.filter((x) => !(code && /^code /.test(x))).map((x) => (lieu && x === res.lieu ? lieu.nom : x));
  const pasLu = lu === false;
  // Le glisser (au doigt seulement ; le défilement vertical reste natif).
  const ref = useRef(null), fond = useRef(null), geste = useRef(null), glisse = useRef(false);
  // Le fond « Lu / Non lu » n'existe que pendant le glisser (950 lignes : autant de nœuds en moins).
  const [fondVu, setFondVu] = useState(false);
  const relacher = (ev) => {
    const gs = geste.current; geste.current = null;
    if (!gs || !gs.parti) { if (ev && ev.currentTarget) delete ev.currentTarget.dataset.appui; return; }
    const v = gs.dx / Math.max(1, performance.now() - gs.t0);
    const bascule = gs.dx > SEUIL_GLISSE || (gs.dx > 24 && v > 0.6);
    // La ligne revient en place (avec son code), d'un mouvement de tiroir.
    const el = ref.current;
    for (const n of [el, el && el.parentElement && el.parentElement.querySelector('.vrm-boite-puce-code')]) if (n) { n.style.transition = reduitMvt() ? 'none' : 'transform .34s cubic-bezier(.32,.72,0,1)'; n.style.transform = ''; }
    if (fond.current) fond.current.dataset.actif = '0';
    if (bascule && lu !== null) onLu(e, pasLu);
    setTimeout(() => { glisse.current = false; }, 0);
    setTimeout(() => setFondVu(false), reduitMvt() ? 0 : 360);
  };
  return <li className="vrm-boite-item" data-pas-lu={pasLu ? '1' : undefined}>
    {fondVu && lu !== null && <span ref={fond} className="vrm-boite-glisse-fond" aria-hidden="true" data-actif="0">{Ic.lu}<span>{pasLu ? 'Lu' : 'Non lu'}</span></span>}
    <button ref={ref} type="button" className="vrm-boite-ligne" data-boite-email={e.id} data-rubrique={r} data-etat={e.etat} data-lu={lu === null ? undefined : lu ? '1' : '0'}
      data-boite-geste={g ? g.k : undefined} data-boite-proche={g && g.proche ? '1' : undefined} data-boite-rien={l.rien ? '1' : undefined} data-boite-a-code={code ? '1' : undefined} data-boite-a-photo={photo ? '1' : undefined}
      aria-current={ouvert ? 'true' : undefined}
      aria-label={`${pasLu ? 'Non lu. ' : ''}${titreEnClair(t)}. ${expediteurLisible(e.from)}${e.compte ? ', ' + e.compte.nom : ''}${h ? ', ' + h : ''}`}
      onClick={() => { if (glisse.current) return; onOuvrir(e); }}
      onPointerDown={(ev) => { ev.currentTarget.dataset.appui = '1'; if (ev.pointerType === 'touch' && lu !== null) geste.current = { x: ev.clientX, y: ev.clientY, t0: performance.now(), dx: 0, parti: false }; }}
      onPointerMove={(ev) => {
        const gs = geste.current; if (!gs) return;
        const dx = ev.clientX - gs.x, dy = ev.clientY - gs.y;
        if (!gs.parti) { if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { geste.current = null; delete ev.currentTarget.dataset.appui; return; } if (dx < 10) return; gs.parti = true; glisse.current = true; setFondVu(true); delete ev.currentTarget.dataset.appui; try { ev.currentTarget.setPointerCapture(ev.pointerId); } catch (_) {} }
        // Au-delà du seuil, la ligne résiste (jamais un arrêt sec).
        const d = Math.max(0, dx); const x = d <= 96 ? d : 96 + ((d - 96) * 0.35);
        gs.dx = d;
        for (const n of [ev.currentTarget, ev.currentTarget.parentElement.querySelector('.vrm-boite-puce-code')]) if (n) { n.style.transition = 'none'; n.style.transform = `translateX(${x}px)`; }
        if (fond.current) fond.current.dataset.actif = d > SEUIL_GLISSE ? '1' : '0';
      }}
      onPointerUp={relacher} onPointerCancel={relacher} onPointerLeave={(ev) => { if (!geste.current) delete ev.currentTarget.dataset.appui; }}>
      <span className="vrm-boite-point" aria-hidden="true" data-boite-point={pasLu ? '1' : '0'}/>
      <Avatar from={e.from}/>
      <span className="vrm-boite-ligne-txt">
        <span className="vrm-boite-ligne-haut">
          <span className="vrm-boite-quoi" data-boite-quoi={l.titre}>{l.titre}</span>
          <time dateTime={dateEmail(e) || ''}>{h}</time>
        </span>
        {essentiel.length > 0 && <span className="vrm-boite-essentiel" data-boite-essentiel="">
          {essentiel.map((x, i) => <span key={i} className={/^(?:de|par) /.test(x) ? 'vrm-sensible' : undefined} data-stream-type={/^(?:de|par) /.test(x) ? 'acheteur' : undefined}>{i ? ' · ' : ''}{x}</span>)}
        </span>}
        <span className="vrm-boite-ligne-pied">
          {g && <span className="vrm-boite-geste" data-boite-geste-mot={g.k} data-ambre={gesteAmbre(g) ? '1' : '0'} data-passe={g.passe ? '1' : undefined} data-boite-averifier={g.k === 'verifier' ? '' : undefined}>{g.mot}</span>}
          {(l.rien || !site || e.compte || e.pj > 0) && <span className="vrm-boite-qui">
            {l.rien && <span className="vrm-boite-rien">rien à faire</span>}
            {!site && <span className="vrm-boite-exp" data-boite-exp="autre"><span className="vrm-boite-exp-nom">{expediteurLisible(e.from)}</span></span>}
            {e.compte && <span className="vrm-boite-compte-nom vrm-sensible" data-stream-type="compte">{e.compte.nom}</span>}
            {e.pj > 0 && <span className="vrm-boite-pj" data-boite-pj={e.pj}>{Ic.trombone}{e.pj}</span>}
          </span>}
        </span>
      </span>
      {!code && photo ? <PhotoPaire className="vrm-boite-vignette" src={photo} data={{ 'data-boite-vignette': '' }}/> : null}
    </button>
    {code ? <PuceCode code={code}/> : null}
  </li>;
});

// Une PILE : une rafale d'e-mails identiques, en une ligne qui se déplie.
function Pile({ p, rendre, deplie, onDeplier, lus, delies, maintenant }) {
  const e = p.emails[0];
  const l = ligneEmail(e, delies, maintenant);
  const nonLus = p.emails.filter((x) => lus(x) === false).length;
  const h0 = heure(dateEmail(p.emails[p.emails.length - 1])), h1 = heure(dateEmail(e));
  return <li className="vrm-boite-item vrm-boite-pile" data-boite-pile={p.emails.length} data-deplie={deplie ? '1' : '0'} data-pas-lu={nonLus ? '1' : undefined}>
    <button type="button" className="vrm-boite-ligne vrm-boite-pile-tete" data-boite-pile-tete="" data-boite-rien={l.rien ? '1' : undefined} aria-expanded={deplie} onClick={onDeplier}
      aria-label={`${l.titre} — ${p.emails.length} e-mails${nonLus ? `, dont ${nonLus} non lus` : ''}. ${deplie ? 'Replier' : 'Déplier'}`}>
      <span className="vrm-boite-point" aria-hidden="true" data-boite-point={nonLus ? '1' : '0'}/>
      <span className="vrm-boite-pile-avatar" aria-hidden="true"><Avatar from={e.from}/><span className="vrm-boite-pile-n">{p.emails.length}</span></span>
      <span className="vrm-boite-ligne-txt">
        <span className="vrm-boite-ligne-haut">
          <span className="vrm-boite-quoi" data-boite-quoi={l.titre}>{l.titre}</span>
          <time title={h0 && h0 !== h1 ? `de ${h0} à ${h1}` : undefined}>{h1}</time>
        </span>
        <span className="vrm-boite-ligne-pied">
          <span className="vrm-boite-pile-mot">{p.emails.length} e-mails{l.essentiel.length ? ` · ${l.essentiel.join(' · ')}` : ''}</span>
          {l.geste ? <span className="vrm-boite-geste" data-ambre={gesteAmbre(l.geste) ? '1' : '0'}>{l.geste.mot}</span> : null}
          <span className="vrm-boite-pile-chevron" aria-hidden="true">{Ic.chevron}</span>
        </span>
      </span>
    </button>
    {deplie && <ul className="vrm-boite-pile-liste">{p.emails.map(rendre)}</ul>}
  </li>;
}

// En attendant la liste : des lignes fantômes (après 150 ms ; figées en mouvement réduit).
function Squelette() {
  return <div className="vrm-boite-squelette" data-boite-chargement="" role="status" aria-busy="true">
    <span className="vrm-boite-sr">Lecture de ta boîte…</span>
    {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="vrm-boite-sq-ligne" aria-hidden="true"><i className="vrm-boite-sq-rond"/><span><i style={{ width: `${46 + (i * 17) % 30}%` }}/><i style={{ width: `${70 - (i * 11) % 25}%` }}/></span></div>)}
  </div>;
}

// Un état de la boîte : un dessin, un titre, une phrase, LE geste.
function Etat({ k, dessin = 'vide', titre, texte, gestes, role }) {
  return <div className="vrm-boite-etat-bloc" data-boite-etat={k} data-boite={k === 'panne' ? 'pas-su' : ['vide', 'rubrique-vide', 'compte-vide', 'nonlus-vide'].includes(k) ? 'vide' : undefined} role={role}>
    <span className="vrm-boite-etat-ic"><Dessin k={dessin}/></span>
    <p className="vrm-boite-etat-titre">{titre}</p>
    {texte && <p className="vrm-boite-etat-texte">{texte}</p>}
    {gestes && gestes.length > 0 && <div className="vrm-boite-etat-gestes">{gestes.map((x, i) => <button key={x.mot} type="button" className={i === 0 ? 'vrm-boite-principal' : 'vrm-boite-second'} data-boite-etat-geste={x.k} onClick={x.f}>{x.mot}</button>)}</div>}
  </div>;
}

// Le fondu au bord d'une rangée qui défile : il dit qu'il y a d'autres pastilles.
function useBords(ref, dep) {
  useEffect(() => {
    const n = ref.current; if (!n) return undefined;
    const maj = () => { n.dataset.bordGauche = n.scrollLeft > 2 ? '1' : '0'; n.dataset.bordDroite = n.scrollLeft + n.clientWidth < n.scrollWidth - 2 ? '1' : '0'; };
    maj();
    n.addEventListener('scroll', maj, { passive: true });
    let ro; try { ro = new ResizeObserver(maj); ro.observe(n); } catch (_) { window.addEventListener('resize', maj); }
    return () => { n.removeEventListener('scroll', maj); if (ro) ro.disconnect(); else window.removeEventListener('resize', maj); };
  }, [ref, dep]);
}

// ── LES COMPTES DONT LES E-MAILS N'ARRIVENT PAS (6 nov., onglets C) ─────────
function ARelier({ comptes, onRelier }) {
  if (!Array.isArray(comptes) || !comptes.length) return null;
  const n = comptes.length;
  return <div className="vrm-boite-arelier" data-boite-a-relier={n} role="note">
    <p className="vrm-boite-arelier-titre"><b>{n > 1 ? `${n} comptes n’envoient aucun e-mail à VRM` : 'Un compte n’envoie aucun e-mail à VRM'}</b> — {n > 1 ? 'leurs' : 'ses'} codes de retrait, bordereaux et messages n’arrivent pas.</p>
    <ul>
      {comptes.map((c) => <li key={c.uid} data-boite-a-relier-compte={c.uid}>
        <span className="vrm-boite-arelier-qui"><b>{c.login}</b> · {phraseARelier(c)}</span>
        <button type="button" className="vrm-boite-principal" data-boite-relier-compte={c.uid} onClick={() => onRelier(c.uid)}>Relier la boîte de {c.login}</button>
      </li>)}
    </ul>
  </div>;
}

// Les pastilles : Tout · Non lus · Codes · Colis · Ventes · Achats · Offres · À vérifier
// (« Autres » reste accepté par la route, il n'a plus de pastille : « Tout » le montre).
const PASTILLES = ['codes', 'colis', 'ventes', 'achats', 'offres'];
const COURT = { codes: 'Codes' };

// ── LA BOÎTE ─────────────────────────────────────────────────────────────────
function Boite({ headers, delies, onAller, onNum, FermeAuRetour, onRelier, tete = null, ecrireLus, photoDe }) {
  const aideRechercheId=React.useId();
  const [rubrique, setRubrique] = useState('');
  const [adresse, setAdresse] = useState('');
  const [aVerif, setAVerif] = useState(false);
  const [nonLus, setNonLus] = useState(false);
  const [saisie, setSaisie] = useState('');
  const [cherche, setCherche] = useState('');
  useEffect(() => { const t = setTimeout(() => setCherche(saisie.trim().length >= 2 ? saisie.trim() : ''), 350); return () => clearTimeout(t); }, [saisie]);
  const [pages, setPages] = useState(undefined);
  const [lecture, setLecture] = useState(false);
  const [ouvert, setOuvert] = useState('');
  const [panne, setPanne] = useState('');
  // (6 nov., v36) Un e-mail choisi dans la loupe (src/rechercheEcran.js) : il s'ouvre ici,
  // par l'id de SA ligne — la lecture le relit côté serveur, filtrée par son propriétaire.
  useEffect(() => { const f = () => { const id = prendreDemande('email'); if (id) setOuvert(id); }; f(); window.addEventListener('vrm:recherche-ouvrir', f); return () => window.removeEventListener('vrm:recherche-ouvrir', f); }, []);
  const [luA, setLuA] = useState(0);
  const [vieille, setVieille] = useState(false);
  const [deplies, setDeplies] = useState(() => new Set());
  // Lu / non lu : ce que la route dit, corrigé tout de suite par SES gestes.
  const [lusLocaux, setLusLocaux] = useState(() => new Map());
  const [avis, setAvis] = useState('');
  const [large, setLarge] = useState(() => { try { return window.matchMedia('(min-width: 900px)').matches; } catch (_) { return false; } });
  useEffect(() => { let mq; try { mq = window.matchMedia('(min-width: 900px)'); } catch (_) { return undefined; } const f = () => setLarge(mq.matches); mq.addEventListener ? mq.addEventListener('change', f) : mq.addListener(f); return () => { mq.removeEventListener ? mq.removeEventListener('change', f) : mq.removeListener(f); }; }, []);
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
  const [adresses, setAdresses] = useState(null);
  useEffect(() => { if (pages && Array.isArray(pages.adresses)) setAdresses(pages.adresses); }, [pages]);
  const c = pages && pages.compteurs;
  const parR = c && c.parRubrique && typeof c.parRubrique === 'object' ? c.parRubrique : null;
  const lusSus = !!(pages && pages.lus === 'lu');
  const luDe = useCallback((e) => (lusLocaux.has(e.id) ? lusLocaux.get(e.id) : (typeof e.lu === 'boolean' ? e.lu : null)), [lusLocaux]);
  // Le nombre de non-lus : celui de la route, corrigé de SES gestes sur les lignes chargées.
  const nNonLus = useMemo(() => {
    if (!c || !Number.isFinite(c.nonLus)) return null;
    let n = c.nonLus;
    for (const e of (pages && pages.emails) || []) if (lusLocaux.has(e.id) && typeof e.lu === 'boolean' && lusLocaux.get(e.id) !== e.lu) n += lusLocaux.get(e.id) ? -1 : 1;
    return Math.max(0, n);
  }, [c, pages, lusLocaux]);
  // L'app repasse une fonction neuve à chaque rendu : on la lit au moment du geste.
  const ecrire = useRef(ecrireLus); ecrire.current = ecrireLus;
  const poserLu = useCallback((liste, valeur, gestes) => {
    setLusLocaux((m) => { const n = new Map(m); for (const e of liste) n.set(e.id, valeur); return n; });
    if (!ecrire.current) return;
    Promise.resolve(ecrire.current(gestes)).then((ok) => { if (!ok) setAvis('Pas enregistré sur tes autres appareils — réessaie dans un moment.'); }).catch(() => setAvis('Pas enregistré sur tes autres appareils — réessaie dans un moment.'));
  }, []);
  const onLu = useCallback((e, valeur) => poserLu([e], valeur, [{ k: valeur ? 'lu' : 'nonlu', id: e.id, at: e.at }]), [poserLu]);
  const ouvrir = useCallback((e) => { setOuvert(e.id); if (luDe(e) === false) onLu(e, true); }, [luDe, onLu]);
  const filtreActif = !!(rubrique || adresse || aVerif || cherche || nonLus);
  const toutMarquerLu = () => {
    const charges = ((pages && pages.emails) || []).filter((e) => luDe(e) === false);
    if (!filtreActif && pages && pages.dernierAt) poserLu(charges, true, [{ k: 'tout', jusqua: pages.dernierAt }]);
    else if (charges.length) poserLu(charges, true, charges.map((e) => ({ k: 'lu', id: e.id, at: e.at })));
    setAvis(filtreActif ? `${charges.length} e-mail${charges.length > 1 ? 's' : ''} marqué${charges.length > 1 ? 's' : ''} lu${charges.length > 1 ? 's' : ''}` : 'Tout est marqué lu');
  };
  // L'instant de la liste (les « demain » et « aujourd'hui ») : un par lecture, pour que les lignes restent mémoïsées.
  const maintenant = useMemo(() => Date.now(), [pages]);
  const groupes = useMemo(() => (pages && Array.isArray(pages.emails) ? groupesParJour(pages.emails).map((g) => ({ ...g, items: empiler(g.emails, delies, maintenant) })) : []), [pages, delies, maintenant]);
  const nomCompte = (adr) => { const a = Array.isArray(adresses) ? adresses.find((x) => x.adresse === adr) : null; return (a && a.nom) || adr; };
  const nomsDoubles = useMemo(() => { const n = {}; (adresses || []).forEach((a) => { if (a.nom) n[a.nom] = (n[a.nom] || 0) + 1; }); return n; }, [adresses]);
  const libelleCompte = (a) => (a.nom ? (nomsDoubles[a.nom] > 1 ? `${a.nom} · ${a.adresse}` : a.nom) : a.adresse);
  const choixCompte = Array.isArray(adresses) && (adresses.length > 1 || (adresse && adresses.length > 0));
  const filtre = !!(cherche || aVerif || nonLus);
  // (6 nov., v36) Les rubriques ne portent leur nombre que s'il est COMPLET (la route
  // compte les 200 derniers) : une boîte plus grande n'affiche pas de total partiel,
  // et plus de phrase de couverture sous les pastilles (§5). « Non lus » et « À
  // vérifier » gardent le leur, suivi de « + » s'il peut y en avoir d'autres.
  const complet = !!(c && parR && !c.plus);
  const phrase = cherche ? `Recherche « ${cherche} » dans le sujet, l’expéditeur, l’article, le code et le n° de suivi${adresse ? ` de ${nomCompte(adresse)}` : ''}.`
    : complet && !filtre && c.adresse ? `Les nombres sont ceux de ${nomCompte(c.adresse)}.` : '';
  const rangee = useRef(null);
  useBords(rangee, parR ? 1 : 0);
  const choisir = (id, bouton) => {
    setRubrique(id); setOuvert('');
    try { bouton && bouton.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: reduitMvt() ? 'auto' : 'smooth' }); } catch (_) {}
  };
  const motRubrique = (RUBRIQUES_BOITE.find((x) => x.id === rubrique) || {}).mot || '';
  const vide = pages && pages.emails.length === 0;
  // La suite se charge au défilement (une sentinelle en bas de la liste).
  const sentinelle = useRef(null);
  const suiteRef = useRef(null); suiteRef.current = () => { if (pages && pages.suite && !pages.suiteKO && !lecture) charger((pages.page || 0) + 1); };
  // Réarmée à chaque page lue et à chaque fin de lecture : un observateur neuf dit tout de
  // suite si la sentinelle est déjà proche (sinon, restée visible pendant une lecture, elle
  // ne « réapparaissait » jamais et la suite ne venait plus — mesuré au banc).
  useEffect(() => {
    const n = sentinelle.current; if (!n || typeof IntersectionObserver === 'undefined' || lecture) return undefined;
    // La racine : le conteneur qui défile VRAIMENT (la coque fait défiler son <main>) — sa
    // marge d'avance ne vaut que pour lui (avec la page pour racine, la sentinelle restait
    // rognée par le <main> et la suite ne venait jamais à 1512 px — mesuré au banc).
    let racine = null;
    for (let p = n.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowY; if (o === 'auto' || o === 'scroll') { racine = p; break; } }
    const io = new IntersectionObserver((l) => { if (l.some((x) => x.isIntersecting)) suiteRef.current(); }, { root: racine, rootMargin: '900px 0px' });
    io.observe(n);
    return () => io.disconnect();
  }, [pages, lecture]);
  const photoLigne = useCallback((e) => (photoDe ? photoDe(e) : null), [photoDe]);
  const rendreEmail = (e) => <Ligne key={e.id} e={e} delies={delies} ouvert={ouvert === e.id} lu={luDe(e)} photo={photoLigne(e)} onOuvrir={ouvrir} onLu={onLu} maintenant={maintenant}/>;
  const nPastille = (id) => (filtre || !complet ? null : Number.isFinite(parR[id]) ? parR[id] : null);
  return (
    <div className="vrm-boite-corps-ecran" data-boite-large={large ? '1' : '0'} data-boite-ouvert={ouvert ? '1' : '0'}>
      <div className="vrm-boite-liste-col">
        {tete}
        <div className="vrm-boite-filtres">
          <label className="vrm-boite-cherche" data-boite-cherche={cherche ? '1' : '0'}>
            <span className="vrm-boite-sr">Chercher un e-mail</span>
            <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.6"/><path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
            <input type="search" value={saisie} onChange={(ev) => { setSaisie(ev.target.value); setOuvert(''); }} placeholder="Article, code, n° de suivi…" aria-label="Chercher un e-mail" data-boite-cherche-champ="" aria-describedby={saisie.trim().length===1?aideRechercheId:undefined} enterKeyHint="search" autoComplete="off"/>
          </label>
          {saisie.trim().length===1&&<p id={aideRechercheId} className="vrm-boite-aide-recherche" data-boite-aide-recherche="">Saisis au moins 2 caractères pour rechercher.</p>}
          <div ref={rangee} className="vrm-boite-rubriques vrm-rangee" role="group" aria-label="Trier les e-mails">
            <button type="button" aria-pressed={!rubrique && !nonLus && !aVerif} data-boite-rubrique="tout" onClick={(ev) => { setNonLus(false); setAVerif(false); choisir('', ev.currentTarget); }}>
              <span>Tout</span>{!filtre && c && parR && !c.plus ? <span className="vrm-boite-n" data-boite-n={c.sur}>{c.sur}</span> : null}
            </button>
            {(lusSus || nonLus) && <button type="button" aria-pressed={nonLus} data-boite-rubrique="nonlus" className="vrm-boite-nonlus-pastille" onClick={() => { setNonLus((v) => !v); setOuvert(''); }}>
              <span className="vrm-boite-nonlus-point" aria-hidden="true"/><span>Non lus</span>{nNonLus > 0 && !cherche && !aVerif ? <span className="vrm-boite-n" data-boite-n={nNonLus}>{nNonLus}{c && c.plus ? '+' : ''}</span> : null}
            </button>}
            {PASTILLES.map((id) => {
              const n = nPastille(id);
              const mot = (RUBRIQUES_BOITE.find((x) => x.id === id) || {}).mot || id;
              return <button key={id} type="button" aria-pressed={rubrique === id} data-boite-rubrique={id} aria-label={COURT[id] ? `${mot}${n != null ? ` ${n}` : ''}` : undefined} onClick={(ev) => choisir(rubrique === id ? '' : id, ev.currentTarget)}>
                <span>{COURT[id] || mot}</span>{n != null ? <span className="vrm-boite-n" data-boite-n={n}>{n}</span> : null}
              </button>;
            })}
            {(aVerif || (c && c.aVerifier > 0)) && <button type="button" aria-pressed={aVerif} data-boite-rubrique="a-verifier" className="vrm-boite-averif-pastille" onClick={() => { setAVerif((v) => !v); setOuvert(''); }}>
              <span>À vérifier</span>{!filtre && c && c.aVerifier > 0 ? <span className="vrm-boite-n" data-boite-n={c.aVerifier}>{c.aVerifier}{c.plus ? '+' : ''}</span> : null}
            </button>}
          </div>
          {(choixCompte || (vieille && pages !== null) || (lusSus && nNonLus > 0)) && <div className="vrm-boite-ligne-outils">
            {choixCompte && <label className="vrm-boite-compte">
              <span className="vrm-boite-sr">Compte</span>
              <select value={adresse} onChange={(ev) => { setAdresse(ev.target.value); setOuvert(''); }} data-boite-adresse="" aria-label="Compte">
                <option value="">Tous les comptes</option>
                {adresses.map((a) => <option key={a.adresse} value={a.adresse}>{libelleCompte(a)}</option>)}
              </select>
              <svg className="vrm-boite-compte-chevron" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="m3 4.5 3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </label>}
            {lusSus && nNonLus > 0 && <button type="button" className="vrm-boite-lien" data-boite-tout-lu="" onClick={toutMarquerLu}>{filtreActif ? 'Marquer ceux-ci lus' : 'Tout marquer lu'}</button>}
            {vieille && pages !== null && <button type="button" className="vrm-boite-actualiser" data-boite-actualiser="" onClick={() => charger(0)} disabled={lecture} title={luA ? `Lue à ${heure(new Date(luA).toISOString())}` : undefined}>
              <span className={lecture ? 'vrm-boite-tourne' : undefined}>{Ic.actualiser}</span>{lecture ? 'Lecture…' : 'Actualiser'}
            </button>}
          </div>}
          {[rubrique,adresse,aVerif,nonLus,cherche].filter(Boolean).length>1&&<div className="vrm-boite-vue-filtree" data-boite-vue-filtree="" role="group" aria-label="Filtres actifs">
            <span>{[rubrique&&motRubrique,adresse&&'Un compte',aVerif&&'À vérifier',nonLus&&'Non lus',cherche&&'Recherche'].filter(Boolean).join(' · ')}</span>
            <button type="button" className="vrm-b vrm-b-secondaire" onClick={()=>{setRubrique('');setAdresse('');setAVerif(false);setNonLus(false);setSaisie('');setCherche('');setOuvert('');}}>Réinitialiser les filtres</button>
          </div>}
          {phrase && <p className="vrm-boite-couverture" data-boite-sur={c ? c.sur : undefined} data-boite-sur-adresse={(c && c.adresse) || ''}>{phrase}</p>}
        </div>
        {pages === undefined && <Squelette/>}
        {pages === null && <EtatPanne className="vrm-boite-panne" role="alert" data-boite-etat="panne" data-boite="pas-su" quoi="Ta boîte VRM" raison={`${panne || 'VRM n’a pas pu lire ta boîte.'} Rien n’est perdu : tes e-mails restent rangés.`} onReessayer={() => charger(0)}/>}
        {vide && cherche && <Etat k="recherche-vide" dessin="recherche" titre={`Aucun e-mail pour « ${cherche} »`} texte="Essaie un autre mot : le nom de l’article, un code de retrait, un n° de suivi ou l’expéditeur." gestes={[{ k: 'effacer', mot: 'Effacer la recherche', f: () => { setSaisie(''); setCherche(''); } }]}/>}
        {vide && !cherche && nonLus && <Etat k="nonlus-vide" dessin="lu" titre="Tout est lu" texte="Les nouveaux e-mails arriveront ici, avec un point bleu." gestes={[{ k: 'tout', mot: 'Voir tout', f: () => setNonLus(false) }]}/>}
        {vide && !cherche && !nonLus && aVerif && <Etat k="rien-a-verifier" dessin="lu" titre="Rien à vérifier" texte="Tous les e-mails de cette vue sont rangés." gestes={[{ k: 'tout', mot: 'Voir tout', f: () => setAVerif(false) }]}/>}
        {vide && !filtre && adresse && <Etat k="compte-vide" dessin="relier" titre={`Aucun e-mail reçu sur ${nomCompte(adresse)}${rubrique ? ` dans « ${motRubrique} »` : ''}`} texte={rubrique ? 'Les autres rubriques en ont peut-être.' : `Rien n’est encore arrivé sur ${adresse}. Si tu attends des e-mails de ce compte, vérifie le transfert dans sa messagerie.`}
          gestes={[rubrique ? { k: 'tout', mot: 'Voir toutes les rubriques', f: () => setRubrique('') } : { k: 'relier', mot: 'Relier ma boîte', f: onRelier }, { k: 'comptes', mot: 'Tous les comptes', f: () => setAdresse('') }]}/>}
        {vide && !filtre && !adresse && rubrique && <Etat k="rubrique-vide" titre={`Aucun e-mail dans « ${motRubrique} »`} texte="Ils arriveront ici dès que tes e-mails en parleront." gestes={[{ k: 'tout', mot: 'Voir tout', f: () => setRubrique('') }]}/>}
        {vide && !filtre && !adresse && !rubrique && <Etat k="vide" dessin="relier" titre="Ta boîte VRM est vide" texte="Relie ta boîte : chaque e-mail de Vinted, des transporteurs ou des autres sites que tu transfères à VRM arrivera ici, déjà rangé." gestes={[{ k: 'relier', mot: 'Relier ma boîte', f: onRelier }]}/>}
        {groupes.length > 0 && <div className="vrm-boite-liste" data-boite-liste="">
          {groupes.map((g) => <section key={g.cle} className="vrm-boite-jour" data-boite-jour={g.mot} aria-label={g.mot}>
            <h2 className="vrm-boite-jour-titre">{g.mot}</h2>
            <ul>
              {g.items.map((it) => (it.k === 'pile'
                ? <Pile key={it.cle} p={it} rendre={rendreEmail} lus={luDe} delies={delies} maintenant={maintenant} deplie={deplies.has(it.cle)} onDeplier={() => setDeplies((s) => { const n = new Set(s); if (n.has(it.cle)) n.delete(it.cle); else n.add(it.cle); return n; })}/>
                : rendreEmail(it.e)))}
            </ul>
          </section>)}
        </div>}
        <div ref={sentinelle} className="vrm-boite-sentinelle" aria-hidden="true"/>
        {pages && pages.suiteKO && <EtatPanne compact className="vrm-boite-panne" role="alert" data-boite-suite="pas-su" quoi="La suite de ta boîte" raison="Les e-mails ci-dessus restent lus." onReessayer={() => charger((pages.page || 0) + 1)}/>}
        {pages && pages.suite && !pages.suiteKO && <button type="button" className="vrm-boite-plus" data-boite-plus="" disabled={lecture} onClick={() => charger((pages.page || 0) + 1)}>{lecture ? 'Lecture…' : 'Voir plus'}</button>}
        {pages && !pages.suite && pages.emails.length > 0 && <p className="vrm-boite-fin" data-boite-fin="">{pages.emails.length} e-mail{pages.emails.length > 1 ? 's' : ''}{filtre || rubrique || adresse ? ' dans cette vue' : ''} · c’est tout</p>}
      </div>
      {large && <div className="vrm-boite-lecture-col">
        {ouvert ? <Lecture onRelier={onRelier} key={ouvert} id={ouvert} entetes={entetes} delies={delies} onFermer={() => setOuvert('')} onAller={onAller} onNum={onNum} plein={false} lu={(() => { const e = pages && pages.emails.find((x) => x.id === ouvert); return e ? luDe(e) : null; })()} onLu={onLu} photoDe={photoDe}/>
          : <div className="vrm-boite-vide-lecture" data-boite-vide-lecture=""><Dessin k="vide"/><p>Choisis un e-mail pour le lire.</p></div>}
      </div>}
      {!large && ouvert && <Lecture onRelier={onRelier} key={ouvert} id={ouvert} entetes={entetes} delies={delies} onFermer={() => setOuvert('')} onAller={(u) => { setOuvert(''); onAller && onAller(u); }} onNum={(n) => { setOuvert(''); onNum && onNum(n); }} plein FermeAuRetour={FermeAuRetour}
        lu={(() => { const e = pages && pages.emails.find((x) => x.id === ouvert); return e ? luDe(e) : null; })()} onLu={onLu} photoDe={photoDe}/>}
      {avis ? createPortal(<div className="vrm-boite-avis" role="status" data-boite-avis="">{avis}</div>, document.body) : null}
    </div>
  );
}

// (5 nov., chantier G, revue 2.24) UN seul écran « E-mails » : « Boîte de réception »
// et « Relier ma boîte » (l'ancien sous-écran de Paramètres en tête, puis l'accompagnement).
const VUES = [['boite', 'Boîte de réception'], ['relier', 'Relier ma boîte']];
// (6 nov., v36) `ecrireLus(gestes)` : l'écriture des lus (src/emailsLusEcriture.js) ;
// `photoDe(e)` : la photo de la paire reliée PAR IDENTITÉ (n° de transaction), ou `null`.
export default function BoiteEmails({ headers, delies: deliesRecus = {}, onAller, onNum, onAdresses, FermeAuRetour, vueInitiale = 'boite', reglages = null, aRelier, boites = [], compteInitial = '', lireDernier, ecrireLus, photoDe, Photo = null }) {
  // L'app repasse un objet neuf à chaque rendu : on le garde tant que son CONTENU ne
  // change pas (sinon les 950 lignes mémoïsées se redessinent à chaque tic de l'app).
  const deliesCle = JSON.stringify(deliesRecus || {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const delies = useMemo(() => deliesRecus || {}, [deliesCle]);
  const [vue, setVue] = useState(VUES.some(([k]) => k === vueInitiale) ? vueInitiale : (compteInitial ? 'relier' : 'boite'));
  const [compte, setCompte] = useState(String(compteInitial || ''));
  const [relies, setRelies] = useState(() => new Set());
  const haut = useRef(null);
  const guide = useRef(null);
  useEffect(() => {
    const f = () => setVue('relier');
    const g = (ev) => { const u = String((ev && ev.detail) || ''); setVue('relier'); if (u) setCompte(u); };
    // (6 nov., v36) Un e-mail demandé par la loupe s'ouvre dans la boîte de réception.
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
  const relierCompte = (uid) => {
    setCompte(String(uid)); setVue('relier');
    try { setTimeout(() => { if (guide.current) guide.current.scrollIntoView({ block: 'start', behavior: reduitMvt() ? 'auto' : 'smooth' }); }, 30); } catch (_) {}
  };
  const noterRelie = useCallback((uid) => setRelies((s) => (s.has(uid) ? s : new Set([...s, uid]))), []);
  const versAdresses = () => {
    if (onAdresses) onAdresses();
    try { haut.current && haut.current.scrollIntoView({ block: 'start', behavior: reduitMvt() ? 'auto' : 'smooth' }); } catch (_) {}
  };
  return (
    <PhotoBoite.Provider value={Photo}>
    <section className="vrm-boite" data-boite-emails="" data-vue={vue}>
      <div className="vrm-boite-vues" role="tablist" aria-label="E-mails">
        {VUES.map(([k, mot]) => <button key={k} type="button" role="tab" aria-selected={vue === k} data-boite-vue={k} onClick={() => setVue(k)}>{mot}</button>)}
      </div>
      {vue === 'boite' && <Boite headers={headers} delies={delies} onAller={onAller} onNum={onNum} FermeAuRetour={FermeAuRetour} onRelier={() => setVue('relier')} ecrireLus={ecrireLus} photoDe={photoDe}
        tete={<ARelier comptes={bandeau} onRelier={relierCompte}/>}/>}
      {vue === 'relier' && <div className="vrm-boite-relier" data-boite-relier="">
        <div ref={guide}>
          {compteOuvert
            ? <RelierCompte comptes={aRelierListe} uid={compteOuvert} onChoisir={setCompte} boites={boites} lireDernier={lireDernier} onRelie={noterRelie} onAdresses={onAdresses ? versAdresses : undefined}/>
            : <ARelier comptes={bandeau} onRelier={relierCompte}/>}
        </div>
        {reglages ? <div ref={haut} className="vrm-boite-reglages" data-boite-reglages="">{reglages}</div> : null}
        {!compteOuvert && <section className="vrm-boite-guide" aria-label="Faire suivre tes e-mails, pas à pas" data-boite-guide="">
          {reglages ? <h2 className="vrm-boite-guide-titre">Faire suivre tes e-mails, pas à pas</h2> : null}
          <RelierBoite onAdresses={onAdresses ? versAdresses : undefined}/>
        </section>}
      </div>}
    </section>
    </PhotoBoite.Provider>
  );
}
