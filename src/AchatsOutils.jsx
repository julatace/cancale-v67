// ── ACHATS : FOURNISSEURS · DÉLAI · LOTS (4 nov.) — règles : src/achatsSourcing.js ──
// Trois entrées sobres sous la carte d'Achats ; chacune ouvre une feuille.
// Rien n'est calculé ici (l'app passe les résultats des règles) et rien n'est
// écrit sans SON clic : « Relier », « Enregistrer », « Annuler », « C'est un lot ».
// Aucun texte explicatif : des titres, des nombres, des gestes.
import React from 'react';
import { createPortal } from 'react-dom';
import { etatRepartition, partsEgales, TRIS_FOURNISSEURS } from './achatsSourcing.js';
import './styles-annonces-outils.css';
import './styles-achats-outils.css';

const eurC = (c) => {
  if (c == null || !Number.isFinite(c)) return '—';
  const n = Math.abs(c), e = Math.floor(n / 100), r = n % 100;
  const ent = String(e).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (c < 0 ? '−' : '') + ent + (r ? ',' + String(r).padStart(2, '0') : '') + ' €';
};
const signeC = (c) => (c == null ? '—' : (c >= 0 ? '+' : '') + eurC(c));
const jours = (j) => (j == null ? '—' : `${Math.round(j * 10) / 10}`.replace('.', ',') + ' j');
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const nomMois = (k) => { const [a, m] = String(k).split('-'); const n = MOIS[Number(m) - 1] || k; return n.charAt(0).toUpperCase() + n.slice(1) + ' ' + a; };
const pl = (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`;

function Feuille({ titre, data, onFermer, Retour, children, droite }) {
  React.useEffect(() => {
    const k = (e) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); onFermer(); } };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [onFermer]);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="vrm-ao-voile vrm-aso-voile" {...data} onClick={(e) => { if (e.target === e.currentTarget) onFermer(); }}>
      {Retour ? <Retour fermer={onFermer}/> : null}
      <div className="vrm-ao-feuille vrm-aso-feuille" role="dialog" aria-modal="true" aria-label={titre}>
        <header className="vrm-ao-tete">
          <h2>{titre}</h2>
          {droite || null}
          <button type="button" className="vrm-ao-x" aria-label="Fermer" data-aso-fermer="" onClick={onFermer}>×</button>
        </header>
        {children}
      </div>
    </div>, document.body);
}

function Choix({ label, value, options, onChange, data }) {
  return (
    <div role="group" aria-label={label} className="vrm-aso-seg" {...(data || {})}>
      {options.map((o) => (
        <button key={o.v} type="button" aria-pressed={value === o.v} disabled={!!o.disabled} onClick={() => onChange(o.v)} {...(o.data || {})}>{o.l}</button>
      ))}
    </div>
  );
}

function Vignette({ src, Photo }) {
  return src && Photo ? <span className="vrm-aso-photo">{Photo(src)}</span> : <span className="vrm-aso-photo" aria-hidden="true"/>;
}

// ── 1. Fournisseurs ─────────────────────────────────────────────────────────
function FeuilleFournisseurs({ r, tri, onTri, onFermer, Retour }) {
  return (
    <Feuille titre="Fournisseurs" data={{ 'data-aso-feuille': 'fournisseurs', 'data-aso-etat': r === undefined ? 'encours' : r === null ? 'passu' : 'lu' }} onFermer={onFermer} Retour={Retour}>
      <Choix label="Trier par" value={tri} onChange={onTri} data={{ 'data-aso-tri': tri }}
        options={Object.entries(TRIS_FOURNISSEURS).map(([v, l]) => ({ v, l, data: { 'data-aso-tri-choix': v } }))}/>
      {r === undefined ? <p className="vrm-ao-vide">…</p> : r === null ? <p className="vrm-ao-vide" data-aso-passu="">—</p> : (
        <>
          <p className="vrm-aso-couv" data-aso-pseudo-lu={r.vendeurLu.n} data-aso-pseudo-sur={r.vendeurLu.sur}>
            <span className="vrm-aso-bloc">Pseudo lu {r.vendeurLu.n}/{r.vendeurLu.sur}</span>
            {r.sansPrix ? <> · <span className="vrm-aso-bloc" data-aso-sans-prix={r.sansPrix}>{pl(r.sansPrix, 'prix illisible', 'prix illisibles')}</span></> : null}
            {r.partielSites ? <> · <span className="vrm-aso-bloc" data-aso-sites="vinted">ventes Vinted</span></> : null}
          </p>
          {!r.lignes.length ? <p className="vrm-ao-vide" data-aso-vide="">Aucun achat</p> : (
            <ul className="vrm-aso-liste" data-aso-n={r.lignes.length}>
              {r.lignes.map((l, i) => (
                <li key={l.cle} className="vrm-aso-ligne" data-aso-fournisseur={l.cle} data-aso-type={l.type} data-aso-achats={l.achats} data-aso-depense={l.depense}
                  data-aso-relies={l.relies} data-aso-revendus={l.revendus} data-aso-benefice={l.benefice == null ? '' : l.benefice} data-aso-partiel={l.partiel ? '1' : ''}>
                  <span className="vrm-aso-rang">{i + 1}</span>
                  <span className="vrm-aso-centre">
                    <span className={'vrm-aso-nom' + (l.type === 'pas-lu' ? ' is-gris' : '')}>{l.nom}</span>
                    <span className="vrm-aso-sous">
                      <span className="vrm-aso-bloc">{pl(l.achats, 'achat')}</span> · <span className="vrm-aso-bloc">reliés {l.relies}/{l.achats}</span> · <span className="vrm-aso-bloc">{l.revendus} revendu{l.revendus > 1 ? 's' : ''}</span>
                    </span>
                  </span>
                  <span className="vrm-aso-droite">
                    <b className="vrm-aso-montant">{eurC(l.depense)}</b>
                    <small className="vrm-aso-benef" data-vide={l.benefice == null ? '' : undefined}>{l.benefice == null ? '—' : (l.partiel ? 'au plus ' : '') + signeC(l.benefice)}{l.benefice != null && l.beneficesConnus < l.revendus ? ` · ${l.beneficesConnus}/${l.revendus}` : ''}</small>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Feuille>
  );
}

// ── Relier un N° à un achat (son clic) ──────────────────────────────────────
function ChoixNumero({ fiches, onChoisir, onAnnuler, Photo }) {
  const [q, setQ] = React.useState('');
  const mots = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const liste = (fiches || []).filter((f) => !mots.length || mots.every((m) => (`n°${f.numero} ${f.numero} ${f.titre || ''}`).toLowerCase().includes(m))).slice(0, 40);
  return (
    <div className="vrm-aso-choix" data-aso-choix-numero="">
      <div className="vrm-aso-cherche">
        <input type="search" inputMode="search" autoComplete="off" placeholder="N° ou titre" value={q} onChange={(e) => setQ(e.target.value)} data-aso-cherche="" aria-label="Chercher un N°"/>
        <button type="button" className="vrm-ao-second" onClick={onAnnuler} data-aso-choix-annuler="">Annuler</button>
      </div>
      {!liste.length ? <p className="vrm-ao-vide">Aucun N° libre</p> : (
        <ul className="vrm-aso-liste">
          {liste.map((f) => (
            <li key={f.cle} className="vrm-aso-ligne is-choix">
              <button type="button" className="vrm-aso-choisir" data-aso-relier-numero={f.numero} onClick={() => onChoisir(f)}>
                <Vignette src={f.photo} Photo={Photo}/>
                <span className="vrm-aso-centre"><span className="vrm-aso-nom">N°{f.numero}</span><span className="vrm-aso-sous">{f.titre || ''}</span></span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── 2. Délai achat → mise en ligne ─────────────────────────────────────────
function FeuilleDelai({ d, fichesLibres, onRelier, onFiche, lienPublier, onFermer, Retour, Photo }) {
  const [voir, setVoir] = React.useState(30);
  const [relierPour, setRelierPour] = React.useState('');
  const ex = d && d.exclus;
  const nEx = ex ? ex.sansReception + ex.sansMiseEnLigne + ex.avant : 0;
  return (
    <Feuille titre="Délai de mise en ligne" data={{ 'data-aso-feuille': 'delai', 'data-aso-etat': d === undefined ? 'encours' : d === null ? 'passu' : 'lu' }} onFermer={onFermer} Retour={Retour}>
      {d === undefined ? <p className="vrm-ao-vide">…</p> : d === null ? <p className="vrm-ao-vide" data-aso-passu="">—</p> : (
        <>
          <section className="vrm-aso-carte" data-aso-mediane={d.mediane == null ? '' : d.mediane} data-aso-n={d.n}>
            <div className="vrm-aso-grand"><b>{jours(d.mediane)}</b><span>médiane · {pl(d.n, 'achat')}</span></div>
            {d.mois.length ? (
              <ul className="vrm-aso-mois">
                {d.mois.map((m) => (
                  <li key={m.mois} data-aso-mois={m.mois} data-aso-mois-mediane={m.mediane} data-aso-mois-n={m.n}>
                    <span>{nomMois(m.mois)}</span><b>{jours(m.mediane)}</b><small>{m.n}</small>
                  </li>
                ))}
              </ul>
            ) : null}
            {nEx ? (
              <p className="vrm-aso-couv" data-aso-exclus={nEx} data-aso-sans-reception={ex.sansReception} data-aso-sans-mel={ex.sansMiseEnLigne} data-aso-avant={ex.avant}>
                Hors calcul : {ex.sansReception ? <span className="vrm-aso-bloc">{ex.sansReception} sans date de réception</span> : null}
                {ex.sansReception && (ex.sansMiseEnLigne || ex.avant) ? ' · ' : ''}
                {ex.sansMiseEnLigne ? <span className="vrm-aso-bloc">{ex.sansMiseEnLigne} sans date de mise en ligne</span> : null}
                {ex.sansMiseEnLigne && ex.avant ? ' · ' : ''}
                {ex.avant ? <span className="vrm-aso-bloc">{ex.avant} en ligne avant réception</span> : null}
              </p>
            ) : null}
          </section>
          <h3 className="vrm-aso-h3">Reçus, pas encore en ligne{Array.isArray(d.pasEnLigne) ? <span className="vrm-aso-n" data-aso-pas-en-ligne={d.pasEnLigne.length}>{d.pasEnLigne.length}</span> : null}</h3>
          {d.pasEnLigne === null ? <p className="vrm-ao-vide" data-aso-pel-passu="">—</p>
            : !d.pasEnLigne.length ? <p className="vrm-ao-vide" data-aso-pel-vide="">Aucun</p> : (
              <ul className="vrm-aso-liste">
                {d.pasEnLigne.slice(0, voir).map((x) => (
                  <li key={x.tx} className="vrm-aso-ligne is-achat" data-aso-pel={x.tx} data-aso-relie={x.relie ? '1' : ''} data-aso-attente={x.attente == null ? '' : x.attente}>
                    <Vignette src={x.photo} Photo={Photo}/>
                    <span className="vrm-aso-centre">
                      <span className="vrm-aso-nom">{x.titre || 'Sans titre'}</span>
                      <span className="vrm-aso-sous">
                        {x.attente != null ? <span className="vrm-aso-bloc">reçu il y a {pl(x.attente, 'jour')}</span> : <span className="vrm-aso-bloc">reçu</span>}
                        {x.articles.filter((a) => a.numero).map((a) => <React.Fragment key={a.cle}> · <button type="button" className="vrm-aso-num" data-aso-fiche={a.numero} onClick={() => onFiche(a.numero)}>N°{a.numero}</button></React.Fragment>)}
                      </span>
                    </span>
                    {x.relie
                      ? <a className="vrm-ao-ouvrir" href={lienPublier} target="_blank" rel="noopener noreferrer" data-aso-publier={x.tx}>Mettre en ligne</a>
                      : <button type="button" className="vrm-ao-ouvrir vrm-aso-btn" data-aso-relier={x.tx} aria-expanded={relierPour === x.tx} onClick={() => setRelierPour((p) => (p === x.tx ? '' : x.tx))}>Relier</button>}
                    {relierPour === x.tx ? <div className="vrm-aso-sous-feuille"><ChoixNumero fiches={fichesLibres} Photo={Photo} onAnnuler={() => setRelierPour('')} onChoisir={(f) => { onRelier(x.tx, f); setRelierPour(''); }}/></div> : null}
                  </li>
                ))}
              </ul>
            )}
          {Array.isArray(d.pasEnLigne) && d.pasEnLigne.length > voir ? <button type="button" className="vrm-ao-second vrm-aso-plus" data-aso-voir-plus="" onClick={() => setVoir((v) => v + 30)}>Voir {Math.min(30, d.pasEnLigne.length - voir)} de plus</button> : null}
        </>
      )}
    </Feuille>
  );
}

// ── 3. Lots : la liste, puis « Répartir » ───────────────────────────────────
function Repartir({ lot, onEnregistrer, onAnnulerRepartition, onRelier, fichesLibres, onFermer, Retour, Photo }) {
  const peutPaye = lot.totalPaye != null;
  const [inclus, setInclus] = React.useState(lot.journal && lot.journal.inclus === 'paye' && peutPaye ? 'paye' : 'article');
  const total = inclus === 'paye' ? lot.totalPaye : lot.totalArticle;
  const n = lot.articles.length;
  // Préremplissage : les parts déjà posées (journal), sinon une PROPOSITION de parts égales.
  const depart = React.useCallback((t) => lot.articles.map((a, i) => {
    const deja = lot.journal && lot.journal.inclus === inclus && lot.journal.parts ? lot.journal.parts[a.cle] : null;
    if (Number.isSafeInteger(deja)) return (deja / 100).toFixed(2).replace('.', ',');
    const eg = partsEgales(t, n); return eg.length ? (eg[i] / 100).toFixed(2).replace('.', ',') : '';
  }), [lot, inclus, n]);
  const [saisies, setSaisies] = React.useState(() => depart(total));
  React.useEffect(() => { setSaisies(depart(total)); }, [inclus, n]); // eslint-disable-line react-hooks/exhaustive-deps
  const [relier, setRelier] = React.useState(false);
  const etat = etatRepartition(total, saisies);
  return (
    <Feuille titre="Répartir" data={{ 'data-aso-feuille': 'repartir', 'data-aso-tx': lot.tx, 'data-aso-total': total == null ? '' : total, 'data-aso-reste': etat.reste == null ? '' : etat.reste, 'data-aso-juste': etat.juste ? '1' : '' }}
      onFermer={onFermer} Retour={Retour} droite={<span className="vrm-ao-num">{eurC(total)}</span>}>
      <div className="vrm-aso-lot-tete">
        <Vignette src={lot.photo} Photo={Photo}/>
        <span className="vrm-aso-centre"><span className="vrm-aso-nom">{lot.titre || 'Lot'}</span><span className="vrm-aso-sous">{lot.nLot ? `${n}/${lot.nLot} reliés` : pl(n, 'relié')}</span></span>
      </div>
      {peutPaye ? <Choix label="Montant" value={inclus} onChange={setInclus} data={{ 'data-aso-inclus': inclus }}
        options={[{ v: 'article', l: `Article ${eurC(lot.totalArticle)}`, data: { 'data-aso-inclus-choix': 'article' } }, { v: 'paye', l: `Payé ${eurC(lot.totalPaye)}`, data: { 'data-aso-inclus-choix': 'paye' } }]}/> : null}
      {n ? (
        <ul className="vrm-ao-sites vrm-aso-parts">
          {lot.articles.map((a, i) => (
            <li key={a.cle} className="vrm-ao-site vrm-aso-part" data-aso-part={a.cle} data-aso-part-num={a.numero || ''}>
              <span className="vrm-ao-site-nom"><b>{a.numero ? `N°${a.numero}` : 'Sans N°'}</b><small>{a.titre || ''}</small></span>
              <span className="vrm-aso-champ">
                <input inputMode="decimal" autoComplete="off" value={saisies[i] || ''} aria-label={`Part du N°${a.numero || ''}`} data-aso-saisie={i}
                  aria-invalid={etat.parts[i] == null ? 'true' : undefined}
                  onChange={(e) => { const v = e.target.value; setSaisies((s) => { const c = [...s]; c[i] = v; return c; }); }}/>
                <b>€</b>
              </span>
            </li>
          ))}
        </ul>
      ) : <p className="vrm-ao-vide" data-aso-aucun-relie="">Aucun N° relié</p>}
      {relier ? <ChoixNumero fiches={fichesLibres} Photo={Photo} onAnnuler={() => setRelier(false)} onChoisir={(f) => { onRelier(lot.tx, f); setRelier(false); }}/>
        : <button type="button" className="vrm-ao-second vrm-aso-plus" data-aso-ajouter-numero="" onClick={() => setRelier(true)}>Relier un N°</button>}
      {n ? (
        <p className={'vrm-aso-reste' + (etat.juste ? ' is-juste' : '')} data-aso-reste-txt="">
          {total == null ? '—' : etat.juste ? 'Juste' : etat.illisibles ? pl(etat.illisibles, 'case à remplir', 'cases à remplir') : `Reste ${etat.reste < 0 ? '−' : ''}${eurC(Math.abs(etat.reste))}`}
        </p>
      ) : null}
      {n > 1 && total != null ? <button type="button" className="vrm-ao-second vrm-aso-plus" data-aso-egal="" onClick={() => setSaisies(partsEgales(total, n).map((c) => (c / 100).toFixed(2).replace('.', ',')))}>Parts égales</button> : null}
      <button type="button" className="vrm-ao-principal" data-aso-enregistrer="" disabled={!etat.juste} onClick={() => onEnregistrer({ lot, saisies, inclus })}>Enregistrer</button>
      {lot.journal ? <button type="button" className="vrm-ao-second vrm-aso-annuler" data-aso-annuler-repartition={lot.tx} onClick={() => onAnnulerRepartition(lot)}>Annuler la répartition</button> : null}
    </Feuille>
  );
}

function FeuilleLots({ lots, achatsDeclarables, onDeclarer, onOuvrir, onFermer, Retour, Photo }) {
  const [ajout, setAjout] = React.useState(false);
  const [q, setQ] = React.useState('');
  const mots = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const candidats = (achatsDeclarables || []).filter((a) => !mots.length || mots.every((m) => String(a.titre || '').toLowerCase().includes(m))).slice(0, 40);
  return (
    <Feuille titre="Lots" data={{ 'data-aso-feuille': 'lots', 'data-aso-etat': lots === undefined ? 'encours' : lots === null ? 'passu' : 'lu' }} onFermer={onFermer} Retour={Retour}>
      {lots === undefined ? <p className="vrm-ao-vide">…</p> : lots === null ? <p className="vrm-ao-vide" data-aso-passu="">—</p> : (
        !lots.length ? <p className="vrm-ao-vide" data-aso-vide="">Aucun lot</p> : (
          <ul className="vrm-aso-liste" data-aso-n={lots.length}>
            {lots.map((l) => (
              <li key={l.tx} className="vrm-aso-ligne is-achat" data-aso-lot={l.tx} data-aso-lot-n={l.articles.length} data-aso-reparti={l.journal ? '1' : ''}>
                <Vignette src={l.photo} Photo={Photo}/>
                <span className="vrm-aso-centre">
                  <span className="vrm-aso-nom">{l.titre || 'Lot'}</span>
                  <span className="vrm-aso-sous"><span className="vrm-aso-bloc">{eurC(l.totalArticle)}</span> · <span className="vrm-aso-bloc">{l.nLot ? `${l.articles.length}/${l.nLot} reliés` : pl(l.articles.length, 'relié')}</span>{l.journal ? <> · <span className="vrm-aso-bloc">réparti</span></> : null}</span>
                </span>
                <button type="button" className="vrm-ao-ouvrir vrm-aso-btn" data-aso-repartir={l.tx} onClick={() => onOuvrir(l.tx)}>Répartir</button>
              </li>
            ))}
          </ul>
        )
      )}
      {ajout ? (
        <div className="vrm-aso-choix" data-aso-declarer-liste="">
          <div className="vrm-aso-cherche">
            <input type="search" autoComplete="off" placeholder="Titre de l'achat" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Chercher un achat" data-aso-cherche-achat=""/>
            <button type="button" className="vrm-ao-second" onClick={() => setAjout(false)}>Annuler</button>
          </div>
          <ul className="vrm-aso-liste">
            {candidats.map((a) => (
              <li key={a.tx} className="vrm-aso-ligne is-choix">
                <button type="button" className="vrm-aso-choisir" data-aso-declarer={a.tx} onClick={() => { onDeclarer(a.tx, true); setAjout(false); }}>
                  <Vignette src={a.photo} Photo={Photo}/>
                  <span className="vrm-aso-centre"><span className="vrm-aso-nom">{a.titre || 'Sans titre'}</span><span className="vrm-aso-sous">{eurC(a.prix)}{a.date ? ` · ${a.date}` : ''}</span></span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : <button type="button" className="vrm-ao-second vrm-aso-plus" data-aso-ajouter-lot="" onClick={() => setAjout(true)}>Ajouter un lot</button>}
    </Feuille>
  );
}

// ── L'entrée sur l'écran Achats ─────────────────────────────────────────────
export default function AchatsOutils({ fournisseurs, delai, lots, achatsDeclarables, fichesLibres, onOuvrir, onRelier, onRepartir, onAnnulerRepartition, onDeclarerLot, onFiche, lienPublier = 'https://www.vinted.fr/items/new', Retour, Photo, ouvertInitial = '' }) {
  const [ouvert, setOuvert] = React.useState(ouvertInitial);
  const [lotTx, setLotTx] = React.useState('');
  const [tri, setTri] = React.useState('depense');
  const ouvrir = (q) => { setOuvert(q); if (onOuvrir) onOuvrir(q); };
  const fermer = React.useCallback(() => setOuvert(''), []);
  const lot = lotTx && Array.isArray(lots) ? lots.find((l) => l.tx === lotTx) : null;
  const nLots = Array.isArray(lots) ? lots.length : null;
  const nPel = delai && Array.isArray(delai.pasEnLigne) ? delai.pasEnLigne.length : null;
  return (
    <>
      <nav className="vrm-aso-outils" aria-label="Outils des achats" data-aso-outils="">
        <button type="button" className="vrm-aso-outil" data-aso-ouvrir="fournisseurs" onClick={() => ouvrir('fournisseurs')}><span>Fournisseurs</span></button>
        <button type="button" className="vrm-aso-outil" data-aso-ouvrir="delai" onClick={() => ouvrir('delai')}><span>Délai</span>{nPel ? <small data-aso-outil-n={nPel}>{nPel}</small> : null}</button>
        <button type="button" className="vrm-aso-outil" data-aso-ouvrir="lots" onClick={() => ouvrir('lots')}><span>Lots</span>{nLots ? <small data-aso-outil-n={nLots}>{nLots}</small> : null}</button>
      </nav>
      {ouvert === 'fournisseurs' ? <FeuilleFournisseurs r={fournisseurs && fournisseurs.lignes ? { ...fournisseurs, lignes: fournisseurs.trier(tri) } : fournisseurs} tri={tri} onTri={setTri} onFermer={fermer} Retour={Retour}/> : null}
      {ouvert === 'delai' ? <FeuilleDelai d={delai} fichesLibres={fichesLibres} onRelier={onRelier} onFiche={onFiche} lienPublier={lienPublier} onFermer={fermer} Retour={Retour} Photo={Photo}/> : null}
      {ouvert === 'lots' && !lot ? <FeuilleLots lots={lots} achatsDeclarables={achatsDeclarables} onDeclarer={onDeclarerLot} onOuvrir={setLotTx} onFermer={fermer} Retour={Retour} Photo={Photo}/> : null}
      {ouvert === 'lots' && lot ? <Repartir key={lot.tx + ':' + lot.articles.length} lot={lot} fichesLibres={fichesLibres} onRelier={onRelier} Photo={Photo} Retour={Retour}
        onFermer={() => setLotTx('')}
        onEnregistrer={async (x) => { const ok = await onRepartir(x); if (ok) setLotTx(''); }}
        onAnnulerRepartition={async (l) => { const ok = await onAnnulerRepartition(l); if (ok) setLotTx(''); }}/> : null}
    </>
  );
}
