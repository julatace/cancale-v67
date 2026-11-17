// ════════════════════════════════════════════════════════════════════════════
//  MAQUETTE G — « LE TABLEAU » (17 nov.) — un PROTOTYPE à montrer, pas livré.
//  Monté seulement si `localStorage.vrm_banc_maquette === 'g'` (posé par le banc
//  scripts/bancs/maquette-g.cjs ; aucun bouton de l'app ne le pose : invisible pour Julien).
//
//  Les paires avancent en colonnes d'étapes (src/maquettes/g/etapes.js : l'étape est
//  CALCULÉE, jamais posée à la main). Téléphone : une colonne par écran, le rail souligné
//  des étapes en haut (comme C), on glisse d'une étape à l'autre ; TOUS les boutons sont
//  en bas, au pouce : Chercher · LE geste en série de l'étape · Argent. Le geste d'une
//  carte est à sa DROITE (le pouce droit), jamais au milieu du texte.
//  Ordinateur : toutes les colonnes côte à côte ; le geste en série en tête de colonne.
//  Textes en français seulement (prototype) : à passer par tr() s'il est retenu.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { construire, euros, jour } from './etapes.js';
import { finDemarrage } from '../../demarrage.js';
import '../../design/studio-polices.css';
import './tableau.css';

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
  const [comptes, main, listings, vendues, achetees, bords, txns] = await Promise.all([
    lireTout('vinted_accounts?select=vinted_user_id,login'),
    lireTout('app_data?select=id,nums:data->vinted_annonce_numeros,couts:data->vinted_buyprice_by_num,grille:data->vinted_garage_grid&id=eq.main'),
    lireTout('app_data?select=id,items:data->payload->items,lu:data->>capturedAt&id=like.harvest_*_listings'),
    lireTout('app_data?select=id,o:data->payload->my_orders&id=like.harvest_*_orders_sold'),
    lireTout('app_data?select=id,o:data->payload->my_orders&id=like.harvest_*_orders_purchased'),
    lireTout('app_data?select=id,tx:data->>transaction,limite:data->>dateLimite&id=like.email_bord_*'),
    lireTout('app_data?select=id,tx:data->payload->transaction->>id,st:data->payload->transaction->>status,at:data->payload->transaction->>status_updated_at&id=like.harvest_*_txn_*'),
  ]);
  if (!main || !listings || !vendues) return null;   // « rien lu » ne vaut pas « rien »
  return construire({ comptes, main: main[0], listings, vendues, achetees, bords, txns });
}

const lireCol = () => { const m = /col=([a-z]+)/.exec(window.location.hash || ''); return m ? m[1] : 'envoyer'; };
function useLarge() {
  const mq = '(min-width: 1100px)';
  const [l, setL] = React.useState(() => window.matchMedia(mq).matches);
  React.useEffect(() => { const m = window.matchMedia(mq); const f = () => setL(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  return l;
}

const ICO = {
  loupe: 'M10.5 4a6.5 6.5 0 1 0 4.06 11.58l4.43 4.43 1.06-1.06-4.43-4.43A6.5 6.5 0 0 0 10.5 4zm0 1.5a5 5 0 1 1 0 10 5 5 0 0 1 0-10z',
  plus: 'M5 10.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm7 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm7 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z',
  euro: 'M14.5 5c1.5 0 2.8.4 3.9 1.1l-.8 1.3A5.6 5.6 0 0 0 14.5 6.5c-2.4 0-4.4 1.5-5.2 3.8h6.2v1.4H9c0 .2-.01.4-.01.6s0 .4.01.6h6.5v1.4H9.3c.8 2.3 2.8 3.8 5.2 3.8 1.2 0 2.2-.3 3.1-.9l.8 1.3a7 7 0 0 1-3.9 1.1c-3.2 0-5.9-2.1-6.8-5.3H5.5v-1.4h2c0-.2-.01-.4-.01-.6s0-.4.01-.6h-2v-1.4h2.2C8.6 7.1 11.3 5 14.5 5z',
  imprimer: 'M7 3h10v4h2.5A1.5 1.5 0 0 1 21 8.5V16h-4v5H7v-5H3V8.5A1.5 1.5 0 0 1 4.5 7H7zm1.5 1.5V7h7V4.5zm0 11v4h7v-4z',
  scan: 'M4 4h5v1.5H5.5V9H4zm11 0h5v5h-1.5V5.5H15zM4 15h1.5v3.5H9V20H4zm14.5 0H20v5h-5v-1.5h3.5zM7 11.25h10v1.5H7z',
};
const Ico = ({ n, t = 22 }) => <svg width={t} height={t} viewBox="0 0 24 24" aria-hidden="true"><path d={ICO[n]} fill="currentColor" /></svg>;
const Plaque = ({ c }) => (c.groupe ? null : c.numero ? <span className={'sb-plaque g-plaque' + (c.doublon ? ' is-double' : '')} data-numero={c.numero}>N°&thinsp;{c.numero}</span> : <span className="g-plaque-vide">{c.achat ? 'achat' : 'sans N°'}</span>);

function Carte({ c, compact }) {
  return (
    // La carte ENTIÈRE se touche (jamais un bouton dedans) : elle ouvre la paire, dont le geste vient en bas, au pouce.
    <div className={'g-carte' + (c.ambre ? ' is-ambre' : '') + (c.doublon ? ' is-double' : '')} data-g-carte={c.cle} data-g-geste={c.geste ? c.geste.mot : undefined} role="listitem" tabIndex={0}
      aria-label={[c.numero ? 'N° ' + c.numero : '', c.titre, c.sous, c.geste ? 'geste : ' + c.geste.mot : ''].filter(Boolean).join(', ')}>
      <span className="g-vignette">{c.photo ? <img src={c.photo} alt="" loading="lazy" decoding="async" width="52" height="52" /> : <span className="g-vignette-vide" />}</span>
      <span className="g-corps">
        <span className="g-ligne1"><Plaque c={c} /></span>
        <span className="g-titre">{c.titre || '—'}</span>
        <span className="g-sous">{c.ambre ? <i className="g-point" aria-hidden="true" /> : null}{c.sous}</span>
      </span>
      <span className="g-droite">
        <span className="g-prix">{c.groupe ? '' : euros(c.prix)}</span>
      </span>
    </div>
  );
}

const motSerie = (s) => (s ? (s.n != null ? `${s.mot} ${s.n}${s.suite ? ' ' + s.suite : ''}` : s.mot) : '');
function Telephone({ modele }) {
  const [cle, setCle] = React.useState(lireCol);
  const idx = modele.colonnes.findIndex((c) => c.cle === cle);
  const col = modele.colonnes[Math.max(0, idx)];
  const rail = React.useRef(null);
  React.useEffect(() => { const f = () => setCle(lireCol()); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  React.useLayoutEffect(() => { const b = rail.current && rail.current.querySelector('[aria-current="page"]'); const prec = b && b.previousElementSibling; if (b) rail.current.scrollLeft = Math.max(0, (prec || b).offsetLeft - 16); }, [cle]);
  const aller = (k) => { window.location.hash = 'col=' + k; };
  // On GLISSE d'une étape à la voisine (le doigt), comme on tourne une page.
  const depart = React.useRef(null);
  const surDebut = (e) => { const t = e.touches[0]; depart.current = { x: t.clientX, y: t.clientY }; };
  const surFin = (e) => {
    const d = depart.current; depart.current = null; if (!d) return;
    const t = e.changedTouches[0]; const dx = t.clientX - d.x, dy = t.clientY - d.y;
    if (Math.abs(dx) > 70 && Math.abs(dx) > 2 * Math.abs(dy)) { const j = idx + (dx < 0 ? 1 : -1); if (modele.colonnes[j]) aller(modele.colonnes[j].cle); }
  };
  const s = col.serie;
  return (
    <div className="g-racine g-tel" data-g-col={col.cle}>
      <header className="g-tete">
        <div className="g-tete-l">
          <h1 className="g-titre-ecran">Tableau</h1>
          <button type="button" className="sb-rond g-plus" aria-label="Comment marche le tableau ?">?</button>
        </div>
        <nav className="g-rail" ref={rail} aria-label="Étapes">
          {modele.colonnes.map((c) => {
            const urgent = c.cartes.some((x) => x.ambre || x.doublon);
            return (
              <button key={c.cle} type="button" className="g-rail-b" aria-current={c.cle === col.cle ? 'page' : undefined} onClick={() => aller(c.cle)} data-g-etape={c.cle}>
                {c.court}<span className={'g-rail-n' + (urgent ? ' is-ambre' : '')}>{c.n}</span>
              </button>
            );
          })}
        </nav>
      </header>
      <main className="g-colonne" onTouchStart={surDebut} onTouchEnd={surFin}>
        <div className="g-liste" role="list">
          {col.cartes.length ? col.cartes.map((c) => <Carte key={c.cle} c={c} />) : <p className="g-vide">Aucune paire à cette étape.</p>}
        </div>
      </main>
      <div className="g-pouce" role="toolbar" aria-label="Gestes">
        <button type="button" className="sb-rond g-pouce-rond" aria-label="Chercher un N°, un pseudo, un suivi"><Ico n="loupe" /></button>
        {s && !s.lien
          ? <button type="button" className="sb-btn-plein sb-btn-plein--barre g-pouce-plein" data-plein="" data-g-serie={col.cle}>{col.cle === 'envoyer' ? <Ico n="imprimer" t={20} /> : null}{motSerie(s)}</button>
          : <span className="g-pouce-attente" aria-hidden="true" />}
        <button type="button" className="sb-rond g-pouce-rond" aria-label="Argent"><Ico n="euro" /></button>
      </div>
    </div>
  );
}

function Ordinateur({ modele }) {
  return (
    <div className="g-racine g-ord">
      <header className="g-ord-tete">
        <span className="g-marque">VRM</span>
        <h1 className="g-titre-ecran">Tableau</h1>
        <label className="g-cherche"><Ico n="loupe" t={18} /><input placeholder="N°, pseudo, n° de suivi, code…" aria-label="Chercher" /><kbd>⌘K</kbd></label>
        <button type="button" className="sb-touche"><Ico n="euro" t={18} />Argent</button>
        <button type="button" className="sb-rond" aria-label="Comment marche le tableau ?">?</button>
      </header>
      <div className="g-tableau" role="list">
        {modele.colonnes.map((col) => {
          const s = col.serie; const plein = col.cle === 'envoyer' && s;
          return (
            <section key={col.cle} className={'g-ord-col' + (col.cle === 'verifier' ? ' is-verifier' : '')} data-g-col={col.cle} aria-label={col.nom}>
              <div className="g-ord-col-tete">
                <h2>{col.nom}</h2><span className="g-col-n">{col.n}</span>
              </div>
              {plein ? <div className="g-ord-serie"><button type="button" className="sb-btn-plein sb-btn-plein--barre g-ord-plein" data-plein=""><Ico n="imprimer" t={18} />{motSerie(s)}</button></div> : null}
              <div className="g-ord-liste" role="list">
                {col.cartes.slice(0, 40).map((c) => <Carte key={c.cle} c={c} compact />)}
                {col.cartes.length > 40 ? <button type="button" className="sb-lien g-encore">Voir les {col.cartes.length - 40} autres</button> : null}
                {!col.cartes.length ? <p className="g-vide">Aucune</p> : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export default function Tableau() {
  const [modele, setModele] = React.useState(undefined);   // undefined : en cours · null : pas su
  const large = useLarge();
  React.useEffect(() => {
    try {
      const sombre = localStorage.getItem('vinted_dark') === 'true';
      document.documentElement.setAttribute('data-theme', sombre ? 'dark' : 'light');
      document.documentElement.setAttribute('data-maquette', 'g');
    } catch (_) {}
    lireDonnees().then((m) => { setModele(m); try { finDemarrage('maquette-g'); } catch (_) {} }, () => setModele(null));
  }, []);
  if (modele === undefined) return <div className="g-racine g-attente" />;
  if (modele === null) return <div className="g-racine g-pas-su"><p>— Lecture impossible : le tableau ne montre rien plutôt qu’un faux.</p></div>;
  return large ? <Ordinateur modele={modele} /> : <Telephone modele={modele} />;
}
export { jour };
