// ── « RELIER LA BOÎTE DE <COMPTE> » (6 nov., onglets C ; refait le 10 nov. au soir) ──
// Julien, 10 nov. : « pk ça charge en continu, je veux que tout soit plus beau ».
// Le pas-à-pas d'UN compte Vinted dont les e-mails n'arrivent pas vit désormais
// DANS le parcours unique « Ton adresse VRM » (src/AdresseReception.jsx) ; ce
// fichier n'en garde que deux pièces, sans aucune requête (la lecture est passée
// par l'écran, `lireDernier`) :
//   · `ChoixCompte` — les comptes à relier en puces (initiale + pseudo) ;
//   · `Verification` — la PREUVE : VRM relit seule (toutes les minutes, page
//     visible) la date du dernier e-mail rangé au nom de ce compte ; « relié »
//     seulement sur cette preuve lue ; lecture ratée ⇒ « pas su ». ⚠️ Jamais de
//     roue qui tourne sans fin : l'état d'attente est CALME (une horloge, « Pas
//     encore reçu · vérifié à 20:39 », « Vérifier ») ; la roue ne tourne que
//     pendant une vérification réelle.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { phraseARelier, verifRelie } from './relierCompte.js';

const RELIRE_MS = 60e3;
const heure = (v) => { const t = Date.parse(v || ''); return Number.isFinite(t) ? new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''; };
const jour = (v) => { const t = Date.parse(v || ''); return Number.isFinite(t) ? new Date(t).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''; };
const initiale = (s) => (String(s || '?').trim()[0] || '?').toUpperCase();

export const IconeHorloge = () => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>;
export const IconeCoche = ({ t = 18 }) => <svg viewBox="0 0 24 24" width={t} height={t} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>;
export const Roue = () => <span className="vrm-pv-roue" aria-hidden="true"/>;

// Les comptes à relier, en puces. `uid` : le compte choisi ('' = aucun).
export function ChoixCompte({ comptes, uid, onChoisir }) {
  const liste = Array.isArray(comptes) ? comptes : [];
  if (!liste.length) return null;
  return (
    <div className="vrm-pv-comptes" role="radiogroup" aria-label="Quel compte ?" data-choix-compte={liste.length}>
      {liste.map((c) => (
        <button key={c.uid} type="button" role="radio" aria-checked={c.uid === uid} className="vrm-pv-compte" data-choix-compte-uid={c.uid}
          title={phraseARelier(c)} onClick={() => onChoisir && onChoisir(c.uid === uid ? '' : c.uid)}>
          <span className="vrm-pv-initiale" aria-hidden="true">{initiale(c.login)}</span>
          <span className="vrm-pv-compte-nom">{c.login}</span>
        </button>
      ))}
    </div>
  );
}

export function Verification({ compte, lireDernier, onRelie }) {
  const [dernier, setDernier] = useState(undefined);   // undefined en cours · null pas su · '' aucun · date
  const [luA, setLuA] = useState('');
  const [manuel, setManuel] = useState(false);          // la roue : seulement pendant SA vérification
  const gen = useRef(0);
  const lire = useCallback(async (parLui = false) => {
    if (typeof lireDernier !== 'function') { setDernier(null); return; }
    const g = ++gen.current;
    if (parLui) setManuel(true);
    let v = null;
    try { v = await lireDernier(compte.login); } catch (_) { v = null; }
    if (g !== gen.current) return;
    setManuel(false);
    setDernier(v === null || v === undefined ? null : String(v || ''));
    setLuA(new Date().toISOString());
  }, [compte.login, lireDernier]);
  const etat = verifRelie(dernier, compte.dernier);
  useEffect(() => { setDernier(undefined); lire(); }, [lire]);
  // VRM relit toute seule tant que ce n'est pas relié — seulement page visible.
  useEffect(() => {
    if (etat === 'relie') return undefined;
    const t = setInterval(() => { try { if (document.visibilityState === 'visible') lire(); } catch (_) { lire(); } }, RELIRE_MS);
    const f = () => { try { if (document.visibilityState === 'visible') lire(); } catch (_) {} };
    document.addEventListener('visibilitychange', f);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', f); };
  }, [etat, lire]);
  useEffect(() => { if (etat === 'relie' && onRelie) onRelie(compte.uid); }, [etat, compte.uid, onRelie]);
  return (
    <div className="vrm-pv-etat" data-relier-verif={etat} data-ton={etat === 'relie' ? 'ok' : etat === 'passu' ? 'passu' : 'attente'} role="status" aria-live="polite">
      <span className="vrm-pv-etat-ic">{etat === 'relie' ? <IconeCoche/> : manuel || etat === 'encours' ? <Roue/> : <IconeHorloge/>}</span>
      <span className="vrm-pv-etat-txt">
        <b>{etat === 'relie' ? `${compte.login} : reçu ✓` : etat === 'passu' ? 'Pas su pour l’instant' : etat === 'encours' ? 'Je vérifie…' : `${compte.login} : pas encore reçu`}</b>
        <span className="vrm-pv-etat-quand">{etat === 'relie' ? jour(dernier) : luA ? `vérifié à ${heure(luA)}` : ''}</span>
      </span>
      {etat !== 'relie' && etat !== 'encours' && <button type="button" className="vrm-pv-verifier" data-relier-verifier="" disabled={manuel} onClick={() => lire(true)}>{etat === 'passu' ? 'Réessayer' : 'Vérifier'}</button>}
    </div>
  );
}

// L'ancien export par défaut : la puce du compte + sa preuve (sans pas-à-pas, il
// est dans le parcours). Gardé pour qui l'importe encore.
export default function RelierCompte({ comptes, uid, onChoisir, lireDernier, onRelie }) {
  const liste = Array.isArray(comptes) ? comptes : [];
  const c = liste.find((x) => x.uid === String(uid)) || null;
  if (!c) return null;
  return (
    <section className="vrm-pv-relier" data-relier-compte={c.uid} data-relier-compte-messagerie={c.messagerie}>
      <ChoixCompte comptes={liste} uid={c.uid} onChoisir={onChoisir}/>
      <Verification key={c.uid} compte={c} lireDernier={lireDernier} onRelie={onRelie}/>
    </section>
  );
}
