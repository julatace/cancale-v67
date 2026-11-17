// ════════════════════════════════════════════════════════════════════════════
//  MAQUETTE H — « L'ATELIER » (17 nov.) — un PROTOTYPE à montrer, pas livré.
//  Monté seulement si `localStorage.vrm_banc_maquette === 'h'` (posé par le banc
//  scripts/bancs/maquette-h.cjs ; aucun bouton de l'app ne le pose : invisible pour Julien).
//
//  Julien (17 nov.) : « j'aime bien le C, propose encore plein d'autres maquettes » ;
//  « change tout, même la disposition des boutons ».
//  L'idée : l'app suit les gestes PHYSIQUES de sa journée, comme des POSTES de travail —
//  Recevoir · Ranger · Publier · Emballer & poster · Encaisser. La barre du bas = ces cinq
//  postes, le disque du milieu = LE SCANNER (n'importe quel code ouvre la bonne chose).
//  Chaque poste montre d'abord CE QU'IL Y A À FAIRE maintenant, sous le rail souligné de C.
//  Ventes, Achats, Annonces, Stock deviennent l'HISTORIQUE (dernier cran du rail) de leur poste.
//  Les BOUTONS descendent sous le pouce : en haut, plus rien qu'un titre et le rail ; en bas, un
//  plateau (« chercher dans ce poste » + LE geste du poste, le seul bouton plein) posé sur la barre.
//  Textes en français seulement (prototype) : à passer par tr() s'il est retenu.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { lireDonnees, chercher, euros, jourCourt } from './donnees.js';
import { IDENTITES_EXACTES } from '../../rechercheUnique.js';
import { finDemarrage } from '../../demarrage.js';
import '../../design/studio-polices.css';
import './atelier.css';

const J = 86400000;
const POSTES = [
  { cle: 'recevoir', nom: 'Recevoir', court: 'Recevoir' },
  { cle: 'ranger', nom: 'Ranger', court: 'Ranger' },
  { cle: 'publier', nom: 'Publier', court: 'Publier' },
  { cle: 'poster', nom: 'Emballer & poster', court: 'Poster' },
  { cle: 'encaisser', nom: 'Encaisser', court: 'Encaisser' },
];

const lireRoute = () => { const p = new URLSearchParams((window.location.hash || '').replace(/^#/, '')); return { poste: p.get('poste') || 'poster', rail: p.get('rail') || '', scan: p.get('scan') }; };
const ecrireRoute = (r) => { const p = new URLSearchParams(); for (const k of ['poste', 'rail', 'scan']) if (r[k] != null && r[k] !== '') p.set(k, r[k]); window.location.hash = p.toString(); };
function useRoute() {
  const [r, setR] = React.useState(lireRoute);
  React.useEffect(() => { const f = () => setR(lireRoute()); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  return [r, (x) => ecrireRoute(x)];
}
function useLarge() {
  const mq = '(min-width: 1100px)';
  const [l, setL] = React.useState(() => window.matchMedia(mq).matches);
  React.useEffect(() => { const m = window.matchMedia(mq); const f = () => setL(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  return l;
}
const nb = (n) => (n == null ? '—' : Number(n).toLocaleString('fr-FR'));
const heure = (t) => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });

// ── Pièces ──────────────────────────────────────────────────────────────────
const D = {
  boite: 'M12 2.6 20.5 7v10L12 21.4 3.5 17V7zm0 1.7L6 7.4l6 3.1 6-3.1zM5 8.6v7.5l6.25 3.2v-7.5zm14 0-6.25 3.2v7.5L19 16.1z',
  cases: 'M3.5 3.5h7.5V11H3.5zm1.5 1.5v4.5h4.5V5zm8-1.5h7.5V11H13zm1.5 1.5v4.5H19V5zM3.5 13H11v7.5H3.5zM5 14.5V19h4.5v-4.5zm8-1.5h7.5v7.5H13zm1.5 1.5V19H19v-4.5z',
  appareil: 'M8.6 4h6.8l1.4 2.2H20a1.5 1.5 0 0 1 1.5 1.5v10.8A1.5 1.5 0 0 1 20 20H4a1.5 1.5 0 0 1-1.5-1.5V7.7A1.5 1.5 0 0 1 4 6.2h3.2zm.8 1.5-1.4 2.2H4v10.8h16V7.7h-4l-1.4-2.2zM12 9a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0 1.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  colis: 'M4 7.5 12 3.5l8 4v9L12 20.5l-8-4zm1.5 1.2v6.9l5.75 2.9v-6.9zm13 0-5.75 2.9v6.9l5.75-2.9zM6.2 7.6 12 10.5l5.8-2.9L12 4.8z M14.5 5.9 8.7 8.8',
  euro: 'M14.8 5c1.3 0 2.5.3 3.5.9l-.7 1.3a5.6 5.6 0 0 0-2.8-.7c-2.3 0-4.2 1.5-4.9 3.6H15v1.4H9.6l-.03.5.03.5H15v1.4H9.9c.7 2.1 2.6 3.6 4.9 3.6 1 0 2-.3 2.8-.7l.7 1.3c-1 .6-2.2.9-3.5.9-3.2 0-5.8-2.1-6.5-5.1H6v-1.4h2.1L8 12l.05-.5H6v-1.4h2.3C9 7.1 11.6 5 14.8 5z',
  scan: 'M3.5 3.5H9V5H5v4H3.5zm11.5 0h5.5V9H19V5h-4zM3.5 15H5v4h4v1.5H3.5zm15.5 0h1.5v5.5H15V19h4zM6.5 11.25h11v1.5h-11z',
  loupe: 'M10.5 4a6.5 6.5 0 1 0 4.06 11.58l4.43 4.43 1.06-1.06-4.43-4.43A6.5 6.5 0 0 0 10.5 4zm0 1.5a5 5 0 1 1 0 10 5 5 0 0 1 0-10z',
  profil: 'M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0 1.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 20c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6H18c0-2.6-2.6-4.5-6-4.5S6 17.4 6 20z',
  chevron: 'M9.3 5.3 8.2 6.4 13.8 12l-5.6 5.6 1.1 1.1L16 12z',
  croix: 'M6.4 5.3 5.3 6.4 10.9 12l-5.6 5.6 1.1 1.1 5.6-5.6 5.6 5.6 1.1-1.1-5.6-5.6 5.6-5.6-1.1-1.1-5.6 5.6z',
  imprimante: 'M7 3.5h10V8h2.5A1.5 1.5 0 0 1 21 9.5v7a1.5 1.5 0 0 1-1.5 1.5H17v2.5H7V18H4.5A1.5 1.5 0 0 1 3 16.5v-7A1.5 1.5 0 0 1 4.5 8H7zM8.5 5v3h7V5zM4.5 9.5v7H7v-3h10v3h2.5v-7zm4 5.5v4h7v-4z',
  aide: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zm0 1.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15zm-.1 10.6a1 1 0 1 1 0 2 1 1 0 0 1 0-2zM12 7c1.8 0 3.1 1.1 3.1 2.6 0 1.2-.7 1.9-1.6 2.5-.6.4-.8.7-.8 1.3v.3h-1.5v-.4c0-1 .4-1.6 1.3-2.2.7-.5 1.1-.8 1.1-1.5 0-.7-.7-1.2-1.6-1.2-.9 0-1.6.5-1.7 1.4H8.8C8.9 8.2 10.2 7 12 7z',
};
const Ico = ({ n, t = 22 }) => <svg className="h-ico" width={t} height={t} viewBox="0 0 24 24" aria-hidden="true"><path d={D[n]} fill="currentColor" /></svg>;
const ICONE_POSTE = { recevoir: 'boite', ranger: 'cases', publier: 'appareil', poster: 'colis', encaisser: 'euro' };

const Plaque = ({ n }) => (n ? <span className="h-plaque" data-numero={n}><span className="h-plaque-n">N°</span>{n}</span> : <span className="h-plaque h-plaque--vide">sans N°</span>);
const Vignette = ({ src, t = 52 }) => (
  <span className="h-vignette" style={{ width: t, height: t }}>{src ? <img src={src} alt="" loading="lazy" decoding="async" width={t} height={t} /> : <span className="h-vignette-vide" />}</span>
);
// Une rangée ENTIÈRE se touche (jamais un bouton dedans) : 64–72 px.
const Ligne = ({ vignette, plaque, titre, sous, droite, droiteSous, ambre, onClick, cle }) => (
  <button type="button" className="h-ligne" onClick={onClick} data-ligne={cle}>
    {vignette !== undefined ? <Vignette src={vignette} /> : null}
    <span className="h-ligne-corps">
      <span className="h-ligne-titre">{plaque !== undefined ? <Plaque n={plaque} /> : null}<span className="h-ligne-nom">{titre}</span></span>
      {sous ? <span className="h-ligne-sous">{sous}</span> : null}
    </span>
    <span className="h-ligne-droite">
      {droite != null ? <span className={'h-ligne-val' + (ambre ? ' is-ambre' : '')}>{ambre ? <span className="h-point" /> : null}{droite}</span> : null}
      {droiteSous ? <span className="h-ligne-val-sous">{droiteSous}</span> : null}
    </span>
  </button>
);
const Section = ({ titre, n, sous, children, cle }) => (
  <section className="h-section" data-section={cle}>
    {titre ? <h2 className="h-section-titre">{titre}{n != null ? <span className="h-section-n">{n}</span> : null}{sous ? <span className="h-section-sous">{sous}</span> : null}</h2> : null}
    {children}
  </section>
);
const Plan = ({ children, max, total, suite }) => {
  const l = React.Children.toArray(children);
  return (
    <div className="h-plan">
      {max ? l.slice(0, max) : l}
      {max && (total || l.length) > max ? <div className="h-plan-suite">{suite || `et ${nb((total || l.length) - max)} de plus`}</div> : null}
    </div>
  );
};
const PasLu = ({ quoi }) => <div className="h-plan"><div className="h-vide">— · {quoi} pas lu{/s$/.test(quoi) ? 's' : ''}</div></div>;
const Vide = ({ texte }) => <div className="h-plan"><div className="h-vide">{texte}</div></div>;

// LE RAIL SOULIGNÉ (repris de C) : les sous-parties du poste ; la DERNIÈRE est toujours l'historique.
function Rail({ items, actif, choisir, sansNombre }) {
  return (
    <nav className="h-rail" aria-label="Sous-parties">
      {items.map((it) => (
        <button key={it.cle} type="button" className="h-rail-cran" aria-current={actif === it.cle ? 'true' : undefined} onClick={() => choisir(it.cle)} data-rail={it.cle}>
          <span className="h-rail-mot">{it.nom}</span>{it.n != null && it.cle !== sansNombre ? <span className={'h-rail-n' + (it.ambre ? ' is-ambre' : '')}>{nb(it.n)}</span> : null}
          {it.histo ? <Ico n="chevron" t={14} /> : null}
        </button>
      ))}
    </nav>
  );
}
// La bande de chiffres (≤ 72 px), sur le fond, pas de carte. « — » si pas su.
const Bande = ({ items }) => (
  <div className="h-bande">{items.map(([v, l, ambre], i) => (
    <div key={i} className="h-bande-c"><span className={'h-bande-v' + (ambre ? ' is-ambre' : '')}>{v}</span><span className="h-bande-l">{l}</span></div>
  ))}</div>
);

// ── LES CINQ POSTES ─────────────────────────────────────────────────────────
function railDe(cle, P) {
  const r = P.recevoir, g = P.ranger, u = P.publier, o = P.poster, e = P.encaisser;
  return {
    recevoir: [{ cle: 'faire', nom: 'À retirer', n: r.aRetirer ? r.aRetirer.length : null, ambre: true }, { cle: 'arrives', nom: 'Arrivés', n: r.arrives ? r.arrives.length : null }, { cle: 'route', nom: 'En route', n: r.enRoute ? r.enRoute.length : null }, { cle: 'histo', nom: 'Achats', histo: true }],
    ranger: [{ cle: 'faire', nom: 'Sans case', n: g.sansCase.length, ambre: true }, { cle: 'cases', nom: 'Cases', n: g.cases.length }, { cle: 'doublons', nom: 'Doublons', n: g.doublons.length }, { cle: 'histo', nom: 'Stock', histo: true }],
    publier: [{ cle: 'faire', nom: 'À publier', n: u.aPublier.length, ambre: true }, { cle: 'dorment', nom: 'Qui dorment', n: u.dorment ? u.dorment.length : null }, { cle: 'sansnum', nom: 'Sans N°', n: u.sansNumero ? u.sansNumero.length : null }, { cle: 'histo', nom: 'Annonces', histo: true }],
    poster: [{ cle: 'faire', nom: 'À imprimer', n: o.aImprimer ? o.aImprimer.length : null, ambre: true }, { cle: 'attente', nom: 'Sans bordereau', n: o.sansBord ? o.sansBord.length : null }, { cle: 'tournee', nom: 'Tournée' }, { cle: 'histo', nom: 'Ventes', histo: true }],
    encaisser: [{ cle: 'faire', nom: 'Maintenant' }, { cle: 'mois', nom: 'Ce mois' }, { cle: 'urssaf', nom: 'URSSAF' }, { cle: 'histo', nom: 'Versements', histo: true }],
  }[cle];
}
// LE geste du poste : le SEUL bouton plein de l'écran, sous le pouce (plateau du bas), sur l'ordinateur à droite du titre.
function gesteDe(cle, P) {
  const n = {
    recevoir: P.recevoir.arrives ? ['Numéroter', P.recevoir.arrives.length, 'arrives'] : null,
    ranger: ['Ranger', P.ranger.sansCase.length, 'faire'],
    publier: ['Publier', P.publier.aPublier.length, 'faire'],
    poster: P.poster.aImprimer ? ['Imprimer', P.poster.aImprimer.length, 'faire'] : null,
    encaisser: ['Saisir les prix', P.encaisser.sansCout.length],
  }[cle];
  return n && n[1] > 0 ? { mot: n[0], n: n[1], rail: n[2] || '' } : null;
}

// Julien (17 nov.) : « parfait, minimaliste et simple ». UN cran du rail = UNE liste ; aucun nombre écrit deux fois
// (le rail porte les comptes, aucune bande ne les répète) ; aucune phrase d'explication (elles sont derrière le « ? »).
const prix = (p) => { const v = p && typeof p === 'object' ? p.amount : p; const n = Number(v); return Number.isFinite(n) ? Math.round(n * 100) : null; };
const parJour = (lignes, t) => {
  const g = new Map();
  for (const l of lignes) { const k = l.limite ? 'avant ' + jourCourt(new Date(l.limite).toISOString(), t) : 'estimée'; if (!g.has(k)) g.set(k, []); g.get(k).push(l); }
  return [...g.entries()];
};
const LigneVente = ({ l, t }) => (
  <Ligne cle={l.cle} vignette={l.paire ? l.paire.photo : (l.v.photo && l.v.photo.url)} plaque={l.paire ? l.paire.numero : null} titre={l.v.title}
    sous={l.compte} droite={l.limite ? heure(l.limite) : 'estimée'} ambre={!!l.limite && l.limite - t < 36 * 3600e3} />
);
const LigneAchat = ({ a, M, t }) => (
  <Ligne cle={'a' + a._tx} vignette={a.photo && a.photo.url} titre={a.title} sous={M.loginDe(a._uid) || '—'} droite={euros(prix(a.price))} droiteSous={jourCourt(a.date, t)} />
);
const LignePaire = ({ p, droite, ambre, droiteSous }) => (
  <Ligne cle={'n' + p.k} vignette={p.photo} plaque={p.numero} titre={p.titre || '—'} sous={p.cases.length ? `case ${p.cases.join(', ')}` : p.compte} droite={droite} ambre={ambre} droiteSous={droiteSous} />
);
const LigneAnnonce = ({ a, M, t }) => (
  <Ligne cle={'d' + a.id} vignette={a.photo} plaque={M.numParItem.has(a.id) ? M.paires.get(M.numParItem.get(a.id)).numero : null} titre={a.title} sous={M.loginDe(a.uid)}
    droite={euros(prix(a.price))} droiteSous={a.cree ? `${Math.max(0, Math.round((t - Date.parse(a.cree)) / J))} j` : ''} />
);
const Groupes = ({ groupes, max, rendre }) => groupes.map(([k, ls], gi) => (
  <Section key={k} titre={k} n={nb(ls.length)} cle={'g' + gi}><Plan max={max} total={ls.length}>{ls.map(rendre)}</Plan></Section>
));

function Recevoir({ M, P, rail }) {
  const r = P.recevoir; const t = M.maintenant;
  if (rail === 'arrives') return !r.arrives ? <PasLu quoi="achats" /> : <Section cle="arrives"><Plan max={9} total={r.arrives.length}>{r.arrives.map((a) => <LigneAchat key={a._tx} a={a} M={M} t={t} />)}</Plan></Section>;
  if (rail === 'route') return !r.enRoute ? <PasLu quoi="achats" /> : <Section cle="route"><Plan max={9} total={r.enRoute.length}>{r.enRoute.map((a) => <LigneAchat key={a._tx} a={a} M={M} t={t} />)}</Plan></Section>;
  if (rail === 'histo') return !M.achats ? <PasLu quoi="achats" /> : <Section cle="achats"><Plan max={9} total={M.achats.length}>{[...M.achats].sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0)).map((a) => <LigneAchat key={a._tx} a={a} M={M} t={t} />)}</Plan></Section>;
  if (!r.points) return <PasLu quoi="e-mails des transporteurs" />;
  if (!r.points.length) return <Vide texte="Rien à retirer." />;
  return (
    <Section cle="retirer">
      {r.points.map((p) => (
        <div key={p.nom} className="h-plan h-point-carte" data-point="">
          <div className="h-point-tete">
            <span className="h-point-nom">{p.nom || '—'}</span>
            <span className="h-ligne-val is-ambre"><span className="h-point" />{p.limite < 9e15 ? `avant ${jourCourt(new Date(p.limite).toISOString(), t)}` : '—'}</span>
            {p.adresse ? <span className="h-point-adr">{p.adresse}</span> : null}
          </div>
          {p.colis.map((c) => (
            <button key={c.id} type="button" className="h-colis" data-colis={c.suivi}>
              <span className="h-code" aria-label={`Code de retrait ${c.code || '—'}`}>{c.code || '—'}</span>
              <span className="h-ligne-corps"><span className="h-ligne-nom">{c.art || '—'}</span></span>
            </button>
          ))}
        </div>
      ))}
    </Section>
  );
}

function Ranger({ M, P, rail, large }) {
  const g = P.ranger;
  if (rail === 'cases') return (
    <Section cle="cases"><div className="h-cases">
      {g.cases.slice(0, large ? 24 : 15).map((c) => (
        <button key={c.nom} type="button" className="h-case" data-case={c.nom}><span className="h-case-nom">{c.nom}</span><span className="h-case-n">{c.nums.length}</span></button>
      ))}
    </div></Section>
  );
  if (rail === 'doublons') return !g.doublons.length ? <Vide texte="Aucun N° porté par deux paires." /> : <Section cle="doublons"><Plan>{g.doublons.map((p) => <LignePaire key={p.k} p={p} droite="2 annonces" />)}</Plan></Section>;
  if (rail === 'histo') { const l = [...M.paires.values()].filter((p) => !p.vente).sort((a, b) => b.numero.localeCompare(a.numero, 'fr', { numeric: true })); return <Section cle="stock"><Plan max={9} total={l.length}>{l.map((p) => <LignePaire key={p.k} p={p} />)}</Plan></Section>; }
  if (!g.sansCase.length) return <Vide texte="Tout est rangé." />;
  return <Section cle="aranger"><Plan max={9} total={g.sansCase.length}>{g.sansCase.map((p) => <LignePaire key={p.k} p={p} />)}</Plan></Section>;
}

function Publier({ M, P, rail }) {
  const u = P.publier; const t = M.maintenant;
  if (rail === 'dorment') return !u.dorment ? <PasLu quoi="annonces" /> : <Section cle="dorment"><Plan max={9} total={u.dorment.length}>{[...u.dorment].sort((a, b) => Date.parse(a.cree) - Date.parse(b.cree)).map((a) => <LigneAnnonce key={a.id} a={a} M={M} t={t} />)}</Plan></Section>;
  if (rail === 'sansnum') return !u.sansNumero ? <PasLu quoi="annonces" /> : !u.sansNumero.length ? <Vide texte="Chaque annonce a son N°." /> : <Section cle="sansnum"><Plan max={9} total={u.sansNumero.length}>{u.sansNumero.map((a) => <LigneAnnonce key={a.id} a={a} M={M} t={t} />)}</Plan></Section>;
  if (rail === 'histo') return !u.enLigne ? <PasLu quoi="annonces" /> : <Section cle="annonces"><Plan max={9} total={u.enLigne.length}>{[...u.enLigne].sort((a, b) => Date.parse(b.cree || 0) - Date.parse(a.cree || 0)).map((a) => <LigneAnnonce key={a.id} a={a} M={M} t={t} />)}</Plan></Section>;
  if (!u.aPublier.length) return <Vide texte="Tout ce qui est rangé est en ligne." />;
  return <Section cle="apublier"><Plan max={9} total={u.aPublier.length}>{u.aPublier.map((p) => <LignePaire key={p.k} p={p} droite={p.cout != null ? euros(p.cout) : '—'} />)}</Plan></Section>;
}

function Poster({ M, P, rail, large }) {
  const o = P.poster; const t = M.maintenant; const r = P.recevoir;
  if (!o.envoyer) return <PasLu quoi="ventes" />;
  if (rail === 'histo') return !M.ventes ? <PasLu quoi="ventes" /> : <Section cle="ventes"><Plan max={9} total={M.ventes.length}>{[...M.ventes].sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0)).map((v) => { const k = M.numParItem.get(v._item); const p = k ? M.paires.get(k) : null; return <Ligne key={v._tx} cle={'v' + v._tx} vignette={p ? p.photo : (v.photo && v.photo.url)} plaque={p ? p.numero : null} titre={v.title} sous={M.loginDe(v._uid)} droite={euros(prix(v.price))} droiteSous={jourCourt(v.date, t)} />; })}</Plan></Section>;
  if (rail === 'tournee') {
    const parTransp = new Map();
    for (const l of o.aImprimer) { const k = /^XW/.test(l.bord.suivi) ? 'Colissimo' : 'Transporteur pas lu'; parTransp.set(k, (parTransp.get(k) || 0) + 1); }
    return (
      <Section cle="tournee"><div className="h-plan h-tournee">
        {[...parTransp.entries()].map(([k, n]) => <div key={k} className="h-tournee-l"><span className="h-tournee-v">Déposer {n}</span><span className="h-ligne-sous">{k}</span></div>)}
        {r.points ? r.points.map((p) => <div key={p.nom} className="h-tournee-l"><span className="h-tournee-v">Retirer {p.colis.length}</span><span className="h-ligne-sous">{p.nom}</span></div>) : null}
      </div></Section>
    );
  }
  const lignes = rail === 'attente' ? o.sansBord : o.aImprimer;
  if (!lignes.length) return <Vide texte={rail === 'attente' ? 'Chaque vente a son bordereau.' : 'Rien à imprimer.'} />;
  return <Groupes groupes={parJour(lignes, t).slice(0, large ? 4 : 3)} max={large ? 9 : 5} rendre={(l) => <LigneVente key={l.cle} l={l} t={t} />} />;
}

function Encaisser({ M, P, rail }) {
  const e = P.encaisser; const t = M.maintenant;
  const LigneVersee = (x) => <Ligne key={x.v._tx} cle={'v' + x.v._tx} vignette={x.paire ? x.paire.photo : (x.v.photo && x.v.photo.url)} plaque={x.paire ? x.paire.numero : null} titre={x.v.title} sous={jourCourt(x.le, t)} droite={euros(prix(x.v.price))} droiteSous={x.paire && x.paire.marge != null ? euros(x.paire.marge, { signe: true }) : '—'} />;
  if (rail === 'mois') return (
    <>
      <div className="h-affiche" data-affiche=""><span className="h-affiche-v">{e.recuMois == null ? '—' : euros(e.recuMois)}</span><span className="h-affiche-l">reçu en {new Date(t).toLocaleDateString('fr-FR', { month: 'long', timeZone: 'Europe/Paris' })}</span></div>
      {!e.ceMois ? <PasLu quoi="transactions" /> : <Section cle="mois"><Plan max={7} total={e.ceMois.length}>{e.ceMois.map(LigneVersee)}</Plan></Section>}
    </>
  );
  if (rail === 'urssaf') return (
    <>
      <div className="h-affiche" data-affiche=""><span className="h-affiche-v">—</span><span className="h-affiche-l">URSSAF du mois</span></div>
      <Section cle="urssaf"><Plan><Ligne cle="statut" titre="Choisir ton statut" droite="à faire" ambre /></Plan></Section>
    </>
  );
  if (rail === 'histo') return !e.versees ? <PasLu quoi="transactions" /> : <Section cle="versements"><Plan max={9} total={e.versees.length}>{e.versees.map(LigneVersee)}</Plan></Section>;
  return (
    <>
      <div className="h-affiche" data-affiche="">
        <span className="h-affiche-v">{e.solde ? euros(e.solde.dispo) : '—'}</span>
        <span className="h-affiche-l">disponible{e.solde ? ` · ${euros(e.solde.attente)} en attente` : ''}</span>
      </div>
      <Section cle="afaire">
        <Plan>
          <Ligne cle="statut" titre="Statut URSSAF" droite="à choisir" ambre />
          <Ligne cle="virer" titre="Virer vers ta banque" droite="sur Vinted" />
        </Plan>
      </Section>
    </>
  );
}
const ECRAN = { recevoir: Recevoir, ranger: Ranger, publier: Publier, poster: Poster, encaisser: Encaisser };

// ── LE SCANNER : n'importe quel code (N°, n° de suivi, code de retrait, n° de transaction) ouvre la bonne chose.
// Une identité EXACTE seulement ; un titre ne fait que PROPOSER (« Ressemble — à toi de choisir »).
function posteDe(paire) {
  if (!paire) return null;
  return { envoyer: 'poster', route: 'poster', payee: 'encaisser', ligne: 'publier', stock: paire.cases.length ? 'publier' : 'ranger' }[paire.ou] || null;
}
function Scanner({ M, code, fermer, aller }) {
  const [q, setQ] = React.useState(code || '');
  const r = React.useMemo(() => (q.trim() ? chercher(M, q) : null), [M, q]);
  const ex = r && r.exactes.find((x) => x.exact);
  const colis = ex && !ex.paire && /colis|achat|retour/.test(ex.t.e.type);
  const poste = ex ? (colis ? 'recevoir' : posteDe(ex.paire)) : null;
  const nomPoste = poste ? POSTES.find((p) => p.cle === poste).nom : '';
  return (
    <div className="h-voile" onClick={fermer}>
      <div className="h-feuille" role="dialog" aria-label="Scanner" onClick={(e) => e.stopPropagation()}>
        <div className="h-feuille-poignee" />
        <div className="h-viseur" aria-hidden="true"><span /><span /><span /><span /><i className="h-viseur-trait" /></div>
        <label className="h-champ h-champ--scan"><Ico n="scan" t={20} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ou tape un N°, un suivi, un code" inputMode="text" /></label>
        {r && ex ? (
          <div className="h-plan h-trouve" data-trouve={ex.t.par}>
            <div className="h-trouve-tete">C’est {ex.paire ? 'elle' : 'lui'} · par {IDENTITES_EXACTES[ex.t.par]}</div>
            {ex.paire ? <Ligne cle="trouve" vignette={ex.paire.photo} plaque={ex.paire.numero} titre={ex.paire.titre} sous={`${ex.paire.ouTexte}${ex.paire.cases.length ? ` · case ${ex.paire.cases.join(', ')}` : ''}`} droite={euros(ex.paire.prixVente != null ? ex.paire.prixVente : ex.paire.prixAnnonce)} />
              : <Ligne cle="trouve" titre={ex.t.e.titre || ex.t.e.art || 'Colis'} sous={ex.t.e.lieu || ''} />}
            {poste ? <button type="button" className="h-ouvrir" onClick={() => aller(poste)} data-ouvre={poste}>Ouvrir dans {nomPoste}<Ico n="chevron" t={16} /></button> : null}
          </div>
        ) : r ? (
          <div className="h-plan"><div className="h-vide">Aucune identité exacte pour « {r.q} ».{r.ressemble.length ? ` ${r.ressemble.length} titre${r.ressemble.length > 1 ? 's' : ''} ressemble${r.ressemble.length > 1 ? 'nt' : ''} — à toi de choisir, rien n’est relié.` : ''}</div></div>
        ) : null}
      </div>
    </div>
  );
}

// ── LA RACINE ───────────────────────────────────────────────────────────────
export default function Atelier() {
  const [M, setM] = React.useState(undefined);
  const [route, aller] = useRoute();
  const large = useLarge();
  React.useEffect(() => {
    const d = document.documentElement; d.setAttribute('data-maquette', 'h');
    let sombre = null; try { const v = localStorage.getItem('vinted_dark'); if (v === 'true') sombre = true; else if (v === 'false') sombre = false; } catch (_) {}
    if (sombre == null) sombre = window.matchMedia('(prefers-color-scheme: dark)').matches;
    d.setAttribute('data-theme', sombre ? 'dark' : 'light');
  }, []);
  React.useEffect(() => { lireDonnees().then(setM, () => setM(null)); }, []);
  React.useEffect(() => { if (M !== undefined) finDemarrage('maquette-h'); }, [M]);
  if (M === undefined) return <div className="h-racine h-attente" />;
  if (M === null || !M.postes) return <div className="h-racine"><div className="h-vide">— · base pas lue</div></div>;
  const P = M.postes;
  const poste = POSTES.find((p) => p.cle === route.poste) || POSTES[3];
  const rail = railDe(poste.cle, P);
  const Ecran = ECRAN[poste.cle];
  const geste = gesteDe(poste.cle, P);
  const choisirPoste = (cle) => aller({ poste: cle });
  const Plein = geste ? <button type="button" className="h-plein" data-plein=""><Ico n={poste.cle === 'poster' ? 'imprimante' : ICONE_POSTE[poste.cle]} t={20} /><span>{geste.mot} {nb(geste.n)}</span></button> : null;
  const aFaire = (cle) => P[cle].nAFaire;
  return (
    <div className={'h-racine' + (large ? ' is-large' : '')} data-poste={poste.cle}>
      {large ? (
        <aside className="h-cote">
          <div className="h-marque">VRM<span className="h-marque-sous">L’atelier</span></div>
          <button type="button" className="h-champ h-champ--cote" onClick={() => aller({ ...route, scan: '' })}><Ico n="scan" t={20} /><span>Scanner un code</span><kbd>/</kbd></button>
          <nav className="h-postes-cote">
            {POSTES.map((p, i) => (
              <button key={p.cle} type="button" className="h-poste-cote" aria-current={p.cle === poste.cle ? 'page' : undefined} onClick={() => choisirPoste(p.cle)} data-poste-nav={p.cle}>
                <span className="h-poste-i">{i + 1}</span><Ico n={ICONE_POSTE[p.cle]} t={20} /><span className="h-poste-nom">{p.nom}</span>
                {aFaire(p.cle) ? <span className="h-poste-n" aria-label={`${aFaire(p.cle)} à faire`}><span className="h-point" /></span> : null}
              </button>
            ))}
          </nav>
          <div className="h-cote-pied"><button type="button" className="h-poste-cote"><Ico n="profil" t={20} /><span className="h-poste-nom">Réglages</span></button></div>
        </aside>
      ) : null}
      <main className="h-main">
        <header className="h-tete">
          <div className="h-tete-l">
            <h1 className="h-titre">{poste.nom}</h1>
            <button type="button" className="h-rond-aide" aria-label="Comment marche ce poste"><Ico n="aide" t={20} /></button>
            {large ? <span className="h-tete-geste">{Plein}</span> : null}
          </div>
          <Rail items={rail} sansNombre={geste ? geste.rail : ''} actif={route.rail || 'faire'} choisir={(c) => aller({ poste: poste.cle, rail: c })} />
        </header>
        <div className="h-corps"><Ecran M={M} P={P} large={large} rail={route.rail || 'faire'} /></div>
      </main>
      {!large ? (
        <div className="h-bas">
          <div className="h-plateau" data-plateau="">
            <label className="h-champ h-champ--plateau"><Ico n="loupe" t={18} /><input placeholder="Chercher" aria-label={`Chercher dans ${poste.nom}`} /></label>
            {Plein}
          </div>
          <nav className="h-barre" aria-label="Postes">
            {POSTES.slice(0, 2).map((p) => <Onglet key={p.cle} p={p} actif={p.cle === poste.cle} n={aFaire(p.cle)} choisir={choisirPoste} />)}
            <button type="button" className="h-disque" aria-label="Scanner un code" onClick={() => aller({ ...route, scan: '' })} data-scanner=""><Ico n="scan" t={26} /></button>
            {POSTES.slice(2).map((p) => <Onglet key={p.cle} p={p} actif={p.cle === poste.cle} n={aFaire(p.cle)} choisir={choisirPoste} />)}
          </nav>
        </div>
      ) : null}
      {route.scan != null ? <Scanner M={M} code={route.scan} fermer={() => aller({ poste: poste.cle, rail: route.rail })} aller={(c) => aller({ poste: c })} /> : null}
    </div>
  );
}
const Onglet = ({ p, actif, n, choisir }) => (
  <button type="button" className="h-onglet" aria-current={actif ? 'page' : undefined} onClick={() => choisir(p.cle)} data-poste-nav={p.cle}>
    <span className="h-onglet-i"><Ico n={ICONE_POSTE[p.cle]} t={23} />{n ? <span className="h-onglet-n" aria-label={`${n} à faire`} /> : null}</span>
    <span className="h-onglet-mot">{p.court}</span>
  </button>
);
