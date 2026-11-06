// ── « RELIER LA BOÎTE DE <COMPTE> » (6 nov., onglets C) ──────────────────────
// Le pas-à-pas d'UN compte Vinted dont les e-mails n'arrivent pas (la règle des
// comptes muets, projetée par src/relierCompte.js) :
//   1. qui, et la PREUVE (ses ventes sans e-mail) ;
//   2. l'adresse de ce compte sur Vinted (à copier) — et, pour un relais d'Apple,
//      les boîtes qui arrivent DÉJÀ à VRM (la cible la plus simple) ;
//   3. la VÉRIFICATION : VRM relit toute seule (toutes les minutes, page visible)
//      la date du dernier e-mail rangé au nom de ce compte ; « relié » seulement
//      sur cette preuve lue, jamais supposée ; lecture ratée ⇒ « pas su » ;
//   4. le pas-à-pas animé EXISTANT (`RelierBoite`), ouvert sur la messagerie que
//      suggère l'adresse — réutilisé, jamais doublé.
// ⚠️ Aucune requête ici : la lecture est passée par l'écran (`lireDernier`).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import RelierBoite from './RelierBoite.jsx';
import { MESSAGERIES } from './relierBoite.js';
import { phraseARelier, verifRelie } from './relierCompte.js';

const RELIRE_MS = 60e3;
const heure = (v) => { const t = Date.parse(v || ''); return Number.isFinite(t) ? new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''; };
const jourHeure = (v) => { const t = Date.parse(v || ''); return Number.isFinite(t) ? new Date(t).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : ''; };

function Verification({ compte, lireDernier, onRelie }) {
  const [dernier, setDernier] = useState(undefined);   // undefined en cours · null pas su · '' aucun · date
  const [luA, setLuA] = useState('');
  const gen = useRef(0);
  const lire = useCallback(async () => {
    if (typeof lireDernier !== 'function') { setDernier(null); return; }
    const g = ++gen.current;
    let v = null;
    try { v = await lireDernier(compte.login); } catch (_) { v = null; }
    if (g !== gen.current) return;
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
    <div className="vrm-rc-verif" data-relier-verif={etat} role="status" aria-live="polite">
      <span className="vrm-rc-verif-ic" aria-hidden="true">{etat === 'relie' ? '✓' : ''}</span>
      <span className="vrm-rc-verif-txt">
        {etat === 'relie' && <><b>C’est relié.</b> Premier e-mail de {compte.login} reçu le {jourHeure(dernier)}.</>}
        {etat === 'attente' && <><b>En attente de son premier e-mail.</b> VRM vérifie toute seule, toutes les minutes{luA ? ` (vérifié à ${heure(luA)})` : ''} : dès qu’un e-mail de {compte.login} arrive, c’est coché ici.</>}
        {etat === 'encours' && <>Vérification…</>}
        {etat === 'passu' && <><b>Vérification impossible pour l’instant</b> : VRM n’a pas pu relire tes e-mails. Rien n’est perdu.</>}
      </span>
      {etat !== 'relie' && etat !== 'encours' && <button type="button" className="vrm-rc-verif-geste" data-relier-verifier="" onClick={lire}>{etat === 'passu' ? 'Réessayer' : 'Vérifier maintenant'}</button>}
    </div>
  );
}

export default function RelierCompte({ comptes, uid, onChoisir, boites = [], lireDernier, onRelie, onAdresses }) {
  const liste = Array.isArray(comptes) ? comptes : [];
  const c = liste.find((x) => x.uid === String(uid)) || null;
  const [copie, setCopie] = useState('');
  if (!c) return null;
  const relais = c.messagerie === 'relais-apple';
  const nomM = (MESSAGERIES.find((x) => x.id === c.messagerie) || {}).nom || '';
  const copier = async () => {
    try { await navigator.clipboard.writeText(c.adresse); setCopie('Adresse copiée.'); }
    catch (_) { setCopie('Sélectionne l’adresse pour la copier.'); }
  };
  return (
    <section className="vrm-rc" data-relier-compte={c.uid} data-relier-compte-messagerie={c.messagerie} aria-labelledby="vrm-rc-titre">
      <div className="vrm-rc-tete">
        <h2 id="vrm-rc-titre" className="vrm-rc-titre">Relier la boîte de {c.login}</h2>
        {liste.length > 1 && <label className="vrm-rc-autre">
          <span className="vrm-boite-sr">Un autre compte</span>
          <select value={c.uid} onChange={(ev) => onChoisir && onChoisir(ev.target.value)} data-relier-compte-choix="" aria-label="Compte à relier">
            {liste.map((x) => <option key={x.uid} value={x.uid}>{x.login}</option>)}
          </select>
        </label>}
      </div>
      <p className="vrm-rc-preuve" data-relier-preuve="">{phraseARelier(c)} : ses bordereaux, ses codes de retrait et ses messages n’arrivent pas dans VRM.</p>
      <div className="vrm-rc-adresse">
        <span>Son adresse sur Vinted{nomM ? ` · ${nomM}` : ''}</span>
        {c.adresse ? <code data-relier-compte-adresse="">{c.adresse}</code> : <em data-relier-compte-adresse="absente">pas notée dans VRM (Comptes liés → Gérer)</em>}
        {c.adresse && <button type="button" onClick={copier}>Copier</button>}
      </div>
      {copie && <p role="status" className="vrm-relier-doux">{copie}</p>}
      {relais && <p className="vrm-rc-conseil" data-relier-boites={boites.length}>
        C’est une adresse « Masquer mon adresse » d’Apple : Apple fait suivre ses e-mails vers une de tes boîtes.
        {boites.length ? <> Choisis dans « Transférer à » une boîte qui arrive <b>déjà</b> à VRM : {boites.map((b, i) => <React.Fragment key={b}>{i ? ', ' : ''}<code>{b}</code></React.Fragment>)}.</> : ' Choisis-y une boîte reliée à VRM.'}
      </p>}
      <Verification key={c.uid} compte={c} lireDernier={lireDernier} onRelie={onRelie}/>
      <RelierBoite messagerieInitiale={c.messagerie} onAdresses={onAdresses}/>
    </section>
  );
}
