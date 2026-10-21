// ⚠️ FICHIER DÉCOUPÉ D'App.jsx (scripts/decouper-app.cjs) — chargé à la demande.
// Le code ci-dessous est celui d'App.jsx, sans changement ; ce qu'il lit d'App.jsx
// vient de l'import ci-dessous (liaisons vivantes : le thème `C` reste à jour).
import React, { useState, useMemo, useEffect } from "react";
import { polyDe, estRectangle, normaliserPoly, rectDans, empreinte, placerSansTraverser, modeCase, capaciteCase, empilerDansCase, retirerDeCase, retirerDePile, ajouterAPile, cartonsDePile, prochainePlaceMeuble, estPoseSur, FORMES, caler } from "../stockRegles.js";
import { Btn, C, COL_H, Card, DEMANDE_STOCK_CHERCHE, FURN_COLORS, FURN_TYPES, GARAGE_AMBIANCES, INV_STATUS, Icon, Input, LAYOUT, PhotoVinted, ROOM_DEFAULT, Room3D, ScreenHead, Segmente, SheetShell, askConfirm, askText, casesDe, clavierNum, cleNum, dimsMeuble, extractSize, libererNumeroDuPlan, load, loadRoomPlan, meubleACases, meublesDuPlan, nomCase, normTitle, normalizePlan, numsCase, numsPresents, ouEstNumero, premiereCaseLibre, rangerNumeroDansPlan, save, saveRoomPlan, toast, triNum } from "../App.jsx";


// ── RANGER UNE VRAIE PAIRE (feuille du garage 3D) ──────────────────────────
// Julien : « tu peux sélectionner lesquels tu ranges ici, la taille… vraiment
// tu peux tout faire avec l'application ». Avant, ranger une paire demandait de
// TAPER son numéro de mémoire : rien ne vérifiait qu'elle existe, ni qu'elle
// n'est pas déjà rangée ailleurs. On choisit désormais dans la liste de ses
// paires réellement présentes — photo, N°, titre, pointure.
// ⚠️ La saisie libre reste possible (une paire hors app, un carton de matériel),
// mais elle n'est plus le chemin par défaut.
// ── L'APERÇU DU MEUBLE OÙ L'ON RANGE (17 oct.) ─────────────────────────────
// Julien : « quand il met par exemple table et l'endroit où l'on peut mettre une
// paire à ranger, que ça fasse un petit carré sur le côté avec une vue du meuble
// ou de l'endroit où on range ». Un dessin vu de FACE, tiré des données du
// meuble (ses cases, ce qu'elles portent) — la case visée en couleur d'accent.
function ApercuMeuble({ it, cellKey, mode, cap, size = 132 }) {
  const nr = Math.max(1, it.rows || 1), nc = Math.max(1, it.cols || 1);
  const ft = FURN_TYPES[it.type] || {};
  const table = ft.build === 'table', portant = mode === 'cintre';
  const W = 120, H = table ? 80 : 120, pad = 8;
  const iw = W - pad * 2, ih = (table ? 30 : H - pad * 2);
  const cw = iw / nc, ch = table ? ih : ih / nr;
  const [rk, ck] = String(cellKey).split('_').map(Number);
  const cases = [];
  for (let r = 0; r < (table ? 1 : nr); r++) for (let c = 0; c < nc; c++) {
    const key = r + '_' + c; const a = numsCase((it.slots || {})[key]); const vise = r === rk && c === ck;
    const x = pad + c * cw, y = table ? pad + 6 : pad + r * ch;
    const n = Math.min(a.length, Math.max(1, cap || 1));
    cases.push(
      <g key={key}>
        <rect x={x + 1.5} y={y + 1.5} width={cw - 3} height={ch - 3} rx="2.5" fill={vise ? C.accent : 'transparent'} fillOpacity={vise ? 0.18 : 0} stroke={vise ? C.accent : C.border} strokeWidth={vise ? 2 : 1} strokeDasharray={a.length || vise ? '' : '3 2'} />
        {portant
          ? (a.length ? <text x={x + cw / 2} y={y + ch / 2 + 3} textAnchor="middle" fontSize="8.5" fontWeight="700" fill={C.text}>{a[0]}</text> : null)
          : Array.from({ length: n }, (_, i) => { const bh = Math.min(10, (ch - 6) / Math.max(1, cap || 1)); return <rect key={i} x={x + cw * 0.2} y={y + ch - 3 - (i + 1) * (bh + 1)} width={cw * 0.6} height={bh} rx="1.5" fill={C.muted} fillOpacity="0.45" />; })}
      </g>
    );
  }
  return (
    <svg data-apercu-meuble={it.id} data-apercu-case={cellKey} role="img" aria-label={`${it.name || ft.label || 'Meuble'} vu de face, la case où ranger en couleur`} viewBox={`0 0 ${W} ${H}`} width={size} height={size * H / W} style={{ flexShrink: 0, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10 }}>
      {portant && <line x1={pad} x2={W - pad} y1={pad + 4} y2={pad + 4} stroke={C.muted} strokeWidth="2" />}
      {table && <><rect x={pad} y={pad + 6 + ch} width={iw} height="5" rx="1.5" fill={C.muted} fillOpacity="0.7" /><rect x={pad + 4} y={pad + 11 + ch} width="4" height={H - pad - 11 - ch - 4} fill={C.muted} fillOpacity="0.55" /><rect x={W - pad - 8} y={pad + 11 + ch} width="4" height={H - pad - 11 - ch - 4} fill={C.muted} fillOpacity="0.55" /></>}
      {!table && !portant && <rect x={pad} y={pad} width={iw} height={ih} fill="none" stroke={C.muted} strokeOpacity="0.6" strokeWidth="1.5" rx="2" />}
      {cases}
    </svg>
  );
}

function RangerSheet({ paires, cellNom, onPick, onLibre, onClose, apercu }) {
  const [q, setQ] = React.useState('');
  const f = q.trim().toLowerCase();
  const liste = !f ? paires : paires.filter(p =>
    String(p.numero).includes(f) || (p.title || '').toLowerCase().includes(f) || String(p.taille || '').toLowerCase().includes(f));
  return (
    <SheetShell onClose={onClose}>
      <div style={{display:'flex',gap:12,alignItems:'flex-start',marginBottom:apercu?6:0}}>
        {apercu && <ApercuMeuble {...apercu} />}
        <div style={{flex:1,minWidth:0}}>
      <div className="vrm-display" style={{fontSize:19,fontWeight:700,color:C.text,marginBottom:2}}>Ranger un article</div>
      <div style={{fontSize:12,color:C.muted,marginBottom:12,lineHeight:1.45}}>
        {cellNom ? <>Case <b style={{color:C.text}}>{cellNom}</b> · </> : null}
        {paires.length} paire{paires.length>1?'s':''} pas encore rangée{paires.length>1?'s':''}
        {/* ⚠️ On ne fait pas semblant de savoir : quand l'écran Annonces n'a
            pas encore publié la liste des paires présentes, cette liste
            contient tout l'historique. On l'écrit, et on met les plus
            récentes en tête plutôt que de trier par numéro. */}
        {paires.length > 0 && !paires[0].sur && (
          <><br/><span style={{color:C.warn}}>Les plus récentes en tête — ouvre une fois l'écran Annonces pour n'avoir que tes paires en stock.</span></>
        )}
      </div>
        </div>
      </div>
      {paires.length > 6 && (
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="N°, marque, pointure…" inputMode="search"
          style={{width:'100%',boxSizing:'border-box',border:`1px solid ${C.border}`,borderRadius:10,padding:'10px 12px',fontSize:14,background:C.card,color:C.text,outline:'none',fontFamily:'inherit',marginBottom:10}}/>
      )}
      {liste.length === 0 && (
        <div style={{fontSize:12.5,color:C.muted,padding:'14px 2px',lineHeight:1.5}}>
          {paires.length === 0
            ? "Aucune paire en attente de rangement : tout ce que tu as en stock est déjà posé dans une case."
            : "Rien ne correspond à cette recherche."}
        </div>
      )}
      <div style={{display:'flex',flexDirection:'column',gap:7,maxHeight:'46vh',overflowY:'auto'}}>
        {liste.slice(0, 200).map(p => (
          <button type="button" key={p.numero} onClick={()=>onPick(p)}
            style={{display:'flex',alignItems:'center',gap:11,textAlign:'left',border:`1px solid ${C.border}`,borderRadius:10,background:C.card,padding:'9px 11px',cursor:'pointer',fontFamily:'inherit',boxShadow:C.shadow}}>
            {p.photo
              ? <PhotoVinted src={p.photo} alt="" style={{width:44,height:44,borderRadius:8,objectFit:'cover',flexShrink:0,background:C.card2}}/>
              : <span style={{width:44,height:44,borderRadius:8,background:C.card2,display:'flex',alignItems:'center',justifyContent:'center',fontSize:19,flexShrink:0}}><Icon name="image" size={20} style={{color:C.muted,opacity:.55}}/></span>}
            <span style={{flex:'1 1 120px',minWidth:0}}>
              <span className="vrm-display" style={{display:'block',fontSize:15,fontWeight:700,color:C.accent}}>N°{p.numero}</span>
              <span style={{display:'block',fontSize:12,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.title || '—'}</span>
              {p.taille ? <span className="vrm-label" style={{color:C.muted}}>Pointure {p.taille}</span> : null}
            </span>
            <span style={{flexShrink:0,color:C.muted}}><Icon name="home" size={17}/></span>
          </button>
        ))}
      </div>
      <div style={{display:'flex',gap:8,marginTop:12}}>
        <button type="button" onClick={onLibre} style={{flex:1,padding:'10px 12px',borderRadius:10,border:`1px solid ${C.border}`,background:'transparent',color:C.text,fontSize:12.5,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Autre numéro…</button>
        <button type="button" onClick={onClose} style={{flex:1,padding:'10px 12px',borderRadius:10,border:'none',background:C.card2,color:C.muted,fontSize:12.5,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Annuler</button>
      </div>
    </SheetShell>
  );
}

/* ── Box & Door ──────────────────────────────────────── */
const Box = React.memo(function Box({val,isSold,highlight}) {
  const W=46,H=26,SW=6,TH=5;
  const hasVal=val&&val.trim()!=='';
  // Cases vides : rendu ultra simple, pas de SVG complexe
  if(!hasVal&&!highlight){
    return (
      <svg width={W+SW} height={H+TH} style={{display:'block'}}>
        <rect x={0} y={TH} width={W} height={H} rx={2} fill="#2e2e2e"/>
      </svg>
    );
  }
  let front,side,top,textCol;
  if(isSold)      {front='#8a1a2a';side='#5a0e1a';top='#aa2535';textCol='#ffaaaa';}
  else if(hasVal) {front='#b07830';side='#7a5218';top='#d09040';textCol='#2a1200';}
  else            {front='#2e2e2e';side='#1e1e1e';top='#3a3a3a';textCol='transparent';}
  return (
    <svg width={W+SW} height={H+TH} style={{display:'block',overflow:'visible',
      filter:highlight?'drop-shadow(0 0 8px #ffb830) drop-shadow(0 0 16px #ffb830) brightness(1.5)':'none'}}>
      {highlight&&<rect x={-2} y={TH-2} width={W+4} height={H+4} rx={3} fill="none" stroke="#ffb830" strokeWidth="2.5"/>}      <polygon points={`0,${TH} ${SW},0 ${W+SW},0 ${W},${TH}`} fill={top} stroke="#111" strokeWidth="0.6"/>
      <rect x={0} y={TH} width={W} height={H} rx={2} fill={front} stroke="#111" strokeWidth="0.6"/>
      <polygon points={`${W},${TH} ${W+SW},0 ${W+SW},${H} ${W},${H+TH}`} fill={side} stroke="#111" strokeWidth="0.6"/>
      {hasVal&&<rect x={8} y={TH+H/2-2} width={W-16} height={4} rx={1} fill={side} opacity="0.6"/>}
      {hasVal&&<text x={W/2} y={TH+H/2+4} textAnchor="middle" fill={textCol} fontSize={8} fontWeight="800" fontFamily="monospace">{val.trim()}</text>}
    </svg>
  );
});

// ── LA PIÈCE VUE DU DESSUS (17 oct.) ────────────────────────────────────────
// Julien : « je veux avoir la possibilité quand on crée la pièce de la créer avec
// une vue du dessus… on doit pouvoir faire la forme que l'on veut à notre
// entrepôt, chambre ». Un plan d'architecte : on tire les COINS (calés tous les
// 25 cm), on en ajoute au milieu d'un mur (+), on en retire un ; on glisse un
// meuble. Rien ne s'écrit pendant le geste — seulement au lâcher, et la règle
// (src/stockRegles.js) refuse une forme qui se recoupe ou un meuble qui sortirait.
function PlanDessus({ room, poly, items, sel, onSelect, onPoly, onMove, cibles }) {
  const svgRef = React.useRef(null);
  const [edit, setEdit] = React.useState(null);        // { type:'coin'|'meuble', i|id, pts|pos }
  const [coinSel, setCoinSel] = React.useState(null);
  const W = Math.max(...poly.map(q => q[0])), H = Math.max(...poly.map(q => q[1]));
  const marge = 0.6;
  const vb = `${-marge} ${-marge} ${W + marge * 2} ${H + marge * 2}`;
  const pts = edit && edit.type === 'coin' ? edit.pts : poly;
  const versPlan = (e) => {
    const svg = svgRef.current; if (!svg) return null;
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const m = svg.getScreenCTM(); if (!m) return null;
    const p = pt.matrixTransform(m.inverse()); return [p.x, p.y];
  };
  const finir = () => {
    const ed = edit; setEdit(null);
    if (!ed || !ed.bouge) return;
    if (ed.type === 'coin') onPoly(ed.pts);
    else if (ed.type === 'meuble' && ed.pos) onMove(ed.id, ed.pos[0], ed.pos[1]);
  };
  const deplacer = (e) => {
    if (!edit) return; const p = versPlan(e); if (!p) return;
    if (edit.type === 'coin') {
      const np = edit.pts.slice(); np[edit.i] = [caler(Math.max(-3, Math.min(W + 3, p[0]))), caler(Math.max(-3, Math.min(H + 3, p[1])))];
      setEdit({ ...edit, pts: np, bouge: true });
    } else {
      const it = items.find(o => o.id === edit.id); if (!it) return;
      setEdit({ ...edit, pos: [caler(p[0] - edit.off[0]), caler(p[1] - edit.off[1])], bouge: true });
    }
    if (e.cancelable) e.preventDefault();
  };
  const formes = [['rectangle', 'Rectangle'], ['L', 'En L'], ['U', 'En U'], ['T', 'En T']];
  const ciblesIds = new Set((cibles || []).map(c => c.itemId));
  const bouton = { border: `1px solid ${C.border}`, borderRadius: 8, background: C.card, color: C.text, fontSize: 12.5, fontWeight: 600, padding: '0 11px', minHeight: 34, cursor: 'pointer', fontFamily: 'inherit' };
  return (
    <div data-plan-dessus="" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12.5, fontWeight: 650, color: C.text, marginRight: 4 }}>Vue du dessus</span>
        {formes.map(([k, l]) => <button key={k} type="button" data-forme={k} onClick={() => onPoly(FORMES[k](W, H))} style={bouton}>{l}</button>)}
        {coinSel != null && poly.length > 3 && <button type="button" data-coin-retirer="" onClick={() => { const np = poly.filter((_, i) => i !== coinSel); setCoinSel(null); onPoly(np); }} style={{ ...bouton, color: C.warn }}>Retirer ce coin</button>}
      </div>
      <svg ref={svgRef} viewBox={vb} data-plan-svg="" style={{ width: '100%', maxHeight: 360, aspectRatio: `${W + marge * 2} / ${H + marge * 2}`, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, touchAction: 'none', userSelect: 'none' }}
        onPointerMove={deplacer} onPointerUp={finir} onPointerLeave={finir} onPointerCancel={finir}>
        {/* grille au mètre */}
        {Array.from({ length: Math.floor(W) + 1 }, (_, i) => <line key={'gx' + i} x1={i} x2={i} y1={0} y2={H} stroke={C.border} strokeWidth="0.01" />)}
        {Array.from({ length: Math.floor(H) + 1 }, (_, i) => <line key={'gy' + i} x1={0} x2={W} y1={i} y2={i} stroke={C.border} strokeWidth="0.01" />)}
        <polygon data-plan-forme="" points={pts.map(q => q.join(',')).join(' ')} fill={C.card} stroke={C.text} strokeWidth="0.08" strokeLinejoin="round" />
        {/* les meubles */}
        {items.map(it => {
          const ft = FURN_TYPES[it.type] || {};
          const pos = edit && edit.type === 'meuble' && edit.id === it.id && edit.pos ? edit.pos : [it.x, it.y];
          const odd = Math.abs(Math.round((it.rot || 0) / (Math.PI / 2))) % 2 === 1;
          const w = odd ? it.h : it.w, h = odd ? it.w : it.h, cx = pos[0] + it.w / 2, cy = pos[1] + it.h / 2;
          const choisi = sel === it.id, cible = ciblesIds.has(it.id);
          return (
            <g key={it.id} data-plan-meuble={it.id} style={{ cursor: 'grab' }}
              onPointerDown={(e) => { e.stopPropagation(); onSelect(it.id); const p = versPlan(e); if (!p) return; try { e.currentTarget.ownerSVGElement.setPointerCapture(e.pointerId); } catch (_) {} setEdit({ type: 'meuble', id: it.id, off: [p[0] - it.x, p[1] - it.y], pos: null }); }}>
              <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx="0.06"
                fill={ft.deco ? C.card2 : (it.color || ft.color || '#999')} fillOpacity={ft.deco ? 0.9 : 0.85}
                stroke={cible ? C.accent : choisi ? C.text : 'rgba(0,0,0,0.35)'} strokeWidth={cible || choisi ? 0.09 : 0.03} />
              {w > 0.7 && (() => { const nom = String(it.name || ft.label || '').slice(0, 18); const fs = Math.min(0.32, h * 0.6, (w * 0.92) / Math.max(1, nom.length * 0.56)); return <text x={cx} y={cy + fs * 0.36} textAnchor="middle" fontSize={fs} fontWeight="700" fill="#fff" style={{ pointerEvents: 'none', paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.45)', strokeWidth: 0.04 }}>{nom}</text>; })()}
            </g>
          );
        })}
        {/* « + » au milieu de chaque mur : ajouter un coin */}
        {!edit && pts.map((a, i) => { const b = pts[(i + 1) % pts.length]; const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2; if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.8) return null;
          return <g key={'m' + i} data-coin-ajouter={i} style={{ cursor: 'copy' }} onPointerDown={(e) => { e.stopPropagation(); const np = pts.slice(); np.splice(i + 1, 0, [caler(mx), caler(my)]); setCoinSel(i + 1); onPoly(np); }}>
            <circle cx={mx} cy={my} r="0.2" fill={C.card} stroke={C.muted} strokeWidth="0.04" /><text x={mx} y={my + 0.1} textAnchor="middle" fontSize="0.3" fill={C.muted} style={{ pointerEvents: 'none' }}>+</text></g>; })}
        {/* les coins : on les tire */}
        {pts.map((q, i) => (
          <circle key={'c' + i} data-coin={i} cx={q[0]} cy={q[1]} r={coinSel === i ? 0.24 : 0.19} fill={coinSel === i ? C.accent : C.text} stroke={C.card} strokeWidth="0.05" style={{ cursor: 'move' }}
            onPointerDown={(e) => { e.stopPropagation(); setCoinSel(i); try { e.currentTarget.ownerSVGElement.setPointerCapture(e.pointerId); } catch (_) {} setEdit({ type: 'coin', i, pts: pts.slice() }); }} />
        ))}
        {/* les cotes du mur */}
        {pts.map((a, i) => { const b = pts[(i + 1) % pts.length]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1) return null;
          // La cote se pose DEHORS, au tiers du mur : ni sur le « + » du milieu, ni dans la pièce.
          let nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L; const tx = a[0] + (b[0] - a[0]) / 3, ty = a[1] + (b[1] - a[1]) / 3;
          const dedans = (x, y) => { let d = false; for (let k = 0, j = pts.length - 1; k < pts.length; j = k++) { const [xi, yi] = pts[k], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d; } return d; };
          if (dedans(tx + nx * 0.1, ty + ny * 0.1)) { nx = -nx; ny = -ny; }
          return <text key={'l' + i} x={tx + nx * 0.34} y={ty + ny * 0.34 + 0.09} textAnchor="middle" fontSize="0.26" fill={C.muted} style={{ pointerEvents: 'none' }}>{(Math.round(L * 100) / 100).toLocaleString('fr-FR')} m</text>; })}
      </svg>
      <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.45 }}>Tire un coin pour donner sa forme à la pièce, « + » au milieu d'un mur pour en ajouter un. Glisse un meuble pour le placer : il ne traverse ni un mur ni un autre meuble.</div>
    </div>
  );
}

function RoomPlan({ locate, onLocateConsumed, mode = '3d', onAssistant }) {
  const [plan, setPlan] = useState(() => normalizePlan(load('vrm_room_plan', null)));
  // Le plan du nuage a-t-il été relu ? undefined = en cours · false = la base
  // n'a pas répondu · true = lu (même vide). L'assistant 2D attend `true`.
  const [planLu, setPlanLu] = useState(undefined);
  const [sel, setSel] = useState(null);
  const [openItem, setOpenItem] = useState(null);
  const [search, setSearch] = useState('');
  const [hi, setHi] = useState(null); // { itemId, cell } | { notFound:true }
  const [moveMode, setMoveMode] = useState(false); // meubles déplaçables SEULEMENT si activé
  const roomRef = React.useRef(null);
  const drag = React.useRef(null);

  useEffect(() => { (async () => { const cloud = await loadRoomPlan(); if (cloud === undefined) { setPlanLu(false); return; } if (cloud && (Array.isArray(cloud.items) || Array.isArray(cloud.rooms))) { const np = normalizePlan(cloud); setPlan(np); save('vrm_room_plan', np); } setPlanLu(true); })(); }, []);
  // Écriture locale immédiate (fluide au drag) ; envoi cloud DÉBOUNCÉ (800 ms
  // après le dernier changement) → un glissement = un seul upload, pas 50.
  const saveTimer = React.useRef(null);
  const persist = (next) => {
    setPlan(next); save('vrm_room_plan', next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveRoomPlan(next), 800);
  };
  const activeRoom = plan.rooms.find(r => r.id === plan.active) || plan.rooms[0];
  const items = activeRoom.items || [];
  const room = activeRoom.room || ROOM_DEFAULT;
  // (17 oct.) LA FORME DE LA PIÈCE et ce qui ne se traverse pas (src/stockRegles.js).
  const poly = polyDe(room);
  // Ce qui occupe le SOL : on ne pose rien à travers. Un tapis se marche dessus,
  // un cadre et une fenêtre sont au mur ; ce qui est posé SUR un meuble n'est pas au sol.
  const occupeLeSol = (o) => { const ft = FURN_TYPES[o.type] || {}; return !['tapis', 'cadre', 'fenetre'].includes(ft.build) && !(Number(o.lift) > 0); };
  const obstaclesPour = (list, ...ids) => list.filter(o => !ids.includes(o.id) && occupeLeSol(o)).map(empreinte);
  // Une place libre pour `it` près de (cx, cy) — ou null s'il n'y en a pas.
  const placeLibre = (list, it, cx, cy) => { const ef = empreinte(it); return placerSansTraverser(cx != null ? cx : ef.cx, cy != null ? cy : ef.cy, ef.w, ef.h, obstaclesPour(list, it.id), poly); };
  // Après une modification de la DISPOSITION, la 3D passe en vue du dessus pour
  // qu'on la relise (Julien : « une petite animation à une vue 2D du dessus »).
  const [dispo, setDispo] = useState(0);
  const signalerDisposition = () => setDispo(Date.now());
  // Modifie la pièce active (patch = objet fusionné, ou fonction (room)=>patch).
  const patchRoom = (patch) => persist({ ...plan, rooms: plan.rooms.map(r => r.id === activeRoom.id ? { ...r, ...(typeof patch === 'function' ? patch(r) : patch) } : r) });
  const setItems = (updater) => patchRoom(r => ({ items: typeof updater === 'function' ? updater(r.items || []) : updater }));

  // ── Gestion des pièces ──
  const addRoom = () => {
    const id = 'r' + Date.now(); const name = 'Pièce ' + (plan.rooms.length + 1);
    persist({ ...plan, rooms: [...plan.rooms, { id, name, room: { ...ROOM_DEFAULT }, items: [] }], active: id });
    setSel(null); setOpenItem(null); setHi(null); setSearch('');
  };
  const switchRoom = (id) => { if (id === plan.active) return; persist({ ...plan, active: id }); setSel(null); setOpenItem(null); setHi(null); setSearch(''); };
  const renameRoom = async () => { const n = await askText({ desc: 'Nom de la pièce :', value: activeRoom.name }); if (n != null && n.trim()) patchRoom({ name: n.trim() }); };
  const removeRoom = async ()=>{
    if (plan.rooms.length <= 1) { toast('Il faut garder au moins une pièce.'); return; }
    if (!await askConfirm('Supprimer la pièce « ' + activeRoom.name + ' » et tout son contenu ?')) return;
    const rooms = plan.rooms.filter(r => r.id !== activeRoom.id);
    persist({ ...plan, rooms, active: rooms[0].id }); setSel(null); setOpenItem(null); setHi(null); setSearch('');
  };

  // Pas de la grille-sol pour poser/empiler les boîtes (0,5 m).
  const BOX_S = 0.5;
  const addFurn = async (type) => {
    const t = FURN_TYPES[type]; const id = 'f' + Date.now();
    let name = t.label, emoji = t.emoji;
    // PILE DE BOÎTES : on demande juste COMBIEN de boîtes ; elles s'empilent et se
    // numérotent toutes seules. L'utilisateur déplace ensuite la pile où il veut.
    if (t.pile) {
      const colsStr = await askText({ numeric: true, desc: 'Combien de COLONNES (piles côte à côte) ?', value: '1' });
      if (colsStr == null) return;
      const cols = Math.max(1, Math.min(12, parseInt(colsStr, 10) || 1));
      const rowsStr = await askText({ numeric: true, desc: 'Combien de boîtes de HAUT (par colonne) ?', value: '5' });
      if (rowsStr == null) return;
      const rows = Math.max(1, Math.min(40, parseInt(rowsStr, 10) || 5));
      // Numéro de départ proposé = à la suite des piles déjà posées (jamais de doublon).
      let mx = 0; items.forEach(o => { if ((FURN_TYPES[o.type] || {}).pile) { const c = Math.max(1, o.cols || 1) * Math.max(1, o.rows || 1); const last = (parseInt(o.start, 10) || 1) + c - 1; if (last > mx) mx = last; } });
      const startStr = await askText({ numeric: true, desc: 'Numéro de la 1re boîte (en bas de la 1re colonne) ?', value: String(mx + 1) });
      if (startStr == null) return;
      const start = Math.max(1, parseInt(startStr, 10) || (mx + 1));
      const cell = t.cell, w = +(cols * cell).toFixed(2);
      let pasDePlace = false;
      setItems(list => {
        const n = list.length, gx = 0.7 + (n % 5) * 1.1, gy = 0.7 + (Math.floor(n / 5) % 5) * 1.1;
        const neuf = { id, type, name, emoji, color: t.color, h3d: t.h3d, cell, cols, rows, start, x: Math.min(room.w - w, gx), y: Math.min(room.h - cell, gy), w, h: cell, slots: {} };
        const pl = placeLibre(list, neuf);
        if (!pl) { pasDePlace = true; return list; }
        neuf.x = +(pl.cx - w / 2).toFixed(2); neuf.y = +(pl.cy - cell / 2).toFixed(2);
        return [...list, neuf];
      });
      if (pasDePlace) { toast('Plus de place libre au sol pour ces boîtes.'); return; }
      setSel(id); signalerDisposition(); return;
    }
    // BOÎTE à empiler : on demande le numéro et on la pose (sur le sol) à un
    // endroit libre ; l'utilisateur l'empile ensuite en la glissant sur une autre.
    if (t.box) {
      let mx = 0; items.forEach(o => { if ((FURN_TYPES[o.type] || {}).box) { const v = parseInt(o.num, 10); if (!isNaN(v) && v > mx) mx = v; } });
      const num = (await askText({ numeric: clavierNum() === 'numeric', desc: 'Numéro de la boîte :', value: mx > 0 ? String(mx + 1) : '' }) || '').trim();
      if (!num) return;
      setItems(list => {
        // pose sur une colonne au sol pas encore occupée (empilage ensuite à la main)
        const used = new Set(list.filter(o => (FURN_TYPES[o.type] || {}).box).map(o => Math.round(o.x / BOX_S) + ',' + Math.round(o.y / BOX_S)));
        let gx = 1, gy = 1;
        for (let k = 0; k < 400; k++) { const cc = Math.round(gx / BOX_S) + ',' + Math.round(gy / BOX_S); if (!used.has(cc)) break; gx += BOX_S; if (gx > room.w - BOX_S) { gx = 1; gy += BOX_S; } }
        return [...list, { id, type, name, emoji, num, color: t.color, h3d: t.h3d, x: Math.min(room.w - t.w, gx), y: Math.min(room.h - t.h, gy), w: t.w, h: t.h, lvl: 0, slots: {} }];
      });
      setSel(id); return;
    }
    if (type === 'autre') {
      const n = (await askText({ desc: 'Nom de ton meuble (ex : Armoire, Bac à chaussures) :', value: '' }) || '').trim();
      if (n) name = n;
      const e = (await askText({ desc: 'Un emoji pour le représenter (facultatif) :', value: '🪑' }) || '').trim();
      if (e) emoji = e;
    }
    // (19 oct.) Julien : « choisir le nombre d'étagères, les numéros par ligne ».
    // Une étagère se dit dès l'ajout : combien de niveaux, combien de cases par
    // niveau (réglables ensuite dans « Aménager »). Annuler garde le modèle.
    let nivChoisi = null, casesChoisies = null;
    if (t.cases && t.build === 'metal') {
      const nv = await askText({ numeric: true, desc: 'Combien de niveaux (plateaux) sur cette étagère ?', value: String(t.rows) });
      if (nv == null) return;
      nivChoisi = Math.max(1, Math.min(10, parseInt(nv, 10) || t.rows));
      const cs = await askText({ numeric: true, desc: 'Combien de cases par niveau (paires côte à côte) ?', value: String(t.cols) });
      if (cs == null) return;
      casesChoisies = Math.max(1, Math.min(16, parseInt(cs, 10) || t.cols));
    }
    // Pour une grille, le footprint (w/h) découle de la taille de case × nb de cases,
    // et la HAUTEUR par défaut monte jusqu'au plafond (empilage réaliste).
    const cell = t.cell;
    let w = cell ? +(t.cols * cell).toFixed(2) : t.w; const h = cell ? cell : t.h;
    let rows = cell ? Math.max(3, Math.floor((room.wallH || 3.4) / cell)) : t.rows;
    let colsN = t.cols, h3dN = t.h3d;
    if (nivChoisi != null) {
      // Même règle que « Niveaux » et « Cases par plateau » (changerCases) : un
      // niveau garde sa hauteur (celle du modèle), 60 cm par case en largeur.
      const niveau = (t.h3d * 1.5) / Math.max(1, t.rows);
      rows = nivChoisi; colsN = casesChoisies;
      h3dN = +(rows * niveau / 1.5).toFixed(3);
      w = Math.max(0.6, +(colsN * 0.6).toFixed(2));
    }
    let pasDePlace = false;
    setItems(list => {
      // On répartit chaque nouveau meuble sur une petite grille pour qu'il
      // n'apparaisse PAS empilé au même endroit (sinon il semble « disparaître »
      // derrière un meuble déjà là — c'était le cas de la porte).
      // (17 oct.) Et il ne se pose JAMAIS en travers d'un autre ni hors de la
      // pièce : on cherche la place libre la plus proche (src/stockRegles.js).
      const n = list.length, gx = 0.6 + (n % 4) * 1.5, gy = 0.6 + (Math.floor(n / 4) % 4) * 1.5;
      let x = Math.max(0, Math.min(room.w - w, +gx.toFixed(1))), y = Math.max(0, Math.min(room.h - h, +gy.toFixed(1)));
      const neuf = { id, type, name, emoji, color: t.color, h3d: h3dN, cell, x, y, w, h, rows, cols: colsN, slots: {} };
      if (!t.deco || t.structure) {
        const pl = placeLibre(list, neuf);
        if (!pl) { pasDePlace = true; return list; }
        neuf.x = +(pl.cx - w / 2).toFixed(2); neuf.y = +(pl.cy - h / 2).toFixed(2);
      }
      return [...list, neuf];
    });
    if (pasDePlace) { toast('Plus de place libre dans la pièce pour ce meuble — agrandis la pièce ou déplace un meuble.'); return; }
    setSel(id); signalerDisposition();
  };
  // Contrôles de la GRILLE personnalisable : nb de colonnes, de rangées, taille
  // des cases. Le footprint (w/h) reste synchronisé pour que le glisser colle.
  const gridSet = (it, patch) => {
    const cols = patch.cols != null ? patch.cols : (it.cols || 4);
    const cell = patch.cell != null ? patch.cell : (it.cell || 0.5);
    updateItem(it.id, { ...patch, w: +(cols * cell).toFixed(2), h: cell });
  };
  const gridCols = (it, d) => gridSet(it, { cols: Math.max(1, Math.min(16, (it.cols || 4) + d)) });
  const gridRows = (it, d) => gridSet(it, { rows: Math.max(1, Math.min(40, (it.rows || 3) + d)) });
  const gridCell = (it, d) => gridSet(it, { cell: Math.max(0.28, Math.min(1.2, +(((it.cell || 0.5) + d)).toFixed(2))) });
  // Pile : liste de numéros (nums, remplie colonne par colonne, bas→haut). Retirer
  // un numéro décale toute la suite → les boîtes du dessus DESCENDENT.
  const pileNums = (it) => (Array.isArray(it.nums) && it.nums.length) ? it.nums : Array.from({ length: Math.max(1, it.cols || 1) * Math.max(1, it.rows || 5) }, (_, i) => String((parseInt(it.start, 10) || 1) + i));
  const pileSet = (it, nums) => { const rows = Math.max(1, it.rows || 5); const cols = Math.max(1, Math.ceil(nums.length / rows)); updateItem(it.id, { nums, cols, w: +(cols * (it.cell || 0.5)).toFixed(2) }); };
  // Changer la hauteur RE-EMPILE les colonnes : c'est un rangement voulu, les
  // places vides ('') disparaissent.
  const pileHeight = (it, d) => { const rows = Math.max(1, Math.min(40, (it.rows || 5) + d)); const nums = cartonsDePile(pileNums(it)); const cols = Math.max(1, Math.ceil(nums.length / rows)); updateItem(it.id, { rows, cols, nums, w: +(cols * (it.cell || 0.5)).toFixed(2) }); };
  const pileAdd = async (it) => { const nums = pileNums(it).slice(); const nextN = nums.reduce((m, v) => { const n = parseInt(v, 10); return isNaN(n) ? m : Math.max(m, n); }, 0) + 1; const v = await askText({ numeric: true, desc: 'Numéro de la nouvelle boîte (au-dessus) :', value: String(nextN) }); if (v == null) return; const t = String(v).trim(); if (!t) return; const n2 = ajouterAPile(nums, t); if (n2) pileSet(it, n2); };
  const pileRemoveLast = (it) => { const nums = pileNums(it).slice(); if (cartonsDePile(nums).length <= 1) return; while (nums.length && !String(nums[nums.length - 1] || '').trim()) nums.pop(); nums.pop(); while (nums.length && !String(nums[nums.length - 1] || '').trim()) nums.pop(); pileSet(it, nums); };
  const pileRestart = async (it) => { const s = await askText({ numeric: true, desc: 'Renuméroter toute la pile à partir de (dans l\'ordre) :', value: String(it.start || (cartonsDePile(pileNums(it))[0]) || 1) }); if (s == null) return; const st = parseInt(s, 10); if (isNaN(st)) return; let k = 0; const nums = pileNums(it).map((v) => String(v || '').trim() ? String(st + k++) : ''); updateItem(it.id, { nums, start: st }); };
  // Toucher une boîte de la pile (pile déjà sélectionnée) → changer SON numéro
  // (on peut mettre n'importe quel numéro, pas forcément dans l'ordre), ou la
  // retirer si on laisse vide (les boîtes du dessus descendent).
  const pileTap = async (itemId, idx) => {
    // Une paire choisie dans « À ranger » se pose sur la pile d'un geste.
    if (pairePrete) { const it0 = items.find(o => o.id === itemId); if (it0) { setSel(itemId); const n = pairePrete; setPairePrete(null); ajouterDansPile(it0, n); } return; }
    if (sel !== itemId) { setSel(itemId); return; } // 1er tap : on sélectionne la pile
    const it = items.find(o => o.id === itemId); if (!it) return;
    const nums = pileNums(it).slice(); if (idx < 0 || idx >= nums.length) return;
    const v = await askText({ numeric: clavierNum() === 'numeric', desc: 'Numéro de cette boîte (laisse VIDE pour la retirer, les autres descendent) :', value: nums[idx] });
    if (v == null) return;
    const t = String(v).trim();
    // ⚠️ (17 oct.) Seuls les cartons du DESSUS, dans la MÊME colonne, descendent
    //    (`retirerDePile`) — avant, toute la pile se décalait d'un rang.
    if (!t) { const n2 = retirerDePile(nums, idx, Math.max(1, it.rows || 5)); if (n2) pileSet(it, n2); return; }
    nums[idx] = t; updateItem(itemId, { nums });
  };
  // Remplir la grille EN SÉRIE : un numéro de départ → toutes les cases vides se
  // remplissent en croissant (gauche→droite, haut→bas). Gain de temps énorme.
  const fillGridSeries = async (it) => {
    const start = await askText({ numeric: true, desc: 'Remplir en série — numéro de départ (les cases vides se remplissent en croissant) :', value: '' });
    if (start == null) return;
    let n = parseInt(String(start).trim(), 10);
    if (isNaN(n)) { toast('Entre un numéro (ex : 40).'); return; }
    const nr = Math.max(1, it.rows || 3), nc = Math.max(1, it.cols || 4);
    const slots = { ...(it.slots || {}) };
    // Empilage : on remplit chaque colonne du bas vers le haut, puis la suivante.
    for (let c = 0; c < nc; c++) for (let r = nr - 1; r >= 0; r--) { const key = r + '_' + c; if (!slots[key] || !slots[key].length) { slots[key] = [String(n)]; n++; } }
    updateItem(it.id, { slots });
  };
  const clearGrid = async (it)=>{ if (!await askConfirm('Vider toutes les cases de cette grille ?')) return; updateItem(it.id, { slots: {} }); };
  // Poser une boîte : on l'EMPILE à la prochaine place libre (bas→haut d'une
  // colonne jusqu'au plafond, puis colonne suivante). Si tout est plein, on
  // ajoute automatiquement une colonne. Toujours bien aligné, dans l'ordre.
  const addBoxToGrid = async (it) => {
    const nr = Math.max(1, it.rows || 3), nc = Math.max(1, it.cols || 4);
    let target = null;
    for (let c = 0; c < nc && !target; c++) for (let r = nr - 1; r >= 0 && !target; r--) { const k = r + '_' + c; if (!((it.slots && it.slots[k]) || []).length) target = k; }
    let patch = {};
    if (!target) { // toutes les colonnes pleines → nouvelle colonne à droite
      const newCols = nc + 1; target = (nr - 1) + '_' + nc;
      patch = { cols: newCols, w: +(newCols * (it.cell || 0.5)).toFixed(2) };
    }
    let mx = 0; for (const k in (it.slots || {})) { const v = parseInt(((it.slots[k] || [])[0]) || '', 10); if (!isNaN(v) && v > mx) mx = v; }
    const n = await askText({ numeric: clavierNum() === 'numeric', desc: 'Numéro de la boîte (elle s\'empile toute seule à la prochaine place, bien alignée) :', value: mx > 0 ? String(mx + 1) : '' });
    if (n == null) return; const v = String(n).trim(); if (!v) return;
    updateItem(it.id, { ...patch, slots: { ...(it.slots || {}), [target]: [v] } });
  };
  // Régler la hauteur de la grille pour EMPILER jusqu'au plafond de la pièce.
  const gridToCeiling = (it) => {
    const cell = it.cell || 0.5, rows = Math.max(1, Math.floor((room.wallH || 3.4) / cell));
    gridSet(it, { rows });
  };
  // « Coller au mur » : place le meuble à plat contre le prochain mur (N→E→S→O),
  // orienté face à la pièce. Un tap suffit (plus fiable que glisser sur mobile).
  const stickToWall = (it) => {
    const order = ['N', 'E', 'S', 'O'];
    const cur = order.indexOf(it.wall); const next = order[(cur + 1) % 4];
    const rotMap = { N: 0, S: Math.PI, O: Math.PI / 2, E: -Math.PI / 2 };
    const rot = rotMap[next], odd = next === 'E' || next === 'O';
    const effW = odd ? it.h : it.w, effH = odd ? it.w : it.h;
    const curCx = (it.x + it.w / 2) - room.w / 2, curCz = (it.y + it.h / 2) - room.h / 2;
    let cx = curCx, cz = curCz;
    if (next === 'N') cz = -room.h / 2 + effH / 2; else if (next === 'S') cz = room.h / 2 - effH / 2;
    else if (next === 'O') cx = -room.w / 2 + effW / 2; else cx = room.w / 2 - effW / 2;
    cx = Math.max(-room.w / 2 + effW / 2, Math.min(room.w / 2 - effW / 2, cx));
    cz = Math.max(-room.h / 2 + effH / 2, Math.min(room.h / 2 - effH / 2, cz));
    const x = Math.round((cx + room.w / 2 - it.w / 2) * 2) / 2, y = Math.round((cz + room.h / 2 - it.h / 2) * 2) / 2;
    updateItem(it.id, { x, y, rot, wall: next });
    signalerDisposition();
  };
  // Clic sur une grille en 3D. 1er tap = la SÉLECTIONNER (fait apparaître les
  // réglages : nb de boîtes en largeur/hauteur, taille…). Tap suivant sur une
  // case = y saisir / changer / effacer le N°. Ça évite le prompt intempestif
  // et rend les réglages faciles à trouver.
  // GRAVITÉ des numéros (comme la grille 2D) : dans chaque colonne, les boîtes
  // tombent en bas, sans trou. Une case vidée fait descendre la colonne au-dessus.
  const compactSlots = (slots, nr, nc) => {
    const out = {};
    for (let c = 0; c < nc; c++) {
      const vals = [];
      // ⚠️ TOUS les numéros d'une case (une ancienne case pouvait en porter
      //    plusieurs) : n'en garder que le premier en PERDAIT.
      for (let r = 0; r < nr; r++) { (slots[r + '_' + c] || []).forEach(v => { if (String(v).trim()) vals.push(String(v)); }); }
      let r = nr - 1;
      for (let i = vals.length - 1; i >= 0; i--) { out[r + '_' + c] = [vals[i]]; r--; }
    }
    return out;
  };
  const fillCell = async (itemId, cellKey, quoi) => {
    // (17 oct.) Une PLACE LIBRE se touche d'un seul geste (le meuble est choisi
    // au passage) ; une boîte déjà là demande d'abord de choisir le meuble (on ne
    // modifie pas un numéro par mégarde).
    const it = items.find(x => x.id === itemId); if (!it) return;
    const placeVide = quoi ? (quoi.ghost || quoi.num == null) : !numsCase((it.slots || {})[cellKey]).length;
    if (sel !== itemId) { setSel(itemId); if (!placeVide) return; }
    // (17 oct.) PLATEAU (étagère, table) ou PORTANT : on touche une BOÎTE précise
    // (la modifier, ou la sortir — celles du dessus descendent) ou la place
    // libre au-dessus de la pile (y ranger une paire).
    const cz = casesDe(it, room.wallH);
    if (cz.mode === 'pile' || cz.mode === 'cintre') {
      const pile = numsCase((it.slots || {})[cellKey]);
      if (quoi && quoi.num != null && !quoi.ghost) {
        const v = await askText({ numeric: clavierNum() === 'numeric', desc: `Numéro de cette boîte (laisse VIDE pour la sortir — celles du dessus descendent) :`, value: String(quoi.num) });
        if (v == null) return;
        const t = String(v).trim();
        if (!t) { sortirDeCase(itemId, cellKey, String(quoi.num)); return; }
        if (t === String(quoi.num)) return;
        const ou = dejaPoseOu(t);
        if (ou) { toast(`N°${t} déjà rangé dans « ${ou.meuble} »${ou.piece ? ` (${ou.piece})` : ''} — retire-le de là-bas d'abord.`); return; }
        const idx = pile.indexOf(String(quoi.num)); if (idx < 0) return;
        const neuve = pile.slice(); neuve[idx] = t;
        updateItem(itemId, { slots: { ...(it.slots || {}), [cellKey]: neuve } });
        return;
      }
      if (pile.length >= cz.cap) { toast(cz.mode === 'cintre' ? 'Ce cintre porte déjà un numéro.' : 'Cette case est pleine — choisis une autre case.'); return; }
      if (pairePrete) { rangerPaire(pairePrete, itemId, cellKey); return; }
      if (aRanger.length) { setRanger({ itemId, cellKey }); return; }
      poserDansCase(itemId, cellKey, await askText({ numeric: clavierNum() === 'numeric', desc: 'Numéro à ranger ici :', value: '' }));
      return;
    }
    const cur = ((it.slots || {})[cellKey] || [])[0] || '';
    // ⚠️ CASE VIDE → on CHOISIT une paire, on ne tape plus un numéro de mémoire.
    // Taper un numéro n'était vérifié par rien : une paire inexistante, ou déjà
    // rangée ailleurs, passait sans un mot. La feuille ne propose que des paires
    // réellement chez lui et pas encore posées.
    if (!cur && pairePrete) { rangerPaire(pairePrete, itemId, cellKey); return; }
    if (!cur && aRanger.length) { setRanger({ itemId, cellKey }); return; }
    poserDansCase(itemId, cellKey, await askText({ numeric: clavierNum() === 'numeric', desc: 'N° de la boîte (laisse vide pour effacer) :', value: cur }));
  };

  // Écrit le numéro dans la case (gravité + croissance de la grille) puis lance
  // l'animation de chute. Un seul chemin d'écriture, quel que soit le point
  // d'entrée : la feuille de choix, la saisie libre, ou l'effacement.
  // Où ce numéro est-il DÉJÀ posé dans le plan ? (pièce + meuble)
  // ⚠️ Un même numéro dans deux cases, c'est « dans quelle boîte est-elle ? » —
  // le pendant, au garage, des deux paires sous le même numéro (§19). La
  // feuille de choix l'empêche déjà (elle ne propose que ce qui n'est pas
  // rangé) ; ce garde-fou couvre la SAISIE LIBRE, qui ne vérifiait rien.
  const dejaPoseOu = (num) => {
    const t = String(num || '').trim(); if (!t) return null;
    for (const r of (plan.rooms || [])) for (const o of (r.items || [])) {
      for (const [k, a] of Object.entries(o.slots || {})) if ((a || []).some(v => String(v).trim() === t)) return { piece: r.name, meuble: o.name, cell: k, id: o.id };
      if (Array.isArray(o.nums) && o.nums.some(v => String(v).trim() === t)) return { piece: r.name, meuble: o.name, cell: null, id: o.id };
      if (o.num != null && String(o.num).trim() === t) return { piece: r.name, meuble: o.name, cell: null, id: o.id };
    }
    return null;
  };

  const poserDansCase = (itemId, cellKey, saisie) => {
    const it = items.find(x => x.id === itemId); if (!it) return;
    {
      const v0 = saisie == null ? '' : String(saisie).trim();
      const cur0 = ((it.slots || {})[cellKey] || [])[0] || '';
      if (v0 && v0 !== cur0) {
        const ou = dejaPoseOu(v0);
        if (ou && !(ou.id === itemId && ou.cell === cellKey)) {
          // Information, pas décision : un bandeau suffit — deux boutons pour
          // un seul résultat, c'est une fausse question.
          toast(`N°${v0} déjà rangé dans « ${ou.meuble} »${ou.piece ? ` (${ou.piece})` : ''} — retire-le de là-bas d'abord.`);
          return;
        }
      }
    }
    const nr = Math.max(1, it.rows || 3), nc = Math.max(1, it.cols || 4);
    const cz = casesDe(it, room.wallH);
    if (cz.mode === 'pile' || cz.mode === 'cintre') {
      if (saisie == null) return;
      const v = String(saisie).trim(); if (!v) return;
      const ou = dejaPoseOu(v);
      if (ou) { toast(`N°${v} déjà rangé dans « ${ou.meuble} »${ou.piece ? ` (${ou.piece})` : ''} — retire-le de là-bas d'abord.`); return; }
      const slots = empilerDansCase(it.slots, cellKey, v, cz.cap);
      if (!slots) { toast('Cette case est pleine — choisis une autre case.'); return; }
      updateItem(itemId, { slots });
      setDepot({ itemId, cellKey, num: v, at: Date.now() });
      return;
    }
    const c0 = Number(String(cellKey).split('_')[1]);
    const slots = { ...(it.slots || {}) };
    const cur = (slots[cellKey] || [])[0] || '';
    const n = saisie;
    if (n == null) return; // annulé
    const v = String(n).trim();
    if (cur) { // boîte existante → on modifie / efface EN PLACE
      if (v) slots[cellKey] = [v]; else delete slots[cellKey];
    } else if (v) { // AJOUT → va le plus BAS possible de la colonne (case vide la plus basse)
      let target = cellKey;
      for (let r = nr - 1; r >= 0; r--) { const k = r + '_' + c0; if (!(slots[k] && slots[k].length)) { target = k; break; } }
      slots[target] = [v];
    }
    const compacted = compactSlots(slots, nr, nc); // gravité : tout retombe en bas, sans trou
    // GRILLE PLEINE → on ajoute automatiquement une rangée VERS LE HAUT (jusqu'au
    // plafond) : tu continues à ranger sans jamais avoir à redimensionner ni
    // déplacer la grille. (Uniquement à l'ajout, sur une grille de boîtes.)
    let grow = {};
    if (v && !cur && (FURN_TYPES[it.type] || {}).build === 'grille') {
      const full = Object.keys(compacted).length >= nr * nc;
      const cellS = it.cell || 0.5, maxRows = Math.max(1, Math.floor(((room && room.wallH) || 3.4) / cellS));
      if (full && nr < maxRows) grow = { rows: nr + 1 };
    }
    updateItem(itemId, { slots: compacted, ...grow });
    // La boîte ARRIVE (chute + halo) au lieu d'apparaître d'un coup.
    if (v && !cur) {
      const pose = Object.keys(compacted).find(k => (compacted[k] || [])[0] === v) || cellKey;
      setDepot({ itemId, cellKey: pose, at: Date.now() });
    }
  };
  const emojiOf = (it) => it.emoji || (FURN_TYPES[it.type] || FURN_TYPES.autre).emoji;
  const colorOf = (it) => it.color || (FURN_TYPES[it.type] || FURN_TYPES.autre).color;
  const h3dOf = (it) => it.h3d != null ? it.h3d : (FURN_TYPES[it.type] || FURN_TYPES.autre).h3d;
  const setRoom = (dw, dh) => {
    const w = Math.max(2, Math.min(30, room.w + dw)), h = Math.max(2, Math.min(30, room.h + dh));
    if (!estRectangle(room)) { toast('Ta pièce a une forme libre : tire ses coins dans le plan vu du dessus.'); return; }
    const p2 = [[0, 0], [w, 0], [w, h], [0, h]];
    if (items.some(o => !['cadre', 'fenetre'].includes((FURN_TYPES[o.type] || {}).build) && !rectDans(empreinte(o).cx, empreinte(o).cy, empreinte(o).w, empreinte(o).h, p2))) { toast('Un meuble serait hors de la pièce — déplace-le d\'abord.'); return; }
    patchRoom(r => ({ room: { ...r.room, w, h } })); signalerDisposition();
  };
  const updateItem = (id, patch) => setItems(list => list.map(it => it.id === id ? { ...it, ...patch } : it));
  // Déplacement d'un élément depuis la 3D. Une BOÎTE se cale sur la grille-sol
  // (0,5 m) et s'EMPILE : son niveau = nb de boîtes déjà présentes sur cette
  // colonne (donc lâchée sur une pile, elle se pose dessus). Les autres meubles
  // gardent x/y/rotation tels quels.
  // Empreinte au sol effective (largeur/profondeur) selon la rotation du meuble.
  const effFoot = (w, h, rot) => { const odd = Math.abs(Math.round((rot || 0) / (Math.PI / 2))) % 2 === 1; return { w: odd ? h : w, h: odd ? w : h }; };
  const moveItem = (id, x, y, rot, stackOn, lift) => {
    let refuse = false, bougeMeuble = false;
    setItems(list => {
      const it = list.find(o => o.id === id); if (!it) return list;
      if (!(FURN_TYPES[it.type] || {}).box) {
        const ft = FURN_TYPES[it.type] || {};
        const liftFinal = lift != null ? lift : it.lift;
        // (17 oct.) RIEN NE TRAVERSE UN MEUBLE, RIEN NE SORT DE LA PIÈCE.
        // Une pile POSÉE sur un meuble garde la place visée sur lui ; tout le
        // reste (meubles, cartons au sol) est poussé jusqu'à la place libre la
        // plus proche — et s'il n'y en a aucune, il reste où il était.
        const ef = empreinte({ ...it, x, y, rot });
        let cx = ef.cx, cy = ef.cy;
        if (!(ft.pile && Number(liftFinal) > 0)) {
          const pl = placerSansTraverser(cx, cy, ef.w, ef.h, obstaclesPour(list, id), poly);
          if (!pl) { refuse = true; return list.slice(); }   // nouvelle référence : la 3D le redessine à l'ancienne place
          cx = pl.cx; cy = pl.cy;
        }
        const fx = +(cx - it.w / 2).toFixed(2), fy = +(cy - it.h / 2).toFixed(2);
        bougeMeuble = true;
        // Ce qui est POSÉ sur un meuble le suit quand il bouge.
        const dx = fx - it.x, dy = fy - it.y;
        return list.map(o => o.id === id ? { ...o, x: fx, y: fy, rot, lift: liftFinal }
          : (!ft.pile && (dx || dy) && estPoseSur(o, it) ? { ...o, x: +(o.x + dx).toFixed(2), y: +(o.y + dy).toFixed(2) } : o));
      }
      let sx, sy;
      const tgt = stackOn ? list.find(o => o.id === stackOn && (FURN_TYPES[o.type] || {}).box) : null;
      if (tgt) { sx = tgt.x; sy = tgt.y; } // lâchée SUR une boîte → sa colonne (empilage)
      else {
        // Tolérance : sinon, si on lâche PRÈS d'une boîte, on s'empile dessus.
        let best = null, bd = Infinity;
        list.forEach(o => { if (o.id === id || !(FURN_TYPES[o.type] || {}).box) return; const dx = o.x - x, dy = o.y - y, dd = dx * dx + dy * dy; if (dd < bd) { bd = dd; best = o; } });
        if (best && bd <= 0.55 * 0.55) { sx = best.x; sy = best.y; }
        else { sx = Math.round(x / BOX_S) * BOX_S; sy = Math.round(y / BOX_S) * BOX_S; } // sinon, pose au sol
      }
      const colKey = (o) => Math.round(o.x / BOX_S) + ',' + Math.round(o.y / BOX_S);
      const updated = list.map(o => o.id === id ? { ...o, x: sx, y: sy } : o);
      // Recompacte chaque colonne : niveaux 0..n contigus ; la boîte déplacée
      // passe au SOMMET de sa colonne cible (lâchée sur la pile → dessus).
      const byCol = {};
      updated.forEach(o => { if ((FURN_TYPES[o.type] || {}).box) { const k = colKey(o); (byCol[k] = byCol[k] || []).push(o); } });
      const lvlOf = {};
      Object.values(byCol).forEach(arr => {
        arr.sort((a, b) => (a.id === id ? 1 : b.id === id ? -1 : (a.lvl || 0) - (b.lvl || 0)));
        arr.forEach((o, i) => { lvlOf[o.id] = i; });
      });
      return updated.map(o => (FURN_TYPES[o.type] || {}).box ? { ...o, lvl: lvlOf[o.id] != null ? lvlOf[o.id] : (o.lvl || 0) } : o);
    });
    if (refuse) toast('Pas de place ici sans traverser un meuble ou un mur — il reste où il était.');
    else if (bougeMeuble) signalerDisposition();
  };
  // Recompacte les niveaux d'une liste de boîtes par colonne (la boîte `topId`
  // finit en haut de sa colonne, `bottomId` en bas).
  const recompactBoxes = (list, topId, bottomId) => {
    const colKey = (o) => Math.round(o.x / BOX_S) + ',' + Math.round(o.y / BOX_S);
    const byCol = {}; list.forEach(o => { if ((FURN_TYPES[o.type] || {}).box) { const k = colKey(o); (byCol[k] = byCol[k] || []).push(o); } });
    const lvlOf = {};
    Object.values(byCol).forEach(arr => { arr.sort((a, b) => (a.id === topId ? 1 : b.id === topId ? -1 : a.id === bottomId ? -1 : b.id === bottomId ? 1 : (a.lvl || 0) - (b.lvl || 0))); arr.forEach((o, i) => { lvlOf[o.id] = i; }); });
    return list.map(o => (FURN_TYPES[o.type] || {}).box ? { ...o, lvl: lvlOf[o.id] != null ? lvlOf[o.id] : (o.lvl || 0) } : o);
  };
  // EMPILER par TOUCHER (fiable, sans glisser précis) : on choisit une boîte,
  // puis on touche celle sur laquelle la poser → elle monte au sommet de sa pile.
  const [stackSrc, setStackSrc] = useState(null);
  const stackOnto = (srcId, tgtId) => {
    setItems(list => {
      const src = list.find(o => o.id === srcId), tgt = list.find(o => o.id === tgtId);
      if (!src || !tgt || !(FURN_TYPES[src.type] || {}).box || !(FURN_TYPES[tgt.type] || {}).box) return list;
      const updated = list.map(o => o.id === srcId ? { ...o, x: tgt.x, y: tgt.y } : o);
      return recompactBoxes(updated, srcId, null); // src au sommet de la colonne cible
    });
  };
  // Reposer une boîte AU SOL, sur une colonne libre.
  const boxToFloor = (it) => {
    setItems(list => {
      const used = new Set(list.filter(o => (FURN_TYPES[o.type] || {}).box && o.id !== it.id).map(o => Math.round(o.x / BOX_S) + ',' + Math.round(o.y / BOX_S)));
      let gx = 1, gy = 1;
      for (let k = 0; k < 800; k++) { const cc = Math.round(gx / BOX_S) + ',' + Math.round(gy / BOX_S); if (!used.has(cc)) break; gx += BOX_S; if (gx > room.w - BOX_S) { gx = 1; gy += BOX_S; } }
      const sx = Math.min(room.w - it.w, gx), sy = Math.min(room.h - it.h, gy);
      const updated = list.map(o => o.id === it.id ? { ...o, x: sx, y: sy } : o);
      return recompactBoxes(updated, null, it.id); // seule sur sa colonne → niveau 0
    });
  };
  // Hauteur du DESSUS d'un meuble (pour poser une pile dessus), cohérente avec la 3D.
  const furnTop = (o) => { const b = (FURN_TYPES[o.type] || {}).build || 'generic'; if (b === 'grille' || b === 'pile') return Math.max(1, o.rows || 3) * (o.cell || 0.5); return Math.max(0.35, h3dOf(o) * 1.5); };
  const isSurface = (o) => { const ft = FURN_TYPES[o.type] || {}; return !ft.pile && !ft.box && !ft.deco && ft.build !== 'grille'; }; // meuble sur lequel on peut poser
  // « Poser une pile sur un meuble » par TOUCHER (fiable, sans viser en 3D) :
  // on choisit une pile, on touche le meuble → la pile se pose CENTRÉE dessus.
  const [putOnSrc, setPutOnSrc] = useState(null);
  const putPileOn = (srcId, tgtId) => {
    const src = items.find(o => o.id === srcId), tgt = items.find(o => o.id === tgtId);
    if (!src || !tgt) return;
    // On veut la pile COLLÉE au mur le plus proche, mais qui reste POSÉE sur le
    // meuble. Méthode robuste (marche même si le meuble est tourné) :
    // 1) on colle le centre de la pile au mur le plus proche,
    // 2) on le ramène dans l'empreinte effective du meuble (donc sur le meuble).
    let px = tgt.x + tgt.w / 2, py = tgt.y + tgt.h / 2; // centre = centre du meuble au départ
    const dW = px, dE = room.w - px, dN = py, dS = room.h - py, m = Math.min(dW, dE, dN, dS);
    if (m <= 2.2) { if (m === dN) py = src.h / 2; else if (m === dS) py = room.h - src.h / 2; else if (m === dW) px = src.w / 2; else px = room.w - src.w / 2; }
    const ef = effFoot(tgt.w, tgt.h, tgt.rot); const tcx = tgt.x + tgt.w / 2, tcy = tgt.y + tgt.h / 2;
    px = Math.max(tcx - ef.w / 2 + src.w / 2, Math.min(tcx + ef.w / 2 - src.w / 2, px)); // rester sur le meuble
    py = Math.max(tcy - ef.h / 2 + src.h / 2, Math.min(tcy + ef.h / 2 - src.h / 2, py));
    const nx = Math.max(0, Math.min(room.w - src.w, +(px - src.w / 2).toFixed(2)));
    const ny = Math.max(0, Math.min(room.h - src.h, +(py - src.h / 2).toFixed(2)));
    updateItem(srcId, { x: nx, y: ny, lift: furnTop(tgt) });
  };
  // Sélection depuis la 3D, en tenant compte des modes « empiler » / « poser sur ».
  const selectItem = (id) => {
    if (putOnSrc && id && id !== putOnSrc) {
      const tgt = items.find(o => o.id === id);
      if (tgt && isSurface(tgt)) { putPileOn(putOnSrc, id); const s = putOnSrc; setPutOnSrc(null); setSel(s); return; }
    }
    if (stackSrc && id && id !== stackSrc) {
      const tgt = items.find(o => o.id === id);
      if (tgt && (FURN_TYPES[tgt.type] || {}).box) { stackOnto(stackSrc, id); const s = stackSrc; setStackSrc(null); setSel(s); return; }
    }
    setStackSrc(null); setPutOnSrc(null); setSel(id);
  };
  // (17 oct.) Retirer un meuble : ce qui était POSÉ dessus redescend au sol
  // (gravité), à la place libre la plus proche — jamais à travers un autre meuble.
  const removeItem = async (id)=>{
    if (!await askConfirm('Supprimer ce meuble et son rangement ?')) return;
    setItems(list => {
      const it = list.find(o => o.id === id); const reste = list.filter(o => o.id !== id);
      if (!it) return reste;
      let out = reste;
      reste.forEach(o => {
        if (!estPoseSur(o, it)) return;
        const pose = { ...o, lift: 0 };
        const pl = placeLibre(out.filter(q => q.id !== o.id), pose);
        out = out.map(q => q.id === o.id ? (pl ? { ...pose, x: +(pl.cx - o.w / 2).toFixed(2), y: +(pl.cy - o.h / 2).toFixed(2) } : pose) : q);
      });
      return out;
    });
    setSel(null); setOpenItem(null); signalerDisposition();
  };
  const dupItem = (it) => {
    const id = 'f' + Date.now(); let pasDePlace = false;
    setItems(list => {
      const copy = { ...it, id, slots: {}, nums: Array.isArray(it.nums) ? [] : it.nums, lift: 0, x: Math.max(0, Math.min(room.w - it.w, it.x + 1)), y: Math.max(0, Math.min(room.h - it.h, it.y + 1)) };
      const pl = placeLibre(list, copy);
      if (!pl) { pasDePlace = true; return list; }
      copy.x = +(pl.cx - it.w / 2).toFixed(2); copy.y = +(pl.cy - it.h / 2).toFixed(2);
      return [...list, copy];
    });
    if (pasDePlace) { toast('Plus de place libre pour un meuble de plus.'); return; }
    setSel(id); signalerDisposition();
  };

  const onDown = (e, it) => { e.stopPropagation(); setSel(it.id); const p = e.touches ? e.touches[0] : e; drag.current = { id: it.id, sx: p.clientX, sy: p.clientY, ox: it.x, oy: it.y, moved: false }; };
  const onMove = (e) => {
    if (!drag.current) return; const r = roomRef.current?.getBoundingClientRect(); if (!r) return;
    const p = e.touches ? e.touches[0] : e;
    const dx = (p.clientX - drag.current.sx) / r.width * room.w, dy = (p.clientY - drag.current.sy) / r.height * room.h;
    const it = items.find(x => x.id === drag.current.id); if (!it) return;
    if (Math.abs(p.clientX - drag.current.sx) + Math.abs(p.clientY - drag.current.sy) > 4) drag.current.moved = true;
    let nx = Math.round((drag.current.ox + dx) * 2) / 2, ny = Math.round((drag.current.oy + dy) * 2) / 2;
    nx = Math.max(0, Math.min(room.w - it.w, nx)); ny = Math.max(0, Math.min(room.h - it.h, ny));
    updateItem(drag.current.id, { x: nx, y: ny });
    if (e.cancelable) e.preventDefault();
  };
  const onUp = () => { drag.current = null; };

  const doSearch = (q) => {
    const t = String(q).trim().toLowerCase(); if (!t) { setHi(null); return; }
    // On cherche dans TOUTES les pièces : si le N° est ailleurs, on bascule dessus.
    for (const rm of plan.rooms) {
      for (const it of (rm.items || [])) {
        // Boîte seule : son numéro est sur it.num.
        if ((FURN_TYPES[it.type] || {}).box && String(it.num || '').trim().toLowerCase() === t) {
          if (rm.id !== plan.active) persist({ ...plan, active: rm.id });
          setHi({ itemId: it.id, roomId: rm.id, roomName: rm.name }); setSel(it.id); return;
        }
        // Pile de boîtes : les numéros sont dans it.nums (n'était PAS cherché avant).
        if (Array.isArray(it.nums) && it.nums.some(n => String(n).trim().toLowerCase() === t)) {
          if (rm.id !== plan.active) persist({ ...plan, active: rm.id });
          // Le CARTON précis (son rang dans la pile) : le contour et le vol le visent.
          const pileIdx = it.nums.findIndex(n => String(n).trim().toLowerCase() === t);
          setHi({ itemId: it.id, pileIdx, num: t, roomId: rm.id, roomName: rm.name }); setSel(it.id); return;
        }
        for (const cell in (it.slots || {})) if ((it.slots[cell] || []).some(n => String(n).trim().toLowerCase() === t)) {
          if (rm.id !== plan.active) persist({ ...plan, active: rm.id });
          setHi({ itemId: it.id, cell, num: t, roomId: rm.id, roomName: rm.name }); setOpenItem(it.id); setSel(it.id); return;
        }
      }
    }
    setHi({ notFound: true });
  };
  useEffect(() => { if (locate != null && String(locate).trim() !== '') { setSearch(String(locate)); doSearch(String(locate)); onLocateConsumed && onLocateConsumed(); } /* eslint-disable-next-line */ }, [locate, items.length]);

  const selItem = items.find(it => it.id === sel);
  const opened = items.find(it => it.id === openItem);
  const storedCount = (it) => Object.values(it.slots || {}).reduce((s, a) => s + (a ? a.length : 0), 0);

  // ── LES PAIRES QU'ON PEUT RANGER ────────────────────────────────────────
  // Source : `vinted_annonce_numeros` (photo + titre par numéro) restreint aux
  // numéros PHYSIQUEMENT présents — la liste `vinted_nums_physiques` publiée
  // par l'écran Annonces (§5.14), qui est LA définition de « cette paire est
  // chez toi » (en ligne, ou vendue pas encore expédiée).
  // ⚠️ On ne recalcule pas cette règle ici : une seule règle par notion (§11).
  //    Sans la liste (écran Annonces jamais ouvert sur cet appareil), on
  //    propose tout plutôt que rien — on ne cache jamais une paire à tort.
  const dejaRangees = useMemo(() => {
    const set = new Set();
    (plan.rooms || []).forEach(r => (r.items || []).forEach(it => {
      Object.values(it.slots || {}).forEach(a => (a || []).forEach(v => { const t = String(v || '').trim(); if (t) set.add(t); }));
      if (Array.isArray(it.nums)) it.nums.forEach(v => { const t = String(v || '').trim(); if (t) set.add(t); });
      if (it.num != null) { const t = String(it.num).trim(); if (t) set.add(t); }
    }));
    return set;
  }, [plan]);

  const aRanger = useMemo(() => {
    const fiches = load('vinted_annonce_numeros', {}) || {};
    const presents = numsPresents();
    const vues = new Set(), out = [];
    Object.values(fiches).forEach(f => {
      const n = f && f.numero != null ? String(f.numero).trim() : '';
      if (!n || vues.has(n) || dejaRangees.has(n)) return;
      if (presents && !presents.has(cleNum(n))) return;
      vues.add(n);
      out.push({ numero: n, title: f.title || '', photo: f.photo || null, taille: extractSize(f.title || ''), at: f.numberedAt || 0, sur: !!presents });
    });
    // ⚠️ L'ORDRE CHANGE SELON CE QU'ON SAIT, et on le dit dans la feuille.
    // Avec la liste des paires présentes : par numéro, c'est un inventaire.
    // SANS elle (écran Annonces jamais ouvert sur cet appareil), la liste
    // contient tout l'historique — des paires parties depuis des mois. On
    // remonte alors les plus RÉCEMMENT numérotées : ce sont celles en stock.
    return presents
      ? out.sort((a, b) => triNum(a.numero, b.numero))
      : out.sort((a, b) => (b.at || 0) - (a.at || 0));
  }, [dejaRangees]);

  const [ranger, setRanger] = useState(null);   // { itemId, cellKey } — feuille ouverte
  const [depot, setDepot] = useState(null);     // { itemId, cellKey, at } — animation 3D
  const [sortie, setSortie] = useState(null);   // { itemId, cellKey, at, fini } — la boîte s'en va

  // ── QUI EST DANS CE MEUBLE ──────────────────────────────────────────────
  // Le garage savait RANGER, pas MONTRER. On ne pouvait ni voir ce qu'un
  // meuble contient, ni en sortir une paire autrement qu'en effaçant un
  // numéro dans une boîte de saisie. Ici : photo, N°, titre, et « Sortir ».
  // ⚠️ Le rapprochement se fait par NUMÉRO — c'est ce qui est écrit sur le
  // carton, donc l'identité de la boîte au garage. Quand plusieurs fiches
  // portent le même numéro (héritage d'avant §5.40), on préfère celle d'une
  // paire réellement présente, sinon la plus récemment numérotée, et on le
  // SIGNALE au lieu de choisir en silence.
  const ficheParNum = useMemo(() => {
    const fiches = load('vinted_annonce_numeros', {}) || {};
    const presents = numsPresents();
    const par = {};
    Object.values(fiches).forEach(f => {
      const n = f && f.numero != null ? String(f.numero).trim() : ''; if (!n) return;
      (par[n] = par[n] || []).push(f);
    });
    const out = {};
    Object.entries(par).forEach(([n, arr]) => {
      const vivantes = presents ? arr.filter(f => presents.has(cleNum(n))) : arr;
      const pool = vivantes.length ? vivantes : arr;
      const best = pool.slice().sort((a, b) => (b.numberedAt || 0) - (a.numberedAt || 0))[0];
      const titres = new Set(arr.map(f => normTitle(f.title || '')).filter(Boolean));
      out[n] = { title: best.title || '', photo: best.photo || null, ambigu: titres.size > 1 };
    });
    return out;
  }, [items]);

  const contenuMeuble = (it) => {
    const out = [];
    Object.entries(it.slots || {}).forEach(([cell, arr]) => {
      (arr || []).forEach(v => {
        const n = String(v || '').trim(); if (!n) return;
        out.push({ cell, numero: n, ...(ficheParNum[n] || {}) });
      });
    });
    return out.sort((a, b) => (parseInt(a.numero, 10) || 0) - (parseInt(b.numero, 10) || 0));
  };

  // Sortir une paire : on la voit PARTIR, puis on écrit.
  const sortirDeCase = (itemId, cellKey, numero) => {
    const ecrire = () => {
      const it = items.find(x => x.id === itemId); if (!it) return;
      const cz = casesDe(it, room.wallH);
      if (cz.mode === 'pile' || cz.mode === 'cintre') {
        // Ceux du DESSUS descendent d'un cran (la 3D les fait tomber).
        const r = retirerDeCase(it.slots, cellKey, numero);
        if (r) updateItem(itemId, { slots: r.slots });
        setSortie(null); toast(`N°${numero} sorti du stock.`); return;
      }
      const slots = { ...(it.slots || {}) };
      const reste = (slots[cellKey] || []).filter(v => String(v).trim() !== String(numero).trim());
      if (reste.length) slots[cellKey] = reste; else delete slots[cellKey];
      // Seul un MUR de boîtes (la grille) fait tomber sa colonne. Une ancienne
      // étagère ou commode a des plateaux / tiroirs : rien ne passe de l'un à
      // l'autre — seuls ceux du dessus, dans la même case, descendent.
      const mur = (FURN_TYPES[it.type] || {}).build === 'grille';
      updateItem(itemId, { slots: mur ? compactSlots(slots, Math.max(1, it.rows || 3), Math.max(1, it.cols || 4)) : slots });
      setSortie(null);
      toast(`N°${numero} sorti du stock.`);
    };
    setSortie({ itemId, cellKey, num: String(numero), at: Date.now(), fini: ecrire });
  };

  // Ajoute/retire un N° dans une case (empilable).
  const cellAdd = async (it, cell) => { const n = (await askText({ numeric: clavierNum() === 'numeric', desc: 'Numéro à ranger dans cette case (empilable) :', value: '' }) || '').trim(); if (!n) return; const cur = (it.slots && it.slots[cell]) || []; updateItem(it.id, { slots: { ...(it.slots || {}), [cell]: [...cur, n] } }); };
  const cellRemove = (it, cell, n) => { const cur = ((it.slots && it.slots[cell]) || []).filter(x => x !== n); const slots = { ...(it.slots || {}) }; if (cur.length) slots[cell] = cur; else delete slots[cell]; updateItem(it.id, { slots }); };
  const setGrid = (it, rows, cols) => updateItem(it.id, { rows: Math.max(1, rows), cols: Math.max(1, cols) });

  // Occupation de la pièce : combien de boîtes rangées, combien de places libres,
  // combien de meubles → un vrai tableau de bord de rangement en un coup d'œil.
  const refAmenager = React.useRef(null);   // le dépliant « Aménager la pièce », ouvert par le geste de la pièce vide
  // (17 oct.) DEUX MODES, séparés : RANGER (le quotidien — poser, retrouver,
  // sortir des paires ; les meubles sont verrouillés) et AMÉNAGER (dessiner la
  // pièce, ajouter, régler et déplacer les meubles). Une barre en tête les sépare.
  const [editionChoisie, setEdition] = useState(false);
  const edition = editionChoisie || items.length === 0;   // une pièce vide n’a rien à ranger : elle s’ouvre en « Aménager »
  const [pairePrete, setPairePrete] = useState(null);   // un N° choisi dans « À ranger », en attente d'une place
  const viseurRef = React.useRef(null);                 // ce qui est sous le doigt dans la 3D (glisser-déposer)
  const refFantome = React.useRef(null);                // la vignette qui suit le doigt pendant un glisser
  const capacity = useMemo(() => {
    const GRID = ['grille', 'commode', 'etagere', 'casier', 'armoire'];
    let boxes = 0, freeCells = 0, furn = 0;
    items.forEach(it => {
      const ft = FURN_TYPES[it.type] || {};
      if (ft.box) { boxes += 1; return; }                 // boîte à empiler = 1 boîte
      if (ft.build === 'pile') { boxes += cartonsDePile(pileNums(it)).length; furn += 1; return; }
      furn += 1;
      if (GRID.includes(it.type)) {
        const cells = Math.max(1, it.cols || 1) * Math.max(1, it.rows || 1);
        const filled = Object.values(it.slots || {}).filter(a => a && a.length).length;
        boxes += storedCount(it);
        freeCells += Math.max(0, cells - filled);
      } else { boxes += storedCount(it); }
    });
    return { boxes, freeCells, furn };
  }, [items]);

  // ── LES PAIRES À ALLER CHERCHER (bouton de l'onglet Colis) ───────────────
  // Les numéros vendus à expédier, posés par Colis : on les colore dans la 3D et
  // on dit où est chacun — ou qu'il n'est rangé nulle part (jamais deviné).
  const [aChercher, setAChercher] = useState(() => {
    const d = DEMANDE_STOCK_CHERCHE;
    if (Array.isArray(d.nums) && d.nums.length && Date.now() - d.at < 120000) { const n = d.nums; d.nums = null; return n; }
    return null;
  });
  const chercheLoc = useMemo(() => aChercher ? aChercher.map(n => ({ numero: String(n), ou: ouEstNumero(plan, n) })) : null, [aChercher, plan]);
  const cibles3D = useMemo(() => (chercheLoc || []).filter(x => x.ou && x.ou.roomId === activeRoom.id).map(x => ({ itemId: x.ou.itemId, cell: x.ou.key, pileIdx: x.ou.pileIdx, num: x.numero })), [chercheLoc, activeRoom.id]);
  // Changer la DIMENSION d'un meuble (largeur, profondeur, pivot) : refusé s'il
  // traverserait un autre meuble ou un mur.
  const changerDimensions = (it, patch) => {
    const essai = { ...it, ...patch };
    const pl = placeLibre(items, essai);
    if (!pl) { toast('Pas la place pour ce changement sans traverser un meuble ou un mur.'); return; }
    updateItem(it.id, { ...patch, x: +(pl.cx - essai.w / 2).toFixed(2), y: +(pl.cy - essai.h / 2).toFixed(2) });
    signalerDisposition();
  };
  // Plateaux d'une étagère, places d'une table, cintres d'un portant : on ne
  // retire JAMAIS une rangée ou une colonne qui porte un numéro (il serait perdu).
  const changerCases = (it, dCols, dRows) => {
    const { nr, nc } = dimsMeuble(it); const ft = FURN_TYPES[it.type] || {};
    const cols = Math.max(1, Math.min(16, nc + dCols)), rows = Math.max(1, Math.min(10, nr + dRows));
    const slots = it.slots || {};
    if (cols < nc && Object.keys(slots).some(k => +k.split('_')[1] >= cols && numsCase(slots[k]).length)) { toast('Cette case porte encore un numéro — sors-le d\'abord.'); return; }
    let neuf = { ...slots };
    if (rows !== nr) {
      // La rangée ajoutée ou retirée est celle du HAUT (r = 0) : les plateaux du
      // bas gardent leurs boîtes.
      if (rows < nr && Object.keys(slots).some(k => +k.split('_')[0] === 0 && numsCase(slots[k]).length)) { toast('Le plateau du haut porte encore un numéro — sors-le d\'abord.'); return; }
      neuf = {}; for (const k in slots) { const [r, c] = k.split('_').map(Number); const nrr = r + (rows - nr); if (nrr >= 0) neuf[nrr + '_' + c] = slots[k]; }
    }
    const patch = { cols, rows, slots: neuf };
    // Un plateau garde SA hauteur (réglée par « Hauteur d'un niveau », 37,5 cm
    // par défaut) : la contenance par case ne bouge pas.
    if (ft.build === 'metal') patch.h3d = +(rows * hauteurNiveau(it) / 1.5).toFixed(3);
    if (ft.build === 'portant' || ft.build === 'metal' || ft.build === 'table') { const w = ft.build === 'table' ? Math.max(it.w, +(cols * 0.6).toFixed(2)) : +(cols * (ft.build === 'portant' ? 0.19 : 0.6)).toFixed(2); patch.w = Math.max(0.6, w); }
    changerDimensions(it, patch);
  };

  // (17 oct.) Julien : « pouvoir régler la hauteur des étagères, la largeur, la
  // profondeur ». Une étagère : hauteur d'UN niveau (tous les plateaux égaux),
  // le nombre de niveaux à côté. Refusé si une case contient plus de boîtes
  // que le nouveau niveau n'en tient (elles seraient cachées) — jamais en silence.
  const hauteurNiveau = (it) => { const nr = Math.max(1, it.rows || 1); return (h3dOf(it) * 1.5) / nr; };
  const changerNiveau = (it, delta) => {
    const ft = FURN_TYPES[it.type] || {}; const nr = Math.max(1, it.rows || 1);
    const niv = Math.max(ft.bacs ? 0.14 : 0.2, Math.min(0.8, +(hauteurNiveau(it) + delta).toFixed(3)));
    const h3d = +(nr * niv / 1.5).toFixed(3);
    if (nr * niv > (room.wallH || 3.4) - 0.1) { toast('Plus haut que le plafond de la pièce.'); return; }
    const cap = capaciteCase(ft, { ...it, h3d }, room.wallH || 3.4);
    const plein = Object.values(it.slots || {}).some(a => numsCase(a).length > cap);
    if (plein) { toast(`Un niveau de ${Math.round(niv * 100)} cm ne tient plus toutes les boîtes déjà rangées — sors-en d'abord.`); return; }
    updateItem(it.id, { h3d });
  };
  React.useEffect(() => { const d = refAmenager.current; if (d && d.open !== edition) d.open = edition; setMoveMode(edition); if (edition) setPairePrete(null); }, [edition]);
  // La prochaine place libre de la pièce : le meuble choisi d'abord, puis les
  // autres dans l'ordre. Ne décide aucun numéro — seulement OÙ.
  const prochainePlace = (prefId) => {
    const ordre = [...items].sort((a, b) => (b.id === prefId ? 1 : 0) - (a.id === prefId ? 1 : 0));
    for (const it of ordre) {
      const ft = FURN_TYPES[it.type] || {}; const p = prochainePlaceMeuble(it, ft, room.wallH || 3.4);
      if (p) return { itemId: it.id, cellKey: p.cell, nom: `${it.name || ft.label} · ${nomCase(Math.max(1, it.rows || 1), p.cell, modeCase(ft), it)}` };
    }
    return null;
  };
  const ajouterDansPile = (it, numero) => {
    const v = String(numero || '').trim(); if (!v) return;
    const ou = dejaPoseOu(v); if (ou) { toast(`N°${v} déjà rangé dans « ${ou.meuble} »${ou.piece ? ` (${ou.piece})` : ''} — retire-le de là-bas d'abord.`); return; }
    const n2 = ajouterAPile(pileNums(it), v); if (n2) { pileSet(it, n2); toast(`N°${v} posé sur « ${it.name} ».`); }
  };
  const rangerPaire = (numero, itemId, cellKey) => {
    const it = items.find(o => o.id === itemId); if (!it) return;
    setPairePrete(null); setSel(itemId);
    if ((FURN_TYPES[it.type] || {}).build === 'pile') { ajouterDansPile(it, numero); return; }
    poserDansCase(itemId, cellKey, numero);
  };
  // Lâcher une paire dans la 3D : sur une place libre → là ; sur un meuble plein
  // à cet endroit ou sur son cadre → sa prochaine place libre. Jamais un décor.
  const deposerSur = (numero, x, y) => {
    const v = viseurRef.current && viseurRef.current(x, y); if (!v || !v.id) return false;
    const it = items.find(o => o.id === v.id); if (!it) return false; const ft = FURN_TYPES[it.type] || {};
    if (ft.deco || ft.box) { toast('Ici on ne range rien — dépose-la sur une étagère, une table, un portant ou une pile.'); return true; }
    if (ft.build === 'pile') { setPairePrete(null); setSel(it.id); ajouterDansPile(it, numero); return true; }
    const cz = casesDe(it, room.wallH); let cell = v.cell != null ? v.cell : null;
    if (cell != null && numsCase((it.slots || {})[cell]).length >= (cz.mode === 'colonne' ? 1 : cz.cap)) cell = null;
    if (cell == null) { const p = prochainePlaceMeuble(it, ft, room.wallH || 3.4); if (!p) { toast(`« ${it.name} » est plein — choisis un autre meuble.`); return true; } cell = p.cell; }
    rangerPaire(numero, it.id, cell); return true;
  };
  // Glisser une vignette « À ranger » (souris ou doigt). Un simple toucher la
  // CHOISIT (elle attend alors qu'on touche une place) ; un glisser jusque dans
  // la pièce la RANGE là où on la lâche.
  const debutGlisser = (e, p) => {
    if (e.button != null && e.button !== 0) return;
    const x0 = e.clientX, y0 = e.clientY; let bouge = false;
    const f = refFantome.current;
    const suivre = (ev) => {
      if (!bouge && Math.hypot(ev.clientX - x0, ev.clientY - y0) > 8) { bouge = true; if (f) { f.textContent = `N°${p.numero}`; f.style.display = 'block'; } }
      if (bouge && f) f.style.transform = `translate(${Math.round(ev.clientX - 28)}px, ${Math.round(ev.clientY - 46)}px)`;
      if (bouge && ev.cancelable) ev.preventDefault();
    };
    const fin = (ev) => {
      window.removeEventListener('pointermove', suivre); window.removeEventListener('pointerup', fin); window.removeEventListener('pointercancel', annule);
      if (f) f.style.display = 'none';
      if (!bouge) { setPairePrete(x => x === p.numero ? null : p.numero); return; }
      const cible = document.elementFromPoint(ev.clientX, ev.clientY);
      if (cible && cible.closest && cible.closest('[data-stock3d] canvas') ? deposerSur(p.numero, ev.clientX, ev.clientY) : false) return;
      toast('Lâche la paire sur une étagère, une table, un portant ou une pile dans la pièce.');
    };
    const annule = () => { window.removeEventListener('pointermove', suivre); window.removeEventListener('pointerup', fin); window.removeEventListener('pointercancel', annule); if (f) f.style.display = 'none'; };
    window.addEventListener('pointermove', suivre, { passive: false }); window.addEventListener('pointerup', fin); window.addEventListener('pointercancel', annule);
  };
  if (mode === '2d') return <AssistantRangement plan={plan} planLu={planLu} ecrire={persist} ficheParNum={ficheParNum} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <style>{`@keyframes vrmpulse2{0%,100%{box-shadow:0 0 0 0 rgba(229,72,77,0.7);}50%{box-shadow:0 0 0 8px rgba(229,72,77,0);}}`}</style>
      {/* ⚠️ LA PIÈCE D'ABORD, LES RÉGLAGES ENSUITE.
          La vue 3D était sous quinze rangées de boutons : il fallait défiler
          tout l'écran de configuration avant de voir son stock. On regarde la
          pièce, on la modifie ensuite — pas l'inverse. */}
      {/* (17 oct.) LA BARRE DU STOCK : le mode (ranger / aménager) et la recherche
          d'un numéro, au même endroit, au-dessus de la pièce. */}
      <div data-stock-barre="" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Segmente label="Ce que je fais" className="vrm-seg-stock" value={edition ? 'amenager' : 'ranger'} onChange={(v) => setEdition(v === 'amenager')}
          options={[{ v: 'ranger', l: 'Ranger', icone: 'box', data: { 'data-mode-stock': 'ranger' } }, { v: 'amenager', l: 'Aménager', icone: 'pencil', data: { 'data-mode-stock': 'amenager' } }]} />
        <div style={{ flex: '1 1 200px', display: 'flex', gap: 6, minWidth: 0 }}>
          <input value={search} onChange={e => { setSearch(e.target.value); doSearch(e.target.value); }} placeholder="Cherche un N° → le meuble + la case" inputMode="numeric" style={{ flex: 1, minWidth: 0, border: `1px solid ${C.border}`, borderRadius: 10, padding: '9px 12px', fontSize: 14, background: C.card, color: C.text, outline: 'none', fontFamily: 'inherit' }} />
          {search && <button className="vrm-icon-control" type="button" aria-label="Effacer la recherche de rangement" onClick={() => { setSearch(''); setHi(null); }} style={{ border: `1px solid ${C.border}`, borderRadius: 10, background: 'transparent', color: C.muted, cursor: 'pointer', fontSize: 13, padding: '0 12px' }}><Icon name="close" size={15}/></button>}
        </div>
      </div>
      {hi && hi.notFound && <div style={{ fontSize: 12.5, color: C.warn, fontWeight: 600 }}>Aucune case ne contient « {search} ». Range-le : choisis-le dans « À ranger » puis touche une place libre.</div>}
      {hi && hi.itemId && (()=>{
        const it=items.find(x=>x.id===hi.itemId); if(!it) return null;
        let pos=null;
        if (hi.cell!=null){ const p=String(hi.cell).split('_'); const r=+p[0], c=+p[1]; const nr=Math.max(1,it.rows||1); if(!isNaN(r)&&!isNaN(c)) pos=nomCase(nr, hi.cell, casesDe(it, room.wallH).mode, it); }
        return <div data-trouve-num={search} style={{ fontSize: 13, color: C.text, fontWeight: 600, lineHeight:1.4 }}>N°{search} → <b>{it.name}</b>{hi.roomName ? <> · pièce <b>{hi.roomName}</b></> : null}{pos ? <> · {pos}</> : null}</div>;
      })()}
      {/* (17 oct.) « À RANGER » : les paires présentes qui n'ont pas de place.
          Toucher une vignette la choisit (la prochaine place libre est proposée,
          ou on touche une place dans la pièce) ; la glisser dans la pièce la
          range là où on la lâche. Mode Ranger seulement. */}
      {!edition && aRanger.length > 0 && aRanger[0].sur && (()=>{
        const pp = pairePrete ? prochainePlace(sel) : null;
        return (
          <div data-bande-a-ranger={aRanger.length} style={{ display: 'flex', flexDirection: 'column', gap: 8, border: `1px solid ${C.border}`, borderRadius: 12, background: C.card, padding: '10px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px 8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, fontWeight: 650, color: C.text, whiteSpace: 'nowrap' }}>À ranger</span>
              <span style={{ fontSize: 12.5, color: C.muted }}>{aRanger.length} paire{aRanger.length > 1 ? 's' : ''} · touche-en une, ou glisse-la dans la pièce</span>
            </div>
            <div className="vrm-rangee" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
              {aRanger.slice(0, 60).map(p => {
                const on = pairePrete === p.numero;
                return (
                  <button type="button" key={p.numero} data-paire-a-ranger={p.numero} aria-pressed={on} onPointerDown={(e) => debutGlisser(e, p)} onClick={(e) => e.preventDefault()}
                    style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 10px 5px 5px', borderRadius: 999, border: `1px solid ${on ? C.text : C.border}`, background: on ? `${C.text}10` : C.bg, color: C.text, cursor: 'grab', fontFamily: 'inherit', touchAction: 'pan-x', userSelect: 'none' }}>
                    {p.photo ? <PhotoVinted src={p.photo} alt="" style={{ width: 28, height: 28, borderRadius: 999, objectFit: 'cover', background: C.card2 }}/> : <span style={{ width: 28, height: 28, borderRadius: 999, background: C.card2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="box" size={14} style={{ color: C.muted }}/></span>}
                    <span style={{ fontSize: 13, fontWeight: 650 }}>N°{p.numero}</span>
                  </button>
                );
              })}
            </div>
            {pairePrete && (
              <div data-paire-prete={pairePrete} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13, color: C.text }}>
                <span style={{ flex: '1 1 220px', minWidth: 0 }}>
                  <b>N°{pairePrete}</b> : touche une place libre dans la pièce{pp ? <> — ou range-la à la prochaine place : <b>{pp.nom}</b></> : <> — aucune place libre dans la pièce, ajoute un meuble.</>}
                </span>
                {pp && <button type="button" data-ranger-prochaine="" onClick={() => rangerPaire(pairePrete, pp.itemId, pp.cellKey)} style={{ border: 'none', borderRadius: 10, background: C.accent, color: C.onAccent || '#fff', fontSize: 13.5, fontWeight: 600, padding: '0 14px', minHeight: 38, cursor: 'pointer', fontFamily: 'inherit' }}>Ranger ici</button>}
                <button type="button" onClick={() => setPairePrete(null)} style={{ border: `1px solid ${C.border}`, borderRadius: 10, background: 'transparent', color: C.muted, fontSize: 13, padding: '0 12px', minHeight: 38, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
              </div>
            )}
            <div ref={refFantome} aria-hidden="true" style={{ display: 'none', position: 'fixed', left: 0, top: 0, zIndex: 3000, pointerEvents: 'none', padding: '6px 12px', borderRadius: 999, background: C.text, color: C.card, fontSize: 13, fontWeight: 700, boxShadow: '0 6px 18px rgba(0,0,0,0.28)' }} />
          </div>
        );
      })()}
      <React.Suspense fallback={<div style={{ fontSize: 12, color: C.muted, padding: 16 }}>Chargement du stock 3D…</div>}>
        <Room3D key={`${activeRoom.id}-${room.w}-${room.h}-${room.wallH || 3.4}-${room.wallColor || 'def'}-${estRectangle(room) ? 'r' : poly.map(q => q.join(',')).join(';')}`} items={items} room={room} poly={poly} hi={hi} sel={sel} canMove={moveMode} onSelect={selectItem} onOpen={(id) => setSel(id)} onCellTap={fillCell} onPileTap={pileTap} onMove={moveItem} colorOf={colorOf} emojiOf={emojiOf} h3dOf={h3dOf} storedCount={storedCount} depot={depot} sortie={sortie} vueDessus={dispo} cibles={cibles3D} viseurRef={viseurRef} C={C} Icon={Icon} load={load} save={save} FURN_TYPES={FURN_TYPES} GARAGE_AMBIANCES={GARAGE_AMBIANCES} />
      </React.Suspense>
      {chercheLoc && (
        <div data-a-chercher={chercheLoc.length} style={{ border: `1px solid ${C.border}`, borderRadius: 12, background: C.card, padding: '11px 13px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 650, color: C.text }}>
              {chercheLoc.length} paire{chercheLoc.length > 1 ? 's' : ''} à aller chercher
              <span style={{ fontWeight: 500, color: C.muted }}> · en couleur dans la pièce</span>
            </span>
            <button className="vrm-icon-control" type="button" aria-label="Ne plus colorer les paires à aller chercher" onClick={() => setAChercher(null)} style={{ border: `1px solid ${C.border}`, borderRadius: 8, background: 'transparent', color: C.muted, padding: '0 10px', minHeight: 32, cursor: 'pointer' }}><Icon name="close" size={14}/></button>
          </div>
          {chercheLoc.map(x => (
            <div key={x.numero} data-cherche={x.numero} data-trouve={x.ou ? '1' : '0'} style={{ fontSize: 13, color: x.ou ? C.text : C.muted, lineHeight: 1.45 }}>
              <b>N°{x.numero}</b>{' '}
              {x.ou
                ? <>→ {x.ou.itemName}{plan.rooms.length > 1 ? ` (${x.ou.roomName})` : ''} · {x.ou.nom}{x.ou.roomId !== activeRoom.id ? <> — <button type="button" onClick={() => switchRoom(x.ou.roomId)} style={{ border: 'none', background: 'transparent', color: C.accent, padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>ouvrir cette pièce</button></> : null}</>
                : <>— rangée nulle part dans le stock</>}
            </div>
          ))}
        </div>
      )}
      {/* (16 oct.) UNE PIÈCE VIDE NE SE TAIT PAS : la scène 3D sans meuble ne dit
          rien de ce qu'il faut faire. On dit le geste, et le bouton y mène. */}
      {items.length === 0 && (
        <div data-piece-vide="" style={{ border: `1px solid ${C.border}`, borderRadius: 12, background: C.card, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ flex: '1 1 220px', minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: C.text }}>Ta pièce est vide</span>
            <span style={{ display: 'block', fontSize: 13, color: C.muted, marginTop: 2, lineHeight: 1.45 }}>Dessine ta pièce vue du dessus, puis ajoute une étagère, une table ou un portant : tu y ranges tes articles, et VRM retrouve chacun par son numéro.</span>
          </span>
          <button type="button" data-piece-vide-geste="" onClick={() => { setEdition(true); const d = refAmenager.current; if (d) { d.open = true; try { setTimeout(() => d.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); } catch (_) {} } }} style={{ border: 'none', background: C.accent, color: C.onAccent || '#fff', borderRadius: 10, padding: '0 16px', minHeight: 40, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Ajouter un meuble</button>
        </div>
      )}

      {ranger && (
        <RangerSheet
          paires={aRanger}
          apercu={(() => { const it = items.find(x => x.id === ranger.itemId); return it ? { it, cellKey: ranger.cellKey, mode: casesDe(it, room.wallH).mode, cap: casesDe(it, room.wallH).cap } : null; })()}
          cellNom={(() => { const it = items.find(x => x.id === ranger.itemId); if (!it) return ''; const nr = Math.max(1, it.rows || 1); const cz = casesDe(it, room.wallH); return `${it.name || ''} · ${nomCase(nr, ranger.cellKey, cz.mode, it)}`; })()}
          onPick={(p) => { const r = ranger; setRanger(null); poserDansCase(r.itemId, r.cellKey, p.numero); }}
          onLibre={async () => { const r = ranger; setRanger(null); poserDansCase(r.itemId, r.cellKey, await askText({ numeric: clavierNum() === 'numeric', desc: 'Numéro à ranger dans cette case :', value: '' })); }}
          onClose={() => setRanger(null)}
        />
      )}


      {/* Sélecteur de pièces — passer d'une pièce à l'autre */}
      {/* (16 oct.) UNE pièce : pas de pastille « Ma pièce » sélectionnée — l'onglet
          du dessus le dit déjà (elle apparaissait sélectionnée DEUX fois). Les
          pastilles ne servent qu'à passer d'une pièce à l'autre, à partir de deux,
          et la pièce choisie est marquée en NEUTRE (§7 : l'accent ne sélectionne pas). */}
      <div data-pieces={plan.rooms.length} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        {plan.rooms.length > 1 && <span style={{ fontSize: 13, color: C.muted, fontWeight: 500, alignSelf: 'center', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="home" size={13}/>Pièces :</span>}
        {plan.rooms.length > 1 && plan.rooms.map(r => {
          const on = r.id === activeRoom.id;
          return (
            <button type="button" key={r.id} onClick={() => switchRoom(r.id)} aria-pressed={on} style={{ border: `1px solid ${on ? C.text : C.border}`, borderRadius: 999, background: on ? `${C.text}12` : C.card, color: C.text, fontSize: 13, fontWeight: on ? 600 : 500, padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>
              {r.name}{r.items && r.items.length ? ` · ${r.items.length}` : ''}
            </button>
          );
        })}
        <button type="button" onClick={addRoom} title="Ajouter une pièce" style={{ border: `1px dashed ${C.border}`, borderRadius: 999, background: 'transparent', color: C.text, fontSize: 13, fontWeight: 600, padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>＋ {plan.rooms.length > 1 ? 'Pièce' : 'Ajouter une pièce'}</button>
        <button className="vrm-icon-control" type="button" aria-label="Renommer la pièce" onClick={renameRoom} title="Renommer la pièce" style={{ border: `1px solid ${C.border}`, borderRadius: 999, background: 'transparent', color: C.muted, fontSize: 12, padding: '6px 9px', cursor: 'pointer' }}><Icon name="pencil" size={15}/></button>
        {plan.rooms.length > 1 && <button className="vrm-icon-control" type="button" aria-label="Supprimer la pièce" onClick={removeRoom} title="Supprimer la pièce" style={{ border: `1px solid ${C.border}`, borderRadius: 999, background: 'transparent', color: C.warn, fontSize: 12, padding: '6px 9px', cursor: 'pointer' }}><Icon name="trash" size={16}/></button>}
      </div>
      {/* ⚠️ UTILISER AVANT AMÉNAGER. Julien : « mets-toi à la place d'un
          revendeur pour son rangement, ça doit être plus facile à prendre en
          main ». Un revendeur ouvre son garage pour DEUX choses : retrouver une
          paire, ou en ranger une — pas pour ajouter un canapé. Tout l'outillage
          de construction (meubles, dimensions, murs, déplacement) part donc
          derrière un seul dépliant, et l'écran s'ouvre sur la pièce + la
          recherche. */}
      <details ref={refAmenager} data-amenager="" onToggle={(e) => { const o = e.currentTarget.open; if (o !== edition) setEdition(o); }} style={{ display: edition ? 'block' : 'none', border: `1px solid ${C.border}`, borderRadius: 12, background: C.card, boxShadow: C.shadow }}>
        {/* ⚠️ `listStyle:none` retire le triangle du navigateur : sans repère
            ajouté, plus rien ne dit que ça s'ouvre. On pose donc un chevron. */}
        <summary style={{ cursor: 'pointer', listStyle: 'none', padding: '11px 13px', userSelect: 'none', display: 'flex', alignItems: 'center', gap: 10 }} onClick={(e) => { e.preventDefault(); setEdition(false); }} title="Revenir au rangement">
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: C.text }}>Aménager la pièce</span>
            <span style={{ display: 'block', fontSize: 11.5, color: C.muted, marginTop: 2 }}>Ajoute un meuble, règle-le, glisse-le à sa place. Les numéros rangés ne bougent pas.</span>
          </span>
          <span style={{ flexShrink: 0, color: C.accent, fontSize: 13, fontWeight: 600 }}>Terminer</span>
        </summary>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 13px 13px' }}>
        {/* ── PALETTE DE CONSTRUCTION ──────────────────────────────────────────
            Deux familles, et la distinction n'est pas cosmétique : un RANGEMENT
            porte des cases, reçoit des numéros et compte dans l'inventaire ; un
            objet de DÉCOR ne range rien. Les mélanger dans une seule rangée de
            trente boutons rendait le rangement introuvable. */}
        {(() => {
          const tous = Object.entries(FURN_TYPES).filter(([, t]) => !t.hidden);
          const groupes = [
            ['Rangement', tous.filter(([, t]) => !t.deco), "Ils portent des cases et des numéros."],
            ['Murs',      tous.filter(([, t]) =>  t.structure), "Portes et fenêtres : elles se collent au mur."],
            ['Décor',     tous.filter(([, t]) =>  t.deco && !t.structure), "Pour que la pièce ressemble à la tienne. Ne range rien."],
          ];
          return groupes.map(([titre, liste, aide]) => liste.length ? (
            <div key={titre} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span title={aide} style={{ fontSize: 11.5, color: C.muted, fontWeight: 700, alignSelf: 'center', minWidth: 74 }}>{titre}</span>
              {liste.map(([k, t]) => (
                <button type="button" key={k} onClick={() => addFurn(k)} title={aide} style={{ border: `1px solid ${C.border}`, borderRadius: 999, background: C.card, color: C.text, fontSize: 12, fontWeight: 600, padding: '6px 11px', cursor: 'pointer', fontFamily: 'inherit' }}>{t.emoji} {k === 'autre' ? 'Autre…' : t.label}</button>
              ))}
            </div>
          ) : null);
        })()}
        {/* (17 oct.) LA PIÈCE VUE DU DESSUS : sa forme (on tire les coins) et ses meubles. */}
        <PlanDessus room={room} poly={poly} items={items} sel={sel} onSelect={(id) => setSel(id)} cibles={cibles3D}
          onPoly={(np) => { const n = normaliserPoly(np); if (!n) { toast('Cette forme ne fait pas une pièce (elle se recoupe, ou fait moins d\'1 m²).'); return; }
            // Le plan se décale si un coin passe sous 0 : tout ce qui est posé suit, rien ne bouge par rapport aux murs.
            const bouges = items.map(o => ({ ...o, x: +(o.x - n.dx).toFixed(2), y: +(o.y - n.dy).toFixed(2) }));
            const dehors = bouges.filter(o => !rectDans(empreinte(o).cx, empreinte(o).cy, empreinte(o).w, empreinte(o).h, n.poly) && !['cadre', 'fenetre'].includes((FURN_TYPES[o.type] || {}).build));
            if (dehors.length) { toast(`${dehors.length} meuble${dehors.length > 1 ? 's seraient' : ' serait'} hors de la pièce (« ${dehors[0].name} ») — déplace-${dehors.length > 1 ? 'les' : 'le'} d'abord.`); return; }
            const estRect = n.poly.length === 4 && n.poly.every(([x, y]) => (x === 0 || x === n.w) && (y === 0 || y === n.h));
            patchRoom(r => ({ room: { ...r.room, w: n.w, h: n.h, poly: estRect ? undefined : n.poly }, items: bouges })); signalerDisposition(); }}
          onMove={(id, x, y) => {
            // Une PILE glissée dans le plan se pose SUR le meuble à surface qu'elle
            // vise (une table…), sinon AU SOL — jamais en l'air au-dessus du vide.
            const it = items.find(o => o.id === id) || {}; const ft = FURN_TYPES[it.type] || {};
            let lift;
            if (ft.pile) { const essai = { ...it, x, y, lift: 1 }; const sous = items.find(o => o.id !== id && isSurface(o) && estPoseSur(essai, o)); lift = sous ? furnTop(sous) : 0; }
            moveItem(id, x, y, it.rot || 0, null, lift);
          }} />
        {/* Taille de la pièce */}
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap', fontSize: 11.5, color: C.muted }}>
          <span style={{ fontWeight: 800 }}>Pièce {room.w}×{room.h} :</span>
          <button type="button" onClick={() => setRoom(1, 0)} style={{ border: `1px solid ${C.border}`, borderRadius: 6, background: 'transparent', color: C.text, fontWeight: 700, padding: '3px 8px', cursor: 'pointer' }}>largeur +</button>
          <button className="vrm-icon-control" type="button" aria-label="Réduire la largeur de la pièce" onClick={() => setRoom(-1, 0)} style={{ border: `1px solid ${C.border}`, borderRadius: 6, background: 'transparent', color: C.text, fontWeight: 700, padding: '3px 8px', cursor: 'pointer' }}>−</button>
          <button type="button" onClick={() => setRoom(0, 1)} style={{ border: `1px solid ${C.border}`, borderRadius: 6, background: 'transparent', color: C.text, fontWeight: 700, padding: '3px 8px', cursor: 'pointer' }}>profondeur +</button>
          <button className="vrm-icon-control" type="button" aria-label="Réduire la profondeur de la pièce" onClick={() => setRoom(0, -1)} style={{ border: `1px solid ${C.border}`, borderRadius: 6, background: 'transparent', color: C.text, fontWeight: 700, padding: '3px 8px', cursor: 'pointer' }}>−</button>
          <span style={{ fontWeight: 800, marginLeft: 8 }}>Plafond :</span>
          <button className="vrm-icon-control" type="button" aria-label="Augmenter la hauteur du plafond" onClick={() => patchRoom(r => ({ room: { ...r.room, wallH: Math.min(6, Math.round(((r.room.wallH || 3.4) + 0.4) * 10) / 10) } }))} style={{ border: `1px solid ${C.border}`, borderRadius: 6, background: 'transparent', color: C.text, fontWeight: 700, padding: '3px 8px', cursor: 'pointer' }}>+</button>
          <button className="vrm-icon-control" type="button" aria-label="Réduire la hauteur du plafond" onClick={() => patchRoom(r => ({ room: { ...r.room, wallH: Math.max(2.4, Math.round(((r.room.wallH || 3.4) - 0.4) * 10) / 10) } }))} style={{ border: `1px solid ${C.border}`, borderRadius: 6, background: 'transparent', color: C.text, fontWeight: 700, padding: '3px 8px', cursor: 'pointer' }}>−</button>
          <span style={{ fontWeight: 800, marginLeft: 8 }}>Murs :</span>
          {['#e4e8ee', '#dfe7d8', '#efe4d6', '#e2dced', '#d6e6ec', '#f0dede', '#d8dde3', '#2b2f36'].map(c => (
            <button type="button" aria-label={`Couleur de mur ${['#e4e8ee', '#dfe7d8', '#efe4d6', '#e2dced', '#d6e6ec', '#f0dede', '#d8dde3', '#2b2f36'].indexOf(c)+1}`} aria-pressed={(room.wallColor || '#e4e8ee')===c} key={c} onClick={() => patchRoom(r => ({ room: { ...r.room, wallColor: c } }))} title="Couleur des murs" style={{ width: 18, height: 18, borderRadius: 4, background: c, border: (room.wallColor || '#e4e8ee') === c ? `2px solid ${C.accent}` : '1px solid rgba(0,0,0,0.2)', cursor: 'pointer', padding: 0 }} />
          ))}
          <label title="Couleur libre des murs" style={{ width: 20, height: 20, borderRadius: 4, overflow: 'hidden', border: `1px solid ${C.border}`, cursor: 'pointer', position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, background: `conic-gradient(red,orange,yellow,lime,cyan,blue,magenta,red)` }}>
            <input type="color" value={room.wallColor || '#e4e8ee'} onChange={e => patchRoom(r => ({ room: { ...r.room, wallColor: e.target.value } }))} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />🎨
          </label>
        </div>

        {/* Mode déplacement — les meubles ne bougent QUE si ce mode est activé */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setMoveMode(m => !m)} style={{ border: `1.5px solid ${moveMode ? C.accent : C.border}`, borderRadius: 999, background: moveMode ? C.accent : C.card, color: moveMode ? '#fff' : C.text, fontSize: 12.5, fontWeight: 800, padding: '7px 14px', cursor: 'pointer', fontFamily: 'inherit' }}>
            {moveMode ? '✋ Mode déplacement ACTIVÉ' : '🔒 Déplacer les meubles'}
          </button>
          <span style={{ fontSize: 11.5, color: C.muted }}>{moveMode ? 'Glisse un meuble pour le déplacer. Re-clique pour verrouiller.' : 'Les meubles sont verrouillés — glisse pour tourner la vue.'}</span>
        </div>
        </div>
      </details>

      {/* Bandeau « poser une pile sur un meuble » actif */}
      {putOnSrc && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '8px 11px', border: `1.5px solid ${C.accent}`, borderRadius: 10, background: `${C.accent}14` }}>
          <span style={{ fontSize: 12.5, fontWeight: 800, color: C.text }}>👆 Touche le <b>meuble</b> (table, commode…) sur lequel poser la pile — elle se posera dessus, centrée.</span>
          <button type="button" onClick={() => setPutOnSrc(null)} style={{ marginLeft: 'auto', border: `1px solid ${C.border}`, borderRadius: 8, background: 'transparent', color: C.muted, fontSize: 12, fontWeight: 700, padding: '5px 10px', cursor: 'pointer' }}>Annuler</button>
        </div>
      )}
      {/* Bandeau « empiler par toucher » actif */}
      {stackSrc && (()=>{ const s = items.find(o => o.id === stackSrc); return (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '8px 11px', border: `1.5px solid ${C.accent}`, borderRadius: 10, background: `${C.accent}14` }}>
          <span style={{ fontSize: 12.5, fontWeight: 800, color: C.text }}>👆 Touche la boîte sur laquelle poser <b>N°{(s && s.num) || '?'}</b> (elle montera dessus).</span>
          <button type="button" onClick={() => setStackSrc(null)} style={{ marginLeft: 'auto', border: `1px solid ${C.border}`, borderRadius: 8, background: 'transparent', color: C.muted, fontSize: 12, fontWeight: 700, padding: '5px 10px', cursor: 'pointer' }}>Annuler</button>
        </div>
      ); })()}

      {/* Tableau de bord d'occupation de la pièce */}
      {items.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 12, background: C.card, fontSize: 12.5 }}>
          <span style={{ fontWeight: 900, color: C.text }}>📊 {activeRoom.name}</span>
          <span style={{ fontWeight: 800, color: INV_STATUS.online.color }}>📦 {capacity.boxes} boîte{capacity.boxes > 1 ? 's' : ''} rangée{capacity.boxes > 1 ? 's' : ''}</span>
          {capacity.freeCells > 0 && <span style={{ fontWeight: 700, color: C.muted }}>· {capacity.freeCells} place{capacity.freeCells > 1 ? 's' : ''} libre{capacity.freeCells > 1 ? 's' : ''}</span>}
          <span style={{ fontWeight: 700, color: C.muted }}>· {capacity.furn} meuble{capacity.furn > 1 ? 's' : ''}</span>
        </div>
      )}
      {/* 👣 LA pièce en 3D — glisser tourne la vue ; en mode déplacement, glisser un meuble le bouge */}

      {/* Barre du meuble sélectionné */}
      {selItem && (
        <div data-meuble-choisi={selItem.id} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', padding: '9px 11px', border: `1px solid ${C.accent}`, borderRadius: 12, background: `${C.accent}0c` }}>
          <span style={{ fontSize: 13, fontWeight: 900, color: C.text, flex: '1 1 100%', marginBottom: 2 }}>{emojiOf(selItem)} {selItem.name}{(FURN_TYPES[selItem.type] || {}).box && selItem.num ? ` — N°${selItem.num}` : ''}</span>
          {/* ── CE QU'IL Y A DEDANS ────────────────────────────────────────
              Le garage savait ranger, pas MONTRER. On voit maintenant chaque
              paire du meuble — photo, N°, titre — et on peut la SORTIR d'un
              tap (elle monte et s'efface avant d'être retirée). */}
          {(() => {
            const dedans = contenuMeuble(selItem);
            if (!dedans.length) return null;
            return (
              <div style={{ flex: '1 1 100%', marginBottom: 6 }}>
                <div className="vrm-label" style={{ color: C.muted, marginBottom: 6 }}>
                  {dedans.length} paire{dedans.length > 1 ? 's' : ''} dans ce meuble
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 6, maxHeight: 230, overflowY: 'auto' }}>
                  {dedans.map(p => (
                    <div key={p.cell + '_' + p.numero} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 9px', borderRadius: 12, border: `1px solid ${C.border}`, background: C.card, minWidth: 0 }}>
                      {p.photo
                        ? <PhotoVinted src={p.photo} alt="" style={{ width: 36, height: 36, borderRadius: 9, objectFit: 'cover', flexShrink: 0, background: C.card2 }}/>
                        : <span style={{ width: 36, height: 36, borderRadius: 9, background: C.card2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}><Icon name="image" size={20} style={{color:C.muted,opacity:.55}}/></span>}
                      <span style={{ flex: '1 1 90px', minWidth: 0 }}>
                        <span className="vrm-display" style={{ display: 'block', fontSize: 14, fontWeight: 700, color: C.accent }}>N°{p.numero}</span>
                        <span style={{ display: 'block', fontSize: 11, color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.ambigu ? '⚠️ N° porté par plusieurs paires' : (p.title || '—')}
                        </span>
                      </span>
                      <button type="button" onClick={() => sortirDeCase(selItem.id, p.cell, p.numero)} title="Sortir cette paire du stock"
                        style={{ flexShrink: 0, border: `1px solid ${C.border}`, borderRadius: 9, background: 'transparent', color: C.muted, fontSize: 11.5, fontWeight: 600, padding: '6px 9px', cursor: 'pointer', fontFamily: 'inherit' }}>Sortir</button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
          {/* Boîte à empiler : empiler (par toucher), reposer au sol, changer le N° */}
          {(FURN_TYPES[selItem.type] || {}).box && (
            <div style={{ flex: '1 1 100%', display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
              <button type="button" onClick={() => setStackSrc(selItem.id)} style={{ flex: '1 1 auto', border: 'none', borderRadius: 8, background: C.accent, color: '#fff', fontSize: 12.5, fontWeight: 900, padding: '9px 12px', cursor: 'pointer' }}>⬆️ Poser sur une autre boîte</button>
              {(selItem.lvl || 0) > 0 && <button type="button" onClick={() => boxToFloor(selItem)} style={{ flex: '0 0 auto', border: `1px solid ${C.border}`, borderRadius: 8, background: 'transparent', color: C.text, fontSize: 12, fontWeight: 800, padding: '9px 11px', cursor: 'pointer' }}>⬇️ Au sol</button>}
              <button type="button" onClick={async ()=>{ const n = (await askText({ numeric: clavierNum() === 'numeric', desc: 'Numéro de cette boîte :', value: selItem.num || '' }) || '').trim(); if (n) updateItem(selItem.id, { num: n }); }} style={{ flex: '0 0 auto', border: `1px solid ${C.border}`, borderRadius: 8, background: 'transparent', color: C.text, fontSize: 12, fontWeight: 800, padding: '9px 11px', cursor: 'pointer' }}>✏️ N°{selItem.num || '?'}</button>
            </div>
          )}
          {!edition && (()=>{
            const ft = FURN_TYPES[selItem.type] || {};
            const p = ft.build === 'pile' ? null : prochainePlaceMeuble(selItem, ft, room.wallH || 3.4);
            return (
              <div style={{ flex: '1 1 100%', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {ft.cases && <span style={{ fontSize: 12.5, color: C.muted, flex: '1 1 200px' }}>{p ? <>Prochaine place libre : <b style={{ color: C.text }}>{nomCase(Math.max(1, selItem.rows || 1), p.cell, modeCase(ft), selItem)}</b></> : 'Ce meuble est plein.'} Touche une place libre (en transparence) pour y ranger ; une boîte pour la changer ou la sortir.</span>}
                {ft.cases && p && <button type="button" data-ranger-dans-meuble="" onClick={() => { if (pairePrete) rangerPaire(pairePrete, selItem.id, p.cell); else fillCell(selItem.id, p.cell, { ghost: true }); }} style={{ border: 'none', borderRadius: 10, background: C.accent, color: C.onAccent || '#fff', fontSize: 13, fontWeight: 600, padding: '0 14px', minHeight: 36, cursor: 'pointer', fontFamily: 'inherit' }}>{pairePrete ? `Ranger N°${pairePrete} ici` : 'Ranger une paire ici'}</button>}
                {ft.build === 'pile' && <span style={{ fontSize: 12.5, color: C.muted }}>Touche une boîte pour changer son numéro ou le retirer — ceux du dessus descendent d'un cran.</span>}
                {!ft.cases && ft.build !== 'pile' && !ft.box && !ft.deco && <button type="button" onClick={() => setOpenItem(selItem.id)} style={{ border: 'none', borderRadius: 10, background: C.accent, color: C.onAccent || '#fff', fontSize: 13, fontWeight: 600, padding: '0 14px', minHeight: 36, cursor: 'pointer', fontFamily: 'inherit' }}>Ranger dedans ({storedCount(selItem)})</button>}
                <button type="button" onClick={() => setEdition(true)} style={{ marginLeft: 'auto', border: `1px solid ${C.border}`, borderRadius: 10, background: 'transparent', color: C.text, fontSize: 12.5, fontWeight: 600, padding: '0 12px', minHeight: 34, cursor: 'pointer', fontFamily: 'inherit' }}>Régler ce meuble</button>
              </div>
            );
          })()}
          {edition && (<>
          {/* Personnalisation : couleur + hauteur */}
          <div style={{ flex: '1 1 100%', display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontSize: 10.5, color: C.muted, fontWeight: 700 }}>Couleur</span>
            {FURN_COLORS.map(c => (<button type="button" aria-label={`Couleur de meuble ${FURN_COLORS.indexOf(c)+1}`} aria-pressed={colorOf(selItem)===c} key={c} onClick={() => updateItem(selItem.id, { color: c })} style={{ width: 20, height: 20, borderRadius: 5, background: c, border: colorOf(selItem) === c ? `2px solid ${C.text}` : '1px solid rgba(0,0,0,0.2)', cursor: 'pointer', padding: 0 }} />))}
            <label title="Couleur libre" style={{ width: 22, height: 22, borderRadius: 5, overflow: 'hidden', border: `1px solid ${C.border}`, cursor: 'pointer', position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, background: `conic-gradient(red,orange,yellow,lime,cyan,blue,magenta,red)` }}>
              <input type="color" value={colorOf(selItem)} onChange={e => updateItem(selItem.id, { color: e.target.value })} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />🎨
            </label>
            {!(FURN_TYPES[selItem.type] || {}).box && <button type="button" onClick={async ()=>{ const e = (await askText({ desc: 'Emoji du meuble :', value: emojiOf(selItem) }) || '').trim(); if (e) updateItem(selItem.id, { emoji: e }); }} title="Changer l'emoji" style={{ border: `1px solid ${C.border}`, borderRadius: 6, background: 'transparent', fontSize: 13, padding: '2px 7px', cursor: 'pointer' }}>{emojiOf(selItem)}</button>}
            {(FURN_TYPES[selItem.type] || {}).build !== 'grille' && !(FURN_TYPES[selItem.type] || {}).box && !(FURN_TYPES[selItem.type] || {}).cases && <>
              <span style={{ fontSize: 10.5, color: C.muted, fontWeight: 700, marginLeft: 6 }}>Hauteur</span>
              {[['Bas', 0.5], ['Moyen', 1.0], ['Haut', 1.8]].map(([l, v]) => (<button type="button" key={l} onClick={() => updateItem(selItem.id, { h3d: v })} style={{ border: `1px solid ${Math.abs(h3dOf(selItem) - v) < 0.01 ? C.accent : C.border}`, borderRadius: 6, background: Math.abs(h3dOf(selItem) - v) < 0.01 ? `${C.accent}18` : 'transparent', color: C.text, fontSize: 10.5, fontWeight: 700, padding: '3px 8px', cursor: 'pointer' }}>{l}</button>))}
            </>}
          </div>
          {/* (17 oct.) ÉTAGÈRE, TABLE, PORTANT : combien de cases, de plateaux, de cintres. */}
          {(FURN_TYPES[selItem.type] || {}).cases && (()=>{
            const ft = FURN_TYPES[selItem.type]; const { nr, nc } = dimsMeuble(selItem); const cz = casesDe(selItem, room.wallH);
            const stepBtn = { border: `1px solid ${C.border}`, borderRadius: 8, background: C.card, color: C.text, fontSize: 15, fontWeight: 700, minWidth: 36, minHeight: 36, cursor: 'pointer', lineHeight: 1 };
            const pas = (lib, val, moins, plus, cle) => (
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }} data-reglage={cle}>
                <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>{lib}</span>
                <button className="vrm-icon-control" type="button" aria-label={`${lib} : moins`} onClick={moins} style={stepBtn}>−</button>
                <b style={{ fontSize: 14, minWidth: 18, textAlign: 'center' }}>{val}</b>
                <button className="vrm-icon-control" type="button" aria-label={`${lib} : plus`} onClick={plus} style={stepBtn}>+</button>
              </span>);
            return (
              <div style={{ flex: '1 1 100%', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4, padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 10 }}>
                {ft.build === 'metal' && pas('Niveaux', nr, () => changerCases(selItem, 0, -1), () => changerCases(selItem, 0, 1), 'plateaux')}
                {ft.build === 'metal' && pas('Hauteur d’un niveau', `${Math.round(hauteurNiveau(selItem) * 100)} cm`, () => changerNiveau(selItem, -0.05), () => changerNiveau(selItem, 0.05), 'niveau')}
                {pas('Largeur', `${Math.round(selItem.w * 100)} cm`, () => changerDimensions(selItem, { w: +Math.max(0.4, selItem.w - 0.1).toFixed(2) }), () => changerDimensions(selItem, { w: +Math.min(room.w, selItem.w + 0.1).toFixed(2) }), 'largeur')}
                {pas('Profondeur', `${Math.round(selItem.h * 100)} cm`, () => changerDimensions(selItem, { h: +Math.max(0.25, selItem.h - 0.05).toFixed(2) }), () => changerDimensions(selItem, { h: +Math.min(room.h, selItem.h + 0.05).toFixed(2) }), 'profondeur')}
                {pas(ft.build === 'portant' ? 'Cintres' : ft.build === 'table' ? 'Places sur le plateau' : 'Cases par plateau', nc, () => changerCases(selItem, -1, 0), () => changerCases(selItem, 1, 0), 'cases')}
                <span style={{ fontSize: 12, color: C.muted }}>{cz.mode === 'cintre' ? `${nc} cintres` : `${nr * nc} case${nr * nc > 1 ? 's' : ''} · jusqu'à ${cz.cap} boîte${cz.cap > 1 ? 's' : ''} empilée${cz.cap > 1 ? 's' : ''} par case`}</span>
              </div>
            );
          })()}
          {/* GRILLE personnalisable : nb de colonnes, de rangées, taille des cases */}
          {(FURN_TYPES[selItem.type] || {}).build === 'grille' && (()=>{
            const stepBtn = { border: `1px solid ${C.border}`, borderRadius: 6, background: C.card, color: C.text, fontSize: 13, fontWeight: 800, width: 26, height: 26, cursor: 'pointer', lineHeight: 1 };
            const cellCm = Math.round((selItem.cell || 0.5) * 100);
            return (
              <div style={{ flex: '1 1 100%', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4, padding: '7px 9px', border: `1px dashed ${C.border}`, borderRadius: 9 }}>
                <span style={{ fontSize: 11, color: C.text, fontWeight: 900 }}>🔳 Grille</span>
                <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><span style={{ fontSize: 10.5, color: C.muted, fontWeight: 700 }}>↔ Boîtes en largeur</span><button className="vrm-icon-control" type="button" aria-label="Réduire les colonnes" onClick={() => gridCols(selItem, -1)} style={stepBtn}>−</button><b style={{ fontSize: 13, minWidth: 16, textAlign: 'center' }}>{selItem.cols || 4}</b><button className="vrm-icon-control" type="button" aria-label="Augmenter les colonnes" onClick={() => gridCols(selItem, 1)} style={stepBtn}>+</button></span>
                <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><span style={{ fontSize: 10.5, color: C.muted, fontWeight: 700 }}>↕ Boîtes en hauteur</span><button className="vrm-icon-control" type="button" aria-label="Réduire les rangées" onClick={() => gridRows(selItem, -1)} style={stepBtn}>−</button><b style={{ fontSize: 13, minWidth: 16, textAlign: 'center' }}>{selItem.rows || 3}</b><button className="vrm-icon-control" type="button" aria-label="Augmenter les rangées" onClick={() => gridRows(selItem, 1)} style={stepBtn}>+</button><button type="button" onClick={() => gridToCeiling(selItem)} title="Empiler jusqu'au plafond" style={{ border: `1px solid ${C.border}`, borderRadius: 6, background: 'transparent', color: C.text, fontSize: 10.5, fontWeight: 800, padding: '3px 7px', cursor: 'pointer' }}>⬆️ Plafond</button></span>
                <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><span style={{ fontSize: 10.5, color: C.muted, fontWeight: 700 }}>Taille case</span><button className="vrm-icon-control" type="button" aria-label="Réduire la taille des cases" onClick={() => gridCell(selItem, -0.06)} style={stepBtn}>−</button><b style={{ fontSize: 12, minWidth: 34, textAlign: 'center' }}>{cellCm} cm</b><button className="vrm-icon-control" type="button" aria-label="Augmenter la taille des cases" onClick={() => gridCell(selItem, 0.06)} style={stepBtn}>+</button></span>
                <span style={{ fontSize: 10.5, color: C.muted, fontWeight: 700 }}>= {(selItem.cols || 4) * (selItem.rows || 3)} places</span>
                <button type="button" onClick={() => addBoxToGrid(selItem)} title="Pose une boîte à la prochaine place libre (repère bleu)" style={{ border: 'none', borderRadius: 7, background: C.accent, color: '#fff', fontSize: 11.5, fontWeight: 900, padding: '6px 11px', cursor: 'pointer' }}>➕ Ajouter une boîte</button>
                <button type="button" onClick={() => fillGridSeries(selItem)} title="Remplir toutes les places vides en croissant" style={{ border: `1px solid ${C.accent}`, borderRadius: 7, background: `${C.accent}14`, color: C.text, fontSize: 11, fontWeight: 800, padding: '5px 9px', cursor: 'pointer' }}>🔢 Remplir en série</button>
                <button type="button" onClick={() => clearGrid(selItem)} title="Vider toutes les cases" style={{ border: `1px solid ${C.border}`, borderRadius: 7, background: 'transparent', color: C.muted, fontSize: 11, fontWeight: 700, padding: '5px 9px', cursor: 'pointer' }}>🧹 Vider</button>
              </div>
            );
          })()}
          {/* PILE de boîtes : nb de boîtes (±) + hauteur par colonne + renuméroter */}
          {(FURN_TYPES[selItem.type] || {}).build === 'pile' && (()=>{
            const stepBtn = { border: `1px solid ${C.border}`, borderRadius: 6, background: C.card, color: C.text, fontSize: 13, fontWeight: 800, width: 26, height: 26, cursor: 'pointer', lineHeight: 1 };
            const nums = pileNums(selItem), total = cartonsDePile(nums).length, rows = Math.max(1, selItem.rows || 5), cols = Math.max(1, Math.ceil(nums.length / rows));
            return (
              <div style={{ flex: '1 1 100%', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4, padding: '7px 9px', border: `1px dashed ${C.border}`, borderRadius: 9 }}>
                <span style={{ fontSize: 11, color: C.text, fontWeight: 900 }}>📦 Pile</span>
                <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><span style={{ fontSize: 10.5, color: C.muted, fontWeight: 700 }}>Nombre de boîtes</span><button className="vrm-icon-control" type="button" aria-label="Retirer la dernière boîte de la pile" onClick={() => pileRemoveLast(selItem)} style={stepBtn}>−</button><b style={{ fontSize: 14, minWidth: 24, textAlign: 'center' }}>{total}</b><button className="vrm-icon-control" type="button" aria-label="Ajouter une boîte à la pile" onClick={() => pileAdd(selItem)} style={stepBtn}>+</button></span>
                <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><span style={{ fontSize: 10.5, color: C.muted, fontWeight: 700 }}>Boîtes de haut</span><button className="vrm-icon-control" type="button" aria-label="Réduire la hauteur de la pile" onClick={() => pileHeight(selItem, -1)} style={stepBtn}>−</button><b style={{ fontSize: 12, minWidth: 14, textAlign: 'center' }}>{rows}</b><button className="vrm-icon-control" type="button" aria-label="Augmenter la hauteur de la pile" onClick={() => pileHeight(selItem, 1)} style={stepBtn}>+</button></span>
                <button type="button" onClick={() => pileRestart(selItem)} style={{ border: `1px solid ${C.accent}`, borderRadius: 7, background: `${C.accent}14`, color: C.text, fontSize: 11, fontWeight: 800, padding: '5px 9px', cursor: 'pointer' }}>🔢 Renuméroter</button>
                <button type="button" onClick={() => setPutOnSrc(selItem.id)} title="Poser cette pile sur un meuble (table, commode…)" style={{ border: 'none', borderRadius: 7, background: C.accent, color: '#fff', fontSize: 11, fontWeight: 900, padding: '6px 10px', cursor: 'pointer' }}>🪑 Poser sur un meuble</button>
                {(selItem.lift || 0) > 0 && <button type="button" onClick={() => updateItem(selItem.id, { lift: 0 })} title="Reposer la pile au sol" style={{ border: `1px solid ${C.border}`, borderRadius: 7, background: 'transparent', color: C.text, fontSize: 11, fontWeight: 800, padding: '5px 9px', cursor: 'pointer' }}>⬇️ Au sol</button>}
                <span style={{ fontSize: 10.5, color: C.muted, fontWeight: 700 }}>{cols} colonne{cols > 1 ? 's' : ''} · touche une boîte pour changer son N° ✏️ (ou la retirer)</span>
              </div>
            );
          })()}
          {!(FURN_TYPES[selItem.type] || {}).box && (FURN_TYPES[selItem.type] || {}).build !== 'pile' && !(FURN_TYPES[selItem.type] || {}).cases && <button type="button" onClick={() => setOpenItem(selItem.id)} style={{ border: 'none', borderRadius: 8, background: C.accent, color: '#fff', fontSize: 12, fontWeight: 800, padding: '7px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>📂 Ranger dedans ({storedCount(selItem)})</button>}
          {!(FURN_TYPES[selItem.type] || {}).box && <button type="button" onClick={() => stickToWall(selItem)} title="Coller au mur suivant" style={{ border: `1px solid ${C.accent}`, borderRadius: 8, background: `${C.accent}14`, color: C.text, fontSize: 12, fontWeight: 800, padding: '7px 10px', cursor: 'pointer' }}>📌 Coller au mur</button>}
          {(FURN_TYPES[selItem.type] || {}).build !== 'grille' && (FURN_TYPES[selItem.type] || {}).build !== 'pile' && !(FURN_TYPES[selItem.type] || {}).box && <>
            <button className="vrm-icon-control" type="button" aria-label="Pivoter" onClick={() => changerDimensions(selItem, { rot: ((selItem.rot || 0) + Math.PI / 2) % (2 * Math.PI) })} title="Pivoter" style={{ border: `1px solid ${C.border}`, borderRadius: 8, background: 'transparent', color: C.text, fontSize: 12, fontWeight: 700, padding: '7px 10px', cursor: 'pointer' }}>🔄</button>
            {!(FURN_TYPES[selItem.type] || {}).cases && <><button className="vrm-icon-control" type="button" aria-label="Élargir le meuble" onClick={() => changerDimensions(selItem, { w: Math.min(room.w, selItem.w + 0.5) })} style={{ border: `1px solid ${C.border}`, borderRadius: 8, background: 'transparent', color: C.text, fontSize: 12, fontWeight: 700, padding: '7px 10px', cursor: 'pointer' }}>↔️+</button>
            <button className="vrm-icon-control" type="button" aria-label="Réduire la largeur du meuble" onClick={() => changerDimensions(selItem, { w: Math.max(0.5, selItem.w - 0.5) })} style={{ border: `1px solid ${C.border}`, borderRadius: 8, background: 'transparent', color: C.text, fontSize: 12, fontWeight: 700, padding: '7px 10px', cursor: 'pointer' }}>↔️−</button>
            </>}
            {!(FURN_TYPES[selItem.type] || {}).cases && <><button className="vrm-icon-control" type="button" aria-label="Augmenter la profondeur du meuble" onClick={() => changerDimensions(selItem, { h: Math.min(room.h, selItem.h + 0.25) })} style={{ border: `1px solid ${C.border}`, borderRadius: 8, background: 'transparent', color: C.text, fontSize: 12, fontWeight: 700, padding: '7px 10px', cursor: 'pointer' }}>↕️+</button>
            <button className="vrm-icon-control" type="button" aria-label="Réduire la profondeur du meuble" onClick={() => changerDimensions(selItem, { h: Math.max(0.3, selItem.h - 0.25) })} style={{ border: `1px solid ${C.border}`, borderRadius: 8, background: 'transparent', color: C.text, fontSize: 12, fontWeight: 700, padding: '7px 10px', cursor: 'pointer' }}>↕️−</button></>}
          </>}
          <button className="vrm-icon-control" type="button" aria-label="Renommer le meuble" onClick={async ()=>{ const n = await askText({ desc: 'Nom du meuble :', value: selItem.name }); if (n != null && n.trim()) updateItem(selItem.id, { name: n.trim() }); }} style={{ border: `1px solid ${C.border}`, borderRadius: 8, background: 'transparent', color: C.text, fontSize: 12, fontWeight: 700, padding: '7px 10px', cursor: 'pointer' }}><Icon name="pencil" size={15}/></button>
          <button className="vrm-icon-control" type="button" aria-label="Dupliquer" onClick={() => dupItem(selItem)} title="Dupliquer" style={{ border: `1px solid ${C.border}`, borderRadius: 8, background: 'transparent', color: C.text, fontSize: 12, fontWeight: 700, padding: '7px 10px', cursor: 'pointer' }}>⧉</button>
          <button className="vrm-icon-control" type="button" aria-label="Supprimer le meuble" onClick={() => removeItem(selItem.id)} style={{ marginLeft: 'auto', border: `1px solid ${C.danger}66`, borderRadius: 8, background: `${C.danger}12`, color: C.danger, fontSize: 12, fontWeight: 800, padding: '7px 10px', cursor: 'pointer' }}><Icon name="trash" size={16}/></button>
          </>)}
        </div>
      )}
      {/* ⚠️ MODE D'EMPLOI PERMANENT → DÉPLIANT. Ce paragraphe de cinq lignes
          restait affiché sous la pièce, tous les jours, et parlait de piles de
          boîtes même quand la pièce est vide. On le lit UNE fois (§5.66). */}
      <details>
        <summary style={{ listStyle:'none', cursor:'pointer', fontSize:11.5, color:C.muted, fontWeight:600 }}>Comment ranger une pile de boîtes ?</summary>
        <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.55, marginTop:6 }}><b>Pile de boîtes</b> : colonnes + hauteur → auto-empilée. <b>Touche la pile</b> puis <b>Poser sur un meuble</b> → touche la table ou la commode : la pile se pose dessus, centrée. <b>Au sol</b> la redescend. Touche une boîte pour changer son N° (même dans le désordre) ou la retirer. En <b>mode déplacement</b>, glisse la pile pour la positionner.</div>
      </details>

      {/* Vue de FACE du meuble ouvert : ses tiroirs/rayons */}
      {opened && (
        <div onClick={() => setOpenItem(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.bg, borderRadius: 16, maxWidth: 460, width: '100%', maxHeight: '92vh', overflow: 'auto', padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 900, color: C.text, flex: 1 }}>{emojiOf(opened)} {opened.name}</span>
              <button className="vrm-icon-control" type="button" aria-label="Fermer le contenu du meuble" onClick={() => setOpenItem(null)} style={{ border: 'none', background: 'transparent', color: C.muted, fontSize: 20, cursor: 'pointer', lineHeight: 1 }}><Icon name="close" size={15}/></button>
            </div>
            <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 10 }}>Vue de face — touche une case pour y ranger un N° (empilable).
              <span style={{ display: 'inline-flex', gap: 4, marginLeft: 8 }}>
                <button type="button" onClick={() => setGrid(opened, opened.rows + 1, opened.cols)} style={{ border: `1px solid ${C.border}`, borderRadius: 6, background: 'transparent', color: C.text, fontSize: 11, fontWeight: 700, padding: '2px 7px', cursor: 'pointer' }}>+ rangée</button>
                <button type="button" onClick={() => setGrid(opened, opened.rows, opened.cols + 1)} style={{ border: `1px solid ${C.border}`, borderRadius: 6, background: 'transparent', color: C.text, fontSize: 11, fontWeight: 700, padding: '2px 7px', cursor: 'pointer' }}>+ colonne</button>
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: colorOf(opened) + '22', border: `2px solid ${colorOf(opened)}`, borderRadius: 8, padding: 8 }}>
              {Array.from({ length: opened.rows }).map((_, r) => (
                <div key={r} style={{ display: 'flex', gap: 6 }}>
                  {Array.from({ length: opened.cols }).map((_, c)=>{
                    const cell = r + '_' + c; const arr = (opened.slots && opened.slots[cell]) || [];
                    const cellHi = hi && hi.itemId === opened.id && hi.cell === cell;
                    return (
                      <div key={c} onClick={() => cellAdd(opened, cell)} style={{ flex: 1, minHeight: 52, borderRadius: 6, border: `1.5px ${cellHi ? 'solid #e5484d' : 'dashed ' + C.border}`, background: cellHi ? '#e5484d18' : C.card, padding: 4, display: 'flex', flexWrap: 'wrap', gap: 3, alignContent: 'flex-start', cursor: 'pointer' }}>
                        {arr.length === 0 && <span style={{ margin: 'auto', color: C.muted, fontSize: 16 }}>＋</span>}
                        {arr.map((n, i) => (
                          <span key={i} onClick={async (e) => { e.stopPropagation(); if (await askConfirm({ title:`Retirer le N°${n} de cette case ?`, ok:'Retirer', danger:true })) cellRemove(opened, cell, n); }} style={{ background: C.accent, color: '#fff', borderRadius: 5, fontSize: 11, fontWeight: 800, padding: '2px 6px', height: 'fit-content' }}>{n}</span>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 8 }}>Touche une case pour ajouter un N°. Touche un N° pour le retirer. « + rangée / + colonne » ajuste la taille du meuble.</div>
          </div>
        </div>
      )}
    </div>
  );
}
// ── ASSISTANT DE RANGEMENT — la vue 2D ─────────────────────────────────────
// Quelle paire va dans quelle case : la liste « À ranger » (paires PRÉSENTES,
// avec un N°, posées nulle part), la PREMIÈRE case libre proposée une seule
// fois en tête (§7 : la même destination écrite sur chaque ligne serait une
// seule phrase), et c'est SON clic qui range — jamais tout seul. Une case qui
// porte le N° d'une paire partie est proposée « à libérer », sur son clic.
// « Pas su » (plan pas relu, liste des paires présentes jamais publiée) ⇒
// aucune proposition, et c'est dit. Aucun numéro n'est jamais modifié.
function AssistantRangement({ plan, planLu, ecrire, ficheParNum }) {
  const [q, setQ] = useState('');
  const [placer, setPlacer] = useState(null);   // N° en cours de placement « autre case »
  const [flash, setFlash] = useState(null);     // { itemId, key } — la case qu'on vient de remplir
  const [voirLiberer, setVoirLiberer] = useState(false);
  const presents = useMemo(() => numsPresents(), [plan]);
  const meubles = useMemo(() => meublesDuPlan(plan), [plan]);
  const plusieursPieces = ((plan && plan.rooms) || []).filter(rm => (rm.items || []).some(meubleACases)).length > 1;
  // Les fiches par CLÉ de numéro (photo, titre) — pour reconnaître la paire.
  const ficheDe = useMemo(() => { const m = {}; Object.entries(ficheParNum || {}).forEach(([n, f]) => { m[cleNum(n)] = { ...f, numero: n }; }); return m; }, [ficheParNum]);
  const ranges = useMemo(() => {
    const s = new Set();
    ((plan && plan.rooms) || []).forEach(rm => (rm.items || []).forEach(it => {
      Object.values(it.slots || {}).forEach(a => numsCase(a).forEach(v => s.add(cleNum(v))));
      if (Array.isArray(it.nums)) it.nums.forEach(v => { const k = cleNum(v); if (k) s.add(k); });
      if (it.num != null) { const k = cleNum(it.num); if (k) s.add(k); }
    }));
    return s;
  }, [plan]);
  const sur = planLu === true && presents != null;
  const aRanger = useMemo(() => !sur ? [] : Array.from(presents).filter(k => k && !ranges.has(k)).sort(triNum)
    .map(k => ({ cle: k, numero: (ficheDe[k] && ficheDe[k].numero) || k, title: (ficheDe[k] && ficheDe[k].title) || '', photo: (ficheDe[k] && ficheDe[k].photo) || null })), [sur, presents, ranges, ficheDe]);
  const aLiberer = useMemo(() => {
    if (!sur) return [];
    const out = [];
    meubles.forEach(m => Object.entries(m.vue).forEach(([key, a]) => a.forEach(v => { if (!presents.has(cleNum(v))) out.push({ itemId: m.it.id, itemName: m.it.name, roomName: m.roomName, key, nom: nomCase(m.nr, key, m.mode, m.it), numero: v }); })));
    return out.sort((a, b) => triNum(a.numero, b.numero));
  }, [sur, meubles, presents]);
  const partiesCles = useMemo(() => new Set(aLiberer.map(x => cleNum(x.numero))), [aLiberer]);
  const prochaine = useMemo(() => premiereCaseLibre(plan), [plan]);
  const totalCases = meubles.reduce((s, m) => s + m.nr * m.nc, 0);
  // Une case « libre » : vide (mur de boîtes, cintre) ou qui a encore de la place (plateau).
  const libresDe = (m) => m.mode === 'pile' ? Array.from({ length: m.nr * m.nc }, (_, i) => (m.vue[Math.floor(i / m.nc) + '_' + (i % m.nc)] || []).length < m.cap).filter(Boolean).length : (m.nr * m.nc - Object.keys(m.vue).length);
  const casesLibres = meubles.reduce((s, m) => s + libresDe(m), 0);
  const hit = q.trim() ? ouEstNumero(plan, q) : null;
  const hitRef = React.useRef(null);
  const hitCle = hit ? hit.itemId + ':' + hit.key : '';
  useEffect(() => { if (hitCle && hitRef.current) { try { hitRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }); } catch (_) {} } }, [hitCle]);

  const ranger = (numero, itemId, key) => {
    if (!sur) return;
    const r = rangerNumeroDansPlan(plan, itemId, key, numero);
    if (r.erreur) { toast(r.erreur); return; }
    ecrire(r.plan); setPlacer(null); setFlash({ itemId, key: r.ou.key, at: Date.now() });
    toast(`N°${numero} rangée : ${r.ou.itemName} · ${r.ou.nom}.`);
  };
  const liberer = async (x) => {
    if (!sur) return;
    if (!(await askConfirm({ title: `Libérer la case de la N°${x.numero} ?`, desc: `Elle n'est plus parmi tes paires en stock (vendue ou partie). Son numéro sort de « ${x.itemName} » — le numéro lui-même ne change pas.`, ok: 'Libérer la case', cancel: 'Annuler' }))) return;
    const next = libererNumeroDuPlan(plan, x.itemId, x.numero);
    if (!next) { toast('Ce numéro n\'est plus dans cette case — rien n\'a été changé.'); return; }
    ecrire(next); toast(`Case libérée : N°${x.numero} sortie de ${x.itemName}.`);
  };

  const raisonPasSu = planLu === undefined ? 'Je relis le plan de ton stock…'
    : planLu === false ? "Le plan de ton stock n'a pas pu être relu (la base n'a pas répondu) : je ne propose rien tant que je ne l'ai pas — rouvre cet écran dans un instant."
    : presents == null ? "Je ne sais pas encore quelles paires sont chez toi : ouvre une fois l'écran Annonces sur cet appareil, puis reviens ici. D'ici là je ne propose rien — ranger d'après une liste devinée mettrait une paire partie dans une case." : null;
  const btn = (primaire) => ({ border: primaire ? 'none' : `1px solid ${C.border}`, borderRadius: 8, background: primaire ? C.accent : 'transparent', color: primaire ? (C.onAccent || '#fff') : C.text, fontSize: 12.5, fontWeight: 600, padding: '8px 12px', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', minHeight: 36 });
  const carte = { border: `1px solid ${C.border}`, borderRadius: 12, background: C.card, boxShadow: C.shadow, padding: 14, minWidth: 0 };
  const titreBloc = (t, n) => <div className="vrm-label" style={{ color: C.muted, marginBottom: 10, display: 'flex', justifyContent: 'space-between', gap: 8 }}><span>{t}</span>{n != null ? <span style={{ color: C.text }}>{n}</span> : null}</div>;

  return (
    <div data-rangement="" style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      <style>{`.vrm-rgt{display:grid;gap:12px;grid-template-columns:minmax(0,1fr);align-items:start}
@media (min-width:1100px){.vrm-rgt{grid-template-columns:minmax(300px,370px) minmax(0,1fr)}}
.vrm-rgt-case{transition:transform .12s ease,box-shadow .15s ease,background .15s ease}
.vrm-rgt-case[data-cliquable="1"]:hover{transform:translateY(-1px);box-shadow:0 2px 8px rgba(0,0,0,.12)}
@keyframes vrmrgtpose{0%{transform:scale(.86);opacity:.4}60%{transform:scale(1.05)}100%{transform:scale(1);opacity:1}}
.vrm-rgt-grille{--rgt-c:60px;--rgt-h:46px}
@media (min-width:1100px){.vrm-rgt-grille{--rgt-c:72px;--rgt-h:48px}}
@media (prefers-reduced-motion:reduce){.vrm-rgt-case{transition:none;animation:none!important}}`}</style>

      {/* Le résumé, en texte neutre : des chiffres, pas des alertes. */}
      <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }} data-rgt-resume="">
        {sur
          ? <><b style={{ color: C.text }}>{aRanger.length}</b> paire{aRanger.length > 1 ? 's' : ''} à ranger · <b style={{ color: C.text }}>{casesLibres}</b> case{casesLibres > 1 ? 's' : ''} libre{casesLibres > 1 ? 's' : ''} sur {totalCases}{aLiberer.length ? <> · <b style={{ color: C.text }}>{aLiberer.length}</b> à libérer</> : null}</>
          : <>{totalCases} case{totalCases > 1 ? 's' : ''} dans {meubles.length} meuble{meubles.length > 1 ? 's' : ''}</>}
      </div>
      {raisonPasSu && <div data-rgt-passu="" style={{ ...carte, padding: '11px 13px', fontSize: 12.5, color: C.text, lineHeight: 1.5, boxShadow: 'none', background: C.bg }}>{raisonPasSu}</div>}

      {/* Où est la N° X ? — une lecture, aucune écriture. */}
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Où est la N° … ?" inputMode={clavierNum()} aria-label="Chercher un numéro dans le stock" data-rgt-cherche=""
          style={{ flex: 1, minWidth: 0, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 16, background: C.card, color: C.text, outline: 'none', fontFamily: 'inherit' }} />
        {q && <button className="vrm-icon-control" type="button" aria-label="Effacer la recherche" onClick={() => setQ('')} style={{ ...btn(false), padding: '0 12px' }}><Icon name="close" size={15} /></button>}
      </div>
      {q.trim() && <div data-rgt-trouve={hit ? '1' : '0'} style={{ fontSize: 12.5, color: hit ? C.text : C.muted, lineHeight: 1.45, marginTop: -4 }}>
        {hit ? <>N°{q.trim()} → <b>{hit.itemName}</b>{plusieursPieces ? ` (${hit.roomName})` : ''} · {hit.nom}</> : <>Aucune case ne porte la N°{q.trim()}.</>}
      </div>}

      <div className="vrm-rgt">
        {/* ── Colonne gauche : ce qu'il y a à faire ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          {sur && (
            <div style={carte} data-rgt-liste="">
              {titreBloc('À ranger', aRanger.length)}
              {aRanger.length === 0
                ? <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>Tout ce qui est chez toi est déjà posé dans une case.</div>
                : (<>
                  {prochaine
                    ? <div data-prochaine={`${prochaine.itemId}:${prochaine.key}`} style={{ fontSize: 12.5, color: C.text, lineHeight: 1.45, marginBottom: 10, padding: '9px 11px', borderRadius: 9, background: C.bg, border: `1px solid ${C.border}` }}>
                        Prochaine case libre : <b>{prochaine.itemName}</b>{plusieursPieces ? ` (${prochaine.roomName})` : ''} · {prochaine.nom}
                      </div>
                    : <div data-prochaine="" style={{ fontSize: 12.5, color: C.text, lineHeight: 1.45, marginBottom: 10 }}>Plus aucune case libre : agrandis une grille ou ajoute un meuble (Ma pièce → Aménager la pièce).</div>}
                  {placer && <div data-rgt-placer={placer} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, color: C.text, marginBottom: 10, padding: '8px 10px', borderRadius: 9, border: `1.5px solid ${C.accent}` }}>
                    <span style={{ flex: 1, minWidth: 0 }}>Touche une case entourée pour y ranger la <b>N°{placer}</b>.</span>
                    <button type="button" onClick={() => setPlacer(null)} style={btn(false)}>Annuler</button>
                  </div>}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 460, overflowY: 'auto' }}>
                    {aRanger.map(p => (
                      <div key={p.cle} data-a-ranger={p.numero} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 9px', borderRadius: 10, border: `1px solid ${placer === p.numero ? C.accent : C.border}`, background: C.card }}>
                        {p.photo
                          ? <PhotoVinted src={p.photo} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0, background: C.card2 }} />
                          : <span style={{ width: 40, height: 40, borderRadius: 8, background: C.card2, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="box" size={18} style={{ color: C.muted, opacity: .6 }} /></span>}
                        <span style={{ flex: '1 1 auto', minWidth: 0 }}>
                          <span className="vrm-display" style={{ display: 'block', fontSize: 15, fontWeight: 700, color: C.text }}>N°{p.numero}</span>
                          <span style={{ display: 'block', fontSize: 11.5, color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title || 'paire présente'}</span>
                        </span>
                        <span style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          {prochaine && <button type="button" data-ranger-ici={p.numero} onClick={() => ranger(p.numero, prochaine.itemId, prochaine.key)} style={btn(true)}>Ranger ici</button>}
                          {casesLibres > 0 && <button type="button" data-autre-case={p.numero} aria-label={`Choisir une autre case pour la N°${p.numero}`} title="Choisir une autre case" onClick={() => setPlacer(placer === p.numero ? null : p.numero)} style={{ ...btn(false), padding: '8px 10px' }}>Autre</button>}
                        </span>
                      </div>
                    ))}
                  </div>
                </>)}
            </div>
          )}
          {sur && aLiberer.length > 0 && (
            <div style={carte} data-rgt-liberer="">
              {titreBloc('À libérer', aLiberer.length)}
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5, marginBottom: 8 }}>Ces cases portent le N° d'une paire qui n'est plus en stock (vendue ou partie). Libère-la quand la place est vide.</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(voirLiberer ? aLiberer : aLiberer.slice(0, 5)).map(x => (
                  <div key={x.itemId + x.key + x.numero} data-a-liberer={x.numero} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: C.text }}>
                    <span style={{ flex: 1, minWidth: 0 }}><b>N°{x.numero}</b> <span style={{ color: C.muted }}>· {x.itemName} · {x.nom}</span></span>
                    <button type="button" onClick={() => liberer(x)} style={btn(false)}>Libérer</button>
                  </div>
                ))}
              </div>
              {aLiberer.length > 5 && <button type="button" onClick={() => setVoirLiberer(v => !v)} style={{ ...btn(false), marginTop: 8, border: 'none', padding: '4px 0', color: C.muted }}>{voirLiberer ? 'Réduire' : `Voir les ${aLiberer.length}`}</button>}
            </div>
          )}
        </div>

        {/* ── Colonne droite : le stock vu de face, meuble par meuble ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }} data-rgt-plan="">
          {meubles.length === 0 && <div style={{ ...carte, fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>Aucun meuble pour ranger dans ta pièce. Ajoute une étagère, une table ou un portant dans <b style={{ color: C.text }}>Ma pièce → Aménager la pièce</b>.</div>}
          {meubles.map((m, mi) => {
            const pleines = Object.keys(m.vue).length;
            const enTete = plusieursPieces && (mi === 0 || meubles[mi - 1].roomId !== m.roomId);
            // La case où une boîte atterrit dans chaque colonne (gravité).
            const basLibre = {};
            if (m.mode === 'pile' || m.mode === 'cintre') { for (let r = 0; r < m.nr; r++) for (let c = 0; c < m.nc; c++) { const k = r + '_' + c; if ((m.vue[k] || []).length < m.cap) basLibre[k] = true; } }
            else for (let c = 0; c < m.nc; c++) { let n = 0; for (let r = 0; r < m.nr; r++) if (m.vue[r + '_' + c]) n++; if (n < m.nr) basLibre[(m.nr - 1 - n) + '_' + c] = true; }
            return (
              <React.Fragment key={m.it.id}>
                {enTete && <div className="vrm-label" style={{ color: C.muted, marginTop: mi ? 4 : 0 }}>{m.roomName}</div>}
                <div style={carte} data-rgt-meuble={m.it.id}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 650, color: C.text, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.it.name}</span>
                    <span style={{ fontSize: 12, color: C.muted, flexShrink: 0 }}>{pleines}/{m.nr * m.nc}</span>
                  </div>
                  <div style={{ overflowX: 'auto', paddingBottom: 2 }}>
                    <div className="vrm-rgt-grille" style={{ display: 'grid', gridTemplateColumns: `repeat(${m.nc}, var(--rgt-c))`, gap: 6, width: 'max-content' }}>
                      {Array.from({ length: m.nr * m.nc }, (_, i) => {
                        const r = Math.floor(i / m.nc), c = i % m.nc, key = r + '_' + c;
                        const a = m.vue[key] || [];
                        const estHit = !!(hit && hit.itemId === m.it.id && hit.key === key);
                        const estProchaine = !!(sur && aRanger.length && prochaine && prochaine.itemId === m.it.id && prochaine.key === key);
                        const cliquable = !!(placer && sur && (m.mode === 'pile' ? true : !a.length) && basLibre[key]);
                        const partie = !!(a.length && a.some(v => partiesCles.has(cleNum(v))));
                        const vientDetre = !!(flash && flash.itemId === m.it.id && flash.key === key && a.length);
                        const accent = estHit || estProchaine || cliquable;
                        const bord = accent ? C.accent : partie ? C.warn : C.border;
                        const trait = a.length && !partie ? 'solid' : (estProchaine || estHit ? 'solid' : 'dashed');
                        return (
                          <div key={key} ref={estHit ? hitRef : null} className="vrm-rgt-case"
                            data-case={`${m.it.id}:${key}`} data-num={a[0] || ''} data-hi={estHit ? '1' : undefined} data-prochaine-case={estProchaine ? '1' : undefined} data-cliquable={cliquable ? '1' : undefined} data-partie={partie ? '1' : undefined}
                            role={cliquable || a.length ? 'button' : undefined} tabIndex={cliquable || a.length ? 0 : undefined}
                            title={a.length ? `N°${a.join(', ')} · ${nomCase(m.nr, key, m.mode, m.it)}` : nomCase(m.nr, key, m.mode, m.it)}
                            onClick={() => { if (cliquable) ranger(placer, m.it.id, key); else if (a.length) setQ(a[a.length - 1]); }}
                            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (cliquable) ranger(placer, m.it.id, key); else if (a.length) setQ(a[0]); } }}
                            style={{ height: 'var(--rgt-h)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', cursor: cliquable || a.length ? 'pointer' : 'default',
                              border: `${accent ? 2 : 1}px ${trait} ${bord}`,
                              background: estHit ? C.accent : a.length ? C.card2 : 'transparent', color: estHit ? (C.onAccent || '#fff') : partie ? C.muted : C.text,
                              animation: vientDetre ? 'vrmrgtpose .38s ease-out' : 'none', boxShadow: vientDetre && !estHit ? `0 0 0 2px ${C.accent}` : 'none' }}>
                            {a.length
                              ? <span className="vrm-display" style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em', textDecoration: partie ? 'line-through' : 'none', textDecorationColor: C.warn }}>{a[0]}{a.length > 1 ? <span style={{ fontSize: 10, fontWeight: 600, opacity: .7 }}> +{a.length - 1}</span> : null}</span>
                              : estProchaine ? <span style={{ fontSize: 10.5, fontWeight: 700, color: C.accent }}>ici</span> : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
          {meubles.length > 0 && <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.5 }}>Vu de face, comme dans la 3D : sur une étagère ou une table les boîtes s'empilent dans leur case ; dans un mur de boîtes elles tombent en bas de la colonne. Touche une case pleine pour la retrouver.</div>}
        </div>
      </div>
    </div>
  );
}

function Garage({catalog,garageGrid,setGarageGrid,blockedCells,setBlockedCells,extraCols,setExtraCols,cellColors,setCellColors,locate,onLocateConsumed,placeNum,onPlaced}) {
  const [searchInput,setSearchInput]=useState('');
  const [garageSearch,setGarageSearch]=useState(''); // recherche validée
  // ⚠️ LA 3D EST LA VUE PAR DÉFAUT (Julien : « je veux vraiment que la 3D soit
  // une application dans l'application »). Le choix reste MÉMORISÉ par appareil :
  // qui préfère la grille la retrouve au prochain passage — on change le point
  // de départ, pas son habitude.
  // (17 oct.) Julien : « enlève aussi les autres types de rangement ». Le Stock
  // n'a plus que la pièce (3D + vue du dessus) et l'assistant « Ranger » ; la
  // grille de zones et la photo du local ne s'ouvrent plus (mesuré : vides chez
  // lui). Un choix mémorisé « grille »/« photo » retombe sur la pièce.
  const [garageView,setGarageView]=useState(()=>{ if (DEMANDE_STOCK_CHERCHE.nums) return 'plan'; const v=load('vinted_garage_view','plan'); return v==='ranger'?'ranger':'plan'; }); // plan | ranger

  // Localisation demandee depuis l'inventaire : amorce la recherche sur le numero.
  useEffect(()=>{
    if(locate){
      setSearchInput(String(locate));
      setGarageSearch(String(locate));
      onLocateConsumed && onLocateConsumed();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[locate]);
  const [blockMode,setBlockMode]=useState(false);
  const [colorMode,setColorMode]=useState(false);
  const [addMode,setAddMode]=useState(false); // masquer les cases vides par défaut
  const [activeColor,setActiveColor]=useState('#ffb830');
  const [focusedCell,setFocusedCell]=useState(null); // {zid, ci, si}
  const highlightRef=React.useRef(null);
  // Rangement lancé DEPUIS le garage (bouton « Ranger » sur une paire à ranger),
  // en plus de celui lancé depuis Annonces (prop placeNum). placing = le N° en cours.
  const [localPlace,setLocalPlace]=useState(null);
  const [advanced,setAdvanced]=useState(false); // options avancées (modes, colonnes) repliées par défaut
  const placing = placeNum || localPlace;
  const clearPlacing = () => { setLocalPlace(null); onPlaced&&onPlaced(); };

  // Quand une recherche trouve une case, on défile automatiquement jusqu'à elle (centré)
  useEffect(()=>{
    if(garageSearch.trim()&&highlightRef.current){
      setTimeout(()=>{
        try{ highlightRef.current.scrollIntoView({behavior:'smooth',block:'center',inline:'center'}); }catch(e){}
      },100);
    }
  },[garageSearch]);
  
  const isBlocked=(zid,ci,si)=>blockedCells[`${zid}_${ci}_${si}`]===true;
  const toggleBlock=(zid,ci,si)=>{
    const k=`${zid}_${ci}_${si}`;
    const u={...blockedCells};
    if(u[k]) delete u[k]; else u[k]=true;
    setBlockedCells(u); save('vinted_blocked',u);
  };
  
  const getColor=(zid,ci,si)=>cellColors[`${zid}_${ci}_${si}`];
  const setColor=(zid,ci,si,color)=>{
    const k=`${zid}_${ci}_${si}`;
    const u={...cellColors};
    if(color===null||u[k]===color) delete u[k]; else u[k]=color;
    setCellColors(u); save('vinted_colors',u);
  };
  
  const soldIds=useMemo(()=>new Set(catalog.filter(p=>p.status==='vendu').map(p=>p.id)),[catalog]);
  const BW=46,BH=26,SW=6,TH=5;
  const CW=BW+SW,CH=BH+TH,GAP=3;
  
  // LAYOUT effectif avec colonnes ajoutées par l'utilisateur
  const effectiveLayout=useMemo(()=>LAYOUT.map(z=>{
    const extra=extraCols[z.id]||0;
    return {...z, cols:[...z.cols, ...Array(extra).fill(COL_H)]};
  }),[extraCols]);
  
  const globalMax=useMemo(()=>Math.max(...effectiveLayout.flatMap(z=>z.cols.map(b=>b+z.elev))),[effectiveLayout]);
  const TOTAL=useMemo(()=>effectiveLayout.reduce((s,z)=>s+z.cols.reduce((ss,b)=>ss+b,0),0),[effectiveLayout]);

  const allVals=useMemo(()=>
    Object.values(garageGrid).flatMap(a=>Array.isArray(a)?a:[]).filter(v=>v&&v.trim()!=='')
  ,[garageGrid]);
  
  // Set des valeurs en lowercase (recherche instantanée)
  const allValsSet=useMemo(()=>{
    const s=new Set();
    allVals.forEach(v=>s.add(v.trim().toLowerCase()));
    return s;
  },[allVals]);

  // Cohérence garage ↔ paires numérotées (annonces). Chargé depuis la même
  // source que l'onglet Comptes (clé vinted_annonce_numeros).
  const pairNumeros=useMemo(()=>load('vinted_annonce_numeros',{}),[]);
  // ⚠️ Seules les paires qui EXISTENT ENCORE ont une place à occuper. La photo
  // `vinted_nums_physiques` est publiée par l'écran Annonces (annonce en ligne
  // ou vente pas encore expédiée). Sans elle (écran jamais ouvert sur cet
  // appareil), on garde l'ancien comportement plutôt que de masquer à tort.
  const numsPhysiques=useMemo(()=>{
    const p=load('vinted_nums_physiques', null);
    if(!p || !Array.isArray(p.nums) || !p.nums.length) return null;
    return new Set(p.nums.map(x=>String(x).trim().toLowerCase()));
  },[]);
  const numberedSet=useMemo(()=>{
    const s=new Set();
    Object.values(pairNumeros).forEach(e=>{ const t=String((e&&e.numero)||'').trim().toLowerCase(); if(!t) return;
      if(numsPhysiques && !numsPhysiques.has(t)) return;   // paire partie : sa boîte est libre
      s.add(t); });
    return s;
  },[pairNumeros,numsPhysiques]);
  // Numérotées (paires connues) mais absentes du garage → à ranger.
  const numberedNotStored=useMemo(()=>Array.from(numberedSet).filter(n=>!allValsSet.has(n)).sort((a,b)=>(+a||0)-(+b||0)),[numberedSet,allValsSet]);
  // Au garage mais numéro inconnu (aucune paire numérotée) → doute/typo/ancien.
  const storedUnknown=useMemo(()=>Array.from(allValsSet).filter(n=>numberedSet.size>0&&!numberedSet.has(n)).sort((a,b)=>(+a||0)-(+b||0)),[allValsSet,numberedSet]);

  // Détection des doublons
  const duplicates=useMemo(()=>{
    const counts={};
    Object.entries(garageGrid).forEach(([key,arr])=>{
      if(!Array.isArray(arr)) return;
      arr.forEach((v,si)=>{
        const t=v&&v.trim();
        if(!t) return;
        if(!counts[t]) counts[t]=[];
        counts[t].push(`${key}_${si}`);
      });
    });
    return Object.entries(counts).filter(([k,v])=>v.length>1).map(([num,locs])=>({num,locs,count:locs.length}));
  },[garageGrid]);

  const getCol=(zid,ci,n)=>{
    const a=garageGrid[`${zid}_${ci}`];
    const r=Array.isArray(a)?[...a]:[];
    while(r.length<n) r.push('');
    return r.slice(0,n);
  };
  const setCol=(zid,ci,arr)=>{
    const u={...garageGrid,[`${zid}_${ci}`]:arr};
    setGarageGrid(u); save('vinted_garage_grid',u);
  };
  const onChange=(zid,ci,si,val,n)=>{const arr=getCol(zid,ci,n);arr[si]=val;setCol(zid,ci,arr);};
  
  // Compactage qui IGNORE les cases bloquées
  const onBlur=(zid,ci,n)=>{
    const arr=getCol(zid,ci,n);
    // Pour chaque position, savoir si elle est bloquée
    const blockedSet=new Set();
    for(let i=0;i<n;i++){
      if(isBlocked(zid,ci,i)) blockedSet.add(i);
    }
    // On extrait les valeurs non-bloquées avec leur statut
    const free=[]; // positions non-bloquées
    for(let i=0;i<n;i++){
      if(!blockedSet.has(i)) free.push({pos:i, val:arr[i]||''});
    }
    // Récupérer les valeurs remplies parmi free, en gardant l'ordre
    const filled=free.filter(f=>f.val.trim()!=='').map(f=>f.val);
    // Reconstruire : positions libres = vides en haut puis filled en bas
    const newArr=[...arr]; // garder les bloquées intactes
    let fillIdx=filled.length-1; // on remplit du bas vers le haut parmi les positions libres
    for(let i=free.length-1;i>=0;i--){
      const pos=free[i].pos;
      if(fillIdx>=0){
        newArr[pos]=filled[fillIdx];
        fillIdx--;
      } else {
        newArr[pos]='';
      }
    }
    setCol(zid,ci,newArr);
  };

  // Recherche : déclenchée seulement quand on appuie sur Entrée
  const triggerSearch=()=>setGarageSearch(searchInput);
  const clearSearch=()=>{setSearchInput('');setGarageSearch('');};
  const searchTrim=garageSearch.trim().toLowerCase();
  
  // Liste des cellules de chaque colonne pour navigation flèches
  const navigateFromCell=(zid,ci,si,direction)=>{
    // Trouve la zone et colonne courante dans effectiveLayout
    const zIdx=effectiveLayout.findIndex(z=>z.id===zid);
    if(zIdx<0) return;
    const z=effectiveLayout[zIdx];
    const maxBoxes=z.cols[ci];
    let newZ=zIdx, newCi=ci, newSi=si;
    if(direction==='up') newSi=Math.max(0,si-1);
    else if(direction==='down') newSi=Math.min(maxBoxes-1,si+1);
    else if(direction==='left') {
      if(ci>0){newCi=ci-1;}
      else if(zIdx>0){newZ=zIdx-1;newCi=effectiveLayout[zIdx-1].cols.length-1;}
      else return;
    }
    else if(direction==='right'){
      if(ci<z.cols.length-1){newCi=ci+1;}
      else if(zIdx<effectiveLayout.length-1){newZ=zIdx+1;newCi=0;}
      else return;
    }
    const targetZ=effectiveLayout[newZ];
    const targetMax=targetZ.cols[newCi];
    if(newSi>=targetMax) newSi=targetMax-1;
    setFocusedCell({zid:targetZ.id,ci:newCi,si:newSi});
    // Focus l'input après le rendu
    setTimeout(()=>{
      const inp=document.querySelector(`input[data-cell="${targetZ.id}_${newCi}_${newSi}"]`);
      if(inp) inp.focus();
    },10);
  };
  
  const COLORS=['#ffb830','#ff4d6d','#4da6ff','#a78bfa','#00e5a0','#ff8c42','#ec4899'];
  
  const addColumn=(zid)=>{
    const u={...extraCols, [zid]:(extraCols[zid]||0)+1};
    setExtraCols(u); save('vinted_extracols',u);
  };
  const removeColumn=(zid)=>{
    const u={...extraCols, [zid]:Math.max(0,(extraCols[zid]||0)-1)};
    setExtraCols(u); save('vinted_extracols',u);
  };

  let colN=0;
  return (
    <div style={{padding:16,display:'flex',flexDirection:'column',gap:14}}>
      <ScreenHead icon="home" title="Stock" desc="Où sont rangées tes paires. Cherche un numéro, il te dit le meuble et la case."/>

      {/* Bascule : grille classique ↔ photo de ton vrai local */}
      {/* (16 oct.) Le contrôle segmenté PARTAGÉ (`.vrm-seg`, celui des sous-onglets
          de plateforme) : plus de segment rempli d'accent, plus de boîte bordée. */}
      <nav role="group" aria-label="Vue du stock" className="vrm-seg" data-segment="" data-stock-vues="" style={{'--seg-ink':C.text,'--seg-muted':C.muted,'--seg-point':C.accent,margin:0}}>
        {[['plan','home','Ma pièce'],['ranger','grid','Liste des cases']].map(([v,ic,l])=>(
          <button type="button" key={v} onClick={()=>{setGarageView(v);save('vinted_garage_view',v);}} aria-current={garageView===v?'page':undefined} aria-pressed={garageView===v} data-stock-vue={v} className="vrm-seg-btn">
            <Icon name={ic} size={15}/>{l}
          </button>
        ))}
      </nav>

      {garageView==='plan' && <RoomPlan locate={locate} onLocateConsumed={onLocateConsumed}/>}
      {garageView==='ranger' && <RoomPlan mode="2d"/>}

      {garageView==='grid' && (<>
      {placing && (
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,padding:'12px 14px',borderRadius:10,background:C.accent,color:C.onAccent,fontSize:13,fontWeight:600,position:'sticky',top:8,zIndex:20,boxShadow:'0 3px 12px rgba(0,0,0,0.18)'}}>
          <span>📦 Range la paire <b>N°{placing}</b> — touche une boîte pour l'y mettre.</span>
          <button type="button" onClick={clearPlacing} style={{background:'transparent',border:`1px solid ${C.onAccent}`,borderRadius:8,color:C.onAccent,cursor:'pointer',fontSize:11,fontWeight:500,padding:'4px 11px',flexShrink:0}}>Annuler</button>
        </div>
      )}

      {/* Compteurs */}
      <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
        {duplicates.length>0&&<Card style={{flex:'none',padding:'10px 16px',background:`${C.danger}22`,borderColor:`${C.danger}66`}}>
          <div style={{fontSize:9,color:C.danger,textTransform:'uppercase',letterSpacing:1,fontWeight:500}}>⚠ Doublons</div>
          <div style={{fontSize:20,fontWeight:600,color:C.danger,marginTop:4}}>{duplicates.length}</div>
        </Card>}
      </div>
      
      {/* Liste des doublons */}
      {duplicates.length>0&&<Card style={{padding:12,background:`${C.danger}11`,borderColor:`${C.danger}44`}}>
        <div style={{fontSize:11,color:C.danger,fontWeight:500,marginBottom:6,textTransform:'uppercase',letterSpacing:1}}>⚠ Numéros en doublon</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:8,fontSize:11}}>
          {duplicates.map(d=>(
            <span key={d.num} onClick={()=>{setSearchInput(d.num);setGarageSearch(d.num);}}
              style={{background:C.bg,padding:'4px 10px',borderRadius:5,cursor:'pointer',color:C.text,border:`1px solid ${C.danger}66`}}>
              <b style={{color:C.danger}}>#{d.num}</b> <span style={{color:C.muted}}>×{d.count}</span>
            </span>
          ))}
        </div>
      </Card>}
      
      {/* Cohérence : paires numérotées vs garage */}
      {(numberedNotStored.length>0||storedUnknown.length>0)&&(
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {numberedNotStored.length>0&&(
            <Card style={{padding:12,background:`${C.warn}11`,borderColor:`${C.warn}44`}}>
              <div style={{fontSize:11,color:C.warn,fontWeight:500,marginBottom:6,textTransform:'uppercase',letterSpacing:1}}>📦 À ranger ({numberedNotStored.length})</div>
              <div style={{fontSize:11,color:C.muted,marginBottom:8}}>Ces paires ont un numéro mais ne sont dans aucune boîte. <b>Touche-en une</b>, puis touche la boîte où tu la ranges.</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:8,fontSize:11}}>
                {numberedNotStored.map(n=>(
                  <button key={n} type="button" onClick={()=>{ setLocalPlace(n); try{window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'});}catch(_){} }}
                    style={{background:placing===n?C.warn:C.bg,color:placing===n?'#fff':C.text,padding:'5px 11px',borderRadius:8,border:`1px solid ${C.warn}66`,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>📦 N°{n}</button>
                ))}
              </div>
            </Card>
          )}
          {storedUnknown.length>0&&(
            <Card style={{padding:12,background:`${C.blue||C.accent}11`,borderColor:`${C.blue||C.accent}44`}}>
              <div style={{fontSize:11,color:C.blue||C.accent,fontWeight:500,marginBottom:6,textTransform:'uppercase',letterSpacing:1}}>❓ Au stock mais numéro inconnu ({storedUnknown.length})</div>
              <div style={{fontSize:11,color:C.muted,marginBottom:6}}>Numéros présents au stock sans paire numérotée correspondante (ancien numéro, faute de frappe, ou vendue).</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:8,fontSize:11}}>
                {storedUnknown.map(n=>(<span key={n} onClick={()=>{setSearchInput(n);setGarageSearch(n);}} style={{background:C.bg,padding:'4px 10px',borderRadius:5,cursor:'pointer',color:C.text,border:`1px solid ${(C.blue||C.accent)}66`,fontWeight:500}}>#{n}</span>))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Recherche avec bouton + Entrée */}
      <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
        <div style={{flex:1,minWidth:200,display:'flex',gap:6}}>
          <Input value={searchInput}
            onChange={e=>setSearchInput(e.target.value)}
            onKeyDown={e=>{if(e.key==='Enter')triggerSearch();}}
            placeholder="Numéro à chercher (puis Entrée)..."
          />
          <Btn small onClick={triggerSearch} color={C.accent}>Chercher</Btn>
          {garageSearch&&<Btn small onClick={clearSearch} color={C.border}>✕</Btn>}
        </div>
      </div>
      {searchTrim&&<div style={{fontSize:12,color:C.muted}}>
        {allValsSet.has(searchTrim)
          ?<span style={{color:C.warn}}>✓ Numéro #{garageSearch} trouvé — case en surbrillance</span>
          :<span style={{color:C.danger}}>✗ Numéro #{garageSearch} non trouvé dans le stock</span>}
      </div>}
      
      {/* Réglages avancés repliés par défaut : le vendeur n'a besoin que de
          « À ranger » + recherche + les boîtes. Le reste (blocage, couleurs,
          colonnes) est là pour qui veut, mais ne pollue plus l'écran. */}
      <button type="button" onClick={()=>{ const v=!advanced; setAdvanced(v); if(!v){setAddMode(false);setBlockMode(false);setColorMode(false);} }}
        style={{alignSelf:'flex-start',border:`1px solid ${C.border}`,background:'transparent',color:C.muted,borderRadius:8,padding:'5px 13px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
        ⚙️ {advanced?'Masquer les réglages':'Réglages (couleurs, blocage, colonnes)'}
      </button>
      {advanced && (<>
      {/* Modes & boutons */}
      <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
        <Btn small onClick={()=>{setAddMode(!addMode);setBlockMode(false);setColorMode(false);}} color={addMode?C.accent:C.border} style={{color:addMode?'#fff':C.muted}}>
          {addMode?'✓ Mode ajout actif':'➕ Mode ajout'}
        </Btn>
        <Btn small onClick={()=>{setBlockMode(!blockMode);setColorMode(false);setAddMode(false);}} color={blockMode?C.danger:C.border} style={{color:blockMode?'#fff':C.muted}}>
          {blockMode?'✓ Mode blocage':'🔒 Mode blocage'}
        </Btn>
        <Btn small onClick={()=>{setColorMode(!colorMode);setBlockMode(false);setAddMode(false);}} color={colorMode?activeColor:C.border} style={{color:colorMode?'#fff':C.muted}}>
          {colorMode?'✓ Mode couleur':'🎨 Mode couleur'}
        </Btn>
        {colorMode&&<div style={{display:'flex',gap:4,alignItems:'center'}}>
          {COLORS.map(col=>(
            <button type="button" aria-label={col} key={col} onClick={()=>setActiveColor(col)}
              style={{width:22,height:22,borderRadius:'50%',background:col,border:activeColor===col?'2px solid #fff':'2px solid transparent',cursor:'pointer'}}
              title={col}/>
          ))}
          <button className="vrm-icon-control" type="button" aria-label="Effacer" onClick={()=>setActiveColor(null)}
            style={{width:22,height:22,borderRadius:'50%',background:'transparent',border:'2px dashed #555',cursor:'pointer',fontSize:11,color:'#666'}}
            title="Effacer"><Icon name="close" size={15}/></button>
        </div>}
      </div>
      {allValsSet.size===0&&!addMode&&<div style={{fontSize:12,color:C.text,background:`${C.accent}0e`,border:`1px solid ${C.accent}44`,borderRadius:10,padding:'10px 13px',marginBottom:10,lineHeight:1.45}}>
        🗄️ <b>Ton stock est vide.</b> Clique une case pour y poser un numéro de boîte, ou va sur une annonce et utilise « Ranger » pour la placer d'un tap.
      </div>}
      {(blockMode||colorMode||addMode)&&<div style={{fontSize:11,color:C.muted}}>
        {addMode&&'Toutes les cases sont visibles. Tu peux ajouter des paires dans les cases vides.'}
        {blockMode&&'Clique sur une case vide pour la bloquer/débloquer (zone non utilisable). '}
        {colorMode&&(activeColor?'Clique sur une case pour la colorier. Re-clique pour effacer la couleur.':'Sélectionne une couleur, ou ✕ pour effacer la couleur d\'une case.')}
      </div>}
      {/* Boutons d'ajout de colonnes */}
      <Card style={{padding:10}}>
        <div style={{fontSize:11,color:C.muted,textTransform:'uppercase',letterSpacing:1,marginBottom:6,fontWeight:500}}>Colonnes</div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
          {LAYOUT.map(z=>(
            <div key={z.id} style={{display:'flex',alignItems:'center',gap:4,fontSize:11,background:C.bg,padding:'4px 8px',borderRadius:5}}>
              <span style={{color:C.muted}}>Colonnes :</span>
              <button className="vrm-icon-control" type="button" aria-label="Retirer une colonne de rangement" onClick={()=>removeColumn(z.id)} style={{background:'transparent',border:`1px solid ${C.border}`,color:C.danger,borderRadius:5,padding:'2px 8px',cursor:'pointer',fontSize:11,fontFamily:'inherit'}}>−</button>
              <span style={{color:C.accent,fontWeight:500,minWidth:24,textAlign:'center'}}>{z.cols.length+(extraCols[z.id]||0)}</span>
              <button className="vrm-icon-control" type="button" aria-label="Ajouter une colonne de rangement" onClick={()=>addColumn(z.id)} style={{background:'transparent',border:`1px solid ${C.border}`,color:C.accent,borderRadius:5,padding:'2px 8px',cursor:'pointer',fontSize:11,fontFamily:'inherit'}}>+</button>
            </div>
          ))}
        </div>
      </Card>
      
      </>)}

      {/* Garage visuel */}
      <Card style={{overflowX:'auto',padding:'14px 10px'}}>
        <div style={{display:'flex',gap:GAP,marginBottom:6}}>
          {effectiveLayout.flatMap((z,zi)=>{
            const labels=z.cols.map((_,ci)=>(
              <div key={`l${zi}_${ci}`} style={{width:CW,flexShrink:0,fontSize:7,fontWeight:600,color:ci===0?C.accent:'transparent',textTransform:'uppercase',letterSpacing:0.5}}>
                {ci===0?z.name:''}
              </div>
            ));
            return labels;
          })}
        </div>
        <div style={{display:'flex',alignItems:'flex-end',gap:GAP}}>
          {effectiveLayout.flatMap((z,zi)=>{
            const cols=z.cols.map((maxBoxes,ci)=>{
              const spacerTop=globalMax-(maxBoxes+z.elev);
              const arr=getCol(z.id,ci,maxBoxes);
              const cn=++colN;
              return (
                <div key={`c${zi}_${ci}`} style={{display:'flex',flexDirection:'column',alignItems:'flex-start',gap:GAP}}>
                  {Array.from({length:spacerTop},(_,i)=><div key={`sp${i}`} style={{width:CW,height:CH}}/>)}
                  {Array.from({length:z.elev},(_,i)=><div key={`ev${i}`} style={{width:CW,height:CH}}/>)}
                  {arr.map((val,si)=>{
                    const t=val?val.trim():'';
                    const isSold=t!==''&&soldIds.has(t);
                    const highlight=searchTrim!==''&&t.toLowerCase()===searchTrim;
                    const blocked=isBlocked(z.id,ci,si);
                    const cellColor=getColor(z.id,ci,si);
                    
                    // Masquer les cases vides (non bloquées, sans couleur) sauf en mode ajout/blocage/couleur/rangement
                    // ⚠️ GARAGE VIDE = ÉCRAN VIDE. Les cases vides sont masquées par
                    // défaut ; quand AUCUNE case n'est remplie, l'écran ne montrait
                    // donc plus rien du tout — « le garage ne marche plus ». Tant
                    // qu'il n'y a rien à ranger, on montre l'étagère.
                    const showAllCells=addMode||blockMode||colorMode||!!placing||allValsSet.size===0;
                    if(!showAllCells&&!blocked&&t===''&&!cellColor){
                      // Case invisible : on rend juste un placeholder vide pour garder l'alignement
                      return <div key={si} style={{width:CW,height:CH}}/>;
                    }
                    
                    if(blocked) return (
                      <div key={si} onClick={()=>{if(blockMode)toggleBlock(z.id,ci,si);}}
                        style={{position:'relative',width:CW,height:CH,
                          cursor:blockMode?'pointer':'default',
                          opacity:0.5}}>
                        <svg width={BW+SW} height={BH+TH} style={{display:'block',overflow:'visible'}}>
                          <rect x={0} y={TH} width={BW} height={BH} rx={2} fill='transparent' stroke='#444' strokeWidth='1' strokeDasharray='3,2'/>
                          <line x1={4} y1={TH+4} x2={BW-4} y2={TH+BH-4} stroke='#666' strokeWidth='1.5'/>
                          <line x1={BW-4} y1={TH+4} x2={4} y2={TH+BH-4} stroke='#666' strokeWidth='1.5'/>
                        </svg>
                      </div>
                    );
                    
                    return (
                      <div key={si} ref={highlight?highlightRef:null} onClick={()=>{
                        if(blockMode&&!t) toggleBlock(z.id,ci,si);
                        else if(colorMode) setColor(z.id,ci,si,activeColor);
                      }}
                        style={{position:'relative',width:CW,height:CH,
                          cursor:(blockMode&&!t)||colorMode?'pointer':'auto'}}>
                        {cellColor&&<div style={{position:'absolute',inset:0,top:TH,background:cellColor,opacity:0.35,borderRadius:5,zIndex:1,pointerEvents:'none'}}/>}
                        <Box val={val} isSold={isSold} highlight={highlight}/>
                        {!blockMode&&!colorMode&&<input value={val}
                          data-cell={`${z.id}_${ci}_${si}`}
                          onChange={e=>onChange(z.id,ci,si,e.target.value,maxBoxes)}
                          onClick={()=>{ if(placing&&!t){ onChange(z.id,ci,si,String(placing),maxBoxes); onBlur(z.id,ci,maxBoxes); clearPlacing(); } }}
                          onBlur={()=>onBlur(z.id,ci,maxBoxes)}
                          onKeyDown={e=>{
                            if(e.key==='ArrowUp'){e.preventDefault();navigateFromCell(z.id,ci,si,'up');}
                            else if(e.key==='ArrowDown'){e.preventDefault();navigateFromCell(z.id,ci,si,'down');}
                            else if(e.key==='ArrowLeft'&&e.target.selectionStart===0){e.preventDefault();navigateFromCell(z.id,ci,si,'left');}
                            else if(e.key==='ArrowRight'&&e.target.selectionStart===e.target.value.length){e.preventDefault();navigateFromCell(z.id,ci,si,'right');}
                            else if(e.key==='Enter'){e.preventDefault();navigateFromCell(z.id,ci,si,'down');}
                          }}
                          style={{position:'absolute',left:0,top:TH,width:BW,height:BH,background:'transparent',border:'none',outline:'none',textAlign:'center',fontSize:8,fontWeight:600,color:'transparent',caretColor:C.warn,fontFamily:'inherit',cursor:'text',zIndex:3,boxSizing:'border-box'}}
                          onFocus={e=>{e.target.parentElement.style.filter='brightness(1.35)';}}
                          onBlurCapture={e=>{e.target.parentElement.style.filter='';}}
                        />}
                      </div>
                    );
                  })}
                  <div style={{fontSize:7,color:'#333',textAlign:'center',width:CW}}>{cn}</div>
                </div>
              );
            });
            return cols;
          })}
        </div>
      </Card>
      </>)}
    </div>
  );
}

export { Garage };
