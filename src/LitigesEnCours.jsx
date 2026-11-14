// ══════════════════════════════════════════════════════════════════════════════
//  L'ÉCRAN « LITIGES EN COURS » (10 nov., lots BB et BI)
//  Julien (non développeur) : « peu de texte, du visuel ». Donc UNE CARTE PAR
//  VENTE en litige ou en retour : la photo de son annonce (identité), son N°, ce
//  qui se passe en un mot, la date limite LUE (sinon « Date limite non lue »), et
//  les PREUVES déjà rangées pour cette vente en quatre pastilles (photo, suivi,
//  bordereau, carton — le carton viendra du lot AZ : son emplacement est là). Un
//  seul geste : un LIEN vers le site (son clic), jamais une action de VRM.
//  Puis « Retours par modèle » : une barre par modèle, « 2 sur 15 ». Le modèle
//  est un regroupement d'affichage (src/ceQuiRapporte.js), aucune action dessus.
//  Les nombres et les règles : src/litigesEcran.js. Style : src/styles-litiges.css
//  (direction artistique 6 : widgets blancs ; ambre = un geste ; jamais de rouge).
// ══════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { GroupeIos, RangeeIos } from './composants/Ios.jsx';
import { phraseLimite, texteRetours, NOM_SITE } from './litigesEcran.js';
import { texteTauxRetours } from './argentPrixTextes.js';   // (14 nov., lot argent-prix — 112) les deux taux, chacun à part
import './styles-litiges.css';
import './argent-prix.css';
import { BoutonPasAPas } from './RetoursLitiges.jsx';
import { tr } from './i18n/index.js';
import { trj } from './i18n/react.js';

const svg = (d, extra = {}) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...extra}>{d}</svg>
);
const ICONES = {
  photo: svg(<><rect x="3" y="5" width="18" height="15" rx="3"/><circle cx="12" cy="12.5" r="3.5"/><path d="M8 5l1.5-2h5L16 5"/></>),
  suivi: svg(<><path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/></>),
  bordereau: svg(<><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 13h7M9 17h5"/></>),
  carton: svg(<><path d="M3 8l9-4 9 4-9 4z"/><path d="M3 8v9l9 4 9-4V8"/><path d="M12 12v9"/></>),
};
const COCHE = svg(<path d="M5 12.5l4.5 4.5L19 7.5"/>, { width: 14, height: 14, strokeWidth: 2.6 });
const MOTS_PREUVE = { photo: 'Photo', suivi: 'Suivi', bordereau: 'Bordereau', carton: 'Carton' };

// Une pastille de preuve : l'icône, un mot, et ce qui est rangé (✓, le statut, « bientôt »).
function Preuve({ type, p }) {
  const etat = (p && p.etat) || 'aucun';
  let valeur = null, titre = MOTS_PREUVE[type];
  if (etat === 'ok') {
    if (type === 'suivi') { valeur = p.statut || 'n° rangé'; titre = `Suivi ${p.n}${p.statut ? ' : ' + p.statut : ''}`; }
    else valeur = COCHE;
  } else if (etat === 'a-venir') valeur = 'bientôt';
  else if (etat === 'encours') valeur = '…';
  else if (etat === 'passu') { valeur = 'pas lu'; if (type === 'suivi' && p.n) titre = `Suivi ${p.n} : statut pas lu`; }
  else valeur = '—';
  return (
    <span className="vrm-lit-preuve" data-preuve={type} data-preuve-etat={etat} data-preuve-suivi={type === 'suivi' && p && p.n ? p.n : undefined} title={titre}>
      <span className="vrm-lit-preuve-icone">{ICONES[type]}</span>
      <span className="vrm-lit-preuve-mot">{MOTS_PREUVE[type]}</span>
      <span className="vrm-lit-preuve-val">{valeur}</span>
    </span>
  );
}

function Carte({ c, Photo, onDossier = null, onPasAPas = null }) {
  const P = Photo || (() => null);   // (11 nov.) sans la règle des photos (PhotoVinted), aucune <img> brute
  const ph = c.preuves && c.preuves.photo && c.preuves.photo.etat === 'ok' ? c.preuves.photo.src : '';
  const tuile = <span className="vrm-lit-tuile" aria-hidden="true">{ICONES.photo}</span>;
  return (
    <article className="vrm-lit-carte" data-litige-carte={c.cle} data-litige-genre={c.genre} data-litige-plateforme={c.plateforme}
      data-litige-num={c.num || ''} data-litige-limite={c.limite || ''} data-litige-limite-lue={c.limiteTexte ? '1' : '0'} data-litige-presse={c.presse ? '1' : '0'}>
      <div className="vrm-lit-haut">
        {ph ? <P src={ph} alt="" loading="lazy" className="vrm-lit-photo" repli={tuile}/> : tuile}
        <div className="vrm-lit-textes">
          <span className="vrm-lit-num">{c.num ? `N°${c.num}` : tr('ventes.sans')}</span>
          <span className="vrm-lit-genre">{c.libelle}{c.etape ? ` · ${c.etape}` : ''}{c.plateforme === 'ebay' ? ' · eBay' : ''}</span>
          <span className={'vrm-lit-limite' + (c.presse ? ' is-presse' : '')} data-litige-phrase-limite="">{phraseLimite(c)}</span>
        </div>
      </div>
      <div className="vrm-lit-preuves" data-litige-preuves="">
        {['photo', 'suivi', 'bordereau', 'carton'].map((t) => <Preuve key={t} type={t} p={c.preuves && c.preuves[t]}/>)}
      </div>
      {c.titre ? <p className="vrm-lit-titre" title={c.titre}>{c.titre}</p> : null}
      {c.geste && c.geste.url ? (
        <a className="vrm-lit-geste" href={c.geste.url} target="_blank" rel="noreferrer" data-litige-geste={c.geste.url}>{c.geste.libelle} ↗</a>
      ) : null}
      {onPasAPas ? <BoutonPasAPas c={c} onOuvrir={onPasAPas}/> : null}
      {onDossier ? <Dossier c={c} onDossier={onDossier}/> : null}
    </article>
  );
}

// (10 nov., lot BJ) « Dossier PDF » : fabriqué dans le navigateur (src/dossierLitige.js), rien
// n'est envoyé. La page du bordereau porte l'adresse de l'acheteur : jointe seulement s'il coche.
function Dossier({ c, onDossier }) {
  const [etat, setEtat] = React.useState('');
  const [avecB, setAvecB] = React.useState(false);
  const bordOk = !!(c.preuves && c.preuves.bordereau && c.preuves.bordereau.etat === 'ok');
  const lancer = async () => {
    if (etat === 'encours') return;
    setEtat('encours');
    let r = 'passu';
    try { r = await onDossier(c, { avecBordereau: bordOk && avecB }); } catch (_) { r = 'passu'; }
    setEtat(r === 'ok' ? 'ok' : 'passu');
  };
  return (
    <div className="vrm-lit-dossier" data-litige-dossier={etat || 'pret'}>
      <button type="button" className="vrm-lit-dossier-b" data-litige-dossier-b={c.cle} onClick={lancer} disabled={etat === 'encours'} aria-busy={etat === 'encours' ? 'true' : undefined}>
        {ICONES.bordereau}<span>{etat === 'encours' ? tr('ventes.creation') : tr('ventes.dossierPdf')}</span>
      </button>
      {bordOk ? (
        <label className="vrm-lit-dossier-case">
          <input type="checkbox" checked={avecB} onChange={(e) => setAvecB(e.target.checked)} data-litige-dossier-bordereau=""/>
          <span>{tr('ventes.joindreBordereau')} <small>{tr('ventes.porteAdresse')}</small></span>
        </label>
      ) : null}
      {etat === 'ok' ? <span className="vrm-lit-dossier-msg" role="status" data-litige-dossier-ok="">{tr('ventes.pdfTelecharge')}</span> : null}
      {etat === 'passu' ? <span className="vrm-lit-dossier-msg is-passu" role="status" data-litige-dossier-passu="">{tr('ventes.pdfCreeReessaie')}</span> : null}
    </div>
  );
}

function RetoursParModele({ bi }) {
  const [tout, setTout] = React.useState(false);
  if (!bi) return null;
  const MAX = 10;
  const lignes = bi.etat === 'lu' ? bi.lignes : [];
  const montrees = tout ? lignes : lignes.slice(0, MAX);
  const maxTaux = Math.max(0.0001, ...lignes.map((l) => l.taux || 0));
  return (
    <section className="vrm-lit-bi" data-retours-modeles={bi.etat} data-retours-inconnues={bi.inconnues || 0} aria-label={tr('ventes.retoursModele')}>
      <h2 className="vrm-lit-h2">{tr('ap.ret.titre')}</h2>
      {bi.etat === 'lu' && bi.couverture && bi.couverture.ventes > 0 ? <p className="vrm-lit-note" data-retours-couverture={bi.couverture.ventes} data-retours-sans-modele={bi.couverture.sansModele}>{tr('ap.ret.couverture', { n: bi.couverture.ventes, s: bi.couverture.sansModele })}</p> : null}
      {bi.etat === 'encours' ? <p className="vrm-lit-note" role="status">{tr('messages.lecture')}</p> : null}
      {bi.etat === 'passu' ? <p className="vrm-lit-note" data-retours-passu="">{tr('ventes.ventesOntPu')}</p> : null}
      {bi.etat === 'lu' && !lignes.length ? <p className="vrm-lit-note">{tr('ventes.aucuneVenteLue')}</p> : null}
      {lignes.length ? (
        <div className="vrm-lit-bi-carte">
          {montrees.map((l) => (
            <div key={l.cle || 'autres'} className="vrm-lit-bi-ligne" data-retours-modele={l.cle || 'autres'} data-retours-n={l.total} data-ventes-n={l.ventes} data-au-moins={l.auMoins ? '1' : '0'}
              data-taux-retour={l.tauxRetour == null ? '' : l.tauxRetour} data-taux-litige={l.tauxLitige == null ? '' : l.tauxLitige} data-n-retours={l.retours} data-n-litiges={l.litiges}>
              <span className="vrm-lit-bi-nom">{l.nom}<small className="vrm-ap-sous">{texteTauxRetours(l)}</small></span>
              <span className="vrm-lit-bi-barre" aria-hidden="true"><span style={{ width: `${l.taux ? Math.max(4, Math.round((l.taux / maxTaux) * 100)) : 0}%` }}/></span>
              <span className="vrm-lit-bi-val">{texteRetours(l)}</span>
            </div>
          ))}
          {lignes.length > MAX ? (
            <button type="button" className="vrm-lit-bi-plus" data-retours-tout={lignes.length - MAX} onClick={() => setTout((x) => !x)}>{tout ? tr('stock.moins') : tr('ventes.modeles', { x: String(lignes.length - MAX) })}</button>
          ) : null}
        </div>
      ) : null}
      {bi.etat === 'lu' && bi.inconnues > 0 ? <p className="vrm-lit-note" data-retours-cause-non-lue={bi.inconnues}>{trj('ventes.ventesRembourseesCause', { n: bi.inconnues })}</p> : null}
      {bi.manques && bi.manques.length ? <p className="vrm-lit-note" data-retours-manques={bi.manques.join('|')}>{trj('ventes.lu3', { x: bi.manques.join(', ') })}</p> : null}
    </section>
  );
}

export default function LitigesEnCours({ r, bi, Photo = null, entete = null, onDossier = null, onPasAPas = null }) {
  if (!r) return null;
  const n = r.cartes.length;
  const partiel = r.manques.length > 0;
  return (
    <div className="vrm-lit" data-litiges-ecran={r.etat} data-litiges-n={r.etat === 'lu' ? n : ''} data-litiges-partiel={partiel ? '1' : '0'}>
      {entete}
      {r.etat === 'encours' ? <p className="vrm-lit-note" role="status">{tr('stats.lectureVentes')}</p> : null}
      {r.etat === 'passu' ? <p className="vrm-lit-note" data-litiges-passu="">{tr('ventes.ventesOntPu2')}</p> : null}
      {r.etat === 'lu' && n > 0 ? (
        <div className="vrm-lit-resume" data-litiges-resume={n}>
          {partiel ? <span>{tr('stats.moins2')}</span> : null}<b className="vrm-lit-total">{n}</b><span>{tr('ventes.cours')}</span>
        </div>
      ) : null}
      {r.etat === 'lu' && n > 0 ? <div className="vrm-lit-grille">{r.cartes.map((c) => <Carte key={c.cle} c={c} Photo={Photo} onDossier={onDossier} onPasAPas={onPasAPas}/>)}</div> : null}
      {r.etat === 'lu' && n === 0 ? (
        <div className="vrm-lit-vide vrm-vide-dessin" data-litiges-vide={partiel ? 'partiel' : 'zero'}>
          <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true"><circle cx="36" cy="36" r="34" fill="currentColor" opacity=".10"/><path d="M22 37.5 31.5 47 50 26" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <p className="vrm-lit-vide-titre">{partiel ? tr('ventes.aucunLitigeDans') : tr('ventes.aucunLitigeCours')}</p>
        </div>
      ) : null}
      {r.anciennes.length ? (
        <details className="vrm-lit-anciennes vrm-repli" data-litiges-anciennes={r.anciennes.length}>
          <summary>{trj('ventes.plusAnciensEcheance', { n: r.anciennes.length })}</summary>
          <div className="vrm-lit-grille">{r.anciennes.map((c) => <Carte key={c.cle} c={c} Photo={Photo} onDossier={onDossier} onPasAPas={onPasAPas}/>)}</div>
        </details>
      ) : null}
      {r.plateformes.length > 1 || partiel ? (
        <GroupeIos titre={tr('ventes.vrmLit')} data-litiges-plateformes="" className="vrm-lit-sites">
          {r.plateformes.map((p) => (
            <RangeeIos key={p.site} data-litiges-site={p.site} data-litiges-site-etat={p.etat}
              titre={NOM_SITE[p.site] || p.site} detail={p.raison || null} valeur={p.etat === 'lu' ? '✓' : p.etat === 'encours' ? '…' : '—'}/>
          ))}
        </GroupeIos>
      ) : null}
      <RetoursParModele bi={bi}/>
    </div>
  );
}

// L'entrée depuis Ventes (10 nov.) : une rangée qui OUVRE l'écran. Le nombre est celui que
// l'écran a publié pour « À trancher » (`ligne` de src/aTrancher.js) — consommé, jamais
// recompté ici (§11) ; pas su ⇒ pas de nombre (jamais « 0 »).
export function EntreeLitiges({ ligne, onOuvrir }) {
  const n = ligne && Number.isInteger(ligne.n) ? ligne.n : null;
  return (
    <button type="button" className="vrm-lit-entree" data-entree-litiges={n == null ? '' : n} onClick={onOuvrir}>
      <span className="vrm-lit-entree-icone" aria-hidden="true">{ICONES.carton}</span>
      <span className="vrm-lit-entree-mot">{tr('ventes.litigesRetours')}</span>
      {n > 0 ? <span className="vrm-lit-entree-n">{n}</span> : null}
      <svg className="vrm-lit-entree-chevron" width="8" height="13" viewBox="0 0 8 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m1.5 1.5 5 5-5 5"/></svg>
    </button>
  );
}
