// ════════════════════════════════════════════════════════════════════════════
//  MAQUETTE I — « L'ÉPURE » (17 nov.) — un PROTOTYPE à montrer, pas livré.
//  Monté seulement si `localStorage.vrm_banc_maquette === 'i'` (posé par le banc
//  scripts/bancs/maquette-i.cjs ; aucun bouton de l'app ne le pose : invisible pour Julien).
//
//  Inspirée de Things 3, Rappels, iA Writer : la TYPOGRAPHIE porte tout. Trois tailles par
//  écran (34 fin · 17 · 13), aucune carte ni bordure, des listes séparées par l'espace seul,
//  une puce de 6 px pour l'état (ambre = un geste t'attend, creuse = ça attend quelqu'un
//  d'autre), le N° du carton en colonne comme dans un registre, UN bouton plein en bas
//  (le seul bleu de l'écran), les gestes secondaires dans un appui long → une feuille.
//  Données : le modèle de la maquette H/F (donnees.js, postes.js), mêmes identités (§5) :
//  N° par l'id de SON annonce, vente par item_id, bordereau par n° de transaction.
//  Textes en français seulement (prototype) : à passer par tr() s'il est retenu.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import qrcode from 'qrcode-generator';
import { lireDonnees, euros, jourCourt } from './donnees.js';
import { centimes } from '../../rechercheUnique.js';
import { finDemarrage } from '../../demarrage.js';
import './epure.css';

const J = 86400000;
const ECRANS = [
  { cle: 'jour', nom: 'Aujourd’hui' },
  { cle: 'ventes', nom: 'Ventes' },
  { cle: 'achats', nom: 'Achats' },
  { cle: 'annonces', nom: 'Annonces' },
  { cle: 'argent', nom: 'Argent' },
];
const nb = (n) => (n == null ? '—' : Number(n).toLocaleString('fr-FR'));
const str = (v) => String(v == null ? '' : v);

// ── Route (dans le hash : l'écran, la vue, la feuille ouverte) ──────────────
const lireRoute = () => { const p = new URLSearchParams((window.location.hash || '').replace(/^#/, '')); return { ecran: p.get('ecran') || 'jour', vue: p.get('vue') || '', feuille: p.get('feuille') || '' }; };
function useRoute() {
  const [r, setR] = React.useState(lireRoute);
  React.useEffect(() => { const f = () => setR(lireRoute()); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  const aller = (x) => { const p = new URLSearchParams(); for (const k of ['ecran', 'vue', 'feuille']) if (x[k]) p.set(k, x[k]); window.location.hash = p.toString(); };
  return [r, aller];
}
function useLarge() {
  const mq = '(min-width: 1100px)';
  const [l, setL] = React.useState(() => window.matchMedia(mq).matches);
  React.useEffect(() => { const m = window.matchMedia(mq); const f = () => setL(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  return l;
}

// ── Icônes : un trait de 1,5, dessinées ici ─────────────────────────────────
const TRAITS = {
  loupe: <><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 5 5" /></>,
  reglages: <><circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" /></>,
  bas: <path d="m7 10 5 5 5-5" />,
  croix: <path d="M6 6l12 12M18 6 6 18" />,
};
const Ico = ({ n, t = 22 }) => <svg className="e-ico" width={t} height={t} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{TRAITS[n]}</svg>;

// Un VRAI QR du code de retrait (qrcode-generator, déjà dans l'app).
function Qr({ texte, t }) {
  const svg = React.useMemo(() => {
    const q = qrcode(0, 'M'); q.addData(str(texte)); q.make();
    const n = q.getModuleCount(); let d = '';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) d += `M${x} ${y}h1v1h-1z`;
    return { n, d };
  }, [texte]);
  return <svg className="e-qr" width={t} height={t} viewBox={`-2 -2 ${svg.n + 4} ${svg.n + 4}`} shapeRendering="crispEdges" aria-hidden="true"><path d={svg.d} fill="currentColor" /></svg>;
}

// ── L'appui long : 450 ms sous le doigt (ou clic droit) ouvre la feuille des gestes ──
function useAppuiLong(ouvrir) {
  const t = React.useRef(null);
  const fin = () => { clearTimeout(t.current); t.current = null; };
  return {
    onPointerDown: (e) => { if (e.button > 0) return; fin(); t.current = setTimeout(() => { t.current = null; ouvrir(); }, 450); },
    onPointerUp: fin, onPointerLeave: fin, onPointerCancel: fin,
    onContextMenu: (e) => { e.preventDefault(); fin(); ouvrir(); },
  };
}

// ── Pièces ──────────────────────────────────────────────────────────────────
// Puce d'état : `geste` (ambre : à toi de jouer) · `attente` (creuse : un autre doit agir) · `rien`.
const Puce = ({ e }) => <span className={'e-puce is-' + (e || 'rien')} aria-hidden="true" />;

// Une rangée de registre : puce · N° · titre (jusqu'à 2 lignes, jamais coupé) + détail · valeur.
function Rangee({ etat, num, titre, detail, valeur, valeurDetail, onTouche, appuiLong, sansNum }) {
  const long = useAppuiLong(appuiLong || (() => {}));
  return (
    <button type="button" className="e-rangee" onClick={onTouche} {...(appuiLong ? long : {})} data-rangee="">
      <Puce e={etat} />
      {sansNum ? null : <span className={'e-num' + (num ? '' : ' is-vide')}>{num || '—'}</span>}
      <span className="e-corps">
        <span className="e-titre">{titre}</span>
        {detail ? <span className="e-detail">{detail}</span> : null}
      </span>
      {valeur != null ? <span className="e-valeur">{valeur}{valeurDetail ? <span className="e-detail">{valeurDetail}</span> : null}</span> : null}
    </button>
  );
}
const Groupe = ({ nom, a, children }) => (
  <section className="e-groupe">
    {nom ? <h2 className="e-entete"><span>{nom}</span>{a ? <span className="e-entete-a">{a}</span> : null}</h2> : null}
    <div className="e-liste">{children}</div>
  </section>
);
const Plus = ({ n }) => (n > 0 ? <p className="e-plus">et {nb(n)} de plus</p> : null);

// Les vues d'un écran : des mots, l'actif à l'encre, les autres en gris. Pas de capsule.
function Vues({ vues, actif, choisir }) {
  return (
    <nav className="e-vues" aria-label="Vues">
      {vues.map((v) => (
        <button key={v.cle} type="button" className="e-vue" aria-pressed={v.cle === actif} onClick={() => choisir(v.cle)}>
          {v.nom}{v.n != null ? <span className="e-vue-n">{nb(v.n)}</span> : null}
        </button>
      ))}
    </nav>
  );
}

// ── Les dates : une limite LUE se dit « avant … » ; vente + 7 j n'est qu'une ESTIMATION ──
const avant = (t, M) => { const j = jourCourt(new Date(t).toISOString(), M.maintenant); return j === 'aujourd’hui' ? 'avant ce soir' : j === 'demain' ? 'avant demain soir' : 'avant ' + j; };
const jourDe = (t) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
function grouper(lignes, cle) {
  const g = new Map();
  for (const l of lignes) { const k = cle(l); if (!g.has(k)) g.set(k, []); g.get(k).push(l); }
  return [...g.entries()];
}

// ════════════════════════════ LES ÉCRANS ════════════════════════════
function Aujourdhui({ M, aller }) {
  const P = M.postes;
  const env = P.poster.envoyer || [];
  const premier = env.find((l) => l.limite);
  const points = P.recevoir.points || [];
  const offres = M.offres || [];
  const arrives = P.recevoir.arrives || [];
  const sansCout = P.encaisser.sansCout || [];
  const routeVentes = (M.ventes || []).filter((v) => str(v.transaction_user_status) !== 'needs_action' && !/finalis|annul|rembours/i.test(str(v.status)));
  const enRoute = P.recevoir.enRoute;
  const f = ventesDuMois(M);
  return (
    <>
      <Groupe nom="À faire">
        <Rangee sansNum etat="geste" titre="Envoyer" valeur={nb(env.length)} detail={premier ? `le premier ${avant(premier.limite, M)}` : 'aucune date limite lue'} onTouche={() => aller({ ecran: 'ventes' })} />
        <Rangee sansNum etat={points.length ? 'geste' : 'rien'} titre="Retirer" valeur={nb(P.recevoir.aRetirer ? P.recevoir.aRetirer.length : null)} detail={points.length ? `${points[0].nom} ${avant(points[0].limite, M)}` : 'rien au point relais'} onTouche={() => aller({ ecran: 'achats' })} />
        <Rangee sansNum etat={offres.length ? 'geste' : 'rien'} titre="Répondre aux offres" valeur={nb(offres.length)} detail={offres[0] ? `${euros(offres[0].montant)} pour ${offres[0].titre}` : null} onTouche={() => {}} />
        <Rangee sansNum etat={arrives.length ? 'geste' : 'rien'} titre="Numéroter les achats arrivés" valeur={nb(arrives.length)} onTouche={() => aller({ ecran: 'achats', vue: 'arrives' })} />
        <Rangee sansNum etat={sansCout.length ? 'geste' : 'rien'} titre="Saisir les prix d’achat" valeur={nb(sansCout.length)} detail="pour compter le bénéfice" onTouche={() => aller({ ecran: 'argent' })} />
      </Groupe>
      <Groupe nom="Ça avance sans toi">
        <Rangee sansNum etat="attente" titre="Colis vers tes acheteurs" valeur={nb(routeVentes.length)} onTouche={() => aller({ ecran: 'ventes', vue: 'route' })} />
        <Rangee sansNum etat="attente" titre="Achats en route vers toi" valeur={nb(enRoute ? enRoute.length : null)} onTouche={() => aller({ ecran: 'achats', vue: 'route' })} />
      </Groupe>
      <Groupe nom="Novembre">
        <Rangee sansNum titre="Vendu" valeur={euros(f.vendu)} detail={`${nb(f.n)} ventes`} onTouche={() => aller({ ecran: 'argent' })} />
        <Rangee sansNum titre="Reçu" valeur={euros(P.encaisser.recuMois)} detail="daté au jour du versement" onTouche={() => aller({ ecran: 'argent' })} />
      </Groupe>
    </>
  );
}
function ventesDuMois(M) {
  const d0 = new Date(M.maintenant); const debut = new Date(d0.getFullYear(), d0.getMonth(), 1).getTime();
  const l = (M.ventes || []).filter((v) => (Date.parse(v.date) || 0) >= debut && !/annul|rembours/i.test(str(v.status)));
  return { n: l.length, vendu: M.ventes ? l.reduce((t, v) => t + (centimes(v.price) || 0), 0) : null };
}

function Ventes({ M, vue, aller, feuille }) {
  const env = M.postes.poster.envoyer || [];
  const route = (M.ventes || []).filter((v) => str(v.transaction_user_status) !== 'needs_action' && !/finalis|annul|rembours/i.test(str(v.status)));
  const toutes = [...(M.ventes || [])].sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
  const v = vue || 'envoyer';
  const numDe = (o) => { const k = M.numParItem.get(str(o._item)); return k ? M.paires.get(k).numero : ''; };
  const vues = <Vues actif={v} choisir={(c) => aller({ ecran: 'ventes', vue: c })} vues={[{ cle: 'envoyer', nom: 'À envoyer', n: env.length }, { cle: 'route', nom: 'En route' }, { cle: 'toutes', nom: 'Toutes' }]} />;
  let corps;
  if (v === 'envoyer') {
    // Deux groupes : ce qui peut partir (bordereau reçu) et ce qui attend Vinted. La date limite, à droite.
    const prets = env.filter((l) => l.bord), attente = env.filter((l) => !l.bord);
    const rangee = (l) => (
      <Rangee key={l.cle} etat={l.bord ? 'geste' : 'attente'} num={l.paire && l.paire.numero} titre={l.v.title}
        detail={[l.pseudo, l.compte].filter(Boolean).join(' · ')}
        valeur={euros(centimes(l.v.price))} valeurDetail={l.limite ? jourCourt(new Date(l.limite).toISOString(), M.maintenant) : 'vers ' + jourCourt(new Date(l.estimee).toISOString(), M.maintenant)}
        appuiLong={() => feuille('vente:' + l.v._tx)} onTouche={() => {}} />
    );
    corps = <>
      {prets.length ? <Groupe nom="Prêts à imprimer">{prets.map(rangee)}</Groupe> : null}
      {attente.length ? <Groupe nom="Bordereau pas encore reçu" a={nb(attente.length)}>{attente.map(rangee)}</Groupe> : null}
    </>;
  } else {
    const ls = v === 'route' ? route : toutes;
    corps = (
      <Groupe>
        {ls.slice(0, 40).map((o) => (
          <Rangee key={o._tx} etat={v === 'route' ? 'attente' : 'rien'} num={numDe(o)} titre={o.title} detail={[jourCourt(o.date, M.maintenant), M.loginDe(o._uid)].filter(Boolean).join(' · ')} valeur={euros(centimes(o.price))} onTouche={() => {}} />
        ))}
        <Plus n={ls.length - 40} />
      </Groupe>
    );
  }
  return <>{vues}{corps}</>;
}

function Achats({ M, vue, aller, feuille }) {
  const R = M.postes.recevoir;
  const v = vue || 'retirer';
  const vues = <Vues actif={v} choisir={(c) => aller({ ecran: 'achats', vue: c })} vues={[{ cle: 'retirer', nom: 'À retirer', n: R.aRetirer ? R.aRetirer.length : null }, { cle: 'route', nom: 'En route' }, { cle: 'arrives', nom: 'Arrivés' }]} />;
  let corps;
  if (v === 'retirer') {
    corps = (R.points || []).map((p) => (
      <section key={p.nom} className="e-groupe e-point">
        <h2 className="e-point-nom">{p.nom}</h2>
        <p className="e-point-ou">{p.adresse} · <span className="e-ambre">{avant(p.limite, M)}</span></p>
        <div className="e-liste">
          {p.colis.map((c) => (
            <button key={c.id} type="button" className="e-rangee e-colis" onClick={() => feuille('codes:' + c.id)} data-rangee="">
              <Puce e="geste" />
              <span className="e-corps"><span className="e-code">{c.code.replace(/(\d{3})(?=\d)/g, '$1 ')}</span><span className="e-detail">{c.art}</span></span>
              <Qr texte={c.code} t={36} />
            </button>
          ))}
        </div>
      </section>
    ));
  } else if (v === 'route') {
    const ls = R.enRoute || [];
    corps = <Groupe>{ls.slice(0, 40).map((a) => <Rangee key={a._tx} sansNum etat="attente" titre={a.title} detail={[`acheté ${jourCourt(a.date, M.maintenant)}`, M.loginDe(a._uid)].filter(Boolean).join(' · ')} valeur={euros(centimes(a.price))} onTouche={() => {}} />)}<Plus n={ls.length - 40} /></Groupe>;
  } else {
    const ls = R.arrives || [];
    corps = <Groupe nom="À numéroter">{ls.map((a) => <Rangee key={a._tx} sansNum etat="geste" titre={a.title} detail={[`arrivé ${jourCourt(a.date, M.maintenant)}`, M.loginDe(a._uid)].filter(Boolean).join(' · ')} valeur={euros(centimes(a.price))} onTouche={() => {}} />)}</Groupe>;
  }
  return <>{vues}{corps}</>;
}

function Annonces({ M, vue, aller, feuille }) {
  const Pb = M.postes.publier;
  const v = vue || 'enligne';
  const vues = <Vues actif={v} choisir={(c) => aller({ ecran: 'annonces', vue: c })} vues={[{ cle: 'enligne', nom: 'En ligne', n: Pb.enLigne ? Pb.enLigne.length : null }, { cle: 'dorment', nom: 'Qui dorment' }, { cle: 'sansnum', nom: 'Sans N°' }]} />;
  const ls = (v === 'dorment' ? Pb.dorment : v === 'sansnum' ? Pb.sansNumero : [...(Pb.enLigne || [])].sort((a, b) => (Date.parse(b.cree) || 0) - (Date.parse(a.cree) || 0))) || [];
  const numDe = (a) => { const k = M.numParItem.get(a.id); return k ? M.paires.get(k).numero : ''; };
  const jours = (a) => (a.cree ? Math.max(0, Math.round((M.maintenant - Date.parse(a.cree)) / J)) : null);
  return (
    <>
      {vues}
      <label className="e-cherche"><Ico n="loupe" t={18} /><input type="search" placeholder="N°, titre, taille" aria-label="Chercher une annonce" enterKeyHint="search" /></label>
      {grouper(ls.slice(0, 40), (a) => a.uid).map(([uid, g]) => (
        // Le compte, une fois, dans l'en-tête du groupe — jamais répété sur chaque rangée.
        <Groupe key={uid} nom={M.loginDe(uid) || 'Compte pas lu'}>
          {g.map((a) => {
            const j = jours(a);
            return (
              <Rangee key={a.id} etat={!numDe(a) || (j != null && j > 60) ? 'geste' : 'rien'} num={numDe(a)} titre={a.title}
                detail={[j == null ? null : j === 0 ? 'en ligne aujourd’hui' : `${j} j en ligne`, a.fav ? `${a.fav} favoris` : null].filter(Boolean).join(' · ')}
                valeur={euros(centimes(a.price))} appuiLong={() => feuille('annonce:' + a.id)} onTouche={() => {}} />
            );
          })}
        </Groupe>
      ))}
      <Plus n={ls.length - 40} />
    </>
  );
}

function Argent({ M }) {
  const E = M.postes.encaisser;
  const f = ventesDuMois(M);
  const vers = (E.versees || []).slice(0, 12);
  return (
    <>
      <div className="e-affiche">
        <p className="e-affiche-n">{euros(E.recuMois)}</p>
        <p className="e-detail">reçu en novembre, daté au jour du versement</p>
      </div>
      <Groupe>
        <Rangee sansNum titre="Vendu en novembre" valeur={euros(f.vendu)} detail={`${nb(f.n)} ventes, toutes plateformes`} onTouche={() => {}} />
        <Rangee sansNum titre="Disponible sur Vinted" valeur={E.solde ? euros(E.solde.dispo) : '—'} onTouche={() => {}} />
        <Rangee sansNum etat="attente" titre="En attente" valeur={E.solde ? euros(E.solde.attente) : '—'} detail="versé quand l’acheteur confirme" onTouche={() => {}} />
        <Rangee sansNum etat={E.sansCout.length ? 'geste' : 'rien'} titre="Bénéfice" valeur="—" detail={E.sansCout.length ? `${nb(E.sansCout.length)} prix d’achat manquants sur ${nb(E.vendues)}` : null} onTouche={() => {}} />
        <Rangee sansNum etat="geste" titre="URSSAF" valeur="—" detail="choisis ton statut" onTouche={() => {}} />
      </Groupe>
      <Groupe nom="Derniers versements">
        {vers.map((x) => <Rangee key={x.v._tx} num={x.paire && x.paire.numero} titre={x.v.title} detail={`versé ${jourCourt(x.le, M.maintenant)}`} valeur={euros(centimes(x.v.price))} onTouche={() => {}} />)}
      </Groupe>
    </>
  );
}

// ════════════════════════════ LES FEUILLES ════════════════════════════
function Feuille({ titre, fermer, children, large, volet }) {
  // Sur l'ordinateur, les gestes secondaires ne se cachent pas : ils tiennent dans le VOLET de droite.
  if (volet) return <aside className="e-volet" aria-label={titre}>{children}</aside>;
  React.useEffect(() => { const f = (e) => { if (e.key === 'Escape') fermer(); }; window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f); }, [fermer]);
  return (
    <div className={'e-voile' + (large ? ' is-large' : '')} onClick={fermer}>
      <div className="e-feuille" role="dialog" aria-modal="true" aria-label={titre} onClick={(e) => e.stopPropagation()}>
        <span className="e-poignee" aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}
function FeuilleAnnonce({ M, id, fermer, large, volet }) {
  const a = M.items.get(id); if (!a) return null;
  const k = M.numParItem.get(id); const p = k ? M.paires.get(k) : null;
  const GESTES = ['Baisser le prix', 'Republier', 'Mettre en pause', 'Ouvrir sur Vinted', 'Copier le lien'];
  return (
    <Feuille titre={a.title} fermer={fermer} large={large} volet={volet}>
      <div className="e-f-tete">
        {a.photo ? <img className="e-f-photo" src={a.photo} alt="" width="64" height="64" /> : <span className="e-f-photo" />}
        <span className="e-corps"><span className="e-titre">{a.title}</span><span className="e-detail">{[p ? `N° ${p.numero}` : 'sans N°', p && p.cases.length ? `case ${p.cases[0]}` : null, euros(centimes(a.price))].filter(Boolean).join(' · ')}</span></span>
      </div>
      <div className="e-liste e-f-gestes">
        {GESTES.map((g) => <button key={g} type="button" className="e-f-geste">{g}</button>)}
        <button type="button" className="e-f-geste">Tout sur le N° {p ? p.numero : '—'}</button>
      </div>
    </Feuille>
  );
}
function FeuilleVente({ M, tx, fermer, large, volet }) {
  const l = (M.postes.poster.envoyer || []).find((x) => x.v._tx === tx); if (!l) return null;
  const p = l.paire;
  const GESTES = [l.bord ? 'Imprimer le bordereau' : null, 'Écrire à ' + (l.pseudo || 'l’acheteur'), 'Ouvrir sur Vinted', `Tout sur le N° ${p ? p.numero : '—'}`].filter(Boolean);
  return (
    <Feuille titre={l.v.title} fermer={fermer} large={large} volet={volet}>
      <div className="e-f-tete">
        {p && p.photo ? <img className="e-f-photo" src={p.photo} alt="" width="64" height="64" /> : <span className="e-f-photo" />}
        <span className="e-corps"><span className="e-titre">{l.v.title}</span><span className="e-detail">{[p ? `N° ${p.numero}` : 'sans N°', p && p.cases.length ? `case ${p.cases[0]}` : null, euros(centimes(l.v.price))].filter(Boolean).join(' · ')}</span></span>
      </div>
      <p className="e-detail e-f-ligne">{l.limite ? <span className="e-ambre">À envoyer {avant(l.limite, M)}</span> : `Date limite pas lue · vers ${jourCourt(new Date(l.estimee).toISOString(), M.maintenant)}`}{l.bord && l.bord.suivi ? ` · suivi ${l.bord.suivi}` : ''}</p>
      <div className="e-liste e-f-gestes">{GESTES.map((g) => <button key={g} type="button" className="e-f-geste">{g}</button>)}</div>
    </Feuille>
  );
}
function FeuilleCodes({ M, id, fermer, large, volet }) {
  const tous = M.postes.recevoir.aRetirer || [];
  const [i, setI] = React.useState(Math.max(0, tous.findIndex((c) => c.id === id)));
  const c = tous[i]; if (!c) return null;
  const lieu = (c.lieu || '').split('\n');
  return (
    <Feuille titre="Codes de retrait" fermer={fermer} large={large} volet={volet}>
      <div className="e-f-code">
        <Qr texte={c.code} t={216} />
        <p className="e-affiche-n e-code-grand">{c.code.replace(/(\d{3})(?=\d)/g, '$1 ')}</p>
        <p className="e-titre">{c.art}</p>
        <p className="e-detail">{lieu[0]} · <span className="e-ambre">{avant(Date.parse(c.limite), M)}</span></p>
      </div>
      <div className="e-f-pas">
        <button type="button" className="e-f-geste" disabled={i === 0} onClick={() => setI(i - 1)}>Précédent</button>
        <span className="e-detail">{i + 1} sur {tous.length}</span>
        <button type="button" className="e-f-geste" disabled={i === tous.length - 1} onClick={() => setI(i + 1)}>Suivant</button>
      </div>
    </Feuille>
  );
}

// ════════════════════════════ LA RACINE ════════════════════════════
const GESTE = {
  jour: (M) => { const n = (M.postes.poster.aImprimer || []).length; return n ? `Imprimer ${n} bordereaux` : null; },
  ventes: (M) => { const n = (M.postes.poster.aImprimer || []).length; return n ? `Imprimer ${n} bordereaux` : null; },
  achats: (M) => { const n = (M.postes.recevoir.aRetirer || []).length; return n ? `Montrer les ${n} codes` : null; },
  annonces: (M) => { const n = (M.postes.publier.aPublier || []).length; return n ? `Publier ${n} paires rangées` : null; },
  argent: (M) => { const n = (M.postes.encaisser.sansCout || []).length; return n ? `Saisir ${n} prix d’achat` : null; },
};
const aFaire = (M, cle) => {
  const P = M.postes;
  if (cle === 'jour') return 0;
  if (cle === 'ventes') return (P.poster.aImprimer || []).length;
  if (cle === 'achats') return (P.recevoir.aRetirer || []).length + (P.recevoir.arrives || []).length;
  if (cle === 'annonces') return (P.publier.aPublier || []).length;
  return P.encaisser.sansCout.length;
};

export default function Epure() {
  const [M, setM] = React.useState(undefined);
  const [route, aller] = useRoute();
  const large = useLarge();
  React.useEffect(() => {
    const d = document.documentElement; d.setAttribute('data-maquette', 'i');
    let sombre = null; try { const v = localStorage.getItem('vinted_dark'); if (v === 'true') sombre = true; else if (v === 'false') sombre = false; } catch (_) {}
    if (sombre == null) sombre = window.matchMedia('(prefers-color-scheme: dark)').matches;
    d.setAttribute('data-theme', sombre ? 'dark' : 'light');
    try { if (localStorage.getItem('vrm_banc_fond') === 'bleu') d.setAttribute('data-fond', 'bleu'); } catch (_) {}
  }, []);
  React.useEffect(() => { lireDonnees().then(setM, () => setM(null)); }, []);
  React.useEffect(() => { if (M !== undefined) finDemarrage('maquette-i'); }, [M]);
  if (M === undefined) return <div className="e-racine e-attente" />;
  if (M === null || !M.postes) return <div className="e-racine"><p className="e-detail e-panne">— · la base n’a pas répondu</p></div>;
  const ecran = ECRANS.find((e) => e.cle === route.ecran) || ECRANS[0];
  const geste = GESTE[ecran.cle](M);
  const ouvrir = (f) => aller({ ...route, feuille: f });
  const fermer = () => aller({ ...route, feuille: '' });
  const props = { M, vue: route.vue, aller, feuille: ouvrir };
  const Corps = { jour: Aujourdhui, ventes: Ventes, achats: Achats, annonces: Annonces, argent: Argent }[ecran.cle];
  const date = new Date(M.maintenant).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' });
  const [fT, fId] = route.feuille.split(/:(.*)/s);
  let volet = null;
  if (large) {
    const P = M.postes;
    if (ecran.cle === 'ventes') { const l = (P.poster.aImprimer || [])[0]; const tx = fT === 'vente' ? fId : l && l.v._tx; if (tx) volet = <FeuilleVente M={M} tx={tx} volet />; }
    if (ecran.cle === 'achats') { const c = (P.recevoir.aRetirer || [])[0]; volet = <FeuilleCodes key={fId || ''} M={M} id={fT === 'codes' ? fId : c && c.id} volet />; }
    if (ecran.cle === 'annonces') { const a = (P.publier.enLigne || []).find((x) => M.numParItem.has(x.id)); const id = fT === 'annonce' ? fId : a && a.id; if (id) volet = <FeuilleAnnonce M={M} id={id} volet />; }
  }
  return (
    <div className={'e-racine' + (large ? ' is-large' : '') + (large && volet ? ' a-volet' : '')} data-ecran={ecran.cle}>
      {large ? (
        <aside className="e-cote">
          <p className="e-marque">VRM</p>
          <label className="e-cherche e-cherche--cote"><Ico n="loupe" t={18} /><input type="search" placeholder="Chercher" aria-label="Chercher partout" /></label>
          <nav className="e-cote-nav">
            {ECRANS.map((e) => (
              <button key={e.cle} type="button" className="e-cote-lien" aria-current={e.cle === ecran.cle ? 'page' : undefined} onClick={() => aller({ ecran: e.cle })}>
                <span>{e.nom}</span>{aFaire(M, e.cle) ? <Puce e="geste" /> : null}
              </button>
            ))}
          </nav>
          <button type="button" className="e-cote-lien e-cote-pied"><span>Réglages</span></button>
        </aside>
      ) : null}
      <main className="e-main">
        <header className="e-tete">
          <h1 className="e-h1">{ecran.nom}</h1>
          {large ? null : (
            <div className="e-tete-ronds">
              <button type="button" className="e-rond" aria-label="Chercher"><Ico n="loupe" /></button>
              {ecran.cle === 'jour' ? <button type="button" className="e-rond" aria-label="Réglages"><Ico n="reglages" /></button> : null}
            </div>
          )}
        </header>
        {ecran.cle === 'jour' ? <p className="e-sous">{date}</p>
          : ecran.cle === 'argent' ? null
            : <button type="button" className="e-sous e-filtre" onClick={() => ouvrir('comptes')}>Tous les comptes · toutes les plateformes<Ico n="bas" t={16} /></button>}
        <div className="e-page"><Corps {...props} /></div>
        {geste ? <div className="e-pied"><button type="button" className="e-plein" data-plein="" onClick={() => (ecran.cle === 'achats' ? ouvrir('codes:') : null)}>{geste}</button></div> : null}
      </main>
      {large && volet ? volet : null}
      {large ? null : (
        <nav className="e-barre" aria-label="Écrans">
          {ECRANS.map((e) => (
            <button key={e.cle} type="button" className="e-onglet" aria-current={e.cle === ecran.cle ? 'page' : undefined} onClick={() => aller({ ecran: e.cle })}>
              {e.nom}
            </button>
          ))}
        </nav>
      )}
      {fT === 'annonce' && !large ? <FeuilleAnnonce M={M} id={fId} fermer={fermer} large={large} /> : null}
      {fT === 'codes' && !large ? <FeuilleCodes M={M} id={fId} fermer={fermer} large={large} /> : null}
      {fT === 'vente' && !large ? <FeuilleVente M={M} tx={fId} fermer={fermer} large={large} /> : null}
      {fT === 'comptes' ? (
        <Feuille titre="Comptes" fermer={fermer} large={large}>
          <p className="e-titre e-f-titre">Montrer</p>
          <div className="e-liste e-f-gestes">
            <button type="button" className="e-f-geste" aria-pressed="true">Tous les comptes</button>
            {(M.comptes || []).map((c) => <button key={c.uid} type="button" className="e-f-geste">{c.login}</button>)}
          </div>
        </Feuille>
      ) : null}
    </div>
  );
}
