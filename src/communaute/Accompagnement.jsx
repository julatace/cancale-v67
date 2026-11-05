// ════════════════════════════════════════════════════════════════════════════
//  COMMUNAUTÉ → GROUPES : les groupes d'accompagnement « comme Skool » (5 nov.)
//  Migration 025 (PAS APPLIQUÉE tant que Julien ne l'a pas collée) : tant
//  qu'elle manque, l'écran le DIT et ne propose rien (aucun bouton, aucune
//  promesse). Ce que l'écran garantit, et ce que la BASE garantit derrière :
//   · créer un groupe (nom, description, le nom que voient les membres) ; un
//     CODE et un LIEN d'invitation ; « Nouveau code » rend l'ancien inutilisable ;
//   · rejoindre = DEMANDER : on voit d'abord ce qu'on rejoint, on choisit ce
//     qu'on partage (PAR DÉFAUT RIEN), le créateur accepte ou refuse ;
//   · le créateur voit, d'un membre ACCEPTÉ : rien · ses chiffres (semaine,
//     mois) · ses chiffres et le détail — ce que LE MEMBRE a choisi, révocable
//     à tout moment (effacé de la base, pas seulement caché) ;
//   · le membre voit EXACTEMENT ce que voit le créateur (la même vue, rendue
//     par la même règle de la base) ;
//   · le créateur retire un membre ; le membre part quand il veut ;
//   · trois états partout : chargement · pas su · lu — « pas encore publié »
//     n'est jamais « 0 ».
//  Les chiffres viennent des agrégats que l'app du membre publie
//  (src/communaute/accompagnement.js) : la base ne lit jamais ses données.
// ════════════════════════════════════════════════════════════════════════════
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NIVEAUX, STATUTS, codeLisible, codeTape, CODE_RE, lienInvitation, serieVue, etatVue, noterNiveau, publierPartage } from './accompagnement.js';

const PAS_SU = "Je n'ai pas pu lire tes groupes — rien n'est perdu, c'est la lecture qui a échoué.";
const eur = (n) => (n == null ? '—' : n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: n % 1 ? 2 : 0 }));
const eurC = (c) => (c == null ? '—' : eur(c / 100));
const date = (x) => { const t = typeof x === 'number' ? x : Date.parse(x || ''); return isFinite(t) && t > 0 ? new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—'; };
const dateHeure = (x) => { const t = Date.parse(x || ''); return isFinite(t) ? new Date(t).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''; };
const libNiveau = (p) => (NIVEAUX.find((n) => n[0] === p) || NIVEAUX[0])[1];
const copier = async (t) => { try { await navigator.clipboard.writeText(t); return true; } catch (_) { return false; } };

// ── LE CHOIX DU PARTAGE (à l'entrée, et ensuite) ─────────────────────────────
function ChoixPartage({ valeur, onChange, nomCreateur, desactive }) {
  return <fieldset className="vrm-cm-partage" data-cm-accomp-choix={valeur}>
    <legend>Ce que {nomCreateur || 'le créateur'} voit de toi</legend>
    {NIVEAUX.map(([k, t, d]) => <label key={k} className={'vrm-cm-partage-option' + (valeur === k ? ' pris' : '')}>
      <input type="radio" name="partage" value={k} checked={valeur === k} disabled={desactive} onChange={() => onChange(k)} data-cm-accomp-niveau={k} />
      <span><b>{t}</b><small>{d}</small></span>
    </label>)}
  </fieldset>;
}

// ── CE QUE VOIT LE CRÉATEUR (une vue, la même pour lui et pour le membre) ─────
export function VueMembre({ vue, pour = 'createur', nomCreateur = '' }) {
  const [pas, setPas] = useState('mois');
  const e = etatVue(vue);
  const serie = useMemo(() => (vue && vue.chiffres ? serieVue(vue.chiffres, pas) : null), [vue, pas]);
  const max = serie ? Math.max(1, ...serie.map((l) => l.ventes || 0)) : 1;
  const qui = pour === 'membre' ? 'Tu' : (vue && vue.nom) || 'Ce membre';
  if (e === 'pas-su') return <p className="vrm-cm-note" data-cm-accomp-vue="pas-su">{PAS_SU}</p>;
  return <div className="vrm-cm-vue" data-cm-accomp-vue={e}>
    {pour === 'membre' && <p className="vrm-cm-note">Voici, à l’identique, ce que {nomCreateur || 'le créateur'} voit de toi.</p>}
    <p className="vrm-cm-vue-tete"><b>{vue.nom}</b><span> · {STATUTS[vue.statut] || vue.statut} · partage : {libNiveau(vue.partage)}</span></p>
    {e === 'pas-membre' ? <p className="vrm-cm-note">Pas encore membre : aucun chiffre n’est visible avant la validation.</p>
      : e === 'rien' ? <p className="vrm-cm-note" data-cm-accomp-rien>{qui === 'Tu' ? 'Tu ne partages rien : seuls ton nom et ta présence dans le groupe sont visibles.' : `${qui} ne partage rien : tu vois seulement qu’il est dans le groupe.`}</p>
      : e === 'pas-publie' ? <p className="vrm-cm-note" data-cm-accomp-pas-publie>Partage accepté, mais aucun chiffre n’est encore arrivé : ils partent de {pour === 'membre' ? 'ton' : 'son'} VRM dès que ses ventes y sont lues (écran Ventes).</p>
      : <>
        <div className="vrm-cm-onglets vrm-cm-periodes" role="group" aria-label="Période">
          {[['mois', 'Par mois'], ['semaine', 'Par semaine']].map(([k, t]) => <button key={k} type="button" className="vrm-cm-onglet" aria-pressed={pas === k} onClick={() => setPas(k)} data-cm-accomp-pas={k}>{t}</button>)}
        </div>
        <table className="vrm-cm-tableau" data-cm-accomp-tableau={pas}>
          <thead><tr><th scope="col">{pas === 'mois' ? 'Mois' : 'Semaine'}</th><th scope="col">Ventes</th><th scope="col">Vendu</th><th scope="col">Achats</th><th scope="col">Dépensé</th></tr></thead>
          <tbody>{serie.map((l) => <tr key={l.cle} data-cm-accomp-ligne={l.cle} data-n={l.ventes == null ? '' : String(l.ventes)}>
            <th scope="row">{l.libelle}</th>
            <td><span className="vrm-cm-barre" style={{ '--p': l.ventes == null ? 0 : l.ventes / max }} aria-hidden="true" />{l.ventes == null ? '—' : l.ventes}</td>
            <td>{eur(l.ca)}</td><td>{l.achats == null ? '—' : l.achats}</td><td>{eur(l.depense)}</td>
          </tr>)}</tbody>
        </table>
        {(!vue.chiffres.ventes || !vue.chiffres.achats) && <p className="vrm-cm-note" data-cm-accomp-moitie>{!vue.chiffres.ventes ? 'Ventes' : 'Achats'} pas encore publiés depuis {pour === 'membre' ? 'ton' : 'son'} VRM : « — », jamais 0.</p>}
        {vue.chiffres.ventes && vue.chiffres.horsVc > 0 && <p className="vrm-cm-note" data-cm-accomp-hors-vc={vue.chiffres.horsVc}>Sans {vue.chiffres.horsVc} vente{vue.chiffres.horsVc > 1 ? 's' : ''} Vestiaire : {vue.chiffres.horsVc > 1 ? 'leur montant versé n’est pas encore connu, elles ne sont comptées' : 'son montant versé n’est pas encore connu, elle n’est comptée'} ni dans les ventes ni dans le vendu.</p>}
        <p className="vrm-cm-note">Ventes finalisées, toutes plateformes, datées au jour de la vente ; achats Vinted hors annulés. Publié le {dateHeure(vue.chiffres_le) || '—'}.</p>
        {e === 'detail' && (vue.detail ? <div data-cm-accomp-detail={vue.detail.ventes.length}>
          <h4>Ventes · {vue.detail.ventes.length > 1 ? `les ${vue.detail.ventes.length} plus récentes` : 'la plus récente'}</h4>
          {vue.detail.ventes.length === 0 ? <p className="vrm-cm-note">Aucune vente publiée.</p> :
            <ul className="vrm-cm-liste vrm-cm-detail">{vue.detail.ventes.slice(0, 50).map((l, i) => <li key={i} data-cm-accomp-vente>
              <div><b>{l[3] || 'Article'}</b><small>{date(l[0])} · {l[1]}{l[2] ? ' · ' + l[2] : ''}</small></div><span>{eurC(l[4])}</span></li>)}</ul>}
          <h4>Achats · {vue.detail.achats.length > 1 ? `les ${vue.detail.achats.length} plus récents` : 'le plus récent'}</h4>
          {vue.detail.achats.length === 0 ? <p className="vrm-cm-note">Aucun achat publié.</p> :
            <ul className="vrm-cm-liste vrm-cm-detail">{vue.detail.achats.slice(0, 50).map((l, i) => <li key={i} data-cm-accomp-achat>
              <div><b>{l[2] || 'Achat'}</b><small>{date(l[0])}{l[1] ? ' · ' + l[1] : ''}</small></div><span>{eurC(l[3])}</span></li>)}</ul>}
        </div> : <p className="vrm-cm-note" data-cm-accomp-detail-absent>Détail autorisé, pas encore publié.</p>)}
      </>}
  </div>;
}

// ── LES FEUILLES ─────────────────────────────────────────────────────────────
function Feuille({ titre, onFerme, FermeAuRetour, children, data }) {
  return <div className="vrm-cm-voile" onClick={(e) => { if (e.target === e.currentTarget) onFerme(); }}>
    <FermeAuRetour fermer={onFerme} />
    <div className="vrm-cm-feuille" role="dialog" aria-modal="true" aria-label={titre} {...data}>
      <div className="vrm-cm-feuille-tete"><h3>{titre}</h3><button type="button" className="vrm-cm-x" onClick={onFerme} aria-label="Fermer">×</button></div>
      {children}
    </div>
  </div>;
}

function Creer({ api, prenom, onFait, onFerme, FermeAuRetour }) {
  const [nom, setNom] = useState(''), [desc, setDesc] = useState(''), [moi, setMoi] = useState(String(prenom || '').slice(0, 40));
  const [msg, setMsg] = useState(''), [occupe, setOccupe] = useState(false);
  const envoyer = async (e) => {
    e.preventDefault(); setOccupe(true); setMsg('');
    const r = await api({ action: 'accomp-creer', nom: nom.trim(), description: desc.trim(), createur: moi.trim() });
    setOccupe(false);
    if (!r.ok) { setMsg(r.message || PAS_SU); return; }
    onFait(r);
  };
  return <Feuille titre="Créer un groupe" onFerme={onFerme} FermeAuRetour={FermeAuRetour} data={{ 'data-cm-accomp-feuille': 'creer' }}>
    <form onSubmit={envoyer}>
      <label className="vrm-cm-champ"><span>Nom du groupe</span><input value={nom} maxLength={60} onChange={(e) => setNom(e.target.value)} placeholder="Accompagnement novembre" data-cm-accomp-nom required /></label>
      <label className="vrm-cm-champ"><span>Description <small>(facultatif)</small></span><textarea value={desc} maxLength={500} rows={3} onChange={(e) => setDesc(e.target.value)} placeholder="Ce que les membres y trouvent." data-cm-accomp-description /></label>
      <label className="vrm-cm-champ"><span>Ton nom dans le groupe</span><input value={moi} maxLength={40} onChange={(e) => setMoi(e.target.value)} placeholder="Ton prénom" data-cm-accomp-createur required /></label>
      <p className="vrm-cm-note">Tu recevras un code et un lien. Chaque personne qui l’utilise te DEMANDE l’accès : rien ne se voit avant que tu valides, et seulement ce qu’elle choisit de partager.</p>
      {msg && <p className="vrm-cm-msg" role="alert">{msg}</p>}
      <button type="submit" className="vrm-cm-primaire" disabled={occupe || nom.trim().length < 2 || moi.trim().length < 2} data-cm-accomp-valider>{occupe ? 'Un instant…' : 'Créer le groupe'}</button>
    </form>
  </Feuille>;
}

function Rejoindre({ api, prenom, codeInitial = '', onFait, onFerme, FermeAuRetour }) {
  const [code, setCode] = useState(codeInitial), [apercu, setApercu] = useState(null);
  const [nom, setNom] = useState(String(prenom || '').slice(0, 40)), [partage, setPartage] = useState('rien');
  const [msg, setMsg] = useState(''), [occupe, setOccupe] = useState(false);
  const voir = useCallback(async (c) => {
    const t = codeTape(c);
    if (!CODE_RE.test(t)) { setMsg('Un code fait 8 caractères (lettres et chiffres), par exemple ABCD-2345.'); return; }
    setOccupe(true); setMsg('');
    const r = await api({ action: 'accomp-apercu', code: t });
    setOccupe(false);
    if (!r.ok) { setApercu(null); setMsg(r.message || PAS_SU); return; }
    setApercu({ ...r, code: t });
  }, [api]);
  useEffect(() => { if (codeInitial) voir(codeInitial); }, []);
  const demander = async () => {
    setOccupe(true); setMsg('');
    const r = await api({ action: 'accomp-demander', code: apercu.code, nom: nom.trim(), partage });
    setOccupe(false);
    if (!r.ok) { setMsg(r.message || PAS_SU); return; }
    onFait(r);
  };
  return <Feuille titre="Rejoindre un groupe" onFerme={onFerme} FermeAuRetour={FermeAuRetour} data={{ 'data-cm-accomp-feuille': 'rejoindre' }}>
    {!apercu ? <form onSubmit={(e) => { e.preventDefault(); voir(code); }}>
      <label className="vrm-cm-champ"><span>Le code du groupe</span><input value={code} maxLength={12} autoCapitalize="characters" autoComplete="off" onChange={(e) => setCode(e.target.value)} placeholder="ABCD-2345" data-cm-accomp-code-tape /></label>
      {msg && <p className="vrm-cm-msg" role="alert">{msg}</p>}
      <button type="submit" className="vrm-cm-primaire" disabled={occupe || !code.trim()} data-cm-accomp-voir>{occupe ? 'Un instant…' : 'Voir le groupe'}</button>
    </form> : <div data-cm-accomp-apercu={apercu.code}>
      <div className="vrm-cm-carton vrm-cm-apercu">
        <b>{apercu.nom}</b><small> · par {apercu.createur} · {apercu.membres} membre{apercu.membres > 1 ? 's' : ''}</small>
        {apercu.description && <p>{apercu.description}</p>}
      </div>
      {apercu.createur_moi ? <p className="vrm-cm-msg" role="alert">C’est ton propre groupe : tu en es le créateur.</p>
        : apercu.statut === 'attente' || apercu.statut === 'accepte' ? <p className="vrm-cm-msg" role="status">{apercu.statut === 'attente' ? 'Ta demande est déjà envoyée : elle attend la validation.' : 'Tu es déjà membre de ce groupe.'}</p>
        : <>
          <label className="vrm-cm-champ"><span>Ton nom dans le groupe</span><input value={nom} maxLength={40} onChange={(e) => setNom(e.target.value)} placeholder="Ton prénom" data-cm-accomp-moi required /></label>
          <ChoixPartage valeur={partage} onChange={setPartage} nomCreateur={apercu.createur} />
          <p className="vrm-cm-note">Tu pourras changer ce choix, ou tout retirer, quand tu veux. Rien n’est visible avant que {apercu.createur} accepte ta demande.</p>
          {msg && <p className="vrm-cm-msg" role="alert">{msg}</p>}
          <button type="button" className="vrm-cm-primaire" onClick={demander} disabled={occupe || nom.trim().length < 2} data-cm-accomp-demander>{occupe ? 'Un instant…' : 'Demander à rejoindre'}</button>
        </>}
    </div>}
  </Feuille>;
}

// ── UN GROUPE QUE J'AI CRÉÉ ──────────────────────────────────────────────────
function GroupeCree({ api, g, onFait, onVoir }) {
  const [copie, setCopie] = useState('');
  const attente = g.membres.filter((m) => m.statut === 'attente'), membres = g.membres.filter((m) => m.statut === 'accepte');
  const faire = async (corps, ok, confirmer) => {
    if (confirmer && !window.confirm(confirmer)) return;
    const r = await api(corps);
    onFait(r.ok ? ok : (r.message || PAS_SU));
  };
  const lien = lienInvitation(g.code);
  return <div className="vrm-cm-carton vrm-cm-groupe" data-cm-accomp-cree={g.id}>
    <div className="vrm-cm-groupe-tete">
      <div><h3>{g.nom}</h3><small>{membres.length} membre{membres.length > 1 ? 's' : ''}</small></div>
      {/* Ambre : un geste à faire (§7) — des demandes attendent SA validation. */}
      {attente.length > 0 && <span className="vrm-cm-etiquette attente" data-cm-accomp-a-valider={attente.length}>{attente.length} à valider</span>}
    </div>
    {g.description && <p className="vrm-cm-description">{g.description}</p>}
    <div className="vrm-cm-invitation">
      <span>Code <b className="vrm-cm-select" data-cm-accomp-code={g.code}>{codeLisible(g.code)}</b></span>
      <div className="vrm-cm-ligne-boutons">
        <button type="button" onClick={async () => setCopie((await copier(lien)) ? 'Lien copié ✓' : lien)} data-cm-accomp-copier-lien>Copier le lien</button>
        <button type="button" onClick={async () => setCopie((await copier(codeLisible(g.code))) ? 'Code copié ✓' : codeLisible(g.code))} data-cm-accomp-copier-code>Copier le code</button>
        <button type="button" className="vrm-cm-lien" onClick={() => faire({ action: 'accomp-code', groupe: g.id }, 'Nouveau code créé : l’ancien code et l’ancien lien ne marchent plus.', 'Créer un nouveau code ? L’ancien code et l’ancien lien ne marcheront plus (les membres restent).')} data-cm-accomp-nouveau-code>Nouveau code</button>
      </div>
      {copie && <small className="vrm-cm-note" role="status" data-cm-accomp-copie>{copie}</small>}
    </div>
    {attente.length > 0 && <div data-cm-accomp-demandes={attente.length}>
      <h4>Demandes à valider</h4>
      <ul className="vrm-cm-liste">{attente.map((m) => <li key={m.id} data-cm-accomp-demande={m.id}>
        <div><b>{m.nom}</b><small>Demande du {date(m.demande_le)} · partagerait : {libNiveau(m.partage)}</small></div>
        <div className="vrm-cm-ligne-boutons">
          <button type="button" className="vrm-cm-primaire" onClick={() => faire({ action: 'accomp-decider', membre: m.id, oui: true }, `${m.nom} fait partie du groupe.`)} data-cm-accomp-accepter>Accepter</button>
          <button type="button" onClick={() => faire({ action: 'accomp-decider', membre: m.id, oui: false }, `Demande de ${m.nom} refusée.`)} data-cm-accomp-refuser>Refuser</button>
        </div></li>)}</ul>
    </div>}
    <h4>Membres</h4>
    {membres.length === 0 ? <p className="vrm-cm-note" data-cm-accomp-aucun-membre>Personne pour l’instant. Envoie le lien ou le code à ceux que tu accompagnes : leur demande apparaîtra ici.</p>
      : <ul className="vrm-cm-liste">{membres.map((m) => <li key={m.id} data-cm-accomp-membre={m.id} data-partage={m.partage}>
        <div><b>{m.nom}</b><small>Partage : {libNiveau(m.partage)}{m.partage !== 'rien' && m.chiffres_le ? ` · à jour le ${date(m.chiffres_le)}` : ''}</small></div>
        <div className="vrm-cm-ligne-boutons">
          <button type="button" onClick={() => onVoir(m)} data-cm-accomp-voir-membre>Voir</button>
          <button type="button" className="vrm-cm-lien" onClick={() => faire({ action: 'accomp-retirer', membre: m.id }, `${m.nom} ne fait plus partie du groupe.`, `Retirer ${m.nom} du groupe ? Tu ne verras plus rien de lui ; il le verra.`)} data-cm-accomp-retirer>Retirer</button>
        </div></li>)}</ul>}
    <div className="vrm-cm-moderation">
      <button type="button" className="vrm-cm-lien" onClick={() => faire({ action: 'accomp-fermer', groupe: g.id }, `« ${g.nom} » est fermé.`, `Fermer « ${g.nom} » ? Plus personne ne pourra y entrer, et tu ne verras plus rien de ses membres.`)} data-cm-accomp-fermer>Fermer le groupe</button>
    </div>
  </div>;
}

// ── UN GROUPE QUE J'AI REJOINT ───────────────────────────────────────────────
function Adhesion({ api, a, onFait, onVoir }) {
  const [occupe, setOccupe] = useState(false);
  const vivant = !a.ferme && (a.statut === 'attente' || a.statut === 'accepte');
  const changer = async (p) => {
    if (p === a.partage) return;
    setOccupe(true);
    const r = await api({ action: 'accomp-partage', adhesion: a.id, partage: p });
    setOccupe(false);
    onFait(r.ok ? (p === 'rien' ? `Tu ne partages plus rien avec ${a.createur} : c’est effacé.` : `${a.createur} verra : ${libNiveau(p).toLowerCase()}.`) : (r.message || PAS_SU), r.ok ? r.niveau : undefined);
  };
  const quitter = async () => {
    if (!window.confirm(`Quitter « ${a.nom} » ? ${a.createur} ne verra plus rien de toi.`)) return;
    const r = await api({ action: 'accomp-quitter', adhesion: a.id });
    onFait(r.ok ? `Tu as quitté « ${a.nom} ».` : (r.message || PAS_SU));
  };
  const statut = a.ferme ? 'Groupe fermé par son créateur' : STATUTS[a.statut] || a.statut;
  return <div className="vrm-cm-carton vrm-cm-groupe" data-cm-accomp-rejoint={a.id} data-statut={a.ferme ? 'ferme' : a.statut}>
    <div className="vrm-cm-groupe-tete">
      <div><h3>{a.nom}</h3><small>par {a.createur} · {a.membres} membre{a.membres > 1 ? 's' : ''} · tu y es « {a.moi} »</small></div>
      <span className="vrm-cm-etiquette" data-cm-accomp-statut>{statut}</span>
    </div>
    {a.description && <p className="vrm-cm-description">{a.description}</p>}
    {vivant && <>
      <ChoixPartage valeur={a.partage} onChange={changer} nomCreateur={a.createur} desactive={occupe} />
      <div className="vrm-cm-ligne-boutons">
        <button type="button" onClick={() => onVoir(a)} data-cm-accomp-ce-que-voit>Voir ce que voit {a.createur}</button>
        <button type="button" className="vrm-cm-lien" onClick={quitter} data-cm-accomp-quitter>Quitter le groupe</button>
      </div>
    </>}
    {!vivant && <div className="vrm-cm-ligne-boutons"><button type="button" className="vrm-cm-lien" onClick={quitter} data-cm-accomp-quitter>Retirer de ma liste</button></div>}
  </div>;
}

// ── L'ONGLET ─────────────────────────────────────────────────────────────────
export default function Accompagnement({ api, headers, prenom = '', codeLien = '', portail, FermeAuRetour, onToast }) {
  const [etat, setEtat] = useState('charge'), [msg, setMsg] = useState('');
  const [d, setD] = useState(null);
  const [feuille, setFeuille] = useState(codeLien ? { type: 'rejoindre', code: codeLien } : null);
  const vivant = useRef(true);
  const lire = useCallback(async (discret) => {
    if (!discret) setEtat((e) => (e === 'lu' ? e : 'charge'));
    const r = await api({ action: 'accomp-lire' });
    if (!vivant.current) return;
    if (r.ok && r.accomp && Array.isArray(r.accomp.crees)) {
      setD(r.accomp); setEtat('lu');
      // Ce que l'app publie suit le niveau RENDU PAR LA BASE (jamais deviné ici).
      noterNiveau(r.accomp.niveau);
      if (r.accomp.niveau >= 1) publierPartage(headers, { publie: r.accomp.publie || null }).then((x) => { if (x === 'publie' && vivant.current) lire(true); });
      return;
    }
    if (discret && d) { setMsg(r.message || PAS_SU); return; }
    setEtat(r.erreur === 'non-installe' ? 'non-installe' : r.erreur === 'abonnement' ? 'abonnement' : 'pas-su'); setMsg(r.message || PAS_SU);
  }, [api, headers, d]);
  useEffect(() => { vivant.current = true; lire(); return () => { vivant.current = false; }; }, []);
  const fait = (t, niveau) => { onToast(t); if (niveau !== undefined) noterNiveau(niveau); lire(true); };
  const ouvrirVue = async (x, pour) => {
    if (pour === 'createur') { setFeuille({ type: 'vue', vue: x, pour }); return; }
    setFeuille({ type: 'vue', vue: undefined, pour, nomCreateur: x.createur });
    const r = await api({ action: 'accomp-vu', adhesion: x.id });
    setFeuille((f) => (f && f.type === 'vue' ? { ...f, vue: r.ok ? r.vue : null, msg: r.ok ? '' : (r.message || PAS_SU) } : f));
  };

  if (etat === 'charge') return <p role="status" className="vrm-cm-note" data-cm-accomp="charge">Lecture de tes groupes…</p>;
  if (etat !== 'lu') return <div className="vrm-cm-carton" data-cm-accomp={etat}>
    {etat === 'non-installe' ? <><b>Les groupes d’accompagnement ne sont pas encore activés sur ta base.</b><p>Ils s’ouvriront dès que la mise à jour de la base sera faite. D’ici là, rien n’est créé et rien n’est partagé.</p></>
      : etat === 'abonnement' ? <><b>Ton abonnement n’est pas actif.</b><p>Les groupes sont réservés aux abonnés.</p></>
      : <><b>{msg || PAS_SU}</b><button type="button" onClick={() => lire()} data-cm-accomp-reessayer>Réessayer</button></>}
  </div>;

  const publie = d.publie || {};
  return <div data-cm-accomp="lu" data-cm-accomp-partage-max={d.niveau}>
    <div className="vrm-cm-carton vrm-cm-accomp-intro">
      <div><p className="vrm-cm-note">Crée un groupe pour ceux que tu accompagnes, ou rejoins celui de ton coach. Chaque entrée est validée par le créateur ; chacun choisit ce qu’il partage — rien, par défaut.</p></div>
      <div className="vrm-cm-ligne-boutons">
        {/* L'accent est rare (§7) : plein seulement tant qu'il n'a aucun groupe. */}
        <button type="button" className={d.crees.length || d.rejoints.length ? '' : 'vrm-cm-primaire'} onClick={() => setFeuille({ type: 'creer' })} data-cm-accomp-creer>Créer un groupe</button>
        <button type="button" onClick={() => setFeuille({ type: 'rejoindre', code: '' })} data-cm-accomp-rejoindre>Rejoindre avec un code</button>
      </div>
    </div>
    {msg && <p className="vrm-cm-note" role="status">{msg}</p>}
    {d.crees.length > 0 && <section aria-label="Mes groupes" data-cm-accomp-crees={d.crees.length}>
      <h3 className="vrm-cm-section">Mes groupes</h3>
      {d.crees.map((g) => <GroupeCree key={g.id} api={api} g={g} onFait={fait} onVoir={(m) => ouvrirVue(m, 'createur')} />)}
    </section>}
    {d.rejoints.length > 0 && <section aria-label="Groupes rejoints" data-cm-accomp-rejoints={d.rejoints.length}>
      <h3 className="vrm-cm-section">Groupes rejoints</h3>
      {d.niveau >= 1 && <p className="vrm-cm-note" data-cm-accomp-publie={publie.chiffres_le ? 'oui' : 'non'}>{publie.chiffres_le ? `Tes chiffres partagés sont à jour du ${dateHeure(publie.chiffres_le)}.` : 'Tes chiffres partagés ne sont pas encore partis : ils partent dès que VRM a lu tes ventes (ouvre Ventes).'}</p>}
      {d.rejoints.map((a) => <Adhesion key={a.id} api={api} a={a} onFait={fait} onVoir={(x) => ouvrirVue(x, 'membre')} />)}
    </section>}
    {d.crees.length === 0 && d.rejoints.length === 0 && <div className="vrm-cm-carton vrm-cm-vide" data-cm-accomp-vide><b>Aucun groupe pour l’instant.</b><p>Crée le tien, ou demande le lien à la personne qui t’accompagne.</p></div>}

    {feuille && feuille.type === 'creer' && portail(<Creer api={api} prenom={prenom} FermeAuRetour={FermeAuRetour} onFerme={() => setFeuille(null)} onFait={(r) => { setFeuille(null); fait(`Groupe créé. Son code : ${codeLisible(r.code)} — envoie le lien à tes membres.`); }} />)}
    {feuille && feuille.type === 'rejoindre' && portail(<Rejoindre api={api} prenom={prenom} codeInitial={feuille.code} FermeAuRetour={FermeAuRetour} onFerme={() => setFeuille(null)} onFait={(r) => { setFeuille(null); fait(r.deja ? 'Tu es déjà dans ce groupe.' : `Demande envoyée à « ${r.nom} » : elle attend la validation.`); }} />)}
    {feuille && feuille.type === 'vue' && portail(<Feuille titre={feuille.pour === 'membre' ? `Ce que voit ${feuille.nomCreateur}` : (feuille.vue && feuille.vue.nom) || 'Membre'} FermeAuRetour={FermeAuRetour} onFerme={() => setFeuille(null)} data={{ 'data-cm-accomp-feuille': 'vue' }}>
      {feuille.vue === undefined ? <p role="status" className="vrm-cm-note">Lecture…</p> : feuille.vue === null ? <p className="vrm-cm-msg" role="alert">{feuille.msg || PAS_SU}</p>
        : <VueMembre vue={feuille.vue} pour={feuille.pour} nomCreateur={feuille.nomCreateur} />}
    </Feuille>)}
  </div>;
}
