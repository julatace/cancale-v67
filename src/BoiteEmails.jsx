// ── L'ÉCRAN « E-MAILS » (5 nov., demande de Julien) ─────────────────────────
// « Un onglet dédié aux e-mails… une vraie boîte de réception, une liste des
// reçus, des filtres (par compte, ventes, achats, codes de retrait…) » et « un
// motion design qui montre, boîte par boîte, comment transmettre les e-mails ».
//
// Deux vues : « Boîte de réception » (les emails que la route email-inbound a
// rangés) et « Relier ma boîte » (src/RelierBoite.jsx, rien n'y est envoyé).
//
// ⚠️ Lecture : la route existante `/api/email-rattacher?mode=journal` (aucune
//    fonction serverless de plus, plan Hobby). Une page = 20 emails en
//    scalaires projetés ; le corps d'UN email se lit sur son clic (`lire=`).
//    Jamais `select=data`, jamais une relecture toute seule.
// ⚠️ Trois états partout : `undefined` en cours · `null` pas su · valeur lue.
// ⚠️ Le corps est rendu en TEXTE (React l'échappe) : aucun HTML actif.
// ⚠️ §5 : « Voir dans VRM » seulement par identité (src/boiteEmails.js).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RUBRIQUES_BOITE, rubriqueEmail } from '../api/_lib/boite-email.js';
import { expediteurLisible, dateEmail, nettoyerCorps, poidsLisible, objetRelie, ceQueVrmAFait } from './boiteEmails.js';
import { requeteJsonBornee } from './requeteJsonBornee.js';
import RelierBoite from './RelierBoite.jsx';
import './boite-emails.css';

const MOT_RUBRIQUE = Object.fromEntries(RUBRIQUES_BOITE.filter((x) => x.id).map((x) => [x.id, x.mot]));
const formeListe = (j) => j && j.ok === true && Array.isArray(j.emails) && j.compteurs && typeof j.compteurs.sur === 'number';
const quandCourt = (v) => {
  const t = Date.parse(v || ''); if (!Number.isFinite(t)) return 'date non lue';
  const d = new Date(t), auj = new Date();
  return d.toDateString() === auj.toDateString() ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};
const quandLong = (v) => { const t = Date.parse(v || ''); return Number.isFinite(t) ? new Date(t).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'date non lue'; };
const adresseDe = (from) => (String(from || '').match(/[^\s<>"']+@[^\s<>"']+/) || [''])[0];

function Trombone() {
  return <svg className="vrm-boite-pj-ic" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M10.5 4.5 5.8 9.2a1.4 1.4 0 0 0 2 2l5-5a2.8 2.8 0 0 0-4-4l-5.2 5.2a4.2 4.2 0 0 0 6 6l4-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>;
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
  const pdfConnu = e && e.resume && e.resume.pdf === 1;
  const contenu = (
    <article className="vrm-boite-lecture" data-boite-lecture={id} data-plein={plein ? '1' : '0'} aria-label="E-mail ouvert">
      <div className="vrm-boite-lecture-barre">
        <button type="button" className="vrm-boite-retour" data-boite-fermer="" onClick={onFermer}>{plein ? '‹ Boîte de réception' : 'Fermer'}</button>
      </div>
      {m === undefined && <p className="vrm-boite-etat" role="status">Ouverture de l’e-mail…</p>}
      {m === null && <p className="vrm-boite-etat" role="alert" data-boite-lecture-etat="pas-su">Cet e-mail n’a pas pu être ouvert — rien n’est perdu, il reste rangé. <button type="button" onClick={() => setEssai((n) => n + 1)}>Réessayer</button></p>}
      {m && !e && <p className="vrm-boite-etat" data-boite-lecture-etat="absent">Cet e-mail n’est plus dans ta boîte VRM.</p>}
      {e && <>
        <h2 tabIndex={-1} ref={titre} className="vrm-boite-sujet" data-boite-sujet="">{e.subject || 'E-mail sans objet'}</h2>
        <dl className="vrm-boite-entetes">
          <div><dt>De</dt><dd data-boite-de=""><b>{expediteurLisible(e.from)}</b>{adresseDe(e.from) && <small> {adresseDe(e.from)}</small>}</dd></div>
          <div><dt>Date</dt><dd data-boite-date=""><time dateTime={dateEmail(e) || ''}>{quandLong(dateEmail(e))}</time>{!e.sourceDate && e.at && <small> (arrivée dans VRM)</small>}</dd></div>
          <div><dt>Reçu sur</dt><dd data-boite-recu="">{e.adresses && e.adresses.length ? e.adresses.join(', ') : 'adresse non lue'}{e.compte ? <small> · {e.compte.nom}</small> : e.compteAmbigu ? <small> · plusieurs comptes sur cette adresse</small> : null}</dd></div>
        </dl>
        <section className="vrm-boite-fait" data-boite-fait="" data-etat={lu.etat}>
          <h3>Ce que VRM en a fait</h3>
          <p className="vrm-boite-fait-quoi">{lu.quoi}</p>
          <p>{lu.fait}</p>
          {lu.raison && <p className="vrm-boite-raison">{lu.raison}</p>}
          {lu.geste && <p className="vrm-boite-raison"><b>À faire :</b> {lu.geste}</p>}
          {objet
            ? <button type="button" className="vrm-boite-objet" data-boite-objet={objet.k} onClick={() => (objet.k === 'num' ? onNum && onNum(objet.num) : onAller && onAller(objet.url))}>{objet.mot} <span aria-hidden="true">→</span></button>
            : <p className="vrm-boite-doux" data-boite-objet="aucun">Relié à rien de précis dans VRM : aucune identité (n° de suivi, de transaction, N°) n’a été lue dans cet e-mail.</p>}
        </section>
        <section className="vrm-boite-corps-bloc">
          <h3>Message</h3>
          {corps ? <pre className="vrm-boite-corps" data-boite-corps="lu">{corps}</pre>
            : <p className="vrm-boite-doux" data-boite-corps="absent">Texte non gardé (e-mail rangé avant le 31 oct., ou sans texte). L’original reste dans ta messagerie.</p>}
        </section>
        <section className="vrm-boite-pieces" data-boite-pieces={e.pieces == null ? 'pas-su' : e.pieces.length}>
          <h3>Pièces jointes</h3>
          {e.pieces == null
            ? <p className="vrm-boite-doux">Liste non gardée : cet e-mail a été rangé avant le 5 nov.{pdfConnu ? ' Un PDF était joint : il est gardé avec ' + (e.resume.t === 'achat' ? 'le reçu d’achat.' : 'le bordereau.') : ''}</p>
            : e.pieces.length === 0 ? <p className="vrm-boite-doux">Aucune pièce jointe.</p>
            : <ul>{e.pieces.map((p, i) => <li key={i} data-boite-piece={p.n}><Trombone/><span className="vrm-boite-piece-nom">{p.n}</span><small>{[p.t, poidsLisible(p.o)].filter(Boolean).join(' · ')}</small></li>)}</ul>}
          {e.pieces && e.pieces.length > 0 && <p className="vrm-boite-doux">VRM garde la liste ; le PDF d’un bordereau ou d’un reçu s’imprime depuis Colis ou Achats.</p>}
        </section>
      </>}
    </article>
  );
  if (!plein) return contenu;
  return createPortal(<div className="vrm-boite-feuille" data-boite-feuille="" role="dialog" aria-modal="true" aria-label="E-mail ouvert">{FermeAuRetour ? <FermeAuRetour fermer={onFermer}/> : null}{contenu}</div>, document.body);
}

// ── LA BOÎTE ─────────────────────────────────────────────────────────────────
function Boite({ headers, delies, onAller, onNum, FermeAuRetour }) {
  const [rubrique, setRubrique] = useState('');
  const [adresse, setAdresse] = useState('');
  const [pages, setPages] = useState(undefined);
  const [lecture, setLecture] = useState(false);
  const [ouvert, setOuvert] = useState('');
  const [large, setLarge] = useState(() => { try { return window.matchMedia('(min-width: 900px)').matches; } catch (_) { return false; } });
  useEffect(() => { let mq; try { mq = window.matchMedia('(min-width: 900px)'); } catch (_) { return undefined; } const f = () => setLarge(mq.matches); mq.addEventListener ? mq.addEventListener('change', f) : mq.addListener(f); return () => { mq.removeEventListener ? mq.removeEventListener('change', f) : mq.removeListener(f); }; }, []);
  const gen = useRef(0);
  const auth = useRef(headers); auth.current = headers;
  const entetes = useCallback(() => (auth.current ? auth.current() : {}), []);
  const charger = useCallback(async (page = 0) => {
    const g = ++gen.current;
    setLecture(true);
    if (page === 0) setPages(undefined);
    try {
      const q = new URLSearchParams({ mode: 'journal', page: String(page) });
      if (rubrique) q.set('boite', rubrique); if (adresse) q.set('adresse', adresse);
      const r = await requeteJsonBornee(`/api/email-rattacher?${q}`, { headers: entetes(), cache: 'no-store' });
      if (g !== gen.current) return;
      if (!r.ok || !formeListe(r.json)) { if (page === 0) setPages(null); else setPages((p) => (p ? { ...p, suiteKO: true } : p)); return; }
      const j = r.json;
      setPages((p) => (page === 0 || !p ? j : { ...j, emails: [...p.emails, ...j.emails.filter((x) => !p.emails.some((y) => y.id === x.id))] }));
    } catch (_) { if (g === gen.current) { if (page === 0) setPages(null); else setPages((p) => (p ? { ...p, suiteKO: true } : p)); } }
    finally { if (g === gen.current) setLecture(false); }
  }, [rubrique, adresse, entetes]);
  useEffect(() => { charger(0); }, [charger]);
  // Les adresses ne dépendent pas du filtre : on garde la dernière liste lue.
  const [adresses, setAdresses] = useState(null);
  useEffect(() => { if (pages && Array.isArray(pages.adresses)) setAdresses(pages.adresses); }, [pages]);
  const c = pages && pages.compteurs;
  const parR = c && c.parRubrique && typeof c.parRubrique === 'object' ? c.parRubrique : null;
  return (
    <div className="vrm-boite-corps-ecran" data-boite-large={large ? '1' : '0'} data-boite-ouvert={ouvert ? '1' : '0'}>
      <div className="vrm-boite-liste-col">
        <div className="vrm-boite-filtres">
          <div className="vrm-boite-rubriques vrm-rangee" role="group" aria-label="Filtrer les e-mails">
            {RUBRIQUES_BOITE.map(({ id, mot }) => <button key={id || 'tout'} type="button" aria-pressed={rubrique === id} data-boite-rubrique={id || 'tout'} onClick={() => { setRubrique(id); setOuvert(''); }}>
              {mot}{id && parR && parR[id] > 0 ? <span className="vrm-boite-n">{parR[id]}</span> : null}
            </button>)}
          </div>
          <div className="vrm-boite-ligne-outils">
            {Array.isArray(adresses) && adresses.length > 0 && <label className="vrm-boite-compte"><span>Compte (adresse de réception)</span>
              <select value={adresse} onChange={(ev) => { setAdresse(ev.target.value); setOuvert(''); }} data-boite-adresse="">
                <option value="">Tous mes comptes</option>
                {adresses.map((a) => <option key={a.adresse} value={a.adresse}>{a.nom ? `${a.nom} · ` : ''}{a.adresse}</option>)}
              </select>
            </label>}
            <button type="button" className="vrm-boite-actualiser" onClick={() => charger(0)} disabled={lecture}>{lecture ? 'Lecture…' : 'Actualiser'}</button>
          </div>
          {parR && <p className="vrm-boite-couverture" data-boite-sur={c.sur}>Comptés sur tes {c.sur} derniers e-mails{c.plus ? ', les plus anciens à part' : ''}.</p>}
        </div>
        {pages === undefined && <p className="vrm-boite-etat" role="status">Lecture de ta boîte…</p>}
        {pages === null && <p className="vrm-boite-etat" role="alert" data-boite="pas-su">Je n’ai pas pu lire tes e-mails — rien n’est perdu, ils restent rangés. <button type="button" onClick={() => charger(0)}>Réessayer</button></p>}
        {pages && pages.emails.length === 0 && <p className="vrm-boite-etat" data-boite="vide">{rubrique || adresse ? 'Aucun e-mail pour ce filtre.' : 'Aucun e-mail reçu pour l’instant. Relie ta boîte : le prochain e-mail transféré apparaîtra ici.'}</p>}
        {pages && pages.emails.length > 0 && <ul className="vrm-boite-liste" data-boite-liste="">
          {pages.emails.map((e) => {
            const r = rubriqueEmail(e);
            const aVerifier = e.etat !== 'integre';
            return <li key={e.id}>
              <button type="button" className="vrm-boite-ligne" data-boite-email={e.id} data-rubrique={r} data-etat={e.etat} aria-current={ouvert === e.id ? 'true' : undefined} onClick={() => setOuvert(e.id)}>
                <span className="vrm-boite-ligne-tete">
                  <b className="vrm-boite-de">{expediteurLisible(e.from)}</b>
                  <time dateTime={dateEmail(e) || ''}>{quandCourt(dateEmail(e))}</time>
                </span>
                <span className="vrm-boite-ligne-sujet">{e.subject || 'E-mail sans objet'}</span>
                <span className="vrm-boite-ligne-pied">
                  <span className="vrm-boite-tag" data-tag={r}>{MOT_RUBRIQUE[r]}</span>
                  {e.compte && <span className="vrm-boite-compte-nom">{e.compte.nom}</span>}
                  {e.pj > 0 && <span className="vrm-boite-pj" data-boite-pj={e.pj}><Trombone/>{e.pj}</span>}
                  {aVerifier && <span className="vrm-boite-averifier" data-boite-averifier="">{e.etat === 'erreur' ? 'en attente' : 'à vérifier'}</span>}
                </span>
              </button>
            </li>;
          })}
        </ul>}
        {pages && pages.suiteKO && <p className="vrm-boite-etat" role="alert">La suite n’a pas pu être lue. Réessaie.</p>}
        {pages && pages.suite && <button type="button" className="vrm-boite-plus" data-boite-plus="" disabled={lecture} onClick={() => charger((pages.page || 0) + 1)}>{lecture ? 'Lecture…' : 'Voir plus'}</button>}
      </div>
      {large && <div className="vrm-boite-lecture-col">
        {ouvert ? <Lecture key={ouvert} id={ouvert} entetes={entetes} delies={delies} onFermer={() => setOuvert('')} onAller={onAller} onNum={onNum} plein={false}/>
          : <p className="vrm-boite-vide-lecture">Choisis un e-mail pour le lire.</p>}
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
      {vue === 'boite' && <Boite headers={headers} delies={delies} onAller={onAller} onNum={onNum} FermeAuRetour={FermeAuRetour}/>}
      {vue === 'relier' && <RelierBoite onAdresses={onAdresses}/>}
    </section>
  );
}
