// ── LA FEUILLE « PUBLIER PARTOUT » (11 nov.) — règle : src/publierPartout.js ──
// UNE feuille pour une annonce Vinted ou plusieurs (Annonces → Actions) : chaque
// site (Leboncoin, Vestiaire, eBay) avec ce qui partira dans SES mots (titre à sa
// limite, prix réglé par site, état, catégorie, photos), ce qui MANQUE (demandé
// ici, jamais inventé), une case par site, puis UN bouton. Pendant l'envoi,
// l'état de chaque case (publié ✓ relu · à finir sur le site · refusé + raison).
// Cette feuille n'envoie rien elle-même : `onLancer` passe par les voies
// existantes (hôte : HotePublierPartout, App.jsx). Accent rare (§7) : le bouton
// principal ; l'ambre pour un manque bloquant ou un refus.
import React from 'react';
import { createPortal } from 'react-dom';
import { tr } from './i18n/index.js';
import { useLangue } from './i18n/react.js';
import { LogoSite } from './SelecteurSites.jsx';
import { SITES_PARTOUT, NOM_PARTOUT, TITRE_MAX_PARTOUT, PRIX_REGLABLE, MODES_PRIX, texteReglage, cleCase, etatAffiche, resumePartout, CHAMPS_PARTOUT, sousCategoriesLbc, AU_DEPOT, PROFIL } from './publierPartout.js';
import './styles-annonces-outils.css';
import './styles-publier-partout.css';

const eur = (n) => (n == null ? '—' : `${(Math.round(n * 100) / 100).toFixed(Number.isInteger(n) ? 0 : 2).replace('.', ',')} €`);
const ETAT_CLE = { envoi: 'partout.etat.envoi', attente: 'partout.etat.attente', publie: 'partout.etat.publie', 'publie-relu': 'partout.etat.relu', 'a-finir': 'partout.etat.aFinir', refuse: 'partout.etat.refuse', 'pas-envoye': 'partout.etat.pasEnvoye' };

function ReglagePrix({ reglage, onReglage, bloque }) {
  // Le mode CHOISI (« ± euros ») vit ici tant qu'aucun écart n'est tapé : la règle range un
  // écart nul comme « prix Vinted », et le champ disparaissait avant qu'il puisse taper.
  const [modes, setModes] = React.useState({});
  return (
    <section className="vrm-pp-reglage" data-pp-reglage="" aria-label={tr('partout.prix.titre')}>
      <h3>{tr('partout.prix.titre')}</h3>
      {SITES_PARTOUT.map((site) => {
        const r0 = (reglage && reglage[site]) || { mode: 'egal', valeur: 0 };
        const r = r0.mode === 'egal' && modes[site] && modes[site] !== 'egal' ? { mode: modes[site], valeur: 0 } : r0;
        if (!PRIX_REGLABLE[site]) {
          return (
            <div key={site} className="vrm-pp-reglage-ligne" data-pp-reglage-site={site} data-pp-reglable="0">
              <span className="vrm-pp-site-nom"><LogoSite site={site}/>{NOM_PARTOUT[site]}</span>
              <small>{tr('partout.prix.vestiaire')}</small>
            </div>
          );
        }
        return (
          <div key={site} className="vrm-pp-reglage-ligne" data-pp-reglage-site={site} data-pp-reglable="1" data-pp-mode={r.mode}>
            <span className="vrm-pp-site-nom"><LogoSite site={site}/>{NOM_PARTOUT[site]}</span>
            <select value={r.mode} disabled={bloque} aria-label={tr('partout.prix.mode', { site: NOM_PARTOUT[site] })} data-pp-mode-choix={site}
              onChange={(e) => { const m = e.target.value; setModes((x) => ({ ...x, [site]: m })); onReglage(site, { mode: m, valeur: m === 'egal' ? 0 : r.valeur }); }}>
              {MODES_PRIX.map((m) => <option key={m} value={m}>{tr('partout.prix.' + m)}</option>)}
            </select>
            {r.mode !== 'egal' ? (
              <input inputMode="decimal" autoComplete="off" disabled={bloque} defaultValue={r.valeur ? String(r.valeur).replace('.', ',') : ''} placeholder={r.mode === 'pct' ? '−10' : '+5'}
                aria-label={tr('partout.prix.valeur', { site: NOM_PARTOUT[site] })} data-pp-valeur={site}
                onBlur={(e) => onReglage(site, { mode: r.mode, valeur: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}/>
            ) : null}
            <b className="vrm-pp-reglage-texte" data-pp-reglage-texte={site}>{texteReglage(r) === 'prix Vinted' ? tr('partout.prix.egal') : texteReglage(r)}</b>
          </div>
        );
      })}
    </section>
  );
}

// ── LES PARAMÈTRES D'UN SITE (11 nov. soir) ─────────────────────────────────
// Un champ = une ligne : son nom, sa valeur (celle de l'annonce, du défaut, ou ce
// que la voie posera d'elle-même : « Auto · … »), et un réglage. Une liste quand le
// site a un vocabulaire mesuré (catégories, états, oui/non), sinon un texte court.
const montre = (v) => (v === 'oui' || v === 'non' || v === 'aucune' ? tr('partout.val.' + v) : v === AU_DEPOT ? tr('partout.val.auDepot') : v === PROFIL ? tr('partout.val.profil') : v);
function listeDe(d, etatsLbc, categorie) {
  if (d.choix === 'etatsLbc') return etatsLbc;
  if (d.choix === 'lbcSous') return sousCategoriesLbc(categorie);
  return Array.isArray(d.choix) ? d.choix : null;
}
function ChampControle({ site, d, valeur, vide, onChange, etatsLbc, categorie, disabled, quoi }) {
  const nom = tr('partout.champ.' + d.champ);
  const liste = listeDe(d, etatsLbc, categorie);
  const data = { 'data-pp-champ': `${site}:${d.champ}`, 'data-pp-champ-quoi': quoi };
  if (d.lecture) return <span className="vrm-pp-champ-fixe" {...data}>{montre(d.fixe)}</span>;
  if (liste) {
    return (
      <select value={valeur || ''} disabled={disabled} aria-label={nom} onChange={(e) => onChange(e.target.value)} {...data}>
        <option value="">{vide}</option>
        {liste.map((v) => <option key={v} value={v}>{montre(v)}</option>)}
      </select>
    );
  }
  return <input type="text" autoComplete="off" maxLength={60} disabled={disabled} aria-label={nom} placeholder={vide} defaultValue={valeur || ''} key={valeur || ''}
    onBlur={(e) => { if (e.target.value.trim() !== (valeur || '')) onChange(e.target.value.trim()); }} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} {...data}/>;
}
// Le réglage PAR DÉFAUT, pour toutes les annonces (rangé dans vrm_partout_params).
function ReglageParams({ params, onParam, etatsLbc, bloque, ebayReglages = [] }) {
  const [ouvert, setOuvert] = React.useState(false);
  return (
    <section className="vrm-pp-reglage" data-pp-defauts={ouvert ? 'ouvert' : 'ferme'} aria-label={tr('partout.defaut.titre')}>
      <button type="button" className="vrm-pp-apercu-bouton vrm-pp-defauts-bouton" aria-expanded={ouvert} onClick={() => setOuvert((v) => !v)} data-pp-defauts-bouton="">
        <span>{tr('partout.defaut.titre')}</span><span aria-hidden="true">{ouvert ? '−' : '+'}</span>
      </button>
      {ouvert ? (
        <>
          <p className="vrm-pp-aide">{tr('partout.defaut.aide')}</p>
          {['leboncoin', 'vestiaire'].map((site) => (
            <div key={site} className="vrm-pp-defaut-site" data-pp-defaut-site={site}>
              <span className="vrm-pp-site-nom"><LogoSite site={site}/>{NOM_PARTOUT[site]}</span>
              {CHAMPS_PARTOUT[site].map((d) => (
                <label key={d.champ} className="vrm-pp-champ">
                  <span>{tr('partout.champ.' + d.champ)}</span>
                  <ChampControle site={site} d={d} valeur={(params && params[site] && params[site][d.champ]) || ''} vide={tr('partout.auto.annonce')} etatsLbc={etatsLbc}
                    categorie={(params && params[site] && params[site].categorie) || ''} disabled={bloque} quoi="defaut" onChange={(v) => onParam(site, d.champ, v)}/>
                </label>
              ))}
            </div>
          ))}
          <div className="vrm-pp-defaut-site" data-pp-defaut-site="ebay">
            <span className="vrm-pp-site-nom"><LogoSite site="ebay"/>{NOM_PARTOUT.ebay}</span>
            <p className="vrm-pp-aide" data-pp-ebay-reglages={ebayReglages.length}>{ebayReglages.length ? tr('partout.ebay.reglages', { liste: ebayReglages.join(' · ') }) : tr('partout.ebay.usine')}</p>
            <p className="vrm-pp-aide" data-pp-ebay-params="">{tr('partout.ebay.params')}</p>
          </div>
        </>
      ) : null}
    </section>
  );
}
// Les paramètres de CETTE annonce sur CE site, avec la valeur qui partira.
function ChampsAnnonce({ l, x, saisie, onParamAnnonce, etatsLbc, enCours }) {
  const ann = (saisie && saisie.params && saisie.params[x.site]) || {};
  const defs = CHAMPS_PARTOUT[x.site] || [];
  const cat = (x.champs.find((c) => c.champ === 'categorie') || {}).valeur || '';
  return x.champs.map((c) => {
    const d = defs.find((y) => y.champ === c.champ) || c;
    const vide = c.source === 'defaut' ? tr('partout.auto.defaut', { v: montre(c.valeur) })
      : c.auto != null ? tr('partout.auto.vu', { v: montre(c.auto) }) : tr('partout.auto.rien');
    const note = c.effet === 'sur-site' ? tr('partout.effet.surSite', { site: NOM_PARTOUT[x.site] }) : c.effet === 'perdu' ? tr('partout.effet.perdu') : c.effet === 'bloque' ? tr('partout.effet.bloque') : '';
    return (
      <div key={c.champ} className={'vrm-pp-champ' + (c.demande ? ' is-demande' : '')} data-pp-champ-ligne={`${l.id}:${x.site}:${c.champ}`} data-pp-source={c.source || ''} data-pp-effet={c.effet || ''} data-pp-valeur-champ={c.valeur == null ? '' : c.valeur}>
        <span>{tr('partout.champ.' + c.champ)}{c.demande ? <small className="vrm-pp-demande-mot">{tr('partout.demande.champ')}</small> : null}</span>
        <ChampControle site={x.site} d={d} valeur={ann[c.champ] || ''} vide={vide} etatsLbc={etatsLbc} categorie={cat} disabled={enCours} quoi="annonce"
          onChange={(v) => onParamAnnonce(l.id, x.site, c.champ, v)}/>
        {note ? <small className={'vrm-pp-champ-note' + (c.effet === 'bloque' || c.effet === 'sur-site' ? ' is-geste' : '')}>{note}</small> : null}
      </div>
    );
  });
}

function CaseSite({ l, x, coche, onCoche, resultat, vu, enCours, seul, saisie, onSaisie, onParamAnnonce, etatsLbc, Photo }) {
  const [ouvert, setOuvert] = React.useState(!!seul);
  const ap = x.apercu || {};
  const max = TITRE_MAX_PARTOUT[x.site];
  const aff = etatAffiche(resultat, vu);
  const bloquants = x.manques.filter((m) => m.bloque);
  const raisonCase = x.raison === 'deja' ? tr('partout.raison.deja', { site: NOM_PARTOUT[x.site] })
    : x.raison === 'ext' ? x.extRaison
    : x.raison === 'pas-de-numero' ? tr('partout.raison.numero')
    : x.raison === 'manque' ? tr('partout.raison.manque', { n: bloquants.length })
    : x.deja === null ? tr('partout.raison.passu', { site: NOM_PARTOUT[x.site] }) : '';
  const categorie = x.vocab && x.vocab.categorieQuand === 'au-depart' ? tr('partout.cat.ebay')
    : x.vocab && x.vocab.categorieQuand === 'sur-le-site' ? tr('partout.cat.site', { site: NOM_PARTOUT[x.site] })
    : (x.vocab && x.vocab.categorie) || '—';
  const etat = x.site === 'vestiaire' ? tr('partout.cat.site', { site: NOM_PARTOUT[x.site] }) : (x.vocab && x.vocab.etat) || '—';
  const id = `pp-${l.id}-${x.site}`;
  return (
    <li className="vrm-pp-case" data-pp-case={cleCase(l.id, x.site)} data-pp-site={x.site} data-pp-cochable={x.cochable ? '1' : '0'} data-pp-deja={x.deja === true ? '1' : x.deja === false ? '0' : ''}
      data-pp-raison={x.raison || ''} data-pp-resultat={aff || ''}>
      <div className="vrm-pp-case-tete">
        <label className="vrm-pp-coche" htmlFor={id}>
          <input id={id} type="checkbox" checked={!!coche} disabled={!x.cochable || enCours} onChange={() => onCoche(cleCase(l.id, x.site))} data-pp-coche={cleCase(l.id, x.site)}/>
          <span className="vrm-pp-site-nom"><LogoSite site={x.site}/>{NOM_PARTOUT[x.site]}</span>
        </label>
        <span className="vrm-pp-resume" data-pp-prix={ap.prix == null ? '' : String(ap.prix)}>{eur(ap.prix)}</span>
        {aff ? (
          <span className={'vrm-pp-etat is-' + aff} data-pp-etat={aff} role="status">
            {tr(ETAT_CLE[aff] || 'partout.etat.envoi')}
            {resultat && resultat.raison ? <small data-pp-etat-raison="">{resultat.raison}</small> : null}
          </span>
        ) : null}
      </div>
      {raisonCase && !aff ? <p className={'vrm-pp-raison' + (x.raison && x.raison !== 'deja' ? ' is-geste' : '')} data-pp-raison-texte="">{raisonCase}</p> : null}
      {x.manques.length && x.raison !== 'deja' ? (
        <ul className="vrm-pp-manques" data-pp-manques={x.manques.length}>
          {x.manques.map((m) => <li key={m.code} data-pp-manque={m.code} data-bloque={m.bloque ? '1' : '0'}><b>{m.texte}</b>{m.geste ? <small>{m.geste}</small> : null}</li>)}
        </ul>
      ) : null}
      {x.finir && x.finir.length && x.raison !== 'deja' && !aff ? <p className="vrm-pp-raison is-geste" data-pp-finir={x.finir.length}>{tr('partout.finir', { site: NOM_PARTOUT[x.site], liste: x.finir.join(', ') })}</p> : null}
      {x.demandes.includes('etat-lbc') && x.raison !== 'deja' ? (
        <label className="vrm-pp-demande" data-pp-demande="etat-lbc">
          <span>{tr('partout.demande.etat')}</span>
          <select value={(saisie && saisie.etatLbc) || ''} disabled={enCours} onChange={(e) => onSaisie(l.id, 'etatLbc', e.target.value)} data-pp-etat-lbc={l.id}>
            <option value="">{tr('partout.demande.choisir')}</option>
            {etatsLbc.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
      ) : null}
      {x.raison !== 'deja' ? (
        <div className="vrm-pp-apercu" data-pp-apercu={ouvert ? 'ouvert' : 'ferme'}>
          <button type="button" className="vrm-pp-apercu-bouton" aria-expanded={ouvert} onClick={() => setOuvert((v) => !v)} data-pp-apercu-bouton={cleCase(l.id, x.site)}>
            <span>{tr('partout.part.titre')}</span><span aria-hidden="true">{ouvert ? '−' : '+'}</span>
          </button>
          {ouvert ? (
            <dl className="vrm-pp-dl">
              <div><dt>{tr('partout.part.titreChamp')}</dt><dd data-pp-titre="">{ap.titre || '—'}{max && ap.titre ? <small data-pp-titre-long={ap.titre.length}> · {ap.titre.length}/{max}</small> : null}</dd></div>
              <div><dt>{tr('partout.part.prix')}</dt><dd>{PRIX_REGLABLE[x.site] && l.prixSource != null ? (
                <input inputMode="decimal" autoComplete="off" className="vrm-pp-prix-annonce" disabled={enCours} key={String(x.prixAnnonce == null ? '' : x.prixAnnonce)}
                  defaultValue={x.prixAnnonce == null ? '' : String(x.prixAnnonce).replace('.', ',')} placeholder={eur(ap.prix)} aria-label={tr('partout.prix.annonce', { site: NOM_PARTOUT[x.site] })}
                  data-pp-prix-annonce={cleCase(l.id, x.site)} onBlur={(e) => onSaisie(l.id, 'prixSite', { site: x.site, valeur: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}/>
              ) : eur(ap.prix)}</dd></div>
              {x.champs && x.champs.length ? (
                <div className="vrm-pp-champs"><dt className="vrm-sr">{tr('partout.part.parametres')}</dt><dd>
                  <ChampsAnnonce l={l} x={x} saisie={saisie} onParamAnnonce={onParamAnnonce} etatsLbc={etatsLbc} enCours={enCours}/>
                </dd></div>
              ) : (
                <>
                  <div><dt>{tr('partout.part.etat')}</dt><dd data-pp-etat-site="">{etat}</dd></div>
                  <div><dt>{tr('partout.part.categorie')}</dt><dd data-pp-categorie="">{categorie}</dd></div>
                  <div><dt>{tr('partout.part.taille')}</dt><dd>{(x.vocab && x.vocab.taille) || '—'}</dd></div>
                </>
              )}
              <div><dt>{tr('partout.part.photos')}</dt><dd data-pp-photos={ap.nPhotos || 0}>
                {ap.nPhotos ? <span className="vrm-pp-vignettes">{(ap.photos || []).slice(0, 5).map((u) => <span key={u} className="vrm-pp-vignette">{Photo ? Photo(u) : null}</span>)}{ap.nPhotos > 5 ? <span className="vrm-pp-plus">+{ap.nPhotos - 5}</span> : null}</span> : tr('partout.part.aucune')}
              </dd></div>
              <div><dt>{tr('partout.part.identite')}</dt><dd data-pp-identite={ap.identite ? ap.identite.valeur : ''}>{ap.identite ? <b>{ap.identite.valeur}</b> : '—'}</dd></div>
              {seul ? <div className="vrm-pp-desc"><dt>{tr('partout.part.description')}</dt><dd>{ap.description || '—'}</dd></div> : null}
            </dl>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

// lignes : sorties `lignePartout` (undefined = en cours de lecture · null = pas su).
// coches / setCoches : tenus ici. onLancer({ coches, surEtat }) → Promise.
export default function PublierPartout({ lignes, lecture = false, exclues = 0, reglage, onReglage, params = {}, onParam, onParamAnnonce, ebayReglages = [], saisies = {}, onSaisie, etatsLbc = [], vus = {}, onLancer, onFermer, onRelire, Photo, Retour }) {
  useLangue();
  const [coches, setCoches] = React.useState(() => new Set());
  const [res, setRes] = React.useState({});
  const [enCours, setEnCours] = React.useState(false);
  const [fini, setFini] = React.useState(false);
  const [total, setTotal] = React.useState(0);
  const vues = React.useRef(new Set());
  // Une case prête arrive (lecture finie, manque rempli) : cochée par défaut UNE fois.
  // Une case « pas su » n'est jamais cochée toute seule (§5 : pas su ≠ non).
  React.useEffect(() => {
    if (!Array.isArray(lignes)) return;
    const neuves = [];
    for (const l of lignes) for (const x of l.sites) { const k = cleCase(l.id, x.site); if (!vues.current.has(k) && x.cochable) { vues.current.add(k); if (x.cocheDefaut) neuves.push(k); } }
    setCoches((c) => {
      const n = new Set([...c].filter((k) => lignes.some((l) => l.sites.some((x) => cleCase(l.id, x.site) === k && x.cochable))));
      neuves.forEach((k) => n.add(k));
      return n.size === c.size && [...n].every((k) => c.has(k)) ? c : n;
    });
  }, [lignes]);
  React.useEffect(() => {
    const k = (e) => { if (e.key === 'Escape' && !e.defaultPrevented && !enCours) { e.preventDefault(); onFermer(); } };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [onFermer, enCours]);
  // Pendant l'envoi, VRM reste FIGÉ : ni fermeture, ni départ de la page sans avertissement
  // (le suivi commun, SuiviTravail, gèle le reste de l'écran quand il est là).
  React.useEffect(() => {
    if (!enCours) return undefined;
    const b = (e) => { e.preventDefault(); e.returnValue = ''; return ''; };
    window.addEventListener('beforeunload', b);
    return () => window.removeEventListener('beforeunload', b);
  }, [enCours]);
  // Le retour du navigateur pendant l'envoi : rien ne ferme, et la garde est reposée
  // (la feuille consommée par ce retour est remontée — un 2e retour ne quitte pas non plus).
  const [rearme, setRearme] = React.useState(0);
  const fermer = React.useCallback(() => { if (!enCours) onFermer(); else setRearme((n) => n + 1); }, [enCours, onFermer]);
  if (typeof document === 'undefined') return null;
  const liste = Array.isArray(lignes) ? lignes : [];
  const seul = liste.length === 1;
  const n = coches.size;
  const nSites = new Set([...coches].map((k) => k.split(':').pop())).size;
  const basculer = (k) => setCoches((c) => { const x = new Set(c); if (x.has(k)) x.delete(k); else x.add(k); return x; });
  const lancer = async () => {
    if (!n || enCours) return;
    setEnCours(true); setRes({}); setFini(false);
    try { await onLancer({ coches: new Set(coches), surEtat: (cle, e) => setRes((r) => ({ ...r, [cle]: e })), surTotal: setTotal }); }
    finally { setEnCours(false); setFini(true); if (onRelire) onRelire(); }
  };
  const resume = resumePartout(res);
  return createPortal(
    <div className="vrm-ao-voile" data-publier-partout={liste.length} data-pp-en-cours={enCours ? '1' : '0'} onClick={(e) => { if (e.target === e.currentTarget && !enCours) onFermer(); }}>
      {Retour ? <Retour key={rearme} fermer={fermer}/> : null}
      <div className="vrm-ao-feuille vrm-pp-feuille" role="dialog" aria-modal="true" aria-label={tr('partout.titre')}>
        <header className="vrm-ao-tete">
          <h2>{tr('partout.titre')}</h2>
          {seul && liste[0].num ? <span className="vrm-ao-num">N°{liste[0].num}</span> : liste.length > 1 ? <span className="vrm-ao-num" data-pp-n={liste.length}>{tr('partout.nAnnonces', { n: liste.length })}</span> : null}
          <button type="button" className="vrm-ao-x" aria-label={tr('partout.fermer')} data-pp-fermer="" onClick={onFermer} disabled={enCours}>×</button>
        </header>
        <p className="vrm-pp-source" data-pp-source=""><LogoSite site="vinted"/>{tr('partout.source')}</p>
        {exclues > 0 ? <p className="vrm-pp-garde" data-pp-exclues={exclues}>{tr('partout.exclues', { n: exclues })}</p> : null}
        {lignes === undefined ? <p className="vrm-ao-vide" data-pp-charge="">{tr('partout.lecture')}</p>
          : lignes === null ? <p className="vrm-ao-vide" data-pp-passu="">{tr('partout.passu')}</p>
          : !liste.length ? <p className="vrm-ao-vide" data-pp-aucune="">{tr('partout.aucune')}</p>
          : (
          <>
            <ReglagePrix reglage={reglage} onReglage={onReglage} bloque={enCours}/>
            {onParam ? <ReglageParams params={params} onParam={onParam} etatsLbc={etatsLbc} bloque={enCours} ebayReglages={ebayReglages}/> : null}
            {lecture ? <p className="vrm-ao-vide" data-pp-lecture="">{tr('partout.lectureSites')}</p> : null}
            {liste.map((l) => (
              <section key={l.id} className="vrm-pp-article" data-pp-article={l.id} data-pp-num={l.num}>
                <header className="vrm-pp-article-tete">
                  <span className="vrm-pp-photo">{l.cover && Photo ? Photo(l.cover) : null}</span>
                  <span className="vrm-pp-article-txt"><b>{l.num ? `N°${l.num}` : tr('partout.sansNumero')}</b><span>{l.titre || '—'}</span></span>
                  <span className="vrm-pp-article-prix" data-pp-prix-vinted={l.prixSource == null ? '' : String(l.prixSource)}>{eur(l.prixSource)}</span>
                </header>
                {l.sites.some((x) => x.demandes.includes('prix')) ? (
                  <label className="vrm-pp-demande" data-pp-demande="prix">
                    <span>{tr('partout.demande.prix')}</span>
                    <input inputMode="decimal" autoComplete="off" disabled={enCours} defaultValue={(saisies[l.id] && saisies[l.id].prix) || ''} placeholder="€" data-pp-prix-tape={l.id}
                      onBlur={(e) => onSaisie(l.id, 'prix', e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}/>
                  </label>
                ) : null}
                <ul className="vrm-pp-cases">
                  {l.sites.map((x) => <CaseSite key={x.site} l={l} x={x} coche={coches.has(cleCase(l.id, x.site))} onCoche={basculer} resultat={res[cleCase(l.id, x.site)]}
                    vu={vus[cleCase(l.id, x.site)]} enCours={enCours} seul={seul} saisie={saisies[l.id]} onSaisie={onSaisie} onParamAnnonce={onParamAnnonce || (() => {})} etatsLbc={etatsLbc} Photo={Photo}/>)}
                </ul>
              </section>
            ))}
            {enCours && total ? (() => {
              const faits = Object.values(res).filter((r) => r && r.etat !== 'envoi' && r.etat !== 'attente').length;
              return (
                <div className="vrm-pp-progres" data-pp-progres={faits} data-pp-total={total}>
                  <span role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={faits} aria-label={tr('partout.progres', { n: faits, total })}><i style={{ width: `${Math.round((faits / total) * 100)}%` }}/></span>
                  <small>{tr('partout.progres', { n: faits, total })}</small>
                </div>
              );
            })() : null}
            {fini ? (
              <p className="vrm-pp-bilan" data-pp-bilan="" data-pp-publies={resume.publie} data-pp-a-finir={resume['a-finir']} data-pp-refuses={resume.refuse + resume['pas-envoye']} role="status">
                {tr('partout.bilan', { publies: resume.publie, aFinir: resume['a-finir'], refuses: resume.refuse + resume['pas-envoye'] })}
              </p>
            ) : null}
            <p className="vrm-pp-garde" data-pp-garde="">{tr('partout.garde')}</p>
            <button type="button" className="vrm-ao-principal" data-pp-lancer={n} disabled={!n || enCours} onClick={lancer}>
              {enCours ? tr('partout.enCours') : n ? tr('partout.lancer', { n, sites: nSites }) : tr('partout.rienCoche')}
            </button>
          </>
        )}
      </div>
    </div>, document.body);
}
