// ══════════════════════════════════════════════════════════════════════════
// L'ACCUEIL DES NOUVEAUX (14 nov., choix de Julien n° 132, 137, 138, 141, 142)
// Ce qui se DESSINE — les règles sont dans des fichiers purs, exécutés par
// scripts/audit-accueil-nouveaux.cjs :
//   · 132 « Ton bilan en une minute »   — src/bilanMinute.js
//   · 137 le premier colis accompagné   — src/premierColis.js
//   · 138 « Nouveau » sur les écrans    — src/ecransVus.js (pastille : BadgeNav d'App.jsx)
//   · 141 la langue du téléphone        — src/i18n/index.js (`langueDepart`)
//   · 142 les notifications au bon moment — src/notifsBonMoment.js
// Ici : aucune règle de calcul, aucun chiffre fabriqué. Les lectures/écritures de
// l'app arrivent par `deps` (load, save, isCloudReady…) : ce fichier n'importe pas App.jsx.
// Mouvement : ressorts courts, rien sous `prefers-reduced-motion`.
// ══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { createPortal } from 'react-dom';
import { tr, monnaie, nombre, LANGUES, NOMS_LANGUES, choisirLangue, langueDetectee, langueChoisie, noterLangueDetecteeVue } from '../i18n/index.js';
import { useLangue } from '../i18n/react.js';
import { CLE_BILAN_MINUTE, bilanMinute, doitMontrerBilan, marqueurBilan } from '../bilanMinute.js';
import { CLE_PREMIER_COLIS, EVT_BORDEREAU_IMPRIME, ETAPES_COLIS, doitAccompagner, marqueurColis, fenetreOuverte } from '../premierColis.js';
import { CLE_NOTIFS_DEMANDE, quoiProposer, marqueurNotifs, estLienSuivi } from '../notifsBonMoment.js';
import { CLE_ECRANS_VUS, premiereListe, marquerVu, signalerEcransVus } from '../ecransVus.js';
import { VAPID_PUBLIC_KEY, cleVapid } from '../vapid.js';
import { estInstallee } from '../guideIphone.js';
import './accueil-nouveaux.css';

const moinsDeMouvement = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };
const estIos = () => { try { return /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); } catch (_) { return false; } };
const permission = () => { try { return typeof Notification === 'undefined' ? 'absent' : Notification.permission; } catch (_) { return 'absent'; } };
const Z = 9000;   // sous la visionneuse du bordereau (9500) et les confirmations

// ── Les petits dessins (traits, l'accent pour l'objet) ──────────────────────
const Trait = ({ d, ...p }) => <path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p} />;
const ICONES = {
  colis: 'M4 8l8-4 8 4v8l-8 4-8-4z M4 8l8 4 8-4 M12 12v8',
  retrait: 'M5 10h14v9H5z M8 10V7a4 4 0 018 0v3 M12 14v2',
  argent: 'M4 7h16v10H4z M12 9.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z',
  geste: 'M12 4v8 M12 16v.5 M5 20h14L12 4z',
  globe: 'M12 3a9 9 0 100 18 9 9 0 000-18z M3 12h18 M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z',
  cloche: 'M6 16V11a6 6 0 0112 0v5l1.5 2h-15z M10 20a2 2 0 004 0',
};
const Icone = ({ nom, taille = 22 }) => <svg width={taille} height={taille} viewBox="0 0 24 24" aria-hidden="true"><Trait d={ICONES[nom]} /></svg>;

// ── Un nombre qui défile jusqu'à sa valeur (une fois) ───────────────────────
function useDefile(cible, duree = 900) {
  const [v, setV] = React.useState(() => (moinsDeMouvement() || typeof cible !== 'number' ? cible : 0));
  React.useEffect(() => {
    if (typeof cible !== 'number' || moinsDeMouvement()) { setV(cible); return undefined; }
    let raf = 0; const t0 = performance.now(); const de = 0;
    const pas = (t) => { const k = Math.min(1, (t - t0) / duree); const e = 1 - Math.pow(1 - k, 3); setV(de + (cible - de) * e); if (k < 1) raf = requestAnimationFrame(pas); };
    raf = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(raf);
  }, [cible]); // eslint-disable-line react-hooks/exhaustive-deps
  return v;
}

// La courbe de l'année (aucune librairie) : la série VENDU mois par mois.
function Courbe({ serie }) {
  if (!Array.isArray(serie) || serie.length < 2) return null;
  const L = 320, H = 64, max = Math.max(...serie) || 1;
  const pts = serie.map((v, i) => [(i / (serie.length - 1)) * L, H - 4 - (v / max) * (H - 12)]);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  return (
    <svg className="vrm-an-courbe" viewBox={`0 0 ${L} ${H}`} preserveAspectRatio="none" aria-hidden="true" data-bilan-courbe={serie.length}>
      <defs><linearGradient id="vrm-an-remplir" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="currentColor" stopOpacity=".16" /><stop offset="1" stopColor="currentColor" stopOpacity="0" /></linearGradient></defs>
      <path d={`${d} L ${L} ${H} L 0 ${H} Z`} fill="url(#vrm-an-remplir)" />
      <path className="vrm-an-courbe-trait" d={d} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" pathLength="1" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3.5" fill="currentColor" />
    </svg>
  );
}

const ent = (n) => (typeof n === 'number' ? nombre(Math.round(n)) : '—');
// La raison d'un « au moins », en une ligne.
function raisonAuMoins(v) {
  const r = (v.raisons || [])[0];
  if (!r) return '';
  if (r.k === 'import') return tr('nouveaux.bilan.auMoins.import');
  if (r.k === 'manque') return tr('nouveaux.bilan.auMoins.manque', { noms: r.noms.join(', ') });
  if (r.k === 'montant') return tr('nouveaux.bilan.auMoins.montant', { n: r.n });
  return tr('nouveaux.bilan.auMoins.attente');
}

// ══ 132 · TON BILAN EN UNE MINUTE ══════════════════════════════════════════
export function BilanMinute({ bilan, onFin, onPasser, FermeAuRetour = null }) {
  useLangue();
  const [page, setPage] = React.useState(0);
  const fermer = () => onPasser && onPasser();
  const v = bilan.ventes;
  const eur = useDefile(v.etat === 'lu' ? v.eur : null, 1100);
  const n = useDefile(v.etat === 'lu' ? v.n : null, 900);
  const bouton = React.useRef(null);
  const cadre = React.useRef(null);
  React.useEffect(() => { try { cadre.current && cadre.current.focus({ preventScroll: true }); } catch (_) {} }, [page]);
  const tuile = (cle, val, auMoins, lib) => (
    <div className="vrm-an-tuile" data-bilan-tuile={cle} data-bilan-n={val == null ? '' : String(val)}>
      <b>{val == null ? '—' : <>{auMoins ? <span className="vrm-an-plus">≥</span> : null}{ent(val)}</>}</b>
      <span>{lib}</span>
    </div>
  );
  const matin = [
    ['colis', 'nouveaux.bilan.matin.colis'],
    ['retrait', 'nouveaux.bilan.matin.retrait'],
    ['argent', 'nouveaux.bilan.matin.argent'],
    ['geste', 'nouveaux.bilan.matin.geste'],
  ];
  return createPortal(
    <div className="vrm-an vrm-an-bilan" role="dialog" aria-modal="true" aria-labelledby="vrm-an-bilan-titre" data-bilan-minute={page === 0 ? 'activite' : 'matin'} style={{ zIndex: Z }}>
      {FermeAuRetour ? <FermeAuRetour fermer={fermer} /> : null}
      <div className="vrm-an-lumiere" aria-hidden="true" />
      <div className="vrm-an-cadre" ref={cadre} tabIndex={-1}>
        <div className="vrm-an-haut">
          <div className="vrm-an-points" aria-hidden="true"><span data-on={page >= 0 ? '1' : '0'} /><span data-on={page >= 1 ? '1' : '0'} /></div>
          <button type="button" className="vrm-an-passer" data-bilan-passer="" onClick={fermer}>{tr('nouveaux.passer')}</button>
        </div>
        {page === 0 ? (
          <div className="vrm-an-corps" key="activite">
            <p className="vrm-an-surtitre vrm-an-entre" style={{ '--i': 0 }}>{tr('nouveaux.bilan.surtitre', { annee: String(v.annee) })}</p>
            <h1 id="vrm-an-bilan-titre" className="vrm-an-titre vrm-an-entre" style={{ '--i': 1 }}>{tr('nouveaux.bilan.titre')}</h1>
            <div className="vrm-an-affiche vrm-an-entre" style={{ '--i': 2 }} data-bilan-ca={v.etat === 'lu' ? String(Math.round(v.eur)) : v.etat} data-bilan-ventes={v.etat === 'lu' ? String(v.n) : v.etat} data-bilan-au-moins={v.auMoins ? '1' : '0'}>
              {v.etat === 'lu' && v.auMoins ? <span className="vrm-an-aumoins">{tr('nouveaux.bilan.auMoins')}</span> : null}
              <b className="vrm-an-chiffre">{v.etat === 'lu' ? monnaie(Math.round(eur), 'EUR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : v.etat === 'encours' ? '…' : '—'}</b>
              <span className="vrm-an-sous">{v.etat === 'lu' ? tr('nouveaux.bilan.ventes', { n: Math.round(n) }) : v.etat === 'encours' ? tr('nouveaux.bilan.lecture') : tr('nouveaux.bilan.pasSu')}</span>
            </div>
            {v.etat === 'lu' ? <div className="vrm-an-entre vrm-an-courbe-hote" style={{ '--i': 3 }}><Courbe serie={bilan.serie} /></div> : null}
            {v.etat === 'lu' && v.auMoins ? <p className="vrm-an-couverture vrm-an-entre" style={{ '--i': 3 }} data-bilan-raison={(v.raisons[0] || {}).k || ''}>{raisonAuMoins(v)}</p> : null}
            <div className="vrm-an-tuiles">
              <div className="vrm-an-entre" style={{ '--i': 4 }}>{tuile('aexpedier', bilan.colis.aExpedier.n, bilan.colis.aExpedier.auMoins, tr('nouveaux.bilan.aExpedier'))}</div>
              <div className="vrm-an-entre" style={{ '--i': 5 }}>{tuile('aretirer', bilan.colis.aRetirer.n, bilan.colis.aRetirer.auMoins, tr('nouveaux.bilan.aRetirer'))}</div>
              <div className="vrm-an-entre" style={{ '--i': 6 }}>{tuile('enligne', bilan.enLigne.n, false, tr('nouveaux.bilan.enLigne'))}</div>
            </div>
            <div className="vrm-an-pied">
              <button type="button" ref={bouton} className="vrm-an-principal" data-bilan-suivant="" onClick={() => setPage(1)}>{tr('nouveaux.suivant')}</button>
            </div>
          </div>
        ) : (
          <div className="vrm-an-corps" key="matin">
            <p className="vrm-an-surtitre vrm-an-entre" style={{ '--i': 0 }}>{tr('nouveaux.bilan.matin.surtitre')}</p>
            <h1 id="vrm-an-bilan-titre" className="vrm-an-titre vrm-an-entre" style={{ '--i': 1 }}>{tr('nouveaux.bilan.matin.titre')}</h1>
            <ul className="vrm-an-liste">
              {matin.map(([ic, cle], i) => (
                <li key={cle} className="vrm-an-entre" style={{ '--i': i + 2 }} data-bilan-matin={ic}>
                  <span className="vrm-an-pastille"><Icone nom={ic} /></span>
                  <span><b>{tr(cle + '.titre')}</b><small>{tr(cle + '.texte')}</small></span>
                </li>
              ))}
            </ul>
            <div className="vrm-an-pied">
              <button type="button" ref={bouton} className="vrm-an-principal" data-bilan-fin="" onClick={() => onFin && onFin()}>{tr('nouveaux.bilan.commencer')}</button>
            </div>
          </div>
        )}
      </div>
    </div>, document.body);
}

// ══ 142 · LA QUESTION DES NOTIFICATIONS ════════════════════════════════════
// S'abonner : la permission (dans CE geste), puis l'abonnement push de l'appareil.
async function activerNotifs(enTeteSession) {
  if (typeof Notification === 'undefined') return 'absent';
  let p;
  try { p = await Notification.requestPermission(); } catch (_) { p = 'denied'; }
  if (p !== 'granted') return p === 'default' ? 'plusTard' : 'refuse';
  try {
    const reg = await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 6000))]);
    if (!reg || !reg.pushManager) return 'local';
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: cleVapid(VAPID_PUBLIC_KEY) });
    const r = await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(enTeteSession ? enTeteSession() : {}) }, body: JSON.stringify({ action: 'subscribe', sub: sub.toJSON() }) });
    return r.ok ? 'ok' : 'local';
  } catch (_) { return 'local'; }
}
// Le contenu (dans une feuille à lui, ou au bout du premier colis).
export function QuestionNotifs({ mode, moment, deps, onFini }) {
  useLangue();
  const [etat, setEtat] = React.useState('');   // '' · 'attente' · résultat
  const repondre = (reponse) => { deps.save(CLE_NOTIFS_DEMANDE, marqueurNotifs(reponse, moment)); };
  const oui = async () => {
    setEtat('attente');
    const r = await activerNotifs(deps.enTeteSession);
    repondre(r === 'ok' || r === 'local' ? 'oui' : r === 'refuse' ? 'refuse' : 'plusTard');
    if (r === 'ok' || r === 'local') { try { deps.save('vinted_notif_enabled', true); } catch (_) {} }
    setEtat(r);
  };
  const non = () => { repondre('non'); onFini && onFini(); };
  if (etat && etat !== 'attente') {
    return (
      <div className="vrm-an-notifs" data-notifs-resultat={etat}>
        <p className="vrm-an-notifs-res" role="status">{tr(etat === 'ok' || etat === 'local' ? 'nouveaux.notifs.ok' : etat === 'refuse' ? 'nouveaux.notifs.refuse' : 'nouveaux.notifs.plusTard')}</p>
        <button type="button" className="vrm-an-secondaire" data-notifs-fermer="" onClick={() => onFini && onFini()}>{tr('nouveaux.ok')}</button>
      </div>
    );
  }
  return (
    <div className="vrm-an-notifs" data-notifs-question={mode} data-notifs-moment={moment}>
      <span className="vrm-an-pastille vrm-an-pastille-grande"><Icone nom="cloche" taille={26} /></span>
      <h2 className="vrm-an-h2">{tr(moment === 'premier-colis' ? 'nouveaux.notifs.titre.vente' : 'nouveaux.notifs.titre')}</h2>
      <p className="vrm-an-texte">{tr(mode === 'installer' ? 'nouveaux.notifs.iphone' : moment === 'premier-colis' ? 'nouveaux.notifs.texte.vente' : 'nouveaux.notifs.texte')}</p>
      {mode === 'installer'
        ? <button type="button" className="vrm-an-principal" data-notifs-installer="" onClick={() => { repondre('installer'); onFini && onFini(); try { window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=settings&reglage=push' })); } catch (_) {} }}>{tr('nouveaux.notifs.commentInstaller')}</button>
        : <button type="button" className="vrm-an-principal" data-notifs-oui="" disabled={etat === 'attente'} onClick={oui}>{etat === 'attente' ? tr('nouveaux.notifs.attente') : tr('nouveaux.notifs.oui')}</button>}
      <button type="button" className="vrm-an-secondaire" data-notifs-non="" onClick={non}>{tr('nouveaux.pasMaintenant')}</button>
    </div>
  );
}
// La feuille, seule (moment « colis suivi »).
function FeuilleNotifs({ mode, moment, deps, onFini }) {
  const FermeAuRetour = deps.FermeAuRetour;
  const fermer = () => { deps.save(CLE_NOTIFS_DEMANDE, marqueurNotifs('non', moment)); onFini(); };
  return createPortal(
    <div className="vrm-an-voile" onClick={fermer} style={{ zIndex: Z }} data-feuille-notifs="">
      {FermeAuRetour ? <FermeAuRetour fermer={fermer} /> : null}
      <div className="vrm-an-feuille" role="dialog" aria-modal="true" aria-label={tr('nouveaux.notifs.titre')} onClick={(e) => e.stopPropagation()}>
        <span className="vrm-an-poignee" aria-hidden="true" />
        <QuestionNotifs mode={mode} moment={moment} deps={deps} onFini={onFini} />
      </div>
    </div>, document.body);
}

// ══ 137 · LE PREMIER COLIS ══════════════════════════════════════════════════
function DessinColis({ etape }) {
  const p = { className: 'vrm-an-dessin', viewBox: '0 0 240 120', 'aria-hidden': 'true', 'data-colis-dessin': etape };
  if (etape === 'imprimer') return <svg {...p}><rect x="70" y="40" width="100" height="44" rx="10" className="a-carte" /><rect x="86" y="16" width="68" height="30" rx="4" className="a-papier" /><rect x="86" y="70" width="68" height="40" rx="4" className="a-papier" /><rect x="96" y="80" width="30" height="6" rx="3" className="a-accent" /><rect x="96" y="92" width="44" height="4" rx="2" className="a-ligne" /></svg>;
  if (etape === 'coller') return <svg {...p}><path d="M60 50l60-26 60 26v44l-60 26-60-26z" className="a-carte" /><path d="M60 50l60 26 60-26M120 76v44" className="a-trait" /><rect x="132" y="66" width="38" height="30" rx="3" transform="rotate(-24 151 81)" className="a-papier" /><rect x="138" y="74" width="20" height="5" rx="2" transform="rotate(-24 151 81)" className="a-accent" /></svg>;
  if (etape === 'deposer') return <svg {...p}><rect x="40" y="34" width="110" height="70" rx="10" className="a-carte" /><rect x="52" y="22" width="86" height="18" rx="6" className="a-accent" /><rect x="60" y="56" width="28" height="48" rx="4" className="a-papier" /><path d="M168 82l22-10 22 10v20l-22 10-22-10z" className="a-carte" /><path d="M168 82l22 10 22-10M190 92v20" className="a-trait" /></svg>;
  return <svg {...p}><path d="M30 92h180" className="a-trait" /><circle cx="50" cy="92" r="8" className="a-accent" /><circle cx="120" cy="92" r="8" className="a-carte" /><circle cx="190" cy="92" r="8" className="a-carte" /><path d="M96 42l24-12 24 12v24l-24 12-24-12z" className="a-carte" /><path d="M96 42l24 12 24-12M120 54v24" className="a-trait" /></svg>;
}
export function PremierColis({ deps, onFini, notifs }) {
  useLangue();
  const [i, setI] = React.useState(0);
  const etape = ETAPES_COLIS[i];
  const dernier = i === ETAPES_COLIS.length - 1;
  const fin = (f) => { deps.save(CLE_PREMIER_COLIS, marqueurColis(f)); onFini(); };
  const FermeAuRetour = deps.FermeAuRetour;
  const bouton = React.useRef(null);
  const feuille = React.useRef(null);
  React.useEffect(() => { try { feuille.current && feuille.current.focus({ preventScroll: true }); } catch (_) {} }, [i]);
  return createPortal(
    <div className="vrm-an-voile" style={{ zIndex: Z }} data-premier-colis={etape}>
      {FermeAuRetour ? <FermeAuRetour fermer={() => fin('passe')} /> : null}
      <div className="vrm-an-feuille vrm-an-feuille-colis" ref={feuille} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="vrm-an-colis-titre" onClick={(e) => e.stopPropagation()}>
        <span className="vrm-an-poignee" aria-hidden="true" />
        <div className="vrm-an-haut">
          <span className="vrm-an-etape" data-colis-progres={`${i + 1}/${ETAPES_COLIS.length}`}>{tr('nouveaux.colis.surtitre', { i: i + 1, n: ETAPES_COLIS.length })}</span>
          <button type="button" className="vrm-an-passer" data-colis-passer="" onClick={() => fin('passe')}>{tr('nouveaux.passer')}</button>
        </div>
        <div className="vrm-an-colis-barre" aria-hidden="true">{ETAPES_COLIS.map((e, k) => <span key={e} data-on={k <= i ? '1' : '0'} />)}</div>
        <div className="vrm-an-colis-corps" key={etape}>
          <DessinColis etape={etape} />
          <h2 id="vrm-an-colis-titre" className="vrm-an-h2">{tr(`nouveaux.colis.${etape}.titre`)}</h2>
          <p className="vrm-an-texte">{tr(`nouveaux.colis.${etape}.texte`)}</p>
          {dernier && notifs ? <div className="vrm-an-colis-notifs"><QuestionNotifs mode={notifs} moment="premier-colis" deps={deps} onFini={() => fin('fait')} /></div> : null}
        </div>
        {!(dernier && notifs) ? (
          <div className="vrm-an-pied">
            <button type="button" ref={bouton} className="vrm-an-principal" data-colis-suivant={etape} onClick={() => (dernier ? fin('fait') : setI(i + 1))}>{dernier ? tr('nouveaux.colis.compris') : tr('nouveaux.suivant')}</button>
          </div>
        ) : null}
      </div>
    </div>, document.body);
}

// ══ 141 · « VRM EST EN … (LA LANGUE DE TON TÉLÉPHONE) » ═══════════════════════
// Une carte, une fois, seulement quand la langue vient du téléphone (aucun choix fait) et
// n'est pas le français. « Changer » : le choix explicite, synchronisé (`save`).
export function LangueDetecteeCarte({ save }) {
  const l = useLangue();
  const [, maj] = React.useReducer((x) => x + 1, 0);
  const d = langueDetectee();
  if (!d || d.vu || langueChoisie() || l === 'fr' || d.l !== l) return null;
  const garder = () => { noterLangueDetecteeVue(); maj(); };
  return (
    <section className="vrm-an-langue" data-langue-detectee={l} aria-label={tr('reglages.langue.lib')}>
      <span className="vrm-an-pastille"><Icone nom="globe" /></span>
      <p>{tr('nouveaux.langue.texte', { langue: NOMS_LANGUES[l] })}</p>
      <label className="vrm-an-langue-choix">
        <span className="vrm-an-sr">{tr('reglages.langue.lib')}</span>
        <select value={l} data-langue-changer="" onChange={(e) => { noterLangueDetecteeVue(); choisirLangue(e.target.value, save).then(maj); }}>
          {LANGUES.map((x) => <option key={x} value={x} lang={x}>{NOMS_LANGUES[x]}</option>)}
        </select>
      </label>
      <button type="button" className="vrm-an-secondaire vrm-an-langue-ok" data-langue-garder="" onClick={garder}>{tr('nouveaux.ok')}</button>
    </section>
  );
}

// ══ LE MONTAGE DANS LA COQUE ════════════════════════════════════════════════
// `deps` : { load, save, isCloudReady, onCloudReady, exempleActif, enTeteSession, FermeAuRetour,
//            bilanLignes, aExpedierPourCarte, lireImports, creeLe }.
// `donnees` : { vendu, caParMois, enLigne, luUneFois, parcours }. `retenu` : une autre feuille devant.
export function AccueilNouveauxCoque({ tab, retenu = false, donnees = {}, deps }) {
  const [pret, setPret] = React.useState(() => !!deps.isCloudReady());
  const [, maj] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => {
    const off = deps.onCloudReady(() => { setPret(true); maj(); });
    const f = (e) => { const k = e && e.detail && e.detail.k; if ([CLE_ECRANS_VUS, CLE_BILAN_MINUTE, CLE_PREMIER_COLIS, CLE_NOTIFS_DEMANDE].includes(k)) { maj(); if (k === CLE_ECRANS_VUS) signalerEcransVus(); } };
    window.addEventListener('vrm:save', f);
    return () => { if (typeof off === 'function') off(); window.removeEventListener('vrm:save', f); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const exemple = !!deps.exempleActif();

  // 138 — la liste des écrans vus : commencée une fois (compte neuf), puis chaque écran ouvert.
  React.useEffect(() => {
    if (!pret || exemple || !tab) return;
    const brut = deps.load(CLE_ECRANS_VUS, null);
    const w = premiereListe(brut, { creeLe: deps.creeLe(), ecran: tab }) || marquerVu(brut, tab);
    if (w) { deps.save(CLE_ECRANS_VUS, w); signalerEcransVus(); }
  }, [pret, exemple, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  // 132 — le bilan : une fois, après la première lecture ; ou rejoué (Paramètres → Aide).
  const [bilanOuvert, setBilanOuvert] = React.useState(false);
  const [imports, setImports] = React.useState(undefined);
  React.useEffect(() => { const o = () => setBilanOuvert(true); window.addEventListener('vrm:bilan-minute', o); return () => window.removeEventListener('vrm:bilan-minute', o); }, []);
  const montrer = doitMontrerBilan({ pret, exemple, retenu: retenu || tab !== 'journee', marqueur: deps.load(CLE_BILAN_MINUTE, null), parcours: donnees.parcours, luUneFois: donnees.luUneFois });
  React.useEffect(() => { if (montrer && !bilanOuvert) { deps.save(CLE_BILAN_MINUTE, marqueurBilan('vu')); setBilanOuvert(true); } }, [montrer]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { if (!bilanOuvert) return undefined; let mort = false; Promise.resolve(deps.lireImports(donnees.uids || [])).then((v) => { if (!mort) setImports(v); }, () => { if (!mort) setImports(null); }); return () => { mort = true; }; }, [bilanOuvert]); // eslint-disable-line react-hooks/exhaustive-deps
  const bilan = bilanOuvert ? bilanMinute({ vendu: donnees.vendu, somme: deps.bilanLignes, caParMois: donnees.caParMois, aExpedier: deps.aExpedierPourCarte(deps.load('vrm_colis_aposter', null)), retirer: deps.load('vrm_colis_retirer', null), enLigne: donnees.enLigne, imports }) : null;
  const finirBilan = (f) => { deps.save(CLE_BILAN_MINUTE, marqueurBilan(f)); setBilanOuvert(false); };

  // 137 — le premier colis : le signal d'un bordereau imprimé seul, puis l'attente des fenêtres.
  const [colis, setColis] = React.useState(false);
  const [notifs, setNotifs] = React.useState(null);   // { mode, moment } — la feuille seule
  React.useEffect(() => {
    let attente = 0;
    const surImpression = (e) => {
      if (!doitAccompagner({ pret: deps.isCloudReady(), exemple: !!deps.exempleActif(), marqueur: deps.load(CLE_PREMIER_COLIS, null), evt: e && e.detail })) return;
      const t0 = Date.now();
      clearInterval(attente);
      attente = setInterval(() => {
        if (Date.now() - t0 > 30 * 60000) { clearInterval(attente); return; }
        if (fenetreOuverte([...document.querySelectorAll('[role="dialog"][aria-modal="true"], [data-visionneuse-pdf]')])) return;
        clearInterval(attente); setColis(true);
      }, 500);
    };
    const rejouer = () => setColis(true);
    window.addEventListener(EVT_BORDEREAU_IMPRIME, surImpression); window.addEventListener('vrm:premier-colis', rejouer);
    return () => { clearInterval(attente); window.removeEventListener(EVT_BORDEREAU_IMPRIME, surImpression); window.removeEventListener('vrm:premier-colis', rejouer); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 142 — « Suivre » un colis touché, puis le retour dans VRM : la question, une fois.
  const plateforme = () => ({ notif: permission(), ios: estIos(), installee: estInstallee() });
  React.useEffect(() => {
    let suivi = false;
    const clic = (e) => { try { const a = e.target && e.target.closest && e.target.closest('a[href]'); if (a && estLienSuivi(a.getAttribute('href'))) suivi = true; } catch (_) {} };
    const retour = () => {
      if (!suivi || document.visibilityState !== 'visible') return;
      suivi = false;
      const mode = quoiProposer({ moment: 'colis-suivi', marqueur: deps.load(CLE_NOTIFS_DEMANDE, null), plateforme: plateforme(), exemple: !!deps.exempleActif(), pret: deps.isCloudReady() });
      if (mode) setNotifs({ mode, moment: 'colis-suivi' });
    };
    document.addEventListener('click', clic, true);
    document.addEventListener('visibilitychange', retour); window.addEventListener('focus', retour);
    return () => { document.removeEventListener('click', clic, true); document.removeEventListener('visibilitychange', retour); window.removeEventListener('focus', retour); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const notifsColis = colis ? quoiProposer({ moment: 'premier-colis', marqueur: deps.load(CLE_NOTIFS_DEMANDE, null), plateforme: plateforme(), exemple, pret }) : null;

  return <>
    {bilan ? <BilanMinute bilan={bilan} FermeAuRetour={deps.FermeAuRetour} onFin={() => finirBilan('fini')} onPasser={() => finirBilan('passe')} /> : null}
    {colis && !bilan ? <PremierColis deps={deps} notifs={notifsColis} onFini={() => setColis(false)} /> : null}
    {notifs && !colis && !bilan ? <FeuilleNotifs mode={notifs.mode} moment={notifs.moment} deps={deps} onFini={() => setNotifs(null)} /> : null}
  </>;
}
