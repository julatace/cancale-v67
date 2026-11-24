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
import { TuilePaire, Confettis, numeroPropre, mouvementReduit } from './Jeu.jsx';
import { tr } from '../i18n/index.js';
import { ICONE_FAMILLE } from '../../api/_lib/notif-belle.js';
import './pop-evenements.css';

const DUREE = 7000, MAX = 3;
const RE_PHOTO = /^https:\/\/images\d*\.vinted\.net\/[^\s"'<>]{8,480}$/i;
// (24 nov., « comme un jeu vidéo ») une icône par sorte d'événement : favori (cœur), Vinted a agi (œil), erreur (alerte).
const ICONE_GENRE = { vente: 'cash', offre: 'tag', arrivee: 'pin', message: 'chat', bordereau: 'box', argent: 'wallet', rappel: 'clock', favori: 'heart', avis: 'star', moderation: 'eye', erreur: 'alert' };
const genreDeTag = (t) => { t = String(t || ''); if (/^(sale|vc-vente|vendu-leboncoin|vendu-ebay)-/.test(t)) return 'vente'; if (/^(fav|favoris-[a-z]+)-/.test(t)) return 'favori'; if (/^vrm-(moderation|compte-bloque)-/.test(t)) return 'moderation'; if (/^offer-/.test(t)) return 'offre'; if (/^(relais|retrait-code)-/.test(t)) return 'arrivee'; if (/^msg-/.test(t)) return 'message'; if (/^bord-/.test(t)) return 'bordereau'; if (/^final-/.test(t)) return 'argent'; if (/^rappel-/.test(t)) return 'rappel'; return ''; };
const siteDeTag = (t) => { t = String(t || ''); if (/^vc-/.test(t)) return 'vestiaire'; if (/^(sale|offer)-/.test(t)) return 'vinted'; if (/^lbc-/.test(t)) return 'leboncoin'; if (/^ebay-/.test(t)) return 'ebay'; return ''; };
const NOM_SITE = { vinted: 'Vinted', vestiaire: 'Vestiaire Collective', leboncoin: 'Leboncoin', ebay: 'eBay' };
const chemin = (u) => (typeof u === 'string' && u.startsWith('/') && !u.startsWith('//') ? u : '');
const texte = (s, n) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, n) : '');
// La galerie du propriétaire (données d'exemple) montre les photos d'EXEMPLE de l'app (public/exemple/, crédits
// public/exemple/CREDITS.md) ; une vraie notification, seulement une photo Vinted prouvée.
const RE_PHOTO_EXEMPLE = /^\/exemple\/[a-z0-9-]{3,80}-(120|400)\.webp$/;
// (24 nov.) Le N° de l'étiquette : celui que l'émetteur a POSÉ (`numero`), sinon celui qu'il a ÉCRIT dans son texte (« N°124 »,
// tiré par le serveur de ses propres règles d'identité) — jamais deviné ici. Il est retiré du texte (un nombre ne s'écrit pas
// deux fois, CLAUDE.md §7).
const RE_N = /N°\s?([A-Z]{0,2}\d{1,6})\b/;
export const numeroDeEvenement = (ev) => { const p = numeroPropre(ev && ev.numero); if (p) return p; for (const s of [ev && ev.title, ev && ev.body]) { const m = RE_N.exec(String(s || '')); if (m) return numeroPropre(m[1]); } return ''; };
const sansNumero = (s, n) => { if (!n || !s) return s; const t = s.replace(new RegExp('\\s*(·\\s*)?N°\\s?' + n + '\\b(\\s*·)?\\s*'), (m, a, b) => (a && b ? ' · ' : ' ')).trim().replace(/^·\s*/, ''); return t && t !== s ? t.charAt(0).toUpperCase() + t.slice(1) : s; };

// Une forme sûre, ou `null` (rien d'affiché pour un message sans titre).
export function evenementPropre(ev) {
  if (!ev || typeof ev !== 'object') return null;
  const titre = texte(ev.title, 90); if (!titre) return null;
  const tag = texte(ev.tag, 120);
  const genre = (typeof ev.genre === 'string' && ICONE_GENRE[ev.genre] ? ev.genre : '') || genreDeTag(tag);
  const actions = (Array.isArray(ev.actions) ? ev.actions : []).filter((a) => a && texte(a.title, 30)).slice(0, 1).map((a) => ({ titre: texte(a.title, 30), url: chemin(a.url) || chemin(ev.url) }));
  const icone = ICONE_GENRE[genre] || (typeof ev.famille === 'string' && ICONE_FAMILLE[ev.famille]) || 'bell2';
  const numero = numeroDeEvenement(ev);
  const image = RE_PHOTO.test(String(ev.image || '')) ? String(ev.image) : (ev.galerie === true && RE_PHOTO_EXEMPLE.test(String(ev.image || '')) ? String(ev.image) : '');
  return { cle: tag || titre + '|' + texte(ev.body, 40), titre: sansNumero(titre, numero), detail: sansNumero(texte(ev.body, 160), numero), numero, url: chemin(ev.url), image, genre, icone, site: siteDeTag(tag), action: actions[0] || null };
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
  // `sort` : '' (là) · 'haut' (le temps, la croix, Échap) · 'gauche' / 'droite' (balayée) — la sortie part dans le sens du geste.
  const [sort, setSort] = React.useState('');
  const reste = React.useRef(DUREE);
  const fermer = React.useCallback((sens = 'haut') => { setSort(sens || 'haut'); setTimeout(() => onFermer(e.id), mouvementReduit() ? 140 : 230); }, [e.id, onFermer]);
  React.useEffect(() => {
    let debut = Date.now(), t = null, court = false;
    const lancer = () => { if (court) return; court = true; debut = Date.now(); t = setTimeout(() => fermer('haut'), Math.max(1500, reste.current)); };
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
  // (24 nov., « balayer pour fermer ») Le doigt ou la souris tire la carte : de côté (gauche ou droite) ou vers le haut. Le sens
  // se décide après 8 px ; vers le bas, elle résiste (élastique). Lâchée au-delà de 80 px (40 vers le haut) ou lancée vite
  // (> 0,5 px/ms), elle part dans ce sens ; sinon elle revient sur un ressort. Un tirage n'est jamais un clic.
  const [tire, setTire] = React.useState(null);   // { x, y } pendant le geste
  const geste0 = React.useRef(null), aTire = React.useRef(false);
  const bas = (x) => { if (sort || (x.button != null && x.button !== 0)) return; geste0.current = { x: x.clientX, y: x.clientY, t: performance.now(), axe: '', vx: 0, vy: 0, px: x.clientX, py: x.clientY, pt: performance.now(), id: x.pointerId }; aTire.current = false; };
  const bouge = (x) => {
    const g = geste0.current; if (!g || x.pointerId !== g.id) return;
    const dx = x.clientX - g.x, dy = x.clientY - g.y;
    if (!g.axe) { if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return; g.axe = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'; aTire.current = true; try { x.currentTarget.setPointerCapture(x.pointerId); } catch (_) {} }
    const now = performance.now(), dt = Math.max(1, now - g.pt); g.vx = (x.clientX - g.px) / dt; g.vy = (x.clientY - g.py) / dt; g.px = x.clientX; g.py = x.clientY; g.pt = now;
    setTire(g.axe === 'x' ? { x: dx, y: 0 } : { x: 0, y: dy < 0 ? dy : Math.sqrt(dy) * 3 });
  };
  const haut = () => {
    const g = geste0.current; geste0.current = null; if (!g || !g.axe) { setTire(null); return; }
    const t = tire || { x: 0, y: 0 };
    if (g.axe === 'x' && (Math.abs(t.x) > 80 || Math.abs(g.vx) > 0.5)) { setTire(null); fermer((t.x || g.vx) < 0 ? 'gauche' : 'droite'); return; }
    if (g.axe === 'y' && (t.y < -40 || g.vy < -0.5)) { setTire(null); fermer('haut'); return; }
    setTire(null);
  };
  const geste = e.action || (e.url ? { titre: tr('pop.voir'), url: e.url } : null);
  const fete = e.genre === 'vente' && i === 0;
  const style = { '--i': i };
  if (tire) { style.transform = `translate(${tire.x}px, ${tire.y}px) rotate(${(tire.x / 28).toFixed(2)}deg)`; style.opacity = Math.max(0.35, 1 - Math.abs(tire.x) / 320 + Math.min(0, tire.y) / 140); style.transition = 'none'; }
  return (
    <div className="n-pop" data-n-pop={e.genre || 'autre'} data-n-pop-sort={sort || undefined} data-n-pop-rang={i} data-n-pop-numero={e.numero || undefined}
      data-n-pop-photo={photo ? '1' : '0'} data-n-pop-fete={fete ? '1' : undefined} style={style} role="status"
      onPointerDown={bas} onPointerMove={bouge} onPointerUp={haut} onPointerCancel={haut}
      onClickCapture={(x) => { if (aTire.current) { x.stopPropagation(); x.preventDefault(); aTire.current = false; } }}
      data-n-pop-glisse={tire ? '1' : undefined} {...(i > 0 && !tenue ? { inert: '' } : {})}>
      <TuilePaire photo={photo} numero={e.numero} icone={e.icone} genre={e.genre} Icon={Icon} taille="l" className="n-pop-tuile">
        {fete ? <Confettis graine={Math.round(e.id % 97) + 1}/> : null}
      </TuilePaire>
      <div className="n-pop-corps">
        <div className="n-pop-titre">{e.titre}</div>
        <div className="n-pop-detail">{e.site ? <LogoSite site={e.site} taille={14} nom={NOM_SITE[e.site]}/> : null}<span>{e.detail}</span></div>
        {geste ? <button type="button" className="n-pop-geste" data-n-pop-geste="" onClick={() => { aller(geste.url); fermer('haut'); }}>
          {Icon ? <Icon name={e.icone === 'cash' || e.icone === 'wallet' ? 'eye' : e.icone} size={14}/> : null}<span>{geste.titre}</span></button> : null}
      </div>
      <button type="button" className="n-pop-fermer" aria-label={tr('pop.fermer')} title={tr('pop.fermer')} onClick={() => fermer('haut')}>
        {Icon ? <Icon name="close" size={14}/> : '×'}
      </button>
      {fete ? <span className="n-pop-reflet" aria-hidden="true"/> : null}
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
    // (la galerie du propriétaire, `galerie`, passe même page de Paramètres ouverte : c'est elle qu'il regarde)
    if (!attente.current.length || (recouvrement() && !attente.current[0].galerie)) return;
    setVues((v) => { const place = MAX - v.length; if (place <= 0) return v; const pris = attente.current.splice(0, place); return [...pris.reverse(), ...v]; });
  }, []);
  const poser = React.useCallback((ev) => {
    const e = evenementPropre(ev); if (!e) return false;
    e.id = Date.now() + Math.random(); e.galerie = !!(ev && ev.galerie);
    // Le même objet (même étiquette) remplace sa carte au lieu d'en empiler une deuxième.
    attente.current = attente.current.filter((x) => x.cle !== e.cle);
    setVues((v) => v.filter((x) => x.cle !== e.cle));
    attente.current.push(e); setTimeout(servir, 0);
    return true;
  }, [servir]);
  React.useEffect(() => {
    const sw = (m) => { const d = m && m.data; if (!d || d.type !== 'vrm-evenement') return; const ok = poser(d.ev); try { if (m.ports && m.ports[0]) m.ports[0].postMessage({ montree: ok }); } catch (_) {} };
    const bus = (x) => poser(x && x.detail);
    const vider = () => { attente.current = []; setVues([]); };
    const echap = (k) => { if (k.key === 'Escape' && vuesRef.current.length && !recouvrement()) { const p = vuesRef.current[0]; setVues((v) => v.filter((y) => y.id !== p.id)); } };
    try { if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('message', sw); } catch (_) {}
    window.addEventListener('vrm:evenement', bus); window.addEventListener('vrm:evenements-vider', vider); window.addEventListener('keydown', echap);
    const t = setInterval(servir, 600);
    return () => { clearInterval(t); try { if (navigator.serviceWorker) navigator.serviceWorker.removeEventListener('message', sw); } catch (_) {} window.removeEventListener('vrm:evenement', bus); window.removeEventListener('vrm:evenements-vider', vider); window.removeEventListener('keydown', echap); };
  }, [poser, servir]);
  const fermer = React.useCallback((id) => { setVues((v) => { const n = v.filter((x) => x.id !== id); if (n.length < 2) setDeplie(false); return n; }); setTimeout(servir, 50); }, [servir]);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="n-pops" aria-live="polite" aria-label={tr('pop.region')} data-n-pops={vues.length} data-n-pops-tenue={tenue ? '1' : undefined}
      onMouseEnter={() => setSouris(true)} onMouseLeave={() => setSouris(false)}
      onFocus={(x) => { let clavier = false; try { clavier = x.target.matches(':focus-visible'); } catch (_) {} if (clavier) setFocus(true); }} onBlur={(x) => { if (!x.currentTarget.contains(x.relatedTarget)) setFocus(false); }}
      onTouchStart={() => setDoigt(true)} onTouchEnd={() => setTimeout(() => setDoigt(false), 1200)} onTouchCancel={() => setDoigt(false)}
      data-n-pops-ouvert={tenue && vues.length > 1 ? '1' : undefined}>
      {vues.map((e, i) => <Carte key={e.id} e={e} i={i} Icon={Icon} onFermer={fermer} tenue={tenue} photoDe={photoDe}/>)}
      {/* Empilement compact : la plus récente en entier, les autres repliées derrière ; « +2 » les déplie (doigt, clavier). */}
      {vues.length > 1 ? <button type="button" className="n-pops-plus" data-n-pops-plus={vues.length - 1} aria-expanded={tenue} onClick={() => setDeplie((v) => !v)}>
        {tenue ? tr('pop.replier') : <span key={vues.length} className="n-pops-compte">{'+' + (vues.length - 1)}</span>}</button> : null}
    </div>, document.body);
}
export default PopEvenements;
