// ════════════════════════════════════════════════════════════════════════════
//  MAQUETTE M — « UNE MAIN » (17 nov.) — un PROTOTYPE à montrer, pas livré.
//  Monté seulement si `localStorage.vrm_banc_maquette === 'm'` (posé par le banc
//  scripts/bancs/maquette-m.cjs ; aucun bouton de l'app ne le pose : invisible pour Julien).
//
//  L'idée : tout se fait au POUCE, d'une main, sur iPhone.
//    · le HAUT ne sert qu'à LIRE : le nom de l'écran et LE chiffre (rien à toucher, sauf « ? ») ;
//    · le TIERS BAS porte tout ce qu'on touche, dans un seul dock de verre : les filtres en pastilles,
//      la barre de recherche (en bas, comme Safari) avec LE geste de l'écran (le seul plein), les onglets ;
//    · une ligne se GLISSE vers la gauche pour son geste principal ; qui ne glisse pas la touche :
//      sa feuille monte du bas (deux crans) avec le même geste, en plein, sous le pouce ;
//    · lignes hautes et calmes : photo carrée 56, le N° en gros, le prix à droite, UN état.
//  Le dock se replie quand on descend la liste (comme la barre de Safari), revient quand on remonte.
//  Style Studio de C (fond bleu, porcelaine, plaque du N°). Textes en français seulement (prototype) :
//  à passer par tr() s'il est retenu.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { lireDonnees, lireQr, euros, jourCourt } from './donnees.js';
import { centimes } from '../../rechercheUnique.js';
import { finDemarrage } from '../../demarrage.js';
import '../../design/studio-polices.css';
import './une-main.css';

const J = 86400000;
const ECRANS = [
  { cle: 'journee', nom: 'Journée', ico: 'soleil' },
  { cle: 'annonces', nom: 'Annonces', ico: 'etiquette' },
  { cle: 'ventes', nom: 'Ventes', ico: 'colis' },
  { cle: 'achats', nom: 'Achats', ico: 'sac' },
  { cle: 'argent', nom: 'Argent', ico: 'euro' },
];

const lireRoute = () => { const p = new URLSearchParams((window.location.hash || '').replace(/^#/, '')); return { ecran: p.get('ecran') || 'journee', filtre: p.get('filtre') || '', fiche: p.get('fiche') || '', point: p.get('point') || '', glisse: p.get('glisse') || '', cran: p.get('cran') || '' }; };
const ecrireRoute = (r) => { const p = new URLSearchParams(); for (const k of ['ecran', 'filtre', 'fiche', 'point', 'cran']) if (r[k] != null && r[k] !== '') p.set(k, r[k]); window.location.hash = p.toString(); };
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
const debutJour = (t) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
const MOIS = (t) => new Date(t).toLocaleDateString('fr-FR', { month: 'long', timeZone: 'Europe/Paris' });

// ── Icônes (un trait, une graisse) ───────────────────────────────────────────
const D = {
  soleil: 'M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 1.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM11.25 2h1.5v3h-1.5zm0 17h1.5v3h-1.5zM2 11.25h3v1.5H2zm17 0h3v1.5h-3zM4.4 5.46l1.06-1.06 2.12 2.12-1.06 1.06zm12.02 12.02 1.06-1.06 2.12 2.12-1.06 1.06zM4.4 18.54l2.12-2.12 1.06 1.06-2.12 2.12zM16.42 6.52l2.12-2.12 1.06 1.06-2.12 2.12z',
  etiquette: 'M3.5 4.75c0-.69.56-1.25 1.25-1.25h6.6c.33 0 .65.13.88.37l8.4 8.4a1.25 1.25 0 0 1 0 1.77l-6.6 6.6a1.25 1.25 0 0 1-1.77 0l-8.4-8.4a1.25 1.25 0 0 1-.36-.88zM5 5v6.36l8.15 8.15 6.36-6.36L11.36 5zm3.25 1.75a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z',
  colis: 'M4 7.5 12 3.5l8 4v9L12 20.5l-8-4zm1.5 1.2v6.9l5.75 2.9v-6.9zm13 0-5.75 2.9v6.9l5.75-2.9zM6.2 7.6 12 10.5l5.8-2.9L12 4.8z',
  sac: 'M8 7V6a4 4 0 1 1 8 0v1h2.6c.5 0 .9.4 1 .9l1 12a1 1 0 0 1-1 1.1H4.4a1 1 0 0 1-1-1.1l1-12c.1-.5.5-.9 1-.9zm1.5 0h5V6a2.5 2.5 0 0 0-5 0zM5.8 8.5l-.9 11h14.2l-.9-11H16V11h-1.5V8.5h-5V11H8V8.5z',
  euro: 'M14.8 5c1.3 0 2.5.3 3.5.9l-.7 1.3a5.6 5.6 0 0 0-2.8-.7c-2.3 0-4.2 1.5-4.9 3.6H15v1.4H9.6l-.03.5.03.5H15v1.4H9.9c.7 2.1 2.6 3.6 4.9 3.6 1 0 2-.3 2.8-.7l.7 1.3c-1 .6-2.2.9-3.5.9-3.2 0-5.8-2.1-6.5-5.1H6v-1.4h2.1L8 12l.05-.5H6v-1.4h2.3C9 7.1 11.6 5 14.8 5z',
  loupe: 'M10.5 4a6.5 6.5 0 1 0 4.06 11.58l4.43 4.43 1.06-1.06-4.43-4.43A6.5 6.5 0 0 0 10.5 4zm0 1.5a5 5 0 1 1 0 10 5 5 0 0 1 0-10z',
  chevron: 'M9.3 5.3 8.2 6.4 13.8 12l-5.6 5.6 1.1 1.1L16 12z',
  bas: 'M6.4 8.7 5.3 9.8 12 16.5l6.7-6.7-1.1-1.1L12 14.3z',
  imprimante: 'M7 3.5h10V8h2.5A1.5 1.5 0 0 1 21 9.5v7a1.5 1.5 0 0 1-1.5 1.5H17v2.5H7V18H4.5A1.5 1.5 0 0 1 3 16.5v-7A1.5 1.5 0 0 1 4.5 8H7zM8.5 5v3h7V5zM4.5 9.5v7H7v-3h10v3h2.5v-7zm4 5.5v4h7v-4z',
  aide: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zm0 1.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15zm-.1 10.6a1 1 0 1 1 0 2 1 1 0 0 1 0-2zM12 7c1.8 0 3.1 1.1 3.1 2.6 0 1.2-.7 1.9-1.6 2.5-.6.4-.8.7-.8 1.3v.3h-1.5v-.4c0-1 .4-1.6 1.3-2.2.7-.5 1.1-.8 1.1-1.5 0-.7-.7-1.2-1.6-1.2-.9 0-1.6.5-1.7 1.4H8.8C8.9 8.2 10.2 7 12 7z',
  qr: 'M3.5 3.5h7v7h-7zM5 5v4h4V5zm8.5-1.5h7v7h-7zM15 5v4h4V5zM3.5 13.5h7v7h-7zM5 15v4h4v-4zm8.5-1.5H16V16h-2.5zm4 0h3V16h-3zM16 16h1.5v2H16zm-2.5 2H16v2.5h-2.5zm4 0h3v2.5h-3z',
  republier: 'M12 4.5a7.5 7.5 0 0 1 7.3 5.8h-1.6A6 6 0 0 0 7.1 8.5H10V10H4.5V4.5H6v2.8A7.5 7.5 0 0 1 12 4.5zm-7.3 9.2h1.6a6 6 0 0 0 10.6 1.8H14V14h5.5v5.5H18v-2.8a7.5 7.5 0 0 1-13.3-3z',
  crayon: 'M15.9 3.6a1.5 1.5 0 0 1 2.1 0l2.4 2.4a1.5 1.5 0 0 1 0 2.1L9.2 19.3 4 20l.7-5.2zm-9.8 12-.3 2.1 2.1-.3 8.6-8.6-1.8-1.8zm9.7-9.7 1.8 1.8 1.7-1.7-1.8-1.8z',
  case: 'M3.5 6.5h17v13h-17zM5 8v10h14V8zm-1.5-4h17v1.5h-17zM9 10.5h6V12H9z',
  coche: 'M9.5 15.6 5.4 11.5l-1.1 1.1 5.2 5.2L19.7 7.6l-1.1-1.1z',
};
const Ico = ({ n, t = 22 }) => <svg className="m-ico" width={t} height={t} viewBox="0 0 24 24" aria-hidden="true"><path d={D[n]} fill="currentColor" /></svg>;

const Photo = ({ src, t = 56 }) => (
  <span className="m-photo" style={{ width: t, height: t }}>{src ? <img src={src} alt="" loading="lazy" decoding="async" width={t} height={t} /> : null}</span>
);
// Une PILE de photos décalées (la paire est la matière) pour une ligne qui en regroupe plusieurs.
const Pile = ({ photos }) => (
  <span className="m-pile" aria-hidden="true">{photos.slice(0, 3).reverse().map((s, i, a) => <span key={i} className="m-pile-p" style={{ '--i': a.length - 1 - i }}>{s ? <img src={s} alt="" loading="lazy" decoding="async" /> : null}</span>)}</span>
);

// LA LIGNE : 72 px, photo carrée 56, le N° en gros, le titre dessous (deux lignes au plus, jamais coupé),
// le prix aligné à droite, UN état sous le prix. Elle se GLISSE vers la gauche (geste principal) et se
// TOUCHE (sa feuille). Aucun bouton dedans : l'action révélée appartient au glissement.
function Ligne({ visuel, numero, titre, mot, sous, valeur, etat, ambre, geste, onOuvrir, onGeste, ouverte, cle }) {
  const ref = React.useRef(null);
  const g = React.useRef(null);
  const [x, setX] = React.useState(ouverte ? -96 : 0);
  const [libre, setLibre] = React.useState(true);
  const down = (e) => { if (!geste) return; g.current = { x0: e.clientX, y0: e.clientY, base: x, axe: null, t: [{ x: e.clientX, t: e.timeStamp }] }; };
  const move = (e) => {
    const s = g.current; if (!s) return;
    const dx = e.clientX - s.x0, dy = e.clientY - s.y0;
    if (!s.axe) { if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return; s.axe = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'; if (s.axe === 'x') { ref.current.setPointerCapture(e.pointerId); setLibre(false); } }
    if (s.axe !== 'x') return;
    let v = s.base + dx; if (v > 0) v = v * 0.25;           // au-delà du bord : ça résiste (élastique), ça ne s'arrête pas net
    s.t.push({ x: e.clientX, t: e.timeStamp }); if (s.t.length > 5) s.t.shift();
    setX(v);
  };
  const up = () => {
    const s = g.current; g.current = null; if (!s || s.axe !== 'x') return;
    const a = s.t[0], b = s.t[s.t.length - 1]; const vit = (b.x - a.x) / Math.max(1, b.t - a.t);   // px/ms
    setLibre(true);
    if (x < -220 || vit < -1.2) { setX(0); onGeste && onGeste(); return; }   // glissé jusqu'au bout : le geste part
    setX(x < -48 || vit < -0.3 ? -96 : 0);                                    // sinon : l'action reste révélée, ou se referme
  };
  const clic = () => { if (x !== 0) { setX(0); return; } onOuvrir && onOuvrir(); };
  return (
    <li className="m-ligne-cadre" data-ligne={cle}>
      {geste ? <button type="button" className="m-ligne-geste" tabIndex={x ? 0 : -1} onClick={() => { setX(0); onGeste && onGeste(); }} aria-hidden={x ? undefined : 'true'}><Ico n={geste.ico} t={22} /><span>{geste.mot}</span></button> : null}
      <button type="button" ref={ref} className={'m-ligne' + (libre ? ' is-libre' : '')} style={{ transform: x ? `translateX(${x}px)` : undefined }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onClick={clic}>
        {visuel}
        <span className="m-ligne-corps">
          {numero ? <span className="m-ligne-n"><span className="m-ligne-npre">N°</span>{numero}</span> : <span className="m-ligne-n m-ligne-n--mot">{mot || titre}</span>}
          {numero ? <span className="m-ligne-titre">{titre}</span> : sous ? <span className="m-ligne-titre">{sous}</span> : null}
        </span>
        <span className="m-ligne-droite">
          <span className="m-ligne-val">{valeur}</span>
          {etat ? <span className={'m-ligne-etat' + (ambre ? ' is-ambre' : '')}>{ambre ? <span className="m-point" /> : null}{etat}</span> : null}
        </span>
      </button>
    </li>
  );
}
const Groupe = ({ titre, n, children, cle }) => (
  <section className="m-groupe" data-groupe={cle}>
    {titre ? <h2 className="m-groupe-t"><span>{titre}</span>{n != null ? <span className="m-groupe-n">{nb(n)}</span> : null}</h2> : null}
    <ul className="m-liste">{children}</ul>
  </section>
);

// ── Ce que chaque écran lit, sur les identités du modèle (aucun titre ne relie rien) ────────────────
function lectures(M) {
  const P = M.postes; const now = M.maintenant;
  const ventesJour = M.ventes ? M.ventes.filter((v) => Date.parse(v.date) >= debutJour(now)) : null;
  const vendusJour = ventesJour ? ventesJour.reduce((t, v) => t + (centimes(v.price) || 0), 0) : null;
  const paireDe = (v) => (M.numParItem.has(v._item) ? M.paires.get(M.numParItem.get(v._item)) : null);
  const enRoute = M.ventes ? M.ventes.filter((v) => v.transaction_user_status !== 'needs_action' && !/finalis|annul|rembours/i.test(String(v.status))) : null;
  const payees = M.ventes ? M.ventes.filter((v) => /finalis/i.test(String(v.status))) : null;
  const vendues = [...M.paires.values()].filter((p) => p.vente);
  const avecMarge = vendues.filter((p) => p.marge != null);
  const benefice = avecMarge.length ? avecMarge.reduce((t, p) => t + p.marge, 0) : null;
  return { P, ventesJour, vendusJour, paireDe, enRoute, payees, vendues, avecMarge, benefice };
}

// L'état d'un colis à envoyer : la date LUE dans l'e-mail du bordereau, sinon une ESTIMATION (vente + 7 j, un plancher) —
// jamais « en retard » sur une estimation (§5 Colis).
function etatEnvoi(l, now) {
  if (l.limite) { const h = (l.limite - now) / 3600e3; return { txt: `${jourCourt(new Date(l.limite).toISOString(), now)} ${heure(l.limite)}`, ambre: h < 36 }; }
  if (l.estimee) return { txt: `vers ${jourCourt(new Date(l.estimee).toISOString(), now)}`, ambre: false };
  return { txt: '—', ambre: false };
}

// ══ LES ÉCRANS ══════════════════════════════════════════════════════════════
// Chacun rend : la tête (à LIRE), les pastilles, le geste plein, la liste.
function ecranJournee(M, L, route, aller) {
  const { P } = L; const now = M.maintenant;
  const imp = P.poster.aImprimer || [];
  const points = P.recevoir.points || [];
  const premierPoint = points[0];
  const taches = [
    points.length ? { cle: 'retirer', mot: `Retirer ${nb(P.recevoir.aRetirer.length)} colis`, sous: points.length > 1 ? `${points.length} points · ${premierPoint.nom} d’abord` : premierPoint.nom, photos: [], ico: 'sac', etat: premierPoint.limite < 9e15 ? `avant ${jourCourt(new Date(premierPoint.limite).toISOString(), now)}` : '', ambre: true, aller: { ecran: 'achats' } } : null,
    P.ranger.sansCase.length ? { cle: 'ranger', mot: `Ranger ${nb(P.ranger.sansCase.length)} paires`, sous: 'numérotées, sans case notée', photos: P.ranger.sansCase.map((p) => p.photo), etat: '', aller: { ecran: 'annonces' } } : null,
    P.publier.aPublier.length ? { cle: 'publier', mot: `Publier ${nb(P.publier.aPublier.length)} paires`, sous: 'rangées, en ligne nulle part', photos: P.publier.aPublier.map((p) => p.photo), etat: '', aller: { ecran: 'annonces' } } : null,
    P.encaisser.sansCout.length ? { cle: 'prix', mot: `Saisir ${nb(P.encaisser.sansCout.length)} prix d’achat`, sous: 'paires vendues sans coût', photos: P.encaisser.sansCout.map((p) => p.photo), etat: '', aller: { ecran: 'argent' } } : null,
  ].filter(Boolean);
  const attente = P.poster.sansBord ? P.poster.sansBord.length : 0;
  return {
    sur: new Date(now).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' }),
    chiffre: L.vendusJour == null ? '—' : euros(L.vendusJour), legende: L.ventesJour ? `vendu aujourd’hui · ${nb(L.ventesJour.length)} ventes` : 'ventes pas lues',
    pastilles: [{ cle: '', mot: 'À faire' }, { cle: 'vendu', mot: 'Vendu aujourd’hui', n: L.ventesJour && L.ventesJour.length }, { cle: 'attente', mot: 'En attente', n: attente }],
    plein: imp.length ? { mot: `Imprimer ${nb(imp.length)}`, ico: 'imprimante' } : null,
    corps: route.filtre === 'vendu' ? (
      <Groupe cle="vendu">{(L.ventesJour || []).map((v) => { const p = L.paireDe(v); return <Ligne key={v._tx} cle={v._tx} visuel={<Photo src={(p && p.photo) || (v.photo && v.photo.url)} />} numero={p && p.numero} titre={v.title} valeur={euros(centimes(v.price))} etat={heure(Date.parse(v.date))} onOuvrir={() => p && aller({ ...route, fiche: p.numero })} />; })}</Groupe>
    ) : (
      <>
        <Groupe cle="faire">
          {taches.map((t) => <Ligne key={t.cle} cle={t.cle} visuel={t.photos.length ? <Pile photos={t.photos} /> : <span className="m-tuile-ico"><Ico n={t.ico} t={26} /></span>} mot={t.mot} sous={t.sous} valeur={t.etat ? null : <Ico n="chevron" t={18} />} etat={t.etat} ambre={t.ambre} onOuvrir={() => aller(t.aller)} />)}
        </Groupe>
        {L.ventesJour && L.ventesJour.length ? (
          <Groupe titre="Vendu aujourd’hui" cle="vendu-jour">{L.ventesJour.slice(0, 6).map((v) => { const p = L.paireDe(v); return <Ligne key={v._tx} cle={v._tx} visuel={<Photo src={(p && p.photo) || (v.photo && v.photo.url)} />} numero={p && p.numero} titre={v.title} valeur={euros(centimes(v.price))} etat={heure(Date.parse(v.date))} onOuvrir={() => p && aller({ ...route, fiche: p.numero })} />; })}</Groupe>
        ) : null}
      </>
    ),
  };
}

function ecranVentes(M, L, route, aller) {
  const now = M.maintenant; const env = M.listes.envoyer.lignes;
  const imp = L.P.poster.aImprimer || [];
  const f = route.filtre;
  let corps;
  if (f === 'route' || f === 'payees') {
    const l = (f === 'route' ? L.enRoute : L.payees) || [];
    corps = <Groupe cle={f}>{l.slice(0, 120).map((v) => { const p = L.paireDe(v); return <Ligne key={v._tx} cle={v._tx} visuel={<Photo src={(p && p.photo) || (v.photo && v.photo.url)} />} numero={p && p.numero} titre={v.title} valeur={euros(centimes(v.price))} etat={jourCourt(v.date, now)} onOuvrir={() => p && aller({ ...route, fiche: p.numero })} />; })}</Groupe>;
  } else {
    // À envoyer, rangé par la date limite LUE ; les dates seulement estimées à la fin, dites « vers ».
    const groupes = new Map();
    const parLimite = [...(env || []).filter((l) => l.limite), ...(env || []).filter((l) => !l.limite)];
    for (const l of parLimite) { const k = l.limite ? jourCourt(new Date(l.limite).toISOString(), now) : 'sans bordereau'; if (!groupes.has(k)) groupes.set(k, []); groupes.get(k).push(l); }
    corps = [...groupes.entries()].map(([k, ls]) => (
      <Groupe key={k} cle={k} titre={k === 'sans bordereau' ? 'Bordereau pas encore reçu' : `À poster ${k}`} n={ls.length}>
        {ls.map((l, i) => { const e = etatEnvoi(l, now); const p = l.paire; return (
          <Ligne key={l.cle} cle={l.cle} ouverte={route.glisse === '1' && i === 1 && k !== 'sans bordereau' && groupes.keys().next().value === k} visuel={<Photo src={(p && p.photo) || (l.v.photo && l.v.photo.url)} />} numero={p && p.numero} titre={l.v.title}
            valeur={euros(centimes(l.v.price))} etat={l.limite ? heure(l.limite) : `vendue ${jourCourt(l.v.date, now)}`} ambre={l.limite ? e.ambre : false}
            geste={l.bord ? { mot: 'Imprimer', ico: 'imprimante' } : null} onOuvrir={() => p && aller({ ...route, fiche: p.numero })} />); })}
      </Groupe>
    ));
  }
  return {
    sur: 'Ventes', chiffre: nb(env && env.length), legende: 'à envoyer',
    pastilles: [{ cle: '', mot: 'À envoyer' }, { cle: 'route', mot: 'En route', n: L.enRoute && L.enRoute.length }, { cle: 'payees', mot: 'Payées', n: L.payees && L.payees.length }],
    plein: imp.length ? { mot: `Imprimer ${nb(imp.length)}`, ico: 'imprimante' } : null, corps,
  };
}

function ecranAnnonces(M, L, route, aller) {
  const now = M.maintenant; const P = L.P.publier;
  const f = route.filtre;
  const base = (f === 'dorment' ? P.dorment : f === 'sansnum' ? P.sansNumero : P.enLigne) || [];
  const tri = [...base].sort((a, b) => (Date.parse(b.cree) || 0) - (Date.parse(a.cree) || 0));
  const jours = (a) => (a.cree ? Math.max(0, Math.floor((now - Date.parse(a.cree)) / J)) : null);
  return {
    sur: 'Annonces', chiffre: nb(P.enLigne && P.enLigne.length), legende: 'en ligne · 3 comptes',
    pastilles: [{ cle: '', mot: 'En ligne' }, { cle: 'dorment', mot: 'Qui dorment', n: P.dorment && P.dorment.length }, { cle: 'sansnum', mot: 'Sans N°', n: P.sansNumero && P.sansNumero.length }],
    plein: P.aPublier.length ? { mot: `Publier ${nb(P.aPublier.length)}`, ico: 'etiquette' } : null,
    corps: (
      <Groupe cle="annonces">{tri.slice(0, 160).map((a, i) => { const k = M.numParItem.get(a.id); const p = k ? M.paires.get(k) : null; const j = jours(a); return (
        <Ligne key={a.id} cle={a.id} ouverte={route.glisse === '1' && i === 1} visuel={<Photo src={a.photo} />} numero={p && p.numero} titre={a.title} valeur={euros(centimes(a.price))}
          etat={j == null ? '' : j === 0 ? 'aujourd’hui' : `${j} j`} ambre={j != null && j > 60} geste={{ mot: 'Republier', ico: 'republier' }} onOuvrir={() => p && aller({ ...route, fiche: p.numero })} />); })}</Groupe>
    ),
  };
}

function ecranAchats(M, L, route, aller) {
  const now = M.maintenant; const R = L.P.recevoir;
  const f = route.filtre;
  let corps;
  if (f === 'route') {
    corps = <Groupe cle="route">{(R.enRoute || []).slice(0, 120).map((a) => <Ligne key={a._tx} cle={a._tx} visuel={<Photo src={a.photo && a.photo.url} />} numero={null} titre={a.title} valeur={euros(centimes(a.price))} etat={jourCourt(a.date, now)} />)}</Groupe>;
  } else if (f === 'arrives') {
    corps = <Groupe cle="arrives">{(R.arrives || []).map((a) => <Ligne key={a._tx} cle={a._tx} visuel={<Photo src={a.photo && a.photo.url} />} numero={null} titre={a.title} valeur={euros(centimes(a.price))} etat="à numéroter" ambre />)}</Groupe>;
  } else {
    // UN POINT = UNE CARTE (§5) : le lieu en tête, ses codes dessous, en gros. Toucher ⇒ la feuille du code.
    corps = (R.points || []).map((pt) => (
      <section key={pt.nom} className="m-groupe m-lieu" data-groupe={pt.nom}>
        <h2 className="m-lieu-t"><span className="m-lieu-nom">{pt.nom}</span>{pt.limite < 9e15 ? <span className="m-ligne-etat is-ambre"><span className="m-point" />avant {jourCourt(new Date(pt.limite).toISOString(), now)}</span> : null}</h2>
        <p className="m-lieu-adr">{pt.adresse}</p>
        <ul className="m-liste">
          {pt.colis.map((c) => <Ligne key={c.id} cle={c.id} visuel={<span className="m-tuile-ico">{c.qr ? <Ico n="qr" t={26} /> : <Ico n="sac" t={24} />}</span>}
            mot={<span className="m-code">{c.code || '—'}</span>} sous={c.art} valeur={<Ico n="chevron" t={18} />} onOuvrir={() => aller({ ...route, point: c.id })} />)}
        </ul>
      </section>
    ));
  }
  return {
    sur: 'Achats', chiffre: nb(R.aRetirer && R.aRetirer.length), legende: R.points ? `à retirer · ${R.points.length} points relais` : 'à retirer',
    pastilles: [{ cle: '', mot: 'À retirer' }, { cle: 'route', mot: 'En route', n: R.enRoute && R.enRoute.length }, { cle: 'arrives', mot: 'Arrivés', n: R.arrives && R.arrives.length }],
    plein: R.aRetirer && R.aRetirer.length ? { mot: 'Codes', ico: 'qr', faire: () => aller({ ...route, point: R.points[0].colis[0].id }) } : null, corps,
  };
}

function ecranArgent(M, L, route, aller) {
  const now = M.maintenant; const E = L.P.encaisser;
  const ceMois = E.ceMois || [];
  return {
    sur: 'Argent', chiffre: E.recuMois == null ? '—' : euros(E.recuMois), legende: `reçu en ${MOIS(now)} · ${nb(ceMois.length)} versements`,
    pastilles: [{ cle: '', mot: MOIS(now).replace(/^./, (c) => c.toUpperCase()) }, { cle: 'octobre', mot: 'Octobre' }, { cle: 'annee', mot: '2026' }],
    plein: E.sansCout.length ? { mot: `Saisir ${nb(E.sansCout.length)} prix`, ico: 'crayon' } : null,
    corps: (
      <>
        <Groupe cle="soldes">
          <Ligne cle="dispo" visuel={<span className="m-tuile-ico"><Ico n="euro" t={24} /></span>} mot="Disponible" sous={E.solde ? `sur Vinted · ${E.solde.n} comptes` : 'pas lu'} valeur={E.solde ? euros(E.solde.dispo) : '—'} />
          <Ligne cle="attente" visuel={<span className="m-tuile-ico"><Ico n="colis" t={24} /></span>} mot="En attente" sous="ventes pas encore confirmées" valeur={E.solde ? euros(E.solde.attente) : '—'} />
          <Ligne cle="benefice" visuel={<span className="m-tuile-ico"><Ico n="etiquette" t={24} /></span>} mot="Bénéfice" sous={`au moins · ${nb(L.avecMarge.length)} ventes sur ${nb(L.vendues.length)}`} valeur={L.benefice == null ? '—' : euros(L.benefice)} />
          <Ligne cle="urssaf" visuel={<span className="m-tuile-ico"><Ico n="case" t={24} /></span>} mot="URSSAF" sous="ce mois" valeur="—" etat="régime à choisir" ambre />
        </Groupe>
        <Groupe titre={`Versements de ${MOIS(now)}`} n={null} cle="versements">
          {ceMois.slice(0, 40).map((x) => <Ligne key={x.v._tx} cle={x.v._tx} visuel={<Photo src={(x.paire && x.paire.photo) || (x.v.photo && x.v.photo.url)} />} numero={x.paire && x.paire.numero} titre={x.v.title} valeur={euros(centimes(x.v.price))} etat={jourCourt(x.le, now)} onOuvrir={() => x.paire && aller({ ...route, fiche: x.paire.numero })} />)}
        </Groupe>
      </>
    ),
  };
}
const ECRAN = { journee: ecranJournee, ventes: ecranVentes, annonces: ecranAnnonces, achats: ecranAchats, argent: ecranArgent };

// ══ LA FEUILLE : monte du bas, deux crans (moyen ⇄ grand), se tire par la poignée ══════════════════
function Feuille({ cran: cranInitial, fermer, children, pied, etiquette, cle }) {
  const [cran, setCran] = React.useState(cranInitial === 'grand' ? 'grand' : 'moyen');
  const [dy, setDy] = React.useState(0);
  const g = React.useRef(null);
  React.useEffect(() => { const f = (e) => { if (e.key === 'Escape') fermer(); }; window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f); }, [fermer]);
  const down = (e) => { g.current = { y0: e.clientY, t0: e.timeStamp }; e.currentTarget.setPointerCapture(e.pointerId); };
  const move = (e) => { if (!g.current) return; const d = e.clientY - g.current.y0; setDy(d < 0 && cran === 'grand' ? d * 0.2 : d); };
  const up = (e) => {
    const s = g.current; g.current = null; if (!s) return;
    const d = e.clientY - s.y0; const v = d / Math.max(1, e.timeStamp - s.t0);
    setDy(0);
    if (d < -60 || v < -0.5) setCran('grand');
    else if (d > 120 || v > 0.6) { if (cran === 'grand') setCran('moyen'); else fermer(); }
  };
  return (
    <div className="m-voile" onClick={fermer} data-feuille={cle}>
      <div role="dialog" aria-modal="true" aria-label={etiquette} className={'m-feuille is-' + cran + (dy ? '' : ' is-libre')} style={dy ? { transform: `translateY(${Math.max(dy, -40)}px)` } : undefined} onClick={(e) => e.stopPropagation()}>
        <div className="m-poignee" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}><span /></div>
        <div className="m-feuille-corps">{children}</div>
        {pied ? <div className="m-feuille-pied">{pied}</div> : null}
      </div>
    </div>
  );
}

function FichePaire({ p, now }) {
  const etapes = p.vie.filter((e) => e.etat !== 'avenir' || e.cle === 'vente');
  return (
    <>
      <div className="m-fiche-tete">
        <Photo src={p.photo} t={88} />
        <div className="m-fiche-id">
          <div className="m-fiche-n"><span className="m-ligne-npre">N°</span>{p.numero}</div>
          <div className="m-fiche-titre">{p.titre}</div>
        </div>
      </div>
      <dl className="m-trio">
        <div><dt>Vendue</dt><dd>{euros(p.prixVente != null ? p.prixVente : p.prixAnnonce)}</dd></div>
        <div><dt>Coût</dt><dd>{euros(p.cout)}</dd></div>
        <div><dt>Marge</dt><dd>{p.marge == null ? '—' : euros(p.marge, { signe: true })}</dd></div>
      </dl>
      <ol className="m-vie">
        {etapes.map((e) => (
          <li key={e.cle} className={'m-vie-e is-' + e.etat}>
            <span className="m-vie-pastille">{e.etat === 'fait' ? <Ico n="coche" t={14} /> : null}</span>
            <span className="m-vie-t">{e.titre}</span>
            <span className={'m-vie-d' + (e.etat === 'geste' ? ' is-ambre' : '')}>{e.date ? `${jourCourt(e.date, now)}${e.etat === 'geste' ? ' ' + heure(Date.parse(e.date)) : ''}` : e.valeur != null ? euros(e.valeur) : '—'}</span>
          </li>
        ))}
      </ol>
    </>
  );
}

function FicheRetrait({ c, pt, now }) {
  const [qr, setQr] = React.useState(c.qr ? undefined : null);
  React.useEffect(() => { let vif = true; if (c.qr) lireQr(c.id).then((s) => vif && setQr(s)); return () => { vif = false; }; }, [c.id, c.qr]);
  return (
    <div className="m-retrait">
      <div className="m-retrait-lieu">{pt ? pt.nom : ''}</div>
      <div className="m-retrait-code" aria-label={`Code de retrait ${c.code}`}>{c.code || '—'}</div>
      <div className="m-retrait-art">{c.art}{c.limite ? ` · avant ${jourCourt(c.limite, now)}` : ''}</div>
      {qr ? <img className="m-retrait-qr" src={qr} alt={`QR de retrait ${c.code}`} width="196" height="196" /> : qr === undefined ? <span className="m-retrait-qr m-retrait-qr--attente" /> : null}
    </div>
  );
}

// ══ L'APP ══════════════════════════════════════════════════════════════════
export default function UneMain() {
  const [M, setM] = React.useState(undefined);
  const [route, aller] = useRoute();
  const large = useLarge();
  const [replie, setReplie] = React.useState(false);
  React.useEffect(() => {
    const d = document.documentElement; d.setAttribute('data-maquette', 'm');
    let sombre = null; try { const v = localStorage.getItem('vinted_dark'); if (v === 'true') sombre = true; else if (v === 'false') sombre = false; } catch (_) {}
    if (sombre == null) sombre = window.matchMedia('(prefers-color-scheme: dark)').matches;
    d.setAttribute('data-theme', sombre ? 'dark' : 'light');
  }, []);
  React.useEffect(() => { lireDonnees().then(setM, () => setM(null)); }, []);
  React.useEffect(() => { if (M !== undefined) finDemarrage('maquette-m'); }, [M]);
  // Le dock se replie quand on DESCEND la liste (Safari), revient dès qu'on remonte ou qu'on touche le bas.
  React.useEffect(() => {
    let y0 = window.scrollY;
    const f = () => { const y = window.scrollY; if (Math.abs(y - y0) < 12) return; setReplie(y > y0 && y > 140); y0 = y; };
    window.addEventListener('scroll', f, { passive: true }); return () => window.removeEventListener('scroll', f);
  }, []);
  React.useEffect(() => { setReplie(false); window.scrollTo(0, 0); }, [route.ecran, route.filtre]);
  const L = React.useMemo(() => (M && M.postes ? lectures(M) : null), [M]);
  if (M === undefined) return <div className="m-racine m-attente" />;
  if (M === null || !L) return <div className="m-racine"><p className="m-vide">— · base pas lue</p></div>;
  const ecran = ECRANS.find((e) => e.cle === route.ecran) || ECRANS[0];
  const V = ECRAN[ecran.cle](M, L, route, aller);
  const fiche = route.fiche ? M.paires.get(route.fiche) : null;
  const colis = route.point ? (M.colis || []).find((c) => c.id === route.point) : null;
  const ptDe = (c) => (L.P.recevoir.points || []).find((p) => p.colis.includes(c));
  const fermer = () => aller({ ecran: route.ecran, filtre: route.filtre });
  const choisir = (cle) => aller({ ecran: cle });

  const Plein = V.plein ? (
    <button type="button" className="m-plein" data-plein="" onClick={V.plein.faire}><Ico n={V.plein.ico} t={20} /><span>{V.plein.mot}</span></button>
  ) : null;
  const pastilles = (
    <div className="m-pastilles" role="tablist" aria-label="Filtres">
      {V.pastilles.map((p) => (
        <button key={p.cle || 'tout'} type="button" role="tab" className="m-pastille" aria-selected={(route.filtre || '') === p.cle} onClick={() => aller({ ecran: ecran.cle, filtre: p.cle })}>
          {(route.filtre || '') === p.cle ? <span className="m-diode" /> : null}<span>{p.mot}</span>{(route.filtre || '') !== p.cle && p.n != null ? <span className="m-pastille-n">{nb(p.n)}</span> : null}
        </button>
      ))}
      <button type="button" className="m-pastille m-pastille--compte"><span>Tous les comptes</span><Ico n="bas" t={16} /></button>
    </div>
  );
  const onglets = (
    <nav className="m-onglets" aria-label="Écrans">
      {ECRANS.map((e) => (
        <button key={e.cle} type="button" className="m-onglet" aria-current={e.cle === ecran.cle ? 'page' : undefined} onClick={() => choisir(e.cle)} data-onglet={e.cle}>
          <Ico n={e.ico} t={24} /><span>{e.nom}</span>
        </button>
      ))}
    </nav>
  );
  const recherche = (
    <label className="m-cherche"><Ico n="loupe" t={20} /><input type="search" enterKeyHint="search" placeholder="Chercher" aria-label={`Chercher dans ${ecran.nom}`} /></label>
  );

  return (
    <div className={'m-racine' + (large ? ' is-large' : '') + (replie ? ' is-replie' : '')} data-ecran={ecran.cle}>
      <header className="m-tete" data-zone="lire">
        <div className="m-tete-l">
          <span className="m-sur">{V.sur}</span>
          <button type="button" className="m-aide" aria-label={`Comment marche ${ecran.nom}`}><Ico n="aide" t={22} /></button>
        </div>
        <div className="m-affiche"><span className="m-chiffre">{V.chiffre}</span><span className="m-legende">{V.legende}</span></div>
      </header>
      <main className="m-plan" data-zone="liste">{V.corps}</main>
      <div className="m-dock" data-zone="pouce">
        {pastilles}
        <div className="m-dock-l">{recherche}{Plein}</div>
        {onglets}
      </div>
      {fiche ? (
        <Feuille cle="paire" cran={route.cran} fermer={fermer} etiquette={`N° ${fiche.numero}`}
          pied={fiche.ou === 'envoyer' && fiche.bord ? <button type="button" className="m-plein m-plein--large" data-plein=""><Ico n="imprimante" t={20} /><span>Imprimer le bordereau</span></button> : fiche.ou === 'ligne' ? <button type="button" className="m-plein m-plein--large" data-plein=""><Ico n="republier" t={20} /><span>Republier</span></button> : null}>
          <FichePaire p={fiche} now={M.maintenant} />
        </Feuille>
      ) : null}
      {colis ? (
        <Feuille cle="retrait" cran="grand" fermer={fermer} etiquette={`Code de retrait ${colis.code}`}
          pied={<button type="button" className="m-plein m-plein--large" data-plein=""><Ico n="coche" t={20} /><span>C’est retiré</span></button>}>
          <FicheRetrait c={colis} pt={ptDe(colis)} now={M.maintenant} />
        </Feuille>
      ) : null}
    </div>
  );
}
