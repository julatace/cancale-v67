// ════════════════════════════════════════════════════════════════════════════
//  MAQUETTE L — « LE DRESSING » (17 nov.) — un PROTOTYPE à montrer, pas livré.
//  Monté seulement si `localStorage.vrm_banc_maquette === 'l'` (posé par le banc
//  scripts/bancs/maquette-l.cjs ; aucun bouton de l'app ne le pose : invisible pour Julien).
//
//  Inspiré des apps de mode (Vinted, Vestiaire, SSENSE, Grailed), mais pour le VENDEUR :
//  tout se voit par la photo de la paire, en grille aérée (2 colonnes au téléphone, 5 à
//  l'ordinateur), le N° en petite plaque, UN badge d'état seulement quand le filtre mélange
//  des états. Toucher une photo ouvre la fiche plein écran, le geste du moment en bas.
//  Les onglets deviennent des filtres en mots : À faire · En ligne · Vendues · Achats.
//  Argent reste une liste chiffrée sobre. Barre du bas : Dressing · Messages · Argent · Moi.
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

// L'adresse dit l'écran : #f=afaire · #f=enligne · #e=argent · #p=<clé de la paire>
const lireHash = () => { const h = new URLSearchParams((window.location.hash || '').slice(1)); return { f: h.get('f') || 'afaire', e: h.get('e') || 'dressing', p: h.get('p') || '' }; };
const ecrireHash = (o) => { const h = new URLSearchParams(); if (o.e && o.e !== 'dressing') h.set('e', o.e); if (o.f && o.f !== 'afaire') h.set('f', o.f); if (o.p) h.set('p', o.p); window.location.hash = h.toString(); };
function useLarge() {
  const mq = '(min-width: 1100px)';
  const [l, setL] = React.useState(() => window.matchMedia(mq).matches);
  React.useEffect(() => { const m = window.matchMedia(mq); const f = () => setL(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  return l;
}

// Icônes dessinées (trait 1,75, bouts ronds), une seule famille.
const ICO = {
  loupe: <><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l5 5" /></>,
  dressing: <><path d="M12 4.5a2 2 0 1 1 2 2c-1 0-2 .6-2 1.6v.4" /><path d="M12 8.5L3.5 15c-.9.7-.4 2 .7 2h15.6c1.1 0 1.6-1.3.7-2z" /></>,
  messages: <path d="M4.5 6.5A2.5 2.5 0 0 1 7 4h10a2.5 2.5 0 0 1 2.5 2.5v7A2.5 2.5 0 0 1 17 16h-6.5L6 19.5V16h0a1.5 1.5 0 0 1-1.5-1.5z" />,
  argent: <><rect x="3.5" y="6" width="17" height="12" rx="2.5" /><path d="M3.5 10h17" /><path d="M7 14.5h3" /></>,
  moi: <><circle cx="12" cy="9" r="3.5" /><path d="M5 19.5c1.2-3 3.9-4.5 7-4.5s5.8 1.5 7 4.5" /></>,
  imprimer: <><path d="M7 9V4.5h10V9" /><rect x="4" y="9" width="16" height="7.5" rx="2" /><path d="M7.5 14h9v5.5h-9z" /></>,
  retour: <path d="M14.5 5.5L8 12l6.5 6.5" />,
  plus: <><circle cx="6" cy="12" r=".9" /><circle cx="12" cy="12" r=".9" /><circle cx="18" cy="12" r=".9" /></>,
  code: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2" /></>,
  fleche: <path d="M9.5 6l6 6-6 6" />,
};
const Ico = ({ n, t = 22 }) => <svg className="l-ico" width={t} height={t} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{ICO[n]}</svg>;

const Plaque = ({ x }) => (x.numero ? <span className={'l-plaque' + (x.doublon ? ' is-double' : '')} data-numero={x.numero}>N°&thinsp;{x.numero}</span> : null);

function Tuile({ x, badge, ouvrir, i }) {
  const e = ETATS[x.etat];
  return (
    // La tuile ENTIÈRE se touche (aucun bouton dedans) : elle ouvre la fiche, dont le geste est en bas.
    <button type="button" className={'l-tuile' + (x.doublon ? ' is-double' : '')} data-l-tuile={x.cle} data-etat={x.etat} style={{ '--i': Math.min(i, 11) }} onClick={() => ouvrir(x.cle)}
      aria-label={[x.numero ? 'N° ' + x.numero : 'achat sans N°', x.titre, e.mot, x.detail, euros(x.prix)].filter(Boolean).join(', ')}>
      <span className="l-photo">
        {x.photo ? <img src={x.photo} alt="" loading={i < 8 ? 'eager' : 'lazy'} decoding="async" width="400" height="400" /> : null}
        <Plaque x={x} />
        {badge ? <span className={'l-badge' + (e.geste ? ' is-geste' : '')}>{e.mot}</span> : null}
      </span>
      <span className="l-ligne">
        <span className="l-prix">{euros(x.prix)}</span>
        {x.detail ? <span className={'l-detail' + (e.geste && !badge ? ' is-geste' : '')}>{x.detail}</span> : null}
      </span>
      <span className="l-nom">{x.titre || '—'}</span>
    </button>
  );
}

function Grille({ filtre, ouvrir }) {
  if (!filtre.paires.length) return <p className="l-vide">Rien ici pour l’instant.</p>;
  return (
    <div className="l-grille" role="list" data-l-grille={filtre.cle}>
      {filtre.paires.map((x, i) => <Tuile key={x.cle} x={x} i={i} badge={filtre.melange} ouvrir={ouvrir} />)}
    </div>
  );
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

// LE geste du filtre (un seul bouton plein par écran), ou rien quand il n'y a rien à faire.
function gesteDuFiltre(filtre) {
  const nb = (et) => filtre.paires.filter((x) => x.etat === et).length;
  if (filtre.cle === 'afaire' && nb('envoyer')) return { ico: 'imprimer', mot: `Imprimer ${nb('envoyer')} bordereau${nb('envoyer') > 1 ? 'x' : ''}` };
  if ((filtre.cle === 'afaire' || filtre.cle === 'achats') && nb('retirer')) return { ico: 'code', mot: `Codes de retrait`, n: nb('retirer'), ouvre: filtre.paires.find((x) => x.etat === 'retirer').cle };
  return null;
}
function Plein({ g, ouvrir }) {
  if (!g) return null;
  return (
    <button type="button" className="l-plein" data-plein onClick={() => g.ouvre && ouvrir(g.ouvre)}>
      <Ico n={g.ico} /><span>{g.mot}</span>{g.n ? <span className="l-plein-n">{g.n}</span> : null}
    </button>
  );
}

// ── La fiche : la photo en grand, l'essentiel, LE geste du moment en bas ──
function Fiche({ x, fermer, large }) {
  const e = ETATS[x.etat];
  const r = x.retrait;
  const ref = React.useRef(null);
  React.useEffect(() => { const k = (ev) => { if (ev.key === 'Escape') fermer(); }; window.addEventListener('keydown', k); ref.current && ref.current.focus(); return () => window.removeEventListener('keydown', k); }, [fermer]);
  const marge = x.prix != null && x.cout != null ? x.prix - x.cout : null;
  const faits = x.etat === 'enligne'
    ? [['Prix', euros(x.prix)], ['Acheté', euros(x.cout)], ['Favoris', String(x.favoris)]]
    : x.achat ? [['Payé', euros(x.prix)]]
      : [['Acheté', euros(x.cout)], ['Vendu', euros(x.prix)], ['Marge', marge == null ? '—' : (marge > 0 ? '+' : '') + euros(marge)]];
  const ligneEtat = x.etat === 'envoyer' ? `À envoyer ${x.detail}` : x.etat === 'retirer' ? `À retirer ${x.limite ? x.detail : ''}`.trim()
    : x.etat === 'enligne' ? `En ligne depuis ${x.jours} jours` : x.etat === 'vendue' ? (x.detail === 'en route' ? 'Vendue · en route' : 'Vendue · bordereau attendu')
      : x.etat === 'enroute' ? 'Achat en route vers toi' : x.etat === 'numeroter' ? `Arrivée ${x.detail.replace('arrivée ', '')} · sans N°` : x.etat === 'publier' ? 'Brouillon · pas en ligne' : e.mot;
  const TR = { mondialrelay: 'Mondial Relay', vintedgo: 'Vinted Go', chronopost: 'Chronopost' };
  const infos = [
    ['Compte', x.compte || '—'],
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
          {x.photo ? <img src={x.photo} alt="" width="800" height="800" /> : null}
          <button type="button" className="l-rond l-fiche-retour" onClick={fermer} aria-label="Fermer"><Ico n="retour" /></button>
          <button type="button" className="l-rond l-fiche-plus" aria-label="Plus de gestes"><Ico n="plus" /></button>
        </div>
        <div className="l-fiche-texte">
          {x.numero ? <div className="l-fiche-id"><Plaque x={x} /></div> : null}
          <h2 className="l-fiche-titre">{x.titre}</h2>
          <p className={'l-fiche-etat' + (e.geste ? ' is-geste' : '')}>{ligneEtat}</p>
          {x.raison ? <p className="l-fiche-raison">{x.raison}</p> : null}
          {x.etat === 'retirer' ? (
            <section className="l-code" aria-label="Code de retrait">
              <div className="l-code-g">
                <span className="l-code-mot">Code de retrait</span>
                <span className="l-code-val" data-l-code={r && r.code ? r.code : ''}>{r && r.code ? r.code.replace(/(\d{3})(?=\d)/g, '$1 ') : '—'}</span>
                <span className="l-code-lieu">{r && r.lieu ? r.lieu : 'Lieu pas lu'}</span>
              </div>
              {r && r.qr ? <img className="l-qr" src={r.qr} alt={'QR de retrait ' + (r.transporteur || '')} width="112" height="112" /> : null}
            </section>
          ) : (
            <dl className="l-faits">
              {faits.filter((f) => f[1] != null).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
            </dl>
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
              <span className="l-rang-vignette">{x.photo ? <img src={x.photo} alt="" width="80" height="80" loading="lazy" decoding="async" /> : null}</span>
              <span className="l-rang-g"><span className="l-rang-mot">{x.titre}</span><span className="l-rang-sous">{x.numero ? `N° ${x.numero} · ` : ''}reçu {jour(x.verse)}</span></span>
              <span className="l-rang-val">{euros(x.prix)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const ONGLETS = [['dressing', 'Dressing'], ['messages', 'Messages'], ['argent', 'Argent'], ['moi', 'Moi']];

export default function Dressing() {
  const [d, setD] = React.useState(undefined); // undefined : en cours · null : pas su · valeur lue
  const [h, setH] = React.useState(lireHash);
  const large = useLarge();
  React.useEffect(() => { document.documentElement.setAttribute('data-maquette', 'l'); try { finDemarrage && finDemarrage(); } catch (_) {} }, []);
  React.useEffect(() => { let vivant = true; lireDonnees().then((x) => { if (vivant) setD(x); }, () => vivant && setD(null)); return () => { vivant = false; }; }, []);
  React.useEffect(() => { const f = () => setH(lireHash()); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  const aller = (o) => ecrireHash({ ...h, ...o });
  const ouvrir = (cle) => aller({ p: cle });
  const fermer = React.useCallback(() => ecrireHash({ ...lireHash(), p: '' }), []);

  if (d === undefined) return <div className="l-racine l-attente" aria-busy="true" />;
  if (d === null) return <div className="l-racine"><p className="l-vide">Les données n’ont pas pu être lues.</p></div>;
  const filtre = d.filtres.find((x) => x.cle === h.f) || d.filtres[0];
  const paire = h.p ? d.paires.find((x) => x.cle === h.p) : null;
  const g = h.e === 'dressing' ? gesteDuFiltre(filtre) : null;
  const titre = h.e === 'argent' ? 'Argent' : 'Dressing';

  if (large) {
    return (
      <div className={'l-racine l-ordi' + (paire ? ' a-fiche' : '')}>
        <header className="l-barre-haut">
          <span className="l-marque">VRM</span>
          <nav className="l-nav" aria-label="Écrans">
            {ONGLETS.map(([k, mot]) => <button key={k} type="button" className="l-nav-lien" aria-current={k === h.e ? 'page' : undefined} onClick={() => aller({ e: k, p: '' })}>{mot}</button>)}
          </nav>
          <label className="l-champ"><Ico n="loupe" t={18} /><input type="search" placeholder="N°, titre, suivi, code" aria-label="Chercher une paire" /></label>
        </header>
        <main className="l-page">
          <div className="l-tete-ordi">
            <h1 className="l-titre">{titre}</h1>
            {h.e === 'dressing' ? <Filtres d={d} f={filtre.cle} choisir={(f) => aller({ f, p: '' })} /> : null}
            <span className="l-tete-espace" />
            {g ? <Plein g={g} ouvrir={ouvrir} /> : null}
          </div>
          {h.e === 'argent' ? <Argent d={d} /> : <Grille filtre={filtre} ouvrir={ouvrir} />}
        </main>
        {paire ? <Fiche x={paire} fermer={fermer} large /> : null}
      </div>
    );
  }
  return (
    <div className="l-racine l-tel">
      {paire ? <Fiche x={paire} fermer={fermer} /> : null}
      <div className="l-ecran" aria-hidden={paire ? 'true' : undefined} inert={paire ? '' : undefined}>
        <header className="l-tete">
          <div className="l-tete-l">
            <h1 className="l-titre">{titre}</h1>
            <button type="button" className="l-rond" aria-label="Chercher une paire"><Ico n="loupe" /></button>
          </div>
          {h.e === 'dressing' ? <Filtres d={d} f={filtre.cle} choisir={(f) => { aller({ f, p: '' }); window.scrollTo(0, 0); }} /> : null}
        </header>
        <main className="l-page">
          {h.e === 'argent' ? <Argent d={d} /> : <Grille filtre={filtre} ouvrir={ouvrir} />}
        </main>
        {g ? <div className="l-plein-tel"><Plein g={g} ouvrir={ouvrir} /></div> : null}
        <nav className="l-barre" aria-label="Écrans">
          {ONGLETS.map(([k, mot]) => (
            <button key={k} type="button" className="l-onglet" aria-current={k === h.e ? 'page' : undefined} onClick={() => aller({ e: k, p: '' })}>
              <Ico n={k} /><span>{mot}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
