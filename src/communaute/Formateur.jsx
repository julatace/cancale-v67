// ════════════════════════════════════════════════════════════════════════════
//  COMMUNAUTÉ → GROUPES : L'ESPACE FORMATEUR (10 nov., lot AR, migration 032)
//  Pour les créateurs de formation, posé SUR les groupes d'accompagnement (025) :
//   · Ma page : vrm.center/f/<adresse> (nom, présentation, groupes montrés) —
//     éteinte par défaut, « Publier » est SON geste ;
//   · par groupe : « Sur ma page », le suivi des élèves (chiffres seulement de
//     ceux qui les PARTAGENT, étapes seulement de ceux qui l'ACCEPTENT ; total
//     « au moins … · N sur M »), le programme (étapes), les annonces ;
//   · côté élève : annonces, programme à cocher, « Mon formateur voit mes
//     étapes » (NON par défaut, révocable).
//  Tant que la 032 manque : une ligne le dit, rien n'est proposé.
// ════════════════════════════════════════════════════════════════════════════
import React, { useEffect, useState } from 'react';
import { adresseDepuisNom, adresseOk, lienPage, suiviGroupe } from './formateur.js';
import { NIVEAUX } from './accompagnement.js';

const PAS_SU = "Je n'ai pas pu joindre la base — rien n'a changé.";
const eurC = (c) => (c == null ? '—' : (c / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }));
const jour = (x) => { const t = Date.parse(x || ''); return isFinite(t) ? new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''; };
const copier = async (t) => { try { await navigator.clipboard.writeText(t); return true; } catch (_) { return false; } };
const libNiveau = (p) => (NIVEAUX.find((n) => n[0] === p) || NIVEAUX[0])[1];

// Un interrupteur : une case native, 44 px, son libellé à gauche.
function Interrupteur({ coche, onChange, children, data, desactive }) {
  return <label className="vrm-cm-inter" {...data}>
    <span>{children}</span>
    <input type="checkbox" role="switch" checked={!!coche} disabled={desactive} onChange={(e) => onChange(e.target.checked)} />
  </label>;
}

// ── MA PAGE DE FORMATEUR ─────────────────────────────────────────────────────
export function MaPage({ api, page, prenom, onFait, ouvrirFeuille }) {
  const [copie, setCopie] = useState('');
  if (!page) return <div className="vrm-cm-carton vrm-cm-form-page" data-form-page="aucune">
    <h3>Ma page de formateur</h3>
    <p className="vrm-cm-note">Une page publique pour présenter tes groupes.</p>
    <button type="button" onClick={() => ouvrirFeuille({ type: 'page', page: null, prenom })} data-form-page-creer>Créer ma page</button>
  </div>;
  const lien = lienPage(page.adresse);
  return <div className="vrm-cm-carton vrm-cm-form-page" data-form-page={page.publiee ? 'publiee' : 'brouillon'}>
    <div className="vrm-cm-groupe-tete">
      <div><h3>Ma page de formateur</h3><small className="vrm-cm-select" data-form-page-lien={lien}>{lien.replace(/^https?:\/\//, '')}</small></div>
      <span className="vrm-cm-etiquette" data-form-page-etat>{page.publiee ? 'En ligne' : 'Pas en ligne'}</span>
    </div>
    <div className="vrm-cm-ligne-boutons">
      {page.publiee && <button type="button" onClick={async () => setCopie((await copier(lien)) ? 'Lien copié ✓' : lien)} data-form-page-copier>Copier le lien</button>}
      <button type="button" onClick={() => ouvrirFeuille({ type: 'page', page, prenom })} data-form-page-modifier>Modifier</button>
      <button type="button" className={page.publiee ? 'vrm-cm-lien' : ''} onClick={async () => {
        const r = await api({ action: 'form-page-ranger', adresse: page.adresse, nom: page.nom, presentation: page.presentation, publiee: !page.publiee });
        onFait(r.ok ? (page.publiee ? 'Ta page n’est plus en ligne.' : 'Ta page est en ligne.') : (r.message || PAS_SU));
      }} data-form-page-publier={page.publiee ? 'retirer' : 'publier'}>{page.publiee ? 'Retirer du web' : 'Mettre en ligne'}</button>
    </div>
    {copie && <small className="vrm-cm-note" role="status">{copie}</small>}
  </div>;
}

export function FeuillePage({ api, page, prenom, onFait }) {
  const [nom, setNom] = useState((page && page.nom) || String(prenom || '').slice(0, 40));
  const [adresse, setAdresse] = useState((page && page.adresse) || adresseDepuisNom(prenom));
  const [touche, setTouche] = useState(!!page);
  const [pres, setPres] = useState((page && page.presentation) || '');
  const [msg, setMsg] = useState(''), [occupe, setOccupe] = useState(false);
  const a = adresse.trim().toLowerCase();
  const envoyer = async (e) => {
    e.preventDefault(); setOccupe(true); setMsg('');
    const r = await api({ action: 'form-page-ranger', adresse: a, nom: nom.trim(), presentation: pres.trim(), publiee: !!(page && page.publiee) });
    setOccupe(false);
    if (!r.ok) { setMsg(r.message || PAS_SU); return; }
    onFait(page ? 'Ta page est à jour.' : 'Ta page est prête. Mets-la en ligne quand tu veux.');
  };
  return <form onSubmit={envoyer} data-form-feuille-page>
    <label className="vrm-cm-champ"><span>Ton nom de formateur</span><input value={nom} maxLength={40} onChange={(e) => { setNom(e.target.value); if (!touche) setAdresse(adresseDepuisNom(e.target.value)); }} data-form-nom required /></label>
    <label className="vrm-cm-champ"><span>Adresse de ta page</span><input value={adresse} maxLength={30} autoCapitalize="none" autoComplete="off" onChange={(e) => { setTouche(true); setAdresse(e.target.value); }} data-form-adresse required />
      <small className="vrm-cm-note">vrm.center/f/{a || '…'}</small></label>
    <label className="vrm-cm-champ"><span>Présentation <small>(facultatif)</small></span><textarea value={pres} maxLength={600} rows={4} onChange={(e) => setPres(e.target.value)} placeholder="Ce que tu apprends à tes élèves." data-form-presentation /></label>
    <p className="vrm-cm-note">Aucun chiffre d’élève n’y paraît. Jamais.</p>
    {msg && <p className="vrm-cm-msg" role="alert">{msg}</p>}
    <button type="submit" className="vrm-cm-primaire" disabled={occupe || nom.trim().length < 2 || !adresseOk(a)} data-form-page-valider>{occupe ? 'Un instant…' : 'Enregistrer'}</button>
  </form>;
}

// ── LES OUTILS DU FORMATEUR, DANS UN GROUPE QU'IL A CRÉÉ ─────────────────────
export function OutilsFormateur({ api, g, f, pagePubliee, onFait }) {
  const [onglet, setOnglet] = useState('suivi');
  const [titre, setTitre] = useState(''), [texte, setTexte] = useState(''), [occupe, setOccupe] = useState(false);
  const s = suiviGroupe(g.membres, f);
  const faire = async (corps, ok, apres) => { setOccupe(true); const r = await api(corps); setOccupe(false); if (r.ok && apres) apres(); onFait(r.ok ? ok : (r.message || PAS_SU)); };
  return <div className="vrm-cm-form" data-form-groupe={g.id}>
    <Interrupteur coche={f.vitrine} desactive={occupe} onChange={(oui) => faire({ action: 'form-vitrine', groupe: g.id, montre: oui }, oui ? (pagePubliee ? 'Le groupe est sur ta page.' : 'Le groupe ira sur ta page, une fois en ligne.') : 'Le groupe n’est plus sur ta page.')} data={{ 'data-form-vitrine': f.vitrine ? 'oui' : 'non' }}>Sur ma page publique</Interrupteur>
    <div className="vrm-cm-onglets vrm-cm-periodes" role="group" aria-label="Outils du formateur">
      {[['suivi', 'Suivi'], ['programme', 'Programme'], ['annonces', 'Annonces']].map(([k, t]) => <button key={k} type="button" className="vrm-cm-onglet" aria-pressed={onglet === k} onClick={() => setOnglet(k)} data-form-onglet={k}>{t}</button>)}
    </div>
    {onglet === 'suivi' && <div data-form-suivi={s.eleves}>
      {s.eleves === 0 ? <p className="vrm-cm-note">Aucun élève accepté pour l’instant.</p> : <>
        <p className="vrm-cm-form-total" data-form-total-ventes={s.ventes == null ? '' : String(s.ventes)} data-form-couverture={`${s.partagent}/${s.eleves}`}>
          <b>{s.ventes == null ? '—' : (s.complet ? '' : 'Au moins ') + s.ventes + ' vente' + (s.ventes > 1 ? 's' : '')}</b>
          <span> ce mois · {s.partagent} élève{s.partagent > 1 ? 's' : ''} sur {s.eleves} partage{s.partagent > 1 ? 'nt' : ''}</span>
        </p>
        <ul className="vrm-cm-liste vrm-cm-form-eleves">{s.lignes.map((l) => <li key={l.id} data-form-eleve={l.id} data-chiffres={l.chiffres} data-etapes={l.etapes}>
          <div><b>{l.nom}</b><small>{libNiveau(l.partage)}</small></div>
          <div className="vrm-cm-form-cases">
            <span data-form-ventes={l.ventes == null ? '' : String(l.ventes)}>{l.chiffres === 'lu' ? <><b>{l.ventes}</b> · {eurC(l.ca)}</> : l.chiffres === 'attente' ? 'Pas encore reçu' : 'Ne partage pas'}</span>
            {l.etapes !== 'aucune' && <span data-form-faits={l.faits == null ? '' : String(l.faits)}>{l.etapes === 'lu' ? `${l.faits}/${l.total} étapes` : 'Étapes privées'}</span>}
          </div>
        </li>)}</ul>
      </>}
    </div>}
    {onglet === 'programme' && <div data-form-programme={f.etapes.length}>
      {f.etapes.length === 0 ? <p className="vrm-cm-note">Ajoute les étapes de ta formation.</p>
        : <ol className="vrm-cm-liste vrm-cm-form-etapes">{f.etapes.map((e) => <li key={e.id} data-form-etape={e.id}><span>{e.titre}</span>
          <button type="button" className="vrm-cm-lien" disabled={occupe} onClick={() => faire({ action: 'form-etape-retirer', etape: e.id }, 'Étape retirée.')} data-form-etape-retirer>Retirer</button></li>)}</ol>}
      <form className="vrm-cm-form-ajout" onSubmit={(e) => { e.preventDefault(); faire({ action: 'form-etape', groupe: g.id, titre: titre.trim() }, 'Étape ajoutée.', () => setTitre('')); }}>
        <input value={titre} maxLength={80} onChange={(e) => setTitre(e.target.value)} placeholder="Ex. : première vente" aria-label="Nouvelle étape" data-form-etape-titre />
        <button type="submit" disabled={occupe || titre.trim().length < 2} data-form-etape-ajouter>Ajouter</button>
      </form>
    </div>}
    {onglet === 'annonces' && <div data-form-annonces={f.annonces.length}>
      <form className="vrm-cm-form-ajout vrm-cm-form-annonce" onSubmit={(e) => { e.preventDefault(); faire({ action: 'form-annonce', groupe: g.id, texte: texte.trim() }, 'Annonce envoyée au groupe.', () => setTexte('')); }}>
        <textarea value={texte} maxLength={1000} rows={3} onChange={(e) => setTexte(e.target.value)} placeholder="Un mot pour tes élèves." aria-label="Nouvelle annonce" data-form-annonce-texte />
        <button type="submit" disabled={occupe || !texte.trim()} data-form-annonce-envoyer>Publier</button>
      </form>
      <ul className="vrm-cm-liste">{f.annonces.map((x) => <li key={x.id} data-form-annonce={x.id}>
        <div><span className="vrm-cm-form-texte">{x.texte}</span><small>{jour(x.le)}</small></div>
        <button type="button" className="vrm-cm-lien" disabled={occupe} onClick={() => faire({ action: 'form-annonce-retirer', annonce: x.id }, 'Annonce retirée.')} data-form-annonce-retirer>Retirer</button></li>)}</ul>
    </div>}
  </div>;
}

// ── CÔTÉ ÉLÈVE, DANS UN GROUPE ACCEPTÉ ───────────────────────────────────────
export function OutilsEleve({ api, r, createur, onFait }) {
  const [occupe, setOccupe] = useState(false);
  const faits = new Set(r.faits || []);
  const faire = async (corps, ok) => { setOccupe(true); const x = await api(corps); setOccupe(false); onFait(x.ok ? ok : (x.message || PAS_SU)); };
  if (!r.etapes.length && !r.annonces.length) return null;
  return <div className="vrm-cm-form" data-form-eleve-groupe={r.groupe}>
    {r.annonces.length > 0 && <div data-form-eleve-annonces={r.annonces.length}>
      <h4>Annonces</h4>
      <ul className="vrm-cm-liste">{r.annonces.slice(0, 5).map((x) => <li key={x.id} data-form-eleve-annonce={x.id}><div><span className="vrm-cm-form-texte">{x.texte}</span><small>{jour(x.le)}</small></div></li>)}</ul>
    </div>}
    {r.etapes.length > 0 && <div data-form-eleve-programme={`${faits.size}/${r.etapes.length}`}>
      <h4>Programme · {faits.size}/{r.etapes.length}</h4>
      <ul className="vrm-cm-liste vrm-cm-form-coches">{r.etapes.map((e) => <li key={e.id}>
        <label className="vrm-cm-form-coche"><input type="checkbox" checked={faits.has(e.id)} disabled={occupe} onChange={(ev) => faire({ action: 'form-cocher', adhesion: r.adhesion, etape: e.id, fait: ev.target.checked }, ev.target.checked ? 'Étape cochée.' : 'Étape décochée.')} data-form-cocher={e.id} /><span>{e.titre}</span></label>
      </li>)}</ul>
      <Interrupteur coche={r.accord} desactive={occupe} onChange={(oui) => faire({ action: 'form-accord', adhesion: r.adhesion, etapes: oui }, oui ? `${createur} voit tes étapes.` : `${createur} ne voit plus tes étapes.`)} data={{ 'data-form-accord': r.accord ? 'oui' : 'non' }}>{createur} voit mes étapes</Interrupteur>
    </div>}
  </div>;
}

// ── REJOINDRE DEPUIS LA PAGE PUBLIQUE ────────────────────────────────────────
export function RejoindrePage({ api, lien, prenom, ChoixPartage, onFait }) {
  const [p, setP] = useState(undefined), [msg, setMsg] = useState('');
  const [nom, setNom] = useState(String(prenom || '').slice(0, 40)), [partage, setPartage] = useState('rien'), [occupe, setOccupe] = useState(false);
  useEffect(() => { (async () => { const r = await api({ action: 'form-page', adresse: lien.adresse }); setP(r.ok ? r : null); if (!r.ok) setMsg(r.message || PAS_SU); })(); }, []);
  const g = p && Array.isArray(p.groupes) ? p.groupes.find((x) => x.id === lien.groupe) : null;
  if (p === undefined) return <p role="status" className="vrm-cm-note">Lecture…</p>;
  if (!g) return <p className="vrm-cm-msg" role="alert" data-form-rejoindre="introuvable">{msg || 'Ce groupe n’est plus sur la page du formateur.'}</p>;
  const demander = async () => {
    setOccupe(true); setMsg('');
    const r = await api({ action: 'form-demander', adresse: lien.adresse, groupe: g.id, nom: nom.trim(), partage });
    setOccupe(false);
    if (!r.ok) { setMsg(r.message || PAS_SU); return; }
    onFait(r);
  };
  return <div data-form-rejoindre={g.id}>
    <div className="vrm-cm-carton vrm-cm-apercu"><b>{g.nom}</b><small> · par {p.nom}</small>{g.description && <p>{g.description}</p>}</div>
    <label className="vrm-cm-champ"><span>Ton nom dans le groupe</span><input value={nom} maxLength={40} onChange={(e) => setNom(e.target.value)} placeholder="Ton prénom" data-cm-accomp-moi required /></label>
    <ChoixPartage valeur={partage} onChange={setPartage} nomCreateur={p.nom} />
    <p className="vrm-cm-note">{p.nom} valide ta demande. Tu changes ce choix quand tu veux.</p>
    {msg && <p className="vrm-cm-msg" role="alert">{msg}</p>}
    <button type="button" className="vrm-cm-primaire" onClick={demander} disabled={occupe || nom.trim().length < 2} data-form-demander>{occupe ? 'Un instant…' : 'Demander à rejoindre'}</button>
  </div>;
}
