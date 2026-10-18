// ── LA CARTE « AUJOURD'HUI » — LE HAUT DE LA PAGE D'ACCUEIL ──────────────────
// Ce qu'un revendeur voit en ouvrant VRM le matin, sur des données INVENTÉES
// (src/accueil-demo.js). Elle joue UNE fois, en 4,5 s, puis s'arrête :
//   1. quatre onglets (Perso, Boutique, Leboncoin, eBay) se replient en un
//      seul, « VRM » — tous tes comptes en un, sans le lire ;
//   2. une vente tombe sur « Perso », et son numéro file TOUT SEUL vers les deux
//      choses qu'elle crée : un colis à poster (2 → 3) et deux annonces à
//      retirer ailleurs (— → 2).
// Aucun curseur ici : c'est VRM qui travaille. Ce que TU fais (imprimer,
// retirer, déclarer) passe par un curseur dessiné, dans les écrans du dessous.
// C'est une VRAIE liste cliquable : chaque ligne mène à la section qui
// l'explique (elle sert de sommaire).
// ⚠️ « Reçu ce mois-ci » ne bouge pas avec la vente du matin : une vente faite
//    à 8 h 01 n'est pas encore versée (vendu ≠ reçu, CLAUDE.md n° 20).
import React from 'react';
import { K, COURBE_SORTIE, OMBRE_CARTE, REFLET } from './accueil-jetons.js';
import { DEMO, PLATEFORMES, euros, nomCompte } from './accueil-demo.js';
import { seg, mix, sortie, trajet, volXY, useScene, useTaille, centreDans } from './accueil-mouvement.js';

export const DUREE_CARTE = 4.5;
const V = DEMO.vente, J = DEMO.jour;

const ONGLETS = DEMO.comptes.map((c) => ({
  id: c.id,
  long: c.plateforme === 'vinted' ? `Vinted · ${c.nom}` : c.nom,
  court: c.nom,
  point: PLATEFORMES[c.plateforme].point,
}));

const CSS_CARTE = `
.cj{position:relative;width:100%;max-width:500px;font-variant-numeric:normal;font-feature-settings:normal;border-radius:12px;background:${K.card};border:1px solid ${K.line2};box-shadow:${REFLET},${OMBRE_CARTE};overflow:hidden;text-align:left;color:${K.text};font-family:'Inter',system-ui,sans-serif}
.cj-onglets{position:relative;height:36px;background:${K.surface};padding:0 12px;display:flex;align-items:flex-end;border-bottom:1px solid ${K.line}}
.cj.compact .cj-onglets{height:34px}
.cj-onglet{position:relative;height:28px;display:flex;align-items:center;gap:6px;padding:0 12px;border-radius:8px 8px 0 0;font-size:12px;font-weight:500;color:${K.muted};background:${K.card2};border:1px solid ${K.line};border-bottom:none;white-space:nowrap;flex-shrink:0}
.cj-onglet + .cj-onglet{margin-left:-6px}
.cj-onglet.actif{background:${K.card};color:${K.text};border-color:${K.line2};margin-bottom:-1px;height:29px}
.cj-onglet i{width:6px;height:6px;border-radius:2px;flex-shrink:0}
.cj-onglet .cj-lib{display:flex;align-items:center;gap:6px}
.cj-onglet .cj-lib.vrm{position:absolute;left:12px;top:0;bottom:0;font-family:'Space Grotesk','Inter',sans-serif;font-weight:700;letter-spacing:.04em;color:${K.text}}
.cj-onglet .cj-lib.vrm img{width:14px;height:14px;border-radius:4px;display:block}
.cj-corps{position:relative;padding:12px 0 6px}
.cj-tete{display:flex;align-items:center;justify-content:space-between;gap:10px;height:40px;padding:0 16px}
.cj-titre{display:flex;align-items:center;gap:8px;min-width:0}
.cj-titre b{font-family:'Space Grotesk','Inter',sans-serif;font-size:18px;font-weight:600;letter-spacing:-.01em;color:${K.text}}
.cj-ex{font-size:12px;font-weight:500;color:${K.faint};border:1px solid ${K.line2};border-radius:8px;padding:1px 7px;line-height:16px}
.cj-pile{display:flex;align-items:center;gap:8px;flex-shrink:0}
.cj-pile .p{display:flex}
.cj-pile .p span{width:18px;height:18px;border-radius:5px;background:${K.card2};border:1px solid ${K.line2};display:flex;align-items:center;justify-content:center}
.cj-pile .p span + span{margin-left:-6px}
.cj-pile .p span i{width:7px;height:7px;border-radius:2px}
.cj-pile em{font-style:normal;font-size:13px;color:${K.muted};white-space:nowrap}
.cj-derniere{position:relative;height:22px;padding:0 16px;font-size:13px;color:${K.faint};white-space:nowrap}
.cj-derniere span{position:absolute;left:16px;right:16px;top:0;overflow:hidden;text-overflow:ellipsis}
.cj-filet{height:1px;background:${K.line};margin:8px 16px}
.cj-ligne{position:relative;display:flex;align-items:center;gap:12px;width:100%;min-height:56px;padding:8px 16px;border:none;background:transparent;color:${K.text};text-align:left;cursor:pointer;font:inherit;-webkit-tap-highlight-color:transparent;touch-action:manipulation;border-radius:0;transition:background-color 160ms ease}
.cj-ligne:focus-visible{outline:2px solid ${K.accent};outline-offset:-2px;border-radius:8px}
@media (hover:hover) and (pointer:fine){.cj-ligne:hover{background:rgba(18,27,44,.035)}.cj-ligne:hover .cj-chev{transform:translateX(2px)}}
.cj-ligne:active{background:rgba(18,27,44,.06)}
.cj-eclair{position:absolute;inset:0;background:${K.accentSoft};pointer-events:none}
.cj-txt{position:relative;flex:1;min-width:0}
.cj-txt b{display:block;font-size:15px;font-weight:600;line-height:1.3}
.cj-sous{position:relative;display:block;font-size:13px;color:${K.muted};line-height:1.35;height:18px;margin-top:2px}
.cj-sous span{position:absolute;left:0;right:0;top:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cj-nb{position:relative;width:38px;height:28px;flex-shrink:0;font-family:'Space Grotesk','Inter',sans-serif;font-size:22px;font-weight:700;font-variant-numeric:tabular-nums;color:${K.text}}
.cj-nb span{position:absolute;right:0;top:0;line-height:28px}
.cj-nb .cj-point{position:absolute;right:20px;top:50%;margin-top:-3.5px;width:7px;height:7px;border-radius:50%;background:${K.warn};line-height:0}
.cj-chev{position:relative;color:${K.faint};font-size:18px;line-height:1;transition:transform 160ms ${COURBE_SORTIE};flex-shrink:0}
.cj-recu{min-height:48px}
.cj-recu .cj-txt{display:flex;align-items:baseline;gap:10px}
.cj-recu .cj-txt b{display:inline;font-size:14px;font-weight:500;color:${K.muted}}
.cj-recu .cj-txt strong{font-family:'Space Grotesk','Inter',sans-serif;font-size:17px;font-weight:700;font-variant-numeric:tabular-nums;color:${K.text}}
.cj-recu .cj-dec{position:relative;font-size:13px;font-weight:500;color:${K.muted};white-space:nowrap}
.cj-notif{position:absolute;left:12px;right:12px;top:8px;z-index:3;background:${K.card2};border:1px solid ${K.line2};border-radius:10px;box-shadow:0 1px 2px rgba(18,27,44,.08),0 12px 30px rgba(18,27,44,.16);padding:9px 12px 10px}
.cj-notif .l1{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:${K.text}}
.cj-notif .l1 i{width:7px;height:7px;border-radius:2px;flex-shrink:0}
.cj-notif .l1 em{margin-left:auto;font-style:normal;font-size:12px;font-weight:500;color:${K.faint};white-space:nowrap}
.cj-notif .l2{display:flex;align-items:center;gap:6px;margin-top:5px;font-size:13px;color:${K.muted};white-space:nowrap}
.cj-puce{display:inline-flex;align-items:center;height:20px;padding:0 7px;border-radius:8px;font-size:12px;font-weight:600;font-variant-numeric:tabular-nums;color:${K.text};background:rgba(61,123,255,.18);border:1px solid rgba(61,123,255,.55);white-space:nowrap}
.cj-vol{position:absolute;left:0;top:0;z-index:5;pointer-events:none;border-color:${K.accent}}
.cj.compact .cj-tete{padding:0 14px}
.cj.compact .cj-derniere,.cj.compact .cj-ligne{padding-left:14px;padding-right:14px}
.cj.compact .cj-derniere span{left:14px;right:14px}
.cj.compact .cj-filet{margin:8px 14px}
.cj.compact .cj-ligne{gap:10px}
.cj.compact .cj-nb{width:26px}
.cj.compact .cj-sous{letter-spacing:-.005em}
.cj.etroit .cj-tete{gap:6px;padding:0 12px}
.cj.etroit .cj-titre{gap:6px}
.cj.etroit .cj-titre b{font-size:16px}
.cj.etroit .cj-ex{padding:1px 5px}
.cj.etroit .cj-pile{gap:6px}
.cj.etroit .cj-derniere,.cj.etroit .cj-ligne{padding-left:12px;padding-right:12px}
.cj.etroit .cj-derniere span{left:12px;right:12px}
.cj.etroit .cj-filet{margin:8px 12px}
`;

// Fondu enchaîné, avec un léger flou au milieu (il fond les deux états en un).
const fondu = (a) => ({
  ancien: { opacity: 1 - a, filter: a > 0 && a < 1 ? `blur(${(2 * a).toFixed(2)}px)` : undefined },
  nouveau: { opacity: a, filter: a > 0 && a < 1 ? `blur(${(2 * (1 - a)).toFixed(2)}px)` : undefined },
});

// L'écran lui-même : une fonction pure de `s` (et des positions mesurées).
// La page le pilote par `useScene` ; le film, par son propre temps.
export function CarteJourEcran({ s, etatScene = 'joue', onVers, cible = true }) {
  const racine = React.useRef(null);
  const ongletsRef = React.useRef([]);
  const puceRef = React.useRef(null);
  const nbColis = React.useRef(null);
  const nbRetirer = React.useRef(null);
  const { w } = useTaille(racine);
  const compact = w > 0 && w < 440;
  // Sous 340 px (un téléphone de 360 px) : l'en-tête « Aujourd'hui · exemple · pile ·
  // 4 comptes » ne tenait plus — la puce « exemple » chevauchait la pile.
  const etroit = w > 0 && w < 340;

  const notifLa = s >= 1.2 && s < 4.4;
  const [dx, setDx] = React.useState([0, 0, 0, 0]);
  const [pos, setPos] = React.useState(null);
  React.useLayoutEffect(() => {
    const o = ongletsRef.current;
    if (o[0]) setDx(o.map((t) => (t ? o[0].offsetLeft - t.offsetLeft : 0)));
  }, [w, compact]);
  React.useLayoutEffect(() => {
    if (!notifLa) return;
    const r = racine.current;
    const p = centreDans(puceRef.current, r), a = centreDans(nbColis.current, r), b = centreDans(nbRetirer.current, r);
    if (p && a && b) setPos({ p, a, b });
  }, [notifLa, w]);

  const etat = etatScene === 'debut' ? 'debut' : etatScene === 'fin' || s >= DUREE_CARTE ? 'fin' : s < 1.2 ? 'onglets' : 'vente';

  // 1. Les onglets se replient (0 → 0,56 s), le premier devient « VRM » (0,55 → 0,80).
  const ongletPos = (i) => {
    if (i === 0) return { transform: undefined, opacity: 1 };
    const p = seg(s, 0.07 * (i - 1), 0.07 * (i - 1) + 0.42);
    return { transform: p > 0 ? `translateX(${(dx[i] * trajet(p)).toFixed(2)}px)` : undefined, opacity: 1 - seg(p, 0.6, 1) };
  };
  const vrm = fondu(seg(s, 0.55, 0.8));
  // 2. La pile des comptes et « 4 comptes » (0,70 → 0,95).
  const pile = (i) => { const p = sortie(seg(s, 0.7 + 0.04 * i, 0.9 + 0.04 * i)); return { opacity: p, transform: `scale(${mix(0.9, 1, p).toFixed(3)})` }; };
  const pileTexte = sortie(seg(s, 0.82, 1.02));
  // 3. La notification (1,20 → 1,50 ; repart 4,20 → 4,40).
  const nIn = sortie(seg(s, 1.2, 1.5)), nOut = seg(s, 4.2, 4.4);
  const notifStyle = { opacity: nIn * (1 - nOut), transform: `translateY(${(nOut > 0 ? -6 * sortie(nOut) : mix(-10, 0, nIn)).toFixed(2)}px)` };
  // 4. Les deux vols.
  const vols = [];
  if (pos) {
    [[1.75, 2.25, pos.a], [2.45, 2.95, pos.b]].forEach(([d, f, cibleV], i) => {
      if (s < d || s >= f) return;
      const p = seg(s, d, f), c = volXY(pos.p, cibleV, p);
      const k = p < 0.5 ? mix(1, 1.15, p / 0.5) : mix(1.15, 0.9, (p - 0.5) / 0.5);
      vols.push(
        <span key={i} data-vol="" aria-hidden="true" className="cj-puce cj-vol"
          style={{ transform: `translate(${c.x.toFixed(2)}px, ${c.y.toFixed(2)}px) translate(-50%, -50%) scale(${k.toFixed(3)})`, opacity: 1 - seg(s, f - 0.08, f) }}>N°{V.n}</span>
      );
    });
  }
  // 5. « Colis à poster » : 2 → 3 (2,20 → 2,42), la ligne s'éclaire.
  const roule = seg(s, 2.2, 2.4), arrive = sortie(seg(s, 2.2, 2.42));
  const eclairColis = seg(s, 2.2, 2.35) * (1 - seg(s, 2.85, 3.45));
  // 6. « Annonces à retirer » : — → 2 (2,90 → 3,12).
  const ret = fondu(seg(s, 2.9, 3.12));
  const eclairRet = seg(s, 2.9, 3.05) * (1 - seg(s, 3.55, 4.15));
  // 7. « Dernière vente » passe à celle du matin (4,20 → 4,40).
  const der = fondu(seg(s, 4.2, 4.4));

  const D = J.derniereAvant;
  const derAvant = compact ? `Dernière vente : ${D.titre} · ${euros(D.prix)}` : `Dernière vente : ${D.quand} · ${D.titre} · ${euros(D.prix)} · ${D.compte}`;
  const derApres = compact ? `Dernière vente : ${V.titre} · ${euros(V.prix)}` : `Dernière vente : à l’instant · ${V.titre} · ${euros(V.prix)} · ${nomCompte(V.compte)}`;
  // ⚠️ Sur téléphone chaque sous-ligne tient sur UNE ligne, sans points de
  //    suspension (« …Leboncoin et e… » se lisait comme un défaut) : le mot
  //    « vendue » y est porté par la notification et par « Dernière vente ».
  const sousRetirer = compact ? `N°${V.n} · encore sur Leboncoin et eBay` : `N°${V.n} vendue sur Vinted · encore sur Leboncoin et eBay`;
  const sousRelais = compact ? `${J.relais.n} codes reçus · ${J.relais.lieu}` : `${J.relais.n} codes de retrait reçus · ${J.relais.lieu}`;
  const go = (id) => () => onVers && onVers(id);

  return (
    <nav ref={racine} className={`cj${compact ? ' compact' : ''}${etroit ? ' etroit' : ''}`} aria-label="Ta journée avec VRM — exemple" data-demo-animee="" data-etat={etat}>
      <style>{CSS_CARTE}</style>
      <div className="cj-onglets" aria-hidden="true">
        {ONGLETS.map((o, i) => {
          const st = ongletPos(i);
          return (
            <div key={o.id} ref={(e) => { ongletsRef.current[i] = e; }} className={`cj-onglet${i === 0 ? ' actif' : ''}`} style={{ zIndex: 10 - i, transform: st.transform, opacity: st.opacity }}>
              <span className="cj-lib" style={i === 0 ? vrm.ancien : undefined}><i style={{ background: o.point }} />{compact ? o.court : o.long}</span>
              {i === 0 && <span className="cj-lib vrm" style={vrm.nouveau}><img src="/vrm-logo-96.png" alt="" width="14" height="14" />VRM</span>}
            </div>
          );
        })}
      </div>
      <div className="cj-corps">
        <div className="cj-tete">
          <div className="cj-titre"><b>Aujourd’hui</b><span className="cj-ex">exemple</span></div>
          <div className="cj-pile" aria-hidden="true">
            <span className="p">{DEMO.comptes.map((c, i) => <span key={c.id} style={pile(i)}><i style={{ background: PLATEFORMES[c.plateforme].point }} /></span>)}</span>
            <em style={{ opacity: pileTexte }}>{DEMO.comptes.length} comptes</em>
          </div>
        </div>
        <div className="cj-derniere">
          <span style={der.ancien} aria-hidden={der.nouveau.opacity >= 1 ? 'true' : undefined}>{derAvant}</span>
          <span style={der.nouveau} aria-hidden={der.nouveau.opacity < 1 ? 'true' : undefined}>{derApres}</span>
        </div>
        {notifLa && (
          <div className="cj-notif" data-notif="" aria-hidden="true" style={notifStyle}>
            <div className="l1"><i style={{ background: PLATEFORMES.vinted.point }} />Nouvelle vente · Vinted · {nomCompte(V.compte)}<em>à l’instant</em></div>
            <div className="l2">{V.titre} · {V.taille} · <span ref={puceRef} className="cj-puce">N°{V.n}</span> — {euros(V.prix)}</div>
          </div>
        )}
        <div className="cj-filet" />
        <button type="button" className="cj-ligne" data-vers="colis" data-cible={cible ? 'ligne-colis' : undefined} onClick={go('colis')}
          aria-label={`Colis à poster : ${J.colisApres}, dont ${J.urgents} à poster aujourd’hui. Voir la section des colis.`}>
          <span className="cj-eclair" style={{ opacity: eclairColis }} />
          <span className="cj-txt"><b>Colis à poster</b><span className="cj-sous"><span>dont {J.urgents} à poster <span style={{ position: 'static', color: K.warn }}>aujourd’hui</span></span></span></span>
          <span className="cj-nb" ref={nbColis}>
            <span style={{ opacity: 1 - roule, transform: roule > 0 ? `translateY(${(-40 * roule).toFixed(1)}%)` : undefined }}>{J.colisAvant}</span>
            <span style={{ opacity: arrive, transform: `translateY(${(40 * (1 - arrive)).toFixed(1)}%)` }}>{J.colisApres}</span>
          </span>
          <span className="cj-chev" aria-hidden="true">›</span>
        </button>
        <button type="button" className="cj-ligne" data-vers="ailleurs" onClick={go('ailleurs')}
          aria-label={`Annonces à retirer : ${J.aRetirerApres}. La N°${V.n} est vendue sur Vinted et encore en ligne sur Leboncoin et eBay. Voir la section.`}>
          <span className="cj-eclair" style={{ opacity: eclairRet }} />
          <span className="cj-txt"><b>Annonces à retirer</b>
            <span className="cj-sous"><span style={ret.ancien}>rien de vendu ailleurs</span><span style={ret.nouveau}>{sousRetirer}</span></span>
          </span>
          <span className="cj-nb" ref={nbRetirer}>
            <span className="cj-point" style={{ opacity: ret.nouveau.opacity }} />
            <span style={{ ...ret.ancien, color: K.faint }}>—</span>
            <span style={ret.nouveau}>{J.aRetirerApres}</span>
          </span>
          <span className="cj-chev" aria-hidden="true">›</span>
        </button>
        <button type="button" className="cj-ligne" data-vers="questions" onClick={go('questions')}
          aria-label={`Colis au relais : ${J.relais.n}, codes de retrait reçus. Voir les autres questions.`}>
          <span className="cj-txt"><b>Colis au relais</b><span className="cj-sous"><span>{sousRelais}</span></span></span>
          <span className="cj-nb"><span>{J.relais.n}</span></span>
          <span className="cj-chev" aria-hidden="true">›</span>
        </button>
        <button type="button" className="cj-ligne" data-vers="questions" onClick={go('questions')}
          aria-label={`Messages non lus : ${J.messages.n}, sur ${J.messages.comptes.join(' et ')}. Voir les autres questions.`}>
          <span className="cj-txt"><b>Messages non lus</b><span className="cj-sous"><span>sur {J.messages.comptes.join(' et ')}</span></span></span>
          <span className="cj-nb"><span>{J.messages.n}</span></span>
          <span className="cj-chev" aria-hidden="true">›</span>
        </button>
        <div className="cj-filet" />
        <button type="button" className="cj-ligne cj-recu" data-vers="urssaf" onClick={go('urssaf')}
          aria-label={`Reçu ce mois-ci : ${euros(J.recu)}, à déclarer. Voir la section URSSAF.`}>
          <span className="cj-txt"><b>Reçu ce mois-ci</b><strong>{euros(J.recu)}</strong></span>
          <span className="cj-dec">à déclarer</span>
          <span className="cj-chev" aria-hidden="true">›</span>
        </button>
      </div>
      {vols}
    </nav>
  );
}

// La carte de la page : elle joue une fois quand on la voit, s'arrête, et
// propose « Revoir ». Moins de mouvement : l'état final, sans « Revoir ».
export default function CarteJour({ onVers }) {
  const boite = React.useRef(null);
  const tilt = React.useRef(null);
  const { s, etat, rejouer, reduit } = useScene(boite, DUREE_CARTE, { seuil: 0.35, attente: 300 });
  // Inclinaison 3D vers le pointeur (souris fine seulement, coupée en mouvement
  // réduit). On écrit le transform SUR l'élément incliné (jamais une variable
  // sur le parent), retargeté par la transition CSS : le suivi est amorti.
  React.useEffect(() => {
    const b = boite.current, c = tilt.current;
    if (!b || !c || reduit) return;
    let fine = false;
    try { fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches && window.innerWidth > 1099; } catch (_) {}
    if (!fine) return;                         // mono-colonne / tactile : pas de suivi (le relief vient de la pose au chargement + la matière)
    let raf = 0, rx = 0, ry = 0;
    const poser = () => { raf = 0; c.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`; };
    const bouge = (e) => {
      const r = b.getBoundingClientRect();
      if (!r.width || !r.height) return;
      ry = ((e.clientX - r.left) / r.width - 0.5) * 16;   // ±8°
      rx = -((e.clientY - r.top) / r.height - 0.5) * 12;  // ±6°
      if (!raf) raf = requestAnimationFrame(poser);
    };
    const sort = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } c.style.transform = ''; }; // retour à plat, adouci par la transition
    b.addEventListener('pointermove', bouge);
    b.addEventListener('pointerleave', sort);
    return () => { b.removeEventListener('pointermove', bouge); b.removeEventListener('pointerleave', sort); if (raf) cancelAnimationFrame(raf); };
  }, [reduit]);
  return (
    <div className="acc-carte-jour" ref={boite}>
      <div className="acc-flotte">
        <div className="acc-tilt" ref={tilt}>
          <CarteJourEcran s={s} etatScene={etat} onVers={onVers} />
        </div>
      </div>
      <div className="acc-revoir-l">
        {etat === 'fin' && !reduit && <RevoirBouton onClick={rejouer} libelle="Revoir l’exemple" />}
      </div>
    </div>
  );
}

export function RevoirBouton({ onClick, libelle }) {
  return (
    <button type="button" className="acc-revoir" data-revoir="" aria-label={libelle} onClick={onClick}>
      <span aria-hidden="true">↻</span> Revoir
    </button>
  );
}
