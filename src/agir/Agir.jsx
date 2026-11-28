// ═══════════════════════════════════════════════════════════════════════════
// LES BOUTONS DE LA PORTE (24 nov., lot agir-si-connecte) — la règle : src/agir/peutAgir.js
// ═══════════════════════════════════════════════════════════════════════════
//   <BoutonAgir site compte geste onClick>…</BoutonAgir>   un geste ; NON ⇒ visible, éteint, la raison et le geste dessous
//   <BadgeLectureSeule site compte/>                       « Lecture seule » à côté d'un compte qui ne peut rien faire
//   <ComposerReponse site compte conv/>                     le champ « Répondre » d'une conversation (Vinted, Leboncoin, Vestiaire)
//   <GestesOffreVinted compte tx oid conv prix contre/>     Accepter (confirmé) · Refuser · Proposer N €
// Un bouton éteint ne cache RIEN et n'envoie RIEN : le toucher ne fait que dire la raison (lecteur d'écran compris).
// Tout ce qui part passe par `envoyerGeste` (src/agir/porte.js) ⇒ la file `cmd_dist_*` exécutée par l'extension.
import React from 'react';
import { tr } from '../i18n/index.js';
import { Bouton, Feuille, Glyphe } from '../natif/index.js';
import { phraseSuivi, suiviTermine } from './suivi.js';
import { usePeutAgir, useCompteAgir, envoyerGeste, useSuiviCommande, agirOuPanneau, useFaitsAgir as useFaitsAgirA, envoyerSerie as envoyerSerieA, agirMaintenant as agirMaintenantA, faitsAgir as faitsAgirA } from './porte.js';
import { NOMS_SITES_AGIR } from './peutAgir.js';
import { motsNavigateur } from '../navigateurExtension.js';
import './agir.css';

// La phrase d'un « non » : la raison ET le geste, en une phrase (« Connecte l'extension sur shop_x : ouvre Vinted dans {nav} »).
export const remplirReponse = (site, conv, texte) => { try { window.dispatchEvent(new CustomEvent('vrm:agir-remplir', { detail: { site, conv: String(conv), texte } })); } catch (_) {} };

export function texteRaison(v) {
  if (!v || v.ok) return '';
  // Le navigateur NOMMÉ tel qu'il est (Chrome, Orion…), jamais « Chrome » en dur (`motsNavigateur`, audit-chrome-en-dur).
  const N = motsNavigateur();
  const vars = { compte: '—', site: 'Vinted', autre: '', version: '?', attendue: '', ou: '', nav: N.connu ? N.nom : tr('agir.nav.inconnu'), ...(v.vars || {}) };
  return tr(v.cle || 'agir.raison.passu', vars);
}

// (24 nov., lot messages-pro) `decrit` : l'id d'un bandeau qui dit DÉJÀ la raison (une fois par écran, CLAUDE.md §7) ⇒ le
// bouton éteint ne la répète pas dessous ; le lecteur d'écran la lit quand même (aria-describedby vers le bandeau).
export function BoutonAgir({ site, compte, geste, par = '', onClick, children, variante = 'teinte', icone = null, large = false, taille = 'normal', attrs = null, className = '', decrit = '' }) {
  const v = usePeutAgir(site, compte, geste, par);
  const a = { 'data-agir': v.ok ? 'ok' : 'lecture', 'data-agir-site': site, 'data-agir-geste': geste, 'data-agir-raison': v.ok ? undefined : v.raison, 'data-agir-voie': v.ok ? v.voie : undefined,
    ...(!v.ok && decrit ? { 'aria-describedby': decrit } : {}), ...(attrs || {}) };
  return <Bouton variante={variante} icone={icone} large={large} taille={taille} className={className} indisponible={!v.ok} raison={v.ok || decrit ? '' : texteRaison(v)}
    onClick={v.ok ? onClick : undefined} attrs={a}>{children}</Bouton>;
}

// (24 nov., lot messages-pro — Julien : « ça fait encore beaucoup trop vieux ») LE bandeau « Lecture seule » d'une
// conversation : UNE fois, en tête du fil, la raison de la porte (`peutAgir`, la même phrase qu'avant) et, quand le geste
// est d'ouvrir le site, « Ouvrir Vinted ». Les boutons éteints dessous ne la répètent pas (`decrit`). Rien n'est envoyé
// d'ici : ouvrir le site est un lien. La porte dit oui pour répondre ET pour l'offre ⇒ rien (ou `repli`, l'ancienne note).
export const idBandeau = (site, conv) => `vrm-mp-ro-${site}-${String(conv || '').replace(/[^A-Za-z0-9_-]/g, '')}`;
export function BandeauLectureSeule({ site, compte, conv, lien = '', gestes = ['repondre'], repli = null }) {
  const v1 = usePeutAgir(site, compte, gestes[0], 'file');
  const v2 = usePeutAgir(site, compte, gestes[1] || gestes[0], 'file');
  const v = !v1.ok ? v1 : (!v2.ok ? v2 : null);
  if (!v) return repli;
  const nom = NOMS_SITES_AGIR[site] || '';
  return (
    <div className="vrm-mp-bandeau" role="status" id={idBandeau(site, conv)} data-mp-bandeau={site} data-agir-raison={v.raison} data-agir-compte={String(compte == null ? '' : compte)}>
      <span className="vrm-mp-bandeau-ic" aria-hidden="true"><Glyphe nom="lock" taille={16}/></span>
      <span className="vrm-mp-bandeau-t"><b>{tr('agir.badge')}</b><span data-mp-raison="">{texteRaison(v)}</span></span>
      {lien && v.geste === 'ouvrir-site' ? <a className="vrm-mp-bandeau-a" href={lien} target="_blank" rel="noreferrer" data-mp-ouvrir={site} data-n-famille="second">{tr('mpro.ouvrir', { site: nom })}</a> : null}
    </div>
  );
}

export function BadgeLectureSeule({ site, compte }) {
  const e = useCompteAgir(site, compte);
  // 5.457 : un compte servi par l'ordinateur allumé, prêt ⇒ « ordinateur allumé · compte X prêt » (neutre, aucune couleur).
  if (e && !e.lecture && e.serveur) return <span className="vrm-agir-badge" data-agir-badge="serveur" data-agir-site={site} data-agir-compte={String(compte == null ? '' : compte)}>{tr(e.cle, e.vars)}</span>;
  if (!e || !e.lecture) return null;
  const raison = texteRaison(e.raison);
  return <span className="vrm-agir-badge" data-agir-badge="lecture" data-agir-site={site} data-agir-compte={String(compte == null ? '' : compte)} title={raison} aria-label={tr('agir.badge') + ' · ' + raison}>
    <span aria-hidden="true" className="vrm-agir-badge-point"/>{tr('agir.badge')}</span>;
}

// (24 nov., lot messages-pro) Montre ses enfants seulement si la porte laisse agir pour CES gestes (sinon le bandeau
// « Lecture seule » parle déjà : la raison n'est pas dite deux fois).
export function SiAgir({ site, compte, gestes = ['repondre'], children }) {
  const v1 = usePeutAgir(site, compte, gestes[0], 'file');
  const v2 = usePeutAgir(site, compte, gestes[1] || gestes[0], 'file');
  return v1.ok && v2.ok ? children : null;
}

// La ligne de l'issue d'un envoi : « Parti vers l'extension » · « Déjà en attente » · « Pas envoyé ».
export function issueTexte(r) {
  if (!r) return '';
  if (r.ok) return tr(r.voie === 'distance' ? 'agir.envoi.distance' : 'agir.envoi.ici');
  if (r.raison === 'deja') return tr('agir.envoi.deja');
  if (r.verdict) return texteRaison(r.verdict);
  return tr('agir.envoi.base');
}

// (25 nov., 5.452 `envoisurs`) L'ISSUE RÉELLE d'un geste déposé : relue jusqu'à ce que l'extension l'écrive (réponse LUE de
// Vinted) — « Envoyé : Vinted l'a confirmé », « Pas encore parti : plafond… reprise vers 14 h 10 », « Pas envoyé : … »,
// « Pas sûr : regarde avant de refaire ». Jamais « envoyé » sur un simple dépôt.
export function LigneSuivi({ id, onVue = null }) {
  const vue = useSuiviCommande(id);
  React.useEffect(() => { if (onVue) { try { onVue(vue); } catch (_) {} } }, [vue, onVue]);
  if (!id) return null;
  const p = phraseSuivi(vue);
  return <p className="vrm-agir-issue" role="status" aria-live="polite" data-agir-issue={p.etat === 'fait' ? 'ok' : p.etat} data-agir-suivi={p.etat}>{tr(p.cle, p.vars)}</p>;
}
// Le premier retour (avant le suivi) : déposé ⇒ le suivi prend la suite ; sinon la raison.
const IssueOuSuivi = ({ issue, onVue }) => (!issue ? null : issue.ok && issue.id ? <LigneSuivi id={issue.id} onVue={onVue}/>
  : <p className="vrm-agir-issue" role="status" data-agir-issue={issue.raison || 'non'}>{issueTexte(issue)}</p>);

// (24 nov., lot messages-pro) Le champ « Répondre » d'une messagerie de 2026 : une pilule qui grandit avec le texte (jusqu'à
// 5 lignes), le bouton d'envoi rond (une icône, nommé pour le lecteur d'écran), la zone sûre de l'iPhone respectée.
// `puces` : SES réponses rapides en puces défilantes au-dessus (un toucher REMPLIT le champ, rien ne part) — seulement quand
// on peut répondre. Lecture seule : PAS de champ géant gris — une barre fine qui dit pourquoi ; si un bandeau le dit déjà
// en tête du fil (`decrit` = son id), la barre ne le répète pas (la raison une fois par écran).
export function ComposerReponse({ site, compte, conv, max = 2000, onEnvoye = null, puces = null, decrit = '' }) {
  const [texte, setTexte] = React.useState('');
  const [issue, setIssue] = React.useState(null);
  const [enCours, setEnCours] = React.useState(false);   // déposé, issue pas encore écrite : pas de second envoi
  const surVue = React.useCallback((v) => { if (v === undefined || v === null) return; if (v.etat === 'fait') setTexte(''); setEnCours(!suiviTermine(v)); }, []);
  const champ = React.useRef(null);
  const v = usePeutAgir(site, compte, 'repondre', 'file');
  // Une réponse rapide touchée (src/ReponsesRapidesApp.jsx) remplit CE champ — rien ne part avant « Envoyer ».
  React.useEffect(() => {
    const f = (e) => { const d = e && e.detail; if (d && d.site === site && String(d.conv) === String(conv) && typeof d.texte === 'string') { setTexte(d.texte.slice(0, max)); try { if (champ.current) champ.current.focus({ preventScroll: true }); } catch (_) {} } };
    window.addEventListener('vrm:agir-remplir', f);
    return () => window.removeEventListener('vrm:agir-remplir', f);
  }, [site, conv, max]);
  // La pilule suit le texte (1 à 5 lignes), sans saut : la hauteur se mesure après le rendu.
  React.useLayoutEffect(() => { const t = champ.current; if (!t) return; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 132) + 'px'; }, [texte, v.ok]);
  const envoyer = async () => {
    const t = texte.trim(); if (!t || enCours) return;
    setEnCours(true);
    const r = await envoyerGeste({ site, compte, geste: 'repondre', distGeste: 'repondre', args: { conv: String(conv), texte: t } });
    setIssue(r);
    if (!r.ok) setEnCours(false);
    else if (onEnvoye) { try { onEnvoye(r); } catch (_) {} }   // le champ se vide quand Vinted a CONFIRMÉ (`surVue`), pas au dépôt
  };
  const nom = NOMS_SITES_AGIR[site] || '';
  const attrs = { 'data-agir-composer': site, 'data-agir-compte': String(compte == null ? '' : compte), 'data-agir': v.ok ? 'ok' : 'lecture' };
  if (!v.ok) return (
    <div className="vrm-agir-composer vrm-mp-compose vrm-mp-compose-ro" {...attrs} aria-describedby={decrit || undefined}>
      <span className="vrm-mp-compose-ro-ic" aria-hidden="true"><Glyphe nom="lock" taille={15}/></span>
      <span className="vrm-mp-compose-ro-t" data-mp-compose-ro={decrit ? 'bandeau' : 'raison'}>{decrit ? tr('mpro.compose.ro') : texteRaison(v)}</span>
    </div>
  );
  return (
    <div className="vrm-agir-composer vrm-mp-compose" {...attrs}>
      {puces}
      <div className="vrm-mp-compose-l">
        <textarea ref={champ} value={texte} onChange={(e) => setTexte(e.target.value.slice(0, max))} rows={1} maxLength={max} className="vrm-mp-champ"
          aria-label={tr('agir.repondre.place', { site: nom })} placeholder={tr('agir.repondre.place', { site: nom })}/>
        <BoutonAgir site={site} compte={compte} geste="repondre" par="file" variante="plein" className="vrm-mp-envoyer" icone={<Glyphe nom="send" taille={18}/>}
          onClick={texte.trim() ? envoyer : undefined} attrs={{ 'data-agir-envoyer': site, 'aria-label': tr('agir.repondre.envoyer'), 'data-mp-vide': texte.trim() ? undefined : '1', ...(enCours ? { 'aria-busy': 'true', 'data-agir-en-cours': '' } : {}) }}><span className="vrm-sr">{tr('agir.repondre.envoyer')}</span></BoutonAgir>
      </div>
      <IssueOuSuivi issue={issue} onVue={surVue}/>
    </div>
  );
}

const eur = (n) => { const x = Number(n); return Number.isFinite(x) ? x.toLocaleString(undefined, { style: 'currency', currency: 'EUR', minimumFractionDigits: Number.isInteger(x) ? 0 : 2 }) : '—'; };

// Les gestes d'une offre Vinted reçue (5.135 → file 5.436) : Accepter vend la paire ⇒ SA confirmation (§2.10) ;
// Refuser part en un toucher ; Proposer N € seulement quand N vient de SON prix mini (`contreOffreMini`).
// (24 nov., lot messages-pro) La paire de gestes d'une carte d'offre de 2026 : « Refuser » (second) et « Accepter N € »
// (LE geste, plein) côte à côte ; « Proposer N € » en geste discret dessous (tertiaire). Mêmes gestes, mêmes data-* ;
// Accepter DEMANDE toujours (il vend la paire). `decrit` : l'id du bandeau « Lecture seule » (la raison n'est pas répétée).
export function GestesOffreVinted({ compte, tx, oid, conv, prix, contre = null, decrit = '' }) {
  const [issue, setIssue] = React.useState(null);
  const [confirmer, setConfirmer] = React.useState(false);
  const base = { site: 'vinted', compte, geste: 'offre', decrit };
  const [enCours, setEnCours] = React.useState(false);   // un geste déposé, pas encore d'issue : aucun second geste sur CETTE offre
  const surVue = React.useCallback((v) => { if (v === undefined || v === null) return; setEnCours(!suiviTermine(v)); }, []);
  const partir = async (distGeste, args, confirme = false) => { if (enCours) return; setEnCours(true); const r = await envoyerGeste({ site: 'vinted', compte, geste: 'offre', distGeste, args, confirme }); setIssue(r); if (!r.ok) setEnCours(false); };
  const ids = { tx: String(tx), oid: String(oid), ...(conv != null ? { conv: String(conv) } : {}) };
  return (
    <div className="vrm-agir-offre vrm-mp-gestes" data-agir-offre={String(oid)}>
      <div className="vrm-mp-gestes-l">
        <BoutonAgir {...base} par="file" variante="teinte" className="vrm-mp-refuser" onClick={() => partir('refuser', ids)} attrs={{ 'data-agir-refuser': '' }}>{tr('agir.offre.refuser')}</BoutonAgir>
        <BoutonAgir {...base} par="file" variante="plein" className="vrm-mp-accepter" icone={<Glyphe nom="check" taille={17}/>} onClick={() => setConfirmer(true)} attrs={{ 'data-agir-accepter': String(prix) }}>{tr('agir.offre.accepter', { prix: eur(prix) })}</BoutonAgir>
      </div>
      {contre != null ? <BoutonAgir {...base} par="file" variante="texte" className="vrm-mp-contre" onClick={() => partir('contreOffre', { tx: String(tx), prix: contre, ...(conv != null ? { conv: String(conv) } : {}) })} attrs={{ 'data-agir-contre': String(contre) }}>{tr('agir.offre.contre', { prix: eur(contre) })}</BoutonAgir> : null}
      <IssueOuSuivi issue={issue} onVue={surVue}/>
      {confirmer ? <Feuille ouverte titre={tr('agir.offre.accepter', { prix: eur(prix) })} onFermer={() => setConfirmer(false)}
        pied={<Bouton variante="plein" onClick={() => { setConfirmer(false); partir('accepter', { ...ids, prix }, true); }} attrs={{ 'data-agir-accepter-confirmer': '' }}>{tr('agir.offre.confirmerOui')}</Bouton>}>
        <p className="vrm-agir-feuille-p">{tr('agir.offre.confirmer')}</p>
      </Feuille> : null}
    </div>
  );
}

// « Republier » d'UNE annonce Vinted depuis l'app (l'atelier de l'extension, `recreerVinted` : coffre → brouillon →
// suppression → en ligne, §3). Il supprime l'ancienne annonce ⇒ SA confirmation, toujours.
export function BoutonRepublierAgir({ compte, id, num = '', libelle = '' }) {
  const [issue, setIssue] = React.useState(null);
  const [confirmer, setConfirmer] = React.useState(false);
  return (
    <span className="vrm-agir-repub" data-agir-repub={String(id)}>
      <BoutonAgir site="vinted" compte={compte} geste="republier" par="file" onClick={() => setConfirmer(true)} attrs={{ 'data-agir-republier': String(id) }}>{libelle || tr('agir.republier')}</BoutonAgir>
      {issue ? <span className="vrm-agir-issue" role="status" data-agir-issue={issue.ok ? 'ok' : issue.raison || 'non'}>{issueTexte(issue)}</span> : null}
      {confirmer ? <Feuille ouverte titre={tr('agir.republier')} onFermer={() => setConfirmer(false)}
        pied={<Bouton variante="plein" onClick={async () => { setConfirmer(false); setIssue(await envoyerGeste({ site: 'vinted', compte, geste: 'republier', distGeste: 'republier', args: { id: String(id) }, confirme: true, num })); }} attrs={{ 'data-agir-republier-confirmer': String(id) }}>{tr('agir.republier.oui')}</Bouton>}>
        <p className="vrm-agir-feuille-p">{tr('agir.republier.confirmer')}</p>
      </Feuille> : null}
    </span>
  );
}

// ── (24 nov., lot agir-tout) LES GESTES LEBONCOIN DEPUIS VRM ─────────────────────────────────────────────────────────
// Le compte d'une annonce Leboncoin, par SON identité (`compte` / `account` / `lbcUser`, « lbc-account: » retiré) ; '' = pas su.
export const compteLbcDe = (r) => String((r && (r.compte || r.account || r.lbcUser)) || '').replace(/^lbc-account:/i, '');
// `confirmer({ titre, desc, ok, danger })` : la boîte de l'app (askConfirm) ; `panneau()` : l'ancien chemin (gardé).
export function pauseLbcAgir(r, { panneau } = {}) {
  return agirOuPanneau({ site: 'leboncoin', compte: compteLbcDe(r), geste: 'pause', distGeste: 'pause', args: { id: String(r.id) }, num: String(r.numero || ''), panneau, textes: { issue: issueTexte } });
}
export function supprimerLbcAgir(r, { confirmer, panneau } = {}) {
  return agirOuPanneau({ site: 'leboncoin', compte: compteLbcDe(r), geste: 'supprimer', distGeste: 'supprimer', num: String(r.numero || ''), panneau, textes: { issue: issueTexte },
    args: { id: String(r.id), numero: String(r.numero || ''), titre: String(r.titre || r.title || r.subject || '') },
    // SA confirmation « sans retour » (la même exigence que l'extension, `sansRetour`) : sans elle, rien ne part.
    confirmer: () => (typeof confirmer === 'function' ? confirmer({ title: tr('agir.lbc.supprimerTitre', { n: String(r.numero || '') }), desc: tr('agir.lbc.sansRetour'), ok: tr('agir.lbc.supprimerOui'), danger: true }) : Promise.resolve(false)) });
}
export function publierLbcAgir({ id, compte, numero = '' }, { panneau } = {}) {
  return agirOuPanneau({ site: 'leboncoin', compte, geste: 'publier', distGeste: 'publier', args: { id: String(id) }, num: String(numero || ''), panneau, textes: { issue: issueTexte } });
}

// ── (24 nov., lot agir-tout) MODE VACANCES DEPUIS VRM ────────────────────────────────────────────────────────────────
// Par compte Vinted : « Mettre en vacances » / « Retirer » — UNE commande `vacances` (la file ; l'extension lit l'état
// `is_on_holiday` avant, le RELIT après, geste rejoué seulement s'il a été APPRIS sur SON propre geste vinted.fr).
export function VacancesAgir({ comptes = [] }) {
  const [issue, setIssue] = React.useState({});
  const l = (Array.isArray(comptes) ? comptes : []).filter((a) => a && /^\d{1,20}$/.test(String(a.vinted_user_id || '')));
  const partir = async (uid, on) => { const r = await envoyerGeste({ site: 'vinted', compte: uid, geste: 'vacances', distGeste: 'vacances', args: { vacances: on } }); setIssue((x) => ({ ...x, [uid]: r })); };
  if (!l.length) return null;
  return (
    <div className="vrm-agir-vacances" data-agir-vacances={l.length} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {l.map((a) => { const uid = String(a.vinted_user_id), r = issue[uid]; return (
        <div key={uid} data-agir-vacances-compte={uid} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <b className="vrm-sensible">{a.label || a.login || uid} <BadgeLectureSeule site="vinted" compte={uid}/></b>
          <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <BoutonAgir site="vinted" compte={uid} geste="vacances" par="file" taille="compact" onClick={() => partir(uid, true)} attrs={{ 'data-agir-vacances-on': uid }}>{tr('agir.vacances.on')}</BoutonAgir>
            <BoutonAgir site="vinted" compte={uid} geste="vacances" par="file" taille="compact" variante="texte" onClick={() => partir(uid, false)} attrs={{ 'data-agir-vacances-off': uid }}>{tr('agir.vacances.off')}</BoutonAgir>
          </span>
          {r ? <small className="vrm-agir-issue" role="status" data-agir-issue={r.ok ? 'ok' : r.raison || 'non'}>{issueTexte(r)}</small> : null}
        </div>); })}
    </div>
  );
}

// ── (24 nov., lot agir-tout) « CRÉER SUR VINTED » DEPUIS VRM ──────────────────────────────────────────────────────────
// UN brouillon par fiche (la file `creer` ⇒ `creerVintedFiche`, le chemin du clic : compte de l'onglet, 45/h, N° lié à
// l'identifiant rendu ; IL publie). La fiche voyage LÉGÈRE : ses champs texte et les ADRESSES https de ses photos (une photo
// gardée seulement dans le navigateur ne voyage pas : la fiche est dite « à créer depuis l'ordinateur »).
export function ficheLegere(f) {
  if (!f || typeof f !== 'object') return null;
  const photos = (Array.isArray(f.photos) ? f.photos : []).map((p) => (typeof p === 'string' ? p : p && (p.url || p.src))).filter((u) => typeof u === 'string' && /^https:\/\//.test(u) && u.length <= 600).slice(0, 20);
  if (!photos.length) return null;
  const o = {};
  for (const [k, v] of Object.entries(f)) if (k !== 'photos' && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') && String(v).length <= 4000) o[k] = v;
  o.id = String(f.id || f.numero || ''); o.photos = photos;
  try { if (JSON.stringify(o).length > 28000) return null; } catch (_) { return null; }
  return o;
}
export function CreerVintedAgir({ fiches = [] }) {
  const faits = useFaitsAgirA();
  const [issue, setIssue] = React.useState(null);
  const l = (fiches || []).filter((f) => f && f.numero);
  const legeres = l.map(ficheLegere).filter(Boolean);
  const comptes = Object.entries((faits && faits.noms && faits.noms.vinted) || {});
  return (
    <div className="vrm-agir-creer" data-agir-creer={legeres.length} style={{ margin: '0 var(--n-marge, 16px) 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {comptes.map(([uid, nom]) => (
        <BoutonAgir key={uid} site="vinted" compte={uid} geste="creer" par="file" attrs={{ 'data-agir-creer-compte': uid }}
          onClick={async () => setIssue(await envoyerSerieA('creer', 'creer', legeres.map((f) => ({ site: 'vinted', compte: uid, num: String(f.numero || ''), args: { fiche: f } }))))}>
          {tr('agir.creer.sur', { n: legeres.length, compte: nom || uid })}</BoutonAgir>))}
      {legeres.length < l.length ? <small data-agir-creer-lourdes={l.length - legeres.length}>{tr('agir.creer.lourdes', { n: l.length - legeres.length })}</small> : null}
      {issue ? <small className="vrm-agir-issue" role="status" data-agir-issue={issue.n ? 'ok' : 'non'}>{issue.n ? tr('agir.baisse.parti', { n: issue.n }) : (texteRaison(issue.verdict) || tr('agir.envoi.base'))}</small> : null}
    </div>
  );
}

// ── (24 nov., lot agir-tout) PUBLIER SUR LEBONCOIN DEPUIS VRM ─────────────────────────────────────────────────────────
// Leboncoin publie au nom du compte de l'onglet : le compte Leboncoin choisi est celui qu'une extension connectée a ouvert
// (la porte, voie file) ; aucun ⇒ le panneau (gardé). `id` : l'identifiant de l'annonce Vinted source (la paire, §5).
export function compteLbcOuvertAgir(faits) {
  const noms = (faits && faits.noms && faits.noms.leboncoin) || {};
  const ids = new Set(Object.keys(noms));
  for (const p of Array.isArray(faits && faits.presences) ? faits.presences : []) for (const c of p.comptes || []) if (c && c.site === 'leboncoin') ids.add(String(c.id).replace(/^lbc-account:/i, ''));
  for (const id of ids) if (agirMaintenantA('leboncoin', id, 'publier', 'file').ok) return id;
  return '';
}
export function publierLbcDepuisVrm(id, { panneau, numero = '' } = {}) {
  const compte = compteLbcOuvertAgir(faitsAgirA());
  if (!compte) { if (typeof panneau === 'function') panneau(); return Promise.resolve({ panneau: true }); }
  return publierLbcAgir({ id, compte, numero }, { panneau });
}

// ── (24 nov., lot agir-tout) eBAY : LE JETON ─────────────────────────────────────────────────────────────────────────
// Jeton expiré ou compte pas relié ⇒ lecture seule : les données eBay restent, une ligne grise dit pourquoi, UN bouton
// « Reconnecter eBay ». Pas su ⇒ rien (les écrans eBay disent déjà leurs refus).
export function EbayLectureSeule({ compte = 'principal', onReconnecter = null }) {
  const v = usePeutAgir('ebay', compte, 'x');
  if (v.ok || (v.raison !== 'ebay-expire' && v.raison !== 'ebay-jeton')) return null;
  return (
    <div className="vrm-agir-ebay" role="status" data-agir-ebay={v.raison} data-agir-compte={String(compte)} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', margin: '8px 0', padding: '10px 12px', borderRadius: 12, background: 'var(--n-inactif, rgba(118,118,128,0.12))', color: 'var(--n-encre-2, #6e6e73)' }}>
      <span className="vrm-agir-badge"><span aria-hidden="true" className="vrm-agir-badge-point"/>{tr('agir.badge')}</span>
      <span style={{ flex: 1, minWidth: 160 }}>{texteRaison(v)}</span>
      {onReconnecter ? <Bouton variante="teinte" taille="compact" onClick={onReconnecter} attrs={{ 'data-agir-ebay-reconnecter': '' }}>{tr('agir.ebay.reconnecter')}</Bouton> : null}
    </div>
  );
}
