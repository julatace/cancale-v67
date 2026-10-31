// ── « TES EMAILS, CE QUE VRM EN A FAIT » (31 oct.) ─────────────────────────
// Pour chaque email reçu, le plus récent d'abord : de qui, ce que c'est, ce que
// VRM en a fait, son état (✓ rangé · ⚠ à vérifier · ✗ pas compris · ↻ en
// attente de réessai), la raison et le geste quand il y a quelque chose à faire.
// La phrase vient d'UNE règle (src/journalEmail.js) lue sur le résumé écrit au
// classement (api/_lib/resume-email.js).
//
// ⚠️ « Sauf si c'est trop lourd en données » (Julien) : une page = 20 emails en
//    scalaires projetés ; le texte d'un email ne se lit QUE sur « Voir le
//    texte », un email à la fois ; aucune relecture automatique.
// ⚠️ Le texte s'affiche en TEXTE (React l'échappe) : aucun HTML actif.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { lectureEmail, ETATS_JOURNAL, FILTRES_TYPE } from './journalEmail.js';
import { requeteJsonBornee } from './requeteJsonBornee.js';
import './journal-emails.css';

const quand = (v) => { const t = Date.parse(v || ''); return Number.isFinite(t) ? new Date(t).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'date non lue'; };
const formeOk = (j) => j && j.ok === true && Array.isArray(j.emails) && j.compteurs && typeof j.compteurs.sur === 'number';

function TexteEmail({ id, headers }) {
  const [t, setT] = useState(undefined); // undefined en cours · null pas su · {texte}
  useEffect(() => {
    let vivant = true;
    (async () => {
      try {
        const r = await requeteJsonBornee(`/api/email-rattacher?mode=journal&texte=${encodeURIComponent(id)}`, { headers: headers(), cache: 'no-store' });
        if (!vivant) return;
        setT(r.ok && r.json && r.json.ok === true && r.json.id === id ? { texte: typeof r.json.texte === 'string' ? r.json.texte : null } : null);
      } catch (_) { if (vivant) setT(null); }
    })();
    return () => { vivant = false; };
  }, [id, headers]);
  if (t === undefined) return <p className="vrm-journal-texte-etat" role="status">Lecture du texte…</p>;
  if (t === null) return <p className="vrm-journal-texte-etat" role="alert" data-journal-texte="pas-su">Je n’ai pas pu lire le texte de cet email — rien n’est perdu, réessaie dans un moment.</p>;
  if (!t.texte) return <p className="vrm-journal-texte-etat" data-journal-texte="absent">Texte non gardé (email classé avant le 31 oct.). L’original reste dans ta messagerie.</p>;
  return <pre className="vrm-journal-texte" data-journal-texte="lu">{t.texte}</pre>;
}

function LigneEmail({ e, headers, delies, onNav, onNum, onDelier, onRelier }) {
  const l = lectureEmail(e, delies);
  const [texte, setTexte] = useState(false);
  const etat = ETATS_JOURNAL[l.etat] || ETATS_JOURNAL.verifier;
  return (
    <li className="vrm-journal-ligne" data-journal-email={e.id} data-etat={l.etat} data-type={e.resume ? e.resume.t : 'ancien'}>
      <div className="vrm-journal-tete">
        <span className="vrm-journal-etat" data-etat={l.etat}><span aria-hidden="true">{etat.picto}</span> {etat.mot}</span>
        <span className="vrm-journal-de">{l.de} · <time dateTime={e.at || ''}>{quand(e.sourceDate || e.at)}</time>{e.compte ? ` · ${e.compte.nom}` : ''}</span>
      </div>
      <p className="vrm-journal-quoi" data-journal-quoi="">{l.quoi}</p>
      <p className="vrm-journal-fait" data-journal-fait="">{l.fait}</p>
      {(l.raison || l.geste) && <div className="vrm-journal-raison" data-journal-raison="">
        {l.raison && <p>{l.raison}</p>}
        {l.geste && <p><b>À faire :</b> {l.geste}</p>}
      </div>}
      <div className="vrm-journal-gestes">
        {l.lien && <button type="button" data-journal-lien={l.lien.tab} onClick={() => onNav && onNav(l.lien.tab)}>{l.lien.label} <span aria-hidden="true">→</span></button>}
        {l.num && <button type="button" data-journal-num={l.num} onClick={() => onNum && onNum(l.num)}>Tout sur le N°{l.num}</button>}
        <button type="button" aria-expanded={texte} data-journal-voir="" onClick={() => setTexte((v) => !v)}>{texte ? 'Masquer le texte' : 'Voir le texte'}</button>
        {l.delier && l.delier.offert && !l.delier.delie && <button type="button" data-journal-delier={l.delier.id} onClick={() => onDelier && onDelier(l.delier.id, l.delier.tx)}>Ce n’est pas ça</button>}
        {l.delier && l.delier.offert && l.delier.delie && <button type="button" data-journal-relier={l.delier.id} onClick={() => onRelier && onRelier(l.delier.id)}>Relier à nouveau</button>}
      </div>
      {l.delier && l.delier.offert && l.delier.delie && <p className="vrm-journal-note">Ce reçu n’apparaît plus sur l’achat n° {l.delier.tx}. Rien n’est supprimé : « Relier à nouveau » le remet.</p>}
      {l.delier && !l.delier.offert && l.delier.pourquoi && <details className="vrm-journal-pourquoi"><summary>Et si ce n’est pas ça ?</summary><p>{l.delier.pourquoi}</p></details>}
      {texte && <TexteEmail id={e.id} headers={headers}/>}
    </li>
  );
}

export default function JournalEmails({ headers, filtreInitial = '', delies = {}, onNav, onNum, onDelier, onRelier, version = 0 }) {
  const [etat, setEtat] = useState(filtreInitial === 'a-verifier' || filtreInitial === 'erreur' ? filtreInitial : '');
  const [type, setType] = useState('');
  const [adresse, setAdresse] = useState('');
  const [pages, setPages] = useState(undefined); // undefined en cours · null pas su · {emails,...}
  const [lecture, setLecture] = useState(false);
  const gen = useRef(0);
  const auth = useRef(headers); auth.current = headers;
  const entetes = useCallback(() => (auth.current ? auth.current() : {}), []);

  const charger = useCallback(async (page = 0) => {
    const g = ++gen.current;
    setLecture(true);
    if (page === 0) setPages(undefined);
    try {
      const q = new URLSearchParams({ mode: 'journal', page: String(page) });
      if (etat) q.set('etat', etat); if (type) q.set('type', type); if (adresse) q.set('adresse', adresse);
      const r = await requeteJsonBornee(`/api/email-rattacher?${q}`, { headers: entetes(), cache: 'no-store' });
      if (g !== gen.current) return;
      if (!r.ok || !formeOk(r.json)) { if (page === 0) setPages(null); else setPages((p) => (p ? { ...p, suiteKO: true } : p)); return; }
      const j = r.json;
      setPages((p) => (page === 0 || !p ? { ...j, emails: j.emails } : { ...j, emails: [...p.emails, ...j.emails.filter((x) => !p.emails.some((y) => y.id === x.id))] }));
    } catch (_) { if (g === gen.current) { if (page === 0) setPages(null); else setPages((p) => (p ? { ...p, suiteKO: true } : p)); } }
    finally { if (g === gen.current) setLecture(false); }
  }, [etat, type, adresse, entetes]);

  useEffect(() => { charger(0); }, [charger, version]);
  useEffect(() => { if (filtreInitial === 'a-verifier' || filtreInitial === 'erreur') setEtat(filtreInitial); }, [filtreInitial]);

  const c = pages && pages.compteurs;
  const segments = [['', 'Tout'], ['a-verifier', 'À vérifier'], ['erreur', 'À réessayer']];
  return (
    <section className="vrm-journal" data-journal-emails="" aria-label="Tes emails, ce que VRM en a fait">
      <header className="vrm-journal-entete">
        <div>
          <h3>Tes emails, ce que VRM en a fait</h3>
          <p>Le plus récent d’abord. Ce qui demande un geste est en ambre, avec la raison.</p>
        </div>
        <button type="button" className="vrm-journal-actualiser" onClick={() => charger(0)} disabled={lecture}>{lecture ? 'Lecture…' : 'Actualiser'}</button>
      </header>
      <div className="vrm-journal-filtres" role="group" aria-label="Filtrer les emails">
        <div className="vrm-journal-segments">
          {segments.map(([k, mot]) => {
            const n = !c ? null : k === 'a-verifier' ? c.aVerifier : k === 'erreur' ? c.erreur : null;
            if (k === 'erreur' && !(n > 0) && etat !== 'erreur') return null;
            return <button key={k || 'tout'} type="button" aria-pressed={etat === k} data-journal-filtre={k || 'tout'} data-n={n == null ? '' : n} onClick={() => setEtat(k)}>
              {mot}{n > 0 && <b className={k === 'a-verifier' ? 'vrm-journal-n-ambre' : ''}>{n}</b>}
            </button>;
          })}
        </div>
        <label className="vrm-journal-choix"><span>Type</span>
          <select value={type} onChange={(ev) => setType(ev.target.value)} data-journal-type="">
            {FILTRES_TYPE.map(([k, mot]) => <option key={k || 'tous'} value={k}>{mot}</option>)}
          </select>
        </label>
        {pages && Array.isArray(pages.adresses) && pages.adresses.length > 0 && <label className="vrm-journal-choix"><span>Compte / adresse</span>
          <select value={adresse} onChange={(ev) => setAdresse(ev.target.value)} data-journal-adresse="">
            <option value="">Tous mes comptes</option>
            {pages.adresses.map((a) => <option key={a.adresse} value={a.adresse}>{a.nom ? `${a.nom} · ` : ''}{a.adresse}</option>)}
          </select>
        </label>}
      </div>
      {pages === undefined && <p className="vrm-journal-vide" role="status">Lecture du journal…</p>}
      {pages === null && <p className="vrm-journal-vide" role="alert" data-journal="pas-su">Je n’ai pas pu lire le journal de tes emails — rien n’est perdu, ils restent rangés. <button type="button" onClick={() => charger(0)}>Réessayer</button></p>}
      {pages && <>
        {c && <p className="vrm-journal-couverture" data-journal-sur={c.sur}>Sur les {c.sur} derniers emails suivis{c.plus ? ' (les plus anciens ne sont pas comptés)' : ''} : {c.integre} rangés · {c.aVerifier} à vérifier{c.incompris ? ` (dont ${c.incompris} pas compris)` : ''}{c.erreur ? ` · ${c.erreur} en attente de réessai` : ''}.</p>}
        {pages.emails.length === 0 && <p className="vrm-journal-vide" data-journal="vide">{etat || type || adresse ? 'Aucun email pour ce filtre.' : 'Aucun email suivi pour l’instant. Le prochain email reçu apparaîtra ici.'}</p>}
        <ul className="vrm-journal-liste">
          {pages.emails.map((e) => <LigneEmail key={e.id} e={e} headers={entetes} delies={delies} onNav={onNav} onNum={onNum} onDelier={onDelier} onRelier={onRelier}/>)}
        </ul>
        {pages.suiteKO && <p className="vrm-journal-vide" role="alert">La suite n’a pas pu être lue. Réessaie.</p>}
        {pages.suite && <button type="button" className="vrm-journal-plus" data-journal-plus="" disabled={lecture} onClick={() => charger((pages.page || 0) + 1)}>{lecture ? 'Lecture…' : 'Voir plus'}</button>}
      </>}
    </section>
  );
}

// Le compteur « à vérifier » pour Colis : une lecture (les compteurs seuls, deux
// scalaires par email), au montage, jamais relue toute seule. Pas su ⇒ le lien
// reste, sans chiffre (« pas su » n'est pas « 0 »).
export function EntreeJournalEmails({ headers, onOuvrir }) {
  const [n, setN] = useState(undefined);
  useEffect(() => {
    let vivant = true;
    (async () => {
      try {
        const r = await requeteJsonBornee('/api/email-rattacher?mode=journal&compte=1', { headers: headers ? headers() : {}, cache: 'no-store' });
        if (vivant) setN(r.ok && r.json && r.json.ok === true && r.json.compteurs && typeof r.json.compteurs.aVerifier === 'number' ? r.json.compteurs.aVerifier : null);
      } catch (_) { if (vivant) setN(null); }
    })();
    return () => { vivant = false; };
  }, [headers]);
  return (
    <div className="vrm-journal-entree" data-journal-entree="" data-n={n == null ? '' : n}>
      <button type="button" onClick={() => onOuvrir && onOuvrir(n > 0 ? 'a-verifier' : '')}>
        <span>Tes emails, ce que VRM en a fait</span>
        {n > 0 ? <b className="vrm-journal-n-ambre">{n} à vérifier</b> : <span aria-hidden="true">→</span>}
      </button>
    </div>
  );
}
