// ── SE CONNECTER SUR L'ORDINATEUR AVEC L'IPHONE (14 nov., lot 119) ──────────────
// La règle et toutes ses garanties : api/_lib/qr-connexion.js (ticket signé ≤ 2 min,
// approuvé par le CLIC de l'iPhone connecté, session NEUVE fabriquée par le serveur,
// double vérification respectée). Deux morceaux d'écran :
//   · `QrOrdinateur` (écran de connexion) : demande un ticket, montre le QR (le ticket
//     SEUL, jamais le secret), attend toutes les 2 s, et se tait à l'expiration ;
//   · `ApprouverQr` (l'app connectée, ouverte par l'appareil photo de l'iPhone sur
//     `?connexion-qr=…`) : « Connecter “Mac de …” ? » — rien ne se passe sans son clic.
import React from 'react';
import { createPortal } from 'react-dom';
import qrcode from 'qrcode-generator';
import { tr } from './i18n/index.js';
import { useLangue } from './i18n/react.js';
import './styles-confort.css';

const ROUTE = '/api/compte?mode=qr-connexion';
export const PARAM_QR = 'connexion-qr';
const poster = async (corps, entetes = {}) => {
  try {
    const r = await fetch(ROUTE, { method: 'POST', headers: { 'Content-Type': 'application/json', ...entetes }, body: JSON.stringify(corps), cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    return { status: r.status, j: j || {} };
  } catch (_) { return { status: 0, j: {} }; }
};
// Le nom que l'ordinateur propose : « Mac », « PC Windows », « iPad »… modifiable.
export function nomParDefaut(ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '')) {
  if (/iPad/.test(ua)) return 'iPad';
  if (/Macintosh|Mac OS X/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'PC Windows';
  if (/Linux/.test(ua)) return 'Ordinateur Linux';
  return 'Ordinateur';
}
const qrDe = (texte) => { try { const q = qrcode(0, 'M'); q.addData(texte, 'Byte'); q.make(); return q.createDataURL(6, 2); } catch (_) { return ''; } };

export function QrOrdinateur({ onSession, origine = (typeof location !== 'undefined' ? location.origin : 'https://vrm.center') }) {
  useLangue();
  const [nom, setNom] = React.useState(() => nomParDefaut());
  const [t, setT] = React.useState(null);            // { ticket, secret, exp }
  const [etat, setEtat] = React.useState('choix');   // choix · attente · expire · refuse · erreur · connecte
  const [reste, setReste] = React.useState(0);
  const secret = React.useRef('');
  const lancer = async () => {
    setEtat('attente');
    const r = await poster({ action: 'creer', appareil: nom });
    if (r.status !== 200 || !r.j.ticket) { setEtat('erreur'); return; }
    secret.current = r.j.secret;                      // en mémoire seulement
    setT({ ticket: r.j.ticket, exp: r.j.exp, appareil: r.j.appareil });
  };
  React.useEffect(() => {
    if (!t || etat !== 'attente') return undefined;
    let fini = false;
    const tick = async () => {
      if (fini) return;
      const ms = t.exp - Date.now();
      setReste(Math.max(0, Math.ceil(ms / 1000)));
      if (ms <= 0) { setEtat('expire'); secret.current = ''; return; }
      const r = await poster({ action: 'attendre', ticket: t.ticket, secret: secret.current });
      if (fini) return;
      if (r.status === 200 && r.j.etat === 'connecte' && r.j.session) { fini = true; secret.current = ''; setEtat('connecte'); onSession(r.j.session); return; }
      if (r.status === 200 && r.j.etat === 'refuse') { fini = true; secret.current = ''; setEtat('refuse'); return; }
      if (r.status === 410) { fini = true; secret.current = ''; setEtat('expire'); return; }
      setTimeout(tick, 2000);
    };
    tick();
    return () => { fini = true; };
  }, [t, etat, onSession]);
  const lien = t ? `${origine}/?${PARAM_QR}=${encodeURIComponent(t.ticket)}` : '';
  return (
    <div className="vrm-cf vrm-cf-pile" data-qr-ordinateur={etat}>
      {etat === 'choix' || etat === 'erreur' ? <>
        <label className="vrm-cf-champ">{tr('confort.qr.nom')}<input value={nom} maxLength={40} onChange={(e) => setNom(e.target.value)} data-qr-nom=""/></label>
        <button type="button" className="vrm-cf-primaire" onClick={lancer} data-qr-lancer="">{tr('confort.qr.montrer')}</button>
        {etat === 'erreur' ? <p className="vrm-cf-doux vrm-cf-geste" data-qr-erreur="">{tr('confort.qr.erreur')}</p> : <p className="vrm-cf-doux">{tr('confort.qr.explique')}</p>}
      </> : null}
      {etat === 'attente' && t ? <>
        <img className="vrm-qr-img" src={qrDe(lien)} alt={tr('confort.qr.alt')} width={232} height={232} data-qr-image=""/>
        <p className="vrm-cf-doux">{tr('confort.qr.scanne')}</p>
        <p className="vrm-cf-doux" data-qr-reste={reste}>{tr('confort.qr.reste', { n: reste })}</p>
      </> : null}
      {etat === 'expire' || etat === 'refuse' ? <>
        <p className="vrm-cf-doux" data-qr-fin={etat}>{tr(etat === 'refuse' ? 'confort.qr.refuse' : 'confort.qr.expire')}</p>
        <button type="button" className="vrm-cf-second" onClick={() => { setT(null); setEtat('choix'); }}>{tr('confort.qr.recommencer')}</button>
      </> : null}
      {etat === 'connecte' ? <p className="vrm-cf-doux" data-qr-connecte="">{tr('confort.qr.connecte')}</p> : null}
    </div>
  );
}

// Le ticket lu dans l'adresse (puis retiré de la barre d'adresse : il ne reste pas dans l'historique).
export function ticketDeLAdresse() {
  try {
    const u = new URL(window.location.href);
    const v = u.searchParams.get(PARAM_QR);
    if (!v) return '';
    u.searchParams.delete(PARAM_QR);
    window.history.replaceState(window.history.state, '', u.pathname + (u.search ? u.search : '') + u.hash);
    return /^[A-Za-z0-9_.-]{20,600}$/.test(v) ? v : '';
  } catch (_) { return ''; }
}

export function ApprouverQr({ ticket, entetes, onFin }) {
  useLangue();
  const [v, setV] = React.useState(undefined);       // undefined lecture · { appareil, exp } · { erreur }
  const [etat, setEtat] = React.useState('');         // '' · envoi · approuve · refuse · mfa · erreur · deja
  React.useEffect(() => {
    let fini = false;
    poster({ action: 'voir', ticket }, entetes()).then((r) => {
      if (fini) return;
      if (r.status === 200 && !r.j.deja) setV({ appareil: r.j.appareil, exp: r.j.exp });
      else setV({ erreur: r.status === 410 ? 'expire' : r.j.deja ? 'deja' : 'erreur' });
    });
    return () => { fini = true; };
  }, [ticket, entetes]);
  const repondre = async (action) => {
    setEtat('envoi');
    const r = await poster({ action, ticket }, entetes());
    if (r.status === 200) setEtat(action === 'approuver' ? 'approuve' : 'refuse');
    else setEtat(r.j.erreur === 'mfa' ? 'mfa' : r.j.erreur === 'deja' ? 'deja' : r.status === 410 ? 'expire' : 'erreur');
  };
  const fin = etat === 'approuve' || etat === 'refuse' || etat === 'deja' || etat === 'expire' || (v && v.erreur);
  const corps = (
    <div className="vrm-cf-voile vrm-cf" role="dialog" aria-modal="true" aria-label={tr('confort.qr.approuverTitre')} data-qr-approuver={etat || (v === undefined ? 'lecture' : v.erreur || 'question')}>
      <div className="vrm-cf-feuille">
        {v === undefined ? <p className="vrm-cf-doux">{tr('confort.lecture')}</p>
          : v.erreur ? <p className="vrm-cf-doux" data-qr-approuver-erreur={v.erreur}>{tr(v.erreur === 'expire' ? 'confort.qr.expire' : v.erreur === 'deja' ? 'confort.qr.deja' : 'confort.qr.erreur')}</p>
          : etat === 'approuve' ? <p className="vrm-cf-titre" data-qr-approuve="">{tr('confort.qr.approuve', { nom: v.appareil })}</p>
          : etat === 'refuse' ? <p className="vrm-cf-doux">{tr('confort.qr.refuseIci')}</p>
          : <>
            <h2 className="vrm-cf-titre">{tr('confort.qr.question', { nom: v.appareil })}</h2>
            <p className="vrm-cf-doux">{tr('confort.qr.prudence')}</p>
            {etat === 'mfa' ? <p className="vrm-cf-doux vrm-cf-geste" data-qr-mfa="">{tr('confort.qr.mfa')}</p> : null}
            {etat === 'erreur' || etat === 'deja' || etat === 'expire' ? <p className="vrm-cf-doux vrm-cf-geste">{tr(etat === 'deja' ? 'confort.qr.deja' : etat === 'expire' ? 'confort.qr.expire' : 'confort.qr.erreur')}</p> : null}
            <button type="button" className="vrm-cf-primaire" disabled={etat === 'envoi'} onClick={() => repondre('approuver')} data-qr-oui="">{tr('confort.qr.oui')}</button>
            <button type="button" className="vrm-cf-second" disabled={etat === 'envoi'} onClick={() => repondre('refuser')} data-qr-non="">{tr('confort.qr.non')}</button>
          </>}
        {fin ? <button type="button" className="vrm-cf-second" onClick={onFin} data-qr-fermer="">{tr('confort.fermer')}</button> : null}
      </div>
    </div>
  );
  return typeof document !== 'undefined' ? createPortal(corps, document.body) : corps;
}
