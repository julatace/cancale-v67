// Découpé d'App.jsx (démarrage léger, 8 nov.) : chargé à la demande par App.jsx.
// Déplacement MÉCANIQUE (le code est celui d'App.jsx, inchangé) — voir docs/passation/2026-11-08-demarrage-leger.md.
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { C, FermeAuRetour, PhotoVinted } from '../App.jsx';


// ⟦← App.jsx #1⟧
// ⟦→ ecrans/Republier.jsx #8⟧
function PhotoEditor({ refPhoto, refTitle, onClose, toast }) {
  const [img, setImg] = useState(null);          // HTMLImageElement chargée
  const [zoom, setZoom] = useState(1);
  const [rot, setRot] = useState(0);             // 0 / 90 / 180 / 270
  const [bright, setBright] = useState(1);
  const [contrast, setContrast] = useState(1);
  const [ratio, setRatio] = useState('3:4');     // Vinted = portrait par défaut
  const [off, setOff] = useState({ x:0, y:0 });  // décalage (pan), en px du canvas d'aperçu
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef(null);
  const drag = useRef(null);

  const RATIOS = { '3:4':[3,4], '1:1':[1,1], '4:3':[4,3] };
  const [rw, rh] = RATIOS[ratio] || [3,4];
  const DW = 300, DH = Math.round(DW * rh / rw);  // taille interne du canvas d'aperçu

  // Dessine l'image recadrée/zoomée/tournée dans un contexte donné.
  // k = facteur d'échelle entre ce contexte et l'aperçu (1 pour l'aperçu).
  const draw = (ctx, W, H, k) => {
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    if (img) {
      try { ctx.filter = `brightness(${bright}) contrast(${contrast})`; } catch (_) {}
      const iw = img.naturalWidth, ih = img.naturalHeight;
      const swap = (rot % 180) !== 0;             // 90/270 → largeur/hauteur inversées
      const fw = swap ? ih : iw, fh = swap ? iw : ih;
      const cover = Math.max(W / fw, H / fh);     // remplit tout le cadre
      const s = cover * zoom;
      ctx.translate(W/2 + off.x*k, H/2 + off.y*k);
      ctx.rotate(rot * Math.PI/180);
      ctx.scale(s, s);
      ctx.drawImage(img, -iw/2, -ih/2);
    }
    ctx.restore();
  };

  // Redessine l'aperçu à chaque changement.
  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    cv.width = DW; cv.height = DH;
    draw(cv.getContext('2d'), DW, DH, 1);
  }, [img, zoom, rot, bright, contrast, ratio, off, DW, DH]);

  const onFile = (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const url = URL.createObjectURL(f);
    const im = new Image();
    im.onload = () => { setImg(im); setZoom(1); setRot(0); setOff({ x:0, y:0 }); setBright(1); setContrast(1); };
    im.onerror = () => { toast && toast("Cette image n'a pas pu être ouverte."); };
    im.src = url;
  };

  const pt = (e) => { const t = e.touches ? e.touches[0] : e; return { x:t.clientX, y:t.clientY }; };
  const onDown = (e) => { if (!img) return; const cv = canvasRef.current; const rect = cv.getBoundingClientRect(); drag.current = { p: pt(e), off:{...off}, k: DW/rect.width }; };
  const onMove = (e) => { if (!drag.current) return; const p = pt(e); const d = drag.current; setOff({ x: d.off.x + (p.x-d.p.x)*d.k, y: d.off.y + (p.y-d.p.y)*d.k }); };
  const onUp = () => { drag.current = null; };

  // Export haute résolution → partage natif (iPhone : envoyer direct vers Vinted
  // / Photos) si dispo, sinon téléchargement du fichier.
  const exportPhoto = async () => {
    if (!img) { toast && toast("Choisis d'abord une photo."); return; }
    setBusy(true);
    try {
      const EW = 1200, EH = Math.round(EW * rh / rw);
      const cv = document.createElement('canvas'); cv.width = EW; cv.height = EH;
      draw(cv.getContext('2d'), EW, EH, EW/DW);
      const blob = await new Promise(res => cv.toBlob(res, 'image/jpeg', 0.92));
      if (!blob) { toast && toast('Export impossible sur cet appareil.'); setBusy(false); return; }
      const fname = `vrm-photo-${Date.now()}.jpg`;
      const file = new File([blob], fname, { type:'image/jpeg' });
      if (navigator.share && navigator.canShare && navigator.canShare({ files:[file] })) {
        try { await navigator.share({ files:[file], title: refTitle || 'Photo retouchée' }); setBusy(false); return; }
        catch (_) { /* partage annulé → on retombe sur le téléchargement */ }
      }
      const a = document.createElement('a'); const href = URL.createObjectURL(blob);
      a.href = href; a.download = fname; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 5000);
      toast && toast('Photo enregistrée. Téléverse-la sur Vinted.');
    } catch (_) { toast && toast('Export impossible.'); }
    setBusy(false);
  };

  const chip = (v, label) => (
    <button type="button" onClick={()=>setRatio(v)} style={{border:`1px solid ${ratio===v?C.accent:C.border}`,background:ratio===v?C.accent+'14':C.card,color:ratio===v?C.accent:C.text,borderRadius:12,fontSize:12,fontWeight:600,padding:'6px 12px',cursor:'pointer',fontFamily:'inherit'}}>{label}</button>
  );
  const sliderRow = (label, val, min, max, step, setter) => (
    <div style={{marginTop:10}}>
      <div style={{fontSize:11,color:C.muted,fontWeight:600,marginBottom:4}}>{label}</div>
      <input type="range" min={min} max={max} step={step} value={val} onChange={e=>setter(parseFloat(e.target.value))} style={{width:'100%',accentColor:C.accent}}/>
    </div>
  );

  return createPortal(
    <div data-noswipe onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:1400,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
      <FermeAuRetour fermer={onClose}/>
      <div onClick={e=>e.stopPropagation()} style={{background:C.bg,width:'100%',maxWidth:520,maxHeight:'92vh',borderRadius:'18px 18px 0 0',display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{display:'flex',gap:12,alignItems:'center',padding:'14px 16px',borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:15,fontWeight:700,color:C.text}}>✂️ Retoucher la photo</div>
            <div style={{fontSize:12,color:C.muted,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{refTitle || 'Recadre, zoome, redresse'}</div>
          </div>
          <button type="button" onClick={onClose} style={{border:'none',background:'transparent',fontSize:22,color:C.muted,cursor:'pointer',lineHeight:1}}>×</button>
        </div>

        <div style={{flex:1,minHeight:0,overflow:'auto',WebkitOverflowScrolling:'touch',overscrollBehavior:'contain',padding:'14px 16px'}}>
          {!img ? (
            <div style={{textAlign:'center'}}>
              {refPhoto && (
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:11,color:C.muted,fontWeight:600,marginBottom:6}}>ANNONCE ACTUELLE (repère)</div>
                  <PhotoVinted src={refPhoto} alt="" style={{width:110,height:'auto',borderRadius:12,border:`1px solid ${C.border}`}}/>
                </div>
              )}
              <label style={{display:'inline-flex',alignItems:'center',gap:8,border:`1px solid ${C.accent}`,background:C.accent+'12',color:C.accentTexte,borderRadius:12,fontSize:15,fontWeight:700,padding:'13px 18px',cursor:'pointer'}}>
                📷 Choisir une photo
                <input type="file" accept="image/*" onChange={onFile} style={{display:'none'}}/>
              </label>
              <div className="vrm-aide" style={{fontSize:12,color:C.muted,marginTop:12,lineHeight:1.5}}>Prends la photo d'origine sur ton téléphone (meilleure qualité que celle de Vinted). Tu la recadreras ici, puis tu la mettras toi‑même sur Vinted.</div>
            </div>
          ) : (
            <div>
              {/* (6 nov.) La photo recadrée est une photo d'article : en mode stream,
                  floutée selon le titre de SA paire (src/modeStream.js). */}
              <div style={{display:'flex',justifyContent:'center'}} data-stream-article={refTitle || ''}>
                <canvas ref={canvasRef} data-stream-photo-cible=""
                  onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
                  onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
                  style={{width:'100%',maxWidth:DW,height:'auto',borderRadius:12,border:`1px solid ${C.border}`,background:'#fff',touchAction:'none',cursor:'grab'}}/>
              </div>
              <div style={{fontSize:11,color:C.muted,textAlign:'center',marginTop:6}}>Glisse la photo pour la recadrer.</div>

              <div style={{display:'flex',gap:8,justifyContent:'center',marginTop:12,flexWrap:'wrap'}}>
                {chip('3:4','Portrait 3:4')}{chip('1:1','Carré')}{chip('4:3','Paysage 4:3')}
              </div>

              {sliderRow('ZOOM', zoom, 1, 3, 0.01, setZoom)}
              <div style={{display:'flex',gap:8,marginTop:10}}>
                <button type="button" onClick={()=>{ setRot(r=>(r+270)%360); setOff({x:0,y:0}); }} style={{flex:1,border:`1px solid ${C.border}`,background:C.card,color:C.text,borderRadius:12,fontSize:13,fontWeight:600,padding:'9px',cursor:'pointer',fontFamily:'inherit'}}>↺ Tourner</button>
                <button type="button" onClick={()=>{ setRot(r=>(r+90)%360); setOff({x:0,y:0}); }} style={{flex:1,border:`1px solid ${C.border}`,background:C.card,color:C.text,borderRadius:12,fontSize:13,fontWeight:600,padding:'9px',cursor:'pointer',fontFamily:'inherit'}}>↻ Tourner</button>
              </div>
              {sliderRow('LUMINOSITÉ', bright, 0.6, 1.5, 0.01, setBright)}
              {sliderRow('CONTRASTE', contrast, 0.6, 1.5, 0.01, setContrast)}
            </div>
          )}
        </div>

        {img && (
          <div style={{flexShrink:0,borderTop:`1px solid ${C.border}`,padding:'12px 16px',display:'flex',gap:8,alignItems:'center'}}>
            <label style={{flexShrink:0,textDecoration:'none',border:`1px solid ${C.border}`,borderRadius:12,color:C.text,fontSize:13,fontWeight:600,padding:'11px 13px',cursor:'pointer'}}>
              Changer
              <input type="file" accept="image/*" onChange={onFile} style={{display:'none'}}/>
            </label>
            <button type="button" onClick={()=>{ setZoom(1); setRot(0); setOff({x:0,y:0}); setBright(1); setContrast(1); }} style={{flexShrink:0,border:`1px solid ${C.border}`,borderRadius:12,background:C.card,color:C.muted,fontSize:13,fontWeight:600,padding:'11px 13px',cursor:'pointer',fontFamily:'inherit'}}>Réinit.</button>
            <button type="button" onClick={exportPhoto} disabled={busy} style={{flex:1,border:'none',borderRadius:12,background:C.accent,color:C.onAccent,fontSize:15,fontWeight:700,padding:'11px',cursor:busy?'default':'pointer',fontFamily:'inherit',opacity:busy?0.6:1}}>{busy?'…':'Enregistrer / Partager'}</button>
          </div>
        )}
      </div>
    </div>, document.body);
}
export { PhotoEditor };
