import React from 'react';

// MODE CINÉ (`?cine`) — joue un film par-dessus le VRAI app, sur TES vraies
// données, pour l'enregistrement d'écran (TikTok / réseaux). Il ne RE-DESSINE
// rien : il pilote les vrais écrans (le même postMessage `open-url` que les liens
// internes), ajoute des sous-titres incrustés, une caméra douce (défilement) et
// une VOIX OFF (synthèse vocale du navigateur, voix française). Tout le travail
// créatif est ici ; la seule chose que l'app ne peut pas faire seule, c'est tes
// pixels à toi — ils n'existent que dans ton navigateur connecté, d'où
// l'enregistrement d'écran. `?cine&auto=1` démarre sans bouton (pour le rendu de
// démo). Aucune donnée ne sort, rien n'est écrit : c'est de la mise en scène.

const AUTO = /[?&]auto=1/.test(typeof window !== 'undefined' ? window.location.search : '');

// Les plans : écran (route interne), où défiler, durée, sous-titre, voix off.
const BEATS = [
  { tab: 'journee', scroll: 0, ms: 4200, cap: 'Tout ton business,<br>un seul écran.', vo: 'Tout ton business, réuni sur un seul écran.' },
  { tab: 'journee', scroll: 560, ms: 4200, cap: 'Tes ventes et ton argent reçu,<br>jour par jour.', vo: 'Tes ventes, et l’argent que tu reçois, jour par jour.' },
  { tab: 'dashboard', scroll: 0, ms: 4200, cap: 'Tes chiffres prêts pour l’URSSAF,<br>automatiquement.', vo: 'Tes chiffres, prêts pour l’URSSAF, automatiquement.' },
  { tab: 'cat_annonces', scroll: 0, ms: 4200, cap: 'Tes annonces,<br>toutes tes plateformes.', vo: 'Toutes tes annonces, sur toutes tes plateformes, au même endroit.' },
  { outro: true, ms: 3200, cap: 'VRM — l’atelier du revendeur.', vo: 'V R M. L’atelier du revendeur.' },
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const goTo = (tab) => {
  // L'app expose `__vrmGoto` (saut d'écran en place, sans rechargement). Repli :
  // le postMessage interne, si jamais le hook n'est pas encore posé.
  try { if (typeof window.__vrmGoto === 'function') { window.__vrmGoto('?tab=' + tab); return; } } catch (_) {}
  try { window.postMessage({ type: 'open-url', url: '/?tab=' + tab }, window.location.origin); } catch (_) {}
};

function voixFr() {
  try {
    const vs = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
    return vs.find((v) => /fr-FR/i.test(v.lang) && /Thomas|Amélie|Audrey|Google/i.test(v.name))
      || vs.find((v) => /^fr/i.test(v.lang)) || null;
  } catch (_) { return null; }
}
function dire(texte) {
  try {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texte.replace(/<[^>]+>/g, ' '));
    u.lang = 'fr-FR'; u.rate = 1.0; u.pitch = 1.0; const v = voixFr(); if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  } catch (_) {}
}

export default function CineStudio() {
  const [lance, setLance] = React.useState(AUTO);
  const [cap, setCap] = React.useState('');
  const [capOn, setCapOn] = React.useState(false);
  const [noir, setNoir] = React.useState(1);      // fondu (1 = noir)
  const [outro, setOutro] = React.useState(null); // { cap }
  const stop = React.useRef(false);

  React.useEffect(() => {
    if (!lance) return undefined;
    stop.current = false;
    // Précharge les voix (certains navigateurs les chargent en asynchrone).
    try { window.speechSynthesis && window.speechSynthesis.getVoices(); } catch (_) {}

    (async () => {
      do {
        for (const b of BEATS) {
          if (stop.current) return;
          setCapOn(false);
          setNoir(1); await wait(420);          // fondu entrant au noir
          if (b.outro) {
            setOutro({ cap: b.cap });
            dire(b.vo);
            await wait(b.ms);
            setOutro(null);
            continue;
          }
          setOutro(null);
          goTo(b.tab); await wait(850);           // bascule d'écran (en place)
          try { window.scrollTo({ top: b.scroll || 0, behavior: 'instant' }); } catch (_) { window.scrollTo(0, b.scroll || 0); }
          await wait(250);
          setNoir(0); await wait(360);            // le vrai écran apparaît
          setCap(b.cap); setCapOn(true);
          dire(b.vo);
          await wait(b.ms);
        }
      } while (!stop.current && !AUTO);           // en direct : boucle ; démo : une passe
    })();

    return () => { stop.current = true; try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (_) {} };
  }, [lance]);

  const Z = 2147483000;
  return (
    <div data-cine="" style={{ position: 'fixed', inset: 0, zIndex: Z, pointerEvents: 'none', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <style>{`
        @keyframes cineCapIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
        [data-cine] .cap{animation:cineCapIn .5s cubic-bezier(.23,1,.32,1) forwards}
      `}</style>

      {/* Fondu noir (masque les bascules d'écran et le défilement) */}
      <div style={{ position: 'absolute', inset: 0, background: '#05070A', opacity: noir, transition: 'opacity .55s ease', pointerEvents: lance ? 'none' : 'auto' }} />
      {/* Vignette cinéma */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(130% 90% at 50% 38%, transparent 55%, rgba(3,5,10,.5) 100%)' }} />
      {/* Logo */}
      <div style={{ position: 'absolute', top: 'calc(18px + env(safe-area-inset-top,0px))', left: 20, display: 'flex', alignItems: 'center', gap: 9, opacity: lance ? 1 : 0, transition: 'opacity .6s ease' }}>
        <img src="/vrm-logo-v4-192.png" alt="" width="28" height="28" style={{ borderRadius: 8, boxShadow: '0 0 0 1px rgba(255,255,255,.12)' }} />
        <b style={{ color: '#fff', fontSize: 16, fontWeight: 700, letterSpacing: '-.03em', textShadow: '0 2px 12px rgba(0,0,0,.6)' }}>VRM</b>
      </div>

      {/* Sous-titre */}
      {cap && !outro && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 'calc(96px + env(safe-area-inset-bottom,0px))', display: 'flex', justifyContent: 'center', padding: '0 30px' }}>
          <span className={capOn ? 'cap' : ''} style={{ maxWidth: '17ch', textAlign: 'center', fontSize: 30, lineHeight: 1.18, fontWeight: 700, letterSpacing: '-.02em', color: '#fff', textShadow: '0 2px 20px rgba(0,0,0,.85),0 1px 3px rgba(0,0,0,.9)', opacity: capOn ? 1 : 0, transition: 'opacity .4s ease' }} dangerouslySetInnerHTML={{ __html: cap }} />
        </div>
      )}

      {/* Outro plein écran */}
      {outro && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(5,7,10,.78)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, textAlign: 'center', padding: '0 34px' }}>
          <img src="/vrm-logo-v4-192.png" alt="" width="60" height="60" style={{ borderRadius: 16 }} />
          <div style={{ fontSize: 34, fontWeight: 800, color: '#fff', letterSpacing: '-.03em', maxWidth: '14ch', lineHeight: 1.1 }} dangerouslySetInnerHTML={{ __html: outro.cap }} />
          <div style={{ fontSize: 20, fontWeight: 600, color: '#7FA8FF' }}>vrm.center</div>
        </div>
      )}

      {/* Porte de lancement (geste requis pour la voix sur iOS) */}
      {!lance && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(5,7,10,.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, textAlign: 'center', padding: '0 34px', pointerEvents: 'auto' }}>
          <img src="/vrm-logo-v4-192.png" alt="" width="64" height="64" style={{ borderRadius: 18 }} />
          <div style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.03em', lineHeight: 1.15, maxWidth: '16ch' }}>Mode ciné</div>
          <div style={{ fontSize: 15, color: '#AEB7C6', lineHeight: 1.5, maxWidth: '30ch' }}>
            Lance l’enregistrement d’écran de ton téléphone, <b style={{ color: '#fff' }}>puis</b> appuie sur Démarrer. Le film joue tout seul sur tes vraies données, avec la voix.
          </div>
          <button type="button" onClick={() => setLance(true)} style={{ border: 'none', background: '#3D7BFF', color: '#fff', borderRadius: 12, padding: '14px 26px', fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 10px 30px rgba(61,123,255,.45)' }}>
            ▶ Démarrer le film
          </button>
        </div>
      )}
    </div>
  );
}
