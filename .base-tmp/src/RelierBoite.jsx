// ── « RELIER MA BOÎTE » (5 nov.) — l'accompagnement animé ───────────────────
// Pour chaque messagerie (Gmail, iCloud, Outlook, Orange/SFR/Free, autre) et
// chaque expéditeur à faire suivre (Vinted, Vinted Go, Mondial Relay,
// Chronopost, Relais Colis, Leboncoin, eBay, Vestiaire), une petite scène
// animée en CSS/SVG montre le geste, étape par étape.
//
// ⚠️ RIEN N'EST ENVOYÉ À PERSONNE : aucun appel réseau sur cette page. « Copier »
//    écrit dans SON presse-papiers, c'est tout.
// ⚠️ Écrans et adresses de la scène INVENTÉS (src/relierBoite.js). La vraie
//    adresse de VRM est donnée à part, hors de la scène, pour la copier.
// ⚠️ `prefers-reduced-motion` : la scène se fige sur son état final, la lecture
//    automatique ne démarre pas.
import React, { useEffect, useMemo, useState } from 'react';
import { ADRESSE_COLLECTRICE } from '../api/_lib/proprietaire-email.js';
import Pourquoi from './composants/PourquoiReplie.jsx';
import { MESSAGERIES, EXPEDITEURS, ADRESSE_EXEMPLE, BOITE_VRM_EXEMPLE, regleFiltre, motsScene } from './relierBoite.js';

const DUREE_ETAPE = 4200;
const reduit = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };

function Icone({ quoi }) {
  if (quoi === 'roue') return <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm8 3.5-2-.6-.5-1.2 1-1.9-1.8-1.8-1.9 1-1.2-.5L13 3h-2l-.6 2-1.2.5-1.9-1-1.8 1.8 1 1.9L6 9.4 4 10v2l2 .6.5 1.2-1 1.9 1.8 1.8 1.9-1 1.2.5.6 2h2l.6-2 1.2-.5 1.9 1 1.8-1.8-1-1.9.5-1.2 2-.6Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>;
  if (quoi === 'enveloppe') return <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="m4 7 8 6 8-6" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>;
  if (quoi === 'fleche') return <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 12h13m-5-5 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>;
  return <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="m5 12 4 4 10-10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

// La scène : une fenêtre de messagerie INVENTÉE (aucun logo, aucune marque).
function Scene({ messagerie, etape, expediteur, regle }) {
  const s = etape.scene;
  // (6 nov., onglets C) Les mots viennent d'UNE table (`motsScene`) : Gmail, Yahoo, relais d'Apple, règles.
  const w = motsScene(messagerie.regle, expediteur);
  return (
    <div className="vrm-relier-scene" data-scene={s} aria-hidden="true">
      <div className="vrm-relier-fenetre">
        <div className="vrm-relier-barre">
          <span className="vrm-relier-pastilles"><i/><i/><i/></span>
          <span className="vrm-relier-titre-fen">{messagerie.nom} · exemple</span>
          <span className={'vrm-relier-roue' + (s === 'reglages' ? ' is-anime' : '')}><Icone quoi="roue"/></span>
        </div>
        <div className="vrm-relier-contenu">
          <div className="vrm-relier-cote"><span/><span/><span/><span/></div>
          <div className="vrm-relier-zone">
            {s === 'reglages' && <div className="vrm-relier-menu">
              <span className="vrm-relier-curseur"/>
              <div className="vrm-relier-squelette"><i/><i/><i/></div>
              <div className="vrm-relier-menu-liste"><span>Affichage</span><span className="is-cible">{w.menu}</span><span>Thème</span></div>
            </div>}
            {s === 'adresse' && <div className="vrm-relier-form">
              <span className="vrm-relier-libelle">{w.libAdresse}</span>
              <span className="vrm-relier-champ"><span className="vrm-relier-tape" style={{ '--n': w.champAdresse.length }}>{w.champAdresse}</span></span>
              <span className="vrm-relier-bouton-fen">{w.bouton}</span>
            </div>}
            {s === 'code' && <div className="vrm-relier-code">
              <span className="vrm-relier-libelle">{w.libCode}</span>
              {w.code
                ? <span className="vrm-relier-cases">{'482913'.split('').map((c, i) => <b key={i} style={{ '--i': i }}>{c}</b>)}</span>
                : <span className="vrm-relier-coche"><Icone quoi="ok"/> {w.coche}</span>}
            </div>}
            {s === 'filtre' && (() => {
              // Gmail : le champ « De » porte toute la règle ; ailleurs, une règle PAR expéditeur.
              const champ = (messagerie.regle === 'filtre' ? regle : `De contient : ${expediteur.mot}`).slice(0, 40);
              return <div className="vrm-relier-form">
              <span className="vrm-relier-libelle">{messagerie.regle === 'filtre' ? 'Filtre · champ « De »' : `Règle · ${expediteur.nom}`}</span>
              <span className="vrm-relier-champ"><span className="vrm-relier-tape" style={{ '--n': champ.length }}>{champ}</span></span>
              <span className="vrm-relier-coche is-retard"><Icone quoi="ok"/> Transférer à {BOITE_VRM_EXEMPLE}</span>
            </div>; })()}
            {s === 'flux' && <div className="vrm-relier-flux">
              <div className="vrm-relier-boite-liste">
                <span className="vrm-relier-mail is-neuf"><b>{expediteur.nom}</b><small>{expediteur.sujet}</small></span>
                <span className="vrm-relier-mail"><b>Club de lecture</b><small>Prochaine séance jeudi</small></span>
                <span className="vrm-relier-mail"><b>Banque Exemple</b><small>Votre relevé est prêt</small></span>
              </div>
              <span className="vrm-relier-vol"><Icone quoi="enveloppe"/></span>
              <span className="vrm-relier-vrm"><b>VRM</b><small>+1</small></span>
            </div>}
          </div>
        </div>
        <div className="vrm-relier-pied-fen">{ADRESSE_EXEMPLE}</div>
      </div>
    </div>
  );
}

// (6 nov., onglets C) `messagerieInitiale` : la messagerie suggérée par l'adresse
// d'un compte (`messagerieDeAdresse`) quand le pas-à-pas s'ouvre POUR un compte
// (src/RelierCompte.jsx) ; il peut toujours en choisir une autre.
export default function RelierBoite({ onAdresses, messagerieInitiale = 'gmail' }) {
  const [mid, setMid] = useState(() => (MESSAGERIES.some((x) => x.id === messagerieInitiale) ? messagerieInitiale : 'gmail'));
  const [choisis, setChoisis] = useState(() => EXPEDITEURS.map((x) => x.id));
  const [focus, setFocus] = useState('');
  const [i, setI] = useState(0);
  // Un tour complet = UN expéditeur, du début à la fin (la scène ne change pas
  // d'expéditeur en cours de route) ; le suivant au tour d'après.
  const [tour, setTour] = useState(0);
  const [lecture, setLecture] = useState(() => !reduit());
  const [copie, setCopie] = useState('');
  useEffect(() => { if (MESSAGERIES.some((x) => x.id === messagerieInitiale)) { setMid(messagerieInitiale); setI(0); } }, [messagerieInitiale]);
  const m = MESSAGERIES.find((x) => x.id === mid) || MESSAGERIES[0];
  const etapes = m.etapes;
  const etape = etapes[Math.min(i, etapes.length - 1)];
  // L'expéditeur montré dans la scène : celui qu'il a touché, sinon un par tour.
  const dansScene = useMemo(() => {
    const liste = EXPEDITEURS.filter((x) => choisis.includes(x.id));
    if (focus) return EXPEDITEURS.find((x) => x.id === focus) || liste[0] || EXPEDITEURS[0];
    return liste.length ? liste[tour % liste.length] : EXPEDITEURS[0];
  }, [focus, choisis, tour]);
  const regle = regleFiltre(m.id, focus ? [focus] : choisis);
  useEffect(() => {
    if (!lecture) return undefined;
    const t = setTimeout(() => { const n = (i + 1) % etapes.length; if (n === 0) setTour((x) => x + 1); setI(n); }, DUREE_ETAPE);
    return () => clearTimeout(t);
  }, [lecture, i, etapes.length, mid]);
  const copier = async (texte, quoi) => {
    try { await navigator.clipboard.writeText(texte); setCopie(`${quoi} copiée.`); }
    catch (_) { setCopie('Sélectionne le texte affiché pour le copier.'); }
  };
  // Yahoo (toute la boîte) et le relais d'Apple : pas de règle d'expéditeur ; le relais ne
  // fait pas suivre à VRM mais à une de SES boîtes (l'adresse de VRM n'y sert pas).
  const sansRegle = m.regle === 'transfert' || m.regle === 'relais';
  const basculer = (id) => setChoisis((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  return (
    <div className="vrm-relier" data-relier-boite="" data-messagerie={m.id}>
      <p className="vrm-relier-intro">Ta messagerie fait suivre à VRM une <b>copie</b> des e-mails de vente. Rien d’autre ne part.</p>
      <Pourquoi>Ta messagerie fait suivre à VRM une copie des e-mails de Vinted, des transporteurs et des sites de vente. Rien d’autre ne part, et cette page n’envoie rien : elle te montre le geste.</Pourquoi>

      <div className="vrm-relier-choix" role="group" aria-label="Ta messagerie">
        {MESSAGERIES.map((x) => <button key={x.id} type="button" aria-pressed={x.id === m.id} data-relier-messagerie={x.id} onClick={() => { setMid(x.id); setI(0); }}>
          <b>{x.nom}</b><small>{x.famille}</small>
        </button>)}
      </div>

      <div className="vrm-relier-scene-bloc">
        <Scene key={`${m.id}-${i}-${dansScene.id}`} messagerie={m} etape={etape} expediteur={dansScene} regle={regle.texte.replace(/\n/g, ', ')}/>
        <div className="vrm-relier-legende" aria-live="polite">
          <p className="vrm-relier-num" data-relier-etape={i + 1}>Étape {i + 1} sur {etapes.length}</p>
          <h3>{etape.titre}</h3>
          <p>{etape.geste}</p>
          <div className="vrm-relier-gestes">
            <button type="button" onClick={() => { setLecture(false); setI((n) => (n - 1 + etapes.length) % etapes.length); }} data-relier-precedent="">Précédent</button>
            <button type="button" onClick={() => setLecture((v) => !v)} aria-pressed={lecture} data-relier-lecture="">{lecture ? 'Pause' : 'Lecture'}</button>
            <button type="button" onClick={() => { setLecture(false); setI((n) => (n + 1) % etapes.length); }} data-relier-suivant="">Suivant</button>
          </div>
          <ol className="vrm-relier-points" aria-label="Étapes">
            {etapes.map((e, k) => <li key={k}><button type="button" aria-current={k === i ? 'step' : undefined} aria-label={`${k + 1}. ${e.titre}`} onClick={() => { setLecture(false); setI(k); }}><span/></button></li>)}
          </ol>
        </div>
      </div>

      {!sansRegle && <section className="vrm-relier-bloc" aria-label="Les expéditeurs à faire suivre">
        <h3>Les expéditeurs à faire suivre</h3>
        <p className="vrm-relier-doux">Touche un expéditeur pour voir sa règle. Décoche ceux que tu n’utilises pas.</p>
        <ul className="vrm-relier-exp">
          {EXPEDITEURS.map((x) => <li key={x.id} data-relier-exp={x.id} data-choisi={choisis.includes(x.id) ? '1' : '0'}>
            <label className="vrm-relier-case"><input type="checkbox" checked={choisis.includes(x.id)} onChange={() => basculer(x.id)}/><span className="vrm-sr">Faire suivre {x.nom}</span></label>
            <button type="button" className="vrm-relier-exp-voir" aria-pressed={focus === x.id} onClick={() => { setFocus((f) => (f === x.id ? '' : x.id)); setI(Math.max(0, etapes.findIndex((e) => e.scene === 'filtre'))); setLecture(false); }}>
              <b>{x.nom}</b><small>{x.quoi} · {x.domaines.join(', ')}</small>
            </button>
          </li>)}
        </ul>
      </section>}

      {m.regle !== 'relais' && <section className="vrm-relier-bloc" aria-label="À copier dans ta messagerie">
        <h3>À copier dans ta messagerie</h3>
        <div className="vrm-relier-copier">
          <span>L’adresse de VRM</span>
          <code data-relier-adresse="">{ADRESSE_COLLECTRICE}</code>
          <button type="button" onClick={() => copier(ADRESSE_COLLECTRICE, 'Adresse')}>Copier</button>
        </div>
        {!sansRegle && <div className="vrm-relier-copier">
          <span>{m.regle === 'filtre' ? 'Le champ « De » du filtre' : 'Une règle par expéditeur'}{focus ? ` · ${EXPEDITEURS.find((x) => x.id === focus).nom}` : ''}</span>
          {regle.lignes.length ? <code data-relier-regle="">{m.regle === 'filtre' ? regle.texte : regle.lignes.join('\n')}</code> : <code data-relier-regle="">Coche au moins un expéditeur.</code>}
          <button type="button" disabled={!regle.texte} onClick={() => copier(regle.texte, 'Règle')}>Copier</button>
        </div>}
        {copie && <p role="status" className="vrm-relier-doux">{copie}</p>}
        <p className="vrm-relier-doux">Déclare et confirme aussi ton adresse : elle prouve que ces e-mails sont à toi.</p>
        {onAdresses && <button type="button" className="vrm-relier-lien vrm-pied-lien" data-pied-lien="adresses" data-relier-adresses="" onClick={onAdresses}>Mes adresses de réception <span aria-hidden="true">→</span></button>}
      </section>}
    </div>
  );
}
