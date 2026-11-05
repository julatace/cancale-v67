// ── L'ÉCRAN « E-MAILS » (5 nov., demande de Julien) ─────────────────────────
// « Un onglet dédié aux e-mails… une vraie boîte de réception, une liste des
// reçus, des filtres (par compte, ventes, achats, codes de retrait…) » et « un
// motion design qui montre, boîte par boîte, comment transmettre les e-mails ».
// (5 nov., soir, Julien : « améliore les mails ça doit être bcp plus clair ».)
// Chaque ligne dit D'ABORD ce que c'est et ce qu'il y a à faire, en mots simples
// (`titreSimple`, src/boiteEmails.js — tiré de ce que VRM a rangé, jamais du
// sujet), puis, plus petit, l'expéditeur avec le logo du site, le compte et
// l'heure. Les e-mails sont groupés par jour. La lecture met en haut, en gros, ce
// que c'est et le bouton de l'action ; puis le message d'origine NETTOYÉ (sujet
// compris, aucune balise) ; les pièces jointes ; « De », « Reçu sur » et la date
// sur une ligne discrète.
// (5 nov., nuit, Julien : « tu peux faire mieux ».) Chaque ligne a trois étages :
// la NATURE en un mot fort et l'heure alignée à droite ; l'ESSENTIEL sur une
// ligne (faits courts d'abord : code, N°, montant — une coupure ne mange que la
// fin du nom de l'article) ; puis le GESTE (`data-boite-geste` : à retirer avant
// le…, bordereau prêt, à envoyer, à vérifier — ambre seulement s'il est proche
// ou à vérifier), l'expéditeur, le compte. À gauche, la MARQUE de l'expéditeur
// (logo des quatre sites, monogramme neutre sinon — jamais un faux logo). Les
// e-mails « rien à faire » sont atténués (`data-boite-rien`). Les rubriques
// défilent sous un fondu qui dit qu'il y en a d'autres ; le compte est un menu
// simple ; « Actualiser » n'apparaît que quand la liste a plus d'une minute.
// Chaque état (lecture, vide, compte sans e-mail, panne) dit le geste.
//
// Deux vues : « Boîte de réception » (les emails que la route email-inbound a
// rangés) et « Relier ma boîte » (src/RelierBoite.jsx, rien n'y est envoyé).
//
// ⚠️ Lecture : la route existante `/api/email-rattacher?mode=journal` (aucune
//    fonction serverless de plus, plan Hobby). Une page = 20 emails en
//    scalaires projetés ; le corps d'UN email se lit sur son clic (`lire=`).
//    Jamais `select=data`, jamais une relecture toute seule (« Actualiser » est
//    SON geste ; il apparaît seulement, il ne relit rien).
// ⚠️ Trois états partout : `undefined` en cours · `null` pas su · valeur lue.
// ⚠️ Le corps est rendu en TEXTE (React l'échappe) : aucun HTML actif, et les
//    balises restées dans le texte sont retirées (`nettoyerCorps`).
// ⚠️ §5 : « Voir le colis… » seulement par identité (src/boiteEmails.js).
// ⚠️ Au téléphone, la feuille de lecture est OPAQUE dès sa première image : elle
//    ne s'anime jamais en opacité (la liste se voyait à travers, 5 nov.).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RUBRIQUES_BOITE, rubriqueEmail } from '../api/_lib/boite-email.js';
import { expediteurLisible, dateEmail, nettoyerCorps, poidsLisible, objetRelie, ceQueVrmAFait, titreSimple, titreEnClair, groupesParJour, siteExpediteur, ligneEmail, gesteAmbre, monogramme } from './boiteEmails.js';
import { codeLisible } from './journalEmail.js';
import { requeteJsonBornee } from './requeteJsonBornee.js';
import { LogoSite } from './SelecteurSites.jsx';
import RelierBoite from './RelierBoite.jsx';
import './boite-emails.css';

const formeListe = (j) => j && j.ok === true && Array.isArray(j.emails) && j.compteurs && typeof j.compteurs.sur === 'number';
const heure = (v) => { const t = Date.parse(v || ''); return Number.isFinite(t) ? new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''; };
const quandLong = (v) => { const t = Date.parse(v || ''); return Number.isFinite(t) ? new Date(t).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'date non lue'; };
const adresseDe = (from) => (String(from || '').match(/[^\s<>"']+@[^\s<>"']+/) || [''])[0];
// Une liste qui a plus d'une minute : « Actualiser » devient utile.
const VIEILLE = 60e3;
// Pourquoi la boîte n'a pas pu être lue — en mots, jamais un code.
function raisonPanne(err, statut) {
  try { if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'Cet appareil n’est pas connecté à internet.'; } catch (_) {}
  if (err && err.name === 'AbortError') return 'VRM n’a pas répondu à temps.';
  if (statut === 401 || statut === 403) return 'Ta session n’a pas été reconnue : reconnecte-toi.';
  if (err) return 'La connexion à VRM a échoué.';
  return 'VRM n’a pas pu lire ta boîte.';
}

function Trombone() {
  return <svg className="vrm-boite-pj-ic" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M10.5 4.5 5.8 9.2a1.4 1.4 0 0 0 2 2l5-5a2.8 2.8 0 0 0-4-4l-5.2 5.2a4.2 4.2 0 0 0 6 6l4-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>;
}
function IconeActualiser() {
  return <svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true"><path d="M16 10a6 6 0 1 1-1.8-4.3M16 3.5v3.2h-3.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function IconeEnveloppe() {
  return <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true"><rect x="7" y="12" width="34" height="24" rx="5" fill="none" stroke="currentColor" strokeWidth="2"/><path d="m9 15 15 11 15-11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg>;
}

// La marque de l'expéditeur, à gauche de la ligne : le logo du site (Vinted,
// Leboncoin, eBay, Vestiaire — dans la couleur du texte) ou un monogramme
// neutre (« MR » pour Mondial Relay) — jamais une couleur ni un faux logo.
function Marque({ from, grande = false }) {
  const site = siteExpediteur(from);
  return <span className={'vrm-boite-marque' + (grande ? ' is-grande' : '')} data-marque={site || 'monogramme'} aria-hidden="true">
    {site ? <LogoSite site={site}/> : <span className="vrm-boite-mono">{monogramme(expediteurLisible(from))}</span>}
  </span>;
}

// ── LIRE UN EMAIL ────────────────────────────────────────────────────────────
function Lecture({ id, entetes, delies, onFermer, onAller, onNum, plein, FermeAuRetour }) {
  const [m, setM] = useState(undefined); // undefined en cours · null pas su · {email}
  const [essai, setEssai] = useState(0);
  const titre = useRef(null);
  useEffect(() => {
    let vivant = true; setM(undefined);
    (async () => {
      try {
        const r = await requeteJsonBornee(`/api/email-rattacher?mode=journal&lire=${encodeURIComponent(id)}`, { headers: entetes(), cache: 'no-store' });
        if (!vivant) return;
        setM(r.ok && r.json && r.json.ok === true && r.json.id === id ? { email: r.json.email || null } : null);
      } catch (_) { if (vivant) setM(null); }
    })();
    return () => { vivant = false; };
  }, [id, entetes, essai]);
  useEffect(() => { if (m && m.email && titre.current) { try { titre.current.focus({ preventScroll: !plein }); } catch (_) {} } }, [m, plein]);
  const e = m && m.email;
  const corps = e ? nettoyerCorps(e.texte) : null;
  const lu = e ? ceQueVrmAFait(e, delies) : null;
  const objet = e ? objetRelie(e, delies) : null;
  const t = e ? titreSimple(e, delies) : null;
  const pdfConnu = e && e.resume && e.resume.pdf === 1;
  const aVerifier = lu && (lu.etat === 'verifier' || lu.etat === 'incompris');
  // Un colis à retirer : le CODE en grand (celui qu'on montre au relais), LU dans
  // le résumé rangé — et donc retiré de la ligne des détails (un nombre, une fois).
  const r = e && e.resume && typeof e.resume === 'object' ? e.resume : null;
  const codeGrand = r && r.t === 'suivi' && r.st === 'available' && r.sens !== 'sortant' && typeof r.code === 'string' && r.code.trim() ? codeLisible(r.code) : '';
  const details = t ? [...t.details.filter((x) => !(codeGrand && /^code \d/.test(x))), ...(t.rien ? ['rien à faire'] : [])] : [];
  const contenu = (
    <article className="vrm-boite-lecture" data-boite-lecture={id} data-plein={plein ? '1' : '0'} aria-label="E-mail ouvert" aria-busy={m === undefined ? 'true' : undefined}>
      <div className="vrm-boite-lecture-barre" data-boite-barre="">
        <button type="button" className="vrm-boite-retour" data-boite-fermer="" onClick={onFermer}>{plein ? <><span className="vrm-boite-chevron" aria-hidden="true">‹</span>Boîte de réception</> : 'Fermer'}</button>
      </div>
      {m === undefined && <div className="vrm-boite-lecture-attente" role="status"><span className="vrm-boite-sr">Ouverture de l’e-mail…</span><i/><i/><i/></div>}
      {m === null && <div className="vrm-boite-etat-bloc" role="alert" data-boite-lecture-etat="pas-su"><p className="vrm-boite-etat-titre">E-mail pas ouvert</p><p>— la lecture n’a pas abouti. Rien n’est perdu : il reste rangé.</p><button type="button" className="vrm-boite-principal" onClick={() => setEssai((n) => n + 1)}>Réessayer</button></div>}
      {m && !e && <div className="vrm-boite-etat-bloc" data-boite-lecture-etat="absent"><p className="vrm-boite-etat-titre">Cet e-mail n’est plus dans ta boîte VRM.</p></div>}
      {e && <>
        <header className="vrm-boite-haut" data-boite-haut="" data-etat={lu.etat}>
          <h2 tabIndex={-1} ref={titre} className="vrm-boite-titre" data-boite-titre={t.titre}>{t.titre}</h2>
          {details.length > 0 && <p className="vrm-boite-details">{details.join(' · ')}</p>}
          {codeGrand && <p className="vrm-boite-code-grand" data-boite-code={codeGrand}><span>Code de retrait</span><b>{codeGrand}</b></p>}
          {aVerifier && <div className="vrm-boite-averif" data-boite-averif="">
            {lu.raison && <p><b>À vérifier :</b> {lu.raison}</p>}
            {lu.geste && <p><b>Que faire :</b> {lu.geste}</p>}
          </div>}
          {objet && <button type="button" className="vrm-boite-objet vrm-boite-principal" data-boite-objet={objet.k} onClick={() => (objet.k === 'num' ? onNum && onNum(objet.num) : onAller && onAller(objet.url))}>{objet.mot}</button>}
          <p className="vrm-boite-fait" data-boite-fait="" data-boite-objet={objet ? undefined : 'aucun'}>Dans VRM : {lu.fait}{objet ? '' : ' — relié à aucun colis, vente ou achat précis (aucun numéro lu dans l’e-mail).'}</p>
        </header>
        <section className="vrm-boite-corps-bloc" aria-label="Message d’origine">
          <p className="vrm-boite-sous">Message d’origine</p>
          <div className="vrm-boite-message">
            <h3 className="vrm-boite-sujet" data-boite-sujet="">{e.subject || 'E-mail sans objet'}</h3>
            {corps && e.texteCoupe && <p className="vrm-boite-doux" data-boite-extrait="">Extrait : VRM garde le début du message. La suite est dans ta messagerie.</p>}
            {corps ? <pre className="vrm-boite-corps" data-boite-corps={e.texteCoupe ? 'extrait' : 'lu'}>{corps}</pre>
              : <p className="vrm-boite-doux" data-boite-corps="absent">Le texte de cet e-mail n’est pas gardé dans VRM. Il est dans ta messagerie.</p>}
          </div>
        </section>
        <section className="vrm-boite-pieces" data-boite-pieces={e.pieces == null ? 'pas-su' : e.pieces.length}>
          {e.pieces == null
            ? <><p className="vrm-boite-sous">Pièces jointes</p><p className="vrm-boite-doux">Liste non gardée : cet e-mail a été rangé avant le 5 nov.{pdfConnu ? ' Le PDF joint est gardé avec ' + (e.resume.t === 'achat' ? 'le reçu d’achat.' : 'le bordereau.') : ''}</p></>
            : e.pieces.length === 0 ? <p className="vrm-boite-doux">Aucune pièce jointe.</p>
            : <><p className="vrm-boite-sous">Pièces jointes</p><ul>{e.pieces.map((p, i) => <li key={i} data-boite-piece={p.n}><Trombone/><span className="vrm-boite-piece-nom">{p.n}</span><small>{[p.t === 'application/pdf' ? 'PDF' : p.t, poidsLisible(p.o)].filter(Boolean).join(' · ')}</small></li>)}</ul>
              <p className="vrm-boite-doux">Pour imprimer un bordereau ou un reçu : Colis ou Achats.</p></>}
        </section>
        <p className="vrm-boite-meta" data-boite-meta="">
          <span data-boite-de="">De <b>{expediteurLisible(e.from)}</b>{adresseDe(e.from) ? ` (${adresseDe(e.from)})` : ''}</span>
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

// L'appui se voit TOUT DE SUITE (au doigt posé, pas au relâcher) : un attribut
// posé par le pointeur, car `:active` ne vient pas partout (iPhone, et une page
// qui retient le clic de souris).
const appuie = (ev) => { ev.currentTarget.dataset.appui = '1'; };
const relache = (ev) => { delete ev.currentTarget.dataset.appui; };

// ── UNE LIGNE ────────────────────────────────────────────────────────────────
// Le nom d'un site (Vinted…) est déjà dit par son logo (la marque, à gauche) et
// dans l'étiquette lue à voix haute ; un transporteur, lui, est nommé en clair.
// Le pied a deux blocs insécables : le GESTE, puis « qui » (expéditeur · compte ·
// pièces). Trop long pour une ligne, « qui » passe dessous, entier — jamais un
// nom coupé ni un « · » orphelin en début de ligne.
function Ligne({ e, delies, ouvert, onOuvrir }) {
  const r = rubriqueEmail(e);
  const t = titreSimple(e, delies);
  const l = ligneEmail(e, delies);
  const g = l.geste;
  const h = heure(dateEmail(e));
  const site = siteExpediteur(e.from);
  return <button type="button" className="vrm-boite-ligne" data-boite-email={e.id} data-rubrique={r} data-etat={e.etat}
    data-boite-geste={g ? g.k : undefined} data-boite-proche={g && g.proche ? '1' : undefined} data-boite-rien={l.rien ? '1' : undefined}
    aria-current={ouvert ? 'true' : undefined}
    aria-label={`${titreEnClair(t)}. ${expediteurLisible(e.from)}${e.compte ? ', ' + e.compte.nom : ''}${h ? ', ' + h : ''}`} onClick={onOuvrir}
    onPointerDown={appuie} onPointerUp={relache} onPointerCancel={relache} onPointerLeave={relache}>
    <Marque from={e.from}/>
    <span className="vrm-boite-ligne-txt">
      <span className="vrm-boite-ligne-haut">
        <span className="vrm-boite-quoi" data-boite-quoi={l.titre}>{l.titre}</span>
        <time dateTime={dateEmail(e) || ''}>{h}</time>
      </span>
      {l.essentiel.length > 0 && <span className="vrm-boite-essentiel" data-boite-essentiel="">
        {l.essentiel.map((x, i) => <span key={i} className={/^code \d/.test(x) ? 'vrm-boite-code' : undefined}>{i ? ' · ' : ''}{x}</span>)}
      </span>}
      <span className="vrm-boite-ligne-pied">
        {g && <span className="vrm-boite-geste" data-boite-geste-mot={g.k} data-ambre={gesteAmbre(g) ? '1' : '0'} data-passe={g.passe ? '1' : undefined} data-boite-averifier={g.k === 'verifier' ? '' : undefined}>{g.mot}</span>}
        {(l.rien || !site || e.compte || e.pj > 0) && <span className="vrm-boite-qui">
          {l.rien && <span className="vrm-boite-rien">rien à faire</span>}
          {!site && <span className="vrm-boite-exp" data-boite-exp="autre"><span className="vrm-boite-exp-nom">{expediteurLisible(e.from)}</span></span>}
          {e.compte && <span className="vrm-boite-compte-nom">{e.compte.nom}</span>}
          {e.pj > 0 && <span className="vrm-boite-pj" data-boite-pj={e.pj}><Trombone/>{e.pj}</span>}
        </span>}
      </span>
    </span>
  </button>;
}

// En attendant la liste : des lignes fantômes (apparaissent après 150 ms, pour
// ne pas clignoter sur une lecture rapide ; figées en mouvement réduit).
function Squelette() {
  return <div className="vrm-boite-squelette" data-boite-chargement="" role="status" aria-busy="true">
    <span className="vrm-boite-sr">Lecture de ta boîte…</span>
    {[0, 1, 2, 3, 4].map((i) => <div key={i} className="vrm-boite-sq-ligne" aria-hidden="true"><i className="vrm-boite-sq-rond"/><span><i style={{ width: `${46 + (i * 17) % 30}%` }}/><i style={{ width: `${70 - (i * 11) % 25}%` }}/></span></div>)}
  </div>;
}

// Un état de la boîte : un titre, une phrase, LE geste.
function Etat({ k, titre, texte, gestes, role }) {
  return <div className="vrm-boite-etat-bloc" data-boite-etat={k} data-boite={k === 'panne' ? 'pas-su' : k === 'vide' || k === 'rubrique-vide' || k === 'compte-vide' ? 'vide' : undefined} role={role}>
    <span className="vrm-boite-etat-ic"><IconeEnveloppe/></span>
    <p className="vrm-boite-etat-titre">{titre}</p>
    {texte && <p className="vrm-boite-etat-texte">{texte}</p>}
    {gestes && gestes.length > 0 && <div className="vrm-boite-etat-gestes">{gestes.map((x, i) => <button key={x.mot} type="button" className={i === 0 ? 'vrm-boite-principal' : 'vrm-boite-second'} data-boite-etat-geste={x.k} onClick={x.f}>{x.mot}</button>)}</div>}
  </div>;
}

// Le fondu au bord d'une rangée qui défile : il dit qu'il y a d'autres
// pastilles de ce côté (rien n'est coupé sans indice).
function useBords(ref, dep) {
  useEffect(() => {
    const n = ref.current; if (!n) return undefined;
    const maj = () => {
      const g = n.scrollLeft > 2, d = n.scrollLeft + n.clientWidth < n.scrollWidth - 2;
      n.dataset.bordGauche = g ? '1' : '0'; n.dataset.bordDroite = d ? '1' : '0';
    };
    maj();
    n.addEventListener('scroll', maj, { passive: true });
    let ro; try { ro = new ResizeObserver(maj); ro.observe(n); } catch (_) { window.addEventListener('resize', maj); }
    return () => { n.removeEventListener('scroll', maj); if (ro) ro.disconnect(); else window.removeEventListener('resize', maj); };
  }, [ref, dep]);
}

// ── LA BOÎTE ─────────────────────────────────────────────────────────────────
function Boite({ headers, delies, onAller, onNum, FermeAuRetour, onRelier }) {
  const [rubrique, setRubrique] = useState('');
  const [adresse, setAdresse] = useState('');
  const [pages, setPages] = useState(undefined);
  const [lecture, setLecture] = useState(false);
  const [ouvert, setOuvert] = useState('');
  const [panne, setPanne] = useState('');
  const [luA, setLuA] = useState(0);
  const [vieille, setVieille] = useState(false);
  const [large, setLarge] = useState(() => { try { return window.matchMedia('(min-width: 900px)').matches; } catch (_) { return false; } });
  useEffect(() => { let mq; try { mq = window.matchMedia('(min-width: 900px)'); } catch (_) { return undefined; } const f = () => setLarge(mq.matches); mq.addEventListener ? mq.addEventListener('change', f) : mq.addListener(f); return () => { mq.removeEventListener ? mq.removeEventListener('change', f) : mq.removeListener(f); }; }, []);
  const gen = useRef(0);
  const auth = useRef(headers); auth.current = headers;
  const entetes = useCallback(() => (auth.current ? auth.current() : {}), []);
  const charger = useCallback(async (page = 0) => {
    const g = ++gen.current;
    setLecture(true);
    if (page === 0) { setPages(undefined); setPanne(''); }
    let statut = 0;
    try {
      const q = new URLSearchParams({ mode: 'journal', page: String(page) });
      if (rubrique) q.set('boite', rubrique); if (adresse) q.set('adresse', adresse);
      const r = await requeteJsonBornee(`/api/email-rattacher?${q}`, { headers: entetes(), cache: 'no-store' });
      statut = r.status;
      if (g !== gen.current) return;
      if (!r.ok || !formeListe(r.json)) { if (page === 0) { setPages(null); setPanne(raisonPanne(null, statut)); } else setPages((p) => (p ? { ...p, suiteKO: true } : p)); return; }
      const j = r.json;
      setPages((p) => (page === 0 || !p ? j : { ...j, emails: [...p.emails, ...j.emails.filter((x) => !p.emails.some((y) => y.id === x.id))] }));
      if (page === 0) { setLuA(Date.now()); setVieille(false); }
    } catch (err) { if (g === gen.current) { if (page === 0) { setPages(null); setPanne(raisonPanne(err, statut)); } else setPages((p) => (p ? { ...p, suiteKO: true } : p)); } }
    finally { if (g === gen.current) setLecture(false); }
  }, [rubrique, adresse, entetes]);
  useEffect(() => { charger(0); }, [charger]);
  // « Actualiser » n'apparaît que quand la liste a plus d'une minute (au retour
  // dans l'app ou après une minute ouverte) : il ne relit RIEN tout seul.
  useEffect(() => {
    if (!luA) return undefined;
    const voir = () => { if (Date.now() - luA >= VIEILLE) setVieille(true); };
    const t = setTimeout(voir, Math.max(0, VIEILLE - (Date.now() - luA)) + 50);
    document.addEventListener('visibilitychange', voir); window.addEventListener('focus', voir);
    return () => { clearTimeout(t); document.removeEventListener('visibilitychange', voir); window.removeEventListener('focus', voir); };
  }, [luA]);
  // Les adresses ne dépendent pas du filtre : on garde la dernière liste lue.
  const [adresses, setAdresses] = useState(null);
  useEffect(() => { if (pages && Array.isArray(pages.adresses)) setAdresses(pages.adresses); }, [pages]);
  const c = pages && pages.compteurs;
  const parR = c && c.parRubrique && typeof c.parRubrique === 'object' ? c.parRubrique : null;
  const groupes = useMemo(() => (pages && Array.isArray(pages.emails) ? groupesParJour(pages.emails) : []), [pages]);
  // Le nom du compte choisi (celui de la liste des adresses, sinon l'adresse).
  const nomCompte = (adr) => { const a = Array.isArray(adresses) ? adresses.find((x) => x.adresse === adr) : null; return (a && a.nom) || adr; };
  // Le menu des comptes : le NOM seul ; l'adresse seulement si deux comptes
  // portent le même nom (ou s'il n'y a pas de nom).
  const nomsDoubles = useMemo(() => { const n = {}; (adresses || []).forEach((a) => { if (a.nom) n[a.nom] = (n[a.nom] || 0) + 1; }); return n; }, [adresses]);
  const libelleCompte = (a) => (a.nom ? (nomsDoubles[a.nom] > 1 ? `${a.nom} · ${a.adresse}` : a.nom) : a.adresse);
  const choixCompte = Array.isArray(adresses) && (adresses.length > 1 || (adresse && adresses.length > 0));
  // La phrase sous les filtres : seulement quand les nombres ne disent pas
  // tout (compte choisi, ou des e-mails plus anciens pas comptés — §5 « un total
  // partiel ne se présente jamais comme complet »).
  const phrase = c && parR ? (c.plus ? `Les nombres ne comptent que tes ${c.sur} derniers e-mails${c.adresse ? ` de ${nomCompte(c.adresse)}` : ''}.` : c.adresse ? `Les nombres sont ceux de ${nomCompte(c.adresse)}.` : '') : '';
  const rangee = useRef(null);
  useBords(rangee, parR ? 1 : 0);
  const choisir = (id, bouton) => {
    setRubrique(id); setOuvert('');
    try { const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches; bouton && bouton.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: reduit ? 'auto' : 'smooth' }); } catch (_) {}
  };
  const motRubrique = (RUBRIQUES_BOITE.find((x) => x.id === rubrique) || {}).mot || '';
  const vide = pages && pages.emails.length === 0;
  return (
    <div className="vrm-boite-corps-ecran" data-boite-large={large ? '1' : '0'} data-boite-ouvert={ouvert ? '1' : '0'}>
      <div className="vrm-boite-liste-col">
        <div className="vrm-boite-filtres">
          <div ref={rangee} className="vrm-boite-rubriques vrm-rangee" role="group" aria-label="Trier les e-mails">
            {RUBRIQUES_BOITE.map(({ id, mot }) => {
              const n = id ? (parR && Number.isFinite(parR[id]) ? parR[id] : null) : (c && parR && !c.plus ? c.sur : null);
              return <button key={id || 'tout'} type="button" aria-pressed={rubrique === id} data-boite-rubrique={id || 'tout'} onClick={(ev) => choisir(id, ev.currentTarget)}>
                <span>{mot}</span>{n != null ? <span className="vrm-boite-n" data-boite-n={n}>{n}</span> : null}
              </button>;
            })}
          </div>
          {(choixCompte || vieille) && <div className="vrm-boite-ligne-outils">
            {choixCompte && <label className="vrm-boite-compte">
              <span className="vrm-boite-sr">Compte</span>
              <select value={adresse} onChange={(ev) => { setAdresse(ev.target.value); setOuvert(''); }} data-boite-adresse="" aria-label="Compte">
                <option value="">Tous les comptes</option>
                {adresses.map((a) => <option key={a.adresse} value={a.adresse}>{libelleCompte(a)}</option>)}
              </select>
              <svg className="vrm-boite-compte-chevron" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="m3 4.5 3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </label>}
            {vieille && <button type="button" className="vrm-boite-actualiser" data-boite-actualiser="" onClick={() => charger(0)} disabled={lecture} title={luA ? `Lue à ${heure(new Date(luA).toISOString())}` : undefined}>
              <span className={lecture ? 'vrm-boite-tourne' : undefined}><IconeActualiser/></span>{lecture ? 'Lecture…' : 'Actualiser'}
            </button>}
          </div>}
          {phrase && <p className="vrm-boite-couverture" data-boite-sur={c.sur} data-boite-sur-adresse={c.adresse || ''}>{phrase}</p>}
        </div>
        {pages === undefined && <Squelette/>}
        {pages === null && <Etat k="panne" role="alert" titre="Boîte pas lue" texte={`— ${panne || 'VRM n’a pas pu lire ta boîte.'} Rien n’est perdu : tes e-mails restent rangés.`} gestes={[{ k: 'reessayer', mot: 'Réessayer', f: () => charger(0) }]}/>}
        {vide && adresse && <Etat k="compte-vide" titre={`Aucun e-mail reçu sur ${nomCompte(adresse)}${rubrique ? ` dans « ${motRubrique} »` : ''}`} texte={rubrique ? 'Les autres rubriques en ont peut-être.' : `Rien n’est encore arrivé sur ${adresse}. Si tu attends des e-mails de ce compte, vérifie le transfert dans sa messagerie.`}
          gestes={[rubrique ? { k: 'tout', mot: 'Voir toutes les rubriques', f: () => setRubrique('') } : { k: 'relier', mot: 'Relier ma boîte', f: onRelier }, { k: 'comptes', mot: 'Tous les comptes', f: () => setAdresse('') }]}/>}
        {vide && !adresse && rubrique && <Etat k="rubrique-vide" titre={`Aucun e-mail dans « ${motRubrique} »`} texte="Ils arriveront ici dès que tes e-mails en parleront." gestes={[{ k: 'tout', mot: 'Voir tout', f: () => setRubrique('') }]}/>}
        {vide && !adresse && !rubrique && <Etat k="vide" titre="Ta boîte VRM est vide" texte="Relie ta boîte : chaque e-mail de Vinted, des transporteurs ou des autres sites que tu transfères à VRM arrivera ici, déjà rangé." gestes={[{ k: 'relier', mot: 'Relier ma boîte', f: onRelier }]}/>}
        {groupes.length > 0 && <div className="vrm-boite-liste" data-boite-liste="">
          {groupes.map((g) => <section key={g.cle} className="vrm-boite-jour" data-boite-jour={g.mot} aria-label={g.mot}>
            <h2 className="vrm-boite-jour-titre">{g.mot}</h2>
            <ul>
              {g.emails.map((e) => <li key={e.id}><Ligne e={e} delies={delies} ouvert={ouvert === e.id} onOuvrir={() => setOuvert(e.id)}/></li>)}
            </ul>
          </section>)}
        </div>}
        {pages && pages.suiteKO && <p className="vrm-boite-etat" role="alert">— la suite n’a pas pu être lue. <button type="button" onClick={() => charger((pages.page || 0) + 1)}>Réessayer</button></p>}
        {pages && pages.suite && <button type="button" className="vrm-boite-plus" data-boite-plus="" disabled={lecture} onClick={() => charger((pages.page || 0) + 1)}>{lecture ? 'Lecture…' : 'Voir plus'}</button>}
      </div>
      {large && <div className="vrm-boite-lecture-col">
        {ouvert ? <Lecture key={ouvert} id={ouvert} entetes={entetes} delies={delies} onFermer={() => setOuvert('')} onAller={onAller} onNum={onNum} plein={false}/>
          : <div className="vrm-boite-vide-lecture" data-boite-vide-lecture=""><IconeEnveloppe/><p>Choisis un e-mail pour le lire.</p></div>}
      </div>}
      {!large && ouvert && <Lecture key={ouvert} id={ouvert} entetes={entetes} delies={delies} onFermer={() => setOuvert('')} onAller={(u) => { setOuvert(''); onAller && onAller(u); }} onNum={(n) => { setOuvert(''); onNum && onNum(n); }} plein FermeAuRetour={FermeAuRetour}/>}
    </div>
  );
}

const VUES = [['boite', 'Boîte de réception'], ['relier', 'Relier ma boîte']];
export default function BoiteEmails({ headers, delies = {}, onAller, onNum, onAdresses, FermeAuRetour, vueInitiale = 'boite' }) {
  const [vue, setVue] = useState(VUES.some(([k]) => k === vueInitiale) ? vueInitiale : 'boite');
  return (
    <section className="vrm-boite" data-boite-emails="" data-vue={vue}>
      <div className="vrm-boite-vues" role="tablist" aria-label="E-mails">
        {VUES.map(([k, mot]) => <button key={k} type="button" role="tab" aria-selected={vue === k} data-boite-vue={k} onClick={() => setVue(k)}>{mot}</button>)}
      </div>
      {vue === 'boite' && <Boite headers={headers} delies={delies} onAller={onAller} onNum={onNum} FermeAuRetour={FermeAuRetour} onRelier={() => setVue('relier')}/>}
      {vue === 'relier' && <RelierBoite onAdresses={onAdresses}/>}
    </section>
  );
}
