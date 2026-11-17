// ════════════════════════════════════════════════════════════════════════════
//  MAQUETTE N — « ZÉRO À FAIRE » (17 nov.) — un PROTOTYPE à montrer, pas livré.
//  Monté seulement si `localStorage.vrm_banc_maquette === 'n'` (posé par le banc
//  scripts/bancs/maquette-n.cjs ; aucun bouton de l'app ne le pose : invisible pour Julien).
//
//  L'idée : l'accueil est une BOÎTE À VIDER (Superhuman, Linear Inbox, à l'échelle du pouce).
//  Chaque chose à faire aujourd'hui = UNE carte = UN geste ; la carte du dessus porte le seul
//  bouton plein ; une carte glissée vers la droite est faite. Quand il n'y a plus rien : « Rien à
//  faire » et le chiffre du jour. Commandes, Annonces, Argent deviennent des LISTES DE CONSULTATION :
//  aucune carte, des rangées fines (densité Linear) sur le fond bleu du Studio.
//  Quatre onglets : À faire · Commandes (ventes et achats) · Annonces · Argent.
//  Textes en français seulement (prototype) : à passer par tr() s'il est retenu.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { lireDonnees, euros, jourCourt } from './donnees.js';
import { boite, echeance, presse } from './boite.js';
import { finDemarrage } from '../../demarrage.js';
import { normaliser, centimes } from '../../rechercheUnique.js';
import '../../design/studio-polices.css';
import './boite.css';

const J = 86400000;
const nb = (n) => (n == null ? '—' : Number(n).toLocaleString('fr-FR'));
const str = (v) => String(v == null ? '' : v);
const photoDe = (p) => (!p ? '' : typeof p === 'string' ? p : str(p.url || ''));

const ONGLETS = [
  { cle: 'afaire', nom: 'À faire', ico: 'plateau' },
  { cle: 'commandes', nom: 'Commandes', ico: 'colis' },
  { cle: 'annonces', nom: 'Annonces', ico: 'etiquette' },
  { cle: 'argent', nom: 'Argent', ico: 'euro' },
];

const lireRoute = () => { const p = new URLSearchParams((window.location.hash || '').replace(/^#/, '')); return Object.fromEntries(p.entries()); };
function useRoute() {
  const [r, setR] = React.useState(lireRoute);
  React.useEffect(() => { const f = () => setR(lireRoute()); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  const aller = (x) => { const p = new URLSearchParams(); for (const [k, v] of Object.entries(x)) if (v != null && v !== '') p.set(k, v); window.location.hash = p.toString(); };
  return [r, aller];
}
function useLarge() {
  const mq = '(min-width: 1100px)';
  const [l, setL] = React.useState(() => window.matchMedia(mq).matches);
  React.useEffect(() => { const m = window.matchMedia(mq); const f = () => setL(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  return l;
}

// ── Icônes (un trait, une graisse) ─────────────────────────────────────────
const D = {
  plateau: 'M4.6 4h14.8l2.1 8.6V18a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2v-5.4zm1.2 1.5L4 12.4h4.6l1 2.1h4.8l1-2.1H20l-1.8-6.9zM4 13.9V18c0 .3.2.5.5.5h15c.3 0 .5-.2.5-.5v-4.1h-3.6l-1 2.1H8.6l-1-2.1z',
  plateauPlein: 'M4.6 4h14.8l2.1 8.6V18a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2v-5.4zm1.2 1.5L4 12.4h4.6l1 2.1h4.8l1-2.1H20l-1.8-6.9z',
  colis: 'M4 7.5 12 3.5l8 4v9L12 20.5l-8-4zm1.5 1.2v6.9l5.75 2.9v-6.9zm13 0-5.75 2.9v6.9l5.75-2.9zM6.2 7.6 12 10.5l5.8-2.9L12 4.8z',
  colisPlein: 'M4 7.5 12 3.5l8 4v9L12 20.5l-8-4zm2.2.1L12 10.5l5.8-2.9L12 4.8z',
  etiquette: 'M3.5 4.5a1 1 0 0 1 1-1h6.3l9.7 9.7-7.3 7.3-9.7-9.7zm1.5.5v5.2l8.2 8.2 5.2-5.2L10.2 5zM8 6.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z',
  etiquettePlein: 'M3.5 4.5a1 1 0 0 1 1-1h6.3l9.7 9.7-7.3 7.3-9.7-9.7zM8 6.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z',
  euro: 'M14.8 5c1.3 0 2.5.3 3.5.9l-.7 1.3a5.6 5.6 0 0 0-2.8-.7c-2.3 0-4.2 1.5-4.9 3.6H15v1.4H9.6l-.03.5.03.5H15v1.4H9.9c.7 2.1 2.6 3.6 4.9 3.6 1 0 2-.3 2.8-.7l.7 1.3c-1 .6-2.2.9-3.5.9-3.2 0-5.8-2.1-6.5-5.1H6v-1.4h2.1L8 12l.05-.5H6v-1.4h2.3C9 7.1 11.6 5 14.8 5z',
  loupe: 'M10.5 4a6.5 6.5 0 1 0 4.06 11.58l4.43 4.43 1.06-1.06-4.43-4.43A6.5 6.5 0 0 0 10.5 4zm0 1.5a5 5 0 1 1 0 10 5 5 0 0 1 0-10z',
  chevron: 'M9.3 5.3 8.2 6.4 13.8 12l-5.6 5.6 1.1 1.1L16 12z',
  croix: 'M6.4 5.3 5.3 6.4 10.9 12l-5.6 5.6 1.1 1.1 5.6-5.6 5.6 5.6 1.1-1.1-5.6-5.6 5.6-5.6-1.1-1.1-5.6 5.6z',
  coche: 'M9.5 16.2 5.3 12l-1.1 1.1 5.3 5.3L20 7.9l-1.1-1.1z',
  aide: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zm0 1.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15zm-.1 10.6a1 1 0 1 1 0 2 1 1 0 0 1 0-2zM12 7c1.8 0 3.1 1.1 3.1 2.6 0 1.2-.7 1.9-1.6 2.5-.6.4-.8.7-.8 1.3v.3h-1.5v-.4c0-1 .4-1.6 1.3-2.2.7-.5 1.1-.8 1.1-1.5 0-.7-.7-1.2-1.6-1.2-.9 0-1.6.5-1.7 1.4H8.8C8.9 8.2 10.2 7 12 7z',
};
const Ico = ({ n, t = 22 }) => <svg className="n-ico" width={t} height={t} viewBox="0 0 24 24" aria-hidden="true"><path d={D[n]} fill="currentColor" fillRule="evenodd" /></svg>;

const Plaque = ({ n }) => (n ? <span className="n-plaque" data-numero={n}><span className="n-plaque-n">N°</span>{n}</span> : null);
const Vignette = ({ src, t = 40 }) => (
  <span className="n-vignette" style={{ width: t, height: t }}>{src ? <img src={src} alt="" loading="lazy" decoding="async" width={t} height={t} /> : null}</span>
);
const Pile = ({ photos }) => (
  <span className="n-pile" style={{ width: 52 + (Math.max(1, photos.length) - 1) * 22 }}>
    {photos.map((p, i) => <span key={i} className="n-pile-v" style={{ left: i * 22, zIndex: 10 - i }}><img src={p} alt="" loading="lazy" decoding="async" width={52} height={52} /></span>)}
  </span>
);
// « N° 124, 309 et 13 autres » : on nomme ce qui tient, on compte le reste — rien n'est coupé.
const listeNumeros = (nums, max = 3) => {
  const n = nums.filter(Boolean);
  if (!n.length) return '';
  const vus = n.slice(0, max).join(', ');
  return 'N° ' + vus + (n.length > max ? ` et ${n.length - max} autre${n.length - max > 1 ? 's' : ''}` : '');
};

// ════════════════════════════════════════════════════════════════════════════
//  LA BOÎTE « À FAIRE »
// ════════════════════════════════════════════════════════════════════════════
// Une carte = un geste. La carte ENTIÈRE se touche (jamais un bouton dedans) ; glisser à droite = fait.
function Carte({ c, premier, ouvrir, faire, maintenant }) {
  const ref = React.useRef(null);
  const g = React.useRef(null);
  const fin = (e) => {
    const s = g.current; g.current = null; if (!s || !ref.current) return;
    const dx = e.clientX - s.x; const v = dx / Math.max(1, e.timeStamp - s.t);
    ref.current.style.transition = '';
    if (s.glisse && (dx > 120 || v > 0.6)) { ref.current.style.transform = 'translateX(110%)'; ref.current.style.opacity = '0'; setTimeout(() => faire(c.cle), 220); return; }
    ref.current.style.transform = '';
    if (!s.glisse) ouvrir(c.cle);
  };
  const lim = c.limite || (c.sorte === 'offre' ? c.echeance : null);
  const quand = c.sorte === 'prix' ? '' : c.sorte === 'offre' ? jourCourt(c.date, maintenant) : echeance(lim, { estimee: c.estimee }, maintenant);
  const urgent = c.sorte !== 'offre' && presse(lim, maintenant);
  const SORTE = { poster: 'À poster', retirer: 'À retirer', offre: 'Offre', prix: "Prix d'achat", doublon: 'Même N°' };
  return (
    <li className="n-carte-li" data-carte={c.sorte}>
      <div ref={ref} role="button" tabIndex={0} className={'n-carte' + (c.sorte === 'doublon' ? ' is-double' : '')} aria-label={`${c.titre} — ${c.geste}`}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ouvrir(c.cle); } }}
        onPointerDown={(e) => { g.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, glisse: false }; }}
        onPointerMove={(e) => { const s = g.current; if (!s || !ref.current) return; const dx = e.clientX - s.x; const dy = e.clientY - s.y;
          if (!s.glisse && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.4) { s.glisse = true; ref.current.setPointerCapture(e.pointerId); ref.current.style.transition = 'none'; }
          if (s.glisse) ref.current.style.transform = `translateX(${dx > 0 ? dx : dx / 4}px)`; }}
        onPointerUp={fin} onPointerCancel={() => { g.current = null; if (ref.current) ref.current.style.transform = ''; }}>
        <span className="n-carte-tete">
          <span className="n-carte-sorte">{SORTE[c.sorte]}</span>
          {quand ? <span className={'n-carte-quand' + (urgent ? ' is-ambre' : '')}>{urgent ? <span className="n-point" /> : null}{quand}</span> : null}
        </span>
        <CorpsCarte c={c} />
        <span className={'n-carte-geste' + (premier ? ' is-plein' : '')} {...(premier ? { 'data-plein': '' } : {})}>
          <span>{c.geste}</span>{premier ? null : <Ico n="chevron" t={18} />}
        </span>
      </div>
    </li>
  );
}

function CorpsCarte({ c }) {
  if (c.sorte === 'retirer') {
    return (
      <span className="n-carte-corps n-carte-corps--retirer">
        <span className="n-carte-titre">{c.titre}<span className="n-carte-titre-n">{c.n > 1 ? ` · ${c.n} colis` : ''}</span></span>
        <span className="n-codes">
          {c.colis.map((x) => (
            <span key={x.id} className="n-code">
              <span className="n-code-v" data-code={x.code}>{x.code || '—'}</span>
              <span className="n-code-art">{x.art}</span>
              {x.qr ? <span className="n-code-qr" title="QR du transporteur"><img src={x.qr} alt="" width={28} height={28} /></span> : null}
            </span>
          ))}
        </span>
      </span>
    );
  }
  if (c.sorte === 'offre') {
    const ecart = c.prix != null && c.montant != null ? c.montant - c.prix : null;
    return (
      <span className="n-carte-corps n-carte-corps--offre">
        <Vignette src={c.photo} t={56} />
        <span className="n-carte-textes">
          <span className="n-carte-titre"><span className="n-montant">{euros(c.montant)}</span>{c.pseudo ? <span className="n-carte-de"> de {c.pseudo}</span> : null}</span>
          <span className="n-carte-sous"><Plaque n={c.numero} />{c.prix != null ? <span>annonce {euros(c.prix)}{ecart != null && ecart < 0 ? ` · ${euros(ecart)}` : ''}</span> : null}</span>
        </span>
      </span>
    );
  }
  return (
    <span className="n-carte-corps">
      {c.photos && c.photos.length ? <Pile photos={c.photos} /> : null}
      <span className="n-carte-textes">
        <span className="n-carte-titre">{c.titre}</span>
        {c.numeros && c.numeros.length ? <span className="n-carte-sous">{c.n === 1 ? <Plaque n={c.numeros[0]} /> : listeNumeros(c.numeros)}</span> : null}
      </span>
    </span>
  );
}

// L'écran apaisé : plus rien à faire. Le chiffre du jour, vrai ou « — ».
function RienAFaire({ jour }) {
  return (
    <div className="n-rien" data-rien-a-faire="">
      <svg className="n-rien-dessin" viewBox="0 0 160 80" aria-hidden="true">
        <path d="M8 62c2-14 14-20 27-24l18-10c7-4 11-11 20-11 6 0 9 6 15 9 11 6 22 7 32 13 8 5 12 11 11 23H8z M8 62h123 M30 46l6 7 M42 40l6 7 M54 34l6 7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <h2 className="n-rien-titre">Rien à faire</h2>
      <div className="n-rien-chiffre">
        <span className="n-affiche" data-chiffre-jour="">{jour ? (jour.n ? euros(jour.total) : '0') : '—'}</span>
        <span className="n-rien-l">{jour == null ? 'ventes pas lues' : jour.n ? `vendus aujourd’hui · ${jour.n} paire${jour.n > 1 ? 's' : ''}` : 'vente aujourd’hui'}</span>
      </div>
    </div>
  );
}

function EcranAFaire({ B, faits, faire, ouvrir, maintenant, large }) {
  const reste = B.cartes.filter((c) => !faits.has(c.cle));
  const date = new Date(maintenant).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' });
  return (
    <>
      <header className="n-tete">
        <span className="n-tete-date">{date}</span>
        <h1 className="n-titre">À faire{reste.length ? <span className="n-titre-n">{reste.length}</span> : null}</h1>
        <button type="button" className="n-rond n-tete-profil" aria-label="Mon profil et les réglages"><span className="n-avatar">J</span></button>
      </header>
      {B.pasLu.length ? <p className="n-pas-lu">— · {B.pasLu.length === 1 ? 'une source pas lue' : `${B.pasLu.length} sources pas lues`} : la liste peut être incomplète</p> : null}
      {reste.length ? (
        <ol className="n-cartes">{reste.map((c, i) => <Carte key={c.cle} c={c} premier={i === 0} ouvrir={ouvrir} faire={faire} maintenant={maintenant} />)}</ol>
      ) : <RienAFaire jour={B.jour} />}
      {large && reste.length ? <aside className="n-aside"><RienAFaire jour={B.jour} /></aside> : null}
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  LES LISTES DE CONSULTATION (aucune carte : des rangées fines, comme Linear)
// ════════════════════════════════════════════════════════════════════════════
const Rangee = ({ photo, titre, sous, valeur, etat, ambre, attrs }) => (
  <button type="button" className="n-rangee" {...attrs}>
    <Vignette src={photo} />
    <span className="n-rangee-corps"><span className="n-rangee-titre">{titre}</span><span className="n-rangee-sous">{sous}</span></span>
    <span className="n-rangee-droite"><span className="n-rangee-val">{valeur}</span>{etat ? <span className={'n-rangee-etat' + (ambre ? ' is-ambre' : '')}>{etat}</span> : null}</span>
  </button>
);
// Groupes par jour, en-tête collant ; au-delà de 120 rangées, « et N de plus » (la recherche trouve tout).
function Liste({ lignes, rendre, cleJour, vide }) {
  if (lignes == null) return <p className="n-vide">— · pas lu</p>;
  if (!lignes.length) return <p className="n-vide">{vide}</p>;
  const MAX = 120; const vues = lignes.slice(0, MAX);
  const groupes = []; let cur = null;
  for (const l of vues) { const j = cleJour(l); if (!cur || cur.j !== j) { cur = { j, l: [] }; groupes.push(cur); } cur.l.push(l); }
  return (
    <div className="n-liste">
      {groupes.map((g) => (
        <section key={g.j} className="n-groupe">
          <h2 className="n-groupe-tete"><span>{g.j}</span><span className="n-groupe-n">{g.l.length}</span></h2>
          {g.l.map(rendre)}
        </section>
      ))}
      {lignes.length > MAX ? <p className="n-encore">et {nb(lignes.length - MAX)} de plus · cherche un N°, un titre, un pseudo</p> : null}
    </div>
  );
}
function Filtres({ items, actif, choisir }) {
  return (
    <nav className="n-filtres" aria-label="Filtrer">
      {items.map(([cle, nom, n]) => (
        <button key={cle} type="button" className="n-filtre" aria-pressed={actif === cle} onClick={() => choisir(cle)} data-filtre={cle}>{nom}{n != null ? <span className="n-filtre-n">{nb(n)}</span> : null}</button>
      ))}
    </nav>
  );
}
function TeteListe({ titres, actif, choisir, q, setQ, filtres, aide }) {
  return (
    <div className="n-tete-liste">
      <header className="n-tete n-tete--liste">
        {titres.length > 1 ? (
          <h1 className="n-titre n-titre-bascule">{titres.map(([cle, nom]) => (
            <button key={cle} type="button" className="n-titre-mot" aria-pressed={actif === cle} onClick={() => choisir(cle)} data-vue={cle}>{nom}</button>
          ))}</h1>
        ) : <h1 className="n-titre">{titres[0][1]}</h1>}
        <button type="button" className="n-rond n-tete-aide" aria-label={'Aide : ' + aide}><Ico n="aide" /></button>
      </header>
      <div className="n-collant">
        <label className="n-champ"><Ico n="loupe" t={18} /><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="N°, titre, pseudo, code" enterKeyHint="search" /></label>
        {filtres}
      </div>
    </div>
  );
}
const jourDe = (iso, maintenant) => { const s = jourCourt(iso, maintenant); return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Sans date'; };
const correspond = (q, ...champs) => { const n = normaliser(q); if (!n) return true; return normaliser(champs.filter(Boolean).join(' ')).includes(n); };

function EcranCommandes({ M, route, aller, maintenant }) {
  const vue = route.vue === 'achats' ? 'achats' : 'ventes';
  const [q, setQ] = React.useState('');
  const P = M.postes;
  const numDe = (v) => { const k = M.numParItem.get(v._item); return k ? M.paires.get(k).numero : null; };
  const etatVente = (v) => (str(v.transaction_user_status) === 'needs_action' ? ['à envoyer', true] : /finalis/i.test(str(v.status)) ? ['finie', false] : /annul|rembours/i.test(str(v.status)) ? ['annulée', false] : ['en route', false]);
  const filtre = route.filtre || 'toutes';
  if (vue === 'ventes') {
    const toutes = M.ventes ? [...M.ventes].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)) : null;
    const aEnvoyer = toutes ? toutes.filter((v) => etatVente(v)[1]) : null;
    const lignes = (filtre === 'envoyer' ? aEnvoyer : toutes);
    const vues = lignes ? lignes.filter((v) => correspond(q, v.title, numDe(v), M.loginDe(v._uid), v._tx)) : null;
    return (
      <>
        <TeteListe titres={[['ventes', 'Ventes'], ['achats', 'Achats']]} actif={vue} choisir={(v) => aller({ ecran: 'commandes', vue: v })} q={q} setQ={setQ} aide="Ventes"
          filtres={<Filtres items={[['toutes', 'Toutes'], ['envoyer', 'À envoyer', aEnvoyer ? aEnvoyer.length : null]]} actif={filtre} choisir={(f) => aller({ ecran: 'commandes', vue, filtre: f })} />} />
        <Liste lignes={vues} vide="Aucune vente" cleJour={(v) => jourDe(v.date, maintenant)} rendre={(v) => {
          const [etat, ambre] = etatVente(v); const n = numDe(v);
          return <Rangee key={v._tx} photo={photoDe(v.photo)} titre={v.title} sous={<>{n ? <Plaque n={n} /> : null}<span>{M.loginDe(v._uid)}</span></>} valeur={euros(centimes(v.price))} etat={etat} ambre={ambre} attrs={{ 'data-vente': v._tx }} />;
        }} />
      </>
    );
  }
  // ACHATS : d'abord ceux qui attendent au point relais (code lu dans l'e-mail du transporteur), puis tous.
  const achats = M.achats ? [...M.achats].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)) : null;
  const auPoint = P.recevoir.aRetirer;
  const vuesAchats = achats ? achats.filter((a) => correspond(q, a.title, M.loginDe(a._uid), a._tx)) : null;
  const etatAchat = (a) => (/finalis/i.test(str(a.status)) ? 'reçu' : /annul|rembours/i.test(str(a.status)) ? 'annulé' : 'en route');
  return (
    <>
      <TeteListe titres={[['ventes', 'Ventes'], ['achats', 'Achats']]} actif={vue} choisir={(v) => aller({ ecran: 'commandes', vue: v })} q={q} setQ={setQ} aide="Achats" filtres={null} />
      {auPoint && auPoint.length ? (
        <section className="n-groupe" data-au-point="">
          <h2 className="n-groupe-tete"><span>Au point relais</span><span className="n-groupe-n">{auPoint.length}</span></h2>
          {auPoint.filter((c) => correspond(q, c.art, c.code, c.lieu)).map((c) => (
            <button key={c.id} type="button" className="n-rangee n-rangee--code" onClick={() => aller({ ecran: 'commandes', vue: 'achats', feuille: 'retirer-' + c.lieu.split('\n')[0] })}>
              <span className="n-rangee-code" data-code={c.code}>{c.code}</span>
              <span className="n-rangee-corps"><span className="n-rangee-titre">{c.art}</span><span className="n-rangee-sous"><span>{c.lieu.split('\n')[0]}</span></span></span>
              <span className="n-rangee-droite"><span className="n-rangee-etat is-ambre">{echeance(Date.parse(c.limite), {}, maintenant)}</span></span>
            </button>
          ))}
        </section>
      ) : null}
      <Liste lignes={vuesAchats} vide="Aucun achat" cleJour={(a) => jourDe(a.date, maintenant)} rendre={(a) => (
        <Rangee key={a._tx} photo={photoDe(a.photo)} titre={a.title} sous={<span>{M.loginDe(a._uid)}</span>} valeur={euros(centimes(a.price))} etat={etatAchat(a)} attrs={{ 'data-achat': a._tx }} />
      )} />
    </>
  );
}

function EcranAnnonces({ M, route, aller, maintenant }) {
  const [q, setQ] = React.useState('');
  const P = M.postes;
  const filtre = route.filtre || 'enligne';
  const base = filtre === 'dorment' ? P.publier.dorment : filtre === 'sansnum' ? P.publier.sansNumero : P.publier.enLigne;
  const numDe = (a) => { const k = M.numParItem.get(a.id); return k ? M.paires.get(k).numero : null; };
  const lignes = base ? [...base].sort((a, b) => (Date.parse(b.cree) || 0) - (Date.parse(a.cree) || 0)).filter((a) => correspond(q, a.title, numDe(a), M.loginDe(a.uid))) : null;
  const age = (a) => { const t = Date.parse(a.cree); return t ? Math.max(0, Math.floor((maintenant - t) / J)) : null; };
  const tranche = (a) => { const j = age(a); return j == null ? 'Sans date' : j < 7 ? 'Cette semaine' : j < 30 ? 'Ce mois-ci' : j < 60 ? 'Depuis plus d’un mois' : 'Depuis plus de deux mois'; };
  return (
    <>
      <TeteListe titres={[['a', 'Annonces']]} q={q} setQ={setQ} aide="Annonces"
        filtres={<Filtres items={[['enligne', 'En ligne', P.publier.enLigne ? P.publier.enLigne.length : null], ['dorment', 'Qui dorment', P.publier.dorment ? P.publier.dorment.length : null], ['sansnum', 'Sans N°', P.publier.sansNumero ? P.publier.sansNumero.length : null]]} actif={filtre} choisir={(f) => aller({ ecran: 'annonces', filtre: f })} />} />
      <Liste lignes={lignes} vide={filtre === 'sansnum' ? 'Toutes ont leur N°' : 'Aucune annonce'} cleJour={tranche} rendre={(a) => {
        const j = age(a);
        return <Rangee key={a.id} photo={a.photo} titre={a.title} sous={<>{numDe(a) ? <Plaque n={numDe(a)} /> : null}<span>{[j != null ? `${j} j` : null, a.fav ? `${a.fav} favori${a.fav > 1 ? 's' : ''}` : null].filter(Boolean).join(' · ')}</span></>} valeur={euros(centimes(a.price))} attrs={{ 'data-annonce': a.id }} />;
      }} />
    </>
  );
}

function EcranArgent({ M, maintenant }) {
  const [q, setQ] = React.useState('');
  const E = M.postes.encaisser;
  const mois = new Date(maintenant).toLocaleDateString('fr-FR', { month: 'long', timeZone: 'Europe/Paris' });
  const vues = E.versees ? E.versees.filter((x) => correspond(q, x.v.title, x.paire && x.paire.numero, x.v._tx)) : null;
  return (
    <>
      <TeteListe titres={[['a', 'Argent']]} q={q} setQ={setQ} aide="Argent" filtres={null} />
      <div className="n-argent">
        <div className="n-argent-affiche">
          <span className="n-affiche" data-recu-mois="">{E.recuMois == null ? '—' : euros(E.recuMois)}</span>
          <span className="n-argent-l">reçus en {mois}{E.ceMois ? ` · ${E.ceMois.length} versement${E.ceMois.length > 1 ? 's' : ''}` : ''}</span>
        </div>
        <dl className="n-argent-deux">
          <div><dt>Sur Vinted, disponible</dt><dd>{E.solde ? euros(E.solde.dispo) : '—'}</dd></div>
          <div><dt>En attente</dt><dd>{E.solde ? euros(E.solde.attente) : '—'}</dd></div>
        </dl>
      </div>
      <Liste lignes={vues} vide="Aucun versement lu" cleJour={(x) => jourDe(x.le, maintenant)} rendre={(x) => (
        <Rangee key={x.v._tx} photo={photoDe(x.v.photo)} titre={x.v.title} sous={<>{x.paire ? <Plaque n={x.paire.numero} /> : null}<span>{M.loginDe(x.v._uid)}</span></>} valeur={euros(centimes(x.v.price), { signe: true })} attrs={{ 'data-versement': x.v._tx }} />
      )} />
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  LA FEUILLE (le geste d'une carte) — au téléphone par le bas, à l'ordinateur sur le côté.
// ════════════════════════════════════════════════════════════════════════════
function Feuille({ c, fermer, faire, maintenant }) {
  React.useEffect(() => { const f = (e) => { if (e.key === 'Escape') fermer(); }; window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f); }, [fermer]);
  if (!c) return null;
  let corps = null; let plein = null;
  if (c.sorte === 'retirer') {
    corps = (
      <>
        <p className="n-feuille-sous">{c.adresse}</p>
        <ul className="n-feuille-codes">{c.colis.map((x) => (
          <li key={x.id} className="n-grand-code">
            <span className="n-grand-code-v" data-code={x.code}>{x.code || '—'}</span>
            <span className="n-grand-code-art">{x.art}</span>
            {x.qr ? <img className="n-grand-qr" src={x.qr} alt={'QR du transporteur pour ' + x.art} width={168} height={168} data-qr-reel="" /> : <span className="n-grand-sans-qr">Code à dire au comptoir</span>}
          </li>
        ))}</ul>
      </>
    );
    plein = 'Colis retirés';
  } else if (c.sorte === 'offre') {
    corps = (<div className="n-feuille-offre"><Vignette src={c.photo} t={72} /><div><p className="n-feuille-montant">{euros(c.montant)}</p><p className="n-feuille-sous">{c.pseudo}{c.prix != null ? ` · annonce ${euros(c.prix)}` : ''}</p></div></div>);
    plein = `Accepter ${euros(c.montant)}`;
  } else {
    corps = <p className="n-feuille-sous">{c.numeros ? listeNumeros(c.numeros, 12) : ''}</p>;
    plein = c.geste;
  }
  return (
    <div className="n-feuille-fond" onClick={fermer} data-feuille={c.sorte}>
      <div className="n-feuille" role="dialog" aria-modal="true" aria-label={c.titre} onClick={(e) => e.stopPropagation()}>
        <span className="n-feuille-poignee" aria-hidden="true" />
        <header className="n-feuille-tete"><h2 className="n-feuille-titre">{c.titre}</h2><button type="button" className="n-rond" onClick={fermer} aria-label="Fermer"><Ico n="croix" /></button></header>
        {corps}
        <div className="n-feuille-gestes">
          {c.sorte === 'offre' ? <div className="n-feuille-deux"><button type="button" className="n-touche">Contre-offre</button><button type="button" className="n-touche">Refuser</button></div> : null}
          <button type="button" className="n-plein" data-plein="" onClick={() => { faire(c.cle); fermer(); }}>{plein}</button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  LA BARRE (quatre onglets) et LA COLONNE de l'ordinateur
// ════════════════════════════════════════════════════════════════════════════
function Barre({ actif, aller, nAFaire, large }) {
  return (
    <nav className={large ? 'n-colonne' : 'n-barre'} aria-label="Onglets">
      {large ? <span className="n-marque">VRM</span> : null}
      {ONGLETS.map((o) => (
        <button key={o.cle} type="button" className="n-onglet" aria-current={actif === o.cle ? 'page' : undefined} onClick={() => aller({ ecran: o.cle })} data-onglet={o.cle}>
          <span className="n-onglet-ico"><Ico n={actif === o.cle && D[o.ico + 'Plein'] ? o.ico + 'Plein' : o.ico} t={24} />{o.cle === 'afaire' && nAFaire ? <span className="n-onglet-point" aria-label={`${nAFaire} à faire`} /> : null}</span>
          <span className="n-onglet-nom">{o.nom}</span>
          {large && o.cle === 'afaire' && nAFaire ? <span className="n-onglet-n">{nAFaire}</span> : null}
        </button>
      ))}
    </nav>
  );
}

// ── LA RACINE ───────────────────────────────────────────────────────────────
export default function Boite() {
  const [M, setM] = React.useState(undefined);
  const [route, aller] = useRoute();
  const large = useLarge();
  const [faits, setFaits] = React.useState(() => new Set());
  React.useEffect(() => {
    const d = document.documentElement; d.setAttribute('data-maquette', 'n');
    let sombre = null; try { const v = localStorage.getItem('vinted_dark'); if (v === 'true') sombre = true; else if (v === 'false') sombre = false; } catch (_) {}
    if (sombre == null) sombre = window.matchMedia('(prefers-color-scheme: dark)').matches;
    d.setAttribute('data-theme', sombre ? 'dark' : 'light');
  }, []);
  React.useEffect(() => { lireDonnees().then(setM, () => setM(null)); }, []);
  React.useEffect(() => { if (M !== undefined) finDemarrage('maquette-n'); }, [M]);
  const B = React.useMemo(() => (M && M.postes ? boite(M) : null), [M]);
  if (M === undefined) return <div className="n-racine n-attente" />;
  if (M === null || !B) return <div className="n-racine"><p className="n-vide">— · base pas lue</p></div>;
  const maintenant = M.maintenant;
  const tousFaits = route.fait === 'tout' ? new Set(B.cartes.map((c) => c.cle)) : faits;
  const faire = (cle) => setFaits((s) => new Set([...s, cle]));
  const ecran = ONGLETS.some((o) => o.cle === route.ecran) ? route.ecran : 'afaire';
  const ouvrir = (cle) => aller({ ...route, feuille: cle });
  const carteOuverte = route.feuille ? B.cartes.find((c) => c.cle === route.feuille || c.sorte === route.feuille) : null;
  const nAFaire = B.cartes.filter((c) => !tousFaits.has(c.cle)).length;
  return (
    <div className={'n-racine' + (large ? ' is-large' : '')} data-ecran={ecran}>
      {large ? <Barre actif={ecran} aller={aller} nAFaire={nAFaire} large /> : null}
      <main className={'n-main n-main--' + ecran}>
        {ecran === 'afaire' ? <EcranAFaire B={B} faits={tousFaits} faire={faire} ouvrir={ouvrir} maintenant={maintenant} large={large} /> : null}
        {ecran === 'commandes' ? <EcranCommandes M={M} route={route} aller={aller} maintenant={maintenant} /> : null}
        {ecran === 'annonces' ? <EcranAnnonces M={M} route={route} aller={aller} maintenant={maintenant} /> : null}
        {ecran === 'argent' ? <EcranArgent M={M} maintenant={maintenant} /> : null}
      </main>
      {large ? null : <Barre actif={ecran} aller={aller} nAFaire={nAFaire} />}
      {carteOuverte ? <Feuille c={carteOuverte} fermer={() => { const r = { ...route }; delete r.feuille; aller(r); }} faire={faire} maintenant={maintenant} /> : null}
    </div>
  );
}
