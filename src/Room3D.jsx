// ── STOCK 3D — chargé À LA DEMANDE (Vitesse 5) ───────────────────────────────
// Sorti de src/App.jsx (fichier unique de ~37 000 lignes) pour alléger le bundle
// initial : ce gros bloc 3D (~1250 lignes + `three`, déjà en import dynamique) ne
// se charge que quand on ouvre le Stock. `C`, `Icon`, `load`, `save` arrivent en
// PROPS (mesuré : les seuls identifiants de niveau module qu'il utilise) — pas
// d'import circulaire avec App.jsx. Rendu derrière <Suspense> côté App.
import React, { useState, useEffect, useRef } from 'react';
import { plateauxMeuble, hauteurPile } from './stockRegles.js';

function Room3D({ items, room, poly, hi, sel, canMove, onOpen, onSelect, onCellTap, onPileTap, onMove, colorOf, emojiOf, h3dOf, storedCount, depot, sortie, vueDessus, cibles, fallback, viseurRef, C, Icon, load, save, FURN_TYPES, GARAGE_AMBIANCES }) {
  const mountRef = React.useRef(null);
  const st = React.useRef({});
  const dataRef = React.useRef({ items });
  const moveRef = React.useRef(canMove); moveRef.current = canMove; // lu en direct par les handlers
  const cbRef = React.useRef({}); cbRef.current = { onCellTap, onPileTap, onSelect, onOpen, onMove }; // callbacks à jour
  const selRef = React.useRef({}); selRef.current = { sel, hi }; // lu par la mise en page des étiquettes
  const [err, setErr] = useState(false);
  const [loading, setLoading] = useState(true);
  const [amb, setAmb] = useState(() => load('vrm_garage_ambiance', 'clair')); // univers 3D choisi (par appareil)
  const [ambOpen, setAmbOpen] = useState(false); // la liste d'ambiances ne s'ouvre que sur demande
  const [enDessus, setEnDessus] = useState(false); // la vue est passée au-dessus après un changement de disposition
  // La forme de la pièce (coins en mètres, cadre 0..w × 0..h). Sans `poly`, le
  // rectangle d'avant — rendu EXACTEMENT comme avant.
  const formeLibre = Array.isArray(poly) && poly.length >= 3 && !(poly.length === 4 && poly.every(([x, y]) => (x === 0 || x === room.w) && (y === 0 || y === room.h)));
  const HSCALE = 1.5;

  useEffect(() => {
    let cancelled = false; let cleanup = () => {};
    (async () => {
      let THREE, OrbitControls;
      try {
        THREE = await import('three');
        ({ OrbitControls } = await import('three/addons/controls/OrbitControls.js'));
      } catch (e) { if (!cancelled) { setErr(true); setLoading(false); } return; }
      const el = mountRef.current; if (cancelled || !el) return;
      let renderer;
      try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); }
      catch (e) { setErr(true); setLoading(false); return; }
      const W = el.clientWidth || 360, H = el.clientHeight || 380;
      renderer.setSize(W, H); renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      try { renderer.outputColorSpace = THREE.SRGBColorSpace; } catch (_) {}
      el.appendChild(renderer.domElement);
      const scene = new THREE.Scene(); scene.background = new THREE.Color('#eef1f6');
      const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 1000);
      // ⚠️ LA VUE DOIT CADRER LA PIÈCE ENTIÈRE, pas un coin.
      // L'ancienne position était FIXE (x=w*0.1, z=h*1.05) : sur une pièce de
      // 7×6 la caméra se retrouvait à ~7 m du centre, donc DANS la pièce —
      // l'étagère était coupée en haut et à moitié cachée par le canapé
      // (constaté en capture, pas supposé). On calcule maintenant la distance
      // qui fait entrer la boîte englobante de la pièce dans le champ, en
      // tenant compte du FORMAT du canvas : sur un écran étroit c'est la
      // largeur qui contraint, pas la hauteur.
      const cadrerPiece = () => {
        const wallH = room.wallH || 3.4;
        const tgt = new THREE.Vector3(0, wallH * 0.28, 0);
        // Direction fixe (trois-quarts, légèrement en hauteur) ; c'est la
        // DISTANCE qu'on calcule.
        const az = Math.PI * 0.21, el = Math.PI * 0.19;
        const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
        // ⚠️ ON NE CADRE PAS LA SPHÈRE ENGLOBANTE.
        // Première version : R = demi-diagonale de la pièce → la caméra partait
        // beaucoup trop loin et la pièce flottait au milieu d'un grand vide gris
        // (constaté en capture). La diagonale d'une boîte est bien plus grande
        // que ce qu'on voit réellement d'un point de vue donné.
        // On projette donc les 8 COINS dans le repère de la caméra et on cherche
        // la plus petite distance qui les fait tous entrer — exact, et ça
        // s'adapte tout seul à la forme de la pièce comme au format de l'écran.
        const up = new THREE.Vector3(0, 1, 0);
        const right = new THREE.Vector3().crossVectors(up, dir).normalize();
        const vraiUp = new THREE.Vector3().crossVectors(dir, right).normalize();
        const tanV = Math.tan((camera.fov * Math.PI / 180) / 2);
        const tanH = tanV * camera.aspect;
        let d = 3;
        const hw = room.w / 2, hh = room.h / 2;
        for (const sx of [-1, 1]) for (const sy of [0, 1]) for (const sz of [-1, 1]) {
          const p = new THREE.Vector3(sx * hw, sy * wallH, sz * hh).sub(tgt);
          const x = Math.abs(p.dot(right)), y = Math.abs(p.dot(vraiUp)), z = p.dot(dir);
          d = Math.max(d, z + x / tanH, z + y / tanV);
        }
        d *= 1.06;                                                // un souffle de marge
        return { pos: dir.clone().multiplyScalar(d).add(tgt), tgt, d };
      };
      const cadre0 = cadrerPiece();
      camera.position.copy(cadre0.pos);
      // Éclairage d'intérieur : lumière du ciel douce + soleil chaud (ombres nettes)
      // + une lumière d'appoint froide pour déboucher les ombres → rendu réaliste.
      try { renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12; } catch (_) {}
      const hemi = new THREE.HemisphereLight(0xfff3e0, 0xa6a290, 0.92); scene.add(hemi); // ciel chaud, sol neutre
      const ambient = new THREE.AmbientLight(0xffffff, 0.2); scene.add(ambient);
      const dir = new THREE.DirectionalLight(0xfff1dc, 1.05); // soleil chaud
      dir.position.set(room.w * 0.55, Math.max(room.w, room.h) * 1.6, room.h * 0.6);
      dir.castShadow = true; dir.shadow.mapSize.set(2048, 2048); dir.shadow.radius = 3;
      const sc = Math.max(room.w, room.h);
      dir.shadow.camera.left = -sc; dir.shadow.camera.right = sc; dir.shadow.camera.top = sc; dir.shadow.camera.bottom = -sc;
      dir.shadow.camera.near = 0.5; dir.shadow.camera.far = sc * 4.5; dir.shadow.bias = -0.0004; dir.shadow.normalBias = 0.02;
      scene.add(dir);
      const fill = new THREE.DirectionalLight(0xdfe8ff, 0.32); // appoint froid, sans ombre
      fill.position.set(-room.w * 0.6, Math.max(room.w, room.h) * 0.9, -room.h * 0.4);
      scene.add(fill);
      // ── Textures & matières procédurales (aucun fichier externe) ──
      const clamp255 = (v) => Math.max(0, Math.min(255, v | 0));
      const shade = (hex, amt) => { const h = String(hex).replace('#', ''); const r = clamp255(parseInt(h.slice(0, 2), 16) + amt), g = clamp255(parseInt(h.slice(2, 4), 16) + amt), b = clamp255(parseInt(h.slice(4, 6), 16) + amt); return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join(''); };
      // ⚠️ LE VIDE AUTOUR DE LA PIÈCE N'EST PAS DÉCORATIF.
      // Vue de loin, la pièce ne remplit pas tout le cadre : ce qui reste,
      // c'était un APLAT gris uni — la chose qui fait le plus « rendu 3D pas
      // fini ». Un dégradé vertical très léger (même recette que les murs)
      // suffit à poser un horizon. Régénéré à chaque changement d'ambiance.
      const fondDegrade = (hex) => {
        const cv = document.createElement('canvas'); cv.width = 4; cv.height = 256;
        const g = cv.getContext('2d').createLinearGradient(0, 0, 0, 256);
        g.addColorStop(0, shade(hex, 16)); g.addColorStop(0.62, hex); g.addColorStop(1, shade(hex, -22));
        const c = cv.getContext('2d'); c.fillStyle = g; c.fillRect(0, 0, 4, 256);
        const t = new THREE.CanvasTexture(cv);
        try { t.colorSpace = THREE.SRGBColorSpace; } catch (_) {}
        return t;
      };
      scene.background = fondDegrade('#eef1f6');
      const makeWood = (base) => {
        const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
        x.fillStyle = base; x.fillRect(0, 0, 128, 128);
        for (let i = 0; i < 24; i++) { x.strokeStyle = `rgba(50,32,16,${0.04 + Math.random() * 0.06})`; x.lineWidth = 1 + Math.random() * 1.5; x.beginPath(); const y = Math.random() * 128; x.moveTo(0, y); x.bezierCurveTo(42, y + (Math.random() * 10 - 5), 90, y + (Math.random() * 10 - 5), 128, y + (Math.random() * 8 - 4)); x.stroke(); }
        const t = new THREE.CanvasTexture(c); try { t.colorSpace = THREE.SRGBColorSpace; } catch (_) {} t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
      };
      const woodMat = (base) => new THREE.MeshStandardMaterial({ map: makeWood(base), color: 0xffffff, roughness: 0.72, metalness: 0.02 });
      const flatMat = (base, rough) => new THREE.MeshStandardMaterial({ color: base, roughness: rough == null ? 0.7 : rough, metalness: 0.02 });
      const metalMat = new THREE.MeshStandardMaterial({ color: '#33343a', metalness: 0.75, roughness: 0.35 });
      const shadowize = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
      // ── SOL : UN VRAI PARQUET À LAMES ────────────────────────────────────
      // Le sol est la plus grande surface de l'image : c'est lui qui décide si
      // on voit une pièce ou un plan. Une texture de bois « bruitée » étirée sur
      // 6 mètres n'a aucune échelle — l'œil n'a rien pour mesurer la profondeur.
      // Des LAMES avec leurs joints, décalées d'une rangée à l'autre, donnent
      // cette échelle et la perspective avec.
      const makeParquet = (base) => {
        const S = 512, LAMES = 4, RANGS = 8;             // 4 lames × 8 rangs par tuile
        const c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
        const lw = S / LAMES, lh = S / RANGS;
        x.fillStyle = base; x.fillRect(0, 0, S, S);
        for (let r = 0; r < RANGS; r++) {
          const dec = (r % 2) * (lw / 2);               // pose à coupe perdue
          for (let i = -1; i <= LAMES; i++) {
            const px = i * lw + dec, py = r * lh;
            // Chaque lame a sa propre teinte : un parquet n'est jamais uni.
            const v = (Math.random() * 22 - 11) | 0;
            x.fillStyle = shade(base, v); x.fillRect(px, py, lw, lh);
            // veinage
            for (let k = 0; k < 5; k++) {
              x.strokeStyle = `rgba(60,38,18,${0.03 + Math.random() * 0.05})`;
              x.lineWidth = 0.6 + Math.random();
              const yy = py + Math.random() * lh;
              x.beginPath(); x.moveTo(px, yy);
              x.bezierCurveTo(px + lw * 0.35, yy + (Math.random() * 4 - 2), px + lw * 0.7, yy + (Math.random() * 4 - 2), px + lw, yy + (Math.random() * 3 - 1.5));
              x.stroke();
            }
            // joints : un trait sombre en bas et à droite, un liseré clair en
            // haut — c'est ce contraste qui donne le relief de la lame.
            x.strokeStyle = 'rgba(35,22,10,.30)'; x.lineWidth = 1.4;
            x.beginPath(); x.moveTo(px, py + lh); x.lineTo(px + lw, py + lh); x.moveTo(px + lw, py); x.lineTo(px + lw, py + lh); x.stroke();
            x.strokeStyle = 'rgba(255,244,225,.16)'; x.lineWidth = 1;
            x.beginPath(); x.moveTo(px, py + 0.6); x.lineTo(px + lw, py + 0.6); x.stroke();
          }
        }
        const t = new THREE.CanvasTexture(c);
        try { t.colorSpace = THREE.SRGBColorSpace; } catch (_) {}
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        try { t.anisotropy = renderer.capabilities.getMaxAnisotropy(); } catch (_) {}
        return t;
      };
      // Une tuile = ~1,6 m de côté : les lames gardent une taille crédible quelle
      // que soit la taille de la pièce (avant, elles s'étiraient avec).
      const floorTex = makeParquet(room.floorColor || '#c9ab84');
      floorTex.repeat.set(Math.max(1, room.w / 1.6), Math.max(1, room.h / 1.6));
      const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.74, metalness: 0.03 });
      // (17 oct.) Pièce de FORME LIBRE : le sol suit les coins dessinés vu du dessus.
      let floorGeo;
      if (formeLibre) {
        const sh = new THREE.Shape();
        poly.forEach(([x, y], i) => { const px = x - room.w / 2, py = -(y - room.h / 2); if (i) sh.lineTo(px, py); else sh.moveTo(px, py); });
        floorGeo = new THREE.ShapeGeometry(sh);
        floorTex.repeat.set(1 / 1.6, 1 / 1.6);   // la forme porte ses UV en mètres
      } else floorGeo = new THREE.PlaneGeometry(room.w, room.h);
      const floor = new THREE.Mesh(floorGeo, floorMat);
      floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
      // murs (orientés vers l'intérieur → les murs proches ne bouchent pas la vue)
      const wallH = Math.max(2.4, room.wallH || 3.4);
      // ── MURS : LA LUMIÈRE TOMBE ──────────────────────────────────────────
      // Un mur d'une seule teinte du sol au plafond est le signe le plus sûr
      // d'une image de synthèse : dans une vraie pièce, la lumière décroît vers
      // le bas et le haut prend celle du plafond. Un dégradé vertical très
      // léger (plus une trame fine) suffit à faire basculer l'impression.
      const makeWall = (base) => {
        const c = document.createElement('canvas'); c.width = 8; c.height = 256; const x = c.getContext('2d');
        const g = x.createLinearGradient(0, 0, 0, 256);      // 0 = plafond, 256 = sol
        g.addColorStop(0, shade(base, 10)); g.addColorStop(0.55, base); g.addColorStop(1, shade(base, -16));
        x.fillStyle = g; x.fillRect(0, 0, 8, 256);
        for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.02})`; x.fillRect(Math.random() * 8, Math.random() * 256, 1, 1); }
        const t = new THREE.CanvasTexture(c);
        try { t.colorSpace = THREE.SRGBColorSpace; } catch (_) {}
        return t;                                            // pas de répétition : le dégradé couvre la hauteur
      };
      const wallMat = new THREE.MeshStandardMaterial({ map: makeWall(room.wallColor || '#e4e8ee'), roughness: 0.95, side: THREE.FrontSide });
      const mkWall = (w, x, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, wallH), wallMat); m.position.set(x, wallH / 2, z); m.rotation.y = ry; m.receiveShadow = true; scene.add(m); };
      // Plinthes (bas des murs) → touche « vraie pièce ».
      const skirtMat = new THREE.MeshStandardMaterial({ color: '#f4f5f7', roughness: 0.6 });
      const mkSkirt = (len, x, z, horiz) => { const m = new THREE.Mesh(new THREE.BoxGeometry(horiz ? len : 0.05, 0.14, horiz ? 0.05 : len), skirtMat); m.position.set(x, 0.07, z); m.receiveShadow = true; scene.add(m); };
      // Le dedans de la pièce (pour orienter chaque mur vers l'intérieur).
      const dedansPoly = (x, y) => { let d = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d; } return d; };
      if (formeLibre) {
        // Un mur par côté de la forme, tourné vers le DEDANS (FrontSide : un mur
        // proche ne bouche pas la vue, comme pour le rectangle).
        poly.forEach((a, i) => {
          const b = poly[(i + 1) % poly.length];
          const ax = a[0] - room.w / 2, az = a[1] - room.h / 2, bx = b[0] - room.w / 2, bz = b[1] - room.h / 2;
          const L = Math.hypot(bx - ax, bz - az); if (L < 0.01) return;
          const mx = (ax + bx) / 2, mz = (az + bz) / 2;
          let ry = Math.atan2(-(bz - az), bx - ax);
          // normale de la face avant après rotation : (sin ry, 0, cos ry)
          if (!dedansPoly(mx + Math.sin(ry) * 0.05 + room.w / 2, mz + Math.cos(ry) * 0.05 + room.h / 2)) ry += Math.PI;
          mkWall(L, mx, mz, ry);
          const sk = new THREE.Mesh(new THREE.BoxGeometry(L, 0.14, 0.05), skirtMat);
          sk.position.set(mx + Math.sin(ry) * 0.025, 0.07, mz + Math.cos(ry) * 0.025); sk.rotation.y = ry; sk.receiveShadow = true; scene.add(sk);
        });
      } else {
        mkWall(room.w, 0, -room.h / 2, 0); mkWall(room.w, 0, room.h / 2, Math.PI);
        mkWall(room.h, -room.w / 2, 0, Math.PI / 2); mkWall(room.h, room.w / 2, 0, -Math.PI / 2);
        mkSkirt(room.w, 0, -room.h / 2 + 0.025, true); mkSkirt(room.w, 0, room.h / 2 - 0.025, true);
        mkSkirt(room.h, -room.w / 2 + 0.025, 0, false); mkSkirt(room.h, room.w / 2 - 0.025, 0, false);
      }
      // étiquette (sprite texte)
      // (17 oct.) La plaque est TAILLÉE AU TEXTE (elle faisait toujours 256 px de
      // large, même pour « Table ») : c'est sa vraie largeur qui sert à juger un
      // chevauchement à l'écran (`placerEtiquettes`, plus bas).
      const makeLabel = (text, lMin = 80) => {
        const t = String(text).slice(0, 36); const police = 'bold 26px system-ui,sans-serif';
        const c = document.createElement('canvas'); let x = c.getContext('2d'); x.font = police;
        // Un pictogramme se mesure mal selon la police de repli : marge de 15 %.
        const lw = Math.min(460, Math.max(lMin, Math.ceil(x.measureText(t).width * 1.15) + 36));
        c.width = lw; c.height = 64; x = c.getContext('2d');
        x.fillStyle = 'rgba(0,0,0,0.66)'; x.beginPath(); x.roundRect ? x.roundRect(2, 12, lw - 4, 40, 12) : x.rect(2, 12, lw - 4, 40); x.fill();
        x.fillStyle = '#fff'; x.font = police; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(t, lw / 2, 33);
        const tex = new THREE.CanvasTexture(c); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
        // ⚠️ Une étiquette n'est pas une cible : son rectangle (transparent sur
        //    les bords) recouvrait les cartons de devant et volait leurs clics.
        sp.scale.set(0.6 * lw / 64, 0.6, 1); sp.raycast = () => {}; sp.userData.etiquette = { ratio: lw / 64 }; sp.renderOrder = 10; return sp;
      };
      // CARTON numéroté (boîte à chaussures) — le NUMÉRO est imprimé EN GROS
      // sur la face avant, le dessus et les côtés → lisible directement dans la
      // vue 3D, sans cliquer, même quand les cartons sont empilés (jusqu'à ~18).
      // Textures & matériaux mis en cache par numéro (un seul carton = 4 textures
      // sinon, ça saturerait avec de grandes piles).
      const colisCache = new Map();
      // Matière kraft unie partagée pour les CÔTÉS des cartons (naturel, pas de
      // numéro miroir sur les côtés). Recréée à chaque reconstruction (cache vidé).
      const kraftMat = () => { let k = colisCache.get('__kraft'); if (!k) { k = new THREE.MeshStandardMaterial({ color: '#c19a5f', roughness: 0.96 }); colisCache.set('__kraft', k); } return k; };
      // Face AVANT : simple carton kraft (grain léger + rabat central) avec le
      // NUMÉRO écrit directement dessus au marqueur — pas d'étiquette « produit ».
      const KRAFT = '#c19a5f';
      // Petit utilitaire : rectangle à coins arrondis (fallback si roundRect absent).
      const rrect = (x, px, py, w, h, r) => {
        if (x.roundRect) { x.beginPath(); x.roundRect(px, py, w, h, r); return; }
        x.beginPath(); x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r); x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath();
      };
      // Face AVANT premium : carton kraft réaliste + ÉTIQUETTE D'EXPÉDITION blanche
      // avec le numéro EN GROS, très lisible (bande d'accent colorée en tête).
      // `accent` = couleur perso du vendeur (code couleur de rangement) sinon teal.
      const colisFrontTex = (num, accent) => {
        const S = 320; const c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
        const AC = accent || '#0a7f74';
        x.fillStyle = KRAFT; x.fillRect(0, 0, S, S);
        for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(90,60,25,${0.02 + Math.random() * 0.035})`; x.fillRect(Math.random() * S, Math.random() * S, 3 + Math.random() * 40, 1 + Math.random() * 3); } // grain carton
        x.strokeStyle = 'rgba(80,55,25,0.30)'; x.lineWidth = 3; x.beginPath(); x.moveTo(S / 2, 0); x.lineTo(S / 2, S); x.stroke(); // rabat central
        x.fillStyle = 'rgba(210,190,150,0.5)'; x.fillRect(0, S * 0.05, S, S * 0.11);                                             // ruban adhésif haut
        // Étiquette blanche centrée, ombre douce → aspect premium/pro.
        const lw = S * 0.78, lh = S * 0.56, lx = (S - lw) / 2, ly = (S - lh) / 2 + S * 0.03;
        x.save(); x.shadowColor = 'rgba(0,0,0,0.28)'; x.shadowBlur = 14; x.shadowOffsetY = 6;
        x.fillStyle = '#fcfbf8'; rrect(x, lx, ly, lw, lh, 16); x.fill(); x.restore();
        // Bande d'accent en tête d'étiquette.
        x.save(); rrect(x, lx, ly, lw, lh, 16); x.clip(); x.fillStyle = AC; x.fillRect(lx, ly, lw, lh * 0.2); x.restore();
        x.strokeStyle = 'rgba(0,0,0,0.10)'; x.lineWidth = 2; rrect(x, lx, ly, lw, lh, 16); x.stroke();
        // Petit label « N° » sur la bande.
        x.fillStyle = 'rgba(255,255,255,0.95)'; x.font = `800 ${Math.round(lh * 0.11)}px system-ui,sans-serif`; x.textAlign = 'left'; x.textBaseline = 'middle';
        x.fillText('N°', lx + lw * 0.08, ly + lh * 0.1);
        // NUMÉRO en très gros, noir, centré.
        x.fillStyle = '#131313'; x.font = `900 ${Math.round(lh * 0.6)}px system-ui,"Arial Black",sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(String(num).slice(0, 4), S / 2, ly + lh * 0.6);
        const t = new THREE.CanvasTexture(c); try { t.colorSpace = THREE.SRGBColorSpace; } catch (_) {} t.anisotropy = 8; return t;
      };
      // Dessus : rabats du carton + petite étiquette avec le numéro (gros aussi).
      const colisTopTex = (num, accent) => {
        const S = 192; const c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
        x.fillStyle = KRAFT; x.fillRect(0, 0, S, S);
        x.strokeStyle = 'rgba(80,55,25,0.4)'; x.lineWidth = 4; x.beginPath(); x.moveTo(S / 2, 0); x.lineTo(S / 2, S); x.moveTo(0, S / 2); x.lineTo(S, S / 2); x.stroke(); // rabats
        const lw = S * 0.66, lh = S * 0.44, lx = (S - lw) / 2, ly = (S - lh) / 2;
        x.save(); x.shadowColor = 'rgba(0,0,0,0.22)'; x.shadowBlur = 8; x.shadowOffsetY = 3; x.fillStyle = '#fcfbf8'; rrect(x, lx, ly, lw, lh, 10); x.fill(); x.restore();
        x.fillStyle = accent || '#0a7f74'; x.save(); rrect(x, lx, ly, lw, lh, 10); x.clip(); x.fillRect(lx, ly, lw, lh * 0.16); x.restore();
        x.fillStyle = '#131313'; x.font = `900 ${Math.round(lh * 0.56)}px system-ui,"Arial Black",sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(num).slice(0, 4), S / 2, ly + lh * 0.58);
        const t = new THREE.CanvasTexture(c); try { t.colorSpace = THREE.SRGBColorSpace; } catch (_) {} t.anisotropy = 4; return t;
      };
      const makeColis = (num, bw, bh, bd) => {
        let cc = colisCache.get(num);
        if (!cc) {
          const frontMat = new THREE.MeshStandardMaterial({ map: colisFrontTex(num), roughness: 0.9 });
          const topMat = new THREE.MeshStandardMaterial({ map: colisTopTex(num), roughness: 0.92 });
          const kraft = kraftMat();
          // ordre BoxGeometry : +X, -X, +Y(dessus), -Y, +Z(avant), -Z → n° avant + dessus, kraft uni ailleurs
          cc = [kraft, kraft, topMat, kraft, frontMat, kraft];
          colisCache.set(num, cc);
        }
        const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), cc);
        b.castShadow = true; b.receiveShadow = true; return b;
      };
      // ── Constructeurs de MEUBLES détaillés (groupes de volumes) ──
      const box = (w, h, d, mat) => shadowize(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat));
      const buildCommode = (w, d, ht, base, rows) => {
        const g = new THREE.Group(); const body = box(w, ht, d, woodMat(base)); body.position.y = ht / 2; g.add(body);
        const n = Math.max(2, Math.min(5, rows || 3)), dh = ht / n, fm = woodMat(shade(base, -14));
        for (let i = 0; i < n; i++) { const fy = (i + 0.5) * dh; const front = box(w * 0.86, dh * 0.8, 0.05, fm); front.position.set(0, fy, d / 2 + 0.026); g.add(front); const hd = box(w * 0.24, 0.05, 0.06, metalMat); hd.position.set(0, fy, d / 2 + 0.06); g.add(hd); }
        return g;
      };
      const buildEtagere = (w, d, ht, base, rows) => {
        const g = new THREE.Group(); const m = woodMat(base), t = 0.06;
        [-w / 2 + t / 2, w / 2 - t / 2].forEach(px => { const s = box(t, ht, d, m); s.position.set(px, ht / 2, 0); g.add(s); });
        const back = box(w, ht, t * 0.6, woodMat(shade(base, -8))); back.position.set(0, ht / 2, -d / 2 + t * 0.3); g.add(back);
        const n = Math.max(2, Math.min(6, rows || 4));
        for (let i = 0; i <= n; i++) { const yy = Math.min(ht - t / 2, Math.max(t / 2, (i / n) * ht)); const sh = box(w - t, t, d - t, m); sh.position.set(0, yy, 0); g.add(sh); }
        return g;
      };
      const buildPenderie = (w, d, ht, base) => {
        const g = new THREE.Group(); const m = woodMat(base), t = 0.07;
        [-w / 2 + t, w / 2 - t].forEach(px => { const p = box(t, ht, t, m); p.position.set(px, ht / 2, 0); g.add(p); });
        const bar = shadowize(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, w - 2 * t, 10), metalMat)); bar.rotation.z = Math.PI / 2; bar.position.set(0, ht * 0.86, 0); g.add(bar);
        const top = box(w, t, d, m); top.position.set(0, ht - t / 2, 0); g.add(top);
        const cols = ['#c94f4f', '#4f6fc9', '#4fae8f', '#d4a24b', '#8a5fb0', '#c96f9f'], cn = Math.max(3, Math.round(w * 1.6));
        for (let i = 0; i < cn; i++) { const cx = -w / 2 + t + (i + 0.5) * ((w - 2 * t) / cn); const ch = ht * 0.5 * (0.8 + ((i * 7) % 5) / 10); const cl = box((w - 2 * t) / cn * 0.72, ch, d * 0.5, flatMat(cols[i % cols.length], 0.9)); cl.position.set(cx, ht * 0.86 - ch / 2, 0); g.add(cl); }
        return g;
      };
      // (17 oct.) ÉTAGÈRE MÉTAL : quatre montants en cornière, des plateaux, des
      // barres en croix au dos et sur les côtés — l'étagère de garage. En bois :
      // deux joues pleines et des plateaux épais, sans croix.
      // (28 oct.) `plateaux` (Set « r:c », src/stockRegles.js) : un plateau entre
      // deux niveaux peut ne couvrir que certaines colonnes. Le bas et le haut
      // sont toujours là. null ⇒ tous les plateaux (comme avant).
      const buildMetal = (w, d, ht, base, rows, bois, cols, plateaux) => {
        const g = new THREE.Group(); const n = Math.max(1, rows || 4), nc = Math.max(1, cols || 1);
        // Les morceaux d'un plateau d'index i (0 = le sol, n = le haut) : [x0, x1] en fraction de la largeur.
        const morceaux = (i) => {
          if (!plateaux || i === 0 || i === n) return [[0, 1]];
          const r = n - i, out = []; let deb = null;
          for (let c = 1; c <= nc + 1; c++) { const on = c <= nc && plateaux.has(r + ':' + c); if (on && deb == null) deb = c - 1; if (!on && deb != null) { out.push([deb / nc, (c - 1) / nc]); deb = null; } }
          return out;
        };
        if (bois) {
          const m = woodMat(base), t = 0.04;
          [-w / 2 + t / 2, w / 2 - t / 2].forEach(px => { const s = box(t, ht, d, m); s.position.set(px, ht / 2, 0); g.add(s); });
          const back = box(w, ht, 0.015, woodMat(shade(base, -10))); back.position.set(0, ht / 2, -d / 2 + 0.008); g.add(back);
          for (let i = 0; i <= n; i++) { const yy = Math.min(ht - 0.015, Math.max(0.015, (i / n) * ht)); morceaux(i).forEach(([a, b]) => { const lw = (w - 2 * t) * (b - a); const sh = box(lw, 0.03, d - 0.02, m); sh.position.set(-w / 2 + t + (w - 2 * t) * (a + b) / 2, yy, 0.005); sh.userData.plateau = true; g.add(sh); }); }
          return g;
        }
        const acier = new THREE.MeshStandardMaterial({ color: base, metalness: 0.65, roughness: 0.38 });
        const plat = new THREE.MeshStandardMaterial({ color: shade(base, 18), metalness: 0.45, roughness: 0.5 });
        const p = 0.035;
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => { const m = box(p, ht, p, acier); m.position.set(sx * (w / 2 - p / 2), ht / 2, sz * (d / 2 - p / 2)); g.add(m); });
        for (let i = 0; i <= n; i++) {
          const yy = Math.min(ht - 0.012, Math.max(0.03, (i / n) * ht));
          morceaux(i).forEach(([a, b]) => {
            const lw = (w - 0.01) * (b - a), cx = -w / 2 + 0.005 + (w - 0.01) * (a + b) / 2;
            const sh = box(lw, 0.022, d - 0.01, plat); sh.position.set(cx, yy, 0); sh.userData.plateau = true; g.add(sh);
            const lip = box(lw, 0.04, 0.012, acier); lip.position.set(cx, yy, d / 2 - 0.006); g.add(lip);   // le bord plié du plateau
          });
        }
        // barres en croix (dos + côtés), entre deux plateaux sur deux
        const barre = (x1, y1, z1, x2, y2, z2) => { const L = Math.hypot(x2 - x1, y2 - y1, z2 - z1); const c = cyl(0.007, 0.007, L, acier, 6); c.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2); c.lookAt(x2, y2, z2); c.rotateX(Math.PI / 2); g.add(c); };
        for (let i = 0; i < n; i += 2) {
          const y0 = (i / n) * ht + 0.03, y1 = Math.min(ht, ((i + 1) / n) * ht);
          barre(-w / 2 + p, y0, -d / 2 + 0.01, w / 2 - p, y1, -d / 2 + 0.01); barre(w / 2 - p, y0, -d / 2 + 0.01, -w / 2 + p, y1, -d / 2 + 0.01);
          [-1, 1].forEach(sx => { barre(sx * (w / 2 - 0.01), y0, -d / 2 + p, sx * (w / 2 - 0.01), y1, d / 2 - p); });
        }
        return g;
      };
      // PORTANT À CINTRES : deux pieds à roulettes, une barre, et pour chaque
      // place un cintre — avec un vêtement et l'étiquette de son NUMÉRO quand il
      // porte quelque chose, en transparence quand il est libre (on le touche
      // pour y ranger). Chaque cintre porte sa case (`cell`) pour le clic.
      // (28 oct.) Plusieurs BARRES (`rows`), et `barres` (Set « r:c ») : la barre
      // de la rangée r−1 au cintre c. Absent = toutes ; la barre du bas est toujours là.
      const buildPortant = (w, d, ht, base, cols, slots, rows, barres) => {
        const g = new THREE.Group(); const acier = new THREE.MeshStandardMaterial({ color: base, metalness: 0.7, roughness: 0.32 });
        const nc = Math.max(1, cols || 6), nr = Math.max(1, rows || 1);
        const esp = nr > 1 ? (ht - 0.08) / nr : 0, barY = (r) => ht - 0.04 - r * esp;
        const longV = nr > 1 ? Math.max(0.3, Math.min(0.62, esp - 0.16)) : 0.62;
        const aBarre = (r, c) => r === nr - 1 || !barres || barres.has((r + 1) + ':' + (c + 1));
        [-1, 1].forEach(sx => {
          const pied = box(0.03, ht, 0.03, acier); pied.position.set(sx * (w / 2 - 0.02), ht / 2, 0); g.add(pied);
          const base2 = box(0.04, 0.03, d * 0.9, acier); base2.position.set(sx * (w / 2 - 0.02), 0.04, 0); g.add(base2);
          [-1, 1].forEach(sz => { const roue = cyl(0.03, 0.03, 0.025, metalMat, 10); roue.rotation.z = Math.PI / 2; roue.position.set(sx * (w / 2 - 0.02), 0.03, sz * d * 0.42); g.add(roue); });
        });
        const pasC = (w - 0.08) / nc;
        for (let r = 0; r < nr; r++) {
          // La barre, morceau par morceau (les cintres qui l'ont, d'affilée).
          let deb = null;
          for (let c = 0; c <= nc; c++) {
            const on = c < nc && aBarre(r, c);
            if (on && deb == null) deb = c;
            if (!on && deb != null) {
              const tout = deb === 0 && c === nc, x0 = tout ? -w / 2 + 0.01 : -w / 2 + 0.04 + deb * pasC, x1 = tout ? w / 2 - 0.01 : -w / 2 + 0.04 + c * pasC;
              const rail = cyl(0.014, 0.014, x1 - x0, acier, 10); rail.rotation.z = Math.PI / 2; rail.position.set((x0 + x1) / 2, barY(r), 0); rail.userData.plateau = true; g.add(rail); deb = null;
            }
          }
        }
        const ghostM = new THREE.MeshStandardMaterial({ color: '#9aa3ad', roughness: 0.9, transparent: true, opacity: 0.22, depthWrite: false });
        const habits = ['#4f6fc9', '#c94f4f', '#4fae8f', '#d4a24b', '#8a5fb0', '#5f7f9b'];
        for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) {
          const by = barY(r);
          const cx = -w / 2 + 0.04 + (c + 0.5) * pasC, key = r + '_' + c, a = ((slots || {})[key] || []).map(v => String(v)).filter(Boolean);
          if (!a.length && !aBarre(r, c)) continue;   // pas de cintre sans barre
          const crochet = cyl(0.004, 0.004, 0.06, metalMat, 5); crochet.position.set(cx, by - 0.03, 0); g.add(crochet);
          const epaules = box(Math.min(0.36, pasC * 0.9), 0.012, 0.012, a.length ? flatMat('#8a6f57', 0.6) : ghostM); epaules.position.set(cx, by - 0.07, 0); epaules.rotation.y = Math.PI / 2; g.add(epaules);
          if (a.length) {
            const vet = box(0.03, longV, Math.min(0.42, d * 0.85), flatMat(habits[c % habits.length], 0.92)); vet.position.set(cx, by - 0.07 - longV / 2 - 0.01, 0); vet.userData = { cell: key, num: a[0], idx: 0 }; g.add(vet);
            // (17 oct.) L'étiquette du cintre FACE à soi : elle pend devant le vêtement, sa face numérotée vers l'avant.
            const tagW = Math.min(0.22, pasC * 0.94); const tag = makeColis(a[0], tagW, tagW * 0.75, 0.008); tag.position.set(cx, by - 0.07 - Math.min(0.16, longV / 2), Math.min(0.21, d * 0.42) + 0.012); tag.userData = { cell: key, num: a[0], idx: 0 }; g.add(tag);
          } else {
            const gh = new THREE.Mesh(new THREE.BoxGeometry(0.03, longV - 0.07, Math.min(0.4, d * 0.8)), ghostM); gh.position.set(cx, by - 0.07 - (longV - 0.07) / 2, 0); gh.userData = { cell: key, ghost: true }; g.add(gh);
          }
        }
        return g;
      };
      // (28 oct.) Une table peut avoir des niveaux SOUS son dessus (`rows` > 1) :
      // des plateaux entre le dessus et le sol, morceau par morceau (`plateaux`).
      const buildTable = (w, d, ht, base, rows, cols, plateaux) => {
        const g = new THREE.Group(); const m = woodMat(base); const top = box(w, 0.08, d, m); top.position.y = ht; g.add(top);
        const nr = Math.max(1, rows || 1), nc = Math.max(1, cols || 1);
        if (nr > 2) {
          const sous = ht / (nr - 1), lg = 0.09, larg = w - 2 * lg;
          for (let R = 2; R < nr; R++) {
            const yy = ht - (R - 1) * sous; let deb = null;
            for (let c = 1; c <= nc + 1; c++) {
              const on = c <= nc && (!plateaux || plateaux.has(R + ':' + c));
              if (on && deb == null) deb = c - 1;
              if (!on && deb != null) { const a = deb / nc, b = (c - 1) / nc; const sh = box(larg * (b - a), 0.03, d - 0.04, m); sh.position.set(-w / 2 + lg + larg * (a + b) / 2, yy, 0); sh.userData.plateau = true; g.add(sh); deb = null; }
            }
          }
        }
        const lg = 0.09; [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => { const l = box(lg, ht, lg, m); l.position.set(sx * (w / 2 - lg), ht / 2, sz * (d / 2 - lg)); g.add(l); });
        return g;
      };
      const buildBoites = (w, d, ht, base) => {
        const g = new THREE.Group(); const n = Math.max(1, Math.min(4, Math.round(ht / 0.5))), bh = ht / n;
        for (let i = 0; i < n; i++) { const off = (i % 2 ? 0.06 : -0.05) * w; const b = box(w * 0.9, bh * 0.9, d * 0.9, flatMat(base, 0.85)); b.position.set(off, (i + 0.5) * bh, off * 0.4); g.add(b); const tape = box(w * 0.9, bh * 0.12, 0.02, flatMat(shade(base, 26), 0.8)); tape.position.set(off, (i + 0.5) * bh, d * 0.45 + off * 0.4); g.add(tape); }
        return g;
      };
      const buildArmoire = (w, d, ht, base) => {
        const g = new THREE.Group(); const m = woodMat(base); const body = box(w, ht, d, m); body.position.y = ht / 2; g.add(body);
        const dm = woodMat(shade(base, -12));
        [-1, 1].forEach(s => { const door = box(w * 0.47, ht * 0.94, 0.05, dm); door.position.set(s * w * 0.24, ht / 2, d / 2 + 0.026); g.add(door); const knob = shadowize(new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), metalMat)); knob.position.set(s * w * 0.04, ht / 2, d / 2 + 0.07); g.add(knob); });
        return g;
      };
      const buildCrate = (w, d, ht, base) => {
        const g = new THREE.Group(); const m = flatMat(base, 0.8), t = 0.06;
        const bottom = box(w, t, d, m); bottom.position.y = t / 2; g.add(bottom);
        const wall = (ww, dd, x, z) => { const p = box(ww, ht, dd, m); p.position.set(x, ht / 2, z); g.add(p); };
        wall(w, t, 0, -d / 2 + t / 2); wall(w, t, 0, d / 2 - t / 2); wall(t, d, -w / 2 + t / 2, 0); wall(t, d, w / 2 - t / 2, 0);
        return g;
      };
      const buildMalle = (w, d, ht, base) => {
        const g = new THREE.Group(); const m = woodMat(base); const bodyH = ht * 0.7; const body = box(w, bodyH, d, m); body.position.y = bodyH / 2; g.add(body);
        const lid = box(w * 1.02, ht * 0.32, d * 1.02, woodMat(shade(base, -10))); lid.position.y = bodyH + ht * 0.14; g.add(lid);
        [-1, 1].forEach(s => { const band = box(0.06, ht * 0.9, d * 1.03, metalMat); band.position.set(s * w * 0.3, ht * 0.45, 0); g.add(band); });
        const lock = box(0.16, 0.14, 0.05, metalMat); lock.position.set(0, bodyH, d / 2 + 0.02); g.add(lock);
        return g;
      };
      // GRILLE = MUR DE BOÎTES EMPILÉES : nc boîtes en largeur × nr en hauteur.
      // Chaque boîte REMPLIT sa case et TOUCHE ses voisines → les colonnes se
      // lisent comme de vraies piles alignées. Une case vide = boîte « fantôme »
      // translucide (on voit où ranger). Aucun cadre : ce sont les boîtes qui
      // font la structure, comme dans la vraie vie.
      const buildGrille = (w, d, ht, base, rows, cols, slots) => {
        const g = new THREE.Group();
        const nr = Math.max(1, rows || 3), nc = Math.max(1, cols || 4);
        const cw = w / nc, chh = ht / nr;
        const dep = Math.max(0.28, Math.min(cw * 1.15, chh * 1.15, 0.5));
        const gap = Math.min(cw, chh) * 0.03;                 // interstice fin pour distinguer les boîtes
        const bw = cw - gap, bh = chh - gap, bd = dep - gap;
        const ghostM = new THREE.MeshStandardMaterial({ color: shade(base, 18), roughness: 0.95, transparent: true, opacity: 0.22, depthWrite: false });
        const nextM = new THREE.MeshStandardMaterial({ color: '#3a9bff', roughness: 0.6, transparent: true, opacity: 0.42, depthWrite: false }); // prochaine place conseillée
        // Prochaine place = on EMPILE : bas → haut dans une colonne (jusqu'au
        // plafond), puis colonne suivante. C'est comme ça qu'on stocke en vrai.
        let firstEmpty = null;
        for (let c = 0; c < nc && firstEmpty == null; c++) for (let r = nr - 1; r >= 0 && firstEmpty == null; r--) { if (!((slots && slots[r + '_' + c]) || []).length) firstEmpty = r + '_' + c; }
        for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) {
          const cx = -w / 2 + (c + 0.5) * cw, cy = ht - (r + 0.5) * chh; // r=0 en haut, boîtes qui se touchent
          const key = r + '_' + c, arr = (slots && slots[key]) || [];
          let cellMesh;
          if (arr.length) { cellMesh = makeColis(arr[0], bw, bh, bd); }
          else { cellMesh = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), key === firstEmpty ? nextM : ghostM); cellMesh.receiveShadow = true; } // emplacement vide (bleu = prochaine place)
          cellMesh.position.set(cx, cy, 0);
          cellMesh.userData = arr.length ? { cell: key, num: String(arr[0]) } : { cell: key }; // pour remplir la case au clic
          g.add(cellMesh);
        }
        return g;
      };
      const buildPorte = (w, d, ht, base) => {
        const g = new THREE.Group(); const frameM = woodMat(shade(base, -12)), leafM = woodMat(base), t = 0.08, dd = Math.max(0.12, d);
        [-w / 2 + t / 2, w / 2 - t / 2].forEach(px => { const p = box(t, ht, dd, frameM); p.position.set(px, ht / 2, 0); g.add(p); });
        const lintel = box(w, t, dd, frameM); lintel.position.set(0, ht - t / 2, 0); g.add(lintel);
        const leaf = box(w - 2 * t, ht - t, dd * 0.45, leafM); leaf.position.set(0, (ht - t) / 2, 0); g.add(leaf);
        // 2 panneaux moulurés + poignée
        [[-1, 0.72], [1, 0.72], [-1, 0.28], [1, 0.28]].forEach(([sx, fy]) => { const pn = box((w - 2 * t) * 0.36, (ht - t) * 0.32, 0.02, woodMat(shade(base, -6))); pn.position.set(sx * (w - 2 * t) * 0.21, (ht - t) * fy, dd * 0.24); g.add(pn); });
        const knob = shadowize(new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), metalMat)); knob.position.set(w / 2 - t - 0.11, ht * 0.48, dd * 0.26); g.add(knob);
        return g;
      };
      const buildFenetre = (w, d, ht, base) => {
        const g = new THREE.Group(); const frameM = flatMat(shade(base, -22), 0.55), t = 0.08, dd = Math.max(0.1, d);
        const y0 = ht * 0.75, y1 = y0 + ht, cy = (y0 + y1) / 2; // rebord en hauteur
        [-w / 2 + t / 2, w / 2 - t / 2].forEach(px => { const p = box(t, ht, dd, frameM); p.position.set(px, cy, 0); g.add(p); });
        const topB = box(w, t, dd, frameM); topB.position.set(0, y1 - t / 2, 0); g.add(topB);
        const botB = box(w, t, dd, frameM); botB.position.set(0, y0 + t / 2, 0); g.add(botB);
        const sill = box(w * 1.08, t * 0.9, dd * 1.7, frameM); sill.position.set(0, y0, dd * 0.2); g.add(sill); // appui
        const midV = box(t * 0.6, ht, dd * 0.8, frameM); midV.position.set(0, cy, 0); g.add(midV);
        const midH = box(w, t * 0.6, dd * 0.8, frameM); midH.position.set(0, cy, 0); g.add(midH);
        const glass = new THREE.Mesh(new THREE.BoxGeometry(w - t * 1.2, ht - t * 1.2, dd * 0.3), new THREE.MeshStandardMaterial({ color: '#bcd6ea', transparent: true, opacity: 0.42, roughness: 0.08, metalness: 0.15 }));
        glass.position.set(0, cy, 0); g.add(glass);
        return g;
      };
      // BOÎTE seule à empiler : un carton avec son N°, posé sur le sol ou sur la
      // boîte du dessous (le niveau `lvl` est géré par le placement).
      const buildCarton = (w, d, ht, base, num) => { const g = new THREE.Group(); const b = makeColis(num != null && num !== '' ? num : '?', w, ht, d); b.position.y = ht / 2; g.add(b); return g; };
      // PILE DE BOÎTES : on rend la LISTE de numéros `nums` (dans l'ordre), remplie
      // colonne par colonne, de bas en haut, `rows` boîtes par colonne. Retirer une
      // boîte = retirer un élément de la liste → tout ce qui est au-dessus DESCEND.
      // Chaque boîte porte son index (userData.pileIdx) pour la retirer au toucher.
      // HAUTEUR MAX (28 oct., sa demande « montre la hauteur max de chaque pile
      // en 3D ») : chaque pile porte un cadre fin jusqu'à SA hauteur
      // (`hauteurPile`, la règle du réglage — §11) et un couvercle pâle au
      // sommet. Décor seul : jamais touché (raycast vide), aucune couleur
      // d'accent (§7). userData.hauteurMax = la hauteur dessinée (sonde du banc).
      const cadrePileMat = new THREE.LineBasicMaterial({ color: '#2f3742', transparent: true, opacity: 0.8 });
      const capotPileMat = new THREE.MeshBasicMaterial({ color: '#2f3742', transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });
      const aretesCadre = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
      const plaqueMaxCache = new Map();
      const plaqueMaxPile = (h) => {
        let mat = plaqueMaxCache.get(h);
        if (!mat) {
          const c = document.createElement('canvas'); c.width = 128; c.height = 64; const x = c.getContext('2d');
          x.fillStyle = '#1f252d'; rrect(x, 4, 8, 120, 48, 14); x.fill();
          x.fillStyle = '#fff'; x.font = 'bold 30px system-ui,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
          x.fillText('max ' + h, 64, 33);
          mat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false, sizeAttenuation: false, toneMapped: false });
          mat.map.colorSpace = THREE.SRGBColorSpace;
          plaqueMaxCache.set(h, mat);
        }
        const sp = new THREE.Sprite(mat); sp.raycast = () => {}; sp.renderOrder = 9; return sp;
      };
      const buildPile = (nums, rows, cell, hauteurs) => {
        const g = new THREE.Group(); const gap = cell * 0.04, s = cell - gap;
        const cols = Math.max(1, Math.ceil(nums.length / rows));
        for (let c = 0; c < cols; c++) {
          const h = hauteurPile(rows, hauteurs, c), x = -((cols - 1) / 2) * cell + c * cell;
          const cadre = new THREE.LineSegments(aretesCadre, cadrePileMat);
          cadre.scale.set(s, h * cell, s); cadre.position.set(x, (h * cell) / 2, 0);
          cadre.raycast = () => {}; cadre.userData = { hauteurMax: h, pileCol: c }; g.add(cadre);
          const capot = new THREE.Mesh(new THREE.PlaneGeometry(s, s), capotPileMat);
          capot.rotation.x = -Math.PI / 2; capot.position.set(x, h * cell + 0.004, 0);
          capot.raycast = () => {}; capot.userData = { capotPile: c }; g.add(capot);
          // Le NOMBRE max au-dessus (28 oct., « affiche le nombre max au-dessus de
          // chaque pile ») : petite plaque neutre, décor seul, jamais touchée.
          const nb = plaqueMaxPile(h); nb.scale.set(0.11, 0.055, 1); // taille FIXE à l'écran (sizeAttenuation coupé) : lisible de loin comme de près
          nb.position.set(x, h * cell + cell * 0.3, 0); nb.userData = { maxPile: c, texte: 'max ' + h }; g.add(nb);
        }
        for (let i = 0; i < nums.length; i++) {
          const cc = Math.floor(i / rows), rr = i % rows; // cc = colonne, rr = niveau (0=bas)
          if (!String(nums[i] == null ? '' : nums[i]).trim()) continue;   // place vide en haut d'une colonne
          const bx = makeColis(String(nums[i]), s, s, s);
          bx.position.set(-((cols - 1) / 2) * cell + cc * cell, rr * cell + s / 2, 0);
          bx.userData = { pileIdx: i, num: String(nums[i]) };
          g.add(bx);
        }
        return g;
      };
      const buildGeneric = (w, d, ht, base) => { const g = new THREE.Group(); const b = box(w, ht, d, woodMat(base)); b.position.y = ht / 2; g.add(b); return g; };
      // ── OBJETS DE DÉCOR ────────────────────────────────────────────────────
      // Assemblés à partir des mêmes primitives (box / cylindre) et des mêmes
      // matières que les meubles : une pièce meublée doit avoir l'air d'un tout,
      // pas d'un décor collé par-dessus. Chacun projette son ombre (`shadowize`).
      const cyl = (r1, r2, h, mat, seg) => shadowize(new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg || 14), mat));
      const pied = (m, x, z, h, r) => { const c = cyl(r || 0.035, r || 0.035, h, m); c.position.set(x, h / 2, z); return c; };
      const buildChaise = (w, d, ht, base) => {
        const g = new THREE.Group(); const m = woodMat(base); const assise = ht * 0.48;
        [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz]) => g.add(pied(m, sx*(w/2-0.06), sz*(d/2-0.06), assise)));
        const s = box(w, 0.06, d, m); s.position.y = assise; g.add(s);
        const dos = box(w, ht - assise, 0.06, m); dos.position.set(0, assise + (ht - assise) / 2, -d / 2 + 0.03); g.add(dos);
        return g;
      };
      const buildBureau = (w, d, ht, base) => {
        const g = new THREE.Group(); const m = woodMat(base);
        const top = box(w, 0.06, d, m); top.position.y = ht; g.add(top);
        [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz]) => g.add(pied(m, sx*(w/2-0.07), sz*(d/2-0.07), ht, 0.045)));
        const cais = box(w * 0.3, ht * 0.62, d * 0.8, woodMat(shade(base, -10)));
        cais.position.set(w / 2 - w * 0.18, ht * 0.31, 0); g.add(cais);
        return g;
      };
      const buildCanape = (w, d, ht, base) => {
        const g = new THREE.Group(); const m = woodMat(base), assise = ht * 0.45;
        const b = box(w, assise, d, m); b.position.y = assise / 2; g.add(b);
        const coussin = box(w - 0.16, 0.14, d - 0.16, woodMat(shade(base, 12))); coussin.position.y = assise + 0.07; g.add(coussin);
        const dos = box(w, ht - assise, 0.18, m); dos.position.set(0, assise + (ht - assise) / 2, -d / 2 + 0.09); g.add(dos);
        [-1, 1].forEach(sx => { const a = box(0.18, ht * 0.72, d, m); a.position.set(sx * (w / 2 - 0.09), ht * 0.36, 0); g.add(a); });
        return g;
      };
      const buildLit = (w, d, ht, base) => {
        const g = new THREE.Group(); const m = woodMat(base);
        const cadre = box(w, ht * 0.5, d, m); cadre.position.y = ht * 0.25; g.add(cadre);
        const mat2 = box(w - 0.1, ht * 0.42, d - 0.1, woodMat('#e8e6e1')); mat2.position.y = ht * 0.5 + ht * 0.21; g.add(mat2);
        const or = box(w * 0.42, 0.12, d * 0.26, woodMat('#f2f0ec'));
        or.position.set(-w * 0.22, ht * 0.5 + ht * 0.42 + 0.06, -d / 2 + d * 0.2); g.add(or);
        const tete = box(w, ht * 0.9, 0.08, m); tete.position.set(0, ht * 0.45, -d / 2 + 0.04); g.add(tete);
        return g;
      };
      const buildTapis = (w, d, ht, base) => {
        const g = new THREE.Group(); const t = box(w, 0.02, d, woodMat(base)); t.position.y = 0.011; g.add(t);
        const b = box(w * 0.88, 0.024, d * 0.82, woodMat(shade(base, 16))); b.position.y = 0.014; g.add(b);
        return g;
      };
      const buildPlante = (w, d, ht, base) => {
        const g = new THREE.Group(); const pot = cyl(w * 0.28, w * 0.22, ht * 0.26, woodMat('#b5714f'));
        pot.position.y = ht * 0.13; g.add(pot);
        const tronc = cyl(0.03, 0.04, ht * 0.4, woodMat('#6b5136'), 8); tronc.position.y = ht * 0.26 + ht * 0.2; g.add(tronc);
        const vert = woodMat(base);
        [[0, 0, ht * 0.78, 0.32], [0.16, 0.08, ht * 0.66, 0.24], [-0.14, -0.1, ht * 0.7, 0.22]].forEach(([x, z, y, r]) => {
          const f = shadowize(new THREE.Mesh(new THREE.SphereGeometry(w * r, 10, 8), vert));
          f.position.set(x, y, z); f.scale.y = 0.8; g.add(f);
        });
        return g;
      };
      const buildLampe = (w, d, ht, base) => {
        const g = new THREE.Group();
        const socle = cyl(w * 0.3, w * 0.32, 0.04, metalMat); socle.position.y = 0.02; g.add(socle);
        const mat_ = cyl(0.022, 0.022, ht * 0.82, metalMat, 10); mat_.position.y = ht * 0.45; g.add(mat_);
        const abat = cyl(w * 0.34, w * 0.24, ht * 0.2, woodMat(base), 16); abat.position.y = ht * 0.9; g.add(abat);
        return g;
      };
      const buildMiroir = (w, d, ht, base) => {
        const g = new THREE.Group(); const cadre = box(w, ht, 0.05, woodMat('#6b5136'));
        cadre.position.y = ht / 2; g.add(cadre);
        const glace = box(w - 0.1, ht - 0.1, 0.02, new THREE.MeshStandardMaterial({ color: base, metalness: 0.85, roughness: 0.12 }));
        glace.position.set(0, ht / 2, 0.03); g.add(glace);
        return g;
      };
      const buildCadre = (w, d, ht, base) => {
        const g = new THREE.Group(); const c = box(w, ht, 0.04, woodMat(base)); c.position.y = ht / 2 + 0.9; g.add(c);
        const toile = box(w - 0.08, ht - 0.08, 0.02, woodMat('#e9e2d3')); toile.position.set(0, ht / 2 + 0.9, 0.025); g.add(toile);
        return g;
      };
      const buildPoubelle = (w, d, ht, base) => {
        const g = new THREE.Group(); const c = cyl(w * 0.3, w * 0.24, ht * 0.9, woodMat(base), 16);
        c.position.y = ht * 0.45; g.add(c);
        const cv = cyl(w * 0.32, w * 0.32, 0.04, woodMat(shade(base, -12)), 16); cv.position.y = ht * 0.92; g.add(cv);
        return g;
      };
      const buildEscabeau = (w, d, ht, base) => {
        const g = new THREE.Group(); const m = metalMat;
        [-1, 1].forEach(sx => { const p = box(0.05, ht, 0.05, m); p.position.set(sx * (w / 2 - 0.05), ht / 2, -d / 4); p.rotation.x = 0.12; g.add(p); });
        for (let i = 1; i <= 3; i++) { const marche = box(w - 0.12, 0.04, d * 0.42, m); marche.position.set(0, (i / 3.4) * ht, -d / 4 + i * 0.02); g.add(marche); }
        return g;
      };
      const buildRadiateur = (w, d, ht, base) => {
        const g = new THREE.Group(); const m = woodMat(base); const n = Math.max(4, Math.round(w / 0.11));
        for (let i = 0; i < n; i++) { const a = box(w / n * 0.7, ht * 0.86, d, m); a.position.set(-w / 2 + (i + 0.5) * (w / n), ht * 0.5, 0); g.add(a); }
        const bas = box(w, 0.05, d, metalMat); bas.position.y = ht * 0.06; g.add(bas);
        return g;
      };
      const buildVelo = (w, d, ht, base) => {
        const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: base, metalness: 0.6, roughness: 0.35 });
        const pneu = new THREE.MeshStandardMaterial({ color: '#22262b', roughness: 0.9 });
        [-1, 1].forEach(sx => { const r = shadowize(new THREE.Mesh(new THREE.TorusGeometry(ht * 0.33, 0.035, 8, 22), pneu));
          r.position.set(sx * (w / 2 - ht * 0.34), ht * 0.33, 0); g.add(r); });
        const cadre = box(w * 0.6, 0.05, 0.05, m); cadre.position.set(0, ht * 0.5, 0); g.add(cadre);
        const selle = box(0.22, 0.06, 0.1, pneu); selle.position.set(-w * 0.1, ht * 0.72, 0); g.add(selle);
        const guidon = box(0.06, 0.05, 0.42, m); guidon.position.set(w * 0.26, ht * 0.72, 0); g.add(guidon);
        const fourche = box(0.05, ht * 0.42, 0.05, m); fourche.position.set(w * 0.26, ht * 0.5, 0); g.add(fourche);
        return g;
      };
      const buildEtabli = (w, d, ht, base) => {
        const g = new THREE.Group(); const m = woodMat(base);
        const top = box(w, 0.08, d, woodMat(shade(base, -6))); top.position.y = ht; g.add(top);
        [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz]) => g.add(pied(metalMat, sx*(w/2-0.08), sz*(d/2-0.08), ht, 0.05)));
        const etag = box(w - 0.16, 0.05, d - 0.16, m); etag.position.y = ht * 0.28; g.add(etag);
        const fond = box(w, ht * 0.5, 0.05, m); fond.position.set(0, ht + ht * 0.25, -d / 2 + 0.03); g.add(fond);
        return g;
      };
      const furnGroup = new THREE.Group(); scene.add(furnGroup);
      const disposeMat = (mat) => { if (!mat) return; (Array.isArray(mat) ? mat : [mat]).forEach(mm => { if (mm && mm.map) mm.map.dispose(); if (mm && mm.dispose) mm.dispose(); }); };
      // ── LA GRAVITÉ, VUE (17 oct.) ──────────────────────────────────────────
      // « Si on enlève celui du dessous, celui du dessus descend naturellement. »
      // Avant de reconstruire, on note la hauteur de chaque boîte numérotée ;
      // après, toute boîte du MÊME meuble et du MÊME numéro qui se retrouve plus
      // bas TOMBE jusqu'à sa nouvelle place, au lieu d'y sauter.
      let chuteRAF = 0;
      const notePositions = () => {
        const m = new Map();
        furnGroup.children.forEach(gr => gr.traverse(o => { const u = o.userData || {}; if (o.isMesh && u.num != null && !u.ghost) m.set(`${gr.userData.itemId}|${u.num}`, { y: o.position.y, gx: gr.position.x, gy: gr.position.y, gz: gr.position.z }); }));
        return m;
      };
      const fairTomber = (avant) => {
        if (reduitChute || !avant || !avant.size) return;
        const chutes = [];
        furnGroup.children.forEach(gr => gr.traverse(o => {
          const u = o.userData || {}; if (!o.isMesh || u.num == null || u.ghost) return;
          const p = avant.get(`${gr.userData.itemId}|${u.num}`);
          if (!p || Math.abs(p.gx - gr.position.x) > 1e-3 || Math.abs(p.gz - gr.position.z) > 1e-3 || Math.abs(p.gy - gr.position.y) > 1e-3) return;
          if (p.y - o.position.y > 0.02) chutes.push({ o, de: p.y, a: o.position.y });
        }));
        if (!chutes.length) return;
        try { el.parentElement && (el.parentElement.dataset.chute = String(chutes.length)); } catch (_) {}
        chutes.forEach(c => { c.o.position.y = c.de; });
        const t0 = performance.now(), dur = 240;
        if (chuteRAF) cancelAnimationFrame(chuteRAF);
        const pas = () => {
          const k = Math.min(1, (performance.now() - t0) / dur);
          // (17 oct.) une chute COURTE qui se pose : accélérée, sans rebond
          // (« rien qui saute »).
          const e = k * k;
          chutes.forEach(c => { c.o.position.y = c.de + (c.a - c.de) * e; });
          if (k < 1) chuteRAF = requestAnimationFrame(pas); else { chuteRAF = 0; chutes.forEach(c => { c.o.position.y = c.a; }); }
        };
        chuteRAF = requestAnimationFrame(pas);
      };
      const reduitChute = (() => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } })();
      const buildFurniture = () => {
        const avant = notePositions();
        colisCache.clear(); plaqueMaxCache.clear(); // textures des cartons régénérées à chaque reconstruction
        while (furnGroup.children.length) { const o = furnGroup.children.pop(); o.traverse && o.traverse(m => { if (m.geometry) m.geometry.dispose(); disposeMat(m.material); }); }
        (dataRef.current.items || []).forEach(it => {
          const shape = (FURN_TYPES[it.type] || {}).build || 'generic';
          // Pour la GRILLE, les dimensions viennent de la taille de case + du nombre
          // de cases (rows×cols) → chaque case fait exactement `cell` de côté.
          const isGrid = shape === 'grille', isBox = !!(FURN_TYPES[it.type] || {}).box, isPile = shape === 'pile';
          const cellSize = it.cell || 0.5, nc = Math.max(1, it.cols || 4), nr = Math.max(1, it.rows || 3);
          // Pile : liste de numéros (nums) → colonnes déduites du nombre de boîtes.
          let pileNumsArr = null, pileCols = nc;
          if (isPile) {
            pileNumsArr = (Array.isArray(it.nums) && it.nums.length) ? it.nums : Array.from({ length: nc * nr }, (_, i) => String((parseInt(it.start, 10) || 1) + i));
            pileCols = Math.max(1, Math.ceil(pileNumsArr.length / nr));
          }
          const ht = (isGrid || isPile) ? nr * cellSize : Math.max(0.35, h3dOf(it) * HSCALE);
          const w = isGrid ? nc * cellSize : isPile ? pileCols * cellSize : it.w * 0.92;
          const d = (isGrid || isPile) ? Math.max(0.16, Math.min(it.h, cellSize)) : it.h * 0.92;
          const base = colorOf(it);
          let g;
          switch (shape) {
            case 'commode': g = buildCommode(w, d, ht, base, it.rows); break;
            case 'etagere': g = buildEtagere(w, d, ht, base, it.rows); break;
            case 'metal': g = buildMetal(w, d, ht, base, nr, !!(FURN_TYPES[it.type] || {}).bois, nc, Array.isArray(it.planches) ? plateauxMeuble(it, FURN_TYPES[it.type] || {}) : null); break;
            case 'portant': g = buildPortant(w, d, ht, base, nc, it.slots, nr, Array.isArray(it.planches) ? plateauxMeuble(it, FURN_TYPES[it.type] || {}) : null); break;
            case 'armoire': g = buildArmoire(w, d, ht, base); break;
            case 'penderie': g = buildPenderie(w, d, ht, base); break;
            case 'table': g = buildTable(w, d, ht, base, nr, nc, Array.isArray(it.planches) ? plateauxMeuble(it, FURN_TYPES[it.type] || {}) : null); break;
            case 'boites': g = buildBoites(w, d, ht, base); break;
            case 'crate': g = buildCrate(w, d, ht, base); break;
            case 'malle': g = buildMalle(w, d, ht, base); break;
            case 'grille': g = buildGrille(w, d, ht, base, nr, nc, it.slots); break;
            case 'porte': g = buildPorte(w, d, ht, base); break;
            case 'fenetre': g = buildFenetre(w, d, ht, base); break;
            case 'carton': g = buildCarton(w, d, ht, base, it.num); break;
            case 'chaise': g = buildChaise(w, d, ht, base); break;
            case 'bureau': g = buildBureau(w, d, ht, base); break;
            case 'canape': g = buildCanape(w, d, ht, base); break;
            case 'lit': g = buildLit(w, d, ht, base); break;
            case 'tapis': g = buildTapis(w, d, ht, base); break;
            case 'plante': g = buildPlante(w, d, ht, base); break;
            case 'lampe': g = buildLampe(w, d, ht, base); break;
            case 'miroir': g = buildMiroir(w, d, ht, base); break;
            case 'cadre': g = buildCadre(w, d, ht, base); break;
            case 'poubelle': g = buildPoubelle(w, d, ht, base); break;
            case 'escabeau': g = buildEscabeau(w, d, ht, base); break;
            case 'radiateur': g = buildRadiateur(w, d, ht, base); break;
            case 'velo': g = buildVelo(w, d, ht, base); break;
            case 'etabli': g = buildEtabli(w, d, ht, base); break;
            case 'pile': g = buildPile(pileNumsArr, nr, cellSize, it.hauteurs); break;
            default: g = buildGeneric(w, d, ht, base);
          }
          // Une boîte à empiler se pose à la hauteur de son niveau (lvl) : posée
          // sur le sol (lvl 0) ou sur les boîtes en dessous. Un léger interstice
          // (ht*0.02) évite le z-fighting entre boîtes empilées.
          // `lift` = posé en hauteur (sur une table, une commode…). Une boîte a en
          // plus son niveau d'empilage.
          const baseY = (it.lift || 0) + (isBox ? (it.lvl || 0) * ht * 1.02 : 0);
          g.position.set((it.x + it.w / 2) - room.w / 2, baseY, (it.y + it.h / 2) - room.h / 2);
          g.rotation.y = it.rot || 0; // orientation (collé au mur)
          g.userData = { itemId: it.id, w: it.w, h: it.h, type: it.type };
          // ⚠️ LE DÉCOR NE PORTE PAS D'ÉTIQUETTE. Vu au rendu : huit pastilles
          // sombres flottaient au-dessus de la pièce et masquaient précisément
          // ce qu'on vient regarder. Une chaise se reconnaît sans qu'on écrive
          // « Chaise » dessus ; un RANGEMENT, lui, garde son nom et son compte —
          // c'est l'information utile (où sont les paires).
          const estDeco = !!(FURN_TYPES[it.type] || {}).deco;
          if (!isBox && !estDeco) { // les boîtes portent déjà leur N° imprimé → pas d'étiquette flottante
            // ⚠️ UN MEUBLE SANS NOM AFFICHAIT « undefined » EN 3D, sur son
            // étiquette. Les meubles créés dans l'app en ont toujours un, mais
            // un plan importé ou restauré peut ne pas en avoir : on retombe
            // alors sur le libellé de son type, jamais sur le mot « undefined ».
            const nom = String(it.name || (FURN_TYPES[it.type] || {}).label || 'Meuble');
            const cnt = storedCount(it); const lab = makeLabel(emojiOf(it) + ' ' + nom + (cnt ? ` (${cnt})` : ''));
            lab.position.set(0, ht + 0.55, 0); lab.userData.itemId = it.id; lab.userData.cnt = cnt; g.add(lab);
            // La PUCE : le seul nombre de paires, qui prend la place de l'étiquette
            // quand celle-ci ne tient pas (grande pièce vue de loin) — on voit encore
            // quels meubles portent des paires sans rien lire par-dessus.
            if (cnt) { const pu = makeLabel(String(cnt), 52); pu.position.set(0, ht + 0.55, 0); pu.userData.itemId = it.id; pu.userData.cnt = cnt; pu.userData.puce = true; pu.visible = false; g.add(pu); }
          }
          // La grille peint elle-même ses cartons. Les AUTRES meubles de rangement
          // (commode, étagère, casiers, armoire) deviennent eux aussi une grille de
          // boîtes NUMÉROTÉES : chaque case pleine = un carton (N° imprimé en gros,
          // TAPPABLE pour modifier le numéro), chaque case vide = boîte fantôme
          // translucide TAPPABLE (pour y déposer un N°) — comme la grille. → on voit
          // la superposition des numéros et on édite au doigt sur TOUT rangement.
          const physique = (FURN_TYPES[it.type] || {}).cases;
          if (physique === 'pile') {
            // (17 oct.) PLATEAU : chaque case porte une PILE de boîtes (index 0 en
            // bas). Retirer celle du dessous fait descendre les autres — la
            // reconstruction les replace, l'animation de chute les fait tomber.
            // Au-dessus de chaque pile qui a encore de la place : une boîte en
            // transparence, qu'on touche pour ranger. Une TABLE porte ses piles
            // SUR son plateau, pas dessous.
            const estTable = shape === 'table';
            const cols = Math.max(1, it.cols || 1), rows = Math.max(1, it.rows || 1);
            const cellW = w / cols, cellH = estTable ? Math.max(0.6, (room.wallH || 3.4) * 0.7 - ht) : ht / rows;
            const sousH = estTable && rows > 1 ? ht / (rows - 1) : 0;   // la hauteur d'un niveau sous la table
            const bw = Math.min(cellW * 0.84, 0.52), bd = Math.min(d * 0.72, 0.44), bh = 0.145, pas = bh + 0.008;
            const enBacs = !!(FURN_TYPES[it.type] || {}).bacs;
            const cap = enBacs ? 1 : Math.max(1, Math.floor((cellH - 0.04) / pas));
            const capR = (r) => (estTable && r >= 1 ? Math.max(1, Math.floor((sousH - 0.06) / pas)) : cap);
            const ghostM = new THREE.MeshStandardMaterial({ color: shade(base, 26), roughness: 0.95, transparent: true, opacity: 0.18, depthWrite: false });
            if (enBacs) {
              // (17 oct.) ÉTAGÈRE À BACS : chaque case tient UN bac ouvert, son
              // numéro sur une étiquette en façade — pour ce qui ne tient pas dans
              // une boîte à chaussures (bijoux, accessoires, petits objets).
              const bacW = Math.max(0.12, cellW * 0.86), bacH = Math.max(0.1, Math.min(0.32, cellH - 0.07)), bacD = Math.min(d * 0.8, 0.4);
              for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
                const key = r + '_' + c; const num = ((it.slots || {})[key] || []).map(v => String(v)).filter(Boolean)[0];
                const cx = -w / 2 + (c + 0.5) * cellW, cbY = Math.max(0, ht - (r + 1) * cellH) + 0.025, z = d / 2 - bacD / 2 - 0.015;
                if (num) {
                  const bac = new THREE.Group(); bac.userData = { cell: key, num, idx: 0 };
                  const plast = flatMat(shade(base, -18), 0.55); const ep = 0.012;
                  [[bacW, ep, bacD, 0, ep / 2, 0], [bacW, bacH, ep, 0, bacH / 2, -bacD / 2 + ep / 2], [ep, bacH, bacD, -bacW / 2 + ep / 2, bacH / 2, 0], [ep, bacH, bacD, bacW / 2 - ep / 2, bacH / 2, 0], [bacW, bacH * 0.72, ep, 0, bacH * 0.36, bacD / 2 - ep / 2]].forEach(([a, b, cc, x0, y0, z0]) => { const pan = box(a, b, cc, plast); pan.position.set(x0, y0, z0); pan.userData = { cell: key, num, idx: 0 }; bac.add(pan); });
                  const tag = makeColis(num, Math.min(bacW * 0.7, 0.2), Math.min(bacH * 0.5, 0.11), 0.006); tag.position.set(0, bacH * 0.36, bacD / 2 + 0.002); tag.userData = { cell: key, num, idx: 0 }; bac.add(tag);
                  bac.position.set(cx, cbY, z); g.add(bac);
                } else {
                  // Pas de bac fantôme au-dessus d'un plateau qui MANQUE si la case du dessous est vide : il y tomberait.
                  const plx = Array.isArray(it.planches) ? plateauxMeuble(it, FURN_TYPES[it.type] || {}) : null;
                  if (plx && r < rows - 1 && !plx.has((r + 1) + ':' + (c + 1)) && !((it.slots || {})[(r + 1) + '_' + c] || []).filter(Boolean).length) continue;
                  const gh = new THREE.Mesh(new THREE.BoxGeometry(bacW, bacH, bacD), ghostM); gh.userData = { cell: key, ghost: true }; gh.position.set(cx, cbY + bacH / 2, z); g.add(gh); }
              }
            } else
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
              const key = r + '_' + c; const arr = ((it.slots || {})[key] || []).map(v => String(v)).filter(Boolean);
              const cx = -w / 2 + (c + 0.5) * cellW;
              const cbY = estTable ? (r === 0 ? ht + 0.04 : Math.max(0, ht - r * sousH) + (r === rows - 1 ? 0.005 : 0.02)) : Math.max(0, ht - (r + 1) * cellH) + 0.025;   // dessus du plateau
              const z = estTable ? 0 : d / 2 - bd / 2 - 0.015;
              const cap = capR(r);
              arr.slice(0, cap).forEach((num, i) => { const m = makeColis(num, bw, bh, bd); m.userData = { cell: key, num, idx: i }; m.position.set(cx, cbY + bh / 2 + i * pas, z); g.add(m); });
              // Pas de place libre fantôme au-dessus d'un plateau qui MANQUE tant que
              // la case du dessous a de la place : une boîte posée là tomberait.
              const plx = Array.isArray(it.planches) ? plateauxMeuble(it, FURN_TYPES[it.type] || {}) : null;
              const tombe = plx && r < rows - 1 && !plx.has((r + 1) + ':' + (c + 1)) && ((it.slots || {})[(r + 1) + '_' + c] || []).filter(Boolean).length < capR(r + 1);
              if (arr.length < cap && !tombe) { const gh = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), ghostM); gh.userData = { cell: key, ghost: true }; gh.position.set(cx, cbY + bh / 2 + arr.length * pas, z); g.add(gh); }
            }
          } else if (physique === 'cintre') {
            // le portant dessine lui-même ses cintres
          } else if (!isGrid && !isBox) {
            const cols = Math.max(1, it.cols || 1), rows = Math.max(1, it.rows || 1);
            const cellW = w / cols, cellH = ht / rows;
            const bw = Math.min(cellW * 0.84, 0.52), bd = Math.min(d * 0.72, 0.44), bh = 0.145; // format boîte à chaussures
            const canAdd = ['commode','etagere','casier','armoire'].includes(it.type); // rangements à cases → cases vides tappables
            const ghostM = canAdd ? new THREE.MeshStandardMaterial({ color: shade(base, 22), roughness: 0.95, transparent: true, opacity: 0.15, depthWrite: false }) : null;
            let total = 0;
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
              const key = r + '_' + c; const arr = (it.slots || {})[key] || [];
              const cx = -w / 2 + (c + 0.5) * cellW, cbY = Math.max(0, ht - (r + 1) * cellH); // bas de la case
              if (arr.length) {
                arr.forEach((num, i) => { if (total++ > 260) return; const m = makeColis(num, bw, bh, bd); m.userData = { cell: key, num: String(num) }; m.position.set(cx, cbY + bh / 2 + i * (bh + 0.008), d / 2 - bd / 2 - 0.015); g.add(m); });
              } else if (ghostM) {
                const gh = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), ghostM); gh.userData = { cell: key }; gh.position.set(cx, cbY + bh / 2, d / 2 - bd / 2 - 0.015); g.add(gh);
              }
            }
          }
          furnGroup.add(g);
        });
        fairTomber(avant);
      };
      buildFurniture();
      const controls = new OrbitControls(camera, renderer.domElement);
      // ── LA SOURIS, RÉGLÉE (4 octobre) ─────────────────────────────────────
      // Julien : « améliore le stock en 3D pour que ce soit facile à la souris,
      // mets-toi à la place de l'utilisateur ». Mesuré : quatre réglages posés,
      // tout le reste aux défauts de la bibliothèque. Sur SA pièce (17 × 10 m),
      // un carton faisait ~11 px au départ, la molette avançait de 5 % par cran
      // (≈ 50 crans pour s'approcher d'un meuble) et zoomait vers le CENTRE de
      // la pièce — le meuble visé sortait de l'écran ; la vue traînait 9 images
      // derrière la main ; traverser la vue faisait plus de deux tours.
      const pref = (q) => { try { return window.matchMedia(q).matches; } catch (_) { return false; } };
      const reduit = pref('(prefers-reduced-motion: reduce)');
      const sourisFine = pref('(pointer: fine)');
      controls.target.copy(cadre0.tgt);
      controls.enableDamping = !reduit; controls.dampingFactor = 0.2;   // 4 images de retard au lieu de 9
      controls.rotateSpeed = sourisFine ? 0.6 : 1;                       // ≈ 0,47°/px à la souris
      controls.zoomToCursor = true; controls.zoomSpeed = 3;              // ≈ 14 % par cran, VERS le point visé
      controls.screenSpacePanning = false;                                // clic droit : on glisse au sol
      // ⚠️ La distance de cadrage doit tenir SOUS le plafond de zoom, sinon
      // OrbitControls ramène la caméra plus près à la première mise à jour et
      // la pièce ressort coupée — le calcul serait annulé en silence. Mais pas
      // 2,6 × la pièce (44 m chez lui) : au-delà de la vue d'ensemble, on ne
      // voit plus rien d'utile.
      controls.maxPolarAngle = Math.PI / 2 - 0.04; controls.minDistance = 1.2;
      controls.maxDistance = Math.max(cadre0.d * 1.35, 4); controls.update();
      // La cible reste DANS la pièce (un déplacement au clic droit ou un zoom vers
      // le curseur pouvaient l'emmener sous le sol, où le plancher disparaît). On
      // décale la caméra d'autant : la vue glisse, elle ne saute pas.
      const borne = () => {
        const t = controls.target, wh = room.wallH || 3.4;
        const nx = Math.max(-room.w / 2, Math.min(room.w / 2, t.x)), ny = Math.max(0, Math.min(wh * 0.9, t.y)), nz = Math.max(-room.h / 2, Math.min(room.h / 2, t.z));
        const dx = nx - t.x, dy = ny - t.y, dz = nz - t.z;
        if (dx || dy || dz) { t.set(nx, ny, nz); camera.position.x += dx; camera.position.y += dy; camera.position.z += dz; }
        if (camera.position.y < 0.15) camera.position.y = 0.15;
        // Sonde du banc (lecture seule) : où est la caméra.
        try {
          const box = el.parentElement;
          if (box) { box.dataset.camDist = camera.position.distanceTo(t).toFixed(3); box.dataset.camAz = (Math.atan2(camera.position.x - t.x, camera.position.z - t.z) * 180 / Math.PI).toFixed(1); }
        } catch (_) {}
      };
      controls.addEventListener('change', borne); borne();
      // Position de départ mémorisée → bouton « Recentrer » qui remet la vue par défaut.
      let homePos = camera.position.clone(), homeTgt = controls.target.clone();
      // Rotation/zoom de la caméra pilotés par les BOUTONS de l'overlay (fiable
      // sur mobile, indépendant du geste tactile). rotateView = tourner autour de
      // la pièce (gauche/droite) ; zoomView = avancer/reculer.
      const rotateView = (deg) => {
        const a = deg * Math.PI / 180, ox = camera.position.x - controls.target.x, oz = camera.position.z - controls.target.z;
        const cos = Math.cos(a), sin = Math.sin(a);
        camera.position.x = controls.target.x + ox * cos - oz * sin;
        camera.position.z = controls.target.z + ox * sin + oz * cos;
        controls.update();
      };
      const zoomView = (factor) => {
        const ox = camera.position.x - controls.target.x, oy = camera.position.y - controls.target.y, oz = camera.position.z - controls.target.z;
        const dist = Math.hypot(ox, oy, oz), nd = dist * factor;
        if (nd < controls.minDistance || nd > controls.maxDistance) return;
        camera.position.set(controls.target.x + ox * factor, controls.target.y + oy * factor, controls.target.z + oz * factor);
        controls.update();
      };
      // Vue de dessus (plan) : caméra à la verticale du centre → on voit toute la
      // pièce d'un coup pour organiser le rangement, comme un plan d'architecte.
      const topView = () => {
        controls.target.set(0, 0, 0);
        const d = Math.min(controls.maxDistance, Math.max(room.w, room.h) * 1.25);
        // Nord en haut, comme le plan d'« Aménager la pièce » (avec 0,001 / 0,001
        // la pièce apparaissait de biais, tournée de 45°).
        camera.position.set(0.001, d, 0.02); controls.update();
      };
      // Recentrer : remet la vue immersive de départ.
      const resetView = () => { camera.position.copy(homePos); controls.target.copy(homeTgt); controls.update(); };
      // Interaction directe : en MODE DÉPLACEMENT, glisser un meuble le déplace ;
      // sinon glisser = tourner la vue (OrbitControls) et un tap = sélectionner.
      const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
      const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hitPt = new THREE.Vector3();
      let drag = null, dernierTap = null, tapDiffere = 0;
      const setPtr = (e) => { const r = renderer.domElement.getBoundingClientRect(); ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1; ptr.y = -((e.clientY - r.top) / r.height) * 2 + 1; };
      // pd est posé sur EL (le conteneur) en phase de CAPTURE → il s'exécute AVANT
      // OrbitControls (posé sur le canvas). Si on saisit un meuble à déplacer, on
      // coupe l'événement (stopPropagation) pour que la caméra ne bouge pas ; sinon
      // on laisse filer vers OrbitControls qui tourne la vue.
      // Meubles « de mur » : ils se collent au mur le plus proche quand on les lâche.
      const WALL_TYPES = { grille: 1, porte: 1, fenetre: 1 };
      const SNAP = 1.7;
      const snapWall = (cx, cz, w, h) => {
        if (formeLibre) return snapMurLibre(cx, cz, w, h);
        const hW = room.w / 2, hH = room.h / 2;
        const dN = cz + hH, dS = hH - cz, dW = cx + hW, dE = hW - cx, m = Math.min(dN, dS, dW, dE);
        if (m > SNAP) return null; // trop loin d'un mur → on laisse libre
        const rot = m === dN ? 0 : m === dS ? Math.PI : m === dW ? Math.PI / 2 : -Math.PI / 2;
        const odd = Math.abs(Math.sin(rot)) > 0.5; const effW = odd ? h : w, effH = odd ? w : h;
        let ncx = cx, ncz = cz;
        if (m === dN) ncz = -hH + effH / 2; else if (m === dS) ncz = hH - effH / 2;
        else if (m === dW) ncx = -hW + effW / 2; else ncx = hW - effW / 2;
        // COIN : si un mur perpendiculaire est aussi proche, on cale l'autre axe → aimant vers les coins.
        if (m === dN || m === dS) { if (dW <= SNAP) ncx = -hW + effW / 2; else if (dE <= SNAP) ncx = hW - effW / 2; }
        else { if (dN <= SNAP) ncz = -hH + effH / 2; else if (dS <= SNAP) ncz = hH - effH / 2; }
        ncx = Math.max(-hW + effW / 2, Math.min(hW - effW / 2, ncx));
        ncz = Math.max(-hH + effH / 2, Math.min(hH - effH / 2, ncz));
        return { x: Math.round((ncx + hW - w / 2) * 2) / 2, y: Math.round((ncz + hH - h / 2) * 2) / 2, rot };
      };
      // Pièce de forme libre : on se colle au mur DROIT le plus proche (horizontal
      // ou vertical sur le plan), face au dedans de la pièce. La place finale
      // est revérifiée par l'app (aucun meuble à travers un mur ou un autre).
      const snapMurLibre = (cx, cz, w, h) => {
        let best = null;
        poly.forEach((a, i) => {
          const b = poly[(i + 1) % poly.length];
          const ax = a[0] - room.w / 2, az = a[1] - room.h / 2, bx = b[0] - room.w / 2, bz = b[1] - room.h / 2;
          const horiz = Math.abs(az - bz) < 1e-3, vert = Math.abs(ax - bx) < 1e-3; if (!horiz && !vert) return;
          if (horiz) { if (cx < Math.min(ax, bx) - 0.2 || cx > Math.max(ax, bx) + 0.2) return; const d = Math.abs(cz - az); if (d <= SNAP && (!best || d < best.d)) { const dedans = dedansPoly(cx + room.w / 2, az + room.h / 2 + 0.05); best = { d, horiz: true, pos: az, rot: dedans ? 0 : Math.PI, sgn: dedans ? 1 : -1 }; } }
          else { if (cz < Math.min(az, bz) - 0.2 || cz > Math.max(az, bz) + 0.2) return; const d = Math.abs(cx - ax); if (d <= SNAP && (!best || d < best.d)) { const dedans = dedansPoly(ax + room.w / 2 + 0.05, cz + room.h / 2); best = { d, horiz: false, pos: ax, rot: dedans ? Math.PI / 2 : -Math.PI / 2, sgn: dedans ? 1 : -1 }; } }
        });
        if (!best) return null;
        const odd = Math.abs(Math.sin(best.rot)) > 0.5; const effW = odd ? h : w, effH = odd ? w : h;
        let ncx = cx, ncz = cz;
        if (best.horiz) ncz = best.pos + best.sgn * effH / 2; else ncx = best.pos + best.sgn * effW / 2;
        return { x: Math.round((ncx + room.w / 2 - w / 2) * 4) / 4, y: Math.round((ncz + room.h / 2 - h / 2) * 4) / 4, rot: best.rot };
      };
      const pd = (e) => {
        // ⚠️ SEUL LE BOUTON GAUCHE « TAPE ». Un clic droit sans bouger (le début
        //    d'un déplacement de vue) ouvrait la saisie d'une case — et, sur un
        //    carton de pile, celle qui le RETIRE. Droit et milieu = caméra.
        if (e.pointerType === 'mouse' && e.button !== 0) { drag = null; return; }
        if (e.isPrimary === false) return;   // 2ᵉ doigt d'un pincement : la caméra
        setPtr(e); ray.setFromCamera(ptr, camera);
        const hits = ray.intersectObjects(furnGroup.children, true);
        if (!hits.length) { drag = null; return; } // vide → OrbitControls tourne
        // case de grille (remplir au clic) ou boîte de pile (retirer au clic)
        let cellKey = null, pileIdx = null, quoi = null, probe = hits[0].object;
        while (probe && cellKey == null && pileIdx == null) { if (probe.userData && probe.userData.cell != null) { cellKey = probe.userData.cell; quoi = { num: probe.userData.num != null ? String(probe.userData.num) : null, idx: probe.userData.idx, ghost: !!probe.userData.ghost }; } else if (probe.userData && probe.userData.pileIdx != null) pileIdx = probe.userData.pileIdx; probe = probe.parent; }
        let o = hits[0].object; while (o && (!o.userData || o.userData.w == null)) o = o.parent; if (!o) { drag = null; return; }
        const canDrag = !!moveRef.current;
        const gp = ray.ray.intersectPlane(ground, hitPt);
        drag = { grp: o, id: o.userData.itemId, w: o.userData.w, h: o.userData.h, type: o.userData.type, cell: cellKey, quoi, pileIdx, offX: gp ? o.position.x - hitPt.x : 0, offZ: gp ? o.position.z - hitPt.z : 0, sx: e.clientX, sy: e.clientY, moved: false, canDrag };
        if (canDrag) { // on garde la main : OrbitControls NE reçoit PAS ce geste
          controls.enabled = false;
          try { renderer.domElement.setPointerCapture(e.pointerId); } catch (_) {}
          e.stopPropagation(); if (e.cancelable) e.preventDefault();
        }
      };
      const pm = (e) => {
        if (!drag) return;
        if (!drag.moved && Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 6) drag.moved = true;
        if (!drag.canDrag || !drag.moved) return; // hors mode déplacer : la caméra tourne, on ne bouge PAS le meuble
        setPtr(e); ray.setFromCamera(ptr, camera); if (!ray.ray.intersectPlane(ground, hitPt)) return;
        const hw = drag.w / 2, hh = drag.h / 2;
        drag.grp.position.x = Math.max(-room.w / 2 + hw, Math.min(room.w / 2 - hw, hitPt.x + drag.offX));
        drag.grp.position.z = Math.max(-room.h / 2 + hh, Math.min(room.h / 2 - hh, hitPt.z + drag.offZ));
        if (e.cancelable) e.preventDefault();
      };
      const pu = (e) => {
        if (!drag) return; const d = drag; drag = null;
        if (d.canDrag) { controls.enabled = true; try { renderer.domElement.releasePointerCapture(e.pointerId); } catch (_) {} }
        const cb = cbRef.current || {};
        if (d.canDrag && d.moved) {
          let nx = Math.max(0, Math.min(room.w - d.w, Math.round((d.grp.position.x + room.w / 2 - d.w / 2) * 2) / 2));
          let ny = Math.max(0, Math.min(room.h - d.h, Math.round((d.grp.position.z + room.h / 2 - d.h / 2) * 2) / 2));
          let rot = d.grp.rotation.y || 0, stackOn = null, lift;
          const isBox = !!(FURN_TYPES[d.type] || {}).box, isPile = (FURN_TYPES[d.type] || {}).build === 'pile';
          // Hauteur du DESSUS d'un meuble (pour poser une pile dessus).
          const topOf = (it) => { const sh = (FURN_TYPES[it.type] || {}).build || 'generic'; if (sh === 'grille' || sh === 'pile') return Math.max(1, it.rows || 3) * (it.cell || 0.5); return Math.max(0.35, h3dOf(it) * HSCALE); };
          if (isBox) {
            // On regarde ce qui est SOUS LE DOIGT au moment du lâcher : si c'est une
            // autre boîte, on empile dessus (fiable même sur une haute pile, car on
            // vise l'écran et non le sol qui est décalé par l'angle de caméra).
            setPtr(e); ray.setFromCamera(ptr, camera);
            const others = furnGroup.children.filter(g => g !== d.grp);
            const hits = ray.intersectObjects(others, true);
            for (const h of hits) { let o = h.object; while (o && (!o.userData || o.userData.w == null)) o = o.parent; if (o && (FURN_TYPES[o.userData.type] || {}).box) { stackOn = o.userData.itemId; break; } }
          } else if (isPile) {
            // Lâchée SUR un meuble (table, commode…) → la pile se pose DESSUS, à
            // l'endroit visé ; sur le sol → au sol.
            setPtr(e); ray.setFromCamera(ptr, camera);
            const others = furnGroup.children.filter(g => g !== d.grp);
            const hits = ray.intersectObjects(others, true);
            let liftItem = null, liftPt = null;
            for (const h of hits) { let o = h.object; while (o && (!o.userData || o.userData.w == null)) o = o.parent; if (o && o.userData.itemId !== d.id) { const t = (dataRef.current.items || []).find(i => i.id === o.userData.itemId); const ft = t ? (FURN_TYPES[t.type] || {}) : null; if (t && ft && !ft.pile && !ft.box && !ft.deco && ft.build !== 'grille') { liftItem = t; liftPt = h.point; break; } } } // uniquement de VRAIS meubles (pas une autre pile/boîte/mur)
            if (liftItem) {
              lift = topOf(liftItem);
              if (liftPt) { nx = Math.max(0, Math.min(room.w - d.w, Math.round((liftPt.x + room.w / 2 - d.w / 2) * 2) / 2)); ny = Math.max(0, Math.min(room.h - d.h, Math.round((liftPt.z + room.h / 2 - d.h / 2) * 2) / 2)); }
            } else { // pas sur un meuble → au sol, et on tente le collage au mur le plus proche
              lift = 0;
              const cx = nx + d.w / 2 - room.w / 2, cz = ny + d.h / 2 - room.h / 2, s = snapWall(cx, cz, d.w, d.h);
              if (s) { nx = s.x; ny = s.y; rot = s.rot; }
            }
          } else { // TOUT MEUBLE : se colle au mur le plus proche quand on le lâche près d'un mur
            const cx = nx + d.w / 2 - room.w / 2, cz = ny + d.h / 2 - room.h / 2, s = snapWall(cx, cz, d.w, d.h);
            if (s) { nx = s.x; ny = s.y; rot = s.rot; } else if (WALL_TYPES[d.type]) rot = 0; // les déco reviennent face pièce si loin
          }
          d.grp.position.x = nx + d.w / 2 - room.w / 2; d.grp.position.z = ny + d.h / 2 - room.h / 2; d.grp.rotation.y = rot; if (lift != null) d.grp.position.y = lift;
          cb.onMove && cb.onMove(d.id, nx, ny, rot, stackOn, lift);
        } else if (!d.moved) {
          // DOUBLE-CLIC sur le même meuble / la même case (< 350 ms, < 6 px) : on
          // se met EN FACE. Le 1er clic a déjà agi (sélectionner) ; le 2ᵉ ne doit
          // surtout pas ouvrir la case ou la saisie qui retire un carton.
          const now = Date.now(), prev = dernierTap;
          dernierTap = { id: d.id, cell: d.cell, pileIdx: d.pileIdx, t: now, x: d.sx, y: d.sy };
          if (prev && prev.id === d.id && prev.cell === d.cell && prev.pileIdx === d.pileIdx && now - prev.t < 350 && Math.abs(prev.x - d.sx) + Math.abs(prev.y - d.sy) < 6) {
            if (tapDiffere) { clearTimeout(tapDiffere); tapDiffere = 0; }
            dernierTap = null; flyTo(d.id, { cell: d.cell, pileIdx: d.pileIdx }); return;
          }
          // tap : case de grille → remplir · boîte de pile → retirer · sinon sélectionner
          const agir = () => {
            if (d.cell != null && cb.onCellTap) cb.onCellTap(d.id, d.cell, d.quoi);
            else if (d.pileIdx != null && cb.onPileTap) cb.onPileTap(d.id, d.pileIdx);
            else (cb.onSelect || cb.onOpen) && (cb.onSelect || cb.onOpen)(d.id);
          };
          // ⚠️ Sur une case d'un meuble DÉJÀ choisi, le clic ouvre une saisie : il
          //    attend 280 ms qu'un double-clic ne vienne pas le remplacer. Sinon le
          //    1er clic du double-clic ouvrait la saisie et le 2ᵉ tombait dessus
          //    (vu au banc). Choisir un meuble, lui, reste instantané.
          if ((cb.sel === d.id) && (d.cell != null || d.pileIdx != null)) { if (tapDiffere) clearTimeout(tapDiffere); tapDiffere = setTimeout(() => { tapDiffere = 0; agir(); }, 280); }
          else agir();
        }
      };
      el.addEventListener('pointerdown', pd, true); // CAPTURE : avant OrbitControls
      window.addEventListener('pointermove', pm); window.addEventListener('pointerup', pu);
      // ── CONTOURS : sélection, résultat de recherche, survol ────────────────
      // ⚠️ LE SURLIGNAGE NE TOUCHAIT JAMAIS LES CARTONS : il teintait
      //    `material.emissive`, or un carton porte un TABLEAU de six matériaux
      //    (`Array.emissive` vaut undefined). Une pile n'était donc jamais
      //    surlignée, ni choisie ni cherchée ; dans une grille, c'étaient les
      //    cases VIDES qui s'allumaient. Et les matériaux sont partagés entre
      //    meubles. ⇒ Un contour à part, posé sur la boîte englobante, dans la
      //    couleur d'accent (§7 — le rouge est réservé au doublon de numéro).
      const accent = () => { try { return new THREE.Color(C.accent || '#3D7BFF'); } catch (_) { return new THREE.Color('#3D7BFF'); } };
      const aretesUnite = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), boiteUnite = new THREE.BoxGeometry(1, 1, 1);
      const faireContour = (opLigne, opFond) => {
        const g = new THREE.Group();
        const l = new THREE.LineSegments(aretesUnite, new THREE.LineBasicMaterial({ color: accent(), transparent: true, opacity: opLigne, depthTest: false })); l.renderOrder = 998;
        const f = new THREE.Mesh(boiteUnite, new THREE.MeshBasicMaterial({ color: accent(), transparent: true, opacity: opFond, depthTest: false, depthWrite: false })); f.renderOrder = 997;
        g.add(l, f); g.visible = false; scene.add(g); return g;
      };
      const contours = { sel: faireContour(0.85, 0.06), hi: faireContour(1, 0.2), survol: faireContour(0.7, 0.05) };
      const poserContour = (c, objets) => {
        const liste = (objets || []).filter(Boolean);
        if (!liste.length) { c.visible = false; return; }
        const b = new THREE.Box3();
        liste.forEach((o) => { o.updateWorldMatrix(true, true); o.traverse((m) => { if (m.isMesh) b.expandByObject(m); }); });
        if (b.isEmpty()) { c.visible = false; return; }
        const ctr = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3());
        c.position.copy(ctr); c.scale.set(Math.max(sz.x, 0.02) + 0.04, Math.max(sz.y, 0.02) + 0.04, Math.max(sz.z, 0.02) + 0.04);
        c.children.forEach((m) => m.material && m.material.color && m.material.color.copy(accent()));
        c.visible = true;
      };
      // Les maillages qu'un repère désigne : le meuble, une case, un carton de pile.
      const maillages = (itemId, quoi = {}) => {
        const g = furnGroup.children.find((o) => o.userData && o.userData.itemId === itemId);
        if (!g) return [];
        const enfants = []; g.traverse((m) => { if (m.isMesh) enfants.push(m); });
        if (quoi.cell != null) {
          const cases = enfants.filter((m) => m.userData && m.userData.cell === quoi.cell);
          const memeNum = quoi.num != null ? cases.filter((m) => String(m.userData.num || '').toLowerCase() === String(quoi.num).toLowerCase()) : [];
          if (memeNum.length) return memeNum; if (cases.length) return cases;
        }
        if (quoi.pileIdx != null) { const b = enfants.find((m) => m.userData && m.userData.pileIdx === quoi.pileIdx); if (b) return [b]; }
        return [g];
      };
      // ── SURVOL (souris seulement) : curseur + contour + infobulle ──────────
      // On ne voyait jamais ce qu'on allait cliquer : la flèche partout, aucun
      // repère sur des cartons de quelques pixels. Le texte de la bulle ne vient
      // QUE des données (nom du meuble, N° du carton) — rien n'est deviné.
      const bulle = document.createElement('div');
      Object.assign(bulle.style, { position: 'absolute', left: '0', top: '0', pointerEvents: 'none', display: 'none', zIndex: 5, maxWidth: '240px',
        background: 'rgba(20,22,30,0.78)', color: '#fff', fontSize: '11.5px', fontWeight: '600', lineHeight: '1.35', padding: '5px 9px', borderRadius: '8px',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' });
      bulle.setAttribute('data-bulle-3d', '');
      el.appendChild(bulle);
      let survolCle = '', glisseVue = false, rafSurvol = 0, dernierSurvol = null;
      const curseur = (c) => { try { renderer.domElement.style.cursor = c; } catch (_) {} };
      const viser = (cx, cy) => {
        const r = renderer.domElement.getBoundingClientRect();
        ptr.x = ((cx - r.left) / r.width) * 2 - 1; ptr.y = -((cy - r.top) / r.height) * 2 + 1; ray.setFromCamera(ptr, camera);
        const hits = ray.intersectObjects(furnGroup.children, true);
        if (!hits.length) return null;
        let cellKey = null, pileIdx = null, num = null, probe = hits[0].object;
        while (probe && cellKey == null && pileIdx == null) { const u = probe.userData || {}; if (u.cell != null) { cellKey = u.cell; num = u.num != null ? u.num : null; } else if (u.pileIdx != null) { pileIdx = u.pileIdx; num = u.num != null ? u.num : null; } probe = probe.parent; }
        let o = hits[0].object; while (o && (!o.userData || o.userData.w == null)) o = o.parent;
        return o ? { id: o.userData.itemId, cell: cellKey, pileIdx, num } : null;
      };
      const texteBulle = (v) => {
        const it = (dataRef.current.items || []).find((i) => i.id === v.id) || {};
        const ft = FURN_TYPES[it.type] || {};
        const nom = String(it.name || ft.label || 'Meuble');
        const choisi = (cbRef.current || {}).sel === v.id;
        if (ft.box) return `Carton N°${it.num != null && it.num !== '' ? it.num : '?'}`;
        if (v.pileIdx != null) return `${nom} · N°${v.num || '?'}${choisi ? ' — clic pour modifier ou retirer' : ' — clic pour choisir la pile'}`;
        if (v.cell != null) return v.num != null ? `${nom} · N°${v.num}${choisi ? ' — clic pour modifier' : ''}` : `${nom} · case vide${choisi ? ' — clic pour ranger' : ''}`;
        if (ft.deco) return nom;
        return `${nom} — clic pour le choisir`;
      };
      const survoler = () => {
        rafSurvol = 0;
        const e = dernierSurvol; if (!e) return;
        if (glisseVue || moveRef.current && drag) return;
        const v = viser(e.clientX, e.clientY);
        const cle = v ? `${v.id}|${v.cell == null ? '' : v.cell}|${v.pileIdx == null ? '' : v.pileIdx}` : '';
        try { el.parentElement && (el.parentElement.dataset.hover = cle); } catch (_) {}
        if (!v) { curseur(moveRef.current ? 'default' : 'grab'); bulle.style.display = 'none'; if (survolCle) poserContour(contours.survol, null); survolCle = ''; return; }
        curseur(moveRef.current ? 'move' : 'pointer');
        if (cle !== survolCle) { survolCle = cle; poserContour(contours.survol, maillages(v.id, v)); bulle.textContent = texteBulle(v); }
        const r = el.getBoundingClientRect();
        let x = e.clientX - r.left + 14, y = e.clientY - r.top + 16;
        bulle.style.display = 'block';
        const bw = bulle.offsetWidth || 120; if (x + bw > r.width - 6) x = Math.max(6, e.clientX - r.left - bw - 10);
        if (y > r.height - 30) y = e.clientY - r.top - 30;
        bulle.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      };
      const surMouvement = (e) => {
        if (e.pointerType !== 'mouse') return;               // le survol n'existe pas au doigt
        if (e.buttons) { if (!drag) { glisseVue = true; curseur('grabbing'); bulle.style.display = 'none'; } return; }
        glisseVue = false; dernierSurvol = e;
        if (!rafSurvol) rafSurvol = requestAnimationFrame(survoler);
      };
      const surSortie = () => { bulle.style.display = 'none'; poserContour(contours.survol, null); survolCle = ''; try { el.parentElement && (el.parentElement.dataset.hover = ''); } catch (_) {} };
      const surRelache = () => { if (glisseVue) { glisseVue = false; curseur('grab'); } };
      renderer.domElement.addEventListener('pointermove', surMouvement);
      renderer.domElement.addEventListener('pointerleave', surSortie);
      window.addEventListener('pointerup', surRelache);
      curseur('grab');
      // ── LES ÉTIQUETTES RESTENT LISIBLES (17 oct.) ─────────────────────────
      // Julien : sur une grande pièce, la vue du dessus était illisible — les
      // étiquettes (taille fixe EN MÈTRES) se recouvraient en un tas noir, et
      // au loin elles tombaient à quelques pixels. Désormais :
      //  · TAILLE À L'ÉCRAN CONSTANTE : la plaque est remise à l'échelle à
      //    chaque image pour faire `PX` pixels de haut, où qu'on soit ;
      //  · AUCUN CHEVAUCHEMENT : on les pose par ordre d'importance (le meuble
      //    choisi ou cherché d'abord, puis ceux qui portent le plus de paires,
      //    puis les plus proches) ; une étiquette qui en recouvrirait une déjà
      //    posée est MASQUÉE — elle revient dès qu'on zoome ou qu'on tourne.
      // Pure présentation : aucune donnée, aucun numéro n'est touché.
      const PX_ETIQ = sourisFine ? 22 : 19, MARGE_ETIQ = 4;
      const vEtiq = new THREE.Vector3(), pEtiq = new THREE.Vector3();
      let cleEtiq = '', etiqVisibles = 0, etiqTotal = 0, etiqRects = [];
      const placerEtiquettes = () => {
        const cv = renderer.domElement, Wp = cv.clientWidth || 1, Hp = cv.clientHeight || 1;
        const liste = [];
        furnGroup.children.forEach(g => g.children.forEach(o => { if (o.isSprite && o.userData && o.userData.etiquette) liste.push(o); }));
        // ⚠️ La clé porte l'IDENTITÉ des étiquettes : une reconstruction (une paire
        //    rangée) recrée des plaques à leur taille par défaut — en mètres — avec
        //    le même nombre de meubles ; sans ça elles restaient géantes de près.
        const cle = camera.position.toArray().map(v => v.toFixed(3)).join(',') + '|' + controls.target.toArray().map(v => v.toFixed(3)).join(',') + '|' + Wp + 'x' + Hp + '|' + liste.map(o => o.id).join(',') + '|' + (selRef.current.sel || '') + '|' + ((selRef.current.hi || {}).itemId || '');
        if (cle === cleEtiq) return; cleEtiq = cle;
        const tanV = Math.tan((camera.fov * Math.PI / 180) / 2);
        const haut = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion), droite = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        const ecran = (v) => { const q = v.clone().project(camera); return [(q.x + 1) / 2 * Wp, (1 - q.y) / 2 * Hp, q.z]; };
        const { sel: sSel, hi: sHi } = selRef.current; const hiId = sHi && sHi.itemId;
        liste.forEach(o => {
          o.getWorldPosition(vEtiq);
          // profondeur le long de l'axe de la caméra (c'est elle qui fixe la taille projetée)
          const prof = Math.max(0.05, pEtiq.copy(vEtiq).sub(camera.position).dot(new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)));
          // La PLAQUE occupe 40/64 de la hauteur du dessin : c'est elle qui fait PX.
          const hM = (PX_ETIQ / 0.625) * 2 * prof * tanV / Hp, ratio = o.userData.etiquette.ratio || 4;
          o.scale.set(hM * ratio, hM, 1);
          // Ce qui est MESURÉ à l'écran (pas recalculé de la formule) : le banc juge ça.
          const demiH = hM * 0.3125, demiW = hM * ratio * 0.5;
          const [x0, y0, z0] = ecran(vEtiq), [, yH] = ecran(vEtiq.clone().addScaledVector(haut, demiH)), [xD] = ecran(vEtiq.clone().addScaledVector(droite, demiW));
          const id = o.userData.itemId;
          o.userData._px = { x: x0, y: y0, w: Math.abs(xD - x0) * 2, h: Math.abs(y0 - yH) * 2, z: z0, dist: prof, rang: (id === sSel || id === hiId) ? 1e9 : (o.userData.cnt || 0) };
        });
        // D'abord les étiquettes, puis les puces des meubles dont l'étiquette n'a
        // pas trouvé de place.
        const tri = (a, b) => (b.userData._px.rang - a.userData._px.rang) || (a.userData._px.dist - b.userData._px.dist);
        const etiqs = liste.filter(o => !o.userData.puce).sort(tri), puces = liste.filter(o => o.userData.puce).sort(tri);
        const posees = [], aEtiquette = new Set();
        const poser = (o) => {
          const q = o.userData._px; const r = { x: q.x - q.w / 2, y: q.y - q.h / 2, w: q.w, h: q.h };
          const dedans = q.z < 1 && r.x + r.w > 0 && r.x < Wp && r.y + r.h > 0 && r.y < Hp;
          const recouvre = posees.some(p => r.x < p.x + p.w + MARGE_ETIQ && p.x < r.x + r.w + MARGE_ETIQ && r.y < p.y + p.h + MARGE_ETIQ && p.y < r.y + r.h + MARGE_ETIQ);
          o.visible = dedans && !recouvre;
          if (o.visible) posees.push({ ...r, id: o.userData.itemId, puce: !!o.userData.puce });
          return o.visible;
        };
        // Une étiquette ne s'étale pas sur la place d'un AUTRE meuble qui porte des
        // paires (sa puce) : en rangée serrée, on garde un nombre par meuble plutôt
        // qu'un nom qui en cache cinq. Le meuble choisi ou cherché passe toujours.
        const zonePuce = (o) => { const q = o.userData._px; return { x: q.x - q.w / 2, y: q.y - q.h / 2, w: q.w, h: q.h, id: o.userData.itemId }; };
        const zones = puces.filter(o => o.userData._px.z < 1).map(zonePuce);
        etiqs.forEach(o => {
          const q = o.userData._px, r = { x: q.x - q.w / 2, y: q.y - q.h / 2, w: q.w, h: q.h };
          const empiete = q.rang < 1e9 && zones.some(z => z.id !== o.userData.itemId && r.x < z.x + z.w && z.x < r.x + r.w && r.y < z.y + z.h && z.y < r.y + r.h);
          if (empiete) { o.visible = false; return; }
          if (poser(o)) aEtiquette.add(o.userData.itemId);
        });
        puces.forEach(o => { if (aEtiquette.has(o.userData.itemId)) { o.visible = false; return; } poser(o); });
        etiqVisibles = posees.filter(p => !p.puce).length; etiqTotal = etiqs.length; etiqRects = posees;
        try { el.dataset.etiquettes = etiqVisibles + '/' + etiqTotal; } catch (_) {}
      };
      let raf; const animate = () => { controls.update(); try { placerEtiquettes(); } catch (_) {} renderer.render(scene, camera); raf = requestAnimationFrame(animate); }; animate();
      const onResize = () => {
        const w = el.clientWidth || W, h = el.clientHeight || H;
        renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
        // Le cadrage dépend du FORMAT : après une rotation d'écran, « Recentrer »
        // doit rendre la vue qui cadre CE format, pas l'ancien.
        try { const c = cadrerPiece(); homePos = c.pos; homeTgt = c.tgt; controls.maxDistance = Math.max(controls.maxDistance, c.d * 1.35); } catch (_) {}
      };
      let ro; try { ro = new ResizeObserver(onResize); ro.observe(el); } catch (_) { window.addEventListener('resize', onResize); }
      // ── AMBIANCE (univers façon jeu) : mute les couleurs/lumières EN DIRECT
      //    (la boucle de rendu tourne en continu → effet immédiat), sans jamais
      //    reconstruire la scène. Sûr : ce ne sont que des couleurs/intensités. ──
      const baseWall = room.wallColor || '#e4e8ee';
      const applyAmbiance = (id) => {
        const a = GARAGE_AMBIANCES.find(x => x.id === id) || GARAGE_AMBIANCES[0];
        try {
          try { scene.background && scene.background.dispose && scene.background.dispose(); } catch (_) {}
          scene.background = fondDegrade(a.bg);
          hemi.color.set(a.sky); hemi.groundColor.set(a.ground); hemi.intensity = a.hemi;
          ambient.intensity = a.ambient;
          dir.color.set(a.sun); dir.intensity = a.sunI;
          fill.color.set(a.fill); fill.intensity = a.fillI;
          wallMat.color.set(a.wall || baseWall);
          floorMat.color.set(a.floor || '#ffffff');
          renderer.toneMappingExposure = a.exposure;
        } catch (_) {}
      };
      applyAmbiance(load('vrm_garage_ambiance', 'clair'));
      // « Vol vers la boîte » : quand tu cherches un N°, la caméra vole en douceur
      // jusqu'au meuble qui le contient (au lieu de le surligner sans bouger la
      // vue). Pure animation de caméra → si ça échoue, le garage reste utilisable.
      let flyRAF = 0;
      // ⚠️ Attraper la vue pendant un vol l'ANNULE : avant, chaque image du vol
      //    réécrivait la caméra et reprenait la main à l'utilisateur.
      controls.addEventListener('start', () => { if (flyRAF) { cancelAnimationFrame(flyRAF); flyRAF = 0; } });
      const flyTo = (itemId, quoi = {}) => {
        try {
          const g = furnGroup.children.find(o => o.userData && o.userData.itemId === itemId);
          if (!g) return;
          // La boîte des MAILLAGES seulement (l'étiquette flottante décalait le
          // centre vers le haut) — ou d'une seule case / d'un seul carton.
          const cible = (quoi.cell != null || quoi.pileIdx != null) ? maillages(itemId, quoi) : [g];
          const box = new THREE.Box3(); cible.forEach((o) => { o.updateWorldMatrix(true, true); o.traverse((m) => { if (m.isMesh) box.expandByObject(m); }); });
          if (box.isEmpty()) return;
          const versCase = cible[0] !== g;
          const c = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          // ⚠️ ON SE MET DE FACE, pas en trois-quarts.
          // Quand on cherche un N°, ce qu'on veut voir c'est la GRILLE de cases
          // du meuble — de biais, les rangées se chevauchent et on ne compte
          // plus rien. La direction est « du meuble vers le CENTRE de la
          // pièce » : un rangement est contre un mur, il s'ouvre vers
          // l'intérieur, donc c'est le côté dégagé. Aucune convention de
          // rotation à deviner (elle diffère d'un type de meuble à l'autre).
          let dx = -c.x, dz = -c.z;
          const n = Math.hypot(dx, dz);
          if (n < 0.35) { dx = 0; dz = 1; } else { dx /= n; dz /= n; }
          const dist = versCase ? Math.max(1.8, Math.max(size.x, size.y) * 4.5) : Math.max(size.x, size.y, 0.6) * 1.45 + 1.5;
          const destTgt = new THREE.Vector3(c.x, c.y, c.z);
          const destPos = new THREE.Vector3(c.x + dx * dist, c.y + size.y * 0.30, c.z + dz * dist);
          const startPos = camera.position.clone(), startTgt = controls.target.clone();
          // 420 ms (au lieu de 720), sortie douce — jamais un départ lent ; aucun
          // mouvement si le système demande de les réduire.
          const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now()), dur = reduit ? 0 : 420;
          const ease = t => 1 - Math.pow(1 - t, 4);
          if (flyRAF) cancelAnimationFrame(flyRAF);
          const step = () => {
            const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
            const k = dur > 0 ? Math.min(1, (now - t0) / dur) : 1, e = ease(k);
            camera.position.lerpVectors(startPos, destPos, e);
            controls.target.lerpVectors(startTgt, destTgt, e);
            controls.update();
            if (k < 1) flyRAF = requestAnimationFrame(step); else flyRAF = 0;
          };
          step();
        } catch (_) {}
      };
      // ── LA BOÎTE TOMBE DANS SA CASE ────────────────────────────────────
      // Julien : « ça doit être comme un jeu vidéo, on voit les animations ».
      // Ranger une paire ne doit pas se contenter d'un chiffre qui apparaît :
      // le carton ARRIVE. On anime la case fraîchement remplie — chute depuis
      // le haut, léger rebond à l'atterrissage, puis un halo qui s'éteint.
      // ⚠️ Appelé APRÈS la reconstruction du meuble (l'effet sur `items`) :
      // la boîte n'existe qu'à ce moment-là. Pure animation → un échec ne
      // casse rien, le rangement est déjà enregistré.
      let depotRAF = 0;
      const animerDepot = (itemId, cellKey, numVise) => {
        try {
          const g = furnGroup.children.find(o => o.userData && o.userData.itemId === itemId);
          if (!g) return;
          let cible = null;
          if (numVise != null) g.traverse(o => { if (!cible && o.userData && o.userData.cell === cellKey && String(o.userData.num) === String(numVise) && o.isMesh) cible = o; });
          if (!cible) g.traverse(o => { if (!cible && o.userData && o.userData.cell === cellKey && !o.userData.ghost && o.isMesh) cible = o; });
          if (!cible) return;
          const yFin = cible.position.y;
          const haut = yFin + 1.15;
          const halo = new THREE.Mesh(
            new THREE.RingGeometry(0.16, 0.30, 24),
            new THREE.MeshBasicMaterial({ color: 0x2ee08f, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthTest: false })
          );
          halo.rotation.x = -Math.PI / 2;
          halo.position.set(cible.position.x, yFin - 0.02, cible.position.z);
          halo.renderOrder = 999; g.add(halo);
          const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now()), dur = 620;
          // chute accélérée puis rebond amorti — un objet qui se pose, pas qui glisse
          const chute = t => { if (t < 0.72) { const k = t / 0.72; return k * k; }
                               const k = (t - 0.72) / 0.28; return 1 - Math.sin(k * Math.PI) * 0.14 * (1 - k); };
          if (depotRAF) cancelAnimationFrame(depotRAF);
          const pas = () => {
            const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
            const k = Math.min(1, (now - t0) / dur);
            cible.position.y = haut + (yFin - haut) * chute(k);
            const e = 1 - k;
            halo.scale.setScalar(1 + k * 2.4);
            halo.material.opacity = 0.9 * e * e;
            if (k < 1) depotRAF = requestAnimationFrame(pas);
            else { depotRAF = 0; cible.position.y = yFin; try { g.remove(halo); halo.geometry.dispose(); halo.material.dispose(); } catch (_) {} }
          };
          pas();
        } catch (_) {}
      };
      // ── LA BOÎTE S'EN VA ──────────────────────────────────────────────
      // Le pendant de `animerDepot` : quand une paire sort du garage, on la
      // voit partir (elle monte et s'efface) au lieu de disparaître d'un coup.
      // ⚠️ Appelée AVANT l'écriture : la boîte doit encore exister. Le rendu
      // suivant la retire pour de bon.
      const animerSortie = (itemId, cellKey, fini, numVise) => {
        try {
          const g = furnGroup.children.find(o => o.userData && o.userData.itemId === itemId);
          if (!g) { fini && fini(); return; }
          let cible = null;
          if (numVise != null) g.traverse(o => { if (!cible && o.userData && o.userData.cell === cellKey && String(o.userData.num) === String(numVise) && o.isMesh) cible = o; });
          if (!cible) g.traverse(o => { if (!cible && o.userData && o.userData.cell === cellKey && !o.userData.ghost && o.isMesh) cible = o; });
          if (!cible) { fini && fini(); return; }
          const y0 = cible.position.y;
          const mats = Array.isArray(cible.material) ? cible.material : [cible.material];
          mats.forEach(m => { if (m) { m.transparent = true; } });
          const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now()), dur = 380;
          const pas = () => {
            const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
            const k = Math.min(1, (now - t0) / dur);
            cible.position.y = y0 + k * 0.55;
            mats.forEach(m => { if (m) m.opacity = 1 - k; });
            if (k < 1) requestAnimationFrame(pas);
            else fini && fini();
          };
          pas();
        } catch (_) { fini && fini(); }
      };
      // Sonde du banc (lecture seule) : où se trouve à l'écran un meuble / une case.
      try {
        el.__vrmProbe = {
          project: (itemId, quoi = {}) => {
            const ms = maillages(itemId, quoi); if (!ms.length) return null;
            const b = new THREE.Box3(); ms.forEach((o) => { o.updateWorldMatrix(true, true); o.traverse((m) => { if (m.isMesh) b.expandByObject(m); }); });
            // `avant` : le centre de la FACE AVANT du carton (ce qu'on voit et qu'on touche).
            const m0 = ms[0], prof = m0.geometry && m0.geometry.parameters && m0.geometry.parameters.depth;
            const c = (quoi.avant && prof ? new THREE.Vector3(0, 0, prof / 2).applyMatrix4(m0.matrixWorld) : b.getCenter(new THREE.Vector3())).project(camera); const r = renderer.domElement.getBoundingClientRect();
            return { x: r.left + (c.x + 1) / 2 * r.width, y: r.top + (1 - c.y) / 2 * r.height };
          },
          // La face NUMÉROTÉE d'une étiquette (face +Z d'un carton) regarde-t-elle la
          // caméra ? 1 = de face, 0 = de profil (on ne voit que sa tranche).
          faceNum: (itemId, quoi = {}) => {
            const ms = maillages(itemId, quoi).filter(m => Array.isArray(m.material) && m.material[4] && m.material[4].map);
            if (!ms.length) return null;
            const m = ms[0]; m.updateWorldMatrix(true, false);
            const n = new THREE.Vector3(0, 0, 1).transformDirection(m.matrixWorld);
            const pos = new THREE.Vector3().setFromMatrixPosition(m.matrixWorld);
            const versCam = camera.position.clone().sub(pos).normalize();
            const q = new THREE.Box3().setFromObject(m), r = renderer.domElement.getBoundingClientRect();
            const coins = [[q.min.x, q.min.y, q.min.z], [q.max.x, q.max.y, q.max.z], [q.min.x, q.max.y, q.max.z], [q.max.x, q.min.y, q.min.z]].map(([a, b, c]) => new THREE.Vector3(a, b, c).project(camera));
            const xs = coins.map(c => (c.x + 1) / 2 * r.width), ys = coins.map(c => (1 - c.y) / 2 * r.height);
            return { dot: n.dot(versCam), lg: Math.max(...xs) - Math.min(...xs), ht: Math.max(...ys) - Math.min(...ys) };
          },
          // Où est à l'écran le carton qui porte CE numéro (dans ce meuble).
          boite: (itemId, num) => {
            const g = furnGroup.children.find((o) => o.userData && o.userData.itemId === itemId); if (!g) return null;
            let m = null; g.traverse((o) => { if (!m && o.isMesh && o.userData && String(o.userData.num) === String(num)) m = o; });
            if (!m) return null; m.updateWorldMatrix(true, false);
            const c = new THREE.Vector3().setFromMatrixPosition(m.matrixWorld).project(camera), r = renderer.domElement.getBoundingClientRect();
            return { x: r.left + (c.x + 1) / 2 * r.width, y: r.top + (1 - c.y) / 2 * r.height, yMonde: new THREE.Vector3().setFromMatrixPosition(m.matrixWorld).y };
          },
          // Le cadre de hauteur max de chaque pile : [{ c, h, haut }] (haut = sommet en mètres).
          hauteursMax: (itemId) => {
            const g = furnGroup.children.find((o) => o.userData && o.userData.itemId === itemId); if (!g) return null;
            const out = [], txt = {}; g.traverse((o) => { if (o.userData && o.userData.hauteurMax != null) out.push({ c: o.userData.pileCol, h: o.userData.hauteurMax, haut: +(o.position.y + o.scale.y / 2).toFixed(3) }); if (o.isSprite && o.userData && o.userData.maxPile != null) txt[o.userData.maxPile] = { texte: o.userData.texte, y: +o.position.y.toFixed(3) }; });
            return out.sort((a, b) => a.c - b.c).map((x) => ({ ...x, texte: txt[x.c] ? txt[x.c].texte : null, texteY: txt[x.c] ? txt[x.c].y : null }));
          },
          // Les plateaux d'une étagère : [{ y, w }] (hauteur dans le meuble, largeur).
          plateaux: (itemId) => {
            const g = furnGroup.children.find((o) => o.userData && o.userData.itemId === itemId); if (!g) return null;
            const out = []; g.traverse((o) => { if (o.isMesh && o.userData && o.userData.plateau && o.geometry && o.geometry.parameters) out.push({ y: +o.position.y.toFixed(3), w: +(o.geometry.parameters.width != null ? o.geometry.parameters.width : o.geometry.parameters.height).toFixed(3) }); });
            return out;
          },
          etiquettes: () => ({ visibles: etiqVisibles, total: etiqTotal, puces: etiqRects.filter(r => r.puce).length, px: PX_ETIQ, rects: etiqRects.map(r => ({ ...r })) }),
          contour: (quel) => { const c = contours[quel]; return c && c.visible ? { x: c.position.x, y: c.position.y, z: c.position.z, sx: c.scale.x, sy: c.scale.y, sz: c.scale.z } : null; },
        };
      } catch (_) {}
      // (17 oct.) LES PAIRES À ALLER CHERCHER : un contour d'accent par paire
      // (bouton de l'onglet Colis), posé sur SON carton — pas sur tout le meuble.
      const contoursCibles = [];
      const poserCibles = (liste) => {
        while (contoursCibles.length) { const c = contoursCibles.pop(); scene.remove(c); }
        (liste || []).forEach(q => { if (!q || !q.itemId) return; const c = faireContour(1, 0.28); poserContour(c, maillages(q.itemId, { cell: q.cell, pileIdx: q.pileIdx, num: q.num })); if (c.visible) contoursCibles.push(c); else scene.remove(c); });
        try { el.parentElement && (el.parentElement.dataset.cibles = String(contoursCibles.length)); } catch (_) {}
      };
      // (17 oct.) VUE DU DESSUS ANIMÉE : après un changement de disposition, la
      // caméra monte à la verticale de la pièce pour qu'on relise le plan. Sortie
      // douce, ~600 ms ; immédiate si le système demande moins de mouvement.
      const versDessus = (instant) => {
        try {
          const d = Math.min(controls.maxDistance, Math.max(cadre0.d * 0.95, Math.max(room.w, room.h) * 1.2));
          const destTgt = new THREE.Vector3(0, 0, 0), destPos = new THREE.Vector3(0.001, d, 0.02);
          const startPos = camera.position.clone(), startTgt = controls.target.clone();
          const t0 = performance.now(), dur = (reduit || instant) ? 0 : 620;
          const ease = t => 1 - Math.pow(1 - t, 3);
          if (flyRAF) cancelAnimationFrame(flyRAF);
          const step = () => {
            const k = dur > 0 ? Math.min(1, (performance.now() - t0) / dur) : 1, e = ease(k);
            camera.position.lerpVectors(startPos, destPos, e); controls.target.lerpVectors(startTgt, destTgt, e); controls.update();
            if (k < 1) flyRAF = requestAnimationFrame(step); else { flyRAF = 0; try { el.parentElement && (el.parentElement.dataset.vue = 'dessus'); } catch (_) {} }
          };
          step();
        } catch (_) {}
      };
      const revenir3D = () => {
        const startPos = camera.position.clone(), startTgt = controls.target.clone(); const t0 = performance.now(), dur = reduit ? 0 : 520;
        if (flyRAF) cancelAnimationFrame(flyRAF);
        const step = () => { const k = dur > 0 ? Math.min(1, (performance.now() - t0) / dur) : 1, e = 1 - Math.pow(1 - k, 3); camera.position.lerpVectors(startPos, homePos, e); controls.target.lerpVectors(startTgt, homeTgt, e); controls.update(); if (k < 1) flyRAF = requestAnimationFrame(step); else { flyRAF = 0; try { el.parentElement && (el.parentElement.dataset.vue = '3d'); } catch (_) {} } };
        step();
      };
      const marquer = (quoi) => { const h = quoi || {}; poserContour(contours.sel, h.sel ? maillages(h.sel) : null); poserContour(contours.hi, h.hi && h.hi.itemId ? maillages(h.hi.itemId, h.hi) : null); poserCibles(h.cibles); };
      st.current = { THREE, furnGroup, buildFurniture, rotateView, zoomView, topView, resetView, applyAmbiance, flyTo, animerDepot, animerSortie, marquer, versDessus, revenir3D };
      // (17 oct.) Glisser-déposer une paire depuis la bande « À ranger » : l'app
      // demande ce qui est sous le doigt (le meuble, la case) au moment du lâcher.
      if (viseurRef) viseurRef.current = (x, y) => { try { return viser(x, y); } catch (_) { return null; } };
      try { el.parentElement && (el.parentElement.dataset.vue = '3d'); } catch (_) {}
      setLoading(false);
      cleanup = () => {
        if (viseurRef) viseurRef.current = null;
        cancelAnimationFrame(raf); if (flyRAF) cancelAnimationFrame(flyRAF); if (chuteRAF) cancelAnimationFrame(chuteRAF); if (rafSurvol) cancelAnimationFrame(rafSurvol); if (tapDiffere) clearTimeout(tapDiffere);
        el.removeEventListener('pointerdown', pd, true);
        window.removeEventListener('pointermove', pm); window.removeEventListener('pointerup', pu);
        try { renderer.domElement.removeEventListener('pointermove', surMouvement); renderer.domElement.removeEventListener('pointerleave', surSortie); } catch (_) {}
        window.removeEventListener('pointerup', surRelache);
        try { el.removeChild(bulle); } catch (_) {}
        try { ro && ro.disconnect(); } catch (_) {} window.removeEventListener('resize', onResize);
        try { controls.dispose(); } catch (_) {} renderer.dispose(); try { el.removeChild(renderer.domElement); } catch (_) {}
      };
    })();
    return () => { cancelled = true; cleanup(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reconstruit les meubles quand les données changent (couleur, taille, hauteur,
  // ajout/suppression, N° rangés…) — SANS bouger la caméra (rebuild du groupe seul).
  useEffect(() => { dataRef.current.items = items; if (st.current.buildFurniture) { try { st.current.buildFurniture(); } catch (_) {} } }, [items]);
  // ⚠️ APRÈS l'effet ci-dessus, jamais avant : la boîte à animer n'existe qu'une
  // fois le meuble reconstruit. React exécute les effets dans l'ordre de
  // déclaration — c'est ce qui garantit l'enchaînement.
  useEffect(() => {
    if (!depot || !depot.at || loading) return;
    try { st.current.animerDepot && st.current.animerDepot(depot.itemId, depot.cellKey, depot.num); } catch (_) {}
  }, [depot && depot.at, loading]);
  // La sortie : on anime, PUIS on prévient (c'est l'appelant qui écrit).
  useEffect(() => {
    if (!sortie || !sortie.at || loading) return;
    try { st.current.animerSortie ? st.current.animerSortie(sortie.itemId, sortie.cellKey, sortie.fini, sortie.num) : (sortie.fini && sortie.fini()); }
    catch (_) { sortie.fini && sortie.fini(); }
  }, [sortie && sortie.at, loading]);
  // Surlignage : un contour d'accent sur le meuble choisi, un contour plus marqué
  // sur la boîte cherchée (la CASE ou le CARTON précis, pas tout le meuble).
  const flownRef = useRef(null);
  cbRef.current.sel = sel;
  useEffect(() => {
    if (!st.current.marquer) return;
    try { st.current.marquer({ sel, hi, cibles }); } catch (_) {}
    // Vole vers la boîte cherchée — seulement quand la CIBLE change (pas à chaque
    // reconstruction de meubles), pour ne pas secouer la caméra sans raison.
    const target = hi && hi.itemId ? `${hi.itemId}|${hi.cell || ''}|${hi.pileIdx == null ? '' : hi.pileIdx}` : null;
    if (target && target !== flownRef.current && st.current.flyTo) { st.current.flyTo(hi.itemId, { cell: hi.cell, pileIdx: hi.pileIdx, num: hi.num }); }
    flownRef.current = target;
  }, [hi, sel, loading, items, cibles]);
  // Une disposition qui vient de changer ⇒ vue du dessus (une seule fois par
  // changement ; aussi juste après un remontage — la forme de la pièce change
  // la scène entière).
  const dessusFait = useRef(0);
  useEffect(() => {
    if (loading || !vueDessus || vueDessus === dessusFait.current) return;
    if (Date.now() - vueDessus > 4000) { dessusFait.current = vueDessus; return; }
    dessusFait.current = vueDessus;
    try { st.current.versDessus && st.current.versDessus(); setEnDessus(true); } catch (_) {}
  }, [vueDessus, loading]);
  // ── CLAVIER : la vue se pilote aussi sans souris ─────────────────────────────
  // Aucune touche ne faisait rien sur la 3D. La zone prend le focus au clic et
  // garde ses touches (stopPropagation : le raccourci global ← / → change
  // d'onglet — le Stock n'est pas dans les onglets du bas aujourd'hui, mais il
  // ne doit pas suffire de l'y ajouter pour que les flèches le fassent quitter).
  const surTouche3D = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const s = st.current || {}; let fait = true;
    switch (e.key) {
      case 'ArrowLeft': s.rotateView && s.rotateView(-12); break;
      case 'ArrowRight': s.rotateView && s.rotateView(12); break;
      case 'ArrowUp': case '+': case '=': s.zoomView && s.zoomView(0.85); break;
      case 'ArrowDown': case '-': case '_': s.zoomView && s.zoomView(1.18); break;
      case 'Home': case '0': s.resetView && s.resetView(); break;
      case 'f': case 'F': if (sel && s.flyTo) s.flyTo(sel); else fait = false; break;
      case 'Escape': if (sel && onSelect) onSelect(null); else fait = false; break;
      default: fait = false;
    }
    if (fait) { e.preventDefault(); e.stopPropagation(); }
  };

  // (17 oct.) SANS WebGL, une pièce en L, en U, en T ou à main levée était
  // redessinée en RECTANGLE (la perspective ne sait faire que ça) : on voyait
  // des meubles « dans » un coin qui n'existe pas. Une forme libre se dessine
  // donc vue du dessus, coins compris ; le rectangle garde sa perspective.
  if (err) return fallback || (formeLibre
    ? <PlanSecours items={items} poly={poly} hi={hi} sel={sel} cibles={cibles} onOpen={onOpen} colorOf={colorOf} emojiOf={emojiOf} storedCount={storedCount} C={C} FURN_TYPES={FURN_TYPES} />
    : <RoomPerspective items={items} room={room} hi={hi} sel={sel} onOpen={onOpen} colorOf={colorOf} emojiOf={emojiOf} h3dOf={h3dOf} storedCount={storedCount} C={C} />);
  return (
    <div data-noswipe="1" data-stock3d="" tabIndex={0} role="application" onKeyDown={surTouche3D}
      onPointerDown={(e) => { try { if (e.target && e.target.tagName === 'CANVAS') e.currentTarget.focus({ preventScroll: true }); } catch (_) {} }}
      aria-label="Stock en 3D. Glisser : tourner. Molette : zoomer vers le point visé. Clic droit : déplacer. Double-clic : se mettre en face. Flèches : tourner et zoomer. Début : toute la pièce. Échap : désélectionner."
      style={{ position: 'relative', width: '100%', height: 'min(52vh, 460px)', minHeight: 320, borderRadius: 16, overflow: 'hidden', border: `1px solid ${C.border}`, background: '#e9edf2', boxShadow: C.shadow, outlineOffset: -2 }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%', touchAction: 'none', userSelect: 'none' }} />
      {loading && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: 13, fontWeight: 700 }}>Chargement de la 3D…</div>}
      {/* ⚠️ LA DÉCO NE MANGE PLUS LE HAUT DE LA PIÈCE.
          Les cinq ambiances étaient une rangée de pastilles qui DÉFILAIT en
          travers du haut de la vue : la dernière était coupée, et elles
          couvraient précisément l'étagère qu'on vient regarder. Elles passent
          derrière un seul bouton — on change d'ambiance une fois, on regarde sa
          pièce tous les jours. */}
      {!loading && (
        <div data-noswipe="1" style={{ position: 'absolute', top: 8, left: 8, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
          <button type="button" onPointerDown={e => e.stopPropagation()} onClick={() => setAmbOpen(v => !v)} title="Changer l'ambiance"
            style={{ border: '1px solid rgba(255,255,255,0.34)', background: 'rgba(20,22,30,0.55)', color: '#fff', borderRadius: 999, padding: '5px 11px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
            {(GARAGE_AMBIANCES.find(a => a.id === amb) || GARAGE_AMBIANCES[0]).emoji} Ambiance
          </button>
          {ambOpen && GARAGE_AMBIANCES.map(a => (
            <button key={a.id} type="button" onPointerDown={e => e.stopPropagation()}
              onClick={() => { setAmb(a.id); setAmbOpen(false); save('vrm_garage_ambiance', a.id); try { st.current.applyAmbiance && st.current.applyAmbiance(a.id); } catch (_) {} }}
              style={{ border: `1px solid ${amb === a.id ? '#ffffff' : 'rgba(255,255,255,0.3)'}`, background: amb === a.id ? 'rgba(20,22,30,0.78)' : 'rgba(20,22,30,0.5)', color: '#fff', borderRadius: 999, padding: '5px 11px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', fontFamily: 'inherit' }}>
              {a.emoji} {a.name}
            </button>
          ))}
        </div>
      )}
      {/* Contrôles de vue : tourner à gauche/droite + zoom (fiables sur mobile) */}
      {!loading && (() => {
        const btn = { width: 38, height: 38, borderRadius: 10, border: '1px solid rgba(0,0,0,0.15)', background: 'rgba(255,255,255,0.92)', color: '#1c1c22', fontSize: 17, fontWeight: 900, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.18)', touchAction: 'manipulation', userSelect: 'none', flexShrink: 0 };
        const stop = (e) => { e.stopPropagation(); };
        const call = (fn, ...a) => { const s = st.current || {}; if (s[fn]) s[fn](...a); };
        return (
          <>
            {/* ⚠️ Deux GRAPPES SÉPARÉES, jamais un seul bloc.
                Les six boutons étaient collés dans un même coin, en trois
                groupes qui se chevauchaient (relevé en capture). Cadrage à
                gauche, navigation à droite : chacun garde sa place quelle que
                soit la largeur. */}
            {/* (17 oct.) Sur un téléphone, les deux grappes se chevauchaient
                (« De face » passait sous ◀). Elles partagent une rangée et, si
                elles n'y tiennent pas, la navigation remonte d'un cran. */}
            <div data-commandes-3d="" style={{ position: 'absolute', left: 8, right: 8, bottom: 8, display: 'flex', flexWrap: 'wrap-reverse', justifyContent: 'space-between', alignItems: 'flex-end', gap: 6, pointerEvents: 'none' }}>
            <div style={{ display: 'flex', gap: 6, pointerEvents: 'auto' }}>
              <button className="vrm-icon-control" type="button" onPointerDown={stop} onClick={() => call('resetView')} title="Voir toute la pièce" style={btn} aria-label="Voir toute la pièce"><Icon name="home" size={18}/></button>
              <button className="vrm-icon-control" type="button" onPointerDown={stop} onClick={() => call('topView')} title="Vue de dessus (plan)" style={btn} aria-label="Vue de dessus"><Icon name="grid" size={18}/></button>
              {enDessus && <button type="button" data-revenir-3d="" onPointerDown={stop} onClick={() => { call('revenir3D'); setEnDessus(false); }} title="Revenir à la vue en 3D" style={{ ...btn, width: 'auto', padding: '0 11px', gap: 6, fontSize: 12.5, fontWeight: 700 }} aria-label="Revenir à la vue en 3D">↩ 3D</button>}
              {sel && <button type="button" onPointerDown={stop} onClick={() => call('flyTo', sel)} title="Se mettre en face du meuble" style={{ ...btn, width: 'auto', padding: '0 11px', gap: 6, fontSize: 12.5, fontWeight: 700 }} aria-label="Se mettre en face du meuble"><Icon name="eye" size={16}/> De face</button>}
            </div>
            <div style={{ display: 'flex', gap: 6, pointerEvents: 'auto', marginLeft: 'auto' }}>
              <button className="vrm-icon-control" type="button" onPointerDown={stop} onClick={() => call('rotateView', -22)} title="Tourner à gauche" style={btn} aria-label="Tourner la vue à gauche">◀</button>
              <button className="vrm-icon-control" type="button" onPointerDown={stop} onClick={() => call('zoomView', 0.85)} title="Zoom avant" style={btn} aria-label="Zoom avant">＋</button>
              <button className="vrm-icon-control" type="button" onPointerDown={stop} onClick={() => call('zoomView', 1.18)} title="Zoom arrière" style={btn} aria-label="Zoom arrière">−</button>
              <button className="vrm-icon-control" type="button" onPointerDown={stop} onClick={() => call('rotateView', 22)} title="Tourner à droite" style={btn} aria-label="Tourner la vue à droite">▶</button>
            </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}
// Vue en perspective « on entre dans la pièce ». Vraie projection : largeur,
// hauteur ET espacement en profondeur passent tous par le MÊME facteur S/Z
// (distance) → les proportions sont justes (un meuble proche est grand, un
// meuble au fond petit, dans le bon rapport). Viewport mesuré pour du px exact.
function RoomPerspective({ items, room, hi, sel, onOpen, colorOf, emojiOf, h3dOf, storedCount, C }) {
  const ref = React.useRef(null);
  const [cw, setCw] = useState(360);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const measure = () => setCw(el.clientWidth || 360); measure();
    let ro; try { ro = new ResizeObserver(measure); ro.observe(el); } catch (_) { window.addEventListener('resize', measure); }
    return () => { try { ro && ro.disconnect(); } catch (_) {} window.removeEventListener('resize', measure); };
  }, []);
  const ch = Math.min(440, Math.max(240, cw * 0.64));
  const Znear = 0.9, HSCALE = 2.6;                  // HSCALE : h3d (0.5–1.8) → cellules de hauteur
  const kx = 0.96 * Znear / room.w, S = kx * cw;    // S/Z = pixels par unité-monde à la profondeur Z
  const horizonPx = ch * 0.14;
  const camEye = (ch * 0.72) * Znear / S;           // hauteur caméra → sol proche à ~0.86·hauteur
  const Zof = (gyFrac) => Znear + (1 - gyFrac) * room.h;
  const floorY = (Z) => horizonPx + camEye * S / Z;
  const halfW = room.w / 2, Zfar = Zof(0);
  const flx = (Z) => cw / 2 - halfW * S / Z, frx = (Z) => cw / 2 + halfW * S / Z;
  const farY = floorY(Zfar), nearY = floorY(Znear);
  const list = [...items].sort((a, b) => ((a.y + a.h / 2) / room.h) - ((b.y + b.h / 2) / room.h)); // fond → proche
  return (
    <div ref={ref} data-noswipe="1" style={{ position: 'relative', width: '100%', height: ch, borderRadius: 14, overflow: 'hidden', background: 'linear-gradient(180deg,#eef2f6 0%,#e4e9ef 46%,#d3dae2 100%)', border: `1px solid ${C.border}` }}>
      {/* mur du fond */}
      <div style={{ position: 'absolute', left: flx(Zfar), width: frx(Zfar) - flx(Zfar), top: 0, height: farY, background: 'linear-gradient(180deg,#dde3ea,#e9edf2)', borderBottom: '2px solid rgba(0,0,0,0.12)' }} />
      {/* sol en perspective */}
      <div style={{ position: 'absolute', inset: 0, clipPath: `polygon(${flx(Zfar)}px ${farY}px, ${frx(Zfar)}px ${farY}px, ${frx(Znear)}px ${nearY}px, ${flx(Znear)}px ${nearY}px)`, background: '#c9b79a' }} />
      {/* lignes de profondeur (repère visuel) */}
      {Array.from({ length: Math.max(2, Math.min(9, Math.round(room.h))) }).map((_, i, arr) => { const gy = 1 - (i + 1) / (arr.length + 1); const Z = Zof(gy); const y = floorY(Z); return <div key={i} style={{ position: 'absolute', left: flx(Z), width: frx(Z) - flx(Z), top: y, height: 1, background: 'rgba(0,0,0,0.06)' }} />; })}
      {items.length === 0 && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: 12.5, textAlign: 'center', padding: 20 }}>Ajoute des meubles en mode « ✏️ Éditer », puis reviens ici pour entrer dans ta pièce.</div>}
      {list.map(it => {
        const gyF = Math.min(1, (it.y + it.h) / room.h), Z = Zof(gyF);
        const Xc = (it.x + it.w / 2) - halfW;
        const baseX = cw / 2 + Xc * S / Z, baseY = floorY(Z);
        const wpx = Math.max(10, it.w * S / Z), hpx = Math.max(12, h3dOf(it) * HSCALE * S / Z);
        const isHi = hi && hi.itemId === it.id, isSel = sel === it.id, col = colorOf(it);
        return (
          <div key={it.id} onClick={() => onOpen(it.id)} style={{ position: 'absolute', left: baseX - wpx / 2, top: baseY - hpx, width: wpx, height: hpx, zIndex: Math.round(gyF * 100) + (isHi ? 300 : 0), cursor: 'pointer' }}>
            <div style={{ position: 'absolute', left: '7%', right: '7%', top: -Math.min(12, hpx * 0.16), height: Math.min(12, hpx * 0.16), background: col, filter: 'brightness(1.3)', transform: 'skewX(-34deg)', borderRadius: '3px 3px 0 0', opacity: 0.92 }} />
            <div style={{ width: '100%', height: '100%', background: `linear-gradient(180deg, ${col}, ${col} 62%, rgba(0,0,0,0.22))`, border: `2px solid ${isHi ? '#e5484d' : isSel ? '#fff' : 'rgba(0,0,0,0.28)'}`, borderRadius: 3, boxShadow: isHi ? '0 0 0 4px rgba(229,72,77,0.4)' : '0 5px 10px rgba(0,0,0,0.28)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', overflow: 'hidden' }}>
              <span style={{ fontSize: Math.max(11, Math.min(26, hpx * 0.42)), lineHeight: 1 }}>{emojiOf(it)}</span>
              {hpx > 40 && <span style={{ fontSize: 9, fontWeight: 800, textShadow: '0 1px 2px rgba(0,0,0,0.6)', maxWidth: '96%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</span>}
              {storedCount(it) > 0 && <span style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.55)', borderRadius: 999, fontSize: 9, fontWeight: 900, padding: '1px 5px' }}>{storedCount(it)}</span>}
            </div>
            {isHi && <div style={{ position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)', background: '#e5484d', color: '#fff', fontSize: 10, fontWeight: 900, padding: '1px 7px', borderRadius: 999, whiteSpace: 'nowrap', zIndex: 400 }}>ici 📍</div>}
          </div>
        );
      })}
      <span style={{ position: 'absolute', left: 8, bottom: 6, fontSize: 9.5, color: 'rgba(0,0,0,0.42)', fontWeight: 700 }}>👣 Vue depuis l'entrée · touche un meuble</span>
    </div>
  );
}

// Vue du dessus de SECOURS (sans WebGL) : la vraie forme de la pièce, chaque
// meuble à sa place et à sa taille, son nom et le nombre de paires qu'il porte.
// Toucher un meuble l'ouvre, comme en 3D. Lecture seule : on ne déplace rien
// ici (« Aménager la pièce » a son propre plan).
function PlanSecours({ items, poly, hi, sel, cibles, onOpen, colorOf, emojiOf, storedCount, C, FURN_TYPES }) {
  const W = Math.max(...poly.map(q => q[0])), H = Math.max(...poly.map(q => q[1]));
  const marge = 0.4;
  const ciblesIds = new Set((cibles || []).map(c => c && c.itemId).filter(Boolean));
  return (
    <div data-noswipe="1" data-plan-secours="" style={{ position: 'relative', width: '100%', borderRadius: 14, overflow: 'hidden', border: `1px solid ${C.border}`, background: C.bg }}>
      <svg viewBox={`${-marge} ${-marge} ${W + marge * 2} ${H + marge * 2}`} style={{ display: 'block', width: '100%', maxHeight: 'min(52vh, 460px)', aspectRatio: `${W + marge * 2} / ${H + marge * 2}` }}>
        <polygon data-plan-secours-forme={poly.length} points={poly.map(q => q.join(',')).join(' ')} fill={C.card} stroke={C.text} strokeWidth="0.07" strokeLinejoin="round" />
        {items.map(it => {
          const ft = FURN_TYPES[it.type] || {};
          const odd = Math.abs(Math.round((it.rot || 0) / (Math.PI / 2))) % 2 === 1;
          const w = odd ? it.h : it.w, h = odd ? it.w : it.h, cx = it.x + it.w / 2, cy = it.y + it.h / 2;
          const cherche = (hi && hi.itemId === it.id) || ciblesIds.has(it.id), choisi = sel === it.id;
          const n = storedCount(it); const nom = String(it.name || ft.label || 'Meuble').slice(0, 16);
          const fs = Math.max(0.14, Math.min(0.3, h * 0.42, (w * 0.9) / Math.max(1, (nom.length + (n ? 4 : 0)) * 0.56)));
          return (
            <g key={it.id} data-plan-secours-meuble={it.id} onClick={() => onOpen && onOpen(it.id)} style={{ cursor: 'pointer' }}>
              <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx="0.05" fill={ft.deco ? C.card2 : colorOf(it)} fillOpacity={ft.deco ? 0.9 : 0.85}
                stroke={cherche ? C.accent : choisi ? C.text : 'rgba(0,0,0,0.35)'} strokeWidth={cherche || choisi ? 0.09 : 0.03} />
              {!ft.deco && w > 0.45 && <text x={cx} y={cy + fs * 0.36} textAnchor="middle" fontSize={fs} fontWeight="700" fill="#fff" style={{ pointerEvents: 'none', paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.5)', strokeWidth: 0.035 }}>{nom}{n ? ` (${n})` : ''}</text>}
            </g>
          );
        })}
      </svg>
      <span style={{ position: 'absolute', left: 8, bottom: 6, fontSize: 10, color: C.muted, fontWeight: 700 }}>Vue du dessus · touche un meuble</span>
    </div>
  );
}

export default Room3D;
