// ════════════════════════════════════════════════════════════════════════════
//  COMMUNAUTÉ → GROUPES : les groupes d'accompagnement « comme Skool » (5 nov.)
//  refaits le 17 nov. (Julien : « améliore la création de groupe
//  d'accompagnement ; que les personnes puissent se faire coucou, mais pas
//  échanger des messages dans mon app, mais sur Discord »).
//
//  Migration 025 (APPLIQUÉE le 10 nov.) : tant qu'elle manque, l'écran le DIT
//  et ne propose rien. Migration 046 (PAS APPLIQUÉE) : la photo, le lien
//  Discord du groupe et le COUCOU — tant qu'elle manque, « bientôt disponible »,
//  et le reste marche comme avant.
//
//  CE QUI NE CHANGE PAS (la base le garantit, l'écran ne fait que le montrer) :
//   · rejoindre = DEMANDER ; le créateur accepte ou refuse ; il retire ; le
//     membre part quand il veut ;
//   · le partage, choisi par le MEMBRE, PAR DÉFAUT RIEN (rien · chiffres ·
//     détail), révocable à tout moment (effacé de la base) ; le membre voit
//     EXACTEMENT ce que voit le créateur ; trois états partout, « — » jamais 0.
//
//  CE QUI CHANGE :
//   · CRÉER en trois étapes (feuille guidée) : 1. nom, phrase, photo ;
//     2. qui entre (sur invitation, il valide) et ce qu'on partage (rien par
//     défaut — dit, pas réglable : c'est le membre qui choisit) ; 3. inviter :
//     le lien, le QR code, « Partager » (feuille de partage d'iOS), et le lien
//     de son serveur ou salon Discord, s'il veut ;
//   · la PAGE DU GROUPE : photo, nom, « Ouvrir sur Discord », demandes à
//     valider, membres (toucher un membre ⇒ ce qu'il partage, coucou, retirer) ;
//   · LE COUCOU 👋 : un toucher, AUCUN champ de texte, aucun contenu. Celui qui
//     le reçoit le voit ici et en notification, avec UN geste : « Lui écrire sur
//     Discord » (son profil s'il l'a relié, sinon le salon du groupe, sinon
//     « Pas de Discord lié »). Aucune réponse dans l'app. Un par paire et par
//     24 h, 20 par jour ; couper quelqu'un ; seulement dans un même groupe.
//  Tout texte visible passe par tr() (src/i18n/langues/*/groupes.js).
// ════════════════════════════════════════════════════════════════════════════
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import qrcode from 'qrcode-generator';
import { EtatPanne } from '../composants/EtatPanne.jsx';
import Pourquoi from '../composants/PourquoiReplie.jsx';
import { tr, date as dateLoc, heure as heureLoc, monnaie, dateRelative } from '../i18n/index.js';
import { useLangue } from '../i18n/react.js';
import { codeLisible, codeTape, CODE_RE, lienInvitation, serieVue, etatVue, noterNiveau, publierPartage } from './accompagnement.js';
import { coucousLus, etatCoucou, lienDiscordGroupe, photoCarree } from './coucou.js';
// (10 nov., lot AR) L'espace formateur (032) : page publique, suivi, programme, annonces.
import { MaPage, FeuillePage, OutilsFormateur, OutilsEleve, RejoindrePage } from './Formateur.jsx';
import './groupes.css';

const NIVEAUX_CLES = ['rien', 'chiffres', 'detail'];
const pasSu = () => tr('grp.pasSu');
const eur = (n) => (n == null ? '—' : monnaie(n, 'EUR', { maximumFractionDigits: n % 1 ? 2 : 0 }));
const eurC = (c) => (c == null ? '—' : eur(c / 100));
const jourCourt = (x) => { const t = typeof x === 'number' ? x : Date.parse(x || ''); return isFinite(t) && t > 0 ? dateLoc(t, { day: 'numeric', month: 'short' }) : '—'; };
const jourHeure = (x) => { const t = Date.parse(x || ''); return isFinite(t) ? `${dateLoc(t, { day: 'numeric', month: 'short' })} · ${heureLoc(t)}` : ''; };
const ilYa = (x) => {
  const t = Date.parse(x || ''); if (!isFinite(t)) return '';
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 60) return dateRelative(-Math.max(1, m), 'minute');
  if (m < 48 * 60) return dateRelative(-Math.round(m / 60), 'hour');
  return dateRelative(-Math.round(m / 1440), 'day');
};
const libNiveau = (p) => tr('grp.niveau.' + (NIVEAUX_CLES.includes(p) ? p : 'rien') + '.t');
const libStatut = (s) => (['attente', 'accepte', 'refuse', 'retire', 'parti'].includes(s) ? tr('grp.statut.' + s) : s);
const copier = async (t) => { try { await navigator.clipboard.writeText(t); return true; } catch (_) { return false; } };
const partagePossible = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function';

// ── LA VIGNETTE D'UN GROUPE : sa photo, sinon ses initiales ──────────────────
function Vignette({ photo, nom, grande = false }) {
  const init = Array.from(String(nom || '').trim()).filter((c) => /[\p{L}\p{N}]/u.test(c)).slice(0, 2).join('').toLocaleUpperCase();
  return <span className={'vrm-gc-vignette' + (grande ? ' grande' : '')} aria-hidden="true">
    {photo ? <img src={photo} alt="" /> : <span>{init || '·'}</span>}
  </span>;
}

// ── LE QR CODE DU LIEN (dessiné ici, aucun service extérieur) ────────────────
function QrLien({ texte }) {
  const d = useMemo(() => {
    try {
      const q = qrcode(0, 'M'); q.addData(texte, 'Byte'); q.make();
      const n = q.getModuleCount(); let p = '';
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) p += `M${x} ${y}h1v1h-1z`;
      return { n, p };
    } catch (_) { return null; }
  }, [texte]);
  if (!d) return null;
  // Toujours noir sur blanc (même la nuit) : un QR se lit par contraste.
  return <div className="vrm-gc-qr" data-cm-accomp-qr={texte}>
    <svg viewBox={`-2 -2 ${d.n + 4} ${d.n + 4}`} role="img" aria-label={tr('grp.inviter.qrAria')} shapeRendering="crispEdges">
      <rect x="-2" y="-2" width={d.n + 4} height={d.n + 4} fill="#fff" /><path d={d.p} fill="#000" />
    </svg>
  </div>;
}

// ── LE CHOIX DU PARTAGE (à l'entrée, et ensuite) ─────────────────────────────
function ChoixPartage({ valeur, onChange, nomCreateur, desactive }) {
  return <fieldset className="vrm-cm-partage" data-cm-accomp-choix={valeur}>
    <legend>{tr('grp.partage.legende', { nom: nomCreateur || tr('grp.leCreateur') })}</legend>
    {NIVEAUX_CLES.map((k) => <label key={k} className={'vrm-cm-partage-option' + (valeur === k ? ' pris' : '')}>
      <input type="radio" name="partage" value={k} checked={valeur === k} disabled={desactive} onChange={() => onChange(k)} data-cm-accomp-niveau={k} />
      <span><b>{tr('grp.niveau.' + k + '.t')}</b><small>{tr('grp.niveau.' + k + '.d')}</small></span>
    </label>)}
  </fieldset>;
}

// ── CE QUE VOIT LE CRÉATEUR (une vue, la même pour lui et pour le membre) ─────
export function VueMembre({ vue, pour = 'createur', nomCreateur = '' }) {
  useLangue();
  const [pas, setPas] = useState('mois');
  const e = etatVue(vue);
  const serie = useMemo(() => (vue && vue.chiffres ? serieVue(vue.chiffres, pas) : null), [vue, pas]);
  const max = serie ? Math.max(1, ...serie.map((l) => l.ventes || 0)) : 1;
  const moi = pour === 'membre';
  if (e === 'pas-su') return <p className="vrm-cm-note" data-cm-accomp-vue="pas-su">{pasSu()}</p>;
  return <div className="vrm-cm-vue" data-cm-accomp-vue={e}>
    {moi && <p className="vrm-cm-note">{tr('grp.vue.identique', { nom: nomCreateur || tr('grp.leCreateur') })}</p>}
    <p className="vrm-cm-vue-tete"><b>{vue.nom}</b><span> · {libStatut(vue.statut)} · {tr('grp.vue.partage', { niveau: libNiveau(vue.partage) })}</span></p>
    {e === 'pas-membre' ? <p className="vrm-cm-note">{tr('grp.vue.pasMembre')}</p>
      : e === 'rien' ? <p className="vrm-cm-note" data-cm-accomp-rien>{moi ? tr('grp.vue.rienMoi') : tr('grp.vue.rienLui', { nom: vue.nom || tr('grp.ceMembre') })}</p>
      : e === 'pas-publie' ? <p className="vrm-cm-note" data-cm-accomp-pas-publie>{moi ? tr('grp.vue.pasPublieMoi') : tr('grp.vue.pasPublieLui')}</p>
      : <>
        <div className="vrm-cm-onglets vrm-cm-periodes" role="group" aria-label={tr('grp.vue.periode')}>
          {['mois', 'semaine'].map((k) => <button key={k} type="button" className="vrm-cm-onglet" aria-pressed={pas === k} onClick={() => setPas(k)} data-cm-accomp-pas={k}>{tr('grp.vue.par.' + k)}</button>)}
        </div>
        <table className="vrm-cm-tableau" data-cm-accomp-tableau={pas}>
          <thead><tr><th scope="col">{tr('grp.vue.col.' + pas)}</th><th scope="col">{tr('grp.vue.col.ventes')}</th><th scope="col">{tr('grp.vue.col.vendu')}</th><th scope="col">{tr('grp.vue.col.achats')}</th><th scope="col">{tr('grp.vue.col.depense')}</th></tr></thead>
          <tbody>{serie.map((l) => <tr key={l.cle} data-cm-accomp-ligne={l.cle} data-n={l.ventes == null ? '' : String(l.ventes)}>
            <th scope="row">{l.libelle}</th>
            <td><span className="vrm-cm-barre" style={{ '--p': l.ventes == null ? 0 : l.ventes / max }} aria-hidden="true" />{l.ventes == null ? '—' : l.ventes}</td>
            <td>{eur(l.ca)}</td><td>{l.achats == null ? '—' : l.achats}</td><td>{eur(l.depense)}</td>
          </tr>)}</tbody>
        </table>
        {(!vue.chiffres.ventes || !vue.chiffres.achats) && <p className="vrm-cm-note" data-cm-accomp-moitie>{tr(!vue.chiffres.ventes ? (moi ? 'grp.vue.moitieVentesMoi' : 'grp.vue.moitieVentesLui') : (moi ? 'grp.vue.moitieAchatsMoi' : 'grp.vue.moitieAchatsLui'))}</p>}
        {vue.chiffres.ventes && vue.chiffres.horsVc > 0 && <p className="vrm-cm-note" data-cm-accomp-hors-vc={vue.chiffres.horsVc}>{tr('grp.vue.horsVc', { n: vue.chiffres.horsVc })}</p>}
        <div className="vrm-cm-note">{tr('grp.vue.publieLe', { quand: jourHeure(vue.chiffres_le) || '—' })} <Pourquoi>{tr('grp.vue.pourquoi')}</Pourquoi></div>
        {e === 'detail' && (vue.detail ? <div data-cm-accomp-detail={vue.detail.ventes.length}>
          <h4>{vue.detail.ventes.length > 1 ? tr('grp.vue.ventesRecentes', { n: vue.detail.ventes.length }) : tr('grp.vue.venteRecente')}</h4>
          {vue.detail.ventes.length === 0 ? <p className="vrm-cm-note">{tr('grp.vue.aucuneVente')}</p> :
            <ul className="vrm-cm-liste vrm-cm-detail">{vue.detail.ventes.slice(0, 50).map((l, i) => <li key={i} data-cm-accomp-vente>
              <div><b>{l[3] || tr('grp.vue.article')}</b><small>{jourCourt(l[0])} · {l[1]}{l[2] ? ' · ' + l[2] : ''}</small></div><span>{eurC(l[4])}</span></li>)}</ul>}
          <h4>{vue.detail.achats.length > 1 ? tr('grp.vue.achatsRecents', { n: vue.detail.achats.length }) : tr('grp.vue.achatRecent')}</h4>
          {vue.detail.achats.length === 0 ? <p className="vrm-cm-note">{tr('grp.vue.aucunAchat')}</p> :
            <ul className="vrm-cm-liste vrm-cm-detail">{vue.detail.achats.slice(0, 50).map((l, i) => <li key={i} data-cm-accomp-achat>
              <div><b>{l[2] || tr('grp.vue.achat')}</b><small>{jourCourt(l[0])}{l[1] ? ' · ' + l[1] : ''}</small></div><span>{eurC(l[3])}</span></li>)}</ul>}
        </div> : <p className="vrm-cm-note" data-cm-accomp-detail-absent>{tr('grp.vue.detailAbsent')}</p>)}
      </>}
  </div>;
}

// ── LES FEUILLES ─────────────────────────────────────────────────────────────
function Feuille({ titre, sous = '', onFerme, FermeAuRetour, children, data }) {
  return <div className="vrm-cm-voile" onClick={(e) => { if (e.target === e.currentTarget) onFerme(); }}>
    <FermeAuRetour fermer={onFerme} />
    <div className="vrm-cm-feuille vrm-gc-feuille" role="dialog" aria-modal="true" aria-label={titre} {...data}>
      <div className="vrm-cm-feuille-tete"><h3>{titre}{sous ? <small> {sous}</small> : null}</h3><button type="button" className="vrm-cm-x" onClick={onFerme} aria-label={tr('grp.fermer')}>×</button></div>
      {children}
    </div>
  </div>;
}

// ── LE BOUTON « COUCOU » : un toucher, aucun texte ───────────────────────────
function BoutonCoucou({ api, groupe, cible, cc, onFait }) {
  const [occupe, setOccupe] = useState(false);
  const etat = etatCoucou(cible, cc || {});
  const envoyer = async () => {
    setOccupe(true);
    // AUCUN texte : le groupe et la personne, rien d'autre.
    const r = await api({ action: 'accomp-coucou', groupe, membre: cible.cible });
    setOccupe(false);
    onFait(r.ok ? tr('grp.coucou.envoye', { nom: cible.nom }) : (r.message || pasSu()));
  };
  return <button type="button" className="vrm-gc-coucou" onClick={envoyer} disabled={occupe || etat !== 'pret'}
    data-cm-coucou-faire={cible.cible || 'createur'} data-etat={etat} aria-label={tr('grp.coucou.aria', { nom: cible.nom })}>
    {etat === 'deja' ? tr('grp.coucou.deja') : etat === 'plafond' ? tr('grp.coucou.plafondCourt') : <><span aria-hidden="true">👋</span> {tr('grp.coucou.bouton')}</>}
  </button>;
}

// ── CRÉER UN GROUPE : trois étapes ───────────────────────────────────────────
function Creer({ api, prenom, coucouPret, onCree, onFerme, FermeAuRetour, onToast }) {
  const [etape, setEtape] = useState(1);
  const [nom, setNom] = useState(''), [desc, setDesc] = useState(''), [moi, setMoi] = useState(String(prenom || '').slice(0, 40));
  const [photo, setPhoto] = useState(''), [msg, setMsg] = useState(''), [occupe, setOccupe] = useState(false);
  const [cree, setCree] = useState(null);
  const fichier = useRef(null);
  const choisirPhoto = async (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f) return;
    const p = await photoCarree(f);
    if (p) { setPhoto(p); setMsg(''); } else setMsg(tr('grp.creer.photoKo'));
  };
  const creer = async (e) => {
    e.preventDefault(); setOccupe(true); setMsg('');
    const r = await api({ action: 'accomp-creer', nom: nom.trim(), description: desc.trim(), createur: moi.trim() });
    if (!r.ok) { setOccupe(false); setMsg(r.message || pasSu()); return; }
    let photoPosee = false;
    if (photo && coucouPret) { const h = await api({ action: 'accomp-habiller', groupe: r.id, discord: '', photo }); photoPosee = !!h.ok; }
    setOccupe(false);
    setCree({ id: r.id, code: r.code, nom: r.nom || nom.trim(), photo: photoPosee ? photo : '' });
    setEtape(3);
    onCree();
  };
  const sous = tr('grp.creer.etape', { n: etape, total: 3 });
  return <Feuille titre={etape === 3 ? tr('grp.creer.titre3') : tr('grp.creer.titre')} sous={'· ' + sous} onFerme={onFerme} FermeAuRetour={FermeAuRetour} data={{ 'data-cm-accomp-feuille': 'creer', 'data-cm-accomp-etape': String(etape) }}>
    <ol className="vrm-gc-etapes" aria-label={sous}>{[1, 2, 3].map((n) => <li key={n} className={n <= etape ? 'fait' : ''} aria-current={n === etape ? 'step' : undefined} />)}</ol>
    {etape === 1 && <form onSubmit={(e) => { e.preventDefault(); if (nom.trim().length >= 2) setEtape(2); }}>
      <div className="vrm-gc-photo-choix">
        <Vignette photo={photo} nom={nom} grande />
        {coucouPret ? <div>
          <button type="button" className="vrm-cm-lien" onClick={() => fichier.current && fichier.current.click()} data-cm-accomp-photo-choisir>{photo ? tr('grp.creer.photoChanger') : tr('grp.creer.photoAjouter')}</button>
          {photo && <button type="button" className="vrm-cm-lien" onClick={() => setPhoto('')} data-cm-accomp-photo-retirer>{tr('grp.creer.photoRetirer')}</button>}
          <input ref={fichier} type="file" accept="image/*" hidden onChange={choisirPhoto} data-cm-accomp-photo />
        </div> : <p className="vrm-cm-note" data-cm-accomp-photo-bientot>{tr('grp.creer.photoBientot')}</p>}
      </div>
      <label className="vrm-cm-champ"><span>{tr('grp.creer.nom')}</span><input value={nom} maxLength={60} onChange={(e) => setNom(e.target.value)} placeholder={tr('grp.creer.nomExemple')} data-cm-accomp-nom required /></label>
      <label className="vrm-cm-champ"><span>{tr('grp.creer.description')} <small>{tr('grp.facultatif')}</small></span><textarea value={desc} maxLength={160} rows={2} onChange={(e) => setDesc(e.target.value)} placeholder={tr('grp.creer.descriptionExemple')} data-cm-accomp-description /></label>
      {msg && <p className="vrm-cm-msg" role="alert">{msg}</p>}
      <button type="submit" className="vrm-cm-primaire vrm-gc-plein" disabled={nom.trim().length < 2} data-cm-accomp-continuer>{tr('grp.creer.continuer')}</button>
    </form>}
    {etape === 2 && <form onSubmit={creer}>
      <h4 className="vrm-gc-titre-section">{tr('grp.creer.quiEntre')}</h4>
      <ul className="vrm-gc-regles" data-cm-accomp-regle-entree="demande">
        <li><span className="vrm-gc-coche" aria-hidden="true">✓</span><div><b>{tr('grp.creer.entree1')}</b><small>{tr('grp.creer.entree1d')}</small></div></li>
        <li><span className="vrm-gc-coche" aria-hidden="true">✓</span><div><b>{tr('grp.creer.entree2')}</b><small>{tr('grp.creer.entree2d')}</small></div></li>
      </ul>
      <h4 className="vrm-gc-titre-section">{tr('grp.creer.partageTitre')}</h4>
      <ul className="vrm-gc-regles" data-cm-accomp-regle-partage="rien">
        <li><span className="vrm-gc-coche" aria-hidden="true">✓</span><div><b>{tr('grp.creer.partageRien')}</b><small>{tr('grp.creer.partageRiend')}</small></div></li>
      </ul>
      <label className="vrm-cm-champ"><span>{tr('grp.creer.tonNom')}</span><input value={moi} maxLength={40} onChange={(e) => setMoi(e.target.value)} placeholder={tr('grp.tonPrenom')} data-cm-accomp-createur required /></label>
      {msg && <p className="vrm-cm-msg" role="alert">{msg}</p>}
      <div className="vrm-gc-bas">
        <button type="button" className="vrm-cm-lien" onClick={() => setEtape(1)} data-cm-accomp-retour>{tr('grp.retour')}</button>
        <button type="submit" className="vrm-cm-primaire" disabled={occupe || moi.trim().length < 2} data-cm-accomp-valider>{occupe ? tr('grp.unInstant') : tr('grp.creer.creer')}</button>
      </div>
    </form>}
    {etape === 3 && cree && <Inviter api={api} g={cree} discord="" photo={cree.photo} coucouPret={coucouPret} onToast={onToast} onHabille={onCree}
      fin={<button type="button" className="vrm-cm-lien vrm-gc-plein" onClick={onFerme} data-cm-accomp-termine>{tr('grp.creer.termine')}</button>} />}
  </Feuille>;
}

// ── INVITER : le lien, le QR code, « Partager », le lien Discord ─────────────
function Inviter({ api, g, discord = '', photo = '', coucouPret, onToast, onHabille, fin = null }) {
  const lien = lienInvitation(g.code);
  const [copie, setCopie] = useState('');
  const [d, setD] = useState(discord || ''), [pose, setPose] = useState(discord || ''), [msg, setMsg] = useState(''), [occupe, setOccupe] = useState(false);
  const partager = async () => {
    try { await navigator.share({ title: g.nom, text: tr('grp.inviter.texte', { nom: g.nom }), url: lien }); }
    catch (e) { if (!(e && e.name === 'AbortError')) setCopie((await copier(lien)) ? tr('grp.inviter.lienCopie') : lien); }
  };
  const enregistrer = async (e) => {
    e.preventDefault();
    const propre = lienDiscordGroupe(d);
    if (propre === null) { setMsg(tr('grp.inviter.discordKo')); return; }
    setOccupe(true); setMsg('');
    const r = await api({ action: 'accomp-habiller', groupe: g.id, discord: propre, photo: photo || '' });
    setOccupe(false);
    if (!r.ok) { setMsg(r.message || pasSu()); return; }
    setD(propre); setPose(propre); onToast(propre ? tr('grp.inviter.discordPose') : tr('grp.inviter.discordRetire')); onHabille();
  };
  return <div className="vrm-gc-inviter" data-cm-accomp-inviter-feuille={g.id}>
    <QrLien texte={lien} />
    <p className="vrm-gc-code">{tr('grp.inviter.code')} <b className="vrm-cm-select" data-cm-accomp-code={g.code}>{codeLisible(g.code)}</b></p>
    <div className="vrm-gc-bas">
      {partagePossible() ? <button type="button" className="vrm-cm-primaire" onClick={partager} data-cm-accomp-partager>{tr('grp.inviter.partager')}</button> : null}
      <button type="button" className={partagePossible() ? '' : 'vrm-cm-primaire'} onClick={async () => setCopie((await copier(lien)) ? tr('grp.inviter.lienCopie') : lien)} data-cm-accomp-copier-lien>{tr('grp.inviter.copierLien')}</button>
      <button type="button" className="vrm-cm-lien" onClick={async () => setCopie((await copier(codeLisible(g.code))) ? tr('grp.inviter.codeCopie') : codeLisible(g.code))} data-cm-accomp-copier-code>{tr('grp.inviter.copierCode')}</button>
    </div>
    {copie && <p className="vrm-cm-note" role="status" data-cm-accomp-copie>{copie}</p>}
    <p className="vrm-cm-note">{tr('grp.inviter.note')}</p>
    <h4 className="vrm-gc-titre-section">{tr('grp.inviter.discordTitre')}</h4>
    {coucouPret ? <form onSubmit={enregistrer} className="vrm-gc-discord">
      <label className="vrm-cm-champ"><span>{tr('grp.inviter.discordChamp')} <small>{tr('grp.facultatif')}</small></span>
        <input value={d} onChange={(e) => setD(e.target.value)} inputMode="url" autoCapitalize="off" autoComplete="off" spellCheck={false} placeholder={tr('grp.inviter.discordExemple')} data-cm-accomp-discord-champ /></label>
      <p className="vrm-cm-note">{tr('grp.inviter.discordNote')}</p>
      {msg && <p className="vrm-cm-msg" role="alert">{msg}</p>}
      <button type="submit" disabled={occupe || (d || '').trim() === (pose || '')} data-cm-accomp-discord-enregistrer>{occupe ? tr('grp.unInstant') : tr('grp.enregistrer')}</button>
    </form> : <p className="vrm-cm-note" data-cm-accomp-discord-bientot>{tr('grp.inviter.discordBientot')}</p>}
    {fin}
  </div>;
}

// ── UN GROUPE QUE J'AI CRÉÉ : sa page ────────────────────────────────────────
function GroupeCree({ api, g, h, onFait, onOuvrir, outils = null }) {
  const attente = g.membres.filter((m) => m.statut === 'attente'), membres = g.membres.filter((m) => m.statut === 'accepte');
  const faire = async (corps, ok) => { const r = await api(corps); onFait(r.ok ? ok : (r.message || pasSu())); };
  return <article className="vrm-gc-groupe" data-cm-accomp-cree={g.id}>
    <header className="vrm-gc-tete">
      <Vignette photo={h && h.photo} nom={g.nom} />
      <div className="vrm-gc-tete-texte"><h3>{g.nom}</h3><small>{tr('grp.nMembres', { n: membres.length })}</small></div>
      {/* Ambre : un geste à faire (§7) — des demandes attendent SA validation. */}
      {attente.length > 0 && <span className="vrm-cm-etiquette attente" data-cm-accomp-a-valider={attente.length}>{tr('grp.aValider', { n: attente.length })}</span>}
      <button type="button" className="vrm-gc-plus" onClick={() => onOuvrir({ type: 'reglages', g })} aria-label={tr('grp.plusAria', { nom: g.nom })} data-cm-accomp-plus>⋯</button>
    </header>
    {g.description && <p className="vrm-gc-description">{g.description}</p>}
    <div className="vrm-gc-actions">
      <button type="button" onClick={() => onOuvrir({ type: 'inviter', g })} data-cm-accomp-inviter>{tr('grp.inviter.bouton')}</button>
      {h && h.discord ? <a className="vrm-gc-discord-lien" href={h.discord} target="_blank" rel="noopener noreferrer" data-cm-accomp-discord-ouvrir>{tr('grp.ouvrirDiscord')}</a> : null}
    </div>
    {attente.length > 0 && <section className="vrm-gc-section" data-cm-accomp-demandes={attente.length}>
      <h4 className="vrm-gc-titre-section">{tr('grp.demandes')}</h4>
      <ul className="vrm-gc-liste">{attente.map((m) => <li key={m.id} data-cm-accomp-demande={m.id}>
        <div className="vrm-gc-ligne-texte"><b>{m.nom}</b><small>{tr('grp.demandeDu', { quand: jourCourt(m.demande_le), niveau: libNiveau(m.partage) })}</small></div>
        <div className="vrm-gc-ligne-boutons">
          <button type="button" onClick={() => faire({ action: 'accomp-decider', membre: m.id, oui: true }, tr('grp.accepteFait', { nom: m.nom }))} data-cm-accomp-accepter>{tr('grp.accepter')}</button>
          <button type="button" className="vrm-cm-lien" onClick={() => faire({ action: 'accomp-decider', membre: m.id, oui: false }, tr('grp.refuseFait', { nom: m.nom }))} data-cm-accomp-refuser>{tr('grp.refuser')}</button>
        </div></li>)}</ul>
    </section>}
    <section className="vrm-gc-section">
      <h4 className="vrm-gc-titre-section">{tr('grp.membres')}</h4>
      {membres.length === 0 ? <p className="vrm-cm-note" data-cm-accomp-aucun-membre>{tr('grp.aucunMembre')}</p>
        : <ul className="vrm-gc-liste">{membres.map((m) => <li key={m.id} data-cm-accomp-membre={m.id} data-partage={m.partage}>
          <button type="button" className="vrm-gc-ligne-bouton" onClick={() => onOuvrir({ type: 'membre', g, m })} data-cm-accomp-voir-membre>
            <span className="vrm-gc-ligne-texte"><b>{m.nom}</b><small>{tr('grp.partageDe', { niveau: libNiveau(m.partage) })}{m.partage !== 'rien' && m.chiffres_le ? ' · ' + tr('grp.aJourLe', { quand: jourCourt(m.chiffres_le) }) : ''}</small></span>
            <span className="vrm-gc-chevron" aria-hidden="true">›</span>
          </button></li>)}</ul>}
    </section>
    {outils}
  </article>;
}

// ── UN GROUPE QUE J'AI REJOINT : sa page ─────────────────────────────────────
function Adhesion({ api, a, h, cc, onFait, onVoir, outils = null }) {
  const [occupe, setOccupe] = useState(false);
  const vivant = !a.ferme && (a.statut === 'attente' || a.statut === 'accepte');
  const changer = async (p) => {
    if (p === a.partage) return;
    setOccupe(true);
    const r = await api({ action: 'accomp-partage', adhesion: a.id, partage: p });
    setOccupe(false);
    onFait(r.ok ? (p === 'rien' ? tr('grp.partageRienFait', { nom: a.createur }) : tr('grp.partageFait', { nom: a.createur, niveau: libNiveau(p).toLowerCase() })) : (r.message || pasSu()), r.ok ? r.niveau : undefined);
  };
  const quitter = async () => {
    if (!window.confirm(tr('grp.quitterConfirmer', { nom: a.nom, createur: a.createur }))) return;
    const r = await api({ action: 'accomp-quitter', adhesion: a.id });
    onFait(r.ok ? tr('grp.quitteFait', { nom: a.nom }) : (r.message || pasSu()));
  };
  const ouvrir = async (oui) => {
    setOccupe(true);
    const r = await api({ action: 'accomp-coucou-ouvrir', adhesion: a.id, oui });
    setOccupe(false);
    onFait(r.ok ? (oui ? tr('grp.coucou.ouvertFait') : tr('grp.coucou.fermeFait')) : (r.message || pasSu()));
  };
  const statut = a.ferme ? tr('grp.statut.ferme') : libStatut(a.statut);
  const membreOk = vivant && a.statut === 'accepte';
  return <article className="vrm-gc-groupe" data-cm-accomp-rejoint={a.id} data-statut={a.ferme ? 'ferme' : a.statut}>
    <header className="vrm-gc-tete">
      <Vignette photo={h && h.photo} nom={a.nom} />
      <div className="vrm-gc-tete-texte"><h3>{a.nom}</h3><small>{tr('grp.parCreateur', { nom: a.createur, n: a.membres, moi: a.moi })}</small></div>
      <span className="vrm-cm-etiquette" data-cm-accomp-statut>{statut}</span>
    </header>
    {a.description && <p className="vrm-gc-description">{a.description}</p>}
    {membreOk && h && <section className="vrm-gc-section" data-cm-coucou-groupe={a.groupe}>
      <h4 className="vrm-gc-titre-section">{tr('grp.coucou.titre')}</h4>
      <ul className="vrm-gc-liste">{h.cibles.map((c) => <li key={c.cible || 'createur'} data-cm-coucou-cible={c.cible || 'createur'}>
        <div className="vrm-gc-ligne-texte"><b>{c.nom}</b><small>{c.role === 'createur' ? tr('grp.coucou.roleCreateur') : tr('grp.coucou.roleMembre')}</small></div>
        <BoutonCoucou api={api} groupe={a.groupe} cible={c} cc={cc} onFait={onFait} />
      </li>)}</ul>
      <label className="vrm-gc-bascule">
        <span><b>{tr('grp.coucou.ouvrir')}</b><small>{tr('grp.coucou.ouvrirNote')}</small></span>
        <input type="checkbox" role="switch" checked={h.ouvert === true} disabled={occupe} onChange={(e) => ouvrir(e.target.checked)} data-cm-coucou-ouvrir={h.ouvert ? 'oui' : 'non'} />
      </label>
    </section>}
    {vivant && <>
      <ChoixPartage valeur={a.partage} onChange={changer} nomCreateur={a.createur} desactive={occupe} />
      <div className="vrm-gc-actions">
        <button type="button" onClick={() => onVoir(a)} data-cm-accomp-ce-que-voit>{tr('grp.voirCeQueVoit', { nom: a.createur })}</button>
        {membreOk && h && h.discord ? <a className="vrm-gc-discord-lien" href={h.discord} target="_blank" rel="noopener noreferrer" data-cm-accomp-discord-ouvrir>{tr('grp.ouvrirDiscord')}</a> : null}
      </div>
      {outils}
      <div className="vrm-gc-pied"><button type="button" className="vrm-cm-lien" onClick={quitter} data-cm-accomp-quitter>{tr('grp.quitter')}</button></div>
    </>}
    {!vivant && <div className="vrm-gc-pied"><button type="button" className="vrm-cm-lien" onClick={quitter} data-cm-accomp-quitter>{tr('grp.retirerListe')}</button></div>}
  </article>;
}

// ── LES COUCOUS REÇUS : un geste, « Lui écrire sur Discord » ─────────────────
function CoucousRecus({ recus, onPlus }) {
  if (!recus.length) return null;
  return <section className="vrm-gc-bloc" aria-label={tr('grp.coucou.recusTitre')} data-cm-coucous-recus={recus.length}>
    <h3 className="vrm-cm-section">{tr('grp.coucou.recusTitre')}</h3>
    <ul className="vrm-gc-liste vrm-gc-carte-liste">{recus.map((r) => <li key={r.id} data-cm-coucou-recu={r.id} data-ecrire={r.ecrire.sorte}>
      <span className="vrm-gc-main" aria-hidden="true">👋</span>
      <div className="vrm-gc-ligne-texte"><b>{tr('grp.coucou.aFait', { nom: r.de })}</b><small>{r.groupeNom} · {ilYa(r.le)}</small></div>
      <div className="vrm-gc-ligne-boutons">
        {r.ecrire.sorte === 'aucun' ? <span className="vrm-cm-note" data-cm-coucou-ecrire="aucun">{tr('grp.coucou.pasDeDiscord')}</span>
          : <a className="vrm-gc-discord-lien" href={r.ecrire.url} target="_blank" rel="noopener noreferrer" data-cm-coucou-ecrire={r.ecrire.sorte}>{tr('grp.coucou.ecrire')}</a>}
        <button type="button" className="vrm-gc-plus" onClick={() => onPlus(r)} aria-label={tr('grp.coucou.plusAria', { nom: r.de })} data-cm-coucou-plus>⋯</button>
      </div>
    </li>)}</ul>
  </section>;
}

// ── L'ONGLET ─────────────────────────────────────────────────────────────────
export default function Accompagnement({ api, headers, prenom = '', codeLien = '', lienFormateur = null, portail, FermeAuRetour, onToast }) {
  useLangue();
  const [etat, setEtat] = useState('charge'), [msg, setMsg] = useState('');
  const [d, setD] = useState(null);
  const [feuille, setFeuille] = useState(lienFormateur ? { type: 'rejoindre-page' } : codeLien ? { type: 'rejoindre', code: codeLien } : null);
  // L'espace formateur (032) : undefined en cours · 'non-installe' · 'pas-su' · { page, crees, rejoints }.
  const [form, setForm] = useState(undefined);
  // Le coucou et l'habillage (046) : undefined en cours · 'non-installe' · 'pas-su' · lu (coucousLus).
  const [cc, setCc] = useState(undefined);
  const vivant = useRef(true);
  const lireForm = useCallback(async () => {
    const r = await api({ action: 'form-lire' });
    if (!vivant.current) return;
    if (r.ok && r.form && Array.isArray(r.form.crees)) setForm(r.form);
    else setForm((f) => (f && typeof f === 'object' && r.erreur !== 'non-installe' ? f : r.erreur === 'non-installe' ? 'non-installe' : 'pas-su'));
  }, [api]);
  const lireCoucou = useCallback(async () => {
    const r = await api({ action: 'accomp-coucou-lire' });
    if (!vivant.current) return;
    const lu = r.ok ? coucousLus(r.coucou) : null;
    if (lu) setCc(lu);
    else setCc((x) => (x && typeof x === 'object' && r.erreur !== 'non-installe' ? x : r.erreur === 'non-installe' ? 'non-installe' : 'pas-su'));
  }, [api]);
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
    if (discret && d) { setMsg(r.message || pasSu()); return; }
    setEtat(r.erreur === 'non-installe' ? 'non-installe' : r.erreur === 'abonnement' ? 'abonnement' : 'pas-su'); setMsg(r.message || pasSu());
  }, [api, headers, d]);
  useEffect(() => { vivant.current = true; lire(); lireForm(); lireCoucou(); return () => { vivant.current = false; }; }, []);
  const fait = (t, niveau) => { onToast(t); if (niveau !== undefined) noterNiveau(niveau); lire(true); lireForm(); lireCoucou(); };
  const coucouPret = !!(cc && typeof cc === 'object');
  const hDe = (gid) => (coucouPret ? cc.groupes.find((x) => x.groupe === gid) || null : null);
  const ouvrirVue = async (x, pour) => {
    if (pour === 'createur') { setFeuille({ type: 'vue', vue: x, pour }); return; }
    setFeuille({ type: 'vue', vue: undefined, pour, nomCreateur: x.createur });
    const r = await api({ action: 'accomp-vu', adhesion: x.id });
    setFeuille((f) => (f && f.type === 'vue' ? { ...f, vue: r.ok ? r.vue : null, msg: r.ok ? '' : (r.message || pasSu()) } : f));
  };
  const fermer = () => setFeuille(null);

  if (etat === 'charge') return <p role="status" className="vrm-cm-note" data-cm-accomp="charge">{tr('grp.lecture')}</p>;
  if (etat === 'pas-su') return <EtatPanne data-cm-accomp={etat} quoi={tr('grp.tesGroupes')} raison={msg || pasSu()} onReessayer={() => lire()} />;
  if (etat !== 'lu') return <div className="vrm-gc-groupe" data-cm-accomp={etat}>
    {etat === 'non-installe' ? <><b>{tr('grp.nonInstalle')}</b><p className="vrm-cm-note">{tr('grp.nonInstalleNote')}</p></>
      : <><b>{tr('grp.abonnement')}</b><p className="vrm-cm-note">{tr('grp.abonnementNote')}</p></>}
  </div>;

  const publie = d.publie || {};
  const aucun = d.crees.length === 0 && d.rejoints.length === 0;
  return <div className="vrm-gc" data-cm-accomp="lu" data-cm-accomp-partage-max={d.niveau} data-cm-coucou-etat={coucouPret ? 'lu' : String(cc || 'charge')}>
    {aucun ? <div className="vrm-gc-groupe vrm-gc-vide" data-cm-accomp-vide>
      <span className="vrm-gc-vide-main" aria-hidden="true">👋</span>
      <h3>{tr('grp.vide.titre')}</h3>
      <p className="vrm-cm-note">{tr('grp.vide.texte')}</p>
      <div className="vrm-gc-bas">
        <button type="button" className="vrm-cm-primaire" onClick={() => setFeuille({ type: 'creer' })} data-cm-accomp-creer>{tr('grp.creerBouton')}</button>
        <button type="button" onClick={() => setFeuille({ type: 'rejoindre', code: '' })} data-cm-accomp-rejoindre>{tr('grp.rejoindreBouton')}</button>
      </div>
    </div> : <div className="vrm-gc-barre">
      <p className="vrm-cm-note">{tr('grp.intro')} <Pourquoi>{tr('grp.introPourquoi')}</Pourquoi></p>
      <div className="vrm-gc-ligne-boutons">
        <button type="button" onClick={() => setFeuille({ type: 'creer' })} data-cm-accomp-creer>{tr('grp.creerBouton')}</button>
        <button type="button" className="vrm-cm-lien" onClick={() => setFeuille({ type: 'rejoindre', code: '' })} data-cm-accomp-rejoindre>{tr('grp.rejoindreBouton')}</button>
      </div>
    </div>}
    {msg && <p className="vrm-cm-note" role="status">{msg}</p>}
    {cc === 'non-installe' && !aucun && <p className="vrm-cm-note" data-cm-coucou-bientot>{tr('grp.coucou.bientot')}</p>}
    {coucouPret && <CoucousRecus recus={cc.recus} onPlus={(r) => setFeuille({ type: 'coucou-plus', r })} />}
    {form && typeof form === 'object' && <MaPage api={api} page={form.page} prenom={prenom} onFait={fait} ouvrirFeuille={setFeuille} />}
    {form === 'non-installe' && <p className="vrm-cm-note" data-form-etat="non-installe">{tr('grp.formNonInstalle')}</p>}
    {form === 'pas-su' && <p className="vrm-cm-note" data-form-etat="pas-su">{tr('grp.formPasSu')} <button type="button" className="vrm-cm-lien" onClick={lireForm}>{tr('grp.reessayer')}</button></p>}
    {d.crees.length > 0 && <section className="vrm-gc-bloc" aria-label={tr('grp.mesGroupes')} data-cm-accomp-crees={d.crees.length}>
      <h3 className="vrm-cm-section">{tr('grp.mesGroupes')}</h3>
      {d.crees.map((g) => { const f = form && typeof form === 'object' ? form.crees.find((x) => x.groupe === g.id) : null;
        return <GroupeCree key={g.id} api={api} g={g} h={hDe(g.id)} onFait={fait} onOuvrir={setFeuille}
          outils={f ? <OutilsFormateur api={api} g={g} f={f} pagePubliee={!!(form.page && form.page.publiee)} onFait={fait} /> : null} />; })}
    </section>}
    {d.rejoints.length > 0 && <section className="vrm-gc-bloc" aria-label={tr('grp.rejoints')} data-cm-accomp-rejoints={d.rejoints.length}>
      <h3 className="vrm-cm-section">{tr('grp.rejoints')}</h3>
      {d.niveau >= 1 && <p className="vrm-cm-note" data-cm-accomp-publie={publie.chiffres_le ? 'oui' : 'non'}>{publie.chiffres_le ? tr('grp.publieAJour', { quand: jourHeure(publie.chiffres_le) }) : tr('grp.publiePasParti')}</p>}
      {d.rejoints.map((a) => { const r = form && typeof form === 'object' ? form.rejoints.find((x) => x.adhesion === a.id) : null;
        return <Adhesion key={a.id} api={api} a={a} h={hDe(a.groupe)} cc={coucouPret ? cc : null} onFait={fait} onVoir={(x) => ouvrirVue(x, 'membre')}
          outils={r && a.statut === 'accepte' ? <OutilsEleve api={api} r={r} createur={a.createur} onFait={fait} /> : null} />; })}
    </section>}
    {coucouPret && cc.sourdines.length > 0 && <details className="vrm-gc-repli" data-cm-coucou-sourdines={cc.sourdines.length}>
      <summary>{tr('grp.coucou.coupes', { n: cc.sourdines.length })}</summary>
      <ul className="vrm-gc-liste">{cc.sourdines.map((s) => <li key={s.coucou}>
        <div className="vrm-gc-ligne-texte"><b>{s.nom}</b></div>
        <button type="button" className="vrm-cm-lien" onClick={async () => { const r = await api({ action: 'accomp-coucou-sourdine', coucou: s.coucou, oui: false }); fait(r.ok ? tr('grp.coucou.retabliFait', { nom: s.nom }) : (r.message || pasSu())); }} data-cm-coucou-retablir>{tr('grp.coucou.retablir')}</button>
      </li>)}</ul>
    </details>}

    {feuille && feuille.type === 'creer' && portail(<Creer api={api} prenom={prenom} coucouPret={coucouPret} FermeAuRetour={FermeAuRetour} onToast={onToast} onFerme={fermer} onCree={() => { lire(true); lireCoucou(); }} />)}
    {feuille && feuille.type === 'inviter' && portail(<Feuille titre={tr('grp.inviter.titre')} sous={'· ' + feuille.g.nom} onFerme={fermer} FermeAuRetour={FermeAuRetour} data={{ 'data-cm-accomp-feuille': 'inviter' }}>
      <Inviter api={api} g={feuille.g} discord={(hDe(feuille.g.id) || {}).discord || ''} photo={(hDe(feuille.g.id) || {}).photo || ''} coucouPret={coucouPret} onToast={onToast} onHabille={lireCoucou} />
    </Feuille>)}
    {feuille && feuille.type === 'reglages' && portail(<Reglages api={api} g={feuille.g} h={hDe(feuille.g.id)} coucouPret={coucouPret} FermeAuRetour={FermeAuRetour} onFerme={fermer} onFait={(t) => { fermer(); fait(t); }} />)}
    {feuille && feuille.type === 'membre' && portail(<FeuilleMembre api={api} g={feuille.g} m={feuille.m} h={hDe(feuille.g.id)} cc={coucouPret ? cc : null} FermeAuRetour={FermeAuRetour} onFerme={fermer} onFait={(t, ferme) => { if (ferme) fermer(); fait(t); }} />)}
    {feuille && feuille.type === 'coucou-plus' && portail(<Feuille titre={tr('grp.coucou.aFait', { nom: feuille.r.de })} onFerme={fermer} FermeAuRetour={FermeAuRetour} data={{ 'data-cm-accomp-feuille': 'coucou-plus' }}>
      <p className="vrm-cm-note">{tr('grp.coucou.sourdineNote')}</p>
      <div className="vrm-gc-bas">
        <button type="button" onClick={async () => { const r = await api({ action: 'accomp-coucou-sourdine', coucou: feuille.r.id, oui: true }); fermer(); fait(r.ok ? tr('grp.coucou.sourdineFait', { nom: feuille.r.de }) : (r.message || pasSu())); }} data-cm-coucou-sourdine>{tr('grp.coucou.sourdine')}</button>
        <button type="button" className="vrm-cm-lien" onClick={fermer}>{tr('grp.annuler')}</button>
      </div>
    </Feuille>)}
    {feuille && feuille.type === 'rejoindre' && portail(<Rejoindre api={api} prenom={prenom} codeInitial={feuille.code} FermeAuRetour={FermeAuRetour} onFerme={fermer} onFait={(r) => { fermer(); fait(r.deja ? tr('grp.dejaDedans') : tr('grp.demandeEnvoyee', { nom: r.nom })); }} />)}
    {feuille && feuille.type === 'page' && portail(<Feuille titre={tr('grp.maPage')} FermeAuRetour={FermeAuRetour} onFerme={fermer} data={{ 'data-cm-accomp-feuille': 'page' }}>
      <FeuillePage api={api} page={feuille.page} prenom={prenom} onFait={(t) => { fermer(); fait(t); }} />
    </Feuille>)}
    {feuille && feuille.type === 'rejoindre-page' && lienFormateur && portail(<Feuille titre={tr('grp.rejoindreTitre')} FermeAuRetour={FermeAuRetour} onFerme={fermer} data={{ 'data-cm-accomp-feuille': 'rejoindre-page' }}>
      <RejoindrePage api={api} lien={lienFormateur} prenom={prenom} ChoixPartage={ChoixPartage} onFait={(r) => { fermer(); fait(r.deja ? tr('grp.dejaDedans') : tr('grp.demandeEnvoyee', { nom: r.nom })); }} />
    </Feuille>)}
    {feuille && feuille.type === 'vue' && portail(<Feuille titre={feuille.pour === 'membre' ? tr('grp.ceQueVoit', { nom: feuille.nomCreateur }) : (feuille.vue && feuille.vue.nom) || tr('grp.membre')} FermeAuRetour={FermeAuRetour} onFerme={fermer} data={{ 'data-cm-accomp-feuille': 'vue' }}>
      {feuille.vue === undefined ? <p role="status" className="vrm-cm-note">{tr('grp.lectureCourte')}</p> : feuille.vue === null ? <p className="vrm-cm-msg" role="alert">{feuille.msg || pasSu()}</p>
        : <VueMembre vue={feuille.vue} pour={feuille.pour} nomCreateur={feuille.nomCreateur} />}
    </Feuille>)}
  </div>;
}

// ── UN MEMBRE (le créateur l'a touché) : ce qu'il partage, coucou, retirer ───
function FeuilleMembre({ api, g, m, h, cc, onFerme, onFait, FermeAuRetour }) {
  const cible = h ? h.cibles.find((c) => c.cible === m.id) : null;
  const retirer = async () => {
    if (!window.confirm(tr('grp.retirerConfirmer', { nom: m.nom }))) return;
    const r = await api({ action: 'accomp-retirer', membre: m.id });
    onFait(r.ok ? tr('grp.retireFait', { nom: m.nom }) : (r.message || pasSu()), r.ok);
  };
  return <Feuille titre={m.nom} onFerme={onFerme} FermeAuRetour={FermeAuRetour} data={{ 'data-cm-accomp-feuille': 'vue' }}>
    {cible ? <div className="vrm-gc-bas vrm-gc-coucou-ligne"><BoutonCoucou api={api} groupe={g.id} cible={cible} cc={cc} onFait={(t) => onFait(t, false)} /></div> : null}
    <VueMembre vue={m} pour="createur" />
    <div className="vrm-gc-pied"><button type="button" className="vrm-cm-lien" onClick={retirer} data-cm-accomp-retirer>{tr('grp.retirer')}</button></div>
  </Feuille>;
}

// ── LES RÉGLAGES D'UN GROUPE (« ⋯ ») : photo, nouveau code, fermer ───────────
function Reglages({ api, g, h, coucouPret, onFerme, onFait, FermeAuRetour }) {
  const fichier = useRef(null);
  const [msg, setMsg] = useState('');
  const photo = async (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f) return;
    const p = await photoCarree(f);
    if (!p) { setMsg(tr('grp.creer.photoKo')); return; }
    const r = await api({ action: 'accomp-habiller', groupe: g.id, discord: (h && h.discord) || '', photo: p });
    if (r.ok) onFait(tr('grp.photoPosee')); else setMsg(r.message || pasSu());
  };
  const nouveauCode = async () => {
    if (!window.confirm(tr('grp.nouveauCodeConfirmer'))) return;
    const r = await api({ action: 'accomp-code', groupe: g.id });
    onFait(r.ok ? tr('grp.nouveauCodeFait') : (r.message || pasSu()));
  };
  const fermerGroupe = async () => {
    if (!window.confirm(tr('grp.fermerConfirmer', { nom: g.nom }))) return;
    const r = await api({ action: 'accomp-fermer', groupe: g.id });
    onFait(r.ok ? tr('grp.fermeFait', { nom: g.nom }) : (r.message || pasSu()));
  };
  return <Feuille titre={g.nom} onFerme={onFerme} FermeAuRetour={FermeAuRetour} data={{ 'data-cm-accomp-feuille': 'reglages' }}>
    <ul className="vrm-gc-liste vrm-gc-menu">
      {coucouPret && <li><button type="button" className="vrm-gc-ligne-bouton" onClick={() => fichier.current && fichier.current.click()} data-cm-accomp-photo-changer><span className="vrm-gc-ligne-texte"><b>{h && h.photo ? tr('grp.creer.photoChanger') : tr('grp.creer.photoAjouter')}</b></span></button>
        <input ref={fichier} type="file" accept="image/*" hidden onChange={photo} /></li>}
      <li><button type="button" className="vrm-gc-ligne-bouton" onClick={nouveauCode} data-cm-accomp-nouveau-code><span className="vrm-gc-ligne-texte"><b>{tr('grp.nouveauCode')}</b><small>{tr('grp.nouveauCodeNote')}</small></span></button></li>
      <li><button type="button" className="vrm-gc-ligne-bouton vrm-gc-danger" onClick={fermerGroupe} data-cm-accomp-fermer><span className="vrm-gc-ligne-texte"><b>{tr('grp.fermerGroupe')}</b><small>{tr('grp.fermerNote')}</small></span></button></li>
    </ul>
    {msg && <p className="vrm-cm-msg" role="alert">{msg}</p>}
  </Feuille>;
}

function Rejoindre({ api, prenom, codeInitial = '', onFait, onFerme, FermeAuRetour }) {
  const [code, setCode] = useState(codeInitial), [apercu, setApercu] = useState(null);
  const [nom, setNom] = useState(String(prenom || '').slice(0, 40)), [partage, setPartage] = useState('rien');
  const [msg, setMsg] = useState(''), [occupe, setOccupe] = useState(false);
  const voir = useCallback(async (c) => {
    const t = codeTape(c);
    if (!CODE_RE.test(t)) { setMsg(tr('grp.rejoindre.codeForme')); return; }
    setOccupe(true); setMsg('');
    const r = await api({ action: 'accomp-apercu', code: t });
    setOccupe(false);
    if (!r.ok) { setApercu(null); setMsg(r.message || pasSu()); return; }
    setApercu({ ...r, code: t });
  }, [api]);
  useEffect(() => { if (codeInitial) voir(codeInitial); }, []);
  const demander = async () => {
    setOccupe(true); setMsg('');
    const r = await api({ action: 'accomp-demander', code: apercu.code, nom: nom.trim(), partage });
    setOccupe(false);
    if (!r.ok) { setMsg(r.message || pasSu()); return; }
    onFait(r);
  };
  return <Feuille titre={tr('grp.rejoindreTitre')} onFerme={onFerme} FermeAuRetour={FermeAuRetour} data={{ 'data-cm-accomp-feuille': 'rejoindre' }}>
    {!apercu ? <form onSubmit={(e) => { e.preventDefault(); voir(code); }}>
      <label className="vrm-cm-champ"><span>{tr('grp.rejoindre.code')}</span><input value={code} maxLength={12} autoCapitalize="characters" autoComplete="off" onChange={(e) => setCode(e.target.value)} placeholder={tr('grp.rejoindre.codeExemple')} data-cm-accomp-code-tape /></label>
      {msg && <p className="vrm-cm-msg" role="alert">{msg}</p>}
      <button type="submit" className="vrm-cm-primaire vrm-gc-plein" disabled={occupe || !code.trim()} data-cm-accomp-voir>{occupe ? tr('grp.unInstant') : tr('grp.rejoindre.voir')}</button>
    </form> : <div data-cm-accomp-apercu={apercu.code}>
      <div className="vrm-gc-apercu">
        <b>{apercu.nom}</b><small> · {tr('grp.rejoindre.parN', { nom: apercu.createur, n: apercu.membres })}</small>
        {apercu.description && <p>{apercu.description}</p>}
      </div>
      {apercu.createur_moi ? <p className="vrm-cm-msg" role="alert">{tr('grp.rejoindre.soi')}</p>
        : apercu.statut === 'attente' || apercu.statut === 'accepte' ? <p className="vrm-cm-msg" role="status">{apercu.statut === 'attente' ? tr('grp.rejoindre.dejaDemande') : tr('grp.rejoindre.dejaMembre')}</p>
        : <>
          <label className="vrm-cm-champ"><span>{tr('grp.creer.tonNom')}</span><input value={nom} maxLength={40} onChange={(e) => setNom(e.target.value)} placeholder={tr('grp.tonPrenom')} data-cm-accomp-moi required /></label>
          <ChoixPartage valeur={partage} onChange={setPartage} nomCreateur={apercu.createur} />
          <p className="vrm-cm-note">{tr('grp.rejoindre.note', { nom: apercu.createur })}</p>
          {msg && <p className="vrm-cm-msg" role="alert">{msg}</p>}
          <button type="button" className="vrm-cm-primaire vrm-gc-plein" onClick={demander} disabled={occupe || nom.trim().length < 2} data-cm-accomp-demander>{occupe ? tr('grp.unInstant') : tr('grp.rejoindre.demander')}</button>
        </>}
    </div>}
  </Feuille>;
}
