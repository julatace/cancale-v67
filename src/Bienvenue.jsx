// ── BIENVENUE DANS VRM (27 oct., Julien : « quand une personne arrive, elle doit
// avoir un univers personnalisable en un clic, avec une voix si possible, une
// démonstration — des choses qui aident vraiment »).
//
// Trois temps, chacun qu'on peut passer :
//   1. TON UNIVERS en un clic : Clair ou Nuit, appliqué tout de suite (le même
//      réglage que Réglages → Affichage → Mode sombre, `vinted_dark`) ;
//   2. LA DÉMONSTRATION : cinq écrans illustrés de ce que fait VRM, lus à voix
//      haute si on le demande. La voix est celle du NAVIGATEUR (speechSynthesis) :
//      gratuite, locale, aucune clé (§2.9) ; absente ⇒ le bouton n'existe pas ;
//   3. LA PREMIÈRE ÉTAPE : brancher l'extension (Ma journée la détaille).
// Rien n'est imposé : ni statut fiscal (jamais au démarrage, 27 oct.), ni
// plateforme. Les écrans illustrés disent « exemple » : ce ne sont pas ses
// données (§2.3). Vue une fois ⇒ `vrm_bienvenue_vue` (synchronisé) ; « Revoir
// la présentation » dans Réglages → Affichage la rouvre.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export const DEMO_BIENVENUE = [
  { cle: 'journee', titre: 'Ma journée', texte: "Chaque matin, l'essentiel : les colis à poster avant leur heure limite, ceux à retirer avec leur code, tes messages et l'argent reçu.",
    lignes: [['Colis à poster', 'avant 10 h'], ['À retirer', 'code 482 913'], ['Messages', '3 non lus']] },
  { cle: 'plateformes', titre: 'Tes plateformes', texte: "Vinted, Leboncoin et eBay au même endroit : ventes, annonces, messages. Une paire vendue d'un côté est signalée ailleurs, pour ne jamais la vendre deux fois.",
    lignes: [['Vinted', 'vendue'], ['Leboncoin', 'à retirer'], ['eBay', 'à retirer']] },
  { cle: 'numeros', titre: 'Un numéro par paire', texte: "Chaque paire reçoit un numéro à écrire sur sa boîte. Il est tamponné sur le bordereau et te montre où elle est rangée. Deux paires n'ont jamais le même.",
    lignes: [['N°41', 'étagère 2 · case 3'], ['N°42', 'étagère 2 · case 4'], ['N°43', 'à ranger']] },
  { cle: 'compta', titre: 'Ta compta', texte: "Ce que tu vends, ce que tu reçois, ton bénéfice. Et selon ton statut, ce que tu dois déclarer. Rien n'est imposé : tu choisis quand tu veux.",
    lignes: [['Vendu ce mois', '1 240 €'], ['Reçu', '980 €'], ['Bénéfice', '+ 410 €']] },
  { cle: 'extension', titre: "L'extension", texte: "Une extension pour ton navigateur lit tes ventes, tes colis et tes bordereaux sur Vinted, Leboncoin et eBay. C'est la première chose à installer : on t'accompagne pas à pas.",
    lignes: [['Ventes', 'lues'], ['Bordereaux', 'prêts à imprimer'], ['Colis', 'suivis']] },
];

const voixDisponible = () => { try { return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function'; } catch (_) { return false; } };
const voixFr = () => { try { return (window.speechSynthesis.getVoices() || []).find((v) => /^fr(-|_|$)/i.test(v.lang)) || null; } catch (_) { return null; } };

export default function Bienvenue({ prenom = '', dark = false, onTheme, onTerminer }) {
  const [etape, setEtape] = useState(0); // 0 univers · 1..5 démonstration · 6 première étape
  const [voix, setVoix] = useState(false);
  const peutParler = useMemo(voixDisponible, []);
  const dialogue = useRef(null);
  const n = DEMO_BIENVENUE.length;
  const slide = etape >= 1 && etape <= n ? DEMO_BIENVENUE[etape - 1] : null;

  const taire = () => { try { window.speechSynthesis.cancel(); } catch (_) {} };
  const fermer = () => { taire(); onTerminer && onTerminer(); };

  // La voix lit l'écran affiché ; à la fin de la lecture, elle passe au suivant.
  useEffect(() => {
    if (!voix || !peutParler) return undefined;
    const texte = slide ? `${slide.titre}. ${slide.texte}` : etape === 0 ? `Bienvenue dans VRM${prenom ? ', ' + prenom : ''}. Choisis ton univers.` : "Il ne reste qu'une étape : installer l'extension. Ma journée te guide.";
    let fini = false;
    try {
      taire();
      const u = new window.SpeechSynthesisUtterance(texte);
      u.lang = 'fr-FR'; u.rate = 1.03;
      const v = voixFr(); if (v) u.voice = v;
      u.onend = () => { if (!fini && slide) setEtape((e) => Math.min(e + 1, n + 1)); };
      window.speechSynthesis.speak(u);
    } catch (_) { setVoix(false); }
    return () => { fini = true; };
  }, [voix, etape]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => taire(), []);
  useEffect(() => { try { dialogue.current && dialogue.current.focus(); } catch (_) {} }, [etape]);
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') fermer(); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const suivant = () => setEtape((e) => Math.min(e + 1, n + 1));
  const precedent = () => setEtape((e) => Math.max(e - 1, 0));

  return createPortal(
    <div className="vrm-bienvenue" data-bienvenue={etape === 0 ? 'univers' : slide ? slide.cle : 'fin'}>
      <div className="vrm-bienvenue-panneau" role="dialog" aria-modal="true" aria-labelledby="vrm-bienvenue-titre" tabIndex={-1} ref={dialogue}>
        <div className="vrm-bienvenue-tete">
          <div className="vrm-bienvenue-progres" aria-hidden="true">
            {Array.from({ length: n + 2 }, (_, i) => <span key={i} data-fait={i <= etape ? '1' : '0'} />)}
          </div>
          <button type="button" className="vrm-bienvenue-passer" data-bienvenue-passer onClick={fermer}>Passer</button>
        </div>

        {etape === 0 && (
          <div className="vrm-bienvenue-corps" key="univers">
            <p className="vrm-bienvenue-sur">Bienvenue{prenom ? `, ${prenom}` : ''}</p>
            <h2 id="vrm-bienvenue-titre">Choisis ton univers</h2>
            <p className="vrm-bienvenue-texte">Un clic, et VRM prend ses couleurs. Tu pourras changer quand tu veux dans Réglages.</p>
            <div className="vrm-bienvenue-univers" role="radiogroup" aria-label="Univers">
              {[['clair', 'Clair', 'Lumineux, pour la journée', false], ['nuit', 'Nuit', 'Sombre, reposant le soir', true]].map(([k, t, s, d]) => (
                <button key={k} type="button" role="radio" aria-checked={dark === d} data-univers={k} data-choisi={dark === d ? '1' : '0'} onClick={() => onTheme && onTheme(d)}>
                  <span className={`vrm-bienvenue-apercu ${d ? 'nuit' : 'clair'}`} aria-hidden="true"><i /><i /><i /></span>
                  <b>{t}</b><small>{s}</small>
                </button>
              ))}
            </div>
            <div className="vrm-bienvenue-gestes">
              <button type="button" className="vrm-bienvenue-principal" data-bienvenue-suivant onClick={suivant}>Découvrir VRM</button>
            </div>
          </div>
        )}

        {slide && (
          <div className="vrm-bienvenue-corps" key={slide.cle}>
            <p className="vrm-bienvenue-sur">{etape} sur {n}</p>
            <h2 id="vrm-bienvenue-titre">{slide.titre}</h2>
            <div className="vrm-bienvenue-demo" aria-hidden="true">
              <span className="vrm-bienvenue-exemple">exemple</span>
              {slide.lignes.map(([a, b], i) => <div key={a} style={{ animationDelay: `${120 + i * 110}ms` }}><span>{a}</span><b>{b}</b></div>)}
            </div>
            <p className="vrm-bienvenue-texte" data-bienvenue-texte>{slide.texte}</p>
            <div className="vrm-bienvenue-gestes">
              <button type="button" className="vrm-bienvenue-second" onClick={precedent}>Retour</button>
              {peutParler && (
                <button type="button" className="vrm-bienvenue-second" data-bienvenue-voix={voix ? 'on' : 'off'} aria-pressed={voix}
                  onClick={() => { if (voix) { taire(); setVoix(false); } else setVoix(true); }}>
                  {voix ? '⏸ Couper la voix' : '🔊 Écouter la visite'}
                </button>
              )}
              <button type="button" className="vrm-bienvenue-principal" data-bienvenue-suivant onClick={suivant}>{etape === n ? 'Terminer' : 'Suivant'}</button>
            </div>
          </div>
        )}

        {etape === n + 1 && (
          <div className="vrm-bienvenue-corps" key="fin">
            <p className="vrm-bienvenue-sur">Prêt</p>
            <h2 id="vrm-bienvenue-titre">Une seule chose à faire</h2>
            <p className="vrm-bienvenue-texte">Installer l'extension sur ton ordinateur et ouvrir Vinted une fois. Ma journée te montre chaque geste, et avance toute seule quand c'est fait.</p>
            <div className="vrm-bienvenue-gestes">
              <button type="button" className="vrm-bienvenue-second" onClick={precedent}>Retour</button>
              <button type="button" className="vrm-bienvenue-principal" data-bienvenue-commencer onClick={fermer}>Commencer</button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
