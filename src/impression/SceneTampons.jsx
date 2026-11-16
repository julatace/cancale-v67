// ════════════════════════════════════════════════════════════════════════════
//  LA SCÈNE DES TAMPONS : un bordereau rendu, ses tampons qu'on DÉPLACE (16 nov.)
//  Le même composant sert l'aperçu AVANT impression (feuille « Imprimer ») et la
//  galerie de Paramètres → Tampons des bordereaux (Julien : « quand je touche
//  Imprimer, les réglages sont appliqués aux bordereaux »).
//  · `octets` + `pose` : le PDF produit par LE code d'impression et la page
//    tamponnée (dimensions, boîtes du N° et de la mention, zones interdites) ;
//  · le N° (`n`) et la mention (`m`) se glissent au doigt ou à la souris, se
//    redimensionnent (poignée, pincement), s'aimantent (centre, axe du QR,
//    au-dessus du QR, bords) ; flèches du clavier ;
//  · pendant le geste, les zones interdites (codes-barres, QR + zone de silence,
//    adresse) sont HACHURÉES ; un tampon lâché dessus est REFUSÉ : il revient à sa
//    place et `onRefus(quoi)` le dit ;
//  · `onPoser(quoi, boite, facteur)` : la nouvelle boîte (points de la page
//    affichée), l'appelant l'enregistre et refait le PDF par le vrai code.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { aimanter, chevauche } from './tampons.js';

const MMP = 72 / 25.4;

export default function SceneTampons({ octets, pose, page, largeur, dessiner, onPoser, onRefus, libres = {}, libelles = {}, occupe = false, compact = false }) {
  const cv = React.useRef(null), scene = React.useRef(null);
  const [pret, setPret] = React.useState(false);
  const [boites, setBoites] = React.useState({ n: null, m: null });
  const [actif, setActif] = React.useState(null);
  const ref = React.useRef({}); ref.current = { boites, pose };
  const ppt = pose ? largeur / pose.W : 1;
  React.useEffect(() => {
    let vivant = true; setPret(false);
    if (!octets || !pose) return undefined;
    dessiner(cv.current, octets, { page: (page != null ? page : pose.page) + 1, largeur }).then(() => { if (vivant) setPret(true); }).catch(() => {});
    return () => { vivant = false; };
  }, [octets, pose, page, largeur]);   // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { setBoites({ n: pose && pose.place ? { ...pose.place } : null, m: pose && pose.mentionBoite ? { ...pose.mentionBoite } : null }); }, [pose]);
  const p = pose;
  const qr = p && (p.codes || []).filter((q) => q.qr).sort((a, b) => b.w * b.h - a.w * a.h)[0];
  const qrZone = qr && (p.interdits || []).find((z) => z.quoi === 'qr' && z.x <= qr.x + 0.5 && z.y <= qr.y + 0.5 && z.x + z.w >= qr.x + qr.w - 0.5);
  const axes = () => {
    if (!p) return [];
    const B = 3 * MMP, a = [{ cx: p.W / 2, nom: 'centre' }, { x: B, nom: 'bord' }, { X: p.W - B, nom: 'bord' }, { y: B, nom: 'bord' }, { Y: p.H - B, nom: 'bord' }];
    if (qr) { a.push({ cx: qr.x + qr.w / 2, nom: 'axe-qr' }); if (qrZone) a.push({ Y: qrZone.y, nom: 'dessus-qr' }); }
    return a;
  };
  const surInterdit = (b) => (p && b ? (p.interdits || []).find((z) => chevauche(b, z)) : null);
  const geste = React.useRef(null), pointeurs = React.useRef(new Map());
  const enPoints = (e) => { const r = scene.current.getBoundingClientRect(); return { x: (e.clientX - r.left) / ppt, y: (e.clientY - r.top) / ppt }; };
  const borner = (b) => (p ? { ...b, x: Math.max(0, Math.min(p.W - b.w, b.x)), y: Math.max(0, Math.min(p.H - b.h, b.y)) } : b);
  const bas = (e) => {
    if (!p || !pret || occupe) return;
    pointeurs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointeurs.current.size >= 2 && geste.current) {
      const [u, v] = [...pointeurs.current.values()], b = ref.current.boites[geste.current.quoi];
      geste.current = { ...geste.current, type: 'pince', d0: Math.hypot(u.x - v.x, u.y - v.y) || 1, w0: b.w, h0: b.h, cx: b.x + b.w / 2, cy: b.y + b.h / 2 };
      return;
    }
    const el = e.target && e.target.closest ? e.target.closest('[data-tampon-el]') : null;
    const quoi = el ? el.getAttribute('data-tampon-el') : null;
    if (!quoi || !ref.current.boites[quoi]) { pointeurs.current.delete(e.pointerId); return; }
    e.preventDefault(); e.stopPropagation();
    try { scene.current.setPointerCapture(e.pointerId); } catch (_) {}
    const b = ref.current.boites[quoi], pt = enPoints(e);
    const taille = !!(e.target.closest && e.target.closest('[data-tampon-poignee]'));
    geste.current = { quoi, type: taille ? 'taille' : 'glisse', dx: pt.x - b.x, dy: pt.y - b.y, x0: pt.x, w0: b.w, h0: b.h, avant: { ...b } };
    setActif(quoi);
  };
  const bouge = (e) => {
    if (!pointeurs.current.has(e.pointerId)) return;
    pointeurs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const G = geste.current; if (!G) return;
    e.preventDefault();
    const b = ref.current.boites[G.quoi]; if (!b) return;
    let n = b;
    if (G.type === 'pince' && pointeurs.current.size >= 2) {
      const [u, v] = [...pointeurs.current.values()], f = Math.max(0.4, Math.min(3, Math.hypot(u.x - v.x, u.y - v.y) / G.d0));
      n = borner({ ...b, w: G.w0 * f, h: G.h0 * f, x: G.cx - G.w0 * f / 2, y: G.cy - G.h0 * f / 2 });
    } else if (G.type === 'taille') {
      const pt = enPoints(e), f = Math.max(0.4, Math.min(3, (G.w0 + (pt.x - G.x0)) / G.w0));
      n = borner({ ...b, w: G.w0 * f, h: G.h0 * f });
    } else {
      const pt = enPoints(e);
      n = borner(aimanter({ ...b, x: pt.x - G.dx, y: pt.y - G.dy }, axes(), 8 / ppt));
    }
    setBoites((x) => ({ ...x, [G.quoi]: n }));
  };
  const lacher = (quoi, b, avant, facteur) => {
    const z = surInterdit(b);
    if (z) { setBoites((x) => ({ ...x, [quoi]: avant })); if (onRefus) onRefus(z.quoi || 'code'); return; }
    if (onPoser) onPoser(quoi, b, facteur);
  };
  const haut = (e) => {
    pointeurs.current.delete(e.pointerId);
    const G = geste.current; if (!G || pointeurs.current.size) return;
    geste.current = null; setActif(null);
    const b = ref.current.boites[G.quoi]; if (!b || !p) return;
    if (Math.abs(b.x - G.avant.x) < 0.5 && Math.abs(b.y - G.avant.y) < 0.5 && Math.abs(b.w - G.avant.w) < 0.5) return;
    lacher(G.quoi, b, G.avant, G.type !== 'glisse' ? b.w / G.avant.w : 1);
  };
  const clavier = (quoi) => (e) => {
    const b = ref.current.boites[quoi]; if (!b) return;
    const pas = e.shiftKey ? 10 : 2, d = { ArrowLeft: [-pas, 0], ArrowRight: [pas, 0], ArrowUp: [0, -pas], ArrowDown: [0, pas] }[e.key];
    if (!d) return;
    e.preventDefault();
    const n = borner({ ...b, x: b.x + d[0], y: b.y + d[1] });
    setBoites((x) => ({ ...x, [quoi]: n })); lacher(quoi, n, b, 1);
  };
  const boite = (quoi) => {
    const b = boites[quoi]; if (!b) return null;
    const refusee = actif === quoi && !!surInterdit(b);
    return (
      <div key={quoi} data-tampon-el={quoi} data-x={b.x.toFixed(2)} data-y={b.y.toFixed(2)} data-w={b.w.toFixed(2)} data-h={b.h.toFixed(2)} data-libre={libres[quoi] ? '1' : '0'}
        tabIndex={0} role="slider" aria-label={libelles[quoi] || quoi} aria-valuetext={`${Math.round(b.x)}, ${Math.round(b.y)}`} onKeyDown={clavier(quoi)}
        className={'vrm-tampons-el' + (quoi === 'm' ? ' vrm-tampons-el-m' : '') + (refusee ? ' vrm-tampons-el-refus' : '') + (compact ? ' vrm-tampons-el-compact' : '')}
        style={{ left: b.x * ppt, top: b.y * ppt, width: b.w * ppt, height: b.h * ppt }}>
        <span className="vrm-tampon-poignee" data-tampon-poignee="1" aria-hidden="true"><i/></span>
      </div>
    );
  };
  return (
    <div ref={scene} className="vrm-tampon-scene vrm-tampons-scene" data-tampons-scene="" data-pret={pret ? '1' : '0'} data-ppt={ppt.toFixed(4)} data-cle={p ? p.cle : ''}
      data-page={p ? (page != null ? page : p.page) : ''} style={{ width: largeur }}
      onPointerDown={bas} onPointerMove={bouge} onPointerUp={haut} onPointerCancel={haut}>
      <canvas ref={cv} className="vrm-tampon-page" aria-hidden="true" data-stream-image="bordereau"/>
      {p && pret && (p.interdits || []).map((z, i) => (
        <i key={i} data-tampon-interdit={z.quoi || 'code'} className={'vrm-tampons-interdit' + (actif ? ' vrm-tampons-interdit-vu' : '')}
          style={{ left: Math.max(0, z.x) * ppt, top: Math.max(0, z.y) * ppt, width: Math.max(0, Math.min(p.W, z.x + z.w) - Math.max(0, z.x)) * ppt, height: Math.max(0, Math.min(p.H, z.y + z.h) - Math.max(0, z.y)) * ppt }}/>
      ))}
      {p && pret && boite('n')}
      {p && pret && boite('m')}
    </div>
  );
}
