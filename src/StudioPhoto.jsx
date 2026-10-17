// ── STUDIO PHOTO (fonction n°33) — l'écran ─────────────────────────────────
// Ouvert depuis Annonces → « ⋯ Outils » → « Studio photo ». Chargé à la demande
// (React.lazy) : rien de ce fichier ni du moteur de détourage n'est téléchargé
// à l'ouverture de l'app. Voir src/studioPhoto.js pour les licences.
//
// Ce qu'il fait, et seulement ça :
//   1. on choisit UNE paire numérotée (une paire présente chez lui : la même
//      liste que l'inventaire physique — jamais un numéro inventé) ;
//   2. la caméra s'ouvre avec un CADRE au format des annonces (3:4), une ligne
//      de sol et des repères : toutes les paires se photographient pareil ;
//   3. la photo prise est rangée pour CETTE paire (`studio_photos_{N°}`) ;
//   4. on peut la détourer ICI, dans le navigateur, sans envoi ni clé.
// VRM ne publie RIEN sur Vinted : la photo s'enregistre sur l'appareil et c'est
// lui qui l'ajoute dans l'app Vinted. Caméra refusée ou absente ⇒ l'appareil
// photo du téléphone (champ fichier), recadré au même format, et on le DIT.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RATIO_CADRE, PHOTOS_MAX_PAR_PAIRE, recadrer, recadrerFichier, lireStudio, modifierStudio, detourerLocal } from './studioPhoto.js';

const damier = 'repeating-conic-gradient(#d9dde3 0% 25%, #ffffff 0% 50%) 50% / 16px 16px';

function Cadre({ C }) {
  // Le gabarit : bord, marges, ligne de sol à 74 %, axe central. En SVG au-dessus
  // de la vidéo ; il ne capte aucun clic.
  const trait = 'rgba(255,255,255,.92)', doux = 'rgba(255,255,255,.55)';
  return (
    <svg data-studio-cadre viewBox="0 0 300 400" preserveAspectRatio="none" aria-hidden="true"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
      <rect x="18" y="18" width="264" height="364" rx="10" fill="none" stroke={trait} strokeWidth="2" />
      <line x1="30" y1="296" x2="270" y2="296" stroke={trait} strokeWidth="2" strokeDasharray="7 6" />
      <line x1="150" y1="40" x2="150" y2="360" stroke={doux} strokeWidth="1" strokeDasharray="3 7" />
      <path d="M58 296 C 70 250, 110 236, 150 240 C 190 236, 232 246, 246 296" fill="none" stroke={doux} strokeWidth="1.5" />
      <text x="150" y="322" textAnchor="middle" fill={trait} fontSize="12" fontFamily="inherit">la paire sur cette ligne, de profil</text>
    </svg>
  );
}

export default function StudioPhoto({ C, paires, base, onClose }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);               // { num, cle, titre }
  const [photos, setPhotos] = useState(undefined);    // undefined lecture · null pas su · []
  const [mode, setMode] = useState('choix');          // choix · camera · fichier
  const [camRaison, setCamRaison] = useState('');
  const [msg, setMsg] = useState('');
  const [occupe, setOccupe] = useState('');
  const videoRef = useRef(null), fluxRef = useRef(null), fichierRef = useRef(null);

  const liste = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (paires || []).filter((p) => !t || String(p.num).toLowerCase().includes(t) || String(p.titre || '').toLowerCase().includes(t)).slice(0, 60);
  }, [paires, q]);

  const couper = () => { const f = fluxRef.current; fluxRef.current = null; if (f) try { f.getTracks().forEach((t) => t.stop()); } catch (_) {} };
  useEffect(() => couper, []);

  useEffect(() => {
    if (!sel) return; let vivant = true; setPhotos(undefined);
    lireStudio(base, sel.cle).then((r) => { if (vivant) setPhotos(r ? r.photos : null); });
    return () => { vivant = false; };
  }, [sel, base]);

  const ouvrirCamera = async () => {
    setMsg(''); setCamRaison('');
    const md = typeof navigator !== 'undefined' && navigator.mediaDevices;
    if (!md || !md.getUserMedia) { setCamRaison('absente'); setMode('fichier'); return; }
    try {
      const f = await md.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false });
      fluxRef.current = f; setMode('camera');
    } catch (e) {
      setCamRaison(e && e.name === 'NotAllowedError' ? 'refusee' : 'absente'); setMode('fichier');
    }
  };
  useEffect(() => {
    if (mode !== 'camera' || !videoRef.current || !fluxRef.current) return;
    const v = videoRef.current; v.srcObject = fluxRef.current; v.play().catch(() => {});
  }, [mode]);

  const ranger = async (img) => {
    if (!img) { setMsg('La photo n’a pas pu être lue — rien n’a été rangé. Réessaie.'); return; }
    setOccupe('rangement');
    const ph = { id: 'sp' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), at: new Date().toISOString(), img, cadre: mode === 'camera' ? 'camera' : 'fichier' };
    const r = await modifierStudio(base, sel.cle, sel.num, (l) => (l.length >= PHOTOS_MAX_PAR_PAIRE ? false : [...l, ph]));
    setOccupe('');
    if (!r.ok) { setMsg(r.raison === 'lecture' ? 'La base n’a pas répondu : je n’ai rien rangé (pour ne pas effacer les photos déjà là). Réessaie.' : 'La photo n’a pas pu être enregistrée — réessaie.'); return; }
    if (r.rien) { setMsg(`Cette paire a déjà ${PHOTOS_MAX_PAR_PAIRE} photos : retire-en une pour en ranger une autre.`); return; }
    setPhotos(r.photos); setMsg(`Photo rangée pour la paire N°${sel.num}.`);
  };

  const declencher = () => {
    const v = videoRef.current; if (!v || !v.videoWidth) { setMsg('La caméra n’envoie pas encore d’image — attends une seconde.'); return; }
    // Ce que l'écran montre dans le cadre (vidéo en `object-fit: cover`), à l'identique.
    ranger(recadrer(v, v.videoWidth, v.videoHeight));
  };
  const surFichier = async (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f) return;
    ranger(await recadrerFichier(f));
  };

  const detourer = async (ph) => {
    setOccupe('detour:' + ph.id); setMsg('Détourage dans ce navigateur… (la première fois, il charge environ 16 Mo)');
    const r = await detourerLocal(ph.img);
    if (!r.ok) { setOccupe(''); setMsg(`Le détourage n’a pas pu se faire dans ce navigateur (${r.raison}). Ta photo d’origine est gardée.`); return; }
    const w = await modifierStudio(base, sel.cle, sel.num, (l) => l.map((x) => (x.id === ph.id ? { ...x, detoure: r.img, detoureAt: new Date().toISOString() } : x)));
    setOccupe('');
    if (!w.ok) { setMsg('Détourée, mais la base n’a pas répondu : rien n’a été enregistré. Réessaie.'); return; }
    setPhotos(w.photos); setMsg('Détourée ici, sans rien envoyer. Vérifie les bords : la photo d’origine reste à côté.');
  };
  const retirer = async (ph) => {
    const w = await modifierStudio(base, sel.cle, sel.num, (l) => l.filter((x) => x.id !== ph.id));
    if (!w.ok) { setMsg('La base n’a pas répondu : rien n’a été retiré.'); return; }
    setPhotos(w.photos); setMsg('');
  };

  const fermer = () => { couper(); onClose && onClose(); };
  const btn = { border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 14px', fontSize: 13, fontWeight: 600, background: 'transparent', color: C.text, cursor: 'pointer', fontFamily: 'inherit' };
  const btnFort = { ...btn, border: 'none', background: C.accent, color: C.onAccent || '#fff' };

  return (
    <div data-studio onClick={fermer} data-noswipe style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 130, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.bg, borderRadius: '18px 18px 0 0', width: '100%', maxWidth: 620, maxHeight: '92vh', overflowY: 'auto', padding: '16px 14px calc(20px + env(safe-area-inset-bottom))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ flex: 1, fontSize: 17, fontWeight: 700, color: C.text }}>Studio photo{sel ? ` · N°${sel.num}` : ''}</span>
          {sel && <button type="button" style={btn} onClick={() => { couper(); setSel(null); setMode('choix'); setMsg(''); }}>Changer de paire</button>}
          <button type="button" aria-label="Fermer le studio photo" onClick={fermer} style={{ ...btn, padding: '6px 10px' }}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5, marginBottom: 12 }}>
          Un cadre fixe pour photographier toutes tes paires pareil. VRM ne publie rien sur Vinted : enregistre la photo sur ton appareil et ajoute-la toi-même dans l’app Vinted.
        </div>

        {!sel && (
          <div data-studio-choix>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="N° ou titre de la paire" aria-label="Chercher une paire"
              style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 15, background: C.card, color: C.text, marginBottom: 8, fontFamily: 'inherit' }} />
            {!(paires || []).length ? (
              <div style={{ fontSize: 13, color: C.muted }}>Aucune paire numérotée chez toi pour l’instant : le studio range les photos sous le numéro du carton.</div>
            ) : liste.map((p) => (
              <button key={p.cle} type="button" data-studio-paire={p.cle} onClick={() => { setSel(p); setMode('choix'); setMsg(''); }}
                style={{ display: 'flex', gap: 10, alignItems: 'center', width: '100%', textAlign: 'left', border: 'none', borderBottom: `1px solid ${C.border}`, background: 'transparent', padding: '10px 4px', cursor: 'pointer', fontFamily: 'inherit', color: C.text }}>
                <b style={{ minWidth: 48 }}>N°{p.num}</b><span style={{ fontSize: 13, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.titre || ''}</span>
              </button>
            ))}
          </div>
        )}

        {sel && (<>
          {mode === 'camera' ? (
            <div style={{ position: 'relative', width: '100%', maxWidth: 420, margin: '0 auto 10px', aspectRatio: `${RATIO_CADRE}`, borderRadius: 12, overflow: 'hidden', background: '#000' }}>
              <video ref={videoRef} data-studio-video playsInline muted autoPlay style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              <Cadre C={C} />
            </div>
          ) : null}
          {mode === 'fichier' && (
            <div data-studio-repli={camRaison || 'fichier'} style={{ fontSize: 12.5, color: C.text, lineHeight: 1.5, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
              {camRaison === 'refusee'
                ? 'La caméra a été refusée pour VRM : le cadre ne peut pas s’afficher. Prends la photo avec l’appareil photo du téléphone — elle sera recadrée au même format que le cadre. Pour retrouver le cadre, autorise la caméra dans les réglages du navigateur.'
                : 'Pas de caméra accessible ici : prends ou choisis une photo — elle sera recadrée au même format que le cadre.'}
            </div>
          )}
          <input ref={fichierRef} type="file" accept="image/*" capture="environment" data-studio-fichier onChange={surFichier} style={{ display: 'none' }} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 10 }}>
            {mode === 'camera'
              ? <button type="button" data-studio-declencher style={btnFort} disabled={!!occupe} onClick={declencher}>{occupe === 'rangement' ? 'Rangement…' : 'Prendre la photo'}</button>
              : mode === 'fichier'
                ? <button type="button" data-studio-ouvrir-fichier style={btnFort} disabled={!!occupe} onClick={() => fichierRef.current && fichierRef.current.click()}>Prendre ou choisir une photo</button>
                : <button type="button" data-studio-ouvrir style={btnFort} onClick={ouvrirCamera}>Ouvrir la caméra</button>}
            {mode === 'camera' && <button type="button" style={btn} onClick={() => { couper(); setMode('choix'); }}>Fermer la caméra</button>}
          </div>
          {msg && <div data-studio-msg style={{ fontSize: 12.5, color: C.text, lineHeight: 1.5, marginBottom: 10 }}>{msg}</div>}

          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: '6px 0' }}>Photos de la paire N°{sel.num}</div>
          {photos === undefined ? <div style={{ fontSize: 12.5, color: C.muted }}>Lecture…</div>
            : photos === null ? <div data-studio-passu style={{ fontSize: 12.5, color: C.muted }}>La base n’a pas répondu : je ne sais pas encore quelles photos sont rangées. Rien ne sera écrasé.</div>
            : !photos.length ? <div style={{ fontSize: 12.5, color: C.muted }}>Aucune photo rangée pour cette paire.</div>
            : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                {photos.map((ph, i) => (
                  <div key={ph.id} data-studio-photo={ph.id} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 6, background: C.card }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <img src={ph.img} alt={`Photo ${i + 1} de la paire N°${sel.num}`} style={{ width: ph.detoure ? '50%' : '100%', aspectRatio: `${RATIO_CADRE}`, objectFit: 'cover', borderRadius: 6 }} />
                      {ph.detoure && <img src={ph.detoure} data-studio-detoure alt="Détourée" style={{ width: '50%', aspectRatio: `${RATIO_CADRE}`, objectFit: 'contain', borderRadius: 6, background: damier }} />}
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                      {!ph.detoure && <button type="button" data-studio-detourer={ph.id} style={{ ...btn, padding: '6px 8px', fontSize: 11.5 }} disabled={!!occupe} onClick={() => detourer(ph)}>{occupe === 'detour:' + ph.id ? 'Détourage…' : 'Détourer ici'}</button>}
                      <a href={ph.detoure || ph.img} download={`VRM-${sel.cle}-${i + 1}${ph.detoure ? (/webp/.test(ph.detoure.slice(0, 20)) ? '.webp' : '.png') : '.jpg'}`} style={{ ...btn, padding: '6px 8px', fontSize: 11.5, textDecoration: 'none' }}>Enregistrer</a>
                      <button type="button" style={{ ...btn, padding: '6px 8px', fontSize: 11.5, color: C.muted }} disabled={!!occupe} onClick={() => retirer(ph)}>Retirer</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.5, marginTop: 10 }}>
            « Détourer ici » tourne dans ce navigateur, sans envoyer la photo nulle part et sans clé (modèle libre U²-Net). Détourage automatique : vérifie les bords avant de t’en servir.
          </div>
        </>)}
      </div>
    </div>
  );
}
