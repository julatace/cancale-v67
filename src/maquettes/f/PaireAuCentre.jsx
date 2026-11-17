// ════════════════════════════════════════════════════════════════════════════
//  MAQUETTE F — « LA PAIRE AU CENTRE » (17 nov.) — un PROTOTYPE à montrer, pas livré.
//  Monté seulement si `localStorage.vrm_banc_maquette === 'f'` (posé par le banc
//  scripts/bancs/maquette-f.cjs ; aucun bouton de l'app ne le pose : invisible pour Julien).
//
//  L'idée : on ne navigue plus par écrans (Ventes, Achats, Annonces, Colis…) mais par la
//  PAIRE. Une barre de commande toujours là (N°, pseudo, n° de suivi, code, modèle,
//  « à envoyer », « colis Super U »…) répond par des fiches vivantes ; chaque paire a SA
//  page qui raconte toute sa vie (achat → case → annonces → vente → bordereau → envoi →
//  argent) avec le geste du moment ; les listes sont des RECHERCHES ENREGISTRÉES (pastilles).
//  iPhone : barre + pastilles en haut, une colonne. Ordinateur : recherche · liste · fiche.
//  Textes en français seulement (prototype) : à passer par tr() s'il est retenu.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { lireDonnees, chercher, euros, jourCourt } from './donnees.js';
import { finDemarrage } from '../../demarrage.js';
import '../../design/studio-polices.css';
import './paire-au-centre.css';

const J = 86400000;
const ORDRE_LISTES = ['envoyer', 'retirer', 'offres', 'enligne', 'dorment'];
const ETAPES = [['achat', 'Achat'], ['case', 'Case'], ['ligne', 'En ligne'], ['vente', 'Vendue'], ['bord', 'Bordereau'], ['envoi', 'Envoi'], ['argent', 'Argent']];

// ── La route vit dans l'adresse (#q=…&liste=…&paire=…) : retour arrière du téléphone compris.
const lireRoute = () => { const p = new URLSearchParams((window.location.hash || '').replace(/^#/, '')); return { q: p.get('q') || '', liste: p.get('liste') || '', paire: p.get('paire') || '', lieu: p.get('lieu') || '' }; };
const ecrireRoute = (r) => { const p = new URLSearchParams(); for (const k of ['q', 'liste', 'lieu', 'paire']) if (r[k]) p.set(k, r[k]); const h = p.toString(); window.location.hash = h ? h : ''; };
function useRoute() {
  const [r, setR] = React.useState(lireRoute);
  React.useEffect(() => { const f = () => setR(lireRoute()); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  return [r, (x) => ecrireRoute({ ...x })];
}
function useLarge() {
  const mq = '(min-width: 1100px)';
  const [l, setL] = React.useState(() => window.matchMedia(mq).matches);
  React.useEffect(() => { const m = window.matchMedia(mq); const f = () => setL(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  return l;
}

// ── Petites pièces ───────────────────────────────────────────────────────────
const Icone = ({ n, t = 20 }) => {
  const d = {
    loupe: 'M10.5 4a6.5 6.5 0 1 0 4.06 11.58l4.43 4.43 1.06-1.06-4.43-4.43A6.5 6.5 0 0 0 10.5 4zm0 1.5a5 5 0 1 1 0 10 5 5 0 0 1 0-10z',
    retour: 'M15.4 4.6 14.3 3.5 5.8 12l8.5 8.5 1.1-1.1L8 12z',
    croix: 'M6.4 5.3 5.3 6.4 10.9 12l-5.6 5.6 1.1 1.1 5.6-5.6 5.6 5.6 1.1-1.1-5.6-5.6 5.6-5.6-1.1-1.1-5.6 5.6z',
    chevron: 'M9.3 5.3 8.2 6.4 13.8 12l-5.6 5.6 1.1 1.1L16 12z',
    scan: 'M4 4h5v1.5H5.5V9H4zm11 0h5v5h-1.5V5.5H15zM4 15h1.5v3.5H9V20H4zm14.5 0H20v5h-5v-1.5h3.5zM7 11.25h10v1.5H7z',
    profil: 'M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0 1.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 20c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6H18c0-2.6-2.6-4.5-6-4.5S6 17.4 6 20z',
    etoile: 'M12 3.5l2.6 5.3 5.9.9-4.25 4.1 1 5.85L12 16.9l-5.25 2.75 1-5.85L3.5 9.7l5.9-.9z',
  }[n];
  return <svg className="f-ico" width={t} height={t} viewBox="0 0 24 24" aria-hidden="true"><path d={d} fill="currentColor" /></svg>;
};
const Plaque = ({ n, grand }) => (n ? <span className={'f-plaque' + (grand ? ' f-plaque--grand' : '')} data-numero={n}><span className="f-plaque-n">N°</span>{n}</span> : <span className="f-plaque f-plaque--vide">sans N°</span>);
const Vignette = ({ src, n, taille = 52 }) => (
  <span className="f-vignette" style={{ width: taille, height: taille }}>
    {src ? <img src={src} alt="" loading="lazy" decoding="async" width={taille} height={taille} /> : <span className="f-vignette-vide" />}
  </span>
);
// LE FIL DE VIE : sept marches, une par étape. Fait = encre ; geste = ambre ; pas encore = creux ; pas su = pointillé.
const Fil = ({ rang, grand }) => (
  <span className={'f-fil' + (grand ? ' f-fil--grand' : '')} aria-hidden={grand ? undefined : 'true'} role={grand ? 'list' : undefined}>
    {(rang || []).map((e, i) => <span key={i} role={grand ? 'listitem' : undefined} className={'f-fil-m is-' + e} title={grand ? ETAPES[i][1] : undefined}>{grand ? <span className="f-fil-l">{ETAPES[i][1]}</span> : null}</span>)}
  </span>
);
const ouTexte = (p, maintenant) => {
  if (!p) return '';
  if (p.ou === 'envoyer') { const e = p.vie.find((s) => s.cle === 'envoi'); return e && e.date ? `À envoyer avant ${jourCourt(e.date, maintenant)}` : 'À envoyer'; }
  if (p.ou === 'ligne' && p.annonce && p.annonce.cree) return `En ligne depuis ${Math.max(0, Math.round((maintenant - Date.parse(p.annonce.cree)) / J))} j`;
  if (p.vente && p.vente.date) return `${p.ouTexte} · ${jourCourt(p.vente.date, maintenant)}`;
  return p.ouTexte;
};

// Une fiche VIVANTE : la paire en une ligne (64 px), là où elle en est, son fil de vie.
function LigneVivante({ p, onOuvrir, actif, sous, valeur, tag, maintenant }) {
  const geste = p && p.ou === 'envoyer';
  return (
    <button type="button" className={'f-ligne' + (actif ? ' is-actif' : '')} aria-current={actif ? 'true' : undefined} onClick={onOuvrir} data-paire={p ? p.k : undefined}>
      <span className="f-ligne-vis"><Vignette src={p && p.photo} n={p && p.numero} /></span>
      <span className="f-ligne-corps">
        <span className="f-ligne-h"><Plaque n={p && p.numero} /><span className="f-ligne-titre">{p ? p.titre : ''}</span></span>
        <span className={'f-ligne-ou' + (geste ? ' is-geste' : '')}>{geste ? <i className="f-point" /> : null}{sous || ouTexte(p, maintenant)}{tag ? <span className="f-tag">{tag}</span> : null}</span>
        {p ? <Fil rang={p.rang} /> : null}
      </span>
      <span className="f-ligne-val">{valeur != null ? valeur : euros(p && (p.prixVente != null ? p.prixVente : p.prixAnnonce))}</span>
    </button>
  );
}

// ── LA BARRE DE COMMANDE ─────────────────────────────────────────────────────
function Barre({ route, aller, listes, large, autoFocus }) {
  const ref = React.useRef(null);
  const [txt, setTxt] = React.useState(route.q);
  React.useEffect(() => { setTxt(route.q); }, [route.q]);
  React.useEffect(() => { if (autoFocus && ref.current) ref.current.focus({ preventScroll: true }); }, [autoFocus]);
  React.useEffect(() => {
    const f = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); ref.current && ref.current.focus(); } };
    window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f);
  }, []);
  const jeton = route.liste ? listes[route.liste] : null;
  const changer = (v) => { setTxt(v); aller({ ...route, q: v, liste: v ? '' : route.liste, lieu: v ? '' : route.lieu, paire: large ? route.paire : '' }); };
  return (
    <div className="f-barre" role="search">
      <Icone n="loupe" />
      {jeton && !txt ? <button type="button" className="f-jeton" onClick={() => aller({ paire: large ? route.paire : '' })} aria-label={`Retirer le filtre ${jeton.nom}`}>{jeton.nom}{route.lieu ? ` · ${route.lieu}` : ''}<Icone n="croix" t={14} /></button> : null}
      <input ref={ref} className="f-barre-champ" value={txt} onChange={(e) => changer(e.target.value)} placeholder={jeton ? '' : 'N°, pseudo, suivi, code, modèle…'} aria-label="Chercher une paire" enterKeyHint="search" autoComplete="off" spellCheck={false} />
      {txt ? <button type="button" className="f-barre-x" onClick={() => changer('')} aria-label="Effacer"><Icone n="croix" t={16} /></button>
        : large ? <kbd className="f-kbd">⌘K</kbd> : <button type="button" className="f-barre-x" aria-label="Scanner un code"><Icone n="scan" t={20} /></button>}
    </div>
  );
}
function Pastilles({ listes, route, aller, large }) {
  return (
    <nav className={'f-pastilles' + (large ? ' f-pastilles--rail' : '')} aria-label="Recherches enregistrées">
      {ORDRE_LISTES.map((k) => { const l = listes[k]; const on = route.liste === k && !route.q;
        return (
          <button key={k} type="button" className={'f-pastille' + (on ? ' is-actif' : '')} aria-pressed={on} onClick={() => aller({ liste: on && !large ? '' : k, paire: large ? route.paire : '' })} data-liste={k}>
            {l.geste && l.n ? <i className="f-point" /> : null}<span className="f-pastille-nom">{l.nom}</span><span className="f-pastille-n">{l.n == null ? '—' : l.n.toLocaleString('fr-FR')}</span>
          </button>
        ); })}
    </nav>
  );
}

// ── L'ACCUEIL : le geste du moment, puis ce qui bouge ─────────────────────────
function Accueil({ m, aller, route, large }) {
  const env = m.listes.envoyer; const ret = m.listes.retirer;
  const avecBord = (env.lignes || []).filter((x) => x.bord).length;
  const urgent = (env.lignes || []).filter((x) => x.limite && x.limite - m.maintenant < 2 * J).length;
  const bouge = [...m.paires.values()].filter((p) => p.vente).sort((a, b) => (Date.parse(b.vente.date) || 0) - (Date.parse(a.vente.date) || 0)).slice(0, large ? 9 : 6);
  const jour = new Date(m.maintenant).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' });
  return (
    <div className="f-accueil">
      <section className="f-geste" aria-label="Le geste du moment">
        <p className="f-geste-sur">{jour}</p>
        <p className="f-geste-chiffre"><span className="f-affiche">{env.n == null ? '—' : env.n}</span><span className="f-geste-unite">colis à envoyer</span></p>
        <p className="f-geste-dit">{urgent ? <><i className="f-point" />{urgent} avant demain soir</> : 'Aucun avant demain'}{ret.n ? ` · ${ret.n} à retirer` : ''}</p>
        <div className="f-geste-actions">
          <button type="button" className="f-plein" onClick={() => aller({ liste: 'envoyer' })} data-plein="1">Imprimer {avecBord}</button>
          <button type="button" className="f-lien" onClick={() => aller({ liste: 'envoyer' })}>Voir la liste</button>
        </div>
      </section>
      <h2 className="f-titre-section">Ça bouge</h2>
      <div className="f-plan">
        {bouge.map((p) => <LigneVivante key={p.k} p={p} maintenant={m.maintenant} actif={route.paire === p.numero} onOuvrir={() => aller({ ...route, paire: p.numero })} />)}
      </div>
      <p className="f-pied">Lu il y a {Math.max(1, Math.round((m.maintenant - Date.parse(m.luListings || '')) / 60000)) || '—'} min · {m.paires.size.toLocaleString('fr-FR')} paires numérotées</p>
    </div>
  );
}

// ── UNE RECHERCHE EN COURS ───────────────────────────────────────────────────
const PAR = { numero: 'N° exact', suivi: 'n° de suivi exact', code: 'code de retrait exact', transaction: 'n° de transaction exact', pseudo: 'pseudo', titre: 'titre', rangement: 'case', montant: 'montant exact' };
// Une correspondance PARTIELLE ne se dit jamais « exacte » (« 1240 » contient « 124 », ce n'est pas lui).
const CONTIENT = { numero: 'N° qui contient', suivi: 'suivi qui contient', transaction: 'n° qui contient', rangement: 'case' };
const GENRES = { numero: 'un N°', transaction: 'un n° de transaction', suivi: 'un n° de suivi', code: 'un code de retrait', pseudo: 'un pseudo', mots: 'des mots du titre', montant: 'un montant' };
function Resultats({ m, route, aller }) {
  const r = React.useMemo(() => chercher(m, route.q), [m, route.q]);
  if (!r) return null;
  const ouvrir = (x) => { if (x.paire) aller({ ...route, paire: x.paire.numero }); };
  const ligneDe = (x, tag) => {
    const e = x.t.e;
    if (x.paire) return <LigneVivante key={x.t.e.cle} p={x.paire} maintenant={m.maintenant} tag={tag} actif={route.paire === x.paire.numero} onOuvrir={() => ouvrir(x)} />;
    // Pas de paire (annonce sans N°, colis, conversation) : la ligne dit CE qu'elle est, sans rien relier.
    const quoi = e.groupe === 'retrait' || e.type === 'colis' ? `Colis${e.c && e.c.lieu ? ' · ' + e.c.lieu.split('\n')[0] : ''}` : e.type === 'message' ? `Conversation · ${(e.pseudosAff || [])[0] || ''}` : e.type === 'achat' ? 'Achat · pas relié à une paire' : e.type === 'annonce' ? 'En ligne · sans N°' : 'Vente · sans N°';
    return (
      <div key={e.cle} className="f-ligne f-ligne--seule">
        <span className="f-ligne-vis"><Vignette src={e.photo} /></span>
        <span className="f-ligne-corps"><span className="f-ligne-h"><span className="f-ligne-titre">{e.titre || (e.c && e.c.art) || '—'}</span></span><span className="f-ligne-ou">{quoi}{tag ? <span className="f-tag">{tag}</span> : null}</span></span>
        <span className="f-ligne-val">{e.codes && e.codes[0] ? e.codes[0] : ''}</span>
      </div>
    );
  };
  const genres = (r.genre.genres || []).map((g) => GENRES[g]).filter(Boolean);
  return (
    <div className="f-resultats" aria-live="polite">
      <p className="f-cherche">Je cherche {genres.length ? genres.join(' · ') : 'partout'}</p>
      {r.raccourcis.length ? (
        <div className="f-raccourcis">
          {r.raccourcis.map((x, i) => { const l = m.listes[x.cle];
            return <button key={i} type="button" className="f-raccourci" onClick={() => aller({ liste: x.cle, lieu: x.lieu || '' })}><span className="f-raccourci-quoi">{x.type === 'lieu' ? `Colis à retirer · ${x.lieu}` : l.nom}</span><span className="f-raccourci-n">{x.type === 'lieu' ? x.n : l.n == null ? '—' : l.n}</span><Icone n="chevron" t={16} /></button>; })}
        </div>
      ) : null}
      {r.exactes.length ? <><h2 className="f-titre-section">C’est elle<span className="f-titre-sous">identité exacte</span></h2><div className="f-plan">{r.exactes.map((x) => ligneDe(x, PAR[x.t.par]))}</div></> : null}
      {r.personnes.length ? <><h2 className="f-titre-section">Personnes</h2><div className="f-plan">{r.personnes.slice(0, 5).map((x) => ligneDe(x, x.t.valeur))}</div></> : null}
      {r.reste.length ? <><h2 className="f-titre-section">Autres N° et colis</h2><div className="f-plan">{r.reste.slice(0, 6).map((x) => ligneDe(x, x.t.exact ? PAR[x.t.par] : CONTIENT[x.t.par] || 'proche'))}</div></> : null}
      {r.ressemble.length ? <><h2 className="f-titre-section">Ressemble<span className="f-titre-sous">par le titre · à toi de choisir, rien n’est relié</span></h2><div className="f-plan">{r.ressemble.slice(0, 8).map((x) => ligneDe(x))}</div></> : null}
      {!r.total && !r.raccourcis.length ? <p className="f-vide">Rien pour « {r.q} ».</p> : null}
    </div>
  );
}

// ── UNE LISTE ENREGISTRÉE ────────────────────────────────────────────────────
function Liste({ m, route, aller, large }) {
  const l = m.listes[route.liste]; if (!l) return null;
  let lignes = l.lignes || [];
  if (route.lieu) lignes = lignes.filter((c) => (c.lieu || '').split('\n')[0] === route.lieu);
  if (l.cle === 'envoyer') {
    const demain = m.maintenant + 2 * J, semaine = m.maintenant + 7 * J;
    const groupes = [['Avant demain soir', lignes.filter((x) => x.limite && x.limite < demain)], ['Cette semaine', lignes.filter((x) => x.limite && x.limite >= demain && x.limite < semaine)],
      ['Plus tard', lignes.filter((x) => x.limite && x.limite >= semaine)], ['Pas de date lue · estimation vente + 7 j', lignes.filter((x) => !x.limite)]].filter((g) => g[1].length);
    const avecBord = lignes.filter((x) => x.bord).length;
    return (
      <div className="f-liste">
        <header className="f-liste-tete">
          <p className="f-liste-chiffre"><span className="f-affiche">{lignes.length}</span><span className="f-geste-unite">colis à envoyer</span></p>
          <p className="f-geste-dit">{avecBord} bordereaux reçus · {lignes.length - avecBord} pas encore</p>
        </header>
        {groupes.map(([t, g]) => (
          <section key={t}><h2 className="f-titre-section">{t}<span className="f-titre-n">{g.length}</span></h2>
            <div className="f-plan">{g.slice(0, large ? 40 : 24).map((x) => x.paire
              ? <LigneVivante key={x.cle} p={x.paire} maintenant={m.maintenant} actif={route.paire === x.paire.numero} sous={`${x.limite ? 'avant ' + jourCourt(new Date(x.limite).toISOString(), m.maintenant) : 'vers ' + jourCourt(new Date(x.estimee).toISOString(), m.maintenant)}${x.pseudo ? ' · ' + x.pseudo : ''}`} valeur={euros(x.paire.prixVente)} onOuvrir={() => aller({ ...route, paire: x.paire.numero })} />
              : <div key={x.cle} className="f-ligne f-ligne--seule"><span className="f-ligne-vis"><Vignette src={x.v.photo && x.v.photo.url} /></span><span className="f-ligne-corps"><span className="f-ligne-h"><Plaque n={null} /><span className="f-ligne-titre">{x.v.title}</span></span><span className="f-ligne-ou">{x.limite ? 'avant ' + jourCourt(new Date(x.limite).toISOString(), m.maintenant) : 'vers ' + jourCourt(new Date(x.estimee).toISOString(), m.maintenant)} · {x.compte}</span></span><span className="f-ligne-val">{euros(Number(x.v.price && x.v.price.amount) * 100)}</span></div>)}
            </div></section>
        ))}
        {!large ? <div className="f-flottant"><button type="button" className="f-plein" data-plein="1">Imprimer {avecBord} bordereaux</button></div> : null}
      </div>
    );
  }
  if (l.cle === 'retirer') {
    return (
      <div className="f-liste">
        <header className="f-liste-tete"><p className="f-liste-chiffre"><span className="f-affiche">{lignes.length}</span><span className="f-geste-unite">colis à retirer{route.lieu ? ` · ${route.lieu}` : ''}</span></p></header>
        <div className="f-plan">{lignes.map((c) => (
          <div key={c.id} className="f-ligne f-ligne--seule"><span className="f-code">{c.code || '—'}</span><span className="f-ligne-corps"><span className="f-ligne-h"><span className="f-ligne-titre">{(c.lieu || '').split('\n')[0] || '—'}</span></span><span className="f-ligne-ou">{c.limite ? `jusqu’au ${jourCourt(c.limite, m.maintenant)}` : 'date limite pas lue'} · {c.art || 'article pas lu'}</span></span></div>
        ))}</div>
      </div>
    );
  }
  if (l.cle === 'offres') {
    return (
      <div className="f-liste">
        <header className="f-liste-tete"><p className="f-liste-chiffre"><span className="f-affiche">{lignes.length}</span><span className="f-geste-unite">offres sans réponse</span></p></header>
        <div className="f-plan">{lignes.slice(0, 40).map((o) => { const k = m.numParItem.get(o.item); const p = k ? m.paires.get(k) : null;
          return p ? <LigneVivante key={o.conv} p={p} maintenant={m.maintenant} sous={`${o.pseudo} propose`} valeur={euros(o.montant)} actif={route.paire === p.numero} onOuvrir={() => aller({ ...route, paire: p.numero })} />
            : <div key={o.conv} className="f-ligne f-ligne--seule"><span className="f-ligne-vis"><Vignette src={o.photo} /></span><span className="f-ligne-corps"><span className="f-ligne-h"><span className="f-ligne-titre">{o.titre}</span></span><span className="f-ligne-ou">{o.pseudo} propose</span></span><span className="f-ligne-val">{euros(o.montant)}</span></div>; })}</div>
      </div>
    );
  }
  const ann = lignes.slice().sort((a, b) => (Date.parse(a.cree) || 0) - (Date.parse(b.cree) || 0));
  return (
    <div className="f-liste">
      <header className="f-liste-tete"><p className="f-liste-chiffre"><span className="f-affiche">{lignes.length.toLocaleString('fr-FR')}</span><span className="f-geste-unite">{l.cle === 'dorment' ? 'en ligne depuis plus de 60 j' : 'annonces en ligne'}</span></p></header>
      <div className="f-plan">{ann.slice(0, 60).map((a) => { const k = m.numParItem.get(a.id); const p = k ? m.paires.get(k) : null;
        return p ? <LigneVivante key={a.id} p={p} maintenant={m.maintenant} actif={route.paire === p.numero} onOuvrir={() => aller({ ...route, paire: p.numero })} /> : null; })}</div>
    </div>
  );
}

// ── LA PAGE D'UNE PAIRE : toute sa vie ───────────────────────────────────────
function PagePaire({ p, m, fermer, large }) {
  if (!p) return <div className="f-fiche f-fiche--vide"><p className="f-vide">Choisis une paire : elle raconte toute sa vie ici.</p></div>;
  const envoi = p.vie.find((s) => s.cle === 'envoi');
  const geste = p.ou === 'envoyer';
  return (
    <article className="f-fiche" aria-label={`Paire N° ${p.numero}`} data-fiche={p.k}>
      {!large ? (
        <div className="f-fiche-haut">
          <button type="button" className="f-rond" onClick={fermer} aria-label="Retour"><Icone n="retour" /></button>
          <span className="f-fiche-haut-t">{p.ouTexte}</span>
          <button type="button" className="f-rond" onClick={fermer} aria-label="Chercher"><Icone n="loupe" /></button>
        </div>
      ) : null}
      <div className="f-heros">
        <div className="f-heros-photo">{p.photo ? <img src={p.photo} alt="" decoding="async" /> : null}<Plaque n={p.numero} grand /></div>
        <div className="f-heros-txt">
          <h1 className="f-heros-titre">{p.titre}</h1>
          <p className="f-heros-meta">{[p.taille && `Taille ${p.taille}`, p.etatArticle, p.compte].filter(Boolean).join(' · ')}</p>
        </div>
      </div>
      <Fil rang={p.rang} grand />
      {geste ? (
        <section className="f-maintenant" aria-label="Maintenant">
          <p className="f-maintenant-t"><i className="f-point" />{envoi && envoi.date ? `À envoyer avant ${jourCourt(envoi.date, m.maintenant)}` : 'À envoyer'}</p>
          <p className="f-maintenant-d">{p.bord ? `Bordereau reçu ${jourCourt(p.bord.recu, m.maintenant)} · ${p.bord.suivi}` : 'Bordereau pas encore reçu par e-mail'}{p.cases.length ? ` · case ${p.cases.join(', ')}` : ''}</p>
          {p.bord ? <button type="button" className="f-plein f-plein--large" data-plein="1">Imprimer le bordereau</button> : null}
          <button type="button" className="f-lien">Déjà parti</button>
        </section>
      ) : null}
      <dl className="f-chiffres">
        <div><dt>Achat</dt><dd>{euros(p.cout)}</dd></div>
        <div><dt>{p.vente ? 'Vente' : 'Prix affiché'}</dt><dd>{euros(p.vente ? p.prixVente : p.prixAnnonce)}</dd></div>
        <div><dt>Marge</dt><dd>{p.marge == null ? '—' : euros(p.marge, { signe: true })}</dd></div>
      </dl>
      <h2 className="f-titre-section">Sa vie</h2>
      <ol className="f-vie">
        {p.vie.map((s) => (
          <li key={s.cle} className={'f-vie-e is-' + s.etat} data-etape={s.cle} data-etat={s.etat}>
            <span className="f-vie-date">{s.date ? jourCourt(s.date, m.maintenant) : ''}</span>
            <span className="f-vie-rail"><i /></span>
            <span className="f-vie-corps">
              <span className="f-vie-t">{s.titre}{s.valeur != null ? <span className="f-vie-v">{euros(s.valeur)}</span> : null}</span>
              {s.detail ? <span className="f-vie-d">{s.etat === 'passu' ? '— ' : ''}{s.detail}</span> : null}
              {s.geste && s.etat !== 'geste' ? <button type="button" className="f-lien f-lien--petit">{s.geste}</button> : null}
            </span>
          </li>
        ))}
      </ol>
      {p.pseudo ? (
        <>
          <h2 className="f-titre-section">Autour d’elle</h2>
          <div className="f-plan">
            <button type="button" className="f-rangee"><span className="f-rangee-t">Conversation avec {p.pseudo}</span><Icone n="chevron" t={16} /></button>
            <button type="button" className="f-rangee"><span className="f-rangee-t">Annonce Vinted · {p.compte}</span><Icone n="chevron" t={16} /></button>
          </div>
        </>
      ) : null}
    </article>
  );
}

// ── LA RACINE ────────────────────────────────────────────────────────────────
export default function PaireAuCentre() {
  const [m, setM] = React.useState(undefined);
  const [route, aller] = useRoute();
  const large = useLarge();
  React.useEffect(() => { let vivant = true; lireDonnees().then((x) => vivant && setM(x), () => vivant && setM(null)); return () => { vivant = false; }; }, []);
  React.useEffect(() => { finDemarrage('maquette-f'); }, []);
  React.useEffect(() => { document.documentElement.setAttribute('data-maquette', 'f'); }, []);
  if (m === undefined) return <div className="f-racine f-attente" aria-busy="true" />;
  if (m === null) return <div className="f-racine"><p className="f-vide">Ta base n’a pas répondu.</p></div>;
  const p = route.paire ? m.paires.get(String(route.paire).toUpperCase().replace(/^0+(?=\d)/, '')) || null : null;
  const milieu = route.q ? <Resultats m={m} route={route} aller={aller} /> : route.liste ? <Liste m={m} route={route} aller={aller} large={large} /> : <Accueil m={m} route={route} aller={aller} large={large} />;
  if (large) {
    return (
      <div className="f-racine f-racine--large" data-vue="large">
        <aside className="f-rail">
          <div className="f-marque">VRM<span className="f-marque-sous">la paire au centre</span></div>
          <Barre route={route} aller={aller} listes={m.listes} large />
          <p className="f-rail-t">Recherches enregistrées</p>
          <Pastilles listes={m.listes} route={route} aller={aller} large />
          <p className="f-rail-t">Comptes</p>
          <ul className="f-comptes">{(m.comptes || []).map((c) => <li key={c.uid}>{c.login}</li>)}</ul>
        </aside>
        <main className="f-milieu" data-colonne="liste">{milieu}</main>
        <section className="f-droite" data-colonne="fiche"><PagePaire p={p} m={m} large /></section>
      </div>
    );
  }
  if (p) return <div className="f-racine" data-vue="paire"><PagePaire p={p} m={m} fermer={() => window.history.back()} /></div>;
  return (
    <div className="f-racine" data-vue={route.q ? 'recherche' : route.liste ? 'liste' : 'accueil'}>
      <header className="f-tete">
        <div className="f-tete-l"><span className="f-marque">VRM</span><button type="button" className="f-rond f-rond--petit" aria-label="Ton compte et les réglages"><Icone n="profil" /></button></div>
        <Barre route={route} aller={aller} listes={m.listes} autoFocus={!!route.q} />
        <Pastilles listes={m.listes} route={route} aller={aller} />
      </header>
      {milieu}
    </div>
  );
}
