// Découpé d'App.jsx (démarrage léger, 8 nov.) : chargé à la demande par App.jsx.
// Déplacement MÉCANIQUE (le code est celui d'App.jsx, inchangé) — voir docs/passation/2026-11-08-demarrage-leger.md.
import React from 'react';
import { boutiqueIci, boutiqueOrion, installerExtensionIci, estAndroid, nomNavigateurIci, mobileIci, LIENS_BOUTIQUES, LIEN_FIREFOX_ANDROID, LIEN_ORION_FICHIER, NOTICE_ORION } from '../navigateurExtension.js';
import { AUTH, Bouton, C, EXT_ATTENDUE, INV_STATUS, NAV, Pourquoi, boutonLierExt, deconnecterExtensionAncienne, fenetreAncienne, minutesAvantReessai, useEtapePont, useSansSouris, vmrExtVersion, voieConnexionExt } from '../App.jsx';


// ⟦← App.jsx #1⟧

// `titreNeuf` : ce que dit le titre quand rien n'est encore branché. Les deux
// écrans n'ouvrent pas la même conversation (« Bienvenue » sur le tableau de
// bord, « ta journée est vide » sur l'accueil) — mais les ÉTAPES, elles, sont
// les mêmes, et c'est tout ce qui compte.
// ── MINI-TUTO ILLUSTRÉ DE L'ÉTAPE COURANTE (26 octobre, demande de Julien) ────
// L'onboarding était 100 % texte. Une petite illustration DÉMONTRE le geste de
// l'étape en cours (installer · connecter · passer sur Vinted) — tier « première
// fois / explication », le seul où le motion est justifié (skill `animate`, §7 :
// sobriété). transform/opacity SEULEMENT, la courbe de sortie du projet
// (0.23,1,0.32,1), et tout sous `prefers-reduced-motion` : l'état final reste
// lisible, animation OFF. `aria-hidden` : purement décoratif — c'est le titre et
// le texte au-dessus qui portent le sens (et que `premierjour.cjs` lit).
const TUTO_CLES = ['install', 'lien', 'vinted'];
function TutoIllustration({ n }) {
  const cle = TUTO_CLES[Math.min(Math.max(n, 1), 3) - 1];
  const vert = INV_STATUS.online.color;
  return (
    <div className="vrm-tuto" data-tuto={cle} aria-hidden="true" style={{ margin: '2px 0 16px' }}>
      <style>{`
.vrm-tuto{display:flex;justify-content:center}
.vrm-tuto svg{width:100%;max-width:300px;height:auto;animation:vrmTutoIn .5s cubic-bezier(.23,1,.32,1) both}
@keyframes vrmTutoIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes vrmTutoDrop{0%{opacity:0;transform:translateY(-15px)}60%{opacity:1}100%{opacity:1;transform:none}}
@keyframes vrmTutoPulse{0%{opacity:.5;transform:scale(.7)}70%,100%{opacity:0;transform:scale(1.9)}}
@keyframes vrmTutoDraw{from{stroke-dashoffset:var(--l)}to{stroke-dashoffset:0}}
@keyframes vrmTutoPop{0%{opacity:0;transform:scale(.2)}70%{transform:scale(1.15)}100%{opacity:1;transform:scale(1)}}
@keyframes vrmTutoFlux{0%{opacity:0;transform:translateX(0)}15%{opacity:1}80%{opacity:1}100%{opacity:0;transform:translateX(70px)}}
.vt-drop{animation:vrmTutoDrop 1s cubic-bezier(.23,1,.32,1) .3s both;transform-box:fill-box;transform-origin:center}
.vt-pulse{animation:vrmTutoPulse 2.4s ease-out 1.1s infinite;transform-box:fill-box;transform-origin:center}
.vt-draw{stroke-dasharray:var(--l);animation:vrmTutoDraw .8s cubic-bezier(.23,1,.32,1) .5s both}
.vt-pop{animation:vrmTutoPop .5s cubic-bezier(.23,1,.32,1) 1.35s both;transform-box:fill-box;transform-origin:center}
.vt-flux{animation:vrmTutoFlux 2.8s ease-in-out infinite;transform-box:fill-box}
.vt-flux.b{animation-delay:.95s}.vt-flux.c{animation-delay:1.9s}
@media (prefers-reduced-motion:reduce){.vrm-tuto svg,.vrm-tuto .vt-drop,.vrm-tuto .vt-pulse,.vrm-tuto .vt-draw,.vrm-tuto .vt-pop,.vrm-tuto .vt-flux{animation:none!important}}
      `}</style>
      {cle === 'install' && (
        <svg viewBox="0 0 300 108" role="img">
          <rect x="18" y="16" width="264" height="80" rx="11" fill={C.bg} stroke={C.border} strokeWidth="2"/>
          <rect x="18" y="16" width="264" height="22" rx="11" fill={C.card}/>
          <circle cx="33" cy="27" r="3" fill={C.muted}/><circle cx="44" cy="27" r="3" fill={C.muted}/><circle cx="55" cy="27" r="3" fill={C.muted}/>
          <rect x="72" y="21" width="150" height="12" rx="6" fill={C.bg} stroke={C.border}/>
          <circle className="vt-pulse" cx="251" cy="27" r="12" fill="none" stroke={C.accent} strokeWidth="2"/>
          <g className="vt-drop"><rect x="241" y="17" width="20" height="20" rx="5" fill={C.accent}/><path d="M245 22l6 10 6-10" fill="none" stroke={C.onAccent||'#fff'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></g>
          <rect x="34" y="50" width="120" height="7" rx="3.5" fill={C.border}/>
          <rect x="34" y="64" width="150" height="7" rx="3.5" fill={C.border}/>
          <rect x="34" y="78" width="90" height="7" rx="3.5" fill={C.border}/>
        </svg>
      )}
      {cle === 'lien' && (
        <svg viewBox="0 0 300 108" role="img">
          <rect x="20" y="36" width="78" height="40" rx="9" fill={C.card} stroke={C.border} strokeWidth="2"/>
          <path d="M34 50l18 12 18-12" fill="none" stroke={C.muted} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
          <rect x="34" y="48" width="36" height="20" rx="3" fill="none" stroke={C.muted} strokeWidth="2.4"/>
          <rect x="202" y="36" width="78" height="40" rx="9" fill={C.accent}/>
          <path d="M224 48l8 16 8-16" fill="none" stroke={C.onAccent||'#fff'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          <path className="vt-draw" style={{ ['--l']: 104 }} d="M98 56h104" fill="none" stroke={C.accent} strokeWidth="3" strokeLinecap="round" strokeDasharray="7 7"/>
          <g className="vt-pop"><circle cx="150" cy="56" r="15" fill={vert}/><path d="M143 56l5 5 9-10" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></g>
        </svg>
      )}
      {cle === 'vinted' && (
        <svg viewBox="0 0 300 108" role="img">
          <rect x="20" y="26" width="74" height="60" rx="10" fill={C.card} stroke={C.border} strokeWidth="2"/>
          <path d="M40 42l10 26 10-26" fill="none" stroke={C.accent} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
          <rect x="206" y="26" width="74" height="60" rx="10" fill={C.bg} stroke={C.accent} strokeWidth="2"/>
          <path d="M224 56l6 6 12-14" fill="none" stroke={C.accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          <rect className="vt-flux" x="112" y="50" width="22" height="16" rx="4" fill={C.accent}/>
          <rect className="vt-flux b" x="112" y="50" width="22" height="16" rx="4" fill={C.accent} opacity="0.75"/>
          <rect className="vt-flux c" x="112" y="50" width="22" height="16" rx="4" fill={C.accent} opacity="0.55"/>
        </svg>
      )}
    </div>
  );
}
function PremiersPas({ onNav, titreNeuf, introNeuf, dansGuide = false }) {
  const { extAuth, etape, relire } = useEtapePont();
  const sansSouris = useSansSouris();
  // ⚠️⚠️ Revue du 11 octobre : « je la connecte d'ici, sans rien à taper » était
  //    écrit à une 5.164, qui ne reçoit plus rien de l'app (0 envoi en 25 s), et
  //    « clique son icône, puis « Se connecter avec VRM » » nommait un bouton que
  //    sa fenêtre n'a pas. Les mêmes voies que l'en-tête (`voieConnexionExt`).
  const voie = voieConnexionExt();
  const boutique = boutiqueIci();
  const orion = boutiqueOrion();   // Orion (Mac, iPhone) : la boutique de Chrome ou de Firefox, une fois publiée
  const mobile = mobileIci();      // 19 oct. : ios · firefox-android · samsung · android · autre
  const [deconnectee, setDeconnectee] = React.useState(false);
  const deconnecter = () => { if (deconnecterExtensionAncienne()) { setDeconnectee(true); setTimeout(relire, 900); } };
  // ⚠️⚠️ « CE N'EST PAS NATUREL » — Julien, 16 septembre, en regardant le
  //    premier écran. Il avait raison : c'était une notice de montage. Quatre
  //    étapes numérotées d'un coup, « Mode développeur », « extension non
  //    empaquetée », « dézippe » — du vocabulaire d'informaticien (§2.7) sur la
  //    toute première page, à quelqu'un qui n'en est pas un.
  //    ⇒ UNE SEULE étape à la fois, en gros et en français ; les autres restent
  //      visibles mais en sourdine, pour savoir où on en est. L'écran AVANCE
  //      TOUT SEUL (le pont prévient), et il le dit — c'est ça qui fait qu'on
  //      se sent accompagné plutôt que mis au travail.
  const fait = { ext: etape !== 'absente' && etape !== 'demande', lien: etape === 'connectee' };
  // L'étape COURANTE, mesurée. Jamais « coche ce que tu as fait » : savoir
  // qu'elle répond vaut mieux qu'une case à cocher.
  const n = !fait.ext ? 1 : !fait.lien ? 2 : 3;
  const ETAPES = [
    { t: `Installer l’extension ${NAV.dansNu}`, c: 'extension' },
    { t: 'La connecter à ton compte VRM — le même e-mail qu’ici, en un clic', c: 'lien' },
    { t: 'Passer une fois sur vinted.fr', c: 'vinted' },
  ];

  // ── CE QUI SE PASSE MAINTENANT, en une phrase qu'on lit sans effort ───────
  const titre = etape === 'autrecompte' ? 'Ton extension range dans une autre boutique'
    : etape === 'pasconnectee' ? 'Plus qu’une chose : lui dire que c’est toi'
    : etape === 'connectee' ? 'Tout est prêt — il ne manque qu’un tour sur Vinted'
    : (titreNeuf || 'Bienvenue — on branche ta boutique en trois minutes');

  const corps = etape === 'autrecompte' ? (
    <>
      <p style={{margin:'0 0 10px'}}>
        {NAV.Dans}, l’extension est connectée sous <b style={{color:C.text}}>{extAuth.email}</b>. Toi, tu es sur <b style={{color:C.text}}>{(AUTH.user&&AUTH.user.email)||'ce compte'}</b>.
      </p>
      <p style={{margin:0}}>
        Tout part dans l’autre boutique ; celle-ci reste vide.{' '}
        {voie === 'retard'
          ? <>Et celle-ci ({vmrExtVersion() || 'version ?'}) ne sait pas recevoir la connexion de VRM : mets-la à jour (bouton ci-dessous) et je la reconnecterai à <b style={{color:C.text}}>{(AUTH.user&&AUTH.user.email)||'ton compte'}</b> — ou déconnecte-la d’ici, puis clique son icône {NAV.hautDe} et connecte-toi avec l’e-mail et le mot de passe de ton compte VRM.</>
          : voie === 'serveur'
            ? <>Le serveur n’a pas pu préparer sa connexion : je réessaie dans {minutesAvantReessai()} min, cette page ouverte.</>
            : <>Je la reconnecte à <b style={{color:C.text}}>{(AUTH.user&&AUTH.user.email)||'ton compte'}</b> dès que cette page est devant toi — rien à taper. Si ça persiste, recharge cette page.</>}
      </p>
    </>
  ) : etape === 'pasconnectee' ? (
    <>
      <p style={{margin:'0 0 10px'}}>Ton extension est là 👍, mais pas encore reliée à ton compte.</p>
      {voie === 'retard' ? (
        <><p style={{margin:'0 0 6px'}}>Version {vmrExtVersion() || '?'} trop ancienne : mets-la à jour.</p><p style={{margin:0}}>Sinon, son icône {NAV.hautDe} : <b style={{color:C.text}}>e-mail et mot de passe VRM</b> (pas Vinted).</p></>
      ) : voie === 'serveur' ? (
        fenetreAncienne()
          ? <p style={{margin:0}}>Clique son icône {NAV.hautDe} : <b style={{color:C.text}}>e-mail et mot de passe VRM</b> (pas Vinted).</p>
          : <p style={{margin:0}}>Clique son icône {NAV.hautDe}, puis <b style={{color:C.text}}>« avec mon mot de passe VRM »</b>.</p>
      ) : voie === 'page' ? (
        /* Relecture croisée de la 5.174 : une 5.164/5.170, connectée par l'ancien
           message de la page — sa fenêtre n'a pas « Se connecter avec VRM ». */
        <div style={{margin:0}}>Je la connecte d’ici, <b style={{color:C.text}}>sans rien à taper</b>. Sinon : recharge, ou son icône. <Pourquoi>Clique son icône {NAV.hautDe} et connecte-toi avec l’e-mail et le mot de passe VRM (pas Vinted).</Pourquoi></div>
      ) : (
        <p style={{margin:0}}>Je la connecte d’ici, <b style={{color:C.text}}>sans rien à taper</b>. Sinon : son icône {NAV.hautDe}, puis <b style={{color:C.text}} data-bouton-lier-ext="">{boutonLierExt()}</b>.</p>
      )}
    </>
  ) : etape === 'connectee' ? (
    <>
      <p style={{margin:'0 0 10px'}}>Ton extension est reliée ✓ : elle range ce que <b style={{color:C.text}}>tu</b> vois sur Vinted.</p>
      <p style={{margin:0}}>Ouvre <b style={{color:C.text}}>vinted.fr</b>, connecté, et passe sur ton dressing.</p>
    </>
  ) : etape === 'muette' ? (
    <p style={{margin:0}}>Ton extension ne répond pas : recharge la page.</p>
  ) : (sansSouris && boutique.nav === 'firefox' && estAndroid() && boutique.lien) ? (
    /* 5.188 : Firefox pour Android ACCEPTE l'extension — mais seulement depuis
       sa boutique (aucun zip ne s'installe sur un téléphone). Lien PUBLIÉ
       seulement (`LIENS_BOUTIQUES`) : sinon, la phrase d'avant. */
    <>
      {dansGuide ? null : introNeuf ? <p style={{margin:'0 0 10px'}}>{introNeuf}</p> : (
        <p style={{margin:'0 0 10px'}}>Une petite extension lit tes pages Vinted et range tout ici.</p>
      )}
      <p style={{margin:0}} data-premiers-boutique="firefox-android">Installe-la depuis la boutique Firefox, puis reviens ici.</p>
    </>
  ) : sansSouris ? (
    /* ⚠️ Dérouler la marche à suivre Chrome sur un appareil qui ne peut pas la
       suivre, c'est donner du travail impossible — et proposer d'y télécharger
       un zip, c'est pire. On dit OÙ ça se passe, et rien d'autre. */
    <>
      {dansGuide ? null : introNeuf ? <p style={{margin:'0 0 10px'}}>{introNeuf}</p> : (
        <p style={{margin:'0 0 10px'}}>Une petite extension lit tes pages Vinted et range tout ici.</p>
      )}
      {/* 19 octobre : le BON geste selon le navigateur du téléphone (mesuré,
          docs/boutiques-extension.md) — jamais une boutique qui n'existe pas. */}
      {(mobile === 'samsung' || mobile === 'android' || mobile === 'duckduckgo') && <p style={{margin:'0 0 10px'}} data-premiers-mobile={mobile}>
        {mobile === 'samsung'
          ? <><b style={{color:C.text}}>Samsung Internet</b> n’accepte pas cette extension.</>
          : mobile === 'duckduckgo'
          ? <><b style={{color:C.text}}>DuckDuckGo</b> n’accepte aucune extension.</>
          : <>{nomNavigateurIci()} sur Android n’accepte aucune extension.</>}{' '}
        {LIENS_BOUTIQUES.firefox
          ? <>Sur ce téléphone, <b style={{color:C.text}}>Firefox pour Android</b> (gratuit) l’accepte&nbsp;: installe Firefox (bouton ci-dessous), ouvre <b style={{color:C.text}}>vrm.center</b> dedans, et l’écran te guidera.</>
          : <>Sur Android, seul <b style={{color:C.text}}>Firefox</b> l’accepte, et la version Firefox de l’extension n’est pas encore en ligne.</>}
      </p>}
      {mobile === 'firefox-android' && <p style={{margin:'0 0 10px'}} data-premiers-mobile="firefox-android-pas-encore">La version Firefox de l’extension n’est pas encore en ligne.</p>}
      {mobile!=='ios-orion'&&<p style={{margin:0}}>
        {mobile === 'firefox-android' || mobile === 'samsung' || mobile === 'android' || mobile === 'duckduckgo'
          ? <>En attendant, cette première étape se passe <b style={{color:C.text}}>sur un ordinateur</b>&nbsp;: ouvre </>
          : <>Cette première étape se passe <b style={{color:C.text}}>sur un ordinateur</b>&nbsp;: c’est là que vit l’extension, et ton appareil n’en accepte pas. Ouvre </>}
        <b style={{color:C.text}}>vrm.center</b> sur ton ordinateur : tu y retrouveras cet écran{mobile === 'ios' ? <span data-premiers-relais="ios">, puis l’iPhone fera agir l’ordinateur allumé</span> : null}.
      </p>}
      {mobile === 'ios-orion' && <div style={{margin:'10px 0 0'}} data-premiers-orion="dans-orion">Paquet <b style={{color:C.text}}>Orion iPhone/iPad</b> ci-dessous : importe-le dans Extensions. <a href={NOTICE_ORION} target="_blank" rel="noreferrer" style={{color:C.accentTexte}}>Les étapes</a> <Pourquoi>Importe-le depuis le menu Extensions d’Orion, puis autorise VRM sur les sites utilisés. Le fonctionnement sur ton appareil reste à vérifier.</Pourquoi></div>}
      {orion && mobile === 'ios' && <p style={{margin:'10px 0 0'}} data-premiers-orion="telephone">Sur iPhone, le navigateur <b style={{color:C.text}}>Orion</b> (gratuit) l’installe aussi, pas encore essayé.</p>}
    </>
  ) : boutique.lien ? (
    /* 5.188 : la fiche de CE navigateur est publiée — un seul geste, « Ajouter ». */
    <>
      {dansGuide ? null : introNeuf ? <p style={{margin:'0 0 10px'}}>{introNeuf}</p> : (
        <p style={{margin:'0 0 10px'}}>Une petite extension lit tes pages Vinted et range tout ici. Jamais ton mot de passe.</p>
      )}
      <p style={{margin:0}} data-premiers-boutique={boutique.nav}>Bouton ci-dessous, puis «&nbsp;Ajouter&nbsp;». L’écran avance tout seul.</p>
    </>
  ) : (boutique.nav === 'firefox' || boutique.nav === 'safari' || boutique.nav === 'samsung' || boutique.nav === 'duckduckgo' || boutique.nav === 'orion') ? (
    /* Le zip est un paquet Chromium : Firefox et Safari ne l'installent pas.
       Firefox : paquet prêt, mais pas encore publié (`LIENS_BOUTIQUES`) ;
       Safari : aucune version. On dit où ça marche aujourd'hui, sans promesse. */
    <>
      {dansGuide ? null : introNeuf ? <p style={{margin:'0 0 10px'}}>{introNeuf}</p> : (
        <p style={{margin:'0 0 10px'}}>Une petite extension lit tes pages Vinted et range tout ici.</p>
      )}
      <p style={{margin:0}} data-premiers-boutique={boutique.nav + '-pas-encore'}>
        {boutique.nav === 'orion'
          ? <>Pas encore pour Orion : ouvre <b style={{color:C.text}}>vrm.center</b> dans Chrome, Edge, Brave ou Opera.</>
          : boutique.nav === 'firefox'
          ? <>Pas encore pour Firefox : ouvre <b style={{color:C.text}}>vrm.center</b> dans Chrome, Edge, Brave ou Opera.</>
          : <>{nomNavigateurIci()} n’accepte pas cette extension : ouvre <b style={{color:C.text}}>vrm.center</b> dans Chrome, Edge, Brave ou Opera.</>}
      </p>
      {boutique.nav === 'safari' && orion && <p style={{margin:'10px 0 0'}} data-premiers-orion="safari">Proche de Safari&nbsp;: <b style={{color:C.text}}>Orion</b> (gratuit) l’installe, pas encore essayé.</p>}
    </>
  ) : (
    <>
      {dansGuide ? null : introNeuf ? <p style={{margin:'0 0 10px'}}>{introNeuf}</p> : (
        <p style={{margin:'0 0 10px'}}>Une petite extension lit tes pages Vinted et range tout ici. Jamais ton mot de passe.</p>
      )}
      <p style={{margin:'0 0 4px'}}>Commence par la télécharger. Ensuite&nbsp;:</p>
      <ul style={{margin:'6px 0 0',padding:'0 0 0 18px',lineHeight:1.7}}>
        <li>ouvre le fichier pour le décompresser&nbsp;— tu obtiens un dossier <b style={{color:C.text}}>VRM-extension</b>&nbsp;;</li>
        <li>{NAV.dansNu}, {NAV.pageExt ? <>va sur <code style={{fontSize:12,background:C.bg,padding:'1px 5px',borderRadius:6}}>{NAV.pageExt}</code></> : <>ouvre la page des extensions</>}&nbsp;;</li>
        <li>allume <b style={{color:C.text}}>Mode développeur</b>, en haut à droite (normal, hors magasin)&nbsp;;</li>
        <li>clique <b style={{color:C.text}}>Charger l’extension non empaquetée</b> et choisis le dossier.</li>
      </ul>
    </>
  );

  // ⚠️ Le bouton propose le geste qui DÉBLOQUE, jamais le suivant : envoyer sur
  //    Vinted quelqu'un dont l'extension n'est pas connectée, c'est le faire
  //    capter dans le vide — et dans le cas « autre compte », dans la boutique
  //    d'un autre. Quand le geste se passe dans Chrome (cliquer l'icône de
  //    l'extension), une page web ne peut pas l'ouvrir : on ne met alors AUCUN
  //    bouton principal.
  // Une extension qui ne sait pas recevoir la connexion de VRM : le geste qui
  // débloque est de la METTRE À JOUR (le zip), et — si elle range chez un autre —
  // de la déconnecter d'ici (son icône, connectée, ouvre VRM : pas sa fenêtre).
  const majLiaison = fait.ext && !fait.lien && voie === 'retard' && (etape === 'pasconnectee' || etape === 'autrecompte');
  // (8 nov.) Le fichier Orion ne se met jamais à jour seul : dès que la fiche
  // Firefox est publiée (`orion`), c'est elle qu'on propose (branche plus bas).
  const bouton = (!fait.ext && mobile==='ios-orion' && !orion)
    ? <a href={`${LIEN_ORION_FICHIER}?v=${EXT_ATTENDUE}`} download data-premiers-geste="orion-fichier" className="vrm-b vrm-b-primaire">Télécharger pour Orion</a>
    : (!fait.ext && boutique.lien && (!sansSouris || (boutique.nav === 'firefox' && estAndroid())))
    ? <a href={boutique.lien} target="_blank" rel="noreferrer" data-premiers-geste="boutique" className="vrm-b vrm-b-primaire">Installer depuis la boutique</a>
    : (!fait.ext && orion && (boutique.nav === 'safari' || boutique.nav === 'orion') && !(sansSouris && estAndroid()))
    ? <a href={orion} target="_blank" rel="noreferrer" data-premiers-geste="orion" className="vrm-b vrm-b-primaire">Installer dans Orion</a>
    : (!fait.ext && sansSouris && LIENS_BOUTIQUES.firefox && (mobile === 'samsung' || mobile === 'android' || mobile === 'duckduckgo'))
    ? <a href={LIEN_FIREFOX_ANDROID} target="_blank" rel="noreferrer" data-premiers-geste="firefox-android" className="vrm-b vrm-b-primaire">Installer Firefox pour Android</a>
    : (!fait.ext && sansSouris)
    ? null   // un zip sur un téléphone est du poids mort, pas un geste
    : (!fait.ext && (boutique.nav === 'firefox' || boutique.nav === 'safari' || boutique.nav === 'samsung' || boutique.nav === 'duckduckgo' || boutique.nav === 'orion'))
    ? null   // le zip est un paquet Chromium : rien à proposer ici
    : !fait.ext
    ? <a href="/VRM-extension.zip" download className="vrm-b vrm-b-primaire">Télécharger l’extension</a>
    : majLiaison
      ? <>
          {installerExtensionIci().boutique
            ? <a href={installerExtensionIci().lien} target="_blank" rel="noreferrer" data-premiers-geste="maj-boutique" className="vrm-b vrm-b-primaire">Mettre à jour depuis la boutique</a>
            : <a href="/VRM-extension.zip" download data-premiers-geste="maj" className="vrm-b vrm-b-primaire">Télécharger la mise à jour ({EXT_ATTENDUE})</a>}
          {etape === 'autrecompte' && <Bouton variante="secondaire"  data-premiers-geste="deconnecter" disabled={deconnectee} onClick={deconnecter}>{deconnectee ? 'Déconnectée — connecte-la avec ton mot de passe VRM' : `Déconnecter l’extension ${NAV.de}`}</Bouton>}
        </>
    : etape === 'connectee'
      ? <a href="https://www.vinted.fr" target="_blank" rel="noreferrer" className="vrm-b vrm-b-primaire">Ouvrir vinted.fr</a>
      : null;

  return (
    /* ⚠️ L'ÉTAT DÉCIDÉ EST PORTÉ PAR LA CARTE (`data-etape`). Un contrôle posé
       sur la PHRASE est vert le jour où quelqu'un reformule — c'est arrivé
       vingt-trois fois dans ce projet. Le banc juge l'état rendu et ses
       conséquences (quel bouton, quelles adresses nommées) ; le texte reste
       libre. */
    <div className={dansGuide ? 'vrm-premiers-sans-cadre' : 'vrm-card'} data-etape={etape} data-voie={fait.ext && !fait.lien ? voie : undefined} style={{padding:'22px 20px',border:`1px solid ${etape==='autrecompte'?C.warn+'66':C.border}`,borderRadius:12,background:C.card}}>
      {/* Où on en est — trois pastilles, lisibles d'un coup d'œil. (6 nov.) Dans le
          guide de démarrage, c'est le guide qui dit où on en est : ni pastilles ni
          liste ici, une seule carte (`dansGuide`). */}
      {!dansGuide && <div style={{display:'flex',gap:6,marginBottom:14}}>
        {ETAPES.map((e,k)=>(
          <span key={e.c} style={{flex:1,height:4,borderRadius:999,background:(k+1)<=n?C.accent:C.border,opacity:(k+1)===n?.55:1}}/>
        ))}
      </div>}
      {/* Mini-tuto illustré de l'étape courante — sur le parcours normal (3 étapes),
          pas sur un état-problème où un autre message doit dominer. */}
      {['absente','demande','pasconnectee','connectee'].includes(etape) && <TutoIllustration n={n}/>}
      {/* (6 nov.) Dans le guide, le titre d'accueil et l'introduction se taisent : l'étape
          et son « pourquoi » les disent déjà. Un titre d'ÉTAT (autre boutique, pas connectée…) reste. */}
      {!(dansGuide && titre === (titreNeuf || 'Bienvenue — on branche ta boutique en trois minutes')) && <div style={{fontSize:17,fontWeight:700,color:C.text,letterSpacing:-0.3}}>{titre}</div>}
      <div style={{fontSize:13,color:C.muted,marginTop:7,lineHeight:1.6}}>{corps}</div>

      {(bouton || onNav) && (
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:16,alignItems:'center'}}>
          {bouton}
          <Bouton variante="discret" onClick={()=>onNav&&onNav('vintedaccounts')}>Mes comptes liés ›</Bouton>
        </div>
      )}

      {/* Les autres étapes restent VISIBLES, en sourdine : savoir ce qui reste
          rassure, le détail de chacune arrive à son tour. */}
      {!dansGuide && <ol className="vrm-stagger" style={{margin:'12px 0 0',padding:'0 0 0 18px',fontSize:12,color:C.muted,lineHeight:1.9}}>
        {ETAPES.map((e,k)=>(
          <li key={e.c} style={{color:(k+1)===n?C.text:C.muted,fontWeight:(k+1)===n?600:400}}>
            {(k+1)<n && <span style={{color:INV_STATUS.online.color,fontWeight:700,marginRight:5}}>✓</span>}{e.t}
          </li>
        ))}
      </ol>}
      {/* L'écran avance TOUT SEUL : le pont prévient dès que l'extension
          répond. Le dire, c'est la différence entre « on t'accompagne » et
          « débrouille-toi ». On ne promet aucun délai pour autant. */}
      <div style={{fontSize:12,color:C.muted,marginTop:14,paddingTop:12,borderTop:`1px solid ${C.border}`,lineHeight:1.55}}>
        {etape==='absente'
          ? (sansSouris
            ? <>Rien ne presse : ton compte t’attend.</>
            : <>Je regarde en direct&nbsp;: dès que l’extension est là, cet écran passe à la suite tout seul.</>)
          : etape==='muette' ? <>Rien n’est perdu&nbsp;: c’est la question qui n’a pas abouti, pas tes données.</>
          : <>Cet écran suit tout seul&nbsp;: dès que c’est fait, il passe à la suite.</>}
      </div>

    </div>
  );
}
export { TutoIllustration, PremiersPas };
