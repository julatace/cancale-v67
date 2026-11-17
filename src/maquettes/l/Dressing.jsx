// ════════════════════════════════════════════════════════════════════════════
//  MAQUETTE L — « LE DRESSING » (17 nov.) — un PROTOTYPE à montrer, pas livré.
//  Monté seulement si `localStorage.vrm_banc_maquette === 'l'` (posé par le banc
//  scripts/bancs/maquette-l.cjs ; aucun bouton de l'app ne le pose : invisible pour Julien).
//
//  Inspiré des apps de mode (Vinted, Vestiaire, SSENSE, Grailed), mais pour le VENDEUR :
//  tout se voit par la photo de la paire, en grille aérée (2 colonnes au téléphone, 5 à
//  l'ordinateur), le N° en petite plaque, UN badge d'état seulement quand le filtre mélange
//  des états. Toucher une photo ouvre la fiche plein écran, le geste du moment en bas.
//  Les onglets deviennent des filtres en mots : À faire · En ligne · Vendues ; Achats a son onglet (16 nov.).
//  Argent reste une liste chiffrée sobre. Barre du bas : Dressing · Achats · Messages · Argent · Moi.
//  Textes en français seulement (prototype) : à passer par tr() s'il est retenu.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { construire, euros, jour, ETATS } from './dressing.js';
import { finDemarrage } from '../../demarrage.js';
import '../../design/studio-polices.css';
import './dressing.css';

const SUPABASE_URL = (import.meta.env && import.meta.env.VITE_SUPABASE_URL) || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const SUPABASE_KEY = (import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) || '';
const session = () => { try { return JSON.parse(localStorage.getItem('vrm_session') || 'null'); } catch (_) { return null; } };
// Supabase plafonne une réponse à 1 000 lignes (§4.5) : pagination par `Range`. Une lecture ratée : `null`.
async function lireTout(chemin) {
  const s = session(); if (!s || !s.access_token) return null;
  const out = [];
  for (let de = 0; de < 20000; de += 1000) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${chemin}`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${s.access_token}`, Range: `${de}-${de + 999}`, 'Range-Unit': 'items' } }).catch(() => null);
    if (!r || !r.ok) return null;
    const l = await r.json().catch(() => null);
    if (!Array.isArray(l)) return null;
    out.push(...l); if (l.length < 1000) break;
  }
  return out;
}
async function lireDonnees() {
  // Projections seulement (§4.4 : jamais `select=data` sur une ligne lourde).
  const [comptes, main, listings, vendues, achetees, bords, txns, retirer] = await Promise.all([
    lireTout('vinted_accounts?select=vinted_user_id,login'),
    lireTout('app_data?select=id,nums:data->vinted_annonce_numeros,couts:data->vinted_buyprice_by_num&id=eq.main'),
    lireTout('app_data?select=id,items:data->payload->items,lu:data->>capturedAt&id=like.harvest_*_listings'),
    lireTout('app_data?select=id,o:data->payload->my_orders&id=like.harvest_*_orders_sold'),
    lireTout('app_data?select=id,o:data->payload->my_orders&id=like.harvest_*_orders_purchased'),
    lireTout('app_data?select=id,tx:data->>transaction,limite:data->>dateLimite,suivi:data->>suivi&id=like.email_bord_*'),
    lireTout('app_data?select=id,tx:data->payload->transaction->>id,st:data->payload->transaction->>status,at:data->payload->transaction->>status_updated_at&id=like.harvest_*_txn_*'),
    lireTout('app_data?select=id,colis:data->colis&id=eq.vrm_colis_retirer'),
  ]);
  if (!main || !listings || !vendues) return null; // « rien lu » ne vaut pas « rien »
  return construire({ comptes, main: main[0], listings, vendues, achetees, bords, txns, retirer: retirer && retirer[0] });
}

// L'adresse dit l'écran : e (dressing|achats|messages|argent|moi) · f (afaire|enligne|vendues) · v (grille|liste) · p (fiche) · q (recherche)
// Démo pour les captures : g=<clé> montre une ligne glissée, m=<clé> le menu d'appui long.
const CLES = ['e', 'f', 'v', 'p', 'q', 'g', 'm'];
const DEFAUT = { e: 'dressing', f: 'afaire', v: '', p: '', q: '', g: '', m: '' };
const lireHash = () => { const h = new URLSearchParams((window.location.hash || '').slice(1)); const o = { ...DEFAUT }; for (const k of CLES) if (h.get(k)) o[k] = h.get(k); return o; };
const ecrireHash = (o) => { const h = new URLSearchParams(); for (const k of CLES) if (o[k] && o[k] !== DEFAUT[k]) h.set(k, o[k]); window.location.hash = h.toString(); };
// Liste par défaut pour En ligne, Vendues et Achats ; grille pour À faire (Julien, 17 nov.).
const vueDe = (h) => h.v || (h.e === 'dressing' && h.f === 'afaire' ? 'grille' : 'liste');
function useLarge() {
  const mq = '(min-width: 1100px)';
  const [l, setL] = React.useState(() => window.matchMedia(mq).matches);
  React.useEffect(() => { const m = window.matchMedia(mq); const f = () => setL(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  return l;
}

// UN jeu d'icônes (géométrie Lucide, trait 1,75, bouts ronds).
const ICO = {
  loupe: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></>,
  dressing: <><path d="M12 6.2a2 2 0 1 1 2 2c-1.1 0-2 .9-2 2v.4" /><path d="M12 10.6 3.7 16.3a1 1 0 0 0 .6 1.8h15.4a1 1 0 0 0 .6-1.8z" /></>,
  achats: <><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></>,
  messages: <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" />,
  argent: <><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" /><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" /></>,
  moi: <><circle cx="12" cy="8" r="4.5" /><path d="M20 21a8 8 0 0 0-16 0" /></>,
  imprimer: <><path d="M6 9V3h12v6" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" rx="1" /></>,
  retour: <path d="m15 18-6-6 6-6" />,
  plus: <><circle cx="5" cy="12" r=".8" /><circle cx="12" cy="12" r=".8" /><circle cx="19" cy="12" r=".8" /></>,
  ticket: <><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z" /><path d="M13 5v2M13 17v2M13 11v2" /></>,
  grille: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  liste: <><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3 6h.01M3 12h.01M3 18h.01" /></>,
  bas: <path d="m6 9 6 6 6-6" />,
  croix: <path d="M18 6 6 18M6 6l12 12" />,
  check: <path d="M20 6 9 17l-5-5" />,
  lien: <><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></>,
  etiquette: <><path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z" /><circle cx="7.5" cy="7.5" r="1" /></>,
  prix: <><path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>,
  ouvrir: <><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></>,
  photo: <><path d="M12 6.2a2 2 0 1 1 2 2c-1.1 0-2 .9-2 2v.4" /><path d="M12 10.6 3.7 16.3a1 1 0 0 0 .6 1.8h15.4a1 1 0 0 0 .6-1.8z" /></>,
};
const Ico = ({ n, t = 22 }) => <svg className="l-ico" width={t} height={t} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{ICO[n]}</svg>;

const Plaque = ({ x }) => (x.numero ? <span className={'l-plaque' + (x.doublon ? ' is-double' : '')} data-numero={x.numero}>N°&thinsp;{x.numero}</span> : null);
// Une paire sans photo : un fond uni et le cintre, au même cadrage (jamais un trou).
const Photo = ({ x, i = 0, t = 400 }) => (x.photo
  ? <img src={x.photo} alt="" loading={i < 10 ? 'eager' : 'lazy'} decoding="async" width={t} height={t} />
  : <span className="l-sans-photo" aria-label="Pas de photo"><Ico n="photo" t={Math.round(t / 4)} /></span>);
const sousLigne = (x) => [x.numero ? `N° ${x.numero}` : x.achat ? null : 'Sans N°', x.taille ? `T. ${x.taille}` : null, x.compte].filter(Boolean).join(' · ');
const quand = (x) => (x.etat === 'enligne' ? (x.jours != null ? `${x.jours} j` : '') : x.detail);

// Le geste principal d'une paire (glisser vers la droite) : un seul toucher.
const GESTE_LIGNE = { envoyer: ['imprimer', 'Imprimer'], retirer: ['check', 'Retiré'], numeroter: ['lien', 'Relier'], publier: ['ouvrir', 'Publier'], verifier: ['ouvrir', 'Vérifier'], enligne: ['prix', 'Baisser'], vendue: ['ouvrir', 'Suivi'], enroute: ['ouvrir', 'Suivi'] };

function Tuile({ x, ouvrir, menu, i }) {
  const e = ETATS[x.etat];
  const appui = useAppuiLong(() => menu(x.cle));
  return (
    // La tuile ENTIÈRE se touche (aucun bouton dedans) : elle ouvre la fiche ; un appui long ouvre le menu.
    <button type="button" className={'l-tuile' + (x.doublon ? ' is-double' : '')} data-l-tuile={x.cle} data-etat={x.etat} style={{ '--i': Math.min(i, 11) }} onClick={() => ouvrir(x.cle)} {...appui}
      aria-label={[x.numero ? 'N° ' + x.numero : 'achat sans N°', x.titre, x.taille ? 'taille ' + x.taille : '', e.mot, x.detail, euros(x.prix)].filter(Boolean).join(', ')}>
      <span className="l-photo"><Photo x={x} i={i} /><Plaque x={x} />{x.taille ? <span className="l-taille">T.&thinsp;{x.taille}</span> : null}<span className={'l-badge' + (e.geste ? ' is-geste' : '')}>{e.mot}</span></span>
      <span className="l-nom">{x.titre || '—'}</span>
      <span className="l-ligne">
        <span className="l-prix">{euros(x.prix)}</span>
        <span className={'l-detail' + (x.urgent ? ' is-urgent' : '')}>{quand(x)}</span>
      </span>
    </button>
  );
}

// Appui long (500 ms) : le menu de la paire. Le défilement l'annule.
function useAppuiLong(f) {
  const t = React.useRef(null);
  const fin = () => { clearTimeout(t.current); t.current = null; };
  return { onPointerDown: () => { fin(); t.current = setTimeout(() => { t.current = 'fait'; f(); }, 500); }, onPointerUp: fin, onPointerCancel: fin, onPointerLeave: fin, onContextMenu: (ev) => { ev.preventDefault(); f(); } };
}

// Une ligne (vignette 56, titre sur UNE ligne, « N° · taille · compte », prix et date à droite).
// Glisser à droite : le geste principal ; à gauche : « Plus ». Appui long : le menu.
function Rangee({ x, ouvrir, menu, glissee, i }) {
  const [dx, setDx] = React.useState(glissee ? 96 : 0);
  const depart = React.useRef(null);
  const appui = useAppuiLong(() => menu(x.cle));
  const g = GESTE_LIGNE[x.etat];
  const fini = () => { const v = dx > 56 ? 96 : dx < -56 ? -96 : 0; setDx(v); depart.current = null; };
  return (
    <div className="l-rangee-cadre" data-l-rangee={x.cle} data-etat={x.etat}>
      <div className={'l-rangee-action is-droite' + (x.etat === 'envoyer' || x.etat === 'retirer' ? ' is-principal' : '')} aria-hidden={dx <= 0}><Ico n={g[0]} /><span>{g[1]}</span></div>
      <div className="l-rangee-action is-gauche" aria-hidden={dx >= 0}><Ico n="plus" /><span>Plus</span></div>
      <button type="button" className="l-rangee" style={{ transform: dx ? `translateX(${dx}px)` : undefined }} onClick={() => (dx ? setDx(0) : ouvrir(x.cle))}
        onPointerDown={(ev) => { depart.current = { x: ev.clientX, d: dx }; appui.onPointerDown(); }}
        onPointerMove={(ev) => { if (!depart.current) return; const v = depart.current.d + ev.clientX - depart.current.x; if (Math.abs(v - depart.current.d) > 8) { appui.onPointerCancel(); setDx(Math.max(-120, Math.min(120, v))); } }}
        onPointerUp={() => { appui.onPointerUp(); if (depart.current) fini(); }} onPointerCancel={() => { appui.onPointerCancel(); fini(); }} onContextMenu={appui.onContextMenu}
        aria-label={[x.titre, sousLigne(x), euros(x.prix), x.detail].filter(Boolean).join(', ')}>
        <span className="l-rangee-photo"><Photo x={x} i={i} t={112} /></span>
        <span className="l-rangee-g">
          <span className="l-rangee-titre">{x.titre || '—'}</span>
          <span className="l-rangee-sous">{x.doublon ? <span className="l-plaque is-double is-mini">N° {x.numero}</span> : null}{x.doublon ? sousLigne(x).replace(/^N° \S+ · /, '') : sousLigne(x)}</span>
        </span>
        <span className="l-rangee-d">
          <span className="l-prix">{euros(x.prix)}</span>
          <span className={'l-detail' + (x.urgent ? ' is-urgent' : '')}>{quand(x)}</span>
        </span>
      </button>
    </div>
  );
}

function Liste({ l, ouvrir, menu, glissee }) {
  if (!l.length) return <p className="l-vide">Rien ici pour l’instant.</p>;
  return <div className="l-liste-paires" role="list">{l.map((x, i) => <Rangee key={x.cle} x={x} i={i} ouvrir={ouvrir} menu={menu} glissee={glissee === x.cle} />)}</div>;
}
function Grille({ l, ouvrir, menu }) {
  if (!l.length) return <p className="l-vide">Rien ici pour l’instant.</p>;
  return <div className="l-grille" role="list">{l.map((x, i) => <Tuile key={x.cle} x={x} i={i} ouvrir={ouvrir} menu={menu} />)}</div>;
}

function Filtres({ d, f, choisir }) {
  return (
    <nav className="l-filtres" aria-label="Filtrer le dressing">
      {d.filtres.map((x) => (
        <button key={x.cle} type="button" className="l-filtre" aria-pressed={x.cle === f} data-l-filtre={x.cle} onClick={() => choisir(x.cle)}>
          {x.mot}<span className="l-filtre-n">{x.n}</span>
        </button>
      ))}
    </nav>
  );
}

// Le menu des comptes et des plateformes (sous le titre).
const Comptes = () => (
  <button type="button" className="l-comptes" aria-haspopup="menu">
    <span className="l-logo" aria-hidden="true">V</span><span>Tous les comptes</span><Ico n="bas" t={16} />
  </button>
);

// LE geste de l'écran (un seul bouton plein), posé AU-DESSUS de la barre, jamais sur le contenu.
function gesteDe(h, l) {
  const nb = (et) => l.filter((x) => x.etat === et).length;
  if (h.e === 'dressing' && h.f === 'afaire' && nb('envoyer')) return { ico: 'imprimer', mot: `Imprimer ${nb('envoyer')} bordereau${nb('envoyer') > 1 ? 'x' : ''}` };
  if (h.e === 'achats' && nb('retirer')) return { ico: 'ticket', mot: 'Montrer les codes au comptoir' };
  return null;
}
const Plein = ({ g }) => (g ? <button type="button" className="l-plein" data-plein><Ico n={g.ico} /><span>{g.mot}</span></button> : null);

// Les codes d'un même point relais : UNE carte, qu'on fait défiler code par code.
function Point({ pt, ouvrir }) {
  return (
    <section className="l-point" aria-label={pt.lieu}>
      <header className="l-point-tete"><Ico n="ticket" t={18} /><span className="l-point-noms"><span className="l-point-lieu">{pt.lieu.split(/,| — /)[0]}</span><span className="l-point-adresse">{pt.lieu.split(/,| — /).slice(1).join(',').trim()}</span></span><span className="l-point-n">{pt.colis.length} colis</span></header>
      <div className="l-point-codes">
        {pt.colis.map((x, i) => (
          <button type="button" key={x.cle} className="l-point-code" onClick={() => ouvrir(x.cle)} aria-label={`Code ${x.retrait && x.retrait.code}, ${x.titre}`}>
            <span className="l-point-g">
              <span className="l-code-val">{x.retrait && x.retrait.code ? x.retrait.code.replace(/(\d{3})(?=\d{3}$)/, '$1 ') : '—'}</span>
              <span className="l-point-titre">{x.titre}</span>
              <span className={'l-detail' + (x.urgent ? ' is-urgent' : '')}>{x.detail}{pt.colis.length > 1 ? ` · ${i + 1} sur ${pt.colis.length}` : ''}</span>
            </span>
            {x.retrait && x.retrait.qr ? <img className="l-qr" src={x.retrait.qr} alt="QR de retrait" width="96" height="96" /> : <span className="l-sans-qr">Au code</span>}
          </button>
        ))}
      </div>
    </section>
  );
}

// Le menu d'appui long : les gestes de la paire, en feuille.
function Menu({ x, fermer, ouvrir }) {
  const g = GESTE_LIGNE[x.etat];
  return (
    <div className="l-menu" role="dialog" aria-label={'Gestes : ' + x.titre}>
      <div className="l-menu-voile" onClick={fermer} />
      <div className="l-menu-corps">
        <div className="l-menu-tete"><span className="l-rangee-photo"><Photo x={x} t={112} /></span><span className="l-rangee-g"><span className="l-rangee-titre">{x.titre}</span><span className="l-rangee-sous">{sousLigne(x)}</span></span></div>
        {[[g[0], g[1] === 'Retiré' ? 'J’ai retiré le colis' : g[1] === 'Imprimer' ? 'Imprimer le bordereau' : g[1]], ['ouvrir', 'Ouvrir la fiche'], ['etiquette', 'Changer le N°'], ['lien', 'Relier à un achat'], ['ouvrir', 'Ouvrir sur Vinted']].map(([i, mot]) => (
          <button type="button" key={mot} className="l-menu-geste" onClick={mot === 'Ouvrir la fiche' ? () => ouvrir(x.cle) : undefined}><span>{mot}</span><Ico n={i} t={20} /></button>
        ))}
      </div>
    </div>
  );
}

// ── La fiche : la photo, LE NOM EN HÉROS, l'essentiel, LE geste du moment en bas ──
function Fiche({ x, fermer, large }) {
  const e = ETATS[x.etat];
  const r = x.retrait;
  const ref = React.useRef(null);
  React.useEffect(() => { const k = (ev) => { if (ev.key === 'Escape') fermer(); }; window.addEventListener('keydown', k); ref.current && ref.current.focus(); return () => window.removeEventListener('keydown', k); }, [fermer]);
  const marge = x.prix != null && x.cout != null ? x.prix - x.cout : null;
  const faits = x.etat === 'enligne' ? [['Prix', euros(x.prix)], ['Acheté', euros(x.cout)], ['Favoris', String(x.favoris)]]
    : x.achat ? [['Payé', euros(x.prix)], ['Taille', x.taille || '—']]
      : [['Acheté', euros(x.cout)], ['Vendu', euros(x.prix)], ['Marge', marge == null ? '—' : (marge > 0 ? '+' : '') + euros(marge)]];
  const ligneEtat = x.etat === 'envoyer' ? `À envoyer ${x.detail}` : x.etat === 'retirer' ? `À retirer ${x.limite ? x.detail : ''}`.trim()
    : x.etat === 'enligne' ? `En ligne depuis ${x.jours} jours` : x.etat === 'vendue' ? (x.detail === 'en route' ? 'Vendue · en route' : 'Vendue · bordereau pas encore reçu')
      : x.etat === 'enroute' ? 'Achat en route vers toi' : x.etat === 'numeroter' ? `Arrivée ${x.detail.replace('arrivée ', '')}, sans N°` : x.etat === 'publier' ? 'Brouillon · pas en ligne' : e.mot;
  const TR = { mondialrelay: 'Mondial Relay', vintedgo: 'Vinted Go', chronopost: 'Chronopost' };
  const infos = [
    ['Compte', x.compte || '—'],
    x.taille && !x.achat ? ['Taille', x.taille] : null,
    x.vendueLe ? ['Vendue', jour(x.vendueLe)] : null,
    x.etat === 'envoyer' ? ['Suivi', x.suivi || '—'] : null,
    x.etat === 'enligne' ? ['Vues', String(x.vues)] : null,
    x.etat === 'retirer' && r ? ['Transporteur', TR[r.transporteur] || r.transporteur || '—'] : null,
    x.etat === 'retirer' && r ? ['Suivi', r.suivi || '—'] : null,
    x.achat && x.etat !== 'retirer' ? ['Acheté', jour(x.date)] : null,
  ].filter(Boolean);
  return (
    <div className={'l-fiche' + (large ? ' is-panneau' : '')} role="dialog" aria-modal={!large} aria-label={x.titre} data-l-fiche={x.cle} data-etat={x.etat}>
      {large ? <div className="l-fiche-voile" onClick={fermer} aria-hidden="true" /> : null}
      <div className="l-fiche-corps" tabIndex={-1} ref={ref}>
        <div className="l-fiche-photo">
          <Photo x={x} t={800} />
          <button type="button" className="l-rond l-fiche-retour" onClick={fermer} aria-label="Fermer"><Ico n="retour" /></button>
          <button type="button" className="l-rond l-fiche-plus" aria-label="Plus de gestes"><Ico n="plus" /></button>
        </div>
        <div className="l-fiche-texte">
          <div className="l-fiche-id">{x.numero ? <Plaque x={x} /> : <span className="l-fiche-sans">Achat sans N°</span>}{x.taille ? <span className="l-fiche-taille">Taille {x.taille}</span> : null}</div>
          <h2 className="l-fiche-titre">{x.titre}</h2>
          <p className={'l-fiche-etat' + (x.urgent || x.doublon || x.etat === 'verifier' ? ' is-urgent' : '')}>{ligneEtat}</p>
          {x.raison ? <p className="l-fiche-raison">{x.raison}</p> : null}
          {x.etat === 'retirer' ? (
            <section className="l-code" aria-label="Code de retrait">
              <div className="l-code-g">
                <span className="l-code-mot">Code de retrait</span>
                <span className="l-code-val" data-l-code={r && r.code ? r.code : ''}>{r && r.code ? r.code.replace(/(\d{3})(?=\d{3}$)/, '$1 ') : '—'}</span>
                <span className="l-code-lieu">{r && r.lieu ? r.lieu : 'Lieu pas lu'}</span>
              </div>
              {r && r.qr ? <img className="l-qr" src={r.qr} alt={'QR de retrait ' + (r.transporteur || '')} width="112" height="112" /> : null}
            </section>
          ) : (
            <dl className="l-faits">{faits.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          )}
          <dl className="l-infos">{infos.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        </div>
        {x.geste ? (
          <div className="l-fiche-geste">
            <button type="button" className="l-plein is-large" data-plein>{x.etat === 'envoyer' ? <Ico n="imprimer" /> : null}<span>{x.geste}</span></button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── Argent : une liste chiffrée sobre ──
function Argent({ d }) {
  const a = d.argent;
  const Ligne = ({ mot, sous, val, attrs }) => (
    <div className="l-rang" {...attrs}><span className="l-rang-g"><span className="l-rang-mot">{mot}</span>{sous ? <span className="l-rang-sous">{sous}</span> : null}</span><span className="l-rang-val">{val}</span></div>
  );
  const pl = (n, s, p) => `${n} ${n > 1 ? p : s}`;
  return (
    <div className="l-argent">
      <section className="l-groupe">
        <h2 className="l-groupe-titre">En {a.mois}</h2>
        <div className="l-liste">
          <Ligne mot="Vendu" sous={pl(a.vendu.sur, 'vente', 'ventes')} val={euros(a.vendu.s)} attrs={{ 'data-l-argent': 'vendu' }} />
          <Ligne mot="Reçu" sous={a.sansDate ? `${pl(a.recu.sur, 'versement', 'versements')} · ${a.sansDate} sans date` : pl(a.recu.sur, 'versement', 'versements')} val={euros(a.recu.s)} attrs={{ 'data-l-argent': 'recu' }} />
          <Ligne mot="Bénéfice" sous={a.benefice.sur ? `achat connu pour ${a.benefice.k} sur ${a.benefice.sur}` : 'aucun versement'} val={a.benefice.s == null ? '—' : (a.benefice.k < a.benefice.sur ? 'au moins ' : '') + euros(a.benefice.s)} attrs={{ 'data-l-argent': 'benefice' }} />
        </div>
      </section>
      <section className="l-groupe">
        <h2 className="l-groupe-titre">À venir</h2>
        <div className="l-liste">
          <Ligne mot="À envoyer" sous={pl(a.aVenir.envoyer.sur, 'colis', 'colis')} val={euros(a.aVenir.envoyer.s)} />
          <Ligne mot="Vendues, pas encore reçues" sous={pl(a.aVenir.enCours.sur, 'vente', 'ventes')} val={euros(a.aVenir.enCours.s)} />
        </div>
      </section>
      <section className="l-groupe">
        <h2 className="l-groupe-titre">Derniers versements</h2>
        <div className="l-liste">
          {a.derniers.map((x) => (
            <div key={x.cle} className="l-rang is-photo">
              <span className="l-rang-vignette"><Photo x={x} t={112} /></span>
              <span className="l-rang-g"><span className="l-rang-mot">{x.titre}</span><span className="l-rang-sous">{x.numero ? `N° ${x.numero} · ` : ''}reçu {jour(x.verse)}</span></span>
              <span className="l-rang-val">{euros(x.prix)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// La recherche atteint le N°, le titre, le n° de suivi et le code de retrait (identités exactes en tête).
function chercher(l, q) {
  const s = q.trim().toLowerCase(); if (!s) return l;
  const exact = (x) => [x.numero, x.suivi, x.retrait && x.retrait.code, x.retrait && x.retrait.suivi].some((v) => v && String(v).toLowerCase() === s.replace(/\s/g, ''));
  const dans = (x) => [x.numero, x.titre, x.suivi, x.retrait && x.retrait.code, x.retrait && x.retrait.suivi].some((v) => v && String(v).toLowerCase().includes(s));
  return [...l.filter(exact), ...l.filter((x) => !exact(x) && dans(x))];
}

const ONGLETS = [['dressing', 'Dressing'], ['achats', 'Achats'], ['messages', 'Messages'], ['argent', 'Argent'], ['moi', 'Moi']];

export default function Dressing() {
  const [d, setD] = React.useState(undefined); // undefined : en cours · null : pas su · valeur lue
  const [h, setH] = React.useState(lireHash);
  const [cherche, setCherche] = React.useState(() => !!lireHash().q);
  const large = useLarge();
  React.useEffect(() => { document.documentElement.setAttribute('data-maquette', 'l'); try { finDemarrage && finDemarrage(); } catch (_) {} }, []);
  React.useEffect(() => { let vivant = true; lireDonnees().then((x) => { window.__l_donnees = performance.now(); if (vivant) setD(x); }, () => vivant && setD(null)); return () => { vivant = false; }; }, []);
  React.useEffect(() => { const f = () => setH(lireHash()); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  const aller = (o) => ecrireHash({ ...h, ...o });
  const ouvrir = (cle) => aller({ p: cle, m: '' });
  const menu = (cle) => aller({ m: cle });
  const fermer = React.useCallback(() => ecrireHash({ ...lireHash(), p: '', m: '' }), []);

  React.useEffect(() => { if (d && !window.__l_rendu) requestAnimationFrame(() => { window.__l_rendu = performance.now(); }); }, [d]);
  if (d === undefined) return <div className="l-racine l-attente" aria-busy="true" />;
  if (d === null) return <div className="l-racine"><p className="l-vide">Les données n’ont pas pu être lues.</p></div>;
  const filtre = d.filtres.find((x) => x.cle === h.f) || d.filtres[0];
  const base = h.e === 'achats' ? d.achats : filtre.paires;
  const l = chercher(h.q ? d.paires : base, h.q);
  const paire = h.p ? d.paires.find((x) => x.cle === h.p) : null;
  const menuDe = h.m ? d.paires.find((x) => x.cle === h.m) : null;
  const g = h.q ? null : gesteDe(h, base);
  const vue = vueDe(h);
  const titre = { argent: 'Argent', achats: 'Achats', messages: 'Messages', moi: 'Moi' }[h.e] || 'Dressing';
  const avecPaires = h.e === 'dressing' || h.e === 'achats';
  const Bascule = () => (avecPaires ? (
    <button type="button" className="l-rond" aria-label={vue === 'grille' ? 'Voir en liste' : 'Voir en grille'} onClick={() => aller({ v: vue === 'grille' ? 'liste' : 'grille' })}><Ico n={vue === 'grille' ? 'liste' : 'grille'} /></button>) : null);
  const champ = <label className="l-champ"><Ico n="loupe" t={18} /><input type="search" value={h.q} onChange={(ev) => aller({ q: ev.target.value })} placeholder="N°, titre, suivi, code" aria-label="Chercher une paire" autoFocus={cherche && !large} /></label>;
  const contenu = h.e === 'argent' ? <Argent d={d} />
    : !avecPaires ? <p className="l-vide">Pas maquetté.</p>
      : <>
        {h.e === 'achats' && !h.q ? d.points.map((pt) => <Point key={pt.lieu} pt={pt} ouvrir={ouvrir} />) : null}
        {h.e === 'achats' && !h.q ? <h2 className="l-section">Tous les achats</h2> : null}
        {h.q ? <p className="l-resultats">{l.length} résultat{l.length > 1 ? 's' : ''}</p> : null}
        {vue === 'grille' ? <Grille l={l} ouvrir={ouvrir} menu={menu} /> : <Liste l={l} ouvrir={ouvrir} menu={menu} glissee={h.g} />}
      </>;

  if (large) {
    return (
      <div className={'l-racine l-ordi' + (paire ? ' a-fiche' : '')}>
        <header className="l-barre-haut">
          <span className="l-marque">VRM</span>
          <nav className="l-nav" aria-label="Écrans">
            {ONGLETS.map(([k, mot]) => <button key={k} type="button" className="l-nav-lien" aria-current={k === h.e ? 'page' : undefined} onClick={() => aller({ e: k, p: '', v: '', q: '' })}>{mot}</button>)}
          </nav>
          {champ}
        </header>
        <main className={'l-page' + (g ? ' a-plein' : '')}>
          <div className="l-tete-ordi">
            <div className="l-tete-titre"><h1 className="l-titre">{titre}</h1>{avecPaires || h.e === 'argent' ? <Comptes /> : null}</div>
            {h.e === 'dressing' ? <Filtres d={d} f={filtre.cle} choisir={(f) => aller({ f, p: '', v: '' })} /> : null}
            <span className="l-tete-espace" />
            <Bascule />
            {g ? <Plein g={g} /> : null}
          </div>
          {contenu}
        </main>
        {paire ? <Fiche x={paire} fermer={fermer} large /> : null}
        {menuDe ? <Menu x={menuDe} fermer={fermer} ouvrir={ouvrir} /> : null}
      </div>
    );
  }
  return (
    <div className="l-racine l-tel">
      {paire ? <Fiche x={paire} fermer={fermer} /> : null}
      {menuDe ? <Menu x={menuDe} fermer={fermer} ouvrir={ouvrir} /> : null}
      <div className="l-ecran" aria-hidden={paire || menuDe ? 'true' : undefined} inert={paire || menuDe ? '' : undefined}>
        <header className="l-tete">
          {cherche ? <div className="l-tete-l">{champ}<button type="button" className="l-lien" onClick={() => { setCherche(false); aller({ q: '' }); }}>Annuler</button></div> : (
            <div className="l-tete-l">
              <h1 className="l-titre">{titre}</h1>
              <span className="l-tete-outils">{avecPaires ? <button type="button" className="l-rond" aria-label="Chercher : N°, titre, suivi, code" onClick={() => setCherche(true)}><Ico n="loupe" /></button> : null}<Bascule /></span>
            </div>)}
          {!cherche && (avecPaires || h.e === 'argent') ? <Comptes /> : null}
          {h.e === 'dressing' && !h.q ? <Filtres d={d} f={filtre.cle} choisir={(f) => { aller({ f, p: '', v: '' }); window.scrollTo(0, 0); }} /> : null}
        </header>
        <main className={'l-page' + (g ? ' a-plein' : '')}>{contenu}</main>
        {g ? <div className="l-plein-tel"><Plein g={g} /></div> : null}
        <nav className="l-barre" aria-label="Écrans">
          {ONGLETS.map(([k, mot]) => (
            <button key={k} type="button" className="l-onglet" aria-current={k === h.e ? 'page' : undefined} onClick={() => aller({ e: k, p: '', v: '', q: '', m: '', g: '' })}>
              <Ico n={k} /><span>{mot}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
