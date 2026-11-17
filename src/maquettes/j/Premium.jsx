// ════════════════════════════════════════════════════════════════════════════
//  MAQUETTE J — « PREMIUM » (17 nov.) — un PROTOTYPE à montrer, pas livré.
//  Monté seulement si `localStorage.vrm_banc_maquette === 'j'` (posé par le banc
//  scripts/bancs/maquette-j.cjs ; aucun bouton de l'app ne le pose : invisible pour Julien).
//
//  Direction : Revolut × Wallet × Tesla. Le CHIFFRE de l'écran en très grand, la PAIRE en grand
//  (photo = la matière), les colis à retirer en CARTES EMPILÉES façon Wallet (code + QR devant),
//  sombre profond par défaut avec le bleu en LUMIÈRE (une version claire), trois tailles de texte
//  par écran (affiche 64 · texte 17 · légende 13), UN geste plein au pouce, au-dessus de la barre.
//  Le modèle est celui des maquettes F/H (donnees.js, postes.js, repris tels quels) : identités
//  seulement (N° par l'id de SON annonce, vente par item_id, bordereau par n° de transaction,
//  colis par l'e-mail du transporteur), « — » quand une source n'est pas lue.
//  Textes en français seulement (prototype) : à passer par tr() s'il est retenu.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import qrcode from 'qrcode-generator';
import { lireDonnees, euros, jourCourt } from './donnees.js';
import { centimes } from '../../rechercheUnique.js';
import { finDemarrage } from '../../demarrage.js';
import '../../design/studio-polices.css';
import './premium.css';

const J = 86400000;
const ECRANS = [
  { cle: 'journee', nom: 'Aujourd’hui', ico: 'soleil' },
  { cle: 'annonces', nom: 'Annonces', ico: 'grille' },
  { cle: 'achats', nom: 'Achats', ico: 'carte' },
  { cle: 'ventes', nom: 'Ventes', ico: 'colis' },
  { cle: 'argent', nom: 'Argent', ico: 'euro' },
];

const lireRoute = () => { const p = new URLSearchParams((window.location.hash || '').replace(/^#/, '')); return { ecran: p.get('ecran') || 'journee', seg: p.get('seg') || '', vue: p.get('vue') || '' }; };
function useRoute() {
  const [r, setR] = React.useState(lireRoute);
  React.useEffect(() => { const f = () => setR(lireRoute()); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  const aller = (x) => { const p = new URLSearchParams(); for (const k of ['ecran', 'seg', 'vue']) if (x[k]) p.set(k, x[k]); window.location.hash = p.toString(); };
  return [r, aller];
}
function useLarge() {
  const mq = '(min-width: 1100px)';
  const [l, setL] = React.useState(() => window.matchMedia(mq).matches);
  React.useEffect(() => { const m = window.matchMedia(mq); const f = () => setL(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  return l;
}
const nb = (n) => (n == null ? '—' : Number(n).toLocaleString('fr-FR'));
const str = (v) => String(v == null ? '' : v);
const photoDe = (p) => (!p ? '' : typeof p === 'string' ? p : str(p.url || ''));
const jours = (iso, now) => { const t = Date.parse(iso || ''); return t ? Math.max(0, Math.round((now - t) / J)) : null; };

// ── Icônes (trait 1,5, dessinées pour VRM) ────────────────────────────────────
const D = {
  soleil: 'M12 7.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zm0 1.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM11.25 2h1.5v3h-1.5zm0 17h1.5v3h-1.5zM2 11.25h3v1.5H2zm17 0h3v1.5h-3zM4.4 5.46l1.06-1.06 2.12 2.12-1.06 1.06zm12.02 12.02 1.06-1.06 2.12 2.12-1.06 1.06zM4.4 18.54l2.12-2.12 1.06 1.06-2.12 2.12zM16.42 6.52l2.12-2.12 1.06 1.06-2.12 2.12z',
  grille: 'M4 4h7v7H4zm1.5 1.5v4h4v-4zM13 4h7v7h-7zm1.5 1.5v4h4v-4zM4 13h7v7H4zm1.5 1.5v4h4v-4zM13 13h7v7h-7zm1.5 1.5v4h4v-4z',
  liste: 'M4 5.25h3v3H4zm5 .75h11v1.5H9zM4 10.5h3v3H4zm5 .75h11v1.5H9zm-5 4.5h3v3H4zm5 .75h11v1.5H9z',
  carte: 'M5 4.5h14A2.5 2.5 0 0 1 21.5 7v10a2.5 2.5 0 0 1-2.5 2.5H5A2.5 2.5 0 0 1 2.5 17V7A2.5 2.5 0 0 1 5 4.5zM4 9v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9zm1-3a1 1 0 0 0-1 1v.5h16V7a1 1 0 0 0-1-1zm1.5 8.5h5V16h-5z',
  colis: 'M4 7.5 12 3.5l8 4v9L12 20.5l-8-4zm1.5 1.2v6.9l5.75 2.9v-6.9zm13 0-5.75 2.9v6.9l5.75-2.9zM6.2 7.6 12 10.5l5.8-2.9L12 4.8z',
  euro: 'M14.8 5c1.3 0 2.5.3 3.5.9l-.7 1.3a5.6 5.6 0 0 0-2.8-.7c-2.3 0-4.2 1.5-4.9 3.6H15v1.4H9.6l-.03.5.03.5H15v1.4H9.9c.7 2.1 2.6 3.6 4.9 3.6 1 0 2-.3 2.8-.7l.7 1.3c-1 .6-2.2.9-3.5.9-3.2 0-5.8-2.1-6.5-5.1H6v-1.4h2.1L8 12l.05-.5H6v-1.4h2.3C9 7.1 11.6 5 14.8 5z',
  loupe: 'M10.5 4a6.5 6.5 0 1 0 4.06 11.58l4.43 4.43 1.06-1.06-4.43-4.43A6.5 6.5 0 0 0 10.5 4zm0 1.5a5 5 0 1 1 0 10 5 5 0 0 1 0-10z',
  chevron: 'M9.3 5.3 8.2 6.4 13.8 12l-5.6 5.6 1.1 1.1L16 12z',
  bas: 'M6.4 8.7 5.3 9.8 12 16.5l6.7-6.7-1.1-1.1L12 14.3z',
  imprimante: 'M7 3.5h10V8h2.5A1.5 1.5 0 0 1 21 9.5v7a1.5 1.5 0 0 1-1.5 1.5H17v2.5H7V18H4.5A1.5 1.5 0 0 1 3 16.5v-7A1.5 1.5 0 0 1 4.5 8H7zM8.5 5v3h7V5zM4.5 9.5v7H7v-3h10v3h2.5v-7zm4 5.5v4h7v-4z',
  plein: 'M4 4h6v1.5H5.5V10H4zm10 0h6v6h-1.5V5.5H14zM4 14h1.5v4.5H10V20H4zm14.5 0H20v6h-6v-1.5h4.5z',
  plus: 'M11.25 5h1.5v6.25H19v1.5h-6.25V19h-1.5v-6.25H5v-1.5h6.25z',
  stylo: 'M15.9 3.6a2 2 0 0 1 2.83 0l1.67 1.67a2 2 0 0 1 0 2.83L8.5 20H4v-4.5zm-1 3.12L5.5 16.12V18.5h2.38l9.4-9.4zm2.1-2.06-1.04 1.04 2.37 2.37 1.04-1.04a.5.5 0 0 0 0-.7l-1.67-1.67a.5.5 0 0 0-.7 0z',
  coeur: 'M12 20.3 10.9 19.3C6.4 15.2 3.5 12.6 3.5 9.4 3.5 6.8 5.5 4.8 8.1 4.8c1.5 0 2.9.7 3.9 1.8 1-1.1 2.4-1.8 3.9-1.8 2.6 0 4.6 2 4.6 4.6 0 3.2-2.9 5.8-7.4 9.9zm0-2 .1-.1c4.1-3.7 6.9-6.2 6.9-8.8 0-1.8-1.3-3.1-3.1-3.1-1.4 0-2.7.9-3.2 2.1h-1.4c-.5-1.2-1.8-2.1-3.2-2.1C6.3 6.3 5 7.6 5 9.4c0 2.6 2.8 5.1 6.9 8.8z',
  aide: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zm0 1.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15zm-.1 10.6a1 1 0 1 1 0 2 1 1 0 0 1 0-2zM12 7c1.8 0 3.1 1.1 3.1 2.6 0 1.2-.7 1.9-1.6 2.5-.6.4-.8.7-.8 1.3v.3h-1.5v-.4c0-1 .4-1.6 1.3-2.2.7-.5 1.1-.8 1.1-1.5 0-.7-.7-1.2-1.6-1.2-.9 0-1.6.5-1.7 1.4H8.8C8.9 8.2 10.2 7 12 7z',
};
const Ico = ({ n, t = 24 }) => <svg className="j-ico" width={t} height={t} viewBox="0 0 24 24" aria-hidden="true"><path d={D[n]} fill="currentColor" /></svg>;

// La plaque gravée du N° (le seul rouge de l'app : deux paires sous le même N°).
const Plaque = ({ n, double }) => (n ? <span className={'j-plaque' + (double ? ' is-double' : '')} data-numero={n}>N°&#8239;{n}</span> : null);
const Photo = ({ src, t, rayon, cls = '' }) => (
  <span className={'j-photo ' + cls} style={t ? { width: t, height: t, borderRadius: rayon } : { borderRadius: rayon }}>
    {src ? <img src={src} alt="" loading="lazy" decoding="async" /> : null}
  </span>
);
// Une rangée ENTIÈRE se touche (jamais un bouton dedans).
const Rangee = ({ photo, titre, sous, ambre, droite, droiteSous, cle, numero }) => (
  <button type="button" className="j-rangee" data-ligne={cle}>
    <Photo src={photo} t={64} rayon={16} />
    <span className="j-rangee-corps">
      <span className="j-rangee-titre">{titre}</span>
      <span className="j-rangee-sous">{numero ? <Plaque n={numero} /> : null}{sous ? <span className={ambre ? 'is-ambre' : ''}>{ambre ? <i className="j-point" /> : null}{sous}</span> : null}</span>
    </span>
    {droite != null ? <span className="j-rangee-droite"><span className="j-val">{droite}</span>{droiteSous ? <span className="j-val-sous">{droiteSous}</span> : null}</span> : null}
  </button>
);
const Liste = ({ children, max = 40, total }) => {
  const l = React.Children.toArray(children);
  const n = total != null ? total : l.length;
  return (
    <div className="j-liste">
      {l.slice(0, max)}
      {n > max ? <button type="button" className="j-suite">Afficher les {nb(n - max)} autres</button> : null}
    </div>
  );
};
const Entete = ({ titre, n }) => <h2 className="j-entete">{titre}{n != null ? <span className="j-entete-n">{nb(n)}</span> : null}</h2>;
const PasLu = ({ quoi }) => <div className="j-vide">— · {quoi} pas lu{/s$/.test(quoi) ? 's' : ''}</div>;

// LE CHIFFRE DE L'ÉCRAN. Trois tailles en tout : affiche 64, texte 17, légende 13.
function Heros({ n, unite, legende, fait, sombreLueur = true, children }) {
  return (
    <div className="j-heros" data-heros="">
      {sombreLueur ? <span className="j-lueur" aria-hidden="true" /> : null}
      <div className="j-heros-ligne">
        <span className="j-heros-n" data-chiffre="">{n}</span>
        {unite ? <span className="j-heros-u">{unite}</span> : null}
      </div>
      {legende ? <div className="j-heros-l">{legende}</div> : null}
      {fait ? <div className="j-heros-fait">{fait}</div> : null}
      {children}
    </div>
  );
}
// Les vues d'une liste : une piste de verre, l'actif enfoncé. Aucun nombre (le chiffre héros le porte).
function Vues({ items, actif, choisir, droite }) {
  return (
    <div className="j-vues-ligne">
      <div className="j-vues" role="tablist">
        {items.map((it) => (
          <button key={it.cle} type="button" role="tab" className="j-vue" aria-selected={actif === it.cle} onClick={() => choisir(it.cle)} data-vue={it.cle}>
            {it.ambre ? <i className="j-point" /> : null}{it.nom}
          </button>
        ))}
      </div>
      {droite}
    </div>
  );
}

// ── QR (code de retrait lu dans l'e-mail du transporteur ; rien n'est inventé) ──
function Qr({ texte, t = 132 }) {
  const svg = React.useMemo(() => {
    try { const q = qrcode(0, 'M'); q.addData(str(texte)); q.make(); return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); } catch (_) { return ''; }
  }, [texte]);
  return <span className="j-qr" style={{ width: t, height: t }} dangerouslySetInnerHTML={{ __html: svg }} />;
}

// ════════════════════════════════════════════════════════════════════════════
//  AUJOURD'HUI — le chiffre du jour, LA paire la plus pressée en grand, la pile Wallet des retraits.
// ════════════════════════════════════════════════════════════════════════════
function Journee({ M, P, large, aller }) {
  const env = P.poster.envoyer;
  const prem = env && env[0];
  const photo = prem ? ((prem.paire && prem.paire.photo) || photoDe(prem.v.photo)) : '';
  const points = P.recevoir.points;
  const recu = P.encaisser.recuMois;
  const d = new Date(M.maintenant);
  const date = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' });
  const urgents = env ? env.filter((l) => l.limite && l.limite - M.maintenant < 2 * J).length : null;
  return (
    <div className={'j-ecran j-journee' + (large ? ' is-large' : '')}>
      <div className="j-col">
        <Heros n={env ? nb(env.length) : '—'} legende="colis à envoyer" fait={<><span className="j-cap">{date}</span>{urgents ? <><span className="j-sep" /><i className="j-point" />{nb(urgents)} avant demain soir</> : null}</>} />
        {prem ? (
          <button type="button" className="j-vedette" data-vedette="">
            <Photo src={photo} rayon={28} cls="j-vedette-photo" />
            <span className="j-vedette-voile" />
            <span className="j-vedette-texte">
              <span className="j-vedette-haut"><Plaque n={prem.paire && prem.paire.numero} /><span className="j-verre-cap"><i className="j-point" />{prem.limite ? 'avant ' + jourCourt(new Date(prem.limite).toISOString(), M.maintenant) : 'date estimée'}</span></span>
              <span className="j-vedette-titre">{prem.v.title}</span>
              <span className="j-vedette-bas"><span>{prem.pseudo || prem.compte}</span><span className="j-val">{euros(centimes(prem.v.price))}</span></span>
            </span>
          </button>
        ) : null}
      </div>
      <div className="j-col">
        <Entete titre="À retirer" n={P.recevoir.aRetirer ? P.recevoir.aRetirer.length : null} />
        {points ? <PileWallet points={points} M={M} mini onClick={() => aller({ ecran: 'achats' })} /> : <PasLu quoi="e-mails des transporteurs" />}
        <Entete titre="Ce mois" />
        <div className="j-liste">
          <button type="button" className="j-ligne-simple" onClick={() => aller({ ecran: 'argent' })}><span>Reçu en {d.toLocaleDateString('fr-FR', { month: 'long', timeZone: 'Europe/Paris' })}</span><span className="j-val">{euros(recu)}</span><Ico n="chevron" t={18} /></button>
          <button type="button" className="j-ligne-simple" onClick={() => aller({ ecran: 'ventes', seg: 'toutes' })}><span>Paires vendues</span><span className="j-val">{nb(P.encaisser.vendues)}</span><Ico n="chevron" t={18} /></button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  VENTES — le chiffre de la vue, puis la liste ; « Imprimer N » au pouce.
// ════════════════════════════════════════════════════════════════════════════
function Ventes({ M, P, route, aller, large }) {
  const seg = route.seg || 'envoyer';
  const env = P.poster.envoyer;
  const toutes = M.ventes ? [...M.ventes].sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0)) : null;
  const enRoute = M.ventes ? toutes.filter((v) => v.transaction_user_status !== 'needs_action' && !/finalis|rembours|annul/i.test(str(v.status))) : null;
  const paireDe = (v) => { const k = M.numParItem.get(v._item); return k ? M.paires.get(k) : null; };
  const vues = [{ cle: 'envoyer', nom: 'À envoyer', ambre: true }, { cle: 'route', nom: 'En route' }, { cle: 'toutes', nom: 'Toutes' }];
  let heros, liste;
  if (seg === 'envoyer') {
    const g = groupesLimite(env || [], M.maintenant);
    heros = <Heros n={env ? nb(env.length) : '—'} legende="colis à envoyer" fait={P.poster.aImprimer ? <>{nb(P.poster.aImprimer.length)} bordereaux prêts</> : null} />;
    liste = env ? g.map(([nom, l]) => (
      <section key={nom} className="j-groupe">
        <Entete titre={nom} n={l.length} />
        <Liste>{l.map((x) => <Rangee key={x.cle} cle={x.cle} photo={(x.paire && x.paire.photo) || photoDe(x.v.photo)} titre={x.v.title} numero={x.paire && x.paire.numero}
          sous={x.bord ? (x.limite ? 'avant ' + jourCourt(new Date(x.limite).toISOString(), M.maintenant) : 'bordereau prêt') : 'bordereau attendu'} ambre={!!(x.limite && x.limite - M.maintenant < 2 * J)}
          droite={euros(centimes(x.v.price))} />)}</Liste>
      </section>
    )) : <PasLu quoi="ventes" />;
  } else {
    const l = seg === 'route' ? enRoute : toutes;
    heros = <Heros n={l ? nb(l.length) : '—'} legende={seg === 'route' ? 'en route vers l’acheteur' : 'ventes lues'} />;
    liste = l ? <section className="j-groupe"><Liste total={l.length}>{l.slice(0, 40).map((v) => { const p = paireDe(v); return <Rangee key={v._tx} cle={'v' + v._tx} photo={(p && p.photo) || photoDe(v.photo)} titre={v.title} numero={p && p.numero} sous={jourCourt(v.date, M.maintenant)} droite={euros(centimes(v.price))} />; })}</Liste></section> : <PasLu quoi="ventes" />;
  }
  return (
    <div className={'j-ecran' + (large ? ' is-large' : '')}>
      {heros}
      <Vues items={vues} actif={seg} choisir={(c) => aller({ ecran: 'ventes', seg: c })} />
      {liste}
    </div>
  );
}
function groupesLimite(l, now) {
  const g = new Map([['Avant demain soir', []], ['Cette semaine', []], ['Plus tard', []], ['Date estimée', []]]);
  for (const x of l) {
    if (!x.limite) g.get('Date estimée').push(x);
    else if (x.limite - now < 2 * J) g.get('Avant demain soir').push(x);
    else if (x.limite - now < 7 * J) g.get('Cette semaine').push(x);
    else g.get('Plus tard').push(x);
  }
  return [...g.entries()].filter(([, v]) => v.length);
}

// ════════════════════════════════════════════════════════════════════════════
//  ACHATS — LA PILE WALLET : un point = une carte ; devant, le code et le QR.
// ════════════════════════════════════════════════════════════════════════════
function PileWallet({ points, M, mini, onClick, choisi = 0, choisir }) {
  if (!points.length) return <div className="j-vide">Rien à retirer</div>;
  const devant = points[choisi] || points[0];
  const derriere = points.filter((p) => p !== devant);
  if (mini) {
    // Aujourd'hui : la pile repliée — trois bords de carte, le premier lisible.
    return (
      <button type="button" className="j-pile is-mini" onClick={onClick} data-pile="">
        {points.slice(0, 3).map((p, i, l) => (
          <span key={p.nom} className="j-pass j-pass--bord" style={{ top: (l.length - 1 - i) * 16, transform: `scale(${1 - i * 0.05})`, filter: i ? `brightness(${1 - i * 0.18})` : undefined, zIndex: 3 - i }} data-point={p.nom}>
            {i === 0 ? <span className="j-pass-tete"><span className="j-pass-nom">{p.nom}</span><span className="j-pass-cap">{nb(p.colis.length)} colis · avant {jourCourt(new Date(p.limite).toISOString(), M.maintenant)}</span></span> : null}
          </span>
        ))}
      </button>
    );
  }
  return (
    <div className="j-pile" data-pile="">
      {derriere.map((p, i) => (
        <button key={p.nom} type="button" className="j-pass j-pass--dos" style={{ '--i': i }} onClick={() => choisir(points.indexOf(p))} data-point={p.nom}>
          <span className="j-pass-tete"><span className="j-pass-nom">{p.nom}</span><span className="j-pass-cap">{nb(p.colis.length)} colis</span></span>
        </button>
      ))}
      <PassDevant p={devant} M={M} />
    </div>
  );
}
function PassDevant({ p, M }) {
  const [i, setI] = React.useState(0);
  const ref = React.useRef(null);
  const surDefil = () => { const el = ref.current; if (el) setI(Math.round(el.scrollLeft / el.clientWidth)); };
  return (
    <div className="j-pass j-pass--devant" data-point={p.nom} data-devant="">
      <div className="j-pass-tete">
        <span className="j-pass-nom">{p.nom}</span>
        <span className="j-pass-cap">{p.adresse}</span>
      </div>
      <div className="j-pass-defile" ref={ref} onScroll={surDefil}>
        {p.colis.map((c) => {
          const lim = Date.parse(c.limite);
          return (
            <div key={c.id} className="j-pass-colis" data-code={c.code}>
              <Qr texte={c.code} t={148} />
              <div className="j-pass-code" data-chiffre="">{c.code || '—'}</div>
              <div className="j-pass-pied">
                <span className="j-pass-art">{c.art || '—'}</span>
                <span className="j-pass-cap">{lim ? 'avant ' + jourCourt(c.limite, M.maintenant) : 'date limite pas lue'}{c.carrier ? ' · ' + nomTransporteur(c.carrier) : ''}</span>
              </div>
            </div>
          );
        })}
      </div>
      {p.colis.length > 1 ? <div className="j-pass-points" aria-label={`colis ${i + 1} sur ${p.colis.length}`}>{p.colis.map((c, k) => <i key={c.id} className={k === i ? 'is-actif' : ''} />)}</div> : null}
    </div>
  );
}
const nomTransporteur = (c) => ({ chronopost: 'Chronopost', mondialrelay: 'Mondial Relay', colissimo: 'Colissimo', relaiscolis: 'Relais Colis', dpd: 'DPD', ups: 'UPS' }[str(c).toLowerCase()] || c);

function Achats({ M, P, large }) {
  const [choisi, setChoisi] = React.useState(0);
  const points = P.recevoir.points;
  const enRoute = P.recevoir.enRoute;
  return (
    <div className={'j-ecran j-achats' + (large ? ' is-large' : '')}>
      <div className="j-col">
        {points ? <PileWallet points={points} M={M} choisi={choisi} choisir={setChoisi} /> : <PasLu quoi="e-mails des transporteurs" />}
      </div>
      <div className="j-col">
        <Entete titre="En route" n={enRoute ? enRoute.length : null} />
        {enRoute ? <Liste total={enRoute.length}>{enRoute.slice(0, 40).map((a) => <Rangee key={a._tx} cle={'a' + a._tx} photo={photoDe(a.photo)} titre={a.title} sous={jourCourt(a.date, M.maintenant) + ' · ' + M.loginDe(a._uid)} droite={euros(centimes(a.price))} />)}</Liste> : <PasLu quoi="achats" />}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  ANNONCES — grille de photos (2 colonnes au téléphone) ou liste ; le chiffre de la vue en haut.
// ════════════════════════════════════════════════════════════════════════════
function Annonces({ M, P, route, aller, large }) {
  const seg = route.seg || 'enligne';
  const grille = route.vue !== 'liste';
  const paireDe = (a) => { const k = M.numParItem.get(a.id); return k ? M.paires.get(k) : null; };
  const now = M.maintenant;
  const vues = [{ cle: 'enligne', nom: 'En ligne' }, { cle: 'dorment', nom: 'Qui dorment' }, { cle: 'publier', nom: 'À publier', ambre: true }];
  let elts = null, legende = '';
  if (seg === 'publier') {
    legende = 'paires rangées à mettre en ligne';
    elts = P.publier.aPublier.map((p) => ({ cle: 'p' + p.k, photo: p.photo || str(p.fiche && p.fiche.photo), titre: p.titre, numero: p.numero, prix: p.cout != null ? euros(p.cout) : null, prixSous: p.cout != null ? 'achat' : null, meta: p.cases.length ? 'case ' + p.cases[0] : '' }));
  } else {
    const src = seg === 'dorment' ? P.publier.dorment : P.publier.enLigne;
    legende = seg === 'dorment' ? 'en ligne depuis plus de 60 jours' : 'annonces en ligne';
    elts = src ? [...src].sort((a, b) => (Date.parse(b.cree) || 0) - (Date.parse(a.cree) || 0) * (seg === 'dorment' ? -1 : 1)).map((a) => {
      const p = paireDe(a); const j = jours(a.cree, now);
      return { cle: 'a' + a.id, photo: a.photo, titre: a.title, numero: p && p.numero, prix: euros(centimes(a.price)), meta: <>{j != null ? j + ' j' : ''}{a.fav ? <><span className="j-sep" /><Ico n="coeur" t={13} />{a.fav}</> : null}</>, metaTexte: j != null ? j + ' j' : '', ambre: seg === 'dorment' };
    }) : null;
    if (seg === 'dorment' && elts) elts.reverse();
  }
  const bascule = (
    <button type="button" className="j-rond" aria-label={grille ? 'Voir en liste' : 'Voir en grille'} onClick={() => aller({ ecran: 'annonces', seg: route.seg, vue: grille ? 'liste' : '' })} data-bascule="">
      <Ico n={grille ? 'liste' : 'grille'} t={22} />
    </button>
  );
  return (
    <div className={'j-ecran' + (large ? ' is-large' : '')}>
      <Heros n={elts ? nb(elts.length) : '—'} legende={legende} />
      <Vues items={vues} actif={seg} choisir={(c) => aller({ ecran: 'annonces', seg: c, vue: route.vue })} droite={bascule} />
      {!elts ? <PasLu quoi="annonces" /> : grille ? (
        <div className="j-grille" data-grille="">
          {elts.slice(0, large ? 30 : 24).map((e) => (
            <button key={e.cle} type="button" className="j-tuile" data-ligne={e.cle}>
              <span className="j-tuile-photo"><Photo src={e.photo} rayon={22} />{e.numero ? <span className="j-tuile-plaque"><Plaque n={e.numero} /></span> : null}</span>
              <span className="j-tuile-texte">
                <span className="j-tuile-haut"><span className="j-val">{e.prix || '—'}</span>{e.meta ? <span className={'j-tuile-meta' + (e.ambre ? ' is-ambre' : '')}>{e.meta}</span> : null}</span>
                <span className="j-tuile-titre">{e.titre}</span>
              </span>
            </button>
          ))}
          {elts.length > (large ? 30 : 24) ? <button type="button" className="j-suite j-suite--grille">Afficher les {nb(elts.length - (large ? 30 : 24))} autres</button> : null}
        </div>
      ) : (
        <section className="j-groupe"><Liste total={elts.length}>{elts.slice(0, 40).map((e) => <Rangee key={e.cle} cle={e.cle} photo={e.photo} titre={e.titre} numero={e.numero} sous={e.metaTexte != null ? e.meta : e.meta} ambre={e.ambre} droite={e.prix} droiteSous={e.prixSous} />)}</Liste></section>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  ARGENT — le reçu du mois en affiche (date de VERSEMENT, 450), sa courbe, le reste calme.
// ════════════════════════════════════════════════════════════════════════════
function Courbe({ points, large }) {
  const W = large ? 560 : 358, H = 96;
  if (!points || points.length < 2) return null;
  const max = Math.max(1, ...points);
  const xy = points.map((v, i) => [(i / (points.length - 1)) * W, H - 8 - (v / max) * (H - 16)]);
  const d = xy.map(([x, y], i) => (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1)).join(' ');
  const [lx, ly] = xy[xy.length - 1];
  return (
    <svg className="j-courbe" viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="j-aire" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--j-accent)" stopOpacity=".28" /><stop offset="1" stopColor="var(--j-accent)" stopOpacity="0" /></linearGradient></defs>
      <path d={d + ` L${W} ${H} L0 ${H} Z`} fill="url(#j-aire)" />
      <path d={d} fill="none" stroke="var(--j-accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={lx} cy={ly} r="4" fill="var(--j-accent)" />
    </svg>
  );
}
function Argent({ M, P, large }) {
  const E = P.encaisser;
  const d0 = new Date(M.maintenant);
  const mois = d0.toLocaleDateString('fr-FR', { month: 'long', timeZone: 'Europe/Paris' });
  // La courbe : ce qui a été versé chaque jour du mois (date de versement), cumulé.
  const serie = React.useMemo(() => {
    if (!E.ceMois) return null;
    const n = d0.getDate(); const t = new Array(n).fill(0);
    for (const x of E.ceMois) { const j = new Date(x.le).getDate() - 1; if (j >= 0 && j < n) t[j] += centimes(x.v.price) || 0; }
    let c = 0; return t.map((v) => (c += v));
  }, [E.ceMois]);
  // Bénéfice : seulement les ventes dont le coût est saisi ; la couverture est dite à côté (« sur N »).
  const avecCout = E.ceMois ? E.ceMois.filter((x) => x.paire && x.paire.cout != null) : null;
  const benef = avecCout ? avecCout.reduce((t, x) => t + (centimes(x.v.price) || 0) - x.paire.cout, 0) : null;
  const solde = E.solde;
  const [ent, frac] = (E.recuMois == null ? '—' : euros(E.recuMois)).replace(/\s€$/, '').split(',');
  return (
    <div className={'j-ecran j-argent' + (large ? ' is-large' : '')}>
      <div className="j-col">
        <Heros n={<>{ent}{frac ? <span className="j-heros-frac">,{frac}</span> : null}</>} unite={E.recuMois == null ? null : '€'} legende={`reçu en ${mois}`}>
          <Courbe points={serie} large={large} />
        </Heros>
        <div className="j-trois" data-trois="">
          <div><span className="j-val">{solde ? euros(solde.dispo) : '—'}</span><span className="j-cap">disponible</span></div>
          <div><span className="j-val">{solde ? euros(solde.attente) : '—'}</span><span className="j-cap">en attente</span></div>
          <div><span className="j-val">{benef == null ? '—' : (avecCout.length < E.ceMois.length ? 'au moins ' : '') + euros(benef, { signe: true })}</span><span className="j-cap">bénéfice · {avecCout ? `${nb(avecCout.length)} sur ${nb(E.ceMois.length)}` : '—'}</span></div>
        </div>
      </div>
      <div className="j-col">
        <Entete titre="Versements" n={E.ceMois ? E.ceMois.length : null} />
        {E.versees ? <Liste total={E.versees.length}>{E.versees.slice(0, 40).map((x) => <Rangee key={x.v._tx} cle={'r' + x.v._tx} photo={(x.paire && x.paire.photo) || photoDe(x.v.photo)} titre={x.v.title} numero={x.paire && x.paire.numero}
          sous={jourCourt(x.le, M.maintenant)} droite={euros(centimes(x.v.price))} droiteSous={x.paire && x.paire.cout != null ? euros((centimes(x.v.price) || 0) - x.paire.cout, { signe: true }) : 'coût —'} />)}</Liste> : <PasLu quoi="versements" />}
      </div>
    </div>
  );
}

// ── Le geste de chaque écran : UN plein, au pouce ───────────────────────────────
function gesteDe(ecran, P, route) {
  if (ecran === 'journee' || ecran === 'ventes') { const n = P.poster.aImprimer ? P.poster.aImprimer.length : null; return n ? { mot: `Imprimer ${n} bordereaux`, ico: 'imprimante' } : null; }
  if (ecran === 'achats') return P.recevoir.points && P.recevoir.points.length ? { mot: 'Montrer au comptoir', ico: 'plein' } : null;
  if (ecran === 'annonces') { const n = P.publier.aPublier.length; return route.seg === 'publier' || n ? { mot: `Publier ${n} paires`, ico: 'plus' } : null; }
  if (ecran === 'argent') { const n = P.encaisser.sansCout.length; return n ? { mot: `Saisir ${n} prix d’achat`, ico: 'stylo' } : null; }
  return null;
}
const ECRAN = { journee: Journee, ventes: Ventes, achats: Achats, annonces: Annonces, argent: Argent };

export default function Premium() {
  const [M, setM] = React.useState(undefined);
  const [route, aller] = useRoute();
  const large = useLarge();
  React.useEffect(() => {
    const d = document.documentElement; d.setAttribute('data-maquette', 'j');
    // Sombre profond PAR DÉFAUT ; clair seulement si l'appareil a CHOISI le clair.
    let sombre = true; try { if (localStorage.getItem('vinted_dark') === 'false') sombre = false; } catch (_) {}
    d.setAttribute('data-theme', sombre ? 'dark' : 'light');
  }, []);
  React.useEffect(() => { lireDonnees().then(setM, () => setM(null)); }, []);
  React.useEffect(() => { if (M !== undefined) finDemarrage('maquette-j'); }, [M]);
  if (M === undefined) return <div className="j-racine j-attente" />;
  if (M === null || !M.postes) return <div className="j-racine"><div className="j-vide">— · base pas lue</div></div>;
  const P = M.postes;
  const e = ECRANS.find((x) => x.cle === route.ecran) || ECRANS[0];
  const Ecran = ECRAN[e.cle];
  const g = gesteDe(e.cle, P, route);
  const ambreDe = { ventes: !!(P.poster.envoyer && P.poster.envoyer.length), achats: !!(P.recevoir.aRetirer && P.recevoir.aRetirer.length), annonces: P.publier.aPublier.length > 0, argent: P.encaisser.sansCout.length > 0 };
  const Geste = g ? <button type="button" className="j-geste" data-plein=""><Ico n={g.ico} t={22} /><span>{g.mot}</span></button> : null;
  return (
    <div className={'j-racine' + (large ? ' is-large' : '')} data-ecran={e.cle}>
      <span className="j-ciel" aria-hidden="true" />
      {large ? (
        <aside className="j-cote">
          <div className="j-marque">VRM</div>
          <button type="button" className="j-champ"><Ico n="loupe" t={20} /><span>N°, pseudo, suivi, code</span></button>
          <nav className="j-nav-cote">
            {ECRANS.map((x) => (
              <button key={x.cle} type="button" className="j-nav-item" aria-current={x.cle === e.cle ? 'page' : undefined} onClick={() => aller({ ecran: x.cle })} data-nav={x.cle}>
                <Ico n={x.ico} t={22} /><span>{x.nom}</span>{ambreDe[x.cle] ? <i className="j-point" aria-label="à faire" /> : null}
              </button>
            ))}
          </nav>
        </aside>
      ) : null}
      <main className="j-main">
        <header className="j-tete">
          <h1 className="j-titre">{e.nom}</h1>
          <span className="j-tete-d">
            {large ? Geste : null}
            <button type="button" className="j-rond" aria-label="Comment ça marche"><Ico n="aide" t={22} /></button>
            {!large ? <button type="button" className="j-rond" aria-label="Chercher"><Ico n="loupe" t={22} /></button> : null}
          </span>
        </header>
        <Ecran M={M} P={P} route={route} aller={aller} large={large} />
      </main>
      {!large ? (
        <>
          {Geste ? <div className="j-geste-zone">{Geste}</div> : null}
          <nav className="j-barre" aria-label="Écrans">
            {ECRANS.map((x) => (
              <button key={x.cle} type="button" className="j-onglet" aria-current={x.cle === e.cle ? 'page' : undefined} onClick={() => aller({ ecran: x.cle })} data-onglet={x.cle}>
                <span className="j-onglet-i"><Ico n={x.ico} t={26} />{ambreDe[x.cle] ? <i className="j-point j-onglet-point" /> : null}</span>
                <span className="j-onglet-nom">{x.nom}</span>
              </button>
            ))}
          </nav>
        </>
      ) : null}
    </div>
  );
}
