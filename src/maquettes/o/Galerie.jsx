// ════════════════════════════════════════════════════════════════════════════
//  MAQUETTE O — « GALERIE » (17 nov.) — un PROTOTYPE à montrer, pas livré.
//  Monté seulement si `localStorage.vrm_banc_maquette === 'o'` (posé par le banc
//  scripts/bancs/maquette-o.cjs ; aucun bouton de l'app ne le pose : invisible pour Julien).
//
//  L'idée : ce sont des chaussures, la PHOTO est l'identité visuelle. Annonces en grille
//  de vignettes (3 colonnes iPhone, 6 ordinateur) ; le N° posé en petite étiquette SUR la
//  photo, le prix dessous ; un appui = la fiche plein écran, photo en haut, gestes en bas.
//  Ventes et Achats en liste à grande photo ; Ma journée = 3 chiffres + les paires à poster.
//  Trois tailles de texte par écran (34 · 15 · 12), un seul bouton plein, aucune phrase
//  d'explication à l'écran. Textes en français seulement (prototype) : tr() s'il est retenu.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import qrcode from 'qrcode-generator';
import { lireDonnees, galerie, euros } from './donnees.js';
import { finDemarrage } from '../../demarrage.js';
import './galerie.css';

const J = 86400000;
const ECRANS = [['journee', 'Ma journée', 'Journée'], ['annonces', 'Annonces', 'Annonces'], ['ventes', 'Ventes', 'Ventes'], ['achats', 'Achats', 'Achats'], ['argent', 'Argent', 'Argent']];

// ── La route vit dans l'adresse : #e=annonces&f=a:123&s=route
const lireRoute = () => { const p = new URLSearchParams((window.location.hash || '').replace(/^#/, '')); return { e: p.get('e') || 'journee', f: p.get('f') || '', s: p.get('s') || '', q: p.get('q') || '' }; };
function useRoute() {
  const [r, setR] = React.useState(lireRoute);
  React.useEffect(() => { const f = () => setR(lireRoute()); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  const aller = (x) => { const n = { ...r, ...x }; const p = new URLSearchParams(); for (const k of ['e', 's', 'q', 'f']) if (n[k]) p.set(k, n[k]); window.location.hash = p.toString(); };
  return [r, aller];
}
function useLarge() {
  const mq = '(min-width: 1000px)';
  const [l, setL] = React.useState(() => window.matchMedia(mq).matches);
  React.useEffect(() => { const m = window.matchMedia(mq); const f = () => setL(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  return l;
}

// ── Icônes : un seul trait (1,6), un seul dessin par idée ─────────────────────
const TRAITS = {
  journee: 'M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M6 18l1.4-1.4M16.6 7.4 18 6M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  annonces: 'M4.5 4.5h6v6h-6zM13.5 4.5h6v6h-6zM4.5 13.5h6v6h-6zM13.5 13.5h6v6h-6z',
  ventes: 'M4 8.5 12 4l8 4.5v7L12 20l-8-4.5zM4 8.5l8 4.5 8-4.5M12 13v7M14.5 3.6 7.6 7.4',
  achats: 'M5.5 8h13l-1 11.5h-11zM9 8V6.5a3 3 0 0 1 6 0V8',
  argent: 'M17.5 6.6A6.5 6.5 0 1 0 17.5 17.4M5 10.5h8M5 13.5h8',
  loupe: 'M10.5 5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM14.6 14.6 19.5 19.5',
  croix: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
  plus: 'M5.5 12a1 1 0 1 0 0 .01M12 12a1 1 0 1 0 0 .01M18.5 12a1 1 0 1 0 0 .01',
  chevron: 'M9.5 6l6 6-6 6',
  bas: 'M7 10l5 5 5-5',
  aide: 'M9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.6M12 16.6v.4M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z',
};
const Ico = ({ n, t = 22 }) => (
  <svg className="o-ico" width={t} height={t} viewBox="0 0 24 24" aria-hidden="true"><path d={TRAITS[n]} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

// ── LA PHOTO. Sans photo : un aplat et la silhouette d'une basket au trait — jamais un trou.
const Silhouette = () => (
  <svg className="o-silhouette" viewBox="0 0 64 40" aria-hidden="true">
    <path d="M6 30c1-6 6-8 11-10l7-4c2-1.5 4-4 7-4 2.2 0 3.6 2 5.6 3 4.5 2.2 10.4 2.6 14 4.8 2.4 1.4 3 4.4 2.4 7.2v3H6z M6 30h47 M12 34h40" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
  </svg>
);
const Photo = ({ src, numero, double, grand, rond }) => (
  <span className={'o-photo' + (grand ? ' o-photo--grand' : '') + (rond ? ' o-photo--rond' : '')} data-sans-photo={src ? undefined : ''}>
    {src ? <img src={src} alt="" loading="lazy" decoding="async" /> : <Silhouette />}
    {numero ? <span className={'o-etiquette' + (double ? ' is-double' : '')} data-numero={numero}>{numero}</span> : null}
  </span>
);

// ── Dates courtes, à la française ─────────────────────────────────────────────
const jour = (t, maintenant) => {
  if (!t) return '';
  const d = new Date(t), n = new Date(maintenant);
  const j0 = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  const dj = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - j0) / J);
  if (dj === 0) return 'aujourd’hui'; if (dj === -1) return 'hier'; if (dj === 1) return 'demain';
  if (dj > 1 && dj < 7) return d.toLocaleDateString('fr-FR', { weekday: 'long', timeZone: 'Europe/Paris' });
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' }).replace('.', '');
};
// La date limite d'envoi : lue sur l'e-mail du bordereau ; sinon vente + 7 j, une ESTIMATION dite « vers ».
const limiteTexte = (v, maintenant) => (v.limite ? 'avant ' + jour(v.limite, maintenant) : v.estimee ? 'vers ' + jour(v.estimee, maintenant) : '');
const urgent = (v, maintenant) => !!(v.limite && v.limite - maintenant < 36 * 3600e3);
const nb = (n) => (n == null ? '—' : n.toLocaleString('fr-FR'));

// ── Pièces communes ──────────────────────────────────────────────────────────
function Tete({ titre, sur, droite }) {
  return (
    <header className="o-tete">
      <div className="o-tete-textes">
        {sur ? <p className="o-sur">{sur}</p> : null}
        <h1 className="o-titre">{titre}</h1>
      </div>
      {droite ? <div className="o-tete-droite">{droite}</div> : null}
    </header>
  );
}
function Segments({ valeurs, actif, choisir, nom }) {
  return (
    <div className="o-segments" role="tablist" aria-label={nom}>
      {valeurs.map(([k, l, n]) => (
        <button key={k} type="button" role="tab" aria-selected={actif === k} className="o-segment" onClick={() => choisir(k)}>
          <span>{l}</span>{n != null ? <span className="o-segment-n">{nb(n)}</span> : null}
        </button>
      ))}
    </div>
  );
}
const Plein = ({ children, onClick }) => <button type="button" className="o-plein" data-plein onClick={onClick}>{children}</button>;

// ── MA JOURNÉE : trois chiffres, puis les paires à poster en vignettes ────────
function Journee({ g, maintenant, ouvrir, aller }) {
  const date = new Date(maintenant).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' });
  const nEnv = g.aEnvoyer ? g.aEnvoyer.length : null; const nRet = g.retirer ? g.retirer.length : null;
  return (
    <>
      <Tete titre="Ma journée" sur={date.charAt(0).toUpperCase() + date.slice(1)} />
      <dl className="o-chiffres">
        <div className="o-chiffre"><dt>{nEnv ? <i className="o-point" /> : null}À envoyer</dt><dd>{nb(nEnv)}</dd></div>
        <div className="o-chiffre"><dt>{nRet ? <i className="o-point" /> : null}À retirer</dt><dd>{nb(nRet)}</dd></div>
        <div className="o-chiffre"><dt>Vendu en {g.argent.mois}</dt><dd>{euros(g.argent.vendu)}</dd></div>
      </dl>
      <section className="o-section">
        <div className="o-section-tete">
          <h2>À poster</h2>
          {nEnv > 9 ? <button type="button" className="o-lien" onClick={() => aller({ e: 'ventes', s: 'envoyer', f: '' })}>Les {nEnv}</button> : null}
        </div>
        <ul className="o-grille o-grille--journee">
          {(g.aEnvoyer || []).slice(0, 9).map((v) => (
            <li key={v.cle}>
              <button type="button" className="o-case" onClick={() => ouvrir(v.cle)} aria-label={`${v.titre}, ${limiteTexte(v, maintenant)}`}>
                <Photo src={v.photo} numero={v.numero} />
                <span className="o-legende"><span className={urgent(v, maintenant) ? 'o-ambre' : ''}>{limiteTexte(v, maintenant)}</span></span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      {g.aImprimer ? <div className="o-pied"><Plein>Imprimer {g.aImprimer} bordereaux</Plein></div> : null}
    </>
  );
}

// ── ANNONCES : la galerie ────────────────────────────────────────────────────
function Annonces({ g, r, aller, ouvrir, large }) {
  const [q, setQ] = React.useState(r.q || '');
  const tous = g.annonces || [];
  const dorment = tous.filter((a) => a.jours != null && a.jours > 60).length;
  const sansPhoto = tous.filter((a) => !a.photo).length;
  const vue = r.s || 'toutes';
  let liste = vue === 'dorment' ? tous.filter((a) => a.jours > 60) : vue === 'sansphoto' ? tous.filter((a) => !a.photo) : tous;
  const qn = q.trim().toLowerCase();
  // Un N° tapé désigne SA paire (identité) ; des mots ne font que filtrer par le titre.
  if (qn) liste = /^\d{1,5}$/.test(qn) ? liste.filter((a) => a.numero === qn) : liste.filter((a) => a.titre.toLowerCase().includes(qn));
  const [n, setN] = React.useState(large ? 60 : 36);
  React.useEffect(() => { const el = document.querySelector('.o-fin'); if (!el) return undefined; const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) setN((x) => x + 36); }, { rootMargin: '600px' }); io.observe(el); return () => io.disconnect(); }, [liste.length]);
  return (
    <>
      <Tete titre="Annonces" sur={`${nb(tous.length)} en ligne`} droite={<button type="button" className="o-menu">Tous les comptes<Ico n="bas" t={16} /></button>} />
      <div className="o-outils">
        <label className="o-champ"><Ico n="loupe" t={18} /><input type="search" inputMode="search" placeholder="N°, modèle, taille" value={q} onChange={(e) => setQ(e.target.value)} enterKeyHint="search" /></label>
        <div className="o-filtres" role="tablist" aria-label="Vue">
          {[['toutes', 'Toutes', null], ['dorment', 'Plus de 60 j', dorment], ['sansphoto', 'Sans photo', sansPhoto]].map(([k, l, c]) => (
            <button key={k} type="button" role="tab" aria-selected={vue === k} className="o-filtre" onClick={() => aller({ s: k === 'toutes' ? '' : k })}>{l}{c != null ? <span className="o-filtre-n">{nb(c)}</span> : null}</button>
          ))}
        </div>
      </div>
      <ul className="o-grille" data-grille>
        {liste.slice(0, n).map((a) => (
          <li key={a.cle}>
            <button type="button" className={'o-case' + (r.f === a.cle ? ' is-ouverte' : '')} onClick={() => ouvrir(a.cle)} aria-label={`${a.numero ? 'N° ' + a.numero + ', ' : ''}${a.titre}, ${euros(a.prix)}`}>
              <Photo src={a.photo} numero={a.numero} />
              <span className="o-legende"><span className="o-prix">{euros(a.prix)}</span><span className="o-gris">{a.jours != null ? a.jours + ' j' : ''}</span></span>
            </button>
          </li>
        ))}
      </ul>
      {liste.length > n ? <div className="o-fin" /> : null}
      <div className="o-pied"><Plein>Publier</Plein></div>
    </>
  );
}

// ── VENTES : une liste, la photo grande à gauche ─────────────────────────────
function LigneVente({ v, maintenant, ouvrir }) {
  const pseudo = v.pseudo || v.compte;
  return (
    <li>
      <button type="button" className="o-ligne" onClick={() => ouvrir(v.cle)}>
        <Photo src={v.photo} numero={v.numero} rond />
        <span className="o-ligne-textes">
          <span className="o-ligne-titre">{v.titre}</span>
          <span className="o-ligne-meta">
            {v.etat === 'envoyer' ? <span className={urgent(v, maintenant) ? 'o-ambre' : ''}>{limiteTexte(v, maintenant)}</span> : <span>{v.etat === 'finie' ? 'Livrée' : 'En route'}</span>}
            {pseudo ? <span className="o-gris"> · {pseudo}</span> : null}
          </span>
        </span>
        <span className="o-ligne-prix">{euros(v.prix)}</span>
      </button>
    </li>
  );
}
function Ventes({ g, r, aller, ouvrir, maintenant }) {
  const s = r.s || 'envoyer';
  const enRoute = (g.ventes || []).filter((v) => v.etat === 'route');
  const liste = s === 'envoyer' ? g.aEnvoyer || [] : s === 'route' ? enRoute : g.ventes || [];
  return (
    <>
      <Tete titre="Ventes" />
      <Segments nom="Ventes" actif={s} choisir={(k) => aller({ s: k })} valeurs={[['envoyer', 'À envoyer', g.aEnvoyer ? g.aEnvoyer.length : null], ['route', 'En route', enRoute.length], ['toutes', 'Toutes', null]]} />
      <ul className="o-liste">{liste.slice(0, 80).map((v) => <LigneVente key={v.cle} v={v} maintenant={maintenant} ouvrir={ouvrir} />)}</ul>
      {s === 'envoyer' && g.aImprimer ? <div className="o-pied"><Plein>Imprimer {g.aImprimer} bordereaux</Plein></div> : null}
    </>
  );
}

// ── ACHATS : les colis à retirer par point (code + QR), puis les achats ───────
const QR = ({ texte, taille = 52 }) => {
  const svg = React.useMemo(() => { const q = qrcode(0, 'M'); q.addData(String(texte)); q.make(); return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); }, [texte]);
  return <span className="o-qr" style={{ width: taille, height: taille }} dangerouslySetInnerHTML={{ __html: svg }} />;
};
function Achats({ g, r, aller, ouvrir, maintenant }) {
  const s = r.s || 'retirer';
  const enRoute = (g.achats || []).filter((a) => a.etat === 'route');
  const recus = (g.achats || []).filter((a) => a.etat === 'recu');
  return (
    <>
      <Tete titre="Achats" />
      <Segments nom="Achats" actif={s} choisir={(k) => aller({ s: k })} valeurs={[['retirer', 'À retirer', g.retirer ? g.retirer.length : null], ['route', 'En route', enRoute.length], ['recus', 'Reçus', null]]} />
      {s === 'retirer' ? (
        <div className="o-points">
          {g.points.map((p) => (
            <section key={p.point} className="o-point-relais">
              <div className="o-section-tete o-section-tete--point">
                <h2>{p.point}</h2>
                <span className={Date.parse(p.limite) - maintenant < 3 * J ? 'o-ambre' : 'o-gris'}>jusqu’à {jour(Date.parse(p.limite), maintenant)}</span>
              </div>
              <ul className="o-liste">
                {p.colis.map((c) => (
                  <li key={c.cle}>
                    <button type="button" className="o-ligne o-ligne--colis" onClick={() => ouvrir(c.cle)}>
                      <Photo src={c.photo} rond />
                      <span className="o-ligne-textes">
                        <span className="o-code" aria-label={'Code ' + c.code}>{c.code}</span>
                        <span className="o-ligne-meta o-gris">{c.art}</span>
                      </span>
                      <QR texte={c.code} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <ul className="o-liste">
          {(s === 'route' ? enRoute : recus).slice(0, 80).map((a) => (
            <li key={a.cle}>
              <button type="button" className="o-ligne" onClick={() => ouvrir(a.cle)}>
                <Photo src={a.photo} rond />
                <span className="o-ligne-textes"><span className="o-ligne-titre">{a.titre}</span><span className="o-ligne-meta o-gris">{a.etat === 'recu' ? 'Reçu' : 'En route'} · {jour(Date.parse(a.date), maintenant)} · {a.compte}</span></span>
                <span className="o-ligne-prix">{euros(a.prix)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

// ── ARGENT : le mois, un chiffre, puis les ventes en photo ────────────────────
function Argent({ g, ouvrir, maintenant }) {
  const a = g.argent;
  return (
    <>
      <Tete titre="Argent" droite={<button type="button" className="o-rond" aria-label="Comment c’est calculé"><Ico n="aide" t={20} /></button>} />
      <dl className="o-chiffres">
        <div className="o-chiffre"><dt>Vendu en {a.mois}</dt><dd>{euros(a.vendu)}</dd></div>
        <div className="o-chiffre"><dt>Bénéfice, au moins</dt><dd>{euros(a.benefice, { signe: true })}</dd></div>
        <div className="o-chiffre"><dt>Coûts saisis</dt><dd>{a.n == null ? '—' : `${a.couverts}/${a.n}`}</dd></div>
      </dl>
      <section className="o-section">
        <div className="o-section-tete"><h2>Ventes de {a.mois}</h2><span className="o-gris">{nb(a.n)}</span></div>
        <ul className="o-liste o-liste--serree">
          {(a.duMois || []).slice(0, 60).map((v) => (
            <li key={v.cle}>
              <button type="button" className="o-ligne o-ligne--serree" onClick={() => ouvrir(v.cle)}>
                <Photo src={v.photo} numero={v.numero} rond />
                <span className="o-ligne-textes"><span className="o-ligne-titre">{v.titre}</span><span className="o-ligne-meta o-gris">{jour(Date.parse(v.date), maintenant)}{v.paire && v.paire.cout != null ? ' · coût ' + euros(v.paire.cout) : ' · coût pas saisi'}</span></span>
                <span className="o-ligne-prix">{euros(v.prix)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

// ── LA FICHE : photo en haut, l'essentiel, les gestes en bas ──────────────────
function ficheDe(cle, g, modele, maintenant) {
  const [t, id] = [cle.slice(0, 1), cle.slice(2)];
  if (t === 'a') {
    const a = (g.annonces || []).find((x) => x.id === id); if (!a) return null;
    const p = a.numero ? modele.paires.get(a.numero) : null;
    return { photo: a.photo, numero: a.numero, titre: a.titre, meta: [a.taille && 'Taille ' + a.taille, a.etat, a.compte].filter(Boolean),
      chiffres: [['Achat', euros(p ? p.cout : null)], ['Prix', euros(a.prix)], ['En ligne', a.jours != null ? a.jours + ' j' : '—']],
      faits: [['Favoris', nb(a.fav)], ['Vues', nb(a.vues)]], plein: 'Baisser le prix', touche: 'Republier' };
  }
  if (t === 'v') {
    const v = (g.ventes || []).find((x) => x.tx === id); if (!v) return null;
    const cout = v.paire ? v.paire.cout : null;
    return { photo: v.photo, numero: v.numero, titre: v.titre, meta: [v.pseudo && 'à ' + v.pseudo, v.compte, jour(Date.parse(v.date), maintenant)].filter(Boolean),
      chiffres: [['Achat', euros(cout)], ['Vente', euros(v.prix)], ['Marge', cout != null && v.prix != null ? euros(v.prix - cout, { signe: true }) : '—']],
      faits: v.etat === 'envoyer' ? [['Date limite', v.limite ? jour(v.limite, maintenant) : v.estimee ? 'vers ' + jour(v.estimee, maintenant) : '—'], ['Bordereau', v.bord ? 'reçu' : 'pas encore reçu'], ['Suivi', (v.bord && v.bord.suivi) || '—']] : [['État', v.statut]],
      plein: v.etat === 'envoyer' && v.bord ? 'Imprimer le bordereau' : null, touche: v.etat === 'envoyer' ? 'Déjà parti' : 'Suivre le colis', urgent: v.etat === 'envoyer' && urgent(v, maintenant) };
  }
  if (t === 'h') {
    const a = (g.achats || []).find((x) => x.tx === id); if (!a) return null;
    return { photo: a.photo, titre: a.titre, meta: [a.compte, jour(Date.parse(a.date), maintenant)].filter(Boolean), chiffres: [['Payé', euros(a.prix)], ['État', a.etat === 'recu' ? 'Reçu' : 'En route']], faits: [['Statut Vinted', a.statut]], plein: null, touche: 'Relier à une paire' };
  }
  if (t === 'c') {
    const c = (g.retirer || []).find((x) => x.cle === cle); if (!c) return null;
    return { photo: c.photo, titre: c.art || 'Colis', meta: [c.point, c.adresse].filter(Boolean), code: c.code, chiffres: [['Code', c.code], ['Jusqu’à', jour(Date.parse(c.limite), maintenant)]], faits: [['Suivi', c.suivi || '—']], plein: 'Je l’ai retiré', touche: null };
  }
  return null;
}
function Fiche({ fiche, fermer, large }) {
  const ref = React.useRef(null);
  React.useEffect(() => { const f = (e) => { if (e.key === 'Escape') fermer(); }; window.addEventListener('keydown', f); if (ref.current) ref.current.focus(); return () => window.removeEventListener('keydown', f); }, [fermer]);
  return (
    <aside className={'o-fiche' + (large ? ' o-fiche--panneau' : '')} role="dialog" aria-modal={large ? undefined : 'true'} aria-label={fiche.titre} tabIndex={-1} ref={ref}>
      <div className="o-fiche-defile">
        <div className="o-fiche-photo">
          {fiche.code ? <span className="o-fiche-qr"><QR texte={fiche.code} taille={large ? 200 : 220} /></span> : <Photo src={fiche.photo} grand />}
          <button type="button" className="o-rond o-rond--sur" onClick={fermer} aria-label="Fermer"><Ico n="croix" t={20} /></button>
          <button type="button" className="o-rond o-rond--sur o-rond--droite" aria-label="Plus"><Ico n="plus" t={22} /></button>
        </div>
        <div className="o-fiche-corps">
          <div className="o-fiche-titre">
            {fiche.numero ? <span className="o-etiquette o-etiquette--plat">N° {fiche.numero}</span> : null}
            <h2>{fiche.titre}</h2>
            <p className="o-gris">{fiche.meta.join(' · ')}</p>
          </div>
          <dl className="o-fiche-chiffres">{fiche.chiffres.map(([l, v]) => <div key={l}><dt>{l}</dt><dd>{v}</dd></div>)}</dl>
          <dl className="o-fiche-faits">{fiche.faits.map(([l, v]) => <div key={l}><dt>{l}</dt><dd>{v}</dd></div>)}</dl>
        </div>
      </div>
      {fiche.plein || fiche.touche ? (
        <div className="o-fiche-gestes">
          {fiche.touche ? <button type="button" className="o-touche">{fiche.touche}</button> : null}
          {fiche.plein ? <Plein>{fiche.plein}</Plein> : null}
        </div>
      ) : null}
    </aside>
  );
}

// ── La coque : barre du bas au téléphone, colonne à l'ordinateur ──────────────
export default function Galerie() {
  const [modele, setModele] = React.useState(undefined);
  const [r, aller] = useRoute();
  const large = useLarge();
  React.useEffect(() => { lireDonnees().then((m) => setModele(m || null)).catch(() => setModele(null)).finally(() => { try { finDemarrage(); } catch (_) {} }); }, []);
  const g = React.useMemo(() => (modele ? galerie(modele) : null), [modele]);
  React.useEffect(() => { window.scrollTo(0, 0); }, [r.e]);
  if (modele === undefined) return <div className="o-racine o-attente" />;
  if (!g) return <div className="o-racine"><main className="o-main"><Tete titre="VRM" /><p className="o-gris">Données pas lues.</p></main></div>;
  const maintenant = modele.maintenant;
  const ouvrir = (cle) => aller({ f: cle });
  const fermer = () => aller({ f: '' });
  const fiche = r.f ? ficheDe(r.f, g, modele, maintenant) : null;
  const props = { g, r, aller, ouvrir, maintenant, large };
  const badge = { ventes: g.aEnvoyer && g.aEnvoyer.length, achats: g.retirer && g.retirer.length };
  return (
    <div className={'o-racine' + (fiche ? ' a-fiche' : '')} data-ecran={r.e}>
      {large ? (
        <nav className="o-colonne" aria-label="Écrans">
          <p className="o-marque">VRM</p>
          {ECRANS.map(([k, l]) => (
            <button key={k} type="button" className="o-nav" aria-current={r.e === k ? 'page' : undefined} onClick={() => aller({ e: k, s: '', f: '', q: '' })}>
              <Ico n={k} /><span>{l}</span>{badge[k] ? <span className="o-nav-n">{badge[k]}</span> : null}
            </button>
          ))}
        </nav>
      ) : null}
      <main className="o-main" inert={fiche && !large ? '' : undefined}>
        {r.e === 'annonces' ? <Annonces key="a" {...props} /> : r.e === 'ventes' ? <Ventes {...props} /> : r.e === 'achats' ? <Achats {...props} /> : r.e === 'argent' ? <Argent {...props} /> : <Journee {...props} />}
      </main>
      {!large ? (
        <nav className="o-barre" aria-label="Écrans">
          {ECRANS.map(([k, , c]) => (
            <button key={k} type="button" className="o-onglet" aria-current={r.e === k ? 'page' : undefined} onClick={() => aller({ e: k, s: '', f: '', q: '' })}>
              <span className="o-onglet-ico"><Ico n={k} t={24} />{badge[k] ? <i className="o-point o-point--onglet" /> : null}</span><span>{c}</span>
            </button>
          ))}
        </nav>
      ) : null}
      {fiche ? <Fiche fiche={fiche} fermer={fermer} large={large} /> : null}
    </div>
  );
}
