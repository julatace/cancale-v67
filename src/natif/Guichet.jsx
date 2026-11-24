// ════════════════════════════════════════════════════════════════════════════
//  src/natif/Guichet.jsx — AU COMPTOIR : LES CODES D'UN POINT, EN GRAND (24 nov., lot retrait-parfait)
//  Julien : « pour le retrait tu dois vraiment faire quelque chose de parfait ».
//  Une feuille par POINT (« un point = une carte », §5) : tous les colis de CE point, l'un après l'autre (glisser, ‹ ›,
//  points de pagination), chacun avec son CODE en très grand (chiffres groupés, chasse fixe, sur BLANC même en sombre),
//  son QR à la taille maximale (sur blanc), le nom du point et l'échéance LUE ; « Retiré » sur SON toucher (le geste
//  d'avant : `retirerRelais` ⇒ `markCollected` / `markPickupDone`, annulable), « Annuler » juste après.
//  · L'écran ne s'éteint pas tant que la feuille est ouverte (Wake Lock, `useEcranAllume`) ; la luminosité, aucune API web
//    ne la règle : une ligne le dit.
//  · Le geste RETOUR (iPhone / Android), ← et Échap ferment la feuille (`FermeAuRetourUi`, le vrai `FermeAuRetour` de l'app).
//  · HORS LIGNE : les codes sont déjà dans la page (rien n'est relu pour les montrer) ; un QR hébergé chez le transporteur
//    qui ne charge plus est redemandé à la réserve du service worker (`/hl-qr?u=…`, src/journeeHorsLigne.js, la même que
//    Ma journée hors ligne), réchauffée pendant que le réseau est là (`rechaufferQrs`). Rien gardé ⇒ « donne le code ».
//  AUCUNE règle ici : la liste vient de `colisDuPoint` (src/retraitsVue.js) ; un colis retiré ici sort de « à retirer »
//  par la règle d'avant (`pickupUnion`), la carte du point se refait toute seule ; la feuille garde sa copie (« Retiré ✓ »).
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { createPortal } from 'react-dom';
import { tr, localeCourante } from '../i18n/index.js';
import { useEcranAllume } from '../ModeRelais.jsx';
import { FermeAuRetourUi } from '../ui/retour.jsx';
import { adresseQrLocale } from '../journeeHorsLigne.js';
import { rangeeRetrait } from '../contenuColis.js';
import { Plaque } from './Plaque.jsx';
import './guichet.css';

// « 978216 » ⇒ ['978', '216'] (la même découpe que la rangée : src/natif/RetraitsPoints.jsx `grouperCode`).
function grouper(code) {
  const c = String(code || '');
  if (!c) return [];
  if (/\s/.test(c)) return c.split(/\s+/).filter(Boolean);
  const pas = c.length > 7 ? 4 : c.length === 4 ? 2 : 3;
  const out = [];
  for (let i = 0; i < c.length; i += pas) out.push(c.slice(i, i + pas));
  if (out.length > 1 && out[out.length - 1].length === 1) { const d = out.pop(); out[out.length - 1] += d; }
  return out;
}

// Les QR hébergés (https) mis en réserve PENDANT que le réseau est là : `/hl-qr?u=…` (même origine) — le service worker
// va le chercher et le range (`x-vrm-hl-qr`, public/sw.js). Une fois par adresse et par ouverture de l'app.
const _rechauffes = new Set();
export function rechaufferQrs(urls) {
  try {
    if (typeof navigator === 'undefined' || !navigator.onLine) return;
    const sw = navigator.serviceWorker;
    if (!sw || !sw.controller) return;
    for (const u of urls || []) {
      if (!/^https:\/\//i.test(String(u || '')) || _rechauffes.has(u)) continue;
      _rechauffes.add(u);
      fetch(adresseQrLocale(u), { credentials: 'omit', headers: { 'x-vrm-hl-qr': '1' } }).catch(() => { _rechauffes.delete(u); });
    }
  } catch (_) {}
}

function useEnLigne() {
  const [en, setEn] = React.useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  React.useEffect(() => {
    const f = () => setEn(navigator.onLine !== false);
    window.addEventListener('online', f); window.addEventListener('offline', f);
    return () => { window.removeEventListener('online', f); window.removeEventListener('offline', f); };
  }, []);
  return en;
}

// Le QR : l'image lue (data: ou hébergée) ; une image hébergée qui ne charge pas ⇒ la réserve hors ligne ; rien ⇒ null.
function QrGrand({ src, titre }) {
  const [etape, setEtape] = React.useState(0);   // 0 l'adresse lue · 1 la réserve · 2 rien
  React.useEffect(() => { setEtape(0); }, [src]);
  if (!src) return null;
  const heberge = /^https:\/\//i.test(String(src));
  const url = etape === 0 ? src : etape === 1 && heberge ? adresseQrLocale(src) : '';
  if (!url) return <p className="n-gc-qr-ko" data-gc-qr-ko="">{tr('retraits.g.qrHorsLigne')}</p>;
  return (
    <div className="n-gc-qr" data-gc-qr={etape === 0 ? 'lu' : 'reserve'}>
      <img src={url} alt={tr('retraits.g.qrAlt', { titre })} draggable={false} data-stream-image="code"
        onError={() => setEtape((e) => (e === 0 && heberge ? 1 : 2))}/>
    </div>
  );
}

function Diapo({ x, aides, Photo, etat, onRetire, onAnnuler, loc, actif }) {
  const rg = rangeeRetrait(x) || { limite: {} };
  const conflit = Array.isArray(x.codesDesaccord) && x.codesDesaccord.length > 1;
  const code = conflit ? '' : String(x.code || '');
  const code2 = String(x.code2 || '');
  const qr = aides.qrSrc ? aides.qrSrc(x) : '';
  const titre = (rg.titre || (aides.titre ? aides.titre(x) : '') || '').trim();
  const photo = x.photo && Photo ? Photo(x.photo) : null;   // la photo de l'achat relié PAR IDENTITÉ (pickupUnion), sinon rien
  const lim = rg.limite && rg.limite.source === 'lue' && rg.limite.jour ? rg.limite.jour : '';
  let limTxt = '';
  if (lim) { try { limTxt = tr('retraits.p.echAvant', { date: new Date(lim + 'T12:00:00').toLocaleDateString(loc, { weekday: 'short', day: 'numeric', month: 'short' }) }); } catch (_) { limTxt = ''; } }
  const retire = etat && etat.fait;
  return (
    <section className={'n-gc-diapo' + (retire ? ' is-retire' : '')} data-gc-diapo={x.cle || x.id} data-gc-code={code} data-gc-limite={lim} data-gc-etat={retire ? 'retire' : 'a-retirer'}
      aria-hidden={actif ? undefined : 'true'} aria-roledescription="diapositive">
      <div className="n-gc-paire">
        <span className="n-gc-photo" data-gc-photo={photo ? '1' : '0'} aria-hidden="true">{photo}</span>
        <span className="n-gc-paire-txt">
          <span className="n-gc-paire-titre" data-gc-titre="">{titre || tr('retraits.g.colis')}</span>
          <span className="n-gc-paire-meta">{x.num ? <Plaque numero={x.num}/> : null}{limTxt ? <span data-gc-limite-txt="">{limTxt}</span> : null}</span>
        </span>
      </div>
      <div className="n-gc-blanc" data-gc-blanc="">
        {code2 ? <div className="n-gc-code-bloc is-second"><span className="n-gc-code-mot">{tr('retraits.g.identifiant')}</span>
          <code className="n-gc-code vrm-sensible" data-stream-type="code" data-gc-code2={code2}>{grouper(code2).map((m, i) => <span key={i}>{m}</span>)}</code></div> : null}
        {code ? <div className="n-gc-code-bloc"><span className="n-gc-code-mot">{tr(code2 ? 'retraits.g.codeOuverture' : 'retraits.b.code')}</span>
          <code className={'n-gc-code vrm-sensible' + (code.length > 7 ? ' is-long' : '')} data-stream-type="code" data-gc-code-grand={code} aria-label={code.split('').join(' ')}>
            {grouper(code).map((m, i) => <span key={i}>{m}</span>)}</code></div> : null}
        {conflit ? <div className="n-gc-code-bloc" data-gc-desaccord=""><span className="n-gc-code-mot">{tr('v2.passe.codesEnConflit')}</span>
          {x.codesDesaccord.map((d) => <code key={d.source + d.code} className="n-gc-code is-moyen vrm-sensible" data-stream-type="code">{d.code}</code>)}</div> : null}
        <QrGrand src={qr} titre={titre}/>
        {!code && !code2 && !qr && !conflit ? <p className="n-gc-sans" data-gc-sans-code="">{tr('retraits.g.sansCode')}</p> : null}
      </div>
      <div className="n-gc-geste">
        {retire ? <>
          <span className="n-gc-fait" role="status" data-gc-retire-fait=""><span aria-hidden="true">✓</span> {tr('retraits.g.retireFait')}</span>
          {etat.id != null && onAnnuler ? <button type="button" className="n-gc-b" data-gc-annuler="" onClick={onAnnuler}>{tr('retraits.g.annuler')}</button> : null}
        </> : onRetire ? <button type="button" className="n-gc-b is-plein" data-gc-retirer={x.cle || x.id} onClick={onRetire}>{tr('retraits.g.retire')}</button> : null}
        {aides.details && aides.details(x) ? <button type="button" className="n-gc-b is-lien" data-gc-details="" onClick={aides.details(x)}>{tr('retraits.g.details')}</button> : null}
      </div>
    </section>
  );
}

// `colis` : les colis du point (comptés puis « à vérifier » gardés), dans l'ordre de la carte ; `depart` : la clé du colis touché.
export function Guichet({ point, colis = [], depart = '', aides, Photo, Icon, Logo, nomPoint = '', onFermer }) {
  const [liste] = React.useState(() => colis.filter(Boolean));   // la copie : un colis retiré reste ici « Retiré ✓ »
  const [etats, setEtats] = React.useState({});
  const i0 = Math.max(0, liste.findIndex((x) => (x.cle || x.id) === depart));
  const [idx, setIdx] = React.useState(i0);
  const rail = React.useRef(null);
  const veille = useEcranAllume();
  const enLigne = useEnLigne();
  const loc = localeCourante();
  const n = liste.length;
  const fermer = React.useRef(onFermer); fermer.current = onFermer;
  const fermerMaintenant = React.useCallback(() => { if (fermer.current) fermer.current(); }, []);
  // La page dessous ne défile plus tant que la feuille est ouverte.
  React.useEffect(() => { const h = document.documentElement; const avant = h.style.overflow; h.style.overflow = 'hidden'; return () => { h.style.overflow = avant; }; }, []);
  React.useLayoutEffect(() => { const r = rail.current; if (r && i0) r.scrollLeft = i0 * r.clientWidth; }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  const surDefile = () => { const r = rail.current; if (!r || !r.clientWidth) return; const k = Math.round(r.scrollLeft / r.clientWidth); if (k !== idx && k >= 0 && k < n) setIdx(k); };
  const aller = (k) => { const r = rail.current; if (!r || k < 0 || k >= n) return; setIdx(k); try { r.scrollTo({ left: k * r.clientWidth, behavior: 'smooth' }); } catch (_) { r.scrollLeft = k * r.clientWidth; } };
  const retirer = (x) => { const cle = x.cle || x.id; let id = null; try { id = aides.retirer ? aides.retirer(x) : null; } catch (_) { id = null; } setEtats((e) => ({ ...e, [cle]: { fait: true, id: id == null ? null : id } })); };
  const annuler = (x) => { const cle = x.cle || x.id; const e = etats[cle]; if (e && e.id != null && aides.annuler) { try { aides.annuler(e.id); } catch (_) {} } setEtats((s) => { const u = { ...s }; delete u[cle]; return u; }); };
  const transp = ((point && point.transporteurs) || [])[0] || '';
  const nRetires = Object.values(etats).filter((e) => e && e.fait).length;
  const corps = (
    <div className="n-gc-voile" data-gc-voile="" data-noswipe="1">
      <FermeAuRetourUi fermer={fermerMaintenant}/>
      <div className="n-gc" role="dialog" aria-modal="true" aria-label={tr('retraits.g.titre') + ' · ' + nomPoint}
        data-gc="" data-gc-point={point && (point.inconnu ? 'inconnu' : String(point.numero || point.cle || ''))} data-gc-n={String(n)} data-gc-position={n ? `${idx + 1}/${n}` : '0/0'}
        data-gc-veille={veille} data-gc-hors-ligne={enLigne ? '0' : '1'} data-gc-retires={String(nRetires)}>
        <header className="n-gc-tete">
          <span className="n-gc-logo" aria-hidden="true">{transp && Logo ? <Logo cle={transp} taille={32}/> : (Icon ? <Icon name="shop" size={20}/> : null)}</span>
          <span className="n-gc-tete-txt">
            <span className="n-gc-nom" data-gc-nom="">{nomPoint}</span>
            <span className="n-gc-sous">{n > 1 ? tr('retraits.g.position', { i: idx + 1, n }) : tr('retraits.v.nColis', { n })}</span>
          </span>
          <button type="button" className="n-gc-fermer" data-gc-fermer="" aria-label={tr('retraits.g.fermer')} onClick={fermerMaintenant}>{Icon ? <Icon name="close" size={22}/> : '×'}</button>
        </header>
        {!enLigne ? <p className="n-gc-bande" data-gc-bande-hors-ligne="">{Icon ? <Icon name="cloudOff" size={16}/> : null}<span>{tr('retraits.g.horsLigne')}</span></p> : null}
        <div className="n-gc-rail" ref={rail} onScroll={surDefile} data-gc-rail="">
          {liste.map((x, k) => <Diapo key={x.cle || x.id} x={x} aides={aides} Photo={Photo} loc={loc} actif={k === idx} etat={etats[x.cle || x.id]}
            onRetire={aides.retirer ? () => retirer(x) : null} onAnnuler={() => annuler(x)}/>)}
        </div>
        <footer className="n-gc-pied">
          {n > 1 ? <div className="n-gc-pages">
            <button type="button" className="n-gc-fleche" data-gc-precedent="" aria-label={tr('retraits.g.precedent')} disabled={idx === 0} onClick={() => aller(idx - 1)}>{Icon ? <Icon name="chevron" size={20} style={{ transform: 'rotate(180deg)' }}/> : '‹'}</button>
            <span className="n-gc-points" aria-hidden="true">{liste.map((x, k) => <i key={k} className={k === idx ? 'is-ici' : (etats[x.cle || x.id] ? 'is-fait' : '')}/>)}</span>
            <button type="button" className="n-gc-fleche" data-gc-suivant="" aria-label={tr('retraits.g.suivant')} disabled={idx >= n - 1} onClick={() => aller(idx + 1)}>{Icon ? <Icon name="chevron" size={20}/> : '›'}</button>
          </div> : null}
          <p className="n-gc-lumiere" data-gc-lumiere="">{Icon ? <Icon name="sun" size={16}/> : null}<span>{tr('retraits.g.lumiere')}</span></p>
        </footer>
      </div>
    </div>
  );
  return typeof document !== 'undefined' ? createPortal(corps, document.body) : corps;
}

export default Guichet;
