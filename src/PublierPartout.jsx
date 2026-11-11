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
import { SITES_PARTOUT, NOM_PARTOUT, TITRE_MAX_PARTOUT, PRIX_REGLABLE, MODES_PRIX, texteReglage, cleCase, etatAffiche, resumePartout } from './publierPartout.js';
import './styles-annonces-outils.css';
import './styles-publier-partout.css';

const eur = (n) => (n == null ? '—' : `${(Math.round(n * 100) / 100).toFixed(Number.isInteger(n) ? 0 : 2).replace('.', ',')} €`);
const ETAT_CLE = { envoi: 'partout.etat.envoi', attente: 'partout.etat.attente', publie: 'partout.etat.publie', 'publie-relu': 'partout.etat.relu', 'a-finir': 'partout.etat.aFinir', refuse: 'partout.etat.refuse', 'pas-envoye': 'partout.etat.pasEnvoye' };

function ReglagePrix({ reglage, onReglage, bloque }) {
  return (
    <section className="vrm-pp-reglage" data-pp-reglage="" aria-label={tr('partout.prix.titre')}>
      <h3>{tr('partout.prix.titre')}</h3>
      {SITES_PARTOUT.map((site) => {
        const r = (reglage && reglage[site]) || { mode: 'egal', valeur: 0 };
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
              onChange={(e) => onReglage(site, { mode: e.target.value, valeur: e.target.value === 'egal' ? 0 : r.valeur })}>
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

function CaseSite({ l, x, coche, onCoche, resultat, vu, enCours, seul, saisie, onSaisie, etatsLbc, Photo }) {
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
              <div><dt>{tr('partout.part.prix')}</dt><dd>{eur(ap.prix)}</dd></div>
              <div><dt>{tr('partout.part.etat')}</dt><dd data-pp-etat-site="">{etat}</dd></div>
              <div><dt>{tr('partout.part.categorie')}</dt><dd data-pp-categorie="">{categorie}</dd></div>
              <div><dt>{tr('partout.part.taille')}</dt><dd>{(x.vocab && x.vocab.taille) || '—'}</dd></div>
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
export default function PublierPartout({ lignes, lecture = false, exclues = 0, reglage, onReglage, saisies = {}, onSaisie, etatsLbc = [], vus = {}, onLancer, onFermer, onRelire, Photo, Retour }) {
  useLangue();
  const [coches, setCoches] = React.useState(() => new Set());
  const [res, setRes] = React.useState({});
  const [enCours, setEnCours] = React.useState(false);
  const [fini, setFini] = React.useState(false);
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
  if (typeof document === 'undefined') return null;
  const liste = Array.isArray(lignes) ? lignes : [];
  const seul = liste.length === 1;
  const n = coches.size;
  const nSites = new Set([...coches].map((k) => k.split(':').pop())).size;
  const basculer = (k) => setCoches((c) => { const x = new Set(c); if (x.has(k)) x.delete(k); else x.add(k); return x; });
  const lancer = async () => {
    if (!n || enCours) return;
    setEnCours(true); setRes({}); setFini(false);
    try { await onLancer({ coches: new Set(coches), surEtat: (cle, e) => setRes((r) => ({ ...r, [cle]: e })) }); }
    finally { setEnCours(false); setFini(true); if (onRelire) onRelire(); }
  };
  const resume = resumePartout(res);
  return createPortal(
    <div className="vrm-ao-voile" data-publier-partout={liste.length} onClick={(e) => { if (e.target === e.currentTarget && !enCours) onFermer(); }}>
      {Retour ? <Retour fermer={onFermer}/> : null}
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
                    vu={vus[cleCase(l.id, x.site)]} enCours={enCours} seul={seul} saisie={saisies[l.id]} onSaisie={onSaisie} etatsLbc={etatsLbc} Photo={Photo}/>)}
                </ul>
              </section>
            ))}
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
