// ══════════════════════════════════════════════════════════════════════════
// LA PAGE D'ACCUEIL PUBLIQUE — ce que voit quelqu'un qui ne connaît pas VRM
// ══════════════════════════════════════════════════════════════════════════
// Julien, 3 octobre : « je veux une vraie page d'accueil avant de rentrer dans
// VRM, qui donne envie avant d'arriver sur la connexion ; fais une vidéo motion
// design ; inspire-toi de Vinteer ».
//
// Ce fichier est VOLONTAIREMENT séparé d'App.jsx :
//   • un visiteur ne télécharge pas l'application entière (≈ 340 Ko compressés)
//     pour lire une page de présentation — `main.jsx` ne charge l'app qu'au
//     moment où il clique pour se connecter ;
//   • une autre session travaille sur l'app en parallèle : un fichier à part,
//     c'est zéro conflit.
//
// ⚠️ AUCUNE DONNÉE INVENTÉE (§2.3) : pas de faux avis, pas de faux « 10 000
//    vendeurs », pas de prix imaginaire. Le prix est celui des CGV (« À ce
//    jour, VRM est gratuit »), la confidentialité cite la politique publiée, et
//    chaque fonction décrite existe dans l'app. Les chiffres de l'animation
//    sont une DÉMONSTRATION (une paire, un numéro de carton) — aucun vrai
//    compte, aucun vrai acheteur.
// ⚠️ La « vidéo » est dessinée par le code (`DemoAnimee`) : nette à toutes les
//    tailles, quelques Ko, et elle respecte « réduire les animations ». Le même
//    composant sert à fabriquer le fichier MP4 (`?film`, scripts/film-accueil.cjs)
//    — une seule source pour le site et pour les réseaux.
import React from 'react';

const K = {
  bg: '#07090D', surface: '#0B0E13', card: '#10141B', card2: '#151A23',
  line: 'rgba(255,255,255,0.08)', line2: 'rgba(255,255,255,0.13)',
  text: '#EEF1F6', muted: '#9AA3B2', faint: '#687284',
  accent: '#3D7BFF', accentSoft: 'rgba(61,123,255,0.14)', onAccent: '#FFFFFF',
  paper: '#F4F6FA', ink: '#111620',
};

// ── Temps ──────────────────────────────────────────────────────────────────
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const seg = (u, a, b) => clamp01((u - a) / (b - a));
const sortie = (x) => 1 - Math.pow(1 - clamp01(x), 3);                       // ease-out cubique
const douce = (x) => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const rebond = (x) => { x = clamp01(x); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const mix = (a, b, x) => a + (b - a) * x;

const SCENE_S = 4.2;
const SCENES = [
  { nav: 'Ma journée', titre: 'Tous tes comptes, un seul écran', sous: 'Vinted, Leboncoin et eBay réunis — à jour dès que tu ouvres le site.' },
  { nav: 'Ventes', titre: 'Chaque vente arrive en direct', sous: 'Plus besoin de rafraîchir dix onglets pour savoir ce qui est parti.' },
  { nav: 'Colis', titre: 'Le bordereau est prêt', sous: 'Récupéré tout seul, tamponné du titre et du numéro de la paire.' },
  { nav: 'Annonces', titre: 'Un numéro par carton', sous: 'Tu sais toujours où est la paire. Un numéro n’est jamais réattribué.' },
  { nav: 'Messages', titre: 'Tes messages et tes offres', sous: 'Réponds, accepte ou fais une contre-offre sans changer d’onglet.' },
  { nav: 'Statistiques', titre: 'Tes chiffres, chacun à sa date', sous: 'Ventes du jour, argent reçu et chiffre d’affaires à déclarer.' },
];
const DUREE = SCENE_S * SCENES.length;
// ⚠️ LE TEMPS EST TOUJOURS RAMENÉ DANS [0, DUREE[. Vu au banc : l'horodatage
//    du premier `requestAnimationFrame` peut être ANTÉRIEUR au `performance.now()`
//    pris juste avant — un pas de temps négatif, un indice de scène à -1, et
//    toute la page tombait sur « L'application n'a pas pu démarrer ». Au hasard,
//    selon la machine : exactement le défaut qu'on ne voit pas en relisant.
const dansBoucle = (t) => { const x = Number(t); return isFinite(x) ? ((x % DUREE) + DUREE) % DUREE : 0; };
const sceneDe = (t) => { const x = dansBoucle(t); const s = Math.min(SCENES.length - 1, Math.floor(x / SCENE_S)); return { s, u: (x - s * SCENE_S) / SCENE_S }; };
const W = 720, H = 470;                // taille de dessin : tout est mis à l'échelle
// Format COMPACT (téléphone, film vertical) : sans menu latéral, plus haut.
// Mesuré : à 350 px de large, le format ordinateur affichait ses textes à
// ~6 px — illisibles. Compact : ~10 px, comme une vraie app à l'échelle.
const WC = 420, HC = 500;

// Petites pièces de décor, dessinées (aucune image externe).
const Basket = ({ s = 28, c = K.muted }) => (
  <svg width={s} height={s} viewBox="0 0 32 32" aria-hidden="true">
    <path d="M3 21c0-2 1-3 3-3.4l5-1.1 3.2-5.3c.4-.7 1.3-.9 2-.4l1.6 1.1c.6.4 1.4.5 2.1.2l1.2-.5c.8-.3 1.6.1 1.9.9l1.6 4.4c.3.8 1 1.4 1.8 1.6l1.4.3c1.2.3 2.2 1.4 2.2 2.7V23c0 .6-.4 1-1 1H4c-.6 0-1-.4-1-1z" fill="none" stroke={c} strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M3.5 21.5h25" stroke={c} strokeWidth="1.4" opacity=".55" />
  </svg>
);
const Coche = ({ s = 14, c = K.accent }) => (
  <svg width={s} height={s} viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const Imprimante = ({ s = 15, c = 'currentColor' }) => (
  <svg width={s} height={s} viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 6V2.5h7V6M4.5 11.5h-2v-5h11v5h-2M4.5 9.5h7v4h-7z" fill="none" stroke={c} strokeWidth="1.5" strokeLinejoin="round" /></svg>
);
const Pastille = ({ lettre, fond = K.card2 }) => (
  <div style={{ width: 26, height: 26, borderRadius: 7, background: fond, border: `1px solid ${K.line2}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: K.text, flexShrink: 0 }}>{lettre}</div>
);

// ── Les six scènes. Chacune est une FONCTION DU TEMPS local u ∈ [0,1] : la
//    même image pour le même u, ce qui permet de filmer image par image. ─────
function SceneComptes({ u }) {
  const lignes = [
    { l: 'V', t: 'Vinted · compte 1', d: '12 annonces · 3 ventes en cours' },
    { l: 'V', t: 'Vinted · compte 2', d: '8 annonces · 1 vente en cours' },
    { l: 'L', t: 'Leboncoin', d: '5 annonces' },
    { l: 'e', t: 'eBay', d: '2 annonces' },
  ];
  const ok = sortie(seg(u, 0.62, 0.8));
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ fontSize: 19, fontWeight: 700, color: K.text, marginBottom: 4 }} className="vrm-display">Bonjour</div>
      <div style={{ fontSize: 12.5, color: K.muted, marginBottom: 18 }}>Voici ta boutique, tous comptes réunis.</div>
      {lignes.map((r, i) => {
        const x = sortie(seg(u, 0.06 + i * 0.09, 0.32 + i * 0.09));
        const dx = [-260, 300, -220, 260][i];
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', marginBottom: 8, borderRadius: 11,
            background: K.card, border: `1px solid ${K.line}`, opacity: x, transform: `translate(${mix(dx, 0, x)}px, ${mix(18, 0, x)}px) rotate(${mix(i % 2 ? 6 : -6, 0, x)}deg)` }}>
            <Pastille lettre={r.l} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: K.text }}>{r.t}</div>
              <div style={{ fontSize: 11.5, color: K.muted }}>{r.d}</div>
            </div>
            <div style={{ opacity: ok }}><Coche /></div>
          </div>
        );
      })}
      <div style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 999,
        background: K.accentSoft, color: K.text, fontSize: 12, fontWeight: 600, opacity: ok, transform: `scale(${mix(0.9, 1, rebond(seg(u, 0.62, 0.82)))})` }}>
        <Coche s={13} /> 4 comptes à jour
      </div>
    </div>
  );
}

function SceneVentes({ u }) {
  const arrivee = sortie(seg(u, 0.12, 0.34));
  const posee = seg(u, 0.42, 0.5) > 0;
  const n = posee ? 3 : 2, montant = posee ? 142 : 97;
  const pulse = posee ? 1 - seg(u, 0.42, 0.62) : 0;
  const ventes = [
    { t: 'Adidas Samba OG · T40', p: '52,00 €', s: 'Payée' },
    { t: 'New Balance 550 · T43', p: '45,00 €', s: 'Expédiée' },
  ];
  const liste = posee ? [{ t: 'Nike Air Max 90 · T42', p: '45,00 €', s: 'Nouvelle', neuf: true }, ...ventes] : ventes;
  const tuile = (lib, val, accent) => (
    <div style={{ flex: 1, padding: '13px 14px', borderRadius: 12, background: K.card, border: `1px solid ${accent && pulse > 0 ? K.accent : K.line}`,
      boxShadow: accent && pulse > 0 ? `0 0 0 ${4 * pulse}px rgba(61,123,255,${0.25 * pulse})` : 'none' }}>
      <div style={{ fontSize: 11, color: K.muted, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600 }}>{lib}</div>
      <div className="vrm-display" style={{ fontSize: 26, fontWeight: 700, color: K.text, marginTop: 4 }}>{val}</div>
    </div>
  );
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div className="vrm-display" style={{ fontSize: 19, fontWeight: 700, color: K.text, marginBottom: 14 }}>Ventes</div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        {tuile('Ventes du jour', n, true)}
        {tuile('Vendu aujourd’hui', `${montant} €`, true)}
      </div>
      <div style={{ fontSize: 11, color: K.faint, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600, marginBottom: 8 }}>Dernières ventes</div>
      {liste.map((v, i) => {
        const e = v.neuf ? sortie(seg(u, 0.44, 0.6)) : 1;
        return (
          <div key={v.t} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 12px', marginBottom: 7, borderRadius: 10,
            background: v.neuf ? K.card2 : K.card, border: `1px solid ${v.neuf ? K.line2 : K.line}`, opacity: e, transform: `translateY(${mix(-10, 0, e)}px)` }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: K.surface, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Basket s={22} /></div>
            <div style={{ flex: 1, fontSize: 12.5, color: K.text, fontWeight: 600 }}>{v.t}</div>
            <div style={{ fontSize: 11, color: v.neuf ? K.text : K.muted, padding: '3px 8px', borderRadius: 999, background: v.neuf ? K.accentSoft : 'transparent', border: v.neuf ? 'none' : `1px solid ${K.line}` }}>{v.s}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: K.text, width: 64, textAlign: 'right' }}>{v.p}</div>
          </div>
        );
      })}
      {/* La notification qui descend */}
      <div style={{ position: 'absolute', right: 0, top: mix(-90, 0, arrivee) - 8, width: 260, padding: '12px 13px', borderRadius: 13,
        background: K.card2, border: `1px solid ${K.line2}`, boxShadow: '0 1px 2px rgba(0,0,0,.4), 0 18px 40px rgba(0,0,0,.45)',
        opacity: arrivee * (1 - seg(u, 0.5, 0.62)), display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: K.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Basket s={22} c={K.text} /></div>
        <div>
          <div style={{ fontSize: 11, color: K.muted, fontWeight: 600 }}>Nouvelle vente · Vinted</div>
          <div style={{ fontSize: 13, color: K.text, fontWeight: 700 }}>Nike Air Max 90 · 45,00 €</div>
        </div>
      </div>
    </div>
  );
}

function SceneBordereau({ u, c }) {
  const feuille = sortie(seg(u, 0.05, 0.28));
  const tampon = seg(u, 0.36, 0.5);
  const imprime = seg(u, 0.66, 0.72) > 0;
  const pret = sortie(seg(u, 0.74, 0.86));
  const barres = [3, 1, 2, 1, 3, 1, 1, 2, 3, 1, 2, 1, 1, 3, 2, 1, 3, 1, 2, 2, 1, 3, 1, 2, 1, 3];
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', gap: c ? 16 : 22, alignItems: 'flex-start' }}>
      <div style={{ width: c ? 182 : 236, height: c ? 300 : 330, borderRadius: 10, background: K.paper, position: 'relative', overflow: 'hidden', flexShrink: 0,
        boxShadow: '0 1px 2px rgba(0,0,0,.5), 0 22px 50px rgba(0,0,0,.5)', transform: `translateY(${mix(70, 0, feuille)}px)`, opacity: feuille }}>
        <div style={{ padding: '14px 16px', borderBottom: `1.5px dashed #C7CDD6` }}>
          <div style={{ fontSize: 10, letterSpacing: 1.6, fontWeight: 700, color: K.ink }}>BORDEREAU D’ENVOI</div>
          <div style={{ fontSize: 9, color: '#5E6878', marginTop: 2 }}>Point relais · Colis 1/1</div>
        </div>
        <div style={{ padding: '12px 16px' }}>
          {[78, 64, 88, 52].map((w, i) => <div key={i} style={{ height: 7, width: `${w}%`, background: '#D9DEE6', borderRadius: 3, marginBottom: 7 }} />)}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1.5, height: 64, marginTop: 14 }}>
            {barres.map((b, i) => <div key={i} style={{ width: b * (c ? 1.5 : 2), height: '100%', background: K.ink }} />)}
          </div>
          <div style={{ fontSize: 9, color: '#5E6878', marginTop: 5, letterSpacing: 1 }}>3S 4821 9067 55</div>
          {[70, 46].map((w, i) => <div key={i} style={{ height: 7, width: `${w}%`, background: '#D9DEE6', borderRadius: 3, marginTop: 9 }} />)}
        </div>
        {/* Le tampon VRM */}
        <div style={{ position: 'absolute', left: 16, right: 16, bottom: 16, padding: '9px 11px', borderRadius: 8, border: `2px solid ${K.accent}`,
          background: '#FFFFFF', color: K.ink, opacity: tampon > 0 ? 1 : 0,
          transform: `scale(${mix(1.6, 1, rebond(tampon))}) rotate(${mix(-9, -2.5, sortie(tampon))}deg)` }}>
          <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: 0.4 }}>N° 128</div>
          <div style={{ fontSize: 10.5, color: '#3A4352', fontWeight: 600 }}>Nike Air Max 90 · T42</div>
        </div>
      </div>
      <div style={{ flex: 1, paddingTop: 8 }}>
        <div className="vrm-display" style={{ fontSize: 19, fontWeight: 700, color: K.text, marginBottom: 6 }}>Colis à expédier</div>
        <div style={{ fontSize: 12.5, color: K.muted, lineHeight: 1.5, marginBottom: 16 }}>Le PDF du bordereau est récupéré pour toi et tamponné avec le titre et le numéro de la paire.</div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 15px', borderRadius: 10, fontSize: 13, fontWeight: 700,
          background: imprime ? K.accent : K.card2, color: imprime ? K.onAccent : K.text, border: `1px solid ${imprime ? K.accent : K.line2}`,
          transform: `scale(${imprime ? mix(0.94, 1, seg(u, 0.66, 0.76)) : 1})` }}>
          <Imprimante /> Imprimer le bordereau
        </div>
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: K.text, opacity: pret, transform: `translateY(${mix(8, 0, pret)}px)` }}>
          <Coche /> Prêt — A4 ou imprimante thermique
        </div>
      </div>
    </div>
  );
}

function SceneRangement({ u, c }) {
  const cols = 6, rows = 4, debut = 121, cible = 128;
  const montre = sortie(seg(u, 0.02, 0.3));
  const choix = sortie(seg(u, 0.36, 0.56));
  const etiquette = sortie(seg(u, 0.6, 0.78));
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div className="vrm-display" style={{ fontSize: 19, fontWeight: 700, color: K.text, marginBottom: 14 }}>Rangement</div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: c ? 7 : 8, width: c ? '100%' : 380 }}>
        {Array.from({ length: cols * rows }, (_, i) => {
          const n = debut + i, c = n === cible;
          const apparait = sortie(seg(montre, (i % cols) * 0.06 + Math.floor(i / cols) * 0.08, 0.5 + (i % cols) * 0.06 + Math.floor(i / cols) * 0.08));
          const hors = n % 5 === 0;               // quelques cartons déjà vides
          return (
            <div key={n} style={{ height: 50, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700,
              background: c ? (choix > 0.5 ? K.accent : K.card2) : K.card, color: c && choix > 0.5 ? K.onAccent : (hors ? K.faint : K.text),
              border: `1px solid ${c ? K.accent : K.line}`, opacity: apparait,
              transform: `translateY(${mix(10, 0, apparait)}px) scale(${c ? mix(1, 1.12, choix) : 1})`,
              boxShadow: c ? `0 12px 30px rgba(61,123,255,${0.35 * choix})` : 'none', zIndex: c ? 2 : 1, position: 'relative' }}>
              {n}
            </div>
          );
        })}
      </div>
      <div style={{ position: 'absolute', left: c ? 0 : 400, top: c ? 290 : 130, width: c ? '100%' : 165, padding: '12px 13px', borderRadius: 12, background: K.card2,
        border: `1px solid ${K.line2}`, opacity: etiquette, transform: c ? `translateY(${mix(12, 0, etiquette)}px)` : `translateX(${mix(16, 0, etiquette)}px)` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Basket s={22} c={K.text} /><div style={{ fontSize: 12, fontWeight: 700, color: K.text }}>Nike Air Max 90</div></div>
        <div style={{ fontSize: 11.5, color: K.muted, marginTop: 6, lineHeight: 1.45 }}>Carton <b style={{ color: K.text }}>128</b> · ce numéro ne sera jamais redonné à une autre paire.</div>
      </div>
    </div>
  );
}

function SceneMessages({ u }) {
  const q = sortie(seg(u, 0.06, 0.2));
  const offre = sortie(seg(u, 0.24, 0.4));
  const appui = seg(u, 0.5, 0.56);
  const acceptee = sortie(seg(u, 0.58, 0.7));
  const rep = sortie(seg(u, 0.74, 0.86));
  const bulle = (txt, moi, e) => (
    <div style={{ display: 'flex', justifyContent: moi ? 'flex-end' : 'flex-start', marginBottom: 9, opacity: e, transform: `translateY(${mix(10, 0, e)}px)` }}>
      <div style={{ maxWidth: 300, padding: '10px 13px', borderRadius: 14, fontSize: 13, lineHeight: 1.4,
        background: moi ? K.accent : K.card2, color: moi ? K.onAccent : K.text, borderBottomRightRadius: moi ? 4 : 14, borderBottomLeftRadius: moi ? 14 : 4 }}>{txt}</div>
    </div>
  );
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <Pastille lettre="A" />
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: K.text }}>Acheteur · Vinted · compte 1</div>
          <div style={{ fontSize: 11.5, color: K.muted }}>à propos de Nike Air Max 90 · 45,00 €</div>
        </div>
      </div>
      {bulle('Bonjour ! Vous les feriez à 40 € ?', false, q)}
      <div style={{ width: 300, padding: '12px 13px', borderRadius: 13, background: K.card, border: `1px solid ${K.line2}`, marginBottom: 10,
        opacity: offre, transform: `translateY(${mix(10, 0, offre)}px)` }}>
        <div style={{ fontSize: 11, color: K.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>Offre reçue</div>
        <div className="vrm-display" style={{ fontSize: 22, fontWeight: 700, color: K.text, margin: '2px 0 10px' }}>40,00 €</div>
        {acceptee > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: K.text, opacity: acceptee }}><Coche /> Offre acceptée</div>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ padding: '8px 13px', borderRadius: 9, fontSize: 12.5, fontWeight: 700, background: K.accent, color: K.onAccent,
              transform: `scale(${appui > 0 ? mix(0.92, 1, appui) : 1})` }}>Accepter</div>
            <div style={{ padding: '8px 13px', borderRadius: 9, fontSize: 12.5, fontWeight: 600, color: K.text, border: `1px solid ${K.line2}` }}>Contre-offre</div>
          </div>
        )}
      </div>
      {bulle('Avec plaisir, je l’envoie demain !', true, rep)}
    </div>
  );
}

function SceneChiffres({ u }) {
  const jours = [2, 4, 3, 5, 2, 6, 4, 3, 7, 5, 4, 6, 5, 8];
  const max = 8;
  const tuile = (lib, val, sous, e) => (
    <div style={{ flex: 1, padding: '12px 14px', borderRadius: 12, background: K.card, border: `1px solid ${K.line}`, opacity: e, transform: `translateY(${mix(10, 0, e)}px)` }}>
      <div style={{ fontSize: 11, color: K.muted, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600 }}>{lib}</div>
      <div className="vrm-display" style={{ fontSize: 24, fontWeight: 700, color: K.text, margin: '3px 0 2px' }}>{val}</div>
      <div style={{ fontSize: 11, color: K.faint }}>{sous}</div>
    </div>
  );
  const pill = sortie(seg(u, 0.72, 0.86));
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div className="vrm-display" style={{ fontSize: 19, fontWeight: 700, color: K.text, marginBottom: 14 }}>Statistiques</div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        {tuile('Ventes du jour', '142 €', 'à la date de la vente', sortie(seg(u, 0.04, 0.2)))}
        {tuile('Argent reçu', '96 €', 'à la date du versement', sortie(seg(u, 0.1, 0.26)))}
      </div>
      <div style={{ padding: '14px 14px 10px', borderRadius: 12, background: K.card, border: `1px solid ${K.line}` }}>
        <div style={{ fontSize: 11, color: K.muted, fontWeight: 600, marginBottom: 10 }}>Ventes par jour · 14 derniers jours</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7, height: 120 }}>
          {jours.map((v, i) => {
            const e = douce(seg(u, 0.16 + i * 0.025, 0.42 + i * 0.025));
            const dernier = i === jours.length - 1;
            return <div key={i} style={{ flex: 1, height: `${(v / max) * 100 * e}%`, borderRadius: '5px 5px 2px 2px', background: dernier ? K.accent : 'rgba(238,241,246,0.22)' }} />;
          })}
        </div>
      </div>
      <div style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 999,
        background: K.accentSoft, color: K.text, fontSize: 12, fontWeight: 600, opacity: pill, transform: `scale(${mix(0.9, 1, rebond(seg(u, 0.72, 0.9)))})` }}>
        <Coche s={13} /> Rapport du mois prêt pour l’URSSAF
      </div>
    </div>
  );
}
const SCENE_COMP = [SceneComptes, SceneVentes, SceneBordereau, SceneRangement, SceneMessages, SceneChiffres];

// ── La fenêtre de l'app, à la taille de dessin ──────────────────────────────
function Fenetre({ t, compact }) {
  const { s, u } = sceneDe(t);
  const fw = compact ? WC : W, fh = compact ? HC : H, menu = compact ? 0 : 150;
  const entree = sortie(seg(u, 0, 0.1)), fin = 1 - douce(seg(u, 0.93, 1));
  const Scene = SCENE_COMP[s];
  return (
    <div style={{ width: fw, height: fh, borderRadius: 18, background: K.surface, border: `1px solid ${K.line2}`, overflow: 'hidden', position: 'relative',
      boxShadow: '0 1px 2px rgba(0,0,0,.6), 0 40px 90px rgba(0,0,0,.55)' }}>
      <div style={{ height: 34, display: 'flex', alignItems: 'center', gap: 7, padding: '0 14px', borderBottom: `1px solid ${K.line}` }}>
        {[0, 1, 2].map((i) => <div key={i} style={{ width: 10, height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.14)' }} />)}
        <div style={{ marginLeft: 10, fontSize: 11, color: K.faint, letterSpacing: 0.3 }}>vrm.center{compact ? <span style={{ color: K.muted }}> · {SCENES[s].nav}</span> : null}</div>
      </div>
      {!compact && <div style={{ position: 'absolute', top: 34, left: 0, bottom: 0, width: 150, borderRight: `1px solid ${K.line}`, padding: '16px 10px', background: '#090C10' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px', marginBottom: 18 }}>
          <img src="/logo-vrm-96.png" alt="" width="24" height="24" style={{ borderRadius: 6, display: 'block' }} />
          <div className="vrm-display" style={{ fontSize: 14, fontWeight: 700, color: K.text, letterSpacing: 0.5 }}>VRM</div>
        </div>
        {SCENES.map((sc, i) => (
          <div key={sc.nav} style={{ padding: '8px 9px', borderRadius: 8, fontSize: 12, fontWeight: i === s ? 700 : 500, marginBottom: 3,
            color: i === s ? K.text : K.faint, background: i === s ? 'rgba(255,255,255,0.07)' : 'transparent' }}>{sc.nav}</div>
        ))}
      </div>}
      <div style={{ position: 'absolute', top: 34 + 22, left: menu + (compact ? 20 : 26), right: compact ? 20 : 26, bottom: 22, opacity: entree * fin, transform: `translateY(${mix(10, 0, entree)}px)` }}>
        <Scene u={u} c={!!compact} />
      </div>
    </div>
  );
}

// La légende sous la fenêtre + la barre de progression (cliquable).
function Legende({ t, onSaut, grand }) {
  const { s, u } = sceneDe(t);
  const e = sortie(seg(u, 0.02, 0.14)) * (1 - douce(seg(u, 0.94, 1)));
  return (
    <div style={{ marginTop: grand ? 34 : 18 }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: grand ? 22 : 14 }}>
        {SCENES.map((sc, i) => (
          <button key={i} type="button" onClick={onSaut ? () => onSaut(i) : undefined} aria-label={`Voir : ${sc.titre}`} tabIndex={onSaut ? 0 : -1}
            style={{ flex: 1, height: 14, minHeight: 0, padding: '5px 0', border: 'none', background: 'transparent', cursor: onSaut ? 'pointer' : 'default' }}>
            <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${i < s ? 100 : i === s ? u * 100 : 0}%`, background: i === s ? K.accent : 'rgba(255,255,255,0.45)' }} />
            </div>
          </button>
        ))}
      </div>
      <div style={{ opacity: e, transform: `translateY(${mix(8, 0, e)}px)`, minHeight: grand ? 110 : 64 }} aria-live="polite">
        <div className="vrm-display" style={{ fontSize: grand ? 46 : 20, fontWeight: 700, color: K.text, letterSpacing: -0.3 }}>{SCENES[s].titre}</div>
        <div style={{ fontSize: grand ? 24 : 14, color: K.muted, marginTop: grand ? 8 : 4, lineHeight: 1.45 }}>{SCENES[s].sous}</div>
      </div>
    </div>
  );
}

const reduitAnimations = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };

// L'animation du site : tourne seule, se met en pause hors de l'écran ou quand
// l'onglet est caché, et reste IMMOBILE si le système demande moins d'animations
// (on montre alors une image par scène, qu'on change avec la barre).
function DemoAnimee() {
  const boite = React.useRef(null);
  const [largeur, setLargeur] = React.useState(W);
  const [t, setT] = React.useState(reduitAnimations() ? SCENE_S * 0.8 : 0);
  const decalage = React.useRef(0), visible = React.useRef(true), immobile = React.useRef(reduitAnimations());
  React.useEffect(() => {
    const el = boite.current; if (!el) return undefined;
    let ro = null;
    try { ro = new ResizeObserver((es) => { const w = es[0] && es[0].contentRect.width; if (w) setLargeur(w); }); ro.observe(el); } catch (_) { setLargeur(el.clientWidth || W); }
    let io = null;
    try { io = new IntersectionObserver((es) => { visible.current = !!(es[0] && es[0].isIntersecting); }, { threshold: 0.05 }); io.observe(el); } catch (_) {}
    return () => { try { ro && ro.disconnect(); io && io.disconnect(); } catch (_) {} };
  }, []);
  React.useEffect(() => {
    if (immobile.current) return undefined;
    let raf = 0, prec = performance.now(), temps = 0;
    const tic = (now) => {
      const dt = Math.max(0, Math.min(0.05, (now - prec) / 1000)); prec = now;
      if (visible.current && !document.hidden) { temps = dansBoucle(temps + dt); setT(dansBoucle(temps + decalage.current)); }
      raf = requestAnimationFrame(tic);
    };
    raf = requestAnimationFrame(tic);
    return () => cancelAnimationFrame(raf);
  }, []);
  const saut = (i) => {
    if (immobile.current) { setT(i * SCENE_S + SCENE_S * 0.8); return; }
    decalage.current = dansBoucle(i * SCENE_S - (t - decalage.current));
    setT(i * SCENE_S);
  };
  const compact = largeur < 560;
  const fw = compact ? WC : W, fh = compact ? HC : H;
  const k = largeur / fw;
  return (
    <div data-demo-animee="" role="img" aria-label="Démonstration de VRM : tous les comptes réunis, une vente qui arrive, le bordereau tamponné, le numéro de carton, une offre acceptée et les chiffres du jour.">
      <div ref={boite} style={{ width: '100%', height: fh * k, position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: fw, height: fh, transform: `scale(${k})`, transformOrigin: '0 0' }}>
          <Fenetre t={t} compact={compact} />
        </div>
      </div>
      <Legende t={t} onSaut={saut} />
    </div>
  );
}

// ── Le film : la même animation, pilotée image par image pour l'export MP4.
//    `?film` affiche l'animation seule ; `window.__filmT(secondes)` fixe le temps.
export function Film() {
  const [t, setT] = React.useState(0);
  const [vue, setVue] = React.useState({ w: window.innerWidth, h: window.innerHeight });
  React.useEffect(() => {
    window.__filmT = (s) => setT(dansBoucle(s));
    window.__filmDuree = DUREE;
    const f = () => setVue({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', f);
    document.body.style.background = K.bg;
    return () => window.removeEventListener('resize', f);
  }, []);
  const portrait = vue.h > vue.w;
  const marge = portrait ? 0.08 : 0.07;
  const fw = portrait ? WC : W, fh = portrait ? HC : H;
  const dispoW = vue.w * (1 - 2 * marge), dispoH = vue.h * (portrait ? 0.6 : 0.66);
  const k = Math.min(dispoW / fw, dispoH / fh);
  return (
    <div style={{ width: vue.w, height: vue.h, background: `radial-gradient(1200px 700px at 50% ${portrait ? 30 : 38}%, rgba(61,123,255,0.16), transparent 70%), ${K.bg}`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ position: 'absolute', top: vue.h * 0.045, left: vue.w * marge, display: 'flex', alignItems: 'center', gap: 14 }}>
        <img src="/logo-vrm-192.png" alt="" width={Math.round(vue.h * 0.05)} height={Math.round(vue.h * 0.05)} style={{ borderRadius: 10 }} />
        <div className="vrm-display" style={{ fontSize: vue.h * 0.03, fontWeight: 700, color: K.text, letterSpacing: 1 }}>VRM</div>
      </div>
      <div style={{ width: fw * k }}>
        <div style={{ width: fw * k, height: fh * k, position: 'relative' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, width: fw, height: fh, transform: `scale(${k})`, transformOrigin: '0 0' }}><Fenetre t={t} compact={portrait} /></div>
        </div>
        <div style={{ transform: `scale(${Math.max(0.55, k * 0.62)})`, transformOrigin: '0 0', width: (fw * k) / Math.max(0.55, k * 0.62) }}>
          <Legende t={t} grand />
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: vue.h * 0.045, right: vue.w * marge, fontSize: vue.h * 0.024, color: K.muted, fontWeight: 600, letterSpacing: 0.4 }}>vrm.center</div>
    </div>
  );
}

// ── Le contenu de la page ───────────────────────────────────────────────────
const FONCTIONS = [
  { t: 'Tous tes comptes, un tableau de bord', d: 'Vinted, Leboncoin et eBay : ventes, annonces et achats de chaque compte réunis au même endroit, à jour dès que tu ouvres le site.' },
  { t: 'Bordereaux prêts à imprimer', d: 'Le PDF est récupéré tout seul et tamponné du titre et du numéro de la paire. En A4 ou sur imprimante thermique, un bordereau par feuille.' },
  { t: 'Un numéro par carton', d: 'Chaque paire reçoit son numéro de rangement, en chiffres ou en série (B125, C12…). Un numéro n’est jamais redonné : jamais deux paires dans le même carton.' },
  { t: 'Messages et offres', d: 'Les conversations de tous tes comptes au même endroit : réponds, accepte une offre ou fais une contre-offre sans changer d’onglet.' },
  { t: 'Publie aussi ailleurs', d: 'Envoie une paire sur Leboncoin — sans option payante — ou prépare-la pour eBay en un clic. Vendue sur Vinted ? Elle sort de la file.' },
  { t: 'Ta compta, prête pour l’URSSAF', d: 'Le chiffre d’affaires des ventes finalisées, mois par mois et toutes plateformes, avec les registres de ventes et d’achats en PDF et en tableur.' },
  { t: 'Colis à retirer', d: 'Les codes de retrait et les points relais de tes achats, au même endroit — plus besoin de fouiller tes emails.' },
  { t: 'Sur ton téléphone aussi', d: 'L’app s’ajoute à l’écran d’accueil de ton téléphone, avec une notification à chaque vente et un widget sur iPhone.' },
];
const ETAPES = [
  { t: 'Crée ton compte', d: 'Un email et un mot de passe. C’est gratuit.' },
  { t: 'Installe l’extension Chrome', d: 'Une fois, sur ton ordinateur, et connecte-la avec le même email.' },
  { t: 'Ouvre Vinted', d: 'VRM se remplit tout seul : ventes, annonces, bordereaux, messages.' },
];
const GARANTIES = [
  'L’extension agit uniquement au nom du compte connecté dans ton navigateur.',
  'Une requête à la fois, jamais en rafale, avec un plafond d’actions par heure.',
  'Aucune republication automatique, aucune annonce supprimée à ta place.',
  'Les automatismes sont éteints au départ : c’est toi qui les allumes.',
  'Ton mot de passe Vinted ne t’est jamais demandé.',
];
const FAQ = [
  { q: 'Faut-il donner mon mot de passe Vinted ?', r: 'Non. L’extension travaille dans ton navigateur, sur les pages Vinted où tu es déjà connecté. Elle ne demande jamais ton mot de passe Vinted.' },
  { q: 'Ça marche sur iPhone ?', r: 'Oui pour l’app : ouvre vrm.center et ajoute-la à ton écran d’accueil. L’extension, elle, s’installe une fois dans Chrome sur un ordinateur — c’est elle qui récupère tes données.' },
  { q: 'J’ai plusieurs comptes Vinted.', r: 'C’est fait pour. Passe sur Vinted connecté à chacun de tes comptes : ils apparaissent tous dans VRM, et tu peux en exclure un quand tu veux.' },
  { q: 'Vinted peut-il bloquer mon compte à cause de VRM ?', r: 'Personne ne peut garantir une décision de Vinted. VRM est conçu pour ne rien faire qu’une personne ne ferait pas : une action à la fois, seulement sur le compte connecté, aucune republication automatique.' },
  { q: 'Combien ça coûte ?', r: 'Rien aujourd’hui : VRM est gratuit. Si une offre payante arrive un jour, rien ne te sera facturé sans que tu l’aies acceptée.' },
  { q: 'Que deviennent mes données ?', r: 'Elles servent à faire marcher ta boutique, rien d’autre : VRM ne vend aucune donnée et ne fait pas de publicité.' },
];
const LEGAL = [
  ['Mentions légales', '/legal/mentions-legales.html'], ['CGU', '/legal/cgu.html'], ['CGV', '/legal/cgv.html'],
  ['Confidentialité', '/legal/confidentialite.html'], ['Cookies', '/legal/cookies.html'],
];

const CSS = `
.acc{background:${K.bg};color:${K.text};min-height:100vh;font-family:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif;overflow-x:hidden}
.acc *{box-sizing:border-box}
.acc a{color:inherit}
.acc-in{max-width:1180px;margin:0 auto;padding:0 20px}
.acc-nav{position:sticky;top:0;z-index:20;background:rgba(7,9,13,.78);backdrop-filter:saturate(1.4) blur(14px);-webkit-backdrop-filter:saturate(1.4) blur(14px);border-bottom:1px solid ${K.line}}
.acc-nav .acc-in{display:flex;align-items:center;gap:14px;height:64px}
.acc-liens{display:flex;gap:4px;margin-left:18px}
.acc-liens button{background:none;border:none;color:${K.muted};font-size:14px;font-weight:500;padding:8px 10px;border-radius:8px;cursor:pointer;min-height:0}
.acc-liens button:hover{color:${K.text};background:rgba(255,255,255,.05)}
.acc-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:10px;font-size:15px;font-weight:600;padding:12px 20px;cursor:pointer;text-decoration:none;border:1px solid transparent;transition:transform .15s ease,background .15s ease,border-color .15s ease;white-space:nowrap}
.acc-btn:active{transform:scale(.98)}
.acc-p{background:${K.accent};color:${K.onAccent}}
.acc-p:hover{background:#5A8FFF}
.acc-s{background:transparent;color:${K.text};border-color:${K.line2}}
.acc-s:hover{background:rgba(255,255,255,.05)}
.acc-hero{position:relative;padding:72px 0 40px}
.acc-hero:before{content:"";position:absolute;inset:-120px 0 auto 0;height:720px;background:radial-gradient(800px 420px at 72% 38%,rgba(61,123,255,.16),transparent 70%);pointer-events:none}
.acc-hero .acc-in{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:56px;align-items:center;position:relative}
.acc-sur{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:${K.muted};padding:6px 12px;border:1px solid ${K.line2};border-radius:999px;margin-bottom:22px}
.acc-h1{font-size:clamp(38px,5.4vw,64px);line-height:1.04;letter-spacing:-.025em;font-weight:700;margin:0 0 20px}
.acc-h1 em{font-style:normal;color:${K.accent}}
.acc-lead{font-size:18px;line-height:1.6;color:${K.muted};margin:0 0 30px;max-width:540px}
.acc-cta{display:flex;gap:12px;flex-wrap:wrap}
.acc-micro{display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:22px;font-size:13px;color:${K.faint}}
.acc-micro span{display:inline-flex;align-items:center;gap:7px}
.acc-plats{border-top:1px solid ${K.line};border-bottom:1px solid ${K.line};padding:22px 0;margin-top:40px}
.acc-plats .acc-in{display:flex;align-items:center;justify-content:center;gap:12px 34px;flex-wrap:wrap;color:${K.muted};font-size:14px}
.acc-plats b{color:${K.text};font-size:17px;letter-spacing:.2px}
.acc-sec{padding:96px 0}
.acc-eyebrow{font-size:13px;font-weight:600;color:${K.accent};letter-spacing:.6px;text-transform:uppercase;margin-bottom:12px}
.acc-h2{font-size:clamp(28px,3.6vw,42px);line-height:1.12;letter-spacing:-.02em;font-weight:700;margin:0 0 16px;max-width:760px}
.acc-sub{font-size:17px;line-height:1.6;color:${K.muted};max-width:640px;margin:0}
.acc-grille{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-top:44px}
.acc-carte{background:${K.card};border:1px solid ${K.line};border-radius:14px;padding:22px 20px;transition:border-color .2s ease,transform .2s ease}
.acc-carte:hover{border-color:${K.line2};transform:translateY(-2px)}
.acc-num{width:34px;height:34px;border-radius:9px;background:${K.card2};border:1px solid ${K.line2};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:${K.text};margin-bottom:16px}
.acc-carte h3{font-size:17px;line-height:1.3;margin:0 0 8px;font-weight:700}
.acc-carte p{font-size:14.5px;line-height:1.6;color:${K.muted};margin:0}
.acc-etapes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:44px;counter-reset:e}
.acc-etape{position:relative;padding:26px 22px;border-radius:14px;background:${K.card};border:1px solid ${K.line}}
.acc-etape .n{font-size:13px;font-weight:700;color:${K.accent};margin-bottom:12px}
.acc-etape h3{font-size:19px;margin:0 0 8px;font-weight:700}
.acc-etape p{font-size:15px;line-height:1.6;color:${K.muted};margin:0}
.acc-deux{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:48px;align-items:start}
.acc-liste{list-style:none;margin:0;padding:0}
.acc-liste li{display:flex;gap:12px;align-items:flex-start;padding:15px 0;border-bottom:1px solid ${K.line};font-size:15.5px;line-height:1.55;color:${K.text}}
.acc-liste li:last-child{border-bottom:none}
.acc-liste svg{flex-shrink:0;margin-top:4px}
.acc-prix{background:${K.card};border:1px solid ${K.line2};border-radius:18px;padding:30px 28px}
.acc-prix .gros{font-size:52px;font-weight:700;letter-spacing:-.02em;line-height:1}
.acc-faq details{border-bottom:1px solid ${K.line};padding:4px 0}
.acc-faq summary{list-style:none;cursor:pointer;padding:18px 0;font-size:17px;font-weight:600;display:flex;justify-content:space-between;gap:16px;align-items:center}
.acc-faq summary::-webkit-details-marker{display:none}
.acc-faq summary:after{content:"+";font-size:22px;color:${K.muted};font-weight:400;transition:transform .2s ease}
.acc-faq details[open] summary:after{transform:rotate(45deg)}
.acc-faq p{margin:0 0 18px;font-size:15.5px;line-height:1.65;color:${K.muted};max-width:760px}
.acc-final{text-align:center;padding:90px 0 100px;border-top:1px solid ${K.line};background:radial-gradient(700px 300px at 50% 0%,rgba(61,123,255,.12),transparent 70%)}
.acc-pied{border-top:1px solid ${K.line};padding:34px 0 46px;font-size:13px;color:${K.faint}}
.acc-pied .acc-in{display:flex;gap:18px 28px;flex-wrap:wrap;align-items:center;justify-content:space-between}
.acc-pied nav{display:flex;gap:6px 18px;flex-wrap:wrap}
.acc-pied a{text-decoration:none;color:${K.muted}}
.acc-pied a:hover{color:${K.text}}
@media (max-width:1024px){.acc-grille{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:900px){
  .acc-hero{padding:40px 0 20px}
  .acc-hero .acc-in{grid-template-columns:minmax(0,1fr);gap:40px}
  .acc-liens{display:none}
  .acc-deux{grid-template-columns:minmax(0,1fr);gap:30px}
  .acc-etapes{grid-template-columns:minmax(0,1fr)}
  .acc-sec{padding:68px 0}
}
@media (max-width:560px){
  .acc-grille{grid-template-columns:minmax(0,1fr)}
  .acc-lead{font-size:16.5px}
  .acc-cta .acc-btn{flex:1 1 100%}
  .acc-nav .acc-s{display:none}
}
`;

export default function Accueil({ onEntrer }) {
  // La page impose son fond sombre au DOCUMENT (sinon iOS peint le fond clair
  // du body au rebond du défilement), et le rend en partant.
  React.useEffect(() => {
    const avant = document.body.style.background;
    document.body.style.background = K.bg;
    const titre = document.title;
    document.title = 'VRM — toute ta revente Vinted, Leboncoin et eBay au même endroit';
    return () => { document.body.style.background = avant; document.title = titre; };
  }, []);
  const vers = (id) => () => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  // L'app ne se télécharge que quand on montre l'intention d'entrer.
  const prepare = () => { try { import('./App.jsx'); } catch (_) {} };
  const entrer = (mode) => () => onEntrer && onEntrer(mode);
  const Cta = ({ grand }) => (
    <div className="acc-cta" style={grand ? { justifyContent: 'center' } : undefined}>
      <button type="button" className="acc-btn acc-p" data-cta="inscription" onPointerEnter={prepare} onFocus={prepare} onClick={entrer('up')}>Créer mon compte gratuit</button>
      <button type="button" className="acc-btn acc-s" data-cta="connexion" onPointerEnter={prepare} onFocus={prepare} onClick={entrer('in')}>J’ai déjà un compte</button>
    </div>
  );
  return (
    <div className="acc" data-accueil="">
      <style>{CSS}</style>
      <header className="acc-nav">
        <div className="acc-in">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo-vrm-96.png" alt="" width="32" height="32" style={{ borderRadius: 8, display: 'block' }} />
            <span className="vrm-display" style={{ fontSize: 19, fontWeight: 700, letterSpacing: 0.6 }}>VRM</span>
          </div>
          <nav className="acc-liens" aria-label="Sections">
            <button type="button" onClick={vers('fonctions')}>Fonctions</button>
            <button type="button" onClick={vers('comment')}>Comment ça marche</button>
            <button type="button" onClick={vers('prix')}>Prix</button>
            <button type="button" onClick={vers('faq')}>Questions</button>
          </nav>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button type="button" className="acc-btn acc-s" style={{ padding: '9px 14px', fontSize: 14 }} onPointerEnter={prepare} onClick={entrer('in')}>Se connecter</button>
            <button type="button" className="acc-btn acc-p" style={{ padding: '9px 14px', fontSize: 14 }} onPointerEnter={prepare} onClick={entrer('up')}>Commencer</button>
          </div>
        </div>
      </header>

      <main>
        <section className="acc-hero">
          <div className="acc-in">
            <div>
              <div className="acc-sur">Pour les revendeurs Vinted, Leboncoin et eBay</div>
              <h1 className="acc-h1 vrm-display">Toute ta revente,<br /><em>un seul écran.</em></h1>
              <p className="acc-lead">Ventes en direct, bordereaux prêts à imprimer, numéros de rangement, messages et comptabilité — pour tous tes comptes. L’extension Chrome remplit tout, toute seule.</p>
              <Cta />
              <div className="acc-micro">
                <span><Coche s={13} /> Gratuit aujourd’hui</span>
                <span><Coche s={13} /> Aucun mot de passe Vinted demandé</span>
                <span><Coche s={13} /> Aucune donnée revendue</span>
              </div>
            </div>
            <DemoAnimee />
          </div>
        </section>

        <div className="acc-plats">
          <div className="acc-in">
            <span>Tes comptes</span><b>Vinted</b><b>Leboncoin</b><b>eBay</b><span>réunis dans une seule app</span>
          </div>
        </div>

        <section className="acc-sec" id="fonctions">
          <div className="acc-in">
            <div className="acc-eyebrow">Fonctions</div>
            <h2 className="acc-h2 vrm-display">Ce que tu faisais à la main, VRM le fait pour toi.</h2>
            <p className="acc-sub">Fini le tableur, les captures d’écran et les cartons sans numéro. Tout ce qui se passe sur tes comptes arrive au même endroit, rangé.</p>
            <div className="acc-grille">
              {FONCTIONS.map((f, i) => (
                <article key={f.t} className="acc-carte">
                  <div className="acc-num">{String(i + 1).padStart(2, '0')}</div>
                  <h3>{f.t}</h3>
                  <p>{f.d}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="acc-sec" id="comment" style={{ paddingTop: 0 }}>
          <div className="acc-in">
            <div className="acc-eyebrow">Comment ça marche</div>
            <h2 className="acc-h2 vrm-display">Prêt en trois gestes.</h2>
            <p className="acc-sub">Pas de configuration, pas d’import de fichiers : tu passes sur Vinted comme d’habitude, VRM range le reste.</p>
            <div className="acc-etapes">
              {ETAPES.map((e, i) => (
                <div key={e.t} className="acc-etape">
                  <div className="n">Étape {i + 1}</div>
                  <h3>{e.t}</h3>
                  <p>{e.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="acc-sec" style={{ paddingTop: 0 }}>
          <div className="acc-in acc-deux">
            <div>
              <div className="acc-eyebrow">Tes comptes d’abord</div>
              <h2 className="acc-h2 vrm-display">Pensé pour ne jamais mettre tes comptes en danger.</h2>
              <p className="acc-sub">Tes comptes Vinted, c’est ton gagne-pain. VRM refuse par principe tout ce qui ressemble à un robot.</p>
            </div>
            <ul className="acc-liste">
              {GARANTIES.map((g) => <li key={g}><Coche s={15} />{g}</li>)}
            </ul>
          </div>
        </section>

        <section className="acc-sec" id="prix" style={{ paddingTop: 0 }}>
          <div className="acc-in acc-deux">
            <div>
              <div className="acc-eyebrow">Prix</div>
              <h2 className="acc-h2 vrm-display">Gratuit. Sans piège.</h2>
              <p className="acc-sub">VRM est gratuit aujourd’hui. Si une offre payante arrive un jour, elle sera annoncée à l’avance, et rien ne te sera facturé sans ton accord.</p>
            </div>
            <div className="acc-prix">
              <div style={{ fontSize: 14, color: K.muted, fontWeight: 600, marginBottom: 10 }}>VRM</div>
              <div className="gros vrm-display">0 €</div>
              <div style={{ fontSize: 14, color: K.muted, margin: '8px 0 20px' }}>Toutes les fonctions, tous tes comptes.</div>
              <ul className="acc-liste" style={{ marginBottom: 22 }}>
                {['Vinted, Leboncoin et eBay réunis', 'Bordereaux tamponnés, prêts à imprimer', 'Numéros de rangement', 'Messages et offres', 'Rapports pour l’URSSAF et ton comptable'].map((x) => <li key={x} style={{ padding: '10px 0', fontSize: 15 }}><Coche s={15} />{x}</li>)}
              </ul>
              <button type="button" className="acc-btn acc-p" style={{ width: '100%' }} onPointerEnter={prepare} onClick={entrer('up')}>Créer mon compte gratuit</button>
            </div>
          </div>
        </section>

        <section className="acc-sec acc-faq" id="faq" style={{ paddingTop: 0 }}>
          <div className="acc-in">
            <div className="acc-eyebrow">Questions</div>
            <h2 className="acc-h2 vrm-display" style={{ marginBottom: 20 }}>Les questions qu’on nous pose.</h2>
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.r}{f.q.startsWith('Que deviennent') ? <> <a href="/legal/confidentialite.html">Lire la politique de confidentialité</a>.</> : null}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="acc-final">
          <div className="acc-in">
            <h2 className="acc-h2 vrm-display" style={{ margin: '0 auto 14px' }}>Reprends la main sur ta revente.</h2>
            <p className="acc-sub" style={{ margin: '0 auto 30px' }}>Crée ton compte, installe l’extension, ouvre Vinted. Le reste se range tout seul.</p>
            <Cta grand />
          </div>
        </section>
      </main>

      <footer className="acc-pied">
        <div className="acc-in">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo-vrm-96.png" alt="" width="22" height="22" style={{ borderRadius: 6 }} />
            <span>© {new Date().getFullYear()} VRM · VRM n’est pas affilié à Vinted, Leboncoin ou eBay.</span>
          </div>
          <nav aria-label="Informations légales">
            {LEGAL.map(([l, h]) => <a key={h} href={h}>{l}</a>)}
          </nav>
        </div>
      </footer>
    </div>
  );
}
