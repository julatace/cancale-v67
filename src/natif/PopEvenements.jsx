// ── src/natif/PopEvenements.jsx — la carte d'un événement qui arrive (23 nov.) ─────────────────────────────────────────────
// Julien : « quand une vente arrive, un achat, etc., je veux un beau pop-up, là c'est moche ». Quand l'app est ouverte et au
// premier plan, la notification envoyée par le serveur (api/_lib/push.js, mise en forme par api/_lib/notif-belle.js) n'est plus
// la bannière du système : le service worker la passe à l'app (`vrm-evenement`, public/sw.js) et elle s'affiche ICI, avec les
// MÊMES données — titre, texte, adresse, photo prouvée (images*.vinted.net seulement), geste. Rien n'est inventé : sans photo,
// l'icône de la famille ; le site n'est dit que si l'étiquette de l'émetteur le nomme (`sale-`/`offer-` Vinted, `vc-` Vestiaire).
// Carte flottante en haut à droite (ordinateur) ou sous l'encoche (iPhone) ; trois au plus, les autres attendent ; elle part
// seule après 7 s, sauf survolée ou sous le doigt/le clavier ; elle attend qu'une feuille ou une confirmation se ferme (jamais
// par-dessus une action en cours) ; Échap ferme la plus récente. `prefers-reduced-motion` : un fondu, sans mouvement.
// Le bus `vrm:evenement` { title, body, url, image, tag, genre, actions } sert la même carte (bancs, autres modules).
import React from 'react';
import { createPortal } from 'react-dom';
import { LogoSite } from './LogoSite.jsx';
import { tr } from '../i18n/index.js';
import './pop-evenements.css';

const DUREE = 7000, MAX = 3;
const RE_PHOTO = /^https:\/\/images\d*\.vinted\.net\/[^\s"'<>]{8,480}$/i;
const ICONE_GENRE = { vente: 'cash', offre: 'tag', arrivee: 'pin', message: 'chat', bordereau: 'box', argent: 'cash', rappel: 'clock' };
const genreDeTag = (t) => { t = String(t || ''); if (/^(sale|vc-vente)-/.test(t)) return 'vente'; if (/^offer-/.test(t)) return 'offre'; if (/^(relais|retrait-code)-/.test(t)) return 'arrivee'; if (/^msg-/.test(t)) return 'message'; if (/^bord-/.test(t)) return 'bordereau'; if (/^final-/.test(t)) return 'argent'; if (/^rappel-/.test(t)) return 'rappel'; return ''; };
const siteDeTag = (t) => { t = String(t || ''); if (/^vc-/.test(t)) return 'vestiaire'; if (/^(sale|offer)-/.test(t)) return 'vinted'; if (/^lbc-/.test(t)) return 'leboncoin'; if (/^ebay-/.test(t)) return 'ebay'; return ''; };
const NOM_SITE = { vinted: 'Vinted', vestiaire: 'Vestiaire Collective', leboncoin: 'Leboncoin', ebay: 'eBay' };
const chemin = (u) => (typeof u === 'string' && u.startsWith('/') && !u.startsWith('//') ? u : '');
const texte = (s, n) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, n) : '');

// Une forme sûre, ou `null` (rien d'affiché pour un message sans titre).
export function evenementPropre(ev) {
  if (!ev || typeof ev !== 'object') return null;
  const titre = texte(ev.title, 90); if (!titre) return null;
  const tag = texte(ev.tag, 120);
  const genre = (typeof ev.genre === 'string' && ICONE_GENRE[ev.genre] ? ev.genre : '') || genreDeTag(tag);
  const actions = (Array.isArray(ev.actions) ? ev.actions : []).filter((a) => a && texte(a.title, 30)).slice(0, 1).map((a) => ({ titre: texte(a.title, 30), url: chemin(a.url) || chemin(ev.url) }));
  return { cle: tag || titre + '|' + texte(ev.body, 40), titre, detail: texte(ev.body, 160), url: chemin(ev.url), image: RE_PHOTO.test(String(ev.image || '')) ? String(ev.image) : '', genre, site: siteDeTag(tag), action: actions[0] || null };
}

const recouvrement = () => { try { return !!document.querySelector('[role="dialog"][aria-modal="true"], [data-n-poussee]:not([data-n-volet]), .vrm-fp'); } catch (_) { return false; } };
const aller = (u) => { if (!u) return; try { window.dispatchEvent(new CustomEvent('vrm:aller', { detail: u.replace(/^\//, '') })); } catch (_) {} };

function Carte({ e, Icon, onFermer, tenue, photoDe, i }) {
  // La photo : celle de la notification (prouvée par l'e-mail), sinon celle que l'app connaît PAR IDENTITÉ (n° de transaction,
  // n° de conversation de l'adresse — `photoDe`, src/App.jsx) ; jamais par ressemblance. Rien ⇒ l'icône de la famille.
  const [photo, setPhoto] = React.useState(e.image);
  React.useEffect(() => { if (e.image || typeof photoDe !== 'function') return undefined; let vivant = true;
    Promise.resolve().then(() => photoDe(e)).then((u) => { if (vivant && RE_PHOTO.test(String(u || ''))) setPhoto(String(u)); }).catch(() => {});
    return () => { vivant = false; }; }, [e, photoDe]);
  const [sort, setSort] = React.useState(false);
  const reste = React.useRef(DUREE);
  const fermer = React.useCallback(() => { setSort(true); setTimeout(() => onFermer(e.id), 190); }, [e.id, onFermer]);
  React.useEffect(() => {
    let debut = Date.now(), t = null, court = false;
    const lancer = () => { if (court) return; court = true; debut = Date.now(); t = setTimeout(fermer, Math.max(1500, reste.current)); };
    const pause = () => { if (!court) return; court = false; clearTimeout(t); reste.current -= Date.now() - debut; };
    e.ctl = { pause, lancer };
    lancer();
    const vis = () => (document.visibilityState === 'hidden' ? pause() : lancer());
    document.addEventListener('visibilitychange', vis);
    return () => { clearTimeout(t); document.removeEventListener('visibilitychange', vis); };
  }, [e, fermer]);
  // La pile entière est tenue (souris, doigt ou clavier sur N'IMPORTE QUELLE carte) : toutes attendent, toutes repartent ensemble.
  const premier = React.useRef(true);
  React.useEffect(() => { if (premier.current) { premier.current = false; if (!tenue) return; } if (!e.ctl) return; if (tenue) e.ctl.pause(); else e.ctl.lancer(); }, [tenue, e]);
  // (23 nov., iPhone) Balayer la carte vers le haut la ferme (comme une bannière d'iOS) ; relâchée avant 32 px, elle revient.
  const [glisse, setGlisse] = React.useState(0);
  const depart = React.useRef(null);
  const toucheDebut = (x) => { const t = x.touches && x.touches[0]; depart.current = t ? t.clientY : null; };
  const toucheMouv = (x) => { const t = x.touches && x.touches[0]; if (depart.current == null || !t) return; setGlisse(Math.min(0, t.clientY - depart.current)); };
  const toucheFin = () => { if (depart.current == null) return; depart.current = null; if (glisse < -32) fermer(); else setGlisse(0); };
  const geste = e.action || (e.url ? { titre: tr('pop.voir'), url: e.url } : null);
  return (
    <div className="n-pop" data-n-pop={e.genre || 'autre'} data-n-pop-sort={sort ? '1' : undefined} data-n-pop-rang={i} style={{ '--i': i, ...(glisse ? { transform: `translateY(${glisse}px)`, opacity: Math.max(0.3, 1 + glisse / 120), transition: 'none' } : {}) }} role="status"
      onTouchStart={toucheDebut} onTouchMove={toucheMouv} onTouchEnd={toucheFin} onTouchCancel={toucheFin} data-n-pop-glisse={glisse ? '1' : undefined} {...(i > 0 && !tenue ? { inert: '' } : {})}>
      {photo
        ? <img className="n-pop-photo" src={photo} alt="" referrerPolicy="no-referrer" loading="eager" decoding="async"/>
        : <span className="n-pop-ic" aria-hidden="true">{Icon ? <Icon name={ICONE_GENRE[e.genre] || 'bell2'} size={20}/> : null}</span>}
      <div className="n-pop-corps">
        <div className="n-pop-titre">{e.titre}</div>
        <div className="n-pop-detail">{e.site ? <LogoSite site={e.site} taille={14} nom={NOM_SITE[e.site]}/> : null}<span>{e.detail}</span></div>
      </div>
      {geste ? <button type="button" className="n-pop-geste" data-n-pop-geste="" onClick={() => { aller(geste.url); fermer(); }}>{geste.titre}</button> : null}
      <button type="button" className="n-pop-fermer" aria-label={tr('pop.fermer')} title={tr('pop.fermer')} onClick={fermer}>
        {Icon ? <Icon name="close" size={16}/> : '×'}
      </button>
    </div>
  );
}

export function PopEvenements({ Icon, photoDe = null }) {
  const [vues, setVues] = React.useState([]);
  const [souris, setSouris] = React.useState(false), [focus, setFocus] = React.useState(false), [doigt, setDoigt] = React.useState(false);
  const [deplie, setDeplie] = React.useState(false);
  const tenue = souris || focus || doigt || deplie;
  const attente = React.useRef([]);
  const vuesRef = React.useRef([]); vuesRef.current = vues;
  const servir = React.useCallback(() => {
    if (recouvrement() || !attente.current.length) return;
    setVues((v) => { const place = MAX - v.length; if (place <= 0) return v; const pris = attente.current.splice(0, place); return [...pris.reverse(), ...v]; });
  }, []);
  const poser = React.useCallback((ev) => {
    const e = evenementPropre(ev); if (!e) return false;
    e.id = Date.now() + Math.random();
    // Le même objet (même étiquette) remplace sa carte au lieu d'en empiler une deuxième.
    attente.current = attente.current.filter((x) => x.cle !== e.cle);
    setVues((v) => v.filter((x) => x.cle !== e.cle));
    attente.current.push(e); setTimeout(servir, 0);
    return true;
  }, [servir]);
  React.useEffect(() => {
    const sw = (m) => { const d = m && m.data; if (!d || d.type !== 'vrm-evenement') return; const ok = poser(d.ev); try { if (m.ports && m.ports[0]) m.ports[0].postMessage({ montree: ok }); } catch (_) {} };
    const bus = (x) => poser(x && x.detail);
    const echap = (k) => { if (k.key === 'Escape' && vuesRef.current.length && !recouvrement()) { const p = vuesRef.current[0]; setVues((v) => v.filter((y) => y.id !== p.id)); } };
    try { if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('message', sw); } catch (_) {}
    window.addEventListener('vrm:evenement', bus); window.addEventListener('keydown', echap);
    const t = setInterval(servir, 600);
    return () => { clearInterval(t); try { if (navigator.serviceWorker) navigator.serviceWorker.removeEventListener('message', sw); } catch (_) {} window.removeEventListener('vrm:evenement', bus); window.removeEventListener('keydown', echap); };
  }, [poser, servir]);
  const fermer = React.useCallback((id) => { setVues((v) => { const n = v.filter((x) => x.id !== id); if (n.length < 2) setDeplie(false); return n; }); setTimeout(servir, 50); }, [servir]);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="n-pops" aria-live="polite" aria-label={tr('pop.region')} data-n-pops={vues.length} data-n-pops-tenue={tenue ? '1' : undefined}
      onMouseEnter={() => setSouris(true)} onMouseLeave={() => setSouris(false)}
      onFocus={() => setFocus(true)} onBlur={(x) => { if (!x.currentTarget.contains(x.relatedTarget)) setFocus(false); }}
      onTouchStart={() => setDoigt(true)} onTouchEnd={() => setTimeout(() => setDoigt(false), 1200)} onTouchCancel={() => setDoigt(false)}
      data-n-pops-ouvert={tenue && vues.length > 1 ? '1' : undefined}>
      {vues.map((e, i) => <Carte key={e.id} e={e} i={i} Icon={Icon} onFermer={fermer} tenue={tenue} photoDe={photoDe}/>)}
      {/* Empilement compact : la plus récente en entier, les autres repliées derrière ; « +2 » les déplie (doigt, clavier). */}
      {vues.length > 1 ? <button type="button" className="n-pops-plus" data-n-pops-plus={vues.length - 1} aria-expanded={tenue} onClick={() => setDeplie((v) => !v)}>
        {tenue ? tr('pop.replier') : '+' + (vues.length - 1)}</button> : null}
    </div>, document.body);
}
export default PopEvenements;
