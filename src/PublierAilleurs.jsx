// ── LA FEUILLE « PUBLIER AILLEURS » (5 nov.) — règle : src/publierAilleurs.js ─
// Un article (son N°), trois sites (Leboncoin, Vestiaire, eBay), quatre étapes
// visibles par site : Vérifier · Ce qui part · Publier · Suivi. Ce qui partira
// est MONTRÉ avant (titre, prix, photos, description, la référence qui porte le
// N°) ; ce qui manque est DIT avec son geste ; « Publier » ouvre le moteur
// existant du site sur CET article (fiche Leboncoin, formulaire eBay, ligne
// Vestiaire) — cette feuille n'envoie rien elle-même. Aucune couleur hors
// l'ambre d'un geste à faire (§7).
import React from 'react';
import { createPortal } from 'react-dom';
import { ETATS_PUBLIER, frisePublication, etapeCourante } from './publierAilleurs.js';
import { TITRE_MAX } from './verifAnnonce.js';
import { LogoSite } from './SelecteurSites.jsx';
import { nomPlateforme } from './plateformes.js';
import './styles-annonces-outils.css';
import './styles-publier-ailleurs.css';

const eur = (n) => (n == null ? '—' : `${(Math.round(n * 100) / 100).toFixed(Number.isInteger(n) ? 0 : 2).replace('.', ',')}\u00a0€`);
const MAX_TITRE = { leboncoin: TITRE_MAX.lbc, ebay: TITRE_MAX.ebay, vestiaire: null };
const VERBE = { leboncoin: 'Publier sur Leboncoin', ebay: 'Préparer sur eBay', vestiaire: 'Publier sur Vestiaire' };

function CarteSite({ c, ouvertDefaut, onPublier, Photo }) {
  const [ouvert, setOuvert] = React.useState(!!ouvertDefaut);
  const nom = nomPlateforme(c.site);
  const frise = frisePublication(c.etat, c.manques);
  const ici = etapeCourante(c.etat, c.manques);
  const bloque = c.manques.some((m) => m.bloque);
  const ap = c.apercu || {};
  const max = MAX_TITRE[c.site];
  const fini = c.etat === 'vue-en-ligne';
  return (
    <section className="vrm-pa-site" data-pa-site={c.site} data-pa-etat={c.etat} data-pa-etape={ici} aria-label={nom}>
      <header className="vrm-pa-site-tete">
        <span className="vrm-pa-site-nom"><LogoSite site={c.site}/>{nom}</span>
        <span className="vrm-pa-etat" data-pa-etat-libelle={c.etat} data-ton={bloque && !fini ? 'geste' : undefined}>{ETATS_PUBLIER[c.etat] || ''}</span>
      </header>
      <ol className="vrm-pa-frise" aria-label={`Étapes sur ${nom}`}>
        {frise.map((e, i) => (
          <li key={e.cle} data-pa-etape-cle={e.cle} data-pa-etape-etat={e.etat} aria-current={e.etat === 'ici' ? 'step' : undefined}>
            <span className="vrm-pa-pastille" aria-hidden="true">{e.etat === 'fait' ? '✓' : e.etat === 'a-corriger' ? '!' : i + 1}</span>
            <span className="vrm-pa-etape-nom">{e.label}</span>
          </li>
        ))}
      </ol>
      {c.manques.length
        ? <ul className="vrm-pa-manques" data-pa-manques={c.manques.length}>
            {c.manques.map((m) => (
              <li key={m.code} data-pa-manque={m.code} data-bloque={m.bloque ? '1' : '0'}>
                <b>{m.texte}</b><small>{m.geste}</small>
              </li>
            ))}
          </ul>
        : <p className="vrm-pa-rien" data-pa-rien-ne-manque="">Rien ne manque</p>}
      <div className="vrm-pa-apercu" data-pa-apercu={ouvert ? 'ouvert' : 'ferme'}>
        <button type="button" className="vrm-pa-apercu-bouton" aria-expanded={ouvert} data-pa-apercu-bouton={c.site} onClick={() => setOuvert((v) => !v)}>
          <span>Ce qui part</span><span aria-hidden="true">{ouvert ? '−' : '+'}</span>
        </button>
        {ouvert ? (
          <dl className="vrm-pa-dl">
            <div><dt>Titre</dt><dd data-pa-titre="">{ap.titre || '—'}{max && ap.titre ? <small data-pa-titre-long={ap.titre.length}> · {ap.titre.length}/{max}</small> : null}</dd></div>
            <div><dt>Prix</dt><dd data-pa-prix={ap.prix == null ? '' : String(ap.prix)}>{eur(ap.prix)}</dd></div>
            <div><dt>Photos</dt><dd data-pa-photos={ap.nPhotos || 0}>
              {ap.nPhotos ? <span className="vrm-pa-vignettes">{ap.photos.slice(0, 6).map((u) => <span key={u} className="vrm-pa-vignette">{Photo ? Photo(u) : null}</span>)}{ap.nPhotos > 6 ? <span className="vrm-pa-plus">+{ap.nPhotos - 6}</span> : null}</span> : 'Aucune'}
              {ap.photosEcartees > 0 ? <small> · {ap.photosEcartees} de trop, pas envoyées</small> : null}
            </dd></div>
            <div><dt>N°</dt><dd data-pa-identite={ap.identite ? ap.identite.valeur : ''}>{ap.identite ? <><b>{ap.identite.valeur}</b> <small>{ap.identite.quoi.toLowerCase()} {ap.identite.ou}</small></> : '—'}</dd></div>
            <div className="vrm-pa-desc"><dt>Description</dt><dd data-pa-description="">{ap.description || '—'}</dd></div>
          </dl>
        ) : null}
      </div>
      <div className="vrm-pa-actions">
        {fini
          ? (c.lien ? <a className="vrm-ao-ouvrir" href={c.lien} target="_blank" rel="noopener noreferrer" data-pa-voir={c.site}>Voir l’annonce ↗</a> : <span className="vrm-pa-rien">En ligne</span>)
          : <button type="button" className={ici === 'publier' ? 'vrm-ao-principal' : 'vrm-ao-second'} data-pa-publier={c.site} disabled={bloque} aria-disabled={bloque ? 'true' : undefined}
              onClick={() => { if (!bloque) onPublier(c.site); }}>
              {c.etat === 'preparee' ? `Reprendre sur ${nom}` : c.etat === 'publiee' ? `Voir dans ${nom}` : VERBE[c.site]}
            </button>}
        {c.etat === 'publiee' ? <small className="vrm-pa-note" data-pa-attente="">Vue en ligne à la prochaine lecture de tes annonces {nom}.</small> : null}
        {c.etat === 'pas-su' ? <small className="vrm-pa-note" data-pa-passu="">Tes annonces {nom} ne sont pas lues : publiée à la main ? Vérifie avant.</small> : null}
      </div>
    </section>
  );
}

export default function PublierAilleurs({ paire = null, paires, lecture = false, cartes = [], partout = [], siteDemande = null, avis = '', onChoisir, onChanger, onPublier, onFermer, Photo, Retour, chercher }) {
  const [q, setQ] = React.useState('');
  React.useEffect(() => {
    const k = (e) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); onFermer(); } };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [onFermer]);
  if (typeof document === 'undefined') return null;
  const ordre = siteDemande ? [...cartes].sort((a, b) => (a.site === siteDemande ? -1 : b.site === siteDemande ? 1 : 0)) : cartes;
  const liste = !paire && Array.isArray(paires) ? (chercher ? chercher(paires, q) : paires) : [];
  return createPortal(
    <div className="vrm-ao-voile" data-publier-ailleurs={paire ? paire.num : 'choix'} onClick={(e) => { if (e.target === e.currentTarget) onFermer(); }}>
      {Retour ? <Retour fermer={onFermer}/> : null}
      <div className="vrm-ao-feuille vrm-pa-feuille" role="dialog" aria-modal="true" aria-label="Publier ailleurs">
        <header className="vrm-ao-tete">
          <h2>Publier ailleurs</h2>
          {paire ? <span className="vrm-ao-num">N°{paire.num}</span> : null}
          <button type="button" className="vrm-ao-x" aria-label="Fermer" data-pa-fermer="" onClick={onFermer}>×</button>
        </header>
        {!paire ? (
          <div className="vrm-pa-choix" data-pa-choix-liste={Array.isArray(paires) ? liste.length : ''}>
            {avis ? <p className="vrm-ao-vide" data-pa-avis="">{avis}</p> : null}
            <input className="vrm-pa-cherche" value={q} onChange={(e) => setQ(e.target.value)} placeholder="N° ou titre" aria-label="Chercher un article par N° ou titre" data-pa-cherche="" autoComplete="off"/>
            {paires === undefined ? <p className="vrm-ao-vide">…</p>
              : paires === null ? <p className="vrm-ao-vide" data-pa-passu-paires="">Tes annonces Vinted ne sont pas lues — rien n’est perdu, réessaie dans un moment.</p>
              : !liste.length ? <p className="vrm-ao-vide" data-pa-aucune="">{q ? 'Aucun article à ce N°' : 'Aucun article en ligne ou chez toi à proposer'}</p>
              : <ul className="vrm-pa-paires">{liste.slice(0, 60).map((p) => (
                  <li key={p.id}><button type="button" data-pa-choix={p.id} data-pa-choix-num={p.num} onClick={() => onChoisir(p)}>
                    <span className="vrm-pa-paire-photo">{p.cover && Photo ? Photo(p.cover) : null}</span>
                    <span className="vrm-pa-paire-txt"><b>N°{p.num}</b><span>{p.title || '—'}</span></span>
                    <span className="vrm-pa-paire-prix">{eur(p.prix != null && p.prix !== '' ? Number(p.prix) : null)}</span>
                  </button></li>))}</ul>}
          </div>
        ) : (
          <>
            <div className="vrm-pa-article" data-pa-article={paire.id}>
              <span className="vrm-pa-paire-photo">{paire.cover && Photo ? Photo(paire.cover) : null}</span>
              <span className="vrm-pa-paire-txt"><b>{paire.title || '—'}</b>
                <span data-pa-partout={partout.join(',')}>{partout.length ? <>N°{paire.num} en ligne sur {partout.map((s) => <span key={s} className="vrm-pa-partout"><LogoSite site={s}/>{nomPlateforme(s)}</span>)}</> : lecture ? '…' : `N°${paire.num} · le même N° sur chaque site`}</span>
              </span>
              {onChanger ? <button type="button" className="vrm-ao-second" data-pa-changer="" onClick={onChanger}>Changer</button> : null}
            </div>
            {lecture ? <p className="vrm-ao-vide" data-pa-lecture="">Je lis tes annonces sur chaque site…</p> : null}
            {ordre.map((c) => <CarteSite key={c.site + ':' + paire.id} c={c} ouvertDefaut={c.site === siteDemande} onPublier={onPublier} Photo={Photo}/>)}
          </>
        )}
      </div>
    </div>, document.body);
}
