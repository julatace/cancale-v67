// ════════════════════════════════════════════════════════════════════════════
//  MAQUETTE K — « C, en parfait » (17 nov., proposition pour Julien, PAS livrée).
//  La structure de C (une ligne en haut, rail souligné, une rangée d'outils, le geste qui se
//  nomme, la liste qui monte), reprise écran par écran :
//    · une paire = UNE rangée (photo, N°, titre, une info, montant), 64 px ;
//    · les gestes en bas, au pouce : le geste du lieu dans une capsule d'encre au-dessus de la
//      barre ; en sélection (appui long), une barre d'action remplace les deux ;
//    · Annonces : filtres en UNE puce (« Filtres · 2 ») qui ouvre une feuille ;
//    · Achats : un point relais = une carte (code en grand, le VRAI QR s'il a été reçu, itinéraire) ;
//    · Argent : trois chiffres et une courbe (le vendu cumulé, ce mois contre le mois d'avant).
//  Aucune phrase d'explication à l'écran ; aucun nombre écrit deux fois.
//  Monté seulement si `localStorage.vrm_banc_maquette === 'k'` (posé par le banc).
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import '../../design/studio-polices.css';
import './studio.css';
import { lireDonnees, euros, quand, jourCourt, depuis, titreCourt, J } from './donnees.js';

// ── Icônes : un seul trait (1,6), dessinées pour VRM, 24 × 24. ──
const P = {
  journee: 'M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z',
  ventes: 'M4 8.5 12 4l8 4.5v7L12 20l-8-4.5zM4 8.5l8 4.5 8-4.5M12 13v7',
  annonces: 'M5 5h6v6H5zM13 5h6v6h-6zM5 13h6v6H5zM13 13h6v6h-6z',
  achats: 'M6 8h12l-1 11H7zM9 8V6.5a3 3 0 0 1 6 0V8',
  argent: 'M4 18.5h16M6.5 15V11M10.5 15V7.5M14.5 15V9.5M18.5 15V5.5',
  loupe: 'M10.5 17a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13zM15.5 15.5 20 20',
  imprimer: 'M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M7 14h10v6H7z',
  plus: 'M12 5v14M5 12h14',
  filtres: 'M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4',
  chevron: 'M9.5 6l6 6-6 6',
  bas: 'M7 10l5 5 5-5',
  itineraire: 'M7 17 17 7M9 7h8v8',
  republier: 'M4 12a8 8 0 0 1 13.7-5.6L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.6L4 15.5M4 20v-4.5h4.5',
  relier: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  baisser: 'M12 5v14M6 13l6 6 6-6',
  plusH: 'M6 12h.01M12 12h.01M18 12h.01',
  coche: 'M6 12.5l4 4 8-9',
};
const Ic = ({ n, t = 24, w = 1.6, ...r }) => (
  <svg width={t} height={t} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={n === 'plusH' ? 3 : w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...r}><path d={P[n]} /></svg>
);

// Le thème : le choix `vinted_dark` gagne ; sans choix, le système.
try {
  const v = localStorage.getItem('vinted_dark');
  const sombre = v === 'true' || (v == null && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', sombre ? 'dark' : 'light');
} catch (_) {}

const ECRANS = [
  { cle: 'journee', nom: 'Aujourd’hui', ic: 'journee' },
  { cle: 'ventes', nom: 'Ventes', ic: 'ventes' },
  { cle: 'annonces', nom: 'Annonces', ic: 'annonces' },
  { cle: 'achats', nom: 'Achats', ic: 'achats' },
  { cle: 'argent', nom: 'Argent', ic: 'argent' },
];
const nb = (n) => (n == null ? '—' : n.toLocaleString('fr-FR'));
const lireHash = () => Object.fromEntries(new URLSearchParams((typeof location !== 'undefined' ? location.hash : '').replace(/^#/, '')).entries());

function useLarge() {
  const q = '(min-width: 900px)';
  const [l, setL] = React.useState(() => typeof matchMedia !== 'undefined' && matchMedia(q).matches);
  React.useEffect(() => { const m = matchMedia(q); const f = () => setL(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  return l;
}

// ── La rangée : photo · N° · titre / une info · montant. Appui long ⇒ sélection. ──
function Rangee({ photo, numero, double, titre, info, ton, montant, choisie, enSelection, onAppuiLong, onToucher, large, extra }) {
  const minuterie = React.useRef(null);
  const long = React.useRef(false);
  const debut = () => { long.current = false; if (!onAppuiLong) return; minuterie.current = setTimeout(() => { long.current = true; onAppuiLong(); }, 450); };
  const fin = () => clearTimeout(minuterie.current);
  return (
    <li className="k-rangee" data-choisie={choisie ? '' : undefined}>
      <button type="button" className="k-rangee-b" aria-pressed={enSelection ? !!choisie : undefined}
        onPointerDown={debut} onPointerUp={fin} onPointerLeave={fin} onPointerCancel={fin} onContextMenu={(e) => e.preventDefault()}
        onClick={() => { if (long.current) return; onToucher && onToucher(); }}>
        <span className="k-vignette">
          {photo ? <img src={photo} alt="" loading="lazy" decoding="async" width="48" height="48" /> : null}
          {enSelection ? <span className="k-coche" aria-hidden="true">{choisie ? <Ic n="coche" t={16} w={2.4} /> : null}</span> : null}
        </span>
        <span className="k-rangee-corps">
          <span className="k-rangee-l1">
            {numero ? <span className={'k-plaque' + (double ? ' is-double' : '')}>{numero}</span> : null}
            <span className="k-rangee-titre">{titre}</span>
          </span>
          <span className={'k-rangee-info' + (ton ? ' is-' + ton : '')}>{ton === 'ambre' ? <i className="k-point" aria-hidden="true" /> : null}{info}</span>
        </span>
        {large && extra ? extra.map((x, i) => <span key={i} className="k-col">{x}</span>) : null}
        <span className="k-montant">{montant}</span>
      </button>
    </li>
  );
}

function Rail({ vues, vue, setVue }) {
  return (
    <div className="k-rail" role="tablist">
      {vues.map((v) => (
        <button key={v.cle} type="button" role="tab" aria-selected={v.cle === vue} className="k-rail-b" onClick={() => setVue(v.cle)}>
          {v.nom}{v.n != null ? <span className="k-rail-n">{nb(v.n)}</span> : null}
        </button>
      ))}
    </div>
  );
}

function Outils({ placeholder, children }) {
  return (
    <div className="k-outils">
      <label className="k-champ"><Ic n="loupe" t={18} /><input type="search" placeholder={placeholder} enterKeyHint="search" /></label>
      {children}
    </div>
  );
}

// Les groupes d'une liste (en-tête court, aucun compte répété).
function Groupes({ groupes, rendre }) {
  return groupes.filter((g) => g.lignes.length).map((g) => (
    <section key={g.titre} className="k-groupe">
      {g.titre ? <h2 className="k-groupe-t">{g.titre}{g.droite ? <span>{g.droite}</span> : null}</h2> : null}
      <ul className="k-liste">{g.lignes.map(rendre)}</ul>
    </section>
  ));
}

// ════ Les écrans ════
function Ventes({ m, vue, large, maintenant }) {
  if (!m.ventes) return <Vide />;
  const fin = new Date(maintenant); fin.setHours(23, 59, 59, 999);
  const lignes = vue === 'envoyer' ? m.aEnvoyer : vue === 'route' ? m.enRoute : m.ventes.slice(0, 200);
  const rendre = (v) => {
    const urgent = v.etat === 'envoyer' && v.limite && v.limite - maintenant < 30 * 3600e3;
    const info = v.etat === 'envoyer' ? (v.limite ? 'avant ' + quand(v.limite, maintenant) : 'vers le ' + jourCourt(v.estimee))
      : v.etat === 'route' ? 'en route · ' + jourCourt(v.date) : jourCourt(v.date);
    return <Rangee key={v.tx} photo={v.photo} numero={v.numero} titre={titreCourt(v.titre)} info={info} ton={urgent ? 'ambre' : ''} montant={euros(v.prix)} large={large} extra={[v.compte]} />;
  };
  if (vue === 'envoyer') {
    const g = { auj: [], dem: [], plus: [] };
    for (const v of lignes) { const t = v.limite || v.estimee || 9e15; (t <= fin.getTime() ? g.auj : t <= fin.getTime() + J ? g.dem : g.plus).push(v); }
    return <Groupes rendre={rendre} groupes={[{ titre: 'Aujourd’hui', lignes: g.auj }, { titre: 'Demain', lignes: g.dem }, { titre: 'Plus tard', lignes: g.plus }]} />;
  }
  return <Groupes rendre={rendre} groupes={[{ titre: '', lignes }]} />;
}

function Annonces({ m, vue, large, maintenant, sel, setSel, filtres }) {
  if (!m.annonces) return <Vide />;
  let l = vue === 'dorment' ? m.annonces.filter((a) => a.cree && maintenant - a.cree > 60 * J) : vue === 'sansnum' ? m.annonces.filter((a) => !a.numero) : m.annonces;
  if (filtres.compte) l = l.filter((a) => a.compte === filtres.compte);
  if (filtres.tri === 'anciennes') l = [...l].sort((a, b) => (a.cree || 0) - (b.cree || 0));
  const enSel = sel != null;
  const basculer = (id) => setSel((s) => { const n = new Set(s || []); n.has(id) ? n.delete(id) : n.add(id); return n; });
  return (
    <ul className="k-liste">
      {l.slice(0, 120).map((a) => (
        <Rangee key={a.id} photo={a.photo} numero={a.numero} double={a.double} titre={titreCourt(a.titre)}
          info={'depuis ' + nb(depuis(a.cree, maintenant)) + ' j'} montant={euros(a.prix)} large={large}
          extra={[a.taille ? 'T. ' + a.taille : '', a.fav ? a.fav + ' favoris' : '']}
          choisie={enSel && sel.has(a.id)} enSelection={enSel}
          onAppuiLong={() => setSel(new Set([a.id]))} onToucher={() => enSel && basculer(a.id)} />
      ))}
    </ul>
  );
}

// Le point relais : UNE carte par point. Le QR n'est montré que s'il a été REÇU du transporteur
// (jamais fabriqué : un QR inventé ne se scanne pas au comptoir) ; sinon le code, en grand.
function CartePoint({ p, maintenant }) {
  const [i, setI] = React.useState(0);
  const piste = React.useRef(null);
  const onScroll = () => { const el = piste.current; if (el) setI(Math.round(el.scrollLeft / el.clientWidth)); };
  const lien = 'https://maps.apple.com/?daddr=' + encodeURIComponent([p.nom, p.adresse].filter(Boolean).join(', '));
  const n = p.colis.length;
  return (
    <article className="k-point-carte">
      <header className="k-point-tete">
        <div>
          <h2 className="k-point-nom">{p.nom || 'Point relais'}</h2>
          <p className="k-point-adr">{p.adresse}</p>
        </div>
        <a className="k-rond" href={lien} target="_blank" rel="noreferrer" aria-label={'Itinéraire vers ' + p.nom}><Ic n="itineraire" t={20} /></a>
      </header>
      <div className="k-piste" ref={piste} onScroll={onScroll}>
        {p.colis.map((c) => (
          <div key={c.suivi} className={'k-colis' + (c.qr ? ' a-qr' : '')}>
            <div className="k-colis-texte">
              <p className="k-code" aria-label={'Code de retrait ' + c.code}>{c.code ? c.code.replace(/^(\d{3})(\d{3})$/, '$1 $2') : '—'}</p>
              <p className="k-colis-titre">{titreCourt(c.titre)}</p>
            </div>
            {c.qr ? <img className="k-qr" src={c.qr} alt={'QR de retrait du colis ' + c.suivi} width="104" height="104" /> : null}
          </div>
        ))}
      </div>
      <footer className="k-point-pied">
        <span className="k-points" aria-hidden="true">{n > 1 ? p.colis.map((c, k) => <i key={c.suivi} data-actif={k === i ? '' : undefined} />) : null}</span>
        <span className={'k-point-lim' + (p.limite && p.limite - maintenant < 2 * J ? ' is-ambre' : '')}>
          {p.limite && p.limite - maintenant < 2 * J ? <i className="k-point" aria-hidden="true" /> : null}
          {p.limite ? 'jusqu’au ' + jourCourt(p.limite) : '—'}
        </span>
      </footer>
    </article>
  );
}

function Achats({ m, vue, large, maintenant }) {
  if (vue === 'retirer') {
    if (!m.points) return <Vide />;
    return <div className="k-points-grille">{m.points.map((p) => <CartePoint key={p.cle} p={p} maintenant={maintenant} />)}</div>;
  }
  const l = vue === 'route' ? m.achatsRoute : m.achats;
  if (!l) return <Vide />;
  return (
    <ul className="k-liste">
      {l.slice(0, 120).map((a) => <Rangee key={a.tx} photo={a.photo} titre={titreCourt(a.titre)} info={(a.fini ? 'reçu · ' : 'en route · ') + jourCourt(a.date)} montant={euros(a.prix)} large={large} extra={[a.compte]} />)}
    </ul>
  );
}

// La courbe : le vendu CUMULÉ jour par jour (même source que « Vendu »), ce mois en encre,
// le mois d'avant en trait fin. Axes au strict nécessaire : le 1er, le 15, la fin du mois.
function Courbe({ a }) {
  const W = 342, H = 148, pad = 8;
  const max = Math.max(1, ...a.ceMois, ...a.moisPrec);
  const x = (j, n) => pad + (j / Math.max(1, n - 1)) * (W - 2 * pad);
  const y = (v) => H - 20 - (v / max) * (H - 36);
  const chemin = (t, n) => t.map((v, j) => (j ? 'L' : 'M') + x(j, n).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
  const der = a.ceMois.length - 1;
  return (
    <figure className="k-courbe">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Vendu cumulé : ${euros(a.ceMois[der])} au ${a.aujourdhui}, contre ${euros(a.moisPrec[Math.min(der, a.moisPrec.length - 1)])} le mois d’avant au même jour`}>
        <path d={chemin(a.moisPrec, a.jours)} className="k-courbe-avant" />
        <path d={chemin(a.ceMois, a.jours) + ` L${x(der, a.jours).toFixed(1)} ${H - 20} L${pad} ${H - 20} Z`} className="k-courbe-aire" />
        <path d={chemin(a.ceMois, a.jours)} className="k-courbe-mois" />
        <circle cx={x(der, a.jours)} cy={y(a.ceMois[der])} r="4" className="k-courbe-point" />
        <line x1={pad} x2={W - pad} y1={H - 20} y2={H - 20} className="k-courbe-axe" />
        {[1, 15, a.jours].map((j) => <text key={j} x={x(j - 1, a.jours)} y={H - 4} textAnchor={j === 1 ? 'start' : j === a.jours ? 'end' : 'middle'}>{j}</text>)}
      </svg>
      <figcaption><span className="k-leg k-leg-mois" />Ce mois<span className="k-leg k-leg-avant" />Le mois d’avant</figcaption>
    </figure>
  );
}

function Argent({ m }) {
  const a = m.argent;
  if (!a) return <Vide />;
  const mois = new Date(m.maintenant).toLocaleDateString('fr-FR', { month: 'long', timeZone: 'Europe/Paris' });
  return (
    <div className="k-argent">
      <section className="k-chiffres" aria-label={'Argent de ' + mois}>
        <div className="k-chiffre k-chiffre-un"><span className="k-chiffre-l">Vendu en {mois}</span><span className="k-chiffre-v">{euros(a.vendu)}</span></div>
        <div className="k-chiffre"><span className="k-chiffre-l">Reçu</span><span className="k-chiffre-v">{euros(a.recu)}</span></div>
        <div className="k-chiffre"><span className="k-chiffre-l">Bénéfice</span><span className="k-chiffre-v">{euros(a.benefice)}</span>
          {a.benefice != null && a.couverts < a.nVentes ? <span className="k-chiffre-c">sur {a.couverts} ventes</span> : null}</div>
      </section>
      <Courbe a={a} />
      <ul className="k-liste k-liste-nav">
        {['Déclarer', 'Factures', 'Statistiques'].map((t) => (
          <li key={t} className="k-rangee"><button type="button" className="k-rangee-b k-nav-b"><span className="k-rangee-titre">{t}</span><Ic n="chevron" t={18} className="k-chev" /></button></li>
        ))}
      </ul>
    </div>
  );
}

function Journee({ m, maintenant, aller }) {
  const premier = m.aEnvoyer && m.aEnvoyer[0];
  const pt = m.points && m.points[0];
  const faire = [
    m.aEnvoyer && m.aEnvoyer.length ? { cle: 'ventes', vue: 'envoyer', ic: 'ventes', t: 'À envoyer', n: m.aEnvoyer.length, i: premier && premier.limite ? 'le premier avant ' + quand(premier.limite, maintenant) : '' } : null,
    m.colis && m.colis.length ? { cle: 'achats', vue: 'retirer', ic: 'achats', t: 'À retirer', n: m.colis.length, i: pt ? pt.nom + (m.points.length > 1 ? ' et ' + (m.points.length - 1) + ' autres points' : '') : '' } : null,
  ].filter(Boolean);
  const auj = m.venduAujourdhui || [];
  return (
    <div className="k-journee">
      {faire.length ? (
        <section className="k-groupe">
          <h2 className="k-groupe-t">À faire</h2>
          <ul className="k-liste">
            {faire.map((f) => (
              <li key={f.cle} className="k-rangee">
                <button type="button" className="k-rangee-b k-faire" onClick={() => aller(f.cle, f.vue)}>
                  <span className="k-faire-ic"><Ic n={f.ic} /></span>
                  <span className="k-rangee-corps"><span className="k-rangee-titre">{f.t}</span><span className="k-rangee-info is-ambre"><i className="k-point" aria-hidden="true" />{f.i}</span></span>
                  <span className="k-faire-n">{nb(f.n)}</span><Ic n="chevron" t={18} className="k-chev" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="k-groupe">
        <h2 className="k-groupe-t">Vendu aujourd’hui<span>{m.venduAujourdhui ? euros(auj.reduce((s, v) => s + (v.prix || 0), 0)) : '—'}</span></h2>
        <ul className="k-liste">
          {auj.map((v) => <Rangee key={v.tx} photo={v.photo} numero={v.numero} titre={titreCourt(v.titre)} info={v.compte} montant={euros(v.prix)} />)}
        </ul>
      </section>
    </div>
  );
}

const Vide = () => <p className="k-vide">—</p>;

// ════ La racine ════
export default function Studio() {
  const h0 = React.useMemo(lireHash, []);
  const [m, setM] = React.useState(undefined);
  const [ecran, setEcran] = React.useState(h0.ecran || 'journee');
  const [vues, setVues] = React.useState({ ventes: 'envoyer', annonces: 'enligne', achats: 'retirer', ...(h0.vue ? { [h0.ecran]: h0.vue } : {}) });
  const [sel, setSel] = React.useState(null);
  const [filtres, setFiltres] = React.useState({ compte: '', tri: 'recentes' });
  const [feuille, setFeuille] = React.useState(h0.feuille || '');
  const large = useLarge();
  const maintenant = React.useMemo(() => Date.now(), []);

  React.useEffect(() => { lireDonnees().then(setM, () => setM(null)); }, []);
  // Le banc pose une sélection et des filtres déjà choisis (`#sel=3&f=2`) pour la capture.
  React.useEffect(() => {
    if (!m || !m.annonces) return;
    if (h0.f === '2' && m.comptes && m.comptes[0]) setFiltres({ compte: m.comptes[0].login, tri: 'anciennes' });
    if (h0.sel) setSel(new Set(m.annonces.filter((a) => !h0.f || a.compte === (m.comptes[0] || {}).login).sort((a, b) => (h0.f ? (a.cree || 0) - (b.cree || 0) : 0)).slice(0, Number(h0.sel)).map((a) => a.id)));
  }, [m]);
  React.useEffect(() => { setSel(null); }, [ecran]);

  const vue = vues[ecran];
  const setVue = (v) => setVues((x) => ({ ...x, [ecran]: v }));
  const aller = (e, v) => { setEcran(e); if (v) setVues((x) => ({ ...x, [e]: v })); };
  const nFiltres = (filtres.compte ? 1 : 0) + (filtres.tri !== 'recentes' ? 1 : 0);

  if (m === undefined) return <div className="k k-attente" data-large={large ? '' : undefined} />;
  if (m === null) return <div className="k"><p className="k-vide">VRM n’a pas pu lire tes données.</p></div>;

  const dormant = m.annonces ? m.annonces.filter((a) => a.cree && maintenant - a.cree > 60 * J).length : null;
  const RAILS = {
    ventes: [{ cle: 'envoyer', nom: 'À envoyer', n: m.aEnvoyer && m.aEnvoyer.length }, { cle: 'route', nom: 'En route', n: m.enRoute && m.enRoute.length }, { cle: 'toutes', nom: 'Toutes' }],
    annonces: [{ cle: 'enligne', nom: 'En ligne', n: m.annonces && m.annonces.length }, { cle: 'dorment', nom: 'Qui dorment', n: dormant }, { cle: 'sansnum', nom: 'Sans N°', n: m.annonces && m.annonces.filter((a) => !a.numero).length }],
    achats: [{ cle: 'retirer', nom: 'À retirer', n: m.colis && m.colis.length }, { cle: 'route', nom: 'En route', n: m.achatsRoute && m.achatsRoute.length }, { cle: 'tous', nom: 'Tous' }],
  };
  // LE geste du lieu. Il ne répète pas le nombre que le rail montre déjà.
  const avecBord = m.aEnvoyer ? m.aEnvoyer.filter((v) => v.bord).length : 0;
  const geste = (ecran === 'ventes' || ecran === 'journee') && avecBord ? { ic: 'imprimer', t: avecBord === (m.aEnvoyer || []).length ? 'Tout imprimer' : 'Imprimer ' + avecBord }
    : ecran === 'annonces' ? { ic: 'plus', t: 'Publier' } : null;
  const titre = sel ? (sel.size ? sel.size + (sel.size > 1 ? ' annonces' : ' annonce') : 'Choisis') : ECRANS.find((e) => e.cle === ecran).nom;
  const travail = { ventes: !!(m.aEnvoyer && m.aEnvoyer.length), achats: !!(m.colis && m.colis.length) };

  const tete = (
    <header className="k-tete">
      <h1 className="k-titre">{titre}</h1>
      <div className="k-tete-d">
        {sel ? <button type="button" className="k-lien" onClick={() => setSel(null)}>OK</button> : <>
          {large && geste ? <button type="button" className="k-geste" data-plein=""><Ic n={geste.ic} t={20} />{geste.t}</button> : null}
          {!large ? <button type="button" className="k-rond" aria-label="Chercher"><Ic n="loupe" t={20} /></button> : null}
          {!large ? <button type="button" className="k-rond k-moi" aria-label="Mon compte">J</button> : null}
        </>}
      </div>
    </header>
  );
  const outils = ecran === 'ventes' ? <Outils placeholder="N°, titre, acheteur" />
    : ecran === 'annonces' ? <Outils placeholder="N°, titre, taille">
      <button type="button" className={'k-puce' + (nFiltres ? ' is-on' : '')} onClick={() => setFeuille('filtres')}><Ic n="filtres" t={18} />{nFiltres ? 'Filtres · ' + nFiltres : 'Filtres'}</button>
    </Outils> : ecran === 'achats' && vue !== 'retirer' ? <Outils placeholder="Titre, n° de suivi" /> : null;

  const corps = ecran === 'ventes' ? <Ventes m={m} vue={vue} large={large} maintenant={maintenant} />
    : ecran === 'annonces' ? <Annonces m={m} vue={vue} large={large} maintenant={maintenant} sel={sel} setSel={setSel} filtres={filtres} />
    : ecran === 'achats' ? <Achats m={m} vue={vue} large={large} maintenant={maintenant} />
    : ecran === 'argent' ? <Argent m={m} /> : <Journee m={m} maintenant={maintenant} aller={aller} />;

  const barreAction = sel ? (
    <div className="k-action" role="toolbar" aria-label="Actions sur la sélection">
      {[['republier', 'Republier'], ['relier', 'Relier'], ['baisser', 'Baisser'], ['plusH', 'Plus']].map(([ic, t]) => (
        <button key={t} type="button" className="k-action-b" disabled={!sel.size}><Ic n={ic} t={22} /><span>{t}</span></button>
      ))}
    </div>
  ) : null;

  return (
    <div className="k" data-large={large ? '' : undefined} data-ecran={ecran} data-selection={sel ? '' : undefined}>
      {large ? (
        <nav className="k-cote" aria-label="Écrans">
          <div className="k-marque"><svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true"><rect width="28" height="28" rx="8" className="k-marque-f" /><path d="M8 9l6 11 6-11" className="k-marque-v" /></svg>VRM</div>
          <label className="k-champ k-champ-cote"><Ic n="loupe" t={18} /><input type="search" placeholder="Chercher" /></label>
          {ECRANS.map((e) => (
            <button key={e.cle} type="button" className="k-cote-b" aria-current={e.cle === ecran ? 'page' : undefined} onClick={() => setEcran(e.cle)}>
              <Ic n={e.ic} t={20} />{e.nom}{travail[e.cle] ? <i className="k-point" aria-label="à faire" /> : null}
            </button>
          ))}
        </nav>
      ) : null}
      <main className="k-page">
        {tete}
        {RAILS[ecran] && !sel ? <Rail vues={RAILS[ecran]} vue={vue} setVue={setVue} /> : null}
        {outils && !sel ? outils : null}
        <div className="k-corps">{corps}</div>
      </main>
      {!large ? (
        <div className="k-bas">
          {barreAction || <>
            {geste ? <button type="button" className="k-geste" data-plein=""><Ic n={geste.ic} t={20} />{geste.t}</button> : null}
            <nav className="k-barre" aria-label="Écrans">
              {ECRANS.map((e) => (
                <button key={e.cle} type="button" className="k-barre-b" aria-current={e.cle === ecran ? 'page' : undefined} onClick={() => setEcran(e.cle)}>
                  <span className="k-barre-ic"><Ic n={e.ic} />{travail[e.cle] ? <i className="k-point" aria-label="à faire" /> : null}</span>{e.nom}
                </button>
              ))}
            </nav>
          </>}
        </div>
      ) : barreAction ? <div className="k-bas k-bas-large">{barreAction}</div> : null}
      {feuille === 'filtres' ? <FeuilleFiltres m={m} filtres={filtres} setFiltres={setFiltres} fermer={() => setFeuille('')} /> : null}
    </div>
  );
}

function FeuilleFiltres({ m, filtres, setFiltres, fermer }) {
  const groupes = [
    { t: 'Compte', cle: 'compte', options: [['', 'Tous'], ...(m.comptes || []).map((c) => [c.login, c.login])] },
    { t: 'Ordre', cle: 'tri', options: [['recentes', 'Les plus récentes'], ['anciennes', 'Les plus anciennes']] },
  ];
  return (
    <div className="k-voile" onClick={fermer}>
      <section className="k-feuille" role="dialog" aria-label="Filtres" onClick={(e) => e.stopPropagation()}>
        <div className="k-feuille-poignee" aria-hidden="true" />
        <header className="k-feuille-tete"><h2>Filtres</h2><button type="button" className="k-lien" onClick={fermer}>OK</button></header>
        {groupes.map((g) => (
          <fieldset key={g.cle} className="k-choix">
            <legend>{g.t}</legend>
            {g.options.map(([v, t]) => (
              <label key={v} className="k-choix-l"><input type="radio" name={g.cle} checked={filtres[g.cle] === v} onChange={() => setFiltres((f) => ({ ...f, [g.cle]: v }))} /><span>{t}</span><Ic n="coche" t={18} w={2} className="k-choix-c" /></label>
            ))}
          </fieldset>
        ))}
      </section>
    </div>
  );
}
